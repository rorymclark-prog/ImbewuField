// The promises the staple plots make, pinned.
//
// All of these come from one owner report (2026-08-04): "the staple crop section
// allocated everything but staple crops... why do we plant swiss chard in so many
// beds, why is maize planted in the raised beds and no staple plots". Each test below
// is one of those sentences turned into something that fails loudly.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CROPS,
  cropByKey,
  hasAutomaticPlanningBasis,
  hasPlanningYield,
  hasVerifiedFieldPlan,
  hasVerifiedSchedule,
} from '@/lib/crop-catalog';
import { occupiedMonthsForPlanting, type Planting, type PlanBed } from '@/lib/crop-plan';
import { autoSuggestPlan, fillFirstSeasonGaps } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers } from '@/lib/crop-autosuggest';
import { suggestIdealYearPlan } from '@/lib/crop-plan-ideal';
import {
  STAPLE_CROPS_BY_COURSE,
  STAPLE_COURSE_SEQUENCE,
  STAPLE_CROP_KEYS,
  PLOT_WINTER_COVER_KEYS,
  isPlotWinterCover,
  isStapleCrop,
  plotPool,
  plotWinterCovers,
  stapleCourseOf,
} from '@/lib/staple-crops';

/** The owner's real farm: seven 1.2m-wide raised beds and four traced staple plots. */
function ubhejaneFixture(): PlanBed[] {
  const beds: PlanBed[] = [];
  for (let i = 1; i <= 7; i++) beds.push({ id: `bed-${i}`, label: `Bed ${i}`, areaM2: 12, minDimM: 1.2 });
  for (let i = 1; i <= 4; i++) beds.push({ id: `plot-${i}`, label: `Plot ${i}`, areaM2: 21, minDimM: 3.5, kind: 'plot' });
  return beds;
}

const BASE: AutoSuggestAnswers = {
  goal: 'family',
  householdSize: 'medium',
  focusCropCount: 2,
  groups: [],
  rhythm: 'steady',
  rotateCrops: true,
  allowVinesInBeds: false,
  reliableIrrigation: true,
};

const isPlot = (bedId: string): boolean => bedId.startsWith('plot-');

test('every staple key names a crop that actually exists in the catalog', () => {
  // A catalog rename would otherwise empty a whole course in silence, and the plots
  // would quietly go back to being planned like veg beds.
  for (const [course, keys] of Object.entries(STAPLE_CROPS_BY_COURSE)) {
    assert.ok(keys.length > 0, `${course} has no crops`);
    for (const key of keys) {
      assert.ok(cropByKey(key), `${course} names '${key}', which is not in the catalog`);
    }
  }
  for (const key of PLOT_WINTER_COVER_KEYS) {
    assert.ok(cropByKey(key), `winter cover names '${key}', which is not in the catalog`);
  }
  assert.equal(new Set(STAPLE_CROP_KEYS).size, STAPLE_CROP_KEYS.length, 'a crop is listed in two courses');
  assert.equal(STAPLE_COURSE_SEQUENCE.length, Object.keys(STAPLE_CROPS_BY_COURSE).length);
});

test('the staple set holds the food a household stores, and nothing it eats as salad', () => {
  // The distinction is the whole point of the file. Watermelon is the specific crop
  // that used to win a whole plot: it out-yields pumpkin and butternut, so as a
  // "fruiting veg" it beat them every time — while keeping barely a month.
  for (const key of ['maize', 'dry-beans', 'groundnuts', 'sweet-potato', 'amadumbe', 'potato', 'pumpkin', 'butternut']) {
    assert.ok(isStapleCrop(cropByKey(key)!), `${key} should be a staple`);
  }
  for (const key of ['watermelon', 'carrots', 'cabbage', 'swiss-chard', 'onions', 'lettuce', 'green-beans', 'tomatoes']) {
    assert.ok(!isStapleCrop(cropByKey(key)!), `${key} should NOT be a staple`);
  }
});

