import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildEcccObservationHtml } from '../lib/international/eccc-observation-report.ts';
import { loadEcccDailyObservations } from '../lib/international/providers/eccc-daily-http.ts';
import {
  ecccDailyObservationUrl, ecccLatestRequestableDay, parseEcccDailyObservations, type EcccDailySelection, type EcccDailySource,
} from '../lib/international/providers/eccc-daily-observations.ts';

const leapWindow = { stationClimateId: '4057165', firstLocalDay: '2020-02-28', lastLocalDay: '2020-03-01' };
const retrievedAt = '2026-11-19T18:00:00.000Z';

function sourceFor(selection: EcccDailySelection): EcccDailySource {
  return { url: ecccDailyObservationUrl(selection)!, retrievedAt, temperatureUnit: 'celsius' };
}

function feature(day: string, fields: Record<string, unknown> = {}) {
  const [year, month, date] = day.split('-').map(Number);
  return {
    type: 'Feature',
    properties: {
      CLIMATE_IDENTIFIER: '4057165', STN_ID: 47707, STATION_NAME: 'SASKATOON RCS', PROVINCE_CODE: 'SK',
      LOCAL_DATE: `${day} 00:00:00`, LOCAL_YEAR: year, LOCAL_MONTH: month, LOCAL_DAY: date,
      MIN_TEMPERATURE: -4, MIN_TEMPERATURE_FLAG: null,
      MEAN_TEMPERATURE: -2, MEAN_TEMPERATURE_FLAG: null,
      MAX_TEMPERATURE: 0, MAX_TEMPERATURE_FLAG: null,
      ...fields,
    },
  };
}

function response(features: ReturnType<typeof feature>[], overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: 'FeatureCollection', numberMatched: features.length, numberReturned: features.length, features,
    links: [{ rel: 'self', href: sourceFor(leapWindow).url }], ...overrides,
  });
}

const read = (features: ReturnType<typeof feature>[]) =>
  parseEcccDailyObservations(response(features), leapWindow, sourceFor(leapWindow));

test('ECCC fixture matches seven local calendar days and their reported temperatures', () => {
  // Data Source: Environment and Climate Change Canada. Redistributed under
  // https://eccc-msc.github.io/open-data/licence/readme_en/. Original GeoMet daily
  // response accessed on 19 November 2026, SHA-256 c50b5bd324bf21070e6f49e8bc1b4a43db5312595b66ec453a372ac9b49a39fa.
  const raw = readFileSync(new URL('./fixtures/eccc-saskatoon-rcs-2018-october-week.geojson', import.meta.url), 'utf8');
  const selection = { stationClimateId: '4057165', firstLocalDay: '2018-10-01', lastLocalDay: '2018-10-07' };
  const result = parseEcccDailyObservations(raw, selection, {
    ...sourceFor(selection), url: JSON.parse(raw).links[0].href,
  });
  assert.equal(result.status, 'available');
  assert.deepEqual([result.requestedDays, result.returnedDays, result.fullyObservedDays], [7, 7, 7]);
  assert.deepEqual(result.station, { id: 47707, name: 'SASKATOON RCS', province: 'SK' });
  assert.deepEqual(result.days[0], {
    kind: 'returned', localDay: '2018-10-01', minimum: { kind: 'observed', celsius: -0.8 },
    mean: { kind: 'observed', celsius: 0.8 }, maximum: { kind: 'observed', celsius: 2.4 },
  });
  assert.equal(result.days[6].localDay, '2018-10-07');
});

test('a leap-day gap, missing cell, flagged estimate and genuine zero stay distinct', () => {
  const result = read([
    feature('2020-03-01', {
      MIN_TEMPERATURE: null, MIN_TEMPERATURE_FLAG: 'M', MEAN_TEMPERATURE: null,
      MAX_TEMPERATURE: 2, MAX_TEMPERATURE_FLAG: 'E',
    }),
    feature('2020-02-28'),
  ]);
  assert.equal(result.status, 'available');
  assert.deepEqual([result.requestedDays, result.returnedDays, result.fullyObservedDays], [3, 2, 1]);
  assert.deepEqual(result.days, [{
    kind: 'returned', localDay: '2020-02-28', minimum: { kind: 'observed', celsius: -4 },
    mean: { kind: 'observed', celsius: -2 }, maximum: { kind: 'observed', celsius: 0 },
  }, {
    kind: 'no-record', localDay: '2020-02-29',
  }, {
    kind: 'returned', localDay: '2020-03-01', minimum: { kind: 'missing', flag: 'M' },
    mean: { kind: 'missing', flag: null }, maximum: { kind: 'estimated', celsius: 2, flag: 'E' },
  }]);
});

test('empty covered query reports gaps, and a missing-flag value cannot become observed zero', () => {
  const empty = read([]);
  assert.equal(empty.status, 'available');
  assert.equal(empty.station, null);
  assert.equal(empty.returnedDays, 0);
  assert.deepEqual(empty.days.map(day => day.kind), ['no-record', 'no-record', 'no-record']);
  const flagged = read([feature('2020-02-28', { MAX_TEMPERATURE: 0, MAX_TEMPERATURE_FLAG: 'M', MEAN_TEMPERATURE_FLAG: 'P' })]);
  assert.equal(flagged.status, 'available');
  assert.deepEqual(flagged.days[0], {
    kind: 'returned', localDay: '2020-02-28', minimum: { kind: 'observed', celsius: -4 },
    mean: { kind: 'withheld-flag', flag: 'P' }, maximum: { kind: 'missing', flag: 'M' },
  });
  assert.equal(flagged.fullyObservedDays, 0);
});

