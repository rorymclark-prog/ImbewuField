import { NextRequest, NextResponse } from 'next/server';
import { PNG } from 'pngjs';
import { isoLines } from 'marchingsquares';

// ── Fine-grained (5m) contour lines, generated on the fly from Mapbox's ──
// terrain-RGB DEM (the same data already used for hillshade/3D terrain).
// The Mapbox Terrain-v2 VECTOR contour tileset (used by the default
// 'contours' source in components/Map.tsx) has a fixed 10m minor interval —
// too sparse for laying out beds/swales on contour on gentle farmland.
// This route decodes the raw elevation raster for the requested bbox and
// runs marching-squares isoline tracing at whatever interval is asked for.
//
// Scope: intended for site-scale requests (a farm extent at zoom ~14-18),
// not country-scale rendering — bbox area and tile count are capped below.

const TILE_ZOOM = 14; // native maxzoom of mapbox.mapbox-terrain-dem-v1
const TILE_SIZE = 256; // un-upscaled (@1x) terrain-RGB tile size
const MAX_TILE_SPAN = 6; // cap: at most 6x6 tiles (incl. 1-tile padding) per request
const MAX_BBOX_DEG = 0.08; // ~9km at the equator — generous farm-site ceiling
const MAX_THRESHOLDS = 400; // guard against pathological min/max elevation ranges

type CacheEntry = { body: GeoJSON.FeatureCollection; expires: number };
const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 50;