test('a staple plot only ever grows a staple or its winter cover — in every scenario', () => {
  // The original bug was not one bad pass, it was four passes that each had their own
  // idea of what a plot was for, so this sweeps the settings rather than testing one run.
  const beds = ubhejaneFixture();
  const offenders: string[] = [];
  let plotPlantings = 0;
  for (const goal of ['family', 'commercial', 'hybrid'] as const) {
    for (const householdSize of ['small', 'medium', 'large'] as const) {
      for (const rotateCrops of [true, false]) {
        for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
          const res = autoSuggestPlan({ ...BASE, goal, householdSize, rotateCrops }, 'mild-frost', beds, [], nowMonth);
          for (const p of res.plantings) {
            if (!isPlot(p.bedId)) continue;
            plotPlantings++;
            const crop = cropByKey(p.cropKey)!;
            const allowed = isStapleCrop(crop) || PLOT_WINTER_COVER_KEYS.includes(crop.key);
            if (!allowed) offenders.push(`${goal}/${householdSize}/rot=${rotateCrops}/now=${nowMonth}: ${p.bedId} got ${p.cropKey}`);
          }
        }
      }
    }
  }
  assert.ok(plotPlantings > 0, 'the sweep planted nothing on any plot — the test is not testing anything');
  assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} non-staple plot plantings`);
});

test('a plot takes one crop at full area — never a half or a third of a field', () => {
  const beds = ubhejaneFixture();
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], nowMonth);
    for (const p of res.plantings) {
      if (!isPlot(p.bedId)) continue;
      assert.equal(p.areaFraction, undefined, `${p.bedId} ${p.cropKey} (sow ${p.sowMonth}) took a fraction of a plot`);
    }
  }
});

test('source-backed grain maize enters a staple plot but never a vegetable bed', () => {
  // DALRRD now supplies the 120-140 day warm period and the paired 0.91m x
  // 25cm irrigated stand. That resolves scheduling, while the map still cannot
  // prove a wind-pollinating block in an ordinary vegetable bed.
  const maize = cropByKey('maize');
  assert.ok(maize);
  assert.deepEqual(maize.daysToHarvestRange, [120, 140]);
  assert.equal(maize.rowSpacingCm, 91);
  assert.equal(maize.inRowSpacingCm, 25);
  assert.equal(hasVerifiedFieldPlan(maize), true);
  assert.equal(plotPool(CROPS).some((crop) => crop.key === maize.key), true);

  const grounds: PlanBed[] = [
    { id: 'wide', label: 'Wide bed', areaM2: 40, minDimM: 4 },
    { id: 'plot', label: 'Staple plot', areaM2: 400, minDimM: 10, kind: 'plot' },
  ];
  const result = autoSuggestPlan({ ...BASE, cropKeys: ['maize'], groups: [] }, 'mild-frost', grounds, [], 10);
  assert.ok(result.plantings.some((planting) => planting.cropKey === 'maize' && planting.bedId === 'plot'));
  assert.ok(result.plantings.every((planting) => planting.bedId !== 'wide'));
});

test('no single crop occupies the whole garden at the same time', () => {
  // "why do we plant swiss chard in so many beds" is a simultaneous land-use
  // question, not a ban on using the same crop in each bed at different points in a
  // twelve-month rotation. Counting every bed a crop ever touches mislabels healthy
  // succession as monoculture and fights the owner's separate request to use the
  // available space. The invariant that can actually protect the farmer is that,
  // whenever several selected crops fit, no one crop owns every veg bed at once.
  const beds = ubhejaneFixture();
  const vegBedCount = beds.filter((b) => b.kind !== 'plot').length;
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], nowMonth);
    for (let calendarMonth = 1; calendarMonth <= 12; calendarMonth++) {
      const bedsPerCrop = new Map<string, Set<string>>();
      for (const p of res.plantings) {
        if (isPlot(p.bedId) || !occupiedMonthsForPlanting(p).includes(calendarMonth)) continue;
        if (!bedsPerCrop.has(p.cropKey)) bedsPerCrop.set(p.cropKey, new Set());
        bedsPerCrop.get(p.cropKey)!.add(p.bedId);
      }
      for (const [cropKey, bedSet] of bedsPerCrop) {
        assert.ok(
          bedSet.size < vegBedCount,
          `now=${nowMonth}, month=${calendarMonth}: ${cropKey} occupied ${bedSet.size} of ${vegBedCount} veg beds at once`,
        );
      }
    }
  }
});

test('the plan uses verified-yield food crops, with only the declared zero-food plot cover exception', () => {
  // The old diversity gate rewarded using 15+ crops in one plan, which is how
  // an unsourced coriander figure could enter merely to make the catalog look
  // well represented. A plan should use crops this household chose, not spend
  // bed space proving every catalog entry is reachable.
  const beds = ubhejaneFixture();
  for (const nowMonth of [2, 8, 11]) {
    const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], nowMonth);
    const unsupported = res.plantings.filter((planting) => {
      const crop = cropByKey(planting.cropKey)!;
      const bed = beds.find((candidate) => candidate.id === planting.bedId);
      return !hasPlanningYield(crop)
        && !(crop.yieldKgPerM2 === 0 && bed?.kind === 'plot' && isPlotWinterCover(crop));
    });
    assert.deepEqual(unsupported, [], `now=${nowMonth}: an unverified food crop entered auto-suggest`);
  }

  const chosen = ['cabbage', 'carrots', 'green-beans'];
  const restricted = autoSuggestPlan({
    ...BASE,
    // Exact choices are the authority even if a stale UI category filter no
    // longer contains them; the engine must neither erase nor substitute them.
    groups: ['fruiting_veg'],
    cropKeys: chosen,
  }, 'mild-frost', beds, [], 8);
  assert.ok(restricted.plantings.length > 0);
  for (const planting of restricted.plantings) {
    assert.ok(chosen.includes(planting.cropKey), `${planting.cropKey} was substituted outside the household's list`);
  }
});

