/*
 * THE COHORT'S MONTH-BY-MONTH LEDGER — the one time dimension a funder can be shown honestly.
 *
 * `NetworkFarmerSummary` (lib/network.ts) carries totals only: 1 240 kg harvested, R14 300 earned,
 * eight modules finished. A funder asking "is this programme growing?" cannot answer that from a
 * total, and the temptation on every dashboard like this one is to draw a rising line anyway. This
 * module is the alternative: real monthly buckets, or nothing.
 *
 * IT IS THE COHORT VERSION OF `monthlyLedgerSeries()` in components/network/FarmerPanel.format.ts,
 * deliberately built to the same three rules so one farmer's strip and the whole programme's chart
 * can never disagree about which month a row fell in:
 *
 *   1. BUCKET BY THE EVENT DATE (logged_at / sold_at / spent_at), never created_at. Every writer
 *      sets created_at with serverTimestamp(), so at runtime it is a Firestore Timestamp object,
 *      not the ISO string its type claims. Same rule as lib/finance-series.ts, rule 3.
 *   2. BUCKET IN UTC. The same log must land in the same month for a funder in Johannesburg and
 *      one in London, and the test needs an exact assertion.
 *   3. NULL IS NOT ZERO. A figure nobody was allowed to read is `null` and must render as "not
 *      shared", never as a flat zero month. `null` at the cohort level means NO farmer in the
 *      cohort had that ledger readable — one readable farmer makes it a number, and
 *      `reportingFarmers` is what stops that number being read as the whole programme's.
 *
 * WHY NOT REUSE lib/finance-series.ts: that module is the FARMER'S OWN screen. It de-duplicates a
 * paid invoice against the sales rows the invoice generated, because the farmer's device holds
 * both. The funder read (app/api/network/farmers/route.ts) returns no invoices at all, so that
 * arithmetic has nothing to do here — and importing it would pull the invoice/localStorage graph
 * into a route handler for the sake of a code path that can never fire.
 *
 * Pure module: no I/O, no React, no Firestore. Runs identically in the browser, in the Node route
 * handler that builds the live series, and in tests.
 */

import type { ExpenseLog, ProductionLog, SalesLog } from './db/types';

/** One farmer's already-consent-filtered ledgers. `null` = this viewer may not read that book. */
export interface CohortLedger {
  production: ProductionLog[] | null;
  sales: SalesLog[] | null;
  expenses?: ExpenseLog[] | null;
  /** ISO date the farmer joined. Used only to clip the left edge of the window. */
  joinedAt?: string | null;
}

export interface CohortMonth {
  /** `2026-03` — stable identity for React keys. */
  key: string;
  /** `Mar` — for a crowded axis. */
  label: string;
  /** `Mar 2026` — for anywhere the year is not already obvious. */
  longLabel: string;
  year: number;
  /** 1-12, so it reads like a date rather than a Date.getMonth() index. */
  month: number;

  producedKg: number | null;
  soldKg: number | null;
  /**
   * produced − sold: food that stayed on the farm. `null` when that subtraction is not
   * trustworthy — either more was sold than the harvest log accounts for, or (see
   * {@link CohortSeries.keptComparable}) the two figures come from different sets of farmers.
   */
  keptKg: number | null;
  /** More was sold this month than was logged as picked. A missing harvest record, not a negative. */
  soldExceedsProduced: boolean;
  incomeZar: number | null;
  expensesZar: number | null;

  /** Farmers who logged anything at all in this month. Zero means a quiet month, not an empty one. */
  activeFarmers: number;
  /** Any row of any kind fell in this month. Lets a chart draw a gap instead of a floor. */
  hasRecords: boolean;
}

export interface CohortSeries {
  months: CohortMonth[];
  windowMonths: number;

  /** Farmers whose production book was readable. The denominator for the kilogram series. */
  productionFarmers: number;
  /** Farmers whose sales book was readable. The denominator for the money and sold-kg series. */
  salesFarmers: number;
  /** Farmers passed in, readable or not. */
  farmerCount: number;

  totalProducedKg: number | null;
  totalSoldKg: number | null;
  totalKeptKg: number | null;
  totalIncomeZar: number | null;
  totalExpensesZar: number | null;

  /**
   * May `produced − sold` be read as "kept on the farm" for this cohort?
   *
   * Only when the harvest books and the sales books belong to the SAME farmers. If nine farmers
   * shared their harvest and six shared their sales, the difference between those two totals is
   * mostly three farmers' missing consent, and drawing it as food eaten at home would be an
   * invented finding — the largest one this whole screen could produce. False here means the
   * kilogram chart shows harvest alone and says why.
   */
  keptComparable: boolean;

