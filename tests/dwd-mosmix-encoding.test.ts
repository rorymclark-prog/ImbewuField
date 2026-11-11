import assert from 'node:assert/strict';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { decodeDwdMosmixKmlBytes, DWD_MOSMIX_BYTE_LIMITS, type DwdMosmixByteResult } from '../lib/international/providers/dwd-mosmix-encoding.ts';
import { snapshotDwdMosmixBytes } from '../lib/international/providers/dwd-mosmix-byte-snapshot.ts';

// Synthetic parser controls only: literal namespaces, official endpoint spelling,
// source instants and expected native units do not come from the implementation.
const source = () => ({ providerId: 'dwd-mosmix-station-reference',
  endpoint: 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/A051/kml/MOSMIX_L_LATEST_A051.kmz',
  fetchedAt: '2001-02-03T04:05:06.321Z', expectedStationId: 'A051', kind: 'public-station', referenceOnly: true });
const utf8 = (text: string) => new TextEncoder().encode(text);
function fixture(description = 'SYNTHETIC café 北 🌱', declaration = '<?xml version="1.0" encoding="UTF-8"?>'): string {
  return declaration + '<k:kml xmlns:k="http://www.opengis.net/kml/2.2" xmlns:w="https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd">'
    + '<k:Document><k:ExtendedData><w:ProductDefinition><w:ProductID>MOSMIX</w:ProductID>'
    + '<w:IssueTime>2024-02-29T11:00:00.789Z</w:IssueTime><w:ForecastTimeSteps>'
    + '<w:TimeStep>2024-02-29T12:00:00.123Z</w:TimeStep><w:TimeStep>2024-02-29T13:00:00.456Z</w:TimeStep>'
    + '</w:ForecastTimeSteps><w:FormatCfg><w:DefaultUndefSign>-</w:DefaultUndefSign></w:FormatCfg>'
    + '</w:ProductDefinition></k:ExtendedData><k:Placemark><k:name>A051</k:name><k:description>' + description
    + '</k:description><k:ExtendedData><w:Forecast w:elementName="TTT"><w:value>273.15 -</w:value></w:Forecast>'
    + '<w:Forecast w:elementName="RR1c"><w:value>0.00 0.10</w:value></w:Forecast>'
    + '</k:ExtendedData></k:Placemark></k:Document></k:kml>';
}
function latinBytes(text: string): Uint8Array {
  assert.ok([...text].every(character => character.codePointAt(0)! <= 255));
  return Uint8Array.from([...text].map(character => character.charCodeAt(0)));
}
function ready(input: unknown, context: unknown = source()): Extract<DwdMosmixByteResult, { status: 'available' | 'partial' }> {
  const result = decodeDwdMosmixKmlBytes(input, context);
  assert.notEqual(result.status, 'failed');
  if (result.status === 'failed') throw Error('Independent valid byte fixture held: ' + result.reason);
  return result;
}
function held(input: unknown, reason?: string, context: unknown = source()): void {
  const result = decodeDwdMosmixKmlBytes(input, context);
  assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Damaged byte fixture admitted');
  if (reason) assert.equal(result.reason, reason);
  assert.ok(Object.isFrozen(result));
  assert.deepEqual(Object.keys(result).sort(), ['status', 'reason', 'provenance'].sort());
}

test('actual byte decoding retains UTF-8 station text, exact source times, native units, missing values and recorded zero', () => {
  const input = utf8(fixture()), original = [...input], context = source(), before = { ...context };
  const result = ready(input, context);
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.station, { id: 'A051', description: 'SYNTHETIC café 北 🌱' });
  assert.equal(result.issuedAt, '2024-02-29T11:00:00.789Z');
  assert.deepEqual(result.units, { temperature: 'K', precipitation: 'kg/m2' });
  assert.deepEqual(result.periods, [
    { validAt: '2024-02-29T12:00:00.123Z', temperatureK: 273.15, precipitationKgM2: 0 },
    { validAt: '2024-02-29T13:00:00.456Z', temperatureK: null, precipitationKgM2: 0.1 },
  ]);
  assert.deepEqual(result.issues, ['temperature-values-missing']);
  assert.deepEqual(result.provenance, before); assert.deepEqual(context, before); assert.deepEqual([...input], original);
  for (const value of [result, result.station, result.units, result.periods, ...result.periods, result.issues, result.provenance]) assert.ok(Object.isFrozen(value));
  input.fill(0); context.expectedStationId = '99999';
  assert.equal(result.station.description, 'SYNTHETIC café 北 🌱'); assert.deepEqual(result.provenance, before);
});

