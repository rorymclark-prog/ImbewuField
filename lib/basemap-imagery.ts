// Where the aerial photo under every plan comes from.
//
// WHY THIS FILE EXISTS. The app asked Mapbox for a satellite still at the design frame's zoom
// (~19.5) and drew it under all eight sheets. Over rural KwaZulu-Natal — which is the market —
// Mapbox has no imagery at that resolution, so it upsampled a coarse tile and returned a red-brown
// smear with no trees, paths or field edges in it. Measured at the demo farm (-27.726231,
// 31.963044) on 2026-07-29: Mapbox tile bytes FALL as zoom rises (z14 55.7 kB → z20 12.3 kB),
// which is the signature of one source image being blown up over and over. Esri's World Imagery
// over the same ground holds steady (z14 12.1 kB → z18 16.2 kB) and then returns a fixed 2 521-byte
// "no data" placeholder at z19 — the signature of real imagery that stops at z18.
//
// So the blur was never ours to fix in the renderer: the pixels do not exist at Mapbox. Clamping
// the requested zoom cannot recover detail that was never there. Only a different source can.
//
// THE ONE INVARIANT. `makeMercatorProjector` places every overlay — beds, zones, swales, the
// boundary fence — by assuming the photo is a Mapbox static image of exactly `imgW × imgH` logical
// pixels centred on (centerLng, centerLat) at `zoom`, rendered @2x. A stitched image that covers
// even slightly different ground would slide every element off the farm while still looking
// perfectly plausible. So `fetchEsriBasemap` reproduces that extent exactly and the projector is
// left untouched. The tile zoom it samples from is an internal detail; the ground extent is not.
//
// ATTRIBUTION IS NOT OPTIONAL. Esri's imagery must be credited wherever it is shown. The credit
// string travels with the image so a caller cannot forget it.

/** Mapbox stops holding real detail well below the zoom the design frame asks for. */
export const MAPBOX_PROVIDER = 'mapbox' as const;
/** Esri World Imagery — real detail to ~z18 over rural South Africa. */
export const ESRI_PROVIDER = 'esri' as const;

export type BasemapProvider = typeof MAPBOX_PROVIDER | typeof ESRI_PROVIDER;

/**
 * The licensed Esri key, or '' when none is configured.
 *
 * THE OPEN ENDPOINT IS NOT AN OPTION AND IS DELIBERATELY NOT IN THIS FILE. Esri's World Imagery is
 * reachable without any key at server.arcgisonline.com, and that is how this was first prototyped —
 * but ArcGIS Online content is licensed for "personal or noncommercial use", where noncommercial
 * means the service is provided at no charge and generates no income. ImbewuField invoices farmers
 * and sells paid renders, so it is commercial use and that endpoint would be a licence breach. It
 * was removed rather than left behind a flag, because a flag is something somebody eventually flips.
 *
 * The licensed route is ArcGIS Location Platform, which explicitly permits unlimited commercial
 * applications and includes 2 000 000 basemap tiles a month free. A plan frame costs ~4 tiles, so
 * that free tier is on the order of half a million plans a month.
 */
export const ARCGIS_API_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ARCGIS_API_KEY) || '';

/**
 * Which imagery the app draws under a plan.
 *
 * NOT A HAND-FLIPPED CONSTANT. It follows the key: configure NEXT_PUBLIC_ARCGIS_API_KEY and every
 * plan is drawn on Esri's imagery; leave it unset and nothing changes from Mapbox. That way the
 * switch cannot be thrown before the licence exists to back it, and turning it on later needs no
 * code change at all.
 *
 * Why it is worth turning on, measured 2026-07-29 across eight rural sites in seven provinces:
 * Esri holds real imagery to z18 everywhere tested, then serves an identical 2 521-byte placeholder
 * at z19; Mapbox's tile bytes fall monotonically with zoom at every one of those sites, which is the
 * signature of a single coarse image being enlarged. Compared side by side at Ubhejane (KZN) and
 * Mthatha (Eastern Cape) — 700 km apart — Esri resolves individual trees, footpaths, fence lines and
 * parked vehicles where Mapbox resolves nothing.
 */
export function satelliteProvider(): BasemapProvider {
  return ARCGIS_API_KEY ? ESRI_PROVIDER : MAPBOX_PROVIDER;
}

/** Credit line for whatever provider is live, or '' when none is required.
 *
 *  Esri's imagery must be credited wherever it is shown — this is a licence term, not a courtesy,
 *  so the string travels with the provider rather than being left to each sheet to remember. */
export function basemapAttribution(provider: BasemapProvider = satelliteProvider()): string {
  return provider === ESRI_PROVIDER ? ESRI_ATTRIBUTION : '';
}

/**
 * Highest zoom Esri's World Imagery actually holds. The service advertises deeper levels
 * worldwide, but over the rural SA sites this app targets it stops at 18 and serves an identical
 * placeholder tile above that — sampling higher would trade a real photo for a blank one.
 */
