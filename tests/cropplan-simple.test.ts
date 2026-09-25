import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools on the crop planner (lib/app-level.ts). Rory: "the crop plan screen and
// those graphs are particularly challenging … intimidating … would be nice to have simplified
// drastically for the simple farmer, but the actual crop plan in the calendar months I am not
// sure should be simplified further" — so the bed×month grid renders identically in both modes;
// Simple strips what is layered on and around it. Source-text guard, same idiom as
// tests/home-next-step-links.test.ts and tests/crop-plan-page-ux.test.ts: this page cannot run
// under node:test, so the wiring is pinned against the real shipped file.

const CROPS = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');

test('the crops page reads the Simple / All tools level', () => {
  assert.match(CROPS, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(CROPS, /const simple = useAppLevel\(\) === 'simple';/);
});

test('Simple drops the secondary header chips but keeps site/bed picking and the back controls', () => {
  const header = CROPS.slice(CROPS.indexOf('<header'), CROPS.indexOf('</header>'));
  // The back-navigation contract (tests/crops-ui-dead-controls.test.ts) must survive untouched.
  assert.match(header, /^<header[^>]*>\s*<RegisterInFlowBack \/>/);
  // "Back to design" is a secondary chip, gone in Simple.
  assert.match(header, /\{!simple && \(\s*<Link\s*\n\s*href=\{designHref\}/, '"Back to design" must be hidden in Simple');
  // Switching between a farmer's saved designs is how they pick which site's plan they see —
  // required to use the grid — so both "All crop plans" variants stay in both modes.
  assert.doesNotMatch(
    header.slice(header.indexOf('All crop plans'), header.indexOf('All crop plans') + 400),
    /simple/,
    'switching site/design must stay available in Simple',
  );
  // The bed/plot count chip, the Learn link and the climate-source technical badge are all
  // secondary technical detail — none of it is needed to use the grid.
  assert.match(header, /\{!simple && beds\.length > 0 && \(\s*<button\s*\n\s*onClick=\{\(\) => setShowBedCheck/);
  assert.match(header, /\{!simple && <LessonLink/);
  assert.match(header, /\{!simple && \(climateSource === 'site' \? \(/);
});

test('Simple keeps auto-suggest as the one primary action above the grid and drops Undo/Clear all', () => {
  const gridStart = CROPS.indexOf("className=\"rounded-2xl mb-5\"");
  const actionRow = CROPS.slice(CROPS.indexOf('{!simple && confirmingClear && plantings.length > 0'), gridStart);
  assert.match(actionRow, /\{!simple && confirmingClear && plantings\.length > 0 \? \(/);
  assert.match(actionRow, /onClick=\{openAutoSuggest\}/);
  // Auto-suggest itself is never gated on `simple` — the same button both modes reuse.
  const autoSuggestBlock = actionRow.slice(actionRow.indexOf('onClick={openAutoSuggest}') - 40, actionRow.indexOf('onClick={openAutoSuggest}'));
  assert.doesNotMatch(autoSuggestBlock, /!simple/, 'Auto-suggest must stay a Simple-mode primary action, not gated off');
  assert.match(actionRow, /\{!simple && planHistory\.length > 0 && \(\s*<button\s*\n\s*onClick=\{undoLastChange\}/);
  assert.match(actionRow, /\{!simple && plantings\.length > 0 && \(\s*<button\s*\n\s*onClick=\{\(\) => setConfirmingClear\(true\)\}/);
});

test('the bed×month grid itself renders unconditionally in both modes and threads simple down to it', () => {
  const gridStart = CROPS.indexOf("className=\"rounded-2xl mb-5\"");
  const gridBlock = CROPS.slice(gridStart, CROPS.indexOf('<BedRow', gridStart) + 400);
  assert.doesNotMatch(
    CROPS.slice(gridStart - 30, gridStart),
    /\{!?simple/,
    'the grid container itself must not be gated on the Simple / All tools switch',
  );
  assert.match(gridBlock, /<BedRow\s*\n\s*key=\{bed\.id\}/);
  assert.match(CROPS.slice(CROPS.indexOf('<BedRow'), CROPS.indexOf('<BedRow') + 400), /simple=\{simple\}/);
});

test('Simple adds one "Add a crop" action below the grid, reusing the existing add flow', () => {
  const gridEnd = CROPS.indexOf('{/* Simple mode: the grid is the screen.');
  assert.ok(gridEnd > 0, 'the Simple add-crop block must sit directly after the grid');
  const addBlock = CROPS.slice(gridEnd, gridEnd + 1000);
  assert.match(addBlock, /\{simple && beds\.length > 0 && \(/);
  // Reuses openPicker — the same function each bed's own "+ crop" button calls — not a new flow.
  assert.match(addBlock, /onClick=\{\(\) => openPicker\(beds\[0\]\.id\)\}/);
  assert.match(addBlock, /Add a crop/);
});

test('Simple hides every long section below the grid; All tools keeps them all', () => {
  const belowGrid = CROPS.slice(
    CROPS.indexOf('{!simple && (\n            <>'),
    CROPS.indexOf('Planning guide only — sow windows are general.') + 200,
  );
  assert.ok(belowGrid.length > 0);
  for (const marker of [
    '<FoodAvailabilityChart',
    '<CropPlanExportCard',
    'Seeds &amp; seedlings',
    '<DisclosureCard',
    '<RotationExplanationCard',
    '<OrganicGuideCard',
    'Planning guide only',
  ]) {
    assert.ok(belowGrid.includes(marker), `"${marker}" must still be inside the All-tools-only block`);
  }
});

test('Simple hides the fraction percentage and the transplant chip on the crop bars', () => {
  const barBlock = CROPS.slice(CROPS.indexOf('function PlantingBar('), CROPS.indexOf('function CropPickerModal('));
  assert.match(barBlock, /\{crop\.name\}\{!simple && fLabel \? ` \(\$\{fLabel\}\)` : ''\}/);
  // The exact condition tests/crop-plan-page-ux.test.ts pins must survive untouched, just gated.
  assert.match(barBlock, /\{!simple && crop\.transplant && \(!planting\.existing \|\| planting\.inNursery\) && instances\.map/);
});

test('Simple hides unlabelled food-group icons on a multi-crop bed but keeps a single labelled one', () => {
  const bedRow = CROPS.slice(CROPS.indexOf('function BedRow('), CROPS.indexOf('function PlantingBar('));
  assert.match(bedRow, /simple: boolean;/);
  assert.match(bedRow, /\{bedGroups\.length > 0 && \(!simple \|\| bedGroups\.length === 1\) && \(/);
});
