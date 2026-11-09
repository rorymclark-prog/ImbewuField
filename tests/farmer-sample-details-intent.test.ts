import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { monthlyTemperatureStatus } from '../lib/climate-temperature.ts';

// Execute the actual page callbacks and effects, without mounting Mapbox or
// fetching anything. State scheduling, cache, transport, timers, translation
// and fixture identity comparisons are boundaries; this is not visual QA or
// independent coverage of the canonical site-identity helper.
const source = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
const page = ts.createSourceFile('farmer.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const callbacks = new Map<string, string>();
const constants = new Map<string, string>();
const effects = { sample: [] as string[], savedSite: [] as string[], panel: [] as string[] };
let sheetInitial = '', cacheInitializer = '';
function uses(node: ts.Node, name: string): boolean {
  if (ts.isIdentifier(node) && node.text === name) return true;
  return ts.forEachChild(node, child => uses(child, name) || undefined) === true;
}
function inspect(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.initializer) {
    const name = node.name.getText(page);
    if (['handleLocationSelect', 'handleJumpTo', 'handlePlaceSelect'].includes(name)) {
      assert.equal(callbacks.has(name), false, `the real ${name} callback is unambiguous`);
      callbacks.set(name, node.initializer.getText(page));
    }
    if (name === 'SITE_MISMATCH' || name === 'VALID_PANELS') constants.set(name, node.initializer.getText(page));
    if (ts.isArrayBindingPattern(node.name)) {
      const first = node.name.elements[0];
      if (first && ts.isBindingElement(first) && first.name.getText(page) === 'sheetOpen'
        && ts.isCallExpression(node.initializer)) sheetInitial = node.initializer.arguments[0]?.getText(page) ?? '';
    }
    if (name === 'cacheKey') cacheInitializer = node.initializer.getText(page);
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') {
    const callback = node.arguments[0];
    if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
      if (uses(callback, 'DEMO_SITE') && uses(callback, 'handleLocationSelect') && uses(callback, 'isSampleMode')) effects.sample.push(callback.getText(page));
      if (uses(callback, 'siteParamHandled')) effects.savedSite.push(callback.getText(page));
      if (uses(callback, 'setInitialChatQuery') && uses(callback, 'setForcedTab') && uses(callback, 'setSheetOpen')) effects.panel.push(callback.getText(page));
    }
  }
  ts.forEachChild(node, inspect);
}
inspect(page);
assert.equal(callbacks.size, 3, 'extract the existing page callbacks, without requiring a new parameter or export');
assert.equal(constants.size, 2); assert.ok(sheetInitial); assert.ok(cacheInitializer);
for (const [name, matches] of Object.entries(effects)) assert.equal(matches.length, 1, `one actual ${name} effect is exercised`);
const compile = (text: string) => ts.transpileModule(text, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
} }).outputText;
const executable = compile([...constants].map(([name, value]) => `const ${name}=${value};`).join('\n') + '\n'
  + [...callbacks].map(([name, value]) => `const ${name}=${value};`).join('\n') + '\n'
  + `const initialSheet=${sheetInitial};const automaticSample=${effects.sample[0]};const savedSite=${effects.savedSite[0]};const panelIntent=${effects.panel[0]};`);
const cacheKeyFor = new Function('lat', 'lon', compile(`const cacheKey=${cacheInitializer};`) + 'return cacheKey;') as (lat: number, lon: number) => string;

