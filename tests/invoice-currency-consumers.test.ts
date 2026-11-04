import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import type { SavedInvoice } from '../lib/invoices';
import type { SalesLog, ProductionLog, ExpenseLog } from '../lib/db/types';
import type { InvoiceStorageLocks } from '../lib/invoice-storage';

// Only Firebase authentication is controlled. Model projection, coverage proofs,
// canonical storage, receipts and read-only lease behavior are production code.
const coverageActor = { uid: 'owner' as string | null };
Object.assign(globalThis, { __invoiceConsumerCoverageActor: coverageActor });
const libraryUrl = new URL('../lib/', import.meta.url).href;
const codeUrl = (code: string) => ({ shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(code)}` });
const coverageHook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.startsWith(libraryUrl) && ['./firebase/init', '@/lib/firebase/init'].includes(specifier)) return codeUrl(`
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__invoiceConsumerCoverageActor.uid;return uid?{uid}:null;}}});`);
  if (context.parentURL?.endsWith('/lib/length-unit-preference.ts') && specifier === 'firebase/auth') return codeUrl(`
    export const onAuthStateChanged=()=>()=>{};`);
  return next(specifier, context);
} });
const { cashIncomeTotal, cashLedgerSales, invoiceSalesForPaidInvoice, invoiceQuantitiesForPaidInvoice,
  reviewInvoiceRandBasis, reviewInvoiceRandPeriod, reviewInvoiceReadCoverage, mergeInvoiceRandReviews, invoiceRandReviewMessage } = await import('../lib/invoice-sales');
const { buildFinanceSeries } = await import('../lib/finance-series');
const { buildAreaReturns } = await import('../lib/area-returns');
const { buildFarmMetrics } = await import('../lib/farm-metrics');
const { buildFarmReport } = await import('../lib/farm-report');
const { buildMonthlyCashFlow, creditPackCashFlowSummary, creditPackIncomeConsistency, creditPackTrackRecord, hasEnoughForConsistencyTrend } = await import('../lib/credit-pack');
const { buildCreditPackPreviewPdf, buildCreditPackPdf, CreditPackCurrencyHeldError } = await import('../lib/credit-pack-pdf');
const invoiceModel = await import('../lib/invoices');
const invoiceStorage = await import('../lib/invoice-storage');
const accountStorage = await import('../lib/account-local-storage');
after(() => { coverageHook.deregister(); Reflect.deleteProperty(globalThis, '__invoiceConsumerCoverageActor'); });

const now = new Date('2026-09-15T12:00:00');
const invoice = (extra: Record<string, unknown> = {}): SavedInvoice => ({ id: 'invoice-a', no: 1, billTo: 'Buyer',
  items: [{ desc: 'Recorded produce', qty: 4, unit: 'kg', price: 5 }], total: 20,
  dateISO: '2026-09-01T12:00:00', status: 'paid', paidAt: '2026-09-02T12:00:00', enterprise: 'vegetables', ...extra });
const sale: SalesLog = { id: 'sale-a', profile_id: 'owner', garden_id: null, crop: 'Recorded produce', kg: 4,
  amount: 20, buyer: null, sold_at: '2026-09-02T12:00:00', created_at: '2026-09-02T12:00:00', invoice_id: 'invoice-a' };
const production: ProductionLog = { id: 'harvest-a', profile_id: 'owner', garden_id: null, crop: 'Recorded produce', kg: 6,
  photo_url: null, logged_at: '2026-09-01T12:00:00', created_at: '2026-09-01T12:00:00' };
const expense: ExpenseLog = { id: 'cost-a', profile_id: 'owner', garden_id: null, item: 'Recorded cost', amount: 3,
  supplier: null, spent_at: '2026-09-03T12:00:00', created_at: '2026-09-03T12:00:00', enterprise: 'vegetables' };
const beds = [{ id: 'bed-a', label: 'Measured area', areaM2: 10 }];
const foreign = () => invoice({ currencyCode: 'KES' });

class InvoiceCoverageMemoryStorage {
  rows = new Map<string, string>();
  unreadable = false;
  getItem(key: string) { if (this.unreadable) throw Error('Controlled storage read failure'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
}
class InvoiceCoverageLocks implements InvoiceStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    if (this.held.has(name)) return run(null);
    this.held.add(name);
    try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
async function withLoadedInvoiceRows(rows: unknown[], options: { unavailable?: boolean; readOnly?: boolean }, run: (loaded: SavedInvoice[], local: InvoiceCoverageMemoryStorage) => Promise<void> | void) {
  const original = new Map(['window', 'localStorage', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new InvoiceCoverageMemoryStorage(), session = new InvoiceCoverageMemoryStorage(), locks = new InvoiceCoverageLocks();
  const win = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  invoiceStorage.releaseAllDocumentInvoiceLeases();
  accountStorage.bindMountedAccountLocalStorageUid('owner');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
  try {
    const legacyKey = accountStorage.activeAccountLocalStorageKey(invoiceStorage.INVOICE_LEGACY_KEY);
    local.rows.set(legacyKey, JSON.stringify(rows));
    assert.equal((await invoiceStorage.initialiseInvoiceStorage(undefined, locks)).writable, true, 'actual canonical initialization must succeed');
    if (options.readOnly) {
      invoiceStorage.releaseAllDocumentInvoiceLeases(); await Promise.resolve();
      const otherWriter: InvoiceStorageLocks = { async request<T>(_name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> { return run(null); } };
      assert.equal((await invoiceStorage.initialiseInvoiceStorage(undefined, otherWriter)).writable, false);
    }
    local.unreadable = Boolean(options.unavailable);
    const loaded = invoiceModel.loadInvoices();
    const before = new Map(local.rows);
    await run(loaded, local);
    assert.deepEqual(local.rows, before, 'financial reads and derived views must not rewrite retained raw evidence');
  } finally {
    local.unreadable = false; invoiceStorage.releaseAllDocumentInvoiceLeases();
    win.dispatchEvent(new Event('pagehide')); await Promise.resolve();
    accountStorage.bindMountedAccountLocalStorageUid(null);
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
}

test('legacy and explicitly recorded rand keep the same cash arithmetic and produce observations', () => {
  for (const row of [invoice(), invoice({ currencyCode: 'ZAR' })]) {
    assert.equal(cashIncomeTotal([sale], [row]), 20);
    const series = buildFinanceSeries([production], [sale], [expense], [row], now, 1);
    assert.equal(series.totalInZar, 20); assert.equal(series.totalNetZar, 17);
    assert.equal(series.totalSoldKg, 4); assert.equal(series.totalProducedKg, 6);
    assert.equal(series.moneyReview.status, 'ready');
    const area = buildAreaReturns(beds, [sale], [expense], [row], 'month', now);
    assert.equal(area.cards[0].contributionPerM2, 1.7);
    assert.equal(creditPackTrackRecord([production], [sale], [row]).totalRevenueZar, 20);
  }
});

test('foreign invoices hold rand income without resurrecting linked sales or losing recorded quantities', () => {
  const row = foreign();
  assert.equal(cashIncomeTotal([sale], [row]), null);
  assert.deepEqual(cashLedgerSales([sale], [row.id]), []);
  assert.deepEqual(invoiceSalesForPaidInvoice(row), []);
  const quantities = invoiceQuantitiesForPaidInvoice(row);
  assert.equal(quantities.length, 1); assert.equal(quantities[0].kg, 4);
  assert.equal(Object.hasOwn(quantities[0], 'amount'), false);
  const series = buildFinanceSeries([production], [sale], [expense], [row], now, 1);
  assert.equal(series.totalInZar, null); assert.equal(series.totalNetZar, null);
  assert.equal(series.totalOutZar, 3); assert.equal(series.totalSoldKg, 4);
  const september = series.months.find(month => month.key === '2026-09')!;
  assert.equal(september.moneyInZar, null); assert.equal(september.runningZar, null);
  assert.equal(series.moneyReview.foreignRecordedCount, 1);
});

test('present malformed currencies cannot be read as historical rand and currency getters are not called', () => {
  let gets = 0;
  const accessor = invoice(); Object.defineProperty(accessor, 'currencyCode', { enumerable: true, get() { gets++; return 'ZAR'; } });
  for (const row of [invoice({ currencyCode: undefined }), invoice({ currencyCode: null }), invoice({ currencyCode: 'zar' }), accessor]) {
    assert.equal(reviewInvoiceRandBasis([row]).status, 'held');
    assert.equal(cashIncomeTotal([], [row]), null);
    assert.equal(buildMonthlyCashFlow([], [], now, 1, [row])[0].incomeZar, null);
  }
  assert.equal(gets, 0);
});

test('currency holds follow the payment period and unpaid invoices do not block received cash', () => {
  // The existing chart deliberately clamps its window to at least two months.
  assert.equal(buildFinanceSeries([], [], [], [foreign()], new Date('2026-11-15T12:00:00'), 2).totalInZar, 0);
  assert.equal(cashIncomeTotal([], [foreign(), invoice({ id: 'unpaid', currencyCode: 'EUR', status: 'unpaid' })]), null);
  assert.equal(cashIncomeTotal([], [invoice({ currencyCode: 'EUR', status: 'unpaid' })]), 0);
  const series = buildFinanceSeries([], [], [], [foreign()], new Date('2026-10-15T12:00:00'), 2);
  assert.equal(series.months[0].netZar, null);
  assert.equal(series.months[1].moneyInZar, 0);
  assert.equal(series.months[1].runningZar, null);
});

test('unusable payment dates remain a visible coverage gap and overlapping monthly reviews count them once', () => {
  const row = foreign(); delete row.paidAt;
  const period = reviewInvoiceRandPeriod([row], { status: 'paid', dateField: 'paidAt', inPeriod: () => false });
  assert.equal(period.undatedHeldCount, 1);
  const merged = mergeInvoiceRandReviews(period, reviewInvoiceRandPeriod([row], { status: 'paid', dateField: 'paidAt', inPeriod: () => true }));
  assert.equal(merged.foreignRecordedCount, 1); assert.equal(merged.undatedHeldCount, 1);
  assert.match(invoiceRandReviewMessage(merged)!, /period cannot be established/);
  Object.defineProperty(row, 'currencyCode', { value: 'ZAR', configurable: true });
  assert.equal(mergeInvoiceRandReviews(merged).foreignRecordedCount, 1, 'a completed review does not silently adopt mutated source objects');
  Object.defineProperty(row, 'currencyCode', { value: 'KES', configurable: true });
  const series = buildFinanceSeries([], [], [], [row], now, 2);
  assert.equal(series.totalInZar, null); assert.equal(series.moneyReview.undatedHeldCount, 1);
  const months = buildMonthlyCashFlow([], [], now, 2, [row]);
  assert.equal(months.length, 1); assert.equal(months[0].incomeZar, null);
});

test('area returns hold only affected tagged enterprises and never show foreign cash as an unassigned zero', () => {
  const area = buildAreaReturns(beds, [sale], [expense], [foreign()], 'month', now);
  assert.equal(area.cards[0].sales, null); assert.equal(area.cards[0].contributionPerM2, null);
  assert.equal(area.cards[0].costs, 3); assert.equal(area.cards[0].areaM2, 10);
  assert.equal(area.cards[1].moneyReview.status, 'ready'); assert.equal(area.cards[2].sales, null);
  const unassigned = buildAreaReturns(beds, [], [], [invoice({ currencyCode: 'GBP', enterprise: undefined })], 'month', now);
  assert.equal(unassigned.unassignedSales, null); assert.ok(unassigned.cards.every(card => card.sales === null));
});

test('farm crop and garden cash holds preserve measured harvest, sold quantity and unrelated costs', () => {
  const metrics = buildFarmMetrics([], beds, [production], [sale], [expense], 'month', now, [foreign()]);
  const crop = metrics.crops.find(row => row.cropName === 'Recorded produce')!;
  assert.equal(crop.harvestedKg, 6); assert.equal(crop.soldKg, 4); assert.equal(crop.hasSale, true);
  assert.equal(crop.turnoverZar, null); assert.equal(crop.priceZarPerKg, null);
  assert.equal(metrics.gardenMargins[0].salesZar, null); assert.equal(metrics.gardenMargins[0].grossMarginZar, null);
  assert.equal(metrics.gardenMargins[0].expensesZar, 3);
});

test('financial report detail keeps original denomination while all cash summaries and comparisons disclose holds', () => {
  const report = buildFarmReport({ kind: 'finance', period: 'month', now, farm: 'Recorded farm', sample: false,
    comparison: 'previous', production: [production], sales: [sale], expenses: [expense], invoices: [foreign()] });
  assert.equal(report.moneyReview.status, 'held');
  assert.equal(report.metrics.find(metric => metric.label === 'Money received')!.value, 'Not available');
  assert.equal(report.metrics.find(metric => metric.label === 'Recorded cash margin')!.value, 'Not available');
  assert.match(JSON.stringify(report.sections), /No exchange conversion/);
  const detail = report.tables.find(table => table.title === 'Cash record detail')!;
  assert.match(JSON.stringify(detail.rows), /KES/); assert.doesNotMatch(JSON.stringify(detail.rows), /R20/);
  const monthly = report.tables.find(table => table.title === 'Month by month')!;
  assert.match(JSON.stringify(monthly.rows), /Currency review required/);
  const comparison = report.tables.find(table => table.title === 'Historical period comparison')!;
  assert.match(JSON.stringify(comparison), /Currency review required/);
  const productionReport = buildFarmReport({ kind: 'production', period: 'month', now, farm: 'Recorded farm', sample: false,
    production: [production], sales: [sale], expenses: [], invoices: [foreign()] });
  assert.match(JSON.stringify(productionReport.tables), /4 kg/);
});

test('outstanding foreign invoices hold their separate snapshot without hiding known received rand', () => {
  const report = buildFarmReport({ kind: 'finance', period: 'month', now, farm: 'Farm', sample: false,
    production: [], sales: [], expenses: [], invoices: [invoice(), invoice({ id: 'unpaid', currencyCode: 'USD', status: 'unpaid', paidAt: undefined })] });
  assert.match(report.metrics.find(metric => metric.label === 'Money received')!.value, /20/);
  assert.equal(report.metrics.find(metric => metric.label === 'Unpaid invoices now')!.value, 'Not available');
  assert.match(JSON.stringify(report.tables.find(table => table.title.startsWith('Unpaid invoices'))!.rows), /USD/);
});

test('credit cash consistency and revenue hold while harvest and sales track record quantities remain', () => {
  const months = buildMonthlyCashFlow([sale], [expense], now, 1, [foreign()]);
  assert.equal(months[0].incomeZar, null); assert.equal(months[0].expensesZar, 3);
  const consistency = creditPackIncomeConsistency(months);
  assert.equal(consistency.monthsWithIncome, null); assert.equal(consistency.avgMonthlyIncomeZar, null);
  assert.equal(hasEnoughForConsistencyTrend(consistency), false);
  assert.equal(creditPackCashFlowSummary(months, [expense]).netZar, null);
  const track = creditPackTrackRecord([production], [sale], [foreign()]);
  assert.equal(track.totalRevenueZar, null); assert.equal(track.totalHarvestedKg, 6); assert.equal(track.totalSoldKg, 4);
  assert.equal(track.topCrops[0].revenueZar, null);
});

test('both direct credit PDF builders refuse foreign cash before any PDF generation', async () => {
  const input = { production: [production], sales: [sale], expenses: [expense], invoices: [foreign()], now };
  await assert.rejects(buildCreditPackPreviewPdf(input), CreditPackCurrencyHeldError);
  await assert.rejects(buildCreditPackPreviewPdf({ ...input, invoices: [invoice({ currencyCode: null })] }), CreditPackCurrencyHeldError);
  await assert.rejects(buildCreditPackPdf({ ...input, farmer: { name: 'Owner', farmName: 'Farm', phone: null } }), CreditPackCurrencyHeldError);
});

test('actual cash and area cards disclose withheld income instead of a zero result or empty-book instruction', async () => {
  const language = `data:text/javascript,${encodeURIComponent("export const useLanguage=()=>({lang:'en'});")}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === '@/lib/i18n') return { url: language, shortCircuit: true };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText };
      return next(url, context);
    },
  });
  try {
    const [{ default: CashflowChart }, { default: AreaReturnCards }] = await Promise.all([
      import('../components/CashflowChart.tsx'), import('../components/AreaReturnCards.tsx'),
    ]);
    const current = invoice({ currencyCode: 'KES', paidAt: new Date().toISOString() });
    const cash = renderToStaticMarkup(React.createElement(CashflowChart, { production: [], sales: [], expenses: [], invoices: [current], loading: false }));
    assert.match(cash, /Rand income and related results are unavailable/);
    assert.doesNotMatch(cash, /Cash surplus|Cash shortfall|No money recorded yet/);
    assert.doesNotMatch(cash, /<svg[^>]*role="img"/);
    const area = renderToStaticMarkup(React.createElement(AreaReturnCards, { beds, sales: [sale], expenses: [expense], invoices: [foreign()], period: 'month', now, loading: false }));
    assert.match(area, /Sales and contribution unavailable pending currency review/);
    assert.doesNotMatch(area, /R 20/);
    assert.match(area, /10 m/);
    const ready = renderToStaticMarkup(React.createElement(CashflowChart, { production: [], sales: [], expenses: [], invoices: [invoice({ currencyCode: 'ZAR', paidAt: current.paidAt })], loading: false }));
    assert.match(ready, /Cash surplus/); assert.match(ready, /<svg[^>]*role="img"/);
    assert.doesNotMatch(ready, /income and related results are unavailable/);
  } finally { hooks.deregister(); }
});

