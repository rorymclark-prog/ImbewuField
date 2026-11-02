import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmOnceSowing, seedBoqBatchesForPlan, settleOnceRows, tasksForPlan, type Planting, type PlanBed } from '@/lib/crop-plan';
import { buildNurseryForecast } from '@/lib/crop-export-schedule';
import type { NurseryProfile, NurserySettings } from '@/lib/nursery-settings';

// Entered examples exercise arithmetic; these are not recommended nursery rates.
const NOW = { year: 2026, month: 11 };
const BEDS: PlanBed[] = [{ id: 'a', label: 'Bed A', areaM2: 0.4 }];
const ROW: Planting = { id: 'one', bedId: 'a', cropKey: 'cabbage', sowMonth: 11 };
const PROFILE: NurseryProfile = {
  id: 'recipe', siteId: 'this-farm', cropKey: 'cabbage', model: 'seed-cell',
  containerId: 'tray', spaceId: 'bench', germinationPercent: 100,
  nurserySurvivalPercent: 100, nurseryWeeks: 4,
};
function settings(profile: Partial<NurseryProfile> = {}): NurserySettings {
  return {
    version: 1,
    spaces: [{ id: 'bench', siteId: 'this-farm', name: 'Measured bench', usableM2: 1 }],
    containers: [{ id: 'tray', siteId: 'this-farm', name: 'Entered tray', cells: 3, widthCm: 50, lengthCm: 40, owned: 1 }],
    profiles: [{ ...PROFILE, ...profile }],
  };
}
const forecast = (config = settings(), rows = [ROW], beds = BEDS) =>
  buildNurseryForecast(rows, beds, 'this-farm', config, NOW);

test('split beds order one shared cohort instead of rounding each tiny allocation into another tray', () => {
  const beds: PlanBed[] = [{ id: 'a', label: 'A', areaM2: 0.2 }, { id: 'b', label: 'B', areaM2: 0.2 }];
  const rows = [{ ...ROW }, { ...ROW, id: 'two', bedId: 'b' }];
  const combined = forecast(settings(), rows, beds);
  assert.equal(combined.cohorts.length, 1);
  assert.deepEqual(combined.cohorts[0].positions, seedBoqBatchesForPlan(rows, beds)[0].finalPlantPositionsRange);
  assert.deepEqual(combined.cohorts[0].positions, [1, 3]);
  assert.deepEqual(combined.cohorts[0].trays, [1, 1], 'two separately rounded trays would over-order');
  assert.deepEqual(new Set(combined.cohorts[0].plantingIds), new Set(['one', 'two']));
});

test('entered varieties keep separate physical sowing batches even on the same crop and month', () => {
  const rows = [{ ...ROW, variety: 'Grower batch A' }, { ...ROW, id: 'two', variety: 'Grower batch B' }];
  const result = forecast(settings(), rows);
  assert.equal(result.cohorts.length, 2);
  assert.deepEqual(new Set(result.cohorts.map((row) => row.variety)), new Set(['Grower batch A', 'Grower batch B']));
  assert.deepEqual(result.cumulativeTrayUses, [2, 2]);
  assert.deepEqual(result.peakTrays, [2, 2]);
});

test('a future dated year cannot become an order for the nearer same-named month', () => {
  const rows = [{ ...ROW, once: '2026-11' }, { ...ROW, id: 'later-year', once: '2027-11' }];
  const result = forecast(settings(), rows);
  assert.equal(result.cohorts.length, 1);
  assert.equal(result.cohorts[0].sowMonth, '2026-11');
  assert.deepEqual(result.cohorts[0].plantingIds, ['one']);
  assert.deepEqual(result.cohorts[0].trays, [1, 1]);
  const january = forecast(settings(), [{ ...ROW, sowMonth: 1, once: '2027-01' }]);
  assert.equal(january.cohorts[0].sowMonth, '2027-01');
  assert.equal(january.cohorts[0].fieldMonth, '2027-03');
});

test('one-seed-per-cell demand compounds two entered nursery losses and keeps field losses separate', () => {
  const config = settings({ germinationPercent: 50, nurserySurvivalPercent: 50 });
  const noFieldAllowance = forecast(config).cohorts[0];
  assert.deepEqual(noFieldAllowance.positions, [1, 3]);
  assert.deepEqual(noFieldAllowance.starts, [1, 3]);
  assert.deepEqual(noFieldAllowance.seeds, [4, 12]);
  assert.deepEqual(noFieldAllowance.trays, [2, 4]);
  assert.deepEqual(noFieldAllowance.areaM2, [0.4, 0.8]);
  const withFieldAllowance = forecast(settings({ ...config.profiles[0], fieldSurvivalPercent: 50 })).cohorts[0];
  assert.deepEqual(withFieldAllowance.starts, [2, 6]);
  assert.deepEqual(withFieldAllowance.seeds, [8, 24]);
  assert.deepEqual(withFieldAllowance.trays, [3, 8]);
});