interface Point { lat: number; lon: number }
interface Place extends Point { id: string; name: string }
type Data = Point & { marker?: string };
interface ResponseStub { ok: boolean; status: number; json: () => Promise<unknown> }
interface State {
  selected: Point | null; data: Data | null; siteData: unknown; waterData: unknown; loading: boolean; error: string;
  sheetOpen: boolean; mapCapture: string | null; reportPhotoAnalysis: string | undefined;
  activePlaceId: string | null; activePlaceName: string | null; jumpTo: Point | null;
  forcedTab: string | null; initialChatQuery: string | null; initialChatPhoto: boolean;
}
type Select = (lat: number, lon: number, options?: { openDetails?: boolean }) => Promise<void>;
interface ActualCallbacks {
  handleLocationSelect: Select;
  handleJumpTo: (lat: number, lon: number) => void;
  initialSheet: () => boolean;
  automaticSample: () => undefined | (() => void);
  savedSite: () => undefined | (() => void);
  panelIntent: () => void;
}
// Synthetic coordinates identify transport fixtures, never farming advice.
const demo = Object.freeze({ lat: 0.123456, lon: 0.654321, name: 'Synthetic DEMO site' });
const other = Object.freeze({ lat: 0.123476, lon: 0.654341 });
const response = (value: unknown, status = 200): ResponseStub => ({ ok: status >= 200 && status < 300, status, json: async () => value });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve };
}
function harness(options: { sample?: boolean; params?: string; sheetOpen?: boolean; selected?: Point | null; reportSiteFlow?: boolean } = {}) {
  const state: State = { selected: options.selected ?? null, data: null, siteData: { stale: true }, waterData: { stale: true },
    loading: false, error: 'Earlier error', sheetOpen: options.sheetOpen ?? false, mapCapture: 'earlier capture',
    reportPhotoAnalysis: 'earlier analysis', activePlaceId: null, activePlaceName: null, jumpTo: null,
    forcedTab: null, initialChatQuery: null, initialChatPhoto: false };
  const settings = { sample: options.sample ?? true };
  const places: Place[] = [{ ...demo, id: 'demo-place', name: demo.name }, { ...other, id: 'other-place', name: 'Other saved fixture' }];
  const writes: Array<{ key: keyof State; value: unknown }> = [], cache = new Map<string, string>(), cacheWrites: Array<{ key: string; value: string }> = [];
  const requests: Array<{ url: string; init: unknown }> = [], pending: Promise<unknown>[] = [], errors: Array<unknown> = [];
  const timers = new Map<number, { at: number; callback: () => void }>(); let now = 0, nextTimer = 0, headerCalls = 0;
  const transport = { next: async (url: string): Promise<ResponseStub> => {
    const query = new URL(url, 'https://fixture.invalid').searchParams;
    return response({ lat: Number(query.get('lat')), lon: Number(query.get('lon')), marker: 'Synthetic location response' });
  } };
  const storage = { failRead: false, failWrite: false };
  function setter<K extends keyof State>(key: K) {
    return (value: State[K]) => { state[key] = value; writes.push({ key, value }); };
  }
  const context: Record<string, unknown> = {
    useCallback: (callback: (...args: unknown[]) => unknown) => (...args: unknown[]) => {
      const result = callback(...args); if (result instanceof Promise) pending.push(result); return result;
    },
    locationRequest: { current: 0 }, siteParamHandled: { current: '' },
    loadPlaces: () => places, DEMO_SITE: demo, isSampleMode: () => settings.sample,
    monthlyTemperatureStatus,
    // The comparison boundary distinguishes fixture sites. Five-decimal cache
    // spelling comes from the extracted cache expression, not a copied rule.
    designSiteIdFromLocation: (value: Point | null) => value ? JSON.stringify([value.lat, value.lon]) : 'unselected',
    localStorage: {
      getItem(key: string) { if (storage.failRead) throw Error('Synthetic unavailable cache'); return cache.get(key) ?? null; },
      setItem(key: string, value: string) { if (storage.failWrite) throw Error('Synthetic full cache'); cache.set(key, value); cacheWrites.push({ key, value }); },
    },
    fetch: async (url: string, init: unknown) => { requests.push({ url, init }); return transport.next(url); },
    paidApiHeaders: async () => { headerCalls++; return { 'X-Test-Boundary': 'synthetic' }; },
    networkFailureMessage: (_t: unknown, status?: unknown) => { errors.push(status); return status ? 'Friendly HTTP failure' : 'Friendly network failure'; },
    t: (key: string) => `Translated ${key}`,
    setActivePlaceId: setter('activePlaceId'), setActivePlaceName: setter('activePlaceName'), setSelected: setter('selected'),
    setData: setter('data'), setSiteData: setter('siteData'), setWaterData: setter('waterData'), setLoading: setter('loading'),
    setMapCapture: setter('mapCapture'), setReportPhotoAnalysis: setter('reportPhotoAnalysis'), setError: setter('error'),
    setSheetOpen: setter('sheetOpen'), setJumpTo: setter('jumpTo'), setForcedTab: setter('forcedTab'),
    setInitialChatQuery: setter('initialChatQuery'), setInitialChatPhoto: setter('initialChatPhoto'),
    searchParams: new URLSearchParams(options.params), searchKey: options.params ?? '', authLoading: false,
    reportSiteFlow: options.reportSiteFlow ?? false,
    setTimeout: (callback: () => void, delay: number) => { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: (id: number) => { timers.delete(id); },
  };
  Object.defineProperty(context, 'selected', { get: () => state.selected });
  const actual = new Function('context', `with(context){${executable};return {handleLocationSelect,handleJumpTo,initialSheet,automaticSample,savedSite,panelIntent};}`)(context) as ActualCallbacks;
  return { ...actual, state, settings, context, places, writes, cache, cacheWrites, requests, pending, errors, timers, transport, storage,
    get headerCalls() { return headerCalls; },
    // Cache-hit intent needs an explicitly complete synthetic provider payload;
    // the separate migration tests retain receipt-free legacy cache misses.
    seed(point: Point = demo, value: unknown = { ...point, marker: 'Cached fixture',
      climate: { monthlyTemp: Array.from({ length: 12 }, () => 0), monthlyTempCoverage: { source: 'nasa-power', status: 'complete' } },
    }) { cache.set(cacheKeyFor(point.lat, point.lon), JSON.stringify(value)); },
    async settle() { await Promise.all([...pending]); },
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...timers]) if (timer.at <= now && timers.delete(id)) timer.callback();
    },
  };
}

