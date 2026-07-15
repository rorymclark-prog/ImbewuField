// Design Studio — Tier-1 auto-suggest generators.
//
// Pure, deterministic, instant geometry-driven suggestions for the four wizard steps
// (zones / water / structures / planting). No React, no network, no randomness.
// Every generator returns DetectSuggestion[] (status:'pending', from lib/design-canvas.ts)
// and every point/ring produced here is guaranteed inside the plot boundary.

import polygonClipping from 'polygon-clipping';
import { newId, pointInRing, type DetectSuggestion } from '@/lib/design-canvas';

type Ring = Array<[number, number]>;
type Pt = [number, number];

// ── Small geometry helpers ────────────────────────────────────────────────────

function centroid(ring: Ring): Pt {
  if (ring.length === 0) return [0.5, 0.5];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

// Scales every vertex of `ring` toward `centre` by factor f (0 = at centre, 1 = unchanged).
function scaleRingToward(ring: Ring, centre: Pt, f: number): Ring {
  return ring.map(([x, y]) => [centre[0] + f * (x - centre[0]), centre[1] + f * (y - centre[1])]);
}

function dist2(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

// Nudge a point toward `target` until it lands inside `boundary` (or give up after a few steps).
function nudgeInside(pt: Pt, target: Pt, boundary: Ring): Pt {
  if (boundary.length < 3 || pointInRing(pt, boundary)) return pt;
  let cur: Pt = pt;
  for (let i = 1; i <= 8; i++) {
    const f = i / 8;
    const candidate: Pt = [cur[0] + (target[0] - cur[0]) * f, cur[1] + (target[1] - cur[1]) * f];
    if (pointInRing(candidate, boundary)) return candidate;
  }
  return target;
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// Metres → normalised delta helpers (respect the frame's non-square aspect).
function metresToNormFactory(mPerPx: number, imgW: number, imgH: number) {
  return {
    dxNorm: (m: number) => m / (mPerPx * imgW),
    dyNorm: (m: number) => m / (mPerPx * imgH),
  };
}

function houseCentre(boundary: Ring, house: Ring): Pt {
  if (house.length >= 3) return centroid(house);
  const c = centroid(boundary);
  return centroid(scaleRingToward(boundary, c, 0.3));
}

// ── suggestZones ───────────────────────────────────────────────────────────────
// Zones are carved from the REAL plot with deterministic polygon boolean ops — never
// scaled copies of the boundary. Anchored at the house's accessible side (the driveway if
// traced, else a frontage guess), zones fill outward by walking effort, dodge the house and
// any accepted structures, and (when the coarse site slope says something meaningful) split
// the low-care/conservation split along the downhill direction instead of another ring.

// polygon-clipping's own MultiPolygon shape is identical to our Ring[] — reuse the Ring/Pt
// aliases above rather than importing its exported (differently-named) type aliases.
type PcPoly = Ring[]; // [outerRing, ...holes]
type PcMulti = PcPoly[];

export interface ZoneSuggestFrame {
  imgW: number;
  imgH: number;
  mPerPx: number;
}

export interface ZoneSuggestSite {
  slopeDeg?: number;
  aspectLabel?: string;
}

export interface ZoneSuggestStructure {
  x: number;
  y: number; // normalised [0..1] centre, same convention as PlacedItem
  wM?: number;
  hM?: number;
}

export interface ZoneSuggestOpts {
  frame: ZoneSuggestFrame; // required — metre-accurate radii need real px/metre scale
  driveway?: Ring; // refLayers.driveway — often empty (untraced)
  site?: ZoneSuggestSite | null;
  structures?: ZoneSuggestStructure[]; // ACCEPTED items only (canvasState.items, category 'structure')
  existingVeg?: Array<{ x: number; y: number }>; // ACCEPTED items only (category 'growing')
  // OPTIONAL, backward-compatible: extra adopted ground-feature outlines (normalised [0..1]
  // rings — e.g. a traced driveway edge, a dam bank, an existing bed) that a suggested zone
  // edge should SNAP onto when it runs within a couple of metres of one. The plot boundary and
  // any `structures` are always snap targets; this adds the rest. Used only if provided.
  snapEdges?: Ring[];
}

// Wrap every boolean op so a degenerate/self-intersecting input can never crash the caller.
function safePc(fn: () => PcMulti): PcMulti {
  try {
    return fn();
  } catch {
    return [];
  }
}

function asMulti(poly: PcPoly): PcMulti {
  return poly.length ? [poly] : [];
}

function unionAll(parts: PcMulti[]): PcMulti {
  const nonEmpty = parts.filter((p) => p.length > 0);
  if (nonEmpty.length === 0) return [];
  if (nonEmpty.length === 1) return nonEmpty[0];
  return safePc(() => polygonClipping.union(nonEmpty[0], ...nonEmpty.slice(1)));
}

// Union raw polygons (e.g. a list of individual obstacle/disk shapes) into one MultiPolygon —
// distinct from unionAll, which combines already-multi results.
function unionPolys(polys: PcPoly[]): PcMulti {
  const nonEmpty = polys.filter((p) => p.length > 0);
  if (nonEmpty.length === 0) return [];
  if (nonEmpty.length === 1) return [nonEmpty[0]];
  return safePc(() => polygonClipping.union(nonEmpty[0], ...nonEmpty.slice(1)));
}

function toPx(ring: Ring, frame: ZoneSuggestFrame): Ring {
  return ring.map(([x, y]) => [x * frame.imgW, y * frame.imgH]);
}

function toNorm(ring: Ring, frame: ZoneSuggestFrame): Ring {
  return ring.map(([x, y]) => [clamp01(x / frame.imgW), clamp01(y / frame.imgH)]);
}

// polygon-clipping wants closed rings; GeoJSON-sourced rings already are, hand-drawn ones
// may not be — top up rather than assume either way.
function closeRing(ring: Ring): Ring {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) return ring;
  return [...ring, first];
}

function ringArea(ring: Ring): number {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// Splice a hole ring into an outer ring via a zero-width "keyhole" bridge (out along the
// nearest-point pair, around the hole, back the same way) — a standard trick for carrying a
// polygon-with-a-hole through an API that only accepts one simple ring. Renders correctly
// under SVG's default nonzero fill rule (the double-back edge contributes zero winding),
// which is exactly how DesignCanvas draws ZoneShape.points (a plain <polygon>).
function bridgeHoleIntoRing(ring: Ring, hole: Ring): Ring {
  if (ring.length < 3 || hole.length < 3) return ring;
  let bestI = 0;
  let bestJ = 0;
  let bestD2 = Infinity;
  for (let i = 0; i < ring.length; i++) {
    for (let j = 0; j < hole.length; j++) {
      const d2 = dist2(ring[i], hole[j]);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
        bestJ = j;
      }
    }
  }
  const rotatedHole = [...hole.slice(bestJ), ...hole.slice(0, bestJ), hole[bestJ]];
  const out: Ring = [];
  for (let k = 0; k <= bestI; k++) out.push(ring[k]);
  out.push(...rotatedHole, ring[bestI]);
  for (let k = bestI + 1; k < ring.length; k++) out.push(ring[k]);
  return out;
}

// ZoneShape can only hold ONE ring — a distance-band cut can legitimately wrap around an
// obstacle and come back together elsewhere (a genuine multi-piece split) or simply enclose
// an interior obstacle as a hole in one piece. Multi-piece: keep the largest contiguous piece
// and disclose-by-design drop the smaller fragments. Holes: don't drop them (that would
// silently un-exclude the obstacle) — bridge them into the outer ring instead.
function largestOuterRing(mp: PcMulti): Ring {
  let best: PcPoly | null = null;
  let bestArea = 0;
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const a = ringArea(outer);
    if (a > bestArea) {
      bestArea = a;
      best = poly;
    }
  }
  if (!best) return [];
  let ring = best[0];
  for (let h = 1; h < best.length; h++) {
    const hole = best[h];
    if (hole && hole.length >= 3) ring = bridgeHoleIntoRing(ring, hole);
  }
  return ring;
}

// Zone 2 is the one zone built from TWO independent claims (the distance band AND the
// existing-veg nudge) that are frequently disjoint by design — an established bed the nudge
// is meant to protect is often well outside the ordinary zone-2 band, which is the whole
// point of nudging it. largestOuterRing's "drop the smaller piece" rule would silently
// delete that ground from every zone (not just demote it), so zone 2 instead bridges EVERY
// piece into one ring rather than picking a winner.
function mergeAllRings(mp: PcMulti): Ring {
  const flattened: Ring[] = [];
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    let ring = outer;
    for (let h = 1; h < poly.length; h++) {
      const hole = poly[h];
      if (hole && hole.length >= 3) ring = bridgeHoleIntoRing(ring, hole);
    }
    flattened.push(ring);
  }
  if (flattened.length === 0) return [];
  flattened.sort((a, b) => ringArea(b) - ringArea(a));
  let merged = flattened[0];
  for (let i = 1; i < flattened.length; i++) {
    merged = bridgeHoleIntoRing(merged, flattened[i]);
  }
  return merged;
}

