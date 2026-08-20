// ── The crop plan reorganised around who reads it ───────────────────────────
//
// The old export was one long scroll: cover, bed list, buying list, then a
// month-by-month wall of single-action lines. Every fact was there and none of
// it was addressed to anybody. A garden manager deciding labour, a buyer
// placing an order and a field worker doing Tuesday's job all had to read the
// same undifferentiated text and extract their own view.
//
// This module builds the five views a crop plan is actually used through:
//
//   1. DASHBOARD    — scale, crop-cycle benchmark, fresh windows, decisions
//   2. YEAR IN NUMBERS — workload by month, biggest benchmarked crops
//   3. LAND OCCUPANCY  — every bed and plot across all twelve months at once
//   4. FULL PLAN       — every planting, as columns instead of prose
//   5. WORKING DOCS    — a monthly field sheet you tick off, and a harvest record
//
// Everything here is PURE DATA. The renderer (lib/crop-export-pdf.ts) decides
// what it looks like; nothing in this file knows about paper. That split is
// what makes the numbers testable — the interrogation suite asserts on these
// builders directly rather than trying to read a PDF back.
//
// It also fixes a real defect by construction. The old month list printed
// "Sow tomatoes - rows 90cm apart - 40cm apart in the row" in the month the
// seed goes into TRAYS, where row spacing is meaningless and actively wrong.
// Here a tray sowing is a NURSERY row and the field spacing travels with the
// transplant, because they are different sections of the sheet.

import type { CropDef } from '@/lib/crop-catalog';
import { cropByKey, plantSpacingCm, plantSpacingRangeCm } from '@/lib/crop-catalog';
import type { FoodGroup } from '@/lib/crop-groups';
import { foodGroupOf } from '@/lib/crop-groups';
import type { CropTask, PlanBed, Planting } from '@/lib/crop-plan';
import {
  bedEntryMonth,
  buildFoodAvailability,
  buildPlanYieldBenchmark,
  estimatedYieldKgAdjusted,
  harvestMonthForCrop,
  latestBedEntryMonth,
  plannedBedEntryMonth,
  plantingBedEntryOffsets,
  taskMonthsFromNow,
  yieldByCrop,
} from '@/lib/crop-plan';
import { MONTH_NAMES, monthShort, rollingMonths, wrapMonth } from '@/lib/crop-export-schedule';

// ── 1. Dashboard ────────────────────────────────────────────────────────────

export interface DashboardStat {
  value: string;
  label: string;
  detail: string;
}

export interface PlanDashboard {
  stats: DashboardStat[];
  /** Observations read straight off the plan's own numbers — never advice. */
  signals: string[];
  /** Questions the plan cannot answer for the reader. Prompts, not instructions. */
  decisions: string[];
  grossKg: number | null;
  /** Null until a loss allowance has been explicitly confirmed. */
  netKg: number | null;
  /** Months with at least one verified fresh-picking window. Timing only. */
  freshPickingMonths: number;
  /** Months in which something harvested earlier is still inside the sourced
   * shelf life the catalog carries for it — counted whether or not the same
   * month also has a fresh window, so the two stats are independent readings of
   * the same year rather than a partition of it. */
  storedFoodMonths: number;
  /** The crops behind storedFoodMonths, alphabetically. Empty when a plan holds
   * nothing with a sourced shelf life — which is a real answer, not a zero. */
  storedFoodCrops: string[];
  /** Food crops omitted from every kg figure because the catalog has no
   * verified kg/m² benchmark for them. */
  unknownYieldCrops: string[];
  /** Whether any crop in the plan can honestly support a kg comparison. */
  hasKnownYield: boolean;
  /** Beds that must be resolved before a kg or Rand total is defensible. */
  areaConflictBedLabels: string[];
}

export interface DashboardOptions {
  lossPercent?: number;
  /** A stored/default 0 is not evidence that the farmer confirmed 0% loss. */
  lossAllowanceConfirmed?: boolean;
  nowMonth: number;
}

/**
 * Page one answers "how big, what is the crop-cycle benchmark, when is work
 * busiest, what must I decide"
 * before it shows a single planting. Every stat is derived, never stored: the
 * gross figure sums the SAME per-planting function the bed tables print, so the
 * cover and the detail cannot drift (they did, by 26kg, until 2026-08-05).
 */
