import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { decodeNwsObservation, SONOMA_NWS_REFERENCE, type NwsObservationResult } from '../lib/international/providers/nws-observation.ts';
import { evaluateCountryReadiness } from '../lib/international/countries/readiness.ts';

const probe = { authCalls: 0, token: async () => 'synthetic-ui-token' };
const originalProbe = Object.getOwnPropertyDescriptor(globalThis, '__nwsUiAuth');
const originalAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT');
Object.assign(globalThis, { __nwsUiAuth: probe, IS_REACT_ACT_ENVIRONMENT: true });
const dataModule = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/lib/api-client-auth.ts') && specifier === '@/lib/firebase/init') return dataModule(`
      export const getFirebase=()=>({auth:{currentUser:{getIdToken(){const p=globalThis.__nwsUiAuth;p.authCalls++;return p.token();}}}});
    `);
    if (context.parentURL?.endsWith('/components/international/countries/CountryReview.tsx')) {
      if (specifier === '@/components/MenuButton' || specifier === 'next/link') return dataModule('export default function Navigation(){return null;}');
      if (specifier === '@/components/BackControl') return dataModule('export function useRegisterBackControl(){}');
      // The paired help-flow/overlap tests own this unrelated chat boundary;
      // the country view, station card, decoder and auth helper remain real.
      if (specifier === '@/components/LimaBar') return dataModule('export default function LimaHelpBoundary(){return null;}');
    }
    if (specifier.endsWith('.css')) return dataModule('export default new Proxy({}, {get:(_,key)=>key});');
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/international/countries/NwsStationReference.tsx')
      || url.endsWith('/components/international/countries/CountryReview.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: NwsStationReference } = await import('../components/international/countries/NwsStationReference.tsx');
const { default: CountryReview } = await import('../components/international/countries/CountryReview.tsx');
after(() => {
  hooks.deregister();
  for (const [key, original] of [['__nwsUiAuth', originalProbe], ['IS_REACT_ACT_ENVIRONMENT', originalAct]] as const) {
    if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key);
  }
});

// Synthetic published station data, never a measurement of the grower's farm.
const observedAt = '2030-03-01T00:30:00+00:00', fetchedAt = '2030-03-01T01:00:00.000Z';
function fixture(retrievedAt = fetchedAt): NwsObservationResult {
  const station = { id: SONOMA_NWS_REFERENCE.metadataUrl, type: 'Feature', geometry: { type: 'Point', coordinates: [-122.81667, 38.5] },
    properties: { stationIdentifier: 'KSTS', name: 'Synthetic public station', timeZone: 'America/Los_Angeles', provider: 'ASOS-HFM' } };
  const observation = { id: `${SONOMA_NWS_REFERENCE.metadataUrl}/observations/${observedAt}`, type: 'Feature',
    geometry: { type: 'Point', coordinates: [-122.82, 38.52] }, properties: { station: SONOMA_NWS_REFERENCE.metadataUrl, stationId: 'KSTS', timestamp: observedAt,
      temperature: { value: 0, unitCode: 'wmoUnit:degC', qualityControl: 'V' },
      dewpoint: { value: null, unitCode: 'wmoUnit:degC', qualityControl: 'Z' },
      windSpeed: { value: 12, unitCode: 'unsupported:knots', qualityControl: 'V' },
      precipitationLastHour: { value: 0, unitCode: 'wmoUnit:mm', qualityControl: 'V' } } };
  const result = decodeNwsObservation(station, observation, retrievedAt);
  assert.equal(result.status, 'partial'); return result;
}
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
let originalFetch: typeof fetch;
let calls: Array<{ url: string; init?: RequestInit }>;
let responder: typeof fetch;
beforeEach(() => {
  probe.authCalls = 0; probe.token = async () => 'synthetic-ui-token'; calls = [];
  responder = async () => json(fixture()); originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    assert.equal(String(url), '/api/international/weather-reference?reference=sonoma-ksts', 'UI must use its bounded same-origin reference route');
    return responder(url, init);
  };
});
afterEach(() => { globalThis.fetch = originalFetch; });

function screen(country = false) {
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(country ? CountryReview : NwsStationReference)); });
  const button = () => {
    const found = renderer.root.findAllByType('button').find(node => text(node) === 'Load public station observations');
    assert.ok(found); return found;
  };
  return { renderer, text: () => text(renderer.root),
    click() { act(() => { button().props.onClick(); }); },
    async load() { await act(async () => { button().props.onClick(); }); },
    country(code: string) { act(() => { renderer.root.findByType('select').props.onChange({ target: { value: code } }); }); },
    reading(label: string) {
      const term = renderer.root.findAllByType('dt').find(node => text(node) === label); assert.ok(term);
      const group = term.parent!; return text(group.findByType('dd'));
    },
    point(label: string) {
      const term = renderer.root.findAllByType('dt').find(node => text(node) === label); assert.ok(term);
      const siblings = term.parent!.children, value = siblings[siblings.indexOf(term) + 1];
      assert.ok(value && typeof value !== 'string' && value.type === 'dd'); return text(value);
    },
    dispose() { act(() => { renderer.unmount(); }); },
  };
}

test('the real station card makes no request before consent and sends the actual auth helper headers after a click', async () => {
  const ui = screen(); try {
    assert.equal(probe.authCalls, 0); assert.equal(calls.length, 0);
    assert.match(ui.text(), /fixed public example, not your farm/);
    await ui.load(); assert.equal(probe.authCalls, 1); assert.equal(calls.length, 1);
    assert.equal(new Headers(calls[0].init?.headers).get('authorization'), 'Bearer synthetic-ui-token');
    assert.equal(calls[0].init?.cache, 'no-store'); assert.ok(calls[0].init?.signal instanceof AbortSignal);
    assert.match(ui.text(), /Partial station observations/);
    assert.equal(ui.reading('Air temperature'), '0 °C'); assert.equal(ui.reading('Precipitation in the last hour'), '0 mm');
    assert.equal(ui.reading('Dewpoint'), 'Unknown'); assert.equal(ui.reading('Wind speed'), 'Unknown'); assert.equal(ui.reading('Wind gust'), 'Unknown');
    assert.ok(ui.text().includes(`Observation time, as published: ${observedAt}. Retrieved: ${fetchedAt}.`));
    assert.match(ui.text(), /Freshness has not been assessed/);
    assert.equal(ui.point('Station point (longitude, latitude)'), '-122.81667, 38.5');
    assert.equal(ui.point('Observation point (longitude, latitude)'), '-122.82, 38.52');
    assert.match(ui.text(), /Station provider: ASOS-HFM/);
    assert.match(ui.text(), /Both are retained; neither is moved onto your farm/);
    assert.match(ui.text(), /unsupported:knots \/ V/); assert.match(ui.text(), /wmoUnit:degC \/ Z/);
  } finally { ui.dispose(); }
});

test('HTTP refusals, provider failure, malformed JSON and invalid response shapes disclose failure without readings or automatic retry', async () => {
  const failed = decodeNwsObservation(null, null, fetchedAt);
  for (const [response, message] of [
    [new Response('{}', { status: 401 }), /Sign in to load/], [new Response('{}', { status: 429 }), /rate-limited/],
    [new Response('{}', { status: 503 }), /could not be loaded/], [json(failed), /provider supplied no usable/],
    [new Response('{broken'), /could not be loaded/], [json({ status: 'partial' }), /could not be loaded/],
    [json(null), /could not be loaded/],
  ] as const) {
    calls = []; responder = async () => response;
    const ui = screen(); try {
      await ui.load(); assert.match(ui.text(), message); assert.equal(calls.length, 1);
      assert.equal(ui.renderer.root.findAllByType('dt').length, 0); assert.doesNotMatch(ui.text(), /Station observations received|Partial station observations/);
      assert.match(ui.text(), /Load public station observations/);
    } finally { ui.dispose(); }
  }
});

test('malformed units, timestamps, points, provider identity and freshness claims cannot become supported station readings', async () => {
  const mutations: Array<(value: Exclude<NwsObservationResult, { status: 'failed' }>) => void> = [
    value => { Object.assign(value.measurements, { temperature: { state: 'value', value: 123, unitCode: 'wmoUnit:km_h-1', qualityControl: 'V' } }); },
    value => { value.observedAt = '2030-02-30T12:00:00Z'; },
    value => { value.provenance.fetchedAt = 'not-a-source-time'; },
    value => { value.stationPoint.coordinates = [181, 38.5]; },
    value => { Object.assign(value.observationPoint, { type: 'Polygon' }); },
    value => { Object.assign(value.provenance, { providerId: 'different-provider' }); },
    value => { Object.assign(value, { freshness: 'current' }); },
    value => { Object.assign(value, { status: 'available' }); },
  ];
  for (const mutate of mutations) {
    const value = fixture(); assert.notEqual(value.status, 'failed'); if (value.status === 'failed') return;
    mutate(value); responder = async () => json(value);
    const ui = screen(); try {
      await ui.load(); assert.doesNotMatch(ui.text(), /123 km\/h|Partial station observations|Station observations received/);
      assert.match(ui.text(), /could not be loaded/); assert.equal(ui.renderer.root.findAllByType('dt').length, 0);
    } finally { ui.dispose(); }
  }
});

test('authentication and transport failures do not invent a station result', async () => {
  for (const boundary of ['authentication', 'transport'] as const) {
    calls = []; probe.token = boundary === 'authentication' ? async () => { throw Error('synthetic authentication failure'); } : async () => 'synthetic-ui-token';
    responder = async () => { throw Error('synthetic transport failure'); };
    const ui = screen(); try {
      await ui.load(); assert.match(ui.text(), /could not be loaded/);
      assert.equal(calls.length, boundary === 'authentication' ? 0 : 1);
      assert.equal(ui.renderer.root.findAllByType('dt').length, 0);
    } finally { ui.dispose(); }
  }
});

test('a source observation after retrieval is disclosed instead of acquiring a current-conditions label', async () => {
  responder = async () => json(fixture('2030-02-28T23:00:00.000Z'));
  const ui = screen(); try {
    await ui.load(); assert.match(ui.text(), /published observation time is after the retrieval time/);
    assert.match(ui.text(), /Freshness has not been assessed/); assert.equal(ui.reading('Air temperature'), '0 °C');
  } finally { ui.dispose(); }
});

test('unmount during pending authentication, response or JSON body withdraws the generation before any late work is shown', async () => {
  for (const phase of ['auth', 'response', 'body'] as const) {
    calls = []; const auth = deferred<string>(), response = deferred<Response>(), body = deferred<unknown>();
    probe.token = phase === 'auth' ? () => auth.promise : async () => 'synthetic-ui-token';
    responder = phase === 'response' ? () => response.promise : phase === 'body'
      ? async () => ({ ok: true, json: () => body.promise }) as Response : async () => json(fixture());
    const ui = screen(); ui.click(); await act(async () => { await Promise.resolve(); });
    assert.equal(calls.length, phase === 'auth' ? 0 : 1, phase); ui.dispose();
    if (calls[0]) assert.equal(calls[0].init?.signal?.aborted, true, phase);
    await act(async () => { auth.resolve('synthetic-ui-token'); response.resolve(json(fixture())); body.resolve(fixture()); });
    assert.equal(calls.length, phase === 'auth' ? 0 : 1, phase); assert.equal(ui.renderer.toJSON(), null);
  }
});

test('actual country switching removes US observations and withdraws pending authentication or responses without approving planning', async () => {
  const ui = screen(true); try {
    assert.doesNotMatch(ui.text(), /Observe a public weather station/); assert.equal(calls.length, 0);
    ui.country('US'); assert.match(ui.text(), /Observe a public weather station/); assert.equal(calls.length, 0);
    await ui.load(); assert.match(ui.text(), /Synthetic public station/);
    assert.match(ui.text(), /Reference only\. International production planning is unavailable/);
    assert.equal(evaluateCountryReadiness({ countryCode: 'US' }, '2030-03-01').productionPlanSupported, false);
    ui.country('GB'); assert.doesNotMatch(ui.text(), /Observe a public weather station|Synthetic public station|Observation time, as published/);
    ui.country('US'); assert.doesNotMatch(ui.text(), /Synthetic public station/); assert.equal(calls.length, 1);
    for (const phase of ['auth', 'response'] as const) {
      const auth = deferred<string>(), response = deferred<Response>(); const before: number = calls.length;
      probe.token = phase === 'auth' ? () => auth.promise : async () => 'synthetic-ui-token';
      responder = phase === 'response' ? () => response.promise : async () => json(fixture());
      ui.click(); await act(async () => { await Promise.resolve(); }); ui.country('BR');
      await act(async () => { auth.resolve('synthetic-ui-token'); response.resolve(json(fixture())); });
      assert.equal(calls.length, before + (phase === 'auth' ? 0 : 1), phase);
      assert.doesNotMatch(ui.text(), /Observe a public weather station|Synthetic public station|Observation time, as published/);
      assert.match(ui.text(), /International production planning is unavailable/); ui.country('US');
    }
  } finally { ui.dispose(); }
});

test('the generation deadline covers stalled authentication, response and body, aborting I/O and ignoring late completions', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const phase of ['auth', 'response', 'body'] as const) {
    calls = []; const auth = deferred<string>(), response = deferred<Response>(), body = deferred<unknown>();
    probe.token = phase === 'auth' ? () => auth.promise : async () => 'synthetic-ui-token';
    responder = phase === 'response' ? () => response.promise : phase === 'body'
      ? async () => ({ ok: true, json: () => body.promise }) as Response : async () => json(fixture());
    const ui = screen(); try {
      ui.click(); await act(async () => { await Promise.resolve(); });
      assert.equal(calls.length, phase === 'auth' ? 0 : 1, phase);
      act(() => { t.mock.timers.tick(20_000); });
      assert.match(ui.text(), /timed out/); assert.match(ui.text(), /Load public station observations/);
      if (calls[0]) assert.equal(calls[0].init?.signal?.aborted, true);
      await act(async () => { auth.resolve('synthetic-ui-token'); response.resolve(json(fixture())); body.resolve(fixture()); });
      assert.equal(calls.length, phase === 'auth' ? 0 : 1, phase); assert.doesNotMatch(ui.text(), /Partial station observations/);
    } finally { ui.dispose(); }
  }
});
