import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDwdMosmixStationCatalogBytes, DWD_MOSMIX_CATALOG_LIMITS } from '../lib/international/providers/dwd-mosmix-catalog.ts';

// Synthetic identity/name records only; ignored fields contain opaque printable
// letters, never coordinates. Header/column literals are independent format facts.
// The corrected [32,38) span was independently checked by the coordinator against
// every retained source row; byte37 is part of that opaque field, not a gap.
const HEADER = 'ID    ICAO NAME                 LAT    LON     ELEV';
const SEPARATOR = '----- ---- -------------------- -----  ------- -----';
const ascii = (text: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(text);
function record(idField: string | Uint8Array = '01234', name: string | Uint8Array = 'SYNTHETIC NAME'): Uint8Array<ArrayBuffer> {
  const id = typeof idField === 'string' ? ascii(idField) : idField;
  const label = typeof name === 'string' ? ascii(name) : name;
  assert.equal(id.byteLength, 5); assert.ok(label.byteLength <= 20);
  const row = new Uint8Array(52); row.fill(32); row.set(id, 0); row.set(ascii('ABCD'), 6); row.set(label, 11);
  row.set(ascii('ABCDEF'), 32); row.set(ascii('GHIJKLM'), 39); row.set(ascii('NOPQR'), 47);
  return row;
}
function concatenate(parts: readonly Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0)); let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}
function lines(parts: readonly Uint8Array[], newline: 'LF' | 'CRLF' = 'LF', finalNewline = true): Uint8Array<ArrayBuffer> {
  const delimiter = newline === 'LF' ? new Uint8Array([10]) : new Uint8Array([13, 10]);
  const chunks: Uint8Array[] = [];
  parts.forEach((part, index) => { chunks.push(part); if (index < parts.length - 1 || finalNewline) chunks.push(delimiter); });
  return concatenate(chunks);
}
const catalog = (rows = [record()], newline: 'LF' | 'CRLF' = 'LF', finalNewline = true) => lines([ascii(HEADER), ascii(SEPARATOR), ...rows], newline, finalNewline);
function admitted(input: unknown = catalog()) {
  const result = parseDwdMosmixStationCatalogBytes(input);
  if (result.status === 'failed') throw Error('Independent valid synthetic catalogue was held: ' + result.reason);
  return result;
}
function held(input: unknown, reason?: string): void {
  const result = parseDwdMosmixStationCatalogBytes(input);
  assert.equal(result.status, 'failed'); if (result.status !== 'failed') throw Error('Invalid catalogue returned partial station identities');
  assert.ok(['invalid-byte-input', 'invalid-catalog', 'unsupported-profile', 'unsupported-station-id', 'ambiguous-catalog', 'software-bound'].includes(result.reason));
  if (reason) assert.equal(result.reason, reason);
  assert.deepEqual(Object.keys(result).sort(), ['reason', 'status']); assert.ok(Object.isFrozen(result));
}
function frozen(value: unknown): void {
  if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) frozen(child); }
}

for (const newline of ['LF', 'CRLF'] as const) for (const ending of [false, true]) {
  test('exact independent byte framing accepts ' + newline + ' with final delimiter ' + ending, () => {
    const result = admitted(catalog([record()], newline, ending));
    assert.deepEqual(result, { status: 'parsed', stations: [{ stationId: '01234', name: 'SYNTHETIC NAME' }],
      issues: [], withheldNameCount: 0, nameProfile: 'ascii-only', referenceOnly: true });
    frozen(result);
  });
}
test('all four canonical ID spellings preserve exact identity and input order without interpreting opaque fields', () => {
  const result = admitted(catalog([record('01234'), record(' A051'), record('A0001'), record('AB123')]));
  assert.deepEqual(result.stations.map(row => row.stationId), ['01234', 'A051', 'A0001', 'AB123']);
  assert.deepEqual(Object.keys(result).sort(), ['status', 'stations', 'issues', 'withheldNameCount', 'nameProfile', 'referenceOnly'].sort());
  for (const row of result.stations) assert.deepEqual(Object.keys(row).sort(), ['name', 'stationId']);
  assert.equal('coordinates' in result, false); assert.equal('fetchedAt' in result, false); assert.equal('country' in result, false);
});
test('printable byte37 belongs to the uninterpreted six-byte field and must not be mistaken for a separator', () => {
  const row = record(); assert.equal(row[37], 70); assert.equal(row[38], 32);
  assert.deepEqual(admitted(catalog([row])).stations, [{ stationId: '01234', name: 'SYNTHETIC NAME' }]);
});
for (const id of [' A051', 'A051 ', '00000', '99999']) test('ASCII edge framing preserves actual ID spelling ' + JSON.stringify(id), () => {
  assert.equal(admitted(catalog([record(id)])).stations[0].stationId, id.replace(/^ +| +$/g, ''));
});
test('name leading spaces survive while only trailing ASCII padding is removed', () => {
  assert.equal(admitted(catalog([record('01234', '  NAME WITH SPACE  ')])).stations[0].name, '  NAME WITH SPACE');
});
test('a full-width printable ASCII name is preserved without truncation or replacement', () => {
  const name = 'ABCDEFGHIJKLMNOPQRST'; assert.equal(ascii(name).length, 20);
  assert.equal(admitted(catalog([record('01234', name)])).stations[0].name, name);
});
test('the same name across different canonical identities remains legitimate', () => {
  const result = admitted(catalog([record('01234', 'SAME SYNTHETIC NAME'), record(' A051', 'SAME SYNTHETIC NAME')]));
  assert.equal(result.status, 'parsed'); assert.equal(result.stations.length, 2); assert.equal(result.stations[0].name, result.stations[1].name);
});
for (const rows of [[record('01234', 'ONE'), record('01234', 'TWO')], [record(' A051', 'ONE'), record('A051 ', 'TWO')]]) {
  test('duplicate canonical identity holds the whole catalogue including differently padded spellings ' + rows[0][0], () => { held(catalog(rows), 'ambiguous-catalog'); });
}
for (const id of [' 1234', 'a0001', ' a051', '01 34', 'A0 51', '+1234', '12.34', 'A_051', '     ']) {
  test('unsupported station field ' + JSON.stringify(id) + ' cannot retain earlier rows as partial success', () => {
    held(catalog([record('99999', 'VALID FIRST'), record(id)]), 'unsupported-station-id');
  });
}
test('non-ASCII framing is not trimmed as if it were an ASCII padding space', () => {
  held(catalog([record(new Uint8Array([0xa0, 65, 48, 53, 49]))]), 'unsupported-station-id');
});