export function buildPlanDashboard(
  plantings: Planting[],
  beds: PlanBed[],
  tasks: CropTask[],
  opts: DashboardOptions,
): PlanDashboard {
  const lossConfirmed = opts.lossAllowanceConfirmed === true;
  const loss = Math.max(0, Math.min(100, opts.lossPercent ?? 0));
  const areaM2 = beds.reduce((s, b) => s + b.areaM2, 0);

  const bedIds = new Set(beds.map((bed) => bed.id));
  const accountedPlantings = plantings.filter((planting) => bedIds.has(planting.bedId));
  const benchmark = buildPlanYieldBenchmark(accountedPlantings, beds, opts.nowMonth);
  const grossKg = benchmark.knownKg;
  const netKg = lossConfirmed && grossKg !== null ? grossKg * (1 - loss / 100) : null;
  const unknownYieldCrops = benchmark.unknownYieldCrops;
  const areaConflictBedLabels = benchmark.areaConflictBedLabels;
  const hasKnownYield = grossKg !== null && benchmark.byCrop.length > 0;
  const availability = buildFoodAvailability(accountedPlantings, beds, opts.nowMonth);
  const freshPickingMonths = availability.slice(1, 13)
    .filter((month) => month.some((item) => item.status === 'fresh')).length;
  const storedFoodMonths = availability.slice(1, 13)
    .filter((month) => month.some((item) => item.status === 'stored')).length;
  const storedFoodCrops = [...new Set(
    availability.slice(1, 13).flatMap((month) => month
      .filter((item) => item.status === 'stored')
      .map((item) => item.name)),
  )].sort((a, b) => a.localeCompare(b));

  const workload = buildWorkloadSeries(tasks, opts.nowMonth);
  const busiest = [...workload].sort((a, b) => b.count - a.count).slice(0, 3)
    .sort((a, b) => workload.findIndex((w) => w.month === a.month) - workload.findIndex((w) => w.month === b.month));

  const bedCount = beds.filter((b) => b.kind !== 'plot').length;
  const plotCount = beds.filter((b) => b.kind === 'plot').length;

  const stats: DashboardStat[] = [
    {
      value: `${areaM2.toFixed(1)} m2`,
      label: 'growing space',
      detail: `${bedCount} bed${bedCount === 1 ? '' : 's'}${plotCount ? ` + ${plotCount} staple plot${plotCount === 1 ? '' : 's'}` : ''}`,
    },
    {
      value: hasKnownYield ? `${grossKg!.toFixed(1)} kg` : 'Not shown',
      label: areaConflictBedLabels.length ? 'benchmark total blocked' : 'known benchmark total',
      detail: areaConflictBedLabels.length
        ? `resolve overlapping shares in ${areaConflictBedLabels.join(', ')}`
        : hasKnownYield ? 'verified kg/m² crop entries only' : 'no verified kg/m² crop entry',
    },
    lossConfirmed
      ? {
        value: hasKnownYield && netKg !== null ? `${netKg.toFixed(1)} kg` : 'Not shown',
        label: `known total after ${loss}% loss`,
        detail: 'uses the loss allowance you confirmed',
      }
      : {
        value: 'Not calculated',
        label: 'loss-adjusted total',
        detail: 'confirm a loss allowance from actual records',
      },
    {
      value: `${freshPickingMonths}/12`,
      label: 'fresh-picking months',
      detail: 'timing windows only; no monthly kg inferred',
    },
  ];

  const signals: string[] = [];
  const top = benchmark.byCrop.slice(0, 2).map((entry) => ({
    ...entry,
    group: foodGroupOf(cropByKey(entry.cropKey)!),
  }));
  if (areaConflictBedLabels.length) {
    signals.push(`${areaConflictBedLabels.join(', ')} ${areaConflictBedLabels.length === 1 ? 'has' : 'have'} overlapping or invalid planting shares, so every kg and value subtotal is withheld.`);
  } else if (top[0]) {
    signals.push(`${top[0].name} has the largest known benchmark volume at ${top[0].kg.toFixed(1)} kg.`);
  }
  if (!areaConflictBedLabels.length && top[1]) signals.push(`${top[1].name} follows in the benchmark comparison at ${top[1].kg.toFixed(1)} kg.`);
  if (unknownYieldCrops.length) {
    signals.push(`${unknownYieldCrops.join(', ')} ${unknownYieldCrops.length === 1 ? 'has' : 'have'} no verified kg/m² benchmark and ${unknownYieldCrops.length === 1 ? 'is' : 'are'} excluded from every kg total, not counted as 0kg.`);
  } else if (!hasKnownYield) {
    signals.push('No crop in this plan has a verified kg/m² food-yield benchmark, so no kilogram comparison is shown.');
  }
  if (busiest.length) {
    // THE CAVEAT TRAVELS WITH THE CLAIM. It used to live alone on page 2, three pages away from
    // the staffing decision below — so page 1 read as a measured labour finding when it is a count
    // of planned jobs, each of unknown length. A funder reads page 1 and hires against it.
    const names = busiest.map((b) => monthShort(b.month));
    signals.push(`${names.join(', ')} carry the most planned jobs — counted as jobs, not hours.`);
  }
  const idle = idleBedMonths(plantings, beds, opts.nowMonth);
  if (idle.count > 0) {
    signals.push(`${idle.count} bed-month${idle.count === 1 ? '' : 's'} of the year have no crop in the ground.`);
  }

  const decisions: string[] = [];
  if (areaConflictBedLabels.length) {
    decisions.push(`Resolve the planting shares in ${areaConflictBedLabels.join(', ')} before using any crop benchmark or value scenario.`);
  } else if (top[0]) {
    decisions.push(`Compare the ${top[0].name.toLowerCase()} benchmark with actual harvest records before planning storage or sales.`);
  }
  decisions.push('Check actual household demand and recorded harvests; the benchmark comparison is not a meal or surplus guarantee.');
  if (busiest.length) {
    decisions.push(`Check who is available before the ${monthShort(busiest[0].month)}-${monthShort(busiest[busiest.length - 1].month)} job peak, and time the work against real hours.`);
  }
  if (!lossConfirmed) decisions.push('Confirm a loss allowance from actual records before calculating a usable total.');

  return { stats, signals, decisions, grossKg, netKg, freshPickingMonths, storedFoodMonths, storedFoodCrops, unknownYieldCrops, hasKnownYield, areaConflictBedLabels };
}

