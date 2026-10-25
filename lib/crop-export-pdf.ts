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

import { cropExportText, cropPreservedMethodText, cropProductionIssueText, cropProjectionPeriodText, cropProjectionDetailText, cropProjectionAgeText } from './crop-export-copy';
import { isStapleCropKey } from '@/lib/staple-crops';
import { numberLabel } from '@/lib/format-figures';
import type { CropTask, FoodAvailabilityItem, PlanBed, Planting } from '@/lib/crop-plan';
import { benchmarkAreaConflictDetails, buildFieldUtilizationByMonth, buildFoodAvailability, occupiedMonthsForPlanting, plantingBedEntryOffsets, planNotesDateLabel, recurringPlanPlantings, settleOnceRows, TRANSPLANT_BED_RESERVED_FROM_MONTHS, totalGrowingAreaM2 } from '@/lib/crop-plan';
import { monthAxisSlots } from '@/lib/month-axis';
import { preservedFoodIconKey } from '@/lib/preserved-food-art';
import { buildProductionAvailabilityGraphs, buildProductionKgGraphs, isVisibleProductionFoodSource, type DatedProductionRecord, type PreservedFoodRecord } from '@/lib/crop-export-availability';
import type { PlanNote, PlanNoteKind } from '@/lib/crop-autosuggest';
import { foodGroupOf, type FoodGroup } from '@/lib/crop-groups';
import {
  buildBuyingSchedule, buildTaskMonths, monthShort, monthYearLabel, positionRangeLabel, rollingMonths,
  SUCCESSION_TIMING_GUIDANCE, taskPhrase, weightRangeLabel,
  type ProductionGuide, type ProductionGuideItem,
} from '@/lib/crop-export-schedule';
import {
  buildFieldSheet, buildOccupancyCalendar, compactPlaces, buildPlanDashboard,
  buildPlanTableRows, buildTopCrops, buildWorkloadSeries, cropAbbreviations,
  type CalendarRow, type FieldSheetSection, type MonthCount,
} from '@/lib/crop-export-benchmark';
import { cropByKey, type RainPattern } from '@/lib/crop-catalog';
import { PERENNIAL_HARVEST, firstCropAgeLabel, formatRange, treePickingByMonth, treePickingPhrase, type PlacedTreeGroup, type TreeSeasonChoices } from '@/lib/perennial-harvest';
import { projectedKgLabel, treeAgeProjection, type AgeProjection, type ProductionProjection } from '@/lib/production-projection';
import { ASSURANCE_TITLE, ASSURANCE_ONE_LINE, planAssuranceParagraphs, planAssuranceText } from '@/lib/plan-assurance';
import { productGuideText, type ExpectedSeason } from '@/lib/production-product-guidance';
import type { PoultryGuidance } from '@/lib/animal-enterprises';
import { registerReportPdfFont, reportPdfText } from './report-pdf-font';
import { isNativePdfLanguage, sitePdfAssurance, sitePdfText } from './site-pdf-copy';

export interface CropPlanPdfMeta {
  /** The language of the document labels, independently of saved farmer notes. */
  language?: string;
  /** The design/site this plan belongs to. */
  planTitle: string;
  /** Optional page-level notice for clearly identified demonstrations and other special documents. */
  documentNotice?: string;
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
  /** buildYearReport's scoped comparison; app exports omit its recurring calendar narrative. */
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
   * keeps the food-forest and animal headings visible without inventing dated products. */
  availability?: CropPlanAvailability;
  /** Keep the wall calendar concise; the full plan retains checks and sources. */
  availabilityDetails?: boolean;
  /** Dated stock records; neither harvest months nor catalogue storage imply preservation. */
  preservedProducts?: PreservedFoodRecord[];
  /** Exact monthly output records, with egg counts and milk litres kept in their native units. */
  productionRecords?: DatedProductionRecord[];
  /** Small PNG data URLs keyed 'crop:<key>' / 'tree:<speciesId>' / 'animal:<enterpriseId>'
   * (lib/pdf-icons.ts). A key without one prints as its short code. */
  icons?: Record<string, string>;
  /** The design's trees with a harvest record. The task summary adds a "pick" line in each month
   * a standing tree's sourced SA season covers. Omitted = bed tasks only. */
  treeGroups?: PlacedTreeGroup[];
  /** Locally confirmed picking months; a national reference is not a farm calendar. */
  treeSeasons?: TreeSeasonChoices;
  /** The same farm observations and cultivar preparation guide shown in the app. */
  productionGuide?: ProductionGuide;
  productionProjection?: ProductionProjection;
  /** Sourced choices to discuss locally, not a selected breed or animal yield forecast. */
  poultryGuidance?: PoultryGuidance;
}

/** One picture on the availability page: which art to use, and the name the key gives it. */
export interface AvailabilityEntry {
  iconKey: string;
  label: string;
  /** A source reference is drawn differently and never enters food totals or picking jobs. */
  planning?: ExpectedSeason;
  ageNote?: string;
}

/** The app chart's first twelve slots, starting at the plan's "now" month. */
export interface CropPlanAvailability {
  /** Which of the chart's two years these rows were built for. */
  yearMode?: 'established' | 'fromToday';
  veg?: FoodAvailabilityItem[][];
  /** Food-forest kinds in their sourced season. Omit when the orchard is switched out. */
  forest?: AvailabilityEntry[][];
  /** Separate from confirmed forest slots, even when shown in the same picture calendar. */
  forestPlanning?: AvailabilityEntry[][];
  /** One entry per animal enterprise giving a product that month. Omit when animals are out. */
  animals?: AvailabilityEntry[][];
  /** Preserve an explicit chart switch-off as a visible explanation, rather than a missing section. */
  includeTrees?: boolean;
  includeAnimals?: boolean;
  /** Share of mapped growing area occupied, 0–1+ per month. */
  utilization?: number[];
  /** Placed food sources stay visible even when their production dates are unknown. */
  undated?: { iconKey: string; label: string; detail: string; ageNote?: string }[];
}

export type CropPlanSection = 'dashboard' | 'numbers' | 'calendar' | 'availability' | 'availabilityGraphs' | 'projection' | 'guidance' | 'plan' | 'buying' | 'fieldsheets' | 'record' | 'taskSummary';

export type CropPlanPageFormat = 'a4' | 'a3' | 'a2';

// 'taskSummary' is deliberately excluded: it's a condensed one-pager built
// only for the quick-print export (calendar + taskSummary, nothing else).
// The full document already covers every month in detail via 'fieldsheets';
// including both there would print the same tasks twice.
export const ALL_SECTIONS: CropPlanSection[] = [
  'dashboard', 'numbers', 'calendar', 'availability', 'availabilityGraphs', 'projection', 'guidance', 'plan', 'buying', 'fieldsheets', 'record',
];

