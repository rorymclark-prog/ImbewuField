import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createSiteCountryContext, resolveSiteCountryContext, sitePlanningSupport, type SiteCountryContext } from '@/lib/international/site-context';
import type { SavedPlace } from '@/lib/saved-places';

const state = { uid: 'account-a' as string | null, docs: new Map<string, Record<string, unknown>>(),
  writes: [] as string[], backend: true, failTransactions: false, gate: null as Promise<void> | null,
  postCommitGate: null as Promise<void> | null,
  listeners: [] as { ref: string; callback: (snap: unknown) => void }[] };
Object.assign(globalThis, { __imbewuSiteContextTransport: state });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const firebaseModule = moduleUrl(`
const state = globalThis.__imbewuSiteContextTransport;
export const isBackendConfigured = () => state.backend;
export const getFirebase = () => state.backend ? { db: {}, auth: { currentUser: state.uid ? {uid: state.uid} : null } } : null;
`);
const firestoreModule = moduleUrl(`
const state = globalThis.__imbewuSiteContextTransport;
export const doc = (_db, ...parts) => parts.join('/');
const snapshot = ref => ({ exists: () => state.docs.has(ref), data: () => state.docs.get(ref), metadata: {hasPendingWrites:false} });
export const getDoc = async ref => snapshot(ref);
export const setDoc = async (ref, data) => { state.docs.set(ref, structuredClone(data)); state.writes.push(ref); };
export const runTransaction = async (_db, update) => {
  if (state.failTransactions) throw new Error('network unavailable');
  const result = await update({ get: async ref => { if (state.gate) await state.gate; return snapshot(ref); },
    set: (ref, data) => { state.docs.set(ref, structuredClone(data)); state.writes.push(ref); } });
  if (state.postCommitGate) await state.postCommitGate;
  return result;
};
export const onSnapshot = (ref, callback) => {
  const entry = { ref, callback }; state.listeners.push(entry);
  return () => { state.listeners = state.listeners.filter(item => item !== entry); };
};
export const serverTimestamp = () => 'SERVER_TIMESTAMP';
`);
// Exercise real account storage, place writes, tombstones and reconciliation. Only the
// Firebase transport is replaced, so a newly added second store would fail these checks.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './firebase/init' && /\/lib\/(?:saved-places|account-local-storage|user-sync)\.ts/.test(context.parentURL ?? '')) {
      return { url: firebaseModule, shortCircuit: true };
    }
    if (specifier === 'firebase/firestore' && context.parentURL?.includes('/lib/user-sync.ts')) {
      return { url: firestoreModule, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  rows = new Map<string, string>();
  failRead = false;
  failWrite = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { if (this.failRead) throw Error('read unavailable'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw Error('quota exceeded'); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.failRead = false; this.failWrite = false; }
}
const local = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & { localStorage: MemoryStorage; sessionStorage: MemoryStorage };
browser.localStorage = local;
browser.sessionStorage = session;
Object.assign(globalThis, { window: browser, localStorage: local, sessionStorage: session });
const events: string[] = [];
browser.addEventListener('permamap-places-changed', event => events.push(event.type));

const { loadPlaces, normalisePlaces, isValidSavedPlace, updateSiteCountryContext, deletePlace, savePlace,
  updatePlacePosition, mergeIncomingPlaces } = await import('../lib/saved-places.ts');
const { accountLocalStorageKey, activeAccountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { subscribeUserMapData, subscribeUserPlaces, mergePlaces, upsertPlaceContext } = await import('../lib/user-sync.ts');
const { addTombstone } = await import('../lib/local-tombstones.ts');
hooks.deregister();

const key = 'permamap_saved_places';
const siteId = 'site:0.00000,0.00000';
const context = createSiteCountryContext({ siteId, countryCode: 'KE', jurisdictionReference: 'Grower jurisdiction',
  agriculturalRegionReference: 'Grower region', confirmed: true }, '2026-11-02T12:00:00.000Z')!;
const basePlace = (id = 'saved-place'): SavedPlace => ({
  id, name: 'Fictional data boundary fixture', lat: 0, lon: 0, biome: 'Recorded value',
  rainfall: 0, elevation: 0, savedAt: '2026-11-01T12:00:00.000Z', updatedAt: 100,
  label: 'field', color: '#123456', notes: 'Keep this grower-entered note.',
});
const seed = (places: unknown[], storageKey = activeAccountLocalStorageKey(key)) => local.setItem(storageKey, JSON.stringify(places));
const cloudPath = (uid = 'account-a') => `user_map_data/${uid}/data/places`;
// A stored confirmation names the exact place identity it describes (id, revision, savedAt).
const bound = (ctx: SiteCountryContext, place: SavedPlace = basePlace()) => ({
  ...ctx, base: { placeId: place.id, revision: place.updatedAt ?? 0, savedAt: place.savedAt },
});
// The cloud already holds the base place: a country edit may update it but never creates it.
const seedRemote = (places: unknown[], uid = 'account-a', deleted: Record<string, number> = {}) =>
  state.docs.set(cloudPath(uid), { places: structuredClone(places), deleted });
const remotePlaces = (uid = 'account-a') => state.docs.get(cloudPath(uid))?.places as SavedPlace[];
const reconcile = async (uid = 'account-a') => {
  let stop = () => {};
  await new Promise<void>(resolve => { stop = subscribeUserMapData(uid, { onMergeDone: resolve }); });
  stop();
};

test.beforeEach(() => {
  local.clear(); session.clear(); state.docs.clear(); state.writes.length = 0; events.length = 0;
  state.failTransactions = false; state.listeners = []; state.gate = null; state.postCommitGate = null;
  state.uid = 'account-a'; state.backend = true; bindMountedAccountLocalStorageUid('account-a');
});

test('country context saves and reloads through the existing place without changing its measurements or notes', async () => {
  const original = { ...basePlace(), futureOptionalProperty: { keep: true } };
  seed([original]);
  seedRemote([original]);
  const result = updateSiteCountryContext(siteId, context);
  assert.equal(result.status, 'local-saved');
  const loaded = loadPlaces()[0];
  const { siteCountryContext, updatedAt, ...preserved } = loaded;
  const { updatedAt: oldUpdatedAt, ...originalPreserved } = original;
  assert.deepEqual(preserved, originalPreserved);
  assert.deepEqual(siteCountryContext, bound(context, original));
  // Country confirmation must not turn a metadata edit into a deliberate site re-add.
  assert.equal(updatedAt, oldUpdatedAt);
  assert.deepEqual(events, ['permamap-places-changed']);
  await setImmediate();
  const remote = state.docs.get(cloudPath())?.places as SavedPlace[];
  assert.deepEqual(remote, loadPlaces());
  assert.deepEqual(state.writes, [cloudPath()]);
  assert.equal(local.length, 1, 'no parallel country-context local-storage ledger');
});

test('legacy and malformed optional metadata cannot delete an otherwise valid saved place', () => {
  const legacy = basePlace();
  const corrupt = { ...legacy, siteCountryContext: { countryCode: 'ZA', productionPlanSupported: true } };
  assert.equal(isValidSavedPlace(corrupt), true);
  assert.deepEqual(normalisePlaces([corrupt]), [legacy]);
  seed([corrupt]);
  const loaded = loadPlaces();
  assert.equal(loaded.length, 1);
  assert.equal(resolveSiteCountryContext(loaded, siteId).status, 'unknown');
  assert.deepEqual(loaded[0], legacy);
});

test('account A, account B and the signed-out guest retain independent context for an identical site', async () => {
  seed([basePlace()]);
  seedRemote([basePlace()]);
  assert.equal(updateSiteCountryContext(siteId, context).status, 'local-saved');
  // This roundtrip finishes before switching accounts; separate race cases cancel queued writes.
  await setImmediate();
  const aRaw = local.getItem(accountLocalStorageKey(key, 'account-a'));
  state.uid = 'account-b'; bindMountedAccountLocalStorageUid('account-b');
  assert.deepEqual(loadPlaces(), []);
  assert.equal(updateSiteCountryContext(siteId, context).status, 'missing-site');
  seed([basePlace('b-place')]);
  seedRemote([basePlace('b-place')], 'account-b');
  const bContext = { ...context, countryCode: 'GB' };
  assert.equal(updateSiteCountryContext(siteId, bContext).status, 'local-saved');
  await setImmediate();
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'GB');
  state.uid = null; bindMountedAccountLocalStorageUid(null);
  assert.deepEqual(loadPlaces(), []);
  seed([basePlace('guest-place')]);
  assert.equal(updateSiteCountryContext(siteId, { ...context, countryCode: 'US' }).status, 'local-saved');
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'US');
  assert.equal(local.getItem(accountLocalStorageKey(key, 'account-a')), aRaw);
  state.uid = 'account-a'; bindMountedAccountLocalStorageUid('account-a');
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'KE');
  await setImmediate();
  assert.deepEqual(new Set(state.writes), new Set([cloudPath('account-a'), cloudPath('account-b')]));
});

