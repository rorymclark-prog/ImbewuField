import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildFarmMetrics, isInFinancePeriod } from '../lib/farm-metrics.ts';
import type { ExpenseLog, ProductionLog, SalesLog } from '../lib/db/types.ts';
import type { SavedInvoice } from '../lib/invoices.ts';
import { cashLedgerSales, cashIncomeTotal } from '../lib/invoice-sales.ts';

// WAS: "Finances puts harvest logging one tap from the harvested-kilogram figure", asserting two
// cross-page <Link href="/records"> from /finances. There is nothing to link to now — the Gogo
// Test merge put the kilogram figure and the harvest form in one book at /records, so "one tap"
// is a tab switch inside a single page. The rule survives the move: from the screen showing her
// harvested kilograms, recording another one must never be more than one tap away.
test('the money book puts harvest logging one tap from the harvested-kilogram figure', () => {
  const recordsSource = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');

  assert.match(recordsSource, /<Sprout size=\{15\} \/>Log harvest/, 'the desktop action must say what it records');
  assert.match(recordsSource, /onLogHarvest=\{\(\) => setTab\('picked'\)\}/,
    'the desktop sheet\'s Log harvest control must open the Picked page of the same book');
  assert.match(homeSource, /href: '\/records'.*homeQuickMyRecords/, 'the home My Records action must use the same records screen');
  assert.match(recordsSource, /<MyRecords section=\{tab\} onChanged=\{loadData\} \/>/,
    'the book must mount the real harvest and sales forms, and refresh its own totals when one saves');
  assert.doesNotMatch(recordsSource, /DataPanel|MapView/, 'logging weights must not require or render the land map');
});

test('Finance measures each crop from its own planned area and never assigns shared costs', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');
  const at = '2026-08-06T09:00:00.000Z';
  const harvest = (crop: string, kg: number): ProductionLog => ({ id: `harvest-${crop}`, profile_id: 'farmer', garden_id: 'garden-a', crop, kg, photo_url: null, logged_at: at, created_at: at });
  const sale = (crop: string, kg: number, amount: number): SalesLog => ({ id: `sale-${crop}`, profile_id: 'farmer', garden_id: 'garden-a', crop, kg, amount, buyer: null, sold_at: at, created_at: at });
  const expense = (id: string, amount: number, crop?: string): ExpenseLog => ({ id, profile_id: 'farmer', garden_id: 'garden-a', item: id, amount, supplier: null, spent_at: at, created_at: at, crop });
  const metrics = buildFarmMetrics(
    [{ id: 'p-spinach', bedId: 'bed-1', cropKey: 'swiss-chard', sowMonth: 8 }],
    [{ id: 'bed-1', label: 'Bed 1', areaM2: 4 }],
    [harvest('Spinach', 8), harvest('Tomatoes', 10)],
    [sale('Spinach', 4, 100), sale('Tomatoes', 5, 150)],
    [expense('seedlings', 20, 'Spinach'), expense('manure', 30)],
    'month', now,
  );

  const spinach = metrics.crops.find((crop) => crop.cropKey === 'swiss-chard');
  assert.ok(spinach);
  assert.equal(spinach.yieldKgPerM2, 2);
  assert.equal(spinach.turnoverZarPerM2, 25);
  assert.equal(spinach.priceZarPerKg, 25);
  assert.equal(spinach.taggedCostZarPerM2, 5);
  const tomatoes = metrics.crops.find((crop) => crop.cropName === 'Tomatoes');
  assert.ok(tomatoes);
  assert.equal(tomatoes.areaM2, null, 'the whole garden must never become a tomato denominator');
  assert.equal(tomatoes.yieldKgPerM2, null);
  assert.equal(metrics.unattributedExpensesZar, 30);
  assert.equal(metrics.gardenMargins[0].grossMarginZar, 200);
});

test('organisation summary labels unmatched harvest without inventing household use or value', () => {
  const source = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /Sales received/);
  // The difference between harvest and sales does not prove food was kept or eaten.
  assert.match(source, /Harvest not matched to sales:/);
  assert.doesNotMatch(source, /Food kept:/);
  assert.doesNotMatch(source, /kept\s*\*\s*15/);
});

test('garden gross margin includes paid invoice money that the headline includes', () => {
  const now = new Date('2026-08-06T12:00:00.000Z');
  const at = '2026-08-06T09:00:00.000Z';
  const invoice: SavedInvoice = {
    id: 'invoice-42', no: 42, billTo: 'Ubhejane parents fund',
    items: [{ desc: 'Spinach', qty: 4, unit: 'kg', price: 12.5 }], total: 50,
    dateISO: at, status: 'paid', paidAt: at, paymentMethod: 'eft',
  };
  const sales: SalesLog[] = [
    { id: 'direct', profile_id: 'farmer', garden_id: null, crop: 'Lettuce', kg: 5, amount: 114, buyer: null, sold_at: at, created_at: at },
  ];
  const expenses: ExpenseLog[] = [{ id: 'seed', profile_id: 'farmer', garden_id: null, item: 'Lettuce seed', amount: 35, supplier: null, spent_at: at, created_at: at }];
  const metrics = buildFarmMetrics(
    [{ id: 'spinach-bed', bedId: 'bed-1', cropKey: 'swiss-chard', sowMonth: 8 }],
    [{ id: 'bed-1', label: 'Bed 1', areaM2: 4 }],
    [], sales, expenses, 'month', now, [invoice],
  );
  const headlineSales = cashLedgerSales(sales, [invoice.id]).reduce((sum, sale) => sum + sale.amount, 0) + invoice.total;

  assert.equal(headlineSales - expenses[0].amount, metrics.gardenMargins[0].grossMarginZar);
  const spinach = metrics.crops.find((crop) => crop.cropKey === 'swiss-chard');
  assert.ok(spinach);
  assert.equal(spinach.turnoverZarPerM2, 12.5, 'paid invoice kg lines must count in crop turnover');
  assert.equal(spinach.priceZarPerKg, 12.5);
});

