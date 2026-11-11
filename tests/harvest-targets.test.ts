import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestHarvestTargets, autoSuggestPlan, type AutoSuggestAnswers } from '@/lib/crop-autosuggest';
import { cropByKey } from '@/lib/crop-catalog';
import {
  benchmarkAreaConflictDetails, estimatedYieldKg, loadCropPlan, saveCropPlan, sanitiseHarvestTargets,
  tasksForPlan, taskMonthsFromNow, type HarvestTarget, type PlanBed, type Planting,
} from '@/lib/crop-plan';
import { assessHarvestTarget, earliestReadyMonthIndex, targetDemand, targetPickingWindow, type HarvestTargetAssessment } from '@/lib/harvest-targets';
import { bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';

const now = { year: 2026, month: 11 };
const answers: AutoSuggestAnswers = { goal: 'commercial', groups: [], rhythm: 'steady',
  rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true, allowMixedCropsInBed: true };
const beds: PlanBed[] = Array.from({ length: 4 }, (_, i) => ({ id: `bed-${i}`, label: `Block A / Bed ${i + 1}`, areaM2: 20, minDimM: 1 }));
const target: HarvestTarget = { id: 'buyer-a', siteId: 'farm-a', cropKey: 'carrots', weeklyKg: 3, startMonth: '2027-01', endMonth: '2027-12' };
const suggest = (ts = [target], bs = beds, ps: Planting[] = [], a = answers) => suggestHarvestTargets(ts, 'farm-a', a, 'mild-frost', bs, ps, now);

test('weekly demand uses actual days including leap February and a December–January boundary',async()=>{
  assert.deepEqual(targetDemand({ ...target, weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02' }), { days: 29, demandKg: 29 });
  assert.deepEqual(targetDemand({ ...target, weeklyKg: 7, startMonth: '2026-12', endMonth: '2027-01' }), { days: 62, demandKg: 62 });
  const a = assessHarvestTarget(target, [], [])!;
  assert.equal(a.cycleAreaM2, a.demandKg / cropByKey(target.cropKey)!.yieldKgPerM2!);
});

test('corrupt targets cannot produce infinite demand, unknown crops or multi-year promises',async()=>{
  for (const patch of [{ weeklyKg: NaN }, { weeklyKg: Infinity }, { weeklyKg: -1 }, { weeklyKg: Number.MAX_VALUE },
    { cropKey: 'unidentified' }, { startMonth: '2027-13' }, { endMonth: '2026-12' }, { endMonth: '2028-01' },
    { siteId: '' }, { id: '' }]) assert.equal(sanitiseHarvestTargets([{ ...target, ...patch }]).length, 0);
  assert.deepEqual(sanitiseHarvestTargets([target, target, null]), [target]);
});

test('target sowings are dated, add-only, demand-limited and generate the existing task calendar',async()=>{
  const original = structuredClone({ beds, target });
  const result = suggest();
  assert.ok(result.plantings.length > 1, 'a small repeated demand can be spread across legal cohorts');
  assert.deepEqual({ beds, target }, original, 'measured area and requested demand remain untouched');
  assert.ok(result.plantings.every((p) => p.once && p.harvestTargetId === target.id && p.cropKey === target.cropKey));
  assert.equal(benchmarkAreaConflictDetails(result.plantings, beds).length, 0);
  const a = assessHarvestTarget(target, beds, result.plantings)!;
  assert.ok(a.allocatedKg >= a.demandKg);
  assert.ok(a.surplusKg < Math.max(...beds.map((b) => b.areaM2)) * cropByKey(target.cropKey)!.yieldKgPerM2!);
  assert.ok(a.gapMonths.includes('2027-01'), 'enough annual volume must not erase a seasonal gap');
  assert.equal(suggest([target], beds, result.plantings).plantings.length, 0, 'accepted volume is not sold a second time on re-run');
  const tasks = tasksForPlan(result.plantings, beds, now.month);
  assert.ok(tasks.some((t) => t.action === 'sow'));
  assert.ok(tasks.some((t) => t.action === 'harvest'));
  for (const row of result.plantings) {
    const sow = tasks.find((t) => t.plantingId === row.id && t.action === 'sow')!;
    assert.equal(taskMonthsFromNow(sow, now.month), Number(row.once!.slice(0, 4)) * 12 + Number(row.once!.slice(5)) - 1 - (now.year * 12 + now.month - 1));
  }
});

test('other sites and unlinked crops are not double-counted against a buyer target',async()=>{
  const result = suggest();
  const unrelated = result.plantings.map(({ harvestTargetId: _target, ...row }) => row);
  assert.equal(assessHarvestTarget(target, beds, unrelated)!.allocatedKg, 0);
  assert.equal(suggest([{ ...target, siteId: 'farm-b' }]).plantings.length, 0);
  const other = { ...target, id: 'buyer-b' };
  assert.equal(assessHarvestTarget(other, beds, result.plantings)!.allocatedKg, 0);
});

test('missing yield evidence stays visible without making up a crop weight',async()=>{
  const t = { ...target, cropKey: 'amadumbe' };
  const a = assessHarvestTarget(t, beds, [])!;
  assert.equal(a.cycleAreaM2, null);
  assert.equal(a.missingBasis, true);
  assert.equal(a.allocatedKg, 0);
  assert.equal(suggest([t]).plantings.length, 0);
  assert.ok(suggest([t]).notes.some((n) => n.kind === 'gap' && n.text.includes('evidence')));
});

test('a partly overlapping picking window is not prorated into invented weekly output',async()=>{
  const row: Planting = { id: 'chard', bedId: beds[0].id, cropKey: 'swiss-chard', sowMonth: 11, once: '2026-11', harvestTargetId: target.id };
  const t = { ...target, cropKey: row.cropKey, startMonth: '2027-01', endMonth: '2027-01' };
  assert.deepEqual(targetPickingWindow(row, t), []);
  assert.equal(assessHarvestTarget(t, beds, [row])!.allocatedKg, 0);
  const whole = { ...t, endMonth: '2027-04' };
  assert.deepEqual(targetPickingWindow(row, whole), [2027 * 12, 2027 * 12 + 1, 2027 * 12 + 2, 2027 * 12 + 3]);
  assert.equal(assessHarvestTarget(whole, beds, [row])!.allocatedKg, beds[0].areaM2 * cropByKey(row.cropKey)!.yieldKgPerM2!);
});

test('a sowing that could be ready before the buyer\'s window opens is credited as before and the grower is told',async()=>{
  // CP-079 (10 November 2026 accuracy audit). The picking month is the LATE edge: upper
  // published duration, rounded up, after a two-month nursery. Cabbage sown in January is
  // credited to an August order (1 + 2 + ceil(125/30) = month 8), while its published range
  // starts at 65 days — after the shortest one-month nursery it could be cut from April.
  // The credit is deliberately unchanged; what was missing was any word of this on screen.
  const cabbage: Planting = { id: 'cab', bedId: beds[0].id, cropKey: 'cabbage', sowMonth: 1, once: '2027-01', harvestTargetId: target.id };
  const order = { ...target, cropKey: 'cabbage', startMonth: '2027-08', endMonth: '2027-08' };
  assert.deepEqual(targetPickingWindow(cabbage, order), [2027 * 12 + 7], 'fixture: the January sowing is credited to August');
  assert.equal(earliestReadyMonthIndex(cabbage, 2027 * 12 + 7), 2027 * 12 + 0 + 1 + Math.floor(65 / 30));
  const early = assessHarvestTarget(order, beds, [cabbage])!;
  assert.equal(early.allocatedKg, beds[0].areaM2 * cropByKey('cabbage')!.yieldKgPerM2!, 'the credit itself must not change');
  assert.equal(early.earlyCycles, 1);
  assert.equal(early.earliestReadyMonth, '2027-04', 'January + one nursery month + two whole months of 65 days = April');

  // A window that already covers the early end has nothing to warn about.
  const covered = assessHarvestTarget({ ...order, startMonth: '2027-04' }, beds, [cabbage])!;
  assert.equal(covered.earlyCycles, 0);
  assert.equal(covered.earliestReadyMonth, null);

  // A direct-sown crop has no nursery month: carrots sown in November (80-120 days) could
  // be ready from January, so a January order is not early and a February one is.
  const carrots: Planting = { id: 'car', bedId: beds[1].id, cropKey: 'carrots', sowMonth: 11, once: '2026-11', harvestTargetId: target.id };
  assert.equal(earliestReadyMonthIndex(carrots, 0), 2026 * 12 + 10 + 2);
  assert.equal(assessHarvestTarget({ ...target, startMonth: '2027-01', endMonth: '2027-06' }, beds, [carrots])!.earlyCycles, 0);
  assert.equal(assessHarvestTarget({ ...target, startMonth: '2027-02', endMonth: '2027-06' }, beds, [carrots])!.earlyCycles, 1);

  // A row that is excluded from the credit is never counted as an early one either.
  const excluded = assessHarvestTarget(order, beds, [{ ...cabbage, awaitingSowingConfirmation: true }])!;
  assert.equal(excluded.allocatedKg, 0);
  assert.equal(excluded.earlyCycles, 0);
});

test('overbooked, pending, finished, missing and incorrectly dated allocations cannot inflate capacity',async()=>{
  const result = suggest();
  const row = result.plantings[0];
  for (const change of [{ awaitingSowingConfirmation: true }, { finishedOnceSowing: true }, { bedId: 'gone' },
    { once: '2027-13' }, { cropKey: 'cabbage' }, { areaFraction: NaN }] as const) {
    const a: HarvestTargetAssessment = assessHarvestTarget(target, beds, [{ ...row, ...change }])!;
    assert.equal(a.allocatedKg, 0);
    assert.equal(a.excludedRows, 1);
  }
  const conflict = { ...row, id: 'other-crop', harvestTargetId: undefined, areaFraction: 1 };
  assert.equal(assessHarvestTarget(target, beds, [row, conflict])!.allocatedKg, 0);
  const confirmed = { ...row, once: undefined, existing: true, confirmedOnceSowing: row.once };
  assert.equal(assessHarvestTarget(target, beds, [confirmed])!.allocatedKg, assessHarvestTarget(target, beds, [row])!.allocatedKg);
});

test('whole open fields stay indivisible and plot-only crops do not leak into beds',async()=>{
  const t = { ...target, cropKey: 'maize', weeklyKg: 0.1 };
  assert.equal(suggest([t], beds).plantings.length, 0);
  const plots: PlanBed[] = [{ id: 'field', label: 'Open field', areaM2: 100, kind: 'plot' }];
  const result = suggest([t], plots);
  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((p) => (p.areaFraction ?? 1) === 1));
  assert.ok(assessHarvestTarget(t, plots, result.plantings)!.surplusKg > 0);
});

test('existing crops block occupied ground and a sales target cannot waive rotation',async()=>{
  const bs = [beds[0]];
  const t = { ...target, cropKey: 'cabbage', startMonth: '2027-06', endMonth: '2027-06' };
  const existing: Planting[] = [{ id: 'previous', bedId: bs[0].id, cropKey: 'broccoli', sowMonth: 6, existing: true }];
  const original = structuredClone(existing);
  const result = suggest([t], bs, existing);
  assert.equal(result.plantings.length, 0);
  assert.ok(result.notes.some((n) => n.text.includes('rotation conflicts')));
  assert.deepEqual(existing, original);
  const occupied = beds.map((b, i) => ({ id: `saved-${i}`, bedId: b.id, cropKey: 'carrots', sowMonth: 11, once: '2026-11' }));
  const short = { ...target, startMonth: '2027-03', endMonth: '2027-03' };
  assert.equal(suggest([short], beds, occupied).plantings.length, 0);
});

test('water and source-calendar gates apply to targets and restore the ordinary planner context',async()=>{
  const baseline = autoSuggestPlan(answers, 'mild-frost', beds, [], now.month, now);
  const dry = suggest([target], beds, [], { ...answers, reliableIrrigation: false });
  assert.equal(dry.plantings.length, 0);
  assert.ok(dry.notes.some((n) => n.kind === 'warning' && n.text.includes('water')));
  const frozen = suggest([target], beds, [], { ...answers, observedFrostMonths: Array.from({ length: 12 }, (_, i) => i + 1), siteMonthlyTempC: Array(12).fill(50) });
  assert.equal(frozen.plantings.length, 0);
  assert.deepEqual(autoSuggestPlan(answers, 'mild-frost', beds, [], now.month, now), baseline);
});

test('an unverified incumbent cannot silently release a bed for promised target capacity',async()=>{
  const saved: Planting[] = [{ id: 'unverified', bedId: beds[0].id, cropKey: 'unknown-saved-key', sowMonth: 11, existing: true }];
  const result = suggest([target], [beds[0]], saved);
  assert.equal(result.plantings.length, 0);
  assert.ok(result.notes.some((n) => n.kind === 'warning' && n.bedIds?.includes(beds[0].id)));
});

test('a large order is shared between legal sowing cohorts instead of putting nearly every bed in the first month',async()=>{
  const mappedBeds = Array.from({ length: 24 }, (_, i) => ({ id: `mapped-${i}`, label: `Block / Bed ${i}`, areaM2: 12 * 1.2, minDimM: 1.2 }));
  const order = { ...target, weeklyKg: 5, startMonth: '2026-11', endMonth: '2027-10' };
  const result = suggestHarvestTargets([order], order.siteId, { ...answers, allowMixedCropsInBed: false }, 'summer', mappedBeds, [], now);
  const bySow = new Map<string, number>();
  for (const row of result.plantings) bySow.set(row.once!, (bySow.get(row.once!) ?? 0) + estimatedYieldKg(row, mappedBeds[0].areaM2));
  assert.ok(bySow.size > 1, 'this source calendar has several legal cohorts in the requested window');
  const capacities = [...bySow.values()];
  const oneBedKg = mappedBeds[0].areaM2 * cropByKey(order.cropKey)!.yieldKgPerM2!;
  assert.ok(Math.max(...capacities) - Math.min(...capacities) <= oneBedKg + 0.000001,
    'whole-bed rounding may differ by one bed; a one-bed-per-month first pass must not dump the rest into the earliest cohort');
  assert.equal(assessHarvestTarget(order, mappedBeds, result.plantings, now)!.shortageKg, 0);
});

test('raising a target can add a free share to an accepted cohort without replacing its saved row or task identity',async()=>{
  const small = { ...target, weeklyKg: 0.1 };
  const first = suggest([small], [beds[0]]).plantings;
  assert.equal(first.length, 1);
  const original = structuredClone(first);
  const bigger = { ...small, weeklyKg: 0.5 };
  const extra = suggest([bigger], [beds[0]], first).plantings;
  assert.ok(extra.some((p) => p.once === first[0].once && p.bedId === first[0].bedId));
  assert.ok(extra.every((p) => !first.some((old) => old.id === p.id)));
  assert.deepEqual(first, original);
  assert.equal(assessHarvestTarget(bigger, [beds[0]], [...first, ...extra], now)!.shortageKg, 0);
  assert.equal(suggest([bigger], [beds[0]], [...first, ...extra]).plantings.length, 0);
});

test('a finished cohort retains its history while replacement sowing tasks get new identities',async()=>{
  const order = { ...target, weeklyKg: 0.1 };
  const finished = suggest([order], [beds[0]]).plantings.map((p) => ({ ...p, finishedOnceSowing: true as const }));
  const replacement = suggest([order], [beds[0]], finished).plantings;
  assert.ok(replacement.length > 0);
  assert.ok(replacement.every((p) => !finished.some((old) => old.id === p.id)));
  assert.ok(assessHarvestTarget(order, [beds[0]], [...finished, ...replacement], now)!.allocatedKg > 0);
});

test('saved targets round-trip with an account and old crop plans still load without targets',async()=>{
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage: { getItem: () => null }, dispatchEvent: () => true } });
  bindMountedAccountLocalStorageUid('harvest-owner');
  try {
    await initialiseCropPlanFixture();
    assert.equal(saveCropPlan({ version: 1, plantings: [], harvestTargets: [target], updatedAt: 1 }), true);
    assert.deepEqual(loadCropPlan().harvestTargets, [target]);
    assert.equal(saveCropPlan({ version: 1, plantings: [], updatedAt: 2 }), true);
    assert.equal(loadCropPlan().harvestTargets, undefined);
    // Non-JSON quantities cannot be silently serialized into a different claim.
    const before = readCanonicalCropPlanFixtureRaw();
    assert.equal(saveCropPlan({ version: 1, plantings: [], harvestTargets: [target, { ...target, id: 'bad', weeklyKg: Infinity }], updatedAt: 3 }), false);
    assert.equal(readCanonicalCropPlanFixtureRaw(), before);
    assert.equal(loadCropPlan().harvestTargets, undefined);
  } finally {
    releaseCropPlanFixture();
    bindMountedAccountLocalStorageUid(null);
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('produce packs retain their own unit and conversion rather than borrowing a universal bunch weight',async()=>{
  const { weeklyKg: _kg, ...base } = target;
  for (const unit of ['bunches', 'bags', 'crates', 'trays', 'each'] as const) {
    const pack = { ...base, unit, weeklyQuantity: 6, kgPerUnit: 0.5, outlet: 'Saturday market' };
    assert.deepEqual(sanitiseHarvestTargets([pack]), [pack]);
    assert.deepEqual(targetDemand(pack), targetDemand(target));
    assert.deepEqual(suggestHarvestTargets([pack], 'farm-a', answers, 'mild-frost', beds, [], now).plantings, suggest().plantings);
  }
  const unknown = { ...base, unit: 'bunches' as const, weeklyQuantity: 6 };
  assert.deepEqual(sanitiseHarvestTargets([unknown]), [unknown]);
  assert.equal(targetDemand(unknown)!.demandKg, null);
  const assessment = assessHarvestTarget(unknown, beds, [])!;
  assert.equal(assessment.cycleAreaM2, null);
  assert.equal(assessment.shortageKg, null);
  assert.equal(assessment.surplusKg, null);
  assert.deepEqual(assessment.missingReasons, ['unit-weight']);
  const result = suggestHarvestTargets([unknown], 'farm-a', answers, 'mild-frost', beds, [], now);
  assert.equal(result.plantings.length, 0);
  assert.ok(result.notes.some((n) => n.text.includes('conversion')));
});

test('invalid pack counts, conflicting mass fields and impossible allowances cannot become target evidence',async()=>{
  const { weeklyKg: _kg, ...base } = target;
  const pack = { ...base, unit: 'each', weeklyQuantity: 6, kgPerUnit: 0.5 };
  for (const patch of [{ weeklyQuantity: 1.5 }, { weeklyQuantity: 0 }, { weeklyQuantity: Infinity },
    { kgPerUnit: 0 }, { kgPerUnit: -1 }, { kgPerUnit: NaN }, { kgPerUnit: Infinity },
    { kgPerUnit: Number.MAX_VALUE }, { weeklyKg: 3 }, { unit: 'kg' }, { unit: 'eggs' }, { unit: 'jars' },
    { unit: 'seedlings' }, { marketablePercent: -1 }, { marketablePercent: 101 },
    { marketablePercent: NaN }, { outlet: 'x'.repeat(121) }]) {
    assert.equal(sanitiseHarvestTargets([{ ...pack, ...patch }]).length, 0, JSON.stringify(patch));
  }
  assert.deepEqual(sanitiseHarvestTargets([{ ...pack, unit: ' BUNCHES ', outlet: '  Market  ' }]),
    [{ ...pack, unit: 'bunches', outlet: 'Market' }]);
  assert.equal(sanitiseHarvestTargets([{ ...target, kgPerUnit: 0.5 }]).length, 0);
});

test('a grower saleable allowance increases target area without changing the catalogue or gross harvest benchmark',async()=>{
  const crop = structuredClone(cropByKey(target.cropKey));
  const half = { ...target, marketablePercent: 50 };
  const rows = suggest().plantings;
  const before = structuredClone({ beds, rows });
  const gross = assessHarvestTarget(target, beds, rows, now)!;
  const saleable = assessHarvestTarget(half, beds, rows, now)!;
  assert.equal(saleable.grossCycleKg, gross.allocatedKg);
  assert.equal(saleable.allocatedKg, gross.allocatedKg / 2);
  assert.equal(saleable.cycleAreaM2, gross.cycleAreaM2! * 2);
  assert.equal(saleable.shortageKg, Math.max(0, saleable.demandKg - saleable.allocatedKg));
  const zero = { ...target, marketablePercent: 0 };
  const blocked = assessHarvestTarget(zero, beds, rows, now)!;
  assert.equal(blocked.allocatedKg, 0);
  assert.equal(blocked.cycleAreaM2, null);
  assert.deepEqual(blocked.missingReasons, ['zero-saleable-share']);
  assert.equal(suggest([zero]).plantings.length, 0);
  assert.equal(assessHarvestTarget({ ...target, marketablePercent: 100 }, beds, rows, now)!.allocatedKg, gross.allocatedKg);
  assert.deepEqual({ beds, rows }, before);
  assert.deepEqual(cropByKey(target.cropKey), crop);
});

test('saleable targets allocate additional real space and keep accepted rows when the allowance changes',async()=>{
  const order = { ...target, weeklyKg: 0.5 };
  const first = suggest([order]).plantings;
  const copy = structuredClone(first);
  const allowance = { ...order, marketablePercent: 50 };
  const extra = suggest([allowance], beds, first).plantings;
  assert.ok(extra.length > 0, 'saleable demand needs more growing capacity than the gross benchmark');
  assert.equal(assessHarvestTarget(allowance, beds, [...first, ...extra], now)!.shortageKg, 0);
  assert.ok(extra.every((p) => !first.some((saved) => saved.id === p.id)));
  assert.deepEqual(first, copy);
});

test('unknown pack weights and private outlet assumptions survive the existing account-scoped plan store',async()=>{
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage: { getItem: () => null }, dispatchEvent: () => true } });
  const { weeklyKg: _kg, ...base } = target;
  const pack = { ...base, unit: 'bunches' as const, weeklyQuantity: 10, marketablePercent: 75, outlet: 'Private restaurant order' };
  bindMountedAccountLocalStorageUid('pack-owner');
  try {
    await initialiseCropPlanFixture();
    assert.equal(saveCropPlan({ version: 1, plantings: [], harvestTargets: [pack], updatedAt: 1 }), true);
    assert.deepEqual(loadCropPlan().harvestTargets, [pack]);
    bindMountedAccountLocalStorageUid('different-account');
    await initialiseCropPlanFixture();
    assert.equal(loadCropPlan().harvestTargets, undefined);
    bindMountedAccountLocalStorageUid('pack-owner');
    await initialiseCropPlanFixture();
    assert.deepEqual(loadCropPlan().harvestTargets, [pack]);
  } finally {
    releaseCropPlanFixture();
    bindMountedAccountLocalStorageUid(null);
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
