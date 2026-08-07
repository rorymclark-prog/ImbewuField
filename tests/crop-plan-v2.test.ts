import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CROP_PLAN_V2_VERSION,
  isCropPlanV2,
  normaliseCropPlanV2,
  type CropPlanV2,
} from '@/lib/crop-plan-v2';
import {
  bedSectionId,
  buildBedSections,
  normaliseBedSections,
  sectionWeekResource,
} from '@/lib/crop-bed-sections';

function plan(overrides: Partial<CropPlanV2> = {}): CropPlanV2 {
  const sections = buildBedSections({ bedId: 'bed-1', layoutRevision: 'layout-1', division: 1 })!;
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
    sections,
    cohorts: [{
      id: 'cohort-cabbage',
      cropKey: 'cabbage',
      location: {
        bedId: 'bed-1',
        sectionIds: [sections[0].id],
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
  wrongSection.cohorts[0].location.sectionIds = ['not-a-section'];
  assert.equal(normaliseCropPlanV2(wrongSection), null, 'a cohort must name a section on its own site layout');

  const legacySingularLocation = plan();
  const legacyLocation = legacySingularLocation.cohorts[0].location as unknown as {
    sectionIds?: string[];
    sectionId?: string;
  };
  legacyLocation.sectionId = legacyLocation.sectionIds![0];
  delete legacyLocation.sectionIds;
  assert.equal(normaliseCropPlanV2(legacySingularLocation), null, 'V2 never silently upgrades a singular section reference');

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

test('a V2 cohort can explicitly occupy every labelled section of one bed', () => {
  const sections = buildBedSections({ bedId: 'bed-1', layoutRevision: 'layout-1', division: 2 })!;
  const fullBedCohort = plan({ sections });
  fullBedCohort.cohorts[0].location.sectionIds = sections.map((section) => section.id);

  const decoded = normaliseCropPlanV2(fullBedCohort);
  assert.deepEqual(decoded?.cohorts[0].location.sectionIds, sections.map((section) => section.id));
});

test('a raised bed has one complete, named whole, half, third or quarter layout', () => {
  for (const division of [1, 2, 3, 4] as const) {
    const sections = buildBedSections({ bedId: 'bed-4', layoutRevision: 'rev-2026-08', division });
    assert.ok(sections);
    assert.deepEqual(sections.map((section) => section.label), ['A', 'B', 'C', 'D'].slice(0, division));
    assert.ok(sections.every((section) => section.division === division));
    assert.ok(sections.every((section) => section.share === 1 / division));
    assert.deepEqual(
      sections.map((section) => section.id),
      sections.map((section) => bedSectionId('bed-4', 'rev-2026-08', section.label)),
    );
  }
});

test('a physical section layout rejects arbitrary fractions, partial splits and revision drift', () => {
  const halves = buildBedSections({ bedId: 'bed-4', layoutRevision: 'rev-2026-08', division: 2 })!;
  assert.equal(normaliseBedSections(halves.slice(0, 1)), null, 'A alone cannot masquerade as half a bed');

  const wrongShare = structuredClone(halves);
  wrongShare[0].share = 0.4;
  assert.equal(normaliseBedSections(wrongShare), null, 'a V1-style percentage is not a physical section');

  const anotherRevision = buildBedSections({ bedId: 'bed-4', layoutRevision: 'rev-2026-09', division: 1 })!;
  assert.equal(
    normaliseBedSections([...halves, ...anotherRevision]),
    null,
    'one bed cannot silently use two physical layouts in the same plan',
  );
});

test('section layouts are cloned, canonical and cannot be hand-written with a mismatched identity', () => {
  const input = buildBedSections({ bedId: 'bed:4', layoutRevision: 'rev:1', division: 3 })!;
  const decoded = normaliseBedSections([input[2], input[0], input[1]]);
  assert.ok(decoded);
  assert.notStrictEqual(decoded, input);
  assert.notStrictEqual(decoded[0], input[0]);
  assert.deepEqual(decoded.map((section) => section.label), ['A', 'B', 'C']);

  const mismatchedId = structuredClone(input);
  mismatchedId[0].id = 'bed-4:A';
  assert.equal(normaliseBedSections(mismatchedId), null);
  assert.equal(buildBedSections({ bedId: ' ', layoutRevision: 'rev-1', division: 1 }), null);
  assert.equal(buildBedSections({ bedId: 'bed-4', layoutRevision: 'rev-1', division: 5 as 1 }), null);
});

test('section-week capacity keys are deterministic and cannot collapse distinct places or weeks', () => {
  const [a, b] = buildBedSections({ bedId: 'bed-4', layoutRevision: 'rev-2026-08', division: 2 })!;
  const aWeek3 = sectionWeekResource(a.id, 3);
  assert.equal(sectionWeekResource(a.id, 3), aWeek3);
  assert.notEqual(sectionWeekResource(b.id, 3), aWeek3);
  assert.notEqual(sectionWeekResource(a.id, 4), aWeek3);
  assert.equal(sectionWeekResource(a.id, -1), null);
  assert.equal(sectionWeekResource('', 3), null);
});
