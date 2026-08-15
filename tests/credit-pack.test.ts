// The lender document only earns trust if its arithmetic is exactly the farmer's own numbers —
// no projection, no score, no invented month. These tests check the aggregation, not the PDF
// drawing (see tests/credit-pack-pdf.test.ts for the sample-mode guard and filename).

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMonthlyCashFlow,
  creditPackCashFlowSummary,
  creditPackHasAnyRecords,
  creditPackIncomeConsistency,
  creditPackTrackRecord,
  hasEnoughForConsistencyTrend,
  hasHarvestHistory,
  hasSalesHistory,
  CREDIT_PACK_ASSURANCE_ONE_LINE,
  MIN_MONTHS_WITH_INCOME_FOR_TREND,
} from '@/lib/credit-pack';
import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';

const NOW = new Date('2026-08-15T09:00:00.000Z');

const sale = (amount: number, sold_at: string, crop = 'Spinach', kg = 10): SalesLog => ({
  id: `sale-${Math.random()}`, profile_id: 'f', garden_id: null, crop, kg, amount, buyer: null,
  sold_at, created_at: sold_at,
});
const expense = (amount: number, spent_at: string, category: ExpenseLog['category'] = 'seed'): ExpenseLog => ({
  id: `exp-${Math.random()}`, profile_id: 'f', garden_id: null, item: 'x', amount, supplier: null,
  spent_at, created_at: spent_at, category,
});
const harvest = (kg: number, logged_at: string, crop = 'Spinach'): ProductionLog => ({
  id: `prod-${Math.random()}`, profile_id: 'f', garden_id: null, crop, kg, photo_url: null,
  logged_at, created_at: logged_at,
});

/* ── buildMonthlyCashFlow ─────────────────────────────────────────────────── */

test('a month with no records is still shown, zeroed, not skipped', () => {
  const months = buildMonthlyCashFlow(
    [sale(500, '2026-06-10T00:00:00.000Z')],
    [],
    NOW,
  );
  const keys = months.map((m) => m.monthKey);
  // June, July and August (now) must all appear even though July had nothing logged.
  assert.deepEqual(keys, ['2026-06', '2026-07', '2026-08']);
  const july = months.find((m) => m.monthKey === '2026-07')!;
  assert.equal(july.incomeZar, 0);
  assert.equal(july.expensesZar, 0);
  assert.equal(july.saleCount, 0);
});

test('the window never reaches back before the farmer\'s own first record', () => {
  // Only two months of real history — the table must not manufacture ten empty months before it
  // to pad out a trailing-12 window, which would read as "no income" for a period ImbewuField
  // never had a chance to record.
  const months = buildMonthlyCashFlow(
    [sale(100, '2026-07-20T00:00:00.000Z')],
    [],
    NOW,
    12,
  );
  assert.deepEqual(months.map((m) => m.monthKey), ['2026-07', '2026-08']);
});

test('the trailing window is capped, even with years of history', () => {
  const sales = [
    sale(100, '2024-01-05T00:00:00.000Z'),
    sale(200, '2026-08-01T00:00:00.000Z'),
  ];
  const months = buildMonthlyCashFlow(sales, [], NOW, 3);
  assert.equal(months.length, 3);
  assert.deepEqual(months.map((m) => m.monthKey), ['2026-06', '2026-07', '2026-08']);
  // The 2024 sale falls outside the window and must not be counted anywhere in it.
  assert.equal(months.reduce((s, m) => s + m.incomeZar, 0), 200);
});

test('income and expenses land in the calendar month they were dated, summed and counted', () => {
  const months = buildMonthlyCashFlow(
    [sale(300, '2026-08-01T00:00:00.000Z'), sale(150, '2026-08-20T00:00:00.000Z')],
    [expense(80, '2026-08-05T00:00:00.000Z')],
    NOW,
  );
  const aug = months.find((m) => m.monthKey === '2026-08')!;
  assert.equal(aug.incomeZar, 450);
  assert.equal(aug.saleCount, 2);
  assert.equal(aug.expensesZar, 80);
  assert.equal(aug.expenseCount, 1);
  assert.equal(aug.netZar, 370);
});

test('a negative or non-finite amount is dropped to zero, never subtracted from the total', () => {
  const months = buildMonthlyCashFlow(
    [sale(-500, '2026-08-01T00:00:00.000Z'), sale(Number.NaN, '2026-08-02T00:00:00.000Z')],
    [],
    NOW,
  );
  const aug = months.find((m) => m.monthKey === '2026-08')!;
  assert.equal(aug.incomeZar, 0);
  // The row still counts as an entry logged, even though its amount could not be trusted.
  assert.equal(aug.saleCount, 2);
});

