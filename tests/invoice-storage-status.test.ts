import assert from 'node:assert/strict';
import test, { after, afterEach, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { InvoiceStorageContext, InvoiceStorageLocks } from '../lib/invoice-storage.ts';

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = [];
  beforeSet: ((key: string) => void) | null = null; onSet: ((key: string) => void) | null = null;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.beforeSet?.(key); this.rows.set(key, value); this.writes.push(key); this.onSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); }
}
class Locks implements InvoiceStorageLocks {
  held = new Set<string>(); pauseNext = false; waiting: Array<() => void> = [];
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.pauseNext) { this.pauseNext = false; await new Promise<void>(resolve => { this.waiting.push(resolve); }); }
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
  resume() { this.waiting.shift()?.(); }
}
const prior = new Map(['window', 'localStorage', 'sessionStorage', 'navigator', 'document', '__invoiceStatusProbe', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const probe = { owner: 'owner-a' as string | null,
  auth: { user: { uid: 'owner-a' } as { uid: string } | null, loading: false },
  initialisations: [] as Array<InvoiceStorageContext | null>, recoveries: [] as InvoiceStorageContext[],
  keeps: 0, exports: 0, reads: 0, releases: 0, changed: 0, downloads: [] as string[], blobs: [] as Blob[], downloadFails: false };
Object.assign(globalThis, { __invoiceStatusProbe: probe, IS_REACT_ACT_ENVIRONMENT: true });
const componentUrl = new URL('../components/InvoiceStorageStatus.tsx', import.meta.url).href;
const storageUrl = new URL('../lib/invoice-storage.ts', import.meta.url).href;
const moduleUrl = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const authModule = moduleUrl('export const useAuth=()=>globalThis.__invoiceStatusProbe.auth;');
// Adapted lifecycle fixture: auth, browser locks and file delivery are controlled;
// the actual three-key invoice adapter, review proofs, receipts and provider execute.
// Instrumentation forwards every operation to the actual authority. It never
// invents a ready result, raw token, review proof, recovery or saved receipt.
const storageModule = moduleUrl(`
import * as real from ${JSON.stringify(storageUrl)}; export * from ${JSON.stringify(storageUrl)};
const p=globalThis.__invoiceStatusProbe;
export const initialiseInvoiceStorage=(context,...args)=>{p.initialisations.push(context);return real.initialiseInvoiceStorage(context,...args);};
export const recoverInvoiceStorage=(context,...args)=>{p.recoveries.push(context);return real.recoverInvoiceStorage(context,...args);};
export const readInvoiceStorageStatus=(...args)=>{p.reads++;return real.readInvoiceStorageStatus(...args);};
export const releaseAllDocumentInvoiceLeases=(...args)=>{p.releases++;return real.releaseAllDocumentInvoiceLeases(...args);};
export const exportInvoiceLegacyReview=(...args)=>{p.exports++;return real.exportInvoiceLegacyReview(...args);};
export const keepCurrentInvoiceAfterLegacyReview=(...args)=>{p.keeps++;return real.keepCurrentInvoiceAfterLegacyReview(...args);};
`);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === componentUrl) {
    if (specifier === '@/lib/auth') return authModule;
    if (specifier === '@/lib/invoice-storage') return storageModule;
  }
  if (context.parentURL?.endsWith('/lib/account-local-storage.ts') && specifier === './firebase/init') return moduleUrl(`
    const p=globalThis.__invoiceStatusProbe;export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.owner?{uid:p.owner}:null;}}});`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === componentUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const core = await import('../lib/invoice-storage.ts');
const account = await import('../lib/account-local-storage.ts');
const { default: Provider, InvoiceStorageNotice: Notice, useInvoiceStorageStatus } = await import('../components/InvoiceStorageStatus.tsx');
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
let local: MemoryStorage, session: MemoryStorage, events: EventTarget, locks: Locks;
const mounted = new Set<ReactTestRenderer>();
const otherModules: Array<typeof core> = [];
const invoiceRow = { id: 'private-invoice', no: 17, billTo: 'Buyer', items: [{ desc: 'Line A', qty: 2, unit: 'kg', price: 10 }], total: 20,
  dateISO: '2026-11-01T12:00:00.000Z', status: 'unpaid', notes: 'private-current-invoice' };
const currentInvoicesRaw = JSON.stringify([invoiceRow]);
const olderRaw = JSON.stringify([{ ...invoiceRow, notes: 'private-older-invoice' }]);
const protectedRaw = JSON.stringify({ version: 1, invoicesRaw: currentInvoicesRaw, pendingLinksRaw: '[]', sequenceRaw: '17' });
function expectedLegacy(c: InvoiceStorageContext): string | null {
  const [invoicesRaw, pendingLinksRaw, sequenceRaw] = c.legacyKeys.map(key => local.getItem(key));
  return invoicesRaw === null && pendingLinksRaw === null && sequenceRaw === null ? null : JSON.stringify({ invoicesRaw, pendingLinksRaw, sequenceRaw });
}
function importedLegacy(invoicesRaw: string, pendingLinksRaw = '[]', sequenceRaw: string | null = null): string {
  return JSON.stringify({ version: 1, invoicesRaw, pendingLinksRaw, sequenceRaw });
}
function context() { const value = core.makeBrowserInvoiceStorageContext(); assert.ok(value); return value; }
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(value => text(value as ReactTestInstance | string)).join(''); }
function mount(notices = 1, withProvider = true) {
  let renderer!: ReactTestRenderer;
  const observations: Array<ReturnType<typeof useInvoiceStorageStatus>> = [];
  function Observer() { observations.push(useInvoiceStorageStatus()); return null; }
  const tree = () => {
    const children = React.createElement('main', null, React.createElement(Observer),
      Array.from({ length: notices }, (_, index) => React.createElement(Notice, { key: index })));
    return withProvider ? React.createElement(Provider, { children }) : children;
  };
  act(() => { renderer = create(tree()); }); mounted.add(renderer);
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(value => text(value) === label); assert.ok(node, label); return node; };
  return { renderer, button, text: () => text(renderer.root), delivery: () => observations.at(-1),
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
  const c = context(), read = core.readInvoiceStorage(c); assert.ok(read.token);
  act(() => { assert.equal(core.writeInvoiceStorageRaw(protectedRaw, read.token, c).status, 'written'); });
  local.rows.set(c.legacyKey, older); ui.event('storage', c.legacyKey); return c;
}
const keepLabel = 'Keep current invoice; retain older copy for later review';

beforeEach(() => {
  core.releaseAllDocumentInvoiceLeases();
  probe.owner = 'owner-a'; probe.auth = { user: { uid: 'owner-a' }, loading: false };
  probe.initialisations = []; probe.recoveries = []; probe.keeps = 0; probe.exports = 0; probe.reads = 0;
  probe.releases = 0; probe.changed = 0; probe.downloads = []; probe.blobs = []; probe.downloadFails = false;
  local = new MemoryStorage(); session = new MemoryStorage(); locks = new Locks(); events = new EventTarget();
  const window = Object.assign(events, { localStorage: local, sessionStorage: session });
  events.addEventListener('imbewu-invoices-changed', () => { probe.changed++; });
  for (const [key, value] of Object.entries({ window, localStorage: local, sessionStorage: session,
    navigator: { locks }, document: { createElement(tag: string) { assert.equal(tag, 'a'); const anchor = { href: '', download: '',
      click() { if (probe.downloadFails) throw Error('Synthetic download failure'); probe.downloads.push(anchor.download); } }; return anchor; } } })) {
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  account.bindMountedAccountLocalStorageUid(probe.owner);
  URL.createObjectURL = blob => { probe.blobs.push(blob as Blob); return `blob:invoice-private-${probe.blobs.length}`; };
  URL.revokeObjectURL = () => {};
});
afterEach(async () => {
  for (const renderer of mounted) act(() => { renderer.unmount(); }); mounted.clear();
  core.releaseAllDocumentInvoiceLeases(); while (locks.waiting.length) locks.resume();
  for (const module of otherModules) module.releaseAllDocumentInvoiceLeases(); otherModules.length = 0;
  await new Promise<void>(resolve => setImmediate(resolve));
});
after(() => {
  hooks.deregister(); core.releaseAllDocumentInvoiceLeases(); account.bindMountedAccountLocalStorageUid(null);
  URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('invoice initialization is owned once globally and a ready notice does not claim an invoice was saved', async () => {
  probe.auth.loading = true; const ui = mount(2);
  await ui.flush(); assert.equal(probe.initialisations.length, 0); assert.match(ui.text(), /Checking invoice storage/);
  probe.auth.loading = false; ui.update(); await ui.flush();
  assert.equal(probe.initialisations.length, 1); assert.equal(ui.text(), '');
  assert.equal(core.readInvoiceStorage(context()).writable, true);
  ui.update(); await ui.flush(); assert.equal(probe.initialisations.length, 1);
});

test('the invoice read-only notice has its own accessible identity', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  const ui = mount(); await ui.flush();
  assert.equal(ui.renderer.root.findByType('section').props['aria-label'], 'Invoice storage');
  // Heading capitalization is presentation; the missing writer lock must still mean read-only.
  assert.match(ui.text(), /invoice is read-only/i); assert.doesNotMatch(ui.text(), /saved successfully/);
});

test('download without checked confirmation cannot acknowledge an actual opaque copy conflict', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.invoke(keepLabel); assert.equal(probe.keeps, 0);
  await ui.click('Download both copies'); await ui.flush();
  assert.equal(ui.button(keepLabel).props.disabled, true);
  const before = local.getItem(c.canonicalKey);
  await ui.invoke(keepLabel); await ui.flush();
  assert.equal(probe.keeps, 0, 'the handler must guard confirmation as well as its disabled presentation');
  assert.equal(local.getItem(c.canonicalKey), before); assert.equal(core.readInvoiceStorage(c).legacyDiverged, true);
});

test('a retained checked handler cannot acknowledge after the current checkbox is unchecked', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const retained = ui.button(keepLabel).props.onClick; ui.check(false);
  await act(async () => { retained(); await Promise.resolve(); }); await ui.flush();
  assert.equal(probe.keeps, 0); assert.equal(core.readInvoiceStorage(c).legacyDiverged, true);
});

test('the real older-copy event withdraws readiness without importing it, leaking private invoice content or looping status events', async () => {
  const ui = mount(); await ui.flush(); const initialReads = probe.reads;
  ui.event('storage', 'unrelated-store'); assert.equal(probe.reads, initialReads);
  const c = diverge(ui); await ui.flush(); const changed = probe.changed;
  assert.match(ui.text(), /older app session changed another invoice copy/i);
  assert.match(ui.text(), /Matching row counts do not mean invoice amounts, currencies, dates or payment evidence match/);
  assert.doesNotMatch(ui.text(), /private-current-invoice|private-older-invoice|imbewu_invoice|cutoverId|bookRaw/);
  ui.event('focus'); ui.event(core.INVOICE_STORAGE_EVENT); await ui.flush();
  assert.equal(probe.changed, changed); assert.equal(probe.initialisations.length, 1);
  assert.equal(probe.keeps, 0); assert.equal(core.readInvoiceStorage(c).legacyDiverged, true);
});

test('real writer-lock contention stays read-only during passive events and explicit retry reacquires the actual lease', async () => {
  const other = await import(new URL(`../lib/invoice-storage.ts?status-other-document=${Date.now()}`, import.meta.url).href) as typeof core;
  otherModules.push(other); const c = context();
  assert.equal((await other.initialiseInvoiceStorage(c, locks)).writable, true);
  const ui = mount(); await ui.flush(); assert.match(ui.text(), /Another tab or window/);
  assert.equal(core.captureInvoiceStorageLease(c), null); assert.equal(probe.initialisations.length, 1);
  other.releaseAllDocumentInvoiceLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  ui.event('focus'); await ui.flush(); assert.equal(probe.initialisations.length, 1);
  assert.match(ui.text(), /read-only/); await ui.click('Retry invoice check'); await ui.flush();
  assert.equal(probe.initialisations.length, 2); assert.equal(ui.text(), ''); assert.ok(core.captureInvoiceStorageLease(c));
});

test('actual downloaded exact copies still need confirmation and keeping the current invoice never merges older invoice data', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  const receipt = local.getItem(c.receiptKey);
  await ui.click('Download both copies'); await ui.flush();
  assert.deepEqual(probe.downloads, ['invoice-copies.json']); assert.equal(probe.blobs.length, 1);
  const downloaded = JSON.parse(await probe.blobs[0].text());
  assert.equal(downloaded.canonicalInvoiceBookRaw, protectedRaw); assert.equal(downloaded.olderInvoiceBookRaw, expectedLegacy(c));
  assert.equal(JSON.parse(downloaded.olderInvoiceBookRaw).invoicesRaw, olderRaw);
  assert.equal(ui.button(keepLabel).props.disabled, true); assert.equal(probe.keeps, 0);
  await ui.flush(); ui.event('focus'); await ui.flush(); assert.equal(probe.keeps, 0, 'elapsed turns and focus cannot confirm a choice');
  ui.check(true); assert.equal(ui.button(keepLabel).props.disabled, false);
  await ui.click(keepLabel); await ui.flush();
  assert.equal(probe.keeps, 1); assert.match(ui.text(), /protected invoice is kept/); assert.match(ui.text(), /no older changes were merged/);
  const saved = JSON.parse(local.getItem(c.canonicalKey)!);
  assert.equal(saved.bookRaw, protectedRaw); assert.equal(saved.legacyAcknowledgement.legacyBytes, expectedLegacy(c));
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
  local.rows.set(c.legacyKey, JSON.stringify([{ ...invoiceRow, notes: 'changed same-count invoice' }]));
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
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking invoice storage/);
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking invoice storage/);
  locks.resume(); await ui.flush(); assert.equal(ui.text(), '');
  assert.equal(local.writes.filter(key => key.includes('owner-b')).length, 0);
  assert.equal(core.readInvoiceStorage(context()).writable, true);
});

