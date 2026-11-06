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
const key = '__dwdTemperatureDisplayUi';
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
type Reference = Extract<DwdMosmixImportResult, { status: 'available' | 'partial' }>;
const rawValues = [273.1567890123, 0, -0, null, 273.15, Number.MAX_VALUE] as const;
function stationReference(stationId = '01001', values: readonly (number | null)[] = rawValues): Reference {
  const provenance = parseDwdMosmixProvenance({ providerId: DWD_MOSMIX_PROVIDER_ID,
    endpoint: dwdMosmixStationEndpoint({ stationId }), fetchedAt: '2026-11-06T00:02:03.456Z',
    expectedStationId: stationId, kind: 'public-station', referenceOnly: true }); assert.ok(provenance);
  // Extreme/zero fixtures exercise display arithmetic; they are not weather
  // observations, plausible-weather bounds, farm advice or added defaults.
  return Object.freeze({ status: 'partial', station: Object.freeze({ id: stationId, description: 'SYNTHETIC RAW KELVIN' }),
    issuedAt: '2026-11-06T00:00:00.001Z', units: Object.freeze({ temperature: 'K', precipitation: 'kg/m2' }), provenance,
    issues: Object.freeze(['temperature-values-missing'] as const),
    periods: Object.freeze(values.map((temperatureK, index) => Object.freeze({
      validAt: new Date(Date.UTC(2026, 10, 6, 1, index * 2, 0, index * 7)).toISOString(), temperatureK,
      precipitationKgM2: index === 1 ? null : index === 0 ? 0 : 0.1234567890123,
    }))) });
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
  const country = () => renderer.root.findAllByType('label').find(node => text(node).startsWith('Country'))!.findByType('select');
  const region = () => renderer.root.findAllByType('label').find(node => text(node).startsWith('Agricultural region reference'))!.findByType('input');
  return { renderer, card, catalog, uses, catalogButton, country, region, nasaButton, text: () => text(renderer.root),
    unit: () => card().findByType('select'),
    changeUnit(value: unknown) { act(() => card().findByType('select').props.onChange({ target: { value } })); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
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

function periods(ui: ReturnType<typeof mount>) { return ui.card().findByType('ol').findAllByType('li'); }
function datum(node: ReactTestInstance, label: RegExp) {
  const term = node.findAllByType('dt').find(candidate => label.test(text(candidate))); assert.ok(term, 'Missing actual labelled quantity: ' + label);
  const value = term.parent?.findAllByType('dd')[0]; assert.ok(value); return text(value).replace(/\s+/g, ' ').trim();
}
function unitInvariant(ui: ReturnType<typeof mount>) {
  return { stationInput: ui.input().props.value,
    metadata: ui.card().findAllByType('dt').filter(node => /^Station ID|^Station Description|^Issued at|^Retrieved at/.test(text(node))).map(node => [text(node), node.parent?.findAllByType('dd').map(value => text(value))]),
    periods: periods(ui).map(node => ({ validity: node.findAllByType('p').filter(value => /^Valid at/.test(text(value))).map(value => text(value)), precipitation: datum(node, /^Precipitation/) })),
    links: ui.card().findAllByType('a').map(node => [node.props.href, text(node)]),
    caption: text(ui.card()).match(/Showing first \d+ of \d+ source periods/)?.[0],
  };
}

test('every country starts with explicit Kelvin display, a separately labelled touch control and no automatic requests or preference reads', watchdog, context => {
  context.diagnostic(`Actual source hashes: ${JSON.stringify(probe.sourceHashes)}`);
  assert.deepEqual(importEffects, { network: 0, storage: 0 });
  for (const code of codes) {
    const ui = mount(code); assert.equal(ui.unit().props.value, 'K'); assert.equal(ui.input().props.value, '');
    const label = ui.card().findAllByType('label').find(node => /temperature/i.test(text(node))); assert.ok(label);
    assert.equal(label.props.htmlFor, ui.unit().props.id); assert.notEqual(ui.unit().props.id, ui.input().props.id);
    assert.deepEqual(ui.unit().findAllByType('option').map(node => node.props.value), ['K', 'C', 'F']);
    const optionText = ui.unit().findAllByType('option').map(node => text(node));
    assert.match(optionText[0], /Kelvin.*K/); assert.match(optionText[1], /Celsius.*°C/); assert.match(optionText[2], /Fahrenheit.*°F/);
    assert.match(ui.unit().props.className, /min-h-11/); assert.notEqual(ui.unit(), ui.country());
    assert.deepEqual(probe.dwdCalls, []); assert.deepEqual(probe.catalogCalls, []); assert.deepEqual(probe.nasaCalls, []);
  }
});

test('default K renders exact raw fractions, zero, signed-zero source identity and Unknown without formatting or plausibility inference', watchdog, async () => {
  const source = stationReference(), before = JSON.stringify(source); probe.dwdNext = async () => source;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); const rows = periods(ui);
  assert.deepEqual(rows.map(row => datum(row, /^Temperature/)), rawValues.map(value => value === null ? 'Unknown' : `${value} K`));
  assert.ok(Object.is(source.periods[2].temperatureK, -0)); assert.equal(JSON.stringify(source), before);
  assert.match(text(ui.card()), /273\.1567890123 K/);
  assert.doesNotMatch(rows.map(row => datum(row, /^Temperature/)).join(' '), /273\.157 K|°C|°F/);
  // Unit options contain their names; only temperature quantity cells establish
  // whether a conversion is being displayed before a user chooses it.
  assert.equal(ui.unit().props.value, 'K'); assert.equal(probe.dwdCalls.length, 1);
});

test('explicit C and F render from original K with two-digit labels while retaining exact source K beside every converted value', watchdog, async () => {
  const source = stationReference(), before = JSON.stringify(source); probe.dwdNext = async () => source;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); const invariant = unitInvariant(ui);
  ui.changeUnit('C'); let rows = periods(ui);
  const cExpected = ['0.01 °C', '-273.15 °C', '-273.15 °C', 'Unknown', '0 °C'];
  for (let index = 0; index < cExpected.length; index++) assert.ok(datum(rows[index], /^Temperature/).includes(cExpected[index]));
  for (const [index, value] of rawValues.entries()) {
    if (value !== null) assert.ok(text(rows[index]).includes(`Source: ${value} K`), 'Exact source K remains beside C display');
  }
  assert.match(text(ui.card()), /converted|conversion/i); assert.match(text(ui.card()), /display/i);
  assert.deepEqual(unitInvariant(ui), invariant); assert.equal(ui.unit().props.value, 'C');
  ui.changeUnit('F'); rows = periods(ui);
  const fExpected = ['32.01 °F', '-459.67 °F', '-459.67 °F', 'Unknown', '32 °F'];
  for (let index = 0; index < fExpected.length; index++) assert.ok(datum(rows[index], /^Temperature/).includes(fExpected[index]));
  assert.equal(ui.unit().props.value, 'F');
  assert.doesNotMatch(datum(rows[0], /^Temperature/), /32\.02 °F|32\.012/);
  for (const [index, value] of rawValues.entries()) if (value !== null) assert.ok(text(rows[index]).includes(`Source: ${value} K`));
  assert.deepEqual(unitInvariant(ui), invariant); assert.equal(JSON.stringify(source), before); assert.ok(Object.is(source.periods[2].temperatureK, -0));
  assert.equal(source.units.temperature, 'K'); assert.equal(probe.dwdCalls.length, 1);
  ui.changeUnit('K'); assert.deepEqual(periods(ui).map(row => datum(row, /^Temperature/)), rawValues.map(value => value === null ? 'Unknown' : `${value} K`));
});

test('overflowing F conversion is unavailable while the exact finite original K stays visible and null stays Unknown', watchdog, async () => {
  const source = stationReference(); probe.dwdNext = async () => source;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); ui.changeUnit('F');
  const rows = periods(ui), overflow = datum(rows[5], /^Temperature/);
  assert.match(overflow, /conversion unavailable/i); assert.ok(text(rows[5]).includes(`Source: ${Number.MAX_VALUE} K`));
  assert.doesNotMatch(overflow, /Infinity|NaN|(?:^|\s)0 °F/); assert.equal(datum(rows[3], /^Temperature/), 'Unknown');
  assert.equal(source.periods[5].temperatureK, Number.MAX_VALUE); assert.equal(probe.dwdCalls.length, 1);
});

