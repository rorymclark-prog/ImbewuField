'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Loader2 } from 'lucide-react';
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
          <h4 className="text-xs font-display font-semibold mb-2" style={{ color: '#C07A1E' }}>{heading}</h4>
          <div className="space-y-1">
            {body.split('\n').map((line, j) => {
              if (!line.trim()) return null;
              if (line.startsWith('- ') || line.startsWith('• ')) {
                return (
                  <div key={j} className="flex gap-2 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}>
                    <span style={{ color: '#1F4D2B', flexShrink: 0, fontSize: 10 }}>-</span>
                    <span>{line.replace(/^[-•]\s*/, '')}</span>
                  </div>
                );
              }
              return <p key={j} className="text-xs font-display leading-relaxed" style={{ color: '#5C5040' }}>{line.replace(/\*\*/g, '')}</p>;
            })}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: '#8C7A62' }}>
        Site Photo Analysis
      </div>

      {/* Satellite capture option */}
      {mapCapture && (
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(35,94,134,0.08)', border: '1px solid rgba(35,94,134,0.25)' }}
        >
          <img src={`data:image/jpeg;base64,${mapCapture}`} alt="map" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" style={{ border: '1px solid #E2D8C4' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-medium mb-1" style={{ color: '#20190F' }}>Current satellite view</div>
            <div className="text-xs font-display" style={{ color: '#8C7A62' }}>Captured from map — Claude will analyse what it sees</div>
          </div>
          <button
            onClick={() => analyse([{ data: mapCapture, mediaType: 'image/jpeg' }], 'satellite')}
            disabled={loading || !locationData}
            className="px-3 py-1.5 rounded-lg text-xs font-display font-medium flex-shrink-0 transition-all whitespace-nowrap"
            style={{
              background: loading ? 'rgba(226,216,196,0.6)' : 'rgba(35,94,134,0.15)',
              border: `1px solid ${loading ? '#E2D8C4' : 'rgba(35,94,134,0.4)'}`,
              color: loading ? '#8C7A62' : '#235E86',
            }}
          >
            {loading
              ? <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Analysing…</span>
              : 'Analyse'}
          </button>
        </div>
      )}

      {/* Prominent loading state — appears immediately on click, before first token */}
      {loading && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.20)' }}
        >
          <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: '#235E86' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-medium" style={{ color: '#20190F' }}>
              {analysis ? 'Claude is analysing the imagery…' : 'Sending to Claude Vision…'}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62' }}>
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
          background: '#FBF6EC',
          border: `1px dashed ${previews.length ? 'rgba(31,77,43,0.4)' : '#E2D8C4'}`,
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
              <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid #E2D8C4' }} />
            ))}
          </div>
        ) : (
          <div>
            <div className="flex justify-center mb-1">
              <Camera size={32} style={{ color: '#1F4D2B' }} />
            </div>
            <p className="text-xs font-display" style={{ color: '#8C7A62' }}>Drop site photos here or click to upload</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#8C7A62', opacity: 0.6 }}>Up to 5 photos · soil, vegetation, terrain, structures</p>
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
              background: loading ? 'rgba(226,216,196,0.6)' : '#1F4D2B',
              border: loading ? '1px solid #E2D8C4' : 'none',
              color: loading ? '#8C7A62' : '#F7F2E9',
            }}
          >
            {loading
              ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Analysing photos…</span>
              : `Analyse ${imageData.length} photo${imageData.length > 1 ? 's' : ''}`}
          </button>
          <button
            onClick={() => { setPreviews([]); setImageData([]); setAnalysis(''); }}
            className="px-3 py-2 rounded-xl text-xs font-mono transition-all"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#8C7A62' }}
          >
            Clear
          </button>
        </div>
      )}

      {error && <p className="text-xs font-mono" style={{ color: '#D4922A' }}>{error}</p>}

      {/* Analysis output — streams in progressively */}
      {analysis && (
        <div
          className="rounded-xl p-4 space-y-1"
          style={{ background: 'rgba(31,77,43,0.04)', border: '1px solid rgba(31,77,43,0.15)' }}
        >
          {renderAnalysis(analysis)}
          {loading && <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse ml-0.5" style={{ background: '#1F4D2B' }} />}
          {!loading && (
            <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(31,77,43,0.15)' }}>
              <span style={{ color: '#1F4D2B', fontSize: 13, fontWeight: 700 }}>+</span>
              <span className="text-xs font-mono" style={{ color: '#8C7A62' }}>
                Added to your report — click <span style={{ color: '#C07A1E' }}>Generate Full Report</span> above
              </span>
            </div>
          )}
        </div>
      )}

      {!locationData && (
        <p className="text-xs font-display text-center" style={{ color: '#8C7A62' }}>
          Select a location on the map first
        </p>
      )}
    </div>
  );
}
