'use server';

import { fetchDwdMosmixStationReference, type DwdMosmixImportResult } from '@/lib/international/providers/dwd-mosmix-import';

/**
 * Public station reference action for DWD MOSMIX forecasts.
 *
 * Why: The existing request authority admits only an explicit station ID for a
 * provider request. Client transport options are never passed to the importer.
 * All operations run with server-default options under a fixed monotonic deadline.
 * Only decoded references or static failures cross this server-action boundary.
 */
export async function checkDwdStationReference(input: unknown): Promise<DwdMosmixImportResult> {
  return fetchDwdMosmixStationReference(input);
}
