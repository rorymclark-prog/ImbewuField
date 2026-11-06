import assert from 'node:assert/strict';
import test, { after, afterEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { COUNTRY_PROFILES } from '../lib/international/countries/registry.ts';
import { evaluateCountryReadiness } from '../lib/international/countries/readiness.ts';

const prior = new Map(['fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const effects = { network: 0, storage: 0 };
const forbiddenStorage = () => { effects.storage++; throw Error('Country research cannot save a site description'); };
const forbiddenFetch = () => { effects.network++; throw Error('Following planning instructions needs no provider request'); };
const browser = Object.defineProperties({}, { localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage } });
for (const [key, descriptor] of Object.entries({ fetch: { value: forbiddenFetch }, window: { value: browser },
  localStorage: { get: forbiddenStorage }, sessionStorage: { get: forbiddenStorage }, IS_REACT_ACT_ENVIRONMENT: { value: true } })) {
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
}
const countryUrl = new URL('../components/international/countries/CountryReview.tsx', import.meta.url).href;
const asModule = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// The actual page, registry and readiness rules run. Framework chrome, CSS and
// unrelated provider cards are boundaries; this is not navigation/browser QA.
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === countryUrl) {
    if (specifier.endsWith('.module.css')) {
      const css = readFileSync(new URL(specifier, countryUrl), 'utf8');
      const classes = Object.fromEntries([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map(match => [match[1], match[1]]));
      return asModule(`export default ${JSON.stringify(classes)};`);
    }
    if (specifier === 'next/link') return asModule(`import React from ${JSON.stringify(import.meta.resolve('react'))};
      export default function Link({children,...props}){return React.createElement('a',props,children);}`);
    if (specifier === '@/components/MenuButton') return asModule('export default function Menu(){return null;}');
    if (specifier === '@/components/BackControl') return asModule('export function useRegisterBackControl(){}');
    if (['./NwsForecastReference', './CountyBulletinReference', './EaRainfallReference', './InmetAlertLinks', './BmkgResearchLinks'].includes(specifier)) {
      return asModule('export default function ProviderBoundary(){return null;}');
    }
  }
  return next(specifier, context);
}, load(url, context, next) {
  if (url === countryUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
const beforeProfiles = JSON.stringify(COUNTRY_PROFILES);
const pilotCodes = ['KE', 'GB', 'US', 'BR'] as const;
const readinessBefore = pilotCodes.map(countryCode => evaluateCountryReadiness({ countryCode, agriculturalRegionId: '', interfaceLanguage: 'en' }, '2026-11-06'));
const mounted = new Set<ReactTestRenderer>();
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 });
  assert.equal(JSON.stringify(COUNTRY_PROFILES), beforeProfiles);
});
after(() => {
  hooks.deregister();
  for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

for (const countryCode of pilotCodes) test(`${countryCode} growers can find own-estimate planning without approving local guidance or saving research selections`, () => {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(CountryReview)); }); mounted.add(renderer);
  const country = renderer.root.findAllByType('select')[0];
  act(() => country.props.onChange({ target: { value: countryCode } }));
  const region = renderer.root.findAllByType('input')[0];
  act(() => region.props.onChange({ target: { value: 'Unreviewed engineering region' } }));
  const entry = renderer.root.findByProps({ 'aria-labelledby': 'own-estimates-heading' });
  const links = entry.findAllByType('a');
  assert.deepEqual(links.map(link => link.props.href), ['/facilitator/crops', '/farmer']);
  for (const link of links) { assert.equal(link.props.prefetch, false); assert.match(link.props.className, /min-h-11/); }
  assert.match(text(entry), /Site country and region.*choose the country and confirm the site description/);
  assert.match(text(entry), /country selector on this page explores reference evidence; it does not save site details/);
  assert.match(text(entry), /Automatic plan from your estimates/);
  assert.match(text(entry), /saved buyer target, or add household or trial demand/);
  assert.match(text(entry), /confirm the available growing space/);
  assert.match(text(entry), /Incomplete inputs or changed source records can hold a review/);
  assert.match(text(entry), /do not supply a locally reviewed crop calendar or record an actual planting or harvest/);
  const limits = text(renderer.root.findByProps({ 'aria-label': 'Readiness limits' }));
  assert.match(limits, /Locally reviewed crop calendars and catalogue guidance are unavailable/);
  assert.doesNotMatch(limits, /International production planning is unavailable/);
  assert.match(limits, /South African defaults are never applied by this foundation/);
  const readinessAfter = pilotCodes.map(code => evaluateCountryReadiness({ countryCode: code, agriculturalRegionId: '', interfaceLanguage: 'en' }, '2026-11-06'));
  assert.deepEqual(readinessAfter, readinessBefore);
  assert.ok(readinessAfter.every(value => value.productionPlanSupported === false && value.southAfricanFallbackAllowed === false));
});
