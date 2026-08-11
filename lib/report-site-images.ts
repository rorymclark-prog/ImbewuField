// THE REPORT HAS TO LOOK AT THE FARM, NOT JUST BE TOLD ABOUT IT.
//
// Rory: "there is still no images … the audit said the report needs to also draw analyses from
// these images, not generic zone information". Two separate failures sat behind that sentence:
//
//  1. The design sheets only ever reached the EXPORTED PDF, as an appendix. The report on screen —
//     the thing a farmer reads, and the only thing most of them will ever read — had no maps in it
//     at all. See ReportView's figure strip.
//  2. Nothing the model wrote was informed by the drawings. It received the geometry as numbers
//     (lib/report-site-facts.ts) and never saw the plan, so anything that lives in the picture and
//     not in the numbers — how the zones sit against the slope, where the swales run relative to
//     the beds, which side of the house the orchard is on — could only be answered generically.
//     This module is the other half: the same sheets, sized for a vision model, sent with the
//     prompt.
//
// The numbers still win. An image is evidence of ARRANGEMENT, not of measurement: a model reading
// a plan will happily estimate an area off it, and that estimate would sit in the report beside
// the farmer's measured one, indistinguishable. The prompt block below says so in as many words.

import type { ReportPlate } from './report-plates';
import { plateSheetOrdinal } from './report-plates';

/** One sheet, downsized and stripped to the base64 payload an Anthropic image block wants. */
export interface SiteAnalysisImage {
  /** The sheet's gallery label, so the prompt (and the model) can name what it is looking at. */
  label: string;
  mediaType: 'image/jpeg';
  /** Base64 WITHOUT the `data:` prefix — that is the wire format for an image block. */
  data: string;
}

/**
 * How many sheets go to the model.
 *
 * Every batch of sections is an independent call (see runBatch), so each image is re-read once per
 * batch — the cost is images × batches, not images. Three at ~1.1k tokens is a few thousand tokens
 * per batch: real, affordable, and the point of the exercise. Twelve would not be.
 */
export const MAX_ANALYSIS_IMAGES = 3;

/** Longest edge. Anthropic downsamples above ~1568px anyway, and a plan sheet stays legible here. */
export const ANALYSIS_IMAGE_MAX_PX = 1100;
export const ANALYSIS_IMAGE_QUALITY = 0.72;

/** Total base64 the request may carry. A phone on a rural connection has to upload this. */
export const ANALYSIS_IMAGE_BUDGET_BYTES = 2_600_000;

/**
 * Which sheets are worth looking at, best first.
 *
 * 08 is the Final Integrated Masterplan — the one sheet that shows the whole design at once. 01 is
 * the existing site, which is what every recommendation has to be reconciled against. Then water,
 * planting and zones, the three the report says most about. 02 (sector analysis) is last: its
 * content — sun and wind arrows — is already in the site data as numbers, so it is the sheet a
 * vision model adds least to. See docs/PLAN-SET-SPEC.md for the canonical nine.
 */
const ANALYSIS_PRIORITY = [8, 1, 4, 6, 3, 7, 5, 9, 2];

function priorityRank(label: string): number {
  const at = ANALYSIS_PRIORITY.indexOf(plateSheetOrdinal(label));
  return at === -1 ? ANALYSIS_PRIORITY.length : at;
}

/** Pick the sheets to send, most informative first. Input is already one-plate-per-sheet. */
export function selectAnalysisPlates(
  plates: readonly ReportPlate[],
  max: number = MAX_ANALYSIS_IMAGES,
): ReportPlate[] {
  return [...(plates ?? [])]
    .filter((p) => p && p.id && (p.label ?? '').trim())
    .sort((a, b) => {
      const ra = priorityRank(a.label);
      const rb = priorityRank(b.label);
      if (ra !== rb) return ra - rb;
      return plateSheetOrdinal(a.label) - plateSheetOrdinal(b.label);
    })
    .slice(0, Math.max(0, max));
}

