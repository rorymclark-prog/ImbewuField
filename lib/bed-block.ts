// Lay out a BLOCK of parallel growing beds in one action, instead of placing and nudging each
// bed by hand (Rory: "i also need a way to insert multiple beds - we set the bed length the bed
// width the path width etc and then we can have it hanging on our mouse ... and then i set it on
// a corner and pivot into place"). Seven beds used to mean seven placements and seven alignment
// drags; this makes it one anchor tap and one pivot.
//
// Pure geometry, deliberately: the canvas owns the gesture, this owns the maths. That keeps the
// part that is easy to get subtly wrong — metres-to-pixels, the rotation convention, where the
// anchor sits relative to the first bed — under unit test rather than under a pointer event.
//
// CONVENTIONS, all three of which are easy to get backwards:
//  - The anchor is the block's CORNER, not its centre. That is what the farmer taps: they stand
//    at a corner of the plot and lay the block out from it.
//  - `angleDeg` is the direction the bed LENGTH runs, clockwise from east, in the same y-DOWN
//    screen space the canvas uses. The pivot gesture produces exactly this (anchor → pointer).
//  - A bed element's natural footprint is wM ACROSS by hM ALONG (veg_bed is 1.2 x 3 — the long
//    side is hM), so at rot 0 a bed's length already runs down the screen, i.e. at 90 degrees.
//    The emitted `rot` is therefore angleDeg - 90, not angleDeg.

import { normaliseRotation } from './design-canvas';
import type { CanvasFrame, DesignCanvasState, ZoneShape } from './design-canvas';
import polygonClipping from 'polygon-clipping';
import { ELEMENTS_BY_ID } from './design-elements';

export interface FieldBlockConfig {
  mode: 'beds' | 'open';
  bedLengthM: number;
  bedWidthM: number;
  pathWidthM: number;
  angleDeg: number;
}

export function reconcileFieldBlockEdit(prev: DesignCanvasState, next: DesignCanvasState, allocated: ReadonlySet<string>): DesignCanvasState {
  // The ordinary map delete/resize tools must honour the same allocation
  // protection as the field form; otherwise rebuilding can reuse a deleted
  // bed's identity and attach its old crop to different measured ground.
  for (const item of prev.items) {
    if (!item.fieldBlockId || !allocated.has(item.id)) continue;
    const after = next.items.find(i => i.id === item.id);
    if (!after || after.x !== item.x || after.y !== item.y
      || after.wM !== item.wM || after.hM !== item.hM || after.rot !== item.rot
      || after.fieldBlockId !== item.fieldBlockId)
      throw new Error('Remove this bed’s crop allocations before changing or deleting its layout.');
  }
  const deleted = new Set(prev.zones.filter(z => z.fieldBlock && !next.zones.some(n => n.id === z.id)).map(z => z.id));
  for (const zone of prev.zones.filter(z => z.fieldBlock)) {
    const children = prev.items.filter(i => i.fieldBlockId === zone.id);
    const after = next.zones.find(z => z.id === zone.id);
    if (deleted.has(zone.id) && (allocated.has(zone.id) || children.some(i => allocated.has(i.id))))
      throw new Error('Remove this field’s crop allocations before deleting it.');
    if (after?.fieldBlock?.mode === 'beds' && children.length && JSON.stringify(after.points) !== JSON.stringify(zone.points))
      throw new Error('Switch this block to an open field before editing its outline, then fill it again.');
  }
  if (!deleted.size) return next;
  return { ...next, items: next.items.filter(i => !i.fieldBlockId || !deleted.has(i.fieldBlockId)), lines: next.lines.filter(l => !l.fieldBlockId || !deleted.has(l.fieldBlockId)) };
}

type Point = [number, number];

/** Only whole beds count as planted capacity. A corner-only containment check
 * misses a concave field edge passing through the middle of a bed. */
