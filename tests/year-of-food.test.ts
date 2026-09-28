import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, cropByKey, hasAutomaticPlanningBasis, type RainPattern } from '@/lib/crop-catalog';
import { climateGateFrom, judgeFieldMonths } from '@/lib/crop-climate-gate';
import {
  bedEntryMonth,
  bedOverlapFraction,
  buildFoodAvailability,
  harvestEndMonthForCrop,
  type FoodAvailabilityItem,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import type { TreeAvailabilityItem } from '@/lib/perennial-harvest';
import type { AnimalAvailabilityItem } from '@/lib/animal-enterprises';
import { buildYearOfFood, freshOffsetsFromSow, suggestGapFills, type YearOfFood } from '@/lib/year-of-food';

const JAN_ORDER = Array.from({ length: 24 }, (_, i) => (i % 12) + 1);
const veg = (key: string, status: 'fresh' | 'stored' = 'fresh'): FoodAvailabilityItem => ({ cropKey: key, name: key, icon: '', status });
const tree: TreeAvailabilityItem = { speciesId: 'mango', name: 'Mango', trees: 2 };
const hens: AnimalAvailabilityItem = { enterpriseId: 'chicken-eggs', animal: 'chicken', product: 'eggs', structures: 1 };

function slots<T>(fill: Partial<Record<number, T[]>>, length = 24): T[][] {
  return Array.from({ length }, (_, i) => fill[(i % 12) + 1] ?? []);
}

test('every source counts toward a fresh month; stored-only and empty are told apart', () => {
  const year = buildYearOfFood(
    JAN_ORDER,
    slots({ 1: [veg('lettuce')], 2: [veg('carrots', 'stored')], 5: [veg('onions', 'stored'), veg('beetroot')] }),
    slots({ 3: [tree] }),
    slots({ 4: [hens, hens] }),
  );
  assert.equal(year.months.length, 12, 'one year, not the chart’s 24 slots');
  const by = new Map(year.months.map((m) => [m.month, m]));
  assert.equal(by.get(1)!.status, 'fresh');
  assert.equal(by.get(2)!.status, 'stored-only');
  assert.equal(by.get(3)!.status, 'fresh', 'fruit alone is fresh food');
  assert.equal(by.get(4)!.status, 'fresh', 'eggs alone are fresh food');
  assert.deepEqual(by.get(4)!.animalProducts, ['eggs'], 'products are distinct');
  assert.equal(by.get(6)!.status, 'empty');
  assert.equal(by.get(5)!.freshVeg.length, 1);
  assert.equal(by.get(5)!.storedVeg.length, 1);
  assert.equal(year.freshCount, 4);
  assert.deepEqual(year.hungryMonths, [2, 6, 7, 8, 9, 10, 11, 12]);
  // Fruit and eggs cover months 3 and 4, but there is still no fresh vegetable in them.
  assert.deepEqual(year.vegGapMonths, [2, 3, 4, 6, 7, 8, 9, 10, 11, 12]);
});

test('switched-off rows are simply not passed, and the year starts where the chart starts', () => {
  const order = Array.from({ length: 24 }, (_, i) => ((i + 8) % 12) + 1); // Sep first
  const trees = order.map((m) => (m === 3 ? [tree] : []));
  const withTrees = buildYearOfFood(order, order.map(() => []), trees);
  const withoutTrees = buildYearOfFood(order, order.map(() => []), undefined);
  assert.equal(withTrees.months[0].month, 9);
  assert.ok(!withTrees.hungryMonths.includes(3));
  assert.ok(withoutTrees.hungryMonths.includes(3));
});

const BEDS: PlanBed[] = [
  { id: 'b1', label: 'Bed 1', areaM2: 10, kind: 'bed' },
  { id: 'b2', label: 'Bed 2', areaM2: 10, kind: 'bed' },
  { id: 'p1', label: 'Plot 1', areaM2: 200, kind: 'plot' },
];
const EMPTY_YEAR: YearOfFood = buildYearOfFood(JAN_ORDER, JAN_ORDER.map(() => []));

function monthRun(start: number, end: number): number[] {
  const run = [start];
  for (let m = start; m !== end;) { m = (m % 12) + 1; run.push(m); }
  return run;
}

for (const pattern of ['summer', 'winter', 'all-year'] as RainPattern[]) {
  test(`${pattern}: every suggestion really puts a fresh vegetable into its target month`, () => {
    const fills = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings: [], pattern, currentMonth: 9, gate: null });
    assert.equal(fills.length, 12, 'an empty garden has twelve gap months');
    let checked = 0;
    for (const month of fills) {
      assert.ok(month.suggestions.length <= 3);
      for (const s of month.suggestions) {
        assert.ok(s.crop.sowMonths[pattern].includes(s.sowMonth), `${s.crop.key} sown outside its ${pattern} window`);
        assert.ok(hasAutomaticPlanningBasis(s.crop) && s.crop.yieldKgPerM2 > 0, `${s.crop.key} is not a sourced food crop`);
        assert.notEqual(s.bed.kind, 'plot', 'vegetables go on veg beds');
        // The same chart builder the page uses must show this crop fresh in the target month.
        const planting: Planting = { id: 'x', bedId: s.bed.id, cropKey: s.crop.key, sowMonth: s.sowMonth, areaFraction: s.areaFraction };
        const annual = buildFoodAvailability([planting], BEDS);
        assert.ok(
          annual[s.targetMonth].some((item) => item.cropKey === s.crop.key && item.status === 'fresh'),
          `${s.crop.key} sown ${s.sowMonth} does not pick in ${s.targetMonth}`,
        );
        assert.ok(s.freshMonths.includes(s.targetMonth));
        checked++;
      }
    }
    assert.ok(checked > 0, 'some month must be fillable');
  });
}

