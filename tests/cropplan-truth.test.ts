import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { cropByKey } from '../lib/crop-catalog.ts';

// TWO DEFECTS, ONE SCREEN: app/cropplan/page.tsx.
//
// 1. jobsForDate used to invent a day-of-week rota (Mon water beds A&B, Tue mulch, Wed compost
//    tea, Thu weed everything, Sat photo) parameterised only by whichever beds a farmer had — not
//    by anything they had actually scheduled. It also used to crash on a one-bed farm reading
//    `.letter` off `undefined`. Both defects are gone by construction now: the page no longer has
//    a jobsForDate function at all — every job it shows comes from loadCropBoardTasksForMonth
//    (lib/task-board.ts), which can only ever emit tasks traceable to a real planting
//    (see tests/cropplan-task-source.test.ts for that guarantee). This test asserts the deleted
//    function stays deleted and the real pipeline is what's wired in, so the fiction can't quietly
//    creep back in a future edit.
// 2. September told a farmer to sow maize. The catalog's own maize entry (lib/crop-catalog.ts)
//    puts every rainfall pattern's sowing window at Oct-Dec — the same "false-early" defect
//    tests/calendar-truth.test.ts already exists to catch on the neighbouring /calendar page, just
//    typed by hand into this one instead. MONTH_FOCUS is generic seasonal guidance (not derived
//    from any farmer's beds) and survives the task-source rewrite unchanged, so this half of the
//    guard is unchanged too.
//
// A third defect this file used to guard — /calendar having no door anywhere in the app — landed
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
    /loadCropBoardTasksForMonth/,
    'app/cropplan/page.tsx must source its jobs from loadCropBoardTasksForMonth (lib/task-board.ts)',
  );
  // The heading must not collide with the flagship /facilitator/crops "Crop Plan" screen —
  // this one is "Task Planner" everywhere, matching its own NavDrawer label.
  assert.match(PAGE, /Task Planner/);
  assert.doesNotMatch(PAGE, />Crop Plan</, 'page heading still says "Crop Plan", colliding with /facilitator/crops');
});

test('a farmer with no real crop plan sees an unconditional notice, not fabricated jobs', () => {
  assert.match(PAGE, /!hasPlan/, 'the no-plan notice must be unconditional on whether a real plan exists');
  assert.match(PAGE, /No crop plan yet/);
});

// ---------------------------------------------------------------------------
// 2. MONTH_FOCUS must not claim a sow month the catalog does not back
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
