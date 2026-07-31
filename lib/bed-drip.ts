// ONE TAP, A DRIPLINE DOWN EVERY BED.
//
// Rory: "when it comes to drip on veg beds i want to be able to auto click a button and auto drip
// irrigation is pasted neatly down the centre of each bed, then we add the main pipe etc."
//
// That last clause is the design. This lays the LATERALS — the line that runs the length of a bed
// and waters it — and stops there. The mainline from the tank to the head of the block is a route
// across the farm, past other things, chosen by someone who knows where they want to dig; nothing
// here can guess it, and pretending to would produce a pipe through the middle of the house. So
// the tedious, mechanical, identical-for-every-bed half is automated and the judgement half is
// left to the farmer, which is the same division bedBlockPaths already makes.
//
// WHAT "NEATLY DOWN THE CENTRE" MEANS GEOMETRICALLY. A bed element's natural footprint is wM
// ACROSS by hM ALONG — veg_bed is 1.2 × 3, so the long side is hM and at rot 0 it already runs
// down the screen. The lateral therefore runs along the item's LOCAL Y axis, through its centre,
// rotated by whatever the bed is rotated by. Get that backwards and every dripline crosses its
// bed instead of running down it.
//
// ONE LINE PER BED, NOT A GRID. A 1.2 m bed in practice takes two or three laterals at a spacing
// that depends on the emitter, the soil and the crop — and this file is not going to invent those
// numbers. "Down the centre" is a geometric fact about the bed; a spacing is an agronomic claim,
// and an agronomic claim needs a source. One centred lateral is what was asked for and all that
// can be said honestly; a farmer who wants three can copy it.
//
// PRESSING IT TWICE MUST NOT DOUBLE EVERYTHING. A bed that already has a drip line through it is
// skipped, so the button is safe to press again after adding beds — the common case, since beds
// arrive in blocks and the button is on a different step from where they are drawn.
//
// Pure geometry in, pure geometry out — no React, no undo, no persistence, same discipline as
// bed-block.ts, tidy-outline.ts, snap-edges.ts and square-up.ts. The caller previews and commits.

type Pt = [number, number];

export interface BedDripFrame {
  imgW: number;
  imgH: number;
  /** Metres per logical pixel — see CanvasFrame in lib/design-canvas.ts. */
  mPerPx: number;
}

/** A bed, as much of PlacedItem as this needs. */
export interface DripBed {
  id: string;
  /** Normalised centre in the frame. */
  x: number;
  y: number;
  /** Footprint in metres: wM across, hM along. */
  wM: number;
  hM: number;
  /** Clockwise degrees, as stored on PlacedItem.rot. */
  rot?: number;
  /** Circle-footprint beds (keyhole, herb spiral) have no long axis to run a lateral down. */
  round?: boolean;
  label?: string;
}

export interface BedDripLine {
  bedId: string;
  points: [Pt, Pt];
}

export type BedDripSkipReason = 'already_watered' | 'round' | 'too_small';

export interface BedDripResult {
  lines: BedDripLine[];
  skipped: Array<{ bedId: string; label?: string; reason: BedDripSkipReason }>;
  changed: boolean;
}

/**
 * How far in from each end the lateral stops.
 *
 * Not an agronomic figure — it is a drawing decision, so that the line reads as belonging to the
 * bed rather than as a fence running past it, and so two beds end to end do not appear to share
 * one continuous pipe. A tenth of the bed's own length, capped, so it scales with the bed instead
 * of looking wrong on a 1 m herb bed and a 20 m field row.
 */
const END_INSET_FRACTION = 0.06;
const MAX_END_INSET_M = 0.25;
/** Below this there is no meaningful length to run a lateral down. */
const MIN_BED_LENGTH_M = 0.4;

function metresPerNormX(f: BedDripFrame): number {
  return f.imgW * f.mPerPx;
}
function metresPerNormY(f: BedDripFrame): number {
  return f.imgH * f.mPerPx;
}

/**
 * A point at a local offset (metres, in the bed's own frame) from the bed's centre.
 *
 * The rotation matches SVG's `rotate(deg)` in this canvas's y-DOWN space, which is what
 * DesignCanvas paints the bed with — so the line lands on the rectangle the farmer can see rather
 * than on a mirrored one.
 */
