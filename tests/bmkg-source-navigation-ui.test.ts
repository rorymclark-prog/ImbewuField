import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';

const prior = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0 };
const forbiddenStorage = () => { effects.storage++; throw Error('Research links must not access saved context'); };
const forbiddenFetch = () => { effects.network++; throw Error('Research links must not retrieve provider content'); };
const browser = Object.defineProperties({}, { localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: forbiddenFetch }, window: { value: browser }, localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const root = new URL('../', import.meta.url).href;
const asModule = (code: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
// The actual metadata, card, parent page and country/readiness authorities run.
// Only framework chrome/CSS and unrelated server-action transports are bounded.
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
    if (context.parentURL?.endsWith('/components/international/countries/NwsForecastReference.tsx') && specifier === '@/app/international/nws-actions') return asModule('export function checkNwsPublicDemo(){return globalThis.fetch("forbidden-unrelated-action");}');
    if (context.parentURL?.endsWith('/components/international/countries/EaRainfallReference.tsx') && specifier === '@/app/international/ea-rainfall-actions') return asModule('export function checkEaRainfallPublicDemo(){return globalThis.fetch("forbidden-unrelated-action");}');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});
const { BMKG_SOURCE_NAVIGATION: reference } = await import('../lib/international/providers/bmkg-source-navigation.ts');
const { COUNTRY_PROFILES } = await import('../lib/international/countries/registry.ts');
const { evaluateCountryReadiness } = await import('../lib/international/countries/readiness.ts');
const { default: Card } = await import('../components/international/countries/BmkgResearchLinks.tsx');
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
const importEffects = { ...effects }, profilesBefore = JSON.stringify(COUNTRY_PROFILES);
const indonesiaBefore = evaluateCountryReadiness({ countryCode: 'ID', agriculturalRegionId: '', interfaceLanguage: 'en' }, '2026-11-05');
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
function mount(parent = false) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(parent ? CountryReview : Card)); }); mounted.add(renderer);
  const card = () => renderer.root.findByProps({ 'aria-label': 'Indonesia BMKG research sources' });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(row => text(row).startsWith(label)); assert.ok(node, `Missing actual field ${label}`);
    return node.findAll(row => row.type === 'select' || row.type === 'input')[0];
  };
  return { renderer, card, field, text: () => text(renderer.root),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    toggle(open: boolean) { act(() => card().findByType('details').props.onToggle({ currentTarget: { open } })); } };
}
beforeEach(() => { effects.network = 0; effects.storage = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 });
  assert.equal(JSON.stringify(COUNTRY_PROFILES), profilesBefore, 'opening research links cannot register or change a country dossier');
  assert.deepEqual(evaluateCountryReadiness({ countryCode: 'ID', agriculturalRegionId: '', interfaceLanguage: 'en' }, '2026-11-05'), indonesiaBefore);
});
after(() => { hooks.deregister(); for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } });

test('source-navigation metadata keeps exact primary destinations without dynamic endpoints or permission grants', () => {
  assert.ok(Object.isFrozen(reference));
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(reference))) {
    assert.equal('get' in descriptor, false); assert.equal('set' in descriptor, false);
    assert.ok(['string', 'boolean'].includes(typeof descriptor.value));
  }
  const destinations = [reference.forecastDocumentationUrl, reference.openDataAboutUrl, reference.generalTermsUrl];
  assert.deepEqual(destinations, ['https://data.bmkg.go.id/prakiraan-cuaca/', 'https://data.bmkg.go.id/tentang/', 'https://www.bmkg.go.id/ketentuan-penggunaan']);
  for (const destination of destinations) {
    const url = new URL(destination); assert.equal(url.protocol, 'https:'); assert.equal(url.search, ''); assert.equal(url.hash, ''); assert.equal(url.username, ''); assert.equal(url.password, '');
  }
  assert.equal(reference.runtimeMode, 'external-links-only'); assert.equal(reference.forecastApiPayloadInspected, false); assert.equal(reference.originalHttpBodiesCaptured, false);
  assert.equal(reference.integrationPermission, 'UNKNOWN'); assert.equal(reference.reuseLicence, 'UNKNOWN'); assert.equal(reference.conditionsApplicability, 'UNRESOLVED');
  assert.equal(reference.reviewBasis, 'coordinator-primary-web-reader-page-opens');
  assert.equal(reference.attributionCondition, 'BMKG-source-attribution-required');
  assert.equal(reference.writtenPermissionCondition, 'provider-stated-for-republication-third-party-integration-or-commercial-use');
});

