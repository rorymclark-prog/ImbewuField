/**
 * The water story: roof → gutter → tank → swale.
 *
 * Rory, on the Water sheet: "arrows of water running down roof, and gutter, running and
 * spreading in swale."
 *
 * `lib/overland-flow.ts` answers where rain goes once it is ON THE GROUND, and its header states
 * plainly that a roof's fall is not computable and so no roof arrow is drawn. That was correct
 * when it was written. It is no longer the whole truth, and the reason is worth stating because
 * it is the only thing that licenses this file:
 *
 *   `drawPaperRoofs` ALREADY COMMITS TO A RIDGE. It picks the polygon's longest edge, shades one
 *   side of it darker, and strokes the ridge line itself. A farmer looking at a paper sheet is
 *   already being shown a gable running that way. An arrow perpendicular to that ridge therefore
 *   adds no claim the drawing has not already made — it only reads out loud what the roof
 *   graphic says. That is the entire justification, and it has two hard consequences:
 *
 *   1. BOTH MUST USE THE SAME RULE. `ridgeAngleOf` below is exported and `drawPaperRoofs` calls
 *      it. If the roof graphic ever changes how it picks the ridge, the arrows move with it.
 *      Deriving the ridge twice is how a sheet ends up with water running across the fold.
 *   2. PAPER SHEETS ONLY. `drawPaperRoofs` runs only when there is no satellite photo. On a photo
 *      sheet the farmer sees their REAL roof, whose real ridge is whatever the photograph shows
 *      and generally is not the longest traced edge. Drawing our arrows over that would be
 *      contradicting a visible fact rather than restating a drawn one. The call site gates on the
 *      same `!frame.satDataUrl` condition drawPaperRoofs does.
 *
 * Legs 2 and 3 need no such licence: a tank within its own catalog `nearRoofM` of a house edge is
 * fed by that roof by definition of the placement rule, and an overflow run to a swale is a line
 * between two things the farmer actually placed.
 *
 * Everything here is PURE and works in METRES, so it can be unit-tested without a canvas. Metre
 * space is a uniform scale of the canvas pixel space (both derive from the single `pxPerM` the
 * renderer uses), which is why an angle computed here is the same angle drawPaperRoofs draws.
 *
 * WHERE THE DATA DOES NOT SUPPORT AN ARROW, THE OUTPUT IS NO ARROW. No invented downpipes, no
 * guessed gutter walls, no overflow to a swale that is not there. This codebase applies that rule
 * everywhere and it is not relaxed here.
 */

/** An arrow in normalised 0..1 canvas space — the same space `FlowArrow` uses, so the renderer
 *  paints both with one routine and the sheet has one visual language for moving water. */
export interface StoryArrow {
  from: [number, number];
  to: [number, number];
  /** True when the arrow ends AT a feature that takes the water in, and the renderer draws the
   *  spread bar instead of an arrowhead. Identical meaning to FlowArrow.spread — deliberately so;
   *  a second convention for "water arrives here" would be a contradiction on the same sheet. */
  spread?: boolean;
}

/** How the frame maps normalised canvas coordinates to metres on the ground. */
export interface MetreScale {
  /** Metres per 1.0 of normalised x — frame.imgW * frame.mPerPx. */
  mPerUnitX: number;
  /** Metres per 1.0 of normalised y — frame.imgH * frame.mPerPx. */
  mPerUnitY: number;
}

type Pt = [number, number];

/** How far an overflow pipe may credibly run from a tank to a swale. Beyond this the swale is a
 *  different part of the farm and the connection would be our invention, not the design's. */
export const OVERFLOW_REACH_M = 15;

/** Below this an arrow is a smudge rather than a direction; drawing it adds noise to a sheet
 *  whose whole job is legibility. */
const MIN_ARROW_M = 0.6;

/** A ridge shorter than this gets two runoff arrows per slope instead of three — on a small
 *  outbuilding three arrows collide into a block of ink. */
const THREE_ARROW_RIDGE_M = 6;

function finitePt(p: unknown): p is Pt {
  return Array.isArray(p) && p.length >= 2
    && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}

/** Rings arrive from saved designs and from legacy layers; both have produced short and NaN-laden
 *  rings in the wild. Every entry point filters through here. */
function cleanRing(ring: readonly Pt[] | undefined): Pt[] | null {
  if (!Array.isArray(ring)) return null;
  const pts = ring.filter(finitePt).map(([x, y]) => [x, y] as Pt);
  return pts.length >= 3 ? pts : null;
}

/**
 * The ridge rule, in one place.
 *
 * Ridge direction = the polygon's longest edge. For the rectangles farmers trace this is the long
 * wall, which is where a real ridge runs; for an L-shape it follows the longest wing, which is the
 * honest simple answer rather than a guessed hip layout.
 *
 * EXPORTED ON PURPOSE: `drawPaperRoofs` calls this too. The angle is invariant under uniform
 * scaling, so it may be passed points in pixels, metres or any other uniformly-scaled space and
 * will return the same ridge. Do not re-derive this anywhere; see this file's header for what
 * goes wrong.
 */
