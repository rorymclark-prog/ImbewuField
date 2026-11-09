import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeDwdMosmixKml, DWD_MOSMIX_LIMITS, type DwdMosmixResult } from '../lib/international/providers/dwd-mosmix-reference.ts';

// Every XML string below is synthetic. Literal namespaces, source element names,
// official endpoint spelling and expected units are independent contract controls;
// only engineering-bound construction reads implementation constants.
const KML = 'http://www.opengis.net/kml/2.2';
const DWD = 'https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd';
const first = '2024-02-29T12:00:00.123Z', second = '2024-02-29T13:00:00.456Z';
const issued = '2024-02-29T11:00:00.789Z';
const provenance = () => ({ providerId: 'dwd-mosmix-station-reference',
  endpoint: 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/01234/kml/MOSMIX_L_LATEST_01234.kmz',
  fetchedAt: '2001-02-03T04:05:06.321Z', expectedStationId: '01234', kind: 'public-station', referenceOnly: true });
interface FixtureOptions {
  station?: string; description?: string | null; product?: string; issue?: string;
  times?: readonly string[]; marker?: string; temperature?: string | null; precipitation?: string | null;
  extraSeries?: string; rootAttributes?: string; documentExtra?: string;
}
function series(name: string, values: string): string {
  return '<m:Forecast m:elementName="' + name + '"><m:value>' + values + '</m:value></m:Forecast>';
}
function fixture(options: FixtureOptions = {}): string {
  const times = options.times ?? [first, second];
  const temperature = options.temperature === undefined ? '273.15 260.5' : options.temperature;
  const precipitation = options.precipitation === undefined ? '0.00 0.10' : options.precipitation;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<k:kml xmlns:k="' + KML + '" xmlns:m="' + DWD + '"' + (options.rootAttributes ?? '') + '>',
    '<k:Document><k:ExtendedData><m:ProductDefinition>',
    '<m:ProductID>' + (options.product ?? 'MOSMIX') + '</m:ProductID>',
    '<m:IssueTime>' + (options.issue ?? issued) + '</m:IssueTime>',
    '<m:ForecastTimeSteps>' + times.map(time => '<m:TimeStep>' + time + '</m:TimeStep>').join('') + '</m:ForecastTimeSteps>',
    '<m:FormatCfg><m:DefaultUndefSign>' + (options.marker ?? '-') + '</m:DefaultUndefSign></m:FormatCfg>',
    '</m:ProductDefinition></k:ExtendedData><k:Placemark>',
    '<k:name>' + (options.station ?? '01234') + '</k:name>',
    options.description === null ? '' : '<k:description>' + (options.description ?? 'SYNTHETIC parser station') + '</k:description>',
    '<k:ExtendedData>', temperature === null ? '' : series('TTT', temperature),
    precipitation === null ? '' : series('RR1c', precipitation), options.extraSeries ?? '',
    '</k:ExtendedData></k:Placemark>', options.documentExtra ?? '', '</k:Document></k:kml>',
  ].join('\n');
}
function ready(xml = fixture(), source: unknown = provenance()): Extract<DwdMosmixResult, { status: 'available' | 'partial' }> {
  const result = decodeDwdMosmixKml(xml, source);
  assert.notEqual(result.status, 'failed', 'the independent valid control must reach the actual decoder');
  if (result.status === 'failed') throw Error('Valid synthetic KML was held: ' + result.reason);
  return result;
}
function held(xml: unknown, reason?: string, source: unknown = provenance()) {
  const result = decodeDwdMosmixKml(xml, source); assert.equal(result.status, 'failed');
  if (result.status !== 'failed') throw Error('Damaged synthetic KML unexpectedly admitted');
  if (reason) assert.equal(result.reason, reason);
  assert.ok(Object.isFrozen(result)); return result;
}
function deepFrozen(value: unknown): void {
  if (value && typeof value === 'object') {
    assert.ok(Object.isFrozen(value)); for (const child of Object.values(value)) deepFrozen(child);
  }
}