test('an auth singleton changing before the mounted account cannot redirect its metadata to the next account', async () => {
  seed([basePlace()]);
  seedRemote([basePlace()]);
  state.uid = 'account-b';
  assert.equal(updateSiteCountryContext(siteId, context).status, 'local-saved');
  await setImmediate();
  assert.equal(local.getItem(accountLocalStorageKey(key, 'account-b')), null);
  assert.equal(state.docs.has(cloudPath('account-b')), false);
  assert.equal(state.docs.has(cloudPath('account-a')), true);
  // Cloud access needs BOTH the mounted owner and the Firebase user to match; only local A moved.
  assert.deepEqual(state.writes, [], 'no cloud write while Firebase is another account');
  assert.equal(remotePlaces()[0].siteCountryContext, undefined);
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'KE', 'A\'s local pending edit is kept');
});

test('a read or write failure never claims a save, changes stored data, emits an event or queues a cloud write', async () => {
  seed([basePlace()]);
  const original = local.getItem(activeAccountLocalStorageKey(key));
  local.failRead = true;
  assert.equal(updateSiteCountryContext(siteId, context).status, 'storage-unavailable');
  local.failRead = false; local.failWrite = true;
  assert.equal(updateSiteCountryContext(siteId, context).status, 'storage-unavailable');
  local.failWrite = false;
  assert.equal(local.getItem(activeAccountLocalStorageKey(key)), original);
  assert.deepEqual(events, []);
  await setImmediate();
  assert.deepEqual(state.writes, []);
});