export function ridgeAngleOf(pts: readonly Pt[]): number {
  let angle = 0;
  let longest = -1;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len > longest) { longest = len; angle = Math.atan2(y1 - y0, x1 - x0); }
  }
  return angle;
}

/** First crossing of the ring by the ray from `origin` in unit direction `dir`, or null. Returns
 *  the distance, so callers can both place the point and reject stubs. */
function rayExitDistance(origin: Pt, dir: Pt, ring: readonly Pt[]): number | null {
  let best: number | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const sX = b[0] - a[0];
    const sY = b[1] - a[1];
    const denom = dir[0] * sY - dir[1] * sX;
    if (Math.abs(denom) < 1e-12) continue;
    const t = ((a[0] - origin[0]) * sY - (a[1] - origin[1]) * sX) / denom;
    const u = ((a[0] - origin[0]) * dir[1] - (a[1] - origin[1]) * dir[0]) / denom;
    if (t > 1e-9 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best;
}

/** Closest point on a segment, with the distance — the primitive both the gutter and the overflow
 *  legs need. */
function closestOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; dist: number } {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const len2 = vx * vx + vy * vy;
  const t = len2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len2));
  const point: Pt = [a[0] + vx * t, a[1] + vy * t];
  return { point, dist: Math.hypot(p[0] - point[0], p[1] - point[1]) };
}

function closestOnRing(p: Pt, ring: readonly Pt[], closed: boolean): { point: Pt; dist: number } | null {
  let best: { point: Pt; dist: number } | null = null;
  const last = closed ? ring.length : ring.length - 1;
  for (let i = 0; i < last; i++) {
    const hit = closestOnSegment(p, ring[i], ring[(i + 1) % ring.length]);
    if (!best || hit.dist < best.dist) best = hit;
  }
  return best;
}

/** Convert a normalised ring to metres. */
function toMetres(ring: readonly Pt[], s: MetreScale): Pt[] {
  return ring.map(([x, y]) => [x * s.mPerUnitX, y * s.mPerUnitY] as Pt);
}

function fromMetres(p: Pt, s: MetreScale): Pt {
  return [p[0] / s.mPerUnitX, p[1] / s.mPerUnitY];
}

function usableScale(s: MetreScale): boolean {
  return Number.isFinite(s.mPerUnitX) && Number.isFinite(s.mPerUnitY)
    && s.mPerUnitX > 1e-9 && s.mPerUnitY > 1e-9;
}

/* ── Leg 1: roof runoff ──────────────────────────────────────────────────────────────────────── */

export interface RoofRunoffInput {
  /** House rings in normalised canvas space. */
  rings: ReadonlyArray<readonly Pt[]>;
  scale: MetreScale;
}

/**
 * Two or three short arrows down EACH slope, ridge to eave.
 *
 * They stop at the eave and never cross it: water leaving the roof is the gutter's business, and
 * an arrow continuing onto the ground would be claiming a downpipe we have no data for.
 */
export function roofRunoffArrows({ rings, scale }: RoofRunoffInput): StoryArrow[] {
  if (!usableScale(scale)) return [];
  const out: StoryArrow[] = [];

  for (const raw of rings) {
    const ring = cleanRing(raw);
    if (!ring) continue;
    const m = toMetres(ring, scale);

    const angle = ridgeAngleOf(m);
    const u: Pt = [Math.cos(angle), Math.sin(angle)];
    const n: Pt = [-Math.sin(angle), Math.cos(angle)];
    const cx = m.reduce((sum, p) => sum + p[0], 0) / m.length;
    const cy = m.reduce((sum, p) => sum + p[1], 0) / m.length;

    // The ridge runs through the centroid along u; its extent is the footprint's projection onto u.
    const projections = m.map(([x, y]) => (x - cx) * u[0] + (y - cy) * u[1]);
    const lo = Math.min(...projections);
    const hi = Math.max(...projections);
    const span = hi - lo;
    if (!Number.isFinite(span) || span < MIN_ARROW_M) continue;

    const count = span >= THREE_ARROW_RIDGE_M ? 3 : 2;
    // Even spacing that never lands on the gable ends, where the slope is about to run out.
    const fractions = Array.from({ length: count }, (_, i) => (i + 1) / (count + 1));

    for (const f of fractions) {
      const along = lo + span * f;
      const origin: Pt = [cx + u[0] * along, cy + u[1] * along];
      for (const side of [1, -1] as const) {
        const dir: Pt = [n[0] * side, n[1] * side];
        const reach = rayExitDistance(origin, dir, m);
        if (reach === null || reach < MIN_ARROW_M) continue;
        // Stop just short of the eave so the arrowhead sits ON the roof, not astride its edge.
        const end = reach * 0.88;
        out.push({
          from: fromMetres(origin, scale),
          to: fromMetres([origin[0] + dir[0] * end, origin[1] + dir[1] * end], scale),
        });
      }
    }
  }
  return out;
}

