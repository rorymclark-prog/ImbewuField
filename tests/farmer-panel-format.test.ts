// Unit tests for components/network/FarmerPanel.format.ts — the pure half of
// the funder-facing farmer panel.
//
// WHY THIS TEST EXISTS: the panel shows one person's financial records to
// somebody else. Every metric in lib/network.ts is nullable and `null` means
// "this viewer could not read it", NOT "zero". A funder shown a confident 0
// that actually means "we never asked" will make a funding decision on it.
// That distinction lives entirely in this module, so it is tested here rather
// than trusted to review.
//
// The component itself is .tsx and cannot be imported by node's type stripping
// (no JSX support), which is exactly why the derivations live in a plain .ts
// sibling. Run with:
//   node --import ./tests/register-alias.mjs --test tests/farmer-panel-format.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  financeRows,
  formatArea,
  formatDaysAgo,
  formatJoinedDate,
  formatKg,
  formatMonthsActive,
  formatPct,
  formatZar,
  initialsOf,
  monthlyLedgerSeries,
  produceRows,
  progressReadout,
  stageLabel,
  statusLabel,
  surveyReadout,
  toReadout,
  NOT_RECORDED_TEXT,
  NOT_VISIBLE_TEXT,
  SERIES_MIN_ACTIVE_MONTHS,
  SERIES_MIN_MONTHS,
  type PanelRow,
} from '@/components/network/FarmerPanel.format';
import type { NetworkFarmerMetrics } from '@/lib/network';
import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';

/* ── fixtures ─────────────────────────────────────────────────────────── */

/** Everything readable and non-empty — the "happy funder" farmer. */
function metrics(over: Partial<NetworkFarmerMetrics> = {}): NetworkFarmerMetrics {
  const base: NetworkFarmerMetrics = {
    monthsActive: 14,
    producedKg: 412.5,
    soldKg: 260,
    keptKg: 152.5,
    soldPct: 63,
    incomeZar: 4820,
    expensesZar: 1930,
    netZar: 2890,
    estimatedValueZar: 7107.5,
    plannedKg: 500,
    harvestedKg: 412.5,
    harvestedVsPlannedPct: 83,
    progressPct: 72,
    stage: 'designed',
    steps: [
      { key: 'located', label: 'Site located', done: true, pct: 100 },
      { key: 'boundary', label: 'Boundary traced', done: true, pct: 100 },
      { key: 'survey', label: 'Site survey filled', done: false, pct: 60 },
      { key: 'design', label: 'Design done', done: true, pct: 100 },
      { key: 'cropPlan', label: 'Crop plan done', done: false, pct: 0 },
    ],
    surveyFilled: 6,
    surveyTotal: 10,
    surveyPct: 60,
    modulesDone: 7,
    modulesTotal: 10,
    trainingPct: 70,
    surveysAnswered: 2,
    lastActivityAt: '2026-07-02T09:00:00.000Z',
    daysSinceActivity: 12,
    coverage: {
      production: true, sales: true, expenses: true, courses: true,
      surveys: true, siteProgress: true, plan: true,
    },
  };
  return { ...base, ...over, coverage: { ...base.coverage, ...(over.coverage ?? {}) } };
}

/** A farmer whose records this viewer cannot read at all. */
function blindMetrics(): NetworkFarmerMetrics {
  return metrics({
    producedKg: null, soldKg: null, keptKg: null, soldPct: null,
    incomeZar: null, expensesZar: null, netZar: null, estimatedValueZar: null,
    plannedKg: null, harvestedKg: null, harvestedVsPlannedPct: null,
    progressPct: null, stage: null, steps: null,
    surveyFilled: null, surveyTotal: null, surveyPct: null,
    modulesDone: null, trainingPct: null, surveysAnswered: null,
    lastActivityAt: null, daysSinceActivity: null,
    coverage: {
      production: false, sales: false, expenses: false, courses: false,
      surveys: false, siteProgress: false, plan: false,
    },
  });
}

function row(rows: PanelRow[], key: string): PanelRow {
  const found = rows.find((r) => r.key === key);
  assert.ok(found, `expected a row keyed '${key}'`);
  return found;
}

/* ── the core rule: null ≠ 0 ──────────────────────────────────────────── */

test('toReadout: null is "not visible", never a number', () => {
  const r = toReadout(null, formatZar);
  assert.equal(r.state, 'not_visible');
  assert.equal(r.text, NOT_VISIBLE_TEXT);
  assert.ok(!/\d/.test(r.text), 'a denied read must not render any digit');
});

