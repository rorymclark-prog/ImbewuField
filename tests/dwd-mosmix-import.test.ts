import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { setImmediate as turn } from 'node:timers/promises';
import { fetchDwdMosmixStationReference, DWD_MOSMIX_IMPORT_LIMITS } from '../lib/international/providers/dwd-mosmix-import.ts';
import type { DwdMosmixHttpOptions } from '../lib/international/providers/dwd-mosmix-http.ts';

// Independently generated Python zipfile/CRC fixtures contain only synthetic KML.
// Expected values below are literal source facts, not projections of decoder output.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/dwd-mosmix-import-synthetic.json', import.meta.url), 'utf8'));
const archive = (name = 'utf8'): Uint8Array<ArrayBuffer> => new Uint8Array(Buffer.from(fixtures.cases[name].kmzBase64, 'base64'));
const endpoint = 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/01234/kml/MOSMIX_L_LATEST_01234.kmz';
const mime = 'application/vnd.google-earth.kmz';
const clock = () => new Date('2001-02-03T04:05:06.321Z');
const provenance = () => Object.freeze({ providerId: 'dwd-mosmix-station-reference', expectedStationId: '01234',
  endpoint, fetchedAt: '2001-02-03T04:05:06.321Z', kind: 'public-station', referenceOnly: true });
type ImportResult = Awaited<ReturnType<typeof fetchDwdMosmixStationReference>>;
const fetcher = (run: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch =>
  async (url, init) => run(String(url), init ?? {});
function failure(result: ImportResult, reason: string) {
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('A held composed import returned successful reference data');
  assert.equal(result.reason, reason); assert.ok(Object.isFrozen(result));
  assert.equal('archive' in result, false); assert.equal('kml' in result, false); assert.equal('periods' in result, false);
  return result;
}
function decoded(result: ImportResult) {
  assert.ok(result.status === 'available' || result.status === 'partial', 'only the final actual decoder can authorize a successful reference result');
  if (result.status !== 'available' && result.status !== 'partial') throw Error('Independent complete import fixture held');
  return result;
}
function deepFrozen(value: unknown): void {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) deepFrozen(child);
  }
}
async function realImport(name = 'utf8', extra: Omit<DwdMosmixHttpOptions, 'fetcher'> = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [], bytes = archive(name), before = bytes.slice();
  const result = await fetchDwdMosmixStationReference({ stationId: '01234' }, { now: clock, ...extra,
    fetcher: fetcher((url, init) => { calls.push({ url, init }); return new Response(bytes, { headers: { 'content-type': mime } }); }) });
  assert.equal(calls.length, 1); assert.equal(calls[0].url, endpoint); assert.deepEqual(bytes, before);
  return { result, calls, bytes };
}

for (const name of ['utf8', 'latin1']) test('real HTTP-to-archive-to-byte/XML composition retains ' + name + ' text, native values and exact UTC source instants', async () => {
  const { result: raw, calls, bytes } = await realImport(name), result = decoded(raw);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.station, { id: '01234', description: 'SYNTHETIC café' });
  assert.equal(result.issuedAt, '2024-02-29T11:00:00.789Z');
  assert.deepEqual(result.units, { temperature: 'K', precipitation: 'kg/m2' });
  assert.deepEqual(result.periods, [
    { validAt: '2024-02-29T12:00:00.123Z', temperatureK: 273.15, precipitationKgM2: 0 },
    { validAt: '2024-02-29T13:00:00.456Z', temperatureK: null, precipitationKgM2: 0.1 },
  ]);
  assert.deepEqual(result.issues, ['temperature-values-missing']); assert.deepEqual(result.provenance, provenance());
  assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.cache, 'no-store');
  assert.deepEqual(Object.keys(result).sort(), ['status', 'station', 'issuedAt', 'units', 'periods', 'issues', 'provenance'].sort());
  deepFrozen(result); bytes.fill(0); assert.equal(result.station.description, 'SYNTHETIC café');
  assert.throws(() => (result.periods as unknown[]).push({}), TypeError);
});

