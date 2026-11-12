import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { crop, account, samples, local, session, events, probe, reset, cleanup } from './international-grower-operations-fixture.ts';
import { readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { growerEstimateDensityToCanonical } from '../lib/grower-estimate-units.ts';
import { growerPlanningScopeKey, normaliseGrowerPlanningProfile, normaliseGrowerPlanningProfiles,
  type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { CropPlanState, CropPlanWriteLoad, GrowerProfileChangeRequest } from '../lib/crop-plan.ts';

beforeEach(reset); after(cleanup);
const ownScope = { kind: 'unmapped-workspace' as const, workspaceId: 'design:synthetic-workspace' };
const foreignScope = { kind: 'unmapped-workspace' as const, workspaceId: 'design:synthetic-foreign-workspace' };
const provided = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({
  state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: '2026-11-04T00:00:00.000Z' },
});

// Synthetic current-book controls only. No real farm/storage, crop advice or
// user approval is supplied by an input-origin claim or this in-memory fixture.
function sourceProfile(profileId = 'synthetic-profile', scope = ownScope): GrowerPlanningProfile {
  const cropKey = CROPS[0].key;
  const source = (field: 'plantsPerM2' | 'yieldKgPerM2', decimal: string, unit: string) => ({
    version: 1, conversion: 'density-si-v1', scopeKey: growerPlanningScopeKey(scope), profileId, cropKey, field, decimal, unit,
  });
  const profile = normaliseGrowerPlanningProfile({ version: 1, profileId, cropKey, scope, inputs: {
    plantsPerM2: provided(growerEstimateDensityToCanonical(1.2, 'plants/ft2')!, 'plants/m2'),
    yieldKgPerM2: provided(1, 'kg/m2/cycle'), establishment: provided('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: provided(1, 'days'),
    pickingDays: provided(1, 'days'), fieldOccupancyDays: provided(2, 'days'), turnaroundDays: provided(0, 'days'),
    allowedEntryMonths: provided([2], 'utc-months'),
  }, exactDensitySources: { plantsPerM2: source('plantsPerM2', '1.2', 'plants/ft2'), yieldKgPerM2: source('yieldKgPerM2', '1', 'kg/m2/cycle') } });
  assert.ok(profile); return profile;
}
function normal(value: unknown): GrowerPlanningProfile { const result = normaliseGrowerPlanningProfile(value); assert.ok(result); return result; }
function replacement(profile: GrowerPlanningProfile): GrowerPlanningProfile {
  return normal({ ...profile, exactDensitySources: { ...profile.exactDensitySources,
    plantsPerM2: { ...profile.exactDensitySources!.plantsPerM2!, decimal: '1.20000000000000000001' } } });
}
function cleared(profile: GrowerPlanningProfile): GrowerPlanningProfile {
  return normal({ ...profile, inputs: { ...profile.inputs, plantsPerM2: { state: 'missing', reason: 'not-entered' } },
    exactDensitySources: { yieldKgPerM2: profile.exactDensitySources!.yieldKgPerM2! } });
}
function editRequest(profile: GrowerPlanningProfile): GrowerProfileChangeRequest {
  return { kind: 'edit', profileId: profile.profileId, expectedProfile: profile };
}
async function seeded(profiles = [sourceProfile(), sourceProfile('foreign-profile', foreignScope)]): Promise<CropPlanWriteLoad> {
  const book: CropPlanState = { version: 1, plantings: [], updatedAt: 7, rainPattern: 'summer', growerPlanningProfiles: profiles };
  assert.equal(crop.saveCropPlanWithReceipt(book).saved, true);
  const loaded = crop.loadCropPlanWithWriteAdmission(); assert.equal(loaded.admission.status, 'ready'); return loaded;
}
function candidate(loaded: CropPlanWriteLoad, changed: GrowerPlanningProfile | null): CropPlanState {
  const profileId = loaded.book.growerPlanningProfiles![0].profileId;
  return { ...loaded.book, growerPlanningProfiles: loaded.book.growerPlanningProfiles!.flatMap(row => row.profileId === profileId ? changed ? [changed] : [] : [row]),
    updatedAt: loaded.book.updatedAt + 1 };
}
function permit(loaded: CropPlanWriteLoad, next: CropPlanState, request = editRequest(loaded.book.growerPlanningProfiles![0])) {
  const result = crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, next, request); assert.ok(result); return result;
}

test('ordinary current writers cannot erase source digits while keeping the same density Number', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0];
  const { exactDensitySources: _source, ...withoutSource } = original;
  const next = candidate(loaded, withoutSource), before = readCanonicalCropPlanFixtureRaw();
  assert.equal(crop.cropPlanWriteCandidateIsLossless(next), true, 'candidate self-normalization alone missed the actual receipt loss');
  assert.equal(crop.saveCropPlanWithReceipt(next).saved, false);
  assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  assert.deepEqual(crop.loadCropPlan().growerPlanningProfiles![0].exactDensitySources, original.exactDensitySources);
  assert.equal(crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, next, editRequest(original)), null,
    'an edit intent cannot turn a retained provided density into untagged legacy arithmetic');
});

