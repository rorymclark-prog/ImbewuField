import type {
  FieldLayoutCoordinate,
  FieldLayoutKmlCandidate,
  FieldLayoutKmlParsed,
  FieldLayoutKmlParseResult,
  FieldLayoutCoordinateParseResult,
} from './field-layout-import.types';
import { isXml10CharacterText } from './xml-character-text';

/** Software engineering limits for KML parsing; these are parser bounds, not agronomic limits. */
export const KML_PARSER_LIMITS = Object.freeze({
  maxUtf16Chars: 1_000_000,
  maxTagOpeners: 10_000,
  maxDomNodes: 20_000,
  maxDomDepth: 64,
  maxPlacemarks: 200,
  maxRingTuples: 512,
  maxTotalTuples: 10_000,
  maxNameChars: 2000,
});

const KML_NAMESPACE = 'http://www.opengis.net/kml/2.2';

/**
 * Standard decimal grammar: accepts integers, decimals (including leading/trailing dot like `.5` and `1.`),
 * optional leading zeros like `01`, optional sign, and optional exponent (`e` or `E` with optional sign).
 * Disallows empty, hex, infinity, NaN, or non-decimal trailing characters.
 */
// An optional dot between two unbounded digit runs made an invalid long token
// backtrack quadratically below the document cap. A fraction requires its dot.
const DECIMAL_COORD_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Trims XML 1.0 whitespace (\x20, \x09, \x0A, \x0D) from both ends of a string without stripping
 * non-breaking spaces or other Unicode spaces.
 */
function trimXmlWhitespace(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end) {
    const code = value.charCodeAt(start);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      start++;
    } else {
      break;
    }
  }
  while (end > start) {
    const code = value.charCodeAt(end - 1);
    if (code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d) {
      end--;
    } else {
      break;
    }
  }
  return value.slice(start, end);
}

/**
 * Parses and validates raw KML coordinate text for a single closed LinearRing.
 */
