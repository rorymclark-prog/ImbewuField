import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import { fetchDwdMosmixCatalogSearch, DWD_MOSMIX_CATALOG_ENDPOINT, DWD_MOSMIX_HTTP_LIMITS,
  type DwdMosmixHttpOptions, type DwdMosmixLiveCatalogSearchResult } from '../lib/international/providers/dwd-mosmix-http.ts';
import { searchDwdMosmixStationCatalogBytes } from '../lib/international/providers/dwd-mosmix-catalog-search.ts';

const endpoint = 'https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_stationskatalog.cfg?view=nasPublication&nn=16102';
const fetchedAt = '2001-02-03T04:05:06.321Z';
const clock = () => new Date(fetchedAt);
const ascii = (value: string) => new TextEncoder().encode(value);
// Independent synthetic identity/name bytes, with opaque printable ignored fields.
function row(id: string, name: string | Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(52).fill(32), label = typeof name === 'string' ? ascii(name) : name;
  assert.equal(id.length, 5); assert.ok(label.length <= 20);
  result.set(ascii(id), 0); result.set(ascii('ABCD'), 6); result.set(label, 11);
  result.set(ascii('ABCDEF'), 32); result.set(ascii('GHIJKLM'), 39); result.set(ascii('NOPQR'), 47);
  return result;
}
function catalog(rows = [row(' A051', 'SYNTHETIC NAME')]): Uint8Array<ArrayBuffer> {
  const parts = [ascii('ID    ICAO NAME                 LAT    LON     ELEV'), ascii('----- ---- -------------------- -----  ------- -----'), ...rows];
  const output = new Uint8Array(parts.reduce((size, part) => size + part.length + 1, 0)); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; output[offset++] = 10; }
  return output;
}
const response = (body: BodyInit | null = catalog(), headers: HeadersInit = { 'content-type': 'text/plain; charset=UTF-8' }) => new Response(body, { headers });
const fetcher = (run: (url: string, init: RequestInit) => Response | Promise<Response>): typeof fetch => async (url, init) => run(String(url), init ?? {});
function held(result: DwdMosmixLiveCatalogSearchResult, reason: string) {
  assert.equal(result.status, 'failed'); if (result.status !== 'failed') throw Error('Invalid transport became search data');
  assert.equal(result.reason, reason); assert.ok(Object.isFrozen(result));
  assert.equal('matches' in result, false); assert.equal('archive' in result, false); assert.equal('stationId' in result, false);
  assert.equal('expectedStationId' in result, false); return result;
}
function transportHold(result: DwdMosmixLiveCatalogSearchResult, reason: string) {
  const failure = held(result, reason);
  assert.ok('endpoint' in failure); assert.equal(failure.endpoint, endpoint);
  assert.ok('provenance' in failure); assert.equal(failure.provenance, null); return failure;
}
function frozen(value: unknown): void {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
test('one fixed public request returns real byte-derived search and a retrieval receipt without query or private context in the URL', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const input = catalog([row(' A051', 'SYnthetic NAME'), row('01234', new Uint8Array([0xe9, 65]))]), original = input.slice();
  const result = await fetchDwdMosmixCatalogSearch('  sYn  ', { now: clock,
    fetcher: fetcher((url, init) => { calls.push({ url, init }); return response(input); }) });
  assert.equal(DWD_MOSMIX_CATALOG_ENDPOINT, endpoint); assert.equal(calls.length, 1); assert.equal(calls[0].url, endpoint);
  assert.equal(calls[0].init.credentials, 'omit'); assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[0].init.cache, 'no-store');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get('authorization'), null); assert.equal(headers.get('cookie'), null); assert.match(headers.get('accept')!, /text\/plain/i);
  if (result.status === 'failed') throw Error('Synthetic search held');
  assert.deepEqual(result, { ...searchDwdMosmixStationCatalogBytes(original, 'sYn'), provenance: {
    providerId: 'dwd-mosmix-station-catalog-reference', kind: 'public-station-catalog', endpoint, fetchedAt, referenceOnly: true,
  } });
  assert.equal(result.catalogWithheldNameCount, 1); assert.equal(result.matches[0].name, 'SYnthetic NAME');
  assert.deepEqual(input, original); frozen(result); assert.equal('archive' in result, false); assert.equal('rawBytes' in result, false);
});
test('invalid query precedes option reflection, clock invocation and fetch', async () => {
  let optionTraps = 0, calls = 0;
  const options = new Proxy({}, { get() { optionTraps++; throw Error('option getter'); }, ownKeys() { optionTraps++; throw Error('option keys'); },
    getOwnPropertyDescriptor() { optionTraps++; throw Error('option descriptor'); }, getPrototypeOf() { optionTraps++; throw Error('option prototype'); } });
  for (const query of [undefined, {}, new String('A051'), '', '  ', '\tA051', 'café', ' '.repeat(61) + 'A051']) {
    const result = await fetchDwdMosmixCatalogSearch(query, options);
    assert.deepEqual(held(result, 'invalid-query'), { status: 'failed', reason: 'invalid-query' });
  }
  const getter = Object.defineProperty({}, 'fetcher', { get() { calls++; throw Error('fetch getter'); } });
  await fetchDwdMosmixCatalogSearch(null, getter); assert.equal(optionTraps, 0); assert.equal(calls, 0);
});
test('unsafe or invalid options are held without invoking accessors or provider callbacks', async () => {
  let calls = 0, reads = 0;
  const options = { fetcher: fetcher(() => { calls++; return response(); }) };
  Object.defineProperty(options, 'now', { get() { reads++; return clock; } });
  transportHold(await fetchDwdMosmixCatalogSearch('A051', options), 'invalid-options');
  for (const bad of [null, [], { fetcher: 1 }, { now: 1 }, { timeoutMs: 0 }, { timeoutMs: NaN }, { timeoutMs: Infinity }]) {
    transportHold(await fetchDwdMosmixCatalogSearch('A051', bad as unknown as DwdMosmixHttpOptions), 'invalid-options');
  }
  assert.equal(reads, 0); assert.equal(calls, 0);
});
test('declared UTF-8 charset never decodes or repairs conflicting raw name bytes', async () => {
  let textCalls = 0;
  const input = catalog([row(' A051', new Uint8Array([0xe9, 0x80, 0xff])), row('01234', ascii('café'))]);
  const result = await fetchDwdMosmixCatalogSearch('a05', { now: clock, fetcher: fetcher(() => {
    const r = response(input); Object.defineProperty(r, 'text', { value() { textCalls++; throw Error('No text decode'); } }); return r;
  }) });
  assert.equal(result.status, 'matches'); if (result.status !== 'matches') throw Error('Null-name identity held');
  assert.deepEqual(result.matches, [{ stationId: 'A051', name: null }]); assert.equal(result.catalogWithheldNameCount, 2); assert.equal(textCalls, 0);
});
test('a normal no-match retains the receipt and whole-catalogue withheld count', async () => {
  const result = await fetchDwdMosmixCatalogSearch('missing', { now: clock, fetcher: fetcher(() => response(catalog([row(' A051', new Uint8Array([0xe9]))]))) });
  assert.equal(result.status, 'no-matches'); if (result.status !== 'no-matches') throw Error('No-match not returned');
  assert.equal(result.totalMatches, 0); assert.deepEqual(result.matches, []); assert.equal(result.catalogWithheldNameCount, 1);
  assert.equal(result.provenance.fetchedAt, fetchedAt); frozen(result);
});
test('catalogue parser failures forward as static holds instead of being relabelled no-matches or HTTP failures', async () => {
  for (const input of [ascii('<html>not a catalogue</html>'), catalog([row(' A051', 'FIRST'), row(' A051', 'DUPLICATE')]), catalog([row('a0001', 'BAD')])]) {
    const result = await fetchDwdMosmixCatalogSearch('first', { now: clock, fetcher: fetcher(() => response(input)) });
    assert.deepEqual(result, searchDwdMosmixStationCatalogBytes(input, 'first')); assert.equal('provenance' in result, false); frozen(result);
  }
});
for (const type of ['text/plain', 'TEXT/PLAIN; charset=ISO-8859-1']) test('the allowed MIME profile preserves raw bytes for ' + type, async () => {
  assert.equal((await fetchDwdMosmixCatalogSearch('A051', { now: clock, fetcher: fetcher(() => response(catalog(), { 'content-type': type })) })).status, 'matches');
});
for (const type of [null, 'text/html', 'application/octet-stream', 'text/plain, text/html', 'text/plain; charset=UTF-8, text/html', 'text/plain; profile="a,b"']) {
  test('untrusted MIME ' + type + ' is held and cancelled before reading', async () => {
    let pulls = 0, cancels = 0;
    const stream = new ReadableStream<Uint8Array>({ pull() { pulls++; }, cancel() { cancels++; } }, { highWaterMark: 0 });
    const headers: Record<string, string> = type === null ? {} : { 'content-type': type };
    transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(stream, headers)) }), 'malformed-response');
    await turn(); assert.equal(pulls, 0); assert.equal(cancels, 1);
  });
}
for (const [retry, expected] of [['0', 0], ['31', 31], ['tomorrow', null], ['9007199254740993', null]] as const) test('429 preserves known zero or unknown Retry-After: ' + retry, async () => {
  let calls = 0;
  const result = transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => { calls++; return new Response(null, { status: 429, headers: { 'retry-after': retry } }); }) }), 'rate-limited');
  assert.ok('httpStatus' in result); assert.equal(result.httpStatus, 429); assert.ok('retryAfterSeconds' in result); assert.equal(result.retryAfterSeconds, expected); assert.equal(calls, 1);
});
for (const status of [404, 503]) test('HTTP ' + status + ' returns one static failure without retry', async () => {
  let calls = 0;
  const result = transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => { calls++; return new Response('PRIVATE', { status }); }) }), 'http-error');
  assert.ok('httpStatus' in result); assert.equal(result.httpStatus, status); assert.equal(calls, 1); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
