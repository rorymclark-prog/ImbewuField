/**
 * Character admissibility check for XML 1.0 content.
 *
 * Checks that a value is a string whose Unicode code points are strictly
 * permitted in XML 1.0 (excluding C0 controls other than TAB, LF, CR,
 * lone surrogates, and the noncharacters U+FFFE / U+FFFF).
 *
 * NOTE: This is an individual character admissibility check only. It does NOT
 * assert XML well-formedness, DTD/entity safety, parser safety, KML schema
 * conformance, or document size limits.
 */
export function isXml10CharacterText(value: unknown): value is string {
  return typeof value === 'string'
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(value);
}
