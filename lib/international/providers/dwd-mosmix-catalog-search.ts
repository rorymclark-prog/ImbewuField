import {
  parseDwdMosmixStationCatalogBytes,
  type DwdMosmixCatalogResult,
  type DwdMosmixCatalogStation,
} from './dwd-mosmix-catalog.ts';

/**
 * Engineering ceilings for bounded text search across the station catalogue.
 *
 * Why: Untrusted query inputs must be bounded (max 64 characters) before scanning,
 * and maximum retained search matches are capped to 20 to protect consumer UI and memory.
 */
export const DWD_MOSMIX_CATALOG_SEARCH_LIMITS = Object.freeze({
  queryCharacters: 64,
  matches: 20,
});

export type DwdMosmixCatalogSearchFailure =
  | Readonly<{
      status: 'failed';
      reason: 'invalid-query';
    }>
  | Extract<DwdMosmixCatalogResult, { status: 'failed' }>;

export type DwdMosmixCatalogSearchResult =
  | DwdMosmixCatalogSearchFailure
  | Readonly<{
      status: 'matches' | 'no-matches';
      query: string;
      matches: readonly Readonly<DwdMosmixCatalogStation>[];
      totalMatches: number;
      catalogStationCount: number;
      catalogWithheldNameCount: number;
      nameProfile: 'ascii-only';
      referenceOnly: true;
    }>;

/**
 * Validates and sanitizes a query input string for ASCII station catalogue search.
 *
 * Why:
 * 1. Must be a primitive string.
 * 2. Length must be <= 64 characters BEFORE trimming.
 * 3. Every character must be a printable ASCII character (code points 32 through 126 inclusive).
 * 4. Only edge ASCII spaces (0x20) are trimmed; embedded spaces are preserved.
 * 5. Trimmed query must be non-empty.
 * 6. Avoids coercion, getters, Unicode normalization, or transliteration.
 */
export function parseDwdMosmixCatalogSearchQuery(query: unknown): string | null {
  if (typeof query !== 'string') {
    return null;
  }
  if (query.length === 0 || query.length > DWD_MOSMIX_CATALOG_SEARCH_LIMITS.queryCharacters) {
    return null;
  }
  for (let i = 0; i < query.length; i++) {
    const code = query.charCodeAt(i);
    if (code < 32 || code > 126) {
      return null;
    }
  }

  // Trim edge ASCII spaces only (0x20)
  let start = 0;
  while (start < query.length && query.charCodeAt(start) === 32) {
    start++;
  }
  let end = query.length;
  while (end > start && query.charCodeAt(end - 1) === 32) {
    end--;
  }

  if (start >= end) {
    return null;
  }

  return query.slice(start, end);
}

/**
 * Synchronously searches a DWD MOSMIX station catalogue byte buffer by station ID or name.
 *
 * Why:
 * 1. Validates the query parameter FIRST. If query is invalid, returns { status: 'failed', reason: 'invalid-query' }
 *    immediately without inspecting or evaluating the input byte buffer (preventing getter side-effects on input).
 * 2. Reuses parseDwdMosmixStationCatalogBytes for all catalogue admission. Forwards any parser failure unchanged.
 * 3. Performs a case-insensitive ASCII substring match against canonical stationId, or against name only if name is non-null.
 * 4. Preserves input order from the catalogue.
 * 5. Unknown/withheld names (name === null) remain selectable if their stationId matches the query,
 *    and never match against any guessed or transliterated name.
 * 6. Counts total matching rows (one row matching both ID and name counts once) and caps returned matches to the first 20.
 * 7. Returns a deeply frozen result object containing query in its original casing (with edge spaces trimmed),
 *    totalMatches count, catalogue station and withheld name counts, and retained matches.
 */
export function searchDwdMosmixStationCatalogBytes(
  input: unknown,
  query: unknown
): Readonly<DwdMosmixCatalogSearchResult> {
  // 1. Validate query first before touching input
  const sanitizedQuery = parseDwdMosmixCatalogSearchQuery(query);
  if (sanitizedQuery === null) {
    return Object.freeze({
      status: 'failed',
      reason: 'invalid-query',
    });
  }

  // 2. Parse catalogue bytes using existing authority
  const catalogResult = parseDwdMosmixStationCatalogBytes(input);
  if (catalogResult.status === 'failed') {
    return catalogResult;
  }

  const queryLower = sanitizedQuery.toLowerCase();
  const matchedStations: Readonly<DwdMosmixCatalogStation>[] = [];
  let totalMatches = 0;

  for (let i = 0; i < catalogResult.stations.length; i++) {
    const station = catalogResult.stations[i];
    const idMatch = station.stationId.toLowerCase().includes(queryLower);
    const nameMatch = station.name !== null && station.name.toLowerCase().includes(queryLower);

    if (idMatch || nameMatch) {
      totalMatches++;
      if (matchedStations.length < DWD_MOSMIX_CATALOG_SEARCH_LIMITS.matches) {
        matchedStations.push(station);
      }
    }
  }

  return Object.freeze({
    status: totalMatches > 0 ? 'matches' : 'no-matches',
    query: sanitizedQuery,
    matches: Object.freeze(matchedStations),
    totalMatches,
    catalogStationCount: catalogResult.stations.length,
    catalogWithheldNameCount: catalogResult.withheldNameCount,
    nameProfile: 'ascii-only',
    referenceOnly: true,
  });
}