test('a stale editor cannot recreate a deleted place or assign context to its moved location', async () => {
  seed([basePlace()]);
  deletePlace('saved-place');
  const before = [...local.rows];
  events.length = 0;
  assert.equal(updateSiteCountryContext(siteId, context).status, 'missing-site');
  assert.deepEqual([...local.rows], before);
  assert.deepEqual(events, []);
  await setImmediate();
  state.writes.length = 0;
  seed([{ ...basePlace(), lat: 1, updatedAt: Date.now() + 1 }]);
  assert.equal(updateSiteCountryContext(siteId, context).status, 'missing-site');
  assert.equal(loadPlaces()[0].lat, 1);
  assert.equal(loadPlaces()[0].siteCountryContext, undefined);
  await setImmediate();
  assert.deepEqual(state.writes, []);
});

test('a stale alias behind a local tombstone is not resurrected by stamping a newer context update', async () => {
  seed([basePlace()]);
  addTombstone(activeAccountLocalStorageKey(`${key}_deleted`), 'saved-place', Date.now());
  const before = [...local.rows];
  assert.equal(updateSiteCountryContext(siteId, context).status, 'missing-site');
  assert.deepEqual([...local.rows], before);
  await setImmediate();
  assert.deepEqual(state.writes, []);
});

test('confirming one canonical site resolves all existing aliases while preserving unrelated sites', async () => {
  const other = { ...basePlace('other'), lat: 1 };
  const earlierZa = bound({ ...context, countryCode: 'ZA', confirmedAt: '2026-11-01T12:00:00.000Z' }, basePlace('first'));
  const rows = [{ ...basePlace('first'), siteCountryContext: earlierZa }, basePlace('alias'), other];
  seed(rows);
  seedRemote(rows);
  assert.equal(resolveSiteCountryContext(loadPlaces(), siteId).status, 'conflict');
  assert.equal(updateSiteCountryContext(siteId, context).status, 'local-saved');
  const loaded = loadPlaces();
  assert.equal(resolveSiteCountryContext(loaded, siteId).status, 'confirmed');
  assert.deepEqual(loaded.find(place => place.id === 'other'), other);
  assert.deepEqual(loaded.filter(place => place.id !== 'other').map(place => place.siteCountryContext),
    [bound(context, basePlace('first')), bound(context, basePlace('alias'))]);
  await setImmediate();
  assert.equal(state.writes.length, 2);
});

test('existing cross-device reconciliation roundtrips context and preserves newer metadata and deletion precedence', async () => {
  // Tombstones expire by design: this deletion must describe a recent base revision.
  const original = { ...basePlace(), updatedAt: Date.now() - 1_000 };
  seed([original]);
  seedRemote([original]);
  assert.equal(updateSiteCountryContext(siteId, context).status, 'local-saved');
  await setImmediate();
  local.clear(); // a second device, same account, has no cached places
  let unsubscribe: (() => void) | undefined;
  await new Promise<void>(resolve => {
    unsubscribe = subscribeUserMapData('account-a', { onMergeDone: resolve });
  });
  unsubscribe?.();
  assert.deepEqual(loadPlaces()[0].siteCountryContext, bound(context, original));
  const remote = structuredClone(state.docs.get(cloudPath())!);
  const row = (remote.places as SavedPlace[])[0];
  row.updatedAt = row.updatedAt! + 1;
  // A newer base revision carries its own confirmation, bound to that revision.
  row.siteCountryContext = bound({ ...context, countryCode: 'BR' }, row);
  state.docs.set(cloudPath(), remote);
  await new Promise<void>(resolve => {
    unsubscribe = subscribeUserMapData('account-a', { onMergeDone: resolve });
  });
  unsubscribe?.();
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'BR');
  state.docs.set(cloudPath(), { ...remote, deleted: { [row.id]: row.updatedAt! + 1 } });
  await new Promise<void>(resolve => {
    unsubscribe = subscribeUserMapData('account-a', { onMergeDone: resolve });
  });
  unsubscribe?.();
  assert.deepEqual(loadPlaces(), []);
  assert.equal(updateSiteCountryContext(siteId, context).status, 'missing-site');
});

test('invalid context, absent site and corrupt store perform no write', async () => {
  seed([basePlace()]);
  for (const [id, value, status] of [[siteId, {}, 'invalid-context'], ['site:0,0', context, 'invalid-context'],
    ['site:1.00000,0.00000', context, 'invalid-context'],
    ['site:1.00000,0.00000', { ...context, siteId: 'site:1.00000,0.00000' }, 'missing-site']] as const) {
    assert.equal(updateSiteCountryContext(id, value).status, status);
  }
  local.setItem(activeAccountLocalStorageKey(key), '{broken JSON');
  assert.equal(updateSiteCountryContext(siteId, context).status, 'storage-unavailable');
  await setImmediate();
  assert.deepEqual(state.writes, []);
  assert.deepEqual(events, []);
});

