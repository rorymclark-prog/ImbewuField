import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadInvoices,
  invoiceReadCoverage,
  type SavedInvoice,
} from '../lib/invoices';
import {
  INVOICE_PILOT_CURRENCIES,
  type InvoicePilotCurrency,
} from '../lib/invoice-currency';
import { invoicePriceHistory } from '../lib/invoice-price-history';

const makeInvoice = (overrides: Record<string, unknown> = {}): SavedInvoice =>
  ({
    id: 'inv-1',
    no: 44,
    billTo: 'Buyer Corp',
    items: [{ desc: 'Recorded produce', qty: 2, unit: 'crates', price: 15.5 }],
    total: 31,
    dateISO: '2026-08-10T10:00:00.000Z',
    status: 'paid',
    ...overrides,
  } as SavedInvoice);

test('exact match retrieves price history across all six supported pilot currencies', () => {
  for (const code of INVOICE_PILOT_CURRENCIES) {
    const inv = makeInvoice({
      id: `inv-${code}`,
      no: 101,
      currencyCode: code,
      items: [{ desc: 'Recorded produce', qty: 5, unit: 'kg', price: 24 }],
    });

    const res = invoicePriceHistory([inv], {
      currencyCode: code,
      desc: 'Recorded produce',
      unit: 'kg',
    });

    assert.equal(res.status, 'ready');
    assert.equal(res.choices.length, 1);
    const choice = res.choices[0];
    assert.equal(choice.invoiceId, `inv-${code}`);
    assert.equal(choice.invoiceNo, 101);
    assert.equal(choice.lineIndex, 0);
    assert.equal(choice.desc, 'Recorded produce');
    assert.equal(choice.unit, 'kg');
    assert.equal(choice.price, 24);
    assert.equal(choice.currencyCode, code);
    assert.equal(choice.buyer, 'Buyer Corp');
    assert.equal(choice.issuedISO, '2026-08-10T10:00:00.000Z');
  }
});

test('legacy invoice with genuinely absent currencyCode matches ZAR filter only', () => {
  const legacyInv = makeInvoice({
    id: 'legacy-inv',
    no: 12,
    // currencyCode is completely absent
    items: [{ desc: 'Recorded produce', qty: 1, unit: 'bunch', price: 10 }],
  });
  // Ensure own property currencyCode is not present
  assert.equal(Object.hasOwn(legacyInv, 'currencyCode'), false);

  // Matches ZAR
  const resZar = invoicePriceHistory([legacyInv], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'bunch',
  });
  assert.equal(resZar.status, 'ready');
  assert.equal(resZar.choices.length, 1);
  assert.equal(resZar.choices[0].currencyCode, 'ZAR');
  assert.equal(resZar.choices[0].price, 10);

  // Does not match foreign currency (e.g. KES or USD)
  const resForeign = invoicePriceHistory([legacyInv], {
    currencyCode: 'KES',
    desc: 'Recorded produce',
    unit: 'bunch',
  });
  assert.equal(resForeign.status, 'ready');
  assert.equal(resForeign.choices.length, 0);
});

test('present malformed or undefined currencyCode is held and never reinterpreted as legacy Rand', () => {
  const malformedUndefined = makeInvoice({
    id: 'inv-malformed',
    currencyCode: undefined, // present property with undefined value
  });
  assert.equal(Object.hasOwn(malformedUndefined, 'currencyCode'), true);

  const res1 = invoicePriceHistory([malformedUndefined], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });
  assert.equal(res1.status, 'held');
  assert.equal(res1.reason, 'currency-outside-pilot');
  assert.equal(res1.choices.length, 0);

  const malformedForeign = makeInvoice({
    id: 'inv-outside',
    currencyCode: 'CAD', // unverified outside pilot
  });
  const res2 = invoicePriceHistory([malformedForeign], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });
  assert.equal(res2.status, 'held');
  assert.equal(res2.reason, 'currency-outside-pilot');
});

test('selection with non-pilot or malformed currency is held', () => {
  const inv = makeInvoice({ currencyCode: 'ZAR' });
  const badCurrencies = ['', '   ', 'zar', 'CAD', 710, null, undefined];

  for (const bad of badCurrencies) {
    const res = invoicePriceHistory([inv], {
      currencyCode: bad,
      desc: 'Recorded produce',
      unit: 'crates',
    });
    assert.equal(res.status, 'held');
    assert.equal(res.reason, 'currency-outside-pilot');
    assert.equal(res.choices.length, 0);
  }
});

