import type { RainPattern } from './crop-catalog';
import { normaliseBedSections, type BedSection } from './crop-bed-sections';

export type { BedDivision, BedSection, BedSectionLabel } from './crop-bed-sections';

/**
 * V2 stays beside the month-template plan until farmers have reviewed a
 * deliberate migration. A V1 row has neither a site, an operational year nor
 * a physical section, so treating it as this shape would invent facts.
 */
export const CROP_PLAN_V2_VERSION = 2 as const;

/** A calendar date without a time or browser timezone. */
export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

/** How precisely a date can be shown to a farmer. */
export type TimingPrecision =
  | 'exact-day'
  | 'week-derived'
  | 'month-derived'
  | 'legacy-unconfirmed';

export type CropPlanV2Status = 'draft' | 'proposed' | 'accepted' | 'superseded';
export type CohortState = 'proposed' | 'accepted' | 'observed' | 'completed';
export type SowingMethod = 'direct-sow' | 'nursery-transplant';

/**
 * A section belongs to one explicit layout revision. A fraction from V1 has
 * no side or axis, so it is intentionally not accepted as a section here.
 */
export interface CohortLocation {
  bedId: string;
  /** A full crop may occupy several named sections of one physical bed. */
  sectionIds: string[];
  layoutRevision: string;
}

export interface PlannedSowing {
  method: SowingMethod;
  /** Direct sowing or starting a tray, according to `method`. */
  startsOn: CalendarDate;
  /** A committed field date. It is never inferred from `transplant: true`. */
  transplantOn?: CalendarDate;
  precision: TimingPrecision;
}

export interface PlannedCohort {
  id: string;
  cropKey: string;
  location: CohortLocation;
  sowing: PlannedSowing;
  state: CohortState;
}

export interface ObjectiveVector {
  hardViolations: number;
  selectedCropPlacements: number;
  longestFreshFoodGapWeeks: number;
  idleSectionWeeks: number;
  cropDiversity: number;
  operationalTransitions: number;
  deterministicTieBreak: string;
}

export interface PlannerGeneration {
  engine: 'legacy-adapter' | 'v2';
  version: string;
  generatedAt: number;
  objective: ObjectiveVector;
}

export interface CropPlanV2 {
  version: typeof CROP_PLAN_V2_VERSION;
  id: string;
  /** Required before any physical layout can be trusted. */
  siteKey: string;
  timezone: string;
  anchorDate: CalendarDate;
  horizonWeeks: number;
  layoutFingerprint: string;
  rainPattern: RainPattern;
  status: CropPlanV2Status;
  sections: BedSection[];
  cohorts: PlannedCohort[];
  generation: PlannerGeneration;
  createdAt: number;
  updatedAt: number;
}

export interface PlacementExplanation {
  cohortId?: string;
  code: string;
  message: string;
}

export interface PlannerDiagnostics {
  candidateCount: number;
  elapsedMs: number;
}

export interface PlannerResult {
  /** `best-found` is deliberately distinct from a proven optimum. */
  status: 'optimal' | 'best-found' | 'infeasible' | 'not-run';
  cohorts: PlannedCohort[];
  /** A plan that did not run or could not be made has no honest score. */
  objective: ObjectiveVector | null;
  explanations: PlacementExplanation[];
  diagnostics: PlannerDiagnostics;
}

export interface CropPlannerEngine<Input> {
  readonly id: string;
  suggest(input: Input): PlannerResult;
}

/** Negative means `a` is preferred. This is an ordered objective, never a weighted score. */
export function compareObjectiveVectors(a: ObjectiveVector, b: ObjectiveVector): number {
  const numericTiers: Array<[number, number, 'ascending' | 'descending']> = [
    [a.hardViolations, b.hardViolations, 'ascending'],
    [a.selectedCropPlacements, b.selectedCropPlacements, 'descending'],
    [a.longestFreshFoodGapWeeks, b.longestFreshFoodGapWeeks, 'ascending'],
    [a.idleSectionWeeks, b.idleSectionWeeks, 'ascending'],
    [a.cropDiversity, b.cropDiversity, 'descending'],
    [a.operationalTransitions, b.operationalTransitions, 'ascending'],
  ];
  for (const [left, right, direction] of numericTiers) {
    if (left === right) continue;
    return direction === 'ascending' ? left - right : right - left;
  }
  if (a.deterministicTieBreak === b.deterministicTieBreak) return 0;
  return a.deterministicTieBreak < b.deterministicTieBreak ? -1 : 1;
}

