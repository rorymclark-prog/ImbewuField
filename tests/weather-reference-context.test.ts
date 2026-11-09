import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';

const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const accountUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const probe = { uid: 'weather-owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
const prior = new Map(['window', '__weatherContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __weatherContext: probe });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// Firebase observations and browser storage are the only substituted boundaries;
// purpose checks, proof revocation and the shared epoch are production code.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([preferenceUrl, accountUrl].includes(context.parentURL ?? '') && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__weatherContext.uid;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__weatherContext;
      p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  return next(specifier, context);
} });
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');
class MemoryStorage {
  rows = new Map<string, string>(); writes = 0;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, value); }
  removeItem(key: string) { this.writes++; this.rows.delete(key); }
}
let events: EventTarget, local: MemoryStorage, session: MemoryStorage;
const cleanup: Array<() => void> = [];
function capture() {
  const context = prefs.captureWeatherReferenceContext(); assert.ok(context);
  cleanup.push(() => prefs.revokeWeatherReferenceContext(context)); return context;
}
function actor(uid: string | null) {
  probe.uid = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const notify of [...probe.auth]) if (probe.auth.has(notify)) notify(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
beforeEach(() => {
  probe.uid = 'weather-owner-a'; account.bindMountedAccountLocalStorageUid(probe.uid);
  local = new MemoryStorage(); session = new MemoryStorage();
  events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
afterEach(() => { for (const stop of cleanup.splice(0).reverse()) stop(); assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0); });
after(() => {
  account.bindMountedAccountLocalStorageUid(null); hooks.deregister();
  for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('weather context is a frozen private-purpose proof, never a stored preference or a structural token', () => {
  const context = capture();
  assert.deepEqual(context, { kind: 'weather-reference-context' }); assert.ok(Object.isFrozen(context));
  assert.equal(prefs.weatherReferenceContextIsCurrent(context), true);
  assert.equal(prefs.weatherReferenceContextIsCurrent({ kind: 'weather-reference-context' }), false);
  const invoice = prefs.captureInvoiceDocumentContext(); assert.ok(invoice);
  cleanup.push(() => prefs.revokeInvoiceDocumentContext(invoice));
  assert.equal(prefs.weatherReferenceContextIsCurrent(invoice as unknown as typeof context), false);
  assert.equal(prefs.invoiceDocumentContextIsCurrent(context as unknown as typeof invoice), false);
  prefs.revokeWeatherReferenceContext(invoice as unknown as typeof context);
  assert.equal(prefs.invoiceDocumentContextIsCurrent(invoice), true, 'weather revocation cannot revoke another purpose');
  let wrongPurposeCalls = 0;
  prefs.subscribeWeatherReferenceContext(invoice as unknown as typeof context, () => { wrongPurposeCalls++; });
  actor('weather-owner-b'); assert.equal(wrongPurposeCalls, 0);
  assert.equal(local.writes, 0); assert.equal(session.writes, 0); assert.equal(local.rows.size, 0);
});

test('weather receipts share real actor ABA observations with other purposes and cannot revive on return', () => {
  const anchor = prefs.captureJournalObservationContext(); assert.ok(anchor);
  cleanup.push(() => prefs.revokeJournalObservationContext(anchor));
  const original = capture(); let notifications = 0;
  prefs.subscribeWeatherReferenceContext(original, () => { notifications++; });
  actor('weather-owner-b'); assert.equal(prefs.weatherReferenceContextIsCurrent(original), false);
  const other = capture(); actor('weather-owner-a');
  assert.equal(prefs.weatherReferenceContextIsCurrent(original), false); assert.equal(prefs.weatherReferenceContextIsCurrent(other), false);
  assert.equal(prefs.journalObservationContextIsCurrent(anchor), false); assert.equal(notifications, 2);
  assert.equal(prefs.weatherReferenceContextIsCurrent(capture()), true); assert.equal(local.writes, 0);
});

test('sample on-off and repeated sample events retire old weather authority without writing session or device rows', () => {
  const real = capture(); sample(true); const demo = capture(); sample(false);
  assert.equal(prefs.weatherReferenceContextIsCurrent(real), false); assert.equal(prefs.weatherReferenceContextIsCurrent(demo), false);
  const returned = capture(); sample(false); assert.equal(prefs.weatherReferenceContextIsCurrent(returned), false);
  assert.equal(prefs.weatherReferenceContextIsCurrent(capture()), true);
  assert.equal(local.writes, 0); assert.equal(session.writes, 0);
});

test('unsubscription, explicit revocation and auth failure prevent further weather delivery and release observers', () => {
  const context = capture(); let calls = 0;
  const stop = prefs.subscribeWeatherReferenceContext(context, () => { calls++; }); stop(); actor('weather-owner-b'); assert.equal(calls, 0);
  prefs.revokeWeatherReferenceContext(context); assert.equal(prefs.weatherReferenceContextIsCurrent(context), false);
  const next = capture(); for (const fail of [...probe.errors]) fail(); assert.equal(prefs.weatherReferenceContextIsCurrent(next), false);
  prefs.revokeWeatherReferenceContext(next); assert.equal(probe.auth.size, 0); assert.equal(local.writes, 0);
});