export function bedsInsideField(
  points: Point[], config: FieldBlockConfig,
  frame: Pick<CanvasFrame, 'mPerPx' | 'imgW' | 'imgH'>,
  exclusions: Point[][] = [],
): { beds: BedBlockPlacement[]; paths: Point[][] } {
  const { bedLengthM: length, bedWidthM: width, pathWidthM: path, angleDeg } = config;
  const w = frame.imgW * frame.mPerPx, h = frame.imgH * frame.mPerPx;
  if (![w, h, length, width, path, angleDeg].every(Number.isFinite)
    || w <= 0 || h <= 0 || length < MIN_BED_DIM_M || width < MIN_BED_DIM_M || path < 0
    || length > MAX_BED_DIM_M || width > MAX_BED_DIM_M || path > MAX_PATH_M) {
    throw new Error('Enter valid bed dimensions, path width and direction.');
  }
  if (points.length < 3 || points.some(p => !p.every(Number.isFinite))) throw new Error('Draw a field polygon first.');
  const rad = angleDeg * Math.PI / 180;
  // Cardinal directions must be exact: tiny trig residues at 90° can make
  // coincident polygon edges disagree inside the clipping engine.
  const snap = (v: number) => Math.abs(v) < 1e-12 ? 0 : v;
  const c = snap(Math.cos(rad)), s = snap(Math.sin(rad));
  const ring: Point[] = points.map(([x, y]) => [x * w * c + y * h * s, -x * w * s + y * h * c]);
  const blockers = exclusions.map(r => {
    const ring = r.map(([x,y]): Point => [x*w*c+y*h*s, -x*w*s+y*h*c]);
    return { ring, minX: Math.min(...ring.map(p => p[0])), maxX: Math.max(...ring.map(p => p[0])), minY: Math.min(...ring.map(p => p[1])), maxY: Math.max(...ring.map(p => p[1])) };
  });
  const minX = Math.min(...ring.map(p => p[0])), maxX = Math.max(...ring.map(p => p[0]));
  const minY = Math.min(...ring.map(p => p[1])), maxY = Math.max(...ring.map(p => p[1]));
  const nx = Math.max(0, Math.floor((maxX - minX + path + 1e-8) / (length + path)));
  const ny = Math.max(0, Math.floor((maxY - minY + path + 1e-8) / (width + path)));
  if (nx * ny > 20000) throw new Error('This layout is too dense. Increase the bed dimensions or divide the field.');
  const norm = (x: number, y: number): Point => [(x * c - y * s) / w, (x * s + y * c) / h];
  const empty = (polys: ReturnType<typeof polygonClipping.difference>) => polys.every(poly => poly.every(r => Math.abs(r.reduce((a, p, i) => {
      const q = r[(i + 1) % r.length]; return a + p[0] * q[1] - q[0] * p[1];
    }, 0)) < 1e-7));
  const fits = (box: Point[]) => empty(polygonClipping.difference([box], [ring]))
    // Most footprints belong to other fields. Reject their bounding boxes
    // cheaply before clipping so typing a dimension does not clip every bed
    // against hundreds of unrelated beds in neighbouring blocks.
    && blockers.every(b => box[1][0] <= b.minX || box[0][0] >= b.maxX
      || box[2][1] <= b.minY || box[0][1] >= b.maxY
      || empty(polygonClipping.intersection([box], [b.ring])));
  const beds: BedBlockPlacement[] = [], paths: Point[][] = [];
  const cells = new Set<string>();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = minX + i * (length + path), y = minY + j * (width + path);
    if (!fits([[x,y], [x+length,y], [x+length,y+width], [x,y+width]])) continue;
    if (beds.length >= 500) throw new Error('More than 500 beds fit. Divide this field into smaller blocks.');
    cells.add(`${i}:${j}`);
    const [cx, cy] = norm(x + length / 2, y + width / 2);
    beds.push({ x: cx, y: cy, wM: width, hM: length, rot: normaliseRotation(angleDeg - 90) });
  }
  if (path > 0) for (const cell of cells) {
    const [i,j] = cell.split(':').map(Number);
    const x = minX + i * (length + path), y = minY + j * (width + path);
    if (cells.has(`${i}:${j+1}`) && fits([[x,y+width],[x+length,y+width],[x+length,y+width+path],[x,y+width+path]]))
      paths.push([norm(x,y+width+path/2), norm(x+length,y+width+path/2)]);
    if (cells.has(`${i+1}:${j}`) && fits([[x+length,y],[x+length+path,y],[x+length+path,y+width],[x+length,y+width]]))
      paths.push([norm(x+length+path/2,y), norm(x+length+path/2,y+width)]);
  }
  return { beds, paths };
}

