import assert from 'node:assert/strict';
import test from 'node:test';

import { siteClimateFromLocationData, locationDataCacheKey } from '@/lib/site-climate';
import { fetchNasaPower } from '@/lib/nasa-power';
import { monthlyTemperatureStatus } from '@/lib/climate-temperature';

// THE GATE, NOT THE WEATHER. tests/sa-rain-pattern.test.ts proves the Köppen bridge across
// South Africa's climate space; this file proves the planner can only ever reach that bridge
// through data that is genuinely the site's own. The failure mode being guarded: on a NASA
// outage /api/location-data substitutes twelve months of 50 mm and a default climate — if
// that constant were accepted as "per-site" climate, every offline farm in the country would
// silently share one invented pattern, which is the original nearest-city bug wearing a
// better label.

const MKUZE_LAT = -27.726231;

/** LocationData-shaped fixture built from the live NASA POWER reading for the demo farm's
 *  exact coordinates (fetched 2026-08-19 — monthly mm and °C rounded as the API route
 *  rounds them). This is a recorded reading, not an invented normal. */
function mkuzeLocationData() {
  return {
    rainfall: {
      monthly: [129, 100, 85, 49, 18, 14, 16, 19, 39, 70, 112, 119],
      annual: 768,
      pattern: 'summer',
      wetSeason: 'Oct–Mar',
      drySeason: 'May–Aug',
      rainfallSource: 'nasa-power',
    },
    climate: {
      meanTemp: 21.3,
      maxTemp: 30,
      minTemp: 11,
      monthlyTemp: [24.7, 24.7, 23.8, 21.5, 19.4, 17.2, 16.8, 18.5, 20.6, 21.7, 22.9, 24.3],
      solarRadiation: 5.2,
      koppen: 'Cfa',
      koppenDesc: 'Humid subtropical',
    },
  };
}


// This transport fixture exercises the real provider's coverage derivation. It is
// synthetic contract evidence, not a new observation or receipt for the recorded farm.
async function completeProviderLocationData() {
  const recorded = mkuzeLocationData();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const parameter = {
    PRECTOTCORR: Object.fromEntries(months.map((month, i) => [month, recorded.rainfall.monthly[i] / days[i]])),
    T2M: Object.fromEntries(months.map((month, i) => [month, recorded.climate.monthlyTemp[i]])),
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.startsWith('https://archive-api.open-meteo.com/')) return new Response(null, { status: 503 });
    assert.ok(url.startsWith('https://power.larc.nasa.gov/'), 'only the mocked provider endpoints may be used');
    return Response.json({ properties: { parameter } });
  };
  try { return await fetchNasaPower(MKUZE_LAT, 31.963044); }
  finally { globalThis.fetch = originalFetch; }
}

test('the historical recorded farm reading stays unknown without original monthly coverage evidence', () => {
  const recorded = mkuzeLocationData();
  assert.equal(recorded.climate.monthlyTemp.length, 12, 'retain the captured monthly values as historical reference facts');
  assert.equal(monthlyTemperatureStatus(recorded.climate), 'unknown', 'finite historic arrays cannot reconstruct missing provider coverage');
  assert.equal(siteClimateFromLocationData(recorded, MKUZE_LAT), null, 'do not backfill a complete receipt onto an unverified historical capture');
});

test('provider-composed complete monthly evidence resolves the warm-area column, not the hard-frost interior', async () => {
  const data = await completeProviderLocationData();
  assert.equal(monthlyTemperatureStatus(data.climate), 'complete');
  data.climate.koppen = 'Dfb'; // A cached label must not override the monthly pairs.
  const derived = siteClimateFromLocationData(data, MKUZE_LAT);
  assert.ok(derived, 'a real per-site reading must derive');
  assert.equal(derived.pattern, 'mild-frost',
    'frost-free Mkuze lowveld (coldest month 16.8 °C, 80% summer rain) gets KZN DARD’s warm/light-frost windows');
  assert.equal(derived.annualMm, 770, 'annual mm is the sum of the monthly normals, rounded');
  assert.equal(derived.rainfallSource, 'nasa-power');
  // The Köppen code is recomputed from the monthly numbers, not read from the payload.
  assert.equal(derived.koppen, 'Cfa');
});

