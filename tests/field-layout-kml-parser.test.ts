import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseFieldLayoutCoordinateText, parseFieldLayoutKml } from '../lib/field-layout-kml-parser.ts';
import type { FieldLayoutCoordinateParseResult, FieldLayoutKmlParseResult } from '../lib/field-layout-import.types.ts';

const KML = 'http://www.opengis.net/kml/2.2';
const triangle = '0,0 1,0 0,1 0,0';
const xml = '<kml xmlns="http://www.opengis.net/kml/2.2"/>';

function ringParsed(value: unknown) {
  const result = parseFieldLayoutCoordinateText(value);
  assert.equal(result.status, 'parsed', JSON.stringify(result));
  if (result.status !== 'parsed') throw Error('Coordinate text was held');
  return result;
}
function ringHeld(value: unknown) {
  const result: FieldLayoutCoordinateParseResult = parseFieldLayoutCoordinateText(value);
  assert.equal(result.status, 'held', typeof value === 'string' ? value.slice(0, 160) : typeof value);
  if (result.status !== 'held') throw Error('Invalid coordinate text was accepted');
  assert.equal(typeof result.reason, 'string'); assert.ok(result.reason.length);
}
function kmlParsed(value: unknown = xml) {
  const result = parseFieldLayoutKml(value);
  assert.equal(result.status, 'parsed', JSON.stringify(result));
  if (result.status !== 'parsed') throw Error('KML was held');
  return result;
}
function kmlHeld(...args: [] | [unknown]) {
  const value = args.length ? args[0] : xml;
  const result: FieldLayoutKmlParseResult = parseFieldLayoutKml(value);
  assert.equal(result.status, 'held');
  if (result.status !== 'held') throw Error('Invalid KML was accepted');
  assert.equal(typeof result.reason, 'string'); assert.ok(result.reason.length);
}