function diskPoly(cx: number, cy: number, r: number): PcPoly {
  const radius = Math.max(r, 0.5);
  const steps = 48;
  const ring: Ring = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ring.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return [ring];
}

function rectPolyM(cxPx: number, cyPx: number, wM: number, hM: number, mPerPx: number): PcPoly {
  const hw = (Math.max(wM, 0.5) / 2) / mPerPx;
  const hh = (Math.max(hM, 0.5) / 2) / mPerPx;
  const ring: Ring = [
    [cxPx - hw, cyPx - hh],
    [cxPx + hw, cyPx - hh],
    [cxPx + hw, cyPx + hh],
    [cxPx - hw, cyPx + hh],
    [cxPx - hw, cyPx - hh],
  ];
  return [ring];
}

// Half-plane on the `dir` side of the line through `anchor` perpendicular to `dir` — a huge
// quad rather than true infinite geometry, `pad` just needs to exceed the plot's own extent.
function halfPlanePoly(anchor: Pt, dir: Pt, pad: number): PcPoly {
  const nx = -dir[1];
  const ny = dir[0];
  const big = Math.max(pad, 1) * 3;
  const p1: Pt = [anchor[0] + nx * big, anchor[1] + ny * big];
  const p2: Pt = [anchor[0] - nx * big, anchor[1] - ny * big];
  const p3: Pt = [p2[0] + dir[0] * big, p2[1] + dir[1] * big];
  const p4: Pt = [p1[0] + dir[0] * big, p1[1] + dir[1] * big];
  return [[p1, p2, p3, p4, p1]];
}

function bboxExtent(ring: Ring): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return Math.max(maxX - minX, maxY - minY, 1);
}

