import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_EXACT_ORACLE_CANDIDATES,
  solveExactCropPlanFixture,
  type ExactCandidate,
  type ExactOracleInput,
} from '@/lib/crop-plan-v2-oracle';
import { compareObjectiveVectors, type ObjectiveVector } from '@/lib/crop-plan-v2';
import { buildBedSections } from '@/lib/crop-bed-sections';

function candidate(id: string, resources: string[]): ExactCandidate {
  const sections = buildBedSections({ bedId: 'bed-1', layoutRevision: 'layout-1', division: 1 })!;
  return {
    id,
    cohort: {
      id: `cohort-${id}`,
      cropKey: id,
      location: { bedId: 'bed-1', sectionIds: [sections[0].id], layoutRevision: 'layout-1' },
      sowing: { method: 'direct-sow', startsOn: { year: 2026, month: 8, day: 1 }, precision: 'exact-day' },
      state: 'proposed',
    },
    claims: resources.map((resource) => ({ resource, units: 1 })),
  };
}

function baseInput(candidates: ExactCandidate[]): ExactOracleInput {
  const resources = [...new Set(candidates.flatMap((entry) => entry.claims.map((claim) => claim.resource)))];
  return {
    candidates,
    capacities: resources.map((resource) => ({ resource, capacity: 1 })),
    score(selected) {
      return {
        selectedCropPlacements: selected.length,
        longestFreshFoodGapWeeks: 4,
        idleSectionWeeks: 0,
        cropDiversity: selected.length,
        operationalTransitions: selected.length,
      };
    },
  };
}

test('the tiny oracle rejects overlapping section-week claims even when two candidates look attractive', () => {
  const a = candidate('a', ['section:bed-1:week-34']);
  const b = candidate('b', ['section:bed-1:week-34']);
  const c = candidate('c', ['section:bed-2:week-34']);
  const result = solveExactCropPlanFixture(baseInput([b, c, a]));

  assert.equal(result.status, 'optimal');
  assert.equal(result.selectedCandidateIds.includes('a') && result.selectedCandidateIds.includes('b'), false);
  assert.deepEqual(result.selectedCandidateIds, ['a', 'c']);
});

test('the tiny oracle enumerates past a greedy early crop when more requested placements fit later', () => {
  const greedy = candidate('greedy', ['section:bed-1:week-34', 'section:bed-1:week-35']);
  const laterOne = candidate('later-1', ['section:bed-1:week-34']);
  const laterTwo = candidate('later-2', ['section:bed-1:week-35']);
  const input = baseInput([greedy, laterOne, laterTwo]);
  input.score = (selected) => ({
    selectedCropPlacements: selected.length,
    // The greedy crop looks better at the next tier, but it must lose because
    // placement coverage is a prior lexicographic objective.
    longestFreshFoodGapWeeks: selected.some((entry) => entry.id === 'greedy') ? 0 : 99,
    idleSectionWeeks: 0,
    cropDiversity: selected.length,
    operationalTransitions: selected.length,
  });

  const result = solveExactCropPlanFixture(input);
  assert.deepEqual(result.selectedCandidateIds, ['later-1', 'later-2']);
});

test('the exact oracle has a stable final tie-break regardless of input order', () => {
  const a = candidate('a', ['section:bed-1:week-34']);
  const b = candidate('b', ['section:bed-1:week-34']);
  const first = solveExactCropPlanFixture(baseInput([b, a]));
  const second = solveExactCropPlanFixture(baseInput([a, b]));

  assert.deepEqual(first.selectedCandidateIds, ['a']);
  assert.deepEqual(second.selectedCandidateIds, first.selectedCandidateIds);
  assert.equal(second.objective?.deterministicTieBreak, first.objective?.deterministicTieBreak);
});

test('fixed accepted use and a selected-crop requirement can make a tiny fixture honestly infeasible', () => {
  const blocked = candidate('blocked', ['section:bed-1:week-34']);
  const input = baseInput([blocked]);
  input.capacities[0].fixedUse = 1;
  input.requirements = [{ id: 'place-blocked', candidateIds: ['blocked'], minSelected: 1 }];

  const result = solveExactCropPlanFixture(input);
  assert.equal(result.status, 'infeasible');
  assert.equal(result.objective, null);
});

