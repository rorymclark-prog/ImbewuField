/**
 * YEAR OF FOOD — one twelve-month picture of what the farm gives, every source combined, and
 * what could be sown to fill the months that have no fresh vegetable.
 *
 * The availability chart on the crop plan already carries three separate rows: bed crops
 * (buildFoodAvailability), fruit trees (buildTreeAvailability) and animals
 * (buildAnimalAvailability). This module does not recompute any of them. It reads the chart's
 * OWN first twelve slots, so the summary can never disagree with the chart above it, and folds
 * them into one verdict per month:
 *
 *   fresh        something fresh comes in — a vegetable, fruit, eggs, milk, meat or honey
 *   stored-only  nothing fresh, only vegetables in store (sourced storage months only)
 *   empty        nothing at all
 *
 * A "veg gap" is narrower: no fresh VEGETABLE, even if fruit or eggs cover the month. Those are
 * the months the gap-fill suggestions chase, hungry months first, because a bed is the one
 * source a farmer can change this season; a tree is years away and a flock is not a sowing.
 *
 * This is availability, not sufficiency. A month with one fresh crop is "fresh" here whether
 * that crop feeds the household or not; the chart's bars carry the amounts.
 */

import type { CropDef, RainPattern } from './crop-catalog';
import { CROPS, hasAutomaticPlanningBasis } from './crop-catalog';
import type { ClimateGate } from './crop-climate-gate';
import { judgeFieldMonths } from './crop-climate-gate';
import type { FoodAvailabilityItem, PlanBed, Planting } from './crop-plan';
import {
  bedEntryMonth,
  bedOverlapFraction,
  harvestEndMonthForCrop,
  isSpaceHungry,
  planningMaturityMonths,
  TRANSPLANT_ENTRY_PLANNED_MONTHS,
} from './crop-plan';
import type { TreeAvailabilityItem } from './perennial-harvest';
import type { AnimalAvailabilityItem, AnimalProduct } from './animal-enterprises';

export type YearOfFoodStatus = 'fresh' | 'stored-only' | 'empty';

export interface YearOfFoodMonth {
  /** Calendar month, 1-12. */
  month: number;
  /** Position in the chart's display order (0 = the chart's first column). */
  slot: number;
  freshVeg: FoodAvailabilityItem[];
  storedVeg: FoodAvailabilityItem[];
  fruit: TreeAvailabilityItem[];
  /** Distinct animal products this month, in a stable order. */
  animalProducts: AnimalProduct[];
  status: YearOfFoodStatus;
  /** No fresh vegetable this month, whatever else there is. */
  vegGap: boolean;
}

export interface YearOfFood {
  months: YearOfFoodMonth[];
  /** Months with something fresh from any source. */
  freshCount: number;
  /** Calendar months with nothing fresh from any source, in display order. */
  hungryMonths: number[];
  /** Calendar months with no fresh vegetable, in display order. */
  vegGapMonths: number[];
}

const PRODUCT_ORDER: readonly AnimalProduct[] = ['eggs', 'milk', 'meat', 'honey'];

/**
 * Fold the chart's three rows into twelve months. `monthOrder` is the chart's own slot order;
 * only the first twelve slots are read, so a 24-month chart gives one year starting where the
 * chart starts. Rows the farmer has switched off are passed as undefined.
 */
export function buildYearOfFood(
  monthOrder: readonly number[],
  veg: readonly (readonly FoodAvailabilityItem[] | undefined)[],
  trees?: readonly (readonly TreeAvailabilityItem[] | undefined)[],
  animals?: readonly (readonly AnimalAvailabilityItem[] | undefined)[],
): YearOfFood {
  const months: YearOfFoodMonth[] = monthOrder.slice(0, 12).map((month, slot) => {
    const vegItems = veg[slot] ?? [];
    const freshVeg = vegItems.filter((item) => item.status === 'fresh');
    const storedVeg = vegItems.filter((item) => item.status === 'stored');
    const fruit = [...(trees?.[slot] ?? [])];
    const products = new Set((animals?.[slot] ?? []).map((item) => item.product));
    const animalProducts = PRODUCT_ORDER.filter((product) => products.has(product));
    const anyFresh = freshVeg.length > 0 || fruit.length > 0 || animalProducts.length > 0;
    const status: YearOfFoodStatus = anyFresh ? 'fresh' : storedVeg.length > 0 ? 'stored-only' : 'empty';
    return { month, slot, freshVeg, storedVeg, fruit, animalProducts, status, vegGap: freshVeg.length === 0 };
  });
  return {
    months,
    freshCount: months.filter((m) => m.status === 'fresh').length,
    hungryMonths: months.filter((m) => m.status !== 'fresh').map((m) => m.month),
    vegGapMonths: months.filter((m) => m.vegGap).map((m) => m.month),
  };
}

