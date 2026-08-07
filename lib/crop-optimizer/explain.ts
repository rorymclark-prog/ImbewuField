/**
 * Two audiences, one set of numbers.
 *
 * The rebuild spec: "The farmer sees plain language. The developer sees the
 * numbers that made the decision." The important word is *made*. This file
 * therefore separates the tiers that actually ranked the plan from the figures
 * that are only reported, so nobody can read a reported number as a decision.
 *
 * Anything the sources cannot support is `null` with a stated reason. A null
 * here is a real answer — "this is not known" — not a missing feature.
 */

import type { PlacementExplanation } from '@/lib/crop-plan-v2';
import { cropByKey } from '@/lib/crop-catalog';
import type { FoodGroup } from '@/lib/crop-groups';
import { FOOD_GROUP_META } from '@/lib/crop-groups';
import type { PlanScoreDetail } from './objectives';
import type {
  HouseholdNeedPolicy,
  OptimizerCandidate,
  SelectionSolution,
} from './types';

export interface RankedTier {
  /** The `ObjectiveVector` field this tier reads. */
  key: string;
  direction: 'minimise' | 'maximise';
  value: number;
  plainLanguage: string;
}

export interface ReportedOnlyFigure {
  key: string;
  value: number | null;
  /** Why it did not rank the plan. Never "not implemented" without saying so. */
  whyNotRanked: string;
}

export interface CropCoverage {
  met: number;
  requested: number;
  missing: string[];
}

export interface ObjectiveBreakdown {
  /**
   * Harvested kilograms over the horizon divided by the household's stated
   * need over the same horizon. Null unless the caller supplied a sourced
   * kg-per-person figure AND every selected cohort has a defensible weight.
   *
   * It is a HORIZON ratio, not a weekly one: the catalog explicitly declines
   * to split a picking period into an even weekly kg profile, so a weekly
   * supply figure would be invented. `weeksWithoutFreshHarvest` is the honest
   * weekly measure available today.
   */
  householdSupplyScore: number | null;
  householdSupplyUnknownReason: string | null;
  weeksWithoutFreshHarvest: number;
  longestFreshGapWeeks: number;
  /** Irrigation-confirmed section-weeks planted, over the total. */
  raisedBedUtilisation: number | null;
  selectedCropCoverage: CropCoverage;
  foodGroupCoverage: { met: FoodGroup[]; missing: FoodGroup[] };
  peakWeeklyJobs: number;
  totalKgRange: readonly [number, number] | null;
  saleKgPerBedWeek: number | null;
  unplacedReasons: PlacementExplanation[];
  /** The tiers that ranked this plan, in the order they were applied. */
  rankedBy: RankedTier[];
  /** Computed and shown, but not part of the ranking. */
  reportedOnly: ReportedOnlyFigure[];
}

export interface BreakdownInput {
  solution: SelectionSolution;
  detail: PlanScoreDetail;
  selectedCandidates: readonly OptimizerCandidate[];
  allCandidates: readonly OptimizerCandidate[];
  horizonWeeks: number;
  requestedCropKeys: readonly string[];
  requestedFoodGroups?: readonly FoodGroup[];
  household?: HouseholdNeedPolicy;
  generationExplanations: readonly PlacementExplanation[];
}

function cropName(cropKey: string): string {
  return cropByKey(cropKey)?.name ?? cropKey;
}

function householdSupply(
  detail: PlanScoreDetail,
  horizonWeeks: number,
  household: HouseholdNeedPolicy | undefined,
): { score: number | null; reason: string | null } {
  if (!household?.kgPerPersonPerWeek || !household.householdSize) {
    return {
      score: null,
      reason: 'No sourced household need was supplied (people and kilograms per person per week), so supply cannot be measured against anything.',
    };
  }
  if (!detail.totalKgRange) {
    return {
      score: null,
      reason: `${detail.cohortsWithUnknownYield} planned crop${detail.cohortsWithUnknownYield === 1 ? '' : 's'} has no defensible harvest weight in the catalog, so the plan's total is unknown rather than partial.`,
    };
  }
  const need = household.householdSize * household.kgPerPersonPerWeek * horizonWeeks;
  if (need <= 0) return { score: null, reason: 'The stated household need works out to zero.' };
  // The conservative end of the yield range. A plan should not look adequate
  // because its optimistic end happened to reach the target.
  return { score: detail.totalKgRange[0] / need, reason: null };
}

