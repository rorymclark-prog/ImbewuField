'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import type { LocationData } from '@/lib/types';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLanguage } from '@/lib/i18n';

interface Props {
  locationData: LocationData | null;
  onAnalysisComplete: (analysis: string) => void;
  mapCapture?: string | null;
}

// Rejects with a reason code rather than an English sentence, so the caller can show a translated
// message instead of this thrown Error's own text (lang-02 — never a raw decode error to the farmer).
type ResizeFailure = 'unreadable' | 'undecodable' | 'zero-dimensions' | 'blank-heic';

async function resizeImage(file: File, maxPx = 1120): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('unreadable' satisfies ResizeFailure));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('undecodable' satisfies ResizeFailure));
      img.onload = () => {
        if (!img.naturalWidth || !img.naturalHeight) {
          reject(new Error('zero-dimensions' satisfies ResizeFailure));
          return;
        }
        const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Detect silent HEIC decode failure: canvas stays transparent → JPEG becomes black frame
        const cx = Math.floor(canvas.width / 2);
        const cy = Math.floor(canvas.height / 2);
        if (ctx.getImageData(cx, cy, 1, 1).data[3] === 0) {
          reject(new Error('blank-heic' satisfies ResizeFailure));
          return;
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ data: dataUrl.split(',')[1], mediaType: 'image/jpeg' });
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function PhotoUpload({ locationData, onAnalysisComplete, mapCapture }: Props) {
  const { t, lang } = useLanguage();
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageData, setImageData] = useState<Array<{ data: string; mediaType: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<boolean>(false);
  const previewUrls = useRef<string[]>([]);
  const siteKeyRef = useRef<string | null>(null);

  useEffect(() => () => { previewUrls.current.forEach(URL.revokeObjectURL); }, []);
  useEffect(() => {
    const nextSiteKey = locationData ? `${locationData.lat.toFixed(6)}:${locationData.lon.toFixed(6)}` : 'none';
    if (siteKeyRef.current === null) {
      siteKeyRef.current = nextSiteKey;
      return;
    }
    if (siteKeyRef.current === nextSiteKey) return;
    siteKeyRef.current = nextSiteKey;
    previewUrls.current.forEach(URL.revokeObjectURL);
    previewUrls.current = [];
    setPreviews([]);
    setImageData([]);
    setLoading(false);
    setError('');
    setAnalysis('');
    onAnalysisComplete('');
  }, [locationData?.lat, locationData?.lon, onAnalysisComplete]);

  const processFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(f => f.type.startsWith('image/')).slice(0, 5);
    if (!valid.length) return;
    setError('');
    const results = await Promise.allSettled(valid.map(resizeImage));
    const ok: Array<{ idx: number; data: { data: string; mediaType: string } }> = [];
    const errs: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') { ok.push({ idx: i, data: r.value }); return; }
      const file = valid[i].name;
      const reason = r.reason instanceof Error ? r.reason.message : '';
      const key = reason === 'unreadable' ? 'photoErrorUnreadable'
        : reason === 'undecodable' ? 'photoErrorUndecodable'
        : reason === 'zero-dimensions' ? 'photoErrorZeroDimensions'
        : reason === 'blank-heic' ? 'photoErrorBlankHeic'
        : null;
      errs.push(key ? t(key).replace('{file}', file) : t('photoErrorGeneric').replace('{n}', String(i + 1)));
    });
    if (errs.length) setError(errs.join(' · '));
    if (ok.length) {
      previewUrls.current.forEach(URL.revokeObjectURL);
      const urls = ok.map(({ idx }) => URL.createObjectURL(valid[idx]));
      previewUrls.current = urls;
      setPreviews(urls);
      setImageData(ok.map(({ data }) => data));
      setAnalysis('');
      onAnalysisComplete('');
    }
  }, [onAnalysisComplete]);

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
        headers: { 'Content-Type': 'application/json', ...await paidApiHeaders() },
        body: JSON.stringify({ images: imgs, locationData, source }),
      });
      if (!res.ok) throw new Error(`server-${res.status}`);
      // Stream the response so text appears as Lima writes it
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value, { stream: true });
        setAnalysis(text);
      }
      if (text.trim()) {
        const isBlackFrame = /cannot extract meaningful visual|essentially a black frame|extremely dark|underexposed|appears blank/i.test(text);
        if (isBlackFrame) {
          setError(t('photoErrorBlankOrDark'));
        } else {
          onAnalysisComplete(text);
        }
      }
    } catch (err: unknown) {
      // Never the raw server status or JS error message — see lang-02.
      if (err instanceof Error) console.error('Photo analysis failed:', err.message);
      setError(t('photoErrorAnalysisFailed'));
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
                    <span style={{ color: 'var(--color-forest-800)', flexShrink: 0, fontSize: 12 }}>-</span>
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
      {lang === 'zu' && (
        <p role="note" className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('photoZuluDraftNotice')}</p>
      )}
      <div className="text-xs font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
        {t('photoAnalysisHeading')}
      </div>

      {/* Satellite capture option */}
      {mapCapture && (
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ background: 'rgba(35,94,134,0.08)', border: '1px solid rgba(35,94,134,0.25)' }}
        >
          <img src={`data:image/jpeg;base64,${mapCapture}`} alt="map" className="w-16 h-12 rounded-lg object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('photoSatelliteViewTitle')}</div>
            <div className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>{t('photoSatelliteViewDesc')}</div>
          </div>
          <button
            onClick={() => analyse([{ data: mapCapture, mediaType: 'image/jpeg' }], 'satellite')}
            disabled={loading || !locationData}
            className="px-3 py-1.5 rounded-lg text-xs font-display font-medium flex-shrink-0 transition-all whitespace-nowrap"
            style={{
              background: loading ? 'rgba(226,216,196,0.6)' : 'rgba(35,94,134,0.15)',
              border: `1px solid ${loading ? '#E2D8C4' : 'rgba(35,94,134,0.4)'}`,
              color: loading ? '#755942' : '#235E86',
            }}
          >
            {loading
              ? <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> {t('photoAnalysingEllipsis')}</span>
              : t('photoAnalyseButton')}
          </button>
        </div>
      )}

      {/* Prominent loading state — appears immediately on tap, before first token */}
      {loading && (
        <div
          className="rounded-xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.20)' }}
        >
          <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: 'var(--blue)' }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-display font-medium" style={{ color: 'var(--text-primary)' }}>
              {analysis ? t('photoAnalysingImagery') : t('photoSendingToLima')}
            </div>
            <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('photoReadsDesc')}
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
          background: 'var(--bg-1)',
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
              <img key={i} src={url} alt="" className="w-16 h-16 rounded-lg object-cover" style={{ border: '1px solid var(--border)' }} />
            ))}
          </div>
        ) : (
          <div>
            <div className="flex justify-center mb-1">
              <Camera size={32} style={{ color: 'var(--color-forest-800)' }} />
            </div>
            <p className="text-xs font-display" style={{ color: 'var(--text-muted)' }}>{t('photoDropOrTap')}</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t('photoUpToFive')}</p>
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
              color: loading ? '#755942' : '#F7F2E9',
            }}
          >
            {loading
              ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> {t('photoAnalysingPhotosButton')}</span>
              : imageData.length > 1 ? t('photoAnalysePhotosPlural').replace('{count}', String(imageData.length)) : t('photoAnalysePhotosSingular')}
          </button>
          <button
            onClick={() => {
              previewUrls.current.forEach(URL.revokeObjectURL);
              previewUrls.current = [];
              setPreviews([]);
              setImageData([]);
              setAnalysis('');
              onAnalysisComplete('');
            }}
            className="px-3 py-2 rounded-xl text-xs font-mono transition-all"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            {t('photoClearButton')}
          </button>
        </div>
      )}

      {error && <p className="text-xs font-mono" style={{ color: 'var(--orange)' }}>{error}</p>}

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
              <span style={{ color: 'var(--color-forest-800)', fontSize: 13, fontWeight: 700 }}>+</span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {t('photoAddedToReportPrefix')} <span style={{ color: 'var(--gold)' }}>{t('generateFullReport')}</span> {t('photoAddedToReportSuffix')}
              </span>
            </div>
          )}
        </div>
      )}

      {!locationData && (
        <p className="text-xs font-display text-center" style={{ color: 'var(--text-muted)' }}>
          {t('photoSelectLocationFirst')}
        </p>
      )}
    </div>
  );
}
