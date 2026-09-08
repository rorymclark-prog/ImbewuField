import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

import type { SavedInvoice } from '../lib/invoices.ts';
import type { SalesLog } from '../lib/db/types.ts';
import { invoiceDateInput, invoiceDateFromInput, invoiceEntryError, recordedSaleInvoiceError } from '../lib/invoice-entry.ts';

const accountHarness: { currentUid: string | null } = { currentUid: null };
Object.assign(globalThis, { __imbewuInvoiceAccountHarness: accountHarness });
const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const harness = globalThis.__imbewuInvoiceAccountHarness;
export const getFirebase = () => ({
  auth: { currentUser: harness.currentUid ? { uid: harness.currentUid } : null },
});
export const isBackendConfigured = () => Boolean(harness.currentUid);
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      context.parentURL?.includes('/lib/account-local-storage.ts')
      && specifier === './firebase/init'
    ) {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const {
  addCustomer,
  addProduct,
  deleteInvoice,
  invoiceId,
  loadCustomers,
  loadInvoices,
  loadNextInvoiceNumber,
  loadProducts,
  paymentMethodLabel,
  saveInvoice,
  saveNextInvoiceNumber,
  setInvoiceStatus,
  stageInvoiceSaleLink, loadPendingInvoiceLinks, clearPendingInvoiceLink,
} = await import('../lib/invoices.ts');
const {
  CROP_ENTRY_OPTIONS,
  cropEntryOption,
  perennialEntryOption,
  produceEntryOption,
  loadCustomCropNames,
  saveCustomCropName,
} = await import('../lib/crop-entry.ts');
const {
  cashLedgerSales,
  cashIncomeTotal,
  invoiceSaleDocumentId,
  invoiceSalesForPaidInvoice,
} = await import('../lib/invoice-sales.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

class MemoryStorage {
  rows = new Map<string, string>();
  failWrites = false;
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('quota');
    this.rows.set(String(key), String(value));
  }
  removeItem(key: string) { this.rows.delete(key); }
}

function installBrowser() {
  accountHarness.currentUid = null;
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const target = new EventTarget() as EventTarget & {
    localStorage: MemoryStorage;
    sessionStorage: MemoryStorage;
  };
  target.localStorage = local;
  target.sessionStorage = session;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  return { local, target };
}

function invoice(overrides: Partial<SavedInvoice> = {}): SavedInvoice {
  return {
    id: 'invoice-1',
    no: 1,
    billTo: 'Customer',
    items: [{ desc: 'Spinach', qty: 2, unit: 'bunches', price: 15 }],
    total: 30,
    dateISO: '2026-01-02T00:00:00.000Z',
    status: 'unpaid',
    ...overrides,
  };
}

const linkedSale = (): SalesLog => ({
  id: 'picked-sale-17', profile_id: 'farmer-a', garden_id: 'garden-1',
  crop: 'Cabbage', kg: 12.5, amount: 112.5, buyer: 'Spaza shop',
  sold_at: '2026-06-24T08:37:00.000Z', created_at: '2026-06-24T08:39:00.000Z', enterprise: 'vegetables',
});
const linkedInvoice = (): SavedInvoice => invoice({
  id: 'linked-invoice', sourceSaleId: 'picked-sale-17', no: 44,
  entryKind: 'paper-copy', paperReference: 'P-091', reference: 'BUYER-5',
  items: [{ desc: 'Cabbage', qty: 12.5, unit: 'kg', price: 9 }], total: 112.5,
  status: 'paid', paidAt: '2026-06-24T08:37:00.000Z', enterprise: 'vegetables',
});

test('retrospective invoice dates preserve the actual payment timestamp and reject impossible calendar dates', () => {
  const paid = linkedSale().sold_at;
  assert.equal(invoiceDateFromInput(invoiceDateInput(paid), paid), paid);
  assert.equal(invoiceDateFromInput('2026-02-30'), null);
  assert.equal(invoiceDateFromInput(''), null);
  assert.match(invoiceEntryError({ ...linkedInvoice(), paperReference: '' })!, /paper invoice/);
  assert.match(invoiceEntryError({ ...linkedInvoice(), paidAt: '2099-01-01' })!, /payment/);
  installBrowser();
  saveInvoice(invoice());
  const updated = setInvoiceStatus('invoice-1', 'paid', 'cash', paid)[0];
  assert.equal(updated.paidAt, paid);
});

test('an invoice can only attach to the exact owned sale without moving its weight, cash, period or growing area', () => {
  const sale = linkedSale();
  const doc = linkedInvoice();
  assert.equal(recordedSaleInvoiceError(doc, sale, 'farmer-a'), null);
  assert.ok(recordedSaleInvoiceError(doc, sale, 'farmer-b'));
  for (const change of [
    { sourceSaleId: 'another-sale' }, { enterprise: 'staples' as const },
    { paidAt: '2026-06-25T08:37:00.000Z' }, { status: 'unpaid' as const },
    { items: [{ ...doc.items[0], qty: 13 }] }, { items: [{ ...doc.items[0], price: 10 }] },
    { items: [{ ...doc.items[0], desc: 'Carrots' }] },
  ]) assert.ok(recordedSaleInvoiceError({ ...doc, ...change }, sale, 'farmer-a'));
  assert.ok(recordedSaleInvoiceError(doc, { ...sale, invoice_id: 'different-invoice' }, 'farmer-a'));
  assert.equal(recordedSaleInvoiceError({ ...doc, enterprise: undefined }, { ...sale, enterprise: null }, 'farmer-a'), null);
});

test('stale edits cannot rewrite or unlink a sale after its invoice is saved', () => {
  installBrowser();
  const doc = linkedInvoice();
  saveInvoice(doc);
  const original = loadInvoices()[0];
  for (const change of [
    { sourceSaleId: undefined }, { status: 'unpaid' as const },
    { paidAt: '2026-06-25T08:37:00.000Z' }, { enterprise: 'staples' as const },
    { items: [{ ...doc.items[0], qty: 13 }] },
    { items: [{ ...doc.items[0], desc: 'Carrots' }] },
  ]) assert.deepEqual(saveInvoice({ ...doc, ...change })[0], original);
  assert.deepEqual(deleteInvoice(doc.id), [original]);
  assert.deepEqual(setInvoiceStatus(doc.id, 'unpaid'), [original]);
  assert.equal(saveInvoice({ ...doc, id: 'another-invoice' }).length, 1);
  const corrected = saveInvoice({ ...doc, paperReference: 'P-092', notes: 'Corrected reference' })[0];
  assert.equal(corrected.paperReference, 'P-092');
  assert.equal(corrected.reference, 'BUYER-5');
});

test('a failed final invoice save retains a private recoverable draft and counts the existing sale once', () => {
  const { local } = installBrowser();
  accountHarness.currentUid = 'farmer-a';
  const doc = linkedInvoice();
  assert.equal(stageInvoiceSaleLink(doc), true);
  assert.equal(loadInvoices().length, 0, 'pending documents must never enter invoice cash totals');
  assert.equal(loadNextInvoiceNumber(), 45, 'a pending document reserves its own number');
  const sale = { ...linkedSale(), invoice_id: doc.id, invoice_source_sale: true };
  local.failWrites = true;
  assert.deepEqual(saveInvoice(doc), []);
  assert.equal(cashIncomeTotal([sale], loadInvoices()), 112.5);
  assert.equal(loadPendingInvoiceLinks()[0].id, doc.id, 'reloading storage must recover the exact document');
  accountHarness.currentUid = 'farmer-b';
  assert.deepEqual(loadPendingInvoiceLinks(), [], 'another account cannot recover a private invoice');
  accountHarness.currentUid = 'farmer-a';
  local.failWrites = false;
  saveInvoice(loadPendingInvoiceLinks()[0]);
  assert.equal(clearPendingInvoiceLink(doc.id), true);
  assert.deepEqual(loadPendingInvoiceLinks(), []);
  assert.equal(cashIncomeTotal([sale], loadInvoices()), 112.5);
});

test('a device that cannot stage the pending invoice cannot begin a sale-link workflow', () => {
  const { local } = installBrowser();
  local.failWrites = true;
  assert.equal(stageInvoiceSaleLink(linkedInvoice()), false);
  assert.deepEqual(loadPendingInvoiceLinks(), []);
  assert.deepEqual(loadInvoices(), []);
});

test('repeated sample invoice linking retains one original sale and rejects stale record edits', async () => {
  installBrowser();
  const { enterSampleMode, exitSampleMode, addSandboxSale, getSandboxSales } = await import('../lib/sample-mode.ts');
  const { syncInvoiceSales, updateSale, deleteSale } = await import('../lib/db/queries.ts');
  assert.equal(enterSampleMode(), true);
  try {
    const source = { ...linkedSale(), profile_id: 'demo' };
    addSandboxSale(source);
    const doc = linkedInvoice();
    await syncInvoiceSales(doc);
    await syncInvoiceSales(doc);
    const rows = getSandboxSales().filter(sale => sale.id === source.id || sale.invoice_id === doc.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, source.id);
    assert.equal(rows[0].kg, source.kg);
    assert.equal(rows[0].amount, source.amount);
    assert.equal(rows[0].sold_at, source.sold_at);
    assert.equal(rows[0].garden_id, source.garden_id);
    assert.equal(rows[0].enterprise, source.enterprise);
    assert.equal(cashIncomeTotal(rows, [doc]), source.amount);
    await assert.rejects(updateSale(source.id, { amount: 999 }), /linked invoice/);
    await assert.rejects(deleteSale(source.id), /linked invoice/);
    await assert.rejects(syncInvoiceSales({ ...doc, sourceSaleId: undefined }), /linked/);
    assert.equal(getSandboxSales().find(sale => sale.id === source.id)?.amount, source.amount);
  } finally { exitSampleMode(); }
});

test('customers are trimmed, deduplicated without case, and malformed storage is ignored', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_invoice_customers', JSON.stringify([
    ' Alice ', 'alice', '', null, 42, 'Bob',
  ]));
  assert.deepEqual(loadCustomers(), [{ name: 'Alice' }, { name: 'Bob' }]);

  addCustomer(' ALICE ');
  assert.deepEqual(loadCustomers(), [{ name: 'ALICE' }, { name: 'Bob' }]);
  addCustomer('   ');
  assert.deepEqual(loadCustomers(), [{ name: 'ALICE' }, { name: 'Bob' }]);
});

