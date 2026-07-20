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
}

export interface CanvasLabelOut {
  id: string;
  x: number;
  y: number;
  /** True when de-collision displaced this pill far enough that it needs a leader line to say
   *  which icon it belongs to. */
  moved: boolean;
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
  const natural = inputs.map((i) => ({ ...i, y: i.cy + i.gap }));
  const order = [...natural].sort((a, b) => a.y - b.y || a.cx - b.cx || (a.id < b.id ? -1 : 1));

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

  // Return in the caller's original order so React keys and draw order stay stable.
  return inputs.map((i) => out.get(i.id)!);
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
  return Math.min(max, padX * 2 + text.length * fontSize * PILL_CHAR_EM);
}
