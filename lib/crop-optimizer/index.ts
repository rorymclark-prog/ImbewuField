/**
 * The V2 raised-bed crop optimiser.
 *
 * Generation → selection → explanation, with the foundation's `PlannerResult`
 * as the outward contract so this can stand beside the legacy engine rather
 * than inside it. Staple plots are deliberately absent: they are a separate
 * solver with a different hard constraint (a plot takes one crop at full area)
 * and this pass refuses them rather than half-planning them as beds.
 */

import type {
  CropPlannerEngine,
  PlacementExplanation,
  PlannerResult,
} from '@/lib/crop-plan-v2';
import { generateRaisedBedCandidates, type CandidateGenerationOptions } from './candidate-generator';
import { buildObjectiveBreakdown, type ObjectiveBreakdown } from './explain';
import { createPlanScorer } from './objectives';
import { solveSelection } from './raised-bed-solver';
import { validateRaisedBedSolverInput } from './validate';
import type {
  ExactCandidate,
  OptimizerCandidate,
  RaisedBedSolverInput,
  SelectionDiagnostics,
  SelectionSolverOptions,
} from './types';

export const RAISED_BED_OPTIMIZER_ID = 'crop-optimizer-raised-bed-v1';

export interface RaisedBedSolveOptions extends SelectionSolverOptions {
  generation?: CandidateGenerationOptions;
}

export interface RaisedBedSolveOutcome {
  /** The foundation-shaped result. This is what a caller persists or renders. */
  plannerResult: PlannerResult;
  /** The developer-facing numbers, separated into ranked and reported-only. */
  breakdown: ObjectiveBreakdown | null;
  selectedCandidateIds: string[];
  /** Every legal placement that was considered. */
  candidates: OptimizerCandidate[];
  diagnostics: SelectionDiagnostics | null;
}

/** A generation explanation that must stop the plan rather than annotate it. */
const BLOCKING_GENERATION_CODES = new Set([
  'fixed-cohorts-overlap',
  'required-crop-has-no-legal-placement',
]);

function emptyOutcome(
  status: PlannerResult['status'],
  explanations: PlacementExplanation[],
  candidateCount: number,
  elapsedMs: number,
): RaisedBedSolveOutcome {
  return {
    plannerResult: {
      status,
      cohorts: [],
      objective: null,
      explanations,
      diagnostics: { candidateCount, elapsedMs },
    },
    breakdown: null,
    selectedCandidateIds: [],
    candidates: [],
    diagnostics: null,
  };
}

