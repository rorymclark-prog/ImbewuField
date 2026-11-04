import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';

const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const accountUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const probe = { actor: 'owner-a' as string | null, configured: true,
  auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __estimatePreference: probe });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([preferenceUrl, accountUrl].includes(context.parentURL ?? '') && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>globalThis.__estimatePreference.configured;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__estimatePreference.actor;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__estimatePreference;p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  return next(specifier, context);
} });
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');
class MemoryStorage {
  rows = new Map<string, string>(); failRead = false; failWrite = false;
  onRead: (() => void) | null = null; onWrite: (() => void) | null = null;
  getItem(key: string) { this.onRead?.(); if (this.failRead) throw Error('private mode'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw Error('quota'); this.rows.set(key, value); this.onWrite?.(); }
  removeItem(key: string) { this.rows.delete(key); }
}
let local: MemoryStorage, session: MemoryStorage, events: EventTarget;
const heldContexts: Array<Parameters<typeof prefs.revokeGrowerEstimateUnitPreferenceContext>[0]> = [];
function capture() { const context = prefs.captureGrowerEstimateUnitPreferenceContext(); assert.ok(context); heldContexts.push(context); return context; }
const key = (owner = 'owner-a') => account.accountLocalStorageKey('imbewu_grower_estimate_unit_v1', owner);
function actor(uid: string | null, observe = true) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  if (observe) for (const listener of probe.auth) listener(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.setItem('imbewu_sample_mode', '1'); else session.removeItem('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
beforeEach(() => {
  for (const context of heldContexts.splice(0)) prefs.revokeGrowerEstimateUnitPreferenceContext(context);
  probe.actor = 'owner-a'; probe.configured = true; account.bindMountedAccountLocalStorageUid('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
after(() => {
  for (const context of heldContexts) prefs.revokeGrowerEstimateUnitPreferenceContext(context);
  account.bindMountedAccountLocalStorageUid(null); hooks.deregister(); delete (globalThis as Record<string, unknown>).__estimatePreference;
});

test('estimate units have their own account row and cannot overwrite field, nursery or harvest choices', () => {
  const field = prefs.captureLengthUnitPreferenceContext(), nursery = prefs.captureNurseryUnitPreferenceContext(), harvest = prefs.captureHarvestMassUnitPreferenceContext();
  try {
    prefs.writeLengthUnitPreference(field, 'ft'); prefs.writeNurseryUnitPreference(nursery, 'imperial'); prefs.writeHarvestMassUnitPreference(harvest, 'lb');
    const before = new Map(local.rows), context = capture();
    assert.deepEqual(prefs.readGrowerEstimateUnitPreference(context), { unit: 'metric', remembered: false, destination: 'device' });
    assert.deepEqual(prefs.writeGrowerEstimateUnitPreference(context, 'imperial'), { remembered: true, destination: 'device' });
    assert.equal(local.rows.get(key()), JSON.stringify({ version: 1, unit: 'imperial' }));
    for (const [name, value] of before) assert.equal(local.rows.get(name), value);
    assert.equal(local.rows.size, before.size + 1);
    assert.equal(prefs.readGrowerEstimateUnitPreference(capture()).unit, 'imperial');
  } finally { prefs.revokeLengthUnitPreferenceContext(field); prefs.revokeNurseryUnitPreferenceContext(nursery); prefs.revokeHarvestMassUnitPreferenceContext(harvest); }
});

test('corrupt or extra-field choices are not guessed and unavailable storage does not revoke a current actor', () => {
  const context = capture();
  for (const raw of ['{', 'null', '[]', '{"version":1,"unit":"ft"}', '{"version":1,"unit":"imperial","owner":"someone"}']) {
    local.rows.set(key(), raw); assert.equal(prefs.readGrowerEstimateUnitPreference(context).unit, 'metric');
    assert.equal(prefs.readGrowerEstimateUnitPreference(context).remembered, false);
  }
  local.failRead = true;
  assert.equal(prefs.readGrowerEstimateUnitPreference(context).destination, 'unavailable');
  assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(context), true);
  local.failRead = false; local.failWrite = true;
  assert.equal(prefs.writeGrowerEstimateUnitPreference(context, 'imperial').destination, 'unavailable');
  assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(context), true);
  local.failWrite = false; assert.equal(prefs.writeGrowerEstimateUnitPreference(context, 'imperial').remembered, true);
});

test('a pre-observer actor switch holds an old context permanently and never reads or writes the next account row', () => {
  const context = capture(); prefs.writeGrowerEstimateUnitPreference(context, 'imperial'); const before = new Map(local.rows);
  actor('owner-b', false);
  let reads = 0; local.onRead = () => { ++reads; };
  assert.equal(prefs.readGrowerEstimateUnitPreference(context).destination, 'unavailable');
  assert.equal(prefs.writeGrowerEstimateUnitPreference(context, 'metric').destination, 'unavailable');
  assert.equal(reads, 0); assert.deepEqual(local.rows, before);
  actor('owner-a', false); assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(context), false);
  local.onRead = null;
});

test('sample choices remain ephemeral and entering or leaving sample permanently withdraws earlier actor proofs', () => {
  const personal = capture(); prefs.writeGrowerEstimateUnitPreference(personal, 'imperial'); const before = new Map(local.rows);
  sample(true); assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(personal), false);
  const demo = capture(); assert.equal(prefs.readGrowerEstimateUnitPreference(demo).unit, 'metric');
  assert.deepEqual(prefs.writeGrowerEstimateUnitPreference(demo, 'imperial'), { remembered: false, destination: 'sample' });
  assert.equal(prefs.readGrowerEstimateUnitPreference(demo).unit, 'imperial'); assert.deepEqual(local.rows, before);
  sample(false); assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(demo), false);
  assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(personal), false);
  assert.equal(prefs.readGrowerEstimateUnitPreference(capture()).unit, 'imperial');
  sample(true); assert.equal(prefs.readGrowerEstimateUnitPreference(capture()).unit, 'metric');
});

