import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { registerHooks } from 'node:module';

// Only Firebase Auth transport and browser memory are controlled. The real
// shared purpose/actor/sample authority captures, subscribes and revokes proofs.
const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const accountUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const probe = { actor: 'owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
const savedGlobal = new Map(['window', '__preferenceReentrancy'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __preferenceReentrancy: probe });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([preferenceUrl, accountUrl].includes(context.parentURL ?? '') && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__preferenceReentrancy.actor;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__preferenceReentrancy;
      p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  return next(specifier, context);
} });
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');
class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
}
let events: EventTarget, local: MemoryStorage, session: MemoryStorage;
const cleanup: Array<() => void> = [];
function keep<T>(capture: () => T | null, revoke: (context: T | null) => void): T {
  const context = capture(); assert.ok(context); cleanup.push(() => revoke(context)); return context;
}
const field = () => keep(prefs.captureLengthUnitPreferenceContext, prefs.revokeLengthUnitPreferenceContext);
const anchor = () => keep(prefs.captureJournalObservationContext, prefs.revokeJournalObservationContext);
function actor(uid: string) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  // A single SDK publication. Snapshot the transport callbacks independently;
  // the regression is inside the real shared scope's proof/listener delivery.
  for (const notify of [...probe.auth]) if (probe.auth.has(notify)) notify({ uid });
}
function sample(value: boolean) {
  if (value) session.setItem('imbewu_sample_mode', '1'); else session.removeItem('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
function release() { for (const stop of cleanup.splice(0).reverse()) stop(); }
beforeEach(() => {
  release(); assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
  probe.actor = 'owner-a'; account.bindMountedAccountLocalStorageUid('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
after(() => {
  release(); assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
  account.bindMountedAccountLocalStorageUid(null); hooks.deregister();
  for (const [key, descriptor] of savedGlobal) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('one actor edge notifies the original field receipt once when a journal anchor keeps reentrant replacement in the same scope', () => {
  const journal = anchor(); let current = field(); const original = current; let calls = 0;
  function changed() {
    calls++; prefs.revokeLengthUnitPreferenceContext(current);
    // The old implementation revisits replacement receipts in its live Set.
    // Bound the reproduction so the regression fails without hanging a suite.
    if (calls < 3) { current = field(); prefs.subscribeLengthUnitPreferenceContext(current, changed); }
  }
  prefs.subscribeLengthUnitPreferenceContext(current, changed);
  actor('owner-b');
  assert.equal(calls, 1, 'a newly captured current-epoch receipt is not part of the original notification');
  assert.notEqual(current, original); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(current), true);
  assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(original), false);
  assert.equal(prefs.journalObservationContextIsCurrent(journal), false);
  assert.equal(probe.auth.size, 1, 'anchor retained the same shared scope during replacement');
});

test('all original listener lists are snapshotted before callbacks, including additions to a later existing receipt', () => {
  anchor(); const first = field(), second = field(), delivered: string[] = [];
  prefs.subscribeLengthUnitPreferenceContext(first, () => {
    delivered.push('first'); prefs.subscribeLengthUnitPreferenceContext(second, () => delivered.push('added-later'));
  });
  prefs.subscribeLengthUnitPreferenceContext(second, () => delivered.push('second'));
  actor('owner-b'); assert.deepEqual(delivered, ['first', 'second']);
});

test('explicitly unsubscribing the next snapshotted listener suppresses only that removed subscription', () => {
  anchor(); const context = field(), delivered: string[] = []; let stopNext = () => {};
  prefs.subscribeLengthUnitPreferenceContext(context, () => { delivered.push('first'); stopNext(); });
  stopNext = prefs.subscribeLengthUnitPreferenceContext(context, () => delivered.push('removed'));
  prefs.subscribeLengthUnitPreferenceContext(context, () => delivered.push('last'));
  actor('owner-b'); assert.deepEqual(delivered, ['first', 'last']);
});

test('explicitly revoking a later original receipt skips its notifications without removing another current receipt', () => {
  anchor(); const first = field(), removed = field(); let removedCalls = 0;
  prefs.subscribeLengthUnitPreferenceContext(first, () => prefs.revokeLengthUnitPreferenceContext(removed));
  prefs.subscribeLengthUnitPreferenceContext(removed, () => { removedCalls++; });
  actor('owner-b'); assert.equal(removedCalls, 0);
  const replacement = field(); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(replacement), true);
});

test('a still-registered receipt revoked by a currentness read still delivers its original subscribed notification', () => {
  anchor(); const first = field(), second = field(), delivered: string[] = [];
  prefs.subscribeLengthUnitPreferenceContext(first, () => {
    delivered.push('first'); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(second), false);
  });
  prefs.subscribeLengthUnitPreferenceContext(second, () => delivered.push('second'));
  actor('owner-b'); assert.deepEqual(delivered, ['first', 'second']);
});

function allPurposes() {
  const length = field(), journal = anchor();
  const nursery = keep(prefs.captureNurseryUnitPreferenceContext, prefs.revokeNurseryUnitPreferenceContext);
  const mass = keep(prefs.captureHarvestMassUnitPreferenceContext, prefs.revokeHarvestMassUnitPreferenceContext);
  const estimate = keep(prefs.captureGrowerEstimateUnitPreferenceContext, prefs.revokeGrowerEstimateUnitPreferenceContext);
  const layout = keep(prefs.captureFieldLayoutExportContext, prefs.revokeFieldLayoutExportContext);
  const imported = keep(prefs.captureFieldLayoutImportContext, prefs.revokeFieldLayoutImportContext);
  const invoice = keep(prefs.captureInvoiceDocumentContext, prefs.revokeInvoiceDocumentContext);
  return [() => prefs.lengthUnitPreferenceContextIsCurrent(length), () => prefs.journalObservationContextIsCurrent(journal),
    () => prefs.nurseryUnitPreferenceContextIsCurrent(nursery), () => prefs.harvestMassUnitPreferenceContextIsCurrent(mass),
    () => prefs.growerEstimateUnitPreferenceContextIsCurrent(estimate), () => prefs.fieldLayoutExportContextIsCurrent(layout),
    () => prefs.fieldLayoutImportContextIsCurrent(imported), () => prefs.invoiceDocumentContextIsCurrent(invoice)];
}

test('original receipts for every shared purpose stay revoked across actor and sample ABA while fresh receipts remain current', () => {
  const original = allPurposes(); assert.ok(original.every(current => current()));
  actor('owner-b'); assert.ok(original.every(current => !current()));
  const otherActor = allPurposes(); assert.ok(otherActor.every(current => current()));
  actor('owner-a'); assert.ok(original.every(current => !current())); assert.ok(otherActor.every(current => !current()));
  const returnedActor = allPurposes(); assert.ok(returnedActor.every(current => current()));
  sample(true); assert.ok(returnedActor.every(current => !current())); const demo = allPurposes(); assert.ok(demo.every(current => current()));
  sample(false); assert.ok(demo.every(current => !current())); assert.ok(original.every(current => !current()));
  assert.ok(allPurposes().every(current => current()));
});

test('a shared sample epoch still resets all four ephemeral unit choices without writing personal rows', () => {
  sample(true); const length = field(), nursery = keep(prefs.captureNurseryUnitPreferenceContext, prefs.revokeNurseryUnitPreferenceContext);
  const mass = keep(prefs.captureHarvestMassUnitPreferenceContext, prefs.revokeHarvestMassUnitPreferenceContext);
  const estimate = keep(prefs.captureGrowerEstimateUnitPreferenceContext, prefs.revokeGrowerEstimateUnitPreferenceContext);
  prefs.writeLengthUnitPreference(length, 'ft'); prefs.writeNurseryUnitPreference(nursery, 'imperial');
  prefs.writeHarvestMassUnitPreference(mass, 'lb'); prefs.writeGrowerEstimateUnitPreference(estimate, 'imperial');
  assert.equal(prefs.readLengthUnitPreference(length).unit, 'ft'); assert.equal(prefs.readNurseryUnitPreference(nursery).unit, 'imperial');
  assert.equal(prefs.readHarvestMassUnitPreference(mass).unit, 'lb'); assert.equal(prefs.readGrowerEstimateUnitPreference(estimate).unit, 'imperial');
  sample(true);
  assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(length), false);
  assert.equal(prefs.readLengthUnitPreference(field()).unit, 'm');
  assert.equal(prefs.readNurseryUnitPreference(keep(prefs.captureNurseryUnitPreferenceContext, prefs.revokeNurseryUnitPreferenceContext)).unit, 'metric');
  assert.equal(prefs.readHarvestMassUnitPreference(keep(prefs.captureHarvestMassUnitPreferenceContext, prefs.revokeHarvestMassUnitPreferenceContext)).unit, 'kg');
  assert.equal(prefs.readGrowerEstimateUnitPreference(keep(prefs.captureGrowerEstimateUnitPreferenceContext, prefs.revokeGrowerEstimateUnitPreferenceContext)).unit, 'metric');
  assert.equal(local.rows.size, 0);
});

test('context-change listener exceptions still propagate and stop later callbacks after the epoch has changed', () => {
  anchor(); const context = field(), failure = new Error('Original context notification failure'); let laterCalls = 0;
  prefs.subscribeLengthUnitPreferenceContext(context, () => { throw failure; });
  prefs.subscribeLengthUnitPreferenceContext(context, () => { laterCalls++; });
  assert.throws(() => actor('owner-b'), error => error === failure);
  assert.equal(laterCalls, 0); assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(context), false);
  assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(field()), true);
});
