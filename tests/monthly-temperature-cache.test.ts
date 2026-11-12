import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, afterEach, beforeEach } from 'node:test';
import ts from 'typescript';
import { monthlyTemperatureStatus } from '../lib/climate-temperature.ts';

// Execute the planner module and the actual page cache callbacks. Only browser
// state/storage, authentication headers and transport are substituted. No live
// provider, saved geometry, sample records or private store is accessed.
const climateUrl = new URL('../lib/site-climate.ts', import.meta.url).href;
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === climateUrl && specifier === '@/lib/api-client-auth') return {
    shortCircuit: true,
    url: 'data:text/javascript,export async function paidApiHeaders(){return {}}',
  };
  return next(specifier, context);
} });
const climate = await import('../lib/site-climate.ts');
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
} }).outputText;
function references(node: ts.Node, name: string): boolean {
  return (ts.isIdentifier(node) && node.text === name)
    || ts.forEachChild(node, child => references(child, name) || undefined) === true;
}
function extract(file: string, functionNames: string[], callbackNames: string[], effectMarker?: string) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map<string, string>(), effects: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name && functionNames.includes(node.name.text)) {
      assert.equal(found.has(node.name.text), false); found.set(node.name.text, node.getText(ast));
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
      && callbackNames.includes(node.name.text)) {
      assert.equal(found.has(node.name.text), false);
      found.set(node.name.text, 'const ' + node.name.text + '=' + node.initializer.getText(ast) + ';');
    }
    if (effectMarker && ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'useEffect' && node.arguments[0]
      && references(node.arguments[0], effectMarker)) effects.push(node.arguments[0].getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(found.size, functionNames.length + callbackNames.length, 'extract each actual source function once');
  if (effectMarker) assert.equal(effects.length, 1, 'exercise the actual location refresh effect');
  return [...found.values()].join('\n') + (effectMarker ? '\nconst refresh=' + effects[0] + ';' : '');
}
const farmerExecutable = compile(extract('../app/farmer/page.tsx', [], ['SITE_MISMATCH', 'handleLocationSelect']));
const designExecutable = compile(extract('../app/design/page.tsx', ['locationDataCacheKey', 'readCachedLocationData', 'cacheLocationData'], [], 'readCachedLocationData'));
const sectorExecutable = compile(extract('../components/design/SectorSummary.tsx', ['resolveSectorContext'], []));
const tankExecutable = compile(extract('../components/design/TankCalculator.tsx', ['resolveCachedRainfall'], []));

