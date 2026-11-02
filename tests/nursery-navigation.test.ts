import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import ts from 'typescript';

// The hosted review found this only in Simple mode: its buying card is absent,
// so a link to that card does nothing even though the nursery itself is visible.
registerHooks({ load(url, context, nextLoad) {
  if (url.endsWith('.tsx') && url.startsWith(new URL('../', import.meta.url).href)) {
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText };
  }
  return nextLoad(url, context);
} });

test('Simple growers can follow the nursery sourcing link to a section that is actually present', async () => {
  const { default: NurseryPlanPanel } = await import('../components/crops/NurseryPlanPanel.tsx');
  let screen: ReturnType<typeof create>;
  act(() => { screen = create(createElement(NurseryPlanPanel, {
    siteId: 'fictional-navigation-test', plantings: [], beds: [], now: { year: 2026, month: 11 }, onSettings: () => {},
  })); });
  try {
    const link = screen!.root.findAllByType('a').find((node) => node.children[0] === 'Review seeds and equipment to source')!;
    assert.ok(link, 'the grower needs a visible way to review sourcing needs');
    assert.ok(link.props.href.startsWith('#'));
    assert.equal(screen!.root.findAll((node) => typeof node.type === 'string' && node.props.id === link.props.href.slice(1)).length, 1,
      'Simple mode must not point at the buying calendar that the page hides');
    assert.equal(screen!.root.findAllByType('a').find((node) => node.children[0] === 'Open task planner')?.props.href, '/cropplan');
  } finally { act(() => screen!.unmount()); }
});

test('the real crop page sends All tools growers to its existing buying calendar and keeps Simple local', () => {
  const source = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'NurseryPlanPanel') {
      const attribute = node.attributes.properties.find((entry) => ts.isJsxAttribute(entry) && entry.name.getText(tree) === 'showBuyingCalendar');
      if (attribute && ts.isJsxAttribute(attribute) && attribute.initializer && ts.isJsxExpression(attribute.initializer)) expression = attribute.initializer.expression;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.ok(expression, 'the page must tell the shared panel whether its buying calendar exists');
  const showCalendar = new Function('simple', `return (${expression.getText(tree)});`);
  assert.equal(showCalendar(true), false);
  assert.equal(showCalendar(false), true);
  assert.match(source, /id="nursery-purchasing"/);
});
