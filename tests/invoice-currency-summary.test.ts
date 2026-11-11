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
import { invoiceCurrencySummary } from '../lib/invoice-currency-summary';

const makeInvoice = (overrides: Record<string, unknown> = {}): SavedInvoice =>
  ({
    id: 'inv-1',
    no: 44,
    billTo: 'Buyer Corp',
    items: [{ desc: 'Recorded produce', qty: 2, unit: 'crates', price: 15.5 }],
    total: 31,
    dateISO: '2026-08-10T10:00:00.000Z',
    status: 'unpaid',
    ...overrides,
  } as SavedInvoice);

test('exact match calculates summary across all six supported pilot currencies', () => {
  for (const code of INVOICE_PILOT_CURRENCIES) {
    const invUnpaid = makeInvoice({
      id: `inv-unpaid-${code}`,
      no: 101,
      currencyCode: code,
      total: 50,
      status: 'unpaid',
    });
    const invPaid = makeInvoice({
      id: `inv-paid-${code}`,
      no: 102,
      currencyCode: code,
      total: 75,
      status: 'paid',
      paidAt: '2026-08-12T10:00:00.000Z',
    });

    const res = invoiceCurrencySummary([invUnpaid, invPaid], code);

    assert.equal(res.status, 'ready');
    assert.equal(res.currencyCode, code);
    assert.deepEqual(res.issued, { count: 2, total: 125 });
    assert.deepEqual(res.recordedPaid, { count: 1, total: 75 });
    assert.deepEqual(res.unpaid, { count: 1, total: 50 });
  }
});

test('legacy invoice with genuinely absent currencyCode matches ZAR filter only', () => {
  const legacyInv = makeInvoice({
    id: 'legacy-inv',
    no: 12,
    total: 100,
    status: 'unpaid',
  });
  assert.equal(Object.hasOwn(legacyInv, 'currencyCode'), false);

  // Matches ZAR
  const resZar = invoiceCurrencySummary([legacyInv], 'ZAR');
  assert.equal(resZar.status, 'ready');
  assert.equal(resZar.currencyCode, 'ZAR');
  assert.deepEqual(resZar.issued, { count: 1, total: 100 });
  assert.deepEqual(resZar.unpaid, { count: 1, total: 100 });
  assert.deepEqual(resZar.recordedPaid, { count: 0, total: 0 });

  // Does not match foreign currency (e.g. KES or USD)
  const resKes = invoiceCurrencySummary([legacyInv], 'KES');
  assert.equal(resKes.status, 'ready');
  assert.equal(resKes.currencyCode, 'KES');
  assert.deepEqual(resKes.issued, { count: 0, total: 0 });
});

test('present malformed or undefined currencyCode is held and never reinterpreted as legacy Rand', () => {
  const malformedUndefined = makeInvoice({
    id: 'inv-malformed',
    currencyCode: undefined, // present property with undefined value
  });
  assert.equal(Object.hasOwn(malformedUndefined, 'currencyCode'), true);

  const res1 = invoiceCurrencySummary([malformedUndefined], 'ZAR');
  assert.equal(res1.status, 'held');
  assert.equal(res1.reason, 'currency-outside-pilot');

  const malformedForeign = makeInvoice({
    id: 'inv-outside',
    currencyCode: 'CAD', // unverified outside pilot
  });
  const res2 = invoiceCurrencySummary([malformedForeign], 'ZAR');
  assert.equal(res2.status, 'held');
  assert.equal(res2.reason, 'currency-outside-pilot');
});

test('selection with non-pilot or malformed currency is held', () => {
  const inv = makeInvoice({ currencyCode: 'ZAR' });
  const badCurrencies = ['', '   ', 'zar', 'CAD', 710, null, undefined];

  for (const bad of badCurrencies) {
    const res = invoiceCurrencySummary([inv], bad);
    assert.equal(res.status, 'held');
    assert.equal(res.reason, 'currency-outside-pilot');
  }
});

