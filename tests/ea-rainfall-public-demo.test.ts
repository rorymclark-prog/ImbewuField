import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import type { EaRainfallPublicDemoOptions, EaRainfallPublicDemoResult } from '../lib/international/providers/ea-rainfall-public-demo.ts';

// Synthetic wire fixtures only. A test must never contact the provider or imply
// that its values describe a farm, a real station or a current observation.
const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
let unexpectedFetches = 0;
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: async () => {
  unexpectedFetches++; throw Error('An unmocked network request is forbidden in this test');
} });
const { fetchCountryEaRainfallPublicDemo, EA_RAINFALL_PUBLIC_DEMO_LIMITS } = await import('../lib/international/providers/ea-rainfall-public-demo.ts');
after(() => {
  if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch); else Reflect.deleteProperty(globalThis, 'fetch');
  assert.equal(unexpectedFetches, 0, 'every request must use its explicit bounded transport fixture');
});

// Independently pinned from the reviewed contract, not from the helper's own URL.
const endpoint = 'https://environment.data.gov.uk/flood-monitoring/data/readings?parameter=rainfall&latest&_view=full&_sorted&_limit=1';
const reported = 'source-reported text with unknown interval boundary';
const receiptDate = new Date('2026-11-05T02:09:36.000Z');
const now = () => receiptDate;
function payload(value: number | undefined = 0) {
  return { meta: { limit: 1, publisher: 'Environment Agency' }, items: [{
    dateTime: reported, ...(value === undefined ? {} : { value }),
    measure: { parameter: 'rainfall', unitName: 'mm', period: 900, valueType: 'total',
      station: 'https://untrusted.invalid/private-station-marker', stationReference: 'private-station-marker' },
    contact: 'private-contact-marker', location: 'private-location-marker', '@id': 'https://untrusted.invalid/reading',
  }] };
}
const missingPayload = () => {
  const source = payload();
  return { ...source, items: source.items.map(({ value: _value, ...row }) => row) };
};
const json = (value: unknown, headers: Record<string, string> = {}) => {
  // Headers names are case-insensitive; object spreading differently cased keys
  // creates a combined field instead of the intended wrong-MIME test response.
  const fields = new Headers({ 'content-type': 'application/json; charset=utf-8' });
  for (const [name, field] of Object.entries(headers)) fields.set(name, field);
  return new Response(JSON.stringify(value), { headers: fields });
};
interface Call { url: string; options: RequestInit | undefined }
type Reply = Response | Error | (() => Response | Promise<Response>);
function transport(replies: Reply[]) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    const reply = replies.shift();
    if (!reply) throw Error('Unexpected extra request');
    if (reply instanceof Error) throw reply;
    return typeof reply === 'function' ? reply() : reply;
  };
  return { calls, fetcher };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function failed(result: EaRainfallPublicDemoResult, reason: string) {
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Expected a held reference');
  assert.equal(result.reason, reason); assert.equal('reading' in result, false);
  assert.equal(result.provenance.providerId, 'ea-rainfall-public-reference');
  assert.equal(result.provenance.endpoint, endpoint); assert.equal(result.provenance.referenceOnly, true);
  return result;
}

const expectedSample = { scope: 'bounded-public-network-sample', itemLimit: 1, completeCoverage: false,
  currentness: 'not-assessed', quality: 'unknown', timeBoundary: 'unknown' };

test('only exact GB selects the fixed public sample, without reading unsupported caller options', async () => {
  let getters = 0;
  const options = Object.defineProperty({}, 'fetcher', { get() { getters++; throw Error('Must not read'); } });
  for (const code of ['US', 'KE', 'GB ', 'gb', '', 'GB?station=private', 'https://private.invalid/']) {
    const result = failed(await fetchCountryEaRainfallPublicDemo(code, options), 'unsupported-demo');
    assert.ok('stage' in result); assert.equal(result.stage, 'selection');
    assert.equal(result.provenance.fetchedAt, null);
    assert.doesNotMatch(JSON.stringify(result), /private\.invalid|GB\?station/);
  }
  assert.equal(getters, 0);
});

