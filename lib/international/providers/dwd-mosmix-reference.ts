import sax from 'sax';
import type { SAXOptions, QualifiedAttribute, QualifiedTag } from 'sax';
import { isGrowerRecordedAt } from '../grower-planning';
import { DWD_KML_NAMESPACE as KML, DWD_MOSMIX_NAMESPACE as DWD,
  parseDwdMosmixProvenance, type DwdMosmixProvenance } from './dwd-mosmix-request';

/** Engineering ceilings, not DWD quotas, forecast horizons or farming limits. */
export const DWD_MOSMIX_LIMITS = Object.freeze({ textCodeUnits: 2 * 1024 * 1024,
  depth: 32, attributesPerElement: 32, elements: 10_000, timeSteps: 1024,
  series: 256, fieldCodeUnits: 65_536, numericTokenCodeUnits: 64 });
export type DwdMosmixFailureReason = 'invalid-provenance' | 'invalid-xml-input' | 'software-bound'
  | 'unsafe-xml' | 'malformed-xml' | 'unsupported-profile' | 'station-mismatch'
  | 'invalid-timestamps' | 'invalid-values' | 'no-supported-series';
export type DwdMosmixIssue = 'missing-temperature-series' | 'missing-precipitation-series'
  | 'temperature-values-missing' | 'precipitation-values-missing';
export interface DwdMosmixPeriod { readonly validAt: string; readonly temperatureK: number | null;
  readonly precipitationKgM2: number | null }
export type DwdMosmixResult = Readonly<{
  status: 'failed'; reason: DwdMosmixFailureReason; provenance: Readonly<DwdMosmixProvenance> | null;
}> | Readonly<{
  status: 'available' | 'partial'; station: Readonly<{ id: string; description: string | null }>;
  issuedAt: string; units: Readonly<{ temperature: 'K'; precipitation: 'kg/m2' }>;
  periods: readonly Readonly<DwdMosmixPeriod>[]; issues: readonly DwdMosmixIssue[];
  provenance: Readonly<DwdMosmixProvenance>;
}>;
interface Element { uri: string; local: string; attributes: readonly QualifiedAttribute[];
  children: Element[]; text: string }
class DecodeError extends Error {
  readonly reason: DwdMosmixFailureReason;
  constructor(reason: DwdMosmixFailureReason) { super(reason); this.reason = reason; }
}
function stop(reason: DwdMosmixFailureReason): never { throw new DecodeError(reason); }
const QNAME = /^(?:[A-Za-z_][A-Za-z0-9_.-]*:)?[A-Za-z_][A-Za-z0-9_.-]*$/;
// XML declarations are opaque PI bodies in sax. Admit the actual XML1.0
// declaration grammar rather than searching an arbitrary body for a version.
const XML_DECLARATION = /^version[ \t\r\n]*=[ \t\r\n]*(["'])1\.0\1(?:[ \t\r\n]+encoding[ \t\r\n]*=[ \t\r\n]*(["'])[A-Za-z][A-Za-z0-9._-]*\2)?(?:[ \t\r\n]+standalone[ \t\r\n]*=[ \t\r\n]*(["'])(?:yes|no)\3)?[ \t\r\n]*$/;
function xmlCharacter(n: number): boolean {
  return n === 9 || n === 10 || n === 13 || n >= 0x20 && n <= 0xd7ff
    || n >= 0xe000 && n <= 0xfffd || n >= 0x10000 && n <= 0x10ffff;
}

/** sax accepts some non-XML entity spellings. Check the small supported profile
 * before its parser sees them; never install a DTD or an entity resolver. */
function preflight(xml: string): void {
  for (const character of xml) if (!xmlCharacter(character.codePointAt(0)!)) stop('unsafe-xml');
  for (let i = 0; i < xml.length; i++) {
    if (xml.startsWith('<!--', i) || xml.startsWith('<![CDATA[', i)) {
      const comment = xml.startsWith('<!--', i), close = comment ? '-->' : ']]>';
      const end = xml.indexOf(close, i + (comment ? 4 : 9));
      if (end < 0) stop('malformed-xml');
      i = end + close.length - 1; continue;
    }
    if (xml.startsWith('<!DOCTYPE', i) || xml.startsWith('<!ENTITY', i)) stop('unsafe-xml');
    if (xml[i] !== '&') continue;
    const end = xml.indexOf(';', i + 1);
    if (end < 0 || end - i > 32) stop('unsafe-xml');
    const token = xml.slice(i + 1, end);
    if (!['amp', 'lt', 'gt', 'apos', 'quot'].includes(token)) {
      const decimal = /^#[0-9]+$/.test(token), hex = /^#x[0-9a-fA-F]+$/.test(token);
      if (!decimal && !hex) stop('unsafe-xml');
      const code = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!xmlCharacter(code)) stop('unsafe-xml');
    }
    i = end;
  }
}

