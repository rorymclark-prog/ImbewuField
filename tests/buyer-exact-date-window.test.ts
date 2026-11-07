import { crop, local, probe, reset, cleanup, siteId, ownRow, stamp } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, readCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState, HarvestTarget, MonthlyHarvestTarget, DatedHarvestTarget, Planting } from '../lib/crop-plan.ts';
import { targetDemand, targetPickingWindow, assessHarvestTarget } from '../lib/harvest-targets.ts';
import { suggestHarvestTargets, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { growerDemandFromHarvestTarget, projectGrowerBuyerPickingPeriods } from '../lib/international/grower-harvest-demand.ts';
import { assembleGrowerWorkflowReview } from '../lib/international/grower-workflow.ts';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/lib/nursery-save-receipt.ts') && specifier === 'firebase/auth') {
    return { shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(`
      export function onAuthStateChanged(_auth,callback){const p=globalThis.__growerOperationsFixture;
      p.auth.add(callback);return()=>p.auth.delete(callback);}`) };
  }
  return next(specifier, context);
} });
const receipts = await import('../lib/nursery-save-receipt.ts');
const { createHarvestSaveFixture } = await import('./nursery-save-fixture.ts');
beforeEach(reset);
afterEach(() => { assert.equal(probe.auth.size, 0, 'each explicit save authority must release its auth observer'); });
after(() => { hooks.deregister(); cleanup(); });

// Engineering quantities, dates and identities only; not farming or delivery advice.
const cropKey = CROPS[0].key;
const defaultWindow = { start: '2028-12-10', endExclusive: '2028-12-20' };
function monthly(): MonthlyHarvestTarget & { weeklyKg: number } {
  return { id: 'monthly-buyer', siteId, cropKey, startMonth: '2028-02', endMonth: '2028-02',
    outlet: 'Engineering buyer', marketablePercent: 50, weeklyKg: 7 };
}
function datedKg(window = defaultWindow): DatedHarvestTarget & { weeklyKg: number } {
  return { id: 'dated-buyer', siteId, cropKey, timing: 'date-window', window: { ...window },
    outlet: 'Engineering buyer', marketablePercent: 100, weeklyKg: 7 };
}
function datedPack(withWeight = true): DatedHarvestTarget {
  return { id: 'dated-pack', siteId, cropKey, timing: 'date-window', window: { ...defaultWindow },
    marketablePercent: 50, weeklyQuantity: 7, unit: 'bunches', ...(withWeight ? { kgPerUnit: 2 } : {}) };
}
const resolve = (value: unknown) => crop.resolveHarvestTargetDateWindow(value);
const normal = (value: unknown) => crop.sanitiseHarvestTargets([value]);
function invalidTiming(value: unknown): void {
  assert.equal(resolve(value), null);
  assert.deepEqual(normal(value), [], 'malformed dated intent cannot become a monthly saved target');
}
function book(targets: HarvestTarget[]): CropPlanState { return { version: 1, plantings: [], harvestTargets: targets, updatedAt: 7 }; }

test('valid legacy monthly Kg and Pack rows retain exact canonical JSON field order and quantity meanings', () => {
  const kg = monthly();
  assert.equal(JSON.stringify(normal({ ...kg, outlet: '  Engineering buyer  ' })), JSON.stringify([kg]));
  const pack: MonthlyHarvestTarget = { id: 'monthly-pack', siteId, cropKey, startMonth: '2028-02', endMonth: '2028-02',
    outlet: 'Engineering pack', marketablePercent: 50, weeklyQuantity: 7, unit: 'bunches', kgPerUnit: 2 };
  assert.equal(JSON.stringify(normal(pack)), JSON.stringify([pack]));
  assert.deepEqual(targetDemand(kg), { days: 29, demandKg: 29 });
  assert.deepEqual(targetDemand(pack), { days: 29, demandKg: 58 });
  assert.equal(crop.isMonthlyHarvestTarget(kg), true);
  assert.deepEqual(resolve(kg), { timing: 'monthly', start: '2028-02-01', endExclusive: '2028-03-01', days: 29 });
  const assessment = assessHarvestTarget(kg, [], [], { year: 2028, month: 2 });
  assert.ok(assessment);
  assert.equal(assessment.days, 29); assert.equal(assessment.demandKg, 29); assert.equal(assessment.allocatedKg, 0);
});

