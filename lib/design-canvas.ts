// Design Studio — shared canvas types, storage, and scale-accurate map math.
//
// Coordinates in every shape here are NORMALISED [0..1] within the CanvasFrame (x right,
// y down), so they survive resizes and always line up with the satellite underlay. The
// map-math functions below are adapted from components/GeometryDesignStudio.tsx (same
// Web-Mercator projection the Mapbox Static Images API uses) so the Design Studio's
// satellite fit can never drift from the rest of the app.

import type { Geometry, Position } from 'geojson';
import type { DesignLayer } from '@/lib/design-studio';
import { isCompassDirection16, type LocalWindObservation } from '@/lib/local-wind';
import { resolveBaseAlign } from '@/lib/base-photo-align';
import {
  accountLocalStorageKey,
  activeAccountLocalStorageKey,
  activeAccountUid,
} from '@/lib/account-local-storage';

// ── Shared types (verbatim contract) ──────────────────────────────────────────

export interface CanvasFrame {
  centerLng: number;
  centerLat: number;
  zoom: number;
  imgW: number;
  imgH: number; // logical px of the satellite image (e.g. 960x640)
  mPerPx: number; // metres per logical pixel at this zoom+lat
  satDataUrl: string | null; // inlined base image — the SATELLITE, or the farmer's photo when one
  // is in use. Everything downstream (sheets, AI composites, exports) reads this one field, which
  // is why the custom base is swapped INTO it rather than carried beside it.
  /**
   * The true satellite tile, kept alongside satDataUrl ONLY while a custom base is in use, so the
   * Design Studio can paint the farmer's photo over the satellite and let them line the two up.
   * Deliberately additive: nothing but the Studio's alignment view reads it, so no sheet, export
   * or composite changes behaviour because it exists.
   */
  underlayDataUrl?: string | null;
}

/**
 * EXISTING OR PROPOSED — the one distinction a plan lives or dies on.
 *
 * Rory: "we need to audit how to handle structures new and old… my thoughts is that there is a
 * big overlap but both can belong to different layers? new and old structures basically? so
 * duplicate tools can open in both but they're recorded under different labels, for example
 * existing fence versus new fence around a field"; then, decisively: "even existing water tanks
 * for example etc etc must all be there".
 *
 * He is right about the distinction and I think wrong about duplicating the tools, for three
 * reasons:
 *
 * 1. IT IS NOT A STRUCTURES PROBLEM. An existing orchard, an existing swale, an existing tank and
 *    an existing fence are all the same question. Duplicating the structures catalog would answer
 *    it for structures and leave every other layer as it was.
 *
 * 2. TWO CATALOGS DRIFT. This repo has already been bitten by exactly that: an audit of its plant
 *    data found five separate datasets describing overlapping plants, none of them agreeing on
 *    which fields exist. A parallel "existing" catalog would be the sixth.
 *
 * 3. THE APP ALREADY HAS THIS CONCEPT — badly. Right now "existing" is inferred from WHICH STEP
 *    something was drawn on: the Base step traces what is already there, so its ground features
 *    are treated as existing fabric (the render prompt even says so: "EXISTING SITE FABRIC — WHAT
 *    IS ALREADY THERE, NOT PART OF THIS DESIGN… redrawn, never grown"). That inference is exactly
 *    why there is no way to draw an existing fence: the fence tool lives on a later step, so the
 *    only thing it can produce is a proposal.
 *
 * So it is ONE FIELD on everything, not two of every tool. What that unlocks beyond the label:
 * a bill of quantities that prices the work rather than the farm (costing a fence that is already
 * standing is not a rounding error, it is a wrong number in front of a funder), an implementation
 * schedule that only schedules what is not built, and a monitoring sheet that finally has a real
 * baseline to diff against.
 *
 * Undefined is not "unknown" — it is every design saved before this existed, and it has to keep
 * meaning what it meant. statusOf() resolves it the way the app already behaved: traced ground
 * fabric reads as existing, everything else as proposed.
 */
export type ElementStatus = 'existing' | 'proposed';

/** What this shape is, honouring saved designs that predate the field. */
export function statusOf(shape: { status?: ElementStatus; feature?: GroundFeatureKind }): ElementStatus {
  if (shape.status === 'existing' || shape.status === 'proposed') return shape.status;
  // A traced ground/built feature is, by the definition of the step that draws it, already there.
  return shape.feature ? 'existing' : 'proposed';
}

/** What a newly created shape should be, given where the farmer is standing in the flow. */
export function defaultStatusForStep(step: WizardStep): ElementStatus {
  // The Base step's whole instruction is "Draw what's already here".
  return step === 'base' ? 'existing' : 'proposed';
}

export interface PlacedItem {
  id: string;
  defId: string; // references DesignElementDef.id
  x: number;
  y: number; // normalised [0..1] centre position in the frame
  wM?: number;
  hM?: number; // optional per-item size override in metres
  rot?: number; // clockwise rotation in degrees (0 = footprint's natural orientation). Only
  // meaningful for rect-shaped elements (strips/beds/rows) — circles are rotation-invariant.
  label?: string;
  note?: string;
  /** Already on the farm, or part of the proposal. See ElementStatus above. */
  status?: ElementStatus;
}

// Real ground/built features the farmer traces on their own site (house outline, paving,
// lawn, existing veg garden, orchard, cleared ground) — WHAT IS THERE, as opposed to the
// permaculture effort-zones. Rides on ZoneShape via the optional `feature` tag so it reuses
// the whole zone draw/edit/persist/adopt engine rather than a parallel shape system.
import polygonClipping from 'polygon-clipping';

export type GroundFeatureKind =
  | 'house' | 'patio' | 'driveway' | 'lawn' | 'veg_garden' | 'orchard' | 'cleared' | 'boundary'
  | 'terrace_bank'; // the retained/graded riser face between two levels — see docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §2

export interface ZoneShape {
  id: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
  points: Array<[number, number]>; // normalised ring
  // When set, this ring is a real ground/built feature (filled, labelled) rather than a
  // permaculture effort-zone ring; `zone` then rides along as an inert value. Optional so
  // it is JSON-safe and survives migrateStateToFrame's spread untouched.
  feature?: GroundFeatureKind;
  /** Already on the farm, or part of the proposal. See ElementStatus above. */
  status?: ElementStatus;
  // Optional custom name shown on the label (tap the label to rename); falls back to the ground
  // feature's default label when unset.
  name?: string;
  // Optional normalised offset of the name label from the ring centroid — lets the farmer drag a
  // label off a feature it overlaps (e.g. a lawn wrapping the house). Undefined = at centroid.
  labelDx?: number;
  labelDy?: number;
  // Farmer-entered signed level in metres, relative to a site datum the farmer picks
  // (house-floor-level = 0.0 is the obvious default, but it's whatever the farmer typed against).
  // Only meaningful when `feature` is set; independent of WHICH kind — a lawn, a veg garden, an
  // orchard platform, or a terrace_bank riser can each carry one. Optional so it stays JSON-safe
  // and survives migrateStateToFrame's spread untouched, same reasoning as `feature` itself.
  levelM?: number;
  // An optional farmer-PACED slope measurement (%) for this specific ring, used ONLY when
  // feature === 'terrace_bank'. When present, effectiveSlopeForRing (lib/terracing.ts) prefers
  // this over the whole-site SRTM average, because it is the farmer's own on-site measurement of
  // the exact spot, not a ~1 km-baseline approximation. Absent by default — most farmers won't
  // pace a slope, and the whole-site fallback must degrade honestly, not silently assume a
  // farmer input exists. See docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §2/§3.
  measuredSlopePct?: number;
}