test('ordinary saves preserve valid source and legacy profiles without a blanket block', async () => {
  const loaded = await seeded(), next = { ...loaded.book, rainPattern: 'winter' as const, updatedAt: 8 };
  assert.equal(crop.saveCropPlanWithReceipt(next).saved, true);
  assert.deepEqual(crop.loadCropPlan().growerPlanningProfiles, loaded.book.growerPlanningProfiles);
  const { exactDensitySources: _source, ...legacy } = sourceProfile('legacy-profile');
  const fresh = crop.loadCropPlanWithWriteAdmission();
  assert.equal(crop.saveCropPlanWithReceipt({ ...fresh.book, growerPlanningProfiles: [...fresh.book.growerPlanningProfiles!, legacy] }).saved, true);
  const withLegacy = crop.loadCropPlanWithWriteAdmission();
  const edited = withLegacy.book.growerPlanningProfiles!.map(row => row.profileId === legacy.profileId
    ? { ...row, inputs: { ...row.inputs, yieldKgPerM2: provided(3, 'kg/m2/cycle') } } : row);
  assert.equal(crop.saveCropPlanWithReceipt({ ...withLegacy.book, growerPlanningProfiles: edited }).saved, true);
});

test('freshly validated replacement source is permitted once and leaves foreign profiles exact', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0], next = candidate(loaded, replacement(original));
  assert.equal(crop.saveCropPlanWithReceipt(next).saved, false, 'ordinary autosave cannot alter origin digits');
  const change = permit(loaded, next);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, true);
  assert.equal(crop.loadCropPlan().growerPlanningProfiles![0].exactDensitySources!.plantsPerM2!.decimal, '1.20000000000000000001');
  assert.deepEqual(crop.loadCropPlan().growerPlanningProfiles![1], loaded.book.growerPlanningProfiles![1]);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, false, 'a successful permit cannot replay');
});

test('an explicit density clear may remove only its corresponding source without resurrecting it', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0], next = candidate(loaded, cleared(original));
  assert.equal(crop.saveCropPlanWithReceipt(next).saved, false);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: permit(loaded, next) }).saved, true);
  const saved = crop.loadCropPlan().growerPlanningProfiles![0];
  assert.equal(saved.inputs.plantsPerM2.state, 'missing'); assert.equal(saved.exactDensitySources!.plantsPerM2, undefined);
  assert.deepEqual(saved.exactDensitySources!.yieldKgPerM2, original.exactDensitySources!.yieldKgPerM2);
});

test('a changed provided density needs its own valid replacement source rather than source erasure', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0];
  const changedInputs = { ...original.inputs, plantsPerM2: provided(2, 'plants/m2') };
  const untagged = normal({ ...original, inputs: changedInputs,
    exactDensitySources: { yieldKgPerM2: original.exactDensitySources!.yieldKgPerM2! } });
  assert.equal(crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, candidate(loaded, untagged), editRequest(original)), null);
  const replacement = normal({ ...original, inputs: changedInputs, exactDensitySources: {
    ...original.exactDensitySources, plantsPerM2: { ...original.exactDensitySources!.plantsPerM2!, decimal: '2', unit: 'plants/m2' },
  } });
  const next = candidate(loaded, replacement);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: permit(loaded, next) }).saved, true);
  assert.deepEqual(crop.loadCropPlan().growerPlanningProfiles![0].exactDensitySources, replacement.exactDensitySources);
});