test('legacy inclusive month windows retain leap-year, year-crossing and twelve-month limits', () => {
  assert.deepEqual(resolve({ ...monthly(), startMonth: '2027-12', endMonth: '2028-01' }),
    { timing: 'monthly', start: '2027-12-01', endExclusive: '2028-02-01', days: 62 });
  assert.deepEqual(resolve({ ...monthly(), startMonth: '2028-01', endMonth: '2028-12' }),
    { timing: 'monthly', start: '2028-01-01', endExclusive: '2029-01-01', days: 366 });
  for (const patch of [{ startMonth: '2019-12' }, { endMonth: '2100-01' }, { endMonth: '2028-13' },
    { startMonth: '2028-03' }, { startMonth: '2028-01', endMonth: '2029-01' }]) invalidTiming({ ...monthly(), ...patch });
});

test('exact-date Kg rows keep only their explicit discriminator and half-open window without month mirrors', () => {
  const target = datedKg(), before = JSON.stringify(target);
  const result = normal(target); assert.equal(result.length, 1);
  assert.deepEqual(result[0], target);
  assert.equal(crop.isMonthlyHarvestTarget(result[0]), false);
  assert.deepEqual(resolve(target), { timing: 'date-window', ...defaultWindow, days: 10 });
  assert.deepEqual(targetDemand(result[0]), { days: 10, demandKg: 10 });
  assert.equal(Object.hasOwn(result[0], 'startMonth'), false);
  assert.equal(Object.hasOwn(result[0], 'endMonth'), false);
  assert.equal(JSON.stringify(target), before);
});

test('exact-date Pack quantities use only the entered pack weight and unknown conversion remains unknown', () => {
  const known = normal(datedPack())[0], unknown = normal(datedPack(false))[0];
  assert.ok(known); assert.ok(unknown);
  assert.deepEqual(targetDemand(known), { days: 10, demandKg: 20 });
  assert.deepEqual(targetDemand(unknown), { days: 10, demandKg: null });
  assert.equal(Object.hasOwn(unknown, 'kgPerUnit'), false);
  assert.equal(Object.hasOwn(unknown, 'weeklyKg'), false);
  assert.deepEqual(resolve(known), resolve(unknown));
});

test('timing resolution snapshots recognized data only and never evaluates irrelevant quantity or label getters', () => {
  let getters = 0, hooks = 0;
  for (const value of [monthly(), datedKg()]) {
    const input = { ...value };
    for (const key of ['weeklyKg', 'outlet', 'irrelevantPrivateField']) {
      Object.defineProperty(input, key, { enumerable: true, get() { getters++; throw Error('Irrelevant timing getter'); } });
    }
    Object.defineProperty(input, 'toJSON', { enumerable: true, value() { hooks++; return {}; } });
    assert.deepEqual(resolve(input), resolve(value));
  }
  assert.equal(getters, 0); assert.equal(hooks, 0);
});

test('recognized timing accessors and non-enumerable evidence are held without running getters', () => {
  let calls = 0;
  for (const [value, fields] of [[monthly(), ['startMonth', 'endMonth']], [datedKg(), ['timing', 'window']]] as const) {
    for (const key of fields) {
      const accessor = { ...value };
      Object.defineProperty(accessor, key, { enumerable: true, get() { calls++; throw Error('Unsafe timing getter'); } });
      assert.equal(resolve(accessor), null);
      const hidden = { ...value };
      Object.defineProperty(hidden, key, { enumerable: false, value: Reflect.get(value, key) });
      assert.equal(resolve(hidden), null);
    }
  }
  assert.equal(calls, 0);
});