function midpoint(a: Pt, b: Pt): Pt {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function unitVec(from: Pt, to: Pt): Pt | null {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return [dx / len, dy / len];
}

// Nearest-anchor (Voronoi) partition of `open` into one cell per seed: cell i is the part of
// open that is closer to seed i than to every other seed, built by intersecting open with each
// perpendicular-bisector half-plane. This is the fix for the "concentric circles" complaint —
// the cells TILE the open space exactly (no gaps, no overlaps) and hug the real boundary,
// because the geometry is bisector cuts clipped to `open`, not discs stacked around one point.
function voronoiCells(open: PcMulti, seedsPx: Pt[], pad: number): PcMulti[] {
  // Deterministic per-index nudge so two coincident seeds can't yield a degenerate bisector.
  const seeds = seedsPx.map((s, i): Pt => [s[0] + i * 1e-3, s[1] + i * 1e-3]);
  return seeds.map((si, i) => {
    let cell: PcMulti = open;
    for (let j = 0; j < seeds.length && cell.length; j++) {
      if (j === i) continue;
      const dir = unitVec(seeds[j], si); // toward si → half-plane keeps the closer-to-si side
      if (!dir) continue;
      const half = asMulti(halfPlanePoly(midpoint(si, seeds[j]), dir, pad));
      cell = safePc(() => polygonClipping.intersection(cell, half));
    }
    return cell;
  });
}

// Nearest point ON segment ab to p (clamped — not the infinite line).
function nearestOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; d2: number } {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const len2 = abx * abx + aby * aby;
  let t = len2 > 1e-12 ? ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const point: Pt = [a[0] + abx * t, a[1] + aby * t];
  const dx = p[0] - point[0];
  const dy = p[1] - point[1];
  return { point, d2: dx * dx + dy * dy };
}

// Nearest point on a CLOSED ring's perimeter (wraps the last edge back to vertex 0) to `p`.
function nearestPointAndDist(ring: Ring, p: Pt): { point: Pt; d2: number } {
  if (ring.length === 0) return { point: p, d2: Infinity };
  if (ring.length === 1) return { point: ring[0], d2: dist2(ring[0], p) };
  let best: Pt = ring[0];
  let bestD2 = Infinity;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    const { point, d2 } = nearestOnSegment(p, a, b);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = point;
    }
  }
  return { point: best, d2: bestD2 };
}

// Evenly-sampled points along a closed ring's edges — gives sub-vertex resolution when
// hunting for "the nearest point on this perimeter", which plain vertex-comparison would miss
// on a long house wall.
function samplesAlongRing(ring: Ring, perEdge: number): Pt[] {
  const n = ring.length;
  if (n === 0) return [];
  if (n === 1) return [ring[0]];
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let k = 0; k < perEdge; k++) {
      const t = k / perEdge;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Honest fallback when no driveway is traced: the house-perimeter point closest to ANY
// boundary edge — a proxy for street frontage, not ground truth (flagged in the note).
function frontageAnchor(housePx: Ring, boundaryPx: Ring): Pt {
  const samples = samplesAlongRing(housePx, 8);
  if (samples.length === 0) return centroid(boundaryPx);
  let best = samples[0];
  let bestD2 = Infinity;
  for (const s of samples) {
    const { d2 } = nearestPointAndDist(boundaryPx, s);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = s;
    }
  }
  return best;
}

// Driveway-anchored access point: the driveway vertex nearest the house, projected onto the
// house perimeter — i.e. "where the path from the gate meets the house".
function drivewayAnchor(housePx: Ring, drivewayPx: Ring): Pt {
  const hc = centroid(housePx);
  let target = drivewayPx[0];
  let bestD2 = Infinity;
  for (const p of drivewayPx) {
    const d2 = dist2(p, hc);
    if (d2 < bestD2) {
      bestD2 = d2;
      target = p;
    }
  }
  const samples = samplesAlongRing(housePx, 8);
  if (samples.length === 0) return hc;
  let best = samples[0];
  let bestD2b = Infinity;
  for (const s of samples) {
    const d2 = dist2(s, target);
    if (d2 < bestD2b) {
      bestD2b = d2;
      best = s;
    }
  }
  return best;
}

const ASPECT_ORDER = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
];

// Aspect label → the DOWNHILL unit vector in image space (x east+, y south+, matching the
// north-up satellite convention this app assumes elsewhere) — "the slope faces X" means X is
// downhill, per the app's existing aspect-note language (lib/design-studio.ts).
function downhillVector(aspectLabel: string): Pt | null {
  const idx = ASPECT_ORDER.indexOf(aspectLabel.trim().toUpperCase());
  if (idx === -1) return null;
  const deg = idx * 22.5;
  const rad = (deg * Math.PI) / 180;
  return [Math.sin(rad), -Math.cos(rad)];
}

// ── Clip + snap to the real site ────────────────────────────────────────────────
// A Voronoi cell is built by intersecting the open space with half-plane cuts, so in the
// ideal case it already sits inside the plot — but half-plane booleans on a hand-traced
// outline can leave hairline slivers that poke past the boundary, and there is no guarantee
// for the AI-planned variants. These two steps make the invariant explicit: (1) intersect the
// finished cell with the boundary so a zone can NEVER exceed the plot, then (2) pull any zone
// vertex that lands within a small tolerance of the boundary — or an adopted ground feature —
// exactly onto that edge, so zones read as clean, land-following regions rather than shapes
// that almost-but-not-quite meet the fence line.

// Snap targets in px: the plot boundary (always), every accepted structure footprint, plus any
// caller-supplied adopted-feature outlines (opts.snapEdges). All are closed rings that lie on
// or inside the plot, so snapping onto them can never push a vertex outside the boundary.
function buildSnapTargetsPx(boundaryPx: Ring, opts: ZoneSuggestOpts, frame: ZoneSuggestFrame): Ring[] {
  const targets: Ring[] = [];
  if (boundaryPx.length >= 3) targets.push(boundaryPx);
  for (const s of opts.structures ?? []) {
    targets.push(rectPolyM(s.x * frame.imgW, s.y * frame.imgH, s.wM ?? 4, s.hM ?? 4, frame.mPerPx)[0]);
  }
  for (const e of opts.snapEdges ?? []) {
    if (e && e.length >= 2) targets.push(toPx(closeRing(e), frame));
  }
  return targets;
}

