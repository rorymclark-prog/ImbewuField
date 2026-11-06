import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadUpdateCopy, updateDescription } from '../lib/update-copy.ts';
import { RELEASE_NOTES } from '../lib/release-notes.ts';
import { pvgisFixture, withDeviceClock } from './fixtures/site-energy.ts';
import { normaliseElevationEvidence, normaliseSiteEnergy, normaliseSolarReference, parsePvgisResponse, locationElevationReference, pvgisRequestUrl, siteEnergyPrompt, surveyEnergyInputErrors } from '../lib/site-energy.ts';
import { handleSiteEnergyRequest } from '../lib/site-energy-route.ts';
import { costClassFor } from '../lib/api-rate-limit.ts';
import type { LocationData } from '../lib/types.ts';

const site = 'site:45.00000,8.00000';
const otherSite = 'site:46.00000,8.00000';
const now = '2026-11-05T12:00:00.000Z';
const solar = () => parsePvgisResponse(pvgisFixture(), site, now);

test('PV reference keeps provider units, monthly resource, actual period and explicit assumptions', () => {
  const reference = solar();
  assert.equal(reference.annualKwh, 1200); assert.equal(reference.annualIrradiationKwhM2, 1800);
  assert.equal(reference.months[0].energyKwh, 100); assert.equal(reference.startYear, 2005);
  assert.deepEqual(normaliseSolarReference(JSON.parse(JSON.stringify(reference)), site), reference);
  const context = siteEnergyPrompt(undefined, { solar: reference }, site);
  for (const claim of ['not installed capacity', 'assumed 1 kWp', 'losses 14%', '2005–2023', '0=S, 90=W, -90=E', 'terrain horizon included', 'Nearby shade']) assert.ok(context.includes(claim), claim);
});

test('wrong coordinates, units, missing months and inconsistent annual totals never become estimates', () => {
  const mutations = [
    (f: any) => { f.inputs.location.latitude = 46; },
    (f: any) => { f.meta.outputs.totals.variables.E_y.units = 'Wh/y'; },
    (f: any) => { f.meta.outputs.monthly.variables['H(i)_m'].units = 'MJ/m2/mo'; },
    (f: any) => { f.outputs.monthly.fixed.pop(); },
    (f: any) => { f.outputs.monthly.fixed[0].month = 2; },
    (f: any) => { f.outputs.totals.fixed.E_y = 12000; },
    (f: any) => { f.outputs.monthly.fixed[0].E_m = null; },
    (f: any) => { f.inputs.pv_module.peak_power = 5; },
    (f: any) => { f.inputs.meteo_data.use_horizon = false; },
  ];
  for (const change of mutations) { const f = pvgisFixture(); change(f); assert.throws(() => parsePvgisResponse(f, site, now)); }
  assert.equal(normaliseSolarReference(solar(), otherSite), undefined);
  assert.equal(normaliseSolarReference({ ...solar(), annualKwh: NaN }, site), undefined);
});

test('solar URL fixes the free public provider and declares a reference system instead of a roof size', () => {
  const url = new URL(pvgisRequestUrl(-30, 31));
  assert.equal(url.origin, 'https://re.jrc.ec.europa.eu'); assert.equal(url.pathname, '/api/v5_3/PVcalc');
  assert.equal(url.searchParams.get('optimalangles'), '1'); assert.equal(url.searchParams.get('peakpower'), '1');
  assert.equal(url.searchParams.get('loss'), '14'); assert.equal(url.searchParams.get('lat'), '-30.00000');
  assert.throws(() => pvgisRequestUrl(91, 0)); assert.throws(() => pvgisRequestUrl(NaN, 0));
});

test('manual numeric answers must be corrected instead of silently disappearing at the survey save gate', () => {
  assert.deepEqual(surveyEnergyInputErrors({ benchmarkElevation: '11000', windSpeed: '101', windHeight: '1001' }, 'measured'), {
    benchmarkElevation: 'Enter a benchmark elevation between −12,000 and 10,000 m, or leave it blank.',
    windSpeed: 'Enter a mean wind speed from 0 to 100 m/s, or leave it blank.',
    windHeight: 'Enter a valid measurement height, or select an available atlas height.',
  });
  for (const benchmarkElevation of ['0','-3','']) assert.deepEqual(surveyEnergyInputErrors({ benchmarkElevation, windSpeed: '0', windHeight: '10' }, 'atlas'), {});
  assert.ok(surveyEnergyInputErrors({ benchmarkElevation: '', windSpeed: 'NaN', windHeight: '12' }, 'atlas').windHeight);
  assert.ok(surveyEnergyInputErrors({ benchmarkElevation: '', windSpeed: 'NaN', windHeight: '12' }, 'measured').windSpeed);
});

