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
// Every plan surface calls the same top-down painter below. A renderer may choose its own footprint
// and print scale, but it may not substitute a separate side-view or gradient-wash vetiver symbol:
// a farmer should never have to learn two map marks for the same living hedge.

/** Both catalog ids that are physically the same thing: a line of vetiver knitted into a hedge. */
export const VETIVER_HEDGE_IDS: ReadonlySet<string> = new Set(['vetiver_row', 'mulch_bank']);

/** Slips 10-15 cm apart — vetiver_row's own catalog tip. Not a number invented for the drawing. */
export const VETIVER_SLIP_SPACING_M = 0.125;
/** A mature clump is roughly 30 cm across, which is exactly why 12.5 cm slips close into a hedge. */
export const VETIVER_CLUMP_RADIUS_M = 0.15;
/** A bank deeper than one slip line holds parallel contour lines, not one impossibly fat hedge. */
export const VETIVER_LINE_SPACING_M = 0.6;

/** Longest blade, as a multiple of its own crown's radius (traceTufts: 0.8 + 0.9 jitter). */
export const VETIVER_BLADE_LENGTH_FACTOR = 1.7;

/**
 * How far the outermost blade tip can land from a tuft's NOMINAL position, in clump radii.
 *
 * Derived from the crown builder and traceTufts rather than guessed, so it cannot drift out of
 * agreement with the drawing: a crown's own radius runs to clumpR x 1.22 (0.6 + 0.62 jitter), its
 * blades to that x VETIVER_BLADE_LENGTH_FACTOR, and the crown's own wobble off its slip line adds
 * a further 0.3 (0.6 / 2). 1.22 x 1.7 + 0.3 = 2.374. Rounded up.
 *
 * It exists because a hedge's drawn width is NOT its clump radius — it is this multiple of it, and
 * that difference is the whole reason a 0.52 m row was coming out at about twice its stated width.
 */
export const VETIVER_BLADE_REACH = 2.4;

/** Below this the band cannot carry a drawing of any kind, however the floor is tuned. */
const MIN_BAND_PX = 2;

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

export interface TopDownVetiverHedgePaintOptions {
  widthPx: number;
  heightPx: number;
  widthM: number;
  heightM: number;
  pxPerM: number;
  minClumpPx: number;
  seedId: string;
  casingWidth: number;
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
  //
  // THE BAND OVERRULES THE FLOOR, and this is the third time Rory has reported the width. He
  // measured it himself: a Vetiver Row saved at W 0,52 m drew on the sheet at roughly twice that.
  // The floor was the cause. It lifts the clump radius, the blades then reach VETIVER_BLADE_REACH x
  // that radius, and NOTHING was comparing the result with the band it was supposed to sit in — so
  // the narrower the hedge, the further past its own edges it grew.
  //
  // This is exactly the mistake plantingFeaturePresentationDimensions already documents and fixed
  // ("keying off the short side rescued nothing and quietly widened every hedge, row and strip").
  // A legibility floor may rescue a mark that is too small to SEE; it may never widen one the
  // farmer has stated a width for, because on a sheet with a scale bar that width is a measurement.
  // So the floor applies only while it fits, and the band wins whenever the two disagree.
  const bandLimitedR = bandPx / (2 * VETIVER_BLADE_REACH);
  const clumpR = Math.min(Math.max(minClumpPx, VETIVER_CLUMP_RADIUS_M * pxPerM), bandLimitedR);
  if (!Number.isFinite(clumpR) || clumpR <= 0) return null;
  // The sub-symbol guard is now on the BAND, not on the clump. It used to be `runPx < clumpR * 3`
  // alone, which worked only while the clump had a floor under it: once the band is allowed to
  // shrink the clump, a footprint of a fraction of a pixel produces a proportionally tiny clump and
  // sails through its own guard. The band is the thing that has to be able to carry a drawing.
  if (bandPx < MIN_BAND_PX) return null;
  if (runPx < clumpR * 3) return null;

  const lineFit = Math.max(1, Math.floor(bandPx / (clumpR * 1.7)));
  const lines = Math.max(1, Math.min(lineFit, 6, Math.round(bandM / VETIVER_LINE_SPACING_M) || 1));
  const stepPx = Math.max(clumpR * 0.62, VETIVER_SLIP_SPACING_M * pxPerM);
  const perLine = Math.max(3, Math.min(180, Math.round(runPx / stepPx)));

