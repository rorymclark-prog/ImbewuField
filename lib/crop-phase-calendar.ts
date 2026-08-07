import {
  compareCalendarDates,
  type CalendarDate,
  type CropTimingEvidenceV2,
  type DurationEvidence,
  formatCalendarDate,
  isCalendarDate,
  isLeapYear,
  type PlannedCohort,
  type TimingBasis,
  type TimingPrecision,
} from './crop-plan-v2';
import type { RainPattern } from './crop-catalog';

export type CropPhaseKind = 'nursery' | 'field-grow' | 'harvest-window';
export type TimelineDescriptorKind =
  | 'nursery-start-dot'
  | 'nursery-link'
  | 'transplant-arrow'
  | 'direct-sow-arrow'
  | 'field-grow-bar'
  | 'harvest-window-bar';

export interface CropPhase {
  kind: CropPhaseKind;
  startsOn: CalendarDate;
  /** An inclusive upper boundary, when source evidence gives one. */
  endsOn?: CalendarDate;
  precision: TimingPrecision;
  sourceIds: readonly string[];
}

export interface CropMilestone {
  kind: 'nursery-start' | 'direct-sow' | 'transplant' | 'first-harvest';
  on: CalendarDate;
  precision: TimingPrecision;
  sourceIds: readonly string[];
}

export interface TimelineDescriptor {
  kind: TimelineDescriptorKind;
  startsOn: CalendarDate;
  endsOn?: CalendarDate;
  precision: TimingPrecision;
  label: string;
  ariaLabel: string;
}

export interface PhaseCalendarWarning {
  code:
    | 'observed-history-not-recorded'
    | 'timing-not-verified'
    | 'nursery-evidence-missing'
    | 'transplant-date-needed'
    | 'transplant-before-nursery'
    | 'harvest-before-field-start'
    | 'maturity-basis-does-not-match-method';
  message: string;
}

export interface CropPhaseCalendar {
  phases: CropPhase[];
  milestones: CropMilestone[];
  warnings: PhaseCalendarWarning[];
}

export interface CropPhaseCalendarInput {
  cohort: Pick<PlannedCohort, 'id' | 'cropKey' | 'sowing' | 'state'>;
  timing: CropTimingEvidenceV2;
  /** Optional because a farmer may confirm a sowing date before choosing a site climate. */
  rainPattern?: RainPattern;
  cropName?: string;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Pure date-only arithmetic: browser timezone and daylight saving never move a farm task. */
export function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  if (!isCalendarDate(date) || !Number.isInteger(days)) {
    throw new Error('addCalendarDays needs a valid local calendar date and whole-day offset');
  }
  let { year, month, day } = date;
  let remaining = days;
  while (remaining > 0) {
    const daysLeftThisMonth = daysInMonth(year, month) - day;
    if (remaining <= daysLeftThisMonth) return { year, month, day: day + remaining };
    remaining -= daysLeftThisMonth + 1;
    day = 1;
    if (month === 12) {
      year++;
      month = 1;
    } else {
      month++;
    }
  }
  while (remaining < 0) {
    if (-remaining < day) return { year, month, day: day + remaining };
    remaining += day;
    if (month === 1) {
      year--;
      month = 12;
    } else {
      month--;
    }
    day = daysInMonth(year, month);
  }
  return { year, month, day };
}

function mergedPrecision(...precisions: TimingPrecision[]): TimingPrecision {
  const rank: Record<TimingPrecision, number> = {
    'exact-day': 0,
    'week-derived': 1,
    'month-derived': 2,
    'legacy-unconfirmed': 3,
  };
  return precisions.reduce((leastPrecise, precision) => (
    rank[precision] > rank[leastPrecise] ? precision : leastPrecise
  ), 'exact-day');
}

function durationIsUsable(evidence: DurationEvidence | undefined): evidence is DurationEvidence {
  if (!evidence) return false;
  return Number.isInteger(evidence.days[0])
    && Number.isInteger(evidence.days[1])
    && evidence.days[0] >= 0
    && evidence.days[1] >= evidence.days[0]
    && evidence.sourceIds.length > 0;
}

function basisDate(
  basis: TimingBasis,
  cohort: CropPhaseCalendarInput['cohort'],
): CalendarDate | null {
  if (basis === 'from-direct-sow') {
    return cohort.sowing.method === 'direct-sow' ? cohort.sowing.startsOn : null;
  }
  if (basis === 'from-nursery-sow') {
    return cohort.sowing.method === 'nursery-transplant' ? cohort.sowing.startsOn : null;
  }
  return cohort.sowing.method === 'nursery-transplant'
    ? cohort.sowing.transplantOn ?? null
    : null;
}

function cropLabel(input: CropPhaseCalendarInput): string {
  return input.cropName ?? input.cohort.cropKey;
}