test('toReadout: a readable-but-empty ledger is "not recorded", not R0', () => {
  const r = toReadout(0, formatZar);
  assert.equal(r.state, 'not_recorded');
  assert.equal(r.text, NOT_RECORDED_TEXT);
  assert.notEqual(r.text, 'R0');
});

test('toReadout: zero can be a genuine reading when the caller says so', () => {
  const r = toReadout(0, formatZar, { treatZeroAsEmpty: false });
  assert.equal(r.state, 'value');
  assert.equal(r.text, 'R0');
});

test('toReadout: a real value renders as a value', () => {
  const r = toReadout(4820, formatZar);
  assert.equal(r.state, 'value');
  assert.equal(r.text, 'R4 820');
  assert.equal(r.note, '');
});

test('toReadout: NaN and Infinity are treated as unreadable, not as 0', () => {
  assert.equal(toReadout(Number.NaN, formatZar).state, 'not_visible');
  assert.equal(toReadout(Number.POSITIVE_INFINITY, formatZar).state, 'not_visible');
});

/* ── formatters ───────────────────────────────────────────────────────── */

test('formatZar: whole rand, space-grouped, signed', () => {
  assert.equal(formatZar(0), 'R0');
  assert.equal(formatZar(940), 'R940');
  assert.equal(formatZar(4820), 'R4 820');
  assert.equal(formatZar(1234567), 'R1 234 567');
  assert.equal(formatZar(-310.4), '-R310');
});

test('formatKg: 1dp under 100, whole under 1000, tonnes above', () => {
  assert.equal(formatKg(12.44), '12.4 kg');
  assert.equal(formatKg(340.6), '341 kg');
  assert.equal(formatKg(1250), '1.3 t');
});

test('formatArea: m² under a hectare, ha above', () => {
  assert.equal(formatArea(450), '450 m²');
  assert.equal(formatArea(9999), '9 999 m²');
  assert.equal(formatArea(14000), '1.4 ha');
});

test('formatPct rounds to a whole percent', () => {
  assert.equal(formatPct(62.6), '63%');
});

test('formatMonthsActive reads as a human duration', () => {
  assert.equal(formatMonthsActive(0), 'less than a month');
  assert.equal(formatMonthsActive(1), '1 month');
  assert.equal(formatMonthsActive(7), '7 months');
  assert.equal(formatMonthsActive(12), '1 year');
  assert.equal(formatMonthsActive(15), '1 year 3 months');
  assert.equal(formatMonthsActive(24), '2 years');
  assert.equal(formatMonthsActive(25), '2 years 1 month');
});

test('formatJoinedDate is timezone-independent (UTC), so every viewer sees one month', () => {
  assert.equal(formatJoinedDate('2024-03-15T09:00:00.000Z'), 'March 2024');
  assert.equal(formatJoinedDate('2026-01-01T00:00:00.000Z'), 'January 2026');
  assert.equal(formatJoinedDate('not-a-date'), 'date unknown');
});

test('formatDaysAgo', () => {
  assert.equal(formatDaysAgo(0), 'today');
  assert.equal(formatDaysAgo(1), 'yesterday');
  assert.equal(formatDaysAgo(12), '12 days ago');
  assert.equal(formatDaysAgo(120), '4 months ago');
  assert.equal(formatDaysAgo(800), '2 years ago');
});

test('initialsOf handles one, two and many names', () => {
  assert.equal(initialsOf('Nomsa'), 'NO');
  assert.equal(initialsOf('Nomsa Mthembu'), 'NM');
  assert.equal(initialsOf('  Sipho John  Ndlovu '), 'SN');
  assert.equal(initialsOf(''), '?');
});

test('statusLabel and stageLabel cover the enums', () => {
  assert.equal(statusLabel('thriving'), 'Thriving');
  assert.equal(statusLabel('support'), 'Needs support');
  assert.equal(stageLabel('designed'), 'Design done');
});

/* ── financials ───────────────────────────────────────────────────────── */

test('financeRows: readable books produce real figures', () => {
  const rows = financeRows(metrics());
  assert.equal(row(rows, 'income').readout.text, 'R4 820');
  assert.equal(row(rows, 'expenses').readout.text, 'R1 930');
  assert.equal(row(rows, 'net').readout.text, 'R2 890');
  assert.equal(row(rows, 'value').readout.text, 'R7 108');
});

test('financeRows: an unreadable book says so and shows no digit', () => {
  const rows = financeRows(blindMetrics());
  for (const key of ['income', 'expenses', 'net', 'value']) {
    const r = row(rows, key).readout;
    assert.equal(r.state, 'not_visible', `${key} must be not_visible`);
    assert.ok(!/\d/.test(r.text), `${key} must not render a digit`);
  }
});