test('measured multi-sown tray output already includes nursery losses and is not capped by cell count', () => {
  const config = settings({ model: 'measured-tray', usableStartsPerTray: 6, seedsPerTray: 20,
    germinationPercent: 10, nurserySurvivalPercent: 10 });
  const row = forecast(config).cohorts[0];
  assert.deepEqual(row.trays, [1, 1], 'six measured starts can come from this three-cell multi-sown tray');
  assert.deepEqual(row.seeds, [20, 20], 'do not apply the discarded seed-cell loss rates again');
  const missingSeedCount = forecast(settings({ model: 'measured-tray', usableStartsPerTray: 6 })).cohorts[0];
  assert.deepEqual(missingSeedCount.trays, [1, 1]);
  assert.deepEqual(missingSeedCount.areaM2, [0.2, 0.2]);
  assert.equal(missingSeedCount.seeds, null);
});

test('a missing germination or survival observation does not silently become perfect success', () => {
  for (const patch of [{ germinationPercent: undefined }, { nurserySurvivalPercent: undefined }]) {
    const result = forecast(settings(patch));
    assert.equal(result.cohorts[0].seeds, null);
    assert.equal(result.cohorts[0].trays, null);
    assert.equal(result.incomplete, true);
  }
});

test('zero success cannot size a viable sowing while zero tray stock and bench area are real shortages', () => {
  for (const patch of [{ germinationPercent: 0 }, { nurserySurvivalPercent: 0 }, { fieldSurvivalPercent: 0 }]) {
    const result = forecast(settings(patch));
    assert.equal(result.cohorts[0].seeds, null);
    assert.equal(result.cohorts[0].trays, null);
    assert.equal(result.incomplete, true);
  }
  const config = settings();
  config.containers[0].owned = 0;
  config.spaces[0].usableM2 = 0;
  const result = forecast(config);
  assert.equal(result.containers[0].capacity, 0);
  assert.equal(result.containers[0].shortage, 1);
  assert.equal(result.spaces[0].capacity, 0);
  assert.equal(result.spaces[0].shortage, 0.2);
});

test('deleted dimensions leave unknown space demand instead of an apparent zero-area tray', () => {
  const config = settings();
  delete config.containers[0].lengthCm;
  const result = forecast(config);
  assert.deepEqual(result.cohorts[0].trays, [1, 1]);
  assert.equal(result.cohorts[0].areaM2, null);
  assert.equal(result.peakAreaM2, null);
  assert.equal(result.spaces[0].peak, null);
  assert.equal(result.spaces[0].shortage, null);
  assert.equal(result.spaces[0].incomplete, true);
  assert.ok(result.weeks.some((week) => week.areaM2 === null && week.incomplete));
});

test('another farm cannot supply this farm with a recipe, container or bench through matching references', () => {
  for (const missing of ['profiles', 'containers', 'spaces'] as const) {
    const config = settings();
    config[missing][0].siteId = 'other-farm';
    const result = forecast(config);
    assert.equal(result.incomplete, true, `${missing} from another farm must remain missing`);
    if (missing !== 'spaces') assert.equal(result.cohorts[0].trays, null);
    if (missing === 'containers') assert.equal(result.cohorts[0].containerId, undefined);
    if (missing === 'spaces') assert.equal(result.cohorts[0].spaceId, undefined);
    assert.ok(result.issues.some((issue) => /site|unknown/.test(issue)));
  }
});

test('reused trays need simultaneous peak stock rather than the seasonal total or all cohorts touching a week', () => {
  const rows = [{ ...ROW }, { ...ROW, id: 'next', sowMonth: 2 }];
  const result = forecast(settings(), rows);
  assert.equal(result.cohorts[0].endDateExclusive, '2027-02-01');
  assert.equal(result.cohorts[1].startDate, '2027-02-01');
  assert.deepEqual(result.cumulativeTrayUses, [2, 2]);
  assert.deepEqual(result.peakTrays, [1, 1]);
  assert.deepEqual(result.containers[0].peak, [1, 1]);
  assert.equal(result.containers[0].shortage, 0);
  const boundaryWeek = result.weeks.find((week) => week.startDate === '2027-01-31');
  assert.ok(boundaryWeek, 'the fixture must include both cohorts in one reporting week');
  assert.deepEqual(boundaryWeek.trays, [1, 1], 'release happens before reservation at the same instant');
  const simultaneous = forecast(settings(), [{ ...ROW }, { ...ROW, id: 'overlap', sowMonth: 1 }]);
  assert.deepEqual(simultaneous.peakTrays, [2, 2], 'a real interval overlap must still require two trays');
  assert.equal(simultaneous.containers[0].shortage, 1);
});