/** Bed-months with nothing in the ground — the honest counterweight to a big total. */
export function idleBedMonths(plantings: Planting[], beds: PlanBed[], nowMonth?: number): { count: number; total: number } {
  if (nowMonth !== undefined) {
    const rows = buildOccupancyCalendar(plantings, beds, nowMonth);
    const count = rows.reduce(
      (sum, row) => sum + row.cells.filter((cell) => cell.length === 0).length,
      0,
    );
    return { count, total: beds.length * 12 };
  }
  const occupied = new Map<string, Set<number>>();
  for (const p of plantings) {
    const crop = cropByKey(p.cropKey);
    if (!crop) continue;
    let set = occupied.get(p.bedId);
    if (!set) { set = new Set(); occupied.set(p.bedId, set); }
    for (const m of holdMonths(p.sowMonth, crop)) set.add(m);
  }
  let count = 0;
  for (const bed of beds) count += 12 - (occupied.get(bed.id)?.size ?? 0);
  return { count, total: beds.length * 12 };
}

/**
 * The months a planting physically holds its GROUND: from the month it enters
 * the bed to the end of its fresh-harvest window. A bed being picked is still a
 * bed in use — that half of the span matches the planner's own occupancy model.
 *
 * The other half deliberately does not. A tray crop's sow month is spent in the
 * nursery, not in the bed, so a page headed "land occupancy" that starts the bar
 * at the tray sowing shows a bed as full while it is standing empty. Same
 * distinction the field sheets make, applied to the calendar.
 */
function holdMonths(sowMonth: number, crop: CropDef): number[] {
  // Unknown duration cannot honestly become an occupancy bar or idle-ground
  // deduction. Keep the legacy crop record elsewhere, but exclude it from
  // numeric land-use claims until its finish date is locally confirmed.
  if (crop.timingVerified === false) return [];
  const h = harvestMonthForCrop(sowMonth, crop);
  const span = crop.harvestWindowMonths ?? 0;
  const out: number[] = [];
  let m = bedEntryMonth(sowMonth, crop);
  for (let guard = 0; guard < 24; guard++) {
    out.push(m);
    if (m === wrapMonth(h + span)) break;
    m = wrapMonth(m + 1);
  }
  return out;
}

// ── 2. Year in numbers ──────────────────────────────────────────────────────

export interface MonthCount { month: number; count: number }
export interface CropVolume { cropKey: string; name: string; kg: number; group: FoodGroup }

