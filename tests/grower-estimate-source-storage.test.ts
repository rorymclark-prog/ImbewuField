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
import { createSavedProvisionalProfile, readSavedProvisionalProfile, type ProvisionalProfileSaveResult } from '../lib/international/provisional-profile.ts';
import { usdaGreatLakesCabbageCandidates } from '../lib/international/providers/usda-great-lakes-cabbage.ts';
import type { ProvisionalDraftRequest } from '../lib/international/provisional-crop-planning.ts';
import type { GrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
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
function visit(node: ts.Node) { if (ts.isFunctionDeclaration(node) && ['saveGrowerProfiles', 'saveProvisionalProfile', 'rememberStoredPlan'].includes(node.name?.text ?? '')) parentSource += node.getText(parentFile) + '\n'; ts.forEachChild(node, visit); }
visit(parentFile); assert.ok(parentSource);
const compiledParent = ts.transpileModule(parentSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function parent(loaded: CropPlanWriteLoad, overrides: Record<string, unknown> = {}) {
  const state: any = { plan: loaded.book, planSaveConflict: false, growerOwner: account.activeAccountUid(), growerSample: samples.isSampleMode(),
    growerScopeKey: growerPlanningScopeKey(ownScope), growerWriteScope: { current: { key: growerPlanningScopeKey(ownScope), owner: account.activeAccountUid(), sample: samples.isSampleMode() } },
    planWriteBase: { current: { owner: account.activeAccountUid(), sample: samples.isSampleMode(), planKey: JSON.stringify(loaded.book), token: loaded.token, admission: loaded.admission } },
    activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode, growerActorIsCurrent: () => account.activeAccountUid() === 'owner-a' && probe.actor === 'owner-a',
    cropPlanWriteAdmissionMatches: crop.cropPlanWriteAdmissionMatches, cropPlanWriteCandidateIsLossless: crop.cropPlanWriteCandidateIsLossless,
    cropPlanWriteToken: crop.cropPlanWriteToken, loadCropPlanWithWriteAdmission: crop.loadCropPlanWithWriteAdmission,
    normaliseGrowerPlanningProfiles, growerPlanningScopeKey, createGrowerProfileChangePermit: crop.createGrowerProfileChangePermit,
    saveCropPlanWithReceipt: crop.saveCropPlanWithReceipt, saveTimer: { current: null }, clearTimeout() {}, setPlanSaveFailed() {},
    setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; }, rememberStoredPlan() {}, setPlan(value: CropPlanState) { state.plan = value; } };
  Object.assign(state, overrides);
  return Function('state', `with(state){${compiledParent};return Object.assign(saveGrowerProfiles,{adopt:saveProvisionalProfile,state});}`)(state) as
    ((value: GrowerPlanningProfile[], request?: GrowerProfileChangeRequest) => boolean) & { adopt: (profile: GrowerPlanningProfile, current: () => boolean) => ProvisionalProfileSaveResult; state: typeof state };
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


function provisionalProfile(id = 'new-provisional-profile') {
  const recordedAt = '2026-11-12T12:00:00.000Z';
  const ctx = { scope: ownScope, countryCode: 'US', agriculturalRegionReference: 'Great Lakes States', establishment: null, waterRegime: null };
  const request: ProvisionalDraftRequest = { profileId: 'provisional-preview', cropKey: 'cabbage', context: ctx,
    recordedAt, asOf: '2026-11-12', candidates: usdaGreatLakesCabbageCandidates(ctx, 'cabbage', recordedAt, true),
    measuredAreaM2: { state: 'provided', value: 6, unit: 'm2', provenance: { kind: 'grower-record', recordedAt, reference: 'bed' } },
    fieldEntryDate: { state: 'missing', reason: 'not-entered' },
    countBasis: { kind: 'spacing-cell-budget-v1', bedId: 'bed', purpose: 'cabbage-transplants', habit: 'not-applicable',
      rowCm: '76.2', inRowCm: '45.72', finalStand: '', interpretationConfirmed: true, wholeAreaConfirmed: true } };
  const source: GrowerWorkflowSource = { status: 'ready', kind: 'facilitator-local', sourceId: 'local', sourceKey: 'facilitator-local:local',
    resourceSiteId: 'workspace:design:synthetic-workspace', scope: ownScope, geometryFingerprint: 'a'.repeat(64), sourceRevision: 'b'.repeat(64),
    freshness: 'device-saved-copy', sourceVerification: 'not-verified', beds: [{ id: 'bed', label: 'Synthetic bed', areaM2: 6 }],
    measuredAreas: [{ bedId: 'bed', areaM2: 6, basis: 'explicit-saved-dimensions' }], heldBeds: [] };
  const profile = createSavedProvisionalProfile(request, id, '2026-11-12T12:01:00.000Z', source, 'bed', 'Synthetic bed');
  assert.ok(profile); return profile;
}

test('the actual provisional parent appends and reads back one evidence-preserving profile without changing the rest of the book', async () => {
  const initial = await seeded();
  assert.equal(crop.saveCropPlanWithReceipt({ ...initial.book, plantings: [{ id: 'existing-row', bedId: 'other-bed', cropKey: CROPS[0].key, sowMonth: 2, areaFraction: 0.5, existing: true }] }).saved, true);
  const loaded = crop.loadCropPlanWithWriteAdmission(), original = structuredClone(loaded.book), profile = provisionalProfile(), save = parent(loaded);
  assert.deepEqual(save.adopt(profile, () => true), { status: 'confirmed', profileId: profile.profileId });
  const current = crop.loadCropPlan();
  const { growerPlanningProfiles: rows, updatedAt: _time, ...other } = current;
  const { growerPlanningProfiles: previous, updatedAt: _oldTime, ...oldOther } = original;
  assert.deepEqual(other, oldOther); assert.deepEqual(rows!.filter(p => p.profileId !== profile.profileId).sort((a,b) => a.profileId.localeCompare(b.profileId)), previous!.sort((a,b) => a.profileId.localeCompare(b.profileId)));
  assert.deepEqual(rows!.find(p => p.profileId === profile.profileId), profile);
  const saved = readSavedProvisionalProfile(rows!.find(p => p.profileId === profile.profileId)); assert.ok(saved);
  assert.equal(saved.result.fields.establishment.sourceBindings[0].evidenceState, 'undated');
  assert.equal(saved.result.assessment.budgetedStations.value, 17); assert.equal(saved.result.assessment.estimatedPlantCount.value, null);
  const before = readCanonicalCropPlanFixtureRaw(); assert.equal(save.adopt(profile, () => true).status, 'held'); assert.equal(readCanonicalCropPlanFixtureRaw(), before);
});

test('historical provisional receipts survive unrelated autosaves and cannot be removed or relabelled by ordinary edit permits', async () => {
  const profile = provisionalProfile(), loaded = await seeded([profile, sourceProfile('foreign-profile', foreignScope)]);
  assert.equal(crop.saveCropPlanWithReceipt({ ...loaded.book, rainPattern: 'winter', updatedAt: 9 }).saved, true);
  const fresh = crop.loadCropPlanWithWriteAdmission(); assert.deepEqual(fresh.book.growerPlanningProfiles![0], profile);
  const { provisionalOrigin: _origin, ...without } = profile;
  const next = candidate(fresh, without), before = readCanonicalCropPlanFixtureRaw();
  assert.equal(crop.saveCropPlanWithReceipt(next).saved, false);
  assert.equal(crop.createGrowerProfileChangePermit(fresh.admission, fresh.book, next, editRequest(profile)), null);
  assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  const remove = candidate(fresh, null), permit = crop.createGrowerProfileChangePermit(fresh.admission, fresh.book, remove,
    { kind: 'remove', profileId: profile.profileId, expectedProfile: profile }); assert.ok(permit);
  assert.equal(crop.saveCropPlanWithReceipt(remove, { growerProfileChange: permit }).saved, true);
});

test('new saved profile IDs cannot collide with foreign or damaged raw rows, and malformed receipts do not permit a lossy rewrite', async () => {
  const loaded = await seeded();
  const before = readCanonicalCropPlanFixtureRaw();
  assert.equal(parent(loaded).adopt(provisionalProfile('foreign-profile'), () => true).status, 'held');
  assert.equal(readCanonicalCropPlanFixtureRaw(), before);
  for (const row of [{ version: 999, profileId: 'new-provisional-profile' },
    { ...provisionalProfile(), provisionalOrigin: { ...provisionalProfile().provisionalOrigin!, version: 2 } }]) {
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ ...loaded.book, growerPlanningProfiles: [...loaded.book.growerPlanningProfiles!, row] }));
    const raw = readCanonicalCropPlanFixtureRaw(), current = crop.loadCropPlanWithWriteAdmission();
    assert.equal(current.admission.status, 'held'); assert.equal(parent(current).adopt(provisionalProfile(), () => true).status, 'held');
    assert.equal(crop.saveCropPlanWithReceipt({ ...current.book, updatedAt: 10 }).saved, false); assert.equal(readCanonicalCropPlanFixtureRaw(), raw);
  }
});

