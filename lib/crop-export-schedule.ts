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
import { MONTHS_SHORT, cropByKey, plantSpacingCm, plantSpacingRangeCm } from '@/lib/crop-catalog';
import type { CropTask, PlanBed, Planting, SeedBoqRow } from '@/lib/crop-plan';
import {
  bedEntryMonth,
  estimatedYieldKgAdjusted,
  harvestMonthForCrop,
  latestBedEntryMonth,
  seedBoqBatchesForPlan,
  taskMonthsFromNow,
} from '@/lib/crop-plan';

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** KZN DARD Plant Establishment: most vegetable transplants are ready in
 * 4–6 weeks under warm conditions, while cold conditions can double that
 * period. The calendar remains month-sized, so readiness—not the column edge—
 * decides the real planting-out day. */
export const TRANSPLANT_NURSERY_GUIDANCE = 'Usually 4–6 weeks in warm conditions; cold conditions can take about twice as long (8–12 weeks). Start checking from the first readiness month and transplant when seedlings and the bed are ready. The bed calendar uses the middle month as its working transplant date; update the planting if the seedlings are delayed.';

/** The source describes maturity under optimum conditions. A reserved month is
 * therefore a planning slot, never evidence that the previous crop has left
 * the ground. Keep this wording shared by screen and print exports. */
export const SUCCESSION_TIMING_GUIDANCE = 'Published optimum-condition maturity endpoints are planning slots, not promises. Before any successor is sown or transplanted, confirm the previous crop is finished and the bed is actually clear; crops may mature later.';

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
 * Farmer-facing "how to sow" line. BOTH axes, always, and both resolved by
 * plantSpacingCm — the same helper the material BOQ uses for its approximate
 * final stand, so the spacing on the page and the field-position estimate
 * cannot disagree.
 *
 * They did disagree until 2026-08-04: the printed plan read "Dry beans ~11362
 * seeds · 15cm apart in the row" while 11362 was counted on a 10cm square.
 * Garlic printed "rows 25cm apart" and nothing else — an instruction nobody
 * can plant from. Never fabricates: every number here is on the crop record.
 */
export function sowingInstruction(crop: CropDef): string {
  if (crop.fieldSpacingInstruction) return crop.fieldSpacingInstruction;
  const parts: string[] = [];
  const { rowCm, inRowCm } = plantSpacingCm(crop);
  const ranges = plantSpacingRangeCm(crop);
  const row = formatCmRange(ranges.rowCm);
  const inRow = formatCmRange(ranges.inRowCm);
  const bothAreExact = ranges.rowCm[0] === ranges.rowCm[1]
    && ranges.inRowCm[0] === ranges.inRowCm[1];
  if (bothAreExact && rowCm === inRowCm) parts.push(`plant spacing ${row}cm each way`);
  else parts.push(`rows ${row}cm apart`, `${inRow}cm apart in the row`);
  const depth = sowDepthRange(crop);
  if (depth) parts.push(`sow ${formatCmRange(depth)}cm deep`);
  return parts.join(' · ');
}

function formatCmRange(range: readonly [number, number]): string {
  return range[0] === range[1] ? String(range[0]) : `${range[0]}–${range[1]}`;
}

function sowDepthRange(crop: CropDef): readonly [number, number] | null {
  return crop.sowDepthRangeCm
    ?? (crop.sowDepthCm ? [crop.sowDepthCm, crop.sowDepthCm] as const : null);
}

function fieldSpacingInstruction(crop: CropDef): string {
  if (crop.fieldSpacingInstruction) return crop.fieldSpacingInstruction;
  const { rowCm, inRowCm } = plantSpacingCm(crop);
  const ranges = plantSpacingRangeCm(crop);
  const bothAreExact = ranges.rowCm[0] === ranges.rowCm[1]
    && ranges.inRowCm[0] === ranges.inRowCm[1];
  return bothAreExact && rowCm === inRowCm
    ? `plant spacing ${formatCmRange(ranges.rowCm)}cm each way`
    : `rows ${formatCmRange(ranges.rowCm)}cm apart · ${formatCmRange(ranges.inRowCm)}cm apart in the row`;
}

