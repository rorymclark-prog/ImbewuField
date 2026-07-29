import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addCustomer,
  addProduct,
  deleteInvoice,
  invoiceId,
  loadCustomers,
  loadInvoices,
  loadProducts,
  paymentMethodLabel,
  saveInvoice,
  setInvoiceStatus,
  type SavedInvoice,
} from '../lib/invoices.ts';

class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(String(key), String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
}

function installBrowser() {
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
  assert.deepEqual(loadCustomers(), ['Alice', 'Bob']);

  addCustomer(' ALICE ');
  assert.deepEqual(loadCustomers(), ['ALICE', 'Bob']);
  addCustomer('   ');
  assert.deepEqual(loadCustomers(), ['ALICE', 'Bob']);
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

test('delete is exact and invoice events fire only for real changes', () => {
  const { target } = installBrowser();
  let changes = 0;
  target.addEventListener('imbewu-invoices-changed', () => { changes += 1; });
  saveInvoice(invoice());
  saveInvoice(invoice({ id: 'invoice-2', no: 2 }));
  assert.equal(changes, 2);
  assert.deepEqual(deleteInvoice('invoice-1').map((row) => row.id), ['invoice-2']);
  assert.equal(changes, 3);
});

test('payment labels are total and generated ids remain non-empty and distinct', () => {
  for (const method of ['cash', 'eft', 'card', 'mobile', 'other'] as const) {
    assert.ok(paymentMethodLabel(method));
  }
  assert.equal(paymentMethodLabel('bogus' as never), 'Other');
  const ids = new Set(Array.from({ length: 20 }, () => invoiceId()));
  assert.equal(ids.size, 20);
  assert.ok([...ids].every((id) => id.length > 5));
});
