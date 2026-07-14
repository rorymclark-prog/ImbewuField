// Auto-suggest crop plan — a deterministic rules engine over the existing
// crop-catalog/crop-plan data (no network, no LLM call: the catalog is
// already fully structured, so this is instant, offline-safe, and every
// suggestion can be explained). Designed via a 3-angle workflow panel
// (MVP / family-variety / succession-first) + judge synthesis; this is that
// synthesis, simplified where the full spec added complexity without a
// proportional gain for a first version.

import type { CropDef, RainPattern } from './crop-catalog';
import { CROPS, MONTHS_SHORT } from './crop-catalog';
import type { PlanBed, Planting } from './crop-plan';
import { isSpaceHungry } from './crop-plan';
import type { FoodGroup } from './crop-groups';
import { foodGroupOf, GROUP_PRIORITY } from './crop-groups';

export type GardenGoal = 'family' | 'commercial' | 'hybrid';
export type HarvestRhythm = 'steady' | 'few-big';
export type HouseholdSize = 'small' | 'medium' | 'large';

export interface AutoSuggestAnswers {
  goal: GardenGoal;
  householdSize?: HouseholdSize; // family/hybrid
  focusCropCount?: number; // commercial — how many crops to concentrate on (1-3)
  groups: FoodGroup[]; // selected food groups — empty = "not sure, suggest for me"
  rhythm: HarvestRhythm;
  // When true, a bed that already grew a given food group this plan (or in
  // existingPlantings, i.e. a prior season) is avoided for that same group
  // where another bed can do the job instead — real crop rotation, not just
  // a suggestion for right now. This is also how "year 2" rotation works:
  // there's no separate multi-year planner, but a later run of this SAME
  // function reads last season's plantings as existingPlantings, so a
  // rotation-aware year 1 naturally leaves year 2 room to rotate correctly.
  rotateCrops: boolean;
}

export interface AutoSuggestResult {
  plantings: Planting[];
  notes: string[];
  laterThisYear: { cropKey: string; nextWindowMonth: number }[];
}