test('actual canonical hidden rows hold every scoped cash result without dropping the readable legacy or ZAR quantities', async () => {
  for (const basis of [{}, { currencyCode: 'ZAR' }]) await withLoadedInvoiceRows([invoice(basis), null], {}, async loaded => {
    assert.equal(loaded.length, 1, 'model projects only the actual readable row, without fake invoices');
    assert.equal(invoiceModel.invoiceReadCoverage(loaded).status, 'held');
    const review = reviewInvoiceRandPeriod(loaded, { status: 'paid', dateField: 'paidAt', inPeriod: () => false });
    assert.equal(review.status, 'held'); assert.equal(review.hiddenRowCount, 1);
    assert.equal(review.unreadableCurrencyCount, 0); assert.equal(review.foreignRecordedCount, 0);
    assert.equal(review.dateCoverageUnknown, true);
    assert.match(invoiceRandReviewMessage(review)!, /unreadable invoice row/);
    const selected = loaded.filter(row => row.status === 'paid');
    assert.equal(cashIncomeTotal([], selected, loaded), null);
    assert.equal(reviewInvoiceRandBasis(selected, loaded).hiddenRowCount, 1);
    const series = buildFinanceSeries([production], [sale], [expense], loaded, now, 2);
    assert.equal(series.totalInZar, null); assert.equal(series.totalSoldKg, 4); assert.equal(series.totalOutZar, 3);
    assert.equal(series.totalProducedKg, 6); assert.equal(series.totalKeptKg, null, 'unknown sale rows cannot support a kept balance');
    assert.ok(series.months.every(month => month.moneyInZar === null));
    const area = buildAreaReturns(beds, [sale], [expense], loaded, 'month', now);
    assert.ok(area.cards.every(card => card.sales === null)); assert.equal(area.cards[0].costs, 3);
    const metrics = buildFarmMetrics([], beds, [production], [sale], [expense], 'month', now, loaded);
    assert.equal(metrics.crops[0].soldKg, 4); assert.equal(metrics.crops[0].turnoverZar, null);
    assert.ok(metrics.gardenMargins.every(row => row.salesZar === null && row.grossMarginZar === null));
    const report = buildFarmReport({ kind: 'finance', period: 'month', now, farm: 'Farm', sample: false,
      comparison: 'previous', production: [production], sales: [sale], expenses: [expense], invoices: loaded });
    assert.equal(report.metrics.find(metric => metric.label === 'Money received')!.value, 'Not available');
    assert.match(JSON.stringify(report.sections), /payment status and period.*unknown/);
    assert.match(JSON.stringify(report.tables.find(table => table.title === 'Month by month')!.rows), /Currency review required/);
    const months = buildMonthlyCashFlow([sale], [expense], now, 2, loaded);
    assert.ok(months.every(month => month.incomeZar === null));
    assert.equal(creditPackCashFlowSummary(months, [expense]).moneyReview.hiddenRowCount, 1, 'monthly source gaps are not double counted');
    assert.equal(creditPackTrackRecord([production], [sale], loaded).totalSoldKg, 4);
    assert.equal(creditPackTrackRecord([production], [sale], loaded).totalRevenueZar, null);
    const [{ default: CashflowChart }, { default: AreaReturnCards }] = await Promise.all([
      import('../components/CashflowChart.tsx'), import('../components/AreaReturnCards.tsx'),
    ]);
    const cashHtml = renderToStaticMarkup(React.createElement(CashflowChart, { production: [production], sales: [sale], expenses: [expense], invoices: loaded, loading: false }));
    assert.match(cashHtml, /unreadable invoice row/); assert.doesNotMatch(cashHtml, /Cash surplus|Cash shortfall/);
    const areaHtml = renderToStaticMarkup(React.createElement(AreaReturnCards, { beds, sales: [sale], expenses: [expense], invoices: loaded, period: 'month', now, loading: false }));
    assert.match(areaHtml, /unreadable invoice row/); assert.doesNotMatch(areaHtml, /R 20/);
    await assert.rejects(buildCreditPackPreviewPdf({ production: [], sales: [], expenses: [], invoices: loaded }), error =>
      error instanceof CreditPackCurrencyHeldError && /unreadable invoice row/.test(error.message));
  });
});

