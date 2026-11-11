// Communication corrections of 11 November 2026, after Codex's completion review:
//   CP-108  frost the plan cannot see is said on the plan page and on paper
//   CP-112  the reference cover's benchmark total states its time basis
//   CP-107  the sample farm's printed location makes no satellite claim beside its calendar
//   CP-109  temperatures print the decimal the calendar rule decides on
// None of them moves a threshold, a sowing month, a duration or a kilogram figure, and the
// tests below check that as well as the wording.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { observedFrostConflicts, observedFrostConflictsForPlanting } from '@/lib/crop-autosuggest';
import { cropByKey, CROPS } from '@/lib/crop-catalog';
import { buildProductionGuide } from '@/lib/crop-export-schedule';
import { BENCHMARK_TIME_BASIS_LINE, BENCHMARK_TIME_BASIS_SHORT, buildPlanDashboard, buildPlanTableRows } from '@/lib/crop-export-benchmark';
import { planTableFrost } from '@/lib/crop-export-pdf';
import { occupiedMonthsForPlanting, type PlanBed, type Planting } from '@/lib/crop-plan';
import { FROST_UNCONFIRMED_ACTION_TEXT, FROST_UNCONFIRMED_ROW_TEXT, FROST_UNCONFIRMED_TEXT } from '@/lib/frost-uncertainty';
import type { SiteSurvey } from '@/lib/site-survey';
import { printedLocationLine, printedSowingCalendarLine, sowingCalendarReasons } from '@/lib/sowing-calendar-label';
import type { SiteClimate } from '@/lib/site-climate';

const BEDS: PlanBed[] = [
  { id: 'bed-1', label: 'Bed 1', areaM2: 6, minDimM: 1.2 },
  { id: 'bed-2', label: 'Bed 2', areaM2: 6, minDimM: 1.2 },
];
const TENDER: Planting = { id: 'tom', bedId: 'bed-1', cropKey: 'tomatoes', sowMonth: 9 };
const HARDY: Planting = { id: 'car', bedId: 'bed-2', cropKey: 'carrots', sowMonth: 3 };

function survey(conditions: SiteSurvey['productionConditions'] | undefined): SiteSurvey {
  return {
    siteId: 'site:-26.20000,28.05000', placeId: 'farm-a', savedAt: '2026-11-11T08:00:00Z',
    siteType: 'community', adults: '2-5', goals: ['food'],
    waterSource: ['municipal'], waterDelivery: ['drip'], waterStorage: ['jojo'],
    roofMainM2: null, roofSecondaryM2: null, hasGutters: false,
    landPrepMethod: 'hand', soilCondition: 'unknown', soilAmendments: [], hasFencing: 'partial',
    existingCrops: ['vegetables'], existingGrowingAreaM2: null,
    livestock: [], otherInfra: [], farmingPractice: 'mostly-organic',
    challenges: [], isCommercial: false, notes: '',
    ...(conditions ? { productionConditions: conditions } : {}),
  } as SiteSurvey;
}
const TITLE = 'Frost-tender crops: frost months not confirmed';
const item = (guide: ReturnType<typeof buildProductionGuide>, title: string) => guide.siteObservations.find((entry) => entry.title === title);
const MONTH_WORD = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/;

/* ── CP-108 ────────────────────────────────────────────────────────────── */

test('the catalogue fixtures are what these tests assume', () => {
  assert.equal(cropByKey('tomatoes')?.frostTender, true);
  assert.notEqual(cropByKey('carrots')?.frostTender, true);
});

