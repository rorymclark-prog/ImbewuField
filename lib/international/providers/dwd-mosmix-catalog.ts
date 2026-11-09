import { snapshotDwdMosmixBytes } from './dwd-mosmix-byte-snapshot.ts';
import { parseDwdStationRequest } from './dwd-mosmix-request.ts';

/**
 * Hard software-engineering limits for parsing the DWD MOSMIX station catalogue.
 *
 * Why: The public station catalogue file is fixed-width text.
 * Limits (1 MiB input, max 10,000 rows) prevent memory exhaustion from untrusted inputs
 * without asserting provider catalog size caps or farming boundaries.
 */
export const DWD_MOSMIX_CATALOG_LIMITS = Object.freeze({
  inputBytes: 1_048_576,
  maxRows: 10_000,
});

export type DwdMosmixCatalogFailureReason =
  | 'invalid-byte-input'
  | 'invalid-catalog'
  | 'unsupported-profile'
  | 'unsupported-station-id'
  | 'ambiguous-catalog'
  | 'software-bound';

export type DwdMosmixCatalogIssue = 'names-withheld-encoding';

export interface DwdMosmixCatalogStation {
  readonly stationId: string;
  readonly name: string | null;
}

export type DwdMosmixCatalogResult =
  | Readonly<{
      status: 'failed';
      reason: DwdMosmixCatalogFailureReason;
    }>
  | Readonly<{
      status: 'parsed' | 'partial';
      stations: readonly Readonly<DwdMosmixCatalogStation>[];
      issues: readonly DwdMosmixCatalogIssue[];
      withheldNameCount: number;
      nameProfile: 'ascii-only';
      referenceOnly: true;
    }>;

const EXPECTED_HEADER = 'ID    ICAO NAME                 LAT    LON     ELEV';
const EXPECTED_SEPARATOR = '----- ---- -------------------- -----  ------- -----';
const ROW_WIDTH = 52;
const MAX_TOTAL_LINES = 2 + DWD_MOSMIX_CATALOG_LIMITS.maxRows; // header + separator + maxRows

/**
 * Validates and parses the official DWD MOSMIX station catalogue byte buffer.
 *
 * Why:
 * 1. Takes an untrusted input and detaches a bounded byte slice via snapshotDwdMosmixBytes.
 * 2. Parses fixed byte columns per format-facts.json (row width 52 bytes).
 * 3. Requires exact header and separator lines at the top of the catalogue.
 * 4. Bounds line retention before every push (rejects exceeding 2 + maxRows lines before allocation).
 * 5. Strictly requires LF or CRLF delimiters; bare CR (whether embedded or terminal) is rejected.
 * 6. Extracts canonical station IDs from bytes [0, 5), trimming edge ASCII spaces only
 *    and verifying each ID through parseDwdStationRequest. Duplicate IDs hold the catalogue.
 * 7. Extracts station names from bytes [11, 31), trimming trailing ASCII spaces only.
 *    Because the official file declares UTF-8 but contains conflicting non-ASCII byte sequences,
 *    an explicit ascii-only name profile is enforced: names containing any byte >= 128 have
 *    their name set to null and trigger the 'names-withheld-encoding' issue, rather than guessing
 *    Latin-1/Windows-1252 or using lossy replacement characters.
 * 8. Returns a deeply frozen result. Parsing admits a supplied byte profile, not authenticated origin.
 */
