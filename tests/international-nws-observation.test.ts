import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeNwsObservation, fetchNwsStationReference, parseNwsObservationResult, NWS_OBSERVATION_LIMITS, NWS_OBSERVATION_PROVIDER,
  SONOMA_NWS_REFERENCE, type NwsObservationResult } from '@/lib/international/providers/nws-observation';

const NOW = '2030-03-01T01:00:00.000Z';
const OBSERVED = '2030-03-01T00:30:00+00:00';
const q = (value: unknown, unitCode: unknown, qualityControl: unknown = 'V'): Record<string, unknown> => ({ value, unitCode, qualityControl });
function fixture() {
  // Synthetic measurements and times; the unequal published points exercise the
  // actual station/observation shape without inventing a farm measurement.
  const station = { id: String(SONOMA_NWS_REFERENCE.metadataUrl), type: 'Feature',
    geometry: { type: 'Point', coordinates: [-122.81667, 38.5] },
    properties: { '@id': SONOMA_NWS_REFERENCE.metadataUrl, stationIdentifier: 'KSTS', name: 'Public synthetic station fixture',
      timeZone: 'America/Los_Angeles', provider: 'ASOS-HFM', subProvider: '' } as Record<string, unknown> };
  const observationId = `${SONOMA_NWS_REFERENCE.metadataUrl}/observations/${OBSERVED}`;
  const observation = { id: observationId, type: 'Feature', geometry: { type: 'Point', coordinates: [-122.82, 38.52] },
    properties: { '@id': observationId, station: SONOMA_NWS_REFERENCE.metadataUrl, stationId: 'KSTS', timestamp: OBSERVED,
      temperature: q(0, 'wmoUnit:degC'), dewpoint: q(-1, 'wmoUnit:degC'), relativeHumidity: q(0, 'wmoUnit:percent'),
      windSpeed: q(0, 'wmoUnit:km_h-1'), windGust: q(0, 'wmoUnit:km_h-1'), windDirection: q(0, 'wmoUnit:degree_(angle)'),
      precipitationLastHour: q(0, 'wmoUnit:mm'), precipitationLast3Hours: q(0, 'wmoUnit:mm'), precipitationLast6Hours: q(0, 'wmoUnit:mm'),
      minTemperatureLast24Hours: q(-2, 'wmoUnit:degC'), maxTemperatureLast24Hours: q(2, 'wmoUnit:degC'),
    } as Record<string, unknown> };
  return { station, observation };
}
function success(result: NwsObservationResult) {
  if (result.status === 'failed') assert.fail(`Expected reference data, got ${result.reason}`);
  return result;
}
function failure(result: NwsObservationResult) {
  if (result.status !== 'failed') assert.fail('Expected explicit failure, not replacement weather');
  return result;
}
const response = (payload: unknown, type = 'application/geo+json') => new Response(JSON.stringify(payload), { headers: { 'content-type': type } });
const clock = () => new Date(NOW);
const fetchFixture = (data = fixture()): typeof fetch => async url => response(String(url) === SONOMA_NWS_REFERENCE.metadataUrl ? data.station : data.observation);

test('a station reference preserves source units, QC, zeros and both unequal published points without mutating inputs', () => {
  const data = fixture(); const before = structuredClone(data);
  const result = success(decodeNwsObservation(data.station, data.observation, NOW));
  assert.equal(result.status, 'available'); assert.equal(result.stationId, 'KSTS');
  assert.equal(result.stationProvider, 'ASOS-HFM'); assert.equal(result.stationSubProvider, null);
  assert.deepEqual(result.stationPoint.coordinates, [-122.81667, 38.5]);
  assert.deepEqual(result.observationPoint.coordinates, [-122.82, 38.52]);
  assert.deepEqual(result.measurements.temperature, { state: 'value', value: 0, unitCode: 'wmoUnit:degC', qualityControl: 'V' });
  assert.equal(result.measurements.dewpoint.value, -1); assert.equal(result.measurements.precipitationLastHour.value, 0);
  assert.equal(result.provenance.referenceOnly, true); assert.match(result.provenance.attribution, /NOAA/);
  assert.equal(result.provenance.fetchedAt, NOW); assert.equal(result.observedAt, OBSERVED);
  result.stationPoint.coordinates[0] = 0;
  assert.deepEqual(data, before);
});