test('with no frost months from the grower, a plan holding a frost-tender crop says so, names the crop and names no month (CP-108)', () => {
  for (const [label, guide] of [
    ['no survey at all', buildProductionGuide(null, [TENDER, HARDY], [], 11)],
    ['survey without a frost answer', buildProductionGuide(survey(undefined), [TENDER, HARDY], [], 11)],
    ['"yes" with no month ticked', buildProductionGuide(survey({ frost: 'yes', frostMonths: [] } as SiteSurvey['productionConditions']), [TENDER, HARDY], [], 11)],
  ] as const) {
    const entry = item(guide, TITLE);
    assert.ok(entry, `${label}: the notice is shown`);
    assert.deepEqual(entry.lines, ['Tomatoes.', FROST_UNCONFIRMED_TEXT, FROST_UNCONFIRMED_ACTION_TEXT], label);
    assert.deepEqual(guide.frostTenderUnconfirmed, ['Tomatoes'], label);
  }
  // The wording states an uncertainty. It gives no frost date, day count or kilogram.
  for (const text of [FROST_UNCONFIRMED_TEXT, FROST_UNCONFIRMED_ACTION_TEXT, FROST_UNCONFIRMED_ROW_TEXT]) {
    assert.doesNotMatch(text, MONTH_WORD, text);
    assert.doesNotMatch(text, /\d/, text);
    // No assurance in either direction. ("no frost dates" says the plan lacks dates; it is not "no frost".)
    assert.doesNotMatch(text, /frost-free|is no frost|no frost here|will not|\bsafe\b/i, text);
  }
  assert.match(FROST_UNCONFIRMED_ACTION_TEXT, /site survey/);
});

test('unknown frost is not read as no frost, and a grower\'s answer is not overridden (CP-108)', () => {
  // The existing line for an unanswered survey stays, and it does not say there is no frost.
  const unanswered = buildProductionGuide(null, [TENDER], [], 11);
  assert.match(item(unanswered, 'Frost on this farm')!.lines[0], /Local frost observations are not recorded/);
  // "We have not seen frost here" is the grower's observation: no generic notice on top of it.
  const none = buildProductionGuide(survey({ frost: 'no' } as SiteSurvey['productionConditions']), [TENDER], [], 11);
  assert.equal(item(none, TITLE), undefined);
  assert.equal(none.frostTenderUnconfirmed, undefined);
  assert.match(item(none, 'Frost on this farm')!.lines[0], /does not establish that future winters will be frost-free/);
  // A plan with no frost-tender crop gets no notice either.
  const hardyOnly = buildProductionGuide(null, [HARDY], [], 11);
  assert.equal(item(hardyOnly, TITLE), undefined);
  assert.equal(hardyOnly.frostTenderUnconfirmed, undefined);
});

test('recorded frost months still check every month the crop holds ground, the picking tail included (CP-108)', () => {
  const tomato = cropByKey('tomatoes')!;
  const held = occupiedMonthsForPlanting(TENDER);
  assert.ok(held.length >= 4, 'the tomato holds its bed for several months');
  const last = held[held.length - 1];
  assert.notEqual(last, TENDER.sowMonth, 'the last held month is a picking month, not the sowing month');
  // A frost month that falls only in the last held month is a conflict.
  assert.deepEqual(observedFrostConflicts(tomato, TENDER.sowMonth, [last]), [last]);
  assert.deepEqual(observedFrostConflictsForPlanting(TENDER, TENDER.sowMonth, [last]), [last]);
  // And the guide then lists the crop against that month instead of the generic notice.
  const guide = buildProductionGuide(survey({ frost: 'yes', frostMonths: [last] } as SiteSurvey['productionConditions']), [TENDER, HARDY], [], TENDER.sowMonth);
  assert.equal(item(guide, TITLE), undefined, 'months given: the specific check replaces the generic notice');
  const check = item(guide, 'Planned crops to check for frost');
  assert.ok(check, 'the recorded month is checked against the plan');
  assert.match(check.lines[0], /^Tomatoes: /);
  // A frost-hardy crop is never listed.
  assert.deepEqual(observedFrostConflicts(cropByKey('carrots')!, 3, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), []);
});

test('the printed bed-by-bed table carries the caveat on frost-tender rows only, and changes nothing else (CP-108)', () => {
  const plain = buildPlanTableRows([TENDER, HARDY], BEDS);
  const flagged = buildPlanTableRows([TENDER, HARDY], BEDS, { kind: 'not-recorded' });
  const tomato = flagged.find((row) => row.crop === 'Tomatoes')!;
  const carrots = flagged.find((row) => row.crop === 'Carrots')!;
  assert.equal(tomato.frostCaveat, FROST_UNCONFIRMED_ROW_TEXT);
  assert.equal(carrots.frostCaveat, null);
  assert.ok(plain.every((row) => row.frostCaveat === null), 'off when the caller knows nothing about the survey');
  // Same months, same kilograms, same everything else.
  assert.deepEqual(strip(flagged), strip(plain));
});

/* ── The caveat follows the grower's frost record and nothing else ─────── */

