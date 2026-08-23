import test from 'node:test';
import assert from 'node:assert/strict';

import { buildForwardHarvests, forwardValueRows } from '@/lib/forward-harvests';
import { harvestMonthForCrop, type PlanBed, type Planting } from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';

// Each planting below sits on its OWN bed unless a test is deliberately about
// two crops sharing ground: two whole-bed plantings in one bed is an area
// conflict, and a conflict withholds every kilogram (see that test).
const BEDS: PlanBed[] = [
  { id: 'bed-a', label: 'Bed A', areaM2: 10, minDimM: 1.2 },
  { id: 'bed-b', label: 'Bed B', areaM2: 10, minDimM: 1.2 },
  { id: 'bed-c', label: 'Bed C', areaM2: 10, minDimM: 1.2 },
  { id: 'plot-1', label: 'Plot 1', areaM2: 400, minDimM: 15, kind: 'plot' },
];

const p = (id: string, cropKey: string, bedId: string, sowMonth: number, over: Partial<Planting> = {}): Planting =>
  ({ id, cropKey, bedId, sowMonth, ...over });

/** The sow month that makes `cropKey` start picking in calendar month `target`. */
function sowFor(cropKey: string, target: number): number {
  const crop = cropByKey(cropKey)!;
  for (let sow = 1; sow <= 12; sow++) {
    if (harvestMonthForCrop(sow, crop) === target) return sow;
  }
  throw new Error(`no sow month puts ${cropKey} in month ${target}`);
}

test('forward harvests: only pickings that START inside the horizon are listed', () => {
  const now = new Date('2026-08-15T09:00:00Z'); // August
  const plantings = [
    p('a', 'swiss-chard', 'bed-a', sowFor('swiss-chard', 9)),  // Sep — 1 ahead, in
    p('b', 'swiss-chard', 'bed-b', sowFor('swiss-chard', 10)), // Oct — 2 ahead, in
    p('c', 'swiss-chard', 'bed-c', sowFor('swiss-chard', 12)), // Dec — 4 ahead, out
  ];
  const book = buildForwardHarvests(plantings, BEDS, now, 3);
  assert.deepEqual(book.harvests.map((h) => h.startMonth).sort((a, b) => a - b), [9, 10]);
  assert.equal(book.months.length, 3, 'one entry per month of the horizon, empty or not');
  assert.deepEqual(book.months.map((m) => m.month), [8, 9, 10]);
});

test('forward harvests: the book is DATED — a month earlier in the year is next year', () => {
  const now = new Date('2026-11-10T09:00:00Z'); // November 2026
  const plantings = [p('a', 'swiss-chard', 'bed-a', sowFor('swiss-chard', 1))]; // January
  const book = buildForwardHarvests(plantings, BEDS, now, 4);
  assert.equal(book.harvests.length, 1);
  assert.equal(book.harvests[0].startMonth, 1);
  assert.equal(book.harvests[0].startYear, 2027, 'the next January is next year');
  assert.equal(book.harvests[0].monthsAhead, 2);
  assert.deepEqual(book.months.map((m) => m.label), ['Nov 2026', 'Dec 2026', 'Jan 2027', 'Feb 2027']);
});

test('forward harvests: a crop with no verified kg/m² is excluded and NAMED, not zeroed', () => {
  const now = new Date('2026-08-15T09:00:00Z');
  const plantings = [
    p('a', 'swiss-chard', 'bed-a', sowFor('swiss-chard', 9)),
    p('b', 'amadumbe', 'bed-b', sowFor('amadumbe', 9)), // yieldKgPerM2 === null
  ];
  const book = buildForwardHarvests(plantings, BEDS, now, 3);
  assert.deepEqual(book.harvests.map((h) => h.cropKey), ['swiss-chard']);
  assert.ok(book.excludedCropNames.some((n) => /Amadumbe/i.test(n)), `named: ${book.excludedCropNames}`);
  assert.ok(book.totalKg > 0, 'the verified crop still counts');
});

test('forward harvests: a soil cover contributes no food kilograms and says so', () => {
  const now = new Date('2026-08-15T09:00:00Z');
  const plantings = [p('a', 'oats', 'bed-a', sowFor('oats', 9))]; // yieldKgPerM2 === 0
  const book = buildForwardHarvests(plantings, BEDS, now, 3);
  assert.equal(book.harvests.length, 0);
  assert.equal(book.totalKg, 0);
  assert.ok(book.nonFoodCropNames.length > 0, 'the cover crop is named as a cover crop');
  assert.deepEqual(book.excludedCropNames, [], 'a cover crop is NOT an unverified crop');
});

