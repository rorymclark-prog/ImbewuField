'use client';

// PREVIEW & EXPORT (2.0) — Rory's tablet mockup, built.
//
// "this is not related but i want this page like this", with the tablet mockup attached. It is
// Mockup B in design/PREVIEW-EXPORT-V2.md: a numbered 1–6 settings rail, one large preview in the
// middle, saved maps and an export summary down the right.
//
// It lives in the 2.0 shell rather than replacing the export step in app/design/page.tsx. That
// file is ~200KB of wired-together wizard state and is what farmers use today; the mockup's own
// chrome says "ImbewuField 2.0", and the 2.0 route exists precisely so a new shell can be looked
// at beside the old one before anyone commits to cutting over.
//
// THREE PLACES THIS DELIBERATELY DIVERGES FROM THE PICTURE, all recorded in PREVIEW-EXPORT-V2.md §3:
//
//  1. TWO FINISHES, NOT THREE. The mockup draws Exact Canvas / AI Hybrid / Full Treatment plus a
//     "Start Full Treatment · 2 paid renders" promo. Full Treatment is shelved
//     (SECOND_POLISH_PASS_SHELVED in DesignGlossy.tsx) on Rory's own instruction — "I just want an
//     exact version for now and a ai render polished version also those 2" — and tests/sheet-
//     finishes.test.ts guards the shape. Drawing a second paid tier back onto a prettier screen
//     would spend a farmer's money on a pass we withdrew because it was broken.
//  2. "AI POLISHED", NOT "AI HYBRID". `hybrid` stays as the internal stage name (queue keys,
//     resultKind, gallery rows); the farmer-facing string was renamed and this is farmer-facing.
//  3. PHONE FIRST. The mockup is a tablet three-column. DESIGN.md §0 forbids carrying desktop
//     px down to a phone, so the rails stack into one column and only become columns at lg.
//
// AND THE MEMORY CONTRACT, which is not a style note. A saved sheet is a 1–3 MB data URL and a
// grid that holds full images is what crashed the app on 10 August (lib/sheet-store.ts, and the
// crash-loop work). The saved-maps rail reads metas and renders `thumb` only; exactly ONE full
// image is ever in state — the sheet on the easel — and it is released when another is chosen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Check, Image as ImageIcon, Layers, Map as MapIcon, Maximize2, MoreVertical,
  Move, Share2, Sparkles, Sun, Upload, Wind, ZoomIn, ZoomOut, RotateCcw, FileText,
} from 'lucide-react';
import { getLastSite } from '@/lib/last-site';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import { loadSheetMetas, loadSheetImage, dataUrlBytes, type StoredSheetMeta } from '@/lib/sheet-store';
import { plateSheetOrdinal } from '@/lib/report-plates';
import { SHEET_META, SHEET_ORDER, type SheetId } from '@/lib/design-studio-shell';
import {
  QUALITIES, ENGINES, UNDERLAYS, LABEL_MODES, STYLES, FINISHES,
  exportSummary, savedMapBadge, formatSavedAt,
  type Quality, type UnderlayId, type LabelMode, type StyleId, type FinishId,
} from '@/lib/preview-export';

/** A numbered section of the settings rail. The ordinal is the point — the mockup's whole left
 *  column is a sequence, and a farmer needs to know how far through it they are. */