test('the actual missing-object and null-value shapes never become dry weather or daily temperature extrema', () => {
  const data = fixture();
  delete data.observation.properties.precipitationLastHour;
  data.observation.properties.precipitationLast6Hours = null;
  data.observation.properties.precipitationLast3Hours = q(null, 'wmoUnit:mm', 'Z');
  data.observation.properties.minTemperatureLast24Hours = { value: null, unitCode: 'wmoUnit:degC' };
  const result = success(decodeNwsObservation(data.station, data.observation, NOW));
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.measurements.precipitationLastHour, { state: 'missing', value: null, unitCode: null, qualityControl: null });
  assert.equal(result.measurements.precipitationLast6Hours.state, 'missing');
  assert.deepEqual(result.measurements.precipitationLast3Hours, { state: 'missing', value: null, unitCode: 'wmoUnit:mm', qualityControl: 'Z' });
  assert.equal(result.measurements.minTemperatureLast24Hours.state, 'missing');
  assert.equal(result.measurements.temperature.value, 0);
});

test('malformed quantities, absent units and unsupported units are distinct and do not erase independent measurements', () => {
  for (const value of ['0', Infinity, NaN, true, {}, []]) {
    const data = fixture(); data.observation.properties.temperature = q(value, 'wmoUnit:degC');
    const result = success(decodeNwsObservation(data.station, data.observation, NOW));
    assert.equal(result.measurements.temperature.state, 'invalid'); assert.equal(result.measurements.temperature.value, null);
    assert.equal(result.measurements.windSpeed.state, 'value');
  }
  for (const unit of [null, '', 5]) {
    const data = fixture(); data.observation.properties.temperature = q(0, unit);
    const result = success(decodeNwsObservation(data.station, data.observation, NOW));
    assert.equal(result.measurements.temperature.state, 'invalid');
  }
  const data = fixture(); data.observation.properties.temperature = q(273.15, 'wmoUnit:K');
  const result = success(decodeNwsObservation(data.station, data.observation, NOW));
  assert.deepEqual(result.measurements.temperature, { state: 'unsupported-unit', value: null, unitCode: 'wmoUnit:K', qualityControl: 'V' });
  data.observation.properties.temperature = '0';
  assert.equal(success(decodeNwsObservation(data.station, data.observation, NOW)).measurements.temperature.state, 'invalid');
});

test('quality-control flags are preserved without inventing a pass meaning, while unknown flags withhold the quantity', () => {
  for (const flag of ['Z', 'C', 'S', 'V', 'X', 'Q', 'G', 'B', 'T']) {
    const data = fixture(); data.observation.properties.temperature = q(0, 'wmoUnit:degC', flag);
    const result = success(decodeNwsObservation(data.station, data.observation, NOW));
    assert.equal(result.measurements.temperature.qualityControl, flag);
  }
  for (const flag of ['APPROVED', null, 3]) {
    const data = fixture(); data.observation.properties.temperature = q(0, 'wmoUnit:degC', flag);
    assert.equal(success(decodeNwsObservation(data.station, data.observation, NOW)).measurements.temperature.state, 'invalid');
  }
  const data = fixture(); data.observation.properties.temperature = { value: 0, unitCode: 'wmoUnit:degC' };
  assert.equal(success(decodeNwsObservation(data.station, data.observation, NOW)).measurements.temperature.qualityControl, null);
});

test('an observation of another station is rejected even when its numeric weather looks plausible', () => {
  const mutations: ((d: ReturnType<typeof fixture>) => void)[] = [
    d => { d.station.id = 'https://example.com/stations/KSTS'; },
    d => { d.station.properties.stationIdentifier = 'KTOP'; },
    d => { d.station.properties['@id'] = 'https://api.weather.gov/stations/KTOP'; },
    d => { d.observation.properties.station = 'https://api.weather.gov/stations/KTOP'; },
    d => { d.observation.properties.stationId = 'KTOP'; },
    d => { d.observation.id = `https://example.com/stations/KSTS/observations/${OBSERVED}`; },
    d => { d.observation.properties['@id'] = 'https://api.weather.gov/stations/KTOP'; },
  ];
  for (const mutate of mutations) {
    const data = fixture(); mutate(data);
    assert.equal(failure(decodeNwsObservation(data.station, data.observation, NOW)).reason, 'station-mismatch');
  }
  const data = fixture(); delete data.observation.properties.stationId;
  assert.equal(success(decodeNwsObservation(data.station, data.observation, NOW)).stationId, 'KSTS');
});