/** Rory wants the same bed timeline on paper, followed by the food pictures and field jobs. */
export const FARMER_SECTIONS: CropPlanSection[] = ['calendar', 'availability', 'availabilityGraphs', 'projection', 'guidance', 'buying', 'fieldsheets', 'record'];

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
export function benchmarkYieldLabel(yieldKg: number | null, language = 'en'): string {
  if (yieldKg === null) return cropExportText('Not verified', language);
  if (yieldKg === 0) return cropExportText('No food yield', language);
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
  preserved: [137, 101, 143],
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

export interface CropPlanPdfPresentation {
  language?: string;
  /** Already registered on the document when appending to a site report. */
  font?: string;
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
  private documentNotice?: string;
  private format: CropPlanPageFormat;
  readonly language: string;
  private pdfFont: string;
  private footerCache = new Map<number, string[]>();

  constructor(doc: Doc, footerNote: string, format: CropPlanPageFormat = 'a4', documentNotice?: string, presentation: CropPlanPdfPresentation = {}) {
    this.doc = doc;
    this.footerNote = footerNote;
    this.documentNotice = documentNotice;
    this.format = format;
    this.language = presentation.language ?? 'en';
    this.pdfFont = presentation.font ?? 'helvetica';
  }

  get width(): number { return this.doc.internal.pageSize.getWidth(); }
  get height(): number { return this.doc.internal.pageSize.getHeight(); }
  get contentWidth(): number { return this.width - this.margin * 2; }
  get bottom(): number {
    return isNativePdfLanguage(this.language) ? this.footerTop() - 30 : this.height - 46;
  }

  safe(value: string): string { return isNativePdfLanguage(this.language) ? reportPdfText(value) : pdfSafe(value); }

  private footerRows(): string[] {
    let rows = this.footerCache.get(this.width);
    if (rows) return rows;
    const font = this.doc.getFont(), size = this.doc.getFontSize();
    this.font(7);
    rows = [this.documentNotice, sitePdfAssurance(this.language), sitePdfText('Draft translation: not yet reviewed by a fluent speaker. Check the English source before acting.', this.language)]
      .filter((value): value is string => Boolean(value))
      .flatMap(value => this.doc.splitTextToSize(this.safe(value), this.contentWidth) as string[]);
    this.doc.setFont(font.fontName, font.fontStyle); this.doc.setFontSize(size);
    this.footerCache.set(this.width, rows);
    return rows;
  }

  private footerTop(): number { return this.height - 20 - Math.max(0, this.footerRows().length - 1) * 8.5; }

  ink(c: readonly number[]): void { this.doc.setTextColor(c[0], c[1], c[2]); }
  fill(c: readonly number[]): void { this.doc.setFillColor(c[0], c[1], c[2]); }
  stroke(c: readonly number[]): void { this.doc.setDrawColor(c[0], c[1], c[2]); }
  font(size: number, bold = false): void {
    this.doc.setFont(this.pdfFont, bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
  }

  /** Stamp the running foot. Called once per page, as the page is left. */
  stampFooter(): void {
    if (isNativePdfLanguage(this.language)) {
      const top = this.footerTop();
      this.font(7.5); this.ink(INK.faint);
      this.doc.text(truncateToWidth(this.doc, this.safe(this.footerNote), this.contentWidth - 35), this.margin, top - 12);
      this.doc.text(String(this.doc.getNumberOfPages()), this.width - this.margin, top - 12, { align: 'right' });
      this.font(7);
      // The caution and unreviewed-translation notice must be readable, not faded like page metadata.
      this.ink(INK.muted);
      this.footerRows().forEach((row, index) => this.doc.text(row, this.margin, top + index * 8.5));
      return;
    }
    this.font(7.5);
    this.ink(INK.faint);
    // A fictional example can be printed page by page; its status must survive a lost cover.
    if (this.documentNotice) {
      this.font(7.5, true);
      this.ink(INK.muted);
      this.doc.text(truncateToWidth(this.doc, this.safe(this.documentNotice), this.contentWidth), this.margin, this.height - 37);
      this.font(7.5);
      this.ink(INK.faint);
    }
    // Just the plan name on the left: "ImbewuField crop plan - Ubhejane Creche"
    // ran straight into the centred note on a portrait page. A short title
    // still can, on a narrow enough page (A4 portrait, most facilitators'
    // default) — so the left string is truncated to whatever room is
    // actually free before the fixed centred assurance line begins, rather
    // than assumed to always be short enough.
    const assuranceText = this.safe(ASSURANCE_ONE_LINE);
    const assuranceLeft = this.width / 2 - this.doc.getTextWidth(assuranceText) / 2;
    const noteMaxW = Math.max(0, assuranceLeft - this.margin - 12);
    // A portrait appendix can leave no room beside the assurance line. Its
    // page heading already identifies the site; omit the footer name instead of overlapping.
    const note = noteMaxW >= 24 ? truncateToWidth(this.doc, this.safe(this.footerNote), noteMaxW) : '';
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
    this.doc.text(this.safe(s), x, this.y, { align: opts.align ?? 'left' });
  }

  /** Wrapped paragraph; advances the cursor. */
  paragraph(s: string, opts: { size?: number; bold?: boolean; ink?: readonly number[]; width?: number; gap?: number } = {}): void {
    const size = opts.size ?? 9.5;
    const lead = size * 1.4;
    this.font(size, opts.bold);
    this.ink(opts.ink ?? INK.text);
    const lines = this.doc.splitTextToSize(this.safe(s), opts.width ?? this.contentWidth) as string[];
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

  s.font(7.5, true);
  const native = isNativePdfLanguage(s.language);
  const wording = s.safe(cropExportText(band, s.language).toUpperCase());
  const bandW = native ? Math.min(s.contentWidth / 2, Math.max(176, s.doc.getTextWidth(wording) + 24)) : 176;
  const lines = native ? s.doc.splitTextToSize(wording, bandW - 24) as string[] : [wording];
  const bandH = native ? Math.max(26, lines.length * 9.375 + 10) : 26;
  const bandX = s.width - s.margin - bandW;
  s.fill(INK.green);
  s.doc.rect(bandX, s.y - 15, bandW, bandH, 'F');
  s.ink(INK.white);
  s.doc.text(lines.length === 1 ? lines[0] : lines, s.width - s.margin - 12, s.y - 0.5, { align: 'right', lineHeightFactor: 1.25 });
  s.y += bandH + 2;
}

/** Eyebrow + big title, the benchmark's page-opening pattern. */
function pageTitle(s: Sheet, eyebrow: string, title: string, standfirst?: string): void {
  if (eyebrow) {
    s.font(7.5, true);
    s.ink(INK.gold);
    const lines = s.doc.splitTextToSize(s.safe(eyebrow.toUpperCase()), s.contentWidth) as string[];
    s.doc.text(lines, s.margin, s.y, { lineHeightFactor: 1.25 });
    s.y += Math.max(16, lines.length * 7.5 * 1.25 + 6);
  }
  s.font(19, true);
  s.ink(INK.text);
  // A translated title can span lines; measure before placing the standfirst below it.
  const titleLines = isNativePdfLanguage(s.language) ? s.doc.splitTextToSize(s.safe(title), s.contentWidth) as string[] : [s.safe(title)];
  s.doc.text(titleLines.length === 1 ? titleLines[0] : titleLines, s.margin, s.y, { lineHeightFactor: 1.2 });
  s.y += 16 + (titleLines.length - 1) * 19 * 1.2;
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
  const paras = opts.body.map((b) => s.doc.splitTextToSize(s.safe(b), innerW) as string[]);
  s.font(9, true);
  const titleLines = opts.title ? (isNativePdfLanguage(s.language)
    ? s.doc.splitTextToSize(s.safe(opts.title), innerW) as string[] : [s.safe(opts.title)]) : [];
  const titleH = titleLines.length ? 14 + (titleLines.length - 1) * PANEL_LEADING : 0;
  const h = pad * 2 + titleH + panelBodyHeight(paras.map((p) => p.length));

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
    s.doc.text(titleLines.length === 1 ? titleLines[0] : titleLines, tx, ty, { lineHeightFactor: PANEL_LEADING / 9 });
    ty += titleH;
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

function dashboardTotalExplanation(s: Sheet, input: CropPlanPdfInput, dash: ReturnType<typeof buildPlanDashboard>): string[] {
  const { meta } = input;
  const copy = (source: string, values: Record<string, string | number> = {}) => cropExportText(source, s.language, values);
  const totalExplanation = dash.areaConflictBedLabels.length
    ? [
      copy(dash.areaConflictBedLabels.length === 1
        ? 'No kilogram or value total is shown because {places} has overlapping or invalid planting shares.'
        : 'No kilogram or value total is shown because {places} have overlapping or invalid planting shares.', { places: dash.areaConflictBedLabels.join(', ') }),
      copy('Resolve the bed layout instead of guessing which crop loses growing area.'),
    ]
    : dash.hasKnownYield
    ? [
      meta.lossAllowanceConfirmed
        ? copy('Only crops with a verified kg/m² entry are added to the conservative commercial benchmark comparison. Known total {gross} kg; {net} kg after the {loss}% loss allowance you confirmed.', { gross: dash.grossKg!.toFixed(1), net: dash.netKg!.toFixed(1), loss: meta.lossPercent })
        : copy('Only crops with a verified kg/m² entry are added to the conservative commercial benchmark comparison. Known total {gross} kg; no loss-adjusted total is calculated until an allowance is confirmed.', { gross: dash.grossKg!.toFixed(1) }),
      copy('This is a benchmark comparison, not a household or farm-yield guarantee. Record actual harvests and losses on the monthly record sheet.'),
    ]
    : [
      copy('No kilogram total is shown because this plan has no crop with a verified kg/m² food-yield benchmark.'),
      copy('An unavailable benchmark is not a 0kg harvest. Record actual harvests on the monthly record sheet.'),
    ];
  if (dash.unknownYieldCrops.length) totalExplanation.push(copy(dash.unknownYieldCrops.length === 1
    ? '{crops} is excluded from every kilogram total, not counted as 0kg.'
    : '{crops} are excluded from every kilogram total, not counted as 0kg.', { crops: dash.unknownYieldCrops.join(', ') }));
  return totalExplanation;
}

function drawDashboard(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const { meta } = input;
  const copy = (source: string, values: Record<string, string | number> = {}) => cropExportText(source, s.language, values);
  const months = rollingMonths(nowMonth);
  const period = copy('{start} to {end}', { start: monthYearLabel(months[0], now, s.language), end: monthYearLabel(months[11], now, s.language) });
  const facts = [
    { k: copy('LOCATION'), v: meta.locationLine || meta.siteLine },
    { k: copy('CLIMATE'), v: meta.climateLine || copy('Not set') },
    { k: copy('PLAN PERIOD'), v: period },
    { k: copy('GENERATED'), v: meta.dateLabel },
  ];
  const dash = buildPlanDashboard(input.plantings, input.beds, input.tasks, {
    lossPercent: meta.lossPercent, lossAllowanceConfirmed: meta.lossAllowanceConfirmed, nowMonth, language: s.language,
  });
  if (isNativePdfLanguage(s.language)) {
    drawNativeDashboard(s, input, period, facts, dash, dashboardTotalExplanation(s, input, dash));
    return;
  }
  masthead(s, 'Production plan');

  s.font(7.5, true);
  s.ink(INK.gold);
  s.doc.text(s.safe('A PRACTICAL PLAN FOR THE GARDEN TEAM'), s.margin, s.y);
  s.y += 18;
  // A farm name plus a place ("Ubhejane Creche - KZN Midlands (Pietermaritzburg)") ran straight
  // off the right edge at 21pt; wrap to two lines and only then truncate.
  s.font(21, true);
  s.ink(INK.text);
  const titleLines = s.doc.splitTextToSize(s.safe(`Production plan - ${meta.planTitle}`), s.contentWidth) as string[];
  const shownTitle = titleLines.length > 2
    ? [titleLines[0], truncateToWidth(s.doc, titleLines.slice(1).join(' '), s.contentWidth)]
    : titleLines;
  s.doc.text(shownTitle, s.margin, s.y);
  s.y += 18 + (shownTitle.length - 1) * 23;
  s.font(10);
  s.ink(INK.muted);
  s.doc.text(s.safe(period), s.margin, s.y);
  s.y += 18;

  // Site strip — four facts, evenly spread, in the benchmark's header band.
  const stripH = 46;
  s.fill(INK.panelGreen);
  s.doc.rect(s.margin, s.y, s.contentWidth, stripH, 'F');
  const factW = s.contentWidth / facts.length;
  facts.forEach((f, i) => {
    const x = s.margin + i * factW + 10;
    s.font(6.5, true);
    s.ink(INK.muted);
    s.doc.text(s.safe(f.k), x, s.y + 14);
    s.font(8.5, true);
    s.ink(INK.text);
    const lines = s.doc.splitTextToSize(s.safe(f.v), factW - 18) as string[];
    s.doc.text(lines.slice(0, 2), x, s.y + 26);
  });
  s.y += stripH + 14;

  s.paragraph(
    'A crop plan should reduce uncertainty. It should show the garden team what to prepare, plant, harvest and buy - without making them decode the system behind it.',
    { size: 9.5, gap: 8 },
  );


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
    const label = s.doc.splitTextToSize(s.safe(stat.label), textW) as string[];
    s.font(7.5);
    const detail = s.doc.splitTextToSize(s.safe(stat.detail), textW) as string[];
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
    while (valueSize > 10 && s.doc.getTextWidth(s.safe(stat.value)) > valueMaxW) {
      valueSize -= 1;
      s.font(valueSize, true);
    }
    s.ink(values[i % values.length]);
    s.doc.text(s.safe(stat.value), x + 10, s.y + 30);
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

  const totalExplanation = dashboardTotalExplanation(s, input, dash);

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
  const assuranceBody = [...planAssuranceParagraphs(s.language).map(value => s.safe(value)), s.safe(copy(SUCCESSION_TIMING_GUIDANCE))];
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

  // The dashboard includes active existing crops; this comparison covers new
  // bed-crop cycles. Their totals and leading crop are not duplicate claims.
  if (input.yearReport?.length) {
    const comparison = [
      'This comparison covers planned new bed-crop cycles. It is not a whole-farm production forecast. Read the monthly growing and food calendars for timing.',
      ...input.yearReport,
    ];
    // Keep the heading with its first paragraph (and ideally the next): printed alone it sat at the
    // foot of page 1 with the text it introduces starting page 2 unheaded.
    s.font(8.8);
    const firstLines = comparison.slice(0, 2)
      .reduce((n, para) => n + (s.doc.splitTextToSize(s.safe(para), s.contentWidth) as string[]).length, 0);
    s.need(10 * 1.4 + 6 + firstLines * 8.8 * 1.4 + 5);
    s.paragraph('Planned crop comparison', { size: 10, bold: true, ink: INK.green, gap: 6 });
    for (const para of comparison) s.paragraph(para, { size: 8.8, ink: INK.muted, gap: 5 });
  }

  drawPlanNotes(s, input);
}

function drawNativeDashboard(
  s: Sheet, input: CropPlanPdfInput, period: string, facts: { k: string; v: string }[],
  dash: ReturnType<typeof buildPlanDashboard>, explanation: string[],
): void {
  const copy = (source: string, values: Record<string, string | number> = {}) => cropExportText(source, s.language, values);
  const title = copy('Production plan - {plan}', { plan: input.meta.planTitle });
  const continued = () => {
    masthead(s, 'Production plan');
    pageTitle(s, '', copy('{title} (continued)', { title }), period);
  };
  const reserve = (height: number) => { if (s.need(height)) continued(); };
  const block = (title: string, body: string[]) => {
    const heading = (repeat = false) => {
      const wording = repeat ? copy('{title} (continued)', { title }) : title;
      s.font(11, true);
      const lines = s.doc.splitTextToSize(s.safe(wording), s.contentWidth - 16) as string[];
      const height = lines.length * 14 + 12;
      s.fill(INK.panelGreen); s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F');
      s.ink(INK.green); s.doc.text(lines, s.margin + 8, s.y + 15, { lineHeightFactor: 14 / 11 });
      s.y += height + 6;
    };
    s.font(11, true);
    const headH = (s.doc.splitTextToSize(s.safe(title), s.contentWidth - 16) as string[]).length * 14 + 18;
    s.font(9.5);
    const firstH = body[0] ? (s.doc.splitTextToSize(s.safe(body[0]), s.contentWidth - 16) as string[]).length * 13.3 + 4 : 0;
    reserve(headH + Math.min(firstH, s.height / 2)); heading();
    for (const paragraph of body) {
      s.font(9.5);
      const lines = s.doc.splitTextToSize(s.safe(paragraph), s.contentWidth - 16) as string[];
      const wholeH = lines.length * 13.3 + 4;
      // Short cautions belong with their conditions, not a trailing line on another sheet.
      if (wholeH <= s.height / 2 && !s.fits(wholeH)) { s.page('portrait'); continued(); heading(true); }
      let offset = 0;
      while (offset < lines.length) {
        const capacity = Math.floor((s.bottom - s.y - 8) / 13.3);
        if (capacity < 1) { s.page('portrait'); continued(); heading(true); continue; }
        const chunk = lines.slice(offset, offset + capacity);
        s.font(9.5); s.ink(INK.text);
        s.doc.text(chunk, s.margin + 8, s.y + 10, { lineHeightFactor: 1.4 });
        s.y += chunk.length * 13.3 + 4;
        offset += chunk.length;
        if (offset < lines.length) { s.page('portrait'); continued(); heading(true); }
      }
    }
    s.y += 6;
  };
  masthead(s, 'Production plan');
  s.paragraph(copy('A PRACTICAL PLAN FOR THE GARDEN TEAM'), { size: 7.5, bold: true, ink: INK.gold, gap: 5 });
  pageTitle(s, '', title, period);

  const factW = (s.contentWidth - 8) / 2;
  for (let start = 0; start < facts.length; start += 2) {
    const row = facts.slice(start, start + 2).map(fact => {
      s.font(7.5, true); const label = s.doc.splitTextToSize(s.safe(fact.k), factW - 20) as string[];
      s.font(9); const value = s.doc.splitTextToSize(s.safe(fact.v), factW - 20) as string[];
      return { label, value };
    });
    const height = Math.max(...row.map(fact => fact.label.length * 9.5 + fact.value.length * 12.6 + 20));
    reserve(height + 8);
    row.forEach((fact, i) => {
      const x = s.margin + i * (factW + 8);
      s.fill(INK.panelGreen); s.doc.rect(x, s.y, factW, height, 'F');
      s.font(7.5, true); s.ink(INK.muted); s.doc.text(fact.label, x + 10, s.y + 13, { lineHeightFactor: 9.5 / 7.5 });
      s.font(9); s.ink(INK.text); s.doc.text(fact.value, x + 10, s.y + 13 + fact.label.length * 9.5 + 3, { lineHeightFactor: 1.4 });
    });
    s.y += height + 8;
  }
  s.paragraph(copy('A crop plan should reduce uncertainty. It should show the garden team what to prepare, plant, harvest and buy - without making them decode the system behind it.'), { size: 9.5, gap: 10 });

  const tileW = (s.contentWidth - 16) / 3;
  const tints = [INK.panelGrey, INK.panelCream, INK.panelGreen, INK.panelPink];
  for (let start = 0; start < dash.stats.length; start += 3) {
    const row = dash.stats.slice(start, start + 3).map(stat => {
      s.font(17, true); const value = s.doc.splitTextToSize(s.safe(stat.value), tileW - 20) as string[];
      s.font(9, true); const label = s.doc.splitTextToSize(s.safe(stat.label), tileW - 20) as string[];
      s.font(8); const detail = s.doc.splitTextToSize(s.safe(stat.detail), tileW - 20) as string[];
      return { value, label, detail };
    });
    const valueH = Math.max(...row.map(tile => tile.value.length)) * 20.4;
    const labelH = Math.max(...row.map(tile => tile.label.length)) * 12;
    const height = valueH + labelH + Math.max(...row.map(tile => tile.detail.length)) * 11.2 + 26;
    reserve(height + 10);
    row.forEach((tile, i) => {
      const x = s.margin + i * (tileW + 8);
      s.fill(tints[(start + i) % tints.length]); s.doc.rect(x, s.y, tileW, height, 'F');
      s.font(17, true); s.ink(INK.text); s.doc.text(tile.value, x + 10, s.y + 25, { lineHeightFactor: 1.2 });
      s.font(9, true); s.doc.text(tile.label, x + 10, s.y + valueH + 20, { lineHeightFactor: 12 / 9 });
      s.font(8); s.ink(INK.muted); s.doc.text(tile.detail, x + 10, s.y + valueH + labelH + 23, { lineHeightFactor: 1.4 });
    });
    s.y += height + 10;
  }
  block(copy('PLAN SIGNALS'), dash.signals.map(value => `- ${value}`));
  block(copy('DECISIONS TO MAKE'), dash.decisions.map(value => `- ${value}`));
  block(copy('How the totals are calculated'), explanation);
  block(planAssuranceText(ASSURANCE_TITLE, s.language), [...planAssuranceParagraphs(s.language), copy(SUCCESSION_TIMING_GUIDANCE)]);
  if (input.yearReport?.length) block(copy('Planned crop comparison'), [
    copy('This comparison covers planned new bed-crop cycles. It is not a whole-farm production forecast. Read the monthly growing and food calendars for timing.'), ...input.yearReport,
  ]);
  if (input.planNotes?.length) {
    const intro = input.planNotesAt
      ? copy('From the plan suggested in {date}. Anything changed by hand since is not described here.', { date: planNotesDateLabel(input.planNotesAt, s.language) })
      : copy('From the suggested plan that was accepted. Anything changed by hand since is not described here.');
    block(copy('How this plan was put together'), [intro]);
    for (const kind of PLAN_NOTE_PANEL_ORDER) {
      const body = input.planNotes.filter(note => note.kind === kind).map(note => note.text);
      if (body.length) block(copy(PLAN_NOTE_PANEL_TITLES[kind]), body);
    }
  }
}

/** panel() draws at s.y without checking whether the page has room; this is the
 * same arithmetic it uses, so a caller can ask for the space first. */
function panelHeight(s: Sheet, body: string[], hasTitle: boolean, accent: boolean): number {
  const innerW = s.contentWidth - 20 - (accent ? 4 : 0);
  s.font(8.5);
  const counts = body.map((b) => (s.doc.splitTextToSize(s.safe(b), innerW) as string[]).length);
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

interface NativeChartTitle { lines: string[]; axis: string; axisX: number; axisOffset: number; extra: number }
function nativeChartTitle(s: Sheet, title: string, axis: string): NativeChartTitle {
  s.font(11, true);
  const lines = s.doc.splitTextToSize(s.safe(title), s.contentWidth) as string[];
  const lastWidth = s.doc.getTextWidth(lines.at(-1) ?? '');
  s.font(7.5);
  const unit = s.safe(`(${axis})`), separate = lastWidth + 5 + s.doc.getTextWidth(unit) > s.contentWidth;
  return { lines, axis: unit, axisX: s.margin + (separate ? 0 : lastWidth + 5), axisOffset: (lines.length - 1) * 13.2 + (separate ? 11 : 0), extra: (lines.length - 1) * 13.2 + (separate ? 11 : 0) };
}
function drawNativeChartTitle(s: Sheet, title: NativeChartTitle): void {
  s.font(11, true); s.ink(INK.text);
  s.doc.text(title.lines, s.margin, s.y, { lineHeightFactor: 1.2 });
  s.font(7.5); s.ink(INK.faint);
  s.doc.text(title.axis, title.axisX, s.y + title.axisOffset);
}
function nativeChartLegend(s: Sheet, series: { label: string; ink: readonly number[] }[]) {
  s.font(7.5);
  const start = s.margin + 30; let x = start, y = 0, rowHeight = 16;
  const entries = series.map(entry => {
    const lines = s.doc.splitTextToSize(s.safe(entry.label), s.contentWidth - 54) as string[];
    const width = 24 + Math.max(...lines.map(line => s.doc.getTextWidth(line)));
    if (x > start && x + width > s.width - s.margin) { x = start; y += rowHeight; rowHeight = 16; }
    const result = { ...entry, lines, x, y }; x += width; rowHeight = Math.max(rowHeight, lines.length * 9 + 7); return result;
  });
  return { entries, height: y + rowHeight };
}

function barChart(
  s: Sheet,
  opts: {
    title: string;
    onPage?: () => void;
    labels: string[];
    values: number[];
    inks: readonly (readonly number[])[];
    axis: string;
    height?: number;
    /** A shared scale makes fresh-only and fresh-plus-kept comparisons readable. */
    maxValue?: number;
    /** Missing monthly records need a visible marker, distinct from an explicit zero. */
    missing?: boolean[];
    showZero?: boolean;
    format?: (v: number) => string;
  },
): void {
  const h = opts.height ?? 108;
  const extraLabelHeight = (Math.max(1, ...opts.labels.map(label => label.split('\n').length)) - 1) * 12;
  const nativeTitle = isNativePdfLanguage(s.language) ? nativeChartTitle(s, opts.title, opts.axis) : undefined;
  if (s.need(h + 52 + extraLabelHeight + (nativeTitle?.extra ?? 0))) opts.onPage?.();
  if (nativeTitle) drawNativeChartTitle(s, nativeTitle);
  else {
  s.font(11, true);
  s.ink(INK.text);
  s.doc.text(s.safe(opts.title), s.margin, s.y);
  // The unit sits on the title line, clear of the tick labels: drawn above the value axis it
  // collided with the chart title (2026-09-29 regional PDF audit).
  const titleW = s.doc.getTextWidth(s.safe(opts.title));
  s.font(7.5);
  s.ink(INK.faint);
  s.doc.text(s.safe(`(${opts.axis})`), s.margin + titleW + 5, s.y);
  }
  // Headroom so the tallest bar's value label never touches the title.
  s.y += 18 + (nativeTitle?.extra ?? 0);

  const plotX = s.margin + 30;
  const plotW = s.contentWidth - 30;
  const top = s.y;
  const base = top + h;
  // Round gridline steps (1, 2, 5 × 10ⁿ): quarters of the busiest month gave ticks like 5, 9, 14.
  const highest = Math.max(1, ...opts.values, opts.maxValue ?? 0);
  const step = niceStep(highest / 4);
  const gridlines = Math.max(1, Math.ceil(highest / step));
  const max = step * gridlines;

  // Faint gridlines and a value axis, so a bar can be read, not guessed.
  s.stroke(INK.hair);
  s.doc.setLineWidth(0.5);
  for (let i = 0; i <= gridlines; i++) {
    const gy = base - (h * i) / gridlines;
    s.doc.line(plotX, gy, plotX + plotW, gy);
    s.font(6.5);
    s.ink(INK.faint);
    s.doc.text(s.safe(String(Number((step * i).toFixed(2)))), plotX - 5, gy + 2, { align: 'right' });
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
    if (opts.missing?.[i]) s.doc.text('?', x + barW / 2, base - 4, { align: 'center' });
    else if (v > 0 || opts.showZero) s.doc.text(s.safe((opts.format ?? ((n) => n.toFixed(0)))(v)), x + barW / 2, base - bh - 4, { align: 'center' });
    s.font(7);
    s.ink(INK.muted);
    s.doc.text(s.safe(opts.labels[i]), x + barW / 2, base + 11, { align: 'center' });
  });

  s.y = base + 26 + extraLabelHeight;
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
  const copy = (source: string, values: Record<string, string | number> = {}) => cropExportText(source, s.language, values);
  const native = isNativePdfLanguage(s.language);
  const reserve = (height: number) => {
    if (s.need(height) && native) {
      masthead(s, 'Manager view');
      pageTitle(s, '', copy('{title} (continued)', { title: copy('The year in numbers') }));
    }
  };
  masthead(s, 'Manager view');
  pageTitle(s, copy('Manager view'), copy('The year in numbers'),
    copy('Use this page to compare benchmark timing with labour, kitchen demand, storage and mentoring visits before the work reaches the field.'));

  const coverage = buildPlanDashboard(input.plantings, input.beds, input.tasks, {
    lossPercent: input.meta.lossPercent,
    lossAllowanceConfirmed: input.meta.lossAllowanceConfirmed,
    nowMonth, language: s.language,
  });
  const yieldNote = coverage.areaConflictBedLabels.length
    ? copy(coverage.areaConflictBedLabels.length === 1
      ? 'No kilogram figure is shown because {places} has overlapping or invalid planting shares. Resolve the layout before using a benchmark.'
      : 'No kilogram figure is shown because {places} have overlapping or invalid planting shares. Resolve the layout before using a benchmark.', { places: coverage.areaConflictBedLabels.join(', ') })
    : coverage.hasKnownYield
    ? copy('The {kg} kg figure is a sum of crop-cycle benchmarks. It is not divided into months because the source does not provide a within-window picking curve.', { kg: coverage.grossKg!.toFixed(1) })
    : copy('No kilogram comparison is available because none of this plan\'s food crops has a verified kg/m² benchmark. An unavailable benchmark is not a 0kg harvest.');
  // The standfirst above tells the reader to use this page to compare storage,
  // and until now the page said nothing whatsoever about storage: the sourced
  // shelf lives existed in the catalog and reached the printed plan nowhere. A
  // plan with no storage crop gets no line at all rather than a "0 of 12", which
  // would read as a finding about the year instead of the absence of the data.
  const storedNote = coverage.storedFoodMonths > 0
    ? copy(coverage.storedFoodCrops.length === 1
      ? '{months} of 12 months also have food from store, from {count} crop with a sourced shelf life ({crops}). Each shelf life assumes particular storage conditions for that crop and does not hold without them.'
      : '{months} of 12 months also have food from store, from {count} crops with a sourced shelf life ({crops}). Each shelf life assumes particular storage conditions for that crop and does not hold without them.', { months: coverage.storedFoodMonths, count: coverage.storedFoodCrops.length, crops: coverage.storedFoodCrops.join(', ') })
    : null;
  const yieldH = panel(s, {
    title: copy('CROP-CYCLE BENCHMARK ONLY'),
    accent: INK.gold,
    bg: INK.panelCream,
    body: [
      yieldNote,
      copy('{months} of 12 months have at least one verified fresh-picking window; that is timing, not monthly kilograms.', { months: coverage.freshPickingMonths }),
      ...(storedNote ? [storedNote] : []),
    ],
  });
  s.y += yieldH + 18;

  const busiest = Math.max(...workload.map((v) => v.count));
  if (native) reserve(160);
  barChart(s, {
    title: copy('Workload by month'),
    labels: workload.map((v) => monthShort(v.month, s.language)),
    values: workload.map((v) => v.count),
    inks: workload.map((v) => (v.count >= busiest * 0.9 ? INK.terracotta : INK.teal)),
    axis: copy('jobs planned'),
  });

  // Biggest crops — horizontal, because crop names do not fit under a column.
  // An unresolved layout already withholds kg in the coverage authority above.
  // The old bars contradicted that notice by still presenting crop-volume subtotals.
  const top = coverage.areaConflictBedLabels.length ? [] : buildTopCrops(input.plantings, input.beds, 7);
  if (top.length) {
    s.font(8);
    const cropLines = top.map(crop => native ? s.doc.splitTextToSize(s.safe(crop.name), 88) as string[] : [s.safe(crop.name)]);
    s.font(11, true);
    const headingLines = native ? s.doc.splitTextToSize(s.safe(copy('Largest crops by known benchmark volume')), s.contentWidth) as string[] : [s.safe('Largest crops by known benchmark volume')];
    if (native) reserve(cropLines.reduce((sum, lines) => sum + Math.max(15, lines.length * 10.56 + 2), 0) + headingLines.length * 14 + 20);
    else s.need(top.length * 16 + 40);
    s.font(11, true);
    s.ink(INK.text);
    s.doc.text(headingLines.length === 1 ? headingLines[0] : headingLines, s.margin, s.y, { lineHeightFactor: 14 / 11 });
    s.y += headingLines.length * 14;
    const labelW = 96;
    const trackX = s.margin + labelW;
    const trackW = s.contentWidth - labelW - 46;
    const maxKg = Math.max(1, ...top.map((c) => c.kg));
    for (const [index, crop] of top.entries()) {
      s.font(8);
      s.ink(INK.text);
      s.doc.text(cropLines[index].length === 1 ? cropLines[index][0] : cropLines[index], s.margin + labelW - 6, s.y + 7, { align: 'right', lineHeightFactor: 1.32 });
      const bw = (crop.kg / maxKg) * trackW;
      s.fill(GROUP_INK[crop.group]);
      s.doc.roundedRect(trackX, s.y, Math.max(1, bw), 9, 2, 2, 'F');
      s.font(7.5, true);
      s.ink(INK.muted);
      s.doc.text(s.safe(`${crop.kg.toFixed(1)} kg`), trackX + bw + 5, s.y + 7);
      s.y += native ? Math.max(15, cropLines[index].length * 10.56 + 2) : 15;
    }
    s.y += 6;
  }
  const chartNote = [
    copy('Chart note: the workload chart counts planned jobs, not hours - a plot of maize and a bed of lettuce each count as one. Crop-cycle benchmark weights are shown by crop only; no monthly kg or Rand is inferred.'),
    ...(coverage.unknownYieldCrops.length
      ? [copy('Excluded from the kg total and crop-volume bars because no verified kg/m² benchmark is available: {crops}.', { crops: coverage.unknownYieldCrops.join(', ') })]
      : []),
  ];
  if (native) reserve(panelHeight(s, chartNote, false, false));
  panel(s, { bg: INK.panelGrey, body: chartNote });
}

// ── 3. Land occupancy calendar ──────────────────────────────────────────────

function drawCalendar(s: Sheet, input: CropPlanPdfInput, nowMonth: number, rows: CalendarRow[]): void {
  const native = isNativePdfLanguage(s.language);
  const copy = (source: string, values?: Record<string, string | number>) => cropExportText(source, s.language, values);
  const start = input.now ?? new Date();
  const end = new Date(start.getFullYear(), start.getMonth() + 11, 1);
  const months = rollingMonths(nowMonth);
  const conflicts = new Set(benchmarkAreaConflictDetails(input.plantings, input.beds, nowMonth).map((record) => record.bedId));
  const labelW = 204;
  const colW = (s.contentWidth - labelW) / 12;
  s.font(native ? 8 : 9.5, true);
  const monthLines = months.map(month => native ? s.doc.splitTextToSize(s.safe(monthShort(month, s.language)), colW - 4) as string[] : [monthShort(month)]);
  const headH = native ? Math.max(30, Math.max(...monthLines.map(lines => lines.length)) * 10 + 15) : 30;
  const rowH = 34;
  const bedHeadH = 27;
  const growingInk = [127, 174, 110];
  const pickingInk = [212, 160, 23];

  const drawHead = (continued = false) => {
    masthead(s, 'Production plan');
    pageTitle(s, copy(continued ? 'Bed calendar - continued' : 'Bed calendar'),
      copy('Growing plan: {start} - {end}', { start: `${monthShort(nowMonth, s.language)} ${start.getFullYear()}`, end: `${monthShort(end.getMonth() + 1, s.language)} ${end.getFullYear()}` }));
    s.paragraph(copy('Read across to see what occupies each bed. Each line is one planting, not a measured strip of land.'),
      { size: 9.5, ink: INK.muted, gap: 6 });
    const legend = [
      { ink: growingInk, label: 'Bed reserved / growing', width: 174 },
      { ink: pickingInk, label: 'Pick fresh food', width: 124 },
      { ink: INK.muted, label: 'Finish a cover crop', width: 154 },
    ];
    let lx = s.margin;
    let legendH = 13;
    for (const item of legend) {
      const width = native ? s.contentWidth / legend.length : item.width;
      s.fill(item.ink);
      s.doc.roundedRect(lx, s.y - 8, 17, 9, 2, 2, 'F');
      s.font(9);
      s.ink(INK.text);
      const lines = native ? s.doc.splitTextToSize(s.safe(copy(item.label)), width - 29) as string[] : [s.safe(item.label)];
      s.doc.text(lines.length === 1 ? lines[0] : lines, lx + 23, s.y, { lineHeightFactor: 1.25 });
      if (native) legendH = Math.max(legendH, lines.length * 11.25 + 2);
      lx += width;
    }
    s.y += legendH;
    s.paragraph(copy('Tray crops reserve the bed from their first readiness month. Follow the monthly jobs. An arrow means the crop continues after {month} {year}.', { month: monthShort(end.getMonth() + 1, s.language), year: end.getFullYear() }),
      { size: 8.5, ink: INK.muted, gap: 8 });
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, headH, 'F');
    s.font(9.5, true);
    s.ink(INK.white);
    const cropHeading = s.safe(copy('CROP / SHARE OF BED'));
    const cropHeadingLines = native ? s.doc.splitTextToSize(cropHeading, labelW - 16) as string[] : [cropHeading];
    s.doc.text(cropHeadingLines.length === 1 ? cropHeadingLines[0] : cropHeadingLines, s.margin + 8, s.y + (native ? 12 : 18), { lineHeightFactor: 1.1 });
    months.forEach((m, i) => {
      const date = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const x = s.margin + labelW + i * colW + colW / 2;
      s.font(native ? 8 : 9.5, true);
      s.doc.text(monthLines[i].length === 1 ? s.safe(monthLines[i][0]) : monthLines[i], x, s.y + 12, { align: 'center', lineHeightFactor: 1.25 });
      s.font(7.5);
      s.doc.text(String(date.getFullYear()), x, s.y + headH - 6, { align: 'center' });
    });
    s.y += headH;
  };
  drawHead();

  const newCalendarPage = () => { s.page('landscape'); drawHead(true); };
  const drawBedHead = (row: CalendarRow, continued = false) => {
    const conflict = conflicts.has(row.bedId);
    s.fill(conflict ? INK.panelPink : row.kind === 'plot' ? INK.panelCream : INK.panelGreen);
    s.doc.rect(s.margin, s.y, s.contentWidth, bedHeadH, 'F');
    s.font(11, true);
    s.ink(conflict ? INK.terracotta : INK.green);
    const area = s.safe(`${numberLabel(row.areaM2)} m²`);
    const suffix = `${continued ? copy(' - continued') : ''}${conflict ? copy(' - CHECK SPACE: crop shares conflict') : ''}`;
    const room = s.contentWidth - s.doc.getTextWidth(area) - 28;
    s.doc.text(truncateToWidth(s.doc, s.safe(row.label + suffix), room), s.margin + 8, s.y + 18);
    s.font(10);
    s.ink(INK.muted);
    s.doc.text(area, s.width - s.margin - 8, s.y + 18, { align: 'right' });
    s.y += bedHeadH;
  };

  for (const row of rows) {
    // Two sowings of carrots can have the same crop and share while being separate cohorts.
    // Keep their recorded identities rather than merging their bars by crop name.
    const active = new Set(row.cells.flat().map((entry) => entry.plantingId));
    const lanes = input.plantings.filter((p) => p.bedId === row.bedId && active.has(p.id));
    const varietyLinesFor = (planting: Planting) => {
      s.font(8.5);
      return planting.variety?.trim()
        ? s.doc.splitTextToSize(s.safe(copy('Variety: {variety}', { variety: planting.variety.trim() })), labelW - 44) as string[] : [];
    };
    const detailFor = (planting: Planting, entryShare: string) => {
      const crop = cropByKey(planting.cropKey)!;
      const fraction = planting.areaFraction ?? 1;
      const share = !Number.isFinite(fraction) || fraction <= 0 ? copy('Invalid share')
        : fraction === 1 ? copy('Whole area') : fraction > 1 ? copy('{share}% area', { share: numberLabel(fraction * 100) }) : copy('{share} area', { share: entryShare });
      const [bedStart] = plantingBedEntryOffsets(planting, nowMonth, 12);
      const sowOffset = bedStart - (crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0);
      const sowDate = new Date(start.getFullYear(), start.getMonth() + sowOffset, 1);
      const detail = copy('{share} - sow {month} {year}', { share, month: monthShort(planting.sowMonth, s.language), year: sowDate.getFullYear() });
      s.font(8.5);
      return { bedStart, lines: native ? s.doc.splitTextToSize(s.safe(detail), labelW - 44) as string[] : [truncateToWidth(s.doc, s.safe(detail), labelW - 44)] };
    };
    const firstEntry = lanes[0] && row.cells.flat().find(entry => entry.plantingId === lanes[0].id);
    const firstDetail = firstEntry ? detailFor(lanes[0], firstEntry.share) : undefined;
    const firstLaneHeight = rowH + (firstDetail ? (firstDetail.lines.length - 1) * 11 : 0) + (lanes[0] ? varietyLinesFor(lanes[0]).length * 11 : 0);
    if (!s.fits(bedHeadH + firstLaneHeight)) newCalendarPage();
    drawBedHead(row);

    const drawGridRow = (height = rowH) => {
      s.fill(INK.white);
      s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F');
      s.fill(INK.panelGreen);
      s.doc.rect(s.margin + labelW, s.y, colW, height, 'F');
      s.stroke(INK.hair);
      s.doc.setLineWidth(0.4);
      s.doc.line(s.margin, s.y + height, s.width - s.margin, s.y + height);
      months.forEach((_, i) => {
        const x = s.margin + labelW + i * colW;
        s.doc.line(x, s.y, x, s.y + height);
      });
    };

    if (!lanes.length) {
      drawGridRow();
      s.font(9.5);
      s.ink(INK.muted);
      s.doc.text(copy('No dated crop reserved here'), s.margin + 8, s.y + 21);
      s.y += rowH;
    }
    for (const planting of lanes) {
      const varietyLines = varietyLinesFor(planting);
      const calendarEntry = row.cells.flat().find(entry => entry.plantingId === planting.id)!;
      const detail = detailFor(planting, calendarEntry.share);
      const laneH = rowH + (detail.lines.length - 1) * 11 + varietyLines.length * 11;
      if (!s.fits(laneH)) { newCalendarPage(); drawBedHead(row, true); }
      drawGridRow(laneH);
      const crop = cropByKey(planting.cropKey)!;
      const cells = row.cells.map((cell) => cell.find((entry) => entry.plantingId === planting.id));
      const entry = cells.find((cell) => cell !== undefined)!;
      drawIconOrCode(s, { iconKey: `crop:${crop.key}`, code: entry.abbr }, s.margin + 6, s.y + 5, 24, input.icons);
      s.font(10, true);
      s.ink(INK.text);
      s.doc.text(truncateToWidth(s.doc, s.safe(crop.name), labelW - 44), s.margin + 36, s.y + 14);
      s.font(8.5);
      s.ink(INK.muted);
      s.doc.text(detail.lines.length === 1 ? detail.lines[0] : detail.lines, s.margin + 36, s.y + 27, { lineHeightFactor: 11 / 8.5 });
      if (varietyLines.length) s.doc.text(varietyLines, s.margin + 36, s.y + 27 + detail.lines.length * 11, { lineHeightFactor: 11 / 8.5 });
      const continues = detail.bedStart + occupiedMonthsForPlanting(planting).length > 12;

      // Paint adjacent phase cells as one bar. Its dates come directly from the same
      // occupancy entries used by the app's source model, including clipped existing crops.
      for (let i = 0; i < cells.length;) {
        const phase = cells[i];
        if (!phase) { i++; continue; }
        let last = i;
        while (last + 1 < cells.length && cells[last + 1]?.harvesting === phase.harvesting) last++;
        const coverEnd = phase.harvesting && crop.yieldKgPerM2 === 0;
        s.fill(phase.harvesting ? (coverEnd ? INK.muted : pickingInk) : growingInk);
        const x = s.margin + labelW + i * colW + 1;
        const width = (last - i + 1) * colW - 2;
        s.doc.roundedRect(x, s.y + 8, width, 18, 3, 3, 'F');
        if (phase.harvesting) {
          s.font(8, true);
          s.ink(coverEnd ? INK.white : INK.text);
          const phaseLabel = s.safe(copy(coverEnd ? 'Finish' : 'Pick'));
          if (native && s.doc.getTextWidth(phaseLabel) > width - 6) s.font(Math.max(5.5, 8 * (width - 6) / s.doc.getTextWidth(phaseLabel)), true);
          s.doc.text(phaseLabel, x + width / 2, s.y + 20, { align: 'center' });
        }
        if (last === 11 && continues) {
          s.fill(phase.harvesting && !coverEnd ? INK.text : INK.white);
          s.doc.triangle(x + width - 9, s.y + 13, x + width - 9, s.y + 21, x + width - 3, s.y + 17, 'F');
        }
        i = last + 1;
      }
      s.y += laneH;
    }
    s.y += 8;
  }
  if (!rows.length) s.paragraph(copy('No beds or staple plots are mapped. Fruit, berries and animal food sources are listed in the picture calendar.'),
    { size: 10, ink: INK.muted });
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
  key: 'fresh' | 'stored' | 'staples' | 'staples-stored' | 'forest' | 'animals';
  title: string;
  sub: string;
  /** The app tray's colour; the print uses it as a pale fill and a mid border. */
  rgb: readonly number[];
  cells: AvailabilityCell[][];
  planningCells?: AvailabilityCell[][];
  undated?: AvailabilityCell[];
  emptyNote?: string;
}

export interface ResolvedAvailability {
  yearMode: 'established' | 'fromToday';
  bands: AvailabilityBand[];
  utilization: number[];
}

const mixWithWhite = (rgb: readonly number[], share: number): number[] =>
  rgb.map((c) => Math.round(255 - (255 - c) * share));

function isAnimalAvailabilityKey(key: string): boolean {
  return key.startsWith('animal:') || key.startsWith('housing:');
}

function includedUndatedSources(availability?: CropPlanAvailability): NonNullable<CropPlanAvailability['undated']> {
  return (availability?.undated ?? []).filter((entry) => isAnimalAvailabilityKey(entry.iconKey)
    ? availability?.includeAnimals !== false : availability?.includeTrees !== false);
}

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
  const vegCells = (status: 'fresh' | 'stored', staples = false) => months.map((_, i) => (veg[i] ?? [])
    .filter((v) => v.status === status && isStapleCropKey(v.cropKey) === staples)
    .map((v) => ({ iconKey: `crop:${v.cropKey}`, label: v.name, code: codes.get(v.cropKey) ?? fallbackCode(v.name) })));
  const entryCells = (rows?: AvailabilityEntry[][]) => months.map((_, i) => (rows?.[i] ?? [])
    .map((e) => ({ ...e, code: fallbackCode(e.label) })));
  const undated = (kind: 'forest' | 'animals') => includedUndatedSources(given)
    .filter((e) => kind === 'animals' ? isAnimalAvailabilityKey(e.iconKey) : !isAnimalAvailabilityKey(e.iconKey))
    .map((e) => ({ ...e, code: fallbackCode(e.label) }));
  const bands: AvailabilityBand[] = [
    { key: 'fresh', title: 'Fresh veg', sub: 'picked from the beds', rgb: [127, 174, 110], cells: vegCells('fresh') },
    { key: 'stored', title: 'Stored veg', sub: 'kept under named conditions', rgb: [212, 160, 23], cells: vegCells('stored') },
    { key: 'staples', title: 'Staple crops', sub: 'ready to harvest', rgb: [127, 174, 110], cells: vegCells('fresh', true), emptyNote: 'No staple picking months marked yet.' },
    { key: 'staples-stored', title: 'Stored staples', sub: 'kept under named conditions', rgb: [212, 160, 23], cells: vegCells('stored', true) },
    { key: 'forest', title: 'Food forest - fruit, nuts & berries and other foods', sub: 'confirmed local picking months', rgb: [46, 107, 58],
      cells: entryCells(given?.includeTrees === false ? undefined : given?.forest),
      planningCells: entryCells(given?.includeTrees === false ? undefined : given?.forestPlanning),
      undated: given?.includeTrees === false ? [] : undated('forest'),
      emptyNote: given?.includeTrees === false
        ? 'Hidden for this print. Show fruit, nuts and berries in the app to include them.'
        : 'No confirmed picking months shown. Check fruit, nuts and berries on your map in the app.' },
    { key: 'animals', title: 'Animal products', sub: 'eggs, milk, meat, honey and fish', rgb: [192, 122, 30],
      cells: entryCells(given?.includeAnimals === false ? undefined : given?.animals),
      undated: given?.includeAnimals === false ? [] : undated('animals'),
      emptyNote: given?.includeAnimals === false
        ? 'Hidden for this print. Show animal products in the app to include them.'
        : 'No confirmed production months shown. Check animal products and housing on your map in the app.' },
  ];
  return {
    yearMode: given?.yearMode ?? 'fromToday',
    // Rory could not find fruit or animal products on paper: unknown dates must leave a
    // named section and the mapped sources, not silently turn a production plan into vegetables.
    bands: bands.filter((b) => (b.key !== 'stored' && b.key !== 'staples-stored') || b.cells.some((c) => c.length > 0)),
    utilization,
  };
}

/** Every icon key the availability page will draw, so a caller can load exactly those. */
export function availabilityIconKeys(input: CropPlanPdfInput): string[] {
  const nowMonth = (input.now ?? new Date()).getMonth() + 1;
  const { bands } = resolveAvailability(input, nowMonth);
  return [...new Set([
    ...buildOccupancyCalendar(input.plantings, input.beds, nowMonth).flatMap((row) => row.cells.flat().map((entry) => `crop:${entry.cropKey}`)),
    ...bands.flatMap((b) => [...b.cells.flat(), ...(b.planningCells?.flat() ?? [])].map((e) => e.iconKey)),
    ...includedUndatedSources(input.availability).map((e) => e.iconKey),
    ...(input.productionProjection?.years[0]?.trees ?? []).map(tree => `tree:${tree.speciesId}`),
    ...(input.preservedProducts ?? []).filter(record => isVisibleProductionFoodSource(record.sourceIconKey, input.availability ?? {})).map(preservedFoodIconKey),
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
  s.doc.text(s.safe(entry.code), x + size / 2, y + size / 2 + size * 0.15, { align: 'center' });
}

function drawAvailability(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const resolved = resolveAvailability(input, nowMonth);
  const native = isNativePdfLanguage(s.language);
  const copy = (source: string, values?: Record<string, string | number>) => cropExportText(source, s.language, values);
  const axis = monthAxisSlots(nowMonth, now.getFullYear(), 12);
  const last = axis[11];
  const dated = resolved.yearMode === 'fromToday';
  const labelW = 150;
  const colW = (s.contentWidth - labelW) / 12;
  const icon = Math.min(23, colW - 6);
  // Extra food-forest sources left only the space key on another wall sheet. Keep
  // ordinary A2 rows compact; measured multi-line labels still receive extra room.
  const minimumRowHeight = input.pageFormat === 'a2' ? 32 : 36;
  const bandHeaderHeight = input.pageFormat === 'a2' ? 20 : 24;
  const bandGap = input.pageFormat === 'a2' ? 4 : 8;
  const planningLabel = (e: AvailabilityCell) => {
    if (e.planning?.calendarLabel) return e.planning.calendarLabel;
    const label = e.planning?.label ?? '';
    if (label.startsWith('Regional reference:')) return copy('Regional season');
    if (native && label.startsWith('Assumed variety:')) return copy('Plan: {variety}', { variety: label.slice('Assumed variety:'.length).trimStart() });
    return label.replace('Assumed variety:', 'Plan:');
  };
  const heading = () => {
    masthead(s, 'Picture calendar');
    pageTitle(s, input.meta.planTitle,
      dated ? `${monthShort(nowMonth, s.language)} ${now.getFullYear()} - ${monthShort(last.month, s.language)} ${last.year}` : copy('Repeat-year template'),
      dated ? copy('Fruit, nuts and berries: solid marks are local dates. Outlined marks: references when established, not food promised this year.')
        : copy('This repeats the annual planting cycle. It is not a forecast for this first year.'));
    s.paragraph(`${input.meta.locationLine || input.meta.siteLine} - ${input.meta.climateLine || copy('Climate not set')}`, { size: 10, ink: INK.green, gap: 8 });
  };
  const monthHead = () => {
    s.fill(INK.green);
    s.font(10, true);
    const sourceLines = native ? s.doc.splitTextToSize(s.safe(copy('CROP / FOOD SOURCE')), labelW - 16) as string[] : ['CROP / FOOD SOURCE'];
    s.font(8, true);
    const monthLines = axis.map(slot => native ? s.doc.splitTextToSize(s.safe(monthShort(slot.month, s.language)), colW - 4) as string[] : [monthShort(slot.month)]);
    const height = native ? Math.max(32, sourceLines.length * 12 + 12, Math.max(...monthLines.map(lines => lines.length)) * 10 + (dated ? 21 : 12)) : 32;
    s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F');
    s.font(10, true); s.ink(INK.white);
    s.doc.text(sourceLines, s.margin + 8, s.y + (native ? 16 : 20), { lineHeightFactor: 1.2 });
    axis.forEach((slot, i) => {
      const x = s.margin + labelW + (i + 0.5) * colW;
      s.font(8, true);
      s.doc.text(monthLines[i], x, s.y + 13, { align: 'center', lineHeightFactor: 1.25 });
      if (dated) {
        s.font(6.5);
        s.doc.text(slot.isNow ? copy('NOW') : String(slot.year), x, s.y + (native ? height - 8 : 24), { align: 'center' });
      }
    });
    s.y += height;
  };
  const bandHeading = (band: AvailabilityBand, continued = false) => {
    const title = copy(band.title);
    s.font(10.5, true);
    const lines = native ? s.doc.splitTextToSize(s.safe(continued ? copy('{title} (continued)', { title }) : title), s.contentWidth - 16) as string[] : [s.safe(`${band.title}${continued ? ' (continued)' : ''}`)];
    return { lines, height: native ? Math.max(bandHeaderHeight, 11 + lines.length * 13 + (band.key === 'forest' ? 12 : 0)) : bandHeaderHeight };
  };
  const bandHead = (band: AvailabilityBand, continued = false) => {
    const { lines, height } = bandHeading(band, continued);
    s.fill(mixWithWhite(band.rgb, 0.16));
    s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F');
    s.font(10.5, true); s.ink(INK.text);
    s.doc.text(lines, s.margin + 8, s.y + 16, { lineHeightFactor: 13 / 10.5 });
    if (band.key === 'forest') {
      s.font(7.5); s.ink(INK.green);
      s.doc.text(s.safe(copy('When established')), s.width - s.margin - 8, s.y + (native ? height - 6 : 16), { align: 'right' });
    }
    s.y += height;
  };
  heading(); monthHead();
  const freshPageCapacity = s.bottom - s.y;
  for (const band of resolved.bands) {
    const entries = new Map<string, AvailabilityCell>();
    for (const cell of band.cells) for (const e of cell) entries.set(e.iconKey, e);
    for (const cell of band.planningCells ?? []) for (const e of cell) if (!entries.has(e.iconKey)) entries.set(e.iconKey, e);
    for (const e of band.undated ?? []) if (!entries.has(e.iconKey)) entries.set(e.iconKey, e);
    const rows = [...entries.values()].sort((a, b) => a.label.localeCompare(b.label));
    if (!rows.length) {
      s.font(10);
      const note = copy(band.emptyNote ?? 'No picking months marked yet.');
      const noteLines = s.doc.splitTextToSize(s.safe(note), s.contentWidth) as string[];
      if (!s.fits((native ? bandHeading(band).height + 12 : 36) + noteLines.length * 14 + 10)) { s.page('portrait'); heading(); monthHead(); }
      bandHead(band);
      s.y += 12;
      s.paragraph(note, { size: 10, ink: INK.muted, gap: 10 });
      continue;
    }
    const measuredRows = rows.map(e => {
      const monthsUnknown = !band.cells.some((cell) => cell.some((entry) => entry.iconKey === e.iconKey));
      s.font(10, true);
      const label = s.doc.splitTextToSize(s.safe(e.label), labelW - 39) as string[];
      const planLabel = planningLabel(e);
      s.font(8);
      const planLines = planLabel ? s.doc.splitTextToSize(s.safe(planLabel), labelW - 39) as string[] : [];
      const unknownLines = native && monthsUnknown && !e.planning ? s.doc.splitTextToSize(s.safe(copy('Months to confirm')), labelW - 39) as string[] : ['Months to confirm'];
      const note = e.ageNote ?? copy(band.key === 'animals' ? 'Confirm stock and production dates' : 'Dates to confirm · see plant ages and food sources');
      const noMarks = !band.cells.some(cell => cell.some(entry => entry.iconKey === e.iconKey)) && !band.planningCells?.some(cell => cell.some(entry => entry.iconKey === e.iconKey));
      const noteLines = native && noMarks ? s.doc.splitTextToSize(s.safe(note), s.contentWidth - labelW - 16) as string[] : [s.safe(note)];
      const rowH = Math.max(minimumRowHeight, label.length * 12 + (e.planning ? planLines.length * 10 + 12 : monthsUnknown ? (native ? unknownLines.length * 11 + 14 : 24) : 10), native && noMarks ? noteLines.length * 10 + 12 : 0);
      return {e,monthsUnknown,label,planLines,unknownLines,noteLines,rowH};
    });
    const bandHeight = measuredRows.reduce((height,row) => height + row.rowH, bandHeading(band).height + bandGap);
    // A busy mixed-food calendar left the final fish row alone on a new page. Keep the
    // whole section together when it fits a fresh page; long sections still paginate.
    const required = bandHeight <= freshPageCapacity ? bandHeight : bandHeading(band).height + measuredRows[0].rowH;
    if (!s.fits(required)) { s.page('portrait'); heading(); monthHead(); }
    bandHead(band);
    for (const [rowIndex, {e,monthsUnknown,label,planLines,unknownLines,noteLines,rowH}] of measuredRows.entries()) {
      if (!s.fits(rowH)) { s.page('portrait'); heading(); monthHead(); bandHead(band, true); }
      if (rowIndex % 2 === 0) { s.fill([249, 250, 246]); s.doc.rect(s.margin, s.y, s.contentWidth, rowH, 'F'); }
      if (dated) { s.fill([244, 239, 218]); s.doc.rect(s.margin + labelW, s.y, colW, rowH, 'F'); }
      drawIconOrCode(s, e, s.margin + 5, s.y + (rowH - 24) / 2, 24, input.icons);
      s.font(10, true); s.ink(INK.text);
      s.doc.text(label, s.margin + 34, s.y + 17, { lineHeightFactor: 1.2 });
      if (e.planning) {
        s.font(8); s.ink(INK.brown);
        s.doc.text(planLines, s.margin + 34, s.y + label.length * 12 + 16, { lineHeightFactor: 1.25 });
      } else if (monthsUnknown) {
        s.font(8.5); s.ink(INK.muted);
        s.doc.text(unknownLines, s.margin + 34, s.y + label.length * 12 + 18, { lineHeightFactor: 11 / 8.5 });
      }
      // One outline per contiguous season lets the eye read a span of months. Twelve little
      // dashed boxes made the fruit page look like a collection of unrelated appointments.
      const marks = axis.map((_, i) => band.cells[i].some(entry => entry.iconKey === e.iconKey) ? 'local' : band.planningCells?.[i]?.some(entry => entry.iconKey === e.iconKey) ? 'reference' : '');
      for (let start = 0; start < marks.length;) {
        if (!marks[start]) { start++; continue; }
        let end = start + 1;
        while (end < marks.length && marks[end] === marks[start]) end++;
        const x = s.margin + labelW + start * colW + 2;
        const width = (end - start) * colW - 4;
        const h = Math.min(28, rowH - 8), y = s.y + (rowH - h) / 2;
        const reference = marks[start] === 'reference';
        s.fill(reference ? INK.panelCream : mixWithWhite(band.rgb, 0.24));
        s.stroke(reference ? INK.gold : band.rgb); s.doc.setLineWidth(reference ? 0.85 : 0.45);
        s.doc.setLineDashPattern(reference ? [3, 2] : [], 0);
        s.doc.roundedRect(x, y, width, h, 4, 4, 'FD');
        s.doc.setLineDashPattern([], 0);
        start = end;
      }
      axis.forEach((slot, i) => {
        const x = s.margin + labelW + i * colW;
        if (marks[i]) {
          drawIconOrCode(s, e, x + (colW - icon) / 2, s.y + (rowH - icon) / 2, icon, input.icons);
        }
        // January and the name column provide useful anchors without a wall of vertical grid.
        if (i === 0 || slot.month === 1) {
          s.stroke(INK.hair); s.doc.setLineWidth(slot.month === 1 ? 0.7 : 0.4);
          s.doc.line(x, s.y, x, s.y + rowH);
        }
      });
      if (!marks.some(Boolean)) {
        s.font(8); s.ink(INK.muted);
        s.doc.text(noteLines, s.margin + labelW + 8, s.y + rowH / 2 + 3 - (native ? (noteLines.length - 1) * 5 : 0), { lineHeightFactor: 1.25 });
      }
      s.stroke(INK.hair);
      s.doc.line(s.margin, s.y + rowH, s.width - s.margin, s.y + rowH);
      s.y += rowH;
    }
    s.y += bandGap;
  }
  const calendarNote = copy('Outlined bands are planning references when established; they do not enter food totals or picking jobs. Blank months have no picking window marked. Recorded planting ages keep young plants out of early reference months. Check plant ages and Food sources to check in the app. Gold rows require each crop’s storage conditions; check the full plan or app. Red space figures mean the plan needs more growing space than is mapped.');
  s.font(10);
  const calendarNoteLines = s.doc.splitTextToSize(s.safe(calendarNote), s.contentWidth) as string[];
  s.font(10, true);
  const spaceLines = native ? s.doc.splitTextToSize(s.safe(copy('Growing space used')), labelW - 16) as string[] : ['Growing space used'];
  const spaceHeight = native ? Math.max(44, 12 + spaceLines.length * 12) : 44;
  if (!s.fits(spaceHeight + 12 + calendarNoteLines.length * 14 + 8)) { s.page('portrait'); heading(); monthHead(); }
  s.fill(INK.panelGrey);
  s.doc.rect(s.margin, s.y, s.contentWidth, spaceHeight, 'F');
  s.font(10, true); s.ink(INK.text);
  s.doc.text(spaceLines, s.margin + 8, s.y + (native ? 16 : 20), { lineHeightFactor: 1.2 });
  resolved.utilization.slice(0, 12).forEach((v, i) => {
    const x = s.margin + labelW + i * colW;
    const value = Number.isFinite(v) ? Math.max(0, v) : 0;
    s.font(8, true); s.ink(value > 1.001 ? [179, 58, 58] : INK.text);
    s.doc.text(`${Math.round(value * 100)}%`, x + colW / 2, s.y + 17, { align: 'center' });
    s.fill(INK.hair); s.doc.rect(x + 5, s.y + 25, colW - 10, 6, 'F');
    if (value > 0) { s.fill(value > 1.001 ? [179, 58, 58] : INK.green); s.doc.rect(x + 5, s.y + 25, (colW - 10) * Math.min(1, value), 6, 'F'); }
  });
  s.y += spaceHeight + 12;
  s.paragraph(calendarNote, { size: 10, ink: INK.muted, gap: 8 });

  // The wall copy names unknown sources on the calendar itself. Keep research appendices
  // in the full plan so Calendar & jobs can be pinned up without an eight-page report.
  if (input.availabilityDetails === false) return;

  const undated = includedUndatedSources(input.availability);
  const refs = [...new Map((input.availability?.includeTrees === false ? [] : input.availability?.forestPlanning?.flat() ?? []).filter(e => e.planning).map(e => [e.iconKey, e])).values()];
  const pending = settleOnceRows(input.plantings, now.getFullYear(), nowMonth)
    .filter((p) => p.awaitingSowingConfirmation);
  const storage = [...new Set(input.plantings.map((p) => p.cropKey))].map(cropByKey)
    .filter((c) => c && c.storageMonths && c.storageConditions);
  s.font(9.5);
  const tailHeight = 18 + [planAssuranceText(ASSURANCE_ONE_LINE, s.language), copy(SUCCESSION_TIMING_GUIDANCE)]
    .reduce((height, text) => height + (s.doc.splitTextToSize(s.safe(text), s.contentWidth) as string[]).length * 9.5 * 1.4, 0);
  if (undated.length) {
    s.page('portrait'); masthead(s, 'On your map');
    pageTitle(s, input.meta.planTitle, copy('Food sources to check'),
      copy('These are on your design. Their picking or production months still need checking on site.'));
    for (const [index, e] of undated.entries()) {
      s.font(10.5);
      const lines = s.doc.splitTextToSize(s.safe(e.detail), s.contentWidth - 60) as string[];
      s.font(12, true);
      const titles = native ? s.doc.splitTextToSize(s.safe(e.label), s.contentWidth - 60) as string[] : [s.safe(e.label)];
      const extra = native ? (titles.length - 1) * 15 : 0;
      const h = Math.max(64, 32 + extra + lines.length * 14);
      // Longer native details left the timing caution alone on a headerless page.
      // Keep the last source card with both complete cautions when this is the final section.
      const reserveTail = native && index === undated.length - 1 && !refs.length && !pending.length && !storage.length;
      if (s.need(h + 10 + (reserveTail ? tailHeight : 0))) { masthead(s, 'On your map'); pageTitle(s, input.meta.planTitle, copy('Food sources to check (continued)')); }
      s.fill(INK.panelGreen); s.doc.roundedRect(s.margin, s.y, s.contentWidth, h, 5, 5, 'F');
      drawIconOrCode(s, { ...e, code: fallbackCode(e.label) }, s.margin + 10, s.y + 12, 32, input.icons);
      s.font(12, true); s.ink(INK.green); s.doc.text(titles, s.margin + 52, s.y + 20, { lineHeightFactor: 1.25 });
      s.font(10.5); s.ink(INK.text); s.doc.text(lines, s.margin + 52, s.y + 38 + extra, { lineHeightFactor: 1.33 });
      s.y += h + 10;
    }
  }
  if (refs.length) {
    s.page('portrait'); masthead(s, 'Season references');
    pageTitle(s, input.meta.planTitle, copy('Why these months are marked'), copy('References describe established plants. Confirm local dates; new plants need time to produce.'));
    for (const entry of refs) {
      const lines = [`${entry.label} - ${entry.planning!.label}`, entry.planning!.basis, ...(entry.planning!.source ? [copy('Source: {source}', { source: entry.planning!.source.label })] : [])];
      s.font(9);
      const height = lines.reduce((total, line) => total + (s.doc.splitTextToSize(s.safe(line), s.contentWidth) as string[]).length * 13 + 5, 0);
      if (s.need(height + 12)) { masthead(s, 'Season references'); pageTitle(s, input.meta.planTitle, copy('Season references (continued)')); }
      for (const [index, line] of lines.entries()) s.paragraph(line, { size: 9, bold: index === 0, ink: index === 2 ? INK.teal : INK.text, gap: 5 });
      if (entry.planning!.source) s.doc.link(s.margin, s.y - 18, s.contentWidth, 16, { url: entry.planning!.source.url });
      s.y += 10;
    }
  }
  if (pending.length) {
    const body = [
      copy('These earlier sowings are not confirmed. They are left out of the food calendar and jobs. In the app, confirm what was planted or mark it as skipped.'),
      ...pending.map((p) => copy('{crop} - {bed} - scheduled {date}', { crop: cropByKey(p.cropKey)?.name ?? p.cropKey, bed: input.beds.find((b) => b.id === p.bedId)?.label ?? p.bedId, date: p.once ?? '' })),
    ];
    if (s.need(panelHeight(s, body, true, true) + 12)) masthead(s, 'Sowings to confirm');
    s.y += panel(s, { title: copy('Did these sowings happen?'), body, bg: INK.panelCream, accent: INK.gold }) + 12;
  }
  if (storage.length) {
    s.page('portrait'); masthead(s, 'Keeping food');
    pageTitle(s, input.meta.planTitle, copy('Before using stored food'),
      copy('The storage row applies only when these sourced conditions are met. Check the food before using it.'));
    for (const crop of storage) {
      if (!crop) continue;
      s.font(10.5);
      // The bundled font omitted ≤, turning a maximum moisture into an exact value on paper.
      // Native drafts spell the comparison out; preserve it in legacy English with ASCII.
      const condition = copy(crop.storageConditions ?? '').replace(/≤/g, '<=');
      const lines = s.doc.splitTextToSize(s.safe(condition), s.contentWidth - 26) as string[];
      s.font(12, true);
      const storageTitle = copy('{crop} - sourced storage window: {months} months', { crop: crop.name, months: crop.storageMonths! });
      const titles = native ? s.doc.splitTextToSize(s.safe(storageTitle), s.contentWidth - 26) as string[] : [s.safe(storageTitle)];
      const extra = native ? (titles.length - 1) * 15 : 0;
      const h = 48 + extra + lines.length * 14;
      if (s.need(h + 10)) { masthead(s, 'Keeping food'); pageTitle(s, input.meta.planTitle, copy('Stored food (continued)')); }
      s.fill(INK.panelCream); s.doc.roundedRect(s.margin, s.y, s.contentWidth, h, 5, 5, 'F');
      s.font(12, true); s.ink(INK.brown);
      s.doc.text(titles, s.margin + 12, s.y + 20, { lineHeightFactor: 1.25 });
      s.font(10.5); s.ink(INK.text);
      s.doc.text(lines, s.margin + 12, s.y + 39 + extra, { lineHeightFactor: 1.33 });
      if (crop.storageSourceUrl) {
        s.font(8.5); s.ink(INK.green);
        s.doc.textWithLink(s.safe(copy('Source guide')), s.margin + 12, s.y + h - 9, { url: crop.storageSourceUrl });
      }
      s.y += h + 10;
    }
  }
  // The reference copy carries the full assurance panel on its dashboard. The
  // field copy keeps the shared caution and the accepted plan's own warnings.
  if (native && !s.fits(tailHeight)) {
    s.page('portrait'); masthead(s, 'Picture calendar');
    pageTitle(s, input.meta.planTitle, planAssuranceText(ASSURANCE_TITLE, s.language));
  }
  s.y += 4;
  s.paragraph(planAssuranceText(ASSURANCE_ONE_LINE, s.language), { size: 9.5, ink: INK.muted, gap: 6 });
  s.paragraph(copy(SUCCESSION_TIMING_GUIDANCE), { size: 9.5, ink: INK.muted, gap: 8 });
  if (!(input.sections ?? ALL_SECTIONS).includes('dashboard')) drawPlanNotes(s, input);
}

/** Each stack is a shared authority's series, not quantities inferred by the printer. */
function stackedMonthChart(
  s: Sheet,
  opts: {
    title: string;
    onPage?: () => void;
    labels: string[];
    series: { label: string; values: number[]; ink: readonly number[] }[];
    maxValue: number;
    axis: string;
    height: number;
    labelValues: number[];
    format?: (value: number) => string;
  },
): void {
  const extraLabelHeight = (Math.max(1, ...opts.labels.map(label => label.split('\n').length)) - 1) * 12;
  const native = isNativePdfLanguage(s.language);
  const nativeTitle = native ? nativeChartTitle(s, opts.title, opts.axis) : undefined;
  const legend = native ? nativeChartLegend(s, opts.series) : undefined;
  if (s.need(opts.height + 72 + extraLabelHeight + (nativeTitle?.extra ?? 0) + (legend ? legend.height - 16 : 0))) opts.onPage?.();
  if (nativeTitle) drawNativeChartTitle(s, nativeTitle);
  else {
  s.font(11, true); s.ink(INK.text);
  s.doc.text(s.safe(opts.title), s.margin, s.y);
  const titleW = s.doc.getTextWidth(s.safe(opts.title));
  s.font(7.5); s.ink(INK.faint);
  s.doc.text(s.safe('(' + opts.axis + ')'), s.margin + titleW + 5, s.y);
  }
  s.y += 16 + (nativeTitle?.extra ?? 0);
  if (legend) {
    for (const entry of legend.entries) {
      s.fill(entry.ink); s.doc.rect(entry.x, s.y + entry.y - 6, 8, 8, 'F');
      s.font(7.5); s.ink(INK.muted); s.doc.text(entry.lines, entry.x + 12, s.y + entry.y, { lineHeightFactor: 1.2 });
    }
    s.y += legend.height;
  } else {
  let keyX = s.margin + 30;
  for (const series of opts.series) {
    s.fill(series.ink); s.doc.rect(keyX, s.y - 6, 8, 8, 'F');
    s.font(7.5); s.ink(INK.muted);
    s.doc.text(s.safe(series.label), keyX + 12, s.y);
    keyX += 24 + s.doc.getTextWidth(s.safe(series.label));
  }
  s.y += 16;
  }
  const plotX = s.margin + 30;
  const plotW = s.contentWidth - 30;
  const top = s.y;
  const base = top + opts.height;
  const step = niceStep(Math.max(1, opts.maxValue) / 4);
  const gridlines = Math.max(1, Math.ceil(Math.max(1, opts.maxValue) / step));
  const maximum = step * gridlines;
  s.stroke(INK.hair); s.doc.setLineWidth(0.5);
  for (let i = 0; i <= gridlines; i++) {
    const y = base - opts.height * i / gridlines;
    s.doc.line(plotX, y, plotX + plotW, y);
    s.font(6.5); s.ink(INK.faint);
    s.doc.text(s.safe(String(Number((step * i).toFixed(2)))), plotX - 5, y + 2, { align: 'right' });
  }
  const slot = plotW / opts.labels.length;
  const width = Math.min(slot * 0.62, 26);
  opts.labels.forEach((label, i) => {
    const x = plotX + i * slot + (slot - width) / 2;
    let bottom = base;
    for (const series of opts.series) {
      const product = opts.height * series.values[i];
      const h = Number.isFinite(product) ? product / maximum : opts.height * (series.values[i] / maximum);
      s.fill(series.ink);
      if (h > 0) s.doc.rect(x, bottom - h, width, h, 'F');
      bottom -= h;
    }
    s.font(6.5, true); s.ink(INK.muted);
    const value = opts.labelValues[i];
    if (value > 0) s.doc.text(s.safe((opts.format ?? ((n) => String(n)))(value)), x + width / 2, bottom - 4, { align: 'center' });
    s.font(7); s.ink(INK.muted);
    s.doc.text(s.safe(label), x + width / 2, base + 11, { align: 'center' });
  });
  s.y = base + 26 + extraLabelHeight;
}

function drawAvailabilityGraphs(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const native = isNativePdfLanguage(s.language);
  const copy = (source: string, values?: Record<string, string | number>) => cropExportText(source, s.language, values);
  const preservedRecords = (input.preservedProducts ?? []).filter(record => isVisibleProductionFoodSource(record.sourceIconKey, input.availability ?? {}));
  const resolved = resolveAvailability(input, nowMonth);
  const axis = monthAxisSlots(nowMonth, now.getFullYear(), 12);
  const graph = buildProductionAvailabilityGraphs({
    availability: resolved,
    dates: axis.map(({ year, month }) => ({ year, month })),
    growingAreaM2: totalGrowingAreaM2(input.beds),
    includeTrees: input.availability?.includeTrees, includeAnimals: input.availability?.includeAnimals,
    preservedProducts: input.preservedProducts, productionRecords: input.productionRecords,
  });
  const heading = () => {
    masthead(s, copy('Food and growing space'));
    pageTitle(s, input.meta.planTitle, copy('Fresh food, kept food and space'),
      resolved.yearMode === 'fromToday'
        ? copy('Known food options by month. Counted once per crop or product, not kilograms, portions or meals.')
        : copy('Repeat-year comparison, not a first-year harvest forecast. Preserved stock records use exact dates.'));
  };
  heading();
  const labels = axis.map(slot => monthShort(slot.month, s.language) + '\n' + slot.year);
  const scale = Math.max(1, ...graph.months.map(month => month.totalCount));
  barChart(s, {
    onPage: native ? heading : undefined,
    title: copy('1. Fresh food'), axis: copy('food kinds'), height: 64, maxValue: scale,
    labels, values: graph.months.map(month => month.freshCount), inks: graph.months.map(() => INK.green),
  });
  stackedMonthChart(s, {
    onPage: native ? heading : undefined,
    title: copy('2. Fresh food + kept food'), axis: copy('food kinds'), height: 64, maxValue: scale, labels,
    series: [
      { label: copy('Fresh'), values: graph.months.map(month => month.freshCount), ink: INK.green },
      { label: copy('Planned pantry food'), values: graph.months.map(month => month.storedCount), ink: INK.gold },
      { label: copy('Recorded kept food'), values: graph.months.map(month => month.preservedCount), ink: INK.preserved },
    ],
    labelValues: graph.months.map(month => month.totalCount),
  });
  const areaStep = niceStep(Math.max(1, graph.growingAreaM2) / 4);
  const areaMaximum = areaStep * Math.max(1, Math.ceil(Math.max(1, graph.growingAreaM2) / areaStep));
  s.font(6.5);
  // A finite entered area can still overflow the rounded chart scale or its label column.
  // Keep that source figure in the note below instead of crashing or painting a fake zero.
  const areaCanBeLabelled = Number.isFinite(areaMaximum) && s.doc.getTextWidth(String(Number(areaMaximum.toFixed(2)))) <= 26;
  if (graph.growingAreaM2 > 0 && areaCanBeLabelled) stackedMonthChart(s, {
    onPage: native ? heading : undefined,
    title: copy('3. Used and free crop-growing space'), axis: 'm2', height: 64, maxValue: graph.growingAreaM2, labels,
    series: [
      { label: copy('Used beds / plots'), values: graph.months.map(month => month.growingUsedM2), ink: INK.green },
      { label: copy('Free beds / plots'), values: graph.months.map(month => month.growingFreeM2), ink: INK.rule },
    ],
    labelValues: graph.months.map(month => month.growingUsedM2), format: (value) => numberLabel(value),
  });
  else {
    if (native && s.need(65)) heading();
    s.paragraph(copy('3. Used and free crop-growing space'), { size: 11, bold: true, gap: 8 });
    s.paragraph(copy(graph.growingAreaM2 > 0 ? 'The space graph cannot label the supplied area clearly. Check the mapped area.' : 'No mapped bed or plot area is supplied, so used and free space cannot be shown.'), { size: 8, ink: INK.muted, gap: 10 });
  }
  const note = (text: string) => {
    s.font(8);
    const lines = s.doc.splitTextToSize(s.safe(text), s.contentWidth) as string[];
    if (s.need(lines.length * 11.2 + 5)) heading();
    s.paragraph(text, { size: 8, ink: INK.muted, gap: 5 });
  };
  const spaceNote = () => {
    if (graph.growingAreaM2 > 0) note(copy(areaCanBeLabelled ? 'Space is for {area} m2 of mapped beds and plots only; trees, animal housing and ponds are outside this area. Numbers above space bars show used m2.' : 'Mapped growing area: {area} m2 of beds and plots only; trees, animal housing and ponds are outside this area.', { area: numberLabel(graph.growingAreaM2) }));
    const conflicts = benchmarkAreaConflictDetails(input.plantings, input.beds);
    if (conflicts.length) note(copy('Some beds or plots have overlapping or invalid planting shares. Used space is capped at their mapped area; resolve the layout before relying on this comparison.'));
  };
  if (native) spaceNote();
  note(copy('The two food charts share a scale. A crop present fresh and kept still counts once; kept colours add other food kinds. Dated output records update fresh counts. Research season references and sources without local dates are outside food counts.'));
  note(copy('Pantry storage requires each crop\'s source conditions. Preserved stock is shown only for recorded months; no amount, recipe or safe shelf life is inferred.'));
  if (!graph.preservationRecordsProvided) {
    note(copy('No preservation records supplied. Frozen, dried, fermented and processed food are not inferred from fresh harvest.'));
  } else if (!input.preservedProducts?.length) {
    note(copy('No preserved stock is recorded. This is a record status, not proof that the farm has no stock.'));
  } else if (!preservedRecords.length) {
    note(copy('No kept-stock records are shown for the selected food categories.'));
  } else {
    const methodsNote = copy('Preservation methods recorded: {methods}.', { methods: [...new Set(preservedRecords.map(record => record.method))].map(method => cropPreservedMethodText(method, s.language)).join(', ') });
    if (native) {
      s.font(8);
      const stockHeight = preservedRecords.reduce((height, record) => {
        const text = record.label + ' (' + cropPreservedMethodText(record.method, s.language) + '): ' + record.dates.map(date => monthShort(date.month, s.language) + ' ' + date.year).join(', ') + '. ' + record.note;
        return height + Math.max(28, (s.doc.splitTextToSize(s.safe(text), s.contentWidth - 31) as string[]).length * 11.2 + 4);
      }, (s.doc.splitTextToSize(s.safe(methodsNote), s.contentWidth) as string[]).length * 11.2 + 5);
      // The observed short list left only its fifth private record on a new sheet.
      // Keep a compact list with its method explanation; long lists may still paginate.
      if (stockHeight <= (s.bottom - s.margin) / 2 && s.need(stockHeight)) heading();
    }
    note(methodsNote);
    for (const record of preservedRecords) {
      const recordLine = record.label + ' (' + cropPreservedMethodText(record.method, s.language) + '): ' + record.dates.map(date => monthShort(date.month, s.language) + ' ' + date.year).join(', ') + '. ' + record.note;
      s.font(8);
      const lines = s.doc.splitTextToSize(s.safe(recordLine), s.contentWidth - 31) as string[];
      const height = Math.max(28, lines.length * 11.2 + 4);
      if (s.need(height)) heading();
      drawIconOrCode(s, { iconKey: preservedFoodIconKey(record), code: fallbackCode(record.label) }, s.margin, s.y - 7, 23, input.icons);
      s.font(8); s.ink(INK.muted);
      s.doc.text(lines, s.margin + 31, s.y, { lineHeightFactor: 1.4 });
      s.y += height;
    }
  }
  if (!native) spaceNote();
  s.page('portrait');
  drawProductionKgGraphs(s, input, now, nowMonth);
}


function drawProductionKgGraphs(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const native = isNativePdfLanguage(s.language);
  const copy = (source: string, values?: Record<string, string | number>) => cropExportText(source, s.language, values);
  const resolved = resolveAvailability(input, nowMonth);
  const dates = monthAxisSlots(nowMonth, now.getFullYear(), 12);
  const graph = buildProductionKgGraphs({
    availability: resolved, dates, now,
    growingAreaM2: totalGrowingAreaM2(input.beds),
    includeTrees: input.availability?.includeTrees, includeAnimals: input.availability?.includeAnimals,
    plantings: input.plantings, beds: input.beds,
    productionRecords: input.productionRecords, preservedProducts: input.preservedProducts,
    treeGroups: input.treeGroups, treeSeasons: input.treeSeasons,
  });
  const heading = () => {
    masthead(s, copy('Production weights'));
    pageTitle(s, input.meta.planTitle, copy('Production weights and missing records'),
      copy('Monthly records, crop-cycle benchmarks and food kept in stock are separate measures. Missing quantities are not zero.'));
  };
  heading();
  const note = (text: string) => {
    s.font(8.5);
    const lines = s.doc.splitTextToSize(s.safe(text), s.contentWidth) as string[];
    if (s.need(lines.length * 11.9 + 6)) heading();
    s.paragraph(text, { size: 8.5, ink: INK.muted, gap: 6 });
  };
  const labels = dates.map(date => monthShort(date.month, s.language) + '\n' + date.year);
  if (graph.months.some(month => month.recordedKg !== null)) {
    barChart(s, {
    onPage: native ? heading : undefined,
      title: copy('Monthly kg records'), axis: 'kg', height: 76, labels,
      values: graph.months.map(month => month.recordedKg ?? 0),
      inks: graph.months.map(month => month.expectedKg === null ? INK.green : INK.gold),
      missing: graph.months.map(month => month.recordedKg === null), showZero: true, format: numberLabel,
    });
    note(copy('Green bars contain actual kg records only. Gold bars include expected kg. Actual replaces expected for the same food source and month. These are known subtotals; missing crop, tree and animal quantities stay outside them.'));
  } else {
    note(copy('Monthly production kg are not recorded. The crop-cycle graph below is a planning benchmark; it does not fill in missing monthly harvest weights.'));
  }
  const hasCycles = graph.months.some(month => month.cropCycleKgStartingHarvest !== null);
  if (hasCycles) {
    barChart(s, {
    onPage: native ? heading : undefined,
      title: copy('Crop-cycle kg by first picking month'), axis: copy('full-cycle kg'), height: 76, labels,
      values: graph.months.map(month => month.cropCycleKgStartingHarvest ?? 0),
      inks: graph.months.map(() => INK.green),
      missing: graph.months.map(month => month.cropCycleMissingSources.length > 0 && month.cropCycleKgStartingHarvest === null),
      format: numberLabel,
    });
    note(copy('Each bar groups the entire crop-cycle benchmark by the month picking starts. It is not the weight harvested in that month. The source does not supply a monthly picking curve; quantities are not divided across a picking window.'));
  } else note(copy('No crop-cycle kg comparison is available for cycles starting harvest in this dated year. Check planting dates, growing space and sourced crop benchmarks.'));
  const cropMissing = graph.unquantifiedCropSources.map(source => source.label);
  if (cropMissing.length) note(copy('Crop quantities outside the known cycle subtotal: {crops}.', { crops: cropMissing.join(', ') }));

  const hasMonthlyQuantities = graph.months.some(month => Object.values(month.nativeUnits).some(value => value !== null) || month.stockKg !== null);
  // A table containing only question marks pushed the missing-record notes onto
  // an almost empty sheet. Preserve the dated table as soon as any quantity is
  // entered, including zero; an unrecorded plan can state its coverage directly.
  if (hasMonthlyQuantities) {
    if (!native) {
      if (s.need(70)) heading();
      s.paragraph(copy('Monthly quantities in their own units'), { size: 10, bold: true, ink: INK.green, gap: 6 });
    }
    const quantity = (value: number | null) => value === null ? '?' : numberLabel(value);
    const hasItems = graph.months.some(month => month.nativeUnits.items !== null);
    table(s, [
    { key: 'month', header: 'Month', width: 82 },
    { key: 'actual', header: copy('Actual kg'), width: 76, align: 'right' },
    { key: 'expected', header: copy('Expected kg'), width: 82, align: 'right' },
    { key: 'eggs', header: copy('Eggs'), width: 68, align: 'right' },
    { key: 'milk', header: copy('Litres'), width: 68, align: 'right' },
    ...(hasItems ? [{ key: 'items', header: copy('Items'), width: 68, align: 'right' as const }] : []),
    { key: 'stock', header: copy('Stock kg'), width: 80, align: 'right' },
    ], graph.months.map(month => ({
    month: monthShort(month.month, s.language) + ' ' + month.year,
    actual: quantity(month.actualKg), expected: quantity(month.expectedKg),
    eggs: quantity(month.nativeUnits.eggs), milk: quantity(month.nativeUnits.litres),
    items: quantity(month.nativeUnits.items), stock: quantity(month.stockKg) + (month.stockKgPartial && month.stockKg !== null ? ' *' : ''),
    })), { band: copy('Production weights'), title: copy('Monthly quantities in their own units'), size: 8, keepTogether: native, onPage: native ? heading : undefined });
    s.y += 10;
  } else note(copy('No monthly quantities are recorded for this dated year in kg, eggs, litres, items or kept-stock kg. Enter expected or actual amounts in the app; the printed monthly table appears once a quantity is recorded, including zero.'));
  note(copy('? means quantity not recorded, not zero. * marks a known stock subtotal with missing batch weights. Egg counts and litres use actual records where entered, otherwise expected records. They are never converted to kg. Stock kg are food already held; they are never added to new production.'));

  const unique = (entries: AvailabilityEntry[]) => [...new Map(entries.map(entry => [entry.iconKey, entry])).values()];
  const missing = unique(graph.months.flatMap(month => month.unrecordedSources));
  if (missing.length) note(copy('Monthly quantities still needed: {sources}. Research season references do not establish a harvest weight.', { sources: missing.map(source => source.label).join(', ') }));
  if (graph.undatedSources.length) note(copy('Food sources with no dated quantity: {sources}.', { sources: graph.undatedSources.map(source => source.label).join(', ') }));
  const stockMissing = unique(graph.months.flatMap(month => month.stockKgMissingSources));
  if (stockMissing.length) note(copy('Kept food without recorded stock kg: {sources}. Catalogue pantry windows and preservation months supply no stock weight.', { sources: stockMissing.map(source => source.label).join(', ') }));
  for (const year of graph.annualTreeEstimates) {
    if (!year.trees.length) continue;
    const missingTrees = year.trees.filter(tree => tree.kg === null).map(tree => tree.name);
    if (missingTrees.length) note(copy('Annual tree yield schedules are incomplete for {period}: {trees}. {subtotal}', { period: cropProjectionPeriodText(year.label, s.language), trees: missingTrees.join(', '), subtotal: year.trees.some(tree => tree.kg !== null) ? copy('Known annual subtotal: {kg}; unknown yields are excluded.', { kg: copy(projectedKgLabel(year.knownKg)) }) : copy('No annual tree kg subtotal is known.') }));
    else note(copy('Annual tree yield schedules for {period}: {kg}.', { period: cropProjectionPeriodText(year.label, s.language), kg: copy(projectedKgLabel(year.knownKg)) }));
    note(copy('Tree kg by age are annual farm assumptions. They are shown in the future harvest pages and are not spread across monthly production bars.'));
  }
  for (const issue of graph.recordIssues) note(cropProductionIssueText(issue, s.language));
}

function drawProductionProjection(s: Sheet, input: CropPlanPdfInput): void {
  const projection = input.productionProjection!;
  const native = isNativePdfLanguage(s.language);
  const copy = (source: string, values?: Record<string, string | number>) => cropExportText(source, s.language, values);
  const quantity = (kg: Parameters<typeof projectedKgLabel>[0]) => {
    // The old rounding step turned a finite entered amount into a dash at MAX_VALUE.
    // Preserve that exact source value in scientific notation, without changing ordinary labels.
    if (kg?.every(value => Number.isFinite(value) && value >= 0) && kg.some(value => value > Number.MAX_VALUE / 10)) {
      const values = kg.map(value => value > Number.MAX_VALUE / 10 ? String(value) : projectedKgLabel([value, value]).replace(/ kg$/, ''));
      return `${values[0] === values[1] ? values[0] : values.join('–')} kg`;
    }
    return copy(projectedKgLabel(kg));
  };
  const knownSourceNotes = new Set(Object.values(PERENNIAL_HARVEST).flatMap(entry => [entry.yearsToFirstCrop?.note, entry.yearsToFullBearing?.note]).filter((note): note is string => note !== undefined));
  const sourceNote = (source: string) => !native ? source : knownSourceNotes.has(source)
    ? productGuideText(source, s.language) : copy('Original source note: {note}', { note: source });
  const head = () => { masthead(s, copy('Production over time')); pageTitle(s, input.meta.planTitle, copy('As your plants grow'), copy('Vegetables and staples alongside fruit, nuts and berries. Ten-year projection; not a harvest promise.')); };
  head();
  const maximum = Math.max(1, ...projection.years.map(y => y.combinedKg?.[1] ?? y.treeKg[1]));
  const canDrawValues = Number.isFinite(maximum);
  if (!canDrawValues) s.paragraph(copy('The supplied production values cannot be drawn clearly. Check the recorded quantities.'), { size: 9, ink: INK.muted, gap: 8 });
  s.paragraph(copy('Green = vegetable and staple crop cycles. Gold = your tree yield schedule. Striped ends show harvest that changes as plants age during the year. * = known subtotal only; missing yields are not zero.'), { size: 9, ink: INK.muted, gap: 12 });
  for (const year of projection.years) {
    if (s.need(44)) head();
    s.font(9, true); s.ink(INK.text); s.doc.text(s.safe(cropProjectionPeriodText(year.label, s.language)), s.margin, s.y + 12);
    s.doc.text(s.safe(`${quantity(year.combinedKg)}${year.partial ? ' *' : ''}`), s.width - s.margin, s.y + 12, { align: 'right' });
    if (canDrawValues) {
      const x = s.margin, w = s.contentWidth, y = s.y + 20;
      s.fill(INK.hair); s.doc.roundedRect(x, y, w, 9, 3, 3, 'F');
      // Ratio-first scaling is needed only when multiplying the finite source value overflows.
      const scaled = (value: number) => Number.isFinite(w * value) ? w * value / maximum : w * (value / maximum);
      const veg = scaled(year.vegetableKg ?? 0);
      const tree = scaled(year.treeKg[0]), changing = scaled(year.treeKg[1] - year.treeKg[0]);
      if (veg > 0) { s.fill(INK.green); s.doc.rect(x, y, veg, 9, 'F'); }
      if (tree > 0) { s.fill(INK.gold); s.doc.rect(x + veg, y, tree, 9, 'F'); }
      if (changing > 0) {
        const left = x + veg + tree, right = left + changing;
        s.fill(mixWithWhite(INK.gold, 0.3)); s.doc.rect(left, y, changing, 9, 'F');
        s.stroke(INK.gold); s.doc.setLineWidth(0.6);
        // Clip each diagonal mathematically to its tail, without changing the PDF drawing state.
        for (let base = left - 9; base < right; base += 5) {
          const from = Math.max(left, base), to = Math.min(right, base + 9);
          if (to > from) s.doc.line(from, y + 9 - (from - base), to, y + 9 - (to - base));
        }
      }
    }
    s.y += 40;
  }
  s.y += 12;
  s.font(9);
  const assumptions = projection.assumptions.map(note => cropProjectionDetailText(note, s.language));
  const assumptionsHeight = assumptions.reduce((height, note) => height + (s.doc.splitTextToSize(s.safe(note), s.contentWidth) as string[]).length * 9 * 1.4 + 8, 0);
  if (!s.fits(assumptionsHeight)) {
    s.page('portrait'); masthead(s, copy('Projection assumptions'));
    pageTitle(s, input.meta.planTitle, copy('What this forecast assumes'));
  }
  for (const assumption of assumptions) {
    if (native) {
      s.font(9);
      if (s.need((s.doc.splitTextToSize(s.safe(assumption), s.contentWidth) as string[]).length * 12.6 + 8)) {
        masthead(s, copy('Projection assumptions')); pageTitle(s, input.meta.planTitle, copy('What this forecast assumes'));
      }
    }
    s.paragraph(assumption, { size: 9, ink: INK.muted, gap: 8 });
  }
  if (!projection.years[0]?.trees.length) return;
  s.page('landscape');
  const tableHead = () => {
    masthead(s, copy('Plant ages & harvest'));
    pageTitle(s, input.meta.planTitle, copy('Fruit, nuts and berries by age'), copy('Each column covers twelve months. Species total = all mapped plants. Group rows give kg for that age group. ? = missing information.'));
    s.font(8, true);
    const plantHead = native ? s.doc.splitTextToSize(s.safe(copy('PLANT / AGE GROUPS')), 134) as string[] : [copy('PLANT / AGE GROUPS')];
    const width = (s.contentWidth - 150) / projection.years.length;
    const yearHeads = projection.years.map(year => s.safe(cropProjectionPeriodText(year.label, s.language).split(' – ')[0]));
    const yearLines = yearHeads.map(label => native ? s.doc.splitTextToSize(label, width - 6) as string[] : [label]);
    const height = native ? Math.max(30, Math.max(plantHead.length, ...yearLines.map(lines => lines.length)) * 9.6 + 12) : 30;
    s.fill(INK.green); s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F'); s.font(8, true); s.ink(INK.white);
    s.doc.text(plantHead.length === 1 ? plantHead[0] : plantHead, s.margin + 8, s.y + (native ? 13 : 19), { lineHeightFactor: 1.2 });
    yearLines.forEach((lines, i) => s.doc.text(lines.length === 1 ? lines[0] : lines, s.margin + 150 + (i + 0.5) * width, s.y + (native ? 13 : 19), { align: 'center', lineHeightFactor: 1.2 }));
    s.y += height;
  };
  tableHead();
  const date = input.now ?? new Date();
  const nowIndex = date.getFullYear() * 12 + date.getMonth();
  let rowIndex = 0;
  const drawAgeRow = (name: string, count: string, speciesId: string, periods: AgeProjection[], total: boolean) => {
    const width = (s.contentWidth - 150) / projection.years.length;
    s.font(7.5);
    const cells = periods.map(t => s.doc.splitTextToSize(s.safe(`${total ? copy('Species total') : cropProjectionAgeText(t.ages, s.language)}
${t.kg ? quantity(t.kg) : t.knownKg[1] > 0 ? `${quantity(t.knownKg)} *` : '? kg'}`), width - 6) as string[]);
    s.font(9, true);
    const names = s.doc.splitTextToSize(s.safe(name), 111) as string[];
    s.font(7.5);
    const countLines = native ? s.doc.splitTextToSize(s.safe(count), 111) as string[] : [s.safe(count)];
    const height = Math.max(46, names.length * 11 + 24 + (countLines.length - 1) * 10, ...cells.map(c => c.length * 10 + 12));
    if (!s.fits(height)) { s.page('landscape'); tableHead(); }
    if (total || rowIndex % 2 === 0) { s.fill(total ? INK.panelGreen : INK.panelGrey); s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F'); }
    drawIconOrCode(s, { iconKey: `tree:${speciesId}`, code: fallbackCode(name) }, s.margin + 4, s.y + 8, 26, input.icons);
    s.font(9, true); s.ink(INK.text); s.doc.text(names, s.margin + 35, s.y + 15, { lineHeightFactor: 1.22 });
    s.font(7.5); s.ink(INK.muted); s.doc.text(countLines.length === 1 ? countLines[0] : countLines, s.margin + 35, s.y + height - 10 - (countLines.length - 1) * 10, { lineHeightFactor: 1.33 });
    cells.forEach((cell, i) => { s.font(7.5); s.ink(INK.text); s.doc.text(cell, s.margin + 150 + (i + 0.5) * width, s.y + 15, { align: 'center', lineHeightFactor: 1.33 }); });
    s.stroke(INK.hair); s.doc.line(s.margin, s.y + height, s.width - s.margin, s.y + height);
    s.y += height; rowIndex++;
  };
  for (const [treeIndex, tree] of projection.years[0].trees.entries()) {
    const group = input.treeGroups?.find(g => g.harvest.speciesId === tree.speciesId);
    const choice = input.treeSeasons?.[tree.speciesId];
    const cohorts = choice?.production ?? [];
    const completeSingle = group && cohorts.length === 1 && Number.isSafeInteger(cohorts[0].plants) && cohorts[0].plants > 0
      && cohorts[0].plants === group[cohorts[0].status] && group[cohorts[0].status === 'existing' ? 'proposed' : 'existing'] === 0;
    if (completeSingle) {
      // When every mapped plant has the same age, its cohort is also the species total.
      // Printing the identical number twice made a small farmer's plan unnecessarily long.
      const cohort = cohorts[0];
      drawAgeRow(tree.name, copy(`{count} ${cohort.status === 'existing' ? 'planted' : 'planned'} ${tree.plants === 1 ? 'plant' : 'plants'}`, { count: tree.plants }), tree.speciesId, projection.years.map(y => y.trees[treeIndex]), false);
      continue;
    }
    if (cohorts.length > 0 && cohorts.length <= 3 && !s.fits((cohorts.length + 1) * 46)) { s.page('landscape'); tableHead(); }
    drawAgeRow(tree.name, copy(`{count} ${tree.plants === 1 ? 'plant' : 'plants'} on map`, { count: tree.plants }), tree.speciesId, projection.years.map(y => y.trees[treeIndex]), true);
    if (!group) continue;
    const unsafeCounts = cohorts.some(c => !Number.isSafeInteger(c.plants) || c.plants < 1)
      || (['existing', 'proposed'] as const).some(status => cohorts.filter(c => c.status === status).reduce((sum, c) => sum + c.plants, 0) > group[status]);
    for (const [index, cohort] of cohorts.entries()) {
      // A cohort owns its own row: joining sixty ages in each narrow year cell printed
      // through the footer. Reuse the same arithmetic rather than inventing a print forecast.
      const single = { ...group, existing: cohort.status === 'existing' ? cohort.plants : 0, proposed: cohort.status === 'proposed' ? cohort.plants : 0 };
      const periods = projection.years.map((_, year) => {
        const start = nowIndex + year * 12;
        const period = treeAgeProjection(single, { ...choice!, production: [cohort] }, start, start + 11, nowIndex);
        return unsafeCounts ? { ...period, kg: null, knownKg: [0, 0] as [number, number] } : period;
      });
      drawAgeRow(copy('{name} - group {number}', { name: tree.name, number: index + 1 }), copy(`{count} ${cohort.status === 'existing' ? 'planted' : 'planned'} ${cohort.plants === 1 ? 'plant' : 'plants'}`, { count: numberLabel(cohort.plants) }), tree.speciesId, periods, false);
    }
  }
  s.y += 14;
  for (const tree of projection.years[0].trees.filter(t => t.missing.length)) s.paragraph(`${tree.name}: ${tree.missing.map(message => cropProjectionDetailText(message, s.language)).join('; ')}`, { size: 8.5, ink: INK.muted, gap: 6 });
  const recordedGroups = (input.treeGroups ?? []).filter(g => input.treeSeasons?.[g.harvest.speciesId]?.production?.length);
  if (!recordedGroups.length) return;
  s.page('portrait');
  const notesHead = () => { masthead(s, copy('Age assumptions')); pageTitle(s, input.meta.planTitle, copy('Plant ages: assumptions and sources'), copy('Farm yield schedules are entered assumptions. Research first-crop ages are references to check locally.')); };
  notesHead();
  const ageNote = (text: string, gap = 6, reserveAfter = 0) => {
    s.font(8.5);
    const lines = s.doc.splitTextToSize(s.safe(text), s.contentWidth) as string[];
    const height = lines.length * 8.5 * 1.4 + gap + reserveAfter;
    // The Ve stress PDF broke a publication title around a repeated page header.
    // Compact source paragraphs and their link must travel together.
    if (native && height <= s.bottom - s.margin - 150 && s.need(height)) notesHead();
    for (const [index, line] of lines.entries()) {
      if (s.need(8.5 * 1.4 + (index === lines.length - 1 ? gap + reserveAfter : 4))) notesHead();
      s.text(line, s.margin, { size: 8.5, ink: INK.muted }); s.y += 8.5 * 1.4;
    }
    s.y += gap;
  };
  for (const group of recordedGroups) {
    const choice = input.treeSeasons?.[group.harvest.speciesId];
    for (const age of choice?.production ?? []) {
      const values = { name: group.harvest.name, plants: age.plants, status: copy(age.status), unit: copy(age.plants === 1 ? 'plant' : 'plants'), planted: age.planted || copy('date not recorded') };
      const points = age.yields.filter(p => Number.isFinite(p.age) && Number.isFinite(p.kg)).map(p => copy('age {age}: {kg} kg/plant/year', { age: p.age, kg: p.kg }));
      if (native && points.length) {
        // A repeated page heading used to separate a checkpoint's age from its kg/year.
        // Keep complete entered points in order, with the farm/date prefix beside the first.
        ageNote(copy('{name}: {plants} {status} {unit}, planted {planted}. Farm schedule:', values), 0, 16);
        points.forEach((point, index) => ageNote(point + (index === points.length - 1 ? '.' : ';'), index === points.length - 1 ? 6 : 2));
      } else ageNote(copy('{name}: {plants} {status} {unit}, planted {planted}. Farm schedule: {schedule}.', { ...values, schedule: points.join('; ') || copy('not entered') }));
    }
    if (choice?.production?.length && group.harvest.yearsToFirstCrop) {
      const source = group.harvest.yearsToFirstCrop;
      ageNote(copy('{name}: first-crop reference {age} after planting. {note} {source}.', {
        name: group.harvest.name, age: firstCropAgeLabel(source.value, (age, unit) => productGuideText(`{age} ${unit}`, s.language, { age })),
        note: source.note != null ? sourceNote(source.note) : copy('Check cultivar, starting stock and source conditions.'), source: `${source.source.doc}${source.source.page ? `, p. ${source.source.page}` : ''}`,
      }), 6, 16);
      s.font(8.5); s.ink(INK.green); s.doc.textWithLink(copy('First-crop source'), s.margin, s.y, { url: source.source.url }); s.y += 16;
    }
    if (choice?.production?.length && group.harvest.yearsToFullBearing) {
      const source = group.harvest.yearsToFullBearing;
      ageNote(copy('{name}: established production reference {range} years. {note} {source}.', {
        name: group.harvest.name, range: formatRange(source.value), note: source.note != null ? sourceNote(source.note) : copy('Check cultivar, starting stock and source conditions.'), source: `${source.source.doc}${source.source.page ? `, p. ${source.source.page}` : ''}`,
      }), 6, 16);
      s.font(8.5); s.ink(INK.green); s.doc.textWithLink(copy('Established-production source'), s.margin, s.y, { url: source.source.url }); s.y += 16;
    }
  }
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
  const copy = (source: string) => cropExportText(source, s.language);
  masthead(s, 'Task summary');
  // No standfirst, for the same reason drawCalendar has none: the whole
  // point of this page is fitting the year on one sheet, and an
  // introduction is exactly the two or three lines that would cost it.
  pageTitle(s, copy('Task summary'), copy('Tasks by month'));

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
      ...(taskMonths.find((m) => m.monthsAway === monthsAway)?.tasks.map(task => taskPhrase(task, s.language)) ?? []),
      ...picking[monthsAway].map(line => treePickingPhrase(line, s.language)),
    ],
  })).filter((m) => m.lines.length > 0);

  if (!months.length) {
    s.paragraph(copy('No plantings yet, so there is nothing to print here.'), { size: 9.5, ink: INK.muted });
    return;
  }
  if (picking.some((slot) => slot.length > 0)) {
    s.paragraph(copy('"Pick" lines use locally confirmed months for established, productive trees.'), { size: 7.5, ink: INK.muted });
  }

  s.font(7.5, true);
  const monthColW = isNativePdfLanguage(s.language) ? Math.max(34, ...months.map(group => s.doc.getTextWidth(s.safe(monthShort(group.month, s.language))) + 12)) : 34;
  const textColW = s.contentWidth - monthColW;

  const continued = () => {
    masthead(s, 'Task summary');
    s.font(11, true);
    s.ink(INK.text);
    s.doc.text(s.safe(copy('Tasks by month (continued)')), s.margin, s.y);
    s.y += 16;
  };

  for (const group of months) {
    let first = true;
    for (const phrase of group.lines) {
      s.font(7.5);
      const lines = s.doc.splitTextToSize(s.safe(phrase), textColW) as string[];
      const rowH = Math.max(11, lines.length * 10.5);
      if (s.need(rowH + (first ? 4 : 0))) { continued(); first = true; }

      if (first) {
        s.y += 4;
        s.stroke(INK.hair);
        s.doc.setLineWidth(0.4);
        s.doc.line(s.margin, s.y - 2, s.margin + s.contentWidth, s.y - 2);
        s.font(7.5, true);
        s.ink(INK.green);
        s.doc.text(s.safe(monthShort(group.month, s.language)), s.margin, s.y + 7);
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
  opts: { band?: string; title?: string; groupKey?: string; size?: number; keepTogether?: boolean; onPage?: () => void } = {},
): void {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  const scale = s.contentWidth / totalW;
  const widths = columns.map((c) => c.width * scale);
  const native = isNativePdfLanguage(s.language);
  const size = opts.size ?? 8;
  const leading = size * 1.32;
  const headSize = Math.max(7.5, size - 0.5);
  s.font(headSize, true);
  // Only authored column headings are localized here. Row values arrive presentation-ready.
  const headers = columns.map((column, index) => native
    ? s.doc.splitTextToSize(s.safe(cropExportText(column.header, s.language)), widths[index] - 16) as string[]
    : [s.safe(column.header)]);
  const headH = native ? Math.max(22, Math.max(...headers.map(lines => lines.length)) * headSize * 1.2 + 12) : 22;
  const repeatTitle = () => {
    if (opts.band) masthead(s, opts.band);
    if (opts.title) {
      s.font(11, true); s.ink(INK.text);
      const title = cropExportText('{title} (continued)', s.language, { title: cropExportText(opts.title, s.language) });
      const lines = native ? s.doc.splitTextToSize(s.safe(title), s.contentWidth) as string[] : [s.safe(title)];
      s.doc.text(lines.length === 1 ? lines[0] : lines, s.margin, s.y, { lineHeightFactor: 1.2 });
      s.y += 14 + (lines.length - 1) * 13.2;
    }
  };

  const drawHead = () => {
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, headH, 'F');
    s.font(headSize, true);
    s.ink(INK.white);
    let x = s.margin;
    columns.forEach((c, i) => {
      const tx = c.align === 'right' ? x + widths[i] - 8 : x + 8;
      s.doc.text(headers[i].length === 1 ? headers[i][0] : headers[i], tx, s.y + 13, { align: c.align === 'right' ? 'right' : 'left', lineHeightFactor: 1.2 });
      x += widths[i];
    });
    s.y += headH;
  };

  if (native && opts.keepTogether && !opts.groupKey) {
    s.font(size);
    const bodyHeight = rows.reduce((height, row) => height + Math.max(18, Math.max(...columns.map((column, i) => (s.doc.splitTextToSize(s.safe(row[column.key] ?? ''), widths[i] - 16) as string[]).length)) * leading + 12), 0);
    s.font(10, true);
    const titleHeight = opts.title ? (s.doc.splitTextToSize(s.safe(opts.title), s.contentWidth) as string[]).length * 14 + 6 : 0;
    if (s.need(headH + bodyHeight + titleHeight + 24)) opts.onPage?.();
    if (opts.title) s.paragraph(opts.title, { size: 10, bold: true, ink: INK.green, gap: 6 });
  }

  if (native && rows.length) {
    const firstH = Math.max(...columns.map((column, i) => {
      s.font(size, opts.groupKey !== undefined && i === 0);
      return (s.doc.splitTextToSize(s.safe(rows[0][column.key] ?? ''), widths[i] - 16) as string[]).length * leading + 12;
    }), 18);
    if (s.need(headH + firstH + 24)) repeatTitle();
  }
  drawHead();
  let zebra = false;
  let lastGroup: string | undefined;

  for (const row of rows) {
    // A bold group label can need more lines than the normal font. Measure the
    // exact text and font that will be painted, then reuse those lines below.
    const prepare = () => {
      const groupStart = opts.groupKey !== undefined && row[opts.groupKey] !== lastGroup;
      const lines = columns.map((c, i) => {
        s.font(size, groupStart && i === 0);
        const shown = opts.groupKey !== undefined && i === 0 && !groupStart ? '' : row[c.key] ?? '';
        return s.doc.splitTextToSize(s.safe(shown), widths[i] - 16) as string[];
      });
      return { groupStart, lines, height: Math.max(18, Math.max(...lines.map(cell => cell.length)) * leading + 12) };
    };
    let prepared = prepare();

    if (s.need(prepared.height + 24)) {
      repeatTitle();
      drawHead();
      lastGroup = undefined;
      // A continuation repeats its area label, so its height must include that label.
      prepared = prepare();
    }

    const { groupStart, lines, height: rowH } = prepared;
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
      const tx = c.align === 'right' ? x + widths[i] - 8 : x + 8;
      s.doc.text(lines[i], tx, s.y + 14, { align: c.align === 'right' ? 'right' : 'left', lineHeightFactor: 1.32 });
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
  const copy = (source: string, values: Record<string, string | number> = {}) => cropExportText(source, s.language, values);
  masthead(s, 'Full plan');
  pageTitle(s, copy('Full plan'), copy('Bed-by-bed plan'),
    copy('Each line is one planting. Yield is a conservative benchmark comparison where a verified kg/m² entry exists; "Not verified" is never treated as 0kg.'));

  const mildFrostSite = input.meta.rainPattern === 'mild-frost';
  const rows = buildPlanTableRows(input.plantings, input.beds, mildFrostSite, s.language).map((r) => ({
    area: r.area,
    // A one-time starter has to say so on its own line. Without it the sheet a
    // farmer carries into the field reads a first-season bridge sowing as a
    // standing annual crop. The cell wraps rather than truncating, so the row
    // simply grows to fit.
    crop: r.once ? copy('{crop} (first season only)', { crop: r.crop }) : r.crop,
    share: r.share,
    establish: r.establish,
    field: r.intoField,
    // A caveat is a WARNING, not a sourced frost date — appended onto the harvest
    // cell (which auto-wraps) rather than given its own column.
    harvest: r.frostCaveat ? `${r.harvest} — ${r.frostCaveat}` : r.harvest,
    yield: r.awaitingSowingConfirmation ? copy('Confirm sowing') : benchmarkYieldLabel(r.yieldKg, s.language),
    group: r.area,
  }));

  const columns: Column[] = [
    { key: 'area', header: 'Area', width: 70 },
    { key: 'crop', header: 'Crop', width: 130 },
    { key: 'share', header: 'Space', width: 46 },
    { key: 'establish', header: 'Establish', width: 90 },
    { key: 'field', header: 'Into field', width: 90 },
    { key: 'harvest', header: 'Harvest', width: 76 },
    { key: 'yield', header: 'Benchmark', width: 58, align: 'right' },
  ];
  const tableSize = 8;
  if (isNativePdfLanguage(s.language)) {
    s.font(tableSize);
    const valueWordWidth = Math.max(...['Not verified', 'No food yield', 'Confirm sowing']
      .flatMap(source => copy(source).split(/\s+/)).map(word => s.doc.getTextWidth(s.safe(word))));
    s.font(Math.max(7.5, tableSize - 0.5), true);
    const headingWordWidth = Math.max(...copy('Benchmark').split(/\s+/).map(word => s.doc.getTextWidth(s.safe(word))));
    const physicalWidth = Math.max(valueWordWidth, headingWordWidth) + 18;
    const otherWeights = columns.slice(0, -1).reduce((sum, column) => sum + column.width, 0);
    // A final letter on its own made the unknown-yield label harder to read.
    // Reserve complete label words without changing the yield or shortening its warning.
    columns.at(-1)!.width = Math.max(columns.at(-1)!.width, physicalWidth * otherWeights / (s.contentWidth - physicalWidth));
  }
  table(s, columns, rows, { band: 'Full plan', title: 'Bed-by-bed plan', groupKey: 'group', size: tableSize });
}

function drawBuying(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const copy = (source: string, values?: Record<string, string | number>) => cropExportText(source, s.language, values);
  masthead(s, 'Inputs');
  pageTitle(s, copy('Inputs'), copy('Seed and seedling buying schedule'),
    copy('Find the month, then the crop and bed. Check the seed quantity and sowing method before buying.'));

  const h = panel(s, {
    title: copy('The buying rule'),
    accent: INK.gold,
    bg: INK.panelCream,
    body: [
      copy('Source direct-sown or tray seed before the named sowing month; the source does not provide a universal procurement lead time. Ready-grown seedlings are listed at the start of the field-readiness window; buy them only when the bed and seedlings are ready. Living corms, slips, cloves and seed potatoes are listed close to planting. For a tray crop, choose either packet seed for the nursery or ready-grown seedlings - not both.'),
      copy("A published field seed rate gives a weight range for the mapped area. Confirm the sowing method with the supplier; no germination or loss allowance is added. For crops without a published seed rate, field spacing supports only an approximate FINAL stand. It does not prove a seed-buying quantity: use the packet's crop-specific sowing rate and germination guidance. Living-material ranges are approximate field positions from mapped area and published spacing, not guaranteed order quantities or loss allowances; supplier and crop-specific guidance may change what to purchase."),
    ],
  });
  s.y += h + 14;

  const schedule = buildBuyingSchedule(input.plantings, input.beds, nowMonth, s.language);
  const rows: Record<string, string>[] = [];
  for (const month of schedule) {
    for (const item of month.items) {
      rows.push({
        buy: monthYearLabel(month.month, now, s.language),
        crop: item.cropName,
        qty: item.quantityStatus === 'sourced-weight-range' && item.countRange
          ? weightRangeLabel(item.countRange, s.language)
          : item.quantityStatus === 'spacing-confirmation-required'
          ? copy('Confirm spacing first')
          : item.quantityStatus === 'packet-rate-required'
            ? copy('Packet rate needed')
            : item.quantityStatus === 'counted-piece-range' && item.countRange
              ? copy('~{positions} {unit} positions', { positions: positionRangeLabel(item.countRange), unit: copy(item.unit) })
              : item.count === null
                ? copy('Confirm quantity')
                : copy('~{positions} {unit} positions', { positions: numberLabel(item.count), unit: copy(item.unit) }),
        method: item.quantityStatus === 'sourced-weight-range'
          ? copy('Published field seed rate; confirm sowing method')
          : item.quantityStatus === 'spacing-confirmation-required'
          ? copy('Local row layout needed')
          : !item.transplant && item.unit !== 'seeds'
          ? copy('Living pieces; confirm loss allowance')
          : item.transplant ? copy('Ready seedlings; own seed before {month} nursery', { month: monthShort(item.sowMonth, s.language) }) : copy('Direct sow; ~{positions} final positions', { positions: positionRangeLabel(item.finalPlantPositionsRange) }),
        forWhat: compactPlaces(item.bedLabels, s.language),
        when: item.transplant
          ? copy('Source own seed before {sow}; nursery {nursery}; check/transplant {first}-{last}', { sow: monthShort(item.sowMonth, s.language), nursery: monthShort(item.sowMonth, s.language), first: monthShort(item.bedMonth, s.language), last: monthShort(item.bedMonthLatest, s.language) })
          : copy('Sow {month}', { month: monthShort(item.sowMonth, s.language) }),
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
    const body = [copy('Published field rate: {rate} kg/ha. The buying range uses the mapped area; no germination allowance is added.', { rate: positionRangeLabel(crop.seedRateKgPerHaRange) }), copy(crop.fieldSpacingInstruction ?? crop.note)];
    if (s.need(panelHeight(s, body, true, true) + 12)) masthead(s, 'Seed-rate checks');
    s.y += panel(s, { title: copy('{crop} - check the sowing method', { crop: crop.name }), body, bg: INK.panelCream, accent: INK.gold }) + 12;
  }
}

// ── Farm observations and choices ──────────────────────────────────────────

/** Long cultivar references must travel onto readable continuation pages. Repeating the
 * item as well as the page title keeps a source on page two attached to the crop it supports. */
function drawProductionGuidance(s: Sheet, input: CropPlanPdfInput): void {
  let group = '';
  let item = '';
  const drawHead = (continued = false) => {
    masthead(s, 'Production guidance');
    pageTitle(s, input.meta.planTitle, continued ? 'Farm choices - continued' : 'Before you buy or start',
      'Use your farm observations and the research shortlists. Confirm choices locally before buying.');
    if (continued && group) {
      s.text(`${group} (continued)`, s.margin, { size: 11, bold: true, ink: INK.green });
      s.y += 18;
    }
    if (continued && item) {
      s.text(`${item} (continued)`, s.margin, { size: 10, bold: true });
      s.y += 16;
    }
  };
  const ensure = (height: number) => {
    if (s.fits(height)) return;
    s.page('portrait');
    drawHead(true);
  };
  const paragraph = (text: string, opts: { size?: number; bold?: boolean; ink?: readonly number[]; gap?: number } = {}) => {
    const size = opts.size ?? 9.5;
    const leading = size * 1.4;
    s.font(size, opts.bold);
    const lines = s.doc.splitTextToSize(s.safe(text), s.contentWidth) as string[];
    for (const line of lines) {
      ensure(leading + 4);
      s.text(line, s.margin, { size, bold: opts.bold, ink: opts.ink });
      s.y += leading;
    }
    s.y += opts.gap ?? 3;
  };
  const heading = (title: string, first?: ProductionGuideItem) => {
    item = '';
    // Keep a section name with its first card, including its month bar and sources.
    const height = first ? Math.min(entryHeight(first) + 20, s.bottom - s.margin - 170) : 40;
    if (!s.fits(height)) group = '';
    ensure(height);
    group = title;
    s.text(title, s.margin, { size: 12, bold: true, ink: INK.green });
    s.y += 20;
  };
  const sourceLine = (label: string, url: string | null) => {
    const size = 8;
    s.font(size);
    const lines = s.doc.splitTextToSize(s.safe(`Source: ${label}`), s.contentWidth) as string[];
    for (const line of lines) {
      ensure(15);
      s.text(line, s.margin, { size, ink: INK.teal });
      if (url && /^https?:\/\//i.test(url)) s.doc.link(s.margin, s.y - size, s.doc.getTextWidth(line), size * 1.4, { url });
      s.y += size * 1.4;
    }
    s.y += 4;
  };
  const entryHeight = (entry: ProductionGuideItem): number => {
    s.font(10.5, true);
    const titleHeight = (s.doc.splitTextToSize(s.safe(entry.title), s.contentWidth) as string[]).length * 14.7 + 1;
    s.font(9.5);
    const bodyHeight = entry.lines.reduce((height, line) => height + (s.doc.splitTextToSize(s.safe(line), s.contentWidth) as string[]).length * 13.3 + 3, 0);
    s.font(8);
    const sourcesHeight = (entry.sources ?? []).reduce((height, source) => height + (s.doc.splitTextToSize(s.safe(`Source: ${source.label}`), s.contentWidth) as string[]).length * 11.2 + 4, 0);
    return titleHeight + bodyHeight + sourcesHeight + (entry.expectedSeason ? 50 : 0) + 10;
  };
  const guideItem = (entry: ProductionGuideItem) => {
    item = '';
    // An ordinary crop or breed card moves as a whole, so its source cannot become a
    // nearly empty last page. An exceptionally long farmer note still splits safely.
    ensure(Math.min(entryHeight(entry), s.bottom - s.margin - 170));
    item = entry.title;
    paragraph(entry.title, { size: 10.5, bold: true, gap: 1 });
    if (entry.expectedSeason) {
      ensure(50);
      paragraph(`${entry.expectedSeason.label} - expected when established`, { size: 9, bold: true });
      const cell = s.contentWidth / 12;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      months.forEach((month, i) => {
        const fill = entry.expectedSeason!.months.includes(i + 1) ? INK.green : INK.panelGrey;
        s.doc.setFillColor(fill[0], fill[1], fill[2]);
        s.doc.rect(s.margin + i * cell, s.y, cell - 2, 19, 'F');
        s.font(8);
        s.ink(entry.expectedSeason!.months.includes(i + 1) ? INK.white : INK.muted);
        s.doc.text(month, s.margin + i * cell + 4, s.y + 12);
      });
      s.y += 27;
    }
    for (const line of entry.lines) paragraph(line);
    for (const source of entry.sources ?? []) sourceLine(source.label, source.url);
    s.y += 6;
  };
  const sourceLabel = (source: { doc: string; page?: string }) => `${source.doc}${source.page ? `, p. ${source.page}` : ''}`;

  drawHead();
  const guide = input.productionGuide;
  if (guide) {
    paragraph(`Research climate group: ${guide.area}. This grouping is not a validated recommendation for this farm.`, { ink: INK.muted, gap: 10 });
    if (guide.siteObservations.length) {
      heading('What you reported about this farm');
      for (const entry of guide.siteObservations) guideItem(entry);
    }
    if (guide.recordedProduction.length) {
      heading('Reporting-year records - not a forecast');
      paragraph('Past reporting-year totals and months describe what was reported. They do not promise food in the coming plan.', { ink: INK.muted, gap: 8 });
      for (const entry of guide.recordedProduction) guideItem(entry);
    }
    if (guide.foodForest?.length) {
      heading('Fruit, nuts and indigenous foods', guide.foodForest[0]);
      for (const entry of guide.foodForest) guideItem(entry);
    }
    if (guide.animalProducts?.length) {
      heading('Animal products and care', guide.animalProducts[0]);
      for (const entry of guide.animalProducts) guideItem(entry);
    }
    if (guide.cropChoices.length) {
      heading('Crop varieties to check locally');
      paragraph('Keep the named variety you actually choose. Research shortlists need confirmation for your local season, water and ground.', { ink: INK.muted, gap: 8 });
      for (const entry of guide.cropChoices) guideItem(entry);
    }
  }
  const poultry = input.poultryGuidance;
  if (poultry) {
    heading('Chickens - choices to confirm');
    const purpose = { eggs: 'Eggs', meat: 'Meat', both: 'Eggs and meat', unknown: 'Not yet recorded' }[poultry.purpose];
    paragraph(`${poultry.statusText}. Purpose: ${purpose}.`, { bold: true });
    if (poultry.selectedEnterprise) paragraph(`Selected plan enterprise: ${poultry.selectedEnterprise.name}.`);
    if (poultry.recordedBreed !== null) paragraph(`Your recorded breed: ${poultry.recordedBreed}.`);
    if (poultry.recordedLayingHens !== null) paragraph(`Laying hens you recorded: ${numberLabel(poultry.recordedLayingHens)}. This count does not promise an egg yield.`);
    for (const text of poultry.attention) paragraph(`Care check: ${text}`);
    for (const text of poultry.missing) paragraph(`Still to check: ${text}`);
    const printedCareSources = new Set<string>();
    for (const point of [...poultry.careNotes, ...poultry.climateNotes]) {
      paragraph(point.text);
      if (!printedCareSources.has(point.source.url)) {
        sourceLine(sourceLabel(point.source), point.source.url);
        printedCareSources.add(point.source.url);
      }
    }
    paragraph(poultry.localCheck, { ink: INK.muted, gap: 10 });
    for (const option of poultry.options) guideItem({
      title: option.name,
      lines: [option.detail],
      sources: [{ label: sourceLabel(option.source), url: option.source.url }],
    });
  }
}

// ── 5. Working documents ────────────────────────────────────────────────────

function drawFieldSheets(
  s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number,
  startPage: (o: 'portrait' | 'landscape') => void,
): void {
  const copy = (source: string, values: Record<string, string | number> = {}) => cropExportText(source, s.language, values);
  const native = isNativePdfLanguage(s.language);
  for (const [monthOffset, month] of rollingMonths(nowMonth).entries()) {
    const sheet = buildFieldSheet(month, input.tasks, now, input.plantings, input.beds, s.language);
    const extraSections: FieldSheetSection[] = [];
    const forest = [...new Map((input.availability?.forest?.[monthOffset] ?? []).map((entry) => [entry.iconKey, entry])).values()];
    const animals = [...new Map((input.availability?.animals?.[monthOffset] ?? []).map((entry) => [entry.iconKey, entry])).values()];
    if (forest.length || animals.length) extraSections.push({
      title: copy('Fruit, berries and animal products - record'),
      note: copy('These are the same locally confirmed months as the picture calendar. Check readiness and record what actually happens; no quantity is promised.'),
      rows: [
        ...forest.map((entry) => ({ place: copy('Fruit / berries'), work: copy('Pick {name} when ready; record actual harvest and where it went.', { name: entry.label }) })),
        ...animals.map((entry) => ({ place: copy('Animals'), work: copy('{name}: record actual production, household use, sales and losses.', { name: entry.label }) })),
      ],
    });
    const undated = monthOffset === 0 ? includedUndatedSources(input.availability) : [];
    if (undated.length) extraSections.push({
      title: copy('Care and establishment - dates to confirm'),
      note: copy('Undated reminders, not scheduled harvests. Check local care and readiness before establishment; record dates when known.'),
      rows: undated.map((entry) => ({ place: copy(isAnimalAvailabilityKey(entry.iconKey) ? 'Animal housing' : 'Mapped plants'), work: `${entry.label}: ${entry.detail}` })),
    });
    const sections = [...sheet.sections, ...extraSections];
    if (!sections.length) continue;

    startPage('portrait');
    masthead(s, 'Field sheet');
    const title = copy('{month} field sheet', { month: sheet.monthLabel });
    pageTitle(s, '', title, copy('{plan} - tick each job off as it is done.', { plan: input.meta.planTitle }));

    s.font(9.5, true); s.ink(INK.green);
    const addedRows = extraSections.reduce((count, section) => count + section.rows.length, 0);
    const stats = copy('{jobs} jobs - {planting} sowing / planting - {harvest} harvest / recording', {
      jobs: sheet.workRows + addedRows, planting: sheet.plantingFocus, harvest: sheet.harvestFocus + forest.length + animals.length,
    });
    if (native) s.paragraph(stats, { size: 9.5, bold: true, ink: INK.green, gap: 6 });
    else { s.doc.text(s.safe(stats), s.margin, s.y); s.y += 18; }
    if (!(input.sections ?? ALL_SECTIONS).includes('availability')) {
      s.paragraph(copy(SUCCESSION_TIMING_GUIDANCE), { size: 9, ink: INK.muted, gap: 8 });
    }

    // Column geometry: tick | place | work | date-and-note. The tick column has
    // to clear the word DONE in the header, not just the checkbox under it.
    s.font(9, true);
    const cTick = native ? Math.max(38, Math.min(80, s.doc.getTextWidth(s.safe(copy('DONE'))) + 14)) : 38;
    const cPlace = 82;
    const noteWordWidths = copy('DATE / NOTE').split(/\s+/).map(word => s.doc.getTextWidth(s.safe(word)));
    const cNote = native ? Math.max(80, Math.min(110, Math.max(...noteWordWidths) + 14)) : 80;
    const cWork = s.contentWidth - cTick - cPlace - cNote;

    // Repeated at the top of every continuation page: a sheet of ticks with no
    // month on it is a sheet nobody can file.
    const continued = () => {
      masthead(s, 'Field sheet');
      s.font(11, true);
      s.ink(INK.text);
      const wording = copy('{title} (continued)', { title });
      const lines = native ? s.doc.splitTextToSize(s.safe(wording), s.contentWidth) as string[] : [s.safe(wording)];
      s.doc.text(lines.length === 1 ? lines[0] : lines, s.margin, s.y, { lineHeightFactor: 1.2 });
      s.y += 16 + (lines.length - 1) * 13.2;
    };
    const widths = [cTick, cPlace, cWork, cNote];
    s.font(9, true);
    const headerLines = ['DONE', 'PLACE', 'WORK TO COMPLETE', 'DATE / NOTE'].map((label, i) => native
      ? s.doc.splitTextToSize(s.safe(copy(label)), widths[i] - 8) as string[] : [s.safe(label)]);
    const headerH = native ? Math.max(18, Math.max(...headerLines.map(lines => lines.length)) * 11 + 8) : 18;
    const headRow = () => {
      s.fill(INK.green);
      s.doc.rect(s.margin, s.y, s.contentWidth, headerH, 'F');
      s.font(9, true); s.ink(INK.white);
      let x = s.margin;
      headerLines.forEach((lines, i) => {
        s.doc.text(lines.length === 1 ? lines[0] : lines, x + 4, s.y + 12, { lineHeightFactor: 11 / 9 });
        x += widths[i];
      });
      s.y += headerH;
    };
    headRow();

    for (const section of sections) {
      const sectionLines = (repeat: boolean) => {
        const wording = repeat ? copy('{title} (continued)', { title: section.title }) : section.title;
        s.font(10.5, true);
        return native ? s.doc.splitTextToSize(s.safe(wording), s.contentWidth - 12) as string[] : [s.safe(wording)];
      };
      const sectionHeight = (repeat: boolean) => Math.max(24, sectionLines(repeat).length * 13 + 11);
      const sectionHead = (repeat = false) => {
        const lines = sectionLines(repeat), height = sectionHeight(repeat);
        s.fill(INK.panelGreen);
        s.doc.rect(s.margin, s.y, s.contentWidth, height, 'F');
        s.font(10.5, true); s.ink(INK.green);
        s.doc.text(lines.length === 1 ? lines[0] : lines, s.margin + 6, s.y + 16, { lineHeightFactor: 13 / 10.5 });
        s.y += height;
      };
      const measureRow = (row: { place: string; work: string }) => {
        s.font(10.5);
        const work = s.doc.splitTextToSize(s.safe(row.work), cWork - 14) as string[];
        s.font(10.5, true);
        const place = s.doc.splitTextToSize(s.safe(row.place), cPlace - 10) as string[];
        return { work, place, height: Math.max(34, work.length * 14 + 14, place.length * 14 + 14) };
      };
      s.font(9.5);
      const noteLines = section.note ? s.doc.splitTextToSize(s.safe(section.note), s.contentWidth - cTick - 12) as string[] : [];
      const noteH = noteLines.length ? noteLines.length * 13 + 12 : 0;
      const firstH = section.rows[0] ? measureRow(section.rows[0]).height : 0;
      // A heading must travel with its guidance and first job; a row alone on a
      // continuation page also needs the work category to remain understandable.
      if (s.need(sectionHeight(false) + noteH + (native ? Math.min(firstH, 62) : firstH))) { continued(); headRow(); }
      sectionHead();
      if (noteLines.length) {
        s.font(9.5); s.ink(INK.muted);
        s.doc.text(noteLines, s.margin + cTick + 5, s.y + 13, { lineHeightFactor: 1.37 });
        s.y += noteH;
      }
      for (const row of section.rows) {
        const measured = measureRow(row);
        if (s.need(native ? Math.min(measured.height, 62) : measured.height)) { continued(); headRow(); sectionHead(true); }
        let offset = 0;
        do {
          const capacity = native ? Math.max(1, Math.floor((s.bottom - s.y - 14) / 14)) : Math.max(measured.work.length, measured.place.length);
          const work = measured.work.slice(offset, offset + capacity);
          // A carried sheet must still name its bed when a long job continues.
          // Repeating that context adds no second job or checkbox.
          const place = native && offset > 0 && measured.place.length <= capacity
            ? measured.place : measured.place.slice(offset, offset + capacity);
          const height = native ? Math.max(34, Math.max(work.length, place.length) * 14 + 14) : measured.height;
          if (offset === 0) {
            s.stroke(INK.muted); s.doc.setLineWidth(0.8);
            s.doc.rect(s.margin + 6, s.y + 9, 12, 12, 'S');
          }
          s.font(10.5, true); s.ink(INK.text);
          if (place.length) s.doc.text(place, s.margin + cTick + 5, s.y + 17, { lineHeightFactor: 1.33 });
          s.font(10.5);
          if (work.length) s.doc.text(work, s.margin + cTick + cPlace + 6, s.y + 17, { lineHeightFactor: 1.33 });
          s.stroke(INK.hair); s.doc.setLineWidth(0.5);
          s.doc.line(s.margin, s.y + height, s.margin + s.contentWidth, s.y + height);
          s.doc.line(s.margin + cTick + cPlace + cWork, s.y, s.margin + cTick + cPlace + cWork, s.y + height);
          s.y += height;
          offset += capacity;
          if (offset < Math.max(measured.work.length, measured.place.length)) { s.page('portrait'); continued(); headRow(); sectionHead(true); }
        } while (offset < Math.max(measured.work.length, measured.place.length));
      }
    }
  }
}

function drawHarvestRecord(s: Sheet, input: CropPlanPdfInput): void {
  const copy = (source: string) => cropExportText(source, s.language);
  const native = isNativePdfLanguage(s.language);
  let recordBand = 'Field record', recordTitle = 'Monthly harvest and field record';
  const monthLine = 'Write the month: ____________________   Team: ____________________';
  const continued = () => {
    masthead(s, recordBand);
    pageTitle(s, copy('Plan versus reality'), cropExportText('{title} (continued)', s.language, { title: copy(recordTitle) }), copy(monthLine));
  };
  const measureHeading = (source: string) => {
    s.font(10, true);
    const lines = native ? s.doc.splitTextToSize(s.safe(copy(source)), s.contentWidth) as string[] : [s.safe(source)];
    return { lines, height: 10 + (lines.length - 1) * 13 };
  };
  const heading = (source: string, following = 0) => {
    const { lines, height } = measureHeading(source);
    if (native && s.need(height + following)) continued();
    s.font(10, true); s.ink(INK.text);
    s.doc.text(lines.length === 1 ? lines[0] : lines, s.margin, s.y, { lineHeightFactor: 1.3 });
    s.y += height;
  };
  masthead(s, 'Field record');
  pageTitle(s, copy('Plan versus reality'), copy(recordTitle), copy(monthLine));

  const h = panel(s, {
    title: copy('Write down what actually happened'),
    accent: INK.green,
    bg: INK.panelGreen,
    body: [copy('Record the date, crop, bed and actual harvest weight. Write how much was used, kept, shared or lost. These records help you check the next plan.')],
  });
  s.y += h + 16;

  const blankRows = (cols: Column[], count: number, rowH: number, label?: string, following = 0) => {
    const totalW = cols.reduce((a, c) => a + c.width, 0);
    const widths = cols.map((c) => (c.width / totalW) * s.contentWidth);
    s.font(7.5, true);
    const headers = cols.map((c, i) => native
      ? s.doc.splitTextToSize(s.safe(copy(c.header)), widths[i] - 12) as string[] : [s.safe(c.header)]);
    const headerH = native ? Math.max(18, Math.max(...headers.map(lines => lines.length)) * 9.5 + 8) : 18;
    // Keep a blank entry table together; a farmer must see the unit above every amount.
    // Only native labels need the extra height; default English retains its original pages.
    if (native) {
      s.font(10, true);
      const labelH = label ? measureHeading(label).height : 0;
      if (s.need(labelH + headerH + count * rowH + 14 + following)) continued();
    }
    if (label) heading(label);
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, headerH, 'F');
    s.font(7.5, true); s.ink(INK.white);
    let x = s.margin;
    headers.forEach((lines, i) => {
      s.doc.text(lines.length === 1 ? lines[0] : lines, x + 6, s.y + 12, { lineHeightFactor: 9.5 / 7.5 });
      x += widths[i];
    });
    s.y += headerH;
    for (let r = 0; r < count; r++) {
      s.stroke(INK.rule); s.doc.setLineWidth(0.4);
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

  blankRows([
    { key: 'a', header: 'Date', width: 48 },
    { key: 'b', header: 'Crop / bed', width: 132 },
    { key: 'c', header: 'Picked kg', width: 62 },
    { key: 'd', header: 'Used kg', width: 56 },
    { key: 'e', header: 'Stored kg', width: 62 },
    { key: 'f', header: 'Sold/shared kg', width: 92 },
    { key: 'g', header: 'Lost kg', width: 56 },
  ], 10, 29, 'Harvest record');

  // Eggs and honey need the same actual-record trail as vegetables. Keeping the
  // unit beside every amount prevents a counted egg from becoming a kilogram.
  s.page('portrait');
  recordBand = 'Production record'; recordTitle = 'Fruit, eggs, honey and other production';
  masthead(s, recordBand);
  pageTitle(s, copy('Plan versus reality'), copy(recordTitle), copy(monthLine));
  const productionNote = panel(s, {
    title: copy('Use the unit you actually measured'),
    accent: INK.green,
    bg: INK.panelGreen,
    body: [copy('Write the food and its source: tree, coop, hive or bed. Use kg for weighed food, eggs for counted eggs, or jars, bunches or items. Record jar size in the source column. Keep all amounts on one row in the same unit.')],
  });
  s.y += productionNote + 16;
  blankRows([
    { key: 'date', header: 'Date', width: 46 },
    { key: 'source', header: 'Food / source', width: 128 },
    { key: 'amount', header: 'Collected', width: 62 },
    { key: 'unit', header: 'Unit', width: 54 },
    { key: 'used', header: 'Used', width: 50 },
    { key: 'sold', header: 'Sold/shared', width: 76 },
    { key: 'lost', header: 'Lost', width: 50 },
  ], 10, 29);

  // Observations and the decision they inform belong on the same carried sheet.
  blankRows([
    { key: 'w', header: 'Week', width: 40 },
    { key: 'r', header: 'Rainfall', width: 70 },
    { key: 'i', header: 'Irrigation', width: 70 },
    { key: 'p', header: 'Pests / disease', width: 90 },
    { key: 'o', header: 'What we observed', width: 120 },
    { key: 'c', header: 'What we changed', width: 120 },
  ], 4, 27, 'Weekly observation', native ? measureHeading('Decision for next month').height + 80 : 0);

  heading('Decision for next month', 80);
  s.fill(INK.panelCream);
  s.doc.rect(s.margin, s.y, s.contentWidth, 54, 'F');
  s.y += 62;
  s.font(8.5);
  s.ink(INK.muted);
  s.doc.text(s.safe(copy('Observe. Adjust. Write it down.')), s.margin, s.y);
}

// ── Assembly ────────────────────────────────────────────────────────────────

/** Build the printable plan as a PDF blob. Throws if jsPDF cannot be loaded. */
export async function buildCropPlanPdf(input: CropPlanPdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pageFormat: CropPlanPageFormat = input.pageFormat ?? 'a4';
  const doc = new jsPDF({ unit: 'pt', format: pageFormat });

  const language = input.meta.language ?? 'en';
  const font = isNativePdfLanguage(language) ? await registerReportPdfFont(doc) : 'helvetica';
  drawCropPlanPages(doc, input, false, { language, font });
  return doc.output('blob');
}

/** The site report attaches the same working document, with continuous page numbers. */
export function drawCropPlanPages(doc: Doc, input: CropPlanPdfInput, append = false, presentation: CropPlanPdfPresentation = {}): void {
  const language = presentation.language ?? input.meta.language ?? 'en';
  const font = presentation.font ?? (isNativePdfLanguage(language) ? 'ImbewuSans' : 'helvetica');
  if (isNativePdfLanguage(language) && (!doc.getFontList()[font]?.includes('normal') || !doc.getFontList()[font]?.includes('bold'))) {
    throw new Error('Register the native report font before appending crop-plan pages.');
  }
  const pageFormat = input.pageFormat ?? 'a4';
  const now = input.now ?? new Date();
  const nowMonth = now.getMonth() + 1;
  const want = new Set(input.sections ?? ALL_SECTIONS);
  const s = new Sheet(doc, input.meta.planTitle, pageFormat, input.meta.documentNotice, { language, font });

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
  if (want.has('availabilityGraphs')) { startPage('portrait'); drawAvailabilityGraphs(s, input, now, nowMonth); }
  if (want.has('projection') && input.productionProjection) { startPage('portrait'); drawProductionProjection(s, input); }
  if (want.has('guidance') && (input.productionGuide || input.poultryGuidance)) { startPage('portrait'); drawProductionGuidance(s, input); }
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
export function cropPlanPdfFilename(planTitle?: string, date = new Date(), kind?: string, language = 'en'): string {
  const native = isNativePdfLanguage(language);
  const title = (planTitle ?? 'plan').normalize(native ? 'NFC' : 'NFKD');
  const slug = (native ? title : title.replace(/[̀-ͯ]/g, ''))
    .replace(native ? /[^\p{L}\p{N}\p{M}]+/gu : /[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'plan';
  const stamp = date.toISOString().slice(0, 10);
  const suffix = kind ? `-${kind}` : '';
  return `ImbewuField-Crop-Plan-${slug}${suffix}-${stamp}.pdf`;
}
