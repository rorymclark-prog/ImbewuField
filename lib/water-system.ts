// Design Studio — water reticulation rules engine.
//
// DERIVES the farm's water SYSTEM — gutters, first-flush, tanks, pump, buried main, drip header &
// laterals, greywater, overflow — from what the farmer actually placed. The "Water, Greywater &
// Irrigation Plan" (docs/PLAN-SET-SPEC.md, sheet 03) has to be a sheet a farmer can BUILD from;
// today it draws the placed markers and nothing between them, which is an inventory, not a plan.
//
// The owner's rule, and the spine of this file: **where there is a veg bed assume drip irrigation;
// where there is a banana circle assume a greywater basin.** Everything else follows from what is
// on the canvas — we emit NOTHING for a source that is absent rather than inventing a farm.
//
// Pure and deterministic on purpose (no React/DOM/storage, no Math.random, no Date.now): same
// design in, same system out. That is load-bearing for the whole plan set — sheet 01 promises
// "authoritative geometry for all following sheets", and that promise only holds while every sheet
// is a FUNCTION of the same true polygons. It is also why our exact maps beat generative ones.
//
// Coordinates are NORMALISED [0..1] in the CanvasFrame exactly as in lib/design-canvas.ts (x right,
// y increases SOUTH). Every angle, rotation and "nearest" decision happens in METRE space (see
// toMetres) because the two normalised axes carry different metres-per-unit whenever
// imgW !== imgH — comparing raw normalised distances would quietly skew every choice this file
// makes, and a plan whose "nearest tank" is wrong is worse than no plan.

import type { CanvasFrame, DesignCanvasState, PlacedItem } from '@/lib/design-canvas';
import { distM, pointInRing } from '@/lib/design-canvas';
import type { DesignElementDef } from '@/lib/design-elements';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  roofHarvestLitres,
} from '@/lib/roof-runoff';
import { computeTankSizing } from '@/lib/tank-sizing';

// ── Public contract ───────────────────────────────────────────────────────────

export type WaterRunKind = 'gutter' | 'main' | 'drip_header' | 'drip_lateral' | 'greywater' | 'overflow';
export type WaterNodeKind = 'first_flush' | 'pump' | 'diverter' | 'tank' | 'tap' | 'basin';

export interface WaterRun {
  kind: WaterRunKind;
  points: Array<[number, number]>; // normalised [0..1] polyline, >= 2 points
  label: string;
  proposed: boolean;
}

export interface WaterNode {
  kind: WaterNodeKind;
  at: [number, number]; // normalised [0..1]
  label: string;
  proposed: boolean;
}

export interface WaterSystem {
  runs: WaterRun[];
  nodes: WaterNode[];
  notes: string[];
  /** The subset printed in the Water sheet footer; kept separate from routing/site notes. */
  storageNotes: string[];
}

/** `proposed: false` means the FARMER put it there; `proposed: true` means WE inferred it. The
 *  sheet's legend splits EXISTING vs PROPOSED on exactly this flag, so it is load-bearing: marking
 *  a farmer-placed tank as "proposed" tells them to go buy a tank they already own. Nothing in this
 *  file may set `proposed: true` on a position that came off a PlacedItem. */
type Pt = [number, number];

/** The subset of CanvasFrame the maths needs — same three fields design-canvas's distM takes. */
export interface FrameMetrics {
  imgW: number;
  imgH: number;
  mPerPx: number;
}

// ── Element classification ────────────────────────────────────────────────────
// Exported so the rules are inspectable and re-taggable from one place: when the catalog gains a
// tank size or a bed type, this is the only edit. (See docs/DESIGN-TAXONOMY.md — 'earthworks' now
// holds the bed-shaped items, so these sets deliberately span categories rather than keying off
// def.category, which would silently change meaning the next time an element is re-filed.)

/** Roof-fed storage. Everything here gets a gutter from the roof (rule 1). */
export const TANK_IDS: ReadonlySet<string> = new Set([
  'jojo_1000',
  'jojo_2500',
  'jojo_5000',
  'jojo_10000',
  'rain_barrel',
]);

/** Beds that get drip. The owner's rule — "where there is a veg bed assume drip irrigation". */
export const IRRIGABLE_BED_IDS: ReadonlySet<string> = new Set(['veg_bed', 'keyhole_bed', 'herb_spiral']);

/** Greywater consumers. The owner's rule — "where there is a banana circle assume greywater". */
export const GREYWATER_SINK_IDS: ReadonlySet<string> = new Set(['banana_circle', 'tree_basin']);

/** Somewhere a full tank can safely dump. */
export const OVERFLOW_SINK_IDS: ReadonlySet<string> = new Set(['pond_small', 'dam', 'greywater_basin']);

// ── Tunables ──────────────────────────────────────────────────────────────────

