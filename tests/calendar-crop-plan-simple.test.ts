import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// /calendar's "filtered to your planned crops" feature (verified bug, swarm/calendar-print track).
//
// The page used to read 'imbewu_planner_crops' from localStorage — a key app/survey/page.tsx also
// only ever READ and nothing in the app ever WROTE, so the filter could never once have matched
// anything: myPlannerCrops was permanently []. The fix reads the farmer's REAL plan via
// lib/crop-plan.ts's loadCropPlan(), the same store the crop planner writes to, and falls back to
// the general list — labelled, not silent — when there is no plan.
//
// This file also pins the Simple / All tools wiring this track added: the current month's
// Plant/Harvest/Maintain card follows the real plan in Simple, and the 12-month reference grid is
// hidden behind "See the whole year" in Simple only — All tools is unchanged.

const PAGE = readFileSync(join(process.cwd(), 'app', 'calendar', 'page.tsx'), 'utf8');

test('the calendar reads the real crop plan, not the dead planner-crops key', () => {
  // The old key may still be named in a comment explaining the fix; it must never again be the
  // string actually passed to localStorage.getItem.
  assert.doesNotMatch(
    PAGE, /localStorage\.getItem\([^)]*imbewu_planner_crops/,
    'the orphaned localStorage key must not come back — nothing in the app ever wrote to it',
  );
  assert.match(
    PAGE, /import \{ loadCropPlan \} from '@\/lib\/crop-plan';/,
    'the calendar must read the same crop-plan store the planner writes to',
  );
  assert.match(
    PAGE, /const plan = loadCropPlan\(\);/,
    'the filter must be built from a real loadCropPlan() call, not a mirrored/hand-typed list',
  );
});

test('the filter matches plantings by their catalog key, not by crop name', () => {
  // Planting.cropKey (lib/crop-plan.ts) and CROPS[].catalogKey (this page) are both the crop
  // catalog's own keys (e.g. 'tomatoes', 'sweet-potato') — a direct Set lookup, never a
  // name-normalising string comparison that could drift from the catalog's own spelling.
  assert.match(
    PAGE, /plannedCropKeys\.has\(c\.catalogKey\)/,
    'visibleCrops must filter CROPS by matching planting cropKey against catalogKey',
  );
});

test('"Show all" overrides the view without mutating the real plan', () => {
  // The old code cleared its own local mirror (setMyPlannerCrops([])), which was safe only
  // because that mirror was never real data. Now that the source is the real plan, "Show all"
  // must not call anything that writes back to it.
  assert.doesNotMatch(
    PAGE, /setMyPlannerCrops/,
    'the old local-mirror setter must be gone',
  );
  assert.match(
    PAGE, /setShowAllOverride\(true\)/,
    '"Show all" must flip a view-only override, not touch the crop plan',
  );
});

test('a farmer with no plan at all sees a clearly labelled fallback, not silence', () => {
  assert.match(
    PAGE, /\{!hasPlan && \(/,
    'the no-plan case must be handled explicitly',
  );
  assert.match(
    PAGE, /Showing the general planting guide/,
    'the fallback must say in plain words that this is the general guide, not the farmer\'s own plan',
  );
});

test('Simple reads the Simple / All tools switch and follows it on this page', () => {
  assert.match(
    PAGE, /import \{ useAppLevel \} from '@\/lib\/app-level';/,
    'the calendar must import the shared Simple / All tools hook',
  );
  assert.match(
    PAGE, /const simple = useAppLevel\(\) === 'simple';/,
    'the calendar must read the level the same way other Simple-aware screens do',
  );
});

test('Simple\'s "what to do" card follows the real plan when there is one', () => {
  assert.match(
    PAGE, /const cardPlant = simple \? simplePlant : monthData\.plant;/,
    'Simple must be able to show a plan-filtered plant list distinct from All tools\' general one',
  );
  assert.match(
    PAGE, /const cardHarvest = simple \? simpleHarvest : monthData\.harvest;/,
    'Simple must be able to show a plan-filtered harvest list distinct from All tools\' general one',
  );
  assert.match(
    PAGE, /cardPlant\.map\(\(crop\) =>/,
    'the Plant section must render from the Simple-aware cardPlant list',
  );
  assert.match(
    PAGE, /cardHarvest\.map\(\(crop\) =>/,
    'the Harvest section must render from the Simple-aware cardHarvest list',
  );
});

test('Simple hides the 12-month grid behind "See the whole year"; All tools always shows it', () => {
  assert.match(
    PAGE, /\{simple && !showYear \? \(/,
    'the grid must be gated on the Simple / All tools switch, not always rendered',
  );
  assert.match(
    PAGE, /See the whole year/,
    'Simple needs a named way back to the full grid',
  );
  assert.match(
    PAGE, /onClick=\{\(\) => setShowYear\(true\)\}/,
    'tapping the disclosure must reveal the same grid All tools shows, not a separate one',
  );
});

test('the month-plan card and the grid no longer hardcode the brand accents CLAUDE.md reserves for theme tokens', () => {
  const hardcoded = [...PAGE.matchAll(/color:\s*'(#[0-9A-Fa-f]{6})'/g), ...PAGE.matchAll(/(?:background|border)(?:Color)?:\s*'[^']*(#[0-9A-Fa-f]{6})/g)];
  assert.deepEqual(
    hardcoded.map((m) => m[1]),
    [],
    `hardcoded brand hex accents found: ${hardcoded.map((m) => m[1]).join(', ')} — use the theme tokens (--color-forest-800, --gold, --gold-dim, --blue, --border, --brand-soft, --color-canvas) instead`,
  );
});
