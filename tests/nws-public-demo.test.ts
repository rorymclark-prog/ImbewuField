import assert from 'node:assert/strict';
import test from 'node:test';
import { COUNTRY_CLIMATE_DEMOS } from '../lib/international/providers/nasa-reference.ts';
import { fetchCountryNwsPublicDemo, NWS_PUBLIC_DEMO_LIMITS, type NwsPublicDemoOptions } from '../lib/international/providers/nws-public-demo.ts';

// Entirely synthetic transport/decoder fixtures. No retrieved forecast bodies,
// farm locations, climate interpretation or growing recommendations are copied.
const demo = COUNTRY_CLIMATE_DEMOS.US;
const now = () => new Date('2026-11-05T18:00:00.000Z');
const mapped = (office = 'BMX', x = 17, y = 23) => `https://api.weather.gov/gridpoints/${office}/${x},${y}/forecast`;
function point(office = 'BMX', x = 17, y = 23) {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [demo.longitude, demo.latitude] },
    properties: { gridId: office, gridX: x, gridY: y, forecast: mapped(office, x, y) } };
}
function forecast() {
  return { type: 'Feature', properties: { units: 'si', generatedAt: '2026-11-05T11:00:00-05:00',
    updateTime: '2026-11-05T10:00:00-05:00', validTimes: '2026-11-05T12:00:00-05:00/P1D', periods: [{ number: 3,
      name: 'Synthetic period', startTime: '2026-11-05T12:00:00-05:00', endTime: '2026-11-06T00:00:00-05:00',
      isDaytime: true, temperature: { unitCode: 'wmoUnit:degC', value: 17.125 as number | null },
      probabilityOfPrecipitation: { unitCode: 'wmoUnit:percent', value: 0 as number | null },
      shortForecast: 'Synthetic summary', detailedForecast: 'Synthetic transport fixture.' }] } };
}
const json = (value: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(value),
  { headers: { 'Content-Type': 'application/geo+json; charset=utf-8', ...headers } });
interface Call { url: string; options: RequestInit | undefined }
type Reply = Response | Error | (() => Response | Promise<Response>);
function transport(replies: Reply[]) {
  const calls: Call[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    calls.push({ url: String(input), options });
    const reply = replies.shift();
    if (!reply) throw Error('Unexpected additional transport call');
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

test('unsupported selections cannot read options, fetch or echo caller coordinates into a receipt', async () => {
  let optionReads = 0;
  const options = Object.defineProperty({}, 'fetcher', { get() { optionReads++; throw Error('Must not inspect'); } });
  for (const code of ['KE', 'GB', 'BR', 'us', 'US ', '', 'https://private.invalid/point']) {
    const result = await fetchCountryNwsPublicDemo(code, options);
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Unsupported selection fetched');
    assert.equal(result.reason, 'unsupported-demo'); assert.equal(result.stage, 'selection');
    assert.equal(result.provenance.endpoint, ''); assert.equal(result.provenance.demoPlace, '');
    assert.equal(result.provenance.fetchedAt, ''); assert.equal(result.provenance.referenceOnly, true);
  }
  assert.equal(optionReads, 0);
});

test('the server-intended two-step request uses the public point authority and preserves native units, offsets and source times', async () => {
  const payload = forecast(), before = JSON.stringify(payload), events: string[] = [];
  const wire = transport([() => { events.push('point-response'); return json(point()); },
    () => { events.push('forecast-response'); return json(payload); }]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now: () => { events.push('retrieved-clock'); return now(); } });
  if (result.status === 'failed') throw Error(result.reason);
  assert.equal(result.status, 'available');
  assert.deepEqual(wire.calls.map(call => call.url), [
    `https://api.weather.gov/points/${demo.latitude},${demo.longitude}`, `${mapped()}?units=si`,
  ]);
  assert.deepEqual(events, ['point-response', 'retrieved-clock', 'forecast-response', 'retrieved-clock']);
  for (const call of wire.calls) {
    assert.equal(call.options?.redirect, 'error'); assert.equal(call.options?.credentials, 'omit'); assert.equal(call.options?.cache, 'no-store');
    const headers = new Headers(call.options?.headers);
    assert.match(headers.get('user-agent')!, /ImbewuField.*https:\/\/imbewufield\.vercel\.app/);
    assert.match(headers.get('accept')!, /application\/geo\+json/);
    assert.equal(headers.has('authorization'), false); assert.equal(headers.has('cookie'), false);
  }
  assert.equal(wire.calls[0].options?.signal, wire.calls[1].options?.signal);
  assert.equal(result.periods[0].temperatureC, 17.125); assert.equal(result.periods[0].precipitationPercent, 0);
  assert.equal(result.periods[0].startTime, payload.properties.periods[0].startTime);
  assert.equal(result.metadata.generatedAt, payload.properties.generatedAt);
  assert.equal(result.metadata.updateTime, payload.properties.updateTime);
  assert.equal(result.metadata.validTimes, payload.properties.validTimes);
  assert.equal(result.provenance.fetchedAt, now().toISOString()); assert.equal(result.provenance.endpoint, `${mapped()}?units=si`);
  assert.equal(result.provenance.demoPlace, demo.label); assert.equal(result.provenance.referenceOnly, true);
  assert.equal('productionPlanSupported' in result, false); assert.equal('frostWarning' in result.periods[0], false);
  assert.equal(JSON.stringify(payload), before);
});

test('each invocation discovers its current mapping instead of caching a former office or grid', async () => {
  const wire = transport([json(point()), json(forecast()), json(point('NH1', 29, 47)), json(forecast())]);
  assert.equal((await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now })).status, 'available');
  assert.equal((await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now })).status, 'available');
  assert.deepEqual(wire.calls.map(call => call.url), [
    `https://api.weather.gov/points/${demo.latitude},${demo.longitude}`, `${mapped()}?units=si`,
    `https://api.weather.gov/points/${demo.latitude},${demo.longitude}`, `${mapped('NH1', 29, 47)}?units=si`,
  ]);
});