test('a real parser returns only native Kelvin and preceding-hour kg/m2 values with exact source instants', () => {
  const input = fixture(), source = provenance(), before = { ...source }, result = ready(input, source);
  assert.equal(result.status, 'available'); assert.deepEqual(result.issues, []);
  assert.deepEqual(result.station, { id: '01234', description: 'SYNTHETIC parser station' });
  assert.equal(result.issuedAt, '2024-02-29T11:00:00.789Z');
  assert.deepEqual(result.units, { temperature: 'K', precipitation: 'kg/m2' });
  assert.deepEqual(result.periods, [
    { validAt: '2024-02-29T12:00:00.123Z', temperatureK: 273.15, precipitationKgM2: 0 },
    { validAt: '2024-02-29T13:00:00.456Z', temperatureK: 260.5, precipitationKgM2: 0.1 },
  ]);
  assert.equal(Object.is(result.periods[0].precipitationKgM2, 0), true, 'a recorded dry value must not become unknown');
  assert.deepEqual(Object.keys(result).sort(), ['status', 'station', 'issuedAt', 'units', 'periods', 'issues', 'provenance'].sort());
  assert.deepEqual(Object.keys(result.periods[0]).sort(), ['validAt', 'temperatureK', 'precipitationKgM2'].sort(), 'no invented interval, probability, min/max/monthly or crop fields');
  assert.deepEqual(result.provenance, before); assert.notEqual(result.provenance, source); assert.deepEqual(source, before);
  source.expectedStationId = '99999'; source.fetchedAt = '2099-01-01T00:00:00.000Z';
  assert.deepEqual(result.provenance, before); assert.deepEqual(decodeDwdMosmixKml(input, before), result);
  deepFrozen(result);
  assert.throws(() => { (result.periods as unknown[]).push({}); }, TypeError);
});

for (const [label, xml] of [
  ['prefix aliases', fixture().replaceAll('xmlns:k=', 'xmlns:geo=').replaceAll('k:', 'geo:').replaceAll('xmlns:m=', 'xmlns:wx=').replaceAll('m:', 'wx:')],
  ['KML default namespace', fixture().replace('xmlns:k="' + KML + '"', 'xmlns="' + KML + '"').replace(/(<\/?)(?:k:)/g, '$1')],
  ['DWD default namespace with separately qualified attributes', fixture().replace('xmlns:m="' + DWD + '"', 'xmlns="' + DWD + '" xmlns:field="' + DWD + '"').replaceAll('m:elementName', 'field:elementName').replace(/(<\/?)(?:m:)/g, '$1')],
  ['attribute namespace alias', fixture({ rootAttributes: ' xmlns:field="' + DWD + '"' }).replaceAll('m:elementName', 'field:elementName')],
] as const) test('expanded namespace identity survives ' + label, () => {
  assert.deepEqual(ready(xml), ready());
});

test('configured unknowns remain null while real zeros and numeric exponents remain observations', () => {
  const result = ready(fixture({ marker: '?', temperature: '? 2.605e2', precipitation: '0 ?' }));
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.issues, ['temperature-values-missing', 'precipitation-values-missing']);
  assert.deepEqual(result.periods.map(row => [row.temperatureK, row.precipitationKgM2]), [[null, 0], [260.5, null]]);
  const dash = ready(fixture({ temperature: '- -1', precipitation: '0e-9999 -' }));
  assert.deepEqual(dash.periods.map(row => [row.temperatureK, row.precipitationKgM2]), [[null, 0], [-1, null]], 'the marker matches the complete token, not a negative-number prefix');
  deepFrozen(result); deepFrozen(dash);
});

test('a digit configured as undefined is authoritative without erasing other numeric zero spellings', () => {
  const result = ready(fixture({ marker: '0', precipitation: '0 0.00' }));
  assert.equal(result.status, 'partial'); assert.deepEqual(result.periods.map(row => row.precipitationKgM2), [null, 0]);
  assert.deepEqual(result.issues, ['precipitation-values-missing']);
});

