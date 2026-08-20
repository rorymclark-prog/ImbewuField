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

import type { CropTask, PlanBed, Planting } from '@/lib/crop-plan';
import { planNotesDateLabel } from '@/lib/crop-plan';
import type { PlanNote, PlanNoteKind } from '@/lib/crop-autosuggest';
import type { FoodGroup } from '@/lib/crop-groups';
import {
  buildBuyingSchedule, monthShort, monthYearLabel, positionRangeLabel, rollingMonths,
  SUCCESSION_TIMING_GUIDANCE,
} from '@/lib/crop-export-schedule';
import {
  buildFieldSheet, buildOccupancyCalendar, buildPlanDashboard,
  buildPlanTableRows, buildTopCrops, buildWorkloadSeries, cropAbbreviations,
  type CalendarRow, type MonthCount,
} from '@/lib/crop-export-benchmark';
import { cropByKey } from '@/lib/crop-catalog';
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
}

export type CropPlanSection = 'dashboard' | 'numbers' | 'calendar' | 'plan' | 'buying' | 'fieldsheets' | 'record';

export const ALL_SECTIONS: CropPlanSection[] = [
  'dashboard', 'numbers', 'calendar', 'plan', 'buying', 'fieldsheets', 'record',
];

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
  root_tuber: INK.gold,
  allium_aromatic: INK.gold,
  legume: INK.teal,
  fruiting_veg: INK.terracotta,
  staple_grain: INK.brown,
};

const GROUP_LEGEND: { label: string; ink: readonly number[] }[] = [
  { label: 'Leafy crops', ink: INK.green },
  { label: 'Roots and alliums', ink: INK.gold },
  { label: 'Legumes', ink: INK.teal },
  { label: 'Fruiting crops', ink: INK.terracotta },
  { label: 'Staples', ink: INK.brown },
];

type Doc = import('jspdf').jsPDF;

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

  constructor(doc: Doc, footerNote: string) {
    this.doc = doc;
    this.footerNote = footerNote;
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
    // ran straight into the centred note on a portrait page.
    this.doc.text(pdfSafe(this.footerNote), this.margin, this.height - 26);
    this.doc.text(
      pdfSafe(ASSURANCE_ONE_LINE),
      this.width / 2, this.height - 26, { align: 'center' },
    );
    this.doc.text(String(this.doc.getNumberOfPages()), this.width - this.margin, this.height - 26, { align: 'right' });
  }

  page(orientation: 'portrait' | 'landscape' = 'portrait'): void {
    this.stampFooter();
    this.doc.addPage('a4', orientation);
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
  s.font(7.5, true);
  s.ink(INK.gold);
  s.doc.text(pdfSafe(eyebrow.toUpperCase()), s.margin, s.y);
  s.y += 16;
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
  const bodyLines: string[] = [];
  for (const b of opts.body) bodyLines.push(...(s.doc.splitTextToSize(pdfSafe(b), innerW) as string[]));
  const h = pad * 2 + (opts.title ? 14 : 0) + bodyLines.length * 11.5;

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
  s.doc.text(bodyLines, tx, ty);
  return h;
}

// ── 1. Plan dashboard ───────────────────────────────────────────────────────

