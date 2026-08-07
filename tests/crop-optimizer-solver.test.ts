import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPlanScorer,
  generateRaisedBedCandidates,
  solveSelection,
  validateSelectionProblem,
  type RaisedBedSolverInput,
  type SelectionProblem,
} from '@/lib/crop-optimizer';
import { solveExactCropPlanFixture, type ExactCandidate } from '@/lib/crop-plan-v2-oracle';
import { buildBedSections } from '@/lib/crop-bed-sections';
import type { PlannedCohort } from '@/lib/crop-plan-v2';

/**
 * The rebuild spec's §9.2: for a tiny fixture, enumerate every feasible plan
 * and assert the solver matches the true best lexicographic result.
 *
 * The exact oracle (lib/crop-plan-v2-oracle.ts) already does the enumerating.
 * These tests hand the SAME `SelectionProblem` — same candidates, same
 * capacities, same requirements, same score function — to both, so any
 * disagreement is a difference in the SEARCH and nowhere else. When they
 * disagree the oracle is right; nothing here is ever adjusted to suit the
 * solver.
 */

function problemFor(input: RaisedBedSolverInput): {
  problem: SelectionProblem;
  candidateCount: number;
} {
  const generation = generateRaisedBedCandidates(input);
  const candidatesById = new Map(generation.candidates.map((candidate) => [candidate.id, candidate]));
  const score = createPlanScorer({
    horizonWeeks: input.horizonWeeks,
    candidatesById,
    fixedOccupiedSectionWeeks: new Set(generation.fixedOccupiedSectionWeeks),
    fixedHarvestWeeks: new Set(generation.fixedHarvestWeeks),
    irrigatedSectionIds: new Set(generation.irrigatedSectionIds),
    requestedCropKeys: new Set(input.requestedCropKeys ?? []),
  });
  return {
    candidateCount: generation.candidates.length,
    problem: {
      candidates: generation.candidates.map((candidate) => ({
        id: candidate.id,
        cohort: candidate.cohort,
        claims: candidate.claims,
      })),
      capacities: generation.capacities,
      requirements: generation.requirements,
      score,
    },
  };
}

function tinyFarm(overrides: Partial<RaisedBedSolverInput> = {}): RaisedBedSolverInput {
  return {
    siteKey: 'site-tiny',
    anchorDate: { year: 2026, month: 8, day: 1 },
    horizonWeeks: 18,
    rainPattern: 'mild-frost',
    beds: [{
      bedId: 'bed-1',
      layoutRevision: 'rev-1',
      division: 2,
      areaSqm: 10,
      irrigationConfirmed: true,
    }],
    requestedCropKeys: ['beetroot', 'green-beans'],
    ...overrides,
  };
}

function assertMatchesOracle(label: string, problem: SelectionProblem): void {
  const oracle = solveExactCropPlanFixture(problem);
  const solver = solveSelection(problem);

  assert.equal(oracle.status, 'optimal', `${label}: the oracle must actually have run`);
  assert.equal(solver.status, 'best-found', `${label}: the solver never claims a proven optimum`);
  assert.deepEqual(
    solver.selectedCandidateIds,
    oracle.selectedCandidateIds,
    `${label}: the solver chose a different plan from the proven best one`,
  );
  assert.deepEqual(solver.objective, oracle.objective, `${label}: objective vectors differ`);
  assert.deepEqual(solver.cohorts, oracle.cohorts, `${label}: cohorts differ`);
}

test('the solver matches the exact oracle on a two-section, two-crop fixture', () => {
  const { problem, candidateCount } = problemFor(tinyFarm());
  assert.ok(candidateCount > 0 && candidateCount <= 18, `fixture must stay inside the oracle's limit (was ${candidateCount})`);
  assertMatchesOracle('two crops', problem);
});

test('the solver matches the exact oracle on a two-section, three-crop fixture at the oracle limit', () => {
  // 18 candidates is the exact oracle's declared ceiling: 262,144 subsets, all
  // of them enumerated. This is the largest fixture the ground truth can cover.
  const { problem, candidateCount } = problemFor(tinyFarm({
    horizonWeeks: 20,
    requestedCropKeys: ['beetroot', 'green-beans', 'swiss-chard'],
  }));
  assert.equal(candidateCount, 18);
  assertMatchesOracle('three crops', problem);
});

