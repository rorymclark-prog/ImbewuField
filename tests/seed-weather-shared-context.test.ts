import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';

const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const accountUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const probe = { uid: 'shared-owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(),
  errors: new Set<() => void>(), starts: 0, stops: 0 };
const prior = new Map(['window', '__seedWeatherContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __seedWeatherContext: probe });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// Only Auth transport and browser storage primitives are controlled. Both
// merged purposes use the actual private proof table and observed shared epoch.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([preferenceUrl, accountUrl].includes(context.parentURL ?? '') && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__seedWeatherContext.uid;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__seedWeatherContext;p.starts++;
      p.auth.add(next);p.errors.add(error);return()=>{p.stops++;p.auth.delete(next);p.errors.delete(error);};}`);
  return next(specifier, context);
} });
// These imports must follow hook installation; static linking would bypass
// the controlled Firebase boundary before the fixture can observe real edges.
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');

class MemoryStorage {
  rows = new Map<string, string>(); writes = 0;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, String(value)); }
  removeItem(key: string) { this.writes++; this.rows.delete(key); }
}
let events: EventTarget, local: MemoryStorage, session: MemoryStorage;
const cleanup: Array<() => void> = [];
function pair() {
  const seed = prefs.captureSeedWorksheetContext(), weather = prefs.captureWeatherReferenceContext();
  assert.ok(seed); assert.ok(weather);
  cleanup.push(() => prefs.revokeSeedWorksheetContext(seed), () => prefs.revokeWeatherReferenceContext(weather));
  assert.equal(probe.auth.size, 1, 'coexisting purposes share one actual Auth observer');
  assert.equal(probe.errors.size, 1);
  return { seed, weather };
}
function actor(uid: string) {
  assert.equal(probe.auth.size, 1, 'deliver every actor edge to the actual subscribed shared scope');
  probe.uid = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const next of [...probe.auth]) if (probe.auth.has(next)) next({ uid });
}
function sample(value: boolean) {
  // External fixture transitions bypass setter accounting; neither purpose is
  // allowed to write the session flag or a remembered device preference.
  if (value) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
function current(value: ReturnType<typeof pair>, expected: boolean) {
  assert.equal(prefs.seedWorksheetContextIsCurrent(value.seed), expected);
  assert.equal(prefs.weatherReferenceContextIsCurrent(value.weather), expected);
}
beforeEach(() => {
  probe.uid = 'shared-owner-a'; probe.starts = 0; probe.stops = 0; account.bindMountedAccountLocalStorageUid(probe.uid);
  local = new MemoryStorage(); session = new MemoryStorage();
  events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
afterEach(() => {
  for (const stop of cleanup.splice(0).reverse()) stop();
  assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
  assert.equal(probe.stops, probe.starts, 'last-purpose cleanup releases every real observer');
  assert.equal(local.writes, 0); assert.equal(session.writes, 0); assert.equal(local.rows.size, 0);
});
after(() => {
  account.bindMountedAccountLocalStorageUid(null); hooks.deregister();
  for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('coexisting seed and weather proofs keep exact kinds and reject cross-purpose borrowing without retiring either original', () => {
  const { seed, weather } = pair();
  assert.deepEqual(seed, { kind: 'seed-worksheet-context' }); assert.deepEqual(weather, { kind: 'weather-reference-context' });
  assert.ok(Object.isFrozen(seed)); assert.ok(Object.isFrozen(weather));
  assert.equal(prefs.seedWorksheetContextIsCurrent({ kind: 'seed-worksheet-context' }), false);
  assert.equal(prefs.weatherReferenceContextIsCurrent({ kind: 'weather-reference-context' }), false);
  const weatherAsSeed = weather as unknown as typeof seed, seedAsWeather = seed as unknown as typeof weather;
  assert.equal(prefs.seedWorksheetContextIsCurrent(weatherAsSeed), false);
  assert.equal(prefs.weatherReferenceContextIsCurrent(seedAsWeather), false);
  let wrongCalls = 0, seedCalls = 0, weatherCalls = 0;
  prefs.subscribeSeedWorksheetContext(weatherAsSeed, () => { wrongCalls++; });
  prefs.subscribeWeatherReferenceContext(seedAsWeather, () => { wrongCalls++; });
  prefs.revokeSeedWorksheetContext(weatherAsSeed); prefs.revokeWeatherReferenceContext(seedAsWeather);
  current({ seed, weather }, true); assert.equal(probe.stops, 0);
  prefs.subscribeSeedWorksheetContext(seed, () => { seedCalls++; });
  prefs.subscribeWeatherReferenceContext(weather, () => { weatherCalls++; });
  actor('shared-owner-b');
  assert.deepEqual([wrongCalls, seedCalls, weatherCalls], [0, 1, 1]); current({ seed, weather }, false);
});

for (const first of ['seed', 'weather'] as const) test(`revoking ${first} leaves the other purpose current and subscribed until its own cleanup`, () => {
  const { seed, weather } = pair(); let seedCalls = 0, weatherCalls = 0;
  prefs.subscribeSeedWorksheetContext(seed, () => { seedCalls++; });
  prefs.subscribeWeatherReferenceContext(weather, () => { weatherCalls++; });
  if (first === 'seed') {
    prefs.revokeSeedWorksheetContext(seed);
    assert.equal(prefs.seedWorksheetContextIsCurrent(seed), false); assert.equal(prefs.weatherReferenceContextIsCurrent(weather), true);
  } else {
    prefs.revokeWeatherReferenceContext(weather);
    assert.equal(prefs.weatherReferenceContextIsCurrent(weather), false); assert.equal(prefs.seedWorksheetContextIsCurrent(seed), true);
  }
  assert.equal(probe.auth.size, 1); assert.equal(probe.stops, 0);
  actor('shared-owner-b'); assert.deepEqual([seedCalls, weatherCalls], first === 'seed' ? [0, 1] : [1, 0]);
  prefs.revokeSeedWorksheetContext(seed); prefs.revokeWeatherReferenceContext(weather);
  assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0); assert.equal(probe.stops, 1);
});

test('observed actor A-B-A retires both original purposes permanently while fresh returned-actor proofs remain usable', () => {
  const original = pair(); let seedCalls = 0, weatherCalls = 0;
  prefs.subscribeSeedWorksheetContext(original.seed, () => { seedCalls++; });
  prefs.subscribeWeatherReferenceContext(original.weather, () => { weatherCalls++; });
  current(original, true); actor('shared-owner-b'); current(original, false);
  const otherActor = pair(); current(otherActor, true);
  actor('shared-owner-a'); current(original, false); current(otherActor, false);
  const returnedActor = pair(); current(returnedActor, true);
  assert.deepEqual([seedCalls, weatherCalls], [2, 2]); assert.equal(probe.starts, 1, 'all receipts remained in the same observed scope');
});

test('sample on-off and repeated sample notifications retire both purposes without restoring old authority or writing preferences', () => {
  const original = pair(); let seedCalls = 0, weatherCalls = 0;
  prefs.subscribeSeedWorksheetContext(original.seed, () => { seedCalls++; });
  prefs.subscribeWeatherReferenceContext(original.weather, () => { weatherCalls++; });
  sample(true); current(original, false); const demo = pair(); current(demo, true);
  sample(false); current(original, false); current(demo, false); const returned = pair(); current(returned, true);
  sample(false); current(returned, false); current(original, false); current(pair(), true);
  assert.deepEqual([seedCalls, weatherCalls], [3, 3]); assert.equal(probe.starts, 1);
});

test('unsubscribing one listener preserves the other notification and auth failure retires both before observer cleanup', () => {
  const both = pair(); let seedCalls = 0, weatherCalls = 0;
  const stop = prefs.subscribeSeedWorksheetContext(both.seed, () => { seedCalls++; });
  prefs.subscribeWeatherReferenceContext(both.weather, () => { weatherCalls++; }); stop();
  for (const fail of [...probe.errors]) if (probe.errors.has(fail)) fail();
  current(both, false); assert.deepEqual([seedCalls, weatherCalls], [0, 1]);
  prefs.revokeSeedWorksheetContext(both.seed); assert.equal(probe.auth.size, 1);
  prefs.revokeWeatherReferenceContext(both.weather); assert.equal(probe.auth.size, 0); assert.equal(probe.stops, 1);
  current(pair(), true); assert.equal(probe.starts, 2, 'disposing a failed scope permits a fresh independent scope');
});
