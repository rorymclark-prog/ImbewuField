/**
 * credit-pack.ts — turning a farmer's own logged records into the shape a lender reads.
 *
 * WHY THIS EXISTS. Of 62 South African smallholders studied who applied for bank credit, 11 were
 * approved. A Permit to Occupy excludes most of them from collateral-based lending outright, and
 * the finding that matters here is the recommendation: lenders should weight a farmer's own
 * transaction and production record instead. ImbewuField already has that record — ProductionLog,
 * SalesLog and ExpenseLog are exactly the harvest, sale and cost history a lender would otherwise
 * have no way to see. This module reshapes it into what a lender actually reads: income
 * consistency over time, a cash-flow summary, and a harvest/sales track record.
 *
 * THE ONE RULE THIS FILE FOLLOWS. Every number here is a direct sum, count or average of rows the
 * farmer entered. Nothing is projected, scored, rated or estimated — no interest rate, no
 * creditworthiness figure, no forecast of next month. This repo has been burned by invented
 * numbers before (see lib/report-site-facts.ts, lib/plan-assurance.ts); a document a farmer hands
 * to a bank is exactly the wrong place to repeat that mistake, so it does not happen here.
 *
 * WHAT THIS FILE DOES NOT DO. It never decides whether a farmer qualifies for anything. It never
 * touches Firestore or sample mode — that gate lives in lib/credit-pack-pdf.ts, the one place that
 * turns this data into a file a farmer could hand to someone else. This module is pure so its
 * arithmetic can be tested without jsPDF, a DOM, or a network.
 */

import type { ExpenseCategory, ExpenseLog, ProductionLog, SalesLog } from './db/types';
import { buildCropAliasIndex, cropIdentityMapKey, cropIdentityOf } from './crop-identity';

/* ── Shared parsing helpers ──────────────────────────────────────────────── */

function parsedDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

/** A logged amount or weight is never negative here — a bad entry is dropped to zero rather than
 *  subtracted from a total it does not belong to (same rule as lib/farm-metrics.ts). */
function nonNegative(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : 0;
}

function median(sortedAscending: readonly number[]): number {
  if (sortedAscending.length === 0) return 0;
  const mid = Math.floor(sortedAscending.length / 2);
  return sortedAscending.length % 2 === 0
    ? (sortedAscending[mid - 1] + sortedAscending[mid]) / 2
    : sortedAscending[mid];
}

/* ── Monthly cash flow ───────────────────────────────────────────────────── */

export interface CreditPackMonth {
  /** 'YYYY-MM', zero-padded, sortable as a string. */
  monthKey: string;
  /** 'Jan 2026' — for the printed table. */
  label: string;
  incomeZar: number;
  expensesZar: number;
  netZar: number;
  saleCount: number;
  expenseCount: number;
}

/** How many trailing months the monthly table shows, at most. A lender document is a "last 12
 *  months" ask by convention; a farmer with a longer history still has it, just not tabulated here. */
export const CREDIT_PACK_TRAILING_MONTHS = 12;

function monthIndex(year: number, month0: number): number {
  return year * 12 + month0;
}

function monthFromIndex(idx: number): { year: number; month0: number } {
  const year = Math.floor(idx / 12);
  const month0 = idx - year * 12;
  return { year, month0 };
}

