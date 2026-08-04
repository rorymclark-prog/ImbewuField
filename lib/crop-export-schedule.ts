// ── Crop plan → the things a farmer takes away from the screen ──────────────
//
// Two exports are built on top of this module: a calendar file
// (lib/crop-calendar-ics.ts) and a printable plan (lib/crop-export-pdf.ts).
// Both need the SAME sentences the screen shows and the SAME numbers the
// on-screen "Seeds & seedlings" card shows — a paper plan that disagrees with
// the app is worse than no paper plan, because the farmer is standing in a
// shop in town and cannot check.
//
// PURE MODULE — no browser APIs, no jsPDF, no React. Everything here is a
// plain function over the plan data, so the wording, the buy months and the
// year arithmetic are all testable without a DOM (same discipline as
// lib/offline-pack.ts).
//
// The task-wording helpers (sowingInstruction / taskPhrase / taskSentence)
// used to live inside app/facilitator/crops/page.tsx. They moved here rather
// than being copied so the calendar event, the PDF and the screen can never
// drift into describing the same task three different ways.

import type { CropDef } from '@/lib/crop-catalog';
import { MONTHS_SHORT, cropByKey } from '@/lib/crop-catalog';
import type { CropTask, PlanBed, Planting } from '@/lib/crop-plan';
import { harvestMonth, seedBoqForPlan } from '@/lib/crop-plan';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** 1-12, wrapping — the same rule lib/crop-plan.ts uses internally. */
export function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}

export function monthShort(m: number): string {
  return MONTHS_SHORT[wrapMonth(m) - 1];
}

export function monthLong(m: number): string {
  return MONTH_NAMES[wrapMonth(m) - 1];
}

/**
 * The rolling 12-month reading order: index 0 is the CURRENT month, not
 * January. Every export is a year-from-today document — a plan handed to a
 * farmer in August that opens on January's tasks is asking them to read six
 * months of history before they reach anything they can act on.
 */
export function rollingMonths(nowMonth: number, count = 12): number[] {
  return Array.from({ length: count }, (_, i) => wrapMonth(nowMonth + i));
}

/**
 * Which real calendar YEAR a month-only entry belongs to.
 *
 * The plan carries no year anywhere — it is a repeating annual cycle of month
 * numbers. Resolution is FORWARD-ONLY: the next occurrence of that month on or
 * after the current month. Read in August, "sow in March" means March NEXT
 * year and "sow in October" means October this year. The current month
 * resolves to this year (a task due this month is due now, not in eleven
 * months), which is also exactly how the on-screen rolling task list reads it.
 */
export function resolveMonthYear(month: number, now: Date): number {
  const nowMonth = now.getMonth() + 1;
  const forward = (((wrapMonth(month) - nowMonth) % 12) + 12) % 12;
  return now.getFullYear() + (nowMonth + forward > 12 ? 1 : 0);
}

/** "October 2026" — a month heading that is an actual date, not just a name. */
export function monthYearLabel(month: number, now: Date): string {
  return `${monthLong(month)} ${resolveMonthYear(month, now)}`;
}

// ── Task wording ────────────────────────────────────────────────────────────

/**
 * Farmer-facing "how to sow" line — row spacing / in-row spacing / sow depth
 * where a sourced split exists (lib/crop-catalog.ts rowSpacingCm/
 * inRowSpacingCm/sowDepthCm), falling back to the single spacingCm figure for
 * the crops with no sourced split. Never fabricates a number that isn't on the
 * crop record.
 */
export function sowingInstruction(crop: CropDef): string {
  const parts: string[] = [];
  if (crop.rowSpacingCm) parts.push(`rows ${crop.rowSpacingCm}cm apart`);
  if (crop.inRowSpacingCm) parts.push(`${crop.inRowSpacingCm}cm apart in the row`);
  if (crop.sowDepthCm) parts.push(`sow ${crop.sowDepthCm}cm deep`);
  // Always surface an actual plant-spacing figure when there is no row/in-row split — a crop
  // with only a sow-depth (carrots, onions) must still show spacing, not just depth.
  if (!crop.rowSpacingCm && !crop.inRowSpacingCm && crop.spacingCm) {
    parts.unshift(`plant spacing ~${crop.spacingCm}cm`);
  }
  return parts.join(' · ');
}