// This is a preconstructed native-DOM boundary fixture, NOT an XML parser.
// Its parser stub ignores XML and returns the supplied tree. These tests cover
// extraction/preflight only; real browser XML/namespace parsing is separate QA.
class BoundaryNode {
  nodeType: number;
  localName: string | null;
  namespaceURI: string | null;
  nodeName: string;
  childNodes: BoundaryNode[];
  parentNode: BoundaryNode | null = null;
  private data: string;
  constructor(nodeType: number, localName: string | null, children: BoundaryNode[] = [], data = '', namespaceURI: string | null = KML, prefix = '') {
    this.nodeType = nodeType; this.localName = localName; this.namespaceURI = namespaceURI;
    this.nodeName = nodeType === 3 ? '#text' : nodeType === 9 ? '#document' : `${prefix}${localName}`;
    this.childNodes = children; this.data = data;
    for (const child of children) child.parentNode = this;
  }
  get children() { return this.childNodes.filter(node => node.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; }
  // Extraction reads native text-node values and element ancestry. Mirror that
  // boundary instead of making valid coordinate text appear empty in the stub.
  get nodeValue(): string | null { return this.nodeType === 3 ? this.data : null; }
  get parentElement(): BoundaryNode | null { return this.parentNode?.nodeType === 1 ? this.parentNode : null; }
  get nextSibling(): BoundaryNode | null {
    if (!this.parentNode) return null;
    return this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null;
  }
  get textContent(): string { return this.nodeType === 3 ? this.data : this.childNodes.map(node => node.textContent).join(''); }
  set textContent(value: string) {
    this.data = value;
    this.childNodes = this.nodeType === 3 ? [] : [text(value)];
    for (const child of this.childNodes) child.parentNode = this;
  }
  getElementsByTagNameNS(namespace: string, name: string): BoundaryNode[] {
    const found: BoundaryNode[] = [], pending = [...this.childNodes];
    while (pending.length) {
      const node = pending.shift()!;
      if (node.nodeType === 1 && (namespace === '*' || node.namespaceURI === namespace)
        && (name === '*' || node.localName === name)) found.push(node);
      pending.unshift(...node.childNodes);
    }
    return found;
  }
  getElementsByTagName(name: string): BoundaryNode[] {
    return this.getElementsByTagNameNS('*', '*').filter(node => name === '*' || node.nodeName === name);
  }
}
function text(value: string) { return new BoundaryNode(3, null, [], value, null); }
function element(name: string, children: BoundaryNode[] = [], namespace = KML, prefix = '') {
  return new BoundaryNode(1, name, children, '', namespace, prefix);
}
function polygon(value = triangle) {
  return element('Polygon', [element('outerBoundaryIs', [element('LinearRing', [element('coordinates', [text(value)])])])]);
}
function placemark(children: BoundaryNode[] = [polygon()]) { return element('Placemark', children); }
function documentWith(children: BoundaryNode[] = [placemark()]) {
  const root = element('kml', [element('Document', children)]);
  return Object.assign(new BoundaryNode(9, null, [root], '', null), { documentElement: root, doctype: null as unknown });
}
function atNativeBoundary<T>(document: ReturnType<typeof documentWith>, run: (calls: { constructed: number; parsed: number }) => T): T {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  const calls = { constructed: 0, parsed: 0 };
  class FixtureDOMParser {
    constructor() { calls.constructed++; }
    parseFromString(value: string, mime: string) {
      calls.parsed++;
      assert.equal(typeof value, 'string'); assert.equal(mime, 'application/xml');
      return document;
    }
  }
  Object.defineProperty(globalThis, 'DOMParser', { configurable: true, writable: true, value: FixtureDOMParser });
  try { return run(calls); } finally {
    if (saved) Object.defineProperty(globalThis, 'DOMParser', saved);
    else Reflect.deleteProperty(globalThis, 'DOMParser');
  }
}

test('coordinate grammar accepts decimal signs/exponents and XML whitespace while discarding validated altitude', () => {
  const input = '\t+0.0,+0,1e2\n1E+0,0,-2.5\r0,+1e0,0\t0,0,+3E-2\r\n';
  assert.deepEqual(ringParsed(input).ring, [[0, 0], [1, 0], [0, 1], [0, 0]]);
  assert.deepEqual(ringParsed(triangle).ring, [[0, 0], [1, 0], [0, 1], [0, 0]]);
  assert.deepEqual(ringParsed('00,0 1.,0 .5,.5e+1 00,0').ring, [[0, 0], [1, 0], [0.5, 5], [0, 0]]);
});

test('coordinate grammar rejects empty components, implicit JavaScript numbers, nonfinite values and trailing junk', () => {
  for (const invalid of ['0x10,0', '0b10,0', 'Infinity,0', '-Infinity,0', 'NaN,0', '1e999,0',
    ',0', '0,', '0,,0', '0,0,', '0,0,NaN', '0,0,Infinity', '0,0,1e999',
    '0,0,1,2', '0,0tail', '0,0;0', '1e,0', '+,0', '0,\u00a00']) {
    ringHeld(`0,0 1,0 ${invalid} 0,1 0,0`);
  }
  ringHeld(triangle.replaceAll(' ', '\u00a0'));
  ringHeld('\u00a0' + triangle); ringHeld(triangle + '\u00a0');
});

test('longitude and latitude bounds are inclusive and validated on every tuple before geometry review', () => {
  assert.deepEqual(ringParsed('-180,-90 180,-90 180,90 -180,-90').ring,
    [[-180, -90], [180, -90], [180, 90], [-180, -90]]);
  for (const invalid of ['180.000001,0', '-180.000001,0', '0,90.000001', '0,-90.000001']) {
    ringHeld(`0,0 1,0 ${invalid} 0,0`);
  }
});

test('rings must close exactly with three distinct unclosed vertices and cannot repeat an interior vertex', () => {
  for (const invalid of ['', ' \t\r\n', '0,0 1,0 0,0', '0,0 1,0 0,1 0,0.000000001',
    '0,0 1,0 1,0 0,0', '0,0 1,0 0,1 1,0 0,0', '0,0 1,0 0,0 0,1 0,0']) ringHeld(invalid);
  // Different altitudes do not create distinct ground vertices or break closure.
  assert.deepEqual(ringParsed('0,0,1 1,0,2 0,1,3 0,0,4').ring,
    [[0, 0], [1, 0], [0, 1], [0, 0]]);
  ringHeld('0,0,1 1,0,2 0,1,3 1,0,9 0,0,4');
});

test('the parser leaves topology and dateline decisions to the later geometry authority', () => {
  assert.equal(ringParsed('0,0 1,1 0,1 1,0 0,0').ring.length, 5);
  assert.equal(ringParsed('179,0 -179,0 -179,1 179,0').ring.length, 4);
});

function boundedRing(tuples: number) {
  return [...Array.from({ length: tuples - 1 }, (_, i) => `${i / 1000},${i % 2}`), '0,0'].join(' ');
}

test('ring tuple caps hold oversized input and successful coordinate output is deeply frozen', () => {
  const exact = ringParsed(boundedRing(512)); assert.equal(exact.ring.length, 512);
  ringHeld(boundedRing(513));
  assert.ok(Object.isFrozen(exact)); assert.ok(Object.isFrozen(exact.ring));
  assert.ok(exact.ring.every(point => Object.isFrozen(point)));
  assert.throws(() => (exact.ring as unknown as number[][]).push([2, 2]), TypeError);
  assert.throws(() => { (exact.ring[0] as unknown as number[])[0] = 42; }, TypeError);
  // A long but numerically valid zero altitude must not bypass the public
  // coordinate entry's input-size bound merely because the ring has four tuples.
  ringHeld(`0,0,${'0'.repeat(1_000_001)} 1,0 0,1 0,0`);
});

test('nonstring values cannot run coercion or getters in either public parser', () => {
  let getters = 0;
  const hostile = Object.defineProperties({}, {
    length: { get() { getters++; throw Error('Unexpected length access'); } },
    toString: { get() { getters++; throw Error('Unexpected coercion'); } },
    [Symbol.toPrimitive]: { get() { getters++; throw Error('Unexpected primitive coercion'); } },
  });
  atNativeBoundary(documentWith(), calls => {
    for (const invalid of [undefined, null, 0, true, BigInt(1), Symbol('input'), [], {}, hostile, new String(xml)]) {
      ringHeld(invalid); kmlHeld(invalid);
    }
    assert.equal(getters, 0); assert.deepEqual(calls, { constructed: 0, parsed: 0 });
  });
});

test('declarations, comments, CDATA and unsupported processing instructions are held before native parsing', () => {
  atNativeBoundary(documentWith(), calls => {
    for (const invalid of [
      '<!DOCTYPE kml [<!ENTITY x "value">]>' + xml,
      '<!ENTITY x SYSTEM "urn:must-not-load">' + xml,
      '<!-- unsupported comment -->' + xml,
      '<![CDATA[unsupported]]>' + xml,
      '<?xml-stylesheet href="urn:must-not-load"?>' + xml,
      '<?other instruction?>' + xml,
      '<?XML version="1.0"?>' + xml,
      xml + '<?xml version="1.0"?>',
      '<?xml version="1.0"?><?xml version="1.0"?>' + xml,
    ]) kmlHeld(invalid);
    assert.deepEqual(calls, { constructed: 0, parsed: 0 });
  });
});

test('invalid characters and software text/markup budgets are held before allocating native XML DOM', () => {
  atNativeBoundary(documentWith(), calls => {
    for (const invalid of ['', ' \t\r\n', '\u0000' + xml, '\uffff' + xml,
      '\ud800' + xml, 'a'.repeat(1_000_001), '<'.repeat(10_001)]) kmlHeld(invalid);
    assert.deepEqual(calls, { constructed: 0, parsed: 0 });
  });
});

test('a single initial XML declaration and builtin/numeric references may reach the native application/xml boundary', () => {
  const label = element('name', [text('A & B 🌱')]);
  atNativeBoundary(documentWith([placemark([label, polygon()])]), calls => {
    const parsed = kmlParsed('<?xml version="1.0"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>A &amp; B &#x1F331;</name></Placemark></kml>');
    assert.equal(parsed.candidates[0].name, 'A & B 🌱');
    assert.deepEqual(calls, { constructed: 1, parsed: 1 });
  });
});

test('missing browser DOMParser holds cleanly instead of inventing an XML parser in Node', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  Reflect.deleteProperty(globalThis, 'DOMParser');
  try { assert.doesNotThrow(() => kmlHeld(xml)); } finally {
    if (saved) Object.defineProperty(globalThis, 'DOMParser', saved);
  }
});

