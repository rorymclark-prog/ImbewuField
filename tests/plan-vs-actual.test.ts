import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPlanVsActual } from '@/lib/plan-vs-actual';
import type { CashflowSettings, PlanBed, Planting } from '@/lib/crop-plan';
import type { ProductionLog, SalesLog } from '@/lib/db/types';

const NOW = new Date('2026-08-15T09:00:00');

// One planting per bed: two whole-bed plantings in one bed is an area conflict,
// and buildPlanYieldBenchmark withholds knownKg entirely when it cannot divide
// the ground — which would empty this chart rather than mis-fill it.
const BEDS: PlanBed[] = [
  { id: 'bed-a', label: 'Bed A', areaM2: 20, minDimM: 1.2 },
  { id: 'bed-b', label: 'Bed B', areaM2: 20, minDimM: 1.2 },
];

const planting = (id: string, cropKey: string, bedId: string): Planting =>
  ({ id, cropKey, bedId, sowMonth: 3 });

const harvest = (id: string, crop: string, kg: number, iso: string): ProductionLog =>
  ({ id, profile_id: 'p', garden_id: null, crop, kg, photo_url: null, logged_at: iso, created_at: iso });

const sale = (id: string, crop: string, kg: number, amount: number, iso: string): SalesLog =>
  ({ id, profile_id: 'p', garden_id: null, crop, kg, amount, buyer: null, sold_at: iso, created_at: iso });

const confirmed = (over: Partial<CashflowSettings> = {}): CashflowSettings =>
  ({ sellPercent: 100, lossPercent: 25, confirmed: true, ...over });

const unconfirmed: CashflowSettings = { sellPercent: 100, lossPercent: 25, confirmed: false };

test('plan vs actual: month and season have no benchmark, and say so instead of inventing one', () => {
  // A crop-cycle total divided by 12 is the picking curve this codebase refuses to
  // invent everywhere else. Refusing here too is the whole reason for the flag.
  const plantings = [planting('p1', 'swiss-chard', 'bed-a')];
  for (const period of ['month', 'season'] as const) {
    const view = buildPlanVsActual(plantings, BEDS, [], [], period, NOW, confirmed());
    assert.equal(view.availableForPeriod, false, period);
    assert.deepEqual(view.rows, [], `${period} draws nothing`);
  }
  assert.equal(buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, confirmed()).availableForPeriod, true);
});

test('plan vs actual: a planned crop with no harvest logged is still a bar', () => {
  // The most useful row on the chart, and the easiest one to lose: it lives in
  // buildReconciliation's notYetHarvested bucket, not in matched.
  const view = buildPlanVsActual([planting('p1', 'swiss-chard', 'bed-a')], BEDS, [], [], 'year', NOW, confirmed());
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].cropKey, 'swiss-chard');
  assert.ok(view.rows[0].benchmarkKg > 0);
  assert.equal(view.rows[0].harvestedKg, 0);
});

test('plan vs actual: the loss allowance is only applied once the farmer has confirmed it', () => {
  const plantings = [planting('p1', 'swiss-chard', 'bed-a')];

  const notYet = buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, unconfirmed);
  assert.equal(notYet.rows[0].afterLossKg, null, '25% is a national default until it is reviewed');
  assert.equal(notYet.lossConfirmed, false);
  assert.equal(notYet.lossPercent, 25, 'the figure is still reported so the UI can name it');

  const set = buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, confirmed({ lossPercent: 40 }));
  const row = set.rows[0];
  assert.ok(Math.abs(row.afterLossKg! - row.benchmarkKg * 0.6) < 1e-9);
  assert.equal(set.lossConfirmed, true);
});

test('plan vs actual: a hand-edited loss percentage cannot invert the allowance', () => {
  const plantings = [planting('p1', 'swiss-chard', 'bed-a')];
  const wild = buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, confirmed({ lossPercent: 400 }));
  assert.equal(wild.rows[0].afterLossKg, 0, 'clamped to 100% lost, never a negative bar');
  const negative = buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, confirmed({ lossPercent: -50 }));
  assert.ok(Math.abs(negative.rows[0].afterLossKg! - negative.rows[0].benchmarkKg) < 1e-9, 'clamped to 0% lost');
  const nan = buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, confirmed({ lossPercent: Number.NaN }));
  assert.ok(Number.isFinite(nan.rows[0].afterLossKg!));
});

