/**
 * Input checking for the optimiser.
 *
 * Two jobs, kept apart on purpose:
 *  - `validateSelectionProblem` guards the abstract selection problem the beam
 *    search solves. Its rules mirror the exact oracle's, because a fixture the
 *    oracle refuses must not become a confident plan here.
 *  - `validateRaisedBedSolverInput` guards the farm-shaped input before any
 *    candidate exists, so a bad layout is reported as a layout problem rather
 *    than surfacing later as a mysteriously empty plan.
 */

import type { PlacementExplanation } from '@/lib/crop-plan-v2';
import { isCalendarDate } from '@/lib/crop-plan-v2';
import { normaliseBedSections, buildBedSections } from '@/lib/crop-bed-sections';
import { cropByKey } from '@/lib/crop-catalog';
import type { RaisedBedSolverInput, SelectionProblem } from './types';

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

/**
 * Returns a human-readable reason, or null when the problem is well formed.
 *
 * These rules are deliberately the same set the exact oracle enforces. They
 * are re-stated rather than imported because the oracle does not export its
 * validator, and reaching into it would mean editing the ground truth to suit
 * the thing being tested. `tests/crop-optimizer-solver.test.ts` asserts the two
 * agree on accept/reject for every malformed fixture it knows about.
 */
export function validateSelectionProblem(problem: unknown): string | null {
  if (!isRecord(problem)
    || !Array.isArray(problem.candidates)
    || !Array.isArray(problem.capacities)
    || typeof problem.score !== 'function'
    || (problem.requirements !== undefined && !Array.isArray(problem.requirements))) {
    return 'The solver needs candidates, capacities and a score function.';
  }
  const capacityIds = new Set<string>();
  for (const capacity of problem.capacities) {
    if (!isRecord(capacity)
      || !isNonEmptyString(capacity.resource)
      || !isNonNegativeInteger(capacity.capacity)
      || (capacity.fixedUse !== undefined && !isNonNegativeInteger(capacity.fixedUse))
      || (capacity.fixedUse ?? 0) > capacity.capacity
      || capacityIds.has(capacity.resource)) {
      return 'The solver received an invalid resource capacity.';
    }
    capacityIds.add(capacity.resource);
  }
  const candidateIds = new Set<string>();
  for (const candidate of problem.candidates) {
    if (!isRecord(candidate)
      || !isNonEmptyString(candidate.id)
      || !isRecord(candidate.cohort)
      || !Array.isArray(candidate.claims)
      || candidate.claims.length === 0
      || candidateIds.has(candidate.id)) {
      return 'The solver received an invalid candidate.';
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
  for (const requirement of problem.requirements ?? []) {
    if (!isRecord(requirement)
      || !isNonEmptyString(requirement.id)
      || !Array.isArray(requirement.candidateIds)
      || requirement.candidateIds.length === 0
      || !isPositiveInteger(requirement.minSelected)
      || requirement.minSelected > requirement.candidateIds.length
      || requirementIds.has(requirement.id)
      || new Set(requirement.candidateIds).size !== requirement.candidateIds.length
      || requirement.candidateIds.some((id: unknown) => !isNonEmptyString(id) || !candidateIds.has(id))) {
      return 'The solver received an invalid placement requirement.';
    }
    requirementIds.add(requirement.id);
  }
  return null;
}

/**
 * A proof, not a guess. A requirement is impossible when fewer than
 * `minSelected` of its candidates could be placed even with the whole rest of
 * the plan empty. That is the only infeasibility a search is entitled to call
 * proven; anything else it fails to find is reported as not found.
 */
export function provenUnsatisfiableRequirement(problem: SelectionProblem): string | null {
  const capacities = new Map(problem.capacities.map((capacity) => [capacity.resource, capacity]));
  const candidates = new Map(problem.candidates.map((candidate) => [candidate.id, candidate]));
  for (const requirement of problem.requirements ?? []) {
    const placeable = requirement.candidateIds.filter((candidateId) => {
      const candidate = candidates.get(candidateId);
      if (!candidate) return false;
      return candidate.claims.every((claim) => {
        const capacity = capacities.get(claim.resource);
        if (!capacity) return false;
        return (capacity.fixedUse ?? 0) + claim.units <= capacity.capacity;
      });
    });
    if (placeable.length < requirement.minSelected) {
      return requirement.id;
    }
  }
  return null;
}

/**
 * Farm-shaped checks. Returns blocking problems; an empty array means the
 * generator may run. Advisory notes (an unpriced crop, a bed with no recorded
 * area) belong in generation explanations, not here.
 */
export function validateRaisedBedSolverInput(input: RaisedBedSolverInput): PlacementExplanation[] {
  const problems: PlacementExplanation[] = [];
  if (!isNonEmptyString(input?.siteKey)) {
    problems.push({
      code: 'site-required',
      message: 'A V2 plan is site-scoped: physical sections cannot be placed without a site key.',
    });
  }
  if (!isCalendarDate(input?.anchorDate)) {
    problems.push({
      code: 'anchor-date-invalid',
      message: 'The plan needs a valid anchor date before week 0 means anything.',
    });
  }
  if (!isPositiveInteger(input?.horizonWeeks)) {
    problems.push({
      code: 'horizon-invalid',
      message: 'The planning horizon must be a whole number of weeks greater than zero.',
    });
  }
  if (!Array.isArray(input?.beds) || input.beds.length === 0) {
    problems.push({
      code: 'no-raised-beds',
      message: 'This solver plans raised beds; none were supplied.',
    });
    return problems;
  }

  const sections = input.beds.flatMap((bed) => buildBedSections({
    bedId: bed?.bedId,
    layoutRevision: bed?.layoutRevision,
    division: bed?.division,
  }) ?? []);
  const built = normaliseBedSections(sections);
  if (!built || sections.length === 0) {
    problems.push({
      code: 'bed-layout-invalid',
      message: 'Every bed needs a stable id, one layout revision and a whole, half, third or quarter split.',
    });
  }
  const seenBeds = new Set<string>();
  for (const bed of input.beds) {
    if (seenBeds.has(bed?.bedId)) {
      problems.push({
        code: 'bed-repeated',
        message: `Bed "${bed.bedId}" appears twice; one bed has exactly one layout in a plan.`,
      });
    }
    seenBeds.add(bed?.bedId);
    if (bed?.areaSqm !== undefined && !(Number.isFinite(bed.areaSqm) && bed.areaSqm > 0)) {
      problems.push({
        code: 'bed-area-invalid',
        message: `Bed "${bed.bedId}" has a recorded area that is not a positive number of square metres.`,
      });
    }
  }

  for (const cropKey of input.requiredCropKeys ?? []) {
    if (!cropByKey(cropKey)) {
      problems.push({
        code: 'required-crop-unknown',
        message: `"${cropKey}" is required by this plan but is not in the crop catalog.`,
      });
    }
  }

  if (input.rotationCooldownWeeks !== undefined && !isNonNegativeInteger(input.rotationCooldownWeeks)) {
    problems.push({
      code: 'rotation-cooldown-invalid',
      message: 'The botanical-family cooldown must be a whole number of weeks (0 is the farmer override).',
    });
  }

  if (input.nursery && !isPositiveInteger(input.nursery.concurrentCohorts)) {
    problems.push({
      code: 'nursery-capacity-invalid',
      message: 'Nursery capacity must be a whole number of cohorts, or left out entirely when it is unknown.',
    });
  }

  if (input.household?.kgPerPersonPerWeek !== undefined
    && !(Number.isFinite(input.household.kgPerPersonPerWeek) && input.household.kgPerPersonPerWeek > 0)) {
    problems.push({
      code: 'household-need-invalid',
      message: 'A household kg-per-person-per-week target must be a positive sourced figure, or left unset.',
    });
  }

  return problems;
}