// Snap tolerance in px: ~2.5 m on the ground, but capped to a small fraction of the plot so it
// stays sensible on a tiny stand where 2.5 m would be a large share of the whole outline.
function snapTolerancePx(boundaryPx: Ring, frame: ZoneSuggestFrame): number {
  return Math.min(2.5 / frame.mPerPx, 0.04 * bboxExtent(boundaryPx));
}

// Move each vertex to the nearest point on any snap target within `tolPx`; otherwise leave it.
// Vertex-only snap (edges aren't re-split) — enough to close hairline gaps against the boundary
// and align a zone to an adopted feature, without the machinery of a full topological snap.
function snapRingToTargets(ring: Ring, targets: Ring[], tolPx: number): Ring {
  if (ring.length < 3 || targets.length === 0 || tolPx <= 0) return ring;
  const tol2 = tolPx * tolPx;
  return ring.map((v): Pt => {
    let best: Pt = v;
    let bestD2 = tol2;
    for (const t of targets) {
      const { point, d2 } = nearestPointAndDist(t, v);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = point;
      }
    }
    return best;
  });
}

// Finish a zone: clip its multipolygon to the boundary (the hard "never exceed the plot"
// guarantee), collapse to one ring (mergeAllRings for the multi-piece zone 2, largestOuterRing
// otherwise — same rule the callers already use), then snap that ring to the site edges.
// Clipping the MULTIPOLYGON (not the collapsed ring) matters: mergeAllRings emits a
// keyhole-bridged self-touching ring that a follow-up boolean op could choke on.
function finalizeZoneRing(
  mp: PcMulti,
  boundaryMulti: PcMulti,
  keepAllPieces: boolean,
  snapTargets: Ring[],
  tolPx: number,
): Ring {
  if (!mp.length) return [];
  const clipped = boundaryMulti.length
    ? safePc(() => polygonClipping.intersection(mp, boundaryMulti))
    : mp;
  const base = clipped.length ? clipped : mp;
  const ring = keepAllPieces ? mergeAllRings(base) : largestOuterRing(base);
  return snapRingToTargets(ring, snapTargets, tolPx);
}

export function suggestZones(boundary: Ring, house: Ring, opts: ZoneSuggestOpts): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const { frame } = opts;
  if (!frame || !frame.imgW || !frame.imgH || !frame.mPerPx) return [];

  const out: DetectSuggestion[] = [];

  // Zone 0 — the house itself, verbatim. It's already ground truth; nothing to derive.
  if (house.length >= 3) {
    out.push({ id: newId(), kind: 'zone', zone: 0, points: house, note: 'The home', status: 'pending' });
  }

  const boundaryPx = toPx(closeRing(boundary), frame);
  const housePx = house.length >= 3 ? toPx(closeRing(house), frame) : [];
  const drivewayPx = opts.driveway && opts.driveway.length >= 2 ? toPx(opts.driveway, frame) : [];
  const boundaryMulti: PcMulti = [[boundaryPx]];

  // ── Access anchor — everything else is measured from here ──────────────────────
  let anchorPx: Pt;
  let anchorNote: string;
  if (housePx.length >= 3) {
    if (drivewayPx.length >= 2) {
      anchorPx = drivewayAnchor(housePx, drivewayPx);
      anchorNote = 'anchored at the traced driveway';
    } else {
      anchorPx = frontageAnchor(housePx, boundaryPx);
      anchorNote = 'best-guess access side — no traced driveway, so this assumes the wall closest to the boundary is the front';
    }
  } else {
    anchorPx = centroid(boundaryPx);
    anchorNote = 'unanchored — no house traced yet, so these are plain distance bands from the plot centre, not access-based';
  }

  // ── Open space = boundary minus the house footprint minus accepted structures ───────
  const obstaclePolys: PcPoly[] = [];
  if (housePx.length >= 3) obstaclePolys.push([housePx]);
  for (const s of opts.structures ?? []) {
    obstaclePolys.push(rectPolyM(s.x * frame.imgW, s.y * frame.imgH, s.wM ?? 4, s.hM ?? 4, frame.mPerPx));
  }
  const obstacleUnion = unionPolys(obstaclePolys);
  let open: PcMulti = boundaryMulti;
  if (obstacleUnion.length) {
    const diffed = safePc(() => polygonClipping.difference(boundaryMulti, obstacleUnion));
    if (diffed.length) open = diffed;
  }

  // ── Plot-scale-adaptive band distances — bounded by human walking effort, not just plot
  // size. These are no longer disc radii: they set how far each zone's SEED sits from the
  // access point along the inward axis, so nearest-anchor cells reproduce the intended band
  // DISTANCES while following the real land shape instead of stacking as circles. ───────────
  const boundaryAreaM2 = ringArea(boundaryPx) * frame.mPerPx * frame.mPerPx;
  const scaleM = Math.sqrt(Math.max(boundaryAreaM2, 1));
  const mToPx = (m: number) => m / frame.mPerPx;
  const r1 = mToPx(Math.min(12, 0.35 * scaleM));
  const r2 = mToPx(Math.min(30, 0.6 * scaleM));
  const r3 = mToPx(Math.min(70, 0.85 * scaleM));
  const r4 = mToPx(Math.min(110, 0.95 * scaleM));

  const pad = bboxExtent(boundaryPx);
  // March seeds from the access point INTO the plot; the cut between consecutive seeds falls at
  // their midpoint, so placing seed_k at the mid-distance of each old band keeps the boundaries
  // near r1..r4 while the cells stay boundary-clipped regions rather than arcs.
  const inward = unitVec(anchorPx, centroid(boundaryPx)) ?? [0, 1];
  const bandDist = [r1 / 2, (r1 + r2) / 2, (r2 + r3) / 2, (r3 + r4) / 2, (r4 + pad) / 2];
  const seedsPx: Pt[] = bandDist.map((d): Pt => [anchorPx[0] + inward[0] * d, anchorPx[1] + inward[1] * d]);

  // Slope: split the two OUTER zones across the slope (uphill vs downhill) instead of continuing
  // the inward march, by offsetting their seeds laterally along the downhill vector.
  let usedSlope = false;
  const slopeDeg = opts.site?.slopeDeg;
  const aspect = opts.site?.aspectLabel;
  const dir = typeof slopeDeg === 'number' && Math.abs(slopeDeg) > 3 && aspect ? downhillVector(aspect) : null;
  if (dir) {
    usedSlope = true;
    const base: Pt = [anchorPx[0] + inward[0] * bandDist[3], anchorPx[1] + inward[1] * bandDist[3]];
    const lat = pad * 0.4;
    seedsPx[3] = [base[0] - dir[0] * lat, base[1] - dir[1] * lat]; // zone 4 — uphill/level side
    seedsPx[4] = [base[0] + dir[0] * lat, base[1] + dir[1] * lat]; // zone 5 — downhill side
  }

  const cells = voronoiCells(open, seedsPx, pad);

  // Existing accepted veg belongs to zone 2 whichever cell it lands in — pull it out of the
  // outer cells and fold it into zone 2 so a farmer's established beds aren't re-classified as
  // "orchard" just because they're 15 m from the door.
  const vegPx = (opts.existingVeg ?? []).map((v): Pt => [v.x * frame.imgW, v.y * frame.imgH]);
  const vegDisks = vegPx.map((v) => diskPoly(v[0], v[1], mToPx(3)));
  const vegUnion = unionPolys(vegDisks);
  const vegClaim = (vegUnion.length && open.length)
    ? safePc(() => polygonClipping.intersection(open, vegUnion))
    : [];
  if (vegClaim.length) {
    // Remove the veg claim from EVERY cell (incl. zone 1) before folding it into zone 2, so a
    // veg patch that fell in zone 1's Voronoi cell can't leave zone 1 and zone 2 overlapping.
    // largestOuterRing/mergeAllRings bridge the resulting notch, so no interior hole remains.
    for (let k = 0; k < cells.length; k++) {
      if (cells[k].length) cells[k] = safePc(() => polygonClipping.difference(cells[k], vegClaim));
    }
  }
  const zone2 = unionAll([cells[1], vegClaim]);

  // Clip-to-plot + snap-to-edges context, shared by every emitted zone below.
  const snapTargets = buildSnapTargetsPx(boundaryPx, opts, frame);
  const snapTol = snapTolerancePx(boundaryPx, frame);
  const finish = (mp: PcMulti, keepAllPieces: boolean) =>
    finalizeZoneRing(mp, boundaryMulti, keepAllPieces, snapTargets, snapTol);

  const emit = (zone: 1 | 2 | 3 | 4 | 5, ring: Ring, note: string) => {
    if (ring.length < 3) return;
    out.push({ id: newId(), kind: 'zone', zone, points: toNorm(ring, frame), note, status: 'pending' });
  };

  emit(1, finish(cells[0], false), `Daily-use — ${anchorNote}`);
  emit(2, finish(zone2, true), 'Veg beds & intensive care');
  emit(3, finish(cells[2], false), 'Orchard / food forest');
  emit(4, finish(cells[3], false), usedSlope ? 'Low-care — uphill/level side' : 'Low-care & support');
  emit(
    5,
    finish(cells[4], false),
    usedSlope
      ? `Conservation / buffer — downhill side (${slopeDeg?.toFixed(0)}° slope facing ${aspect})`
      : 'Wild edge & buffer — the ground farthest from the door',
  );

  return out;
}

