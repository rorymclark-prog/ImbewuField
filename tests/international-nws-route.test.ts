import assert from 'node:assert/strict';
import test, { beforeEach, afterEach, after, mock } from 'node:test';
import { getApps, getApp, initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { GET } from '@/app/api/international/weather-reference/route';
import { NWS_OBSERVATION_PROVIDER, NWS_OBSERVATION_LIMITS, SONOMA_NWS_REFERENCE } from '@/lib/international/providers/nws-observation';
import { checkApiRateLimit, sharedLimiter, USER_BUDGETS, ANONYMOUS_BUDGETS } from '@/lib/api-rate-limit';
import { SAMPLE_REQUEST_HEADER } from '@/lib/api-auth';
import { evaluateCountryReadiness } from '@/lib/international/countries/readiness';

// Only Firebase's external verifier and HTTPS transport are controlled. The
// real route, guard, shared limiter, query checks and provider decoder all run.
const hadApp = getApps().some(app => app.name === '[DEFAULT]');
const app = hadApp ? getApp() : initializeApp({ projectId: 'nws-route-test-fixture' });
const auth = getAuth(app);
const previousAuthFlag = process.env.REQUIRE_API_AUTH;
const UID = 'nws-route-fixture-user';
let verifyCalls = 0;
let calls: { url: string; init: RequestInit | undefined }[] = [];
let upstream: typeof fetch;

function fixture() {
  const observedAt = '2030-01-01T00:00:00+00:00';
  const id = `${SONOMA_NWS_REFERENCE.metadataUrl}/observations/${observedAt}`;
  return {
    station: { id: SONOMA_NWS_REFERENCE.metadataUrl, type: 'Feature', geometry: { type: 'Point', coordinates: [-122.81667, 38.5] },
      properties: { stationIdentifier: 'KSTS', name: 'Public synthetic airport fixture', timeZone: 'America/Los_Angeles', provider: 'ASOS-HFM' } },
    observation: { id, type: 'Feature', geometry: { type: 'Point', coordinates: [-122.82, 38.52] },
      properties: { station: SONOMA_NWS_REFERENCE.metadataUrl, stationId: 'KSTS', timestamp: observedAt,
        temperature: { value: 0, unitCode: 'wmoUnit:degC', qualityControl: 'V' },
        precipitationLast3Hours: { value: null, unitCode: 'wmoUnit:mm', qualityControl: 'Z' } } as Record<string, unknown> },
  };
}
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/geo+json' } });
function request(query = 'reference=sonoma-ksts', headers: Record<string, string> = { authorization: 'Bearer fixture-token' }, method = 'GET') {
  return new Request(`https://example.test/api/international/weather-reference${query ? `?${query}` : ''}`, { method,
    headers: { 'x-forwarded-for': '192.0.2.195', ...headers } });
}

beforeEach(() => {
  process.env.REQUIRE_API_AUTH = '1'; sharedLimiter.reset(); calls = []; verifyCalls = 0;
  mock.method(console, 'warn', () => {});
  mock.method(auth, 'verifyIdToken', async (token: string) => {
    verifyCalls++;
    if (token !== 'fixture-token') throw new Error('private verifier fixture detail');
    return { uid: UID, aud: 'nws-route-test-fixture', auth_time: 0, exp: 1, iat: 0,
      iss: 'https://securetoken.google.com/nws-route-test-fixture', sub: UID,
      firebase: { identities: {}, sign_in_provider: 'custom' } } as DecodedIdToken;
  });
  upstream = async url => json(String(url) === SONOMA_NWS_REFERENCE.metadataUrl ? fixture().station : fixture().observation);
  mock.method(globalThis, 'fetch', async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    calls.push({ url: String(url), init }); return upstream(url, init);
  });
});
afterEach(() => {
  mock.restoreAll();
  sharedLimiter.reset();
  if (previousAuthFlag === undefined) delete process.env.REQUIRE_API_AUTH; else process.env.REQUIRE_API_AUTH = previousAuthFlag;
});
after(async () => { if (!hadApp) await deleteApp(app); });

test('hard authentication and forged sample headers deny before either upstream request', async () => {
  const attempts: Record<string, string>[] = [{}, { [SAMPLE_REQUEST_HEADER]: '1' }, { authorization: 'Bearer rejected-token' }];
  for (const headers of attempts) {
    const response = await GET(request('reference=sonoma-ksts', headers));
    assert.equal(response.status, 401); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.text(); assert.match(body, /Authentication required/); assert.doesNotMatch(body, /private verifier|rejected-token/);
  }
  assert.equal(calls.length, 0); assert.equal(verifyCalls, 1);
});

test('the real data-band limiter refuses a verified caller before provider I/O and retains its retry header', async () => {
  for (let i = 0; i < USER_BUDGETS.data.limit; i++) checkApiRateLimit(request(), '/api/international/weather-reference', UID);
  const response = await GET(request());
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0);
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(calls.length, 0);
  const body = await response.json(); assert.equal(typeof body.error, 'string'); assert.doesNotMatch(JSON.stringify(body), /fixture-user|192\.0\.2/);
});

test('soft-mode access retains the shared policy and anonymous data budget rather than adding a bypass', async () => {
  delete process.env.REQUIRE_API_AUTH;
  const response = await GET(request('reference=sonoma-ksts', {}));
  assert.equal(response.status, 200); assert.equal(calls.length, 2); assert.equal(verifyCalls, 0);
  calls = [];
  for (let i = 1; i < ANONYMOUS_BUDGETS.data.limit; i++) checkApiRateLimit(request(), '/api/international/weather-reference', null);
  const refused = await GET(request('reference=sonoma-ksts', {}));
  assert.equal(refused.status, 429); assert.equal(calls.length, 0);
});