test('a real sampled zero or below-sea-level benchmark survives without validating legacy fallback zero', () => {
  const location = { lat: 45, lon: 8, elevation: { elevation: 0, sampleBaselineM: 120, directionConfidence: 'unconfirmed' } } as LocationData;
  assert.equal(locationElevationReference(location, site)?.elevationM, 0);
  assert.equal(locationElevationReference({ ...location, elevation: { elevation: 0 } } as LocationData, site), undefined);
  assert.equal(locationElevationReference(location, otherSite), undefined);
  const reference = { model: locationElevationReference(location, site), benchmark: { elevationM: -3, method: 'surveyed', datum: 'local benchmark', source: 'survey sheet', observedOn: '2026-99-99' } };
  const clean = normaliseElevationEvidence(reference, site)!;
  assert.equal(clean.benchmark?.elevationM, -3); assert.equal(clean.benchmark?.observedOn, undefined);
  assert.equal(normaliseElevationEvidence(reference, otherSite)?.model, undefined);
  assert.equal(clean.model?.elevationM, 0); assert.equal(clean.benchmark?.datum, 'local benchmark');
});

test('wind is a source/height/period observation and never annual electricity from a mean speed', () => {
  const evidence = normaliseSiteEnergy({ wind: { kind: 'atlas', meanSpeedMs: 0, heightM: 10, source: 'GWA selected point', period: 'fixture-period', obstacles: 'Trees nearby', exposure: 'sheltered' } }, site)!;
  assert.equal(evidence.wind?.meanSpeedMs, 0);
  const text = siteEnergyPrompt(undefined, evidence, site);
  assert.match(text, /mean 0 m\/s at 10 m above ground/); assert.match(text, /not an on-site measurement/);
  assert.match(text, /Do not infer turbine kWh/); assert.match(text, /Trees nearby/); assert.match(text, /CC BY 4.0/);
  const incomplete = normaliseSiteEnergy({ wind: { ...evidence.wind, heightM: 12, meanSpeedMs: Infinity, period: '' } }, site)!;
  assert.equal(incomplete.wind?.heightM, null); assert.equal(incomplete.wind?.meanSpeedMs, null);
  assert.match(siteEnergyPrompt(undefined, incomplete, site), /Wind reference is incomplete/);
  assert.doesNotMatch(siteEnergyPrompt(undefined, incomplete, site), /Infinity|NaN/);
});

const request = (body: unknown = { siteId: site, lat: 45, lon: 8 }) => new Request('https://example.invalid/api/site-energy', { method: 'POST', body: JSON.stringify(body) });
const allowed = () => ({ verdict: { allowed: true }, budget: { limit: 100, windowMs: 1000 }, costClass: 'data', key: 'uid:test|data' }) as any;
const authenticate = async () => ({ uid: 'actor-a' });

test('solar lookup requires a verified actor even when the legacy auth helper returns a soft guest', async () => {
  let calls = 0;
  const response = await handleSiteEnergyRequest(request(), { authenticate: async () => ({ uid: null, guest: true }), fetch: async () => { calls++; return Response.json(pvgisFixture()); } });
  assert.equal(response.status, 401); assert.equal(calls, 0);
  assert.equal(costClassFor('/api/site-energy'), 'data');
});

