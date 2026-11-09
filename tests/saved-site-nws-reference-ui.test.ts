import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { bindSiteContext, createSiteCountryContext, resolveSiteCountryContext, type SiteContextResolution } from '../lib/international/site-context.ts';
import type { SavedPlace } from '../lib/saved-places.ts';
import type { NwsPointResult } from '../lib/international/providers/nws-public-demo.ts';

type Point = { latitude4: string; longitude4: string };
const expectedPoint = { latitude4: '38.1234', longitude4: '-77.1234' };
const probe = { uid: 'point-owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(),
  errors: new Set<() => void>(), calls: [] as Point[], next: (async (point: Point) => available(point)) as (point: Point) => Promise<NwsPointResult> };
const prior = new Map(['window', 'localStorage', 'sessionStorage', '__savedPointUi', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __savedPointUi: probe, IS_REACT_ACT_ENVIRONMENT: true });
const componentUrl = new URL('../components/international/countries/SavedSiteNwsReference.tsx', import.meta.url).href;
const prefsUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// The real component, saved-place reader, country resolver, sample storage and
// shared actor/sample proof run here. Only Firebase, browser storage primitives
// and server-action transport are controlled; no NWS network request is made.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === componentUrl && specifier === '@/app/international/nws-actions') return data(`
      export const checkNwsPointReference=point=>{const p=globalThis.__savedPointUi;p.calls.push(structuredClone(point));return p.next(point);};`);
    if ((specifier === './firebase/init' || specifier === '@/lib/firebase/init') && context.parentURL?.includes('/lib/')) return data(`
      export const isBackendConfigured=()=>true;
      export const getFirebase=()=>({db:null,auth:{get currentUser(){const uid=globalThis.__savedPointUi.uid;return uid?{uid}:null;}}});`);
    if (context.parentURL === prefsUrl && specifier === 'firebase/auth') return data(`
      export function onAuthStateChanged(_auth,next,error){const p=globalThis.__savedPointUi;p.auth.add(next);p.errors.add(error);
        return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
    if (specifier === 'firebase/firestore' && context.parentURL?.endsWith('/lib/user-sync.ts')) return data(`
      export const doc=()=>null;export const getDoc=async()=>null;export const setDoc=async()=>{};
      export const onSnapshot=()=>()=>{};export const runTransaction=async()=>null;export const serverTimestamp=()=>null;`);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === componentUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
      { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  },
});

