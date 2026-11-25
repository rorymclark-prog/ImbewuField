import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildDwdKlObservationHtml } from '../lib/international/dwd-kl-observation-report.ts';
import { extractDwdKlRecentProduct, loadDwdKlRecentObservations } from '../lib/international/providers/dwd-kl-http.ts';
import {
  DWD_KL_STATIONS, dwdKlArchiveUrl, dwdKlRequestableDays, parseDwdKlRecentObservations, type DwdKlRecentProduct,
} from '../lib/international/providers/dwd-kl-observations.ts';

// Deutscher Wetterdienst (DWD CDC), Daily station observations for Germany, KL v24.3.
// Berlin-Tempelhof recent archive, accessed 19 November 2026. CC BY 4.0.
// https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/recent/tageswerte_KL_00433_akt.zip
const archive = readFileSync(new URL('./fixtures/dwd-berlin-tempelhof-00433-recent.zip', import.meta.url));
assert.equal(createHash('sha256').update(archive).digest('hex'), '9d3004fe42ef3fd05f10975ae27714e0621cbe31a45a59f047a5f91a181831ec');
const retrievedAt = '2026-11-19T20:12:32.616Z';
const fixture = await extractDwdKlRecentProduct(archive, retrievedAt, new AbortController().signal, '00433');
assert.ok(fixture, 'the bounded archive reader accepts the exact DWD file');
const product = fixture;

const window = { stationId: '00433', firstDay: '2026-02-10', lastDay: '2026-02-14' };

function withRow(day: string, change: (parts: string[]) => string | null, source = product): DwdKlRecentProduct {
  let changed = false;
  const observations = source.observations.split(/\r?\n/).flatMap(line => {
    const parts = line.split(';');
    if (parts[1] !== day) return [line];
    changed = true;
    const result = change(parts);
    return result === null ? [] : [result];
  }).join('\n');
  assert.ok(changed);
  return { ...source, observations };
}

test('the admitted original recent archive retains real zeros, heights, dates, source identity and quality', () => {
  const result = parseDwdKlRecentObservations(product, window);
  assert.equal(result.status, 'available');
  assert.deepEqual(result.station, { id: '00433', name: 'Berlin-Tempelhof' });
  assert.equal(result.source.series, 'recent-preliminary');
  assert.equal(result.source.firstArchiveDay, '2025-05-18');
  assert.equal(result.source.lastArchiveDay, '2026-11-18');
  assert.equal(result.returnedDays, 5);
  assert.deepEqual(result.days[0], {
    kind: 'returned', day: '2026-02-10', airMinimum: 0, airMean: 1.5, airMaximum: 4,
    nearGroundMinimum: -0.3, precipitationMm: 0, qn3: 10, qn4: 9,
  });
  assert.equal(result.days[3].kind, 'returned');
  assert.equal(result.days[3].nearGroundMinimum, 0);
  assert.equal(result.days[4].kind, 'returned');
  assert.equal(result.days[4].airMean, 0);
});

// Original DWD recent archives retrieved 25 November 2026, CC BY 4.0.
const batchFixtures = {
  '01048': ['04828b635ebc6ec92cc9b5206075409f8ac3b8ae4cc786caeefc68f884dc45af', [-0.7, 0.6, 1.9, -1.9]],
  '01975': ['1b8c8b9983dde58a785fd01f7194314474ec07e02eba08f3dfa6dfe5e44daafc', [-3.3, 0.1, 4.1, -6.3]],
  '02667': ['d275e841639c998e119c60b2074e4326042ea3b71d43a4da1d58625f07ca5120', [-2.5, -1.6, -0.4, -2.3]],
  '03379': ['3080d28224ecb447c51bf07b5b411c1c9d073ced46958f61a4ca7635068613e8', [-2.9, 0.4, 2.9, -4.4]],
  '03987': ['286be5f63efa98114115cb34a61698cd9e2983ff5badd22653df15d91dea0872', [-1.6, 0.6, 3.5, -3.8]],
} as const;

