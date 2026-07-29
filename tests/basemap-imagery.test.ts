import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ESRI_MAX_NATIVE_ZOOM,
  esriTileUrl,
  lngLatToWorldPx,
  planEsriTiles,
  tileCount,
} from '../lib/basemap-imagery.ts';

// The failure this file exists to prevent is not a crash. If the stitched photo covers even
// slightly different ground than the Mapbox still it replaces, every overlay the projector places
// — beds, zones, swales, the boundary fence — slides off the farm, and the sheet still looks
// completely plausible. Nobody would catch that by eye. So the ground extent is asserted directly.

const LON = 31.963044;
const LAT = -27.726231;
const ZOOM = 19.5;
const IMG_W = 920;
const IMG_H = 600;

/** Invert lngLatToWorldPx so a plan's crop window can be checked in degrees. */
function worldPxToLngLat(x: number, y: number, zoom: number): [number, number] {
  const scale = 256 * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (y / scale);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
}

test('the stitched frame covers exactly the ground the Mapbox still covered', () => {
  const plan = planEsriTiles(LON, LAT, ZOOM, IMG_W, IMG_H);

  // What Mapbox would have covered: imgW × imgH world pixels at the REQUESTED zoom.
  const [cx, cy] = lngLatToWorldPx(LON, LAT, ZOOM);
  const [wantW, wantN] = worldPxToLngLat(cx - IMG_W / 2, cy - IMG_H / 2, ZOOM);
  const [wantE, wantS] = worldPxToLngLat(cx + IMG_W / 2, cy + IMG_H / 2, ZOOM);

  // What the plan will actually crop, expressed at its own tile zoom.
  const [gotW, gotN] = worldPxToLngLat(plan.x0, plan.y0, plan.tileZoom);
  const [gotE, gotS] = worldPxToLngLat(plan.x1, plan.y1, plan.tileZoom);

  // Sub-millidegree agreement — ~10 cm on the ground, far inside one output pixel.
  const near = (a: number, b: number, what: string) =>
    assert.ok(Math.abs(a - b) < 1e-7, `${what}: ${a} vs ${b}`);
  near(gotW, wantW, 'west edge');
  near(gotE, wantE, 'east edge');
  near(gotN, wantN, 'north edge');
  near(gotS, wantS, 'south edge');
});

test('tiles are never sampled above the zoom Esri actually holds imagery for', () => {
  // Above z18 the service returns a fixed placeholder tile, so asking deeper trades a real photo
  // for a blank one. The design frame clamps at 19.5, so this is the live case, not a hypothetical.
  for (const z of [17, 18, 19, 19.5, 21]) {
    const plan = planEsriTiles(LON, LAT, z, IMG_W, IMG_H);
    assert.ok(plan.tileZoom <= ESRI_MAX_NATIVE_ZOOM, `zoom ${z} sampled at ${plan.tileZoom}`);
  }
  // Below the ceiling it still tracks the request rather than pinning to the ceiling.
  assert.equal(planEsriTiles(LON, LAT, 15, IMG_W, IMG_H).tileZoom, 15);
});

test('the output raster is the @2x size the caller already expects', () => {
  const plan = planEsriTiles(LON, LAT, ZOOM, IMG_W, IMG_H);
  assert.equal(plan.outW, IMG_W * 2);
  assert.equal(plan.outH, IMG_H * 2);

  // And the scale maps the crop window onto exactly that raster.
  assert.ok(Math.abs((plan.x1 - plan.x0) * plan.scale - plan.outW) < 1e-6);
});

test('the tile range covers the crop window with no gap at either edge', () => {
  const plan = planEsriTiles(LON, LAT, ZOOM, IMG_W, IMG_H);
  assert.ok(plan.tx0 * 256 <= plan.x0, 'left tile starts at or before the crop');
  assert.ok((plan.tx1 + 1) * 256 >= plan.x1, 'right tile ends at or after the crop');
  assert.ok(plan.ty0 * 256 <= plan.y0, 'top tile starts at or before the crop');
  assert.ok((plan.ty1 + 1) * 256 >= plan.y1, 'bottom tile ends at or after the crop');
  // A 172 m frame at z18 is a handful of tiles — a plan demanding hundreds means the maths broke.
  assert.ok(tileCount(plan) >= 1 && tileCount(plan) <= 12, `tile count ${tileCount(plan)}`);
});

test('a degenerate frame yields a finite plan instead of a divide-by-zero', () => {
  const plan = planEsriTiles(LON, LAT, ZOOM, 0, 0);
  assert.ok(Number.isFinite(plan.scale));
  assert.ok(Number.isFinite(plan.x0) && Number.isFinite(plan.y1));
});

test('tile URLs are row/column ordered the way the ArcGIS service expects', () => {
  // ArcGIS serves /tile/{z}/{row}/{col} — y BEFORE x. Swapping them returns a real image of
  // somewhere else entirely, which is exactly the kind of wrong that renders fine.
  assert.equal(esriTileUrl(18, 154346, 152099).endsWith('/18/152099/154346'), true);
});

test('a far-south and a far-north site both plan without wrapping', () => {
  for (const [lng, lat] of [[31.96, -34.8], [28.0, -22.1], [18.42, -33.92]] as const) {
    const plan = planEsriTiles(lng, lat, ZOOM, IMG_W, IMG_H);
    assert.ok(plan.tx1 >= plan.tx0 && plan.ty1 >= plan.ty0, `${lng},${lat} produced an empty range`);
    assert.ok(Number.isFinite(plan.scale) && plan.scale > 0);
  }
});