  /** Months in which at least one farmer recorded something. */
  activeMonths: number;
  /** Tallest kilogram figure in the window (max of produced and sold), for a shared axis. */
  maxKg: number;
  maxZar: number;

  /** FALSE means draw nothing at all — never a trend through one point. */
  renderable: boolean;
  /** Why it is not renderable. Printed instead of a chart. */
  reason: string;
}

/** Below this many months a strip is a shape, not a trend. Mirrors SERIES_MIN_MONTHS. */
export const COHORT_MIN_MONTHS = 3;
/** One non-empty month is a dot, not a series. Mirrors SERIES_MIN_ACTIVE_MONTHS. */
export const COHORT_MIN_ACTIVE_MONTHS = 2;

/** Clamped so a caller cannot ask for a 400-column axis or a zero-column one. */
export function clampCohortWindow(value: number): number {
  if (!Number.isFinite(value)) return 12;
  return Math.min(24, Math.max(COHORT_MIN_MONTHS, Math.trunc(value)));
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthKey(year: number, month1: number): string {
  return `${year}-${month1 < 10 ? '0' : ''}${month1}`;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const EMPTY: CohortSeries = {
  months: [],
  windowMonths: 0,
  productionFarmers: 0,
  salesFarmers: 0,
  farmerCount: 0,
  totalProducedKg: null,
  totalSoldKg: null,
  totalKeptKg: null,
  totalIncomeZar: null,
  totalExpensesZar: null,
  keptComparable: false,
  activeMonths: 0,
  maxKg: 0,
  maxZar: 0,
  renderable: false,
  reason: 'No farmer ledgers were supplied, so there is nothing to plot over time.',
};

/** The empty series, for a caller that has to hold the shape before its data arrives. */
export function emptyCohortSeries(reason?: string): CohortSeries {
  return reason ? { ...EMPTY, reason } : EMPTY;
}

/**
 * Roll a cohort's raw ledgers up into one month-by-month series.
 *
 * The left edge is clipped at the month the EARLIEST farmer joined, so a programme six months old
 * never draws six empty columns before it — six months of "nothing recorded" that predate the
 * first farmer read as six months of failure.
 */
export function buildCohortSeries(
  ledgers: readonly CohortLedger[],
  options: { months?: number; now?: Date } = {},
): CohortSeries {
  if (ledgers.length === 0) return EMPTY;

  const windowMonths = clampCohortWindow(options.months ?? 12);
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) return EMPTY;

  const productionFarmers = ledgers.filter((l) => l.production !== null).length;
  const salesFarmers = ledgers.filter((l) => l.sales !== null).length;
  const expenseFarmers = ledgers.filter((l) => l.expenses != null).length;

  if (productionFarmers === 0 && salesFarmers === 0 && expenseFarmers === 0) {
    return {
      ...EMPTY,
      farmerCount: ledgers.length,
      windowMonths,
      reason: 'None of these farmers has agreed to share a harvest, sales or spending record.',
    };
  }

  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth(); // 0-11

  // Clip at the earliest join date we know about. A farmer with no joinedAt does not shorten the
  // window — an unknown start date is not evidence the programme is young.
  let startIndex = 0;
  const joins = ledgers
    .map((l) => (typeof l.joinedAt === 'string' ? Date.parse(l.joinedAt) : NaN))
    .filter((t) => Number.isFinite(t));
  if (joins.length === ledgers.length && joins.length > 0) {
    const earliest = new Date(Math.min(...joins));
    const monthsSince =
      (endYear - earliest.getUTCFullYear()) * 12 + (endMonth - earliest.getUTCMonth());
    if (monthsSince >= 0 && monthsSince < windowMonths - 1) {
      startIndex = windowMonths - 1 - monthsSince;
    }
  }

  const months: CohortMonth[] = [];
  const index = new Map<string, CohortMonth>();
  // Tracked separately from the bucket so "two farmers each logged twice" counts as two farmers.
  const activeIds = new Map<string, Set<number>>();

  for (let i = startIndex; i < windowMonths; i += 1) {
    const back = windowMonths - 1 - i;
    const d = new Date(Date.UTC(endYear, endMonth - back, 1));
    const bucket: CohortMonth = {
      key: monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1),
      label: MONTH_SHORT[d.getUTCMonth()],
      longLabel: `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      producedKg: productionFarmers > 0 ? 0 : null,
      soldKg: salesFarmers > 0 ? 0 : null,
      keptKg: null,
      soldExceedsProduced: false,
      incomeZar: salesFarmers > 0 ? 0 : null,
      expensesZar: expenseFarmers > 0 ? 0 : null,
      activeFarmers: 0,
      hasRecords: false,
    };
    months.push(bucket);
    index.set(bucket.key, bucket);
    activeIds.set(bucket.key, new Set<number>());
  }

  const add = (
    farmerIndex: number,
    iso: unknown,
    amount: unknown,
    field: 'producedKg' | 'soldKg' | 'incomeZar' | 'expensesZar',
  ) => {
    if (typeof iso !== 'string') return;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return;
    const d = new Date(t);
    const key = monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const bucket = index.get(key);
    if (!bucket) return; // outside the window — correctly excluded, never clamped onto an edge month
    const current = bucket[field];
    if (current === null) return;
    bucket[field] = current + num(amount);
    bucket.hasRecords = true;
    activeIds.get(key)?.add(farmerIndex);
  };

  ledgers.forEach((ledger, i) => {
    if (ledger.production) for (const row of ledger.production) add(i, row.logged_at, row.kg, 'producedKg');
    if (ledger.sales) {
      for (const row of ledger.sales) {
        add(i, row.sold_at, row.kg, 'soldKg');
        add(i, row.sold_at, row.amount, 'incomeZar');
      }
    }
    if (ledger.expenses) for (const row of ledger.expenses) add(i, row.spent_at, row.amount, 'expensesZar');
  });

  // Both books, from the same people. See CohortSeries.keptComparable.
  const keptComparable =
    productionFarmers > 0 &&
    productionFarmers === salesFarmers &&
    ledgers.every((l) => (l.production === null) === (l.sales === null));

  for (const bucket of months) {
    if (bucket.producedKg !== null) bucket.producedKg = Math.round(bucket.producedKg * 10) / 10;
    if (bucket.soldKg !== null) bucket.soldKg = Math.round(bucket.soldKg * 10) / 10;
    if (bucket.incomeZar !== null) bucket.incomeZar = Math.round(bucket.incomeZar);
    if (bucket.expensesZar !== null) bucket.expensesZar = Math.round(bucket.expensesZar);
    bucket.activeFarmers = activeIds.get(bucket.key)?.size ?? 0;
    if (keptComparable && bucket.producedKg !== null && bucket.soldKg !== null) {
      bucket.soldExceedsProduced = bucket.soldKg > bucket.producedKg;
      bucket.keptKg = bucket.soldExceedsProduced
        ? null
        : Math.round((bucket.producedKg - bucket.soldKg) * 10) / 10;
    }
  }

  const sum = (pick: (m: CohortMonth) => number | null): number | null => {
    const present = months.map(pick).filter((v): v is number => v !== null);
    return present.length === 0 ? null : Math.round(present.reduce((a, b) => a + b, 0) * 10) / 10;
  };

  const totalProducedKg = sum((m) => m.producedKg);
  const totalSoldKg = sum((m) => m.soldKg);
  const activeMonths = months.filter((m) => m.hasRecords).length;
  const maxKg = months.reduce((max, m) => Math.max(max, m.producedKg ?? 0, m.soldKg ?? 0), 0);
  const maxZar = months.reduce((max, m) => Math.max(max, m.incomeZar ?? 0, m.expensesZar ?? 0), 0);

  let renderable = true;
  let reason = '';
  if (months.length < COHORT_MIN_MONTHS) {
    renderable = false;
    reason = `Only ${months.length} month${months.length === 1 ? '' : 's'} of programme history — too short to read as a trend.`;
  } else if (activeMonths < COHORT_MIN_ACTIVE_MONTHS) {
    renderable = false;
    reason = activeMonths === 0
      ? 'No dated harvest or sale in this period, so there is no trend to draw.'
      : 'Only one month has entries — a single point is not a trend.';
  }

  return {
    months,
    windowMonths,
    productionFarmers,
    salesFarmers,
    farmerCount: ledgers.length,
    totalProducedKg,
    totalSoldKg,
    // Same rule as the months, applied to the window: a total kept figure is only the residual of
    // two totals that describe the same farmers, and only while the harvest log accounts for
    // everything that was sold.
    totalKeptKg:
      keptComparable && totalProducedKg !== null && totalSoldKg !== null && totalSoldKg <= totalProducedKg
        ? Math.round((totalProducedKg - totalSoldKg) * 10) / 10
        : null,
    totalIncomeZar: sum((m) => m.incomeZar),
    totalExpensesZar: sum((m) => m.expensesZar),
    keptComparable,
    activeMonths,
    maxKg,
    maxZar,
    renderable,
    reason,
  };
}
