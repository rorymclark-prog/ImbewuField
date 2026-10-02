// ── Crop plan → a document each reader can actually work from ───────────────
//
// "If a farmer wants a crop plan printed he can export it as a PDF from the
// crop plan section which would include when to purchase seedlings and seeds."
//
// Built with jsPDF, which is already a dependency and already how this app
// ships a document (app/invoice/page.tsx, lib/report-pdf.ts). Deliberately NOT
// window.print(): the manifest declares "display": "standalone", so once the
// app is installed to a home screen there is no print affordance on iOS at
// all — window.print() resolves without throwing and without showing anything,
// so the button would look dead on exactly the device most of our farmers use.
//
// WHAT CHANGED (2026-08-05). The first version was one continuous scroll —
// cover, bed list, buying list, then a wall of one-action-per-line months. Every
// fact was on the page and none of it was addressed to anyone in particular: a
// manager deciding labour, a buyer placing an order and a worker doing Tuesday's
// job all had to read the same undifferentiated text and pull out their own
// view. It now follows the reviewed benchmark layout, in five parts:
//
//   1. PLAN DASHBOARD  — scale, crop-cycle yield benchmark, workload, decisions
//   2. YEAR IN NUMBERS — workload by month, biggest benchmarked crops
//   3. LAND OCCUPANCY  — every bed and plot across twelve months, on one sheet
//   4. FULL PLAN       — every planting as columns, nursery split from field
//   5. WORKING DOCS    — a tickable field sheet per month, and a harvest record
//
// The layout rules it holds itself to, in the benchmark's own words: begin with
// decisions not data; follow the plan's start month, never January; separate
// nursery from field work; say a rule once instead of after every item; group
// work that happens together; never lose a heading at a page break; and build
// the monthly pages for use in a field, with checkboxes and room to write.
//
// All the numbers come from lib/crop-export-benchmark.ts. Nothing in this file
// computes a quantity — it only decides what things look like.

import { numberLabel } from '@/lib/format-figures';
import type { CropTask, FoodAvailabilityItem, PlanBed, Planting } from '@/lib/crop-plan';
import { buildFieldUtilizationByMonth, buildFoodAvailability, planNotesDateLabel, recurringPlanPlantings, settleOnceRows } from '@/lib/crop-plan';
import { monthAxisSlots } from '@/lib/month-axis';
import type { PlanNote, PlanNoteKind } from '@/lib/crop-autosuggest';
import { foodGroupOf, type FoodGroup } from '@/lib/crop-groups';
import {
  buildBuyingSchedule, buildTaskMonths, monthShort, monthYearLabel, positionRangeLabel, rollingMonths,
  SUCCESSION_TIMING_GUIDANCE, taskPhrase, weightRangeLabel,
} from '@/lib/crop-export-schedule';
import {
  buildFieldSheet, buildOccupancyCalendar, compactPlaces, buildPlanDashboard,
  buildPlanTableRows, buildTopCrops, buildWorkloadSeries, cropAbbreviations,
  type CalendarRow, type MonthCount,
} from '@/lib/crop-export-benchmark';
import { cropByKey, type RainPattern } from '@/lib/crop-catalog';
import { treePickingByMonth, treePickingPhrase, type PlacedTreeGroup, type TreeSeasonChoices } from '@/lib/perennial-harvest';
import { ASSURANCE_TITLE, ASSURANCE_PARAGRAPHS, ASSURANCE_ONE_LINE } from '@/lib/plan-assurance';

export interface CropPlanPdfMeta {
  /** The design/site this plan belongs to. */
  planTitle: string;
  /**
   * "KZN Midlands · Summer rainfall", or an honest "No site set" line.
   *
   * FOR DISPLAY ONLY. Never take this apart again to recover the two halves — see locationLine.
   */
  siteLine: string;
  /**
   * The place, on its own: "KZN midlands", or "No site set".
   *
   * THE PDF USED TO RE-DERIVE THIS BY SPLITTING siteLine, AND IT WAS WRONG FOR EVERY SITE.
   * siteLine is joined with U+00B7 MIDDLE DOT and the split was on an ASCII hyphen, so all seven
   * regions in lib/water-calc.ts produced a one-element array: LOCATION got the whole string and
   * CLIMATE fell through to "Not set" while the climate was sitting right there. Worse where the
   * pattern label carries its own hyphen — "Karoo · All-year rainfall" split on THAT, printing
   * LOCATION "Karoo · All" and CLIMATE "year rainfall".
   *
   * The lesson is not "use the right separator". A display string is a rendering, and parsing one
   * back into fields is a second authority for a question that already had an answer. Region name
   * and climate label are two values at the source; they travel as two values.
   */
  locationLine: string;
  /** The climate pattern, on its own: "Summer rainfall". Empty when genuinely unknown. */
  climateLine: string;
  /**
   * The site's rainfall/frost pattern as DATA, not the rendered climateLine text — used to gate
   * the frost caveat on the Full Plan table. Optional and undefined for callers that have not
   * wired it through yet; the caveat simply does not print in that case (a warning withheld is
   * safer than one derived by re-parsing climateLine's display string).
   */
  rainPattern?: RainPattern;
  /** "6 beds · 2 staple plots · 48.0 m² of growing space". */
  bedsSummary: string;
  /** Already-localised date string for the cover line. */
  dateLabel: string;
  /** Legacy metadata slot; null when overlapping bed shares make any total
   * indefensible. Dashboard totals are rebuilt from the plan itself. */
  estimatedKgPerYear: number | null;
  lossPercent: number;
  /** Defaults and migrated 0% values are not confirmation. */
  lossAllowanceConfirmed?: boolean;
}

export interface CropPlanPdfInput {
  plantings: Planting[];
  beds: PlanBed[];
  tasks: CropTask[];
  meta: CropPlanPdfMeta;
  /** buildYearReport's paragraphs — the plan in plain words. */
  yearReport?: string[];
  /**
   * The accepted suggestion's own notes, off the saved plan (CropPlanState).
   * The printed plan is what a farmer takes to the field and what a mentor
   * reads; the warnings and the choices behind the plan belong on it.
   */
  planNotes?: PlanNote[];
  /** Epoch ms the suggestion was made at, so the printed panel can be dated
   * as honestly as the screen is — month AND year: a printed plan outlives a
   * season, and "suggested in Sep" on a page read next winter names the wrong
   * September. */
  planNotesAt?: number;
  /** "Today". Decides the reading order and every resolved year in the document. */
  now?: Date;
  /** Which of the five views to include. Omitted = all of them. */
  sections?: CropPlanSection[];
  /** Paper size for every page this call produces. Only the quick-print
   * export ever passes anything but the default: it is meant to be printed
   * at true scale and pinned on a wall, so a facilitator can pick A3 or A2
   * instead of A4. Omitted = 'a4', matching every existing caller exactly. */
  pageFormat?: CropPlanPageFormat;
  /** What the app's availability chart shows, for the printed food-availability page. Omitted =
   * the page builds the first dated year's veg and field-space rows from the plan itself and
   * prints no food-forest or animal rows. */
  availability?: CropPlanAvailability;
  /** Small PNG data URLs keyed 'crop:<key>' / 'tree:<speciesId>' / 'animal:<enterpriseId>'
   * (lib/pdf-icons.ts). A key without one prints as its short code. */
  icons?: Record<string, string>;
  /** The design's trees with a harvest record. The task summary adds a "pick" line in each month
   * a standing tree's sourced SA season covers. Omitted = bed tasks only. */
  treeGroups?: PlacedTreeGroup[];
  /** Locally confirmed picking months; a national reference is not a farm calendar. */
  treeSeasons?: TreeSeasonChoices;
}

/** One picture on the availability page: which art to use, and the name the key gives it. */
export interface AvailabilityEntry {
  iconKey: string;
  label: string;
}

/** The app chart's first twelve slots, starting at the plan's "now" month. */
export interface CropPlanAvailability {
  /** Which of the chart's two years these rows were built for. */
  yearMode?: 'established' | 'fromToday';
  veg?: FoodAvailabilityItem[][];
  /** Food-forest kinds in their sourced season. Omit when the orchard is switched out. */
  forest?: AvailabilityEntry[][];
  /** One entry per animal enterprise giving a product that month. Omit when animals are out. */
  animals?: AvailabilityEntry[][];
  /** Share of mapped growing area occupied, 0–1+ per month. */
  utilization?: number[];
  /** Placed food sources stay visible even when their production dates are unknown. */
  undated?: { iconKey: string; label: string; detail: string }[];
}

export type CropPlanSection = 'dashboard' | 'numbers' | 'calendar' | 'availability' | 'plan' | 'buying' | 'fieldsheets' | 'record' | 'taskSummary';

export type CropPlanPageFormat = 'a4' | 'a3' | 'a2';

// 'taskSummary' is deliberately excluded: it's a condensed one-pager built
// only for the quick-print export (calendar + taskSummary, nothing else).
// The full document already covers every month in detail via 'fieldsheets';
// including both there would print the same tasks twice.
export const ALL_SECTIONS: CropPlanSection[] = [
  'dashboard', 'numbers', 'calendar', 'availability', 'plan', 'buying', 'fieldsheets', 'record',
];

/** The field copy starts with pictures and jobs. Detailed benchmarks remain an optional reference. */
export const FARMER_SECTIONS: CropPlanSection[] = ['availability', 'buying', 'fieldsheets', 'record'];

/**
 * jsPDF's built-in fonts are WinAnsi-encoded: they have no glyph for an emoji
 * and no glyph for most typographic punctuation. Handed 🌽 they emit garbage
 * or nothing, and the farmer's printed plan is full of holes — so every string
 * that reaches the page goes through here first.
 *
 * Characters with a sensible Latin-1 equivalent are transliterated (an em dash
 * becomes a hyphen, ⅓ becomes 1/3); anything still above U+00FF after that —
 * every crop icon in the catalog — is dropped. Exported because a silent
 * character-mangling bug is exactly the sort that only a test catches.
 */
export function pdfSafe(text: string): string {
  const mapped = text
    .replace(/[‐-―]/g, '-')      // hyphens/dashes, incl. em & en
    .replace(/[‘’‛]/g, "'") // curly single quotes
    .replace(/[“”]/g, '"')       // curly double quotes
    .replace(/…/g, '...')
    .replace(/·/g, '-')               // middle dot (the app's own separator)
    .replace(/•/g, '-')
    .replace(/→/g, '->')
    .replace(/½/g, '1/2')
    .replace(/⅓/g, '1/3')
    .replace(/¼/g, '1/4')
    .replace(/¾/g, '3/4')
    .replace(/[     ]/g, ' ');
  const kept = [...mapped].filter((ch) => (ch.codePointAt(0) ?? 0) <= 0xff).join('');
  // Dropping an icon leaves the space that followed it, so "🌽 Maize" would
  // print as " Maize" and every bullet would look mis-indented.
  return kept.replace(/[ \t]{2,}/g, ' ').replace(/^[ \t]+|[ \t]+$/g, '');
}

/** Keep an unavailable crop benchmark visible as unavailable. Formatting a
 * nullable value through arithmetic turned kale and coriander into a false
 * "0.0 kg" claim in the printed bed table. */