test('a customer list written before buyers had addresses still loads', () => {
  // Rows used to be bare strings. Reading them as { name } upgrades a farmer's existing customer
  // list in place; the alternative — dropping anything that is not an object — would silently
  // empty the customer list of every farmer already using the app.
  const { local } = installBrowser();
  local.setItem('imbewu_invoice_customers', JSON.stringify([
    'Legacy buyer',
    { name: 'New buyer', address: 'Shop 3, Main Road', phone: '034 271 0000' },
  ]));
  assert.deepEqual(loadCustomers(), [
    { name: 'Legacy buyer' },
    { name: 'New buyer', address: 'Shop 3, Main Road', phone: '034 271 0000' },
  ]);
});

test('issuing a quick invoice does not wipe details captured earlier', () => {
  installBrowser();
  addCustomer('Spar Nquthu', { address: 'Shop 3, Main Road', phone: '034 271 0000' });
  // A later invoice to the same buyer, typed in a hurry with no address.
  addCustomer('Spar Nquthu');
  assert.deepEqual(loadCustomers(), [
    { name: 'Spar Nquthu', address: 'Shop 3, Main Road', phone: '034 271 0000' },
  ]);
  // A supplied value does replace the old one.
  addCustomer('Spar Nquthu', { phone: '034 271 1111' });
  assert.equal(loadCustomers()[0].phone, '034 271 1111');
});

