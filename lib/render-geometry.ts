// Paint-time geometry polish for exported plan sheets.
//
// This module never edits DesignCanvasState. It receives an already-projected
// pixel copy and returns a second copy used only to trace a canvas path. Sharp
// corners stay exact; only shallow, near-collinear hand jitter can move, and
// even then by a tightly capped number of output pixels.

export type RenderPoint = [number, number];

export interface RenderGeometryPolishOptions {
  closed?: boolean;
  /** Largest direction change treated as hand jitter rather than a meaningful corner. */
  maxTurnDeg?: number;
  /** Hard cap on how far a paint-time point may move in the exported image. */
  maxShiftPx?: number;
}

function samePoint(a: RenderPoint, b: RenderPoint): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function polishedPoint(
  prev: RenderPoint,
  current: RenderPoint,
  next: RenderPoint,
  maxTurnRad: number,
  maxShiftPx: number,
): RenderPoint {
  const inX = current[0] - prev[0];
  const inY = current[1] - prev[1];
  const outX = next[0] - current[0];
  const outY = next[1] - current[1];
  const inLen = Math.hypot(inX, inY);
  const outLen = Math.hypot(outX, outY);
  if (inLen < 0.001 || outLen < 0.001) return [...current];

  const cosine = Math.max(-1, Math.min(1, (inX * outX + inY * outY) / (inLen * outLen)));
  if (Math.acos(cosine) > maxTurnRad) return [...current];

  // Project the jitter vertex onto the chord between its neighbours. If that
  // projection falls beyond either neighbour, moving it would shorten or
  // invert a real feature rather than merely straighten a shaky run.
  const chordX = next[0] - prev[0];
  const chordY = next[1] - prev[1];
  const chordLen2 = chordX * chordX + chordY * chordY;
  if (chordLen2 < 0.001) return [...current];
  const t = ((current[0] - prev[0]) * chordX + (current[1] - prev[1]) * chordY) / chordLen2;
  if (t <= 0 || t >= 1) return [...current];

  const targetX = prev[0] + chordX * t;
  const targetY = prev[1] + chordY * t;
  const shiftX = targetX - current[0];
  const shiftY = targetY - current[1];
  const shift = Math.hypot(shiftX, shiftY);
  if (shift < 0.001) return [...current];
  const scale = Math.min(1, maxShiftPx / shift);
  return [current[0] + shiftX * scale, current[1] + shiftY * scale];
}

export function polishedRenderPoints(
  input: readonly RenderPoint[],
  options: RenderGeometryPolishOptions = {},
): RenderPoint[] {
  if (input.length < 3) return input.map((point) => [...point]);

  const closed = options.closed === true;
  const maxTurnRad = ((options.maxTurnDeg ?? 28) * Math.PI) / 180;
  const maxShiftPx = Math.max(0, options.maxShiftPx ?? 3.5);
  const repeatsFirst = closed && input.length > 1 && samePoint(input[0], input[input.length - 1]);
  const source = (repeatsFirst ? input.slice(0, -1) : input).map((point) => [...point] as RenderPoint);
  if (source.length < 3) return input.map((point) => [...point]);

  const out = source.map((current, index) => {
    if (!closed && (index === 0 || index === source.length - 1)) return [...current] as RenderPoint;
    const prev = source[(index - 1 + source.length) % source.length];
    const next = source[(index + 1) % source.length];
    return polishedPoint(prev, current, next, maxTurnRad, maxShiftPx);
  });

  if (repeatsFirst) out.push([...out[0]]);
  return out;
}