test('unknown demand cannot disappear behind a smaller known cohort in the same nursery week', () => {
  const rows = [{ ...ROW }, { ...ROW, id: 'no-recipe', cropKey: 'lettuce' }];
  const result = forecast(settings(), rows);
  assert.deepEqual(result.peakTrays, [1, 1], 'this is the known lower bound only');
  assert.equal(result.incomplete, true);
  assert.ok(result.weeks.some((week) => week.incomplete && week.trays?.[1] === 1));
  assert.equal(result.cohorts.find((row) => row.cropKey === 'lettuce')?.trays, null);
});

test('long entered nursery duration exposes a readiness conflict without moving the field calendar or saved plan', () => {
  const config = settings({ nurseryWeeks: 20 });
  const rows = [{ ...ROW }];
  const before = JSON.stringify({ config, rows, beds: BEDS });
  const tasksBefore = tasksForPlan(rows, BEDS, NOW.month);
  const row = forecast(config, rows).cohorts[0];
  assert.equal(row.fieldMonth, '2027-01');
  assert.equal(row.readinessSource, 'grower');
  assert.equal(row.readinessConflict, true);
  assert.ok(row.endDateExclusive! > '2027-02-01', 'reserve resources beyond the working field month when readiness is later');
  assert.ok(row.issues.some((issue) => /field dates have not moved/.test(issue)));
  assert.deepEqual(tasksForPlan(rows, BEDS, NOW.month), tasksBefore);
  assert.equal(JSON.stringify({ config, rows, beds: BEDS }), before);
});

test('missing grower duration retains the shared coarse calendar envelope instead of inventing exact nursery days', () => {
  const row = forecast(settings({ nurseryWeeks: undefined })).cohorts[0];
  assert.equal(row.sowMonth, '2026-11');
  assert.equal(row.fieldMonth, '2027-01');
  assert.equal(row.readinessStartDate, '2026-12-01');
  assert.equal(row.readinessEndDateExclusive, '2027-03-01');
  assert.equal(row.endDateExclusive, '2027-03-01');
  assert.equal(row.readinessSource, 'published-calendar');
  assert.equal(row.readinessConflict, false);
});

test('positive rates too small for finite arithmetic remain incomplete rather than appearing fully sized', () => {
  const result = forecast(settings({ germinationPercent: Number.MIN_VALUE }));
  assert.equal(result.cohorts[0].seeds, null);
  assert.equal(result.cohorts[0].trays, null);
  assert.equal(result.incomplete, true);
  assert.ok(result.issues.length > 0);
  assert.equal(result.peakTrays, null);
});

test('invalid dates, orphaned beds and unresolved past sowings do not become finite purchase instructions', () => {
  const cases: Planting[] = [
    { ...ROW, sowMonth: 13 },
    { ...ROW, once: '2026-10' },
    { ...ROW, once: '2026-99' },
    { ...ROW, bedId: 'deleted' },
    { ...ROW, awaitingSowingConfirmation: true },
  ];
  for (const row of cases) {
    const result = forecast(settings(), [row]);
    assert.ok(result.cohorts.length > 0, 'keep the unresolved decision visible');
    assert.equal(result.cohorts[0].positions, null, JSON.stringify(row));
    assert.equal(result.cohorts[0].trays, null);
    assert.equal(result.incomplete, true);
  }
});

test('an old nursery observation and a finished crop do not return as another annual tray purchase', () => {
  const old: Planting = { ...ROW, existing: true, inNursery: '2025-11', confirmedOnceSowing: '2025-11' };
  assert.equal(forecast(settings(), [old]).cohorts.length, 0);
  assert.equal(forecast(settings(), [{ ...old, finishedOnceSowing: true }]).cohorts.length, 0);
  assert.equal(forecast(settings(), [{ ...ROW, cropKey: 'carrots' }]).cohorts.length, 0, 'direct field seed does not consume transplant trays');
});