/**
 * Actions that are part of another job rather than a job of their own, so nothing may count them
 * as a separate visit to the bed.
 *
 * THE FIELD SHEET ALREADY KNEW THIS AND THE CHART DID NOT. `mulch` is emitted at the same month as
 * its own planting's sow or transplant (lib/crop-plan.ts), and buildFieldSheet folds it — see the
 * `case 'mulch'` arm below and the doctrine above it: "WATERING IS NOT A SEPARATE JOB. 'Sow X'
 * followed by 'Water in & mulch X' is one action at the bed, and printing it as two lines doubled
 * the apparent workload of every sowing month."
 *
 * buildWorkloadSeries counted every task with no filter, so it did to the chart exactly what that
 * comment describes fixing on the page: measured on a four-planting plan, sowing months came out
 * up to 50% too high. Page 1 then reads the peak off that curve and prints "carry the heaviest
 * work load" and "assign people and weeks before the … work peak" — a staffing conclusion a funder
 * hires against, drawn from a doubled month.
 *
 * Weeding is deliberately NOT in here: `weed-early` and `weed-mid` get their own Maintenance row,
 * so they are real separate visits. This constant exists so the two readers cannot drift apart
 * again — the fold rule is stated once and imported, not restated.
 */
export const FOLDED_ACTIONS: ReadonlySet<CropTask['action']> = new Set(['mulch']);

/** How many jobs land in each month — the labour curve the kg chart never shows. */
export function buildWorkloadSeries(tasks: CropTask[], nowMonth: number): MonthCount[] {
  const counts = new Map<number, number>();
  for (const t of tasks) {
    if (FOLDED_ACTIONS.has(t.action)) continue;
    const monthsAway = taskMonthsFromNow(t, nowMonth);
    // This chart is explicitly the next twelve months. A later occurrence of
    // the same named month belongs to the following crop year and must not be
    // folded into the current month's workload.
    if (monthsAway < 0 || monthsAway >= 12) continue;
    const month = wrapMonth(nowMonth + monthsAway);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return rollingMonths(nowMonth).map((m) => ({ month: m, count: counts.get(m) ?? 0 }));
}

/** Biggest crops by planned volume, for the "what dominates this plan" bar. */
export function buildTopCrops(plantings: Planting[], beds: PlanBed[], limit = 7): CropVolume[] {
  return yieldByCrop(plantings, beds)
    .slice(0, limit)
    .map((c) => {
      const crop = cropByKey(c.cropKey);
      return {
        cropKey: c.cropKey,
        name: c.name,
        kg: c.kg,
        group: crop ? foodGroupOf(crop) : 'leafy_green',
      };
    });
}

// ── 3. Land occupancy calendar ──────────────────────────────────────────────

export interface CalendarEntry {
  cropKey: string;
  abbr: string;
  /** '1/3', '1/2', 'Full' — what share of the bed this crop holds. */
  share: string;
  group: FoodGroup;
  /** True in months where this planting is being picked, not just growing. */
  harvesting: boolean;
}

export interface CalendarRow {
  bedId: string;
  label: string;
  areaM2: number;
  kind: PlanBed['kind'];
  /** One cell per month, in the plan's reading order. */
  cells: CalendarEntry[][];
}

/**
 * Short codes for the calendar grid, derived — never hand-maintained, because a
 * hand-maintained abbreviation table silently mislabels the day someone adds a
 * crop to the catalog. Two-word names give initials (Green beans -> GB); one
 * word gives its first two letters (Kale -> Ka). Collisions are broken by
 * lengthening the loser, so codes are unique WITHIN a plan and stable for it.
 */
export function cropAbbreviations(plantings: Planting[]): Map<string, string> {
  const keys = [...new Set(plantings.map((p) => p.cropKey))].sort();
  const out = new Map<string, string>();
  const taken = new Set<string>();

  const base = (name: string): string => {
    const clean = name.replace(/\([^)]*\)/g, ' ').replace(/[^A-Za-z ]/g, ' ').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (words[0]?.slice(0, 2) ?? '??').replace(/^./, (c) => c.toUpperCase());
  };

  for (const key of keys) {
    const crop = cropByKey(key);
    if (!crop) continue;
    const letters = crop.name.replace(/\([^)]*\)/g, ' ').replace(/[^A-Za-z]/g, '');
    let code = base(crop.name);
    for (let extra = 2; taken.has(code) && extra < letters.length; extra++) {
      code = letters.slice(0, extra + 1).replace(/^./, (c) => c.toUpperCase());
    }
    let n = 2;
    while (taken.has(code)) code = `${base(crop.name)}${n++}`;
    taken.add(code);
    out.set(key, code);
  }
  return out;
}