// Verb phrase per task action — 'prep'/'mulch' need a bit more than a single
// word to say what's actually involved (compost/kraal manure, water-in), the
// others read fine as plain verbs.
export const TASK_VERB: Record<CropTask['action'], string> = {
  prep: 'prep bed (compost + kraal manure, then let it rest) for',
  sow: 'sow',
  transplant: 'transplant',
  mulch: 'water in & mulch',
  harvest: 'harvest',
  'weed-early': 'weed around',
  'weed-mid': 'weed & check for pests around',
};

/** Title-case label for the same actions — for a calendar event's SUMMARY line. */
export const TASK_TITLE: Record<CropTask['action'], string> = {
  prep: 'Prep ground',
  sow: 'Sow',
  transplant: 'Transplant',
  mulch: 'Water in & mulch',
  harvest: 'Harvest',
  'weed-early': 'Weed',
  'weed-mid': 'Weed & check for pests',
};

/** One task as a sentence fragment: "sow maize (mielies) — rows 90cm apart (Plot 1)". */
export function taskPhrase(t: CropTask): string {
  // Spacing only matters at sowing time — by transplant/mulch/weed/harvest
  // the bed is already laid out, so repeating it there would just be noise.
  const crop = t.action === 'sow' ? cropByKey(t.cropKey) : undefined;
  const spacing = crop ? ` — ${sowingInstruction(crop)}` : '';
  // Prep wording is per-ground: tasksForPlan says plough/rip for a staple PLOT and
  // compost-and-rest for a bed (CropTask.prepText); the static verb is the fallback.
  const verb = (t.action === 'prep' && t.prepText) ? `${t.prepText} for` : TASK_VERB[t.action];
  return `${verb} ${t.cropName.toLowerCase()}${spacing} (${t.bedLabel})`;
}

export function taskSentence(tasks: CropTask[]): string {
  if (tasks.length === 0) return 'nothing due';
  return tasks.map(taskPhrase).join(' · ');
}