test('any non-ASCII name stays explicitly unknown even when its bytes form valid UTF-8', () => {
  const result = admitted(catalog([record('01234', 'ASCII NAME'), record(' A051', ascii('café')),
    record('A0001', new Uint8Array([0xe9, 0x80, 0xff])), record('AB123', ascii('北 🌱'))]));
  assert.equal(result.status, 'partial'); assert.deepEqual(result.stations, [
    { stationId: '01234', name: 'ASCII NAME' }, { stationId: 'A051', name: null },
    { stationId: 'A0001', name: null }, { stationId: 'AB123', name: null },
  ]);
  assert.equal(result.withheldNameCount, 3); assert.deepEqual(result.issues, ['names-withheld-encoding']);
  assert.equal(result.nameProfile, 'ascii-only'); assert.equal(result.referenceOnly, true); frozen(result);
});
test('a non-ASCII byte without printable ASCII text is withheld rather than silently made empty or guessed', () => {
  const result = admitted(catalog([record('01234', new Uint8Array([0xa0]))]));
  assert.equal(result.stations[0].name, null); assert.equal(result.withheldNameCount, 1); assert.equal(result.status, 'partial');
});
for (const byte of [0, 9, 13, 31, 127]) test('control byte ' + byte + ' in NAME holds the catalogue rather than becoming a withheld-encoding name', () => {
  held(catalog([record('01234', new Uint8Array([0xe9, byte, 65]))]));
});
test('an empty or space-only name cannot become an admitted unnamed ASCII station', () => {
  held(catalog([record('01234', '')])); held(catalog([record('01234', '   ')]));
});

for (const position of [5, 10, 31, 38, 46]) test('fixed separator position ' + position + ' requires an ASCII space byte', () => {
  const row = record(); row[position] = 88; held(catalog([row]));
});
for (const position of [6, 32, 37, 39, 47]) test('non-ASCII outside NAME at opaque byte ' + position + ' holds the byte profile', () => {
  const row = record(); row[position] = 0x80; held(catalog([row]));
});
for (const position of [0, 6, 20, 32, 39, 51]) test('an embedded bare CR at byte ' + position + ' is never a line delimiter', () => {
  const row = record(); row[position] = 13; held(catalog([row]));
});
test('a bare terminal CR cannot be stripped as if an LF followed it', () => {
  held(concatenate([catalog([record()], 'LF', false), new Uint8Array([13])]));
});
test('blank interior or extra terminal records never disappear from the supplied byte profile', () => {
  held(lines([ascii(HEADER), ascii(SEPARATOR), record(), new Uint8Array(), record(' A051')]));
  held(concatenate([catalog(), new Uint8Array([10])]));
  held(concatenate([new Uint8Array([10]), catalog()]));
});
for (const width of [0, 1, 51, 53]) test('a truncated or overwide record of ' + width + ' bytes cannot become a station', () => {
  const row = new Uint8Array(width); row.fill(32); if (width) row.set(record().subarray(0, Math.min(width, 52)));
  held(lines([ascii(HEADER), ascii(SEPARATOR), row]));
});
for (const [header, separator] of [[HEADER + ' ', SEPARATOR], [HEADER.replace('ID', 'Id'), SEPARATOR],
  [HEADER, SEPARATOR.slice(1)], [HEADER, SEPARATOR + '-'], ['<html>not a catalogue</html>', SEPARATOR]]) {
  test('an altered first header/separator pair never borrows the known row parser: ' + header.slice(0, 12) + '/' + separator.length, () => {
    held(lines([ascii(header), ascii(separator), record()]));
  });
}
test('empty catalogues and a UTF-8 BOM before the exact header are not silently normalized', () => {
  held(new Uint8Array(), 'invalid-catalog'); held(lines([ascii(HEADER), ascii(SEPARATOR)]));
  held(concatenate([new Uint8Array([0xef, 0xbb, 0xbf]), catalog()]));
});