test('cross-currency separation: excludes non-matching currencies without mixing totals', () => {
  const invZar = makeInvoice({
    id: 'inv-zar',
    no: 1,
    currencyCode: 'ZAR',
    total: 200,
    status: 'paid',
    paidAt: '2026-08-11T10:00:00.000Z',
  });
  const invKes = makeInvoice({
    id: 'inv-kes',
    no: 2,
    currencyCode: 'KES',
    total: 1500,
    status: 'unpaid',
  });
  const invUsd = makeInvoice({
    id: 'inv-usd',
    no: 3,
    currencyCode: 'USD',
    total: 50,
    status: 'unpaid',
  });

  const list = [invZar, invKes, invUsd];

  // Filtering for ZAR
  const resZar = invoiceCurrencySummary(list, 'ZAR');
  assert.equal(resZar.status, 'ready');
  assert.deepEqual(resZar.issued, { count: 1, total: 200 });
  assert.deepEqual(resZar.recordedPaid, { count: 1, total: 200 });
  assert.deepEqual(resZar.unpaid, { count: 0, total: 0 });

  // Filtering for KES
  const resKes = invoiceCurrencySummary(list, 'KES');
  assert.equal(resKes.status, 'ready');
  assert.deepEqual(resKes.issued, { count: 1, total: 1500 });
  assert.deepEqual(resKes.recordedPaid, { count: 0, total: 0 });
  assert.deepEqual(resKes.unpaid, { count: 1, total: 1500 });
});

test('actual unavailable loadInvoices() in Node without window has native coverage held and summary held', () => {
  // In Node environment without window/localStorage, loadInvoices() returns an array
  // covered with status: 'held', reason: 'storage-unavailable'
  const loaded = loadInvoices();
  const coverage = invoiceReadCoverage(loaded);
  assert.equal(coverage.status, 'held');
  assert.equal((coverage as any).reason, 'storage-unavailable');

  const res = invoiceCurrencySummary(loaded, 'ZAR');
  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'storage-unavailable');
});

test('valid empty array with complete coverage produces zero counts and totals', () => {
  const emptyInvoices: SavedInvoice[] = [];
  const res = invoiceCurrencySummary(emptyInvoices, 'ZAR');

  assert.equal(res.status, 'ready');
  assert.equal(res.currencyCode, 'ZAR');
  assert.deepEqual(res.issued, { count: 0, total: 0 });
  assert.deepEqual(res.recordedPaid, { count: 0, total: 0 });
  assert.deepEqual(res.unpaid, { count: 0, total: 0 });
});

test('legitimate zero totals are preserved as valid', () => {
  const zeroInv = makeInvoice({
    id: 'inv-zero',
    no: 1,
    currencyCode: 'ZAR',
    total: 0,
    status: 'unpaid',
  });

  const res = invoiceCurrencySummary([zeroInv], 'ZAR');
  assert.equal(res.status, 'ready');
  assert.deepEqual(res.issued, { count: 1, total: 0 });
  assert.deepEqual(res.unpaid, { count: 1, total: 0 });
});

test('paid without usable paidAt is held with reason invoice-paid-date-invalid; valid paid and unpaid are accepted', () => {
  // Paid without paidAt property must be held
  const invPaidNoDate = makeInvoice({
    id: 'inv-no-paid-at',
    no: 1,
    currencyCode: 'ZAR',
    total: 80,
    status: 'paid',
  });
  const resNoDate = invoiceCurrencySummary([invPaidNoDate], 'ZAR');
  assert.equal(resNoDate.status, 'held');
  assert.equal(resNoDate.reason, 'invoice-paid-date-invalid');

  // Paid with unusable paidAt string must be held
  const invPaidBadDate = makeInvoice({
    id: 'inv-bad-paid-at',
    no: 2,
    currencyCode: 'ZAR',
    total: 40,
    status: 'paid',
    paidAt: 'invalid-date',
  });
  const resBadDate = invoiceCurrencySummary([invPaidBadDate], 'ZAR');
  assert.equal(resBadDate.status, 'held');
  assert.equal(resBadDate.reason, 'invoice-paid-date-invalid');

  // Valid paid and valid unpaid are partitioned cleanly
  const invPaidValid = makeInvoice({
    id: 'inv-valid-paid-at',
    no: 3,
    currencyCode: 'ZAR',
    total: 100,
    status: 'paid',
    paidAt: '2026-08-15T12:00:00.000Z',
  });
  const invUnpaidValid = makeInvoice({
    id: 'inv-valid-unpaid',
    no: 4,
    currencyCode: 'ZAR',
    total: 60,
    status: 'unpaid',
  });

  const resValid = invoiceCurrencySummary([invPaidValid, invUnpaidValid], 'ZAR');
  assert.equal(resValid.status, 'ready');
  assert.deepEqual(resValid.issued, { count: 2, total: 160 });
  assert.deepEqual(resValid.recordedPaid, { count: 1, total: 100 });
  assert.deepEqual(resValid.unpaid, { count: 1, total: 60 });
});

