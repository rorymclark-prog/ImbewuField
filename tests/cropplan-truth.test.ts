import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { cropByKey } from '../lib/crop-catalog.ts';

// THE TASK PLANNER SCREEN: app/cropplan/page.tsx. Source-level guards for the
// defects this screen has actually shipped.
//
// 1. jobsForDate used to invent a day-of-week rota (Mon water beds A&B, Tue mulch, Wed compost
//    tea, Thu weed everything, Sat photo) parameterised only by whichever beds a farmer had — not
//    by anything they had actually scheduled. It also used to crash on a one-bed farm reading
//    `.letter` off `undefined`. Both defects are gone by construction now: the page no longer has
//    a jobsForDate function at all — every job it shows comes from loadCropBoardYear
//    (lib/task-board.ts), which can only ever emit tasks traceable to a real planting, and now
//    also emits every task the plan holds (see tests/cropplan-task-source.test.ts for both
//    directions). This test asserts the deleted function stays deleted and the real pipeline is
//    what's wired in, so the fiction can't quietly creep back in a future edit.
// 2. GRANULARITY. Crop-plan tasks carry a month and no day, so Day and Week tabs could only ever
//    restate the month's list under a finer heading — and their empty state told the farmer to
//    "check the month view" when the month view rendered the identical array. Both views are
//    deleted; this file guards that they stay deleted rather than coming back as month lists in
//    day clothing.
// 3. September told a farmer to sow maize. The catalog's own maize entry (lib/crop-catalog.ts)
//    puts every rainfall pattern's sowing window at Oct-Dec — the same "false-early" defect
//    tests/calendar-truth.test.ts already exists to catch on the neighbouring /calendar page, just
//    typed by hand into this one instead. MONTH_FOCUS is generic seasonal guidance (not derived
//    from any farmer's beds) and survives the task-source rewrite unchanged, so this half of the
//    guard is unchanged too.
//
// (docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md is the write-up of the same CLASS of defect —
// invented dated jobs — on the crop-plan surfaces it covers. It does not name /cropplan or this
// screen's weekday rota; the reference here is to the pattern, not to a finding about this page.)
//
// A fourth defect this file used to guard — /calendar having no door anywhere in the app — landed
// independently via #215 (the seasonal calendar's own Farm Tools entry) and is covered there by
// tests/nav-menu-links.test.ts, which asserts the actual shipped icon (Calendar, not CalendarRange).
// That coverage is more thorough than what stood here, so the duplicate test was dropped rather
// than kept pointing at a losing implementation detail.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const PAGE = read('../app/cropplan/page.tsx');

// ---------------------------------------------------------------------------
// 1. No invented rota — the real task source is what's wired in
// ---------------------------------------------------------------------------

test('the task-planner screen has no invented day-of-week job rota', () => {
  assert.ok(
    !/function jobsForDate/.test(PAGE),
    'jobsForDate reappeared in app/cropplan/page.tsx — the invented weekday rota must not come back',
  );
  assert.ok(
    !/getDay\(\)\s*\)\s*\{[\s\S]*case 1:/.test(PAGE),
    'a day-of-week switch statement reappeared in app/cropplan/page.tsx',
  );
  assert.match(
    PAGE,
    /loadCropBoardYear/,
    'app/cropplan/page.tsx must source its jobs from loadCropBoardYear (lib/task-board.ts)',
  );
  // The heading must not collide with the flagship /facilitator/crops "Crop Plan" screen —
  // this one is "Task Planner" everywhere, matching its own NavDrawer label.
  assert.match(PAGE, /Task Planner/);
  assert.doesNotMatch(PAGE, />Crop Plan</, 'page heading still says "Crop Plan", colliding with /facilitator/crops');
});

// ---------------------------------------------------------------------------
// 2. Granularity honesty — month is the finest the data supports
// ---------------------------------------------------------------------------

test('the planner offers only the granularity the crop plan actually has', () => {
  assert.match(
    PAGE,
    /type View = 'month' \| 'season';/,
    'app/cropplan/page.tsx must offer month and season only — crop-plan tasks carry a month, never a day',
  );
  assert.doesNotMatch(PAGE, /label: 'Day'/, 'the Day tab came back; it can only restate the month list');
  assert.doesNotMatch(PAGE, /label: 'Week'/, 'the Week tab came back; it can only restate the month list');
});