// ── suggestZonesFromPlan (hybrid AI-vision) ─────────────────────────────────────
// The AI (app/api/suggest-zones-ai) does the spatial JUDGEMENT — where each zone belongs on
// THIS real plot — and returns INTENT (anchor + size + outward direction) per zone. This
// converts that intent into CLEAN geometry using the exact same open-space/disk/carve
// machinery as suggestZones, just anchored/sized per the plan instead of concentric bands
// around the door. suggestZones stays untouched as the deterministic fallback.

export interface ZonePlanZone {
  zone: number; // 0..5 (validated/clamped by the route; re-checked here)
  anchor: [number, number]; // normalised [0..1] on the image
  extentM: number; // approx radius/reach in metres
  outwardDir?: string | null; // aspect label, unused for geometry but carried for future use
  rationale?: string;
}

export interface ZonePlan {
  zones: ZonePlanZone[];
  overall?: string;
}

export function suggestZonesFromPlan(
  boundary: Ring,
  house: Ring,
  opts: ZoneSuggestOpts,
  plan: ZonePlan,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const { frame } = opts;
  if (!frame || !frame.imgW || !frame.imgH || !frame.mPerPx) return [];

  const out: DetectSuggestion[] = [];

  // Zone 0 — the house itself, verbatim (same as suggestZones).
  if (house.length >= 3) {
    out.push({ id: newId(), kind: 'zone', zone: 0, points: house, note: 'The home', status: 'pending' });
  }

  const boundaryPx = toPx(closeRing(boundary), frame);
  const housePx = house.length >= 3 ? toPx(closeRing(house), frame) : [];
  const boundaryMulti: PcMulti = [[boundaryPx]];

  // Open space = boundary minus house minus accepted structures — identical to suggestZones.
  const obstaclePolys: PcPoly[] = [];
  if (housePx.length >= 3) obstaclePolys.push([housePx]);
  for (const s of opts.structures ?? []) {
    obstaclePolys.push(rectPolyM(s.x * frame.imgW, s.y * frame.imgH, s.wM ?? 4, s.hM ?? 4, frame.mPerPx));
  }
  const obstacleUnion = unionPolys(obstaclePolys);
  let open: PcMulti = boundaryMulti;
  if (obstacleUnion.length) {
    const diffed = safePc(() => polygonClipping.difference(boundaryMulti, obstacleUnion));
    if (diffed.length) open = diffed;
  }

  // Dedupe by zone number (keep the first), drop 0 (house handled above) and out-of-range,
  // sort ascending so zone numbers read low→high (order no longer affects geometry — the
  // partition below assigns ground by nearest anchor, not by carve sequence).
  const seen = new Set<number>();
  const planZones = plan.zones
    .filter((z) => Number.isFinite(z.zone) && z.zone >= 1 && z.zone <= 5)
    .filter((z) => (seen.has(z.zone) ? false : (seen.add(z.zone), true)))
    .sort((a, b) => a.zone - b.zone);

  const emit = (zone: 1 | 2 | 3 | 4 | 5, ring: Ring, note: string) => {
    if (ring.length < 3) return;
    out.push({ id: newId(), kind: 'zone', zone, points: toNorm(ring, frame), note, status: 'pending' });
  };

  // The AI already placed each zone's anchor where it belongs on THIS real plot; a nearest-anchor
  // partition of the open space over those anchors tiles the plot into land-following regions —
  // no leftover-catch hack needed, since Voronoi cells already fill open completely.
  const seedsPx: Pt[] = planZones.map(
    (pz): Pt => [clamp01(pz.anchor[0]) * frame.imgW, clamp01(pz.anchor[1]) * frame.imgH],
  );
  const cells = voronoiCells(open, seedsPx, bboxExtent(boundaryPx));
  // Same clip-to-plot + snap-to-edges guarantee the deterministic path uses. AI-placed anchors
  // make an out-of-plot sliver more likely here, so the boundary clip matters more, not less.
  const snapTargets = buildSnapTargetsPx(boundaryPx, opts, frame);
  const snapTol = snapTolerancePx(boundaryPx, frame);
  planZones.forEach((pz, i) => {
    const zone = pz.zone as 1 | 2 | 3 | 4 | 5;
    const note = pz.rationale && pz.rationale.trim() ? pz.rationale.trim() : `Zone ${zone} (approximate)`;
    emit(zone, finalizeZoneRing(cells[i], boundaryMulti, false, snapTargets, snapTol), note);
  });

  return out;
}