for (const field of ['redirected', 'url']) test('a substituted response ' + field + ' cannot authorize an alternative catalog URL', async () => {
  let calls = 0;
  const result = await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => { calls++; const r = response(); Object.defineProperty(r, field,
    { value: field === 'redirected' ? true : 'https://other.example/catalog.cfg' }); return r; }) });
  transportHold(result, field === 'redirected' ? 'http-error' : 'malformed-response'); assert.equal(calls, 1);
});
for (const length of ['-1', '1.5', 'unknown']) test('malformed Content-Length ' + length + ' holds before parsing', async () => {
  transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(catalog(), { 'content-type': 'text/plain', 'content-length': length })) }), 'malformed-response');
});
test('declared oversize cancels before consumption while omitted or false-small lengths still meet the actual byte ceiling', async () => {
  let pulls = 0, cancels = 0;
  const declared = new ReadableStream<Uint8Array>({ pull() { pulls++; }, cancel() { cancels++; } }, { highWaterMark: 0 });
  transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(declared,
    { 'content-type': 'text/plain', 'content-length': String(DWD_MOSMIX_HTTP_LIMITS.responseBytes + 1) })) }), 'response-too-large');
  await turn(); assert.equal(pulls, 0); assert.equal(cancels, 1);
  for (const length of [null, '1']) {
    let step = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) { if (step++ === 0) c.enqueue(new Uint8Array(DWD_MOSMIX_HTTP_LIMITS.responseBytes)); else c.enqueue(new Uint8Array([0])); } }, { highWaterMark: 0 });
    const headers: Record<string, string> = { 'content-type': 'text/plain' }; if (length !== null) headers['content-length'] = length;
    transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(stream, headers)) }), 'response-too-large'); assert.equal(step, 2);
  }
});
test('a shadowed ordinary chunk length cannot hide actual oversized bytes or execute a getter', async () => {
  const chunk = new Uint8Array(DWD_MOSMIX_HTTP_LIMITS.responseBytes + 1); let reads = 0, cancels = 0;
  Object.defineProperty(chunk, 'byteLength', { get() { reads++; return 1; } });
  const stream = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(chunk); }, cancel() { cancels++; } }, { highWaterMark: 0 });
  transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(stream)) }), 'response-too-large');
  assert.equal(reads, 0); await turn(); assert.equal(cancels, 1);
});
test('reused streamed buffers preserve the bytes actually observed by the catalogue parser', async () => {
  const original = catalog(), shared = original.slice(); let step = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(c) {
    if (step++ === 0) c.enqueue(shared); else { shared.fill(0); c.close(); }
  } }, { highWaterMark: 0 });
  const result = await fetchDwdMosmixCatalogSearch('A051', { now: clock, fetcher: fetcher(() => response(stream)) });
  assert.equal(result.status, 'matches'); if (result.status !== 'matches') throw Error('Reused buffer lost its observed catalog');
  assert.deepEqual(result.matches, [{ stationId: 'A051', name: 'SYNTHETIC NAME' }]); assert.equal(shared[0], 0);
});
test('missing/empty bodies and rejected fetch/read paths never become successful empty search', async () => {
  for (const body of [null, new Uint8Array()]) transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(body)) }), 'malformed-response');
  transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => Promise.reject(Error('PRIVATE FETCH'))) }), 'network-error');
  const stream = new ReadableStream<Uint8Array>({ pull(c) { c.error(Error('PRIVATE READ')); } });
  const result = transportHold(await fetchDwdMosmixCatalogSearch('A051', { fetcher: fetcher(() => response(stream)) }), 'network-error');
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});
test('invalid or unsafe receipt clocks hold without coercing a substitute timestamp', async () => {
  let getters = 0;
  const unsafe = Object.defineProperty({}, 'toISOString', { get() { getters++; throw Error('clock getter'); } });
  for (const now of [() => new Date(NaN), () => { throw Error('PRIVATE CLOCK'); }, () => unsafe as Date,
    () => new Date('+010000-01-01T00:00:00.000Z')]) {
    const result = transportHold(await fetchDwdMosmixCatalogSearch('A051', { now, fetcher: fetcher(() => response()) }), 'invalid-options');
    assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  }
  assert.equal(getters, 0);
});

