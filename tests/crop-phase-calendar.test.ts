import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addCalendarDays,
  buildCropPhaseCalendar,
  timelineDescriptorsForCropPhaseCalendar,
} from '@/lib/crop-phase-calendar';
import type { CropPhaseCalendarInput } from '@/lib/crop-phase-calendar';

const transplantTiming = {
  eligibility: 'verified' as const,
  sowWindows: {},
  nursery: {
    days: [28, 42] as const,
    basis: 'from-nursery-sow' as const,
    precision: 'month-derived' as const,
    sourceIds: ['nursery-source'],
  },
  maturity: {
    days: [70, 70] as const,
    basis: 'from-transplant' as const,
    precision: 'month-derived' as const,
    sourceIds: ['maturity-source'],
  },
};

function transplantInput(overrides: Partial<CropPhaseCalendarInput> = {}): CropPhaseCalendarInput {
  return {
    cropName: 'Cabbage',
    cohort: {
      id: 'cabbage-1',
      cropKey: 'cabbage',
      state: 'proposed',
      sowing: {
        method: 'nursery-transplant',
        startsOn: { year: 2026, month: 8, day: 1 },
        transplantOn: { year: 2026, month: 9, day: 15 },
        precision: 'month-derived',
      },
    },
    timing: transplantTiming,
    ...overrides,
  };
}

test('nursery dot and transplant arrow never claim a bed before plant-out', () => {
  const calendar = buildCropPhaseCalendar(transplantInput());
  const descriptors = timelineDescriptorsForCropPhaseCalendar(calendar);

  assert.deepEqual(calendar.warnings, []);
  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.kind),
    ['nursery-start-dot', 'transplant-arrow', 'nursery-link', 'field-grow-bar', 'harvest-window-bar'],
  );
  const nurseryLink = descriptors.find((descriptor) => descriptor.kind === 'nursery-link');
  const field = descriptors.find((descriptor) => descriptor.kind === 'field-grow-bar');
  const transplant = descriptors.find((descriptor) => descriptor.kind === 'transplant-arrow');
  assert.ok(nurseryLink && field && transplant);
  assert.deepEqual(nurseryLink.endsOn, transplant.startsOn);
  assert.deepEqual(field.startsOn, transplant.startsOn, 'field occupancy starts at the arrow, never at the tray dot');
  assert.match(transplant.ariaLabel, /month estimate/i);
});

test('direct sow has one field-start arrow and no nursery marker', () => {
  const calendar = buildCropPhaseCalendar({
    cohort: {
      id: 'bean-1',
      cropKey: 'green-beans',
      state: 'proposed',
      sowing: {
        method: 'direct-sow',
        startsOn: { year: 2026, month: 11, day: 3 },
        precision: 'exact-day',
      },
    },
    timing: {
      eligibility: 'verified',
      sowWindows: {},
      maturity: {
        days: [56, 63],
        basis: 'from-direct-sow',
        precision: 'exact-day',
        sourceIds: ['bean-source'],
      },
    },
  });
  const descriptors = timelineDescriptorsForCropPhaseCalendar(calendar);

  assert.deepEqual(
    descriptors.map((descriptor) => descriptor.kind),
    ['direct-sow-arrow', 'field-grow-bar', 'harvest-window-bar'],
  );
  assert.deepEqual(descriptors[0].startsOn, descriptors[1].startsOn);
  assert.deepEqual(calendar.milestones[0]?.sourceIds, [], 'a maturity source must not be presented as evidence for a sow date');
});

test('a transplant crop without a committed plant-out date stays an honest nursery estimate', () => {
  const input = transplantInput();
  delete input.cohort.sowing.transplantOn;
  const calendar = buildCropPhaseCalendar(input);
  const descriptors = timelineDescriptorsForCropPhaseCalendar(calendar);

  assert.deepEqual(descriptors.map((descriptor) => descriptor.kind), ['nursery-start-dot']);
  assert.equal(calendar.warnings[0]?.code, 'transplant-date-needed');
  assert.equal(calendar.phases.some((phase) => phase.kind === 'field-grow'), false);
});

test('an observed crop never receives an invented nursery history', () => {
  const input = transplantInput();
  input.cohort.state = 'observed';
  const calendar = buildCropPhaseCalendar(input);

  assert.equal(calendar.warnings[0]?.code, 'observed-history-not-recorded');
  assert.deepEqual(timelineDescriptorsForCropPhaseCalendar(calendar), []);
});

test('date-only phase arithmetic crosses New Year and leap day without browser timezone drift', () => {
  assert.deepEqual(addCalendarDays({ year: 2026, month: 12, day: 30 }, 3), { year: 2027, month: 1, day: 2 });
  assert.deepEqual(addCalendarDays({ year: 2028, month: 2, day: 28 }, 1), { year: 2028, month: 2, day: 29 });
  assert.deepEqual(addCalendarDays({ year: 2028, month: 3, day: 1 }, -1), { year: 2028, month: 2, day: 29 });
});

test('unverified timing does not manufacture a nursery line or harvest date', () => {
  const calendar = buildCropPhaseCalendar({
    ...transplantInput(),
    timing: { eligibility: 'insufficient-evidence', reason: 'No source for nursery duration.' },
  });

  assert.equal(calendar.warnings[0]?.code, 'timing-not-verified');
  assert.deepEqual(timelineDescriptorsForCropPhaseCalendar(calendar), []);
});

test('maturity from nursery sowing never draws a field bar backwards past plant-out', () => {
  const input = transplantInput({
    timing: {
      ...transplantTiming,
      maturity: {
        days: [10, 10],
        basis: 'from-nursery-sow',
        precision: 'exact-day',
        sourceIds: ['short-cycle-source'],
      },
    },
  });
  const calendar = buildCropPhaseCalendar(input);

  assert.equal(calendar.warnings[0]?.code, 'harvest-before-field-start');
  assert.deepEqual(timelineDescriptorsForCropPhaseCalendar(calendar), []);
});