function sowingSourceIds(input: CropPhaseCalendarInput): readonly string[] {
  if (input.timing.eligibility !== 'verified' || !input.rainPattern) return [];
  return input.timing.sowWindows[input.rainPattern]?.sourceIds ?? [];
}

function warning(code: PhaseCalendarWarning['code'], message: string): CropPhaseCalendar {
  return { phases: [], milestones: [], warnings: [{ code, message }] };
}

/**
 * One V2 authority for the nursery → field → harvest sequence. It receives a
 * committed date from a farmer or future solver; it does not turn a generic
 * transplant flag or a duration range into a made-up plant-out date.
 */
export function buildCropPhaseCalendar(input: CropPhaseCalendarInput): CropPhaseCalendar {
  const { cohort, timing } = input;
  if (cohort.state === 'observed' || cohort.state === 'completed') {
    return warning(
      'observed-history-not-recorded',
      `${cropLabel(input)} is already observed, so its unrecorded nursery history is not drawn.`,
    );
  }
  if (timing.eligibility !== 'verified' || !durationIsUsable(timing.maturity)) {
    return warning('timing-not-verified', `${cropLabel(input)} needs verified timing before V2 can draw dates.`);
  }

  if (cohort.sowing.method === 'direct-sow') {
    const maturityBasisDate = basisDate(timing.maturity.basis, cohort);
    if (!maturityBasisDate) {
      return warning(
        'maturity-basis-does-not-match-method',
        `${cropLabel(input)} maturity evidence does not match this sowing method.`,
      );
    }
    const maturityPrecision = mergedPrecision(cohort.sowing.precision, timing.maturity.precision);
    const harvestStartsOn = addCalendarDays(maturityBasisDate, timing.maturity.days[0]);
    const harvestEndsOn = addCalendarDays(maturityBasisDate, timing.maturity.days[1]);
    const harvest: CropPhase = {
      kind: 'harvest-window',
      startsOn: harvestStartsOn,
      ...(compareCalendarDates(harvestEndsOn, harvestStartsOn) > 0 ? { endsOn: harvestEndsOn } : {}),
      precision: maturityPrecision,
      sourceIds: timing.maturity.sourceIds,
    };
    const harvestMilestone: CropMilestone = {
      kind: 'first-harvest',
      on: harvestStartsOn,
      precision: maturityPrecision,
      sourceIds: timing.maturity.sourceIds,
    };
    return {
      phases: [
        {
          kind: 'field-grow',
          startsOn: cohort.sowing.startsOn,
          endsOn: harvestStartsOn,
          precision: maturityPrecision,
          sourceIds: timing.maturity.sourceIds,
        },
        harvest,
      ],
      milestones: [
        {
          kind: 'direct-sow',
          on: cohort.sowing.startsOn,
          precision: cohort.sowing.precision,
          sourceIds: sowingSourceIds(input),
        },
        harvestMilestone,
      ],
      warnings: [],
    };
  }

  if (!durationIsUsable(timing.nursery)) {
    return warning('nursery-evidence-missing', `${cropLabel(input)} needs verified nursery timing before V2 can draw a transplant.`);
  }
  const nurseryPrecision = mergedPrecision(cohort.sowing.precision, timing.nursery.precision);
  const nurseryStart: CropMilestone = {
    kind: 'nursery-start',
    on: cohort.sowing.startsOn,
    precision: nurseryPrecision,
    sourceIds: timing.nursery.sourceIds,
  };
  if (!cohort.sowing.transplantOn) {
    return {
      phases: [{
        kind: 'nursery',
        startsOn: cohort.sowing.startsOn,
        precision: nurseryPrecision,
        sourceIds: timing.nursery.sourceIds,
      }],
      milestones: [nurseryStart],
      warnings: [{
        code: 'transplant-date-needed',
        message: `${cropLabel(input)} has a nursery start but no committed plant-out date.`,
      }],
    };
  }
  if (compareCalendarDates(cohort.sowing.transplantOn, cohort.sowing.startsOn) < 0) {
    return warning('transplant-before-nursery', `${cropLabel(input)} cannot be planted out before nursery sowing.`);
  }

  const maturityBasisDate = basisDate(timing.maturity.basis, cohort);
  if (!maturityBasisDate) {
    return warning(
      'maturity-basis-does-not-match-method',
      `${cropLabel(input)} maturity evidence does not match this sowing method.`,
    );
  }
  const maturityPrecision = mergedPrecision(cohort.sowing.precision, timing.maturity.precision);
  const harvestStartsOn = addCalendarDays(maturityBasisDate, timing.maturity.days[0]);
  const harvestEndsOn = addCalendarDays(maturityBasisDate, timing.maturity.days[1]);
  const harvest: CropPhase = {
    kind: 'harvest-window',
    startsOn: harvestStartsOn,
    ...(compareCalendarDates(harvestEndsOn, harvestStartsOn) > 0 ? { endsOn: harvestEndsOn } : {}),
    precision: maturityPrecision,
    sourceIds: timing.maturity.sourceIds,
  };
  const harvestMilestone: CropMilestone = {
    kind: 'first-harvest',
    on: harvestStartsOn,
    precision: maturityPrecision,
    sourceIds: timing.maturity.sourceIds,
  };
  if (compareCalendarDates(harvestStartsOn, cohort.sowing.transplantOn) < 0) {
    return warning(
      'harvest-before-field-start',
      `${cropLabel(input)} maturity would finish before its committed plant-out date.`,
    );
  }
  const fieldPrecision = mergedPrecision(nurseryPrecision, maturityPrecision);
  return {
    phases: [
      {
        kind: 'nursery',
        startsOn: cohort.sowing.startsOn,
        endsOn: cohort.sowing.transplantOn,
        precision: nurseryPrecision,
        sourceIds: timing.nursery.sourceIds,
      },
      {
        kind: 'field-grow',
        startsOn: cohort.sowing.transplantOn,
        endsOn: harvestStartsOn,
        precision: fieldPrecision,
        sourceIds: timing.maturity.sourceIds,
      },
      harvest,
    ],
    milestones: [
      nurseryStart,
      {
        kind: 'transplant',
        on: cohort.sowing.transplantOn,
        precision: fieldPrecision,
        sourceIds: timing.nursery.sourceIds,
      },
      harvestMilestone,
    ],
    warnings: [],
  };
}