for (const declaration of ['', '<?xml version="1.0"?>', '<?xml version="1.0" encoding="uTf-8"?>']) {
  test('UTF-8 remains authoritative with declaration ' + JSON.stringify(declaration), () => {
    const plain = utf8(fixture(undefined, declaration));
    assert.deepEqual(ready(plain), ready(utf8(fixture())));
    const bom = new Uint8Array(plain.length + 3); bom.set([0xef, 0xbb, 0xbf]); bom.set(plain, 3);
    assert.deepEqual(ready(bom), ready(plain));
  });
}

for (const label of ['ISO-8859-1', 'iso-8859-1', 'IsO-8859-1']) {
  test('declared ' + label + ' keeps true Latin-1 bytes including C1 controls rather than Windows-1252 substitutions', () => {
    const text = 'SYNTHETIC café \u0085 \u0080 \u0091';
    const result = ready(latinBytes(fixture(text, '<?xml version="1.0" encoding="' + label + '"?>')));
    assert.equal(result.station.description, text);
    assert.ok(!result.station.description!.includes('…')); assert.ok(!result.station.description!.includes('€'));
  });
}

test('ASCII bodies with the actual ISO-8859-1 declaration remain compatible without inferring another byte encoding', () => {
  const result = ready(utf8(fixture('SYNTHETIC ASCII station', '<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>')));
  assert.equal(result.station.description, 'SYNTHETIC ASCII station');
});

test('a Latin-1 declaration remains authoritative even when its bytes also look like valid UTF-8', () => {
  const input = utf8(fixture('café', '<?xml version="1.0" encoding="ISO-8859-1"?>'));
  assert.equal(ready(input).station.description, 'caf\u00c3\u00a9');
});

test('Node buffers, offset views, genuine subclasses and another realm are detached without constructor or iterator hooks', () => {
  const bytes = utf8(fixture());
  assert.deepEqual(ready(Buffer.from(bytes)), ready(bytes));
  const backing = new Uint8Array(bytes.length + 8); backing.set(bytes, 4);
  assert.deepEqual(ready(new Uint8Array(backing.buffer, 4, bytes.length)), ready(bytes));
  class ByteSubclass extends Uint8Array {}
  assert.deepEqual(ready(new ByteSubclass(bytes)), ready(bytes));
  const otherRealm = runInNewContext('new Uint8Array(' + JSON.stringify([...bytes]) + ')');
  assert.deepEqual(ready(otherRealm), ready(bytes));
});

test('ordinary byte-view property getters and custom hooks never execute or alter the input snapshot', () => {
  const input = utf8(fixture()), before = [...input]; let calls = 0;
  const get = () => { calls++; throw Error('ordinary input getter must not run'); };
  for (const key of ['constructor', 'length', 'byteLength', 'buffer', 'byteOffset', 'toJSON', 'valueOf', 'toString']) Object.defineProperty(input, key, { get });
  Object.defineProperty(input, Symbol.iterator, { get });
  Object.defineProperty(input, Symbol.toStringTag, { get });
  assert.equal(ready(input).station.id, 'A051');
  assert.deepEqual(Array.from(Uint8Array.prototype.values.call(input)), before); assert.equal(calls, 0);
});

test('invalid source context fails before reflecting on unsafe byte input, with zero ordinary source getter calls', () => {
  let inputCalls = 0, sourceCalls = 0;
  const unsafeInput = new Proxy({}, { get() { inputCalls++; throw Error('input get'); }, ownKeys() { inputCalls++; throw Error('input keys'); } });
  const unsafeSource = Object.defineProperty({}, 'providerId', { enumerable: true, get() { sourceCalls++; throw Error('source getter'); } });
  held(unsafeInput, 'invalid-provenance', unsafeSource);
  assert.equal(inputCalls, 0); assert.equal(sourceCalls, 0);
  const result = decodeDwdMosmixKmlBytes(unsafeInput, unsafeSource);
  assert.equal(result.provenance, null);
});

