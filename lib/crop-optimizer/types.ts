/**
 * Shared vocabulary for the V2 whole-plan optimiser.
 *
 * Everything here is additive to the V2 foundation. `CropPlanV2`,
 * `PlannedCohort`, `ObjectiveVector`, `BedSection` and the exact oracle's
 * candidate/capacity/requirement shapes are IMPORTED, never re-declared: the
 * optimiser must be scorable by the same comparator and checkable against the
 * same brute-force oracle, and a parallel copy of those types would quietly
 * let the two drift apart.
 */

import type {
  CalendarDate,
  ObjectiveVector,
  PlacementExplanation,
  PlannedCohort,
} from '@/lib/crop-plan-v2';
import { isCalendarDate } from '@/lib/crop-plan-v2';
import type { BedDivision, BedSection } from '@/lib/crop-bed-sections';
import type {
  ExactCandidate,
  ExactRequirement,
  ExactResourceCapacity,
  ExactResourceClaim,
} from '@/lib/crop-plan-v2-oracle';
import type { RainPattern } from '@/lib/crop-catalog';
import type { FoodGroup, RotationFamily } from '@/lib/crop-groups';

export type { ExactCandidate, ExactRequirement, ExactResourceCapacity, ExactResourceClaim };

/**
 * The optimiser's selection problem is deliberately the SAME shape the exact
 * oracle solves. That is what makes "the oracle is right and the solver has a
 * bug" a testable statement rather than an aspiration.
 */
export interface SelectionProblem {
  candidates: readonly ExactCandidate[];
  capacities: readonly ExactResourceCapacity[];
  requirements?: readonly ExactRequirement[];
  score(selected: readonly ExactCandidate[]): SelectionScore;
}

/**
 * The five ranked numbers a plan is judged on. `hardViolations` and
 * `deterministicTieBreak` are deliberately absent: the solver, like the
 * oracle, refuses to let a scorer declare its own legality or its own
 * tie-break.
 */
export type SelectionScore = Omit<ObjectiveVector, 'hardViolations' | 'deterministicTieBreak'>;

// ---------------------------------------------------------------------------
// The week grid
// ---------------------------------------------------------------------------

/**
 * Week 0 begins on the plan's anchor date; week w covers anchor + 7w through
 * anchor + 7w + 6. This is the only place the grid is defined, so a candidate,
 * an occupancy claim and a farmer-facing explanation cannot disagree about
 * which week a date is in.
 *
 * Date arithmetic stays civil-calendar arithmetic (Howard Hinnant's
 * days-from-civil), matching the foundation's refusal to route farm dates
 * through a browser `Date` and its timezone.
 */