test('observed sample A-B-A withdraws queued real setup and never writes a persistent sample pair', async () => {
  locks.pauseNext = true; const ui = mount(); await ui.flush(); const original = probe.initialisations[0]; assert.ok(original);
  session.setItem('imbewu_sample_mode', '1'); ui.event('imbewu-sample-mode-changed'); await ui.flush();
  assert.equal(original.isCurrent(), false); assert.equal(ui.text(), ''); assert.deepEqual(local.writes, []);
  assert.equal(probe.initialisations.at(-1)?.sample, true);
  locks.pauseNext = true; session.removeItem('imbewu_sample_mode'); ui.event('imbewu-sample-mode-changed'); await ui.flush();
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking invoice storage/);
  locks.resume(); await ui.flush(); assert.equal(ui.text(), '');
  assert.equal(local.writes.length, 2, 'only the fresh real canonical/evidence pair is written');
});

test('BFCache pagehide revokes a pending actual setup and only the fresh pageshow can enable editing', async () => {
  locks.pauseNext = true; const ui = mount(); await ui.flush(); const original = probe.initialisations[0]; assert.ok(original);
  ui.event('pagehide'); assert.equal(original.isCurrent(), false);
  locks.pauseNext = true; ui.event('pageshow'); await ui.flush();
  locks.resume(); await ui.flush(); assert.match(ui.text(), /Checking invoice storage/); assert.deepEqual(local.writes, []);
  locks.resume(); await ui.flush(); assert.equal(ui.text(), '');
  assert.equal(probe.initialisations.length, 2); assert.equal(probe.initialisations[1]?.isCurrent(), true);
});

