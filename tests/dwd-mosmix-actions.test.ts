import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { checkDwdStationReference } from '../app/international/dwd-mosmix-actions.ts';

// Node function-boundary checks only. They do not establish Next.js RPC,
// authentication, browser behavior or a deployed rate-limiting policy.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/dwd-mosmix-import-synthetic.json', import.meta.url), 'utf8'));
const endpoint = 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/01234/kml/MOSMIX_L_LATEST_01234.kmz';
const archive = () => new Uint8Array(Buffer.from(fixtures.cases.utf8.kmzBase64, 'base64'));
type ActionResult = Awaited<ReturnType<typeof checkDwdStationReference>>;
function noRawIntermediates(result: ActionResult): void {
  assert.equal('archive' in result, false); assert.equal('kml' in result, false); assert.ok(Object.isFrozen(result));
}

test('a second client argument cannot replace the server fetcher, clock or transport deadline', async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let clientFetchCalls = 0, clientClockCalls = 0, clientTimeoutReads = 0;
  const clientTime = '2001-02-03T04:05:06.321Z';
  const clientOptions = {
    async fetcher() { clientFetchCalls++; return new Response('SYNTHETIC CLIENT OVERRIDE', { status: 429 }); },
    now() { clientClockCalls++; return new Date(clientTime); },
    get timeoutMs() { clientTimeoutReads++; return 1; },
  };
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(archive(), { headers: { 'content-type': 'application/vnd.google-earth.kmz' } });
  }) as typeof fetch;
  try {
    const result: ActionResult = await Reflect.apply(checkDwdStationReference, undefined, [{ stationId: '01234' }, clientOptions]);
    assert.equal(result.status, 'partial');
    if (result.status !== 'partial') throw Error('Server-default fixture did not reach the actual final decoder');
    assert.equal(calls.length, 1); assert.equal(calls[0].url, endpoint);
    assert.equal(calls[0].init?.redirect, 'error'); assert.equal(calls[0].init?.credentials, 'omit'); assert.equal(calls[0].init?.cache, 'no-store');
    assert.deepEqual(result.station, { id: '01234', description: 'SYNTHETIC café' });
    assert.deepEqual(result.units, { temperature: 'K', precipitation: 'kg/m2' });
    assert.equal(result.periods[0].temperatureK, 273.15); assert.equal(result.periods[0].precipitationKgM2, 0);
    assert.equal(result.periods[1].temperatureK, null); assert.equal(result.provenance.endpoint, endpoint);
    assert.notEqual(result.provenance.fetchedAt, clientTime);
    assert.equal(new Date(result.provenance.fetchedAt).toISOString(), result.provenance.fetchedAt);
    assert.equal(clientFetchCalls, 0); assert.equal(clientClockCalls, 0); assert.equal(clientTimeoutReads, 0);
    noRawIntermediates(result);
  } finally { globalThis.fetch = original; }
});

test('invalid station shapes and extra URL or private-context fields are held before any server fetch', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async () => { calls++; throw Error('Invalid selections must not reach fetch'); }) as typeof fetch;
  try {
    for (const input of [null, {}, { stationId: '../01234' },
      { stationId: '01234', url: 'https://example.invalid/another-archive' },
      { stationId: '01234', accountContext: { label: 'SYNTHETIC ONLY' } },
      { stationId: '01234', siteContext: { label: 'SYNTHETIC ONLY' } },
    ]) {
      const result = await checkDwdStationReference(input);
      assert.equal(result.status, 'failed');
      if (result.status !== 'failed') throw Error('Invalid action input returned reference data');
      assert.equal(result.reason, 'invalid-station'); assert.equal(result.provenance, null);
      noRawIntermediates(result);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test('server HTTP 429 forwards a known zero retry delay once without exposing provider bytes', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async url => {
    calls++; assert.equal(String(url), endpoint);
    return new Response('SYNTHETIC PROVIDER DETAIL', { status: 429, headers: { 'retry-after': '0' } });
  }) as typeof fetch;
  try {
    const result = await checkDwdStationReference({ stationId: '01234' });
    assert.deepEqual(result, { status: 'failed', reason: 'rate-limited', endpoint, stationId: '01234',
      provenance: null, httpStatus: 429, retryAfterSeconds: 0 });
    assert.equal(calls, 1); assert.equal(JSON.stringify(result).includes('SYNTHETIC PROVIDER DETAIL'), false);
    noRawIntermediates(result);
  } finally { globalThis.fetch = original; }
});