test('site-bound response is private and forwards only a fixed-provider coordinate reference', async () => {
  const response = await handleSiteEnergyRequest(request(), { authenticate, rateLimit: allowed, now: () => new Date(now), fetch: async (input, init) => {
    const url = new URL(String(input)); assert.equal(url.origin, 'https://re.jrc.ec.europa.eu');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error'); assert.deepEqual(init?.headers, { Accept: 'application/json' });
    assert.equal(url.searchParams.has('actorId'), false);
    return Response.json(pvgisFixture());
  } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json(); assert.equal(body.actorId, 'actor-a'); assert.equal(body.siteId, site); assert.equal(body.solar.fetchedAt, now);
});

test('unsupported coverage, busy provider and corrupt results return errors without an invented fallback', async () => {
  for (const status of [400, 429, 500]) {
    const response = await handleSiteEnergyRequest(request(), { authenticate, rateLimit: allowed, fetch: async () => new Response('provider detail', { status }) });
    assert.equal(response.status, status === 400 ? 422 : 502); assert.equal((await response.json()).solar, undefined);
  }
  const response = await handleSiteEnergyRequest(request(), { authenticate, rateLimit: allowed, fetch: async () => Response.json({ outputs: {} }) });
  assert.equal(response.status, 502);
});

test('mismatched site and oversized/headerless bodies are rejected before provider access', async () => {
  let calls = 0; const fetcher = async () => { calls++; return Response.json(pvgisFixture()); };
  assert.equal((await handleSiteEnergyRequest(request({ siteId: otherSite, lat: 45, lon: 8 }), { authenticate, rateLimit: allowed, fetch: fetcher })).status, 400);
  assert.equal((await handleSiteEnergyRequest(request({ huge: 'a'.repeat(3000) }), { authenticate, rateLimit: allowed, fetch: fetcher })).status, 413);
  assert.equal(calls, 0);
  const denied = () => ({ ...allowed(), verdict: { allowed: false, retryAfterSeconds: 42 } });
  const limited = await handleSiteEnergyRequest(request(), { authenticate, rateLimit: denied, fetch: fetcher });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '42'); assert.equal(calls, 0);
});


test('energy release draft pairs retain exact source, provisional status and existing locale bytes', async () => {
  const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const hash = (text: string) => createHash('sha256').update(text).digest('hex');
  const dir = 'docs/audits/2026-11-06/site-energy-release-drafts/';
  const packet = JSON.parse(read(dir + 'source.json'));
  const adoption = JSON.parse(read(dir + 'adoption.json'));
  const release = RELEASE_NOTES.find(entry => entry.changes.includes(packet.messages[0].english));
  assert.ok(release, 'the packet remains bound to its own release, not the rolling latest entry');
  const sources = [...release.changes, ...(release.tour ?? []).flatMap(stop => [stop.title, stop.where, stop.detail])];
  assert.deepEqual(packet.messages.map((row: any) => row.english), sources);
  for (const language of packet.locales) {
    const draft = JSON.parse(read(dir + language + '.json'));
    assert.equal(draft.locale, language);
    assert.equal(draft.sourceSha256, hash(read(dir + 'source.json')));
    assert.equal(draft.reviewStatus, 'unreviewed-ai-draft');
    assert.equal(draft.runtimeActivation, false, 'the packet itself never certifies activation or fluent review');
    const copy = await loadUpdateCopy(language);
    assert.equal(draft.messages.length, packet.messages.length);
    for (const [index, row] of draft.messages.entries()) {
      const source = packet.messages[index];
      assert.equal(row.key, source.key); assert.equal(row.english, source.english);
      assert.equal(row.sha256, hash(source.english));
      assert.equal(updateDescription(copy, source.english), row.translation);
      assert.notEqual(row.translation, source.english);
    }
    const dictionary = read('lib/update-copy-locales/' + language + '.ts');
    const inserted = adoption.locales[language].insertedText;
    assert.equal(dictionary.split(inserted).length, 2, 'the reviewed block is added once');
    assert.equal(hash(dictionary.replace(inserted, '')), adoption.locales[language].previousSha256, 'every original dictionary byte remains');
  }
});


test('saved provider climate periods are bounded by retrieval provenance rather than the device clock', () => {
  const reference = solar();
  for (const device of ['2022-06-01T08:00:00.000Z', '2050-06-01T08:00:00.000Z']) {
    withDeviceClock(device, () => {
      assert.deepEqual(normaliseSolarReference(JSON.parse(JSON.stringify(reference)), site), reference);
      assert.equal(normaliseSolarReference({ ...reference, endYear: 2027 }, site), undefined, 'climate data after its2026 retrieval stays invalid even on a future device');
      assert.equal(normaliseSolarReference({ ...reference, fetchedAt: '2022-11-05T12:00:00.000Z' }, site), undefined, 'a2023 period cannot predate its own retrieval');
      assert.equal(normaliseSolarReference({ ...reference, fetchedAt: 'not a date' }, site), undefined);
    });
  }
});
