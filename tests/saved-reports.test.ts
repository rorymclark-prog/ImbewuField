import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

import { DEMO_LOCATION, DEMO_SITE_DATA, DEMO_WATER_DATA } from '../lib/demo-site.ts';
import type { SavedReport } from '../lib/saved-reports.ts';

const KEY = 'imbewu_saved_reports';

const accountHarness: { currentUid: string | null } = { currentUid: null };
Object.assign(globalThis, { __imbewuSavedReportsAccountHarness: accountHarness });
const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const harness = globalThis.__imbewuSavedReportsAccountHarness;
export const getFirebase = () => ({
  auth: { currentUser: harness.currentUid ? { uid: harness.currentUid } : null },
});
export const isBackendConfigured = () => Boolean(harness.currentUid);
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/lib/account-local-storage.ts')
        && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  readonly rows = new Map<string, string>();
  throwOnWrite = false;
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error('quota exceeded');
    this.rows.set(key, value);
  }
  removeItem(key: string): void { this.rows.delete(key); }
  clear(): void { this.rows.clear(); }
}

const local = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
};
browser.localStorage = local;
browser.sessionStorage = session;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });

const { deleteReport, loadReports, saveReport } = await import('../lib/saved-reports.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

function report(id: string, overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id,
    name: `Report ${id}`,
    savedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    lang: 'en',
    report: `# ${id}`,
    location: structuredClone(DEMO_LOCATION),
    siteData: structuredClone(DEMO_SITE_DATA),
    waterData: structuredClone(DEMO_WATER_DATA),
    ...overrides,
  };
}

function reset(): void {
  local.rows.clear();
  session.rows.clear();
  local.throwOnWrite = false;
  accountHarness.currentUid = null;
}

test('load filters malformed rows, keeps newest duplicate and bounds corrupt oversized storage', () => {
  reset();
  const many = Array.from({ length: 80 }, (_, index) => report(`r-${index}`));
  local.setItem(KEY, JSON.stringify([
    report('duplicate', { name: 'newest copy' }),
    null,
    42,
    {},
    report('bad-date', { savedAt: 'not a date' }),
    { ...report('bad-location'), location: { lat: null } },
    report('duplicate', { name: 'stale copy' }),
    ...many,
  ]));

  const loaded = loadReports();
  assert.ok(loaded.length > 0 && loaded.length < many.length, 'persisted report count must be bounded');
  assert.equal(new Set(loaded.map((row) => row.id)).size, loaded.length);
  assert.equal(loaded.find((row) => row.id === 'duplicate')?.name, 'newest copy');
  assert.ok(loaded.every((row) => Number.isFinite(row.location.lat)));
});

test('a valid save is newest, replaces its own id, and emits exactly one event', () => {
  reset();
  local.setItem(KEY, JSON.stringify([report('a'), report('b')]));
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-reports-changed', listener);

  const replacement = report('b', { name: 'updated' });
  const result = saveReport(replacement);

  assert.equal(result.saved, true);
  assert.deepEqual(result.reports.map((row) => row.id), ['b', 'a']);
  assert.equal(result.reports[0].name, 'updated');
  assert.equal(changes, 1);
  browser.removeEventListener('imbewu-reports-changed', listener);
});

test('invalid reports cannot overwrite good storage or announce a false save', () => {
  reset();
  const good = report('good');
  local.setItem(KEY, JSON.stringify([good]));
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-reports-changed', listener);
  const before = local.getItem(KEY);

  const result = saveReport({ ...good, id: '', report: '' });

  assert.equal(result.saved, false);
  assert.deepEqual(result.reports, [good]);
  assert.equal(local.getItem(KEY), before);
  assert.equal(changes, 0);
  browser.removeEventListener('imbewu-reports-changed', listener);
});

test('a failed write leaves save and delete results at persisted truth', () => {
  reset();
  const existing = report('existing');
  local.setItem(KEY, JSON.stringify([existing]));
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-reports-changed', listener);
  local.throwOnWrite = true;

  assert.deepEqual(saveReport(report('new')), { reports: [existing], saved: false, reason: 'storage-error' });
  assert.deepEqual(deleteReport('existing'), [existing]);
  assert.equal(changes, 0);
  assert.deepEqual(loadReports(), [existing]);

  local.throwOnWrite = false;
  browser.removeEventListener('imbewu-reports-changed', listener);
});

