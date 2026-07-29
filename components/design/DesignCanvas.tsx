'use client';

// Design Studio — pure, presentational true-scale canvas.
//
// Renders the satellite underlay + reference outlines (boundary/house/driveway traced
// from the farmer's map), zone polygons, lines (swales/fences/paths/pipes/drip/
// windbreaks), and placed elements at TRUE real-world scale (metres → viewBox px via
// frame.mPerPx). Owns no persistence — the parent supplies `state` and receives changes
// via `onChange`. Pointer-event driven (phone-first); the clientToViewBox conversion
// mirrors HybridRender.tsx's touch-up overlay pattern.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, CopyCheck } from 'lucide-react';
import type { CanvasFrame, DesignCanvasState, DetectSuggestion, GroundFeatureKind, LineShape, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { newId, groundFillPolys, nearestPointOnRing, normaliseRotation } from '@/lib/design-canvas';
import { layoutCanvasLabels, estimatePillWidth, isUsableCanvasLabelInput } from '@/lib/canvas-labels';
import { ownedByCurrentStep } from '@/lib/glossy-filters';
import { rectFromCorners, anyVertexInRect, itemCenterInRect, clampGroupDelta, type Rect } from '@/lib/marquee';
import { ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_DEFS, type ElementCategory } from '@/lib/design-elements';
import type { DesignLayerType } from '@/lib/design-studio';
import { computeContourLines } from '@/lib/contours';
import { deriveSectorModel, type SectorSite } from '@/lib/sector';
import { isValidEarthLatitude } from '@/lib/solar';
import { effectivePrevailingWind, regionalPrevailingPick } from '@/lib/local-wind';
import { WATER_ROUTE_STYLE, type WaterRouteKind } from '@/lib/water-cartography';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';
import SectorOverlay from './SectorOverlay';

type ToolKind = 'select' | 'place' | 'zone' | 'line';

// Diagonal hatch fill for zone/ground-feature polygons — reproduces the subtle diagonal
// hatch the farmer map uses for traced parcels (components/Map.tsx LAND_PALETTE/
// WATER_PALETTE raster sprites) as an SVG <pattern> instead, so a designed zone in the
// Studio reads as the same kind of shape as a traced parcel on the map. One pattern per
// catalog colour, defined once in a single <defs> block below — never regenerated
// per-render/per-frame. Only the fill value changes at call sites; colour, fillOpacity,
// stroke and all selection/edit affordances are untouched.
function hatchPatternId(color: string): string {
  return `hatch-${color.replace('#', '')}`;
}
function hatchFill(color: string): string {
  return `url(#${hatchPatternId(color)})`;
}
// ZONE_DEFS + GROUND_FEATURES are both static catalogs, so their colour set is fixed at
// module load — compute it once here rather than per-render.
const HATCH_COLORS: string[] = Array.from(
  new Set([
    ...Object.values(ZONE_DEFS).map((d) => d.color),
    ...Object.values(GROUND_FEATURES).map((f) => f.color),
  ])
);

// A shape NOT owned by the current wizard step (see ownedByCurrentStep) still renders — the
// farmer needs the boundary visible while placing zones — but reads as quiet background
// context rather than a live, editable thing. Not near-invisible: it must still orient you.
const LOCKED_OPACITY = 0.42;

// A shape the farmer already traced on the live map, classified + projected to this
// frame's normalised [0..1] coords by the parent (app/design/page.tsx, via the shared
// project()). Rendered as a visible, tappable "traced" reference so nothing has to be
// re-drawn — one tap adopts it into an editable design object. `featureId` is the
// back-link stamped onto the adopted shape's sourceFeatureId (Phase 1 of ONE-SURFACE-PLAN).
export interface TracedLayer {
  featureId: string;
  name: string;
  layerType: DesignLayerType;
  color: string;
  render: 'polygon' | 'line';
  points: Array<[number, number]>;
}

// Adopted design shapes carry a sourceFeatureId back-link. The canonical shape types live
// in lib/design-canvas.ts (out of scope to edit for Phase 1), so the link rides as an
// extra optional field — structurally assignable to the base type and preserved verbatim
// through JSON persistence and migrateStateToFrame's spreads.
type WithSource<T> = T & { sourceFeatureId?: string };

function readSourceFeatureId(shape: unknown): string | undefined {
  return (shape as { sourceFeatureId?: string }).sourceFeatureId;
}

interface ActiveLayers {
  water: boolean;
  earthworks: boolean; // land-shaping: raised beds, basins, banana circles, berms, terraces
  zones: boolean;
  planting: boolean;
  structures: boolean;
  access: boolean; // paths/gates/driveway only
  animals: boolean;
  ground: boolean; // farmer-drawn ground areas (house/patio/lawn/veg/orchard/cleared)
  baseMap: boolean; // satellite reference underlay (boundary + auto-detected roof/driveway/…)
  labels: boolean; // the text name pills on every feature — off = declutter the map
  symbols: boolean; // centred item icon discs — off = cleaner dense drafting view
  contours: boolean; // approximate on-contour guide lines (from slope + aspect)
  sector: boolean; // sun/wind/fire/water/frost energies overlay (from lib/sector, deterministic)
}

interface RefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
}

export interface DesignCanvasProps {
  frame: CanvasFrame;
  state: DesignCanvasState;
  onChange: (next: DesignCanvasState) => void;
  tool: ToolKind;
  placeDefId: string | null;
  zoneDraw: 0 | 1 | 2 | 3 | 4 | 5;
  // When set, the armed zone tool draws a labelled GROUND FEATURE (house/patio/…) instead
  // of a permaculture effort-zone — stamped onto the committed ring's optional `feature`.
  areaFeature?: GroundFeatureKind | null;
  lineKind: LineShape['kind'];
  activeLayers: ActiveLayers;
  // Quick in-canvas toggle of the base-map layer (the top-left eye). Optional so the canvas
  // still renders if a caller doesn't wire it.
  onToggleBaseMap?: () => void;
  // Quick in-canvas toggle of the Sector energies overlay (the top-left ☀️ button) — the
  // discoverable twin of the "Sector energies" entry in the Layers popover.
  onToggleSector?: () => void;
  // Slope + aspect (from lib/elevation) → the approximate on-contour guide lines.
  slopeDeg?: number;
  aspectDeg?: number;
  // Full site context (slope + climate) + latitude → the deterministic Sector energies overlay
  // (lib/sector.deriveSectorModel). Same object app/design/page.tsx feeds the glossy sheet.
  sectorSite?: SectorSite | null;
  lat?: number;
  refLayers: RefLayers;
  selectedId: string | null; // the SINGLE selection (edit/resize/rotate handles); null if 0 or >1
  selectedIds: string[]; // every selected id (highlight rings + group delete)
  onSelect: (id: string | null, additive?: boolean) => void;
  // Drag-rectangle multi-select ("marquee") release: every id the rect caught (see
  // collectMarqueeSelection below). additive=true (Shift/Cmd held) ADDS to the existing
  // selection; additive=false (the multiSelectMode path — phones have no Shift) REPLACES it.
  onSelectMany: (ids: string[], additive: boolean) => void;
  // Touch multi-select: when on, a plain tap ADDS to the selection (phones have no Shift/Cmd
  // key). The toggle button + the desktop Shift/Cmd+tap both feed the same additive path.
  additiveSelect?: boolean;
  onToggleAdditive?: () => void;
  suggestions?: DetectSuggestion[];
  onEditItem?: (id: string) => void;
  // Called with 'select' right after a zone/line is committed, so the very next tap on
  // the shape you just drew selects it instead of being swallowed by the still-armed
  // draw tool. Left unset, tool stays whatever the palette last chose (unchanged today).
  onToolChange?: (t: ToolKind) => void;
  // Everything the farmer traced on the live map (except the boundary, which stays the
  // fence reference), pre-projected to this frame. Tapping one offers "Use in design",
  // which adopts it into an editable shape — the trace-then-redraw killer.
  tracedLayers?: TracedLayer[];
  // Tidy outline (lib/tidy-outline.ts) PREVIEW — set by the parent (app/design/page.tsx) once the
  // farmer taps the palette's Tidy button on a single selected zone/line. Drawn as a DISTINCT
  // ghost overlay ON TOP of the shape's normal (unchanged) rendering — this canvas never rewrites
  // state.zones/state.lines itself; committing happens only via onConfirmTidy, through the
  // parent's own onChange/undo path, exactly like every other edit. null = no preview showing.
  tidyPreview?: {
    kind: 'zone' | 'line';
    tidiedPoints: Array<[number, number]>; // lib/tidy-outline.ts TidyOutlineResult.points
    summary: string; // plain-language copy — see lib/tidy-outline.ts's tidyOutlineSummary
    canConfirm: boolean; // false when tidying would change nothing — Confirm is hidden
  } | null;
  onConfirmTidy?: () => void;
  onCancelTidy?: () => void;
  // Batch Snap PREVIEW — one candidate ring per safe member of the selected ring group. Vetoed
  // members remain in their normal, unchanged rendering and are named in `summary`; this canvas
  // never rewrites state.zones itself. null = no preview showing.
  snapPreview?: {
    rings: Array<{ id: string; points: Array<[number, number]> }>;
    summary: string; // plain-language copy — see lib/bulk-snap-edges.ts
    canConfirm: boolean; // false when snapping would change nothing — Confirm is hidden
  } | null;
  onConfirmSnap?: () => void;
  onCancelSnap?: () => void;
  // Clean up (lib/align-items.ts) PREVIEW — set by the parent (app/design/page.tsx) once the
  // farmer taps the palette's Clean up button on a MULTI-selection of 2+ placed items. Same
  // distinct-ghost-overlay-on-top-of-unchanged-rendering idiom as tidyPreview/snapPreview above —
  // this canvas never rewrites state.items itself; committing happens only via onConfirmCleanup,
  // through the parent's own onChange/undo path, exactly like every other edit. `items` deliberately
  // carries only id/x/y/rot (lib/align-items.ts's AlignedItem — the return type physically cannot
  // carry wM/hM/defId/label), so this canvas looks each one up in `state.items` by id for the size/
  // shape/colour a ghost footprint needs to draw, the same def lookup the real item-rendering loop
  // below already does. null = no preview showing.
  cleanupPreview?: {
    items: Array<{ id: string; x: number; y: number; rot?: number }>; // lib/align-items.ts AlignItemsResult.items
    summary: string; // plain-language copy — see lib/align-items.ts's alignAndDistributeSummary
    canConfirm: boolean; // false when cleaning up would change nothing — Confirm is hidden
  } | null;
  onConfirmCleanup?: () => void;
  onCancelCleanup?: () => void;
}

const GOLD = '#F7C97E';
const CYAN = '#22D3EE';
// A hue used ONLY for the Tidy outline preview ghost — deliberately distinct from GOLD
// (selection highlight) and CYAN (edit-handle chrome) so a farmer can never mistake "this is what
// tidying would produce" for "this is currently selected".
const TIDY_PREVIEW = '#FF6EC7';
// A hue used ONLY for the Snap-to-neighbour preview ghost — distinct from GOLD (selection), CYAN
// (edit-handle chrome), and TIDY_PREVIEW (the OTHER previewed geometry action) so a farmer can
// never confuse "this is what snapping would produce" with either of those.
const SNAP_PREVIEW = '#5EC8F2';
// A hue used ONLY for the Clean up preview ghost — distinct from GOLD (selection), CYAN
// (edit-handle chrome), TIDY_PREVIEW and SNAP_PREVIEW (the two OTHER previewed geometry actions)
// so a farmer can never confuse "this is what cleaning up would produce" with any of those.
const CLEANUP_PREVIEW = '#B98CE0';
const SCALE_STEPS_M = [5, 10, 20, 50, 100, 200] as const;
// Same bone-white as DesignGlossy.tsx's BOUNDARY_BONE — the property boundary is a real
// post-and-wire farm fence, never green, so it never reads as a row of plants (that
// confusion was half the reason the old ticked-line convention had to go).
const BOUNDARY_BONE = '#EDE7D9';

function ringToPx(ring: Array<[number, number]>, imgW: number, imgH: number): string {
  return ring.map(([x, y]) => `${(x * imgW).toFixed(1)},${(y * imgH).toFixed(1)}`).join(' ');
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// category → activeLayers key (see docs/DESIGN-TAXONOMY.md). Typed to ElementCategory with NO
// default case on purpose: a new category must be a compile error here. The old `string` +
// `default: return null` form meant an unmapped category silently returned null, and a null key
// skips the gate at the call site — the element would render even with its layer switched off.
function categoryLayerKey(category: ElementCategory): keyof ActiveLayers {
  switch (category) {
    case 'water':
      return 'water';
    case 'earthworks':
      return 'earthworks';
    case 'growing':
      return 'planting';
    case 'structure':
      return 'structures';
    case 'animal':
      return 'animals';
    case 'access':
      return 'access';
  }
}

// Each line kind shows/hides with its FUNCTIONAL layer — so a drip line drawn on the Water step is
// visible when Water is on, instead of vanishing behind a separate generic "Lines" toggle (Rory:
// "I added drip lines but Lines is a separate layer, not connected to Water"). A Record so adding
// a line kind is a compile error here, not a silent fall-through.
const LINE_LAYER: Record<LineShape['kind'], keyof ActiveLayers> = {
  swale: 'water',
  pipe: 'water',
  drip: 'water',
  greywater: 'water',
  fence: 'structures',
  path: 'access',
  windbreak: 'planting',
};

// Default on-canvas label per line kind (LineShape.name overrides). No LineShape kind had ANY
// on-canvas name label before — ground-feature rings got a draggable pill (see the zones render
// loop below) but lines had no equivalent, which is what "there's no label for swales" (and every
// other line kind) actually was. Strings match DesignGlossy.tsx's LINE_NAME map exactly — that is
// what the OUTPUT SHEETS already call each kind, and the canvas must agree with the sheets.
const LINE_KIND_LABEL: Record<LineShape['kind'], string> = {
  swale: 'Swale',
  fence: 'Fence line',
  path: 'Walking path',
  pipe: 'Buried water pipe',
  drip: 'Drip irrigation line',
  windbreak: 'Windbreak hedge',
  greywater: 'Greywater line',
};

const WATER_ROUTE_KINDS = new Set<string>(['swale', 'pipe', 'drip', 'greywater']);

function lineStroke(kind: LineShape['kind']): { stroke: string; width: number; dash?: string; opacity?: number } {
  // Water route COLOUR is sourced from lib/water-cartography.ts's WATER_ROUTE_STYLE — the same
  // constant the exact/exported sheets use — so editor and export can never independently drift
  // apart on what a swale/pipe/drip/greywater line is coloured (found live, editing here: swale
  // was #4EA6D8 while every exported sheet drew it #258DBA, a second hardcoded copy that had
  // quietly gone out of sync with the export path this codebase already treats as authoritative).
  // Width/dash stay editor-specific on purpose — screen pixels at an arbitrary zoom aren't the same
  // unit as the export's metres-per-pixel scale, and a dashed editor line reads better against a
  // busy canvas than the solid export line does on a printed sheet.
  if (WATER_ROUTE_KINDS.has(kind)) {
    const style = WATER_ROUTE_STYLE[kind as WaterRouteKind];
    switch (kind) {
      case 'swale':
        return { stroke: style.color, width: 3, dash: '6 4' };
      case 'pipe':
        return { stroke: style.color, width: 2.4 };
      case 'drip':
        return { stroke: style.color, width: 1.5, dash: '2 3' };
      case 'greywater':
      default:
        return { stroke: style.color, width: 2.1, dash: '5 3' };
    }
  }
  switch (kind) {
    case 'fence':
      // Dusty violet — the one hue not used by boundary-green / zones / water / paths, and the
      // CAD convention for fencing. Rendered as a SOLID line + round posts (fencePosts), NOT the
      // perpendicular ticks the property BOUNDARY uses, so the two can never be confused.
      return { stroke: '#8E7CC3', width: 2 };
    case 'path':
      return { stroke: '#E8D9B8', width: 2.5, dash: '4 5' };
    case 'windbreak':
      return { stroke: '#2F7A4A', width: 6, opacity: 0.5 };
    default:
      return { stroke: '#8C8577', width: 2 };
  }
}

function polylinePoints(points: Array<[number, number]>, imgW: number, imgH: number): string {
  return points.map(([x, y]) => `${(x * imgW).toFixed(1)},${(y * imgH).toFixed(1)}`).join(' ');
}

// Post-and-wire fence posts: round dots ON the line at a clamped spacing (never fuse at zoom),
// including both endpoints. Returns [cx,cy] pairs in px. The standard plan symbol for a fence,
// and — unlike ticks — unmistakable from the property boundary in colour AND greyscale print.
function fencePosts(points: Array<[number, number]>, imgW: number, imgH: number, spacing = 22): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (points.length < 2) return out;
  out.push([points[0][0] * imgW, points[0][1] * imgH]);
  for (let i = 0; i < points.length - 1; i++) {
    const ax = points[i][0] * imgW, ay = points[i][1] * imgH;
    const bx = points[i + 1][0] * imgW, by = points[i + 1][1] * imgH;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const n = Math.max(1, Math.round(len / spacing));
    for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]);
  }
  return out;
}

function fenceTicks(points: Array<[number, number]>, imgW: number, imgH: number, spacing = 18, half = 5): string {
  let d = '';
  for (let i = 0; i < points.length - 1; i++) {
    const [ax0, ay0] = points[i];
    const [bx0, by0] = points[i + 1];
    const ax = ax0 * imgW;
    const ay = ay0 * imgH;
    const bx = bx0 * imgW;
    const by = by0 * imgH;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const n = Math.max(1, Math.round(len / spacing));
    const px = -dy / len;
    const py = dx / len;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const cx = ax + dx * t;
      const cy = ay + dy * t;
      d += `M${(cx - px * half).toFixed(1)},${(cy - py * half).toFixed(1)} L${(cx + px * half).toFixed(1)},${(cy + py * half).toFixed(1)} `;
    }
  }
  return d.trim();
}

function ringCentroid(points: Array<[number, number]>): [number, number] {
  if (points.length === 0) return [0.5, 0.5];
  const sum = points.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y] as [number, number], [0, 0] as [number, number]);
  return [sum[0] / points.length, sum[1] / points.length];
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Post-and-wire boundary posts — ported from DesignGlossy.tsx's drawBlueprintBoundary so the
// live editing canvas draws the SAME fence convention that ships on the output sheets: a post
// ON every corner (each ring vertex is exactly one edge's start point here, so a shared corner
// between two edges can never get double-posted), then more evenly spaced along each run.
// `pts` are already in px, a closed ring (no repeated first point).
function boundaryFencePosts(pts: Array<[number, number]>, step: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    for (let t = 0; t < len; t += step) {
      out.push([x1 + dx * (t / len), y1 + dy * (t / len)]);
    }
  }
  return out;
}

// Signature of the boundary ring identity — used to key the auto-fit effect so it only
// re-runs when the boundary actually changes (point count + rounded coords), not on
// every render.
function boundarySignature(ring: Array<[number, number]>): string {
  return ring.map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join('|');
}

// Pick the largest of the standard step lengths whose pixel span fits within a quarter
// of the image width, so the scale bar reads cleanly at any zoom.
function pickScaleBarM(imgW: number, mPerPx: number): number {
  const maxPx = imgW / 4;
  let chosen: number = SCALE_STEPS_M[0];
  for (const m of SCALE_STEPS_M) {
    if (m / mPerPx <= maxPx) chosen = m;
  }
  return chosen;
}

