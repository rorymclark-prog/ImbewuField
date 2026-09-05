/**
 * Pure formatting + derivation helpers for FarmerPanel.tsx.
 *
 * WHY THIS IS A SEPARATE .ts FILE, NOT PART OF THE .tsx COMPONENT
 * ───────────────────────────────────────────────────────────────
 * Node's built-in type stripping cannot load `.tsx` (it does not parse JSX), so
 * anything that needs a `node --test` unit test has to live in a plain `.ts`
 * module. Everything here is pure — no React, no I/O, no runtime imports at all
 * (every import below is `import type`, which is erased). That keeps
 * tests/farmer-panel-format.test.ts a millisecond-scale test with no DOM,
 * no Firebase and no bundler.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE
 * ────────────────────────────────────────
 * A funder shown a confident `0` that actually means "we never asked" has been
 * misled. Every metric in lib/network.ts is nullable and `null` means
 * "NOT AVAILABLE TO THIS VIEWER" — a denied read, not a farmer who produced
 * nothing. So this module never returns a bare number. It returns a
 * {@link Readout} carrying one of three states:
 *
 *   'value'        — a real figure, readable and non-empty
 *   'not_visible'  — the metric is null: the source could not be read at all
 *   'not_recorded' — the source WAS readable and is genuinely empty
 *
 * `not_visible` and `not_recorded` are different sentences on a funder's
 * screen and must never collapse into "0" or "—". The distinction comes
 * straight from `NetworkFarmerMetrics.coverage` (see lib/network.ts), which
 * records which sources were actually readable.
 *
 * SELECTOR PROVENANCE
 * ───────────────────
 * Every row carries a `selector` string naming the exact library symbol and
 * field the number came from. FarmerPanel.tsx renders it as a `data-selector`
 * attribute, so a developer auditing the panel can right-click any figure,
 * read the attribute, and go straight to the code that produced it. If you add
 * a row, add its selector — an unattributed number does not belong on a
 * funder's screen.
 */

import type { CompletionStep, SiteStage } from '@/lib/completion-score';
import type { GardenStatus } from '@/lib/db/types';
import type { FarmerDataSources, NetworkFarmerMetrics } from '@/lib/network';

/* ────────────────────────────────────────────────────────────────────────────
 * Availability
 * ──────────────────────────────────────────────────────────────────────────*/

/** See the header. Three states, never two. */
export type Availability = 'value' | 'not_visible' | 'not_recorded';

export interface Readout {
  state: Availability;
  /** What to print. For non-'value' states this is the honest phrase, not '—'. */
  text: string;
  /** One-line explanation shown under/next to the value. Empty for 'value'. */
  note: string;
}

/** Copy used wherever a source could not be read. Deliberately not "0". */
export const NOT_VISIBLE_TEXT = 'Not visible';
export const NOT_VISIBLE_NOTE = 'This account cannot read that record';

/** Copy used where the source WAS readable and is empty. Also not "0". */
export const NOT_RECORDED_TEXT = 'Not recorded yet';
export const NOT_RECORDED_NOTE = 'Readable — nothing has been logged';

/** Fallback badge text when the caller does not pass its own demo notice. */
export const SAMPLE_DATA_NOTICE =
  'Sample portfolio — invented farmers and finances. No live farmer data is shown.';

function notVisible(note = NOT_VISIBLE_NOTE): Readout {
  return { state: 'not_visible', text: NOT_VISIBLE_TEXT, note };
}

function notRecorded(text = NOT_RECORDED_TEXT, note = NOT_RECORDED_NOTE): Readout {
  return { state: 'not_recorded', text, note };
}

/**
 * Turn a nullable metric into a Readout.
 *
 * @param value           the metric — `null` ALWAYS means "not visible"
 * @param format          how to print a real value
 * @param emptyText       phrase for a readable-but-empty source
 * @param treatZeroAsEmpty  set false where 0 is a genuine reading (e.g. a net
 *                          margin that happens to break even). Defaults true,
 *                          because for a ledger sum, 0 nearly always means
 *                          "no rows", and "R0 income" reads as a judgement.
 */
