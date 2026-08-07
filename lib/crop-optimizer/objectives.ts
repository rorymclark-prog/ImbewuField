/**
 * The ordered objective.
 *
 * The foundation already fixed the ranking: `compareObjectiveVectors` in
 * lib/crop-plan-v2.ts is lexicographic over six named numbers, and the exact
 * oracle judges by it. This file therefore does NOT invent a score — it fills
 * that vector honestly and nothing else. There are no weights here to tune,
 * because there is no weighted sum anywhere in the ranking.
 *
 * Two of the rebuild spec's ordered goals have no tier in that vector:
 * unmet household food need (goal 1) and time-adjusted sale margin (goal 7).
 * They are COMPUTED and REPORTED by explain.ts, and they do not influence the
 * choice. Folding them into an existing tier would be the "mysterious score"
 * the spec forbids, and widening `ObjectiveVector` changes a persisted plan
 * format plus the oracle's `ExactScore` — a foundation decision, not this
 * file's. The gap is stated in the breakdown's `rankedBy` so it cannot be
 * mistaken for a solved problem.
 */

import type { ObjectiveVector } from '@/lib/crop-plan-v2';
import {
  sectionWeekKey,
  type ExactCandidate,
  type OptimizerCandidate,
  type SelectionScore,
} from './types';

export interface PlanScoreContext {
  horizonWeeks: number;
  candidatesById: ReadonlyMap<string, OptimizerCandidate>;
  /** `${sectionId}#${week}` keys already held by fixed cohorts. */
  fixedOccupiedSectionWeeks: ReadonlySet<string>;
  /** Weeks a fixed cohort already feeds. A gap is a gap for the whole plan. */
  fixedHarvestWeeks: ReadonlySet<number>;
  /**
   * Bare ground is only counted against a plan where irrigation is confirmed
   * (spec goal 3). Unwatered ground left empty in the dry season is a
   * decision, not a failure.
   */
  irrigatedSectionIds: ReadonlySet<string>;
  /**
   * Crops the farmer asked for. When empty, every placement counts toward the
   * coverage tier; when not, only requested crops do — so filling the rest of
   * the beds is settled by the later tiers rather than by pretending an
   * unrequested crop met a request.
   */
  requestedCropKeys: ReadonlySet<string>;
}

export interface PlanScorer {
  (selected: readonly ExactCandidate[]): SelectionScore;
  /** Same numbers, plus the ones the vector cannot rank. For explain.ts. */
  detail(selected: readonly ExactCandidate[]): PlanScoreDetail;
}

export interface PlanScoreDetail {
  score: SelectionScore;
  harvestWeeks: number[];
  occupiedIrrigatedSectionWeeks: number;
  totalIrrigatedSectionWeeks: number;
  jobsByWeek: number[];
  peakWeeklyJobs: number;
  /** Null the moment any selected cohort has no defensible weight. */
  totalKgRange: readonly [number, number] | null;
  cohortsWithUnknownYield: number;
}

function resolve(
  selected: readonly ExactCandidate[],
  context: PlanScoreContext,
): OptimizerCandidate[] {
  return selected.map((entry) => {
    const candidate = context.candidatesById.get(entry.id);
    if (!candidate) {
      // Throwing is deliberate. A scorer that quietly skips an unknown
      // placement reports a better plan than the one it was given.
      throw new Error(`The plan scorer was given an unknown candidate id: ${entry.id}`);
    }
    return candidate;
  });
}

function longestGap(harvestWeeks: ReadonlySet<number>, horizonWeeks: number): number {
  let longest = 0;
  let current = 0;
  for (let week = 0; week < horizonWeeks; week++) {
    if (harvestWeeks.has(week)) {
      current = 0;
      continue;
    }
    current++;
    if (current > longest) longest = current;
  }
  return longest;
}

/**
 * Builds the scorer the solver and the oracle both use. Passing the SAME
 * function to both is what makes an oracle comparison meaningful: any
 * difference in the answer is then a difference in the search, not in taste.
 */
