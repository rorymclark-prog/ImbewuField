'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { PenLine, Sprout, GraduationCap, Loader2, Check, PencilRuler } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLanguage } from '@/lib/i18n';

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
      return <h4 key={i} className="text-sm font-display font-semibold mt-4 mb-1.5" style={{ color: 'var(--gold)' }}>{line.replace('## ', '')}</h4>;
    }
    if (line.startsWith('### ')) {
      return <h5 key={i} className="text-xs font-display font-semibold mt-2.5 mb-1" style={{ color: 'var(--color-forest-800)' }}>{line.replace('### ', '')}</h5>;
    }
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={i} className="flex gap-2 text-xs font-display leading-relaxed my-0.5" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--color-forest-800)', flexShrink: 0 }}>›</span>
          <span>{line.replace(/^[-•]\s*/, '').replace(/\*\*/g, '')}</span>
        </div>
      );
    }
    return <p key={i} className="text-xs font-display leading-relaxed my-1" style={{ color: 'var(--text-secondary)' }}>{line.replace(/\*\*/g, '')}</p>;
  });
}

export default function SiteDesign({ locationData, photoAnalysis, appLang, placeName }: Props) {
  const { t } = useLanguage();
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
        headers: { 'Content-Type': 'application/json', ...await paidApiHeaders() },
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
      {/* Design Studio — the single canonical true-scale canvas. Opens /design for THIS
          site (carrying lat/lon, plus the saved-place name where we have it, the same way
          the "Design this" links do). The old embedded rival canvas was removed so farmers
          have one clear place to design. */}
      {locationData && (
        <Link
          href={`/design?lat=${locationData.lat.toFixed(5)}&lon=${locationData.lon.toFixed(5)}${placeName ? `&name=${encodeURIComponent(placeName)}` : ''}`}
          className="block rounded-2xl p-4 transition-all"
          style={{ background: 'linear-gradient(135deg, #1F4D2B, #2D6B3C)', border: '1px solid rgba(31,77,43,0.5)', color: '#FBF6EC', textDecoration: 'none' }}
        >
          <span className="flex items-center gap-2 font-display font-semibold" style={{ fontSize: 15 }}>
            <PencilRuler size={18} /> {t('siteDesignOpenStudio')}
          </span>
          <p className="font-display leading-relaxed mt-1.5" style={{ fontSize: 12.5, color: '#F7C97E' }}>
            {t('siteDesignStudioDesc')}
          </p>
          <span className="inline-flex items-center gap-1 font-sans mt-2" style={{ fontSize: 12, color: '#FBF6EC', opacity: 0.85 }}>
            {t('siteDesignStartDesigning')}
          </span>
        </Link>
      )}

      {!locationData && (
        <p className="text-xs font-display text-center rounded-xl p-3" style={{ color: 'var(--text-muted)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
          {t('siteDesignSelectLocation')}
        </p>
      )}

      <div className="text-xs font-mono uppercase tracking-wider pt-2" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
        {t('siteDesignSketchHeader')}
      </div>
      <p className="text-xs font-display leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {t('siteDesignUploadIntro')}
      </p>

      {/* Upload zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files[0]); }}
        className="rounded-xl p-4 text-center cursor-pointer transition-all"
        style={{ background: 'var(--bg-2)', border: `1px dashed ${preview ? 'rgba(158,92,8,0.5)' : '#E2D8C4'}` }}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => processFile(e.target.files?.[0])} />
        {preview ? (
          <img src={preview} alt="sketch" className="max-h-40 mx-auto rounded-lg" style={{ border: '1px solid var(--border)' }} />
        ) : (
          <div>
            <PenLine size={22} className="mx-auto mb-1.5" style={{ color: 'var(--color-forest-800)' }} />
            <p className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>{t('siteDesignDropSketch')}</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t('siteDesignSketchHint')}</p>
          </div>
        )}
      </div>

      {/* Language + tone */}
      {imageData && (
        <div className="flex gap-2">
          <select value={language} onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 text-xs font-display rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => setTone(tone === 'simple' ? 'professional' : 'simple')}
            className="px-2.5 py-1.5 rounded-lg text-xs font-display transition-all flex items-center gap-1.5"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            {tone === 'simple' ? <><Sprout size={14} /> {t('siteDesignToneSimple')}</> : <><GraduationCap size={14} /> {t('siteDesignToneDetailed')}</>}
          </button>
        </div>
      )}

      {/* Generate */}
      {imageData && (
        <button onClick={generate} disabled={loading || !locationData}
          className="w-full py-2 rounded-xl text-xs font-display font-semibold transition-all"
          style={loading
            ? { background: '#E2D8CB', border: '1px solid var(--border)', color: 'var(--text-muted)' }
            : { background: 'rgba(158,92,8,0.12)', border: '1px solid rgba(158,92,8,0.4)', color: 'var(--gold)' }}>
          {loading ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> {t('siteDesignGenerating')}</span> : <span className="flex items-center justify-center gap-1.5"><PencilRuler size={14} /> {t('siteDesignGenerateButton')}</span>}
        </button>
      )}

      {photoAnalysis && (
        <div className="text-xs font-mono px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)', color: 'var(--text-secondary)' }}>
          <Check size={13} /> {t('siteDesignPhotoAnalysisNote')}
        </div>
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
