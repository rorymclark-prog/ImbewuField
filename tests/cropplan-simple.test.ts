import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { placedTreeGroups, unidentifiedPlantGroups, type PlacedPlant } from '@/lib/perennial-harvest';
import { placedAnimalGroups } from '@/lib/animal-enterprises';

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
  // required to use the grid — so both renamed "All production plans" variants stay in both modes.
  const planSwitchAt = header.indexOf('All production plans');
  assert.ok(planSwitchAt >= 0, 'the Production plan rename must retain the site switch');
  assert.doesNotMatch(
    header.slice(planSwitchAt, planSwitchAt + 400),
    /simple/,
    'switching site/design must stay available in Simple',
  );
  // The bed/plot count chip, the Learn link and the climate-source technical badge are all
  // secondary technical detail — none of it is needed to use the grid.
  assert.match(header, /\{!simple && beds\.length > 0 && \(\s*<button\s*\n\s*onClick=\{\(\) => setShowBedCheck/);
  assert.match(header, /\{!simple && <LessonLink/);
  // Country support now also gates the badge: a technical climate label must not imply
  // local crop guidance where the catalogue is unavailable. Test the shipped gate,
  // rather than pinning the previous spelling of its Simple-only condition.
  const climateBadge = nodesMatching((node): node is ts.BinaryExpression => ts.isBinaryExpression(node)).find(node =>
    node.pos >= CROPS.indexOf('<header') && node.end <= CROPS.indexOf('</header>')
      && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && ts.isParenthesizedExpression(node.right) && ts.isConditionalExpression(node.right.expression)
      && node.right.expression.condition.getText(pageTree) === "climateSource === 'site'");
  assert.ok(climateBadge, 'the header must retain its site/reference climate badge');
  for (const simple of [true, false]) {
    for (const allowCataloguePlanning of [true, false]) {
      assert.equal(evaluate(climateBadge.left, { simple, allowCataloguePlanning }), !simple && allowCataloguePlanning,
        'climate details belong only in All tools with supported crop guidance');
    }
  }
});

// Catalogue controls now use the selected legacy subset. A raw-book variable
// spelling and a 400-character prop window mistook preservation changes for
// missing controls. Evaluate the real mode guards and props instead.
function openingAttribute(node: ts.JsxOpeningElement | ts.JsxSelfClosingElement, name: string): ts.Expression {
  const attr = node.attributes.properties.find(value => ts.isJsxAttribute(value) && value.name.getText(pageTree) === name);
  assert.ok(attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer) && attr.initializer.expression);
  return attr.initializer.expression;
}
function actionButton(handler: string): ts.JsxElement {
  const button = nodesMatching((node): node is ts.JsxElement => ts.isJsxElement(node)).find(node =>
    node.openingElement.tagName.getText(pageTree) === 'button' && node.openingElement.attributes.properties.some(value =>
      ts.isJsxAttribute(value) && value.name.getText(pageTree) === 'onClick'
        && value.initializer && ts.isJsxExpression(value.initializer) && value.initializer.expression?.getText(pageTree) === handler));
  assert.ok(button, 'the real action control must remain present: ' + handler);
  return button;
}
function modeAllows(node: ts.Node, values: Record<string, unknown>): boolean {
  const within = (container: ts.Node) => container.pos <= node.pos && container.end >= node.end;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      && within(parent.right) && /\bsimple\b/.test(parent.left.getText(pageTree)) && !evaluate(parent.left, values)) return false;
    if (ts.isConditionalExpression(parent) && /\bsimple\b/.test(parent.condition.getText(pageTree))) {
      if (within(parent.whenTrue) && !evaluate(parent.condition, values)) return false;
      if (within(parent.whenFalse) && evaluate(parent.condition, values)) return false;
    }
  }
  return true;
}