for (const [absent, options, issue] of [
  ['temperature', { temperature: null }, 'missing-temperature-series'],
  ['precipitation', { precipitation: null }, 'missing-precipitation-series'],
] as const) test('missing ' + absent + ' is visible partial data and never a substitute series', () => {
  const result = ready(fixture(options)); assert.equal(result.status, 'partial'); assert.deepEqual(result.issues, [issue]);
  assert.deepEqual(result.periods.map(row => absent === 'temperature' ? row.temperatureK : row.precipitationKgM2), [null, null]);
});

test('RR1 is neither a substitute for RR1c nor a precipitation probability', () => {
  const result = ready(fixture({ precipitation: null, extraSeries: series('RR1', '75 80') }));
  assert.equal(result.status, 'partial'); assert.deepEqual(result.issues, ['missing-precipitation-series']);
  assert.deepEqual(result.periods.map(row => row.precipitationKgM2), [null, null]);
  held(fixture({ temperature: null, precipitation: null, extraSeries: series('RR1', '75 80') }), 'no-supported-series');
  held(fixture({ temperature: null, precipitation: null }), 'no-supported-series');
});

test('raw source instants are retained without freshness, one-hour-spacing or inferred start boundaries', () => {
  const times = ['2040-02-29T12:00:00.123Z', '2040-03-01T18:31:02.456Z'];
  const result = ready(fixture({ times, issue: '2099-01-01T00:00:00.000Z', description: null }));
  assert.deepEqual(result.periods.map(row => row.validAt), times); assert.equal(result.issuedAt, '2099-01-01T00:00:00.000Z');
  assert.equal(result.station.description, null); assert.equal(result.provenance.fetchedAt, '2001-02-03T04:05:06.321Z');
  assert.equal(result.status, 'available', 'the pure decoder is not a clock, horizon or cadence policy');
});

test('ordinary XML escapes, valid character references, comments and CDATA are parsed as text', () => {
  const escaped = ready(fixture({ description: 'SYNTHETIC &amp; &#65;&#x42; &lt;x&gt; &quot;q&quot; &apos;s&apos;' }));
  assert.equal(escaped.station.description, 'SYNTHETIC & AB <x> "q" \'s\'');
  const literal = ready(fixture({ description: '<![CDATA[&AMP; <!DOCTYPE literal>]]>', documentExtra: '<!-- <!DOCTYPE not-markup> -->' }));
  assert.equal(literal.station.description, '&AMP; <!DOCTYPE literal>');
});

for (const [label, change] of [
  ['wrong KML namespace', (xml: string) => xml.replaceAll(KML, 'urn:synthetic:wrong-kml')],
  ['wrong DWD namespace', (xml: string) => xml.replaceAll(DWD, 'urn:synthetic:wrong-dwd')],
  ['unqualified selected attribute', (xml: string) => xml.replaceAll('m:elementName', 'elementName')],
  ['wrong selected attribute namespace', (xml: string) => xml.replaceAll('m:elementName', 'k:elementName')],
  ['wrong Forecast element namespace', (xml: string) => xml.replaceAll('m:Forecast ', 'k:Forecast ').replaceAll('</m:Forecast>', '</k:Forecast>')],
  ['wrong value namespace', (xml: string) => xml.replaceAll('m:value', 'k:value')],
  ['wrong IssueTime namespace', (xml: string) => xml.replaceAll('m:IssueTime', 'k:IssueTime')],
  ['wrong timestep namespace', (xml: string) => xml.replaceAll('m:TimeStep', 'k:TimeStep')],
  ['unbound QName prefix', (xml: string) => xml.replace('xmlns:m=', 'xmlns:unused=')],
  ['invalid attribute QName', (xml: string) => xml.replace('m:elementName="TTT"', 'm::elementName="TTT"')],
  ['invalid element QName', (xml: string) => xml.replaceAll('m:ProductID', 'm:bad:ProductID')],
] as const) test('namespace/QName damage is rejected: ' + label, () => void held(change(fixture())));