test('one explicit JSON request preserves a real zero, opaque source text and the independent retrieval receipt', async () => {
  const raw = payload(), before = JSON.stringify(raw), wire = transport([json(raw)]); let clocks = 0;
  const result = await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } });
  assert.equal(result.status, 'available');
  if (result.status !== 'available') throw Error('Valid zero was withheld');
  assert.deepEqual(result.reading, { rainfallMm: 0, reportedAt: reported, periodSeconds: 900, units: 'mm', valueType: 'total' });
  assert.deepEqual(result.sample, expectedSample);
  assert.equal(result.provenance.fetchedAt, receiptDate.toISOString()); assert.equal(result.provenance.endpoint, endpoint);
  assert.equal(clocks, 1); assert.equal(wire.calls.length, 1); assert.equal(wire.calls[0].url, endpoint);
  const request = wire.calls[0].options!;
  assert.equal(request.redirect, 'error'); assert.equal(request.credentials, 'omit'); assert.equal(request.cache, 'no-store');
  assert.ok(request.signal instanceof AbortSignal);
  const headers = new Headers(request.headers);
  assert.equal(headers.get('accept'), 'application/json'); assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false);
  assert.equal(request.body, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private-|untrusted|stationReference|contact|location/);
  assert.equal(JSON.stringify(raw), before);
});

test('a missing measurement stays unknown, empty response stays unavailable, and neither borrows a former success', async () => {
  const wire = transport([json(payload()), json(missingPayload()), json({ meta: { limit: 1 }, items: [] }), new Error('Controlled refresh failure')]);
  const first = await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now }); assert.equal(first.status, 'available');
  const missing = await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now });
  assert.equal(missing.status, 'partial');
  if (missing.status !== 'partial') throw Error('Absent measurement changed meaning');
  assert.equal(missing.reading.rainfallMm, null); assert.equal(missing.reading.reportedAt, reported);
  const empty = await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now });
  assert.equal(empty.status, 'unavailable'); assert.equal('reading' in empty, false);
  if (empty.status === 'unavailable') assert.equal(empty.reason, 'no-reading');
  const rejected = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now }), 'network-error');
  assert.equal(rejected.provenance.fetchedAt, null); assert.equal(wire.calls.length, 4);
  assert.ok(wire.calls.every(call => call.url === endpoint));
});

test('real decoder refusals remain distinguishable from transport errors and never expose a reading', async () => {
  const unsupported = payload(); unsupported.items[0].measure.unitName = 'm';
  const wire = transport([json(unsupported)]);
  const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now }), 'unsupported-measurement');
  assert.equal(result.provenance.fetchedAt, now().toISOString()); assert.equal(wire.calls.length, 1);
  assert.deepEqual('sample' in result ? result.sample : null, expectedSample);
});

test('receipt clocks run only after the complete body has been parsed, never while data is still arriving', async () => {
  let control!: ReadableStreamDefaultController<Uint8Array>, clocks = 0;
  const stream = new ReadableStream<Uint8Array>({ start(value) { control = value; } });
  const wire = transport([new Response(stream, { headers: { 'content-type': 'application/json' } })]);
  const pending = fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } });
  await tick(); assert.equal(clocks, 0);
  const bytes = new TextEncoder().encode(JSON.stringify(payload()));
  control.enqueue(bytes.subarray(0, 10)); await tick(); assert.equal(clocks, 0);
  control.enqueue(bytes.subarray(10)); control.close();
  assert.equal((await pending).status, 'available'); assert.equal(clocks, 1); assert.equal(stream.locked, false);
});

test('redirect status, followed redirects and substituted response URLs are refused without another request', async () => {
  const cases = [
    { response: new Response(null, { status: 302, headers: { location: 'https://untrusted.invalid/' } }), reason: 'http-error' },
    { response: Object.defineProperty(json(payload()), 'redirected', { value: true }), reason: 'http-error' },
    { response: Object.defineProperty(json(payload()), 'url', { value: 'https://untrusted.invalid/changed' }), reason: 'malformed-response' },
    { response: Object.defineProperty(json(payload()), 'url', { value: endpoint + '#changed' }), reason: 'malformed-response' },
  ];
  for (const { response, reason } of cases) {
    const wire = transport([response]); let clocks = 0;
    const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } }), reason);
    assert.equal(result.provenance.fetchedAt, null); assert.equal(clocks, 0); assert.equal(wire.calls.length, 1);
    assert.equal(wire.calls[0].options?.redirect, 'error');
  }
  const exact = transport([Object.defineProperty(json(payload()), 'url', { value: endpoint })]);
  assert.equal((await fetchCountryEaRainfallPublicDemo('GB', { fetcher: exact.fetcher, now })).status, 'available');
});

test('HTTP refusal and rate limits retain truthful status and only integer Retry-After evidence, without retry', async () => {
  for (const [status, retry, expected] of [[503, null, undefined], [429, '7', 7], [429, '0', 0],
    [429, '-1', null], [429, '1.5', null], [429, 'later', null], [429, '9007199254740992', null]] as const) {
    const wire = transport([new Response('Refused', { status, headers: retry === null ? {} : { 'retry-after': retry } })]);
    let clocks = 0;
    const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } }), status === 429 ? 'rate-limited' : 'http-error');
    assert.ok('httpStatus' in result); assert.equal(result.httpStatus, status);
    if (status === 429) { assert.ok('retryAfterSeconds' in result); assert.equal(result.retryAfterSeconds, expected); }
    assert.equal(clocks, 0); assert.equal(result.provenance.fetchedAt, null); assert.equal(wire.calls.length, 1);
  }
});

