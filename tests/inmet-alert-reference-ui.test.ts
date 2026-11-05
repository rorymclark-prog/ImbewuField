import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

const prior = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0 };
const forbiddenStorage = () => { effects.storage++; throw Error('Source discovery must not access browser storage'); };
const forbiddenFetch = () => { effects.network++; throw Error('Source discovery must not request a remote body'); };
const browser = Object.defineProperties({}, { localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: forbiddenFetch }, window: { value: browser }, localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const root = new URL('../', import.meta.url).href;
const asModule = (code: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
// The actual card, country page and sole INMET resolver run. Only framework
// chrome/CSS and the unrelated public-reference server-action transports are bounded here;
// NASA, readiness and registry data remain their actual read-only modules.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.startsWith(root) && specifier.endsWith('.module.css')) {
      const css = readFileSync(new URL(specifier, context.parentURL), 'utf8');
      const classes = Object.fromEntries([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(match => [match[1], match[1]]));
      return asModule(`export default ${JSON.stringify(classes)};`);
    }
    if (context.parentURL?.endsWith('/components/international/countries/CountryReview.tsx')) {
      if (specifier === 'next/link') return asModule(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement("a",props,children);}`);
      if (specifier === '@/components/MenuButton') return asModule('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return asModule('export function useRegisterBackControl(){}');
    }
    if (context.parentURL?.endsWith('/components/international/countries/NwsForecastReference.tsx') && specifier === '@/app/international/nws-actions') {
      return asModule('export function checkNwsPublicDemo(){return globalThis.fetch("forbidden-unrelated-action");}');
    }
    if (context.parentURL?.endsWith('/components/international/countries/EaRainfallReference.tsx') && specifier === '@/app/international/ea-rainfall-actions') return asModule('export function checkEaRainfallPublicDemo(){return globalThis.fetch("forbidden-unrelated-action");}');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
// These imports intentionally require the actual native module. No temporary
// provider or decoder stand-in can make this UI contract pass.
const { resolveInmetAlertReference } = await import('../lib/international/providers/inmet-alert-reference.ts');
const { COUNTRY_PROFILES } = await import('../lib/international/countries/registry.ts');
const { default: Card } = await import('../components/international/countries/InmetAlertLinks.tsx');
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
const importEffects = { ...effects }, profilesBefore = JSON.stringify(COUNTRY_PROFILES);
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount(parent = false, countryCode: unknown = 'BR') {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(parent ? React.createElement(CountryReview) : React.createElement(Card, { countryCode })); }); mounted.add(renderer);
  const card = () => renderer.root.findByProps({ 'aria-label': 'Brazil official INMET alert links' });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(row => text(row).startsWith(label)); assert.ok(node, `Missing actual field ${label}`);
    return node.findAll(row => row.type === 'select' || row.type === 'input')[0];
  };
  return { renderer, card, field, text: () => text(renderer.root),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    update(countryCode: unknown) { assert.equal(parent, false); act(() => renderer.update(React.createElement(Card, { countryCode }))); },
    toggle(open: boolean) { act(() => card().findByType('details').props.onToggle({ currentTarget: { open } })); } };
}
beforeEach(() => { effects.network = 0; effects.storage = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 });
  assert.equal(JSON.stringify(COUNTRY_PROFILES), profilesBefore, 'source navigation must not alter country or readiness profiles');
});
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('real imports and mounting produce only fixed protected external links without requests, storage or fake refresh', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0 }); const ui = mount();
  const resolved = resolveInmetAlertReference('BR'); assert.equal(resolved.status, 'reference'); if (resolved.status !== 'reference') throw Error('Reference required');
  const links = ui.card().findAllByType('a');
  assert.deepEqual(links.map(node => node.props.href), [resolved.reference.alertsAppUrl, resolved.reference.portalUrl, resolved.reference.rssFeedUrl]);
  assert.deepEqual(links.map(node => node.props.href), ['https://avisos.inmet.gov.br/', 'https://portal.inmet.gov.br/', 'https://apiprevmet3.inmet.gov.br/avisos/rss']);
  for (const link of links) {
    assert.equal(link.props.target, '_blank'); assert.equal(link.props.rel, 'noopener noreferrer'); assert.equal(link.props.referrerPolicy, 'no-referrer');
    assert.equal('onClick' in link.props, false); assert.equal('prefetch' in link.props, false);
    assert.match(link.props.className, /min-h-11/); assert.match(link.props.className, /max-w-full/); assert.match(link.props.className, /whitespace-normal/);
  }
  assert.match(ui.card().props.className, /min-w-0/); assert.match(ui.card().props.className, /overflow-wrap:anywhere/);
  for (const element of ['button', 'input', 'select', 'iframe', 'embed', 'img', 'time'] as const) assert.equal(ui.card().findAllByType(element).length, 0, element);
});

test('link inspection is not promoted to weather publication, live alerts or assessed geographic coverage', () => {
  const ui = mount(), details = ui.card().findByType('details');
  assert.equal(details.props.open, false); assert.match(details.findByType('summary').props.className, /min-h-11/);
  assert.equal(text(details.findByType('summary')), 'Source review details');
  assert.match(ui.text(), /Links inspected on 2026-11-05/); assert.match(ui.text(), /not a weather publication date or freshness check/);
  assert.match(ui.text(), /check the provider’s geographic area and dates/); assert.match(ui.text(), /Alerts are not retrieved or evaluated here/);
  assert.match(text(details), /official primary portal’s text and links were inspected/);
  assert.match(text(details), /JavaScript application shell/); assert.match(text(details), /RSS feed body was not inspected/);
  assert.match(text(details), /No feed item, alert count or alert-free status was established/);
  assert.match(text(details), /connection resets without response bodies/); assert.match(text(details), /do not establish provider downtime or an empty feed/);
  assert.deepEqual(details.findAllByType('dt').map(node => text(node)), ['Feed schema', 'Feed timestamps', 'Geographic coverage', 'Update cadence', 'Authentication', 'Reuse licence', 'Freshness']);
  assert.deepEqual(details.findAllByType('dd').map(node => text(node)), ['UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'Not assessed']);
  ui.toggle(true); assert.equal(ui.card().findByType('details').props.open, true);
  assert.equal(ui.card().findAllByType('a').length, 3); assert.doesNotMatch(ui.text(), /Campinas|No active alerts|alerts are current|latest alerts verified|nearest farm/);
});

test('only exact Brazil can render links and hostile country values are not coerced or read', () => {
  const ui = mount(); let effects = 0;
  const hostile = Object.defineProperties({}, { toString: { get() { effects++; throw Error('No coercion'); } }, countryCode: { get() { effects++; return 'BR'; } } });
  for (const input of ['br', ' BR', 'BR ', 'KE', 'OTHER', '', null, undefined, 0, false, new String('BR'), hostile]) {
    ui.update(input); assert.equal(ui.renderer.toJSON(), null);
  }
  assert.equal(effects, 0); ui.update('BR'); assert.equal(ui.card().findAllByType('a').length, 3);
});

test('an unsupported country removes open details and a return to Brazil starts a closed new card', () => {
  const ui = mount(); ui.toggle(true); assert.equal(ui.card().findByType('details').props.open, true);
  ui.update('OTHER'); assert.equal(ui.renderer.toJSON(), null);
  ui.update('BR'); assert.equal(ui.card().findByType('details').props.open, false);
});

test('real country page mounts only Brazil and region text cannot grant coverage, change links or alter readiness', () => {
  const ui = mount(true); assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Brazil official INMET alert links' }).length, 0);
  ui.change('Country', 'BR'); const before = JSON.stringify(ui.card().findAllByType('a').map(node => node.props.href));
  const limits = text(ui.renderer.root.findByProps({ 'aria-label': 'Readiness limits' }));
  ui.change('Agricultural region reference', 'Campinas');
  assert.equal(JSON.stringify(ui.card().findAllByType('a').map(node => node.props.href)), before);
  assert.equal(text(ui.renderer.root.findByProps({ 'aria-label': 'Readiness limits' })), limits);
  assert.match(ui.text(), /No agricultural regions have passed local review/);
  assert.equal(ui.card().findByType('details').props.open, false); assert.doesNotMatch(text(ui.card()), /Campinas/);
  ui.toggle(true); assert.equal(ui.card().findByType('details').props.open, true);
  ui.change('Country', 'GB'); assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Brazil official INMET alert links' }).length, 0);
  ui.change('Country', 'BR'); assert.equal(ui.card().findByType('details').props.open, false); assert.equal(ui.card().findAllByType('a').length, 3);
  assert.equal(ui.field('Agricultural region reference').props.value, '');
});