/** Every bed and plot across twelve months — the view that shows idle ground at a glance. */
export function buildOccupancyCalendar(
  plantings: Planting[],
  beds: PlanBed[],
  nowMonth: number,
): CalendarRow[] {
  const abbr = cropAbbreviations(plantings);
  return beds.map((bed) => {
    const cells: CalendarEntry[][] = Array.from({ length: 12 }, () => []);
    for (const p of plantings) {
      if (p.bedId !== bed.id) continue;
      const crop = cropByKey(p.cropKey);
      if (!crop) continue;
      if (crop.timingVerified === false) continue;
      const span = holdMonths(p.sowMonth, crop).length;
      // holdMonths and plantingBedEntryOffsets both start at the reserved
      // earliest field-entry edge; measuring the growing (non-harvest) length
      // from the PLANNED month here painted the whole bar one month late and
      // ran it one month past the true bed release for tray crops.
      const entry = bedEntryMonth(p.sowMonth, crop);
      const harvest = harvestMonthForCrop(p.sowMonth, crop);
      const greenSpan = ((harvest - entry) % 12 + 12) % 12;
      for (const start of plantingBedEntryOffsets(p, nowMonth, 12)) {
        for (let lifeMonth = 0; lifeMonth < span; lifeMonth++) {
          const idx = start + lifeMonth;
          if (idx < 0 || idx >= 12) continue;
          cells[idx].push({
            cropKey: p.cropKey,
            abbr: abbr.get(p.cropKey) ?? '??',
            share: shareCode(p.areaFraction ?? 1),
            group: foodGroupOf(crop),
            harvesting: lifeMonth >= greenSpan,
          });
        }
      }
    }
    for (const cell of cells) cell.sort((a, b) => a.abbr.localeCompare(b.abbr));
    return { bedId: bed.id, label: bed.label, areaM2: bed.areaM2, kind: bed.kind, cells };
  });
}

function shareCode(fraction: number): string {
  if (fraction >= 0.99) return 'Full';
  if (Math.abs(fraction - 0.5) < 0.02) return '1/2';
  if (Math.abs(fraction - 1 / 3) < 0.02) return '1/3';
  if (Math.abs(fraction - 0.25) < 0.02) return '1/4';
  return `${Math.round(fraction * 100)}%`;
}

// ── 5. Monthly field sheet ──────────────────────────────────────────────────

export interface FieldSheetRow {
  /** Where the work happens — one bed, or several when the job is identical. */
  place: string;
  work: string;
}

export interface FieldSheetSection {
  title: string;
  rows: FieldSheetRow[];
}

export interface FieldSheet {
  month: number;
  monthLabel: string;
  sourceLines: number;
  workRows: number;
  plantingFocus: number;
  harvestFocus: number;
  sections: FieldSheetSection[];
}

const SECTION_ORDER = [
  'Nursery - raise seedlings',
  'Direct sowing and planting',
  'Prepare for the next planting',
  'Harvest and record',
  'End the cover crop',
  'Maintenance',
] as const;

/**
 * One month of work, as a sheet a person can carry and tick off.
 *
 * Three things happen here that the old flat list never did.
 *
 * NURSERY IS ITS OWN SECTION. A `transplant` crop's sow task puts seed in
 * TRAYS; its field spacing belongs to the readiness-based transplant window. Printing
 * "rows 90cm apart" against a tray sowing was wrong every single time.
 *
 * WATERING IS NOT A SEPARATE JOB. "Sow X" followed by "Water in & mulch X" is
 * one action at the bed, and printing it as two lines doubled the apparent
 * workload of every sowing month.
 *
 * ONE ROW PER BED PER JOB. Four harvest lines on one bed become one row naming
 * the four crops — which is how someone standing at the bed actually works.
 */