test('only JSON MIME and complete valid UTF-8 JSON bodies reach the decoder or receipt clock', async () => {
  const responses = ['text/html', 'application/geo+json', 'application/jsonp', ''].map(mime => json(payload(), { 'content-type': mime }));
  responses.push(new Response('{', { headers: { 'content-type': 'application/json' } }));
  responses.push(new Response(new Uint8Array([0xff]), { headers: { 'content-type': 'application/json' } }));
  responses.push(new Response(null, { headers: { 'content-type': 'application/json' } }));
  for (const response of responses) {
    const wire = transport([response]); let clocks = 0;
    failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } }), 'malformed-response');
    assert.equal(clocks, 0); assert.equal(wire.calls.length, 1); assert.equal(response.body?.locked ?? false, false);
  }
});

test('a conflicting combined media header cannot borrow its JSON prefix or produce a retrieval receipt', async () => {
  const response = json(payload(), { 'content-type': 'application/json; charset=utf-8, text/html' });
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8, text/html', 'exercise the actual conflicting field rather than an object-key override');
  const wire = transport([response]); let clocks = 0;
  const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher,
    now: () => { clocks++; return now(); } }), 'malformed-response');
  assert.equal(result.provenance.fetchedAt, null); assert.equal(clocks, 0);
  assert.equal(wire.calls.length, 1); assert.equal(response.body?.locked ?? false, false);
});

test('actual streamed bytes remain bounded when Content-Length is absent or falsely small, and cancellation may fail', async () => {
  for (const length of [null, '2']) for (const cancellationRejects of [false, true]) {
    let cancellations = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(control) { control.enqueue(new Uint8Array(40_000)); },
      cancel() { cancellations++; if (cancellationRejects) return Promise.reject(Error('Controlled cancellation rejection')); } });
    const wire = transport([new Response(stream, { headers: { 'content-type': 'application/json', ...(length === null ? {} : { 'content-length': length }) } })]);
    let clocks = 0;
    failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } }), 'response-too-large');
    assert.equal(cancellations, 1); assert.equal(stream.locked, false); assert.equal(clocks, 0); assert.equal(wire.calls.length, 1);
  }
});

test('the exact byte limit remains usable and advertised excess cancels without a receipt or body reader', async () => {
  const content = JSON.stringify(payload()), byteLength = new TextEncoder().encode(content).byteLength;
  const padded = new Response(content + ' '.repeat(EA_RAINFALL_PUBLIC_DEMO_LIMITS.responseBytes - byteLength),
    { headers: { 'content-type': 'application/json', 'content-length': String(EA_RAINFALL_PUBLIC_DEMO_LIMITS.responseBytes) } });
  const wire = transport([padded]); assert.equal((await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now })).status, 'available');
  let cancellations = 0, clocks = 0;
  const stream = new ReadableStream<Uint8Array>({ pull() {}, cancel() { cancellations++; } });
  const oversized = transport([new Response(stream, { headers: { 'content-type': 'application/json', 'content-length': String(EA_RAINFALL_PUBLIC_DEMO_LIMITS.responseBytes + 1) } })]);
  failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: oversized.fetcher, now: () => { clocks++; return now(); } }), 'response-too-large');
  assert.equal(cancellations, 1); assert.equal(stream.locked, false); assert.equal(clocks, 0);
});

test('fetch rejection and broken body streams report network failure, with no replacement or retrieval receipt', async () => {
  const broken = new ReadableStream<Uint8Array>({ pull(control) { control.error(Error('Controlled broken stream')); } });
  for (const response of [Error('Controlled fetch rejection'), new Response(broken, { headers: { 'content-type': 'application/json' } })]) {
    const wire = transport([response]); let clocks = 0;
    const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); } }), 'network-error');
    assert.equal(result.provenance.fetchedAt, null); assert.equal(clocks, 0); assert.equal(wire.calls.length, 1);
  }
  assert.equal(broken.locked, false);
});

test('a fetch ignoring abort still settles at its deadline, and a late body is cancelled without a late clock', { timeout: 2000 }, async () => {
  const late = deferred<Response>(), wire = transport([() => late.promise]); let clocks = 0, cancellations = 0;
  const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); }, timeoutMs: 5 }), 'timeout');
  assert.equal(result.provenance.fetchedAt, null); assert.equal(wire.calls.length, 1); assert.equal(wire.calls[0].options?.signal?.aborted, true);
  const stream = new ReadableStream<Uint8Array>({ pull() {}, cancel() { cancellations++; } });
  late.resolve(new Response(stream, { headers: { 'content-type': 'application/json' } }));
  await tick(); assert.equal(cancellations, 1); assert.equal(stream.locked, false); assert.equal(clocks, 0); assert.equal(wire.calls.length, 1);
});