export interface LineShape {
  id: string;
  // 'greywater' is the subsurface run from the house diverter to the basins it feeds. It was
  // missing for a long time while the water PROMPT described it in detail — so the sheet asked
  // for a violet greywater line that a farmer had no tool to draw, and the only way the model
  // could satisfy that was to invent one. Purple/violet follows the reclaimed-water pipe
  // convention, and is deliberately more saturated than the fence lilac.
  // 'bedpath' is the walking path BETWEEN beds in a bed block, and is deliberately its own kind
  // rather than a 'path'. A 'path' belongs to the farm's ACCESS network (driveway, gates), and
  // the Studio focuses one layer per step — so on the Planting step, where blocks are actually
  // laid out, access is switched off and every path the farmer had just asked for was created,
  // saved, and never drawn (Rory, twice: "it didnt add paths when inserted" / "no path still!").
  // A path between two veg beds is part of the veg garden, not part of the driveway, so it now
  // follows the beds onto the planting layer and is visible exactly when they are.
  kind: 'swale' | 'fence' | 'path' | 'bedpath' | 'pipe' | 'drip' | 'windbreak' | 'greywater';
  points: Array<[number, number]>;
  /** Already on the farm, or part of the proposal. See ElementStatus above. */
  status?: ElementStatus;
  // Optional custom name shown on the on-canvas label pill (tap the label to rename); falls back
  // to the kind's default name (LINE_KIND_LABEL, components/design/DesignCanvas.tsx) when unset.
  // Mirrors ZoneShape.name above — same pattern, same reason (no on-canvas label existed for any
  // line kind at all, including swales, until this field).
  name?: string;
  // Optional normalised offset of the name label from its anchor point (the line's midpoint) —
  // mirrors ZoneShape.labelDx/labelDy so a farmer can drag a line's label clear of the line itself.
  // Undefined = pinned at the midpoint.
  labelDx?: number;
  labelDy?: number;
}

export type WizardStep = 'base' | 'sector' | 'water' | 'zones' | 'planting' | 'structures' | 'review' | 'glossy';

// A farmer's own uploaded (drone/aerial) photo of their site, used as the Studio's base image
// INSTEAD of the fetched satellite tile. Deliberately just a small Storage download URL + the
// calibrated scale — never the image bytes themselves — so it persists exactly like every other
// small field on DesignCanvasState (the whole object round-trips through localStorage AND
// Firestore as one JSON blob; see lib/design-canvas-sync.ts). The rotation the farmer dialled in
// is NOT stored here: it is baked into the image pixels once, before upload (see
// components/design/BasePhotoImport.tsx), because none of this app's renderers (satellite base,
// every Blueprint sheet, every AI composite) have any concept of a live rotation transform —
// teaching all of them would be a far bigger and riskier change than doing it once at upload time.
export interface CustomBaseImage {
  url: string; // Firebase Storage download URL (uploadPhoto in lib/db/queries.ts)
  mPerPx: number; // calibrated metres-per-pixel, from the farmer's two-point tap + entered distance
  uploadedAt: string; // ISO timestamp, for display only
  /**
   * PAINT-TIME alignment nudge, as a fraction of the frame. Purely how the photo is DRAWN over
   * the satellite — it never moves an item, a zone, a line or a metre.
   *
   * Baking the transform at upload (see above) made the photo opaque the moment it landed: the
   * farmer could line it up once, in a small dialog, and never again. In practice the drone shot
   * and the satellite disagree by a few metres — different day, different georeferencing — and
   * that only becomes visible later, on the real map, with the design already drawn on it
   * (Rory: "i should be able to do some micro refinements once placed"). This is that
   * adjustment, and it is deliberately the weakest possible kind: pure translation.
   *
   * NOT scale. mPerPx comes from the farmer's own two-point calibration on these pixels, and
   * every measurement in the app is derived from it; a scale handle here would silently restate
   * every area and every yield on the plan. Alignment that cannot lie about distance is worth
   * more than a free transform.
   */
  dx?: number;
  dy?: number;
  /**
   * In-place rotation refinement, clockwise degrees, on top of whatever was baked at import.
   *
   * Rotation is offered here — while scale never will be — because turning an image does not
   * change how many metres one of its pixels is worth. A drone flown on any heading lands a few
   * degrees off the satellite's north, and until now the only cure was re-importing the photo
   * and re-doing the whole alignment (Rory: "this is good we just need a angle adjuster").
   */
  rotationDeg?: number;
  /**
   * In-place SIZE refinement, as a multiplier on how large the photo is drawn in the frame.
   * 1 = exactly as imported.
   *
   * THIS ONE DOES MOVE THE METRES, and that is the point. A drone photo whose calibration came
   * out too small makes the whole design look tiny on it (Rory: "it remains too big for the
   * actual drawing and satellite ... i want to be able to adjust the size for micro adjustments
   * once inserted but we have to get the scaling right"). Resizing the photo until its features
   * match the satellite underneath IS a scale correction, so the frame's metres-per-pixel is
   * derived as `mPerPx / scale` (customBaseMPerPx) rather than left to disagree with the picture.
   * mPerPx itself keeps meaning "metres per frame pixel at scale 1", so the farmer's original
   * two-point calibration is never overwritten and Reset always returns to it.
   */
  scale?: number;
  /** How opaque the photo sits over the satellite while aligning it. Undefined = fully opaque,
   *  which is the normal working state; the slider only matters while lining the two up. */
  opacity?: number;
}

/**
 * Alignment nudge bounds, as a fraction of the frame.
 *
 * Was a tenth, on the reasoning that this exceeds "any real georeferencing disagreement". That
 * reasoning only holds when the photo and the satellite were framed alike — and since a photo is
 * now auto-fitted to the frame's ground scale on import, a shot taken well off-centre can land
 * needing considerably more than a tenth of the frame to bring into register. A farmer who runs
 * out of nudge has no way to finish the job (Rory: "the drone image is not lining perfectly with
 * the satellite so i want to be able to adjust everything"). A third of the frame still cannot
 * fling the photo off the map, which is all this bound was ever for.
 */
export const MAX_BASE_NUDGE = 0.35;

/** Coerce a persisted/typed nudge into something that cannot put the photo somewhere unrecoverable.
 *  Non-finite reads as "no nudge" rather than propagating NaN into a transform. */
export function clampBaseNudge(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.min(MAX_BASE_NUDGE, Math.max(-MAX_BASE_NUDGE, v))
    : 0;
}

/**
 * In-place rotation bound, degrees. This control REFINES an already-aligned photo — squaring a
 * drone shot to the satellite is a few degrees of work. Gross heading belongs in the import
 * aligner, where the photo can be re-framed to fill the page after turning; here it cannot,
 * because covering the exposed corners would mean scaling, and scaling would restate every
 * measurement on the plan.
 */
export const MAX_BASE_ROTATION = 20;

/** Coerce a persisted/typed rotation into the refinement range. Non-finite reads as no rotation. */
export function clampBaseRotation(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v)
    ? Math.min(MAX_BASE_ROTATION, Math.max(-MAX_BASE_ROTATION, v))
    : 0;
}

/** In-place size bounds. Wide enough for a calibration that came out badly wrong (a factor of
 *  four either way), tight enough that a slip cannot turn a smallholding into a province. */
export const MIN_BASE_SCALE = 0.25;
export const MAX_BASE_SCALE = 4;

/** Coerce a persisted/typed size into the refinement range. Non-finite reads as "as imported". */
export function clampBaseScale(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0
    ? Math.min(MAX_BASE_SCALE, Math.max(MIN_BASE_SCALE, v))
    : 1;
}

/**
 * The frame's metres-per-pixel for a custom base — the ONE place the size refinement is folded
 * into the calibrated scale, so no caller can paint the photo at one size and measure it at
 * another. Drawing the photo `scale` times larger means each frame pixel covers `scale` times
 * less ground, hence the division.
 */
export function customBaseMPerPx(base: Pick<CustomBaseImage, 'mPerPx' | 'scale'>): number {
  return base.mPerPx / clampBaseScale(base.scale);
}

/** Opacity for painting the custom base over the satellite. Undefined/!finite = fully opaque. */
export function clampBaseOpacity(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0.1, v)) : 1;
}

/** Which base-image controls the Base step must offer, given the saved state. */
export interface BasePhotoControls {
  /** Both directions are reachable — the photo can be switched off AND back on. */
  canToggle: boolean;
  /** The farmer's photo is the base being drawn on right now. */
  showingPhoto: boolean;
}