test('selection with accessor descriptor on desc, unit, or currencyCode is held with zero getter calls', () => {
  let descGetterCalls = 0;
  const selectionWithDescGetter = {
    currencyCode: 'ZAR',
    unit: 'crates',
  };
  Object.defineProperty(selectionWithDescGetter, 'desc', {
    get() {
      descGetterCalls++;
      return 'Recorded produce';
    },
    enumerable: true,
  });

  const inv = makeInvoice({ currencyCode: 'ZAR' });
  const resDesc = invoicePriceHistory([inv], selectionWithDescGetter as any);
  assert.equal(resDesc.status, 'held');
  assert.equal(resDesc.reason, 'selection-property-unreadable');
  assert.equal(descGetterCalls, 0, 'Selection desc getter must never be executed');

  let unitGetterCalls = 0;
  const selectionWithUnitGetter = {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
  };
  Object.defineProperty(selectionWithUnitGetter, 'unit', {
    get() {
      unitGetterCalls++;
      return 'crates';
    },
    enumerable: true,
  });

  const resUnit = invoicePriceHistory([inv], selectionWithUnitGetter as any);
  assert.equal(resUnit.status, 'held');
  assert.equal(resUnit.reason, 'selection-property-unreadable');
  assert.equal(unitGetterCalls, 0, 'Selection unit getter must never be executed');

  let currencyGetterCalls = 0;
  const selectionWithCurrencyGetter = {
    desc: 'Recorded produce',
    unit: 'crates',
  };
  Object.defineProperty(selectionWithCurrencyGetter, 'currencyCode', {
    get() {
      currencyGetterCalls++;
      return 'ZAR';
    },
    enumerable: true,
  });

  const resCurr = invoicePriceHistory([inv], selectionWithCurrencyGetter as any);
  assert.equal(resCurr.status, 'held');
  assert.equal(resCurr.reason, 'selection-property-unreadable');
  assert.equal(currencyGetterCalls, 0, 'Selection currencyCode getter must never be executed');
});

test('original invoice array with index accessor is held with zero getter calls', () => {
  let indexGetterCalls = 0;
  const arr = [] as SavedInvoice[];
  Object.defineProperty(arr, '0', {
    get() {
      indexGetterCalls++;
      return makeInvoice({ currencyCode: 'ZAR' });
    },
    enumerable: true,
    configurable: true,
  });
  // length is 1
  Object.defineProperty(arr, 'length', { value: 1, writable: true });

  const res = invoicePriceHistory(arr, {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });

  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'invoice-row-unreadable');
  assert.equal(indexGetterCalls, 0, 'Array index getter must never be executed');
});

test('source invoice metadata validation: non-positive invoice number or invalid date is held', () => {
  // Invoice with number 0
  const zeroNoInv = makeInvoice({
    no: 0,
    currencyCode: 'ZAR',
  });
  const res1 = invoicePriceHistory([zeroNoInv], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });
  assert.equal(res1.status, 'held');
  assert.equal(res1.reason, 'invoice-row-unreadable');

  // Invoice with invalid date string
  const badDateInv = makeInvoice({
    no: 1,
    currencyCode: 'ZAR',
    dateISO: 'not-a-date',
  });
  const res2 = invoicePriceHistory([badDateInv], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });
  assert.equal(res2.status, 'held');
  assert.equal(res2.reason, 'invoice-row-unreadable');
});

test('canonical optional undefined fields on source invoice are safely omitted without failing', () => {
  const invWithOptionalUndefined = makeInvoice({
    currencyCode: 'ZAR',
    dueDateISO: undefined,
    notes: undefined,
    reference: undefined,
    paperReference: undefined,
  });

  const res = invoicePriceHistory([invWithOptionalUndefined], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });

  assert.equal(res.status, 'ready');
  assert.equal(res.choices.length, 1);
  assert.equal(res.choices[0].price, 15.5);
});

