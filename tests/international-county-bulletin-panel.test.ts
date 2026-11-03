import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

const root = new URL('../', import.meta.url).href;
const old = new Map(['window', 'navigator', 'localStorage', 'sessionStorage', 'fetch', '__countyBulletinPanel', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const activity = { fetches: 0, storageReads: 0, storageWrites: 0, events: 0 };
Object.assign(globalThis, { __countyBulletinPanel: { React }, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// Real CountryReview state, card and resolver execute. Only unrelated navigation
// controls, framework Link and CSS/TSX loading are controlled boundaries.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/link') return data(`const React=globalThis.__countyBulletinPanel.React;export default function Link({children,...props}){return React.createElement('a',props,children);}`);
  if (context.parentURL?.endsWith('/components/international/countries/CountryReview.tsx')) {
    if (specifier === '@/components/MenuButton') return data(`const React=globalThis.__countyBulletinPanel.React;export default function MenuButton(){return React.createElement('button',{type:'button'},'Menu');}`);
    if (specifier === '@/components/BackControl') return data('export function useRegisterBackControl(){}');
  }
  return next(specifier, context);
}, load(url, context, next) {
  if (url.startsWith(root) && url.endsWith('.module.css')) return { shortCircuit: true, format: 'module', source: 'export default new Proxy({}, {get:(_target,key)=>String(key)});' };
  if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
  return next(url, context);
} });
function installOfflineGuards() {
  const storage = { getItem() { ++activity.storageReads; throw Error('Private storage unavailable'); }, setItem() { ++activity.storageWrites; throw Error('No storage writes authorised'); }, removeItem() { ++activity.storageWrites; } };
  const browser = Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage });
  browser.dispatchEvent = () => { ++activity.events; return true; };
  for (const [key, value] of Object.entries({ window: browser, localStorage: storage, sessionStorage: storage, navigator: { onLine: false } }))
    Object.defineProperty(globalThis, key, { configurable: true, value });
}
// Imports are part of the no-automatic-activity boundary too: caught module-level
// effects must be observed before per-test counters can erase their evidence.
installOfflineGuards();
Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async () => { ++activity.fetches; throw Error('Unexpected automatic network request'); } });
const { default: CountyBulletinReference } = await import('../components/international/countries/CountyBulletinReference.tsx');
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
assert.deepEqual(activity, { fetches: 0, storageReads: 0, storageWrites: 0, events: 0 }, 'Importing the actual bulletin card and country page must not cause automatic network, storage or app-event activity');
const receipts = JSON.parse(readFileSync(new URL('../docs/international/pilots/kenya-kiambu-dated-bulletin-receipts.json', import.meta.url), 'utf8'));
const datedPage = receipts.receipts.find((row: { kind: string }) => row.kind === 'html').effectiveUrl;
const datedPdf = receipts.receipts.find((row: { kind: string }) => row.kind === 'pdf').effectiveUrl;

beforeEach(() => {
  Object.assign(activity, { fetches: 0, storageReads: 0, storageWrites: 0, events: 0 });
  installOfflineGuards();
});
after(() => { hooks.deregister(); for (const [key, descriptor] of old) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function mount(countryCode = 'KE') {
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(CountyBulletinReference, { countryCode })); });
  return { screen, county: () => screen.root.findAllByProps({ 'aria-label': 'County bulletin county' })[0],
    choose(value: string) { act(() => this.county().props.onChange({ target: { value } })); },
    references: () => screen.root.findAllByProps({ 'aria-label': 'Kiambu dated bulletin reference' }),
    update(value: string) { act(() => screen.update(React.createElement(CountyBulletinReference, { countryCode: value }))); },
    dispose() { act(() => screen.unmount()); } };
}
function unchangedGlobalActivity() { assert.deepEqual(activity, { fetches: 0, storageReads: 0, storageWrites: 0, events: 0 }); }

test('Kenya starts with an explicit blank county and offers no dated links before the grower selects it', () => {
  const ui = mount();
  try { assert.equal(ui.county().props.value, ''); assert.deepEqual(ui.county().findAllByType('option').map(option => option.props.value), ['', 'kiambu']); assert.equal(ui.references().length, 0); assert.equal(ui.screen.root.findAllByType('a').length, 0); unchangedGlobalActivity(); } finally { ui.dispose(); }
});