/**
 * THE ONE-WAY DOOR THIS EXISTS TO PREVENT. `revertToSatellite` is deliberately non-destructive:
 * it flips `useCustomBase` off and KEEPS `customBase`, precisely so the photo can come back with
 * no re-upload and no re-calibration. But the Base-step UI branched on
 * `useCustomBase && customBase`, so the moment the flag went off the only control left was a
 * from-scratch import — the photo was saved, intact, and unreachable, and coming back meant
 * re-picking the file, re-aligning it and re-measuring the scale (Rory: "i still cant toggle on
 * satelite or drone once the dorne is added").
 *
 * The rule is therefore about the PHOTO EXISTING, never about which base is active: a saved photo
 * means a two-way toggle, in both flag states.
 */
export function basePhotoControls(
  state: Pick<DesignCanvasState, 'useCustomBase' | 'customBase'> | null | undefined,
): BasePhotoControls {
  const hasPhoto = !!state?.customBase;
  return { canToggle: hasPhoto, showingPhoto: hasPhoto && state?.useCustomBase === true };
}

export interface DesignCanvasState {
  siteId: string;
  frame: Omit<CanvasFrame, 'satDataUrl'>;
  items: PlacedItem[];
  zones: ZoneShape[];
  lines: LineShape[];
  step: WizardStep;
  updatedAt: string;
  // Optional back-compat pair: when useCustomBase is true and customBase is set, the Studio shows
  // the farmer's own uploaded photo (customBase.url, fetched into the ephemeral CanvasFrame at
  // render time exactly like the satellite tile is) and frame.mPerPx is overridden by
  // customBase.mPerPx instead of the GPS-derived value. Farmers who never upload a photo see
  // exactly today's behaviour — both fields stay undefined. Keeping the ORIGINAL satellite frame
  // computation running unchanged (rather than replacing it) is what lets a farmer switch back to
  // the real satellite view at any time without losing anything.
  useCustomBase?: boolean;
  customBase?: CustomBaseImage | null;
  /**
   * The farmer's own correction to this site's ground scale, as a multiplier on frame.mPerPx.
   *
   * WHY THIS EXISTS. The satellite frame's metres-per-pixel is not a guess — it is the Web
   * Mercator ground resolution at the site's latitude, and it has been verified to match that
   * definition to one part in 100,000. But it is only as true as the imagery's own
   * georeferencing, and a farmer standing on his land measuring a wall he built has better
   * evidence than any projection I can compute for him. (Rory, having measured a building he
   * knows: "yeah but still hallf size".) So this is the override: measure a known length with
   * the canvas ruler, state what it really is, and every metre in the app follows.
   *
   * It multiplies rather than replaces so it composes with BOTH bases — the satellite frame and
   * an uploaded photo's own calibrated mPerPx — and so "undo the correction" is exactly 1.
   *
   * IT CHANGES NO GEOMETRY. Saved points are normalised to the frame and are untouched; what
   * changes is how many metres one frame-pixel is worth, which is precisely the thing in dispute.
   * Everything derived (item footprints, areas, spacings, tank sizing, every plan sheet) reads
   * through mPerPx, so correcting it here corrects all of them at once.
   */
  scaleFactor?: number;
  // Monotonic edit counter for this site's design lineage. Bumped by saveCanvasState on every
  // real local save, and NEVER by applyRemoteCanvasState (receiving someone else's edit is not
  // editing). Cloud sync (lib/design-canvas-sync.ts) ranks by rev FIRST and only falls back to
  // updatedAt on a tie, because a wall-clock stamp only says "when this device last touched it"
  // — which a device that reloaded a STALE snapshot forges for free just by being late. rev says
  // "how many edits this lineage has seen", which a stale snapshot cannot fake: it re-enters the
  // race at the low rev it was saved with.
  // OPTIONAL for back-compat: states written before this field existed read as rev 0 (see revOf).
  rev?: number;
  // The farmer's own on-site wind observation — confirms or overrides the Sector sheet's regional
  // wind/fire-direction assumption (lib/regional-wind.ts) with what they actually see on their
  // land, resolved via effectivePrevailingWind/effectiveFireWind (lib/local-wind.ts). Site-wide
  // (one observation per design, not per shape) because wind isn't a per-ring measurement the way
  // ZoneShape.measuredSlopePct is — it's a fact about the whole property. Optional so it stays
  // JSON-safe and survives migrateStateToFrame's untouched spread, same reasoning as
  // measuredSlopePct itself (lib/design-canvas.ts ZoneShape): absent by default, and absence must
  // degrade honestly (fall back to the regional table, and SAY it is regional) rather than
  // silently assuming a farmer input exists.
  localWind?: LocalWindObservation;
  // Farmer-entered household demand used by the monthly tank-sizing balance. Optional because old
  // designs have no value and guessing one would turn a Water-sheet recommendation into fiction.
  // TankCalculator owns the input; the saved canvas carries it into exact sheet generation.
  dailyWaterUseL?: number;
}

/**
 * Cloud sync owns design content, but the open tab owns where its user is currently working.
 * A remote winner may therefore replace every authored field while retaining local navigation.
 */
export function preserveCanvasNavigation(
  incoming: DesignCanvasState,
  current: DesignCanvasState | null | undefined,
): DesignCanvasState {
  if (!current || current.siteId !== incoming.siteId || current.step === incoming.step) return incoming;
  return { ...incoming, step: current.step };
}

/** Reads a state's rev defensively: missing (pre-rev states) or corrupt (hand-edited/truncated
 *  localStorage blob) both read as 0 rather than throwing or poisoning comparisons with NaN.
 *  Single source of truth for the "missing rev = 0" rule — sync imports this too. */
export function revOf(state: Pick<DesignCanvasState, 'rev'> | null | undefined): number {
  return typeof state?.rev === 'number'
    && Number.isSafeInteger(state.rev)
    && state.rev >= 0
    ? state.rev
    : 0;
}

/** How much design a state actually holds. Single source of truth for the "is there anything to
 *  lose here?" question, which BOTH the cloud winner rule (lib/design-canvas-sync.ts) and the
 *  auto-persist guard (app/design/page.tsx) hang off — they must never disagree about what counts
 *  as empty, or one will happily push a state the other would have refused. */
export function contentCountOf(
  state: Pick<DesignCanvasState, 'items' | 'zones' | 'lines'> | null | undefined,
): number {
  if (!state) return 0;
  return (Array.isArray(state.items) ? state.items.length : 0)
    + (Array.isArray(state.zones) ? state.zones.length : 0)
    + (Array.isArray(state.lines) ? state.lines.length : 0);
}

/** Single source of truth for PlacedItem.rot's storage convention (rounded integer degrees,
 *  wrapped into [0,360), 0 stored as undefined) — shared by the drag-rotate handle
 *  (DesignCanvas.tsx endDragRotate) and the Angle number field (DesignPalette.tsx +
 *  app/design/page.tsx onRotateSelected) so the two commit paths can never drift apart on
 *  rounding/wrapping and disagree about what "0°" means on disk. */
export function normaliseRotation(deg: number): number | undefined {
  const wrapped = ((Math.round(deg) % 360) + 360) % 360;
  return wrapped === 0 ? undefined : wrapped;
}

// ── Web-Mercator helpers (adapted from components/GeometryDesignStudio.tsx) ──────
// Same maths as the Mapbox Static Images API tile grid — do NOT swap in the
// hardcoded 156543/2^z formula, tile size assumptions differ.

const TILE = 512;

export function lngLatToWorld(lng: number, lat: number, zoom: number): [number, number] {
  const worldSize = TILE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * worldSize;
  const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
  return [x, y];
}

export function getBounds(layers: DesignLayer[]) {
  const coords = layers.flatMap((layer) => collectPositions(layer.geometry));
  if (coords.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const xs = coords.map((c) => c[0]).filter(Number.isFinite);
  const ys = coords.map((c) => c[1]).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function collectPositions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(collectPositions);
    default:
      return [];
  }
}

