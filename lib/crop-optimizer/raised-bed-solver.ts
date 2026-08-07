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
 *    cohorts to make room for better combinations (drop, 1-for-1 swap and the
 *    1-for-2 replace that is the whole reason a greedy pass fails). With
 *    `beamWidth: 1` the beam is a pure greedy pass and the swap pass alone
 *    still has to recover the optimum — `tests/crop-optimizer-solver.test.ts`
 *    asserts exactly that, so the backtracking cannot rot into decoration.
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
  used: Map<string, number>;
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
  const capacityOf = new Map(problem.capacities.map((capacity) => [capacity.resource, capacity.capacity]));
  const baseUse = new Map(problem.capacities.map((capacity) => [capacity.resource, capacity.fixedUse ?? 0]));

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

  const makeState = (indices: number[]): SolverState | null => {
    const key = keyFor(indices);
    const objective = objectiveFor(indices, key);
    if (!objective) return null;
    diagnostics.statesExamined++;
    return {
      indices,
      key,
      used: usageFor(indices),
      shortfall: shortfallFor(indices),
      objective,
    };
  };

  function usageFor(indices: readonly number[]): Map<string, number> {
    const used = new Map(baseUse);
    for (const index of indices) {
      for (const claim of candidates[index].claims) {
        used.set(claim.resource, (used.get(claim.resource) ?? 0) + claim.units);
      }
    }
    return used;
  }

  const canAdd = (used: ReadonlyMap<string, number>, index: number): boolean => {
    for (const claim of candidates[index].claims) {
      const capacity = capacityOf.get(claim.resource);
      if (capacity === undefined) return false;
      if ((used.get(claim.resource) ?? 0) + claim.units > capacity) return false;
    }
    return true;
  };

  const withCandidate = (used: ReadonlyMap<string, number>, index: number): Map<string, number> => {
    const next = new Map(used);
    for (const claim of candidates[index].claims) {
      next.set(claim.resource, (next.get(claim.resource) ?? 0) + claim.units);
    }
    return next;
  };

  // ---- 1. beam over include/exclude, whole-plan scored at every step -------
  const empty = makeState([]);
  if (!empty) {
    diagnostics.elapsedMs = Date.now() - startedAt;
    return notRun(candidates.length, scoreFailure ?? 'The plan score could not be computed.', startedAt);
  }
  let beam: SolverState[] = [empty];

  for (let index = 0; index < candidates.length; index++) {
    const grown: SolverState[] = [];
    for (const state of beam) {
      if (!canAdd(state.used, index)) continue;
      const indices = [...state.indices, index];
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
    if (scoreFailure) return notRun(candidates.length, scoreFailure, startedAt);
    if (grown.length === 0) continue;
    const merged = new Map<string, SolverState>();
    for (const state of [...beam, ...grown]) merged.set(state.key, state);
    beam = [...merged.values()].sort(compareStates).slice(0, beamWidth);
  }

  // ---- 2. local swaps: drop, 1-for-1, and the 1-for-2 replace --------------
  const resourceIndex = new Map<string, number[]>();
  for (let index = 0; index < candidates.length; index++) {
    for (const claim of candidates[index].claims) {
      const bucket = resourceIndex.get(claim.resource);
      if (bucket) bucket.push(index);
      else resourceIndex.set(claim.resource, [index]);
    }
  }

  const improve = (start: SolverState): SolverState => {
    let current = start;
    for (let round = 0; round < improvementRounds; round++) {
      let best = current;
      const consider = (indices: number[]) => {
        const sorted = [...indices].sort((a, b) => a - b);
        const key = keyFor(sorted);
        if (key === current.key) return;
        const objective = objectiveFor(sorted, key);
        if (!objective) return;
        diagnostics.statesExamined++;
        const state: SolverState = {
          indices: sorted,
          key,
          used: usageFor(sorted),
          shortfall: shortfallFor(sorted),
          objective,
        };
        if (compareStates(state, best) < 0) best = state;
      };

      // Add anything that still fits.
      for (let index = 0; index < candidates.length; index++) {
        if (current.indices.includes(index)) continue;
        if (!canAdd(current.used, index)) continue;
        consider([...current.indices, index]);
      }
      // Drop, then re-place what the drop unblocked. This is the backtracking.
      for (const dropped of current.indices) {
        const rest = current.indices.filter((index) => index !== dropped);
        consider(rest);
        const restUsed = usageFor(rest);
        const blocked = new Set<number>();
        for (const claim of candidates[dropped].claims) {
          for (const index of resourceIndex.get(claim.resource) ?? []) {
            if (index === dropped || rest.includes(index)) continue;
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
      if (compareStates(best, current) >= 0) break;
      diagnostics.improvementMoves++;
      current = best;
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