// THE SEASON VIEW LOST DECEMBER THE MOMENT THE CALENDAR CROSSED INTO JANUARY.
//
// 'season' spans Dec-Feb (SA summer), so the season a January date belongs to reaches back into
// the PRIOR calendar year. The finances page kept its own copy of that rule — check the calendar
// year matches, THEN check the month is in the season's month-set — which silently dropped every
// December sale, cost, harvest and paid invoice the instant the clock ticked into January: exactly
// the weeks right after a smallholder's peak December selling. lib/farm-metrics.ts already solved
// this correctly for FarmMetrics; the finances page now defers to that one implementation instead
// of keeping a second, buggier copy of the same rule.
test('the season view keeps December once the calendar has crossed into the new year', () => {
  const now = new Date('2026-01-15T09:00:00.000Z');
  assert.equal(
    isInFinancePeriod('2025-12-20T09:00:00.000Z', 'season', now),
    true,
    'December of the PRIOR calendar year is still this Dec-Feb season',
  );
  assert.equal(
    isInFinancePeriod('2025-11-20T09:00:00.000Z', 'season', now),
    false,
    'November is a different season entirely',
  );
  assert.equal(
    isInFinancePeriod('2024-12-20T09:00:00.000Z', 'season', now),
    false,
    'a December from a year further back is a different season, not this one',
  );

  const source = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(
    source,
    /function saSeasonMonths/,
    'the desktop sheet must not keep its own second copy of the season-boundary rule',
  );
  assert.match(
    source,
    /isInFinancePeriod\(/,
    'the desktop sheet, ledger and CSV export must filter periods with the shared, year-wrap-safe helper',
  );
});

// MY RECORDS REPORTED A REVENUE FIGURE THAT WAS BOTH TOO HIGH AND TOO LOW.
//
// It summed raw sales rows directly. A paid invoice's kg lines are ALSO written into sales rows
// (syncInvoiceSales tags them with invoice_id), so a farmer who marked an invoice paid saw that
// money twice once any equivalent invoice-total figure existed elsewhere — while an invoice paid
// entirely in bags, crates or trays (no kg line, so no synced sales row at all) contributed
// nothing to My Records' total, even though the money was real and the invoice said "Paid".
test('cashIncomeTotal counts a paid invoice exactly once, kg lines and non-kg lines alike', () => {
  const at = '2026-08-06T09:00:00.000Z';
  const invoice: SavedInvoice = {
    id: 'inv-1', no: 1, billTo: 'Spar Nquthu',
    items: [
      { desc: 'Spinach', qty: 4, unit: 'kg', price: 30 },
      { desc: 'Eggs', qty: 3, unit: 'trays', price: 45 },
    ],
    total: 4 * 30 + 3 * 45, // 255 — kg line (120) plus a tray line invoiceSalesForPaidInvoice skips
    dateISO: at, status: 'paid', paidAt: at,
  };
  // Exactly what syncInvoiceSales writes to sales_logs for the kg line above.
  const linkedKgSale: SalesLog = {
    id: 'linked', profile_id: 'farmer', garden_id: null, crop: 'Spinach', kg: 4, amount: 120,
    buyer: 'Spar Nquthu', sold_at: at, created_at: at, invoice_id: invoice.id, invoice_line: 0,
  };
  const manualSale: SalesLog = {
    id: 'manual', profile_id: 'farmer', garden_id: null, crop: 'Tomatoes', kg: 2, amount: 60,
    buyer: null, sold_at: at, created_at: at,
  };

  const total = cashIncomeTotal([linkedKgSale, manualSale], [invoice]);
  // 255 for the whole invoice (both lines) + 60 for the unrelated manual sale. The linked kg row's
  // 120 must not be added a second time, and the tray line's 135 must not be dropped.
  assert.equal(total, 315);
});

test('cashIncomeTotal never counts an unpaid invoice as money in hand', () => {
  const at = '2026-08-06T09:00:00.000Z';
  const invoice: SavedInvoice = {
    id: 'inv-2', no: 2, billTo: 'Spar Nquthu',
    items: [{ desc: 'Spinach', qty: 4, unit: 'kg', price: 30 }],
    total: 120, dateISO: at, status: 'unpaid',
  };
  assert.equal(cashIncomeTotal([], [invoice]), 0);
});

test('My Records reports revenue with the shared paid-invoice-aware total, not raw sales rows alone', () => {
  const source = readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');
  assert.match(
    source,
    /cashIncomeTotal\(sales, invoices\)/,
    'the revenue headline must fold in paid invoices through the shared helper',
  );
  assert.doesNotMatch(
    source,
    /reduce\(\(s, p\) => s \+ \(p\.amount/,
    'must not sum raw sales rows directly — that double-counts a paid invoice\'s kg lines and drops its non-kg lines',
  );
});