test('non-byte values, forged views, proxies, empty, detached and shared buffers are held without ordinary coercion', () => {
  let calls = 0;
  const fake = { get length() { calls++; return 1; }, get byteLength() { calls++; return 1; }, valueOf() { calls++; return 1; }, toString() { calls++; return 'xml'; } };
  const values: unknown[] = [null, undefined, 1, 'xml', {}, [], new ArrayBuffer(4), new DataView(new ArrayBuffer(4)), new Uint16Array(4), new Uint8ClampedArray(4),
    Object.create(Uint8Array.prototype), fake, new Proxy(utf8(fixture()), { get() { calls++; throw Error('proxy'); } }), new Uint8Array(), new Uint8Array(new SharedArrayBuffer(8))];
  const detached = new Uint8Array(8); structuredClone(detached.buffer, { transfer: [detached.buffer] }); values.push(detached);
  for (const input of values) held(input, 'invalid-byte-input');
  assert.equal(calls, 0);
});

for (const bytes of [[0xc0, 0xaf], [0xc3], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0x80], [0xe2, 0x82]]) {
  test('invalid or truncated UTF-8 never becomes replacement text: ' + bytes.join('-'), () => {
    const [before, after] = fixture('__BAD_BYTES__').split('__BAD_BYTES__');
    const prefix = utf8(before), suffix = utf8(after);
    const input = new Uint8Array(prefix.length + bytes.length + suffix.length);
    input.set(prefix); input.set(bytes, prefix.length); input.set(suffix, prefix.length + bytes.length);
    held(input, 'invalid-byte-encoding');
  });
}

test('encoding-looking body or comment text cannot change the default UTF-8 declaration choice', () => {
  const text = 'encoding="ISO-8859-1" café 北';
  assert.equal(ready(utf8(fixture(text, ''))).station.description, text);
  assert.equal(ready(utf8(fixture(text, '<!-- encoding="ISO-8859-1" -->'))).station.description, text);
});

test('legacy bytes cannot trigger a Latin-1 fallback when no encoding was declared', () => {
  held(latinBytes(fixture('café', '')), 'invalid-byte-encoding');
});

for (const signature of [[0xff, 0xfe], [0xfe, 0xff], [0, 0, 0xfe, 0xff], [0xff, 0xfe, 0, 0], [0, 0, 0xff, 0xfe],
  [0, 0, 0, 0x3c], [0x3c, 0, 0, 0], [0, 0, 0x3c, 0], [0, 0x3c, 0, 0x3f], [0x3c, 0, 0x3f, 0]]) {
  test('UTF-16 or UTF-32 signature is outside the byte profile: ' + signature.join('-'), () => { held(Uint8Array.from(signature), 'unsupported-encoding'); });
}

for (const label of ['UTF-16', 'UTF-16LE', 'UTF-32', 'Windows-1252', 'US-ASCII', 'Shift_JIS']) {
  test('a declared unsupported encoding is held: ' + label, () => { held(utf8(fixture('ASCII', '<?xml version="1.0" encoding="' + label + '"?>')), 'unsupported-encoding'); });
}

test('a UTF-8 BOM cannot silently override a contradictory Latin-1 declaration', () => {
  const bytes = latinBytes(fixture('ASCII', '<?xml version="1.0" encoding="ISO-8859-1"?>'));
  const input = new Uint8Array(bytes.length + 3); input.set([0xef, 0xbb, 0xbf]); input.set(bytes, 3);
  held(input, 'unsupported-encoding');
});

test('decoding does not strip a signature and then admit a second BOM as an allowed XML prefix', () => {
  for (const declaration of ['', '<?xml version="1.0" encoding="UTF-8"?>']) {
    const bytes = utf8(fixture('ASCII', declaration));
    const input = new Uint8Array(bytes.length + 6); input.set([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf]); input.set(bytes, 6);
    held(input);
  }
});

for (const declaration of [
  '<?xml version="1.0" encoding="UTF-8" encoding="UTF-8"?>', '<?xml encoding="ISO-8859-1" version="1.0"?>',
  '<?xml version="1.0" other="encoding=\'ISO-8859-1\'"?>', '<?xml version="1.0" encoding=ISO-8859-1?>',
  '<?xml version="1.0" encoding="UTF-8\'?>', '<?xml version="1.1"?>', '<?XML version="1.0"?>',
  ' <?xml version="1.0"?>', '<?xml version="1.0" standalone="yes" encoding="ISO-8859-1"?>',
]) {
  test('encoding bootstrap never admits a declaration rejected by the existing XML authority: ' + declaration, () => { held(utf8(fixture('ASCII', declaration))); });
}