test('invalid GeoJSON is withheld, and a valid third coordinate stays detached and unchanged', () => {
  for (const coordinates of [[181, 38], [-122, 91], [-122], [-122, 38, 1, 2], [NaN, 38]]) {
    const data = fixture(); data.station.geometry.coordinates = coordinates;
    assert.equal(failure(decodeNwsObservation(data.station, data.observation, NOW)).reason, 'malformed-response');
  }
  const data = fixture(); data.observation.geometry.type = 'LineString';
  assert.equal(failure(decodeNwsObservation(data.station, data.observation, NOW)).reason, 'malformed-response');
  data.observation.geometry.type = 'Point'; data.observation.geometry.coordinates.push(3);
  assert.deepEqual(success(decodeNwsObservation(data.station, data.observation, NOW)).observationPoint.coordinates, [-122.82, 38.52, 3]);
});

test('source times require real offset-bearing instants, and latest does not imply fresh or correctly clocked', () => {
  for (const timestamp of ['2030-02-30T00:00:00Z', '2030-03-01', '2030-03-01T00:00:00', '2030-03-01T24:00:00Z', 'bad', null]) {
    const data = fixture(); data.observation.properties.timestamp = timestamp;
    assert.equal(failure(decodeNwsObservation(data.station, data.observation, NOW)).reason, 'invalid-timestamp');
  }
  const data = fixture();
  for (const [observedAt, fetchedAt, expected] of [
    [OBSERVED, NOW, 'at-or-before-retrieval'],
    [OBSERVED, '2035-01-01T00:00:00Z', 'at-or-before-retrieval'],
    [OBSERVED, '2030-02-28T23:00:00Z', 'after-retrieval'],
  ]) {
    const result = success(decodeNwsObservation(data.station, data.observation, fetchedAt));
    assert.equal(result.observedAt, observedAt); assert.equal(result.timing, expected); assert.equal(result.freshness, 'not-assessed');
  }
  assert.equal(failure(decodeNwsObservation(data.station, data.observation, 'invalid')).reason, 'invalid-timestamp');
});

test('empty observation quantities retain an honest partial record instead of fabricating replacement readings', () => {
  const data = fixture();
  for (const key of Object.keys(data.observation.properties)) if (!['@id', 'station', 'stationId', 'timestamp'].includes(key)) delete data.observation.properties[key];
  const result = success(decodeNwsObservation(data.station, data.observation, NOW));
  assert.equal(result.status, 'partial'); assert.ok(Object.values(result.measurements).every(m => m.state === 'missing' && m.value === null));
});

test('one explicit reference sends exactly two public requests with app identification and no private input', async () => {
  const data = fixture(); const calls: string[] = [];
  const result = success(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async (url, init) => {
    calls.push(String(url)); assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit'); assert.ok(init?.signal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('user-agent'), NWS_OBSERVATION_PROVIDER.userAgent);
    assert.equal(headers.get('accept'), 'application/geo+json');
    return response(calls.length === 1 ? data.station : data.observation);
  } }));
  assert.deepEqual(calls, [SONOMA_NWS_REFERENCE.metadataUrl, SONOMA_NWS_REFERENCE.observationUrl]);
  assert.equal(result.provenance.metadataEndpoint, calls[0]); assert.equal(result.provenance.observationEndpoint, calls[1]);
});

test('URL strings, country codes and inherited-object keys never become network destinations', async () => {
  let calls = 0;
  for (const key of ['US', 'KE', 'GB', '__proto__', 'constructor', 'KSTS', 'https://example.com/private', 'sonoma-ksts?lat=1']) {
    const result = failure(await fetchNwsStationReference(key, { now: clock, fetcher: async () => { calls++; return response(fixture().station); } }));
    assert.equal(result.reason, 'unsupported-reference'); assert.equal(result.provenance.referenceKey, null);
    assert.equal(result.provenance.metadataEndpoint, null); assert.equal(result.provenance.observationEndpoint, null);
  }
  assert.equal(calls, 0);
});

test('bad metadata stops before the observation request', async () => {
  for (const malformed of [false, true]) {
    const data = fixture(); let calls = 0;
    if (malformed) data.station.geometry.type = 'Polygon'; else data.station.properties.stationIdentifier = 'KTOP';
    const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => { calls++; return response(data.station); } }));
    assert.equal(calls, 1); assert.equal(result.reason, malformed ? 'malformed-response' : 'station-mismatch');
  }
});

