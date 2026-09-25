// Split out of app/api/contours/route.ts: a Next.js route file may only export its HTTP method
// handlers and a small fixed set of config fields — exporting a plain helper function from it
// fails the production build ("is not a valid Route export field"), so the pure cache-key logic,
// and the tile constants it depends on, live here instead.

export const TILE_ZOOM = 14; // native maxzoom of mapbox.mapbox-terrain-dem-v1
export const TILE_SIZE = 256; // un-upscaled (@1x) terrain-RGB tile size

// One DEM pixel at TILE_ZOOM — finer than this is below the data's own resolution, so two
// requests whose bboxes differ by less than a pixel are the same request in every way that
// matters. A raw-float cache key (the previous `toFixed(7)`, ~1.1cm) meant the debounced
// pan/zoom handler in components/Map.tsx — or floating-point drift across animation frames —
// could send a bbox that differs from the last one by a fraction of a pixel and miss the cache on
// every single call, which is what made the cache trivially bypassed: it never actually coalesced
// the near-duplicate requests it exists to coalesce. Snapping to the pixel grid before keying
// fixes that without losing farm-scale identity: at ~9.5m per pixel (equator), two distinct
// smallholdings never land on the same key, only the same site's own jitter does.
const CACHE_GRID_DEG = 360 / 2 ** TILE_ZOOM / TILE_SIZE;

function snapToGrid(value: number, grid: number): number {
  return Math.round(value / grid) * grid;
}

export function contourCacheKey(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number,
  interval: number,
  major: number,
): string {
  const snap = (v: number) => snapToGrid(v, CACHE_GRID_DEG).toFixed(7);
  return `${snap(minLon)},${snap(minLat)},${snap(maxLon)},${snap(maxLat)},${interval},${major}`;
}