export function createPlanScorer(context: PlanScoreContext): PlanScorer {
  const totalIrrigatedSectionWeeks = context.irrigatedSectionIds.size * context.horizonWeeks;
  const fixedIrrigatedKeys = new Set<string>();
  for (const sectionId of context.irrigatedSectionIds) {
    for (let week = 0; week < context.horizonWeeks; week++) {
      const key = sectionWeekKey(sectionId, week);
      if (context.fixedOccupiedSectionWeeks.has(key)) fixedIrrigatedKeys.add(key);
    }
  }

  const detail = (selected: readonly ExactCandidate[]): PlanScoreDetail => {
    const candidates = resolve(selected, context);

    const harvestWeeks = new Set<number>(context.fixedHarvestWeeks);
    const occupiedIrrigated = new Set<string>(fixedIrrigatedKeys);
    const jobsByWeek = new Array<number>(context.horizonWeeks).fill(0);
    const cropKeys = new Set<string>();
    let operations = 0;
    let requestedPlacements = 0;
    let kgLow = 0;
    let kgHigh = 0;
    let cohortsWithUnknownYield = 0;

    for (const candidate of candidates) {
      cropKeys.add(candidate.cropKey);
      if (context.requestedCropKeys.size === 0 || context.requestedCropKeys.has(candidate.cropKey)) {
        requestedPlacements++;
      }
      for (const entry of candidate.harvestProfileByWeek) harvestWeeks.add(entry.week);
      for (const key of candidate.irrigatedSectionWeekKeys) occupiedIrrigated.add(key);
      for (const entry of candidate.labourByWeek) {
        operations += entry.jobs.length;
        if (entry.week >= 0 && entry.week < context.horizonWeeks) {
          jobsByWeek[entry.week] += entry.jobs.length;
        }
      }
      if (candidate.expectedKgRange) {
        kgLow += candidate.expectedKgRange[0];
        kgHigh += candidate.expectedKgRange[1];
      } else {
        cohortsWithUnknownYield++;
      }
    }

    const score: SelectionScore = {
      selectedCropPlacements: requestedPlacements,
      longestFreshFoodGapWeeks: longestGap(harvestWeeks, context.horizonWeeks),
      idleSectionWeeks: totalIrrigatedSectionWeeks - occupiedIrrigated.size,
      cropDiversity: cropKeys.size,
      operationalTransitions: operations,
    };

    return {
      score,
      harvestWeeks: [...harvestWeeks].sort((a, b) => a - b),
      occupiedIrrigatedSectionWeeks: occupiedIrrigated.size,
      totalIrrigatedSectionWeeks,
      jobsByWeek,
      peakWeeklyJobs: jobsByWeek.reduce((peak, jobs) => (jobs > peak ? jobs : peak), 0),
      // One unknown weight makes the whole total unknown. A partial sum
      // presented as a plan total is exactly the invented number the spec bans.
      totalKgRange: cohortsWithUnknownYield > 0 ? null : [kgLow, kgHigh],
      cohortsWithUnknownYield,
    };
  };

  const scorer = ((selected: readonly ExactCandidate[]) => detail(selected).score) as PlanScorer;
  scorer.detail = detail;
  return scorer;
}

/**
 * Assembles the full ranked vector from a score.
 *
 * `hardViolations` is always 0 because every hard constraint is enforced
 * structurally — a plan that breaks one is never built, rather than built and
 * penalised. `deterministicTieBreak` is the canonical id list and is produced
 * here, not by the scorer, exactly as the oracle does it: a scorer must not be
 * able to declare its own legality or its own winner.
 */
export function buildObjectiveVector(
  canonicalSelectedIds: readonly string[],
  score: SelectionScore,
): ObjectiveVector {
  return {
    hardViolations: 0,
    selectedCropPlacements: score.selectedCropPlacements,
    longestFreshFoodGapWeeks: score.longestFreshFoodGapWeeks,
    idleSectionWeeks: score.idleSectionWeeks,
    cropDiversity: score.cropDiversity,
    operationalTransitions: score.operationalTransitions,
    deterministicTieBreak: JSON.stringify(canonicalSelectedIds),
  };
}

export function isFiniteScore(value: unknown): value is SelectionScore {
  if (typeof value !== 'object' || value === null) return false;
  const score = value as Record<string, unknown>;
  return typeof score.selectedCropPlacements === 'number' && Number.isFinite(score.selectedCropPlacements)
    && typeof score.longestFreshFoodGapWeeks === 'number' && Number.isFinite(score.longestFreshFoodGapWeeks)
    && typeof score.idleSectionWeeks === 'number' && Number.isFinite(score.idleSectionWeeks)
    && typeof score.cropDiversity === 'number' && Number.isFinite(score.cropDiversity)
    && typeof score.operationalTransitions === 'number' && Number.isFinite(score.operationalTransitions);
}