test('input bytes and returned identities remain detached and deeply frozen', () => {
  const input = catalog(), before = input.slice(), result = admitted(input);
  assert.deepEqual(input, before); input.fill(0); assert.equal(result.stations[0].stationId, '01234'); assert.equal(result.stations[0].name, 'SYNTHETIC NAME');
  frozen(result); assert.throws(() => (result.stations as unknown[]).push({}), TypeError);
  assert.throws(() => { (result.stations[0] as { name: string }).name = 'CHANGED'; }, TypeError);
});
test('ordinary byte-view getters, constructors and iteration hooks never execute', () => {
  const input = catalog(), before = input.slice(), backing = input.buffer, offset = input.byteOffset, length = input.byteLength; let reads = 0;
  const get = () => { reads++; throw Error('Ordinary supplied byte hook'); };
  for (const name of ['byteLength', 'length', 'buffer', 'byteOffset', 'constructor', 'toJSON', 'toString', 'valueOf']) Object.defineProperty(input, name, { get });
  Object.defineProperty(input, Symbol.iterator, { get }); Object.defineProperty(input, Symbol.toStringTag, { get });
  assert.equal(admitted(input).stations[0].stationId, '01234'); assert.equal(reads, 0); assert.deepEqual(new Uint8Array(backing, offset, length), before);
});
test('proxies, shared or detached buffers and unsupported byte shapes never invoke ordinary coercion', () => {
  let reads = 0;
  const fake = { get byteLength() { reads++; return 1; }, toString() { reads++; return HEADER; } };
  const revoked = Proxy.revocable(catalog(), {}); revoked.revoke();
  const detached = new Uint8Array(1); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  for (const input of [null, undefined, HEADER, [1, 2], fake, new DataView(new ArrayBuffer(8)), new Uint16Array(4), new Uint8ClampedArray(4),
    new Uint8Array(new SharedArrayBuffer(8)), detached, revoked.proxy, new Proxy(catalog(), { get() { reads++; throw Error('Proxy get'); } })]) held(input, 'invalid-byte-input');
  assert.equal(reads, 0);
});
test('the actual internal byte length holds an oversized input before ordinary view fields can hide it', () => {
  let reads = 0; const input = new Uint8Array(DWD_MOSMIX_CATALOG_LIMITS.inputBytes + 1);
  Object.defineProperty(input, 'byteLength', { get() { reads++; return 1; } });
  held(input, 'software-bound'); assert.equal(reads, 0);
});
test('catalogue ceilings are frozen engineering limits rather than claimed provider coverage', () => {
  assert.deepEqual(DWD_MOSMIX_CATALOG_LIMITS, { inputBytes: 1_048_576, maxRows: 10_000 }); assert.ok(Object.isFrozen(DWD_MOSMIX_CATALOG_LIMITS));
});
test('the exact row ceiling preserves every synthetic identity without sorting or sampling', () => {
  const rows = Array.from({ length: DWD_MOSMIX_CATALOG_LIMITS.maxRows }, (_, index) => record(String(index).padStart(5, '0')));
  const result = admitted(catalog(rows)); assert.equal(result.stations.length, 10_000);
  assert.equal(result.stations[0].stationId, '00000'); assert.equal(result.stations.at(-1)!.stationId, '09999');
});
for (const finalNewline of [false, true]) test('a row beyond the ceiling holds the whole catalogue with final delimiter ' + finalNewline, () => {
  const rows = Array.from({ length: DWD_MOSMIX_CATALOG_LIMITS.maxRows + 1 }, (_, index) => record(String(index).padStart(5, '0')));
  held(catalog(rows, 'LF', finalNewline), 'software-bound');
});
test('a finite newline burst cannot retain more than header, separator and the bounded row count of line views', () => {
  const original = Uint8Array.prototype.subarray; let views = 0;
  Uint8Array.prototype.subarray = function <T extends ArrayBufferLike>(this: Uint8Array<T>, begin?: number, end?: number): Uint8Array<T> {
    views++; return Reflect.apply(original, this, [begin, end]) as Uint8Array<T>;
  };
  try {
    held(new Uint8Array(DWD_MOSMIX_CATALOG_LIMITS.maxRows + 200).fill(10));
    assert.ok(views <= DWD_MOSMIX_CATALOG_LIMITS.maxRows + 2, 'the line-view guard must run before each retained view, not after collecting all lines');
  } finally { Uint8Array.prototype.subarray = original; }
});