test('a stalled body and an unacknowledged cancellation cannot keep the caller or receipt clock pending', { timeout: 2000 }, async () => {
  let cancellations = 0, clocks = 0;
  const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); }, cancel() { cancellations++; return new Promise(() => {}); } });
  const wire = transport([new Response(stream, { headers: { 'content-type': 'application/json' } })]);
  const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); }, timeoutMs: 5 }), 'timeout');
  await tick(); assert.equal(cancellations, 1); assert.equal(clocks, 0); assert.equal(result.provenance.fetchedAt, null); assert.equal(stream.locked, false);
});

test('one deadline spans fetch and body delivery instead of restarting when headers arrive', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const late = deferred<Response>(), wire = transport([() => late.promise]); let cancellations = 0, clocks = 0;
  const pending = fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); }, timeoutMs: 10 });
  context.mock.timers.tick(6);
  const stream = new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); }, cancel() { cancellations++; } });
  late.resolve(new Response(stream, { headers: { 'content-type': 'application/json' } })); await tick();
  context.mock.timers.tick(4); failed(await pending, 'timeout'); await tick();
  assert.equal(cancellations, 1); assert.equal(clocks, 0); assert.equal(wire.calls.length, 1);
});

test('custom timeouts cannot enlarge the fixed software deadline or change the endpoint', async context => {
  assert.equal(Object.isFrozen(EA_RAINFALL_PUBLIC_DEMO_LIMITS), true);
  assert.equal(EA_RAINFALL_PUBLIC_DEMO_LIMITS.totalTimeoutMs, 12_000); assert.equal(EA_RAINFALL_PUBLIC_DEMO_LIMITS.responseBytes, 65_536);
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const wire = transport([() => new Promise(() => {})]); let settled = false;
  const pending = fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now, timeoutMs: 100_000 }).then(result => { settled = true; return result; });
  context.mock.timers.tick(11_999); await tick(); assert.equal(settled, false);
  context.mock.timers.tick(1); failed(await pending, 'timeout');
  assert.equal(wire.calls.length, 1); assert.equal(wire.calls[0].url, endpoint);
});

test('elapsed monotonic time with delayed timer callbacks cannot publish a late response or call its receipt clock', async () => {
  const wire = transport([() => { const began = performance.now(); while (performance.now() - began < 30) { /* Delay timer delivery deliberately. */ } return json(payload()); }]);
  let clocks = 0;
  const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: () => { clocks++; return now(); }, timeoutMs: 5 }), 'timeout');
  assert.equal(result.provenance.fetchedAt, null); assert.equal(clocks, 0); assert.equal(wire.calls.length, 1);
  assert.equal(wire.calls[0].options?.signal?.aborted, true);
});

test('unsafe option descriptors and malformed values are held without getter calls or a transport request', async () => {
  let getters = 0, requests = 0;
  const fetcher: typeof fetch = async () => { requests++; return json(payload()); };
  const cases: unknown[] = [null, [], { fetcher, timeoutMs: 0 }, { fetcher, timeoutMs: -1 }, { fetcher, timeoutMs: NaN },
    { fetcher, timeoutMs: Infinity }, { fetcher: 'not a function' }, { fetcher, now: 'not a function' },
    ...['fetcher', 'now', 'timeoutMs'].map(name => Object.defineProperty(name === 'fetcher' ? {} : { fetcher }, name,
      { enumerable: true, get() { getters++; throw Error('Must not execute'); } })),
    new Proxy({}, { getOwnPropertyDescriptor() { throw Error('Controlled reflection refusal'); } }),
  ];
  for (const options of cases) failed(await fetchCountryEaRainfallPublicDemo('GB', options as EaRainfallPublicDemoOptions), 'invalid-options');
  assert.equal(getters, 0); assert.equal(requests, 0);
});

test('invalid receipt clocks do not impersonate a successful retrieval or execute an object method', async () => {
  let methods = 0;
  for (const clock of [() => { throw Error('Controlled clock failure'); }, () => new Date(NaN),
    () => ({ toISOString() { methods++; return 'made up'; } }) as unknown as Date]) {
    const wire = transport([json(payload())]);
    const result = failed(await fetchCountryEaRainfallPublicDemo('GB', { fetcher: wire.fetcher, now: clock }), 'invalid-options');
    assert.equal(result.provenance.fetchedAt, null); assert.equal(wire.calls.length, 1);
  }
  assert.equal(methods, 0);
});
