import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import type { InvoiceBookRead, SavedInvoice } from '../lib/invoices';
import type { InvoiceStorageLocks } from '../lib/invoice-storage';
import ts from 'typescript';
import { invoiceRandConsumerEligibility } from '../lib/invoice-currency';

import { recordedSaleInvoiceError } from '../lib/invoice-entry';
import { UserFacingError } from '../lib/user-facing-error';

const actorProbe = { uid: 'owner' as string | null, listeners: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __invoiceCloudSourceActor: actorProbe });
const library = new URL('../lib/', import.meta.url).href;
const codeUrl = (code: string) => ({ shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(code)}` });
const modelHook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(library) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return codeUrl(`
    const p=globalThis.__invoiceCloudSourceActor;
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){return p.uid?{uid:p.uid}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return codeUrl(`
    const p=globalThis.__invoiceCloudSourceActor;
    export const onAuthStateChanged=(_auth,next,error)=>{p.listeners.add(next);p.errors.add(error);return()=>{p.listeners.delete(next);p.errors.delete(error);};};`);
  return next(specifier, context);
} });
const { invoiceSaleDocumentId, invoiceSalesForPaidInvoice } = await import('../lib/invoice-sales');
const model = await import('../lib/invoices');
const store = await import('../lib/invoice-storage');
const account = await import('../lib/account-local-storage');
const sampleModel = await import('../lib/sample-mode');
after(() => { modelHook.deregister(); Reflect.deleteProperty(globalThis, '__invoiceCloudSourceActor'); });

