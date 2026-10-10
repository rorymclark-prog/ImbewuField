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

test('every converted file actually uses the new --on-forest token, not just a bare removal', () => {
  for (const relativePath of RELATIVE_PATHS) {
    const src = readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
    assert.match(src, /var\(--on-forest\)/,
      `${relativePath} should use var(--on-forest) at least once — it was one of the files converted`);
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
