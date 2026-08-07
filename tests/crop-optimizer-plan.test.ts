import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cropTimingEvidenceFromCatalog,
  farmerSummaryLines,
  generateRaisedBedCandidates,
  KZN_DARD_TRANSPLANT_READINESS,
  solveRaisedBedPlan,
  createRaisedBedPlannerEngine,
  weekIndexForDate,
  type RaisedBedSolverInput,
} from '@/lib/crop-optimizer';
import { buildCropPhaseCalendar } from '@/lib/crop-phase-calendar';
import { cropByKey, CROPS } from '@/lib/crop-catalog';
import { buildBedSections } from '@/lib/crop-bed-sections';
import {
  CROP_PLAN_V2_VERSION,
  normaliseCropPlanV2,
  type CropPlanV2,
  type PlannedCohort,
} from '@/lib/crop-plan-v2';

function farm(overrides: Partial<RaisedBedSolverInput> = {}): RaisedBedSolverInput {
  return {
    siteKey: 'site-golden',
    anchorDate: { year: 2026, month: 8, day: 1 },
    horizonWeeks: 26,
    rainPattern: 'mild-frost',
    beds: [{
      bedId: 'bed-1',
      layoutRevision: 'rev-1',
      division: 2,
      areaSqm: 10,
      irrigationConfirmed: true,
    }],
    requestedCropKeys: ['green-beans', 'beetroot', 'coriander'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// §9.3 golden farm fixture — the smallest one
// ---------------------------------------------------------------------------

test('golden fixture: one 10 m² bed, three requested crops, half a year', () => {
  const outcome = solveRaisedBedPlan(farm());

  assert.equal(outcome.plannerResult.status, 'best-found');
  assert.deepEqual(outcome.selectedCandidateIds, [
    'cand:beetroot:bed-1:A:w0008',
    'cand:beetroot:bed-1:B:w0000',
    'cand:coriander:bed-1:A:w0000',
    'cand:coriander:bed-1:B:w0016',
  ]);

  // Objective values are pinned as well as crop names: a plan that keeps the
  // same crops while quietly getting worse is the regression that matters.
  assert.deepEqual(outcome.plannerResult.objective, {
    hardViolations: 0,
    selectedCropPlacements: 4,
    longestFreshFoodGapWeeks: 5,
    idleSectionWeeks: 4,
    cropDiversity: 2,
    operationalTransitions: 8,
    deterministicTieBreak: JSON.stringify(outcome.selectedCandidateIds),
  });

  assert.deepEqual(
    outcome.plannerResult.cohorts.map((cohort) => [
      cohort.cropKey,
      cohort.sowing.method,
      `${cohort.sowing.startsOn.year}-${cohort.sowing.startsOn.month}-${cohort.sowing.startsOn.day}`,
    ]),
    [
      ['beetroot', 'direct-sow', '2026-9-26'],
      ['beetroot', 'direct-sow', '2026-8-1'],
      ['coriander', 'direct-sow', '2026-8-1'],
      ['coriander', 'direct-sow', '2026-11-21'],
    ],
  );

  const breakdown = outcome.breakdown!;
  assert.equal(breakdown.longestFreshGapWeeks, 5);
  assert.equal(breakdown.weeksWithoutFreshHarvest, 7);
  assert.equal(breakdown.peakWeeklyJobs, 2);
  assert.equal(breakdown.raisedBedUtilisation, 48 / 52);
  assert.deepEqual(breakdown.selectedCropCoverage, { met: 2, requested: 3, missing: ['green-beans'] });
  assert.equal(breakdown.totalKgRange, null, 'coriander has no catalog yield, so the plan total stays unknown');
  assert.equal(breakdown.householdSupplyScore, null);
  assert.ok(
    breakdown.unplacedReasons.some((reason) => reason.code === 'crowded-out'),
    'a requested crop that lost to a better-scoring plan must say so',
  );
});

test('golden fixture: harvest weights and household supply appear only when both are known', () => {
  const outcome = solveRaisedBedPlan(farm({
    requestedCropKeys: ['beetroot', 'green-beans'],
    household: { householdSize: 4, kgPerPersonPerWeek: 0.5, sourceIds: ['test-fixture:household-target'] },
  }));

  // Two beetroot cohorts, 5 m² each, at the catalog's 1.4–1.8 kg/m² range.
  assert.deepEqual(outcome.breakdown?.totalKgRange, [14, 18]);
  // The conservative end over 4 people × 0.5 kg × 26 weeks = 52 kg of need.
  assert.equal(outcome.breakdown?.householdSupplyScore, 14 / 52);
  assert.ok(farmerSummaryLines(outcome.breakdown!).some((line) => line.includes('27%')));
});

test('golden fixture: an unmeasured bed reports unknown weights instead of estimating them', () => {
  const outcome = solveRaisedBedPlan(farm({
    beds: [{ bedId: 'bed-1', layoutRevision: 'rev-1', division: 2, irrigationConfirmed: true }],
    requestedCropKeys: ['beetroot'],
    household: { householdSize: 4, kgPerPersonPerWeek: 0.5 },
  }));

  assert.ok(outcome.candidates.length > 0);
  assert.ok(outcome.candidates.every((candidate) => candidate.expectedKgRange === null));
  assert.equal(outcome.breakdown?.totalKgRange, null);
  assert.equal(outcome.breakdown?.householdSupplyScore, null);
  assert.match(outcome.breakdown?.householdSupplyUnknownReason ?? '', /no defensible harvest weight/);
  assert.ok(outcome.plannerResult.explanations.some((entry) => entry.code === 'bed-area-unknown'));
});

// ---------------------------------------------------------------------------
// Hard constraints
// ---------------------------------------------------------------------------

test('an unverified crop can never be scheduled automatically', () => {
  const kale = cropByKey('kale')!;
  assert.equal(kale.timingVerified, false);
  assert.equal(cropTimingEvidenceFromCatalog(kale).eligibility, 'insufficient-evidence');

  const generation = generateRaisedBedCandidates(farm({ requestedCropKeys: ['kale', 'beetroot'] }));
  assert.equal(generation.candidates.some((candidate) => candidate.cropKey === 'kale'), false);
  assert.ok(generation.explanations.some((entry) => entry.code === 'timing-not-verified'));
});

test('a crop with no sowing window in the mapped climate is refused, not shifted', () => {
  const winterCape = generateRaisedBedCandidates(farm({
    rainPattern: 'winter',
    requestedCropKeys: ['maize'],
  }));
  assert.deepEqual(cropByKey('maize')!.sowMonths.winter, []);
  assert.equal(winterCape.candidates.length, 0);
  assert.ok(winterCape.explanations.some((entry) => entry.code === 'no-sow-window-for-climate'));

  const summer = generateRaisedBedCandidates(farm({
    rainPattern: 'summer',
    horizonWeeks: 40,
    requestedCropKeys: ['maize'],
  }));
  const months = new Set(summer.candidates.map((candidate) => candidate.cohort.sowing.startsOn.month));
  assert.ok(months.size > 0);
  for (const month of months) {
    assert.ok(cropByKey('maize')!.sowMonths.summer.includes(month), `month ${month} is outside the catalog window`);
  }
});

test('staple-plot crops are refused by name rather than half-planned as bed crops', () => {
  const generation = generateRaisedBedCandidates(farm({
    rainPattern: 'summer',
    horizonWeeks: 40,
    requestedCropKeys: ['maize', 'beetroot'],
    plotOnlyCropKeys: ['maize'],
  }));
  assert.equal(generation.candidates.some((candidate) => candidate.cropKey === 'maize'), false);
  const refusal = generation.explanations.find((entry) => entry.code === 'plot-only-crop');
  assert.ok(refusal);
  assert.match(refusal.message, /staple-plot solver is a separate/);
});

test('a crop already in the ground keeps its sections, and nothing is planned on top of it', () => {
  const sections = buildBedSections({ bedId: 'bed-1', layoutRevision: 'rev-1', division: 2 })!;
  const observed: PlannedCohort = {
    id: 'observed-chard',
    cropKey: 'swiss-chard',
    location: { bedId: 'bed-1', sectionIds: [sections[0].id], layoutRevision: 'rev-1' },
    sowing: { method: 'direct-sow', startsOn: { year: 2026, month: 6, day: 1 }, precision: 'month-derived' },
    state: 'observed',
  };
  const outcome = solveRaisedBedPlan(farm({
    fixedCohorts: [{ cohort: observed, fieldStartWeek: 0, fieldReleaseWeek: 20, harvestWeeks: [4, 5, 6, 7, 8] }],
  }));

  assert.equal(outcome.plannerResult.status, 'best-found');
  for (const cohort of outcome.plannerResult.cohorts) {
    if (!cohort.location.sectionIds.includes(sections[0].id)) continue;
    const candidate = outcome.candidates.find((entry) => entry.cohort.id === cohort.id)!;
    assert.ok(
      candidate.fieldStartWeek >= 20,
      `${cohort.cropKey} was placed on ground the farmer already has planted (week ${candidate.fieldStartWeek})`,
    );
  }
  assert.equal(
    outcome.plannerResult.cohorts.some((cohort) => cohort.id === observed.id),
    false,
    'a fixed cohort is not a candidate and must not be re-proposed',
  );
});

test('a known nursery capacity limits how many trays run at once', () => {
  const base = farm({
    horizonWeeks: 40,
    requestedCropKeys: ['lettuce'],
    beds: [{ bedId: 'bed-1', layoutRevision: 'rev-1', division: 4, areaSqm: 10, irrigationConfirmed: true }],
  });
  const unlimited = solveRaisedBedPlan(base);
  const limited = solveRaisedBedPlan({ ...base, nursery: { nurseryId: 'nursery-1', concurrentCohorts: 1 } });

  const overlaps = (outcome: typeof unlimited) => {
    const weeks = new Map<number, number>();
    for (const id of outcome.selectedCandidateIds) {
      const candidate = outcome.candidates.find((entry) => entry.id === id)!;
      if (candidate.nurseryStartWeek === undefined) continue;
      for (let week = candidate.nurseryStartWeek; week < candidate.fieldStartWeek; week++) {
        weeks.set(week, (weeks.get(week) ?? 0) + 1);
      }
    }
    return Math.max(0, ...weeks.values());
  };

  assert.ok(unlimited.selectedCandidateIds.length > 1);
  assert.ok(overlaps(unlimited) > 1, 'without a recorded nursery, nothing constrains concurrent trays');
  assert.equal(overlaps(limited), 1);
  assert.ok(unlimited.plannerResult.explanations.some((entry) => entry.code === 'nursery-capacity-unknown'));
});

test('every proposed cohort survives the V2 plan decoder, sections and all', () => {
  const input = farm();
  const generation = generateRaisedBedCandidates(input);
  const outcome = solveRaisedBedPlan(input);
  const plan: CropPlanV2 = {
    version: CROP_PLAN_V2_VERSION,
    id: 'plan-golden',
    siteKey: input.siteKey,
    timezone: 'Africa/Johannesburg',
    anchorDate: input.anchorDate,
    horizonWeeks: input.horizonWeeks,
    layoutFingerprint: 'rev-1',
    rainPattern: input.rainPattern,
    status: 'proposed',
    sections: generation.sections,
    cohorts: outcome.plannerResult.cohorts,
    generation: {
      engine: 'v2',
      version: 'crop-optimizer-raised-bed-v1',
      generatedAt: 1,
      objective: outcome.plannerResult.objective!,
    },
    createdAt: 1,
    updatedAt: 1,
  };

  const decoded = normaliseCropPlanV2(plan);
  assert.ok(decoded, 'the optimiser must only ever emit cohorts the foundation accepts');
  assert.equal(decoded.cohorts.length, outcome.plannerResult.cohorts.length);
});

test('a transplanted crop gets nursery, plant-out and harvest; a direct-sown one does not', () => {
  const lettuce = cropByKey('lettuce')!;
  assert.equal(lettuce.transplant, true);
  const timing = cropTimingEvidenceFromCatalog(lettuce);
  assert.equal(timing.eligibility, 'verified');
  if (timing.eligibility !== 'verified') return;
  assert.deepEqual(timing.nursery, KZN_DARD_TRANSPLANT_READINESS);
  assert.equal(timing.maturity.basis, 'from-transplant');

  const generation = generateRaisedBedCandidates(farm({ horizonWeeks: 40, requestedCropKeys: ['lettuce', 'beetroot'] }));
  const transplanted = generation.candidates.find((candidate) => candidate.cropKey === 'lettuce')!;
  const directSown = generation.candidates.find((candidate) => candidate.cropKey === 'beetroot')!;

  assert.equal(transplanted.cohort.sowing.method, 'nursery-transplant');
  assert.ok(transplanted.cohort.sowing.transplantOn);
  assert.equal(transplanted.nurseryStartWeek, weekIndexForDate(farm().anchorDate, transplanted.cohort.sowing.startsOn));
  assert.ok(transplanted.fieldStartWeek > transplanted.nurseryStartWeek!);

  assert.equal(directSown.cohort.sowing.method, 'direct-sow');
  assert.equal(directSown.cohort.sowing.transplantOn, undefined);
  assert.equal(directSown.nurseryStartWeek, undefined);

  // The generator never emits a cohort the V2 phase calendar would complain
  // about — that is how the declared timing basis is actually enforced.
  for (const candidate of generation.candidates.slice(0, 40)) {
    const crop = cropByKey(candidate.cropKey)!;
    const calendar = buildCropPhaseCalendar({
      cohort: candidate.cohort,
      timing: cropTimingEvidenceFromCatalog(crop),
      rainPattern: 'mild-frost',
      cropName: crop.name,
    });
    assert.deepEqual(calendar.warnings, [], `${candidate.id} would have produced a phase-calendar warning`);
  }
});

test('bare ground is only counted against a plan where irrigation is confirmed', () => {
  const watered = solveRaisedBedPlan(farm());
  const unwatered = solveRaisedBedPlan(farm({
    beds: [{ bedId: 'bed-1', layoutRevision: 'rev-1', division: 2, areaSqm: 10 }],
  }));

  assert.ok(watered.plannerResult.objective!.idleSectionWeeks > 0);
  assert.equal(unwatered.plannerResult.objective!.idleSectionWeeks, 0);
  assert.equal(unwatered.breakdown?.raisedBedUtilisation, null);
  assert.ok(farmerSummaryLines(unwatered.breakdown!).some((line) => line.includes('confirmed irrigation')));
});

// ---------------------------------------------------------------------------
// Honesty about what is not known
// ---------------------------------------------------------------------------

test('no candidate claims to know a water requirement the catalog does not record', () => {
  const generation = generateRaisedBedCandidates(farm({ horizonWeeks: 52, requestedCropKeys: undefined }));
  assert.ok(generation.candidates.length > 100);
  assert.deepEqual(
    [...new Set(generation.candidates.map((candidate) => candidate.waterClass))],
    ['unknown'],
    'the crop catalog has no per-crop water figure; a placeholder here would be an invented number',
  );
});

test('a multi-week picking window reports no per-week kilograms', () => {
  const generation = generateRaisedBedCandidates(farm({ requestedCropKeys: ['beetroot'] }));
  const candidate = generation.candidates[0];
  assert.ok(candidate.harvestProfileByWeek.length > 1);
  assert.deepEqual(
    [...new Set(candidate.harvestProfileByWeek.map((entry) => entry.kgLow))],
    [null],
    'splitting a cohort total across its picking weeks is not something the catalog supports',
  );
  assert.deepEqual(candidate.expectedKgRange, [7, 9]);
});

test('the breakdown separates the tiers that ranked the plan from the figures that did not', () => {
  const outcome = solveRaisedBedPlan(farm());
  const breakdown = outcome.breakdown!;

  assert.deepEqual(breakdown.rankedBy.map((tier) => tier.key), [
    'selectedCropPlacements',
    'longestFreshFoodGapWeeks',
    'idleSectionWeeks',
    'cropDiversity',
    'operationalTransitions',
  ]);
  assert.deepEqual(breakdown.reportedOnly.map((figure) => figure.key), [
    'householdSupplyScore',
    'peakWeeklyJobs',
    'saleKgPerBedWeek',
  ]);
  assert.equal(breakdown.saleKgPerBedWeek, null, 'nothing is assigned to sale in this pass');
  for (const figure of breakdown.reportedOnly) {
    assert.ok(figure.whyNotRanked.length > 40, `${figure.key} must say why it did not decide anything`);
  }
});

/**
 * A recorded limit, not a passing grade.
 *
 * With no requested crop list, `selectedCropPlacements` counts every placement
 * and outranks `cropDiversity`, so the plan fills the beds with whatever has
 * the shortest cycle. That is the ordering the V2 foundation committed to, and
 * it is exactly what the rebuild spec's first goal — minimising unmet household
 * food need — exists to correct. This test pins the behaviour so the day that
 * tier is added, the change is visible here rather than surprising.
 */
test('KNOWN LIMIT: with no crops requested, the placement tier favours short-cycle crops', () => {
  const outcome = solveRaisedBedPlan(farm({ horizonWeeks: 52, requestedCropKeys: undefined }));
  const counts = new Map<string, number>();
  for (const cohort of outcome.plannerResult.cohorts) {
    counts.set(cohort.cropKey, (counts.get(cohort.cropKey) ?? 0) + 1);
  }
  const [topCrop, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const total = outcome.plannerResult.cohorts.length;

  assert.ok(topCount / total > 0.5, 'today one short crop dominates the plan');
  assert.equal(cropByKey(topCrop)!.daysToHarvest <= 60, true);
  assert.equal(
    outcome.breakdown?.householdSupplyScore,
    null,
    'and nothing in the ranking notices, because household supply is reported only',
  );
});

// ---------------------------------------------------------------------------
// Interrogating a whole farm's output, not just a fixture's
// ---------------------------------------------------------------------------

/**
 * The small fixtures are checked against a proven optimum; a nine-bed farm
 * cannot be. So this one checks the plan a farmer would actually be handed,
 * against the physical facts it claims: no two crops on the same ground in the
 * same week, no sowing outside the catalog window, no nursery over its stated
 * capacity, no immediate botanical repeat on one section.
 *
 * It earns its place. Written against an earlier version of the search it
 * found a plan of 31 cohorts that put one year-long crop in every section,
 * because the beam decided placements in alphabetical order.
 */
test('a nine-bed farm plan holds every physical fact it claims', () => {
  const beds = Array.from({ length: 9 }, (_, index) => ({
    bedId: `bed-${index + 1}`,
    layoutRevision: 'rev-1',
    division: ((index % 4) + 1) as 1 | 2 | 3 | 4,
    areaSqm: 10,
    irrigationConfirmed: index < 6,
  }));
  const input = farm({
    siteKey: 'site-nine-beds',
    horizonWeeks: 52,
    beds,
    requestedCropKeys: undefined,
    nursery: { nurseryId: 'nursery-1', concurrentCohorts: 3 },
  });
  const outcome = solveRaisedBedPlan(input);
  assert.equal(outcome.plannerResult.status, 'best-found');

  const chosen = outcome.selectedCandidateIds.map(
    (id) => outcome.candidates.find((candidate) => candidate.id === id)!,
  );
  assert.ok(chosen.length > 40, `a nine-bed farm should carry a real plan (was ${chosen.length} cohorts)`);

  const heldBy = new Map<string, string>();
  const traysInWeek = new Map<number, number>();
  const bySection = new Map<string, { family: string; from: number; until: number }[]>();
  for (const candidate of chosen) {
    for (let week = candidate.fieldStartWeek; week < candidate.fieldReleaseWeek; week++) {
      for (const sectionId of candidate.sectionIds) {
        const key = `${sectionId}#${week}`;
        assert.equal(heldBy.get(key), undefined, `${key} is claimed by two crops at once`);
        heldBy.set(key, candidate.id);
      }
    }
    for (const sectionId of candidate.sectionIds) {
      const runs = bySection.get(sectionId) ?? [];
      runs.push({
        family: candidate.rotationFamily,
        from: candidate.fieldStartWeek,
        until: candidate.fieldReleaseWeek,
      });
      bySection.set(sectionId, runs);
    }
    if (candidate.nurseryStartWeek !== undefined) {
      for (let week = candidate.nurseryStartWeek; week < candidate.fieldStartWeek; week++) {
        traysInWeek.set(week, (traysInWeek.get(week) ?? 0) + 1);
      }
    }
    assert.ok(
      cropByKey(candidate.cropKey)!.sowMonths['mild-frost'].includes(candidate.cohort.sowing.startsOn.month),
      `${candidate.id} sows outside its own catalog window`,
    );
    assert.ok(candidate.fieldReleaseWeek <= 52, `${candidate.id} runs past the end of the plan`);
  }

  for (const [week, trays] of traysInWeek) {
    assert.ok(trays <= 3, `week ${week} needs ${trays} nursery trays but only 3 were recorded`);
  }
  for (const [sectionId, runs] of bySection) {
    runs.sort((a, b) => a.from - b.from);
    for (let index = 1; index < runs.length; index++) {
      const previous = runs[index - 1];
      const next = runs[index];
      assert.ok(
        next.family !== previous.family || next.from >= previous.until + 1,
        `${sectionId} follows ${previous.family} straight with ${next.family}`,
      );
    }
  }

  // The candidate cap is a real limit on a farm this size. It must be stated.
  assert.ok(outcome.candidates.length <= 3000);
  assert.ok(outcome.plannerResult.explanations.some((entry) => entry.code === 'candidate-cap-reached'));
});

test('a bed the farmer plants whole gets one cohort across all of its sections', () => {
  const outcome = solveRaisedBedPlan(farm({
    beds: [{
      bedId: 'bed-1',
      layoutRevision: 'rev-1',
      division: 3,
      areaSqm: 12,
      irrigationConfirmed: true,
      plantWholeBed: true,
    }],
    requestedCropKeys: ['beetroot'],
  }));

  assert.ok(outcome.plannerResult.cohorts.length > 0);
  for (const cohort of outcome.plannerResult.cohorts) {
    assert.equal(cohort.location.sectionIds.length, 3, 'a whole-bed placement occupies every section of the bed');
  }
  // Yield follows the whole bed's area, not a section's.
  assert.deepEqual(outcome.candidates[0].expectedKgRange, [12 * 1.4, 12 * 1.8]);
});

test('a search that runs out of budget says so instead of presenting a full result', () => {
  const outcome = solveRaisedBedPlan(farm({ horizonWeeks: 52, requestedCropKeys: undefined }), {
    maxScoreEvaluations: 40,
  });
  assert.equal(outcome.plannerResult.status, 'best-found');
  assert.equal(outcome.diagnostics?.hitEvaluationBudget, true);
  assert.ok(outcome.plannerResult.explanations.some((entry) => entry.code === 'evaluation-budget-reached'));
});

// ---------------------------------------------------------------------------
// Contract surface
// ---------------------------------------------------------------------------

test('the engine contract returns a foundation-shaped result and refuses bad input', () => {
  const engine = createRaisedBedPlannerEngine();
  assert.equal(engine.id, 'crop-optimizer-raised-bed-v1');

  const good = engine.suggest(farm());
  assert.equal(good.status, 'best-found');
  assert.ok(good.diagnostics.candidateCount > 0);
  assert.ok(good.objective);

  const noSite = engine.suggest(farm({ siteKey: '' }));
  assert.equal(noSite.status, 'not-run');
  assert.equal(noSite.objective, null);
  assert.ok(noSite.explanations.some((entry) => entry.code === 'site-required'));

  const noBeds = engine.suggest(farm({ beds: [] }));
  assert.equal(noBeds.status, 'not-run');
  assert.ok(noBeds.explanations.some((entry) => entry.code === 'no-raised-beds'));
});

test('a required crop with no legal placement is infeasible rather than quietly dropped', () => {
  const outcome = solveRaisedBedPlan(farm({
    horizonWeeks: 12,
    requestedCropKeys: ['coriander'],
    requiredCropKeys: ['amadumbe'],
  }));
  assert.equal(outcome.plannerResult.status, 'infeasible');
  assert.equal(outcome.plannerResult.objective, null);
  assert.ok(outcome.plannerResult.explanations.some(
    (entry) => entry.code === 'required-crop-has-no-legal-placement',
  ));
});

test('every catalog crop either produces evidence or states what is missing', () => {
  for (const crop of CROPS) {
    const timing = cropTimingEvidenceFromCatalog(crop);
    if (timing.eligibility === 'insufficient-evidence') {
      assert.ok(timing.reason.length > 10, `${crop.key} must say why it cannot be scheduled`);
      continue;
    }
    assert.ok(timing.maturity.sourceIds.includes(`crop-catalog:${crop.key}`));
    assert.equal(timing.maturity.days[0] <= timing.maturity.days[1], true);
    assert.equal(
      timing.maturity.basis,
      crop.transplant ? 'from-transplant' : 'from-direct-sow',
      `${crop.key} must measure maturity from the phase its own source measures from`,
    );
    if (crop.transplant) assert.ok(timing.nursery, `${crop.key} is tray-grown and needs nursery evidence`);
    if (timing.harvest) {
      assert.equal(timing.harvest.basis, timing.maturity.basis);
      assert.ok(timing.harvest.days[1] >= timing.maturity.days[1]);
    }
  }
});