test('four plots use every supported staple course before one course repeats', () => {
  // The catalog names four conceptual courses, but unsupported grain maize
  // must not be revived merely to make four plot labels different.
  //
  // Measured on each plot's MAIN course, not on whatever it happens to sow first. A plot's
  // year is one staple crop in its season plus, optionally, a legume cover over winter —
  // and the cover is sown EARLIER in the calendar than the summer staple it protects the
  // ground for, so "first by sow month" would report the cover on every plot.
  const beds = ubhejaneFixture();
  const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], 8);
  const courseByPlot = new Map<string, string>();
  for (const p of res.plantings) {
    if (!isPlot(p.bedId)) continue;
    const course = stapleCourseOf(cropByKey(p.cropKey)!);
    if (!course) continue; // the winter cover holds no course
    assert.ok(!courseByPlot.has(p.bedId), `${p.bedId} was given two staple courses in one year`);
    courseByPlot.set(p.bedId, course);
  }
  assert.equal(courseByPlot.size, 4, 'not every plot got a staple course');
  const courses = [...courseByPlot.values()];
  const supportedCourses = new Set(
    STAPLE_CROP_KEYS
      .map((key) => cropByKey(key)!)
      .filter(hasAutomaticPlanningBasis)
      .map((crop) => stapleCourseOf(crop)!),
  );
  assert.deepEqual(
    new Set(courses),
    supportedCourses,
    `plots took ${courses.join(', ')} instead of exhausting the supported courses`,
  );
});