const FIRST_FLUSH_SNAP_M = 5; // a placed first-flush this close to a downpipe IS that downpipe's
const FIRST_FLUSH_OFFSET_M = 1.2; // where we propose one: just off the wall, on the downpipe
const FIRST_FLUSH_MAX_FRAC = 0.35; // ...but never past a third of a short run — "near the house end"
const PUMP_SNAP_M = 5; // a placed pump this close to the tanks IS the tank cluster's pump
const PUMP_OFFSET_M = 1.5; // where we propose one: beside the tanks, facing the beds
const SPUR_MIN_M = 0.5; // below this a spur is a dot, not a pipe — don't draw it
const COVER_TOL_M = 3; // an existing line within this of BOTH ends already makes the connection
const EXISTING_DRIP_SNAP_M = 2; // a farmer-drawn drip line this close to a bed IS that bed's drip
const LATERAL_SPACING_M = 1; // target spacing → 2..4 laterals per bed
const LATERAL_MIN = 2;
const LATERAL_MAX = 4;
const CIRCLE_LATERAL_FRAC = 0.9; // keep round-bed laterals off the tangent points (chord → 0)
const ELBOW_CLEAR_M = 1.2; // push a detour this far off the wall it is going around
const BASIN_TRY_M = [6, 4, 2.5]; // infiltration basin: preferred stand-off, then fallbacks
const CROSS_SAMPLES = 32; // interior samples per segment for the house-crossing test

// ── Exported pure helpers ─────────────────────────────────────────────────────
// Small and exported rather than inlined: every one of these is used from several rules below, and
// a second hand-rolled copy of "nearest point on the house" is exactly how two sheets start
// disagreeing about where the house is.

/** Metres per one unit of normalised X / Y. The frame's PIXELS are square (mPerPx is metres per
 *  logical pixel, uniform) but the normalised AXES are not: x spans imgW px and y spans imgH px, so
 *  one normalised unit is a different number of metres on each axis unless imgW === imgH. Same
 *  convention design-canvas's distM uses — keep the two in lockstep. */
export function metresPerNormUnit(frame: FrameMetrics): [number, number] {
  return [frame.imgW * frame.mPerPx, frame.imgH * frame.mPerPx];
}

/** Normalised [0..1] → isotropic METRE space. The only space where a right angle is a right angle. */
export function toMetres(pt: Pt, frame: FrameMetrics): Pt {
  const [mx, my] = metresPerNormUnit(frame);
  return [pt[0] * mx, pt[1] * my];
}

/** Metre space → normalised [0..1]. Exact inverse of toMetres. */
export function toNorm(pt: Pt, frame: FrameMetrics): Pt {
  const [mx, my] = metresPerNormUnit(frame);
  return [mx > 0 ? pt[0] / mx : 0, my > 0 ? pt[1] / my : 0];
}

/** Vertex-average centroid of a normalised ring. Deliberately the same cheap average the Studio
 *  already uses (DesignCanvas's ringCentroid / DesignGlossy's centroidOf) and NOT a true area
 *  centroid: the water plan must point at the same "middle of the house" every other sheet labels,
 *  and on an L-shaped roof an area centroid would disagree with both of them. */
