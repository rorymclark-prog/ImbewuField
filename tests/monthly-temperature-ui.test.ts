import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { type ReactElement } from 'react';
import ts from 'typescript';
import { monthlyTemperatureStatus } from '../lib/climate-temperature.ts';

// Execute the actual new notice, calendar condition and climate-entry guard.
// The unchanged climate calculator tail is a boundary; this is not browser QA
// or an agronomic validation of the old calendar thresholds.
const source = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('DataPanel.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let statusDeclaration = '', noticeDeclaration = '', noticeElement = '', climateGuard = '';
function has(node: ts.Node, text: string): boolean {
  if (ts.isStringLiteral(node) && node.text === text) return true;
  return ts.forEachChild(node, child => has(child, text) || undefined) === true;
}
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    if (node.name.getText(ast) === 'temperatureStatus') statusDeclaration = `const ${node.getText(ast)};`;
    if (node.name.getText(ast) === 'monthlyTemperatureNotice') noticeDeclaration = `const ${node.getText(ast)};`;
  }
  if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
    ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === 'data-monthly-temperature-status')) {
    assert.equal(noticeElement, '', 'one real source-coverage notice'); noticeElement = node.getText(ast);
  }
  if (ts.isIfStatement(node) && node.expression.getText(ast) === "temperatureStatus !== 'complete'"
    && node.getText(ast).includes('Climate interpretation is unavailable for these monthly temperatures. Your original site estimates and saved records are retained.')) {
    assert.equal(climateGuard, ''); climateGuard = node.getText(ast);
  }
  ts.forEachChild(node, inspect);
}
inspect(ast);
assert.ok(statusDeclaration && noticeDeclaration && noticeElement && climateGuard,
  'execute the actual connected coverage branches, not a copy of their conditions');
function compile(body: string) {
  return ts.transpileModule(body, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None, jsx: ts.JsxEmit.React,
  } }).outputText;
}
const notice = new Function('React', 'monthlyTemperatureStatus', 'data', compile(
  statusDeclaration + noticeDeclaration + `return (${noticeElement});`)) as
  (react: typeof React, status: typeof monthlyTemperatureStatus, data: unknown) => ReactElement;
const climateEntry = new Function('React', 'temperatureStatus', compile(
  climateGuard + "return 'unchanged-climate-calculator-entry';")) as (react: typeof React, status: string) => ReactElement | string;
function fixture(status?: 'complete' | 'incomplete') {
  return { climate: { monthlyTemp: Array.from({ length: 12 }, () => 0),
    ...(status ? { monthlyTempCoverage: { source: 'nasa-power', status } } : {}) },
    rainfall: { monthly: Array.from({ length: 12 }, () => 0) } };
}

test('the actual notice distinguishes incomplete provider inputs from legacy unknown without altering values', () => {
  const legacy = fixture(), incomplete = fixture('incomplete'), complete = fixture('complete');
  const before = [legacy, incomplete, complete].map(value => JSON.stringify(value));
  const render = (data: unknown) => renderToStaticMarkup(notice(React, monthlyTemperatureStatus, data));
  assert.match(render(legacy), /data-monthly-temperature-status="unknown"/);
  assert.match(render(legacy), /unrecorded or could not be checked/);
  assert.match(render(legacy), /Maps, records and planning from your own estimates remain available/);
  assert.match(render(incomplete), /data-monthly-temperature-status="incomplete"/);
  assert.match(render(incomplete), /missing from the provider response/);
  assert.match(render(incomplete), /estimates are retained for display/);
  assert.match(render(complete), /data-monthly-temperature-status="complete"/);
  assert.match(render(complete), /does not confirm local crop suitability/);
  assert.deepEqual([legacy, incomplete, complete].map(value => JSON.stringify(value)), before);
});

// Until 11 November 2026 this test executed the Overview strip and checked it was withheld for unverified temperatures. The strip classed months as Grow, Dry or Rest from unsourced lines (12 °C, 30 mm, 20 mm, 22 °C) and is removed (finding CP-117), so there is nothing left to withhold. The stronger claim is asserted instead: no status can produce the strip.
test('the overview no longer derives growing months from monthly means at all', () => {
  const panel = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
  for (const gone of ['plantingCalendarHeader', 'calendarGrow', 'calendarDry', 'calendarRest', 'isGrow', 'isDry']) {
    assert.ok(!panel.includes(gone), `${gone} must not appear in DataPanel.tsx`);
  }
});

test('the actual climate guard withholds zone and frost-day calculations while keeping the complete path', () => {
  for (const status of ['unknown', 'incomplete']) {
    const element = climateEntry(React, status); assert.notEqual(typeof element, 'string');
    const markup = renderToStaticMarkup(element as ReactElement);
    assert.match(markup, /Climate interpretation is unavailable/); assert.match(markup, /saved records are retained/);
  }
  assert.equal(climateEntry(React, 'complete'), 'unchanged-climate-calculator-entry');
});
