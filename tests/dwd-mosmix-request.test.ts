import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DWD_MOSMIX_PROVIDER_ID, DWD_MOSMIX_NAMESPACE, DWD_KML_NAMESPACE,
  parseDwdStationRequest, dwdMosmixStationEndpoint, parseDwdMosmixProvenance,
} from '../lib/international/providers/dwd-mosmix-request.ts';

// Synthetic parser inputs only. These numeric IDs demonstrate the supported
// spelling contract, not a station catalogue, location or country assignment.
const stationId = '01234';
const endpoint = 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/01234/kml/MOSMIX_L_LATEST_01234.kmz';
const provenance = () => ({ providerId: 'dwd-mosmix-station-reference', endpoint,
  fetchedAt: '2001-02-03T04:05:06.321Z', expectedStationId: stationId,
  kind: 'public-station', referenceOnly: true });

function requestHeld(input: unknown, label: string) {
  assert.equal(parseDwdStationRequest(input), null, label);
  assert.equal(dwdMosmixStationEndpoint(input), null, label + ': endpoint admission must not trust a forged request');
}
function provenanceHeld(input: unknown, label: string) {
  assert.equal(parseDwdMosmixProvenance(input), null, label);
}

test('request identity uses the independently pinned official namespace, provider and endpoint spellings', () => {
  assert.equal(DWD_MOSMIX_PROVIDER_ID, 'dwd-mosmix-station-reference');
  assert.equal(DWD_MOSMIX_NAMESPACE, 'https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd');
  assert.equal(DWD_KML_NAMESPACE, 'http://www.opengis.net/kml/2.2');
  const source = { stationId }, before = { ...source };
  const request = parseDwdStationRequest(source); assert.ok(request);
  assert.deepEqual(request, { stationId: '01234' }); assert.notEqual(request, source); assert.ok(Object.isFrozen(request));
  assert.equal(dwdMosmixStationEndpoint(source), endpoint); assert.deepEqual(source, before);
  source.stationId = '99999'; assert.equal(request.stationId, '01234', 'a later caller edit cannot retarget admitted identity');
});