const strip = (rows: ReturnType<typeof buildPlanTableRows>) => rows.map(({ frostCaveat: _caveat, ...rest }) => rest);
const flaggedCrops = (rows: ReturnType<typeof buildPlanTableRows>) => rows.filter((row) => row.frostCaveat).map((row) => row.crop).sort();
const conditions = (value: Record<string, unknown>) => value as SiteSurvey['productionConditions'];
const ALL_FROST_STATES: Array<[string, SiteSurvey | null]> = [
  ['no survey', null],
  ['"no"', survey(conditions({ frost: 'no' }))],
  ['"yes", no month', survey(conditions({ frost: 'yes', frostMonths: [] }))],
  ['"yes", April', survey(conditions({ frost: 'yes', frostMonths: [4] }))],
  ['"yes", July', survey(conditions({ frost: 'yes', frostMonths: [7] }))],
  ['"yes", December', survey(conditions({ frost: 'yes', frostMonths: [12] }))],
  ['"yes", April, July and December', survey(conditions({ frost: 'yes', frostMonths: [4, 7, 12] }))],
];
// Tender crops in different seasons, a hardy crop, a finished one-time sowing and one awaiting confirmation.
const MIXED: Planting[] = [
  { id: 'tom-sep', bedId: 'bed-1', cropKey: 'tomatoes', sowMonth: 9 },
  { id: 'pep-nov', bedId: 'bed-2', cropKey: 'peppers', sowMonth: 11 },
  { id: 'car', bedId: 'bed-2', cropKey: 'carrots', sowMonth: 3 },
  { id: 'bean-done', bedId: 'bed-1', cropKey: 'green-beans', sowMonth: 2, once: '2026-02', finishedOnceSowing: true } as Planting,
  { id: 'corn-wait', bedId: 'bed-1', cropKey: 'sweetcorn', sowMonth: 1, once: '2027-01', awaitingSowingConfirmation: true } as Planting,
];

test('unknown frost marks every active frost-tender row and names no month; "no" marks none; a calendar name is not asked', () => {
  const guide = buildProductionGuide(null, MIXED, [], 11);
  const rows = buildPlanTableRows(MIXED, BEDS, planTableFrost({ productionGuide: guide, now: new Date(2026, 10, 11) }));
  assert.deepEqual(flaggedCrops(rows), ['Peppers', 'Tomatoes']);
  for (const row of rows.filter((r) => r.frostCaveat)) assert.equal(row.frostCaveat, FROST_UNCONFIRMED_ROW_TEXT);
  assert.deepEqual(guide.frostTenderUnconfirmed, ['Peppers', 'Tomatoes'], 'the guide names the same crops as the table marks');
  // The finished sowing and the one awaiting confirmation are in neither.
  assert.ok(rows.every((r) => !/Sweetcorn|Green beans/.test(r.crop) || r.frostCaveat === null));
  // "We have not seen frost here".
  const none = buildProductionGuide(survey(conditions({ frost: 'no' })), MIXED, [], 11);
  assert.deepEqual(planTableFrost({ productionGuide: none }), { kind: 'no-frost-observed' });
  assert.deepEqual(flaggedCrops(buildPlanTableRows(MIXED, BEDS, planTableFrost({ productionGuide: none }))), []);
  // No survey reader at all (a caller without a guide): nothing is marked.
  assert.equal(planTableFrost({}), undefined);
  // Neither function can see the sowing calendar, so "Hot area, no frost" cannot hide the warning.
  const pdf = readFileSync(new URL('../lib/crop-export-pdf.ts', import.meta.url), 'utf8');
  const fn = pdf.slice(pdf.indexOf('export function planTableFrost('), pdf.indexOf('function drawFullPlan('));
  assert.doesNotMatch(fn, /rainPattern|all-year|mild-frost|meta\./);
  const benchmark = readFileSync(new URL('../lib/crop-export-benchmark.ts', import.meta.url), 'utf8');
  const start = benchmark.indexOf('function frostCaveatFor(');
  const table = benchmark.slice(start, benchmark.indexOf('\n}\n', start)); // the function body only, not the history note under it
  assert.doesNotMatch(table, /rainPattern|all-year|mild-frost|lat\b|hemisphere/);
  assert.match(benchmark, /export function buildPlanTableRows\(plantings: Planting\[\], beds: PlanBed\[\], frost\?: PlanTableFrost\): PlanTableRow\[\]/);
});