/* ── Leg 2: gutter to tank ───────────────────────────────────────────────────────────────────── */

export interface StoryTank {
  /** Normalised canvas position. */
  x: number;
  y: number;
  /** The tank's own catalog `nearRoofM` — the placement rule already says a tank this close to a
   *  wall is roof-fed, so the arrow restates a rule the design was built under. */
  nearRoofM: number;
}

export interface GutterInput {
  rings: ReadonlyArray<readonly Pt[]>;
  tanks: readonly StoryTank[];
  scale: MetreScale;
}

/**
 * ONE arrow from the nearest eave point to each roof-fed tank.
 *
 * A tank outside its own nearRoofM of every house edge gets nothing. There is no "nearest anyway"
 * fallback: a tank standing alone in the field is not being fed by a roof, and an arrow saying it
 * is would send a farmer to plumb a run that does not exist.
 */
export function gutterToTankArrows({ rings, tanks, scale }: GutterInput): StoryArrow[] {
  if (!usableScale(scale)) return [];
  const walls = rings.map(cleanRing).filter((r): r is Pt[] => r !== null).map((r) => toMetres(r, scale));
  if (!walls.length) return [];

  const out: StoryArrow[] = [];
  for (const tank of tanks) {
    if (!Number.isFinite(tank.x) || !Number.isFinite(tank.y)) continue;
    if (!Number.isFinite(tank.nearRoofM) || tank.nearRoofM <= 0) continue;
    const p: Pt = [tank.x * scale.mPerUnitX, tank.y * scale.mPerUnitY];

    let best: { point: Pt; dist: number } | null = null;
    for (const wall of walls) {
      const hit = closestOnRing(p, wall, true);
      if (hit && (!best || hit.dist < best.dist)) best = hit;
    }
    if (!best || best.dist > tank.nearRoofM) continue;
    if (best.dist < MIN_ARROW_M) continue; // tank drawn against the wall: an arrow would be a dot

    out.push({ from: fromMetres(best.point, scale), to: fromMetres(p, scale) });
  }
  return out;
}

/* ── Leg 3: tank overflow to swale ───────────────────────────────────────────────────────────── */

export interface OverflowInput {
  tanks: readonly StoryTank[];
  /** Swale centre lines in normalised canvas space — open polylines, not rings. */
  swales: ReadonlyArray<readonly Pt[]>;
  scale: MetreScale;
  /** Downhill bearing in degrees, when the site has one worth trusting. When it is not finite the
   *  check is skipped rather than guessed — see below. */
  aspectDeg?: number;
}

/**
 * A tank's overflow, ending in the SAME spread bar `interceptFlowArrows` already draws.
 *
 * Two refusals, both deliberate:
 *  - No swale within OVERFLOW_REACH_M means NO ARROW. An overflow arrow to nowhere is a claim
 *    about drainage the design does not make.
 *  - When the site's downhill bearing is known, a swale that is UPHILL of the tank is not where
 *    the overflow goes, and the arrow is dropped. When the bearing is unknown or unconfirmed the
 *    test is skipped entirely — the alternative is inventing a slope, which is the mistake this
 *    module exists to avoid.
 */
export function tankOverflowArrows({ tanks, swales, scale, aspectDeg }: OverflowInput): StoryArrow[] {
  if (!usableScale(scale)) return [];
  const lines = swales
    .map((line) => (Array.isArray(line) ? line.filter(finitePt).map(([x, y]) => [x, y] as Pt) : []))
    .filter((line) => line.length >= 2)
    .map((line) => toMetres(line, scale));
  if (!lines.length) return [];

  // Canvas y grows downward; a bearing of 0 degrees is north, which is up the screen.
  const known = typeof aspectDeg === 'number' && Number.isFinite(aspectDeg);
  const rad = known ? (aspectDeg! * Math.PI) / 180 : 0;
  const downhill: Pt = [Math.sin(rad), -Math.cos(rad)];

  const out: StoryArrow[] = [];
  for (const tank of tanks) {
    if (!Number.isFinite(tank.x) || !Number.isFinite(tank.y)) continue;
    const p: Pt = [tank.x * scale.mPerUnitX, tank.y * scale.mPerUnitY];

    let best: { point: Pt; dist: number } | null = null;
    for (const line of lines) {
      const hit = closestOnRing(p, line, false);
      if (!hit) continue;
      if (hit.dist > OVERFLOW_REACH_M || hit.dist < MIN_ARROW_M) continue;
      if (known) {
        const towards: Pt = [hit.point[0] - p[0], hit.point[1] - p[1]];
        if (towards[0] * downhill[0] + towards[1] * downhill[1] <= 0) continue;
      }
      if (!best || hit.dist < best.dist) best = hit;
    }
    if (!best) continue;

    out.push({ from: fromMetres(p, scale), to: fromMetres(best.point, scale), spread: true });
  }
  return out;
}
