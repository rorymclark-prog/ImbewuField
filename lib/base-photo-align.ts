// The photo-import aligner's coordinate math, extracted pure so the part that silently
// corrupted a farm's scale is under unit test instead of under a pointer event.
//
// WHAT WENT WRONG (build 64bd8f3, Rory: "look what it did to the scale i inserted at the
// right scale and it shrunk all my design!"): the two calibration points were stored in
// CANVAS space — where the farmer's finger touched the glass — while the photo underneath
// moved through zoom/pan/rotation. The points did not ride the photo, so the moment the
// photo was adjusted after tapping them, the pixel distance between them no longer
// corresponded to the wall the farmer measured, and mPerPx was computed from a distance
// that meant nothing. The export then baked the MOVED photo with the STALE number.
//
// THE FIX is a change of coordinate system, not a patch: points live in PHOTO-IMAGE space
// (a corner of a building is the same image pixel at every zoom), and are projected through
// the CURRENT transform whenever canvas positions are needed. Because the export bakes that
// same transform, the metres-per-pixel derived from projected distances is correct BY
// CONSTRUCTION — there is no ordering of taps, zooms, pans and rotations that can break it.

/** A point in the photo's own pixel grid: 0..naturalWidth, 0..naturalHeight. */
export interface PhotoPoint {
  ix: number;
  iy: number;
}

/** A point on the aligner canvas, in its intrinsic pixel space. */
export interface CanvasPoint {
  x: number;
  y: number;
}

/** Everything that determines where a photo pixel lands on the canvas. */
export interface PhotoTransform {
  /** Photo's own pixel size. */
  naturalW: number;
  naturalH: number;
  /** Aligner canvas intrinsic size (DEFAULT_IMG_W/H). */
  frameW: number;
  frameH: number;
  /** Clockwise degrees. */
  rotationDeg: number;
  /** Farmer's multiplier on the cover fit; 1 = photo exactly covers the frame. */
  zoom: number;
  /** Canvas-space pixels. */
  panX: number;
  panY: number;
}

/**
 * The single scale factor from photo pixels to canvas pixels: "cover" fit of the rotated
 * bounding box (the canvas equivalent of preserveAspectRatio="xMidYMid slice"), times the
 * farmer's zoom. Must match BasePhotoImport's draw() exactly — draw() consumes this.
 */