function labelPrecision(precision: TimingPrecision): string {
  if (precision === 'exact-day') return '';
  if (precision === 'week-derived') return ' (week estimate)';
  if (precision === 'month-derived') return ' (month estimate)';
  return ' (timing to confirm)';
}

/**
 * Data-only rendering contract for the Tend-style row. The UI decides the
 * colours and pixels; this function fixes the truthful semantic order.
 */
export function timelineDescriptorsForCropPhaseCalendar(calendar: CropPhaseCalendar): TimelineDescriptor[] {
  const descriptors: TimelineDescriptor[] = [];
  for (const milestone of calendar.milestones) {
    const date = formatCalendarDate(milestone.on);
    if (milestone.kind === 'nursery-start') {
      descriptors.push({
        kind: 'nursery-start-dot',
        startsOn: milestone.on,
        precision: milestone.precision,
        label: 'Start seedlings in nursery',
        ariaLabel: `Start seedlings in nursery — ${date}${labelPrecision(milestone.precision)}`,
      });
    } else if (milestone.kind === 'direct-sow') {
      descriptors.push({
        kind: 'direct-sow-arrow',
        startsOn: milestone.on,
        precision: milestone.precision,
        label: 'Sow in bed',
        ariaLabel: `Sow in bed — ${date}${labelPrecision(milestone.precision)}`,
      });
    } else if (milestone.kind === 'transplant') {
      descriptors.push({
        kind: 'transplant-arrow',
        startsOn: milestone.on,
        precision: milestone.precision,
        label: 'Plant out',
        ariaLabel: `Plant out — ${date}${labelPrecision(milestone.precision)}`,
      });
    }
  }
  for (const phase of calendar.phases) {
    if (phase.kind === 'nursery' && phase.endsOn) {
      descriptors.push({
        kind: 'nursery-link',
        startsOn: phase.startsOn,
        endsOn: phase.endsOn,
        precision: phase.precision,
        label: 'Nursery period',
        ariaLabel: `Nursery period — ${formatCalendarDate(phase.startsOn)} to ${formatCalendarDate(phase.endsOn)}${labelPrecision(phase.precision)}`,
      });
    } else if (phase.kind === 'field-grow') {
      descriptors.push({
        kind: 'field-grow-bar',
        startsOn: phase.startsOn,
        ...(phase.endsOn ? { endsOn: phase.endsOn } : {}),
        precision: phase.precision,
        label: 'Grow in bed',
        ariaLabel: `Grow in bed from ${formatCalendarDate(phase.startsOn)}${labelPrecision(phase.precision)}`,
      });
    } else if (phase.kind === 'harvest-window') {
      descriptors.push({
        kind: 'harvest-window-bar',
        startsOn: phase.startsOn,
        ...(phase.endsOn ? { endsOn: phase.endsOn } : {}),
        precision: phase.precision,
        label: 'Harvest',
        ariaLabel: `Harvest from ${formatCalendarDate(phase.startsOn)}${labelPrecision(phase.precision)}`,
      });
    }
  }
  return descriptors;
}