test('unofficial or ambiguous returned URLs and mismatched grid metadata never become the second request', async () => {
  const altered = [
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('api.weather.gov', 'example.invalid'); },
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('https:', 'http:'); },
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('api.weather.gov', 'user:password@api.weather.gov'); },
    (p: ReturnType<typeof point>) => { p.properties.forecast += '?units=si'; },
    (p: ReturnType<typeof point>) => { p.properties.forecast += '#fragment'; },
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('api.weather.gov', 'api.weather.gov:443'); },
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('api.weather.gov', 'api.weather.gov:444'); },
    (p: ReturnType<typeof point>) => { p.properties.forecast += '/hourly'; },
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('/17,', '/017,'); },
    (p: ReturnType<typeof point>) => { p.properties.forecast = mapped().replace('/gridpoints/', '/a/../gridpoints/'); },
    (p: ReturnType<typeof point>) => { p.properties.gridId = 'LWX'; },
    (p: ReturnType<typeof point>) => { p.properties.gridX++; },
    (p: ReturnType<typeof point>) => { p.properties.gridY++; },
    (p: ReturnType<typeof point>) => { p.properties.gridX = -1; },
    (p: ReturnType<typeof point>) => { p.properties.gridY = Number.MAX_SAFE_INTEGER + 1; },
    (p: ReturnType<typeof point>) => { p.properties.gridId = '../'; },
    (p: ReturnType<typeof point>) => { p.geometry.coordinates[0] += 1; },
    (p: ReturnType<typeof point>) => { p.type = 'FeatureCollection'; },
    (p: ReturnType<typeof point>) => { p.geometry.type = 'Polygon'; },
    (p: ReturnType<typeof point>) => { p.properties = Object.create({ ...p.properties }); },
  ];
  for (const mutate of altered) {
    const payload = point(); mutate(payload);
    const wire = transport([json(payload), Error('An invalid mapping must never reach the forecast transport')]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Invalid mapping accepted');
    assert.equal(result.reason, 'malformed-response'); assert.equal(result.stage, 'point'); assert.equal(wire.calls.length, 1);
  }
});

