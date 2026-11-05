import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { JournalStorageContext, JournalStorageLocks } from '../lib/journal-storage.ts';

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = [];
  beforeSet: ((key: string) => void) | null = null; onSet: ((key: string) => void) | null = null;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.beforeSet?.(key); this.rows.set(key, value); this.writes.push(key); this.onSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); }
}
class Locks implements JournalStorageLocks {
  held = new Set<string>(); pauseNext = false; waiting: Array<() => void> = [];
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.pauseNext) { this.pauseNext = false; await new Promise<void>(resolve => { this.waiting.push(resolve); }); }
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
  resume() { this.waiting.shift()?.(); }
}
const prior = new Map(['window', 'localStorage', 'sessionStorage', 'navigator', 'document', '__journalStatusProbe', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const probe = { owner: 'owner-a' as string | null,
  auth: { user: { uid: 'owner-a' } as { uid: string } | null, loading: false, journalMigrationHold: null as string | null, retryJournalMigration: async () => {} },
  initialisations: [] as Array<JournalStorageContext | null>, recoveries: [] as JournalStorageContext[],
  keeps: 0, exports: 0, reads: 0, releases: 0, changed: 0, downloads: [] as string[], blobs: [] as Blob[], downloadFails: false };
Object.assign(globalThis, { __journalStatusProbe: probe, IS_REACT_ACT_ENVIRONMENT: true });
const componentUrl = new URL('../components/JournalStorageStatus.tsx', import.meta.url).href;
const storageUrl = new URL('../lib/journal-storage.ts', import.meta.url).href;
const moduleUrl = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const authModule = moduleUrl('export const useAuth=()=>globalThis.__journalStatusProbe.auth;');
// Instrumentation forwards every operation to the actual authority. It never
// invents a ready result, raw token, review proof, recovery or saved receipt.
const storageModule = moduleUrl(`
import * as real from ${JSON.stringify(storageUrl)}; export * from ${JSON.stringify(storageUrl)};
const p=globalThis.__journalStatusProbe;
export const initialiseJournalStorage=(context,...args)=>{p.initialisations.push(context);return real.initialiseJournalStorage(context,...args);};
export const recoverJournalStorage=(context,...args)=>{p.recoveries.push(context);return real.recoverJournalStorage(context,...args);};
export const readJournalStorageStatus=(...args)=>{p.reads++;return real.readJournalStorageStatus(...args);};
export const releaseAllDocumentJournalLeases=(...args)=>{p.releases++;return real.releaseAllDocumentJournalLeases(...args);};
export const exportJournalLegacyReview=(...args)=>{p.exports++;return real.exportJournalLegacyReview(...args);};
export const keepCurrentJournalAfterLegacyReview=(...args)=>{p.keeps++;return real.keepCurrentJournalAfterLegacyReview(...args);};
`);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === componentUrl) {
    if (specifier === '@/lib/auth') return authModule;
    if (specifier === '@/lib/journal-storage') return storageModule;
  }
  if (context.parentURL?.endsWith('/lib/account-local-storage.ts') && specifier === './firebase/init') return moduleUrl(`
    const p=globalThis.__journalStatusProbe;export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.owner?{uid:p.owner}:null;}}});`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === componentUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const core = await import('../lib/journal-storage.ts');
const account = await import('../lib/account-local-storage.ts');
const { journalStorageMessage } = await import('../lib/journal-storage-status-copy.ts');
const { default: Provider, JournalStorageNotice: Notice } = await import('../components/JournalStorageStatus.tsx');
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
let local: MemoryStorage, session: MemoryStorage, events: EventTarget, locks: Locks;
const mounted = new Set<ReactTestRenderer>();
const otherModules: Array<typeof core> = [];
const protectedRaw = '[{"id":"private-note","notes":"private-current-observation","fieldLink":{"plantingId":"persistent-row"}}]';
const olderRaw = '[{"id":"private-note","notes":"private-older-observation"}]';
function context() { const value = core.makeBrowserJournalStorageContext(); assert.ok(value); return value; }
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(value => text(value as ReactTestInstance | string)).join(''); }
function mount(notices = 1) {
  let renderer!: ReactTestRenderer;
  const tree = () => React.createElement(Provider, { children: React.createElement('main', null,
    Array.from({ length: notices }, (_, index) => React.createElement(Notice, { key: index }))) });
  act(() => { renderer = create(tree()); }); mounted.add(renderer);
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(value => text(value) === label); assert.ok(node, label); return node; };
  return { renderer, button, text: () => text(renderer.root),
    async flush() { await act(async () => { await Promise.resolve(); await new Promise<void>(resolve => setImmediate(resolve)); }); },
    update() { act(() => { renderer.update(tree()); }); },
    event(name: string, key?: string | null) { act(() => { const event = new Event(name); if (key !== undefined) Object.defineProperty(event, 'key', { value: key }); events.dispatchEvent(event); }); },
    async invoke(label: string) { const callback = button(label).props.onClick; await act(async () => { callback(); await Promise.resolve(); }); },
    async click(label: string) { assert.equal(button(label).props.disabled, false, label); const callback = button(label).props.onClick; await act(async () => { callback(); await Promise.resolve(); }); },
    check(checked: boolean) { act(() => { renderer.root.findByType('input').props.onChange({ target: { checked } }); }); },
    dispose() { if (mounted.delete(renderer)) act(() => { renderer.unmount(); }); },
  };
}
function diverge(ui: ReturnType<typeof mount>, older = olderRaw) {
  const c = context(), read = core.readJournalStorage(c); assert.ok(read.token);
  act(() => { assert.equal(core.writeJournalStorageRaw(protectedRaw, read.token, c).status, 'written'); });
  local.rows.set(c.legacyKey, older); ui.event('storage', c.legacyKey); return c;
}
const keepLabel = 'Keep current journal; retain older copy for later review';