for (const [label, xml] of [
  ['duplicate unselected root attribute', fixture({ rootAttributes: ' foo="one" foo="two"' })],
  ['duplicate unselected metadata attribute', fixture().replace('<m:ProductID>', '<m:ProductID foo="one" foo="two">')],
  ['aliased duplicate unselected metadata attribute', fixture({ rootAttributes: ' xmlns:alias="' + DWD + '"' }).replace('<m:IssueTime>', '<m:IssueTime m:foo="one" alias:foo="two">')],
  ['raw repeated attribute', fixture().replace('m:elementName="TTT"', 'm:elementName="TTT" m:elementName="TTT"')],
  ['raw conflicting attribute', fixture().replace('m:elementName="TTT"', 'm:elementName="TTT" m:elementName="RR1c"')],
  ['aliased expanded-name duplicate', fixture({ rootAttributes: ' xmlns:alias="' + DWD + '"' }).replace('m:elementName="TTT"', 'm:elementName="TTT" alias:elementName="TTT"')],
  ['unquoted selected attribute', fixture().replace('m:elementName="TTT"', 'm:elementName=TTT')],
  ['mismatched close', fixture().replace('</m:IssueTime>', '</m:ProductID>')],
  ['truncated document', fixture().slice(0, -12)],
  ['second root', fixture() + '<kml xmlns="' + KML + '"/>'],
  ['text outside root', 'not XML text' + fixture()],
] as const) test('actual parser refuses ambiguous or malformed XML: ' + label, () => void held(xml));

for (const [label, xml] of [
  ['external DTD', fixture().replace('?>', '?><!DOCTYPE k:kml SYSTEM "https://example.invalid/synthetic.dtd">')],
  ['internal ENTITY', fixture().replace('?>', '?><!DOCTYPE k:kml [<!ENTITY x "synthetic">]>').replace('SYNTHETIC parser station', '&x;')],
  ['standalone ENTITY', fixture().replace('?>', '?><!ENTITY x "synthetic">')],
  ['lowercase DTD', fixture().replace('?>', '?><!doctype k:kml>')],
  ['processing instruction', fixture().replace('?>', '?><synthetic><?other data?></synthetic>')],
  ['second declaration', fixture().replace('?>', '?><?xml version="1.0"?>')],
] as const) test('DTD/entity/processing-instruction input never activates a resolver: ' + label, () => void held(xml));

for (const entity of ['&AMP;', '&LT;', '&QUOT;', '&unknown;', '&#X41;', '&#0;', '&#xD800;', '&#x110000;', '&#xFFFE;', '&#-1;', '&#xZZ;', '&#;', '&amp', '&']) {
  test('non-XML or invalid character reference is held: ' + entity, () => void held(fixture({ description: entity })));
}
for (const character of ['\u0000', '\u0001', '\u000b', '\ud800', '\udfff', '\ufffe']) {
  test('invalid raw XML character is held: ' + character.charCodeAt(0).toString(16), () => void held(fixture({ description: character }), 'unsafe-xml'));
}