async function interruptedSetup() {
  const c = context(); local.rows.set(c.legacyKey, currentInvoicesRaw);
  local.beforeSet = key => { if (key === c.canonicalKey) throw Error('Synthetic quota'); };
  assert.equal((await core.initialiseInvoiceStorage(c, locks)).reason, 'cutover-recovery-required');
  local.beforeSet = null; return c;
}

test('interrupted setup recovery is explicit and resumes only the actual frozen import before reacquiring a lease', async () => {
  const c = await interruptedSetup(), receipt = local.getItem(c.receiptKey);
  const ui = mount(); await ui.flush(); assert.match(ui.text(), /original preserved snapshot/);
  assert.equal(probe.recoveries.length, 0); ui.event('focus'); await ui.flush(); assert.equal(probe.recoveries.length, 0);
  await ui.click('Recover interrupted setup'); await ui.flush();
  assert.equal(probe.recoveries.length, 1); assert.equal(probe.initialisations.length, 2);
  assert.equal(JSON.parse(local.getItem(c.canonicalKey)!).bookRaw, importedLegacy(currentInvoicesRaw));
  assert.equal(local.getItem(c.receiptKey), receipt); assert.equal(ui.text(), '');
});

test('changed old bytes block actual recovery instead of substituting a new import or empty invoice', async () => {
  const c = await interruptedSetup(), receipt = local.getItem(c.receiptKey);
  local.rows.set(c.legacyKey, olderRaw); const ui = mount(); await ui.flush();
  await ui.click('Recover interrupted setup'); await ui.flush();
  assert.equal(probe.recoveries.length, 1); assert.equal(local.getItem(c.canonicalKey), null);
  assert.equal(local.getItem(c.receiptKey), receipt); assert.equal(local.getItem(c.legacyKey), olderRaw);
  assert.match(ui.text(), /setup is incomplete|retained copies could not be verified/);
});

