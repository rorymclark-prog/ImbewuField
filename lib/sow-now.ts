// "Sow now, eat then": which months of the sample farm's year have a fresh vegetable, which
// have none, and what one more sowing (a crop and a month) does about it.
//
// No number here is typed in. The year is lib/year-of-food.ts's buildYearOfFood over
// lib/crop-plan.ts's buildFoodAvailability for the sample farm's own crop plan
// (lib/demo-farm.ts buildDemoCropPlan); the arc of a sowing uses the planner's own arithmetic
// (TRANSPLANT_ENTRY_PLANNED_MONTHS, freshOffsetsFromSow); where the sowing would go is
// year-of-food's roomiestBed; the suggestions are suggestGapFills.
//
// The baseline is the settled year: the plan's repeating plantings only, the way the crop
// planner's "established year" view shows it (recurringPlanPlantings). One-off crops already in
// the ground (the garlic, the onions and the chard sown last season) are left out, because they
// are not there next year. The calendar runs January to December, the planner's own established
// order. Vegetables only: the sample farm's fruit and animals are not part of the crop plan.

import { cropByKey, type CropDef } from './crop-catalog';
import {
  bedEntryMonth,
  buildFoodAvailability,
  harvestEndMonthForCrop,
  recurringPlanPlantings,
  TRANSPLANT_ENTRY_PLANNED_MONTHS,
  type PlanBed,
  type Planting,
} from './crop-plan';
import { buildDemoCropPlan, buildDemoFacilitatorState, DEMO_SOWING_CALENDAR } from './demo-farm';
import {
  buildYearOfFood,
  freshOffsetsFromSow,
  roomiestBed,
  suggestGapFills,
  type GapFillMonth,
  type YearOfFood,
} from './year-of-food';

/** The crops the figure offers: all on the planner's trusted list, all with sourced sowing
 * months on the sample farm's calendar. */
export const SOW_NOW_CROPS = ['swiss-chard', 'beetroot', 'broccoli', 'tomatoes', 'sweet-potato'] as const;
export type SowNowCropKey = (typeof SOW_NOW_CROPS)[number];

export const YEAR_ORDER: readonly number[] = Array.from({ length: 12 }, (_, i) => i + 1);

const wrap = (month: number): number => ((((month - 1) % 12) + 12) % 12) + 1;

/** The sample farm's beds, exactly as the crop planner reads them off the design (Bed N, Hügel N). */
export function demoPlanBeds(): PlanBed[] {
  const beds: PlanBed[] = [];
  let bedN = 0;
  let hugelN = 0;
  for (const it of buildDemoFacilitatorState().items) {
    if (it.type !== 'bed' && it.type !== 'hugel') continue;
    const label = it.type === 'bed' ? `Bed ${++bedN}` : `Hügel ${++hugelN}`;
    beds.push({ id: it.id, label, areaM2: (it.wM || 1) * (it.hM || 1), minDimM: Math.min(it.wM || 1, it.hM || 1) });
  }
  return beds;
}

export interface SowNowBaseline {
  beds: PlanBed[];
  plantings: Planting[];
  year: YearOfFood;
  /** The planner's own gap-filling sowings for each hungry month, over the crops offered here. */
  suggestions: GapFillMonth[];
}

function yearOf(plantings: Planting[], beds: PlanBed[]): YearOfFood {
  const annual = buildFoodAvailability(plantings, beds);
  return buildYearOfFood(YEAR_ORDER, YEAR_ORDER.map((month) => annual[month]));
}

let cached: SowNowBaseline | null = null;

export function sowNowBaseline(): SowNowBaseline {
  if (cached) return cached;
  const beds = demoPlanBeds();
  const plantings = recurringPlanPlantings(buildDemoCropPlan().plantings);
  const year = yearOf(plantings, beds);
  const suggestions = suggestGapFills({
    year, beds, plantings, pattern: DEMO_SOWING_CALENDAR, currentMonth: 1, gate: null,
    perMonth: SOW_NOW_CROPS.length, crops: SOW_NOW_CROPS.map((k) => cropByKey(k)!),
  });
  cached = { beds, plantings, year, suggestions };
  return cached;
}

export type ArcStage = 'sow' | 'tray' | 'bed' | 'pick';
export interface ArcStep {
  /** Months after the sowing month. */
  offset: number;
  /** Calendar month, 1-12 (wraps over New Year). */
  month: number;
  stage: ArcStage;
}