for (const input of [null, {}, { stationId: '01234\n' }, { stationId: '../01234' }, { stationId: '01234', url: 'https://other.example' }]) {
  test('invalid composed selection never inspects unsafe HTTP options: ' + JSON.stringify(input), async () => {
    let reads = 0;
    const options = Object.defineProperty({}, 'fetcher', { get() { reads++; throw Error('Must not inspect HTTP options'); } });
    const result = failure(await fetchDwdMosmixStationReference(input, options), 'invalid-station');
    assert.equal(result.provenance, null); assert.equal(reads, 0);
  });
}
test('the composition preserves the HTTP authority for ordinary option-accessor rejection', async () => {
  let reads = 0, calls = 0;
  const options: DwdMosmixHttpOptions = { fetcher: fetcher(() => { calls++; throw Error('No request'); }) };
  Object.defineProperty(options, 'timeoutMs', { get() { reads++; return 1; } });
  const result = failure(await fetchDwdMosmixStationReference({ stationId: '01234' }, options), 'invalid-options');
  assert.equal(reads, 0); assert.equal(calls, 0); assert.equal(result.provenance, null);
});
for (const [header, expected] of [['0', 0], ['60', 60], ['unknown', null]] as const) {
  test('the actual composed HTTP failure preserves a known retry delay or unknown for ' + header, async () => {
    let calls = 0;
    const result = failure(await fetchDwdMosmixStationReference({ stationId: '01234' }, {
      fetcher: fetcher(url => { calls++; assert.equal(url, endpoint); return new Response(null, { status: 429, headers: { 'retry-after': header } }); }),
    }), 'rate-limited');
    assert.deepEqual(result, { status: 'failed', reason: 'rate-limited', endpoint, stationId: '01234', provenance: null, httpStatus: 429, retryAfterSeconds: expected });
    assert.equal(calls, 1);
  });
}
test('a bad receipt clock is held without substituting the current time or exposing an intermediate archive', async () => {
  const { result } = await realImport('utf8', { now: () => new Date(NaN) });
  assert.equal(failure(result, 'invalid-options').provenance, null);
});
for (const [name, reason] of [['utf16', 'unsupported-encoding'], ['stationMismatch', 'station-mismatch']] as const) {
  test('a real extracted ' + name + ' payload remains held by the sole byte/XML authority', async () => {
    const { result } = await realImport(name); assert.deepEqual(failure(result, reason).provenance, provenance());
  });
}
test('a source DTD is held after real extraction and cannot trigger an external network request', async () => {
  const original = globalThis.fetch; let externalCalls = 0;
  globalThis.fetch = (async () => { externalCalls++; throw Error('External entity access is forbidden in this fixture'); }) as typeof fetch;
  try {
    const { result, calls } = await realImport('unsafeXml');
    failure(result, 'unsafe-xml'); assert.equal(calls.length, 1); assert.equal(externalCalls, 0);
  } finally { globalThis.fetch = original; }
});
test('invalid ZIP bytes never become a retrieved or extracted successful reference', async () => {
  let calls = 0;
  const result = await fetchDwdMosmixStationReference({ stationId: '01234' }, { now: clock,
    fetcher: fetcher(() => { calls++; return new Response(new Uint8Array([80, 75, 3]), { headers: { 'content-type': mime } }); }) });
  failure(result, 'invalid-archive'); assert.equal(calls, 1);
});
test('the total engineering deadline remains fixed and is not a forecast-validity quantity', () => {
  assert.deepEqual(DWD_MOSMIX_IMPORT_LIMITS, { totalTimeoutMs: 24_000 }); assert.ok(Object.isFrozen(DWD_MOSMIX_IMPORT_LIMITS));
});

// The following bounded stage doubles exercise deadline/continuation branches.
// They are not ZIP decoding evidence; the independent real compositions above are.
type Scenario = 'pending-http' | 'pending-archive-blob' | 'pending-extract' | 'pending-kml-blob'
  | 'late-http' | 'late-archive-blob' | 'late-extract' | 'late-kml-blob' | 'late-decode'
  | 'unexpected-extract' | 'forward-http-failure' | 'forward-archive-failure' | 'successful-cleanup';
