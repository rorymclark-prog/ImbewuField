// Design Studio — de-collision for the labels burned onto the INTERACTIVE canvas.
//
// The exported plan sheets have had a real label-layout engine for a long time
// (lib/producer-labels.ts: margin columns, one leader per block, guaranteed no crossings). The
// interactive canvas had nothing: every pill was drawn at a fixed offset from its own item, in
// item order, and overlaps were resolved by SVG paint order alone.
//
// Measured on a 7-plant guild at real spacing, that put FOUR of seven pills closer to a
// neighbour's icon than to their own — so the farmer read "Moringa Tree" beside a pawpaw and
// reasonably concluded the app was placing the wrong plant. Fixing the anchor alone (hugging the
// icon instead of the footprint, centring instead of left-aligning) only took that from 4 to 3:
// at orchard density no fixed offset can work, because the pills are simply bigger than the gaps
// between the plants. Something has to MOVE them apart and then say where each one belongs.
//
// This is deliberately simpler than producer-labels: the canvas is zoomable and interactive, so
// the pill must stay near its icon (you pan to read detail) rather than fly out to a margin column.
// Vertical-only displacement keeps every leader a short vertical line, which is the most readable
// possible pill→icon association and can never cross another leader on the same x.

export interface CanvasLabelInput {
  id: string;
  /** Icon centre, in the same units as everything else the caller draws (SVG viewBox units). */
  cx: number;
  cy: number;
  /** Natural gap below the icon centre where this pill wants to sit. */
  gap: number;
  /** Painted pill size, same units. */
  w: number;
  h: number;
  /** Radius of this item's icon disc. Every item's disc is an OBSTACLE for every other item's
   *  pill: without this, pushing a pill down to clear a collision can park it squarely on top of
   *  the plant below, hiding that plant's icon behind a label belonging to something else — a
   *  worse misread than the overlap it was solving. */
  iconR: number;
  /** This entry contributes its icon disc as an obstacle but draws NO pill — its label rides on a
   *  neighbour's grouped pill (see groupSameLabelPills). It must still be passed in, not filtered
   *  out by the caller: dropping it from the input would drop its disc from the obstacle set, and
   *  a surviving pill could then be pushed squarely onto the unlabeled item's icon. */
  suppressPill?: boolean;
}

export interface CanvasLabelOut {
  id: string;
  x: number;
  y: number;
  /** True when de-collision displaced this pill far enough that it needs a leader line to say
   *  which icon it belongs to. */
  moved: boolean;
}

/** A malformed saved item must never become `translate(NaN, …)` in the SVG canvas. */
export function isUsableCanvasLabelInput(input: CanvasLabelInput): boolean {
  return input.id.trim().length > 0
    && [input.cx, input.cy, input.gap, input.w, input.h, input.iconR].every(Number.isFinite)
    && input.w >= 0
    && input.h >= 0
    && input.iconR >= 0;
}

/** Vertical clearance kept between two pills that would otherwise touch. */
const GAP_Y = 2;
/** Displacement past which a pill gets a leader line drawn back to its icon. */
const LEADER_AFTER = 3;

/**
 * Push overlapping label pills apart, downward, and report which ones moved.
 *
 * Sweep order is by natural y (then x, so the result cannot depend on the order the farmer
 * happened to place things in — two identical designs must draw identically). Each pill is placed
 * at its natural spot and then pushed down past anything already placed that it would touch.
 * y only ever increases within the sweep, so this always terminates.
 */