test('financeRows: empty books read as "not recorded", never R0', () => {
  const rows = financeRows(metrics({ incomeZar: 0, expensesZar: 0, netZar: 0, estimatedValueZar: 0 }));
  assert.equal(row(rows, 'income').readout.state, 'not_recorded');
  assert.equal(row(rows, 'income').readout.text, 'No sales recorded yet');
  assert.equal(row(rows, 'net').readout.state, 'not_recorded');
  for (const key of ['income', 'expenses', 'net', 'value']) {
    assert.ok(!/R\s?0\b/.test(row(rows, key).readout.text), `${key} must not print R0`);
  }
});

test('financeRows: a genuine break-even net is a value, not "not recorded"', () => {
  // Money moved in and out and happened to cancel — that IS a reading.
  const rows = financeRows(metrics({ incomeZar: 1500, expensesZar: 1500, netZar: 0 }));
  const net = row(rows, 'net').readout;
  assert.equal(net.state, 'value');
  assert.equal(net.text, 'R0');
});

test('financeRows: a loss keeps its sign and is toned negative', () => {
  const rows = financeRows(metrics({ incomeZar: 800, expensesZar: 2000, netZar: -1200 }));
  const net = row(rows, 'net');
  assert.equal(net.readout.text, '-R1 200');
  assert.equal(net.tone, 'negative');
});

test('financeRows: the household-value estimate is labelled as an estimate', () => {
  const value = row(financeRows(metrics()), 'value');
  assert.ok(value.caveat && /estimate/i.test(value.caveat));
  assert.ok(/not revenue/i.test(value.caveat));
});

test('every finance and produce row names the selector it came from', () => {
  for (const r of [...financeRows(metrics()), ...produceRows(metrics())]) {
    assert.ok(r.selector.startsWith('NetworkFarmerMetrics.'), `${r.key} lacks a selector`);
  }
});

test('produceRows: readable and unreadable production', () => {
  assert.equal(row(produceRows(metrics()), 'produced').readout.text, '413 kg');
  assert.equal(row(produceRows(metrics()), 'kept').readout.text, '153 kg');
  assert.equal(row(produceRows(blindMetrics()), 'produced').readout.state, 'not_visible');
});

test('produceRows: nothing sold yet is distinct from sales being unreadable', () => {
  const empty = row(produceRows(metrics({ soldKg: 0 })), 'sold').readout;
  assert.equal(empty.state, 'not_recorded');
  assert.equal(empty.text, 'None sold yet');

  const denied = row(produceRows(metrics({ soldKg: null })), 'sold').readout;
  assert.equal(denied.state, 'not_visible');
  assert.notEqual(denied.text, empty.text, 'denied and empty must not read the same');
});

/* ── surveys ──────────────────────────────────────────────────────────── */

test('surveyReadout: a partial survey reads as incomplete, with its denominator', () => {
  const s = surveyReadout(metrics());
  assert.equal(s.state, 'partial');
  assert.equal(s.headline, '6 of 10 answered');
  assert.equal(s.missing, 4);
  assert.ok(/blank/i.test(s.note), 'must say the remainder is blank');
  assert.ok(/not zero/i.test(s.note), 'must say blanks are not zeros');
});

test('surveyReadout: an untouched survey is "not started", never 0%', () => {
  const s = surveyReadout(metrics({ surveyFilled: 0, surveyPct: 0 }));
  assert.equal(s.state, 'not_started');
  assert.equal(s.headline, '0 of 10 answered');
  assert.ok(/not been started/i.test(s.note));
  assert.ok(/not a score of zero/i.test(s.note));
});

test('surveyReadout: a complete survey says so', () => {
  const s = surveyReadout(metrics({ surveyFilled: 10, surveyPct: 100 }));
  assert.equal(s.state, 'complete');
  assert.equal(s.missing, 0);
});

test('surveyReadout: an unreadable survey is not an empty survey', () => {
  const s = surveyReadout(blindMetrics());
  assert.equal(s.state, 'not_visible');
  assert.equal(s.filled, null);
  assert.equal(s.headline, NOT_VISIBLE_TEXT);
  assert.ok(!/\d/.test(s.headline));
  assert.ok(/not readable/i.test(s.note));
});

test('surveyReadout: coverage.siteProgress false wins even if counts leak through', () => {
  // Defends against a caller that fills the counts but flags them unreadable.
  const s = surveyReadout(metrics({ coverage: { siteProgress: false } as never }));
  assert.equal(s.state, 'not_visible');
});