test('an actual unreadable canonical book cannot become complete zero cash or an exportable empty credit book', async () => {
  await withLoadedInvoiceRows([invoice({ currencyCode: 'ZAR' })], { unavailable: true }, async loaded => {
    assert.deepEqual(loaded, []);
    const coverage = reviewInvoiceReadCoverage(loaded);
    assert.equal(coverage.status, 'held'); assert.equal(coverage.hiddenRowCount, 0);
    assert.equal(coverage.wholeBookUnavailable, true); assert.equal(coverage.dateCoverageUnknown, true);
    assert.equal(coverage.unreadableCurrencyCount, 0);
    assert.equal(cashIncomeTotal([], loaded), null);
    assert.equal(buildFinanceSeries([], [], [], loaded, now, 2).totalInZar, null);
    assert.ok(buildAreaReturns(beds, [], [], loaded, 'month', now).cards.every(card => card.sales === null));
    const metrics = buildFarmMetrics([], beds, [], [], [], 'month', now, loaded);
    assert.equal(metrics.moneyReview.wholeBookUnavailable, true); assert.equal(metrics.gardenMargins[0].salesZar, null);
    const months = buildMonthlyCashFlow([], [], now, 2, loaded);
    assert.equal(months.length, 1); assert.equal(months[0].incomeZar, null); assert.equal(months[0].saleCount, 0);
    assert.equal(creditPackIncomeConsistency(months).monthsWithIncome, null);
    const report = buildFarmReport({ kind: 'finance', period: 'month', now, farm: 'Farm', sample: false,
      production: [], sales: [], expenses: [], invoices: loaded });
    assert.equal(report.metrics.find(metric => metric.label === 'Money received')!.value, 'Not available');
    assert.match(JSON.stringify(report.sections), /book could not be fully read or confirmed/);
    const { default: CashflowChart } = await import('../components/CashflowChart.tsx');
    const cashHtml = renderToStaticMarkup(React.createElement(CashflowChart, { production: [], sales: [], expenses: [], invoices: loaded, loading: false }));
    assert.match(cashHtml, /book could not be fully read or confirmed/);
    assert.doesNotMatch(cashHtml, /No money recorded yet|Cash surplus|Cash shortfall/);
    await assert.rejects(buildCreditPackPreviewPdf({ production: [], sales: [], expenses: [], invoices: loaded }), error =>
      error instanceof CreditPackCurrencyHeldError && /book could not be fully read or confirmed/.test(error.message));
  });
});

test('coherent model-loaded legacy and ZAR books stay complete without an editing lease, but changed projected arrays lose coverage', async () => {
  for (const basis of [{}, { currencyCode: 'ZAR' }]) await withLoadedInvoiceRows([invoice(basis)], { readOnly: true }, loaded => {
    assert.equal(invoiceStorage.readInvoiceStorageStatus().writable, false);
    assert.deepEqual(invoiceModel.invoiceReadCoverage(loaded), { status: 'complete' });
    assert.equal(cashIncomeTotal([sale], loaded), 20);
    assert.equal(buildFinanceSeries([production], [sale], [expense], loaded, now, 2).totalNetZar, 17);
    loaded.push(invoice({ id: 'in-memory-change', currencyCode: 'ZAR' }));
    assert.equal(reviewInvoiceRandBasis(loaded).wholeBookUnavailable, true);
    assert.equal(cashIncomeTotal([], loaded), null);
  });
});