export function benchmarkYieldLabel(yieldKg: number | null): string {
  if (yieldKg === null) return 'Not verified';
  if (yieldKg === 0) return 'No food yield';
  return `${yieldKg.toFixed(1)} kg`;
}

// ── Palette ─────────────────────────────────────────────────────────────────
//
// Dark green carries structure, mustard carries timing and attention,
// terracotta carries workload and risk — the benchmark's rule, and the same
// three the app already uses on screen.

const INK = {
  text: [32, 25, 15],
  muted: [124, 110, 90],
  faint: [162, 150, 130],
  green: [31, 77, 43],
  gold: [176, 122, 32],
  teal: [58, 110, 110],
  terracotta: [180, 88, 58],
  brown: [122, 79, 43],
  rule: [222, 213, 196],
  hair: [236, 230, 218],
  panelGreen: [233, 240, 232],
  panelCream: [250, 244, 231],
  panelPink: [250, 235, 230],
  panelGrey: [246, 244, 239],
  white: [255, 255, 255],
} as const;

/** One colour per food group, shared by the calendar grid and the crop bars. */
const GROUP_INK: Record<FoodGroup, readonly number[]> = {
  leafy_green: INK.green,
  herb: INK.green,
  root_tuber: INK.gold,
  allium: INK.gold,
  legume: INK.teal,
  fruiting_veg: INK.terracotta,
  squash_melon: INK.terracotta,
  staple_grain: INK.brown,
  less_common: INK.muted,
  cover_crop: INK.muted,
};

const GROUP_LEGEND: { label: string; ink: readonly number[]; groups: readonly FoodGroup[] }[] = [
  { label: 'Leafy crops and herbs', ink: INK.green, groups: ['leafy_green', 'herb'] },
  { label: 'Roots and onions', ink: INK.gold, groups: ['root_tuber', 'allium'] },
  { label: 'Legumes', ink: INK.teal, groups: ['legume'] },
  { label: 'Fruiting crops', ink: INK.terracotta, groups: ['fruiting_veg', 'squash_melon'] },
  { label: 'Staples', ink: INK.brown, groups: ['staple_grain'] },
  { label: 'Less common, cover', ink: INK.muted, groups: ['less_common', 'cover_crop'] },
];

type Doc = import('jspdf').jsPDF;

/**
 * Trim `text` to fit within `maxW` points at whatever font/size is currently
 * set on `doc`, appending "..." (never a Unicode ellipsis — pdfSafe strips
 * it) if a cut was needed. Callers pass text already through `pdfSafe`.
 *
 * Exists because plain jsPDF `.text()` calls do not wrap or clip — a string
 * that runs past its column just draws over whatever is printed next to it.
 * Two real spots hit this with farmer-authored, unbounded-length text: a
 * custom bed/plot name sharing its narrow column with the area figure
 * (drawCalendar), and a long plan title sharing the footer with the fixed
 * assurance line (Sheet.stampFooter).
 */