export function parseFieldLayoutCoordinateText(value: unknown): FieldLayoutCoordinateParseResult {
  if (typeof value !== 'string') {
    return Object.freeze({ status: 'held', reason: 'Coordinate value must be a primitive string.' });
  }
  if (value.length > KML_PARSER_LIMITS.maxUtf16Chars) {
    return Object.freeze({
      status: 'held',
      reason: `Coordinate text length (${value.length}) exceeds maximum software limit (${KML_PARSER_LIMITS.maxUtf16Chars}).`,
    });
  }
  if (!isXml10CharacterText(value)) {
    return Object.freeze({ status: 'held', reason: 'Coordinate string contains characters forbidden in XML 1.0.' });
  }

  const trimmed = trimXmlWhitespace(value);
  if (trimmed.length === 0) {
    return Object.freeze({ status: 'held', reason: 'Coordinate text is empty.' });
  }

  // Split on XML whitespace: space (\x20), tab (\x09), line feed (\x0A), carriage return (\x0D)
  const tokens = trimmed.split(/[\x20\x09\x0A\x0D]+/);
  if (tokens.length < 4) {
    return Object.freeze({ status: 'held', reason: 'A closed LinearRing requires at least 4 coordinate tuples.' });
  }
  if (tokens.length > KML_PARSER_LIMITS.maxRingTuples) {
    return Object.freeze({
      status: 'held',
      reason: `LinearRing tuple count (${tokens.length}) exceeds maximum limit (${KML_PARSER_LIMITS.maxRingTuples}).`,
    });
  }

  const ring: FieldLayoutCoordinate[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tupleStr = tokens[i];
    const parts = tupleStr.split(',');
    if (parts.length !== 2 && parts.length !== 3) {
      return Object.freeze({
        status: 'held',
        reason: `Malformed coordinate tuple at index ${i}: expected 2 or 3 comma-separated decimal components.`,
      });
    }

    const lngStr = parts[0];
    const latStr = parts[1];
    const altStr = parts[2]; // optional

    if (!DECIMAL_COORD_PATTERN.test(lngStr) || !DECIMAL_COORD_PATTERN.test(latStr)) {
      return Object.freeze({
        status: 'held',
        reason: `Invalid numeric decimal format in coordinate tuple at index ${i}.`,
      });
    }
    if (altStr !== undefined && !DECIMAL_COORD_PATTERN.test(altStr)) {
      return Object.freeze({
        status: 'held',
        reason: `Invalid numeric altitude decimal format in coordinate tuple at index ${i}.`,
      });
    }

    const lng = Number(lngStr);
    const lat = Number(latStr);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return Object.freeze({ status: 'held', reason: `Non-finite coordinate component at index ${i}.` });
    }
    if (altStr !== undefined) {
      const alt = Number(altStr);
      if (!Number.isFinite(alt)) {
        return Object.freeze({ status: 'held', reason: `Non-finite altitude component at index ${i}.` });
      }
    }

    if (lng < -180 || lng > 180) {
      return Object.freeze({ status: 'held', reason: `Longitude ${lng} at index ${i} out of valid range [-180, 180].` });
    }
    if (lat < -90 || lat > 90) {
      return Object.freeze({ status: 'held', reason: `Latitude ${lat} at index ${i} out of valid range [-90, 90].` });
    }

    ring.push(Object.freeze([lng, lat]));
  }

  // Ring closure verification: first and last coordinate tuples must be identical
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return Object.freeze({
      status: 'held',
      reason: 'LinearRing coordinates do not close: first and last coordinate tuples must match.',
    });
  }

  // Must have at least 3 distinct vertices (excluding the closing duplicate)
  const unclosed = ring.slice(0, ring.length - 1);
  if (unclosed.length < 3) {
    return Object.freeze({ status: 'held', reason: 'A valid LinearRing requires at least 3 non-coincident vertices.' });
  }

  // Non-consecutive duplicate check: all unclosed vertices must be unique
  const distinctVertices = new Set(unclosed.map(pt => `${pt[0]},${pt[1]}`));
  if (distinctVertices.size !== unclosed.length) {
    return Object.freeze({
      status: 'held',
      reason: 'LinearRing contains repeated interior vertices; all vertices before ring closure must be unique.',
    });
  }

  return Object.freeze({ status: 'parsed', ring: Object.freeze(ring) });
}

/**
 * Checks whether an element is an XML parsererror element.
 */
function isParserError(el: Element): boolean {
  return el.localName === 'parsererror';
}

/**
 * Checks whether an element contains only text nodes (no element children).
 */
function isTextOnlyElement(el: Element): boolean {
  for (let i = 0; i < el.childNodes.length; i++) {
    if (el.childNodes[i].nodeType === 1 /* ELEMENT_NODE */) {
      return false;
    }
  }
  return true;
}

/**
 * Extracts pure text content from an element that has no child elements.
 */
function getTextOnlyContent(el: Element): string {
  let text = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    if (child.nodeType === 3 /* TEXT_NODE */) {
      text += child.nodeValue ?? '';
    }
  }
  return text;
}

/**
 * Parses and validates an entire KML document using native browser DOMParser.
 */