beforeEach(() => {
  core.releaseAllDocumentJournalLeases();
  probe.owner = 'owner-a'; probe.auth = { user: { uid: 'owner-a' }, loading: false, journalMigrationHold: null, retryJournalMigration: async () => {} };
  probe.initialisations = []; probe.recoveries = []; probe.keeps = 0; probe.exports = 0; probe.reads = 0;
  probe.releases = 0; probe.changed = 0; probe.downloads = []; probe.blobs = []; probe.downloadFails = false;
  local = new MemoryStorage(); session = new MemoryStorage(); locks = new Locks(); events = new EventTarget();
  const window = Object.assign(events, { localStorage: local, sessionStorage: session });
  events.addEventListener('imbewu-field-journal-changed', () => { probe.changed++; });
  for (const [key, value] of Object.entries({ window, localStorage: local, sessionStorage: session,
    navigator: { locks }, document: { createElement(tag: string) { assert.equal(tag, 'a'); const anchor = { href: '', download: '',
      click() { if (probe.downloadFails) throw Error('Synthetic download failure'); probe.downloads.push(anchor.download); } }; return anchor; } } })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  account.bindMountedAccountLocalStorageUid(probe.owner);
  URL.createObjectURL = blob => { probe.blobs.push(blob as Blob); return `blob:journal-private-${probe.blobs.length}`; };
  URL.revokeObjectURL = () => {};
});
afterEach(async () => {
  for (const renderer of mounted) act(() => { renderer.unmount(); }); mounted.clear();
  core.releaseAllDocumentJournalLeases(); while (locks.waiting.length) locks.resume();
  for (const module of otherModules) module.releaseAllDocumentJournalLeases(); otherModules.length = 0;
  await new Promise<void>(resolve => setImmediate(resolve));
});
after(() => {
  hooks.deregister(); core.releaseAllDocumentJournalLeases(); account.bindMountedAccountLocalStorageUid(null);
  URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('journal initialization is owned once globally and a ready notice does not claim a note was saved', async () => {
  probe.auth.loading = true; const ui = mount(2);
  await ui.flush(); assert.equal(probe.initialisations.length, 0); assert.match(ui.text(), /Checking journal storage/);
  probe.auth.loading = false; ui.update(); await ui.flush();
  assert.equal(probe.initialisations.length, 1); assert.equal(ui.text(), '');
  assert.equal(core.readJournalStorage(context()).writable, true);
  ui.update(); await ui.flush(); assert.equal(probe.initialisations.length, 1);
});

test('the journal read-only notice has its own accessible identity', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const ui = mount(); await ui.flush();
  assert.equal(ui.renderer.root.findByType('section').props['aria-label'], 'Journal storage');
  // Heading capitalization is presentation; the missing writer lock must still mean read-only.
  assert.match(ui.text(), /journal is read-only/i); assert.doesNotMatch(ui.text(), /saved successfully/);
});

test('download without checked confirmation cannot acknowledge an actual opaque copy conflict', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.invoke(keepLabel); assert.equal(probe.keeps, 0);
  await ui.click('Download both copies'); await ui.flush();
  assert.equal(ui.button(keepLabel).props.disabled, true);
  const before = local.getItem(c.canonicalKey);
  await ui.invoke(keepLabel); await ui.flush();
  assert.equal(probe.keeps, 0, 'the handler must guard confirmation as well as its disabled presentation');
  assert.equal(local.getItem(c.canonicalKey), before); assert.equal(core.readJournalStorage(c).legacyDiverged, true);
});

test('a retained checked handler cannot acknowledge after the current checkbox is unchecked', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const retained = ui.button(keepLabel).props.onClick; ui.check(false);
  await act(async () => { retained(); await Promise.resolve(); }); await ui.flush();
  assert.equal(probe.keeps, 0); assert.equal(core.readJournalStorage(c).legacyDiverged, true);
});