// Verb phrase per task action — 'prep'/'mulch' need a bit more than a single
// word to say what's actually involved (soil assessment, water-in), the
// others read fine as plain verbs.
export const TASK_VERB: Record<CropTask['action'], string> = {
  prep: 'assess soil and drainage before preparing ground for',
  sow: 'sow',
  transplant: 'check seedlings; transplant when ready',
  mulch: 'water in & mulch',
  harvest: 'harvest',
  'terminate-cover': 'cut or roll down',
  'weed-early': 'weed around',
  'weed-mid': 'weed & check for pests around',
};

/** Title-case label for the same actions — for a calendar event's SUMMARY line. */
export const TASK_TITLE: Record<CropTask['action'], string> = {
  prep: 'Prep ground',
  sow: 'Sow',
  transplant: 'Check / transplant',
  mulch: 'Water in & mulch',
  harvest: 'Harvest',
  'terminate-cover': 'Cut or roll down',
  'weed-early': 'Weed',
  'weed-mid': 'Weed & check for pests',
};

/** One task as a sentence fragment: "sow maize (mielies) — rows 90cm apart (Plot 1)". */
export function taskPhrase(t: CropTask): string {
  const crop = (t.action === 'sow' || t.action === 'transplant') ? cropByKey(t.cropKey) : undefined;
  let instruction = '';
  if (crop && t.action === 'sow') {
    const trayDepth = sowDepthRange(crop);
    instruction = crop.transplant
      ? ` — start in a tray${trayDepth ? `, ${formatCmRange(trayDepth)}cm deep` : ''}`
      : ` — ${sowingInstruction(crop)}`;
  } else if (crop?.transplant && t.action === 'transplant') {
    instruction = ` — ${fieldSpacingInstruction(crop)}`;
  }
  // Prep wording is per-ground: tasksForPlan says plough/rip for a staple PLOT and
  // soil-assessment wording for a bed (CropTask.prepText); the static verb is the fallback.
  const verb = (t.action === 'prep' && t.prepText) ? `${t.prepText} for` : TASK_VERB[t.action];
  return `${verb} ${t.cropName.toLowerCase()}${instruction} (${t.bedLabel})`;
}

/**
 * The how-to half of `taskPhrase` — spacing, depth, or the ground-prep wording —
 * with no verb, crop name or bed attached.
 *
 * WHY THIS IS SEPARATE. `taskPhrase` bakes the how-to into every single task, and
 * the how-to for a crop is IDENTICAL on every bed. Rory, 2026-09-04, looking at a
 * twelve-bed plan: "i cant see whats happening on the tasks". He was reading
 * "sow cucumber — rows 120-140cm apart · 35-50cm apart in the row · sow 2-3cm
 * deep (Bed 1)" and then the same twenty-two words again for Bed 7, Bed 8, Bed 10
 * and Bed 11. A grouped view states it once and lists the beds.
 *
 * Returns null when the action carries no how-to, so a caller can tell "nothing to
 * say" from an empty string it would have to render anyway.
 */
export function taskDetail(t: CropTask): string | null {
  const crop = (t.action === 'sow' || t.action === 'transplant') ? cropByKey(t.cropKey) : undefined;
  if (crop && t.action === 'sow') {
    const trayDepth = sowDepthRange(crop);
    return crop.transplant
      ? `start in a tray${trayDepth ? `, ${formatCmRange(trayDepth)}cm deep` : ''}`
      : sowingInstruction(crop);
  }
  if (crop?.transplant && t.action === 'transplant') return fieldSpacingInstruction(crop);
  if (t.action === 'prep' && t.prepText) return t.prepText;
  return null;
}

/** One crop's work of a single kind, and every bed it is due on. */
export interface TaskCropRow {
  cropKey: string;
  cropName: string;
  icon: string;
  /** Every bed needing this action on this crop, in the order the tasks arrived. */
  bedLabels: string[];
  /** The how-to, said once for the whole row. Null when the action carries none. */
  detail: string | null;
  /** The underlying task ids, so a caller can still reach each individual job. */
  taskIds: string[];
}

/** One kind of work — all the sowing, or all the prep — across every crop and bed. */
export interface TaskActionGroup {
  action: CropTask['action'];
  /** TASK_TITLE's wording, so the grouped view speaks the app's own vocabulary. */
  label: string;
  /** How many individual jobs this group collapses. */
  jobCount: number;
  crops: TaskCropRow[];
}