for (const [id, expected] of [
  ['00000', 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/00000/kml/MOSMIX_L_LATEST_00000.kmz'],
  ['99999', 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/99999/kml/MOSMIX_L_LATEST_99999.kmz'],
] as const) test('an explicit five-digit spelling preserves both occurrences and leading zero: ' + id, () => {
  assert.deepEqual(parseDwdStationRequest({ stationId: id }), { stationId: id });
  assert.equal(dwdMosmixStationEndpoint({ stationId: id }), expected);
  const source = { ...provenance(), expectedStationId: id, endpoint: expected };
  assert.deepEqual(parseDwdMosmixProvenance(source), source, 'the same explicit identity binds the canonical endpoint in provenance');
});

test('plain null-prototype and frozen data remain admissible without gaining caller identity', () => {
  const request = Object.assign(Object.create(null), { stationId }); Object.freeze(request);
  const accepted = parseDwdStationRequest(request); assert.deepEqual(accepted, { stationId }); assert.notEqual(accepted, request);
  const source = Object.assign(Object.create(null), provenance()); Object.freeze(source);
  const admitted = parseDwdMosmixProvenance(source); assert.deepEqual(admitted, provenance()); assert.notEqual(admitted, source);
  assert.ok(Object.isFrozen(admitted));
});

for (const [label, input] of [
  ['null', null], ['undefined', undefined], ['bare string', stationId], ['number', 1234],
  ['array', [{ stationId }]], ['function', () => ({ stationId })], ['empty', {}],
  ['missing own field', { other: stationId }], ['extra endpoint', { stationId, endpoint }],
  ['coordinate input', { stationId, latitude: 0, longitude: 0 }],
  ['short', { stationId: '1234' }], ['long', { stationId: '001234' }],
  ['leading whitespace', { stationId: ' 01234' }], ['trailing whitespace', { stationId: '01234 ' }],
  ['newline', { stationId: '01234\n' }], ['plus', { stationId: '+1234' }], ['exponent', { stationId: '1e004' }],
  ['decimal', { stationId: '12.34' }], ['unicode digits', { stationId: '０１２３４' }],
  ['path', { stationId: '../12' }], ['encoded path', { stationId: '%1234' }],
  ['numeric field', { stationId: 1234 }], ['boxed string', { stationId: new String(stationId) }],
  ['null field', { stationId: null }], ['undefined field', { stationId: undefined }],
] as Array<[string, unknown]>) test('unsupported request ' + label + ' never becomes an endpoint', () => requestHeld(input, label));

test('request accessors, coercion and JSON hooks stay uncalled at both admission entry points', () => {
  let getters = 0, coercions = 0, jsonCalls = 0;
  const accessor = Object.defineProperty({}, 'stationId', { enumerable: true, get() { getters++; return stationId; } });
  requestHeld(accessor, 'own getter');
  const inherited = Object.create(Object.defineProperty({}, 'stationId', { get() { getters++; return stationId; } }));
  requestHeld(inherited, 'inherited getter');
  const coerced = { stationId: { toString() { coercions++; return stationId; }, valueOf() { coercions++; return stationId; } } };
  requestHeld(coerced, 'coercion object');
  requestHeld({ stationId, toJSON() { jsonCalls++; return { stationId }; } }, 'toJSON method');
  requestHeld(Object.defineProperty({ stationId }, 'toJSON', { get() { getters++; return () => { jsonCalls++; }; } }), 'toJSON getter');
  assert.equal(getters, 0); assert.equal(coercions, 0); assert.equal(jsonCalls, 0);
});

test('descriptor, prototype, symbol, cycle and reflection faults cannot borrow a valid request shape', () => {
  requestHeld(Object.defineProperty({}, 'stationId', { value: stationId }), 'nonenumerable station');
  requestHeld({ stationId, [Symbol('extra')]: true }, 'symbol key');
  requestHeld(Object.defineProperty({ stationId }, 'hidden', { value: true }), 'hidden extra');
  requestHeld(Object.create({ stationId }), 'inherited data');
  class Request { stationId = '01234'; }
  requestHeld(new Request(), 'custom prototype');
  const cycle: Record<string, unknown> = { stationId }; cycle.extra = cycle; requestHeld(cycle, 'cycle');
  const ownProto = Object.defineProperty({ stationId }, '__proto__', { value: { stationId: '99999' }, enumerable: true });
  requestHeld(ownProto, 'own prototype-named extra');
  for (const trap of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const) {
    const source = new Proxy({ stationId }, { [trap]() { throw Error('Synthetic reflection fault'); } });
    assert.doesNotThrow(() => requestHeld(source, trap));
  }
  const revoked = Proxy.revocable({ stationId }, {}); revoked.revoke(); requestHeld(revoked.proxy, 'revoked proxy');
});

test('provenance is exact detached caller-supplied source context, with no inferred clock or location', () => {
  const source = provenance(), before = { ...source }, admitted = parseDwdMosmixProvenance(source); assert.ok(admitted);
  assert.deepEqual(admitted, before); assert.notEqual(admitted, source); assert.ok(Object.isFrozen(admitted));
  assert.deepEqual(Object.keys(admitted).sort(), ['providerId', 'endpoint', 'fetchedAt', 'expectedStationId', 'kind', 'referenceOnly'].sort());
  source.fetchedAt = '2099-12-31T23:59:59.999Z'; source.expectedStationId = '99999'; source.endpoint = 'https://example.invalid';
  assert.deepEqual(admitted, before);
  assert.deepEqual(parseDwdMosmixProvenance(before), admitted, 'repeated parsing adds no current-time or freshness claim');
});

for (const key of ['providerId', 'endpoint', 'fetchedAt', 'expectedStationId', 'kind', 'referenceOnly'] as const) {
  test('provenance requires its own exact ' + key + ' field and never reads its accessor', () => {
    const missing: Record<string, unknown> = provenance(); delete missing[key]; provenanceHeld(missing, 'missing ' + key);
    let getters = 0; const accessor = Object.defineProperty(provenance(), key, { enumerable: true, get() { getters++; return provenance()[key]; } });
    provenanceHeld(accessor, 'getter ' + key); assert.equal(getters, 0);
    const hidden = Object.defineProperty(provenance(), key, { enumerable: false, value: provenance()[key] });
    provenanceHeld(hidden, 'hidden ' + key);
  });
}

for (const [label, patch] of [
  ['wrong provider', { providerId: 'nws-forecast-reference' }], ['provider case', { providerId: 'DWD-MOSMIX-STATION-REFERENCE' }],
  ['point kind', { kind: 'requested-point' }], ['demo kind', { kind: 'demo' }],
  ['false reference', { referenceOnly: false }], ['truthy reference', { referenceOnly: 1 }],
  ['numeric station', { expectedStationId: 1234 }], ['short station', { expectedStationId: '1234' }],
  ['station endpoint mismatch', { expectedStationId: '99999' }],
  ['nonstring endpoint', { endpoint: new URL(endpoint) }],
  ['null fetchedAt', { fetchedAt: null }], ['numeric fetchedAt', { fetchedAt: 0 }],
  ['date-object fetchedAt', { fetchedAt: new Date('2024-02-29T12:00:00.000Z') }],
] as Array<[string, Record<string, unknown>]>) test('provenance ' + label + ' is held', () => provenanceHeld({ ...provenance(), ...patch }, label));

for (const badEndpoint of [
  endpoint + '?download=1', endpoint + '#fragment', endpoint + '/', endpoint.replace('https:', 'http:'),
  endpoint.replace('opendata.dwd.de', 'opendata.dwd.de.example.invalid'), endpoint.replace('opendata.dwd.de', 'user:secret@opendata.dwd.de'),
  endpoint.replace('opendata.dwd.de', 'OPENDATA.DWD.DE'), endpoint.replace('/MOSMIX_L/', '/mosmix_l/'),
  endpoint.replace('LATEST_01234', 'LATEST_99999'), endpoint.replace('/01234/', '/99999/'),
  endpoint.replace('/01234/', '/%30%31%32%33%34/'), ' ' + endpoint, endpoint + '\n',
]) test('canonical provenance rejects endpoint variation ' + badEndpoint, () => provenanceHeld({ ...provenance(), endpoint: badEndpoint }, 'endpoint variation'));

for (const fetchedAt of [
  '', '2024-02-30T12:00:00.000Z', '2023-02-29T12:00:00.000Z', '2024-04-31T12:00:00.000Z',
  '2024-01-01T24:00:00.000Z', '2024-01-01T12:00:60.000Z', '2024-01-01',
  '2024-01-01T12:00:00Z', '2024-01-01T12:00:00.00Z', '2024-01-01T12:00:00.000+00:00',
  '2024-01-01T12:00:00.000z', ' 2024-01-01T12:00:00.000Z', '2024-01-01T12:00:00.000Z ',
]) test('provenance preserves the strict existing UTC timestamp boundary: ' + fetchedAt, () => provenanceHeld({ ...provenance(), fetchedAt }, 'invalid fetchedAt'));

test('provenance accepts a real leap-day UTC instant without certifying freshness', () => {
  const source = { ...provenance(), fetchedAt: '2024-02-29T23:59:59.999Z' };
  assert.deepEqual(parseDwdMosmixProvenance(source), source);
});

test('provenance rejects extra, inherited, executable and unreadable shape evidence without JSON hooks', () => {
  for (const value of [null, [], 'source', Object.create(provenance()), new Date(),
    { ...provenance(), countryCode: 'DE' }, { ...provenance(), stationCoordinates: [0, 0] },
    { ...provenance(), [Symbol('extra')]: true },
  ]) provenanceHeld(value, 'unsupported provenance shape');
  let jsonCalls = 0, getters = 0;
  provenanceHeld({ ...provenance(), toJSON() { jsonCalls++; return provenance(); } }, 'JSON hook');
  provenanceHeld(Object.defineProperty(provenance(), 'hidden', { get() { getters++; return true; } }), 'hidden getter');
  const cyclic: Record<string, unknown> = provenance(); cyclic.extra = cyclic; provenanceHeld(cyclic, 'cycle');
  for (const trap of ['getPrototypeOf', 'ownKeys', 'getOwnPropertyDescriptor'] as const) {
    assert.doesNotThrow(() => provenanceHeld(new Proxy(provenance(), { [trap]() { throw Error('Synthetic reflection fault'); } }), trap));
  }
  const revoked = Proxy.revocable(provenance(), {}); revoked.revoke(); provenanceHeld(revoked.proxy, 'revoked');
  assert.equal(jsonCalls, 0); assert.equal(getters, 0);
});

// Directory-derived spelling extension only. These literal examples do not
// establish catalogue membership at request time, country or site suitability.
for (const [id, expected] of [
  ['A051', 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/A051/kml/MOSMIX_L_LATEST_A051.kmz'],
  ['C0014', 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/C0014/kml/MOSMIX_L_LATEST_C0014.kmz'],
  ['EW002', 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/EW002/kml/MOSMIX_L_LATEST_EW002.kmz'],
] as const) test('directory-derived station spelling remains literal in both endpoint positions and provenance: ' + id, () => {
  const request = { stationId: id };
  assert.deepEqual(parseDwdStationRequest(request), { stationId: id });
  assert.equal(dwdMosmixStationEndpoint(request), expected);
  const source = { ...provenance(), expectedStationId: id, endpoint: expected };
  const admitted = parseDwdMosmixProvenance(source); assert.ok(admitted);
  assert.deepEqual(admitted, source); assert.notEqual(admitted, source); assert.ok(Object.isFrozen(admitted));
  assert.equal(parseDwdMosmixProvenance({ ...source, endpoint }), null, 'a numeric endpoint cannot authorize an alphanumeric station');
  assert.equal(parseDwdMosmixProvenance({ ...source, endpoint: expected.replace('LATEST_' + id, 'LATEST_01234') }), null, 'filename identity must match the directory and explicit station');
});
for (const id of [
  'a051', 'c0014', 'ew002', 'Ew002', 'eW002', 'A05', 'A00051', 'EW02', 'EW0002',
  'ABC12', 'ABC01', '0A51', 'E0W02', 'EW0A2', 'A0B1', ' A051', 'A051 ', 'A051\n', 'A051\r', 'A051\u2028', 'A051\u2029',
  'Ａ051', 'A０51', 'EW００２', 'A-51', 'EW_02',
]) test('unsupported alphabetic boundary cannot borrow a directory-derived spelling: ' + JSON.stringify(id), () => {
  requestHeld({ stationId: id }, 'unsupported station spelling');
  provenanceHeld({ ...provenance(), expectedStationId: id }, 'unsupported provenance station spelling');
  provenanceHeld({ ...provenance(), expectedStationId: id,
    endpoint: 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/' + id + '/kml/MOSMIX_L_LATEST_' + id + '.kmz' },
  'matching endpoint text cannot bless an unsupported station spelling');
});