test('an invoice keeps the date it was issued, however often it is edited', () => {
  // Every save stamped new Date(), so opening #0044 to fix a typo — or marking it paid a month
  // later — moved its date to today. The buyer's printed copy and the farmer's ledger then
  // disagreed about when the debt arose.
  installBrowser();
  const issued = '2026-06-24T08:00:00.000Z';
  const base = invoice({ id: 'inv-date', no: 44, dateISO: issued });
  saveInvoice(base);
  saveInvoice({ ...base, dateISO: '2026-08-07T08:00:00.000Z', billTo: 'Corrected buyer' });
  const [stored] = loadInvoices();
  assert.equal(stored.dateISO, issued, 'a later edit moved the issue date');
  assert.equal(stored.billTo, 'Corrected buyer', 'the edit itself was not applied');
});

test('a due date before the issue date is refused, not printed as already overdue', () => {
  installBrowser();
  const issued = '2026-06-24T08:00:00.000Z';
  saveInvoice(invoice({
    id: 'inv-due', no: 45, dateISO: issued, dueDateISO: '2026-06-01T08:00:00.000Z',
  }));
  assert.equal(loadInvoices()[0].dueDateISO, undefined);
  saveInvoice(invoice({
    id: 'inv-due-ok', no: 46, dateISO: issued, dueDateISO: '2026-07-24T08:00:00.000Z',
  }));
  assert.equal(loadInvoices()[0].dueDateISO, '2026-07-24T08:00:00.000Z');
});

