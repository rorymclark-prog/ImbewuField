'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { PenLine, Sprout, GraduationCap, Loader2, Check, PencilRuler } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import GeometryDesignStudio from './GeometryDesignStudio';

interface Props {
  locationData: LocationData | null;
  photoAnalysis?: string;
  appLang?: string;
  placeName?: string | null;
}

const LANGS = [
  { code: 'en', label: 'English' }, { code: 'zu', label: 'isiZulu' }, { code: 'xh', label: 'isiXhosa' },
  { code: 'af', label: 'Afrikaans' }, { code: 'st', label: 'Sesotho' }, { code: 'nso', label: 'Sepedi' },
  { code: 'tn', label: 'Setswana' }, { code: 'ts', label: 'Xitsonga' }, { code: 've', label: 'Tshivenda' },
  { code: 'ss', label: 'siSwati' }, { code: 'nr', label: 'isiNdebele' },
];

async function resizeImage(file: File, maxPx = 1400): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (e) => {
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function renderDesign(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return null;
    if (line.startsWith('## ')) {
      return <h4 key={i} className="text-sm font-display font-semibold mt-4 mb-1.5" style={{ color: '#9E5C08' }}>{line.replace('## ', '')}</h4>;
    }
    if (line.startsWith('### ')) {
      return <h5 key={i} className="text-xs font-display font-semibold mt-2.5 mb-1" style={{ color: '#1F4D2B' }}>{line.replace('### ', '')}</h5>;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={i} className="flex gap-2 text-xs font-display leading-relaxed my-0.5" style={{ color: '#20190F' }}>
          <span style={{ color: '#1F4D2B', flexShrink: 0 }}>›</span>
          <span>{line.replace(/^[-•]\s*/, '').replace(/\*\*/g, '')}</span>
        </div>
      );
    }
    return <p key={i} className="text-xs font-display leading-relaxed my-1" style={{ color: '#5C5040' }}>{line.replace(/\*\*/g, '')}</p>;
  });
}

export default function SiteDesign({ locationData, photoAnalysis, appLang, placeName }: Props) {
  const [preview, setPreview] = useState<string>('');
  const [imageData, setImageData] = useState<{ data: string; mediaType: string } | null>(null);
  const [design, setDesign] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [language, setLanguage] = useState(appLang ?? 'en');
  const [tone, setTone] = useState<'simple' | 'professional'>('simple');
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string>('');

  const processFile = useCallback(async (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const resized = await resizeImage(file);
      setImageData(resized);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not process image');
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreview(url);
    setDesign('');
  }, []);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  async function generate() {
    if (!locationData || !imageData) return;
    setLoading(true); setError(''); setDesign('');
    try {
      const res = await fetch('/api/design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: [imageData], locationData, photoAnalysis, language, tone }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setDesign(text);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Design failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Geometry-first design studio — locks traced site geometry, then AI styles overlays */}
      <GeometryDesignStudio locationData={locationData} siteName={placeName} />

      <div className="text-xs font-mono uppercase tracking-wider pt-2" style={{ color: '#9A8268', borderTop: '1px solid #E2D8C4' }}>
        Sketch → AI Design
      </div>
      <p className="text-xs font-display leading-relaxed" style={{ color: '#9A8268' }}>
        Upload a hand-drawn plan of your land (or a photo of one). Claude reads it and lays out a permaculture design on your sketch, using this site&apos;s climate, soil, sun and wind.
      </p>

      {/* Upload zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
        className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{ background: '#F5F0E8', border: `1px dashed ${preview ? 'rgba(158,92,8,0.5)' : '#E2D8C4'}` }}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => processFile(e.target.files?.[0])} />
        {preview ? (
          <img src={preview} alt="sketch" className="max-h-40 mx-auto rounded-lg" style={{ border: '1px solid #E2D8C4' }} />
        ) : (
          <div>
            <PenLine size={22} className="mx-auto mb-1.5" style={{ color: '#1F4D2B' }} />
            <p className="text-xs font-display" style={{ color: '#9A8268' }}>Drop your site sketch here or click to upload</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: '#9A8268', opacity: 0.6 }}>a hand drawing, plan, or photo of one</p>
          </div>
        )}
      </div>

      {/* Language + tone */}
      {imageData && (
        <div className="flex gap-2">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 text-xs font-display rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => setTone(tone === 'simple' ? 'professional' : 'simple')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-display transition-all flex items-center gap-1.5"
            style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
            {tone === 'simple' ? <><Sprout size={14} /> Simple</> : <><GraduationCap size={14} /> Detailed</>}
          </button>
        </div>
      )}

      {/* Generate */}
      {imageData && (
        <button onClick={generate} disabled={loading || !locationData}
          className="w-full py-2 rounded-xl text-xs font-display font-semibold transition-all"
          style={loading
            ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' }
            : { background: 'rgba(158,92,8,0.12)', border: '1px solid rgba(158,92,8,0.4)', color: '#9E5C08' }}>
          {loading ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Designing your site…</span> : <span className="flex items-center justify-center gap-1.5"><PencilRuler size={14} /> Generate design</span>}
        </button>
      )}

      {photoAnalysis && (
        <div className="text-xs font-mono px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', color: '#5C5040' }}>
          <Check size={13} /> Your photo analysis will be used in the design
        </div>
      )}

      {!locationData && (
        <p className="text-xs font-display text-center" style={{ color: '#9A8268' }}>Select a location on the map first</p>
      )}

      {error && <p className="text-xs font-mono" style={{ color: '#C0531E' }}>{error}</p>}

      {/* Design output */}
      {design && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(158,92,8,0.04)', border: '1px solid rgba(158,92,8,0.18)' }}>
          {renderDesign(design)}
          {loading && <span className="inline-block w-1.5 h-3.5 rounded-sm animate-pulse ml-0.5" style={{ background: '#9E5C08' }} />}
        </div>
      )}
    </div>
  );
}