function localToNormalised(bed: DripBed, dxM: number, dyM: number, f: BedDripFrame): Pt {
  const rad = ((bed.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = dxM * cos - dyM * sin;
  const ry = dxM * sin + dyM * cos;
  return [bed.x + rx / metresPerNormX(f), bed.y + ry / metresPerNormY(f)];
}

/** A normalised point in the bed's own frame, in metres from its centre. */
function toBedLocal(bed: DripBed, p: Pt, f: BedDripFrame): Pt {
  const dxM = (p[0] - bed.x) * metresPerNormX(f);
  const dyM = (p[1] - bed.y) * metresPerNormY(f);
  const rad = (-(bed.rot ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [dxM * cos - dyM * sin, dxM * sin + dyM * cos];
}

/** Is a normalised point inside this bed's rotated footprint? */
export function pointInBed(bed: DripBed, p: Pt, f: BedDripFrame): boolean {
  const [lx, ly] = toBedLocal(bed, p, f);
  return Math.abs(lx) <= bed.wM / 2 && Math.abs(ly) <= bed.hM / 2;
}

/**
 * How much of a segment lies inside this bed, in metres.
 *
 * Checking only the ENDPOINTS was wrong and a test caught it: a pipe drawn straight through a bed
 * has both ends outside it, so the bed looked unwatered and would have got a second line laid
 * underneath the first.
 *
 * Rotating the segment into the bed's own frame turns this into a plain slab clip (Liang–Barsky),
 * which is exact and cheap — no polygon library, no sampling.
 */
export function segmentLengthInBed(bed: DripBed, a: Pt, b: Pt, f: BedDripFrame): number {
  const p0 = toBedLocal(bed, a, f);
  const p1 = toBedLocal(bed, b, f);
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  let t0 = 0;
  let t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (Math.abs(p) < 1e-12) return q >= 0; // parallel to this edge: inside iff already within it
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  const hw = bed.wM / 2;
  const hh = bed.hM / 2;
  if (!clip(-dx, p0[0] + hw)) return 0;
  if (!clip(dx, hw - p0[0])) return 0;
  if (!clip(-dy, p0[1] + hh)) return 0;
  if (!clip(dy, hh - p0[1])) return 0;
  return Math.max(0, t1 - t0) * Math.hypot(dx, dy);
}

/**
 * ALREADY WATERED means a line runs ALONG this bed, not merely across it.
 *
 * A mainline laid along the head of a block clips the end of every bed in it. Treating any
 * intersection as "watered" would leave the whole block with no laterals — the exact opposite of
 * what the button is for. Half the bed's own length is the line between a pipe passing by and a
 * pipe doing the job.
 */
const SERVED_FRACTION = 0.5;

/**
 * Lay one lateral down the centre of every bed that has not got one.
 *
 * `existingDrip` is every drip line already on the design; a bed with any of their vertices inside
 * its footprint is treated as served and left alone.
 */
export function dripLinesForBeds(
  beds: DripBed[],
  existingDrip: Array<{ points: Pt[] }>,
  frame: BedDripFrame,
): BedDripResult {
  const lines: BedDripLine[] = [];
  const skipped: BedDripResult['skipped'] = [];

  if (!Number.isFinite(frame.mPerPx) || frame.mPerPx <= 0) {
    return { lines: [], skipped: [], changed: false };
  }

  for (const bed of beds) {
    if (!Number.isFinite(bed.x) || !Number.isFinite(bed.y) || !(bed.wM > 0) || !(bed.hM > 0)) {
      skipped.push({ bedId: bed.id, label: bed.label, reason: 'too_small' });
      continue;
    }
    if (bed.round) {
      // A keyhole bed or a herb spiral has no long axis; a "centre line" through one is a line
      // across a circle, which waters nothing in particular.
      skipped.push({ bedId: bed.id, label: bed.label, reason: 'round' });
      continue;
    }
    // The lateral runs down the LONGER side, whichever that is. hM is the long side for the stock
    // bed elements, but a farmer can resize a bed to be wider than it is long, and a lateral
    // across the short axis of their bed would be wrong in exactly the way that is hard to fix.
    const alongIsY = bed.hM >= bed.wM;
    const lengthM = alongIsY ? bed.hM : bed.wM;
    if (lengthM < MIN_BED_LENGTH_M) {
      skipped.push({ bedId: bed.id, label: bed.label, reason: 'too_small' });
      continue;
    }
    const served = existingDrip.some((line) => {
      const pts = line.points;
      if (!Array.isArray(pts) || pts.length < 2) return false;
      let inside = 0;
      for (let i = 0; i < pts.length - 1; i += 1) inside += segmentLengthInBed(bed, pts[i], pts[i + 1], frame);
      return inside >= lengthM * SERVED_FRACTION;
    });
    if (served) {
      skipped.push({ bedId: bed.id, label: bed.label, reason: 'already_watered' });
      continue;
    }
    const inset = Math.min(MAX_END_INSET_M, lengthM * END_INSET_FRACTION);
    const half = lengthM / 2 - inset;
    const a = alongIsY ? localToNormalised(bed, 0, -half, frame) : localToNormalised(bed, -half, 0, frame);
    const b = alongIsY ? localToNormalised(bed, 0, half, frame) : localToNormalised(bed, half, 0, frame);
    lines.push({ bedId: bed.id, points: [a, b] });
  }

  return { lines, skipped, changed: lines.length > 0 };
}

/** One line a farmer can read before confirming. Same voice as tidyOutlineSummary. */
export function bedDripSummary(result: BedDripResult): string {
  const already = result.skipped.filter((s) => s.reason === 'already_watered').length;
  const round = result.skipped.filter((s) => s.reason === 'round').length;
  if (!result.changed) {
    if (already > 0 && round === 0) return `Every bed already has drip.`;
    if (already === 0 && round > 0) return `Nothing to do — round beds have no length to run a line down.`;
    if (already > 0) return `Every straight bed already has drip.`;
    return 'No beds to water yet — place some beds first.';
  }
  const parts = [`Runs drip down the centre of ${result.lines.length} ${result.lines.length === 1 ? 'bed' : 'beds'}.`];
  if (already > 0) parts.push(`${already} already had it.`);
  if (round > 0) parts.push(`${round} round ${round === 1 ? 'bed is' : 'beds are'} left for you.`);
  parts.push('Add the mainline yourself.');
  return parts.join(' ');
}