export function solveRaisedBedPlan(
  input: RaisedBedSolverInput,
  options: RaisedBedSolveOptions = {},
): RaisedBedSolveOutcome {
  const startedAt = Date.now();
  const inputProblems = validateRaisedBedSolverInput(input);
  if (inputProblems.length > 0) {
    return emptyOutcome('not-run', inputProblems, 0, Date.now() - startedAt);
  }

  const generation = generateRaisedBedCandidates(input, options.generation);
  const blocking = generation.explanations.filter((entry) => BLOCKING_GENERATION_CODES.has(entry.code));
  if (blocking.length > 0) {
    // A required crop with no legal placement, or already-recorded crops that
    // overlap, are answers in themselves. Neither may be quietly dropped so the
    // search can return a tidy-looking plan built on a different farm.
    return emptyOutcome(
      blocking.some((entry) => entry.code === 'fixed-cohorts-overlap') ? 'not-run' : 'infeasible',
      generation.explanations,
      generation.candidates.length,
      Date.now() - startedAt,
    );
  }
  if (generation.candidates.length === 0) {
    return emptyOutcome('infeasible', [
      {
        code: 'no-legal-placements',
        message: 'No crop in the catalog has a legal, fully dated placement on these beds within this horizon.',
      },
      ...generation.explanations,
    ], 0, Date.now() - startedAt);
  }

  const candidatesById = new Map(generation.candidates.map((candidate) => [candidate.id, candidate]));
  const scorer = createPlanScorer({
    horizonWeeks: input.horizonWeeks,
    candidatesById,
    fixedOccupiedSectionWeeks: new Set(generation.fixedOccupiedSectionWeeks),
    fixedHarvestWeeks: new Set(generation.fixedHarvestWeeks),
    irrigatedSectionIds: new Set(generation.irrigatedSectionIds),
    requestedCropKeys: new Set(input.requestedCropKeys ?? []),
  });

  const exactCandidates: ExactCandidate[] = generation.candidates.map((candidate) => ({
    id: candidate.id,
    cohort: candidate.cohort,
    claims: candidate.claims,
  }));

  const solution = solveSelection({
    candidates: exactCandidates,
    capacities: generation.capacities,
    requirements: generation.requirements,
    score: scorer,
  }, options);

  const selectedCandidates = solution.selectedCandidateIds
    .map((id) => candidatesById.get(id))
    .filter((candidate): candidate is OptimizerCandidate => candidate !== undefined);

  const explanations = [...solution.explanations, ...generation.explanations];
  if (solution.objective === null) {
    return {
      plannerResult: {
        status: solution.status,
        cohorts: [],
        objective: null,
        explanations,
        diagnostics: { candidateCount: generation.candidates.length, elapsedMs: Date.now() - startedAt },
      },
      breakdown: null,
      selectedCandidateIds: [],
      candidates: generation.candidates,
      diagnostics: solution.diagnostics,
    };
  }

  const detail = scorer.detail(selectedCandidates.map((candidate) => ({
    id: candidate.id,
    cohort: candidate.cohort,
    claims: candidate.claims,
  })));

  const breakdown = buildObjectiveBreakdown({
    solution,
    detail,
    selectedCandidates,
    allCandidates: generation.candidates,
    horizonWeeks: input.horizonWeeks,
    requestedCropKeys: input.requestedCropKeys ?? [],
    ...(input.household ? { household: input.household } : {}),
    generationExplanations: generation.explanations,
  });

  return {
    plannerResult: {
      status: solution.status,
      cohorts: solution.cohorts,
      objective: solution.objective,
      explanations,
      diagnostics: {
        candidateCount: generation.candidates.length,
        elapsedMs: Date.now() - startedAt,
      },
    },
    breakdown,
    selectedCandidateIds: solution.selectedCandidateIds,
    candidates: generation.candidates,
    diagnostics: solution.diagnostics,
  };
}

/** The foundation's engine contract, for callers that only want cohorts. */
export function createRaisedBedPlannerEngine(
  options: RaisedBedSolveOptions = {},
): CropPlannerEngine<RaisedBedSolverInput> {
  return {
    id: RAISED_BED_OPTIMIZER_ID,
    suggest(input: RaisedBedSolverInput): PlannerResult {
      return solveRaisedBedPlan(input, options).plannerResult;
    },
  };
}

export {
  cropTimingEvidenceFromCatalog,
  generateRaisedBedCandidates,
  KZN_DARD_TRANSPLANT_READINESS,
  planWeekLabel,
  planWeekStartDate,
} from './candidate-generator';
export { buildObjectiveBreakdown, farmerSummaryLines } from './explain';
export { buildObjectiveVector, createPlanScorer } from './objectives';
export { solveSelection } from './raised-bed-solver';
export {
  provenUnsatisfiableRequirement,
  validateRaisedBedSolverInput,
  validateSelectionProblem,
} from './validate';
export type { ObjectiveBreakdown, RankedTier, ReportedOnlyFigure } from './explain';
export type { PlanScoreContext, PlanScoreDetail, PlanScorer } from './objectives';
export type {
  CandidateGenerationResult,
  HarvestWeekEntry,
  HouseholdNeedPolicy,
  LabourWeekEntry,
  OptimizerCandidate,
  RaisedBedInput,
  RaisedBedSolverInput,
  SelectionDiagnostics,
  SelectionProblem,
  SelectionScore,
  SelectionSolution,
  SelectionSolverOptions,
  WaterClass,
} from './types';
export {
  civilDayNumber,
  nurseryWeekResource,
  rotationCooldownResource,
  sectionWeekKey,
  weekIndexForDate,
} from './types';