// A remote deletion is a real user action. Replacing it with a later metadata
// timestamp revives a site that the grower removed on another device.
test('country confirmation cannot recreate a place deleted on another device', async () => {
  const original = basePlace();
  seed([original]);
  state.docs.set(cloudPath(), { places: [], deleted: { [original.id]: Date.now() - 10 } });
  updateSiteCountryContext(siteId, context);
  await setImmediate();
  assert.deepEqual(state.docs.get(cloudPath())?.places, []);
  assert.ok((state.docs.get(cloudPath())?.deleted as Record<string, number>)[original.id]);
});

// ── Context-only sync: reviewed regressions ───────────────────────────────────────────────
// Everything below drives the REAL saved-places + user-sync code; only Firestore transport is a
// mock. These are mocked-network checks, not live two-device verification.
type Report = { placeId: string; outcome: string; localConfirmation: string };
const collect = () => { const reports: Report[] = []; return { reports, report: (r: Report) => { reports.push(r); } }; };
const emitPlaces = (uid = 'account-a') => {
  const path = cloudPath(uid);
  for (const listener of state.listeners.filter(item => item.ref === path)) {
    listener.callback({ exists: () => state.docs.has(path), data: () => state.docs.get(path), metadata: { hasPendingWrites: false } });
  }
};
const until = async (condition: () => boolean) => {
  for (let i = 0; i < 50 && !condition(); i++) await setImmediate();
  assert.ok(condition(), 'condition was not reached');
};
const planning = () => sitePlanningSupport(resolveSiteCountryContext(loadPlaces(), siteId)).allowAutoPlanning;
const zaContext = createSiteCountryContext({ siteId, countryCode: 'ZA', confirmed: true }, '2026-11-02T12:00:00.000Z')!;
const localRow = (id = 'saved-place') => loadPlaces().find(place => place.id === id);

test('a metadata update alone never creates a missing cloud place, with or without a tombstone', async () => {
  seed([basePlace()]);
  const first = collect();
  assert.equal(updateSiteCountryContext(siteId, context, first.report).status, 'local-saved');
  await setImmediate();
  assert.equal(state.docs.has(cloudPath()), false, 'no remote document may be created by a country edit');
  seedRemote([{ ...basePlace('another-site'), lat: 5 }]);
  const before = structuredClone(state.docs.get(cloudPath()));
  const second = collect();
  updateSiteCountryContext(siteId, context, second.report);
  await setImmediate();
  assert.deepEqual(state.docs.get(cloudPath()), before);
  assert.deepEqual(state.writes, []);
  // Missing-remote is PENDING (a place made offline reaches the cloud through ordinary reconcile).
  for (const { reports } of [first, second]) {
    assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['missing-remote', 'kept']]);
  }
  assert.equal(await upsertPlaceContext('account-a', context), 'unbound', 'a context with no base binding approves nothing');
});

test('a remotely deleted site rolls the still-current local confirmation back and reports the rejection', async () => {
  seed([basePlace()]);
  state.docs.set(cloudPath(), { places: [], deleted: { 'saved-place': Date.now() - 10 } });
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, zaContext, report);
  assert.equal(planning(), true, 'local description is pending until the cloud answers');
  await setImmediate();
  assert.deepEqual(state.writes, []);
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['deleted', 'rolled-back']]);
  assert.equal(planning(), false);
  assert.equal(localRow()?.updatedAt, 100, 'rollback never touches the place revision');
  assert.equal(localRow()?.lat, 0);
});

test('offline confirmation is pending, and a later remote deletion wins at reconcile', async () => {
  seed([basePlace()]);
  state.failTransactions = true;
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, zaContext, report);
  await setImmediate();
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['unavailable', 'kept']]);
  assert.equal(planning(), true);
  assert.equal(localRow()?.updatedAt, 100, 'the offline metadata edit has no timestamp that could outrank a deletion');
  state.failTransactions = false;
  seedRemote([], 'account-a', { 'saved-place': Date.now() - 10 });
  await reconcile();
  assert.deepEqual(loadPlaces(), []);
  assert.deepEqual(remotePlaces(), []);
  assert.ok((state.docs.get(cloudPath())?.deleted as Record<string, number>)['saved-place'], 'tombstone survives');
});

test('an open whole-map subscription receives a remote tombstone after local metadata', async () => {
  seed([basePlace()]); seedRemote([basePlace()]);
  updateSiteCountryContext(siteId, context);
  await setImmediate();
  let stop = () => {};
  await new Promise<void>(resolve => { stop = subscribeUserMapData('account-a', { onMergeDone: resolve }); });
  assert.ok(state.listeners.some(item => item.ref === cloudPath()));
  state.docs.set(cloudPath(), { places: [], deleted: { 'saved-place': Date.now() - 10 } });
  emitPlaces();
  assert.deepEqual(loadPlaces(), []);
  stop();
  assert.equal(state.listeners.length, 0);
});

