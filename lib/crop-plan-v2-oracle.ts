import {
  compareObjectiveVectors,
  type ObjectiveVector,
  type PlacementExplanation,
  type PlannedCohort,
} from './crop-plan-v2';

/**
 * This oracle proves tiny fixtures only. Full farms need a bounded planner;
 * silently truncating here would teach that planner the wrong definition of
 * “optimal”. Eighteen candidates means at most 262,144 subsets.
 */
export const MAX_EXACT_ORACLE_CANDIDATES = 18;

export interface ExactResourceClaim {
  resource: string;
  units: number;
}

export interface ExactResourceCapacity {
  resource: string;
  capacity: number;
  /** Accepted or observed cohorts already using this resource. */
  fixedUse?: number;
}

export interface ExactCandidate {
  /** Stable semantic placement id; never array position. */
  id: string;
  cohort: PlannedCohort;
  claims: readonly ExactResourceClaim[];
}

export interface ExactRequirement {
  id: string;
  candidateIds: readonly string[];
  minSelected: number;
}

export type ExactScore = Omit<ObjectiveVector, 'hardViolations' | 'deterministicTieBreak'>;

export interface ExactOracleInput {
  candidates: readonly ExactCandidate[];
  capacities: readonly ExactResourceCapacity[];
  requirements?: readonly ExactRequirement[];
  /** Receives canonical candidate order, never the caller's input order. */
  score(selected: readonly ExactCandidate[]): ExactScore;
}

export interface ExactOracleDiagnostics {
  candidateCount: number;
  candidatesExamined: number;
  feasibleSolutions: number;
  reason?: 'candidate-limit-exceeded' | 'invalid-input';
}