/** Rough decoded size of a base64 payload, without allocating it. */
export function base64Bytes(data: string): number {
  const len = data.length;
  if (!len) return 0;
  const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/** Strip `data:image/jpeg;base64,` — image blocks carry the payload alone. */
function base64Payload(dataUrl: string): string | null {
  const at = dataUrl.indexOf('base64,');
  if (at === -1) return null;
  const payload = dataUrl.slice(at + 'base64,'.length);
  return payload.length ? payload : null;
}

/** Downscale one sheet. Injected so this module stays free of canvas and of the PDF builder. */
export type SheetDownscaler = (
  dataUrl: string,
  maxPx: number,
  quality: number,
) => Promise<{ dataUrl: string } | null>;

/**
 * Load, downsize and encode the chosen sheets — ONE AT A TIME.
 *
 * Sequential on purpose. A saved sheet is a 1–3 MB data URL and this runs on the phone that has
 * been dying of exactly that all week; holding three originals plus three canvases at once is the
 * shape of the crash, not of a feature. Every failure is skipped rather than thrown: a report the
 * model could not look at is still a report, and losing it over an unreadable sheet is not.
 */
export async function prepareSiteAnalysisImages(
  plates: readonly ReportPlate[],
  loadImage: (id: string) => Promise<string | null>,
  downscale: SheetDownscaler,
  budgetBytes: number = ANALYSIS_IMAGE_BUDGET_BYTES,
): Promise<SiteAnalysisImage[]> {
  const out: SiteAnalysisImage[] = [];
  let spent = 0;
  for (const plate of selectAnalysisPlates(plates)) {
    let source: string | null = null;
    try {
      source = await loadImage(plate.id);
    } catch {
      source = null;
    }
    if (!source) continue;
    let shrunk: { dataUrl: string } | null = null;
    try {
      shrunk = await downscale(source, ANALYSIS_IMAGE_MAX_PX, ANALYSIS_IMAGE_QUALITY);
    } catch {
      shrunk = null;
    }
    source = null;
    if (!shrunk) continue;
    const data = base64Payload(shrunk.dataUrl);
    if (!data) continue;
    const bytes = base64Bytes(data);
    if (spent + bytes > budgetBytes) continue;
    spent += bytes;
    out.push({ label: plate.label, mediaType: 'image/jpeg', data });
  }
  return out;
}

// ── The server side ───────────────────────────────────────────────────────────────────────────

/** Hard ceiling per image on the wire, before decoding. Rejects rather than truncates. */
const MAX_WIRE_BYTES_PER_IMAGE = 2_000_000;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Validate what arrived. This crosses the wire from a client we do not control, straight into a
 * paid upstream call, so it is checked and capped rather than trusted: count, media type, payload
 * shape and total size. Anything malformed is dropped, never repaired.
 */
export function normaliseSiteAnalysisImages(value: unknown): SiteAnalysisImage[] {
  if (!Array.isArray(value)) return [];
  const out: SiteAnalysisImage[] = [];
  let spent = 0;
  for (const raw of value.slice(0, MAX_ANALYSIS_IMAGES)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const row = raw as Record<string, unknown>;
    if (row.mediaType !== 'image/jpeg') continue;
    if (typeof row.data !== 'string' || !row.data || row.data.length % 4 !== 0) continue;
    if (!BASE64.test(row.data)) continue;
    const bytes = base64Bytes(row.data);
    if (bytes > MAX_WIRE_BYTES_PER_IMAGE) continue;
    if (spent + bytes > ANALYSIS_IMAGE_BUDGET_BYTES) continue;
    spent += bytes;
    const label = typeof row.label === 'string' ? row.label.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
    out.push({ label: label || 'Design sheet', mediaType: 'image/jpeg', data: row.data });
  }
  return out;
}

/**
 * What the model is told about the pictures, immediately before it is shown them.
 *
 * The two rules that matter are the last two. A plan drawing is evidence of ARRANGEMENT — what sits
 * where, relative to what — and evidence of nothing else: every measurement in this report is taken
 * off the farmer's own traced geometry, and a number estimated off a picture would land on the page
 * beside a measured one with nothing to tell them apart. The same goes for anything the drawing
 * merely suggests: a report that describes a swale the farmer never drew is the invention rule
 * (see the system prompt) arriving through a new door.
 */
export function siteImagesPromptBlock(images: readonly SiteAnalysisImage[]): string {
  if (!images.length) return '';
  const list = images.map((img, i) => `Figure ${i + 1}: ${img.label}`).join('\n');
  return [
    `THE FARMER'S OWN PLAN SHEETS ARE ATTACHED TO THIS MESSAGE (${images.length} image${images.length === 1 ? '' : 's'}), in this order:`,
    list,
    '',
    'These are drawings of THIS farm, made in this app from this farmer\'s traced boundary and their',
    'own placed elements. Look at them before you write anything, and write about what is actually',
    'on them: where the growing areas sit relative to the house, the slope and the boundary; which',
    'side the water lines and tanks are on; what is already planted and what ground is still empty;',
    'how the drawn zones ring the dwelling. Refer to a sheet by its name when you use it ("the',
    'masterplan shows…"). Advice that would read the same for any farm in the country is a failure',
    'of this section — the farmer can already get that from a book.',
    '',
    'TWO LIMITS, both absolute:',
    '· EVERY NUMBER comes from the measured site data below — never estimate an area, a distance, a',
    '  count or a capacity off a drawing. If the picture and the data disagree, the data is right.',
    '· Describe only what is actually drawn. Do not name a swale, tank, tree, bed, path or building',
    '  you cannot see on a sheet and cannot find in the site data below.',
  ].join('\n');
}
