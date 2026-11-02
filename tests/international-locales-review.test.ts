import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime.js';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime.js';

async function loadReviewRoute() {
  const root = new URL('../', import.meta.url).href;
  const hooks = registerHooks({
    // The shared menu brings CSS modules; Node needs class names, while browser QA checks styling.
    resolve(specifier, context, nextResolve) {
      if (specifier.endsWith('.css')) return { url: 'data:text/javascript,' + encodeURIComponent('export default new Proxy({}, { get: (_, key) => key });'), shortCircuit: true };
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url.startsWith(root) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
      return nextLoad(url, context);
    },
  });
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
  const originalGlobals = new Map(['self', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = () => {
    const rows = new Map<string, string>();
    return { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } };
  };
  const localStorage = storage(), sessionStorage = storage();
  // Real menu chrome subscribes to browser events/stores, locks body scroll and reads Next's router.
  const browser = Object.assign(new EventTarget(), { localStorage, sessionStorage });
  const document = Object.assign(new EventTarget(), { body: { style: { overflow: '' } } });
  for (const [key, value] of Object.entries({ self: globalThis, window: browser, document, navigator: { onLine: true }, localStorage, sessionStorage })) {
    Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  const router = { back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {} };
  let renderer: ReactTestRenderer;
  try {
    act(() => { renderer = create(React.createElement(AppRouterContext.Provider, { value: router },
      React.createElement(PathnameContext.Provider, { value: '/international/locales' }, React.createElement(Review)))); });
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
    act(() => renderer?.unmount());
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