export interface ExactOracleResult {
  status: 'optimal' | 'infeasible' | 'not-run';
  selectedCandidateIds: string[];
  cohorts: PlannedCohort[];
  objective: ObjectiveVector | null;
  explanations: PlacementExplanation[];
  diagnostics: ExactOracleDiagnostics;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function cloneCandidate(candidate: ExactCandidate): ExactCandidate {
  return {
    id: candidate.id,
    cohort: structuredClone(candidate.cohort),
    claims: candidate.claims.map((claim) => ({ ...claim })),
  };
}

function isExactScore(value: unknown): value is ExactScore {
  if (!isRecord(value)) return false;
  return typeof value.selectedCropPlacements === 'number' && Number.isFinite(value.selectedCropPlacements)
    && typeof value.longestFreshFoodGapWeeks === 'number' && Number.isFinite(value.longestFreshFoodGapWeeks)
    && typeof value.idleSectionWeeks === 'number' && Number.isFinite(value.idleSectionWeeks)
    && typeof value.cropDiversity === 'number' && Number.isFinite(value.cropDiversity)
    && typeof value.operationalTransitions === 'number' && Number.isFinite(value.operationalTransitions);
}

function notRun(
  candidateCount: number,
  reason: ExactOracleDiagnostics['reason'],
  message: string,
): ExactOracleResult {
  return {
    status: 'not-run',
    selectedCandidateIds: [],
    cohorts: [],
    objective: null,
    explanations: [{ code: reason ?? 'invalid-input', message }],
    diagnostics: { candidateCount, candidatesExamined: 0, feasibleSolutions: 0, reason },
  };
}

function validateInput(input: unknown): string | null {
  if (!isRecord(input)
    || !Array.isArray(input.candidates)
    || !Array.isArray(input.capacities)
    || typeof input.score !== 'function'
    || (input.requirements !== undefined && !Array.isArray(input.requirements))) {
    return 'The exact oracle needs candidates, capacities and a score function.';
  }
  const candidates = input.candidates;
  const capacities = input.capacities;
  const requirements = input.requirements ?? [];
  const capacityIds = new Set<string>();
  for (const capacity of capacities) {
    if (!isRecord(capacity)
      || !isNonEmptyString(capacity.resource)
      || !isNonNegativeInteger(capacity.capacity)
      || (capacity.fixedUse !== undefined && !isNonNegativeInteger(capacity.fixedUse))
      || (capacity.fixedUse ?? 0) > capacity.capacity
      || capacityIds.has(capacity.resource)) {
      return 'The exact oracle received an invalid resource capacity.';
    }
    capacityIds.add(capacity.resource);
  }
  const candidateIds = new Set<string>();
  for (const candidate of candidates) {
    if (!isRecord(candidate)
      || !isNonEmptyString(candidate.id)
      || !isRecord(candidate.cohort)
      || !Array.isArray(candidate.claims)
      || candidate.claims.length === 0
      || candidateIds.has(candidate.id)) {
      return 'The exact oracle received an invalid candidate.';
    }
    candidateIds.add(candidate.id);
    const claimResources = new Set<string>();
    for (const claim of candidate.claims) {
      if (!isRecord(claim)
        || !isNonEmptyString(claim.resource)
        || !isPositiveInteger(claim.units)
        || !capacityIds.has(claim.resource)
        || claimResources.has(claim.resource)) {
        return 'A candidate claims an invalid or undeclared resource.';
      }
      claimResources.add(claim.resource);
    }
  }
  const requirementIds = new Set<string>();
  for (const requirement of requirements) {
    if (!isRecord(requirement)
      || !isNonEmptyString(requirement.id)
      || !Array.isArray(requirement.candidateIds)
      || requirement.candidateIds.length === 0
      || !isPositiveInteger(requirement.minSelected)
      || requirement.minSelected > requirement.candidateIds.length
      || requirementIds.has(requirement.id)
      || new Set(requirement.candidateIds).size !== requirement.candidateIds.length
      || requirement.candidateIds.some((id) => !candidateIds.has(id))) {
      return 'The exact oracle received an invalid placement requirement.';
    }
    requirementIds.add(requirement.id);
  }
  return null;
}

function compareCandidateIds(a: ExactCandidate, b: ExactCandidate): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function selectionFitsCapacity(
  selected: readonly ExactCandidate[],
  capacities: ReadonlyMap<string, ExactResourceCapacity>,
): boolean {
  const use = new Map<string, number>();
  for (const [resource, capacity] of capacities) use.set(resource, capacity.fixedUse ?? 0);
  for (const candidate of selected) {
    for (const claim of candidate.claims) {
      const capacity = capacities.get(claim.resource);
      if (!capacity) return false;
      const next = (use.get(claim.resource) ?? 0) + claim.units;
      if (next > capacity.capacity) return false;
      use.set(claim.resource, next);
    }
  }
  return true;
}

function selectionMeetsRequirements(
  selected: readonly ExactCandidate[],
  requirements: readonly ExactRequirement[],
): boolean {
  const selectedIds = new Set(selected.map((candidate) => candidate.id));
  return requirements.every((requirement) => (
    requirement.candidateIds.filter((candidateId) => selectedIds.has(candidateId)).length >= requirement.minSelected
  ));
}

function objectiveFor(
  input: ExactOracleInput,
  selected: readonly ExactCandidate[],
): ObjectiveVector | null {
  try {
    // The scorer sees copies so an accidental mutation cannot change the caller's plan candidates.
    const score = input.score(selected.map(cloneCandidate));
    if (!isExactScore(score)) return null;
    return {
      hardViolations: 0,
      selectedCropPlacements: score.selectedCropPlacements,
      longestFreshFoodGapWeeks: score.longestFreshFoodGapWeeks,
      idleSectionWeeks: score.idleSectionWeeks,
      cropDiversity: score.cropDiversity,
      operationalTransitions: score.operationalTransitions,
      deterministicTieBreak: JSON.stringify(selected.map((candidate) => candidate.id)),
    };
  } catch {
    return null;
  }
}

/**
 * Enumerates all legal subsets for a deliberately tiny fixture. It is a test
 * oracle and benchmark baseline, not a production farm-planning algorithm.
 */
export function solveExactCropPlanFixture(input: ExactOracleInput): ExactOracleResult {
  const candidateCount = Array.isArray(input?.candidates) ? input.candidates.length : 0;
  if (candidateCount > MAX_EXACT_ORACLE_CANDIDATES) {
    return notRun(
      candidateCount,
      'candidate-limit-exceeded',
      `Exact checking stops at ${MAX_EXACT_ORACLE_CANDIDATES} candidates; this fixture has ${candidateCount}.`,
    );
  }
  const invalidReason = validateInput(input);
  if (invalidReason) return notRun(candidateCount, 'invalid-input', invalidReason);

  let candidates: ExactCandidate[];
  try {
    candidates = input.candidates.map(cloneCandidate).sort(compareCandidateIds);
  } catch {
    return notRun(candidateCount, 'invalid-input', 'The exact oracle received a cohort that cannot be safely copied.');
  }
  const capacities = new Map(input.capacities.map((capacity) => [capacity.resource, { ...capacity }]));
  const requirements = (input.requirements ?? []).map((requirement) => ({
    ...requirement,
    candidateIds: [...requirement.candidateIds],
  }));
  const subsets = 2 ** candidates.length;
  let candidatesExamined = 0;
  let feasibleSolutions = 0;
  let best: { selected: ExactCandidate[]; objective: ObjectiveVector } | null = null;

  for (let mask = 0; mask < subsets; mask++) {
    candidatesExamined++;
    const selected = candidates.filter((_, index) => (mask & (2 ** index)) !== 0);
    if (!selectionFitsCapacity(selected, capacities) || !selectionMeetsRequirements(selected, requirements)) continue;
    const objective = objectiveFor(input, selected);
    if (!objective) {
      return notRun(candidateCount, 'invalid-input', 'The exact oracle score must contain finite objective values.');
    }
    feasibleSolutions++;
    if (!best || compareObjectiveVectors(objective, best.objective) < 0) {
      best = { selected, objective };
    }
  }

  if (!best) {
    return {
      status: 'infeasible',
      selectedCandidateIds: [],
      cohorts: [],
      objective: null,
      explanations: [{ code: 'infeasible', message: 'No candidate set meets every hard capacity and placement requirement.' }],
      diagnostics: { candidateCount, candidatesExamined, feasibleSolutions },
    };
  }
  return {
    status: 'optimal',
    selectedCandidateIds: best.selected.map((candidate) => candidate.id),
    cohorts: best.selected.map((candidate) => structuredClone(candidate.cohort)),
    objective: best.objective,
    explanations: [],
    diagnostics: { candidateCount, candidatesExamined, feasibleSolutions },
  };
}