test('profile absence requires the real remove request rather than inferred deletion intent', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0], next = candidate(loaded, null);
  assert.equal(crop.saveCropPlanWithReceipt(next).saved, false);
  assert.equal(crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, next, editRequest(original)), null);
  const change = permit(loaded, next, { kind: 'remove', profileId: original.profileId, expectedProfile: original });
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, true);
  assert.deepEqual(crop.loadCropPlan().growerPlanningProfiles, [loaded.book.growerPlanningProfiles![1]]);
});

test('new creation uses an explicit null expected row and cannot impersonate an existing profile', async () => {
  const loaded = await seeded(), created = sourceProfile('new-profile');
  const next = { ...loaded.book, growerPlanningProfiles: [...loaded.book.growerPlanningProfiles!, created] };
  const request: GrowerProfileChangeRequest = { kind: 'edit', profileId: created.profileId, expectedProfile: null };
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: permit(loaded, next, request) }).saved, true);
  const fresh = crop.loadCropPlanWithWriteAdmission();
  assert.equal(crop.createGrowerProfileChangePermit(fresh.admission, fresh.book, fresh.book, request), null);
});

test('a permit never blesses changed foreign profiles, unrelated book metadata or the wrong expected source', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0], next = candidate(loaded, replacement(original));
  const foreign = next.growerPlanningProfiles![1];
  for (const altered of [
    { ...next, rainPattern: 'winter' as const },
    { ...next, growerPlanningProfiles: [next.growerPlanningProfiles![0], { ...foreign, inputs: { ...foreign.inputs, yieldKgPerM2: provided(2, 'kg/m2/cycle') },
      exactDensitySources: { ...foreign.exactDensitySources, yieldKgPerM2: { ...foreign.exactDensitySources!.yieldKgPerM2!, decimal: '2' } } }] },
  ]) assert.equal(crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, altered, editRequest(original)), null);
  assert.equal(crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, next, editRequest(replacement(original))), null);
  assert.equal(crop.createGrowerProfileChangePermit({ status: 'ready', source: 'present' }, loaded.book, next, editRequest(original)), null);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: { kind: 'grower-profile-change-permit' } }).saved, false);
});

test('a changed raw token revokes a minted action and its original profile expectation', async () => {
  const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0])), change = permit(loaded, next);
  assert.equal(crop.saveCropPlanWithReceipt({ ...loaded.book, rainPattern: 'winter' }).saved, true);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, false);
  assert.equal(crop.createGrowerProfileChangePermit(loaded.admission, loaded.book, next, editRequest(loaded.book.growerPlanningProfiles![0])), null);
  assert.equal(crop.loadCropPlan().rainPattern, 'winter');
});

test('cross-account and sample transfers cannot use or replay a previous actor action', async () => {
  for (const transition of ['account', 'sample'] as const) {
    await reset();
    const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0])), change = permit(loaded, next);
    if (transition === 'account') { account.bindMountedAccountLocalStorageUid('owner-b'); probe.actor = 'owner-b'; }
    else samples.enterSampleMode();
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, false, transition);
    if (transition === 'account') { account.bindMountedAccountLocalStorageUid('owner-a'); probe.actor = 'owner-a'; }
    else samples.exitSampleMode();
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, false, `${transition}: consumed stale action`);
  }
});

test('an unused personal action stays revoked after entering and leaving sample mode', async () => {
  const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0]));
  const change = permit(loaded, next), before = readCanonicalCropPlanFixtureRaw();
  // Neither attempt the write nor ask another reader to invalidate the old
  // proof while sample mode is active. Returning to the original values must
  // not resurrect an action that crossed that lifecycle boundary unused.
  samples.enterSampleMode();
  samples.exitSampleMode();
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, false);
  assert.equal(readCanonicalCropPlanFixtureRaw(), before);
});

