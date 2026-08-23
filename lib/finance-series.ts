// The Finance screen's history, bucketed by month.
//
// Rory: "I want a graph option for actual production actual sales actual usage
// verse actual production verse estimate loss graph as well as a cashflow graph
// right at the top".
//
// Every figure in here is MEASURED — a row a farmer actually wrote down. That is
// the whole point of this module and the reason it is separate from
// lib/forward-harvests.ts and lib/plan-value.ts, which are the assumption side of
// the screen. Nothing here consults a catalog benchmark, a guide price or a
// slider. If it is not in production_logs, sales_logs, expense_logs or a paid
// invoice, it is not in this series.
//
// FOUR RULES THIS MODULE EXISTS TO HOLD:
//
// 1. MONEY IN IS NOT `sum(sales.amount)`. A paid invoice writes its kg lines into
//    sales_logs tagged with invoice_id, so adding the invoice total on top counts
//    them twice — while its bags-and-crates lines never became sales rows at all,
//    so summing sales alone loses them. cashIncomeTotal() is the one sum that gets
//    this right, and this module calls it once per month rather than re-deriving.
//
// 2. "KEPT" IS A RESIDUAL AND SOMETIMES UNKNOWABLE. produced − sold is the food
//    that stayed on the farm, and the moment sold exceeds produced that subtraction
//    is not small, it is WRONG: it means the harvest log is missing rows. Then kept
//    goes to null and the chart draws no segment, exactly as CropRow.keptKg does.
//
// 3. BUCKET BY THE EVENT DATE, NEVER `created_at`. Every writer sets created_at
//    with serverTimestamp(), so at runtime it is a Firestore Timestamp object, not
//    the string its type claims. logged_at / sold_at / spent_at / paidAt are real
//    ISO strings written by the app itself and are the only safe x-axis.
//
// 4. A MONTH WITH NO RECORDS IS NOT A MONTH OF ZERO. It is a month nobody wrote
//    anything down in. `hasRecords` carries that distinction so the chart can draw
//    a gap instead of a floor.
//
// KNOWN LIMIT OF THE X-AXIS, and it is not a small one: there is no date field on
// any of the logging forms. Every row is stamped `new Date().toISOString()` at the
// moment the farmer taps Save, so this is a series of WHEN THINGS WERE RECORDED,
// which is only the same as when they happened for a farmer who logs as they go.
// The UI must say so. Giving the forms a date field is the fix, and it belongs in
// its own change with its own tests — not smuggled in behind a chart.

import type { ExpenseLog, ProductionLog, SalesLog } from './db/types';
import type { SavedInvoice } from './invoices';
import { cashIncomeTotal, cashLedgerSales, invoiceSalesForPaidInvoice } from './invoice-sales';
import { produceDisplayName } from './perennial-produce';

export interface FinanceMonthPoint {
  year: number;
  /** 1-12, so it reads like a date rather than a Date.getMonth() index. */
  month: number;
  /** '2026-08' — stable identity for React keys and lookups. */
  key: string;
  /** 'Aug' — for a crowded axis. */
  label: string;
  /** 'Aug 2026' — for tooltips and anywhere the year is not already obvious. */
  longLabel: string;

  moneyInZar: number;
  moneyOutZar: number;
  /** in − out for this month alone. Negative is a real and common answer. */
  netZar: number;
  /**
   * Net summed from the first month of the window to this one.
   *
   * NOT a bank balance and must never be labelled one: the app has no opening
   * figure and no account. It answers "am I ahead or behind across these months",
   * starting from zero at the left edge of the chart.
   */
  runningZar: number;

  producedKg: number;
  soldKg: number;
  /** produced − sold, or null when that subtraction is not trustworthy. */
  keptKg: number | null;
  /** More was sold this month than was logged as picked. See rule 2. */
  soldExceedsProduced: boolean;

  /** Any record of any kind fell in this month. See rule 4. */
  hasRecords: boolean;
}

export interface FinanceSeries {
  months: FinanceMonthPoint[];
  windowMonths: number;

  totalInZar: number;
  totalOutZar: number;
  totalNetZar: number;
  totalProducedKg: number;
  totalSoldKg: number;
  /**
   * Kilograms a `countsKg` filter left out, and what they were.
   *
   * A chart that quietly drops rows reports a smaller farm than the farmer has. These carry what
   * was removed so the card can say it out loud — the same rule the capped axis follows in
   * lib/chart-scale.ts: hiding something is honest only while what was hidden is still on screen.
   *
   * PICKED AND SOLD ARE KEPT APART, and one summed figure is not offered, because their sum is not
   * a quantity of anything. Forty kilograms picked of which twenty-five were sold is forty
   * kilograms of fruit; reporting sixty-five names a heap that never existed, and matches none of
   * the three figures on the card it explains — picked lost 40, sold lost 25, kept lost 15.
   */
  excludedProducedKg: number;
  excludedSoldKg: number;
  excludedNames: string[];
  /** Null when the window's sales exceed its harvest log — same rule, applied to the total. */
  totalKeptKg: number | null;