test('a row with an unparseable date is skipped entirely rather than crashing the window', () => {
  const months = buildMonthlyCashFlow(
    [sale(100, '2026-08-01T00:00:00.000Z'), sale(999, 'not-a-date')],
    [],
    NOW,
  );
  assert.equal(months.reduce((s, m) => s + m.incomeZar, 0), 100);
});

test('no dated sales or expenses at all produces an empty window, not a crash', () => {
  assert.deepEqual(buildMonthlyCashFlow([], [], NOW), []);
});

/* ── creditPackIncomeConsistency ──────────────────────────────────────────── */

test('consistency ratio and average are computed over every covered month, quiet months included', () => {
  const months = buildMonthlyCashFlow(
    [sale(1000, '2026-06-10T00:00:00.000Z'), sale(500, '2026-08-05T00:00:00.000Z')],
    [],
    NOW,
  ); // June, July (quiet), August
  const consistency = creditPackIncomeConsistency(months);
  assert.equal(consistency.monthsCovered, 3);
  assert.equal(consistency.monthsWithIncome, 2);
  assert.equal(consistency.consistencyRatio, 2 / 3);
  // (1000 + 0 + 500) / 3, not (1000 + 500) / 2 — the quiet month must pull the average down.
  assert.equal(consistency.avgMonthlyIncomeZar, 500);
});

test('best and leanest-active month ignore the zero months', () => {
  const months = buildMonthlyCashFlow(
    [sale(1000, '2026-06-10T00:00:00.000Z'), sale(200, '2026-08-05T00:00:00.000Z')],
    [],
    NOW,
  );
  const consistency = creditPackIncomeConsistency(months);
  assert.equal(consistency.bestMonth?.monthKey, '2026-06');
  // July had R0, but it is not the "leanest active" month — it never sold anything.
  assert.equal(consistency.leanestActiveMonth?.monthKey, '2026-08');
});

test('the consistency trend gate requires at least two active months', () => {
  const oneMonth = buildMonthlyCashFlow([sale(100, '2026-08-05T00:00:00.000Z')], [], NOW);
  assert.equal(creditPackIncomeConsistency(oneMonth).monthsWithIncome, 1);
  assert.equal(hasEnoughForConsistencyTrend(creditPackIncomeConsistency(oneMonth)), false);

  const twoMonths = buildMonthlyCashFlow(
    [sale(100, '2026-06-05T00:00:00.000Z'), sale(100, '2026-08-05T00:00:00.000Z')],
    [],
    NOW,
  );
  assert.equal(hasEnoughForConsistencyTrend(creditPackIncomeConsistency(twoMonths)), true);
  assert.equal(MIN_MONTHS_WITH_INCOME_FOR_TREND, 2);
});

/* ── creditPackCashFlowSummary ────────────────────────────────────────────── */

test('cash flow totals match the windowed months, and categories group correctly', () => {
  const sales = [sale(1000, '2026-08-01T00:00:00.000Z')];
  const expenses = [
    expense(200, '2026-08-02T00:00:00.000Z', 'seed'),
    expense(50, '2026-08-03T00:00:00.000Z', 'seed'),
    expense(30, '2026-08-04T00:00:00.000Z', 'fuel'),
    expense(999, '2020-01-01T00:00:00.000Z', 'fuel'), // years before the window — must not count
  ];
  const months = buildMonthlyCashFlow(sales, expenses, NOW);
  const summary = creditPackCashFlowSummary(months, expenses);
  assert.equal(summary.totalIncomeZar, 1000);
  assert.equal(summary.totalExpensesZar, 280);
  assert.equal(summary.netZar, 720);
  const seed = summary.byCategory.find((c) => c.category === 'seed')!;
  assert.equal(seed.zar, 250);
  assert.equal(seed.count, 2);
  // Highest total first.
  assert.equal(summary.byCategory[0].category, 'seed');
});

test('an expense with no category is grouped as uncategorised, not dropped', () => {
  const expenses = [expense(40, '2026-08-02T00:00:00.000Z', null)];
  const months = buildMonthlyCashFlow([], expenses, NOW);
  const summary = creditPackCashFlowSummary(months, expenses);
  assert.deepEqual(summary.byCategory, [{ category: 'uncategorised', zar: 40, count: 1 }]);
});

/* ── creditPackTrackRecord ────────────────────────────────────────────────── */