function wrap(month: number): number {
  return ((((month - 1) % 12) + 12) % 12) + 1;
}

/** Months forward from `from` to `to`, 0..11. */
function monthsAhead(from: number, to: number): number {
  return (((to - from) % 12) + 12) % 12;
}

/** Every calendar month (1-12) from `start` through `end`, wrapping over New Year. */
function monthRun(start: number, end: number): number[] {
  const run = [start];
  for (let m = start; m !== end && run.length < 12;) {
    m = wrap(m + 1);
    run.push(m);
  }
  return run;
}

/**
 * Fresh-pick offsets from the sow month, by exactly the arithmetic buildFoodAvailability uses:
 * the planning maturity (plus the planned nursery month for a tray crop), then every month of
 * the sourced harvest window. A suggestion that disagreed with the chart would promise a month
 * the chart then leaves empty.
 */
export function freshOffsetsFromSow(crop: Pick<CropDef, 'daysToHarvest' | 'transplant' | 'harvestWindowMonths'>): number[] {
  const maturity = planningMaturityMonths(crop.daysToHarvest) + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);
  return Array.from({ length: (crop.harvestWindowMonths ?? 0) + 1 }, (_, off) => maturity + off);
}

/** Bed shares the picker offers; a suggestion only ever proposes one of these. */
const BED_SHARES = [1, 0.5, 1 / 3, 0.25] as const;

export interface GapFillSuggestion {
  /** The calendar month this sowing brings a fresh vegetable into. */
  targetMonth: number;
  crop: CropDef;
  sowMonth: number;
  bed: PlanBed;
  /** Share of the bed to plant: the largest picker share still free over the crop's months. */
  areaFraction: number;
  /** Months from now until the first fresh pick lands in the target month. */
  monthsUntilTarget: number;
  /** Every calendar month this sowing picks fresh in — often more than the target. */
  freshMonths: number[];
}

export interface GapFillMonth {
  targetMonth: number;
  /** Nothing fresh from any source (not just no vegetable). */
  hungry: boolean;
  suggestions: GapFillSuggestion[];
  /** Crops that could reach this month but found no bed with room. Named, so the empty answer
   * is honest: the crops exist, the ground does not. */
  noRoomCropNames: string[];
}

export interface GapFillInput {
  year: YearOfFood;
  beds: readonly PlanBed[];
  plantings: readonly Planting[];
  pattern: RainPattern;
  currentMonth: number;
  /** Site climate gate (lib/crop-climate-gate.ts); null when the site's climate is unknown. */
  gate: ClimateGate | null;
  /** Suggestions per gap month. */
  perMonth?: number;
  /** Candidate crops; defaults to the whole catalog. Tests pass a fixed list. */
  crops?: readonly CropDef[];
}

/**
 * For each veg-gap month (hungry months first, then in display order), the sowings that would
 * put a fresh vegetable into it — on a real bed with room, in a sourced sowing month for the
 * site's rain pattern, and inside the site's climate gate when one is known.
 *
 * Only crops the auto-planner itself trusts are offered (hasAutomaticPlanningBasis: sourced
 * timing, field geometry and a planning yield), which also rules out soil covers (yield 0).
 * Staple plots are left out, as the auto-planner leaves them out for vegetables; maize is the
 * one crop it allows on a plot, and a gap filler is a vegetable. Each crop is offered at most
 * once per month, at its earliest-arriving sowing. The farmer confirms every suggestion in the
 * normal picker, which shows the overlap warning; nothing is planted from here.
 */