// Fractional zoom so the bbox fits inside (imgW x imgH) logical px, with breathing room.
export function fitZoom(
  bounds: ReturnType<typeof getBounds>,
  imgW: number,
  imgH: number,
  padFrac = 0.76,
): { zoom: number; centerLng: number; centerLat: number } {
  const centerLng = (bounds.minX + bounds.maxX) / 2;
  const centerLat = (bounds.minY + bounds.maxY) / 2;
  const [x1, y1] = lngLatToWorld(bounds.minX, bounds.maxY, 0); // top-left
  const [x2, y2] = lngLatToWorld(bounds.maxX, bounds.minY, 0); // bottom-right
  const spanX = Math.max(Math.abs(x2 - x1), 1e-9);
  const spanY = Math.max(Math.abs(y2 - y1), 1e-9);
  const zoomX = Math.log2((imgW * padFrac) / spanX);
  const zoomY = Math.log2((imgH * padFrac) / spanY);
  let zoom = Math.min(zoomX, zoomY);
  // THE CEILING IS THE API'S, NOT A GUESS. It used to be 19.5, which is nearly a full zoom level
  // below what Mapbox actually serves — so any site small enough to need more simply did not get
  // it, and the design sat in a corner of a frame far wider than it asked for. Measured on the
  // Ubhejane crèche: `padFrac` asks for the design to fill 76% of the frame, and it filled 41.8%,
  // because fitZoom wanted ~20.4 and was handed 19.5. That is what Rory saw: "its half the size
  // it should be too small!" — not a scale error (mPerPx matches the Web Mercator ground
  // resolution at this latitude to 1 part in 100,000), a framing one.
  //
  // 22 is verified, not assumed: the Static Images API returns 200 at 22 and 422 at 22.5.
  // Sites small enough to reach the top of that range get upsampled, softer imagery — a coverage
  // limit of the satellite source, not of this projection, and a plainly better trade than a plan
  // whose subject occupies two fifths of the page. Geometry is unaffected either way: the frame is
  // stored with the design and migrateStateToFrame re-projects saved points through lng/lat, so a
  // recomputed frame moves nothing on the ground.
  zoom = Math.max(1, Math.min(zoom, 22));
  return { zoom, centerLng, centerLat };
}