const source = readFileSync(new URL('../lib/db/queries.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('queries.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
type Handler = 'syncInvoiceSales' | 'linkInvoiceToRecordedSale';
const functionNode = (name: string) => {
  const node = tree.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(node?.body, `actual ${name} declaration must remain inspectable`);
  return node;
};
const functionText = (name: string, removeGuard = false, removeSourceChecks = false) => {
  const node = functionNode(name);
  let text = node.getText(tree);
  if (removeGuard) {
    const guard = node.body!.statements[0];
    assert.ok(ts.isIfStatement(guard) && guard.expression.getText(tree).includes('invoiceRandConsumerEligibility'));
    text = text.slice(0, guard.getStart(tree) - node.getStart(tree)) + text.slice(guard.end - node.getStart(tree));
  }
  if (removeSourceChecks) {
    const spans: Array<[number, number]> = [];
    const visit = (child: ts.Node) => {
      if (ts.isExpressionStatement(child) && ts.isCallExpression(child.expression)
        && ts.isIdentifier(child.expression.expression) && child.expression.expression.text === 'requireInvoiceSaleSource') {
        spans.push([child.getStart(tree) - node.getStart(tree), child.end - node.getStart(tree)]);
      }
      ts.forEachChild(child, visit);
    };
    visit(node);
    assert.ok(spans.length, 'damaged-source control must remove real source guards');
    for (const [start, end] of spans.sort((a,b)=>b[0]-a[0])) text = text.slice(0,start) + text.slice(end);
  }
  return text.replace(/^export\s+/, '');
};
const accountDeclarations = ['fb', 'uid'].map(name => {
  const node = tree.statements.find(statement => ts.isVariableStatement(statement)
    && statement.declarationList.declarations.some(declaration => declaration.name.getText(tree) === name));
  assert.ok(node, `actual ${name} binding must remain inspectable`);
  return node.getText(tree);
}).join('\n');
function compileActual<T>(text: string, exports: string[], dependencies: Record<string, unknown>): T {
  const js = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(dependencies), `${js}\nreturn {${exports.join(',')}};`)(...Object.values(dependencies)) as T;
}

const operations = ['firebase', 'sampleCheck', 'sampleRead', 'sampleProfile', 'sampleAdd', 'sampleDelete', 'sampleUpdate',
  'collection', 'doc', 'where', 'query', 'getDoc', 'getDocs', 'profile', 'batch', 'batchSet', 'batchDelete', 'batchCommit',
  'timestamp', 'transaction', 'transactionGet', 'transactionDelete', 'transactionUpdate', 'transactionCommit'] as const;
type Counts = Record<typeof operations[number], number>;
type Row = Record<string, unknown>;
const invoice = (extra: Row = {}): Row => ({ id: 'invoice-a', no: 1, billTo: 'Buyer', total: 20,
  dateISO: '2026-09-01T12:00:00Z', paidAt: '2026-09-02T12:00:00Z', status: 'paid',
  items: [{ desc: 'Recorded produce', qty: 4, unit: 'kg', price: 5 }], ...extra });

class SourceMemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
}
class SourceLocks implements InvoiceStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
function observeActor(uid: string | null) {
  actorProbe.uid = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const listener of [...actorProbe.listeners]) listener(uid ? { uid } : null);
}
async function withActualSource(sample: boolean, rawInvoice: Row, run: (fixture: {
  row: SavedInvoice; book: InvoiceBookRead; changeBook: () => void; aba: () => void;
}) => Promise<void>, options: { pending?: boolean } = {}) {
  const original = new Map(['window', 'localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new SourceMemoryStorage(), session = new SourceMemoryStorage(), locks = new SourceLocks();
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  const books = new Set<InvoiceBookRead>();
  store.releaseAllDocumentInvoiceLeases(); await Promise.resolve();
  observeActor('owner');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  try {
    if (sample) {
      session.rows.set('imbewu_sample_mode', '1');
      sampleModel.setSandboxInvoices(options.pending ? [] : [rawInvoice as unknown as SavedInvoice]);
      sampleModel.setSandboxPendingInvoiceLinks(options.pending ? [rawInvoice as unknown as SavedInvoice] : []);
    } else {
      local.rows.set(account.activeAccountLocalStorageKey(store.INVOICE_LEGACY_KEY), JSON.stringify(options.pending ? [] : [rawInvoice]));
      local.rows.set(account.activeAccountLocalStorageKey(store.INVOICE_PENDING_LEGACY_KEY), JSON.stringify(options.pending ? [rawInvoice] : []));
      assert.equal((await store.initialiseInvoiceStorage(undefined, locks)).writable, true);
    }
    const book = model.readInvoiceBook(); books.add(book);
    assert.equal(model.invoiceBookIsCurrent(book), true, 'source must be admitted by actual canonical/sample model');
    assert.equal(book.invoices.length, options.pending ? 0 : 1);
    assert.equal(book.pendingLinks.length, options.pending ? 1 : 0);
    const row = options.pending ? book.pendingLinks[0] : book.invoices[0];
    await run({ row, book,
      changeBook() {
        const result = row.sourceSaleId
          ? model.saveInvoice({ ...row, id: 'later-local-invoice', no: 2, currencyCode: 'ZAR', sourceSaleId: undefined, status: 'unpaid', paidAt: undefined }, book)
          : model.setInvoiceStatus(row.id, 'unpaid', undefined, undefined, book);
        assert.equal(result.status, 'written', 'the changed-source control performs a real local write');
        if (result.status !== 'written') throw Error('Expected changed local book');
        books.add(result.book); assert.equal(model.invoiceBookIsCurrent(book), false);
      },
      aba() {
        assert.ok(actorProbe.listeners.size > 0, 'actual model must observe auth transitions');
        observeActor('other-owner'); observeActor('owner');
        assert.equal(model.invoiceBookIsCurrent(book), false, 'same restored uid cannot revive original epoch');
      },
    });
  } finally {
    for (const book of books) model.releaseInvoiceBook(book);
    store.releaseAllDocumentInvoiceLeases(); win.dispatchEvent(new Event('pagehide')); await Promise.resolve();
    account.bindMountedAccountLocalStorageUid(null); actorProbe.uid = 'owner';
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function harness(sample: boolean, damaged?: Handler, removeSourceChecks = false) {
  const counts = Object.fromEntries(operations.map(name => [name, 0])) as Counts;
  const mark = (name: keyof Counts) => { counts[name]++; };
  const owner = sample ? 'demo' : 'owner';
  const sourceSale: Row = { id: 'manual-a', profile_id: owner, garden_id: null, crop: 'Recorded produce', kg: 4,
    amount: 20, buyer: 'Buyer', sold_at: '2026-09-02T12:00:00Z', created_at: '2026-09-02T12:00:00Z' };
  const sandbox: Row[] = [structuredClone(sourceSale), { id: 'stale-generated', invoice_id: 'invoice-a' }];
  const writes: Row[] = [], updates: Row[] = [];
  type Boundary = 'getDocs' | 'getDoc' | 'transactionGet';
  const gates = new Map<Boundary, { entered: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>>; used: boolean; skip: number }>();
  const controls: { afterBatchSet?: () => void; retryTransaction?: () => void } = {};
  const gate = (boundary: Boundary, skip = 0) => {
    const value = { entered: deferred<void>(), release: deferred<void>(), used: false, skip }; gates.set(boundary, value); return value;
  };
  const pause = async (boundary: Boundary) => {
    const value = gates.get(boundary);
    if (value?.skip) { value.skip--; return; }
    if (value && !value.used) { value.used = true; value.entered.resolve(); await value.release.promise; }
  };
  const existing = [{ id: 'stale-generated', ref: { id: 'stale-generated' }, data: () => ({ profile_id: owner, invoice_id: 'invoice-a' }) }];
  const dependencies = {
    UserFacingError, invoiceRandConsumerEligibility, invoiceSalesForPaidInvoice, invoiceSaleDocumentId, recordedSaleInvoiceError,
    invoiceBookIsCurrent: model.invoiceBookIsCurrent,
    getFirebase: () => { mark('firebase'); return { db: {}, auth: { currentUser: actorProbe.uid ? { uid: actorProbe.uid } : null } }; },
    isSampleMode: () => { mark('sampleCheck'); return sample; },
    getSandboxProfile: () => { mark('sampleProfile'); return { id: owner, org_id: null }; },
    getSandboxSales: () => { mark('sampleRead'); return sandbox; },
    deleteSandboxSale: (id: string) => { mark('sampleDelete'); const index = sandbox.findIndex(row => row.id === id); if (index >= 0) sandbox.splice(index, 1); },
    addSandboxSale: (row: Row) => { mark('sampleAdd'); sandbox.push(row); },
    updateSandboxSale: (id: string, patch: Row) => { mark('sampleUpdate'); updates.push(patch); Object.assign(sandbox.find(row => row.id === id)!, patch); },
    collection: (_db: unknown, name: string) => { mark('collection'); return { name }; },
    doc: (_db: unknown, name: string, id: string) => { mark('doc'); return { name, id }; },
    where: (...args: unknown[]) => { mark('where'); return args; },
    query: (...args: unknown[]) => { mark('query'); return args; },
    getDoc: async () => { mark('getDoc'); await pause('getDoc'); return { exists: () => true, data: () => ({ org_id: null }) }; },
    getDocs: async () => { mark('getDocs'); await pause('getDocs'); return { docs: existing }; },
    serverTimestamp: () => { mark('timestamp'); return 'test-server-timestamp'; },
    writeBatch: () => {
      mark('batch');
      return { delete: () => mark('batchDelete'), set: (_ref: unknown, row: Row) => { mark('batchSet'); writes.push(row); controls.afterBatchSet?.(); },
        commit: async () => { mark('batchCommit'); } };
    },
    runTransaction: async (_db: unknown, action: (transaction: unknown) => Promise<unknown>) => {
      mark('transaction');
      const transaction = { get: async (ref: { id: string }) => { mark('transactionGet'); await pause('transactionGet');
        return { id: ref.id, exists: () => true, data: () => ref.id === sourceSale.id ? ({ ...sourceSale }) : ({ profile_id: owner, invoice_id: 'invoice-a' }) }; },
        delete: () => mark('transactionDelete'), update: (_ref: unknown, patch: Row) => { mark('transactionUpdate'); updates.push(patch); } };
      let result = await action(transaction);
      if (controls.retryTransaction) { controls.retryTransaction(); result = await action(transaction); }
      mark('transactionCommit'); return result;
    },
  };
  const profile = compileActual<{ getMyProfile: () => Promise<unknown> }>(`${accountDeclarations}\n${functionText('getMyProfile')}`, ['getMyProfile'], dependencies);
  const handlers = compileActual<Record<Handler, (value: unknown, source?: InvoiceBookRead, sourceIsCurrent?: () => boolean) => Promise<void>>>(`${accountDeclarations}\n${functionText('requireInvoiceSaleSource')}\n${functionText('syncInvoiceSales', damaged === 'syncInvoiceSales', removeSourceChecks)}\n${functionText('linkInvoiceToRecordedSale', damaged === 'linkInvoiceToRecordedSale', removeSourceChecks)}`,
    ['syncInvoiceSales', 'linkInvoiceToRecordedSale'], { ...dependencies, getMyProfile: () => { mark('profile'); return profile.getMyProfile(); } });
  return { counts, handlers, sandbox, writes, updates, sourceSale, existing, gate, controls };
}
function assertUntouched(counts: Counts) {
  assert.deepEqual(counts, Object.fromEntries(operations.map(name => [name, 0])), 'currency hold must precede every Firebase/profile/sample boundary');
}
async function expectHeld(action: () => Promise<void>) {
  await assert.rejects(action, error => error instanceof UserFacingError && /currency|currencies/.test(error.message));
}
async function expectSourceHeld(action: () => Promise<void>) {
  await assert.rejects(action, error => error instanceof UserFacingError && /records or workspace changed/.test(error.message));
}
async function entered(gate: { entered: ReturnType<typeof deferred<void>>; release: ReturnType<typeof deferred<void>> }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([gate.entered.promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { gate.release.resolve(); reject(Error('Actual handler did not reach the intended deferred boundary')); }, 2000);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

test('every supported foreign currency and malformed-present basis stops normal sync, source-sale sync and direct links before all I/O', async () => {
  const heldCodes = ['KES', 'GBP', 'USD', 'EUR', 'BRL', undefined, null, '', 'zar', ' ZAR', 'CAD', 710, {}, []];
  for (const sample of [false, true]) for (const currencyCode of heldCodes) {
    for (const [handler, linked] of [['syncInvoiceSales', false], ['syncInvoiceSales', true], ['linkInvoiceToRecordedSale', true]] as const) {
      const probe = harness(sample);
      const before = structuredClone(probe.sandbox);
      await expectHeld(() => probe.handlers[handler](invoice({ currencyCode, ...(linked ? { sourceSaleId: 'manual-a' } : {}) })));
      assertUntouched(probe.counts);
      assert.deepEqual(probe.sandbox, before); assert.deepEqual(probe.writes, []); assert.deepEqual(probe.updates, []);
    }
  }
});

test('held currency accessors and retained source-sale getters never execute in either actual entry point', async () => {
  for (const sample of [false, true]) for (const handler of ['syncInvoiceSales', 'linkInvoiceToRecordedSale'] as const) {
    let currencyGets = 0, sourceGets = 0;
    const accessor = invoice();
    Object.defineProperty(accessor, 'currencyCode', { enumerable: true, get() { currencyGets++; return 'ZAR'; } });
    Object.defineProperty(accessor, 'sourceSaleId', { enumerable: true, get() { sourceGets++; throw Error('must not inspect held source'); } });
    const probe = harness(sample);
    await expectHeld(() => probe.handlers[handler](accessor));
    assert.equal(currencyGets, 0); assert.equal(sourceGets, 0); assertUntouched(probe.counts);
    const foreign = invoice({ currencyCode: 'KES' });
    Object.defineProperty(foreign, 'sourceSaleId', { get() { sourceGets++; throw Error('source getter must stay untouched'); } });
    await expectHeld(() => probe.handlers[handler](foreign));
    assert.equal(sourceGets, 0); assertUntouched(probe.counts);
  }
});

test('legacy and explicitly recorded rand reach the actual normal cloud batch and sample replacement paths', async () => {
  for (const sample of [false, true]) for (const basis of [{}, { currencyCode: 'ZAR' }]) await withActualSource(sample, invoice(basis), async ({ row, book }) => {
    const probe = harness(sample);
    await probe.handlers.syncInvoiceSales(row, book);
    if (sample) {
      assert.equal(probe.counts.sampleDelete, 1); assert.equal(probe.counts.sampleAdd, 1);
      assert.equal(probe.counts.firebase, 0);
      assert.equal(probe.sandbox.find(row => row.invoice_id === 'invoice-a')!.amount, 20);
    } else {
      assert.equal(probe.counts.getDocs, 1); assert.equal(probe.counts.profile, 1); assert.equal(probe.counts.getDoc, 1);
      assert.equal(probe.counts.batchDelete, 1); assert.equal(probe.counts.batchSet, 1); assert.equal(probe.counts.batchCommit, 1);
      assert.equal(probe.writes[0].amount, 20); assert.equal(probe.writes[0].kg, 4); assert.equal(probe.writes[0].profile_id, 'owner');
      assert.equal(probe.counts.sampleAdd + probe.counts.sampleDelete + probe.counts.sampleUpdate, 0);
    }
  });
});

test('both legitimate source-sale entry points retain the real recorded-sale amount, date and quantity', async () => {
  for (const sample of [false, true]) for (const basis of [{}, { currencyCode: 'ZAR' }]) for (const handler of ['syncInvoiceSales', 'linkInvoiceToRecordedSale'] as const) await withActualSource(sample, invoice({ ...basis, sourceSaleId: 'manual-a' }), async ({ row, book }) => {
    const probe = harness(sample), before = structuredClone(probe.sourceSale);
    await probe.handlers[handler](row, book);
    assert.deepEqual(probe.updates, [{ invoice_id: 'invoice-a', invoice_line: 0, invoice_source_sale: true }]);
    assert.deepEqual(probe.sourceSale, before);
    if (sample) {
      const linked = probe.sandbox.find(row => row.id === 'manual-a')!;
      for (const key of ['amount', 'kg', 'sold_at', 'profile_id']) assert.equal(linked[key], before[key]);
      assert.equal(probe.counts.sampleUpdate, 1); assert.equal(probe.counts.firebase, 0);
    } else {
      assert.equal(probe.counts.transaction, 1); assert.equal(probe.counts.transactionGet, 1); assert.equal(probe.counts.transactionUpdate, 1);
      assert.equal(probe.counts.batch + probe.counts.batchSet + probe.counts.batchDelete + probe.counts.profile, 0);
    }
  });
});

test('the exact actual pending-link row is a legitimate source before its saved invoice exists', async () => {
  for (const sample of [false, true]) for (const handler of ['syncInvoiceSales', 'linkInvoiceToRecordedSale'] as const) {
    await withActualSource(sample, invoice({ currencyCode: 'ZAR', sourceSaleId: 'manual-a' }), async ({ row, book }) => {
      assert.equal(book.invoices.length, 0); assert.equal(book.pendingLinks[0], row);
      const probe = harness(sample);
      await probe.handlers[handler](row, book);
      assert.deepEqual(probe.updates, [{ invoice_id: 'invoice-a', invoice_line: 0, invoice_source_sale: true }]);
      if (sample) { assert.equal(probe.counts.sampleUpdate, 1); assert.equal(probe.counts.firebase, 0); }
      else { assert.equal(probe.counts.transactionUpdate, 1); assert.equal(probe.counts.transactionCommit, 1); }
    }, { pending: true });
  }
});

test('removing the actual sync preflight makes the zero-side-effect invariant fail and can delete sample sale evidence', async () => {
  for (const sample of [false, true]) await withActualSource(sample, invoice({ currencyCode: 'KES' }), async ({ row, book }) => {
    const damaged = harness(sample, 'syncInvoiceSales');
    await damaged.handlers.syncInvoiceSales(row, book);
    assert.throws(() => assertUntouched(damaged.counts), assert.AssertionError);
    if (sample) {
      assert.equal(damaged.counts.sampleDelete, 1); assert.equal(damaged.counts.sampleAdd, 0);
      assert.equal(damaged.sandbox.some(row => row.id === 'stale-generated'), false);
    } else {
      assert.equal(damaged.counts.getDocs, 1); assert.equal(damaged.counts.profile, 1);
      assert.equal(damaged.counts.batchDelete, 1); assert.equal(damaged.counts.batchSet, 0); assert.equal(damaged.counts.batchCommit, 1);
    }
  });
});

test('removing the actual direct-link preflight is caught even though the deeper real source validator also refuses foreign cash', async () => {
  for (const sample of [false, true]) await withActualSource(sample, invoice({ currencyCode: 'KES', sourceSaleId: 'manual-a' }), async ({ row, book }) => {
    const damaged = harness(sample, 'linkInvoiceToRecordedSale');
    await expectHeld(() => damaged.handlers.linkInvoiceToRecordedSale(row, book));
    assert.throws(() => assertUntouched(damaged.counts), assert.AssertionError);
    assert.equal(damaged.counts.sampleUpdate + damaged.counts.transactionUpdate, 0);
    if (sample) assert.equal(damaged.counts.sampleRead, 1);
    else { assert.equal(damaged.counts.getDocs, 1); assert.equal(damaged.counts.transactionGet, 1); }
  });
});

test('a missing original book, detached same-ID invoice or withdrawn originating form cannot reach any cloud or sample adapter', async () => {
  for (const sample of [false, true]) for (const handler of ['syncInvoiceSales', 'linkInvoiceToRecordedSale'] as const) {
    await withActualSource(sample, invoice({ currencyCode: 'ZAR', ...(handler === 'linkInvoiceToRecordedSale' ? { sourceSaleId: 'manual-a' } : {}) }), async ({ row, book }) => {
      const probe = harness(sample);
      await expectSourceHeld(() => probe.handlers[handler](row)); assertUntouched(probe.counts);
      await expectSourceHeld(() => probe.handlers[handler]({ ...row }, book)); assertUntouched(probe.counts);
      await expectSourceHeld(() => probe.handlers[handler](row, book, () => false)); assertUntouched(probe.counts);
      const fresh = model.readInvoiceBook();
      try {
        assert.equal(model.invoiceBookIsCurrent(book), true); assert.equal(model.invoiceBookIsCurrent(fresh), true);
        await expectSourceHeld(() => probe.handlers[handler](row, fresh)); assertUntouched(probe.counts);
      } finally { model.releaseInvoiceBook(fresh); }
      let sourceGets = 0;
      const detached = { ...row };
      Object.defineProperty(detached, 'sourceSaleId', { get() { sourceGets++; throw Error('Detached source must not be inspected'); } });
      await expectSourceHeld(() => probe.handlers[handler](detached, book));
      assert.equal(sourceGets, 0); assertUntouched(probe.counts);
    });
  }
});

test('actual actor ABA and same-actor canonical changes during invoice lookup stop before a profile read or transaction', async () => {
  for (const mode of ['aba', 'raw', 'form'] as const) for (const [handler, linked] of [['syncInvoiceSales', false], ['syncInvoiceSales', true], ['linkInvoiceToRecordedSale', true]] as const) {
    await withActualSource(false, invoice({ currencyCode: 'ZAR', ...(linked ? { sourceSaleId: 'manual-a' } : {}) }), async ({ row, book, aba, changeBook }) => {
      const probe = harness(false), gate = probe.gate('getDocs'); let formCurrent = true;
      const task = probe.handlers[handler](row, book, () => formCurrent); void task.catch(() => {});
      await entered(gate);
      if (mode === 'aba') aba(); else if (mode === 'raw') changeBook(); else formCurrent = false;
      gate.release.resolve(); await expectSourceHeld(() => task);
      assert.equal(probe.counts.getDocs, 1);
      assert.equal(probe.counts.profile + probe.counts.getDoc + probe.counts.batch + probe.counts.transaction, 0);
      assert.equal(probe.counts.batchCommit + probe.counts.transactionCommit, 0);
    });
  }
});

test('a withdrawn raw book or form while the actual profile read awaits cannot queue an invoice batch', async () => {
  for (const mode of ['aba', 'raw', 'form'] as const) await withActualSource(false, invoice({ currencyCode: 'ZAR' }), async ({ row, book, aba, changeBook }) => {
    const probe = harness(false), gate = probe.gate('getDoc'); let formCurrent = true;
    const task = probe.handlers.syncInvoiceSales(row, book, () => formCurrent); void task.catch(() => {});
    await entered(gate);
    if (mode === 'aba') aba(); else if (mode === 'raw') changeBook(); else formCurrent = false;
    gate.release.resolve(); await expectSourceHeld(() => task);
    assert.equal(probe.counts.getDocs, 1); assert.equal(probe.counts.profile, 1); assert.equal(probe.counts.getDoc, 1);
    assert.equal(probe.counts.batch + probe.counts.batchCommit + probe.counts.batchSet + probe.counts.batchDelete, 0);
  });
});

test('the last source check prevents committing a staged batch after synchronous source withdrawal', async () => {
  for (const mode of ['raw', 'form'] as const) await withActualSource(false, invoice({ currencyCode: 'ZAR' }), async ({ row, book, changeBook }) => {
    const probe = harness(false); let formCurrent = true;
    probe.controls.afterBatchSet = () => { if (mode === 'raw') changeBook(); else formCurrent = false; };
    await expectSourceHeld(() => probe.handlers.syncInvoiceSales(row, book, () => formCurrent));
    assert.equal(probe.counts.batch, 1); assert.equal(probe.counts.batchSet, 1); assert.equal(probe.counts.batchDelete, 1);
    assert.equal(probe.counts.batchCommit, 0, 'batch preparation is not a remote commit');
  });
});

test('withdrawal during a transaction source read prevents the next duplicate read and all mutation', async () => {
  for (const mode of ['aba', 'raw', 'form'] as const) await withActualSource(false, invoice({ currencyCode: 'ZAR', sourceSaleId: 'manual-a' }), async ({ row, book, aba, changeBook }) => {
    const probe = harness(false), gate = probe.gate('transactionGet'); let formCurrent = true;
    const id = invoiceSaleDocumentId('owner', row.id, 0);
    probe.existing.push({ id, ref: { id }, data: () => ({ profile_id: 'owner', invoice_id: row.id }) });
    const task = probe.handlers.linkInvoiceToRecordedSale(row, book, () => formCurrent); void task.catch(() => {});
    await entered(gate);
    if (mode === 'aba') aba(); else if (mode === 'raw') changeBook(); else formCurrent = false;
    gate.release.resolve(); await expectSourceHeld(() => task);
    assert.equal(probe.counts.transactionGet, 1, 'stale source cannot initiate the subsequent duplicate read');
    assert.equal(probe.counts.transactionUpdate + probe.counts.transactionDelete + probe.counts.transactionCommit, 0);
  });
});

test('a deferred duplicate read cannot delete or update after source withdrawal, while a current transaction reconciles it', async () => {
  for (const mode of ['current', 'aba', 'raw', 'form'] as const) await withActualSource(false, invoice({ currencyCode: 'ZAR', sourceSaleId: 'manual-a' }), async ({ row, book, aba, changeBook }) => {
    const probe = harness(false), gate = probe.gate('transactionGet', 1); let formCurrent = true;
    const id = invoiceSaleDocumentId('owner', row.id, 0);
    probe.existing.push({ id, ref: { id }, data: () => ({ profile_id: 'owner', invoice_id: row.id }) });
    const task = probe.handlers.linkInvoiceToRecordedSale(row, book, () => formCurrent); void task.catch(() => {});
    await entered(gate);
    if (mode === 'aba') aba(); else if (mode === 'raw') changeBook(); else if (mode === 'form') formCurrent = false;
    gate.release.resolve();
    if (mode === 'current') {
      await task;
      assert.equal(probe.counts.transactionDelete, 1); assert.equal(probe.counts.transactionUpdate, 1); assert.equal(probe.counts.transactionCommit, 1);
    } else {
      await expectSourceHeld(() => task);
      assert.equal(probe.counts.transactionDelete + probe.counts.transactionUpdate + probe.counts.transactionCommit, 0);
    }
    assert.equal(probe.counts.transactionGet, 2);
  });
});

test('each actual transaction retry rechecks original source and form before reading again or committing', async () => {
  for (const mode of ['aba', 'raw', 'form'] as const) await withActualSource(false, invoice({ currencyCode: 'ZAR', sourceSaleId: 'manual-a' }), async ({ row, book, aba, changeBook }) => {
    const probe = harness(false); let formCurrent = true;
    probe.controls.retryTransaction = () => { if (mode === 'aba') aba(); else if (mode === 'raw') changeBook(); else formCurrent = false; };
    await expectSourceHeld(() => probe.handlers.linkInvoiceToRecordedSale(row, book, () => formCurrent));
    assert.equal(probe.counts.transactionGet, 1); assert.equal(probe.counts.transactionUpdate, 1, 'first attempt only stages its update');
    assert.equal(probe.counts.transactionCommit, 0, 'an abandoned transaction attempt is not a remote write');
  });
});

test('removing the real source checks reproduces an old paid batch commit after actual actor ABA or local status change', async () => {
  for (const mode of ['aba', 'raw', 'form'] as const) await withActualSource(false, invoice({ currencyCode: 'ZAR' }), async ({ row, book, aba, changeBook }) => {
    const damaged = harness(false, undefined, true), gate = damaged.gate('getDocs'); let formCurrent = true;
    const task = damaged.handlers.syncInvoiceSales(row, book, () => formCurrent); void task.catch(() => {});
    await entered(gate);
    if (mode === 'aba') aba(); else if (mode === 'raw') changeBook(); else formCurrent = false;
    gate.release.resolve(); await task;
    assert.equal(damaged.counts.batchCommit, 1); assert.equal(damaged.counts.batchSet, 1);
    assert.equal(damaged.writes[0].amount, 20);
    assert.throws(() => assert.equal(damaged.counts.batchCommit, 0), assert.AssertionError, 'the stale-source no-commit invariant must fail with the guard removed');
  });
});