test('rate-limit, HTTP and network failures remain distinct at either request without retry or replacement data', async () => {
  for (const failAt of [1, 2]) for (const status of [429, 503]) {
    let calls = 0;
    const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => {
      calls++; return calls === failAt ? new Response('', { status, headers: { 'retry-after': '42' } }) : response(fixture().station);
    } }));
    assert.equal(calls, failAt); assert.equal(result.reason, status === 429 ? 'rate-limited' : 'http-error'); assert.equal(result.httpStatus, status);
    if (status === 429) assert.equal(result.retryAfterSeconds, 42);
  }
  const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => { throw new TypeError('synthetic offline'); } }));
  assert.equal(result.reason, 'network-error');
  const retry = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => new Response('', { status: 429, headers: { 'retry-after': 'tomorrow' } }) }));
  assert.equal(retry.retryAfterSeconds, null);
});

test('redirects and unexpected effective endpoints cannot change the allowlisted host or resource', async () => {
  for (const effective of ['https://example.com/stations/KSTS', 'https://api.weather.gov/stations/KTOP']) {
    const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => {
      const r = response(fixture().station); Object.defineProperty(r, 'url', { value: effective }); return r;
    } }));
    assert.equal(result.reason, 'redirect-not-allowed');
  }
  const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => new Response('', { status: 302, headers: { location: 'https://example.com' } }) }));
  assert.equal(result.reason, 'redirect-not-allowed');
});

test('the whole-operation deadline stops stalled headers and streams even when injected I/O ignores abort', async () => {
  const hanging = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, timeoutMs: 5, fetcher: () => new Promise(() => {}) }));
  assert.equal(hanging.reason, 'timeout');
  let calls = 0;
  const stalled = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, timeoutMs: 5, fetcher: async () => {
    calls++;
    return new Response(new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); }, cancel() { return new Promise(() => {}); } }), { headers: { 'content-type': 'application/geo+json' } });
  } }));
  assert.equal(stalled.reason, 'timeout'); assert.equal(calls, 1);
});

test('a late first response after timeout never starts a second provider request', async () => {
  let calls = 0; let resolveResponse: ((r: Response) => void) | undefined;
  const result = await fetchNwsStationReference('sonoma-ksts', { now: clock, timeoutMs: 5, fetcher: () => { calls++; return new Promise(resolve => { resolveResponse = resolve; }); } });
  assert.equal(failure(result).reason, 'timeout');
  resolveResponse!(response(fixture().station));
  await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls, 1);
});

test('the observation body shares the same abort signal and deadline as its metadata request', async () => {
  const signals: (AbortSignal | null | undefined)[] = []; let calls = 0;
  const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, timeoutMs: 5, fetcher: async (_url, init) => {
    signals.push(init?.signal); calls++;
    return calls === 1 ? response(fixture().station) : new Response(new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); } }), { headers: { 'content-type': 'application/geo+json' } });
  } }));
  assert.equal(result.reason, 'timeout'); assert.equal(calls, 2); assert.equal(signals[0], signals[1]); assert.equal(signals[1]?.aborted, true);
});

test('retrieval time comes from completion rather than replacing an old observation time', async () => {
  let reads = 0; const completed = '2030-03-01T01:01:00.000Z';
  const result = success(await fetchNwsStationReference('sonoma-ksts', {
    now: () => new Date(reads++ === 0 ? NOW : completed), fetcher: fetchFixture(),
  }));
  assert.equal(result.provenance.fetchedAt, completed); assert.equal(result.observedAt, OBSERVED); assert.equal(result.freshness, 'not-assessed');
});

test('both content-length and streamed-byte limits apply to either body, independent of a lying length header', async () => {
  for (const failAt of [1, 2]) for (const declared of ['1', String(NWS_OBSERVATION_LIMITS.maxBodyBytes + 1)]) {
    let calls = 0;
    const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => {
      calls++;
      return calls === failAt ? new Response('x'.repeat(NWS_OBSERVATION_LIMITS.maxBodyBytes + 1), { headers: { 'content-type': 'application/geo+json', 'content-length': declared } }) : response(fixture().station);
    } }));
    assert.equal(result.reason, 'response-too-large'); assert.equal(calls, failAt);
  }
});

