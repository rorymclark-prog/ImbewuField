import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestHarvestTargets, autoSuggestPlan, type AutoSuggestAnswers } from '@/lib/crop-autosuggest';
import { cropByKey } from '@/lib/crop-catalog';
import {
  benchmarkAreaConflictDetails, loadCropPlan, saveCropPlan, sanitiseHarvestTargets,
  tasksForPlan, taskMonthsFromNow, type HarvestTarget, type PlanBed, type Planting,
} from '@/lib/crop-plan';
import { assessHarvestTarget, targetDemand, targetPickingWindow } from '@/lib/harvest-targets';
import { bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';

const now = { year: 2026, month: 11 };
const answers: AutoSuggestAnswers = { goal: 'commercial', groups: [], rhythm: 'steady',
  rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true, allowMixedCropsInBed: true };
const beds: PlanBed[] = Array.from({ length: 4 }, (_, i) => ({ id: `bed-${i}`, label: `Block A / Bed ${i + 1}`, areaM2: 20, minDimM: 1 }));
const target: HarvestTarget = { id: 'buyer-a', siteId: 'farm-a', cropKey: 'carrots', weeklyKg: 3, startMonth: '2027-01', endMonth: '2027-12' };
const suggest = (ts = [target], bs = beds, ps: Planting[] = [], a = answers) => suggestHarvestTargets(ts, 'farm-a', a, 'mild-frost', bs, ps, now);

test('weekly demand uses actual days including leap February and a December–January boundary', () => {
  assert.deepEqual(targetDemand({ ...target, weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02' }), { days: 29, demandKg: 29 });
  assert.deepEqual(targetDemand({ ...target, weeklyKg: 7, startMonth: '2026-12', endMonth: '2027-01' }), { days: 62, demandKg: 62 });
  const a = assessHarvestTarget(target, [], [])!;
  assert.equal(a.cycleAreaM2, a.demandKg / cropByKey(target.cropKey)!.yieldKgPerM2!);
});

test('corrupt targets cannot produce infinite demand, unknown crops or multi-year promises', () => {
  for (const patch of [{ weeklyKg: NaN }, { weeklyKg: Infinity }, { weeklyKg: -1 }, { weeklyKg: Number.MAX_VALUE },
    { cropKey: 'unidentified' }, { startMonth: '2027-13' }, { endMonth: '2026-12' }, { endMonth: '2028-01' },
    { siteId: '' }, { id: '' }]) assert.equal(sanitiseHarvestTargets([{ ...target, ...patch }]).length, 0);
  assert.deepEqual(sanitiseHarvestTargets([target, target, null]), [target]);
});

test('target sowings are dated, add-only, demand-limited and generate the existing task calendar', () => {
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

test('other sites and unlinked crops are not double-counted against a buyer target', () => {
  const result = suggest();
  const unrelated = result.plantings.map(({ harvestTargetId: _target, ...row }) => row);
  assert.equal(assessHarvestTarget(target, beds, unrelated)!.allocatedKg, 0);
  assert.equal(suggest([{ ...target, siteId: 'farm-b' }]).plantings.length, 0);
  const other = { ...target, id: 'buyer-b' };
  assert.equal(assessHarvestTarget(other, beds, result.plantings)!.allocatedKg, 0);
});

test('missing yield evidence stays visible without making up a crop weight', () => {
  const t = { ...target, cropKey: 'amadumbe' };
  const a = assessHarvestTarget(t, beds, [])!;
  assert.equal(a.cycleAreaM2, null);
  assert.equal(a.missingBasis, true);
  assert.equal(a.allocatedKg, 0);
  assert.equal(suggest([t]).plantings.length, 0);
  assert.ok(suggest([t]).notes.some((n) => n.kind === 'gap' && n.text.includes('evidence')));
});

test('a partly overlapping picking window is not prorated into invented weekly output', () => {
  const row: Planting = { id: 'chard', bedId: beds[0].id, cropKey: 'swiss-chard', sowMonth: 11, once: '2026-11', harvestTargetId: target.id };
  const t = { ...target, cropKey: row.cropKey, startMonth: '2027-01', endMonth: '2027-01' };
  assert.deepEqual(targetPickingWindow(row, t), []);
  assert.equal(assessHarvestTarget(t, beds, [row])!.allocatedKg, 0);
  const whole = { ...t, endMonth: '2027-04' };
  assert.deepEqual(targetPickingWindow(row, whole), [2027 * 12, 2027 * 12 + 1, 2027 * 12 + 2, 2027 * 12 + 3]);
  assert.equal(assessHarvestTarget(whole, beds, [row])!.allocatedKg, beds[0].areaM2 * cropByKey(row.cropKey)!.yieldKgPerM2!);
});

test('overbooked, pending, finished, missing and incorrectly dated allocations cannot inflate capacity', () => {
  const result = suggest();
  const row = result.plantings[0];
  for (const change of [{ awaitingSowingConfirmation: true }, { finishedOnceSowing: true }, { bedId: 'gone' },
    { once: '2027-13' }, { cropKey: 'cabbage' }, { areaFraction: NaN }] as const) {
    const a = assessHarvestTarget(target, beds, [{ ...row, ...change }])!;
    assert.equal(a.allocatedKg, 0);
    assert.equal(a.excludedRows, 1);
  }
  const conflict = { ...row, id: 'other-crop', harvestTargetId: undefined, areaFraction: 1 };
  assert.equal(assessHarvestTarget(target, beds, [row, conflict])!.allocatedKg, 0);
  const confirmed = { ...row, once: undefined, existing: true, confirmedOnceSowing: row.once };
  assert.equal(assessHarvestTarget(target, beds, [confirmed])!.allocatedKg, assessHarvestTarget(target, beds, [row])!.allocatedKg);
});

test('whole open fields stay indivisible and plot-only crops do not leak into beds', () => {
  const t = { ...target, cropKey: 'maize', weeklyKg: 0.1 };
  assert.equal(suggest([t], beds).plantings.length, 0);
  const plots: PlanBed[] = [{ id: 'field', label: 'Open field', areaM2: 100, kind: 'plot' }];
  const result = suggest([t], plots);
  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((p) => (p.areaFraction ?? 1) === 1));
  assert.ok(assessHarvestTarget(t, plots, result.plantings)!.surplusKg > 0);
});

test('existing crops block occupied ground and a sales target cannot waive rotation', () => {
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

test('water and source-calendar gates apply to targets and restore the ordinary planner context', () => {
  const baseline = autoSuggestPlan(answers, 'mild-frost', beds, [], now.month, now);
  const dry = suggest([target], beds, [], { ...answers, reliableIrrigation: false });
  assert.equal(dry.plantings.length, 0);
  assert.ok(dry.notes.some((n) => n.kind === 'warning' && n.text.includes('water')));
  const frozen = suggest([target], beds, [], { ...answers, observedFrostMonths: Array.from({ length: 12 }, (_, i) => i + 1), siteMonthlyTempC: Array(12).fill(50) });
  assert.equal(frozen.plantings.length, 0);
  assert.deepEqual(autoSuggestPlan(answers, 'mild-frost', beds, [], now.month, now), baseline);
});

test('an unverified incumbent cannot silently release a bed for promised target capacity', () => {
  const saved: Planting[] = [{ id: 'unverified', bedId: beds[0].id, cropKey: 'unknown-saved-key', sowMonth: 11, existing: true }];
  const result = suggest([target], [beds[0]], saved);
  assert.equal(result.plantings.length, 0);
  assert.ok(result.notes.some((n) => n.kind === 'warning' && n.bedIds?.includes(beds[0].id)));
});

test('saved targets round-trip with an account and old crop plans still load without targets', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage: { getItem: () => null }, dispatchEvent: () => true } });
  bindMountedAccountLocalStorageUid('harvest-owner');
  try {
    assert.equal(saveCropPlan({ version: 1, plantings: [], harvestTargets: [target], updatedAt: 1 }), true);
    assert.deepEqual(loadCropPlan().harvestTargets, [target]);
    assert.equal(saveCropPlan({ version: 1, plantings: [], updatedAt: 2 }), true);
    assert.equal(loadCropPlan().harvestTargets, undefined);
    assert.equal(saveCropPlan({ version: 1, plantings: [], harvestTargets: [target, { ...target, id: 'bad', weeklyKg: Infinity }], updatedAt: 3 }), true);
    assert.deepEqual(loadCropPlan().harvestTargets, [target]);
  } finally {
    bindMountedAccountLocalStorageUid(null);
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
