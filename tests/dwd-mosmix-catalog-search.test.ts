import assert from 'node:assert/strict';
import test from 'node:test';
import { searchDwdMosmixStationCatalogBytes, DWD_MOSMIX_CATALOG_SEARCH_LIMITS } from '../lib/international/providers/dwd-mosmix-catalog-search.ts';
import { parseDwdMosmixStationCatalogBytes } from '../lib/international/providers/dwd-mosmix-catalog.ts';

// These tiny independent byte records contain opaque letters in ignored fields,
// not actual station locations or a copied public catalogue.
const ascii = (value: string) => new TextEncoder().encode(value);
function row(id: string, name: string | Uint8Array): Uint8Array<ArrayBuffer> {
  const label = typeof name === 'string' ? ascii(name) : name;
  assert.equal(id.length, 5); assert.ok(label.length <= 20);
  const result = new Uint8Array(52).fill(32);
  result.set(ascii(id), 0); result.set(ascii('ABCD'), 6); result.set(label, 11);
  result.set(ascii('ABCDEF'), 32); result.set(ascii('GHIJKLM'), 39); result.set(ascii('NOPQR'), 47);
  return result;
}
function catalog(rows = [row('01234', 'SYNTHETIC NAME')]): Uint8Array<ArrayBuffer> {
  const parts = [ascii('ID    ICAO NAME                 LAT    LON     ELEV'),
    ascii('----- ---- -------------------- -----  ------- -----'), ...rows];
  const bytes = new Uint8Array(parts.reduce((size, part) => size + part.length + 1, 0)); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; bytes[offset++] = 10; }
  return bytes;
}
function accepted(input: unknown, query: unknown) {
  const result = searchDwdMosmixStationCatalogBytes(input, query);
  if (result.status === 'failed') throw Error('Independent valid search was held: ' + result.reason);
  return result;
}
function frozen(value: unknown): void {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); }
}
function invalidQuery(input: unknown, query: unknown): void {
  const result = searchDwdMosmixStationCatalogBytes(input, query);
  assert.deepEqual(result, { status: 'failed', reason: 'invalid-query' }); frozen(result);
}