test('final source revocation reaches the actual parent raw writer rather than waiting for another React render', async () => {
  const loaded = await seeded(), profile = provisionalProfile(); let reads = 0;
  local.onRead = () => { reads++; };
  assert.equal(parent(loaded).adopt(profile, () => true).status, 'confirmed'); local.onRead = null;
  let prewrite = 0;
  for (let position = 1; position <= reads; position++) {
    await reset(); const base = await seeded(), save = parent(base), before = readCanonicalCropPlanFixtureRaw(), writes = local.writes;
    let count = 0, current = true, beforeWrite = false, fired = false;
    local.onRead = () => { if (++count === position) { local.onRead = null; fired = true; beforeWrite = local.writes === writes; current = false; } };
    const outcome = save.adopt(profile, () => current); local.onRead = null;
    if (fired && beforeWrite) { prewrite++; assert.equal(outcome.status, 'held', `read ${position}`); assert.equal(readCanonicalCropPlanFixtureRaw(), before, `read ${position}`); }
    else if (fired) assert.equal(outcome.status, 'superseded', `post-write read ${position} must not claim no write`);
  }
  assert.ok(prewrite > 0);
});

test('a completed write followed by an actor change returns superseded, while a failed store never claims confirmation', async () => {
  const loaded = await seeded(), profile = provisionalProfile();
  const event = crop.CROP_PLAN_CHANGED_EVENT;
  const revoke = () => { probe.actor = 'owner-b'; };
  events.addEventListener(event, revoke);
  try { const outcome = parent(loaded).adopt(profile, () => probe.actor === 'owner-a'); assert.equal(outcome.status, 'superseded'); }
  finally { events.removeEventListener(event, revoke); }
  probe.actor = 'owner-a'; assert.ok(crop.loadCropPlan().growerPlanningProfiles!.some(row => row.profileId === profile.profileId));
  await reset(); const fresh = await seeded();
  const original = local.setItem; local.setItem = () => { throw Error('synthetic quota'); };
  try { assert.equal(parent(fresh).adopt(provisionalProfile(), () => true).status, 'held'); }
  finally { local.setItem = original; }
  assert.ok(!crop.loadCropPlan().growerPlanningProfiles!.some(row => row.profileId === profile.profileId));
});