test('window property presence, missing discriminator, undefined fields and dual timing intent never fall back to months', () => {
  const dated = datedKg();
  for (const value of [
    { ...monthly(), timing: undefined }, { ...monthly(), timing: null }, { ...monthly(), timing: 'monthly' },
    { ...monthly(), window: undefined }, { ...monthly(), window: null }, { ...monthly(), window: defaultWindow },
    { ...dated, timing: undefined }, { ...dated, timing: null }, { ...dated, timing: 'unknown' },
    { ...dated, window: undefined }, { ...dated, window: null },
    { ...dated, startMonth: undefined }, { ...dated, endMonth: undefined },
    { ...dated, startMonth: '2028-12' }, { ...dated, endMonth: '2028-12' },
  ]) invalidTiming(value);
  const { timing: _timing, ...withoutDiscriminator } = dated;
  invalidTiming(withoutDiscriminator);
  const { window: _window, ...withoutWindow } = dated;
  invalidTiming(withoutWindow);
  const { startMonth: _start, ...withoutStart } = monthly(); invalidTiming(withoutStart);
  const { endMonth: _end, ...withoutEnd } = monthly(); invalidTiming(withoutEnd);
});

test('window values are exact two-key plain data and reject getters, hooks, cycles, symbols and hidden fields', () => {
  let getters = 0, hooks = 0;
  const cyclic: Record<string, unknown> = { ...defaultWindow }; cyclic.self = cyclic;
  const hooked = { ...defaultWindow, toJSON() { hooks++; return defaultWindow; } };
  const getter = Object.defineProperty({ endExclusive: defaultWindow.endExclusive }, 'start', {
    enumerable: true, get() { getters++; return defaultWindow.start; },
  });
  const hidden = Object.defineProperty({ ...defaultWindow }, 'start', { enumerable: false, value: defaultWindow.start });
  const symbol = { ...defaultWindow, [Symbol('extra')]: true };
  for (const window of [undefined, null, '', [], {}, cyclic, hooked, getter, hidden, symbol,
    Object.create(defaultWindow), { ...defaultWindow, extra: true }, { start: defaultWindow.start },
    { ...defaultWindow, start: undefined }, { ...defaultWindow, endExclusive: undefined }]) {
    assert.equal(resolve({ ...datedKg(), window }), null);
  }
  assert.equal(getters, 0); assert.equal(hooks, 0);
});

test('inherited timing cannot supply authority, while null-prototype own timing data remains usable', () => {
  assert.equal(resolve(Object.create(monthly())), null);
  assert.equal(resolve(Object.create(datedKg())), null);
  const revoked = Proxy.revocable({}, {}); revoked.revoke();
  assert.equal(resolve(revoked.proxy), null);
  const plain = Object.assign(Object.create(null), datedKg());
  plain.window = Object.assign(Object.create(null), defaultWindow);
  assert.deepEqual(resolve(plain), { timing: 'date-window', ...defaultWindow, days: 10 });
});

test('arrays cannot become timing records by disguising their prototype, without invoking getters or hooks', () => {
  let getters = 0, hooks = 0;
  for (const prototype of [null, Object.prototype]) {
    for (const value of [monthly(), datedKg()]) {
      const disguised = Object.assign([], value);
      Object.defineProperty(disguised, 'irrelevantPrivateField', { enumerable: true,
        get() { getters++; throw Error('Disguised array getter'); } });
      Object.defineProperty(disguised, 'toJSON', { enumerable: true,
        value() { hooks++; return value; } });
      Object.setPrototypeOf(disguised, prototype);
      assert.equal(Array.isArray(disguised), true);
      invalidTiming(disguised);
    }
  }
  assert.equal(getters, 0); assert.equal(hooks, 0);
});