test('recorded frost in April, July or December marks exactly the crops still in the ground then, tail included, and the guide agrees', () => {
  const now = new Date(2026, 10, 11); // November
  for (const [label, s] of ALL_FROST_STATES) {
    const guide = buildProductionGuide(s, MIXED, [], 11);
    const rows = buildPlanTableRows(MIXED, BEDS, planTableFrost({ productionGuide: guide, now }));
    const months = s?.productionConditions?.frost === 'yes' ? (s.productionConditions.frostMonths ?? []) : [];
    if (months.length) {
      // Expected from the planner's own whole-occupancy check, one planting at a time.
      const expected = MIXED.filter((p) => !p.finishedOnceSowing && !p.awaitingSowingConfirmation)
        .filter((p) => observedFrostConflictsForPlanting(p, 11, months).length)
        .map((p) => cropByKey(p.cropKey)!.name).sort();
      assert.deepEqual(flaggedCrops(rows), expected, label);
      // The guide's own list names the same crops.
      const check = item(guide, 'Planned crops to check for frost');
      const guideCrops = (check?.lines ?? []).filter((line) => /^[^:]+: /.test(line) && !/^These planned/.test(line)).map((line) => line.split(':')[0]).sort();
      assert.deepEqual(guideCrops, expected, `${label}: guide and table agree`);
      // Each caveat names only months the grower recorded.
      for (const row of rows.filter((r) => r.frostCaveat)) {
        const named = (row.frostCaveat!.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g) ?? []);
        assert.ok(named.length >= 1, row.frostCaveat!);
        for (const name of named) assert.ok(months.includes(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(name) + 1), `${label}: ${name} was not recorded`);
      }
      assert.equal(item(guide, TITLE), undefined, `${label}: no generic notice once months are given`);
    }
    // Whatever was said about frost, no date, share or kilogram on any row moves.
    assert.deepEqual(strip(rows), strip(buildPlanTableRows(MIXED, BEDS)), `${label}: rows unchanged apart from the caveat`);
  }
  // The cases really differ: December frost reaches the summer crops, April reaches the late pickers.
  const of = (months: number[]) => flaggedCrops(buildPlanTableRows(MIXED, BEDS, { kind: 'months', months, nowMonth: 11 }));
  assert.ok(of([12]).length >= 1, 'a December frost is honoured: nothing assumes frost is a mid-year event');
  assert.notDeepEqual(of([12]), of([7]));
  assert.deepEqual(of([]), [], 'an empty month list marks nothing by itself (the caller sends "not-recorded" for that)');
});

test('a picking tail that runs into a recorded frost month is marked even though sowing and first picking are clear of it', () => {
  const tomato: Planting = { id: 'tom', bedId: 'bed-1', cropKey: 'tomatoes', sowMonth: 9 };
  const held = occupiedMonthsForPlanting(tomato);
  const last = held[held.length - 1];
  const [row] = buildPlanTableRows([tomato], BEDS, { kind: 'months', months: [last], nowMonth: 9 });
  assert.match(row.frostCaveat ?? '', /^Frost-tender: still in the ground in [A-Z][a-z]{2}, when you recorded frost\.$/);
  // A month the crop does not hold at all marks nothing.
  const free = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !held.includes(m));
  if (free !== undefined) assert.equal(buildPlanTableRows([tomato], BEDS, { kind: 'months', months: [free], nowMonth: 9 })[0].frostCaveat, null);
});

