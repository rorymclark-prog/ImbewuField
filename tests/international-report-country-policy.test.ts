import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { DEMO_COORDS, DEMO_LOCATION } from '../lib/demo-site.ts';
import { bindSiteContext, createSiteCountryContext } from '../lib/international/site-context.ts';
import { canonicalCoordinateSiteId } from '../lib/site-id.ts';
import { cropPlanPromptBlock, type ReportSiteFacts } from '../lib/report-site-facts.ts';

const demoId = canonicalCoordinateSiteId(`site:${DEMO_COORDS.lat.toFixed(5)},${DEMO_COORDS.lon.toFixed(5)}`)!;
const uid = 'report-owner-a';
const probe = {
  auth: { uid: uid as string | null, guest: undefined as true | undefined, response: undefined as Response | undefined },
  places: new Map<string, unknown>(), reads: [] as string[], failRead: false,
  metered: 0, provider: [] as Array<{ messages: Array<{ content: unknown }> }>, fetches: 0,
  budgetResponse: undefined as Response | undefined, onMeter: undefined as (() => void) | undefined, onProvider: undefined as (() => void) | undefined,
};
Object.assign(globalThis, { __reportCountryProbe: probe });
const moduleUrl = (source: string) => 'data:text/javascript,' + encodeURIComponent(source);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@anthropic-ai/sdk') return { shortCircuit: true, url: moduleUrl('export default class Anthropic {}') };
    if (specifier === '@/lib/api-auth' || (specifier === './api-auth' && context.parentURL?.endsWith('/lib/report-country-policy.ts'))) {
      return { shortCircuit: true, url: moduleUrl(`export async function guardPaidApiRequest() { return globalThis.__reportCountryProbe.auth; }
        export function declaresSampleMode(req) { return req.headers.get('x-imbewu-sample') === '1'; }`) };
    }
    if (specifier === '@/lib/metered-ai') return { shortCircuit: true, url: moduleUrl(`
      export const AI_MODELS = { main: 'test-model' };
      export async function meteredAi() {
        const p = globalThis.__reportCountryProbe; p.metered++; p.onMeter?.();
        if (p.budgetResponse) return { response: p.budgetResponse };
        return { ai: { model: value => value, messages: { create: async input => {
          p.provider.push(input); p.onProvider?.(); return { usage: {}, stop_reason: 'end_turn', content: [{ type: 'text', text: '## Controlled draft\\nFixture response only.' }] };
        } } } };
      }`) };
    if (context.parentURL?.endsWith('/lib/report-country-policy.ts')) {
      if (specifier === 'firebase-admin/app') return { shortCircuit: true, url: moduleUrl('export const getApps=()=>[{}]; export const getApp=()=>({}); export const initializeApp=()=>({});') };
      if (specifier === 'firebase-admin/firestore') return { shortCircuit: true, url: moduleUrl(`
        export const getFirestore = () => ({ collection(name) {
          if (name !== 'user_map_data') throw Error('Unexpected collection');
          return { doc(uid) { return { collection(child) {
            if (child !== 'data') throw Error('Unexpected account path');
            return { doc(id) {
              if (id !== 'places') throw Error('Unexpected resource');
              return { async get() {
                const p=globalThis.__reportCountryProbe; p.reads.push(uid);
                if (p.failRead) throw Error('Fixture transport unavailable');
                return { exists:p.places.has(uid), data:()=>({places:p.places.get(uid)}) };
              } };
            } };
          } }; } };
        } });`) };
    }
    return nextResolve(specifier, context);
  },
});
const { POST } = await import('../app/api/generate-report/route.ts');
const { resolveReportCountryPolicy } = await import('../lib/report-country-policy.ts');
test.after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__reportCountryProbe'); });

const savedPlace = (countryCode?: string, id = 'own-saved-site') => {
  const place = { id, lat: DEMO_COORDS.lat, lon: DEMO_COORDS.lon, savedAt: '2026-11-01T12:00:00.000Z', updatedAt: 100 };
  return { ...place, ...(countryCode ? { siteCountryContext: bindSiteContext(createSiteCountryContext({ siteId: demoId, countryCode, confirmed: true }, '2026-11-02T12:00:00.000Z')!, place)! } : {}) };
};
const body = (patch: Record<string, unknown> = {}) => ({ locationData: structuredClone(DEMO_LOCATION), sections: ['Executive Summary'], ...patch });
const request = (payload: unknown, sample = false) => new Request('http://localhost/api/generate-report', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(sample ? { 'x-imbewu-sample': '1' } : {}) }, body: JSON.stringify(payload),
});
let originalFetch: typeof fetch;
test.beforeEach(() => {
  probe.auth = { uid, guest: undefined, response: undefined }; probe.places.clear(); probe.reads.length = 0;
  probe.failRead = false; probe.metered = 0; probe.provider.length = 0; probe.fetches = 0; probe.budgetResponse = undefined; probe.onMeter = undefined; probe.onProvider = undefined;
  originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { probe.fetches++; return new Response('{}'); };
});
test.afterEach(() => { globalThis.fetch = originalFetch; });