/** Existing physical footprints stay in place; filling a field must not plant
 * over a bed, building or tree already recorded by the farmer. */
export function fieldBlockExclusions(state: DesignCanvasState, zoneId: string, frame: Pick<CanvasFrame, 'mPerPx' | 'imgW' | 'imgH'>): Point[][] {
  const w = frame.imgW * frame.mPerPx, h = frame.imgH * frame.mPerPx;
  const rings: Point[][] = state.items.filter(i => i.fieldBlockId !== zoneId).flatMap(item => {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) return [];
    const a = (item.rot ?? 0) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = (item.wM ?? def.wM)/2, dy = (item.hM ?? def.hM)/2;
    return [[[-dx,-dy],[dx,-dy],[dx,dy],[-dx,dy]].map(([x,y]): Point => [item.x+(x*c-y*s)/w,item.y+(x*s+y*c)/h])];
  });
  for (const zone of state.zones) if (zone.id !== zoneId && zone.feature && ['house','paving','driveway'].includes(zone.feature)) rings.push(zone.points);
  return rings;
}

/** Materialise a farmer-approved layout as one edit, never during rendering.
 * Existing crop allocations block rebuilding so their measured space cannot
 * silently change underneath a saved crop plan. */
export function configureFieldBlock(
  state: DesignCanvasState, zoneId: string, name: string, config: FieldBlockConfig,
  frame: Pick<CanvasFrame, 'mPerPx' | 'imgW' | 'imgH'>,
  allocatedIds: ReadonlySet<string> = new Set(),
): DesignCanvasState {
  const zone = state.zones.find(z => z.id === zoneId && z.feature === 'staple_garden');
  if (!zone) throw new Error('Select a field polygon first.');
  const overlaps = (ring: Point[]) => polygonClipping.intersection([zone.points], [ring]).some(p => p.some(r => Math.abs(r.reduce((a,v,i) => {
    const q = r[(i+1)%r.length]; return a+v[0]*q[1]-q[0]*v[1];
  },0)) > 1e-12));
  if (state.zones.some(z => z.id !== zoneId && z.feature === 'staple_garden' && overlaps(z.points)))
    throw new Error('Field blocks overlap. Adjust their outlines so the same ground is not planned twice.');
  if (allocatedIds.has(zoneId) || state.items.some(i => i.fieldBlockId === zoneId && allocatedIds.has(i.id)))
    throw new Error('This field has crop allocations. Remove those allocations in the crop planner before changing its layout.');
  const exclusions = fieldBlockExclusions(state, zoneId, frame);
  if (config.mode === 'open' && exclusions.some(overlaps)) throw new Error('This open field overlaps placed elements. Adjust its outline.');
  const result = config.mode === 'beds' ? bedsInsideField(zone.points, config, frame, exclusions) : { beds: [], paths: [] };
  if (config.mode === 'beds' && !result.beds.length) throw new Error('No full-size beds fit. Try a shorter length, smaller width or another direction.');
  const label = name.trim() || 'Field block';
  const fieldZone: ZoneShape = { ...zone, name: label, fieldBlock: { ...config } };
  return {
    ...state,
    zones: state.zones.map(z => z.id === zoneId ? fieldZone : z),
    items: [...state.items.filter(i => i.fieldBlockId !== zoneId), ...result.beds.map((bed, n) => ({
      ...bed, id: `${zoneId}:bed:${n+1}`, defId: 'veg_bed', fieldBlockId: zoneId,
      label: `${label} / Bed ${n+1}`, status: 'proposed' as const,
    }))],
    lines: [...state.lines.filter(l => l.fieldBlockId !== zoneId), ...result.paths.map((points, n) => ({
      id: `${zoneId}:path:${n+1}`, kind: 'bedpath' as const, fieldBlockId: zoneId,
      points, widthM: config.pathWidthM,
    }))],
  };
}