test('the PDF takes the caveat from the guide, so the page and the paper cannot disagree (CP-108)', () => {
  const pdf = readFileSync(new URL('../lib/crop-export-pdf.ts', import.meta.url), 'utf8');
  assert.match(pdf, /buildPlanTableRows\(input\.plantings, input\.beds, planTableFrost\(input\)\)/);
  // The page shows the guide's observations in the open, beside the button that opens the survey.
  const card = readFileSync(new URL('../components/crops/ProductionGuideCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /guide\.siteObservations\.map\(/);
  assert.match(card, /onClick=\{onSurvey\}/);
  const page = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<ProductionGuideCard guide=\{productionGuide\} canSurvey=\{!!surveySiteId\} onSurvey=\{\(\) => setSiteSurveyOpen\(true\)\} \/>/);
});

test('no catalogue value was touched to make the notice (CP-108)', () => {
  // The notice reads the existing frostTender flag; it must not have grown or shrunk the set.
  assert.equal(CROPS.filter((crop) => crop.frostTender === true).length, 27);
});

/* ── CP-112 ────────────────────────────────────────────────────────────── */

test('the benchmark total states its time basis beside the figure and in the explanation (CP-112)', () => {
  const dashboard = buildPlanDashboard([TENDER, HARDY], BEDS, [], { nowMonth: 11, lossPercent: 0 });
  const total = dashboard.stats[1];
  assert.equal(total.label, 'known benchmark total');
  assert.match(total.value, /^\d+\.\d kg$/);
  assert.equal(total.detail, BENCHMARK_TIME_BASIS_SHORT);
  assert.match(BENCHMARK_TIME_BASIS_SHORT, /every planned crop cycle counted once/);
  assert.match(BENCHMARK_TIME_BASIS_SHORT, /not the harvest of the plan year/);
  assert.match(BENCHMARK_TIME_BASIS_LINE, /including cycles first picked after the plan year shown on the cover/);
  assert.match(BENCHMARK_TIME_BASIS_LINE, /year-by-year table groups the same crop cycles by the year of first picking/);
  // A label, not a recalculation: no number in either line.
  assert.doesNotMatch(BENCHMARK_TIME_BASIS_SHORT + BENCHMARK_TIME_BASIS_LINE, /\d/);
  const pdf = readFileSync(new URL('../lib/crop-export-pdf.ts', import.meta.url), 'utf8');
  assert.match(pdf, /\n      BENCHMARK_TIME_BASIS_LINE,\n/, 'printed in "How the totals are calculated"');
});

/* ── CP-107 ────────────────────────────────────────────────────────────── */

test('the sample farm\'s printed location makes no satellite claim beside its fixed calendar (CP-107)', () => {
  const label = 'Hot area, no frost - summer rain';
  for (const source of ['site', 'reference', 'none'] as const) {
    const location = printedLocationLine('sample-farm', source, 'Durban');
    assert.equal(location, 'Sample farm');
    const line = `${location} · ${printedSowingCalendarLine(label, 'sample-farm', source)}`;
    assert.equal(line, 'Sample farm · Hot area, no frost - summer rain (sowing calendar set for the sample farm)');
    assert.doesNotMatch(line, /satellite/i);
  }
  // Every other case is worded as before.
  assert.equal(printedLocationLine('site-climate', 'site', null), 'This site (satellite climate records)');
  assert.equal(printedLocationLine('grower-choice', 'site', null), 'This site (satellite climate records)');
  assert.equal(printedLocationLine('reference', 'reference', 'Durban'), 'Nearest reference: Durban (fallback)');
  assert.equal(printedLocationLine('reference', 'none', null), 'No site set');
  const page = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /const locationLine = printedLocationLine\(calendarBasis, climateSource, region\?\.name\);/);
});

/* ── CP-109 ────────────────────────────────────────────────────────────── */

test('a record minimum just under the frost-free line is not printed as the line itself (CP-109)', () => {
  const site = { pattern: 'mild-frost', rainSeason: 'summer', coldestMonthC: 15.9, hottestMonthC: 23.96, recordMinC: 1.7, closeCall: null, warmerNeighbour: null } as unknown as SiteClimate;
  const text = sowingCalendarReasons(site, { pattern: 'mild-frost', basis: 'site-climate' }).join(' ');
  assert.match(text, /The lowest temperature on record for this area is 1\.7 °C\./);
  assert.doesNotMatch(text, /is 2 °C\./, '1.7 is not shown as the 2 °C frost-free line');
  assert.match(text, /Coldest month averages 15\.9 °C and hottest 24 °C here\./, '15.9 is not shown as the 16 °C hot-area line; 23.96 rounds to one decimal');
  // Whole readings and negatives print cleanly, and nothing is invented past one decimal.
  const whole = sowingCalendarReasons({ ...site, coldestMonthC: 10, hottestMonthC: 22.04, recordMinC: -4.8 } as SiteClimate, { pattern: 'summer', basis: 'site-climate' }).join(' ');
  assert.match(whole, /Coldest month averages 10 °C and hottest 22 °C here\. The lowest temperature on record for this area is -4\.8 °C\./);
  assert.doesNotMatch(whole, /\d\.\d\d/);
});