for (const [label, xml] of [
  ['wrong product', fixture({ product: 'ICON_MOS' })], ['wrong station', fixture({ station: '99999' })],
  ['station whitespace', fixture({ station: '01 234' })],
  ['wrong root local name', fixture().replaceAll('k:kml', 'k:Folder')],
  ['product under wrong parent', fixture().replace('<k:ExtendedData><m:ProductDefinition>', '<k:Folder><m:ProductDefinition>').replace('</m:ProductDefinition></k:ExtendedData>', '</m:ProductDefinition></k:Folder>')],
  ['station under wrong parent', fixture().replace('<k:Placemark>', '<k:Folder><k:Placemark>').replace('</k:Placemark>', '</k:Placemark></k:Folder>')],
  ['extra station', fixture({ documentExtra: '<k:Placemark><k:name>99999</k:name></k:Placemark>' })],
  ['extra document', fixture().replace('</k:kml>', '<k:Document/></k:kml>')],
  ['duplicate ProductID', fixture().replace('</m:ProductID>', '</m:ProductID><m:ProductID>MOSMIX</m:ProductID>')],
  ['duplicate IssueTime', fixture().replace('</m:IssueTime>', '</m:IssueTime><m:IssueTime>' + issued + '</m:IssueTime>')],
  ['duplicate time container', fixture().replace('</m:ForecastTimeSteps>', '</m:ForecastTimeSteps><m:ForecastTimeSteps/>')],
  ['duplicate format metadata', fixture().replace('</m:FormatCfg>', '</m:FormatCfg><m:FormatCfg><m:DefaultUndefSign>-</m:DefaultUndefSign></m:FormatCfg>')],
  ['duplicate marker', fixture().replace('</m:DefaultUndefSign>', '</m:DefaultUndefSign><m:DefaultUndefSign>-</m:DefaultUndefSign>')],
  ['duplicate station name', fixture().replace('</k:name>', '</k:name><k:name>01234</k:name>')],
  ['duplicate station description', fixture().replace('</k:description>', '</k:description><k:description>SYNTHETIC</k:description>')],
  ['nested metadata value', fixture({ issue: '<m:IssueTime>' + issued + '</m:IssueTime>' })],
] as const) test('structural ambiguity cannot pick a convenient station or metadata row: ' + label, () => void held(xml));

for (const time of [
  '2023-02-29T12:00:00.000Z', '2024-02-30T12:00:00.000Z', '2024-04-31T12:00:00.000Z',
  '2024-02-29T24:00:00.000Z', '2024-02-29T12:60:00.000Z', '2024-02-29T12:00:60.000Z',
  '2024-02-29T12:00:00Z', '2024-02-29T12:00:00.000+00:00', '2024-02-29', 'not-a-date',
]) test('invalid calendar or noncanonical raw instant holds both source issue and validity: ' + time, () => {
  held(fixture({ issue: time }), 'invalid-timestamps'); held(fixture({ times: [time, second] }), 'invalid-timestamps');
});
for (const [label, times] of [['duplicate', [first, first]], ['reordered', [second, first]], ['empty', []]] as const) {
  test(label + ' timestep evidence is rejected without dropping or sorting rows', () => void held(fixture({ times }), 'invalid-timestamps'));
}

test('foreign timestep children are not ignored to make series alignment appear complete', () => {
  held(fixture().replace('</m:ForecastTimeSteps>', '<k:TimeStep>' + second + '</k:TimeStep></m:ForecastTimeSteps>'), 'invalid-timestamps');
});
for (const [label, options] of [
  ['duplicate selected series', { extraSeries: series('TTT', '273.15 260.5') }],
  ['duplicate other series', { extraSeries: series('UNUSED', '0 0') + series('UNUSED', '0 0') }],
  ['short temperature', { temperature: '273.15' }], ['long temperature', { temperature: '273.15 260.5 250' }],
  ['blank temperature', { temperature: '' }], ['short precipitation', { precipitation: '0' }],
  ['long precipitation', { precipitation: '0 0.1 0.2' }], ['blank precipitation', { precipitation: '' }],
  ['unexpected unknown marker', { temperature: '? 260.5' }],
] as const) test('series damage is never repaired with invented values: ' + label, () => void held(fixture(options)));

