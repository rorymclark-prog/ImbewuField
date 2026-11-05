import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { SavedInvoice } from '../lib/invoices.ts';
import type { InvoiceDocument } from '../lib/invoice-document.ts';
import type { InvoiceStorageLocks } from '../lib/invoice-storage.ts';

// Run the actual page hooks, effects and handler bodies. Only the final visual
// return is replaced by a probe: this tests no browser layout or real PDF bytes.
// Persistence, currency classification and document construction are production.
const pageUrl = new URL('../app/invoice/page.tsx', import.meta.url).href;
const library = new URL('../lib/', import.meta.url).href;
const probe = { actor: 'owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(),
  errors: new Set<() => void>(), syncs: [] as SavedInvoice[], pdfs: [] as InvoiceDocument[], prints: 0, shares: 0,
  sync: async (_invoice: SavedInvoice): Promise<void> => {}, pdf: async (): Promise<void> => {} };
Object.assign(globalThis, { __invoiceWorkflow: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (body: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(body) });
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__invoiceWorkflow;export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__invoiceWorkflow;export const onAuthStateChanged=(_a,next,error)=>{p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};};`);
  if (specifier === '@/lib/auth') return data(`export function useAuth(){const uid=globalThis.__invoiceWorkflow.actor;return {user:uid?{uid,displayName:'Own seller'}:null,profile:uid?{id:uid,full_name:'Own seller',phone:'',farm_name:null}:null,refreshProfile:async()=>{}};}`);
  if (specifier === '@/lib/i18n') return data(`export const useLanguage=()=>({lang:'en',t:x=>x});`);
  if (specifier === '@/lib/app-level') return data(`export const useAppLevel=()=>'advanced';`);
  if (specifier === '@/components/InvoiceStorageStatus') return data(`
    import {readInvoiceStorageStatus} from '${new URL('../lib/invoice-storage.ts', import.meta.url).href}';
    export const InvoiceStorageNotice=()=>null;
    export const useInvoiceStorageStatus=()=>({status:readInvoiceStorageStatus(),migrationHeld:false});`);
  if (specifier === '@/lib/db/queries') return data(`
    const p=globalThis.__invoiceWorkflow;
    export const mySales=async()=>[];export const updateMyProfile=async()=>{};
    export const syncInvoiceSales=async invoice=>{p.syncs.push(invoice);return p.sync(invoice);};
    export const withWriteTimeout=promise=>promise;`);
  if (specifier === '@/lib/invoice-pdf') return data(`
    const p=globalThis.__invoiceWorkflow;export async function buildInvoicePdf(doc,name){p.pdfs.push(doc);await p.pdf();return new File(['controlled PDF transport'],name,{type:'application/pdf'});}`);
  if (specifier.endsWith('.module.css')) return data(`export default {};`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === pageUrl) {
    const source = readFileSync(new URL(url), 'utf8'), ast = ts.createSourceFile(url, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const page = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'InvoicePage');
    assert.ok(page?.body);
    const finalReturn = page.body.statements.at(-1); assert.ok(finalReturn && ts.isReturnStatement(finalReturn), 'probe replaces only the final visual return');
    const replacement = `return <invoice-workflow state={{ currencyCode, savedCurrencyBasis, currencyBasis, randEligible, items, saved, valid, bookReady, currentId, currentNo, saveError, saveMessage, doc, saving }} actions={{persist,printInvoice,shareInvoice,deliverInvoicePdf,newInvoice,openSaved,changeInvoiceStatus,changeCurrency,chooseCrop,guidePriceFor,setBillTo,setItems,setPaymentStatus,setPaymentISO,setNotes,setIssuedISO}} />;`;
    const transformed = source.slice(0, finalReturn.getStart(ast)) + replacement + source.slice(finalReturn.end);
    return { shortCircuit: true, format: 'module', source: ts.transpileModule(transformed, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  }
  return next(url, context);
} });
const model = await import('../lib/invoices.ts');
const storage = await import('../lib/invoice-storage.ts');
const account = await import('../lib/account-local-storage.ts');
const sampleStore = await import('../lib/sample-mode.ts');
const currencies = await import('../lib/invoice-currency.ts');
const { CROP_ENTRY_OPTIONS } = await import('../lib/crop-entry.ts');
const { priceFor } = await import('../lib/crop-prices.ts');
const { saveSaleInvoice } = await import('../lib/sale-invoice.ts');
const { default: Page } = await import('../app/invoice/page.tsx');

class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = [];
  beforeSet: ((key: string) => void) | null = null; afterSet: ((key: string) => void) | null = null;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, raw: string) { this.beforeSet?.(key); this.rows.set(key, raw); this.writes.push(key); this.afterSet?.(key); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
}
class Locks implements InvoiceStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const original = new Map(['window', 'document', 'localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL;
let local: MemoryStorage, session: MemoryStorage, events: EventTarget, downloads: string[], renderer: ReactTestRenderer | null = null;
const retainedBooks = new Set<ReturnType<typeof model.readInvoiceBook>>();
const otherDocuments: Array<{ model: typeof model; storage: typeof storage; books: Set<ReturnType<typeof model.readInvoiceBook>> }> = [];
let documentIndex = 0;
async function otherInvoiceDocument() {
  const suffix = `?workflow-document=${++documentIndex}`;
  const modelUrl = new URL('../lib/invoices.ts' + suffix, import.meta.url).href;
  const storageUrl = new URL('../lib/invoice-storage.ts' + suffix, import.meta.url).href;
  // Separate real model/factory instances share only this fixture's physical
  // browser storage and LockManager, just as two documents contend for a book.
  const routing = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === modelUrl && specifier === './invoice-storage') return { shortCircuit: true, url: storageUrl };
    return next(specifier, context);
  } });
  try {
    const otherStorage: typeof storage = await import(storageUrl), otherModel: typeof model = await import(modelUrl);
    const document = { storage: otherStorage, model: otherModel, books: new Set<ReturnType<typeof model.readInvoiceBook>>() };
    otherDocuments.push(document); return document;
  } finally { routing.deregister(); }
}
function releaseOtherDocuments() {
  for (const document of otherDocuments.splice(0)) {
    for (const book of document.books) document.model.releaseInvoiceBook(book);
    document.storage.releaseAllDocumentInvoiceLeases();
  }
}
function actor(uid: string | null) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const notify of probe.auth) notify(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
const key = () => account.activeAccountLocalStorageKey(storage.INVOICE_STORAGE_KEY);
function rawRows(): Record<string, unknown>[] {
  const envelope = JSON.parse(local.rows.get(key())!), payload = storage.parseInvoiceStoragePayload(envelope.bookRaw); assert.ok(payload); return JSON.parse(payload.invoicesRaw);
}
function saved(overrides: Partial<SavedInvoice> = {}): SavedInvoice {
  return { id: 'saved-a', no: 44, billTo: 'Own buyer', dateISO: '2026-11-01T09:00:00.000Z',
    items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 3 }], total: 6, status: 'unpaid', ...overrides };
}
async function ready(rows: unknown[] = []) {
  local.rows.set(account.activeAccountLocalStorageKey(storage.INVOICE_LEGACY_KEY), JSON.stringify(rows));
  assert.equal((await storage.initialiseInvoiceStorage()).writable, true);
}
function view(): any { assert.ok(renderer); return renderer.root.findByType('invoice-workflow' as never).props; }
async function mount() { await act(async () => { renderer = create(React.createElement(Page)); await Promise.resolve(); }); }
function fill(currency: '' | 'ZAR' | 'EUR' = 'EUR') {
  act(() => {
    const actions = view().actions;
    if (currency) actions.changeCurrency(currency);
    actions.setBillTo('Own buyer'); actions.setPaymentStatus('unpaid');
    actions.setItems([{ id: 1, desc: 'Recorded produce', qty: 2, unit: 'kg', price: 3 }]);
  });
}
async function invoke(name: string, ...args: unknown[]) { let result: any; await act(async () => { result = await view().actions[name](...args); }); return result; }
function deferred() { let resolve!: () => void, reject!: (error: Error) => void; const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
beforeEach(async () => {
  if (renderer) { act(() => renderer!.unmount()); renderer = null; }
  releaseOtherDocuments();
  for (const book of retainedBooks) model.releaseInvoiceBook(book); retainedBooks.clear(); storage.releaseAllDocumentInvoiceLeases();
  await new Promise<void>(resolve => setImmediate(resolve));
  local = new MemoryStorage(); session = new MemoryStorage(); downloads = [];
  events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session, location: { search: '' },
    print: () => { probe.prints++; }, matchMedia: () => ({ matches: false }) });
  probe.actor = 'owner-a'; account.bindMountedAccountLocalStorageUid('owner-a');
  probe.syncs = []; probe.pdfs = []; probe.prints = 0; probe.shares = 0; probe.sync = async () => {}; probe.pdf = async () => {};
  const dom = Object.assign(new EventTarget(), { visibilityState: 'visible', body: { appendChild() {} },
    createElement: () => ({ href: '', download: '', click() { downloads.push(this.download); }, remove() {} }) });
  for (const [key, value] of Object.entries({ window: events, localStorage: local, document: dom,
    navigator: { locks: new Locks(), onLine: true, canShare: () => true, share: async () => { probe.shares++; } } })) Object.defineProperty(globalThis, key, { configurable: true, value });
  URL.createObjectURL = () => 'blob:controlled-invoice'; URL.revokeObjectURL = () => {};
});
after(() => {
  if (renderer) act(() => renderer!.unmount()); sample(false);
  releaseOtherDocuments();
  for (const book of retainedBooks) model.releaseInvoiceBook(book); storage.releaseAllDocumentInvoiceLeases();
  account.bindMountedAccountLocalStorageUid(null); hook.deregister(); URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  for (const [key, value] of original) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  Reflect.deleteProperty(globalThis, '__invoiceWorkflow');
});

test('the real new-invoice handler cannot save or deliver while currency is still unchosen', async () => {
  await ready(); await mount(); fill(''); const before = new Map(local.rows);
  assert.equal(view().state.currencyCode, ''); assert.equal(view().state.valid, false);
  assert.equal(await invoke('persist'), null); await invoke('printInvoice'); await invoke('shareInvoice');
  assert.deepEqual(local.rows, before); assert.equal(probe.prints, 0); assert.equal(probe.pdfs.length, 0); assert.equal(probe.syncs.length, 0);
});

test('explicit foreign estimates receive neither Rand presets nor guides and save through an actual own receipt without cloud reconciliation', async () => {
  await ready(); local.rows.set(account.activeAccountLocalStorageKey('imbewu_invoice_products'), JSON.stringify([{ desc: 'Remembered product', unit: 'kg', price: 17 }]));
  await mount(); fill('ZAR');
  act(() => view().actions.chooseCrop(1, 'Remembered product', null)); assert.equal(view().state.items[0].price, 17);
  const priced = CROP_ENTRY_OPTIONS.find(option => { const guide = priceFor(option.key, {}); return guide && guide.retailPerKg > 0; }); assert.ok(priced);
  assert.ok(view().actions.guidePriceFor(priced.label, false) > 0, 'positive Rand control uses an existing primary guide');
  act(() => view().actions.changeCurrency('EUR'));
  assert.equal(view().state.items[0].price, 0); assert.equal(view().actions.guidePriceFor(priced.label, false), null);
  act(() => view().actions.chooseCrop(1, 'Remembered product', null)); assert.equal(view().state.items[0].price, 0);
  fill('EUR'); assert.equal(view().state.valid, true);
  const result = await invoke('persist'); assert.ok(result); assert.equal(model.invoiceBookIsCurrent(result.book), true);
  assert.equal(rawRows()[0].currencyCode, 'EUR'); assert.equal(probe.syncs.length, 0);
  assert.match(view().state.saveMessage, /recorded currency/); assert.equal(view().state.currentId, rawRows()[0].id);
});

test('open, edit and payment handlers retain the saved recorded denomination and legacy absence', async () => {
  await ready([saved({ currencyCode: 'EUR' }), saved({ id: 'legacy', no: 45 })]); await mount();
  await invoke('openSaved', saved({ currencyCode: 'EUR' })); assert.equal(view().state.currencyCode, 'EUR');
  act(() => view().actions.changeCurrency('USD')); assert.equal(view().state.currencyCode, 'EUR');
  act(() => view().actions.setNotes('An explicit correction')); assert.ok(await invoke('persist'));
  await invoke('changeInvoiceStatus', view().state.saved.find((row: SavedInvoice) => row.id === 'saved-a'), 'paid', 'card');
  assert.equal(rawRows().find(row => row.id === 'saved-a')!.currencyCode, 'EUR'); assert.equal(probe.syncs.length, 0);
  await invoke('openSaved', saved({ id: 'legacy', no: 45 })); assert.equal(view().state.currencyBasis.status, 'legacy-rand');
  act(() => view().actions.setNotes('Correct historical details')); assert.ok(await invoke('persist'));
  assert.equal(Object.hasOwn(rawRows().find(row => row.id === 'legacy')!, 'currencyCode'), false);
});

test('an unreadable saved currency remains visibly held and cannot save, print or share as historical Rand', async () => {
  const unsupported = saved({ currencyCode: 'CAD' }); await ready([unsupported]); await mount(); await invoke('openSaved', unsupported);
  assert.equal(view().state.currencyBasis.status, 'held'); assert.equal(view().state.valid, false);
  const before = new Map(local.rows); assert.equal(await invoke('persist'), null); await invoke('printInvoice'); await invoke('shareInvoice');
  assert.deepEqual(local.rows, before); assert.equal(probe.prints, 0); assert.equal(probe.pdfs.length, 0); assert.equal(probe.syncs.length, 0);
});

test('a sample page saves explicit currency only in the existing sandbox and labels its result DEMO', async () => {
  await ready([saved()]); const before = new Map(local.rows); sample(true);
  sampleStore.setSandboxInvoices([]); sampleStore.setSandboxPendingInvoiceLinks([]);
  await mount(); fill('EUR'); const result = await invoke('persist'); assert.ok(result);
  assert.deepEqual(local.rows, before); assert.equal(sampleStore.getSandboxInvoices()[0].currencyCode, 'EUR');
  assert.match(view().state.saveMessage, /DEMO/); assert.equal(probe.syncs.length, 0);
});

test('acquiring an edit lease cannot bless stale fields opened while another document owned the invoice book', async () => {
  const original = saved({ currencyCode: 'EUR' }); await ready([original]);
  storage.releaseAllDocumentInvoiceLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  const other = await otherInvoiceDocument(); assert.equal((await other.storage.initialiseInvoiceStorage()).writable, true);
  const source = other.model.readInvoiceBook(); other.books.add(source); assert.equal(other.model.invoiceBookIsCurrent(source), true);
  await mount(); await invoke('openSaved', original);
  assert.equal(view().state.currentId, original.id); assert.equal(view().state.doc.buyerName, original.billTo);
  assert.equal(view().state.bookReady, false); assert.equal(view().state.valid, false);
  const updated = other.model.saveInvoice({ ...source.invoices[0], billTo: 'Changed in the other document',
    items: [{ ...source.invoices[0].items[0], qty: 3 }] }, source);
  assert.equal(updated.status, 'written'); if (updated.status !== 'written') throw Error('Other document needs its actual receipt');
  other.books.add(updated.book); assert.equal(other.model.invoiceBookIsCurrent(updated.book), true);
  assert.equal(rawRows()[0].billTo, 'Changed in the other document');
  other.storage.releaseAllDocumentInvoiceLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  await act(async () => {
    assert.equal((await storage.initialiseInvoiceStorage()).writable, true);
    renderer!.update(React.createElement(Page)); await Promise.resolve();
  });
  assert.equal(storage.readInvoiceStorage().writable, true, 'the provider really returned to editing readiness');
  assert.equal(view().state.doc.buyerName, original.billTo, 'readonly fields stay the earlier view until an explicit current Open');
  assert.equal(view().state.bookReady, false, 'a newly admitted hook book must not authorize the old readonly fields');
  assert.equal(view().state.valid, false);
  const bytes = new Map(local.rows), writes = local.writes.length;
  assert.equal(await invoke('persist'), null); await invoke('printInvoice'); await invoke('shareInvoice');
  assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes); assert.equal(probe.prints + probe.pdfs.length + probe.shares, 0);
  await invoke('openSaved', original);
  assert.equal(view().state.doc.buyerName, 'Changed in the other document'); assert.equal(view().state.items[0].qty, 3);
  assert.equal(view().state.bookReady, true); assert.equal(view().state.valid, true);
  act(() => view().actions.setNotes('An explicit current edit')); assert.ok(await invoke('persist'));
  assert.equal(rawRows()[0].billTo, 'Changed in the other document');
  assert.equal((rawRows()[0].items as Array<{ qty: number }>)[0].qty, 3); assert.equal(rawRows()[0].notes, 'An explicit current edit');
});

for (const action of ['newInvoice', 'openSaved'] as const) test(`a retained explicit ${action} action cannot replace the displayed source after an observed actor ABA`, async () => {
  const original = saved({ currencyCode: 'EUR' }), other = saved({ id: 'saved-b', no: 45, currencyCode: 'USD' });
  await ready([original, other]); await mount(); await invoke('openSaved', original);
  const stale = view().actions[action];
  act(() => { actor('owner-b'); actor('owner-a'); });
  // Withdrawal must clear the old account draft. The stale handler control is
  // stronger when a CURRENT-render action has already opened a fresh valid form.
  assert.equal(view().state.currentId, null);
  await invoke('openSaved', original);
  assert.equal(view().state.currentId, original.id);
  const before = JSON.stringify({ id: view().state.currentId, currency: view().state.currencyCode, items: view().state.items }), bytes = new Map(local.rows);
  const writes = local.writes.length, deliveries = probe.prints + probe.shares + probe.pdfs.length;
  await act(async () => { await stale(other); });
  assert.equal(JSON.stringify({ id: view().state.currentId, currency: view().state.currencyCode, items: view().state.items }), before,
    'an explicit reload must use the current render’s actor proof, not adopt a new epoch through an old handler');
  assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes); assert.equal(probe.prints + probe.shares + probe.pdfs.length, deliveries);
});

test('a retained persist handler cannot save a previous same-actor draft after its currency or fields changed', async () => {
  await ready(); await mount(); fill('EUR'); const stale = view().actions.persist;
  act(() => { view().actions.changeCurrency('USD'); view().actions.setBillTo('Changed buyer'); view().actions.setItems([{ id: 1, desc: 'Recorded produce', qty: 3, unit: 'kg', price: 4 }]); });
  const bytes = new Map(local.rows); let result: unknown;
  await act(async () => { result = await stale(); });
  assert.equal(result, null); assert.deepEqual(local.rows, bytes); assert.equal(view().state.currencyCode, 'USD');
  assert.equal(probe.syncs.length, 0); assert.equal(probe.prints + probe.shares, 0);
});

for (const fault of ['held', 'unconfirmed'] as const) test(`${fault} actual storage cannot be mistaken for a successful same-ID save or print/share receipt`, async () => {
  await ready([saved({ currencyCode: 'EUR' })]); await mount(); await invoke('openSaved', saved({ currencyCode: 'EUR' }));
  act(() => view().actions.setNotes('This change needs a receipt'));
  if (fault === 'held') local.beforeSet = () => { throw Error('Quota'); };
  else local.afterSet = () => { throw Error('Readback interrupted after effect'); };
  assert.equal(await invoke('persist'), null); assert.ok(view().state.saveError);
  await invoke('printInvoice'); await invoke('shareInvoice');
  assert.equal(probe.prints, 0); assert.equal(probe.pdfs.length, 0); assert.equal(probe.shares, 0);
  if (fault === 'unconfirmed') assert.equal(storage.readInvoiceStorage().reason, 'write-unconfirmed');
});

for (const change of ['raw', 'actor-ABA', 'sample-ABA'] as const) test(`a retained real save closure cannot adopt ${change} as a fresh invoice source`, async () => {
  await ready(); await mount(); fill('EUR'); const stale = view().actions.persist;
  if (change === 'raw') local.rows.set(key(), local.rows.get(key())! + ' ');
  if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
  if (change === 'sample-ABA') { sample(true); sample(false); }
  const before = new Map(local.rows); let result: unknown; await act(async () => { result = await stale(); });
  assert.equal(result, null); assert.deepEqual(local.rows, before); assert.equal(probe.syncs.length, 0);
});

test('a completed own save survives its old raw token becoming obsolete and yields the captured document for print and PDF', async () => {
  await ready(); await mount(); fill('EUR'); await invoke('printInvoice');
  assert.equal(probe.prints, 1); assert.equal(rawRows().length, 1);
  await invoke('shareInvoice'); assert.equal(probe.pdfs.length, 1); assert.equal(probe.shares, 1);
  assert.equal(currencies.inspectInvoiceCurrencyBasis(rawRows()[0]).status, 'recorded');
  assert.equal(probe.pdfs[0].totalLabel, view().state.doc.totalLabel);
  assert.doesNotMatch(probe.pdfs[0].sellerName, /^DEMO\b/, 'a real saved document must not acquire a sample label');
});

test('sample Download PDF labels the captured seller DEMO without changing its saved buyer, invoice data or sample profile', async () => {
  await ready([saved()]); const realBytes = new Map(local.rows); sample(true);
  sampleStore.setSandboxInvoices([]); sampleStore.setSandboxPendingInvoiceLinks([]);
  const source = model.readInvoiceBook(); retainedBooks.add(source);
  const initial = model.saveInvoice(saved({ currencyCode: 'EUR', notes: 'Original practice note' }), source);
  assert.equal(initial.status, 'written'); if (initial.status !== 'written') throw Error('Sample setup needs its own receipt');
  retainedBooks.add(initial.book);
  const original = JSON.parse(JSON.stringify(sampleStore.getSandboxInvoices()[0])) as SavedInvoice;
  const profile = JSON.stringify(sampleStore.getSandboxProfile());
  await mount(); await invoke('openSaved', original); await invoke('deliverInvoicePdf', true);
  assert.equal(probe.pdfs.length, 1); assert.match(probe.pdfs[0].sellerName, /^DEMO\b/);
  assert.equal(probe.pdfs[0].buyerName, original.billTo);
  assert.deepEqual(sampleStore.getSandboxInvoices()[0], original, 'DEMO is a document annotation, not a rewrite of saved practice facts');
  assert.equal(JSON.stringify(sampleStore.getSandboxProfile()), profile);
  assert.deepEqual(local.rows, realBytes); assert.equal(downloads.length, 1); assert.equal(probe.shares, 0);
});

test('explicit Download PDF uses the same saved document and downloads once even when native file sharing is available', async () => {
  await ready(); await mount(); fill('EUR'); await invoke('deliverInvoicePdf', true);
  assert.equal(probe.pdfs.length, 1); assert.equal(rawRows().length, 1);
  assert.equal(probe.pdfs[0].totalLabel, view().state.doc.totalLabel);
  assert.deepEqual(downloads, [`Invoice-${String(rawRows()[0].no).padStart(4, '0')}.pdf`]);
  assert.equal(probe.shares, 0, 'downloadOnly must bypass the fixture’s true canShare result');
});

for (const change of ['actor-ABA', 'raw'] as const) test(`explicit PDF download after ${change} during construction cannot deliver a withdrawn document`, async () => {
  await ready(); await mount(); fill('EUR'); const wait = deferred(); probe.pdf = () => wait.promise;
  let pending!: Promise<void>; await act(async () => { pending = view().actions.deliverInvoicePdf(true); await Promise.resolve(); });
  assert.equal(probe.pdfs.length, 1);
  act(() => {
    if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    else local.rows.set(key(), local.rows.get(key())! + ' ');
  });
  await act(async () => { wait.resolve(); await pending; });
  assert.deepEqual(downloads, []); assert.equal(probe.shares, 0);
});

for (const change of ['actor-ABA', 'sample-ABA', 'raw', 'visible-document', 'unmount'] as const) test(`PDF completion after ${change} cannot deliver a withdrawn invoice`, async () => {
  await ready(); await mount(); fill('EUR'); const wait = deferred(); probe.pdf = () => wait.promise;
  let pending!: Promise<void>; await act(async () => { pending = view().actions.shareInvoice(); await Promise.resolve(); });
  assert.equal(probe.pdfs.length, 1);
  act(() => {
    if (change === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (change === 'sample-ABA') { sample(true); sample(false); }
    if (change === 'raw') local.rows.set(key(), local.rows.get(key())! + ' ');
    if (change === 'visible-document') view().actions.setNotes('Changed while PDF transport waited');
    if (change === 'unmount') { renderer!.unmount(); renderer = null; }
  });
  await act(async () => { wait.resolve(); await pending; });
  assert.equal(probe.shares, 0); assert.deepEqual(downloads, []);
});

test('a live PDF failure retains the saved document and useful Print recovery copy', async () => {
  await ready(); await mount(); fill('EUR'); const wait = deferred(); probe.pdf = () => wait.promise;
  let pending!: Promise<void>; await act(async () => { pending = view().actions.shareInvoice(); await Promise.resolve(); });
  assert.equal(probe.pdfs.length, 1);
  await act(async () => { wait.reject(Error('Controlled PDF failure')); await pending; });
  assert.match(view().state.saveError, /PDF could not be built/); assert.match(view().state.saveError, /Print/);
  assert.equal(rawRows().length, 1); assert.equal(probe.shares, 0); assert.deepEqual(downloads, []);
});

test('a late PDF failure after a new form cannot publish an old saved-invoice error', async () => {
  await ready(); await mount(); fill('EUR'); const wait = deferred(); probe.pdf = () => wait.promise;
  let pending!: Promise<void>; await act(async () => { pending = view().actions.shareInvoice(); await Promise.resolve(); });
  assert.equal(probe.pdfs.length, 1); await invoke('newInvoice');
  assert.equal(view().state.currentId, null); assert.equal(view().state.saveError, null);
  const bytes = new Map(local.rows);
  await act(async () => { wait.reject(Error('Controlled late PDF failure')); await pending; });
  assert.equal(view().state.currentId, null); assert.equal(view().state.currencyCode, ''); assert.equal(view().state.saveError, null);
  assert.deepEqual(local.rows, bytes); assert.equal(rawRows().length, 1); assert.equal(probe.shares, 0); assert.deepEqual(downloads, []);
});

test('a live payment-sync rejection retains actual local payment evidence and explains the pending confirmation', async () => {
  const original = saved({ currencyCode: 'ZAR' }); await ready([original]); await mount(); await invoke('openSaved', original);
  const wait = deferred(); probe.sync = () => wait.promise;
  let pending!: Promise<void>; await act(async () => { pending = view().actions.changeInvoiceStatus(view().state.saved[0], 'paid', 'cash'); await Promise.resolve(); });
  assert.equal(probe.syncs.length, 1); assert.equal(rawRows()[0].status, 'paid'); assert.equal(rawRows()[0].salesSyncPending, true);
  const bytes = new Map(local.rows);
  await act(async () => { wait.reject(Error('Controlled payment confirmation failure')); await pending; });
  assert.match(view().state.saveError, /Payment details remain on this device/); assert.match(view().state.saveError, /pending/);
  assert.deepEqual(local.rows, bytes); assert.equal(rawRows()[0].status, 'paid'); assert.equal(rawRows()[0].salesSyncPending, true);
});

for (const replacement of ['New', 'Open'] as const) test(`a late payment-sync rejection after same-actor ${replacement} cannot alter the replacement form or its receipt`, async () => {
  const original = saved({ currencyCode: 'ZAR' }), other = saved({ id: 'other-current', no: 45, currencyCode: 'EUR' });
  await ready([original, other]); await mount(); await invoke('openSaved', original);
  const wait = deferred(); probe.sync = () => wait.promise;
  let pending!: Promise<void>; await act(async () => { pending = view().actions.changeInvoiceStatus(view().state.saved.find((row: SavedInvoice) => row.id === original.id), 'paid', 'cash'); await Promise.resolve(); });
  assert.equal(probe.syncs.length, 1); assert.equal(rawRows().find(row => row.id === original.id)!.status, 'paid');
  if (replacement === 'New') await invoke('newInvoice'); else await invoke('openSaved', other);
  assert.equal(view().state.currentId, replacement === 'New' ? null : other.id); assert.equal(view().state.saveError, null);
  const state = () => JSON.stringify({ id: view().state.currentId, currency: view().state.currencyCode, items: view().state.items,
    error: view().state.saveError, message: view().state.saveMessage, saving: view().state.saving });
  const before = state(), bytes = new Map(local.rows), writes = local.writes.length;
  await act(async () => { wait.reject(Error('Controlled stale payment confirmation failure')); await pending; });
  assert.equal(state(), before); assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes);
  assert.equal(rawRows().find(row => row.id === original.id)!.salesSyncPending, true);
  assert.equal(probe.prints + probe.shares + probe.pdfs.length, 0);
});

test('late Rand cloud completion after a new form cannot clear another source or roll back the actual local payment', async () => {
  await ready(); await mount(); fill('ZAR'); act(() => { view().actions.setPaymentStatus('paid'); view().actions.setPaymentISO(new Date().toISOString()); });
  const wait = deferred(); probe.sync = () => wait.promise;
  let pending!: Promise<unknown>; await act(async () => { pending = view().actions.persist(); await Promise.resolve(); });
  assert.equal(probe.syncs.length, 1); assert.equal(rawRows()[0].salesSyncPending, true);
  await invoke('newInvoice'); const currentNo = view().state.currentNo;
  await act(async () => { wait.resolve(); assert.equal(await pending, null); });
  assert.equal(view().state.currentId, null); assert.equal(view().state.currentNo, currentNo);
  assert.equal(rawRows()[0].status, 'paid'); assert.equal(rawRows()[0].salesSyncPending, true);
});

test('the actual quick-sale adapter requires the original admitted book and records explicit ZAR without inventing a second invoice after cloud failure', async () => {
  await ready(); const source = model.readInvoiceBook(); retainedBooks.add(source);
  const sale = { crop: 'Recorded produce', quantity: 2, unit: 'kg' as const, kg: 2, amount: 6, buyer: 'Own buyer', sold_at: '2026-11-01T09:00:00.000Z' };
  await assert.rejects(saveSaleInvoice(sale, async () => {}));
  const invoice = await saveSaleInvoice(sale, async () => { throw Error('Queued cloud completion unknown'); }, source);
  assert.equal(invoice.currencyCode, 'ZAR'); assert.equal(invoice.salesSyncPending, true); assert.equal(rawRows().length, 1);
  await assert.rejects(saveSaleInvoice(sale, async () => {}, source)); assert.equal(rawRows().length, 1);
});
