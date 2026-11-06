import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { DwdMosmixImportResult } from '../lib/international/providers/dwd-mosmix-import.ts';
import type { ClimateReferenceResult } from '../lib/international/providers/nasa-reference.ts';
import type { CountryReviewProps } from '../components/international/countries/CountryReview.tsx';

const root = new URL('../', import.meta.url).href;
const parentUrl = new URL('../components/international/countries/CountryReview.tsx', import.meta.url).href;
const cardUrl = new URL('../components/international/countries/DwdStationReference.tsx', import.meta.url).href;
const catalogUrl = new URL('../components/international/countries/DwdStationCatalogSearch.tsx', import.meta.url).href;
const nasaUrl = new URL('../lib/international/providers/nasa-reference.ts', import.meta.url).href;
const key = '__dwdCountryReviewUi';
const prior = new Map([key, 'fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const effects = { network: 0, storage: 0 };
const probe = {
  dwdCalls: [] as unknown[][], nasaCalls: [] as unknown[][],
  dwdNext: (async () => stationReference()) as (...args: unknown[]) => Promise<DwdMosmixImportResult>,
  nasaNext: (async () => climateReference()) as (...args: unknown[]) => Promise<ClimateReferenceResult>,
  sourceHashes: {} as Record<string, string>,
};
const noStorage = () => { effects.storage++; throw Error('Country review must not acquire or change private saved context'); };
const noFetch = () => { effects.network++; throw Error('Only isolated explicit action transport belongs in this rendered test'); };
const browser = Object.defineProperties({}, { localStorage: { get: noStorage }, sessionStorage: { get: noStorage } });
for (const [name, descriptor] of Object.entries({ [key]: { value: probe }, fetch: { value: noFetch },
  window: { value: browser }, localStorage: { get: noStorage }, sessionStorage: { get: noStorage },
  IS_REACT_ACT_ENVIRONMENT: { value: true } })) Object.defineProperty(globalThis, name, { configurable: true, ...descriptor });
const moduleText = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const otherCards = { './NwsForecastReference': 'US', './CountyBulletinReference': 'KE',
  './EaRainfallReference': 'GB', './InmetAlertLinks': 'BR', './BmkgResearchLinks': 'research-queue' };
// The real parent, DWD card, parser, navigation, registry and readiness execute.
// Framework chrome/CSS and unrelated cards are isolated; both provider transports
// return synthetic decoded DTOs. This is neither browser nor live-provider proof.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === parentUrl) {
      if (specifier === 'next/link') return moduleText(`import React from ${JSON.stringify(import.meta.resolve('react'))};
        export default function Link({children,...props}){return React.createElement('a',props,children);}`);
      if (specifier === '@/components/MenuButton') return moduleText('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return moduleText('export function useRegisterBackControl(){}');
      if (specifier === './CountryReview.module.css') return moduleText('export default {};');
      // Catalogue search is now a real mounted child. Keep the existing eight
      // parent claims intact while prohibiting its unrequested transport work;
      // the separate composed suite owns explicit Search -> Use -> Check.
      if (specifier === '@/app/international/dwd-catalog-actions') return moduleText(`
        export function searchDwdStationCatalogReference(){return globalThis.fetch('forbidden-unrequested-catalogue-action');}`);
      if (Object.hasOwn(otherCards, specifier)) return moduleText(`import React from ${JSON.stringify(import.meta.resolve('react'))};
        export default function OtherReference(){return React.createElement('section',{'data-other-public-reference':${JSON.stringify(otherCards[specifier as keyof typeof otherCards])}});}`);
      if (specifier === '@/lib/international/providers/nasa-reference') return moduleText(`export * from ${JSON.stringify(nasaUrl)};
        export function fetchCountryClimateReference(...args){const p=globalThis.${key};p.nasaCalls.push(args);return p.nasaNext(...args);}`);
    }
    if (context.parentURL === cardUrl && specifier === '@/app/international/dwd-mosmix-actions') return moduleText(`
      export function checkDwdStationReference(...args){const p=globalThis.${key};p.dwdCalls.push(args);return p.dwdNext(...args);}`);
    return next(specifier, context);
  },
  load(url, context, next) {
    if ([parentUrl, cardUrl, catalogUrl].includes(url)) {
      const source = readFileSync(new URL(url), 'utf8');
      probe.sourceHashes[url] = createHash('sha256').update(source).digest('hex');
      return { shortCircuit: true, format: 'module', source: ts.transpileModule(source,
        { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    }
    return next(url, context);
  },
});
const { COUNTRY_PROFILES } = await import('../lib/international/countries/registry.ts');
const { evaluateCountryReadiness } = await import('../lib/international/countries/readiness.ts');
const { COUNTRY_CLIMATE_DEMOS, NASA_REFERENCE_PROVIDER } = await import('../lib/international/providers/nasa-reference.ts');
const { parseDwdStationRequest, parseDwdMosmixProvenance, dwdMosmixStationEndpoint, DWD_MOSMIX_PROVIDER_ID } =
  await import('../lib/international/providers/dwd-mosmix-request.ts');
const { default: CountryReviewModule } = await import('../components/international/countries/CountryReview.tsx');
const CountryReview: React.ComponentType<CountryReviewProps> = CountryReviewModule;
const { default: DwdStationReference } = await import('../components/international/countries/DwdStationReference.tsx');
const importEffects = { ...effects }, profilesBefore = JSON.stringify(COUNTRY_PROFILES);
const codes = [...COUNTRY_PROFILES.map(profile => profile.code), 'OTHER'];
const asOf = '2026-11-06';
const readiness = () => codes.map(countryCode => evaluateCountryReadiness({ countryCode,
  agriculturalRegionId: '', interfaceLanguage: 'en' }, asOf));
const readinessBefore = readiness();
const mounted = new Set<ReactTestRenderer>();
const watchdog = { timeout: 3_000 };
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function stationReference(stationId = '01001', description = 'SYNTHETIC_DWD_REFERENCE'): DwdMosmixImportResult {
  const provenance = parseDwdMosmixProvenance({ providerId: DWD_MOSMIX_PROVIDER_ID,
    endpoint: dwdMosmixStationEndpoint({ stationId }), fetchedAt: '2026-11-06T00:02:03.456Z',
    expectedStationId: stationId, kind: 'public-station', referenceOnly: true });
  assert.ok(provenance);
  return { status: 'partial', station: { id: stationId, description }, issuedAt: '2026-11-06T00:00:00.001Z',
    units: { temperature: 'K', precipitation: 'kg/m2' }, provenance, issues: ['precipitation-values-missing'],
    periods: [{ validAt: '2026-11-06T01:00:00.007Z', temperatureK: 0, precipitationKgM2: null }] };
}
function climateReference(description = 'SYNTHETIC_NASA_REFERENCE'): ClimateReferenceResult {
  return { status: 'available', units: 'C', monthly: Array.from({ length: 12 }, (_, index) => ({ month: index + 1,
    state: 'value' as const, valueC: 0 })), period: { start: '2001-01', end: '2002-12', description },
    dataset: { apiVersion: 'synthetic', sources: ['Synthetic transport fixture'], timeStandard: 'UTC' },
    provenance: { providerId: NASA_REFERENCE_PROVIDER.id, attribution: 'Synthetic public reference attribution',
      fetchedAt: '2026-11-06T00:02:03.456Z', endpoint: null, demoPlace: 'Synthetic public coarse demo', referenceOnly: true } };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
async function settle(operation: () => void) { await act(async () => { operation(); await Promise.resolve(); }); }
function mount(countryHint: unknown = 'KE') {
  let renderer!: ReactTestRenderer;
  const element = (hint: unknown) => React.createElement(CountryReview, { countryHint: hint });
  act(() => { renderer = create(element(countryHint)); }); mounted.add(renderer);
  const card = () => renderer.root.findByType(DwdStationReference).findByType('section');
  const nasaButton = () => renderer.root.findAllByType('button').find(node => /^Check(?:ing)? public reference/.test(text(node)))!;
  const country = () => renderer.root.findByType('select');
  const region = () => renderer.root.findAllByType('label').find(node => text(node).startsWith('Agricultural region reference'))!.findByType('input');
  return { renderer, card, country, region, nasaButton, text: () => text(renderer.root),
    input: () => card().findByType('input'), button: () => card().findByType('button'),
    limits: () => text(renderer.root.findByProps({ 'aria-label': 'Readiness limits' })),
    edit(value: string) { act(() => card().findByType('input').props.onChange({ target: { value } })); },
    changeCountry(value: string) { act(() => country().props.onChange({ target: { value } })); },
    updateHint(hint: unknown) { act(() => renderer.update(element(hint))); },
    async checkStation() { await act(async () => { card().findByType('button').props.onClick(); await Promise.resolve(); }); },
    async checkClimate() { await act(async () => { nasaButton().props.onClick(); await Promise.resolve(); }); },
  };
}
beforeEach(() => {
  effects.network = effects.storage = 0; probe.dwdCalls.length = probe.nasaCalls.length = 0;
  probe.dwdNext = async input => { const request = parseDwdStationRequest(input); assert.ok(request); return stationReference(request.stationId); };
  probe.nasaNext = async () => climateReference();
});
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.deepEqual(effects, { network: 0, storage: 0 });
  assert.equal(JSON.stringify(COUNTRY_PROFILES), profilesBefore);
  assert.deepEqual(readiness(), readinessBefore, 'A public station response must not grant a dossier or change readiness');
});
after(() => {
  hooks.deregister();
  for (const [name, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
  }
});

test('the actual country parent offers one blank station card for every dossier and no-dossier selection without automatic work', watchdog, context => {
  context.diagnostic(`Actual loaded source hashes: ${JSON.stringify(probe.sourceHashes)}`);
  assert.deepEqual(importEffects, { network: 0, storage: 0 });
  for (const code of codes) {
    const ui = mount(code);
    assert.equal(ui.country().props.value, code); assert.equal(ui.renderer.root.findAllByType(DwdStationReference).length, 1);
    assert.equal(ui.input().props.value, ''); assert.match(text(ui.card()), /No station forecast has been requested/);
    assert.equal(ui.card().props.lang, 'en'); assert.match(text(ui.card()), /No relationship.*reviewed country.*inferred/);
    assert.equal(ui.nasaButton().props.disabled, !Object.hasOwn(COUNTRY_CLIMATE_DEMOS, code));
    const other = ui.renderer.root.findAll(node => node.props['data-other-public-reference'] !== undefined)
      .map(node => node.props['data-other-public-reference']).filter(value => value !== 'research-queue');
    assert.deepEqual(other, code === 'OTHER' ? [] : [code]);
    assert.match(ui.limits(), /International production planning is unavailable/);
    assert.equal(probe.dwdCalls.length, 0); assert.equal(probe.nasaCalls.length, 0);
  }
});

test('the station card and existing country cards have distinct sibling reconciliation identities', watchdog, () => {
  const original = console.error, duplicateKeys: string[] = [];
  try {
    console.error = (...args: unknown[]) => {
      const message = args.filter((value): value is string => typeof value === 'string').join(' ');
      if (/Encountered two children with the same key/.test(message)) duplicateKeys.push(message);
      Reflect.apply(original, console, args);
    };
    const ui = mount('KE');
    for (const code of ['GB', 'US', 'BR', 'OTHER', 'KE']) {
      ui.changeCountry(code); assert.equal(ui.renderer.root.findAllByType(DwdStationReference).length, 1);
    }
    assert.deepEqual(duplicateKeys, [], 'Equal country strings must not collide between separate provider-card siblings');
  } finally { console.error = original; }
});

test('public station input and explicit results work even without a country dossier and do not enable NASA or local planning', watchdog, async () => {
  const ui = mount('OTHER'), limits = ui.limits();
  ui.edit('01001'); assert.equal(probe.dwdCalls.length, 0); await ui.checkStation();
  assert.deepEqual(probe.dwdCalls, [[{ stationId: '01001' }]]); assert.equal(probe.nasaCalls.length, 0);
  assert.match(text(ui.card()), /SYNTHETIC_DWD_REFERENCE/); assert.match(text(ui.card()), /0 K/); assert.match(text(ui.card()), /Unknown/);
  assert.equal(ui.limits(), limits); assert.equal(ui.nasaButton().props.disabled, true);
  await ui.checkClimate(); assert.equal(probe.nasaCalls.length, 0);
  assert.match(ui.text(), /No reviewed dossier/); assert.match(ui.text(), /No demo available/);
});

test('region-only parent rerenders preserve current station input and result without mounting a new owner or fetching', watchdog, async () => {
  const ui = mount('GB'); ui.edit('A051'); await ui.checkStation(); const cardBefore = text(ui.card());
  act(() => ui.region().props.onChange({ target: { value: 'Unreviewed entered region' } }));
  assert.equal(ui.input().props.value, 'A051'); assert.equal(text(ui.card()), cardBefore);
  assert.equal(probe.dwdCalls.length, 1); assert.equal(probe.nasaCalls.length, 0);
  assert.match(ui.text(), /No agricultural regions have passed local review/);
});

for (const completion of ['resolve', 'reject'] as const) test(`actual country-change A-B-A keys retire pending station handlers and late ${completion}`, watchdog, async () => {
  const waiting = deferred<DwdMosmixImportResult>(); probe.dwdNext = () => waiting.promise;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation();
  const oldCheck = ui.button().props.onClick, oldInput = ui.input().props.onChange;
  assert.equal(ui.country().props.disabled, false, 'DWD pending does not borrow the independent NASA pending gate');
  ui.changeCountry('US'); assert.equal(ui.input().props.value, '');
  ui.changeCountry('GB'); assert.equal(ui.input().props.value, '');
  act(() => { oldCheck(); oldInput({ target: { value: 'EW002' } }); }); assert.equal(probe.dwdCalls.length, 1);
  await settle(() => completion === 'resolve' ? waiting.resolve(stationReference('01001', 'LATE_COUNTRY_DWD')) : waiting.reject(Error('PRIVATE_OLD_COUNTRY_ERROR')));
  assert.equal(ui.input().props.value, ''); assert.match(text(ui.card()), /No station forecast has been requested/);
  assert.doesNotMatch(ui.text(), /LATE_COUNTRY_DWD|PRIVATE_OLD_COUNTRY_ERROR|reference check could not be completed/);
  probe.dwdNext = async () => stationReference('A051'); ui.edit('A051'); await ui.checkStation();
  assert.deepEqual(probe.dwdCalls, [[{ stationId: '01001' }], [{ stationId: 'A051' }]]); assert.equal(probe.nasaCalls.length, 0);
});

test('a country-hint replacement also resets the actual card and permanently retires the earlier successful owner callbacks', watchdog, async () => {
  const ui = mount('KE'); ui.edit('01001'); await ui.checkStation();
  const oldCheck = ui.button().props.onClick, oldInput = ui.input().props.onChange;
  ui.updateHint('US'); assert.equal(ui.country().props.value, 'US'); assert.equal(ui.input().props.value, '');
  ui.updateHint('KE'); assert.equal(ui.country().props.value, 'KE'); assert.equal(ui.input().props.value, '');
  act(() => { oldCheck(); oldInput({ target: { value: 'A051' } }); });
  assert.equal(ui.input().props.value, ''); assert.equal(probe.dwdCalls.length, 1); assert.equal(probe.nasaCalls.length, 0);
  assert.doesNotMatch(text(ui.card()), /SYNTHETIC_DWD_REFERENCE/);
});

test('NASA remains an explicit independent reference with its own pending and response retirement gates', watchdog, async () => {
  const nasa = deferred<ClimateReferenceResult>(); probe.nasaNext = () => nasa.promise;
  const ui = mount('GB'), limits = ui.limits(); await ui.checkClimate();
  const oldNasa = ui.nasaButton().props.onClick; assert.deepEqual(probe.nasaCalls, [['GB']]);
  assert.equal(ui.country().props.disabled, true); assert.equal(ui.input().props.disabled, false);
  ui.edit('01001'); await ui.checkStation(); assert.deepEqual(probe.dwdCalls, [[{ stationId: '01001' }]]);
  assert.match(text(ui.card()), /SYNTHETIC_DWD_REFERENCE/); assert.equal(ui.country().props.disabled, true);
  assert.equal(ui.limits(), limits);
  // Programmatic change exercises the real parent generation gate while its
  // disabled DOM select would prevent an ordinary user action during NASA work.
  ui.changeCountry('US'); assert.equal(ui.input().props.value, '');
  await settle(() => nasa.resolve(climateReference('LATE_COUNTRY_NASA')));
  act(() => oldNasa()); assert.deepEqual(probe.nasaCalls, [['GB']]); assert.doesNotMatch(ui.text(), /LATE_COUNTRY_NASA/);
  probe.nasaNext = async () => climateReference('CURRENT_US_NASA'); await ui.checkClimate();
  assert.deepEqual(probe.nasaCalls, [['GB'], ['US']]); assert.match(ui.text(), /CURRENT_US_NASA/);
  assert.equal(probe.dwdCalls.length, 1); assert.equal(ui.input().props.value, '');
  assert.match(text(ui.card()), /No station forecast has been requested/); assert.equal(ui.limits(), limits);
});
