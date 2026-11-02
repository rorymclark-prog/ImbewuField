import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNurseryForecast } from '@/lib/crop-export-schedule';
import { seedBoqBatchesForPlan, tasksForPlan, type Planting, type PlanBed } from '@/lib/crop-plan';
import type { NurserySettings } from '@/lib/nursery-settings';

const now = { year: 2026, month: 1 };
const beds: PlanBed[] = [{ id: 'b', label: 'Bed', areaM2: 6 }];
const planting = (id: string, sowMonth: number, extra: Partial<Planting> = {}): Planting => ({
  id, bedId: 'b', cropKey: 'cabbage', sowMonth, ...extra,
});
const settings = (extra: Partial<NurserySettings['profiles'][number]> = {}): NurserySettings => ({
  version: 1,
  spaces: [{ id: 'space', siteId: 'farm', name: 'Net growing surface', usableM2: 1 }],
  containers: [{ id: 'tray', siteId: 'farm', name: 'Tray', cells: 100, widthCm: 50, lengthCm: 40, owned: 1 }],
  profiles: [{ id: 'profile', siteId: 'farm', cropKey: 'cabbage', model: 'seed-cell', containerId: 'tray', spaceId: 'space',
    germinationPercent: 100, nurserySurvivalPercent: 100, nurseryWeeks: 4, ...extra }],
});

test('successive cohorts reuse owned stock even when they both touch one weekly bucket', () => {
  const forecast = buildNurseryForecast([planting('one', 1), planting('two', 4)], beds, 'farm', settings(), now);
  assert.equal(forecast.cohorts[0].endDateExclusive, '2026-04-01');
  assert.equal(forecast.cohorts[1].startDate, '2026-04-01');
  assert.deepEqual(forecast.cumulativeTrayUses, [2, 2]);
  assert.deepEqual(forecast.peakTrays, [1, 1]);
  assert.equal(forecast.containers[0].shortage, 0);
  const sharedWeek = forecast.weeks.find((w) => w.startDate < '2026-04-01' && w.endDateExclusive > '2026-04-01')!;
  assert.deepEqual(sharedWeek.trays, [1, 1], 'end-before-start prevents inventing overlapping tray demand');
  assert.deepEqual(forecast.peakAreaM2, [0.2, 0.2]);
});

test('overlapping cohorts expose simultaneous container and usable-space shortages', () => {
  const config = settings(); config.spaces[0].usableM2 = 0.3;
  const forecast = buildNurseryForecast([planting('one', 1), planting('two', 2)], beds, 'farm', config, now);
  assert.deepEqual(forecast.peakTrays, [2, 2]);
  assert.equal(forecast.containers[0].shortage, 1);
  assert.ok(Math.abs(forecast.spaces[0].shortage! - 0.1) < 1e-10);
  assert.ok(forecast.spaces[0].weeks.some((w) => w.shortage! > 0));
});

test('split beds aggregate field positions before rounding and preserve varieties separately', () => {
  // Both measured patches together are below one final position at either
  // spacing endpoint; rounding the patches first would manufacture two.
  const tiny: PlanBed[] = [{ id: 'b', label: 'Tiny measured bed', areaM2: 0.03 }, { id: 'c', label: 'Other tiny bed', areaM2: 0.03 }];
  const rows = [planting('a', 1), planting('b', 1, { bedId: 'c' })];
  const forecast = buildNurseryForecast(rows, tiny, 'farm', settings(), now);
  assert.equal(forecast.cohorts.length, 1);
  assert.deepEqual(forecast.cohorts[0].positions, [1, 1]);
  assert.deepEqual(forecast.cohorts[0].positions, seedBoqBatchesForPlan(rows, tiny)[0].finalPlantPositionsRange);
  const varieties = buildNurseryForecast(rows.map((p, i) => ({ ...p, variety: `Recorded ${i}` })), tiny, 'farm', settings(), now);
  assert.equal(varieties.cohorts.length, 2);
  assert.deepEqual(varieties.cumulativeTrayUses, [2, 2]);
});