// ── suggestFromAutoDesignPlan (AI Auto-Design — whole-farm intent → geometry) ─────
// The AI (app/api/auto-design) plans the ENTIRE farm and returns INTENT only. This turns
// that intent into clean PENDING suggestions the farmer Accept/Dismisses: zones via
// suggestZonesFromPlan (so Zone 0 = house is preserved verbatim), plus a veg-garden zone,
// a windward tree belt, key water items, and the main path. Every emitted kind is already
// handled by applySuggestion() in app/design/page.tsx — zero new accept plumbing.

export interface AutoDesignAnswers {
  goal?: 'food' | 'income' | 'both';
  people?: 'small' | 'medium' | 'large';
  accessSide?: string | null;
  waterSource?: 'tank' | 'borehole' | 'municipal' | null;
}

export interface AutoDesignPlan {
  zones: ZonePlanZone[];
  vegGarden?: { anchor: [number, number]; extentM: number; rationale?: string } | null;
  windbreak?: { anchor: [number, number]; dir: string; lengthM: number; rationale?: string } | null;
  water?: Array<{ kind: 'tank' | 'dam' | 'swale'; anchor: [number, number]; extentM?: number; rationale?: string }>;
  path?: { anchor: [number, number]; dir: string } | null;
  overall?: string;
}

// Aspect label → the OUTWARD unit vector in image space (x east+, y south+) — the direction
// the label points toward (N = up). Reused for both the windbreak axis and the path heading.
function aspectVector(aspectLabel: string): Pt | null {
  const idx = ASPECT_ORDER.indexOf(aspectLabel.trim().toUpperCase());
  if (idx === -1) return null;
  const rad = (idx * 22.5 * Math.PI) / 180;
  return [Math.sin(rad), -Math.cos(rad)];
}