function parseTree(xml: string): Element {
  preflight(xml);
  const options: SAXOptions & { strictEntities: true; unquotedAttributeValues: false } = {
    xmlns: true, strictEntities: true, unquotedAttributeValues: false, trim: false, normalize: false,
  };
  const parser = sax.parser(true, options), stack: Element[] = [];
  const declarationAtStart = /^(?:\uFEFF)?<\?xml[ \t\r\n]/.test(xml);
  let root: Element | null = null, count = 0, ended = false, declaration = false;
  let rawAttributes = new Set<string>(), expandedAttributes = new Set<string>(), attributes: QualifiedAttribute[] = [];
  parser.onerror = () => stop('malformed-xml');
  parser.ondoctype = parser.onsgmldeclaration = () => stop('unsafe-xml');
  parser.onprocessinginstruction = node => {
    if (node.name !== 'xml' || !declarationAtStart || declaration || count !== 0
      || !XML_DECLARATION.test(node.body)) stop('unsafe-xml');
    declaration = true;
  };
  parser.onopentagstart = tag => {
    if (!QNAME.test(tag.name)) stop('unsupported-profile');
    rawAttributes = new Set(); expandedAttributes = new Set(); attributes = [];
  };
  // sax's attributes map overwrites duplicates. Its events still expose both;
  // check the raw and expanded names before consulting any map.
  parser.onattribute = raw => {
    const attribute = raw as QualifiedAttribute;
    if (!QNAME.test(attribute.name) || typeof attribute.uri !== 'string'
      || typeof attribute.local !== 'string') stop('unsupported-profile');
    const key = attribute.uri + '\u0000' + attribute.local;
    if (rawAttributes.has(attribute.name) || expandedAttributes.has(key)) stop('malformed-xml');
    rawAttributes.add(attribute.name); expandedAttributes.add(key); attributes.push(attribute);
    if (attributes.length > DWD_MOSMIX_LIMITS.attributesPerElement) stop('software-bound');
  };
  parser.onopentag = raw => {
    const tag = raw as QualifiedTag;
    if (++count > DWD_MOSMIX_LIMITS.elements || stack.length >= DWD_MOSMIX_LIMITS.depth) stop('software-bound');
    const element: Element = { uri: tag.uri, local: tag.local, attributes: [...attributes], children: [], text: '' };
    if (stack.length) stack[stack.length - 1].children.push(element);
    else if (root) stop('malformed-xml');
    else root = element;
    stack.push(element);
  };
  const text = (value: string) => {
    if (!stack.length) { if (!/^[ \t\r\n]*$/.test(value)) stop('malformed-xml'); return; }
    const element = stack[stack.length - 1]; element.text += value;
    if (element.text.length > DWD_MOSMIX_LIMITS.fieldCodeUnits) stop('software-bound');
  };
  parser.ontext = text;
  parser.onopencdata = () => { if (!stack.length) stop('malformed-xml'); };
  parser.oncdata = text;
  parser.onclosetag = () => { if (!stack.pop()) stop('malformed-xml'); };
  parser.onend = () => { ended = true; };
  // Small writes also let sax enforce its own buffers. Do not change its
  // process-global buffer settings for other consumers in the app.
  for (let i = 0; i < xml.length; i += 4096) parser.write(xml.slice(i, i + 4096));
  parser.close();
  if (!ended || stack.length || !root) stop('malformed-xml');
  return root;
}
function children(element: Element, uri: string, local: string): Element[] {
  return element.children.filter(child => child.uri === uri && child.local === local);
}
function one(element: Element, uri: string, local: string): Element {
  const found = children(element, uri, local); if (found.length !== 1) stop('unsupported-profile'); return found[0];
}
function leaf(element: Element): string {
  if (element.children.length) stop('unsupported-profile'); return element.text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
}
function numberSeries(raw: string, marker: string, count: number): (number | null)[] {
  const tokens = raw ? raw.split(/[ \t\r\n]+/) : [];
  if (tokens.length !== count) stop('invalid-values');
  return tokens.map(token => {
    if (token === marker) return null;
    if (token.length > DWD_MOSMIX_LIMITS.numericTokenCodeUnits
      || !/^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(token)) stop('invalid-values');
    const value = Number(token);
    // An underflowed nonzero value must not become an invented dry-hour zero.
    if (!Number.isFinite(value) || value === 0 && /[1-9]/.test(token.split(/[eE]/)[0])) stop('invalid-values');
    return value;
  });
}

/** Decodes an already-decoded public station KML string. No byte/ZIP/network
 * handling, station selection, freshness check, unit conversion or crop advice. */
