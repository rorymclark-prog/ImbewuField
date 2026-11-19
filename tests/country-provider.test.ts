import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeNasaReference, fetchCountryClimateReference, NASA_REFERENCE_PROVIDER, type ClimateProvenance } from '@/lib/international/providers/nasa-reference';

const KEYS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
function fixture() {
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [36.8, -1.3, 0] },
    header: { range: '25-year Meteorological and Solar Monthly & Annual Climatologies (January 2001 - December 2025)',
      api: { version: 'synthetic-test' }, sources: ['MERRA2'], time_standard: 'LST', fill_value: -999 },
    properties: { parameter: { T2M: Object.fromEntries(KEYS.map((key, i) => [key, i])) } }, parameters: { T2M: { units: 'C' } } };
}
const provenance: ClimateProvenance = { providerId: NASA_REFERENCE_PROVIDER.id, fetchedAt: '2026-11-01T00:00:00Z',
  attribution: NASA_REFERENCE_PROVIDER.attribution, demoPlace: 'Public synthetic fixture', endpoint: null, referenceOnly: true };
const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const fetcher = (response: Response): typeof fetch => async () => response;

test('a complete Celsius reference retains zero, all twelve months, actual source period and attribution', async () => {
  let calls = 0;
  const result = await fetchCountryClimateReference('KE', { fetcher: async (url, init) => {
    calls++; const endpoint = new URL(String(url));
    assert.equal(endpoint.origin, 'https://power.larc.nasa.gov');
    assert.equal(endpoint.searchParams.get('parameters'), 'T2M');
    assert.equal(endpoint.searchParams.get('latitude'), '-1.3'); assert.equal(endpoint.searchParams.get('longitude'), '36.8');
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
    return jsonResponse(fixture());
  } });
  assert.equal(calls, 1); assert.notEqual(result.status, 'failed');
  if (result.status === 'failed') return;
  assert.equal(result.status, 'available'); assert.deepEqual(result.monthly[0], { month: 1, state: 'value', valueC: 0 });
  assert.equal(result.monthly.length, 12); assert.equal(result.units, 'C');
  assert.deepEqual(result.period, { start: '2001-01', end: '2025-12', description: fixture().header.range });
  assert.equal(result.dataset.apiVersion, 'synthetic-test'); assert.equal(result.dataset.timeStandard, 'LST');
  assert.equal(result.provenance.referenceOnly, true); assert.match(result.provenance.attribution, /NASA POWER/);
});

test('missing, null and provider fill measurements stay unknown instead of becoming zero', () => {
  const payload = fixture(); delete payload.properties.parameter.T2M.FEB;
  payload.properties.parameter.T2M.MAR = -999;
  const result = decodeNasaReference(payload, provenance);
  if (result.status === 'failed') assert.fail(`Missing one month must retain partial data: ${result.reason}`);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.monthly[1], { month: 2, state: 'missing', valueC: null });
  assert.deepEqual(result.monthly[2], { month: 3, state: 'missing', valueC: null });
  for (const key of KEYS) payload.properties.parameter.T2M[key] = -999;
  assert.equal(decodeNasaReference(payload, provenance).status, 'failed');
  const missingAll = decodeNasaReference(payload, provenance); if (missingAll.status === 'failed') assert.equal(missingAll.reason, 'missing-measurement');
});

test('wrong or absent units, malformed values, undated ranges and mismatched points are withheld', async () => {
  for (const unit of ['K', 'F', '', 'mm/day']) {
    const payload = fixture(); payload.parameters.T2M.units = unit;
    const result = decodeNasaReference(payload, provenance);
    assert.equal(result.status, 'failed'); if (result.status === 'failed') assert.equal(result.reason, 'wrong-units');
  }
  for (const value of [NaN, Infinity, '5', {}, []]) {
    const payload = fixture() as unknown as Record<string, any>; payload.properties.parameter.T2M.JAN = value;
    const result = decodeNasaReference(payload, provenance); assert.equal(result.status, 'failed');
  }
  const undated = fixture(); undated.header.range = 'period not recorded';
  const noPeriod = decodeNasaReference(undated, provenance); assert.equal(noPeriod.status, 'failed');
  const wrongPoint = fixture(); wrongPoint.geometry.coordinates[0] = -77;
  const result = await fetchCountryClimateReference('KE', { fetcher: fetcher(jsonResponse(wrongPoint)) });
  assert.equal(result.status, 'failed'); if (result.status === 'failed') assert.equal(result.reason, 'malformed-response');
});