export function parseDwdMosmixStationCatalogBytes(input: unknown): Readonly<DwdMosmixCatalogResult> {
  const snapshot = snapshotDwdMosmixBytes(input, DWD_MOSMIX_CATALOG_LIMITS.inputBytes);
  if (snapshot === 'software-bound') {
    return Object.freeze({
      status: 'failed',
      reason: 'software-bound',
    });
  }
  if (snapshot === 'invalid-byte-input') {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-byte-input',
    });
  }
  if (snapshot.byteLength === 0) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-catalog',
    });
  }

  // Split lines on LF (0x0A); strip preceding CR (0x0D) only when immediately before LF.
  // Bound line retention before each push to prevent memory exhaustion from newline-only inputs.
  const lines: Uint8Array[] = [];
  let lineStart = 0;
  const len = snapshot.byteLength;

  for (let i = 0; i < len; i++) {
    const b = snapshot[i];
    if (b === 0x0a) {
      if (lines.length >= MAX_TOTAL_LINES) {
        return Object.freeze({
          status: 'failed',
          reason: 'software-bound',
        });
      }
      let lineEnd = i;
      if (lineEnd > lineStart && snapshot[lineEnd - 1] === 0x0d) {
        lineEnd -= 1;
      }
      lines.push(snapshot.subarray(lineStart, lineEnd));
      lineStart = i + 1;
    }
  }

  // Handle unterminated final line if present
  if (lineStart < len) {
    if (lines.length >= MAX_TOTAL_LINES) {
      return Object.freeze({
        status: 'failed',
        reason: 'software-bound',
      });
    }
    // Terminal bare CR without following LF is rejected
    if (snapshot[len - 1] === 0x0d) {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-catalog',
      });
    }
    lines.push(snapshot.subarray(lineStart, len));
  }

  // Must have at least header + separator + 1 data row
  if (lines.length < 3) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-catalog',
    });
  }

  // Helper to decode exact ASCII line while checking for bare control characters
  function decodeAscii(bytes: Uint8Array): string | null {
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b < 32 || b > 126) {
        return null;
      }
      str += String.fromCharCode(b);
    }
    return str;
  }

  // Check header (line 0)
  const headerStr = decodeAscii(lines[0]);
  if (headerStr !== EXPECTED_HEADER) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-catalog',
    });
  }

  // Check separator (line 1)
  const separatorStr = decodeAscii(lines[1]);
  if (separatorStr !== EXPECTED_SEPARATOR) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-catalog',
    });
  }

  const dataLines = lines.slice(2);
  if (dataLines.length === 0) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-catalog',
    });
  }

  const seenStationIds = new Set<string>();
  const parsedStations: Readonly<DwdMosmixCatalogStation>[] = [];
  let withheldNameCount = 0;

  for (let rowIndex = 0; rowIndex < dataLines.length; rowIndex++) {
    const row = dataLines[rowIndex];

    // Must be exact row width 52
    if (row.length !== ROW_WIDTH) {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-catalog',
      });
    }

    // Reject bare CR or other control characters within the 52 bytes
    for (let j = 0; j < ROW_WIDTH; j++) {
      if (row[j] === 0x0d || row[j] < 32 && row[j] !== 0x20) {
        return Object.freeze({
          status: 'failed',
          reason: 'invalid-catalog',
        });
      }
    }

    // Require documented ASCII spaces at fixed separator positions:
    // bytes 5, 10, 31, 38, 46 per format-framing-correction.json
    if (
      row[5] !== 0x20 ||
      row[10] !== 0x20 ||
      row[31] !== 0x20 ||
      row[38] !== 0x20 ||
      row[46] !== 0x20
    ) {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-catalog',
      });
    }

    // Framing columns outside NAME (ICAO [6, 10), LAT [32, 38), LON [39, 46), ELEV [47, 52))
    // must consist solely of printable ASCII characters or spaces (32 to 126).
    const framingRanges: [number, number][] = [
      [6, 10],
      [32, 38],
      [39, 46],
      [47, 52],
    ];
    for (const [start, end] of framingRanges) {
      for (let j = start; j < end; j++) {
        const b = row[j];
        if (b < 32 || b > 126) {
          return Object.freeze({
            status: 'failed',
            reason: 'invalid-catalog',
          });
        }
      }
    }

    // 1. Parse ID field: bytes [0, 5)
    // Strip edge ASCII space padding (0x20) only
    let idStart = 0;
    while (idStart < 5 && row[idStart] === 0x20) {
      idStart++;
    }
    let idEnd = 5;
    while (idEnd > idStart && row[idEnd - 1] === 0x20) {
      idEnd--;
    }

    if (idStart === idEnd) {
      return Object.freeze({
        status: 'failed',
        reason: 'unsupported-station-id',
      });
    }

    // Extract ASCII string for ID
    let rawStationId = '';
    for (let j = idStart; j < idEnd; j++) {
      const b = row[j];
      // Embedded whitespace is invalid
      if (b <= 32 || b > 126) {
        return Object.freeze({
          status: 'failed',
          reason: 'unsupported-station-id',
        });
      }
      rawStationId += String.fromCharCode(b);
    }

    // Validate canonical station ID via parseDwdStationRequest
    const parsedRequest = parseDwdStationRequest({ stationId: rawStationId });
    if (!parsedRequest) {
      return Object.freeze({
        status: 'failed',
        reason: 'unsupported-station-id',
      });
    }
    const stationId = parsedRequest.stationId;

    // Check duplicate IDs (duplicate canonical IDs hold the whole catalogue)
    if (seenStationIds.has(stationId)) {
      return Object.freeze({
        status: 'failed',
        reason: 'ambiguous-catalog',
      });
    }
    seenStationIds.add(stationId);

    // 2. Parse NAME field: bytes [11, 31)
    // Trim trailing ASCII spaces (0x20) only
    let nameEnd = 31;
    while (nameEnd > 11 && row[nameEnd - 1] === 0x20) {
      nameEnd--;
    }

    // Reject empty name
    if (nameEnd === 11) {
      return Object.freeze({
        status: 'failed',
        reason: 'invalid-catalog',
      });
    }

    // Check name bytes
    let hasNonAscii = false;
    let nameStr = '';
    for (let j = 11; j < nameEnd; j++) {
      const b = row[j];
      // Reject control characters (< 32 or 127)
      if (b < 32 || b === 127) {
        return Object.freeze({
          status: 'failed',
          reason: 'invalid-catalog',
        });
      }
      if (b >= 128) {
        hasNonAscii = true;
      } else {
        nameStr += String.fromCharCode(b);
      }
    }

    let resolvedName: string | null = null;
    if (hasNonAscii) {
      withheldNameCount++;
      resolvedName = null;
    } else {
      resolvedName = nameStr;
    }

    parsedStations.push(
      Object.freeze({
        stationId,
        name: resolvedName,
      })
    );
  }

  const issues: DwdMosmixCatalogIssue[] = [];
  if (withheldNameCount > 0) {
    issues.push('names-withheld-encoding');
  }

  return Object.freeze({
    status: withheldNameCount > 0 ? 'partial' : 'parsed',
    stations: Object.freeze(parsedStations),
    issues: Object.freeze(issues),
    withheldNameCount,
    nameProfile: 'ascii-only',
    referenceOnly: true,
  });
}