export function layoutCanvasLabels(inputs: CanvasLabelInput[]): CanvasLabelOut[] {
  const usable = inputs.filter(isUsableCanvasLabelInput);
  const natural = usable.map((i) => ({ ...i, y: i.cy + i.gap }));
  // Suppressed entries never place a pill (and never appear in the output), but they stay in
  // `natural` above so their icon discs still seed the obstacle set below.
  const order = [...natural]
    .filter((i) => !i.suppressPill)
    .sort((a, b) => a.y - b.y || a.cx - b.cx || (a.id < b.id ? -1 : 1));

  // Seed the occupied set with every icon disc, so pills route AROUND plants rather than over
  // them. A pill's own disc is skipped — a pill must be free to sit at its natural gap, which by
  // construction clears its own icon.
  const discs = natural.map((i) => ({
    id: i.id,
    x0: i.cx - i.iconR,
    x1: i.cx + i.iconR,
    y0: i.cy - i.iconR,
    y1: i.cy + i.iconR,
  }));
  const placed: Array<{ id?: string; x0: number; x1: number; y0: number; y1: number }> = [];
  const out = new Map<string, CanvasLabelOut>();

  for (const p of order) {
    const half = p.w / 2;
    const x0 = p.cx - half;
    const x1 = p.cx + half;
    let y = p.y;
    // Re-check from scratch after every push: moving down can bring the pill into contact with a
    // box it had already cleared.
    const obstacles = [...placed, ...discs.filter((d) => d.id !== p.id)];
    let guard = 0;
    for (;;) {
      const hit = obstacles.find(
        (b) => x0 < b.x1 && b.x0 < x1 && y - p.h / 2 < b.y1 && b.y0 < y + p.h / 2,
      );
      if (!hit || guard++ > obstacles.length + 2) break;
      y = hit.y1 + GAP_Y + p.h / 2;
    }
    placed.push({ x0, x1, y0: y - p.h / 2, y1: y + p.h / 2 });
    out.set(p.id, { id: p.id, x: p.cx, y, moved: Math.abs(y - p.y) > LEADER_AFTER });
  }

  // Return in the caller's original order so React keys and draw order stay stable. One row per
  // PILL, so a caller zips the result against its own suppressPill-filtered list.
  return usable.filter((i) => !i.suppressPill).map((i) => out.get(i.id)!);
}

export interface PillGroupInput {
  id: string;
  text: string;
  /** Anchor centre, same units as the layout engine. */
  cx: number;
  cy: number;
}

/**
 * Collapse identical label texts into ONE pill each: seven "Vegetable Bed" pills become a single
 * "Vegetable Bed ×7". (Rory, reading the Ubhejane map: "we need a way to tidy up these labels -
 * one example i think is if we have multip raised veg beds is to give one lable for them all".)
 *
 * Measured on that map, 45 pills fell to ~20 — most of the long-leader label columns were the
 * SAME name repeated: Vegetable Bed ×7, Tap Point ×6, Mango/Pawpaw/Citrus ×4 each. The icons
 * still mark every individual item; the one pill teaches what the icon means and carries the
 * count, which is exactly how the exported sheets already caption repeated elements ("give the
 * whole group ONE label" — buildSatelliteOverlayPrompt rule 10).
 *
 * The returned map holds the pill each id should draw; an id absent from the map draws NO pill
 * (pass it to layoutCanvasLabels with suppressPill so its icon disc stays an obstacle). The
 * representative is the member nearest the group's spatial centre — the most honest single anchor
 * for a leader line, and deterministic: distance ties keep the earliest member in caller order,
 * so two identical designs pick the same pill. Grouping is by EXACT text: a custom-named item
 * ("Mielie bed") or one with a note never merges into the generic group. Empty texts pass
 * through one-to-one — an empty pill is the caller's existing behaviour, not this function's
 * business to change.
 */
export function groupSameLabelPills(pills: PillGroupInput[]): Map<string, { text: string; count: number }> {
  const out = new Map<string, { text: string; count: number }>();
  const byText = new Map<string, PillGroupInput[]>();
  for (const p of pills) {
    const key = p.text.trim();
    if (!key) {
      out.set(p.id, { text: p.text, count: 1 });
      continue;
    }
    const bucket = byText.get(key);
    if (bucket) bucket.push(p);
    else byText.set(key, [p]);
  }
  for (const [text, members] of byText) {
    if (members.length === 1) {
      out.set(members[0].id, { text: members[0].text, count: 1 });
      continue;
    }
    const cx = members.reduce((s, m) => s + m.cx, 0) / members.length;
    const cy = members.reduce((s, m) => s + m.cy, 0) / members.length;
    let rep = members[0];
    let best = Infinity;
    for (const m of members) {
      const d = (m.cx - cx) ** 2 + (m.cy - cy) ** 2;
      if (d < best) {
        best = d;
        rep = m;
      }
    }
    out.set(rep.id, { text: `${text} ×${members.length}`, count: members.length });
  }
  return out;
}

/**
 * Width of a rendered pill, estimated from its text.
 *
 * The canvas draws pills in an SVG foreignObject, so there is no measureText available at layout
 * time without forcing a reflow. This must ERR HIGH: over-estimating costs a little extra
 * separation, while under-estimating lets two pills that actually touch be treated as clear —
 * the exact failure this module exists to prevent.
 *
 * The factor is measured, not guessed. Across the catalog's plant names rendered at 9px in the
 * system UI font, the widest came out at 0.562em per character ("Banana Clump" 70.7px over 12
 * chars); an earlier 0.55 was therefore a genuine under-estimate and left one overlapping pair on
 * the seven-plant test guild. 0.62 clears the measured worst case with room for longer names and
 * a different system font on another platform.
 */
