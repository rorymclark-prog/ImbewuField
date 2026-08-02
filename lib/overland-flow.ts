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