export function parseFieldLayoutKml(value: unknown): FieldLayoutKmlParseResult {
  if (typeof value !== 'string') {
    return Object.freeze({ status: 'held', reason: 'KML input must be a primitive string.' });
  }
  // Length bound immediately before character or whitespace scans
  if (value.length > KML_PARSER_LIMITS.maxUtf16Chars) {
    return Object.freeze({
      status: 'held',
      reason: `KML text length (${value.length}) exceeds maximum software limit (${KML_PARSER_LIMITS.maxUtf16Chars}).`,
    });
  }
  if (!isXml10CharacterText(value)) {
    return Object.freeze({ status: 'held', reason: 'KML text contains characters forbidden in XML 1.0.' });
  }
  if (trimXmlWhitespace(value).length === 0) {
    return Object.freeze({ status: 'held', reason: 'KML text is empty or whitespace-only.' });
  }

  // Count tag openers
  let openers = 0;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) === 60 /* '<' */) {
      openers++;
      if (openers > KML_PARSER_LIMITS.maxTagOpeners) {
        return Object.freeze({
          status: 'held',
          reason: `Tag opener count exceeds limit (${KML_PARSER_LIMITS.maxTagOpeners}).`,
        });
      }
    }
  }

  // Reject ANY literal '<!' (prohibits DOCTYPE, external entity, CDATA, comments)
  if (value.includes('<!')) {
    return Object.freeze({
      status: 'held',
      reason: 'KML contains prohibited "<!" construct (DOCTYPE, external entity, CDATA, or comments are not permitted).',
    });
  }

  // Check processing instructions: exactly one optional <?xml ...?> is allowed at the very start (ignoring optional BOM)
  let checkText = value;
  if (checkText.charCodeAt(0) === 0xfeff) {
    checkText = checkText.slice(1);
  }

  const firstPiIndex = checkText.indexOf('<?');
  if (firstPiIndex !== -1) {
    if (firstPiIndex !== 0) {
      return Object.freeze({
        status: 'held',
        reason: 'Processing instruction is not at the beginning of the XML document.',
      });
    }
    const endPiIndex = checkText.indexOf('?>');
    if (endPiIndex === -1) {
      return Object.freeze({
        status: 'held',
        reason: 'Unclosed processing instruction.',
      });
    }
    const declText = checkText.slice(0, endPiIndex + 2);
    // Must be an XML declaration, not xml-stylesheet or other PI; lowercase "xml" only
    if (!/^<\?xml\s+[^?]*\?>$/.test(declText)) {
      return Object.freeze({
        status: 'held',
        reason: 'Initial processing instruction must be an XML declaration.',
      });
    }
    // Any subsequent processing instruction anywhere in the document is prohibited
    if (checkText.slice(endPiIndex + 2).includes('<?')) {
      return Object.freeze({
        status: 'held',
        reason: 'Document contains multiple or misplaced processing instructions.',
      });
    }
  }

  if (typeof DOMParser === 'undefined') {
    return Object.freeze({
      status: 'held',
      reason: 'DOMParser is not available in the current runtime environment.',
    });
  }

  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(value, 'application/xml');
  } catch {
    return Object.freeze({
      status: 'held',
      reason: 'XML parsing failed due to an unexpected parser exception.',
    });
  }

  // Check document doctype
  if (doc.doctype) {
    return Object.freeze({
      status: 'held',
      reason: 'KML document contains a DOCTYPE declaration, which is prohibited.',
    });
  }

  // Check for parsererror elements in document
  const parserErrors = doc.getElementsByTagName('parsererror');
  if (parserErrors && parserErrors.length > 0) {
    return Object.freeze({
      status: 'held',
      reason: 'XML document contains syntax or parser errors.',
    });
  }

  const root = doc.documentElement;
  if (!root) {
    return Object.freeze({ status: 'held', reason: 'XML document has no root element.' });
  }

  if (isParserError(root)) {
    return Object.freeze({ status: 'held', reason: 'XML root element is a parsererror.' });
  }

  if (root.localName !== 'kml' || root.namespaceURI !== KML_NAMESPACE) {
    return Object.freeze({
      status: 'held',
      reason: `Root element must be <kml> with namespaceURI "${KML_NAMESPACE}". Found localName "${root.localName}" with namespaceURI "${root.namespaceURI}".`,
    });
  }

  const PROHIBITED_TAGS = new Set([
    'NetworkLink',
    'NetworkLinkControl',
    'Model',
    'GroundOverlay',
    'ScreenOverlay',
    'PhotoOverlay',
    'href',
    'script',
  ]);

  let totalNodes = 0;
  let totalPlacemarks = 0;
  let totalTuples = 0;

  // Bounded iterative DOM walk to inspect namespace, node types, and enforce software limits
  interface StackItem {
    readonly node: Node;
    readonly depth: number;
  }
  const stack: StackItem[] = [{ node: root, depth: 1 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    totalNodes++;

    if (totalNodes > KML_PARSER_LIMITS.maxDomNodes) {
      return Object.freeze({
        status: 'held',
        reason: `DOM node count exceeds maximum limit (${KML_PARSER_LIMITS.maxDomNodes}).`,
      });
    }
    if (depth > KML_PARSER_LIMITS.maxDomDepth) {
      return Object.freeze({
        status: 'held',
        reason: `DOM nesting depth (${depth}) exceeds maximum limit (${KML_PARSER_LIMITS.maxDomDepth}).`,
      });
    }

    // Node.PROCESSING_INSTRUCTION_NODE === 7
    if (node.nodeType === 7) {
      return Object.freeze({
        status: 'held',
        reason: 'Document contains processing instruction nodes within the parsed DOM tree.',
      });
    }

    if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
      const el = node as Element;
      if (isParserError(el)) {
        return Object.freeze({ status: 'held', reason: 'XML document contains a parsererror element.' });
      }

      // Foreign namespace element check (must belong to KML 2.2 namespace)
      if (el.namespaceURI !== KML_NAMESPACE) {
        return Object.freeze({
          status: 'held',
          reason: `Element <${el.localName}> belongs to an unsupported foreign namespace: "${el.namespaceURI}".`,
        });
      }

      if (PROHIBITED_TAGS.has(el.localName)) {
        return Object.freeze({
          status: 'held',
          reason: `Element <${el.localName}> is prohibited in field layout KML import.`,
        });
      }

      if (el.localName === 'Placemark') {
        totalPlacemarks++;
        if (totalPlacemarks > KML_PARSER_LIMITS.maxPlacemarks) {
          return Object.freeze({
            status: 'held',
            reason: `Placemark count exceeds maximum limit (${KML_PARSER_LIMITS.maxPlacemarks}).`,
          });
        }
      }
    }

    const children = node.childNodes;
    for (let c = children.length - 1; c >= 0; c--) {
      stack.push({ node: children[c], depth: depth + 1 });
    }
  }

  // Retrieve all Placemark elements
  const allPlacemarks = doc.getElementsByTagNameNS(KML_NAMESPACE, 'Placemark');
  const candidates: FieldLayoutKmlCandidate[] = [];
  let excludedPlacemarkCount = 0;

  // Process only considered outer placemarks whose ancestry to <kml> consists solely of Document or Folder containers
  let outerPlacemarkOrdinal = 0;

  for (let p = 0; p < allPlacemarks.length; p++) {
    const placemark = allPlacemarks[p];

    // Check ancestry to root
    let isValidContainerAncestry = true;
    let curr = placemark.parentElement;
    while (curr && curr !== root) {
      if (curr.namespaceURI !== KML_NAMESPACE || (curr.localName !== 'Document' && curr.localName !== 'Folder')) {
        isValidContainerAncestry = false;
        break;
      }
      curr = curr.parentElement;
    }

    if (!isValidContainerAncestry) {
      // Nested inside non-container feature (e.g. MultiGeometry, description, etc.); ignored from top-level candidate consideration
      continue;
    }

    outerPlacemarkOrdinal++;

    // A considered outer placemark containing any descendant Placemark is ambiguous and excluded entirely
    const nestedPlacemarks = placemark.getElementsByTagNameNS(KML_NAMESPACE, 'Placemark');
    if (nestedPlacemarks.length > 0) {
      excludedPlacemarkCount++;
      continue;
    }

    // Require EXACTLY ONE descendant Polygon, EXACTLY ONE descendant LinearRing,
    // EXACTLY ONE descendant coordinates, EXACTLY ONE outerBoundaryIs, and zero innerBoundaryIs anywhere
    const descPolygons = placemark.getElementsByTagNameNS(KML_NAMESPACE, 'Polygon');
    const descRings = placemark.getElementsByTagNameNS(KML_NAMESPACE, 'LinearRing');
    const descCoords = placemark.getElementsByTagNameNS(KML_NAMESPACE, 'coordinates');
    const descOuter = placemark.getElementsByTagNameNS(KML_NAMESPACE, 'outerBoundaryIs');
    const descInner = placemark.getElementsByTagNameNS(KML_NAMESPACE, 'innerBoundaryIs');

    if (
      descPolygons.length !== 1 ||
      descRings.length !== 1 ||
      descCoords.length !== 1 ||
      descOuter.length !== 1 ||
      descInner.length !== 0
    ) {
      excludedPlacemarkCount++;
      continue;
    }

    // Ensure no other geometry elements exist anywhere inside Placemark (e.g. Point, LineString, Model, MultiGeometry)
    const OTHER_GEOMETRY_NAMES = ['Point', 'LineString', 'Model', 'MultiGeometry'];
    let hasOtherGeometry = false;
    for (const geomTag of OTHER_GEOMETRY_NAMES) {
      if (placemark.getElementsByTagNameNS(KML_NAMESPACE, geomTag).length > 0) {
        hasOtherGeometry = true;
        break;
      }
    }
    if (hasOtherGeometry) {
      excludedPlacemarkCount++;
      continue;
    }

    // Verify DIRECT chain: Placemark -> Polygon -> outerBoundaryIs -> LinearRing -> coordinates
    const polygon = descPolygons[0];
    const outerBoundary = descOuter[0];
    const linearRing = descRings[0];
    const coordEl = descCoords[0];

    if (
      polygon.parentElement !== placemark ||
      outerBoundary.parentElement !== polygon ||
      linearRing.parentElement !== outerBoundary ||
      coordEl.parentElement !== linearRing
    ) {
      excludedPlacemarkCount++;
      continue;
    }

    // Check direct child elements of Placemark
    const placemarkDirectElements: Element[] = [];
    for (let c = 0; c < placemark.childNodes.length; c++) {
      const child = placemark.childNodes[c];
      if (child.nodeType === 1) {
        placemarkDirectElements.push(child as Element);
      }
    }

    // Direct geometries of Placemark must be exactly one Polygon
    const directPolygons = placemarkDirectElements.filter(el => el.localName === 'Polygon');
    if (directPolygons.length !== 1) {
      excludedPlacemarkCount++;
      continue;
    }

    // Check direct name: at most one direct name, must be text-only (no element children)
    const directNames = placemarkDirectElements.filter(el => el.localName === 'name');
    let candidateName = `Polygon ${outerPlacemarkOrdinal}`;
    if (directNames.length > 1) {
      excludedPlacemarkCount++;
      continue;
    }
    if (directNames.length === 1) {
      const nameEl = directNames[0];
      if (!isTextOnlyElement(nameEl)) {
        excludedPlacemarkCount++;
        continue;
      }
      const rawName = getTextOnlyContent(nameEl);
      if (rawName.length > KML_PARSER_LIMITS.maxNameChars) {
        excludedPlacemarkCount++;
        continue;
      }
      const trimmedName = trimXmlWhitespace(rawName);
      if (trimmedName.length > 0) {
        candidateName = rawName; // Preserve exact accepted text
      }
    }

    // Direct children whitelist for Polygon:
    // Exactly one outerBoundaryIs, optional extrude, tessellate, altitudeMode. Each at most once.
    const polygonDirectElements: Element[] = [];
    for (let c = 0; c < polygon.childNodes.length; c++) {
      const child = polygon.childNodes[c];
      if (child.nodeType === 1) {
        polygonDirectElements.push(child as Element);
      }
    }

    const POLYGON_ALLOWED_SCALARS = new Set(['extrude', 'tessellate', 'altitudeMode']);
    const seenPolygonTags = new Set<string>();
    let polygonDirectValid = true;

    for (const el of polygonDirectElements) {
      const tag = el.localName;
      if (tag === 'outerBoundaryIs') {
        if (seenPolygonTags.has('outerBoundaryIs')) {
          polygonDirectValid = false;
          break;
        }
        seenPolygonTags.add('outerBoundaryIs');
      } else if (POLYGON_ALLOWED_SCALARS.has(tag)) {
        if (seenPolygonTags.has(tag) || !isTextOnlyElement(el)) {
          polygonDirectValid = false;
          break;
        }
        seenPolygonTags.add(tag);
      } else {
        polygonDirectValid = false;
        break;
      }
    }

    if (!polygonDirectValid || !seenPolygonTags.has('outerBoundaryIs')) {
      excludedPlacemarkCount++;
      continue;
    }

    // Direct children of outerBoundaryIs: ONLY one LinearRing, no other elements
    const outerDirectElements: Element[] = [];
    for (let c = 0; c < outerBoundary.childNodes.length; c++) {
      const child = outerBoundary.childNodes[c];
      if (child.nodeType === 1) {
        outerDirectElements.push(child as Element);
      }
    }
    if (outerDirectElements.length !== 1 || outerDirectElements[0] !== linearRing) {
      excludedPlacemarkCount++;
      continue;
    }

    // Direct children whitelist for LinearRing:
    // Exactly one coordinates, optional extrude, tessellate, altitudeMode. Each at most once, scalars text-only.
    const ringDirectElements: Element[] = [];
    for (let c = 0; c < linearRing.childNodes.length; c++) {
      const child = linearRing.childNodes[c];
      if (child.nodeType === 1) {
        ringDirectElements.push(child as Element);
      }
    }

    const RING_ALLOWED_SCALARS = new Set(['extrude', 'tessellate', 'altitudeMode']);
    const seenRingTags = new Set<string>();
    let ringDirectValid = true;

    for (const el of ringDirectElements) {
      const tag = el.localName;
      if (tag === 'coordinates') {
        if (seenRingTags.has('coordinates')) {
          ringDirectValid = false;
          break;
        }
        seenRingTags.add('coordinates');
      } else if (RING_ALLOWED_SCALARS.has(tag)) {
        if (seenRingTags.has(tag) || !isTextOnlyElement(el)) {
          ringDirectValid = false;
          break;
        }
        seenRingTags.add(tag);
      } else {
        ringDirectValid = false;
        break;
      }
    }

    if (!ringDirectValid || !seenRingTags.has('coordinates')) {
      excludedPlacemarkCount++;
      continue;
    }

    // coordinates element must be text-only (no child elements)
    if (!isTextOnlyElement(coordEl)) {
      excludedPlacemarkCount++;
      continue;
    }

    const rawCoordsText = getTextOnlyContent(coordEl);
    const coordResult = parseFieldLayoutCoordinateText(rawCoordsText);
    if (coordResult.status === 'held') {
      excludedPlacemarkCount++;
      continue;
    }

    totalTuples += coordResult.ring.length;
    if (totalTuples > KML_PARSER_LIMITS.maxTotalTuples) {
      return Object.freeze({
        status: 'held',
        reason: `Total coordinate tuple count across placemarks exceeds limit (${KML_PARSER_LIMITS.maxTotalTuples}).`,
      });
    }

    const candidateId = `polygon-${outerPlacemarkOrdinal}`;
    candidates.push(
      Object.freeze({
        id: candidateId,
        name: candidateName,
        ring: coordResult.ring,
      })
    );
  }

  if (candidates.length === 0) {
    return Object.freeze({
      status: 'held',
      reason: `No supported polygon candidates found. ${excludedPlacemarkCount} placemark(s) excluded.`,
    });
  }

  const result: FieldLayoutKmlParsed = {
    status: 'parsed',
    candidates: Object.freeze(candidates),
    excludedPlacemarkCount,
  };

  return Object.freeze(result);
}