class MemoryStorage {
  rows = new Map<string, string>(); writes = 0;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, String(value)); }
  removeItem(key: string) { this.writes++; this.rows.delete(key); }
  clear() { this.rows.clear(); }
}
let local: MemoryStorage, session: MemoryStorage, events: EventTarget;
const { default: Card } = await import('../components/international/countries/SavedSiteNwsReference.tsx');
const account = await import('../lib/account-local-storage.ts');
const places = await import('../lib/saved-places.ts');
const sandbox = await import('../lib/sample-mode.ts');
const mounted = new Set<ReactTestRenderer>();
const SITE = 'site:38.12341,-77.12341';
const stamp = '2026-11-01T12:00:00.000Z';
function place(id = 'private-alias-a', lat = 38.12341, lon = -77.12341): SavedPlace {
  const row: SavedPlace = { id, name: 'PRIVATE SITE LABEL', lat, lon, biome: 'Fixture', rainfall: 0, elevation: 0,
    savedAt: stamp, updatedAt: 100, notes: 'PRIVATE NOTE' };
  const siteId = `site:${lat.toFixed(5)},${lon.toFixed(5)}`;
  row.siteCountryContext = bindSiteContext(createSiteCountryContext({ siteId, countryCode: 'US', confirmed: true,
    jurisdictionReference: 'PRIVATE JURISDICTION', agriculturalRegionReference: 'PRIVATE REGION' }, '2026-11-02T12:00:00.000Z')!, row)!;
  return row;
}
function seed(rows: SavedPlace[], uid = probe.uid) {
  local.rows.set(account.accountLocalStorageKey('permamap_saved_places', uid), JSON.stringify(rows));
}
function resolution(siteId = SITE) { return resolveSiteCountryContext(places.loadPlaces(), siteId); }
function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
function mount(siteId = SITE, displayed = resolution(siteId), strict = false) {
  let renderer!: ReactTestRenderer;
  const element = (id: string, value: SiteContextResolution) => React.createElement(Card, { siteId: id, resolution: value });
  act(() => { renderer = create(strict ? React.createElement(React.StrictMode, null, element(siteId, displayed)) : element(siteId, displayed)); });
  mounted.add(renderer);
  return { renderer, text: () => text(renderer.root), button: () => renderer.root.findByType('button'),
    async click() { await act(async () => { renderer.root.findByType('button').props.onClick(); await Promise.resolve(); }); },
    update(id: string, value = resolution(id)) { act(() => renderer.update(element(id, value))); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); } };
}
function available(point: Point = expectedPoint): Extract<NwsPointResult, { status: 'available' | 'partial' }> {
  return { status: 'available', units: 'C', metadata: { generatedAt: '2026-11-05T06:01:00+00:00', updateTime: '2026-11-05T00:30:00+00:00',
    validTimes: '2026-11-05T01:00:00+00:00/P7DT11H', sourceUnits: 'si' },
    provenance: { providerId: 'nws-forecast-reference', referenceOnly: true, kind: 'requested-point', requestedPoint: { ...point },
      endpoint: 'https://api.weather.gov/gridpoints/LWX/1,2/forecast?units=si', fetchedAt: '2026-11-05T06:02:03.456Z' },
    periods: [{ number: 1, name: 'Synthetic zero', startTime: '2026-11-05T06:00:00-05:00', endTime: '2026-11-05T18:00:00-05:00',
      isDaytime: true, temperatureC: 0, precipitationPercent: 0, shortForecast: 'Source summary', detailedForecast: 'Synthetic source detail.' },
    { number: 2, name: null, startTime: '2026-11-05T18:00:00-05:00', endTime: '2026-11-06T06:00:00-05:00',
      isDaytime: false, temperatureC: null, precipitationPercent: null, shortForecast: null, detailedForecast: 'Prose does not supply missing measurements.' }] };
}
function deferred() {
  let resolve!: (value: NwsPointResult) => void, reject!: (reason: Error) => void;
  const promise = new Promise<NwsPointResult>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function emit(type = 'permamap-places-changed') { events.dispatchEvent(new Event(type)); }
function actor(uid: string) {
  probe.uid = uid; account.bindMountedAccountLocalStorageUid(uid);
  for (const notify of [...probe.auth]) if (probe.auth.has(notify)) notify({ uid });
}
function sample(value: boolean) {
  if (value) session.rows.set('imbewu_sample_mode', '1'); else session.rows.delete('imbewu_sample_mode');
  emit('imbewu-sample-mode-changed');
}
beforeEach(() => {
  probe.calls = []; probe.uid = 'point-owner-a'; probe.next = async point => available(point);
  account.bindMountedAccountLocalStorageUid(probe.uid);
  local = new MemoryStorage(); session = new MemoryStorage();
  events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.assign(globalThis, { window: events, localStorage: local, sessionStorage: session }); seed([place()]);
});
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
});
after(() => {
  account.bindMountedAccountLocalStorageUid(null); hooks.deregister();
  for (const [key, descriptor] of prior) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});

test('mount has no request or data, discloses the coarsened URL and keeps the explicit button at least 44 pixels', () => {
  const ui = mount(); assert.equal(probe.calls.length, 0); assert.equal(local.writes, 0); assert.equal(session.writes, 0);
  assert.match(ui.text(), /rounded to four decimal places.*National Weather Service.*upstream request URL/);
  assert.match(ui.text(), /does not prove jurisdiction/); assert.match(ui.text(), /No forecast has been requested/);
  assert.doesNotMatch(ui.text(), /PRIVATE|0 °C|0%/); assert.match(ui.button().props.className, /min-h-11/);
});