test('the real older-copy event withdraws readiness without importing it, leaking notes or looping status events', async () => {
  const ui = mount(); await ui.flush(); const initialReads = probe.reads;
  ui.event('storage', 'unrelated-store'); assert.equal(probe.reads, initialReads);
  const c = diverge(ui); await ui.flush(); const changed = probe.changed;
  assert.match(ui.text(), /older app session changed a separate copy/i);
  assert.match(ui.text(), /Matching row counts do not mean the observed dates, wording or link references match/);
  assert.doesNotMatch(ui.text(), /private-current-observation|private-older-observation|imbewu_field_journal|cutoverId|journalRaw/);
  ui.event('focus'); ui.event(core.JOURNAL_STORAGE_EVENT); await ui.flush();
  assert.equal(probe.changed, changed); assert.equal(probe.initialisations.length, 1);
  assert.equal(probe.keeps, 0); assert.equal(core.readJournalStorage(c).legacyDiverged, true);
});

test('real writer-lock contention stays read-only during passive events and explicit retry reacquires the actual lease', async () => {
  const other = await import(new URL(`../lib/journal-storage.ts?status-other-document=${Date.now()}`, import.meta.url).href) as typeof core;
  otherModules.push(other); const c = context();
  assert.equal((await other.initialiseJournalStorage(c, locks)).writable, true);
  const ui = mount(); await ui.flush(); assert.match(ui.text(), /Another browser tab or window/);
  assert.equal(core.captureJournalStorageLease(c), null); assert.equal(probe.initialisations.length, 1);
  other.releaseAllDocumentJournalLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  ui.event('focus'); await ui.flush(); assert.equal(probe.initialisations.length, 1);
  assert.match(ui.text(), /read-only/); await ui.click('Retry journal check'); await ui.flush();
  assert.equal(probe.initialisations.length, 2); assert.equal(ui.text(), ''); assert.ok(core.captureJournalStorageLease(c));
});

test('actual downloaded exact copies still need confirmation and keeping the current journal never merges older notes', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  const receipt = local.getItem(c.receiptKey);
  await ui.click('Download both copies'); await ui.flush();
  assert.deepEqual(probe.downloads, ['journal-copies.json']); assert.equal(probe.blobs.length, 1);
  const downloaded = JSON.parse(await probe.blobs[0].text());
  assert.equal(downloaded.canonicalJournalRaw, protectedRaw); assert.equal(downloaded.olderJournalRaw, olderRaw);
  assert.equal(ui.button(keepLabel).props.disabled, true); assert.equal(probe.keeps, 0);
  await ui.flush(); ui.event('focus'); await ui.flush(); assert.equal(probe.keeps, 0, 'elapsed turns and focus cannot confirm a choice');
  ui.check(true); assert.equal(ui.button(keepLabel).props.disabled, false);
  await ui.click(keepLabel); await ui.flush();
  assert.equal(probe.keeps, 1); assert.match(ui.text(), /protected journal is kept/); assert.match(ui.text(), /no older changes were merged/);
  const saved = JSON.parse(local.getItem(c.canonicalKey)!);
  assert.equal(saved.journalRaw, protectedRaw); assert.equal(saved.legacyAcknowledgement.legacyBytes, olderRaw);
  assert.equal(local.getItem(c.legacyKey), olderRaw); assert.equal(local.getItem(c.receiptKey), receipt);
  ui.event('focus'); await ui.flush(); assert.equal(ui.text(), '');
});

