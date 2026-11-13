/** Shared cache identity without importing SA classification, authentication or
 * crop-book code into the evidence decoder. The existing v7 data remains valid;
 * old records without optional temperature receipts stay unknown for that use. */
export function locationDataCacheKey(lat: number, lon: number): string {
  return `imbewu_loc_v7_${lat.toFixed(5)}_${lon.toFixed(5)}`;
}
