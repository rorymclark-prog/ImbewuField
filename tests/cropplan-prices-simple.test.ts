import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

// Simple / All tools (lib/app-level.ts) on the season crop plan (app/cropplan/page.tsx — the
// task planner, NOT app/facilitator/crops which already does Simple) and the farm-gate prices
// screen (app/prices/page.tsx). Source guards and evaluation of the shipped task-page
// conditions preserve Simple behavior when additional safety requirements are added.

const CROPPLAN = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');
const PRICES = readFileSync(new URL('../app/prices/page.tsx', import.meta.url), 'utf8');
const PRICE_DETAIL = readFileSync(new URL('../components/prices/CropPriceGuide.tsx', import.meta.url), 'utf8');

const taskPage = ts.createSourceFile('cropplan/page.tsx', CROPPLAN, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function findTaskNode<T extends ts.Node>(predicate: (node: ts.Node) => node is T): T {
  let found: T | undefined;
  const visit = (node: ts.Node) => {
    if (!found && predicate(node)) found = node;
    ts.forEachChild(node, visit);
  };
  visit(taskPage);
  assert.ok(found, 'the shipped task-planner control must exist before testing its conditions');
  return found;
}
function evaluateTask(expression: ts.Expression, values: Record<string, unknown>): unknown {
  return new Function(...Object.keys(values), `return (${expression.getText(taskPage)});`)(...Object.values(values));
}

// ── /cropplan ────────────────────────────────────────────────────────────────

test('cropplan reads the Simple / All tools level', () => {
  assert.match(CROPPLAN, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(CROPPLAN, /const simple = useAppLevel\(\) === 'simple';/);
});

test('cropplan hides the Season tab, the Learn link and the map-planner promo in Simple', () => {
  assert.match(CROPPLAN, /\{!simple && <LessonLink id="crops:planner"/);
  assert.match(CROPPLAN, /\{!simple && \(\s*<Link href="\/facilitator\/crops"/);
  const tabs = findTaskNode((node): node is ts.JsxElement => ts.isJsxElement(node)
    && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
      && attribute.name.getText(taskPage) === 'className' && attribute.initializer
      && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === 'flex rounded-xl p-0.5 gap-0.5 mt-3 mb-5'));
  const conditions: ts.Expression[] = [];
  for (let ancestor: ts.Node | undefined = tabs.parent; ancestor; ancestor = ancestor.parent) {
    if (ts.isBinaryExpression(ancestor) && ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && tabs.pos >= ancestor.right.pos && tabs.end <= ancestor.right.end) conditions.push(ancestor.left);
  }
  assert.ok(conditions.length > 0, 'the actual tab switcher must have a visibility guard');
  // The original exact !simple wrapper pin rejected the additional country
  // protection. Execute the shipped guards: Simple stays hidden, while All
  // tools exposes the SA Season reference only with a supported basis.
  for (const simple of [true, false]) for (const year of [null, {hasPlanningBasis:false}, {hasPlanningBasis:true}]) {
    const visible = conditions.every(condition => evaluateTask(condition, { simple, year }));
    assert.equal(visible, !simple && Boolean(year?.hasPlanningBasis), `Simple=${simple}, supported=${year?.hasPlanningBasis ?? 'loading'}`);
  }
});

test('cropplan Simple always reads as Month, whatever view state was left over from All tools', () => {
  const effective = findTaskNode((node): node is ts.VariableDeclaration => ts.isVariableDeclaration(node)
    && ts.isIdentifier(node.name) && node.name.text === 'effectiveView');
  assert.ok(effective.initializer);
  // Additional safety conditions may restrict Season; they must never weaken
  // the original promise that switching back to Simple always reads as Month.
  for (const simple of [true, false]) for (const year of [null, {hasPlanningBasis:false}, {hasPlanningBasis:true}]) {
    for (const view of ['month','season']) {
      assert.equal(evaluateTask(effective.initializer, {simple, year, view}),
        simple || !year?.hasPlanningBasis ? 'month' : view,
        `Simple=${simple}, supported=${year?.hasPlanningBasis ?? 'loading'}, previous=${view}`);
    }
  }
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