test('a sample round trip during an actual permitted storage read cannot commit changed source', async () => {
  const calibration = await seeded(), calibrationNext = candidate(calibration, replacement(calibration.book.growerPlanningProfiles![0]));
  const calibrationPermit = permit(calibration, calibrationNext);
  let readCount = 0;
  try {
    local.onRead = () => { ++readCount; };
    assert.equal(crop.saveCropPlanWithReceipt(calibrationNext, { growerProfileChange: calibrationPermit }).saved, true,
      'the same operation without a lifecycle transition remains valid');
  } finally { local.onRead = null; }
  assert.ok(readCount > 0, 'exercise the real initialized storage reader, not an unused mock');
  const violations: Array<{ readPosition: number; saved: boolean; bytesChanged: boolean }> = [];
  let testedBeforeWrite = 0;
  // Each iteration starts a separate legitimate action. Only the chosen read
  // fires the transition, and no save/load/lease probe occurs between that
  // transition and the original operation continuing in the actual writer.
  for (let readPosition = 1; readPosition <= readCount; ++readPosition) {
    await reset();
    const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0]));
    const change = permit(loaded, next), before = readCanonicalCropPlanFixtureRaw(), writesBefore = local.writes;
    let seen = 0, fired = false, beforeWrite = false;
    try {
      local.onRead = () => {
        if (++seen !== readPosition) return;
        local.onRead = null;
        fired = true; beforeWrite = local.writes === writesBefore;
        samples.enterSampleMode();
        samples.exitSampleMode();
      };
      const result = crop.saveCropPlanWithReceipt(next, { growerProfileChange: change });
      local.onRead = null;
      assert.equal(fired, true, `the calibrated actual read ${readPosition} must be reached before any injected transition`);
      if (beforeWrite) {
        ++testedBeforeWrite;
        const bytesChanged = readCanonicalCropPlanFixtureRaw() !== before;
        if (result.saved || bytesChanged) violations.push({ readPosition, saved: result.saved, bytesChanged });
      }
    } finally { local.onRead = null; }
  }
  assert.ok(testedBeforeWrite > 0, 'a lifecycle transition must actually be injected before a storage write');
  assert.deepEqual(violations, [], `No changed-source action may commit after a pre-write sample transition (${testedBeforeWrite} of ${readCount} actual read positions)`);
});

test('an abandoned action has one listener and replacement, cancel and consumption release it', async () => {
  const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0]));
  const add = events.addEventListener, remove = events.removeEventListener;
  const active = new Set<EventListenerOrEventListenerObject>();
  let pending: ReturnType<typeof permit> | undefined;
  events.addEventListener = (type, listener, options) => {
    if (type === samples.SAMPLE_MODE_EVENT && listener) active.add(listener);
    add.call(events, type, listener, options);
  };
  events.removeEventListener = (type, listener, options) => {
    if (type === samples.SAMPLE_MODE_EVENT && listener) active.delete(listener);
    remove.call(events, type, listener, options);
  };
  try {
    const first = pending = permit(loaded, next); assert.equal(active.size, 1);
    const second = pending = permit(loaded, next); assert.equal(active.size, 1, 'a newer explicit action replaces an abandoned pending action');
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: first }).saved, false);
    assert.equal(active.size, 1, 'a rejected older object cannot cancel the newer action');
    crop.revokeGrowerProfileChangePermit(second); assert.equal(active.size, 0);
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: second }).saved, false);
    const third = pending = permit(loaded, next); assert.equal(active.size, 1);
    assert.equal(crop.saveCropPlanWithReceipt({ ...next, rainPattern: 'winter' }, { growerProfileChange: third }).saved, false);
    assert.equal(active.size, 0, 'a consumed failed attempt releases its listener');
    const fourth = pending = permit(loaded, next); assert.equal(active.size, 1);
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: fourth }).saved, true);
    assert.equal(active.size, 0, 'a successful action releases its listener');
  } finally { if (pending) crop.revokeGrowerProfileChangePermit(pending); events.addEventListener = add; events.removeEventListener = remove; }
});