for (const [name, patch] of [['notes edit', { notes: 'Edited on another device' }], ['pin move', { lat: 1 }]] as const) {
  test(`a remote ${name} before metadata upload is neither overwritten nor left locally approved`, async () => {
    const remoteRow = { ...basePlace(), ...patch, updatedAt: 150 };
    seed([basePlace()]); seedRemote([remoteRow]);
    const { reports, report } = collect();
    updateSiteCountryContext(siteId, zaContext, report);
    assert.equal(planning(), true);
    await setImmediate();
    assert.deepEqual(remotePlaces(), [remoteRow], 'the newer remote row is untouched');
    assert.deepEqual(state.writes, []);
    assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['base-changed', 'rolled-back']]);
    assert.equal(planning(), false, 'a rejected confirmation must not keep automatic planning on');
    assert.equal(localRow()?.siteCountryContext, undefined);
    assert.equal(localRow()?.lat, 0, 'geometry is never overwritten by the rollback');
    await reconcile();
    assert.deepEqual(localRow(), remoteRow);
  });
}

test('a cloud row that is behind this device is pending, not a rejection', async () => {
  seed([basePlace()]); seedRemote([{ ...basePlace(), updatedAt: 50 }]);
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, zaContext, report);
  await setImmediate();
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['remote-behind', 'kept']]);
  assert.equal(planning(), true);
  assert.deepEqual(state.writes, []);
});

test('a rollback never erases a newer local confirmation', async () => {
  seed([basePlace()]); seedRemote([{ ...basePlace(), updatedAt: 150 }]);
  let release = () => {};
  state.gate = new Promise<void>(resolve => { release = resolve; });
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, zaContext, report);
  const newer = bound({ ...context, countryCode: 'GB', confirmedAt: '2026-11-02T20:00:00.000Z' });
  seed([{ ...basePlace(), siteCountryContext: newer }]);
  release(); await setImmediate();
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['base-changed', 'kept']]);
  assert.deepEqual(localRow()?.siteCountryContext, newer);
});

test('two devices confirming the same base converge on one context without escalating the revision', async () => {
  const later = bound({ ...context, countryCode: 'BR', confirmedAt: '2026-11-02T18:00:00.000Z' });
  seed([basePlace()]); seedRemote([{ ...basePlace(), siteCountryContext: later }]);
  const older = collect();
  updateSiteCountryContext(siteId, context, older.report);
  await setImmediate();
  assert.deepEqual(older.reports.map(item => [item.outcome, item.localConfirmation]), [['superseded', 'replaced']]);
  assert.deepEqual(remotePlaces()[0].siteCountryContext, later);
  assert.deepEqual(state.writes, [], 'a superseded update writes nothing');
  assert.deepEqual(localRow()?.siteCountryContext, later, 'the authoritative winner is applied without waiting for a listener event');
  await reconcile();
  assert.equal(localRow()?.siteCountryContext?.countryCode, 'BR', 'the device converges on the later confirmation');
  assert.equal(localRow()?.updatedAt, 100);
  assert.equal(remotePlaces()[0].updatedAt, 100);
  // The newer confirmation overwrites the older one in the cloud, still at the same base revision.
  const earlier = bound({ ...context, confirmedAt: '2026-11-02T10:00:00.000Z' });
  seedRemote([{ ...basePlace(), siteCountryContext: earlier }]);
  const winner = collect();
  updateSiteCountryContext(siteId, { ...context, countryCode: 'GB', confirmedAt: '2026-11-02T20:00:00.000Z' }, winner.report);
  await setImmediate();
  assert.deepEqual(winner.reports.map(item => item.outcome), ['applied']);
  assert.equal(remotePlaces()[0].siteCountryContext?.countryCode, 'GB');
  assert.equal(remotePlaces()[0].updatedAt, 100);
  // Pure merge: identical timestamps and different descriptions still pick one answer, either order.
  const a = { ...basePlace(), siteCountryContext: bound({ ...context, countryCode: 'KE' }) };
  const b = { ...basePlace(), siteCountryContext: bound({ ...context, countryCode: 'ZA' }) };
  const forward = mergePlaces([a], [b], {}, {}, Date.now()).items[0].siteCountryContext;
  const reverse = mergePlaces([b], [a], {}, {}, Date.now()).items[0].siteCountryContext;
  assert.deepEqual(forward, reverse);
});

test('a context copied into a whole-place edit, move or deliberate re-add of the same id is not approval', async () => {
  const confirmed = { ...basePlace(), siteCountryContext: bound(zaContext) };
  // Pure merge: a re-added row (new revision) carrying the old row's context copy keeps none of it.
  const readded = { ...confirmed, updatedAt: 300 };
  assert.equal(mergePlaces([], [readded], {}, {}, Date.now()).items[0].siteCountryContext, undefined);
  assert.equal(mergePlaces([readded], [confirmed], {}, {}, Date.now()).items[0].siteCountryContext, undefined);
  // Store paths: a whole-place save and a pin move both mint a revision, so the copy is dropped.
  seed([confirmed]);
  assert.equal(planning(), true);
  savePlace({ ...loadPlaces()[0] });
  assert.equal(localRow()?.siteCountryContext, undefined);
  assert.equal(planning(), false);
  seed([confirmed]);
  updatePlacePosition('saved-place', 1, 0);
  updatePlacePosition('saved-place', 0, 0);
  assert.equal(localRow()?.siteCountryContext, undefined, 'moving back must not re-bind the old approval');
  await setImmediate(); // let the whole-place saves above finish their own cloud transactions first
  state.docs.clear(); state.writes.length = 0;
  // A pending confirmation cannot cross a re-add that has a new creation identity.
  seed([confirmed]);
  seedRemote([{ ...basePlace(), updatedAt: 300, savedAt: '2026-11-02T09:00:00.000Z' }]);
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, zaContext, report);
  await setImmediate();
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['base-changed', 'rolled-back']]);
  assert.deepEqual(state.writes, []);
});

