import { decodeDwdMosmixKml, type DwdMosmixResult } from './dwd-mosmix-reference.ts';
import { parseDwdMosmixProvenance, type DwdMosmixProvenance } from './dwd-mosmix-request.ts';
import { snapshotDwdMosmixBytes } from './dwd-mosmix-byte-snapshot.ts';

/** Byte/declaration engineering ceilings, not provider quotas or farming limits. */
export const DWD_MOSMIX_BYTE_LIMITS = Object.freeze({ inputBytes: 2_097_152, declarationBytes: 1024 });
export type DwdMosmixByteFailureReason = 'invalid-byte-input' | 'unsupported-encoding' | 'invalid-byte-encoding';
export type DwdMosmixByteResult = DwdMosmixResult | Readonly<{
  status: 'failed'; reason: DwdMosmixByteFailureReason; provenance: Readonly<DwdMosmixProvenance> | null;
}>;

function unsupportedUnicodeSignature(bytes: Uint8Array): boolean {
  return bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0xfe && bytes[1] === 0xff
    || bytes[0] === 0 && bytes[1] === 0 && (bytes[2] === 0xfe && bytes[3] === 0xff
      || bytes[2] === 0xff && bytes[3] === 0xfe || bytes[2] === 0 && bytes[3] === 0x3c || bytes[2] === 0x3c && bytes[3] === 0)
    || bytes[0] === 0 && bytes[1] === 0x3c && (bytes[2] === 0 || bytes[2] === 0x3f)
    || bytes[0] === 0x3c && bytes[1] === 0 && (bytes[2] === 0 || bytes[2] === 0x3f);
}

function latin1(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let start = 0; start < bytes.length; start += 4096) {
    let part = '';
    for (let i = start; i < Math.min(start + 4096, bytes.length); i++) part += String.fromCharCode(bytes[i]);
    parts.push(part);
  }
  return parts.join('');
}

/** Encoding bootstrap only. The existing XML decoder still decides whether the
 * complete declaration is legal; this does not accept a second XML grammar. */
function encoding(bytes: Uint8Array): 'utf-8' | 'iso-8859-1' | 'unsupported-encoding' | 'invalid-byte-encoding' | 'software-bound' {
  if (unsupportedUnicodeSignature(bytes)) return 'unsupported-encoding';
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const offset = bom ? 3 : 0;
  if (bytes[offset] !== 0x3c || bytes[offset + 1] !== 0x3f || bytes[offset + 2] !== 0x78
    || bytes[offset + 3] !== 0x6d || bytes[offset + 4] !== 0x6c
    || ![9, 10, 13, 32].includes(bytes[offset + 5])) return 'utf-8';
  let declaration = '', ended = false;
  const limit = Math.min(bytes.length, offset + DWD_MOSMIX_BYTE_LIMITS.declarationBytes);
  for (let i = offset; i < limit; i++) {
    if (bytes[i] > 0x7f) return 'invalid-byte-encoding';
    declaration += String.fromCharCode(bytes[i]);
    if (bytes[i] === 0x3e && i > offset && bytes[i - 1] === 0x3f) { ended = true; break; }
  }
  if (!ended) return bytes.length >= offset + DWD_MOSMIX_BYTE_LIMITS.declarationBytes ? 'software-bound' : 'utf-8';
  const names = [...declaration.matchAll(/[ \t\r\n]encoding[ \t\r\n]*=[ \t\r\n]*(["'])([A-Za-z][A-Za-z0-9._-]*)\1/g)];
  if (!names.length) return 'utf-8';
  if (names.length !== 1) return 'invalid-byte-encoding';
  const name = names[0][2].toLowerCase();
  if (name !== 'utf-8' && name !== 'iso-8859-1' || bom && name !== 'utf-8') return 'unsupported-encoding';
  return name;
}

/** Decodes a bounded public KML byte snapshot, then reuses the actual station
 * decoder. No archive/HTTP handling, unit conversion, freshness or crop advice. */
export function decodeDwdMosmixKmlBytes(input: unknown, source: unknown): DwdMosmixByteResult {
  const provenance = parseDwdMosmixProvenance(source);
  const failed = (reason: DwdMosmixByteFailureReason | 'invalid-provenance' | 'software-bound'): DwdMosmixByteResult =>
    Object.freeze({ status: 'failed', reason, provenance });
  if (!provenance) return failed('invalid-provenance');
  const bytes = snapshotDwdMosmixBytes(input, DWD_MOSMIX_BYTE_LIMITS.inputBytes);
  if (typeof bytes === 'string') return failed(bytes);
  if (!bytes.byteLength) return failed('invalid-byte-input');
  const name = encoding(bytes);
  if (name !== 'utf-8' && name !== 'iso-8859-1') return failed(name);
  try {
    // Web TextDecoder's ISO-8859-1 label means Windows-1252. XML's explicit
    // Latin-1 declaration instead requires the original byte-to-code-point map.
    // Retain the signature for the existing parser's one-BOM rule. Stripping it
    // here would let a second BOM masquerade as that parser's allowed first one.
    const xml = name === 'iso-8859-1' ? latin1(bytes) : new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return decodeDwdMosmixKml(xml, provenance);
  } catch { return failed('invalid-byte-encoding'); }
}