export function suggestGapFills(input: GapFillInput): GapFillMonth[] {
  const { year, beds, plantings, pattern, currentMonth, gate } = input;
  const perMonth = input.perMonth ?? 3;
  const vegBeds = beds.filter((bed) => bed.kind !== 'plot');
  const candidates = (input.crops ?? CROPS).filter(
    (crop) => hasAutomaticPlanningBasis(crop) && crop.yieldKgPerM2 > 0 && crop.key !== 'maize',
  );
  const byMonth = new Map(year.months.map((m) => [m.month, m]));
  const targets = [...year.vegGapMonths].sort((a, b) => {
    const ha = byMonth.get(a)!.status !== 'fresh' ? 0 : 1;
    const hb = byMonth.get(b)!.status !== 'fresh' ? 0 : 1;
    return ha - hb || byMonth.get(a)!.slot - byMonth.get(b)!.slot;
  });

  return targets.map((targetMonth) => {
    const suggestions: GapFillSuggestion[] = [];
    const noRoom: string[] = [];
    for (const crop of candidates) {
      const offsets = freshOffsetsFromSow(crop);
      let best: GapFillSuggestion | null = null;
      let reachedButNoRoom = false;
      for (const sowMonth of crop.sowMonths[pattern] ?? []) {
        const hitOffsets = offsets.filter((off) => wrap(sowMonth + off) === targetMonth);
        if (hitOffsets.length === 0) continue;
        const entry = bedEntryMonth(sowMonth, crop);
        const harvestEnd = harvestEndMonthForCrop(sowMonth, crop);
        if (gate && judgeFieldMonths(crop, monthRun(entry, harvestEnd), gate) !== 'ok') continue;
        const lead = monthsAhead(currentMonth, sowMonth);
        const monthsUntilTarget = lead + Math.min(...hitOffsets);
        if (best && best.monthsUntilTarget <= monthsUntilTarget) continue;
        const placed = roomiestBed(vegBeds, crop, entry, harvestEnd, plantings);
        if (!placed) { reachedButNoRoom = true; continue; }
        best = {
          targetMonth,
          crop,
          sowMonth,
          bed: placed.bed,
          areaFraction: placed.share,
          monthsUntilTarget,
          freshMonths: [...new Set(offsets.map((off) => wrap(sowMonth + off)))],
        };
      }
      if (best) suggestions.push(best);
      else if (reachedButNoRoom) noRoom.push(crop.name);
    }
    suggestions.sort((a, b) => a.monthsUntilTarget - b.monthsUntilTarget
      || b.freshMonths.length - a.freshMonths.length
      || a.crop.name.localeCompare(b.crop.name));
    return {
      targetMonth,
      hungry: byMonth.get(targetMonth)!.status !== 'fresh',
      suggestions: suggestions.slice(0, perMonth),
      noRoomCropNames: suggestions.length ? [] : noRoom.sort((a, b) => a.localeCompare(b)),
    };
  });
}

/**
 * The bed with the most free share over the crop's months, from the printed field-entry edge
 * (the same reservation the picker's overlap warning uses) through the end of picking. The
 * share offered is the largest picker share that fits; a sprawling vine needs the whole bed,
 * which is also what the picker defaults it to.
 */
function roomiestBed(
  beds: readonly PlanBed[],
  crop: CropDef,
  entry: number,
  harvestEnd: number,
  plantings: readonly Planting[],
): { bed: PlanBed; share: number } | null {
  let best: { bed: PlanBed; share: number; free: number } | null = null;
  for (const bed of beds) {
    const free = 1 - bedOverlapFraction(bed.id, entry, harvestEnd, plantings as Planting[]);
    const share = BED_SHARES.find((s) => s <= free + 1e-6);
    if (share === undefined || (isSpaceHungry(crop) && share < 1)) continue;
    if (!best || free > best.free + 1e-6) best = { bed, share, free };
  }
  return best ? { bed: best.bed, share: best.share } : null;
}