test('the solver matches the exact oracle when a same-family repeat is the only successor', () => {
  // Coriander is the only crop that finishes inside fourteen weeks here, so
  // the second slot on a section can only be another apiaceae — which hard
  // constraint 6 blocks. The oracle proves the resulting plan is the best one.
  const { problem, candidateCount } = problemFor(tinyFarm({
    horizonWeeks: 14,
    requestedCropKeys: ['coriander', 'beetroot', 'green-beans'],
  }));
  assert.equal(candidateCount, 14);
  assertMatchesOracle('rotation-limited', problem);

  const oracle = solveExactCropPlanFixture(problem);
  assert.equal(oracle.cohorts.length, 2, 'one cohort per section: the family cooldown blocks an immediate repeat');
  assert.deepEqual(
    [...new Set(oracle.cohorts.map((cohort) => cohort.cropKey))],
    ['coriander'],
  );
});

test('the farmer override releases the family cooldown, and the oracle still agrees', () => {
  // One undivided bed and sixteen weeks: coriander holds the ground for eight
  // weeks, so a second coriander starting at week 8 fits the horizon exactly.
  // The only thing that can stop it is the botanical-family cooldown.
  const oneWholeBed = tinyFarm({
    horizonWeeks: 16,
    requestedCropKeys: ['coriander'],
    beds: [{ bedId: 'bed-1', layoutRevision: 'rev-1', division: 1, areaSqm: 10, irrigationConfirmed: true }],
  });
  const { problem: blocked } = problemFor(oneWholeBed);
  const { problem: overridden, candidateCount } = problemFor({ ...oneWholeBed, rotationCooldownWeeks: 0 });
  assert.ok(candidateCount <= 18);

  const blockedPlan = solveExactCropPlanFixture(blocked);
  const overriddenPlan = solveExactCropPlanFixture(overridden);
  assert.ok(
    overriddenPlan.cohorts.length > blockedPlan.cohorts.length,
    'with the cooldown overridden, back-to-back coriander becomes legal and more can be planted',
  );
  assertMatchesOracle('cooldown overridden', overridden);
});

// ---------------------------------------------------------------------------
// The backtracking itself
// ---------------------------------------------------------------------------

function syntheticCandidate(id: string, resources: string[]): ExactCandidate {
  const sections = buildBedSections({ bedId: 'bed-1', layoutRevision: 'layout-1', division: 1 })!;
  const cohort: PlannedCohort = {
    id: `cohort-${id}`,
    cropKey: id,
    location: { bedId: 'bed-1', sectionIds: [sections[0].id], layoutRevision: 'layout-1' },
    sowing: { method: 'direct-sow', startsOn: { year: 2026, month: 8, day: 1 }, precision: 'exact-day' },
    state: 'proposed',
  };
  return { id, cohort, claims: resources.map((resource) => ({ resource, units: 1 })) };
}

function syntheticProblem(candidates: ExactCandidate[]): SelectionProblem {
  const resources = [...new Set(candidates.flatMap((entry) => entry.claims.map((claim) => claim.resource)))];
  return {
    candidates,
    capacities: resources.map((resource) => ({ resource, capacity: 1 })),
    score(selected) {
      return {
        selectedCropPlacements: selected.length,
        longestFreshFoodGapWeeks: selected.some((entry) => entry.id === 'greedy') ? 0 : 99,
        idleSectionWeeks: 0,
        cropDiversity: selected.length,
        operationalTransitions: selected.length,
      };
    },
  };
}

test('local swaps un-place a greedy first choice when two later crops fit instead', () => {
  // The exact case the rebuild spec says a transitional search must survive:
  // one crop that looks better on a LATER tier is taken first and blocks two
  // that win on an EARLIER one. beamWidth 1 makes the beam a pure greedy pass,
  // so only the drop-one-add-two swap can recover the right answer.
  const problem = syntheticProblem([
    syntheticCandidate('greedy', ['section:bed-1:week-34', 'section:bed-1:week-35']),
    syntheticCandidate('later-1', ['section:bed-1:week-34']),
    syntheticCandidate('later-2', ['section:bed-1:week-35']),
  ]);

  const greedyOnly = solveSelection(problem, { beamWidth: 1, improvementRounds: 0 });
  assert.deepEqual(greedyOnly.selectedCandidateIds, ['greedy'], 'without swaps the greedy pass keeps the wrong crop');

  const recovered = solveSelection(problem, { beamWidth: 1 });
  assert.deepEqual(recovered.selectedCandidateIds, ['later-1', 'later-2']);
  assert.ok(recovered.diagnostics.improvementMoves > 0, 'the recovery must come from a swap, not from luck');
  assert.deepEqual(recovered.selectedCandidateIds, solveExactCropPlanFixture(problem).selectedCandidateIds);
});

test('the solver is stable under input order and never reports a proven optimum', () => {
  const a = syntheticCandidate('a', ['section:bed-1:week-34']);
  const b = syntheticCandidate('b', ['section:bed-1:week-34']);
  const first = solveSelection(syntheticProblem([b, a]));
  const second = solveSelection(syntheticProblem([a, b]));

  assert.deepEqual(first.selectedCandidateIds, ['a']);
  assert.deepEqual(second.selectedCandidateIds, first.selectedCandidateIds);
  assert.equal(second.objective?.deterministicTieBreak, first.objective?.deterministicTieBreak);
  assert.equal(first.status, 'best-found');
  assert.notEqual(first.status as string, 'optimal');
});

