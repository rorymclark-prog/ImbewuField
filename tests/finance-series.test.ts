import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildFinanceSeries, clampWindowMonths } from '@/lib/finance-series';
import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';

const NOW = new Date('2026-08-15T09:00:00');

const harvest = (id: string, kg: number, iso: string, crop = 'Swiss chard'): ProductionLog =>
  ({ id, profile_id: 'p', garden_id: null, crop, kg, photo_url: null, logged_at: iso, created_at: iso });

const sale = (id: string, kg: number, amount: number, iso: string, over: Partial<SalesLog> = {}): SalesLog =>
  ({ id, profile_id: 'p', garden_id: null, crop: 'Swiss chard', kg, amount, buyer: null, sold_at: iso, created_at: iso, ...over });

const cost = (id: string, amount: number, iso: string): ExpenseLog =>
  ({ id, profile_id: 'p', garden_id: null, item: 'Seed', amount, supplier: null, spent_at: iso, created_at: iso });

const invoice = (id: string, total: number, paidAt: string | null, items: SavedInvoice['items']): SavedInvoice => ({
  id, no: 1, billTo: 'Shop', items, total,
  dateISO: paidAt ?? '2026-08-01T00:00:00.000Z',
  status: paidAt ? 'paid' : 'unpaid',
  ...(paidAt ? { paidAt } : {}),
});

const at = (key: string) => (m: { key: string }) => m.key === key;

test('finance series: the window is the last N months, oldest first, and rolls the year', () => {
  const s = buildFinanceSeries([], [], [], [], NOW, 12);
  assert.equal(s.months.length, 12);
  assert.equal(s.months[0].key, '2025-09');
  assert.equal(s.months[0].longLabel, 'Sep 2025');
  assert.equal(s.months[11].key, '2026-08');
  assert.equal(s.months[11].longLabel, 'Aug 2026');
  assert.deepEqual(s.months.map((m) => m.label).slice(0, 5), ['Sep', 'Oct', 'Nov', 'Dec', 'Jan']);
});