test('plan vs actual: measured harvest and sales come through per crop', () => {
  const view = buildPlanVsActual(
    [planting('p1', 'swiss-chard', 'bed-a')],
    BEDS,
    [harvest('h1', 'Swiss chard', 12, '2026-05-02T08:00:00'), harvest('h2', 'Swiss chard', 8, '2026-06-02T08:00:00')],
    [sale('s1', 'Swiss chard', 5, 100, '2026-06-03T08:00:00')],
    'year', NOW, confirmed(),
  );
  const row = view.rows[0];
  assert.equal(row.harvestedKg, 20);
  assert.equal(row.soldKg, 5);
  assert.equal(row.soldExceedsHarvested, false);
});

test('plan vs actual: a harvest bar known to be short is flagged, not quietly drawn', () => {
  const view = buildPlanVsActual(
    [planting('p1', 'swiss-chard', 'bed-a')],
    BEDS,
    [harvest('h1', 'Swiss chard', 3, '2026-05-02T08:00:00')],
    [sale('s1', 'Swiss chard', 9, 200, '2026-06-03T08:00:00')],
    'year', NOW, confirmed(),
  );
  assert.equal(view.rows[0].soldExceedsHarvested, true);
  assert.equal(view.rows[0].harvestedKg, 3, 'what was logged is still what is drawn');
});

test('plan vs actual: harvest of something that is not in the plan is named, not charted as a gap', () => {
  const view = buildPlanVsActual(
    [planting('p1', 'swiss-chard', 'bed-a')],
    BEDS,
    [harvest('h1', 'Eggs', 4, '2026-05-02T08:00:00')],
    [], 'year', NOW, confirmed(),
  );
  assert.deepEqual(view.rows.map((r) => r.cropKey), ['swiss-chard']);
  assert.ok(view.offPlanNames.some((n) => /egg/i.test(n)), `off-plan named: ${view.offPlanNames}`);
});

test('plan vs actual: a crop with no verified yield is excluded and NAMED, never plotted at zero', () => {
  // amadumbe has yieldKgPerM2 === null. A 0 kg benchmark bar beside a real harvest
  // would read as "you grew this for nothing", which is a claim about the crop the
  // catalog has never made.
  const view = buildPlanVsActual(
    [planting('p1', 'amadumbe', 'bed-a')],
    BEDS,
    [harvest('h1', 'Amadumbe', 6, '2026-05-02T08:00:00')],
    [], 'year', NOW, confirmed(),
  );
  assert.deepEqual(view.rows, []);
  assert.ok(view.unbenchmarkedCropNames.some((n) => /amadumbe/i.test(n)), `named: ${view.unbenchmarkedCropNames}`);
});

test('plan vs actual: rows are ordered by the plan, so logging a harvest never reshuffles the chart', () => {
  const view = buildPlanVsActual(
    [planting('p1', 'swiss-chard', 'bed-a'), planting('p2', 'maize', 'bed-b')],
    BEDS, [], [], 'year', NOW, confirmed(),
  );
  assert.equal(view.rows.length, 2);
  assert.ok(view.rows[0].benchmarkKg >= view.rows[1].benchmarkKg, 'biggest benchmark first');
});

test('plan vs actual: an overbooked bed withholds every benchmark rather than guessing', () => {
  const plantings = [
    { id: 'p1', cropKey: 'swiss-chard', bedId: 'bed-a', sowMonth: 3, areaFraction: 0.8 },
    { id: 'p2', cropKey: 'maize', bedId: 'bed-a', sowMonth: 3, areaFraction: 0.8 },
  ] as Planting[];
  const view = buildPlanVsActual(plantings, BEDS, [], [], 'year', NOW, confirmed());
  assert.deepEqual(view.rows, [], 'no benchmark survives a plan the app cannot divide');
});

test('plan vs actual: an empty plan is empty, not a farm that grew nothing', () => {
  const view = buildPlanVsActual([], BEDS, [], [], 'year', NOW, confirmed());
  assert.deepEqual(view.rows, []);
  assert.deepEqual(view.unbenchmarkedCropNames, []);
  assert.equal(view.availableForPeriod, true);
});