test('a performed but unconfirmed save stays read-only and passive checks never repeat a write or recovery', async () => {
  const ui = mount(); await ui.flush(); const c = context(), read = core.readInvoiceStorage(c); assert.ok(read.token);
  local.onSet = () => { throw Error('Interrupted after storage effect'); };
  act(() => { assert.equal(core.writeInvoiceStorageRaw(protectedRaw, read.token, c).status, 'unconfirmed'); });
  local.onSet = null; await ui.flush(); const writes = [...local.writes], initialisations = probe.initialisations.length;
  assert.match(ui.text(), /save may have occurred but could not be confirmed/); assert.doesNotMatch(ui.text(), /saved successfully/);
  ui.event('focus'); ui.event(core.INVOICE_STORAGE_EVENT); await ui.flush();
  assert.deepEqual(local.writes, writes); assert.equal(probe.initialisations.length, initialisations);
  assert.equal(probe.recoveries.length, 0); assert.equal(core.readInvoiceStorage(c).writable, false);
  await ui.click('Retry invoice check'); await ui.flush();
  assert.match(ui.text(), /save may have occurred but could not be confirmed/);
  assert.deepEqual(local.writes, writes, 'retry cannot turn an uncertain write into a fresh overwrite');
  assert.equal(core.readInvoiceStorage(c).writable, false);
});

