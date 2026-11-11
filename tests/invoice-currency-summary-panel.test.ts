import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { SavedInvoice, InvoiceReadView } from '../lib/invoices.ts';
import type { InvoiceStorageLocks } from '../lib/invoice-storage.ts';

// Firebase identity/observation and browser primitives are controlled. The
// actual read hook, component, model receipts and summary kernel all execute.
const library = new URL('../lib/', import.meta.url).href;
const panelUrl = new URL('../components/invoice/InvoiceCurrencySummaryPanel.tsx', import.meta.url).href;
const probe = { actor: 'owner-a' as string | null, loading: false, auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __invoiceSummaryPanel: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__invoiceSummaryPanel;export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__invoiceSummaryPanel;export const onAuthStateChanged=(_auth,next,error)=>{p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};};`);
  if (specifier === '@/lib/auth') return data(`export const useAuth=()=>{const p=globalThis.__invoiceSummaryPanel;return {user:p.actor?{uid:p.actor}:null,loading:p.loading};};`);
  if (specifier === '@/components/InvoiceStorageStatus') return data(`export const useInvoiceStorageStatus=()=>{throw Error('A read-only summary must not consult the editor provider');};`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === panelUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const model = await import('../lib/invoices.ts');
const storage = await import('../lib/invoice-storage.ts');
const account = await import('../lib/account-local-storage.ts');
const samples = await import('../lib/sample-mode.ts');
const { INVOICE_PILOT_CURRENCIES } = await import('../lib/invoice-currency.ts');
const { formattingContext, formatRecordedMoney } = await import('../lib/international/locales/formatting.ts');
const { useInvoiceReadSource } = await import('../components/invoice/useInvoiceBookSource.ts');
const { default: Panel } = await import('../components/invoice/InvoiceCurrencySummaryPanel.tsx');

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = []; reads: string[] = [];
  getItem(key: string) { this.reads.push(key); return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string) { this.rows.set(key, raw); this.writes.push(key); }
  removeItem(key: string) { this.rows.delete(key); }
}
class Locks implements InvoiceStorageLocks {
  held = new Set<string>(); requests = 0;
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    this.requests++; if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const before = new Map(['window', 'navigator', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let local: MemoryStorage, session: MemoryStorage, events: EventTarget, locks: Locks, renderer: ReactTestRenderer | null = null;
const retained = new Set<ReturnType<typeof model.readInvoiceBook>>(), views = new Set<InvoiceReadView>();
const stores = [storage]; let otherIndex = 0;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function actor(uid: string | null, observed = true) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  if (observed) for (const notify of probe.auth) notify(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
const key = (base = storage.INVOICE_STORAGE_KEY) => account.activeAccountLocalStorageKey(base);
function invoice(id: string, currency: string | null, total: number, paid = false): SavedInvoice {
  return { id, no: Number(id.replace(/\D/g, '')) || 1, ...(currency === null ? {} : { currencyCode: currency }), billTo: 'Recorded buyer',
    items: [{ desc: 'Recorded produce', qty: 1, unit: 'kg', price: total }], total,
    dateISO: '2024-01-01T09:00:00.000Z', status: paid ? 'paid' : 'unpaid', ...(paid ? { paidAt: '2026-11-01T09:00:00.000Z' } : {}) };
}
const mixed = () => [invoice('i1', null, 6), invoice('i2', 'ZAR', 10, true), invoice('i3', 'EUR', 20, true), invoice('i4', 'EUR', 30), invoice('i5', 'USD', 40)];
async function ready(rows: unknown[] = mixed(), pending: unknown[] = []) {
  local.rows.set(key(storage.INVOICE_LEGACY_KEY), JSON.stringify(rows));
  local.rows.set(key(storage.INVOICE_PENDING_LEGACY_KEY), JSON.stringify(pending));
  assert.equal((await storage.initialiseInvoiceStorage()).writable, true);
}
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
const body = () => text(renderer!.root);
const selection = () => renderer!.root.findByProps({ 'aria-label': 'Summary currency' });
const refresh = () => renderer!.root.findAllByType('button').find(node => text(node) === 'Refresh saved invoices')!;
const totals = () => renderer!.root.findAllByType('dl');
function money(total: number, currency: string) { const result = formatRecordedMoney({ amount: total, currency }, formattingContext('en')); assert.ok(result); return result.text; }
async function mount() { await act(async () => { renderer = create(React.createElement(Panel)); await Promise.resolve(); }); }
function choose(currency: string) { act(() => selection().props.onChange({ target: { value: currency } })); }
async function reload() { await act(async () => { refresh().props.onClick(); await Promise.resolve(); }); }
function assertGroup(label: string, count: number, total: number, currency: string) {
  const term = renderer!.root.findAllByType('dt').find(node => text(node) === label); assert.ok(term?.parent);
  const content = text(term.parent); assert.ok(content.includes(money(total, currency)), content); assert.ok(content.includes(`${count} invoice(s)`), content);
}
beforeEach(async () => {
  if (renderer) { act(() => renderer!.unmount()); renderer = null; }
  for (const book of retained) model.releaseInvoiceBook(book); retained.clear();
  for (const view of views) model.releaseInvoiceReadView(view); views.clear();
  for (const store of stores) store.releaseAllDocumentInvoiceLeases(); await tick();
  probe.actor = 'owner-a'; probe.loading = false; account.bindMountedAccountLocalStorageUid('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); locks = new Locks();
  events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  for (const [key, value] of Object.entries({ window: events, localStorage: local, navigator: { locks } })) Object.defineProperty(globalThis, key, { configurable: true, value });
});
after(() => {
  if (renderer) act(() => renderer!.unmount()); sample(false);
  for (const book of retained) model.releaseInvoiceBook(book); for (const view of views) model.releaseInvoiceReadView(view);
  for (const store of stores) store.releaseAllDocumentInvoiceLeases();
  account.bindMountedAccountLocalStorageUid(null); hooks.deregister(); Reflect.deleteProperty(globalThis, '__invoiceSummaryPanel');
  for (const [key, value] of before) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
});

test('currency is explicitly unset and the real panel segregates all-loaded issued, recorded-paid and unpaid invoice amounts', async () => {
  await ready(); const bytes = new Map(local.rows), writes = local.writes.length, requests = locks.requests;
  await mount(); assert.equal(selection().props.value, ''); assert.equal(totals().length, 0);
  assert.deepEqual(selection().findAllByType('option').map(option => option.props.value), ['', ...INVOICE_PILOT_CURRENCIES]);
  assert.match(selection().props.className, /min-h-11/); assert.match(refresh().props.className, /min-h-11/);
  choose('EUR'); assertGroup('Issued invoices', 2, 50, 'EUR'); assertGroup('Recorded paid invoices', 1, 20, 'EUR'); assertGroup('Unpaid invoices', 1, 30, 'EUR');
  choose('ZAR'); assertGroup('Issued invoices', 2, 16, 'ZAR'); assertGroup('Recorded paid invoices', 1, 10, 'ZAR'); assertGroup('Unpaid invoices', 1, 6, 'ZAR');
  choose('USD'); assertGroup('Issued invoices', 1, 40, 'USD');
  assert.match(body(), /across all loaded dates/); assert.match(body(), /pending link drafts, external sales records and costs/);
  assert.match(body(), /not proof of bank receipt, cash income or profit/);
  assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes); assert.equal(locks.requests, requests);
});

test('a complete readonly book remains readable when another actual storage factory denies this document the editing lock', async () => {
  await ready(); storage.releaseAllDocumentInvoiceLeases(); await tick();
  const other: typeof storage = await import(new URL(`../lib/invoice-storage.ts?summary-document=${++otherIndex}`, import.meta.url).href); stores.push(other);
  assert.equal((await other.initialiseInvoiceStorage()).writable, true);
  assert.equal((await storage.initialiseInvoiceStorage()).reason, 'another-writer');
  assert.equal(storage.readInvoiceStorage().writable, false);
  const requests = locks.requests, bytes = new Map(local.rows); await mount(); choose('EUR'); assertGroup('Issued invoices', 2, 50, 'EUR');
  await reload(); assert.equal(selection().props.value, ''); choose('ZAR'); assertGroup('Issued invoices', 2, 16, 'ZAR');
  assert.equal(locks.requests, requests); assert.deepEqual(local.rows, bytes);
  const read = model.readInvoiceView(); views.add(read); assert.equal(read.status, 'ready');
  assert.equal(model.saveInvoice(invoice('i9', 'EUR', 9), read as never).status, 'held', 'a read receipt must never become writer admission');
});

test('legitimate zero and empty selected currency totals stay distinct from an unavailable book', async () => {
  await ready([invoice('i1', 'EUR', 0, true)]); await mount(); choose('EUR');
  assertGroup('Issued invoices', 1, 0, 'EUR'); assertGroup('Recorded paid invoices', 1, 0, 'EUR'); assertGroup('Unpaid invoices', 0, 0, 'EUR');
  choose('GBP'); assertGroup('Issued invoices', 0, 0, 'GBP');
});

for (const broken of ['hidden-row', 'unavailable', 'unknown-currency'] as const) test(`${broken} source yields a visible hold without incomplete zero totals`, async () => {
  if (broken === 'hidden-row') await ready([null, invoice('i1', 'EUR', 7)]);
  else if (broken === 'unknown-currency') await ready([invoice('i1', 'CAD', 7)]);
  else { await ready(); local.rows.set(key(), '{unreadable'); }
  await mount(); if (!selection().props.disabled) choose('EUR');
  assert.equal(totals().length, 0); assert.match(body(), /Totals are unavailable/);
});

test('pending sale-link staging is excluded from saved-invoice summary amounts', async () => {
  const pending = { ...invoice('i7', 'EUR', 70, true), sourceSaleId: 'recorded-sale' };
  await ready([invoice('i1', 'EUR', 5)], [pending]); await mount(); choose('EUR'); assertGroup('Issued invoices', 1, 5, 'EUR');
});

test('same-batch currency selection and refresh cannot reuse the other action’s original intent', async () => {
  await ready(); await mount(); choose('EUR');
  const oldSelect = selection().props.onChange, oldRefresh = refresh().props.onClick;
  act(() => { oldSelect({ target: { value: 'USD' } }); oldRefresh(); });
  assert.equal(selection().props.value, 'USD'); assertGroup('Issued invoices', 1, 40, 'USD');
  const currentSelect = selection().props.onChange, currentRefresh = refresh().props.onClick;
  act(() => { currentRefresh(); currentSelect({ target: { value: 'EUR' } }); });
  assert.equal(selection().props.value, ''); assert.equal(totals().length, 0);
  choose('EUR'); assertGroup('Issued invoices', 2, 50, 'EUR');
});

test('the first committed render after an actor switch is already unset before passive withdrawal effects', async () => {
  await ready(); const frames: string[] = [];
  const element = () => React.createElement(React.Profiler, { id: 'read-summary-first-render', onRender: () => {
    if (renderer) frames.push(selection().props.value);
  } }, React.createElement(Panel));
  await act(async () => { renderer = create(element()); }); choose('EUR'); assertGroup('Issued invoices', 2, 50, 'EUR');
  frames.length = 0;
  actor('owner-b', false);
  await act(async () => { renderer!.update(element()); });
  assert.ok(frames.length); assert.equal(frames[0], '', 'the prior currency cannot flash on the new actor’s first render');
  assert.equal(totals().length, 0); assert.equal(selection().props.value, '');
});

for (const change of ['actor-ABA', 'sample-ABA', 'raw', 'raw-ABA', 'pagehide'] as const) test(`${change} withdraws displayed totals and cannot be spent by retained ready callbacks`, async () => {
  await ready(); await mount(); choose('EUR'); assert.equal(totals().length, 1);
  const staleSelect = selection().props.onChange, staleRefresh = refresh().props.onClick;
  act(() => {
    if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (change === 'sample-ABA') { sample(true); sample(false); }
    if (change === 'pagehide') events.dispatchEvent(new Event('pagehide'));
    if (change === 'raw' || change === 'raw-ABA') {
      const original = local.rows.get(key())!; local.rows.set(key(), original + ' ');
      const event = Object.assign(new Event('storage'), { key: key() }); events.dispatchEvent(event);
      if (change === 'raw-ABA') { local.rows.set(key(), original); events.dispatchEvent(Object.assign(new Event('storage'), { key: key() })); }
    }
  });
  assert.equal(totals().length, 0); assert.equal(selection().props.value, ''); assert.match(body(), /Totals are unavailable/);
  const bytes = new Map(local.rows), writes = local.writes.length;
  act(() => { staleSelect({ target: { value: 'ZAR' } }); staleRefresh(); });
  assert.equal(totals().length, 0); assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes);
  await reload(); choose('EUR'); assertGroup('Issued invoices', 2, 50, 'EUR');
});

test('an actual model write withdraws an earlier read and explicit refresh uses the new amount', async () => {
  await ready(); await mount(); choose('EUR');
  const source = model.readInvoiceBook(); retained.add(source);
  const invoice = source.invoices.find(row => row.id === 'i3')!;
  await act(async () => {
    const result = model.saveInvoice({ ...invoice, items: [{ ...invoice.items[0], price: 21 }] }, source);
    assert.equal(result.status, 'written'); if (result.status !== 'written') throw Error('Source change needs its receipt'); retained.add(result.book);
  });
  assert.equal(totals().length, 0); await reload(); choose('EUR'); assertGroup('Issued invoices', 2, 51, 'EUR'); assertGroup('Recorded paid invoices', 1, 21, 'EUR');
});

test('sample reads carry a DEMO label and cannot touch real saved storage', async () => {
  await ready(); const bytes = new Map(local.rows); sample(true); samples.setSandboxInvoices([invoice('i1', 'EUR', 8)]); samples.setSandboxPendingInvoiceLinks([]);
  await mount(); choose('EUR'); assertGroup('Issued invoices', 1, 8, 'EUR'); assert.match(body(), /DEMO/); assert.deepEqual(local.rows, bytes);
  act(() => sample(false)); assert.equal(totals().length, 0); assert.deepEqual(local.rows, bytes);
});

test('the direct read hook releases its own receipts and permanently rejects a retained reload across actor ABA', async () => {
  await ready();
  const ReadProbe = () => React.createElement('invoice-read-source-probe', { source: useInvoiceReadSource() });
  await act(async () => { renderer = create(React.createElement(ReadProbe)); });
  const current = () => renderer!.root.findByType('invoice-read-source-probe' as never).props.source as ReturnType<typeof useInvoiceReadSource>;
  assert.equal(current().isCurrent(), true); const stale = current().reload;
  act(() => { actor('owner-b'); actor('owner-a'); }); assert.equal(current().isCurrent(), false);
  act(() => { assert.equal(stale(), null); });
  act(() => { assert.ok(current().reload()); }); assert.equal(current().isCurrent(), true);
  act(() => { renderer!.unmount(); renderer = null; }); assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
});
