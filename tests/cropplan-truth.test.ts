import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

import { cropByKey } from '../lib/crop-catalog.ts';
import { DEFAULT_BEDS } from '../app/cropplan/load-beds.ts';

// TWO DEFECTS, ONE SCREEN: app/cropplan/page.tsx.
//
// 1. A farmer with a single bed configured — the normal state straight out of a fresh garden
//    survey, or after adding one crop in the planner — crashed the whole Crop Plan screen.
//    `beds[1]` and `beds[3] ?? beds[1]` resolved to plain `undefined` on five of the seven
//    weekdays, and the job titles read `.letter` off it.
// 2. September told a farmer to sow maize. The catalog's own maize entry (lib/crop-catalog.ts)
//    puts every rainfall pattern's sowing window at Oct-Dec — the same "false-early" defect
//    tests/calendar-truth.test.ts already exists to catch on the neighbouring /calendar page, just
//    typed by hand into this one instead.
//
// A third defect this file used to guard — /calendar having no door anywhere in the app — landed
// independently via #215 (the seasonal calendar's own Farm Tools entry) and is covered there by
// tests/nav-menu-links.test.ts, which asserts the actual shipped icon (Calendar, not CalendarRange).
// That coverage is more thorough than what stood here, so the duplicate test was dropped rather
// than kept pointing at a losing implementation detail.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const PAGE = read('../app/cropplan/page.tsx');

// ---------------------------------------------------------------------------
// 1. jobsForDate must survive a one-bed farm
// ---------------------------------------------------------------------------

// Brace-balanced extraction, not a regex up to the next blank line — the function's body has its
// own nested braces (a switch, arrow functions) and a fragile text boundary would silently stop
// matching the day the function grows a line. This mirrors calendar-truth.test.ts's rule of
// reading the page's own source rather than mirroring it by hand.
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} not found in app/cropplan/page.tsx`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced braces extracting ${name} from app/cropplan/page.tsx`);
}

test('a one-bed farm does not crash the crop-plan day/week views', async () => {
  const jobsForDateSrc = extractFunction(PAGE, 'jobsForDate')
    .replace('function jobsForDate', 'export function jobsForDate');

  // .tsx can't be imported directly under plain `node --test` (JSX needs a real transform, not
  // just type-stripping) — the codebase's existing tests read such files as text instead. This
  // one goes a step further and actually executes the extracted logic, because a regression here
  // is a crash, and a string match on the source can't prove the function still runs.
  // DEFAULT_BEDS itself is imported live from load-beds.ts (see top of file) rather than
  // regex-extracted from page.tsx text — it moved there in #215's account-isolation split, and an
  // import that breaks if it moves again is a stronger guard than a source-text pattern would be.
  const moduleSource = `const DEFAULT_BEDS = ${JSON.stringify(DEFAULT_BEDS)};\n${jobsForDateSrc}\n`;
  const tmpFile = join(tmpdir(), `cropplan-jobsfordate-${process.pid}-${Date.now()}.ts`);
  writeFileSync(tmpFile, moduleSource, 'utf8');
  try {
    const { jobsForDate } = await import(pathToFileURL(tmpFile).href);
    const oneBed = [{ letter: 'A', crop: 'Spinach' }];
    // Seven consecutive dates cover every getDay() value exactly once, whichever weekday the
    // first one happens to land on — no dependency on knowing 1 Jan 2026's actual weekday.
    const week = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 1 + i));
    for (const day of week) {
      const jobs = jobsForDate(day, oneBed);
      assert.ok(Array.isArray(jobs) && jobs.length > 0, `no jobs returned for getDay()=${day.getDay()}`);
      for (const job of jobs) {
        assert.ok(!/undefined/.test(job.title), `job title leaked undefined: "${job.title}"`);
        assert.ok(!/undefined/.test(job.sub), `job sub leaked undefined: "${job.sub}"`);
      }
    }
  } finally {
    unlinkSync(tmpFile);
  }
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