function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabelOf(year: number, month0: number): string {
  return new Date(year, month0, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

/**
 * Buckets sales and expenses into calendar months, one row per month, zero-filled — a month with
 * no sales is a real fact ("no income that month") and must appear as R0, not be skipped, or the
 * consistency picture this exists to show would flatter the farmer by omission.
 *
 * The window runs from the farmer's OWN earliest record up to `now`'s month, capped at
 * `monthsBack` trailing months. It never reaches back further than the farmer's own first entry —
 * padding the table with months before the farmer started logging would manufacture "missing"
 * income for a period ImbewuField was never in a position to record.
 */
export function buildMonthlyCashFlow(
  sales: readonly Pick<SalesLog, 'amount' | 'sold_at'>[],
  expenses: readonly Pick<ExpenseLog, 'amount' | 'spent_at'>[],
  now: Date,
  monthsBack: number = CREDIT_PACK_TRAILING_MONTHS,
): CreditPackMonth[] {
  if (!Number.isFinite(now.getTime())) return [];
  const nowIdx = monthIndex(now.getFullYear(), now.getMonth());

  let earliestIdx: number | null = null;
  const noteEarliest = (iso: string | null | undefined) => {
    const d = parsedDate(iso);
    if (!d) return;
    const idx = monthIndex(d.getFullYear(), d.getMonth());
    if (earliestIdx === null || idx < earliestIdx) earliestIdx = idx;
  };
  for (const row of sales) noteEarliest(row.sold_at);
  for (const row of expenses) noteEarliest(row.spent_at);
  if (earliestIdx === null) return []; // nothing dated — no window to build

  const span = Math.max(1, Math.trunc(monthsBack) || CREDIT_PACK_TRAILING_MONTHS);
  const windowStart = Math.max(earliestIdx, nowIdx - span + 1);
  if (windowStart > nowIdx) return [];

  const months = new Map<string, CreditPackMonth>();
  for (let idx = windowStart; idx <= nowIdx; idx++) {
    const { year, month0 } = monthFromIndex(idx);
    const key = `${year}-${String(month0 + 1).padStart(2, '0')}`;
    months.set(key, {
      monthKey: key,
      label: monthLabelOf(year, month0),
      incomeZar: 0,
      expensesZar: 0,
      netZar: 0,
      saleCount: 0,
      expenseCount: 0,
    });
  }

  for (const row of sales) {
    const d = parsedDate(row.sold_at);
    if (!d) continue;
    const bucket = months.get(monthKeyOf(d));
    if (!bucket) continue; // older than the window
    bucket.incomeZar += nonNegative(row.amount);
    bucket.saleCount += 1;
  }
  for (const row of expenses) {
    const d = parsedDate(row.spent_at);
    if (!d) continue;
    const bucket = months.get(monthKeyOf(d));
    if (!bucket) continue;
    bucket.expensesZar += nonNegative(row.amount);
    bucket.expenseCount += 1;
  }

  const out = [...months.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  for (const m of out) m.netZar = m.incomeZar - m.expensesZar;
  return out;
}

/* ── Income consistency ──────────────────────────────────────────────────── */

export interface CreditPackConsistency {
  monthsCovered: number;
  monthsWithIncome: number;
  /** monthsWithIncome / monthsCovered, 0 when there is no window at all. */
  consistencyRatio: number;
  /** Averaged across every covered month, quiet months included — the honest figure for
   *  "how much do they actually bring in most months", not "how much when they sell something". */
  avgMonthlyIncomeZar: number;
  medianMonthlyIncomeZar: number;
  bestMonth: CreditPackMonth | null;
  /** The lowest-income month AMONG months that had a sale — comparing it against a R0 month would
   *  not tell a lender anything about the farmer's leanest active month. */
  leanestActiveMonth: CreditPackMonth | null;
}

/** Below this many active months, "consistency over time" is not a claim the data can support. */
export const MIN_MONTHS_WITH_INCOME_FOR_TREND = 2;

export function creditPackIncomeConsistency(months: readonly CreditPackMonth[]): CreditPackConsistency {
  const monthsCovered = months.length;
  const withIncome = months.filter((m) => m.incomeZar > 0);
  const monthsWithIncome = withIncome.length;
  const totalIncome = months.reduce((s, m) => s + m.incomeZar, 0);
  const sortedIncomes = months.map((m) => m.incomeZar).sort((a, b) => a - b);

  let bestMonth: CreditPackMonth | null = null;
  let leanestActiveMonth: CreditPackMonth | null = null;
  for (const m of withIncome) {
    if (!bestMonth || m.incomeZar > bestMonth.incomeZar) bestMonth = m;
    if (!leanestActiveMonth || m.incomeZar < leanestActiveMonth.incomeZar) leanestActiveMonth = m;
  }

  return {
    monthsCovered,
    monthsWithIncome,
    consistencyRatio: monthsCovered > 0 ? monthsWithIncome / monthsCovered : 0,
    avgMonthlyIncomeZar: monthsCovered > 0 ? totalIncome / monthsCovered : 0,
    medianMonthlyIncomeZar: median(sortedIncomes),
    bestMonth,
    leanestActiveMonth,
  };
}

export function hasEnoughForConsistencyTrend(
  consistency: Pick<CreditPackConsistency, 'monthsWithIncome'>,
): boolean {
  return consistency.monthsWithIncome >= MIN_MONTHS_WITH_INCOME_FOR_TREND;
}

/* ── Cash flow summary ───────────────────────────────────────────────────── */

export interface CreditPackExpenseCategoryTotal {
  category: ExpenseCategory | 'uncategorised';
  zar: number;
  count: number;
}

export interface CreditPackCashFlowSummary {
  totalIncomeZar: number;
  totalExpensesZar: number;
  netZar: number;
  monthsCovered: number;
  /** Highest total first. Only categories that actually appear in the window are listed. */
  byCategory: CreditPackExpenseCategoryTotal[];
}

/**
 * Totals over exactly the same window `months` covers, so the summary page and the monthly table
 * never disagree about what period they describe. Expense categories are counted the same way the
 * Finance screen counts them — untagged rows fall into 'uncategorised' rather than being dropped
 * or guessed at.
 */
export function creditPackCashFlowSummary(
  months: readonly CreditPackMonth[],
  expenses: readonly ExpenseLog[],
): CreditPackCashFlowSummary {
  const totalIncomeZar = months.reduce((s, m) => s + m.incomeZar, 0);
  const totalExpensesZar = months.reduce((s, m) => s + m.expensesZar, 0);
  const inWindow = new Set(months.map((m) => m.monthKey));

  const totals = new Map<string, CreditPackExpenseCategoryTotal>();
  for (const row of expenses) {
    const d = parsedDate(row.spent_at);
    if (!d || !inWindow.has(monthKeyOf(d))) continue;
    const category = row.category ?? 'uncategorised';
    const current = totals.get(category) ?? { category, zar: 0, count: 0 };
    current.zar += nonNegative(row.amount);
    current.count += 1;
    totals.set(category, current);
  }

  return {
    totalIncomeZar,
    totalExpensesZar,
    netZar: totalIncomeZar - totalExpensesZar,
    monthsCovered: months.length,
    byCategory: [...totals.values()].sort((a, b) => b.zar - a.zar),
  };
}

/* ── Harvest / sales track record ────────────────────────────────────────── */

export interface CreditPackCropTotal {
  crop: string;
  harvestedKg: number;
  soldKg: number;
  revenueZar: number;
}

export interface CreditPackTrackRecord {
  harvestEntryCount: number;
  totalHarvestedKg: number;
  firstHarvestIso: string | null;
  lastHarvestIso: string | null;
  saleEntryCount: number;
  totalSoldKg: number;
  totalRevenueZar: number;
  firstSaleIso: string | null;
  lastSaleIso: string | null;
  /** Highest combined harvested+sold weight first, capped for a printed table. */
  topCrops: CreditPackCropTotal[];
}

export const MIN_HARVESTS_FOR_TRACK_RECORD = 1;
export const MIN_SALES_FOR_TRACK_RECORD = 1;
const TOP_CROPS_LIMIT = 6;


/** Every dated harvest and sale row, across the farmer's whole history (not windowed to the
 *  trailing months the cash-flow table uses) — a track record is stronger the longer it is. */
export function creditPackTrackRecord(
  production: readonly ProductionLog[],
  sales: readonly SalesLog[],
): CreditPackTrackRecord {
  const crops = new Map<string, CreditPackCropTotal>();
  const aliases = buildCropAliasIndex();
  /* WHICH CROP A ROW IS ABOUT — see lib/crop-identity.ts.
     This used to be `display.toLocaleLowerCase('en-ZA')`, i.e. the farmer's raw typing was the
     identity. A harvest arrives from a picker as the catalogue's "Avocado"; the sale of that same
     fruit is free-typed on /finances as "Avocados". Two keys, two rows, and the lender's page read
       Avocado  | 40 kg | 0 kg  | R0,00
       Avocados | 0 kg  | 25 kg | R500,00
     — one tree presented to a bank as a grower who never sells beside a seller who never grows,
     with "R0,00" printed against fruit the farmer had in fact sold. Both halves are true sums, and
     the file's promise that every number is a direct total of the farmer's own rows held the whole
     time. What was invented was the IDENTITY those true totals were filed under. */
  const ensureCrop = (name: string): CreditPackCropTotal => {
    const identity = cropIdentityOf(name, aliases);
    const key = cropIdentityMapKey(identity);
    const existing = crops.get(key);
    if (existing) return existing;
    const created: CreditPackCropTotal = { crop: identity.label, harvestedKg: 0, soldKg: 0, revenueZar: 0 };
    crops.set(key, created);
    return created;
  };

  let harvestEntryCount = 0;
  let totalHarvestedKg = 0;
  let firstHarvestMs: number | null = null;
  let firstHarvestIso: string | null = null;
  let lastHarvestMs: number | null = null;
  let lastHarvestIso: string | null = null;
  for (const row of production) {
    const d = parsedDate(row.logged_at);
    if (!d) continue;
    harvestEntryCount += 1;
    const kg = nonNegative(row.kg);
    totalHarvestedKg += kg;
    ensureCrop(row.crop).harvestedKg += kg;
    const ms = d.getTime();
    if (firstHarvestMs === null || ms < firstHarvestMs) { firstHarvestMs = ms; firstHarvestIso = row.logged_at; }
    if (lastHarvestMs === null || ms > lastHarvestMs) { lastHarvestMs = ms; lastHarvestIso = row.logged_at; }
  }

  let saleEntryCount = 0;
  let totalSoldKg = 0;
  let totalRevenueZar = 0;
  let firstSaleMs: number | null = null;
  let firstSaleIso: string | null = null;
  let lastSaleMs: number | null = null;
  let lastSaleIso: string | null = null;
  for (const row of sales) {
    const d = parsedDate(row.sold_at);
    if (!d) continue;
    saleEntryCount += 1;
    const kg = nonNegative(row.kg);
    const amount = nonNegative(row.amount);
    totalSoldKg += kg;
    totalRevenueZar += amount;
    const crop = ensureCrop(row.crop);
    crop.soldKg += kg;
    crop.revenueZar += amount;
    const ms = d.getTime();
    if (firstSaleMs === null || ms < firstSaleMs) { firstSaleMs = ms; firstSaleIso = row.sold_at; }
    if (lastSaleMs === null || ms > lastSaleMs) { lastSaleMs = ms; lastSaleIso = row.sold_at; }
  }

  const topCrops = [...crops.values()]
    .filter((c) => c.harvestedKg > 0 || c.soldKg > 0)
    .sort((a, b) => (b.harvestedKg + b.soldKg) - (a.harvestedKg + a.soldKg))
    .slice(0, TOP_CROPS_LIMIT);

  return {
    harvestEntryCount,
    totalHarvestedKg,
    firstHarvestIso,
    lastHarvestIso,
    saleEntryCount,
    totalSoldKg,
    totalRevenueZar,
    firstSaleIso,
    lastSaleIso,
    topCrops,
  };
}

export function hasHarvestHistory(record: Pick<CreditPackTrackRecord, 'harvestEntryCount'>): boolean {
  return record.harvestEntryCount >= MIN_HARVESTS_FOR_TRACK_RECORD;
}

export function hasSalesHistory(record: Pick<CreditPackTrackRecord, 'saleEntryCount'>): boolean {
  return record.saleEntryCount >= MIN_SALES_FOR_TRACK_RECORD;
}

/* ── Whole-document gate ─────────────────────────────────────────────────── */

/** Nothing at all to report — the button that builds this document should be disabled rather than
 *  producing an empty PDF with a farmer's name on it and no records underneath. */
export function creditPackHasAnyRecords(
  production: readonly ProductionLog[],
  sales: readonly SalesLog[],
  expenses: readonly ExpenseLog[],
): boolean {
  return production.length > 0 || sales.length > 0 || expenses.length > 0;
}

/* ── Framing text ────────────────────────────────────────────────────────── */

/**
 * Printed on the cover and repeated in the footer of every page. This is the one line standing
 * between "a useful record" and "a document that reads like an approval it never was" — see the
 * task this file was built for: a Permit to Occupy already excludes these farmers from
 * collateral-based lending, so the paperwork itself must not overclaim on their behalf either.
 */
export const CREDIT_PACK_ASSURANCE_ONE_LINE =
  'A summary of records this farmer logged themselves in ImbewuField — not a credit score, '
  + 'not a loan approval, and not a guarantee of future income. Material for a conversation with a lender.';

export const CREDIT_PACK_FRAMING_PARAGRAPHS: string[] = [
  'This document summarises the harvests, sales and costs that this farmer has logged in ImbewuField, in their own words and their own numbers. Nothing on the following pages is invented, projected or scored — every figure is a direct total of records already entered.',
  'It is meant to support a conversation with a lender, not to replace one. It is not a credit score, not a loan approval, and not a promise of future income. A lender should still ask their own questions and check these records against bank statements or other evidence.',
];