export function buildObjectiveBreakdown(input: BreakdownInput): ObjectiveBreakdown {
  const { detail, horizonWeeks } = input;
  const selectedCropKeys = new Set(input.selectedCandidates.map((candidate) => candidate.cropKey));
  const requested = [...new Set(input.requestedCropKeys)];
  const missing = requested.filter((cropKey) => !selectedCropKeys.has(cropKey));

  const selectedGroups = new Set<FoodGroup>();
  for (const candidate of input.selectedCandidates) {
    for (const group of candidate.foodGroups) selectedGroups.add(group);
  }
  const requestedGroups = input.requestedFoodGroups
    ?? (Object.keys(FOOD_GROUP_META) as FoodGroup[]);

  const harvestWeeks = new Set(detail.harvestWeeks);
  let weeksWithoutFreshHarvest = 0;
  for (let week = 0; week < horizonWeeks; week++) if (!harvestWeeks.has(week)) weeksWithoutFreshHarvest++;

  const supply = householdSupply(detail, horizonWeeks, input.household);

  const unplacedReasons: PlacementExplanation[] = [...input.generationExplanations];
  for (const cropKey of missing) {
    const hadCandidates = input.allCandidates.some((candidate) => candidate.cropKey === cropKey);
    if (!hadCandidates) continue; // generation already said why, above.
    unplacedReasons.push({
      code: 'crowded-out',
      message: `${cropName(cropKey)} had legal placements, but every one of them needed bed sections and weeks the chosen plan had already committed to a crop that scored better.`,
    });
  }

  const objective = input.solution.objective;
  const rankedBy: RankedTier[] = objective
    ? [
      {
        key: 'selectedCropPlacements',
        direction: 'maximise',
        value: objective.selectedCropPlacements,
        plainLanguage: `${objective.selectedCropPlacements} crop plantings placed${requested.length > 0 ? ' from the crops you asked for' : ''}.`,
      },
      {
        key: 'longestFreshFoodGapWeeks',
        direction: 'minimise',
        value: objective.longestFreshFoodGapWeeks,
        plainLanguage: `The longest stretch with nothing ready to pick is ${objective.longestFreshFoodGapWeeks} week${objective.longestFreshFoodGapWeeks === 1 ? '' : 's'}.`,
      },
      {
        key: 'idleSectionWeeks',
        direction: 'minimise',
        value: objective.idleSectionWeeks,
        plainLanguage: `${objective.idleSectionWeeks} watered bed-section week${objective.idleSectionWeeks === 1 ? '' : 's'} are left bare.`,
      },
      {
        key: 'cropDiversity',
        direction: 'maximise',
        value: objective.cropDiversity,
        plainLanguage: `${objective.cropDiversity} different crop${objective.cropDiversity === 1 ? '' : 's'} across the beds.`,
      },
      {
        key: 'operationalTransitions',
        direction: 'minimise',
        value: objective.operationalTransitions,
        plainLanguage: `${objective.operationalTransitions} sowing, planting-out and first-harvest jobs in total.`,
      },
    ]
    : [];

  const reportedOnly: ReportedOnlyFigure[] = [
    {
      key: 'householdSupplyScore',
      value: supply.score,
      whyNotRanked: 'Household food need is the rebuild spec\'s first goal, but the V2 objective vector has no tier for it. Adding one changes a persisted plan format and the exact oracle\'s score shape, so it is a foundation change rather than a solver change. Today it is measured and shown, and it does not choose the plan.',
    },
    {
      key: 'peakWeeklyJobs',
      value: detail.peakWeeklyJobs,
      whyNotRanked: 'The objective vector ranks the TOTAL number of jobs, not the busiest week. Smoothing workload needs its own tier.',
    },
    {
      key: 'saleKgPerBedWeek',
      value: null,
      whyNotRanked: 'Nothing in this plan is assigned to sale yet, so there is no sale portion to measure. A household/sale split is a separate input this pass does not take.',
    },
  ];

  return {
    householdSupplyScore: supply.score,
    householdSupplyUnknownReason: supply.reason,
    weeksWithoutFreshHarvest,
    longestFreshGapWeeks: detail.score.longestFreshFoodGapWeeks,
    raisedBedUtilisation: detail.totalIrrigatedSectionWeeks > 0
      ? detail.occupiedIrrigatedSectionWeeks / detail.totalIrrigatedSectionWeeks
      : null,
    selectedCropCoverage: {
      met: requested.length - missing.length,
      requested: requested.length,
      missing,
    },
    foodGroupCoverage: {
      met: requestedGroups.filter((group) => selectedGroups.has(group)),
      missing: requestedGroups.filter((group) => !selectedGroups.has(group)),
    },
    peakWeeklyJobs: detail.peakWeeklyJobs,
    totalKgRange: detail.totalKgRange,
    saleKgPerBedWeek: null,
    unplacedReasons,
    rankedBy,
    reportedOnly,
  };
}