test('automatic DEMO initialization loads the actual selection path and camera without issuing a details-sheet opening', async () => {
  const h = harness(), cleanup = h.automaticSample();
  assert.equal(h.state.sheetOpen, false, 'automatic sample loading must not cover the market-garden map with details');
  assert.deepEqual(h.writes.filter(row => row.key === 'sheetOpen'), [], 'automatic entry must neither open nor close a details panel');
  assert.deepEqual(h.state.selected, { lat: demo.lat, lon: demo.lon }); assert.equal(h.state.loading, true);
  await h.settle(); assert.deepEqual(h.state.data, { lat: demo.lat, lon: demo.lon, marker: 'Synthetic location response' });
  assert.equal(h.requests.length, 1); assert.equal(h.headerCalls, 1); assert.equal(h.cacheWrites.length, 1);
  assert.equal(h.state.jumpTo, null); h.advance(799); assert.equal(h.state.jumpTo, null);
  h.advance(1); assert.deepEqual(h.state.jumpTo, { lat: demo.lat, lon: demo.lon });
  assert.equal(h.state.loading, false); assert.equal(h.state.error, ''); cleanup?.();
});

for (const initiallyOpen of [false, true]) test(`automatic cached DEMO data preserves the ${initiallyOpen ? 'open' : 'closed'} sheet and does not refetch`, async () => {
  const h = harness({ sheetOpen: initiallyOpen }); h.seed(); h.automaticSample(); await h.settle();
  assert.equal(h.state.sheetOpen, initiallyOpen); assert.deepEqual(h.writes.filter(row => row.key === 'sheetOpen'), []);
  assert.equal(h.requests.length, 0); assert.equal(h.headerCalls, 0); assert.equal(h.state.data?.marker, 'Cached fixture');
  assert.equal(h.state.loading, false); h.advance(800); assert.deepEqual(h.state.jumpTo, { lat: demo.lat, lon: demo.lon });
});

for (const mode of ['cached', 'missing-cache', 'http-error', 'network-error'] as const) test(`an explicit default selection still opens details with ${mode}`, async () => {
  const h = harness(); if (mode === 'cached') h.seed();
  if (mode === 'http-error') h.transport.next = async () => response(null, 503);
  if (mode === 'network-error') h.transport.next = async () => { throw Error('Private transport body'); };
  const selected = h.handleLocationSelect(demo.lat, demo.lon);
  assert.equal(h.state.sheetOpen, true, 'the existing two-argument explicit action retains its opening intent');
  await selected; assert.equal(h.state.loading, false);
  assert.equal(h.state.siteData, null); assert.equal(h.state.waterData, null); assert.equal(h.state.mapCapture, null);
  assert.equal(h.state.reportPhotoAnalysis, undefined); assert.equal(h.state.activePlaceId, 'demo-place');
  if (mode === 'http-error') { assert.equal(h.state.error, 'Friendly HTTP failure'); assert.deepEqual(h.errors, [{ status: 503 }]); }
  else if (mode === 'network-error') { assert.equal(h.state.error, 'Friendly network failure'); assert.deepEqual(h.errors, [undefined]); }
  else { assert.ok(h.state.data); assert.equal(h.state.error, ''); }
  assert.doesNotMatch(h.state.error, /Private transport body/);
});

