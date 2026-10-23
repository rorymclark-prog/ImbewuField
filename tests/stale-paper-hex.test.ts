import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// Last audit leftovers (swarm/w10-audit-leftovers, task 2).
//
// CLAUDE.md retired the paper hex '#F7F2E9' in favour of --color-paper (#E4DCC6) / --color-card
// (#FFFEFA), but it was still hand-copied ~65 times outside the crop files — almost always as
// light text (or a light border) on a forest fill ('#1F4D2B' background + '#F7F2E9' text), a
// pairing that never followed the theme. Converted to a new --on-forest token (declared per theme
// column in app/globals.css, same value in all four — see the token's own comment there), with
// the adjacent literal forest-fill backgrounds swapped to the existing --color-forest-800 token
// where they sat right next to it.
//
// This is a flat text scan, same shape as tests/theme-leftovers.test.ts for the previous wave's
// conversion — it guards the regression (the stale hex creeping back into a converted file), not
// contrast or rendering.
//
// Deliberately NOT covered here (left as the task named them):
//  - app/facilitator/crops/page.tsx, app/cropplan/page.tsx, components/crop*/, lib/crop*/ — a
//    different team is actively changing the crop/production planner.
//  - app/global-error.tsx — renders its own <html>/<body> outside the root layout and does not
//    load app/globals.css (no <link> to it, and nothing else in the file reads a CSS variable),
//    so a var(--on-forest) there would resolve to nothing. Left on the literal hex.

const RELATIVE_PATHS = [
  'app/account/page.tsx',
  'app/community/messages/[threadId]/page.tsx',
  'app/community/u/[uid]/page.tsx',
  'app/home/page.tsx',
  'app/mentor/page.tsx',
  'app/network/page.tsx',
  'app/ngo/page.tsx',
  'app/not-found.tsx',
  'app/student/page.tsx',
  'app/vision/page.tsx',
  'components/ChatPanel.tsx',
  'components/ContactInbox.tsx',
  'components/DataPanel.tsx',
  'components/LimaBar.tsx',
  'components/Map.tsx',
  'components/NextStepCoach.tsx',
  'components/PhotoUpload.tsx',
  'components/ProfileSheet.tsx',
  'components/ReportView.tsx',
  'components/SiteManageMenu.tsx',
  'components/atlas/AtlasExplorer.tsx',
  'components/community/NearbyMap.tsx',
  'components/exchange/ExchangeBoard.tsx',
  'components/exchange/ExchangeGuide.tsx',
  'components/exchange/NewListingForm.tsx',
  'components/funder/CohortDashboard.tsx',
  'components/home/HomeHeroCard.tsx',
  'components/network/NetworkMap.tsx',
  'components/prices/CropPriceGuide.tsx',
];

for (const relativePath of RELATIVE_PATHS) {
  test(`${relativePath} does not reintroduce the stale paper hex '#F7F2E9'`, () => {
    const src = readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(src, /#F7F2E9/i,
      `${relativePath} was converted to var(--on-forest) in the last-audit-leftovers pass — ` +
        'use that token (declared in app/globals.css) instead of the literal hex.');
  });
}

// code-05 (2026-10-16 visual/UX audit): CLAUDE.md retired '#FBF6EC' too — it was the stale Card
// value before DESIGN.md's "Option 1b contrast" decision chose #FFFEFA (now var(--bg-1)) — and
// app/account/page.tsx still had it hard-copied as a border colour, which stayed a bright-paper
// ring around the avatar's camera button regardless of theme/mode. Scoped to the one file this
// track fixed, not the whole RELATIVE_PATHS list above (those were never audited for this hex).
test("app/account/page.tsx does not reintroduce the stale card hex '#FBF6EC'", () => {
  const src = readFileSync(fileURLToPath(new URL('../app/account/page.tsx', import.meta.url)), 'utf8');
  assert.doesNotMatch(src, /#FBF6EC/i,
    "use var(--bg-1) (today's Card value) instead of the retired literal hex.");
});

test('every converted file actually uses the new --on-forest token, not just a bare removal', () => {
  for (const relativePath of RELATIVE_PATHS) {
    const src = readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
    // --on-forest-800 is the same cream token's dark-safe twin (text on a forest-800 fill); wave 17
    // moved every /student use onto it, which still counts as converted rather than a bare removal.
    assert.match(src, /var\(--on-forest(-800)?\)/,
      `${relativePath} should use var(--on-forest) or var(--on-forest-800) at least once — it was one of the files converted`);
  }
});