export function coverScale(t: PhotoTransform): number {
  const rad = (t.rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const rotatedW = t.naturalW * cos + t.naturalH * sin;
  const rotatedH = t.naturalW * sin + t.naturalH * cos;
  if (rotatedW <= 0 || rotatedH <= 0) return 1;
  return Math.max(t.frameW / rotatedW, t.frameH / rotatedH) * t.zoom;
}

/** Where a photo pixel lands on the canvas under this transform. */
export function photoToCanvas(t: PhotoTransform, p: PhotoPoint): CanvasPoint {
  const rad = (t.rotationDeg * Math.PI) / 180;
  const s = coverScale(t);
  // Centre, scale, rotate, translate — the exact order draw() applies.
  const dx = (p.ix - t.naturalW / 2) * s;
  const dy = (p.iy - t.naturalH / 2) * s;
  return {
    x: t.frameW / 2 + t.panX + dx * Math.cos(rad) - dy * Math.sin(rad),
    y: t.frameH / 2 + t.panY + dx * Math.sin(rad) + dy * Math.cos(rad),
  };
}

/** Which photo pixel sits under a canvas point — the inverse of photoToCanvas. */
export function canvasToPhoto(t: PhotoTransform, p: CanvasPoint): PhotoPoint {
  const rad = (t.rotationDeg * Math.PI) / 180;
  const s = coverScale(t);
  if (!Number.isFinite(s) || s <= 0) return { ix: t.naturalW / 2, iy: t.naturalH / 2 };
  const dx = p.x - t.frameW / 2 - t.panX;
  const dy = p.y - t.frameH / 2 - t.panY;
  // Rotate back, then unscale, then uncentre.
  const rx = dx * Math.cos(-rad) - dy * Math.sin(-rad);
  const ry = dx * Math.sin(-rad) + dy * Math.cos(-rad);
  return { ix: rx / s + t.naturalW / 2, iy: ry / s + t.naturalH / 2 };
}

/**
 * Metres-per-canvas-pixel from two photo-anchored calibration points and the real distance
 * between them. Projected through the CURRENT transform — the same transform the export
 * bakes — so this stays true no matter what the farmer did to the photo after tapping.
 * Returns null when the inputs cannot produce a meaningful scale.
 */
export function calibratedMPerPx(
  t: PhotoTransform,
  a: PhotoPoint,
  b: PhotoPoint,
  trueMetres: number,
): number | null {
  if (!Number.isFinite(trueMetres) || trueMetres <= 0) return null;
  const ca = photoToCanvas(t, a);
  const cb = photoToCanvas(t, b);
  const d = Math.hypot(ca.x - cb.x, ca.y - cb.y);
  // Under ~1px between the points is a double-tap, not a measurement.
  if (!Number.isFinite(d) || d <= 1) return null;
  const m = trueMetres / d;
  return Number.isFinite(m) && m > 0 ? m : null;
}

/**
 * How the farmer's photo is placed over the satellite AFTER it was imported: the in-place
 * refinement, not the import transform above.
 *
 * Translation and rotation only, and deliberately so. mPerPx came from the farmer's own
 * two-point calibration on these pixels, and every area, spacing and yield on the plan is
 * derived from it — so a scale handle here would silently restate all of them. Rotation is
 * safe in a way scale is not: turning an image does not change how many metres a pixel is
 * worth, so a farmer can square their drone shot to the satellite without touching a single
 * measurement.
 */
export interface BaseAlignment {
  dx?: number;
  dy?: number;
  rotationDeg?: number;
  /** Size multiplier on how large the photo is DRAWN. Unlike the others this one is a genuine
   *  scale correction, so the frame's metres-per-pixel is derived from it — see customBaseMPerPx
   *  in lib/design-canvas.ts, which is the only place that fold happens. */
  scale?: number;
}

/** The alignment resolved into paintable numbers, in frame pixels. */
export interface ResolvedBaseAlign {
  tx: number;
  ty: number;
  rad: number;
  /** Rotation/scale centre — the frame's middle, so turning or resizing the photo doesn't also
   *  walk it sideways. */
  cx: number;
  cy: number;
  rotationDeg: number;
  scale: number;
}

/**
 * ROTATION IS NOT COVER-SCALED, on purpose. Turning an image inside a fixed frame exposes its
 * corners, and the obvious reflex — scale up until it covers again — is exactly the forbidden
 * operation: it would change metres-per-pixel, and every number on the plan with it. The
 * corners are left to show the satellite underlay through, which is honest (that IS what is
 * under there) and self-limiting, since the angles that square a drone shot to a satellite tile
 * are a few degrees.
 */
export function resolveBaseAlign(
  align: BaseAlignment | null | undefined,
  frameW: number,
  frameH: number,
): ResolvedBaseAlign {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const rotationDeg = num(align?.rotationDeg);
  const rawScale = align?.scale;
  const scale = typeof rawScale === 'number' && Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
  return {
    tx: num(align?.dx) * frameW,
    ty: num(align?.dy) * frameH,
    rad: (rotationDeg * Math.PI) / 180,
    cx: frameW / 2,
    cy: frameH / 2,
    rotationDeg,
    scale,
  };
}

/**
 * Carry an EXISTING calibrated scale through a re-adjustment, without re-measuring.
 *
 * When the aligner reopens on the previously-baked photo (natural size == frame size, so the
 * load transform has coverScale exactly 1), the stored mPerPx describes that bake verbatim.
 * If the farmer then zooms or rotates before re-baking, every photo feature's pixel span
 * changes by coverScale(current)/1 — so the metres each canvas pixel is worth changes by the
 * inverse. Pan only moves the crop and changes nothing.
 *
 * This is what lets "Adjust photo" round-trip losslessly: reopen, touch nothing, re-apply →
 * the exact same mPerPx comes back out.
 */
export function carriedMPerPx(storedMPerPx: number, current: PhotoTransform): number | null {
  if (!Number.isFinite(storedMPerPx) || storedMPerPx <= 0) return null;
  const s = coverScale(current);
  if (!Number.isFinite(s) || s <= 0) return null;
  const m = storedMPerPx / s;
  return Number.isFinite(m) && m > 0 ? m : null;
}
