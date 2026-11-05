'use server';

import { fetchCountryNwsPublicDemo, type NwsPublicDemoResult } from '@/lib/international/providers/nws-public-demo';

/** NWS requests need an identifying application header. The client triggers a
 * fixed public reference; private site coordinates and account data never enter it. */
export async function checkNwsPublicDemo(): Promise<NwsPublicDemoResult> {
  return fetchCountryNwsPublicDemo('US');
}