test('a post-legume staple plot receives the sourced KZN oats winter cover', () => {
  // KZN DARD names oats as a winter cover in maize lands, its Cedara trial
  // supplies the autumn-to-soft-dough duration, and the pasture guide supplies
  // a kg/ha field rate. It is cover, not a fabricated kitchen harvest.
  const covers = plotWinterCovers(CROPS);
  assert.ok(covers.length, 'no winter cover crops are declared at all');
  const oats = cropByKey('oats')!;
  assert.equal(oats.daysToHarvest, 166);
  assert.deepEqual(oats.seedRateKgPerHaRange, [70, 140]);
  assert.equal(PLOT_WINTER_COVER_KEYS.includes(oats.key), true);
  assert.equal(isPlotWinterCover(oats), true);
  assert.equal(hasVerifiedSchedule(oats), true);
  assert.equal(covers.some((crop) => crop.key === oats.key), true);

  const result = autoSuggestPlan(BASE, 'mild-frost', ubhejaneFixture(), [], 8);
  const dryBeanPlot = result.plantings.find((planting) => planting.cropKey === 'dry-beans')?.bedId;
  assert.ok(dryBeanPlot, 'the four-course fixture did not allocate its pulse course');
  assert.equal(
    result.plantings.some((planting) => planting.cropKey === 'oats' && planting.bedId === dryBeanPlot),
    true,
    'a legume plot should receive the non-legume KZN winter cover rather than another bean',
  );
});

test('every automatic winter cover has verified timing and either food geometry or a field seed rate', () => {
  const covers = plotWinterCovers(CROPS);
  assert.ok(covers[0] && hasPlanningYield(covers[0]), 'the first-choice winter cover must have a verified household-food yield');
  for (const cover of covers) {
    assert.equal(hasVerifiedSchedule(cover), true, `${cover.key} has no defensible automatic schedule`);
    assert.ok(
      (hasPlanningYield(cover) && hasVerifiedFieldPlan(cover))
        || (cover.yieldKgPerM2 === 0 && cover.seedRateKgPerHaRange !== undefined),
      `${cover.key} has neither food-crop geometry nor a sourced cover-crop seed rate`,
    );
  }
});

// ---- fillFirstSeasonGaps: a courseless plot must never spend two staple ----
// ---- courses across the starter-placement loop's turns --------------------
//
// The bug: bedPool (which narrows once a course is claimed) was computed ONCE
// per bed before the placement loop, from a plotsWithCourse snapshot taken
// before any starter had landed. A courseless plot could therefore be handed
// a full staple pool on every turn of the loop and walk out with two staple
// courses of one-time starters in a single first-season fill. The fix
// re-derives bedPool inside the loop and has each landing starter claim the
// plot's course the moment it commits, mirroring the main planner's own
// plotsWithCourse predicate at its staple-claim site.

const coursesOn = (rows: readonly Planting[], bedId: string): string[] => rows
  .filter((r) => r.bedId === bedId)
  .map((r) => stapleCourseOf(cropByKey(r.cropKey)!))
  .filter(Boolean) as string[];

const FILL_BEDS: PlanBed[] = [
  { id: 'bed-1', label: 'Bed 1', areaM2: 9, minDimM: 1.5 },
  { id: 'plot-1', label: 'Plot 1', areaM2: 120, minDimM: 8, kind: 'plot' },
];
const FILL_CYCLE: Planting[] = [{ id: 'c1', bedId: 'bed-1', cropKey: 'swiss-chard', sowMonth: 3 }];
const FILL_ANSWERS: AutoSuggestAnswers = {
  goal: 'family', groups: [], rhythm: 'few-big', rotateCrops: true,
  allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
};

test('a starter never spends a second staple course on one plot', () => {
  // BEFORE the fix this plot walked out with dry-beans@1[pulse] AND
  // potato@8[tuber] — two staple courses of one-time starters from a single
  // fill pass, because the hoisted bedPool never saw the first starter's
  // claim. AFTER the fix it stops at the first course.
  const fill = fillFirstSeasonGaps(
    { ...FILL_ANSWERS, cropKeys: ['potato', 'dry-beans', 'swiss-chard'] },
    'summer', FILL_BEDS, FILL_CYCLE, [], 1, 2026,
  );
  assert.deepEqual(coursesOn(fill.starters, 'plot-1'), ['pulse']);
});