export interface BedBlockSpec {
  /** The long side of each bed, in metres. */
  bedLengthM: number;
  /** The short side of each bed, in metres — how far you can reach in from a path. */
  bedWidthM: number;
  /** Gap between neighbouring beds, in metres. 0 is legal: it means one continuous wide bed. */
  pathWidthM: number;
  /** How many beds in the block. */
  count: number;
}

export interface BedBlockPlacement {
  /** Normalised [0..1] centre of this bed in the frame. */
  x: number;
  y: number;
  /** Footprint in metres, in the element's own w-across / h-along convention. */
  wM: number;
  hM: number;
  /** Clockwise degrees, ready to write straight onto PlacedItem.rot — including being
   *  `undefined` at natural orientation, which is how this codebase keeps a meaningless
   *  `rot: 0` out of every persisted item (see normaliseRotation). */
  rot?: number;
}

/** Beds per block. The ceiling is a runaway guard, not a design opinion — a slip in a number
 *  field should not be able to commit ten thousand items in one undo entry. */
export const MIN_BED_COUNT = 1;
export const MAX_BED_COUNT = 60;
/** Metre bounds for each dimension. The floor keeps a bed from collapsing to an untappable
 *  sliver; the ceiling is well past any real market-garden bed. Paths may be 0 (touching beds). */
export const MIN_BED_DIM_M = 0.2;
export const MAX_BED_DIM_M = 200;
export const MAX_PATH_M = 50;

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Coerce whatever came out of a number input into a spec that cannot produce broken geometry.
 *  Non-finite values fall back to the defaults rather than propagating NaN into coordinates,
 *  because a NaN centre renders as nothing at all and reads as "the button did nothing". */
export function normaliseBedBlockSpec(spec: Partial<BedBlockSpec>): BedBlockSpec {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    bedLengthM: clampNum(num(spec.bedLengthM, 3), MIN_BED_DIM_M, MAX_BED_DIM_M),
    bedWidthM: clampNum(num(spec.bedWidthM, 1.2), MIN_BED_DIM_M, MAX_BED_DIM_M),
    pathWidthM: clampNum(num(spec.pathWidthM, 0.5), 0, MAX_PATH_M),
    count: Math.round(clampNum(num(spec.count, 4), MIN_BED_COUNT, MAX_BED_COUNT)),
  };
}

/**
 * Place `count` parallel beds running out from `anchor`.
 *
 * Bed 1's near corner sits ON the anchor; each later bed steps sideways by one bed width plus
 * one path. Nothing is clamped to the frame — a farmer aiming a block off the edge should see
 * it hang off the edge in the ghost and re-aim, rather than have beds silently pile up against
 * an invisible wall.
 */