  /** The window contains at least one record. */
  hasRecords: boolean;
  /** Records exist that fall BEFORE the window — so "nothing here" can be told from "nothing yet". */
  earlierRecords: boolean;
  /** 'Mar 2026' — the first month this farmer ever recorded anything, or null. */
  firstRecordLabel: string | null;
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Clamped so a caller cannot ask for a 400-month axis or a zero-month one. */
export function clampWindowMonths(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.min(24, Math.max(2, Math.trunc(value)));
}

/** '2026-08' for an ISO date string, or null when it is not a usable date. */
function monthKeyOf(iso: string | null | undefined): string | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  // Local time, matching isInFinancePeriod: one screen must not put the same row
  // in two different months depending on which card is reading it.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function positive(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * One persisted log per id. Local and remote lists get concatenated in places, and
 * a duplicated row would inflate a bar silently. Rows with no usable id stay
 * distinct — there is no honest way to tell two of those apart.
 */
function uniqueById<T extends { id?: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** The `windowMonths` month keys ending with the month containing `now`, oldest first. */
function windowKeys(now: Date, windowMonths: number): { year: number; month: number; key: string }[] {
  const out: { year: number; month: number; key: string }[] = [];
  const anchor = Number.isFinite(now.getTime()) ? now : new Date();
  for (let back = windowMonths - 1; back >= 0; back--) {
    // Day 1 avoids the classic month-arithmetic bug: setMonth() on the 31st of
    // August lands in October, silently dropping September from the axis.
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - back, 1);
    out.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    });
  }
  return out;
}

/**
 * Turn a farmer's whole logged history into a month-by-month measured series.
 *
 * `now` fixes the right-hand edge of the window; everything older than the window
 * is still read, but only to answer "are there earlier records" and "when did this
 * farmer start".
 */
export interface FinanceSeriesOptions {
  /**
   * Count this produce in the kilogram series? Default: everything counts.
   *
   * Used by the orchard switch — see lib/produce-scope.ts. It never touches the money figures, and
   * whatever it removes is reported back in `excludedKg` / `excludedNames`.
   */
  countsKg?: (cropName: string) => boolean;
}