test('an unconfirmed actual acknowledgement consumes its review and retained controls cannot repeat it', async () => {
  const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const retained = ui.button(keepLabel).props.onClick; local.onSet = () => { throw Error('Interrupted acknowledgement'); };
  await ui.click(keepLabel); await ui.flush(); local.onSet = null;
  assert.match(ui.text(), /A choice may have been saved/); assert.match(ui.text(), /Do not repeat it/);
  assert.equal(ui.button('Retry invoice check').props.disabled, true);
  await act(async () => { retained(); await Promise.resolve(); }); await ui.flush();
  assert.equal(probe.keeps, 1); assert.equal(core.readInvoiceStorage(c).reason, 'write-unconfirmed');
  const writes = [...local.writes];
  assert.equal((await core.initialiseInvoiceStorage(c, locks)).reason, 'write-unconfirmed');
  assert.deepEqual(local.writes, writes);
});

async function coldConflict() {
  const c = context(); local.rows.set(c.legacyKey, '[]'); await core.initialiseInvoiceStorage(c, locks);
  const read = core.readInvoiceStorage(c); assert.ok(read.token);
  assert.equal(core.writeInvoiceStorageRaw(protectedRaw, read.token, c).status, 'written');
  core.releaseAllDocumentInvoiceLeases(); await new Promise<void>(resolve => setImmediate(resolve));
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
  assert.equal(core.readInvoiceStorage(c).legacyDiverged, true);
  assert.doesNotMatch(ui.text(), /protected invoice is kept/);
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
    assert.equal(probe.keeps, 1); assert.doesNotMatch(ui.text(), /protected invoice is kept/);
  });
}



