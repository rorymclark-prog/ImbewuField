/**
 * Where rain runs once it is on the ground.
 *
 * Rory, on the Water sheet: "show arrows of where the rain drains on the roof and ground?"
 *
 * ONLY THE GROUND HALF OF THAT IS ANSWERED HERE, and the omission is deliberate. Overland flow is
 * computable from data the app already holds: `elevation.aspectDeg` is the downhill bearing derived
 * from a real elevation sample, and it arrives with `directionConfidence`, which is set to
 * 'unconfirmed' when the site has less than a metre of relief and the direction is therefore noise.
 *
 * A ROOF'S FALL IS NOT COMPUTABLE and is not drawn. A traced roof polygon says where a building is;
 * it says nothing about its ridge line, its pitch, or which side the gutter is on — a rectangle can
 * be hipped, mono-pitch, or fall the other way. Drawing a confident arrow off a roof would be
 * inventing a fact about someone's house, on a sheet whose footer promises the geometry comes from
 * their saved design, and a farmer who trusts it puts the tank on the wrong wall. The roof's real
 * contribution is already stated honestly in the water-budget block: catchment area, rainfall,
 * coefficient, litres. What is missing is a measurement, not an arrow.
 *
 * Everything here is normalised 0..1 canvas space and pure, so the arrow field can be tested
 * without a canvas.
 */

export interface FlowArrow {
  /** Tail, in normalised canvas coordinates. */
  from: [number, number];
  /** Head, in normalised canvas coordinates. */
  to: [number, number];
  /** True when the arrow was cut short by a water-harvesting feature: it ends AT the feature and
   *  the renderer draws a spread bar there instead of an arrowhead — water arriving and being
   *  taken in, not passing through. */
  spread?: boolean;
}

/** What can intercept overland flow, all in the arrows' own normalised space.
 *  Every entry is something whose JOB is stopping runoff — swales, berms, beds, staple plots. */
export interface FlowInterceptors {
  /** Polylines: swale and contour-berm centre lines. */
  polylines: Array<Array<[number, number]>>;
  /** Rotated rectangles: bed footprints. rotDeg matches the item's saved rotation. */
  rects: Array<{ cx: number; cy: number; w: number; h: number; rotDeg: number }>;
  /** Rings: traced plots (staple gardens). */
  rings: Array<Array<[number, number]>>;
}

function segIntersectT(
  a: [number, number], b: [number, number],
  c: [number, number], d: [number, number],
): number | null {
  const rX = b[0] - a[0]; const rY = b[1] - a[1];
  const sX = d[0] - c[0]; const sY = d[1] - c[1];
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-12) return null;
  const t = ((c[0] - a[0]) * sY - (c[1] - a[1]) * sX) / denom;
  const u = ((c[0] - a[0]) * rY - (c[1] - a[1]) * rX) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

function toRectLocal(p: [number, number], r: FlowInterceptors['rects'][number]): [number, number] {
  const rad = (-r.rotDeg * Math.PI) / 180;
  const dx = p[0] - r.cx; const dy = p[1] - r.cy;
  return [dx * Math.cos(rad) - dy * Math.sin(rad), dx * Math.sin(rad) + dy * Math.cos(rad)];
}

function insideRect(p: [number, number], r: FlowInterceptors['rects'][number]): boolean {
  const [x, y] = toRectLocal(p, r);
  return Math.abs(x) <= r.w / 2 && Math.abs(y) <= r.h / 2;
}

function rectCorners(r: FlowInterceptors['rects'][number]): Array<[number, number]> {
  const rad = (r.rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad); const sin = Math.sin(rad);
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => [
    r.cx + (sx * r.w / 2) * cos - (sy * r.h / 2) * sin,
    r.cy + (sx * r.w / 2) * sin + (sy * r.h / 2) * cos,
  ] as [number, number]);
}

/**
 * Cut every arrow at the first water-harvesting feature its path meets.
 *
 * Rory, on sheet 04: "drainage water arrows must show spreading by veg beds and swales, not
 * going through them." An arrow running straight through a swale is the map claiming the swale
 * does nothing — the exact opposite of why the farmer dug it. The rules, all pure geometry:
 *
 *  - an arrow whose TAIL starts inside an interceptor is dropped: the water there is already
 *    captured, and an arrow leaving a bed claims runoff the bed exists to prevent;
 *  - an arrow whose path crosses one is truncated to the FIRST crossing and marked `spread` —
 *    the renderer ends it in a bar along the feature instead of an arrowhead;
 *  - an arrow that touches nothing passes through unchanged.
 *
 * A truncated stub shorter than a third of the original is dropped rather than drawn: a 2px
 * arrow against a bed edge reads as dirt on the print.
 */