test('redirect responses are held with no follow-up, and every fetch requires redirect:error', async () => {
  for (const forecastStep of [false, true]) for (const redirect of [new Response(null, { status: 302, headers: { Location: 'https://example.invalid/' } }),
    Object.defineProperty(json(forecastStep ? forecast() : point()), 'redirected', { value: true })]) {
    const wire = transport(forecastStep ? [json(point()), redirect] : [redirect]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Redirect response accepted');
    assert.equal(result.reason, 'http-error'); assert.equal(result.stage, forecastStep ? 'forecast' : 'point');
    assert.equal(wire.calls.length, forecastStep ? 2 : 1); assert.ok(wire.calls.every(call => call.options?.redirect === 'error'));
  }
});

test('HTTP errors and rate limits retain their stage and bounded retry-after evidence without retrying', async () => {
  for (const forecastStep of [false, true]) for (const [status, retry] of [[503, null], [429, '7'], [429, 'not-seconds']] as const) {
    const response = new Response('Unavailable', { status, headers: retry === null ? {} : { 'retry-after': retry } });
    const wire = transport(forecastStep ? [json(point()), response] : [response]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('HTTP error accepted');
    assert.equal(result.reason, status === 429 ? 'rate-limited' : 'http-error'); assert.equal(result.httpStatus, status);
    assert.equal(result.stage, forecastStep ? 'forecast' : 'point'); assert.equal(wire.calls.length, forecastStep ? 2 : 1);
    if (status === 429) assert.equal(result.retryAfterSeconds, retry === '7' ? 7 : null);
    assert.equal(result.provenance.fetchedAt, '', 'a failed response cannot reuse the preceding point retrieval time');
  }
});

test('native decoding keeps missing measurements null, zero genuine and wrong units held', async () => {
  const missing = forecast(); missing.properties.periods[0].temperature.value = null; missing.properties.periods[0].probabilityOfPrecipitation.value = null;
  const wire = transport([json(point()), json(missing)]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
  if (result.status === 'failed') throw Error(result.reason);
  assert.equal(result.status, 'partial');
  assert.equal(result.periods[0].temperatureC, null); assert.equal(result.periods[0].precipitationPercent, null);
  const bad = forecast(); bad.properties.periods[0].temperature.unitCode = 'wmoUnit:degF';
  const invalid = transport([json(point()), json(bad)]);
  const held = await fetchCountryNwsPublicDemo('US', { fetcher: invalid.fetcher, now });
  assert.equal(held.status, 'failed');
  if (held.status !== 'failed') throw Error('Wrong decoder units accepted');
  assert.equal(held.reason, 'malformed-response'); assert.equal(held.stage, 'decode'); assert.ok(held.decoderReason);
  assert.equal(invalid.calls.length, 2);
});

test('wrong MIME, invalid JSON and invalid UTF-8 fail at either step without fallback values', async () => {
  for (const forecastStep of [false, true]) for (const response of [
    new Response('{}', { headers: { 'content-type': 'text/html' } }),
    new Response('{}', { headers: { 'content-type': 'application/jsonp' } }),
    new Response('{', { headers: { 'content-type': 'application/json' } }),
    new Response(new Uint8Array([0x7b, 0xc3, 0x28, 0x7d]), { headers: { 'content-type': 'application/geo+json' } }),
  ]) {
    const wire = transport(forecastStep ? [json(point()), response] : [response]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Invalid representation accepted');
    assert.equal(result.reason, 'malformed-response'); assert.equal(result.stage, forecastStep ? 'forecast' : 'point');
    assert.equal(wire.calls.length, forecastStep ? 2 : 1);
  }
});

test('the byte software bound applies to each actual stream even when content-length is absent or false', async () => {
  for (const forecastStep of [false, true]) for (const length of [undefined, '0']) {
    let cancellations = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(40_000)); }, cancel() { cancellations++; } });
    const response = new Response(stream, { headers: { 'content-type': 'application/geo+json', ...(length ? { 'content-length': length } : {}) } });
    const wire = transport(forecastStep ? [json(point()), response] : [response]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Oversize stream accepted');
    assert.equal(result.reason, 'response-too-large'); assert.equal(result.stage, forecastStep ? 'forecast' : 'point');
    assert.equal(cancellations, 1); assert.equal(wire.calls.length, forecastStep ? 2 : 1);
  }
});

test('both responses can meet the exact byte limit, while an advertised larger response is cancelled before reading', async () => {
  const padded = (value: unknown) => {
    const body = JSON.stringify(value), bytes = new TextEncoder().encode(body).byteLength;
    return new Response(' '.repeat(NWS_PUBLIC_DEMO_LIMITS.responseBytes - bytes) + body, { headers: { 'content-type': 'application/json' } });
  };
  const wire = transport([padded(point()), padded(forecast())]);
  assert.equal((await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now })).status, 'available');
  let cancelled = 0, pulls = 0;
  const body = new ReadableStream<Uint8Array>({ pull() { pulls++; }, cancel() { cancelled++; } });
  const large = transport([new Response(body, { headers: { 'content-type': 'application/json',
    'content-length': String(NWS_PUBLIC_DEMO_LIMITS.responseBytes + 1) } })]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: large.fetcher, now });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Advertised oversize response accepted');
  assert.equal(result.reason, 'response-too-large'); assert.equal(cancelled, 1);
  assert.ok(pulls <= 1); assert.equal(large.calls.length, 1);
});