function lonToTileX(lon: number, z: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** z);
}
function latToTileY(lat: number, z: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** z
  );
}
function pixelToLon(px: number, z: number): number {
  return (px / (TILE_SIZE * 2 ** z)) * 360 - 180;
}
function pixelToLat(py: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * py) / (TILE_SIZE * 2 ** z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

async function fetchTileElevations(z: number, x: number, y: number, token: string): Promise<number[][] | null> {
  const n = 2 ** z;
  if (x < 0 || y < 0 || x >= n || y >= n) return null; // off the world (padding wrapped past a pole)
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-dem-v1/${z}/${x}/${y}.pngraw?access_token=${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const png = PNG.sync.read(buf);
  const rows: number[][] = new Array(png.height);
  for (let row = 0; row < png.height; row++) {
    const cols = new Array(png.width);
    for (let col = 0; col < png.width; col++) {
      const idx = (row * png.width + col) * 4;
      const r = png.data[idx], g = png.data[idx + 1], b = png.data[idx + 2];
      cols[col] = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
    }
    rows[row] = cols;
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const minLon = parseFloat(searchParams.get('minLon') ?? '');
  const minLat = parseFloat(searchParams.get('minLat') ?? '');
  const maxLon = parseFloat(searchParams.get('maxLon') ?? '');
  const maxLat = parseFloat(searchParams.get('maxLat') ?? '');
  const interval = parseFloat(searchParams.get('interval') ?? '5') || 5;
  const major = parseFloat(searchParams.get('major') ?? '25') || 25;

  if ([minLon, minLat, maxLon, maxLat].some((v) => isNaN(v)) || minLon >= maxLon || minLat >= maxLat) {
    return NextResponse.json({ error: 'Invalid bbox — need minLon,minLat,maxLon,maxLat' }, { status: 400 });
  }
  if (maxLon - minLon > MAX_BBOX_DEG || maxLat - minLat > MAX_BBOX_DEG) {
    return NextResponse.json({ error: 'bbox too large for on-the-fly fine contours (site-scale only)' }, { status: 400 });
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 });

  const cacheKey = `${minLon.toFixed(4)},${minLat.toFixed(4)},${maxLon.toFixed(4)},${maxLat.toFixed(4)},${interval},${major}`;
  const cached = CACHE.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.body, { headers: { 'Cache-Control': 'public, max-age=300' } });
  }

  // Tile range covering the bbox, padded by 1 tile so isolines don't get
  // artificially truncated right at the requested edge.
  let tileXMin = lonToTileX(minLon, TILE_ZOOM) - 1;
  let tileXMax = lonToTileX(maxLon, TILE_ZOOM) + 1;
  // Latitude and tile-Y both run the "wrong way" — max lat gives the smaller tileY.
  let tileYMin = latToTileY(maxLat, TILE_ZOOM) - 1;
  let tileYMax = latToTileY(minLat, TILE_ZOOM) + 1;

  if (tileXMax - tileXMin + 1 > MAX_TILE_SPAN) tileXMax = tileXMin + MAX_TILE_SPAN - 1;
  if (tileYMax - tileYMin + 1 > MAX_TILE_SPAN) tileYMax = tileYMin + MAX_TILE_SPAN - 1;

  const tilesX = tileXMax - tileXMin + 1;
  const tilesY = tileYMax - tileYMin + 1;

  const tilePromises: Promise<{ x: number; y: number; rows: number[][] | null }>[] = [];
  for (let ty = tileYMin; ty <= tileYMax; ty++) {
    for (let tx = tileXMin; tx <= tileXMax; tx++) {
      tilePromises.push(
        fetchTileElevations(TILE_ZOOM, tx, ty, token).then((rows) => ({ x: tx, y: ty, rows }))
      );
    }
  }

  let tileResults;
  try {
    tileResults = await Promise.all(tilePromises);
  } catch {
    return NextResponse.json({ error: 'DEM tile fetch failed' }, { status: 502 });
  }
  if (tileResults.some((t) => !t.rows)) {
    return NextResponse.json({ error: 'DEM tile fetch incomplete for this area' }, { status: 502 });
  }

  // Stitch into one elevation grid.
  const gridW = tilesX * TILE_SIZE;
  const gridH = tilesY * TILE_SIZE;
  const grid: number[][] = new Array(gridH);
  for (let r = 0; r < gridH; r++) grid[r] = new Array(gridW);

  for (const { x, y, rows } of tileResults) {
    const originCol = (x - tileXMin) * TILE_SIZE;
    const originRow = (y - tileYMin) * TILE_SIZE;
    const cellRows = rows as number[][];
    for (let r = 0; r < TILE_SIZE; r++) {
      const destRow = grid[originRow + r];
      const srcRow = cellRows[r];
      for (let c = 0; c < TILE_SIZE; c++) destRow[originCol + c] = srcRow[c];
    }
  }

  // Min/max over the grid, rounded out to interval steps.
  let min = Infinity, max = -Infinity;
  for (let r = 0; r < gridH; r++) {
    for (let c = 0; c < gridW; c++) {
      const v = grid[r][c];
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const startEle = Math.floor(min / interval) * interval;
  const endEle = Math.ceil(max / interval) * interval;
  const thresholds: number[] = [];
  for (let t = startEle; t <= endEle; t += interval) thresholds.push(t);
  const cappedThresholds = thresholds.slice(0, MAX_THRESHOLDS);

  const originTileX = tileXMin;
  const originTileY = tileYMin;
  const toLonLat = (px: number, py: number): [number, number] => {
    const globalPx = originTileX * TILE_SIZE + px;
    const globalPy = originTileY * TILE_SIZE + py;
    return [pixelToLon(globalPx, TILE_ZOOM), pixelToLat(globalPy, TILE_ZOOM)];
  };

  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  for (const t of cappedThresholds) {
    // Snap to nearest multiple check with float-safe rounding.
    const isMajor = Math.abs(Math.round(t / major) * major - t) < 1e-6;
    const paths = isoLines(grid, t, { noQuadTree: true });
    for (const path of paths) {
      if (path.length < 2) continue;
      const coords = path.map(([px, py]) => toLonLat(px, py));
      features.push({
        type: 'Feature',
        properties: { ele: Math.round(t), index: isMajor ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }
  }

  const body: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

  if (CACHE.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey !== undefined) CACHE.delete(oldestKey);
  }
  CACHE.set(cacheKey, { body, expires: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=300' } });
}