export type TimingBasis = 'from-direct-sow' | 'from-transplant' | 'from-nursery-sow';

export interface TimingWindowEvidence {
  months: readonly number[];
  precision: 'month-derived';
  sourceIds: readonly string[];
}

export interface DurationEvidence {
  days: readonly [number, number];
  basis: TimingBasis;
  precision: Exclude<TimingPrecision, 'legacy-unconfirmed'>;
  sourceIds: readonly string[];
}

/**
 * This is intentionally separate from the existing catalogue fields for now.
 * It lets evidence be added crop by crop without laundering old estimates into
 * verified V2 inputs.
 */
export type CropTimingEvidenceV2 =
  | {
    eligibility: 'verified';
    sowWindows: Partial<Record<RainPattern, TimingWindowEvidence>>;
    maturity: DurationEvidence;
    nursery?: DurationEvidence;
    harvest?: DurationEvidence;
  }
  | {
    eligibility: 'insufficient-evidence';
    reason: string;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerNumber(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (!isRecord(value)) return false;
  const { year, month, day } = value;
  if (!isIntegerNumber(year) || !isIntegerNumber(month) || !isIntegerNumber(day)) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthLengths[month - 1];
}

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function formatCalendarDate(date: CalendarDate): string {
  const month = String(date.month).padStart(2, '0');
  const day = String(date.day).padStart(2, '0');
  return `${date.year}-${month}-${day}`;
}

export function compareCalendarDates(a: CalendarDate, b: CalendarDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function cloneDate(date: CalendarDate): CalendarDate {
  return { year: date.year, month: date.month, day: date.day };
}

function isRainPattern(value: unknown): value is RainPattern {
  return value === 'summer'
    || value === 'winter'
    || value === 'all-year'
    || value === 'mild-frost';
}

function isPlanStatus(value: unknown): value is CropPlanV2Status {
  return value === 'draft' || value === 'proposed' || value === 'accepted' || value === 'superseded';
}

function isCohortState(value: unknown): value is CohortState {
  return value === 'proposed' || value === 'accepted' || value === 'observed' || value === 'completed';
}

function isTimingPrecision(value: unknown): value is TimingPrecision {
  return value === 'exact-day'
    || value === 'week-derived'
    || value === 'month-derived'
    || value === 'legacy-unconfirmed';
}

function normaliseCohort(value: unknown): PlannedCohort | null {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.cropKey)) return null;
  if (!isRecord(value.location) || !isRecord(value.sowing)) return null;
  const location = value.location;
  const sowing = value.sowing;
  const startsOn = sowing.startsOn;
  const transplantOn = sowing.transplantOn;
  if (!isNonEmptyString(location.bedId)
    || !isNonEmptyString(location.layoutRevision)
    || !Array.isArray(location.sectionIds)
    || location.sectionIds.length === 0
    || location.sectionIds.some((sectionId) => !isNonEmptyString(sectionId))
    || new Set(location.sectionIds).size !== location.sectionIds.length
    || !isCalendarDate(startsOn)
    || !isTimingPrecision(sowing.precision)
    || !isCohortState(value.state)
    || (sowing.method !== 'direct-sow' && sowing.method !== 'nursery-transplant')) return null;
  if (transplantOn !== undefined && !isCalendarDate(transplantOn)) return null;
  if (sowing.method === 'direct-sow' && transplantOn !== undefined) return null;
  if (sowing.method === 'nursery-transplant' && transplantOn && compareCalendarDates(transplantOn, startsOn) < 0) return null;
  return {
    id: value.id,
    cropKey: value.cropKey,
    location: {
      bedId: location.bedId,
      sectionIds: [...location.sectionIds],
      layoutRevision: location.layoutRevision,
    },
    sowing: {
      method: sowing.method,
      startsOn: cloneDate(startsOn),
      ...(transplantOn ? { transplantOn: cloneDate(transplantOn) } : {}),
      precision: sowing.precision,
    },
    state: value.state,
  };
}