// Every featureId already adopted into the design (scanned across items/zones/lines), so a
// traced layer is never adopted twice.
function adoptedFeatureIds(state: DesignCanvasState): Set<string> {
  const ids = new Set<string>();
  for (const s of [...state.items, ...state.zones, ...state.lines]) {
    const src = readSourceFeatureId(s);
    if (src) ids.add(src);
  }
  return ids;
}

// Normalised-ring bbox → centre + metre extents, for turning a traced water/roof polygon
// into a true-scale placed item (matches page.tsx's ringBboxM clamping).
function normBboxM(
  points: Array<[number, number]>,
  frame: Pick<CanvasFrame, 'imgW' | 'imgH' | 'mPerPx'>,
): { cx: number; cy: number; wM: number; hM: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const wM = Math.min(40, Math.max(1, (maxX - minX) * frame.imgW * frame.mPerPx));
  const hM = Math.min(40, Math.max(1, (maxY - minY) * frame.imgH * frame.mPerPx));
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, wM, hM };
}

// Converts a traced layer into the matching design object and returns the next state, or
// null when there's nothing to do (already adopted / degenerate geometry / boundary). The
// geometry is already normalised, so it drops straight into the normalised shape model.
function adoptTracedLayer(
  state: DesignCanvasState,
  frame: CanvasFrame,
  layer: TracedLayer,
): DesignCanvasState | null {
  if (layer.layerType === 'property_boundary') return null;
  if (adoptedFeatureIds(state).has(layer.featureId)) return null;
  const src = layer.featureId;

  const addZone = (zone: ZoneShape['zone'], feature?: GroundFeatureKind): DesignCanvasState | null => {
    if (layer.points.length < 3) return null;
    const shape: WithSource<ZoneShape> = {
      id: newId(),
      zone,
      points: layer.points,
      sourceFeatureId: src,
      ...(feature ? { feature } : {}),
    };
    return { ...state, zones: [...state.zones, shape] };
  };
  const addItem = (defId: string): DesignCanvasState | null => {
    if (layer.points.length < 3) return null;
    const { cx, cy, wM, hM } = normBboxM(layer.points, frame);
    const isCircle = ELEMENTS_BY_ID[defId]?.shape === 'circle';
    const item: WithSource<PlacedItem> = {
      id: newId(),
      defId,
      x: cx,
      y: cy,
      wM: isCircle ? Math.max(wM, hM) : wM,
      hM: isCircle ? Math.max(wM, hM) : hM,
      sourceFeatureId: src,
    };
    return { ...state, items: [...state.items, item] };
  };

  switch (layer.layerType) {
    // A traced cultivation/tree-belt/roof outline is more faithfully adopted as the matching
    // ground FEATURE (filled, labelled) than as a bare effort-zone or a generic shed item.
    case 'cultivation':
      return addZone(2, 'veg_garden');
    case 'unknown':
      return addZone(2);
    case 'tree_belt':
      return addZone(3, 'orchard');
    case 'water_body':
      return addItem('pond_small');
    case 'roof':
    case 'structure':
      return addZone(0, 'house');
    case 'access': {
      // A traced access AREA (a paved driveway polygon — layer.render === 'polygon', see the
      // isAccessArea fix in app/design/page.tsx) adopts as the driveway ground feature so it
      // reaches every sheet that reads a ZoneShape 'driveway' ring. Without this the Studio could
      // only ever produce a walking-path LINE for 'access', and could never originate a driveway
      // (docs/RENDER-INVESTIGATION-2026-07-20.md, studio-only). Genuine polylines (gates, tracks)
      // still adopt as a path exactly as before.
      if (layer.render === 'polygon') return addZone(1, 'driveway');
      if (layer.points.length < 2) return null;
      const line: WithSource<LineShape> = { id: newId(), kind: 'path', points: layer.points, sourceFeatureId: src };
      return { ...state, lines: [...state.lines, line] };
    }
    default:
      return null;
  }
}

