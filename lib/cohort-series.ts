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

  /** Every farmer who shared a harvest book. The figure the "Picked" headline states. */
  producedKg: number | null;
  /** Every farmer who shared a sales book. The figure the "Sold" headline states. */
  soldKg: number | null;

  /**
   * The same two figures over the COMPARABLE farmers alone — the people who shared BOTH books.
   * `null` when nobody in the cohort did.
   *
   * These exist because {@link producedKg} and {@link soldKg} can describe different people, and
   * the only honest produced-vs-sold arithmetic is over the farmers present in both. Everything
   * below that subtracts one kilogram figure from another — `keptKg`, `soldExceedsProduced`,
   * {@link soldBarParts} — is built from these, never from the two population totals.
   */
  comparableProducedKg: number | null;
  comparableSoldKg: number | null;

  /**
   * Food that stayed on the farm, across the comparable farmers only:
   * `comparableProducedKg − comparableSoldKg`. `null` when nobody shares both books, or when more
   * was sold than those farmers' harvest logs account for.
   *
   * NOT `producedKg − soldKg`. When the two populations differ that subtraction is mostly one
   * farmer's missing consent, and drawing it as food eaten at home would be an invented finding —
   * the largest one this whole screen could produce.
   */
  keptKg: number | null;
  /**
   * The farmers who share both books sold more this month than they logged picking. A missing
   * harvest record or produce picked earlier, never a negative.
   *
   * Computed over the comparable subset, so ONE mixed-consent farmer no longer switches this
   * finding off for the whole cohort — which is what made the sold bar clamp silently.
   */
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
  /**
   * Farmers whose harvest book AND sales book are both readable — the only people whose picked and
   * sold kilograms may be set against each other. Per-scope consent (one farmer shares sales but
   * not harvest, another the reverse) makes this routinely smaller than either denominator above.
   */
  comparableFarmers: number;
  /** Farmers passed in, readable or not. */
  farmerCount: number;

  totalProducedKg: number | null;
  totalSoldKg: number | null;
  totalKeptKg: number | null;
  totalIncomeZar: number | null;
  totalExpensesZar: number | null;

  /**
   * ╔════════════════════════════════════════════════════════════════════════════════════════╗
   * ║ THE COMPARABILITY SEMANTICS OF THIS MODULE, WRITTEN ONCE, HERE.                         ║
   * ╚════════════════════════════════════════════════════════════════════════════════════════╝
   *
   * There are THREE populations behind one chart, and every figure names which one it belongs to:
   *
   *   • {@link productionFarmers} — shared a harvest book. Makes `producedKg` and the Picked total.
   *   • {@link salesFarmers}      — shared a sales book. Makes `soldKg`, `incomeZar`, the Sold total.
   *   • {@link comparableFarmers} — shared BOTH. The ONLY population in which a picked kilogram and
   *                                 a sold kilogram may be subtracted, compared or stacked.
   *
   * COMPARABILITY IS PER FARMER, NOT PER SERIES. This flag used to be the whole test, and it was
   * computed with an `every()` over the cohort: one farmer sharing sales but not harvest made it
   * false for everybody. Per-scope consent (the consent screen ships six independent switches)
   * makes exactly that mix the NORMAL case, so the every() switched the produced-vs-sold machinery
   * off almost everywhere it was needed — including the overshoot outline, which is the mechanism
   * that stops the sold bar being drawn silently short of the Sold figure printed above it.
   * `keptKg` and `soldExceedsProduced` are therefore computed from the comparable subset and are
   * live whenever that subset is non-empty, whatever anyone else in the cohort withheld.
   *
   * WHAT THIS FLAG STILL MEANS, NARROWLY: are the three populations the SAME people? True only
   * when every farmer behind these bars shares both books. That is the one case in which a picked
   * bar may be drawn as a stack of "sold" and "kept" — the geometry says sold ⊆ picked, and only
   * here is that true. False means the chart must draw picked and sold SIDE BY SIDE and say they
   * come from different farmers; it must never stack them, subtract them, or clamp one to the
   * other. See components/funder/CohortCharts.tsx, which switches on exactly this.
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
  comparableFarmers: 0,
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
  // Per farmer, not per series — see CohortSeries.keptComparable. A farmer joins the
  // produced-vs-sold comparison only by sharing BOTH books; sharing one still puts their
  // kilograms into that one total and that one bar.
  const isComparable = ledgers.map((l) => l.production !== null && l.sales !== null);
  const comparableFarmers = isComparable.filter(Boolean).length;

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
      comparableProducedKg: comparableFarmers > 0 ? 0 : null,
      comparableSoldKg: comparableFarmers > 0 ? 0 : null,
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
    field: 'producedKg' | 'soldKg' | 'incomeZar' | 'expensesZar'
      | 'comparableProducedKg' | 'comparableSoldKg',
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
    // The comparable copy is a SECOND accumulation of the very same rows, never a second reading
    // of the source — so a farmer counted in both can never contribute different kilograms to the
    // two, which is the only way the bars and the totals could drift apart again.
    const both = isComparable[i];
    if (ledger.production) {
      for (const row of ledger.production) {
        add(i, row.logged_at, row.kg, 'producedKg');
        if (both) add(i, row.logged_at, row.kg, 'comparableProducedKg');
      }
    }
    if (ledger.sales) {
      for (const row of ledger.sales) {
        add(i, row.sold_at, row.kg, 'soldKg');
        if (both) add(i, row.sold_at, row.kg, 'comparableSoldKg');
        add(i, row.sold_at, row.amount, 'incomeZar');
      }
    }
    if (ledger.expenses) for (const row of ledger.expenses) add(i, row.spent_at, row.amount, 'expensesZar');
  });

  // Are the three populations the SAME people? Only then may a picked bar be drawn as a stack of
  // sold and kept. See the contract on CohortSeries.keptComparable.
  const keptComparable =
    comparableFarmers > 0 &&
    comparableFarmers === productionFarmers &&
    comparableFarmers === salesFarmers;

  for (const bucket of months) {
    if (bucket.producedKg !== null) bucket.producedKg = Math.round(bucket.producedKg * 10) / 10;
    if (bucket.soldKg !== null) bucket.soldKg = Math.round(bucket.soldKg * 10) / 10;
    if (bucket.comparableProducedKg !== null) bucket.comparableProducedKg = Math.round(bucket.comparableProducedKg * 10) / 10;
    if (bucket.comparableSoldKg !== null) bucket.comparableSoldKg = Math.round(bucket.comparableSoldKg * 10) / 10;
    if (bucket.incomeZar !== null) bucket.incomeZar = Math.round(bucket.incomeZar);
    if (bucket.expensesZar !== null) bucket.expensesZar = Math.round(bucket.expensesZar);
    bucket.activeFarmers = activeIds.get(bucket.key)?.size ?? 0;
    // Over the comparable subset, and live whenever that subset exists — one mixed-consent farmer
    // elsewhere in the cohort no longer silences it.
    if (bucket.comparableProducedKg !== null && bucket.comparableSoldKg !== null) {
      bucket.soldExceedsProduced = bucket.comparableSoldKg > bucket.comparableProducedKg;
      bucket.keptKg = bucket.soldExceedsProduced
        ? null
        : Math.round((bucket.comparableProducedKg - bucket.comparableSoldKg) * 10) / 10;
    }
  }

  const sum = (pick: (m: CohortMonth) => number | null): number | null => {
    const present = months.map(pick).filter((v): v is number => v !== null);
    return present.length === 0 ? null : Math.round(present.reduce((a, b) => a + b, 0) * 10) / 10;
  };

  const totalProducedKg = sum((m) => m.producedKg);
  const totalSoldKg = sum((m) => m.soldKg);
  const totalComparableProducedKg = sum((m) => m.comparableProducedKg);
  const totalComparableSoldKg = sum((m) => m.comparableSoldKg);
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
    comparableFarmers,
    farmerCount: ledgers.length,
    totalProducedKg,
    totalSoldKg,
    // Same rule as the months, applied to the window: a kept figure is the residual of two totals
    // that describe the SAME farmers, and only while their harvest logs account for everything
    // they sold. When every farmer shares both books these are the population totals and this is
    // Picked − Sold; when they do not, it is the comparable subset's own residual and the chart is
    // required to name that subset beside it rather than let it read as the whole cohort's.
    totalKeptKg:
      totalComparableProducedKg !== null
      && totalComparableSoldKg !== null
      && totalComparableSoldKg <= totalComparableProducedKg
        ? Math.round((totalComparableProducedKg - totalComparableSoldKg) * 10) / 10
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

/* ────────────────────────────────────────────────────────────────────────────
 * The sold bar, split into what a harvest record stands behind
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * How one month's SOLD kilograms must be drawn, so the bar can never come out shorter than the
 * figure printed above it.
 *
 * THE BUG THIS EXISTS TO MAKE IMPOSSIBLE. The chart used to compute the sold bar itself, as
 * `Math.min(soldKg, producedKg)` — a bar clamped to the harvest figure — and relied on a separate
 * dashed outline to restore the true height. That outline was gated on a series-wide comparability
 * test that one mixed-consent farmer turned off, so the clamp survived on its own: the bar drew
 * short while "Sold: X kg" above it stayed right, and nothing on screen said the two disagreed.
 * The two halves are now returned together, from one function, and they always add back up.
 */