test("a winter-cover starter leaves the plot's food course still to spend (anti-over-fix guard)", () => {
  // This is the test that stops the next person over-fixing by claiming on
  // ANY starter (cover included). A winter cover is not a course — the sort
  // deliberately lets it take the slot first, and claiming on it too would
  // cost the plot the one food course it is still owed. That ungated variant
  // was measured to strip the food course in 96 of 144 configs; this pins the
  // gated behaviour so nobody reintroduces the stripped variant later.
  const fill = fillFirstSeasonGaps(
    { ...FILL_ANSWERS, cropKeys: ['potato', 'dry-beans', 'swiss-chard', 'broad-beans', 'oats'] },
    'summer', FILL_BEDS, FILL_CYCLE, [], 8, 2026,
  );
  const keys = fill.starters.filter((s) => s.bedId === 'plot-1').map((s) => s.cropKey);
  assert.ok(keys.includes('broad-beans'), 'the plot still takes its winter cover');
  assert.ok(keys.includes('potato'), "the cover must not cost the plot its food course");
  assert.deepEqual(coursesOn(fill.starters, 'plot-1'), ['tuber']);
});

test('the whole-year plan never sows one plot twice over in its first year', () => {
  // Same defect, reached through the real entry point (suggestIdealYearPlan)
  // rather than a direct call, with rotation OFF so a future refactor cannot
  // dismiss the failure as an artefact of the direct-call fixture.
  const beds: PlanBed[] = [
    { id: 'b1', label: 'Bed 1', areaM2: 12, minDimM: 1.2 },
    { id: 'p1', label: 'Plot 1', areaM2: 110, minDimM: 8, kind: 'plot' },
  ];
  const existing: Planting[] = [{ id: 'e1', bedId: 'p1', cropKey: 'amadumbe', sowMonth: 11, existing: true }];
  const ideal = suggestIdealYearPlan(
    { ...FILL_ANSWERS, rotateCrops: false, cropKeys: ['potato', 'dry-beans', 'swiss-chard'] },
    'all-year', beds, existing, 8, 2026,
  );
  const rows = ideal.best.result.plantings;
  const cycleCourses = coursesOn(rows.filter((p) => typeof p.once !== 'string'), 'p1');
  assert.equal(cycleCourses.length, 0, 'fixture drifted: p1 must reach the starter pass courseless');
  assert.deepEqual(coursesOn(rows.filter((p) => typeof p.once === 'string'), 'p1'), ['tuber']);
});

test("a plot that spends its course on a starter may still take a catalog winter cover", () => {
  // The deliberate, non-subtractive side effect: with broad food-group
  // answers, poolForBed's covers branch draws from the whole catalog
  // (plotWinterCovers(SCHEDULABLE_CROPS)), not the selected groups — the same
  // branch a plot with a cycle course already takes. So once this courseless
  // plot claims its course from the 'root_tuber' group, it also gains access
  // to a legume winter cover the group answer never selected. Measured over
  // 240 broad-food-group configs: 92 configs gained a starter this way, 11
  // lost one (a second same-course starter no longer fits after the first
  // claims the plot), 137 were unchanged. This is agronomically correct
  // (cover crops are soil management, not an answer to the food-group
  // question — see poolForBed's own comment) but must stay pinned so nobody
  // "fixes" it back out as an unintended side effect of the bug fix.
  const fill = fillFirstSeasonGaps(
    { ...FILL_ANSWERS, groups: ['root_tuber'] },
    'summer', FILL_BEDS, FILL_CYCLE, [], 5, 2026,
  );
  const keys = fill.starters.filter((s) => s.bedId === 'plot-1').map((s) => s.cropKey);
  assert.deepEqual(coursesOn(fill.starters, 'plot-1'), ['tuber']);
  assert.ok(
    keys.some((k) => isPlotWinterCover(cropByKey(k)!)),
    'a cover is soil management, not an answer to the food-group question',
  );
});