test('namespace identity accepts prefixed KML but rejects wrong roots and any foreign-namespace descendants', () => {
  const prefixed = documentWith();
  for (const node of [prefixed.documentElement, ...prefixed.getElementsByTagNameNS('*', '*')]) {
    node.nodeName = `arbitrary:${node.localName}`;
  }
  atNativeBoundary(prefixed, () => assert.equal(kmlParsed().candidates.length, 1));
  const wrongRoot = documentWith(); wrongRoot.documentElement.localName = 'Document';
  atNativeBoundary(wrongRoot, () => kmlHeld());
  const wrongNamespace = documentWith(); wrongNamespace.documentElement.namespaceURI = 'urn:not-kml';
  atNativeBoundary(wrongNamespace, () => kmlHeld());
  atNativeBoundary(documentWith([placemark(), element('name', [], 'urn:foreign')]), () => kmlHeld());
});

test('native parser errors, a document type and active-resource elements never become candidates', () => {
  const typed = documentWith(); typed.doctype = { name: 'kml' };
  atNativeBoundary(typed, () => kmlHeld());
  for (const namespace of [KML, 'http://www.mozilla.org/newlayout/xml/parsererror.xml', '']) {
    atNativeBoundary(documentWith([element('parsererror', [text('invalid XML')], namespace)]), () => kmlHeld());
  }
  for (const name of ['NetworkLink', 'NetworkLinkControl', 'Model', 'GroundOverlay', 'ScreenOverlay', 'PhotoOverlay', 'href', 'script']) {
    atNativeBoundary(documentWith([placemark(), element(name)]), () => kmlHeld());
  }
  atNativeBoundary(documentWith([placemark(), new BoundaryNode(7, 'target', [], 'instruction', null)]), () => kmlHeld());
});