test('the API route’s NASA-outage fallback is never mistaken for per-site climate', () => {
  // Exactly the substitute /api/location-data returns when fetchNasaPower rejects:
  // flat 50 mm months, default temps — and, critically, NO rainfallSource tag.
  const outageFallback = {
    rainfall: {
      monthly: Array(12).fill(50),
      annual: 600,
      pattern: 'summer',
      wetSeason: 'Oct–Mar',
      drySeason: 'May–Aug',
    },
    climate: {
      meanTemp: 18, maxTemp: 28, minTemp: 8,
      monthlyTemp: Array(12).fill(18),
      solarRadiation: 5.5, koppen: '?', koppenDesc: 'Unknown',
    },
  };
  assert.equal(siteClimateFromLocationData(outageFallback, MKUZE_LAT), null,
    'untagged fallback data must fall through to the labelled nearestRainfall fallback');
});

test('malformed or partial payloads refuse to answer instead of guessing', async () => {
  const good = await completeProviderLocationData();
  assert.ok(siteClimateFromLocationData(good, MKUZE_LAT), 'each damaged case starts from an admitted provider-composed control');
  const cases: Array<[string, unknown]> = [
    ['null', null],
    ['string', 'cached-garbage'],
    ['empty object', {}],
    ['missing climate', { rainfall: good.rainfall }],
    ['missing rainfall', { climate: good.climate }],
    ['eleven months of rain', {
      ...good,
      rainfall: { ...good.rainfall, monthly: good.rainfall.monthly.slice(0, 11) },
    }],
    ['negative rain month', {
      ...good,
      rainfall: { ...good.rainfall, monthly: [-1, ...good.rainfall.monthly.slice(1)] },
    }],
    ['missing monthly coverage', { ...good, climate: { ...good.climate, monthlyTempCoverage: undefined } }],
    ['incomplete monthly coverage with finite display values', { ...good, climate: { ...good.climate, monthlyTempCoverage: { source: 'nasa-power', status: 'incomplete' } } }],
    ['invalid monthly coverage source', { ...good, climate: { ...good.climate, monthlyTempCoverage: { source: 'open-meteo', status: 'complete' } } }],
    ['sentinel temperature under a contradictory complete receipt', { ...good, climate: { ...good.climate, monthlyTemp: [-999, ...good.climate.monthlyTemp.slice(1)] } }],
    ['sparse temperatures under a contradictory complete receipt', { ...good, climate: { ...good.climate, monthlyTemp: Array(12) } }],
    ['eleven temperatures under a contradictory complete receipt', { ...good, climate: { ...good.climate, monthlyTemp: good.climate.monthlyTemp.slice(0, 11) } }],
    ['NaN temperature', {
      ...good,
      climate: { ...good.climate, monthlyTemp: [Number.NaN, ...good.climate.monthlyTemp.slice(1)] },
    }],
    ['unknown rainfallSource', {
      ...good,
      rainfall: { ...good.rainfall, rainfallSource: 'crystal-ball' },
    }],
  ];
  for (const [label, payload] of cases) {
    assert.equal(siteClimateFromLocationData(payload, MKUZE_LAT), null, `${label} must return null`);
  }
  assert.equal(siteClimateFromLocationData(good, Number.NaN), null, 'an unusable latitude must return null');
});

test('open-meteo rainfall keeps its provenance beside provider-complete monthly temperature evidence', async () => {
  const data = await completeProviderLocationData();
  data.rainfall.rainfallSource = 'open-meteo';
  const derived = siteClimateFromLocationData(data, MKUZE_LAT);
  assert.ok(derived);
  assert.equal(derived.rainfallSource, 'open-meteo');
});

test('the cache key matches the app-wide imbewu_loc_v7 format at 5 dp', () => {
  // Format and version are policed app-wide by tests/location-cache-version.test.ts;
  // this pins the 5-dp precision that keeps two nearby sites from colliding.
  assert.equal(locationDataCacheKey(-27.726231, 31.963044), 'imbewu_loc_v7_-27.72623_31.96304');
});