test('a failed download leaves actual copy conflict untouched and cannot unlock keep-current', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  probe.downloadFails = true; const before = local.getItem(c.canonicalKey);
  await ui.click('Download both copies'); await ui.flush();
  assert.match(ui.text(), /copies could not be downloaded/); assert.match(ui.text(), /No choice has been saved/);
  assert.equal(ui.button(keepLabel).props.disabled, true); await ui.invoke(keepLabel); await ui.flush();
  assert.equal(probe.keeps, 0); assert.equal(local.getItem(c.canonicalKey), before);
});

test('a handler from an older confirmed review cannot acknowledge a newly downloaded but unchecked same-count copy', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const retained = ui.button(keepLabel).props.onClick;
  local.rows.set(c.legacyKey, '[{"id":"private-note","notes":"changed same-count history"}]');
  ui.event('storage', c.legacyKey); await ui.flush();
  assert.equal(ui.renderer.root.findByType('input').props.checked, false);
  await ui.click('Download both copies'); await ui.flush(); assert.equal(ui.button(keepLabel).props.disabled, true);
  const before = local.getItem(c.canonicalKey);
  await act(async () => { retained(); await Promise.resolve(); }); await ui.flush();
  assert.equal(probe.keeps, 0); assert.equal(local.getItem(c.canonicalKey), before);
});

test('readiness from a paused earlier account cannot survive an observed account A-B-A lifecycle', async () => {
  locks.pauseNext = true; const ui = mount(); await ui.flush();
  assert.equal(locks.waiting.length, 1); const first = probe.initialisations[0]; assert.ok(first);
  for (const owner of ['owner-b', 'owner-a']) {
    locks.pauseNext = true; probe.owner = owner; probe.auth.user = { uid: owner }; account.bindMountedAccountLocalStorageUid(owner);
    ui.update(); await ui.flush();
  }
  assert.equal(first.isCurrent(), false); assert.equal(probe.initialisations.length, 3);
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking journal storage/);
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking journal storage/);
  locks.resume(); await ui.flush(); assert.equal(ui.text(), '');
  assert.equal(local.writes.filter(key => key.includes('owner-b')).length, 0);
  assert.equal(core.readJournalStorage(context()).writable, true);
});

test('observed sample A-B-A withdraws queued real setup and never writes a persistent sample pair', async () => {
  locks.pauseNext = true; const ui = mount(); await ui.flush(); const original = probe.initialisations[0]; assert.ok(original);
  session.setItem('imbewu_sample_mode', '1'); ui.event('imbewu-sample-mode-changed'); await ui.flush();
  assert.equal(original.isCurrent(), false); assert.equal(ui.text(), ''); assert.deepEqual(local.writes, []);
  assert.equal(probe.initialisations.at(-1)?.sample, true);
  locks.pauseNext = true; session.removeItem('imbewu_sample_mode'); ui.event('imbewu-sample-mode-changed'); await ui.flush();
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking journal storage/);
  locks.resume(); await ui.flush(); assert.equal(ui.text(), '');
  assert.equal(local.writes.length, 2, 'only the fresh real canonical/evidence pair is written');
});

test('BFCache pagehide revokes a pending actual setup and only the fresh pageshow can enable editing', async () => {
  locks.pauseNext = true; const ui = mount(); await ui.flush(); const original = probe.initialisations[0]; assert.ok(original);
  ui.event('pagehide'); assert.equal(original.isCurrent(), false);
  locks.pauseNext = true; ui.event('pageshow'); await ui.flush();
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking journal storage/); assert.deepEqual(local.writes, []);
  locks.resume(); await ui.flush(); assert.equal(ui.text(), '');
  assert.equal(probe.initialisations.length, 2); assert.equal(probe.initialisations[1]?.isCurrent(), true);
});

async function interruptedSetup() {
  const c = context(); local.rows.set(c.legacyKey, protectedRaw);
  local.beforeSet = key => { if (key === c.canonicalKey) throw Error('Synthetic quota'); };
  assert.equal((await core.initialiseJournalStorage(c, locks)).reason, 'cutover-recovery-required');
  local.beforeSet = null; return c;
}