test('duplicate invoice IDs are held even across different currencies before exclusion', () => {
  // Duplicate ID within same currency
  const inv1 = makeInvoice({
    id: 'duplicate-id-same',
    no: 1,
    currencyCode: 'ZAR',
    total: 50,
  });
  const inv2 = makeInvoice({
    id: 'duplicate-id-same',
    no: 2,
    currencyCode: 'ZAR',
    total: 70,
  });
  const resSame = invoiceCurrencySummary([inv1, inv2], 'ZAR');
  assert.equal(resSame.status, 'held');
  assert.equal(resSame.reason, 'duplicate-invoice-id');

  // Same duplicate ID across GBP and USD must be held before currency filtering
  const invGbp = makeInvoice({
    id: 'duplicate-id-cross',
    no: 1,
    currencyCode: 'GBP',
    total: 10,
  });
  const invUsd = makeInvoice({
    id: 'duplicate-id-cross',
    no: 2,
    currencyCode: 'USD',
    total: 20,
  });
  const resCross = invoiceCurrencySummary([invGbp, invUsd], 'GBP');
  assert.equal(resCross.status, 'held');
  assert.equal(resCross.reason, 'duplicate-invoice-id');

  // Distinct IDs in foreign currencies are accepted and filtered cleanly
  const invGbpDistinct = makeInvoice({
    id: 'inv-gbp-1',
    no: 1,
    currencyCode: 'GBP',
    total: 10,
  });
  const invUsdDistinct = makeInvoice({
    id: 'inv-usd-2',
    no: 2,
    currencyCode: 'USD',
    total: 20,
  });
  const resDistinct = invoiceCurrencySummary([invGbpDistinct, invUsdDistinct], 'GBP');
  assert.equal(resDistinct.status, 'ready');
  assert.deepEqual(resDistinct.issued, { count: 1, total: 10 });
});

test('missing or blank invoice ID is held', () => {
  const invNoId = makeInvoice({
    id: '',
    currencyCode: 'ZAR',
  });
  const res = invoiceCurrencySummary([invNoId], 'ZAR');
  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'invoice-row-unreadable');
});

test('invalid invoice status is held', () => {
  const invBadStatus = makeInvoice({
    id: 'inv-bad-status',
    currencyCode: 'ZAR',
    status: 'draft' as any,
  });
  const res = invoiceCurrencySummary([invBadStatus], 'ZAR');
  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'invoice-status-invalid');
});

test('malformed invoice metadata: non-positive number or invalid date is held', () => {
  const zeroNo = makeInvoice({ no: 0, currencyCode: 'ZAR' });
  const res1 = invoiceCurrencySummary([zeroNo], 'ZAR');
  assert.equal(res1.status, 'held');
  assert.equal(res1.reason, 'invoice-row-unreadable');

  const badDate = makeInvoice({ dateISO: 'not-a-date', currencyCode: 'ZAR' });
  const res2 = invoiceCurrencySummary([badDate], 'ZAR');
  assert.equal(res2.status, 'held');
  assert.equal(res2.reason, 'invoice-row-unreadable');
});

test('negative, NaN, or non-finite total is held', () => {
  const negTotal = makeInvoice({ total: -10, currencyCode: 'ZAR' });
  const res1 = invoiceCurrencySummary([negTotal], 'ZAR');
  assert.equal(res1.status, 'held');
  assert.equal(res1.reason, 'invoice-total-invalid');

  const nanTotal = makeInvoice({ total: NaN, currencyCode: 'ZAR' });
  const res2 = invoiceCurrencySummary([nanTotal], 'ZAR');
  assert.equal(res2.status, 'held');
  assert.equal(res2.reason, 'invoice-row-unreadable');
});

test('finite total aggregate overflow is held with invoice-total-overflow', () => {
  const invMax1 = makeInvoice({
    id: 'inv-max-1',
    no: 1,
    currencyCode: 'ZAR',
    total: Number.MAX_VALUE,
  });
  const invMax2 = makeInvoice({
    id: 'inv-max-2',
    no: 2,
    currencyCode: 'ZAR',
    total: Number.MAX_VALUE,
  });

  const res = invoiceCurrencySummary([invMax1, invMax2], 'ZAR');
  assert.equal(res.status, 'held');
  assert.equal(res.reason, 'invoice-total-overflow');
});

