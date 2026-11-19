import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { ProductionRecordsEditorProps } from '../components/crops/ProductionRecordsEditor.tsx';

const editorUrl = new URL('../components/crops/ProductionRecordsEditor.tsx', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === editorUrl && specifier.endsWith('.module.css')) {
      return { shortCircuit: true, url: 'data:text/javascript,export default {}' };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url !== editorUrl) return next(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    });
    return { shortCircuit: true, format: 'module', source: outputText };
  },
});
const { ProductionRecordsEditor } = await import('../components/crops/ProductionRecordsEditor.tsx');
after(() => hooks.deregister());
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('production and stock drafts stay visible when the plan rejects the changes', () => {
  let renderer!: ReactTestRenderer;
  let admitted = false;
  const props: ProductionRecordsEditorProps = {
    products: [{ iconKey: 'crop:carrots', label: 'Carrots' }], dates: [{ year: 2027, month: 2 }],
    onProductionRecordsChange: () => admitted, onPreservedProductsChange: () => admitted,
  };
  const render = () => React.createElement(ProductionRecordsEditor, props);
  act(() => { renderer = create(render()); });
  try {
    const [production, stock] = renderer.root.findAllByType('form');
    const [product, month, , unit] = production.findAllByType('select');
    const amount = production.findByProps({ placeholder: 'Enter amount' });
    const stockName = stock.findByProps({ placeholder: 'e.g. Dried mango' });
    const checkbox = stock.findAllByType('input').find(input => input.props.type === 'checkbox');
    assert.ok(stockName && checkbox);
    const change = (field: typeof amount, value: string) => act(() => field.props.onChange({ target: { value } }));
    const submit = (form: typeof production) => act(() => form.props.onSubmit({ preventDefault() {} }));
    change(product, 'crop:carrots'); change(month, '2027-02'); change(unit, 'kg'); change(amount, '3');
    change(stock.findAllByType('select')[0], 'crop:carrots'); change(stockName, 'Stored carrots');
    act(() => checkbox.props.onChange({ target: { checked: true } }));
    submit(production); submit(stock);
    assert.match(production.findByProps({ role: 'alert' }).children.join(''), /Your draft is still here/);
    assert.match(stock.findByProps({ role: 'alert' }).children.join(''), /Your draft is still here/);
    assert.equal(amount.props.value, '3');
    assert.equal(stockName.props.value, 'Stored carrots');
    props.readOnly = true;
    act(() => renderer.update(render()));
    assert.equal(production.findByProps({ type: 'submit' }).props.disabled, true);
    assert.equal(stock.findByProps({ type: 'submit' }).props.disabled, true);
    props.readOnly = false; admitted = true;
    act(() => renderer.update(render()));
    submit(production); submit(stock);
    assert.equal(amount.props.value, '');
    assert.equal(stockName.props.value, '');
  } finally { act(() => renderer.unmount()); }
});
