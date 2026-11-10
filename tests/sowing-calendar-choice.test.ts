import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixture } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cropPlanWriteCandidateIsLossless, loadCropPlan, sanitiseSowingCalendarChoices, saveCropPlan,
  sowingCalendarChoiceFor, withSowingCalendarChoice, type CropPlanState, type Planting,
} from '@/lib/crop-plan';
import { sowingCalendarInUse, type SiteClimate } from '@/lib/site-climate';
import { SOWING_CALENDAR_OPTIONS, printedSowingCalendarLine, sowingCalendarOptionText, sowingCalendarReasons } from '@/lib/sowing-calendar-label';
import {
  SOWING_CALENDAR_CORRECTED_AT, calendarCanJudgeSavedSowings, outOfCalendarLine, outOfCalendarSignature, planMayPredateCorrection,
  sowingsOutsideCalendar,
} from '@/lib/sowing-calendar-review';
import { nearestRainfall, referenceSowingCalendar } from '@/lib/water-calc';
import { bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';

// A GROWER CAN CHOOSE THEIR OWN SOWING CALENDAR, AND IS TOLD WHICH SAVED SOWINGS NO
// LONGER FIT THE CALENDAR IN USE (10 November 2026, Rory: "go ahead with decisions 2 and 3").
//
// The calendar is read from climate records for a grid cell tens of kilometres wide.
// The accuracy audit showed where that fails a real farm: Mbombela 0.1 °C short of the
// hot-area line, Tzaneen under an escarpment, Worcester averaged with the Ceres
// mountains. The grower knows their own frost. And a plan saved before the calendars
// were corrected kept its old months with no word that they were now out of season.

const KOMATIPOORT = 'site:-25.43000,31.95000';
const WORCESTER = 'site:-33.65000,19.45000';
const empty = (): CropPlanState => ({ version: 1, plantings: [], updatedAt: 1 });

function site(over: Partial<SiteClimate> = {}): SiteClimate {
  return {
    pattern: 'mild-frost', rainSeason: 'summer', closeCall: 'all-year', warmerNeighbour: 'all-year',
    coldestMonthC: 15.9, hottestMonthC: 24.5, recordMinC: 3.2, annualMm: 684,
    monthlyRainMm: Array(12).fill(57), monthlyTempC: Array(12).fill(20), koppen: 'BSh', rainfallSource: 'nasa-power',
    ...over,
  };
}

test('a calendar choice is kept per site and never spills onto another farm', () => {
  let book = withSowingCalendarChoice(empty(), KOMATIPOORT, 'all-year', 100);
  book = withSowingCalendarChoice(book, WORCESTER, 'winter', 200);
  assert.equal(sowingCalendarChoiceFor(book, KOMATIPOORT), 'all-year');
  assert.equal(sowingCalendarChoiceFor(book, WORCESTER), 'winter');
  assert.equal(sowingCalendarChoiceFor(book, 'site:-26.20000,28.05000'), null, 'a farm with no choice is on automatic');
  assert.equal(sowingCalendarChoiceFor(book, null), null);
  assert.equal(sowingCalendarChoiceFor(null, KOMATIPOORT), null);

  // Changing one farm's choice replaces only that farm's row.
  book = withSowingCalendarChoice(book, KOMATIPOORT, 'mild-frost', 300);
  assert.deepEqual(book.sowingCalendarChoices, [
    { scopeId: WORCESTER, calendar: 'winter', chosenAt: 200 },
    { scopeId: KOMATIPOORT, calendar: 'mild-frost', chosenAt: 300 },
  ]);
});

test('"let the app decide" removes the choice, and a book with none left reads as it did before', () => {
  const chosen = withSowingCalendarChoice(empty(), KOMATIPOORT, 'all-year', 100);
  const cleared = withSowingCalendarChoice(chosen, KOMATIPOORT, null);
  assert.equal(sowingCalendarChoiceFor(cleared, KOMATIPOORT), null);
  assert.ok(!('sowingCalendarChoices' in cleared), 'an empty list must not be stored as a field');
  assert.deepEqual(cleared, empty());
});

test('damaged or foreign choice rows are dropped, never guessed at', () => {
  assert.deepEqual(sanitiseSowingCalendarChoices(undefined), []);
  assert.deepEqual(sanitiseSowingCalendarChoices('all-year'), []);
  assert.deepEqual(sanitiseSowingCalendarChoices([
    null, 'x', [],
    { scopeId: '', calendar: 'summer', chosenAt: 1 },
    { scopeId: 'a', calendar: 'tropical', chosenAt: 1 },
    { scopeId: 'a', calendar: 'summer' },
    { scopeId: 'a', calendar: 'summer', chosenAt: Number.NaN },
    { scopeId: 'a', calendar: 'summer', chosenAt: -5 },
    { scopeId: 'x'.repeat(201), calendar: 'summer', chosenAt: 1 },
    { scopeId: 'kept', calendar: 'winter', chosenAt: 5, extra: 'ignored' },
  ]), [{ scopeId: 'kept', calendar: 'winter', chosenAt: 5 }]);
  // Two rows for one farm: the newer one is the grower's current answer.
  assert.deepEqual(sanitiseSowingCalendarChoices([
    { scopeId: 'a', calendar: 'summer', chosenAt: 9 }, { scopeId: 'a', calendar: 'all-year', chosenAt: 4 },
  ]), [{ scopeId: 'a', calendar: 'summer', chosenAt: 9 }]);
});

test('the choice survives a save and reload, and a plan saved before it existed still loads', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const storage = new Map<string, string>();
  const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage: { getItem: () => null }, dispatchEvent: () => true } });
  bindMountedAccountLocalStorageUid('calendar-owner');
  try {
    await initialiseCropPlanFixture();
    const planting: Planting = { id: 'p1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 2 };
    const saved: CropPlanState = { version: 1, plantings: [planting], updatedAt: 1 };
    const chosen = withSowingCalendarChoice(saved, KOMATIPOORT, 'all-year', 1_700_000_000_000);
    assert.ok(cropPlanWriteCandidateIsLossless(chosen), 'the page refuses to save a book the store would change');
    assert.equal(saveCropPlan(chosen), true);
    assert.deepEqual(loadCropPlan().sowingCalendarChoices, [{ scopeId: KOMATIPOORT, calendar: 'all-year', chosenAt: 1_700_000_000_000 }]);
    assert.deepEqual(readCanonicalCropPlanFixture<CropPlanState>().sowingCalendarChoices, chosen.sowingCalendarChoices);
    assert.equal(loadCropPlan().plantings.length, 1, 'the plan itself is untouched by a calendar choice');

    // A book from before the field existed: no field, no invented default.
    assert.equal(saveCropPlan({ version: 1, plantings: [planting], updatedAt: 2 }), true);
    assert.equal(loadCropPlan().sowingCalendarChoices, undefined);
    assert.equal(sowingCalendarChoiceFor(loadCropPlan(), KOMATIPOORT), null);
  } finally {
    releaseCropPlanFixture();
    bindMountedAccountLocalStorageUid(null);
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the grower\'s own choice wins; without one the climate reading and frost answer decide; without a reading, the fallback', () => {
  const mbombela = site();
  // Their choice outranks the grid and their frost answer alike.
  assert.deepEqual(sowingCalendarInUse({ chosen: 'all-year', site: mbombela, observedFrost: 'unknown', reference: 'summer' }),
    { pattern: 'all-year', basis: 'grower-choice', automatic: 'mild-frost' });
  assert.deepEqual(sowingCalendarInUse({ chosen: 'summer', site: mbombela, observedFrost: 'no', reference: 'summer' }),
    { pattern: 'summer', basis: 'grower-choice', automatic: 'all-year' }, 'automatic still reports what the app would use');
  // Choosing what the app would have picked is still reported as theirs.
  assert.equal(sowingCalendarInUse({ chosen: 'mild-frost', site: mbombela, observedFrost: undefined, reference: 'summer' }).basis, 'grower-choice');
  // No choice: exactly the behaviour before this feature.
  assert.deepEqual(sowingCalendarInUse({ chosen: null, site: mbombela, observedFrost: undefined, reference: 'summer' }),
    { pattern: 'mild-frost', basis: 'site-climate', automatic: 'mild-frost' });
  assert.deepEqual(sowingCalendarInUse({ chosen: null, site: mbombela, observedFrost: 'no', reference: 'summer' }),
    { pattern: 'all-year', basis: 'grower-frost', automatic: 'all-year' });
  // No climate reading: the labelled fallback, and a choice still wins over it.
  assert.deepEqual(sowingCalendarInUse({ chosen: null, site: null, observedFrost: 'no', reference: 'mild-frost' }),
    { pattern: 'mild-frost', basis: 'reference', automatic: 'mild-frost' });
  assert.deepEqual(sowingCalendarInUse({ chosen: 'winter', site: null, observedFrost: undefined, reference: 'summer' }),
    { pattern: 'winter', basis: 'grower-choice', automatic: 'summer' });
});

test('every calendar is offered once, coldest first, with places a grower can recognise', () => {
  assert.deepEqual(SOWING_CALENDAR_OPTIONS.map((option) => option.value), ['summer', 'mild-frost', 'all-year', 'winter']);
  assert.equal(sowingCalendarOptionText(SOWING_CALENDAR_OPTIONS[2]), 'Hot area, no frost (Lowveld, Limpopo valley, KZN coast)');
  for (const option of SOWING_CALENDAR_OPTIONS) assert.ok(option.where.length > 3 && !/undefined/.test(sowingCalendarOptionText(option)));
});

test('a grower who chose their calendar is told what the records give, and is warned when the records show frost', () => {
  const lines = (s: SiteClimate, pattern: SiteClimate['pattern']) => sowingCalendarReasons(s, { pattern, basis: 'grower-choice' });
  // Mbombela, frost-free on record, choosing the hot calendar: told the difference, no frost warning.
  const warm = lines(site(), 'all-year');
  assert.ok(warm.some((line) => /You chose the "Hot area, no frost" calendar yourself/.test(line) && /would give "Light frost at most"/.test(line)), warm.join('\n'));
  assert.ok(!warm.some((line) => /show frost here/.test(line)));
  assert.ok(!warm.some((line) => /close to the line/.test(line)), 'a decided calendar is not also described as a close call');
  // Johannesburg choosing the hot calendar: allowed, and told plainly what the records show.
  const johannesburg = site({ pattern: 'summer', closeCall: null, warmerNeighbour: null, coldestMonthC: 9.9, hottestMonthC: 21.6, recordMinC: -4.8 });
  const risky = lines(johannesburg, 'all-year');
  assert.ok(risky.some((line) => /records show frost here \(lowest on record -5 °C\)/.test(line) && /record the months you see frost/.test(line)), risky.join('\n'));
  // Choosing a COLDER calendar than the records give needs no frost warning.
  assert.ok(!lines(site({ pattern: 'all-year', recordMinC: 6 }), 'summer').some((line) => /show frost here/.test(line)));
  // Choosing the same calendar says so.
  assert.ok(lines(site(), 'mild-frost').some((line) => /give the same one/.test(line)));
  for (const line of [...warm, ...risky]) assert.doesNotMatch(line, /undefined|null|NaN/);
});

// ── Saved sowings the calendar no longer offers ─────────────────────────────

const NOW = { year: 2026, month: 11 };
const row = (over: Partial<Planting> & Pick<Planting, 'id' | 'cropKey' | 'sowMonth'>): Planting => ({ bedId: 'b1', ...over });

test('a plan made for the old season lists exactly the sowings the hot-area calendar no longer offers', () => {
  // What a Komatipoort grower was left with: a plan from the hard-frost calendar.
  const plan: Planting[] = [
    row({ id: 'cabbage-jan', cropKey: 'cabbage', sowMonth: 1 }),       // hot areas: Feb-Jun
    row({ id: 'tomato-oct', cropKey: 'tomatoes', sowMonth: 10 }),      // hot areas: Dec-Mar, Jul-Sep
    row({ id: 'beans-sep', cropKey: 'green-beans', sowMonth: 9 }),     // in season on both calendars
    row({ id: 'sorghum-nov', cropKey: 'sorghum', sowMonth: 11 }),      // no hot-area month at all
  ];
  const found = sowingsOutsideCalendar(plan, 'all-year', NOW);
  assert.deepEqual(found.map((item) => item.plantingId), ['cabbage-jan', 'tomato-oct', 'sorghum-nov']);
  assert.equal(outOfCalendarLine(found[0], 'Bed 1'), 'Cabbage on Bed 1: planned for January. This calendar sows it Feb–Jun.');
  assert.match(outOfCalendarLine(found[2]), /^Sorghum.*: planned for November\. This calendar has no sowing month for it\.$/);
  // On the hard-frost calendar the plan was made for, nothing is listed.
  assert.deepEqual(sowingsOutsideCalendar(plan, 'summer', NOW), []);
});

test('sowings that are already behind the grower, or were never planned from the catalogue, are not listed', () => {
  const out = (planting: Planting) => sowingsOutsideCalendar([planting], 'all-year', NOW).length;
  const base = row({ id: 'x', cropKey: 'cabbage', sowMonth: 1 });
  assert.equal(out(base), 1, 'fixture: a January cabbage is out of season on the hot-area calendar');
  assert.equal(out({ ...base, existing: true }), 0, 'already in the ground');
  assert.equal(out({ ...base, growerCycle: { any: 'marker' } }), 0, "planned on the grower's own estimates");
  assert.equal(out({ ...base, once: '2026-01' }), 0, 'a dated sowing whose month has passed');
  assert.equal(out({ ...base, once: '2027-01' }), 1, 'a dated sowing still ahead');
  assert.equal(out({ ...base, sowMonth: 11, once: '2026-11' }), 1, 'a dated sowing this month is still ahead');
  assert.equal(out({ ...base, once: '2027-01', awaitingSowingConfirmation: true }), 0);
  assert.equal(out({ ...base, finishedOnceSowing: true }), 0);
  assert.equal(out({ ...base, confirmedOnceSowing: '2026-01' }), 0);
  assert.equal(out({ ...base, cropKey: 'not-a-crop' }), 0, 'an unknown crop is not judged');
  assert.equal(out(row({ id: 'f', cropKey: 'fodder-radish', sowMonth: 6 })), 0, 'a crop whose timing the catalogue does not vouch for');
  assert.equal(out({ ...base, sowMonth: 13 }), 0);
});

test('hiding the list holds for the same list and calendar, and it returns when either changes', () => {
  const plan = [row({ id: 'a', cropKey: 'cabbage', sowMonth: 1 }), row({ id: 'b', cropKey: 'lettuce', sowMonth: 12 })];
  const found = sowingsOutsideCalendar(plan, 'all-year', NOW);
  const signature = outOfCalendarSignature(found, 'all-year');
  assert.equal(outOfCalendarSignature([...found].reverse(), 'all-year'), signature, 'order must not matter');
  assert.notEqual(outOfCalendarSignature(found.slice(0, 1), 'all-year'), signature, 'one sowing fixed: a different list');
  assert.notEqual(outOfCalendarSignature(found, 'mild-frost'), signature, 'a different calendar: a different notice');
  const moved = sowingsOutsideCalendar([{ ...plan[0], sowMonth: 12 }, plan[1]], 'all-year', NOW);
  assert.notEqual(outOfCalendarSignature(moved, 'all-year'), signature, 'a sowing moved to another wrong month is new information');
});

test('a hidden list returns when only the months the calendar recommends have changed', () => {
  // Independent review of PR #1328 (comment 6762918246) ran the published function: a
  // January cabbage told "sow it Feb–Jun" and the same row told "sow it Mar–May" gave the
  // same signature, so a grower who had hidden the first list never saw the second. Each
  // line of the list states those months; they are part of what the grower was told.
  const cabbage = (calendarMonths: readonly number[]) => ({
    plantingId: 'p1', bedId: 'b1', cropKey: 'cabbage', cropName: 'Cabbage', sowMonth: 1, calendarMonths,
  });
  const lettuce = { plantingId: 'p2', bedId: 'b2', cropKey: 'lettuce', cropName: 'Lettuce', sowMonth: 12, calendarMonths: [2, 3, 4, 5, 6, 7, 8] };
  const before = outOfCalendarSignature([cabbage([2, 3, 4, 5, 6]), lettuce], 'all-year');

  assert.notEqual(outOfCalendarSignature([cabbage([3, 4, 5]), lettuce], 'all-year'), before, 'the recommended months narrowed: the grower must see the list again');
  assert.notEqual(outOfCalendarSignature([cabbage([2, 3, 4, 5, 6, 7]), lettuce], 'all-year'), before, 'one month added');
  assert.notEqual(outOfCalendarSignature([cabbage([]), lettuce], 'all-year'), before, 'the calendar stopped offering the crop at all');
  assert.notEqual(outOfCalendarSignature([cabbage([2, 3, 4, 5, 6]), { ...lettuce, calendarMonths: [3, 4, 5] }], 'all-year'), before, 'a change in any row counts');

  // The same advice is the same notice, however the months or the rows are listed.
  assert.equal(outOfCalendarSignature([cabbage([2, 3, 4, 5, 6]), lettuce], 'all-year'), before, 'unchanged advice stays hidden');
  assert.equal(outOfCalendarSignature([cabbage([6, 5, 4, 3, 2]), lettuce], 'all-year'), before, 'month listing order is not a change');
  assert.equal(outOfCalendarSignature([cabbage([2, 2, 3, 4, 5, 6, 6]), lettuce], 'all-year'), before, 'a repeated month is not a change');
  assert.equal(outOfCalendarSignature([lettuce, cabbage([2, 3, 4, 5, 6])], 'all-year'), before, 'row order is not a change');
  // A year-wrapping window keeps one form whichever month the catalogue lists first.
  assert.equal(
    outOfCalendarSignature([cabbage([10, 11, 12, 1])], 'winter'),
    outOfCalendarSignature([cabbage([1, 10, 11, 12])], 'winter'),
  );

  // Rows built from the catalogue carry the catalogue's months into the signature.
  const [found] = sowingsOutsideCalendar([row({ id: 'p1', cropKey: 'cabbage', sowMonth: 1 })], 'all-year', NOW);
  assert.deepEqual([...found.calendarMonths], [2, 3, 4, 5, 6], 'fixture: the hot-area cabbage row');
  assert.equal(outOfCalendarSignature([found], 'all-year'), 'all-year|p1:cabbage:1:2.3.4.5.6');
});

test('only a plan that may predate the correction is told the months changed under it', () => {
  assert.equal(SOWING_CALENDAR_CORRECTED_AT, Date.UTC(2026, 10, 10));
  assert.equal(planMayPredateCorrection(Date.UTC(2026, 8, 1)), true);
  assert.equal(planMayPredateCorrection(undefined), true, 'an undated plan may be old');
  assert.equal(planMayPredateCorrection(Number.NaN), true);
  assert.equal(planMayPredateCorrection(Date.UTC(2026, 10, 11)), false, 'a plan accepted after the correction was made on the corrected calendar');
});

test('the public sample farm does not model the wrong season on its own calendar', async () => {
  // The sample farm is the first plan a visitor sees. It sits in the Mkuze valley, which the
  // corrected rule puts on the hot-area calendar (tests/sa-calendar-real-sites.test.ts). Its
  // plan was written against the hard-frost calendar the site used to be given, and four
  // sowings (butternut in December, tomatoes and green beans in October, lettuce in
  // September) were out of season on the corrected one. A sample that opens with its own
  // out-of-season notice would teach the old mistake.
  const { buildDemoCropPlan } = await import('@/lib/demo-farm');
  const plan = buildDemoCropPlan().plantings;
  for (let month = 1; month <= 12; month++) {
    assert.deepEqual(sowingsOutsideCalendar(plan, 'all-year', { year: 2026, month }).map((item) => `${item.cropName} sown in month ${item.sowMonth}`), [],
      `opened in month ${month}`);
  }
});

test('saved sowings are judged on the site\'s own calendar or the grower\'s, never on a fallback guess for a mapped site', () => {
  // The site's climate reading, the grower's frost answer and the grower's choice all know
  // something about this ground.
  assert.equal(calendarCanJudgeSavedSowings('site-climate', true), true);
  assert.equal(calendarCanJudgeSavedSowings('grower-frost', true), true);
  assert.equal(calendarCanJudgeSavedSowings('grower-choice', true), true);
  assert.equal(calendarCanJudgeSavedSowings('grower-choice', false), true, 'a choice stands with or without a mapped site');
  // A mapped site whose climate has not been read is on the nearest reference region.
  assert.equal(calendarCanJudgeSavedSowings('reference', true), false);
  // With no site mapped at all the cautious fallback is the only calendar the plan ever had.
  assert.equal(calendarCanJudgeSavedSowings('reference', false), true);
});

test('the sample farm opens without an out-of-season list whether or not its climate has loaded', async () => {
  // Independent review of PR #1328 opened the hosted preview at 0c00546 in a fresh browser
  // (comment 6762970071). The sample farm's climate had not loaded, the page fell back to
  // "Durban / KZN coast" (light frost), and it listed March butternut and February green
  // beans as out of season. Both are in season on the farm's own hot-area calendar. The
  // earlier acceptance test only covered the loaded state, so this one holds all three.
  const { buildDemoCropPlan, buildDemoFacilitatorState } = await import('@/lib/demo-farm');
  const plan = buildDemoCropPlan().plantings;
  const bgSite = (buildDemoFacilitatorState() as { bgSite?: { lat: number; lon: number } }).bgSite;
  assert.ok(bgSite, 'fixture: the sample farm is a mapped site');
  const reference = referenceSowingCalendar(nearestRainfall(bgSite.lat, bgSite.lon));
  assert.equal(reference, 'mild-frost', 'fixture: the fallback for the sample farm is the light-frost calendar, never the hot-area one');
  const listed = (pattern: Parameters<typeof sowingsOutsideCalendar>[1], canJudge: boolean) =>
    canJudge ? sowingsOutsideCalendar(plan, pattern, NOW).map((item) => `${item.cropKey}@${item.sowMonth}`).sort() : [];

  // 1. Cold cache, offline or provider down: fallback calendar, and nothing is listed.
  const cold = sowingCalendarInUse({ chosen: null, site: null, observedFrost: undefined, reference });
  assert.deepEqual(cold, { pattern: 'mild-frost', basis: 'reference', automatic: 'mild-frost' });
  assert.deepEqual(listed(cold.pattern, calendarCanJudgeSavedSowings(cold.basis, true)), []);
  // The case the review saw is kept on the record: judged on the fallback, these two would be
  // listed. If this changes, the fallback or the sample plan moved and the case needs re-reading.
  assert.deepEqual(listed('mild-frost', true), ['butternut@3', 'green-beans@2']);

  // 2. Climate loaded: the farm's own hot-area calendar, and nothing is out of season on it.
  const loaded = sowingCalendarInUse({ chosen: null, site: { pattern: 'all-year', warmerNeighbour: null }, observedFrost: undefined, reference });
  assert.equal(loaded.basis, 'site-climate');
  assert.deepEqual(listed(loaded.pattern, calendarCanJudgeSavedSowings(loaded.basis, true)), []);

  // 3. A visitor who chooses a calendar is judged on it even with no climate loaded: the
  // choice is theirs, so the list is not a guess.
  const chose = sowingCalendarInUse({ chosen: 'summer', site: null, observedFrost: undefined, reference });
  assert.equal(calendarCanJudgeSavedSowings(chose.basis, true), true);
  assert.ok(listed(chose.pattern, true).length > 0, 'the hard-frost calendar does not fit the sample plan, and the visitor is told');
});

test('the printed plan says when the calendar was the grower\'s choice', () => {
  // Paper printed a chosen calendar under "This site (satellite climate records)" with no
  // word that the grower chose it. The screen says "chosen by you"; paper must too.
  assert.equal(printedSowingCalendarLine('Hot area, no frost · summer rain', 'grower-choice', 'site'),
    'Hot area, no frost · summer rain (sowing calendar chosen by the grower)');
  assert.equal(printedSowingCalendarLine('Winter frost', 'grower-choice', 'reference'), 'Winter frost (sowing calendar chosen by the grower)');
  assert.equal(printedSowingCalendarLine('Winter frost', 'grower-choice', 'none'), 'Winter frost (sowing calendar chosen by the grower)',
    'a choice is never printed as an assumption');
  // Unchanged for every other basis: the calendar alone, or "Assuming ..." with no site.
  assert.equal(printedSowingCalendarLine('Light frost at most · summer rain', 'site-climate', 'site'), 'Light frost at most · summer rain');
  assert.equal(printedSowingCalendarLine('Light frost at most · summer rain', 'grower-frost', 'site'), 'Light frost at most · summer rain');
  assert.equal(printedSowingCalendarLine('Light frost at most · summer rain', 'reference', 'reference'), 'Light frost at most · summer rain');
  assert.equal(printedSowingCalendarLine('Winter frost', 'reference', 'none'), 'Assuming winter frost');
});