test('reflection throwing traps and revoked array proxies return held without throwing', () => {
  // Proxy whose getPrototypeOf throws
  const throwingProxy = new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new Error('Trap blocked getPrototypeOf');
      },
    },
  );
  const res1 = invoiceCurrencySummary([throwingProxy as any], 'ZAR');
  assert.equal(res1.status, 'held');
  assert.equal(res1.reason, 'invoice-row-unreadable');

  // Array proxy with throwing length property
  const throwingLengthArray = new Proxy([] as SavedInvoice[], {
    get(target, prop) {
      if (prop === 'length') throw new Error('Blocked length access');
      return Reflect.get(target, prop);
    },
  });
  const res2 = invoiceCurrencySummary(throwingLengthArray, 'ZAR');
  assert.equal(res2.status, 'held');
  assert.equal(res2.reason, 'invoices-unreadable');

  // Revoked array proxy
  const { proxy: revokedArray, revoke } = Proxy.revocable([] as SavedInvoice[], {});
  revoke();
  const res3 = invoiceCurrencySummary(revokedArray, 'ZAR');
  assert.equal(res3.status, 'held');
  assert.equal(res3.reason, 'invoices-unreadable');
});

test('canonical optional undefined fields on source invoice are safely omitted without failing', () => {
  const invWithOptionalUndefined = makeInvoice({
    currencyCode: 'ZAR',
    total: 45,
    dueDateISO: undefined,
    notes: undefined,
    reference: undefined,
    paperReference: undefined,
  });

  const res = invoiceCurrencySummary([invWithOptionalUndefined], 'ZAR');
  assert.equal(res.status, 'ready');
  assert.deepEqual(res.issued, { count: 1, total: 45 });
});

test('getter property on currencyCode, total, or array index is never invoked and returns held with zero getter calls', () => {
  let currencyGetterCalls = 0;
  const rawInvoiceCurrencyGetter = {
    id: 'inv-curr-getter',
    no: 99,
    billTo: 'Buyer',
    total: 100,
    dateISO: '2026-08-10T10:00:00.000Z',
    status: 'unpaid',
  };
  Object.defineProperty(rawInvoiceCurrencyGetter, 'currencyCode', {
    get() {
      currencyGetterCalls++;
      return 'ZAR';
    },
    enumerable: true,
  });

  const resCurr = invoiceCurrencySummary([rawInvoiceCurrencyGetter as unknown as SavedInvoice], 'ZAR');
  assert.equal(resCurr.status, 'held');
  assert.equal(resCurr.reason, 'currency-property-unreadable');
  assert.equal(currencyGetterCalls, 0, 'Currency getter must never be executed');

  let totalGetterCalls = 0;
  const rawInvoiceTotalGetter = {
    id: 'inv-total-getter',
    no: 100,
    billTo: 'Buyer',
    currencyCode: 'ZAR',
    dateISO: '2026-08-10T10:00:00.000Z',
    status: 'unpaid',
  };
  Object.defineProperty(rawInvoiceTotalGetter, 'total', {
    get() {
      totalGetterCalls++;
      return 150;
    },
    enumerable: true,
  });

  const resTotal = invoiceCurrencySummary([rawInvoiceTotalGetter as unknown as SavedInvoice], 'ZAR');
  assert.equal(resTotal.status, 'held');
  assert.equal(resTotal.reason, 'invoice-row-unreadable');
  assert.equal(totalGetterCalls, 0, 'Total getter must never be executed');

  let arrayGetterCalls = 0;
  const arr = [] as SavedInvoice[];
  Object.defineProperty(arr, '0', {
    get() {
      arrayGetterCalls++;
      return makeInvoice({ currencyCode: 'ZAR' });
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(arr, 'length', { value: 1, writable: true });

  const resArr = invoiceCurrencySummary(arr, 'ZAR');
  assert.equal(resArr.status, 'held');
  assert.equal(resArr.reason, 'invoice-row-unreadable');
  assert.equal(arrayGetterCalls, 0, 'Array index getter must never be executed');
});

test('frozen output and immutability: results and groups are frozen and original inputs unchanged', () => {
  const inv = makeInvoice({
    id: 'inv-freeze',
    no: 1,
    currencyCode: 'ZAR',
    total: 100,
    status: 'unpaid',
  });
  const list = Object.freeze([inv]);

  const res = invoiceCurrencySummary(list, 'ZAR');
  assert.equal(res.status, 'ready');
  assert.equal(Object.isFrozen(res), true);
  assert.equal(Object.isFrozen(res.issued), true);
  assert.equal(Object.isFrozen(res.recordedPaid), true);
  assert.equal(Object.isFrozen(res.unpaid), true);

  // Original invoice remains untouched
  assert.equal(inv.total, 100);
});