export function suggestFromAutoDesignPlan(
  boundary: Ring,
  house: Ring,
  opts: ZoneSuggestOpts,
  plan: AutoDesignPlan,
  answers: AutoDesignAnswers,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const { frame } = opts;
  if (!frame || !frame.imgW || !frame.imgH || !frame.mPerPx) return [];

  // Zones first — this already emits Zone 0 = house verbatim and carves 1-5 (fallback-safe).
  const out: DetectSuggestion[] = suggestZonesFromPlan(boundary, house, opts, { zones: plan.zones });

  const boundaryPx = toPx(closeRing(boundary), frame);
  const housePx = house.length >= 3 ? toPx(closeRing(house), frame) : [];
  const boundaryMulti: PcMulti = [[boundaryPx]];
  const h = houseCentre(boundary, house);
  const { dxNorm, dyNorm } = metresToNormFactory(frame.mPerPx, frame.imgW, frame.imgH);

  const boundaryAreaM2 = ringArea(boundaryPx) * frame.mPerPx * frame.mPerPx;
  const scaleM = Math.sqrt(Math.max(boundaryAreaM2, 1));
  const mToPx = (m: number) => m / frame.mPerPx;

  // Open space = boundary minus house — same as the zone builders, so the veg garden lands
  // on real open ground rather than overlapping the dwelling.
  const obstaclePolys: PcPoly[] = [];
  if (housePx.length >= 3) obstaclePolys.push([housePx]);
  const obstacleUnion = unionPolys(obstaclePolys);
  let open: PcMulti = boundaryMulti;
  if (obstacleUnion.length) {
    const diffed = safePc(() => polygonClipping.difference(boundaryMulti, obstacleUnion));
    if (diffed.length) open = diffed;
  }

  // ── Veg garden — a zone-2 area disk ∩ open space at the AI anchor ────────────────────
  if (plan.vegGarden) {
    const ax = clamp01(plan.vegGarden.anchor[0]) * frame.imgW;
    const ay = clamp01(plan.vegGarden.anchor[1]) * frame.imgH;
    const rPx = mToPx(Math.max(2, Math.min(plan.vegGarden.extentM, 0.4 * scaleM)));
    const disk = asMulti(diskPoly(ax, ay, rPx));
    const claim = open.length ? safePc(() => polygonClipping.intersection(open, disk)) : [];
    const ring = largestOuterRing(claim);
    const note = plan.vegGarden.rationale?.trim() || 'Veg garden — flat, sunny, near the house';
    if (ring.length >= 3) {
      out.push({ id: newId(), kind: 'veg_area', points: toNorm(ring, frame), note, status: 'pending' });
    } else {
      // Ring clipped to nothing (anchor outside open space) — fall back to a single bed point.
      const pt = nudgeInside([clamp01(plan.vegGarden.anchor[0]), clamp01(plan.vegGarden.anchor[1])], h, boundary);
      out.push({ id: newId(), kind: 'veg_bed', points: [pt], note, status: 'pending' });
    }
  }

  // ── Windbreak — a line of trees across the windward side ─────────────────────────────
  if (plan.windbreak) {
    const dirVec = aspectVector(plan.windbreak.dir);
    if (dirVec) {
      // Belt runs PERPENDICULAR to the wind direction (a wall facing the wind).
      const perp: Pt = [-dirVec[1], dirVec[0]];
      const half = plan.windbreak.lengthM / 2;
      const anchor: Pt = [clamp01(plan.windbreak.anchor[0]), clamp01(plan.windbreak.anchor[1])];
      const nTrees = Math.max(4, Math.min(6, Math.round(plan.windbreak.lengthM / 6)));
      const note = plan.windbreak.rationale?.trim() || 'Wind belt — windward side';
      for (let i = 0; i < nTrees; i++) {
        const t = nTrees > 1 ? (i / (nTrees - 1)) * 2 - 1 : 0; // -1..1
        const offM = t * half;
        const raw: Pt = [anchor[0] + perp[0] * dxNorm(offM), anchor[1] + perp[1] * dyNorm(offM)];
        const pt = nudgeInside(raw, h, boundary);
        out.push({ id: newId(), kind: 'tree', points: [pt], sizeM: 5, note, status: 'pending' });
      }
    }
  }

  // ── Water — tanks / dam / swale at the AI anchors, biased by the stated source ───────
  const skipTanks = answers.waterSource === 'borehole' || answers.waterSource === 'municipal';
  for (const w of plan.water ?? []) {
    const anchor: Pt = [clamp01(w.anchor[0]), clamp01(w.anchor[1])];
    if (w.kind === 'tank') {
      if (skipTanks) continue;
      const pt = nudgeInside(anchor, h, boundary);
      out.push({
        id: newId(),
        kind: 'water_tank',
        points: [pt],
        sizeM: 1.8,
        note: w.rationale?.trim() || '5000 L JoJo at the biggest roof',
        status: 'pending',
      });
    } else if (w.kind === 'dam') {
      const pt = nudgeInside(anchor, h, boundary);
      out.push({
        id: newId(),
        kind: 'pond',
        points: [pt],
        sizeM: Math.max(2, Math.min(w.extentM ?? 6, 40)),
        note: w.rationale?.trim() || 'Dam / pond on the downslope side',
        status: 'pending',
      });
    } else {
      // Swale — a short contour chord centred on the anchor, run E-W as a level line proxy.
      const halfM = Math.max(4, Math.min((w.extentM ?? 20) / 2, 0.4 * scaleM));
      const pts: Ring = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4 - 0.5; // -0.5..0.5
        const raw: Pt = [anchor[0] + dxNorm(t * halfM * 2), anchor[1]];
        pts.push(nudgeInside(raw, h, boundary));
      }
      out.push({
        id: newId(),
        kind: 'swale',
        points: pts,
        note: w.rationale?.trim() || 'Swale on contour — check levels on the ground',
        status: 'pending',
      });
    }
  }

  // ── Path — only meaningful when no driveway is traced (page.tsx gates this too) ──────
  if (plan.path && (!opts.driveway || opts.driveway.length < 2)) {
    const dirVec = aspectVector(plan.path.dir);
    if (dirVec && housePx.length >= 3) {
      // From the access edge (anchor) to the house — two-point path line.
      const start: Pt = nudgeInside([clamp01(plan.path.anchor[0]), clamp01(plan.path.anchor[1])], h, boundary);
      out.push({
        id: newId(),
        kind: 'driveway',
        points: [start, h],
        note: 'Main path from the access to the house',
        status: 'pending',
      });
    }
  }

  return out;
}

// ── suggestWater ────────────────────────────────────────────────────────────────