test('actual card imports and mounts only protected manual navigation without network, storage or embedded content', () => {
  assert.deepEqual(importEffects, { network: 0, storage: 0 }); const ui = mount();
  const links = ui.card().findAllByType('a');
  assert.deepEqual(links.map(node => node.props.href), [reference.forecastDocumentationUrl, reference.openDataAboutUrl, reference.generalTermsUrl]);
  for (const anchor of links) {
    assert.equal(anchor.props.target, '_blank'); assert.equal(anchor.props.rel, 'noopener noreferrer'); assert.equal(anchor.props.referrerPolicy, 'no-referrer');
    assert.equal('onClick' in anchor.props, false); assert.equal('prefetch' in anchor.props, false);
    assert.match(anchor.props.className, /min-h-11/); assert.match(anchor.props.className, /max-w-full/); assert.match(anchor.props.className, /whitespace-normal/);
  }
  assert.equal(ui.card().props.lang, 'en'); assert.match(ui.card().props.className, /min-w-0/); assert.match(ui.card().props.className, /overflow-wrap:anywhere/);
  for (const element of ['button', 'input', 'select', 'iframe', 'embed', 'img', 'time'] as const) assert.equal(ui.card().findAllByType(element).length, 0, element);
});

test('research wording does not turn documentation dates or public attribution into a forecast or commercial clearance', () => {
  const ui = mount(); const details = ui.card().findByType('details');
  assert.match(ui.text(), /Research queue · Indonesia/); assert.match(ui.text(), /not a forecast feed or conditions measured on your farm/);
  assert.match(ui.text(), /No Indonesia dossier or locally reviewed crop advice is enabled/);
  assert.match(ui.text(), /Source pages reviewed on 2026-11-05/); assert.match(ui.text(), /not a forecast production, retrieval or validity time/);
  assert.match(ui.text(), /written-permission condition for republication, third-party integration or commercial use/);
  assert.match(ui.text(), /application alongside the open-data guidance remains unresolved/);
  assert.match(ui.text(), /no integration permission or commercial reuse licence is confirmed/);
  assert.match(text(details), /Original HTTP response bodies were not captured/); assert.match(text(details), /no forecast API payload was inspected/);
  assert.match(text(details), /Documentation revision dates are not forecast timestamps/);
  const fields = Object.fromEntries(details.findAllByType('div').filter(row => row.findAllByType('dt').length === 1).map(row => [text(row.findByType('dt')), text(row.findByType('dd'))]));
  assert.equal(fields['Forecast documentation revision'], reference.forecastDocumentationUpdatedOn);
  assert.equal(fields['General terms revision'], reference.generalTermsUpdatedOn);
  for (const key of ['Endpoint authentication', 'Endpoint availability', 'Complete geographic coverage', 'Integration permission', 'Reuse licence']) assert.equal(fields[key], 'UNKNOWN', key);
  assert.equal(fields['Forecast API payload'], 'Not inspected'); assert.equal(fields['Original HTTP response bodies'], 'Not captured'); assert.equal(fields['Forecast freshness'], 'Not assessed'); assert.equal(fields['Conditions applicability'], 'UNRESOLVED');
  assert.doesNotMatch(ui.text(), /latest forecast verified|permission granted|all villages covered|no active warnings|live farm measurements/);
});

test('opening source details keeps links fixed without fetching provider content or approving local planting', () => {
  const ui = mount(); const before = ui.card().findAllByType('a').map(node => node.props.href);
  assert.equal(ui.card().findByType('details').props.open, false);
  assert.match(ui.card().findByType('summary').props.className, /min-h-11/);
  ui.toggle(true); assert.equal(ui.card().findByType('details').props.open, true);
  assert.deepEqual(ui.card().findAllByType('a').map(node => node.props.href), before);
  assert.match(ui.text(), /These source links do not approve plant legality or apply South African crop defaults to Indonesia/);
  ui.toggle(false); assert.equal(ui.card().findByType('details').props.open, false);
});

test('actual parent places Indonesia inside the research queue while pilot choices and readiness remain separate', () => {
  const ui = mount(true); const queue = ui.renderer.root.findByProps({ 'aria-labelledby': 'queue-heading' });
  assert.ok(queue.findAllByType(Card).length === 1); assert.equal(queue.findAllByProps({ 'aria-label': 'Indonesia BMKG research sources' }).length, 1);
  const choices = ui.field('Country').findAllByType('option').map(node => node.props.value);
  assert.deepEqual(choices, [...COUNTRY_PROFILES.map(profile => profile.code), 'OTHER']); assert.equal(choices.includes('ID'), false);
  assert.equal(COUNTRY_PROFILES.some(profile => profile.code === 'ID'), false);
  assert.equal(indonesiaBefore.status, 'unsupported-country'); assert.equal(indonesiaBefore.productionPlanSupported, false); assert.equal(indonesiaBefore.southAfricanFallbackAllowed, false);
  const limits = text(ui.renderer.root.findByProps({ 'aria-label': 'Readiness limits' }));
  const before = text(ui.card()), links = ui.card().findAllByType('a').map(node => node.props.href);
  for (const code of ['BR', 'GB', 'US', 'OTHER', 'KE']) {
    ui.change('Country', code); ui.change('Agricultural region reference', 'Unreviewed entered region');
    assert.equal(text(ui.card()), before); assert.deepEqual(ui.card().findAllByType('a').map(node => node.props.href), links);
    assert.equal(text(ui.renderer.root.findByProps({ 'aria-label': 'Readiness limits' })), limits);
    assert.doesNotMatch(text(ui.card()), /Unreviewed entered region/);
    assert.match(ui.text(), /No agricultural regions have passed local review/);
  }
});
