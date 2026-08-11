// The choices and the arithmetic behind the Preview & Export screen.
//
// Split out of components/design-studio-2/PreviewExport.tsx so the parts that can be WRONG — what
// resolution a quality tier means, what a saved sheet's badge should say, how a file size is
// described — are testable without a DOM. The component keeps the layout; this keeps the facts.
//
// See design/PREVIEW-EXPORT-V2.md for the mockups this answers to, and §3 of it for the three
// places the picture is deliberately not followed.

import { RENDER_ENGINES } from './render-job-contract';
import type { StoredSheetMeta } from './sheet-store';

export type Quality = 'high' | 'medium' | 'low';
export type UnderlayId = 'photo' | 'satellite' | 'paper';
export type LabelMode = 'codes' | 'beside' | 'on-plant' | 'none';
export type StyleId = 'photo-plan' | 'satellite-overlay' | 'blueprint';
export type FinishId = 'exact' | 'ai-polished';

export const UNDERLAYS: readonly { id: UnderlayId; label: string }[] = [
  { id: 'photo', label: 'Your photo' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'paper', label: 'Plain paper' },
];

export const LABEL_MODES: readonly { id: LabelMode; label: string }[] = [
  { id: 'codes', label: 'Codes' },
  { id: 'beside', label: 'Beside' },
  { id: 'on-plant', label: 'On plant' },
  { id: 'none', label: 'None' },
];

export const STYLES: readonly { id: StyleId; label: string; hint: string; swatch: string }[] = [
  {
    id: 'photo-plan', label: 'Photo Plan', hint: 'Real photo + labels',
    swatch: 'linear-gradient(150deg, #6E7A4B 0%, #4B5733 55%, #3A4527 100%)',
  },
  {
    id: 'satellite-overlay', label: 'Satellite Overlay', hint: 'AI enhanced overlay',
    swatch: 'linear-gradient(150deg, #5C6E52 0%, #A8D88A 48%, #46603C 100%)',
  },
  {
    id: 'blueprint', label: 'Reference Blueprint', hint: 'Clean, plan-style render',
    swatch: 'linear-gradient(150deg, #FBF6EC 0%, #EDE7DB 55%, #D9CEB6 100%)',
  },
];

/**
 * TWO finishes, and only two.
 *
 * The mockup draws a third — Full Treatment, a second paid polish pass — and a promo panel selling
 * it at "2 paid renders". It is shelved (SECOND_POLISH_PASS_SHELVED in DesignGlossy.tsx) because
 * Rory asked for it to be: "I just want an exact version for now and a ai render polished version
 * also those 2 because you haven't been able to fix the hybrid properly". tests/sheet-finishes.test.ts
 * guards that shape in the studio, and this list is the same promise on a different screen.
 *
 * The farmer-facing name is "AI Polished". `hybrid` remains the internal stage name.
 */
export const FINISHES: readonly { id: FinishId; label: string; hint: string }[] = [
  { id: 'exact', label: 'Exact Canvas', hint: 'Exact geometry · instant · no AI cost' },
  { id: 'ai-polished', label: 'AI Polished', hint: 'One paid render · geometry stays locked' },
];

/** The engines the worker can actually be dispatched to — see RENDER_ENGINES. A picker offering a
 *  model the queue cannot run is a menu of failures, so this derives from the contract rather
 *  than naming models from a mockup. */
export const ENGINES: readonly { id: string; label: string }[] = RENDER_ENGINES.map((id) => ({
  id,
  label: id === 'openai' ? 'OpenAI (GPT image)' : 'Google (Gemini image)',
}));

/**
 * Quality tiers, and what each one MEANS in print.
 *
 * These are the numbers the export summary quotes, so they live next to each other: a tier whose
 * label and DPI can drift apart is how a sheet gets sold as "High" and printed at 150.
 */
export const QUALITIES: readonly { id: Quality; label: string; dpi: number }[] = [
  { id: 'high', label: 'High', dpi: 300 },
  { id: 'medium', label: 'Medium', dpi: 200 },
  { id: 'low', label: 'Low', dpi: 150 },
];

/** Human bytes. Kept here rather than inline so the export summary and any future download
 *  button cannot disagree about what "MB" means. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Today · 14:32" / "Yesterday · 16:45" / "9 Aug · 10:21" — the mockup's own shape. Invalid
 *  timestamps read as blank rather than "Invalid Date". */
export function formatSavedAt(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return '';
  const time = at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  const days = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      - new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime()) / 86_400_000,
  );
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Yesterday · ${time}`;
  return `${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${time}`;
}

export interface SavedMapBadge { label: string; bg: string; fg: string }

/**
 * What a saved row is, read from its PROVENANCE and never from its label.
 *
 * lib/sheet-store.ts is explicit about this: "Labels are presentation copy and must never be used
 * to infer whether a paid model actually produced the saved pixels." So this switches on
 * `resultKind`, and a row from before provenance existed reads as LEGACY rather than being
 * flattered into looking paid.
 */
export function savedMapBadge(meta: Pick<StoredSheetMeta, 'resultKind'>): SavedMapBadge {
  switch (meta.resultKind) {
    case 'exact':
      return { label: 'Exact', bg: 'var(--surface-2)', fg: 'var(--text-2)' };
    case 'hybrid':
    case 'ai-polished':
      return { label: 'AI Polished', bg: 'var(--brand-soft-2)', fg: 'var(--brand)' };
    case 'ai-illustrated':
      return { label: 'Illustrated', bg: 'var(--warn-soft)', fg: 'var(--warn)' };
    default:
      return { label: 'Legacy', bg: 'var(--surface-2)', fg: 'var(--text-3)' };
  }
}

export interface ExportSummary {
  rows: { k: string; v: string }[];
  note: string;
}

/**
 * What the farmer is about to get.
 *
 * THE FILE SIZE IS THE HONEST PART. The mockup states one confident number — "~24.6 MB" — for an
 * export that has not run. Nothing on this screen knows that: the sheets are stored individually,
 * and adding them up would mean loading every one, which is the memory contract this page exists
 * to respect. So the only measured number available is the sheet currently on the easel, and the
 * summary says that is what it measured. A guessed total would sit in the same row, in the same
 * type, as a real one.
 */
export function exportSummary(opts: {
  quality: Quality;
  style: StyleId;
  labels: LabelMode;
  showCounts: boolean;
  bytes: number | null;
}): ExportSummary {
  const tier = QUALITIES.find((q) => q.id === opts.quality) ?? QUALITIES[0];
  const included = ['Legend', 'Scale bar', 'North arrow'];
  if (opts.labels !== 'none') included.push(opts.showCounts ? 'Labels + counts' : 'Labels');

  return {
    rows: [
      { k: 'Format', v: 'PDF (A3 landscape)' },
      { k: 'Resolution', v: `${tier.dpi} DPI` },
      { k: 'Style', v: STYLES.find((s) => s.id === opts.style)?.label ?? '—' },
      { k: 'Include', v: included.join(' · ') },
      { k: 'This sheet', v: opts.bytes === null ? '—' : formatBytes(opts.bytes) },
    ],
    note: opts.bytes === null
      ? 'Open a saved sheet to see its size. Totals appear once an export runs.'
      : 'Measured from the sheet on screen. The full export is sized once it runs — nothing here estimates it for you.',
  };
}