test('original explicit re-add after a deletion still recreates the place and clears its tombstone', async () => {
  seed([basePlace()]); seedRemote([basePlace()]);
  deletePlace('saved-place');
  await setImmediate();
  assert.deepEqual(remotePlaces(), []);
  savePlace(basePlace());
  await setImmediate();
  assert.equal(remotePlaces()[0]?.id, 'saved-place');
  assert.equal((state.docs.get(cloudPath())?.deleted as Record<string, number>)['saved-place'], undefined);
  assert.equal(localRow()?.id, 'saved-place');
});

test('legacy rows without updatedAt are told apart by their creation stamp, not both treated as revision zero', () => {
  const legacy = (savedAt: string, id = 'legacy') => { const { updatedAt: _unused, ...row } = basePlace(id); return { ...row, savedAt }; };
  const old = legacy('2020-01-01T00:00:00.000Z');
  const newer = legacy('2026-10-01T00:00:00.000Z');
  const oldConfirmed = { ...old, siteCountryContext: { ...zaContext, base: { placeId: 'legacy', revision: Date.parse(old.savedAt), savedAt: old.savedAt } } };
  for (const [remote, localRows] of [[[newer], [oldConfirmed]], [[oldConfirmed], [newer]]] as const) {
    const [row] = mergePlaces([...remote], [...localRows], {}, {}, Date.now()).items;
    assert.equal(row.savedAt, newer.savedAt, 'the newer legacy row survives in either source order');
    assert.equal(row.siteCountryContext, undefined, 'the older row\'s country must not attach to the newer row');
  }
  // Same legacy row, same identity: its own confirmation round-trips.
  assert.equal(mergePlaces([], [oldConfirmed], {}, {}, Date.now()).items[0].siteCountryContext?.countryCode, 'ZA');
  // Tombstone behaviour preserved: a legacy row older than its deletion stays deleted; one saved after it is a re-add.
  const deletedAt = Date.parse('2025-01-01T00:00:00.000Z');
  assert.deepEqual(mergePlaces([old], [], { legacy: deletedAt }, {}, deletedAt + 1000).items, []);
  assert.equal(mergePlaces([newer], [], { legacy: deletedAt }, {}, deletedAt + 1000).items.length, 1);
});

for (const scenario of ['accepted', 'rejected'] as const) {
  test(`a late account-A cloud answer (${scenario}) after switching to B writes nothing and reports nothing`, async () => {
    seed([basePlace()]);
    const aRaw = local.getItem(accountLocalStorageKey(key, 'account-a'));
    seedRemote([scenario === 'accepted' ? basePlace() : { ...basePlace(), updatedAt: 150 }]);
    const remoteBefore = structuredClone(state.docs.get(cloudPath()));
    let release = () => {};
    state.gate = new Promise<void>(resolve => { release = resolve; });
    const { reports, report } = collect();
    updateSiteCountryContext(siteId, zaContext, report);
    const aAfterLocalSave = local.getItem(accountLocalStorageKey(key, 'account-a'));
    assert.notEqual(aAfterLocalSave, aRaw);
    state.uid = 'account-b'; bindMountedAccountLocalStorageUid('account-b');
    seed([basePlace('b-place')]);
    const bRaw = local.getItem(accountLocalStorageKey(key, 'account-b'));
    release();
    await setImmediate(); await setImmediate();
    assert.deepEqual(state.writes, [], 'the obsolete operation must not mutate account A\'s cloud row');
    assert.deepEqual(state.docs.get(cloudPath()), remoteBefore);
    assert.deepEqual(reports, [], 'and must not report into account B\'s UI');
    assert.equal(local.getItem(accountLocalStorageKey(key, 'account-a')), aAfterLocalSave, 'no late rollback either');
    assert.equal(local.getItem(accountLocalStorageKey(key, 'account-b')), bRaw);
    assert.equal(await upsertPlaceContext('account-a', bound(zaContext)), 'account-changed');
  });
}