test('unknown, foreign and conflicting sites cannot consume allowance or reach report providers or geocoding', async () => {
  for (const rows of [[], [savedPlace()], ...['KE', 'GB', 'US', 'BR'].map(code => [savedPlace(code)]), [savedPlace('ZA'), savedPlace('KE', 'alias')]]) {
    probe.places.set(uid, rows);
    const response = await POST(request(body({ countryCode: 'ZA', localAgronomyApproved: true,
      siteFacts: { countryCode: 'ZA', productionPlanSupported: true } })) as never);
    assert.equal(response.status, 422); assert.equal(probe.metered, 0); assert.equal(probe.provider.length, 0); assert.equal(probe.fetches, 0);
    assert.equal((await response.json()).code, 'REPORT_COUNTRY_UNAVAILABLE');
  }
});

test('only the authenticated owner saved-site document can supply the country context', async () => {
  probe.places.set('report-owner-b', [savedPlace('ZA')]);
  const response = await POST(request(body({ ownerUid: 'report-owner-b', userId: 'report-owner-b' })) as never);
  assert.equal(response.status, 422); assert.deepEqual(probe.reads, [uid]); assert.equal(probe.metered, 0);
  probe.places.set(uid, [savedPlace('ZA')]); probe.reads.length = 0;
  const supported = await POST(request(body()) as never);
  assert.equal(supported.status, 200); assert.equal(supported.headers.get('X-Report-Mode'), 'confirmed-south-african-site');
  assert.ok(probe.reads.length >= 3, 'admission, pre-provider and final output each recheck the current account source');
  assert.ok(probe.reads.every(owner => owner === uid)); assert.equal(probe.metered, 1); assert.equal(probe.provider.length, 1);
});

test('transient or stale country confirmation cannot authorize a report for the saved farm', async () => {
  const bound = savedPlace('ZA');
  const transient = { ...bound, siteCountryContext: createSiteCountryContext({ siteId: demoId, countryCode: 'ZA', confirmed: true }) };
  for (const place of [transient, { ...bound, updatedAt: bound.updatedAt + 1 }, { ...bound, lat: bound.lat + 1 }]) {
    probe.places.set(uid, [place]);
    const response = await POST(request(body()) as never);
    assert.equal(response.status, 422); assert.equal((await response.json()).code, 'REPORT_COUNTRY_UNAVAILABLE');
    assert.equal(probe.metered, 0); assert.equal(probe.provider.length, 0); assert.equal(probe.fetches, 0);
  }
});

test('mismatched or malformed raw snapshot identities are rejected before normalisation can discard them', async () => {
  probe.places.set(uid, [savedPlace('ZA')]);
  for (const snapshot of [{ siteId: 'site:1.00000,1.00000' }, { siteId: 'site:0,0' }, { plantings: [] }, 'not-a-snapshot']) {
    const response = await POST(request(body({ siteFacts: { crop: { snapshot } } })) as never);
    assert.equal(response.status, 422); assert.equal((await response.json()).code, 'REPORT_SITE_MISMATCH');
  }
  assert.equal(probe.reads.length, 0); assert.equal(probe.metered, 0); assert.equal(probe.provider.length, 0); assert.equal(probe.fetches, 0);
});

test('unavailable country storage does not pretend that an empty farm or supported fallback was found', async () => {
  probe.failRead = true;
  const response = await POST(request(body()) as never);
  assert.equal(response.status, 503); assert.equal((await response.json()).code, 'REPORT_COUNTRY_SOURCE_UNAVAILABLE');
  assert.equal(probe.metered, 0); assert.equal(probe.provider.length, 0); assert.equal(probe.fetches, 0);
});