test('invalid unit tokens reject without coercion, source mutation, new requests or display changes', watchdog, async () => {
  let coercions = 0;
  const hostile = Object.defineProperties({}, { toString: { get() { coercions++; throw Error('PRIVATE_UNIT_COERCION'); } },
    [Symbol.toPrimitive]: { get() { coercions++; throw Error('PRIVATE_UNIT_PRIMITIVE'); } } });
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); ui.changeUnit('C'); const before = text(ui.card());
  for (const value of ['c', ' C', 'C ', '°C', '°F', 'CELSIUS', '', null, undefined, 0, false, hostile, new String('F'), Symbol('F')]) {
    ui.changeUnit(value); assert.equal(ui.unit().props.value, 'C'); assert.equal(text(ui.card()), before); assert.equal(coercions, 0);
  }
  assert.deepEqual(probe.dwdCalls, [[{ stationId: '01001' }]]); assert.deepEqual(probe.catalogCalls, []); assert.deepEqual(probe.nasaCalls, []);
});

test('display changes preserve a current idle Check handler and do not clear an already displayed reference', watchdog, async () => {
  const ui = mount('GB'); ui.edit('01001'); const check = ui.button().props.onClick;
  ui.changeUnit('C'); await act(async () => { check(); await Promise.resolve(); });
  assert.equal(probe.dwdCalls.length, 1); assert.ok(datum(periods(ui)[0], /^Temperature/).includes('0.01 °C'));
  ui.changeUnit('F'); assert.equal(periods(ui).length, 6); assert.equal(probe.dwdCalls.length, 1);
});