test('network rejection and stream failure remain distinct from malformed JSON at both steps', async () => {
  for (const forecastStep of [false, true]) for (const reply of [Error('Synthetic network failure'),
    new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.error(Error('Synthetic interrupted body')); } }),
      { headers: { 'content-type': 'application/json' } })]) {
    const wire = transport(forecastStep ? [json(point()), reply] : [reply]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Failed transport accepted');
    assert.equal(result.reason, 'network-error'); assert.equal(result.stage, forecastStep ? 'forecast' : 'point');
    assert.equal(wire.calls.length, forecastStep ? 2 : 1);
  }
});

test('a fetcher ignoring abort still times out and its late point response cannot start another request', { timeout: 2000 }, async () => {
  const late = deferred<Response>(), wire = transport([() => late.promise]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now, timeoutMs: 5 });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Ignored-signal fetch escaped its deadline');
  assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'point');
  assert.equal(wire.calls[0].options?.signal?.aborted, true);
  late.resolve(json(point())); await tick(); assert.equal(wire.calls.length, 1);
});

test('one total deadline spans point discovery and forecast delivery rather than restarting for step two', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const first = deferred<Response>(), second = deferred<Response>(), started = deferred<void>();
  const wire = transport([() => first.promise, () => { started.resolve(); return second.promise; }]);
  const pending = fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now, timeoutMs: 10 });
  context.mock.timers.tick(6); first.resolve(json(point())); await started.promise;
  context.mock.timers.tick(4); const result = await pending;
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Second request received an independent new deadline');
  assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'forecast'); assert.equal(wire.calls.length, 2);
  second.resolve(json(forecast())); await tick();
  context.mock.timers.reset();
});

test('a stalled response body is bounded independently of the fetch promise and acknowledges cancellation', { timeout: 2000 }, async () => {
  let cancelled = 0;
  const response = new Response(new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); }, cancel() { cancelled++; } }),
    { headers: { 'content-type': 'application/json' } });
  const wire = transport([json(point()), response]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now, timeoutMs: 5 });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Stalled body escaped total deadline');
  assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'forecast'); assert.equal(cancelled, 1);
});

test('invalid options and a throwing or invalid retrieval clock return a bounded failure without a forecast request', async () => {
  let getterCalls = 0;
  const executable = Object.defineProperty({}, 'now', { get() { getterCalls++; throw Error('Must not execute'); } });
  for (const options of [executable, { timeoutMs: 0 }, { timeoutMs: NaN }, { fetcher: 1 }]) {
    const result = await fetchCountryNwsPublicDemo('US', options as NwsPublicDemoOptions);
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Invalid options accepted');
    assert.equal(result.reason, 'invalid-options'); assert.equal(result.stage, 'selection');
  }
  assert.equal(getterCalls, 0);
  for (const clock of [() => { throw Error('Synthetic clock failure'); }, () => new Date(NaN)]) {
    const wire = transport([json(point())]);
    const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now: clock });
    assert.equal(result.status, 'failed');
    if (result.status !== 'failed') throw Error('Invalid receipt clock accepted');
    assert.equal(result.reason, 'invalid-options'); assert.equal(result.provenance.fetchedAt, ''); assert.equal(wire.calls.length, 1);
  }
});

test('a point response arriving after elapsed deadline cannot beat a delayed timer or start a forecast request', async () => {
  const wire = transport([() => {
    const began = performance.now(); while (performance.now() - began < 30) { /* Deliberately delay the timer callback. */ }
    return json(point());
  }, json(forecast())]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now, timeoutMs: 5 });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('An elapsed deadline published a forecast');
  assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'point');
  assert.equal(wire.calls.length, 1, 'a late point response cannot grant another request');
  assert.equal(wire.calls[0].options?.signal?.aborted, true);
});

test('a forecast response arriving after elapsed deadline cannot publish while timer callbacks are delayed', async () => {
  const wire = transport([json(point()), () => {
    const began = performance.now(); while (performance.now() - began < 30) { /* Promise continuations run before the delayed timer. */ }
    return json(forecast());
  }]);
  const result = await fetchCountryNwsPublicDemo('US', { fetcher: wire.fetcher, now, timeoutMs: 5 });
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('A late forecast was published');
  assert.equal(result.reason, 'timeout'); assert.equal(result.stage, 'forecast'); assert.equal(wire.calls.length, 2);
  assert.equal(wire.calls[1].options?.signal?.aborted, true);
});