/**
 * The order a farmer actually works through a month: ground first, seed in, then
 * tending, then picking. NOT alphabetical, and not the order tasksForPlan happens
 * to emit them in.
 */
const TASK_ACTION_ORDER: readonly CropTask['action'][] = [
  'prep', 'sow', 'transplant', 'weed-early', 'weed-mid', 'mulch', 'harvest', 'terminate-cover',
];

/**
 * Collapse a month's tasks into one row per crop per kind of work.
 *
 * Rows are keyed by crop AND detail, not crop alone: `prepText` differs by ground
 * kind — a 1.2x3m bed gets the compost-and-rest wording, a quarter-hectare staple
 * plot gets plough/manure — so the same crop on both would otherwise be merged
 * under one of the two wordings and the other silently lost.
 */
export function groupTasksByAction(tasks: CropTask[]): TaskActionGroup[] {
  const byAction = new Map<CropTask['action'], Map<string, TaskCropRow>>();
  for (const t of tasks) {
    const detail = taskDetail(t);
    const rows = byAction.get(t.action) ?? new Map<string, TaskCropRow>();
    // \u0000 cannot appear in a crop key or an instruction, so it is a safe joiner.
    const key = `${t.cropKey}\u0000${detail ?? ''}`;
    const row = rows.get(key) ?? {
      cropKey: t.cropKey, cropName: t.cropName, icon: t.icon,
      bedLabels: [], detail, taskIds: [],
    };
    // A crop can hold two cycles on one bed in the same month; the bed is named once.
    if (!row.bedLabels.includes(t.bedLabel)) row.bedLabels.push(t.bedLabel);
    row.taskIds.push(t.id);
    rows.set(key, row);
    byAction.set(t.action, rows);
  }
  return TASK_ACTION_ORDER
    .filter((action) => byAction.has(action))
    .map((action) => {
      const crops = [...byAction.get(action)!.values()];
      return {
        action,
        label: TASK_TITLE[action],
        jobCount: crops.reduce((n, row) => n + row.taskIds.length, 0),
        crops,
      };
    });
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
  /** Earliest month a tray crop may occupy the bed. */
  bedMonth: number;
  /** Conservative latest field-entry month for a tray crop. */
  bedMonthLatest: number;
  /** Null when the crop's duration is not source-verified. */
  harvestMonth: number | null;
  /** Last month of the fresh-picking window (= harvestMonth for a one-shot harvest). */
  harvestEndMonth: number | null;
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
      const h = crop.timingVerified === false ? null : harvestMonthForCrop(p.sowMonth, crop);
      crops.push({
        cropKey: crop.key,
        cropName: crop.name,
        icon: crop.icon,
        sowMonth: p.sowMonth,
        bedMonth: bedEntryMonth(p.sowMonth, crop),
        bedMonthLatest: latestBedEntryMonth(p.sowMonth, crop),
        harvestMonth: h,
        harvestEndMonth: h === null ? null : wrapMonth(h + (crop.harvestWindowMonths ?? 0)),
        transplant: !!crop.transplant,
        existing: !!p.existing,
        shareLabel: bedShareLabel(fraction),
        // A FOURTH copy of the yield formula used to live here, so bed rows and
        // the annual total could disagree. Ask the one area-scaled benchmark
        // function instead; it deliberately applies no generic intercropping
        // multiplier without evidence for the named crop pair and layout.
        estimatedKg: estimatedYieldKgAdjusted(p, bed.areaM2, plantings),
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
  /** 'seeds' | 'seedlings' | 'slips' | 'seed potatoes' | 'cloves' | 'corms'. */
  unit: string;
  /** Piece count for living material; null for packet seed or unverified spacing. */
  count: number | null;
  countRange: readonly [number, number] | null;
  quantityStatus: SeedBoqRow['quantityStatus'];
  /** Representative internal midpoint; display the range below to farmers. */
  finalPlantPositions: number;
  finalPlantPositionsRange: readonly [number, number];
  /**
   * Shopping-calendar marker (1-12). For botanical seed this is the named
   * sow/tray month, because the catalogue has no sourced procurement lead.
   */
  buyMonth: number;
  sowMonth: number;
  bedMonth: number;
  bedMonthLatest: number;
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
 * When to buy what, grouped by month so it reads as a shopping calendar
 * rather than a bill of materials.
 *
 * Quantities come from seedBoqBatchesForPlan, the same cohort-level authority
 * the on-screen total uses. Splits of one crop in one sowing month are summed
 * before rounding; separate succession months remain separate shopping trips.
 * Botanical seed intentionally has no inferred buy count: field spacing proves
 * an approximate final stand, not the packet quantity needed to establish it.
 *
 * `existing` (already-growing) plantings are skipped — seedBoqBatchesForPlan
 * skips them too, because there is nothing left to buy for a crop already in
 * the ground. A settled one-time starter still holding its nursery stamp
 * (Planting.inNursery) is the one exception: its trays are sown but its field
 * entry is not, so the ready-grown-seedling purchase is still ahead of it.
 */
export function buildBuyingSchedule(
  plantings: Planting[],
  beds: PlanBed[],
  nowMonth: number,
): BuyingMonth[] {
  const items: BuyingItem[] = [];

  for (const boq of seedBoqBatchesForPlan(plantings, beds)) {
    const crop = cropByKey(boq.cropKey);
    if (!crop) continue;
    const sowMonth = boq.sowMonth;
    const bedMonth = bedEntryMonth(sowMonth, crop);
    const bedMonthLatest = latestBedEntryMonth(sowMonth, crop);
    // Ready-grown seedlings belong close to field planting. All other lines
    // use the sow/plant month as their calendar marker. In particular, packet
    // seed has no invented one-month procurement lead: its note says to source
    // it before the named sow month without pretending the source gives an
    // exact earlier month.
    const buyMonth = crop.transplant ? bedMonth : sowMonth;
    const bedLabels = boq.bedIds
      .map((bedId) => beds.find((bed) => bed.id === bedId)?.label)
      .filter((label): label is string => label !== undefined);
    items.push({
      cropKey: crop.key,
      cropName: crop.name,
      icon: crop.icon,
      unit: boq.unit,
      count: boq.count,
      countRange: boq.countRange,
      quantityStatus: boq.quantityStatus,
      finalPlantPositions: boq.finalPlantPositions,
      finalPlantPositionsRange: boq.finalPlantPositionsRange,
      buyMonth,
      sowMonth,
      bedMonth,
      bedMonthLatest,
      harvestMonth: harvestMonthForCrop(sowMonth, crop),
      transplant: !!crop.transplant,
      bedLabels,
      note: buyingNote(
        boq.unit,
        !!crop.transplant,
        sowMonth,
        bedMonth,
        bedMonthLatest,
        boq.finalPlantPositionsRange,
        boq.quantityStatus,
        boq.inNursery,
      ),
    });
  }

  const byMonth = new Map<number, BuyingItem[]>();
  for (const item of items) {
    const list = byMonth.get(item.buyMonth) ?? [];
    list.push(item);
    byMonth.set(item.buyMonth, list);
  }

  return rollingMonths(nowMonth)
    .map((month) => ({
      month,
      items: (byMonth.get(month) ?? []).sort((a, b) =>
        b.finalPlantPositions - a.finalPlantPositions || a.cropName.localeCompare(b.cropName)),
    }))
    .filter((m) => m.items.length > 0);
}

/**
 * The "why this month" sentence. Three genuinely different stories:
 *  - seed for trays: source it before tray sowing, then plant out when ready
 *    within the supported nursery-duration range;
 *  - living propagation material (slips, corms, seed potatoes): it is a piece of
 *    plant, not a packet — it does not sit in a drawer for a season;
 *  - plain seed: the final stand is shown, but the packet's crop-specific
 *    direct-sowing rate decides how much seed to buy.
 */
function buyingNote(
  unit: string,
  transplant: boolean,
  sowMonth: number,
  bedMonth: number,
  bedMonthLatest: number,
  finalPlantPositionsRange: readonly [number, number],
  quantityStatus: SeedBoqRow['quantityStatus'],
  inNursery = false,
): string {
  if (transplant) {
    const quantity = quantityStatus === 'spacing-confirmation-required'
      ? 'Confirm the local row layout before deciding how many are needed. '
      : `The mapped area holds about ${positionRangeLabel(finalPlantPositionsRange)} plants at the spacings this plan uses. This is not a guaranteed seedling order and it allows nothing for plants that do not take; ask your supplier what they advise for this crop. `;
    const fieldWindow = bedMonth === bedMonthLatest
      ? monthLong(bedMonth)
      : `${monthLong(bedMonth)}–${monthLong(bedMonthLatest)}`;
    return `Buying ready-grown seedlings? Source them only when the bed and seedlings are ready; the planning window is ${fieldWindow}. ${quantity}`
      + (inNursery
        // The tray-sowing month is behind the farmer, so the "raise your own"
        // half is spent — printing it in October tells them to buy packet seed
        // for a month that has gone.
        ? `This one-time starter's tray-sowing month (${monthLong(sowMonth)}) has passed, so buying ready-grown seedlings is the remaining route. `
        : `Raising your own instead? Source packet seed before the ${monthLong(sowMonth)} tray-sowing month, use its tray-sowing rate, and sow trays in ${monthLong(sowMonth)}. `)
      + TRANSPLANT_NURSERY_GUIDANCE;
  }
  if (quantityStatus === 'spacing-confirmation-required') {
    return `Confirm a locally appropriate row layout before buying planting material; the catalog does not have both verified spacing axes needed for an exact quantity. Plan to establish it in ${monthLong(sowMonth)}.`;
  }
  if (unit !== 'seeds') {
    return `Living planting material — the mapped area holds about ${positionRangeLabel(finalPlantPositionsRange)} ${unit} at the spacings this plan uses. This is not a guaranteed buy quantity and it allows nothing for material that does not take; ask the supplier what they advise for this crop. Get it close to planting in ${monthLong(sowMonth)}, then follow the supplier's or your local handling advice. No general storage advice is assumed here.`;
  }
  return `Source packet seed before the ${monthLong(sowMonth)} sowing month. Sow straight into the ground in ${monthLong(sowMonth)} for about ${positionRangeLabel(finalPlantPositionsRange)} plants at the spacings this plan uses. `
    + `Use the packet's crop-specific direct-sowing rate and germination guidance; field spacing alone cannot tell you how much seed to buy.`;
}

export function positionRangeLabel(range: readonly [number, number]): string {
  const minimum = range[0].toLocaleString('en-ZA');
  const maximum = range[1].toLocaleString('en-ZA');
  return range[0] === range[1] ? minimum : `${minimum}–${maximum}`;
}

/** Per-crop totals across the whole schedule — the cross-check against the on-screen BOQ. */
export function buyingScheduleTotals(schedule: BuyingMonth[]): Map<string, number | null> {
  const totals = new Map<string, number | null>();
  for (const month of schedule) {
    for (const item of month.items) {
      const prior = totals.get(item.cropKey);
      totals.set(
        item.cropKey,
        item.count === null || prior === null ? null : (prior ?? 0) + item.count,
      );
    }
  }
  return totals;
}

// ── Tasks grouped for printing ──────────────────────────────────────────────

export interface TaskMonth {
  month: number;
  /** Concrete offset from the current month. Two entries may name November,
   * but offset 0 and offset 12 are different years and must not be merged. */
  monthsAway: number;
  tasks: CropTask[];
}

/** The plan's tasks in real cohort order from the current month. Empty months
 * are dropped, and a harvest after a next-year sowing remains after that
 * sowing even when both cross a second November. */
export function buildTaskMonths(tasks: CropTask[], nowMonth: number): TaskMonth[] {
  const byOffset = new Map<number, CropTask[]>();
  for (const task of tasks) {
    const monthsAway = taskMonthsFromNow(task, nowMonth);
    if (monthsAway < 0) continue;
    const rows = byOffset.get(monthsAway) ?? [];
    rows.push(task);
    byOffset.set(monthsAway, rows);
  }
  return [...byOffset.entries()]
    .sort(([a], [b]) => a - b)
    .map(([monthsAway, rows]) => ({
      month: wrapMonth(nowMonth + monthsAway),
      monthsAway,
      tasks: rows.sort((a, b) => a.bedLabel.localeCompare(b.bedLabel) || a.id.localeCompare(b.id)),
    }));
}
