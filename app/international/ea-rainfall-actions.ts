'use server';

import { fetchCountryEaRainfallPublicDemo, type EaRainfallPublicDemoResult } from '@/lib/international/providers/ea-rainfall-public-demo';

/** Fixed public network example only; no client location or arbitrary URL enters the request. */
export async function checkEaRainfallPublicDemo(): Promise<EaRainfallPublicDemoResult> {
  return fetchCountryEaRainfallPublicDemo('GB');
}
