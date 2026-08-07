/**
 * The whole-plan solver for raised beds.
 *
 * WHICH ALGORITHM, AND WHY
 * The rebuild spec's first choice is CP-SAT via OR-Tools, with MILP through
 * glpk.js as a smaller alternative. This is a Next.js app with no Python
 * backend and no WASM or glpk.js dependency, so this is the spec's sanctioned
 * transitional implementation: a BEAM SEARCH WITH LOCAL SWAPS. The spec allows
 * it on one condition — that it still scores WHOLE plans and backtracks — and
 * both halves are load-bearing here:
 *
 *  - every state in the beam is scored as a complete plan by the same
 *    lexicographic objective the exact oracle uses, never by an "is this crop
 *    good" heuristic;
 *  - after the beam, a local-swap pass repeatedly REMOVES already-placed
 *    cohorts to make room for better combinations: drop, 1-for-1 swap, the
 *    1-for-2 replace that is the whole reason a greedy pass fails, and a
 *    drop-then-greedy-refill for the cases a pair cannot reach. With
 *    `beamWidth: 1` the beam is a pure greedy pass and the swap pass alone
 *    still has to recover the optimum — `tests/crop-optimizer-solver.test.ts`
 *    asserts exactly that, so the backtracking cannot rot into decoration.
 *
 * The beam is run once per decision order (see `decisionOrders` below) and the
 * better whole plan is kept, because the order a beam decides in changes which
 * plans it can ever build and no single order was best on both a one-bed and a
 * nine-bed farm.
 *
 * WHAT IT NEVER CLAIMS
 * The status is `best-found`, never `optimal`. This search cannot prove it saw
 * the best plan. The one exception is infeasibility, and even there only a
 * PROVEN impossibility (a requirement whose candidates cannot be placed even
 * on an empty farm) is reported as such; a search that simply failed says so
 * in its own words.
 */

import { compareObjectiveVectors, type ObjectiveVector, type PlacementExplanation, type PlannedCohort } from '@/lib/crop-plan-v2';
import { buildObjectiveVector, isFiniteScore } from './objectives';
import { provenUnsatisfiableRequirement, validateSelectionProblem } from './validate';
import type {
  ExactCandidate,
  SelectionDiagnostics,
  SelectionProblem,
  SelectionSolution,
  SelectionSolverOptions,
} from './types';

const DEFAULT_BEAM_WIDTH = 24;
const DEFAULT_MAX_SCORE_EVALUATIONS = 120_000;
const DEFAULT_IMPROVEMENT_ROUNDS = 8;
const DEFAULT_KEEP_FINALISTS = 4;
/**
 * How many conflicting neighbours a single drop may consider when it looks for
 * a PAIR of replacements. The 1-for-2 move is quadratic in this number, so it
 * is bounded rather than allowed to stall a large farm. Tiny fixtures never
 * come close to the bound, so it cannot weaken the oracle comparison.
 */
const MAX_PAIR_NEIGHBOURS = 64;

interface SolverState {
  /** Candidate indices, ascending — the canonical order the oracle sorts to. */
  indices: number[];
  key: string;
  /**
   * Units claimed per resource, indexed densely rather than by name. A beam
   * copies this for every state it grows, and a keyed map of a whole farm's
   * section-weeks made that copy the dominant cost of the whole search; a
   * typed array copies as one memcpy.
   */
  used: Uint16Array;
  shortfall: number;
  objective: ObjectiveVector;
}

function compareStates(a: SolverState, b: SolverState): number {
  if (a.shortfall !== b.shortfall) return a.shortfall - b.shortfall;
  return compareObjectiveVectors(a.objective, b.objective);
}

