/*
 * THE COHORT DASHBOARD'S ARITHMETIC — lib/cohort-series.ts and lib/cohort-report.ts.
 *
 * What is worth testing here is not "does it add up". It is the handful of places where the
 * OBVIOUS implementation would produce a number that reads as a fact and is not one, because every
 * one of those numbers ends up in front of somebody deciding whether to fund a programme:
 *
 *   • a withheld book bucketed as a zero month        → "this farm produced nothing"
 *   • produced − sold across different consenting sets → an invented "kept at home" figure
 *   • a local-time month boundary                      → a log in a different column per viewer
 *   • an empty CSV cell written as 0                   → a zero that survives into a spreadsheet
 *   • a farmer name beginning "=" or "+"               → a formula that runs on open
 *
 * Some of the assertions below are deliberately cross-module: the cohort series must bucket a row
 * into the same month that components/network/FarmerPanel.format.ts's per-farmer strip does, or
 * one funder screen contradicts another about which month a harvest happened in.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import type { ExpenseLog, ProductionLog, SalesLog } from '../lib/db/types.ts';
import {
  COHORT_MIN_ACTIVE_MONTHS,
  COHORT_MIN_MONTHS,
  buildCohortSeries,
  clampCohortWindow,
  emptyCohortSeries,
  type CohortLedger,
} from '../lib/cohort-series.ts';
import {
  COHORT_CSV_COLUMNS,
  cohortCsv,
  cohortCsvFilename,
  cohortTraining,
} from '../lib/cohort-report.ts';
import { monthlyLedgerSeries } from '../components/network/FarmerPanel.format.ts';
import {
  DEFAULT_COURSE_MODULE_COUNT,
  buildFarmerMetrics,
  type NetworkFarmer,
  type NetworkFarmerSummary,
} from '../lib/network.ts';
import { DEMO_COHORT_MONTHLY, DEMO_NETWORK } from '../lib/network-demo.ts';

/* ────────────────────────────────────────────────────────────────────────────
 * fixtures
 * ──────────────────────────────────────────────────────────────────────────*/

const NOW = new Date('2026-06-15T09:00:00.000Z');

function production(iso: string, kg: number, id = `p-${iso}-${kg}`): ProductionLog {
  return {
    id, profile_id: 'f1', garden_id: null, crop: 'spinach', kg,
    photo_url: null, logged_at: iso, created_at: iso,
  };
}

function sale(iso: string, kg: number, amount: number, id = `s-${iso}-${kg}`): SalesLog {
  return {
    id, profile_id: 'f1', garden_id: null, crop: 'spinach', kg, amount,
    buyer: null, sold_at: iso, created_at: iso,
  };
}

function expense(iso: string, amount: number, id = `x-${iso}-${amount}`): ExpenseLog {
  return {
    id, profile_id: 'f1', garden_id: null, item: 'seed', amount,
    supplier: null, spent_at: iso, created_at: iso,
  };
}

/** A ledger with something in every month of the window, so `renderable` is never the thing under
 *  test unless it is the thing under test. */
function busyLedger(overrides: Partial<CohortLedger> = {}): CohortLedger {
  const prod: ProductionLog[] = [];
  const sales: SalesLog[] = [];
  for (let m = 7; m <= 12; m += 1) {
    prod.push(production(`2025-${String(m).padStart(2, '0')}-10T08:00:00.000Z`, 20, `p25-${m}`));
    sales.push(sale(`2025-${String(m).padStart(2, '0')}-12T08:00:00.000Z`, 10, 100, `s25-${m}`));
  }
  for (let m = 1; m <= 6; m += 1) {
    prod.push(production(`2026-${String(m).padStart(2, '0')}-10T08:00:00.000Z`, 30, `p26-${m}`));
    sales.push(sale(`2026-${String(m).padStart(2, '0')}-12T08:00:00.000Z`, 15, 150, `s26-${m}`));
  }
  return { production: prod, sales, expenses: [], joinedAt: null, ...overrides };
}

function farmer(over: Partial<NetworkFarmer> = {}): NetworkFarmer {
  return {
    id: 'f1', name: 'Nomsa Dlamini', orgId: 'org1', cohortId: 'c1', cohortName: 'Cohort A',
    siteName: 'Emoyeni', district: 'Hluhluwe', municipality: 'uMkhanyakude',
    lat: -28.02, lon: 32.27, coordPrecision: 'coarse', plotSizeM2: 400, plotLabel: null,
    joinedAt: '2025-07-01T00:00:00.000Z', status: 'thriving', photoUrl: null,
    consent: 'granted', isDemo: false, ...over,
  };
}