test('products keep legitimate zero prices but reject unknown or impossible money', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_invoice_products', JSON.stringify([
    { desc: 'Donation', unit: 'each', price: 0 },
    { desc: 'Bad', unit: 'kg', price: null },
    { desc: 'Negative', unit: 'kg', price: -1 },
    { desc: 'No unit', unit: '', price: 10 },
    null,
  ]));
  assert.deepEqual(loadProducts(), [{ desc: 'Donation', unit: 'each', price: 0 }]);

  addProduct({ desc: 'Spinach', unit: 'bunches', price: 15 });
  addProduct({ desc: 'spinach', unit: 'kg', price: 20 });
  addProduct({ desc: 'Broken', unit: 'kg', price: Number.NaN });
  assert.deepEqual(loadProducts(), [
    { desc: 'spinach', unit: 'kg', price: 20 },
    { desc: 'Donation', unit: 'each', price: 0 },
  ]);
});

test('crop pickers come from the reviewed catalogue and remember a farmer-added crop per account', () => {
  installBrowser();
  assert.ok(CROP_ENTRY_OPTIONS.length >= 20);
  assert.equal(cropEntryOption('Spinach')?.key, 'swiss-chard');
  assert.equal(cropEntryOption('dry-beans')?.label, 'Dry beans (sugar beans)');
  assert.equal(cropEntryOption('Kale')?.key, 'kale', 'missing planning yield must not erase a real harvested crop from sale records');
  assert.equal(cropEntryOption('Coriander')?.key, 'coriander', 'an unverified kg/m² figure does not mean the crop cannot be sold');
  assert.equal(cropEntryOption('Oats (winter cover crop)'), null, 'a soil-building cover with no food harvest is not produce');

  assert.equal(saveCustomCropName('  Garden special  '), 'Garden special');
  assert.equal(saveCustomCropName('garden special'), 'garden special');
  assert.deepEqual(loadCustomCropNames(), ['garden special']);

  // A catalogue alias resolves to its reviewed name instead of creating a rival crop entry.
  assert.equal(saveCustomCropName(' spinach '), 'Swiss chard (spinach)');
  assert.deepEqual(loadCustomCropNames(), ['garden special']);
});

test('a farmer typing the plural gets the catalogue crop, not a rival custom one', () => {
  installBrowser();
  // The guard in saveCustomCropName exists so one fruit cannot become two rows with two prices.
  // It asked the pickers "do you know this name?" using aliases derived from each option's LABEL,
  // which knew keys and bracketed synonyms but nothing about plurals — so "Avocados" walked
  // straight past a guard written to stop exactly that, and /finances ended up offering
  // Avocados at R25 beside Avocado at R40: one tree, two prices, a split record.
  assert.equal(perennialEntryOption('Avocados')?.key, 'perennial:avocado');
  assert.equal(perennialEntryOption('Mangoes')?.key, 'perennial:mango');
  assert.equal(saveCustomCropName('Avocados'), 'Avocado', 'the orchard name wins over a new custom row');

  // The annual half had the identical hole, and vegetables are the commoner case: "Tomatoes" and
  // "Carrots" only ever worked because those catalogue labels are already plural.
  assert.equal(cropEntryOption('Cabbages')?.key, 'cabbage');
  assert.equal(cropEntryOption('Potatoes')?.key, 'potato');
  assert.equal(cropEntryOption('Beetroots')?.key, 'beetroot');
  assert.equal(saveCustomCropName('Cabbages'), 'Cabbage');

  // Widening the match must not start rewriting names. A cover crop is still not produce however
  // it is spelled, a genuinely new name is still the farmer's own words, and an ambiguous one is
  // still refused rather than guessed at.
  assert.equal(cropEntryOption('Oats'), null, 'a soil-building cover with no food harvest is still not produce');
  assert.equal(produceEntryOption('Beans'), null, '"beans" hits three catalogue crops and must not be resolved to one');
  assert.equal(saveCustomCropName('Imifino yesintu'), 'Imifino yesintu');
  assert.ok(loadCustomCropNames().includes('Imifino yesintu'));
  assert.ok(!loadCustomCropNames().some((n) => /avocado|cabbage/i.test(n)), 'no catalogue crop leaked into custom names');
});