test('canonical exact UTC dates retain leap days, year boundaries and end-exclusive day counts', () => {
  for (const [start, endExclusive, days] of [
    ['2028-02-28', '2028-03-01', 2], ['2028-02-29', '2028-03-01', 1],
    ['2027-12-31', '2028-01-02', 2], ['2099-12-31', '2100-01-01', 1],
  ] as const) {
    assert.deepEqual(resolve(datedKg({ start, endExclusive })), { timing: 'date-window', start, endExclusive, days });
  }
  for (const window of [
    { start: '2028-12-10', endExclusive: '2028-12-10' },
    { start: '2028-12-20', endExclusive: '2028-12-10' },
    { start: '2029-02-29', endExclusive: '2029-03-01' },
    { start: '2028-02-30', endExclusive: '2028-03-01' },
    { start: '2028-2-01', endExclusive: '2028-03-01' },
    { start: ' 2028-02-01', endExclusive: '2028-03-01' },
    { start: '2028-02-01T00:00:00Z', endExclusive: '2028-03-01' },
    { start: '2019-12-31', endExclusive: '2020-01-02' },
    { start: '2099-12-31', endExclusive: '2100-01-02' },
  ]) invalidTiming(datedKg(window));
});

test('the exact-date software span accepts 366 days and refuses the next day without borrowing month rules', () => {
  assert.deepEqual(resolve(datedKg({ start: '2028-01-01', endExclusive: '2029-01-01' })),
    { timing: 'date-window', start: '2028-01-01', endExclusive: '2029-01-01', days: 366 });
  assert.deepEqual(resolve(datedKg({ start: '2027-01-01', endExclusive: '2028-01-02' })),
    { timing: 'date-window', start: '2027-01-01', endExclusive: '2028-01-02', days: 366 });
  invalidTiming(datedKg({ start: '2028-01-01', endExclusive: '2029-01-02' }));
  invalidTiming(datedKg({ start: '2027-01-01', endExclusive: '2028-01-03' }));
});

test('date-window snapshots are frozen detached values without freezing or changing the editor input', () => {
  const input = datedKg(), before = JSON.stringify(input), first = resolve(input), second = resolve(input);
  assert.ok(first); assert.ok(second);
  assert.notEqual(first, second); assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(input), false); assert.equal(Object.isFrozen(input.window), false);
  assert.equal(JSON.stringify(input), before);
  const changed = { ...input, window: { ...input.window, start: '2028-12-11' } };
  assert.deepEqual(first, { timing: 'date-window', ...defaultWindow, days: 10 });
  assert.notDeepEqual(resolve(changed), first);
});

test('quantity, outlet, crop identity and saleable-share validation stay orthogonal to valid exact timing', () => {
  const base = datedKg();
  for (const patch of [{ weeklyKg: 0 }, { weeklyKg: -1 }, { weeklyKg: NaN }, { weeklyKg: Number.MAX_VALUE },
    { cropKey: 'not-an-existing-catalogue-key' }, { id: '' }, { siteId: '' }, { marketablePercent: -1 },
    { marketablePercent: 101 }, { marketablePercent: NaN }, { outlet: 'x'.repeat(121) },
    { weeklyQuantity: 1, unit: 'bunches', kgPerUnit: 2 }]) {
    assert.deepEqual(resolve({ ...base, ...patch }), { timing: 'date-window', ...defaultWindow, days: 10 });
    assert.deepEqual(normal({ ...base, ...patch }), []);
  }
});

test('an exact buyer window roundtrips through the real canonical crop book without month mirrors or source loss', () => {
  const targets = [monthly(), datedKg(), datedPack()];
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book(targets)));
  const loaded = crop.loadCropPlan();
  assert.deepEqual(loaded.harvestTargets, targets);
  assert.equal(crop.cropPlanWriteCandidateIsLossless(loaded), true);
  assert.equal(crop.saveCropPlan(loaded), true);
  const saved = JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState;
  assert.deepEqual(saved.harvestTargets, targets);
  assert.deepEqual(crop.loadCropPlan().harvestTargets, targets);
  assert.equal(Object.hasOwn(saved.harvestTargets![1], 'startMonth'), false);
});

test('malformed persisted dated intent stays raw evidence and cannot gain ordinary lossy write admission', () => {
  const malformed = { ...datedKg(), startMonth: '2028-12', endMonth: '2028-12' };
  const raw = JSON.stringify({ ...book([]), harvestTargets: [malformed] });
  replaceCanonicalCropPlanFixtureRaw(raw);
  const loaded = crop.loadCropPlanWithWriteAdmission();
  assert.deepEqual(loaded.book.harvestTargets, []);
  assert.equal(loaded.admission.status, 'held');
  assert.equal(crop.cropPlanWriteAdmissionMatches(loaded.admission, JSON.stringify(loaded.book), loaded.token), false);
  assert.equal(readCanonicalCropPlanFixtureRaw(), raw);
});