export interface SoldBarParts {
  /**
   * Sold kilograms a harvest row in this same chart stands behind — the comparable farmers'
   * sales, as far as their own picking log accounts for them. Drawn as a filled block.
   */
  backedKg: number;
  /**
   * The rest of the sold figure: sales by farmers who withheld their harvest book, or produce
   * picked in an earlier month. Drawn as an OPEN OUTLINE, never as a filled block — no harvest
   * record stands behind that height.
   */
  unbackedKg: number;
  /** `backedKg + unbackedKg`, and always exactly the month's stated sold figure. */
  totalKg: number;
}

/**
 * Split a month's sold kilograms into the part a harvest record backs and the part it does not.
 *
 * The invariant, asserted in tests/cohort-view.test.ts: `backedKg + unbackedKg === totalKg`, and
 * `totalKg` is the same `soldKg` the headline totals are summed from. A caller that draws both
 * parts therefore CANNOT draw a bar that contradicts the stated total, whatever the consent mix —
 * which is the whole reason the arithmetic lives here and not in the chart.
 */
export function soldBarParts(m: CohortMonth): SoldBarParts {
  const total = Math.max(0, m.soldKg ?? 0);
  // Only the comparable farmers can back a sale with a harvest, and only up to what they picked.
  const cap = Math.min(Math.max(0, m.comparableSoldKg ?? 0), Math.max(0, m.comparableProducedKg ?? 0));
  const backedKg = Math.min(cap, total);
  return { backedKg, unbackedKg: Math.max(0, total - backedKg), totalKg: total };
}
