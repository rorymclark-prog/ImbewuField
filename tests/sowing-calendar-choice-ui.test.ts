// The crop planner page lets a grower choose their sowing calendar and tells them which
// saved sowings fall outside it. These read the page source, as plan-assurance does, so a
// rewrite that drops the wiring fails here rather than in a grower's plan.
//
// WHY (10 November 2026, Rory: "go ahead with decisions 2 and 3"): the accuracy audit showed
// the grid cell can give the wrong calendar (Mbombela, Tzaneen, Worcester), and the grower
// knows their land. Nothing may rewrite a saved plan, so the page only lists what is off.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');

function functionBody(name: string): string {
  const start = page.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} must exist on the page`);
  const next = page.indexOf('\n  function ', start + 10);
  return page.slice(start, next > 0 ? next : start + 1500);
}

test('the sowing months a grower is offered come from the one calendar-in-use rule, with their own choice first', () => {
  assert.match(page, /sowingCalendarInUse\(\{[^}]*chosen:\s*chosenCalendar/);
  assert.match(page, /const pattern: RainPattern = calendarInUse\.pattern/);
  assert.match(page, /sowingCalendarChoiceFor\(plan, calendarScopeId\)/);
});

test('a calendar the grower chose is saved with the plan book and survives a reload', () => {
  const body = functionBody('chooseSowingCalendar');
  assert.match(body, /withSowingCalendarChoice\(/);
  assert.match(body, /setPlan\(/);
});

test('choosing a calendar goes through the autosave path, so it cannot bypass the stale-plan and conflict checks', () => {
  const body = functionBody('chooseSowingCalendar');
  assert.doesNotMatch(body, /saveCropPlanWithReceipt/);
  assert.doesNotMatch(body, /pushPlanHistory/);
});

test('the grower can pick a calendar or hand the decision back to the app, on a tap-sized control', () => {
  assert.match(page, /Sowing calendar for this site/);
  assert.match(page, /Let the app decide: /);
  assert.match(page, /SOWING_CALENDAR_OPTIONS\.map\(/);
  const select = page.slice(page.indexOf('Sowing calendar for this site'), page.indexOf('Choose one only if you know your land'));
  assert.match(select, /min-h-11/);
});

test('the page says when a calendar is the grower\'s own and not the satellite climate', () => {
  assert.match(page, /chosen by you/);
  assert.match(page, /Sowing calendar chosen by the grower/);
  assert.match(page, /Sowing calendar you chose/);
  assert.match(page, /You chose this calendar yourself\./);
});

test('a grower is told which planned sowings fall outside their calendar and that nothing was moved', () => {
  assert.match(page, /sowingsOutsideCalendar\(/);
  assert.match(page, /outOfCalendarSignature\(/);
  assert.match(page, /outOfCalendarLine\(/);
  assert.match(page, /Nothing has been changed/);
  assert.match(page, /Make a new plan/);
  assert.match(page, /Hide this list/);
});

test('hiding the list is remembered per site and read only after mount, so the server render never touches storage', () => {
  assert.match(page, /imbewu_sowing_calendar_notice_hidden_v1/);
  const lines = page.split('\n');
  const reads = lines.map((line, i) => ({ line, i })).filter(({ line }) => /localStorage\.getItem\(SOWING_CALENDAR_NOTICE_HIDDEN_KEY/.test(line));
  assert.equal(reads.length, 1);
  const before = page.slice(0, page.indexOf('localStorage.getItem(SOWING_CALENDAR_NOTICE_HIDDEN_KEY'));
  assert.ok(before.lastIndexOf('useEffect(() => {') > before.lastIndexOf('\nfunction '), 'the read must sit inside a useEffect, not at module level or in render');
  assert.match(page, /try \{ localStorage\.setItem\(SOWING_CALENDAR_NOTICE_HIDDEN_KEY/);
});

test('the notice gives the grower the real reason: their own calendar choice, or a plan older than the correction', () => {
  // Seen in the browser on 2026-11-10: a grower who had just chosen a different calendar was
  // told their plan predated a correction. Their choice is the reason, and it is known.
  const notice = page.slice(page.indexOf('aria-label="Sowings outside the sowing calendar"'));
  assert.match(notice, /calendarBasis === 'grower-choice'\s*\?\s*<p[^>]*>You chose the &quot;\{SOWING_CALENDAR_LABEL\[pattern\]\}&quot; calendar for this site\. These sowings were planned on a different one\.<\/p>/);
  assert.match(notice, /:\s*planMayPredateCorrection\(plan\?\.planNotesAt\) && <p[^>]*>Sowing months and calendars were corrected on 10 November 2026\./,
    'the correction sentence is only for a plan that may predate it, and never alongside the choice sentence');
});

test('the list of out-of-season sowings is not drawn from a fallback guess for a mapped site', () => {
  // Hosted preview, fresh visitor, sample farm: the climate had not loaded and two in-season
  // sowings were listed against the Durban fallback (PR #1328, comment 6762970071).
  assert.match(page, /const canJudgeSavedSowings = calendarCanJudgeSavedSowings\(calendarInUse\.basis, hasSiteCoords\);/);
  assert.match(page, /allowCataloguePlanning && canJudgeSavedSowings \? sowingsOutsideCalendar\(/);
});

test('the printed plan takes its calendar line from the one rule that names a grower\'s choice', () => {
  const meta = page.slice(page.indexOf('const exportMeta = useMemo'), page.indexOf('estimatedKgPerYear: totalYieldKg'));
  assert.match(meta, /const climateLine = printedSowingCalendarLine\(calendarLabel, calendarBasis, climateSource\);/);
  assert.match(meta, /\n\s+climateLine,\n/, 'the PDF receives that line unchanged');
  assert.doesNotMatch(meta, /climateLine: /, 'no second, differently worded climate line');
});