test('matching station names cannot combine two climate IDs or distinct station segments', () => {
  const day = feature('2020-02-28');
  assert.deepEqual(read([day, feature('2020-02-29', { CLIMATE_IDENTIFIER: '4057152' })]), { status: 'held', reason: 'wrong-station' });
  assert.deepEqual(read([day, feature('2020-02-29', { STN_ID: 99999 })]), { status: 'held', reason: 'segment-conflict' });
});

test('identical duplicate observations count once and any changed value or flag holds the series', () => {
  const day = feature('2020-02-29');
  const identical = read([day, day]);
  assert.equal(identical.status, 'available');
  assert.equal(identical.returnedDays, 1);
  for (const change of [{ MEAN_TEMPERATURE: -1 }, { MAX_TEMPERATURE_FLAG: 'E' }]) {
    assert.deepEqual(read([day, feature('2020-02-29', change)]), { status: 'held', reason: 'duplicate-conflict' });
  }
});

test('out-of-window, malformed, mismatched or instant date labels fail before a daily result appears', () => {
  const dates = [
    feature('2020-03-02'), feature('2020-02-30'),
    feature('2020-02-29', { LOCAL_DAY: 28 }),
    feature('2020-02-29', { LOCAL_DATE: '2020-02-29T00:00:00Z' }),
  ];
  for (const day of dates) assert.deepEqual(read([day]), { status: 'held', reason: 'invalid-day' });
});

test('malformed numeric fields and contradictory unflagged ranges do not get coerced into temperature readings', () => {
  for (const fields of [{ MAX_TEMPERATURE: '' }, { MIN_TEMPERATURE: 1 }, { MEAN_TEMPERATURE: 1 }, { MAX_TEMPERATURE_FLAG: null, MAX_TEMPERATURE: false }]) {
    assert.deepEqual(read([feature('2020-02-29', fields)]), { status: 'held', reason: 'invalid-day' });
  }
});

test('explicit unit, source, query window and collection identity are required', () => {
  const body = response([feature('2020-02-29')]);
  const source = sourceFor(leapWindow);
  const wrong = [
    { ...source, temperatureUnit: 'fahrenheit' },
    { ...source, url: source.url.replace('api.weather.gc.ca', 'example.org') },
    { ...source, url: source.url.replace('climate-daily', 'climate-monthly') },
    { ...source, url: source.url.replace('4057165', '4057152') },
    { ...source, retrievedAt: '2020-02-29T22:00:00.000Z' },
    null,
  ];
  for (const inbound of wrong) {
    assert.deepEqual(parseEcccDailyObservations(body, leapWindow, inbound), { status: 'held', reason: 'source-mismatch' });
  }
  assert.deepEqual(parseEcccDailyObservations(response([], { links: [] }), leapWindow, source), { status: 'held', reason: 'source-mismatch' });
});

test('incomplete or unreasonably large responses never masquerade as missing observations', () => {
  const source = sourceFor(leapWindow);
  const day = feature('2020-02-29');
  const paginated = [{ rel: 'self', href: source.url }, { rel: 'next', href: source.url }];
  for (const options of [{ numberMatched: 7 }, { numberReturned: 0 }, { links: paginated }]) {
    assert.deepEqual(parseEcccDailyObservations(response([day], options), leapWindow, source), { status: 'held', reason: 'incomplete-response' });
  }
  for (const body of ['[', 'x'.repeat(1_048_577)]) {
    assert.deepEqual(parseEcccDailyObservations(body, leapWindow, source), { status: 'held', reason: 'invalid-response' });
  }
});

test('the Canadian date cap prevents a future local-day request near UTC midnight', async t => {
  const before = new Date('2026-11-20T07:59:59.999Z');
  const after = new Date('2026-11-20T08:00:00.000Z');
  assert.equal(ecccLatestRequestableDay(before), '2026-11-19');
  assert.equal(ecccLatestRequestableDay(after), '2026-11-20');
  t.mock.timers.enable({ apis: ['Date'], now: before });
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected station request'); });
  const selection = { ...leapWindow, firstLocalDay: '2026-11-20', lastLocalDay: '2026-11-20' };
  assert.deepEqual(await loadEcccDailyObservations(selection, new AbortController().signal),
    { status: 'held', reason: 'invalid-selection' });
  assert.equal(fetch.mock.callCount(), 0);
});

test('the standalone station report restricts active content and suppresses link referrers', () => {
  const result = read([feature('2020-02-28')]);
  assert.equal(result.status, 'available');
  const report = buildEcccObservationHtml(result);
  assert.ok(report.includes("<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'\">"));
  assert.match(report, /rel="noreferrer">Original station query<\/a>/);
  assert.match(report, /rel="noreferrer">Data licence<\/a>/);
});

test('window building admits a full leap year and holds oversize and malformed choices', () => {
  const leapYear = { ...leapWindow, firstLocalDay: '2020-01-01', lastLocalDay: '2020-12-31' };
  const url = new URL(ecccDailyObservationUrl(leapYear)!);
  assert.equal(url.searchParams.get('limit'), '367');
  assert.equal(url.searchParams.get('datetime'), '2020-01-01T00:00:00Z/2020-12-31T23:59:59Z');
  for (const part of [{ firstLocalDay: '2020-02-30' }, { lastLocalDay: '2021-01-01' }, { stationClimateId: '4057165\n' }]) {
    assert.equal(ecccDailyObservationUrl({ ...leapYear, ...part }), null);
  }
});
