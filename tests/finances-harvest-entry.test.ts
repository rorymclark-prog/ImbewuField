import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildFarmMetrics } from '../lib/farm-metrics.ts';
import type { ExpenseLog, ProductionLog, SalesLog } from '../lib/db/types.ts';
import type { SavedInvoice } from '../lib/invoices.ts';
import { cashLedgerSales } from '../lib/invoice-sales.ts';

test('Finances puts harvest logging one tap from the harvested-kilogram figure', () => {
  const source = readFileSync(new URL('../app/finances/page.tsx', import.meta.url), 'utf8');
  const recordsSource = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');
  const homeSource = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  const harvestLinks = source.match(/href="\/records"/g) ?? [];

  assert.equal(harvestLinks.length, 2, 'desktop and phone finance views must both link to the harvest form');
  assert.match(source, /<Sprout size=\{16\} \/>Log harvest/, 'the phone action must say what it records');
  assert.match(source, /<Sprout size=\{15\} \/>Log harvest/, 'the desktop action must say what it records');
  assert.match(homeSource, /href: '\/records'.*homeQuickMyRecords/, 'the home My Records action must use the same records screen');
  assert.match(recordsSource, /<MyRecords \/>/, 'the records screen must mount the real harvest and sales forms');
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

test('NGO farmer summary does not turn kept kilograms into a blanket-price money figure', () => {
  const source = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');
  assert.match(source, /Sales received/);
  assert.match(source, /Food kept:/);
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
