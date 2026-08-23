// Mini plans — a site's own geometry, drawn small.
//
// WHY THIS EXISTS. The crop-plan site picker used to be a stack of identical
// text rows ("Untitled design · 6 beds · saved 3 Aug 2026"). Two designs of the
// same farm, or two farms with six beds each, were indistinguishable — the
// farmer had to open one to find out which it was. But the picker already holds
// every site's full geometry in memory: the Design Studio canvases are read
// from localStorage to count their beds at all, and the cloud rows carry their
// items in the row itself. Nothing here fetches anything. The thumbnail is the
// data that was already there, drawn instead of counted.
//
// This module is PURE and knows nothing about React, storage or SVG attributes:
// it turns a saved design into a list of positioned shapes in output pixels,
// and the caller paints them. That is what makes it testable without a DOM.
//
// It is a THUMBNAIL, not a plan sheet. It carries no labels, no scale bar and
// no legend, and it must never be printed or measured off — lib/crop-row-
// cartography.ts and the report renderer are the authorities for a drawing a
// farmer acts on. What this owes the farmer is recognition: "that one, the long
// strip of beds along the top", in a glance.

import type { DesignCanvasState, GroundFeatureKind } from '@/lib/design-canvas';
import type { FacilitatorDesignState, FacItem } from '@/lib/facilitator-design';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { BED_DEF_IDS, canvasMetreExtent } from '@/lib/design-beds-bridge';

/** Output box, in px. A 8:5 plate — wide enough for a strip of beds to read as a strip. */
export const MINI_W = 320;
export const MINI_H = 200;
/** Breathing room inside the plate, as a fraction of the SHORT side. */
export const MINI_PAD = 0.08;
/**
 * Ceiling on the fit scale, px per metre.
 *
 * Without it, every plate fills its box and a single 1.2 x 3 m keyhole bed draws
 * exactly as large as a quarter-hectare of maize — the plates stop being
 * comparable at the very moment the farmer is comparing them. With it, anything
 * at or under ~11 m across is drawn at a shared scale and a small site LOOKS
 * small; larger sites still shrink to fit, so nothing is ever cropped.
 */
export const MINI_MAX_PX_PER_M = 26;

/**
 * The five inks. Deliberately few: a thumbnail that distinguishes twenty
 * element types is a diagram, and a diagram at 320 px is mud.
 *  - bed       the plantable beds — the SUBJECT of a crop plan, drawn on top
 *  - plot      staple plots (maize/beans/pumpkin ground) — hatched, not filled
 *  - canopy    trees and other shade-casters, drawn UNDER the beds as soft discs
 *  - structure house, shed, paving, driveway — the quiet ground the farm sits on
 *  - water     tanks, ponds, dams
 */
export type MiniPaint = 'bed' | 'plot' | 'canopy' | 'structure' | 'water';

/** Draw order — index in this array IS the painting order (first = furthest back). */
const PAINT_ORDER: readonly MiniPaint[] = ['structure', 'canopy', 'water', 'plot', 'bed'];

export interface MiniRect {
  kind: 'rect' | 'ellipse';
  paint: MiniPaint;
  /** Centre, in output px. */
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** Clockwise degrees about the centre. Meaningless for ellipses whose w === h. */
  rot: number;
}

export interface MiniPoly {
  kind: 'poly';
  paint: MiniPaint;
  points: Array<[number, number]>;
}

export type MiniShape = MiniRect | MiniPoly;

export interface MiniPlan {
  width: number;
  height: number;
  /** Already in draw order — paint them in array order and the layering is right. */
  shapes: MiniShape[];
  /** How many of the shapes are beds / staple plots — for the caption beside the plate. */
  bedCount: number;
  plotCount: number;
  /**
   * Longest side of the FRAMED ground, in metres — the plate's own sense of scale.
   * That is the growing area (see fit()), not the whole property. Null when the
   * geometry gave no usable extent.
   */
  spanM: number | null;
}

// ── internal: metre-space shapes before they are fitted ──────────────────────

interface MetreRect { kind: 'rect' | 'ellipse'; paint: MiniPaint; cx: number; cy: number; w: number; h: number; rot: number }
interface MetrePoly { kind: 'poly'; paint: MiniPaint; points: Array<[number, number]> }
type MetreShape = MetreRect | MetrePoly;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Ground features → ink. `lawn`, `cleared`, `boundary` and `terrace_bank` are
 * deliberately absent: they are the SITE, not things on it, and at thumbnail
 * size a filled lawn ring is a grey blob that hides the beds inside it. A
 * `veg_garden` or `orchard` ring is likewise omitted — the beds and trees drawn
 * inside it already say so, and its outline would double every one of them.
 */