test('multiple value children and nested value markup cannot replace a single source series', () => {
  held(fixture().replace('</m:value>', '</m:value><m:value>273.15 260.5</m:value>'));
  held(fixture({ temperature: '<m:value>273.15 260.5</m:value>' }));
});
for (const token of ['NaN', 'INF', 'Infinity', '-Infinity', '1e309', '-1e309', '1e-9999', '-1e-9999', 'null', 'true', '0x10', '1,5', '1_000', '12mm', '1e', '--1', '.']) {
  test('nonfinite, coercible or underflowing token cannot become a forecast observation: ' + token, () => {
    held(fixture({ temperature: token + ' 260.5' }), 'invalid-values');
    held(fixture({ precipitation: '0 ' + token }), 'invalid-values');
  });
}
for (const marker of ['', '  ', '??', 'ab']) test('unsupported configured marker is held: ' + JSON.stringify(marker), () => void held(fixture({ marker }), 'unsupported-profile'));

test('untrusted XML/provenance objects never invoke getters, coercion or JSON hooks', () => {
  let getters = 0, coercions = 0, jsonCalls = 0;
  const xml = { toString() { coercions++; return fixture(); }, toJSON() { jsonCalls++; return fixture(); } };
  held(xml, 'invalid-xml-input'); held(new String(fixture()), 'invalid-xml-input');
  const source = Object.defineProperty(provenance(), 'endpoint', { enumerable: true, get() { getters++; return provenance().endpoint; } });
  const failed = held(fixture(), 'invalid-provenance', source); assert.equal(failed.provenance, null);
  held(fixture(), 'invalid-provenance', { ...provenance(), toJSON() { jsonCalls++; return provenance(); } });
  assert.equal(getters, 0); assert.equal(coercions, 0); assert.equal(jsonCalls, 0);
});

function generatedSteps(count: number): string[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.UTC(2024, 0, 1) + i * 3600000).toISOString());
}
test('the step bound admits its complete synthetic boundary and holds the next aligned series', () => {
  const count = DWD_MOSMIX_LIMITS.timeSteps;
  assert.equal(ready(fixture({ times: generatedSteps(count), temperature: Array(count).fill('273.15').join(' '), precipitation: Array(count).fill('0').join(' ') })).periods.length, count);
  held(fixture({ times: generatedSteps(count + 1), temperature: Array(count + 1).fill('273.15').join(' '), precipitation: Array(count + 1).fill('0').join(' ') }), 'software-bound');
});
test('series count is bounded even when extra meteorological elements are not selected', () => {
  const extras = (count: number) => Array.from({ length: count }, (_, i) => series('SYNTHETIC_' + i, '0 0')).join('');
  assert.equal(ready(fixture({ extraSeries: extras(DWD_MOSMIX_LIMITS.series - 2) })).status, 'available');
  held(fixture({ extraSeries: extras(DWD_MOSMIX_LIMITS.series - 1) }), 'software-bound');
});
test('numeric token length cannot bypass the budget by spelling a long finite zero', () => {
  held(fixture({ precipitation: '0 ' + '0'.repeat(DWD_MOSMIX_LIMITS.numericTokenCodeUnits + 1) }), 'invalid-values');
});
test('text, depth, attributes, element and per-field budgets hold otherwise ignorable XML', () => {
  held(fixture() + ' '.repeat(DWD_MOSMIX_LIMITS.textCodeUnits + 1), 'software-bound');
  held(fixture({ documentExtra: '<k:Folder>'.repeat(DWD_MOSMIX_LIMITS.depth) + '</k:Folder>'.repeat(DWD_MOSMIX_LIMITS.depth) }), 'software-bound');
  const attrs = Array.from({ length: DWD_MOSMIX_LIMITS.attributesPerElement + 1 }, (_, i) => ' synthetic' + i + '="x"').join('');
  held(fixture({ rootAttributes: attrs }), 'software-bound');
  held(fixture({ documentExtra: '<k:Folder/>'.repeat(DWD_MOSMIX_LIMITS.elements + 1) }), 'software-bound');
  const field = '<k:Folder>' + Array.from({ length: Math.ceil((DWD_MOSMIX_LIMITS.fieldCodeUnits + 1) / 1024) }, () => '<![CDATA[' + 'x'.repeat(1024) + ']]>').join('') + '</k:Folder>';
  held(fixture({ documentExtra: field }), 'software-bound');
  held(fixture({ description: 'x'.repeat(257) }), 'software-bound');
});

