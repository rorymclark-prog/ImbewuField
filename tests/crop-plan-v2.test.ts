import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CROP_PLAN_V2_VERSION,
  isCropPlanV2,
  normaliseCropPlanV2,
  type CropPlanV2,
} from '@/lib/crop-plan-v2';

function plan(overrides: Partial<CropPlanV2> = {}): CropPlanV2 {
  return {
    version: CROP_PLAN_V2_VERSION,
    id: 'plan-ubhejane-2026',
    siteKey: 'site-ubhejane',
    timezone: 'Africa/Johannesburg',
    anchorDate: { year: 2026, month: 8, day: 1 },
    horizonWeeks: 52,
    layoutFingerprint: 'layout-1',
    rainPattern: 'mild-frost',
    status: 'draft',
    sections: [{
      id: 'bed-1:whole:layout-1',
      bedId: 'bed-1',
      layoutRevision: 'layout-1',
      label: 'Bed 1',
    }],
    cohorts: [{
      id: 'cohort-cabbage',
      cropKey: 'cabbage',
      location: {
        bedId: 'bed-1',
        sectionId: 'bed-1:whole:layout-1',
        layoutRevision: 'layout-1',
      },
      sowing: {
        method: 'nursery-transplant',
        startsOn: { year: 2026, month: 8, day: 1 },
        transplantOn: { year: 2026, month: 9, day: 1 },
        precision: 'month-derived',
      },
      state: 'proposed',
    }],
    generation: {
      engine: 'v2',
      version: 'foundation',
      generatedAt: 1,
      objective: {
        hardViolations: 0,
        selectedCropPlacements: 1,
        longestFreshFoodGapWeeks: 4,
        idleSectionWeeks: 0,
        cropDiversity: 1,
        operationalTransitions: 1,
        deterministicTieBreak: 'cohort-cabbage',
      },
    },
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test('a V2 plan is explicitly site-scoped, versioned and cloned at its boundary', () => {
  const input = plan();
  const decoded = normaliseCropPlanV2(input);

  assert.ok(decoded);
  assert.equal(decoded.siteKey, 'site-ubhejane');
  assert.equal(decoded.version, CROP_PLAN_V2_VERSION);
  assert.notStrictEqual(decoded, input);
  assert.notStrictEqual(decoded.anchorDate, input.anchorDate);
  input.anchorDate.day = 2;
  assert.equal(decoded.anchorDate.day, 1, 'the V2 boundary must not retain caller-owned plan objects');
});

test('a V2 decoder refuses ambiguous site, section and cohort ownership instead of coercing it', () => {
  assert.equal(normaliseCropPlanV2({ version: 1, plantings: [] }), null, 'V1 is never silently converted');
  assert.equal(normaliseCropPlanV2(plan({ siteKey: '' })), null, 'a plan without a farm cannot place physical sections');

  const duplicateSection = plan();
  duplicateSection.sections.push({ ...duplicateSection.sections[0] });
  assert.equal(normaliseCropPlanV2(duplicateSection), null, 'two physical layouts cannot share a section id');

  const duplicateCohort = plan();
  duplicateCohort.cohorts.push({ ...duplicateCohort.cohorts[0] });
  assert.equal(normaliseCropPlanV2(duplicateCohort), null, 'two planned cohorts cannot share an id');

  const wrongSection = plan();
  wrongSection.cohorts[0].location.sectionId = 'not-a-section';
  assert.equal(normaliseCropPlanV2(wrongSection), null, 'a cohort must name a section on its own site layout');

  const reversedTransplant = plan();
  reversedTransplant.cohorts[0].sowing.transplantOn = { year: 2026, month: 7, day: 31 };
  assert.equal(normaliseCropPlanV2(reversedTransplant), null, 'a farm plan cannot plant out before a tray is started');
});

test('a V2 plan never reuses an arbitrary V1 fraction as physical geometry', () => {
  const legacyFraction = {
    id: 'old-row',
    bedId: 'bed-1',
    cropKey: 'cabbage',
    sowMonth: 8,
    areaFraction: 0.5,
  };
  const before = structuredClone(legacyFraction);

  assert.equal(isCropPlanV2(legacyFraction), false);
  assert.deepEqual(legacyFraction, before, 'checking V2 compatibility must not alter a farmer’s V1 row');
});