const FEATURE_PAINT: Partial<Record<GroundFeatureKind, MiniPaint>> = {
  staple_garden: 'plot',
  house: 'structure',
  patio: 'structure',
  driveway: 'structure',
};

/** Corners of a rotated rectangle, in the same units as the inputs. */
function rectCorners(cx: number, cy: number, w: number, h: number, rotDeg: number): Array<[number, number]> {
  const r = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const hw = w / 2;
  const hh = h / 2;
  return ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] as Array<[number, number]>).map(
    ([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos] as [number, number],
  );
}

/**
 * Fit metre-space shapes into the output box: uniform scale (never stretched —
 * a squashed plan is a lie about the ground), centred, capped at
 * MINI_MAX_PX_PER_M. Returns null when there is nothing with real extent to draw.
 *
 * THE FRAME IS THE GROWING AREA, not everything on the site. A rainwater tank at
 * the far corner of a plot would otherwise set the bounding box and shrink the
 * beds — the subject of a crop plan — to specks in the middle of it. So beds and
 * staple plots choose the frame and the context ink is simply allowed to run off
 * the edge, which the viewBox clips and which reads like a cropped survey plate.
 * A design with no beds or plots at all (an orchard, say) falls back to framing
 * on everything, because then there is no subject to prefer.
 */
function fit(shapes: MetreShape[], bedCount: number, plotCount: number): MiniPlan | null {
  if (shapes.length === 0) return null;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const note = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const subject = shapes.filter((s) => s.paint === 'bed' || s.paint === 'plot');
  for (const s of (subject.length > 0 ? subject : shapes)) {
    if (s.kind === 'poly') {
      for (const [x, y] of s.points) note(x, y);
    } else {
      // The ROTATED corners, so a bed turned 45° is never clipped by its own plate.
      for (const [x, y] of rectCorners(s.cx, s.cy, s.w, s.h, s.rot)) note(x, y);
    }
  }
  if (!finite(minX) || !finite(minY) || !finite(maxX) || !finite(maxY)) return null;

  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const span = Math.max(spanX, spanY);
  if (!(span > 0)) return null;

  const pad = MINI_PAD * Math.min(MINI_W, MINI_H);
  const innerW = MINI_W - 2 * pad;
  const innerH = MINI_H - 2 * pad;
  // A zero-width run of beds (one row, all in a line) must not divide by zero.
  const scale = Math.min(
    spanX > 0 ? innerW / spanX : Infinity,
    spanY > 0 ? innerH / spanY : Infinity,
    MINI_MAX_PX_PER_M,
  );
  if (!finite(scale) || !(scale > 0)) return null;

  const drawnW = spanX * scale;
  const drawnH = spanY * scale;
  const offX = (MINI_W - drawnW) / 2 - minX * scale;
  const offY = (MINI_H - drawnH) / 2 - minY * scale;
  const px = (x: number) => x * scale + offX;
  const py = (y: number) => y * scale + offY;

  const ordered = [...shapes].sort((a, b) => PAINT_ORDER.indexOf(a.paint) - PAINT_ORDER.indexOf(b.paint));
  const out: MiniShape[] = ordered.map((s) =>
    s.kind === 'poly'
      ? { kind: 'poly', paint: s.paint, points: s.points.map(([x, y]) => [px(x), py(y)] as [number, number]) }
      : { kind: s.kind, paint: s.paint, cx: px(s.cx), cy: py(s.cy), w: s.w * scale, h: s.h * scale, rot: s.rot },
  );

  return { width: MINI_W, height: MINI_H, shapes: out, bedCount, plotCount, spanM: Math.round(span * 10) / 10 };
}

// ── Design Studio canvases ──────────────────────────────────────────────────

/**
 * A Design Studio canvas → its mini plan. Null when the canvas is missing, has
 * no scale to speak of, or holds nothing drawable.
 *
 * Positions come from the item's normalised centre through canvasMetreExtent —
 * the SAME projection lib/design-beds-bridge measures bed areas with, imported
 * rather than re-derived so a plate can never disagree with the bed list beside it.
 */