function deferred() {
  let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function microtasks() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
async function contract(scenario: Scenario) {
  const key = '__dwdImportContract_' + scenario.replaceAll('-', '_'), gate = deferred();
  const control = { elapsed: 0, httpCalls: 0, extractCalls: 0, decodeCalls: 0, archiveBlobReads: 0, kmlBlobReads: 0,
    signal: null as AbortSignal | null, options: null as unknown, timerDelay: null as number | null,
    fire: null as (() => void) | null, clears: 0 };
  const context = provenance(), raw = new Uint8Array([1, 2]).buffer;
  const archiveBlob = new Blob([new Uint8Array([1])]), kmlBlob = new Blob([new Uint8Array([2])]);
  Object.defineProperty(archiveBlob, 'arrayBuffer', { value: async () => {
    control.archiveBlobReads++; if (scenario === 'pending-archive-blob') return gate.promise;
    if (scenario === 'late-archive-blob') control.elapsed = 24_001; return raw;
  } });
  Object.defineProperty(kmlBlob, 'arrayBuffer', { value: async () => {
    control.kmlBlobReads++; if (scenario === 'pending-kml-blob') return gate.promise;
    if (scenario === 'late-kml-blob') control.elapsed = 24_001; return raw;
  } });
  const retrieved = Object.freeze({ status: 'retrieved', archive: archiveBlob, provenance: context });
  const extracted = Object.freeze({ status: 'extracted', kml: kmlBlob, filename: 'MOSMIX_L_2024022911_01234.kml', provenance: context });
  const httpFailure = Object.freeze({ status: 'failed', reason: 'rate-limited', endpoint, stationId: '01234', provenance: null, httpStatus: 429, retryAfterSeconds: 0 });
  const archiveFailure = Object.freeze({ status: 'failed', reason: 'invalid-archive', provenance: context });
  const decodedResult = Object.freeze({ status: 'partial', station: Object.freeze({ id: '01234', description: 'SYNTHETIC contract reference' }),
    issuedAt: '2024-02-29T11:00:00.789Z', units: Object.freeze({ temperature: 'K', precipitation: 'kg/m2' }),
    periods: Object.freeze([]), issues: Object.freeze(['missing-temperature-series']), provenance: context });
  const bridge = {
    async http(_input: unknown, options: unknown) {
      control.httpCalls++; control.options = options;
      if (scenario === 'pending-http') return gate.promise;
      if (scenario === 'late-http') control.elapsed = 24_001;
      return scenario === 'forward-http-failure' ? httpFailure : retrieved;
    },
    async extract(_bytes: unknown, _source: unknown, signal: AbortSignal) {
      control.extractCalls++; control.signal = signal;
      if (scenario === 'pending-extract') return gate.promise;
      if (scenario === 'late-extract') control.elapsed = 24_001;
      if (scenario === 'unexpected-extract') throw Error('PRIVATE INTERNAL DETAIL');
      return scenario === 'forward-archive-failure' ? archiveFailure : extracted;
    },
    decode() { control.decodeCalls++; if (scenario === 'late-decode') control.elapsed = 24_001; return decodedResult; },
  };
  Object.defineProperty(globalThis, key, { value: bridge, configurable: true });
  const url = new URL('../lib/international/providers/dwd-mosmix-import.ts?contractCase=' + scenario, import.meta.url);
  const modules: Record<string, string> = {
    './dwd-mosmix-http.ts': `const b=globalThis[${JSON.stringify(key)}];export async function fetchDwdMosmixArchive(...args){return b.http(...args);}`,
    './dwd-mosmix-archive.ts': `const b=globalThis[${JSON.stringify(key)}];export async function extractDwdMosmixArchive(...args){return b.extract(...args);}`,
    './dwd-mosmix-encoding.ts': `const b=globalThis[${JSON.stringify(key)}];export function decodeDwdMosmixKmlBytes(...args){return b.decode(...args);}`,
  };
  const hooks = registerHooks({ resolve(specifier, parent, next) {
    if (parent.parentURL === url.href && Object.hasOwn(modules, specifier)) return { url: 'data:text/javascript,' + encodeURIComponent(modules[specifier]), shortCircuit: true };
    return next(specifier, parent);
  } });
  const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
  const nowDescriptor = Object.getOwnPropertyDescriptor(performance, 'now'), timerToken = {};
  let optionsReads = 0;
  const options = Object.defineProperty({}, 'timeoutMs', { get() { optionsReads++; throw Error('The pipeline must not inspect HTTP option getters'); } });
  try {
    const isolated = await import(url.href) as { fetchDwdMosmixStationReference: typeof fetchDwdMosmixStationReference };
    Object.defineProperty(performance, 'now', { configurable: true, value: () => control.elapsed });
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
      control.timerDelay = delay ?? null; control.fire = () => callback(...args); return timerToken;
    }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((handle: unknown) => { if (handle === timerToken) control.clears++; else realClearTimeout(handle as Parameters<typeof clearTimeout>[0]); }) as typeof clearTimeout;
    const pending = isolated.fetchDwdMosmixStationReference({ stationId: '01234' }, options);
    await microtasks(); assert.equal(control.timerDelay, 24_000); assert.equal(control.httpCalls, 1);
    let result: ImportResult;
    if (scenario.startsWith('pending-')) {
      assert.ok(control.fire); control.elapsed = 24_001; control.fire();
      // A removed pipeline race must fail an assertion, not leave this negative
      // control waiting forever on its deliberately signal-ignoring stage.
      const stalled = Symbol('pipeline did not settle');
      let watchdog: ReturnType<typeof setTimeout> | null = null;
      try {
        const settled = await Promise.race([pending, new Promise<typeof stalled>(resolve => {
          watchdog = realSetTimeout(() => resolve(stalled), 200);
        })]);
        if (settled === stalled) assert.fail('the whole-pipeline timer must settle an ignoring stage without its acknowledgement');
        result = settled;
      } finally { if (watchdog !== null) realClearTimeout(watchdog); }
      if (scenario === 'pending-http') gate.resolve(retrieved);
      else if (scenario === 'pending-extract') gate.resolve(extracted);
      else gate.resolve(raw);
      await microtasks(); await turn();
    } else result = await pending;
    assert.equal(control.options, options); assert.equal(optionsReads, 0); assert.equal(control.clears, 1);
    return { result, control, httpFailure, archiveFailure, decodedResult };
  } finally {
    if (scenario === 'pending-http') gate.resolve(retrieved);
    else if (scenario === 'pending-extract') gate.resolve(extracted);
    else gate.resolve(raw);
    await microtasks();
    globalThis.setTimeout = realSetTimeout; globalThis.clearTimeout = realClearTimeout;
    if (nowDescriptor) Object.defineProperty(performance, 'now', nowDescriptor); else Reflect.deleteProperty(performance, 'now');
    hooks.deregister(); Reflect.deleteProperty(globalThis, key);
  }
}