test('Simple retains auto-suggest and hides catalogue Undo/Clear without exposing own records to clearing', () => {
  const auto = actionButton('openAutoSuggest'), undo = actionButton('undoLastChange');
  const clear = actionButton('() => setConfirmingClear(true)'), confirm = actionButton('clearAllPlantings');
  for (const simple of [true, false]) {
    const values = { simple, confirmingClear: false, planHistory: [{}], legacyPlantings: [{}], plantings: [{}] };
    assert.equal(modeAllows(auto, values), true, 'the primary action remains visible in both modes');
    assert.equal(modeAllows(undo, values), !simple, 'Undo belongs to All tools');
    assert.equal(modeAllows(clear, values), !simple, 'Clear belongs to All tools');
    assert.equal(modeAllows(confirm, { ...values, confirmingClear: true }), !simple, 'confirmation cannot leak into Simple');
    assert.equal(modeAllows(clear, { ...values, legacyPlantings: [] }), false, 'own-only raw rows do not expose catalogue Clear');
    assert.equal(modeAllows(confirm, { ...values, confirmingClear: true, legacyPlantings: [] }), false, 'own-only rows cannot enter catalogue clear confirmation');
    assert.equal(modeAllows(undo, { ...values, planHistory: [] }), false, 'an empty history cannot offer Undo');
  }
});