/** A summary with a specific module count and otherwise readable books. */
function summaryWith(modulesDone: number | null, over: Partial<NetworkFarmer> = {}): NetworkFarmerSummary {
  const f = farmer(over);
  const metrics = buildFarmerMetrics(f, {
    production: [production('2026-05-02T08:00:00.000Z', 12)],
    sales: [sale('2026-05-03T08:00:00.000Z', 8, 96)],
    expenses: [expense('2026-04-02T08:00:00.000Z', 40)],
    courses: modulesDone === null
      ? null
      : Array.from({ length: modulesDone }, (_, i) => ({
          id: `c${i}`, profile_id: f.id, module: `m${i}`, done: true,
          updated_at: '2026-04-01T00:00:00.000Z',
        })),
    surveys: [],
    now: NOW,
  });
  return { farmer: f, metrics };
}

/* ════════════════════════════════════════════════════════════════════════════
 * buildCohortSeries — the time axis
 * ══════════════════════════════════════════════════════════════════════════*/

test('cohort series: a withheld book is null for every month, never a row of zeros', () => {
  const s = buildCohortSeries(
    [{ production: busyLedger().production, sales: null, expenses: null, joinedAt: null }],
    { months: 12, now: NOW },
  );

  assert.equal(s.productionFarmers, 1);
  assert.equal(s.salesFarmers, 0);
  assert.equal(s.totalSoldKg, null, 'no readable sales book → null, not 0');
  assert.equal(s.totalIncomeZar, null);
  for (const m of s.months) {
    assert.equal(m.soldKg, null, `${m.key} sold must be null`);
    assert.equal(m.incomeZar, null, `${m.key} income must be null`);
    assert.notEqual(m.producedKg, null, `${m.key} produced is readable and must be a number`);
  }
});

test('cohort series: a readable but genuinely empty book is 0, not null', () => {
  // The distinction the whole module exists for, from the other side. `[]` means "we looked and
  // there was nothing", which IS a zero month and must draw as one.
  const s = buildCohortSeries(
    [{ production: busyLedger().production, sales: [], expenses: null, joinedAt: null }],
    { months: 12, now: NOW },
  );
  assert.equal(s.salesFarmers, 1);
  assert.equal(s.totalSoldKg, 0);
  for (const m of s.months) assert.equal(m.soldKg, 0);
});

test('cohort series: buckets in UTC, and a row on a month boundary lands in the UTC month', () => {
  // 23:30 on 31 March UTC is 01:30 on 1 April in Johannesburg. It must be March for everyone.
  const s = buildCohortSeries(
    [{
      production: [production('2026-03-31T23:30:00.000Z', 9)],
      sales: [sale('2026-04-01T00:30:00.000Z', 4, 44)],
      expenses: null,
      joinedAt: null,
    }],
    { months: 12, now: NOW },
  );
  const march = s.months.find((m) => m.key === '2026-03');
  const april = s.months.find((m) => m.key === '2026-04');
  assert.ok(march && april);
  assert.equal(march.producedKg, 9);
  assert.equal(april.producedKg, 0);
  assert.equal(april.soldKg, 4);
  assert.equal(march.soldKg, 0);
});

test('cohort series: one farmer agrees with the per-farmer strip on every month', () => {
  // The cross-module assertion. If these two ever bucket differently, the cohort chart and the
  // farmer panel opened from it will disagree about which month a harvest happened in, and the
  // person noticing will be a funder.
  const ledger = busyLedger();
  const cohort = buildCohortSeries([ledger], { months: 12, now: NOW });
  const single = monthlyLedgerSeries(
    { production: ledger.production, sales: ledger.sales, expenses: [], courses: null },
    { months: 12, now: NOW },
  );

  assert.equal(cohort.months.length, single.months.length);
  cohort.months.forEach((m, i) => {
    assert.equal(m.key, single.months[i].key, 'month keys must line up');
    assert.equal(m.producedKg, single.months[i].producedKg, `${m.key} produced`);
    // LedgerMonth carries income but no sold-kg field, so income is the money comparison here.
    assert.equal(m.incomeZar, single.months[i].incomeZar, `${m.key} income`);
  });
});