function genId(): string {
  return `auto-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function monthsForward(from: number, to: number): number {
  return (((to - from) % 12) + 12) % 12;
}

interface Cluster { start: number; end: number; months: number[] }

/**
 * Groups a crop's valid sow months into contiguous runs, wrap-merging a run
 * ending in December with one starting in January (e.g. Nov-Feb reads as
 * ONE window, not two). A crop like swiss-chard whose summer window is
 * genuinely disjoint ([2,3] and [8,9,10]) stays two separate clusters —
 * succession must never straddle that real gap.
 */
export function clusterSowMonths(months: number[]): Cluster[] {
  if (!months.length) return [];
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const clusters: Cluster[] = [];
  for (const m of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && m === last.end + 1) {
      last.end = m;
      last.months.push(m);
    } else {
      clusters.push({ start: m, end: m, months: [m] });
    }
  }
  if (clusters.length > 1 && clusters[0].start === 1 && clusters[clusters.length - 1].end === 12) {
    const first = clusters.shift()!;
    const lastC = clusters[clusters.length - 1];
    lastC.end = first.end;
    lastC.months = [...lastC.months, ...first.months];
  }
  return clusters;
}

/** The month within `months` reachable soonest from `nowMonth` (0 if already in-window). */
function nearestEntry(nowMonth: number, months: number[]): { month: number; gap: number } {
  let best = { month: months[0], gap: monthsForward(nowMonth, months[0]) };
  for (const m of months) {
    const gap = monthsForward(nowMonth, m);
    if (gap < best.gap) best = { month: m, gap };
  }
  return best;
}

/**
 * Total months spanned by a sow→harvest run (inclusive of both ends),
 * mirroring lib/crop-plan.ts's harvestMonth offset exactly. Deriving this
 * from daysToHarvest directly (rather than from comparing sowMonth to an
 * already-wrapped harvestEnd month) avoids a real ambiguity: a crop whose
 * daysToHarvest rounds to an exact 12-month offset wraps harvestEnd back to
 * the SAME numeric month as sowMonth, which is indistinguishable from "only
 * occupies 1 month" if you only ever compare the two endpoint months.
 * daysToHarvest<=0 (used for the unknown-crop-key fallback below) means
 * "nothing more is known" — occupy just the sow month itself.
 */
function spanMonths(daysToHarvest: number): number {
  if (daysToHarvest <= 0) return 1;
  return Math.max(1, Math.round(daysToHarvest / 30)) + 1;
}

/** Every calendar month (1-12) a sow→harvest span actually occupies, wrap-safe. */
function occupiedMonths(sowMonth: number, daysToHarvest: number): number[] {
  const span = spanMonths(daysToHarvest);
  const months: number[] = [];
  let m = sowMonth;
  for (let i = 0; i < span; i++) {
    months.push(m);
    m = m === 12 ? 1 : m + 1;
  }
  return months;
}

const SUCCESSION_CAP_BY_DAYS: { maxDays: number; cap: number }[] = [
  { maxDays: 65, cap: 4 },
  { maxDays: 100, cap: 3 },
  { maxDays: 150, cap: 2 },
  { maxDays: Infinity, cap: 1 },
];
function capForCrop(crop: CropDef): number {
  return SUCCESSION_CAP_BY_DAYS.find((c) => crop.daysToHarvest <= c.maxDays)!.cap;
}

const BED_FRACTION_PRESETS = [1, 0.5, 1 / 3, 0.25];
function closestPreset(target: number): number {
  return BED_FRACTION_PRESETS.reduce((best, p) => (Math.abs(p - target) < Math.abs(best - target) ? p : best));
}

// "Would have to wait most of a year" cutoff — beyond this, surface the crop
// as a later suggestion instead of forcing it into the plan now.
const DELAYED_START_THRESHOLD_MONTHS = 5;

// Below this, a "whole dedicated bed" isn't actually big enough for a vine to
// sprawl into — recommend a separate patch instead of cramming it in. Area
// alone isn't sufficient: a standard 1m-wide bed of ANY length still can't
// host a sprawling vine, so a bed also needs to clear a minimum WIDTH
// (checked via PlanBed.minDimM, when known) — a long narrow strip with
// plenty of area but only 1m of width is exactly the case this guards.
const MIN_DEDICATED_BED_M2 = 6;
const MIN_DEDICATED_BED_WIDTH_M = 2;

/**
 * Precise per-bed, per-calendar-month occupancy ledger — NOT the same thing
 * as lib/crop-plan.ts's bedOverlapFraction (a pairwise range-overlap sum,
 * fine as an ADVISORY warning for a human reviewing one change at a time,
 * but it can false-positive on chains of 3+ plantings whose ranges overlap
 * pairwise at different boundary months without ever all three genuinely
 * coexisting — auto-suggest makes many sequential placements with no human
 * checking each one, so it needs an exact month-by-month sum instead).
 */
class Occupancy {
  private byBed = new Map<string, Map<number, number>>();

  seed(plantings: Planting[], daysToHarvestOf: (p: Planting) => number) {
    for (const p of plantings) this.add(p.bedId, p.sowMonth, daysToHarvestOf(p), p.areaFraction ?? 1);
  }

  private monthMap(bedId: string): Map<number, number> {
    let m = this.byBed.get(bedId);
    if (!m) { m = new Map(); this.byBed.set(bedId, m); }
    return m;
  }

  /** Would adding this fraction over this span push any occupied month past 100%? */
  fits(bedId: string, sowMonth: number, daysToHarvest: number, fraction: number): boolean {
    const m = this.monthMap(bedId);
    return occupiedMonths(sowMonth, daysToHarvest).every((mo) => (m.get(mo) ?? 0) + fraction <= 1.0001);
  }

  add(bedId: string, sowMonth: number, daysToHarvest: number, fraction: number) {
    const m = this.monthMap(bedId);
    for (const mo of occupiedMonths(sowMonth, daysToHarvest)) m.set(mo, (m.get(mo) ?? 0) + fraction);
  }

  /** Read-only: how much of `bedId` is committed in a given calendar month. */
  fractionAt(bedId: string, month: number): number {
    return this.monthMap(bedId).get(month) ?? 0;
  }
}

// SA frost-risk winter window (matches crop-catalog.ts's own header comment:
// "frost risk May-Aug" under the summer rainfall pattern) — the months a bed
// is most likely to sit empty, since no catalog crop has a summer-pattern
// direct-sow window landing in June/July at all.
const WINTER_MONTHS = [5, 6, 7, 8];

/**
 * Persistent bed-rotation cursor — fixes a real bug: planSuccession used to
 * reset its round-robin bed search to bedsForCrop[0] on every single call,
 * so across a whole pass (many different crops/groups/focus-crops calling it
 * in turn) early-indexed beds got preferentially filled while later beds sat
 * untouched unless the earlier ones were already full. One instance is
 * created per autoSuggestPlan call and threaded through every planSuccession
 * call site, same lifecycle as Occupancy.
 *
 * Also (optionally) tracks which food group has already grown in each bed
 * this plan (seeded from existingPlantings, i.e. prior seasons) — real crop
 * rotation, gated behind answers.rotateCrops. `conflicts` is checked against
 * a SNAPSHOT taken at the start of each planSuccession call (see there) so a
 * crop's own later succession batches are always free to reuse the same
 * bed(s) as its own earlier batches — that's the whole point of succession,
 * not a rotation violation.
 */
class BedRotation {
  private lastBedId: string | null = null;
  constructor(private history: Map<string, Set<FoodGroup>>, private rotateCrops: boolean) {}

  nextIndex(beds: PlanBed[]): number {
    if (!this.lastBedId) return 0;
    const idx = beds.findIndex((b) => b.id === this.lastBedId);
    return idx === -1 ? 0 : (idx + 1) % beds.length;
  }

  conflicts(bedId: string, group: FoodGroup): boolean {
    return this.rotateCrops && (this.history.get(bedId)?.has(group) ?? false);
  }

  recordUse(bedId: string, group: FoodGroup) {
    this.lastBedId = bedId;
    const set = this.history.get(bedId) ?? new Set<FoodGroup>();
    set.add(group);
    this.history.set(bedId, set);
  }
}

interface SuccessionOutcome {
  plantings: Planting[];
  status: 'OK' | 'PARTIAL_FIT' | 'DELAYED_START' | 'NO_WINDOW';
  nextWindowMonth?: number;
}

/**
 * Stagger one crop's sowings across consecutive months within its NEAREST
 * valid window (never across a disjoint gap), round-robining across the
 * beds it's allowed to use. The occupancy ledger naturally caps how many
 * cohorts actually fit — a crop given only one bed self-limits to however
 * many successions that bed can hold before a batch would push a month over
 * 100% committed, no special-casing needed.
 */
function planSuccession(
  crop: CropDef,
  pattern: RainPattern,
  bedsForCrop: PlanBed[],
  occupancy: Occupancy,
  nowMonth: number,
  wholeBed: boolean,
  rhythm: HarvestRhythm,
  goal: GardenGoal,
  fractionIfShared: number,
  rotation: BedRotation,
): SuccessionOutcome {
  const clusters = clusterSowMonths(crop.sowMonths[pattern]);
  if (!clusters.length || !bedsForCrop.length) return { plantings: [], status: 'NO_WINDOW' };

  let nearestCluster = clusters[0];
  let nearest = nearestEntry(nowMonth, clusters[0].months);
  for (const c of clusters.slice(1)) {
    const e = nearestEntry(nowMonth, c.months);
    if (e.gap < nearest.gap) { nearest = e; nearestCluster = c; }
  }
  if (nearest.gap > DELAYED_START_THRESHOLD_MONTHS) {
    return { plantings: [], status: 'DELAYED_START', nextWindowMonth: nearest.month };
  }

  let cap = capForCrop(crop);
  if (rhythm === 'few-big') cap = 1;
  if (goal === 'commercial') cap = Math.max(cap, 2);

  const perBatchFraction = wholeBed ? 1 : fractionIfShared;
  const startIdx = nearestCluster.months.indexOf(nearest.month);
  // NOT capped by bedsForCrop.length — a fast crop can cycle back through the
  // SAME bed for a later cohort once the earlier one has been harvested (the
  // round-robin bed search below, combined with occupancy.fits, already
  // guarantees no double-booking); capping the attempt count by bed count
  // was silently under-using capacity whenever there were fewer beds than
  // the crop's own succession cap, even when a bed would free up in time.
  const numBatches = Math.min(nearestCluster.months.length - startIdx, cap);
  const sowMonthsToTry = nearestCluster.months.slice(startIdx, startIdx + numBatches);

  const plantings: Planting[] = [];
  let bedCursor = rotation.nextIndex(bedsForCrop);
  const group = foodGroupOf(crop);
  // Snapshot taken BEFORE this call places anything — see BedRotation's own
  // doc comment for why this must not see this call's own later placements.
  const conflictedBedIds = new Set(bedsForCrop.filter((b) => rotation.conflicts(b.id, group)).map((b) => b.id));
  for (const sowMonth of sowMonthsToTry) {
    let placed = false;
    // Two passes: first try only beds that don't repeat this food group
    // (real rotation), then fall back to any bed that fits — rotation is a
    // preference, never a reason to leave a bed unplanted.
    for (let pass = 0; pass < 2 && !placed; pass++) {
      for (let i = 0; i < bedsForCrop.length; i++) {
        const bed = bedsForCrop[(bedCursor + i) % bedsForCrop.length];
        if (pass === 0 && conflictedBedIds.has(bed.id)) continue;
        if (occupancy.fits(bed.id, sowMonth, crop.daysToHarvest, perBatchFraction)) {
          occupancy.add(bed.id, sowMonth, crop.daysToHarvest, perBatchFraction);
          plantings.push({
            id: genId(), bedId: bed.id, cropKey: crop.key, sowMonth,
            areaFraction: perBatchFraction < 1 ? perBatchFraction : undefined,
          });
          rotation.recordUse(bed.id, group);
          bedCursor = (bedCursor + i + 1) % bedsForCrop.length;
          placed = true;
          break;
        }
      }
    }
  }
  return { plantings, status: plantings.length < sowMonthsToTry.length ? 'PARTIAL_FIT' : 'OK' };
}

function commercialScore(crop: CropDef): number {
  return crop.yieldKgPerM2 * (365 / crop.daysToHarvest);
}

/**
 * Breadth-first variety selection across food groups, sharing beds by
 * fraction — the "feed the family" half of both family and hybrid modes.
 * Always plans as goal='family' internally (no continuous-supply floor)
 * regardless of which of the two callers it came from; hybrid's own
 * "sell the surplus" behaviour is layered on afterward by the caller using
 * whatever beds this leaves untouched — see autoSuggestPlan's hybrid branch.
 */
function runFamilyBreadthFirst(
  pool: CropDef[],
  sharedBeds: PlanBed[],
  selectedGroups: Set<FoodGroup> | null,
  householdSize: HouseholdSize | undefined,
  pattern: RainPattern,
  occupancy: Occupancy,
  nowMonth: number,
  rhythm: HarvestRhythm,
  rotation: BedRotation,
): { plantings: Planting[]; laterThisYear: { cropKey: string; nextWindowMonth: number }[] } {
  const plantings: Planting[] = [];
  const laterThisYear: { cropKey: string; nextWindowMonth: number }[] = [];
  if (!sharedBeds.length) return { plantings, laterThisYear };

  const repeatBudget = householdSize === 'large' ? 3 : householdSize === 'medium' ? 2 : 1;
  const sharedFraction = sharedBeds.length <= 1 ? 1 : sharedBeds.length === 2 ? 0.5 : closestPreset(1 / 3);
  const activeGroups = GROUP_PRIORITY.filter((g) => !selectedGroups || selectedGroups.has(g));
  const queues = new Map<FoodGroup, CropDef[]>(
    activeGroups.map((g) => [g, pool.filter((c) => foodGroupOf(c) === g && !isSpaceHungry(c)).sort((a, b) => b.yieldKgPerM2 - a.yieldKgPerM2)]),
  );

  let round = 0;
  // Loops up to repeatBudget rounds as long as SOME queue still has an
  // untried crop — a round where every group's front candidate happens to
  // fail (out of season etc.) must not end the loop early and strand
  // better-ranked candidates sitting right behind them in the same queues.
  while (round <= repeatBudget) {
    let anyQueueHasItems = false;
    for (const g of activeGroups) {
      const queue = queues.get(g)!;
      if (!queue.length) continue;
      anyQueueHasItems = true;
      const crop = queue.shift()!;
      const wholeBed = sharedBeds.length === 1;
      const outcome = planSuccession(crop, pattern, sharedBeds, occupancy, nowMonth, wholeBed, rhythm, 'family', sharedFraction, rotation);
      if (outcome.status === 'NO_WINDOW') continue;
      if (outcome.status === 'DELAYED_START') { laterThisYear.push({ cropKey: crop.key, nextWindowMonth: outcome.nextWindowMonth! }); continue; }
      plantings.push(...outcome.plantings);
    }
    if (!anyQueueHasItems) break;
    round += 1;
  }
  return { plantings, laterThisYear };
}

/**
 * Rank the pool by productivity and concentrate on the top N crops, one
 * whole bed (or several, area-balanced) per crop — the "sell the surplus"
 * mechanism shared by commercial mode (over ALL shared beds) and hybrid mode
 * (over whatever's left after feeding the family first).
 */
function runCommercialConcentration(
  pool: CropDef[],
  targetBeds: PlanBed[],
  focusCropCount: number,
  pattern: RainPattern,
  occupancy: Occupancy,
  nowMonth: number,
  rhythm: HarvestRhythm,
  rotation: BedRotation,
): { plantings: Planting[]; notes: string[]; laterThisYear: { cropKey: string; nextWindowMonth: number }[] } {
  const notes: string[] = [];
  const laterThisYear: { cropKey: string; nextWindowMonth: number }[] = [];
  const plantings: Planting[] = [];

  const focusN = Math.min(focusCropCount, targetBeds.length || 1);
  if (focusCropCount > focusN) {
    notes.push(`You asked to focus on ${focusCropCount} crops, but only ${focusN} bed${focusN === 1 ? ' is' : 's are'} free — picked the top ${focusN} by productivity instead.`);
  }
  const ranked = [...pool].sort((a, b) => commercialScore(b) - commercialScore(a));
  const focusCrops = ranked.slice(0, focusN);
  if (!focusCrops.length) {
    notes.push('No crop in your selected groups suits this rainfall pattern for commercial growing right now.');
    return { plantings, notes, laterThisYear };
  }

  // Greedy area-balance: each free bed goes to whichever focus crop has the least committed area so far.
  const areaByCrop = new Map(focusCrops.map((c) => [c.key, 0]));
  const bedsByCrop = new Map<string, PlanBed[]>(focusCrops.map((c) => [c.key, []]));
  for (const bed of targetBeds) {
    const leastCrop = focusCrops.reduce((a, b) => (areaByCrop.get(a.key)! <= areaByCrop.get(b.key)! ? a : b));
    bedsByCrop.get(leastCrop.key)!.push(bed);
    areaByCrop.set(leastCrop.key, areaByCrop.get(leastCrop.key)! + bed.areaM2);
  }
  for (const crop of focusCrops) {
    const cropBeds = bedsByCrop.get(crop.key) ?? [];
    if (!cropBeds.length) continue;
    const outcome = planSuccession(crop, pattern, cropBeds, occupancy, nowMonth, true, rhythm, 'commercial', 1, rotation);
    if (outcome.status === 'NO_WINDOW') { notes.push(`${crop.name} can't be sown in this rainfall pattern right now.`); continue; }
    if (outcome.status === 'DELAYED_START') { laterThisYear.push({ cropKey: crop.key, nextWindowMonth: outcome.nextWindowMonth! }); continue; }
    if (outcome.status === 'PARTIAL_FIT') notes.push(`${crop.name}'s beds are full for now — later successions will need to wait for space to free up.`);
    plantings.push(...outcome.plantings);
  }
  return { plantings, notes, laterThisYear };
}

