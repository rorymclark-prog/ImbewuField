import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

const contractBytes = readFileSync(new URL('../docs/international/KMD-KIAMBU-LINK-CONTRACT.json', import.meta.url));
assert.equal(createHash('sha256').update(contractBytes).digest('hex'), '11084aec92c7d15425085f6f7976b21a79546c9c63a092063c86b0a497245dfc');
const contract = JSON.parse(contractBytes.toString('utf8')).reference;
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
// Both real country components and the sole KMD provider run. Only framework
// chrome/CSS and the unrelated US server-action transport are bounded here;
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
const { KMD_COUNTY_CHOICES, resolveKmdBulletinReference } = await import('../lib/international/providers/kmd-bulletin-reference.ts');
const { COUNTRY_PROFILES } = await import('../lib/international/countries/registry.ts');
const { default: CountyCard } = await import('../components/international/countries/CountyBulletinReference.tsx');
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
const importEffects = { ...effects }, profilesBefore = JSON.stringify(COUNTRY_PROFILES);
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount(parent = false) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(parent ? CountryReview : CountyCard)); }); mounted.add(renderer);
  const card = () => renderer.root.findByProps({ 'aria-label': 'Kenya county bulletin reference' });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(row => text(row).startsWith(label)); assert.ok(node, `Missing actual field ${label}`);
    return node.findAll(row => row.type === 'select' || row.type === 'input')[0];
  };
  return { renderer, card, field, text: () => text(renderer.root), change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); } };
}
beforeEach(() => { effects.network = 0; effects.storage = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 });
  assert.equal(JSON.stringify(COUNTRY_PROFILES), profilesBefore, 'link discovery must not mutate country or readiness profiles');
});
after(() => {
  hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('actual provider and component imports are pure and the county choice starts blank with no active PDF', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0 });
  const ui = mount(), select = ui.field('County for bulletin links');
  assert.equal(select.props.value, ''); assert.equal(select.parent!.props.htmlFor, select.props.id);
  assert.deepEqual(select.findAllByType('option').map(node => [node.props.value, text(node)]), [['', 'Choose a county'], ...KMD_COUNTY_CHOICES.map(row => [row.id, row.label])]);
  assert.equal(ui.card().findAllByType('a').length, 0);
  assert.match(ui.text(), /No county selected\. No bulletin PDF is selected\./);
  assert.equal(ui.card().findAllByType('button').length, 0, 'curated links must not be presented as a fake fetch or refresh request');
  assert.match(ui.card().props.className, /min-w-0/); assert.match(select.props.className, /min-h-11/);
});

test('explicit Kiambu selection presents exact official links, source inspection and calendar labels with all currentness gaps intact', () => {
  const ui = mount(); ui.change('County for bulletin links', 'kiambu');
  const result = resolveKmdBulletinReference('KE', 'kiambu'); assert.equal(result.status, 'reference');
  assert.match(ui.text(), /Source inspected on2026-11-05 — inspection date, not publication/);
  assert.match(ui.text(), /Advertised calendar window2026-11-03 to 2026-11-09/);
  assert.match(ui.text(), /timezone UNKNOWN/); assert.match(ui.text(), /Date-boundary meaning is not established/);
  assert.match(ui.text(), /Freshness \/ currentnessNot assessed/); assert.match(ui.text(), /latest bulletinNot established/);
  assert.match(ui.text(), /Publication dateUNKNOWN/); assert.match(ui.text(), /Reuse licenceUNKNOWN/); assert.match(ui.text(), /API contractUNKNOWN/);
  const links = ui.card().findAllByType('a');
  assert.deepEqual(links.map(node => node.props.href), [contract.officialPageUrl, contract.documentUrl, contract.officialSearchUrl,
    contract.officialIndexUrl, contract.historicalPageUrl, contract.historicalDocumentUrl]);
  for (const link of links) {
    assert.equal(link.props.target, '_blank'); assert.equal(link.props.rel, 'noopener noreferrer'); assert.equal(link.props.referrerPolicy, 'no-referrer');
    assert.equal('prefetch' in link.props, false); assert.equal('onClick' in link.props, false);
    assert.match(link.props.className, /min-h-11/); assert.match(link.props.className, /max-w-full/);
  }
  assert.equal(ui.card().findAllByType('iframe').length, 0); assert.equal(ui.card().findAllByType('embed').length, 0);
  assert.equal(ui.card().findAllByType('img').length, 0);
  const details = ui.card().findAllByType('details'); assert.equal(details.length, 2);
  for (const section of details) { assert.notEqual(section.props.open, true); assert.match(section.findByType('summary').props.className, /min-h-11/); }
  assert.equal(text(details[0].findByType('summary')), 'Source review details');
  assert.match(text(details[0]), /Freshness \/ currentnessNot assessed/); assert.match(text(details[0]), /API contractUNKNOWN/);
  assert.equal(details[0].findAllByType('a').length, 0);
  assert.match(text(details[1].findByType('summary')), /Separate historical links · July 2025/);
  assert.match(text(details[1]), /filename advertises July 2025/);
  assert.match(ui.text(), /Freshness has not been assessed/);
  assert.match(text(links[1]), /November 2026 PDF/); assert.match(text(links[5]), /historical PDF · July 2025/);
  assert.match(ui.text(), /historical PDF body was not inspected/);
  assert.doesNotMatch(ui.text(), /2026-11-03T|2026-11-09T|expires|mm rainfall|°C|% chance/);
});

test('unsupported county input cannot retain a selected PDF or silently become another named county', () => {
  const ui = mount(); ui.change('County for bulletin links', 'kiambu'); assert.equal(ui.card().findAllByType('a').length, 6);
  ui.change('County for bulletin links', 'kirinyaga');
  assert.equal(ui.card().findAllByType('a').length, 0); assert.match(ui.text(), /No checked bulletin reference is recorded/);
  assert.doesNotMatch(ui.text(), /Advertised calendar window/);
  ui.change('County for bulletin links', ''); assert.match(ui.text(), /No county selected/);
  assert.deepEqual(resolveKmdBulletinReference('OTHER', 'kiambu'), { status: 'unavailable', reason: 'unsupported-country' });
});

test('actual country page keeps agricultural-region text independent from the explicit county and readiness assessment', () => {
  const ui = mount(true); assert.equal(ui.field('County for bulletin links').props.value, '');
  const limits = text(ui.renderer.root.findByProps({ 'aria-label': 'Readiness limits' }));
  ui.change('Agricultural region reference', 'Kiambu');
  assert.equal(ui.field('County for bulletin links').props.value, ''); assert.equal(ui.card().findAllByType('a').length, 0);
  ui.change('County for bulletin links', 'kiambu');
  assert.equal(ui.field('Agricultural region reference').props.value, 'Kiambu');
  assert.equal(text(ui.renderer.root.findByProps({ 'aria-label': 'Readiness limits' })), limits);
  assert.match(ui.text(), /No agricultural regions have passed local review/);
  ui.change('Agricultural region reference', 'An unrelated region');
  assert.equal(ui.field('County for bulletin links').props.value, 'kiambu');
});

test('leaving Kenya removes the actual card and returning mounts a new blank county selection', () => {
  const ui = mount(true); ui.change('County for bulletin links', 'kiambu');
  assert.equal(ui.card().findAllByType('a').length, 6);
  ui.change('Country', 'OTHER');
  assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Kenya county bulletin reference' }).length, 0);
  ui.change('Country', 'KE');
  assert.equal(ui.field('County for bulletin links').props.value, ''); assert.equal(ui.card().findAllByType('a').length, 0);
  assert.match(ui.text(), /No county selected/);
});