test('actual unavailable loadInvoices() in Node without window has native coverage held and kernel held', () => {
  // In Node environment without window/localStorage, loadInvoices() calls inspectBook(false)
  // which returns an empty collection covered with status: 'held', reason: 'storage-unavailable'
  const loaded = loadInvoices();
  const coverage = invoiceReadCoverage(loaded);
  assert.equal(coverage.status, 'held');
  assert.equal((coverage as any).reason, 'storage-unavailable');

  const res = invoicePriceHistory(loaded, {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });
  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'storage-unavailable');
  assert.equal(res.choices.length, 0);
});

test('cross-currency separation: excludes non-matching currencies without suppressing legitimate foreign choices', () => {
  const invZar = makeInvoice({
    id: 'inv-zar',
    no: 1,
    currencyCode: 'ZAR',
    items: [{ desc: 'Recorded produce', qty: 10, unit: 'bags', price: 50 }],
  });
  const invKes = makeInvoice({
    id: 'inv-kes',
    no: 2,
    currencyCode: 'KES',
    items: [{ desc: 'Recorded produce', qty: 10, unit: 'bags', price: 400 }],
  });
  const invUsd = makeInvoice({
    id: 'inv-usd',
    no: 3,
    currencyCode: 'USD',
    items: [{ desc: 'Recorded produce', qty: 10, unit: 'bags', price: 3.5 }],
  });

  const list = [invZar, invKes, invUsd];

  // Filtering for KES returns only the KES choice
  const resKes = invoicePriceHistory(list, {
    currencyCode: 'KES',
    desc: 'Recorded produce',
    unit: 'bags',
  });
  assert.equal(resKes.status, 'ready');
  assert.equal(resKes.choices.length, 1);
  assert.equal(resKes.choices[0].invoiceId, 'inv-kes');
  assert.equal(resKes.choices[0].currencyCode, 'KES');
  assert.equal(resKes.choices[0].price, 400);

  // Filtering for USD returns only the USD choice
  const resUsd = invoicePriceHistory(list, {
    currencyCode: 'USD',
    desc: 'Recorded produce',
    unit: 'bags',
  });
  assert.equal(resUsd.status, 'ready');
  assert.equal(resUsd.choices.length, 1);
  assert.equal(resUsd.choices[0].invoiceId, 'inv-usd');
  assert.equal(resUsd.choices[0].currencyCode, 'USD');
  assert.equal(resUsd.choices[0].price, 3.5);
});

test('exact description and unit matching: case and whitespace sensitive, no normalization', () => {
  const inv = makeInvoice({
    currencyCode: 'ZAR',
    items: [
      { desc: 'Recorded produce', qty: 1, unit: 'kg', price: 20 },
      { desc: 'recorded produce', qty: 1, unit: 'kg', price: 18 },
      { desc: 'Recorded produce ', qty: 1, unit: 'kg', price: 22 },
      { desc: 'Recorded produce', qty: 1, unit: 'KG', price: 25 },
      { desc: 'Recorded produce', qty: 1, unit: 'g', price: 5 },
    ],
  });

  const res = invoicePriceHistory([inv], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'kg',
  });

  assert.equal(res.status, 'ready');
  assert.equal(res.choices.length, 1);
  assert.equal(res.choices[0].lineIndex, 0);
  assert.equal(res.choices[0].price, 20);
});

test('legitimate zero price is preserved and valid', () => {
  const inv = makeInvoice({
    currencyCode: 'ZAR',
    items: [{ desc: 'Recorded produce', qty: 1, unit: 'crates', price: 0 }],
  });

  const res = invoicePriceHistory([inv], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });

  assert.equal(res.status, 'ready');
  assert.equal(res.choices.length, 1);
  assert.equal(res.choices[0].price, 0);
});