test('explicit openDetails false never closes a sheet already opened by the user', async () => {
  const h = harness({ sheetOpen: true }); await h.handleLocationSelect(demo.lat, demo.lon, { openDetails: false });
  assert.equal(h.state.sheetOpen, true); assert.deepEqual(h.writes.filter(row => row.key === 'sheetOpen'), []);
  const closed = harness(); await closed.handleLocationSelect(demo.lat, demo.lon, { openDetails: false }); assert.equal(closed.state.sheetOpen, false);
});

test('a map jump remains an explicit default-opening selection and keeps its direct camera move', async () => {
  const h = harness(); h.handleJumpTo(other.lat, other.lon); await h.settle();
  assert.equal(h.state.sheetOpen, true); assert.deepEqual(h.state.jumpTo, { ...other });
  assert.deepEqual(h.state.data, { ...other, marker: 'Synthetic location response' });
});

for (const mode of ['cached', 'missing-cache', 'network-error'] as const) test(`a saved-site deep link retains its explicit opening intent with ${mode}`, async () => {
  const h = harness({ params: 'site=other-place' }); if (mode === 'cached') h.seed(other);
  if (mode === 'network-error') h.transport.next = async () => { throw Error('Private failure'); };
  const cleanup = h.savedSite(); assert.equal(h.state.sheetOpen, true); await h.settle();
  assert.equal(h.state.activePlaceId, 'other-place'); assert.equal(h.state.activePlaceName, 'Other saved fixture');
  h.advance(800); assert.deepEqual(h.state.jumpTo, { ...other }); cleanup?.();
  if (mode === 'network-error') assert.equal(h.state.error, 'Friendly network failure'); else assert.ok(h.state.data);
  const count = h.requests.length; h.savedSite(); await h.settle(); assert.equal(h.requests.length, count, 'the existing saved-site intent remains one-shot');
});

for (const sample of [false, true]) test(`a saved-site deep link ${sample ? 'retains its sample bypass' : 'waits for authentication'} during auth loading`, async () => {
  const h = harness({ sample, params: 'site=other-place' }); h.context.authLoading = true; h.savedSite(); await h.settle();
  assert.equal(h.requests.length, sample ? 1 : 0); assert.equal(h.state.sheetOpen, sample);
  assert.equal(h.timers.size, sample ? 1 : 0);
});

for (const unavailable of ['read', 'write'] as const) test(`an unavailable cache ${unavailable} does not suppress an explicit selection or replace good data`, async () => {
  const h = harness(); h.storage[unavailable === 'read' ? 'failRead' : 'failWrite'] = true;
  await h.handleLocationSelect(demo.lat, demo.lon);
  assert.equal(h.state.sheetOpen, true); assert.equal(h.state.loading, false); assert.equal(h.state.error, '');
  assert.equal(h.state.data?.marker, 'Synthetic location response'); assert.equal(h.requests.length, 1);
});

for (const params of ['panel=Reports', 'chat=1&q=synthetic&photo=1']) test(`an existing ${params.startsWith('panel') ? 'panel' : 'chat'} deep-link opening survives automatic DEMO initialization`, async () => {
  const h = harness({ params }); assert.equal(h.initialSheet(), true); h.panelIntent();
  assert.equal(h.state.sheetOpen, true); h.writes.length = 0; h.automaticSample(); await h.settle();
  assert.equal(h.state.sheetOpen, true); assert.deepEqual(h.writes.filter(row => row.key === 'sheetOpen'), []);
  assert.equal(h.state.forcedTab, params.startsWith('panel') ? 'Reports' : 'Ask'); assert.equal(h.requests.length, 1);
});