test('cohort series: the left edge is clipped at the earliest join date', () => {
  const joined = '2026-02-01T00:00:00.000Z'; // four months before NOW
  const s = buildCohortSeries(
    [
      { production: [production('2026-03-05T08:00:00.000Z', 5)], sales: [], expenses: null, joinedAt: joined },
      { production: [production('2026-04-05T08:00:00.000Z', 6)], sales: [], expenses: null, joinedAt: '2026-03-01T00:00:00.000Z' },
    ],
    { months: 12, now: NOW },
  );
  assert.equal(s.months[0].key, '2026-02', 'must start at the earliest joiner, not 12 months back');
  assert.equal(s.months[s.months.length - 1].key, '2026-06');
  assert.equal(s.months.length, 5);
});

test('cohort series: one farmer with an unknown join date keeps the full window', () => {
  // An unknown start date is not evidence the programme is young, so it must not shorten the axis.
  const s = buildCohortSeries(
    [
      { production: [production('2026-03-05T08:00:00.000Z', 5)], sales: [], expenses: null, joinedAt: '2026-02-01T00:00:00.000Z' },
      { production: [production('2026-04-05T08:00:00.000Z', 6)], sales: [], expenses: null, joinedAt: null },
    ],
    { months: 12, now: NOW },
  );
  assert.equal(s.months.length, 12);
});

test('cohort series: kept kg is refused when harvest and sales come from different farmers', () => {
  // Farmer A shares harvest only, farmer B shares sales only. produced − sold across them is
  // arithmetic on two different people and means nothing, so it must not be offered.
  const a = busyLedger();
  const s = buildCohortSeries(
    [
      { production: a.production, sales: null, expenses: null, joinedAt: null },
      { production: null, sales: a.sales, expenses: null, joinedAt: null },
    ],
    { months: 12, now: NOW },
  );
  assert.equal(s.keptComparable, false);
  assert.equal(s.totalKeptKg, null);
  for (const m of s.months) assert.equal(m.keptKg, null);
});

test('cohort series: kept kg is offered when both books come from the same farmers', () => {
  const s = buildCohortSeries([busyLedger(), busyLedger()], { months: 12, now: NOW });
  assert.equal(s.keptComparable, true);
  assert.ok(s.totalProducedKg !== null && s.totalSoldKg !== null && s.totalKeptKg !== null);
  assert.equal(s.totalKeptKg, Math.round((s.totalProducedKg - s.totalSoldKg) * 10) / 10);
});

test('cohort series: a month that sold more than it picked is flagged, not given a negative kept', () => {
  const s = buildCohortSeries(
    [{
      production: [production('2026-05-02T08:00:00.000Z', 4)],
      sales: [sale('2026-05-04T08:00:00.000Z', 30, 300)],
      expenses: null,
      joinedAt: null,
    }],
    { months: 12, now: NOW },
  );
  const may = s.months.find((m) => m.key === '2026-05');
  assert.ok(may);
  assert.equal(may.soldExceedsProduced, true);
  assert.equal(may.keptKg, null, 'never a negative kept figure');
  assert.equal(s.totalKeptKg, null, 'and the window total is refused too');
});

test('cohort series: activeFarmers counts people, not rows', () => {
  const three = [
    production('2026-05-02T08:00:00.000Z', 1, 'a'),
    production('2026-05-09T08:00:00.000Z', 1, 'b'),
    production('2026-05-19T08:00:00.000Z', 1, 'c'),
  ];
  const s = buildCohortSeries(
    [
      { production: three, sales: [], expenses: null, joinedAt: null },
      { production: [production('2026-05-03T08:00:00.000Z', 1, 'd')], sales: [], expenses: null, joinedAt: null },
      { production: [], sales: [], expenses: null, joinedAt: null },
    ],
    { months: 12, now: NOW },
  );
  const may = s.months.find((m) => m.key === '2026-05');
  assert.ok(may);
  assert.equal(may.activeFarmers, 2, 'four rows from two farmers is two active farmers');
});

test('cohort series: a row outside the window is dropped, never clamped onto the edge month', () => {
  const s = buildCohortSeries(
    [{
      production: [production('2019-01-05T08:00:00.000Z', 999), production('2026-05-05T08:00:00.000Z', 7)],
      sales: [],
      expenses: null,
      joinedAt: null,
    }],
    { months: 12, now: NOW },
  );
  assert.equal(s.totalProducedKg, 7, 'the 2019 row must not be folded into the first column');
  assert.equal(s.months[0].producedKg, 0);
});

test('cohort series: refuses to draw one lonely point', () => {
  const s = buildCohortSeries(
    [{ production: [production('2026-05-05T08:00:00.000Z', 7)], sales: [], expenses: null, joinedAt: null }],
    { months: 12, now: NOW },
  );
  assert.equal(s.activeMonths, 1);
  assert.equal(s.renderable, false);
  assert.match(s.reason, /single point|one month/i);
});