export function decodeDwdMosmixKml(xml: unknown, source: unknown): DwdMosmixResult {
  const provenance = parseDwdMosmixProvenance(source);
  const failed = (reason: DwdMosmixFailureReason): DwdMosmixResult => Object.freeze({ status: 'failed', reason, provenance });
  if (!provenance) return failed('invalid-provenance');
  if (typeof xml !== 'string' || !xml.length) return failed('invalid-xml-input');
  if (xml.length > DWD_MOSMIX_LIMITS.textCodeUnits) return failed('software-bound');
  try {
    const root = parseTree(xml);
    if (root.uri !== KML || root.local !== 'kml') stop('unsupported-profile');
    const document = one(root, KML, 'Document');
    const all: Element[] = [], visit = (element: Element) => { all.push(element); element.children.forEach(visit); };
    visit(root);
    for (const [uri, name] of [[KML, 'Document'], [KML, 'Placemark'], [DWD, 'ProductDefinition'], [DWD, 'ForecastTimeSteps']]) {
      if (all.filter(element => element.uri === uri && element.local === name).length !== 1) stop('unsupported-profile');
    }
    const product = one(one(document, KML, 'ExtendedData'), DWD, 'ProductDefinition');
    if (leaf(one(product, DWD, 'ProductID')) !== 'MOSMIX') stop('unsupported-profile');
    const issuedAt = leaf(one(product, DWD, 'IssueTime'));
    if (!isGrowerRecordedAt(issuedAt)) stop('invalid-timestamps');
    const timeContainer = one(product, DWD, 'ForecastTimeSteps');
    const steps = children(timeContainer, DWD, 'TimeStep');
    if (!steps.length || steps.length !== timeContainer.children.length) stop('invalid-timestamps');
    if (steps.length > DWD_MOSMIX_LIMITS.timeSteps) stop('software-bound');
    const times = steps.map(leaf);
    let previous = -Infinity;
    for (const time of times) {
      if (!isGrowerRecordedAt(time) || Date.parse(time) <= previous) stop('invalid-timestamps'); previous = Date.parse(time);
    }
    const marker = leaf(one(one(product, DWD, 'FormatCfg'), DWD, 'DefaultUndefSign'));
    if ([...marker].length !== 1 || /\s/.test(marker)) stop('unsupported-profile');
    const station = one(document, KML, 'Placemark');
    const id = leaf(one(station, KML, 'name'));
    if (id !== provenance.expectedStationId) stop('station-mismatch');
    const descriptions = children(station, KML, 'description');
    if (descriptions.length > 1) stop('unsupported-profile');
    const description = descriptions.length ? leaf(descriptions[0]) : null;
    if (description && description.length > 256) stop('software-bound');
    const data = one(station, KML, 'ExtendedData');
    if (data.children.some(child => child.local === 'Forecast' && child.uri !== DWD)) stop('unsupported-profile');
    const forecasts = children(data, DWD, 'Forecast');
    if (forecasts.length > DWD_MOSMIX_LIMITS.series) stop('software-bound');
    const names = new Set<string>(); let temperature: (number | null)[] | null = null, precipitation: (number | null)[] | null = null;
    for (const forecast of forecasts) {
      const attributes = forecast.attributes.filter(attribute => attribute.uri === DWD && attribute.local === 'elementName');
      if (attributes.length !== 1 || !attributes[0].value || names.has(attributes[0].value)) stop('unsupported-profile');
      const name = attributes[0].value; names.add(name);
      if (name === 'TTT' || name === 'RR1c') {
        const values = numberSeries(leaf(one(forecast, DWD, 'value')), marker, times.length);
        if (name === 'TTT') temperature = values; else precipitation = values;
      }
    }
    if (!temperature && !precipitation) stop('no-supported-series');
    const issues: DwdMosmixIssue[] = [];
    if (!temperature) issues.push('missing-temperature-series');
    else if (temperature.some(value => value === null)) issues.push('temperature-values-missing');
    if (!precipitation) issues.push('missing-precipitation-series');
    else if (precipitation.some(value => value === null)) issues.push('precipitation-values-missing');
    const periods = times.map((validAt, index) => Object.freeze({ validAt,
      temperatureK: temperature ? temperature[index] : null, precipitationKgM2: precipitation ? precipitation[index] : null }));
    return Object.freeze({ status: issues.length ? 'partial' : 'available', station: Object.freeze({ id, description }),
      issuedAt, units: Object.freeze({ temperature: 'K', precipitation: 'kg/m2' }), periods: Object.freeze(periods),
      issues: Object.freeze(issues), provenance });
  } catch (error) { return failed(error instanceof DecodeError ? error.reason : 'malformed-xml'); }
}