export function buildFieldSheet(
  month: number,
  tasks: CropTask[],
  now: Date,
): FieldSheet {
  const nowMonth = now.getMonth() + 1;
  const targetOffset = ((wrapMonth(month) - nowMonth) % 12 + 12) % 12;
  // Printed field sheets cover one actionable year. Resolve each task through
  // its cohort so a next-year November harvest is not printed on the current
  // November sheet merely because both are called "November".
  const mine = tasks.filter((t) => taskMonthsFromNow(t, nowMonth) === targetOffset);
  const mulchedCrops = new Set(mine.filter((t) => t.action === 'mulch').map((t) => `${t.bedLabel}::${t.cropKey}`));

  // A row is one BED and one kind of job. Within it each crop keeps its own
  // spacing in brackets — merging the crops but not their instructions is how
  // "Sow at rows 47cm apart. Sow at about 17cm each way." ended up in one
  // sentence with nothing saying which crop either belonged to.
  interface Bucket {
    sow: string[]; transplant: string[]; plain: string[]; extra: Set<string>;
    waterSow: boolean; waterTransplant: boolean;
  }
  const buckets = new Map<string, Map<string, Bucket>>();
  const bucketFor = (section: string, place: string): Bucket => {
    let byPlace = buckets.get(section);
    if (!byPlace) { byPlace = new Map(); buckets.set(section, byPlace); }
    let entry = byPlace.get(place);
    if (!entry) {
      entry = { sow: [], transplant: [], plain: [], extra: new Set(), waterSow: false, waterTransplant: false };
      byPlace.set(place, entry);
    }
    return entry;
  };

  for (const t of mine) {
    const crop = cropByKey(t.cropKey);
    const watered = mulchedCrops.has(`${t.bedLabel}::${t.cropKey}`);
    const name = t.cropName.toLowerCase();
    switch (t.action) {
      case 'sow':
        if (crop?.transplant) {
          const b = bucketFor('Nursery - raise seedlings', 'Nursery');
          // Keyed crop|||bed so the section build can say "tomatoes for Beds
          // 10, 11, 12" instead of naming the same crop once per bed.
          const trayDepth = sowDepthPhrase(crop);
          b.plain.push(`${name}${trayDepth ? ` (${trayDepth})` : ''}|||${t.bedLabel}`);
          const sowMonth = t.cohortSowMonth ?? t.month;
          const earliest = bedEntryMonth(sowMonth, crop);
          const latest = latestBedEntryMonth(sowMonth, crop);
          b.extra.add(`Start checking in ${monthShort(earliest)}; transplant when ready, within the planning window through ${monthShort(latest)}.`);
        } else {
          const b = bucketFor('Direct sowing and planting', t.bedLabel);
          b.sow.push(`${name} (${spacingPhrase(crop)})`);
          b.waterSow ||= watered;
        }
        break;
      case 'transplant': {
        const b = bucketFor('Direct sowing and planting', t.bedLabel);
        b.transplant.push(`${name} (${spacingPhrase(crop)})`);
        b.waterTransplant ||= watered;
        break;
      }
      case 'prep': {
        const b = bucketFor('Prepare for the next planting', t.bedLabel);
        b.plain.push(name);
        if (t.prepText) b.extra.add(`${capitalise(stripPrepWrapper(t.prepText))}.`);
        break;
      }
      case 'harvest': {
        const b = bucketFor('Harvest and record', t.bedLabel);
        b.plain.push(name);
        b.extra.add('Record kilograms and where it went.');
        break;
      }
      case 'terminate-cover':
        // A green manure is field management, not food. Keeping it out of the
        // harvest bucket prevents the printed sheet from asking for kilograms
        // of biomass that is cut or rolled down for the soil.
        bucketFor('End the cover crop', t.bedLabel).plain.push(name);
        break;
      case 'weed-early':
      case 'weed-mid':
        bucketFor('Maintenance', t.bedLabel).plain.push(name);
        break;
      case 'mulch':
        // Folded into the sow/transplant row above — never its own line, and never its own count.
        // FOLDED_ACTIONS is the single statement of that rule; buildWorkloadSeries reads the same
        // constant, which is what stopped the chart and this sheet disagreeing about the same job.
        break;
    }
  }

  const sections: FieldSheetSection[] = [];
  for (const title of SECTION_ORDER) {
    const byPlace = buckets.get(title);
    if (!byPlace) continue;
    const rows: FieldSheetRow[] = [];
    for (const [place, b] of byPlace) {
      const parts: string[] = [];
      if (title === 'Nursery - raise seedlings') {
        const byCrop = new Map<string, string[]>();
        for (const entry of unique(b.plain)) {
          const [crop, bedLabel] = entry.split('|||');
          const list = byCrop.get(crop);
          if (list) list.push(bedLabel);
          else byCrop.set(crop, [bedLabel]);
        }
        const phrases = [...byCrop.entries()].map(([crop, bedsOf]) => `${crop} for ${compactPlaces(bedsOf)}`);
        parts.push(`Raise and label trays for ${joinList(phrases)}.`);
      }
      else if (title === 'Prepare for the next planting') parts.push(`If this follows another crop, confirm it is finished and the bed is clear; then prepare the ground for ${joinList(unique(b.plain))}.`);
      else if (title === 'Harvest and record') parts.push(`Harvest ${joinList(unique(b.plain))}.`);
      else if (title === 'End the cover crop') parts.push(`Cut or roll down ${joinList(unique(b.plain))} before the next crop.`);
      else if (title === 'Maintenance') parts.push(`Weed and check for pests around ${joinList(unique(b.plain))}.`);
      if (b.sow.length) parts.push(`Sow ${joinList(unique(b.sow))}.`);
      if (b.transplant.length) parts.push(`From this month, transplant ${joinList(unique(b.transplant))} when seedlings and the bed are ready.`);
      // ONE watering sentence per row. A bed that is both sown and planted into
      // in the same month used to end "...Water and mulch. Water, mulch and
      // check they take." — the same walk down the bed, told twice.
      if (b.waterTransplant) parts.push('Water, mulch and check they take.');
      else if (b.waterSow) parts.push('Water and mulch.');
      parts.push(...b.extra);
      rows.push({ place, work: parts.filter(Boolean).join(' ') });
    }
    sections.push({ title, rows: mergeIdenticalWork(rows) });
  }

  const workRows = sections.reduce((s, x) => s + x.rows.length, 0);
  return {
    month,
    monthLabel: `${MONTH_NAMES[month - 1]} ${resolveYear(month, now)}`,
    sourceLines: mine.length,
    workRows,
    plantingFocus: mine.filter((t) => t.action === 'sow' || t.action === 'transplant').length,
    harvestFocus: mine.filter((t) => t.action === 'harvest').length,
    sections,
  };
}