export function toReadout(
  value: number | null,
  format: (n: number) => string,
  options: { emptyText?: string; emptyNote?: string; treatZeroAsEmpty?: boolean } = {},
): Readout {
  if (value === null || !Number.isFinite(value)) return notVisible();
  const treatZeroAsEmpty = options.treatZeroAsEmpty !== false;
  if (value === 0 && treatZeroAsEmpty) return notRecorded(options.emptyText, options.emptyNote);
  return { state: 'value', text: format(value), note: '' };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Scalar formatters — deterministic, locale-independent (tests depend on this)
 * ──────────────────────────────────────────────────────────────────────────*/

const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Thousands separated by a space — the South African convention, and stable
 * across runtimes (Intl's grouping character varies by ICU build, which would
 * make this untestable).
 */
function groupThousands(n: number): string {
  return Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Whole rand. `R1 240`, `-R310`. Cents never help a funder read a portfolio. */
export function formatZar(amount: number): string {
  return `${amount < 0 ? '-' : ''}R${groupThousands(amount)}`;
}

/** `12.4 kg` under 100, `340 kg` under 1 000, `1.2 t` above. */
export function formatKg(kg: number): string {
  const abs = Math.abs(kg);
  if (abs >= 1000) return `${(kg / 1000).toFixed(1)} t`;
  if (abs >= 100) return `${Math.round(kg)} kg`;
  return `${Math.round(kg * 10) / 10} kg`;
}

/** `450 m²` under a hectare, `1.4 ha` above. */
export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${Math.round((m2 / 10000) * 10) / 10} ha`;
  return `${groupThousands(m2)} m²`;
}

export function formatPct(p: number): string {
  return `${Math.round(p)}%`;
}

/** `less than a month`, `7 months`, `1 year 3 months`, `2 years`. */
export function formatMonthsActive(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return 'less than a month';
  if (months === 1) return '1 month';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = years === 1 ? '1 year' : `${years} years`;
  if (rest === 0) return yearPart;
  return `${yearPart} ${rest === 1 ? '1 month' : `${rest} months`}`;
}

/**
 * `March 2024`. UTC getters on purpose: the panel must print the same month
 * for every viewer regardless of their machine's timezone, and the test must
 * be able to assert an exact string.
 */
export function formatJoinedDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'date unknown';
  const d = new Date(t);
  return `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `today`, `yesterday`, `12 days ago`, `4 months ago`, `2 years ago`. */
export function formatDaysAgo(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${Math.round(days)} days ago`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30.44));
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.max(1, Math.round(days / 365.25));
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const STATUS_LABEL: Record<GardenStatus, string> = {
  thriving: 'Thriving',
  establishing: 'Establishing',
  support: 'Needs support',
};

export function statusLabel(status: GardenStatus): string {
  return STATUS_LABEL[status] ?? String(status);
}

const STAGE_LABEL: Record<SiteStage, string> = {
  scout: 'Scouting the site',
  saved: 'Site saved',
  traced: 'Boundary traced',
  designed: 'Design done',
  planned: 'Crop plan done',
};

export function stageLabel(stage: SiteStage): string {
  return STAGE_LABEL[stage] ?? String(stage);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Financials
 * ──────────────────────────────────────────────────────────────────────────*/

export interface PanelRow {
  key: string;
  label: string;
  readout: Readout;
  /** The exact library symbol behind this number — rendered as `data-selector`. */
  selector: string;
  tone: 'positive' | 'negative' | 'neutral';
  /** Extra caveat printed under the row (e.g. "estimate, not revenue"). */
  caveat?: string;
}

/**
 * The money view a funder opens the panel for: what came in, what went out,
 * what is left, and an explicitly-labelled estimate of household value.
 *
 * Every figure comes from `buildFarmerMetrics()` in lib/network.ts, which sums
 * the already-loaded ledgers. Nothing is recomputed here — two screens showing
 * different totals for the same farmer is exactly the bug this avoids.
 */
export function financeRows(m: NetworkFarmerMetrics): PanelRow[] {
  const rows: PanelRow[] = [];

  // ← NetworkFarmerMetrics.incomeZar   (buildFarmerMetrics: sum of SalesLog.amount)
  rows.push({
    key: 'income',
    label: 'Income from sales',
    selector: 'NetworkFarmerMetrics.incomeZar',
    tone: 'positive',
    readout: toReadout(m.incomeZar, formatZar, {
      emptyText: 'No sales recorded yet',
      emptyNote: 'The sales book is readable and empty',
    }),
  });

  // ← NetworkFarmerMetrics.expensesZar (buildFarmerMetrics: sum of ExpenseLog.amount)
  rows.push({
    key: 'expenses',
    label: 'Costs',
    selector: 'NetworkFarmerMetrics.expensesZar',
    tone: 'negative',
    readout: toReadout(m.expensesZar, formatZar, {
      emptyText: 'No costs recorded yet',
      emptyNote: 'The expense book is readable and empty',
    }),
  });

  // ← NetworkFarmerMetrics.netZar      (income − expenses; null if EITHER is unreadable)
  // A real R0 net is a meaningful reading, so zero is only "not recorded" when
  // both ledgers are genuinely empty.
  const bothEmpty = m.incomeZar === 0 && m.expensesZar === 0;
  rows.push({
    key: 'net',
    label: 'Net margin',
    selector: 'NetworkFarmerMetrics.netZar',
    tone: m.netZar !== null && m.netZar < 0 ? 'negative' : 'positive',
    readout: toReadout(m.netZar, formatZar, {
      emptyText: 'No books recorded yet',
      emptyNote: 'Both the sales and expense books are empty',
      treatZeroAsEmpty: bothEmpty,
    }),
  });

  // ← NetworkFarmerMetrics.estimatedValueZar (income + keptKg × KEPT_KG_VALUE_ZAR)
  rows.push({
    key: 'value',
    label: 'Illustrative value scenario',
    selector: 'NetworkFarmerMetrics.estimatedValueZar',
    tone: 'neutral',
    caveat: 'Illustrative estimate: cash income plus unmatched harvest at an assumed R15/kg. Not revenue, profit or measured household benefit.',
    readout: toReadout(m.estimatedValueZar, formatZar, {
      emptyText: 'Not recorded yet',
      emptyNote: 'Needs both the sales and production books',
    }),
  });

  return rows;
}

/**
 * The produce side of the same season: harvested, sold, kept. Separate from
 * {@link financeRows} because kilograms and rands answer different questions
 * and a funder scans them differently.
 */
export function produceRows(m: NetworkFarmerMetrics): PanelRow[] {
  return [
    {
      // ← NetworkFarmerMetrics.producedKg (sum of ProductionLog.kg)
      key: 'produced',
      label: 'Harvested',
      selector: 'NetworkFarmerMetrics.producedKg',
      tone: 'neutral',
      readout: toReadout(m.producedKg, formatKg, {
        emptyText: 'No harvest recorded yet',
        emptyNote: 'The production book is readable and empty',
      }),
    },
    {
      // ← NetworkFarmerMetrics.soldKg (sum of SalesLog.kg)
      key: 'sold',
      label: 'Sold',
      selector: 'NetworkFarmerMetrics.soldKg',
      tone: 'neutral',
      readout: toReadout(m.soldKg, formatKg, {
        emptyText: 'None sold yet',
        emptyNote: 'The sales book is readable and empty',
      }),
    },
    {
      // ← NetworkFarmerMetrics.keptKg (produced − sold; null unless BOTH readable)
      key: 'kept',
      label: 'Harvest not matched to sales',
      selector: 'NetworkFarmerMetrics.keptKg',
      tone: 'neutral',
      readout: toReadout(m.keptKg, formatKg, {
        emptyText: 'No positive harvest-sales balance',
        emptyNote: 'This does not establish how much was eaten, donated, stored or lost',
      }),
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Surveys
 * ──────────────────────────────────────────────────────────────────────────*/

export type SurveyState = 'not_visible' | 'not_started' | 'partial' | 'complete';

export interface SurveyReadout {
  state: SurveyState;
  filled: number | null;
  total: number | null;
  pct: number | null;
  /** How many survey fields are still blank. Null when the survey is unreadable. */
  missing: number | null;
  /** e.g. "6 of 10 answered" — always names the denominator. */
  headline: string;
  /** Says out loud that blanks are blanks, never zeros. */
  note: string;
  /** NGO-authored survey rounds this farmer has answered. */
  ngoRounds: Readout;
}

/**
 * What the SITE SURVEY has recorded and — the part that matters — what it has
 * not. An unfinished survey must read as unfinished. The failure mode this
 * guards against: 3 of 10 fields filled rendering as a low score, as though
 * the farmer answered badly, when in fact seven questions were never asked.
 */
export function surveyReadout(m: NetworkFarmerMetrics): SurveyReadout {
  // ← NetworkFarmerMetrics.surveysAnswered (count of SurveyResponse rows)
  const ngoRounds = toReadout(
    m.surveysAnswered,
    (n) => (n === 1 ? '1 round answered' : `${n} rounds answered`),
    {
      emptyText: 'No rounds answered yet',
      emptyNote: 'This farmer has been sent surveys but returned none',
    },
  );

  // ← NetworkFarmerMetrics.coverage.siteProgress
  //   false = the site survey lives in user_map_data/{uid}, which is owner-only
  //   under the deployed Firestore rules. Not readable ≠ not filled in.
  if (!m.coverage.siteProgress || m.surveyFilled === null || m.surveyTotal === null) {
    return {
      state: 'not_visible',
      filled: null,
      total: null,
      pct: null,
      missing: null,
      headline: NOT_VISIBLE_TEXT,
      note: 'The site survey is stored on the farmer’s own account and is not readable here.',
      ngoRounds,
    };
  }

  const filled = m.surveyFilled;              // ← NetworkFarmerMetrics.surveyFilled
  const total = m.surveyTotal;                // ← NetworkFarmerMetrics.surveyTotal
  const pct = m.surveyPct;                    // ← NetworkFarmerMetrics.surveyPct
  const missing = Math.max(0, total - filled);

  if (filled === 0) {
    return {
      state: 'not_started',
      filled,
      total,
      pct,
      missing,
      headline: `0 of ${total} answered`,
      note: `The site survey has not been started. All ${total} questions are blank — this is a gap in the record, not a score of zero.`,
      ngoRounds,
    };
  }

  if (missing === 0) {
    return {
      state: 'complete',
      filled,
      total,
      pct,
      missing,
      headline: `${filled} of ${total} answered`,
      note: 'The site survey is complete.',
      ngoRounds,
    };
  }

  return {
    state: 'partial',
    filled,
    total,
    pct,
    missing,
    headline: `${filled} of ${total} answered`,
    note: `${missing} ${missing === 1 ? 'question is' : 'questions are'} still blank — not answered, not zero.`,
    ngoRounds,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Progress
 * ──────────────────────────────────────────────────────────────────────────*/

export interface ProgressReadout {
  visible: boolean;
  pct: number | null;                 // ← NetworkFarmerMetrics.progressPct
  stage: SiteStage | null;            // ← NetworkFarmerMetrics.stage
  stageText: string | null;
  steps: CompletionStep[] | null;     // ← NetworkFarmerMetrics.steps
  stepsDone: number | null;
  stepsTotal: number | null;
  /** Always names what the percentage is a proportion OF. */
  headline: string;
  note: string;
  /** Course modules — a separate, independently-readable proportion. */
  training: Readout;
  trainingDone: number | null;
  trainingTotal: number;
  trainingPct: number | null;
}

/**
 * Setup progress as a real proportion WITH its denominator. "43%" alone is
 * unreadable; "43% of the 5 setup steps (2 done)" is auditable.
 *
 * The 5 steps are computeCompletionScore()'s: located, boundary, survey,
 * design, cropPlan (lib/completion-score.ts). Their weights are not equal, so
 * the overall percentage is NOT stepsDone/stepsTotal — both are shown.
 */
export function progressReadout(m: NetworkFarmerMetrics): ProgressReadout {
  // ← NetworkFarmerMetrics.modulesDone / .modulesTotal / .trainingPct
  const training = toReadout(
    m.modulesDone,
    (n) => `${n} of ${m.modulesTotal} modules`,
    {
      emptyText: `0 of ${m.modulesTotal} modules`,
      emptyNote: 'Enrolled, but no module marked complete yet',
    },
  );

  // ← NetworkFarmerMetrics.coverage.siteProgress (see surveyReadout above)
  if (!m.coverage.siteProgress || m.progressPct === null) {
    return {
      visible: false,
      pct: null,
      stage: null,
      stageText: null,
      steps: null,
      stepsDone: null,
      stepsTotal: null,
      headline: NOT_VISIBLE_TEXT,
      note: 'Setup progress is derived from the farmer’s own map data, which is not readable here.',
      training,
      trainingDone: m.modulesDone,
      trainingTotal: m.modulesTotal,
      trainingPct: m.trainingPct,
    };
  }

  const steps = m.steps;
  const stepsTotal = steps ? steps.length : null;
  const stepsDone = steps ? steps.filter((s) => s.done).length : null;

  return {
    visible: true,
    pct: m.progressPct,
    stage: m.stage,
    stageText: m.stage ? stageLabel(m.stage) : null,
    steps,
    stepsDone,
    stepsTotal,
    headline:
      stepsTotal !== null
        ? `${formatPct(m.progressPct)} of site setup — ${stepsDone} of ${stepsTotal} steps done`
        : `${formatPct(m.progressPct)} of site setup`,
    note:
      'Weighted across the 5 setup steps, so the percentage is not simply steps done ÷ steps total.',
    training,
    trainingDone: m.modulesDone,
    trainingTotal: m.modulesTotal,
    trainingPct: m.trainingPct,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Monthly ledger series (the ONLY honest time dimension available)
 * ──────────────────────────────────────────────────────────────────────────*/

export interface LedgerMonth {
  /** `2026-03` */
  key: string;
  /** `Mar` */
  label: string;
  year: number;
  /** 1-12 */
  month: number;
  producedKg: number | null;
  incomeZar: number | null;
  expensesZar: number | null;
}

export interface LedgerSeries {
  months: LedgerMonth[];
  /** Months in which ANY ledger recorded something. */
  activeMonths: number;
  hasProduction: boolean;
  hasMoney: boolean;
  maxKg: number;
  maxZar: number;
  /** FALSE means render nothing at all. Never draw a trend from one point. */
  renderable: boolean;
  /** Why it is not renderable — printed instead of a chart. */
  reason: string;
}

/** A strip below this many months is a shape, not a trend. */
export const SERIES_MIN_MONTHS = 3;
/** One non-empty month is a dot, not a series. */
export const SERIES_MIN_ACTIVE_MONTHS = 2;

const EMPTY_SERIES: LedgerSeries = {
  months: [],
  activeMonths: 0,
  hasProduction: false,
  hasMoney: false,
  maxKg: 0,
  maxZar: 0,
  renderable: false,
  reason: 'No ledger rows were passed to the panel, so there is nothing to plot over time.',
};

function monthKey(year: number, month1: number): string {
  return `${year}-${month1 < 10 ? '0' : ''}${month1}`;
}

/**
 * Bucket the raw ledgers by calendar month.
 *
 * `NetworkFarmerSummary` carries only totals, so a time series is impossible
 * from the summary alone — this needs the raw `FarmerDataSources` the caller
 * already holds (e.g. `demoFarmerById(id)?.sources`). If the caller does not
 * pass them, this returns `renderable: false` and the panel draws nothing.
 * That is deliberate: an invented sparkline is worse than no sparkline.
 *
 * UTC bucketing on purpose — the same log must land in the same month for
 * every viewer, and the test needs an exact assertion.
 */
export function monthlyLedgerSeries(
  sources: FarmerDataSources | null | undefined,
  options: { months?: number; now?: Date; joinedAt?: string } = {},
): LedgerSeries {
  if (!sources) return EMPTY_SERIES;

  const window = Math.max(1, Math.trunc(options.months ?? 12));
  const now = options.now ?? sources.now ?? new Date();
  const production = sources.production;
  const sales = sources.sales;
  const expenses = sources.expenses;

  const hasProduction = production !== null;
  const hasMoney = sales !== null || expenses !== null;

  if (!hasProduction && !hasMoney) {
    return {
      ...EMPTY_SERIES,
      reason: 'None of the production, sales or expense books are readable for this farmer.',
    };
  }

  // Build the bucket list backwards from `now`, then clip at the month the
  // farmer joined — a site three months old must not show nine empty columns
  // that read as nine months of doing nothing.
  const endYear = now.getUTCFullYear();
  const endMonth = now.getUTCMonth(); // 0-11
  let startIndex = 0;
  const joinedMs = options.joinedAt ? Date.parse(options.joinedAt) : NaN;
  if (Number.isFinite(joinedMs)) {
    const j = new Date(joinedMs);
    const monthsSinceJoin =
      (endYear - j.getUTCFullYear()) * 12 + (endMonth - j.getUTCMonth());
    if (monthsSinceJoin >= 0 && monthsSinceJoin < window - 1) {
      startIndex = window - 1 - monthsSinceJoin;
    }
  }

  const months: LedgerMonth[] = [];
  const index = new Map<string, LedgerMonth>();
  for (let i = startIndex; i < window; i += 1) {
    const back = window - 1 - i;
    const d = new Date(Date.UTC(endYear, endMonth - back, 1));
    const bucket: LedgerMonth = {
      key: monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1),
      label: MONTH_SHORT[d.getUTCMonth()],
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      producedKg: hasProduction ? 0 : null,
      incomeZar: sales !== null ? 0 : null,
      expensesZar: expenses !== null ? 0 : null,
    };
    months.push(bucket);
    index.set(bucket.key, bucket);
  }

  const add = (iso: unknown, amount: unknown, field: 'producedKg' | 'incomeZar' | 'expensesZar') => {
    if (typeof iso !== 'string') return;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return;
    const d = new Date(t);
    const bucket = index.get(monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1));
    if (!bucket) return; // outside the window — correctly excluded, not clamped
    const n = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    const current = bucket[field];
    if (current === null) return;
    bucket[field] = current + n;
  };

  if (production) for (const r of production) add(r.logged_at, r.kg, 'producedKg');
  if (sales) for (const r of sales) add(r.sold_at, r.amount, 'incomeZar');
  if (expenses) for (const r of expenses) add(r.spent_at, r.amount, 'expensesZar');

  for (const b of months) {
    if (b.producedKg !== null) b.producedKg = Math.round(b.producedKg * 10) / 10;
    if (b.incomeZar !== null) b.incomeZar = Math.round(b.incomeZar);
    if (b.expensesZar !== null) b.expensesZar = Math.round(b.expensesZar);
  }

  const activeMonths = months.filter(
    (b) => (b.producedKg ?? 0) > 0 || (b.incomeZar ?? 0) > 0 || (b.expensesZar ?? 0) > 0,
  ).length;
  const maxKg = months.reduce((max, b) => Math.max(max, b.producedKg ?? 0), 0);
  const maxZar = months.reduce(
    (max, b) => Math.max(max, b.incomeZar ?? 0, b.expensesZar ?? 0),
    0,
  );

  let renderable = true;
  let reason = '';
  if (months.length < SERIES_MIN_MONTHS) {
    renderable = false;
    reason = `Only ${months.length} month${months.length === 1 ? '' : 's'} of history — too short to show as a trend.`;
  } else if (activeMonths < SERIES_MIN_ACTIVE_MONTHS) {
    renderable = false;
    reason =
      activeMonths === 0
        ? 'No dated entries in this period, so there is no trend to draw.'
        : 'Only one month has entries — a single point is not a trend.';
  }

  return { months, activeMonths, hasProduction, hasMoney, maxKg, maxZar, renderable, reason };
}