  const crowns: VetiverHedgeGeometry['crowns'] = [];
  // Inset by the full blade REACH, not by the crown radius: it is the blade tips that have to stay
  // inside the saved footprint, and insetting by the radius alone left every outer tuft hanging a
  // clump's width over the edge of the band.
  const inset = Math.min(clumpR * VETIVER_BLADE_REACH, bandPx / 2);
  const acrossGap = lines > 1 ? Math.max(0, bandPx - inset * 2) / (lines - 1) : 0;
  const alongGap = (runPx - clumpR * 1.6) / Math.max(1, perLine - 1);
  for (let line = 0; line < lines; line++) {
    const across = lines > 1 ? -(bandPx / 2) + inset + line * acrossGap : 0;
    for (let slip = 0; slip < perLine; slip++) {
      const along = -(runPx / 2) + clumpR * 0.8 + slip * alongGap;
      const seed = `${seedId}:${line}:${slip}`;
      // A NURSERY ROW, NOT A PICKET FENCE. Rory, on the rendered sheet: "the vetiver is still
      // looking too artificial" — and what made it artificial was regularity, not the tufts
      // themselves: every slip the same size, every gap identical, every crown dead on its line.
      // Real slips establish unevenly, so each crown drifts a bounded way ALONG the run (never
      // past its neighbour's nominal spot, never off the end of the band), wanders a little OFF
      // the slip line, and grows to its own size. All three jitters are seeded per crown, so a
      // saved design paints the identical hedge on every render — see the determinism test.
      //
      // High stableUnit indices (90+) are reserved for geometry, low ones (2..13) for the blades
      // in traceTufts and 60+ for the paint pass, so no two draws share a jitter by accident.
      const alongDrift = (stableUnit(seed, 90) - 0.5) * Math.min(alongGap * 0.9, clumpR * 1.2);
      // Off-line wobble is what VETIVER_BLADE_REACH budgets 0.6/2 = 0.3 clump radii for.
      const acrossDrift = (stableUnit(seed, 91) - 0.5) * clumpR * 0.6;
      crowns.push({
        x: alongY ? across + acrossDrift : along + alongDrift,
        y: alongY ? along + alongDrift : across + acrossDrift,
        // 0.6..1.22 of the clump radius — wide enough that big established tussocks sit beside
        // young ones, capped at the 1.22 the reach constant is derived from.
        r: clumpR * (0.6 + stableUnit(seed, 92) * 0.62),
        seed,
      });
    }
  }
  return { lines, perLine, clumpR, alongY, crowns };
}

/**
 * The one render authority for vetiver on plan sheets and symbol keys. Callers own their local
 * presentation dimensions; this function owns the top-down tuft treatment so
 * an old sheet cannot quietly regress to a different plant drawing.
 */
export function paintTopDownVetiverHedge(
  ctx: CanvasRenderingContext2D,
  options: TopDownVetiverHedgePaintOptions,
): boolean {
  const geometry = vetiverHedgeGeometry(
    options.widthPx,
    options.heightPx,
    options.widthM,
    options.heightM,
    options.pxPerM,
    options.minClumpPx,
    options.seedId,
  );
  if (!geometry) return false;
  drawVetiverHedge(ctx, geometry, options.casingWidth);
  return true;
}

/**
 * The blades' top-pass greens. Three near-neighbours from the sheet's soft earth family, not
 * three different plants: hue drifts gently along the run the way sun and establishment age vary
 * along a real hedge, which is one of the three regularities Rory read as "artificial" (the other
 * two — even spacing and ruler-straight sides — are handled in the geometry and the band).
 */
const BLADE_TONES = ['#8FC25C', '#9CC768', '#7CAF4E'] as const;

/** Which of the three blade tones one crown wears. Seeded, so it never changes between renders. */
function crownTone(seed: string): number {
  return Math.min(BLADE_TONES.length - 1, Math.floor(stableUnit(seed, 62) * BLADE_TONES.length));
}

/**
 * Trace every tussock's ground blob into ONE path. Filled, the overlapping discs merge into a
 * continuous knitted band whose edge is set by the individual clumps — softly ragged — instead of
 * by the footprint rectangle, whose two ruler-straight sides were exactly what made the hedge
 * read as a painted stripe. Stroke-then-fill gives the union a cream casing the same way the old
 * plate got one: the stroke's inner half and every interior arc are buried by the fill that
 * follows, so only the outer, ragged half of the casing survives.
 */