const point = { lat: 0.123456, lon: 0.654321 }, other = { lat: 0.123476, lon: 0.654341 };
function location() {
  return { ...point, marker: 'synthetic complete response',
    rainfall: { monthly: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], annual: 365, rainfallSource: 'nasa-power' },
    climate: { monthlyTemp: Array(12).fill(18), monthlyTempCoverage: { source: 'nasa-power', status: 'complete' } },
  };
}
function unproven(kind: 'legacy' | 'incomplete' | 'contradictory') {
  const result = location(); result.marker = kind;
  if (kind === 'legacy') Reflect.deleteProperty(result.climate, 'monthlyTempCoverage');
  if (kind === 'incomplete') result.climate.monthlyTempCoverage.status = 'incomplete';
  if (kind === 'contradictory') result.climate.monthlyTemp[4] = -999;
  return result;
}
class MemoryStorage {
  rows = new Map<string, string>(); writes: string[] = []; removals: string[] = [];
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes.push(key); this.rows.set(key, value); }
  removeItem(key: string) { this.removals.push(key); this.rows.delete(key); }
}
const prior = new Map(['window', 'localStorage', 'fetch'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
let storage: MemoryStorage, requests: string[], transport: (url: string) => Promise<Response>;
const response = (value: unknown) => Response.json(value);
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
beforeEach(() => {
  storage = new MemoryStorage(); requests = [];
  transport = async () => response(location());
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, location: { search: '?lat=' + point.lat + '&lon=' + point.lon } } });
  globalThis.fetch = async input => { const url = String(input); requests.push(url); assert.ok(url.startsWith('/api/location-data?'), 'no network boundary may escape the fixture'); return transport(url); };
});
afterEach(() => {
  for (const [key, descriptor] of prior) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
after(() => hooks.deregister());
function seed(value: unknown, version = 7) {
  const key = 'imbewu_loc_v' + version + '_' + point.lat.toFixed(5) + '_' + point.lon.toFixed(5);
  const bytes = JSON.stringify(value); storage.rows.set(key, bytes); return { key, bytes };
}
function farmer() {
  const state: { data: ReturnType<typeof location> | null; loading: boolean; error: string; sheetOpen: boolean } = { data: null, loading: false, error: '', sheetOpen: false };
  const context = { monthlyTemperatureStatus, localStorage: storage, locationRequest: { current: 0 }, loadPlaces: () => [],
    designSiteIdFromLocation: (value: { lat: number; lon: number }) => JSON.stringify([value?.lat, value?.lon]),
    useCallback: (callback: unknown) => callback, paidApiHeaders: async () => ({}),
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args), networkFailureMessage: () => 'Reload unavailable', t: (key: string) => key,
    setData: (value: ReturnType<typeof location> | null) => { state.data = value; }, setLoading: (value: boolean) => { state.loading = value; },
    setError: (value: string) => { state.error = value; }, setSheetOpen: (value: boolean) => { state.sheetOpen = value; },
    setActivePlaceId() {}, setActivePlaceName() {}, setSelected() {}, setSiteData() {}, setWaterData() {}, setMapCapture() {}, setReportPhotoAnalysis() {},
  };
  const select = new Function('context', 'with(context){' + farmerExecutable + ';return handleLocationSelect;}')(context) as (lat: number, lon: number, options?: { openDetails?: boolean }) => Promise<void>;
  return { state, select, currentData: (): ReturnType<typeof location> | null => state.data };
}
function design() {
  const state: { data: ReturnType<typeof location> | null } = { data: null };
  const context = { window: globalThis.window, localStorage: storage, monthlyTemperatureStatus, hasSite: true, ...point,
    paidApiHeaders: async () => ({}), fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
    setLocationData(value: ReturnType<typeof location> | null) { state.data = value; }, AbortController,
  };
  const refresh = new Function('context', 'with(context){' + designExecutable + ';return refresh;}')(context) as () => () => void;
  return { state, refresh, currentData: (): ReturnType<typeof location> | null => state.data };
}

for (const consumer of ['planner', 'farmer'] as const) test(consumer + ' reuses provider-complete v7 evidence without an automatic request', async () => {
  seed(location());
  if (consumer === 'planner') assert.ok(await climate.resolveSiteClimate(point.lat, point.lon));
  else { const h = farmer(); await h.select(point.lat, point.lon); assert.equal(h.state.data?.marker, 'synthetic complete response'); assert.equal(h.state.sheetOpen, true); }
  assert.equal(requests.length, 0); assert.deepEqual(storage.writes, []); assert.deepEqual(storage.removals, []);
});
for (const kind of ['legacy', 'incomplete', 'contradictory'] as const) for (const consumer of ['planner', 'farmer', 'design'] as const) {
  test(consumer + ' refetches ' + kind + ' v7 cache instead of promoting finite display arrays', async () => {
    const cached = seed(unproven(kind));
    if (consumer === 'planner') assert.ok(await climate.resolveSiteClimate(point.lat, point.lon));
    else if (consumer === 'farmer') { const h = farmer(); const work = h.select(point.lat, point.lon); assert.equal(h.state.data, null); await work; assert.equal(h.currentData()?.marker, 'synthetic complete response'); }
    else { const h = design(); const cleanup = h.refresh(); assert.equal(h.state.data, null); await settle(); assert.equal(h.currentData()?.marker, 'synthetic complete response'); cleanup(); }
    assert.equal(requests.length, 1); assert.deepEqual(storage.writes, [cached.key]); assert.deepEqual(storage.removals, []);
    const stored = JSON.parse(storage.rows.get(cached.key)!); assert.equal(monthlyTemperatureStatus(stored.climate), 'complete');
  });
}
for (const kind of ['legacy', 'incomplete'] as const) for (const consumer of ['planner', 'farmer', 'design'] as const) {
  test(consumer + ' keeps ' + kind + ' v7 evidence unknown when a refetch is unavailable', async () => {
    const cached = seed(unproven(kind)); transport = async () => { throw Error('Synthetic offline boundary'); };
    if (consumer === 'planner') assert.equal(await climate.resolveSiteClimate(point.lat, point.lon), null);
    else if (consumer === 'farmer') { const h = farmer(); await h.select(point.lat, point.lon); assert.equal(h.state.data, null); assert.equal(h.state.error, 'Reload unavailable'); assert.equal(h.state.loading, false); }
    else { const h = design(); const cleanup = h.refresh(); await settle(); assert.equal(h.state.data, null); cleanup(); }
    assert.equal(requests.length, 1); assert.equal(storage.rows.get(cached.key), cached.bytes, 'a failed reload cannot add a receipt or overwrite historic bytes');
    assert.deepEqual(storage.writes, []); assert.deepEqual(storage.removals, []); assert.equal(climate.loadCachedSiteClimate(point.lat, point.lon), null);
  });
}
for (const consumer of ['planner', 'farmer', 'design'] as const) test(consumer + ' leaves old v6 bytes untouched and reports no climate success when offline', async () => {
  const old = seed(location(), 6); transport = async () => { throw Error('Synthetic offline boundary'); };
  if (consumer === 'planner') assert.equal(await climate.resolveSiteClimate(point.lat, point.lon), null);
  else if (consumer === 'farmer') { const h = farmer(); await h.select(point.lat, point.lon); assert.equal(h.state.data, null); assert.equal(h.state.loading, false); assert.equal(h.state.error, 'Reload unavailable'); }
  else { const h = design(); const cleanup = h.refresh(); await settle(); assert.equal(h.state.data, null); cleanup(); }
  assert.equal(requests.length, 1); assert.equal(storage.rows.get(old.key), old.bytes); assert.deepEqual(storage.writes, []); assert.deepEqual(storage.removals, []);
});
for (const consumer of ['planner', 'farmer', 'design'] as const) test(consumer + ' does not certify an incomplete live response as monthly evidence', async () => {
  const incomplete = unproven('incomplete'); transport = async () => response(incomplete);
  if (consumer === 'planner') { assert.equal(await climate.resolveSiteClimate(point.lat, point.lon), null); assert.deepEqual(storage.writes, []); }
  else if (consumer === 'farmer') { const h = farmer(); await h.select(point.lat, point.lon); assert.deepEqual(h.state.data, incomplete); }
  else { const h = design(); const cleanup = h.refresh(); await settle(); assert.deepEqual(h.state.data, incomplete); cleanup(); }
  assert.equal(monthlyTemperatureStatus(incomplete.climate), 'incomplete');
  assert.equal(climate.loadCachedSiteClimate(point.lat, point.lon), null, 'display caching must never grant planner completeness');
  assert.equal(requests.length, 1);
});
test('Design Studio keeps a complete cached result on refresh failure and retires a cancelled refresh', async () => {
  seed(location()); transport = async () => { throw Error('Synthetic offline boundary'); };
  const cached = design(), cleanup = cached.refresh(); assert.equal(cached.state.data?.marker, 'synthetic complete response');
  await settle(); assert.equal(cached.state.data?.marker, 'synthetic complete response'); cleanup(); assert.deepEqual(storage.writes, []);
  storage.rows.clear(); requests.length = 0; const wait = deferred<Response>(); transport = () => wait.promise;
  const cancelled = design(), stop = cancelled.refresh(); await settle(); stop();
  wait.resolve(response(location())); await settle(); assert.equal(cancelled.state.data, null); assert.deepEqual(storage.writes, []);
});
test('the farmer request and site-identity fences still prevent late or mismatched cache publication', async () => {
  const h = farmer(), wait = deferred<Response>(); let count = 0;
  transport = async () => ++count === 1 ? wait.promise : response({ ...location(), ...other, marker: 'new selection' });
  const first = h.select(point.lat, point.lon); await settle(); await h.select(other.lat, other.lon);
  wait.resolve(response(location())); await first; assert.equal(h.state.data?.marker, 'new selection'); assert.equal(storage.writes.length, 1);
  storage.writes.length = 0; transport = async () => response({ ...location(), ...other });
  const mismatched = farmer(); await mismatched.select(point.lat, point.lon); assert.equal(mismatched.state.data, null);
  assert.match(mismatched.state.error, /did not match the selected site/); assert.deepEqual(storage.writes, []);
});
test('standalone sector and tank readers share v7 while leaving legacy storage unchanged', () => {
  const context = { window: globalThis.window, localStorage: storage };
  const sector = new Function('context', 'with(context){' + sectorExecutable + ';return resolveSectorContext;}')(context) as () => { site: unknown } | null;
  const tank = new Function('context', 'with(context){' + tankExecutable + ';return resolveCachedRainfall;}')(context) as () => number[] | null;
  const old = seed(location(), 6); assert.equal(sector()?.site, null); assert.equal(tank(), null);
  seed(location()); assert.ok(sector()?.site); assert.deepEqual(tank(), location().rainfall.monthly);
  assert.equal(storage.rows.get(old.key), old.bytes); assert.deepEqual(storage.writes, []); assert.deepEqual(storage.removals, []);
});

test('the planner is told why a mapped site has no climate reading, and is told nothing when it has one', async () => {
  // CP-096 (decision of 11 November 2026): the fallback's wording must follow the real
  // reason. A signed-out grower on a build that requires sign-in gets a 401 that will never
  // "finish loading"; a network failure, a server error and a NASA-outage payload are
  // "not available now". The reason is reported only alongside a null answer.
  const reasons = async (prepare: () => void): Promise<{ answer: unknown; told: string[] }> => {
    storage.rows.clear(); requests.length = 0; prepare();
    const told: string[] = [];
    const answer = await climate.resolveSiteClimate(point.lat, point.lon, (reason) => told.push(reason));
    return { answer, told };
  };
  const refused = await reasons(() => { transport = async () => new Response(JSON.stringify({ error: 'Authentication required.' }), { status: 401 }); });
  assert.equal(refused.answer, null); assert.deepEqual(refused.told, ['sign-in-required']); assert.deepEqual(storage.writes, []);
  for (const status of [403, 429, 500, 503]) {
    const failed = await reasons(() => { transport = async () => new Response('{}', { status }); });
    assert.equal(failed.answer, null); assert.deepEqual(failed.told, ['unavailable'], `HTTP ${status}`);
  }
  const offline = await reasons(() => { transport = async () => { throw Error('Synthetic offline boundary'); }; });
  assert.equal(offline.answer, null); assert.deepEqual(offline.told, ['unavailable']);
  const outage = await reasons(() => { transport = async () => response(unproven('incomplete')); });
  assert.equal(outage.answer, null); assert.deepEqual(outage.told, ['unavailable']);
  const invalid: string[] = [];
  assert.equal(await climate.resolveSiteClimate(Number.NaN, point.lon, (reason) => invalid.push(reason)), null);
  assert.deepEqual(invalid, ['unavailable']);

  const live = await reasons(() => { transport = async () => response(location()); });
  assert.ok(live.answer); assert.deepEqual(live.told, []);
  const told: string[] = [];
  assert.ok(await climate.resolveSiteClimate(point.lat, point.lon, (reason) => told.push(reason)), 'the reading just cached');
  assert.deepEqual(told, []);
  // The two-argument call every other reader makes is unchanged.
  storage.rows.clear(); transport = async () => new Response('{}', { status: 401 });
  assert.equal(await climate.resolveSiteClimate(point.lat, point.lon), null);
});
