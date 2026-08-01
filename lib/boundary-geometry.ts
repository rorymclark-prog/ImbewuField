// Render-only geometry for cutting a measured break in the drawn boundary/fence line where a
// placed Gate item crosses it (docs/RENDER-GEOMETRY-CLEANUP-TODO.md: "Let a placed driveway gate
// create a measured break in the rendered fence/boundary line. The gate must be close to that line
// and the break must use the gate's actual width and orientation."). This module only decides WHAT
// to draw — it never touches saved boundary or gate geometry. Mirrors the "pure geometry, canvas
// draws it" split already used by lib/sector.ts and lib/water-cartography.ts.

export type NormPoint = [number, number];

export interface GateLike {
  x: number;
  y: number;
  /** Real-world width in metres, if the farmer sized it. Falls back to a plausible walk-through gate. */
  wM?: number;
}

export interface FrameLike {
  imgW: number;
  imgH: number;
  mPerPx: number;
}

export interface BoundaryBreak {
  /** Cumulative arc-length along the boundary (metres), measured from boundary[0], where the break
   *  starts/ends. May run past the boundary's total length — callers normalize the wrap. */
  startArc: number;
  endArc: number;
}

function toMetersPoints(boundary: NormPoint[], frame: FrameLike): Array<[number, number]> {
  return boundary.map(([x, y]) => [x * frame.imgW * frame.mPerPx, y * frame.imgH * frame.mPerPx]);
}

function segmentLengths(pointsM: Array<[number, number]>): number[] {
  return pointsM.map((a, i) => {
    const b = pointsM[(i + 1) % pointsM.length];
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  });
}

/** Projects a point onto a closed polyline (metres) and returns the nearest arc-length position and
 *  perpendicular distance. Arc length runs from boundaryM[0] around the ring, including the closing
 *  edge back to boundaryM[0]. */
function nearestArcPosition(
  boundaryM: Array<[number, number]>,
  pointM: [number, number],
): { arc: number; distanceM: number; totalLength: number } {
  const segLens = segmentLengths(boundaryM);
  const totalLength = segLens.reduce((s, l) => s + l, 0);
  let bestArc = 0;
  let bestDist = Infinity;
  let cursor = 0;
  for (let i = 0; i < boundaryM.length; i++) {
    const a = boundaryM[i];
    const b = boundaryM[(i + 1) % boundaryM.length];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const segLenSq = abx * abx + aby * aby;
    const t = segLenSq > 1e-9
      ? Math.max(0, Math.min(1, ((pointM[0] - a[0]) * abx + (pointM[1] - a[1]) * aby) / segLenSq))
      : 0;
    const px = a[0] + abx * t;
    const py = a[1] + aby * t;
    const dist = Math.hypot(pointM[0] - px, pointM[1] - py);
    if (dist < bestDist) {
      bestDist = dist;
      bestArc = cursor + segLens[i] * t;
    }
    cursor += segLens[i];
  }
  return { arc: bestArc, distanceM: bestDist, totalLength };
}

/**
 * The break interval a single gate cuts into the boundary line, or null when the gate is too far
 * from the boundary to plausibly BE that fence's gate — an internal gate placed well inside the
 * property must never punch a hole in the outer boundary line.
 */
export function gateBoundaryBreak(
  boundary: NormPoint[],
  gate: GateLike,
  frame: FrameLike,
  maxDistanceM = 3,
): BoundaryBreak | null {
  if (boundary.length < 3) return null;
  const boundaryM = toMetersPoints(boundary, frame);
  const gateM: [number, number] = [gate.x * frame.imgW * frame.mPerPx, gate.y * frame.imgH * frame.mPerPx];
  const { arc, distanceM, totalLength } = nearestArcPosition(boundaryM, gateM);
  if (!(totalLength > 0) || distanceM > maxDistanceM) return null;
  // A gate narrower than a walk-through gate is implausible; never let one gate eat more than 40%
  // of a very short fence run (a tiny boundary with an oversized gate reading should not vanish).
  const widthM = Math.max(0.9, gate.wM ?? 3);
  const halfWidth = Math.min(widthM / 2, totalLength * 0.2);
  return { startArc: arc - halfWidth, endArc: arc + halfWidth };
}

/** Every gate's break, nearest-boundary gates only, in encounter order (not merged — overlapping
 *  gates are a rare, deliberately unhandled edge case; see boundarySegmentsWithBreaks). */
export function gateBoundaryBreaks(
  boundary: NormPoint[],
  gates: GateLike[],
  frame: FrameLike,
  maxDistanceM = 3,
): BoundaryBreak[] {
  return gates
    .map((g) => gateBoundaryBreak(boundary, g, frame, maxDistanceM))
    .filter((b): b is BoundaryBreak => b !== null);
}