test('seed-cell losses and optional field allowance carry both source spacing endpoints', () => {
  const forecast = buildNurseryForecast([planting('a', 1)], beds, 'farm', settings({ germinationPercent: 50, nurserySurvivalPercent: 50, fieldSurvivalPercent: 80 }), now);
  const cohort = forecast.cohorts[0];
  const positions = seedBoqBatchesForPlan([planting('a', 1)], beds)[0].finalPlantPositionsRange;
  const starts = positions.map((n) => Math.ceil(n / 0.8));
  assert.deepEqual(cohort.starts, starts);
  assert.deepEqual(cohort.seeds, starts.map((n) => Math.ceil(n / 0.25)));
  assert.deepEqual(cohort.trays, starts.map((n) => Math.ceil(Math.ceil(n / 0.25) / 100)));
  const noField = buildNurseryForecast([planting('a', 1)], beds, 'farm', settings(), now).cohorts[0];
  assert.deepEqual(noField.starts, noField.positions);
  assert.ok(noField.basis.some((line) => /No extra field/.test(line)));
});

test('measured usable starts already include nursery losses and allow known zero seeds per tray', () => {
  const config = settings({ model: 'measured-tray', usableStartsPerTray: 10, seedsPerTray: 0,
    germinationPercent: 1, nurserySurvivalPercent: 1 });
  const cohort = buildNurseryForecast([planting('a', 1)], beds, 'farm', config, now).cohorts[0];
  assert.deepEqual(cohort.trays, cohort.positions!.map((n) => Math.ceil(n / 10)));
  assert.deepEqual(cohort.seeds, [0, 0]);
  assert.equal(cohort.incomplete, false);
  config.profiles[0].usableStartsPerTray = 200;
  assert.deepEqual(buildNurseryForecast([planting('a', 1)], beds, 'farm', config, now).cohorts[0].trays, [1, 1],
    'measured multi-sown output may exceed the number of cells');
});

test('missing rates, dimensions and stock stay unknown and zero success cannot be sized', () => {
  const config = settings(); delete config.profiles[0].germinationPercent;
  delete config.containers[0].widthCm; delete config.containers[0].owned;
  const forecast = buildNurseryForecast([planting('a', 1)], beds, 'farm', config, now);
  assert.equal(forecast.cohorts[0].seeds, null);
  assert.equal(forecast.cohorts[0].trays, null);
  assert.equal(forecast.cohorts[0].areaM2, null);
  assert.equal(forecast.containers[0].capacity, null);
  assert.equal(forecast.containers[0].shortage, null);
  assert.equal(forecast.weeks[0].incomplete, true);
  for (const rate of ['germinationPercent', 'nurserySurvivalPercent', 'fieldSurvivalPercent'] as const) {
    const cohort = buildNurseryForecast([planting(rate, 1)], beds, 'farm', settings({ [rate]: 0 }), now).cohorts[0];
    assert.equal(cohort.trays, null, rate);
    assert.equal(cohort.incomplete, true);
  }
});

test('zero stock and zero net space are known shortages, while foreign resources cannot supply capacity', () => {
  const config = settings(); config.containers[0].owned = 0; config.spaces[0].usableM2 = 0;
  const emptyStock = buildNurseryForecast([planting('a', 1)], beds, 'farm', config, now);
  assert.equal(emptyStock.containers[0].shortage, 1);
  assert.equal(emptyStock.spaces[0].shortage, 0.2);
  config.containers[0].siteId = 'other'; config.spaces[0].siteId = 'other';
  const foreign = buildNurseryForecast([planting('a', 1)], beds, 'farm', config, now);
  assert.deepEqual(foreign.containers, []);
  assert.deepEqual(foreign.spaces, []);
  assert.equal(foreign.cohorts[0].trays, null);
  assert.equal(foreign.cohorts[0].areaM2, null);
  assert.equal(foreign.incomplete, true);
  config.profiles[0].siteId = 'other';
  assert.equal(buildNurseryForecast([planting('a', 1)], beds, 'farm', config, now).cohorts[0].starts !== null, true,
    'verified field positions remain available without borrowing another farm’s profile');
});