test('interrupted setup recovery is explicit and resumes only the actual frozen import before reacquiring a lease', async () => {
  const c = await interruptedSetup(), receipt = local.getItem(c.receiptKey);
  const ui = mount(); await ui.flush(); assert.match(ui.text(), /original preserved snapshot/);
  assert.equal(probe.recoveries.length, 0); ui.event('focus'); await ui.flush(); assert.equal(probe.recoveries.length, 0);
  await ui.click('Recover interrupted setup'); await ui.flush();
  assert.equal(probe.recoveries.length, 1); assert.equal(probe.initialisations.length, 2);
  assert.equal(JSON.parse(local.getItem(c.canonicalKey)!).journalRaw, protectedRaw);
  assert.equal(local.getItem(c.receiptKey), receipt); assert.equal(ui.text(), '');
});

test('changed old bytes block actual recovery instead of substituting a new import or empty journal', async () => {
  const c = await interruptedSetup(), receipt = local.getItem(c.receiptKey);
  local.rows.set(c.legacyKey, olderRaw); const ui = mount(); await ui.flush();
  await ui.click('Recover interrupted setup'); await ui.flush();
  assert.equal(probe.recoveries.length, 1); assert.equal(local.getItem(c.canonicalKey), null);
  assert.equal(local.getItem(c.receiptKey), receipt); assert.equal(local.getItem(c.legacyKey), olderRaw);
  assert.match(ui.text(), /setup is incomplete|retained copies could not be verified/);
});

test('a performed but unconfirmed save stays read-only and passive checks never repeat a write or recovery', async () => {
  const ui = mount(); await ui.flush(); const c = context(), read = core.readJournalStorage(c); assert.ok(read.token);
  local.onSet = () => { throw Error('Interrupted after storage effect'); };
  act(() => { assert.equal(core.writeJournalStorageRaw(protectedRaw, read.token, c).status, 'unconfirmed'); });
  local.onSet = null; await ui.flush(); const writes = [...local.writes], initialisations = probe.initialisations.length;
  assert.match(ui.text(), /save may have occurred but could not be confirmed/); assert.doesNotMatch(ui.text(), /saved successfully/);
  ui.event('focus'); ui.event(core.JOURNAL_STORAGE_EVENT); await ui.flush();
  assert.deepEqual(local.writes, writes); assert.equal(probe.initialisations.length, initialisations);
  assert.equal(probe.recoveries.length, 0); assert.equal(core.readJournalStorage(c).writable, false);
});

test('an unconfirmed actual acknowledgement consumes its review and retained controls cannot repeat it', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const retained = ui.button(keepLabel).props.onClick; local.onSet = () => { throw Error('Interrupted acknowledgement'); };
  await ui.click(keepLabel); await ui.flush(); local.onSet = null;
  assert.match(ui.text(), /A choice may have been saved/); assert.match(ui.text(), /Do not repeat it/);
  assert.equal(ui.button('Retry journal check').props.disabled, true);
  await act(async () => { retained(); await Promise.resolve(); }); await ui.flush();
  assert.equal(probe.keeps, 1); assert.equal(core.readJournalStorage(c).reason, 'write-unconfirmed');
  const writes = [...local.writes];
  assert.equal((await core.initialiseJournalStorage(c, locks)).reason, 'write-unconfirmed');
  assert.deepEqual(local.writes, writes);
});

async function coldConflict() {
  const c = context(); local.rows.set(c.legacyKey, '[]'); await core.initialiseJournalStorage(c, locks);
  const read = core.readJournalStorage(c); assert.ok(read.token);
  assert.equal(core.writeJournalStorageRaw(protectedRaw, read.token, c).status, 'written');
  core.releaseAllDocumentJournalLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  local.rows.set(c.legacyKey, olderRaw); return c;
}

test('withdrawing confirmation while the real acknowledgement waits for a lock prevents the storage effect', async () => {
  const c = await coldConflict(), ui = mount(); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const before = local.getItem(c.canonicalKey); locks.pauseNext = true;
  await ui.click(keepLabel); await ui.flush(); assert.equal(locks.waiting.length, 1);
  // A queued change event can arrive after the UI becomes busy. The actual
  // callback must revoke its live approval, even though controls are disabled.
  ui.check(false); locks.resume(); await ui.flush();
  assert.equal(probe.keeps, 1); assert.equal(local.getItem(c.canonicalKey), before);
  assert.equal(core.readJournalStorage(c).legacyDiverged, true);
  assert.doesNotMatch(ui.text(), /protected journal is kept/);
});