test('a legacy explicit period is retained rather than silently replaced by the current live period', () => {
  const payload = fixture() as unknown as Record<string, any>;
  delete payload.header.range; payload.header.start = 'JAN1991'; payload.header.end = 'DEC2020';
  const result = decodeNasaReference(payload, provenance);
  assert.notEqual(result.status, 'failed'); if (result.status === 'failed') return;
  assert.equal(result.period.start, '1991-01'); assert.equal(result.period.end, '2020-12');
});

test('conflicting response periods cannot label a country reference with whichever period is preferred', () => {
  const payload = fixture();
  payload.header = { ...payload.header, ...{ start: 'JAN1991', end: 'DEC2020' } };
  const result = decodeNasaReference(payload, provenance);
  assert.equal(result.status, 'failed');
  if (result.status === 'failed') assert.equal(result.reason, 'malformed-response');
});

test('unsupported codes and attacker-controlled URL strings never make a network request', async () => {
  let calls = 0;
  for (const code of ['EU', 'ZZ', '__proto__', 'https://example.com/private', 'constructor']) {
    const result = await fetchCountryClimateReference(code, { fetcher: async () => { calls++; return jsonResponse(fixture()); } });
    assert.equal(result.status, 'failed'); if (result.status === 'failed') assert.equal(result.reason, 'unsupported-demo');
    assert.equal(result.provenance.endpoint, null);
  }
  assert.equal(calls, 0);
});

test('rate limits and server errors stay distinct and never trigger automatic retries or invented climate', async () => {
  for (const status of [429, 503]) {
    let calls = 0;
    const result = await fetchCountryClimateReference('KE', { fetcher: async () => {
      calls++; return new Response('', { status, headers: { 'retry-after': '42' } });
    } });
    assert.equal(calls, 1); assert.equal(result.status, 'failed');
    if (result.status === 'failed') {
      assert.equal(result.reason, status === 429 ? 'rate-limited' : 'http-error'); assert.equal(result.httpStatus, status);
      if (status === 429) assert.equal(result.retryAfterSeconds, 42);
    }
  }
});

test('timeouts remain bounded even if an injected fetch ignores abort and network failure stays explicit', async () => {
  const result = await fetchCountryClimateReference('KE', { timeoutMs: 5, fetcher: () => new Promise(() => {}) });
  assert.equal(result.status, 'failed'); if (result.status === 'failed') assert.equal(result.reason, 'timeout');
  const failed = await fetchCountryClimateReference('KE', { fetcher: async () => { throw new TypeError('synthetic offline'); } });
  assert.equal(failed.status, 'failed'); if (failed.status === 'failed') assert.equal(failed.reason, 'network-error');
});

test('body decoding is bounded and a stalled stream times out during reading', async () => {
  const oversized = await fetchCountryClimateReference('KE', { fetcher: fetcher(new Response('x'.repeat(65_537), { headers: { 'content-type': 'application/json' } })) });
  assert.equal(oversized.status, 'failed'); if (oversized.status === 'failed') assert.equal(oversized.reason, 'response-too-large');
  const stalled = await fetchCountryClimateReference('KE', { timeoutMs: 5,
    fetcher: fetcher(new Response(new ReadableStream<Uint8Array>({ pull() { return new Promise(() => {}); } }), { headers: { 'content-type': 'application/json' } })) });
  assert.equal(stalled.status, 'failed'); if (stalled.status === 'failed') assert.equal(stalled.reason, 'timeout');
});

test('HTML and invalid JSON remain malformed responses rather than accepted provider data', async () => {
  for (const response of [new Response('<html>Unavailable</html>', { headers: { 'content-type': 'text/html' } }),
    new Response('{not-json}', { headers: { 'content-type': 'application/json' } })]) {
    const result = await fetchCountryClimateReference('KE', { fetcher: fetcher(response) });
    assert.equal(result.status, 'failed'); if (result.status === 'failed') assert.equal(result.reason, 'malformed-response');
  }
});