function notRun(candidateCount: number, message: string, startedAt: number): SelectionSolution {
  return {
    status: 'not-run',
    selectedCandidateIds: [],
    cohorts: [],
    objective: null,
    explanations: [{ code: 'invalid-input', message }],
    diagnostics: {
      candidateCount,
      beamWidth: 0,
      statesExamined: 0,
      scoreEvaluations: 0,
      improvementMoves: 0,
      hitEvaluationBudget: false,
      elapsedMs: Date.now() - startedAt,
    },
  };
}

export function solveSelection(
  problem: SelectionProblem,
  options: SelectionSolverOptions = {},
): SelectionSolution {
  const startedAt = Date.now();
  const candidateCount = Array.isArray(problem?.candidates) ? problem.candidates.length : 0;
  const invalid = validateSelectionProblem(problem);
  if (invalid) return notRun(candidateCount, invalid, startedAt);

  // Cloned once so the caller's candidates cannot be mutated by this search or
  // by their own scorer. (The oracle re-clones on every score call; it can
  // afford to, being limited to eighteen candidates. The protection the caller
  // gets is the same.)
  let candidates: ExactCandidate[];
  try {
    candidates = problem.candidates
      .map((candidate) => ({
        id: candidate.id,
        cohort: structuredClone(candidate.cohort),
        claims: candidate.claims.map((claim) => ({ ...claim })),
      }))
      .sort((a, b) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1));
  } catch {
    return notRun(candidateCount, 'The solver received a cohort that cannot be safely copied.', startedAt);
  }

  const requirements = (problem.requirements ?? []).map((requirement) => ({
    id: requirement.id,
    candidateIds: new Set(requirement.candidateIds),
    minSelected: requirement.minSelected,
  }));
  // Resources are indexed densely once, so every later feasibility test is an
  // array read rather than a string hash.
  const resourceIndexOf = new Map<string, number>();
  const capacityOf = new Uint16Array(problem.capacities.length);
  const baseUse = new Uint16Array(problem.capacities.length);
  problem.capacities.forEach((capacity, index) => {
    resourceIndexOf.set(capacity.resource, index);
    capacityOf[index] = capacity.capacity;
    baseUse[index] = capacity.fixedUse ?? 0;
  });
  const claimResources = candidates.map((candidate) => (
    Int32Array.from(candidate.claims, (claim) => resourceIndexOf.get(claim.resource) ?? -1)
  ));
  const claimUnits = candidates.map((candidate) => Int32Array.from(candidate.claims, (claim) => claim.units));

  const beamWidth = Math.max(1, Math.floor(options.beamWidth ?? DEFAULT_BEAM_WIDTH));
  const maxScoreEvaluations = Math.max(1, Math.floor(options.maxScoreEvaluations ?? DEFAULT_MAX_SCORE_EVALUATIONS));
  const improvementRounds = Math.max(0, Math.floor(options.improvementRounds ?? DEFAULT_IMPROVEMENT_ROUNDS));
  const keepFinalists = Math.max(1, Math.floor(options.keepFinalists ?? DEFAULT_KEEP_FINALISTS));

  const diagnostics: SelectionDiagnostics = {
    candidateCount: candidates.length,
    beamWidth,
    statesExamined: 0,
    scoreEvaluations: 0,
    improvementMoves: 0,
    hitEvaluationBudget: false,
    elapsedMs: 0,
  };

  const provenBlocked = provenUnsatisfiableRequirement({ ...problem, candidates });
  if (provenBlocked) {
    diagnostics.elapsedMs = Date.now() - startedAt;
    return {
      status: 'infeasible',
      selectedCandidateIds: [],
      cohorts: [],
      objective: null,
      explanations: [{
        code: 'requirement-cannot-be-met',
        message: `Requirement "${provenBlocked}" cannot be met: too few of its placements fit even on completely empty ground.`,
      }],
      diagnostics,
    };
  }

  // ---- scoring ------------------------------------------------------------
  const objectiveCache = new Map<string, ObjectiveVector | null>();
  let scoreFailure: string | null = null;

  const keyFor = (indices: readonly number[]) => indices.join(',');

  const objectiveFor = (indices: readonly number[], key: string): ObjectiveVector | null => {
    const cached = objectiveCache.get(key);
    if (cached !== undefined) return cached;
    if (diagnostics.scoreEvaluations >= maxScoreEvaluations) {
      diagnostics.hitEvaluationBudget = true;
      return null;
    }
    diagnostics.scoreEvaluations++;
    const selected = indices.map((index) => candidates[index]);
    let vector: ObjectiveVector | null = null;
    try {
      const score = problem.score(selected);
      if (!isFiniteScore(score)) {
        scoreFailure = 'The plan score must contain finite objective values.';
      } else {
        vector = buildObjectiveVector(selected.map((candidate) => candidate.id), score);
      }
    } catch (error) {
      scoreFailure = error instanceof Error
        ? `The plan score could not be computed: ${error.message}`
        : 'The plan score could not be computed.';
    }
    objectiveCache.set(key, vector);
    return vector;
  };

  const shortfallFor = (indices: readonly number[]): number => {
    if (requirements.length === 0) return 0;
    const ids = new Set(indices.map((index) => candidates[index].id));
    let shortfall = 0;
    for (const requirement of requirements) {
      let met = 0;
      for (const id of requirement.candidateIds) if (ids.has(id)) met++;
      if (met < requirement.minSelected) shortfall += requirement.minSelected - met;
    }
    return shortfall;
  };

  const usageFor = (indices: readonly number[]): Uint16Array => {
    const used = new Uint16Array(baseUse);
    for (const index of indices) {
      const resources = claimResources[index];
      const units = claimUnits[index];
      for (let claim = 0; claim < resources.length; claim++) used[resources[claim]] += units[claim];
    }
    return used;
  };

  const canAdd = (used: Uint16Array, index: number): boolean => {
    const resources = claimResources[index];
    const units = claimUnits[index];
    for (let claim = 0; claim < resources.length; claim++) {
      const resource = resources[claim];
      if (resource < 0) return false;
      if (used[resource] + units[claim] > capacityOf[resource]) return false;
    }
    return true;
  };

  const withCandidate = (used: Uint16Array, index: number): Uint16Array => {
    const next = new Uint16Array(used);
    const resources = claimResources[index];
    const units = claimUnits[index];
    for (let claim = 0; claim < resources.length; claim++) next[resources[claim]] += units[claim];
    return next;
  };

  const makeState = (indices: number[]): SolverState | null => {
    const key = keyFor(indices);
    const objective = objectiveFor(indices, key);
    if (!objective) return null;
    diagnostics.statesExamined++;
    return { indices, key, used: usageFor(indices), shortfall: shortfallFor(indices), objective };
  };

  /**
   * Decision orders. A plan's `indices` stay ascending — so the canonical id
   * order, and therefore the tie-break, is unaffected — but the order the beam
   * DECIDES in changes which plans it ever builds, and neither order wins
   * everywhere. Both are run and the better whole plan is kept.
   *
   *  - least-room-first: fewest capacity claims, then id. Deciding purely in
   *    id order filled a real nine-bed farm with whatever crop sorted first
   *    alphabetically — a year-long crop in every section, 31 placements where
   *    short successions give three times as many. Fewest-claims-first is the
   *    standard greedy order for packing the most items in, and the top
   *    lexicographic tier here is exactly "how many placements".
   *  - canonical id order: on a single small bed this reaches tighter plans
   *    (fewer bare section-weeks) than least-room-first does.
   */
  const byIdOrder = candidates.map((_, index) => index);
  const byRoomOrder = [...byIdOrder].sort((a, b) => (
    candidates[a].claims.length - candidates[b].claims.length || a - b
  ));
  const decisionOrders = [byRoomOrder, byIdOrder];

  const insertSorted = (indices: readonly number[], value: number): number[] => {
    const next = [...indices];
    let position = next.length;
    while (position > 0 && next[position - 1] > value) position--;
    next.splice(position, 0, value);
    return next;
  };

  /**
   * Add every placement that still fits, cheapest first. One move, one score.
   * This is what lets the swap pass trade a single long cohort for the several
   * short ones it was blocking — a 1-for-2 swap cannot cross that distance.
   */
  const greedyFill = (base: readonly number[]): number[] => {
    const used = usageFor(base);
    const inPlan = new Set(base);
    let filled = [...base];
    for (const index of byRoomOrder) {
      if (inPlan.has(index) || !canAdd(used, index)) continue;
      const resources = claimResources[index];
      const units = claimUnits[index];
      for (let claim = 0; claim < resources.length; claim++) used[resources[claim]] += units[claim];
      filled = insertSorted(filled, index);
    }
    return filled;
  };

  // ---- 1. beam over include/exclude, whole-plan scored at every step -------
  const empty = makeState([]);
  if (!empty) {
    diagnostics.elapsedMs = Date.now() - startedAt;
    return notRun(candidates.length, scoreFailure ?? 'The plan score could not be computed.', startedAt);
  }
  // The swap pass is not an afterthought, so it does not get the leftovers of
  // an exhausted budget: the beams together may spend at most this much of it.
  const beamBudget = Math.max(1, Math.floor(maxScoreEvaluations * 0.6));

  const runBeam = (order: readonly number[], budget: number): SolverState[] => {
    let beam: SolverState[] = [empty];
    for (const index of order) {
      if (diagnostics.scoreEvaluations >= budget) {
        diagnostics.hitEvaluationBudget = true;
        break;
      }
      const grown: SolverState[] = [];
      for (const state of beam) {
        if (!canAdd(state.used, index)) continue;
        const indices = insertSorted(state.indices, index);
        const key = keyFor(indices);
        const objective = objectiveFor(indices, key);
        if (!objective) continue;
        diagnostics.statesExamined++;
        grown.push({
          indices,
          key,
          used: withCandidate(state.used, index),
          shortfall: shortfallFor(indices),
          objective,
        });
      }
      if (scoreFailure) return beam;
      if (grown.length === 0) continue;
      const merged = new Map<string, SolverState>();
      for (const state of [...beam, ...grown]) merged.set(state.key, state);
      beam = [...merged.values()].sort(compareStates).slice(0, beamWidth);
    }
    return beam;
  };

  const beams: SolverState[][] = [];
  for (let pass = 0; pass < decisionOrders.length; pass++) {
    beams.push(runBeam(decisionOrders[pass], Math.floor((beamBudget * (pass + 1)) / decisionOrders.length)));
    if (scoreFailure) return notRun(candidates.length, scoreFailure, startedAt);
  }
  const beam = [...new Map(beams.flat().map((state) => [state.key, state])).values()].sort(compareStates);

  // ---- 2. local swaps: add, drop, 1-for-1, 1-for-2, drop-and-refill --------
  const claimantsOfResource: number[][] = problem.capacities.map(() => []);
  for (let index = 0; index < candidates.length; index++) {
    for (const resource of claimResources[index]) {
      if (resource >= 0) claimantsOfResource[resource].push(index);
    }
  }

  const improve = (start: SolverState): SolverState => {
    let current = start;
    for (let round = 0; round < improvementRounds; round++) {
      let best = current;
      let bestIndices: number[] | null = null;
      // A move is judged on its objective alone; the resource usage of the
      // winner is rebuilt once at the end of the round rather than for every
      // move considered, which is what makes a whole-farm sweep affordable.
      // Until then a candidate best carries the CURRENT state's usage, which
      // nothing reads — feasibility is always tested against `current.used`.
      const consider = (indices: number[]) => {
        const sorted = [...indices].sort((a, b) => a - b);
        const key = keyFor(sorted);
        if (key === current.key) return;
        const objective = objectiveFor(sorted, key);
        if (!objective) return;
        diagnostics.statesExamined++;
        const shortfall = shortfallFor(sorted);
        if (shortfall !== best.shortfall
          ? shortfall > best.shortfall
          : compareObjectiveVectors(objective, best.objective) >= 0) return;
        best = { indices: sorted, key, used: current.used, shortfall, objective };
        bestIndices = sorted;
      };

      const selected = new Set(current.indices);
      // Add anything that still fits, one at a time and then all at once.
      for (const index of byRoomOrder) {
        if (selected.has(index)) continue;
        if (!canAdd(current.used, index)) continue;
        consider(insertSorted(current.indices, index));
      }
      consider(greedyFill(current.indices));
      // Drop, then re-place what the drop unblocked. This is the backtracking.
      for (const dropped of current.indices) {
        const rest = current.indices.filter((index) => index !== dropped);
        consider(rest);
        consider(greedyFill(rest));
        const restUsed = usageFor(rest);
        const blocked = new Set<number>();
        for (const resource of claimResources[dropped]) {
          if (resource < 0) continue;
          for (const index of claimantsOfResource[resource]) {
            if (index === dropped || selected.has(index) || blocked.has(index)) continue;
            if (canAdd(restUsed, index)) blocked.add(index);
          }
        }
        const neighbours = [...blocked].sort((a, b) => a - b).slice(0, MAX_PAIR_NEIGHBOURS);
        for (const first of neighbours) {
          consider([...rest, first]);
          const withFirst = withCandidate(restUsed, first);
          for (const second of neighbours) {
            if (second <= first) continue;
            if (!canAdd(withFirst, second)) continue;
            consider([...rest, first, second]);
          }
        }
      }
      if (scoreFailure) return current;
      if (bestIndices === null) break;
      diagnostics.improvementMoves++;
      current = { ...best, used: usageFor(bestIndices) };
    }
    return current;
  };

  // Seed the swap pass from the best states overall AND from the best states
  // that already meet every requirement. Without the second group a plan whose
  // requirements are hard to satisfy would only ever be improved from seeds
  // that do not satisfy them.
  const seeds = new Map<string, SolverState>();
  for (const state of beam.slice(0, keepFinalists)) seeds.set(state.key, state);
  for (const state of beam.filter((entry) => entry.shortfall === 0).slice(0, keepFinalists)) {
    seeds.set(state.key, state);
  }
  const finalists = [...seeds.values()].map(improve);
  if (scoreFailure) return notRun(candidates.length, scoreFailure, startedAt);
  const satisfying = [...finalists, ...beam].filter((state) => state.shortfall === 0);
  satisfying.sort(compareStates);
  const winner = satisfying[0];

  diagnostics.elapsedMs = Date.now() - startedAt;

  if (!winner) {
    return {
      status: 'infeasible',
      selectedCandidateIds: [],
      cohorts: [],
      objective: null,
      explanations: [{
        code: 'no-feasible-plan-found',
        message: 'The search could not build a plan that meets every requirement. That is a search result, not a proof that no such plan exists — widen the beam or relax a requirement.',
      }],
      diagnostics,
    };
  }

  const selected = winner.indices.map((index) => candidates[index]);
  const explanations: PlacementExplanation[] = [{
    code: 'best-found',
    message: 'This is the best plan the search reached, scored as a whole plan. It is not proven to be the best possible plan.',
  }];
  if (diagnostics.hitEvaluationBudget) {
    explanations.push({
      code: 'evaluation-budget-reached',
      message: `The search stopped after ${diagnostics.scoreEvaluations} whole-plan scorings. A longer run may find a better plan.`,
    });
  }
  const cohorts: PlannedCohort[] = selected.map((candidate) => structuredClone(candidate.cohort));

  return {
    status: 'best-found',
    selectedCandidateIds: selected.map((candidate) => candidate.id),
    cohorts,
    objective: winner.objective,
    explanations,
    diagnostics,
  };
}