test('harvest and sale entry counts, totals and first/last dates', () => {
  const production = [harvest(20, '2026-05-01T00:00:00.000Z'), harvest(15, '2026-07-01T00:00:00.000Z')];
  const sales = [sale(300, '2026-06-01T00:00:00.000Z'), sale(150, '2026-08-01T00:00:00.000Z')];
  const record = creditPackTrackRecord(production, sales);
  assert.equal(record.harvestEntryCount, 2);
  assert.equal(record.totalHarvestedKg, 35);
  assert.equal(record.firstHarvestIso, '2026-05-01T00:00:00.000Z');
  assert.equal(record.lastHarvestIso, '2026-07-01T00:00:00.000Z');
  assert.equal(record.saleEntryCount, 2);
  assert.equal(record.totalSoldKg, 20);
  assert.equal(record.totalRevenueZar, 450);
  assert.equal(record.firstSaleIso, '2026-06-01T00:00:00.000Z');
  assert.equal(record.lastSaleIso, '2026-08-01T00:00:00.000Z');
});

test('first/last dates compare by real time, not by ISO string order', () => {
  // A +02:00 offset string sorts AFTER a Z string of the same or later instant when compared as
  // plain text, even when it is chronologically earlier once the offset is applied. Comparing by
  // Date.parse() avoids that trap.
  const production = [
    harvest(5, '2026-08-01T23:00:00+02:00'), // = 2026-08-01T21:00:00Z
    harvest(5, '2026-08-01T22:00:00Z'),      // one hour later in real time
  ];
  const record = creditPackTrackRecord(production, []);
  assert.equal(record.firstHarvestIso, '2026-08-01T23:00:00+02:00');
  assert.equal(record.lastHarvestIso, '2026-08-01T22:00:00Z');
});

test('crop totals merge case- and whitespace-insensitively, and rank by combined weight', () => {
  const production = [harvest(10, '2026-06-01T00:00:00.000Z', 'Spinach'), harvest(4, '2026-06-05T00:00:00.000Z', ' spinach ')];
  const sales = [sale(50, '2026-06-10T00:00:00.000Z', 'SPINACH', 5), sale(500, '2026-06-11T00:00:00.000Z', 'Amadumbe', 20)];
  const record = creditPackTrackRecord(production, sales);
  const spinach = record.topCrops.find((c) => c.crop === 'Spinach')!;
  assert.ok(spinach, 'case/whitespace variants of the same crop name should merge into one row');
  assert.equal(spinach.harvestedKg, 14);
  assert.equal(spinach.soldKg, 5);
  assert.equal(spinach.revenueZar, 50);
  // Amadumbe (20kg sold) outweighs spinach (14kg harvested + 5kg sold = 19) and ranks first.
  assert.equal(record.topCrops[0].crop, 'Amadumbe');
});

test('a blank crop name is labelled rather than left empty', () => {
  const record = creditPackTrackRecord([harvest(3, '2026-06-01T00:00:00.000Z', '   ')], []);
  assert.equal(record.topCrops[0].crop, 'Unnamed crop');
});

test('the harvest and sales history gates read entry counts, not weight', () => {
  assert.equal(hasHarvestHistory(creditPackTrackRecord([], [])), false);
  assert.equal(hasHarvestHistory(creditPackTrackRecord([harvest(0.1, '2026-06-01T00:00:00.000Z')], [])), true);
  assert.equal(hasSalesHistory(creditPackTrackRecord([], [])), false);
  assert.equal(hasSalesHistory(creditPackTrackRecord([], [sale(1, '2026-06-01T00:00:00.000Z')])), true);
});

test('an unparseable harvest or sale date is excluded from every count', () => {
  const record = creditPackTrackRecord(
    [harvest(999, 'not-a-date')],
    [sale(999, 'also-not-a-date')],
  );
  assert.equal(record.harvestEntryCount, 0);
  assert.equal(record.saleEntryCount, 0);
  assert.equal(record.totalHarvestedKg, 0);
  assert.equal(record.totalRevenueZar, 0);
});

/* ── creditPackHasAnyRecords ──────────────────────────────────────────────── */

test('the whole-document gate is true the moment any one log has a row', () => {
  assert.equal(creditPackHasAnyRecords([], [], []), false);
  assert.equal(creditPackHasAnyRecords([harvest(1, '2026-06-01T00:00:00.000Z')], [], []), true);
  assert.equal(creditPackHasAnyRecords([], [sale(1, '2026-06-01T00:00:00.000Z')], []), true);
  assert.equal(creditPackHasAnyRecords([], [], [expense(1, '2026-06-01T00:00:00.000Z')]), true);
});

/* ── Framing ───────────────────────────────────────────────────────────────── */

test('the assurance line never claims an approval, a score, or a guarantee', () => {
  const lower = CREDIT_PACK_ASSURANCE_ONE_LINE.toLowerCase();
  assert.ok(lower.includes('not a credit score'));
  assert.ok(lower.includes('not a loan approval') || lower.includes('not an approval'));
  assert.ok(lower.includes('not a guarantee'));
  assert.doesNotMatch(lower, /\bapproved\b|\bqualifies\b|\beligible\b/);
});