/**
 * The nearest reachable sow month (from `nowMonth`) whose occupied span
 * covers EVERY winter month — a read-only probe over the crop's own sow
 * windows, not tied to any bed. Returns null if no sow month reaches that far
 * (most of the catalog: no crop has a summer-pattern direct-sow window in
 * June/July at all, so only long-duration crops sown well before winter —
 * onions, garlic — can ever qualify). Deliberately all-or-nothing (a crop
 * that covers only PART of the window doesn't count) — matching the bed-gap
 * check below, which only fires when a bed is EMPTY across the whole window.
 */
function nearestWinterCoveringSowMonth(crop: CropDef, pattern: RainPattern, nowMonth: number): number | null {
  let best: number | null = null;
  let bestGap = Infinity;
  for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
    for (const m of cluster.months) {
      if (!WINTER_MONTHS.every((wm) => occupiedMonths(m, crop.daysToHarvest).includes(wm))) continue;
      const gap = monthsForward(nowMonth, m);
      if (gap < bestGap) { bestGap = gap; best = m; }
    }
  }
  return best;
}

/**
 * Runs once, after every other allocation pass, over the FULL bed list
 * (including space-hungry dedicated beds, which are often empty all winter
 * once their vine is harvested). For any bed sitting completely empty across
 * WINTER_MONTHS, tries to place one bridging planting from a crop whose sow
 * window can reach all the way across the gap. When nothing in the farmer's
 * selected groups can, but something in the FULL catalog could, says so
 * explicitly — the difference between "your own choices left this gap" and
 * "no crop in this rainfall pattern can close it" (frost risk is real and
 * this file must never pretend otherwise).
 *
 * A candidate's nearest covering sow month can legitimately be up to 11
 * months out (monthsForward wraps mod 12) — e.g. asked in June, onions'
 * only covering window is next March. That's NOT this year's gap being
 * fixed, so it must not be silently committed to the plan alongside
 * genuinely-imminent plantings; it's routed to laterThisYear instead, same
 * as planSuccession's own DELAYED_START handling everywhere else in this file.
 */
