// app/cropplan/page.tsx (the day-to-day task planner, distinct from the bed-timeline planner at
// app/facilitator/crops/page.tsx that tests/cropplan-facilitator-theme.test.ts already covers) —
// painted its month-strip chrome, task-icon colours and one alert border with hard-coded light hex
// (#FFFEFA card, #E2D8C4 hairline, #5C5040 ink-muted, #755942 ink-faint, #5C4F3C task-icon ink),
// so those specific pixels stayed a light page under the slate theme and under dark mode. It also
// used --gold (the ochre FILL token) as an unfilled icon/border stroke colour in two places, where
// --gold-dim is the one that clears contrast on an un-filled surface — the same rule
// app/calendar/page.tsx's SeasonIcon already follows. Two section headings were pinned at a single
// phone px with no desktop scaling.
//
// This is a source-text guard, the same idiom as tests/cropplan-facilitator-theme.test.ts: this
// page cannot run under node:test, so the wiring is pinned against the real shipped file rather
// than rendered.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const CROPPLAN = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');

// The exact hard-coded hex values the audit found on this screen's generic chrome and task-icon
// colours. None of these are the deliberately-fixed brand/CTA fills (forest's own #1F4D2B, its
// paired light text #EAF3E2/#F7F2E9, or the white-pill-always-white pair at the no-plan banner) —
// those keep their fixed fill + text pairing per CLAUDE.md. A reappearance of any value below is
// the light-chrome-in-dark-mode bug back.
const RETIRED_HARDCODED_CHROME = [
  '#FFFEFA', // card / --bg-1 (unselected month chip)
  '#E2D8C4', // hairline / --border (unselected / not-today month chip and card)
  '#5C5040', // ink-muted / --text-secondary (unselected month label)
  '#755942', // ink-faint / --text-muted (unselected, zero-job month count)
  '#5C4F3C', // task-icon ink / --text-secondary (prep / cut-down / weed icons)
];

test('the retired hard-coded chrome hex values do not reappear on /cropplan', () => {
  const found = RETIRED_HARDCODED_CHROME.filter((hex) => CROPPLAN.includes(hex));
  assert.deepEqual(
    found, [],
    `${found.length} retired hard-coded colour(s) are back in app/cropplan/page.tsx: `
      + `${found.join(', ')}. Use the matching theme token instead (see CLAUDE.md's palette table `
      + 'and "Don\'t hardcode a colour that has to follow the theme").',
  );
});

test('the twelve-month strip and season-view cards read the per-theme tokens', () => {
  assert.match(
    CROPPLAN,
    /background: on \? '#1F4D2B' : 'var\(--bg-1\)',\s*\n\s*border: `1px solid \$\{on \? '#1F4D2B' : isNow \? '#1F4D2B' : 'var\(--border\)'\}`,/,
    'the month-strip chip must read --bg-1 / --border for its unselected state, not a hard-coded hex',
  );
  assert.match(
    CROPPLAN,
    /color: on \? '#EAF3E2' : 'var\(--text-secondary\)'/,
    'the month-strip label must read --text-secondary when unselected',
  );
  assert.match(
    CROPPLAN,
    /color: on \? '#EAF3E2' : n > 0 \? '#1F4D2B' : 'var\(--text-muted\)'/,
    'the month-strip zero-job count must read --text-muted',
  );
  assert.match(
    CROPPLAN,
    /border: `1px solid \$\{mounted && m === todayMonth \? '#1F4D2B40' : 'var\(--border\)'\}`/,
    'the season-view month card border must read --border when it is not today',
  );
});

test('the soft-tinted "Now" and job-count badges in season view read theme tokens, not raw rgba', () => {
  assert.doesNotMatch(CROPPLAN, /rgba\(31,77,43,0\.1\)/, 'the "Now" badge must read var(--brand-soft), not a raw brand-green rgba tint');
  assert.doesNotMatch(CROPPLAN, /rgba\(226,216,196,0\.6\)/, 'the job-count badge must read var(--bg-2), not a raw hairline-tint rgba');
  assert.match(CROPPLAN, /background: 'var\(--brand-soft\)', color: 'var\(--color-forest-800\)' \}\}>\{ui\('Now', 'Manje'\)\}/);
  assert.match(CROPPLAN, /background: 'var\(--bg-2\)', color: 'var\(--text-secondary\)' \}\}>/);
});

test('ochre is used as --gold-dim, not --gold, where it strokes an un-filled icon or border', () => {
  // The harvest task icon sits in a low-opacity tinted chip, not a solid ochre fill, and the
  // "plan yields nothing" alert's icon + border sit directly on the themed card background —
  // both are the un-filled case CLAUDE.md's "ochre is a FILL" rule and app/calendar's SeasonIcon
  // comment describe, so both must read --gold-dim.
  assert.match(
    CROPPLAN,
    /harvest:\s*\{ Icon: Leaf,\s*color: 'var\(--gold-dim\)', short: 'Harvest' \}/,
    'the harvest task icon must read --gold-dim, not --gold',
  );
  assert.match(
    CROPPLAN,
    /border: '1px solid var\(--gold-dim\)' \}\}>\s*\n\s*<AlertCircle size=\{18\} style=\{\{ color: 'var\(--gold-dim\)'/,
    'the "plan yields nothing" alert\'s border and icon must both read --gold-dim',
  );
  assert.doesNotMatch(CROPPLAN, /'1px solid #C07A1E'/, 'no border may hard-code the ochre hex directly — route through --gold-dim');
});

test('the no-plan banner fill uses the ochre-fill-for-white-type value, not the 3.5:1 brand hex', () => {
  // CLAUDE.md: "Ochre is a FILL. ... an ochre fill under white type is #9A6018." The banner's
  // text is fixed white (#fff), so the fill itself stays a literal hex by design — but it must be
  // the correct, contrast-safe literal, not the plain brand #C07A1E (3.5:1 under white).
  assert.match(CROPPLAN, /background: '#9A6018', borderBottom: '1px solid rgba\(32,25,15,0\.15\)'/);
});

test('the two headings the audit found fixed at a single phone px now clamp for desktop', () => {
  assert.match(
    CROPPLAN,
    /fontSize: 'clamp\(15px, 1\.15vw, 17px\)', color: 'var\(--text-primary\)' \}\}>\s*\n\s*\{ui\('Your crop plan is not producing any jobs'/,
    'the "plan yields nothing" heading must use a responsive clamp()',
  );
  assert.match(
    CROPPLAN,
    /fontSize: 'clamp\(16px, 1\.2vw, 18px\)', color: 'var\(--text-primary\)' \}\}>\{monthNames\[m - 1\]\}/,
    'the season-view month-card heading must use a responsive clamp()',
  );
});