test('forward harvests: an overbooked bed withholds every kilogram', () => {
  // Matches buildPlanYieldBenchmark's refusal to total a plan it cannot divide:
  // guessing which crop loses the land would turn a draft layout into a forecast.
  const now = new Date('2026-08-15T09:00:00Z');
  const sow = sowFor('swiss-chard', 9);
  const plantings = [
    p('a', 'swiss-chard', 'bed-a', sow, { areaFraction: 0.8 }),
    p('b', 'swiss-chard', 'bed-a', sow, { areaFraction: 0.8 }),
  ];
  const book = buildForwardHarvests(plantings, BEDS, now, 3);
  assert.ok(book.areaConflictBedLabels.includes('Bed A'), `conflict reported: ${book.areaConflictBedLabels}`);
  assert.equal(book.harvests.length, 0);
  assert.equal(book.totalKg, 0);
  assert.ok(book.months.every((m) => m.kg === 0));
});

test('forward harvests: a planting on ground that is not in the bed list is ignored', () => {
  const now = new Date('2026-08-15T09:00:00Z');
  const plantings = [p('a', 'swiss-chard', 'bed-gone', sowFor('swiss-chard', 9))];
  const book = buildForwardHarvests(plantings, BEDS, now, 3);
  assert.equal(book.harvests.length, 0);
});

test('forward harvests: a staple plot is flagged as field-scale ground', () => {
  const now = new Date('2026-08-15T09:00:00Z');
  const plantings = [
    p('a', 'maize', 'plot-1', sowFor('maize', 9)),
    p('b', 'swiss-chard', 'bed-a', sowFor('swiss-chard', 9)),
  ];
  const book = buildForwardHarvests(plantings, BEDS, now, 3);
  const maize = book.harvests.find((h) => h.cropKey === 'maize');
  const chard = book.harvests.find((h) => h.cropKey === 'swiss-chard');
  assert.equal(maize?.onPlot, true);
  assert.equal(chard?.onPlot, false);
  assert.equal(maize?.bedLabel, 'Plot 1');
});

test('forward harvests: the picking window is carried, not spread across months', () => {
  // Swiss chard picks over several months; the whole cycle's kilograms sit in the
  // START month and the window is reported separately. Spreading them would be
  // inventing a picking curve the catalog does not have.
  const now = new Date('2026-08-15T09:00:00Z');
  const book = buildForwardHarvests(
    [p('a', 'swiss-chard', 'bed-a', sowFor('swiss-chard', 9))], BEDS, now, 3,
  );
  const row = book.harvests[0];
  assert.equal(row.startMonth, 9);
  assert.notEqual(row.endMonth, row.startMonth, 'fixture sanity: chard has a multi-month window');
  const sep = book.months.find((m) => m.month === 9)!;
  const oct = book.months.find((m) => m.month === 10)!;
  assert.ok(Math.abs(sep.kg - row.kg) < 1e-9, 'all of it lands in the start month');
  assert.equal(oct.kg, 0, 'and none of it is spread into the next one');
});

test('forward harvests: the horizon is clamped to a single annual cycle', () => {
  const now = new Date('2026-08-15T09:00:00Z');
  assert.equal(buildForwardHarvests([], BEDS, now, 99).horizonMonths, 12);
  assert.equal(buildForwardHarvests([], BEDS, now, 0).horizonMonths, 1);
  assert.equal(buildForwardHarvests([], BEDS, now, 3.7).horizonMonths, 3);
});

test('forward harvests: value rows aggregate by crop and keep every kilogram', () => {
  const now = new Date('2026-08-15T09:00:00Z');
  const book = buildForwardHarvests([
    p('a', 'swiss-chard', 'bed-a', sowFor('swiss-chard', 9)),
    p('b', 'swiss-chard', 'bed-b', sowFor('swiss-chard', 10)),
    p('c', 'maize', 'plot-1', sowFor('maize', 9)),
  ], BEDS, now, 3);
  const rows = forwardValueRows(book);
  assert.equal(rows.length, 2, 'two crops, three plantings');
  const total = rows.reduce((s, r) => s + r.kg, 0);
  assert.ok(Math.abs(total - book.totalKg) < 1e-9, 'no kilogram is lost or double-counted');
  assert.ok(rows[0].kg >= rows[1].kg, 'biggest first');
});

test('forward harvests: an empty plan is empty, not a forecast of nothing', () => {
  const book = buildForwardHarvests([], BEDS, new Date('2026-08-15T09:00:00Z'), 3);
  assert.equal(book.harvests.length, 0);
  assert.equal(book.totalKg, 0);
  assert.deepEqual(book.excludedCropNames, []);
  assert.deepEqual(book.areaConflictBedLabels, []);
  assert.equal(book.months.length, 3);
});