export const PILL_CHAR_EM = 0.62;

export function estimatePillWidth(text: string, fontSize: number, padX: number, max: number): number {
  const safeFontSize = Number.isFinite(fontSize) && fontSize >= 0 ? fontSize : 0;
  const safePadX = Number.isFinite(padX) && padX >= 0 ? padX : 0;
  const safeMax = Number.isFinite(max) && max >= 0 ? max : 0;
  return Math.min(safeMax, safePadX * 2 + text.length * safeFontSize * PILL_CHAR_EM);
}

// ── Zone number badges ─────────────────────────────────────────────────────────────────────────

export interface ZoneBadgeInput {
  id: string;
  /** Normalised ring the badge belongs to. */
  points: Array<[number, number]>;
  /** The farmer's own drag, if they have moved this badge. */
  labelDx?: number;
  labelDy?: number;
}

/** Below this, a labelDx/labelDy is rounding noise rather than a farmer's decision. Matches the
 *  threshold DesignCanvas uses to decide whether to draw a leader back to the ring. */
const BADGE_MOVED_EPS = 0.003;

/**
 * Where each zone's number badge sits, in normalised coordinates.
 *
 * Nesting is the whole reason these collide. Zones are drawn as rings inside rings — a Zone 1
 * around the house sits inside Zone 2, which sits inside Zone 3 — and a small ring's centroid can
 * land within a badge's width of its bigger neighbour's. Rory: "zone 1 icon is sitting over zone
 * 0". Two numbers overlapping is worse than a number slightly off-centre, because a farmer reading
 * a plan set has no way to tell which digit belongs to which band.
 *
 * A badge the farmer has DRAGGED is pinned and never moved by this: their placement is a decision,
 * and an auto-layout that overrides it is the same bug in the other direction. Everything else
 * relaxes apart from the pinned ones and from each other.
 *
 * `radius` is the badge's radius in normalised units (badge px / sheet width), so the same
 * function serves the canvas and every sheet size.
 */
export function zoneBadgePositions(
  zones: ZoneBadgeInput[],
  radius: number,
): Map<string, [number, number]> {
  const out = new Map<string, [number, number]>();
  if (!zones.length) return out;
  const pinned = new Set<string>();
  const pos: Array<{ id: string; x: number; y: number }> = [];
  for (const z of zones) {
    if (z.points.length < 3) continue;
    let sx = 0, sy = 0;
    for (const [x, y] of z.points) { sx += x; sy += y; }
    const dx = z.labelDx ?? 0;
    const dy = z.labelDy ?? 0;
    if (Math.abs(dx) > BADGE_MOVED_EPS || Math.abs(dy) > BADGE_MOVED_EPS) pinned.add(z.id);
    pos.push({ id: z.id, x: sx / z.points.length + dx, y: sy / z.points.length + dy });
  }
  // A handful of relaxation passes: enough to separate a realistic set of five or six zones,
  // bounded so a pathological design can never make this loop expensive.
  const minGap = radius * 2.15; // a hair of daylight between two touching discs
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const a = pos[i], b = pos[j];
        let vx = b.x - a.x;
        let vy = b.y - a.y;
        let d = Math.hypot(vx, vy);
        if (d >= minGap) continue;
        // Exactly coincident centroids have no direction to separate along — pick one, so two
        // identically-placed rings still end up as two readable badges.
        if (d < 1e-6) { vx = 0; vy = 1; d = 1e-6; }
        const push = (minGap - d) / 2;
        const ux = (vx / d) * push;
        const uy = (vy / d) * push;
        const aFixed = pinned.has(a.id);
        const bFixed = pinned.has(b.id);
        if (aFixed && bFixed) continue; // both are the farmer's; leave them exactly as placed
        if (!aFixed) { a.x -= bFixed ? ux * 2 : ux; a.y -= bFixed ? uy * 2 : uy; }
        if (!bFixed) { b.x += aFixed ? ux * 2 : ux; b.y += aFixed ? uy * 2 : uy; }
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const p of pos) {
    out.set(p.id, [
      Math.min(1 - radius, Math.max(radius, p.x)),
      Math.min(1 - radius, Math.max(radius, p.y)),
    ]);
  }
  return out;
}