test('surveyReadout: programme rounds distinguish "none answered" from "cannot read"', () => {
  assert.equal(surveyReadout(metrics()).ngoRounds.text, '2 rounds answered');
  assert.equal(surveyReadout(metrics({ surveysAnswered: 1 })).ngoRounds.text, '1 round answered');

  const none = surveyReadout(metrics({ surveysAnswered: 0 })).ngoRounds;
  assert.equal(none.state, 'not_recorded');
  assert.equal(none.text, 'No rounds answered yet');

  const denied = surveyReadout(metrics({ surveysAnswered: null })).ngoRounds;
  assert.equal(denied.state, 'not_visible');
});

/* ── progress ─────────────────────────────────────────────────────────── */

test('progressReadout: the headline names what the percentage is a proportion OF', () => {
  const p = progressReadout(metrics());
  assert.equal(p.visible, true);
  assert.equal(p.pct, 72);
  assert.equal(p.stepsTotal, 5);
  assert.equal(p.stepsDone, 3);
  assert.equal(p.headline, '72% of site setup — 3 of 5 steps done');
  assert.ok(/weighted/i.test(p.note), 'must explain the weighting');
});

test('progressReadout: unreadable progress renders no percentage at all', () => {
  const p = progressReadout(blindMetrics());
  assert.equal(p.visible, false);
  assert.equal(p.pct, null);
  assert.equal(p.headline, NOT_VISIBLE_TEXT);
  assert.ok(!/\d/.test(p.headline));
});

test('progressReadout: training is a separate proportion with its own denominator', () => {
  assert.equal(progressReadout(metrics()).training.text, '7 of 10 modules');

  const none = progressReadout(metrics({ modulesDone: 0, trainingPct: 0 })).training;
  assert.equal(none.state, 'not_recorded');
  assert.equal(none.text, '0 of 10 modules', 'a real 0-of-10 still names the denominator');

  const denied = progressReadout(metrics({ modulesDone: null, trainingPct: null })).training;
  assert.equal(denied.state, 'not_visible');
});

/* ── monthly series ───────────────────────────────────────────────────── */

const NOW = new Date('2026-08-05T12:00:00.000Z');

function prod(id: string, iso: string, kg: number): ProductionLog {
  return { id, profile_id: 'f1', garden_id: 'g1', crop: 'Spinach', kg, photo_url: null, logged_at: iso, created_at: iso };
}
function sale(id: string, iso: string, kg: number, amount: number): SalesLog {
  return { id, profile_id: 'f1', garden_id: 'g1', crop: 'Spinach', kg, amount, buyer: 'Market', sold_at: iso, created_at: iso };
}
function spend(id: string, iso: string, amount: number): ExpenseLog {
  return { id, profile_id: 'f1', garden_id: 'g1', item: 'Seed', amount, supplier: null, spent_at: iso, created_at: iso };
}

test('monthlyLedgerSeries: no sources at all → nothing to draw', () => {
  const s = monthlyLedgerSeries(undefined);
  assert.equal(s.renderable, false);
  assert.equal(s.months.length, 0);
  assert.ok(s.reason.length > 0, 'must explain itself instead of drawing');
});

test('monthlyLedgerSeries: buckets dated rows into calendar months', () => {
  const s = monthlyLedgerSeries(
    {
      production: [
        prod('p1', '2026-06-10T08:00:00.000Z', 20),
        prod('p2', '2026-06-24T08:00:00.000Z', 12.5),
        prod('p3', '2026-07-14T08:00:00.000Z', 40),
      ],
      sales: [sale('s1', '2026-07-20T08:00:00.000Z', 30, 360)],
      expenses: [spend('e1', '2026-05-02T08:00:00.000Z', 210)],
      courses: [],
      now: NOW,
    },
    { months: 12 },
  );

  assert.equal(s.months.length, 12);
  assert.equal(s.months[s.months.length - 1].key, '2026-08');

  const june = s.months.find((b) => b.key === '2026-06');
  const july = s.months.find((b) => b.key === '2026-07');
  const may = s.months.find((b) => b.key === '2026-05');
  assert.equal(june?.producedKg, 32.5, 'two June harvests sum');
  assert.equal(july?.producedKg, 40);
  assert.equal(july?.incomeZar, 360);
  assert.equal(may?.expensesZar, 210);
  assert.equal(s.maxKg, 40);
  assert.equal(s.activeMonths, 3);
  assert.equal(s.renderable, true);
});

