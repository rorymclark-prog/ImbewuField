'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { Camera, Loader2, Leaf, Scale, ChevronRight } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import TabBar from '@/components/TabBar';
import LessonLink from '@/components/design/LessonLink';
import { paidApiHeaders } from '@/lib/api-client-auth';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { useAppLevel, isStaffRole } from '@/lib/app-level';
import { useRoleNavigation } from '@/lib/use-role-navigation';
import { resizeForStorage } from '@/lib/site-evidence';
import workspace from '@/components/layout/Workspace.module.css';

// A 12 MP phone photo (the common case on the cheap Android phones this app targets) is several
// MB — well over what the API will accept — and uploading it uses mobile data the farmer is
// paying for. Downscale to this before sending; the full-resolution file is never uploaded.
const VISION_UPLOAD_MAX_PX = 1600;

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
  high:   { bg: 'rgba(31,77,43,0.10)',   color: 'var(--color-forest-800)', label: 'High confidence' },
  medium: { bg: 'rgba(192,122,30,0.10)', color: 'var(--gold)', label: 'Medium confidence' },
  low:    { bg: 'rgba(92,80,64,0.10)',   color: 'var(--text-secondary)', label: 'Low confidence' },
};

function ConfidencePill({ level, zu, lang }: { level: 'high' | 'medium' | 'low'; zu: boolean; lang: string }) {
  const s = CONFIDENCE_STYLE[level];
  const label = zu
    ? level === 'high' ? 'Ukuqiniseka okuphezulu' : level === 'medium' ? 'Ukuqiniseka okuphakathi' : 'Ukuqiniseka okuphansi'
    : inlineText(lang, s.label);
  return (
    <span
      className="inline-block text-xs font-sans px-2.5 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {label}
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
  const { lang } = useLanguage();
  const zu = lang === 'zu';
  const t = (en: string, isiZulu: string) => inlineText(lang, en, isiZulu);
  const simple = useAppLevel() === 'simple';
  // staff-15: a mentor/ngo/funder/admin opening /vision used to see the farmer's own photo-upload
  // tool with nothing to actually photograph. Staff accounts get a short redirect card instead.
  const { navigationRole } = useRoleNavigation();
  const staffRole = isStaffRole(navigationRole);
  const [mode, setMode] = useState<Mode>('crop');
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePayload, setImagePayload] = useState<{ data: string; mediaType: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LimaResult | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  // Simple starts every new answer collapsed — the confidence readout is technical detail a
  // farmer can open, not something the plain-words answer needs by default.
  const [showDetail, setShowDetail] = useState(false);

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
    setShowDetail(false);
  }

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    // Show preview via object URL (SSR-safe: this only runs in the browser event handler) — the
    // preview stays full quality since it never leaves the device; only the upload is downscaled.
    const url = URL.createObjectURL(file);
    setPreview(url);
    setResult(null);
    setNetworkError(null);
    setShowDetail(false);
    setImagePayload(null);

    resizeForStorage(file, VISION_UPLOAD_MAX_PX)
      .then((dataUrl) => {
        const [header, data] = dataUrl.split(',');
        // Extract mediaType from data:image/jpeg;base64 → image/jpeg
        const mediaType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
        setImagePayload({ data, mediaType });
      })
      .catch(() => {
        setNetworkError(t('Could not process this photo — try again.', 'Asikwazanga ukucubungula lesi sithombe — zama futhi.'));
      });
  }, [t]);

  async function askLima() {
    if (!imagePayload) return;
    setLoading(true);
    setResult(null);
    setNetworkError(null);
    setShowDetail(false);

    try {
      const res = await fetch('/api/lima-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...await paidApiHeaders() },
        body: JSON.stringify({ image: imagePayload, mode }),
      });

      if (!res.ok) {
        if (res.status === 413) {
          setNetworkError(t('This photo is too large — try again with a clearer, closer photo.', 'Lesi sithombe sikhulu kakhulu — zama futhi ngesithombe esicacile, esiseduze.'));
        } else {
          setNetworkError((zu ? `Kube nenkinga kuseva (${res.status}). Zama futhi.` : inlineTemplate(lang, 'Server error {status} — please try again.', null, { status: res.status })));
        }
        return;
      }

      const json = (await res.json()) as LimaResult;
      setResult(json);
    } catch {
      setNetworkError(t('Could not reach Lima — check your connection and try again.', 'Ayikwazanga ukuxhumana noLima. Hlola uxhumano lwakho bese uzama futhi.'));
    } finally {
      setLoading(false);
    }
  }

  const cropResult = result && result.ok ? (result as CropResult) : null;
  const weighResult = result && result.ok && mode === 'weigh' ? (result as WeighResult) : null;
  const errResult = result && !result.ok ? (result as ErrorResult) : null;

  // staff-15: this tool photographs a planted bed, which a mentor/ngo/funder/admin account has
  // none of — show a short redirect card instead of the farmer's upload/weigh flow.
  if (staffRole) {
    return (
      <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>
        <AppHeader title="Lima Vision" />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="rounded-2xl px-6 py-8 text-center max-w-xs" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
            <div className="mx-auto mb-3 flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: 'rgba(31,77,43,0.08)' }}>
              <Camera size={22} style={{ color: 'var(--color-forest-800)' }} />
            </div>
            <h1 className="text-sm font-display font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {t('Lima Vision is a farmer tool', 'I-Lima Vision iyithuluzi labalimi')}
            </h1>
            <p className="text-xs font-sans leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              {t('It photographs a planted bed to identify crops and estimate harvest weight — nothing to point it at from here.', 'Ithatha isithombe sombhede otshaliwe ukuze ihlonze izitshalo futhi ilinganise isisindo sesivuno — akukho okungathwetshulwa lapha.')}
            </p>
            <Link
              href="/home"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-sans font-semibold text-sm transition-all"
              style={{ background: 'var(--color-forest-800)', color: 'var(--bg-1)', textDecoration: 'none' }}
            >
              {t('Back to my dashboard', 'Buyela kwideshibhodi yami')}
            </Link>
          </div>
        </main>
        <TabBar hideAtDesktop />
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: 'var(--bg-0)' }}>

      {/* ── Header ── */}
      <AppHeader
        title="Lima Vision"
        right={<LessonLink id="vision:overview" label={t('Learn', 'Funda')} />}
      />

      {/* ── Scrollable body ── */}
      <main className="flex-1 overflow-y-auto">
        {/* sdesk-07: max-w-md (448px) left ~400px of empty paper either side at 1280px — this is
            a sequential upload-then-result flow, not independent cards, so it keeps one column
            rather than forcing a two-up grid split across steps that depend on each other; the
            shared readingWidth token (960px) still gives it real desktop width instead of a
            stretched phone column. */}
        <div className={`${workspace.workspace} ${workspace.formWidth} px-4 md:px-8 py-5 md:py-8 space-y-5`} style={{ paddingBottom: 'var(--lima-fab-clearance, 88px)' }}>

          {/* code-13: AppHeader's title is a <span>, not a heading — this page needs its own
              real <h1> now that the old text-xs chip is gone. */}
          <h1 className="font-display" style={{ fontSize: 'clamp(20px, 2vw, 28px)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Lima Vision
          </h1>

          {/* Mode toggle */}
          <div
            className="flex rounded-2xl p-1 gap-1"
            style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}
          >
            {([
              { v: 'crop' as Mode,  label: t("What's growing?", 'Kukhula ini?'),   Icon: Leaf  },
              { v: 'weigh' as Mode, label: t('Weigh my harvest', 'Kala isivuno sami'),  Icon: Scale },
            ] as const).map(({ v, label, Icon }) => {
              const on = mode === v;
              return (
                <button
                  key={v}
                  onClick={() => switchMode(v)}
                  aria-pressed={on}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-display font-semibold transition-all"
                  style={{
                    background: on ? 'var(--color-forest-800)' : 'transparent',
                    color: on ? 'var(--on-forest-800)' : 'var(--text-secondary)',
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

          {/* desk-13: capture and result sit side by side at md+ (one column on phone). */}
          {/* w18-52: the second column only holds the result, so before one exists the capture
              column is a single centred ~720px column instead of half a blank page. */}
          <div
            className={result && !loading ? workspace.twoColumns : undefined}
            style={result && !loading ? undefined : { maxWidth: 720, marginInline: 'auto' }}
          >
          <div className="space-y-5">
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
                background: 'var(--bg-1)',
                border: `1.5px dashed ${preview ? 'rgba(31,77,43,0.4)' : 'var(--border)'}`,
                cursor: 'pointer',
                padding: 0,
                overflow: 'hidden',
              }}
              aria-label={t('Take or choose a photo', 'Thatha noma khetha isithombe')}
            >
              {preview ? (
                <img
                  src={preview}
                  alt={t('Selected photo', 'Isithombe esikhethiwe')}
                  width={800}
                  height={260}
                  className="w-full object-cover"
                  // code-20: a fixed height (not maxHeight, which only caps a size the browser
                  // cannot know before decode) reserves this box before the photo loads, so the
                  // capture button and result card below it do not jump once it has.
                  style={{ height: 260, display: 'block' }}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 py-12 px-6">
                  <Camera size={36} style={{ color: 'var(--color-forest-800)' }} strokeWidth={1.5} />
                  <div className="text-center">
                    <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {t('Take / choose a photo', 'Thatha / khetha isithombe')}
                    </div>
                    <div className="font-sans text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      {mode === 'crop'
                        ? t('Photo of your planted bed', 'Isithombe sendawo oyitshalile')
                        : t('Photo of your harvested produce', 'Isithombe sesivuno sakho')}
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
                background: 'var(--color-forest-800)',
                color: 'var(--on-forest-800)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LimaSprout size={18} />
              <span style={{ color: 'var(--on-forest-800)' }}>{t('Ask Lima', 'Buza uLima')}</span>
            </button>
          )}

          {/* Loading state */}
          {loading && (
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-4"
              role="status"
              aria-live="polite"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}
            >
              <Loader2 size={20} className="animate-spin flex-shrink-0" style={{ color: 'var(--color-forest-800)' }} />
              <div>
                <div className="font-display font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {t('Lima is reading the photo…', 'ULima ubheka isithombe…')}
                </div>
                <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {t('Usually 5–15 seconds', 'Ngokuvamile kuthatha imizuzwana engu-5–15')}
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

          </div>
          <div className="space-y-5">
          {/* Result card */}
          {result && !loading && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderLeft: '3px solid var(--color-forest-800)' }}
            >
              <div className="px-4 pt-4 pb-3">
                {/* Header row */}
                <div className="flex items-center gap-2 mb-3">
                  <LimaSprout size={20} />
                  <span className="text-xs font-sans uppercase tracking-widest" style={{ color: 'var(--color-forest-800)', letterSpacing: '0.08em' }}>
                    {t('Lima says', 'Impendulo kaLima')}
                  </span>
                </div>

                {/* Error result */}
                {errResult && (
                  <>
                    {(zu || lang === 'xh') && <p className="font-sans text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{zu ? 'Impendulo ye-AI engezansi ingesiNgisi.' : inlineText(lang, 'The AI answer below is in English.')}</p>}
                    <p className="font-sans text-sm" style={{ color: 'var(--text-secondary)' }}>{errResult.error}</p>
                  </>
                )}

                {/* Crop result */}
                {cropResult && mode === 'crop' && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-display font-bold text-2xl md:text-4xl leading-tight" style={{ color: 'var(--color-forest-800)', letterSpacing: '-0.02em' }}>
                        {cropResult.crop}
                      </div>
                      <div className="font-sans text-sm md:text-base mt-1" style={{ color: 'var(--text-secondary)' }}>
                        ~{cropResult.estimatedKg} kg &nbsp;&middot;&nbsp; ~{cropResult.weeksToHarvest} {zu ? cropResult.weeksToHarvest === 1 ? 'isonto' : 'amaviki' : cropResult.weeksToHarvest === 1 ? inlineText(lang, 'week') : inlineText(lang, 'weeks')} {t('to harvest', 'kuze kuvunwe')}
                      </div>
                    </div>
                    {(!simple || showDetail) && <ConfidencePill level={cropResult.confidence} zu={zu} lang={lang} />}
                    {(zu || lang === 'xh') && <p className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>{zu ? 'Impendulo ye-AI engezansi ingesiNgisi.' : inlineText(lang, 'The AI answer below is in English.')}</p>}
                    <p className="font-sans text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {cropResult.note}
                    </p>
                    {simple && !showDetail && (
                      <button
                        type="button"
                        onClick={() => setShowDetail(true)}
                        className="font-sans text-xs font-semibold underline"
                        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {t('More detail', 'Imininingwane engeziwe')}
                      </button>
                    )}
                  </div>
                )}

                {/* Weigh result */}
                {weighResult && mode === 'weigh' && (
                  <div className="space-y-3">
                    <div>
                      <div className="font-display font-bold text-2xl md:text-4xl leading-tight" style={{ color: 'var(--color-forest-800)', letterSpacing: '-0.02em' }}>
                        ~{weighResult.estimatedKg} kg
                      </div>
                    </div>
                    {(!simple || showDetail) && <ConfidencePill level={weighResult.confidence} zu={zu} lang={lang} />}
                    {(zu || lang === 'xh') && <p className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>{zu ? 'Impendulo ye-AI engezansi ingesiNgisi.' : inlineText(lang, 'The AI answer below is in English.')}</p>}
                    <p className="font-sans text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      {weighResult.note}
                    </p>
                    {simple && !showDetail && (
                      <button
                        type="button"
                        onClick={() => setShowDetail(true)}
                        className="font-sans text-xs font-semibold underline"
                        style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        {t('More detail', 'Imininingwane engeziwe')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Action hints */}
              {result.ok && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {mode === 'crop' ? (
                    <Link
                      href="/journal"
                      className="flex items-center gap-2 px-4 py-3 text-xs font-display font-semibold"
                      style={{ color: 'var(--color-forest-800)', textDecoration: 'none' }}
                    >
                      <ChevronRight size={14} />
                      {t('Log to journal', 'Bhala encwadini yensimu')}
                    </Link>
                  ) : (
                    <Link
                      href="/records?tab=charts"
                      className="flex items-center gap-2 px-4 py-3 text-xs font-display font-semibold"
                      style={{ color: 'var(--color-forest-800)', textDecoration: 'none' }}
                    >
                      <ChevronRight size={14} />
                      {t('Log a sale', 'Bhala ukuthengisa')}
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
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Camera size={14} strokeWidth={1.8} />
              {t('Try another photo', 'Zama ngesinye isithombe')}
            </button>
          )}
          </div>
          </div>

        </div>
      </main>

      <TabBar hideAtDesktop />
    </div>
  );
}