/** Normalizes a possibly wrap-around [start, end) break into 1-2 non-wrapping intervals within
 *  [0, totalLength). A break spanning the whole ring collapses to the whole ring (degenerate —
 *  caller ends up with nothing to draw, which is correct for an absurdly oversized gate). */
function normalizeBreak(b: BoundaryBreak, totalLength: number): Array<[number, number]> {
  const span = b.endArc - b.startArc;
  if (span >= totalLength) return [[0, totalLength]];
  const start = ((b.startArc % totalLength) + totalLength) % totalLength;
  const end = start + span;
  if (end <= totalLength) return [[start, end]];
  return [[start, totalLength], [0, end - totalLength]];
}

/** Standard interval subtraction: what's left of [0, totalLength) after removing every cut. */
function subtractIntervals(totalLength: number, cuts: Array<[number, number]>): Array<[number, number]> {
  const sorted = cuts.slice().sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of sorted) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const keep: Array<[number, number]> = [];
  let cursor = 0;
  for (const [s, e] of merged) {
    if (s > cursor) keep.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < totalLength) keep.push([cursor, totalLength]);
  return keep;
}

/**
 * Splits a closed boundary polygon into open sub-polylines with the given breaks removed, ready to
 * be stroked as separate paths instead of one closed loop. Original vertices strictly inside a kept
 * interval are preserved (so corners stay sharp); the cut ends are interpolated exactly at the
 * gate's real width, not snapped to the nearest existing vertex.
 *
 * Known, accepted limitation: a kept run that happens to straddle the arbitrary boundary[0] arc-zero
 * point (i.e. no break actually falls there) is emitted as two adjacent sub-polylines rather than
 * one continuous one — cosmetically a hard stop-and-restart at the same point, not a visible gap,
 * so left unmerged rather than adding wrap-stitching complexity for a purely cosmetic difference.
 */
export function boundarySegmentsWithBreaks(
  boundary: NormPoint[],
  frame: FrameLike,
  breaks: BoundaryBreak[],
): NormPoint[][] {
  if (boundary.length < 3) return [];
  if (breaks.length === 0) return [[...boundary, boundary[0]]];

  const boundaryM = toMetersPoints(boundary, frame);
  const segLens = segmentLengths(boundaryM);
  const totalLength = segLens.reduce((s, l) => s + l, 0);
  if (!(totalLength > 0)) return [[...boundary, boundary[0]]];

  const pointAtArc = (arcRaw: number): NormPoint => {
    let arc = ((arcRaw % totalLength) + totalLength) % totalLength;
    let i = 0;
    while (i < segLens.length - 1 && arc > segLens[i]) {
      arc -= segLens[i];
      i++;
    }
    const t = segLens[i] > 0 ? arc / segLens[i] : 0;
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  };

  const cuts = breaks.flatMap((b) => normalizeBreak(b, totalLength));
  const keepIntervals = subtractIntervals(totalLength, cuts);

  return keepIntervals
    .filter(([s, e]) => e - s > 0.02) // sub-2cm slivers aren't worth a separate stroke
    .map(([s, e]) => {
      const pts: NormPoint[] = [pointAtArc(s)];
      let acc = 0;
      for (let i = 0; i < boundary.length; i++) {
        if (acc > s && acc < e) pts.push(boundary[i]);
        acc += segLens[i];
      }
      pts.push(pointAtArc(e));
      return pts;
    });
}

/**
 * Area centroid of a closed ring (shoelace), in the ring's own coordinate space.
 *
 * NOT the average of the vertices, which is what several render paths reached for and is only the
 * same thing when the corners happen to be evenly spaced. A farmer's traced boundary never is:
 * they walk the road edge tapping every few metres and then cut straight across the back in four
 * points, so the vertex mean sits bodily over the road. Anything centred on "the middle of the
 * site" — the sector sheet's sun-path ring, a sheet-wide label anchor — must use this instead.
 *
 * Falls back to the vertex mean for a degenerate ring (fewer than 3 points, or zero signed area,
 * e.g. every point collinear or duplicated), because that is the only defined answer left and it
 * is better than NaN reaching a canvas.
 */
export function polygonAreaCentroid(points: NormPoint[]): NormPoint {
  if (!points.length) return [0.5, 0.5];
  const mean = (): NormPoint => [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length,
  ];
  if (points.length < 3) return mean();
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    twiceArea += cross;
    cx += (points[j][0] + points[i][0]) * cross;
    cy += (points[j][1] + points[i][1]) * cross;
  }
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) < 1e-12) return mean();
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}