export function civilDayNumber(date: CalendarDate): number | null {
  if (!isCalendarDate(date)) return null;
  const { year, month, day } = date;
  const shiftedYear = month <= 2 ? year - 1 : year;
  const era = Math.floor((shiftedYear >= 0 ? shiftedYear : shiftedYear - 399) / 400);
  const yearOfEra = shiftedYear - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Whole weeks from the anchor. Returns null rather than guessing on bad input. */
export function weekIndexForDate(anchor: CalendarDate, date: CalendarDate): number | null {
  const anchorDay = civilDayNumber(anchor);
  const targetDay = civilDayNumber(date);
  if (anchorDay === null || targetDay === null) return null;
  return Math.floor((targetDay - anchorDay) / 7);
}

// ---------------------------------------------------------------------------
// Capacity resource keys
// ---------------------------------------------------------------------------
//
// `sectionWeekResource` already lives with the sections it describes
// (lib/crop-bed-sections.ts). These two are new namespaces the optimiser
// introduces, kept beside the week grid because both are grid-derived.

function isStableIdPart(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value === value.trim();
}

/**
 * Tray capacity for one week of the nursery. A nursery phase claims this and
 * NOT a section-week: seedlings in trays are not standing on the bed yet.
 */
export function nurseryWeekResource(nurseryId: string, week: number): string | null {
  if (!isStableIdPart(nurseryId) || !Number.isSafeInteger(week) || week < 0) return null;
  return `nursery:${encodeURIComponent(nurseryId)}:week:${week}`;
}

/**
 * The botanical-family block (hard constraint 6). A cohort claims this key for
 * every week it occupies the section PLUS the cooldown tail, so two cohorts of
 * the same family cannot follow each other immediately on the same ground —
 * while a different family on the same ground claims a different key and is
 * unaffected. A farmer override sets the cooldown to zero, which stops these
 * claims being generated at all rather than silently ignoring them.
 */
export function rotationCooldownResource(
  sectionId: string,
  family: RotationFamily,
  week: number,
): string | null {
  if (!isStableIdPart(sectionId) || !Number.isSafeInteger(week) || week < 0) return null;
  return `rotation:${encodeURIComponent(sectionId)}:${family}:week:${week}`;
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

/**
 * How much water a crop needs. The crop catalog carries NO per-crop water
 * figure, so every catalog-derived candidate is `unknown`. The other members
 * exist so a future sourced field has somewhere to land — they are not
 * defaults, and nothing may quietly resolve `unknown` into one of them.
 */
export type WaterClass = 'unknown' | 'low' | 'moderate' | 'high';

export type CropJobKind = 'nursery-sow' | 'direct-sow' | 'transplant' | 'harvest-start';

export interface HarvestWeekEntry {
  week: number;
  /**
   * Kilogram bounds for THIS week, not for the cohort. Null whenever the
   * source cannot support a per-week split: the catalog's own note is that a
   * published picking period "does not imply an even monthly kg profile", so
   * dividing a cohort total across its weeks would be an invented number.
   * Populated only when the whole picking window is a single week.
   */
  kgLow: number | null;
  kgHigh: number | null;
}

export interface LabourWeekEntry {
  week: number;
  jobs: readonly CropJobKind[];
}

/**
 * A legal, fully dated placement. The solver chooses among these; it never
 * invents a date, a section or a yield of its own.
 */
export interface OptimizerCandidate {
  /** Stable semantic id: crop, bed, sections and start week. Never an index. */
  id: string;
  cropKey: string;
  /** The bed. Named `areaId` in the rebuild spec; a bed id in this pass. */
  areaId: string;
  sectionIds: readonly string[];
  layoutRevision: string;
  nurseryStartWeek?: number;
  fieldStartWeek: number;
  /** Exclusive. The section is free again from this week. */
  fieldReleaseWeek: number;
  harvestProfileByWeek: readonly HarvestWeekEntry[];
  foodGroups: readonly FoodGroup[];
  rotationFamily: RotationFamily;
  /**
   * Whole-cohort kilogram bounds, or null when the catalog has no defensible
   * yield for this crop or the bed has no recorded area. Null means unknown
   * and must stay unknown.
   */
  expectedKgRange: readonly [number, number] | null;
  labourByWeek: readonly LabourWeekEntry[];
  waterClass: WaterClass;
  /** The cohort this candidate would add to the plan, ready to persist. */
  cohort: PlannedCohort;
  /** Section-week, nursery-week and rotation-cooldown claims. */
  claims: readonly ExactResourceClaim[];
  /** Irrigated section-week keys this candidate fills, for the idle-week tier. */
  irrigatedSectionWeekKeys: readonly string[];
}

// ---------------------------------------------------------------------------
// Solver input
// ---------------------------------------------------------------------------

export interface RaisedBedInput {
  bedId: string;
  layoutRevision: string;
  division: BedDivision;
  /**
   * Ground area of the WHOLE bed. Absent means unknown: candidates on this bed
   * then carry `expectedKgRange: null` rather than a made-up weight.
   */
  areaSqm?: number;
  /**
   * Only a bed with confirmed irrigation contributes to the bare-section-week
   * objective. Unconfirmed ground is not scored as a failure to plant.
   */
  irrigationConfirmed?: boolean;
  /**
   * True when the farmer wants this bed planted as one block. The generator
   * then offers whole-bed placements instead of per-section ones.
   */
  plantWholeBed?: boolean;
}

/**
 * A crop the farmer has already got in the ground, or has already accepted.
 * Hard constraint 9: these are fixed, they consume capacity, and they are
 * never candidates.
 */
export interface FixedCohortInput {
  cohort: PlannedCohort;
  /** Inclusive first week and exclusive release week of field occupancy. */
  fieldStartWeek: number;
  fieldReleaseWeek: number;
  harvestWeeks?: readonly number[];
}

/**
 * Household food need. There is no kg-per-person figure in this repository, so
 * there is no default: leaving `kgPerPersonPerWeek` unset reports the supply
 * score as unknown instead of inventing a target.
 */
export interface HouseholdNeedPolicy {
  householdSize?: number;
  kgPerPersonPerWeek?: number;
  /** Source for the figure above, so a reviewer can check it. */
  sourceIds?: readonly string[];
}

export interface NurseryCapacityInput {
  nurseryId: string;
  /** Cohorts that may be in trays at once. Omit the whole input if unknown. */
  concurrentCohorts: number;
}

export interface RaisedBedSolverInput {
  siteKey: string;
  anchorDate: CalendarDate;
  horizonWeeks: number;
  rainPattern: RainPattern;
  beds: readonly RaisedBedInput[];
  /** Crop keys the farmer asked for. Empty means "no preference stated". */
  requestedCropKeys?: readonly string[];
  /** Crop keys that MUST appear. These become hard placement requirements. */
  requiredCropKeys?: readonly string[];
  fixedCohorts?: readonly FixedCohortInput[];
  nursery?: NurseryCapacityInput;
  household?: HouseholdNeedPolicy;
  /**
   * Weeks of the same-family block on one section. 1 blocks an immediate
   * repeat. 0 is the farmer's explicit override from hard constraint 6.
   */
  rotationCooldownWeeks?: number;
  /** Crop keys restricted to staple plots. Raised beds refuse them (PR D). */
  plotOnlyCropKeys?: readonly string[];
}

// ---------------------------------------------------------------------------
// Solver output
// ---------------------------------------------------------------------------

export interface SelectionDiagnostics {
  candidateCount: number;
  beamWidth: number;
  statesExamined: number;
  scoreEvaluations: number;
  improvementMoves: number;
  /** True when the search stopped on its budget rather than on exhaustion. */
  hitEvaluationBudget: boolean;
  elapsedMs: number;
}

export interface SelectionSolution {
  /**
   * Never `optimal`. A beam search with local swaps cannot prove it examined
   * the best plan, and the foundation's `best-found` exists precisely so the
   * difference stays visible.
   */
  status: 'best-found' | 'infeasible' | 'not-run';
  selectedCandidateIds: string[];
  cohorts: PlannedCohort[];
  objective: ObjectiveVector | null;
  explanations: PlacementExplanation[];
  diagnostics: SelectionDiagnostics;
}

export interface SelectionSolverOptions {
  /** Beam width. 1 leaves the whole job to the local-swap pass. */
  beamWidth?: number;
  /** Hard budget on whole-plan scorings, so a big farm degrades honestly. */
  maxScoreEvaluations?: number;
  /** Local-swap rounds attempted from each finalist before giving up. */
  improvementRounds?: number;
  /** Beam finalists handed to the local-swap pass. */
  keepFinalists?: number;
}

export interface CandidateGenerationResult {
  candidates: OptimizerCandidate[];
  capacities: ExactResourceCapacity[];
  requirements: ExactRequirement[];
  sections: BedSection[];
  /** Why a crop, week or bed produced no candidate. Never silent. */
  explanations: PlacementExplanation[];
  /** Section-week keys already held by fixed cohorts. */
  fixedOccupiedSectionWeeks: string[];
  fixedHarvestWeeks: number[];
  irrigatedSectionIds: string[];
  /** True when generation stopped at the candidate cap. */
  trimmed: boolean;
}

/** `${sectionId}#${week}` — the internal occupancy key for scoring only. */
export function sectionWeekKey(sectionId: string, week: number): string {
  return `${sectionId}#${week}`;
}