test('each unsupported or ambiguous Placemark is excluded once with no nested partial polygon salvage', () => {
  const withHole = polygon(); withHole.childNodes.push(element('innerBoundaryIs', [element('LinearRing', [element('coordinates', [text(triangle)])])]));
  const ambiguousOuter = polygon(); ambiguousOuter.childNodes.push(element('outerBoundaryIs', [element('LinearRing', [element('coordinates', [text(triangle)])])]));
  const ambiguousCoordinates = polygon();
  ambiguousCoordinates.children[0].children[0].childNodes.push(element('coordinates', [text(triangle)]));
  const nestedCoordinateText = polygon();
  nestedCoordinateText.children[0].children[0].childNodes = [element('coordinates', [element('name', [text(triangle)])])];
  const ambiguousOuterChildren = polygon(); ambiguousOuterChildren.children[0].childNodes.push(element('name', [text('extra')]));
  const nestedSecondPolygon = polygon(); nestedSecondPolygon.childNodes.push(polygon());
  const strayCoordinates = polygon(); strayCoordinates.childNodes.push(element('coordinates', [text(triangle)]));
  const cases = [
    placemark([element('Point')]), placemark([element('LineString')]),
    placemark([element('MultiGeometry', [polygon()])]), placemark([polygon(), element('Point')]),
    placemark([polygon(), polygon()]), placemark([withHole]), placemark([ambiguousOuter]),
    placemark([ambiguousCoordinates]), placemark([element('Folder', [polygon()])]),
    placemark([nestedCoordinateText]), placemark([ambiguousOuterChildren]),
    placemark([nestedSecondPolygon]), placemark([strayCoordinates]),
  ];
  atNativeBoundary(documentWith([...cases, placemark()]), () => {
    const parsed = kmlParsed(); assert.equal(parsed.excludedPlacemarkCount, cases.length);
    assert.equal(parsed.candidates.length, 1); assert.equal(parsed.candidates[0].id, `polygon-${cases.length + 1}`);
  });
  atNativeBoundary(documentWith(cases), () => kmlHeld());
  const withOptionalMetadata = polygon();
  withOptionalMetadata.children[0].children[0].childNodes.unshift(element('tessellate', [text('1')]), element('altitudeMode', [text('clampToGround')]));
  atNativeBoundary(documentWith([placemark([withOptionalMetadata])]), () => assert.equal(kmlParsed().candidates.length, 1));
});