/** Sentence-cased standalone line — what a calendar event or a printed row shows. */
export function taskLine(t: CropTask): string {
  const phrase = taskPhrase(t);
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Short standalone title for a task: "Sow maize (mielies) — Bed 3".
 * The bed is always in there because a calendar entry read five months later,
 * with no app open beside it, has to say WHICH ground it means.
 */
export function taskTitle(t: CropTask): string {
  if (t.action === 'prep') return `Prep ${t.bedLabel} for ${t.cropName}`;
  return `${TASK_TITLE[t.action]} ${t.cropName} — ${t.bedLabel}`;
}

// ── Bed-by-bed plan ─────────────────────────────────────────────────────────

export interface BedPlanCrop {
  cropKey: string;
  cropName: string;
  icon: string;
  /** Month the seed goes in — into TRAYS for a transplant crop, straight into the ground otherwise. */
  sowMonth: number;
  /** Month the crop actually occupies the bed (= sowMonth + 1 for a transplant crop). */
  bedMonth: number;
  harvestMonth: number;
  /** Last month of the fresh-picking window (= harvestMonth for a one-shot harvest). */
  harvestEndMonth: number;
  transplant: boolean;
  existing: boolean;
  /** '' for a whole bed, else 'half', 'a third', 'a quarter', '40% of the bed'. */
  shareLabel: string;
  estimatedKg: number;
}

export interface BedPlanRow {
  bedId: string;
  bedLabel: string;
  kind: 'bed' | 'plot';
  areaM2: number;
  crops: BedPlanCrop[];
}

/** Plain-words share of a bed — no ½/⅓ glyphs, which not every PDF font can draw. */
export function bedShareLabel(fraction: number): string {
  if (fraction >= 1) return '';
  if (Math.abs(fraction - 0.5) < 0.01) return 'half the bed';
  if (Math.abs(fraction - 1 / 3) < 0.01) return 'a third of the bed';
  if (Math.abs(fraction - 0.25) < 0.01) return 'a quarter of the bed';
  return `${Math.round(fraction * 100)}% of the bed`;
}

/**
 * Every bed and plot, with what is planned in it — EMPTY BEDS INCLUDED.
 * A printed plan that silently omits the three beds with nothing in them
 * reads as a complete plan for a smaller garden; the farmer needs to see the
 * gap to fill it.
 */
export function buildBedPlanRows(plantings: Planting[], beds: PlanBed[]): BedPlanRow[] {
  return beds.map((bed) => {
    const crops: BedPlanCrop[] = [];
    for (const p of plantings) {
      if (p.bedId !== bed.id) continue;
      const crop = cropByKey(p.cropKey);
      if (!crop) continue;
      const fraction = p.areaFraction ?? 1;
      const h = harvestMonth(p.sowMonth, crop.daysToHarvest);
      crops.push({
        cropKey: crop.key,
        cropName: crop.name,
        icon: crop.icon,
        sowMonth: p.sowMonth,
        bedMonth: crop.transplant ? wrapMonth(p.sowMonth + 1) : p.sowMonth,
        harvestMonth: h,
        harvestEndMonth: wrapMonth(h + (crop.harvestWindowMonths ?? 0)),
        transplant: !!crop.transplant,
        existing: !!p.existing,
        shareLabel: bedShareLabel(fraction),
        estimatedKg: crop.yieldKgPerM2 * bed.areaM2 * fraction,
      });
    }
    crops.sort((a, b) => a.sowMonth - b.sowMonth || a.cropName.localeCompare(b.cropName));
    return {
      bedId: bed.id,
      bedLabel: bed.label,
      kind: bed.kind ?? 'bed',
      areaM2: bed.areaM2,
      crops,
    };
  });
}

// ── Seed & seedling buying schedule ─────────────────────────────────────────

export interface BuyingItem {
  cropKey: string;
  cropName: string;
  icon: string;
  /** 'seeds' | 'seedlings' | 'slips' | 'seed potatoes' — straight from seedBoqForPlan. */
  unit: string;
  count: number;
  /** Month to have it in hand (1-12). */
  buyMonth: number;
  sowMonth: number;
  bedMonth: number;
  harvestMonth: number;
  transplant: boolean;
  bedLabels: string[];
  /** What to do with it once bought — the reason this month and not another. */
  note: string;
}

export interface BuyingMonth {
  month: number;
  items: BuyingItem[];
}

/**
 * HOW MANY MONTHS AHEAD OF SOWING TO BUY.
 *
 * One. The plan's own ground-prep task already sits at sowMonth - 1 (see
 * tasksForPlan), so "buy the seed on the trip to town in the month you prep
 * the ground" needs no new trip and no new concept — the seed is in the house
 * before the ground is ready, never the other way round.
 *
 * For a `transplant: true` crop this lands the purchase TWO months before the
 * bed date, not one, and that is the whole point: the crop-plan model treats
 * `Planting.sowMonth` as the month seed goes into TRAYS and puts the
 * transplant a month later (tasksForPlan), so buying at sowMonth - 1 gives the
 * farmer seed in hand, trays sown on time, and seedlings ready when the bed
 * is. The catalog says the same thing in its own words — onions: "sow into
 * trays in autumn, transplant seedlings about six weeks later".
 */
const BUY_LEAD_MONTHS = 1;

/**
 * When to buy what, grouped by month so it reads as a shopping calendar
 * rather than a bill of materials.
 *
 * Quantities come from seedBoqForPlan — called ONE PLANTING AT A TIME rather
 * than re-deriving the spacing/germination-buffer maths here. That is
 * deliberate: seedBoqForPlan aggregates by summing a per-planting rounded
 * count, so slicing it this way makes the per-crop totals in this schedule add
 * up to exactly what the on-screen "Seeds & seedlings" card shows, by
 * construction, with no second copy of the maths to drift.
 *
 * `existing` (already-growing) plantings are skipped — seedBoqForPlan skips
 * them too, because there is nothing left to buy for a crop already in the
 * ground.
 */
export function buildBuyingSchedule(
  plantings: Planting[],
  beds: PlanBed[],
  nowMonth: number,
): BuyingMonth[] {
  const merged = new Map<string, BuyingItem>();

  for (const p of plantings) {
    if (p.existing) continue;
    const crop = cropByKey(p.cropKey);
    const bed = beds.find((b) => b.id === p.bedId);
    if (!crop || !bed) continue;
    const boq = seedBoqForPlan([p], beds)[0];
    if (!boq) continue;

    const sowMonth = wrapMonth(p.sowMonth);
    const bedMonth = crop.transplant ? wrapMonth(sowMonth + 1) : sowMonth;
    const buyMonth = wrapMonth(sowMonth - BUY_LEAD_MONTHS);
    const key = `${crop.key}::${buyMonth}`;

    const existing = merged.get(key);
    if (existing) {
      existing.count += boq.count;
      if (!existing.bedLabels.includes(bed.label)) existing.bedLabels.push(bed.label);
      continue;
    }
    merged.set(key, {
      cropKey: crop.key,
      cropName: crop.name,
      icon: crop.icon,
      unit: boq.unit,
      count: boq.count,
      buyMonth,
      sowMonth,
      bedMonth,
      harvestMonth: harvestMonth(sowMonth, crop.daysToHarvest),
      transplant: !!crop.transplant,
      bedLabels: [bed.label],
      note: buyingNote(boq.unit, !!crop.transplant, sowMonth, bedMonth),
    });
  }

  const byMonth = new Map<number, BuyingItem[]>();
  for (const item of merged.values()) {
    const list = byMonth.get(item.buyMonth) ?? [];
    list.push(item);
    byMonth.set(item.buyMonth, list);
  }

  return rollingMonths(nowMonth)
    .map((month) => ({
      month,
      items: (byMonth.get(month) ?? []).sort((a, b) => b.count - a.count || a.cropName.localeCompare(b.cropName)),
    }))
    .filter((m) => m.items.length > 0);
}

/**
 * The "why this month" sentence. Three genuinely different stories:
 *  - seed for trays: buy it, sow trays next month, plant out the month after;
 *  - living propagation material (slips, seed potatoes): it is a piece of
 *    plant, not a packet — it does not sit in a drawer for a season;
 *  - plain seed: it keeps, so buying a month early is pure insurance against
 *    the shop being out of stock on the week you need it.
 */
function buyingNote(unit: string, transplant: boolean, sowMonth: number, bedMonth: number): string {
  if (transplant) {
    return `Sow into trays in ${monthLong(sowMonth)}, plant the seedlings out in ${monthLong(bedMonth)} `
      + `(about six weeks in the tray). Buying ready-grown seedlings instead? Get those in ${monthLong(bedMonth)}.`;
  }
  if (unit === 'slips' || unit === 'seed potatoes') {
    return `Living planting material — buy it close to planting in ${monthLong(sowMonth)}, not months early, `
      + `and keep it cool and dry until it goes in.`;
  }
  return `Sow straight into the ground in ${monthLong(sowMonth)}. Seed keeps, so having it in hand a month `
    + `early costs nothing and covers the shop being out of stock.`;
}

/** Per-crop totals across the whole schedule — the cross-check against the on-screen BOQ. */
export function buyingScheduleTotals(schedule: BuyingMonth[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const month of schedule) {
    for (const item of month.items) {
      totals.set(item.cropKey, (totals.get(item.cropKey) ?? 0) + item.count);
    }
  }
  return totals;
}

// ── Tasks grouped for printing ──────────────────────────────────────────────

export interface TaskMonth {
  month: number;
  tasks: CropTask[];
}

/** The plan's tasks, in rolling reading order from the current month. Empty months are dropped. */
export function buildTaskMonths(tasks: CropTask[], nowMonth: number): TaskMonth[] {
  return rollingMonths(nowMonth)
    .map((month) => ({ month, tasks: tasks.filter((t) => t.month === month) }))
    .filter((m) => m.tasks.length > 0);
}
