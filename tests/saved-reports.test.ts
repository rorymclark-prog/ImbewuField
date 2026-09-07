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

// Exercise the real sample interception boundary, rather than relying on the report store
// to make its buttons no-ops. Tour report history must work without touching this backing map.
Object.defineProperty(globalThis, 'Storage', { configurable: true, value: MemoryStorage });

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

const { deleteReport, loadReports, saveReport, reportSiteName } = await import('../lib/saved-reports.ts');
const { enterSampleMode, exitSampleMode } = await import('../lib/sample-mode.ts');
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
  exitSampleMode();
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

test('sample reports can be saved, reopened, updated and deleted without reading or writing real history', () => {
  reset();
  const real = report('real');
  local.setItem(KEY, JSON.stringify([real]));
  accountHarness.currentUid = 'farmer-a';
  assert.equal(saveReport(report('account-report')).saved, true);
  const before = [...local.rows];
  assert.equal(enterSampleMode(), true);

  assert.deepEqual(loadReports(), []);
  const first = report('demo');
  assert.deepEqual(saveReport(first), { reports: [first], saved: true });
  assert.deepEqual(loadReports(), [first], 'returning to Reports must reopen the saved snapshot');
  const refreshed = report('demo', { report: '# Updated design', lang: 'zu' });
  assert.equal(saveReport(refreshed).saved, true);
  assert.deepEqual(loadReports(), [refreshed], 'saving the same ID refreshes only that snapshot');
  assert.deepEqual(deleteReport('real'), [refreshed], 'a real ID cannot reach the real store');
  assert.deepEqual(deleteReport('demo'), []);
  assert.deepEqual([...local.rows], before, 'neither bare nor account-owned real history changed');

  exitSampleMode();
  assert.deepEqual(loadReports().map(row => row.id), ['account-report']);
  assert.equal(local.getItem(KEY), JSON.stringify([real]));
});

test('report history stays disposable when the sample is restarted or exited', () => {
  reset();
  assert.equal(enterSampleMode(), true);
  assert.equal(saveReport(report('practice')).saved, true);
  assert.equal(loadReports().length, 1);
  assert.equal(enterSampleMode(), true);
  assert.deepEqual(loadReports(), [], 'starting a fresh tour discards the earlier practice history');
  assert.equal(saveReport(report('another-practice')).saved, true);
  exitSampleMode();
  assert.deepEqual(loadReports(), [], 'practice reports never become signed-out real history');
  accountHarness.currentUid = 'farmer-b';
  assert.deepEqual(loadReports(), [], 'practice reports never become another account’s history');
});