test('cohort series: refuses to draw an empty period, and says why', () => {
  const s = buildCohortSeries(
    [{ production: [], sales: [], expenses: [], joinedAt: null }],
    { months: 12, now: NOW },
  );
  assert.equal(s.renderable, false);
  assert.ok(s.reason.length > 0);
});

test('cohort series: every farmer withholding everything is a stated reason, not an empty chart', () => {
  const s = buildCohortSeries(
    [
      { production: null, sales: null, expenses: null, joinedAt: null },
      { production: null, sales: null, expenses: null, joinedAt: null },
    ],
    { months: 12, now: NOW },
  );
  assert.equal(s.renderable, false);
  assert.equal(s.farmerCount, 2);
  assert.match(s.reason, /agreed to share/i);
});

test('cohort series: no ledgers at all is the empty series, not a throw', () => {
  const s = buildCohortSeries([], { months: 12, now: NOW });
  assert.equal(s.renderable, false);
  assert.equal(s.months.length, 0);
  assert.equal(s.farmerCount, 0);
});

test('cohort series: an invalid `now` degrades to the empty series rather than NaN months', () => {
  const s = buildCohortSeries([busyLedger()], { months: 12, now: new Date('nonsense') });
  assert.equal(s.renderable, false);
  assert.equal(s.months.length, 0);
});

test('clampCohortWindow keeps the axis between the minimum and two years', () => {
  assert.equal(clampCohortWindow(12), 12);
  assert.equal(clampCohortWindow(1), COHORT_MIN_MONTHS);
  assert.equal(clampCohortWindow(0), COHORT_MIN_MONTHS);
  assert.equal(clampCohortWindow(-5), COHORT_MIN_MONTHS);
  assert.equal(clampCohortWindow(400), 24);
  assert.equal(clampCohortWindow(Number.NaN), 12);
  assert.ok(COHORT_MIN_ACTIVE_MONTHS >= 2, 'one point is never a trend');
});

test('emptyCohortSeries carries the caller reason and is still unrenderable', () => {
  const s = emptyCohortSeries('Not loaded yet.');
  assert.equal(s.renderable, false);
  assert.equal(s.reason, 'Not loaded yet.');
  assert.equal(s.totalProducedKg, null);
  assert.notEqual(emptyCohortSeries().reason, '');
});

test('the demo cohort series is built from the demo portfolio and is drawable', () => {
  // The dashboard's sample state has to be worth looking at, or the demo cannot be demonstrated.
  assert.equal(DEMO_COHORT_MONTHLY.farmerCount, DEMO_NETWORK.farmers.length);
  assert.equal(DEMO_COHORT_MONTHLY.renderable, true, DEMO_COHORT_MONTHLY.reason);
  assert.ok(DEMO_COHORT_MONTHLY.months.length >= COHORT_MIN_MONTHS);
  assert.ok((DEMO_COHORT_MONTHLY.totalProducedKg ?? 0) > 0);
});

/* ════════════════════════════════════════════════════════════════════════════
 * cohortTraining
 * ══════════════════════════════════════════════════════════════════════════*/

test('training: a withheld record is counted as a farmer and never lands in a band', () => {
  const rows = [summaryWith(4), summaryWith(null, { id: 'f2' }), summaryWith(null, { id: 'f3' })];
  const t = cohortTraining(rows, 10);

  assert.equal(t.total, 3);
  assert.equal(t.reporting, 1, 'only one training record is readable');
  assert.equal(t.bands[0].farmers, 0, 'the two withheld farmers must NOT appear as "0 modules"');
  assert.equal(t.bands[4].farmers, 1);
  assert.equal(t.modulesCompleted, 4);
  assert.equal(t.averagePct, 40, 'the average is over reporting farmers, not over everyone');
});

test('training: bands span 0…modulesTotal so the axis is stable whatever the data', () => {
  const t = cohortTraining([summaryWith(2)], 10);
  assert.equal(t.bands.length, 11);
  t.bands.forEach((b, i) => assert.equal(b.done, i));
});

test('training: nobody reporting gives a null average, not 0%', () => {
  const t = cohortTraining([summaryWith(null), summaryWith(null, { id: 'f2' })], 10);
  assert.equal(t.reporting, 0);
  assert.equal(t.averagePct, null);
  assert.equal(t.started, 0);
  assert.equal(t.finishedCourse, 0);
});

test('training: an out-of-range module count is clamped into the top band, not a new column', () => {
  const t = cohortTraining([summaryWith(99)], 10);
  assert.equal(t.bands.length, 11);
  assert.equal(t.bands[10].farmers, 1);
  assert.equal(t.finishedCourse, 1);
  assert.equal(t.averagePct, 100);
});

