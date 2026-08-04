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
import { isSpaceHungry, harvestMonth } from './crop-plan';
import type { FoodGroup } from './crop-groups';
import { foodGroupOf, GROUP_PRIORITY, nextInRotation } from './crop-groups';

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
  // family/hybrid only (commercial mode's whole-bed concentration is a
  // deliberate farmer choice, not gated by this). Default false: a
  // space-hungry vine dedicating a whole veg bed to itself for months only
  // to sit there half-used is a poor default (real permaculture practice
  // grows these in a dedicated plot/edge/food-forest area, not a precious
  // rotational veg bed) — so by default they're only RECOMMENDED elsewhere,
  // never auto-placed. Turning this on restores the old auto-placement
  // behaviour as an explicit, informed choice.
  allowVinesInBeds: boolean;
}

export interface AutoSuggestResult {
  plantings: Planting[];
  notes: string[];
  laterThisYear: { cropKey: string; nextWindowMonth: number }[];
}

function plantingId(
  bedId: string,
  cropKey: string,
  sowMonth: number,
  areaFraction: number | undefined,
): string {
  const fraction = areaFraction ?? 1;
  return `auto:${encodeURIComponent(bedId)}:${encodeURIComponent(cropKey)}:${sowMonth}:${fraction}`;
}

/**
 * Several coverage passes may independently choose the same cohort. Present
 * that as one planting with their combined bed share, not duplicate rows
 * distinguished only by opaque ids.
 */
function consolidatePlantings(plantings: readonly Planting[]): Planting[] {
  const byCohort = new Map<string, Planting>();
  for (const planting of plantings) {
    const key = `${planting.bedId}\u0000${planting.cropKey}\u0000${planting.sowMonth}`;
    const existing = byCohort.get(key);
    if (!existing) {
      byCohort.set(key, { ...planting });
      continue;
    }
    const combinedFraction = Math.min(
      1,
      (existing.areaFraction ?? 1) + (planting.areaFraction ?? 1),
    );
    existing.areaFraction = combinedFraction < 1 ? combinedFraction : undefined;
  }
  return [...byCohort.values()].map((planting) => ({
    ...planting,
    id: plantingId(
      planting.bedId,
      planting.cropKey,
      planting.sowMonth,
      planting.areaFraction,
    ),
  }));
}

function monthsForward(from: number, to: number): number {
  return (((to - from) % 12) + 12) % 12;
}

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
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
  const sorted = [...new Set(months.filter(
    (month) => Number.isInteger(month) && month >= 1 && month <= 12,
  ))].sort((a, b) => a - b);
  if (!sorted.length) return [];
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
    for (const p of plantings) {
      if (!Number.isInteger(p.sowMonth) || p.sowMonth < 1 || p.sowMonth > 12) continue;
      const fraction = p.areaFraction;
      const safeFraction = fraction === undefined
        ? 1
        : Number.isFinite(fraction) && fraction > 0 && fraction <= 1
          ? fraction
          : 1;
      this.add(p.bedId, p.sowMonth, daysToHarvestOf(p), safeFraction);
    }
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
 * Plan-wide sowing tally by calendar month — THE STAGGER LEVER (added 2026-08-04).
 *
 * Coverage and cadence are different goals, and the engine only optimised the
 * first: every pass preferred the single longest-spanning candidate, so nine
 * identical beds all got their winter bridged by crops sown in the SAME early
 * window. The plan looked full (occupancy ~100%) while the owner's actual
 * complaint stood: "no new planting for Jun/Jul" and a bare September — every
 * bridger exhausted together, nothing freshly maturing behind it. Under
 * mild-frost the catalog genuinely sows 10 crops in June and 9 in July; the
 * clustering was ours, not the season's.
 *
 * Passes that place crops consult this tally and prefer candidates whose sow
 * month the plan has used LEAST — so identical beds diversify instead of
 * copying each other, and sowing (hence harvest) spreads around the calendar.
 * Counted over THIS plan's own additions only: last season's existing
 * plantings are history, and letting them suppress a fresh sowing in the same
 * month would re-create the very clustering this exists to break.
 */
type SowCounts = Map<number, number>;
function tallySowings(plantings: readonly Planting[]): SowCounts {
  const counts: SowCounts = new Map();
  for (const p of plantings) counts.set(p.sowMonth, (counts.get(p.sowMonth) ?? 0) + 1);
  return counts;
}
const sowCountAt = (counts: SowCounts, month: number): number => counts.get(month) ?? 0;
const bumpSow = (counts: SowCounts, month: number): void => { counts.set(month, (counts.get(month) ?? 0) + 1); };

/** Fraction ladder for a bed. A plot (field-scale rotation unit) takes ONE crop at FULL area — never a half or a third; that is what distinguishes it from a shared veg bed. */
const fractionPresetsFor = (bed: PlanBed): readonly number[] =>
  bed.kind === 'plot' ? [1] : BED_FRACTION_PRESETS;

/**
 * Persistent bed-rotation cursor — fixes a real bug: planSuccession used to
 * reset its round-robin bed search to bedsForCrop[0] on every single call,
 * so across a whole pass (many different crops/groups/focus-crops calling it
 * in turn) early-indexed beds got preferentially filled while later beds sat
 * untouched unless the earlier ones were already full. One instance is
 * created per autoSuggestPlan call and threaded through every planSuccession
 * call site, same lifecycle as Occupancy.
 *
 * Also (optionally) drives REAL crop rotation, gated behind
 * answers.rotateCrops: tracks only the LAST food group grown in each bed
 * (seeded from existingPlantings, i.e. a prior season) and prefers whichever
 * crop's group is the actual NEXT one in ROTATION_SEQUENCE for that specific
 * bed — not just "anything that isn't a repeat". A fresh bed with no history
 * has no preference yet (whatever gets placed first establishes where its
 * cycle starts). `conflicts` is checked against a SNAPSHOT taken at the start
 * of each planSuccession call (see there) so a crop's own later succession
 * batches are always free to reuse the same bed(s) as its own earlier
 * batches — that's the whole point of succession, not a rotation violation.
 */