for (const completion of ['resolve', 'reject'] as const) test(`a pending forecast ${completion} survives an explicit unit change without duplicate work or generation retirement`, watchdog, async () => {
  const waiting = deferred<DwdMosmixImportResult>(); probe.dwdNext = () => waiting.promise;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation();
  const selection = ui.selection(); ui.changeUnit('F'); assert.equal(ui.unit().props.value, 'F');
  assert.equal(ui.input().props.value, '01001'); assert.equal(ui.selection(), selection); assert.equal(ui.button().props.disabled, true);
  assert.deepEqual(probe.dwdCalls, [[{ stationId: '01001' }]]);
  await settle(() => completion === 'resolve' ? waiting.resolve(stationReference()) : waiting.reject(Error('PRIVATE_PENDING_UNIT_ERROR')));
  assert.equal(ui.button().props.disabled, false); assert.equal(ui.unit().props.value, 'F');
  if (completion === 'resolve') assert.ok(datum(periods(ui)[0], /^Temperature/).includes('32.01 °F'));
  else { assert.match(text(ui.card()), /reference check could not be completed/i); assert.doesNotMatch(text(ui.card()), /PRIVATE_PENDING_UNIT_ERROR/); }
  assert.equal(probe.dwdCalls.length, 1);
});

test('invalid choices while pending do not retire the request or supply a replacement measurement', watchdog, async () => {
  const waiting = deferred<DwdMosmixImportResult>(); probe.dwdNext = () => waiting.promise;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); ui.changeUnit('°C'); ui.changeUnit(' C ');
  assert.equal(ui.unit().props.value, 'K'); await settle(() => waiting.resolve(stationReference()));
  assert.equal(datum(periods(ui)[0], /^Temperature/), '273.1567890123 K'); assert.equal(probe.dwdCalls.length, 1);
});

test('retained unit callbacks cannot change display after another render or K-C-K ABA, including station input rerenders', watchdog, async () => {
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); const oldK = ui.unit().props.onChange;
  ui.changeUnit('C'); act(() => oldK({ target: { value: 'F' } })); assert.equal(ui.unit().props.value, 'C');
  ui.changeUnit('K'); act(() => oldK({ target: { value: 'F' } })); assert.equal(ui.unit().props.value, 'K');
  const oldUnit = ui.unit().props.onChange; ui.edit('01234'); act(() => oldUnit({ target: { value: 'C' } }));
  assert.equal(ui.unit().props.value, 'K'); assert.equal(ui.input().props.value, '01234'); assert.equal(probe.dwdCalls.length, 1);
});