test('a paid invoice creates kg crop-sale evidence while cash totals still count the invoice once', () => {
  const paid = invoice({
    id: 'invoice-kg',
    billTo: 'Spaza shop',
    status: 'paid',
    paidAt: '2026-08-06T09:00:00.000Z',
    items: [
      { desc: 'Cabbage', qty: 12.5, unit: 'kg', price: 9 },
      { desc: 'Spinach', qty: 2, unit: 'crates', price: 80 },
    ],
  });
  const generated = invoiceSalesForPaidInvoice(paid);
  assert.deepEqual(generated, [{
    crop: 'Cabbage', kg: 12.5, amount: 112.5, buyer: 'Spaza shop',
    sold_at: paid.paidAt, invoice_id: 'invoice-kg', invoice_line: 0,
  }]);
  assert.deepEqual(invoiceSalesForPaidInvoice({ ...paid, status: 'unpaid', paidAt: undefined }), []);
  assert.equal(
    invoiceSaleDocumentId('farmer/one', 'invoice/kg', 0),
    'farmer%2Fone_invoice_invoice%2Fkg_0',
  );

  const manual = { invoice_id: null, amount: 40 };
  const linked = { invoice_id: 'invoice-kg', amount: 112.5 };
  assert.deepEqual(cashLedgerSales([manual, linked], ['invoice-kg']), [manual]);
  assert.deepEqual(
    cashLedgerSales([manual, linked], []),
    [manual, linked],
    'a second device without the local invoice must not make its cloud sale income disappear',
  );
});

test('the invoice and records screens wire the crop picker, price book and paid-invoice sale sync', () => {
  const invoicePage = readFileSync(new URL('../app/invoice/page.tsx', import.meta.url), 'utf8');
  const records = readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');
  assert.match(invoicePage, /<CropSelect/);
  assert.match(invoicePage, /await syncInvoiceSales\(updated\)/);
  // The guide-price line must derive its date per crop (a later-priced crop carries its own
  // pricedAt) — the hardcoded "guide price, July 2026" literal this used to assert went stale
  // the first time a crop was priced outside July. tests/crop-prices.test.ts holds the
  // no-literal-date guard; this keeps asserting the invoice screen wires the price book's label.
  assert.match(invoicePage, /guide price from \{priceDateLabel\(guide\)\}/);
  assert.match(records, /<CropSelect/);
  assert.match(records, /priceFor\(form\.cropKey, priceOverrides\)/);
});

test('invoice totals are reconciled from valid line items rather than trusted storage', () => {
  installBrowser();
  const saved = saveInvoice(invoice({ total: 999_999 }));
  assert.equal(saved.length, 1);
  assert.equal(saved[0].total, 30);
  assert.equal(loadInvoices()[0].total, 30);
});

test('one invalid line rejects the whole save instead of silently reducing the bill', () => {
  installBrowser();
  const valid = invoice();
  saveInvoice(valid);
  const before = loadInvoices();
  const attempted = invoice({
    total: Number.NaN,
    items: [
      valid.items[0],
      { desc: 'Unknown-price crop', qty: 1, unit: 'kg', price: Number.NaN },
    ],
  });
  assert.deepEqual(saveInvoice(attempted), before);
  assert.deepEqual(loadInvoices(), before);
});

test('malformed and duplicate persisted invoices cannot poison or double-count the ledger', () => {
  const { local } = installBrowser();
  const legacy = { ...invoice(), status: undefined };
  local.setItem('imbewu_invoices', JSON.stringify([
    legacy,
    { ...legacy, total: 600 },
    { ...invoice({ id: 'bad-date' }), dateISO: 'not-a-date' },
    { ...invoice({ id: 'bad-qty' }), items: [{ desc: 'Crop', qty: -1, unit: 'kg', price: 10 }] },
    null,
  ]));
  const rows = loadInvoices();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'unpaid');
  assert.equal(rows[0].total, 30);
});

test('paid status records a finite timestamp and unpaid clears payment evidence', () => {
  installBrowser();
  saveInvoice(invoice());
  const paid = setInvoiceStatus('invoice-1', 'paid', 'cash')[0];
  assert.equal(paid.status, 'paid');
  assert.equal(paid.paymentMethod, 'cash');
  assert.ok(paid.paidAt && Number.isFinite(Date.parse(paid.paidAt)));

  const unpaid = setInvoiceStatus('invoice-1', 'unpaid')[0];
  assert.equal(unpaid.status, 'unpaid');
  assert.equal(unpaid.paymentMethod, undefined);
  assert.equal(unpaid.paidAt, undefined);
});

test('changing payment method never moves old paid income into the current month', () => {
  installBrowser();
  const oldPaidAt = '2025-02-03T04:05:06.000Z';
  saveInvoice(invoice({ status: 'paid', paidAt: oldPaidAt, paymentMethod: 'cash' }));

  const changed = setInvoiceStatus('invoice-1', 'paid', 'eft')[0];
  assert.equal(changed.paymentMethod, 'eft');
  assert.equal(changed.paidAt, oldPaidAt);
});