/**
 * Spacing as a bracketed phrase, never a sentence — so it can sit beside the
 * crop it belongs to inside a merged row. Sowing depth only appears on a direct
 * sowing; there is no such thing as the depth of a transplant.
 */
function spacingPhrase(crop: CropDef | undefined): string {
  if (!crop) return 'spacing not recorded';
  if (crop.fieldSpacingInstruction) return crop.fieldSpacingInstruction;
  const { rowCm, inRowCm } = plantSpacingCm(crop);
  const ranges = plantSpacingRangeCm(crop);
  const exact = ranges.rowCm[0] === ranges.rowCm[1]
    && ranges.inRowCm[0] === ranges.inRowCm[1];
  const spacing = exact && rowCm === inRowCm
    ? `${formatCmRange(ranges.inRowCm)} cm each way`
    : `rows ${formatCmRange(ranges.rowCm)} cm apart, ${formatCmRange(ranges.inRowCm)} cm in the row`;
  const depthRange = crop.sowDepthRangeCm
    ?? (crop.sowDepthCm ? [crop.sowDepthCm, crop.sowDepthCm] as const : null);
  const depth = !crop.transplant && depthRange ? `, ${formatCmRange(depthRange)} cm deep` : '';
  return `${spacing}${depth}`;
}

function sowDepthPhrase(crop: CropDef): string | null {
  const range = crop.sowDepthRangeCm
    ?? (crop.sowDepthCm ? [crop.sowDepthCm, crop.sowDepthCm] as const : null);
  return range ? `sow ${formatCmRange(range)} cm deep` : null;
}

function formatCmRange(range: readonly [number, number]): string {
  return range[0] === range[1] ? String(range[0]) : `${range[0]}–${range[1]}`;
}

/** Older saved tasks may phrase bed prep as "prep bed (...)" — unwrap that
 *  legacy label so a field sheet still reads as an instruction. */
function stripPrepWrapper(text: string): string {
  const m = /^prep bed \((.*)\)$/.exec(text.trim());
  return m ? m[1] : text.trim();
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function joinList(items: string[]): string {
  const lower = items.map((s) => (/^[A-Z]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1)));
  if (lower.length <= 1) return lower[0] ?? '';
  if (lower.length === 2) return `${lower[0]} and ${lower[1]}`;
  return `${lower.slice(0, -1).join(', ')} and ${lower[lower.length - 1]}`;
}

function resolveYear(month: number, now: Date): number {
  const nowMonth = now.getMonth() + 1;
  return month >= nowMonth ? now.getFullYear() : now.getFullYear() + 1;
}