export function interceptFlowArrows(arrows: FlowArrow[], features: FlowInterceptors): FlowArrow[] {
  const out: FlowArrow[] = [];
  for (const arrow of arrows) {
    const { from, to } = arrow;
    const startsCaptured =
      features.rects.some((r) => insideRect(from, r))
      || features.rings.some((ring) => pointInRing(from, ring));
    if (startsCaptured) continue;

    let firstT: number | null = null;
    const consider = (t: number | null) => {
      if (t !== null && t > 1e-9 && (firstT === null || t < firstT)) firstT = t;
    };
    for (const line of features.polylines) {
      for (let i = 0; i + 1 < line.length; i++) consider(segIntersectT(from, to, line[i], line[i + 1]));
    }
    for (const r of features.rects) {
      const c = rectCorners(r);
      for (let i = 0; i < 4; i++) consider(segIntersectT(from, to, c[i], c[(i + 1) % 4]));
    }
    for (const ring of features.rings) {
      for (let i = 0; i < ring.length; i++) consider(segIntersectT(from, to, ring[i], ring[(i + 1) % ring.length]));
    }

    if (firstT === null) { out.push(arrow); continue; }
    if (firstT < 1 / 3) continue; // stub too short to read
    out.push({
      from,
      to: [from[0] + (to[0] - from[0]) * firstT, from[1] + (to[1] - from[1]) * firstT],
      spread: true,
    });
  }
  return out;
}

export interface OverlandFlowInput {
  /** Boundary ring in normalised canvas coordinates. Arrows are placed only inside it. */
  boundary: Array<[number, number]>;
  /** Downhill bearing in degrees clockwise from north, as produced by lib/elevation.ts. */
  aspectDeg: number;
  /** Site slope in degrees. */
  slopeDeg: number;
  /** From lib/elevation.ts. 'unconfirmed' means the relief is too small to call a direction. */
  directionConfidence?: 'site-local-indicative' | 'unconfirmed';
  /** Arrow spacing as a fraction of the canvas width. */
  spacing?: number;
}

/**
 * Below this there is no useful downhill to draw. A quarter of a degree is roughly a 4 mm fall per
 * metre — flatter than the fall a builder puts on a patio — and on ground that flat the direction
 * an elevation sample produces is a rounding artefact, not a slope.
 */
export const MIN_DRAWABLE_SLOPE_DEG = 0.25;

/** Even-odd point-in-polygon. Shared shape with the renderer's own test helper. */
export function pointInRing(point: [number, number], ring: Array<[number, number]>): boolean {
  if (ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > point[1] !== yj > point[1];
    if (straddles && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A sparse, regular field of downslope arrows inside the boundary.
 *
 * Regular rather than one-per-feature because overland flow is a property of the whole surface, not
 * of anything the farmer placed; and sparse because this is context on a sheet whose subject is the
 * plumbing. Rory, on what may sit over the photograph: "remember this mustn't overlay base map etc
 * etc" — so the field is deliberately thin enough to read the ground between the arrows.
 *
 * Returns an empty array whenever the direction is not trustworthy, which is the whole point: no
 * arrows is the correct output for a flat site, and is far better than arrows pointing at noise.
 */
export function overlandFlowArrows(input: OverlandFlowInput): FlowArrow[] {
  const { boundary, aspectDeg, slopeDeg, directionConfidence } = input;
  if (directionConfidence === 'unconfirmed') return [];
  if (!Number.isFinite(aspectDeg) || !Number.isFinite(slopeDeg)) return [];
  if (!(slopeDeg >= MIN_DRAWABLE_SLOPE_DEG)) return [];
  if (boundary.length < 3) return [];

  const spacing = Number.isFinite(input.spacing ?? NaN) && (input.spacing ?? 0) > 0
    ? (input.spacing as number)
    : 0.16;

  // Screen space, not compass space. A bearing is degrees clockwise from north; canvas y grows
  // DOWNWARD, so north is -y. Getting this wrong points every arrow uphill, which is worse than
  // drawing nothing because it looks authoritative.
  const rad = (aspectDeg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = spacing * 0.3;

  const xs = boundary.map((p) => p[0]);
  const ys = boundary.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);

  const arrows: FlowArrow[] = [];
  for (let y = y0 + spacing / 2; y < y1; y += spacing) {
    for (let x = x0 + spacing / 2; x < x1; x += spacing) {
      // Both ends inside the plot, so no arrow leaks over a neighbour's land — this sheet is about
      // one property and an arrow crossing the fence is a claim about someone else's ground.
      const from: [number, number] = [x - dx * half, y - dy * half];
      const to: [number, number] = [x + dx * half, y + dy * half];
      if (!pointInRing(from, boundary) || !pointInRing(to, boundary)) continue;
      arrows.push({ from, to });
    }
  }
  return arrows;
}

/**
 * The legend row's text. Says where the number came from, because "downhill" with no provenance is
 * the kind of claim that gets built on.
 */
export function overlandFlowLegendText(slopeDeg: number, aspectLabel: string): string {
  const slope = Number.isFinite(slopeDeg) ? slopeDeg.toFixed(1) : '—';
  return `Overland flow — downhill to the ${aspectLabel} (${slope}° site slope)`;
}