test('without the global provider the actual hook stays null and the notice checks instead of granting an invoice editor', async () => {
  const ui = mount(1, false); await ui.flush();
  assert.equal(ui.delivery(), null);
  assert.match(ui.text(), /Checking invoice storage/);
  assert.equal(ui.renderer.root.findByType('section').props['aria-busy'], true);
  assert.equal(ui.renderer.root.findAllByType('button').length, 0);
  assert.equal(probe.initialisations.length, 0); assert.deepEqual(local.writes, []);
});

test('the real three legacy physical copies are captured together and protected setup preserves every original byte', async () => {
  const c = context();
  assert.equal(c.legacyKeys.length, 3);
  const originals = [currentInvoicesRaw, '[]', '17'] as const;
  c.legacyKeys.forEach((key, index) => local.rows.set(key, originals[index]));
  const ui = mount(2); await ui.flush();
  assert.equal(probe.initialisations.length, 1);
  const read = core.readInvoiceStorage(c); assert.equal(read.writable, true); assert.ok(read.token); assert.ok(read.bookRaw);
  assert.deepEqual(core.parseInvoiceStoragePayload(read.bookRaw), { version: 1, invoicesRaw: currentInvoicesRaw, pendingLinksRaw: '[]', sequenceRaw: '17' });
  assert.deepEqual(c.legacyKeys.map(key => local.getItem(key)), originals);
  assert.deepEqual(new Set(local.writes), new Set([c.canonicalKey, c.receiptKey]));
  const receipt = JSON.parse(local.getItem(c.receiptKey)!);
  assert.equal(receipt.legacyBytes, expectedLegacy(c));
  assert.equal(ui.delivery()?.status?.writable, true);
  assert.doesNotMatch(ui.text(), /payment verified|invoice saved|uploaded/i);
});

for (const physical of [0, 1, 2] as const) {
  test(`legacy physical source ${physical + 1} changing withdraws readiness and exports all exact copies without auto-merging`, async () => {
    const c = context(), originals = ['[]', '[]', '17'];
    c.legacyKeys.forEach((key, index) => local.rows.set(key, originals[index]));
    const ui = mount(); await ui.flush();
    const read = core.readInvoiceStorage(c); assert.ok(read.token);
    act(() => { assert.equal(core.writeInvoiceStorageRaw(protectedRaw, read.token, c).status, 'written'); });
    const protectedBytes = local.getItem(c.canonicalKey), receiptBytes = local.getItem(c.receiptKey);
    const changed = [olderRaw, JSON.stringify([{ ...invoiceRow, id: 'pending-invoice' }]), '18'][physical];
    local.rows.set(c.legacyKeys[physical], changed); ui.event('storage', c.legacyKeys[physical]); await ui.flush();
    assert.equal(ui.delivery()?.status?.writable, false);
    assert.match(ui.text(), /older app session changed another invoice copy/i);
    assert.equal(local.getItem(c.canonicalKey), protectedBytes); assert.equal(local.getItem(c.receiptKey), receiptBytes);
    assert.deepEqual(c.legacyKeys.map(key => local.getItem(key)), originals.map((value, index) => index === physical ? changed : value));
    await ui.click('Download both copies'); await ui.flush();
    const exported = JSON.parse(await probe.blobs[0].text());
    assert.equal(exported.canonicalInvoiceBookRaw, protectedRaw);
    assert.equal(exported.olderInvoiceBookRaw, expectedLegacy(c));
    assert.equal(ui.button(keepLabel).props.disabled, true); assert.equal(probe.keeps, 0);
  });
}

for (const physical of ['canonicalKey', 'receiptKey'] as const) {
  test(`changed ${physical} bytes revoke a downloaded approval even when all row counts match`, async () => {
    const ui = mount(); await ui.flush(); const c = diverge(ui); await ui.flush();
    await ui.click('Download both copies'); await ui.flush(); ui.check(true);
    const retained = ui.button(keepLabel).props.onClick, priorEpoch = ui.delivery()?.reviewEpoch;
    local.rows.set(c[physical], local.getItem(c[physical])! + '\n'); ui.event('storage', c[physical]); await ui.flush();
    assert.notEqual(ui.delivery()?.reviewEpoch, priorEpoch);
    assert.equal(ui.renderer.root.findByType('input').props.checked, false);
    await ui.click('Download both copies'); await ui.flush();
    const before = [...local.rows];
    await act(async () => { retained(); await Promise.resolve(); }); await ui.flush();
    assert.equal(probe.keeps, 0); assert.deepEqual([...local.rows], before);
  });
}

