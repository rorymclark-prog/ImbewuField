import assert from 'node:assert/strict';
import test from 'node:test';

// Phase 4 of the NGO/funder dashboard build (see PROGRESS.md, plan doc). Pure aggregation
// logic — no Firestore, no DOM — so these are genuine unit tests, same style as
// tests/data-consent.test.ts's `nextDataConsent()` coverage.

import {
  summarizeOrgReport, orgReportToCsv, orgReportCsvFilename,
  type OrgReportFarmerRow, type OrgReportGardenInput,
} from '../lib/report-org-summary.ts';

function row(overrides: Partial<OrgReportFarmerRow> = {}): OrgReportFarmerRow {
  return {
    profileId: 'p1', name: 'Farmer One', gardenId: 'g1', gardenName: 'Garden One',
    consented: true, productionKg: 10, salesKg: 4, salesAmount: 100,
    coursesDone: 3, coursesTotal: 6,
    ...overrides,
  };
}

const gardens: OrgReportGardenInput[] = [
  { id: 'g1', name: 'Garden One', status: 'thriving' },
  { id: 'g2', name: 'Garden Two', status: 'establishing' },
];

/* ── summarizeOrgReport ──────────────────────────────────────────────────── */

test('a non-consenting farmer is counted but excluded from every total', () => {
  const rows = [
    row({ profileId: 'p1', consented: true, productionKg: 10, salesKg: 4, salesAmount: 100, coursesDone: 3, coursesTotal: 6 }),
    row({ profileId: 'p2', consented: false, productionKg: 999, salesKg: 999, salesAmount: 999999, coursesDone: 999, coursesTotal: 999 }),
  ];
  const summary = summarizeOrgReport(gardens, rows);

  assert.equal(summary.totalFarmers, 2);
  assert.equal(summary.consentedFarmers, 1);
  // Only p1's figures reach the totals — p2's huge decoy numbers must not leak in.
  assert.equal(summary.productionKg, 10);
  assert.equal(summary.salesKg, 4);
  assert.equal(summary.salesAmount, 100);
  assert.equal(summary.avgCoursesPct, 50); // 3 of 6, p2 excluded entirely
  // Every row is still returned so a reader can see who is and isn't represented.
  assert.equal(summary.farmers.length, 2);
});

test('gardens count and status breakdown reflect every garden regardless of consent', () => {
  const summary = summarizeOrgReport(gardens, []);
  assert.equal(summary.gardens, 2);
  assert.deepEqual(summary.gardenStatusCounts, { thriving: 1, establishing: 1 });
  assert.equal(summary.totalFarmers, 0);
  assert.equal(summary.consentedFarmers, 0);
});

test('avgCoursesPct is 0, not NaN, when there are no consented farmers', () => {
  const summary = summarizeOrgReport(gardens, [row({ consented: false })]);
  assert.equal(summary.avgCoursesPct, 0);
  assert.equal(summary.productionKg, 0);
});

test('multiple consented farmers sum correctly', () => {
  const rows = [
    row({ profileId: 'p1', productionKg: 10, salesKg: 4, salesAmount: 100, coursesDone: 3, coursesTotal: 6 }),
    row({ profileId: 'p2', productionKg: 5, salesKg: 1, salesAmount: 50, coursesDone: 6, coursesTotal: 6 }),
  ];
  const summary = summarizeOrgReport(gardens, rows);
  assert.equal(summary.productionKg, 15);
  assert.equal(summary.salesKg, 5);
  assert.equal(summary.salesAmount, 150);
  // (3+6) of (6+6) = 75%
  assert.equal(summary.avgCoursesPct, 75);
});

/* ── orgReportToCsv ──────────────────────────────────────────────────────── */

test('CSV marks a non-consenting farmer "Not yet" with blank figures, not an omitted row', () => {
  const summary = summarizeOrgReport(gardens, [
    row({ name: 'Consented Farmer', consented: true, productionKg: 10.5, salesKg: 4.25, salesAmount: 100, coursesDone: 3, coursesTotal: 6 }),
    row({ name: 'Not Yet Farmer', consented: false }),
  ]);
  const csv = orgReportToCsv(summary);
  const lines = csv.split('\n');
  assert.equal(lines.length, 3); // header + 2 rows
  assert.equal(lines[0], 'Farmer,Garden,Data shared,Production (kg),Sales (kg),Sales (R),Training complete (%)');
  // productionKg/salesKg round to 1 decimal in the CSV (salesAmount keeps cents) — 4.25 -> 4.3.
  assert.equal(lines[1], 'Consented Farmer,Garden One,Yes,10.5,4.3,100.00,50');
  assert.equal(lines[2], 'Not Yet Farmer,Garden One,Not yet,,,,');
});

test('CSV escapes a field containing a comma, quote, or newline', () => {
  const summary = summarizeOrgReport(gardens, [
    row({ name: 'Comma, Farmer', gardenName: 'He said "hi"' }),
  ]);
  const csv = orgReportToCsv(summary);
  const dataLine = csv.split('\n')[1];
  assert.ok(dataLine.startsWith('"Comma, Farmer","He said ""hi"""'));
});

test('CSV has just the header when there are no farmers', () => {
  const summary = summarizeOrgReport(gardens, []);
  assert.equal(orgReportToCsv(summary), 'Farmer,Garden,Data shared,Production (kg),Sales (kg),Sales (R),Training complete (%)');
});

/* ── orgReportCsvFilename ────────────────────────────────────────────────── */

test('filename is a safe, dated slug of the org name', () => {
  assert.equal(orgReportCsvFilename('Tugela Valley NGO', '2026-08-24'), 'imbewufield-tugela-valley-ngo-report-2026-08-24.csv');
});

test('filename falls back to "organisation" for a name with no alphanumerics', () => {
  assert.equal(orgReportCsvFilename('***', '2026-08-24'), 'imbewufield-organisation-report-2026-08-24.csv');
});