export function suggestWater(
  boundary: Ring,
  house: Ring,
  mPerPx: number,
  imgW: number,
  imgH: number,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);
  const bCentre = centroid(boundary);
  const { dxNorm, dyNorm } = metresToNormFactory(mPerPx, imgW, imgH);
  const out: DetectSuggestion[] = [];

  if (house.length >= 3) {
    // Two house vertices furthest apart.
    let best: [number, number] = [0, 1];
    let bestD = -Infinity;
    for (let i = 0; i < house.length; i++) {
      for (let j = i + 1; j < house.length; j++) {
        const d = dist2(house[i], house[j]);
        if (d > bestD) {
          bestD = d;
          best = [i, j];
        }
      }
    }
    const hc = centroid(house);
    for (const idx of best) {
      const corner = house[idx];
      const dirX = corner[0] - hc[0];
      const dirY = corner[1] - hc[1];
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const outward: Pt = [
        corner[0] + (dirX / len) * dxNorm(2),
        corner[1] + (dirY / len) * dyNorm(2),
      ];
      const pt = nudgeInside(outward, h, boundary);
      out.push({
        id: newId(),
        kind: 'water_tank',
        points: [pt],
        sizeM: 1.8,
        note: '5000 L JoJo at the gutter corner',
        status: 'pending',
      });
    }
  }

  // Greywater basin: 6 m from house centre, away from boundary centroid (toward the more open side).
  {
    let dirX = h[0] - bCentre[0];
    let dirY = h[1] - bCentre[1];
    let len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (!Number.isFinite(len) || len < 1e-9) {
      dirX = 1;
      dirY = 0;
      len = 1;
    }
    const raw: Pt = [h[0] + (dirX / len) * dxNorm(6), h[1] + (dirY / len) * dyNorm(6)];
    const pt = nudgeInside(raw, h, boundary);
    out.push({
      id: newId(),
      kind: 'greywater',
      points: [pt],
      sizeM: 1.5,
      note: 'Greywater mulch basin on the low side',
      status: 'pending',
    });
  }

  // Swale: horizontal chord 60% of the way from h to boundary centroid.
  {
    const targetY = h[1] + (bCentre[1] - h[1]) * 0.6;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
      const [xi, yi] = boundary[i];
      const [xj, yj] = boundary[j];
      const crosses = (yi <= targetY && yj >= targetY) || (yj <= targetY && yi >= targetY);
      if (crosses && Math.abs(yj - yi) > 1e-9) {
        const t = (targetY - yi) / (yj - yi);
        const x = xi + t * (xj - xi);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
    if (Number.isFinite(minX) && Number.isFinite(maxX) && maxX > minX) {
      const pts: Ring = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        const x = minX + (maxX - minX) * t;
        const raw: Pt = [x, targetY];
        pts.push(nudgeInside(raw, h, boundary));
      }
      out.push({
        id: newId(),
        kind: 'swale',
        points: pts,
        note: 'Swale on contour — check levels on the ground',
        status: 'pending',
      });
    }
  }

  return out;
}

// ── suggestStructures ────────────────────────────────────────────────────────────

export function suggestStructures(
  boundary: Ring,
  house: Ring,
  mPerPx: number,
  imgW: number,
  imgH: number,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);
  const bCentre = centroid(boundary);
  const { dxNorm, dyNorm } = metresToNormFactory(mPerPx, imgW, imgH);
  const out: DetectSuggestion[] = [];

  let dirX = bCentre[0] - h[0];
  let dirY = bCentre[1] - h[1];
  let len = Math.sqrt(dirX * dirX + dirY * dirY);
  if (!Number.isFinite(len) || len < 1e-9) {
    dirX = 1;
    dirY = 0;
    len = 1;
  }
  const ux = dirX / len;
  const uy = dirY / len;

  // Compost: 5 m from house toward boundary centroid.
  const compostRaw: Pt = [h[0] + ux * dxNorm(5), h[1] + uy * dyNorm(5)];
  const compost = nudgeInside(compostRaw, h, boundary);
  out.push({
    id: newId(),
    kind: 'compost',
    points: [compost],
    note: 'Compost within a wheelbarrow run of the kitchen',
    status: 'pending',
  });

  // Nursery: 4 m beside the compost point (perpendicular offset).
  const perpX = -uy;
  const perpY = ux;
  const nurseryRaw: Pt = [compost[0] + perpX * dxNorm(4), compost[1] + perpY * dyNorm(4)];
  const nursery = nudgeInside(nurseryRaw, h, boundary);
  out.push({
    id: newId(),
    kind: 'nursery',
    points: [nursery],
    note: 'Nursery table beside the compost',
    status: 'pending',
  });

  // Beehive: furthest boundary vertex from h, pulled 8% toward h.
  if (boundary.length >= 3) {
    let far = boundary[0];
    let farD = -Infinity;
    for (const p of boundary) {
      const d = dist2(p, h);
      if (d > farD) {
        farD = d;
        far = p;
      }
    }
    const beehiveRaw: Pt = [far[0] + (h[0] - far[0]) * 0.08, far[1] + (h[1] - far[1]) * 0.08];
    const beehive = nudgeInside(beehiveRaw, h, boundary);
    out.push({
      id: newId(),
      kind: 'beehive',
      points: [beehive],
      note: 'Beehive on the quiet far edge — flight path away from paths',
      status: 'pending',
    });
  }

  return out;
}

// ── suggestPlanting ──────────────────────────────────────────────────────────────

export function suggestPlanting(
  boundary: Ring,
  house: Ring,
  mPerPx: number,
  imgW: number,
  imgH: number,
): DetectSuggestion[] {
  if (boundary.length < 3) return [];
  const h = houseCentre(boundary, house);
  const { dxNorm, dyNorm } = metresToNormFactory(mPerPx, imgW, imgH);
  const out: DetectSuggestion[] = [];

  // Three trees in an arc SOUTH of the house (y increases southward) — the sun travels
  // through the northern sky here, so a canopy south of the beds can't shade them.
  const dyM = 10;
  for (const dxM of [-8, 0, 8]) {
    const raw: Pt = [h[0] + dxNorm(dxM), h[1] + dyNorm(dyM)];
    const pt = nudgeInside(raw, h, boundary);
    out.push({
      id: newId(),
      kind: 'tree',
      points: [pt],
      sizeM: 5,
      note: 'Fruit tree — south side, sun stays clear of the beds',
      status: 'pending',
    });
  }

  // Veg bed 6 m east of the house.
  const vegRaw: Pt = [h[0] + dxNorm(6), h[1]];
  const veg = nudgeInside(vegRaw, h, boundary);
  out.push({
    id: newId(),
    kind: 'veg_bed',
    points: [veg],
    note: 'Veg bed close to the kitchen',
    status: 'pending',
  });

  return out;
}