test('unit choice survives catalogue selection, new results, region and NASA rerenders without resetting either reference card', watchdog, async () => {
  const ui = mount('GB'); ui.changeUnit('F'); ui.editQuery('0'); await ui.searchCatalog(); ui.choose(1);
  assert.equal(ui.unit().props.value, 'F'); assert.equal(ui.input().props.value, 'A051'); assert.deepEqual(probe.dwdCalls, []);
  await ui.checkStation(); const forecastBefore = text(ui.card()), catalogBefore = text(ui.catalog()), selection = ui.selection();
  act(() => ui.region().props.onChange({ target: { value: 'Unreviewed entered region' } }));
  assert.equal(ui.unit().props.value, 'F'); assert.equal(text(ui.card()), forecastBefore); assert.equal(ui.selection(), selection);
  await ui.checkClimate(); assert.equal(ui.unit().props.value, 'F'); assert.equal(text(ui.card()), forecastBefore);
  assert.equal(text(ui.catalog()), catalogBefore); assert.equal(ui.selection(), selection);
  assert.deepEqual(probe.dwdCalls, [[{ stationId: 'A051' }]]); assert.deepEqual(probe.catalogCalls, [['0']]); assert.deepEqual(probe.nasaCalls, [['GB']]);
});

for (const navigation of ['country', 'hint'] as const) test(`actual ${navigation} card-owner ABA resets Kelvin and retires old unit callbacks without automatic work`, watchdog, () => {
  const ui = mount('GB'); ui.changeUnit('C'); const old = ui.unit().props.onChange;
  if (navigation === 'country') { ui.changeCountry('US'); assert.equal(ui.unit().props.value, 'K'); ui.changeCountry('GB'); }
  else { ui.updateHint('US'); assert.equal(ui.unit().props.value, 'K'); ui.updateHint('GB'); }
  assert.equal(ui.unit().props.value, 'K'); act(() => old({ target: { value: 'F' } })); assert.equal(ui.unit().props.value, 'K');
  assert.equal(ui.input().props.value, ''); assert.deepEqual(probe.dwdCalls, []); assert.deepEqual(probe.catalogCalls, []); assert.deepEqual(probe.nasaCalls, []);
});

test('an unmounted unit handler cannot change a fresh card or persist a preferred unit', watchdog, () => {
  const old = mount('GB'); old.changeUnit('F'); const callback = old.unit().props.onChange; old.dispose();
  const current = mount('GB'); act(() => callback({ target: { value: 'C' } })); assert.equal(current.unit().props.value, 'K');
  assert.deepEqual(probe.dwdCalls, []); assert.deepEqual(probe.catalogCalls, []); assert.deepEqual(probe.nasaCalls, []);
});

test('unit rendering preserves the first-twelve source period cap, all UTC meanings, precipitation and attribution', watchdog, async () => {
  const source = stationReference('01001', Array.from({ length: 15 }, (_, index) => index === 1 ? null : 273.1567890123));
  const before = JSON.stringify(source); probe.dwdNext = async () => source;
  const ui = mount('GB'); ui.edit('01001'); await ui.checkStation(); const invariant = unitInvariant(ui);
  assert.equal(periods(ui).length, 12); assert.match(text(ui.card()), /Showing first 12 of 15 source periods/);
  for (const unit of ['C', 'F', 'K']) {
    ui.changeUnit(unit); assert.deepEqual(unitInvariant(ui), invariant); assert.equal(JSON.stringify(source), before);
    assert.equal(periods(ui).length, 12); assert.equal(probe.dwdCalls.length, 1);
    assert.ok(text(ui.card()).includes(source.issuedAt)); assert.ok(text(ui.card()).includes(source.provenance.fetchedAt));
    source.periods.slice(0, 12).forEach(period => assert.ok(text(ui.card()).includes(period.validAt)));
    source.periods.slice(12).forEach(period => assert.ok(!text(ui.card()).includes(period.validAt)));
  }
});
