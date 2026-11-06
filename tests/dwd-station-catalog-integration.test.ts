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
import type { DwdMosmixLiveCatalogSearchResult } from '../lib/international/providers/dwd-mosmix-http.ts';
import type { DwdMosmixCatalogSearchResult } from '../lib/international/providers/dwd-mosmix-catalog-search.ts';
import type { CountryReviewProps } from '../components/international/countries/CountryReview.tsx';
import type { DwdStationCatalogSearchProps } from '../components/international/countries/DwdStationCatalogSearch.tsx';

const root = new URL('../', import.meta.url).href;
const parentUrl = new URL('../components/international/countries/CountryReview.tsx', import.meta.url).href;
const cardUrl = new URL('../components/international/countries/DwdStationReference.tsx', import.meta.url).href;
const catalogUrl = new URL('../components/international/countries/DwdStationCatalogSearch.tsx', import.meta.url).href;
const nasaUrl = new URL('../lib/international/providers/nasa-reference.ts', import.meta.url).href;
type CatalogResult = DwdMosmixLiveCatalogSearchResult | DwdMosmixCatalogSearchResult;
const key = '__dwdCatalogIntegrationUi';
const prior = new Map([key, 'fetch', 'window', 'localStorage', 'sessionStorage', 'IS_REACT_ACT_ENVIRONMENT']
  .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const effects = { network: 0, storage: 0 };
const probe = {
  dwdCalls: [] as unknown[][], nasaCalls: [] as unknown[][], catalogCalls: [] as unknown[][],
  catalogNext: (async () => catalogReference()) as (...args: unknown[]) => Promise<CatalogResult>,
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
// The real parent, both DWD cards, query/station/catalogue authorities, navigation
// and readiness execute. Only framework chrome, unrelated cards and provider
// transports are isolated; no real catalogue/forecast or browser is claimed.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === parentUrl) {
      if (specifier === 'next/link') return moduleText(`import React from ${JSON.stringify(import.meta.resolve('react'))};
        export default function Link({children,...props}){return React.createElement('a',props,children);}`);
      if (specifier === '@/components/MenuButton') return moduleText('export default function Menu(){return null;}');
      if (specifier === '@/components/BackControl') return moduleText('export function useRegisterBackControl(){}');
      if (specifier === './CountryReview.module.css') return moduleText('export default {};');
      if (specifier === '@/app/international/dwd-catalog-actions') return moduleText(`
        export function searchDwdStationCatalogReference(...args){const p=globalThis.${key};p.catalogCalls.push(args);return p.catalogNext(...args);}`);
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
const { default: CatalogSearchModule } = await import('../components/international/countries/DwdStationCatalogSearch.tsx');
const CatalogSearch: React.ComponentType<DwdStationCatalogSearchProps> = CatalogSearchModule;
const { parseDwdMosmixCatalogSearchQuery, searchDwdMosmixStationCatalogBytes } = await import('../lib/international/providers/dwd-mosmix-catalog-search.ts');
const { DWD_MOSMIX_CATALOG_ENDPOINT } = await import('../lib/international/providers/dwd-mosmix-http.ts');
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
  const catalog = () => renderer.root.findByType(CatalogSearch).findByType('section');
  const uses = () => catalog().findAllByType('button').filter(node => /^Use station /.test(text(node)));
  const catalogButton = () => catalog().findAllByType('button').find(node => !/^Use station /.test(text(node)))!;
  const nasaButton = () => renderer.root.findAllByType('button').find(node => /^Check(?:ing)? public reference/.test(text(node)))!;
  const country = () => renderer.root.findByType('select');
  const region = () => renderer.root.findAllByType('label').find(node => text(node).startsWith('Agricultural region reference'))!.findByType('input');
  return { renderer, card, catalog, uses, catalogButton, country, region, nasaButton, text: () => text(renderer.root),
    query: () => catalog().findByType('input'),
    parentSelect: () => renderer.root.findByType(CatalogSearch).props.onSelectStation as DwdStationCatalogSearchProps['onSelectStation'],
    selection: () => renderer.root.findByType(DwdStationReference).props.selection,
    editQuery(value: string) { act(() => catalog().findByType('input').props.onChange({ target: { value } })); },
    choose(index = 0) { act(() => uses()[index].props.onClick()); },
    async searchCatalog() { await act(async () => { catalogButton().props.onClick(); await Promise.resolve(); }); },
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
  effects.network = effects.storage = 0; probe.dwdCalls.length = probe.nasaCalls.length = probe.catalogCalls.length = 0;
  probe.dwdNext = async input => { const request = parseDwdStationRequest(input); assert.ok(request); return stationReference(request.stationId); };
  probe.nasaNext = async () => climateReference();
  probe.catalogNext = async query => { const parsed = parseDwdMosmixCatalogSearchQuery(query); assert.ok(parsed); return catalogReference(parsed); };
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

const catalogFetchedAt = '2026-11-06T02:03:04.567Z';
function catalogBytes() {
  const ascii = (value: string) => new TextEncoder().encode(value);
  function row(id: string, name: Uint8Array) {
    // Opaque ignored position columns are engineering fixtures, not coordinates.
    const bytes = new Uint8Array(52).fill(32); assert.equal(id.length, 5); assert.ok(name.length <= 20);
    bytes.set(ascii(id), 0); bytes.set(ascii('ABCD'), 6); bytes.set(name, 11);
    bytes.set(ascii('ABCDEF'), 32); bytes.set(ascii('GHIJKLM'), 39); bytes.set(ascii('NOPQR'), 47); return bytes;
  }
  const parts = [ascii('ID    ICAO NAME                 LAT    LON     ELEV'), ascii('----- ---- -------------------- -----  ------- -----'),
    row('01234', ascii('SYNTHETIC ALPHA')), row(' A051', new Uint8Array([0xe9])), row('AB123', ascii('SYNTHETIC GAMMA'))];
  const bytes = new Uint8Array(parts.reduce((n, part) => n + part.length + 1, 0)); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; bytes[offset++] = 10; } return bytes;
}
function catalogReference(query = '0', live = true): CatalogResult {
  const result = searchDwdMosmixStationCatalogBytes(catalogBytes(), query); assert.notEqual(result.status, 'failed');
  if (result.status === 'failed') throw Error('Independent catalogue fixture failed actual admission');
  return live ? { ...result, provenance: { providerId: 'dwd-mosmix-station-catalog-reference', kind: 'public-station-catalog',
    endpoint: DWD_MOSMIX_CATALOG_ENDPOINT, fetchedAt: catalogFetchedAt, referenceOnly: true } } : result;
}
function assertBlank(ui: ReturnType<typeof mount>) {
  assert.equal(ui.query().props.value, ''); assert.equal(ui.input().props.value, ''); assert.equal(ui.uses().length, 0);
  assert.match(text(ui.catalog()), /No catalogue search has been requested/); assert.match(text(ui.card()), /No station forecast has been requested/);
}

test('actual parent mount and ordinary edits never retrieve a catalogue, choose a station or request a forecast', watchdog, context => {
  context.diagnostic(`Actual composed source hashes: ${JSON.stringify(probe.sourceHashes)}`);
  assert.deepEqual(importEffects, { network: 0, storage: 0 }); const ui = mount('OTHER'); assertBlank(ui);
  ui.editQuery('0'); assert.equal(ui.input().props.value, '');
  assert.deepEqual(probe.catalogCalls, []); assert.deepEqual(probe.dwdCalls, []); assert.deepEqual(probe.nasaCalls, []);
  assert.match(ui.text(), /only fills the ID below/); assert.match(ui.text(), /Press Check station reference/);
  assert.equal(ui.nasaButton().props.disabled, true);
});

test('explicit Search returns canonical IDs and UTC provenance; Use fills only, and separate Check requests exactly that station', watchdog, async () => {
  const ui = mount('GB'), limits = ui.limits(); ui.editQuery('  0  '); await ui.searchCatalog();
  assert.deepEqual(probe.catalogCalls, [['0']]); assert.deepEqual(probe.dwdCalls, []); assert.equal(ui.input().props.value, '');
  assert.deepEqual(ui.uses().map(node => text(node)), ['Use station 01234', 'Use station A051']);
  assert.match(text(ui.catalog()), /Retrieved at \(UTC\):/); assert.ok(text(ui.catalog()).includes(catalogFetchedAt));
  assert.match(text(ui.catalog()), /Unknown/); assert.match(text(ui.catalog()), /Showing 2 of 2/);
  ui.choose(1); assert.equal(ui.input().props.value, 'A051'); assert.deepEqual(probe.dwdCalls, []);
  assert.deepEqual(ui.selection(), { stationId: 'A051' }); assert.ok(Object.isFrozen(ui.selection()));
  assert.match(text(ui.card()), /No station forecast has been requested/); assert.equal(ui.uses().length, 2);
  await ui.checkStation(); assert.deepEqual(probe.dwdCalls, [[{ stationId: 'A051' }]]);
  assert.match(text(ui.card()), /0 K/); assert.match(text(ui.card()), /Unknown/); assert.equal(ui.limits(), limits);
  assert.deepEqual(probe.nasaCalls, []); assert.equal(probe.catalogCalls.length, 1);
});

test('live zero-match counts and their retrieval time never prefill a station or trigger a forecast', watchdog, async () => {
  const ui = mount('GB'); ui.editQuery('absent'); await ui.searchCatalog();
  assert.match(text(ui.catalog()), /Showing 0 of 0/); assert.ok(text(ui.catalog()).includes(catalogFetchedAt));
  assert.match(text(ui.catalog()), /does not mean no relevant station exists/);
  assert.equal(ui.uses().length, 0); assert.equal(ui.input().props.value, ''); assert.deepEqual(probe.dwdCalls, []);
});

test('a separately supplied pure search result labels retrieval Unknown instead of fabricating a live server receipt', watchdog, async () => {
  let renderer!: ReactTestRenderer; const selections: string[] = [], calls: string[] = [];
  act(() => { renderer = create(React.createElement(CatalogSearch, {
    searchCatalog: async query => { calls.push(query); return catalogReference(query, false); },
    onSelectStation: stationId => { selections.push(stationId); },
  })); }); mounted.add(renderer);
  act(() => renderer.root.findByType('input').props.onChange({ target: { value: '0' } }));
  await act(async () => { renderer.root.findAllByType('button')[0].props.onClick(); await Promise.resolve(); });
  assert.match(text(renderer.root), /Retrieved at \(UTC\): Unknown/); assert.ok(!text(renderer.root).includes(catalogFetchedAt));
  assert.deepEqual(calls, ['0']); assert.deepEqual(selections, []); assert.deepEqual(probe.dwdCalls, []);
});

test('choosing a different or the same canonical ID clears previous forecast data and always requires another explicit Check', watchdog, async () => {
  const ui = mount('GB'); ui.editQuery('0'); await ui.searchCatalog(); ui.choose(); await ui.checkStation();
  assert.equal(ui.input().props.value, '01234'); assert.match(text(ui.card()), /SYNTHETIC_DWD_REFERENCE/);
  ui.choose(1); assert.equal(ui.input().props.value, 'A051'); assert.doesNotMatch(text(ui.card()), /SYNTHETIC_DWD_REFERENCE/);
  assert.equal(probe.dwdCalls.length, 1); await ui.checkStation(); const oldCheck = ui.button().props.onClick;
  ui.choose(1); assert.equal(ui.input().props.value, 'A051'); assert.doesNotMatch(text(ui.card()), /SYNTHETIC_DWD_REFERENCE/);
  act(() => oldCheck()); assert.equal(probe.dwdCalls.length, 2);
  await ui.checkStation(); assert.deepEqual(probe.dwdCalls, [[{ stationId: '01234' }], [{ stationId: 'A051' }], [{ stationId: 'A051' }]]);
  assert.equal(probe.catalogCalls.length, 1);
});

for (const selected of ['01234', 'A051'] as const) for (const completion of ['resolve', 'reject'] as const) {
  test(`selection ${selected} alone retires an earlier forecast ${completion} before any new Check can advance its generation`, watchdog, async () => {
    const waiting = deferred<DwdMosmixImportResult>(); probe.dwdNext = () => waiting.promise;
    const ui = mount('GB'); ui.edit('01234'); await ui.checkStation();
    ui.editQuery('0'); await ui.searchCatalog(); ui.choose(selected === '01234' ? 0 : 1);
    const selectedView = text(ui.card()); assert.match(selectedView, /No station forecast has been requested/);
    assert.equal(ui.input().props.value, selected); assert.equal(ui.button().props.disabled, false);
    await settle(() => completion === 'resolve' ? waiting.resolve(stationReference('01234', 'LATE_SELECTION_ONLY_FORECAST')) : waiting.reject(Error('PRIVATE_SELECTION_ONLY_ERROR')));
    assert.equal(text(ui.card()), selectedView, 'Selection itself retires the old reply, independently of any subsequent Check');
    assert.equal(ui.input().props.value, selected); assert.equal(ui.button().props.disabled, false); assert.equal(probe.dwdCalls.length, 1);
    probe.dwdNext = async () => stationReference(selected); await ui.checkStation();
    assert.deepEqual(probe.dwdCalls.at(-1), [{ stationId: selected }]); assert.equal(probe.dwdCalls.length, 2);
  });
  test(`selection ${selected} retires an earlier pending forecast ${completion} without borrowing its finalizer`, watchdog, async () => {
    const old = deferred<DwdMosmixImportResult>(), current = deferred<DwdMosmixImportResult>();
    probe.dwdNext = () => probe.dwdCalls.length === 1 ? old.promise : current.promise;
    const ui = mount('GB'); ui.edit('01234'); await ui.checkStation(); const oldCheck = ui.button().props.onClick;
    ui.editQuery('0'); await ui.searchCatalog(); ui.choose(selected === '01234' ? 0 : 1);
    assert.equal(ui.input().props.value, selected); assert.equal(ui.button().props.disabled, false);
    assert.match(text(ui.card()), /No station forecast has been requested/); assert.equal(probe.dwdCalls.length, 1);
    act(() => oldCheck()); assert.equal(probe.dwdCalls.length, 1);
    await ui.checkStation(); assert.equal(ui.button().props.disabled, true); assert.equal(probe.dwdCalls.length, 2);
    await settle(() => completion === 'resolve' ? old.resolve(stationReference('01234', 'LATE_RETIRED_FORECAST')) : old.reject(Error('PRIVATE_RETIRED_FORECAST_ERROR')));
    assert.equal(ui.button().props.disabled, true); assert.equal(ui.input().props.value, selected);
    assert.doesNotMatch(text(ui.card()), /LATE_RETIRED_FORECAST|PRIVATE_RETIRED_FORECAST_ERROR|could not be completed/);
    await settle(() => current.resolve(stationReference(selected, 'CURRENT_CHOSEN_FORECAST')));
    assert.equal(ui.button().props.disabled, false); assert.match(text(ui.card()), /CURRENT_CHOSEN_FORECAST/);
    assert.deepEqual(probe.dwdCalls.at(-1), [{ stationId: selected }]);
  });
}

test('region and NASA parent rerenders preserve the canonical selection object, callback, query, results and forecast', watchdog, async () => {
  const ui = mount('GB'); ui.editQuery('0'); await ui.searchCatalog(); ui.choose(1); await ui.checkStation();
  const selection = ui.selection(), select = ui.parentSelect(), catalogBefore = text(ui.catalog()), forecastBefore = text(ui.card());
  act(() => ui.region().props.onChange({ target: { value: 'Unreviewed entered region' } }));
  assert.equal(ui.selection(), selection); assert.equal(ui.parentSelect(), select); assert.equal(text(ui.catalog()), catalogBefore);
  assert.equal(text(ui.card()), forecastBefore); assert.equal(ui.query().props.value, '0');
  const nasa = deferred<ClimateReferenceResult>(); probe.nasaNext = () => nasa.promise; await ui.checkClimate();
  assert.equal(ui.selection(), selection); assert.equal(ui.parentSelect(), select); assert.equal(text(ui.card()), forecastBefore);
  assert.equal(text(ui.catalog()), catalogBefore); assert.equal(ui.query().props.disabled, false);
  await settle(() => nasa.resolve(climateReference('CURRENT_INDEPENDENT_NASA')));
  assert.equal(ui.selection(), selection); assert.equal(ui.parentSelect(), select); assert.equal(text(ui.catalog()), catalogBefore);
  assert.equal(text(ui.card()), forecastBefore); assert.match(ui.text(), /CURRENT_INDEPENDENT_NASA/);
  assert.deepEqual(probe.catalogCalls, [['0']]); assert.deepEqual(probe.dwdCalls, [[{ stationId: 'A051' }]]); assert.deepEqual(probe.nasaCalls, [['GB']]);
});

for (const navigation of ['select', 'hint'] as const) for (const completion of ['resolve', 'reject'] as const) {
  test(`${navigation} country A-B-A clears both cards and permanently retires old parent/card handlers before late ${completion}`, watchdog, async () => {
    const oldCatalog = deferred<CatalogResult>(), oldForecast = deferred<DwdMosmixImportResult>();
    const ui = mount('GB'); ui.editQuery('0'); await ui.searchCatalog(); const oldUse = ui.uses()[0].props.onClick, oldParentSelect = ui.parentSelect();
    probe.catalogNext = () => oldCatalog.promise; await ui.searchCatalog(); const oldSearch = ui.catalogButton().props.onClick;
    probe.dwdNext = () => oldForecast.promise; ui.edit('01234'); await ui.checkStation();
    const oldCheck = ui.button().props.onClick, oldInput = ui.input().props.onChange;
    if (navigation === 'select') { ui.changeCountry('US'); assertBlank(ui); ui.changeCountry('GB'); }
    else { ui.updateHint('US'); assertBlank(ui); ui.updateHint('GB'); }
    assertBlank(ui); const currentView = ui.text();
    act(() => { oldSearch(); oldCheck(); oldUse(); oldParentSelect('A051'); oldInput({ target: { value: 'A051' } }); });
    assertBlank(ui); assert.equal(probe.catalogCalls.length, 2); assert.equal(probe.dwdCalls.length, 1);
    await settle(() => {
      if (completion === 'resolve') { oldCatalog.resolve(catalogReference('0')); oldForecast.resolve(stationReference('01234', 'LATE_COUNTRY_FORECAST')); }
      else { oldCatalog.reject(Error('PRIVATE_COUNTRY_CATALOG_ERROR')); oldForecast.reject(Error('PRIVATE_COUNTRY_FORECAST_ERROR')); }
    });
    assert.equal(ui.text(), currentView); assertBlank(ui); assert.deepEqual(probe.nasaCalls, []);
  });
}

test('the actual current parent selection callback rejects untrusted IDs without coercion or changing an existing selection', watchdog, async () => {
  const ui = mount('GB'); ui.editQuery('0'); await ui.searchCatalog(); ui.choose();
  const choose = ui.parentSelect(), selection = ui.selection(); let coercions = 0;
  const hostile = Object.defineProperties({}, { toString: { get() { coercions++; throw Error('PRIVATE_COERCION'); } },
    [Symbol.toPrimitive]: { get() { coercions++; throw Error('PRIVATE_PRIMITIVE'); } } });
  for (const value of ['', '01234 ', 'a051', 'A051\n', 'https://untrusted.invalid/01234', null, undefined, 1234, hostile, ['01234']]) {
    act(() => Reflect.apply(choose, undefined, [value])); assert.equal(ui.selection(), selection); assert.equal(ui.input().props.value, '01234');
  }
  assert.equal(coercions, 0); assert.deepEqual(probe.dwdCalls, []); assert.deepEqual(probe.catalogCalls, [['0']]);
});

const httpFailureCopy = {
  'invalid-options': /could not start/i, timeout: /timed out/i, 'network-error': /could not be reached/i,
  'rate-limited': /limited this request/i, 'http-error': /returned an error/i,
  'malformed-response': /could not be verified/i, 'response-too-large': /too large/i,
} satisfies Record<Exclude<Extract<DwdMosmixLiveCatalogSearchResult, { endpoint: string }>['reason'], 'invalid-station'>, RegExp>;
for (const reason of Object.keys(httpFailureCopy) as (keyof typeof httpFailureCopy)[]) {
  test(`catalogue ${reason} stays static and cannot offer a station or trigger a replacement forecast`, watchdog, async () => {
    probe.catalogNext = async () => ({ status: 'failed', reason, endpoint: DWD_MOSMIX_CATALOG_ENDPOINT, provenance: null,
      ...(reason === 'rate-limited' ? { httpStatus: 429, retryAfterSeconds: 0 } : {}) });
    const ui = mount('OTHER'); ui.editQuery('0'); await ui.searchCatalog();
    assert.match(text(ui.catalog()), httpFailureCopy[reason]); assert.match(text(ui.catalog()), /No automatic retry/);
    assert.equal(ui.uses().length, 0); assert.equal(ui.input().props.value, ''); assert.deepEqual(probe.dwdCalls, []);
    assert.equal(probe.catalogCalls.length, 1); assert.deepEqual(probe.nasaCalls, []);
  });
}