test('an empty month says so plainly and does not send the farmer to another view', () => {
  assert.match(
    PAGE,
    /Nothing due from your crop plan in \$\{monthName\}\./,
    'the empty-month message must name the month it is talking about',
  );
  assert.doesNotMatch(
    PAGE,
    /check the (month|day|week|season) view/i,
    'an empty state must not point at another view — every view on this screen reads the same sourced tasks',
  );
});

// ---------------------------------------------------------------------------
// 3. Empty-state honesty — the notice gate matches the task source
// ---------------------------------------------------------------------------

test('a farmer with no real crop plan sees an unconditional, pinned notice, not fabricated jobs', () => {
  // Gated on savedPlantings, which lib/task-board.ts reads off the SAME stored plan the jobs
  // come from — not on a looser signal that can be true while the job list is empty.
  const bannerIndex = PAGE.indexOf('savedPlantings === 0 &&');
  const scrollContainerIndex = PAGE.indexOf('overflow-y-auto');
  assert.ok(bannerIndex > 0, 'page.tsx must gate its no-plan notice on the task source\'s own savedPlantings count');
  // Pinned outside the `overflow-y-auto` scroll container, not inside it — scrolling the
  // job list must never be able to carry the notice off-screen.
  assert.ok(bannerIndex < scrollContainerIndex, 'the no-plan notice must sit outside the scrollable content, not inside it');
  assert.match(PAGE, /No crop plan yet/, 'the notice must say plainly that there is no real plan yet');
  assert.match(PAGE, /href="\/facilitator\/crops"/, 'the notice must offer a real way to set up the farmer\'s own crop plan');
});

test('a saved plan that produces no jobs at all is explained, not left as twelve silent empty months', () => {
  assert.match(
    PAGE,
    /savedPlantings > 0 && totalTasks === 0/,
    'page.tsx must distinguish "no plan yet" from "a saved plan that yields no jobs in any month"',
  );
  assert.match(PAGE, /not producing any jobs/, 'the saved-but-empty case must say what is wrong');
});

// ---------------------------------------------------------------------------
// 4. MONTH_FOCUS must not claim a sow month the catalog does not back
// ---------------------------------------------------------------------------

test('MONTH_FOCUS never names maize in a month outside its catalog sowing window', () => {
  const monthFocusMatch = PAGE.match(/const MONTH_FOCUS: Record<number, string> = \{([\s\S]*?)\n\};/);
  assert.ok(monthFocusMatch, 'MONTH_FOCUS moved or was renamed in app/cropplan/page.tsx');
  const entries = [...monthFocusMatch[1].matchAll(/^\s*(\d+):\s*'([^']*)'/gm)]
    .map((m) => [Number(m[1]), m[2]] as const);
  assert.ok(entries.length === 12, `expected 12 MONTH_FOCUS entries, parsed ${entries.length}`);

  const maize = cropByKey('maize')!;
  // "Valid under ANY catalog pattern" is the deliberately lenient bar: several other MONTH_FOCUS
  // lines (garlic in March, spinach in May) are only true under one specific rainfall pattern,
  // which this page never commits to naming, so they are not tested here. Maize's window is
  // Oct-Dec under every pattern the catalog has — the one claim on this page that is unambiguously
  // right or wrong no matter which region a farmer is reading it in.
  const maizeValidMonths = new Set(Object.values(maize.sowMonths).flat());
  for (const [monthIndex, text] of entries) {
    if (!/\bmaize\b/i.test(text)) continue;
    const calendarMonth = monthIndex + 1; // MONTH_FOCUS is 0-indexed (0 = January)
    assert.ok(
      maizeValidMonths.has(calendarMonth),
      `MONTH_FOCUS[${monthIndex}] names maize but month ${calendarMonth} is outside every catalog `
      + `sowing window (${[...maizeValidMonths].sort((a, b) => a - b).join(', ')})`,
    );
  }

  // Pins the actual regression directly, so an edit that quietly drops the word "maize"
  // everywhere (which would make the loop above vacuous) still gets caught.
  const september = entries.find(([i]) => i === 8)?.[1] ?? '';
  assert.ok(!/\bmaize\b/i.test(september), `September still names maize: "${september}"`);
});
