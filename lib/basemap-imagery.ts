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
// WRITTEN EXACTLY LIKE THIS ON PURPOSE — `process.env.NEXT_PUBLIC_X`, no optional chaining, no
// destructuring, no dynamic key. Next.js inlines NEXT_PUBLIC_* vars into the client bundle by
// TEXTUAL SUBSTITUTION at build time, so it only replaces that literal form. The first version of
// this line read `process.env?.NEXT_PUBLIC_ARCGIS_API_KEY` behind a `typeof process` guard, which
// looks more defensive and is strictly worse: the guard defeated the substitution, the variable
// stayed an empty runtime lookup in the browser, and the app silently kept using Mapbox with a
// perfectly valid key sitting in .env.local. Nothing errored — satelliteProvider() just saw '' and
// answered 'mapbox', which is exactly what it is supposed to do when there is no key.
// Every other file here (design-canvas.ts, Map.tsx, NgoDashboard.tsx) uses the plain form. Match it.
export const ARCGIS_API_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY ?? '';

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
  // TWO TILE CONVENTIONS MEET HERE, AND THEY ARE A FACTOR OF TWO APART.
  //
  // The design frame's `zoom` is Mapbox GL's: a 512-pixel world tile (lib/design-canvas TILE=512),
  // which is what frame.mPerPx and every traced point are computed against. Esri's tiles are the
  // classic 256-pixel kind, and at the SAME zoom number a 256-px world is half the size of a
  // 512-px one. This planner used the frame's zoom directly in a 256-px world, so it laid the
  // frame over twice the ground it was asked for and the returned photograph came back at half
  // scale — the farm drawn on top no longer matched the land underneath. (Rory: "when you changed
  // to esri everything shrank by a facto of half".)
  //
  // Converting once, here, keeps the rest of the file in Esri's own convention (tile indices,
  // the native-zoom ceiling and the tile URLs are all 256-px levels) while callers keep passing
  // the frame zoom they already hold.
  const zoom256 = zoom + 1;
  const tileZoom = Math.max(0, Math.min(maxNativeZoom, Math.round(zoom256)));
  // Frame extent in the REQUESTED zoom's world pixels, then rescaled to the tile zoom.
  const [cx, cy] = lngLatToWorldPx(centerLng, centerLat, zoom256);
  const k = Math.pow(2, tileZoom - zoom256);
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

/** ArcGIS Location Platform requires the token on every tile request — an unauthenticated request
 *  to this host 403s outright, so `token` is a required parameter rather than an optional one a
 *  caller could forget. */
export function esriTileUrl(z: number, x: number, y: number, token: string): string {
  // Encoded, like buildSatelliteUrl does with the Mapbox token two files away. A key is expected to
  // be URL-safe, but "expected to be" is how a key with a '+' in it silently fetches nothing.
  return `${ESRI_TILE_URL}/${z}/${y}/${x}?token=${encodeURIComponent(token)}`;
}

/** Number of tile requests a plan will make — callers log this rather than fetch blind. */
export function tileCount(plan: TilePlan): number {
  return (plan.tx1 - plan.tx0 + 1) * (plan.ty1 - plan.ty0 + 1);
}

export interface TileDestRect { dx: number; dy: number; dw: number; dh: number }

/**
 * Where one tile lands in the output raster, snapped so NEIGHBOURING TILES SHARE AN EXACT EDGE.
 *
 * THIS IS A SEAM FIX, and the seam was very visible. The first version drew each tile at its raw
 * fractional position and size:
 *
 *     ctx.drawImage(img, (tx * 256 - x0) * scale, (ty * 256 - y0) * scale, 256 * scale, 256 * scale)
 *
 * At the design frame's numbers (zoom 19.5 sampled from z18) `256 * scale` is 1448.15 px, so every
 * tile landed on fractional pixels. Canvas answers a fractional destination rect by ANTIALIASING the
 * outer edge against whatever is beneath it — here a transparent canvas — and `toDataURL('image/
 * jpeg')` then flattens transparent to BLACK. The result was a dark 2–3 px hairline at every
 * internal tile boundary: measured on sheet 02 as a full-width line at y≈322 and a full-height line
 * at x≈1540, ~20 RGB units below their neighbours, i.e. ~20× the surrounding row-to-row noise.
 * It read as a grid ruled across the farmer's aerial photo, on all eight sheets at once.
 * (Rory, seeing it: "why is there so many weird lines?")
 *
 * Rounding each EDGE — rather than rounding a position and adding a fractional width — is what
 * makes the fix exact: tile i's right edge and tile i+1's left edge are the same rounded expression,
 * so they are the same integer. No gap to show through, no overlap to double-darken, no fractional
 * edge to antialias. The cost is that the photo can sit at most half a pixel from its ideal spot in
 * a 1920 px raster (0.03%), which is nowhere near the ~5× enlargement the imagery is already drawn
 * at, and it moves the PHOTO only — `makeMercatorProjector` is untouched, so no overlay shifts.
 */