test('negative finite prices reach invoice-price-invalid; non-finite prices are rejected by detachJsonData as invoice-row-unreadable', () => {
  // Negative finite prices pass detachJsonData and reach the item price check, returning invoice-price-invalid
  const negativePrices = [-1, -0.01];
  for (const p of negativePrices) {
    const inv = makeInvoice({
      currencyCode: 'ZAR',
      items: [{ desc: 'Recorded produce', qty: 1, unit: 'crates', price: p }],
    });

    const res = invoicePriceHistory([inv], {
      currencyCode: 'ZAR',
      desc: 'Recorded produce',
      unit: 'crates',
    });

    assert.equal(res.status, 'held');
    assert.equal(res.reason, 'invoice-price-invalid', `Expected invoice-price-invalid for finite negative price ${p}`);
    assert.equal(res.choices.length, 0);
  }

  // Non-finite numbers (NaN, Infinity, -Infinity) fail detachJsonData safe JSON detachment first,
  // returning invoice-row-unreadable before the price loop is reached
  const nonFinitePrices = [NaN, Infinity, -Infinity];
  for (const p of nonFinitePrices) {
    const inv = makeInvoice({
      currencyCode: 'ZAR',
      items: [{ desc: 'Recorded produce', qty: 1, unit: 'crates', price: p }],
    });

    const res = invoicePriceHistory([inv], {
      currencyCode: 'ZAR',
      desc: 'Recorded produce',
      unit: 'crates',
    });

    assert.equal(res.status, 'held');
    assert.equal(res.reason, 'invoice-row-unreadable', `Expected invoice-row-unreadable for non-finite price ${p}`);
    assert.equal(res.choices.length, 0);
  }
});

test('getter property on currencyCode or line item is never invoked', () => {
  let getterCalls = 0;
  const rawInvoice = {
    id: 'inv-getter',
    no: 99,
    billTo: 'Buyer',
    items: [{ desc: 'Recorded produce', qty: 1, unit: 'crates', price: 10 }],
    dateISO: '2026-08-10T10:00:00.000Z',
    status: 'paid',
  };

  Object.defineProperty(rawInvoice, 'currencyCode', {
    get() {
      getterCalls++;
      return 'ZAR';
    },
    enumerable: true,
  });

  const res = invoicePriceHistory([rawInvoice as unknown as SavedInvoice], {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });

  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'currency-property-unreadable');
  assert.equal(getterCalls, 0, 'Getter must never be executed');
});

test('stable multi-line identity, input order, and frozen immutability', () => {
  const inv1 = makeInvoice({
    id: 'inv-1',
    no: 10,
    currencyCode: 'ZAR',
    items: [
      { desc: 'Other item', qty: 1, unit: 'crates', price: 99 },
      { desc: 'Recorded produce', qty: 2, unit: 'crates', price: 30 },
      { desc: 'Recorded produce', qty: 3, unit: 'crates', price: 35 },
    ],
  });
  const inv2 = makeInvoice({
    id: 'inv-2',
    no: 20,
    currencyCode: 'ZAR',
    items: [{ desc: 'Recorded produce', qty: 1, unit: 'crates', price: 25 }],
  });

  const invoices = Object.freeze([inv1, inv2]);

  const res = invoicePriceHistory(invoices, {
    currencyCode: 'ZAR',
    desc: 'Recorded produce',
    unit: 'crates',
  });

  assert.equal(res.status, 'ready');
  assert.equal(res.choices.length, 3);

  // Line index and invoice ID preservation in original order
  assert.deepEqual(res.choices[0], {
    invoiceId: 'inv-1',
    invoiceNo: 10,
    lineIndex: 1,
    desc: 'Recorded produce',
    unit: 'crates',
    price: 30,
    currencyCode: 'ZAR',
    buyer: 'Buyer Corp',
    issuedISO: '2026-08-10T10:00:00.000Z',
  });
  assert.deepEqual(res.choices[1], {
    invoiceId: 'inv-1',
    invoiceNo: 10,
    lineIndex: 2,
    desc: 'Recorded produce',
    unit: 'crates',
    price: 35,
    currencyCode: 'ZAR',
    buyer: 'Buyer Corp',
    issuedISO: '2026-08-10T10:00:00.000Z',
  });
  assert.deepEqual(res.choices[2], {
    invoiceId: 'inv-2',
    invoiceNo: 20,
    lineIndex: 0,
    desc: 'Recorded produce',
    unit: 'crates',
    price: 25,
    currencyCode: 'ZAR',
    buyer: 'Buyer Corp',
    issuedISO: '2026-08-10T10:00:00.000Z',
  });

  // Verify immutability of result
  assert.equal(Object.isFrozen(res), true);
  assert.equal(Object.isFrozen(res.choices), true);
  for (const choice of res.choices) {
    assert.equal(Object.isFrozen(choice), true);
  }
});