export type SowStatus = 'fills' | 'adds-nothing-new' | 'out-of-season' | 'no-room';

export interface SowOutcome {
  crop: CropDef;
  sowMonth: number;
  transplant: boolean;
  steps: ArcStep[];
  /** Calendar months this sowing picks fresh in. */
  pickMonths: number[];
  /** Is this a sourced sowing month on the sample farm's calendar? */
  inSeason: boolean;
  /** The bed and share the planner would put it in; null when no bed has room. */
  placed: { bedLabel: string; share: number } | null;
  status: SowStatus;
  /** Baseline hungry months this sowing ends, once it is in season and has room. */
  filled: number[];
  /** Hungry months its picking reaches, whether or not it could be sown (out of season, or no room). */
  wouldFill: number[];
  /** Pick months where a fresh vegetable was already coming. */
  alreadyCovered: number[];
  /** Hungry months still left after this sowing. */
  gapsAfter: number[];
}

/** Sow, tray, bed and pick, month by month, using the planner's own timings. */
export function sowArc(crop: CropDef, sowMonth: number): ArcStep[] {
  const picks = freshOffsetsFromSow(crop);
  const first = picks[0];
  const last = picks[picks.length - 1];
  const trayEnd = crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0;
  const steps: ArcStep[] = [];
  for (let offset = 0; offset <= last; offset++) {
    const stage: ArcStage = offset === 0 ? 'sow' : offset < trayEnd ? 'tray' : offset < first ? 'bed' : 'pick';
    steps.push({ offset, month: wrap(sowMonth + offset), stage });
  }
  return steps;
}

export function sowOutcome(cropKey: string, sowMonth: number): SowOutcome {
  const crop = cropByKey(cropKey);
  if (!crop) throw new Error(`Unknown crop ${cropKey}`);
  const base = sowNowBaseline();
  const steps = sowArc(crop, sowMonth);
  const pickMonths = [...new Set(steps.filter((s) => s.stage === 'pick').map((s) => s.month))];
  const inSeason = (crop.sowMonths[DEMO_SOWING_CALENDAR] ?? []).includes(sowMonth);
  const placed = roomiestBed(
    base.beds.filter((b) => b.kind !== 'plot'), crop, bedEntryMonth(sowMonth, crop), harvestEndMonthForCrop(sowMonth, crop), base.plantings,
  );
  const baseGaps = base.year.vegGapMonths;
  const wouldFill = pickMonths.filter((m) => baseGaps.includes(m)).sort((a, b) => a - b);
  const alreadyCovered = pickMonths.filter((m) => !baseGaps.includes(m)).sort((a, b) => a - b);
  let filled: number[] = [];
  let status: SowStatus;
  if (!inSeason) status = 'out-of-season';
  else if (!placed) status = 'no-room';
  else {
    // Run the sowing through the planner's own food chart, rather than assuming it lands.
    const hypothetical: Planting = { id: 'sow-now', bedId: placed.bed.id, cropKey, sowMonth, areaFraction: placed.share };
    const after = yearOf([...base.plantings, hypothetical], base.beds);
    filled = baseGaps.filter((m) => !after.vegGapMonths.includes(m));
    status = filled.length ? 'fills' : 'adds-nothing-new';
  }
  return {
    crop, sowMonth, transplant: !!crop.transplant, steps, pickMonths, inSeason,
    placed: placed ? { bedLabel: placed.bed.label, share: placed.share } : null,
    status, filled, wouldFill, alreadyCovered,
    gapsAfter: baseGaps.filter((m) => !filled.includes(m)),
  };
}

/** The sowing month, in season with room, that ends the most hungry months (earliest on a tie). */
export function bestSowMonth(cropKey: string): { sowMonth: number; filled: number[] } | null {
  let best: { sowMonth: number; filled: number[] } | null = null;
  for (let m = 1; m <= 12; m++) {
    const o = sowOutcome(cropKey, m);
    if (o.status !== 'fills') continue;
    if (!best || o.filled.length > best.filled.length) best = { sowMonth: m, filled: o.filled };
  }
  return best;
}

/** The planner's own gap-filling sowings for a hungry month, among the crops offered here. */
export function plannerSowingsFor(gapMonth: number): { cropKey: string; sowMonth: number }[] {
  return sowNowBaseline().suggestions
    .find((g) => g.targetMonth === gapMonth)?.suggestions.map((s) => ({ cropKey: s.crop.key, sowMonth: s.sowMonth })) ?? [];
}