test('finance series: month arithmetic on the 31st does not skip a month', () => {
  // new Date(2026, 7, 31).setMonth(-1) style arithmetic lands in a month with no
  // 31st and silently drops one from the axis. Anchoring on day 1 is the fix.
  const s = buildFinanceSeries([], [], [], [], new Date('2026-08-31T23:00:00'), 6);
  assert.deepEqual(s.months.map((m) => m.key), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']);
});

test('finance series: a paid invoice and its linked sale row are ONE income, not two', () => {
  // THE REGRESSION THIS STOPS. syncInvoiceSales writes a sales row for every kg
  // line of a paid invoice; summing sales AND the invoice total double-counts it.
  const inv = invoice('inv-1', 500, '2026-08-04T10:00:00', [{ desc: 'Swiss chard', qty: 20, unit: 'kg', price: 25 }]);
  const linked = sale('s-1', 20, 500, '2026-08-04T10:00:00', { invoice_id: 'inv-1', invoice_line: 0 });
  const s = buildFinanceSeries([], [linked], [], [inv], NOW, 12);
  const aug = s.months.find(at('2026-08'))!;
  assert.equal(aug.moneyInZar, 500, 'the invoice total, once');
  assert.equal(aug.soldKg, 20, 'and its kilograms, once');
  assert.equal(s.totalInZar, 500);
});

test('finance series: an invoice paid in bags contributes money but no kilograms', () => {
  // Non-kg lines never become sale rows because the app does not know their weight.
  // The money is still real; inventing a kg conversion for it would not be.
  const inv = invoice('inv-2', 300, '2026-07-09T10:00:00', [{ desc: 'Potatoes', qty: 4, unit: 'bags', price: 75 }]);
  const s = buildFinanceSeries([], [], [], [inv], NOW, 12);
  const jul = s.months.find(at('2026-07'))!;
  assert.equal(jul.moneyInZar, 300);
  assert.equal(jul.soldKg, 0);
});

test('finance series: an unpaid invoice is not income in any month', () => {
  const s = buildFinanceSeries([], [], [], [invoice('inv-3', 900, null, [{ desc: 'Kale', qty: 30, unit: 'kg', price: 30 }])], NOW, 12);
  assert.equal(s.totalInZar, 0);
  assert.equal(s.totalSoldKg, 0);
  assert.equal(s.hasRecords, false, 'an unpaid invoice is not a record of anything having happened');
});

test('finance series: kept is what stayed on the farm — produced minus sold', () => {
  const s = buildFinanceSeries(
    [harvest('h-1', 30, '2026-08-03T08:00:00')],
    [sale('s-1', 18, 400, '2026-08-05T08:00:00')],
    [], [], NOW, 12,
  );
  const aug = s.months.find(at('2026-08'))!;
  assert.equal(aug.producedKg, 30);
  assert.equal(aug.soldKg, 18);
  assert.equal(aug.keptKg, 12);
  assert.equal(aug.soldExceedsProduced, false);
});

test('finance series: selling more than was logged picked makes kept UNKNOWN, not negative', () => {
  // Mirrors CropRow.keptKg. A -4 kg segment is not a smaller truth than 12 kg, it
  // is evidence the harvest log is missing rows — and the chart must not draw it.
  const s = buildFinanceSeries(
    [harvest('h-1', 10, '2026-08-03T08:00:00')],
    [sale('s-1', 14, 300, '2026-08-05T08:00:00')],
    [], [], NOW, 12,
  );
  const aug = s.months.find(at('2026-08'))!;
  assert.equal(aug.soldExceedsProduced, true);
  assert.equal(aug.keptKg, null);
  assert.equal(aug.producedKg, 10, 'what WAS logged is still reported');
  assert.equal(aug.soldKg, 14);
});

test('finance series: the window total obeys the same kept rule as a month', () => {
  const overSold = buildFinanceSeries(
    [harvest('h-1', 5, '2026-06-03T08:00:00')],
    [sale('s-1', 9, 200, '2026-07-05T08:00:00')],
    [], [], NOW, 12,
  );
  assert.equal(overSold.totalKeptKg, null);

  const normal = buildFinanceSeries(
    [harvest('h-1', 20, '2026-06-03T08:00:00')],
    [sale('s-1', 9, 200, '2026-07-05T08:00:00')],
    [], [], NOW, 12,
  );
  assert.equal(normal.totalKeptKg, 11, 'across months, kept is still produced minus sold');
});

test('finance series: a month nobody wrote in is not a month of zero', () => {
  const s = buildFinanceSeries([harvest('h-1', 5, '2026-08-03T08:00:00')], [], [], [], NOW, 12);
  const aug = s.months.find(at('2026-08'))!;
  const jun = s.months.find(at('2026-06'))!;
  assert.equal(aug.hasRecords, true);
  assert.equal(jun.hasRecords, false);
  assert.equal(jun.producedKg, 0, 'the figure is still 0 — it is the flag that carries the difference');
});

test('finance series: an expense alone is a record', () => {
  const s = buildFinanceSeries([], [], [cost('x-1', 120, '2026-05-02T08:00:00')], [], NOW, 12);
  const may = s.months.find(at('2026-05'))!;
  assert.equal(may.hasRecords, true);
  assert.equal(may.moneyOutZar, 120);
  assert.equal(may.netZar, -120, 'a month can be negative and that is not an error');
});

test('finance series: the running total accumulates across the window from zero', () => {
  const s = buildFinanceSeries(
    [],
    [sale('s-1', 5, 400, '2026-06-05T08:00:00')],
    [cost('x-1', 100, '2026-07-05T08:00:00'), cost('x-2', 500, '2026-08-05T08:00:00')],
    [], NOW, 12,
  );
  assert.equal(s.months.find(at('2026-05'))!.runningZar, 0);
  assert.equal(s.months.find(at('2026-06'))!.runningZar, 400);
  assert.equal(s.months.find(at('2026-07'))!.runningZar, 300);
  assert.equal(s.months.find(at('2026-08'))!.runningZar, -200, 'the window can end behind');
  assert.equal(s.totalNetZar, -200);
});

test('finance series: records older than the window are counted as history, not lost', () => {
  // "No records in these months" and "you have never recorded anything" are
  // different sentences and the empty state has to be able to tell them apart.
  const s = buildFinanceSeries([harvest('h-1', 12, '2024-02-03T08:00:00')], [], [], [], NOW, 12);
  assert.equal(s.hasRecords, false, 'nothing inside the window');
  assert.equal(s.earlierRecords, true, 'but something before it');
  assert.equal(s.firstRecordLabel, 'Feb 2024');
});

test('finance series: no history at all reports no first record', () => {
  const s = buildFinanceSeries([], [], [], [], NOW, 12);
  assert.equal(s.hasRecords, false);
  assert.equal(s.earlierRecords, false);
  assert.equal(s.firstRecordLabel, null);
});

test('finance series: the same row arriving twice is counted once', () => {
  const row = harvest('h-1', 9, '2026-08-03T08:00:00');
  const s = buildFinanceSeries([row, { ...row }], [], [], [], NOW, 12);
  assert.equal(s.months.find(at('2026-08'))!.producedKg, 9);
});

test('finance series: an unusable or missing date drops the row rather than dating it today', () => {
  const s = buildFinanceSeries(
    [harvest('h-1', 40, 'not-a-date'), harvest('h-2', 7, '2026-08-03T08:00:00')],
    [], [], [], NOW, 12,
  );
  assert.equal(s.totalProducedKg, 7, 'the undated 40 kg is not silently stacked onto this month');
});

test('finance series: negative and non-finite quantities cannot bend a bar', () => {
  const s = buildFinanceSeries(
    [harvest('h-1', -5, '2026-08-03T08:00:00'), harvest('h-2', Number.NaN, '2026-08-03T08:00:00')],
    [], [cost('x-1', -80, '2026-08-04T08:00:00')], [], NOW, 12,
  );
  const aug = s.months.find(at('2026-08'))!;
  assert.equal(aug.producedKg, 0);
  assert.equal(aug.moneyOutZar, 0);
  assert.ok(Number.isFinite(aug.netZar));
});

test('finance series: the window length is clamped to something a chart can draw', () => {
  assert.equal(clampWindowMonths(400), 24);
  assert.equal(clampWindowMonths(0), 2);
  assert.equal(clampWindowMonths(6.7), 6);
  assert.equal(clampWindowMonths(Number.NaN), 12);
  assert.equal(buildFinanceSeries([], [], [], [], NOW, 999).months.length, 24);
});

test('finance series: the x-axis is never built from created_at', () => {
  // created_at is TYPED string but every writer sets it with serverTimestamp(), so
  // at runtime it is a Firestore Timestamp object. Bucketing by it would put every
  // row in the same wrong month, or none at all, and no unit test using plain
  // fixtures would catch it — the fixtures would be strings.
  const src = readFileSync(new URL('../lib/finance-series.ts', import.meta.url), 'utf8');
  const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!code.includes('created_at'), 'bucket by logged_at / sold_at / spent_at / paidAt only');
});