test('truncated declarations, malformed XML and changed station identity remain held by the actual decoder', () => {
  held(utf8('<?xml version="1.0" encoding="UTF-8"'));
  held(utf8(fixture().slice(0, -4)));
  held(utf8(fixture().replace('<k:name>A051</k:name>', '<k:name>A999</k:name>')), 'station-mismatch');
});

test('an exact byte ceiling remains usable while oversized input is held without changing its original bytes', () => {
  assert.ok(Object.isFrozen(DWD_MOSMIX_BYTE_LIMITS));
  const text = fixture('ASCII'), length = DWD_MOSMIX_BYTE_LIMITS.inputBytes;
  const exact = new Uint8Array(length); exact.fill(32); exact.set(utf8(text));
  assert.equal(ready(exact).station.description, 'ASCII');
  const tooLong = new Uint8Array(length + 1); tooLong.fill(32); tooLong.set(utf8(text));
  held(tooLong, 'software-bound'); assert.equal(tooLong[length], 32);
});

test('bounded declaration scanning accepts its exact ceiling and holds a longer prefix before decoding the body', () => {
  const prefix = '<?xml version="1.0"', suffix = '?>', limit = DWD_MOSMIX_BYTE_LIMITS.declarationBytes;
  const declaration = prefix + ' '.repeat(limit - prefix.length - suffix.length) + suffix;
  assert.equal(ready(utf8(fixture('ASCII', declaration))).station.description, 'ASCII');
  held(utf8(fixture('ASCII', prefix + ' '.repeat(limit - prefix.length - suffix.length + 1) + suffix)), 'software-bound');
});

test('an empty stream snapshot fits a zero remaining budget while the complete XML consumer still holds empty input', () => {
  const input = new Uint8Array();
  const result = snapshotDwdMosmixBytes(input, 0);
  assert.ok(result instanceof Uint8Array); assert.equal(result.byteLength, 0); assert.notEqual(result, input);
  held(input, 'invalid-byte-input');
  assert.equal(snapshotDwdMosmixBytes(new Uint8Array([1]), 0), 'software-bound');
});

test('an exact remaining-byte budget snapshots the view and never exposes either side to later buffer reuse', () => {
  const input = new Uint8Array([1, 2, 3]);
  const result = snapshotDwdMosmixBytes(input, 3);
  assert.ok(result instanceof Uint8Array); assert.notEqual(result, input); assert.notEqual(result.buffer, input.buffer);
  input.fill(9); assert.deepEqual([...result], [1, 2, 3]);
  result.fill(7); assert.deepEqual([...input], [9, 9, 9]);
  assert.equal(snapshotDwdMosmixBytes(input, 2), 'software-bound');
});

test('a shadowed byteLength cannot hide an oversized chunk from a remaining-budget snapshot', () => {
  let reads = 0;
  const input = new Uint8Array([1, 2, 3]);
  Object.defineProperty(input, 'byteLength', { get() { reads++; return 1; } });
  assert.equal(snapshotDwdMosmixBytes(input, 2), 'software-bound');
  assert.equal(reads, 0); assert.deepEqual(Array.from(Uint8Array.prototype.values.call(input)), [1, 2, 3]);
});

test('an invalid snapshot budget cannot allocate or inspect an unsafe supplied value', () => {
  let reads = 0;
  const input = new Proxy({}, { get() { reads++; throw Error('ordinary getter'); }, ownKeys() { reads++; throw Error('reflection'); } });
  for (const maxBytes of [NaN, Infinity, -1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(snapshotDwdMosmixBytes(input, maxBytes), 'software-bound');
  }
  assert.equal(reads, 0);
});

test('empty shared and detached buffers cannot masquerade as safe empty stream chunks', () => {
  assert.equal(snapshotDwdMosmixBytes(new Uint8Array(new SharedArrayBuffer(0)), 0), 'invalid-byte-input');
  const detached = new Uint8Array(0); structuredClone(detached.buffer, { transfer: [detached.buffer] });
  assert.equal(snapshotDwdMosmixBytes(detached, 0), 'invalid-byte-input');
});
