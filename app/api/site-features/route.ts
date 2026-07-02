import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

const OVERPASS_PRIMARY = 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIRROR = 'https://overpass.kumi.systems/api/interpreter';
const USER_AGENT = 'ImbewuField/1.0 (permaculture design app; rorymclark@gmail.com)';

const MAX_BOX_DEG = 0.05;
const MAX_FEATURES = 150;

type FeatureKind = 'building' | 'road' | 'water';

interface SiteFeature {
  kind: FeatureKind;
  ring: Array<[number, number]>;
  name?: string;
}

interface RequestBody {
  south?: unknown;
  west?: unknown;
  north?: unknown;
  east?: unknown;
}

interface OverpassGeomPoint {
  lat?: unknown;
  lon?: unknown;
}

interface OverpassElement {
  type?: string;
  tags?: Record<string, string | undefined>;
  geometry?: OverpassGeomPoint[];
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

function buildQuery(south: number, west: number, north: number, east: number): string {
  const bbox = `${south},${west},${north},${east}`;
  return `[out:json][timeout:20];(way["building"](${bbox});way["natural"="water"](${bbox});way["water"](${bbox});way["highway"](${bbox}););out geom;`;
}

async function queryOverpass(url: string, query: string, timeoutMs: number): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Overpass ${res.status}: ${detail.slice(0, 300)}`);
    }
    return (await res.json()) as OverpassResponse;
  } finally {
    clearTimeout(timeout);
  }
}

/** Classify a way's tags into a SiteFeature kind, or null to skip it. */
function classifyElement(tags: Record<string, string | undefined>): FeatureKind | null {
  if (tags.building) return 'building';
  if (tags.natural === 'water' || tags.water) return 'water';
  if (tags.highway) {
    if (tags.highway === 'proposed') return null;
    return 'road';
  }
  return null;
}

/** Parse raw Overpass elements[] into ranked, capped SiteFeature[]. */
function parseOverpassElements(elements: OverpassElement[]): SiteFeature[] {
  const buildings: SiteFeature[] = [];
  const water: SiteFeature[] = [];
  const roads: SiteFeature[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const kind = classifyElement(tags);
    if (!kind) continue;

    const geometry = Array.isArray(el.geometry) ? el.geometry : [];
    const ring: Array<[number, number]> = [];
    for (const p of geometry) {
      const lat = Number(p?.lat);
      const lon = Number(p?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      ring.push([lon, lat]);
    }
    if (ring.length < 2) continue;

    // `closed` (kind !== 'road', or a road whose endpoints coincide) determines
    // how consumers should render the ring (polygon vs polyline); it is not
    // itself part of the wire format since it's fully derivable from kind+ring.

    const feature: SiteFeature = { kind, ring };
    if (typeof tags.name === 'string' && tags.name) feature.name = tags.name;

    if (kind === 'building') buildings.push(feature);
    else if (kind === 'water') water.push(feature);
    else roads.push(feature);
  }

  return [...buildings, ...water, ...roads].slice(0, MAX_FEATURES);
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const south = Number(body.south);
  const west = Number(body.west);
  const north = Number(body.north);
  const east = Number(body.east);

  if (![south, west, north, east].every(Number.isFinite)) {
    return NextResponse.json({ error: 'south, west, north, east must be finite numbers' }, { status: 400 });
  }
  if (south >= north) {
    return NextResponse.json({ error: 'south must be less than north' }, { status: 400 });
  }
  if (west >= east) {
    return NextResponse.json({ error: 'west must be less than east' }, { status: 400 });
  }
  if (north - south > MAX_BOX_DEG || east - west > MAX_BOX_DEG) {
    return NextResponse.json({ error: `Bounding box too large — max ${MAX_BOX_DEG}° on a side` }, { status: 400 });
  }

  const query = buildQuery(south, west, north, east);

  let data: OverpassResponse;
  try {
    data = await queryOverpass(OVERPASS_PRIMARY, query, 15_000);
  } catch (primaryErr) {
    console.error('site-features: primary Overpass failed, retrying mirror:', primaryErr);
    try {
      data = await queryOverpass(OVERPASS_MIRROR, query, 15_000);
    } catch (mirrorErr) {
      console.error('site-features: mirror Overpass also failed:', mirrorErr);
      return NextResponse.json(
        { error: 'Could not reach OpenStreetMap right now — please try again shortly.' },
        { status: 502 },
      );
    }
  }

  const elements = Array.isArray(data.elements) ? data.elements : [];
  const features = parseOverpassElements(elements);

  return NextResponse.json({ features });
}