test('explicit request sends only the coarsened pair and keeps native zero, Unknown, source prose and original time strings', async () => {
  const result = available(), before = JSON.stringify(result); probe.next = async () => result;
  const ui = mount(); await ui.click(); assert.deepEqual(probe.calls, [expectedPoint]);
  assert.equal(JSON.stringify(result), before); assert.equal(local.writes, 0); assert.equal(session.writes, 0);
  assert.match(ui.text(), /0 °C/); assert.match(ui.text(), /0%/); assert.match(ui.text(), /Period 2: Unknown/);
  assert.match(ui.text(), /Prose does not supply missing measurements/); assert.doesNotMatch(ui.text(), /PRIVATE/);
  const last = ui.renderer.root.findAllByType('li')[1];
  assert.deepEqual(last.findAllByType('dd').slice(-2).map(node => text(node)), ['Unknown', 'Unknown']);
  for (const raw of [result.metadata.generatedAt, result.metadata.updateTime, result.metadata.validTimes, result.provenance.fetchedAt,
    result.periods[0].startTime, result.periods[0].endTime]) assert.ok(ui.text().includes(raw));
  for (const label of ['Source generatedAt', 'Underlying source updateTime', 'Source validTimes interval', 'Response retrieved at'])
    assert.ok(ui.renderer.root.findAllByType('dt').some(node => text(node) === label));
});

test('the request rounds canonical five-decimal coordinates rather than raw geometry and normalizes rounded negative zero', async () => {
  const original = place('canonical-rounding', 0.0000499, 0); seed([original]);
  const ui = mount('site:0.00005,0.00000'); await ui.click();
  assert.deepEqual(probe.calls, [{ latitude4: '0.0001', longitude4: '0.0000' }]);
  assert.equal(places.loadPlaces()[0].lat, original.lat, 'coarsening is delivery only and never mutates saved geometry');
  const negative = place('negative-rounded-zero', -0.00001, 0); seed([negative]); ui.update('site:-0.00001,0.00000'); await ui.click();
  assert.deepEqual(probe.calls[1], { latitude4: '0.0000', longitude4: '0.0000' }); assert.equal(local.writes, 0);
});

test('unknown, conflicting, deleted and mismatched saved context cannot send a point even through a retained US button', () => {
  for (const change of [() => seed([]), () => { const row = place(); delete row.siteCountryContext; seed([row]); },
    () => { const alias = place('other-alias'); alias.siteCountryContext!.countryCode = 'ZA'; seed([place(), alias]); }]) {
    seed([place()]); const ui = mount(), retained = ui.button().props.onClick;
    act(() => { change(); retained(); }); assert.equal(probe.calls.length, 0); ui.dispose();
  }
  seed([place()]); const good = resolution(), wrong = { ...good, context: { ...good.context!, siteId: 'site:1.00000,1.00000' } };
  const ui = mount(SITE, wrong); assert.equal(ui.renderer.root.findAllByType('button').length, 0);
});

test('aliases bind independently to their own revisions and creation stamps without requiring a shared stamp', async () => {
  const a = place(), b = place('private-alias-b'); b.updatedAt = 400; b.savedAt = '2026-10-01T12:00:00.000Z';
  b.siteCountryContext = bindSiteContext(b.siteCountryContext!, b)!; seed([b, a]);
  const ui = mount(); await ui.click(); assert.deepEqual(probe.calls, [expectedPoint]); assert.match(ui.text(), /Point forecast reference received/);
});

test('synchronous duplicate and retained callbacks cannot send twice or reacquire authority after completion', async () => {
  const pending = deferred(); probe.next = () => pending.promise; const ui = mount(), retained = ui.button().props.onClick;
  act(() => { retained(); retained(); }); assert.equal(probe.calls.length, 1); assert.equal(ui.button().props.disabled, true);
  await act(async () => pending.resolve(available())); act(() => retained()); assert.equal(probe.calls.length, 1);
  probe.next = async point => available(point); await ui.click(); assert.equal(probe.calls.length, 2);
});