/**
 * One row per JOB, not per bed. On a market garden the same instruction
 * repeats across many beds — at 100 beds, "Harvest carrots. Record kilograms
 * and where it went." printed up to a hundred times, and a month's field
 * sheet ran to nine pages of identical sentences (the whole export was ~900
 * pages at 1,000 beds). Rows whose work text is identical merge into one,
 * naming every place: "Beds 3, 7, 12". Row count now scales with the number
 * of DISTINCT jobs — bounded by the catalog — not with the number of beds.
 * Order is kept from the first appearance of each job.
 */
function mergeIdenticalWork(rows: FieldSheetRow[]): FieldSheetRow[] {
  const byWork = new Map<string, string[]>();
  for (const row of rows) {
    const places = byWork.get(row.work);
    if (places) places.push(row.place);
    else byWork.set(row.work, [row.place]);
  }
  return [...byWork.entries()].map(([work, places]) => ({ place: compactPlaces(places), work }));
}

/** "Bed 3" + "Bed 7" + "Bed 12" -> "Beds 3, 7, 12"; anything mixed just joins. */
function compactPlaces(places: string[]): string {
  if (places.length === 1) return places[0];
  const bedNums = places.map((p) => /^Bed (\d+)$/.exec(p)?.[1]);
  if (bedNums.every((n): n is string => n !== undefined)) {
    return `Beds ${bedNums.map(Number).sort((a, b) => a - b).join(', ')}`;
  }
  const plotNums = places.map((p) => /^Plot (\d+)$/.exec(p)?.[1]);
  if (plotNums.every((n): n is string => n !== undefined)) {
    return `Plots ${plotNums.map(Number).sort((a, b) => a - b).join(', ')}`;
  }
  return places.join(', ');
}

// ── 4. Full plan table rows ─────────────────────────────────────────────────

export interface PlanTableRow {
  area: string;
  isFirstOfArea: boolean;
  crop: string;
  share: string;
  establish: string;
  intoField: string;
  harvest: string;
  /** Null means no verified kg/m² benchmark; it must never be formatted as 0kg. */
  yieldKg: number | null;
  /** True for a one-time first-season starter (`Planting.once`). The printed
   *  sheet is the copy a farmer carries into the field, and on paper a starter
   *  is otherwise indistinguishable from a crop the repeating plan re-sows every
   *  year — the exact phantom-recurrence reading the `once` field exists to
   *  prevent, recreated in print. Consumers must mark these rows. */
  once: boolean;
}

/**
 * The bed-by-bed plan as columns. "Establish" and "Into field" are separate
 * because for a tray crop they are different months and different jobs — the
 * single "sow" column they used to share is what let nursery and field work
 * blur together in the first place.
 */
export function buildPlanTableRows(plantings: Planting[], beds: PlanBed[]): PlanTableRow[] {
  const rows: PlanTableRow[] = [];
  for (const bed of beds) {
    const mine = plantings
      .filter((p) => p.bedId === bed.id)
      .map((p) => ({ p, crop: cropByKey(p.cropKey) }))
      .filter((x): x is { p: Planting; crop: CropDef } => !!x.crop)
      .sort((a, b) => a.p.sowMonth - b.p.sowMonth || a.crop.name.localeCompare(b.crop.name));

    mine.forEach(({ p, crop }, i) => {
      const h = crop.timingVerified === false ? null : harvestMonthForCrop(p.sowMonth, crop);
      const end = h === null ? null : wrapMonth(h + (crop.harvestWindowMonths ?? 0));
      rows.push({
        area: bed.label,
        isFirstOfArea: i === 0,
        crop: crop.name,
        share: shareCode(p.areaFraction ?? 1),
        establish: crop.transplant ? `Nursery ${monthShort(p.sowMonth)}` : `Direct sow ${monthShort(p.sowMonth)}`,
        intoField: crop.transplant
          ? `Check ${monthShort(bedEntryMonth(p.sowMonth, crop))}-${monthShort(latestBedEntryMonth(p.sowMonth, crop))}; transplant when ready`
          : 'Direct',
        harvest: h === null || end === null
          ? 'Confirm locally'
          : h === end ? monthShort(h) : `${monthShort(h)}-${monthShort(end)}`,
        yieldKg: crop.yieldKgPerM2 === null
          ? null
          : estimatedYieldKgAdjusted(p, bed.areaM2, plantings),
        once: typeof p.once === 'string',
      });
    });
  }
  return rows;
}