export function buildFinanceSeries(
  production: readonly ProductionLog[],
  sales: readonly SalesLog[],
  expenses: readonly ExpenseLog[],
  invoices: readonly SavedInvoice[],
  now: Date,
  windowMonthsInput = 12,
  options: FinanceSeriesOptions = {},
): FinanceSeries {
  // Applied to the KILOGRAM series only, never to the money.
  //
  // Money in is a bank-statement question and an invoice total is one entry: it can carry a
  // delivery charge, a discount, or lines sold by the crate that never become kilograms at all.
  // Splitting that total between vegetables and fruit would be a claim the invoice does not make,
  // and it would break the one arithmetic rule this file exists to hold — that a paid invoice is
  // counted once. Kilograms carry a produce name on every row, so they can be filtered honestly.
  const countsKg = options.countsKg ?? (() => true);
  let excludedProducedKg = 0;
  let excludedSoldKg = 0;
  const excludedNames = new Set<string>();
  const kgOf = (name: string, kg: number, side: 'picked' | 'sold'): number => {
    const value = positive(kg);
    if (countsKg(name)) return value;
    if (value > 0) {
      if (side === 'picked') excludedProducedKg += value; else excludedSoldKg += value;
      // The catalogue's own name, so one fruit is named once however the two forms spelt it. A
      // farmer told "Avocado, Avocados" was left out has to wonder which of their trees is which.
      const label = produceDisplayName(name);
      if (label) excludedNames.add(label);
    }
    return 0;
  };
  const windowMonths = clampWindowMonths(windowMonthsInput);
  const frame = windowKeys(now, windowMonths);
  const inWindow = new Set(frame.map((f) => f.key));

  const productionRows = uniqueById(production);
  const salesRows = uniqueById(sales);
  const expenseRows = uniqueById(expenses);

  // Mirrors buildFarmMetrics exactly: a sale row represented by an invoice THIS
  // DEVICE holds is dropped in favour of the invoice, and the invoice's own kg
  // lines are rebuilt in its place. Using every invoice id (not only the paid
  // ones) is deliberate and matches farm-metrics.ts.
  const allInvoiceIds = invoices.map((invoice) => invoice.id);
  const paidInvoices = invoices.filter(
    (invoice) => invoice.status === 'paid' && !!invoice.paidAt && Number.isFinite(Date.parse(invoice.paidAt)),
  );
  const ledgerSales = cashLedgerSales(salesRows, allInvoiceIds);
  const invoiceKgLines = paidInvoices.flatMap(invoiceSalesForPaidInvoice);

  type Bucket = {
    moneyInSales: SalesLog[];
    moneyInInvoices: SavedInvoice[];
    moneyOut: number;
    producedKg: number;
    soldKg: number;
    records: number;
  };
  const buckets = new Map<string, Bucket>();
  const bucket = (key: string): Bucket => {
    const found = buckets.get(key);
    if (found) return found;
    const made: Bucket = { moneyInSales: [], moneyInInvoices: [], moneyOut: 0, producedKg: 0, soldKg: 0, records: 0 };
    buckets.set(key, made);
    return made;
  };

  // Collected across the WHOLE history, not just the window, so the empty state can
  // tell "you have not recorded anything yet" from "nothing in these months".
  // Kept as a list rather than two running variables: TypeScript cannot see through
  // a closure that mutates an outer `let`, and narrowing it to `never` at the read
  // site is a compile error that would otherwise be silenced with a cast.
  const recordedKeys: string[] = [];
  const sawRecord = (key: string | null) => {
    if (key) recordedKeys.push(key);
  };

  for (const row of productionRows) {
    const key = monthKeyOf(row.logged_at);
    sawRecord(key);
    if (!key || !inWindow.has(key)) continue;
    const b = bucket(key);
    b.producedKg += kgOf(row.crop, row.kg, 'picked');
    b.records += 1;
  }

  for (const row of ledgerSales) {
    const key = monthKeyOf(row.sold_at);
    sawRecord(key);
    if (!key || !inWindow.has(key)) continue;
    const b = bucket(key);
    b.moneyInSales.push(row);
    b.soldKg += kgOf(row.crop, row.kg, 'sold');
    b.records += 1;
  }

  // A paid invoice is one money entry dated by when it was PAID, plus its kg lines.
  for (const invoice of paidInvoices) {
    const key = monthKeyOf(invoice.paidAt);
    sawRecord(key);
    if (!key || !inWindow.has(key)) continue;
    bucket(key).moneyInInvoices.push(invoice);
    bucket(key).records += 1;
  }
  for (const line of invoiceKgLines) {
    const key = monthKeyOf(line.sold_at);
    if (!key || !inWindow.has(key)) continue;
    bucket(key).soldKg += kgOf(line.crop, line.kg, 'sold');
  }

  for (const row of expenseRows) {
    const key = monthKeyOf(row.spent_at);
    sawRecord(key);
    if (!key || !inWindow.has(key)) continue;
    const b = bucket(key);
    b.moneyOut += positive(row.amount);
    b.records += 1;
  }

  let running = 0;
  const months: FinanceMonthPoint[] = frame.map(({ year, month, key }) => {
    const b = buckets.get(key);
    const moneyInZar = b ? cashIncomeTotal(b.moneyInSales, b.moneyInInvoices) : 0;
    const moneyOutZar = b?.moneyOut ?? 0;
    const producedKg = b?.producedKg ?? 0;
    const soldKg = b?.soldKg ?? 0;
    const netZar = moneyInZar - moneyOutZar;
    running += netZar;
    const soldExceedsProduced = soldKg > producedKg;
    return {
      year,
      month,
      key,
      label: MONTH_SHORT[month - 1],
      longLabel: `${MONTH_SHORT[month - 1]} ${year}`,
      moneyInZar,
      moneyOutZar,
      netZar,
      runningZar: running,
      producedKg,
      soldKg,
      keptKg: soldExceedsProduced ? null : producedKg - soldKg,
      soldExceedsProduced,
      hasRecords: (b?.records ?? 0) > 0,
    };
  });

  const sum = (pick: (m: FinanceMonthPoint) => number) => months.reduce((total, m) => total + pick(m), 0);
  const totalProducedKg = sum((m) => m.producedKg);
  const totalSoldKg = sum((m) => m.soldKg);
  const totalInZar = sum((m) => m.moneyInZar);
  const totalOutZar = sum((m) => m.moneyOutZar);

  // Keys are '2026-08', so lexicographic order is chronological order.
  const earliest = recordedKeys.length > 0 ? recordedKeys.reduce((a, b) => (a < b ? a : b)) : null;
  const firstRecordLabel = earliest
    ? `${MONTH_SHORT[Number(earliest.slice(5, 7)) - 1]} ${earliest.slice(0, 4)}`
    : null;

  return {
    months,
    windowMonths,
    totalInZar,
    totalOutZar,
    totalNetZar: totalInZar - totalOutZar,
    totalProducedKg,
    totalSoldKg,
    // Same refusal as the per-month figure: if the window sold more than it logged
    // picking, the window's harvest total is missing rows and the difference is
    // not "what was kept".
    totalKeptKg: totalSoldKg > totalProducedKg ? null : totalProducedKg - totalSoldKg,
    hasRecords: months.some((m) => m.hasRecords),
    earlierRecords: recordedKeys.some((key) => !inWindow.has(key)),
    firstRecordLabel,
    excludedProducedKg,
    excludedSoldKg,
    // Sorted so the card's wording does not reshuffle every time a row is logged.
    excludedNames: [...excludedNames].sort((a, b) => a.localeCompare(b, 'en-ZA')),
  };
}