test('reopening after the calendar nursery flag expires preserves the confirmed sowing reservation until its forecast ends', () => {
  const confirmed = confirmOnceSowing({ ...ROW, sowMonth: 10, once: '2026-10' }, 2026, 11);
  assert.equal(confirmed.inNursery, '2026-10');
  const reopened = settleOnceRows([confirmed], 2026, 12);
  assert.equal(reopened[0].inNursery, undefined, 'the field calendar retains its existing phase cutoff');
  const before = JSON.stringify(reopened);
  const tasks = tasksForPlan(reopened, BEDS, 12);
  for (const nurseryWeeks of [undefined, 20]) {
    const config = settings({ nurseryWeeks });
    const november = forecast(config, [confirmed]);
    const december = buildNurseryForecast(reopened, BEDS, 'this-farm', config, { year: 2026, month: 12 });
    assert.equal(december.cohorts.length, 1, 'calendar flag expiry is not evidence that the forecast trays are free');
    assert.equal(december.cohorts[0].phase, 'confirmed-sowing', 'a dated sowing is not a new nursery observation');
    assert.equal(december.cohorts[0].endDateExclusive, nurseryWeeks === undefined ? '2027-02-01' : '2027-03-21');
    assert.deepEqual(december.peakTrays, november.peakTrays);
    assert.deepEqual(december.cohorts[0].positions, [1, 3]);
    assert.equal(buildNurseryForecast(reopened, BEDS, 'this-farm', config, { year: 2027, month: 4 }).cohorts.length, 0,
      'the historical sowing cannot recur after its reservation ends');
  }
  assert.equal(JSON.stringify(reopened), before);
  assert.deepEqual(tasksForPlan(reopened, BEDS, 12), tasks);
});

test('confirmed reservation recovery still excludes established crops without valid dates and finished crops', () => {
  for (const patch of [{ confirmedOnceSowing: undefined }, { confirmedOnceSowing: '2026-99' },
    { confirmedOnceSowing: '2026-09' }, { confirmedOnceSowing: '2026-10', finishedOnceSowing: true as const }]) {
    const row = { ...ROW, existing: true, sowMonth: 10, ...patch };
    assert.equal(buildNurseryForecast([row], BEDS, 'this-farm', settings(), { year: 2026, month: 12 }).cohorts.length, 0);
  }
});

test('exact entered percentage boundaries do not invent an extra seed and a whole extra tray', () => {
  const beds = [{ ...BEDS[0], areaM2: 9.9 }];
  const config = settings({ germinationPercent: 50, nurserySurvivalPercent: 57 });
  config.containers[0].cells = 200;
  const exact = forecast(config, [ROW], beds);
  assert.deepEqual(exact.cohorts[0].positions, [36, 57]);
  assert.deepEqual(exact.cohorts[0].seeds, [127, 200], '57 / (50% × 57%) is exactly 200');
  assert.deepEqual(exact.cohorts[0].trays, [1, 1]);
  assert.equal(exact.containers[0].shortage, 0);
  const justBelow = structuredClone(config);
  justBelow.profiles[0].germinationPercent = 49.99999999999999;
  const larger = forecast(justBelow, [ROW], beds);
  assert.deepEqual(larger.cohorts[0].seeds, [127, 201], 'a genuinely higher requirement must still round upward');
  assert.deepEqual(larger.cohorts[0].trays, [1, 2]);
  assert.equal(larger.containers[0].shortage, 1);
});

test('decimal field survival and measured output use exact entered ratios at whole-start and tray boundaries', () => {
  const beds = [{ ...BEDS[0], areaM2: 9.9 }];
  const field = forecast(settings({ fieldSurvivalPercent: 28.5 }), [ROW], beds).cohorts[0];
  assert.deepEqual(field.starts, [127, 200], '57 / 28.5% is exactly 200 starts');
  const measured = settings({ model: 'measured-tray', usableStartsPerTray: 0.285, seedsPerTray: 2 });
  assert.deepEqual(forecast(measured, [ROW], beds).cohorts[0].trays, [127, 200]);
  measured.profiles[0].usableStartsPerTray = 0.2849999999999999;
  assert.deepEqual(forecast(measured, [ROW], beds).cohorts[0].trays, [127, 201]);
  measured.profiles[0].usableStartsPerTray = 2.85e-7;
  assert.deepEqual(forecast(measured, [ROW], beds).cohorts[0].trays, [126315790, 200000000],
    'scientific notation must preserve the same decimal ratio');
});