test('a sample transition releases an unused listener and a different window cannot consume its action', async () => {
  const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0]));
  const add = events.addEventListener, remove = events.removeEventListener;
  const active = new Set<EventListenerOrEventListenerObject>();
  let pending: ReturnType<typeof permit> | undefined;
  events.addEventListener = (type, listener, options) => {
    if (type === samples.SAMPLE_MODE_EVENT && listener) active.add(listener);
    add.call(events, type, listener, options);
  };
  events.removeEventListener = (type, listener, options) => {
    if (type === samples.SAMPLE_MODE_EVENT && listener) active.delete(listener);
    remove.call(events, type, listener, options);
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')!;
  try {
    const changed = pending = permit(loaded, next); assert.equal(active.size, 1);
    samples.enterSampleMode(); assert.equal(active.size, 0, 'transition permanently revokes and cleans up the unused action');
    samples.exitSampleMode();
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: changed }).saved, false);
    const transferred = pending = permit(loaded, next); assert.equal(active.size, 1);
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true,
      value: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }) });
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: transferred }).saved, false);
    assert.equal(active.size, 0, 'window mismatch cleans the captured original window listener');
  } finally {
    if (pending) crop.revokeGrowerProfileChangePermit(pending);
    Object.defineProperty(globalThis, 'window', originalWindow);
    events.addEventListener = add; events.removeEventListener = remove;
  }
});

test('a failed candidate or storage attempt consumes its permit and a fresh explicit retry can mint another', async () => {
  const loaded = await seeded(), next = candidate(loaded, replacement(loaded.book.growerPlanningProfiles![0])), change = permit(loaded, next);
  assert.equal(crop.saveCropPlanWithReceipt({ ...next, rainPattern: 'winter' }, { growerProfileChange: change }).saved, false);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: change }).saved, false);
  const another = permit(loaded, next), originalSetItem = local.setItem;
  try {
    local.setItem = () => { throw Error('Synthetic storage write unavailable'); };
    assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: another }).saved, false);
  } finally { local.setItem = originalSetItem; }
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: another }).saved, false);
  const fresh = crop.loadCropPlanWithWriteAdmission(), retry = candidate(fresh, replacement(fresh.book.growerPlanningProfiles![0]));
  assert.equal(crop.saveCropPlanWithReceipt(retry, { growerProfileChange: permit(fresh, retry) }).saved, true);
});

test('present malformed source markers hold raw evidence rather than normalize it into a legacy edit', async () => {
  const loaded = await seeded(), raw = structuredClone(loaded.book);
  raw.growerPlanningProfiles![0] = { ...raw.growerPlanningProfiles![0], exactDensitySources: {} };
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(raw));
  const before = readCanonicalCropPlanFixtureRaw(), held = crop.loadCropPlanWithWriteAdmission();
  assert.equal(held.admission.status, 'held');
  assert.equal(crop.saveCropPlanWithReceipt(loaded.book).saved, false);
  assert.equal(crop.createGrowerProfileChangePermit(held.admission, held.book, loaded.book, editRequest(loaded.book.growerPlanningProfiles![0])), null);
  assert.equal(readCanonicalCropPlanFixtureRaw(), before);
});

test('sample actions use the existing sample admission rather than a personal account permit', async () => {
  samples.enterSampleMode();
  const loaded = await seeded(), next = candidate(loaded, cleared(loaded.book.growerPlanningProfiles![0]));
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: permit(loaded, next) }).saved, true);
  assert.equal(crop.loadCropPlan().growerPlanningProfiles![0].inputs.plantsPerM2.state, 'missing');
});

