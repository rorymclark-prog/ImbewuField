import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

async function loadReviewRoute() {
  const root = new URL('../', import.meta.url).href;
  const hooks = registerHooks({ load(url, context, nextLoad) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return nextLoad(url, context);
  } });
  try { return (await import('../app/international/locales/page.tsx')).default; }
  finally { hooks.deregister(); }
}
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map((child) => text(child as ReactTestInstance | string)).join('');
}
function label(renderer: ReactTestRenderer, prefix: string) {
  const found = renderer.root.findAllByType('label').find((node) => typeof node.children[0] === 'string' && node.children[0].startsWith(prefix));
  assert.ok(found, prefix); return found;
}

test('the real review route keeps draft selection separate from formatting and English fallback until preview is requested', async () => {
  const Review = await loadReviewRoute();
  const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  // Next's real Link schedules browser idle work; give the Node renderer that browser global.
  Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
  let renderer: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Review)); });
  try {
    const article = (key: string) => renderer.root.findAllByType('article').find((node) => node.findAllByType('h2').some((heading) => text(heading) === key))!;
    assert.match(text(renderer!.root), /0 human reviewed/);
    assert.match(text(renderer!.root), /32 structurally valid drafts/);
    assert.equal(text(article('start').findByType('bdi')), 'Start');
    act(() => label(renderer, 'Draft language').findByType('select').props.onChange({ target: { value: 'es' } }));
    assert.equal(label(renderer!, 'Formatting locale').findByType('input').props.value, 'fr');
    assert.match(text(article('start')), /Empezar/);
    assert.equal(text(article('start').findByType('bdi')), 'Start');
    act(() => renderer.root.findAllByType('input').find((node) => node.props.type === 'checkbox')!.props.onChange({ target: { checked: true } }));
    assert.equal(text(article('start').findByType('bdi')), 'Empezar');
    assert.match(text(article('start')), /Unreviewed AI draft/);
    act(() => label(renderer, 'Find a key').findByType('input').props.onChange({ target: { value: 'reportPhotosCount' } }));
    assert.equal(renderer!.root.findAllByType('article').length, 1);
    act(() => label(renderer, 'Synthetic photo count').findByType('input').props.onChange({ target: { value: '1' } }));
    assert.match(text(article('reportPhotosCount').findByType('bdi')), /foto$/);
    act(() => label(renderer, 'Formatting locale').findByType('input').props.onChange({ target: { value: 'fr_FR' } }));
    assert.match(text(renderer!.root), /Invalid locale tag; English formatting is shown explicitly/);
    assert.match(text(renderer!.root), /Denomination preserved: ZAR/);
    assert.match(text(renderer!.root), /mixed-currencies; separate subtotals only/);
    const fixture = renderer!.root.findAllByType('p').find((node) => node.props.dir === 'rtl');
    assert.ok(fixture); assert.equal(fixture.findAllByType('bdi').length, 2);
    assert.match(text(renderer!.root), /Arabic is not one of the four draft dictionaries/);
  } finally {
    act(() => renderer!.unmount());
    if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf);
    else Reflect.deleteProperty(globalThis, 'self');
  }
});
