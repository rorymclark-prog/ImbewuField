import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools (lib/app-level.ts) on the season crop plan (app/cropplan/page.tsx — the
// task planner, NOT app/facilitator/crops which already does Simple) and the farm-gate prices
// screen (app/prices/page.tsx). Source-text guard, same idiom as tests/cropplan-simple.test.ts:
// these pages cannot run under node:test, so the wiring is pinned against the real shipped files.

const CROPPLAN = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');
const PRICES = readFileSync(new URL('../app/prices/page.tsx', import.meta.url), 'utf8');
const PRICE_DETAIL = readFileSync(new URL('../components/prices/CropPriceGuide.tsx', import.meta.url), 'utf8');

// ── /cropplan ────────────────────────────────────────────────────────────────

test('cropplan reads the Simple / All tools level', () => {
  assert.match(CROPPLAN, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(CROPPLAN, /const simple = useAppLevel\(\) === 'simple';/);
});

test('cropplan hides the Season tab, the Learn link and the map-planner promo in Simple', () => {
  assert.match(CROPPLAN, /\{!simple && <LessonLink id="crops:planner"/);
  assert.match(CROPPLAN, /\{!simple && \(\s*<Link href="\/facilitator\/crops"/);
  assert.match(CROPPLAN, /\{!simple && \(\s*<div className="flex rounded-xl p-0\.5 gap-0\.5 mt-3 mb-5"/,
    'the Month\\/Season zoom-tab switcher must be All-tools only');
});

test('cropplan Simple always reads as Month, whatever view state was left over from All tools', () => {
  assert.match(CROPPLAN, /const effectiveView: View = simple \? 'month' : view;/);
  // Both view branches key off effectiveView, not the raw view state, so Simple can never render
  // the Season branch even if `view` was left on 'season' from an earlier All-tools session.
  assert.match(CROPPLAN, /\{effectiveView === 'month' && \(/);
  assert.match(CROPPLAN, /\{effectiveView === 'season' && \(/);
  assert.doesNotMatch(CROPPLAN, /\{view === 'season' && \(/);
});

test('cropplan keeps the sourced task list — "what to plant now/next" — unconditional in both modes', () => {
  const monthBlockStart = CROPPLAN.indexOf('{/* ── MONTH ── */}');
  const taskListBlock = CROPPLAN.slice(monthBlockStart, CROPPLAN.indexOf('<TaskList', monthBlockStart) + 200);
  assert.doesNotMatch(taskListBlock.slice(0, taskListBlock.indexOf('<TaskList')), /\{!?simple/,
    'the task list itself must not be gated on the Simple / All tools switch');
});

test('cropplan keeps one primary action — "Manage crops & beds" — present in both modes', () => {
  const footerLink = CROPPLAN.slice(CROPPLAN.indexOf('{/* Footer link */}'), CROPPLAN.indexOf('{/* Footer link */}') + 400);
  assert.match(footerLink, /<Link href="\/plan"/);
  assert.doesNotMatch(footerLink, /\{!?simple/, 'the primary action link must stay available in both modes');
});

// ── /prices ──────────────────────────────────────────────────────────────────

test('prices reads the Simple / All tools level', () => {
  assert.match(PRICES, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(PRICES, /const simple = useAppLevel\(\) === 'simple';/);
});

test('prices Simple shows the farmer\'s own crops, or a short common list, not the whole price book', () => {
  assert.match(PRICES, /const SIMPLE_COMMON_CROP_KEYS = \[/);
  assert.match(PRICES, /const simpleCrops = useMemo\(/);
  assert.match(PRICES, /const visibleCrops = simple && !showAllSimple \? simpleCrops : crops;/);
  assert.match(PRICES, /\{visibleCrops\.map\(\(crop\) => \(/,
    'the crop grid must render the Simple-filtered list, not the raw full list, when in Simple');
});

test('prices offers an "All crops" disclosure back to the full list without leaving Simple', () => {
  assert.match(PRICES, /\{simple && !showAllSimple && visibleCrops\.length < crops\.length && \(/);
  assert.match(PRICES, /onClick=\{\(\) => setShowAllSimple\(true\)\}/);
});

test('prices hides the Learn link in Simple but keeps the one pick control unconditional', () => {
  assert.match(PRICES, /\{!simple && <LessonLink id="prices:overview"/);
  // The tap-a-crop grid — the page's one pick control — must render in both modes; only which
  // crops are offered differs, not whether the control itself exists.
  const gridBlock = PRICES.slice(PRICES.indexOf('grid grid-cols-2'), PRICES.indexOf('{visibleCrops.map'));
  assert.doesNotMatch(gridBlock, /\{!?simple/);
});

test('the price detail screen keeps both wholesale and retail — the negotiation numbers — in Simple, and only drops the source/methodology footnote', () => {
  assert.match(PRICE_DETAIL, /simple = false \}: \{ crop: PricedCrop; onChangeCrop: \(\) => void; simple\?: boolean \}/);
  assert.match(PRICE_DETAIL, /\{!simple && \(\s*<div className="font-sans" style=\{\{ fontSize: 12, color: 'var\(--color-muted\)'/,
    'the "Priced <date>" methodology line must be gated on simple');
  assert.doesNotMatch(PRICE_DETAIL, /\{!?simple[^}]*&&[^}]*priceWholesale/,
    'the wholesale price card must stay visible in Simple — this is the negotiation screen\'s core number');
  assert.doesNotMatch(PRICE_DETAIL, /\{!?simple[^}]*&&[^}]*priceRetail/,
    'the retail price card must stay visible in Simple');
});