function normaliseObjective(value: unknown): ObjectiveVector | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.hardViolations)
    || !isFiniteNumber(value.selectedCropPlacements)
    || !isFiniteNumber(value.longestFreshFoodGapWeeks)
    || !isFiniteNumber(value.idleSectionWeeks)
    || !isFiniteNumber(value.cropDiversity)
    || !isFiniteNumber(value.operationalTransitions)
    || !isNonEmptyString(value.deterministicTieBreak)) return null;
  return {
    hardViolations: value.hardViolations,
    selectedCropPlacements: value.selectedCropPlacements,
    longestFreshFoodGapWeeks: value.longestFreshFoodGapWeeks,
    idleSectionWeeks: value.idleSectionWeeks,
    cropDiversity: value.cropDiversity,
    operationalTransitions: value.operationalTransitions,
    deterministicTieBreak: value.deterministicTieBreak,
  };
}

/**
 * Runtime decoding is deliberately strict. V2 must reject ambiguous data
 * rather than quietly reinterpret a farmer's V1 plan as a different farm.
 */
export function normaliseCropPlanV2(value: unknown): CropPlanV2 | null {
  if (!isRecord(value)
    || value.version !== CROP_PLAN_V2_VERSION
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.siteKey)
    || !isNonEmptyString(value.timezone)
    || !isCalendarDate(value.anchorDate)
    || !isIntegerNumber(value.horizonWeeks)
    || value.horizonWeeks <= 0
    || !isNonEmptyString(value.layoutFingerprint)
    || !isRainPattern(value.rainPattern)
    || !isPlanStatus(value.status)
    || !Array.isArray(value.sections)
    || !Array.isArray(value.cohorts)
    || !isRecord(value.generation)
    || !isFiniteNumber(value.createdAt)
    || !isFiniteNumber(value.updatedAt)) return null;

  const validSections = normaliseBedSections(value.sections);
  const cohorts = value.cohorts.map(normaliseCohort);
  if (!validSections || cohorts.some((cohort) => !cohort)) return null;
  const validCohorts = cohorts as PlannedCohort[];
  if (new Set(validCohorts.map((cohort) => cohort.id)).size !== validCohorts.length) return null;

  const sectionsById = new Map(validSections.map((section) => [section.id, section]));
  if (validCohorts.some((cohort) => {
    return cohort.location.sectionIds.some((sectionId) => {
      const section = sectionsById.get(sectionId);
      return !section
        || section.bedId !== cohort.location.bedId
        || section.layoutRevision !== cohort.location.layoutRevision;
    });
  })) return null;

  const generation = value.generation;
  const engine = generation.engine;
  const version = generation.version;
  const generatedAt = generation.generatedAt;
  if ((engine !== 'legacy-adapter' && engine !== 'v2')
    || !isNonEmptyString(version)
    || !isFiniteNumber(generatedAt)) return null;
  const objective = normaliseObjective(generation.objective);
  if (!objective) return null;

  return {
    version: CROP_PLAN_V2_VERSION,
    id: value.id,
    siteKey: value.siteKey,
    timezone: value.timezone,
    anchorDate: cloneDate(value.anchorDate),
    horizonWeeks: value.horizonWeeks,
    layoutFingerprint: value.layoutFingerprint,
    rainPattern: value.rainPattern,
    status: value.status,
    sections: validSections.map((section) => ({ ...section })),
    cohorts: validCohorts,
    generation: {
      engine,
      version,
      generatedAt,
      objective,
    },
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

export function isCropPlanV2(value: unknown): value is CropPlanV2 {
  return normaliseCropPlanV2(value) !== null;
}