function backfillWinterGaps(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
): { plantings: Planting[]; notes: string[]; laterThisYear: { cropKey: string; nextWindowMonth: number }[] } {
  const plantings: Planting[] = [];
  const notes: string[] = [];
  const laterThisYear: { cropKey: string; nextWindowMonth: number }[] = [];

  for (const bed of beds) {
    if (!WINTER_MONTHS.every((mo) => occupancy.fractionAt(bed.id, mo) === 0)) continue;

    const candidates = pool
      .map((crop) => ({ crop, sowMonth: nearestWinterCoveringSowMonth(crop, pattern, nowMonth) }))
      .filter((x): x is { crop: CropDef; sowMonth: number } => x.sowMonth !== null)
      .filter((x) => occupancy.fits(bed.id, x.sowMonth, x.crop.daysToHarvest, 1))
      .sort((a, b) => commercialScore(b.crop) - commercialScore(a.crop));

    if (!candidates.length) {
      const catalogHasOne = CROPS.some((c) => nearestWinterCoveringSowMonth(c, pattern, nowMonth) !== null);
      notes.push(catalogHasOne
        ? `${bed.label} will rest over winter (May-Aug) — a long-season crop could cover it, but none of your selected crop types reach that far. Widen your selection if you want it filled.`
        : `${bed.label} will rest over winter (May-Aug) — no crop in the catalog can span that far under a '${pattern}' rainfall pattern (frost risk). That's a real seasonal limit, not a gap in the plan.`);
      continue;
    }

    const chosen = candidates.find((c) => !rotation.conflicts(bed.id, foodGroupOf(c.crop))) ?? candidates[0];
    const gap = monthsForward(nowMonth, chosen.sowMonth);
    if (gap > DELAYED_START_THRESHOLD_MONTHS) {
      laterThisYear.push({ cropKey: chosen.crop.key, nextWindowMonth: chosen.sowMonth });
      notes.push(`${bed.label} will rest over winter this time round — ${chosen.crop.name} could bridge it, but not until ${MONTHS_SHORT[chosen.sowMonth - 1]} (too far out to plant now).`);
      continue;
    }
    occupancy.add(bed.id, chosen.sowMonth, chosen.crop.daysToHarvest, 1);
    rotation.recordUse(bed.id, foodGroupOf(chosen.crop));
    plantings.push({ id: genId(), bedId: bed.id, cropKey: chosen.crop.key, sowMonth: chosen.sowMonth });
    notes.push(`${bed.label} would otherwise rest all winter — added ${chosen.crop.name} (sow ${MONTHS_SHORT[chosen.sowMonth - 1]}) to keep it covered through May-Aug.`);
  }

  return { plantings, notes, laterThisYear };
}