test('sample report save and delete notify the chooser without a real storage write', () => {
  reset();
  assert.equal(enterSampleMode(), true);
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener('imbewu-reports-changed', listener);
  assert.equal(saveReport(report('practice')).saved, true);
  assert.equal(changes, 1);
  assert.deepEqual(deleteReport('practice'), []);
  assert.equal(changes, 2);
  assert.equal(local.rows.size, 0);
  browser.removeEventListener('imbewu-reports-changed', listener);
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


test('generation settings survive saving and reopening without inheriting edited controls', () => {
  reset();
  const settings = { tone: 'professional' as const, length: 'comprehensive' as const, language: 'zu', bilingual: true, sections: ['Executive Summary', 'Water Harvesting'], generatedAt: '2026-09-07T08:00:00Z', provider: 'Anthropic', model: 'claude-sonnet-4-6' };
  saveReport(report('original', { lang: 'zu', settings, coverChoice: 'map' }));
  settings.sections.push('Soil Strategy');
  const restored = loadReports()[0];
  assert.equal(restored.settings?.tone, 'professional');
  assert.equal(restored.settings?.length, 'comprehensive');
  assert.deepEqual(restored.settings?.sections, ['Executive Summary', 'Water Harvesting']);
  assert.equal(restored.settings?.bilingual, true);
  assert.equal(restored.coverChoice, 'map');
  saveReport(report('new-version', { settings: { ...settings, tone: 'simple' } }));
  assert.equal(loadReports().length, 2);
  assert.equal(loadReports().find(r => r.id === 'original')?.settings?.tone, 'professional');
});

test('legacy or corrupt metadata never claims default generation settings', () => {
  reset();
  saveReport(report('legacy'));
  saveReport(report('corrupt', { settings: { tone: 'simple', length: 'standard' } as SavedReport['settings'] }));
  assert.ok(loadReports().every(r => r.settings === undefined));
  assert.equal(loadReports().length, 2, 'unknown settings must not discard readable reports');
});

test('the saved farm name takes precedence over a biome or an unrelated place', () => {
  const r = report('site', { name: 'Indian Ocean Coastal Belt', facts: { farmName: 'Ubhejane Creche' } });
  assert.equal(reportSiteName(r), 'Ubhejane Creche');
  assert.equal(reportSiteName(report('legacy')), 'Report legacy');
});

// Mount the actual report workspace: storage-only checks cannot catch a Save button
// using changed controls or reusing the old ID after regeneration.
test('editing the next report settings cannot relabel the saved report; regeneration creates another version', async () => {
  reset();
  const { createElement } = await import('react');
  const { act, create } = await import('react-test-renderer');
  const { readFileSync } = await import('node:fs');
  const ts = (await import('typescript')).default;
  const cssModule = `data:text/javascript,${encodeURIComponent('export default new Proxy({}, { get: (_, key) => key });')}`;
  const emptyComponent = `data:text/javascript,${encodeURIComponent('export default function Component(){ return null; }')}`;
  const componentHooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('.css')) return { url: cssModule, shortCircuit: true };
      if (specifier.endsWith('/ReportPreparation')) return { url: emptyComponent, shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: url,
      }).outputText };
      return nextLoad(url, context);
    },
  });
  Object.assign(browser, { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  const ReportView = (await import('../components/ReportView.tsx')).default;
  const initial = report('original', { facts: { farmName: 'Ubhejane Creche' }, settings: {
    tone: 'professional', length: 'comprehensive', language: 'en', bilingual: false,
    sections: ['Executive Summary'], generatedAt: '2026-09-07T08:00:00Z', provider: 'Anthropic', model: 'claude-sonnet-4-6',
  } });
  saveReport(initial);
  let view: ReturnType<typeof create>;
  const realFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response('# New site advice\n\nUpdated report.', { headers: { 'X-Report-Provider': 'Anthropic', 'X-Report-Model': 'claude-sonnet-4-6' } });
  };
  try {
    await act(async () => { view = create(createElement(ReportView, { locationData: DEMO_LOCATION, savedReport: initial, onClose() {} })); });
    const textOf = (node: any): string => typeof node === 'string' ? node : node?.children?.map(textOf).join('') ?? '';
    const button = (label: string) => view!.root.findAllByType('button').find(n => textOf(n) === label)!;
    await act(async () => { saveReport({ ...initial, id: 'another-version' }); });
    const rows = view!.root.findAllByType('button').filter(n => textOf(n).startsWith('Ubhejane Creche') && textOf(n).includes('2026'));
    assert.equal(new Set(rows.map(textOf)).size, 2, 'versions saved at exactly the same time need distinct visible references');
    await act(async () => { deleteReport('another-version'); });
    await act(async () => button('Simple').props.onClick());
    await act(async () => button('Save').props.onClick());
    assert.equal(loadReports()[0].settings?.tone, 'professional', 'Save must capture generated wording, not next-report controls');
    assert.equal(loadReports()[0].savedAt, initial.savedAt, 're-saving does not rewrite the original date');
    assert.match(textOf(view!.toJSON()), /Wording: Detailed/);
    await act(async () => button('Generate new report').props.onClick());
    assert.equal(requestBody?.tone, 'simple');
    assert.equal(loadReports().length, 1, 'generation leaves the original saved version alone');
    assert.match(textOf(view!.toJSON()), /New report · not saved yet/);
    await act(async () => {
      const saveButton = view!.root.findAllByType('button').find(n => ['Save', 'Saved'].includes(textOf(n)))!;
      saveButton.props.onClick();
    });
    assert.equal(loadReports().length, 2, 'saving regenerated text must create a separate report');
    assert.equal(loadReports().find(r => r.id === 'original')?.report, initial.report);
    assert.equal(loadReports()[0].settings?.tone, 'simple');
    assert.equal(loadReports()[0].settings?.model, 'claude-sonnet-4-6');
    await act(async () => button('Saved').props.onClick());
    assert.equal(loadReports().length, 2, 'repeated Save must not duplicate the new version');
  } finally {
    if (view!) await act(async () => view.unmount());
    globalThis.fetch = realFetch;
    componentHooks.deregister();
  }
});