test('the existing admitted guest demo uses the exact server-owned profile and clears request farm data', async () => {
  probe.auth = { uid: null, guest: true, response: undefined };
  const location = structuredClone(DEMO_LOCATION); location.biome.description = 'PRIVATE_REQUEST_SENTINEL'; location.rainfall.monthly = []; location.rainfall.annual = 0;
  const response = await POST(request(body({ locationData: location,
    photoAnalysis: 'PRIVATE_REQUEST_SENTINEL', surveyData: { notes: 'PRIVATE_REQUEST_SENTINEL' },
    evidenceData: { private: { count: 1, notes: ['PRIVATE_REQUEST_SENTINEL'] } },
    siteFacts: { farmName: 'PRIVATE_REQUEST_SENTINEL', crop: { snapshot: { siteId: demoId } } },
  }), true) as never);
  assert.equal(response.status, 200); assert.equal(response.headers.get('X-Report-Mode'), 'demo-south-african-reference');
  const text = await response.text(); assert.match(text, /^# DEMO — South African reference example/);
  assert.doesNotMatch(text, /PRIVATE_REQUEST_SENTINEL/);
  assert.equal(probe.reads.length, 0); assert.equal(probe.metered, 1); assert.equal(probe.provider.length, 1);
  const prompt = JSON.stringify(probe.provider); assert.doesNotMatch(prompt, /PRIVATE_REQUEST_SENTINEL/);
  // The evidence formatter now includes provenance and preserves the monthly
  // values instead of rounding them. Every value must still be server-owned.
  assert.ok(prompt.includes(`Annual rainfall: ${DEMO_LOCATION.rainfall.annual} mm (${DEMO_LOCATION.rainfall.rainfallSource})`));
  assert.ok(prompt.includes(`Monthly rainfall (January–December): ${DEMO_LOCATION.rainfall.monthly.join(', ')} mm`));
});

test('a sample flag never grants general country support or replaces a different demo site with this profile', async () => {
  probe.auth = { uid: null, guest: true, response: undefined };
  const otherLocation = { ...DEMO_LOCATION, lat: 0, lon: 0 };
  assert.equal((await POST(request(body({ locationData: otherLocation }), true) as never)).status, 422);
  assert.equal((await POST(request(body(), false) as never)).status, 422);
  probe.auth = { uid, guest: undefined, response: undefined };
  assert.equal((await POST(request(body(), true) as never)).status, 422);
  assert.equal(probe.metered, 0); assert.equal(probe.provider.length, 0); assert.equal(probe.fetches, 0);
});

test('auth, required-body validation and the existing budget refusal still keep their own responses', async () => {
  probe.auth.response = new Response('auth refusal', { status: 401 });
  assert.equal((await POST(request('not an object') as never)).status, 401); assert.equal(probe.reads.length, 0);
  probe.auth.response = undefined;
  assert.equal((await POST(request(null) as never)).status, 400);
  assert.equal((await POST(request([]) as never)).status, 400);
  assert.equal((await POST(request(body({ locationData: {} })) as never)).status, 400);
  assert.equal((await POST(request(body({ sections: ['unknown'] })) as never)).status, 400);
  assert.equal(probe.metered, 0); assert.equal(probe.reads.length, 0);
  probe.places.set(uid, [savedPlace('ZA')]); probe.budgetResponse = new Response('budget refusal', { status: 429 });
  const response = await POST(request(body()) as never);
  assert.equal(response.status, 429); assert.equal(await response.text(), 'budget refusal'); assert.equal(probe.provider.length, 0); assert.equal(probe.fetches, 0);
});

test('the pure prompt defaults to saved records and cannot request unreviewed inherited calendars or annual forecasts', () => {
  const facts: ReportSiteFacts = { crop: { plantingCount: 1, bedsPlanted: 1, crops: [{ name: 'Recorded crop identity', sowMonths: ['Nov'], bedLabels: ['Saved bed'], alreadyGrowing: false, firstSeasonOnlyMonths: [] }],
    snapshot: { siteId: demoId, capturedAt: '2026-11-02T12:00:00.000Z', planUpdatedAt: 1, beds: [], plantings: [], outlines: [], annualProduction: { months: ['Nov'], rows: [{ id: 'example-record', name: 'ANNUAL_FORECAST_SENTINEL', product: 'recorded', kind: 'food-forest', months: [0], note: 'planning estimate', reference: true }] } } } };
  const before = JSON.stringify(facts); const raw = cropPlanPromptBlock(facts);
  assert.match(raw, /Recorded crop identity/); assert.match(raw, /local planning guidance is unavailable/);
  assert.doesNotMatch(raw, /ANNUAL_FORECAST_SENTINEL|Build the Planting Calendar|WHOLE-YEAR FOOD/);
  assert.match(cropPlanPromptBlock(facts, true), /ANNUAL_FORECAST_SENTINEL/);
  assert.match(cropPlanPromptBlock(facts, true), /Build the Planting Calendar/); assert.equal(JSON.stringify(facts), before);
});

test('a malformed cloud payload is unavailable rather than an invented supported context', async () => {
  const decision = await resolveReportCountryPolicy(request(body()), { uid }, DEMO_LOCATION, null, async () => ({ countryCode: 'ZA' }));
  assert.equal(decision.allowed, false); if (!decision.allowed) assert.equal(decision.status, 503);
});


test('a country correction after admission stops the next paid batch', async () => {
  probe.places.set(uid, [savedPlace('ZA')]);
  probe.onMeter = () => { probe.places.set(uid, [savedPlace('KE')]); };
  const response = await POST(request(body()) as never);
  assert.equal(response.status, 409); assert.equal((await response.json()).code, 'REPORT_CONTEXT_CHANGED');
  assert.equal(probe.metered, 1); assert.equal(probe.provider.length, 0);
});

test('a country correction during an admitted provider call withholds its draft without claiming a refund', async () => {
  probe.places.set(uid, [savedPlace('ZA')]);
  probe.onProvider = () => { probe.places.set(uid, [savedPlace('KE')]); };
  const response = await POST(request(body()) as never);
  assert.equal(response.status, 409); const result = await response.json();
  assert.equal(result.code, 'REPORT_CONTEXT_CHANGED'); assert.match(result.error, /may already have used allowance/);
  assert.doesNotMatch(result.error, /refunded|no charge/i); assert.equal(probe.provider.length, 1);
});