test('HTML, broken JSON, invalid UTF-8 and missing bodies remain explicit failures', async () => {
  for (const makeResponse of [
    () => new Response('<html>offline</html>', { headers: { 'content-type': 'text/html' } }),
    () => new Response('{broken', { headers: { 'content-type': 'application/json' } }),
    () => new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/geo+json' } }),
    () => new Response(null, { headers: { 'content-type': 'application/geo+json' } }),
  ]) {
    const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => makeResponse() }));
    assert.equal(result.reason, 'malformed-response');
  }
  const result = success(await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: fetchFixture() }));
  assert.equal(result.status, 'available');
});

test('a broken injected retrieval clock withholds a result before external calls', async () => {
  let calls = 0;
  const result = failure(await fetchNwsStationReference('sonoma-ksts', { now: () => new Date(NaN), fetcher: async () => { calls++; return response(fixture().station); } }));
  assert.equal(result.reason, 'invalid-timestamp'); assert.equal(result.provenance.fetchedAt, null); assert.equal(calls, 0);
});

test('the API parser accepts JSON-roundtripped producer output with zero, optional QC, missing and unsupported quantities', async () => {
  const data = fixture(); data.observation.properties.temperature = { value: 0, unitCode: 'wmoUnit:degC' };
  data.observation.properties.windGust = null;
  data.observation.properties.dewpoint = q(273.15, 'wmoUnit:K');
  data.observation.properties.precipitationLastHour = q('0', 'wmoUnit:mm');
  const produced = await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: fetchFixture(data) });
  const parsed = parseNwsObservationResult(JSON.parse(JSON.stringify(produced)));
  assert.deepEqual(parsed, produced);
  const result = success(parsed!);
  assert.equal(result.status, 'partial'); assert.equal(result.measurements.temperature.value, 0);
  assert.equal(result.measurements.temperature.qualityControl, null);
  assert.equal(result.measurements.windGust.state, 'missing'); assert.equal(result.measurements.windGust.value, null);
  assert.equal(result.measurements.dewpoint.state, 'unsupported-unit'); assert.equal(result.measurements.dewpoint.value, null);
  assert.equal(result.measurements.precipitationLastHour.state, 'invalid'); assert.equal(result.measurements.precipitationLastHour.value, null);
});

const envelope = (): Record<string, unknown> => JSON.parse(JSON.stringify(decodeNwsObservation(fixture().station, fixture().observation, NOW)));
const nested = (value: unknown) => value as Record<string, unknown>;

test('a known generic unit cannot make a malformed temperature, rainfall or humidity look valid in the UI', () => {
  for (const [field, wrongUnit] of [['temperature', 'wmoUnit:km_h-1'], ['windSpeed', 'wmoUnit:degC'],
    ['precipitationLastHour', 'wmoUnit:percent'], ['relativeHumidity', 'wmoUnit:mm']]) {
    const body = envelope(); nested(nested(body.measurements)[field]).unitCode = wrongUnit;
    assert.equal(parseNwsObservationResult(body), null, field);
  }
  for (const amount of ['0', NaN, Infinity, {}, null]) {
    const body = envelope(); nested(nested(body.measurements).temperature).value = amount;
    assert.equal(parseNwsObservationResult(body), null);
  }
});

test('the API parser rejects invalid source identity, time, geometry, freshness and timing instead of repairing them', () => {
  const changes: ((body: Record<string, unknown>) => void)[] = [
    b => { nested(b.provenance).providerId = 'other-provider'; },
    b => { nested(b.provenance).referenceKey = 'other-reference'; },
    b => { nested(b.provenance).metadataEndpoint = 'https://example.com'; },
    b => { nested(b.provenance).observationEndpoint = SONOMA_NWS_REFERENCE.metadataUrl; },
    b => { nested(b.provenance).attribution = 'unknown source'; },
    b => { nested(b.provenance).referenceOnly = false; },
    b => { nested(b.provenance).fetchedAt = '2030-02-30T00:00:00Z'; },
    b => { nested(b.provenance).fetchedAt = null; },
    b => { b.observedAt = '2030-02-30T00:00:00Z'; },
    b => { b.observationId = `${SONOMA_NWS_REFERENCE.metadataUrl}/observations/other-time`; },
    b => { b.stationId = 'KTOP'; },
    b => { nested(b.stationPoint).type = 'LineString'; },
    b => { nested(b.observationPoint).coordinates = [-122, 91]; },
    b => { nested(b.observationPoint).coordinates = ['-122', 38]; },
    b => { b.freshness = 'fresh'; },
    b => { b.timing = 'after-retrieval'; },
    b => { b.stationName = 3; },
    b => { b.stationProvider = {}; },
    b => { b.stationSubProvider = ''; },
    b => { b.timeZone = null; },
  ];
  for (const change of changes) { const body = envelope(); change(body); assert.equal(parseNwsObservationResult(body), null); }
  for (const bad of [null, [], 'weather', 3, {}]) assert.equal(parseNwsObservationResult(bad), null);
});

