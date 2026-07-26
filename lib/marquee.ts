// Design Studio — pure geometry for drag-rectangle multi-select ("marquee") and group move.
//
// Everything here operates on the same normalised [0..1] coordinate space every shape in
// lib/design-canvas.ts already uses (item x/y, zone/line point arrays) — no SVG/DOM/pointer
// concerns. The canvas component (components/design/DesignCanvas.tsx) is the thin caller: it
// converts pointer events to these coordinates, applies the ownedByCurrentStep (lib/glossy-
// filters.ts) filter to decide WHICH shapes are even candidates, and calls these helpers to
// decide hit-testing and clamping. Keeping that ownership decision out of this file means there
// is exactly one place (ownedByCurrentStep) that can ever answer "is this shape selectable right
// now" — this file only ever answers "is this shape inside that rectangle" / "how far can this
// group move".

export interface Rect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Builds a normalised rect from two arbitrary drag corners — the marquee's pointer-down point
 *  and its current pointer position, in either order (a drag can go in any of the 4 directions). */
export function rectFromCorners(a: readonly [number, number], b: readonly [number, number]): Rect {
  return {
    minX: Math.min(a[0], b[0]),
    minY: Math.min(a[1], b[1]),
    maxX: Math.max(a[0], b[0]),
    maxY: Math.max(a[1], b[1]),
  };
}

/** Inclusive point-in-rect test — a point exactly on the rect's edge counts as inside, so a
 *  marquee drawn flush against a shape's edge still catches it. */
export function pointInRect(pt: readonly [number, number], rect: Rect): boolean {
  return pt[0] >= rect.minX && pt[0] <= rect.maxX && pt[1] >= rect.minY && pt[1] <= rect.maxY;
}

/** PlacedItem hit-test: the item's CENTRE (x, y IS the centre — see PlacedItem in
 *  lib/design-canvas.ts) must lie inside the marquee rect. A large item whose centre is outside
 *  the drag but whose edge pokes in is deliberately NOT selected — centre-in-rect is the same
 *  "did you actually lasso this thing" rule most drawing tools use for point-like objects. */
export function itemCenterInRect(x: number, y: number, rect: Rect): boolean {
  return pointInRect([x, y], rect);
}

/** ZoneShape/LineShape hit-test: ANY vertex inside the marquee rect is enough — unlike a
 *  placed item, a zone/line is an extended shape and a farmer dragging a marquee across even
 *  one corner of it clearly means to catch it. (This can select a shape whose centroid is
 *  outside the rect, which is intentional — the alternative, requiring the whole ring inside,
 *  would make it hard to lasso anything bigger than the marquee itself.) */
export function anyVertexInRect(points: ReadonlyArray<readonly [number, number]>, rect: Rect): boolean {
  return points.some((p) => pointInRect(p, rect));
}

/** Clamps a proposed group-translate delta so that EVERY point in `points` (item centres, zone/
 *  line vertices — whatever the group move is about to touch) stays inside [0,1] after the SAME
 *  delta is applied to all of them. This is a single, uniform clamp of the delta itself — never a
 *  per-point clamp — because a group move must stay rigid: two items 0.02 apart must still be
 *  0.02 apart after release, which a per-point clamp (each point independently pulled back inside
 *  [0,1]) would silently break the instant only one of them neared an edge. The rule: for each
 *  point's x, dx is constrained to [-x, 1-x] (so x+dx stays in [0,1]); intersecting that
 *  constraint across every point gives the tightest dx the WHOLE group can take without any
 *  member leaving the frame. Same for dy. Empty `points` is a no-op (nothing to clamp against). */
export function clampGroupDelta(
  points: ReadonlyArray<readonly [number, number]>,
  dx: number,
  dy: number,
): [number, number] {
  if (points.length === 0) return [0, 0];
  let dxMin = -Infinity;
  let dxMax = Infinity;
  let dyMin = -Infinity;
  let dyMax = Infinity;
  for (const [x, y] of points) {
    dxMin = Math.max(dxMin, -x);
    dxMax = Math.min(dxMax, 1 - x);
    dyMin = Math.max(dyMin, -y);
    dyMax = Math.min(dyMax, 1 - y);
  }
  // Every point's own range always contains 0 (x in [0,1] ⇒ -x <= 0 <= 1-x), so the intersected
  // range is guaranteed non-empty and dxMin <= dxMax always — no NaN/inverted-range case to guard.
  // `+ 0` normalises a clamped-to-zero result away from -0 (Math.max(-0.3, -0) === -0), which is
  // numerically harmless but a surprising thing for a caller/test to see out of a "delta" value.
  const clampedDx = Math.min(Math.max(dx, dxMin), dxMax) + 0;
  const clampedDy = Math.min(Math.max(dy, dyMin), dyMax) + 0;
  return [clampedDx, clampedDy];
}