for (const station of DWD_KL_STATIONS) {
  if (station.id === '00433') continue;
  test(`the original ${station.name} archive uses the admitted measurement rules`, async ({ mock }) => {
    const [checksum, readings] = batchFixtures[station.id];
    const bytes = readFileSync(new URL(`./fixtures/dwd-${station.id}-recent.zip`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), checksum);
    const sourceUrl = dwdKlArchiveUrl(station.id);
    const selection = { stationId: station.id, firstDay: '2025-11-23', lastDay: '2026-11-23' };
    const now = new Date('2026-11-25T09:00:00.000Z');
    const signal = new AbortController().signal;
    const makeResponse = (body: Uint8Array, url: string) => Object.defineProperty(
      new Response(Uint8Array.from(body), { headers: { 'content-type': 'application/zip' } }),
      'url', { value: url },
    );
    const responses = [
      makeResponse(bytes, sourceUrl),
      makeResponse(bytes, dwdKlArchiveUrl('00433')),
      makeResponse(archive, sourceUrl),
    ];
    mock.method(globalThis, 'fetch', async (input: RequestInfo | URL) => {
      assert.equal(input, sourceUrl);
      assert.equal(new URL(sourceUrl).hostname, 'opendata.dwd.de');
      assert.ok(sourceUrl.endsWith(`/tageswerte_KL_${station.id}_akt.zip`));
      return responses.shift()!;
    });
    const result = await loadDwdKlRecentObservations(selection, signal, now);
    assert.equal(result.status, 'available');
    assert.deepEqual(result.station, station);
    assert.equal(result.source.url, sourceUrl);
    assert.equal(result.source.firstArchiveDay, '2025-05-23');
    assert.equal(result.source.lastArchiveDay, '2026-11-23');
    assert.equal(result.returnedDays, 366);
    const [airMinimum, airMean, airMaximum, nearGroundMinimum] = readings;
    assert.deepEqual(result.days.at(-1), {
      kind: 'returned', day: '2026-11-23', airMinimum, airMean, airMaximum, nearGroundMinimum,
      precipitationMm: 0, qn3: 1, qn4: 1,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.deepEqual(await loadDwdKlRecentObservations(selection, signal, now),
        { status: 'held', reason: 'invalid-archive' });
    }
  });
}

test('the near-ground minimum remains independent of the air minimum', () => {
  for (const [day, air, nearGround] of [['2026-04-07', 2.2, -5], ['2026-01-13', -0.8, -0.2]] as const) {
    const result = parseDwdKlRecentObservations(product, { ...window, firstDay: day, lastDay: day });
    assert.equal(result.status, 'available');
    assert.equal(result.days[0].kind, 'returned');
    assert.deepEqual([result.days[0].airMinimum, result.days[0].nearGroundMinimum], [air, nearGround]);
  }
});

test('a recent formal-control row cannot be presented as the historical QC archive', () => {
  const selection = { ...window, firstDay: '2026-11-15', lastDay: '2026-11-15' };
  const result = parseDwdKlRecentObservations(product, selection);
  assert.equal(result.status, 'available');
  assert.equal(result.source.series, 'recent-preliminary');
  assert.equal(result.days[0].kind, 'returned');
  assert.deepEqual([result.days[0].qn3, result.days[0].qn4], [1, 1]);
  assert.deepEqual(parseDwdKlRecentObservations({
    ...product, archiveName: 'tageswerte_KL_00433_19480101_20251231_hist.zip',
  }, selection), { status: 'held', reason: 'source-mismatch' });
});

test('contradictory air extrema, mixed stations and duplicate provider days are withheld', () => {
  const inverted = withRow('20260210', parts => { parts[16] = '8.0'; return parts.join(';'); });
  const mixed = withRow('20260210', parts => { parts[0] = '1001'; return parts.join(';'); });
  const duplicate = withRow('20260210', parts => [parts.join(';'), parts.join(';')].join('\n'));
  assert.deepEqual(parseDwdKlRecentObservations(inverted, window), { status: 'held', reason: 'invalid-day' });
  assert.deepEqual(parseDwdKlRecentObservations(mixed, window), { status: 'held', reason: 'wrong-station' });
  assert.deepEqual(parseDwdKlRecentObservations(duplicate, window), { status: 'held', reason: 'duplicate-day' });
});

test('a missing day and a reported missing reading retain different meanings', () => {
  const gap = withRow('20260211', () => null);
  const partial = withRow('20260210', parts => { parts[13] = '-999.0'; return parts.join(';'); }, gap);
  const result = parseDwdKlRecentObservations(partial, window);
  assert.equal(result.status, 'available');
  assert.equal(result.returnedDays, 4);
  assert.equal(result.days[0].kind, 'returned');
  assert.equal(result.days[0].airMean, null);
  assert.equal(result.days[0].airMinimum, 0);
  assert.deepEqual(result.days[1], { kind: 'no-record', day: '2026-02-11' });
  const html = buildDwdKlObservationHtml(result);
  assert.match(html, /2026-02-10.*0\.0 °C.*Missing reading/);
  assert.match(html, /2026-02-11.*No station record/);
});

test('missing sensor coverage, changed units, MEZ labels and mismatched geography hold the reading', () => {
  const changes = [
    ['minimum', product.metadata.minimum.replace(';47.74;2;20220913;', ';47.74;2.2;20220913;')],
    ['parameters', product.metadata.parameters.replaceAll(';°C;', ';°F;')],
    ['parameters', product.metadata.parameters.replaceAll('00:00 - 24:00 UTC', '00:00 - 24:00 MEZ')],
    ['geography', product.metadata.geography.replace(/433;/g, '1001;')],
  ] as const;
  for (const [key, text] of changes) {
    assert.notEqual(text, product.metadata[key]);
    assert.deepEqual(parseDwdKlRecentObservations({
      ...product, metadata: { ...product.metadata, [key]: text },
    }, window), { status: 'held', reason: 'metadata-mismatch' });
  }
});

test('selection is bounded to whole past UTC dates and the admitted stations', () => {
  assert.deepEqual(dwdKlRequestableDays(new Date(product.retrievedAt)), { firstDay: '2025-07-07', lastDay: '2026-11-18' });
  for (const stationId of ['433', ' 00433', '00433\n']) {
    assert.deepEqual(parseDwdKlRecentObservations(product, { ...window, stationId }), { status: 'held', reason: 'invalid-selection' });
  }
  for (const stationId of ['00106', '01001']) {
    assert.deepEqual(parseDwdKlRecentObservations(product, { ...window, stationId }), { status: 'held', reason: 'station-not-admitted' });
  }
  for (const selection of [{ ...window, firstDay: '2025-10-01', lastDay: '2026-11-01' },
    { ...window, firstDay: '2025-07-06', lastDay: '2025-07-06' }, { ...window, lastDay: '2026-11-19' }]) {
    assert.deepEqual(parseDwdKlRecentObservations(product, selection), { status: 'held', reason: 'invalid-selection' });
  }
});

function archiveResponse(body: BodyInit, mime = 'application/zip') {
  const response = new Response(body, { headers: { 'content-type': mime } });
  return Object.defineProperty(response, 'url', { value: dwdKlArchiveUrl('00433') });
}

test('the public loader reads only the fixed ZIP and produces a report from original data', async ({ mock }) => {
  const request = mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(input, dwdKlArchiveUrl('00433'));
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.referrerPolicy, 'no-referrer');
    return archiveResponse(Uint8Array.from(archive));
  });
  const load = (selection = window) => loadDwdKlRecentObservations(selection, new AbortController().signal, new Date(retrievedAt));
  assert.deepEqual(await load({ ...window, stationId: '00106' }), { status: 'held', reason: 'station-not-admitted' });
  assert.equal(request.mock.callCount(), 0);
  const result = await load();
  assert.equal(request.mock.callCount(), 1);
  assert.equal(result.status, 'available');
  const html = buildDwdKlObservationHtml(result);
  assert.match(html, /Berlin-Tempelhof · DWD station 00433/);
  assert.match(html, /2026-02-10.*0\.0 °C.*-0\.3 °C.*0\.0 mm/);
  assert.match(html, /DWD quality control is incomplete/);
  assert.match(html, /prod.*00433\.txt/);
});

test('the loader withholds untrusted MIME, oversized bodies, corrupt archives and cancelled reads', async ({ mock }) => {
  const responses = [
    archiveResponse(Uint8Array.from(archive), 'text/html'),
    archiveResponse(new Uint8Array(256 * 1024 + 1)),
    archiveResponse(Uint8Array.of(0x50, 0x4b, 0x03, 0x04)),
  ];
  const request = mock.method(globalThis, 'fetch', async () => responses.shift()!);
  const now = new Date(retrievedAt);
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(await loadDwdKlRecentObservations(window, new AbortController().signal, now), {
      status: 'held', reason: 'invalid-archive',
    });
  }
  const cancelled = new AbortController();
  cancelled.abort();
  assert.deepEqual(await loadDwdKlRecentObservations(window, cancelled.signal, now), { status: 'held', reason: 'unavailable' });
  assert.equal(request.mock.callCount(), 3);
});