test('explicit Kiambu selection exposes only the curated official page, PDF and index with private-navigation safeguards', () => {
  const ui = mount();
  try {
    ui.choose('kiambu'); assert.equal(ui.references().length, 1);
    const links = ui.references()[0].findAllByType('a'); assert.equal(links.length, 3);
    assert.equal(links[0].props.href, datedPage); assert.equal(links[1].props.href, datedPdf);
    assert.match(links[2].props.href, /^https:\/\/meteo\.go\.ke\//);
    for (const link of links) { assert.equal(link.props.target, '_blank'); assert.deepEqual(new Set(link.props.rel.split(/\s+/)), new Set(['noopener', 'noreferrer'])); assert.equal(link.props.referrerPolicy, 'no-referrer'); assert.equal(link.props.onClick, undefined, 'Opening an ordinary user-clicked link must not invoke an automatic request'); }
    unchangedGlobalActivity();
  } finally { ui.dispose(); }
});

test('dated copy distinguishes advertised calendar dates and actual PDF retrieval from unknown freshness, time zone and reuse licence', () => {
  const ui = mount();
  try {
    ui.choose('kiambu'); const card = ui.references()[0], copy = text(card);
    assert.deepEqual(card.findAllByType('time').map(time => time.props.dateTime), ['2026-11-03', '2026-11-09']);
    assert.match(copy, /Advertised calendar dates: 3 November 2026 to 9 November 2026/);
    assert.match(copy, /PDF source retrieved: 3 November 2026 \(UTC\)/);
    assert.match(copy, /not a publication or issue time/); assert.match(copy, /Freshness has not been assessed/);
    assert.match(copy, /not a live feed/); assert.match(copy, /newest bulletin/);
    assert.match(copy, /Time zone: unknown/); assert.match(copy, /Reuse licence: unknown/);
    assert.doesNotMatch(copy, /\b(current|expired)\b/i, 'The retrieval timestamp must not classify the document as current or expired');
    unchangedGlobalActivity();
  } finally { ui.dispose(); }
});

test('unverified or name-like county values cannot substitute another county or infer a reference', () => {
  const ui = mount();
  try { for (const value of ['Kiambu', 'kiambu ', 'kirinyaga', 'central', '']) { ui.choose(value); assert.equal(ui.references().length, 0); assert.equal(ui.screen.root.findAllByType('a').length, 0); } unchangedGlobalActivity(); } finally { ui.dispose(); }
});

test('a country replacement withdraws the selected county and returning to Kenya starts blank rather than restoring its old reference', () => {
  const ui = mount();
  try {
    ui.choose('kiambu'); const retained = ui.county().props.onChange;
    for (const country of ['BR', 'US', 'GB', 'OTHER', 'ke']) {
      ui.update(country); assert.equal(ui.county(), undefined); assert.equal(ui.screen.root.findAllByType('a').length, 0);
      act(() => retained({ target: { value: 'kiambu' } })); assert.equal(ui.references().length, 0);
    }
    ui.update('KE'); assert.equal(ui.county().props.value, ''); assert.equal(ui.references().length, 0); unchangedGlobalActivity();
  } finally { ui.dispose(); }
});

test('the actual country-review selector remounts the county card while free-text agricultural regions never choose a county', () => {
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(CountryReview)); });
  const county = () => screen.root.findAllByProps({ 'aria-label': 'County bulletin county' })[0];
  const country = () => screen.root.findAllByType('label').find(label => typeof label.children[0] === 'string' && label.children[0].trim() === 'Country')!.findByType('select');
  const region = () => screen.root.findAllByType('label').find(label => typeof label.children[0] === 'string' && label.children[0].startsWith('Agricultural region reference'))!.findByType('input');
  const references = () => screen.root.findAllByProps({ 'aria-label': 'Kiambu dated bulletin reference' });
  try {
    assert.equal(country().props.value, 'KE'); assert.equal(county().props.value, '');
    act(() => region().props.onChange({ target: { value: 'Kiambu' } })); assert.equal(county().props.value, ''); assert.equal(references().length, 0);
    act(() => county().props.onChange({ target: { value: 'kiambu' } })); assert.equal(references().length, 1);
    const oldCountyChange = county().props.onChange;
    act(() => country().props.onChange({ target: { value: 'BR' } })); assert.equal(county(), undefined); assert.equal(references().length, 0);
    act(() => oldCountyChange({ target: { value: 'kiambu' } })); assert.equal(references().length, 0);
    act(() => country().props.onChange({ target: { value: 'KE' } })); assert.equal(county().props.value, ''); assert.equal(references().length, 0); unchangedGlobalActivity();
  } finally { act(() => screen.unmount()); }
});