test('training: the course length falls back to the shared constant, never to a guess', () => {
  const t = cohortTraining([summaryWith(3)]);
  assert.equal(t.modulesTotal, DEFAULT_COURSE_MODULE_COUNT);
  const zero = cohortTraining([], 0);
  assert.ok(zero.modulesTotal >= 1, 'a zero-module course would divide by zero');
});

test('training: an empty cohort is all zeros and a null average', () => {
  const t = cohortTraining([], 10);
  assert.equal(t.total, 0);
  assert.equal(t.reporting, 0);
  assert.equal(t.averagePct, null);
  assert.equal(t.modulesCompleted, 0);
});

/* ════════════════════════════════════════════════════════════════════════════
 * cohortCsv
 * ══════════════════════════════════════════════════════════════════════════*/

function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

test('csv: the header names every column and each row has exactly that many cells', () => {
  const csv = cohortCsv([summaryWith(4), summaryWith(null, { id: 'f2', name: 'Sipho Ncube' })]);
  const lines = csv.trimEnd().split('\n');
  assert.equal(lines[0], COHORT_CSV_COLUMNS.join(','));
  assert.equal(lines.length, 3);
  for (const line of lines.slice(1)) {
    assert.equal(parseRow(line).length, COHORT_CSV_COLUMNS.length);
  }
});

test('csv: a figure this account may not read is an EMPTY cell, never a 0', () => {
  const csv = cohortCsv([summaryWith(null)]);
  const header = parseRow(csv.split('\n')[0]);
  const row = parseRow(csv.split('\n')[1]);
  const cell = (name: string) => row[header.indexOf(name)];

  assert.equal(cell('Modules done'), '', 'a withheld training record must not export as 0');
  assert.equal(cell('Training %'), '');
  // …while a readable figure still exports as a figure, so the empty cell means something.
  assert.notEqual(cell('Harvested kg'), '');
});

test('csv: a name that would run as a spreadsheet formula is defused', () => {
  const csv = cohortCsv([
    summaryWith(2, { name: '=1+1', siteName: '+cmd', district: '-2', municipality: '@sum' }),
  ]);
  const row = parseRow(csv.split('\n')[1]);
  assert.equal(row[0], "'=1+1");
  assert.equal(row[1], "'+cmd");
  assert.equal(row[2], "'-2");
  assert.equal(row[3], "'@sum");
});

test('csv: a comma, a quote and a newline in a name survive a round trip', () => {
  const csv = cohortCsv([summaryWith(2, { name: 'Dlamini, N. "Gogo"\nEmoyeni' })]);
  const row = parseRow(csv.split('\n').slice(1).join('\n').trimEnd());
  assert.equal(row[0], 'Dlamini, N. "Gogo"\nEmoyeni');
});

test('csv: exports exactly the rows it is given, in the order it is given them', () => {
  const rows = [
    summaryWith(1, { id: 'a', name: 'Zanele' }),
    summaryWith(2, { id: 'b', name: 'Andile' }),
  ];
  const lines = cohortCsv(rows).trimEnd().split('\n');
  assert.equal(parseRow(lines[1])[0], 'Zanele');
  assert.equal(parseRow(lines[2])[0], 'Andile');
  assert.equal(cohortCsv([]).trimEnd(), COHORT_CSV_COLUMNS.join(','), 'header only, never a fake row');
});

test('csv: no ID number and no coordinate ever reaches the file', () => {
  const csv = cohortCsv([summaryWith(3)]);
  assert.equal(/id[ _]?number/i.test(csv), false);
  assert.equal(csv.includes('-28.02'), false);
  assert.equal(csv.includes('32.27'), false);
  for (const banned of ['Latitude', 'Longitude', 'Lat', 'Lon', 'ID number']) {
    assert.equal((COHORT_CSV_COLUMNS as readonly string[]).includes(banned), false, `${banned} must not be a column`);
  }
});

test('csv filename is dated so two exports never overwrite each other', () => {
  const a = cohortCsvFilename(new Date('2026-08-29T10:00:00.000Z'));
  assert.equal(a, 'imbewufield-cohort-2026-08-29.csv');
  assert.equal(
    cohortCsvFilename(new Date('2026-08-29T10:00:00.000Z'), 'Sample Cohort'),
    'imbewufield-sample-cohort-2026-08-29.csv',
  );
  assert.match(cohortCsvFilename(new Date('nonsense')), /^imbewufield-cohort-undated\.csv$/);
});