// Static Images API URL (center+zoom, satellite, no labels), logical px (<=1280), @2x.
export function buildSatelliteUrl(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  token: string,
): string {
  const w = Math.min(Math.round(imgW), 1280);
  const h = Math.min(Math.round(imgH), 1280);
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${centerLng.toFixed(6)},${centerLat.toFixed(6)},${zoom.toFixed(4)},0,0/` +
    `${w}x${h}@2x?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`
  );
}

// Projector that lines up exactly with the static tile (center-relative Mercator).
export function makeMercatorProjector(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  originX: number,
  originY: number,
) {
  const [cx, cy] = lngLatToWorld(centerLng, centerLat, zoom);
  return (coord: Position): readonly [number, number] => {
    const [wx, wy] = lngLatToWorld(coord[0], coord[1], zoom);
    const x = originX + imgW / 2 + (wx - cx);
    const y = originY + imgH / 2 + (wy - cy);
    return [
      Number.isFinite(x) ? x : originX + imgW / 2,
      Number.isFinite(y) ? y : originY + imgH / 2,
    ];
  };
}

// Inverse of makeMercatorProjector/lngLatToWorld: normalised [0..1] canvas coords → [lng,lat].
// Must stay the exact algebraic inverse of lngLatToWorld — verify any edit round-trips.
export function makeMercatorUnprojector(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
) {
  const worldSize = TILE * Math.pow(2, zoom);
  const [cx, cy] = lngLatToWorld(centerLng, centerLat, zoom);
  return (norm: [number, number]): [number, number] => {
    const x = norm[0] * imgW;
    const y = norm[1] * imgH;
    const wx = cx + (x - imgW / 2);
    const wy = cy + (y - imgH / 2);
    const lng = (wx / worldSize) * 360 - 180;
    const n = Math.PI - 2 * Math.PI * (wy / worldSize);
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return [lng, lat];
  };
}

// Rebuilds the [lng,lat] → normalised [0..1] projector for an ALREADY-COMPUTED frame, using the
// same maths computeCanvasFrame uses for its own project() (they share this function, so the two
// can never drift). Exists for callers that hold a frame but not the layers it was fitted from —
// e.g. the Design Studio re-normalising a cloud copy into the frame it is currently rendering.
export function projectorForFrame(
  frame: Omit<CanvasFrame, 'satDataUrl'>,
): (lngLat: Position) => [number, number] {
  const projector = makeMercatorProjector(
    frame.centerLng,
    frame.centerLat,
    frame.zoom,
    frame.imgW,
    frame.imgH,
    0,
    0,
  );
  return (lngLat: Position): [number, number] => {
    const [px, py] = projector(lngLat);
    return [px / frame.imgW, py / frame.imgH];
  };
}

// Re-normalises saved geometry into a freshly-recomputed frame. If the new frame is
// (within tolerance) the same as the one the state was saved with, returns state
// unchanged — this is the common case and must stay a cheap no-op.
export function migrateStateToFrame(
  state: DesignCanvasState,
  newFrame: Omit<CanvasFrame, 'satDataUrl'>,
  project: (lngLat: [number, number]) => [number, number],
): DesignCanvasState {
  const f = state.frame;
  const sameFrame =
    Math.abs(f.centerLng - newFrame.centerLng) < 1e-7 &&
    Math.abs(f.centerLat - newFrame.centerLat) < 1e-7 &&
    Math.abs(f.zoom - newFrame.zoom) < 1e-6 &&
    f.imgW === newFrame.imgW &&
    f.imgH === newFrame.imgH;
  if (sameFrame) return state;

  // ON A CUSTOM BASE, GEOMETRY IS ANCHORED TO THE PHOTO, NOT TO THE EARTH. The farmer placed
  // every bed against pixels of their own drone shot, which carries no georeferencing at all —
  // so re-projecting those points through Web-Mercator because the SATELLITE frame recomputed
  // (a re-traced boundary is enough to trigger that) would slide the whole design off the
  // photo it was drawn on. The frame stamp still updates so the no-op fast path above works on
  // the next call; the points stay exactly where the farmer put them.
  if (state.useCustomBase && state.customBase) {
    return { ...state, frame: newFrame };
  }

  const unprojectOld = makeMercatorUnprojector(f.centerLng, f.centerLat, f.zoom, f.imgW, f.imgH);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const remap = (pt: [number, number]): [number, number] => {
    const lngLat = unprojectOld(pt);
    const [x, y] = project(lngLat);
    return [clamp01(x), clamp01(y)];
  };

  const items = state.items.map((item) => {
    const [x, y] = remap([item.x, item.y]);
    return { ...item, x, y };
  });
  const zones = state.zones.map((z) => ({ ...z, points: z.points.map(remap) }));
  const lines = state.lines.map((l) => ({ ...l, points: l.points.map(remap) }));

  return { ...state, frame: newFrame, items, zones, lines };
}

/**
 * Burn the farmer's in-place alignment (nudge + rotation) into the base image itself.
 *
 * WHY BAKE INSTEAD OF PAINTING. The nudge started life as a live transform on the Studio's
 * <image> element, which made it Studio-only: every plan sheet, every print composition and
 * every AI render reads `frame.satDataUrl` and paints it raw, so a farmer who lined their photo
 * up on screen got an UN-aligned photo on all eight delivered sheets, silently. That is the same
 * shape of defect as a shape drawn on a layer its own step switches off — the work is real,
 * saved, and invisible where it matters. Rotation would have inherited the identical bug.
 *
 * Baking is what makes it one truth: the aligned pixels ARE the base image, so every renderer
 * downstream is correct without knowing this feature exists.
 *
 * Rotation is applied about the frame centre and is NOT cover-scaled — see resolveBaseAlign in
 * lib/base-photo-align.ts for why scaling to hide the exposed corners is the one thing this must
 * never do.
 *
 * THE BAKED IMAGE MUST THEREFORE BE OPAQUE ACROSS THE WHOLE FRAME. Moving or turning the photo
 * uncovers frame area — up to a 96px strip at MAX_BASE_NUDGE, and roughly a quarter of the page
 * at MAX_BASE_ROTATION. The Studio hides that because DesignCanvas paints frame.underlayDataUrl
 * beneath the base, but NOTHING else does: DesignGlossy's buildComposite, drawBlueprintBase and
 * drawAnalysisBase each blit satDataUrl onto a fresh transparent canvas, and their own fallback
 * fill only runs when satDataUrl is absent. Left transparent, the uncovered area printed as
 * white holes on all eight plan sheets and in the PDF, and went to the AI render as empty pixels
 * — the exact Studio-vs-sheets divergence this whole bake exists to end, in a new costume.
 * Baking the backdrop in is what keeps "the aligned pixels ARE the base image" true.
 */
export async function bakeBaseAlignment(
  sourceDataUrl: string,
  align: { dx?: number; dy?: number; rotationDeg?: number; scale?: number } | null | undefined,
  frameW: number,
  frameH: number,
  underlayDataUrl?: string | null,
): Promise<string> {
  const dx = clampBaseNudge(align?.dx);
  const dy = clampBaseNudge(align?.dy);
  const rotationDeg = clampBaseRotation(align?.rotationDeg);
  const scale = clampBaseScale(align?.scale);
  // Nothing to bake — hand back the original bytes rather than round-tripping them through a
  // canvas re-encode, which costs time and loses nothing but quality. A zero alignment covers
  // the frame exactly, so there is no uncovered area to fill either.
  if (dx === 0 && dy === 0 && rotationDeg === 0 && scale === 1) return sourceDataUrl;
  // A frame we cannot size is a frame we cannot bake into: a 0×0 canvas exports a blank string
  // and would read to the farmer as "my photo vanished". The unaligned original is always a
  // better answer than nothing.
  if (!Number.isFinite(frameW) || !Number.isFinite(frameH) || frameW <= 0 || frameH <= 0) {
    return sourceDataUrl;
  }

  const loadImageEl = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not read your photo.'));
    el.src = src;
  });

  const img = await loadImageEl(sourceDataUrl);

  // BAKE AT THE SOURCE'S OWN RESOLUTION, not at the logical frame size. Baking a 2880-wide photo
  // into a 960-wide canvas would throw away exactly the detail BASE_PHOTO_EXPORT_SCALE exists to
  // keep — and it would do it on every nudge and every turn, so the farmer's photo would get
  // softer the more they adjusted it. All the drawing below stays in LOGICAL frame coordinates;
  // the context is scaled once, so this is a pure supersample and no geometry changes.
  const superSample = Math.min(
    BASE_PHOTO_EXPORT_SCALE,
    Math.max(1, Math.round((img.naturalWidth || frameW) / frameW)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = frameW * superSample;
  canvas.height = frameH * superSample;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceDataUrl;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(superSample, superSample);

  // Backdrop first, untransformed. The satellite is what is genuinely under the photo, so it is
  // the honest thing to show where the photo no longer reaches; the flat tone is only for the
  // case where no underlay has loaded, and matches buildComposite's own no-imagery colour.
  if (underlayDataUrl) {
    try {
      ctx.drawImage(await loadImageEl(underlayDataUrl), 0, 0, frameW, frameH);
    } catch {
      ctx.fillStyle = '#CBB98A';
      ctx.fillRect(0, 0, frameW, frameH);
    }
  } else {
    ctx.fillStyle = '#CBB98A';
    ctx.fillRect(0, 0, frameW, frameH);
  }

  ctx.save();
  const { tx, ty, rad, cx, cy, scale: s } = resolveBaseAlign({ dx, dy, rotationDeg, scale }, frameW, frameH);
  ctx.translate(cx + tx, cy + ty);
  ctx.rotate(rad);
  // About the frame centre, so resizing doesn't also walk the photo off to one side. Shrinking
  // uncovers frame area exactly like rotation does — which is why the backdrop above is painted
  // unconditionally rather than only for rotation.
  ctx.scale(s, s);
  // Drawn at frame size from the rotation centre — the same "slice" fit the untransformed image
  // element uses, so a zero alignment and a baked alignment agree pixel-for-pixel.
  ctx.drawImage(img, -cx, -cy, frameW, frameH);
  ctx.restore();
  // JPEG, not PNG. The backdrop above makes this canvas fully opaque, so there is no alpha to
  // preserve — and a supersampled photographic PNG is several megabytes of base64 held in React
  // state and rebuilt on every nudge, which is how the last memory crash happened.
  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox static ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('Could not read satellite image.'));
    fr.readAsDataURL(blob);
  });
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Exported so a custom-photo base (components/design/BasePhotoImport.tsx) can bake/calibrate at
// the exact same logical canvas size every satellite-fitted frame already uses — the two base
// image sources must never disagree about the CanvasFrame's imgW/imgH.
export const DEFAULT_IMG_W = 960;
export const DEFAULT_IMG_H = 640;

/**
 * How many real pixels a farmer's own base photo is stored at, per LOGICAL frame pixel.
 *
 * The frame is 960x640 because that is the coordinate system every renderer and every saved
 * design is expressed in — but there is no reason the IMAGE has to be that small. It used to be:
 * the aligner exported its on-screen canvas, so a 12-megapixel drone photo was reduced to 0.6 of
 * one the instant it was applied, and that thumbnail became the base for the Studio and for every
 * printed plan sheet (Rory: "the image quality inserted was so poor"). The auto-fit made it worse
 * again, since a photo shot wider than the frame is drawn ENLARGED from those few pixels.
 *
 * 3x gives 2880x1920 — sharp on a phone, sharp when a plan sheet is printed, and still a
 * sane JPEG. It is a pure supersample of the same framing, so it changes no coordinate and no
 * measurement: mPerPx remains metres per FRAME pixel, and the frame is still 960 wide.
 */
export const BASE_PHOTO_EXPORT_SCALE = 3;
const METRES_PER_DEGREE_LAT = 111.32;

/** Bounds on a hand-calibrated scale correction (DesignCanvasState.scaleFactor). Wide enough for
 *  the real cases — a farmer who finds the imagery half or double — and tight enough that a
 *  corrupted number cannot turn a smallholding into a province. */
/** Multiplier on icon discs and label pills, driven by the Size slider in the Layers panel
 *  (Rory: "a little slider to incres icon and lable size"). One control for both, because an
 *  icon and the name under it are read as a single mark — drifting them apart only produces a
 *  map that needs two sliders to look right. Purely presentational: it changes how large a
 *  symbol is DRAWN, never what is stored, so no geometry moves. Lives here rather than in the
 *  canvas component so the palette can bound its slider without importing a component. */
export const MIN_MAP_TEXT_SCALE = 0.6;
export const MAX_MAP_TEXT_SCALE = 2.5;

/**
 * HOW AREA SHAPES ARE FILLED — zones, lawn, orchard, patio, every traced surface.
 *
 * They were hatched, always, with no way to change it: the hatch says "this is a traced parcel"
 * in the same visual language the farmer map uses, which is right when you are drawing them and
 * wrong when you are trying to read the ground underneath, or show someone a zone plan (Rory:
 * "with the zones i want to be able to select hatching… in the case of zones it must be a
 * translucent colour that you can control with a slider").
 *
 * Presentational only, exactly like MAP_TEXT_SCALE above: it changes what is PAINTED, never what
 * is stored, so no geometry moves and no area or price changes.
 *
 * The two styles are not interchangeable at the same number. A hatch carries its own internal
 * opacities, so the slider modulates an already-sparse pattern; a tint is solid colour, so the
 * same number reads far heavier. That is the point — each style gets the full range of the
 * slider within its own character, rather than being scaled to look alike and neither working.
 */
export const AREA_FILL_STYLES = ['hatch', 'tint'] as const;
export type AreaFillStyle = (typeof AREA_FILL_STYLES)[number];
export const MIN_AREA_FILL_OPACITY = 0.05;
export const MAX_AREA_FILL_OPACITY = 0.7;
/** What the canvas drew before there was a control: the hatch at its old strength. */
export const DEFAULT_AREA_FILL: { style: AreaFillStyle; opacity: number } = { style: 'hatch', opacity: 0.28 };

export function clampAreaFillOpacity(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_AREA_FILL.opacity;
  return Math.min(MAX_AREA_FILL_OPACITY, Math.max(MIN_AREA_FILL_OPACITY, n));
}

export function normaliseAreaFill(raw: unknown): { style: AreaFillStyle; opacity: number } {
  const o = (raw ?? {}) as { style?: unknown; opacity?: unknown };
  const style = AREA_FILL_STYLES.find((s) => s === o.style) ?? DEFAULT_AREA_FILL.style;
  return { style, opacity: clampAreaFillOpacity(o.opacity) };
}

export const MIN_SCALE_FACTOR = 0.05;
export const MAX_SCALE_FACTOR = 20;

/** The corrected metres-per-pixel for a frame, given a saved calibration. The one place this
 *  multiplication happens, so a caller cannot apply it twice or forget it. */
export function scaledMPerPx(mPerPx: number, scaleFactor?: number): number {
  if (!Number.isFinite(mPerPx) || mPerPx <= 0) return mPerPx;
  if (scaleFactor === undefined || !Number.isFinite(scaleFactor)) return mPerPx;
  const f = Math.min(MAX_SCALE_FACTOR, Math.max(MIN_SCALE_FACTOR, scaleFactor));
  return mPerPx * f;
}

// Builds the CanvasFrame (minus the inlined image) + the satellite URL to fetch + a
// project() helper that maps [lng,lat] → normalised [0..1] canvas coordinates.
//
// mPerPx is computed EMPIRICALLY from the same Mercator projector used for the satellite
// fit: project [centerLng, centerLat] and [centerLng, centerLat + 0.001]; the latitude
// delta 0.001° = 111.32 m; mPerPx = 111.32 / |pyA - pyB|. Do NOT use a hardcoded
// 156543/2^z formula — tile size assumptions differ.
export function computeCanvasFrame(
  layers: DesignLayer[],
  lat: number,
  lon?: number,
  opts?: { imgW?: number; imgH?: number },
): {
  frame: Omit<CanvasFrame, 'satDataUrl'>;
  url: string;
  project: (lngLat: Position) => [number, number];
} {
  const imgW = opts?.imgW ?? DEFAULT_IMG_W;
  const imgH = opts?.imgH ?? DEFAULT_IMG_H;

  const rawBounds = getBounds(layers);
  const hasRealBounds =
    layers.length > 0 &&
    Number.isFinite(rawBounds.minX) &&
    rawBounds.maxX - rawBounds.minX > 0 &&
    rawBounds.maxY - rawBounds.minY > 0;

  // Fallback: a 120 m box around the site's centre — the REAL lat/lon, so an un-traced
  // saved place still gets its own satellite (lng 0 here once meant "Atlantic Ocean").
  const bounds = hasRealBounds
    ? rawBounds
    : (() => {
        const centerLat = Number.isFinite(lat) ? lat : 0;
        const centerLng = Number.isFinite(lon as number) ? (lon as number) : 0;
        // 120 m box → 60 m half-span. NB: METRES_PER_DEGREE_LAT (111.32) is metres per
        // 0.001° (milli-degree) — one full degree of latitude is 111,320 m. Using it as
        // per-degree here once produced a ±30 km box (a whole-suburb satellite view).
        const halfDegLat = 60 / (METRES_PER_DEGREE_LAT * 1000);
        const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
        const halfDegLng = halfDegLat / cosLat;
        return {
          minX: centerLng - halfDegLng,
          maxX: centerLng + halfDegLng,
          minY: centerLat - halfDegLat,
          maxY: centerLat + halfDegLat,
        };
      })();

  const fit = fitZoom(bounds, imgW, imgH);
  const url = MAPBOX_TOKEN
    ? buildSatelliteUrl(fit.centerLng, fit.centerLat, fit.zoom, imgW, imgH, MAPBOX_TOKEN)
    : '';

  const projector = makeMercatorProjector(fit.centerLng, fit.centerLat, fit.zoom, imgW, imgH, 0, 0);

  // Empirical metres-per-logical-pixel: project the centre and a point 0.001° north of it.
  const [, pyA] = projector([fit.centerLng, fit.centerLat]);
  const [, pyB] = projector([fit.centerLng, fit.centerLat + 0.001]);
  const pxDelta = Math.abs(pyA - pyB) || 1e-9;
  const mPerPx = METRES_PER_DEGREE_LAT / pxDelta;

  const frame: Omit<CanvasFrame, 'satDataUrl'> = {
    centerLng: fit.centerLng,
    centerLat: fit.centerLat,
    zoom: fit.zoom,
    imgW,
    imgH,
    mPerPx,
  };

  // Same projector every other frame-holder gets (projectorForFrame) — deliberately not a second
  // local copy of the divide-by-imgW/imgH step, so a fix to one is a fix to both.
  const project = projectorForFrame(frame);

  return { frame, url, project };
}

// ── Storage (mirrors lib/site-elements.ts conventions) ────────────────────────

export const DESIGN_CANVAS_CHANGED_EVENT = 'imbewu-design-canvas-changed';

const baseKeyFor = (siteId: string) => `imbewu_design_canvas_${siteId}`;
const keyFor = (
  siteId: string,
  ownerUid?: string | null,
) => ownerUid === undefined
  ? activeAccountLocalStorageKey(baseKeyFor(siteId))
  : accountLocalStorageKey(baseKeyFor(siteId), ownerUid);
const CANVAS_STEPS = new Set<WizardStep>([
  'base', 'sector', 'water', 'zones', 'planting', 'structures', 'review', 'glossy',
]);
function canvasRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finiteCanvasPoint(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2
    && value.every((coordinate) => typeof coordinate === 'number'
      && Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 1);
}

function uniqueNonEmptyIds(values: unknown[]): boolean {
  const ids = values.map((value) => canvasRecord(value) ? value.id : undefined);
  return ids.every((id) => typeof id === 'string' && id.length > 0)
    && new Set(ids).size === ids.length;
}

function dedupeCanvasRows(values: unknown[]): unknown[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!canvasRecord(value) || typeof value.id !== 'string' || !value.id) return true;
    if (seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  });
}

function optionalFiniteCanvasNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function optionalCanvasText(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

// Legacy designs (and some cross-device round-trips) persisted a zone's `zone` as a STRING
// ("1") rather than the number 1. Object-key access (ZONE_DEFS[z.zone]) and the number badge
// both tolerate that, so painted zones still RENDER — but strict checks (new Set([1]).has(z.zone))
// silently fail, which is what made a fully-painted Zones step still read "0/4" on the
// step-by-step guide. Coerce to a clamped integer on load so every consumer sees a real number.
/** Shoelace area magnitude of a normalised ring. Used only to order ground features by size. */
export function ringAreaOf(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
}

/** GROUND FEATURES NEST. A farmer traces the property boundary, then the lawn inside it, then the
 *  house inside that, then the patio inside that — and drawn naively they simply stack, so the
 *  lawn's hatch runs straight over the roof and the boundary's over everything (Rory: "polygons
 *  must be nested in eachother"). A ring's TRUE extent is itself MINUS every smaller ground ring
 *  inside it, which is the same donut rule zoneFillPolys already applies to effort-zones.
 *
 *  Strictly smaller only, by area: two rings of equal size cannot each cut the other, and a
 *  same-size overlap is a tracing mistake the farmer should see rather than have silently hidden.
 *  Returns MultiPolygon rings — [outer, ...holes] — which canvas' nonzero fill renders as holes
 *  when each is its own subpath, and SVG renders the same way with fillRule="evenodd". */
/** Closest point ON a ring's outline to a given point, in normalised coords.
 *
 *  A label's leader used to run to the ring CENTROID, which is meaningless for a large enclosing
 *  area: the centroid of a property boundary is the middle of the plot, which is where the house
 *  is — so dragging the boundary label away left its leader pointing confidently at the house
 *  (Rory: "even if i move the property boundry the leader stay on the house"). The edge is what a
 *  boundary actually IS, and for small shapes the nearest edge point is a few pixels from the
 *  centroid anyway, so this is right for both. */
export function nearestPointOnRing(
  ring: Array<[number, number]>,
  to: [number, number],
): [number, number] {
  let best: [number, number] = ring[0] ?? to;
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    // t clamped to [0,1] keeps the foot of the perpendicular ON the segment, not on its extension.
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((to[0] - ax) * dx + (to[1] - ay) * dy) / len2));
    const px = ax + dx * t, py = ay + dy * t;
    const d = (px - to[0]) ** 2 + (py - to[1]) ** 2;
    if (d < bestD) { bestD = d; best = [px, py]; }
  }
  return best;
}

export function groundFillPolys(
  zones: ZoneShape[],
  z: ZoneShape,
): Array<Array<Array<[number, number]>>> {
  const subject: Array<Array<Array<[number, number]>>> = [[z.points]];
  if (!z.feature || z.points.length < 3) return subject;
  const mine = ringAreaOf(z.points);
  const cutters: Array<Array<Array<[number, number]>>> = [];
  for (const other of zones) {
    if (other.id === z.id || !other.feature || other.points.length < 3) continue;
    if (ringAreaOf(other.points) < mine) cutters.push([other.points]);
  }
  if (!cutters.length) return subject;
  try {
    const out = polygonClipping.difference(subject as never, ...(cutters as never[]));
    return (out as unknown as Array<Array<Array<[number, number]>>>) ?? subject;
  } catch {
    return subject; // degenerate ring — better an overlapping fill than a crash
  }
}

export function normalizeZoneNumbers(state: DesignCanvasState): DesignCanvasState {
  if (!Array.isArray(state.zones)) return state;
  let changed = false;
  const zones = state.zones.map((z) => {
    const raw = Number(z.zone);
    const n = (Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.round(raw))) : 0) as ZoneShape['zone'];
    if (n === z.zone) return z;
    changed = true;
    return { ...z, zone: n };
  });
  return changed ? { ...state, zones } : state;
}

export function normaliseCanvasState(value: unknown, siteId: string): DesignCanvasState | null {
  if (!canvasRecord(value) || !siteId || value.siteId !== siteId
      || !canvasRecord(value.frame)
      || !Array.isArray(value.items)
      || !Array.isArray(value.zones)
      || !Array.isArray(value.lines)
      || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))
      || typeof value.step !== 'string' || !CANVAS_STEPS.has(value.step as WizardStep)
      || !uniqueNonEmptyIds(value.items)
      || !uniqueNonEmptyIds(value.zones)
      || !uniqueNonEmptyIds(value.lines)) {
    if (canvasRecord(value)
        && Array.isArray(value.items) && Array.isArray(value.zones) && Array.isArray(value.lines)) {
      const items = dedupeCanvasRows(value.items);
      const zones = dedupeCanvasRows(value.zones);
      const lines = dedupeCanvasRows(value.lines);
      if (items.length !== value.items.length
          || zones.length !== value.zones.length
          || lines.length !== value.lines.length) {
        return normaliseCanvasState({ ...value, items, zones, lines }, siteId);
      }
    }
    return null;
  }

  const frame = value.frame;
  if (typeof frame.centerLng !== 'number' || !Number.isFinite(frame.centerLng)
      || frame.centerLng < -180 || frame.centerLng > 180
      || typeof frame.centerLat !== 'number' || !Number.isFinite(frame.centerLat)
      || frame.centerLat < -90 || frame.centerLat > 90
      || typeof frame.zoom !== 'number' || !Number.isFinite(frame.zoom)
      || frame.zoom < 0 || frame.zoom > 24
      || typeof frame.imgW !== 'number' || !Number.isFinite(frame.imgW) || frame.imgW <= 0
      || typeof frame.imgH !== 'number' || !Number.isFinite(frame.imgH) || frame.imgH <= 0
      || typeof frame.mPerPx !== 'number' || !Number.isFinite(frame.mPerPx) || frame.mPerPx <= 0) {
    return null;
  }

  if (!value.items.every((candidate) => {
    if (!canvasRecord(candidate)) return false;
    return typeof candidate.defId === 'string' && candidate.defId.length > 0
      && typeof candidate.x === 'number' && Number.isFinite(candidate.x) && candidate.x >= 0 && candidate.x <= 1
      && typeof candidate.y === 'number' && Number.isFinite(candidate.y) && candidate.y >= 0 && candidate.y <= 1
      && (candidate.wM === undefined
        || (typeof candidate.wM === 'number' && Number.isFinite(candidate.wM) && candidate.wM > 0))
      && (candidate.hM === undefined
        || (typeof candidate.hM === 'number' && Number.isFinite(candidate.hM) && candidate.hM > 0))
      && optionalFiniteCanvasNumber(candidate.rot)
      && optionalCanvasText(candidate.label)
      && optionalCanvasText(candidate.note);
  })) return null;

  if (!value.zones.every((candidate) => {
    if (!canvasRecord(candidate) || !Array.isArray(candidate.points)
        || candidate.points.length < 3 || !candidate.points.every(finiteCanvasPoint)) return false;
    return (candidate.feature === undefined || typeof candidate.feature === 'string')
      && optionalCanvasText(candidate.name)
      && optionalFiniteCanvasNumber(candidate.labelDx)
      && optionalFiniteCanvasNumber(candidate.labelDy)
      && optionalFiniteCanvasNumber(candidate.levelM)
      && optionalFiniteCanvasNumber(candidate.measuredSlopePct);
  })) return null;

  if (!value.lines.every((candidate) => {
    if (!canvasRecord(candidate) || typeof candidate.kind !== 'string' || !candidate.kind
        || !Array.isArray(candidate.points)
        || candidate.points.length < 2 || !candidate.points.every(finiteCanvasPoint)) return false;
    return optionalCanvasText(candidate.name)
      && optionalFiniteCanvasNumber(candidate.labelDx)
      && optionalFiniteCanvasNumber(candidate.labelDy);
  })) return null;

  if (value.useCustomBase !== undefined && typeof value.useCustomBase !== 'boolean') return null;
  // A corrupt or absurd factor must not silently rescale a farm. Out-of-range is rejected as
  // invalid state rather than clamped: a stored 0 or a 500× is not a scale anyone measured, and
  // quietly "fixing" it to a bound would hide the corruption behind plausible-looking metres.
  if (value.scaleFactor !== undefined) {
    if (typeof value.scaleFactor !== 'number'
      || !Number.isFinite(value.scaleFactor)
      || value.scaleFactor < MIN_SCALE_FACTOR
      || value.scaleFactor > MAX_SCALE_FACTOR) return null;
  }
  if (value.customBase !== undefined && value.customBase !== null) {
    if (!canvasRecord(value.customBase)
        || typeof value.customBase.url !== 'string' || !value.customBase.url
        || typeof value.customBase.mPerPx !== 'number'
        || !Number.isFinite(value.customBase.mPerPx) || value.customBase.mPerPx <= 0
        || typeof value.customBase.uploadedAt !== 'string'
        || !Number.isFinite(Date.parse(value.customBase.uploadedAt))) return null;
  }
  if (value.localWind !== undefined) {
    if (!canvasRecord(value.localWind)
        || typeof value.localWind.prevailingFrom !== 'string'
        || !isCompassDirection16(value.localWind.prevailingFrom)
        || (value.localWind.strongestFrom !== undefined
          && (typeof value.localWind.strongestFrom !== 'string'
            || !isCompassDirection16(value.localWind.strongestFrom)))
        || typeof value.localWind.recordedAt !== 'string'
        || !Number.isFinite(Date.parse(value.localWind.recordedAt))) return null;
  }
  if (value.dailyWaterUseL !== undefined
      && (typeof value.dailyWaterUseL !== 'number'
        || !Number.isFinite(value.dailyWaterUseL) || value.dailyWaterUseL < 0)) return null;

  const state = normalizeZoneNumbers(value as unknown as DesignCanvasState);
  const rev = revOf(state);
  return state.rev === rev ? state : { ...state, rev };
}

export function loadCanvasState(
  siteId: string,
  ownerUid?: string | null,
): DesignCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(siteId, ownerUid));
    if (!raw) return null;
    return normaliseCanvasState(JSON.parse(raw), siteId);
  } catch {
    return null;
  }
}

// Returns the restamped state (fresh updatedAt) so a caller that also syncs to the cloud
// pushes the SAME timestamp that was persisted locally — pushing the pre-stamp object would
// send a stale updatedAt and lose a genuine edit to last-write-wins on a two-device race.
/** Thrown when the design genuinely could not be persisted. Callers MUST surface this — silently
 *  returning "saved" is what let a farmer's zones disappear while the header said "Saved". */
export class CanvasSaveError extends Error {}

/** The glossy render cache keeps multi-MB dataURLs under `imbewu_design_glossy_*` and can exhaust
 *  the localStorage quota. The DESIGN outranks cached pictures every time — evict them to make
 *  room. Returns how many were dropped. */
export function evictGlossyCache(): number {
  let n = 0;
  if (typeof window === 'undefined') return 0;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('imbewu_design_glossy_')) {
        localStorage.removeItem(k);
        n += 1;
      }
    }
  } catch {
    /* best effort */
  }
  return n;
}

export function saveCanvasState(state: DesignCanvasState): DesignCanvasState {
  // rev is bumped from the state the CALLER is holding — deliberately NOT from whatever is
  // currently in localStorage. Taking the max of the two would let a caller working off a stale
  // in-memory snapshot inherit a high rev and then out-rank the good cloud copy, which is the
  // very bug this counter exists to stop. A stale caller must produce a LOW rev and lose.
  const clean = normaliseCanvasState(state, state?.siteId);
  if (!clean) throw new CanvasSaveError('Could not save an invalid design.');
  const stamped: DesignCanvasState = {
    ...clean,
    updatedAt: new Date().toISOString(),
    rev: revOf(clean) + 1,
  };
  if (typeof window === 'undefined') return stamped;
  const ownerUid = activeAccountUid();
  const storageKey = activeAccountLocalStorageKey(baseKeyFor(clean.siteId));
  const write = () => localStorage.setItem(storageKey, JSON.stringify(stamped));
  try {
    write();
  } catch {
    // Out of quota (almost always the render cache). Drop the pictures and try once more —
    // never let a cached render cost the farmer their design.
    evictGlossyCache();
    try {
      write();
    } catch {
      throw new CanvasSaveError('Could not save your design — this device’s storage is full.');
    }
  }
  if (activeAccountUid() === ownerUid) {
    window.dispatchEvent(new CustomEvent(DESIGN_CANVAS_CHANGED_EVENT));
  }
  return stamped;
}

// Writes `state` to localStorage EXACTLY as handed in — no updatedAt restamp, no rev bump — and
// dispatches the change event either way. Shared by the two callers that must move a state around
// WITHOUT claiming it as a new local edit; the difference between them is intent, not mechanics,
// so they share the mechanics and document the intent separately.
function writeCanvasStateVerbatim(
  state: DesignCanvasState,
  ownerUid?: string | null,
): void {
  if (typeof window === 'undefined') return;
  const clean = normaliseCanvasState(state, state?.siteId);
  if (!clean) return;
  const eventOwnerUid = ownerUid === undefined ? activeAccountUid() : ownerUid;
  const write = () => localStorage.setItem(keyFor(clean.siteId, ownerUid), JSON.stringify(clean));
  try {
    write();
  } catch {
    evictGlossyCache(); // same rule: cached pictures never outrank a real design
    try {
      write();
    } catch {
      /* Couldn't cache it locally — still dispatch below so the OPEN PAGE picks up the cloud
         copy. Swallowing the event here meant a good remote state could never rescue a
         quota-starved device (it just kept showing the stale, zone-less snapshot). */
    }
  }
  if (activeAccountUid() === eventOwnerUid) {
    window.dispatchEvent(new CustomEvent(DESIGN_CANVAS_CHANGED_EVENT));
  }
}

// Applies a state that a cloud merge (lib/design-canvas-sync.ts) already decided is newest —
// written verbatim, WITHOUT restamping updatedAt and WITHOUT bumping rev (this device is
// RECEIVING an edit, not making one; restamping/bumping would make a same-tick re-reconcile think
// this device just edited it, and would inflate rev on every hop between devices until the
// counter meant nothing). Still dispatches the change event so the page's normal refresh() path
// picks it up like any external change.
export function applyRemoteCanvasState(
  state: DesignCanvasState,
  ownerUid?: string | null,
): void {
  writeCanvasStateVerbatim(normalizeZoneNumbers(state), ownerUid);
}

/** Persists a NAVIGATION-ONLY change — today that means `step`, where the farmer is in the wizard
 *  — WITHOUT restamping updatedAt and WITHOUT bumping rev.
 *
 *  WHY this exists instead of just calling saveCanvasState: updatedAt and rev are the two fields
 *  cloud sync ranks copies by. Moving between wizard steps changes no design content, so counting
 *  it as an edit hands a device holding a STALE snapshot a free promotion to "newest" — it can
 *  out-rank and erase a good cloud copy without the farmer ever touching their design. Looking at
 *  a page is not editing it, and must not move the counters. */
export function saveCanvasNavigation(state: DesignCanvasState): void {
  writeCanvasStateVerbatim(state);
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

// Ray-casting point-in-polygon test. `ring` is a normalised [0..1] polygon ring.
export function pointInRing(pt: [number, number], ring: Array<[number, number]>): boolean {
  const [px, py] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Distance in metres between two normalised [0..1] points within the same frame.
// Respects imgW/imgH aspect — dx uses imgW, dy uses imgH (both scaled by mPerPx).
export function distM(
  a: [number, number],
  b: [number, number],
  frame: Pick<CanvasFrame, 'imgW' | 'imgH' | 'mPerPx'>,
): number {
  const dx = (a[0] - b[0]) * frame.imgW * frame.mPerPx;
  const dy = (a[1] - b[1]) * frame.imgH * frame.mPerPx;
  return Math.sqrt(dx * dx + dy * dy);
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `dc_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Auto-detect (Tier 1) ──────────────────────────────────────────────────────
// AI-suggested features from the satellite image. Suggestions are GHOSTS until the
// farmer accepts them (they then become normal items/zones/lines via onChange).
export type SuggestionKind =
  | 'tree' | 'building' | 'water_tank' | 'pond' | 'veg_area' | 'driveway' // vision (base step)
  | 'zone' | 'greywater' | 'compost' | 'beehive' | 'veg_bed' | 'nursery' | 'swale'; // local per-step generators

export interface DetectSuggestion {
  id: string;
  kind: SuggestionKind;
  points: Array<[number, number]>; // normalised [0..1]; length 1 = point (use sizeM), 2+ = line, 3+ ring for areas
  sizeM?: number; // canopy/footprint diameter estimate for point features
  zone?: 0 | 1 | 2 | 3 | 4 | 5; // set when kind === 'zone'
  note?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/**
 * The zone number a selection IS, for the chip row at the bottom of the Zones step.
 *
 * Until this existed a chip only lit while the zone DRAW tool was armed, so tapping an
 * existing Zone 4 ring left all six chips dark: the row answered "what will I paint next?"
 * while the farmer was asking "what am I holding?" (Rory, mid-layout: "when i select
 * something like in this case a zone it must light up the option the selctor option at the
 * bottom").
 *
 * Three deliberate nulls, each of which would otherwise light a chip that lies:
 *  - a MIXED selection has no single answer, so no chip lights rather than an arbitrary one;
 *  - rings carrying a `feature` are ground/built features whose `zone` "rides along as an
 *    inert value" (see ZoneShape), so reading it would assert a zone nobody chose;
 *  - anything outside 0–5 after coercion.
 *
 * Number() is not defensive padding: legacy states persisted `zone` as a STRING, which is
 * the same coercion bug that once made the Zones step read 0 of 4 rings while they rendered
 * perfectly. Strict === against a numeric chip key would silently never match those.
 */
export function zoneOfSelection(
  zones: ZoneShape[],
  selectedIds: readonly string[],
): 0 | 1 | 2 | 3 | 4 | 5 | null {
  if (selectedIds.length === 0) return null;
  const ids = new Set(selectedIds);
  const zs = zones.filter((z) => ids.has(z.id) && z.feature == null).map((z) => Number(z.zone));
  if (zs.length === 0) return null;
  const first = zs[0];
  if (!zs.every((z) => z === first)) return null;
  return Number.isInteger(first) && first >= 0 && first <= 5 ? (first as 0 | 1 | 2 | 3 | 4 | 5) : null;
}