// Compile the actual parent callback. Its existing scope, actor, fresh-book and
// admission checks stay in the path; this is not an alternate save controller.
const parentFile = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let parentSource = '';
function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'saveGrowerProfiles') parentSource = node.getText(parentFile); ts.forEachChild(node, visit); }
visit(parentFile); assert.ok(parentSource);
const compiledParent = ts.transpileModule(parentSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function parent(loaded: CropPlanWriteLoad) {
  const state: any = { plan: loaded.book, planSaveConflict: false, growerOwner: account.activeAccountUid(), growerSample: samples.isSampleMode(),
    growerScopeKey: growerPlanningScopeKey(ownScope), growerWriteScope: { current: { key: growerPlanningScopeKey(ownScope), owner: account.activeAccountUid(), sample: samples.isSampleMode() } },
    planWriteBase: { current: { owner: account.activeAccountUid(), sample: samples.isSampleMode(), planKey: JSON.stringify(loaded.book), token: loaded.token, admission: loaded.admission } },
    activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode, growerActorIsCurrent: () => account.activeAccountUid() === 'owner-a' && probe.actor === 'owner-a',
    cropPlanWriteAdmissionMatches: crop.cropPlanWriteAdmissionMatches, cropPlanWriteCandidateIsLossless: crop.cropPlanWriteCandidateIsLossless,
    cropPlanWriteToken: crop.cropPlanWriteToken, loadCropPlanWithWriteAdmission: crop.loadCropPlanWithWriteAdmission,
    normaliseGrowerPlanningProfiles, growerPlanningScopeKey, createGrowerProfileChangePermit: crop.createGrowerProfileChangePermit,
    saveCropPlanWithReceipt: crop.saveCropPlanWithReceipt, saveTimer: { current: null }, clearTimeout() {}, setPlanSaveFailed() {},
    setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; }, rememberStoredPlan() {}, setPlan(value: CropPlanState) { state.plan = value; } };
  return Function('state', `with(state){${compiledParent};return saveGrowerProfiles;}`)(state) as (value: GrowerPlanningProfile[], request?: GrowerProfileChangeRequest) => boolean;
}
test('the real parent profile writer requires a confirmed operation and mints it only under current scope checks', async () => {
  const loaded = await seeded(), original = loaded.book.growerPlanningProfiles![0], replaced = replacement(original), save = parent(loaded);
  const values = [replaced, loaded.book.growerPlanningProfiles![1]];
  assert.equal(save(values), false, 'ordinary callback cannot change original source');
  assert.equal(save(values, editRequest(original)), true);
  assert.equal(crop.loadCropPlan().growerPlanningProfiles![0].profileId, 'foreign-profile', 'parent may group foreign namespaces without changing their values');
  const retained = crop.loadCropPlan().growerPlanningProfiles!.find(row => row.profileId === original.profileId)!;
  assert.equal(retained.exactDensitySources!.plantsPerM2!.decimal, replaced.exactDensitySources!.plantsPerM2!.decimal);
});

test('saved spacing denominators survive reload and cannot be dropped or replaced by ordinary or stale editors', async () => {
  const base = sourceProfile();
  const { exactDensitySources: _old, ...legacy } = base;
  const original = normal({ ...legacy, cropKey: 'cowpea',
    inputs: { ...legacy.inputs, plantsPerM2: { state: 'missing', reason: 'not-known' } },
    plantCountOrigin: { version: 1, conversion: 'spacing-cells-cm-v1', scopeKey: growerPlanningScopeKey(ownScope),
      profileId: base.profileId, cropKey: 'cowpea', bedId: 'bed-1', areaBasisKey: '[10.125,null]',
      referenceVersion: 'worldveg-ke-24-1077-cowpea-spacing-v1', countryCode: 'KE', regionReference: null, varietyReference: null,
      purpose: 'leaves', habit: 'spreading', rowCm: '75', inRowCm: '75', finalStand: '1',
      interpretation: 'source-inrow-interpreted-as-station-spacing', areaUse: 'whole-current-measured-area', recordedAt: '2026-11-12T12:00:00.000Z' } });
  const loaded = await seeded([original]);
  assert.deepEqual(loaded.book.growerPlanningProfiles![0].plantCountOrigin, original.plantCountOrigin);
  const untouched = { ...loaded.book, rainPattern: 'winter' as const, updatedAt: 8 };
  assert.equal(crop.saveCropPlanWithReceipt(untouched).saved, true);
  const fresh = crop.loadCropPlanWithWriteAdmission();
  const { plantCountOrigin: _origin, ...without } = original;
  for (const changed of [without, { ...without, inputs: { ...without.inputs, plantsPerM2: provided(1.7777777777777777, 'plants/m2') } },
    normal({ ...original, plantCountOrigin: { ...original.plantCountOrigin!, rowCm: '74.99999999999999999999' } })]) {
    const next = candidate(fresh, changed), raw = readCanonicalCropPlanFixtureRaw();
    assert.equal(crop.saveCropPlanWithReceipt(next).saved, false);
    assert.equal(crop.createGrowerProfileChangePermit(fresh.admission, fresh.book, next, editRequest(original)), null);
    assert.equal(readCanonicalCropPlanFixtureRaw(), raw);
  }
  const next = candidate(fresh, null);
  const removal = crop.createGrowerProfileChangePermit(fresh.admission, fresh.book, next,
    { kind: 'remove', profileId: original.profileId, expectedProfile: original }); assert.ok(removal);
  assert.equal(crop.saveCropPlanWithReceipt(next, { growerProfileChange: removal }).saved, true, 'explicit confirmed removal remains available');
});
