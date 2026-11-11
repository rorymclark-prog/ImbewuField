import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import type { SavedInvoice, InvoiceBookRead, InvoiceMutationResult } from '../lib/invoices.ts';
import type { InvoiceStorageLocks } from '../lib/invoice-storage.ts';

// Firebase auth is the only controlled service boundary. Invoice projection,
// actual local canonical storage/receipts, epoch proofs and sample stores run.
const probe = { actor: 'owner-a' as string | null, listeners: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __invoiceAdmissionProbe: probe });
const library = new URL('../lib/', import.meta.url).href;
const data = (body: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(body) });
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__invoiceAdmissionProbe;
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__invoiceAdmissionProbe;
    export const onAuthStateChanged=(_a,next,error)=>{p.listeners.add(next);p.errors.add(error);return()=>{p.listeners.delete(next);p.errors.delete(error);};};`);
  return next(specifier, context);
} });
const model = await import('../lib/invoices.ts');
const store = await import('../lib/invoice-storage.ts');
const account = await import('../lib/account-local-storage.ts');
const sampleStore = await import('../lib/sample-mode.ts');
const basis = await import('../lib/invoice-currency.ts');
class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = [];
  beforeSet: ((key: string) => void) | null = null; afterSet: ((key: string) => void) | null = null;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string) { this.beforeSet?.(key); this.rows.set(key, raw); this.writes.push(key); this.afterSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); }
}
class Locks implements InvoiceStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const originals = new Map(['window', 'localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let local: MemoryStorage, session: MemoryStorage, win: EventTarget, locks: Locks;
const books = new Set<InvoiceBookRead>();
const read = () => { const value = model.readInvoiceBook(); books.add(value); return value; };
function accepted(result: InvoiceMutationResult): InvoiceBookRead {
  assert.equal(result.status, 'written', result.status === 'held' || result.status === 'unconfirmed' ? result.reason : 'expected an own write');
  if (result.status !== 'written') throw Error('Expected own receipt');
  books.add(result.book); assert.equal(model.invoiceBookIsCurrent(result.book), true); return result.book;
}
function invoice(overrides: Partial<SavedInvoice> = {}): SavedInvoice {
  return { id: 'invoice-a', no: 44, billTo: 'Recorded buyer', items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 3 }],
    total: 6, dateISO: '2026-11-01T10:00:00.000Z', status: 'unpaid', ...overrides };
}
// Keep invoice() unlabelled for actual historical-evidence cases. Only a newly
// authored document makes an explicit denomination choice in this fixture.
function newInvoice(overrides: Partial<SavedInvoice> = {}): SavedInvoice { return invoice({ currencyCode: 'ZAR', ...overrides }); }
const key = (base = store.INVOICE_STORAGE_KEY) => account.activeAccountLocalStorageKey(base);
function rawPayload() { const raw = JSON.parse(local.rows.get(key())!).bookRaw; const payload = store.parseInvoiceStoragePayload(raw); assert.ok(payload); return payload; }
const savedRows = () => JSON.parse(rawPayload().invoicesRaw) as Record<string, unknown>[];
async function ready(saved: unknown[] = [], pending: unknown[] = [], sequence: string | null = null) {
  local.rows.set(key(store.INVOICE_LEGACY_KEY), JSON.stringify(saved));
  local.rows.set(key(store.INVOICE_PENDING_LEGACY_KEY), JSON.stringify(pending));
  if (sequence !== null) local.rows.set(key(store.INVOICE_SEQUENCE_LEGACY_KEY), sequence);
  assert.equal((await store.initialiseInvoiceStorage(undefined, locks)).writable, true);
}
function actor(uid: string | null, observed = true) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  if (observed) for (const listener of probe.listeners) listener(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  win.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
beforeEach(async () => {
  for (const book of books) model.releaseInvoiceBook(book); books.clear();
  store.releaseAllDocumentInvoiceLeases(); await Promise.resolve();
  actor('owner-a'); local = new MemoryStorage(); session = new MemoryStorage(); locks = new Locks();
  win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
});
after(() => {
  sample(false); for (const book of books) model.releaseInvoiceBook(book); store.releaseAllDocumentInvoiceLeases();
  account.bindMountedAccountLocalStorageUid(null); hook.deregister(); Reflect.deleteProperty(globalThis, '__invoiceAdmissionProbe');
  for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('financial writes need an actual loaded source and return an own receipt instead of a plausible previous list', async () => {
  await ready(); const before = new Map(local.rows);
  for (const result of [model.saveInvoice(invoice()), model.deleteInvoice('invoice-a'), model.stageInvoiceSaleLink(invoice()),
    model.clearPendingInvoiceLink('invoice-a'), model.setInvoiceStatus('invoice-a', 'paid'), model.saveNextInvoiceNumber(45)]) assert.equal(result.status, 'held');
  assert.deepEqual(local.rows, before);
  const source = read(), result = model.saveInvoice(newInvoice(), source), next = accepted(result);
  assert.equal(next.invoices.length, 1); assert.equal(next.invoices[0].total, 6);
  assert.equal(model.invoiceBookIsCurrent(source), false);
  assert.equal(model.saveInvoice(invoice({ notes: 'stale edit' }), source).status, 'held');
  assert.equal(rawPayload().invoicesRaw, JSON.stringify(savedRows()));
  assert.equal(local.rows.get(key(store.INVOICE_LEGACY_KEY)), '[]');
});

test('new IDs require an explicit recorded currency rather than inventing a historical Rand basis', async () => {
  await ready(); const source = read(), before = new Map(local.rows);
  const linked = invoice({ sourceSaleId: 'sale-a', status: 'paid', paidAt: '2026-11-02T09:00:00.000Z' });
  for (const candidate of [invoice(), invoice({ currencyCode: undefined })]) assert.equal(model.saveInvoice(candidate, source).status, 'held');
  for (const candidate of [linked, { ...linked, currencyCode: undefined }]) assert.equal(model.stageInvoiceSaleLink(candidate, source).status, 'held');
  assert.deepEqual(local.rows, before);
  const zar = accepted(model.saveInvoice(newInvoice(), source)); assert.equal(zar.invoices[0].currencyCode, 'ZAR');
  const foreign = accepted(model.saveInvoice(newInvoice({ id: 'foreign-new', no: 45, currencyCode: 'EUR' }), zar));
  assert.equal(foreign.invoices.find(row => row.id === 'foreign-new')!.currencyCode, 'EUR');
});

test('an existing historical invoice may be edited only while retaining genuine currency absence', async () => {
  await ready([invoice()]); const source = read(); assert.equal(Object.hasOwn(source.invoices[0], 'currencyCode'), false);
  const saved = accepted(model.saveInvoice({ ...source.invoices[0], notes: 'A deliberate historical correction' }, source));
  assert.equal(Object.hasOwn(saved.invoices[0], 'currencyCode'), false);
  assert.equal(Object.hasOwn(savedRows()[0], 'currencyCode'), false);
  assert.equal(model.saveInvoice({ ...saved.invoices[0], currencyCode: 'ZAR' }, saved).status, 'held');
});

test('exact staged historical evidence can finalize under the same ID without receiving an invented currency tag', async () => {
  const legacy = invoice({ sourceSaleId: 'legacy-sale', status: 'paid', paidAt: '2026-11-02T09:00:00.000Z' });
  await ready([], [legacy]); const source = read();
  assert.equal(Object.hasOwn(source.pendingLinks[0], 'currencyCode'), false);
  assert.equal(model.saveInvoice({ ...source.pendingLinks[0], currencyCode: 'ZAR' }, source).status, 'held');
  let saved = accepted(model.saveInvoice(source.pendingLinks[0], source));
  assert.equal(Object.hasOwn(saved.invoices[0], 'currencyCode'), false);
  saved = accepted(model.clearPendingInvoiceLink(legacy.id, saved));
  assert.equal(saved.pendingLinks.length, 0); assert.equal(Object.hasOwn(savedRows()[0], 'currencyCode'), false);
});

test('ordinary edits retain unknown row, line and buyer metadata plus malformed neighbors rather than replacing the projected list', async () => {
  const old = { ...invoice(), futureEvidence: { values: ['retain', 0] },
    items: [{ ...invoice().items[0], futureLine: { source: 'original' } }], billToDetails: { address: 'Old address', futureContact: 7 } };
  await ready([null, old, { id: 'damaged-neighbor', no: 83 }]); const source = read();
  assert.equal(source.retainedUnreadableRows, 2);
  accepted(model.saveInvoice({ ...source.invoices[0], notes: 'A deliberate edit' }, source));
  const rows = savedRows(); assert.equal(rows[0], null); assert.deepEqual(rows[2], { id: 'damaged-neighbor', no: 83 });
  assert.deepEqual(rows[1].futureEvidence, old.futureEvidence); assert.deepEqual((rows[1].items as unknown[])[0], old.items[0]);
  assert.equal((rows[1].billToDetails as Record<string, unknown>).futureContact, 7);
  const fresh = read(), bytes = rawPayload().invoicesRaw;
  assert.equal(model.saveInvoice({ ...fresh.invoices[0], items: [{ ...fresh.invoices[0].items[0], qty: 3 }] }, fresh).status, 'held');
  assert.equal(rawPayload().invoicesRaw, bytes, 'unknown line evidence cannot be attached to changed goods by guessing');
});

test('duplicate target identities remain held while an unrelated valid row may preserve that evidence', async () => {
  await ready([invoice(), invoice({ billTo: 'Second conflicting row' })]); const source = read(), before = rawPayload().invoicesRaw;
  assert.equal(model.saveInvoice(invoice({ notes: 'cannot choose duplicate' }), source).status, 'held');
  assert.equal(model.deleteInvoice('invoice-a', source).status, 'held'); assert.equal(rawPayload().invoicesRaw, before);
  accepted(model.saveInvoice(newInvoice({ id: 'invoice-b', no: 45 }), source));
  assert.deepEqual(savedRows().slice(1), JSON.parse(before));
});

test('unsupported present denominations stay visible and never acquire legacy Rand eligibility', async () => {
  for (const value of ['CAD', null, 7, { imported: 'currency' }]) {
    // Wait for the real retained-lock callback to finish before seeding the
    // next independent denomination case at the same physical addresses.
    store.releaseAllDocumentInvoiceLeases(); await new Promise<void>(resolve => setImmediate(resolve)); local.rows.clear(); await ready([{ ...invoice(), currencyCode: value }]);
    const source = read(), displayed = source.invoices[0]; assert.ok(Object.hasOwn(displayed, 'currencyCode'));
    assert.deepEqual(displayed.currencyCode, value); assert.equal(basis.inspectInvoiceCurrencyBasis(displayed).status, 'held');
    assert.equal(basis.invoiceRandConsumerEligibility(displayed).status, 'held');
    const before = rawPayload().invoicesRaw;
    assert.equal(model.saveInvoice({ ...displayed, currencyCode: 'ZAR' }, source).status, 'held');
    assert.equal(model.deleteInvoice(displayed.id, source).status, 'held'); assert.equal(rawPayload().invoicesRaw, before);
  }
});

test('denomination absence and explicit currency are immutable even when both would mean Rand', async () => {
  await ready([invoice(), invoice({ id: 'foreign', no: 45, currencyCode: 'EUR' })]);
  const source = read(); assert.equal(model.saveInvoice({ ...source.invoices[0], currencyCode: 'ZAR' }, source).status, 'held');
  const foreign = source.invoices.find(row => row.id === 'foreign')!;
  const missing = { ...foreign }; delete missing.currencyCode;
  assert.equal(model.saveInvoice(missing, source).status, 'held');
  assert.equal(model.saveInvoice({ ...foreign, currencyCode: 'USD' }, source).status, 'held');
  const next = accepted(model.saveInvoice({ ...foreign, notes: 'Same recorded denomination' }, source));
  assert.equal(next.invoices.find(row => row.id === 'foreign')!.currencyCode, 'EUR');
  assert.equal(Object.hasOwn(next.invoices.find(row => row.id === 'invoice-a')!, 'currencyCode'), false);
});

test('candidate accessors and present undefined currency are rejected without executing caller code or silently omitting the basis', async () => {
  await ready(); const source = read(); let calls = 0;
  const accessor = Object.defineProperty(invoice(), 'currencyCode', { enumerable: true, get() { calls++; return 'ZAR'; } });
  const notes = Object.defineProperty(invoice(), 'notes', { enumerable: true, get() { calls++; return 'hidden'; } });
  for (const candidate of [accessor, notes, invoice({ currencyCode: undefined }), { ...invoice(), future: () => { calls++; } }]) {
    assert.equal(model.saveInvoice(candidate, source).status, 'held');
  }
  assert.equal(calls, 0); assert.deepEqual(savedRows(), []);
});

test('source-level duplicate keys and rounded numbers are held with denomination uncertainty instead of rewriting parsed evidence', async () => {
  await ready([invoice()]);
  for (const raw of [JSON.stringify([invoice()]).replace('"no":44', '"no":44,"no":45'),
    JSON.stringify([invoice()]).replace('"total":6', '"future":9007199254740993,"total":6')]) {
    const envelope = JSON.parse(local.rows.get(key())!); local.rows.set(key(), JSON.stringify({ ...envelope, bookRaw: JSON.stringify({ ...rawPayload(), invoicesRaw: raw }) }));
    const source = read(); assert.equal(source.writable, false); assert.equal(source.status, 'held');
    assert.equal(basis.inspectInvoiceCurrencyBasis(source.invoices[0]).status, 'held');
    assert.equal(model.saveInvoice(invoice(), source).status, 'held'); assert.equal(rawPayload().invoicesRaw, raw);
  }
});

test('status changes queue Rand reconciliation atomically while preserving issue and prior payment evidence', async () => {
  await ready([invoice()]); let source = read(); const writes = local.writes.length;
  source = accepted(model.setInvoiceStatus('invoice-a', 'paid', 'cash', '2026-11-02T09:10:00.000Z', source));
  assert.equal(local.writes.length - writes, 1); assert.equal(source.invoices[0].salesSyncPending, true);
  assert.equal(source.invoices[0].paidAt, '2026-11-02T09:10:00.000Z');
  const unchanged = model.setInvoiceStatus('invoice-a', 'paid', 'cash', '2026-11-02T09:10:00.000Z', source);
  assert.equal(unchanged.status, 'unchanged');
  const { paidAt: _paid, paymentMethod: _method, ...withoutPayment } = source.invoices[0];
  source = accepted(model.saveInvoice({ ...withoutPayment, dateISO: '2026-11-03T00:00:00.000Z', notes: 'Edited details' }, source));
  assert.equal(source.invoices[0].paidAt, '2026-11-02T09:10:00.000Z'); assert.equal(source.invoices[0].paymentMethod, 'cash');
  assert.equal(source.invoices[0].dateISO, invoice().dateISO); assert.equal(source.invoices[0].salesSyncPending, true);
  source = accepted(model.setInvoiceStatus('invoice-a', 'unpaid', undefined, undefined, source));
  assert.equal(source.invoices[0].status, 'unpaid'); assert.equal(source.invoices[0].paidAt, undefined);
  assert.equal(source.invoices[0].salesSyncPending, true);
});

test('foreign status edits remain local and do not invent supported Rand synchronization', async () => {
  await ready([invoice({ currencyCode: 'EUR' })]); const source = accepted(model.setInvoiceStatus('invoice-a', 'paid', 'card', '2026-11-02T09:00:00.000Z', read()));
  assert.equal(source.invoices[0].currencyCode, 'EUR'); assert.equal(source.invoices[0].salesSyncPending, undefined);
});

test('pending sale recovery finalizes only matching facts and clears only after a confirmed exact final document', async () => {
  await ready(); let source = read(); const pending = newInvoice({ sourceSaleId: 'sale-a', status: 'paid', paidAt: '2026-11-02T09:00:00.000Z', salesSyncPending: true });
  source = accepted(model.stageInvoiceSaleLink(pending, source)); assert.equal(source.invoices.length, 0); assert.equal(source.pendingLinks.length, 1);
  assert.equal(model.clearPendingInvoiceLink(pending.id, source).status, 'held');
  assert.equal(model.saveInvoice({ ...pending, items: [{ ...pending.items[0], qty: 4 }] }, source).status, 'held');
  source = accepted(model.saveInvoice(pending, source)); assert.equal(source.invoices.length, 1); assert.equal(source.pendingLinks.length, 1);
  assert.equal(model.deleteInvoice(pending.id, source).status, 'held');
  assert.equal(model.saveInvoice({ ...pending, sourceSaleId: undefined }, source).status, 'held');
  source = accepted(model.clearPendingInvoiceLink(pending.id, source)); assert.equal(source.pendingLinks.length, 0);
  assert.equal(source.invoices[0].sourceSaleId, 'sale-a');
});

test('numbers reserve every raw saved and pending record and sequence updates use the same canonical write', async () => {
  await ready([{ id: 'damaged-but-numbered', no: 80 }], [invoice({ id: 'pending', no: 90, sourceSaleId: 'sale-p', status: 'paid', paidAt: '2026-11-02' })], '44');
  let source = read(); assert.equal(source.nextNumber, 91);
  assert.equal(model.saveInvoice(newInvoice({ no: 80 }), source).status, 'held');
  assert.equal(model.saveInvoice(newInvoice({ no: 90 }), source).status, 'held');
  const legacySequence = local.rows.get(key(store.INVOICE_SEQUENCE_LEGACY_KEY));
  source = accepted(model.saveNextInvoiceNumber(100, source)); assert.equal(source.nextNumber, 100); assert.equal(rawPayload().sequenceRaw, '100');
  assert.equal(local.rows.get(key(store.INVOICE_SEQUENCE_LEGACY_KEY)), legacySequence);
  source = accepted(model.saveInvoice(newInvoice({ no: 100 }), source)); assert.equal(source.nextNumber, 101);
});

for (const change of ['raw', 'lease', 'actor', 'actor-ABA', 'sample-ABA', 'view'] as const) test(`${change} invalidates the original loaded invoice admission before any new write`, async () => {
  await ready([invoice()]); const source = read();
  if (change === 'raw') local.rows.set(key(), local.rows.get(key())! + ' ');
  if (change === 'lease') store.releaseAllDocumentInvoiceLeases();
  if (change === 'actor') actor('owner-b', false);
  if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
  if (change === 'sample-ABA') { sample(true); sample(false); }
  if (change === 'view') source.invoices[0].notes = 'mutated loaded snapshot';
  const before = new Map(local.rows), writes = local.writes.length;
  assert.equal(model.saveInvoice(invoice({ notes: 'stale save' }), source).status, 'held');
  assert.equal(model.invoiceBookIsCurrent(source), false); assert.deepEqual(local.rows, before); assert.equal(local.writes.length, writes);
});

test('quota is held but an effect interrupted after storage cannot be returned as a retryable previous list', async () => {
  await ready(); let source = read(); local.beforeSet = () => { throw Error('Quota'); };
  assert.equal(model.saveInvoice(newInvoice(), source).status, 'held'); assert.deepEqual(savedRows(), []);
  local.beforeSet = null; local.afterSet = () => { throw Error('After write'); };
  const result = model.saveInvoice(newInvoice(), source); assert.equal(result.status, 'unconfirmed'); assert.equal('book' in result, false);
  local.afterSet = null; assert.equal(store.readInvoiceStorage().reason, 'write-unconfirmed');
  assert.equal(read().writable, false); assert.equal(savedRows()[0].id, 'invoice-a');
});

test('sample writes and sequence live only in the existing in-memory sandbox and withdrawal revokes prior real and sample admissions', async () => {
  await ready([invoice()]); const real = read(); const before = new Map(local.rows); sample(true);
  sampleStore.setSandboxInvoices([]); sampleStore.setSandboxPendingInvoiceLinks([]);
  let source = read(); assert.equal(source.status, 'sample'); assert.equal(source.writable, true);
  source = accepted(model.saveInvoice(newInvoice({ id: 'demo-document' }), source));
  source = accepted(model.saveNextInvoiceNumber(111, source)); assert.equal(source.nextNumber, 111);
  assert.deepEqual(local.rows, before); assert.equal(sampleStore.getSandboxInvoices()[0].id, 'demo-document');
  sample(false); assert.equal(model.invoiceBookIsCurrent(source), false); assert.equal(model.invoiceBookIsCurrent(real), false);
  sample(true); assert.notEqual(read().nextNumber, 111, 'the sample sequence must not outlive its epoch');
  const unsafe = Object.defineProperty(invoice(), 'currencyCode', { enumerable: true, get() { throw Error('Must not execute'); } });
  sampleStore.setSandboxInvoices([unsafe]); const held = read(); assert.equal(held.status, 'held'); assert.equal(held.invoices.length, 0);
});

test('read coverage carries hidden/unavailable evidence on the actual collection before financial filtering', async () => {
  await ready([null, invoice()]); const source = read();
  assert.deepEqual(model.invoiceReadCoverage(source.invoices), { status: 'held', hiddenRows: 1, reason: 'invoice-rows-needing-review' });
  const compatibility = model.loadInvoices(); assert.equal(model.invoiceReadCoverage(compatibility).status, 'held');
  source.invoices.splice(0); assert.equal(model.invoiceReadCoverage(source.invoices).status, 'held');
  local.rows.set(key(), '{broken'); const empty = model.loadInvoices(); assert.deepEqual(empty, []);
  assert.equal(model.invoiceReadCoverage(empty).status, 'held');
});

test('a coherent readable source does not become financially incomplete merely because this document has no write lease', async () => {
  await ready([invoice()]); store.releaseAllDocumentInvoiceLeases(); await Promise.resolve();
  const source = read(); assert.equal(source.writable, false); assert.equal(source.reason, 'writer-not-acquired');
  assert.deepEqual(model.invoiceReadCoverage(source.invoices), { status: 'complete' });
  assert.deepEqual(model.invoiceReadCoverage([]), { status: 'complete' }, 'synthetic caller collections still receive normal per-invoice basis checks');
});