test('dated sowings cross years once and own readiness extends nursery space without changing field tasks', () => {
  const rows = [planting('dated', 11, { once: '2026-11' }), planting('later', 11, { once: '2027-11' })];
  const before = JSON.stringify(rows); const tasks = tasksForPlan(rows, beds);
  const config = settings({ nurseryWeeks: 14 });
  const forecast = buildNurseryForecast(rows, beds, 'farm', config, { year: 2026, month: 11 });
  assert.equal(forecast.cohorts.length, 1, 'next November lies outside the rolling year');
  const cohort = forecast.cohorts[0];
  assert.equal(cohort.sowMonth, '2026-11'); assert.equal(cohort.fieldMonth, '2027-01');
  assert.equal(cohort.endDateExclusive, '2027-03-09');
  assert.equal(cohort.readinessConflict, true);
  assert.equal(forecast.weeks[0].startDate, '2026-11-01');
  assert.equal(forecast.weeks.at(-1)!.endDateExclusive, '2027-11-01');
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(tasksForPlan(rows, beds), tasks);
  const source = buildNurseryForecast([rows[0]], beds, 'farm', settings({ nurseryWeeks: undefined }), { year: 2026, month: 11 }).cohorts[0];
  assert.equal(source.endDateExclusive, '2027-03-01', 'absent own duration retains latest sourced field-entry month');
  assert.equal(source.readinessSource, 'published-calendar');
});

test('pending, invalid, unknown and established rows cannot become zero-valued complete nursery orders', () => {
  const rows = [planting('pending', 1, { awaitingSowingConfirmation: true }), planting('bad', 13),
    planting('unknown', 1, { cropKey: 'not-a-catalogue-crop' }), planting('missing-bed', 1, { bedId: 'gone' }),
    planting('field', 1, { existing: true }), planting('direct', 1, { cropKey: 'carrots' })];
  const forecast = buildNurseryForecast(rows, beds, 'farm', settings(), now);
  assert.equal(forecast.cohorts.length, 3, 'same-month pending and missing-area rows share an incomplete cohort');
  for (const cohort of forecast.cohorts) { assert.equal(cohort.incomplete, true); assert.equal(cohort.positions, null); }
  assert.equal(forecast.peakTrays, null);
  assert.equal(forecast.weeks[0].incomplete, true);
});

test('a settled nursery observation cannot recur next year or merge with next season’s planned trays', () => {
  const rows = [planting('in-tray', 11, { existing: true, inNursery: '2025-11', confirmedOnceSowing: '2025-11' }), planting('new', 11)];
  const forecast = buildNurseryForecast(rows, beds, 'farm', settings(), { year: 2026, month: 1 });
  assert.deepEqual(forecast.cohorts.map((c) => [c.sowMonth, c.phase]), [['2025-11', 'in-nursery'], ['2026-11', 'planned']]);
  const nextYear = buildNurseryForecast([rows[0]], beds, 'farm', settings(), { year: 2027, month: 1 });
  assert.deepEqual(nextYear.cohorts, []);
});

test('conflicting observed nursery stamps require confirmation rather than replacing the field-date authority', () => {
  const row = planting('conflict', 1, { existing: true, inNursery: '2026-01', confirmedOnceSowing: '2025-01' });
  const forecast = buildNurseryForecast([row], beds, 'farm', settings(), now);
  assert.equal(forecast.cohorts[0].sowMonth, null);
  assert.equal(forecast.cohorts[0].fieldMonth, null);
  assert.equal(forecast.cohorts[0].trays, null);
  assert.equal(forecast.incomplete, true);
});

test('unassigned demand cannot certify spare capacity on an apparently unused resource', () => {
  const config = settings();
  config.containers.push({ id: 'spare', siteId: 'farm', name: 'Spare stock', cells: 100, owned: 100 });
  config.spaces.push({ id: 'spare-space', siteId: 'farm', name: 'Other bench', usableM2: 100 });
  const rows = [planting('known', 1), planting('no-profile', 1, { cropKey: 'lettuce' })];
  const forecast = buildNurseryForecast(rows, beds, 'farm', config, now);
  assert.deepEqual(forecast.containers[0].peak, [1, 1]);
  assert.equal(forecast.containers[0].incomplete, true);
  assert.equal(forecast.containers[1].peak, null);
  assert.equal(forecast.containers[1].shortage, null);
  assert.equal(forecast.containers[1].weeks[0].incomplete, true);
  assert.equal(forecast.spaces[1].peak, null);
  assert.equal(forecast.spaces[1].incomplete, true);
});
