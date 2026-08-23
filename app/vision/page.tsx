'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Camera, Loader2, Leaf, Scale, ChevronRight } from 'lucide-react';
import BackButton from '@/components/BackButton';
import BrandLogo from '@/components/BrandLogo';
import SettingsButton from '@/components/SettingsButton';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import MenuButton from '@/components/MenuButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'crop' | 'weigh';

interface CropResult {
  ok: true;
  crop: string;
  confidence: 'high' | 'medium' | 'low';
  estimatedKg: number;
  weeksToHarvest: number;
  note: string;
}

interface WeighResult {
  ok: true;
  estimatedKg: number;
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

interface ErrorResult {
  ok: false;
  error: string;
}

type LimaResult = CropResult | WeighResult | ErrorResult;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONFIDENCE_STYLE: Record<'high' | 'medium' | 'low', { bg: string; color: string; label: string }> = {
  high:   { bg: 'rgba(31,77,43,0.10)',   color: '#1F4D2B', label: 'High confidence' },
  medium: { bg: 'rgba(192,122,30,0.10)', color: '#C07A1E', label: 'Medium confidence' },
  low:    { bg: 'rgba(92,80,64,0.10)',   color: '#5C5040', label: 'Low confidence' },
};

function ConfidencePill({ level }: { level: 'high' | 'medium' | 'low' }) {
  const s = CONFIDENCE_STYLE[level];
  return (
    <span
      className="inline-block text-xs font-sans px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

// Lima sprout glyph SVG
function LimaSprout({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#1F4D2B"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 21V11" />
      <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
      <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
    </svg>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VisionPage() {
  const [mode, setMode] = useState<Mode>('crop');
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<{ data: string; mediaType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LimaResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke blob URL on each retake and on unmount to avoid memory leaks on low-end devices
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  // Reset result when mode changes so stale crop data doesn't show under weigh
  function switchMode(m: Mode) {
    setMode(m);
    setResult(null);
    setNetworkError(null);
  }

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    // Show preview via object URL (SSR-safe: this only runs in the browser event handler)
    const url = URL.createObjectURL(file);
    setPreview(url);
    setResult(null);
    setNetworkError(null);

    // Read base64 via FileReader (browser-only — safe inside event callback)
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const [header, data] = dataUrl.split(',');
      // Extract mediaType from data:image/jpeg;base64 → image/jpeg
      const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
      setImagePayload({ data, mediaType });
    };
    reader.readAsDataURL(file);
  }, []);

  async function askLima() {
    if (!imagePayload) return;
    setLoading(true);
    setResult(null);
    setNetworkError(null);

    try {
      const res = await fetch('/api/lima-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePayload, mode }),
      });

      if (!res.ok) {
        setNetworkError(`Server error ${res.status} — please try again.`);
        return;
      }

      const json = (await res.json()) as LimaResult;
      setResult(json);
    } catch {
      setNetworkError('Could not reach Lima — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  const cropResult = result && result.ok ? (result as CropResult) : null;
  const weighResult = result && result.ok && mode === 'weigh' ? (result as WeighResult) : null;
  const errResult = result && !result.ok ? (result as ErrorResult) : null;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>

      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center px-4 gap-3"
        style={{ height: 52, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}
      >
        <MenuButton />
        <BackButton fallback="/home" />
        <BrandLogo />
        <div className="w-px h-5" style={{ background: '#E2D8C4' }} />
        <span className="text-xs font-display truncate min-w-0" style={{ color: '#5C5040' }}>Lima Vision</span>
        <div className="flex-1" />
        <LessonLink id="vision:overview" label="Learn" />
        <SettingsButton />
      </header>

      {/* ── Scrollable body ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-5 space-y-5" style={{ paddingBottom: 88 }}>

          {/* Mode toggle */}
          <div
            className="flex rounded-2xl p-1 gap-1"
            style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}
          >
            {([
              { v: 'crop' as Mode,  label: "What's growing?",   Icon: Leaf  },
              { v: 'weigh' as Mode, label: 'Weigh my harvest',  Icon: Scale },
            ] as const).map(({ v, label, Icon }) => {
              const on = mode === v;
              return (
                <button
                  key={v}
                  onClick={() => switchMode(v)}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold transition-all"
                  style={{
                    background: on ? '#1F4D2B' : 'transparent',
                    color: on ? '#F7F2E9' : '#5C5040',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Capture card */}
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full rounded-2xl transition-all"
              style={{
                background: '#FFFEFA',
                border: `1.5px dashed ${preview ? 'rgba(31,77,43,0.4)' : '#E2D8C4'}`,
                cursor: 'pointer',
                padding: 0,
                overflow: 'hidden',
              }}
              aria-label="Take or choose a photo"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Selected photo"
                  className="w-full object-cover"
                  style={{ maxHeight: 260, display: 'block' }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 px-6">
                  <Camera size={36} style={{ color: '#1F4D2B' }} strokeWidth={1.5} />
                  <div className="text-center">
                    <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>
                      Take / choose a photo
                    </div>
                    <div className="font-sans text-xs mt-1" style={{ color: '#8C7A62' }}>
                      {mode === 'crop'
                        ? 'Photo of your planted bed'
                        : 'Photo of your harvested produce'}
                    </div>
                  </div>
                </div>
              )}
            </button>
          </div>

          {/* Ask Lima button */}
          {imagePayload && !loading && (
            <button
              onClick={askLima}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-display font-semibold"
              style={{
                background: '#1F4D2B',
                color: '#F7F2E9',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LimaSprout size={18} />
              <span style={{ color: '#F7F2E9' }}>Ask Lima</span>
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-4"
              style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}
            >
              <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: '#1F4D2B' }} />
              <div>
                <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>
                  Lima is reading the photo…
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: '#8C7A62' }}>
                  Usually 5–15 seconds
                </div>
              </div>
            </div>
          )}

          {/* Network error */}
          {networkError && (
            <div
              className="rounded-2xl px-4 py-4"
              style={{ background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)' }}
            >
              <p className="font-sans text-sm" style={{ color: '#7A4D10' }}>{networkError}</p>
            </div>
          )}

          {/* Result card */}
          {result && !loading && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', borderLeft: '3px solid #1F4D2B' }}
            >
              <div className="px-4 pt-4 pb-3">
                {/* Header row */}
                <div className="flex items-center gap-2 mb-3">
                  <LimaSprout size={20} />
                  <span className="text-xs font-sans uppercase tracking-widest" style={{ color: '#1F4D2B', letterSpacing: '0.08em' }}>
                    Lima says
                  </span>
                </div>

                {/* Error result */}
                {errResult && (
                  <p className="font-sans text-sm" style={{ color: '#5C5040' }}>{errResult.error}</p>
                )}

                {/* Crop result */}
                {cropResult && mode === 'crop' && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-display font-bold text-2xl leading-tight" style={{ color: '#1F4D2B', letterSpacing: '-0.02em' }}>
                        {cropResult.crop}
                      </div>
                      <div className="font-sans text-sm mt-1" style={{ color: '#5C5040' }}>
                        ~{cropResult.estimatedKg} kg &nbsp;&middot;&nbsp; ~{cropResult.weeksToHarvest} {cropResult.weeksToHarvest === 1 ? 'week' : 'weeks'} to harvest
                      </div>
                    </div>
                    <ConfidencePill level={cropResult.confidence} />
                    <p className="font-sans text-sm leading-relaxed" style={{ color: '#20190F' }}>
                      {cropResult.note}
                    </p>
                  </div>
                )}

                {/* Weigh result */}
                {weighResult && mode === 'weigh' && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-display font-bold text-2xl leading-tight" style={{ color: '#1F4D2B', letterSpacing: '-0.02em' }}>
                        ~{weighResult.estimatedKg} kg
                      </div>
                    </div>
                    <ConfidencePill level={weighResult.confidence} />
                    <p className="font-sans text-sm leading-relaxed" style={{ color: '#20190F' }}>
                      {weighResult.note}
                    </p>
                  </div>
                )}
              </div>

              {/* Action hints */}
              {result.ok && (
                <div style={{ borderTop: '1px solid #E2D8C4' }}>
                  {mode === 'crop' ? (
                    <Link
                      href="/journal"
                      className="flex items-center gap-2 px-4 py-3 text-xs font-display font-semibold"
                      style={{ color: '#1F4D2B', textDecoration: 'none' }}
                    >
                      <ChevronRight size={14} />
                      Log to journal
                    </Link>
                  ) : (
                    <Link
                      href="/finances"
                      className="flex items-center gap-2 px-4 py-3 text-xs font-display font-semibold"
                      style={{ color: '#1F4D2B', textDecoration: 'none' }}
                    >
                      <ChevronRight size={14} />
                      Log a sale
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Retake hint after result */}
          {result && !loading && (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-display font-semibold"
              style={{
                background: 'transparent',
                border: '1px solid #E2D8C4',
                color: '#5C5040',
                cursor: 'pointer',
              }}
            >
              <Camera size={14} strokeWidth={1.8} />
              Try another photo
            </button>
          )}

        </div>
      </main>

      <TabBar />
    </div>
  );
}