test('delete only announces a real change and missing ids are no-ops', () => {
  reset();
  local.setItem(KEY, JSON.stringify([report('a'), report('b')]));
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-reports-changed', listener);

  assert.deepEqual(deleteReport('missing').map((row) => row.id), ['a', 'b']);
  assert.equal(changes, 0);
  assert.deepEqual(deleteReport('a').map((row) => row.id), ['b']);
  assert.equal(changes, 1);

  browser.removeEventListener('imbewu-reports-changed', listener);
});

test('sample mode cannot read, save or delete the real report store', () => {
  reset();
  const real = report('real');
  local.setItem(KEY, JSON.stringify([real]));
  session.setItem('imbewu_sample_mode', '1');
  const before = local.getItem(KEY);

  assert.deepEqual(loadReports(), []);
  assert.deepEqual(saveReport(report('demo')), { reports: [], saved: false });
  assert.deepEqual(deleteReport('real'), []);
  assert.equal(local.getItem(KEY), before);
});

test("one shared device never exposes farmer A's saved reports to farmer B", () => {
  reset();
  local.setItem(KEY, JSON.stringify([report('legacy', { name: 'Unknown legacy owner' })]));

  accountHarness.currentUid = 'farmer-a';
  assert.equal(saveReport(report('farmer-a')).saved, true);

  accountHarness.currentUid = 'farmer-b';
  assert.deepEqual(loadReports(), []);
  assert.equal(saveReport(report('farmer-b')).saved, true);

  accountHarness.currentUid = 'farmer-a';
  assert.deepEqual(loadReports().map((row) => row.id), ['farmer-a']);
  assert.ok(local.getItem(accountLocalStorageKey(KEY, 'farmer-a')));
  assert.ok(local.getItem(accountLocalStorageKey(KEY, 'farmer-b')));
  assert.ok(local.getItem(KEY), 'unowned legacy reports remain quarantined');
});

test('saving a NEW report at 50 stored fails with store-full reason and leaves storage byte-identical', () => {
  reset();
  const reports50 = Array.from({ length: 50 }, (_, i) => report(`r-${i}`));
  local.setItem(KEY, JSON.stringify(reports50));
  const beforeBytes = local.getItem(KEY);

  const result = saveReport(report('r-50'));

  assert.equal(result.saved, false);
  assert.equal(result.reason, 'store-full');
  assert.equal(local.getItem(KEY), beforeBytes);
  const loaded = loadReports();
  assert.equal(loaded.length, 50);
  assert.equal(loaded[49].id, 'r-49', 'oldest report (r-49) must still be present');
});

test('updating an EXISTING report at 50 stored succeeds and keeps stored count at 50', () => {
  reset();
  const reports50 = Array.from({ length: 50 }, (_, i) => report(`r-${i}`));
  local.setItem(KEY, JSON.stringify(reports50));

  const updatedReport = report('r-49', { name: 'Updated Oldest Report' });
  const result = saveReport(updatedReport);

  assert.equal(result.saved, true);
  assert.equal(result.reason, undefined);
  assert.equal(result.reports.length, 50);
  assert.equal(result.reports[0].id, 'r-49');
  assert.equal(result.reports[0].name, 'Updated Oldest Report');
  assert.equal(loadReports().length, 50);
});

test('normal save below cap succeeds without reason', () => {
  reset();
  const result = saveReport(report('r-1'));

  assert.equal(result.saved, true);
  assert.equal(result.reason, undefined);
  assert.equal(result.reports.length, 1);
});

test('returned reason distinguishes full-store from storage write failure', () => {
  reset();
  const reports50 = Array.from({ length: 50 }, (_, i) => report(`r-${i}`));
  local.setItem(KEY, JSON.stringify(reports50));
  const fullStoreResult = saveReport(report('r-new'));
  assert.equal(fullStoreResult.saved, false);
  assert.equal(fullStoreResult.reason, 'store-full');

  reset();
  local.setItem(KEY, JSON.stringify([report('r-1')]));
  local.throwOnWrite = true;
  const storageErrorResult = saveReport(report('r-2'));
  assert.equal(storageErrorResult.saved, false);
  assert.equal(storageErrorResult.reason, 'storage-error');
  local.throwOnWrite = false;
});