for (const event of ['permamap-places-changed', 'storage']) test(`${event} retires context-only edit ABA even though updatedAt remains unchanged`, async () => {
  const pending = deferred(); probe.next = () => pending.promise; const ui = mount(), retained = ui.button().props.onClick; await ui.click();
  const original = place(), changed = structuredClone(original); changed.siteCountryContext!.jurisdictionReference = 'Changed context only';
  assert.equal(changed.updatedAt, original.updatedAt);
  act(() => { seed([changed]); emit(event); seed([original]); emit(event); retained(); });
  await act(async () => pending.resolve(available())); assert.equal(probe.calls.length, 1);
  assert.match(ui.text(), /No forecast has been requested/); assert.doesNotMatch(ui.text(), /0 °C|Source generatedAt/);
  probe.next = async point => available(point); await ui.click(); assert.equal(probe.calls.length, 2);
});

for (const change of ['membership', 'latitude', 'revision', 'savedAt', 'confirmation']) test(`full private alias ${change} changes retire a pending request`, async () => {
  const original = place(), second = place('private-alias-b'); seed([original, second]);
  const pending = deferred(); probe.next = () => pending.promise; const ui = mount(); await ui.click();
  const modified = structuredClone(second);
  if (change === 'latitude') modified.lat += 0.000001;
  if (change === 'revision') modified.updatedAt = 101;
  if (change === 'savedAt') modified.savedAt = '2026-10-31T12:00:00.000Z';
  if (change === 'confirmation') modified.siteCountryContext!.confirmedAt = '2026-11-03T12:00:00.000Z';
  act(() => { seed(change === 'membership' ? [original] : [original, modified]); emit(); seed([original, second]); emit(); });
  await act(async () => pending.resolve(available())); assert.match(ui.text(), /No forecast has been requested/);
  assert.doesNotMatch(ui.text(), /0 °C/); assert.equal(probe.calls.length, 1);
});

test('a store change without notification is still re-read immediately before publication', async () => {
  const pending = deferred(); probe.next = () => pending.promise; const ui = mount(); await ui.click(); seed([]);
  await act(async () => pending.resolve(available())); assert.doesNotMatch(ui.text(), /0 °C|Point forecast reference received/);
  assert.match(ui.text(), /No forecast has been requested/);
});

test('observed auth A-B-A and sample on-off retire visible values and old handlers while a new explicit check remains possible', async () => {
  const ui = mount(); await ui.click(); assert.match(ui.text(), /0 °C/); const retained = ui.button().props.onClick;
  act(() => { actor('point-owner-b'); actor('point-owner-a'); retained(); });
  assert.equal(probe.calls.length, 1); assert.doesNotMatch(ui.text(), /0 °C/);
  await ui.click(); assert.equal(probe.calls.length, 2); assert.match(ui.text(), /0 °C/);
  act(() => { sample(true); sample(false); retained(); }); assert.doesNotMatch(ui.text(), /0 °C/);
  assert.equal(probe.calls.length, 2); await ui.click(); assert.equal(probe.calls.length, 3);
});

test('DEMO label reconciles after mount while SSR-equivalent initial text is identical with a saved sample flag', async () => {
  const row = place(); sample(true); sandbox.upsertSandboxPlace(row); const displayed = resolution();
  const element = React.createElement(Card, { siteId: SITE, resolution: displayed });
  const sampleInitial = renderToString(element); session.rows.delete('imbewu_sample_mode'); const realInitial = renderToString(element);
  assert.equal(sampleInitial, realInitial, 'render-time label must not depend on session storage during hydration');
  session.rows.set('imbewu_sample_mode', '1'); const ui = mount(SITE, displayed);
  assert.match(ui.text(), /DEMO.*NWS reference/); assert.equal(probe.calls.length, 0); await ui.click();
  assert.deepEqual(probe.calls, [expectedPoint]); assert.equal(local.writes, 0); assert.equal(session.writes, 0);
});

