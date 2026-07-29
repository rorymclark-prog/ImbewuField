import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARCGIS_API_KEY,
  ESRI_MAX_NATIVE_ZOOM,
  esriTileUrl,
  fetchEsriBasemapDataUrl,
  lngLatToWorldPx,
  planEsriTiles,
  tileCount,
  tileDestRect,
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

test('tile URLs are row/column ordered the way the ArcGIS service expects, with the token appended', () => {
  // ArcGIS serves /tile/{z}/{row}/{col} — y BEFORE x. Swapping them returns a real image of
  // somewhere else entirely, which is exactly the kind of wrong that renders fine.
  const url = esriTileUrl(18, 154346, 152099, 'test-token');
  assert.equal(url.includes('/18/152099/154346?'), true, `path order wrong: ${url}`);
  assert.equal(url.endsWith('token=test-token'), true, `token not appended: ${url}`);
});

test('fetchEsriBasemapDataUrl refuses to request tiles when no ArcGIS key is configured', async () => {
  // Unauthenticated Esri World Imagery is licensed for personal/noncommercial use only (see the
  // ARCGIS_API_KEY comment in lib/basemap-imagery.ts) — ImbewuField invoices farmers, so firing a
  // tile request with no token would be a licence breach. The check must happen before any network
  // or canvas call, which is exactly what makes it testable here with no DOM available.
  assert.equal(ARCGIS_API_KEY, '', 'this test assumes no key is configured in the test environment');
  await assert.rejects(() => fetchEsriBasemapDataUrl(LON, LAT, ZOOM, IMG_W, IMG_H));
});

// THE SEAM. Drawing each tile at its raw fractional rect ruled a dark grid across the photo on all
// eight sheets — canvas antialiases a fractional edge against the empty canvas, and the JPEG flatten
// turns that soft edge black. Measured on sheet 02 before the fix: a full-width dark line at y≈322
// and a full-height one at x≈1540. These assertions are the arithmetic that cannot produce one.
test('adjacent tiles share an exact integer edge, so no seam can be antialiased or left blank', () => {
  const plan = planEsriTiles(LON, LAT, ZOOM, IMG_W, IMG_H);
  assert.ok(plan.tx1 > plan.tx0 && plan.ty1 > plan.ty0, 'need at least a 2x2 grid to have a seam');

  for (let ty = plan.ty0; ty <= plan.ty1; ty++) {
    for (let tx = plan.tx0; tx <= plan.tx1; tx++) {
      const r = tileDestRect(plan, tx, ty);
      for (const [name, v] of Object.entries(r)) {
        assert.equal(Number.isInteger(v), true, `tile ${tx},${ty} ${name} is fractional: ${v}`);
      }
      assert.ok(r.dw > 0 && r.dh > 0, `tile ${tx},${ty} is degenerate`);

      if (tx < plan.tx1) {
        const right = tileDestRect(plan, tx + 1, ty);
        assert.equal(r.dx + r.dw, right.dx, `horizontal seam between ${tx} and ${tx + 1}`);
      }
      if (ty < plan.ty1) {
        const below = tileDestRect(plan, tx, ty + 1);
        assert.equal(r.dy + r.dh, below.dy, `vertical seam between ${ty} and ${ty + 1}`);
      }
    }
  }
});

test('the snapped tile grid still covers the whole output raster, to within a pixel', () => {
  // Rounding edges must not shrink the mosaic away from the frame it is standing in for: a short
  // grid would expose the grey backfill as a border, which is the seam again wearing a hat.
  const plan = planEsriTiles(LON, LAT, ZOOM, IMG_W, IMG_H);
  const first = tileDestRect(plan, plan.tx0, plan.ty0);
  const last = tileDestRect(plan, plan.tx1, plan.ty1);
  assert.ok(first.dx <= 0 && first.dy <= 0, 'grid starts inside the raster, leaving a bare edge');
  assert.ok(last.dx + last.dw >= plan.outW, 'grid ends before the raster does');
  assert.ok(last.dy + last.dh >= plan.outH, 'grid ends above the bottom of the raster');
});

test('a far-south and a far-north site both plan without wrapping', () => {
  for (const [lng, lat] of [[31.96, -34.8], [28.0, -22.1], [18.42, -33.92]] as const) {
    const plan = planEsriTiles(lng, lat, ZOOM, IMG_W, IMG_H);
    assert.ok(plan.tx1 >= plan.tx0 && plan.ty1 >= plan.ty0, `${lng},${lat} produced an empty range`);
    assert.ok(Number.isFinite(plan.scale) && plan.scale > 0);
  }
});
