// Guards lib/course-calendar.ts — the file that measures the authored course against the nine
// months the app promises.
//
// The important tests here are not the arithmetic ones. They are the two that fail when the
// calendar and the authored content drift apart: SEASONAL_CONDITIONS pointing at a self-check
// item that has been rewritten or renumbered, and the planting module being renamed out from
// under the harvest check. Both would otherwise fail silently — the calendar would keep printing
// a confident report about a course that no longer says what it quotes.

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  COURSE_WEEKS,
  SEASONAL_CONDITIONS,
  conditionQuote,
  courseCoverage,
  harvestGaps,
  layOutCourse,
} from '../lib/course-calendar';
import { CAPSTONE, MODULE_ASSIGNMENTS } from '../lib/course-assignment-content';

test('the layout covers exactly the promised span, no more and no less', () => {
  const weeks = layOutCourse();
  assert.equal(weeks.length, COURSE_WEEKS);
  assert.deepEqual(
    weeks.map((w) => w.week),
    Array.from({ length: COURSE_WEEKS }, (_, i) => i + 1),
  );
});

test('every module reaches the calendar — none falls off the end of the span', () => {
  const c = courseCoverage();
  assert.deepEqual(
    c.unplacedModules,
    [],
    'a module ran past week 36 and was never scheduled — the span or the pacing is wrong',
  );
});

test('coverage reports the empty weeks rather than rounding them away', () => {
  const c = courseCoverage();
  assert.equal(c.scheduledWeeks + c.emptyWeeks, c.totalWeeks);
  assert.ok(c.emptyWeeks >= 0);
  // The whole point of the file: if this ever hits zero the course fills its promised span and
  // the report should say so, not quietly keep claiming a gap.
  assert.ok(c.scheduledWeeks > 0);
});

test('a shorter span pushes modules off, and says which ones', () => {
  const short = courseCoverage(4);
  assert.equal(short.emptyWeeks, 0);
  assert.ok(
    short.unplacedModules.length > 0,
    'four weeks cannot hold eleven assignments — the unplaced list must not come back empty',
  );
});

test('the capstone gets field weeks but no reading week — it has no lessons', () => {
  const weeks = layOutCourse();
  const capstoneWeeks = weeks.filter((w) => w.moduleId === CAPSTONE.moduleId);
  assert.ok(capstoneWeeks.length > 0);
  assert.equal(
    capstoneWeeks.filter((w) => w.state === 'reading').length,
    0,
    'the capstone is completed in the Design Studio — giving it a reading week invents a lesson',
  );
});

test('every seasonal condition still points at a real authored sentence', () => {
  for (const c of SEASONAL_CONDITIONS) {
    const quote = conditionQuote(c);
    assert.ok(
      quote && quote.trim().length > 0,
      `SEASONAL_CONDITIONS row for ${c.moduleId} (${c.source}${c.index ?? ''}) points at nothing — ` +
        'the authored assignment was edited and this row was not',
    );
  }
});

test('each seasonal condition names a module the course actually has', () => {
  const ids = new Set([...MODULE_ASSIGNMENTS, CAPSTONE].map((a) => a.moduleId));
  for (const c of SEASONAL_CONDITIONS) {
    assert.ok(ids.has(c.moduleId), `SEASONAL_CONDITIONS names unknown module ${c.moduleId}`);
  }
});

test('the quoted sentence still contains the word the condition rests on', () => {
  // Not a spell-check: this is the drift guard. "I walked my land during or just after rain"
  // losing the word "rain" means the requirement changed and the row is now a claim about text
  // that no longer exists.
  const WORD: Record<string, RegExp> = {
    rain: /rain/i,
    'planting-window': /plant/i,
    'growing-crop': /seed|season|grow/i,
    harvest: /harvest/i,
  };
  for (const c of SEASONAL_CONDITIONS) {
    const quote = conditionQuote(c) ?? '';
    assert.match(
      quote,
      WORD[c.needs],
      `${c.moduleId} is listed as needing ${c.needs}, but its authored text no longer says so: "${quote}"`,
    );
  }
});

test('the harvest check finds the interval the course leaves between planting and picking', () => {
  const gaps = harvestGaps();
  assert.ok(
    gaps.length > 0,
    'market-community asks for a harvest and comes after vegetables-staples — the check must see it',
  );
  for (const g of gaps) {
    assert.ok(g.daysSincePlanting > 0, 'a harvest module before the planting module is nonsense');
    assert.equal(g.plantingModuleId, 'vegetables-staples');
  }
});

test('the planting module the harvest check depends on still exists', () => {
  // harvestGaps() returns [] when it cannot find the planting module — indistinguishable from
  // "no problem found" unless something asserts the module is there.
  assert.ok(
    MODULE_ASSIGNMENTS.some((a) => a.moduleId === 'vegetables-staples'),
    'vegetables-staples was renamed or removed; harvestGaps() is now silently reporting nothing',
  );
});