export const ESRI_MAX_NATIVE_ZOOM = 18;

/** Required credit for Esri World Imagery. Rendered on any sheet that uses it. */
export const ESRI_ATTRIBUTION = 'Imagery: Esri, Maxar, Earthstar Geographics';

/** ArcGIS Location Platform's licensed World Imagery tiles. Same /tile/{z}/{row}/{col} shape as the
 *  open ArcGIS Online service, on the authenticated host and with a token. */
export const ESRI_TILE_URL =
  'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile';

const TILE_PX = 256;

/** World-pixel coordinate at a given zoom (Web Mercator, 256px tiles). */
export function lngLatToWorldPx(lng: number, lat: number, zoom: number): [number, number] {
  const scale = TILE_PX * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const y = (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * scale;
  return [x, y];
}

export interface TilePlan {
  /** Zoom the tiles are sampled from (never above the provider's real coverage). */
  tileZoom: number;
  /** Inclusive tile index range covering the frame. */
  tx0: number; tx1: number; ty0: number; ty1: number;
  /** Frame edges in tileZoom world pixels — the crop window inside the stitched grid. */
  x0: number; y0: number; x1: number; y1: number;
  /** Stitched-grid px → output px. */
  scale: number;
  /** Output raster size (the @2x raster the caller expects). */
  outW: number; outH: number;
}

/**
 * Work out which tiles cover the SAME ground as a Mapbox static image of `imgW × imgH` logical
 * pixels centred on (centerLng, centerLat) at `zoom`, rendered at `pixelRatio`.
 *
 * Pure arithmetic and separately tested — this is where a silent misalignment would be born.
 */
export function planEsriTiles(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  pixelRatio = 2,
  maxNativeZoom = ESRI_MAX_NATIVE_ZOOM,
): TilePlan {
  const tileZoom = Math.max(0, Math.min(maxNativeZoom, Math.round(zoom)));
  // Frame extent in the REQUESTED zoom's world pixels, then rescaled to the tile zoom.
  const [cx, cy] = lngLatToWorldPx(centerLng, centerLat, zoom);
  const k = Math.pow(2, tileZoom - zoom);
  const x0 = (cx - imgW / 2) * k;
  const x1 = (cx + imgW / 2) * k;
  const y0 = (cy - imgH / 2) * k;
  const y1 = (cy + imgH / 2) * k;

  const outW = Math.round(imgW * pixelRatio);
  const outH = Math.round(imgH * pixelRatio);
  // Guard against a degenerate frame producing a divide-by-zero scale.
  const spanX = Math.max(x1 - x0, 1e-9);

  return {
    tileZoom,
    tx0: Math.floor(x0 / TILE_PX), tx1: Math.floor((x1 - 1e-9) / TILE_PX),
    ty0: Math.floor(y0 / TILE_PX), ty1: Math.floor((y1 - 1e-9) / TILE_PX),
    x0, y0, x1, y1,
    scale: outW / spanX,
    outW, outH,
  };
}

export function esriTileUrl(z: number, x: number, y: number): string {
  return `${ESRI_TILE_URL}/${z}/${y}/${x}`;
}

/** Number of tile requests a plan will make — callers log this rather than fetch blind. */
export function tileCount(plan: TilePlan): number {
  return (plan.tx1 - plan.tx0 + 1) * (plan.ty1 - plan.ty0 + 1);
}

/**
 * Stitch the Esri tiles covering a frame into one data URL matching the Mapbox still it replaces.
 *
 * Browser only — needs canvas. The tiles are served with `Access-Control-Allow-Origin: *`, so the
 * canvas stays untainted and PNG/PDF export keeps working; that is the whole reason the image is
 * inlined rather than referenced, so it is verified in `tests/` and must not regress.
 *
 * A tile that fails to load leaves its patch empty rather than rejecting the whole basemap: a plan
 * missing one corner of photo is still usable, a plan with no photo at all is not.
 */
export async function fetchEsriBasemapDataUrl(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  pixelRatio = 2,
): Promise<string> {
  const plan = planEsriTiles(centerLng, centerLat, zoom, imgW, imgH, pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = plan.outW;
  canvas.height = plan.outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not open a canvas for the basemap.');

  const load = (url: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const jobs: Promise<void>[] = [];
  for (let ty = plan.ty0; ty <= plan.ty1; ty++) {
    for (let tx = plan.tx0; tx <= plan.tx1; tx++) {
      jobs.push(
        load(esriTileUrl(plan.tileZoom, tx, ty)).then((img) => {
          if (!img) return;
          const dx = (tx * TILE_PX - plan.x0) * plan.scale;
          const dy = (ty * TILE_PX - plan.y0) * plan.scale;
          const d = TILE_PX * plan.scale;
          ctx.drawImage(img, dx, dy, d, d);
        }),
      );
    }
  }
  await Promise.all(jobs);
  return canvas.toDataURL('image/jpeg', 0.9);
}