export default function DesignCanvas({
  frame,
  state,
  onChange,
  tool,
  placeDefId,
  zoneDraw,
  areaFeature,
  lineKind,
  activeLayers,
  onToggleBaseMap,
  onToggleSector,
  slopeDeg,
  aspectDeg,
  sectorSite,
  lat,
  refLayers,
  selectedId,
  selectedIds,
  additiveSelect,
  onToggleAdditive,
  onSelect,
  onSelectMany,
  suggestions,
  onEditItem,
  onToolChange,
  tracedLayers,
  tidyPreview,
  onConfirmTidy,
  onCancelTidy,
  snapPreview,
  onConfirmSnap,
  onCancelSnap,
  cleanupPreview,
  onConfirmCleanup,
  onCancelCleanup,
}: DesignCanvasProps) {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const { imgW, imgH, mPerPx, satDataUrl } = frame;

  // Which traced layer is currently tapped (shows its "Use in design" affordance).
  const [activeTracedId, setActiveTracedId] = useState<string | null>(null);


  // Zoom/pan view transform — world-space (viewBox px) is drawn inside a single
  // <g transform="translate(tx ty) scale(k)">; fixed overlays (north arrow, scale bar,
  // zoom controls, Finish/Point buttons) stay outside it.
  const [view, setView] = useState<{ k: number; tx: number; ty: number }>({ k: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;

  // Rendered CSS size of the svg (NOT the same as window size — chrome above/below the
  // canvas, see app/design/page.tsx's palette, can leave it narrower/shorter than the viewport).
  // Tracked via ResizeObserver so it updates on rotation/resize, not just mount. BOTH dimensions,
  // not just width: the svg fills its container with preserveAspectRatio="meet" (letterboxed
  // whenever the container aspect ratio isn't imgW/imgH), and vbFromClient/onWheel/panning above
  // already account for that with Math.min(rect.width/imgW, rect.height/imgH) — width alone
  // under-scales (making hit targets and dots smaller than intended, never larger) whenever the
  // container is height-bound rather than width-bound, e.g. many desktop layouts or a portrait
  // site photo (adversarial review of the step-locking feature, 2026-07-21).
  const [containerPx, setContainerPx] = useState(0);
  const [containerHeightPx, setContainerHeightPx] = useState(0);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width) setContainerPx(rect.width);
      if (rect?.height) setContainerHeightPx(rect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // In-progress draw state for zone/line tools.
  const [draftPoints, setDraftPoints] = useState<Array<[number, number]>>([]);
  // Drag state for moving an existing item.
  const dragItemId = useRef<string | null>(null);
  // Local preview position while dragging — committed to onChange once on release so a
  // drag emits a single undo entry instead of one per pointermove (see endDragItem).
  const [dragPos, setDragPos] = useState<[number, number] | null>(null);

  // Vertex-drag state for editing a selected zone/line's points. Same local-preview /
  // commit-on-release pattern as item drag — only the dragged vertex previews locally,
  // the rest of the ring/line stays as committed state until pointerup.
  const dragVertex = useRef<{ shapeId: string; kind: 'zone' | 'line'; index: number } | null>(null);
  const [vertexPos, setVertexPos] = useState<[number, number] | null>(null);

  // Resize-handle drag state for a selected item. Local preview (wM/hM) committed once
  // on release via onChange, same single-undo pattern as move/vertex drags. `mode` picks which
  // handle: 'both' = corner (uniform), 'w' = breadth only, 'h' = length only.
  const dragResizeId = useRef<string | null>(null);
  const dragResizeMode = useRef<'both' | 'w' | 'h'>('both');
  const [resizePreview, setResizePreview] = useState<{ wM: number; hM: number } | null>(null);

  // Rotate-handle drag state for a selected rect item (strips/beds/rows). Same local-preview-
  // then-commit-on-release pattern as resize. Degrees clockwise; snaps to 5° for steadiness.
  const dragRotateId = useRef<string | null>(null);
  const [rotPreview, setRotPreview] = useState<number | null>(null);

  // Whole-shape (zone/line) translate drag — press-and-drag the body moves every point by
  // the same delta, mirroring startDragItem's press-drag-moves-the-whole-thing pattern.
  // originPoints is snapshotted at drag start so the delta is always relative to the
  // pre-drag shape, not the (already-translated) preview from the previous pointermove.
  const dragShape = useRef<{ id: string; kind: 'zone' | 'line'; originPoints: Array<[number, number]>; startWorldX: number; startWorldY: number } | null>(null);
  const [shapeDragDelta, setShapeDragDelta] = useState<[number, number] | null>(null);

  // GROUP move (marquee follow-up): a press-drag that starts on an item/zone/line already part
  // of a MULTI-selection (selectedIds.length > 1 and includes it) translates the WHOLE selection
  // together instead of just that one shape — see startDragItem/startDragShape's branch into
  // startGroupDrag below. Mirrors dragShape's snapshot-then-preview-then-commit pattern,
  // generalised to N shapes: origins are captured ONCE at drag start (never re-derived from the
  // translating preview, same reason dragShape snapshots originPoints), and only OWNED members
  // (ownedByCurrentStep) are captured — a foreign-step/boundary shape that somehow rides along in
  // selectedIds can never be translated. endGroupDrag emits exactly one onChange (one undo entry
  // for the whole group), never per-pointermove.
  const dragGroup = useRef<{
    itemOrigins: Map<string, [number, number]>;
    zoneOrigins: Map<string, Array<[number, number]>>;
    lineOrigins: Map<string, Array<[number, number]>>;
    startWorldX: number;
    startWorldY: number;
  } | null>(null);
  const [groupDragDelta, setGroupDragDelta] = useState<[number, number] | null>(null);

  // Drag-rectangle multi-select ("marquee"). Starts INSTEAD of the usual background pan when, in
  // the select tool, either a desktop Shift/Cmd/Ctrl modifier is held on pointerdown (activation
  // rule a), or multiSelectMode is on (rule b — phones have no modifier keys; multiSelectMode is
  // already the "no Shift available" substitute the touch UI uses for additive taps). Coordinates
  // are normalised [0..1] WORLD-space (clientToNorm — the same space item.x/y and zone/line
  // points already live in), so the rect can be hit-tested against state with no extra transform.
  const marqueeState = useRef<{ pointerId: number; startClientX: number; startClientY: number; additive: boolean } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  // Drag state for a zone/feature/line NAME LABEL — moves just the label (a normalised offset from
  // the shape's anchor point — ring centroid for zones, midpoint for lines), not the shape itself,
  // so a farmer can pull a label off a feature/line it overlaps. `kind` dispatches which of
  // state.zones/state.lines owns `id`, same pattern as dragShape/dragVertex above.
  const dragLabel = useRef<{ id: string; kind: 'zone' | 'line'; startWorldX: number; startWorldY: number; originDx: number; originDy: number; startClientX: number; startClientY: number; moved: boolean } | null>(null);
  const [labelDragDelta, setLabelDragDelta] = useState<[number, number] | null>(null);
  // Inline rename: tap a feature/line label (no drag) to edit its text. `editingLabelKind` says
  // which collection `editingLabelId` belongs to — lines only ever populate `editingText` (they
  // have no level/slope of their own).
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelKind, setEditingLabelKind] = useState<'zone' | 'line' | null>(null);
  const [editingText, setEditingText] = useState('');
  // Level (m) — shown for ANY feature ring — and measured slope (%) — shown only for
  // terrace_bank rings — ride the SAME inline editor as the name, per
  // docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §3/§6 ("extends the existing inline-rename
  // editor … no new modal, no new interaction paradigm"). Zones only — lines use a lighter,
  // name-only editor (see the lines render loop below), so these two never apply to a line.
  const [editingLevelText, setEditingLevelText] = useState('');
  const [editingSlopeText, setEditingSlopeText] = useState('');
  const skipLabelCommit = useRef(false); // set on Escape so the blur that follows cancels instead of saving
  // Drop a stuck editor if its shape disappears (deleted, or replaced by a remote sync).
  useEffect(() => {
    if (!editingLabelId) return;
    const stillExists =
      editingLabelKind === 'line'
        ? state.lines.some((l) => l.id === editingLabelId)
        : state.zones.some((z) => z.id === editingLabelId);
    if (!stillExists) {
      setEditingLabelId(null);
      setEditingLabelKind(null);
    }
  }, [editingLabelId, editingLabelKind, state.zones, state.lines]);

  // Drag state for a vertex of the IN-PROGRESS (not yet committed) draft shape. Unlike
  // dragVertex below, draftPoints is local-only uncommitted state, so this mutates it
  // directly on every pointermove — no preview-then-commit-on-release dance needed since
  // there's no undo-stack entry to protect yet.
  const dragDraftVertex = useRef<number | null>(null);

  // One-finger background pan. Primed on EVERY tool's background pointerdown (not just
  // 'select'): the tool-specific tap action (place/draft-point/deselect) is deferred to
  // pointerup's "didn't move past threshold" branch, so a genuine tap still does the
  // expected thing but a drag pans the map instead of drawing/placing — see runTapAction.
  const panState = useRef<{ pointerId: number; startX: number; startY: number; startTx: number; startTy: number; moved: boolean; isMiddleButton?: boolean } | null>(null);

  // Active pointers for pinch-zoom (two-pointer gesture on the svg background).
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  // Per-FRAME (not gesture-start) previous dist/midpoint, so a pure two-finger drag (no
  // distance change) still pans — anchoring the incremental zoom+translate to the last
  // frame (rather than a frozen gesture-start point) is what makes drift-while-pinching
  // and pure two-finger pan both fall out of the same formula. See handleBackgroundPointerMove.
  const pinchState = useRef<{ prevDist: number; prevMidX: number; prevMidY: number } | null>(null);

  function vbFromClient(clientX: number, clientY: number): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    // The svg fills its container with preserveAspectRatio="meet", so the rendered box
    // may be letterboxed — map through the actual drawn-image scale + offsets, not the
    // raw rect, or taps land off-target whenever the container aspect ≠ viewBox aspect.
    const scale = Math.min(rect.width / imgW, rect.height / imgH);
    const offX = (rect.width - imgW * scale) / 2;
    const offY = (rect.height - imgH * scale) / 2;
    const vx = (clientX - rect.left - offX) / scale;
    const vy = (clientY - rect.top - offY) / scale;
    return [vx, vy];
  }

  function clientToNorm(clientX: number, clientY: number): [number, number] | null {
    const vb = vbFromClient(clientX, clientY);
    if (!vb) return null;
    const { k, tx, ty } = viewRef.current;
    const wx = (vb[0] - tx) / k;
    const wy = (vb[1] - ty) / k;
    return [clamp01(wx / imgW), clamp01(wy / imgH)];
  }

  // Like clientToNorm but UNclamped and left in world-space viewBox px (not divided by
  // imgW/imgH) — needed for whole-shape drag deltas, where clamping/normalizing each
  // intermediate point would distort the shape before the final commit.
  function worldFromClient(clientX: number, clientY: number): [number, number] | null {
    const vb = vbFromClient(clientX, clientY);
    if (!vb) return null;
    const { k, tx, ty } = viewRef.current;
    return [(vb[0] - tx) / k, (vb[1] - ty) / k];
  }

  // Computes the auto-fit view for the current boundary: ≥3 points → frame its bbox to
  // ~82% of the canvas; otherwise k=1 centred (no-op translate, since the world origin
  // already sits at the canvas origin).
  function computeAutoFit(): { k: number; tx: number; ty: number } {
    if (refLayers.boundary.length >= 3) {
      const xs = refLayers.boundary.map(([x]) => x * imgW);
      const ys = refLayers.boundary.map(([, y]) => y * imgH);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const bw = Math.max(maxX - minX, 1);
      const bh = Math.max(maxY - minY, 1);
      const bcx = (minX + maxX) / 2;
      const bcy = (minY + maxY) / 2;
      const k = clamp(Math.min(imgW / bw, imgH / bh) * 0.82, 1, 5);
      return { k, tx: imgW / 2 - k * bcx, ty: imgH / 2 - k * bcy };
    }
    return { k: 1, tx: 0, ty: 0 };
  }

  // Auto-fit on load: keyed on a signature of the boundary's points so it only re-runs
  // when the boundary identity actually changes, never on every render (e.g. while
  // panning/zooming).
  const boundarySig = boundarySignature(refLayers.boundary);
  useEffect(() => {
    setView(computeAutoFit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundarySig, imgW, imgH]);

  function runAutoFit() {
    setView(computeAutoFit());
  }

  function zoomAbout(vx: number, vy: number, factor: number) {
    setView((prev) => {
      const nextK = clamp(prev.k * factor, 1, 6);
      const ratio = nextK / prev.k;
      const tx = vx - (vx - prev.tx) * ratio;
      const ty = vy - (vy - prev.ty) * ratio;
      return { k: nextK, tx, ty };
    });
  }

  // Native (non-React) wheel listener with { passive: false } — React's onWheel prop is
  // attached passively, so e.preventDefault() inside it throws and never actually stops
  // page scroll (same gotcha documented in FacilitatorCanvas.tsx's zoom effect).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Browsers report a trackpad pinch gesture as a synthetic ctrlKey=true wheel event
      // (also true for a literal Ctrl+scroll) — so ctrlKey distinguishes "pinch" from a
      // plain two-finger trackpad scroll. Tradeoff: a literal mouse's scroll wheel (no
      // ctrlKey) now PANS instead of zooming, matching the owner's "two fingers on the
      // touchpad should pan" ask; zoom is still reachable via pinch, +/-, or fit.
      if (e.ctrlKey) {
        const vb = vbFromClient(e.clientX, e.clientY);
        if (!vb) return;
        zoomAbout(vb[0], vb[1], e.deltaY < 0 ? 1.18 : 1 / 1.18);
        return;
      }
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(rect.width / imgW, rect.height / imgH);
      setView((prev) => ({ k: prev.k, tx: prev.tx - e.deltaX / scale, ty: prev.ty - e.deltaY / scale }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgW, imgH]);

  // Double-click-to-finish fires 1-2 extra pointerdowns at the tap position before the
  // dblclick handler runs, appending near-duplicate draft points right at the end. Strip
  // any trailing point(s) within ~6 viewBox px of the point before them so a double-tap
  // finish doesn't leave a stray near-duplicate vertex in the committed shape.
  function dropTrailingDuplicates(points: Array<[number, number]>): Array<[number, number]> {
    const cleaned = points.slice();
    while (cleaned.length > 1) {
      const [ax, ay] = cleaned[cleaned.length - 2];
      const [bx, by] = cleaned[cleaned.length - 1];
      const dx = (bx - ax) * imgW;
      const dy = (by - ay) * imgH;
      if (Math.hypot(dx, dy) < 6) {
        cleaned.pop();
      } else {
        break;
      }
    }
    return cleaned;
  }

  function commitZone(points: Array<[number, number]>) {
    const cleaned = dropTrailingDuplicates(points);
    if (cleaned.length < 3) return;
    // An armed area feature stamps the ring as a ground feature; otherwise it's a plain
    // permaculture effort-zone (feature omitted → today's behaviour verbatim).
    const shape: ZoneShape = { id: newId(), zone: zoneDraw, points: cleaned, ...(areaFeature ? { feature: areaFeature } : {}) };
    onChange({ ...state, zones: [...state.zones, shape] });
    setDraftPoints([]);
    // Auto-select + revert to 'select' so the very next tap (the natural "let me check
    // it" gesture right after Finish) selects/edits the shape instead of being swallowed
    // by the still-armed zone tool as a stray new draft point.
    onSelect(shape.id);
    // Only drop back to 'select' for a plain effort-zone. For a GROUND FEATURE keep the tool armed
    // so the farmer can draw patio → lawn → veg-garden in a row without landing in select mode
    // (where a tap on the traced house would adopt it as House). Sticky ground-feature drawing.
    if (!areaFeature) onToolChange?.('select');
  }

  function commitLine(points: Array<[number, number]>) {
    const cleaned = dropTrailingDuplicates(points);
    if (cleaned.length < 2) return;
    const shape: LineShape = { id: newId(), kind: lineKind, points: cleaned };
    onChange({ ...state, lines: [...state.lines, shape] });
    setDraftPoints([]);
    onSelect(shape.id);
    onToolChange?.('select');
  }

  function handleBackgroundPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // Middle mouse button always pans, regardless of tool — preventDefault stops the
    // browser's native middle-click auto-scroll cursor from taking over.
    if (e.button === 1) {
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      panState.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTx: view.tx,
        startTy: view.ty,
        moved: false,
        isMiddleButton: true,
      };
      return;
    }

    // Track every active pointer on the background for pinch-zoom, regardless of tool.
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (activePointers.current.size === 2) {
      // Entering a two-finger gesture (pinch and/or two-finger pan) — cancel any
      // in-progress one-finger pan or marquee.
      panState.current = null;
      marqueeState.current = null;
      setMarqueeRect(null);
      const pts = Array.from(activePointers.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const midClientX = (pts[0].x + pts[1].x) / 2;
      const midClientY = (pts[0].y + pts[1].y) / 2;
      const mid = vbFromClient(midClientX, midClientY);
      pinchState.current = {
        prevDist: dist,
        prevMidX: mid ? mid[0] : imgW / 2,
        prevMidY: mid ? mid[1] : imgH / 2,
      };
      return;
    }
    if (activePointers.current.size > 2) return;

    // Single-pointer marquee activation (see dragGroup/marqueeState comments above): in the
    // select tool only, a Shift/Cmd/Ctrl-held pointerdown (desktop) or ANY background drag while
    // additiveSelect (the multiSelectMode toggle, phones have no Shift) is on starts a
    // drag-rectangle instead of the usual pan. Other tools keep their existing background tap
    // behaviour (place/draft-point) completely untouched.
    if (tool === 'select' && (e.shiftKey || e.metaKey || e.ctrlKey || additiveSelect)) {
      const pt = clientToNorm(e.clientX, e.clientY);
      if (pt) {
        marqueeState.current = {
          pointerId: e.pointerId,
          startClientX: e.clientX,
          startClientY: e.clientY,
          // Shift/Cmd ADDS to the existing selection; the multiSelectMode-only path (no
          // modifier held) REPLACES it — activation rules a/b, spec'd verbatim.
          additive: Boolean(e.shiftKey || e.metaKey || e.ctrlKey),
        };
        setMarqueeRect({ x0: pt[0], y0: pt[1], x1: pt[0], y1: pt[1] });
        return;
      }
    }

    // Single-pointer: prime a potential pan for EVERY tool. The tool-specific tap action
    // (place item / append draft point / deselect) is deferred to pointerup's
    // "didn't move past threshold" branch (runTapAction) — so a clean tap still draws/
    // places/deselects exactly as before, but a drag pans instead.
    panState.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTx: view.tx,
      startTy: view.ty,
      moved: false,
    };
  }

  function runTapAction(e: React.PointerEvent<SVGSVGElement>) {
    if (tool === 'select') {
      onSelect(null);
      setActiveTracedId(null); // tapping empty canvas also dismisses a stray "Use in design" popup
      return;
    }

    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;

    if (tool === 'place' && placeDefId) {
      const def = ELEMENTS_BY_ID[placeDefId];
      if (!def) return;
      const item: PlacedItem = { id: newId(), defId: placeDefId, x: pt[0], y: pt[1] };
      onChange({ ...state, items: [...state.items, item] });
      onSelect(item.id);
      return;
    }

    if (tool === 'zone' || tool === 'line') {
      setDraftPoints((prev) => [...prev, pt]);
    }
  }

  function handleBackgroundPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinchState.current && activePointers.current.size >= 2) {
      const pts = Array.from(activePointers.current.values()).slice(0, 2);
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const midClientX = (pts[0].x + pts[1].x) / 2;
      const midClientY = (pts[0].y + pts[1].y) / 2;
      const mid = vbFromClient(midClientX, midClientY);
      if (!mid) return;
      const ps = pinchState.current;
      const prevK = viewRef.current.k;
      const scaleStep = dist / ps.prevDist;
      const nextK = clamp(prevK * scaleStep, 1, 6);
      // Re-derive the step from the (possibly clamped) k so translate stays consistent
      // with the zoom actually applied, then anchor it to the LAST frame's tx/ty/mid —
      // not the gesture-start values — so a pure two-finger drag (distance unchanged,
      // effectiveStep=1) still carries the midpoint's drift into tx/ty. Pinch-with-drift
      // and pure two-finger pan fall out of this same incremental formula.
      const effectiveStep = nextK / prevK;
      const tx = effectiveStep * (viewRef.current.tx - ps.prevMidX) + mid[0];
      const ty = effectiveStep * (viewRef.current.ty - ps.prevMidY) + mid[1];
      setView({ k: nextK, tx, ty });
      pinchState.current = { prevDist: dist, prevMidX: mid[0], prevMidY: mid[1] };
      return;
    }

    const marquee = marqueeState.current;
    if (marquee && marquee.pointerId === e.pointerId) {
      const pt = clientToNorm(e.clientX, e.clientY);
      if (pt) setMarqueeRect((prev) => (prev ? { x0: prev.x0, y0: prev.y0, x1: pt[0], y1: pt[1] } : { x0: pt[0], y0: pt[1], x1: pt[0], y1: pt[1] }));
      return;
    }

    const pan = panState.current;
    if (pan && pan.pointerId === e.pointerId) {
      const dx = e.clientX - pan.startX;
      const dy = e.clientY - pan.startY;
      if (!pan.moved && Math.hypot(dx, dy) < 6) return;
      pan.moved = true;
      // Convert client-space delta to viewBox-space delta (undo the letterbox scale).
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const scale = Math.min(rect.width / imgW, rect.height / imgH);
      setView({ k: viewRef.current.k, tx: pan.startTx + dx / scale, ty: pan.startTy + dy / scale });
    }
  }

  // Every CURRENT-STEP-OWNED shape the marquee rect caught: an item if its centre is inside, a
  // zone/line if ANY vertex is inside (see lib/marquee.ts for why the two rules differ). Reuses
  // ownedByCurrentStep — the exact same predicate startDragItem/startDragShape already gate on —
  // so a foreign-step shape can never be marquee-selected. Precision note (adversarial review):
  // the boundary ring, like every ground feature, IS owned on the Base step where the farmer
  // traces it — marquee/group-move there matches how single-shape drag has always behaved — and
  // it is untouchable from every other step.
  function collectMarqueeSelection(rect: Rect): string[] {
    const ids: string[] = [];
    for (const it of state.items) {
      const def = ELEMENTS_BY_ID[it.defId];
      if (!def || !ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: it.defId })) continue;
      if (itemCenterInRect(it.x, it.y, rect)) ids.push(it.id);
    }
    for (const z of state.zones) {
      if (!ownedByCurrentStep(state.step, { kind: 'zone', feature: z.feature })) continue;
      if (anyVertexInRect(z.points, rect)) ids.push(z.id);
    }
    for (const l of state.lines) {
      if (!ownedByCurrentStep(state.step, { kind: 'line', lineKind: l.kind })) continue;
      if (anyVertexInRect(l.points, rect)) ids.push(l.id);
    }
    return ids;
  }

  function handleBackgroundPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;

    const marquee = marqueeState.current;
    if (marquee && marquee.pointerId === e.pointerId) {
      marqueeState.current = null;
      const rect = marqueeRect;
      setMarqueeRect(null);
      const draggedPx = Math.hypot(e.clientX - marquee.startClientX, e.clientY - marquee.startClientY);
      // A sub-4px drag is treated as the normal background tap it would have been without the
      // modifier/multiSelectMode — no accidental empty marquees from a slightly-jittery tap.
      if (rect && draggedPx >= 4) {
        onSelectMany(collectMarqueeSelection(rectFromCorners([rect.x0, rect.y0], [rect.x1, rect.y1])), marquee.additive);
        return;
      }
      runTapAction(e);
      return;
    }

    const pan = panState.current;
    if (pan && pan.pointerId === e.pointerId) {
      panState.current = null;
      if (pan.moved || pan.isMiddleButton) return; // a drag (or explicit middle-mouse pan) — no tool action
      runTapAction(e);
    }
  }

  // A gesture interrupted by the OS/browser (app-switch, alert, etc.) fires
  // pointercancel, not pointerup — clear every live drag/pan/pinch ref WITHOUT
  // committing a partial edit, so an interrupted gesture can't leave state half-moved
  // or a ref permanently "stuck" armed.
  function handleBackgroundPointerCancel(e: React.PointerEvent<SVGSVGElement>) {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) pinchState.current = null;
    if (panState.current?.pointerId === e.pointerId) panState.current = null;
    marqueeState.current = null;
    setMarqueeRect(null);
    dragItemId.current = null;
    setDragPos(null);
    dragVertex.current = null;
    setVertexPos(null);
    dragResizeId.current = null;
    setResizePreview(null);
    dragShape.current = null;
    setShapeDragDelta(null);
    dragGroup.current = null;
    setGroupDragDelta(null);
    dragLabel.current = null;
    setLabelDragDelta(null);
    dragDraftVertex.current = null;
  }

  function handleBackgroundDoubleClick() {
    if (tool === 'zone') commitZone(draftPoints);
    if (tool === 'line') commitLine(draftPoints);
  }

  function startDragItem(e: React.PointerEvent, id: string) {
    if (tool !== 'select') return;
    const item = state.items.find((it) => it.id === id);
    const def = item && ELEMENTS_BY_ID[item.defId];
    // Not owned by the step we're currently on (e.g. a Water-step tank while drawing Zones) —
    // inert. Bail BEFORE stopPropagation/onSelect so the tap falls through to whatever the
    // current step's own background/draw handler would have done with it.
    if (!item || !def || !ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: item.defId })) return;
    e.stopPropagation();
    const additive = additiveSelect || e.shiftKey || e.metaKey || e.ctrlKey;
    // A press-drag starting on a shape that's ALREADY part of a multi-selection moves the WHOLE
    // selection together (see dragGroup above) instead of the usual "replace selection with just
    // this one" tap behaviour — checked against the selectedIds this render already has, i.e.
    // BEFORE any onSelect call below can change it. Additive (Shift/Cmd) taps always toggle
    // membership first, exactly as today, and never start any drag — group or single.
    if (!additive && selectedIds.length > 1 && selectedIds.includes(id)) {
      startGroupDrag(e, selectedIds);
      return;
    }
    onSelect(id, additive);
    if (additive) return; // toggle membership — no drag, no handles.
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragItemId.current = id;
  }

  function moveDragItem(e: React.PointerEvent) {
    const id = dragItemId.current;
    if (!id) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;
    setDragPos(pt);
  }

  function endDragItem() {
    const id = dragItemId.current;
    if (id && dragPos) {
      onChange({
        ...state,
        items: state.items.map((it) => (it.id === id ? { ...it, x: dragPos[0], y: dragPos[1] } : it)),
      });
    }
    dragItemId.current = null;
    setDragPos(null);
  }

  function startDragVertex(e: React.PointerEvent, shapeId: string, kind: 'zone' | 'line', index: number) {
    if (tool !== 'select') return;
    // See startDragItem — a vertex belonging to a shape from another step (the boundary,
    // traced on Base, while the farmer is on Zones) must not grab; the exact bug this guards.
    if (kind === 'zone') {
      const z = state.zones.find((zz) => zz.id === shapeId);
      if (!z || !ownedByCurrentStep(state.step, { kind: 'zone', feature: z.feature })) return;
    } else {
      const l = state.lines.find((ll) => ll.id === shapeId);
      if (!l || !ownedByCurrentStep(state.step, { kind: 'line', lineKind: l.kind })) return;
    }
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragVertex.current = { shapeId, kind, index };
  }

  function moveDragVertex(e: React.PointerEvent) {
    if (!dragVertex.current) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;
    setVertexPos(pt);
  }

  function endDragVertex() {
    const dv = dragVertex.current;
    if (dv && vertexPos) {
      if (dv.kind === 'zone') {
        onChange({
          ...state,
          zones: state.zones.map((z) =>
            z.id === dv.shapeId
              ? { ...z, points: z.points.map((p, i) => (i === dv.index ? vertexPos : p)) }
              : z,
          ),
        });
      } else {
        onChange({
          ...state,
          lines: state.lines.map((l) =>
            l.id === dv.shapeId
              ? { ...l, points: l.points.map((p, i) => (i === dv.index ? vertexPos : p)) }
              : l,
          ),
        });
      }
    }
    dragVertex.current = null;
    setVertexPos(null);
  }

  // Whole-shape (zone/line) translate drag: press-and-drag the body moves every point by
  // the same delta in one gesture — mirroring startDragItem's press-drag-moves pattern,
  // which zones/lines previously lacked entirely (only single-vertex drag existed).
  function startDragShape(e: React.PointerEvent, id: string, kind: 'zone' | 'line') {
    if (tool !== 'select') return;
    const shape = kind === 'zone' ? state.zones.find((z) => z.id === id) : state.lines.find((l) => l.id === id);
    if (!shape) return;
    // Foreign-step shape (see startDragItem) — no select, no drag; let the tap fall through.
    const owned =
      kind === 'zone'
        ? ownedByCurrentStep(state.step, { kind: 'zone', feature: (shape as ZoneShape).feature })
        : ownedByCurrentStep(state.step, { kind: 'line', lineKind: (shape as LineShape).kind });
    if (!owned) return;
    e.stopPropagation();
    const additive = additiveSelect || e.shiftKey || e.metaKey || e.ctrlKey;
    // See startDragItem — same group-move branch, generalised to zones/lines.
    if (!additive && selectedIds.length > 1 && selectedIds.includes(id)) {
      startGroupDrag(e, selectedIds);
      return;
    }
    onSelect(id, additive);
    if (additive) return; // toggle membership — no drag.
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    dragShape.current = { id, kind, originPoints: shape.points, startWorldX: w[0], startWorldY: w[1] };
  }

  // Snapshots the CURRENT positions of every OWNED member of `ids` (ownedByCurrentStep — a
  // foreign-step/boundary shape that somehow rides along in selectedIds is excluded, never
  // translated) as the group's drag origin — captured ONCE, exactly like dragShape.originPoints,
  // so the delta stays relative to the pre-drag layout rather than an already-translated preview.
  function startGroupDrag(e: React.PointerEvent, ids: string[]) {
    const idSet = new Set(ids);
    const itemOrigins = new Map<string, [number, number]>();
    const zoneOrigins = new Map<string, Array<[number, number]>>();
    const lineOrigins = new Map<string, Array<[number, number]>>();
    for (const it of state.items) {
      if (!idSet.has(it.id)) continue;
      const def = ELEMENTS_BY_ID[it.defId];
      if (def && ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: it.defId })) {
        itemOrigins.set(it.id, [it.x, it.y]);
      }
    }
    for (const z of state.zones) {
      if (idSet.has(z.id) && ownedByCurrentStep(state.step, { kind: 'zone', feature: z.feature })) {
        zoneOrigins.set(z.id, z.points);
      }
    }
    for (const l of state.lines) {
      if (idSet.has(l.id) && ownedByCurrentStep(state.step, { kind: 'line', lineKind: l.kind })) {
        lineOrigins.set(l.id, l.points);
      }
    }
    if (itemOrigins.size + zoneOrigins.size + lineOrigins.size === 0) return; // nothing owned to move
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragGroup.current = { itemOrigins, zoneOrigins, lineOrigins, startWorldX: w[0], startWorldY: w[1] };
  }

  function moveGroupDrag(e: React.PointerEvent) {
    const dg = dragGroup.current;
    if (!dg) return;
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    // Unclamped raw delta, same reasoning as moveDragShape — the clamp is applied once, uniformly,
    // at render time and again on commit (see clampGroupDelta), never per-point mid-drag.
    setGroupDragDelta([(w[0] - dg.startWorldX) / imgW, (w[1] - dg.startWorldY) / imgH]);
  }

  function collectGroupPoints(g: NonNullable<typeof dragGroup.current>): Array<[number, number]> {
    const pts: Array<[number, number]> = [];
    g.itemOrigins.forEach((p) => pts.push(p));
    g.zoneOrigins.forEach((ps) => pts.push(...ps));
    g.lineOrigins.forEach((ps) => pts.push(...ps));
    return pts;
  }

  function endGroupDrag() {
    const dg = dragGroup.current;
    if (dg && groupDragDelta) {
      // ONE clamp for the whole group (never per-point — see lib/marquee.ts clampGroupDelta) so
      // the group moves rigidly: if any member would leave [0,1], every member is held back by
      // the same amount rather than each independently snapping to the edge.
      const [dx, dy] = clampGroupDelta(collectGroupPoints(dg), groupDragDelta[0], groupDragDelta[1]);
      onChange({
        ...state,
        items: state.items.map((it) => {
          const origin = dg.itemOrigins.get(it.id);
          return origin ? { ...it, x: clamp01(origin[0] + dx), y: clamp01(origin[1] + dy) } : it;
        }),
        zones: state.zones.map((z) => {
          const origin = dg.zoneOrigins.get(z.id);
          return origin ? { ...z, points: origin.map(([x, y]) => [clamp01(x + dx), clamp01(y + dy)] as [number, number]) } : z;
        }),
        lines: state.lines.map((l) => {
          const origin = dg.lineOrigins.get(l.id);
          return origin ? { ...l, points: origin.map(([x, y]) => [clamp01(x + dx), clamp01(y + dy)] as [number, number]) } : l;
        }),
      });
    }
    dragGroup.current = null;
    setGroupDragDelta(null);
  }

  function moveDragShape(e: React.PointerEvent) {
    const ds = dragShape.current;
    if (!ds) return;
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    // Normalized-space delta, not yet clamped per-point — clamping mid-drag would distort
    // the shape if one vertex reaches the [0..1] edge before the others.
    setShapeDragDelta([(w[0] - ds.startWorldX) / imgW, (w[1] - ds.startWorldY) / imgH]);
  }

  function endDragShape() {
    const ds = dragShape.current;
    if (ds && shapeDragDelta) {
      const [dx, dy] = shapeDragDelta;
      const translated = ds.originPoints.map(([x, y]) => [clamp01(x + dx), clamp01(y + dy)] as [number, number]);
      if (ds.kind === 'zone') {
        onChange({ ...state, zones: state.zones.map((z) => (z.id === ds.id ? { ...z, points: translated } : z)) });
      } else {
        onChange({ ...state, lines: state.lines.map((l) => (l.id === ds.id ? { ...l, points: translated } : l)) });
      }
    }
    dragShape.current = null;
    setShapeDragDelta(null);
  }

  // Drag a zone/feature/line's NAME LABEL independently of its shape. Press the label and drag:
  // the label moves by a normalised offset (stored on the shape as labelDx/labelDy), the shape
  // stays put. A tap (no move) still selects the shape. Mirrors the shape-drag preview→commit.
  // `kind` dispatches between state.zones and state.lines — same pattern as startDragShape.
  function startDragLabel(e: React.PointerEvent, id: string, kind: 'zone' | 'line' = 'zone') {
    if (tool !== 'select') return;
    const shape = kind === 'zone' ? state.zones.find((z) => z.id === id) : state.lines.find((l) => l.id === id);
    if (!shape) return;
    const owned =
      kind === 'zone'
        ? ownedByCurrentStep(state.step, { kind: 'zone', feature: (shape as ZoneShape).feature })
        : ownedByCurrentStep(state.step, { kind: 'line', lineKind: (shape as LineShape).kind });
    if (!owned) return;
    e.stopPropagation();
    onSelect(id, additiveSelect || e.shiftKey || e.metaKey || e.ctrlKey);
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragLabel.current = { id, kind, startWorldX: w[0], startWorldY: w[1], originDx: shape.labelDx ?? 0, originDy: shape.labelDy ?? 0, startClientX: e.clientX, startClientY: e.clientY, moved: false };
  }

  function moveDragLabel(e: React.PointerEvent) {
    const dl = dragLabel.current;
    if (!dl) return;
    const w = worldFromClient(e.clientX, e.clientY);
    if (!w) return;
    // Tap-vs-drag is decided in CLIENT pixels (6px, matching the pan threshold) so it's stable
    // across zoom/letterbox — a normalized-space threshold is ~3px on a phone (below finger jitter).
    if (!dl.moved && Math.hypot(e.clientX - dl.startClientX, e.clientY - dl.startClientY) > 6) dl.moved = true;
    setLabelDragDelta([(w[0] - dl.startWorldX) / imgW, (w[1] - dl.startWorldY) / imgH]);
  }

  function endDragLabel() {
    const dl = dragLabel.current;
    if (dl) {
      if (dl.moved && labelDragDelta) {
        // Real drag → commit the new label offset.
        const ndx = dl.originDx + labelDragDelta[0];
        const ndy = dl.originDy + labelDragDelta[1];
        if (dl.kind === 'zone') {
          onChange({ ...state, zones: state.zones.map((z) => (z.id === dl.id ? { ...z, labelDx: ndx, labelDy: ndy } : z)) });
        } else {
          onChange({ ...state, lines: state.lines.map((l) => (l.id === dl.id ? { ...l, labelDx: ndx, labelDy: ndy } : l)) });
        }
      } else if (dl.kind === 'zone') {
        // Tapped (no real move) → open the inline rename (features only — they carry text labels).
        const shape = state.zones.find((z) => z.id === dl.id);
        if (shape?.feature) {
          setEditingText(shape.name ?? GROUND_FEATURES[shape.feature].label);
          setEditingLevelText(shape.levelM != null ? String(shape.levelM) : '');
          setEditingSlopeText(shape.measuredSlopePct != null ? String(shape.measuredSlopePct) : '');
          setEditingLabelId(dl.id);
          setEditingLabelKind('zone');
        }
      } else {
        // Tapped a line's label → open the (lighter, name-only) inline rename.
        const shape = state.lines.find((l) => l.id === dl.id);
        if (shape) {
          setEditingText(shape.name ?? LINE_KIND_LABEL[shape.kind]);
          setEditingLabelId(dl.id);
          setEditingLabelKind('line');
        }
      }
    }
    dragLabel.current = null;
    setLabelDragDelta(null);
  }

  function commitLabelEdit(id: string, kind: 'zone' | 'line' = 'zone') {
    setEditingLabelId(null);
    setEditingLabelKind(null);
    if (kind === 'line') {
      const shape = state.lines.find((l) => l.id === id);
      if (!shape) return;
      const typed = editingText.trim();
      const defaultLabel = LINE_KIND_LABEL[shape.kind];
      // Empty, or unchanged from the default, → store no custom name (falls back to the default).
      const nextName = typed && typed !== defaultLabel ? typed : undefined;
      if ((nextName ?? '') === (shape.name ?? '')) return; // no-op — skip a spurious undo entry
      onChange({ ...state, lines: state.lines.map((l) => (l.id === id ? { ...l, name: nextName } : l)) });
      return;
    }
    const shape = state.zones.find((z) => z.id === id);
    if (!shape) return;
    const typed = editingText.trim();
    const defaultLabel = shape.feature ? GROUND_FEATURES[shape.feature].label : '';
    // Empty, or unchanged from the default, → store no custom name (falls back to the default).
    const nextName = typed && typed !== defaultLabel ? typed : undefined;

    // Level (m) — any feature. Blank clears it; a non-finite typed value (a stray "-" or letters
    // mid-edit) is IGNORED rather than written, so a half-typed number never clobbers a real one.
    const levelTyped = editingLevelText.trim();
    const nextLevelM = levelTyped === '' ? undefined : Number(levelTyped);
    const levelValid = nextLevelM === undefined || Number.isFinite(nextLevelM);

    // Slope here (%) — terrace_bank rings only (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §3).
    const slopeTyped = editingSlopeText.trim();
    const nextSlopePct = slopeTyped === '' ? undefined : Number(slopeTyped);
    const slopeValid = nextSlopePct === undefined || Number.isFinite(nextSlopePct);
    const slopeApplies = shape.feature === 'terrace_bank';

    const nameChanged = (nextName ?? '') !== (shape.name ?? '');
    const levelChanged = levelValid && nextLevelM !== shape.levelM;
    const slopeChanged = slopeApplies && slopeValid && nextSlopePct !== shape.measuredSlopePct;

    // No actual change → don't write (avoids a spurious undo entry + sync-timestamp bump on a no-op tap).
    if (!nameChanged && !levelChanged && !slopeChanged) return;
    onChange({
      ...state,
      zones: state.zones.map((z) => {
        if (z.id !== id) return z;
        return {
          ...z,
          name: nextName,
          levelM: levelValid ? nextLevelM : z.levelM,
          measuredSlopePct: slopeApplies ? (slopeValid ? nextSlopePct : z.measuredSlopePct) : z.measuredSlopePct,
        };
      }),
    });
  }

  // Vertex drag for the IN-PROGRESS draft shape (mid-draw) — the owner's explicit ask:
  // "if i hover over a point it should be selectable to move even if i haven't completed
  // putting the polygon". draftPoints is local/uncommitted, so this writes through
  // directly on every move rather than the preview-then-commit-on-release pattern used
  // for already-committed shapes above (there's no undo entry to protect yet).
  function startDragDraftVertex(e: React.PointerEvent, index: number) {
    if (tool !== 'zone' && tool !== 'line') return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragDraftVertex.current = index;
  }

  function moveDragDraftVertex(e: React.PointerEvent) {
    const idx = dragDraftVertex.current;
    if (idx === null) return;
    const pt = clientToNorm(e.clientX, e.clientY);
    if (!pt) return;
    setDraftPoints((prev) => prev.map((p, i) => (i === idx ? pt : p)));
  }

  function endDragDraftVertex() {
    dragDraftVertex.current = null;
  }

  function startDragResize(e: React.PointerEvent, id: string, mode: 'both' | 'w' | 'h' = 'both') {
    if (tool !== 'select') return;
    const item = state.items.find((it) => it.id === id);
    const def = item && ELEMENTS_BY_ID[item.defId];
    if (!item || !def || !ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: item.defId })) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragResizeId.current = id;
    dragResizeMode.current = mode;
  }

  function moveDragResize(e: React.PointerEvent) {
    const id = dragResizeId.current;
    if (!id) return;
    const item = state.items.find((it) => it.id === id);
    const def = item && ELEMENTS_BY_ID[item.defId];
    if (!item || !def) return;
    const wM = item.wM ?? def.wM;
    const hM = item.hM ?? def.hM;
    // Item coords are world-space (unscaled viewBox px, inside the <g transform>) — the
    // pointer must be converted through the same inverse view transform as clientToNorm,
    // not compared against raw screen-space viewBox px, or resize drifts while zoomed.
    const centreWorld: [number, number] = [item.x * imgW, item.y * imgH];
    const vb = vbFromClient(e.clientX, e.clientY);
    if (!vb) return;
    const { k, tx, ty } = viewRef.current;
    const pointerWorld: [number, number] = [(vb[0] - tx) / k, (vb[1] - ty) / k];
    const dx = pointerWorld[0] - centreWorld[0];
    const dy = pointerWorld[1] - centreWorld[1];
    const mode = dragResizeMode.current;
    if (def.shape === 'circle' || mode === 'both') {
      // Uniform (corner / circle) — radial distance drives an aspect-locked scale.
      const distM = Math.hypot(dx, dy) * mPerPx;
      const newWM = clamp(2 * distM, 0.3, 40);
      const newHM = hM * (newWM / wM);
      setResizePreview({ wM: newWM, hM: def.shape === 'circle' ? newWM : newHM });
      return;
    }
    // Per-axis (edge handle): project the pointer onto the item's LOCAL axes so breadth/length
    // stay correct even when the item is rotated. rot is clockwise degrees (0 for circles).
    const rot = ((item.rot ?? 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const localX = dx * cos + dy * sin; // along the item's width axis
    const localY = -dx * sin + dy * cos; // along the item's length axis
    if (mode === 'w') {
      setResizePreview({ wM: clamp(2 * Math.abs(localX) * mPerPx, 0.3, 40), hM });
    } else {
      setResizePreview({ wM, hM: clamp(2 * Math.abs(localY) * mPerPx, 0.3, 40) });
    }
  }

  function endDragResize() {
    const id = dragResizeId.current;
    if (id && resizePreview) {
      onChange({
        ...state,
        items: state.items.map((it) => (it.id === id ? { ...it, wM: resizePreview.wM, hM: resizePreview.hM } : it)),
      });
    }
    dragResizeId.current = null;
    setResizePreview(null);
  }

  function startDragRotate(e: React.PointerEvent, id: string) {
    if (tool !== 'select') return;
    const item = state.items.find((it) => it.id === id);
    const def = item && ELEMENTS_BY_ID[item.defId];
    if (!item || !def || !ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: item.defId })) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRotateId.current = id;
  }

  function moveDragRotate(e: React.PointerEvent) {
    const id = dragRotateId.current;
    if (!id) return;
    const item = state.items.find((it) => it.id === id);
    if (!item) return;
    // Convert the pointer into the same world space as the item centre (see moveDragResize),
    // then take the bearing from centre → pointer. 0° points "up" (north) so the handle,
    // which sits at the strip's top edge, tracks the finger. Snap to 5° for a steady feel.
    const centreWorld: [number, number] = [item.x * imgW, item.y * imgH];
    const vb = vbFromClient(e.clientX, e.clientY);
    if (!vb) return;
    const { k, tx, ty } = viewRef.current;
    const pointerWorld: [number, number] = [(vb[0] - tx) / k, (vb[1] - ty) / k];
    const dx = pointerWorld[0] - centreWorld[0];
    const dy = pointerWorld[1] - centreWorld[1];
    if (Math.hypot(dx, dy) < 1) return;
    const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 = up, clockwise
    const snapped = Math.round(deg / 5) * 5;
    setRotPreview(((snapped % 360) + 360) % 360);
  }

  function endDragRotate() {
    const id = dragRotateId.current;
    if (id && rotPreview !== null) {
      const rot = normaliseRotation(rotPreview);
      onChange({
        ...state,
        items: state.items.map((it) => (it.id === id ? { ...it, rot } : it)),
      });
    }
    dragRotateId.current = null;
    setRotPreview(null);
  }

  // Add a vertex at the midpoint of edge `afterIndex → afterIndex+1` of a committed shape —
  // the owner's "add another corner" need, which only existed for in-progress drafts before.
  // Emits one onChange (= one undo entry), same commit pattern as endDragVertex.
  function insertZoneVertex(id: string, afterIndex: number) {
    onChange({
      ...state,
      zones: state.zones.map((z) => {
        if (z.id !== id) return z;
        const pts = z.points.slice();
        const a = pts[afterIndex];
        const b = pts[(afterIndex + 1) % pts.length];
        if (!a || !b) return z;
        pts.splice(afterIndex + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        return { ...z, points: pts };
      }),
    });
  }

  // Remove a single vertex — guarded so a zone ring never drops below 3 points (a polygon).
  function removeZoneVertex(id: string, index: number) {
    onChange({
      ...state,
      zones: state.zones.map((z) =>
        z.id === id && z.points.length > 3 ? { ...z, points: z.points.filter((_, i) => i !== index) } : z,
      ),
    });
  }

  function insertLineVertex(id: string, afterIndex: number) {
    onChange({
      ...state,
      lines: state.lines.map((l) => {
        if (l.id !== id) return l;
        const pts = l.points.slice();
        const a = pts[afterIndex];
        const b = pts[afterIndex + 1];
        if (!a || !b) return l;
        pts.splice(afterIndex + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
        return { ...l, points: pts };
      }),
    });
  }

  // A line needs at least 2 points to remain a line.
  function removeLineVertex(id: string, index: number) {
    onChange({
      ...state,
      lines: state.lines.map((l) =>
        l.id === id && l.points.length > 2 ? { ...l, points: l.points.filter((_, i) => i !== index) } : l,
      ),
    });
  }

  function deleteItem(id: string) {
    onChange({ ...state, items: state.items.filter((it) => it.id !== id) });
    if (selectedId === id) onSelect(null);
  }

  function deleteZone(id: string) {
    onChange({ ...state, zones: state.zones.filter((z) => z.id !== id) });
    if (selectedId === id) onSelect(null);
  }

  function deleteLine(id: string) {
    onChange({ ...state, lines: state.lines.filter((l) => l.id !== id) });
    if (selectedId === id) onSelect(null);
  }

  const adoptedIds = adoptedFeatureIds(state);

  // Reference-layer (boundary + traced/adopted underlay) visibility, derived from the toggle.
  // 'hidden' drops them from the tree entirely (so they neither clutter nor interact);
  // 'dimmed' fades them to a faint context layer; 'shown' is today's full-strength render.
  // Base-map reference (boundary + auto-detected/traced underlay) is shown/hidden by the
  // "Base map" layer toggle now — one consistent control alongside every other layer.
  const refShown = activeLayers.baseMap;
  const refOpacityFactor = 1;

  // Approximate on-contour guide lines (parallel, perpendicular to the slope). Cheap to compute
  // and only used when the Contours layer is on. Missing data is distinct from genuinely flat
  // ground so the UI never labels an unanalysed site as flat.
  const contours = useMemo(
    () =>
      slopeDeg != null && aspectDeg != null && refLayers.boundary.length >= 3
        ? computeContourLines(slopeDeg, aspectDeg, refLayers.boundary, mPerPx, imgW, imgH)
        : { lines: [], intervalM: 0, tooFlat: false, status: 'unavailable' as const },
    [slopeDeg, aspectDeg, refLayers.boundary, mPerPx, imgW, imgH],
  );

  // Sector energies model — pure derivation from the site's real slope + climate (lib/sector).
  // Null until we have a latitude (hemisphere is undecidable without it); the overlay + its note
  // chip both gate on this. Cheap, but memoised so it doesn't re-derive on every pan/zoom render.
  const sectorModel = useMemo(
    () => (lat != null && isValidEarthLatitude(lat) ? deriveSectorModel(sectorSite ?? null, lat) : null),
    [sectorSite, lat],
  );

  // Farmer's on-site wind confirmation, surfaced as an honest note alongside the sector data-notes
  // chip below — NOT baked into sectorModel.namedWind/fire themselves, which stay exactly what
  // lib/regional-wind.ts asserts (SECTOR-MODEL-SPEC requires the regional table to keep reading as
  // a regional assumption; see docs/ACTIVE-MAP-QUALITY-TASKS.md "02 Sector analysis"). This is a
  // SEPARATE, additive fact — "here's what the farmer told us, on top of the unchanged regional
  // table" — resolved through effectivePrevailingWind (lib/local-wind.ts), the one function every
  // consumer of the confirm/override workflow must route through. When there is no observation yet
  // the existing dataNotes chip already covers the honest-degradation case, so this only ever
  // ADDS a note, never removes the caveat a farmer hasn't answered yet.
  const effectiveWindNote = useMemo(() => {
    if (!sectorModel || !state.localWind) return null;
    const regional = regionalPrevailingPick(sectorModel.namedWind);
    const effective = effectivePrevailingWind(state.localWind, regional);
    if (!effective || effective.provenance !== 'observed on site') return null;
    const recorded = new Date(state.localWind.recordedAt);
    const when = Number.isFinite(recorded.getTime()) ? recorded.toLocaleDateString() : null;
    return `✓ Wind confirmed on site: ${effective.fromLabel}${when ? ` (recorded ${when})` : ''}`;
  }, [sectorModel, state.localWind]);

  // GROUND LABEL DE-COLLISION. Ground features nest, so their centroids sit almost on top of each
  // other — "Property boundary", "Lawn" and "House" traced one inside the next all land within a
  // few pixels, which is exactly the pile Rory reported. layoutCanvasLabels is the same engine that
  // de-collides the plant pills; here it only produces a VERTICAL offset per ring, which the render
  // adds to the centroid. A farmer who has dragged a label keeps full control: labelMovedByUser
  // short-circuits the auto offset entirely rather than fighting it.
  const labelMovedByUser = useCallback(
    (z: ZoneShape) => Math.abs(z.labelDx ?? 0) > 0.003 || Math.abs(z.labelDy ?? 0) > 0.003,
    [],
  );
  const groundLabelOffsets = useMemo(() => {
    const out = new Map<string, number>();
    if (!activeLayers.labels) return out;
    const rings = state.zones.filter((z) => z.feature && z.points.length >= 3 && !labelMovedByUser(z));
    if (rings.length < 2) return out;
    const laid = layoutCanvasLabels(
      rings.map((z) => {
        const c = ringCentroid(z.points);
        const text = z.name ?? GROUND_FEATURES[z.feature!].label;
        return {
          id: z.id,
          cx: c[0] * imgW,
          cy: c[1] * imgH,
          gap: 0,
          w: estimatePillWidth(text, 11, 6, 150),
          h: 22,
          iconR: 0, // a ground label has no icon disc of its own to avoid
        };
      }).filter(isUsableCanvasLabelInput),
    );
    for (const pos of laid) {
      const src = rings.find((r) => r.id === pos.id)!;
      out.set(pos.id, pos.y / imgH - ringCentroid(src.points)[1]);
    }
    return out;
  }, [state.zones, activeLayers.labels, imgW, imgH, labelMovedByUser]);

  // Handle sizing — phone-first. A radius written in WORLD (viewBox) units, like the old
  // fixed r={14}, balloons on screen exactly when a farmer pinch-zooms in for precision —
  // the very thing a small phone forces them to do — AND scales again with how wide the
  // canvas actually renders (a phone's canvas box is far narrower than a desktop's). worldPx
  // converts a target ON-SCREEN pixel size through BOTH factors (view.k zoom, and
  // containerPx/imgW render scale) into the world-space radius that draws at that constant
  // screen size, whatever the zoom level or device. The VISIBLE dot shrinks toward the narrow
  // end (less of the photo obscured on a phone); the invisible HIT target never drops below a
  // real mobile touch target (~40px on-screen diameter) — shrinking the dot for visibility must
  // never make it harder to actually grab.
  const renderScale = containerPx > 0 && containerHeightPx > 0 ? Math.min(containerPx / imgW, containerHeightPx / imgH) : 1;
  const effectiveScale = view.k * renderScale || 1;
  const worldPx = (screenPx: number) => screenPx / effectiveScale;
  const visibleScreenR = clamp(Math.min(containerPx, containerHeightPx) * 0.018, 5, 8); // narrower canvas → smaller dot
  const vertexHitR = worldPx(20); // ~40px tappable diameter, always
  const vertexVisibleR = worldPx(visibleScreenR);
  const vertexStrokeW = worldPx(2);
  const insertHitR = worldPx(20);
  const insertVisibleR = worldPx(Math.max(visibleScreenR - 1, 4));
  const deleteHitR = worldPx(20);
  const deleteVisibleR = worldPx(Math.max(visibleScreenR + 1, 6));
  const itemActionHitR = worldPx(20);
  const itemActionR = worldPx(12);
  const itemActionStrokeW = worldPx(1.5);
  const itemActionFont = worldPx(12);
  const itemActionGap = worldPx(4);
  // 20 (not 18) to match the ~40px comfortable-touch-target radius this file already uses
  // elsewhere for vertexHitR and itemActionHitR — the resize grips (corner + both edges, below)
  // were the one outlier still sized under that baseline. +2px per side; the visible glyphs
  // (itemGrip/itemGripSmall) are untouched, so this only widens the invisible tap zone.
  const itemGripHit = worldPx(20);
  const itemGrip = worldPx(10);
  const itemGripSmall = worldPx(7);
  const itemRotateStem = worldPx(18);

  // Group-drag preview: the SAME clamped delta for every member (rigid group translate — see
  // clampGroupDelta/endGroupDrag) computed ONCE per render so the live preview below and the
  // eventual commit can never show/produce different positions. dragGroup.current is a ref (not
  // reactive state) — reading it directly here is safe because groupDragDelta (a real state
  // value, set in lockstep by moveGroupDrag) is what actually triggers the re-render.
  const groupOrigins = dragGroup.current;
  const clampedGroupDelta: [number, number] | null =
    groupOrigins && groupDragDelta
      ? clampGroupDelta(collectGroupPoints(groupOrigins), groupDragDelta[0], groupDragDelta[1])
      : null;

  // A placed item's live position: its own single-item drag preview wins if it's the one being
  // individually dragged; otherwise its group-drag preview (if it's a member of the group
  // currently moving) wins; otherwise its committed x/y. Shared by BOTH item render passes below
  // (the footprint/icon loop and the separate label-pill layout pass) so the two can never
  // disagree about where an item is mid-drag — a real bug this fixes: without it, a group-dragged
  // item's icon would move while its name pill stayed pinned to the old position.
  function effectiveItemPos(item: PlacedItem): [number, number] {
    if (item.id === dragItemId.current && dragPos) return dragPos;
    const origin = groupOrigins?.itemOrigins.get(item.id);
    if (origin && clampedGroupDelta) {
      return [clamp01(origin[0] + clampedGroupDelta[0]), clamp01(origin[1] + clampedGroupDelta[1])];
    }
    return [item.x, item.y];
  }

  // touchAction 'none' whenever a two-finger pinch could occur (always, so the browser
  // never intercepts the gesture for native pinch-zoom/scroll) — panning/placing rely on
  // preventDefault + our own pointer handlers either way.
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Fill the container BOTH ways (meet = letterbox) so the whole site is always in
          view and the canvas never overflows and pushes the palette off-screen. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${imgW} ${imgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none', background: '#0B120B' }}
        onPointerDown={handleBackgroundPointerDown}
        onPointerMove={(e) => {
          handleBackgroundPointerMove(e);
          moveDragItem(e);
          moveDragVertex(e);
          moveDragResize(e);
          moveDragRotate(e);
          moveDragShape(e);
          moveDragLabel(e);
          moveDragDraftVertex(e);
          moveGroupDrag(e);
        }}
        onPointerUp={(e) => {
          handleBackgroundPointerUp(e);
          endDragItem();
          endDragVertex();
          endDragResize();
          endDragRotate();
          endDragShape();
          endDragLabel();
          endDragDraftVertex();
          endGroupDrag();
        }}
        onPointerCancel={handleBackgroundPointerCancel}
        onDoubleClick={handleBackgroundDoubleClick}
      >
        <defs>
          {/* Subtle diagonal hatch, one per zone/ground-feature colour — see hatchFill() above. */}
          {HATCH_COLORS.map((c) => (
            <pattern
              key={c}
              id={hatchPatternId(c)}
              width={8}
              height={8}
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width={8} height={8} fill={c} fillOpacity={0.12} />
              <line x1={0} y1={0} x2={0} y2={8} stroke={c} strokeWidth={2.5} strokeOpacity={0.55} />
            </pattern>
          ))}
          {/* Clip contour lines to the property so they don't spill onto neighbours' land. */}
          {refLayers.boundary.length >= 3 && (
            <clipPath id="contour-clip">
              <polygon points={ringToPx(refLayers.boundary, imgW, imgH)} />
            </clipPath>
          )}
        </defs>
        <g transform={`translate(${view.tx.toFixed(2)} ${view.ty.toFixed(2)}) scale(${view.k})`}>
        {/* Satellite underlay */}
        {satDataUrl ? (
          <image href={satDataUrl} x={0} y={0} width={imgW} height={imgH} preserveAspectRatio="xMidYMid slice" />
        ) : (
          <rect x={0} y={0} width={imgW} height={imgH} fill="#FFFEFA" />
        )}

        {/* Contour guide lines — approximate, on-contour direction from slope+aspect. Clipped to
            the property. Off by default; toggled via the Contours layer. */}
        {activeLayers.contours && contours.lines.length > 0 && (
          <g clipPath="url(#contour-clip)" pointerEvents="none">
            {contours.lines.map((ln, i) => (
              <line
                key={i}
                x1={ln.a[0] * imgW}
                y1={ln.a[1] * imgH}
                x2={ln.b[0] * imgW}
                y2={ln.b[1] * imgH}
                stroke="#8B5A2B"
                strokeWidth={ln.elevM === 0 ? 2 : 1}
                strokeOpacity={0.55}
                strokeDasharray={ln.elevM === 0 ? undefined : '5 4'}
              />
            ))}
          </g>
        )}

        {/* Sector energies — sun path (across the north in the SH), summer/winter wind, dry-season
            fire wedge, downhill water-flow arrow, frost pocket. Deterministic (lib/sector), light
            and non-interactive; drawn in the world group so it stays anchored to the site while
            panning/zooming. Off by default; toggled via the Sector layer. */}
        {activeLayers.sector && sectorModel && (
          <SectorOverlay model={sectorModel} imgW={imgW} imgH={imgH} boundary={refLayers.boundary} />
        )}

        {/* Boundary reference — the property fence. House/driveway and every other traced
            shape are now rendered below as tappable `tracedLayers` (adoptable in one tap),
            so they're no longer drawn here as dead non-interactive outlines. The boundary
            stays special: fence styling, never adopted as a zone. */}
        {refShown && refLayers.boundary.length >= 3 && (() => {
          const boundaryPx = refLayers.boundary.map(([x, y]) => [x * imgW, y * imgH] as [number, number]);
          const boundaryPts = ringToPx(refLayers.boundary, imgW, imgH);
          const posts = boundaryFencePosts(boundaryPx, 26);
          return (
            <g pointerEvents="none" opacity={refOpacityFactor}>
              {/* Post-and-wire farm fence — ported from DesignGlossy.tsx's drawBlueprintBoundary so
                  what the farmer sees while drawing matches what ships on the output sheets: a thin
                  taut bone-white wire with round posts at regular intervals, never the old ticked/
                  perpendicular-dash convention (which read, on a map full of planting, as a row of
                  something along the fence — Rory: "boundary is still showing with that ugly fence
                  one do it with poles and wire!"). Dark casing underneath keeps the pale wire legible
                  over any satellite photo or AI-rendered background. */}
              <polygon points={boundaryPts} fill="none" stroke="rgba(24,28,22,0.45)" strokeWidth={3.5} strokeLinejoin="round" />
              <polygon points={boundaryPts} fill="none" stroke={BOUNDARY_BONE} strokeWidth={1.6} strokeLinejoin="round" />
              {posts.map(([cx, cy], i) => (
                <circle
                  key={`bpost-${i}`}
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={BOUNDARY_BONE}
                  stroke="rgba(24,28,22,0.55)"
                  strokeWidth={1}
                />
              ))}
            </g>
          );
        })()}

        {/* Traced layers — everything the farmer drew on the live map, shown here as
            dotted, colour-coded reference shapes. Tap one (in Select mode) to reveal
            "Use in design", which adopts it into an editable shape — no redraw. Adopted
            ones dim and drop the affordance so they can't be added twice. */}
        {/* Hide a traced source once it's been ADOPTED into the design — the solid adopted shape
            IS that geometry now, so the dimmed dotted ghost + its second label were pure
            duplication (Rory: "duplications which I want to avoid"). Filter, don't dim. */}
        {refShown && (tracedLayers ?? []).filter((layer) => !adoptedIds.has(layer.featureId)).map((layer) => {
          const adopted = false;
          // Also OFF while a ground-feature chip is armed: otherwise, with Lawn/Patio armed, a tap
          // on the overlapping traced HOUSE would adopt it (adoptTracedLayer hardcodes roof/
          // structure→house, ignoring areaFeature) — so "add a Lawn" silently became "House"
          // (Rory). Disarm the chip to adopt intentionally.
          const interactive = tool === 'select' && !adopted && !areaFeature;
          // Only reveal the adopt button in Select mode, so an armed draw tool can neither
          // trigger adoption nor have the button overlap the drawing surface.
          const isActive = activeTracedId === layer.featureId && interactive;
          const centroid = ringCentroid(layer.points);
          const cx = centroid[0] * imgW;
          const cy = centroid[1] * imgH;
          const onTracedDown = (e: React.PointerEvent) => {
            if (!interactive) return;
            e.stopPropagation();
            setActiveTracedId((prev) => (prev === layer.featureId ? null : layer.featureId));
          };
          const hitProps = {
            // 'all' (not 'stroke') so the whole interior of a big traced shape is tappable, not
            // just within ~16px of its outline — the core "one tap on your veg garden" goal.
            style: { cursor: interactive ? 'pointer' : 'default', pointerEvents: interactive ? 'all' : 'none' } as React.CSSProperties,
            onPointerDown: onTracedDown,
          };
          return (
            <g key={`traced-${layer.featureId}`} opacity={(adopted ? 0.4 : 1) * refOpacityFactor}>
              {layer.render === 'polygon' ? (
                <>
                  <polygon
                    points={ringToPx(layer.points, imgW, imgH)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={16}
                    {...hitProps}
                  />
                  <polygon
                    points={ringToPx(layer.points, imgW, imgH)}
                    fill={layer.color}
                    fillOpacity={isActive ? 0.16 : 0.08}
                    stroke={layer.color}
                    strokeWidth={isActive ? 2.5 : 1.75}
                    strokeDasharray="2 4"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </>
              ) : (
                <>
                  <polyline
                    points={polylinePoints(layer.points, imgW, imgH)}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    strokeLinecap="round"
                    {...hitProps}
                  />
                  <polyline
                    points={polylinePoints(layer.points, imgW, imgH)}
                    fill="none"
                    stroke={layer.color}
                    strokeWidth={isActive ? 3 : 2}
                    strokeDasharray="2 4"
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                </>
              )}
              {/* Name tag — sits at the centroid so the farmer can see what each traced
                  shape is. When active, the tag is replaced by the "Use in design" button.
                  Hidden when the Labels layer is off (declutter). */}
              {!isActive && activeLayers.labels && (
                <g transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)})`} pointerEvents="none">
                  <foreignObject x={-56} y={-10} width={112} height={20} style={{ overflow: 'visible' }}>
                    <div
                      style={{
                        fontSize: 9,
                        lineHeight: '16px',
                        textAlign: 'center',
                        color: '#F4EDD8',
                        background: 'rgba(32,25,15,0.72)',
                        border: `1px solid ${layer.color}`,
                        borderRadius: 8,
                        padding: '1px 6px',
                        display: 'inline-block',
                        maxWidth: 112,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {adopted ? `✓ ${layer.name}` : layer.name}
                    </div>
                  </foreignObject>
                </g>
              )}
              {isActive && (
                <g
                  transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)})`}
                  style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const next = adoptTracedLayer(state, frame, layer);
                    setActiveTracedId(null);
                    if (next) onChange(next);
                  }}
                >
                  <foreignObject x={-52} y={-13} width={104} height={26} style={{ overflow: 'visible' }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        lineHeight: '24px',
                        textAlign: 'center',
                        color: '#FBF6EC',
                        background: '#1F4D2B',
                        borderRadius: 13,
                        padding: '0 10px',
                        display: 'inline-block',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('designCanvasUseInDesign')}
                    </div>
                  </foreignObject>
                </g>
              )}
            </g>
          );
        })}

        {/* Zones + ground features. Effort-zone rings follow the Zones toggle; farmer-drawn
            ground areas (house/patio/lawn/…) follow the separate Ground toggle. */}
        {state.zones.map((z) => {
            // AUTO-SEPARATED LABELS. Nested rings share a centroid almost exactly — a lawn drawn
            // just inside the property boundary puts "Lawn" and "Property boundary" on top of each
            // other, which is what Rory saw. layoutCanvasLabels (the engine already de-colliding
            // the plant pills) pushes them apart; a farmer who drags a label still wins, because
            // their labelDx/labelDy is applied on top of the auto position.
            const auto = groundLabelOffsets.get(z.id) ?? 0;
            if (z.feature ? !activeLayers.ground : !activeLayers.zones) return null;
            // Not owned by the current wizard step (e.g. the boundary while on Zones) — still
            // rendered for context, but locked: dimmed, and its own hit-targets inert (see
            // ownedByCurrentStep + the startDrag* guards above). `interactive` additionally
            // requires the select tool, matching every existing tool==='select' gate here.
            const owned = ownedByCurrentStep(state.step, { kind: 'zone', feature: z.feature });
            const interactive = tool === 'select' && owned;
            const def = ZONE_DEFS[z.zone];
            // Ground features (house/patio/…) render as filled, labelled SOLID polygons —
            // "what is there"; plain zones keep their dashed effort-zone ring + number badge.
            const feat = z.feature ? GROUND_FEATURES[z.feature] : null;
            const color = feat ? feat.color : def.color;
            const isSelected = selectedId === z.id;
            const isHighlighted = selectedIds.includes(z.id);
            const isDraggingVertexOfThisShape = dragVertex.current?.shapeId === z.id && dragVertex.current.kind === 'zone' && vertexPos;
            const isDraggingWholeShape = dragShape.current?.id === z.id && dragShape.current.kind === 'zone' && shapeDragDelta;
            const groupOrigin = groupOrigins?.zoneOrigins.get(z.id);
            const isGroupDraggingThis = groupOrigin && clampedGroupDelta;
            const effectivePoints = isDraggingVertexOfThisShape
              ? z.points.map((p, i) => (i === dragVertex.current!.index ? vertexPos! : p))
              : isDraggingWholeShape
              ? z.points.map(([x, y]) => [clamp01(x + shapeDragDelta![0]), clamp01(y + shapeDragDelta![1])] as [number, number])
              : isGroupDraggingThis
              ? groupOrigin.map(([x, y]) => [clamp01(x + clampedGroupDelta[0]), clamp01(y + clampedGroupDelta[1])] as [number, number])
              : z.points;
            const centroid = ringCentroid(effectivePoints);
            const onZonePointerDown = (e: React.PointerEvent) => startDragShape(e, z.id, 'zone');
            // The name label can be dragged off the shape (labelDx/labelDy); show a live preview
            // while dragging, and a thin leader back to the centroid once it's been moved.
            const isDraggingThisLabel = dragLabel.current?.id === z.id && dragLabel.current?.moved && labelDragDelta;
            const ldx = (z.labelDx ?? 0) + (isDraggingThisLabel ? labelDragDelta![0] : 0);
            const ldy = (z.labelDy ?? 0) + (isDraggingThisLabel ? labelDragDelta![1] : 0);
            const labelCx = centroid[0] + ldx;
            const labelCy = centroid[1] + ldy + (labelMovedByUser(z) ? 0 : auto);
            const labelMoved = Math.abs(ldx) > 0.003 || Math.abs(ldy) > 0.003 || Math.abs(auto) > 0.003;
            // The leader lands on the ring's EDGE nearest the label, never its centroid — see
            // nearestPointOnRing. A property boundary's centroid is the middle of the plot, i.e. the
            // house, so a dragged boundary label pointed straight at the roof.
            const leaderAnchor = nearestPointOnRing(effectivePoints, [labelCx, labelCy]);
            // Ground-feature word-pills (House/Lawn/Paving…) are useful context on most steps but
            // buried the map in text on the Zones step ("words almost the whole screen"). Hide the
            // WORDS there — the coloured fills still orient you — while keeping zone number badges.
            const featureLabelsOn = activeLayers.labels && state.step !== 'zones';
            const labelVisible = feat ? featureLabelsOn : true;
            return (
              <g key={z.id} opacity={owned ? 1 : LOCKED_OPACITY}>
                {/* Invisible fat hit-stroke along the edge — thin/narrow beds have little
                    fill area to tap, so a wide transparent perimeter catches the pointer
                    even when the interior fill is only a sliver. */}
                <polygon
                  points={ringToPx(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: interactive ? 'grab' : 'default', pointerEvents: interactive ? 'stroke' : 'none' }}
                  onPointerDown={onZonePointerDown}
                />
                {/* NESTED, not stacked. A ground feature is filled as itself MINUS every smaller
                    ground ring inside it, so tracing boundary -> lawn -> house -> patio gives four
                    readable areas instead of four hatches piled on the roof. The OUTLINE still
                    follows the ring the farmer actually drew — only the fill is cut — so the shape
                    stays honest and editable. evenodd renders the difference result's holes. */}
                {/* A PROPERTY BOUNDARY IS A LINE, NOT A SURFACE. Hatching it filled the whole
                    plot with a wash that every other area then had to be cut out of, and made the
                    one thing that is purely an edge read as the biggest area on the map. The sheets
                    have always drawn it as a fence line only (drawBlueprintBoundary); the canvas now
                    agrees. This also means nesting applies only to real surfaces. */}
                {z.feature !== 'boundary' && (
                <path
                  d={feat && !isDraggingVertexOfThisShape && !isDraggingWholeShape
                    ? groundFillPolys(state.zones, z)
                        .flat()
                        .map((ring: Array<[number, number]>) =>
                          `M ${ring.map(([x, y]) => `${(x * imgW).toFixed(1)},${(y * imgH).toFixed(1)}`).join(' L ')} Z`)
                        .join(' ')
                    : `M ${effectivePoints.map(([x, y]) => `${(x * imgW).toFixed(1)},${(y * imgH).toFixed(1)}`).join(' L ')} Z`}
                  fillRule="evenodd"
                  fill={hatchFill(color)}
                  fillOpacity={feat ? 0.32 : 0.2}
                  stroke="none"
                  style={{ cursor: interactive ? 'grab' : 'default', pointerEvents: interactive ? 'auto' : 'none' }}
                  onPointerDown={onZonePointerDown}
                />
                )}
                <polygon
                  points={ringToPx(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke={color}
                  strokeWidth={feat ? 2 : 1.5}
                  strokeDasharray={feat ? undefined : '6 4'}
                  pointerEvents="none"
                />
                {isHighlighted && (
                  <polygon points={ringToPx(effectivePoints, imgW, imgH)} fill="none" stroke={GOLD} strokeWidth={2.5} strokeDasharray="4 3" pointerEvents="none" />
                )}
                {labelMoved && labelVisible && (
                  <line
                    x1={(leaderAnchor[0] * imgW).toFixed(1)}
                    y1={(leaderAnchor[1] * imgH).toFixed(1)}
                    x2={(labelCx * imgW).toFixed(1)}
                    y2={(labelCy * imgH).toFixed(1)}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    opacity={0.75}
                    pointerEvents="none"
                  />
                )}
                <g
                  transform={`translate(${(labelCx * imgW).toFixed(1)},${(labelCy * imgH).toFixed(1)})`}
                  onPointerDown={(e) => startDragLabel(e, z.id)}
                  style={{ cursor: interactive ? 'move' : 'default', pointerEvents: interactive ? 'auto' : 'none' }}
                >
                  {feat ? (
                    editingLabelId === z.id ? (
                      (() => {
                        const isTerraceBank = z.feature === 'terrace_bank';
                        const rows = isTerraceBank ? 3 : 2;
                        const rowH = 24;
                        const gap = 3;
                        const boxH = rows * rowH + (rows - 1) * gap + 8;
                        const wholeSiteAvg = sectorSite?.elevation?.slopePct;
                        const fieldStyle = {
                          width: 150,
                          fontSize: 11,
                          fontWeight: 700 as const,
                          textAlign: 'center' as const,
                          color: '#FBF6EC',
                          background: '#20190F',
                          border: `1px solid ${color}`,
                          borderRadius: 9,
                          padding: '2px 6px',
                          outline: 'none',
                          boxSizing: 'border-box' as const,
                        };
                        const keyHandlers = {
                          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === 'Enter') e.currentTarget.blur();
                            else if (e.key === 'Escape') {
                              skipLabelCommit.current = true;
                              e.currentTarget.blur();
                            }
                          },
                        };
                        return (
                          <foreignObject x={-75} y={-boxH / 2} width={150} height={boxH} style={{ overflow: 'visible' }}>
                            <div
                              // Commit (or cancel) only when focus leaves the WHOLE editor group —
                              // moving focus between the name/level/slope fields must not close it.
                              onBlur={(e) => {
                                const group = e.currentTarget;
                                if (group.contains(e.relatedTarget as Node)) return;
                                if (skipLabelCommit.current) {
                                  skipLabelCommit.current = false;
                                  setEditingLabelId(null);
                                  return;
                                }
                                commitLabelEdit(z.id);
                              }}
                              style={{ display: 'flex', flexDirection: 'column', gap }}
                            >
                              <input
                                autoFocus
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                {...keyHandlers}
                                style={fieldStyle}
                              />
                              <input
                                value={editingLevelText}
                                onChange={(e) => setEditingLevelText(e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                {...keyHandlers}
                                placeholder={t('designCanvasLevelPlaceholder')}
                                inputMode="decimal"
                                style={fieldStyle}
                              />
                              {isTerraceBank && (
                                <input
                                  value={editingSlopeText}
                                  onChange={(e) => setEditingSlopeText(e.target.value)}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  {...keyHandlers}
                                  placeholder={formatDesignTranslation(t('designCanvasSlopePlaceholder'), {
                                    average: wholeSiteAvg != null ? wholeSiteAvg.toFixed(0) : '—',
                                  })}
                                  inputMode="decimal"
                                  style={fieldStyle}
                                />
                              )}
                            </div>
                          </foreignObject>
                        );
                      })()
                    ) : featureLabelsOn ? (
                    <foreignObject x={-56} y={-11} width={112} height={22} style={{ overflow: 'visible' }}>
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          lineHeight: '18px',
                          textAlign: 'center',
                          color: '#FBF6EC',
                          background: 'rgba(32,25,15,0.78)',
                          border: `1px solid ${color}`,
                          borderRadius: 9,
                          padding: '1px 7px',
                          display: 'inline-block',
                          maxWidth: 112,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {z.name ?? feat.label}
                      </div>
                    </foreignObject>
                    ) : null
                  ) : activeLayers.labels ? (
                    // Rory: "theres a bug when i toggle labels on and off it doesnt work" — this
                    // branch (a plain effort-zone ring's number badge) used to render
                    // UNCONDITIONALLY, never reading activeLayers.labels at all. On the Zones
                    // step every visible ring is exactly this case (ground features' word-pills
                    // are separately forced off there — see featureLabelsOn above), so 100% of
                    // what the toggle could affect on that step ignored it. Now it does.
                    <>
                      <circle r={11} fill={def.color} stroke="#FFFFFF" strokeWidth={2.5} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#FFFFFF">
                        {z.zone}
                      </text>
                    </>
                  ) : null}
                </g>
                {/* Editing handles show only in Select mode — while a draw tool is armed
                    they'd sit on top of the drawing surface and a stray tap on the ✕ (or a
                    vertex) would delete/grab the old zone instead of dropping the next corner
                    of the NEW one. Arming a tool also clears the selection upstream. */}
                {isSelected && interactive && (
                  <>
                    <polygon
                      points={ringToPx(effectivePoints, imgW, imgH)}
                      fill="none"
                      stroke={GOLD}
                      strokeWidth={2.5}
                      strokeDasharray="4 3"
                    />
                    {/* Edge-midpoint "+" handles — tap to insert a new corner on that edge. */}
                    {effectivePoints.map(([x, y], i) => {
                      const nxt = effectivePoints[(i + 1) % effectivePoints.length];
                      const mx = ((x + nxt[0]) / 2) * imgW;
                      const my = ((y + nxt[1]) / 2) * imgH;
                      return (
                        <g key={`add-${i}`}>
                          <circle
                            cx={mx}
                            cy={my}
                            r={insertHitR}
                            fill="transparent"
                            style={{ cursor: 'copy', touchAction: 'none', pointerEvents: 'fill' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              insertZoneVertex(z.id, i);
                            }}
                          />
                          <circle cx={mx} cy={my} r={insertVisibleR} fill="#1F4D2B" stroke="#FFFEFA" strokeWidth={vertexStrokeW} pointerEvents="none" />
                          <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={worldPx(10)} fontWeight={700} fill="#FFFEFA" pointerEvents="none">
                            +
                          </text>
                        </g>
                      );
                    })}
                    {effectivePoints.map(([x, y], i) => (
                      <g key={i}>
                        {/* Invisible enlarged hit circle behind the visible ring — reliable
                            touch target without visually enlarging the handle. */}
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={vertexHitR}
                          fill="transparent"
                          style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'fill' }}
                          onPointerDown={(e) => startDragVertex(e, z.id, 'zone', i)}
                        />
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={vertexVisibleR}
                          fill="#FFFEFA"
                          stroke={GOLD}
                          strokeWidth={vertexStrokeW}
                          pointerEvents="none"
                        />
                      </g>
                    ))}
                    {/* Per-vertex "−" badges to delete a corner — only while the ring has more
                        than the 3 points a polygon needs, so it can never be made degenerate. */}
                    {effectivePoints.length > 3 &&
                      effectivePoints.map(([x, y], i) => (
                        <g key={`del-${i}`} transform={`translate(${(x * imgW + 13).toFixed(1)},${(y * imgH - 13).toFixed(1)})`}>
                          {/* Invisible enlarged hit circle — the visible badge alone (used to be
                              its only tap target) is well under the ~40px mobile touch-target
                              floor once it's allowed to shrink for visibility (see worldPx). */}
                          <circle
                            r={deleteHitR}
                            fill="transparent"
                            style={{ cursor: 'pointer', touchAction: 'none', pointerEvents: 'fill' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              removeZoneVertex(z.id, i);
                            }}
                          />
                          <circle r={deleteVisibleR} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={vertexStrokeW * 0.6} pointerEvents="none" />
                          <text textAnchor="middle" dominantBaseline="central" fontSize={worldPx(11)} fontWeight={700} fill="#FBF6EC" pointerEvents="none">
                            −
                          </text>
                        </g>
                      ))}
                    <g
                      transform={`translate(${(centroid[0] * imgW + 16).toFixed(1)},${(centroid[1] * imgH - 16).toFixed(1)})`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        deleteZone(z.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <circle r={9} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#FBF6EC">
                        ✕
                      </text>
                    </g>
                  </>
                )}
              </g>
            );
          })}

        {/* Lines — each kind follows its functional layer (LINE_LAYER), not one generic toggle. */}
        {state.lines.map((line) => {
            if (!activeLayers[LINE_LAYER[line.kind]]) return null;
            const style = lineStroke(line.kind);
            // See the zones loop above — same step-ownership lock (Rory's boundary-grab bug).
            const owned = ownedByCurrentStep(state.step, { kind: 'line', lineKind: line.kind });
            const interactive = tool === 'select' && owned;
            const isSelected = selectedId === line.id;
            const isHighlighted = selectedIds.includes(line.id);
            const isDraggingVertexOfThisShape = dragVertex.current?.shapeId === line.id && dragVertex.current.kind === 'line' && vertexPos;
            const isDraggingWholeShape = dragShape.current?.id === line.id && dragShape.current.kind === 'line' && shapeDragDelta;
            const groupOrigin = groupOrigins?.lineOrigins.get(line.id);
            const isGroupDraggingThis = groupOrigin && clampedGroupDelta;
            const effectivePoints = isDraggingVertexOfThisShape
              ? line.points.map((p, i) => (i === dragVertex.current!.index ? vertexPos! : p))
              : isDraggingWholeShape
              ? line.points.map(([x, y]) => [clamp01(x + shapeDragDelta![0]), clamp01(y + shapeDragDelta![1])] as [number, number])
              : isGroupDraggingThis
              ? groupOrigin.map(([x, y]) => [clamp01(x + clampedGroupDelta[0]), clamp01(y + clampedGroupDelta[1])] as [number, number])
              : line.points;
            const mid = effectivePoints[Math.floor(effectivePoints.length / 2)] ?? effectivePoints[0];
            return (
              <g key={line.id} opacity={owned ? 1 : LOCKED_OPACITY}>
                {/* Invisible fat hit-stroke — thin visible lines are hard to tap precisely,
                    so a wide transparent duplicate underneath catches the pointer instead. */}
                <polyline
                  points={polylinePoints(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  strokeLinecap="round"
                  style={{ cursor: interactive ? 'grab' : 'default', pointerEvents: interactive ? 'stroke' : 'none' }}
                  onPointerDown={(e) => startDragShape(e, line.id, 'line')}
                />
                <polyline
                  points={polylinePoints(effectivePoints, imgW, imgH)}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeDasharray={style.dash}
                  opacity={style.opacity ?? 1}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                />
                {line.kind === 'fence' && fencePosts(effectivePoints, imgW, imgH).map(([cx, cy], i) => (
                  <circle key={`post-${i}`} cx={cx} cy={cy} r={3} fill={style.stroke} stroke="#FFFEFA" strokeWidth={1} pointerEvents="none" />
                ))}
                {isHighlighted && (
                  <polyline points={polylinePoints(effectivePoints, imgW, imgH)} fill="none" stroke={GOLD} strokeWidth={3} strokeDasharray="4 3" strokeLinecap="round" pointerEvents="none" />
                )}
                {/* Name-pill label at the line's midpoint (or wherever it's been dragged to) —
                    the SAME pattern as the ground-feature label pill above, generalised to lines.
                    No LineShape kind had an on-canvas label before this: "there's no label for
                    swales" turned out to be true of every kind, not just swales. */}
                {activeLayers.labels && mid && (() => {
                  const isDraggingThisLabel =
                    dragLabel.current?.id === line.id && dragLabel.current?.kind === 'line' && dragLabel.current?.moved && labelDragDelta;
                  const ldx = (line.labelDx ?? 0) + (isDraggingThisLabel ? labelDragDelta![0] : 0);
                  const ldy = (line.labelDy ?? 0) + (isDraggingThisLabel ? labelDragDelta![1] : 0);
                  const labelCx = mid[0] + ldx;
                  const labelCy = mid[1] + ldy;
                  const labelMoved = Math.abs(ldx) > 0.003 || Math.abs(ldy) > 0.003;
                  const isEditingThis = editingLabelId === line.id && editingLabelKind === 'line';
                  return (
                    <>
                      {labelMoved && (
                        <line
                          x1={(mid[0] * imgW).toFixed(1)}
                          y1={(mid[1] * imgH).toFixed(1)}
                          x2={(labelCx * imgW).toFixed(1)}
                          y2={(labelCy * imgH).toFixed(1)}
                          stroke={style.stroke}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                          opacity={0.75}
                          pointerEvents="none"
                        />
                      )}
                      <g
                        transform={`translate(${(labelCx * imgW).toFixed(1)},${(labelCy * imgH).toFixed(1)})`}
                        onPointerDown={(e) => startDragLabel(e, line.id, 'line')}
                        style={{ cursor: interactive ? 'move' : 'default', pointerEvents: interactive ? 'auto' : 'none' }}
                      >
                        {isEditingThis ? (
                          // Lighter than the zone/feature editor: a line only ever needs its name —
                          // no level/slope fields apply to fences, paths, pipes, swales, etc.
                          <foreignObject x={-75} y={-15} width={150} height={30} style={{ overflow: 'visible' }}>
                            <div
                              onBlur={(e) => {
                                const group = e.currentTarget;
                                if (group.contains(e.relatedTarget as Node)) return;
                                if (skipLabelCommit.current) {
                                  skipLabelCommit.current = false;
                                  setEditingLabelId(null);
                                  setEditingLabelKind(null);
                                  return;
                                }
                                commitLabelEdit(line.id, 'line');
                              }}
                            >
                              <input
                                autoFocus
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  else if (e.key === 'Escape') {
                                    skipLabelCommit.current = true;
                                    e.currentTarget.blur();
                                  }
                                }}
                                style={{
                                  width: 150,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  textAlign: 'center' as const,
                                  color: '#FBF6EC',
                                  background: '#20190F',
                                  border: `1px solid ${style.stroke}`,
                                  borderRadius: 9,
                                  padding: '2px 6px',
                                  outline: 'none',
                                  boxSizing: 'border-box' as const,
                                }}
                              />
                            </div>
                          </foreignObject>
                        ) : (
                          <foreignObject x={-56} y={-11} width={112} height={22} style={{ overflow: 'visible' }}>
                            <div
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                lineHeight: '18px',
                                textAlign: 'center',
                                color: '#FBF6EC',
                                background: 'rgba(32,25,15,0.78)',
                                border: `1px solid ${style.stroke}`,
                                borderRadius: 9,
                                padding: '1px 7px',
                                display: 'inline-block',
                                maxWidth: 112,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {line.name ?? LINE_KIND_LABEL[line.kind]}
                            </div>
                          </foreignObject>
                        )}
                      </g>
                    </>
                  );
                })()}
                {isSelected && interactive && (
                  <>
                    {/* Edge-midpoint "+" handles — tap to insert a new corner on that segment. */}
                    {effectivePoints.slice(0, -1).map(([x, y], i) => {
                      const nxt = effectivePoints[i + 1];
                      const mx = ((x + nxt[0]) / 2) * imgW;
                      const my = ((y + nxt[1]) / 2) * imgH;
                      return (
                        <g key={`add-${i}`}>
                          <circle
                            cx={mx}
                            cy={my}
                            r={insertHitR}
                            fill="transparent"
                            style={{ cursor: 'copy', touchAction: 'none', pointerEvents: 'fill' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              insertLineVertex(line.id, i);
                            }}
                          />
                          <circle cx={mx} cy={my} r={insertVisibleR} fill="#1F4D2B" stroke="#FFFEFA" strokeWidth={vertexStrokeW} pointerEvents="none" />
                          <text x={mx} y={my} textAnchor="middle" dominantBaseline="central" fontSize={worldPx(10)} fontWeight={700} fill="#FFFEFA" pointerEvents="none">
                            +
                          </text>
                        </g>
                      );
                    })}
                    {effectivePoints.map(([x, y], i) => (
                      <g key={i}>
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={vertexHitR}
                          fill="transparent"
                          style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'fill' }}
                          onPointerDown={(e) => startDragVertex(e, line.id, 'line', i)}
                        />
                        <circle
                          cx={x * imgW}
                          cy={y * imgH}
                          r={vertexVisibleR}
                          fill="#FFFEFA"
                          stroke={GOLD}
                          strokeWidth={vertexStrokeW}
                          pointerEvents="none"
                        />
                      </g>
                    ))}
                    {/* Per-vertex "−" badges to delete a corner — kept above the 2-point
                        minimum a line needs to stay a line. */}
                    {effectivePoints.length > 2 &&
                      effectivePoints.map(([x, y], i) => (
                        <g key={`del-${i}`} transform={`translate(${(x * imgW + 13).toFixed(1)},${(y * imgH - 13).toFixed(1)})`}>
                          <circle
                            r={deleteHitR}
                            fill="transparent"
                            style={{ cursor: 'pointer', touchAction: 'none', pointerEvents: 'fill' }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              removeLineVertex(line.id, i);
                            }}
                          />
                          <circle r={deleteVisibleR} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={vertexStrokeW * 0.6} pointerEvents="none" />
                          <text textAnchor="middle" dominantBaseline="central" fontSize={worldPx(11)} fontWeight={700} fill="#FBF6EC" pointerEvents="none">
                            −
                          </text>
                        </g>
                      ))}
                    {mid && (
                      <g
                        transform={`translate(${(mid[0] * imgW + 12).toFixed(1)},${(mid[1] * imgH - 12).toFixed(1)})`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          deleteLine(line.id);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <circle r={9} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={1.2} />
                        <text textAnchor="middle" dominantBaseline="central" fontSize={11} fill="#FBF6EC">
                          ✕
                        </text>
                      </g>
                    )}
                  </>
                )}
              </g>
            );
          })}

        {/* Draft (in-progress) zone/line while drawing */}
        {tool === 'zone' && draftPoints.length > 0 && (() => {
          const draftColor = areaFeature ? GROUND_FEATURES[areaFeature].color : ZONE_DEFS[zoneDraw].color;
          return (
            <polygon
              points={ringToPx(draftPoints, imgW, imgH)}
              fill={hatchFill(draftColor)}
              fillOpacity={0.18}
              stroke={draftColor}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
          );
        })()}
        {tool === 'line' && draftPoints.length > 0 && (
          <polyline
            points={polylinePoints(draftPoints, imgW, imgH)}
            fill="none"
            stroke={lineStroke(lineKind).stroke}
            strokeWidth={2.5}
            strokeDasharray="3 3"
          />
        )}
        {/* Draft vertex handles — grabbable mid-draw (before the shape is closed/accepted),
            matching the committed-shape handle's visual language so "show all corners"
            reads consistently whether a shape is being drawn or already placed. */}
        {(tool === 'zone' || tool === 'line') &&
          draftPoints.map(([x, y], i) => (
            <g key={i}>
              <circle
                cx={x * imgW}
                cy={y * imgH}
                r={vertexHitR}
                fill="transparent"
                style={{ cursor: 'grab', touchAction: 'none', pointerEvents: 'fill' }}
                onPointerDown={(e) => startDragDraftVertex(e, i)}
              />
              <circle cx={x * imgW} cy={y * imgH} r={vertexVisibleR} fill="#FFFEFA" stroke={GOLD} strokeWidth={vertexStrokeW} pointerEvents="none" />
            </g>
          ))}

        {/* Placed items at true scale.
            SELECTED ITEM RENDERS LAST. SVG has no z-index — paint order IS stacking order — so an
            item early in the array had its resize/rotate grips and selection ring drawn UNDER every
            item after it. In a row of vegetable beds (the common case: a farmer places six in a
            line, overlapping slightly) the grips of the one you just tapped disappeared behind its
            neighbours and could not be grabbed. Reported live 2026-07-27. Sorting only lifts the
            single selected item to the end; every other item keeps its original paint order, and
            the array itself is untouched — this is presentation, never saved geometry. */}
        {[...state.items]
          .sort((a, b) => (a.id === selectedId ? 1 : 0) - (b.id === selectedId ? 1 : 0))
          .map((item) => {
          const def = ELEMENTS_BY_ID[item.defId];
          if (!def) return null;
          if (!activeLayers[categoryLayerKey(def.category)]) return null;

          const isResizingThis = item.id === dragResizeId.current && resizePreview;
          const wM = isResizingThis ? resizePreview!.wM : item.wM ?? def.wM;
          const hM = isResizingThis ? resizePreview!.hM : item.hM ?? def.hM;
          const wPx = Math.max(wM / mPerPx, 6);
          const hPx = Math.max(hM / mPerPx, 6);
          const [px, py] = effectiveItemPos(item);
          const cx = px * imgW;
          const cy = py * imgH;
          const isSelected = selectedId === item.id;
          const isHighlighted = selectedIds.includes(item.id);
          // See the zones loop above — same step-ownership lock (Rory's boundary-grab bug).
          const owned = ownedByCurrentStep(state.step, { kind: 'item', category: def.category, defId: item.defId });
          const interactive = tool === 'select' && owned;
          const iconDiscR = clamp(6, Math.min(wPx, hPx) * 0.28, 11);
          const fontSize = iconDiscR * 1.05;
          const labelText = item.label ?? def.name;
          const labelFull = item.note ? `${labelText} · ${item.note}` : labelText;
          // Rotation applies to rect strips/beds/rows only (circles are rotation-invariant).
          const isRotatingThis = item.id === dragRotateId.current && rotPreview !== null;
          const rot = def.shape === 'rect' ? (isRotatingThis ? rotPreview! : item.rot ?? 0) : 0;
          const rotXf = rot ? `rotate(${rot})` : undefined;
          const canRotate = def.shape === 'rect';
          const actionX = wPx / 2 + itemActionR + itemActionGap;

          return (
            <g
              key={item.id}
              transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)})`}
              onPointerDown={(e) => startDragItem(e, item.id)}
              opacity={owned ? 1 : LOCKED_OPACITY}
              style={{ cursor: interactive ? 'grab' : 'default', pointerEvents: owned ? 'auto' : 'none' }}
            >
              {/* Footprint + selection outline rotate together (rect only); the icon disc,
                  label and action handles below stay upright/screen-aligned. */}
              <g transform={rotXf}>
                {isHighlighted && (
                  <>
                    {def.shape === 'circle' ? (
                      <circle r={Math.max(wPx, hPx) / 2 + 4} fill="none" stroke={GOLD} strokeWidth={2.5} strokeDasharray="4 3" />
                    ) : (
                      <rect
                        x={-wPx / 2 - 4}
                        y={-hPx / 2 - 4}
                        width={wPx + 8}
                        height={hPx + 8}
                        fill="none"
                        stroke={GOLD}
                        strokeWidth={2.5}
                        strokeDasharray="4 3"
                        rx={4}
                      />
                    )}
                  </>
                )}
                {/* True-scale footprint (soft fill + stroke) */}
                {def.shape === 'circle' ? (
                  <circle r={wPx / 2} fill={def.color} fillOpacity={0.35} stroke={def.color} strokeWidth={1.5} />
                ) : (
                  <rect x={-wPx / 2} y={-hPx / 2} width={wPx} height={hPx} fill={def.color} fillOpacity={0.35} stroke={def.color} strokeWidth={1.5} />
                )}
              </g>
              {/* Centred icon disc: optional, because dense water/planting edits become unreadable
                  when every small placed item carries a full emoji badge. */}
              {activeLayers.symbols && (
                <>
                  <circle r={iconDiscR} fill={def.color} stroke="#FFFFFF" strokeWidth={Math.max(1, iconDiscR * 0.16)} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize}>
                    {def.icon}
                  </text>
                </>
              )}
              {/* Label pills are NOT drawn here. They are laid out together in a second pass below
                  (see "Item label pills"), because de-collision needs to see every pill at once —
                  which a per-item render, by construction, cannot. */}
              {isSelected && owned && onEditItem && (
                <g
                  transform={`translate(${actionX}, ${-hPx / 2 - itemActionR * 2.15})`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditItem(item.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={itemActionHitR} fill="transparent" pointerEvents="fill" />
                  <circle r={itemActionR} fill="#4EA6D8" stroke="#FBF6EC" strokeWidth={itemActionStrokeW} pointerEvents="none" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={itemActionFont} fill="#FBF6EC" pointerEvents="none">
                    ✎
                  </text>
                </g>
              )}
              {isSelected && owned && (
                <g
                  transform={`translate(${actionX}, ${-hPx / 2 + itemActionR * 0.55})`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <circle r={itemActionHitR} fill="transparent" pointerEvents="fill" />
                  <circle r={itemActionR} fill="#B53A3A" stroke="#FBF6EC" strokeWidth={itemActionStrokeW} pointerEvents="none" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={itemActionFont} fill="#FBF6EC" pointerEvents="none">
                    ✕
                  </text>
                </g>
              )}
              {/* Resize handle (bottom-right corner) + rotate knob (top edge) — both attach to
                  the rotated footprint so they read against the strip's real orientation. */}
              {isSelected && interactive && (
                <g transform={rotXf}>
                  {/* Fat invisible hit area so the handle is easy to grab on a phone. */}
                  <rect
                    x={wPx / 2 - itemGripHit}
                    y={hPx / 2 - itemGripHit}
                    width={itemGripHit * 2}
                    height={itemGripHit * 2}
                    fill="transparent"
                    style={{ cursor: 'nwse-resize', touchAction: 'none' }}
                    onPointerDown={(e) => startDragResize(e, item.id)}
                  />
                  {/* Visible handle — a corner grip with diagonal arrows, larger than before. */}
                  <rect
                    x={wPx / 2 - itemGrip / 2}
                    y={hPx / 2 - itemGrip / 2}
                    width={itemGrip}
                    height={itemGrip}
                    rx={itemGrip * 0.22}
                    fill={GOLD}
                    stroke="#0B120B"
                    strokeWidth={itemActionStrokeW}
                    style={{ cursor: 'nwse-resize', touchAction: 'none' }}
                    onPointerDown={(e) => startDragResize(e, item.id)}
                  />
                  <path
                    d={`M ${wPx / 2 - itemGripSmall / 2} ${hPx / 2 + itemGripSmall / 2} L ${wPx / 2 + itemGripSmall / 2} ${hPx / 2 - itemGripSmall / 2}`}
                    stroke="#0B120B"
                    strokeWidth={itemActionStrokeW}
                    strokeLinecap="round"
                    pointerEvents="none"
                  />
                  {/* Edge handles for rectangles — breadth (side) and length (bottom) resize
                      ONE dimension each, so a bed's width and length are independent. Circles
                      only get the uniform corner handle above. */}
                  {def.shape === 'rect' && (
                    <>
                      {/* Breadth — mid-right edge */}
                      <rect x={wPx / 2 - itemGripHit} y={-itemGripHit} width={itemGripHit * 2} height={itemGripHit * 2} fill="transparent" style={{ cursor: 'ew-resize', touchAction: 'none' }} onPointerDown={(e) => startDragResize(e, item.id, 'w')} />
                      <rect x={wPx / 2 - itemGripSmall / 2} y={-itemGrip} width={itemGripSmall} height={itemGrip * 2} rx={itemGripSmall / 2} fill={GOLD} stroke="#0B120B" strokeWidth={itemActionStrokeW} style={{ cursor: 'ew-resize', touchAction: 'none' }} onPointerDown={(e) => startDragResize(e, item.id, 'w')} />
                      {/* Length — mid-bottom edge */}
                      <rect x={-itemGripHit} y={hPx / 2 - itemGripHit} width={itemGripHit * 2} height={itemGripHit * 2} fill="transparent" style={{ cursor: 'ns-resize', touchAction: 'none' }} onPointerDown={(e) => startDragResize(e, item.id, 'h')} />
                      <rect x={-itemGrip} y={hPx / 2 - itemGripSmall / 2} width={itemGrip * 2} height={itemGripSmall} rx={itemGripSmall / 2} fill={GOLD} stroke="#0B120B" strokeWidth={itemActionStrokeW} style={{ cursor: 'ns-resize', touchAction: 'none' }} onPointerDown={(e) => startDragResize(e, item.id, 'h')} />
                    </>
                  )}
                  {canRotate && (
                    <g>
                      <line x1={0} y1={-hPx / 2 - itemGripSmall} x2={0} y2={-hPx / 2 - itemRotateStem} stroke={GOLD} strokeWidth={itemActionStrokeW} />
                      <circle
                        cx={0}
                        cy={-hPx / 2 - itemRotateStem - itemActionR * 0.35}
                        r={itemActionR}
                        fill={GOLD}
                        stroke="#FFFFFF"
                        strokeWidth={itemActionStrokeW}
                        style={{ cursor: 'grab', touchAction: 'none' }}
                        onPointerDown={(e) => startDragRotate(e, item.id)}
                      />
                      <circle cx={0} cy={-hPx / 2 - itemRotateStem - itemActionR * 0.35} r={worldPx(2.5)} fill="#0B120B" pointerEvents="none" />
                    </g>
                  )}
                </g>
              )}
              {/* Upright drag readout — resize shows metres, rotate shows degrees */}
              {isSelected && (isResizingThis || isRotatingThis) && (
                <g transform={`translate(0, ${(-hPx / 2 - 34).toFixed(1)})`} pointerEvents="none">
                  <rect x={-34} y={-9} width={68} height={18} rx={9} fill="rgba(11,18,11,0.9)" stroke={GOLD} strokeWidth={1} />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill={GOLD}>
                    {isRotatingThis
                      ? `${Math.round(rot)}°`
                      : def.shape === 'circle'
                        ? `⌀ ${wM.toFixed(1)} m`
                        : `${wM.toFixed(1)} × ${hM.toFixed(1)} m`}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Item label pills, laid out as ONE set ──────────────────────────────────────────
            Drawn after every footprint so a pill is never buried under a neighbour's canopy, and
            laid out through layoutCanvasLabels so pills that would overlap get pushed apart and
            given a leader line home. This used to be a fixed offset inside the per-item loop, with
            overlaps resolved by paint order alone: measured on a 7-plant guild at real spacing,
            FOUR of seven pills sat closer to a neighbour's icon than to their own, which is why
            the map appeared to name the wrong plant. */}
        {activeLayers.labels && (() => {
          const PILL_FS = 9, PILL_PADX = 5, PILL_H = 16, PILL_MAX = 120;
          const shown = state.items
            .map((item) => {
              const def = ELEMENTS_BY_ID[item.defId];
              if (!def) return null;
              if (!activeLayers[categoryLayerKey(def.category)]) return null;
              const [nx, ny] = effectiveItemPos(item);
              const isResizingThis = item.id === dragResizeId.current && resizePreview;
              const wM = isResizingThis ? resizePreview!.wM : item.wM ?? def.wM;
              const hM = isResizingThis ? resizePreview!.hM : item.hM ?? def.hM;
              const wPx = Math.max(wM / mPerPx, 6);
              const hPx = Math.max(hM / mPerPx, 6);
              const text = item.note
                ? `${item.label ?? def.name} · ${item.note}`
                : item.label ?? def.name;
              // Gap is measured off the ICON DISC, not the footprint. It used to be hPx/2 + 9 —
              // half of THIS plant's own canopy — so a 9 m macadamia's pill sat ~29 units below its
              // icon while a 2.5 m pawpaw's sat ~9 below, and pills from icons at different heights
              // converged into one band while their icons stayed spread out.
              const iconDiscR = activeLayers.symbols ? clamp(6, Math.min(wPx, hPx) * 0.28, 11) : 0;
              return {
                id: item.id,
                cx: nx * imgW,
                cy: ny * imgH,
                gap: iconDiscR + 9,
                iconR: iconDiscR,
                // Counter-scaled by view.k so a pill is a fixed SCREEN size: zooming in spreads the
                // icons while the pills stay put, which is what makes a dense orchard readable.
                w: estimatePillWidth(text, PILL_FS, PILL_PADX, PILL_MAX) / view.k,
                h: PILL_H / view.k,
                text,
              };
            })
            .filter((v): v is NonNullable<typeof v> => !!v && isUsableCanvasLabelInput(v));
          if (!shown.length) return null;
          const laid = layoutCanvasLabels(shown);
          return (
            <g pointerEvents="none">
              {laid.map((pos, i) => {
                const s = shown[i];
                return (
                  <g key={s.id}>
                    {/* Leader only when de-collision actually moved the pill — an un-moved pill is
                        already unambiguous, and a line to every pill is just more clutter. */}
                    {pos.moved && (
                      <line
                        x1={s.cx}
                        y1={s.cy + s.gap}
                        x2={pos.x}
                        y2={pos.y}
                        stroke="rgba(244,237,216,0.55)"
                        strokeWidth={1 / view.k}
                      />
                    )}
                    <g transform={`translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) scale(${(1 / view.k).toFixed(3)})`}>
                      <foreignObject x={-PILL_MAX / 2} y={-PILL_H / 2} width={PILL_MAX} height={PILL_H} style={{ overflow: 'visible' }}>
                        {/* Flex-centred: the pill is an inline-block that shrinks to its text, so in
                            a fixed-width box it used to sit hard LEFT, pulling a short name toward
                            whichever neighbour was on that side. */}
                        <div style={{ display: 'flex', justifyContent: 'center', width: PILL_MAX }}>
                          <div
                            style={{
                              fontSize: PILL_FS,
                              lineHeight: '14px',
                              textAlign: 'center',
                              color: '#F4EDD8',
                              background: 'rgba(32,25,15,0.74)',
                              borderRadius: 8,
                              padding: `1px ${PILL_PADX}px`,
                              display: 'inline-block',
                              maxWidth: PILL_MAX,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {s.text}
                          </div>
                        </div>
                      </foreignObject>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* AI auto-detect ghosts — 'pending' suggestions rendered as dashed outlines.
            pointerEvents none throughout so they never block placing/drawing/selecting. */}
        {suggestions
          ?.filter((s) => s.status === 'pending')
          .map((s) => {
            // Zone suggestions: translucent fill in the target zone's colour + a "Z{n}?" pill
            // at the ring centroid, distinct from the generic vision-kind cyan ghosts.
            if (s.kind === 'zone' && s.points.length >= 3 && s.zone !== undefined) {
              const zoneDef = ZONE_DEFS[s.zone];
              const centroid = ringCentroid(s.points);
              return (
                <g key={s.id} pointerEvents="none" opacity={0.85}>
                  <polygon
                    points={ringToPx(s.points, imgW, imgH)}
                    fill={zoneDef.color}
                    fillOpacity={0.16}
                    stroke={zoneDef.color}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <g transform={`translate(${(centroid[0] * imgW).toFixed(1)},${(centroid[1] * imgH).toFixed(1)})`}>
                    <rect x={-18} y={-9} width={36} height={18} rx={9} fill="rgba(11,18,11,0.85)" stroke={zoneDef.color} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill={zoneDef.color}>
                      Z{s.zone}?
                    </text>
                  </g>
                </g>
              );
            }

            // Point-like local generators (greywater/compost/beehive/veg_bed/nursery): render
            // as a circle ghost at sizeM (default 2m), same cyan-dashed style as vision points.
            const isLocalPoint =
              (s.kind === 'greywater' || s.kind === 'compost' || s.kind === 'beehive' || s.kind === 'veg_bed' || s.kind === 'nursery') &&
              s.points.length >= 1;
            if (isLocalPoint) {
              const [px, py] = s.points[0];
              return (
                <g key={s.id} pointerEvents="none" opacity={0.7}>
                  <circle
                    cx={px * imgW}
                    cy={py * imgH}
                    r={Math.max((s.sizeM ?? 2) / mPerPx / 2, 4)}
                    fill="none"
                    stroke={CYAN}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <g transform={`translate(${(px * imgW).toFixed(1)},${(py * imgH - 12).toFixed(1)})`}>
                    <rect x={-16} y={-9} width={32} height={16} rx={8} fill="rgba(11,18,11,0.85)" stroke={CYAN} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill={CYAN}>
                      AI?
                    </text>
                  </g>
                </g>
              );
            }

            // 'swale' generator: dashed cyan polyline, same treatment as vision line kinds.
            const isArea = s.kind === 'veg_area' && s.points.length >= 3;
            const isPoint = s.points.length === 1;
            const isLine = !isArea && s.points.length >= 2;
            const labelPt = isPoint ? s.points[0] : ringCentroid(s.points);
            return (
              <g key={s.id} pointerEvents="none" opacity={0.7}>
                {isPoint && (
                  <circle
                    cx={s.points[0][0] * imgW}
                    cy={s.points[0][1] * imgH}
                    r={Math.max((s.sizeM ?? 3) / mPerPx / 2, 4)}
                    fill="none"
                    stroke={CYAN}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                )}
                {isArea && (
                  <polygon
                    points={ringToPx(s.points, imgW, imgH)}
                    fill={CYAN}
                    fillOpacity={0.1}
                    stroke={CYAN}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                )}
                {isLine && (
                  <polyline
                    points={polylinePoints(s.points, imgW, imgH)}
                    fill="none"
                    stroke={CYAN}
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                  />
                )}
                {labelPt && (
                  <g transform={`translate(${(labelPt[0] * imgW).toFixed(1)},${(labelPt[1] * imgH - 12).toFixed(1)})`}>
                    <rect x={-16} y={-9} width={32} height={16} rx={8} fill="rgba(11,18,11,0.85)" stroke={CYAN} strokeWidth={1} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={9} fontWeight={700} fill={CYAN}>
                      AI?
                    </text>
                  </g>
                )}
              </g>
            );
          })}

        {/* Marquee (drag-rectangle multi-select) — light dashed selection rectangle, drawn last
            in world-space so it always sits on top of every shape while dragging. Coordinates are
            already normalised [0..1] world-space (see marqueeState above), so ×imgW/×imgH is the
            only conversion needed — no extra transform, matching every other shape in this group. */}
        {marqueeRect && (() => {
          const x = Math.min(marqueeRect.x0, marqueeRect.x1) * imgW;
          const y = Math.min(marqueeRect.y0, marqueeRect.y1) * imgH;
          const w = Math.abs(marqueeRect.x1 - marqueeRect.x0) * imgW;
          const h = Math.abs(marqueeRect.y1 - marqueeRect.y0) * imgH;
          return (
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={GOLD}
              fillOpacity={0.12}
              stroke={GOLD}
              strokeWidth={worldPx(1.5)}
              strokeDasharray={`${worldPx(6)} ${worldPx(4)}`}
              pointerEvents="none"
            />
          );
        })()}

        {/* Tidy outline preview (lib/tidy-outline.ts) — the shape's NORMAL rendering above is
            untouched (nothing has been committed yet); this draws the CANDIDATE simplified
            outline as a distinct ghost on top of it, in world-space so it pans/zooms with the
            map exactly like the real shape does. Only drawn when there is something to show
            (canConfirm — an "already tidy"/rejected preview has tidiedPoints identical to the
            original, so overlaying it would just be a confusing duplicate outline). Drawn last
            (after the marquee) so it is never hidden behind a real shape. */}
        {tidyPreview && tidyPreview.canConfirm && (
          <g pointerEvents="none">
            {tidyPreview.kind === 'zone' ? (
              <polygon
                points={ringToPx(tidyPreview.tidiedPoints, imgW, imgH)}
                fill="none"
                stroke={TIDY_PREVIEW}
                strokeWidth={worldPx(2.5)}
                strokeDasharray={`${worldPx(3)} ${worldPx(3)}`}
              />
            ) : (
              <polyline
                points={polylinePoints(tidyPreview.tidiedPoints, imgW, imgH)}
                fill="none"
                stroke={TIDY_PREVIEW}
                strokeWidth={worldPx(3)}
                strokeDasharray={`${worldPx(3)} ${worldPx(3)}`}
                strokeLinecap="round"
              />
            )}
            {tidyPreview.tidiedPoints.map(([x, y], i) => (
              <circle
                key={i}
                cx={x * imgW}
                cy={y * imgH}
                r={worldPx(3.5)}
                fill={TIDY_PREVIEW}
                stroke="#0B120B"
                strokeWidth={worldPx(1)}
              />
            ))}
          </g>
        )}

        {/* Batch Snap preview — normal rings stay untouched; every safe candidate is drawn as a
            distinct ghost. Vetoed rings have no ghost and are named in the preview summary. */}
        {snapPreview && snapPreview.canConfirm && (
          <g pointerEvents="none">
            {snapPreview.rings.map((ring) => (
              <g key={ring.id}>
                <polygon
                  points={ringToPx(ring.points, imgW, imgH)}
                  fill="none"
                  stroke={SNAP_PREVIEW}
                  strokeWidth={worldPx(2.5)}
                  strokeDasharray={`${worldPx(3)} ${worldPx(3)}`}
                />
                {ring.points.map(([x, y], i) => (
                  <circle
                    key={i}
                    cx={x * imgW}
                    cy={y * imgH}
                    r={worldPx(3.5)}
                    fill={SNAP_PREVIEW}
                    stroke="#0B120B"
                    strokeWidth={worldPx(1)}
                  />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* Clean up preview (lib/align-items.ts) — same idiom as Tidy/Snap directly above: the
            group's NORMAL rendering is untouched; this draws each item's CANDIDATE aligned
            position/rotation as a distinct ghost footprint on top. wM/hM/shape/colour are read
            from the ORIGINAL PlacedItem in state.items (cleanupPreview.items — lib/align-items.ts's
            AlignedItem — physically cannot carry them, see the prop's own doc comment above), the
            same def lookup the real item-rendering loop above already does. Only drawn when
            canConfirm (a "nothing to align"/rejected preview has items identical to the
            originals). Drawn last so it is never hidden behind a real shape. */}
        {cleanupPreview && cleanupPreview.canConfirm && (
          <g pointerEvents="none">
            {cleanupPreview.items.map((aligned) => {
              const orig = state.items.find((it) => it.id === aligned.id);
              if (!orig) return null;
              const def = ELEMENTS_BY_ID[orig.defId];
              if (!def) return null;
              const wM = orig.wM ?? def.wM;
              const hM = orig.hM ?? def.hM;
              const wPx = Math.max(wM / mPerPx, 6);
              const hPx = Math.max(hM / mPerPx, 6);
              const cx = aligned.x * imgW;
              const cy = aligned.y * imgH;
              const rot = def.shape === 'rect' ? aligned.rot ?? 0 : 0;
              const rotXf = rot ? `rotate(${rot})` : undefined;
              return (
                <g key={aligned.id} transform={`translate(${cx.toFixed(1)},${cy.toFixed(1)})`}>
                  <g transform={rotXf}>
                    {def.shape === 'circle' ? (
                      <circle
                        r={wPx / 2}
                        fill="none"
                        stroke={CLEANUP_PREVIEW}
                        strokeWidth={worldPx(2.5)}
                        strokeDasharray={`${worldPx(3)} ${worldPx(3)}`}
                      />
                    ) : (
                      <rect
                        x={-wPx / 2}
                        y={-hPx / 2}
                        width={wPx}
                        height={hPx}
                        fill="none"
                        stroke={CLEANUP_PREVIEW}
                        strokeWidth={worldPx(2.5)}
                        strokeDasharray={`${worldPx(3)} ${worldPx(3)}`}
                        rx={3}
                      />
                    )}
                  </g>
                  <circle cx={0} cy={0} r={worldPx(3.5)} fill={CLEANUP_PREVIEW} stroke="#0B120B" strokeWidth={worldPx(1)} />
                </g>
              );
            })}
          </g>
        )}

        </g>
        {/* End world-space transform group — everything below is a fixed screen-space overlay. */}

        {/* North arrow — top-right, drawn last so it always sits on top. */}
        <g transform={`translate(${imgW - 34}, 34)`} pointerEvents="none">
          <circle r={19} fill="rgba(11,18,11,0.72)" />
          <path d="M0,-12 L6,8 L0,4 L-6,8 Z" fill="#FBF6EC" />
          <text x={0} y={-16} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FBF6EC">
            N
          </text>
        </g>

        {/* Scale bar — bottom-left, drawn last so it always sits on top. Metres-per-viewBox-px
            at the current zoom is mPerPx/k (the world is scaled by k on screen), so the bar
            length for N metres is (N/mPerPx)*k viewBox px. */}
        {(() => {
          const mPerPxOnScreen = mPerPx / view.k;
          const barM = pickScaleBarM(imgW, mPerPxOnScreen);
          const barPx = (barM / mPerPx) * view.k;
          const x0 = 16;
          const y0 = imgH - 20;
          return (
            <g pointerEvents="none">
              <rect
                x={x0 - 8}
                y={y0 - 14}
                width={barPx + 16}
                height={26}
                rx={6}
                fill="rgba(11,18,11,0.72)"
              />
              <line x1={x0} y1={y0} x2={x0 + barPx} y2={y0} stroke="#FBF6EC" strokeWidth={2.5} />
              <line x1={x0} y1={y0 - 4} x2={x0} y2={y0 + 4} stroke="#FBF6EC" strokeWidth={2} />
              <line x1={x0 + barPx} y1={y0 - 4} x2={x0 + barPx} y2={y0 + 4} stroke="#FBF6EC" strokeWidth={2} />
              <text x={x0 + barPx / 2} y={y0 - 8} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#FBF6EC">
                {barM} m
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Contours note — top-centre. Shown only when the layer is on so the farmer knows the
          lines are a slope-based guide (and why they're absent on flat ground). */}
      {activeLayers.contours && contours.status !== 'unavailable' && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '80%',
            padding: '5px 12px',
            borderRadius: 14,
            background: 'rgba(11,18,11,0.82)',
            color: '#F4EDD8',
            fontSize: 11.5,
            fontWeight: 600,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {contours.tooFlat
            ? t('designCanvasFlatContours')
            : formatDesignTranslation(t('designCanvasContourInterval'), { interval: contours.intervalM })}
        </div>
      )}

      {/* Sector honest-degradation note — one small muted chip carrying the strongest caveat
          (e.g. "open this place on the map to fetch climate & slope"), so missing energies read as
          "not analysed yet", not "no wind here". Nudged below the contours note when both are on.
          effectiveWindNote (a farmer's on-site wind confirmation) takes priority when present —
          positive confirmation feedback outranks an unrelated caveat in the one-line slot. */}
      {activeLayers.sector && sectorModel && (effectiveWindNote || sectorModel.dataNotes.length > 0) && (
        <div
          style={{
            position: 'absolute',
            top: activeLayers.contours ? 46 : 12,
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '80%',
            padding: '4px 11px',
            borderRadius: 14,
            background: 'rgba(11,18,11,0.7)',
            color: '#D8CFB8',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {effectiveWindNote ?? sectorModel.dataNotes[0]}
        </div>
      )}

      {/* Quick base-map declutter — top-left. Toggles the "Base map" layer (boundary +
          auto-detected/traced underlay) so the farmer can clear the satellite in one tap
          while placing/drawing. Same state as the "Base map" chip in the palette. */}
      {onToggleBaseMap && (
        <button
          type="button"
          aria-label={t(activeLayers.baseMap ? 'designCanvasHideBase' : 'designCanvasShowBase')}
          title={t(activeLayers.baseMap ? 'designCanvasBaseShown' : 'designCanvasBaseHidden')}
          onClick={onToggleBaseMap}
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            border: 'none',
            background: 'rgba(11,18,11,0.82)',
            color: '#FBF6EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            opacity: activeLayers.baseMap ? 1 : 0.7,
          }}
        >
          {activeLayers.baseMap ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      )}

      {/* Sector energies toggle (top-left, below base-map) — the discoverable twin of the Layers
          popover entry, so the sun/wind/fire/water overlay is one tap away, not buried. Shows
          whenever the site has a usable latitude (sectorModel is then non-null; the sun always
          draws). Highlights gold when on, like the multi-select control. */}
      {onToggleSector && sectorModel && (
        <button
          type="button"
          aria-pressed={!!activeLayers.sector}
          aria-label={t(activeLayers.sector ? 'designCanvasSectorOn' : 'designCanvasShowSector')}
          title={t(activeLayers.sector ? 'designCanvasSectorShown' : 'designCanvasSectorHidden')}
          onClick={onToggleSector}
          style={{
            position: 'absolute',
            top: 60,
            left: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            border: activeLayers.sector ? `2px solid ${GOLD}` : 'none',
            background: activeLayers.sector ? 'rgba(31,77,43,0.92)' : 'rgba(11,18,11,0.82)',
            color: activeLayers.sector ? GOLD : '#FBF6EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            cursor: 'pointer',
          }}
        >
          ☀️
        </button>
      )}

      {/* Multi-select toggle (top-left, below the sector button). On phones there's no Shift/Cmd,
          so this makes a plain tap ADD to the selection; tap it off to go back to single-select.
          A count pill appears when 2+ are selected — Delete (palette/keyboard) removes them all. */}
      {onToggleAdditive && tool === 'select' && (
        <button
          type="button"
          aria-pressed={!!additiveSelect}
          aria-label={t(additiveSelect ? 'designCanvasMultiOn' : 'designCanvasSelectMultiple')}
          title={t(additiveSelect ? 'designCanvasSelectingMultiple' : 'designCanvasSelectMultiple')}
          onClick={onToggleAdditive}
          style={{
            position: 'absolute',
            top: 108,
            left: 12,
            minWidth: 40,
            height: 40,
            padding: selectedIds.length > 1 ? '0 12px' : 0,
            borderRadius: 20,
            border: additiveSelect ? `2px solid ${GOLD}` : 'none',
            background: additiveSelect ? 'rgba(31,77,43,0.92)' : 'rgba(11,18,11,0.82)',
            color: additiveSelect ? GOLD : '#FBF6EC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            fontSize: 12.5,
            fontWeight: 800,
          }}
        >
          <CopyCheck size={18} />
          {selectedIds.length > 1 && <span>{selectedIds.length}</span>}
        </button>
      )}

      {/* Zoom controls — floating column bottom-right, above the scale bar. Bottom offset adds
          the iOS home-indicator safe area (see app/layout.tsx's viewport-fit=cover — without
          it env() here is always 0) so this doesn't sit under/behind the gesture bar when the
          canvas is the last thing on screen (e.g. chrome collapsed). */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(56px + env(safe-area-inset-bottom))',
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {[
          { label: '+', onClick: () => zoomAbout(imgW / 2, imgH / 2, 1.3) },
          { label: '−', onClick: () => zoomAbout(imgW / 2, imgH / 2, 1 / 1.3) },
          { label: '⤢', onClick: runAutoFit },
        ].map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 'none',
              background: 'rgba(11,18,11,0.82)',
              color: '#FBF6EC',
              fontWeight: 700,
              fontSize: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Draw-action cluster — grouped bottom-CENTER, deliberately not bottom-left or
          bottom-right: the Lima advisor (DesignAdvisor.tsx) explicitly claims bottom-left
          ("Anchored BOTTOM-LEFT of the canvas area") and the zoom controls below claim
          bottom-right, so this used to sit at bottom:12/left:12 — almost the exact same
          rectangle as Lima's shell (bottom:10/left:10) — and Lima's higher z-index (40 vs
          this cluster's old 6) meant its chip/card rendered ON TOP of Cancel/Point/Finish
          whenever a tip was showing mid-draw (Rory: "buttons are covered by the lima
          button"). Centering gives it its own lane with real clearance from both corners,
          not just a z-index nudge. Cancel · Point · Finish read left→right; Finish is the
          prominent, pulsing primary. */}
      {(tool === 'zone' || tool === 'line') && draftPoints.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap',
            maxWidth: 'calc(100% - 24px)',
            zIndex: 20,
          }}
        >
          <style>{`@keyframes imbewuFinishPulse{0%,100%{box-shadow:0 3px 14px rgba(0,0,0,0.4),0 0 0 3px rgba(31,77,43,0.30)}50%{box-shadow:0 3px 14px rgba(0,0,0,0.4),0 0 0 8px rgba(31,77,43,0.12)}}`}</style>
          <button
            type="button"
            onClick={() => setDraftPoints([])}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,254,250,0.92)', color: '#0B120B', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          >
            {t('designCanvasCancel')}
          </button>
          <button
            type="button"
            onClick={() => setDraftPoints((prev) => prev.slice(0, -1))}
            style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,254,250,0.92)', color: '#0B120B', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
          >
            {t('designCanvasPoint')}
          </button>
          {draftPoints.length >= (tool === 'zone' ? 3 : 2) && (
            <button
              type="button"
              onClick={() => (tool === 'zone' ? commitZone(draftPoints) : commitLine(draftPoints))}
              style={{
                minHeight: 52,
                padding: '0 20px',
                borderRadius: 26,
                border: '2px solid #FBF6EC',
                background: '#1F4D2B',
                color: '#FBF6EC',
                fontWeight: 800,
                fontSize: 16,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                animation: 'imbewuFinishPulse 1.8s ease-in-out infinite',
              }}
            >
              {formatDesignTranslation(t('designCanvasFinish'), {
                thing: tool === 'line'
                  ? t('designCanvasLine')
                  : areaFeature
                    ? GROUND_FEATURES[areaFeature].label
                    : formatDesignTranslation(t('designCanvasZone'), { zone: zoneDraw }),
              })}
            </button>
          )}
        </div>
      )}

      {/* Tidy outline preview panel — same bottom-CENTER slot/idiom as the Draw-action cluster
          above (they never show at once: this only appears in the select tool with a single
          zone/line selected). The plain-language summary is the whole point of "explicit,
          previewed" — a farmer confirms or cancels an honest sentence, never a silent rewrite.
          Confirm is omitted entirely when canConfirm is false (tidying would change nothing —
          "offer no destructive action"), leaving just the explanation and a Close button. */}
      {tidyPreview && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            maxWidth: 'calc(100% - 24px)',
            zIndex: 20,
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 14,
              background: 'rgba(11,18,11,0.88)',
              color: '#F4EDD8',
              fontSize: 12.5,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {tidyPreview.summary}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onCancelTidy?.()}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,254,250,0.92)', color: '#0B120B', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
            >
              {tidyPreview.canConfirm ? t('designCanvasCancel') : t('designCanvasClose')}
            </button>
            {tidyPreview.canConfirm && (
              <button
                type="button"
                onClick={() => onConfirmTidy?.()}
                style={{
                  minHeight: 52,
                  padding: '0 20px',
                  borderRadius: 26,
                  border: '2px solid #FBF6EC',
                  background: '#1F4D2B',
                  color: '#FBF6EC',
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t('designCanvasTidy')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Snap-to-neighbour preview panel — same bottom-CENTER slot/idiom as the Tidy outline
          preview panel directly above (app/design/page.tsx keeps tidyPreview and snapPreview
          mutually exclusive, so the two never show at once). Confirm is omitted entirely when
          canConfirm is false (nothing was within tolerance — "offer no destructive action"),
          leaving just the explanation and a Close button. */}
      {snapPreview && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            maxWidth: 'calc(100% - 24px)',
            zIndex: 20,
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 14,
              background: 'rgba(11,18,11,0.88)',
              color: '#F4EDD8',
              fontSize: 12.5,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {snapPreview.summary}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onCancelSnap?.()}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,254,250,0.92)', color: '#0B120B', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
            >
              {snapPreview.canConfirm ? t('designCanvasCancel') : t('designCanvasClose')}
            </button>
            {snapPreview.canConfirm && (
              <button
                type="button"
                onClick={() => onConfirmSnap?.()}
                style={{
                  minHeight: 52,
                  padding: '0 20px',
                  borderRadius: 26,
                  border: '2px solid #FBF6EC',
                  background: '#1F4D2B',
                  color: '#FBF6EC',
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t('designCanvasSnap')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Clean up preview panel — same bottom-CENTER slot/idiom as the Tidy outline and
          Snap-to-neighbour preview panels above (app/design/page.tsx keeps tidyPreview,
          snapPreview and cleanupPreview mutually exclusive, so at most one ever shows at once).
          Confirm is omitted entirely when canConfirm is false (cleaning up would change nothing —
          "offer no destructive action"), leaving just the explanation and a Close button. */}
      {cleanupPreview && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(12px + env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            maxWidth: 'calc(100% - 24px)',
            zIndex: 20,
          }}
        >
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 14,
              background: 'rgba(11,18,11,0.88)',
              color: '#F4EDD8',
              fontSize: 12.5,
              fontWeight: 600,
              textAlign: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {cleanupPreview.summary}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onCancelCleanup?.()}
              style={{ minHeight: 44, padding: '0 14px', borderRadius: 22, border: '1px solid rgba(0,0,0,0.15)', background: 'rgba(255,254,250,0.92)', color: '#0B120B', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}
            >
              {cleanupPreview.canConfirm ? t('designCanvasCancel') : t('designCanvasClose')}
            </button>
            {cleanupPreview.canConfirm && (
              <button
                type="button"
                onClick={() => onConfirmCleanup?.()}
                style={{
                  minHeight: 52,
                  padding: '0 20px',
                  borderRadius: 26,
                  border: '2px solid #FBF6EC',
                  background: '#1F4D2B',
                  color: '#FBF6EC',
                  fontWeight: 800,
                  fontSize: 16,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t('designCanvasCleanup')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
