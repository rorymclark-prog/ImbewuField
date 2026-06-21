'use client';

import { useState, useRef, useCallback } from 'react';
import type { LocationData } from '@/lib/types';

interface Props {
  locationData: LocationData | null;
  onAnalysisComplete: (analysis: string) => void;
  mapCapture?: string | null;
}

async function resizeImage(file: File, maxPx = 1120): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target!.result as string;
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      };
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ locationData, onAnalysisComplete, mapCapture }: Props) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageData, setImageData] = useState<Array<{ data: string; mediaType: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<boolean>(false);

  const processFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, 5);
    if (!valid.length) return;

    const resized = await Promise.all(valid.map(resizeImage));
    const urls = valid.map(f => URL.createObjectURL(f));
    setPreviews(urls);
    setImageData(resized);
    setAnalysis('');
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragRef.current = false;
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  async function analyse(imgs: Array<{ data: string; mediaType: string }>, source: 'upload' | 'satellite') {
    if (!locationData || !imgs.length) return;
    setLoading(true);
    setError('');
    setAnalysis('');
    try {
      const res = await fetch('/api/analyse-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imgs, locationData, source }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      // Stream the response so text appears as Claude writes it
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setAnalysis(text);
      }
      if (text.trim()) onAnalysisComplete(text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  // Use satellite capture if provided and no uploads
  const satelliteReady = !!mapCapture && !imageData.length;

  function renderAnalysis(text: string) {
    const sections = text.split(/(?=^## )/m).filter(Boolean);
    return sections.map((section, i) => {
      const lines = section.split('\n');
      const heading = lines[0].replace(/^## /, '');
      const body = lines.slice(1).join('\n').trim();
      return (
        <div key={i} className="mb-4">
          <h4 className="text-xs font-display font-semibold mb-2" style={{ color: 'var(--gold)' }}>{heading}</h4>
          <div className="space-y-1">
            {body.split('\n').map((line, j) => {
              if (!line.trim()) return null;
              if (line.startsWith('- ') || line.startsWith('• ')) {
                return (
                  <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--emerald)', flexShrink: 0 }}>›</span>
                    <span>{line.replace(/^[-•]\s*/, '')}</span>
                  </div>
                );
              }
              return <p key={j} className="text-xs font-display leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{line.replace(/\*\*/g, '')}</p>;
            })}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        Site Photo Analysis
      </div>

      {/* Satellite capture option */}
      {mapCapture && (
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(91,158,212,0.08)', border: '1px solid rgba(91,158,212,0.25)' }}
        >
          <img src={`data:image/jpeg;base64,${mapCapture}`} alt="map" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Current satellite view</div>
            <div className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>Captured from map — Claude will analyse what it sees</div>
          </div>
          <button
            onClick={() => analyse([{ data: mapCapture, mediaType: 'image/jpeg' }], 'satellite')}
            disabled={loading || !locationData}
            className="px-3 py-1.5 rounded-lg text-xs font-display font-medium flex-shrink-0 transition-all whitespace-nowrap"
            style={{
              background: loading ? 'var(--bg-4)' : 'rgba(91,158,212,0.15)',
              border: `1px solid ${loading ? 'var(--border)' : 'rgba(91,158,212,0.4)'}`,
              color: loading ? 'var(--text-muted)' : 'var(--blue)',
            }}
          >
            {loading ? <span className="flex items-center gap-1.5"><span className="animate-spin inline-block">⟳</span> Analysing…</span> : '🛰 Analyse'}
          </button>
        </div>
      )}

      {/* Prominent loading state — appears immediately on click, before first token */}
      {loading && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(91,158,212,0.06)', border: '1px solid rgba(91,158,212,0.25)' }}
        >
          <span className="animate-spin inline-block text-lg flex-shrink-0" style={{ color: 'var(--blue)' }}>⟳</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-medium" style={{ color: 'var(--text-primary)' }}>
              {analysis ? 'Claude is analysing the imagery…' : 'Sending to Claude Vision…'}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Reads vegetation, water, terrain &amp; assets · ~15–30s
            </div>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); dragRef.current = true; }}
        onDragLeave={() => { dragRef.current = false; }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{
          background: 'rgba(22,37,20,0.4)',
          border: `1px dashed ${previews.length ? 'rgba(72,168,100,0.4)' : 'var(--border)'}`,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && processFiles(Array.from(e.target.files))}
        />
        {previews.length ? (
          <div className="flex gap-2 justify-center flex-wrap">
            {previews.map((url, i) => (
              <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid var(--border-bright)' }} />
            ))}
          </div>
        ) : (
          <div>
            <div className="text-2xl mb-1">📷</div>
            <p className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>Drop site photos here or click to upload</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Up to 5 photos · soil, vegetation, terrain, structures</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {imageData.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => analyse(imageData, 'upload')}
            disabled={loading || !locationData}
            className="flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all"
            style={{
              background: loading ? 'var(--bg-4)' : 'linear-gradient(135deg, rgba(72,168,100,0.22), rgba(72,168,100,0.08))',
              border: `1px solid ${loading ? 'var(--border)' : 'rgba(72,168,100,0.4)'}`,
              color: loading ? 'var(--text-muted)' : 'var(--emerald-bright)',
            }}
          >
            {loading ? '⟳ Analysing photos…' : `✦ Analyse ${imageData.length} photo${imageData.length > 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => { setPreviews([]); setImageData([]); setAnalysis(''); }}
            className="px-3 py-2 rounded-xl text-xs font-mono transition-all"
            style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>
      )}

      {error && <p className="text-xs font-mono" style={{ color: 'var(--orange)' }}>{error}</p>}

      {/* Analysis output — streams in progressively */}
      {analysis && (
        <div
          className="rounded-xl p-4 space-y-1"
          style={{ background: 'rgba(72,168,100,0.04)', border: '1px solid rgba(72,168,100,0.15)' }}
        >
          {renderAnalysis(analysis)}
          {loading && <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse ml-0.5" style={{ background: 'var(--emerald-bright)' }} />}
          {!loading && (
            <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(72,168,100,0.15)' }}>
              <span style={{ color: 'var(--emerald)' }}>✓</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                Added to your report — click <span style={{ color: 'var(--gold)' }}>Generate Full Report</span> above
              </span>
            </div>
          )}
        </div>
      )}

      {!locationData && (
        <p className="text-xs font-display text-center" style={{ color: 'var(--text-muted)' }}>
          Select a location on the map first
        </p>
      )}
    </div>
  );
}
