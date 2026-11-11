'use server';

import {
  fetchDwdMosmixCatalogSearch,
  type DwdMosmixLiveCatalogSearchResult,
} from '@/lib/international/providers/dwd-mosmix-http';

/**
 * Public station catalogue search action for DWD MOSMIX.
 *
 * Why:
 * 1. Arbitrary caller query reaches the existing query validator first.
 * 2. Only an admitted ASCII query permits the fixed public catalogue request.
 * 3. The query itself is NOT sent in the provider URL; the provider URL is fixed,
 *    and text matching is performed in-process over bounded retrieved bytes.
 * 4. Client transport options, arbitrary URLs, credentials, coordinates, or custom clocks
 *    are never accepted; all operations run with server-owned defaults only under a fixed monotonic deadline.
 * 5. Returns the exact pure search failure, transport failure, or matched/no-match result with provenance.
 */
export async function searchDwdStationCatalogReference(
  query: unknown
): Promise<DwdMosmixLiveCatalogSearchResult> {
  return fetchDwdMosmixCatalogSearch(query);
}