test('--on-forest is declared in all four theme columns of app/globals.css', () => {
  const css = readFileSync(fileURLToPath(new URL('../app/globals.css', import.meta.url)), 'utf8');
  const columns = [
    'html[data-theme="earth"] {',
    'html[data-theme="earth"].dark {',
    'html[data-theme="slate"] {',
    'html[data-theme="slate"].dark {',
  ];
  for (const column of columns) {
    const start = css.indexOf(column);
    assert.ok(start >= 0, `could not find column ${column}`);
    const end = css.indexOf('\n}', start);
    const block = css.slice(start, end);
    assert.match(block, /--on-forest:\s*#F7F2E9;/,
      `${column} must declare --on-forest with today's earth-light value`);
  }
});

test('the crop-planner files this track must not touch are left on the literal hex', () => {
  // Another team is actively changing these — the track brief says to skip them.
  const skipped = [
    'app/facilitator/crops/page.tsx',
    'app/cropplan/page.tsx',
  ];
  for (const relativePath of skipped) {
    const src = readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
    assert.match(src, /#F7F2E9/,
      `${relativePath} is expected to still carry the literal hex — it is out of scope for this track`);
  }
});

test('app/global-error.tsx is left untouched — it renders outside the normal layout', () => {
  const src = readFileSync(fileURLToPath(new URL('../app/global-error.tsx', import.meta.url)), 'utf8');
  assert.match(src, /#F7F2E9/, 'app/global-error.tsx does not load app/globals.css, so it keeps the literal hex');
  assert.doesNotMatch(src, /globals\.css/, 'confirms this file never imports the stylesheet --on-forest lives in');
});

// code-03 (wave 13, swarm/w13-farmer-dark): page roots, sticky headers and dividers used literal
// paper/hairline/ink hex instead of theme tokens, so in dark mode these pages kept a cream header
// bar or light page body under a dark tab bar. This track owns app/atlas/page.tsx,
// app/updates/page.tsx and app/journal/page.tsx (vision/invoice/account belong to other tracks —
// not covered here).
const CODE_03_STALE_HEXES = [/#E4DCC6/i, /#E2D8C4/i, /#FFFEFA/i, /#20190F/i, /#5C5040/i, /#755942/i, /#1F4D2B/i];
const CODE_03_OWNED_PATHS = [
  'app/updates/page.tsx',
  'app/atlas/page.tsx',
  'app/journal/page.tsx',
];

for (const relativePath of CODE_03_OWNED_PATHS) {
  test(`${relativePath} does not paint its page root/header/dividers with literal paper/ink hex (code-03)`, () => {
    const src = readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
    for (const hex of CODE_03_STALE_HEXES) {
      assert.doesNotMatch(src, hex,
        `${relativePath} should use a theme token (var(--bg-0)/var(--border)/var(--text-primary)/var(--color-forest-800) etc) instead of ${hex} so it follows dark mode`);
    }
  });
}

// code-07 (wave 13, swarm/w13-farmer-dark): Tailwind palette classes like `text-stone-600` are
// fixed colours that do not move with the theme, so they go unreadable in dark mode on a themed
// surface. This track owns components/HarvestReconciliation.tsx, components/IsiZuluDraftSource.tsx
// and components/DataPanel.tsx — converted to `text-[var(--text-muted)]`. app/records/page.tsx,
// app/calendar/page.tsx and components/Map.tsx/app/farmer/page.tsx belong to other tracks (full
// guard for those lives in tests/theme-leftovers.test.ts, not owned by this track).
const CODE_07_OWNED_PATHS = [
  'components/HarvestReconciliation.tsx',
  'components/IsiZuluDraftSource.tsx',
  'components/DataPanel.tsx',
];
const CODE_07_PALETTE_CLASS = /\b(?:text|bg|border)-(?:stone|gray|neutral|zinc|slate|red|white)-?\d*/;

for (const relativePath of CODE_07_OWNED_PATHS) {
  test(`${relativePath} does not reintroduce a fixed Tailwind palette class on a themed surface (code-07)`, () => {
    const src = readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(src, CODE_07_PALETTE_CLASS,
      `${relativePath} should use a theme token (e.g. text-[var(--text-muted)]) instead of a fixed Tailwind palette colour`);
  });
}
