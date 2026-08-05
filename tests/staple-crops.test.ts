// The promises the staple plots make, pinned.
//
// All of these come from one owner report (2026-08-04): "the staple crop section
// allocated everything but staple crops... why do we plant swiss chard in so many
// beds, why is maize planted in the raised beds and no staple plots". Each test below
// is one of those sentences turned into something that fails loudly.

import assert from 'node:assert/strict';
import test from 'node:test';

import { CROPS, cropByKey } from '@/lib/crop-catalog';
import { foodGroupOf } from '@/lib/crop-groups';
import type { PlanBed } from '@/lib/crop-plan';
import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers } from '@/lib/crop-autosuggest';
import {
  STAPLE_CROPS_BY_COURSE,
  STAPLE_COURSE_SEQUENCE,
  STAPLE_CROP_KEYS,
  PLOT_WINTER_COVER_KEYS,
  isStapleCrop,
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

test('maize goes in the field, not in a 1.2m raised bed', () => {
  // Wind-pollinated: one row in a narrow bed shakes its pollen onto the path. The
  // catalog note has always said "block-plant several rows together"; now the engine
  // acts on it. A wide bed is still allowed — the rule is about width, not about beds.
  const beds = ubhejaneFixture();
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], nowMonth);
    for (const p of res.plantings.filter((x) => x.cropKey === 'maize')) {
      assert.ok(isPlot(p.bedId), `maize was planted in ${p.bedId}, which is 1.2m wide`);
    }
  }

  const wideBed: PlanBed[] = [{ id: 'wide', label: 'Wide bed', areaM2: 40, minDimM: 4 }];
  const wide = autoSuggestPlan({ ...BASE, groups: ['staple_grain'] }, 'mild-frost', wideBed, [], 10);
  assert.ok(
    wide.plantings.some((p) => p.cropKey === 'maize'),
    'a 4m-wide bed can hold a maize block and should be allowed to',
  );
});

test('no single crop is allowed to become the whole garden', () => {
  // "why do we plant swiss chard in so many beds" — it is the joint-highest scoring
  // crop AND the only top scorer sowable all twelve months, so every coverage pass
  // reached for it. The cap is a third of the veg beds, applied as a strong
  // preference: a crop may still exceed it when nothing else fits, because an empty
  // bed is a worse answer than a second planting of a good crop.
  const beds = ubhejaneFixture();
  const vegBedCount = beds.filter((b) => b.kind !== 'plot').length;
  for (let nowMonth = 1; nowMonth <= 12; nowMonth++) {
    const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], nowMonth);
    const bedsPerCrop = new Map<string, Set<string>>();
    for (const p of res.plantings) {
      if (isPlot(p.bedId)) continue;
      if (!bedsPerCrop.has(p.cropKey)) bedsPerCrop.set(p.cropKey, new Set());
      bedsPerCrop.get(p.cropKey)!.add(p.bedId);
    }
    for (const [cropKey, bedSet] of bedsPerCrop) {
      assert.ok(
        bedSet.size < vegBedCount,
        `now=${nowMonth}: ${cropKey} took ${bedSet.size} of ${vegBedCount} veg beds`,
      );
    }
  }
});

test('the plan reaches well beyond the handful of top-scoring crops', () => {
  // Eleven of twenty-five catalog crops appeared in no plan at any setting before this
  // — the per-group queues are ranked by yield and only the top few are ever offered.
  // A catalog entry no plan can ever use is a defect, not a spare.
  const beds = ubhejaneFixture();
  for (const nowMonth of [2, 8, 11]) {
    const res = autoSuggestPlan(BASE, 'mild-frost', beds, [], nowMonth);
    const used = new Set(res.plantings.map((p) => p.cropKey));
    assert.ok(used.size >= 15, `now=${nowMonth}: only ${used.size} of ${CROPS.length} crops used`);
  }
});

test('four plots take four different staple courses', () => {
  // The classic grain / pulse / tuber / cucurbit layout, which is what four plots are for.
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
  assert.equal(new Set(courses).size, 4, `plots took ${courses.join(', ')} — expected four different courses`);
});

test('no staple course can strand its plot without a legal winter cover', () => {
  // THE BUG THIS PINS. PLOT_WINTER_COVER_KEYS held exactly one crop, broad
  // beans, and broad beans is a legume. So a plot whose staple course was ALSO
  // a legume (dry beans, groundnuts) had its entire cover list disqualified by
  // BedRotation.repeats — a HARD filter, unlike the soft conflicts — and could
  // never be planted again that season, at any fraction, in any gap month.
  // Measured on Ubhejane's own generated plan: Plot 1, 98.8 m², bare 7 of 12
  // months = 692 m²-months, 56% of every idle square metre on that farm.
  //
  // Structural rather than behavioural on purpose: it fails the moment the
  // cover list and the staple list share a food group with nothing left over,
  // which is the actual precondition, instead of waiting for one fixture's
  // occupancy to drift.
  const covers = plotWinterCovers(CROPS);
  assert.ok(covers.length, 'no winter cover crops are declared at all');
  for (const key of STAPLE_CROP_KEYS) {
    const staple = cropByKey(key)!;
    const legal = covers.filter((c) => foodGroupOf(c) !== foodGroupOf(staple));
    assert.ok(
      legal.length > 0,
      `a plot growing ${key} (${foodGroupOf(staple)}) has no winter cover in a different food group — `
      + `every cover would be a hard rotation repeat, so that plot sits bare all winter`,
    );
  }
});

test('the household-food cover crop is offered before the green manure', () => {
  // Order in PLOT_WINTER_COVER_KEYS is a RANKING, not a set. Broad beans feeds
  // the household; oats is cut or rolled down and feeds only the soil, so it
  // must never be reached while the legume is legal. Nothing downstream would
  // enforce this on its own — fillRemainingGaps sorts spread-first and a
  // never-used crop wins that sort outright, which measurably cost Plot 4 two
  // extra bare months when both covers were offered as an unranked pool.
  const covers = plotWinterCovers(CROPS);
  assert.ok(covers[0].yieldKgPerM2 > 0, 'the first-choice winter cover must be one the household can eat');
  const manures = covers.filter((c) => c.yieldKgPerM2 === 0);
  for (const m of manures) {
    assert.ok(
      covers.indexOf(m) > 0,
      `${m.key} yields no food and must rank below an edible cover, not above it`,
    );
  }
});
