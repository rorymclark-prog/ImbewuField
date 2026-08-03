// A VETIVER HEDGE, DRAWN FROM ABOVE.
//
// WHY THIS EXISTS AT ALL: vetiver-bank-v1.png is a SIDE ELEVATION — you are stood beside the hedge
// looking at blades standing up out of the soil, with the soil visible along the bottom. The plan
// sheets are top-down. No footprint can make a side view correct on a map, which is why every
// attempt to fix this by resizing failed, and why the earlier reading ("the banks render too
// small") was treating a symptom. Rory, on the rendered planting sheet: "vetiver is terrible still
// it must litterally look a vetiver hedge!"
//
// Two errors compounded. drawImage stretches every asset to the footprint and ignores the asset's
// own aspect, so the 582x236 elevation was squashed into the 2x2 m Vetiver Bank as a square of
// smeared grass, and squeezed into the 0.3x5 m Vetiver Row as a vertical sliver of the same. Fixing
// the aspect alone would still have left a picture taken from the wrong direction.
//
// From above, a vetiver hedge is a run of fine tufts knitted into one continuous band — and that is
// drawable exactly, at the planting geometry the catalog already states, so it needs no artwork.
// Deterministic wins here for the reasons it won on the plan sheets generally: exact, free,
// identical on every render, and correct at every scale.
//
// NOTE FOR WHOEVER TOUCHES THIS NEXT: the Water sheet draws vetiver through its own symbol
// (`vetiverBank` in lib/cartographic-water-symbols.ts), so the two sheets still draw the same plant
// two ways. That is the repo's standing bug class — a fix that reaches one sheet — and it is worth
// unifying, but the water symbol belongs to that sheet's gradient-wash symbol language and changing
// it is a separate, visible decision.

/** Both catalog ids that are physically the same thing: a line of vetiver knitted into a hedge. */
export const VETIVER_HEDGE_IDS: ReadonlySet<string> = new Set(['vetiver_row', 'mulch_bank']);

/** Slips 10-15 cm apart — vetiver_row's own catalog tip. Not a number invented for the drawing. */
export const VETIVER_SLIP_SPACING_M = 0.125;
/** A mature clump is roughly 30 cm across, which is exactly why 12.5 cm slips close into a hedge. */
export const VETIVER_CLUMP_RADIUS_M = 0.15;
/** A bank deeper than one slip line holds parallel contour lines, not one impossibly fat hedge. */
export const VETIVER_LINE_SPACING_M = 0.6;

export interface VetiverHedgeGeometry {
  /** Slip lines across the bank's short axis: 1 for a row, several for a 2 m deep bank. */
  lines: number;
  /** Tufts drawn per line. */
  perLine: number;
  /** Drawn clump radius in canvas pixels. */
  clumpR: number;
  /** True when the hedge runs down the canvas rather than across it. */
  alongY: boolean;
  /** Every tuft crown, in the item's own centred local space. */
  crowns: Array<{ x: number; y: number; r: number; seed: string }>;
}