test('the supported XML declaration retains encoding and standalone without decoding or converting units', () => {
  const xml = fixture().replace('<?xml version="1.0" encoding="UTF-8"?>', '<?xml version="1.0" encoding="ISO-8859-1" standalone="yes"?>');
  assert.deepEqual(ready(xml), ready());
  assert.deepEqual(ready('\ufeff' + xml), ready(), 'one optional BOM preserves the actual supported ISO declaration');
  const spaced = fixture().replace('<?xml version="1.0" encoding="UTF-8"?>', "<?xml version = '1.0'\tencoding = 'UTF-8'\nstandalone = 'no' ?>");
  assert.deepEqual(ready(spaced), ready());
});
for (const declaration of [
  '<?xml bogus="x" version="1.0"?>', '<?xml version="1.0" version="1.0"?>',
  '<?xml version="1.0" unknown="x"?>', '<?xml encoding="UTF-8" version="1.0"?>',
  '<?xml version="1.0" standalone="yes" encoding="UTF-8"?>',
  '<?xml version="1.0" encoding="UTF-8" encoding="UTF-8"?>',
  '<?xml version="1.0" standalone="yes" standalone="no"?>',
  '<?xml version="1.0" standalone="maybe"?>', '<?xml version="1.1"?>',
  '<?xml version="1.0"encoding="UTF-8"?>', '<?XML version="1.0"?>',
]) test('unsupported XML declaration is held as a complete declaration, not accepted by substring: ' + declaration, () => {
  held(fixture().replace('<?xml version="1.0" encoding="UTF-8"?>', declaration));
});
for (const input of [undefined, null, '', 0, true, [], {}, Symbol('xml'), () => fixture()]) {
  test('nonstring or empty XML input stays held without coercion: ' + typeof input, () => void held(input, 'invalid-xml-input'));
}

for (const prefix of [' ', '\n', '<!-- synthetic preamble -->']) test('an XML declaration cannot occur after ' + JSON.stringify(prefix), () => {
  held(prefix + fixture());
});
test('outside-root CDATA is rejected even when its text is empty or XML whitespace', () => {
  const body = fixture().replace('<?xml version="1.0" encoding="UTF-8"?>', '');
  for (const cdata of ['<![CDATA[]]>', '<![CDATA[ \t\r\n]]>']) {
    held(cdata + body); held(body + cdata);
  }
});
test('XML whitespace is accepted without silently normalizing NBSP in identity, numbers or outside-root text', () => {
  assert.deepEqual(ready(fixture({ temperature: ' \t273.15 \r\n260.5\t ', precipitation: '\r\n0.00\t0.10 ' })), ready());
  held(fixture({ temperature: '273.15\u00a0260.5' }), 'invalid-values');
  held(fixture({ temperature: '\u00a0273.15 260.5' }), 'invalid-values');
  held(fixture({ station: '\u00a001234\u00a0' }), 'station-mismatch');
  held(fixture({ product: '\u00a0MOSMIX\u00a0' }), 'unsupported-profile');
  held(fixture() + '\u00a0');
});

test('an explicitly selected alphanumeric station preserves literal identity through the real decoder', () => {
  const source = { ...provenance(), expectedStationId: 'A051',
    endpoint: 'https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/A051/kml/MOSMIX_L_LATEST_A051.kmz' };
  const result = ready(fixture({ station: 'A051' }), source);
  assert.equal(result.status, 'available'); assert.equal(result.station.id, 'A051');
  assert.deepEqual(result.provenance, source); assert.deepEqual(result.units, { temperature: 'K', precipitation: 'kg/m2' });
  assert.deepEqual(result.periods.map(row => row.precipitationKgM2), [0, 0.1]);
  held(fixture({ station: 'a051' }), 'station-mismatch', source);
  held(fixture({ station: '01234' }), 'station-mismatch', source);
  deepFrozen(result);
});
