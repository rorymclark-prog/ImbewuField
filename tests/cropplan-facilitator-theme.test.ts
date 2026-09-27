import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// app/facilitator/crops/page.tsx — the flagship bed-by-month planner — used to paint every
// surface, text colour and border with hard-coded light hex (#E4DCC6 page, #FFFEFA cards,
// #E2D8C4 hairlines, #20190F/#5C5040/#755942 ink), so it stayed a light page under the slate
// theme and under dark mode. It also set headings, the month-grid labels, bed names and the
// production-score number at a single fixed phone px with no responsive scaling, so desktop
// never got more than phone-sized type. This is a source-text guard, the same idiom as
// tests/cropplan-simple.test.ts: this page cannot run under node:test, so the wiring is pinned
// against the real shipped file rather than rendered.

const CROPS = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');

// The exact hard-coded hex values the audit found on this screen's generic chrome. None of
// these are the deliberately-fixed brand/CTA fills (--brand's own #1F4D2B, or a data-encoding
// crop-bar colour) — they are the page background, card, hairline and ink values that must
// follow the theme. A reappearance of any of these is the light-page-in-dark-mode bug back.
const RETIRED_HARDCODED_CHROME = [
  '#E4DCC6', // page / --bg-0
  '#FFFEFA', // card / --bg-1
  '#FBF6EC', // old card alt value, same surface
  '#F5F0E8', // inset / --bg-2
  '#EDE7DB', // inset / --bg-2
  '#E2D8C4', // hairline / --border
  '#20190F', // ink / --text-primary
  '#5C5040', // ink-muted / --text-secondary
  '#755942', // ink-faint / --text-muted
  '#9A6018', // ochre warning text / --gold
  '#A83A2C', // error text / --orange
];

test('the retired hard-coded chrome hex values do not reappear on the crop planner', () => {
  const found = RETIRED_HARDCODED_CHROME.filter((hex) => CROPS.includes(hex));
  assert.deepEqual(
    found, [],
    `${found.length} retired hard-coded colour(s) are back in app/facilitator/crops/page.tsx: `
      + `${found.join(', ')}. Use the matching theme token instead (see CLAUDE.md's palette table `
      + 'and "Don\'t hardcode a colour that has to follow the theme").',
  );
});

test('the page root, header and grid surfaces read the per-theme tokens', () => {
  assert.match(
    CROPS,
    /height: '100dvh', background: 'var\(--bg-0\)', color: 'var\(--text-primary\)' \}\}>/,
    'the page root must paint with --bg-0 / --text-primary, not a hard-coded light hex',
  );
  assert.match(
    CROPS,
    /height: 56, background: 'var\(--bg-1\)', borderBottom: '1px solid var\(--border\)' \}\}>/,
    'the header bar must read --bg-1 and --border',
  );
  assert.match(
    CROPS,
    /width: BED_LABEL_WIDTH, flexShrink: 0, background: bed\.kind === 'plot' \? 'var\(--bg-1\)' : 'var\(--bg-1\)', borderRight: '1px solid var\(--border\)'/,
    'each bed row\'s sticky label column must read --bg-1 / --border',
  );
});

test('the month-grid header labels, bed names, bed areas and the production-score number scale with clamp()', () => {
  assert.match(
    CROPS,
    /padding: '8px 2px', fontSize: 'clamp\(12px, 0\.85vw, 13px\)',/,
    'the bed×month grid\'s month-abbreviation header must use a responsive clamp(), not a fixed phone px',
  );
  assert.match(
    CROPS,
    /className="font-display font-semibold" style=\{\{ fontSize: 'clamp\(13px, 1vw, 15px\)', color: 'var\(--text-primary\)' \}\}>\s*\{bed\.label\}/,
    'the bed name in each row must use a responsive clamp()',
  );
  assert.match(
    CROPS,
    /className="font-mono" style=\{\{ fontSize: 'clamp\(11px, 0\.85vw, 12\.5px\)', color: 'var\(--text-muted\)' \}\}>\{bed\.areaM2\.toFixed\(1\)\} m²<\/div>/,
    'the bed area number must use a responsive clamp()',
  );
  assert.match(
    CROPS,
    /className="font-mono font-bold" style=\{\{ fontSize: 'clamp\(28px, 2\.4vw, 34px\)', color: '#F7F2E9' \}\}>/,
    'the production-score R\\/m² number must use a responsive clamp()',
  );
});

test('every section heading at the old fixed 15px now clamps for desktop', () => {
  // All eleven section headings ("Tasks", "Harvest total", "Seeds & seedlings", "Year ahead",
  // "Why this plan chose what it chose", "Food, field & value", "Growing organically", the
  // "Crop plan" header title in both its states, and two shared-component titles) shared one
  // exact style object before this fix. Pinning the count keeps a future heading from being
  // added back at a bare fixed size by copy-paste.
  const matches = [...CROPS.matchAll(/fontSize: 'clamp\(15px, 1\.15vw, (?:17|18)px\)', color: 'var\(--text-primary\)'/g)];
  assert.equal(
    matches.length, 11,
    `expected all 11 of the old fixed-15px section headings to carry a responsive clamp(), found ${matches.length}`,
  );
  // None of the old bare `fontSize: 15,` declarations should survive.
  assert.doesNotMatch(CROPS, /fontSize: 15,/, 'a heading reverted to a fixed 15px declaration');
});

test('the site-picker heading and the empty-beds heading are responsive too', () => {
  assert.match(
    CROPS,
    /<h1 className="font-display font-semibold" style=\{\{ fontSize: 'clamp\(19px, 1\.7vw, 23px\)', color: 'var\(--text-primary\)', letterSpacing: '-0\.01em' \}\}>/,
  );
  assert.match(
    CROPS,
    /className="font-display font-semibold mt-2" style=\{\{ fontSize: 'clamp\(18px, 1\.5vw, 21px\)', color: 'var\(--text-primary\)' \}\}>/,
  );
});