for (const transition of ['none', 'mounted owner', 'Firebase user'] as const) {
  test(`a committed country save reports only while both account identities remain current (${transition})`, async () => {
    const placeA = basePlace();
    const placeB = basePlace('b-place');
    const keyA = accountLocalStorageKey(key, 'account-a');
    const keyB = accountLocalStorageKey(key, 'account-b');
    seed([placeA]);
    seedRemote([placeA]);
    seed([placeB], keyB);
    seedRemote([placeB], 'account-b');
    const bLocal = local.getItem(keyB);
    const bRemote = structuredClone(state.docs.get(cloudPath('account-b')));

    let release = () => {};
    state.postCommitGate = new Promise<void>(resolve => { release = resolve; });
    const { reports, report } = collect();
    let aLocal: string | null = null;
    try {
      assert.equal(updateSiteCountryContext(siteId, context, report).status, 'local-saved');
      aLocal = local.getItem(keyA);
      await setImmediate();
      // The write has landed in the mock, but its delivery is still held.
      assert.deepEqual(state.writes, [cloudPath()]);
      assert.deepEqual(remotePlaces(), [{ ...placeA, siteCountryContext: bound(context, placeA) }]);
      assert.equal(reports.length, 0);

      if (transition === 'mounted owner') bindMountedAccountLocalStorageUid('account-b');
      if (transition === 'Firebase user') state.uid = 'account-b';
    } finally {
      release();
      await setImmediate();
    }

    assert.deepEqual(reports.map(item => item.outcome), transition === 'none' ? ['applied'] : []);
    assert.deepEqual(state.writes, [cloudPath()]);
    assert.deepEqual(remotePlaces(), [{ ...placeA, siteCountryContext: bound(context, placeA) }]);
    assert.deepEqual(state.docs.get(cloudPath('account-b')), bRemote);
    assert.equal(local.getItem(keyA), aLocal);
    assert.equal(local.getItem(keyB), bLocal);
  });
}

test('unreadable or malformed deletion storage fails closed for metadata writes', async () => {
  seed([basePlace()]); seedRemote([basePlace()]);
  const original = local.getItem(activeAccountLocalStorageKey(key));
  for (const raw of ['{broken', '[]', '"text"', JSON.stringify({ 'saved-place': 'yesterday' }), JSON.stringify({ 'saved-place': -1 })]) {
    local.setItem(activeAccountLocalStorageKey(`${key}_deleted`), raw);
    assert.equal(updateSiteCountryContext(siteId, context).status, 'storage-unavailable', raw);
  }
  assert.equal(local.getItem(activeAccountLocalStorageKey(key)), original);
  assert.deepEqual(events, []);
  await setImmediate();
  assert.deepEqual(state.writes, []);
});

test('a shared import binds contexts to the surviving row and respects a local deletion', () => {
  const incoming = { ...basePlace(), siteCountryContext: bound(zaContext) };
  seed([basePlace()]);
  assert.equal(mergeIncomingPlaces([incoming])[0].siteCountryContext?.countryCode, 'ZA');
  local.clear();
  seed([{ ...basePlace(), updatedAt: 200 }]);
  assert.equal(mergeIncomingPlaces([incoming])[0].siteCountryContext, undefined, 'older row context must not attach to a newer local row');
  local.clear();
  addTombstone(activeAccountLocalStorageKey(`${key}_deleted`), 'saved-place', Date.now());
  assert.deepEqual(mergeIncomingPlaces([incoming]), []);
});

test('places-only subscription: state, current-subscription checks, A to B disposal and no other documents', async () => {
  seed([basePlace()]); seedRemote([basePlace()]);
  const states: string[] = []; let changes = 0;
  const stop = subscribeUserPlaces('account-a', { onState: value => states.push(value), onPlaces: () => { changes += 1; } });
  await until(() => states.includes('live'));
  assert.deepEqual(states, ['syncing', 'live']);
  assert.ok(changes >= 1);
  assert.deepEqual(state.listeners.map(item => item.ref), [cloudPath()], 'no shape/water/survey/design listeners');
  assert.ok(state.writes.every(path => path === cloudPath()));
  // A remote edit is delivered while open.
  seedRemote([{ ...basePlace(), notes: 'Remote edit', updatedAt: 150 }]);
  emitPlaces();
  assert.equal(localRow()?.notes, 'Remote edit');
  // After switching to B the A subscription ignores late snapshots and never touches A's cache.
  const aRaw = local.getItem(accountLocalStorageKey(key, 'account-a'));
  state.uid = 'account-b'; bindMountedAccountLocalStorageUid('account-b');
  seedRemote([{ ...basePlace(), notes: 'Late A edit', updatedAt: 160 }]);
  emitPlaces();
  assert.equal(local.getItem(accountLocalStorageKey(key, 'account-a')), aRaw);
  stop();
  assert.equal(state.listeners.length, 0);
  assert.deepEqual(states, ['syncing', 'live']);
});

test('places-only subscription reports unavailable without a backend and offline when reconcile fails', async () => {
  state.backend = false;
  const unavailable: string[] = [];
  subscribeUserPlaces('account-a', { onState: value => unavailable.push(value) })();
  assert.deepEqual(unavailable, ['unavailable']);
  state.backend = true; state.failTransactions = true;
  seed([basePlace()]);
  const states: string[] = [];
  const stop = subscribeUserPlaces('account-a', { onState: value => states.push(value) });
  await until(() => states.includes('offline'));
  assert.deepEqual(states, ['syncing', 'offline']);
  assert.equal(state.listeners.length, 0, 'no live listener claims delivery that is not happening');
  assert.equal(localRow()?.id, 'saved-place', 'local data is kept');
  stop();
});

test('a disposed places-only subscription never attaches a listener or reports after teardown', async () => {
  seed([basePlace()]); seedRemote([basePlace()]);
  const states: string[] = [];
  subscribeUserPlaces('account-a', { onState: value => states.push(value) })();
  await setImmediate(); await setImmediate();
  assert.equal(state.listeners.length, 0);
  assert.deepEqual(states, ['syncing']);
});