export function tileDestRect(plan: TilePlan, tx: number, ty: number): TileDestRect {
  const left = Math.round((tx * TILE_PX - plan.x0) * plan.scale);
  const right = Math.round(((tx + 1) * TILE_PX - plan.x0) * plan.scale);
  const top = Math.round((ty * TILE_PX - plan.y0) * plan.scale);
  const bottom = Math.round(((ty + 1) * TILE_PX - plan.y0) * plan.scale);
  return { dx: left, dy: top, dw: right - left, dh: bottom - top };
}

/** What an unloadable tile leaves behind. Neutral mid-grey, never transparent: this canvas is
 *  flattened to JPEG, and transparent flattens to solid black — a missing corner should read as
 *  "no photo here", not as a hole burnt in the plan. */
export const BASEMAP_GAP_FILL = '#8A8A80';

/** The frame fields any basemap provider needs. Structural, so both `CanvasFrame` and the design
 *  studio's own fit object satisfy it without importing each other. */
export interface BasemapFrame {
  centerLng: number;
  centerLat: number;
  zoom: number;
  imgW: number;
  imgH: number;
}

/**
 * THE ONE PLACE THAT DECIDES WHO SERVES THE PHOTO. Every surface that needs a basemap calls this.
 *
 * It exists because wiring the provider per-surface went wrong immediately: the first version was
 * added to `GeometryDesignStudio`, which turned out not to be what `/design` renders at all — so a
 * valid API key sat in .env.local, the code was correct, every test passed, and the farmer-facing
 * sheets quietly kept drawing Mapbox. Nothing errored, because falling back to Mapbox is exactly
 * what the code is supposed to do when there is no key. A second provider branch somewhere else is
 * how that happens twice.
 *
 * `mapboxUrl` is whatever the caller already computed for Mapbox — passing it in keeps this
 * function ignorant of tokens and URL shapes it has no business knowing.
 */
export async function fetchBasemapForFrame(
  frame: BasemapFrame,
  mapboxUrl: string,
  fetchMapbox: (url: string) => Promise<string>,
): Promise<string> {
  if (satelliteProvider() === ESRI_PROVIDER) {
    return fetchEsriBasemapDataUrl(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH);
  }
  return fetchMapbox(mapboxUrl);
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
  // Refuse before touching the network, not after. Firing tile requests with no token either 403s
  // or — worse — is accepted by some other tier, which would put the app back in the noncommercial
  // licence breach ARCGIS_API_KEY exists to prevent (see the comment on that constant above).
  if (!ARCGIS_API_KEY) {
    throw new Error(
      'No ArcGIS API key configured (NEXT_PUBLIC_ARCGIS_API_KEY) — refusing to request Esri imagery without one.',
    );
  }
  const plan = planEsriTiles(centerLng, centerLat, zoom, imgW, imgH, pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = plan.outW;
  canvas.height = plan.outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not open a canvas for the basemap.');
  // Opaque BEFORE any tile lands. The output is flattened to JPEG, which has no alpha channel, so
  // anything still transparent at that point becomes black — see tileDestRect for the seam this
  // caused. Painting first means the worst case is a grey patch, never a black one.
  ctx.fillStyle = BASEMAP_GAP_FILL;
  ctx.fillRect(0, 0, plan.outW, plan.outH);

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
        load(esriTileUrl(plan.tileZoom, tx, ty, ARCGIS_API_KEY)).then((img) => {
          if (!img) return;
          const { dx, dy, dw, dh } = tileDestRect(plan, tx, ty);
          ctx.drawImage(img, dx, dy, dw, dh);
        }),
      );
    }
  }
  await Promise.all(jobs);
  return canvas.toDataURL('image/jpeg', 0.9);
}