test('editing a paid invoice preserves payment evidence that the form did not change', () => {
  installBrowser();
  const oldPaidAt = '2025-02-03T04:05:06.000Z';
  saveInvoice(invoice({ status: 'paid', paidAt: oldPaidAt, paymentMethod: 'cash' }));
  const edited = saveInvoice(invoice({
    billTo: 'Edited customer',
    status: 'paid',
    paidAt: oldPaidAt,
    paymentMethod: undefined,
  }));

  assert.equal(edited.length, 1);
  assert.equal(edited[0].billTo, 'Edited customer');
  assert.equal(edited[0].paidAt, oldPaidAt);
  assert.equal(edited[0].paymentMethod, 'cash');
});

test('unpaid or unverifiable paid records never retain payment evidence', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_invoices', JSON.stringify([
    invoice({ id: 'unpaid', status: 'unpaid', paidAt: '2026-01-03T00:00:00Z', paymentMethod: 'cash' }),
    invoice({ id: 'missing-paid-at', no: 2, status: 'paid', paidAt: undefined, paymentMethod: 'eft' }),
    invoice({ id: 'invalid-paid-at', no: 3, status: 'paid', paidAt: 'not-a-date', paymentMethod: 'card' }),
  ]));

  assert.deepEqual(loadInvoices().map(({ id, status, paidAt, paymentMethod }) => ({
    id, status, paidAt, paymentMethod,
  })), [
    { id: 'unpaid', status: 'unpaid', paidAt: undefined, paymentMethod: undefined },
    { id: 'missing-paid-at', status: 'unpaid', paidAt: undefined, paymentMethod: undefined },
    { id: 'invalid-paid-at', status: 'unpaid', paidAt: undefined, paymentMethod: undefined },
  ]);
});