function traceTussockBand(ctx: CanvasRenderingContext2D, geometry: VetiverHedgeGeometry): void {
  ctx.beginPath();
  for (const crown of geometry.crowns) {
    // 1.05..1.4 of the crown's own (already varied) radius — the blob has to overlap its
    // neighbours (slips sit 0.62 clump radii apart) or the band would fall apart into polka dots.
    // Max extent 1.22 x 1.4 = 1.71 clump radii, safely inside the VETIVER_BLADE_REACH = 2.4 the
    // width-honesty inset already budgets for, so the ragged edge can never widen the saved band.
    const r = crown.r * (1.05 + stableUnit(crown.seed, 60) * 0.35);
    ctx.moveTo(crown.x + r, crown.y);
    ctx.arc(crown.x, crown.y, r, 0, Math.PI * 2);
  }
}

/**
 * Trace the blades of every tuft in one tone bucket into ONE path, so a long bank costs a handful
 * of strokes rather than several hundred — the same batching the crop rows use. Pass -1 to trace
 * every crown regardless of tone (the dark under-pass wants them all).
 */
function traceTufts(ctx: CanvasRenderingContext2D, geometry: VetiverHedgeGeometry, tone = -1): void {
  ctx.beginPath();
  for (const crown of geometry.crowns) {
    if (tone >= 0 && crownTone(crown.seed) !== tone) continue;
    // A rosette: fine blades springing from one crown and arcing outward. This is what a
    // clump-forming grass looks like from directly overhead, and what separates vetiver from the
    // shrubs and tree canopies sharing the sheet. Blade COUNT is per-crown (7..11): a hedge where
    // every tussock carries exactly nine blades is a pattern, not a plant.
    const blades = 7 + Math.floor(stableUnit(crown.seed, 61) * 4.99);
    for (let b = 0; b < blades; b++) {
      const jitter = stableUnit(crown.seed, b + 2);
      const angle = (b / blades) * Math.PI * 2 + jitter * 0.42;
      // Blades deliberately overshoot their own crown and the band edge. That bristling silhouette
      // is most of what identifies vetiver from above — a band with a clean edge reads as a painted
      // stripe, which is what the first attempt at this looked like on a rendered sheet. Length
      // runs 0.8..1.7 of the crown radius (VETIVER_BLADE_LENGTH_FACTOR is derived from the 1.7).
      const len = crown.r * (0.8 + jitter * 0.9);
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
 * The band's silhouette is the union of the tussocks themselves, never the footprint rectangle:
 * the caller's saved geometry still decides exactly where every crown may sit (via
 * vetiverHedgeGeometry's inset and band cap), but the painted edge follows the plants. That is
 * the difference between a grass hedge and the "perfectly even pale-green strips" Rory
 * photographed — realism comes from texture and edge treatment while the saved line stays exact.
 */
export function drawVetiverHedge(
  ctx: CanvasRenderingContext2D,
  geometry: VetiverHedgeGeometry,
  casingWidth: number,
): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Cream casing, then a dense base, then the tufts — the body-inside-a-casing order every other
  // mark on these sheets uses to stay readable over an aerial photograph. The casing now hugs the
  // ragged tussock union rather than the rectangle, so the halo bristles with the hedge.
  traceTussockBand(ctx, geometry);
  ctx.strokeStyle = 'rgba(252,248,236,0.92)';
  ctx.lineWidth = casingWidth;
  ctx.stroke();
  traceTussockBand(ctx, geometry);
  ctx.fillStyle = 'rgba(48,80,41,0.88)';
  ctx.fill();

  // THE BLADES CARRY NO CREAM. The band below already has the cream casing that lifts the hedge
  // off an aerial photograph; putting a second cream casing on every blade as well was what turned
  // the first version into a pale grey-green bar with a fuzzy edge — the texture disappeared into
  // its own halo. Here the blades get a dark under-pass for depth and then a bright top pass per
  // tone bucket, which is the same shadow-then-body order the crop glyphs use, and the contrast is
  // what makes a clump of grass legible at 6 px.
  traceTufts(ctx, geometry);
  ctx.strokeStyle = 'rgba(20,36,18,0.55)';
  ctx.lineWidth = Math.max(1.1, geometry.clumpR * 0.24);
  ctx.stroke();
  for (let tone = 0; tone < BLADE_TONES.length; tone++) {
    traceTufts(ctx, geometry, tone);
    ctx.strokeStyle = BLADE_TONES[tone];
    ctx.lineWidth = Math.max(0.7, geometry.clumpR * 0.13);
    ctx.stroke();
  }

  ctx.restore();
}