for (const change of ['account-ABA', 'sample-ABA', 'bfcache'] as const) {
  test(`${change} during actual acknowledgement lock wait cannot apply an old downloaded review`, async () => {
    const c = await coldConflict(), ui = mount(); await ui.flush();
    await ui.click('Download both copies'); await ui.flush(); ui.check(true);
    const before = local.getItem(c.canonicalKey); locks.pauseNext = true;
    await ui.click(keepLabel); await ui.flush(); assert.equal(locks.waiting.length, 1);
    if (change === 'account-ABA') for (const owner of ['owner-b', 'owner-a']) {
      probe.owner = owner; probe.auth.user = { uid: owner }; account.bindMountedAccountLocalStorageUid(owner); ui.update(); await ui.flush();
    }
    if (change === 'sample-ABA') {
      session.setItem('imbewu_sample_mode', '1'); ui.event('imbewu-sample-mode-changed'); await ui.flush();
      session.removeItem('imbewu_sample_mode'); ui.event('imbewu-sample-mode-changed'); await ui.flush();
    }
    if (change === 'bfcache') { ui.event('pagehide'); ui.event('pageshow'); await ui.flush(); }
    locks.resume(); await ui.flush();
    assert.equal(local.getItem(c.canonicalKey), before); assert.equal(local.getItem(c.legacyKey), olderRaw);
    assert.equal(probe.keeps, 1); assert.doesNotMatch(ui.text(), /protected journal is kept/);
  });
}

test('migration hold gates initializer until an explicit auth retry publishes a fresh account effect', async () => {
  probe.auth.journalMigrationHold = 'transfer-unavailable'; let retries = 0;
  probe.auth.retryJournalMigration = async () => { retries++; probe.auth.journalMigrationHold = null; };
  const ui = mount(); await ui.flush(); assert.equal(probe.initialisations.length, 0);
  assert.match(ui.text(), /signed-out journal transfer requires review/);
  ui.event('focus'); await ui.flush(); assert.equal(probe.initialisations.length, 0);
  await ui.click('Retry journal check'); ui.update(); await ui.flush();
  assert.equal(retries, 1); assert.equal(probe.initialisations.length, 1); assert.equal(ui.text(), '');
});

test('global setup and inline journal notices stay within the auth/language scope and calibrated lessons remain untouched', () => {
  const source = readFileSync(new URL('../components/JournalStorageStatus.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('status.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = ast.statements.filter(ts.isImportDeclaration).map(node => (node.moduleSpecifier as ts.StringLiteral).text);
  assert.deepEqual(imports, ['react', '@/lib/auth', '@/lib/journal-storage-status-copy', '@/lib/journal-storage']);
  const layout = ts.createSourceFile('layout.tsx', readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let scoped = false;
  function walk(node: ts.Node, parents: string[]) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(layout);
      if (tag === 'JournalStorageProvider') scoped = parents.includes('AuthProvider') && parents.includes('LanguageProvider');
      ts.forEachChild(node, child => walk(child, [...parents, tag]));
    } else ts.forEachChild(node, child => walk(child, parents));
  }
  walk(layout, []); assert.equal(scoped, true);
  for (const file of ['../components/journal/FieldJournal.tsx', '../app/cropplan/page.tsx']) {
    assert.match(readFileSync(new URL(file, import.meta.url), 'utf8'), /<JournalStorageNotice\s*\/>/);
  }
  assert.doesNotMatch(readFileSync(new URL('../app/student/finance/page.tsx', import.meta.url), 'utf8'), /JournalStorageNotice/);
});

test('status copy distinguishes editing readiness, uncertain writes and DEMO without granting membership or a saved-note claim', () => {
  const base = { status: 'held' as const, writable: false, needsInitialisation: false, legacyDiverged: false };
  assert.match(journalStorageMessage({ ...base, reason: 'legacy-unreadable' }), /not been replaced with an empty journal/);
  assert.match(journalStorageMessage({ ...base, reason: 'write-unconfirmed' }), /may have occurred.*could not be confirmed/);
  const ready = journalStorageMessage({ ...base, status: 'ready', writable: true });
  assert.match(ready, /ready for editing/); assert.doesNotMatch(ready, /saved|uploaded|verified observation/i);
  const sample = journalStorageMessage({ ...base, status: 'sample' });
  assert.match(sample, /DEMO/); assert.match(sample, /personal journal is unchanged/);
  assert.doesNotMatch(journalStorageMessage({ ...base, reason: 'unknown' }), /permission granted|membership|clear browser data/i);
});