test('an invalid query wins before input branding, reflection, coercion or byte getters', () => {
  let inputHooks = 0, inputBrandCalls = 0, queryHooks = 0;
  const input = new Proxy({}, {
    get() { inputHooks++; throw Error('Input read'); },
    ownKeys() { inputHooks++; throw Error('Input keys'); },
    getOwnPropertyDescriptor() { inputHooks++; throw Error('Input descriptor'); },
    getPrototypeOf() { inputHooks++; throw Error('Input prototype'); },
  });
  const unsafeQuery = new Proxy({}, { get() { queryHooks++; throw Error('Query coercion'); } });
  const original = ArrayBuffer.isView;
  ArrayBuffer.isView = ((value: unknown) => { inputBrandCalls++; return original(value); }) as typeof ArrayBuffer.isView;
  try {
    for (const query of [undefined, null, false, 1, BigInt(0), Symbol('query'), {}, [], unsafeQuery, new String('01234'), '', '   ', '\t', 'x'.repeat(65)]) {
      invalidQuery(input, query);
    }
  } finally { ArrayBuffer.isView = original; }
  assert.equal(inputHooks, 0); assert.equal(inputBrandCalls, 0); assert.equal(queryHooks, 0);
});
test('invalid query does not inspect even a real byte view with throwing ordinary fields', () => {
  const input = catalog(); let calls = 0;
  for (const key of ['byteLength', 'length', 'buffer', 'byteOffset', 'constructor']) Object.defineProperty(input, key, { get() { calls++; throw Error('Byte getter'); } });
  invalidQuery(input, '\n01234'); assert.equal(calls, 0);
  const revoked = Proxy.revocable(input, {}); revoked.revoke(); invalidQuery(revoked.proxy, null);
});
for (const byte of [0, 9, 10, 13, 31, 127, 128]) test('query control/non-ASCII code ' + byte + ' is rejected even on an edge', () => {
  invalidQuery(catalog(), String.fromCharCode(byte) + '01234');
  invalidQuery(catalog(), '01234' + String.fromCharCode(byte));
});
for (const query of ['café', 'cafe\u0301', '\u00a001234', '０１２３４', '北', '🌱', '\ufeff01234', '\u200b01234']) {
  test('Unicode query is held without normalization or transliteration: ' + JSON.stringify(query), () => invalidQuery(catalog(), query));
}
test('the 64-character bound applies to the supplied string before edge spaces are removed', () => {
  const input = catalog();
  invalidQuery(input, ' '.repeat(60) + '01234');
  assert.equal(accepted(input, ' '.repeat(59) + '01234').query, '01234');
  const exact = 'Q'.repeat(64), result = accepted(input, exact);
  assert.equal(result.query, exact); assert.equal(result.status, 'no-matches');
  invalidQuery(input, 'Q'.repeat(65)); invalidQuery(input, ' '.repeat(64));
});
test('edge ASCII spaces are removed while original query case and embedded spaces survive', () => {
  const input = catalog([row('01234', 'Two  Spaces')]);
  const result = accepted(input, '  tWo  sPaCeS  ');
  assert.equal(result.query, 'tWo  sPaCeS'); assert.equal(result.totalMatches, 1);
  assert.equal(result.matches[0].name, 'Two  Spaces');
  assert.equal(accepted(input, 'Two Spaces').status, 'no-matches');
});
test('ASCII punctuation is a literal substring, not a wildcard, regular expression or token grammar', () => {
  const input = catalog([row('01234', '[A].* FIELD'), row('99999', 'ORDINARY FIELD')]);
  assert.deepEqual(accepted(input, '[a].*').matches, [{ stationId: '01234', name: '[A].* FIELD' }]);
  assert.equal(accepted(input, '^.*$').status, 'no-matches');
});
test('case-insensitive name matching preserves source order, canonical IDs and original name casing', () => {
  const input = catalog([row('99999', 'the NORTH plot'), row('01234', 'north Ridge'), row(' A051', 'SOUTH')]);
  assert.deepEqual(accepted(input, 'nOrTh'), {
    status: 'matches', query: 'nOrTh', matches: [
      { stationId: '99999', name: 'the NORTH plot' }, { stationId: '01234', name: 'north Ridge' },
    ], totalMatches: 2, catalogStationCount: 3, catalogWithheldNameCount: 0, nameProfile: 'ascii-only', referenceOnly: true,
  });
});
test('canonical ID substring matches preserve leading zeroes and need no complete station code', () => {
  const input = catalog([row(' A051', 'UPPER NAME'), row('A0001', 'OTHER'), row('AB123', 'THIRD'), row('00000', 'ZERO')]);
  assert.deepEqual(accepted(input, 'a0').matches.map(station => station.stationId), ['A051', 'A0001']);
  assert.deepEqual(accepted(input, '000').matches.map(station => station.stationId), ['A0001', '00000']);
  assert.equal(accepted(input, 'b12').matches[0].stationId, 'AB123');
});
test('a row matching both identity and name counts once rather than occupying two retained slots', () => {
  const result = accepted(catalog([row('AB123', 'Ab123 NAME'), row('01234', 'Ab123 NAME')]), 'b12');
  assert.equal(result.totalMatches, 2); assert.equal(result.matches.length, 2);
  assert.deepEqual(result.matches.map(station => station.stationId), ['AB123', '01234']);
});
test('unknown names remain selectable by ID without searching guessed or partial decoded text', () => {
  const input = catalog([row(' A051', ascii('café')), row('01234', 'KNOWN')]);
  const result = accepted(input, 'a05');
  assert.deepEqual(result.matches, [{ stationId: 'A051', name: null }]);
  assert.equal(result.catalogWithheldNameCount, 1); assert.equal(result.catalogStationCount, 2);
  for (const query of ['caf', 'null', 'unknown', 'unavailable']) {
    const empty = accepted(input, query);
    assert.equal(empty.status, 'no-matches'); assert.equal(empty.totalMatches, 0); assert.deepEqual(empty.matches, []);
    assert.equal(empty.catalogWithheldNameCount, 1); assert.equal(empty.catalogStationCount, 2);
  }
});
for (const count of [0, 1, 20, 27]) test(count + ' matches distinguish retained limit from the complete count and preserve first source order', () => {
  const rows = Array.from({ length: count }, (_, index) => row(String(99999 - index), 'COMMON NAME'));
  rows.splice(Math.min(3, rows.length), 0, row('01234', 'UNRELATED'));
  const result = accepted(catalog(rows), 'common');
  assert.equal(result.status, count ? 'matches' : 'no-matches'); assert.equal(result.totalMatches, count);
  assert.equal(result.matches.length, Math.min(count, 20)); assert.equal(result.catalogStationCount, count + 1);
  assert.deepEqual(result.matches.map(station => station.stationId), Array.from({ length: Math.min(count, 20) }, (_, index) => String(99999 - index)));
});
test('existing catalogue holds propagate without partial matches or invented search failures', () => {
  const badGap = row('01234', 'GOOD'); badGap[38] = 88;
  const inputs = [null, new Uint8Array(), ascii('<html>not a catalogue</html>'), catalog([badGap]),
    catalog([row('01234', 'FIRST'), row('a0001', 'BAD ID')]),
    catalog([row('01234', 'FIRST'), row('01234', 'DUPLICATE')]), new Uint8Array(1_048_577)];
  for (const input of inputs) {
    const expected = parseDwdMosmixStationCatalogBytes(input); assert.equal(expected.status, 'failed');
    const result = searchDwdMosmixStationCatalogBytes(input, 'first');
    assert.deepEqual(result, expected); assert.deepEqual(Object.keys(result).sort(), ['reason', 'status']); frozen(result);
  }
});
test('search results are detached from input and deeply frozen without attaching extra provenance or positions', () => {
  const input = catalog([row(' A051', 'MiXeD Name'), row('01234', ascii('café'))]), before = input.slice();
  const result = accepted(input, 'name'); assert.deepEqual(input, before); frozen(result);
  assert.deepEqual(Object.keys(result).sort(), ['catalogStationCount', 'catalogWithheldNameCount', 'matches', 'nameProfile', 'query', 'referenceOnly', 'status', 'totalMatches']);
  assert.deepEqual(Object.keys(result.matches[0]).sort(), ['name', 'stationId']);
  input.fill(0); assert.deepEqual(result.matches, [{ stationId: 'A051', name: 'MiXeD Name' }]);
  assert.throws(() => (result.matches as unknown[]).push({}), TypeError);
  assert.throws(() => { (result.matches[0] as { name: string }).name = 'REPLACED'; }, TypeError);
  const noMatch = accepted(catalog(), 'no match'); frozen(noMatch);
});
test('search limits are immutable engineering/UI ceilings', () => {
  assert.deepEqual(DWD_MOSMIX_CATALOG_SEARCH_LIMITS, { queryCharacters: 64, matches: 20 }); frozen(DWD_MOSMIX_CATALOG_SEARCH_LIMITS);
});