/**
 * Turns questionnaire answers into a full Planting[] proposal. Never
 * mutates or removes existingPlantings — the caller decides whether to
 * merge the result in (matching the manual picker's own add-only write
 * path), so re-running this is always safe.
 */
export function autoSuggestPlan(
  answers: AutoSuggestAnswers,
  pattern: RainPattern,
  beds: PlanBed[],
  existingPlantings: Planting[],
  nowMonth: number,
): AutoSuggestResult {
  const notes: string[] = [];
  const laterThisYear: { cropKey: string; nextWindowMonth: number }[] = [];
  const added: Planting[] = [];

  const occupancy = new Occupancy();
  occupancy.seed(existingPlantings, (p) => {
    const crop = CROPS.find((c) => c.key === p.cropKey);
    return crop ? crop.daysToHarvest : 0; // unknown crop key — occupy just the sow month (spanMonths(0) === 1)
  });

  // Bed → food-group history, seeded from existingPlantings (this plan's own
  // prior additions, OR a genuinely earlier season re-using this same
  // function) — the basis for rotation avoidance below when the toggle is on.
  const bedFoodGroupHistory = new Map<string, Set<FoodGroup>>();
  for (const p of existingPlantings) {
    const crop = CROPS.find((c) => c.key === p.cropKey);
    if (!crop) continue;
    const set = bedFoodGroupHistory.get(p.bedId) ?? new Set<FoodGroup>();
    set.add(foodGroupOf(crop));
    bedFoodGroupHistory.set(p.bedId, set);
  }
  const rotation = new BedRotation(bedFoodGroupHistory, answers.rotateCrops);

  const selectedGroups = answers.groups.length ? new Set(answers.groups) : null;
  let pool = CROPS.filter((c) => !selectedGroups || selectedGroups.has(foodGroupOf(c)));
  if (!pool.length) pool = CROPS; // "not sure" fallback — consider everything

  const dedicated = new Set<string>();

  // ---- space-hungry pre-pass (family/hybrid only): whole dedicated bed
  // each, never split/intercropped. Commercial mode instead lets space-
  // hungry crops compete as ordinary ranked candidates below — a farmer who
  // asked to focus on 2 crops shouldn't have both beds silently claimed by
  // vines before their actual choice is even considered.
  if (answers.goal !== 'commercial') {
    const spaceHungry = pool.filter(isSpaceHungry).sort((a, b) => b.yieldKgPerM2 - a.yieldKgPerM2);
    for (const crop of spaceHungry) {
      const bed = beds.filter((b) => !dedicated.has(b.id)).sort((a, b) => b.areaM2 - a.areaM2)[0];
      if (!bed) { notes.push(`${crop.name} wants a whole bed to itself — none free this round.`); continue; }
      // A standard narrow veg bed is too tight for a sprawling vine — its
      // spacingCm is plant-to-plant, not the room the vine actually spreads
      // into once established. Below MIN_DEDICATED_BED_M2 (or narrower than
      // MIN_DEDICATED_BED_WIDTH_M — a long 1m-wide strip has plenty of AREA
      // but still can't host a vine) the plant would outgrow the bed and
      // swamp its neighbours, so recommend a proper dedicated patch instead
      // of cramming it in — even if the bed is otherwise completely free.
      const tooSmall = bed.areaM2 < MIN_DEDICATED_BED_M2;
      const tooNarrow = bed.minDimM !== undefined && bed.minDimM < MIN_DEDICATED_BED_WIDTH_M;
      if (tooSmall || tooNarrow) {
        notes.push(tooNarrow && !tooSmall
          ? `${crop.name} needs a wider bed to sprawl into — your largest free bed has plenty of area but is too narrow (under ${MIN_DEDICATED_BED_WIDTH_M}m wide); give it its own dedicated patch instead (or train it up a trellis).`
          : `${crop.name} needs more room to sprawl than a standard veg bed — give it its own dedicated patch of at least ${MIN_DEDICATED_BED_M2}m² and ${MIN_DEDICATED_BED_WIDTH_M}m+ wide (or train it up a trellis) rather than one of your regular beds.`);
        continue;
      }
      const outcome = planSuccession(crop, pattern, [bed], occupancy, nowMonth, true, answers.rhythm, answers.goal, 1, rotation);
      if (outcome.status === 'NO_WINDOW') continue; // out of season for this rainfall pattern — not a real "later" case
      if (outcome.status === 'DELAYED_START') { laterThisYear.push({ cropKey: crop.key, nextWindowMonth: outcome.nextWindowMonth! }); continue; }
      // The largest free bed can still be too full to actually fit this crop
      // (e.g. an existing planting already occupies it through the relevant
      // months) — planSuccession then returns PARTIAL_FIT with ZERO
      // plantings placed. Dedicating the bed anyway would strand its
      // remaining free months from the rest of the plan for nothing.
      if (!outcome.plantings.length) {
        notes.push(`${crop.name} wants a whole bed to itself, but the largest free bed was already too full to fit it this round.`);
        continue;
      }
      dedicated.add(bed.id);
      added.push(...outcome.plantings);
    }
  }
  const sharedBeds = beds.filter((b) => !dedicated.has(b.id));

  if (answers.goal === 'commercial') {
    const result = runCommercialConcentration(pool, sharedBeds, answers.focusCropCount ?? 1, pattern, occupancy, nowMonth, answers.rhythm, rotation);
    added.push(...result.plantings);
    notes.push(...result.notes);
    laterThisYear.push(...result.laterThisYear);
  } else if (answers.goal === 'hybrid') {
    // Reserve beds for the "sell" portion FIRST (same whole-bed
    // concentration commercial mode uses, over a small fixed number of
    // beds), THEN feed the family with whatever's left. This is what
    // actually differentiates hybrid from family — it used to silently
    // ignore the "how many crops to sell" question entirely. Doing it in
    // the other order doesn't work: the family loop shares ALL its beds by
    // FRACTION across many crops, so it tends to touch every bed a little
    // rather than leaving any of them fully free for a "surplus" pass
    // afterward — reserving fixed whole beds up front sidesteps that.
    if (!sharedBeds.length) {
      notes.push('No beds free for family crops once space-hungry vines were placed.');
    } else {
      const wantedToSell = answers.focusCropCount ?? 0;
      let familyBeds = sharedBeds;
      if (wantedToSell > 0) {
        // Always leave at least one bed for the family — "feed us first" —
        // even if that means selling fewer crops than asked for.
        const sellBedCount = Math.min(wantedToSell, Math.max(0, sharedBeds.length - 1));
        if (sellBedCount > 0) {
          const sellBeds = sharedBeds.slice(0, sellBedCount);
          const sellResult = runCommercialConcentration(pool, sellBeds, wantedToSell, pattern, occupancy, nowMonth, answers.rhythm, rotation);
          added.push(...sellResult.plantings);
          notes.push(...sellResult.notes);
          laterThisYear.push(...sellResult.laterThisYear);
          familyBeds = sharedBeds.slice(sellBedCount);
        } else {
          notes.push('Only one bed free — kept it for feeding the family; add more beds to also set some aside for selling.');
        }
      }
      const familyResult = runFamilyBreadthFirst(pool, familyBeds, selectedGroups, answers.householdSize, pattern, occupancy, nowMonth, answers.rhythm, rotation);
      added.push(...familyResult.plantings);
      laterThisYear.push(...familyResult.laterThisYear);
    }
  } else {
    // family
    if (!sharedBeds.length) {
      notes.push('No beds free for family crops once space-hungry vines were placed.');
    } else {
      const familyResult = runFamilyBreadthFirst(pool, sharedBeds, selectedGroups, answers.householdSize, pattern, occupancy, nowMonth, answers.rhythm, rotation);
      added.push(...familyResult.plantings);
      laterThisYear.push(...familyResult.laterThisYear);
    }
  }

  // Runs over the FULL bed list (including dedicated vine beds, often empty
  // all winter once harvested) — the "assume the farmer wants year-round
  // production" ask. Comes after every other pass so it only ever fills a
  // genuinely still-empty winter gap, never displaces anything already
  // planned above.
  const winterResult = backfillWinterGaps(pool, beds, occupancy, pattern, nowMonth, rotation);
  added.push(...winterResult.plantings);
  notes.push(...winterResult.notes);
  laterThisYear.push(...winterResult.laterThisYear);

  // De-dupe laterThisYear (a crop could be considered more than once across passes).
  const seenLater = new Set<string>();
  const dedupedLater = laterThisYear.filter((l) => (seenLater.has(l.cropKey) ? false : (seenLater.add(l.cropKey), true)));

  return { plantings: added, notes, laterThisYear: dedupedLater };
}