test('the integration key and country input both use the real country selection rather than a fixed or inferred value', () => {
  const source = readFileSync(new URL('../components/international/countries/CountryReview.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('CountryReview.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let key = '', country = '';
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'CountyBulletinReference') for (const prop of node.attributes.properties) {
      if (ts.isJsxAttribute(prop) && prop.initializer && ts.isJsxExpression(prop.initializer)) {
        if (prop.name.getText(tree) === 'key') key = prop.initializer.expression?.getText(tree) ?? '';
        if (prop.name.getText(tree) === 'countryCode') country = prop.initializer.expression?.getText(tree) ?? '';
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(key); assert.ok(country);
  for (const selected of ['KE', 'BR', 'OTHER']) { assert.equal(Function('code', `return (${key});`)(selected), selected); assert.equal(Function('code', `return (${country});`)(selected), selected); }
});

test('offline rendering keeps ordinary reference links available without fetching, embedding, reading private stores or changing app events', () => {
  const ui = mount();
  try { ui.choose('kiambu'); assert.equal(navigator.onLine, false); assert.equal(ui.references()[0].findAllByType('a').length, 3);
    for (const element of ['img', 'iframe', 'embed', 'object'] as const) assert.equal(ui.screen.root.findAllByType(element).length, 0);
    unchangedGlobalActivity();
  } finally { ui.dispose(); }
});

test('the historical Kenya soil entry links only to the catalogue and disappears from the Brazil dossier', () => {
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(CountryReview)); });
  const link = () => screen.root.findAllByType('a').filter(a =>
    a.props.href === 'https://data.isric.org/srv/api/records/4648929a-8031-49cc-9d56-9f3aeff2f8d9');
  try {
    assert.equal(link().length, 1);
    const details = screen.root.findAllByType('details').find(item => item.findAllByType('a').includes(link()[0]))!;
    assert.match(text(details), /Background reference only/);
    assert.match(text(details), /Soil measurements for Kiambu and individual farms remain unverified/);
    assert.equal(details.findAllByType('a').length, 1);
    assert.equal(link()[0].props.onClick, undefined);
    assert.ok(screen.root.findAllByType('li').some(item => text(item).includes('Current verified soils reference evidence is missing.')));
    const selector = screen.root.findAllByType('select').find(item => item.props.value === 'KE')!;
    act(() => selector.props.onChange({ target: { value: 'BR' } }));
    assert.equal(link().length, 0);
    unchangedGlobalActivity();
  } finally { act(() => screen.unmount()); }
});

test('Kenya shows public extension referrals without service actions or cross-country links', () => {
  let screen!: ReactTestRenderer;
  act(() => { screen = create(React.createElement(CountryReview)); });
  const hrefs = [
    'https://kilimo.go.ke/frequently-asked-questions/',
    'https://kiambu.go.ke/departments/agriculture-livestock-irrigation/',
  ];
  try {
    for (const href of hrefs) {
      const links = screen.root.findAllByType('a').filter(link => link.props.href === href);
      assert.equal(links.length, 1);
      assert.equal(links[0].props.onClick, undefined);
      const card = screen.root.findAllByType('details').find(item => item.findAllByType('a').includes(links[0]))!;
      assert.match(text(card), /Background reference only/);
      assert.equal(card.findAllByType('button').length, 0);
    }
    const selector = screen.root.findAllByType('select').find(item => item.props.value === 'KE')!;
    act(() => selector.props.onChange({ target: { value: 'GB' } }));
    assert.ok(screen.root.findAllByType('a').every(link => !hrefs.includes(link.props.href)));
    unchangedGlobalActivity();
  } finally { act(() => screen.unmount()); }
});