test('direct names are plain text and duplicate labels survive with document-ordinal candidate identities', () => {
  const makeNamed = () => placemark([element('name', [text('Same 🌱 <label>')]), polygon()]);
  atNativeBoundary(documentWith([
    placemark([element('Point')]), makeNamed(), makeNamed(),
    placemark([element('name', [text(' \t ')]), polygon()]),
    placemark([element('description', [element('name', [text('Nested name is not the label')])]), polygon()]),
  ]), () => {
    const parsed = kmlParsed();
    assert.deepEqual(parsed.candidates.map(candidate => [candidate.id, candidate.name]), [
      ['polygon-2', 'Same 🌱 <label>'], ['polygon-3', 'Same 🌱 <label>'],
      ['polygon-4', 'Polygon 4'], ['polygon-5', 'Polygon 5'],
    ]);
    assert.equal(parsed.excludedPlacemarkCount, 1);
    assert.deepEqual(Object.keys(parsed.candidates[0]).sort(), ['id', 'name', 'ring']);
  });
  atNativeBoundary(documentWith([placemark([element('name', [text('a'.repeat(2001))]), polygon()])]), () => kmlHeld());
  atNativeBoundary(documentWith([
    placemark([element('name', [text('a'.repeat(2001))]), polygon()]),
    placemark([element('name', [text('One')]), element('name', [text('Two')]), polygon()]),
    placemark([element('name', [text('  Preserve accepted text  ')]), polygon()]),
  ]), () => {
    const parsed = kmlParsed(); assert.equal(parsed.excludedPlacemarkCount, 2);
    assert.deepEqual(parsed.candidates.map(candidate => candidate.name), ['  Preserve accepted text  ']);
  });
});

test('native parser exceptions return a generic hold without vendor text or thrown-object coercion', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'DOMParser');
  let getters = 0;
  const hostile = Object.defineProperty({}, Symbol.toPrimitive, {
    get() { getters++; throw Error('Thrown object must not be coerced'); },
  });
  try {
    for (const failure of [new Error('synthetic-private-parser-detail'), hostile]) {
      class ThrowingParser { parseFromString() { throw failure; } }
      Object.defineProperty(globalThis, 'DOMParser', { configurable: true, value: ThrowingParser });
      const result = parseFieldLayoutKml(xml);
      assert.equal(result.status, 'held');
      if (result.status !== 'held') throw Error('Native parser exception became a candidate');
      assert.equal(result.reason.includes('synthetic-private-parser-detail'), false);
    }
    assert.equal(getters, 0);
  } finally {
    if (saved) Object.defineProperty(globalThis, 'DOMParser', saved);
    else Reflect.deleteProperty(globalThis, 'DOMParser');
  }
});

test('parsed KML candidates are deeply frozen detached data without native nodes or mutable input aliases', () => {
  const name = element('name', [text('Original label')]), shape = polygon();
  const coordinates = shape.children[0].children[0].children[0];
  atNativeBoundary(documentWith([placemark([name, shape])]), () => {
    const parsed = kmlParsed(), saved = JSON.stringify(parsed);
    assert.ok(Object.isFrozen(parsed)); assert.ok(Object.isFrozen(parsed.candidates));
    assert.ok(parsed.candidates.every(candidate => Object.isFrozen(candidate) && Object.isFrozen(candidate.ring)
      && candidate.ring.every(point => Object.isFrozen(point))));
    name.textContent = 'Changed label'; coordinates.textContent = 'bad';
    assert.equal(JSON.stringify(parsed), saved);
    assert.throws(() => { (parsed.candidates[0] as { name: string }).name = 'mutated'; }, TypeError);
    assert.equal(JSON.stringify(parsed), saved);
  });
});

test('DOM depth/node, placemark and total tuple budgets stop bounded extraction', () => {
  let deep = placemark();
  for (let i = 0; i < 70; i++) deep = element('Folder', [deep]);
  atNativeBoundary(documentWith([deep]), () => kmlHeld());
  atNativeBoundary(documentWith([placemark(), element('description', Array.from({ length: 20_001 }, () => text('x')))]), () => kmlHeld());
  atNativeBoundary(documentWith(Array.from({ length: 201 }, () => placemark())), () => kmlHeld());
  atNativeBoundary(documentWith(Array.from({ length: 21 }, () => placemark([polygon(boundedRing(512))]))), () => kmlHeld());
});