test('changing only an exact date changes the complete-row harvest source key', () => {
  const original = [datedKg()];
  const unchanged = receipts.harvestTargetsSourceKey(siteId, structuredClone(original));
  assert.ok(unchanged);
  assert.equal(unchanged, receipts.harvestTargetsSourceKey(siteId, original));
  for (const window of [{ ...defaultWindow, start: '2028-12-11' }, { ...defaultWindow, endExclusive: '2028-12-21' }]) {
    assert.notEqual(receipts.harvestTargetsSourceKey(siteId, [datedKg(window)]), unchanged);
  }
});

test('a saved exact-date row confirms through the existing request-bound parent write and receipt', () => {
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book([datedKg()])));
  const parent = createHarvestSaveFixture(siteId);
  try {
    const target = datedKg({ start: '2028-12-11', endExclusive: '2028-12-21' });
    const next = [target], request = receipts.createHarvestSaveRequest(parent.context(), next); assert.ok(request);
    const result = parent.submit(next, request);
    assert.equal(result.status, 'confirmed');
    assert.equal(receipts.harvestSaveResultMatches(result, request), 'device');
    assert.deepEqual((JSON.parse(readCanonicalCropPlanFixtureRaw()) as CropPlanState).harvestTargets, next);
  } finally { parent.dispose(); }
});

test('an intervening same-buyer date-only change invalidates the original parent request without another write', () => {
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book([datedKg()])));
  const parent = createHarvestSaveFixture(siteId);
  try {
    const next = [{ ...datedKg(), weeklyKg: 14 }];
    const request = receipts.createHarvestSaveRequest(parent.context(), next); assert.ok(request);
    const changed = book([datedKg({ start: '2028-12-11', endExclusive: '2028-12-20' })]);
    assert.equal(crop.saveCropPlan(changed), true);
    const before = readCanonicalCropPlanFixtureRaw(), writes = local.writes;
    assert.notEqual(parent.submit(next, request).status, 'confirmed');
    assert.equal(local.writes, writes);
    assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  } finally { parent.dispose(); }
});

test('the own-estimate adapter uses exact demand days, explicit saleable share and unknown pack conversion', async () => {
  const f = await ownRow(), profile = f.row.growerCycle.assessmentSnapshot.profile;
  const target = { ...datedKg(), marketablePercent: 50 };
  const converted = growerDemandFromHarvestTarget({ target, profile, scope: f.source.scope, recordedAt: stamp, source: f.source });
  assert.equal(converted.status, 'ready');
  if (converted.status !== 'ready') assert.fail('Exact dated demand with own estimates is supported');
  assert.equal(converted.days, 10); assert.equal(converted.buyerTotalKg, 10); assert.equal(converted.grossCapacityRequiredKg, 20);
  assert.deepEqual(converted.demand.harvestWindow.state === 'provided' && converted.demand.harvestWindow.value, defaultWindow);
  assert.equal(converted.deliveryDistribution, 'not-established'); assert.equal(converted.sourceVerification, 'not-verified');
  assert.deepEqual(growerDemandFromHarvestTarget({ target: datedPack(false), profile, scope: f.source.scope, recordedAt: stamp, source: f.source }),
    { status: 'held', reasons: ['unit-weight-missing'] });
});

