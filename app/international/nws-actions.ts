'use server';

import { fetchCountryNwsPublicDemo, fetchNwsPointReference,
  type NwsPublicDemoResult, type NwsPointResult } from '@/lib/international/providers/nws-public-demo';

/** NWS requests need an identifying application header. The client triggers a
 * fixed public reference; private site coordinates and account data never enter it. */
export async function checkNwsPublicDemo(): Promise<NwsPublicDemoResult> {
  return fetchCountryNwsPublicDemo('US');
}

/** Only a coarsened pair crosses this boundary. Validation and bounded delivery
 * establish a public reference, never account ownership or US jurisdiction. */
export async function checkNwsPointReference(input: unknown): Promise<NwsPointResult> {
  return fetchNwsPointReference(input);
}
