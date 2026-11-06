import assert from 'node:assert/strict';
import test from 'node:test';
import { searchDwdStationCatalogReference } from '../app/international/dwd-catalog-actions.ts';

// Actual Node function-boundary checks only, not Next.js delivery, authentication,
// deployed browser behavior or a rate-limiting policy.
const endpoint = 'https://www.dwd.de/DE/leistungen/met_verfahren_mosmix/mosmix_stationskatalog.cfg?view=nasPublication&nn=16102';
type ActionResult = Awaited<ReturnType<typeof searchDwdStationCatalogReference>>;
function syntheticCatalog(): Uint8Array<ArrayBuffer> {
  const row = new Uint8Array(52).fill(32), ascii = (value: string) => new TextEncoder().encode(value);
  row.set(ascii(' A051'), 0); row.set(ascii('ABCD'), 6); row.set(ascii('MARKER ALPHA'), 11);
  // Ignored fields are opaque letters, never coordinates.
  row.set(ascii('ABCDEF'), 32); row.set(ascii('GHIJKLM'), 39); row.set(ascii('NOPQR'), 47);
  const header = ascii('ID    ICAO NAME                 LAT    LON     ELEV\n----- ---- -------------------- -----  ------- -----\n');
  const output = new Uint8Array(header.length + row.length + 1);
  output.set(header); output.set(row, header.length); output[output.length - 1] = 10; return output;
}
function noRaw(result: ActionResult): void {
  for (const key of ['archive', 'kml', 'bytes', 'rawBytes', 'stationId', 'expectedStationId']) assert.equal(key in result, false);
  assert.ok(Object.isFrozen(result));
}
test('client transport arguments cannot replace the server fetch, clock, fixed URL or credentials', async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  let clientReads = 0, clientFetches = 0, clientClocks = 0;
  const clientTime = '2001-02-03T04:05:06.321Z';
  const client = new Proxy({
    fetcher() { clientFetches++; throw Error('Client fetch must not run'); },
    now() { clientClocks++; return new Date(clientTime); },
    timeoutMs: 1, url: 'https://example.invalid/another-catalog',
    headers: { Cookie: 'SYNTHETIC CLIENT COOKIE', Authorization: 'SYNTHETIC CLIENT AUTH' }, credentials: 'include',
  }, { get() { clientReads++; throw Error('Client option must not be read'); },
    getOwnPropertyDescriptor() { clientReads++; throw Error('Client option must not be reflected'); },
    ownKeys() { clientReads++; throw Error('Client option keys must not be read'); } });
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(syntheticCatalog(), { headers: { 'content-type': 'text/plain; charset=UTF-8' } });
  }) as typeof fetch;
  try {
    const result: ActionResult = await Reflect.apply(searchDwdStationCatalogReference, undefined, ['  MaRkEr  ', client]);
    assert.equal(result.status, 'matches'); if (result.status !== 'matches') throw Error('Server-default synthetic catalog did not reach search');
    assert.equal(calls.length, 1); assert.equal(calls[0].url, endpoint);
    assert.equal(calls[0].init?.credentials, 'omit'); assert.equal(calls[0].init?.redirect, 'error'); assert.equal(calls[0].init?.cache, 'no-store');
    const headers = new Headers(calls[0].init?.headers); assert.equal(headers.get('cookie'), null); assert.equal(headers.get('authorization'), null);
    assert.equal(result.query, 'MaRkEr'); assert.deepEqual(result.matches, [{ stationId: 'A051', name: 'MARKER ALPHA' }]);
    assert.equal(result.totalMatches, 1); assert.equal(result.catalogStationCount, 1);
    assert.equal(result.provenance.endpoint, endpoint); assert.equal(result.provenance.kind, 'public-station-catalog');
    assert.notEqual(result.provenance.fetchedAt, clientTime); assert.equal(new Date(result.provenance.fetchedAt).toISOString(), result.provenance.fetchedAt);
    assert.equal(clientReads, 0); assert.equal(clientFetches, 0); assert.equal(clientClocks, 0);
    assert.ok(Object.isFrozen(result.provenance)); assert.ok(Object.isFrozen(result.matches)); assert.ok(Object.isFrozen(result.matches[0])); noRaw(result);
  } finally { globalThis.fetch = original; }
});
test('invalid primitive or unsafe query input is held before fetch, coercion and extra argument inspection', async () => {
  const original = globalThis.fetch; let calls = 0, queryReads = 0, optionReads = 0;
  globalThis.fetch = (async () => { calls++; throw Error('Invalid query must not reach provider'); }) as typeof fetch;
  const unsafeQuery = new Proxy({}, { get() { queryReads++; throw Error('Query coercion'); }, ownKeys() { queryReads++; throw Error('Query reflection'); } });
  const options = new Proxy({}, { get() { optionReads++; throw Error('Client option'); }, getOwnPropertyDescriptor() { optionReads++; throw Error('Client descriptor'); } });
  try {
    for (const query of [null, undefined, unsafeQuery, new String('marker'), BigInt(0), '', '  ', '\tmarker', 'café', ' '.repeat(59) + 'marker']) {
      const result: ActionResult = await Reflect.apply(searchDwdStationCatalogReference, undefined, [query, options]);
      assert.deepEqual(result, { status: 'failed', reason: 'invalid-query' }); noRaw(result);
    }
    assert.equal(calls, 0); assert.equal(queryReads, 0); assert.equal(optionReads, 0);
  } finally { globalThis.fetch = original; }
});
test('a server 429 preserves known zero retry delay and omits raw provider details', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async url => {
    calls++; assert.equal(String(url), endpoint);
    return new Response('SYNTHETIC PROVIDER DETAIL', { status: 429, headers: { 'retry-after': '0' } });
  }) as typeof fetch;
  try {
    const result = await searchDwdStationCatalogReference('marker');
    assert.deepEqual(result, { status: 'failed', reason: 'rate-limited', endpoint, provenance: null, httpStatus: 429, retryAfterSeconds: 0 });
    assert.equal(calls, 1); assert.equal(JSON.stringify(result).includes('SYNTHETIC PROVIDER DETAIL'), false); noRaw(result);
  } finally { globalThis.fetch = original; }
});
test('invalid catalogue content forwards the parser hold rather than a successful empty search', async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async url => {
    calls++; assert.equal(String(url), endpoint);
    return new Response('SYNTHETIC INVALID CATALOGUE', { headers: { 'content-type': 'text/plain' } });
  }) as typeof fetch;
  try {
    const result = await searchDwdStationCatalogReference('marker');
    assert.deepEqual(result, { status: 'failed', reason: 'invalid-catalog' }); assert.equal(calls, 1); noRaw(result);
  } finally { globalThis.fetch = original; }
});