test('signed-in provider does not migrate or merge a separate signed-out invoice book', async () => {
  probe.owner = null; probe.auth.user = null; account.bindMountedAccountLocalStorageUid(null);
  const guest = context();
  const originals = [olderRaw, '[]', '17'];
  guest.legacyKeys.forEach((key, index) => local.rows.set(key, originals[index]));
  probe.owner = 'owner-a'; probe.auth.user = { uid: 'owner-a' }; account.bindMountedAccountLocalStorageUid('owner-a');
  const own = context(), ui = mount(); await ui.flush();
  assert.notEqual(own.canonicalKey, guest.canonicalKey);
  const book = core.readInvoiceStorage(own); assert.equal(book.writable, true); assert.ok(book.bookRaw);
  assert.deepEqual(core.parseInvoiceStoragePayload(book.bookRaw), { version: 1, invoicesRaw: '[]', pendingLinksRaw: '[]', sequenceRaw: null });
  assert.deepEqual(guest.legacyKeys.map(key => local.getItem(key)), originals);
  assert.equal(local.getItem(guest.canonicalKey), null); assert.equal(local.getItem(guest.receiptKey), null);
  assert.ok(local.writes.every(key => key === own.canonicalKey || key === own.receiptKey));
});

test('a ready BFCache document must reacquire a fresh lease and emit fresh readiness even when saved bytes match', async () => {
  const ui = mount(); await ui.flush(); const c = context();
  const originalLease = core.captureInvoiceStorageLease(c); assert.ok(originalLease);
  const writes = [...local.writes];
  ui.event('pagehide'); assert.equal(core.captureInvoiceStorageLease(c), null);
  const afterHide = probe.changed;
  locks.pauseNext = true; ui.event('pageshow'); await ui.flush();
  assert.match(ui.text(), /Checking invoice storage/); assert.equal(ui.delivery()?.busy, true);
  assert.equal(core.captureInvoiceStorageLease(c), null);
  locks.resume(); await ui.flush();
  const resumedLease = core.captureInvoiceStorageLease(c); assert.ok(resumedLease); assert.notEqual(resumedLease, originalLease);
  assert.equal(ui.text(), ''); assert.ok(probe.changed > afterHide, 'resumption needs a fresh readiness event beyond pagehide withdrawal');
  assert.deepEqual(local.writes, writes, 'lease renewal is not another invoice save');
});

test('unmount withdraws a downloaded confirmed review while the real acknowledgement waits for its writer lock', async () => {
  const c = await coldConflict(), ui = mount(); await ui.flush();
  await ui.click('Download both copies'); await ui.flush(); ui.check(true);
  const before = [...local.rows]; locks.pauseNext = true;
  await ui.click(keepLabel); await ui.flush(); assert.equal(locks.waiting.length, 1);
  ui.dispose(); locks.resume(); await ui.flush();
  assert.deepEqual([...local.rows], before);
  assert.equal(core.captureInvoiceStorageLease(c), null);
  assert.equal(probe.keeps, 1, 'the queued real authority attempt is withdrawn, not silently retried');
});

test('unreadable older invoice bytes remain read-only instead of becoming a plausible empty protected book', async () => {
  const c = context(), unreadable = '[{"id":"retained",';
  local.rows.set(c.legacyKeys[0], unreadable);
  local.rows.set(c.legacyKeys[1], '[]'); local.rows.set(c.legacyKeys[2], '17');
  const ui = mount(); await ui.flush();
  assert.equal(ui.delivery()?.status?.writable, false);
  assert.equal(ui.delivery()?.status?.reason, 'legacy-unreadable');
  assert.match(ui.text(), /not been replaced with an empty book/);
  assert.equal(local.getItem(c.canonicalKey), null); assert.equal(local.getItem(c.receiptKey), null);
  assert.equal(local.getItem(c.legacyKeys[0]), unreadable); assert.deepEqual(local.writes, []);
});