export function layoutBedBlock(
  spec: BedBlockSpec,
  anchor: [number, number],
  angleDeg: number,
  mPerPx: number,
  imgW: number,
  imgH: number,
): BedBlockPlacement[] {
  const s = normaliseBedBlockSpec(spec);
  // A zero/negative/NaN scale would make every bed infinitely large or land at NaN. There is no
  // sensible block to draw without a real ground scale, so draw none.
  if (!Number.isFinite(mPerPx) || mPerPx <= 0) return [];
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW <= 0 || imgH <= 0) return [];
  if (!Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return [];
  const angle = Number.isFinite(angleDeg) ? angleDeg : 0;

  const pxPerM = 1 / mPerPx;
  const rad = (angle * Math.PI) / 180;
  // Along the bed's length, and 90 degrees clockwise from it (y-down, so +90 is (-sin, cos)).
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = -Math.sin(rad);
  const vy = Math.cos(rad);

  // Work in PIXELS, not normalised units: x and y normalise by different divisors (imgW vs imgH),
  // so rotating in normalised space would shear every bed whenever the frame is not square.
  const ax = anchor[0] * imgW;
  const ay = anchor[1] * imgH;
  const lengthPx = s.bedLengthM * pxPerM;
  const widthPx = s.bedWidthM * pxPerM;
  const pathPx = s.pathWidthM * pxPerM;
  const rot = normaliseRotation(angle - 90);

  const out: BedBlockPlacement[] = [];
  for (let i = 0; i < s.count; i++) {
    const along = lengthPx / 2;
    const across = widthPx / 2 + i * (widthPx + pathPx);
    const cx = ax + ux * along + vx * across;
    const cy = ay + uy * along + vy * across;
    out.push({
      x: cx / imgW,
      y: cy / imgH,
      wM: s.bedWidthM,
      hM: s.bedLengthM,
      rot,
    });
  }
  return out;
}

/** Total ground the block occupies, for the "12.4 m × 8.6 m" readout on the placement hint —
 *  a farmer aiming a block wants to know whether it fits before committing, not after. */
export function bedBlockFootprintM(spec: BedBlockSpec): { alongM: number; acrossM: number } {
  const s = normaliseBedBlockSpec(spec);
  return {
    alongM: s.bedLengthM,
    // n beds have n-1 paths BETWEEN them; counting n paths would overstate the block by one
    // path and quietly make every "will it fit" answer wrong in the farmer's favour.
    acrossM: s.count * s.bedWidthM + Math.max(0, s.count - 1) * s.pathWidthM,
  };
}

/**
 * The walking paths BETWEEN the beds, as centre-lines ready to become LineShapes of kind 'path'.
 *
 * Typing a path width used to do nothing but push the beds apart, so the plan showed a block of
 * beds floating in unexplained gaps: no path on the map, nothing in the legend, nothing to build
 * from (Rory, after placing a block: "it didnt add paths when inserted"). A farmer who says the
 * paths are half a metre is specifying part of the layout, not just a spacing hint.
 *
 * n beds have n-1 paths, the same count the footprint maths uses — an outer path on each edge
 * would belong to whatever is next to the block, which this function cannot know.
 *
 * Returns nothing when the path width is 0: touching beds are one continuous bed, and a
 * zero-width path drawn down the seam would be a line claiming to be somewhere you can walk.
 */
export function bedBlockPaths(
  spec: BedBlockSpec,
  anchor: [number, number],
  angleDeg: number,
  mPerPx: number,
  imgW: number,
  imgH: number,
): Array<Array<[number, number]>> {
  const s = normaliseBedBlockSpec(spec);
  if (s.pathWidthM <= 0 || s.count < 2) return [];
  if (!Number.isFinite(mPerPx) || mPerPx <= 0) return [];
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW <= 0 || imgH <= 0) return [];
  if (!Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return [];
  const angle = Number.isFinite(angleDeg) ? angleDeg : 0;

  const pxPerM = 1 / mPerPx;
  const rad = (angle * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = -Math.sin(rad);
  const vy = Math.cos(rad);
  const ax = anchor[0] * imgW;
  const ay = anchor[1] * imgH;
  const lengthPx = s.bedLengthM * pxPerM;
  const widthPx = s.bedWidthM * pxPerM;
  const pathPx = s.pathWidthM * pxPerM;

  const out: Array<Array<[number, number]>> = [];
  for (let i = 0; i < s.count - 1; i++) {
    // Centre of the gap after bed i: past i+1 beds and i paths, then half a path in.
    const across = (i + 1) * widthPx + i * pathPx + pathPx / 2;
    const sx = ax + vx * across;
    const sy = ay + vy * across;
    out.push([
      [sx / imgW, sy / imgH],
      [(sx + ux * lengthPx) / imgW, (sy + uy * lengthPx) / imgH],
    ]);
  }
  return out;
}