class BedRotation {
  private lastBedId: string | null = null;
  private lastGroupByBed: Map<string, FoodGroup>;
  private rotateCrops: boolean;

  constructor(lastGroupByBed: Map<string, FoodGroup>, rotateCrops: boolean) {
    this.lastGroupByBed = lastGroupByBed;
    this.rotateCrops = rotateCrops;
  }

  nextIndex(beds: PlanBed[]): number {
    if (!this.lastBedId) return 0;
    const idx = beds.findIndex((b) => b.id === this.lastBedId);
    return idx === -1 ? 0 : (idx + 1) % beds.length;
  }

  /** True when `group` is NOT the ideal next group in this bed's rotation cycle (a fresh bed with no history never conflicts — anything starts its cycle). */
  conflicts(bedId: string, group: FoodGroup): boolean {
    if (!this.rotateCrops) return false;
    const last = this.lastGroupByBed.get(bedId);
    return last !== undefined && group !== nextInRotation(last);
  }

  /** A hard rotation violation: the same group would follow itself in this bed. */
  repeats(bedId: string, group: FoodGroup): boolean {
    if (!this.rotateCrops) return false;
    return this.lastGroupByBed.get(bedId) === group;
  }

  recordUse(bedId: string, group: FoodGroup) {
    this.lastBedId = bedId;
    this.lastGroupByBed.set(bedId, group);
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

  const startIdx = nearestCluster.months.indexOf(nearest.month);
  // NOT capped by bedsForCrop.length — a fast crop can cycle back through the
  // SAME bed for a later cohort once the earlier one has been harvested (the
  // round-robin bed search below, combined with occupancy.fits, already
  // guarantees no double-booking); capping the attempt count by bed count
  // was silently under-using capacity whenever there were fewer beds than
  // the crop's own succession cap, even when a bed would free up in time.
  const numBatches = Math.min(nearestCluster.months.length - startIdx, cap);
  const sowMonthsToTry = nearestCluster.months.slice(startIdx, startIdx + numBatches);

  // A whole-bed crop with more than one batch claiming the FULL bed per
  // batch can never overlap with its own next batch — each cohort has to
  // completely finish (sow→harvest span) before the next can start, so a
  // 3-4 month sow window collapses to just 1-2 widely-spaced cycles with a
  // dead gap between them (confirmed live: a cucumber bed sowing once in
  // Sep, sitting empty Oct-Nov, resowing in Dec). Splitting each batch to a
  // THIRD of the bed instead lets successive cohorts overlap in time — the
  // classic "staggered succession" technique for a continuously-available
  // harvest instead of one big flush then a gap. Single-batch whole-bed
  // crops (numBatches===1 — onions, garlic) are unaffected: there's nothing
  // to stagger against. Genuinely space-hungry vines (isSpaceHungry) are
  // ALSO excluded even with numBatches>1 — that classification means the
  // plant physically needs the full bed's ground while it's growing (that's
  // the whole reason it's "space-hungry"), so two sprawling half-bed vines
  // "overlapping" on paper would actually smother each other in the ground.
  const STAGGER_SLICES = 3;
  const perBatchFraction = wholeBed
    ? (numBatches > 1 && !isSpaceHungry(crop) ? closestPreset(1 / Math.min(numBatches, STAGGER_SLICES)) : 1)
    : fractionIfShared;

  const plantings: Planting[] = [];
  let bedCursor = rotation.nextIndex(bedsForCrop);
  const group = foodGroupOf(crop);
  // Snapshot taken BEFORE this call places anything — see BedRotation's own
  // doc comment for why this must not see this call's own later placements.
  const conflictedBedIds = new Set(bedsForCrop.filter((b) => rotation.conflicts(b.id, group)).map((b) => b.id));
  const repeatedBedIds = new Set(bedsForCrop.filter((b) => rotation.repeats(b.id, group)).map((b) => b.id));
  for (const sowMonth of sowMonthsToTry) {
    let placed = false;
    // Two passes: first target the ideal next group in each bed's rotation
    // cycle, then accept another DIFFERENT group if that is what fits. The
    // exact sequence is a preference; immediately repeating the same group
    // is not — that would make the rotation toggle break its core promise.
    // A later crop/group pass can still plan an otherwise-empty bed.
    for (let pass = 0; pass < 2 && !placed; pass++) {
      for (let i = 0; i < bedsForCrop.length; i++) {
        const bed = bedsForCrop[(bedCursor + i) % bedsForCrop.length];
        if (repeatedBedIds.has(bed.id)) continue;
        if (pass === 0 && conflictedBedIds.has(bed.id)) continue;
        // A plot never hosts a fraction (see fractionPresetsFor) — today's callers only
        // reach a plot with whole-area placements, so this is armour, not a live branch.
        if (bed.kind === 'plot' && perBatchFraction < 1) continue;
        if (occupancy.fits(bed.id, sowMonth, crop.daysToHarvest, perBatchFraction)) {
          occupancy.add(bed.id, sowMonth, crop.daysToHarvest, perBatchFraction);
          const areaFraction = perBatchFraction < 1 ? perBatchFraction : undefined;
          plantings.push({
            id: plantingId(bed.id, crop.key, sowMonth, areaFraction),
            bedId: bed.id,
            cropKey: crop.key,
            sowMonth,
            areaFraction,
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

  const requestedFocus = Number.isFinite(focusCropCount) && focusCropCount > 0
    ? Math.floor(focusCropCount)
    : 1;
  const focusN = Math.min(requestedFocus, targetBeds.length || 1);
  if (requestedFocus > focusN) {
    notes.push(`You asked to focus on ${requestedFocus} crops, but only ${focusN} bed${focusN === 1 ? ' is' : 's are'} free — picked the top ${focusN} by productivity instead.`);
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
/**
 * EVERY sow month whose span covers the whole winter window — not just the one
 * nearest to now. The nearest-only version forced all beds onto the same
 * bridger sow month; returning the full set lets the caller stagger bridgers
 * across beds by sow-month scarcity (see SowCounts), so their harvests don't
 * all end in the same week either.
 */
function winterCoveringSowMonths(crop: CropDef, pattern: RainPattern): number[] {
  const out: number[] = [];
  for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
    for (const m of cluster.months) {
      if (WINTER_MONTHS.every((wm) => occupiedMonths(m, crop.daysToHarvest).includes(wm))) out.push(m);
    }
  }
  return out;
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
 * only covering window is next March. That used to be routed to
 * laterThisYear and NOT planted — which made this pass a guaranteed no-op
 * whenever it ran between June and September (every covering sow month is
 * then 6-11 months forward), the engine-side half of "half the garden rests
 * all winter". The plan is a repeating annual cycle and the owner has
 * explicitly authorised sowings that flow into the next season, so a
 * far-out bridging sowing is now COMMITTED like any other planting — its
 * sow month shows on the timeline's forward columns, exactly like
 * fillRemainingGaps' own 11-month-horizon placements. laterThisYear remains
 * only as a guard beyond the shared horizon (unreachable today: mod-12
 * forward distance never exceeds 11).
 */
function backfillWinterGaps(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  sowCounts: SowCounts,
): { plantings: Planting[]; notes: string[]; laterThisYear: { cropKey: string; nextWindowMonth: number }[] } {
  const plantings: Planting[] = [];
  const notes: string[] = [];
  const laterThisYear: { cropKey: string; nextWindowMonth: number }[] = [];

  for (const bed of beds) {
    if (!WINTER_MONTHS.every((mo) => occupancy.fractionAt(bed.id, mo) === 0)) continue;

    // Sow-month SCARCITY leads the sort (see SowCounts): nine winter-empty beds
    // used to pick the same nearest bridger sow month nine times; now each
    // commit bumps the tally, so the next bed prefers a different month and the
    // bridgers' harvests spread across late winter and spring instead of all
    // ending together. Score and nearness only break ties.
    const candidates = pool
      .flatMap((crop) => winterCoveringSowMonths(crop, pattern).map((sowMonth) => ({ crop, sowMonth })))
      .filter((x) => occupancy.fits(bed.id, x.sowMonth, x.crop.daysToHarvest, 1))
      .sort((a, b) =>
        (sowCountAt(sowCounts, a.sowMonth) - sowCountAt(sowCounts, b.sowMonth))
        || (commercialScore(b.crop) - commercialScore(a.crop))
        || (monthsForward(nowMonth, a.sowMonth) - monthsForward(nowMonth, b.sowMonth)));

    if (!candidates.length) {
      // No SINGLE crop spans the whole May-Aug range — but that doesn't mean
      // the bed is stuck resting: fillRemainingGaps (which runs after this)
      // can still piece the gap together from several shorter winter-hardy
      // crops. Don't claim "will rest over winter" here — reportStillRestingBeds,
      // run at the very end against the FINAL occupancy, is the honest source
      // of truth for what's actually still empty once every pass has run.
      continue;
    }

    const nonRepeating = candidates.filter((c) => !rotation.repeats(bed.id, foodGroupOf(c.crop)));
    if (!nonRepeating.length) continue;
    const chosen = nonRepeating.find((c) => !rotation.conflicts(bed.id, foodGroupOf(c.crop))) ?? nonRepeating[0];
    const gap = monthsForward(nowMonth, chosen.sowMonth);
    if (gap > GAP_FILL_HORIZON_MONTHS) {
      laterThisYear.push({ cropKey: chosen.crop.key, nextWindowMonth: chosen.sowMonth });
      continue;
    }
    // HALF the bed, deliberately (2026-08-04). A full-bed bridger saturates winter at the
    // moment it is placed, so fillRemainingGaps — the only pass that would ever sow IN
    // June/July — found no room, and the plan had winter coverage with zero winter sowings
    // (the owner's "no new planting for jun july"). Half a bed of bridger + half a bed of
    // in-winter succession sowings covers the same months AND keeps fresh food maturing
    // through late winter into the September the bridgers leave bare. Plots stay whole-area
    // by identity (fractionPresetsFor).
    const bridgeFraction = bed.kind === 'plot' ? 1 : 0.5;
    occupancy.add(bed.id, chosen.sowMonth, chosen.crop.daysToHarvest, bridgeFraction);
    rotation.recordUse(bed.id, foodGroupOf(chosen.crop));
    bumpSow(sowCounts, chosen.sowMonth);
    const areaFraction = bridgeFraction < 1 ? bridgeFraction : undefined;
    plantings.push({
      id: plantingId(bed.id, chosen.crop.key, chosen.sowMonth, areaFraction),
      bedId: bed.id,
      cropKey: chosen.crop.key,
      sowMonth: chosen.sowMonth,
      areaFraction,
    });
    notes.push(`${bed.label} would otherwise rest all winter — added ${chosen.crop.name} (sow ${MONTHS_SHORT[chosen.sowMonth - 1]}) to half of it, leaving room for winter sowings alongside.`);
  }

  return { plantings, notes, laterThisYear };
}

/**
 * One sowing in every sowable month — the cadence promise, run BETWEEN
 * backfillWinterGaps and fillRemainingGaps while bed room is still plentiful.
 *
 * Why scarcity sorting alone couldn't finish the job: sow spans only run
 * FORWARD, so a June-sown crop occupies July but a July-sown crop never
 * occupies June. The gap-filler (rightly) treats a month as done once it's
 * covered — and every June placement covers July too, so July's room was
 * always consumed by June's sowings before July itself was ever tried ("no
 * new planting for jun july" was literally this shadow). This pass asks the
 * opposite question — not "is the month covered?" but "does anything NEW go
 * into the ground that month?" — and places exactly one modest sowing in each
 * calendar month the plan has none for, catalog and rotation permitting.
 * Fresh food then matures in a steady monthly rhythm instead of arriving in
 * the few big flushes the coverage passes naturally produce.
 *
 * Deliberately modest: half a bed at most (a quarter if that's what fits,
 * whole area only on plots — fractionPresetsFor), one placement per missing
 * month, never displacing anything already planned. Months where nothing in
 * the pool is genuinely sowable are skipped in silence —
 * reportStillRestingBeds remains the only honest voice for real limits.
 */
function ensureSowingCadence(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  allowVinesInBeds: boolean,
  sowCounts: SowCounts,
): { plantings: Planting[] } {
  const plantings: Planting[] = [];
  const bedEligiblePool = allowVinesInBeds ? pool : pool.filter((c) => !isSpaceHungry(c));

  for (let i = 0; i < 12; i++) {
    const m = wrapMonth(nowMonth + i);
    if (sowCountAt(sowCounts, m) > 0) continue;

    let best: { bed: PlanBed; crop: CropDef; fraction: number; freeAtM: number } | null = null;
    for (const bed of beds) {
      const bedPool = bed.kind === 'plot' ? pool : bedEligiblePool;
      // Half a bed at most — this pass adds rhythm, it must not monopolise the
      // room fillRemainingGaps still needs for coverage.
      const fractions = fractionPresetsFor(bed).filter((f) => bed.kind === 'plot' || f <= 0.5);
      for (const crop of bedPool) {
        if (!(crop.sowMonths[pattern] ?? []).includes(m)) continue;
        if (rotation.repeats(bed.id, foodGroupOf(crop))) continue;
        for (const fraction of fractions) {
          if (!occupancy.fits(bed.id, m, crop.daysToHarvest, fraction)) continue;
          const freeAtM = 1 - occupancy.fractionAt(bed.id, m);
          const conflictPenalty = rotation.conflicts(bed.id, foodGroupOf(crop)) ? 1 : 0;
          const bestPenalty = best && rotation.conflicts(best.bed.id, foodGroupOf(best.crop)) ? 1 : 0;
          if (
            !best
            || conflictPenalty < bestPenalty
            || (conflictPenalty === bestPenalty && (fraction > best.fraction
              || (fraction === best.fraction && (freeAtM > best.freeAtM
                || (freeAtM === best.freeAtM && commercialScore(crop) > commercialScore(best.crop))))))
          ) {
            best = { bed, crop, fraction, freeAtM };
          }
          break; // biggest fitting fraction for this (bed, crop) found — no need to shrink further
        }
      }
    }
    if (!best) continue;

    occupancy.add(best.bed.id, m, best.crop.daysToHarvest, best.fraction);
    rotation.recordUse(best.bed.id, foodGroupOf(best.crop));
    bumpSow(sowCounts, m);
    const areaFraction = best.fraction < 1 ? best.fraction : undefined;
    plantings.push({
      id: plantingId(best.bed.id, best.crop.key, m, areaFraction),
      bedId: best.bed.id,
      cropKey: best.crop.key,
      sowMonth: m,
      areaFraction,
    });
  }
  return { plantings };
}

// Safety cap on how many times fillRemainingGaps' per-bed loop can iterate —
// not a real planning limit, just a termination backstop. Each iteration
// either fills one calendar month (permanently removing it from the "empty"
// search) or marks one as stuck (permanently removing it too, see below), and
// there are only 12 calendar months, so the loop is naturally bounded by 12;
// this is a little headroom above that for safety.
const MAX_GAP_FILLS_PER_BED = 16;

// The rolling display already shows a full 12 months ahead (nowMonth through
// nowMonth+11) — every one of those columns is already "committed to" just
// by being on screen, so the LAST-RESORT gap-filling pass (fillRemainingGaps
// / reportStillRestingBeds) can reach all the way to the far edge of that
// same window rather than the tighter 5-month horizon the FIRST-CHOICE
// recommendation passes (planSuccession, backfillWinterGaps) use — those
// exist to avoid forcing an immediate, this-week decision on the farmer;
// this pass exists to avoid a visibly blank column in a view that's already
// showing the whole year, a different job with a different honest horizon.
const GAP_FILL_HORIZON_MONTHS = 11;

/**
 * Every (crop, sowMonth) pairing from `crops` that is BOTH reachable from
 * nowMonth (within `maxStartGap`) AND whose resulting occupied span
 * actually includes `targetMonth` — tries EVERY valid sow month in EVERY
 * cluster, not just whichever one lands nearest to targetMonth. A single
 * nearest-candidate search (the first version of this pass) can only ever
 * find sowMonth===targetMonth itself, since occupiedMonths() always counts
 * forward from sowMonth — missing every crop that's already growing by the
 * time targetMonth arrives because it was sown a month or two earlier.
 * Shared by fillRemainingGaps (to actually place something) and
 * reportStillRestingBeds (to honestly know whether it could have) so the
 * two can never disagree about what "reaches" a month — both must be
 * called with the SAME `maxStartGap` for that guarantee to hold.
 */
function reachingCandidates(
  crops: CropDef[],
  pattern: RainPattern,
  nowMonth: number,
  targetMonth: number,
  maxStartGap: number = DELAYED_START_THRESHOLD_MONTHS,
): { crop: CropDef; sowMonth: number; startGap: number }[] {
  const out: { crop: CropDef; sowMonth: number; startGap: number }[] = [];
  for (const crop of crops) {
    for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
      for (const sowMonth of cluster.months) {
        const startGap = monthsForward(nowMonth, sowMonth);
        if (startGap > maxStartGap) continue;
        if (!occupiedMonths(sowMonth, crop.daysToHarvest).includes(targetMonth)) continue;
        out.push({ crop, sowMonth, startGap });
      }
    }
  }
  return out;
}

/** Wrap-safe "Nov-Feb" style label for a (possibly year-wrapping) set of months — reuses clusterSowMonths's own wrap-merge rather than a fresh ad-hoc grouping. */
function monthRangeLabel(months: number[]): string {
  return clusterSowMonths(months)
    .map((r) => (r.months.length === 1 ? MONTHS_SHORT[r.start - 1] : `${MONTHS_SHORT[r.start - 1]}-${MONTHS_SHORT[r.end - 1]}`))
    .join(', ');
}

/**
 * Runs after every other allocation pass (including backfillWinterGaps) over
 * the FULL bed list. Where those earlier passes cap how many DISTINCT crops
 * a food group contributes (runFamilyBreadthFirst's repeatBudget — a
 * deliberate "variety, don't let one group hog every bed" limit) or only
 * bridge the exact May-Aug frost window with a single all-in-one crop
 * (backfillWinterGaps), this pass has no such cap: it keeps adding plantings
 * to any bed with a genuinely idle month ANYWHERE in the rolling 12-month
 * window, for as long as something in the pool can still reach it.
 *
 * This is the fix for "half the year sits empty" in a climate (e.g. Durban's
 * mild-frost, summer-rainfall pattern) that actually has a sowable crop for
 * nearly every month — the earlier passes' diversity cap was never meant to
 * also cap total YEAR coverage, but it had that side effect. Space-hungry
 * vines are excluded unless allowVinesInBeds, matching the same policy the
 * space-hungry pre-pass above already applies to shared beds.
 *
 * Tries whole-bed first, then falls back through BED_FRACTION_PRESETS
 * (1/2, 1/3, 1/4) — every catalog crop's minimum span is 3 months, so a
 * genuinely narrow 1-2 month gap wedged against an already-committed
 * neighbour can NEVER fit a whole-bed crop; a fractional share at least
 * partly closes it instead of giving up outright.
 */
function fillRemainingGaps(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
  rotation: BedRotation,
  allowVinesInBeds: boolean,
  sowCounts: SowCounts,
): { plantings: Planting[] } {
  const plantings: Planting[] = [];
  const eligiblePool = allowVinesInBeds ? pool : pool.filter((c) => !isSpaceHungry(c));
  // Avoids the SAME crop landing back-to-back in one bed purely because it's
  // the highest-scoring option every time rotation has nothing conflict-free
  // left to offer (a real farm can end up growing one thing all year
  // otherwise, in a small-garden/narrow-selection case).
  const lastCropByBed = new Map<string, string>();

  for (const bed of beds) {
    // The vine exclusion protects veg beds; a PLOT is the dedicated ground a vine is
    // supposed to sprawl in, so plots draw from the unfiltered pool.
    const bedPool = bed.kind === 'plot' ? pool : eligiblePool;
    // Months this bed's search has already tried and failed to fill — without
    // this, hitting ONE unfillable month would `break` and abandon the WHOLE
    // bed, silently skipping over other, genuinely-fillable months later in
    // the rolling window (confirmed live: a bed can have its nearest gap
    // blocked by an occupancy collision while a later gap is perfectly
    // fillable). Each of the 12 calendar months can only ever be found as a
    // gap once — it's either filled (occupancy becomes non-zero, permanently
    // leaving the search) or marked stuck here — so this also guarantees
    // termination without relying on fillCount alone.
    const stuckMonths = new Set<number>();

    for (let fillCount = 0; fillCount < MAX_GAP_FILLS_PER_BED; fillCount++) {
      // SCARCITY-FIRST month choice. The old pick was most-empty-room-first, which spends the
      // shoulder months (Aug-Nov, Feb-May) on quick high-score crops before winter is even
      // attempted — and winter's only bridgers are LONG crops (onions, garlic, broad beans)
      // whose spans need those very shoulder months free. By the time Jun-Jul came up, every
      // candidate failed occupancy and the hole was permanent. Resolving the month with the
      // FEWEST reaching candidates first plants the hard months while the space they need is
      // still open; easy months fill afterwards regardless of order.
      let gapMonth: number | null = null;
      let gapMonthOptions = Infinity;
      for (let i = 0; i < 12; i++) {
        const m = wrapMonth(nowMonth + i);
        if (stuckMonths.has(m)) continue;
        if (1 - occupancy.fractionAt(bed.id, m) <= 0.0001) continue;
        const options = reachingCandidates(bedPool, pattern, nowMonth, m, GAP_FILL_HORIZON_MONTHS).length;
        if (options < gapMonthOptions) { gapMonth = m; gapMonthOptions = options; }
      }
      if (gapMonth === null) break; // every still-empty month already tried, or bed is fully covered

      const reaching = reachingCandidates(bedPool, pattern, nowMonth, gapMonth, GAP_FILL_HORIZON_MONTHS);
      let chosen: { crop: CropDef; sowMonth: number; fraction: number } | null = null;

      // Sow-month scarcity leads, THEN longest empty-month cover. Cover-first alone (the
      // 2026-08-04-morning fix) did convert winter "rests" into bridges — but by always
      // preferring the longest span it made every bed bridge from the SAME early sow month,
      // which is how a plan with 100% winter coverage still had zero Jun/Jul sowings and a
      // bare September behind the exhausted bridgers. Scarcity-first staggers: the first bed
      // still takes the long bridger, and the tally then steers later beds toward the sow
      // months the plan hasn't used — a June-sown pea cohort covers Jun-Aug AND matures food
      // for the very months the bridgers go quiet. Cover, nearness and score break ties.
      const emptyCover = (c: { crop: CropDef; sowMonth: number }): number =>
        occupiedMonths(c.sowMonth, c.crop.daysToHarvest)
          .filter((mo) => occupancy.fractionAt(bed.id, mo) === 0).length;
      for (const fraction of fractionPresetsFor(bed)) {
        const fitting = reaching
          .filter((c) => occupancy.fits(bed.id, c.sowMonth, c.crop.daysToHarvest, fraction))
          .sort((a, b) => (sowCountAt(sowCounts, a.sowMonth) - sowCountAt(sowCounts, b.sowMonth)) || (emptyCover(b) - emptyCover(a)) || (a.startGap - b.startGap) || (commercialScore(b.crop) - commercialScore(a.crop)));
        if (!fitting.length) continue; // this fraction can't fit anything — try a smaller share

        const nonRepeating = fitting.filter((c) => !rotation.repeats(bed.id, foodGroupOf(c.crop)));
        if (!nonRepeating.length) continue;
        const nonConflicting = nonRepeating.filter((c) => !rotation.conflicts(bed.id, foodGroupOf(c.crop)));
        const pool2 = nonConflicting.length ? nonConflicting : nonRepeating;
        const nonRepeat = pool2.filter((c) => c.crop.key !== lastCropByBed.get(bed.id));
        const pick = nonRepeat[0] ?? pool2[0];
        chosen = { crop: pick.crop, sowMonth: pick.sowMonth, fraction };
        break; // biggest fraction with ANY fitting candidate wins — never shrink the share more than necessary
      }

      if (!chosen) { stuckMonths.add(gapMonth); continue; } // this month can't be filled — remember it, keep trying the bed's OTHER gaps

      occupancy.add(bed.id, chosen.sowMonth, chosen.crop.daysToHarvest, chosen.fraction);
      rotation.recordUse(bed.id, foodGroupOf(chosen.crop));
      bumpSow(sowCounts, chosen.sowMonth);
      lastCropByBed.set(bed.id, chosen.crop.key);
      const areaFraction = chosen.fraction < 1 ? chosen.fraction : undefined;
      plantings.push({
        id: plantingId(bed.id, chosen.crop.key, chosen.sowMonth, areaFraction),
        bedId: bed.id,
        cropKey: chosen.crop.key,
        sowMonth: chosen.sowMonth,
        areaFraction,
      });
    }
  }
  return { plantings };
}

/**
 * The final, honest accounting of what's STILL empty — computed against the
 * FINAL occupancy state, after every placement pass including
 * fillRemainingGaps has already had its chance. This is deliberately the
 * only place that reports "this bed rests" copy, so it can never contradict
 * a planting one of the earlier passes went on to add afterward. Genuinely
 * distinguishes "nothing in your selected crop types reaches this month"
 * (widen your selection) from "no crop in the whole catalog can, under this
 * rainfall pattern" (a real seasonal/frost limit, not a gap in the plan).
 *
 * Uses the SAME reachingCandidates search fillRemainingGaps just ran (rather
 * than a naive "does this crop's raw sowMonths array literally list this
 * month" check) — that naive check both false-positives (a crop whose sow
 * window is elsewhere but whose SPAN covers the month doesn't show up in its
 * own sowMonths array, so a genuinely-coverable month could wrongly be
 * called a "real seasonal limit") and false-negatives (a crop that
 * nominally lists the month but can never actually fit there — occupancy
 * collision, space-hungry exclusion — would wrongly suppress a note
 * entirely). Checked down to the smallest fraction fillRemainingGaps would
 * ever try for that bed's kind (1/4 for beds, 1 for plots) — if not even
 * that fits, nothing genuinely reaches.
 */
function reportStillRestingBeds(
  pool: CropDef[],
  beds: PlanBed[],
  occupancy: Occupancy,
  pattern: RainPattern,
  nowMonth: number,
): string[] {
  const notes: string[] = [];
  // Per-bed: a plot's only tryable fraction is 1 (fractionPresetsFor), so judging it by a
  // quarter-share "could fit" would promise a fill the gap pass is not allowed to make.
  const smallestFractionFor = (bed: PlanBed): number => {
    const presets = fractionPresetsFor(bed);
    return presets[presets.length - 1];
  };
  const canFill = (crops: CropDef[], bed: PlanBed, month: number): boolean =>
    reachingCandidates(crops, pattern, nowMonth, month, GAP_FILL_HORIZON_MONTHS).some((c) => occupancy.fits(bed.id, c.sowMonth, c.crop.daysToHarvest, smallestFractionFor(bed)));
  // Reach WITHOUT the occupancy check — the difference between "no crop's window covers this
  // stretch" (a seasonal fact about the catalogue) and "a crop could cover it but this bed's
  // plan is already too full around it" (a fact about the plan). The old copy blamed the
  // catalogue for both, which read as "nothing can grow here" on a bed the plan itself packed.
  const canReach = (crops: CropDef[], month: number): boolean =>
    reachingCandidates(crops, pattern, nowMonth, month, GAP_FILL_HORIZON_MONTHS).length > 0;

  for (const bed of beds) {
    const emptyMonths: number[] = [];
    for (let m = 1; m <= 12; m++) {
      if (occupancy.fractionAt(bed.id, m) === 0) emptyMonths.push(m);
    }
    if (!emptyMonths.length) continue;

    const label = emptyMonths.length === 12 ? 'all year' : monthRangeLabel(emptyMonths);
    const poolCanFillSome = emptyMonths.some((m) => canFill(pool, bed, m));
    const catalogCanFillSome = emptyMonths.some((m) => canFill(CROPS, bed, m));
    if (!poolCanFillSome && catalogCanFillSome) {
      notes.push(`${bed.label} still rests in ${label} — a crop outside your selected groups could cover it; widen your selection if you want it filled.`);
    } else if (!catalogCanFillSome && emptyMonths.some((m) => canReach(CROPS, m))) {
      notes.push(`${bed.label} still rests in ${label} — crops exist for that stretch, but this bed's surrounding months are already fully planted, so nothing long enough can fit. Freeing space nearby (or resting the bed) are both fine choices.`);
    } else if (!catalogCanFillSome) {
      notes.push(`${bed.label} still rests in ${label} — no crop in the catalog can be sown to cover that stretch under a '${pattern}' rainfall pattern (frost risk or genuinely out of season). That's a real seasonal limit, not a gap in the plan.`);
    }
    // poolCanFillSome true here would mean fillRemainingGaps (the identical
    // search, plus its own fits check) should already have used it — silent
    // rather than risking a note that contradicts what was just planted.
  }
  return notes;
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

  const seenBedIds = new Set<string>();
  const usableBeds = beds.filter((bed) => {
    if (
      !bed.id.trim()
      || seenBedIds.has(bed.id)
      || !Number.isFinite(bed.areaM2)
      || bed.areaM2 <= 0
      || (bed.minDimM !== undefined && (!Number.isFinite(bed.minDimM) || bed.minDimM <= 0))
    ) return false;
    seenBedIds.add(bed.id);
    return true;
  });
  if (usableBeds.length !== beds.length) {
    notes.push(`${beds.length - usableBeds.length} unusable or duplicate bed record${beds.length - usableBeds.length === 1 ? ' was' : 's were'} left out of the suggestion.`);
  }
  beds = usableBeds;

  if (!Number.isInteger(nowMonth) || nowMonth < 1 || nowMonth > 12) {
    notes.push('The current month was unavailable, so suggestions start from January.');
    nowMonth = 1;
  }

  const usableBedIds = new Set(beds.map((bed) => bed.id));
  const usableExistingPlantings = existingPlantings.filter(
    (planting) =>
      usableBedIds.has(planting.bedId)
      && Number.isInteger(planting.sowMonth)
      && planting.sowMonth >= 1
      && planting.sowMonth <= 12,
  );
  if (usableExistingPlantings.length !== existingPlantings.length) {
    notes.push(`${existingPlantings.length - usableExistingPlantings.length} existing planting record${existingPlantings.length - usableExistingPlantings.length === 1 ? ' was' : 's were'} missing a usable bed or sowing month and could not be scheduled.`);
  }

  const occupancy = new Occupancy();
  occupancy.seed(usableExistingPlantings, (p) => {
    const crop = CROPS.find((c) => c.key === p.cropKey);
    return crop ? crop.daysToHarvest : 0; // unknown crop key — occupy just the sow month (spanMonths(0) === 1)
  });

  // Bed → the food group grown MOST RECENTLY (nearest-behind-now harvest,
  // wrap-aware) — seeded from existingPlantings (this plan's own prior
  // additions, OR a genuinely earlier season re-using this same function) —
  // the basis for sequenced rotation below when the toggle is on. A bed with
  // several existing plantings (intercropped/staggered) picks whichever one
  // finished growing most recently as "what's actually there now".
  const bedLastGroup = new Map<string, FoodGroup>();
  const bedLastRecency = new Map<string, number>(); // smaller = more recently harvested
  for (const p of usableExistingPlantings) {
    const crop = CROPS.find((c) => c.key === p.cropKey);
    if (!crop) continue;
    const recency = monthsForward(harvestMonth(p.sowMonth, crop.daysToHarvest), nowMonth);
    if (bedLastRecency.has(p.bedId) && bedLastRecency.get(p.bedId)! <= recency) continue;
    bedLastRecency.set(p.bedId, recency);
    bedLastGroup.set(p.bedId, foodGroupOf(crop));
  }
  const rotation = new BedRotation(bedLastGroup, answers.rotateCrops);

  const selectedGroups = answers.groups.length ? new Set(answers.groups) : null;
  let pool = CROPS.filter((c) => !selectedGroups || selectedGroups.has(foodGroupOf(c)));
  if (!pool.length) pool = CROPS; // "not sure" fallback — consider everything

  const dedicated = new Set<string>();

  // ---- space-hungry pre-pass (family/hybrid only): whole dedicated bed
  // each, never split/intercropped. Commercial mode instead lets space-
  // hungry crops compete as ordinary ranked candidates below — a farmer who
  // asked to focus on 2 crops shouldn't have both beds silently claimed by
  // vines before their actual choice is even considered.
  //
  // Default (allowVinesInBeds=false): don't auto-place these at all — a vine
  // dedicating a whole veg bed for months, filling it with nothing else all
  // year, is a bad outcome for precious rotational bed space (confirmed by a
  // live farmer report of exactly that). Recommend a dedicated plot / property
  // edge / food-forest area instead, and only fall back to a veg bed when the
  // farmer explicitly opts in via the toggle — that opt-in IS the "are you
  // sure" confirmation this batch engine can offer (there's no farmer-in-the-
  // loop mid-generation; the review-before-accept screen plus this toggle
  // together serve the same purpose a runtime popup would).
  const plots = beds.filter((b) => b.kind === 'plot');

  if (answers.goal !== 'commercial') {
    const spaceHungry = pool.filter(isSpaceHungry).sort((a, b) => b.yieldKgPerM2 - a.yieldKgPerM2);
    // A vine's ideal home is a staple plot — field-scale ground that IS the "dedicated
    // patch" the note below tells the farmer to go find. Plots are tried FIRST and need no
    // toggle: allowVinesInBeds only ever guarded precious rotational veg-bed space.
    const vinesStillWanting: CropDef[] = [];
    // One plot per FOOD GROUP per round — the four-course invariant. Every catalog vine is
    // fruiting_veg, so without this gate three vines would quietly turn three of four plots
    // into a vine farm and the staple pass below would find one plot left for maize.
    const plotGroupsClaimed = new Set<FoodGroup>();
    for (const crop of spaceHungry) {
      const plot = plotGroupsClaimed.has(foodGroupOf(crop))
        ? undefined
        : plots.filter((p) => !dedicated.has(p.id)).sort((a, b) => b.areaM2 - a.areaM2)[0];
      if (!plot) { vinesStillWanting.push(crop); continue; }
      const outcome = planSuccession(crop, pattern, [plot], occupancy, nowMonth, true, answers.rhythm, answers.goal, 1, rotation);
      if (outcome.status === 'NO_WINDOW') continue;
      if (outcome.status === 'DELAYED_START') { laterThisYear.push({ cropKey: crop.key, nextWindowMonth: outcome.nextWindowMonth! }); continue; }
      if (!outcome.plantings.length) { vinesStillWanting.push(crop); continue; }
      dedicated.add(plot.id);
      plotGroupsClaimed.add(foodGroupOf(crop));
      added.push(...outcome.plantings);
      notes.push(`${crop.name} gets ${plot.label} to itself — a staple plot is exactly the dedicated sprawling room it wants.`);
    }
    if (vinesStillWanting.length && !answers.allowVinesInBeds) {
      const names = vinesStillWanting.map((c) => c.name).join(', ');
      notes.push(`${names} want more room to sprawl than a veg bed can give — grow them in a dedicated plot, along your property edges, or in a food forest area instead. Turn on "Grow big vines in a veg bed anyway" if you'd rather use one of your beds for them.`);
    }
    for (const crop of vinesStillWanting) {
      if (!answers.allowVinesInBeds) continue;
      const bed = beds.filter((b) => !dedicated.has(b.id) && b.kind !== 'plot').sort((a, b) => b.areaM2 - a.areaM2)[0];
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
  // ---- staple plots: the rotation's field-scale units ("for ubhejane we have 4 plots —
  // so we can [do] rotations"). Each remaining plot (a vine may have claimed one above)
  // takes ONE crop at FULL area for the season. Groups not yet used on another plot this
  // round are preferred — with four plots that lands the classic four-course layout
  // (grain / legume / root / fruiting-vine) in a single pass — and BedRotation, seeded
  // from existingPlantings, turns each plot to its next group when the farmer re-runs
  // the suggestion next season with Rotate crops on.
  if (plots.length) {
    const groupsUsedOnPlots = new Set<FoodGroup>();
    for (const p of added) {
      if (!plots.some((pl) => pl.id === p.bedId)) continue;
      const crop = CROPS.find((c) => c.key === p.cropKey);
      if (crop) groupsUsedOnPlots.add(foodGroupOf(crop));
    }
    // Field-crop preference on a plot, nothing to do with dietary priority: these are the
    // groups whose members are grown at field scale in SA staple gardens.
    const STAPLE_RANK: Partial<Record<FoodGroup, number>> = { staple_grain: 0, legume: 1, root_tuber: 2, fruiting_veg: 3 };
    const plotSowTally = tallySowings(added);
    const plotLines: string[] = [];
    for (const plot of plots) {
      if (dedicated.has(plot.id)) continue;
      const candidates: { crop: CropDef; sowMonth: number; startGap: number }[] = [];
      for (const crop of pool) {
        for (const cluster of clusterSowMonths(crop.sowMonths[pattern])) {
          for (const sowMonth of cluster.months) {
            const startGap = monthsForward(nowMonth, sowMonth);
            if (startGap > GAP_FILL_HORIZON_MONTHS) continue;
            if (!occupancy.fits(plot.id, sowMonth, crop.daysToHarvest, 1)) continue;
            candidates.push({ crop, sowMonth, startGap });
          }
        }
      }
      const nonRepeating = candidates.filter((c) => !rotation.repeats(plot.id, foodGroupOf(c.crop)));
      if (!nonRepeating.length) continue; // fillRemainingGaps still gets a whole-plot try later
      const nonConflicting = nonRepeating.filter((c) => !rotation.conflicts(plot.id, foodGroupOf(c.crop)));
      const pickFrom = nonConflicting.length ? nonConflicting : nonRepeating;
      pickFrom.sort((a, b) => {
        const ga = foodGroupOf(a.crop);
        const gb = foodGroupOf(b.crop);
        return (Number(groupsUsedOnPlots.has(ga)) - Number(groupsUsedOnPlots.has(gb)))
          || ((STAPLE_RANK[ga] ?? 9) - (STAPLE_RANK[gb] ?? 9))
          || (sowCountAt(plotSowTally, a.sowMonth) - sowCountAt(plotSowTally, b.sowMonth))
          || (a.startGap - b.startGap)
          || (commercialScore(b.crop) - commercialScore(a.crop));
      });
      const chosen = pickFrom[0];
      occupancy.add(plot.id, chosen.sowMonth, chosen.crop.daysToHarvest, 1);
      rotation.recordUse(plot.id, foodGroupOf(chosen.crop));
      groupsUsedOnPlots.add(foodGroupOf(chosen.crop));
      bumpSow(plotSowTally, chosen.sowMonth);
      added.push({
        id: plantingId(plot.id, chosen.crop.key, chosen.sowMonth, undefined),
        bedId: plot.id,
        cropKey: chosen.crop.key,
        sowMonth: chosen.sowMonth,
      });
      plotLines.push(`${plot.label}: ${chosen.crop.name} (sow ${MONTHS_SHORT[chosen.sowMonth - 1]})`);
    }
    if (plotLines.length) {
      notes.push(`Staple plots each take one crop at full area — ${plotLines.join(' · ')}. Re-run the suggestion next season with Rotate crops on and each plot turns to its next group.`);
    }
  }

  // Plots never join the shared-bed passes: runFamilyBreadthFirst splits beds by fraction
  // across many crops, and a plot's whole identity is one crop at full area.
  const sharedBeds = beds.filter((b) => !dedicated.has(b.id) && b.kind !== 'plot');

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
  // One tally for both closing passes — backfill's own commits steer gap-fill too.
  const sowCounts = tallySowings(added);
  const winterResult = backfillWinterGaps(pool, beds, occupancy, pattern, nowMonth, rotation, sowCounts);
  added.push(...winterResult.plantings);
  notes.push(...winterResult.notes);
  laterThisYear.push(...winterResult.laterThisYear);

  // BEFORE the packer: every catalogue-sowable month gets one fresh sowing while room is
  // still plentiful — see ensureSowingCadence's own comment for why the packer alone can
  // never reach July (forward spans mean June's placements always shadow it).
  const cadenceResult = ensureSowingCadence(pool, beds, occupancy, pattern, nowMonth, rotation, answers.allowVinesInBeds, sowCounts);
  added.push(...cadenceResult.plantings);

  // The general "don't leave a bed idle for months in a climate that can
  // support continuous cropping" pass — see fillRemainingGaps's own doc
  // comment for why this is a separate, uncapped pass rather than just
  // raising runFamilyBreadthFirst's repeatBudget (that budget is a
  // deliberate variety cap, not meant to also cap total year coverage).
  const gapResult = fillRemainingGaps(pool, beds, occupancy, pattern, nowMonth, rotation, answers.allowVinesInBeds, sowCounts);
  added.push(...gapResult.plantings);

  // Computed LAST, against final occupancy — the only honest place to say
  // "this bed rests" (see reportStillRestingBeds's own doc comment).
  notes.push(...reportStillRestingBeds(pool, beds, occupancy, pattern, nowMonth));

  // De-dupe laterThisYear (a crop could be considered more than once across passes).
  const seenLater = new Set<string>();
  const dedupedLater = laterThisYear.filter((l) => (seenLater.has(l.cropKey) ? false : (seenLater.add(l.cropKey), true)));

  return {
    plantings: consolidatePlantings(added),
    notes,
    laterThisYear: dedupedLater,
  };
}