test('normalized unknown states stay null and cannot silently become a value or an available result', () => {
  for (const state of ['missing', 'invalid', 'unsupported-unit', 'other-state']) {
    const body = envelope(); body.status = 'partial'; const m = nested(nested(body.measurements).temperature);
    m.state = state; m.value = 0;
    assert.equal(parseNwsObservationResult(body), null);
  }
  const body = envelope(); const m = nested(nested(body.measurements).temperature);
  body.status = 'partial'; m.state = 'invalid'; m.value = null; m.reason = 'invented-reason';
  assert.equal(parseNwsObservationResult(body), null);
  m.reason = 'invalid-value'; assert.notEqual(parseNwsObservationResult(body), null);
  body.status = 'available'; assert.equal(parseNwsObservationResult(body), null);
  const partialAllValues = envelope(); partialAllValues.status = 'partial'; assert.equal(parseNwsObservationResult(partialAllValues), null);
  const missingField = envelope(); delete nested(missingField.measurements).windGust; assert.equal(parseNwsObservationResult(missingField), null);
});

test('the parser returns detached known fields and preserves an explicitly future observation flag without certifying freshness', () => {
  const data = fixture();
  const produced = success(decodeNwsObservation(data.station, data.observation, '2030-02-28T23:00:00Z'));
  const body = JSON.parse(JSON.stringify(produced));
  body.rawMessage = 'private unknown field fixture'; body.provenance.credential = 'private unknown field fixture';
  body.measurements.temperature.raw = 'private unknown field fixture';
  const parsed = success(parseNwsObservationResult(body)!);
  assert.deepEqual(parsed, produced); assert.equal(parsed.timing, 'after-retrieval'); assert.equal(parsed.freshness, 'not-assessed');
  parsed.stationPoint.coordinates[0] = 0; assert.notEqual(body.stationPoint.coordinates[0], 0);
  assert.doesNotMatch(JSON.stringify(parsed), /private unknown field/);
});

test('actual producer failures and a null retrieval clock survive parsing while malformed failure envelopes are withheld', async () => {
  const results = [
    await fetchNwsStationReference('unsupported', { now: clock, fetcher: fetchFixture() }),
    await fetchNwsStationReference('sonoma-ksts', { now: () => new Date(NaN), fetcher: fetchFixture() }),
    await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => new Response('', { status: 429, headers: { 'retry-after': '42' } }) }),
    await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => new Response('', { status: 503 }) }),
    await fetchNwsStationReference('sonoma-ksts', { now: clock, fetcher: async () => { throw new Error('synthetic offline'); } }),
  ];
  for (const result of results) assert.deepEqual(parseNwsObservationResult(JSON.parse(JSON.stringify(result))), result);
  const rateLimited = JSON.parse(JSON.stringify(results[2])) as Record<string, unknown>;
  const changes: ((body: Record<string, unknown>) => void)[] = [
    b => { b.reason = 'unrecognised-failure'; }, b => { b.httpStatus = '429'; }, b => { b.httpStatus = 503; },
    b => { b.retryAfterSeconds = -1; }, b => { b.retryAfterSeconds = 1.5; }, b => { b.retryAfterSeconds = '42'; },
    b => { nested(b.provenance).fetchedAt = 'not-a-time'; }, b => { nested(b.provenance).referenceKey = null; },
    b => { nested(b.provenance).observationEndpoint = 'https://example.com'; },
  ];
  for (const change of changes) { const body = structuredClone(rateLimited); change(body); assert.equal(parseNwsObservationResult(body), null); }
  rateLimited.privateBody = 'private unknown field fixture';
  assert.doesNotMatch(JSON.stringify(parseNwsObservationResult(rateLimited)), /private unknown field/);
});