test('monthlyLedgerSeries: an unreadable ledger stays null per month — not 0', () => {
  const s = monthlyLedgerSeries(
    {
      production: [prod('p1', '2026-06-10T08:00:00.000Z', 20), prod('p2', '2026-07-10T08:00:00.000Z', 20)],
      sales: null,       // denied
      expenses: null,    // denied
      courses: null,
      now: NOW,
    },
    { months: 12 },
  );
  assert.equal(s.hasMoney, false);
  for (const b of s.months) {
    assert.equal(b.incomeZar, null, `${b.key} income must stay null, not 0`);
    assert.equal(b.expensesZar, null, `${b.key} expenses must stay null, not 0`);
    assert.notEqual(b.producedKg, null);
  }
});

test('monthlyLedgerSeries: a single active month is refused as a trend', () => {
  const s = monthlyLedgerSeries(
    { production: [prod('p1', '2026-07-10T08:00:00.000Z', 20)], sales: [], expenses: [], courses: [], now: NOW },
    { months: 12 },
  );
  assert.equal(s.activeMonths, 1);
  assert.ok(s.activeMonths < SERIES_MIN_ACTIVE_MONTHS);
  assert.equal(s.renderable, false, 'one point is not a trend');
  assert.ok(/not a trend/i.test(s.reason));
});

test('monthlyLedgerSeries: readable but wholly empty books draw nothing', () => {
  const s = monthlyLedgerSeries(
    { production: [], sales: [], expenses: [], courses: [], now: NOW },
    { months: 12 },
  );
  assert.equal(s.activeMonths, 0);
  assert.equal(s.renderable, false);
  assert.ok(/no trend|no dated entries/i.test(s.reason));
});

test('monthlyLedgerSeries: the window is clipped at joinedAt, so a young site shows no phantom months', () => {
  const s = monthlyLedgerSeries(
    {
      production: [prod('p1', '2026-07-02T08:00:00.000Z', 10), prod('p2', '2026-08-02T08:00:00.000Z', 14)],
      sales: [], expenses: [], courses: [], now: NOW,
    },
    { months: 12, joinedAt: '2026-06-01T09:00:00.000Z' },
  );
  assert.equal(s.months.length, 3, 'June, July, August only');
  assert.equal(s.months[0].key, '2026-06');
  assert.equal(s.months[2].key, '2026-08');
  assert.equal(s.renderable, true);
  assert.ok(s.months.length >= SERIES_MIN_MONTHS);
});

test('monthlyLedgerSeries: a site younger than the minimum window refuses to plot', () => {
  const s = monthlyLedgerSeries(
    {
      production: [prod('p1', '2026-07-20T08:00:00.000Z', 10), prod('p2', '2026-08-02T08:00:00.000Z', 14)],
      sales: [], expenses: [], courses: [], now: NOW,
    },
    { months: 12, joinedAt: '2026-07-05T09:00:00.000Z' },
  );
  assert.equal(s.months.length, 2);
  assert.equal(s.renderable, false);
  assert.ok(/too short/i.test(s.reason));
});

test('monthlyLedgerSeries: rows outside the window are excluded, never clamped into an edge month', () => {
  const s = monthlyLedgerSeries(
    {
      production: [
        prod('old', '2019-01-10T08:00:00.000Z', 900),  // far outside
        prod('p1', '2026-06-10T08:00:00.000Z', 20),
        prod('p2', '2026-07-10T08:00:00.000Z', 30),
      ],
      sales: [], expenses: [], courses: [], now: NOW,
    },
    { months: 6 },
  );
  assert.equal(s.months.length, 6);
  assert.equal(s.maxKg, 30, 'the 900 kg outlier must not be folded into the first bucket');
  assert.equal(s.months.reduce((t, b) => t + (b.producedKg ?? 0), 0), 50);
});

test('monthlyLedgerSeries: unparseable dates are dropped rather than counted as 0-month rows', () => {
  const s = monthlyLedgerSeries(
    {
      production: [prod('bad', 'not-a-date', 99), prod('p1', '2026-06-10T08:00:00.000Z', 20), prod('p2', '2026-07-10T08:00:00.000Z', 20)],
      sales: [], expenses: [], courses: [], now: NOW,
    },
    { months: 12 },
  );
  assert.equal(s.months.reduce((t, b) => t + (b.producedKg ?? 0), 0), 40);
  assert.equal(s.activeMonths, 2);
});

test('the minimum-trend thresholds are the documented ones', () => {
  assert.equal(SERIES_MIN_MONTHS, 3);
  assert.equal(SERIES_MIN_ACTIVE_MONTHS, 2);
});