test('the actual workflow assembler and engine retain the narrow buyer window and anchor picking periods to its exact start', async () => {
  const f = await ownRow(), profile = f.row.growerCycle.assessmentSnapshot.profile, target = datedKg();
  const state = { ...book([target]), growerPlanningProfiles: [profile] };
  const result = assembleGrowerWorkflowReview({ scope: f.source.scope, source: f.source, book: state, recordedAt: stamp,
    draft: { planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
      targetProfiles: [{ targetId: target.id, profileId: profile.profileId }],
      available: f.source.beds.map(bed => ({ bedId: bed.id, start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true })),
      assumptionsConfirmed: true } });
  assert.equal(result.status, 'review');
  if (result.status !== 'review') assert.fail('The exact requested target reaches the existing workflow');
  assert.equal(result.proposal.status, 'ready');
  assert.deepEqual(result.request.demands[0].harvestWindow.state === 'provided' && result.request.demands[0].harvestWindow.value, defaultWindow);
  assert.equal(result.targetMetadata[0].days, 10);
  assert.ok(result.proposal.cycles.length > 0);
  for (const cycle of result.proposal.cycles) {
    assert.ok(cycle.assessment.schedule.firstHarvestDate >= defaultWindow.start);
    assert.ok(cycle.assessment.schedule.harvestEndExclusiveDate <= defaultWindow.endExclusive);
  }
  const periods = projectGrowerBuyerPickingPeriods(result);
  assert.equal(periods.status, 'ready');
  if (periods.status !== 'ready') assert.fail('The unchanged period projector accepts the canonical exact window');
  assert.deepEqual(periods.buyers[0].periods.map(period => [period.start, period.endExclusive]),
    [['2028-12-10', '2028-12-17'], ['2028-12-17', '2028-12-20']]);
  assert.equal(periods.deliveryDistribution, 'not-established');
});

test('catalogue assessment and picking-month arithmetic explicitly refuse exact targets without widening them to months', () => {
  const target = datedKg();
  const row: Planting = { id: 'engineering-row', bedId: 'bed-a', cropKey, sowMonth: 11,
    once: '2028-11', harvestTargetId: target.id };
  assert.equal(assessHarvestTarget(target, [{ id: 'bed-a', label: 'Engineering bed', areaM2: 20 }], [row], { year: 2028, month: 11 }), null);
  assert.deepEqual(targetPickingWindow(row, target), []);
  assert.equal(targetDemand(target)?.days, 10, 'refusing catalogue agronomy does not erase valid buyer demand');
});

test('catalogue suggestion excludes exact targets visibly while unchanged monthly targets retain their original schedule', () => {
  const identity = CROPS.find(item => item.key === 'carrots'); assert.ok(identity);
  const beds = Array.from({ length: 4 }, (_, index) => ({ id: `bed-${index}`, label: `Engineering bed ${index}`, areaM2: 20, minDimM: 1 }));
  const answers: AutoSuggestAnswers = { goal: 'commercial', groups: [], rhythm: 'steady', rotateCrops: true,
    allowVinesInBeds: false, reliableIrrigation: true, allowMixedCropsInBed: true };
  const legacy: MonthlyHarvestTarget = { ...monthly(), cropKey: identity.key, weeklyKg: 3,
    startMonth: '2027-01', endMonth: '2027-12' };
  const dated: DatedHarvestTarget = { ...datedKg({ start: '2027-01-10', endExclusive: '2027-01-20' }), cropKey: identity.key };
  const suggest = (targets: HarvestTarget[]) => suggestHarvestTargets(targets, siteId, answers, 'mild-frost', beds, [], { year: 2026, month: 11 });
  const onlyDated = suggest([dated]);
  assert.deepEqual(onlyDated.plantings, []);
  assert.ok(onlyDated.notes.some(note => /date|UTC/i.test(note.text)
    && /own.{0,30}estimat|your.{0,30}estimat|estimat.{0,30}own/i.test(note.text)), 'dated refusal explains the actual own-estimate review route');
  const monthlyOnly = suggest([legacy]), mixed = suggest([dated, legacy]);
  assert.ok(monthlyOnly.plantings.length > 0, 'the compatibility control must produce real catalogue sowings');
  const schedule = (rows: Planting[]) => rows.map(({ id: _id, ...rest }) => rest);
  assert.deepEqual(schedule(mixed.plantings), schedule(monthlyOnly.plantings));
  assert.ok(mixed.plantings.every(row => row.harvestTargetId === legacy.id));
});
