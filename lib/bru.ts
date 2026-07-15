import fs from 'fs';
import path from 'path';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import type { Feature, FeatureCollection, Polygon, MultiPolygon, BBox } from 'geojson';
import type { BruZoneData } from './types';

// KZN Dept of Agriculture & Rural Development — Bioresource Unit (BRU) zones.
// Bundled locally (public/data/kzn-bru.geojson) rather than fetched live at
// runtime, so the app never depends on the gov ArcGIS service being up.
// Source: https://gis.kzndard.gov.za/server/rest/services/Hosted/BRU/FeatureServer/1
export const BRU_ATTRIBUTION = 'Zone data: KZN DARD Bioresource Units';

interface BruProps {
  brucode: string;
  bru_clean: string;
  map: number;
  tmin: number;
  tmean: number;
  tmax: number;
}

type BruFeature = Feature<Polygon | MultiPolygon, BruProps>;

// Cheap bounding box gate before the expensive per-feature polygon test —
// the BRU layer only covers KwaZulu-Natal, padded slightly beyond its
// published extent (xmin 28.87, xmax 32.89, ymin -31.08, ymax -26.81).
const KZN_BBOX = { minLat: -31.3, maxLat: -26.5, minLon: 28.5, maxLon: 33.2 };

let cachedFeatures: (BruFeature & { _bbox: BBox })[] | null = null;

function featureBBox(f: Feature<Polygon | MultiPolygon>): BBox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const rings: number[][][] =
    f.geometry.type === 'Polygon'
      ? (f.geometry.coordinates as number[][][])
      : (f.geometry.coordinates as number[][][][]).flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}

function loadFeatures(): (BruFeature & { _bbox: BBox })[] {
  if (cachedFeatures) return cachedFeatures;
  const filePath = path.join(process.cwd(), 'public', 'data', 'kzn-bru.geojson');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const fc = JSON.parse(raw) as FeatureCollection<Polygon | MultiPolygon, BruProps>;
  cachedFeatures = fc.features.map((f) => ({ ...(f as BruFeature), _bbox: featureBBox(f) }));
  return cachedFeatures;
}

// ── Best-effort BRG (Bioresource Group) name matching ──────────────────────
// The BRU FeatureServer has NO name/BRG field — only code + climate. There is
// no publicly available BRU-code -> BRG crosswalk table (the 23 named groups
// were built as a separate, later aggregation over Camp's ~1995 BRU survey,
// not derived algorithmically from the code prefix). What follows is a
// heuristic nearest-match by approximate climate centroid, NOT a verified
// lookup — it is deliberately surfaced to callers as approximate so the UI
// can flag it rather than present it as an authoritative zone name.
interface BrgProfile { name: string; tmean: number; map: number }

const BRG_PROFILES: BrgProfile[] = [
  { name: 'Moist Coast Forest Thorn & Palm Veld', tmean: 22, map: 1100 },
  { name: 'Dry Coast Forest Thorn & Palm Veld', tmean: 22, map: 850 },
  { name: 'Moist Coast Hinterland Ngongoni Veld', tmean: 20, map: 950 },
  { name: 'Dry Coast Hinterland Ngongoni Veld', tmean: 20, map: 750 },
  { name: 'Moist Midlands Mistbelt', tmean: 15.5, map: 1050 },
  { name: 'Dry Midlands Mistbelt', tmean: 16, map: 850 },
  { name: 'Northern Mistbelt', tmean: 16.5, map: 950 },
  { name: 'Moist Highland Sourveld', tmean: 14.5, map: 950 },
  { name: 'Dry Highland Sourveld', tmean: 15, map: 750 },
  { name: 'Montane Veld', tmean: 11, map: 1100 },
  { name: 'Moist Transitional Tall Grassveld', tmean: 17.5, map: 900 },
  { name: 'Moist Tall Grassveld', tmean: 18.5, map: 900 },
  { name: 'Dry Tall Grassveld', tmean: 18.5, map: 700 },
  { name: 'Sour Sandveld', tmean: 18.5, map: 800 },
  { name: 'Moist Lowland Tall Grassveld', tmean: 20.5, map: 900 },
  { name: 'Dry Lowland Tall Grassveld', tmean: 20.5, map: 700 },
  { name: 'Coast Hinterland Thornveld', tmean: 21, map: 700 },
  { name: 'Mixed Thornveld', tmean: 20, map: 650 },
  { name: 'Moist Zululand Thornveld', tmean: 21.5, map: 850 },
  { name: 'Dry Zululand Thornveld', tmean: 22, map: 650 },
  { name: 'Valley Bushveld', tmean: 21.5, map: 600 },
  { name: 'Lowveld', tmean: 22.5, map: 650 },
  { name: 'Sandy Bush and Palm Veld', tmean: 21, map: 950 },
];

// Normalise temp/rainfall onto comparable scales (rough spread of each
// dimension across the 23 profiles) before nearest-neighbour matching.
function nearestBrg(tmean: number, map: number): string {
  let best = BRG_PROFILES[0];
  let bestDist = Infinity;
  for (const p of BRG_PROFILES) {
    const dTemp = (tmean - p.tmean) / 3;
    const dRain = (map - p.map) / 200;
    const dist = dTemp * dTemp + dRain * dRain;
    if (dist < bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  return best.name;
}

/**
 * Look up the KZN Bioresource Unit zone containing (lat, lon).
 * Returns null outside KZN, or if the point falls inside the KZN bounding
 * box but outside every polygon (e.g. offshore, or a gap between zones) —
 * callers must treat null as "no BRU data available" and fall back gracefully.
 */
export function lookupBRU(lat: number, lon: number): BruZoneData | null {
  if (lat < KZN_BBOX.minLat || lat > KZN_BBOX.maxLat || lon < KZN_BBOX.minLon || lon > KZN_BBOX.maxLon) {
    return null;
  }

  let features: (BruFeature & { _bbox: BBox })[];
  try {
    features = loadFeatures();
  } catch (err) {
    console.error('BRU data load error:', err);
    return null;
  }

  const pt = point([lon, lat]);

  for (const f of features) {
    const [minX, minY, maxX, maxY] = f._bbox;
    if (lon < minX || lon > maxX || lat < minY || lat > maxY) continue;
    try {
      if (booleanPointInPolygon(pt, f)) {
        const props = f.properties;
        return {
          brucode: props.brucode,
          bruParent: props.bru_clean,
          map: Math.round(props.map),
          tmin: Math.round(props.tmin * 10) / 10,
          tmean: Math.round(props.tmean * 10) / 10,
          tmax: Math.round(props.tmax * 10) / 10,
          nearestBrg: nearestBrg(props.tmean, props.map),
          isApproximateName: true,
          attribution: BRU_ATTRIBUTION,
        };
      }
    } catch {
      // Malformed/self-intersecting ring after simplification — skip rather than throw.
      continue;
    }
  }

  return null; // inside KZN bbox but no polygon match (offshore, gap, etc.)
}