test('the oracle never mutates nested candidate input while it explores every subset', () => {
  const input = baseInput([candidate('a', ['section:bed-1:week-34']), candidate('b', ['section:bed-2:week-34'])]);
  const before = structuredClone(input.candidates);

  solveExactCropPlanFixture(input);
  assert.deepEqual(input.candidates, before);
});

test('the exact oracle refuses over-limit fixtures instead of silently dropping candidates', () => {
  const candidates = Array.from(
    { length: MAX_EXACT_ORACLE_CANDIDATES + 1 },
    (_, index) => candidate(`candidate-${index}`, [`section:bed-${index}:week-34`]),
  );
  const result = solveExactCropPlanFixture(baseInput(candidates));

  assert.equal(result.status, 'not-run');
  assert.equal(result.objective, null);
  assert.equal(result.diagnostics.candidateCount, MAX_EXACT_ORACLE_CANDIDATES + 1);
  assert.equal(result.diagnostics.reason, 'candidate-limit-exceeded');
  assert.equal(result.explanations[0]?.code, 'candidate-limit-exceeded');
});

test('invalid duplicate ids and undeclared claims do not become a partial best plan', () => {
  const duplicate = candidate('same', ['section:bed-1:week-34']);
  const badInput = baseInput([duplicate, { ...duplicate, cohort: { ...duplicate.cohort } }]);
  const duplicateResult = solveExactCropPlanFixture(badInput);
  assert.equal(duplicateResult.status, 'not-run');
  assert.equal(duplicateResult.diagnostics.reason, 'invalid-input');

  const undeclared = candidate('unknown-resource', ['section:bed-1:week-34']);
  const undeclaredInput = baseInput([undeclared]);
  undeclaredInput.capacities = [];
  const undeclaredResult = solveExactCropPlanFixture(undeclaredInput);
  assert.equal(undeclaredResult.status, 'not-run');

  const malformedRequirements = baseInput([candidate('valid', ['section:bed-1:week-34'])]);
  (malformedRequirements as { requirements: unknown }).requirements = { not: 'an array' };
  assert.equal(solveExactCropPlanFixture(malformedRequirements).diagnostics.reason, 'invalid-input');

  const uncloneable = baseInput([candidate('uncloneable', ['section:bed-1:week-34'])]);
  (uncloneable.candidates[0].cohort as unknown as { unsafe: () => void }).unsafe = () => undefined;
  assert.equal(solveExactCropPlanFixture(uncloneable).diagnostics.reason, 'invalid-input');
});

test('a score callback cannot smuggle a hard violation or its own tie-break into an exact result', () => {
  const input = baseInput([candidate('a', ['section:bed-1:week-34'])]);
  input.score = () => ({
    selectedCropPlacements: 1,
    longestFreshFoodGapWeeks: 0,
    idleSectionWeeks: 0,
    cropDiversity: 1,
    operationalTransitions: 1,
    hardViolations: 99,
    deterministicTieBreak: 'not-allowed',
  } as unknown as ReturnType<ExactOracleInput['score']>);

  const result = solveExactCropPlanFixture(input);
  assert.equal(result.objective?.hardViolations, 0);
  assert.equal(result.objective?.deterministicTieBreak, '["a"]');
});

test('objective comparison uses every lexicographic tier before the final stable key', () => {
  const base: ObjectiveVector = {
    hardViolations: 0,
    selectedCropPlacements: 2,
    longestFreshFoodGapWeeks: 4,
    idleSectionWeeks: 3,
    cropDiversity: 2,
    operationalTransitions: 2,
    deterministicTieBreak: '["b"]',
  };
  assert.ok(compareObjectiveVectors({ ...base, hardViolations: 1 }, base) > 0);
  assert.ok(compareObjectiveVectors({ ...base, selectedCropPlacements: 3 }, base) < 0);
  assert.ok(compareObjectiveVectors({ ...base, longestFreshFoodGapWeeks: 3 }, base) < 0);
  assert.ok(compareObjectiveVectors({ ...base, idleSectionWeeks: 2 }, base) < 0);
  assert.ok(compareObjectiveVectors({ ...base, cropDiversity: 3 }, base) < 0);
  assert.ok(compareObjectiveVectors({ ...base, operationalTransitions: 1 }, base) < 0);
  assert.ok(compareObjectiveVectors({ ...base, deterministicTieBreak: '["a"]' }, base) < 0);
});