test('the actual bed grid renders in both modes and passes Simple to rows regardless of attribute length', () => {
  const row = nodesMatching((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node))
    .find(node => node.tagName.getText(pageTree) === 'BedRow');
  assert.ok(row);
  let grid: ts.Node | undefined = row.parent;
  while (grid && !(ts.isJsxElement(grid) && grid.openingElement.attributes.properties.some(value =>
    ts.isJsxAttribute(value) && value.name.getText(pageTree) === 'className'
      && value.initializer && ts.isStringLiteral(value.initializer) && value.initializer.text === 'rounded-2xl mb-5'))) grid = grid.parent;
  assert.ok(grid, 'the shared measured-bed grid must remain');
  for (const simple of [true, false]) {
    assert.equal(modeAllows(grid, { simple }), true, 'a mode switch cannot remove the grid');
    assert.equal(evaluate(openingAttribute(row, 'simple'), { simple }), simple, 'each row receives the actual mode');
  }
  assert.equal(openingAttribute(row, 'key').getText(pageTree), 'bed.id');
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

// Exercise the shipped JSX gate rather than a copied predicate. The page needs Next's
// browser providers; its actual branch conditions can still fail under node:test.
const pageTree = ts.createSourceFile('crops/page.tsx', CROPS, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nodesMatching<T extends ts.Node>(predicate: (node: ts.Node) => node is T): T[] {
  const found: T[] = [];
  const walk = (node: ts.Node) => { if (predicate(node)) found.push(node); ts.forEachChild(node, walk); };
  walk(pageTree);
  return found;
}
const jsxNodes = nodesMatching((node): node is ts.JsxSelfClosingElement => ts.isJsxSelfClosingElement(node));
const emptyNode = jsxNodes.find(node => node.tagName.getText(pageTree) === 'EmptyState');
assert.ok(emptyNode, 'the truly empty map must retain its existing help');
let emptyBranch: ts.Node | undefined = emptyNode.parent;
while (emptyBranch && !ts.isConditionalExpression(emptyBranch)) emptyBranch = emptyBranch.parent;
assert.ok(emptyBranch && ts.isConditionalExpression(emptyBranch), 'find the actual EmptyState selection');
const productionBranch = emptyBranch.whenFalse;

function evaluate(expression: ts.Expression, values: Record<string, unknown>): boolean {
  return Boolean(new Function(...Object.keys(values), `return (${expression.getText(pageTree)});`)(...Object.values(values)));
}

const productionOnlyCases: Array<[string, PlacedPlant[]]> = [
  ['an orchard with unconfirmed picking months', [{ defId: 'tree_avocado' }]],
  ['a coop and hive with unknown purposes or production dates', [{ defId: 'chicken_coop' }, { defId: 'beehive' }]],
  ['an unresolved proposed Banana Circle', [{ defId: 'banana_circle', status: 'proposed' as const }]],
  ['a known food species without a harvest dossier', [{ defId: 'tree_other', speciesId: 'olea-europaea-subsp-europaea' }]],
];
for (const [name, items] of productionOnlyCases) {
  test(`${name} opens production confirmation and export without inventing a crop bed`, () => {
    const before = structuredClone(items);
    const values = { beds: [], canvasTrees: placedTreeGroups(items), unidentifiedPlants: unidentifiedPlantGroups(items), canvasAnimals: placedAnimalGroups(items) };
    assert.equal(evaluate(emptyBranch.condition, values), false,
      'no crop beds must not erase food-source or housing inventory');
    assert.deepEqual(values.beds, [], 'the gate must not inject a virtual bed');
    assert.deepEqual(items, before, 'reading mapped sources must leave saved items unchanged');
    for (const simple of [true, false]) {
      for (const card of ['TreeSeasonsCard', 'AnimalEnterprisesCard', 'CropPlanExportCard']) {
        const visible = jsxNodes.filter(node => node.tagName.getText(pageTree) === card && node.pos >= productionBranch.pos && node.end <= productionBranch.end)
          .some(node => {
            const conditions: ts.Expression[] = [];
            let ancestor: ts.Node | undefined = node.parent;
            while (ancestor && ancestor !== productionBranch) {
              if (ts.isBinaryExpression(ancestor) && ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
                && node.pos >= ancestor.right.pos && node.end <= ancestor.right.end) conditions.push(ancestor.left);
              ancestor = ancestor.parent;
            }
            return conditions.every(condition => evaluate(condition, { ...values, simple }));
          });
        assert.ok(visible, `${card} must be reachable in ${simple ? 'Simple' : 'All tools'} mode`);
      }
    }
  });
}

test('a genuinely empty map retains the empty-state help and an existing bed still opens its crop plan', () => {
  const values = { beds: [], canvasTrees: [], unidentifiedPlants: [], canvasAnimals: [] };
  assert.equal(evaluate(emptyBranch.condition, values), true);
  assert.equal(evaluate(emptyBranch.condition, { ...values, beds: [{ id: 'bed' }] }), false);
});

test('a production-only map cannot open generate or accept a bed auto-suggestion', () => {
  const button = nodesMatching((node): node is ts.JsxElement => ts.isJsxElement(node)).find(node =>
    node.openingElement.tagName.getText(pageTree) === 'button'
      && node.openingElement.attributes.properties.some(attribute => ts.isJsxAttribute(attribute)
        && attribute.name.getText(pageTree) === 'onClick' && attribute.initializer?.getText(pageTree) === '{openAutoSuggest}'));
  assert.ok(button);
  const disabled = button.openingElement.attributes.properties.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(pageTree) === 'disabled');
  assert.ok(disabled && ts.isJsxAttribute(disabled) && disabled.initializer && ts.isJsxExpression(disabled.initializer) && disabled.initializer.expression);
  for (const beds of [[], [{}]]) {
    for (const hasOwnRecords of [true, false]) {
      assert.equal(evaluate(disabled.initializer.expression, { beds, hasOwnRecords }), beds.length === 0 || hasOwnRecords,
        'catalogue auto-suggestion needs real beds and must retain own dated reservations');
    }
  }
  assert.match(CROPS, /Your mapped plants and animal housing are listed below/);
  assert.match(CROPS, /autoPhase !== 'idle' && beds\.length > 0 &&/,
    'removing the last bed while the modal is open must hide its stale bed-planning actions');
  for (const name of ['openAutoSuggest', 'runAutoSuggest', 'acceptAutoSuggest']) {
    const handler = nodesMatching((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node)).find(node => node.name?.text === name);
    assert.ok(handler?.body);
    const calls: string[] = [];
    const source = ts.transpileModule(`function check() ${handler.body.getText(pageTree)}; check();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const setters = [...new Set(handler.body.getText(pageTree).match(/\bset[A-Z]\w+|\bpushPlanHistory|\bapplyGoalMix/g) ?? [])];
    // Keep every other precondition satisfied so the no-bed check must do the work.
    // Also check the new country guard independently: either missing precondition
    // must stop the actual handler before any state setter or plan-history write.
    for (const scenario of [
      { beds: [], allowed: true, reason: 'no beds' },
      { beds: [{}], allowed: false, reason: 'unsupported crop guidance' },
      { beds: [{}], allowed: true, own: true, reason: 'own dated reservations' },
    ]) {
      calls.length = 0;
      const values = {
        beds: scenario.beds,
        hasOwnRecords: scenario.own ?? false,
        currentPlanningScopeAllowed: () => scenario.allowed,
        suggestionScopeRef: { current: 'same-reviewed-scope' },
        planningScopeKey: 'same-reviewed-scope',
        autoResult: { plantings: [] },
        ...Object.fromEntries(setters.map(setter => [setter, () => calls.push(setter)])),
      };
      new Function(...Object.keys(values), source)(...Object.values(values));
      assert.deepEqual(calls, [], `${name} must stop before changing a crop plan with ${scenario.reason}`);
    }
  }
});