export function ringCentroid(ring: Pt[]): Pt {
  if (ring.length === 0) return [0.5, 0.5];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

/** Ring area in TRUE m² (shoelace, evaluated in metre space). Feeds the roof-catchment note. */
export function ringAreaM2(ring: Pt[], frame: FrameMetrics): number {
  if (ring.length < 3) return 0;
  const m = ring.map((p) => toMetres(p, frame));
  let twice = 0;
  for (let i = 0, j = m.length - 1; i < m.length; j = i++) {
    twice += m[j][0] * m[i][1] - m[i][0] * m[j][1];
  }
  return Math.abs(twice) / 2;
}

/** Annual roof harvest in litres.
 *
 * Dimensional identity: 1 mm falling on 1 m² is 1 L. The single runoff coefficient then accounts
 * for losses without changing units. Invalid or absent measurements deliberately produce zero,
 * never NaN/Infinity that could leak into a farmer-facing sheet. */
export function annualRoofHarvestLitres(roofM2: number, rainfallMm: number): number {
  return roofHarvestLitres(roofM2, rainfallMm, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT);
}

/** Capacity stated by the catalog label, in litres. A capacity-less name is unknown rather than
 * guessed: "Rain Barrel" covers many real sizes, and pretending otherwise could make inadequate
 * storage look sufficient. */
export function statedTankCapacityLitres(def: Pick<DesignElementDef, 'name'>): number | null {
  const match = def.name.match(/\b(\d[\d ]*)\s*L\b/i);
  if (!match) return null;
  const litres = Number(match[1].replace(/\s/g, ''));
  return Number.isFinite(litres) && litres > 0 ? litres : null;
}

export interface RingHit {
  point: Pt; // normalised
  distM: number;
  index: number; // index of the edge the hit landed on (edge i runs vertex i → i+1)
}

/** Nearest point on a ring's EDGES (not just its vertices) to `pt`, measured in metre space.
 *  `closed` walks the closing edge back to vertex 0 — a house outline is a closed ring, a driveway
 *  or a pipe polyline is not. Returns null for a degenerate ring (<2 points) rather than throwing.
 *  Ties resolve to the lowest edge index, which is what keeps the whole engine deterministic. */
export function nearestPointOnRing(pt: Pt, ring: Pt[], frame: FrameMetrics, closed = true): RingHit | null {
  if (ring.length < 2) return null;
  const p = toMetres(pt, frame);
  const m = ring.map((q) => toMetres(q, frame));
  const last = closed ? m.length : m.length - 1;

  let best: RingHit | null = null;
  for (let i = 0; i < last; i++) {
    const a = m[i];
    const b = m[(i + 1) % m.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 1e-9 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = a[0] + t * dx;
    const cy = a[1] + t * dy;
    const d = Math.hypot(p[0] - cx, p[1] - cy);
    if (!best || d < best.distM) best = { point: toNorm([cx, cy], frame), distM: d, index: i };
  }
  return best;
}

/** Does segment a→b pass through the ring's INTERIOR?
 *
 *  Sampled rather than solved analytically on purpose: in this file both endpoints routinely sit
 *  exactly ON the ring — a gutter starts on the house wall, a greywater diverter IS a point on it —
 *  and an exact segment/edge intersection test calls those touches crossings, which would send
 *  every single run on a pointless detour around the building it is supposed to start at. Sampling
 *  the interior asks the question we actually care about: does the pipe go THROUGH the house? */
export function segmentCrossesRing(a: Pt, b: Pt, ring: Pt[]): boolean {
  if (ring.length < 3) return false;
  for (let i = 1; i < CROSS_SAMPLES; i++) {
    const t = i / CROSS_SAMPLES;
    if (pointInRing([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ring)) return true;
  }
  return false;
}

/** Route from → to with AT MOST ONE elbow, kept out of the house.
 *
 *  Deliberately not a pathfinder. If the straight run is clear it wins; otherwise we try each house
 *  corner (pushed ELBOW_CLEAR_M clear of the wall) as a single elbow and take the shortest that
 *  works. If none works we return the straight run rather than inventing a baroque path: a plan
 *  that leaves one pipe for the installer to think about beats one that confidently draws nonsense,
 *  and the notes box already says "confirm levels on site". */
export function routeAround(from: Pt, to: Pt, houseRing: Pt[], frame: FrameMetrics): Pt[] {
  if (houseRing.length < 3 || !segmentCrossesRing(from, to, houseRing)) return [from, to];

  const centre = ringCentroid(houseRing);
  const centreM = toMetres(centre, frame);
  let best: { elbow: Pt; lenM: number } | null = null;

  for (const v of houseRing) {
    const vm = toMetres(v, frame);
    const ox = vm[0] - centreM[0];
    const oy = vm[1] - centreM[1];
    const len = Math.hypot(ox, oy);
    // Corner pushed radially off the wall, so the pipe skirts the building instead of hugging it.
    const elbow: Pt = len < 1e-6 ? v : toNorm([vm[0] + (ox / len) * ELBOW_CLEAR_M, vm[1] + (oy / len) * ELBOW_CLEAR_M], frame);
    if (segmentCrossesRing(from, elbow, houseRing) || segmentCrossesRing(elbow, to, houseRing)) continue;
    const lenM = distM(from, elbow, frame) + distM(elbow, to, frame);
    if (!best || lenM < best.lenM) best = { elbow, lenM };
  }

  return best ? [from, best.elbow, to] : [from, to];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface Placed {
  item: PlacedItem;
  def: DesignElementDef;
  at: Pt;
  name: string;
}

interface ExistingLine {
  kind: 'pipe' | 'drip';
  points: Pt[];
}

function isUsableFrame(f: FrameMetrics | null | undefined): f is FrameMetrics {
  return (
    !!f &&
    Number.isFinite(f.imgW) &&
    Number.isFinite(f.imgH) &&
    Number.isFinite(f.mPerPx) &&
    f.imgW > 0 &&
    f.imgH > 0 &&
    f.mPerPx > 0
  );
}

/** Coerces whatever is actually in the persisted/prop payload into a ring we can trust. A single
 *  NaN vertex from a corrupt frame migration would otherwise propagate into every run on the sheet
 *  (design-overlay learned this the hard way — see its frame guard). */
function cleanRing(pts: Array<[number, number]> | null | undefined, minPts: number): Pt[] {
  if (!Array.isArray(pts)) return [];
  const out: Pt[] = [];
  for (const p of pts) {
    if (Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])) out.push([p[0], p[1]]);
  }
  return out.length >= minPts ? out : [];
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Nearest of `list` to `pt`. Ties → earliest in array order (the order the farmer placed them). */
function nearestOf(list: Placed[], pt: Pt, frame: FrameMetrics): Placed | null {
  let best: Placed | null = null;
  let bestD = Infinity;
  for (const p of list) {
    const d = distM(pt, p.at, frame);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** A point `dM` metres from `from` toward `to`, in metre space. */
function stepToward(from: Pt, to: Pt, dM: number, frame: FrameMetrics): Pt {
  const a = toMetres(from, frame);
  const b = toMetres(to, frame);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return from;
  return toNorm([a[0] + (dx / len) * dM, a[1] + (dy / len) * dM], frame);
}

/** Like stepToward but never walks more than FIRST_FLUSH_MAX_FRAC of the way — a tank sited 1 m off
 *  the wall (the catalog's own nearRoofM is 3) must not get its filter parked past the tank. */
function alongSegment(a: Pt, b: Pt, dM: number, frame: FrameMetrics): Pt {
  const lenM = distM(a, b, frame);
  if (lenM < 1e-6) return a;
  return stepToward(a, b, Math.min(dM, lenM * FIRST_FLUSH_MAX_FRAC), frame);
}

function minDistToLineM(pt: Pt, points: Pt[], frame: FrameMetrics): number {
  const hit = nearestPointOnRing(pt, points, frame, false);
  return hit ? hit.distM : Infinity;
}

/** An existing farmer-drawn line that already MAKES this connection — it passes within COVER_TOL_M
 *  of both ends. Rule 7: their pipe wins; we never draw a proposal parallel to a real one. */
function findCovering(a: Pt, b: Pt, candidates: ExistingLine[], frame: FrameMetrics): ExistingLine | null {
  for (const e of candidates) {
    if (minDistToLineM(a, e.points, frame) <= COVER_TOL_M && minDistToLineM(b, e.points, frame) <= COVER_TOL_M) {
      return e;
    }
  }
  return null;
}

/** 62 400 → "62 kL". Hand-rolled rather than toLocaleString, which is locale-dependent and would
 *  make this engine's output differ between the farmer's phone and the server. kL also happens to
 *  be the unit SA water bills use. */
function formatLitres(litres: number): string {
  return litres >= 1000 ? `${Math.round(litres / 1000)} kL` : `${Math.round(litres)} L`;
}

/** Where a tank cluster's overflow should soak away.
 *
 *  "Downslope" wants elevation this engine's signature does not carry, so we approximate it as AWAY
 *  FROM THE HOUSE: a full tank must never dump against foundations (the catalog's own rule for
 *  infiltration_basin is "keep 5 m clear of foundations"), and downhill of a roof-fed tank is
 *  almost always away from the dwelling it stands against. Falls back to SOUTH (y increases south)
 *  when there is no house, or when the house centroid and the tanks coincide and give no direction.
 *  Steps back through BASIN_TRY_M rather than parking the basin on the neighbour's land. */
function proposeInfiltrationBasin(tankCluster: Pt, house: Pt[], boundary: Pt[], frame: FrameMetrics): Pt {
  const houseCentre = house.length >= 3 ? ringCentroid(house) : null;
  const baseM = houseCentre ? distM(houseCentre, tankCluster, frame) : 0;
  // South fallback: a point 1 normalised unit NORTH of the tanks, so stepping "away" from it heads south.
  const anchor: Pt = houseCentre && baseM > 1e-3 ? houseCentre : [tankCluster[0], tankCluster[1] - 1];
  const anchorM = houseCentre && baseM > 1e-3 ? baseM : distM(anchor, tankCluster, frame);

  for (const d of BASIN_TRY_M) {
    const cand = stepToward(anchor, tankCluster, anchorM + d, frame);
    if (boundary.length < 3 || pointInRing(cand, boundary)) return cand;
  }
  return stepToward(anchor, tankCluster, anchorM + BASIN_TRY_M[BASIN_TRY_M.length - 1], frame);
}

// ── Bed geometry ──────────────────────────────────────────────────────────────

/** A bed's true footprint expressed as an orientable frame in METRE space: the header lies along
 *  `along` at perpendicular −shortM/2, and laterals run from there toward `into`. */
interface BedFrame {
  centreM: Pt;
  along: Pt; // unit vector along the long edge
  into: Pt; // unit vector from the header side INTO the bed
  longM: number;
  shortM: number;
  isCircle: boolean;
  radiusM: number;
}

/** Local (along, into) metre offsets → a normalised point. */
function bedPoint(bf: BedFrame, k: number, perp: number, frame: FrameMetrics): Pt {
  return toNorm(
    [bf.centreM[0] + bf.along[0] * k + bf.into[0] * perp, bf.centreM[1] + bf.along[1] * k + bf.into[1] * perp],
    frame,
  );
}

/** Builds the bed's frame, oriented so the header sits on the side FACING `feed` — the shortest,
 *  most plausible plumbing, and it keeps the spur from crossing the bed it is feeding.
 *
 *  wM/hM are REAL METRES and `rot` is degrees CLOCKWISE about the footprint centre; this mirrors
 *  exactly how the canvas draws them (DesignGlossy drawMarks: translate → rotate → rect centred on
 *  the origin, and DesignCanvas's inverse hit-test), so the drip lands on the bed as drawn rather
 *  than beside it. Circles are rotation-invariant by the same convention, which frees us to point
 *  their header at the feed. */
function bedFrameFor(bed: Placed, feed: Pt, frame: FrameMetrics): BedFrame {
  const centreM = toMetres(bed.at, frame);
  const wM = bed.item.wM ?? bed.def.wM;
  const hM = bed.item.hM ?? bed.def.hM;

  if (bed.def.shape === 'circle') {
    const r = Math.max(wM, 0.2) / 2;
    const f = toMetres(feed, frame);
    const dx = centreM[0] - f[0];
    const dy = centreM[1] - f[1];
    const len = Math.hypot(dx, dy);
    // From the feed toward the bed centre → the header ends up tangent on the feed's side.
    // Degenerate (feed IS the centre): face NORTH — y increases south, so north is −y.
    const into: Pt = len < 1e-6 ? [0, -1] : [dx / len, dy / len];
    return { centreM, along: [-into[1], into[0]], into, longM: 2 * r, shortM: 2 * r, isCircle: true, radiusM: r };
  }

  const th = ((bed.item.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const ux: Pt = [cos, sin]; // the item's local +x (width) axis
  const uy: Pt = [-sin, cos]; // the item's local +y (length) axis

  const longIsY = hM >= wM;
  const along: Pt = longIsY ? uy : ux;
  const perp: Pt = longIsY ? ux : uy;
  const longM = longIsY ? hM : wM;
  const shortM = longIsY ? wM : hM;

  // Two long edges to choose between; take the one whose midpoint is nearer the feed. Strict `<`
  // means a genuine tie deterministically picks +perp.
  const f = toMetres(feed, frame);
  const midFor = (s: number): Pt => [centreM[0] - s * perp[0] * (shortM / 2), centreM[1] - s * perp[1] * (shortM / 2)];
  const dPlus = Math.hypot(midFor(1)[0] - f[0], midFor(1)[1] - f[1]);
  const dMinus = Math.hypot(midFor(-1)[0] - f[0], midFor(-1)[1] - f[1]);
  const s = dPlus <= dMinus ? 1 : -1;

  return {
    centreM,
    along,
    into: [perp[0] * s, perp[1] * s],
    longM,
    shortM,
    isCircle: false,
    radiusM: Math.max(wM, hM) / 2,
  };
}

// ── The engine ────────────────────────────────────────────────────────────────

/**
 * Derives the water reticulation implied by a placed design.
 *
 * Every rule is conditional on its source actually being on the canvas — no house means no gutters,
 * no tanks means no overflow, no beds means no main. A design with nothing water-shaped in it
 * yields an empty-but-valid system; a corrupt frame yields a fully empty one. This function never
 * throws.
 */
export function deriveWaterSystem(
  state: DesignCanvasState,
  refLayers: {
    boundary: Array<[number, number]>;
    house: Array<[number, number]>;
    driveway: Array<[number, number]>;
    drivewayClosed?: boolean;
  },
  site?: { rainfallMm?: number; monthlyRainfallMm?: number[] } | null,
): WaterSystem {
  const runs: WaterRun[] = [];
  const nodes: WaterNode[] = [];
  const notes: string[] = [];
  const storageNotes: string[] = [];
  const empty: WaterSystem = { runs: [], nodes: [], notes: [], storageNotes: [] };
  const addStorageNote = (note: string): void => {
    storageNotes.push(note);
    notes.push(note);
  };

  const raw = state?.frame as CanvasFrame | undefined;
  if (!raw) return empty;
  const frame: FrameMetrics = { imgW: raw.imgW, imgH: raw.imgH, mPerPx: raw.mPerPx };
  // A frame we cannot do metre maths in makes every number below a lie — say nothing at all.
  if (!isUsableFrame(frame)) return empty;

  const house = cleanRing(refLayers?.house, 3);
  const boundary = cleanRing(refLayers?.boundary, 3);

  // ── Classify what the farmer placed ──
  const placed: Placed[] = [];
  for (const it of Array.isArray(state.items) ? state.items : []) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
    placed.push({ item: it, def, at: [it.x, it.y], name: it.label || def.name });
  }

  const byId = (id: string) => placed.filter((p) => p.def.id === id);
  const tanks = placed.filter((p) => TANK_IDS.has(p.def.id));
  const beds = placed.filter((p) => IRRIGABLE_BED_IDS.has(p.def.id));
  const greySinks = placed.filter((p) => GREYWATER_SINK_IDS.has(p.def.id));
  const overflowSinks = placed.filter((p) => OVERFLOW_SINK_IDS.has(p.def.id));
  const greyBasins = byId('greywater_basin');
  const taps = byId('tap_point');
  const firstFlushes = byId('first_flush');
  const pumps = byId('pump_filter');

  const lines = Array.isArray(state.lines) ? state.lines : [];
  const existing: ExistingLine[] = [];
  for (const l of lines) {
    if (l.kind !== 'pipe' && l.kind !== 'drip') continue;
    const pts = cleanRing(l.points, 2);
    if (pts.length >= 2) existing.push({ kind: l.kind, points: pts });
  }
  const existingPipes = existing.filter((e) => e.kind === 'pipe');
  const existingDrip = existing.filter((e) => e.kind === 'drip');

  /** Proposes a run unless the farmer's own pipe already makes that exact connection (rule 7). */
  const addRun = (kind: WaterRunKind, from: Pt, to: Pt, label: string): void => {
    if (findCovering(from, to, existingPipes, frame)) return;
    runs.push({ kind, points: routeAround(from, to, house, frame), label, proposed: true });
  };

  // ── Rule 7: the farmer's own pipes and drip lines are EXISTING, and they go on the sheet ──
  // First, so that taps (rule 6) can tee off a real pipe and addRun can defer to one.
  for (const e of existing) {
    if (e.kind === 'pipe') runs.push({ kind: 'main', points: e.points, label: 'Existing pipe', proposed: false });
    // A hand-drawn drip line reads as the bed's feed, i.e. a header rather than a single emitter row.
    else runs.push({ kind: 'drip_header', points: e.points, label: 'Existing drip line', proposed: false });
  }

  // ── Rule 1: ROOF → TANK ──
  const claimedFirstFlush = new Set<string>();
  for (const tank of tanks) {
    nodes.push({ kind: 'tank', at: tank.at, label: tank.name, proposed: false });
    if (house.length < 3) continue; // no roof traced → nothing to catch off

    const hit = nearestPointOnRing(tank.at, house, frame, true);
    if (!hit) continue;
    const eave = hit.point;
    if (!findCovering(eave, tank.at, existingPipes, frame)) {
      runs.push({ kind: 'gutter', points: [eave, tank.at], label: `Gutter & downpipe → ${tank.name}`, proposed: true });
    }

    // A first-flush lives ON the downpipe — anywhere between eave and tank inlet — so we match a
    // placed one against the whole gutter run, not against the single point we happened to guess.
    // Claim-once, or two tanks 4 m apart would both adopt the same physical filter.
    let bestFF: Placed | null = null;
    let bestD = Infinity;
    for (const ff of firstFlushes) {
      if (claimedFirstFlush.has(ff.item.id)) continue;
      const d = minDistToLineM(ff.at, [eave, tank.at], frame);
      if (d <= FIRST_FLUSH_SNAP_M && d < bestD) {
        bestD = d;
        bestFF = ff;
      }
    }
    if (bestFF) {
      claimedFirstFlush.add(bestFF.item.id);
      nodes.push({ kind: 'first_flush', at: bestFF.at, label: bestFF.name, proposed: false });
    } else {
      nodes.push({
        kind: 'first_flush',
        at: alongSegment(eave, tank.at, FIRST_FLUSH_OFFSET_M, frame),
        label: 'First-flush / leaf filter',
        proposed: true,
      });
    }
  }

  // ── Rule 2: TANK → PUMP → MAIN ──
  // Gated on beds: a pump with nothing to irrigate is a proposal to spend money for nothing.
  const tankCluster: Pt | null = tanks.length ? ringCentroid(tanks.map((t) => t.at)) : null;
  const bedCluster: Pt | null = beds.length ? ringCentroid(beds.map((b) => b.at)) : null;
  let pumpAt: Pt | null = null;
  let trunkMain: Pt[] | null = null;

  if (tankCluster && bedCluster) {
    const placedPump = pumps.length ? nearestOf(pumps, tankCluster, frame) : null;
    if (placedPump && distM(placedPump.at, tankCluster, frame) <= PUMP_SNAP_M) {
      pumpAt = placedPump.at;
      nodes.push({ kind: 'pump', at: pumpAt, label: placedPump.name, proposed: false });
    } else {
      pumpAt = stepToward(tankCluster, bedCluster, PUMP_OFFSET_M, frame);
      nodes.push({ kind: 'pump', at: pumpAt, label: 'Pump, filter & pressure regulator', proposed: true });
    }

    // If the farmer already ran a pipe from the tanks to the beds, THAT is the main — headers tee
    // off theirs rather than off a phantom line we drew alongside it.
    //
    // Judged against ANY single bed, not just the cluster centroid: a real pipe ends AT a bed,
    // while the centroid of three beds is a spot in the dirt between them that no pipe ever ends
    // on. Testing only the centroid let a farmer's own tank→bed pipe miss by a few metres and earn
    // them a second, parallel main drawn right next to the one they already dug.
    let covering = findCovering(pumpAt, bedCluster, existingPipes, frame);
    for (const b of beds) {
      if (covering) break;
      covering = findCovering(pumpAt, b.at, existingPipes, frame);
    }
    if (covering) {
      trunkMain = covering.points;
    } else {
      trunkMain = routeAround(pumpAt, bedCluster, house, frame);
      runs.push({ kind: 'main', points: trunkMain, label: 'Buried irrigation main', proposed: true });
    }
  }

  // ── Rule 3: BEDS → DRIP ──
  /** What a bed's header should face. Falls back down the chain of things that could feed it. */
  const feedPointFor = (at: Pt): Pt => {
    if (trunkMain) {
      const hit = nearestPointOnRing(at, trunkMain, frame, false);
      if (hit) return hit.point;
    }
    if (pumpAt) return pumpAt;
    if (tankCluster) return tankCluster;
    if (house.length >= 3) return ringCentroid(house);
    return at; // nothing to face — bedFrameFor falls back to its own default orientation
  };

  for (const bed of beds) {
    // The farmer drew their own drip here → theirs wins. Don't lay a second system over it.
    let alreadyDripped = false;
    for (const e of existingDrip) {
      if (minDistToLineM(bed.at, e.points, frame) <= EXISTING_DRIP_SNAP_M) {
        alreadyDripped = true;
        break;
      }
    }
    if (alreadyDripped) continue;

    const feed = feedPointFor(bed.at);
    const bf = bedFrameFor(bed, feed, frame);
    const headerA = bedPoint(bf, -bf.longM / 2, -bf.shortM / 2, frame);
    const headerB = bedPoint(bf, bf.longM / 2, -bf.shortM / 2, frame);
    runs.push({ kind: 'drip_header', points: [headerA, headerB], label: `Drip header — ${bed.name}`, proposed: true });

    const n = clampInt(Math.round(bf.longM / LATERAL_SPACING_M), LATERAL_MIN, LATERAL_MAX);
    // Round beds: keep the laterals inside CIRCLE_LATERAL_FRAC of the diameter, or the outermost
    // chord collapses to a point at the tangent.
    const span = bf.isCircle ? bf.longM * CIRCLE_LATERAL_FRAC : bf.longM;
    for (let i = 0; i < n; i++) {
      const k = -span / 2 + (span * (i + 0.5)) / n;
      // Laterals run from the header ACROSS the bed; on a circle the far end is the chord, so they
      // stop at the bed's real edge instead of overshooting into the neighbour's mulch.
      const far = bf.isCircle ? Math.sqrt(Math.max(0, bf.radiusM * bf.radiusM - k * k)) : bf.shortM / 2;
      runs.push({
        kind: 'drip_lateral',
        points: [bedPoint(bf, k, -bf.shortM / 2, frame), bedPoint(bf, k, far, frame)],
        label: `Drip lateral — ${bed.name}`,
        proposed: true,
      });
    }

    // Connect the header back to the main.
    if (trunkMain) {
      const hit = nearestPointOnRing(headerA, trunkMain, frame, false);
      if (hit && hit.distM > SPUR_MIN_M) {
        runs.push({
          kind: 'main',
          points: routeAround(hit.point, headerA, house, frame),
          label: `Main spur — ${bed.name}`,
          proposed: true,
        });
      }
    }
  }

  // ── Rule 4: BANANA CIRCLE / TREE BASIN → GREYWATER ──
  // Needs a house: greywater comes out of a kitchen or a laundry, not out of thin air.
  if (house.length >= 3 && greySinks.length > 0) {
    const hit = nearestPointOnRing(ringCentroid(greySinks.map((s) => s.at)), house, frame, true);
    if (hit) {
      nodes.push({ kind: 'diverter', at: hit.point, label: 'Greywater diverter (kitchen / laundry)', proposed: true });
      // Every placed basin is existing infrastructure and belongs on the EXISTING side of the legend,
      // whether or not the chain below happens to route through it.
      for (const b of greyBasins) nodes.push({ kind: 'basin', at: b.at, label: b.name, proposed: false });

      let from: Pt = hit.point;
      // Route THROUGH a placed greywater basin first — that is where the water gets filtered.
      const firstBasin = greyBasins.length ? nearestOf(greyBasins, from, frame) : null;
      if (firstBasin) {
        addRun('greywater', from, firstBasin.at, `Filtered greywater line → ${firstBasin.name}`);
        from = firstBasin.at;
      }
      // Greedy nearest-neighbour CHAIN, not a star: six long lines radiating from one diverter and
      // crossing each other is not something anyone can trench, and it is not how greywater falls.
      const remaining = [...greySinks];
      while (remaining.length > 0) {
        let bi = 0;
        let bd = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const d = distM(from, remaining[i].at, frame);
          if (d < bd) {
            bd = d;
            bi = i;
          }
        }
        const next = remaining.splice(bi, 1)[0];
        addRun('greywater', from, next.at, `Greywater → ${next.name}`);
        from = next.at;
      }
    }
  }

  // ── Rule 5: OVERFLOW ──
  if (tankCluster) {
    const sink = overflowSinks.length ? nearestOf(overflowSinks, tankCluster, frame) : null;
    if (sink) {
      addRun('overflow', tankCluster, sink.at, `Tank overflow → ${sink.name}`);
    } else if (beds.length > 0) {
      const basinAt = proposeInfiltrationBasin(tankCluster, house, boundary, frame);
      nodes.push({ kind: 'basin', at: basinAt, label: 'Overflow infiltration basin', proposed: true });
      addRun('overflow', tankCluster, basinAt, 'Tank overflow → infiltration basin');
    }
  }

  // ── Rule 6: TAPS ──
  // Snapshot BEFORE any tap spur is added, so tap N cannot tee off tap N−1's spur and make the
  // output depend on the order we happened to iterate.
  const connectable = runs.filter((r) => r.kind === 'main' || r.kind === 'gutter');
  for (const tap of taps) {
    nodes.push({ kind: 'tap', at: tap.at, label: tap.name, proposed: false });
    let best: RingHit | null = null;
    for (const r of connectable) {
      const hit = nearestPointOnRing(tap.at, r.points, frame, false);
      if (hit && (!best || hit.distM < best.distM)) best = hit;
    }
    if (best && best.distM > SPUR_MIN_M) {
      runs.push({
        kind: 'main',
        points: routeAround(best.point, tap.at, house, frame),
        label: `Tap spur — ${tap.name}`,
        proposed: true,
      });
    }
  }

  // ── Rule 8: NOTES ──
  const monthlyRainfallMm = Array.isArray(site?.monthlyRainfallMm)
    && site.monthlyRainfallMm.length === 12
    && site.monthlyRainfallMm.some((mm) => Number.isFinite(mm) && mm > 0)
    ? site.monthlyRainfallMm
    : null;
  const rainfallMm = typeof site?.rainfallMm === 'number' && Number.isFinite(site.rainfallMm) && site.rainfallMm > 0
    ? site.rainfallMm
    : monthlyRainfallMm?.reduce((sum, mm) => sum + (Number.isFinite(mm) && mm > 0 ? mm : 0), 0);
  if (typeof rainfallMm === 'number' && Number.isFinite(rainfallMm) && rainfallMm > 0) {
    const mm = Math.round(rainfallMm);
    const roofM2 = ringAreaM2(house, frame);
    if (roofM2 >= 1) {
      // 1 mm on 1 m² = 1 L; the shared coefficient covers collection losses.
      const annualHarvestL = annualRoofHarvestLitres(roofM2, mm);
      addStorageNote(
        `~${mm} mm/yr on the ~${Math.round(roofM2)} m² traced roof ≈ ${formatLitres(annualHarvestL)}/yr — size tanks and first-flush against that catchment.`,
      );

      const dailyUseL = state.dailyWaterUseL;
      const hasDailyUse = typeof dailyUseL === 'number' && Number.isFinite(dailyUseL) && dailyUseL > 0;
      const sizing = monthlyRainfallMm && hasDailyUse
        ? computeTankSizing({ monthlyRainfallMm, roofAreaM2: roofM2, dailyUseL })
        : null;

      if (!monthlyRainfallMm) {
        addStorageNote('Seasonal storage sizing needs all 12 monthly rainfall totals; this sheet only has the annual figure.');
      } else if (!hasDailyUse) {
        addStorageNote('Sizing needs your daily household use — set it in the Tank Calculator.');
      } else if (sizing?.ok) {
        // The exact same monthly balance and summary the Tank Calculator shows — one source of
        // truth for wet-season banking, dry-run shortfall and the water-negative warning.
        addStorageNote(sizing.summary);
      }

      if (tanks.length === 0) {
        addStorageNote(`No rainwater storage is placed, so none of the estimated ${formatLitres(annualHarvestL)}/yr can be stored.`);
      } else {
        const capacities = tanks.map((tank) => statedTankCapacityLitres(tank.def));
        const unknownCount = capacities.filter((capacity) => capacity == null).length;
        const statedCapacityL = capacities.reduce<number>((sum, capacity) => sum + (capacity ?? 0), 0);
        if (unknownCount > 0) {
          addStorageNote(
            `${unknownCount} placed storage ${unknownCount === 1 ? 'item has' : 'items have'} no stated capacity, so total storage cannot be checked against the monthly balance.`,
          );
        } else if (sizing?.ok && sizing.waterNegative) {
          addStorageNote(
            `Placed storage totals ${formatLitres(statedCapacityL)}. The monthly balance is water-negative, so more tank capacity alone cannot close the annual catchment gap.`,
          );
        } else if (sizing?.ok) {
          const recommended = sizing.recommendedStorageL;
          addStorageNote(
            statedCapacityL >= recommended
              ? `Placed storage totals ${formatLitres(statedCapacityL)} and meets the monthly-balance recommendation of ${formatLitres(recommended)}.`
              : `Placed storage totals ${formatLitres(statedCapacityL)}, which is ${formatLitres(recommended - statedCapacityL)} below the monthly-balance recommendation of ${formatLitres(recommended)}.`,
          );
        } else {
          addStorageNote(
            `Placed storage totals ${formatLitres(statedCapacityL)}, but adequacy cannot be judged until the missing sizing input above is supplied.`,
          );
        }
        addStorageNote('Always route the overflow to a swale, basin or soakaway rather than against a wall or path.');
      }
    } else {
      addStorageNote(`~${mm} mm/yr average rainfall — size tanks off the measured roof catchment.`);
    }
  } else {
    addStorageNote('Seasonal storage sizing needs the site rainfall record.');
  }
  if (!lines.some((l) => l.kind === 'swale')) notes.push('No swale proposed.');
  notes.push('Confirm pipe sizes, greywater source and levels on site.');

  return { runs, nodes, notes, storageNotes };
}