test('the soonest-arriving sowing comes first', () => {
  const [first] = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings: [], pattern: 'summer', currentMonth: 9, gate: null });
  const leads = first.suggestions.map((s) => s.monthsUntilTarget);
  assert.deepEqual(leads, [...leads].sort((a, b) => a - b));
  for (const s of first.suggestions) {
    const lead = ((s.sowMonth - 9) % 12 + 12) % 12;
    assert.ok(freshOffsetsFromSow(s.crop).some((off) => lead + off === s.monthsUntilTarget));
  }
});

test('hungry months are listed before months that fruit or eggs already cover', () => {
  const year = buildYearOfFood(JAN_ORDER, JAN_ORDER.map(() => []), slots({ 1: [tree], 2: [tree] }));
  const fills = suggestGapFills({ year, beds: BEDS, plantings: [], pattern: 'summer', currentMonth: 1, gate: null });
  const hungryFlags = fills.map((f) => f.hungry);
  assert.deepEqual(hungryFlags, [...hungryFlags].sort((a, b) => Number(b) - Number(a)), 'all hungry months first');
  assert.deepEqual(fills.slice(-2).map((f) => f.targetMonth), [1, 2]);
});

test('a bed already full over the crop’s months is never offered; a half-full one offers half', () => {
  // Cabbage sown in every month holds Bed 1 whole all year round; one half-bed cabbage holds
  // half of Bed 2 over its own months only.
  const full: Planting[] = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, bedId: 'b1', cropKey: 'cabbage', sowMonth: i + 1 }));
  const plantings: Planting[] = [...full, { id: 'h', bedId: 'b2', cropKey: 'cabbage', sowMonth: 2, areaFraction: 0.5 }];
  const fills = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings, pattern: 'summer', currentMonth: 9, gate: null });
  for (const s of fills.flatMap((f) => f.suggestions)) {
    assert.equal(s.bed.id, 'b2', 'Bed 1 has no room in any month');
    const entry = bedEntryMonth(s.sowMonth, s.crop);
    const end = harvestEndMonthForCrop(s.sowMonth, s.crop);
    const free = 1 - bedOverlapFraction(s.bed.id, entry, end, plantings);
    assert.ok(s.areaFraction <= free + 1e-6, `${s.crop.key} offered ${s.areaFraction} of a bed with ${free} free`);
  }
  const shares = new Set(fills.flatMap((f) => f.suggestions.map((s) => s.areaFraction)));
  assert.ok(shares.has(0.5), 'a sowing that meets the half-bed cabbage is offered the free half');
  assert.ok(shares.has(1), 'a sowing clear of it is offered the whole bed');
});

test('no room anywhere: no suggestion, and the crops that could have picked are named', () => {
  const plantings: Planting[] = ['b1', 'b2'].flatMap((bedId) =>
    Array.from({ length: 12 }, (_, i) => ({ id: `${bedId}-${i}`, bedId, cropKey: 'cabbage', sowMonth: i + 1 })));
  const fills = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings, pattern: 'summer', currentMonth: 9, gate: null });
  assert.equal(fills.flatMap((f) => f.suggestions).length, 0);
  assert.ok(fills.some((f) => f.noRoomCropNames.length > 0));
});

test('cover crops and maize are never suggested for a veg gap', () => {
  const fills = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings: [], pattern: 'summer', currentMonth: 9, gate: null, perMonth: 99 });
  const keys = new Set(fills.flatMap((f) => f.suggestions.map((s) => s.crop.key)));
  for (const crop of CROPS.filter((c) => c.yieldKgPerM2 === 0)) assert.ok(!keys.has(crop.key), `${crop.key} is a soil cover`);
  assert.ok(!keys.has('maize'));
});

test('the site climate gate removes sowings whose field months are too hot', () => {
  const hot = climateGateFrom({ siteMonthlyTempC: [38, 38, 36, 30, 24, 20, 20, 22, 28, 34, 36, 38] }, false)!;
  const fills = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings: [], pattern: 'summer', currentMonth: 9, gate: hot, perMonth: 99 });
  const all = fills.flatMap((f) => f.suggestions);
  for (const s of all) {
    const months = monthRun(bedEntryMonth(s.sowMonth, s.crop), harvestEndMonthForCrop(s.sowMonth, s.crop));
    assert.equal(judgeFieldMonths(s.crop, months, hot), 'ok', `${s.crop.key} sown ${s.sowMonth} fails the heat gate`);
  }
  const ungated = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings: [], pattern: 'summer', currentMonth: 9, gate: null, perMonth: 99 });
  assert.ok(ungated.flatMap((f) => f.suggestions).length > all.length, 'the gate must remove something on a 38 °C site');
});

test('a sprawling vine is only ever offered a whole bed', () => {
  const fills = suggestGapFills({ year: EMPTY_YEAR, beds: BEDS, plantings: [], pattern: 'summer', currentMonth: 9, gate: null, perMonth: 99 });
  for (const s of fills.flatMap((f) => f.suggestions)) {
    if (['pumpkin', 'butternut', 'watermelon'].includes(s.crop.key)) assert.equal(s.areaFraction, 1);
  }
  assert.ok(cropByKey('pumpkin'));
});