test('the solver does not mutate the candidates it is given', () => {
  const problem = syntheticProblem([
    syntheticCandidate('a', ['section:bed-1:week-34']),
    syntheticCandidate('b', ['section:bed-2:week-34']),
  ]);
  const before = structuredClone(problem.candidates);
  solveSelection(problem);
  assert.deepEqual(problem.candidates, before);
});

test('an unmeetable requirement is reported as proven impossible, exactly as the oracle finds it', () => {
  const problem = syntheticProblem([syntheticCandidate('blocked', ['section:bed-1:week-34'])]);
  problem.capacities[0].fixedUse = 1;
  problem.requirements = [{ id: 'place-blocked', candidateIds: ['blocked'], minSelected: 1 }];

  const oracle = solveExactCropPlanFixture(problem);
  const solver = solveSelection(problem);
  assert.equal(oracle.status, 'infeasible');
  assert.equal(solver.status, 'infeasible');
  assert.equal(solver.objective, null);
  assert.equal(solver.explanations[0]?.code, 'requirement-cannot-be-met');
});

test('a satisfiable requirement forces a worse-scoring plan, and the oracle confirms the choice', () => {
  const problem = syntheticProblem([
    syntheticCandidate('greedy', ['section:bed-1:week-34', 'section:bed-1:week-35']),
    syntheticCandidate('later-1', ['section:bed-1:week-34']),
    syntheticCandidate('later-2', ['section:bed-1:week-35']),
  ]);
  problem.requirements = [{ id: 'must-have-greedy', candidateIds: ['greedy'], minSelected: 1 }];

  const solver = solveSelection(problem);
  assert.deepEqual(solver.selectedCandidateIds, ['greedy']);
  assert.deepEqual(solver.selectedCandidateIds, solveExactCropPlanFixture(problem).selectedCandidateIds);
});

test('malformed problems are refused by the solver on the same terms as the oracle', () => {
  const duplicate = syntheticCandidate('same', ['section:bed-1:week-34']);
  const duplicated = syntheticProblem([duplicate, { ...duplicate, cohort: { ...duplicate.cohort } }]);
  assert.ok(validateSelectionProblem(duplicated));
  assert.equal(solveSelection(duplicated).status, 'not-run');
  assert.equal(solveExactCropPlanFixture(duplicated).status, 'not-run');

  const undeclared = syntheticProblem([syntheticCandidate('unknown-resource', ['section:bed-1:week-34'])]);
  undeclared.capacities = [];
  assert.equal(solveSelection(undeclared).status, 'not-run');
  assert.equal(solveExactCropPlanFixture(undeclared).status, 'not-run');

  const badRequirements = syntheticProblem([syntheticCandidate('valid', ['section:bed-1:week-34'])]);
  (badRequirements as { requirements: unknown }).requirements = { not: 'an array' };
  assert.equal(solveSelection(badRequirements).status, 'not-run');
  assert.equal(solveExactCropPlanFixture(badRequirements).status, 'not-run');

  const uncloneable = syntheticProblem([syntheticCandidate('uncloneable', ['section:bed-1:week-34'])]);
  (uncloneable.candidates[0].cohort as unknown as { unsafe: () => void }).unsafe = () => undefined;
  assert.equal(solveSelection(uncloneable).status, 'not-run');
  assert.equal(solveExactCropPlanFixture(uncloneable).status, 'not-run');

  const brokenScore = syntheticProblem([syntheticCandidate('a', ['section:bed-1:week-34'])]);
  brokenScore.score = () => ({ selectedCropPlacements: Number.NaN } as never);
  assert.equal(solveSelection(brokenScore).status, 'not-run');
  assert.equal(solveExactCropPlanFixture(brokenScore).status, 'not-run');
});

test('a score callback cannot smuggle a hard violation or its own tie-break into a solver result', () => {
  const problem = syntheticProblem([syntheticCandidate('a', ['section:bed-1:week-34'])]);
  problem.score = () => ({
    selectedCropPlacements: 1,
    longestFreshFoodGapWeeks: 0,
    idleSectionWeeks: 0,
    cropDiversity: 1,
    operationalTransitions: 1,
    hardViolations: 99,
    deterministicTieBreak: 'not-allowed',
  } as never);

  const solver = solveSelection(problem);
  assert.equal(solver.objective?.hardViolations, 0);
  assert.equal(solver.objective?.deterministicTieBreak, '["a"]');
});