export function miniPlanFromCanvas(state: DesignCanvasState | null): MiniPlan | null {
  if (!state) return null;
  let wMetres: number, hMetres: number;
  try {
    ({ wMetres, hMetres } = canvasMetreExtent(state));
  } catch {
    return null;
  }
  if (!(wMetres > 0) || !(hMetres > 0)) return null;

  const shapes: MetreShape[] = [];
  let bedCount = 0;
  let plotCount = 0;

  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) continue;
    const isBed = (BED_DEF_IDS as readonly string[]).includes(item.defId);
    let paint: MiniPaint | null = null;
    if (isBed) paint = 'bed';
    else if (def.castsShade && (def.category === 'growing' || def.category === 'earthworks')) paint = 'canopy';
    else if (def.category === 'water') paint = 'water';
    else if (def.category === 'structure') paint = 'structure';
    if (!paint) continue;

    const wM = finite(item.wM) ? item.wM : def.wM;
    const hM = finite(item.hM) ? item.hM : def.hM;
    if (!(wM > 0) || !(hM > 0)) continue;
    if (!finite(item.x) || !finite(item.y)) continue;

    if (paint === 'bed') bedCount += 1;
    shapes.push({
      kind: def.shape === 'circle' ? 'ellipse' : 'rect',
      paint,
      cx: item.x * wMetres,
      cy: item.y * hMetres,
      w: wM,
      h: hM,
      // Circles are rotation-invariant and their stored rot is noise; beds keep theirs,
      // which is the whole reason a row of angled beds reads as angled on the plate.
      rot: def.shape === 'circle' ? 0 : (finite(item.rot) ? item.rot : 0),
    });
  }

  for (const zone of state.zones) {
    const paint = zone.feature ? FEATURE_PAINT[zone.feature] : undefined;
    if (!paint) continue;
    if (!Array.isArray(zone.points) || zone.points.length < 3) continue;
    const points = zone.points
      .filter((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]))
      .map(([x, y]) => [x * wMetres, y * hMetres] as [number, number]);
    if (points.length < 3) continue;
    if (paint === 'plot') plotCount += 1;
    shapes.push({ kind: 'poly', paint, points });
  }

  return fit(shapes, bedCount, plotCount);
}

// ── legacy cloud (facilitator) designs ──────────────────────────────────────

const FAC_PAINT: Partial<Record<FacItem['type'], MiniPaint>> = {
  bed: 'bed',
  hugel: 'bed',
  tank: 'water',
  pond: 'water',
  well: 'water',
  reedbed: 'water',
  tree: 'canopy',
  banana: 'canopy',
  foodforest: 'canopy',
  shrub: 'canopy',
  coop: 'structure',
  compost: 'structure',
  greenhouse: 'structure',
  tunnel: 'structure',
  shed: 'structure',
  nursery: 'structure',
};

/** Facilitator elements drawn as discs rather than boxes — matches the print sheet. */
const FAC_ROUND = new Set<FacItem['type']>(['tank', 'pond', 'well', 'tree', 'banana', 'foodforest', 'shrub']);

/**
 * A saved cloud (facilitator canvas) design → its mini plan.
 *
 * Positions follow app/facilitator/print/page.tsx's own itemM(): metre fields
 * when present, else stage px ÷ pxPerM. The two frames differ by a constant
 * offset (the background rect), which a bounding-box fit cancels — but ONLY if
 * every item is read in the same frame, so a design where some items carry
 * metres and some do not is read entirely in px. Mixing them would scatter the
 * beds across the plate by the width of the background image.
 */
export function miniPlanFromFacilitator(state: FacilitatorDesignState | null): MiniPlan | null {
  if (!state || !Array.isArray(state.items)) return null;
  const pxPerM = finite(state.pxPerM) && state.pxPerM > 0 ? state.pxPerM : 0;
  const items = state.items.filter((it) => it && FAC_PAINT[it.type]);
  if (items.length === 0) return null;
  const allMetres = items.every((it) => finite(it.xM) && finite(it.yM));
  if (!allMetres && !pxPerM) return null;

  const shapes: MetreShape[] = [];
  let bedCount = 0;
  for (const it of items) {
    const paint = FAC_PAINT[it.type]!;
    const cx = allMetres ? it.xM! : it.x / pxPerM;
    const cy = allMetres ? it.yM! : it.y / pxPerM;
    if (!finite(cx) || !finite(cy)) continue;
    const w = finite(it.wM) && it.wM > 0 ? it.wM : 1;
    const h = finite(it.hM) && it.hM > 0 ? it.hM : 1;
    const round = FAC_ROUND.has(it.type);
    if (paint === 'bed') bedCount += 1;
    shapes.push({
      kind: round ? 'ellipse' : 'rect',
      paint,
      cx,
      cy,
      w,
      h,
      rot: round ? 0 : (finite(it.rotation) ? it.rotation : 0),
    });
  }

  return fit(shapes, bedCount, 0);
}