for (const scenario of ['pending-http', 'pending-archive-blob', 'pending-extract', 'pending-kml-blob'] as const) {
  test('contract double: the whole deadline settles an ignoring ' + scenario + ' and retires its late continuation', async () => {
    const { result, control } = await contract(scenario);
    const held = failure(result, 'timeout'); assert.equal(control.decodeCalls, 0);
    if (scenario === 'pending-http') { assert.equal(held.provenance, null); assert.equal(control.archiveBlobReads, 0); assert.equal(control.extractCalls, 0); }
    else assert.deepEqual(held.provenance, provenance());
    if (scenario === 'pending-archive-blob') assert.equal(control.extractCalls, 0);
    if (scenario === 'pending-extract' || scenario === 'pending-kml-blob') assert.equal(control.signal?.aborted, true);
  });
}
for (const scenario of ['late-http', 'late-archive-blob', 'late-extract', 'late-kml-blob', 'late-decode'] as const) {
  test('contract double: a delayed timer cannot authorize ' + scenario + ' after the monotonic deadline', async () => {
    const { result, control } = await contract(scenario); failure(result, 'timeout');
    if (scenario !== 'late-decode') assert.equal(control.decodeCalls, 0); else assert.equal(control.decodeCalls, 1);
    if (scenario === 'late-http') assert.equal(control.archiveBlobReads, 0);
    if (scenario === 'late-archive-blob') assert.equal(control.extractCalls, 0);
    if (scenario === 'late-extract') assert.equal(control.kmlBlobReads, 0);
    if (control.signal) assert.equal(control.signal.aborted, true);
  });
}
test('contract double: unexpected extraction errors stay static and abort owned work without raw details', async () => {
  const { result, control } = await contract('unexpected-extract');
  assert.deepEqual(failure(result, 'invalid-archive').provenance, provenance());
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false); assert.equal(control.decodeCalls, 0); assert.equal(control.signal?.aborted, true);
});
test('contract double: exact HTTP failure identity and a known zero retry delay survive composition', async () => {
  const { result, control, httpFailure } = await contract('forward-http-failure');
  assert.equal(result, httpFailure); assert.equal(control.extractCalls, 0); assert.equal(control.decodeCalls, 0);
});
test('contract double: exact archive failure identity survives without invoking XML decoding', async () => {
  const { result, control, archiveFailure } = await contract('forward-archive-failure');
  assert.equal(result, archiveFailure); assert.equal(control.decodeCalls, 0); assert.equal(control.signal?.aborted, true);
});
test('contract double: successful final decoder output is retained while owned work and timer are cleaned up', async () => {
  const { result, control, decodedResult } = await contract('successful-cleanup');
  assert.equal(result, decodedResult); assert.equal(control.extractCalls, 1); assert.equal(control.decodeCalls, 1); assert.equal(control.signal?.aborted, true);
});
