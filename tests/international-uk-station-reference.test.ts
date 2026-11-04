import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

const root = new URL('../', import.meta.url).href;
const prior = new Map(['window', 'localStorage', 'sessionStorage', 'fetch', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const activity: string[] = [];
const deny = (kind: string) => { activity.push(kind); throw new Error(`Unexpected ${kind}`); };
const storage = { getItem: () => deny('storage read'), setItem: () => deny('storage write'), removeItem: () => deny('storage removal') };
for (const [key, value] of Object.entries({
  window: { localStorage: storage, sessionStorage: storage, dispatchEvent: () => deny('app event') },
  localStorage: storage, sessionStorage: storage, fetch: async () => deny('fetch'), IS_REACT_ACT_ENVIRONMENT: true,
})) Object.defineProperty(globalThis, key, { configurable: true, value });

const stub = (source: string) => ({ shortCircuit: true, url: `data:text/javascript,${encodeURIComponent(source)}` });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/CountryReview.tsx')) {
      if (specifier === 'next/link' || specifier === '@/components/MenuButton') return stub('export default function Stub(){return null}');
      if (specifier === '@/components/BackControl') return stub('export function useRegisterBackControl(){}');
      // Shared navigation reads its own display preferences. This probe observes
      // the country and station data controls, as with the menu and back control.
      if (specifier === '@/components/LimaBar') return stub('export default function HelpChrome(){return null}');

    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.module.css')) return { shortCircuit: true, format: 'module', source: 'export default {};' };
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
    return next(url, context);
  },
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});

const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
const { default: UkStationReference } = await import('../components/international/countries/UkStationReference.tsx');
const receipts = JSON.parse(readFileSync(new URL('../docs/international/pilots/uk-yeovilton-reference-receipts.json', import.meta.url), 'utf8'));
const expectedLinks = receipts.receipts.filter((receipt: { source: string }) => ['directory', 'station'].includes(receipt.source))
  .map((receipt: { effectiveUrl: string }) => receipt.effectiveUrl);

test('country review requires an explicit UK station choice and resets it after leaving the country', () => {
  assert.deepEqual(activity, [], 'importing the country review must not fetch or touch stores');
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(CountryReview)); });
  const article = () => screen.root.findAllByProps({ 'aria-label': 'Yeovilton historical weather reference' })[0];
  const station = () => screen.root.findAllByProps({ 'aria-labelledby': 'uk-station-heading' })[0]?.findByType('select');
  const choose = (value: string) => act(() => station()!.props.onChange({ target: { value } }));
  const country = () => screen.root.findAllByType('select')[0];
  const changeCountry = (value: string) => act(() => country().props.onChange({ target: { value } }));
  try {
    assert.equal(station(), undefined);
    changeCountry('GB');
    assert.equal(station()!.props.value, '');
    act(() => screen.root.findAllByType('input').find(node => node.props['aria-describedby'] === 'region-help')!.props.onChange({ target: { value: 'Yeovilton' } }));
    assert.equal(station()!.props.value, '');
    assert.equal(article(), undefined);
    choose('Yeovilton');
    assert.equal(article(), undefined, 'an unsupported station alias cannot open records');
    choose('yeovilton');
    const links = article()!.findAllByType('a');
    assert.deepEqual(links.map(link => link.props.href), expectedLinks);
    assert.equal(links.length, 2);
    for (const link of links) {
      assert.equal(link.props.target, '_blank');
      assert.equal(link.props.rel, 'noopener noreferrer');
      assert.equal(link.props.referrerPolicy, 'no-referrer');
    }
    assert.match(JSON.stringify(article()!.findAllByType('p').map(node => node.children.filter(child => typeof child === 'string'))), /cannot tell you the first or last frost date/);
    assert.equal(article()!.findAll(node => ['img', 'iframe', 'embed', 'object'].includes(String(node.type))).length, 0);
    choose('');
    assert.equal(article(), undefined);
    choose('yeovilton');
    changeCountry('BR');
    assert.equal(station(), undefined);
    changeCountry('GB');
    assert.equal(station()!.props.value, '');
    assert.equal(article(), undefined);
    assert.deepEqual(activity, []);
  } finally { act(() => screen.unmount()); }
});

test('the station card rejects the UK alias and other country codes', () => {
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(UkStationReference, { countryCode: 'UK' })); });
  try { assert.equal(screen.toJSON(), null); }
  finally { act(() => screen.unmount()); }
});

test('the UK country review exposes the England advice link only as background', () => {
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(CountryReview)); });
  const href = 'https://www.gov.uk/government/groups/farming-advice-service';
  const links = () => screen.root.findAllByType('a').filter(node => node.props.href === href);
  const choose = (value: string) => act(() => screen.root.findAllByType('select')[0].props.onChange({ target: { value } }));
  try {
    assert.equal(links().length, 0);
    choose('GB');
    assert.equal(links().length, 1);
    const card = screen.root.findAllByType('details').find(node => node.findAllByType('a').includes(links()[0]))!;
    const copy = JSON.stringify(card.findAll(node => ['small', 'p', 'dd'].includes(String(node.type)))
      .map(node => node.children.filter(child => typeof child === 'string')));
    assert.match(copy, /Background reference only/);
    assert.match(copy, /network based across England/);
    assert.match(copy, /Service reach in Somerset and elsewhere in the UK remains unverified/);
    assert.equal(links()[0].props.onClick, undefined);
    choose('US');
    assert.equal(links().length, 0);
    assert.deepEqual(activity, []);
  } finally { act(() => screen.unmount()); }
});