for (const completion of ['resolve', 'reject']) test(`distinct private sites sharing a coarsened pair cannot inherit old ${completion} or late-finally pending state`, async () => {
  const other = 'site:38.12342,-77.12342'; seed([place(), place('other-private-site', 38.12342, -77.12342)]);
  const old = deferred(), fresh = deferred(); probe.next = () => old.promise; const ui = mount(); await ui.click();
  const retained = ui.button().props.onClick; ui.update(other); probe.next = () => fresh.promise; await ui.click();
  assert.deepEqual(probe.calls, [expectedPoint, expectedPoint]);
  await act(async () => { if (completion === 'resolve') old.resolve(available()); else old.reject(Error('PRIVATE OLD TRANSPORT')); });
  assert.equal(ui.button().props.disabled, true, 'old completion cannot finish a newer pending request');
  assert.doesNotMatch(ui.text(), /0 °C/); act(() => retained()); assert.equal(probe.calls.length, 2);
  await act(async () => fresh.resolve(available())); assert.match(ui.text(), /0 °C/);
  ui.update(SITE); assert.doesNotMatch(ui.text(), /0 °C/); await ui.click(); assert.equal(probe.calls.length, 3);
});

test('a mismatched point provenance is withheld even when the transport reports a successful result', async () => {
  probe.next = async () => available({ latitude4: '1.0000', longitude4: '2.0000' }); const ui = mount(); await ui.click();
  assert.match(ui.text(), /could not be completed/); assert.doesNotMatch(ui.text(), /0 °C|Source generatedAt/);
});

test('bounded failure shows reason, stage, zero retry delay and retrieval time without exposing decoder diagnostics', async () => {
  probe.next = async point => ({ status: 'failed', reason: 'rate-limited', stage: 'forecast', provenance: available(point).provenance,
    httpStatus: 429, retryAfterSeconds: 0, decoderReason: 'PRIVATE DECODER DETAIL' });
  const ui = mount(); await ui.click(); assert.match(ui.text(), /rate-limited/); assert.match(ui.text(), /Request stage: forecast/);
  assert.match(ui.text(), /Reported Retry-After: 0 seconds/); assert.match(ui.text(), /2026-11-05T06:02:03.456Z/);
  assert.doesNotMatch(ui.text(), /PRIVATE|0 °C/); assert.equal(probe.calls.length, 1);
});

test('current transport rejection withholds private error bodies and a fresh explicit retry still works', async () => {
  probe.next = async () => { throw Error('PRIVATE CURRENT TRANSPORT'); }; const ui = mount(); await ui.click();
  assert.match(ui.text(), /could not be completed/); assert.doesNotMatch(ui.text(), /PRIVATE|0 °C/);
  assert.equal(ui.button().props.disabled, false); assert.equal(probe.calls.length, 1);
  probe.next = async point => available(point); await ui.click(); assert.equal(probe.calls.length, 2); assert.match(ui.text(), /0 °C/);
});

for (const completion of ['resolve', 'reject']) test(`unmount retires retained callbacks and late ${completion} cannot deliver into another instance`, async () => {
  const pending = deferred(); probe.next = () => pending.promise; const old = mount(), retained = old.button().props.onClick;
  await old.click(); old.dispose(); const fresh = mount();
  await act(async () => { if (completion === 'resolve') pending.resolve(available()); else pending.reject(Error('PRIVATE TRANSPORT')); });
  act(() => retained()); assert.equal(probe.calls.length, 1); assert.match(fresh.text(), /No forecast has been requested/);
  assert.doesNotMatch(fresh.text(), /0 °C|PRIVATE|could not be completed/);
});

test('StrictMode cleanup/setup replay leaves only fresh explicit request authority and no request on mount', async () => {
  const ui = mount(SITE, resolution(), true); assert.equal(probe.calls.length, 0); await ui.click();
  assert.equal(probe.calls.length, 1); assert.match(ui.text(), /Point forecast reference received/);
});