test('missing, duplicate, unknown and unsupported query inputs make zero upstream requests', async () => {
  for (const query of ['', 'reference=', 'reference=KSTS', 'reference=GB', 'reference=sonoma-ksts&reference=sonoma-ksts',
    'reference=sonoma-ksts&%72eference=sonoma-ksts', 'reference=sonoma-ksts&lat=1&lon=2',
    'reference=sonoma-ksts&url=https%3A%2F%2Fexample.com', 'reference=sonoma-ksts&stationId=KTOP',
    'unknown=sonoma-ksts', 'reference=sonoma-ksts&extra=', 'reference=sonoma-ksts+', 'reference=__proto__']) {
    const response = await GET(request(query));
    assert.equal(response.status, 400, query); assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json(); assert.equal(body.reason, 'invalid-query');
    assert.doesNotMatch(JSON.stringify(body), /example\.com|lat=|stationId|KTOP/);
  }
  assert.equal(calls.length, 0);
});

test('GET returns the real decoded partial result and sends exactly the public identified requests without credentials', async () => {
  const response = await GET(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls.map(c => c.url), [SONOMA_NWS_REFERENCE.metadataUrl, SONOMA_NWS_REFERENCE.observationUrl]);
  for (const call of calls) {
    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get('user-agent'), NWS_OBSERVATION_PROVIDER.userAgent); assert.equal(headers.get('accept'), 'application/geo+json');
    assert.equal(headers.get('authorization'), null); assert.equal(headers.get('cookie'), null);
    assert.equal(call.init?.credentials, 'omit'); assert.equal(call.init?.redirect, 'error'); assert.equal(call.init?.cache, 'no-store');
  }
  const body = await response.json();
  assert.equal(body.status, 'partial'); assert.equal(body.stationId, 'KSTS'); assert.equal(body.measurements.temperature.value, 0);
  assert.equal(body.measurements.precipitationLast3Hours.state, 'missing'); assert.equal(body.measurements.precipitationLastHour.value, null);
  assert.deepEqual(body.stationPoint.coordinates, [-122.81667, 38.5]); assert.deepEqual(body.observationPoint.coordinates, [-122.82, 38.52]);
  assert.equal(body.observedAt, fixture().observation.properties.timestamp); assert.equal(body.freshness, 'not-assessed');
  assert.equal(typeof body.provenance.fetchedAt, 'string'); assert.equal(body.provenance.referenceOnly, true);
  assert.doesNotMatch(JSON.stringify(body), /fixture-token|rawMessage|fixture-user/);
  const readiness = evaluateCountryReadiness({ countryCode: 'US', agriculturalRegionId: 'sonoma' }, '2030-01-01');
  assert.equal(readiness.productionPlanSupported, false); assert.equal(readiness.southAfricanFallbackAllowed, false);
});

test('an upstream rate limit is a service 503 with its explicit reason and safe retry duration, not the caller budget 429', async () => {
  upstream = async () => new Response('private upstream fixture detail', { status: 429, headers: { 'retry-after': '42' } });
  const response = await GET(request()); const body = await response.json();
  assert.equal(response.status, 503); assert.equal(body.status, 'failed'); assert.equal(body.reason, 'rate-limited'); assert.equal(body.httpStatus, 429);
  assert.equal(response.headers.get('retry-after'), '42'); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.length, 1); assert.doesNotMatch(JSON.stringify(body), /private upstream/);
});

test('upstream HTTP, network and malformed responses become structured gateway errors without source-body leakage', async () => {
  const cases: { reason: string; fetcher: typeof fetch }[] = [
    { reason: 'http-error', fetcher: async () => new Response('private upstream token fixture', { status: 503 }) },
    { reason: 'network-error', fetcher: async () => { throw new Error('private transport detail'); } },
    { reason: 'malformed-response', fetcher: async () => new Response('<html>private source page</html>', { headers: { 'content-type': 'text/html' } }) },
  ];
  for (const item of cases) {
    calls = []; upstream = item.fetcher;
    const response = await GET(request()); const body = await response.json();
    assert.equal(response.status, 502); assert.equal(body.status, 'failed'); assert.equal(body.reason, item.reason);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(calls.length, 1);
    assert.doesNotMatch(JSON.stringify(body), /private upstream|private transport|private source/);
  }
});

test('a whole-operation provider timeout becomes a no-store 504 without waiting for abort-ignoring transport', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let started!: () => void; const firstCall = new Promise<void>(resolve => { started = resolve; });
  upstream = () => { started(); return new Promise(() => {}); };
  const pending = GET(request()); await firstCall;
  t.mock.timers.tick(NWS_OBSERVATION_LIMITS.timeoutMs + 1);
  const response = await pending; const body = await response.json();
  assert.equal(response.status, 504); assert.equal(body.reason, 'timeout'); assert.equal(body.status, 'failed');
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(calls.length, 1); assert.equal(calls[0].init?.signal?.aborted, true);
});

test('a non-GET invocation cannot consume the public provider capability', async () => {
  const response = await GET(request('reference=sonoma-ksts', { authorization: 'Bearer fixture-token' }, 'POST'));
  assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET'); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.length, 0); assert.equal(verifyCalls, 0);
});
