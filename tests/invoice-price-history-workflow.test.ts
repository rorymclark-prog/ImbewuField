import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import ts from 'typescript';
import type { SavedInvoice } from '../lib/invoices.ts';
import type { InvoiceDocument } from '../lib/invoice-document.ts';
import type { InvoiceStorageLocks } from '../lib/invoice-storage.ts';
import type { InvoicePriceChoice, InvoicePriceHistoryResult } from '../lib/invoice-price-history.ts';

// Run the actual page hooks, effects and handler bodies. Only the final visual
// return is replaced by a probe: this tests no browser layout or real PDF bytes.
// Persistence, currency classification and document construction are production.
const pageUrl = new URL('../app/invoice/page.tsx', import.meta.url).href;
const library = new URL('../lib/', import.meta.url).href;
const probe = { actor: 'owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(),
  errors: new Set<() => void>(), syncs: [] as SavedInvoice[], pdfs: [] as InvoiceDocument[], prints: 0, shares: 0,
  sync: async (_invoice: SavedInvoice): Promise<void> => {}, pdf: async (): Promise<void> => {} };
Object.assign(globalThis, { __invoicePriceHistoryWorkflow: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (body: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(body) });
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return data(`
    const p=globalThis.__invoicePriceHistoryWorkflow;export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return data(`
    const p=globalThis.__invoicePriceHistoryWorkflow;export const onAuthStateChanged=(_a,next,error)=>{p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};};`);
  if (specifier === '@/lib/auth') return data(`export function useAuth(){const uid=globalThis.__invoicePriceHistoryWorkflow.actor;return {user:uid?{uid,displayName:'Own seller'}:null,profile:uid?{id:uid,full_name:'Own seller',phone:'',farm_name:null}:null,refreshProfile:async()=>{}};}`);
  if (specifier === '@/lib/i18n') return data(`export const useLanguage=()=>({lang:'en',t:x=>x});`);
  if (specifier === '@/lib/app-level') return data(`export const useAppLevel=()=>'advanced';`);
  if (specifier === '@/components/InvoiceStorageStatus') return data(`
    import {readInvoiceStorageStatus} from '${new URL('../lib/invoice-storage.ts', import.meta.url).href}';
    export const InvoiceStorageNotice=()=>null;
    export const useInvoiceStorageStatus=()=>({status:readInvoiceStorageStatus(),migrationHeld:false});`);
  if (specifier === '@/lib/db/queries') return data(`
    const p=globalThis.__invoicePriceHistoryWorkflow;
    export const mySales=async()=>[];export const updateMyProfile=async()=>{};
    export const syncInvoiceSales=async invoice=>{p.syncs.push(invoice);return p.sync(invoice);};
    export const withWriteTimeout=promise=>promise;`);
  if (specifier === '@/lib/invoice-pdf') return data(`
    const p=globalThis.__invoicePriceHistoryWorkflow;export async function buildInvoicePdf(doc,name){p.pdfs.push(doc);await p.pdf();return new File(['controlled PDF transport'],name,{type:'application/pdf'});}`);
  if (specifier.endsWith('.module.css')) return data(`export default {};`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === pageUrl) {
    const source = readFileSync(new URL(url), 'utf8'), ast = ts.createSourceFile(url, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const page = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === 'InvoicePage');
    assert.ok(page?.body);
    const finalReturn = page.body.statements.at(-1); assert.ok(finalReturn && ts.isReturnStatement(finalReturn), 'probe replaces only the final visual return');
    const history: ts.JsxExpression[] = [];
    const findHistory = (node: ts.Node) => {
      if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression)
        && node.expression.left.getText(ast) === '!financialsLocked'
        && node.getText(ast).includes('Choose a recorded invoice price')) history.push(node);
      ts.forEachChild(node, findHistory);
    };
    findHistory(page); assert.equal(history.length, 1, 'the probe renders the actual price-history subtree');
    const historyExpression = history[0].expression!.getText(ast);
    const replacement = `return <invoice-price-history-workflow state={{currencyCode,currencyBasis,items,saved,valid,bookReady,currentId,currentNo,saveError,saveMessage,doc,priceHistoryLine,notes,billTo,paymentStatus,reference}} actions={{persist,newInvoice,openSaved,changeCurrency,recordedPricesForLine,togglePriceHistory,applyRecordedPrice,updateItem,setBillTo,setBuyerDetails,setItems,setPaymentStatus,setPaymentISO,setPaymentMethod,setReference,setPaperReference,setTermsDays,setIssuedISO,setEnterprise,setLetterhead,setNotes}}>{items.map((it,index) => <div key={index}>{${historyExpression}}</div>)}</invoice-price-history-workflow>`;
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
const { recordsDate } = await import('../lib/records-months.ts');
const { formatRecordedMoney, formattingContext } = await import('../lib/international/locales/formatting.ts');
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
function view(): any { assert.ok(renderer); return renderer.root.findByType('invoice-price-history-workflow' as never).props; }
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
const buttons = (label: string) => renderer!.root.findAllByType('button').filter(node => text(node) === label);
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
  for (const book of retainedBooks) model.releaseInvoiceBook(book); storage.releaseAllDocumentInvoiceLeases();
  account.bindMountedAccountLocalStorageUid(null); hook.deregister(); URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
  for (const [key, value] of original) { if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key); }
  Reflect.deleteProperty(globalThis, '__invoicePriceHistoryWorkflow');
});

function historical(overrides: Partial<SavedInvoice> = {}): SavedInvoice {
  return saved({ id: 'history-eur', no: 40, currencyCode: 'EUR', billTo: 'Earlier buyer',
    items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 17 }], total: 34, ...overrides });
}
function historyChoices(): readonly InvoicePriceChoice[] {
  if (view().state.priceHistoryLine !== 1) act(() => view().actions.togglePriceHistory(1));
  const result: InvoicePriceHistoryResult = view().actions.recordedPricesForLine(view().state.items[0]);
  assert.equal(result.status, 'ready'); return result.choices;
}
function unchangedFields() { return JSON.stringify({ currency: view().state.currencyCode, items: view().state.items, id: view().state.currentId }); }

test('a real explicit click applies only the recorded same-currency line price and persists nothing until ordinary Save', async () => {
  const previous = historical(); await ready([previous, historical({ id: 'other-currency', no: 41, currencyCode: 'USD' })]);
  await mount(); fill('EUR');
  act(() => view().actions.setItems([{ id: 1, desc: 'Recorded produce', qty: 3, unit: 'kg', price: 4, priceFromGuide: true },
    { id: 2, desc: 'Other recorded product', qty: 5, unit: 'crates', price: 6 }]));
  const bytes = new Map(local.rows), writes = local.writes.length, before = JSON.parse(JSON.stringify(view().state.items));
  const open = buttons('Choose a recorded invoice price')[0]; assert.ok(open); assert.match(open.props.className, /min-h-11/);
  act(() => open.props.onClick());
  assert.equal(historyChoices().length, 1); assert.match(text(renderer!.root), /Earlier buyer/); assert.match(text(renderer!.root), /Invoice #0040/);
  assert.match(text(renderer!.root), /Prices previously recorded on invoices in EUR/);
  assert.ok(text(renderer!.root).includes(recordsDate('en', new Date(previous.dateISO), true)), 'the choice shows its actual invoice issue date');
  const money = formatRecordedMoney({ amount: 17, currency: 'EUR' }, formattingContext('en')); assert.ok(money);
  assert.ok(text(renderer!.root).includes(money.text + ' / kg'), 'the shared formatter keeps the recorded currency and exact line unit together');
  const apply = buttons('Use this recorded price'); assert.equal(apply.length, 1); assert.match(apply[0].props.className, /min-h-11/);
  assert.equal(view().state.items[0].price, 4, 'opening history does not automatically choose a price');
  act(() => apply[0].props.onClick());
  assert.equal(view().state.items[0].price, 17); assert.equal(view().state.items[0].priceFromGuide, false);
  assert.deepEqual(view().state.items[0], { ...before[0], price: 17, priceFromGuide: false }); assert.deepEqual(view().state.items[1], before[1]);
  assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes); assert.equal(probe.syncs.length, 0);
  const result = await invoke('persist'); assert.ok(result); assert.equal(rawRows().length, 3);
  const old = rawRows().find(row => row.id === previous.id)!; assert.equal((old.items as Array<{ price: number }>)[0].price, 17); assert.equal(old.billTo, previous.billTo);
  const current = rawRows().find(row => row.id === result.id)!; assert.equal(current.currencyCode, 'EUR');
  assert.deepEqual((current.items as Array<{ qty: number; unit: string; price: number }>)[0], { desc: 'Recorded produce', qty: 3, unit: 'kg', price: 17 });
  assert.equal(probe.syncs.length, 0);
});

test('history uses exact item/unit and explicit currency while retaining legitimate recorded zero', async () => {
  await ready([historical({ items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 0 }] }),
    historical({ id: 'different-unit', no: 41, items: [{ desc: 'Recorded produce', qty: 2, unit: 'crates', price: 55 }] }),
    historical({ id: 'different-spelling', no: 42, items: [{ desc: 'recorded produce', qty: 2, unit: 'kg', price: 66 }] }),
    historical({ id: 'different-currency', no: 43, currencyCode: 'ZAR' })]);
  await mount(); fill('');
  assert.equal((view().actions.recordedPricesForLine(view().state.items[0]) as InvoicePriceHistoryResult).status, 'held');
  fill('EUR'); const choices = historyChoices(); assert.equal(choices.length, 1); assert.equal(choices[0].price, 0);
  const bytes = new Map(local.rows); act(() => view().actions.applyRecordedPrice(1, choices[0]));
  assert.equal(view().state.items[0].price, 0); assert.equal(view().state.items[0].qty, 2); assert.equal(view().state.items[0].unit, 'kg'); assert.deepEqual(local.rows, bytes);
});

test('a historical unlabelled invoice can choose a Rand history price without acquiring a new currency tag', async () => {
  const legacy = historical({ id: 'legacy-target' }); delete legacy.currencyCode;
  const recorded = historical({ id: 'recorded-rand', no: 41, currencyCode: 'ZAR', items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 29 }] });
  await ready([legacy, recorded]); await mount(); await invoke('openSaved', legacy);
  assert.equal(view().state.currencyBasis.status, 'legacy-rand');
  const choice = historyChoices().find(row => row.invoiceId === recorded.id); assert.ok(choice);
  const bytes = new Map(local.rows); act(() => view().actions.applyRecordedPrice(1, choice));
  assert.equal(view().state.items[0].price, 29); assert.deepEqual(local.rows, bytes);
  assert.ok(await invoke('persist'));
  const original = rawRows().find(row => row.id === legacy.id)!;
  assert.equal(Object.hasOwn(original, 'currencyCode'), false); assert.equal((original.items as Array<{ price: number }>)[0].price, 29);
});

test('the original loaded collection reaches the kernel so hidden raw rows hold price history before filtering', async () => {
  const previous = historical(); await ready([null, previous]); await mount(); fill('EUR');
  const result: InvoicePriceHistoryResult = view().actions.recordedPricesForLine(view().state.items[0]); assert.equal(result.status, 'held');
  act(() => view().actions.togglePriceHistory(1));
  assert.match(text(renderer!.root), /Recorded invoice prices need review/); assert.equal(buttons('Use this recorded price').length, 0);
  const before = unchangedFields(), bytes = new Map(local.rows);
  const forged: InvoicePriceChoice = { invoiceId: previous.id, invoiceNo: previous.no, lineIndex: 0, desc: 'Recorded produce', unit: 'kg', price: 17,
    currencyCode: 'EUR', buyer: previous.billTo, issuedISO: previous.dateISO };
  act(() => view().actions.applyRecordedPrice(1, forged)); assert.equal(unchangedFields(), before); assert.deepEqual(local.rows, bytes);
});

test('a same-ID forged price is rejected unless every recorded choice field is rederived from the current original book', async () => {
  await ready([historical()]); await mount(); fill('EUR'); const choice = historyChoices()[0], before = unchangedFields();
  const bytes = new Map(local.rows);
  for (const changed of [{ ...choice, price: 999 }, { ...choice, currencyCode: 'USD' as const }, { ...choice, lineIndex: 1 }, { ...choice, buyer: 'Different buyer' }]) {
    act(() => view().actions.applyRecordedPrice(1, changed)); assert.equal(unchangedFields(), before);
  }
  assert.deepEqual(local.rows, bytes);
});

test('closing or reopening the price chooser withdraws its earlier Apply handler even when the invoice fields did not change', async () => {
  await ready([historical()]); await mount(); fill('EUR'); const choice = historyChoices()[0], stale = view().actions.applyRecordedPrice;
  const before = unchangedFields(), bytes = new Map(local.rows);
  act(() => view().actions.togglePriceHistory(1)); assert.equal(view().state.priceHistoryLine, null);
  act(() => stale(1, choice)); assert.equal(unchangedFields(), before);
  historyChoices(); act(() => stale(1, choice)); assert.equal(unchangedFields(), before);
  act(() => view().actions.applyRecordedPrice(1, choice)); assert.equal(view().state.items[0].price, 17);
  assert.deepEqual(local.rows, bytes);
});

test('an ambiguous draft line identity cannot apply a recorded price to two lines', async () => {
  await ready([historical()]); await mount(); fill('EUR');
  act(() => view().actions.setItems([{ id: 1, desc: 'Recorded produce', qty: 2, unit: 'kg', price: 4 },
    { id: 1, desc: 'Recorded produce', qty: 5, unit: 'kg', price: 8 }]));
  const choice = historyChoices()[0], before = unchangedFields(), bytes = new Map(local.rows);
  act(() => view().actions.applyRecordedPrice(1, choice)); assert.equal(unchangedFields(), before); assert.deepEqual(local.rows, bytes);
});

for (const field of ['notes', 'buyer', 'payment', 'reference', 'buyer-details', 'terms', 'issue-date', 'enterprise', 'letterhead'] as const) {
  test(`a ${field} edit queued before retained Apply withdraws the whole draft intent in the same React batch`, async () => {
    await ready([historical()]); await mount(); fill('EUR'); const choice = historyChoices()[0], actions = view().actions;
    const bytes = new Map(local.rows), writes = local.writes.length;
    act(() => {
      if (field === 'notes') actions.setNotes('Newer note before old Apply');
      if (field === 'buyer') actions.setBillTo('Newer buyer before old Apply');
      if (field === 'payment') actions.setPaymentStatus('paid');
      if (field === 'reference') actions.setReference('Newer reference');
      if (field === 'buyer-details') actions.setBuyerDetails({ address: 'Newer buyer address' });
      if (field === 'terms') actions.setTermsDays(14);
      if (field === 'issue-date') actions.setIssuedISO('2026-11-01T08:00:00.000Z');
      if (field === 'enterprise') actions.setEnterprise('other');
      if (field === 'letterhead') actions.setLetterhead((previous: Record<string, unknown>) => ({ ...previous, notes: 'New letterhead note' }));
      actions.applyRecordedPrice(1, choice);
    });
    assert.equal(view().state.items[0].price, 3, 'an earlier queued edit must not be blessed by an items updater running before later hooks');
    if (field === 'notes') assert.equal(view().state.notes, 'Newer note before old Apply');
    if (field === 'buyer') assert.equal(view().state.billTo, 'Newer buyer before old Apply');
    if (field === 'payment') assert.equal(view().state.paymentStatus, 'paid');
    if (field === 'reference') assert.equal(view().state.reference, 'Newer reference');
    assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes); assert.equal(probe.syncs.length, 0);
  });
}

for (const sameValue of ['unchanged', 'ABA'] as const) test(`a ${sameValue} note intent revokes the old Apply but a fresh explicit Apply remains usable`, async () => {
  await ready([historical()]); await mount(); fill('EUR'); const choice = historyChoices()[0], actions = view().actions;
  const bytes = new Map(local.rows);
  act(() => {
    if (sameValue === 'ABA') actions.setNotes('Temporary note intent');
    actions.setNotes(''); actions.applyRecordedPrice(1, choice);
  });
  assert.equal(view().state.notes, ''); assert.equal(view().state.items[0].price, 3);
  act(() => view().actions.applyRecordedPrice(1, historyChoices()[0]));
  assert.equal(view().state.items[0].price, 17, 'the current explicit choice must still reserve and complete its own intent');
  act(() => actions.applyRecordedPrice(1, choice)); assert.equal(view().state.items[0].price, 17);
  assert.deepEqual(local.rows, bytes);
});

test('a subsequent queued edit revokes an Apply reservation before its pure item updater commits', async () => {
  await ready([historical()]); await mount(); fill('EUR'); const choice = historyChoices()[0], actions = view().actions;
  const bytes = new Map(local.rows);
  act(() => { actions.applyRecordedPrice(1, choice); actions.setNotes('A later queued draft edit'); });
  assert.equal(view().state.notes, 'A later queued draft edit'); assert.equal(view().state.items[0].price, 3);
  act(() => view().actions.applyRecordedPrice(1, historyChoices()[0])); assert.equal(view().state.items[0].price, 17);
  assert.deepEqual(local.rows, bytes);
});

test('a same-price Apply consumes its own intent without disabling a fresh explicit selection', async () => {
  await ready([historical(), historical({ id: 'another-price', no: 41, items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 29 }] })]);
  await mount(); fill('EUR'); act(() => view().actions.updateItem(1, { price: 17, priceFromGuide: false }));
  const choices = historyChoices(), same = choices.find(row => row.price === 17), different = choices.find(row => row.price === 29);
  assert.ok(same); assert.ok(different); const oldPanelApply = view().actions.applyRecordedPrice, bytes = new Map(local.rows);
  act(() => oldPanelApply(1, same)); assert.equal(view().state.items[0].price, 17);
  act(() => oldPanelApply(1, different)); assert.equal(view().state.items[0].price, 17, 'the earlier panel callbacks must be consumed even when price did not change');
  act(() => view().actions.applyRecordedPrice(1, different)); assert.equal(view().state.items[0].price, 29);
  assert.deepEqual(local.rows, bytes);
});

for (const change of ['quantity', 'description', 'unit', 'currency', 'raw', 'actor-ABA', 'sample-ABA', 'New', 'Open'] as const) {
  test(`a retained recorded-price click cannot apply after ${change} changed its original line, source or draft`, async () => {
    const previous = historical(), other = historical({ id: 'other-open', no: 41, items: [{ desc: 'Recorded produce', qty: 2, unit: 'kg', price: 91 }] });
    await ready([previous, other]); await mount(); fill('EUR'); const choice = historyChoices()[0], stale = view().actions.applyRecordedPrice;
    if (change === 'quantity') act(() => view().actions.updateItem(1, { qty: 7, price: 8 }));
    if (change === 'description') act(() => view().actions.updateItem(1, { desc: 'Changed recorded product', price: 8 }));
    if (change === 'unit') act(() => view().actions.updateItem(1, { unit: 'crates', price: 8 }));
    if (change === 'currency') act(() => { view().actions.changeCurrency('USD'); view().actions.updateItem(1, { price: 8 }); });
    if (change === 'raw') {
      const source = model.readInvoiceBook(); retainedBooks.add(source);
      const changed = model.saveInvoice({ ...source.invoices[0], notes: 'Changed elsewhere' }, source);
      assert.equal(changed.status, 'written'); if (changed.status !== 'written') throw Error('Source change needs its receipt'); retainedBooks.add(changed.book);
    }
    if (change === 'actor-ABA') act(() => { actor('owner-b'); actor('owner-a'); });
    if (change === 'sample-ABA') act(() => { sample(true); sample(false); });
    if (change === 'New') { await invoke('newInvoice'); fill('EUR'); act(() => view().actions.updateItem(1, { price: 8 })); }
    if (change === 'Open') await invoke('openSaved', other);
    const before = unchangedFields(), bytes = new Map(local.rows), writes = local.writes.length;
    act(() => stale(1, choice));
    assert.equal(unchangedFields(), before); assert.deepEqual(local.rows, bytes); assert.equal(local.writes.length, writes); assert.equal(probe.syncs.length, 0);
  });
}

test('readonly invoice history cannot authorize applying a price even when the saved rows remain readable', async () => {
  const previous = historical(); await ready([previous]); storage.releaseAllDocumentInvoiceLeases(); await new Promise<void>(resolve => setImmediate(resolve));
  await mount(); await invoke('openSaved', previous); assert.equal(view().state.bookReady, false);
  const control = buttons('Choose a recorded invoice price')[0]; assert.ok(control); assert.equal(control.props.disabled, true);
  const before = unchangedFields(), bytes = new Map(local.rows);
  act(() => view().actions.applyRecordedPrice(1, { invoiceId: previous.id, invoiceNo: previous.no, lineIndex: 0, desc: 'Recorded produce', unit: 'kg',
    price: 99, currencyCode: 'EUR', buyer: previous.billTo, issuedISO: previous.dateISO }));
  assert.equal(unchangedFields(), before); assert.deepEqual(local.rows, bytes);
});

test('an already-linked invoice cannot change its locked financial facts through recorded-price selection', async () => {
  const previous = historical({ sourceSaleId: 'recorded-sale', status: 'paid', paidAt: '2026-11-01T09:00:00.000Z' });
  await ready([previous]); await mount(); await invoke('openSaved', previous);
  assert.equal(buttons('Choose a recorded invoice price').length, 0);
  const result: InvoicePriceHistoryResult = view().actions.recordedPricesForLine(view().state.items[0]); assert.equal(result.status, 'ready');
  const before = unchangedFields(), bytes = new Map(local.rows);
  act(() => view().actions.applyRecordedPrice(1, result.choices[0]));
  assert.equal(unchangedFields(), before); assert.deepEqual(local.rows, bytes);
});