function truncateToWidth(doc: Doc, text: string, maxW: number): string {
  const ellipsis = '...';
  if (doc.getTextWidth(text) <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}${ellipsis}`;
    if (doc.getTextWidth(candidate) <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo <= 0 ? ellipsis : `${text.slice(0, lo).trimEnd()}${ellipsis}`;
}

interface Column {
  key: string;
  header: string;
  width: number;
  align?: 'left' | 'right';
}

/**
 * The page. jsPDF has one cursor and no concept of a layout, so this wraps it:
 * orientation-aware margins, a cursor, a footer stamped on every page, and a
 * `need()` that breaks BEFORE something is drawn half off the sheet rather than
 * after. Every drawing helper below goes through it.
 */
class Sheet {
  doc: Doc;
  y = 0;
  margin = 40;
  private footerNote: string;
  private format: CropPlanPageFormat;

  constructor(doc: Doc, footerNote: string, format: CropPlanPageFormat = 'a4') {
    this.doc = doc;
    this.footerNote = footerNote;
    this.format = format;
  }

  get width(): number { return this.doc.internal.pageSize.getWidth(); }
  get height(): number { return this.doc.internal.pageSize.getHeight(); }
  get contentWidth(): number { return this.width - this.margin * 2; }
  get bottom(): number { return this.height - 46; }

  ink(c: readonly number[]): void { this.doc.setTextColor(c[0], c[1], c[2]); }
  fill(c: readonly number[]): void { this.doc.setFillColor(c[0], c[1], c[2]); }
  stroke(c: readonly number[]): void { this.doc.setDrawColor(c[0], c[1], c[2]); }
  font(size: number, bold = false): void {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
  }

  /** Stamp the running foot. Called once per page, as the page is left. */
  stampFooter(): void {
    this.font(7.5);
    this.ink(INK.faint);
    // Just the plan name on the left: "ImbewuField crop plan - Ubhejane Creche"
    // ran straight into the centred note on a portrait page. A short title
    // still can, on a narrow enough page (A4 portrait, most facilitators'
    // default) — so the left string is truncated to whatever room is
    // actually free before the fixed centred assurance line begins, rather
    // than assumed to always be short enough.
    const assuranceText = pdfSafe(ASSURANCE_ONE_LINE);
    const assuranceLeft = this.width / 2 - this.doc.getTextWidth(assuranceText) / 2;
    const noteMaxW = Math.max(0, assuranceLeft - this.margin - 12);
    // A portrait appendix can leave no room beside the assurance line. Its
    // page heading already identifies the site; omit the footer name instead of overlapping.
    const note = noteMaxW >= 24 ? truncateToWidth(this.doc, pdfSafe(this.footerNote), noteMaxW) : '';
    this.doc.text(note, this.margin, this.height - 26);
    this.doc.text(assuranceText, this.width / 2, this.height - 26, { align: 'center' });
    this.doc.text(String(this.doc.getNumberOfPages()), this.width - this.margin, this.height - 26, { align: 'right' });
  }

  page(orientation: 'portrait' | 'landscape' = 'portrait'): void {
    this.stampFooter();
    this.doc.addPage(this.format, orientation);
    this.y = this.margin;
  }

  /** Would `h` fit on what is left of this page? Asks WITHOUT breaking. */
  fits(h: number): boolean {
    return this.y + h <= this.bottom;
  }

  /**
   * Break to a fresh page of the SAME orientation if `h` will not fit.
   *
   * Note the side effect: calling this to *test* whether something fits will
   * create a page whether or not you then draw on it. `if (!s.need(70))` at the
   * end of a field sheet produced a completely blank page 12 in the first
   * build. Use `fits()` when you only want to ask.
   */
  need(h: number): boolean {
    if (this.fits(h)) return false;
    const landscape = this.width > this.height;
    this.page(landscape ? 'landscape' : 'portrait');
    return true;
  }

  text(s: string, x: number, opts: { size?: number; bold?: boolean; ink?: readonly number[]; align?: 'left' | 'right' | 'center' } = {}): void {
    this.font(opts.size ?? 9.5, opts.bold);
    this.ink(opts.ink ?? INK.text);
    this.doc.text(pdfSafe(s), x, this.y, { align: opts.align ?? 'left' });
  }

  /** Wrapped paragraph; advances the cursor. */
  paragraph(s: string, opts: { size?: number; bold?: boolean; ink?: readonly number[]; width?: number; gap?: number } = {}): void {
    const size = opts.size ?? 9.5;
    const lead = size * 1.4;
    this.font(size, opts.bold);
    this.ink(opts.ink ?? INK.text);
    const lines = this.doc.splitTextToSize(pdfSafe(s), opts.width ?? this.contentWidth) as string[];
    this.need(lines.length * lead);
    this.doc.text(lines, this.margin, this.y);
    this.y += lines.length * lead + (opts.gap ?? 0);
  }
}

// ── Page furniture ──────────────────────────────────────────────────────────

/** The wordmark plus the corner band that says which kind of page this is. */
function masthead(s: Sheet, band: string): void {
  s.y = s.margin + 6;
  s.font(15, true);
  s.ink(INK.text);
  s.doc.text('Imbewu', s.margin, s.y);
  const w = s.doc.getTextWidth('Imbewu');
  s.ink(INK.gold);
  s.doc.text('Field', s.margin + w, s.y);

  const bandW = 176;
  const bandX = s.width - s.margin - bandW;
  s.fill(INK.green);
  s.doc.rect(bandX, s.y - 15, bandW, 26, 'F');
  s.font(7.5, true);
  s.ink(INK.white);
  s.doc.text(pdfSafe(band.toUpperCase()), s.width - s.margin - 12, s.y - 0.5, { align: 'right' });
  s.y += 28;
}

/** Eyebrow + big title, the benchmark's page-opening pattern. */
function pageTitle(s: Sheet, eyebrow: string, title: string, standfirst?: string): void {
  if (eyebrow) {
    s.font(7.5, true);
    s.ink(INK.gold);
    s.doc.text(pdfSafe(eyebrow.toUpperCase()), s.margin, s.y);
    s.y += 16;
  }
  s.font(19, true);
  s.ink(INK.text);
  s.doc.text(pdfSafe(title), s.margin, s.y);
  s.y += 16;
  if (standfirst) {
    s.paragraph(standfirst, { size: 9, ink: INK.muted, gap: 8 });
  } else {
    s.y += 4;
  }
}

/** A tinted panel with an optional heading — the note/callout box. */
function panel(
  s: Sheet,
  opts: { title?: string; body: string[]; bg: readonly number[]; accent?: readonly number[]; width?: number; x?: number },
): number {
  const x = opts.x ?? s.margin;
  const w = opts.width ?? s.contentWidth;
  const pad = 10;
  const innerW = w - pad * 2 - (opts.accent ? 4 : 0);

  s.font(8.5);
  const paras = opts.body.map((b) => s.doc.splitTextToSize(pdfSafe(b), innerW) as string[]);
  const h = pad * 2 + (opts.title ? 14 : 0) + panelBodyHeight(paras.map((p) => p.length));

  s.fill(opts.bg);
  s.doc.rect(x, s.y, w, h, 'F');
  if (opts.accent) {
    s.fill(opts.accent);
    s.doc.rect(x, s.y, 4, h, 'F');
  }
  let ty = s.y + pad + 8;
  const tx = x + pad + (opts.accent ? 4 : 0);
  if (opts.title) {
    s.font(9, true);
    s.ink(opts.accent ?? INK.green);
    s.doc.text(pdfSafe(opts.title), tx, ty);
    ty += 14;
  }
  s.font(8.5);
  s.ink(INK.text);
  // Drawn at the same 11.5pt leading the height was measured with, a small gap between paragraphs.
  // doc.text(lines) used jsPDF's own ~9.8pt leading, so every panel ended in a blank band as tall
  // as its text was short, and six paragraphs of the trust panel read as one block.
  for (const lines of paras) {
    s.doc.text(lines, tx, ty, { lineHeightFactor: PANEL_LEADING / 8.5 });
    ty += lines.length * PANEL_LEADING + PANEL_PARA_GAP;
  }
  return h;
}

const PANEL_LEADING = 11.5;
const PANEL_PARA_GAP = 3;
function panelBodyHeight(lineCounts: number[]): number {
  const lines = lineCounts.reduce((a, b) => a + b, 0);
  return lines * PANEL_LEADING + Math.max(0, lineCounts.filter((n) => n > 0).length - 1) * PANEL_PARA_GAP;
}

// ── 1. Plan dashboard ───────────────────────────────────────────────────────

function drawDashboard(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const { meta } = input;
  masthead(s, 'Crop plan');

  s.font(7.5, true);
  s.ink(INK.gold);
  s.doc.text(pdfSafe('A PRACTICAL PLAN FOR THE GARDEN TEAM'), s.margin, s.y);
  s.y += 18;
  // A farm name plus a place ("Ubhejane Creche - KZN Midlands (Pietermaritzburg)") ran straight
  // off the right edge at 21pt; wrap to two lines and only then truncate.
  s.font(21, true);
  s.ink(INK.text);
  const titleLines = s.doc.splitTextToSize(pdfSafe(`Crop plan - ${meta.planTitle}`), s.contentWidth) as string[];
  const shownTitle = titleLines.length > 2
    ? [titleLines[0], truncateToWidth(s.doc, titleLines.slice(1).join(' '), s.contentWidth)]
    : titleLines;
  s.doc.text(shownTitle, s.margin, s.y);
  s.y += 18 + (shownTitle.length - 1) * 23;
  const months = rollingMonths(nowMonth);
  const period = `${monthYearLabel(months[0], now)} to ${monthYearLabel(months[11], now)}`;
  s.font(10);
  s.ink(INK.muted);
  s.doc.text(pdfSafe(period), s.margin, s.y);
  s.y += 18;

  // Site strip — four facts, evenly spread, in the benchmark's header band.
  const facts = [
    { k: 'LOCATION', v: meta.locationLine || meta.siteLine },
    { k: 'CLIMATE', v: meta.climateLine || 'Not set' },
    { k: 'PLAN PERIOD', v: period },
    { k: 'GENERATED', v: meta.dateLabel },
  ];
  const stripH = 46;
  s.fill(INK.panelGreen);
  s.doc.rect(s.margin, s.y, s.contentWidth, stripH, 'F');
  const factW = s.contentWidth / facts.length;
  facts.forEach((f, i) => {
    const x = s.margin + i * factW + 10;
    s.font(6.5, true);
    s.ink(INK.muted);
    s.doc.text(pdfSafe(f.k), x, s.y + 14);
    s.font(8.5, true);
    s.ink(INK.text);
    const lines = s.doc.splitTextToSize(pdfSafe(f.v), factW - 18) as string[];
    s.doc.text(lines.slice(0, 2), x, s.y + 26);
  });
  s.y += stripH + 14;

  s.paragraph(
    'A crop plan should reduce uncertainty. It should show the garden team what to prepare, plant, harvest and buy - without making them decode the system behind it.',
    { size: 9.5, gap: 8 },
  );

  const dash = buildPlanDashboard(input.plantings, input.beds, input.tasks, {
    lossPercent: meta.lossPercent,
    lossAllowanceConfirmed: meta.lossAllowanceConfirmed,
    nowMonth,
  });

  // Stat tiles, sized to however many dash.stats actually holds — a fixed
  // "four tiles" assumption crashed the moment a fifth stat was added
  // (Sheet.fill(undefined) reading past the end of a 4-entry palette), so
  // the width and the palette index both cycle off the real count instead.
  const tileGap = 8;
  const tileW = (s.contentWidth - (dash.stats.length - 1) * tileGap) / dash.stats.length;
  const tints = [INK.panelGrey, INK.panelCream, INK.panelGreen, INK.panelPink];
  const values = [INK.text, INK.gold, INK.teal, INK.terracotta];
  // Label and detail wrap inside the tile and every tile takes the height of the tallest one.
  // Printing the label on one line and the detail cut to two let "known total after 10% loss"
  // run under the next tile's fill and dropped the end of "uses the loss allowance you
  // confirmed" without a mark.
  const textW = tileW - 20;
  const wrapped = dash.stats.map((stat) => {
    s.font(8, true);
    const label = s.doc.splitTextToSize(pdfSafe(stat.label), textW) as string[];
    s.font(7.5);
    const detail = s.doc.splitTextToSize(pdfSafe(stat.detail), textW) as string[];
    return { label, detail };
  });
  const maxLabel = Math.max(...wrapped.map((w) => w.label.length));
  const maxDetail = Math.max(...wrapped.map((w) => w.detail.length));
  const labelY = 47;
  const detailY = labelY + maxLabel * 10 + 2;
  const tileH = detailY + (maxDetail - 1) * 9 + 12;
  dash.stats.forEach((stat, i) => {
    const x = s.margin + i * (tileW + tileGap);
    s.fill(tints[i % tints.length]);
    s.doc.rect(x, s.y, tileW, tileH, 'F');
    // Shrink the value to fit rather than let it run into the next tile's
    // fill (which silently CLIPS it, invisibly, since the next rect paints
    // over the overflow) — the fallback strings ("Not shown", "Not
    // calculated") are exactly as long regardless of how many tiles the row
    // has to share its width with.
    const valueMaxW = textW;
    let valueSize = 17;
    s.font(valueSize, true);
    while (valueSize > 10 && s.doc.getTextWidth(pdfSafe(stat.value)) > valueMaxW) {
      valueSize -= 1;
      s.font(valueSize, true);
    }
    s.ink(values[i % values.length]);
    s.doc.text(pdfSafe(stat.value), x + 10, s.y + 30);
    s.font(8, true);
    s.ink(INK.text);
    s.doc.text(wrapped[i].label, x + 10, s.y + labelY, { lineHeightFactor: 1.2 });
    s.font(7.5);
    s.ink(INK.muted);
    s.doc.text(wrapped[i].detail, x + 10, s.y + detailY, { lineHeightFactor: 1.2 });
  });
  s.y += tileH + 12;

  // Two columns: what the plan says, and what the reader must decide.
  const colW = (s.contentWidth - 10) / 2;
  const signalsH = panel(s, {
    title: 'PLAN SIGNALS', bg: INK.panelGreen, width: colW,
    body: dash.signals.map((t) => `- ${t}`),
  });
  const decisionsH = panel(s, {
    title: 'DECISIONS TO MAKE', bg: INK.panelCream, width: colW, x: s.margin + colW + 10,
    body: dash.decisions.map((t) => `- ${t}`),
  });
  s.y += Math.max(signalsH, decisionsH) + 10;

  const totalExplanation = dash.areaConflictBedLabels.length
    ? [
      `No kilogram or value total is shown because ${dash.areaConflictBedLabels.join(', ')} ${dash.areaConflictBedLabels.length === 1 ? 'has' : 'have'} overlapping or invalid planting shares.`,
      'Resolve the bed layout instead of guessing which crop loses growing area.',
    ]
    : dash.hasKnownYield
    ? [
      `Only crops with a verified kg/m² entry are added to the conservative commercial benchmark comparison. `
      + `Known total ${dash.grossKg!.toFixed(1)} kg`
      + (meta.lossAllowanceConfirmed
        ? `; ${dash.netKg!.toFixed(1)} kg after the ${meta.lossPercent}% loss allowance you confirmed.`
        : '; no loss-adjusted total is calculated until an allowance is confirmed.'),
      'This is a benchmark comparison, not a household or farm-yield guarantee. Record actual harvests and losses on the monthly record sheet.',
    ]
    : [
      'No kilogram total is shown because this plan has no crop with a verified kg/m² food-yield benchmark.',
      'An unavailable benchmark is not a 0kg harvest. Record actual harvests on the monthly record sheet.',
    ];
  if (dash.unknownYieldCrops.length) {
    totalExplanation.push(`${dash.unknownYieldCrops.join(', ')} ${dash.unknownYieldCrops.length === 1 ? 'is' : 'are'} excluded from every kilogram total, not counted as 0kg.`);
  }

  const h = panel(s, {
    title: 'How the totals are calculated',
    accent: INK.gold,
    bg: INK.panelCream,
    body: totalExplanation,
  });
  s.y += h + 10;

  // HOW MUCH TO TRUST THIS — on page one, not in small print at the back.
  //
  // A farmer decides what to plant and what seed to buy from the front of the
  // document. A caution they meet after that decision is a record that we said
  // it, not a warning that reached them. The wording is IMPORTED, never written
  // here: the crop plan, the site report and the in-app view must not each grow
  // their own version, because the weakest one becomes the promise the product
  // is judged on. See lib/plan-assurance.ts for the full reasoning.
  const assuranceBody = [...ASSURANCE_PARAGRAPHS.map(pdfSafe), pdfSafe(SUCCESSION_TIMING_GUIDANCE)];
  // panel() never checks the page; a long title and a wrapped tile row once pushed this panel's
  // last line under the footer.
  s.need(panelHeight(s, assuranceBody, true, true));
  const assuranceH = panel(s, {
    title: ASSURANCE_TITLE.toUpperCase(),
    accent: INK.gold,
    bg: INK.panelCream,
    body: assuranceBody,
  });
  s.y += assuranceH + 12;

  // "Say a rule once." The year-report prose opens with the crop-cycle total
  // and biggest crop — both are already tiles or signals directly above. Only
  // paragraphs that say something those summaries cannot are repeated here.
  const extra = (input.yearReport ?? []).filter(
    (p) => !/^For crops with a verified kg\/m² benchmark/.test(p) && !/^Within the benchmark comparison/.test(p),
  );
  if (extra.length) {
    // Keep the heading with its first paragraph (and ideally the next): printed alone it sat at the
    // foot of page 1 with the text it introduces starting page 2 unheaded.
    s.font(8.8);
    const firstLines = extra.slice(0, 2)
      .reduce((n, para) => n + (s.doc.splitTextToSize(pdfSafe(para), s.contentWidth) as string[]).length, 0);
    s.need(10 * 1.4 + 6 + firstLines * 8.8 * 1.4 + 5);
    s.paragraph('Also worth knowing', { size: 10, bold: true, ink: INK.green, gap: 6 });
    for (const para of extra) s.paragraph(para, { size: 8.8, ink: INK.muted, gap: 5 });
  }

  drawPlanNotes(s, input);
}

/** panel() draws at s.y without checking whether the page has room; this is the
 * same arithmetic it uses, so a caller can ask for the space first. */
function panelHeight(s: Sheet, body: string[], hasTitle: boolean, accent: boolean): number {
  const innerW = s.contentWidth - 20 - (accent ? 4 : 0);
  s.font(8.5);
  const counts = body.map((b) => (s.doc.splitTextToSize(pdfSafe(b), innerW) as string[]).length);
  return 20 + (hasTitle ? 14 : 0) + panelBodyHeight(counts);
}

const PLAN_NOTE_PANEL_TITLES: Record<PlanNoteKind, string> = {
  warning: 'WHAT TO WATCH',
  choice: 'CHOICES THIS PLAN MADE',
  gap: 'GROUND WITH NO NEW SOWING',
  basis: 'HOW THIS PLAN WAS MADE',
};
/** warning -> choice -> gap -> basis, the same ranking the screen renders. */
const PLAN_NOTE_PANEL_ORDER: readonly PlanNoteKind[] = ['warning', 'choice', 'gap', 'basis'];

/**
 * The accepted suggestion's reasons, on paper.
 *
 * Same grouping and same order as the screen, and dated for the same reason:
 * the plan can have been hand-edited after the suggestion was made, so the
 * panel says WHEN it describes rather than implying it describes now.
 */
function drawPlanNotes(s: Sheet, input: CropPlanPdfInput): void {
  const notes = input.planNotes ?? [];
  if (!notes.length) return;

  const intro = input.planNotesAt
    ? `From the plan suggested in ${planNotesDateLabel(input.planNotesAt)}. Anything changed by hand since is not described here.`
    : 'From the suggested plan that was accepted. Anything changed by hand since is not described here.';
  s.need(40);
  s.paragraph('How this plan was put together', { size: 10, bold: true, ink: INK.green, gap: 4 });
  s.paragraph(intro, { size: 8, ink: INK.faint, gap: 6 });

  for (const kind of PLAN_NOTE_PANEL_ORDER) {
    const body = notes.filter((note) => note.kind === kind).map((note) => note.text);
    if (!body.length) continue;
    const accent = kind === 'warning' ? INK.gold : undefined;
    const h = panelHeight(s, body, true, accent !== undefined);
    s.need(h + 12);
    const drawn = panel(s, {
      title: PLAN_NOTE_PANEL_TITLES[kind],
      ...(accent ? { accent } : {}),
      bg: kind === 'warning' ? INK.panelCream : INK.panelGrey,
      body,
    });
    s.y += drawn + 10;
  }
}

// ── 2. Year in numbers ──────────────────────────────────────────────────────

function barChart(
  s: Sheet,
  opts: {
    title: string;
    labels: string[];
    values: number[];
    inks: readonly (readonly number[])[];
    axis: string;
    height?: number;
    format?: (v: number) => string;
  },
): void {
  const h = opts.height ?? 108;
  s.need(h + 52);
  s.font(11, true);
  s.ink(INK.text);
  s.doc.text(pdfSafe(opts.title), s.margin, s.y);
  // The unit sits on the title line, clear of the tick labels: drawn above the value axis it
  // collided with the chart title (2026-09-29 regional PDF audit).
  const titleW = s.doc.getTextWidth(pdfSafe(opts.title));
  s.font(7.5);
  s.ink(INK.faint);
  s.doc.text(pdfSafe(`(${opts.axis})`), s.margin + titleW + 5, s.y);
  // Headroom so the tallest bar's value label never touches the title.
  s.y += 18;

  const plotX = s.margin + 30;
  const plotW = s.contentWidth - 30;
  const top = s.y;
  const base = top + h;
  // Round gridline steps (1, 2, 5 × 10ⁿ): quarters of the busiest month gave ticks like 5, 9, 14.
  const step = niceStep(Math.max(1, ...opts.values) / 4);
  const gridlines = Math.max(1, Math.ceil(Math.max(1, ...opts.values) / step));
  const max = step * gridlines;

  // Faint gridlines and a value axis, so a bar can be read, not guessed.
  s.stroke(INK.hair);
  s.doc.setLineWidth(0.5);
  for (let i = 0; i <= gridlines; i++) {
    const gy = base - (h * i) / gridlines;
    s.doc.line(plotX, gy, plotX + plotW, gy);
    s.font(6.5);
    s.ink(INK.faint);
    s.doc.text(pdfSafe(String(Number((step * i).toFixed(2)))), plotX - 5, gy + 2, { align: 'right' });
  }

  const slot = plotW / opts.values.length;
  const barW = Math.min(slot * 0.62, 26);
  opts.values.forEach((v, i) => {
    const bh = (v / max) * h;
    const x = plotX + i * slot + (slot - barW) / 2;
    s.fill(opts.inks[i] ?? INK.green);
    if (bh > 0) s.doc.roundedRect(x, base - bh, barW, bh, 2, 2, 'F');
    s.font(6.5, true);
    s.ink(INK.muted);
    if (v > 0) s.doc.text(pdfSafe((opts.format ?? ((n) => n.toFixed(0)))(v)), x + barW / 2, base - bh - 4, { align: 'center' });
    s.font(7);
    s.ink(INK.muted);
    s.doc.text(pdfSafe(opts.labels[i]), x + barW / 2, base + 11, { align: 'center' });
  });

  s.y = base + 26;
}

/** The smallest of 1, 2 or 5 × 10ⁿ that is at least `raw`. */
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= raw)!;
}

function drawYearInNumbers(
  s: Sheet, input: CropPlanPdfInput,
  nowMonth: number, workload: MonthCount[],
): void {
  masthead(s, 'Manager view');
  pageTitle(s, 'Manager view', 'The year in numbers',
    'Use this page to compare benchmark timing with labour, kitchen demand, storage and mentoring visits before the work reaches the field.');

  const coverage = buildPlanDashboard(input.plantings, input.beds, input.tasks, {
    lossPercent: input.meta.lossPercent,
    lossAllowanceConfirmed: input.meta.lossAllowanceConfirmed,
    nowMonth,
  });
  const yieldNote = coverage.areaConflictBedLabels.length
    ? `No kilogram figure is shown because ${coverage.areaConflictBedLabels.join(', ')} ${coverage.areaConflictBedLabels.length === 1 ? 'has' : 'have'} overlapping or invalid planting shares. Resolve the layout before using a benchmark.`
    : coverage.hasKnownYield
    ? `The ${coverage.grossKg!.toFixed(1)} kg figure is a sum of crop-cycle benchmarks. It is not divided into months because the source does not provide a within-window picking curve.`
    : 'No kilogram comparison is available because none of this plan\'s food crops has a verified kg/m² benchmark. An unavailable benchmark is not a 0kg harvest.';
  // The standfirst above tells the reader to use this page to compare storage,
  // and until now the page said nothing whatsoever about storage: the sourced
  // shelf lives existed in the catalog and reached the printed plan nowhere. A
  // plan with no storage crop gets no line at all rather than a "0 of 12", which
  // would read as a finding about the year instead of the absence of the data.
  const storedNote = coverage.storedFoodMonths > 0
    ? `${coverage.storedFoodMonths} of 12 months also have food from store, from ${coverage.storedFoodCrops.length} crop${coverage.storedFoodCrops.length === 1 ? '' : 's'} with a sourced shelf life (${coverage.storedFoodCrops.join(', ')}). Each shelf life assumes particular storage conditions for that crop and does not hold without them.`
    : null;
  const yieldH = panel(s, {
    title: 'CROP-CYCLE BENCHMARK ONLY',
    accent: INK.gold,
    bg: INK.panelCream,
    body: [
      yieldNote,
      `${coverage.freshPickingMonths} of 12 months have at least one verified fresh-picking window; that is timing, not monthly kilograms.`,
      ...(storedNote ? [storedNote] : []),
    ],
  });
  s.y += yieldH + 18;

  const busiest = Math.max(...workload.map((v) => v.count));
  barChart(s, {
    title: 'Workload by month',
    labels: workload.map((v) => monthShort(v.month)),
    values: workload.map((v) => v.count),
    inks: workload.map((v) => (v.count >= busiest * 0.9 ? INK.terracotta : INK.teal)),
    axis: 'jobs planned',
  });

  // Biggest crops — horizontal, because crop names do not fit under a column.
  const top = buildTopCrops(input.plantings, input.beds, 7);
  if (top.length) {
    s.need(top.length * 16 + 40);
    s.font(11, true);
    s.ink(INK.text);
    s.doc.text(pdfSafe('Largest crops by known benchmark volume'), s.margin, s.y);
    s.y += 14;
    const labelW = 96;
    const trackX = s.margin + labelW;
    const trackW = s.contentWidth - labelW - 46;
    const maxKg = Math.max(1, ...top.map((c) => c.kg));
    for (const crop of top) {
      s.font(8);
      s.ink(INK.text);
      s.doc.text(pdfSafe(crop.name), s.margin + labelW - 6, s.y + 7, { align: 'right' });
      const bw = (crop.kg / maxKg) * trackW;
      s.fill(GROUP_INK[crop.group]);
      s.doc.roundedRect(trackX, s.y, Math.max(1, bw), 9, 2, 2, 'F');
      s.font(7.5, true);
      s.ink(INK.muted);
      s.doc.text(pdfSafe(`${crop.kg.toFixed(1)} kg`), trackX + bw + 5, s.y + 7);
      s.y += 15;
    }
    s.y += 6;
  }
  panel(s, {
    bg: INK.panelGrey,
    body: [
      'Chart note: the workload chart counts planned jobs, not hours - a plot of maize and a bed of lettuce each count as one. '
        + 'Crop-cycle benchmark weights are shown by crop only; no monthly kg or Rand is inferred.',
      ...(coverage.unknownYieldCrops.length
        ? [`Excluded from the kg total and crop-volume bars because no verified kg/m² benchmark is available: ${coverage.unknownYieldCrops.join(', ')}.`]
        : []),
    ],
  });
}

// ── 3. Land occupancy calendar ──────────────────────────────────────────────

function drawCalendar(s: Sheet, input: CropPlanPdfInput, nowMonth: number, rows: CalendarRow[]): void {
  masthead(s, 'Land occupancy');
  // No standfirst on this page: the whole value of the calendar is that all
  // thirteen growing areas land on ONE sheet, and a two-line introduction is
  // enough to push the last two plots onto a second page where they say nothing.
  const start = input.now ?? new Date();
  const end = new Date(start.getFullYear(), start.getMonth() + 11, 1);
  pageTitle(s, 'Land occupancy', `Bed calendar: ${monthShort(nowMonth)} ${start.getFullYear()} - ${monthShort(end.getMonth() + 1)} ${end.getFullYear()}`);

  const months = rollingMonths(nowMonth);
  const labelW = 96;
  const colW = (s.contentWidth - labelW) / 12;
  const headH = 18;

  const drawHead = () => {
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, headH, 'F');
    s.font(7.5, true);
    s.ink(INK.white);
    s.doc.text(pdfSafe('BED / PLOT'), s.margin + 8, s.y + 12);
    months.forEach((m, i) => {
      s.doc.text(pdfSafe(monthShort(m)), s.margin + labelW + i * colW + colW / 2, s.y + 12, { align: 'center' });
    });
    s.y += headH;
  };
  drawHead();

  for (const row of rows) {
    const depth = Math.max(1, ...row.cells.map((c) => c.length));
    const rowH = Math.max(18, 5 + depth * 6.5);
    if (s.need(rowH + 30)) { masthead(s, 'Land occupancy'); drawHead(); }

    s.fill(row.kind === 'plot' ? INK.panelCream : INK.white);
    s.doc.rect(s.margin, s.y, s.contentWidth, rowH, 'F');
    s.stroke(INK.hair);
    s.doc.setLineWidth(0.4);
    s.doc.line(s.margin, s.y + rowH, s.margin + s.contentWidth, s.y + rowH);

    // row.label is the farmer's own name for a mapped bed or staple-garden
    // zone ("Bed 1 - Nursery corner", "Plot A - Maize block"), not the
    // short "Bed N" fallback — routinely too long for this 96pt column to
    // hold next to the right-aligned area figure. Reserve the area figure's
    // own width first and truncate the label into whatever is left, rather
    // than let the two run together into unreadable overlapping text.
    s.font(6.5);
    s.ink(INK.faint);
    const areaText = pdfSafe(`${row.areaM2.toFixed(1)} m²`);
    const areaW = s.doc.getTextWidth(areaText);
    s.font(8, true);
    s.ink(INK.text);
    const labelMaxW = labelW - 16 - areaW - 4;
    s.doc.text(truncateToWidth(s.doc, pdfSafe(row.label), Math.max(20, labelMaxW)), s.margin + 8, s.y + 13);
    s.font(6.5);
    s.ink(INK.faint);
    s.doc.text(areaText, s.margin + labelW - 8, s.y + 13, { align: 'right' });

    row.cells.forEach((cell, i) => {
      const cx = s.margin + labelW + i * colW;
      s.stroke(INK.hair);
      s.doc.line(cx, s.y, cx, s.y + rowH);
      cell.forEach((entry, j) => {
        s.font(5.8, entry.harvesting);
        s.ink(GROUP_INK[entry.group]);
        s.doc.text(
          pdfSafe(`${entry.abbr}${entry.harvesting ? '*' : ''} ${entry.share}`),
          cx + colW / 2, s.y + 10 + j * 6.5, { align: 'center' },
        );
      });
    });
    s.y += rowH;
  }

  s.y += 12;
  // Colour key with each crop code filed under its own colour. The codes used to run in five
  // alphabetical columns directly under the five colour bars, so "To = Tomatoes" sat under
  // Staples and "Ca = Cabbage" under Leafy crops by accident of the alphabet, not by group.
  const abbr = cropAbbreviations(input.plantings);
  const keyW = s.contentWidth / GROUP_LEGEND.length;
  const columns = GROUP_LEGEND.map((g) => [...abbr.entries()]
    .filter(([key]) => {
      const crop = cropByKey(key);
      return crop !== undefined && g.groups.includes(foodGroupOf(crop));
    })
    .map(([key, code]) => `${code} = ${cropByKey(key)?.name ?? key}`)
    .sort());
  s.need(38 + Math.max(1, ...columns.map((c) => c.length)) * 9);
  s.font(8, true);
  s.ink(INK.green);
  s.doc.text(pdfSafe('Crop codes'), s.margin, s.y);
  s.font(7);
  s.ink(INK.faint);
  s.doc.text(
    pdfSafe(`Read left to right from ${monthShort(nowMonth)}. A star marks the months a crop is being picked; nursery dates and exact spacing are in the full plan.`),
    s.margin + 58, s.y,
  );
  s.y += 10;
  // Only the colours this plan uses: a Staples bar with nothing under it (maize did not fit at
  // the Western Cape site) reads as a missing list. Column width stays one legend slot, packed left.
  const used = GROUP_LEGEND.map((g, i) => ({ g, lines: columns[i] })).filter((c) => c.lines.length);
  (used.length ? used : GROUP_LEGEND.map((g, i) => ({ g, lines: columns[i] }))).forEach(({ g, lines }, i) => {
    const x = s.margin + i * keyW;
    s.fill(g.ink);
    s.doc.rect(x, s.y, keyW - 6, 6, 'F');
    s.font(7.5, true);
    s.ink(INK.muted);
    s.doc.text(pdfSafe(g.label), x, s.y + 17);
    s.font(6.8);
    lines.forEach((line, j) => {
      const fitted = truncateToWidth(s.doc, pdfSafe(line), keyW - 8);
      s.doc.text(fitted, x, s.y + 28 + j * 9);
    });
  });
  s.y += 28 + Math.max(1, ...columns.map((c) => c.length)) * 9;
}

// ── Food availability (the app's chart, on paper) ───────────────────────────

/**
 * Rory, 2026-09-29: "i want in the crop plan printed a version of the calendar we have in the app
 * with the veg and other icons that show availability during the month". The bed calendar before
 * this page says where each crop GROWS; this one says what there is to EAT, month by month, in the
 * same boxes the app draws: fresh veg, stored veg, the food forest and animal products, each with
 * its picture, and a last row for how much of the growing space each month uses.
 *
 * Nothing here is counted in kilograms or rand, for the reason the app chart gives none: the
 * sources give a picking window, not a monthly curve.
 */
type AvailabilityCell = AvailabilityEntry & { code: string };

interface AvailabilityBand {
  key: 'fresh' | 'stored' | 'forest' | 'animals';
  title: string;
  sub: string;
  /** The app tray's colour; the print uses it as a pale fill and a mid border. */
  rgb: readonly number[];
  cells: AvailabilityCell[][];
}

export interface ResolvedAvailability {
  yearMode: 'established' | 'fromToday';
  bands: AvailabilityBand[];
  utilization: number[];
}

const mixWithWhite = (rgb: readonly number[], share: number): number[] =>
  rgb.map((c) => Math.round(255 - (255 - c) * share));

/** Short code for an item without art: the crop code the bed calendar uses, else two letters. */
function fallbackCode(label: string): string {
  const letters = pdfSafe(label).replace(/\([^)]*\)/g, ' ').replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/);
  const code = letters.length > 1 ? `${letters[0][0]}${letters[1][0]}` : (letters[0] ?? '?').slice(0, 2);
  return code ? code.charAt(0).toUpperCase() + code.slice(1).toLowerCase() : '?';
}

/**
 * Read the dated first year by default. An explicitly requested repeating template
 * folds annual crops separately and is labelled as a template rather than a dated forecast.
 */
export function resolveAvailability(input: CropPlanPdfInput, nowMonth: number): ResolvedAvailability {
  const months = rollingMonths(nowMonth);
  const given = input.availability;
  const recurring = recurringPlanPlantings(input.plantings);
  const established = given?.yearMode === 'established';
  const veg = given?.veg ?? (() => {
    if (!established) return buildFoodAvailability(input.plantings, input.beds, nowMonth, 12);
    const annual = buildFoodAvailability(recurring, input.beds);
    return months.map((m) => annual[m] ?? []);
  })();
  const utilization = given?.utilization ?? (() => {
    if (!established) return buildFieldUtilizationByMonth(input.plantings, input.beds, nowMonth, 12);
    const annual = buildFieldUtilizationByMonth(recurring, input.beds);
    return months.map((m) => annual[m] ?? 0);
  })();
  const codes = cropAbbreviations([...input.plantings, ...veg.flat().map((v) => ({ id: v.cropKey, bedId: '', cropKey: v.cropKey, sowMonth: 1 }))]);
  const vegCells = (status: 'fresh' | 'stored') => months.map((_, i) => (veg[i] ?? [])
    .filter((v) => v.status === status)
    .map((v) => ({ iconKey: `crop:${v.cropKey}`, label: v.name, code: codes.get(v.cropKey) ?? fallbackCode(v.name) })));
  const entryCells = (rows?: AvailabilityEntry[][]) => months.map((_, i) => (rows?.[i] ?? [])
    .map((e) => ({ ...e, code: fallbackCode(e.label) })));
  const bands: AvailabilityBand[] = [
    { key: 'fresh', title: 'Fresh veg', sub: 'picked from the beds', rgb: [127, 174, 110], cells: vegCells('fresh') },
    { key: 'stored', title: 'Stored veg', sub: 'kept under named conditions', rgb: [212, 160, 23], cells: vegCells('stored') },
    { key: 'forest', title: 'Food forest', sub: 'confirmed local picking months', rgb: [46, 107, 58], cells: entryCells(given?.forest) },
    { key: 'animals', title: 'Animal products', sub: 'eggs, milk, meat, honey', rgb: [192, 122, 30], cells: entryCells(given?.animals) },
  ];
  return {
    yearMode: given?.yearMode ?? 'fromToday',
    // A band with nothing in any month is left off, as the app hides an empty tray row; the
    // fresh row always prints, so an empty plan still shows a grid that says so.
    bands: bands.filter((b) => b.key === 'fresh' || b.cells.some((c) => c.length > 0)),
    utilization,
  };
}

/** Every icon key the availability page will draw, so a caller can load exactly those. */
export function availabilityIconKeys(input: CropPlanPdfInput): string[] {
  const nowMonth = (input.now ?? new Date()).getMonth() + 1;
  const { bands } = resolveAvailability(input, nowMonth);
  return [...new Set([
    ...bands.flatMap((b) => b.cells.flat().map((e) => e.iconKey)),
    ...(input.availability?.undated ?? []).map((e) => e.iconKey),
  ])];
}

function drawIconOrCode(s: Sheet, entry: { iconKey: string; code: string }, x: number, y: number, size: number, icons?: Record<string, string>): void {
  const data = icons?.[entry.iconKey];
  if (data) {
    try {
      // The alias makes jsPDF embed each picture once, however many months it appears in.
      s.doc.addImage(data, 'PNG', x, y, size, size, entry.iconKey, 'FAST');
      return;
    } catch {
      // A picture jsPDF cannot read prints as its code, like one that never loaded.
    }
  }
  s.fill(INK.white);
  s.stroke(INK.rule);
  s.doc.setLineWidth(0.4);
  s.doc.roundedRect(x, y, size, size, 1.5, 1.5, 'FD');
  s.font(Math.max(4.5, size * 0.42), true);
  s.ink(INK.text);
  s.doc.text(pdfSafe(entry.code), x + size / 2, y + size / 2 + size * 0.15, { align: 'center' });
}

function drawAvailability(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const resolved = resolveAvailability(input, nowMonth);
  const axis = monthAxisSlots(nowMonth, now.getFullYear(), 12);
  const last = axis[11];
  const dated = resolved.yearMode === 'fromToday';
  const labelW = 150;
  const colW = (s.contentWidth - labelW) / 12;
  const icon = Math.min(23, colW - 6);
  const heading = () => {
    masthead(s, 'Picture calendar');
    pageTitle(s, input.meta.planTitle,
      dated ? `${monthShort(nowMonth)} ${now.getFullYear()} - ${monthShort(last.month)} ${last.year}` : 'Repeat-year template',
      dated ? 'What to pick or use each month. Pictures show a picking window, not how much food you will get.'
        : 'This repeats the annual planting cycle. It is not a forecast for this first year.');
    s.paragraph(`${input.meta.locationLine || input.meta.siteLine} - ${input.meta.climateLine || 'Climate not set'}`, { size: 10, ink: INK.green, gap: 8 });
  };
  const monthHead = () => {
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, 32, 'F');
    s.font(10, true); s.ink(INK.white);
    s.doc.text('CROP / FOOD SOURCE', s.margin + 8, s.y + 20);
    axis.forEach((slot, i) => {
      const x = s.margin + labelW + (i + 0.5) * colW;
      s.font(8, true);
      s.doc.text(monthShort(slot.month), x, s.y + 13, { align: 'center' });
      if (dated) {
        s.font(6.5);
        s.doc.text(slot.isNow ? 'NOW' : String(slot.year), x, s.y + 24, { align: 'center' });
      }
    });
    s.y += 32;
  };
  const bandHead = (band: AvailabilityBand, continued = false) => {
    s.fill(mixWithWhite(band.rgb, 0.16));
    s.doc.rect(s.margin, s.y, s.contentWidth, 24, 'F');
    s.font(10.5, true); s.ink(INK.text);
    s.doc.text(pdfSafe(`${band.title}${continued ? ' (continued)' : ''}`), s.margin + 8, s.y + 16);
    s.y += 24;
  };
  heading(); monthHead();
  for (const band of resolved.bands) {
    const entries = new Map<string, AvailabilityCell>();
    for (const cell of band.cells) for (const e of cell) entries.set(e.iconKey, e);
    const rows = [...entries.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (!rows.length) {
      if (!s.fits(58)) { s.page('portrait'); heading(); monthHead(); }
      bandHead(band);
      s.paragraph('No picking months marked yet.', { size: 10, ink: INK.muted, gap: 10 });
      continue;
    }
    s.font(10, true);
    const firstLines = s.doc.splitTextToSize(pdfSafe(rows[0].label), labelW - 39) as string[];
    if (!s.fits(24 + Math.max(29, firstLines.length * 12 + 10))) { s.page('portrait'); heading(); monthHead(); }
    bandHead(band);
    for (const e of rows) {
      s.font(10, true);
      const label = s.doc.splitTextToSize(pdfSafe(e.label), labelW - 39) as string[];
      const rowH = Math.max(29, label.length * 12 + 10);
      if (!s.fits(rowH)) { s.page('portrait'); heading(); monthHead(); bandHead(band, true); }
      drawIconOrCode(s, e, s.margin + 5, s.y + (rowH - 24) / 2, 24, input.icons);
      s.font(10, true); s.ink(INK.text);
      s.doc.text(label, s.margin + 34, s.y + 17, { lineHeightFactor: 1.2 });
      axis.forEach((_, i) => {
        const x = s.margin + labelW + i * colW;
        if (band.cells[i].some((entry) => entry.iconKey === e.iconKey)) {
          s.fill(mixWithWhite(band.rgb, 0.2));
          s.doc.roundedRect(x + 2, s.y + 3, colW - 4, rowH - 6, 3, 3, 'F');
          drawIconOrCode(s, e, x + (colW - icon) / 2, s.y + (rowH - icon) / 2, icon, input.icons);
        } else {
          s.font(9); s.ink(INK.faint);
          s.doc.text('-', x + colW / 2, s.y + rowH / 2 + 3, { align: 'center' });
        }
        s.stroke(INK.hair); s.doc.setLineWidth(0.4);
        s.doc.line(x, s.y, x, s.y + rowH);
      });
      s.stroke(INK.hair);
      s.doc.line(s.margin, s.y + rowH, s.width - s.margin, s.y + rowH);
      s.y += rowH;
    }
    s.y += 8;
  }
  if (!s.fits(65)) { s.page('portrait'); heading(); monthHead(); }
  s.fill(INK.panelGrey);
  s.doc.rect(s.margin, s.y, s.contentWidth, 44, 'F');
  s.font(10, true); s.ink(INK.text);
  s.doc.text('Growing space used', s.margin + 8, s.y + 20);
  resolved.utilization.slice(0, 12).forEach((v, i) => {
    const x = s.margin + labelW + i * colW;
    const value = Number.isFinite(v) ? Math.max(0, v) : 0;
    s.font(8, true); s.ink(value > 1.001 ? [179, 58, 58] : INK.text);
    s.doc.text(`${Math.round(value * 100)}%`, x + colW / 2, s.y + 17, { align: 'center' });
    s.fill(INK.hair); s.doc.rect(x + 5, s.y + 25, colW - 10, 6, 'F');
    if (value > 0) { s.fill(value > 1.001 ? [179, 58, 58] : INK.green); s.doc.rect(x + 5, s.y + 25, (colW - 10) * Math.min(1, value), 6, 'F'); }
  });
  s.y += 56;
  s.paragraph('A dash means no picking window is marked. Red space figures mean the plan needs more growing space than is mapped.', { size: 10, ink: INK.muted, gap: 8 });

  const undated = input.availability?.undated ?? [];
  if (undated.length) {
    s.page('portrait'); masthead(s, 'On your map');
    pageTitle(s, input.meta.planTitle, 'Food sources to check',
      'These are on your design. Their picking or production months still need checking on site.');
    for (const e of undated) {
      s.font(10.5);
      const lines = s.doc.splitTextToSize(pdfSafe(e.detail), s.contentWidth - 60) as string[];
      const h = Math.max(64, 32 + lines.length * 14);
      if (s.need(h + 10)) { masthead(s, 'On your map'); pageTitle(s, input.meta.planTitle, 'Food sources to check (continued)'); }
      s.fill(INK.panelGreen); s.doc.roundedRect(s.margin, s.y, s.contentWidth, h, 5, 5, 'F');
      drawIconOrCode(s, { ...e, code: fallbackCode(e.label) }, s.margin + 10, s.y + 12, 32, input.icons);
      s.font(12, true); s.ink(INK.green); s.doc.text(pdfSafe(e.label), s.margin + 52, s.y + 20);
      s.font(10.5); s.ink(INK.text); s.doc.text(lines, s.margin + 52, s.y + 38, { lineHeightFactor: 1.33 });
      s.y += h + 10;
    }
  }
  const pending = settleOnceRows(input.plantings, now.getFullYear(), nowMonth)
    .filter((p) => p.awaitingSowingConfirmation);
  if (pending.length) {
    const body = [
      'These earlier sowings are not confirmed. They are left out of the food calendar and jobs. In the app, confirm what was planted or mark it as skipped.',
      ...pending.map((p) => `${cropByKey(p.cropKey)?.name ?? p.cropKey} - ${input.beds.find((b) => b.id === p.bedId)?.label ?? p.bedId} - scheduled ${p.once}`),
    ];
    if (s.need(panelHeight(s, body, true, true) + 12)) masthead(s, 'Sowings to confirm');
    s.y += panel(s, { title: 'Did these sowings happen?', body, bg: INK.panelCream, accent: INK.gold }) + 12;
  }
  const storage = [...new Set(input.plantings.map((p) => p.cropKey))].map(cropByKey)
    .filter((c) => c && c.storageMonths && c.storageConditions);
  if (storage.length) {
    s.page('portrait'); masthead(s, 'Keeping food');
    pageTitle(s, input.meta.planTitle, 'Before using stored food',
      'The storage row applies only when these sourced conditions are met. Check the food before using it.');
    for (const crop of storage) {
      if (!crop) continue;
      s.font(10.5);
      const lines = s.doc.splitTextToSize(pdfSafe(crop.storageConditions ?? ''), s.contentWidth - 26) as string[];
      const h = 48 + lines.length * 14;
      if (s.need(h + 10)) { masthead(s, 'Keeping food'); pageTitle(s, input.meta.planTitle, 'Stored food (continued)'); }
      s.fill(INK.panelCream); s.doc.roundedRect(s.margin, s.y, s.contentWidth, h, 5, 5, 'F');
      s.font(12, true); s.ink(INK.brown);
      s.doc.text(pdfSafe(`${crop.name} - sourced storage window: ${crop.storageMonths} months`), s.margin + 12, s.y + 20);
      s.font(10.5); s.ink(INK.text);
      s.doc.text(lines, s.margin + 12, s.y + 39, { lineHeightFactor: 1.33 });
      if (crop.storageSourceUrl) {
        s.font(8.5); s.ink(INK.green);
        s.doc.textWithLink('Source guide', s.margin + 12, s.y + h - 9, { url: crop.storageSourceUrl });
      }
      s.y += h + 10;
    }
  }
  // The reference copy carries the full assurance panel on its dashboard. The
  // field copy keeps the shared caution and the accepted plan's own warnings.
  s.y += 4;
  s.paragraph(ASSURANCE_ONE_LINE, { size: 9.5, ink: INK.muted, gap: 6 });
  s.paragraph(SUCCESSION_TIMING_GUIDANCE, { size: 9.5, ink: INK.muted, gap: 8 });
  if (!(input.sections ?? ALL_SECTIONS).includes('dashboard')) drawPlanNotes(s, input);
}

// ── Compact task summary (quick print) ──────────────────────────────────────

/**
 * One page, every task, grouped by month, one line each — the exact wording
 * the screen's "📋 Tasks" panel already shows (taskPhrase/taskSentence,
 * lib/crop-export-schedule.ts), just one task per row instead of joined with
 * " · " so a printed sheet can be scanned top to bottom rather than read as a
 * paragraph. Built only for the quick-print export (calendar + this page);
 * see the ALL_SECTIONS comment for why the full document never includes it.
 *
 * Sized to fit ~40-50 tasks across 12 months on one A4 portrait page. Still
 * goes through s.need() per row: a plan with an outlier number of tasks or
 * unusually long crop/bed names must overflow onto a second page rather than
 * print off the bottom of the first.
 */
function drawTaskSummary(s: Sheet, input: CropPlanPdfInput, nowMonth: number): void {
  masthead(s, 'Task summary');
  // No standfirst, for the same reason drawCalendar has none: the whole
  // point of this page is fitting the year on one sheet, and an
  // introduction is exactly the two or three lines that would cost it.
  pageTitle(s, 'Task summary', 'Tasks by month');

  // Same 12-month window as the calendar this page sits behind (rollingMonths
  // / drawCalendar): buildTaskMonths does not cap monthsAway, and a slow
  // crop's next occurrence can be well over a year out. This page must never
  // show a month the calendar on page 1 didn't draw.
  const taskMonths = buildTaskMonths(input.tasks, nowMonth).filter((m) => m.monthsAway < 12);
  // Standing trees in their sourced SA season, per month of the same window. Not bed work, so they
  // follow each month's tasks rather than joining them.
  const picking = treePickingByMonth(input.treeGroups ?? [], Array.from({ length: 12 }, (_, i) => ((nowMonth - 1 + i) % 12) + 1), input.treeSeasons);
  const months = Array.from({ length: 12 }, (_, monthsAway) => ({
    month: ((nowMonth - 1 + monthsAway) % 12) + 1,
    lines: [
      ...(taskMonths.find((m) => m.monthsAway === monthsAway)?.tasks.map(taskPhrase) ?? []),
      ...picking[monthsAway].map(treePickingPhrase),
    ],
  })).filter((m) => m.lines.length > 0);

  if (!months.length) {
    s.paragraph('No plantings yet, so there is nothing to print here.', { size: 9.5, ink: INK.muted });
    return;
  }
  if (picking.some((slot) => slot.length > 0)) {
    s.paragraph('"Pick" lines use locally confirmed months for established, productive trees.', { size: 7.5, ink: INK.muted });
  }

  const monthColW = 34;
  const textColW = s.contentWidth - monthColW;

  const continued = () => {
    masthead(s, 'Task summary');
    s.font(11, true);
    s.ink(INK.text);
    s.doc.text(pdfSafe('Tasks by month (continued)'), s.margin, s.y);
    s.y += 16;
  };

  for (const group of months) {
    let first = true;
    for (const phrase of group.lines) {
      s.font(7.5);
      const lines = s.doc.splitTextToSize(pdfSafe(phrase), textColW) as string[];
      const rowH = Math.max(11, lines.length * 10.5);
      if (s.need(rowH + (first ? 4 : 0))) { continued(); first = true; }

      if (first) {
        s.y += 4;
        s.stroke(INK.hair);
        s.doc.setLineWidth(0.4);
        s.doc.line(s.margin, s.y - 2, s.margin + s.contentWidth, s.y - 2);
        s.font(7.5, true);
        s.ink(INK.green);
        s.doc.text(pdfSafe(monthShort(group.month)), s.margin, s.y + 7);
      }

      s.font(7.5);
      s.ink(INK.text);
      s.doc.text(lines, s.margin + monthColW, s.y + 7);
      s.y += rowH;
      first = false;
    }
  }
}

// ── Table primitive ─────────────────────────────────────────────────────────

/**
 * A table that never loses its head. The benchmark's sixth rule — "repeat the
 * section title, month and table header whenever content continues onto another
 * page" — is the whole reason this is a helper and not inline drawing: the old
 * export's bed list ran across a page break and the second page began with an
 * unlabelled column of numbers.
 */
function table(
  s: Sheet,
  columns: Column[],
  rows: Record<string, string>[],
  opts: { band?: string; title?: string; groupKey?: string; size?: number } = {},
): void {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  const scale = s.contentWidth / totalW;
  const widths = columns.map((c) => c.width * scale);
  const headH = 22;
  const size = opts.size ?? 8;
  const leading = size * 1.32;

  const drawHead = () => {
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, headH, 'F');
    s.font(Math.max(7.5, size - 0.5), true);
    s.ink(INK.white);
    let x = s.margin;
    columns.forEach((c, i) => {
      const tx = c.align === 'right' ? x + widths[i] - 8 : x + 8;
      s.doc.text(pdfSafe(c.header), tx, s.y + 13, { align: c.align === 'right' ? 'right' : 'left' });
      x += widths[i];
    });
    s.y += headH;
  };

  drawHead();
  let zebra = false;
  let lastGroup: string | undefined;

  for (const row of rows) {
    s.font(size);
    const heights = columns.map((c, i) => (s.doc.splitTextToSize(pdfSafe(row[c.key] ?? ''), widths[i] - 16) as string[]).length);
    const rowH = Math.max(18, Math.max(...heights) * leading + 12);

    if (s.need(rowH + 24)) {
      if (opts.band) masthead(s, opts.band);
      if (opts.title) {
        s.font(11, true);
        s.ink(INK.text);
        s.doc.text(pdfSafe(`${opts.title} (continued)`), s.margin, s.y);
        s.y += 14;
      }
      drawHead();
      lastGroup = undefined;
    }

    const groupStart = opts.groupKey !== undefined && row[opts.groupKey] !== lastGroup;
    if (opts.groupKey !== undefined) lastGroup = row[opts.groupKey];

    s.fill(groupStart ? INK.panelGreen : zebra ? INK.panelGrey : INK.white);
    s.doc.rect(s.margin, s.y, s.contentWidth, rowH, 'F');
    zebra = !zebra;

    let x = s.margin;
    columns.forEach((c, i) => {
      s.font(size, groupStart && i === 0);
      s.ink(i === 0 ? INK.text : INK.muted);
      // The grouping column prints its label once per group — and again at the
      // top of every continuation page, because `lastGroup` is cleared on a
      // break. Without that, page two of the bed plan opened with a column of
      // crops belonging to a bed it never named.
      const raw = row[c.key] ?? '';
      const shown = opts.groupKey !== undefined && i === 0 && !groupStart ? '' : raw;
      const lines = s.doc.splitTextToSize(pdfSafe(shown), widths[i] - 16) as string[];
      const tx = c.align === 'right' ? x + widths[i] - 8 : x + 8;
      s.doc.text(lines, tx, s.y + 14, { align: c.align === 'right' ? 'right' : 'left', lineHeightFactor: 1.32 });
      x += widths[i];
    });
    s.stroke(INK.hair);
    s.doc.setLineWidth(0.4);
    s.doc.line(s.margin, s.y + rowH, s.margin + s.contentWidth, s.y + rowH);
    s.y += rowH;
  }
  s.y += 10;
}

// ── 4. Full plan and buying schedule ────────────────────────────────────────

function drawFullPlan(s: Sheet, input: CropPlanPdfInput): void {
  masthead(s, 'Full plan');
  pageTitle(s, 'Full plan', 'Bed-by-bed plan',
    'Each line is one planting. Yield is a conservative benchmark comparison where a verified kg/m² entry exists; "Not verified" is never treated as 0kg.');

  const mildFrostSite = input.meta.rainPattern === 'mild-frost';
  const rows = buildPlanTableRows(input.plantings, input.beds, mildFrostSite).map((r) => ({
    area: r.area,
    // A one-time starter has to say so on its own line. Without it the sheet a
    // farmer carries into the field reads a first-season bridge sowing as a
    // standing annual crop. The cell wraps rather than truncating, so the row
    // simply grows to fit.
    crop: r.once ? `${r.crop} (first season only)` : r.crop,
    share: r.share,
    establish: r.establish,
    field: r.intoField,
    // A caveat is a WARNING, not a sourced frost date — appended onto the harvest
    // cell (which auto-wraps) rather than given its own column.
    harvest: r.frostCaveat ? `${r.harvest} — ${r.frostCaveat}` : r.harvest,
    yield: r.awaitingSowingConfirmation ? 'Confirm sowing' : benchmarkYieldLabel(r.yieldKg),
    group: r.area,
  }));

  table(s, [
    { key: 'area', header: 'Area', width: 70 },
    { key: 'crop', header: 'Crop', width: 130 },
    { key: 'share', header: 'Space', width: 46 },
    { key: 'establish', header: 'Establish', width: 90 },
    { key: 'field', header: 'Into field', width: 90 },
    { key: 'harvest', header: 'Harvest', width: 76 },
    { key: 'yield', header: 'Benchmark', width: 58, align: 'right' },
  ], rows, { band: 'Full plan', title: 'Bed-by-bed plan', groupKey: 'group' });
}

function drawBuying(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  masthead(s, 'Inputs');
  pageTitle(s, 'Inputs', 'Seed and seedling buying schedule',
    'Find the month, then the crop and bed. Check the seed quantity and sowing method before buying.');

  const h = panel(s, {
    title: 'The buying rule',
    accent: INK.gold,
    bg: INK.panelCream,
    body: [
      'Source direct-sown or tray seed before the named sowing month; the source does not provide a universal procurement lead time. Ready-grown seedlings are listed at the start of the field-readiness window; buy them only when the bed and seedlings are ready. Living corms, slips, cloves and seed potatoes are listed close to planting. For a tray crop, choose either packet seed for the nursery or ready-grown seedlings - not both.',
      'A published field seed rate gives a weight range for the mapped area. Confirm the sowing method with the supplier; no germination or loss allowance is added. For crops without a published seed rate, field spacing supports only an approximate FINAL stand. It does not prove a seed-buying quantity: '
      + 'use the packet\'s crop-specific sowing rate and germination guidance. Living-material ranges are approximate field positions from mapped area and published spacing, not guaranteed order quantities or loss allowances; supplier and crop-specific guidance may change what to purchase.',
    ],
  });
  s.y += h + 14;

  const schedule = buildBuyingSchedule(input.plantings, input.beds, nowMonth);
  const rows: Record<string, string>[] = [];
  for (const month of schedule) {
    for (const item of month.items) {
      rows.push({
        buy: monthYearLabel(month.month, now),
        crop: item.cropName,
        qty: item.quantityStatus === 'sourced-weight-range' && item.countRange
          ? weightRangeLabel(item.countRange)
          : item.quantityStatus === 'spacing-confirmation-required'
          ? 'Confirm spacing first'
          : item.quantityStatus === 'packet-rate-required'
            ? 'Packet rate needed'
            : item.quantityStatus === 'counted-piece-range' && item.countRange
              ? `~${positionRangeLabel(item.countRange)} ${item.unit} positions`
              : item.count === null
                ? 'Confirm quantity'
                : `~${numberLabel(item.count)} ${item.unit} positions`,
        method: item.quantityStatus === 'sourced-weight-range'
          ? 'Published field seed rate; confirm sowing method'
          : item.quantityStatus === 'spacing-confirmation-required'
          ? 'Local row layout needed'
          : !item.transplant && item.unit !== 'seeds'
          ? 'Living pieces; confirm loss allowance'
          : item.transplant ? `Ready seedlings; own seed before ${monthShort(item.sowMonth)} nursery` : `Direct sow; ~${positionRangeLabel(item.finalPlantPositionsRange)} final positions`,
        forWhat: compactPlaces(item.bedLabels),
        when: item.transplant
          ? `Source own seed before ${monthShort(item.sowMonth)}; nursery ${monthShort(item.sowMonth)}; check/transplant ${monthShort(item.bedMonth)}-${monthShort(item.bedMonthLatest)}`
          : `Sow ${monthShort(item.sowMonth)}`,
        group: String(month.month),
      });
    }
  }

  table(s, [
    { key: 'buy', header: 'Source/check', width: 74 },
    { key: 'crop', header: 'Crop', width: 122 },
    { key: 'qty', header: 'Quantity', width: 92 },
    { key: 'method', header: 'Method', width: 88 },
    { key: 'forWhat', header: 'For', width: 110 },
    { key: 'when', header: 'Planting timeline', width: 114 },
  ], rows, { band: 'Inputs', title: 'Seed and seedling buying schedule', groupKey: 'group', size: 9.5 });

  const rated = new Map(schedule.flatMap((m) => m.items).filter((i) => i.quantityStatus === 'sourced-weight-range').map((i) => [i.cropKey, i]));
  for (const item of rated.values()) {
    const crop = cropByKey(item.cropKey);
    if (!crop?.seedRateKgPerHaRange) continue;
    const body = [`Published field rate: ${positionRangeLabel(crop.seedRateKgPerHaRange)} kg/ha. The buying range uses the mapped area; no germination allowance is added.`, crop.fieldSpacingInstruction ?? crop.note];
    if (s.need(panelHeight(s, body, true, true) + 12)) masthead(s, 'Seed-rate checks');
    s.y += panel(s, { title: `${crop.name} - check the sowing method`, body, bg: INK.panelCream, accent: INK.gold }) + 12;
  }
}

// ── 5. Working documents ────────────────────────────────────────────────────

function drawFieldSheets(
  s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number,
  startPage: (o: 'portrait' | 'landscape') => void,
): void {
  for (const month of rollingMonths(nowMonth)) {
    const sheet = buildFieldSheet(month, input.tasks, now, input.plantings, input.beds);
    if (!sheet.sections.length) continue;

    startPage('portrait');
    masthead(s, 'Field sheet');
    pageTitle(s, '', `${sheet.monthLabel} field sheet`,
      `${input.meta.planTitle} - tick each job off as it is done.`);

    s.font(9.5, true); s.ink(INK.green);
    s.doc.text(pdfSafe(`${sheet.workRows} jobs - ${sheet.plantingFocus} sowing / planting - ${sheet.harvestFocus} harvest`), s.margin, s.y);
    s.y += 18;
    if (!(input.sections ?? ALL_SECTIONS).includes('availability')) {
      s.paragraph(SUCCESSION_TIMING_GUIDANCE, { size: 9, ink: INK.muted, gap: 8 });
    }

    // Column geometry: tick | place | work | date-and-note. The tick column has
    // to clear the word DONE in the header, not just the checkbox under it.
    const cTick = 30;
    const cPlace = 82;
    const cNote = 80;
    const cWork = s.contentWidth - cTick - cPlace - cNote;

    // Repeated at the top of every continuation page: a sheet of ticks with no
    // month on it is a sheet nobody can file.
    const continued = () => {
      masthead(s, 'Field sheet');
      s.font(11, true);
      s.ink(INK.text);
      s.doc.text(pdfSafe(`${sheet.monthLabel} field sheet (continued)`), s.margin, s.y);
      s.y += 16;
    };
    const headRow = () => {
      s.fill(INK.green);
      s.doc.rect(s.margin, s.y, s.contentWidth, 18, 'F');
      s.font(9, true);
      s.ink(INK.white);
      s.doc.text(pdfSafe('DONE'), s.margin + 4, s.y + 12);
      s.doc.text(pdfSafe('PLACE'), s.margin + cTick + 4, s.y + 12);
      s.doc.text(pdfSafe('WORK TO COMPLETE'), s.margin + cTick + cPlace + 4, s.y + 12);
      s.doc.text(pdfSafe('DATE / NOTE'), s.margin + cTick + cPlace + cWork + 4, s.y + 12);
      s.y += 18;
    };
    headRow();

    for (const section of sheet.sections) {
      const sectionHead = (repeat = false) => {
        s.fill(INK.panelGreen);
        s.doc.rect(s.margin, s.y, s.contentWidth, 24, 'F');
        s.font(10.5, true); s.ink(INK.green);
        s.doc.text(pdfSafe(`${section.title}${repeat ? ' (continued)' : ''}`), s.margin + 6, s.y + 16);
        s.y += 24;
      };
      const measureRow = (row: { place: string; work: string }) => {
        s.font(10.5);
        const work = s.doc.splitTextToSize(pdfSafe(row.work), cWork - 14) as string[];
        s.font(10.5, true);
        const place = s.doc.splitTextToSize(pdfSafe(row.place), cPlace - 10) as string[];
        return { work, place, height: Math.max(34, work.length * 14 + 14, place.length * 14 + 14) };
      };
      s.font(9.5);
      const noteLines = section.note ? s.doc.splitTextToSize(pdfSafe(section.note), s.contentWidth - cTick - 12) as string[] : [];
      const noteH = noteLines.length ? noteLines.length * 13 + 12 : 0;
      const firstH = section.rows[0] ? measureRow(section.rows[0]).height : 0;
      // A heading must travel with its guidance and first job; a row alone on a
      // continuation page also needs the work category to remain understandable.
      if (s.need(24 + noteH + firstH)) { continued(); headRow(); }
      sectionHead();
      if (noteLines.length) {
        s.font(9.5); s.ink(INK.muted);
        s.doc.text(noteLines, s.margin + cTick + 5, s.y + 13, { lineHeightFactor: 1.37 });
        s.y += noteH;
      }
      for (const row of section.rows) {
        const measured = measureRow(row);
        if (s.need(measured.height)) { continued(); headRow(); sectionHead(true); }
        s.stroke(INK.muted); s.doc.setLineWidth(0.8);
        s.doc.rect(s.margin + 6, s.y + 9, 12, 12, 'S');
        s.font(10.5, true); s.ink(INK.text);
        s.doc.text(measured.place, s.margin + cTick + 5, s.y + 17, { lineHeightFactor: 1.33 });
        s.font(10.5);
        s.doc.text(measured.work, s.margin + cTick + cPlace + 6, s.y + 17, { lineHeightFactor: 1.33 });
        s.stroke(INK.hair); s.doc.setLineWidth(0.5);
        s.doc.line(s.margin, s.y + measured.height, s.margin + s.contentWidth, s.y + measured.height);
        s.doc.line(s.margin + cTick + cPlace + cWork, s.y, s.margin + cTick + cPlace + cWork, s.y + measured.height);
        s.y += measured.height;
      }
    }
  }
}

function drawHarvestRecord(s: Sheet, input: CropPlanPdfInput): void {
  masthead(s, 'Field record');
  pageTitle(s, 'Plan versus reality', 'Monthly harvest and field record',
    'Write the month: ____________________   Team: ____________________');

  const h = panel(s, {
    title: 'Write down what actually happened',
    accent: INK.green,
    bg: INK.panelGreen,
    body: ['Record the date, crop, bed and actual harvest weight. Write how much was used, kept, shared or lost. These records help you check the next plan.'],
  });
  s.y += h + 16;

  const blankRows = (cols: Column[], count: number, rowH: number) => {
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    const widths = cols.map((c) => (c.width / totalW) * s.contentWidth);
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, 18, 'F');
    s.font(7.5, true);
    s.ink(INK.white);
    let x = s.margin;
    cols.forEach((c, i) => { s.doc.text(pdfSafe(c.header), x + 6, s.y + 12); x += widths[i]; });
    s.y += 18;
    for (let r = 0; r < count; r++) {
      s.stroke(INK.rule);
      s.doc.setLineWidth(0.4);
      s.doc.rect(s.margin, s.y, s.contentWidth, rowH, 'S');
      let cx = s.margin;
      for (let i = 0; i < widths.length - 1; i++) {
        cx += widths[i];
        s.doc.line(cx, s.y, cx, s.y + rowH);
      }
      s.y += rowH;
    }
    s.y += 14;
  };

  s.font(10, true); s.ink(INK.text);
  s.doc.text(pdfSafe('Harvest record'), s.margin, s.y); s.y += 10;
  blankRows([
    { key: 'a', header: 'Date', width: 48 },
    { key: 'b', header: 'Crop / bed', width: 132 },
    { key: 'c', header: 'Picked kg', width: 62 },
    { key: 'd', header: 'Used kg', width: 56 },
    { key: 'e', header: 'Stored kg', width: 62 },
    { key: 'f', header: 'Sold/shared kg', width: 92 },
    { key: 'g', header: 'Lost kg', width: 56 },
  ], 10, 29);

  s.font(10, true); s.ink(INK.text);
  s.doc.text(pdfSafe('Weekly observation'), s.margin, s.y); s.y += 10;
  blankRows([
    { key: 'w', header: 'Week', width: 40 },
    { key: 'r', header: 'Rainfall', width: 70 },
    { key: 'i', header: 'Irrigation', width: 70 },
    { key: 'p', header: 'Pests / disease', width: 90 },
    { key: 'o', header: 'What we observed', width: 120 },
    { key: 'c', header: 'What we changed', width: 120 },
  ], 4, 27);

  s.font(10, true); s.ink(INK.text);
  s.doc.text(pdfSafe('Decision for next month'), s.margin, s.y); s.y += 10;
  s.fill(INK.panelCream);
  s.doc.rect(s.margin, s.y, s.contentWidth, 54, 'F');
  s.y += 62;
  s.font(8.5);
  s.ink(INK.muted);
  s.doc.text(pdfSafe('Observe. Adjust. Write it down.'), s.margin, s.y);
}

// ── Assembly ────────────────────────────────────────────────────────────────

/** Build the printable plan as a PDF blob. Throws if jsPDF cannot be loaded. */
export async function buildCropPlanPdf(input: CropPlanPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pageFormat: CropPlanPageFormat = input.pageFormat ?? 'a4';
  const doc = new jsPDF({ unit: 'pt', format: pageFormat });

  drawCropPlanPages(doc, input);
  return doc.output('blob');
}

/** The site report attaches the same working document, with continuous page numbers. */
export function drawCropPlanPages(doc: Doc, input: CropPlanPdfInput, append = false): void {
  const pageFormat = input.pageFormat ?? 'a4';
  const now = input.now ?? new Date();
  const nowMonth = now.getMonth() + 1;
  const want = new Set(input.sections ?? ALL_SECTIONS);
  const s = new Sheet(doc, input.meta.planTitle, pageFormat);

  const workload = buildWorkloadSeries(input.tasks, nowMonth, input.plantings, input.beds);
  const calendar = buildOccupancyCalendar(input.plantings, input.beds, nowMonth);

  // The first requested section owns page 1. Without this, exporting only the
  // buying schedule opened on a blank portrait sheet — jsPDF always creates
  // page 1 for you, whether or not the first thing you draw belongs on it.
  let started = false;
  const startPage = (orientation: 'portrait' | 'landscape') => {
    if (started) { s.page(orientation); return; }
    started = true;
    if (append) { doc.addPage(pageFormat, orientation); s.y = s.margin; return; }
    if (orientation === 'landscape') {
      doc.deletePage(1);
      doc.addPage(pageFormat, 'landscape');
    }
    s.y = s.margin;
  };

  if (want.has('dashboard')) { startPage('portrait'); drawDashboard(s, input, now, nowMonth); }
  if (want.has('numbers')) { startPage('portrait'); drawYearInNumbers(s, input, nowMonth, workload); }
  if (!want.has('dashboard') && want.has('plan') && input.planNotes?.length) { startPage('portrait'); masthead(s, 'Plan notes'); drawPlanNotes(s, input); }
  if (want.has('calendar')) { startPage('landscape'); drawCalendar(s, input, nowMonth, calendar); }
  if (want.has('availability')) { startPage('portrait'); drawAvailability(s, input, now, nowMonth); }
  if (want.has('taskSummary')) { startPage('portrait'); drawTaskSummary(s, input, nowMonth); }
  if (want.has('plan')) { startPage('landscape'); drawFullPlan(s, input); }
  if (want.has('buying')) { startPage('landscape'); drawBuying(s, input, now, nowMonth); }
  if (want.has('fieldsheets')) drawFieldSheets(s, input, now, nowMonth, startPage);
  if (want.has('record')) { startPage('portrait'); drawHarvestRecord(s, input); }

  s.stampFooter();
}

/**
 * `ImbewuField-Crop-Plan-<site>-<date>.pdf`, or with `kind`
 * (e.g. `'quick-print-a3'`) `ImbewuField-Crop-Plan-<site>-<kind>-<date>.pdf`
 * — sorts by date in a downloads folder. `kind` exists so a 2-page quick
 * print never shares a filename with the full document (or with
 * quick-print at a different paper size) for the same plan on the same
 * day — without it, a popup-blocked download silently offers the same
 * suggested name as a much longer file with nothing to tell them apart.
 */
export function cropPlanPdfFilename(planTitle?: string, date = new Date(), kind?: string): string {
  const slug = (planTitle ?? 'plan')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'plan';
  const stamp = date.toISOString().slice(0, 10);
  const suffix = kind ? `-${kind}` : '';
  return `ImbewuField-Crop-Plan-${slug}${suffix}-${stamp}.pdf`;
}