test('a reentrant actor change during storage read cannot return another account choice', () => {
  const context = capture(); local.rows.set(key(), JSON.stringify({ version: 1, unit: 'imperial' }));
  local.onRead = () => { local.onRead = null; actor('owner-b', false); };
  assert.deepEqual(prefs.readGrowerEstimateUnitPreference(context), { unit: 'metric', remembered: false, destination: 'unavailable' });
  assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(context), false);
});

test('nested writes deliver only the latest choice to later listeners and the obsolete outer write reports unavailable', () => {
  const first = capture(), second = capture(), later: string[] = [];
  const stopFirst = prefs.subscribeGrowerEstimateUnitPreferenceValue(first, unit => { if (unit === 'imperial') prefs.writeGrowerEstimateUnitPreference(first, 'metric'); });
  const stopSecond = prefs.subscribeGrowerEstimateUnitPreferenceValue(second, unit => later.push(unit));
  assert.equal(prefs.writeGrowerEstimateUnitPreference(first, 'imperial').destination, 'unavailable');
  assert.deepEqual(later, ['metric']); assert.equal(prefs.readGrowerEstimateUnitPreference(second).unit, 'metric');
  stopFirst(); stopSecond();
  prefs.writeGrowerEstimateUnitPreference(first, 'imperial'); assert.deepEqual(later, ['metric']);
});

test('sample withdrawal inside a listener suppresses remaining stale notifications and outer success', () => {
  const first = capture(), second = capture(), delivered: string[] = [];
  prefs.subscribeGrowerEstimateUnitPreferenceValue(first, () => sample(true));
  prefs.subscribeGrowerEstimateUnitPreferenceValue(second, unit => delivered.push(unit));
  assert.equal(prefs.writeGrowerEstimateUnitPreference(first, 'imperial').destination, 'unavailable');
  assert.deepEqual(delivered, []); assert.equal(prefs.growerEstimateUnitPreferenceContextIsCurrent(second), false);
});

test('listener exceptions do not suppress other current views, and revocation releases auth observers', () => {
  const first = capture(), second = capture(), delivered: string[] = [];
  prefs.subscribeGrowerEstimateUnitPreferenceValue(first, () => { throw Error('unrelated view failed'); });
  prefs.subscribeGrowerEstimateUnitPreferenceValue(second, unit => delivered.push(unit));
  assert.equal(prefs.writeGrowerEstimateUnitPreference(first, 'imperial').remembered, true); assert.deepEqual(delivered, ['imperial']);
  assert.equal(probe.auth.size, 1);
  prefs.revokeGrowerEstimateUnitPreferenceContext(first); prefs.revokeGrowerEstimateUnitPreferenceContext(second);
  assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
});