/** Deterministic 0..1 from a seed string — same crown positions on every render of a design. */
function stableUnit(seed: string, index: number): number {
  let hash = 2166136261;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

/**
 * Where every tuft sits, with no canvas involved — so the geometry is testable and the drawing
 * below stays a thin painting pass over it.
 *
 * Returns null when the footprint is too short to read as a hedge at all; the caller then falls
 * through to whatever it drew before rather than painting three tufts and calling it a bank.
 */
export function vetiverHedgeGeometry(
  wPx: number,
  hPx: number,
  wM: number,
  hM: number,
  pxPerM: number,
  minClumpPx: number,
  seedId: string,
): VetiverHedgeGeometry | null {
  if (![wPx, hPx, wM, hM, pxPerM, minClumpPx].every((n) => Number.isFinite(n) && n > 0)) return null;

  // The hedge runs along the footprint's LONG axis. The short axis is how deep the bank is, which
  // is how many parallel slip lines it holds: a Vetiver Row (0.3 x 5 m) is one line, a Vetiver Bank
  // (2 x 2 m) is a block of them. One drawing then serves both catalog ids honestly.
  const alongY = hPx >= wPx;
  const runPx = alongY ? hPx : wPx;
  const bandPx = alongY ? wPx : hPx;
  const bandM = alongY ? wM : hM;

  // A clump drawn below the floor is a smudge, not a plant. Under it the drawing stops being
  // one-mark-per-slip and becomes a map symbol at legible size — fewer, larger tufts still reading
  // as "vetiver hedge". That is a cartographic choice and not an agronomic one: nothing anywhere
  // counts tufts (callouts count placed ITEMS), so no stated number moves with it.
  const clumpR = Math.max(minClumpPx, VETIVER_CLUMP_RADIUS_M * pxPerM);
  if (runPx < clumpR * 3) return null;

  const lineFit = Math.max(1, Math.floor(bandPx / (clumpR * 1.7)));
  const lines = Math.max(1, Math.min(lineFit, 6, Math.round(bandM / VETIVER_LINE_SPACING_M) || 1));
  const stepPx = Math.max(clumpR * 0.62, VETIVER_SLIP_SPACING_M * pxPerM);
  const perLine = Math.max(3, Math.min(180, Math.round(runPx / stepPx)));

  const crowns: VetiverHedgeGeometry['crowns'] = [];
  const acrossGap = lines > 1 ? (bandPx - clumpR * 2) / (lines - 1) : 0;
  const alongGap = (runPx - clumpR * 1.6) / Math.max(1, perLine - 1);
  for (let line = 0; line < lines; line++) {
    const across = lines > 1 ? -(bandPx / 2) + clumpR + line * acrossGap : 0;
    for (let slip = 0; slip < perLine; slip++) {
      const along = -(runPx / 2) + clumpR * 0.8 + slip * alongGap;
      const seed = `${seedId}:${line}:${slip}`;
      const wob = stableUnit(seed, 0);
      crowns.push({
        x: (alongY ? across : along) + (wob - 0.5) * clumpR * 0.35,
        y: (alongY ? along : across) + (stableUnit(seed, 1) - 0.5) * clumpR * 0.35,
        r: clumpR * (0.8 + wob * 0.42),
        seed,
      });
    }
  }
  return { lines, perLine, clumpR, alongY, crowns };
}

/** Blades per crown. Enough to read as a clump-forming grass, few enough to stay fine at print. */
const BLADES_PER_CROWN = 9;

/**
 * Trace every blade of every tuft into ONE path, so a long bank costs two strokes rather than
 * several hundred — the same batching the crop rows use.
 */
function traceTufts(ctx: CanvasRenderingContext2D, geometry: VetiverHedgeGeometry): void {
  ctx.beginPath();
  for (const crown of geometry.crowns) {
    // A rosette: fine blades springing from one crown and arcing outward. This is what a
    // clump-forming grass looks like from directly overhead, and what separates vetiver from the
    // shrubs and tree canopies sharing the sheet.
    for (let b = 0; b < BLADES_PER_CROWN; b++) {
      const jitter = stableUnit(crown.seed, b + 2);
      const angle = (b / BLADES_PER_CROWN) * Math.PI * 2 + jitter * 0.42;
      // Blades deliberately overshoot their own crown and the plate edge. That bristling silhouette
      // is most of what identifies vetiver from above — a band with a clean edge reads as a painted
      // stripe, which is what the first attempt at this looked like on a rendered sheet.
      const len = crown.r * (0.95 + jitter * 0.75);
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      ctx.moveTo(crown.x, crown.y);
      // Bowed, not straight — a straight spoke reads as a starburst symbol, a bowed one reads as a
      // blade of grass.
      ctx.quadraticCurveTo(
        crown.x + dx * 0.45 - dy * 0.22,
        crown.y + dy * 0.45 + dx * 0.22,
        crown.x + dx,
        crown.y + dy,
      );
    }
  }
}

/**
 * Paint the hedge into the item's own centred, already-rotated local space.
 *
 * `tracePlate` traces the footprint so the caller keeps ownership of corner radius and shape.
 * Returns false when the footprint is too small to read, leaving the canvas untouched.
 */
export function drawVetiverHedge(
  ctx: CanvasRenderingContext2D,
  geometry: VetiverHedgeGeometry,
  tracePlate: () => void,
  casingWidth: number,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Cream casing, then a dense base, then the tufts — the body-inside-a-casing order every other
  // mark on these sheets uses to stay readable over an aerial photograph.
  tracePlate();
  ctx.strokeStyle = 'rgba(252,248,236,0.92)';
  ctx.lineWidth = casingWidth;
  ctx.stroke();
  tracePlate();
  ctx.fillStyle = 'rgba(48,80,41,0.88)';
  ctx.fill();

  // THE BLADES CARRY NO CREAM. The plate below already has the cream casing that lifts the hedge
  // off an aerial photograph; putting a second cream casing on every blade as well was what turned
  // the first version into a pale grey-green bar with a fuzzy edge — the texture disappeared into
  // its own halo. Here the blades get a dark under-pass for depth and a bright top pass, which is
  // the same shadow-then-body order the crop glyphs use, and the contrast is what makes a clump of
  // grass legible at 6 px.
  traceTufts(ctx, geometry);
  ctx.strokeStyle = 'rgba(20,36,18,0.55)';
  ctx.lineWidth = Math.max(1.1, geometry.clumpR * 0.24);
  ctx.stroke();
  traceTufts(ctx, geometry);
  ctx.strokeStyle = '#8FC25C';
  ctx.lineWidth = Math.max(0.7, geometry.clumpR * 0.13);
  ctx.stroke();

  ctx.restore();
}