for (const guard of ['not-sample', 'already-selected', 'saved-site-intent', 'report-intent'] as const) test(`automatic initialization retains the ${guard} guard`, async () => {
  const h = harness({ sample: guard !== 'not-sample', selected: guard === 'already-selected' ? { ...other } : null,
    params: guard === 'saved-site-intent' ? 'site=other-place' : '', reportSiteFlow: guard === 'report-intent' });
  const before = JSON.stringify(h.state); assert.equal(h.automaticSample(), undefined); await h.settle();
  assert.equal(JSON.stringify(h.state), before); assert.equal(h.requests.length, 0); assert.equal(h.timers.size, 0);
});

test('automatic initializer cleanup cancels only its delayed camera move, without claiming to abort the current data request', async () => {
  const h = harness(), wait = deferred<ResponseStub>(); h.transport.next = () => wait.promise;
  const cleanup = h.automaticSample(); assert.equal(typeof cleanup, 'function'); cleanup?.(); h.advance(800);
  assert.equal(h.state.jumpTo, null); assert.equal(h.state.sheetOpen, false);
  wait.resolve(response({ ...demo, marker: 'Current response after camera cleanup' })); await h.settle();
  assert.equal(h.state.data?.marker, 'Current response after camera cleanup'); assert.equal(h.state.loading, false);
});

for (const failure of ['http', 'network'] as const) test(`automatic DEMO ${failure} failure retains the normal error route without opening details`, async () => {
  const h = harness(); h.transport.next = failure === 'http' ? async () => response(null, 429) : async () => { throw Error('Private failure body'); };
  h.automaticSample(); await h.settle(); assert.equal(h.state.sheetOpen, false); assert.equal(h.state.loading, false); assert.equal(h.state.data, null);
  assert.equal(h.state.error, failure === 'http' ? 'Friendly HTTP failure' : 'Friendly network failure');
  assert.deepEqual(h.errors, failure === 'http' ? [{ status: 429 }] : [undefined]); assert.equal(h.cacheWrites.length, 0);
});

test('mismatched cached or returned site identity remains rejected while explicit details still opens', async () => {
  const h = harness(); h.seed(demo, { ...other, marker: 'Wrong cached site' });
  h.transport.next = async () => response({ ...other, marker: 'Wrong response site' });
  await h.handleLocationSelect(demo.lat, demo.lon);
  assert.equal(h.state.sheetOpen, true); assert.equal(h.state.data, null); assert.equal(h.requests.length, 1); assert.equal(h.cacheWrites.length, 0);
  assert.equal(h.state.error, 'The loaded location did not match the selected site. Please select it again.');
  assert.deepEqual(h.errors, [], 'the specific identity failure keeps its existing non-network explanation');
});

for (const oldResult of ['success', 'http-error', 'network-error'] as const) test(`a superseded automatic ${oldResult} cannot replace explicit selection data, errors, loading or opening intent`, async () => {
  const h = harness(), first = deferred<ResponseStub>(), second = deferred<ResponseStub>();
  let rejectFirst!: (error: Error) => void;
  const rejected = new Promise<ResponseStub>((_resolve, reject) => { rejectFirst = reject; });
  let calls = 0; h.transport.next = () => ++calls === 1 ? oldResult === 'network-error' ? rejected : first.promise : second.promise;
  h.automaticSample(); await Promise.resolve(); await Promise.resolve();
  const newest = h.handleLocationSelect(other.lat, other.lon); await Promise.resolve(); await Promise.resolve();
  assert.equal(h.requests.length, 2); assert.equal(h.state.sheetOpen, true);
  if (oldResult === 'network-error') rejectFirst(Error('Private superseded failure'));
  else first.resolve(oldResult === 'success' ? response({ ...demo, marker: 'Superseded DEMO' }) : response(null, 503));
  await h.pending[0]; assert.equal(h.state.loading, true); assert.equal(h.state.error, ''); assert.equal(({ current: h.state.data }).current, null);
  assert.equal(h.cacheWrites.length, 0); assert.deepEqual(h.state.selected, { ...other });
  second.resolve(response({ ...other, marker: 'Explicit current response' })); await newest;
  assert.equal(h.state.loading, false); assert.equal(h.state.sheetOpen, true); assert.equal(h.state.data?.marker, 'Explicit current response');
  assert.equal(h.cacheWrites.length, 1); assert.deepEqual(h.errors, []);
});
