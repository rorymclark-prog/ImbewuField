import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import type { InvoiceBookRead, InvoiceReadView, SavedInvoice } from '../lib/invoices';
import type { InvoiceStorageLocks } from '../lib/invoice-storage';

const probe = { actor: 'owner-a' as string | null, configured: true, initThrows: false,
  auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __invoiceReadViewProbe: probe });
const library = new URL('../lib/', import.meta.url).href;
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__invoiceReadViewProbe;export const isBackendConfigured=()=>p.configured;
    export const getFirebase=()=>{if(p.initThrows)throw Error('Controlled auth unavailability');return p.configured?{auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}}:null;};`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__invoiceReadViewProbe;export function onAuthStateChanged(_auth,next,error){p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  return next(specifier, context);
} });
const model = await import('../lib/invoices');
const store = await import('../lib/invoice-storage');
const account = await import('../lib/account-local-storage');
const samples = await import('../lib/sample-mode');

class MemoryStorage {
  rows = new Map<string, string>(); writes = 0; removes = 0; fail = false;
  onRead: ((key: string) => void) | null = null;
  getItem(key: string) { if (this.fail) throw Error('Controlled unreadable storage'); const raw = this.rows.get(key) ?? null; this.onRead?.(key); return raw; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, value); }
  removeItem(key: string) { this.removes++; this.rows.delete(key); }
}
class Locks implements InvoiceStorageLocks {
  requests = 0; held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    this.requests++; await Promise.resolve();
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
let local: MemoryStorage, session: MemoryStorage, locks: Locks, win: EventTarget;
const originals = new Map(['window', 'localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const views = new Set<InvoiceReadView>(), books = new Set<InvoiceBookRead>();
const stores = [store]; let otherId = 0;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function actor(uid: string | null) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const listener of [...probe.auth]) listener(uid ? { uid } : null);
}
const invoice = (extra: Record<string, unknown> = {}): SavedInvoice => ({ id: 'invoice-a', no: 44, billTo: 'Private buyer',
  items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 3 }], total: 6,
  dateISO: '2026-11-01T12:00:00Z', status: 'paid', paidAt: '2026-11-02T12:00:00Z', ...extra });
const key = (base: string) => account.activeAccountLocalStorageKey(base);
function seed(rows: unknown[] = [invoice()], pending: unknown[] = []) {
  local.rows.set(key(store.INVOICE_LEGACY_KEY), JSON.stringify(rows));
  local.rows.set(key(store.INVOICE_PENDING_LEGACY_KEY), JSON.stringify(pending));
  local.rows.set(key(store.INVOICE_SEQUENCE_LEGACY_KEY), '0045');
}
async function canonical(rows?: unknown[], pending?: unknown[]) {
  seed(rows, pending); assert.equal((await store.initialiseInvoiceStorage(undefined, locks)).writable, true);
}
function read() { const view = model.readInvoiceView(); views.add(view); return view; }
function ready(view: InvoiceReadView) {
  assert.notEqual(view.status, 'held', view.status === 'held' ? view.reason : 'readable view');
  if (view.status === 'held') throw Error('Expected coherent read view');
  assert.equal(model.invoiceReadViewIsCurrent(view), true); return view;
}
function writer() { const book = model.readInvoiceBook(); books.add(book); return book; }
function sample(rows: unknown[] = [invoice()], pending: unknown[] = []) {
  session.rows.set('imbewu_sample_mode', '1'); win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
  samples.setSandboxInvoices(rows as SavedInvoice[]); samples.setSandboxPendingInvoiceLinks(pending as SavedInvoice[]);
}
beforeEach(async () => {
  for (const view of views) model.releaseInvoiceReadView(view); views.clear();
  for (const book of books) model.releaseInvoiceBook(book); books.clear();
  for (const module of stores) module.releaseAllDocumentInvoiceLeases(); await tick();
  probe.configured = true; probe.initThrows = false; actor('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); locks = new Locks();
  win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
});
after(async () => {
  for (const view of views) model.releaseInvoiceReadView(view);
  for (const book of books) model.releaseInvoiceBook(book);
  for (const module of stores) module.releaseAllDocumentInvoiceLeases(); await tick();
  hook.deregister(); account.bindMountedAccountLocalStorageUid(null);
  Reflect.deleteProperty(globalThis, '__invoiceReadViewProbe');
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('a coherent actual invoice view stays readable while another document owns the edit lock, without writes or lock requests', async () => {
  await canonical(); store.releaseAllDocumentInvoiceLeases(); await tick();
  const other: typeof store = await import(new URL(`../lib/invoice-storage.ts?read-view-document=${++otherId}`, import.meta.url).href); stores.push(other);
  assert.equal((await other.initialiseInvoiceStorage(undefined, locks)).writable, true);
  assert.equal(store.readInvoiceStorageStatus().reason, 'writer-not-acquired');
  const writes = local.writes, requests = locks.requests, before = new Map(local.rows);
  const view = ready(read());
  assert.equal(view.invoices[0].billTo, 'Private buyer'); assert.equal(view.invoices[0].total, 6);
  assert.equal(Object.hasOwn(view, 'writable'), false); assert.equal(Object.hasOwn(view, 'token'), false);
  assert.equal(Object.hasOwn(view, 'pendingLinks'), false); assert.equal(local.writes, writes); assert.equal(locks.requests, requests);
  assert.deepEqual(local.rows, before);
  const book = writer(); assert.equal(book.writable, false); assert.equal(model.invoiceBookIsCurrent(book), false);
});

test('existing readable legacy data needs no initialization, while complete pre-cutover absence never manufactures an empty summary', () => {
  const absent = read(); assert.equal(absent.status, 'held'); assert.equal(Object.hasOwn(absent, 'invoices'), false);
  const beforeWrites = local.writes; seed(); const before = new Map(local.rows);
  const view = ready(read()); assert.equal(view.invoices.length, 1);
  assert.equal(Object.hasOwn(view.invoices[0], 'currencyCode'), false);
  assert.equal(local.writes, beforeWrites); assert.equal(locks.requests, 0); assert.deepEqual(local.rows, before);
  assert.equal(local.rows.has(key(store.INVOICE_STORAGE_KEY)), false);
});

test('source readability preserves explicit currencies and leaves currency eligibility to the pure projection', async () => {
  await canonical([invoice({ currencyCode: 'KES' }), invoice({ id: 'unknown-code', no: 45, currencyCode: null })]);
  const view = ready(read());
  assert.equal(view.invoices[0].currencyCode, 'KES'); assert.equal(view.invoices[1].currencyCode, null);
  assert.deepEqual(view.coverage, { status: 'complete' });
});

test('read views and forged lookalikes cannot authorize any existing invoice mutation', async () => {
  await canonical([invoice({ currencyCode: 'ZAR' })]); const view = ready(read()), before = new Map(local.rows);
  const source = view as unknown as InvoiceBookRead;
  assert.equal(model.invoiceBookIsCurrent(source), false);
  assert.equal(model.saveInvoice(invoice({ id: 'new', no: 45, currencyCode: 'ZAR' }), source).status, 'held');
  assert.equal(model.deleteInvoice('invoice-a', source).status, 'held');
  assert.equal(model.setInvoiceStatus('invoice-a', 'unpaid', undefined, undefined, source).status, 'held');
  assert.equal(model.saveNextInvoiceNumber(46, source).status, 'held');
  assert.equal(model.stageInvoiceSaleLink(invoice({ id: 'pending', sourceSaleId: 'sale-a', currencyCode: 'ZAR' }), source).status, 'held');
  assert.equal(model.clearPendingInvoiceLink('pending', source).status, 'held');
  assert.equal(model.invoiceReadViewIsCurrent({ ...view }), false);
  assert.equal(model.invoiceReadViewIsCurrent(JSON.parse(JSON.stringify(view))), false);
  assert.deepEqual(local.rows, before); assert.equal(model.invoiceReadViewIsCurrent(view), true);
});

test('actual observed actor A-B-A permanently withdraws the original read view and notifies its subscribers once', async () => {
  await canonical(); const view = ready(read()); let withdrawals = 0;
  model.subscribeInvoiceReadView(view, () => { withdrawals++; });
  actor('owner-b'); actor('owner-a');
  assert.equal(model.invoiceReadViewIsCurrent(view), false); assert.equal(withdrawals, 1);
  assert.notEqual(ready(read()), view);
});

test('same-byte editing lease release and reacquisition do not withdraw a coherent read view', async () => {
  await canonical(); const view = ready(read()); let withdrawals = 0;
  model.subscribeInvoiceReadView(view, () => { withdrawals++; });
  store.releaseAllDocumentInvoiceLeases(); await tick();
  assert.equal(model.invoiceReadViewIsCurrent(view), true);
  assert.equal((await store.initialiseInvoiceStorage(undefined, locks)).writable, true);
  assert.equal(model.invoiceReadViewIsCurrent(view), true); assert.equal(withdrawals, 0);
});

test('a changed-then-restored source event during a storage read permanently withdraws the original view once', async () => {
  await canonical(); const delivery = ready(read()); let notifications = 0, fired = false;
  model.subscribeInvoiceReadView(delivery, () => { notifications++; });
  const address = key(store.INVOICE_LEGACY_KEY), original = local.rows.get(address)!;
  local.onRead = () => {
    if (fired) return;
    fired = true;
    local.rows.set(address, original + ' ');
    win.dispatchEvent(new Event('imbewu-invoices-changed'));
    local.rows.set(address, original);
  };
  const current = model.invoiceReadViewIsCurrent(delivery); local.onRead = null;
  assert.equal(fired, true); assert.equal(current, false); assert.equal(notifications, 1);
  assert.equal(model.invoiceReadViewIsCurrent(delivery), false);
  win.dispatchEvent(new Event('imbewu-invoices-changed')); assert.equal(notifications, 1);
});

test('a caller-mutated projection during a storage read cannot finish as the original current view', async () => {
  await canonical(); const delivery = ready(read()); let notifications = 0, fired = false;
  model.subscribeInvoiceReadView(delivery, () => { notifications++; });
  local.onRead = () => {
    if (fired) return;
    fired = true; delivery.invoices[0].billTo = 'Changed projected buyer';
  };
  const current = model.invoiceReadViewIsCurrent(delivery); local.onRead = null;
  assert.equal(fired, true); assert.equal(current, false); assert.equal(notifications, 1);
});

test('an unchanged source event during a storage read retains its original read receipt', async () => {
  await canonical(); const delivery = ready(read()); let notifications = 0, fired = false;
  model.subscribeInvoiceReadView(delivery, () => { notifications++; });
  const writes = local.writes, requests = locks.requests;
  local.onRead = () => {
    if (fired) return;
    fired = true; win.dispatchEvent(new Event('imbewu-invoices-changed'));
  };
  const current = model.invoiceReadViewIsCurrent(delivery); local.onRead = null;
  assert.equal(fired, true); assert.equal(current, true); assert.equal(notifications, 0);
  assert.equal(local.writes, writes); assert.equal(locks.requests, requests);
});

test('a same-byte editing lease release during a storage read does not withdraw or grant writes to the view', async () => {
  await canonical(); const delivery = ready(read()); let notifications = 0, fired = false;
  model.subscribeInvoiceReadView(delivery, () => { notifications++; });
  const writes = local.writes, before = new Map(local.rows);
  local.onRead = () => {
    if (fired) return;
    fired = true; store.releaseAllDocumentInvoiceLeases();
  };
  const current = model.invoiceReadViewIsCurrent(delivery); local.onRead = null; await tick();
  assert.equal(fired, true); assert.equal(current, true); assert.equal(notifications, 0);
  assert.equal(model.invoiceBookIsCurrent(writer()), false);
  assert.equal(local.writes, writes); assert.deepEqual(local.rows, before);
});

test('nested source events during the bounded event witness withdraw once without recursive storage reads', async () => {
  await canonical(); const delivery = ready(read()); let notifications = 0, reads = 0;
  model.subscribeInvoiceReadView(delivery, () => { notifications++; });
  local.onRead = () => {
    reads++;
    if (reads <= 2) win.dispatchEvent(new Event('imbewu-invoices-changed'));
  };
  const current = model.invoiceReadViewIsCurrent(delivery); local.onRead = null;
  assert.equal(current, false); assert.equal(notifications, 1);
  assert.ok(reads < 100, 'nested event handling must stop rather than recursively reading storage');
});

test('a signed-out configured guest can read only its scoped view without claiming owner-unknown bare data', () => {
  actor(null); seed([invoice({ billTo: 'Guest buyer' })]);
  local.rows.set(store.INVOICE_LEGACY_KEY, JSON.stringify([invoice({ billTo: 'Unknown prior owner' })]));
  const before = new Map(local.rows), view = ready(read());
  assert.equal(view.invoices[0].billTo, 'Guest buyer'); assert.deepEqual(local.rows, before);
  assert.equal(local.writes, 0); assert.equal(locks.requests, 0);
  actor('owner-a'); assert.equal(model.invoiceReadViewIsCurrent(view), false);
});

test('fresh canonical payload changes invalidate untouched projected rows even without an event', async () => {
  await canonical(); const view = ready(read()), originalArray = JSON.stringify(view.invoices);
  const canonicalKey = key(store.INVOICE_STORAGE_KEY), original = local.rows.get(canonicalKey)!;
  const envelope = JSON.parse(original), payload = JSON.parse(envelope.bookRaw);
  payload.invoicesRaw = JSON.stringify([invoice({ notes: 'Later source change' })]); envelope.bookRaw = JSON.stringify(payload);
  local.rows.set(canonicalKey, JSON.stringify(envelope));
  assert.equal(model.invoiceReadCoverage(view.invoices).status, 'complete', 'in-memory coverage alone cannot detect the changed storage');
  assert.equal(model.invoiceReadViewIsCurrent(view), false); assert.equal(JSON.stringify(view.invoices), originalArray);
  local.rows.set(canonicalKey, original); assert.equal(model.invoiceReadViewIsCurrent(view), false);
});

test('exact canonical, receipt, pending and sequence byte changes withdraw views and cannot revive after observed restoration', async () => {
  await canonical();
  for (const base of [store.INVOICE_STORAGE_KEY, store.INVOICE_CUTOVER_KEY, store.INVOICE_PENDING_LEGACY_KEY, store.INVOICE_SEQUENCE_LEGACY_KEY, store.INVOICE_LEGACY_KEY]) {
    const view = ready(read()), address = key(base), original = local.rows.get(address)!;
    local.rows.set(address, base === store.INVOICE_SEQUENCE_LEGACY_KEY ? '0046' : `${original} `);
    win.dispatchEvent(new Event('imbewu-invoices-changed'));
    local.rows.set(address, original);
    assert.equal(model.invoiceReadViewIsCurrent(view), false, base);
  }
});

test('a real model write withdraws retained readers without revoking its independent writer admission', async () => {
  await canonical([invoice({ currencyCode: 'ZAR' })]); const view = ready(read()), book = writer(); let withdrawals = 0;
  model.subscribeInvoiceReadView(view, () => { withdrawals++; });
  const result = model.setInvoiceStatus('invoice-a', 'unpaid', undefined, undefined, book);
  assert.equal(result.status, 'written'); if (result.status !== 'written') throw Error('Expected actual write'); books.add(result.book);
  assert.equal(model.invoiceBookIsCurrent(result.book), true); assert.equal(model.invoiceReadViewIsCurrent(view), false);
  assert.equal(withdrawals, 1); assert.equal(ready(read()).invoices[0].status, 'unpaid');
});

test('hidden saved or pending rows, ambiguous JSON and unavailable storage expose held metadata without a projected array', async () => {
  for (const pending of [false, true]) {
    seed(pending ? [invoice()] : [invoice(), null], pending ? [null] : []);
    const view = read(); assert.equal(view.status, 'held'); assert.equal(Object.hasOwn(view, 'invoices'), false);
    if (view.status === 'held') assert.equal(view.retainedUnreadableRows, 1);
  }
  local.rows.set(key(store.INVOICE_LEGACY_KEY), '[{"id":"a","id":"b"}]');
  assert.equal(read().status, 'held');
  local.fail = true; const unavailable = read(); assert.equal(unavailable.status, 'held'); assert.equal(Object.hasOwn(unavailable, 'invoices'), false);
});

test('a changed public projection or executable descriptor invalidates its view without executing getters', async () => {
  await canonical(); const first = ready(read()); first.invoices[0].notes = 'Changed display';
  assert.equal(model.invoiceReadViewIsCurrent(first), false);
  const second = ready(read()); let getters = 0;
  Object.defineProperty(second.invoices[0], 'billTo', { enumerable: true, get() { getters++; return 'Unauthorized replacement'; } });
  assert.equal(model.invoiceReadViewIsCurrent(second), false); assert.equal(getters, 0);
});

test('pagehide and explicit release detach retained view notifications and cannot be reversed by pageshow', async () => {
  await canonical(); const view = ready(read()); let called = 0;
  model.subscribeInvoiceReadView(view, () => { called++; }); win.dispatchEvent(new Event('pagehide'));
  assert.equal(model.invoiceReadViewIsCurrent(view), false); assert.equal(called, 1);
  win.dispatchEvent(new Event('pageshow')); assert.equal(model.invoiceReadViewIsCurrent(view), false);
  const fresh = ready(read()); model.subscribeInvoiceReadView(fresh, () => { called++; });
  model.releaseInvoiceReadView(fresh); actor('owner-b');
  assert.equal(model.invoiceReadViewIsCurrent(fresh), false); assert.equal(called, 1);
});

test('replacing the window or its storage object withdraws a view even when the same account and raw data remain', async () => {
  await canonical();
  for (const replacement of ['window', 'storage'] as const) {
    const view = ready(read());
    if (replacement === 'window') Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }) });
    else Object.defineProperty(win, 'localStorage', { configurable: true, value: new MemoryStorage() });
    assert.equal(model.invoiceReadViewIsCurrent(view), false);
    Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
    Object.defineProperty(win, 'localStorage', { configurable: true, value: local });
    assert.equal(model.invoiceReadViewIsCurrent(view), false);
  }
});

test('safe sample views use memory descriptors and retain legitimate optional undefined fields without device writes', () => {
  sample([invoice({ notes: undefined })]); const before = new Map(local.rows), view = ready(read());
  assert.equal(view.status, 'sample'); assert.equal(view.invoices[0].total, 6);
  assert.equal(local.writes, 0); assert.equal(locks.requests, 0); assert.deepEqual(local.rows, before);
  samples.setSandboxInvoices([invoice({ notes: 'Changed sample source' })]);
  assert.equal(model.invoiceReadViewIsCurrent(view), false);
});

test('sample currency accessors and present undefined currency remain held rather than becoming historical rand', () => {
  let getters = 0;
  const accessor = invoice(); Object.defineProperty(accessor, 'currencyCode', { enumerable: true, get() { getters++; return 'ZAR'; } });
  for (const row of [accessor, invoice({ currencyCode: undefined })]) {
    sample([row]); const view = read(); assert.equal(view.status, 'held'); assert.equal(Object.hasOwn(view, 'invoices'), false);
  }
  assert.equal(getters, 0);
});

test('sample numeric array accessors are rejected without reading the accessor', () => {
  let getters = 0; const rows = [invoice()];
  Object.defineProperty(rows, '0', { enumerable: true, get() { getters++; return invoice(); } });
  sample(rows); const view = read(); assert.equal(view.status, 'held'); assert.equal(getters, 0);
});

test('safe sample null and duplicate evidence is retained rather than silently reduced into a readable complete view', () => {
  for (const rows of [[invoice(), null], [invoice(), invoice()]]) {
    sample(rows); const view = read();
    assert.equal(view.status, 'held'); assert.equal(Object.hasOwn(view, 'invoices'), false);
    if (view.status === 'held') assert.equal(view.retainedUnreadableRows, 1);
    assert.equal(samples.getSandboxInvoices(), rows); assert.equal(rows.length, 2);
    assert.equal(local.writes, 0);
  }
});

test('sample transitions and auth observer failures withdraw the original view rather than adopting a later valid context', async () => {
  await canonical(); const device = ready(read());
  sample(); assert.equal(model.invoiceReadViewIsCurrent(device), false);
  const memory = ready(read()); session.rows.delete('imbewu_sample_mode'); win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
  assert.equal(model.invoiceReadViewIsCurrent(memory), false); assert.equal(model.invoiceReadViewIsCurrent(device), false);
  const current = ready(read());
  for (const error of [...probe.errors]) error();
  assert.equal(model.invoiceReadViewIsCurrent(current), false);
});

test('context loss during capture cannot publish a view from the restored account', () => {
  seed(); let changed = false;
  local.onRead = () => { if (!changed) { changed = true; actor('owner-b'); actor('owner-a'); } };
  const view = read(); assert.equal(view.status, 'held'); assert.equal(Object.hasOwn(view, 'invoices'), false);
  assert.equal(local.writes, 0); assert.equal(locks.requests, 0);
});