function drawDashboard(s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number): void {
  const { meta } = input;
  masthead(s, 'Crop plan');

  s.font(7.5, true);
  s.ink(INK.gold);
  s.doc.text(pdfSafe('A PRACTICAL PLAN FOR THE GARDEN TEAM'), s.margin, s.y);
  s.y += 18;
  s.font(21, true);
  s.ink(INK.text);
  s.doc.text(pdfSafe(`Crop plan - ${meta.planTitle}`), s.margin, s.y);
  s.y += 18;
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
  s.y += stripH + 18;

  s.paragraph(
    'A crop plan should reduce uncertainty. It should show the garden team what to prepare, plant, harvest and buy - without making them decode the system behind it.',
    { size: 9.5, gap: 14 },
  );

  const dash = buildPlanDashboard(input.plantings, input.beds, input.tasks, {
    lossPercent: meta.lossPercent,
    lossAllowanceConfirmed: meta.lossAllowanceConfirmed,
    nowMonth,
  });

  // Four stat tiles.
  const tileW = (s.contentWidth - 3 * 8) / 4;
  const tileH = 74;
  const tints = [INK.panelGrey, INK.panelCream, INK.panelGreen, INK.panelPink];
  const values = [INK.text, INK.gold, INK.teal, INK.terracotta];
  dash.stats.forEach((stat, i) => {
    const x = s.margin + i * (tileW + 8);
    s.fill(tints[i]);
    s.doc.rect(x, s.y, tileW, tileH, 'F');
    s.font(17, true);
    s.ink(values[i]);
    s.doc.text(pdfSafe(stat.value), x + 10, s.y + 30);
    s.font(8, true);
    s.ink(INK.text);
    s.doc.text(pdfSafe(stat.label), x + 10, s.y + 47);
    s.font(7.5);
    s.ink(INK.muted);
    const d = s.doc.splitTextToSize(pdfSafe(stat.detail), tileW - 20) as string[];
    s.doc.text(d.slice(0, 2), x + 10, s.y + 59);
  });
  s.y += tileH + 16;

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
  s.y += Math.max(signalsH, decisionsH) + 14;

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
  s.y += h + 12;

  // HOW MUCH TO TRUST THIS — on page one, not in small print at the back.
  //
  // A farmer decides what to plant and what seed to buy from the front of the
  // document. A caution they meet after that decision is a record that we said
  // it, not a warning that reached them. The wording is IMPORTED, never written
  // here: the crop plan, the site report and the in-app view must not each grow
  // their own version, because the weakest one becomes the promise the product
  // is judged on. See lib/plan-assurance.ts for the full reasoning.
  const assuranceH = panel(s, {
    title: ASSURANCE_TITLE.toUpperCase(),
    accent: INK.gold,
    bg: INK.panelCream,
    body: [...ASSURANCE_PARAGRAPHS.map(pdfSafe), pdfSafe(SUCCESSION_TIMING_GUIDANCE)],
  });
  s.y += assuranceH + 12;

  // "Say a rule once." The year-report prose opens with the crop-cycle total
  // and biggest crop — both are already tiles or signals directly above. Only
  // paragraphs that say something those summaries cannot are repeated here.
  const extra = (input.yearReport ?? []).filter(
    (p) => !/^For crops with a verified kg\/m² benchmark/.test(p) && !/^Within the benchmark comparison/.test(p),
  );
  if (extra.length) {
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
  let lines = 0;
  for (const b of body) lines += (s.doc.splitTextToSize(pdfSafe(b), innerW) as string[]).length;
  return 20 + (hasTitle ? 14 : 0) + lines * 11.5;
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
  s.need(h + 46);
  s.font(11, true);
  s.ink(INK.text);
  s.doc.text(pdfSafe(opts.title), s.margin, s.y);
  s.y += 12;

  const plotX = s.margin + 30;
  const plotW = s.contentWidth - 30;
  const top = s.y;
  const base = top + h;
  const max = Math.max(1, ...opts.values);

  // Four faint gridlines and a value axis, so a bar can be read, not guessed.
  s.stroke(INK.hair);
  s.doc.setLineWidth(0.5);
  for (let i = 0; i <= 4; i++) {
    const gy = base - (h * i) / 4;
    s.doc.line(plotX, gy, plotX + plotW, gy);
    s.font(6.5);
    s.ink(INK.faint);
    s.doc.text(pdfSafe(String(Math.round((max * i) / 4))), plotX - 5, gy + 2, { align: 'right' });
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

  s.font(6.5);
  s.ink(INK.faint);
  s.doc.text(pdfSafe(opts.axis), plotX - 5, top - 8, { align: 'right' });
  s.y = base + 26;
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
  pageTitle(s, 'Land occupancy', 'Annual bed and plot calendar');

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

    s.font(8, true);
    s.ink(INK.text);
    s.doc.text(pdfSafe(row.label), s.margin + 8, s.y + 13);
    s.font(6.5);
    s.ink(INK.faint);
    s.doc.text(pdfSafe(`${row.areaM2.toFixed(1)} m2`), s.margin + labelW - 8, s.y + 13, { align: 'right' });

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
  // Colour key.
  const keyW = s.contentWidth / GROUP_LEGEND.length;
  GROUP_LEGEND.forEach((g, i) => {
    const x = s.margin + i * keyW;
    s.fill(g.ink);
    s.doc.rect(x, s.y, keyW - 6, 8, 'F');
    s.font(7.5);
    s.ink(INK.muted);
    s.doc.text(pdfSafe(g.label), x, s.y + 20);
  });
  s.y += 32;

  // Code key — a derived abbreviation is only honest if the page decodes it.
  const abbr = cropAbbreviations(input.plantings);
  const pairs = [...abbr.entries()]
    .map(([key, code]) => `${code} = ${cropByKey(key)?.name ?? key}`)
    .sort();
  s.font(8, true);
  s.ink(INK.green);
  s.doc.text(pdfSafe('Crop codes'), s.margin, s.y);
  s.font(7);
  s.ink(INK.faint);
  s.doc.text(
    pdfSafe(`Read left to right from ${monthShort(nowMonth)}. A star marks the months a crop is being picked; nursery dates and exact spacing are in the full plan.`),
    s.margin + 58, s.y,
  );
  s.y += 11;
  const cols = 5;
  const perCol = Math.ceil(pairs.length / cols);
  s.font(6.8);
  s.ink(INK.muted);
  for (let c = 0; c < cols; c++) {
    const slice = pairs.slice(c * perCol, (c + 1) * perCol);
    s.doc.text(slice.map(pdfSafe), s.margin + c * (s.contentWidth / cols), s.y);
  }
  s.y += perCol * 9 + 6;
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
  opts: { band?: string; title?: string; groupKey?: string } = {},
): void {
  const totalW = columns.reduce((a, c) => a + c.width, 0);
  const scale = s.contentWidth / totalW;
  const widths = columns.map((c) => c.width * scale);
  const headH = 20;

  const drawHead = () => {
    s.fill(INK.green);
    s.doc.rect(s.margin, s.y, s.contentWidth, headH, 'F');
    s.font(7.5, true);
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
    s.font(8);
    const heights = columns.map((c, i) => (s.doc.splitTextToSize(pdfSafe(row[c.key] ?? ''), widths[i] - 16) as string[]).length);
    const rowH = Math.max(18, Math.max(...heights) * 10.5 + 8);

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
      s.font(8, groupStart && i === 0);
      s.ink(i === 0 ? INK.text : INK.muted);
      // The grouping column prints its label once per group — and again at the
      // top of every continuation page, because `lastGroup` is cleared on a
      // break. Without that, page two of the bed plan opened with a column of
      // crops belonging to a bed it never named.
      const raw = row[c.key] ?? '';
      const shown = opts.groupKey !== undefined && i === 0 && !groupStart ? '' : raw;
      const lines = s.doc.splitTextToSize(pdfSafe(shown), widths[i] - 16) as string[];
      const tx = c.align === 'right' ? x + widths[i] - 8 : x + 8;
      s.doc.text(lines, tx, s.y + 12, { align: c.align === 'right' ? 'right' : 'left' });
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

  const rows = buildPlanTableRows(input.plantings, input.beds).map((r) => ({
    area: r.area,
    // A one-time starter has to say so on its own line. Without it the sheet a
    // farmer carries into the field reads a first-season bridge sowing as a
    // standing annual crop. The cell wraps rather than truncating, so the row
    // simply grows to fit.
    crop: r.once ? `${r.crop} (first season only)` : r.crop,
    share: r.share,
    establish: r.establish,
    field: r.intoField,
    harvest: r.harvest,
    yield: benchmarkYieldLabel(r.yieldKg),
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
    'One line per sourcing marker. The buying rule is stated once below instead of after every item.');

  const h = panel(s, {
    title: 'The buying rule',
    accent: INK.gold,
    bg: INK.panelCream,
    body: [
      'Source direct-sown or tray seed before the named sowing month; the source does not provide a universal procurement lead time. Ready-grown seedlings are listed at the start of the field-readiness window; buy them only when the bed and seedlings are ready. Living corms, slips, cloves and seed potatoes are listed close to planting. For a tray crop, choose either packet seed for the nursery or ready-grown seedlings - not both.',
      'For direct-sown crops, field spacing supports only an approximate FINAL stand. It does not prove a seed-buying quantity: '
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
        qty: item.quantityStatus === 'spacing-confirmation-required'
          ? 'Confirm spacing first'
          : item.quantityStatus === 'packet-rate-required'
            ? 'Packet rate needed'
            : item.quantityStatus === 'counted-piece-range' && item.countRange
              ? `~${positionRangeLabel(item.countRange)} ${item.unit} positions`
              : item.count === null
                ? 'Confirm quantity'
                : `~${item.count.toLocaleString('en-ZA')} ${item.unit} positions`,
        method: item.quantityStatus === 'spacing-confirmation-required'
          ? 'Local row layout needed'
          : !item.transplant && item.unit !== 'seeds'
          ? 'Living pieces; confirm loss allowance'
          : item.transplant ? `Ready seedlings; own seed before ${monthShort(item.sowMonth)} nursery` : `Direct sow; ~${positionRangeLabel(item.finalPlantPositionsRange)} final positions`,
        forWhat: item.bedLabels.join(', '),
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
  ], rows, { band: 'Inputs', title: 'Seed and seedling buying schedule', groupKey: 'group' });
}

// ── 5. Working documents ────────────────────────────────────────────────────

function drawFieldSheets(
  s: Sheet, input: CropPlanPdfInput, now: Date, nowMonth: number,
  startPage: (o: 'portrait' | 'landscape') => void,
): void {
  for (const month of rollingMonths(nowMonth)) {
    const sheet = buildFieldSheet(month, input.tasks, now);
    if (!sheet.sections.length) continue;

    startPage('portrait');
    masthead(s, 'Field sheet');
    pageTitle(s, 'Monthly action plan', `${sheet.monthLabel} field sheet`,
      `${input.meta.planTitle} - tick each job off as it is done.`);

    // Month header stats.
    const stats = [
      { v: String(sheet.workRows), l: 'jobs this month', ink: INK.text, bg: INK.panelGrey },
      { v: String(sheet.plantingFocus), l: 'sowing / planting', ink: INK.gold, bg: INK.panelCream },
      { v: String(sheet.harvestFocus), l: 'harvest jobs', ink: INK.teal, bg: INK.panelGreen },
      { v: String(sheet.sections.length), l: 'kinds of work', ink: INK.terracotta, bg: INK.panelPink },
    ];
    const tw = (s.contentWidth - 3 * 6) / 4;
    stats.forEach((st, i) => {
      const x = s.margin + i * (tw + 6);
      s.fill(st.bg);
      s.doc.rect(x, s.y, tw, 34, 'F');
      s.font(13, true);
      s.ink(st.ink);
      s.doc.text(pdfSafe(st.v), x + 8, s.y + 22);
      // Measure the number while its OWN font is still set — measuring after
      // switching to the label font printed "17jobs this month", the two runs
      // touching, because a 7.5pt measure of "17" is far narrower than a 13pt one.
      const vw = s.doc.getTextWidth(pdfSafe(st.v));
      s.font(7.5);
      s.ink(INK.muted);
      s.doc.text(pdfSafe(st.l), x + 8 + vw + 5, s.y + 22);
    });
    s.y += 34 + 14;

    s.font(8, true);
    s.ink(INK.muted);
    s.doc.text(pdfSafe('Nursery sowing and planting into the bed are shown as separate jobs.'), s.margin, s.y);
    s.y += 12;
    s.font(7.5, true);
    s.ink(INK.gold);
    const timingLines = s.doc.splitTextToSize(pdfSafe(SUCCESSION_TIMING_GUIDANCE), s.contentWidth) as string[];
    s.doc.text(timingLines, s.margin, s.y);
    s.y += timingLines.length * 9 + 10;

    // Column geometry: tick | place | work | date-and-note. The tick column has
    // to clear the word DONE in the header, not just the checkbox under it.
    const cTick = 36;
    const cPlace = 72;
    const cNote = 108;
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
      s.font(7.5, true);
      s.ink(INK.white);
      s.doc.text(pdfSafe('DONE'), s.margin + 4, s.y + 12);
      s.doc.text(pdfSafe('PLACE'), s.margin + cTick + 4, s.y + 12);
      s.doc.text(pdfSafe('WORK TO COMPLETE'), s.margin + cTick + cPlace + 4, s.y + 12);
      s.doc.text(pdfSafe('DATE DONE / NOTE'), s.margin + cTick + cPlace + cWork + 4, s.y + 12);
      s.y += 18;
    };
    headRow();

    for (const section of sheet.sections) {
      if (s.need(40)) { continued(); headRow(); }
      s.fill(INK.panelCream);
      s.doc.rect(s.margin, s.y, s.contentWidth, 16, 'F');
      s.font(7.5, true);
      s.ink(INK.gold);
      s.doc.text(pdfSafe(section.title.toUpperCase()), s.margin + 6, s.y + 11);
      s.y += 16;

      for (const row of section.rows) {
        s.font(8);
        const lines = s.doc.splitTextToSize(pdfSafe(row.work), cWork - 12) as string[];
        // A merged row's place can be "Beds 3, 7, 12, 18" — wrap it like the
        // work text and size the row to whichever column is taller, or the bed
        // list silently overprints the instruction beside it.
        s.font(8, true);
        const placeLines = s.doc.splitTextToSize(pdfSafe(row.place), cPlace - 8) as string[];
        const rowH = Math.max(24, lines.length * 10.5 + 10, placeLines.length * 10.5 + 10);
        if (s.need(rowH)) { continued(); headRow(); }

        // The checkbox — the reason this page exists on paper.
        s.stroke(INK.muted);
        s.doc.setLineWidth(0.7);
        s.doc.rect(s.margin + 7, s.y + 6, 9, 9, 'S');

        s.font(8, true);
        s.ink(INK.text);
        s.doc.text(placeLines, s.margin + cTick + 4, s.y + 13);
        s.font(8);
        s.ink(INK.text);
        s.doc.text(lines, s.margin + cTick + cPlace + 4, s.y + 13);

        s.stroke(INK.hair);
        s.doc.setLineWidth(0.4);
        s.doc.line(s.margin, s.y + rowH, s.margin + s.contentWidth, s.y + rowH);
        s.doc.line(s.margin + cTick + cPlace + cWork, s.y, s.margin + cTick + cPlace + cWork, s.y + rowH);
        s.y += rowH;
      }
    }

    // The weather note is the LAST ROW OF THE TABLE, not a floating box after
    // it. As a box it only appeared on months short enough to leave room, so
    // some sheets had somewhere to write the rain and some did not.
    if (s.need(44)) { continued(); headRow(); }
    s.fill(INK.panelGrey);
    s.doc.rect(s.margin, s.y, s.contentWidth, 42, 'F');
    s.font(8, true);
    s.ink(INK.text);
    s.doc.text(pdfSafe('Weather, soil'), s.margin + cTick + 4, s.y + 14);
    s.doc.text(pdfSafe('and irrigation'), s.margin + cTick + 4, s.y + 24);
    s.stroke(INK.hair);
    s.doc.setLineWidth(0.4);
    s.doc.rect(s.margin, s.y, s.contentWidth, 42, 'S');
    s.doc.line(s.margin + cTick + cPlace, s.y, s.margin + cTick + cPlace, s.y + 42);
    s.y += 48;
  }
}

function drawHarvestRecord(s: Sheet, input: CropPlanPdfInput): void {
  masthead(s, 'Field record');
  pageTitle(s, 'Plan versus reality', 'Monthly harvest and field record',
    'Use one copy per month. The planned figures guide the work; the actual figures improve the next plan.');

  const h = panel(s, {
    title: 'Write down what actually happened',
    accent: INK.green,
    bg: INK.panelGreen,
    body: ['A plan becomes more useful each time the team records harvest weight, losses, weather, pests and the decisions taken in response. '
      + 'After three seasons your own notes will be worth more than any printed calendar.'],
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
    { key: 'a', header: 'Crop / bed', width: 120 },
    { key: 'b', header: 'Benchmark kg', width: 62 },
    { key: 'c', header: 'Actual kg', width: 62 },
    { key: 'd', header: 'Used in kitchen', width: 74 },
    { key: 'e', header: 'Stored', width: 54 },
    { key: 'f', header: 'Sold / shared', width: 68 },
    { key: 'g', header: 'Loss', width: 46 },
    { key: 'h', header: 'Note', width: 90 },
  ], 10, 21);

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
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  const now = input.now ?? new Date();
  const nowMonth = now.getMonth() + 1;
  const want = new Set(input.sections ?? ALL_SECTIONS);
  const s = new Sheet(doc, input.meta.planTitle);

  const workload = buildWorkloadSeries(input.tasks, nowMonth);
  const calendar = buildOccupancyCalendar(input.plantings, input.beds, nowMonth);

  // The first requested section owns page 1. Without this, exporting only the
  // buying schedule opened on a blank portrait sheet — jsPDF always creates
  // page 1 for you, whether or not the first thing you draw belongs on it.
  let started = false;
  const startPage = (orientation: 'portrait' | 'landscape') => {
    if (started) { s.page(orientation); return; }
    started = true;
    if (orientation === 'landscape') {
      doc.deletePage(1);
      doc.addPage('a4', 'landscape');
    }
    s.y = s.margin;
  };

  if (want.has('dashboard')) { startPage('portrait'); drawDashboard(s, input, now, nowMonth); }
  if (want.has('numbers')) { startPage('portrait'); drawYearInNumbers(s, input, nowMonth, workload); }
  if (want.has('calendar')) { startPage('landscape'); drawCalendar(s, input, nowMonth, calendar); }
  if (want.has('plan')) { startPage('landscape'); drawFullPlan(s, input); }
  if (want.has('buying')) { startPage('landscape'); drawBuying(s, input, now, nowMonth); }
  if (want.has('fieldsheets')) drawFieldSheets(s, input, now, nowMonth, startPage);
  if (want.has('record')) { startPage('portrait'); drawHarvestRecord(s, input); }

  s.stampFooter();
  return doc.output('blob');
}

/** `ImbewuField-Crop-Plan-<site>-<date>.pdf` — sorts by date in a downloads folder. */
export function cropPlanPdfFilename(planTitle?: string, date = new Date()): string {
  const slug = (planTitle ?? 'plan')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'plan';
  const stamp = date.toISOString().slice(0, 10);
  return `ImbewuField-Crop-Plan-${slug}-${stamp}.pdf`;
}
