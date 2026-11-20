export type PlaceSearchArea = 'south-africa' | 'worldwide';
export interface PlaceSearchResult { name: string; lon: number; lat: number }

/** Worldwide lookup is a temporary map preview, never a site-country decision.
 * Keep the established SA bias explicit rather than leaking it into every query.
 * v5 no longer supports POI; the remaining types are documented place/address types. */
export function mapboxPlaceSearchUrl(query: string, token: string, area: PlaceSearchArea, autocomplete: boolean): string {
  const params = new URLSearchParams({ access_token: token, limit: autocomplete || area === 'worldwide' ? '5' : '3',
    language: 'en', types: 'place,locality,district,region,address,neighborhood' });
  params.set('autocomplete', String(autocomplete));
  if (area === 'south-africa') { params.set('country', 'ZA'); params.set('proximity', '25,-29'); }
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
}

export function readMapboxPlaceResults(value: unknown): PlaceSearchResult[] {
  if (!value || typeof value !== 'object' || !('features' in value) || !Array.isArray(value.features)) return [];
  return value.features.flatMap(feature => {
    if (!feature || typeof feature !== 'object' || !Array.isArray(feature.center)) return [];
    const [lon, lat] = feature.center;
    const name = typeof feature.place_name === 'string' ? feature.place_name : feature.text;
    return typeof name === 'string' && name.trim() && typeof lon === 'number' && Number.isFinite(lon)
      && lon >= -180 && lon <= 180 && typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90
      ? [{ name, lon, lat }] : [];
  });
}
