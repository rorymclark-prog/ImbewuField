import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';

import type { SavedInvoice } from '../lib/invoices.ts';

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
} = await import('../lib/invoices.ts');
const {
  CROP_ENTRY_OPTIONS,
  cropEntryOption,
  loadCustomCropNames,
  saveCustomCropName,
} = await import('../lib/crop-entry.ts');
const {
  cashLedgerSales,
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
  assert.match(invoicePage, /guide price, July 2026/);
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