function Step({ no, title, hint, children }: {
  no: number; title: string; hint: string; children: React.ReactNode;
}) {
  return (
    <section className="border-b px-4 py-4 last:border-b-0" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
          style={{ background: 'var(--brand-soft-2)', color: 'var(--brand)', fontFamily: 'var(--font-display)' }}
          aria-hidden
        >
          {no}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            className="text-[15px] font-bold leading-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.01em' }}
          >
            {title}
          </h2>
          <p className="mt-0.5 text-[12px] leading-snug" style={{ color: 'var(--text-3)' }}>{hint}</p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** The segmented control the mockup uses three times over (underlay, labels, quality). One
 *  component so the three can never drift apart in height, radius or active tone. */
function Segmented<T extends string>({ options, value, onChange, ariaLabel }: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className="min-h-[36px] flex-1 rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors"
            style={{
              borderColor: on ? 'var(--brand)' : 'var(--border)',
              background: on ? 'var(--brand)' : 'var(--surface)',
              color: on ? '#FFFEFA' : 'var(--text-2)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function PreviewExport() {
  // The saved sheets belong to the farmer's real site, not to the 2.0 scratch canvas — this page
  // previews work they have actually rendered, so it reads the same siteId the studio and the
  // report both derive from the last selected location.
  const siteId = useMemo(() => {
    const last = getLastSite();
    return designSiteIdFromLocation(last?.locationData ?? null);
  }, []);

  const [sheet, setSheet] = useState<SheetId>('planting');
  const [underlay, setUnderlay] = useState<UnderlayId>('photo');
  const [sharpness, setSharpness] = useState(62);
  const [labels, setLabels] = useState<LabelMode>('codes');
  const [showCounts, setShowCounts] = useState(true);
  const [style, setStyle] = useState<StyleId>('blueprint');
  const [engine, setEngine] = useState(ENGINES[0].id);
  const [quality, setQuality] = useState<Quality>('high');
  const [finish, setFinish] = useState<FinishId>('ai-polished');

  const [metas, setMetas] = useState<StoredSheetMeta[]>([]);
  const [preview, setPreview] = useState<{ id: string; image: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSheetMetas(siteId)
      .then((rows) => { if (alive) setMetas(rows); })
      .catch(() => { if (alive) setMetas([]); });
    return () => { alive = false; };
  }, [siteId]);

  // Newest first — the mockup's "Most recent" sort, and the only order a render queue makes sense
  // in. loadSheetMetas returns render order (oldest first), so this reverses rather than re-sorts.
  const savedMaps = useMemo(() => [...metas].reverse(), [metas]);

  /** The sheet on the easel. ONE at a time: the previous full image is dropped before the next is
   *  requested, which is the difference between this page and the grid that crashed the app. */
  const openSheet = useCallback(async (id: string) => {
    setPreviewBusy(true);
    setPreview(null);
    const image = await loadSheetImage(id).catch(() => null);
    setPreview(image ? { id, image } : null);
    setPreviewBusy(false);
  }, []);

  // Open the newest sheet for whichever plan sheet is selected, so choosing "06 — Planting" in
  // step 1 actually changes what is on the easel rather than only relabelling the header.
  const firstForSheet = useRef<string | null>(null);
  useEffect(() => {
    const wanted = SHEET_META[sheet].no;
    const match = savedMaps.find((m) => String(plateSheetOrdinal(m.label)).padStart(2, '0') === wanted);
    if (!match || match.id === firstForSheet.current) return;
    firstForSheet.current = match.id;
    void openSheet(match.id);
  }, [sheet, savedMaps, openSheet]);

  const summary = useMemo(
    () => exportSummary({ quality, style, labels, showCounts, bytes: preview ? dataUrlBytes(preview.image) : null }),
    [quality, style, labels, showCounts, preview],
  );

  const activeMeta = preview ? savedMaps.find((m) => m.id === preview.id) ?? null : null;

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg)' }}>
      {/* ── Page header ───────────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-20 border-b px-4 py-3"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
          <Link
            href="/design-studio-2"
            aria-label="Back to the studio"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1
              className="text-[20px] font-bold leading-tight md:text-[24px]"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.015em' }}
            >
              Preview &amp; Export
            </h1>
            <p className="mt-0.5 text-[12.5px]" style={{ color: 'var(--text-3)' }}>
              Review your design map, fine-tune settings, and export with confidence.
            </p>
          </div>

          {/* Context chips. Below lg they wrap under the title rather than squeezing it. */}
          <div className="order-last flex w-full flex-wrap gap-2 lg:order-none lg:w-auto">
            {[
              { k: 'Plan set', v: 'Design plan set' },
              { k: 'Sheet', v: `${SHEET_META[sheet].no} — ${SHEET_META[sheet].label}` },
              { k: 'Style', v: STYLES.find((s) => s.id === style)!.label },
            ].map((c) => (
              <div
                key={c.k}
                className="min-w-0 rounded-lg border px-3 py-1.5"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
              >
                <div className="u-label" style={{ fontSize: 9.5 }}>{c.k}</div>
                <div className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{c.v}</div>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Share a link to this sheet"
              className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
            >
              <Share2 size={17} />
            </button>
            <button
              type="button"
              disabled={!preview}
              className="flex min-h-[40px] items-center gap-2 rounded-lg px-4 text-[13.5px] font-bold transition-opacity disabled:opacity-45"
              style={{ background: 'var(--brand)', color: '#FFFEFA' }}
            >
              <Upload size={16} />
              Export &amp; Share
            </button>
          </div>
        </div>
      </header>

      {/* ── Body: one column on a phone, three at lg ──────────────────────────────────────── */}
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-[320px_minmax(0,1fr)_320px] xl:grid-cols-[360px_minmax(0,1fr)_360px]">

        {/* ── Settings rail ──────────────────────────────────────────────────────────────── */}
        <div className="u-card overflow-hidden lg:sticky lg:top-[92px] lg:max-h-[calc(100dvh-108px)] lg:overflow-y-auto">
          <Step no={1} title="Plan set" hint="Choose the plan set and sheet to preview.">
            <label className="sr-only" htmlFor="pe-sheet">Sheet</label>
            <select
              id="pe-sheet"
              value={sheet}
              onChange={(e) => setSheet(e.target.value as SheetId)}
              className="min-h-[42px] w-full rounded-lg border px-3 text-[13px] font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              {SHEET_ORDER.map((id) => (
                <option key={id} value={id}>{SHEET_META[id].no} — {SHEET_META[id].label}</option>
              ))}
            </select>
            <p className="mt-2 text-[11.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
              {SHEET_META[sheet].description}
            </p>
          </Step>

          <Step no={2} title="Underlay" hint="Select the base layer for your map.">
            <Segmented options={UNDERLAYS} value={underlay} onChange={setUnderlay} ariaLabel="Underlay" />
            <div className="mt-3.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="pe-sharp" className="text-[12.5px] font-semibold" style={{ color: 'var(--text-2)' }}>
                  Sharpness
                </label>
                {/* The mockup labels the slider's position in words. A number here would be a
                    setting; a word is an outcome, which is what the farmer is choosing. */}
                <span className="text-[12px] font-semibold" style={{ color: 'var(--text-3)' }}>
                  {sharpness < 34 ? 'Soft' : sharpness < 67 ? 'Balanced' : 'Crisp'}
                </span>
              </div>
              <input
                id="pe-sharp"
                type="range"
                min={0}
                max={100}
                value={sharpness}
                onChange={(e) => setSharpness(Number(e.target.value))}
                className="mt-2 w-full"
                style={{ accentColor: 'var(--brand)' }}
              />
              <p className="mt-1 text-[11.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
                Adjust underlay clarity to balance detail and labels.
              </p>
            </div>
          </Step>

          <Step no={3} title="Plant labels" hint="Control what appears on your map.">
            <Segmented options={LABEL_MODES} value={labels} onChange={setLabels} ariaLabel="Plant labels" />
            <button
              type="button"
              role="switch"
              aria-checked={showCounts}
              onClick={() => setShowCounts((v) => !v)}
              className="mt-3 flex w-full items-center gap-2.5 text-left"
            >
              <span
                className="relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors"
                style={{ background: showCounts ? 'var(--brand)' : 'var(--surface-2)' }}
              >
                <span
                  className="absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all"
                  style={{ left: showCounts ? 19 : 3 }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>Show counts</span>
                <span className="block text-[11.5px]" style={{ color: 'var(--text-3)' }}>Show quantities per element.</span>
              </span>
            </button>
          </Step>

          <Step no={4} title="Style" hint="Choose how your map is rendered.">
            {/* Swatches, not photographs. The mockup puts a little render in each card; using a
                real thumbnail here would show the CURRENT sheet under all three labels, which
                promises a preview of a style the farmer has not rendered. A swatch says
                "this is the family" without claiming to be the result. */}
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => {
                const on = s.id === style;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    aria-pressed={on}
                    className="relative overflow-hidden rounded-xl border p-0 text-left transition-colors"
                    style={{ borderColor: on ? 'var(--brand)' : 'var(--border)', background: 'var(--surface)' }}
                  >
                    <span className="block h-14 w-full" style={{ background: s.swatch }} aria-hidden />
                    {on && (
                      <span
                        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                        style={{ background: 'var(--brand)' }}
                      >
                        <Check size={12} color="#FFFEFA" strokeWidth={3} />
                      </span>
                    )}
                    <span className="block px-2 py-1.5">
                      <span className="block text-[11.5px] font-bold leading-tight" style={{ color: 'var(--text)' }}>
                        {s.label}
                      </span>
                      <span className="block text-[10.5px] leading-tight" style={{ color: 'var(--text-3)' }}>
                        {s.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step no={5} title="Render engine & quality" hint="Choose the engine and quality for your export.">
            <label className="u-label mb-1.5 block" style={{ fontSize: 10 }}>AI engine</label>
            <select
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              aria-label="AI engine"
              className="min-h-[42px] w-full rounded-lg border px-3 text-[13px] font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
            >
              {/* The two engines the worker can actually run (RENDER_ENGINES in
                  lib/render-job-contract.ts). A picker listing models we cannot dispatch to would
                  be a menu of failures. */}
              {ENGINES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
            <div className="mt-3">
              <label className="u-label mb-1.5 block" style={{ fontSize: 10 }}>Render quality</label>
              <Segmented options={QUALITIES} value={quality} onChange={setQuality} ariaLabel="Render quality" />
            </div>
          </Step>

          <Step no={6} title="Finish & export" hint="Finalize how your map will be delivered.">
            {/* TWO cards. The mockup's third — Full Treatment, "2 paid renders" — is shelved on
                Rory's own instruction and guarded by tests/sheet-finishes.test.ts. See the header. */}
            <div className="grid grid-cols-2 gap-2">
              {FINISHES.map((f) => {
                const on = f.id === finish;
                const Icon = f.id === 'exact' ? MapIcon : Sparkles;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFinish(f.id)}
                    aria-pressed={on}
                    className="rounded-xl border px-3 py-2.5 text-left transition-colors"
                    style={{
                      borderColor: on ? 'var(--brand)' : 'var(--border)',
                      background: on ? 'var(--brand-soft)' : 'var(--surface)',
                    }}
                  >
                    <Icon size={15} style={{ color: on ? 'var(--brand)' : 'var(--text-3)' }} />
                    <span className="mt-1.5 block text-[12.5px] font-bold" style={{ color: 'var(--text)' }}>
                      {f.label}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] leading-tight" style={{ color: 'var(--text-3)' }}>
                      {f.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[11.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
              Choose format and settings in the export panel.
            </p>
          </Step>
        </div>

        {/* ── The easel ──────────────────────────────────────────────────────────────────── */}
        <div
          className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-[20px] border lg:min-h-[calc(100dvh-108px)]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.image}
              alt={activeMeta?.label ?? 'Design sheet preview'}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="px-6 text-center">
              <ImageIcon size={26} style={{ color: 'var(--text-3)', margin: '0 auto' }} />
              <p className="mt-2.5 text-[13px] font-semibold" style={{ color: 'var(--text-2)' }}>
                {previewBusy ? 'Opening the sheet…' : `No saved ${SHEET_META[sheet].no} — ${SHEET_META[sheet].label} sheet yet`}
              </p>
              {!previewBusy && (
                <p className="mx-auto mt-1 max-w-[34ch] text-[12px] leading-snug" style={{ color: 'var(--text-3)' }}>
                  Render this sheet in the studio and it will appear here, with everything you have
                  already saved listed alongside it.
                </p>
              )}
            </div>
          )}

          {/* Sector chips — read off the sheet's own conditions, top-left as in the mockup. */}
          <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
            <span
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <Wind size={13} style={{ color: 'var(--text-3)' }} /> Wind
            </span>
            <span
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
            >
              <Sun size={13} style={{ color: 'var(--warn)' }} /> Winter sun
            </span>
          </div>

          {/* North arrow. Every plan sheet already carries its own drawn north point and scale
              bar (the renderer puts them there) — this is the VIEWER's chrome, so it sits on the
              stage frame rather than over the drawing. */}
          <div
            className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border text-[11px] font-bold"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontFamily: 'var(--font-display)' }}
            aria-hidden
          >
            N
          </div>

          {/* Viewer toolbar. Disabled with nothing on the easel rather than hidden — the mockup's
              silhouette should not change shape depending on whether a sheet has loaded. */}
          <div
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border p-1"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            {[
              { Icon: Move, label: 'Pan' },
              { Icon: ZoomIn, label: 'Zoom in' },
              { Icon: ZoomOut, label: 'Zoom out' },
              { Icon: RotateCcw, label: 'Reset view' },
              { Icon: Maximize2, label: 'Fit to screen' },
              { Icon: Layers, label: 'Layers' },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                type="button"
                aria-label={label}
                disabled={!preview}
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40"
                style={{ color: 'var(--text-2)' }}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Saved maps + export summary ────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-[92px] lg:max-h-[calc(100dvh-108px)] lg:overflow-y-auto">
          <div className="u-card overflow-hidden">
            <div
              className="flex items-center justify-between gap-2 border-b px-4 py-3"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2
                className="text-[15px] font-bold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
              >
                Saved maps ({savedMaps.length})
              </h2>
              <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-3)' }}>Most recent</span>
            </div>

            {savedMaps.length === 0 ? (
              <p className="px-4 py-5 text-[12.5px] leading-snug" style={{ color: 'var(--text-3)' }}>
                Nothing saved for this site yet. Every sheet you render in the studio is kept here,
                so you can come back to it without paying for the render again.
              </p>
            ) : (
              <ul className="max-h-[46vh] overflow-y-auto lg:max-h-none">
                {savedMaps.map((m) => {
                  const badge = savedMapBadge(m);
                  const on = preview?.id === m.id;
                  return (
                    <li key={m.id} className="border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => void openSheet(m.id)}
                        aria-pressed={on}
                        className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                        style={{ background: on ? 'var(--brand-soft)' : undefined }}
                      >
                        {/* THUMB ONLY. `thumb` is a small JPEG; the full sheet is 1–3 MB and is
                            fetched on demand by openSheet, one at a time. */}
                        {m.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.thumb}
                            alt=""
                            className="h-11 w-14 shrink-0 rounded-lg object-cover"
                            style={{ border: '1px solid var(--border)' }}
                          />
                        ) : (
                          <span
                            className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                          >
                            <FileText size={14} style={{ color: 'var(--text-3)' }} />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span
                            className="inline-block rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider"
                            style={{ background: badge.bg, color: badge.fg }}
                          >
                            {badge.label}
                          </span>
                          <span className="mt-1 block truncate text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
                            {m.label}
                          </span>
                          <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--text-3)' }}>
                            {formatSavedAt(m.at)}
                          </span>
                        </span>
                        <MoreVertical size={14} style={{ color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="u-card overflow-hidden">
            <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-[15px] font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                Export summary
              </h2>
            </div>
            <dl className="px-4 py-1">
              {summary.rows.map((r) => (
                <div
                  key={r.k}
                  className="flex items-baseline justify-between gap-3 border-b py-2.5 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <dt className="shrink-0 text-[12px]" style={{ color: 'var(--text-3)' }}>{r.k}</dt>
                  <dd className="text-right text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>{r.v}</dd>
                </div>
              ))}
            </dl>
            {/* The mockup states a single confident file size. This one names what it measured,
                because the only honest number available before an export runs is the size of the
                sheet actually on the easel — an invented total would look identical to a real one. */}
            <p className="px-4 pb-3.5 pt-1 text-[11px] leading-snug" style={{ color: 'var(--text-3)' }}>
              {summary.note}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