// Controlled clocks/timers exercise the real transport, stream and parser without
// wall-clock sleeps. The independent real watchdog only fires on a broken race.
async function controlled(run: (controls: { advance: () => void; fire: () => void; bounded: <T>(p: Promise<T>) => Promise<T> }) => Promise<void>): Promise<void> {
  const set = globalThis.setTimeout, clear = globalThis.clearTimeout, descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
  let elapsed = 0, callback: (() => void) | undefined;
  Object.defineProperty(performance, 'now', { configurable: true, value: () => elapsed });
  globalThis.setTimeout = ((fn: () => void) => { callback = fn; return {} as ReturnType<typeof setTimeout>; }) as typeof setTimeout;
  globalThis.clearTimeout = (() => {}) as typeof clearTimeout;
  try { await run({ advance: () => { elapsed = 12_001; }, fire: () => { assert.ok(callback); callback(); },
    bounded: async <T>(p: Promise<T>): Promise<T> => {
      let handle: ReturnType<typeof setTimeout> | undefined;
      try { return await Promise.race([p, new Promise<never>((_, reject) => { handle = set(() => reject(Error('Transport deadline failed to settle')), 200); })]); }
      finally { if (handle !== undefined) clear(handle); }
    } });
  } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear;
    if (descriptor) Object.defineProperty(performance, 'now', descriptor); else Reflect.deleteProperty(performance, 'now'); }
}
test('the deadline settles an ignoring fetch and cancels its late response without a retry', async () => {
  await controlled(async ({ advance, fire, bounded }) => {
    let resolve!: (r: Response) => void, calls = 0, cancels = 0, signal: AbortSignal | null = null;
    const promise = fetchDwdMosmixCatalogSearch('A051', { now: clock, fetcher: fetcher((_url, init) => {
      calls++; signal = init.signal as AbortSignal; return new Promise<Response>(r => { resolve = r; });
    }) });
    await Promise.resolve(); advance(); fire(); transportHold(await bounded(promise), 'timeout');
    assert.ok(signal); assert.equal((signal as AbortSignal).aborted, true);
    resolve(response(new ReadableStream<Uint8Array>({ cancel() { cancels++; } }))); await turn(); await turn();
    assert.equal(calls, 1); assert.equal(cancels, 1);
  });
});
test('the deadline settles an ignoring body even when cancellation acknowledgement stays pending', async () => {
  await controlled(async ({ advance, fire, bounded }) => {
    let cancels = 0;
    const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise<void>(() => {}); }, cancel() { cancels++; return new Promise<void>(() => {}); } });
    const promise = fetchDwdMosmixCatalogSearch('A051', { now: clock, fetcher: fetcher(() => response(stream)) });
    for (let i = 0; i < 12; i++) await Promise.resolve(); advance(); fire();
    transportHold(await bounded(promise), 'timeout'); assert.equal(cancels, 1);
  });
});
test('a delayed timer cannot authorize a response received after monotonic expiry', async () => {
  await controlled(async ({ advance, bounded }) => {
    let cancels = 0;
    const result = await bounded(fetchDwdMosmixCatalogSearch('A051', { now: clock, fetcher: fetcher(() => {
      advance(); return response(new ReadableStream<Uint8Array>({ cancel() { cancels++; } }));
    }) }));
    transportHold(result, 'timeout'); await turn(); assert.equal(cancels, 1);
  });
});
test('a delayed timer cannot authorize a body chunk delivered after monotonic expiry', async () => {
  await controlled(async ({ advance, bounded }) => {
    let cancels = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) { advance(); c.enqueue(catalog()); }, cancel() { cancels++; } }, { highWaterMark: 0 });
    transportHold(await bounded(fetchDwdMosmixCatalogSearch('A051', { now: clock, fetcher: fetcher(() => response(stream)) })), 'timeout');
    assert.equal(cancels, 1);
  });
});
test('receipt clock work remains inside the retrieval deadline', async () => {
  await controlled(async ({ advance, bounded }) => {
    transportHold(await bounded(fetchDwdMosmixCatalogSearch('A051', { now: () => { advance(); return clock(); }, fetcher: fetcher(() => response()) })), 'timeout');
  });
});
test('the deadline includes completion of actual synchronous catalogue search rather than ending at the last byte', async () => {
  await controlled(async ({ advance, bounded }) => {
    const original = String.prototype.toLowerCase; let searchCalls = 0;
    String.prototype.toLowerCase = function (this: string) { if (String(this) === 'SYNTHETIC NAME') { searchCalls++; advance(); } return Reflect.apply(original, this, []); };
    try {
      transportHold(await bounded(fetchDwdMosmixCatalogSearch('synthetic', { now: clock, fetcher: fetcher(() => response()) })), 'timeout');
      assert.equal(searchCalls, 1, 'the control advances time during the actual canonical search');
    } finally { String.prototype.toLowerCase = original; }
  });
});