function ambiguousPlacemarkCannotBeSalvaged(ambiguous: BoundaryNode) {
  const separate = placemark([element('name', [text('Separate supported polygon')]), polygon()]);
  atNativeBoundary(documentWith([ambiguous, separate]), () => {
    const result = parseFieldLayoutKml(xml);
    // Either holding the malformed document or excluding its entire ambiguous
    // Placemark is safe. Extracting one branch from that Placemark is not.
    if (result.status === 'held') {
      assert.ok(result.reason.length);
      return;
    }
    assert.deepEqual(result.candidates.map(candidate => candidate.name), ['Separate supported polygon']);
    assert.equal(result.candidates.length, 1);
    assert.ok(result.excludedPlacemarkCount >= 1, 'The rejected structure must remain visible as an exclusion');
  });
}

for (const container of ['MultiGeometry', 'description', 'ExtendedData']) {
  test(`a nested Placemark inside ${container} cannot escape exclusion as a separate polygon candidate`, () => {
    const nested = placemark([element('name', [text('Nested geometry must stay excluded')]), polygon()]);
    const outerChildren = [element('name', [text('Ambiguous outer polygon')]), element(container, [nested])];
    if (container !== 'MultiGeometry') outerChildren.unshift(polygon());
    ambiguousPlacemarkCannotBeSalvaged(placemark(outerChildren));
  });
}

for (const geometry of ['LinearRing', 'Point', 'LineString']) {
  test(`a Polygon with an extra ${geometry} cannot silently salvage only its supported outer boundary`, () => {
    const extra = element(geometry, [element('coordinates', [text(triangle)])]);
    const shape = element('Polygon', [...polygon().children, extra]);
    ambiguousPlacemarkCannotBeSalvaged(placemark([shape]));
  });
}

test('a second coordinate branch nested under Polygon metadata cannot be ignored beside a valid outer ring', () => {
  const metadata = element('tessellate', [element('coordinates', [text(triangle)])]);
  const shape = element('Polygon', [...polygon().children, metadata]);
  ambiguousPlacemarkCannotBeSalvaged(placemark([shape]));
});

test('a second coordinate branch nested under LinearRing metadata cannot be ignored beside valid coordinates', () => {
  const ring = element('LinearRing', [element('coordinates', [text(triangle)]),
    element('altitudeMode', [element('coordinates', [text(triangle)])])]);
  const shape = element('Polygon', [element('outerBoundaryIs', [ring])]);
  ambiguousPlacemarkCannotBeSalvaged(placemark([shape]));
});

test('markup inside a direct name excludes its Placemark instead of flattening nested text into a trusted label', () => {
  ambiguousPlacemarkCannotBeSalvaged(placemark([
    element('name', [element('description', [text('Nested label must stay excluded')])]), polygon(),
  ]));
});

test('a long invalid decimal below the input ceiling returns held without hanging the caller', () => {
  const parserUrl = new URL('../lib/field-layout-kml-parser.ts', import.meta.url).href;
  const source = `
    import { parseFieldLayoutCoordinateText, KML_PARSER_LIMITS } from ${JSON.stringify(parserUrl)};
    const input = '9'.repeat(500_000) + 'x,0 1,0 1,1 0,0';
    if (input.length >= KML_PARSER_LIMITS.maxUtf16Chars) throw Error('Fixture must reach numeric grammar below the size ceiling');
    console.log(JSON.stringify(parseFieldLayoutCoordinateText(input)));
  `;
  // The original overlapping digit branches hung on this malformed token. A
  // separate process gives that regression a hard failure boundary while all
  // accepted decimal forms remain exercised by the existing grammar cases.
  const child = spawnSync(process.execPath, [
    '--import', new URL('./register-alias.mjs', import.meta.url).href,
    '--input-type=module', '--eval', source,
  ], { encoding: 'utf8', timeout: 5000, maxBuffer: 64 * 1024 });
  assert.equal(child.error, undefined, `The real parser must terminate within the bounded child run: ${child.error?.message ?? ''}`);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.status, 'held');
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length);
});