/**
 * Plain language for the farmer. Every line is a fact from the breakdown; none
 * of them reassures. A plan with an eleven-week hungry gap says eleven weeks.
 */
export function farmerSummaryLines(breakdown: ObjectiveBreakdown): string[] {
  const lines: string[] = [];
  lines.push(breakdown.longestFreshGapWeeks === 0
    ? 'There is something ready to pick in every week of this plan.'
    : `The longest stretch with nothing ready to pick is ${breakdown.longestFreshGapWeeks} week${breakdown.longestFreshGapWeeks === 1 ? '' : 's'}.`);

  if (breakdown.raisedBedUtilisation !== null) {
    lines.push(`${Math.round(breakdown.raisedBedUtilisation * 100)}% of your watered bed space is in use across the plan.`);
  } else {
    lines.push('None of these beds has confirmed irrigation, so bare weeks are not counted against the plan.');
  }

  if (breakdown.selectedCropCoverage.requested > 0) {
    const { met, requested, missing } = breakdown.selectedCropCoverage;
    lines.push(met === requested
      ? `All ${requested} crops you asked for are in the plan.`
      : `${met} of ${requested} crops you asked for are in the plan. Not placed: ${missing.map(cropName).join(', ')}.`);
  }

  if (breakdown.totalKgRange) {
    const [low, high] = breakdown.totalKgRange;
    lines.push(`Planned harvest is roughly ${low.toFixed(1)}–${high.toFixed(1)} kg over the whole plan, if the season goes well.`);
  } else {
    lines.push('Some crops in this plan have no reliable harvest weight, so there is no total kilogram figure for it.');
  }

  if (breakdown.householdSupplyScore === null && breakdown.householdSupplyUnknownReason) {
    lines.push(`Whether this feeds the household is not measured: ${breakdown.householdSupplyUnknownReason}`);
  } else if (breakdown.householdSupplyScore !== null) {
    const percent = Math.round(breakdown.householdSupplyScore * 100);
    lines.push(percent >= 100
      ? 'On the conservative yield figures this plan meets the household food target you gave.'
      : `On the conservative yield figures this plan covers about ${percent}% of the household food target you gave.`);
  }

  lines.push(`Busiest week has ${breakdown.peakWeeklyJobs} job${breakdown.peakWeeklyJobs === 1 ? '' : 's'} to do.`);
  return lines;
}