test('a superseded local approval is replaced by the cloud winner, so planning follows the authoritative confirmation', async () => {
  const winner = bound({ ...context, countryCode: 'KE', confirmedAt: '2026-11-02T18:00:00.000Z' });
  seed([basePlace()]); seedRemote([{ ...basePlace(), siteCountryContext: winner }]);
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, { ...zaContext, confirmedAt: '2026-11-02T10:00:00.000Z' }, report);
  assert.equal(planning(), true, 'the losing local confirmation is pending until the cloud answers');
  await setImmediate();
  assert.deepEqual(state.writes, [], 'the transaction wrote nothing, so no listener event will follow');
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['superseded', 'replaced']]);
  assert.equal(planning(), false, 'planning must not stay approved by the confirmation that lost');
  assert.deepEqual(localRow()?.siteCountryContext, winner);
  assert.deepEqual(remotePlaces()[0].siteCountryContext, winner);
  assert.equal(localRow()?.updatedAt, 100);
});

test('a superseded answer never overwrites a newer local confirmation made while it was in flight', async () => {
  const winner = bound({ ...context, countryCode: 'KE', confirmedAt: '2026-11-02T18:00:00.000Z' });
  seed([basePlace()]); seedRemote([{ ...basePlace(), siteCountryContext: winner }]);
  let release = () => {};
  state.gate = new Promise<void>(resolve => { release = resolve; });
  const { reports, report } = collect();
  updateSiteCountryContext(siteId, { ...zaContext, confirmedAt: '2026-11-02T10:00:00.000Z' }, report);
  const newer = bound({ ...context, countryCode: 'GB', confirmedAt: '2026-11-02T22:00:00.000Z' });
  seed([{ ...basePlace(), siteCountryContext: newer }]);
  release(); await setImmediate();
  assert.deepEqual(reports.map(item => [item.outcome, item.localConfirmation]), [['superseded', 'kept']]);
  assert.deepEqual(localRow()?.siteCountryContext, newer);
});

test('a country edit preserves every unrelated raw row, even malformed ones, and refuses a non-array store', async () => {
  const malformed = { id: 'broken', lat: 'north', unknownLegacy: true };
  const other = { ...basePlace('other'), lat: 1 };
  const staleDuplicate = { ...basePlace(), updatedAt: 50 };
  seed([malformed, basePlace(), other, 'not a row', null, staleDuplicate]);
  seedRemote([malformed, basePlace()]);
  assert.equal(updateSiteCountryContext(siteId, context).status, 'local-saved');
  const raw = JSON.parse(local.getItem(activeAccountLocalStorageKey(key))!) as unknown[];
  assert.equal(raw.length, 6, 'a metadata edit is not a cleanup or migration');
  assert.deepEqual(raw[0], malformed);
  assert.deepEqual(raw[1], { ...basePlace(), siteCountryContext: bound(context) });
  assert.deepEqual(raw[2], other);
  assert.equal(raw[3], 'not a row');
  assert.equal(raw[4], null);
  assert.deepEqual(raw[5], staleDuplicate, 'a stale duplicate of another identity is not touched');
  await setImmediate();
  assert.deepEqual(remotePlaces(), [malformed, { ...basePlace(), siteCountryContext: bound(context) }],
    'the cloud row set keeps its unrelated malformed row too');
  for (const stored of ['{}', '"text"', 'null', '7']) {
    local.setItem(activeAccountLocalStorageKey(key), stored);
    state.writes.length = 0; events.length = 0;
    assert.equal(updateSiteCountryContext(siteId, context).status, 'storage-unavailable', stored);
    assert.equal(local.getItem(activeAccountLocalStorageKey(key)), stored, 'refused, not rewritten');
    assert.deepEqual(events, []);
  }
});

test('cloud writes need both account guards: mounted A with Firebase B writes and reports nothing', async () => {
  seed([basePlace()]); seedRemote([basePlace()]);
  const remoteBefore = structuredClone(state.docs.get(cloudPath()));
  state.uid = 'account-b';
  const first = collect();
  assert.equal(updateSiteCountryContext(siteId, zaContext, first.report).status, 'local-saved');
  await setImmediate();
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.docs.get(cloudPath()), remoteBefore);
  assert.deepEqual(first.reports, []);
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'ZA', 'A\'s local pending edit is neither erased nor moved to B');
  assert.equal(local.getItem(accountLocalStorageKey(key, 'account-b')), null);
  assert.equal(await upsertPlaceContext('account-a', bound(zaContext)), 'account-changed');
  // Firebase moves to B only after the operation started (mounted owner stays A).
  local.clear(); state.docs.clear(); state.writes.length = 0; state.uid = 'account-a';
  seed([basePlace()]); seedRemote([basePlace()]);
  const midFlight = structuredClone(state.docs.get(cloudPath()));
  let release = () => {};
  state.gate = new Promise<void>(resolve => { release = resolve; });
  const second = collect();
  updateSiteCountryContext(siteId, zaContext, second.report);
  state.uid = 'account-b';
  release();
  await setImmediate(); await setImmediate();
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.docs.get(cloudPath()), midFlight);
  assert.deepEqual(second.reports, [], 'no late report under Firebase B');
  assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'ZA');
});