test('the solver plans past the oracle candidate limit that stops the ground truth', () => {
  // The oracle refuses nineteen candidates by design. The solver is the thing
  // that has to keep working there — which is exactly why the small fixtures
  // above have to keep proving it right.
  const candidates = Array.from(
    { length: 24 },
    (_, index) => syntheticCandidate(`c-${String(index).padStart(2, '0')}`, [`section:bed-${index}:week-34`]),
  );
  const problem = syntheticProblem(candidates);
  assert.equal(solveExactCropPlanFixture(problem).status, 'not-run');

  const solver = solveSelection(problem);
  assert.equal(solver.status, 'best-found');
  assert.equal(solver.selectedCandidateIds.length, 24, 'nothing conflicts, so every crop should be planted');
});

// ---------------------------------------------------------------------------
// Randomised cross-check
// ---------------------------------------------------------------------------

/**
 * The single-fixture tests above prove the solver on plans a human chose. This
 * one proves it on plans nobody chose: 300 seeded random tiny problems, every
 * one of them fully enumerated by the oracle. A local search that happened to
 * suit the hand-written fixtures does not survive this.
 */
test('the solver matches the exact oracle on 300 seeded random tiny fixtures', () => {
  let seed = 20260807;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const pick = (max: number) => Math.floor(next() * max);

  let compared = 0;
  let infeasible = 0;
  for (let fixture = 0; fixture < 300; fixture++) {
    const resourceCount = 2 + pick(5);
    const candidateCount = 1 + pick(9);
    const capacities = Array.from({ length: resourceCount }, (_, index) => {
      const capacity = 1 + pick(2);
      return { resource: `r${index}`, capacity, fixedUse: pick(capacity + 1) };
    });
    const attributes = new Map<string, {
      requested: boolean;
      harvestWeeks: number[];
      occupancy: number;
      crop: string;
      jobs: number;
    }>();
    const candidates: ExactCandidate[] = [];
    for (let index = 0; index < candidateCount; index++) {
      const id = `c-${String(index).padStart(2, '0')}`;
      const claimCount = 1 + pick(Math.min(3, resourceCount));
      const claimed = new Set<number>();
      while (claimed.size < claimCount) claimed.add(pick(resourceCount));
      candidates.push({
        ...syntheticCandidate(id, [...claimed].map((resource) => `r${resource}`)),
      });
      attributes.set(id, {
        requested: next() < 0.6,
        harvestWeeks: Array.from({ length: 1 + pick(3) }, () => pick(12)),
        occupancy: 1 + pick(4),
        crop: `crop-${pick(4)}`,
        jobs: 1 + pick(3),
      });
    }
    const requirements = next() < 0.35 && candidateCount > 1
      ? [{
        id: 'req',
        candidateIds: candidates.slice(0, 1 + pick(candidateCount)).map((candidate) => candidate.id),
        minSelected: 1,
      }]
      : undefined;

    // Shuffle so neither side may rely on the caller's ordering.
    const shuffled = [...candidates];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapWith = pick(index + 1);
      [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
    }

    const problem: SelectionProblem = {
      candidates: shuffled,
      capacities,
      ...(requirements ? { requirements } : {}),
      score(selected) {
        const attrs = selected.map((entry) => attributes.get(entry.id)!);
        return {
          selectedCropPlacements: attrs.filter((attr) => attr.requested).length,
          longestFreshFoodGapWeeks: 12 - new Set(attrs.flatMap((attr) => attr.harvestWeeks)).size,
          idleSectionWeeks: 40 - attrs.reduce((total, attr) => total + attr.occupancy, 0),
          cropDiversity: new Set(attrs.map((attr) => attr.crop)).size,
          operationalTransitions: attrs.reduce((total, attr) => total + attr.jobs, 0),
        };
      },
    };

    const oracle = solveExactCropPlanFixture(problem);
    const solver = solveSelection(problem);
    assert.equal(validateSelectionProblem(problem), null, `fixture ${fixture} should be well formed`);

    if (oracle.status === 'infeasible') {
      assert.equal(solver.status, 'infeasible', `fixture ${fixture}: solver missed a proven infeasibility`);
      infeasible++;
      continue;
    }
    assert.equal(oracle.status, 'optimal', `fixture ${fixture}: the oracle must have run`);
    assert.deepEqual(
      solver.selectedCandidateIds,
      oracle.selectedCandidateIds,
      `fixture ${fixture}: solver plan differs from the proven best plan`,
    );
    assert.deepEqual(solver.objective, oracle.objective, `fixture ${fixture}: objective differs`);
    compared++;
  }
  assert.ok(compared > 200, `most fixtures should be feasible and compared (was ${compared})`);
  assert.ok(infeasible > 0, 'the sweep should include genuinely infeasible fixtures too');
});
