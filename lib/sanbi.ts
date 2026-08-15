import type { VegetationData } from './types';

// SANBI BGIS — 2018 National Vegetation Map (official SA vegetation units).
// ArcGIS MapServer "identify" returns the exact vegetation type at a coordinate.
const SANBI_IDENTIFY =
  'https://bgismaps.sanbi.org/server/rest/services/BGIS_Projects/VEGMAP2018_Final/MapServer/identify';

export async function fetchVegetation(lat: number, lon: number): Promise<VegetationData | null> {
  const d = 0.05; // small map extent around the point
  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    sr: '4326',
    layers: 'all',
    tolerance: '1',
    mapExtent: `${lon - d},${lat - d},${lon + d},${lat + d}`,
    imageDisplay: '400,400,96',
    returnGeometry: 'false',
    f: 'json',
  });

  // Timeout matches lib/nasa-power.ts and lib/elevation.ts's sibling upstream calls in the same
  // /api/location-data request. Without it, a hung SANBI response hung this request forever: it is
  // one of four calls awaited with Promise.allSettled, which does not settle until every one of
  // them does — so a farmer tapping the map got a spinner with no way to fail and no way to finish.
  const res = await fetch(`${SANBI_IDENTIFY}?${params}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 604800 }, // cache 1 week
  } as RequestInit);
  if (!res.ok) throw new Error(`SANBI error: ${res.status}`);
  const json = await res.json();
  const attr = json.results?.[0]?.attributes;
  if (!attr) return null;

  const vegUnit = attr.Name_18 ?? attr.NAME ?? null;
  if (!vegUnit || vegUnit === 'Null') return null;

  return {
    vegUnit,
    biome: attr.BIOME_18 ?? attr.BIOME ?? '',
    bioregion: attr.BIOREGION_ ?? attr.BIOREGION ?? '',
  };
}