test('trimmed invoice ids replace one record rather than returning a duplicate', () => {
  installBrowser();
  saveInvoice(invoice());
  const rows = saveInvoice(invoice({ id: ' invoice-1 ', billTo: 'Updated' }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'invoice-1');
  assert.equal(rows[0].billTo, 'Updated');
});

test('saving another invoice grows history without silently evicting an older accounting record', () => {
  installBrowser();
  let expectedLength = 0;
  for (let index = 1; index <= 125; index += 1) {
    const rows = saveInvoice(invoice({ id: `invoice-${index}`, no: index }));
    expectedLength += 1;
    assert.equal(rows.length, expectedLength);
  }
  const rows = loadInvoices();
  assert.ok(rows.some((row) => row.id === 'invoice-1'));
  assert.ok(rows.some((row) => row.id === 'invoice-125'));
});

test('delete and status events fire only for durable, real changes', () => {
  const { target } = installBrowser();
  let changes = 0;
  target.addEventListener('imbewu-invoices-changed', () => { changes += 1; });
  saveInvoice(invoice());
  saveInvoice(invoice({ id: 'invoice-2', no: 2 }));
  assert.equal(changes, 2);
  assert.deepEqual(deleteInvoice('invoice-1').map((row) => row.id), ['invoice-2']);
  assert.equal(changes, 3);
  assert.deepEqual(deleteInvoice('missing').map((row) => row.id), ['invoice-2']);
  assert.deepEqual(setInvoiceStatus('missing', 'paid').map((row) => row.id), ['invoice-2']);
  assert.equal(changes, 3);
});

test('quota failures return the durable ledger and never emit a false saved event', () => {
  const { local, target } = installBrowser();
  saveInvoice(invoice());
  const durable = loadInvoices();
  let changes = 0;
  target.addEventListener('imbewu-invoices-changed', () => { changes += 1; });
  local.failWrites = true;

  assert.deepEqual(saveInvoice(invoice({ id: 'invoice-2', no: 2 })), durable);
  assert.deepEqual(deleteInvoice('invoice-1'), durable);
  assert.equal(setInvoiceStatus('invoice-1', 'paid')[0].status, 'unpaid');
  assert.equal(changes, 0);
  assert.deepEqual(loadInvoices(), durable);
});

test("one shared device keeps each farmer's invoice ledger and sequence separate", () => {
  const { local } = installBrowser();
  local.setItem('imbewu_invoice_customers', JSON.stringify(['Unknown legacy customer']));
  local.setItem('imbewu_invoice_products', JSON.stringify([
    { desc: 'Unknown legacy crop', unit: 'kg', price: 9 },
  ]));
  local.setItem('imbewu_invoices', JSON.stringify([
    invoice({ id: 'legacy', billTo: 'Unknown legacy customer' }),
  ]));
  local.setItem('imbewu_invoice_seq', '900');

  accountHarness.currentUid = 'farmer-a';
  assert.deepEqual(loadCustomers(), []);
  assert.deepEqual(loadProducts(), []);
  assert.deepEqual(loadInvoices(), []);
  assert.equal(loadNextInvoiceNumber(), 44);
  addCustomer('Farmer A customer');
  addProduct({ desc: 'Farmer A spinach', unit: 'bunches', price: 15 });
  saveInvoice(invoice({ id: 'farmer-a-invoice', billTo: 'Farmer A customer' }));
  assert.equal(saveNextInvoiceNumber(45), true);

  accountHarness.currentUid = 'farmer-b';
  assert.deepEqual(loadCustomers(), []);
  assert.deepEqual(loadProducts(), []);
  assert.deepEqual(loadInvoices(), []);
  assert.equal(loadNextInvoiceNumber(), 44);
  addCustomer('Farmer B customer');
  addProduct({ desc: 'Farmer B maize', unit: 'bags', price: 25 });
  saveInvoice(invoice({
    id: 'farmer-b-invoice',
    no: 7,
    billTo: 'Farmer B customer',
  }));
  assert.equal(saveNextInvoiceNumber(8), true);

  accountHarness.currentUid = 'farmer-a';
  assert.deepEqual(loadCustomers(), [{ name: 'Farmer A customer' }]);
  assert.deepEqual(loadProducts().map((product) => product.desc), ['Farmer A spinach']);
  assert.deepEqual(loadInvoices().map((row) => row.id), ['farmer-a-invoice']);
  assert.equal(loadNextInvoiceNumber(), 45);

  assert.ok(local.getItem(accountLocalStorageKey('imbewu_invoices', 'farmer-a')));
  assert.ok(local.getItem(accountLocalStorageKey('imbewu_invoices', 'farmer-b')));
  assert.ok(local.getItem(accountLocalStorageKey('imbewu_invoice_seq', 'farmer-a')));
  assert.ok(local.getItem(accountLocalStorageKey('imbewu_invoice_seq', 'farmer-b')));
  assert.ok(local.getItem('imbewu_invoices'), 'unowned legacy ledger remains quarantined');
  assert.equal(local.getItem('imbewu_invoice_seq'), '900');
  accountHarness.currentUid = null;
});

test('invoice sequence rejects corrupt counters and reports failed persistence', () => {
  const { local } = installBrowser();
  local.setItem('imbewu_invoice_seq', 'not-a-number');
  assert.equal(loadNextInvoiceNumber(12), 12);
  assert.equal(saveNextInvoiceNumber(0), false);
  assert.equal(saveNextInvoiceNumber(Number.NaN), false);

  local.failWrites = true;
  assert.equal(saveNextInvoiceNumber(13), false);
  local.failWrites = false;
  assert.equal(loadNextInvoiceNumber(12), 12);
});

test('payment labels are total and generated ids remain non-empty and distinct', () => {
  for (const method of ['cash', 'eft', 'card', 'mobile', 'other'] as const) {
    assert.ok(paymentMethodLabel(method));
  }
  assert.equal(paymentMethodLabel('bogus' as never), 'Other');
  assert.equal(paymentMethodLabel('__proto__' as never), 'Other');
  const ids = new Set(Array.from({ length: 20 }, () => invoiceId()));
  assert.equal(ids.size, 20);
  assert.ok([...ids].every((id) => id.length > 5));
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A KILOGRAM IS NOT AN INTEGER. The invoice quantity field parsed with parseInt while UNITS
// includes 'kg' and 'crates', so 12.5 kg of tomatoes was billed as 12 — on the document the buyer
// pays from, and always in the farmer's disfavour. This asserts the persistence contract the input
// must honour: fractional quantities are legal, survive a save, and total correctly.
test('a fractional kilogram line survives a save and totals correctly', () => {
  installBrowser();
  const list = saveInvoice({
    id: 'inv-frac', no: 44, billTo: 'Buyer',
    items: [{ desc: 'Tomatoes', qty: 12.5, unit: 'kg', price: 29 }],
    total: 362.5, dateISO: '2026-08-02T00:00:00.000Z', status: 'unpaid',
  });
  const stored = list.find((x) => x.id === 'inv-frac');
  assert.ok(stored, 'a fractional-quantity invoice must be storable');
  assert.equal(stored!.items[0].qty, 12.5);
  assert.equal(stored!.total, 362.5);

  // And it round-trips, because the ledger is what /finances and the CSV read.
  const reloaded = loadInvoices().find((x) => x.id === 'inv-frac');
  assert.equal(reloaded?.items[0].qty, 12.5);
});

// A ZERO-QUANTITY LINE REJECTS THE WHOLE INVOICE — which is correct, and is exactly why the UI
// must not print when the save was refused. This pins the signal persist() now reads: saveInvoice
// returns the DURABLE ledger, so a rejected record is absent from what comes back.
test('a rejected invoice is absent from the returned ledger, which is how the caller knows', () => {
  installBrowser();
  const before = saveInvoice({
    id: 'inv-good', no: 44, billTo: 'Buyer',
    items: [{ desc: 'Spinach', qty: 3, unit: 'bunches', price: 10 }],
    total: 30, dateISO: '2026-08-02T00:00:00.000Z', status: 'unpaid',
  });
  assert.ok(before.some((x) => x.id === 'inv-good'));

  const after = saveInvoice({
    id: 'inv-bad', no: 45, billTo: 'Buyer',
    items: [{ desc: 'Chillies', qty: 0, unit: 'kg', price: 80 }],
    total: 0, dateISO: '2026-08-02T00:00:00.000Z', status: 'unpaid',
  });
  assert.equal(after.some((x) => x.id === 'inv-bad'), false, 'a zero-quantity line must not be stored');
  // The prior ledger is preserved, not clobbered — that is the contract persist() relies on.
  assert.ok(after.some((x) => x.id === 'inv-good'));
});

const { saveSaleInvoice } = await import('../lib/sale-invoice.ts');

test('a quick sale saves one paid invoice before syncing its income', async () => {
  installBrowser();
  let calls = 0;
  const saved = await saveSaleInvoice({ crop: 'Avocado', kg: 3, amount: 60 }, async row => {
    calls++;
    assert.equal(loadInvoices().find(i => i.id === row.id)?.total, 60);
    assert.equal(row.status, 'paid');
  });
  assert.equal(calls, 1);
  assert.equal(saved.salesSyncPending, undefined);
  assert.equal(loadInvoices().length, 1);
  assert.equal(saved.items[0].price, 20);
});

test('failed sales sync leaves the original invoice available for retry', async () => {
  installBrowser();
  const saved = await saveSaleInvoice({ crop: 'Lemon', kg: 2, amount: 20 }, async () => { throw Error('offline'); });
  assert.equal(saved.salesSyncPending, true);
  assert.equal(loadInvoices()[0].id, saved.id);
});

test('storage failure or invalid amounts cannot send an unrecorded sale', async () => {
  const { local } = installBrowser();
  let calls = 0;
  const sync = async () => { calls++; };
  await assert.rejects(saveSaleInvoice({ crop: 'Lemon', kg: 0, amount: 20 }, sync));
  local.failWrites = true;
  await assert.rejects(saveSaleInvoice({ crop: 'Lemon', kg: 2, amount: 20 }, sync));
  assert.equal(calls, 0);
});

for (const syncFails of [false, true]) {
  test(`a quick sale cannot finish into a different account when sync ${syncFails ? 'fails' : 'succeeds'}`, async () => {
    installBrowser();
    accountHarness.currentUid = 'farmer-a';
    await assert.rejects(saveSaleInvoice({ crop: 'Lemon', kg: 2, amount: 20 }, async () => {
      accountHarness.currentUid = 'farmer-b';
      if (syncFails) throw Error('offline');
    }), /account changed/);
    assert.deepEqual(loadInvoices(), [], 'the next account must never receive the previous invoice');
    accountHarness.currentUid = 'farmer-a';
    assert.equal(loadInvoices().length, 1, 'the original account retains its recoverable invoice');
    assert.equal(loadInvoices()[0].salesSyncPending, true);
  });
}

test('a newly entered paper invoice retains distinct historical issue and payment dates after save and reopen', () => {
  installBrowser();
  const dateISO = invoiceDateFromInput('2026-09-01')!;
  const paidAt = invoiceDateFromInput('2026-09-03')!;
  saveInvoice(invoice({ entryKind: 'paper-copy', paperReference: 'PAPER-007', dateISO, paidAt, status: 'paid', items: [{ desc: 'Spinach', qty: 2, unit: 'kg', price: 15 }] }));
  const reopened = loadInvoices()[0];
  assert.equal(reopened.dateISO, dateISO);
  assert.equal(reopened.paidAt, paidAt);
  assert.equal(invoiceDateInput(reopened.dateISO), '2026-09-01');
  assert.equal(invoiceDateInput(reopened.paidAt!), '2026-09-03');
  assert.equal(reopened.paperReference, 'PAPER-007');
  assert.equal(invoiceSalesForPaidInvoice(reopened)[0].sold_at, paidAt, 'cash belongs to the actual payment date');
});
