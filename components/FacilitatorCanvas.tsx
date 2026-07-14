'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Transformer, Group, Arc, Shape, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { ImageIcon, Ruler, Copy, X, Loader2, Sparkles, Download, Share2, Sprout, Check, LayoutGrid, ClipboardList, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { listFarmers, saveDesign, updateDesign, myDesigns, deleteDesign, shareDesign } from '@/lib/db/queries';
import type { Profile, Design } from '@/lib/db/types';
import { loadPlaces, resolveColor, type SavedPlace } from '@/lib/saved-places';
import { designSiteIdFromLocation, loadDesignStudioState, mergeFarmShapesIntoDesignState } from '@/lib/design-studio';
import { readLocalFarmShapes } from '@/lib/map-sync';
import { computeCanvasFrame, fetchImageAsDataUrl, makeMercatorProjector, makeMercatorUnprojector } from '@/lib/design-canvas';
import type { LocationData } from '@/lib/types';
import type { ElType, LineKind, LayerId, SectorKind, SectorEl, GhostFeature, DetectResponse, FacItem, FacLine, FacSector, BgRect, FacilitatorDesignState } from '@/lib/facilitator-design';
import {
  LAYERS, LAYER_ORDER, SECTOR_DEFS, layerForItem, layerForLine, POLYGON_LINE_KINDS, AREA_LINE_KINDS,
  coachTip, type CoachCounts,
  saveFacilitatorState, loadFacilitatorState, clearFacilitatorState,
  buildGhosts,
  DEFAULT_PX_PER_M, geomPxToM, geomMToPx,
} from '@/lib/facilitator-design';
import { costForItem, costForLine, costForAreaLine, formatZar, DISCLAIMER } from '@/lib/price-book';
import { describeHarvest } from '@/lib/water-calc';
import { requestRender, stripDataUrl, pollFalRender } from '@/lib/ai-render-client';
import { compositeAccurateMap, boundaryStageToOutput, estimateBlankFraction, type ProducerLabel, type LabelStyle } from '@/lib/image-producer';

// The four researched producer styles (see /api/image-producer STYLE_LINES).
const PRODUCER_STYLES: { key: string; name: string; blurb: string; label: LabelStyle }[] = [
  { key: 'field_ledger',        name: 'Field Ledger',        blurb: 'simple hand-drawn plan',            label: 'ink' },
  { key: 'homestead_storybook', name: 'Homestead Storybook', blurb: 'warm illustrated map',              label: 'storybook' },
  { key: 'extension_blueprint', name: 'Extension Blueprint', blurb: 'clear plan for funders & mentors',  label: 'blueprint' },
  { key: 'karoo_folk',          name: 'Karoo Folk Map',      blurb: 'colourful community presentation',  label: 'folk' },
];

// ── Guided mode ─────────────────────────────────────────────────────────────
// The simple farmer-facing flow: four plain questions, one at a time, with a
// tiny tool tray. The full designer ("Pro") stays intact behind a toggle.
// There are NO layer tabs here — semantic layer resolution (layerForItem /
// layerForLine) files whatever the farmer adds onto the right map underneath.
const GUIDED_STEPS: { key: string; icon: string; title: string; instruction: string; layer: LayerId }[] = [
  { key: 'setup', icon: '🛰', title: 'Set up your land',        instruction: 'Load your land — the photo, boundary and scale come in from the map.', layer: 'base' },
  { key: 'here',  icon: '🏠', title: 'What is here now?',       instruction: 'Tap a button below, then tap the map to mark what already exists.',    layer: 'existing' },
  { key: 'add',   icon: '🌱', title: 'What do you want to add?', instruction: 'Pick a thing, then tap the map where it should go.',                  layer: 'planting' },
  { key: 'plan',  icon: '🎨', title: 'Your farm plan',           instruction: 'Check the cost, then make your finished map.',                        layer: 'review' },
];
// Small curated palettes — the full catalog lives in Pro mode.
const GUIDED_HERE_TYPES: ElType[] = ['tree', 'shed', 'well'];
const GUIDED_HERE_LINES: LineKind[] = ['building', 'driveway', 'fence', 'path'];
const GUIDED_ADD_TYPES: ElType[] = ['tank', 'bed', 'tree', 'coop', 'compost', 'beehive', 'greenhouse', 'shed'];
const GUIDED_ADD_LINES: LineKind[] = ['driveway', 'patio', 'fence', 'path', 'pipe'];
import { getFirebase } from '@/lib/firebase/init';

interface Cat { label: string; icon: string; shape: 'rect' | 'circle'; w: number; h: number; spec?: string; litres?: number; fill: string }

const CATALOG: Record<ElType, Cat> = {
  // Water
  tank:       { label: 'JoJo tank',    icon: '🛢',  shape: 'circle', w: 1.8, h: 1.8, spec: '5000 L', litres: 5000, fill: '#3E7BB0' },
  pond:       { label: 'Pond / dam',   icon: '💧',  shape: 'circle', w: 6,   h: 6,   fill: '#2F6586' },
  well:       { label: 'Well / bore',  icon: '⛲',  shape: 'circle', w: 1.2, h: 1.2, fill: '#3A3030' },
  reedbed:    { label: 'Reed bed',     icon: '🌾',  shape: 'rect',   w: 3,   h: 2,   fill: '#4A6A30' },
  // Beds & plants
  bed:        { label: 'Veg bed',      icon: '🥬',  shape: 'rect',   w: 1,   h: 3,   fill: '#3F7A3C' },
  hugel:      { label: 'Hugelkultur',  icon: '🪵',  shape: 'rect',   w: 2,   h: 5,   fill: '#6B4C2A' },
  banana:     { label: 'Banana circle',icon: '🍌',  shape: 'circle', w: 3,   h: 3,   fill: '#2A5A1A' },
  tree:       { label: 'Fruit tree',   icon: '🌳',  shape: 'circle', w: 4,   h: 4,   fill: '#2C5E33' },
  foodforest: { label: 'Food forest',  icon: '🌲',  shape: 'circle', w: 8,   h: 8,   fill: '#1A3A18' },
  herb:       { label: 'Herb spiral',  icon: '🌀',  shape: 'circle', w: 2,   h: 2,   fill: '#6E8B3D' },
  shrub:      { label: 'Shrub',        icon: '🪴',  shape: 'circle', w: 1.5, h: 1.5, fill: '#4E8B4A' },
  // Structures
  coop:       { label: 'Chicken coop', icon: '🐔',  shape: 'rect',   w: 2,   h: 3,   fill: '#9A6A34' },
  compost:    { label: 'Compost',      icon: '♻',   shape: 'rect',   w: 1.5, h: 1.5, fill: '#5E4E32' },
  greenhouse: { label: 'Greenhouse',   icon: '🏡',  shape: 'rect',   w: 4,   h: 8,   fill: '#6B8A9A' },
  tunnel:     { label: 'Polytunnel',   icon: '⛺',  shape: 'rect',   w: 3,   h: 6,   fill: '#5E86A8' },
  shed:       { label: 'Shed',         icon: '🏚',  shape: 'rect',   w: 2.5, h: 3,   fill: '#6E6757' },
  beehive:    { label: 'Beehive',      icon: '🐝',  shape: 'circle', w: 1,   h: 1,   fill: '#8A5A14' },
  biogas:     { label: 'Biogas',       icon: '⚗',   shape: 'circle', w: 2,   h: 2,   fill: '#5A4A7A' },
  nursery:    { label: 'Nursery',      icon: '🌱',  shape: 'rect',   w: 3,   h: 4,   fill: '#3A5E30' },
  // Earthworks
  swalew:     { label: 'Swale (berm)', icon: '〰',  shape: 'rect',   w: 8,   h: 1.5, fill: '#3A5A2A' },
  firebreak:  { label: 'Firebreak',    icon: '🔥',  shape: 'rect',   w: 10,  h: 2,   fill: '#8A6040' },
};

const GROUPS: { name: string; types: ElType[] }[] = [
  { name: 'Water',      types: ['tank', 'pond', 'well', 'reedbed'] },
  { name: 'Beds & plants', types: ['bed', 'hugel', 'banana', 'tree', 'foodforest', 'herb', 'shrub'] },
  { name: 'Structures', types: ['coop', 'compost', 'greenhouse', 'tunnel', 'shed', 'beehive', 'biogas', 'nursery'] },
  { name: 'Earthworks', types: ['swalew', 'firebreak'] },
];

// Area (polygon) kinds get a `fill` — drawn as a tinted shape, not just a
// stroked outline, since they represent ground coverage (roof/driveway/patio)
// rather than a linear run like a fence or pipe.
const LINES: Record<LineKind, { label: string; icon: string; color: string; dash: number[]; width: number; fill?: string }> = {
  pipe:      { label: 'Pipe',       icon: '〰', color: '#5B9ED4', dash: [9, 5],   width: 3 },
  swale:     { label: 'Swale',      icon: '⌇', color: '#7AAA50', dash: [3, 5],   width: 4 },
  windbreak: { label: 'Windbreak',  icon: '🌿', color: '#3A7A30', dash: [],       width: 8 },
  drip:      { label: 'Drip line',  icon: '·', color: '#4A9ED4', dash: [2, 4],   width: 1.5 },
  contour:   { label: 'Contour',    icon: '~', color: '#B89A60', dash: [6, 4],   width: 2 },
  fence:     { label: 'Fence',      icon: '┃', color: '#C2A878', dash: [],       width: 2.5 },
  path:      { label: 'Path',       icon: '⋯', color: '#C9B896', dash: [],       width: 7 },
  building:  { label: 'Building',   icon: '▢', color: '#5A5448', dash: [],       width: 2.5, fill: 'rgba(90,84,72,0.28)' },
  driveway:  { label: 'Driveway',   icon: '🚗', color: '#8A7F6B', dash: [],       width: 2.5, fill: 'rgba(138,127,107,0.32)' },
  patio:     { label: 'Patio',      icon: '▦', color: '#B08A5A', dash: [],       width: 2.5, fill: 'rgba(176,138,90,0.30)' },
  waterbody: { label: 'Dam / pond', icon: '🌊', color: '#3E7BB0', dash: [],       width: 2.5, fill: 'rgba(62,123,176,0.32)' },
};

interface Item { id: string; type: ElType; x: number; y: number; wM: number; hM: number; rotation: number; litres?: number; layer?: LayerId; label?: string; species?: string; count?: number }

// A custom label (e.g. "Mango tree" instead of the generic "Fruit tree")
// overrides the catalog name everywhere a label is shown or grouped — live
// map pills, produced-map labels, and the AI prompt context. BOQ rows stay
// grouped by TYPE regardless (pricing is per-type, not per custom name).
const effectiveLabel = (it: { type: ElType; label?: string }): string => it.label?.trim() || CATALOG[it.type].label;

// Placement-time prompt vocabularies — common JoJo tank sizes (SA market) and
// common SA fruit tree species. "Banana (single plant)" is deliberately
// distinct from CATALOG.banana ("Banana circle", a guild-planting element
// priced per_m2) — this picks the species for a single 🌳 Fruit tree marker,
// not the guild circle.
const TANK_SIZE_OPTIONS_L = [750, 1000, 2500, 5000, 10000];
const TREE_SPECIES_OPTIONS = ['Mango', 'Avocado', 'Lemon', 'Orange', 'Guava', 'Banana (single plant)', 'Mulberry', 'Pawpaw', 'Peach'];

interface LineEl { id: string; kind: LineKind; points: number[]; closed?: boolean; layer?: LayerId }

// ── AI polish ────────────────────────────────────────────────────────────
// Explicit, controlled beautify pass — state machine for the modal driven by
// runAiPolishWith (see below, near exportPNG/shareBudgetOnWhatsApp).
//
// Phases: idle → pick (choose which layers to polish) → preparing → painting
// → done, or error at any point after pick. "Add another map" from done loops
// back to pick. hiddenLayers is only ever mutated between the start of
// runAiPolishWith and its single restore path (success OR error) — the pick
// phase itself never touches visibility, so closing the modal from pick is
// always a no-op on the user's 👁 state.
type AiPolishState =
  | { phase: 'idle' }
  | { phase: 'pick'; selected: LayerId[]; mode?: 'polish' | 'producer' }
  | { phase: 'preparing'; label: string }
  | { phase: 'painting'; label: string }
  | { phase: 'done'; image: string; imageClean?: string; label: string }
  | { phase: 'error'; message: string };

// A polish run's result, kept for the session so switching layers/maps never
// throws away a beautified image — see the gallery state + '🖼 Polished (n)' button.
// imageClean is the same composite with the burned identification labels
// omitted — produced alongside `image` at zero extra API cost (both are a
// client-side canvas recomposite of the same AI result, see runProducer) so
// the labelled/clean views can be swapped instantly with no regeneration.
interface PolishGalleryItem { id: string; label: string; image: string; imageClean?: string; at: number }

// ── Clip-to-image geometry helpers ──────────────────────────────────────────
// "Find map features" pulls OSM ways for the satellite's bbox, but a way can run
// well past the edges of the fetched image (a road continuing off-plot, a building
// straddling the frame). Left unclipped, ghosts dangle onto blank canvas and — worse —
// inflate BOQ line lengths with metres that were never drawn. Clip against the drawn
// image rect BEFORE the feature becomes a ghost.
interface ClipRect { x: number; y: number; w: number; h: number }

/** Liang-Barsky segment clip against an axis-aligned rect. Returns null if fully outside. */
function clipSegmentToRect(
  x0: number, y0: number, x1: number, y1: number, rect: ClipRect,
): [number, number, number, number] | null {
  const xmin = rect.x, xmax = rect.x + rect.w, ymin = rect.y, ymax = rect.y + rect.h;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - xmin, xmax - x0, y0 - ymin, ymax - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return null; // parallel and outside on this side
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
      else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

/**
 * Clip an OPEN polyline against a rect, stitching consecutive surviving segments
 * back into runs. A road can leave and re-enter the frame, so this can yield
 * multiple pieces; pieces with < 2 points are dropped.
 */
function clipPolylineToRect(points: number[], rect: ClipRect): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];
  let lastClippedEnd: [number, number] | null = null;
  for (let i = 0; i + 3 < points.length; i += 2) {
    const [x0, y0, x1, y1] = [points[i], points[i + 1], points[i + 2], points[i + 3]];
    const clipped = clipSegmentToRect(x0, y0, x1, y1, rect);
    if (!clipped) {
      if (current.length >= 4) runs.push(current);
      current = [];
      lastClippedEnd = null;
      continue;
    }
    const [cx0, cy0, cx1, cy1] = clipped;
    if (current.length === 0 || lastClippedEnd?.[0] !== cx0 || lastClippedEnd?.[1] !== cy0) {
      if (current.length >= 4) runs.push(current);
      current = [cx0, cy0, cx1, cy1];
    } else {
      current.push(cx1, cy1);
    }
    lastClippedEnd = [cx1, cy1];
  }
  if (current.length >= 4) runs.push(current);
  return runs;
}

/** Sutherland–Hodgman polygon clip against an axis-aligned rect. Drop results with < 3 points. */
function clipPolygonToRect(points: number[], rect: ClipRect): number[] {
  type Pt = [number, number];
  let poly: Pt[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) poly.push([points[i], points[i + 1]]);

  const edges: Array<{ inside: (p: Pt) => boolean; intersect: (a: Pt, b: Pt) => Pt }> = [
    { inside: (p) => p[0] >= rect.x, intersect: (a, b) => [rect.x, a[1] + ((rect.x - a[0]) * (b[1] - a[1])) / (b[0] - a[0])] },
    { inside: (p) => p[0] <= rect.x + rect.w, intersect: (a, b) => [rect.x + rect.w, a[1] + ((rect.x + rect.w - a[0]) * (b[1] - a[1])) / (b[0] - a[0])] },
    { inside: (p) => p[1] >= rect.y, intersect: (a, b) => [a[0] + ((rect.y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), rect.y] },
    { inside: (p) => p[1] <= rect.y + rect.h, intersect: (a, b) => [a[0] + ((rect.y + rect.h - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), rect.y + rect.h] },
  ];

  for (const edge of edges) {
    if (poly.length === 0) break;
    const output: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const curr = poly[i];
      const prev = poly[(i - 1 + poly.length) % poly.length];
      const currIn = edge.inside(curr);
      const prevIn = edge.inside(prev);
      if (currIn) {
        if (!prevIn) output.push(edge.intersect(prev, curr));
        output.push(curr);
      } else if (prevIn) {
        output.push(edge.intersect(prev, curr));
      }
    }
    poly = output;
  }
  if (poly.length < 3) return [];
  return poly.flatMap((p) => p);
}

// Demo: farmers a supervisor could push a design to (real version = backend + accounts)
const FARMERS = ['Thabo Mahlangu', 'Nosipho Khumalo', 'Jabu Dlamini', 'Maria Sithole', 'Andile Ngubane'];

// ── Site-switch safety net ──────────────────────────────────────────────────
// A saved place is "the same site" as whatever's currently loaded when the sum of
// |Δlat|+|Δlon| is under this — used both to detect SITE-SWITCH CONTAMINATION
// (importSite) and to decide whether the URL's initialSite needs importing at all.
const SITE_DIFF_DEG = 0.001;

// localStorage key for the one-slot "previous design" safety net — written before a
// site switch that would clear user content (importSite) or a manual Start fresh
// (startFresh), and swapped back in via the "Restore backed-up design" button. Same
// payload shape as the STORE_KEY autosave (see lib/facilitator-design.ts), plus
// backedUpAt.
const BACKUP_KEY = 'imbewu_facilitator_design_backup';
type BackupPayload = FacilitatorDesignState & { backedUpAt: number };

/**
 * Which Transformer resize handles show for the current selection. Veg beds
 * are standardised at a 1m width so crop-plan m² calcs stay accurate — a
 * free corner/side drag would silently distort that width, so a selected bed
 * only gets top-center/bottom-center (lengthwise resize, in the node's own
 * un-rotated local axes regardless of screen rotation). Width is still
 * changeable deliberately via the numeric field in the property panel.
 * A single shared function (not duplicated inline) so the imperative
 * `tr.enabledAnchors(...)` call and the JSX `<Transformer enabledAnchors>`
 * prop can never drift apart.
 */
function enabledAnchorsFor(isSector: boolean, isBed: boolean, isCircle: boolean): string[] {
  if (isSector) return [];
  if (isBed) return ['top-center', 'bottom-center'];
  if (isCircle) return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  return ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right'];
}

// ── Top-view vector icons ──────────────────────────────────────────────────
// Each function receives the pixel w/h of the element and returns an array of
// Konva JSX nodes to render. They are ALWAYS centered at (0,0)...(w,h) so
// the Group can be positioned at the element's top-left corner directly.

function TopViewBed({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.12;
  const nRows = Math.min(5, Math.max(2, Math.round(h / (w * 0.55))));
  const rowH = h / (nRows + 1);
  const pad = w * 0.1;
  const rows = Array.from({ length: nRows }, (_, i) => i + 1);
  return (
    <>
      <Rect width={w} height={h} fill="#2E6B2B" cornerRadius={cr} />
      {rows.map((i) => (
        <Line key={i} points={[pad, rowH * i, w - pad, rowH * i]}
          stroke="#1A4519" strokeWidth={Math.max(1, w * 0.04)} lineCap="round" listening={false} />
      ))}
    </>
  );
}

function TopViewTree({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  // Organic irregular canopy — 7 leaf clusters offset around centre
  const clusters = [
    { dx:  0,        dy: -r*0.44, rr: r*0.42, fill: '#3E8A3A' },
    { dx:  r*0.42,   dy: -r*0.20, rr: r*0.38, fill: '#368034' },
    { dx:  r*0.44,   dy:  r*0.26, rr: r*0.40, fill: '#3A8838' },
    { dx:  r*0.05,   dy:  r*0.48, rr: r*0.38, fill: '#347E32' },
    { dx: -r*0.40,   dy:  r*0.28, rr: r*0.40, fill: '#3C8A3A' },
    { dx: -r*0.44,   dy: -r*0.18, rr: r*0.38, fill: '#388638' },
    { dx: -r*0.08,   dy: -r*0.06, rr: r*0.30, fill: '#4A9A44' },
  ];
  return (
    <>
      <Circle x={cx} y={cy} radius={r * 0.96} fill="#2C6A2A" />
      {clusters.map((b, i) => <Circle key={i} x={cx + b.dx} y={cy + b.dy} radius={b.rr} fill={b.fill} />)}
      <Circle x={cx} y={cy} radius={r * 0.16} fill="#5AAA50" opacity={0.8} />
      <Circle x={cx} y={cy} radius={Math.max(2, r * 0.06)} fill="#5C3A1E" />
    </>
  );
}

function TopViewFoodForest({ w, h }: { w: number; h: number }) {
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) / 2;
  const trees = [
    { dx:  0,       dy:  0,       rr: r*0.32, fill: '#2A6A28' },
    { dx:  r*0.50,  dy: -r*0.30,  rr: r*0.26, fill: '#348030' },
    { dx: -r*0.48,  dy: -r*0.28,  rr: r*0.24, fill: '#3C8A36' },
    { dx: -r*0.38,  dy:  r*0.44,  rr: r*0.28, fill: '#2E7030' },
    { dx:  r*0.44,  dy:  r*0.40,  rr: r*0.26, fill: '#367A32' },
    { dx:  r*0.05,  dy:  r*0.58,  rr: r*0.21, fill: '#40843A' },
    { dx:  r*0.02,  dy: -r*0.62,  rr: r*0.22, fill: '#387A34' },
    { dx: -r*0.62,  dy:  r*0.05,  rr: r*0.20, fill: '#3E8038' },
    { dx:  r*0.62,  dy: -r*0.02,  rr: r*0.20, fill: '#369034' },
  ];
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#182E16" />
      {trees.map((t, i) => <Circle key={i} x={cx + t.dx} y={cy + t.dy} radius={t.rr} fill={t.fill} />)}
    </>
  );
}

function TopViewHugel({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.18;
  const dots: [number, number][] = [
    [0.22, 0.28], [0.5, 0.18], [0.78, 0.28],
    [0.18, 0.58], [0.5,  0.5], [0.82, 0.58],
    [0.35, 0.78], [0.65, 0.78],
  ];
  return (
    <>
      <Rect width={w} height={h} fill="#6B4C2A" cornerRadius={cr} />
      <Rect x={w*0.07} y={h*0.07} width={w*0.86} height={h*0.86} fill="#8A6238" cornerRadius={cr * 0.7} />
      {dots.map(([bx, by], i) => (
        <Circle key={i} x={w * bx} y={h * by} radius={Math.max(2, Math.min(w, h) * 0.07)} fill="#4A8040" />
      ))}
    </>
  );
}

function TopViewBanana({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  const count = 6;
  const positions = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { dx: Math.cos(angle) * r * 0.60, dy: Math.sin(angle) * r * 0.60 };
  });
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#1E4A1A" />
      {positions.map((p, i) => (
        <Circle key={i} x={cx + p.dx} y={cy + p.dy} radius={r * 0.30}
          fill={i % 2 === 0 ? '#5A9A30' : '#4A8828'} />
      ))}
      <Circle x={cx} y={cy} radius={r * 0.20} fill="#2A3E18" />
      <Circle x={cx} y={cy} radius={r * 0.08} fill="#3A5222" />
    </>
  );
}

function TopViewWell({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#4A4040" />
      <Circle x={cx} y={cy} radius={r * 0.72} fill="#2A2020" />
      <Circle x={cx} y={cy} radius={r * 0.40} fill="#0A0808" />
      <Circle x={cx - r*0.18} y={cy - r*0.18} radius={r * 0.14} fill="#4A8ACC" opacity={0.75} />
    </>
  );
}

function TopViewReedBed({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.12;
  const cols = Math.max(3, Math.round(w / (Math.min(w, h) * 0.28)));
  const rows = Math.max(2, Math.round(h / (Math.min(w, h) * 0.35)));
  const dots: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    dots.push([(c + 0.5) / cols, (r + 0.5) / rows]);
  return (
    <>
      <Rect width={w} height={h} fill="#2A4A38" cornerRadius={cr} />
      <Rect x={w*0.05} y={h*0.55} width={w*0.90} height={h*0.38} fill="#1A3A60" opacity={0.5} cornerRadius={4} />
      {dots.map(([bx, by], i) => (
        <Line key={i} points={[w*bx, h*by, w*bx, h*by - Math.min(w,h)*0.22]}
          stroke="#6AAA40" strokeWidth={Math.max(1, w*0.025)} lineCap="round" listening={false} />
      ))}
    </>
  );
}

function TopViewGreenhouse({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.04;
  const nPanels = 3;
  const panelW = (w * 0.84) / nPanels;
  return (
    <>
      <Rect width={w} height={h} fill="#5A7A8A" cornerRadius={cr} />
      {Array.from({ length: nPanels }, (_, i) => (
        <Rect key={i} x={w*0.08 + i*(panelW + w*0.02)} y={h*0.05}
          width={panelW} height={h*0.90}
          fill="#A8D4E0" opacity={0.72} cornerRadius={2} listening={false} />
      ))}
      {Array.from({ length: nPanels - 1 }, (_, i) => (
        <Line key={i} points={[w*0.08 + (i+1)*(panelW + w*0.02) - w*0.01, 0, w*0.08 + (i+1)*(panelW + w*0.02) - w*0.01, h]}
          stroke="#3E5A68" strokeWidth={Math.max(1.5, w*0.03)} listening={false} />
      ))}
    </>
  );
}

function TopViewBeehive({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#7A4E10" />
      <Circle x={cx} y={cy} radius={r * 0.78} fill="#C07A22" />
      <Circle x={cx} y={cy} radius={r * 0.52} fill="#E09A38" />
      <Circle x={cx} y={cy} radius={r * 0.28} fill="#F0BF58" />
      <Circle x={cx} y={cy} radius={r * 0.10} fill="#3A1A04" />
    </>
  );
}

function TopViewBiogas({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#3A2A5A" />
      <Circle x={cx} y={cy} radius={r * 0.74} fill="#4E3A7A" />
      <Circle x={cx} y={cy} radius={r * 0.46} fill="#644E8A" />
      <Circle x={cx} y={cy} radius={r * 0.22} fill="#7A6298" />
      <Circle x={cx} y={cy} radius={r * 0.08} fill="#9A82B0" />
    </>
  );
}

function TopViewNursery({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.10;
  const cols = Math.max(3, Math.round(w / (Math.min(w,h)*0.30)));
  const rows = Math.max(3, Math.round(h / (Math.min(w,h)*0.30)));
  const dots: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    dots.push([(c + 0.5) / cols, (r + 0.5) / rows]);
  return (
    <>
      <Rect width={w} height={h} fill="#2A4228" cornerRadius={cr} />
      {dots.map(([bx, by], i) => (
        <Circle key={i} x={w*bx} y={h*by}
          radius={Math.max(2, Math.min(w,h)*0.06)}
          fill={i % 3 === 0 ? '#4A8A3A' : i % 3 === 1 ? '#3A7A2E' : '#5A9A44'} />
      ))}
    </>
  );
}

function TopViewSwaleWork({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.15;
  const mid = h * 0.48;
  return (
    <>
      {/* Berm (mound) — top strip */}
      <Rect width={w} height={mid} fill="#5A7A3A" cornerRadius={cr} />
      {/* Channel — bottom strip */}
      <Rect y={mid} width={w} height={h - mid} fill="#2A4A6A" cornerRadius={cr} />
      {/* Water in channel */}
      <Rect x={w*0.04} y={mid + h*0.06} width={w*0.92} height={h*0.28}
        fill="#3A6A9A" opacity={0.65} cornerRadius={Math.min(w,h)*0.08} />
      {/* Vegetation dots on berm */}
      {[0.15, 0.35, 0.55, 0.75, 0.90].map((bx, i) => (
        <Circle key={i} x={w*bx} y={mid*0.5}
          radius={Math.max(2, h*0.10)} fill="#6A9A48" />
      ))}
    </>
  );
}

function TopViewFirebreak({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.08;
  return (
    <>
      <Rect width={w} height={h} fill="#7A5530" cornerRadius={cr} />
      <Rect x={w*0.04} y={h*0.04} width={w*0.92} height={h*0.92} fill="#9A7048" cornerRadius={cr*0.6} />
      {Array.from({ length: 6 }, (_, i) => (
        <Line key={i} points={[w*(i/5), 0, 0, h*(i/5)]}
          stroke="#5A3A18" strokeWidth={1} listening={false} opacity={0.4} />
      ))}
    </>
  );
}

function TopViewHerb({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#304A10" />
      <Arc x={cx} y={cy} innerRadius={r * 0.6} outerRadius={r * 0.82} angle={200} rotation={-20} fill="#5A7A28" listening={false} />
      <Arc x={cx} y={cy} innerRadius={r * 0.3} outerRadius={r * 0.52} angle={230} rotation={160} fill="#6E9430" listening={false} />
      <Circle x={cx} y={cy} radius={r * 0.14} fill="#8BAA40" />
    </>
  );
}

function TopViewShrub({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  const blobs = [
    { dx: 0,         dy: -r * 0.28, rr: r * 0.48, fill: '#4A8240' },
    { dx: r * 0.3,   dy:  r * 0.2,  rr: r * 0.42, fill: '#3E7238' },
    { dx: -r * 0.3,  dy:  r * 0.18, rr: r * 0.44, fill: '#569A4A' },
    { dx:  r * 0.15, dy: -r * 0.05, rr: r * 0.35, fill: '#5EAA52' },
    { dx: -r * 0.18, dy: -r * 0.12, rr: r * 0.36, fill: '#4E9244' },
  ];
  return (
    <>
      {blobs.map((b, i) => (
        <Circle key={i} x={cx + b.dx} y={cy + b.dy} radius={b.rr} fill={b.fill} />
      ))}
    </>
  );
}

function TopViewTank({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#2C5C8A" />
      <Circle x={cx} y={cy} radius={r * 0.72} fill="#3A78B4" />
      <Circle x={cx} y={cy} radius={r * 0.42} fill="#4A92CC" />
      <Circle x={cx} y={cy} radius={r * 0.14} fill="#5AAEE0" />
    </>
  );
}

function TopViewPond({ w, h }: { w: number; h: number }) {
  const r = w / 2;
  const cx = w / 2, cy = h / 2;
  return (
    <>
      <Circle x={cx} y={cy} radius={r} fill="#1E4E72" />
      <Circle x={cx} y={cy} radius={r * 0.82} fill="#275F8A" />
      <Circle x={cx} y={cy} radius={r * 0.55} fill="#3278A8" />
      <Circle x={cx - r * 0.18} y={cy - r * 0.18} radius={r * 0.22} fill="#5498C8" opacity={0.6} />
    </>
  );
}

function TopViewCoop({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.1;
  const ridgeX = w / 2;
  const nestW = w * 0.3, nestH = h * 0.22;
  return (
    <>
      <Rect width={w} height={h} fill="#7A5228" cornerRadius={cr} />
      <Line points={[ridgeX, h * 0.08, ridgeX, h * 0.92]}
        stroke="#5C3A14" strokeWidth={Math.max(1.5, w * 0.06)} lineCap="round" listening={false} />
      <Rect x={w * 0.08} y={h * 0.65} width={nestW} height={nestH}
        fill="#9A7040" cornerRadius={3} listening={false} />
    </>
  );
}

function TopViewCompost({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.08;
  const mx = w / 2, my = h / 2;
  return (
    <>
      <Rect width={w} height={h} fill="#4A3A22" cornerRadius={cr} />
      <Line points={[mx, h * 0.08, mx, h * 0.92]}
        stroke="#6A5030" strokeWidth={Math.max(1.5, w * 0.05)} lineCap="round" listening={false} />
      <Line points={[w * 0.08, my, w * 0.92, my]}
        stroke="#6A5030" strokeWidth={Math.max(1.5, w * 0.05)} lineCap="round" listening={false} />
      {[[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]].map(([bx, by], i) => (
        <Circle key={i} x={w * bx} y={h * by} radius={Math.max(2, Math.min(w, h) * 0.07)}
          fill="#7A6040" listening={false} />
      ))}
    </>
  );
}

function TopViewTunnel({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.1;
  const nHoops = Math.min(8, Math.max(3, Math.round(h / (w * 0.6))));
  const hopSpacing = h / (nHoops + 1);
  return (
    <>
      <Rect width={w} height={h} fill="#98C4DC" cornerRadius={cr} />
      <Rect x={w * 0.08} y={h * 0.04} width={w * 0.18} height={h * 0.92}
        fill="#C8E4F0" cornerRadius={2} opacity={0.5} listening={false} />
      {Array.from({ length: nHoops }, (_, i) => i + 1).map((i) => (
        <Line key={i} points={[w * 0.05, hopSpacing * i, w * 0.95, hopSpacing * i]}
          stroke="#5A7A8A" strokeWidth={Math.max(1, w * 0.05)} lineCap="round" listening={false} />
      ))}
    </>
  );
}

function TopViewShed({ w, h }: { w: number; h: number }) {
  const cr = Math.min(w, h) * 0.08;
  const ridgeX = w * 0.38;
  return (
    <>
      <Rect width={w} height={h} fill="#5A5448" cornerRadius={cr} />
      <Line points={[ridgeX, h * 0.06, ridgeX, h * 0.94]}
        stroke="#3E3832" strokeWidth={Math.max(1.5, w * 0.06)} lineCap="round" listening={false} />
      <Rect x={0} y={0} width={ridgeX} height={h} fill="#6A6458" cornerRadius={cr} opacity={0.4} listening={false} />
    </>
  );
}

function ElementIcon({ type, w, h }: { type: ElType; w: number; h: number }) {
  switch (type) {
    case 'bed':        return <TopViewBed w={w} h={h} />;
    case 'hugel':      return <TopViewHugel w={w} h={h} />;
    case 'banana':     return <TopViewBanana w={w} h={h} />;
    case 'tree':       return <TopViewTree w={w} h={h} />;
    case 'foodforest': return <TopViewFoodForest w={w} h={h} />;
    case 'herb':       return <TopViewHerb w={w} h={h} />;
    case 'shrub':      return <TopViewShrub w={w} h={h} />;
    case 'tank':       return <TopViewTank w={w} h={h} />;
    case 'pond':       return <TopViewPond w={w} h={h} />;
    case 'well':       return <TopViewWell w={w} h={h} />;
    case 'reedbed':    return <TopViewReedBed w={w} h={h} />;
    case 'coop':       return <TopViewCoop w={w} h={h} />;
    case 'compost':    return <TopViewCompost w={w} h={h} />;
    case 'greenhouse': return <TopViewGreenhouse w={w} h={h} />;
    case 'tunnel':     return <TopViewTunnel w={w} h={h} />;
    case 'shed':       return <TopViewShed w={w} h={h} />;
    case 'beehive':    return <TopViewBeehive w={w} h={h} />;
    case 'biogas':     return <TopViewBiogas w={w} h={h} />;
    case 'nursery':    return <TopViewNursery w={w} h={h} />;
    case 'swalew':     return <TopViewSwaleWork w={w} h={h} />;
    case 'firebreak':  return <TopViewFirebreak w={w} h={h} />;
  }
}

export default function FacilitatorCanvas({ siteText, language, initialSite }: { siteText?: string; language?: string; initialSite?: { lat: number; lon: number; name: string } }) {
  const [items, setItems] = useState<Item[]>([]);
  const [lines, setLines] = useState<LineEl[]>([]);
  // Mirror for callbacks that run inside stale closures (loadSiteBackground's
  // useCallback → auto runFindMapFeatures): dedupe must see CURRENT lines.
  const linesRef = useRef<LineEl[]>([]);
  linesRef.current = lines;
  const [sectors, setSectors] = useState<SectorEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pxPerM, setPxPerM] = useState(26);
  const [scaleSet, setScaleSet] = useState(false);
  // "From my map sites": import a saved place's satellite as the base map with the
  // scale set AUTOMATICALLY from the frame's metres-per-pixel — no manual Set scale.
  const [sitePickerOpen, setSitePickerOpen] = useState(false);
  const [sitePlaces, setSitePlaces] = useState<SavedPlace[]>([]);
  const [siteLoading, setSiteLoading] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 560 });
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  // Parchment wash overlay — visibility aid over a dark/busy satellite (see the
  // background Layer in the Stage below for the actual render logic).
  const [washOn, setWashOn] = useState(false);
  // Mobile: palette + properties are slide-in drawers over a full-screen canvas
  const [mobilePanel, setMobilePanel] = useState<null | 'palette' | 'props'>(null);
  // Guided (simple, default) vs Pro (the full designer). Persisted per device.
  const [uiMode, setUiMode] = useState<'guided' | 'pro'>('guided');
  const [guidedStep, setGuidedStep] = useState(0);
  useEffect(() => {
    try { const m = localStorage.getItem('imbewu_facilitator_uimode'); if (m === 'pro' || m === 'guided') setUiMode(m); } catch { /* unavailable */ }
  }, []);
  const chooseUiMode = (m: 'guided' | 'pro') => {
    setUiMode(m);
    try { localStorage.setItem('imbewu_facilitator_uimode', m); } catch { /* best effort */ }
  };
  // Bill of quantities: collapsed by default (gogo-first — a facilitator/funder
  // opens it on demand rather than having cost line-items always on screen).
  const [boqOpen, setBoqOpen] = useState(false);
  useEffect(() => {
    try { const v = localStorage.getItem('imbewu_facilitator_boq_open'); if (v === '1') setBoqOpen(true); } catch { /* unavailable */ }
  }, []);
  const toggleBoqOpen = () => {
    setBoqOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem('imbewu_facilitator_boq_open', next ? '1' : '0'); } catch { /* best effort */ }
      return next;
    });
  };
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  // Refs mirror state so native event handlers always read current values
  const stageScaleRef = useRef(1);
  const stagePosRef = useRef({ x: 0, y: 0 });
  const lastDist = useRef(0);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);
  // Panning is DELIBERATE, never a side effect of a plain drag. A plain
  // click/touch-drag only ever moves an element you grabbed — a missed grab
  // does nothing (no more "moving something flings the whole map away").
  // The map pans via: two-finger drag, trackpad/wheel scroll, the ✋ Pan
  // button, or holding Space. draggable is gated on panMode below.
  const [panTool, setPanTool] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panMode = panTool || spaceHeld;

  // Layers: progressive build-up. activeLayer drives palette filtering + coach tips;
  // hiddenLayers lets a facilitator declutter the view without deleting anything.
  const [activeLayer, setActiveLayer] = useState<LayerId>('base');
  const [hiddenLayers, setHiddenLayers] = useState<LayerId[]>([]);
  const [armedSector, setArmedSector] = useState<SectorKind | null>(null);
  const [layersMenuOpen, setLayersMenuOpen] = useState(false);
  const [moreElementsOpen, setMoreElementsOpen] = useState(false);

  const [bg, setBg] = useState<{ img: HTMLImageElement; x: number; y: number; w: number; h: number; opacity: number } | null>(null);
  const [bgSite, setBgSite] = useState<{ lat: number; lon: number; name: string } | null>(null);
  const [bgDataUrl, setBgDataUrl] = useState<string | null>(null);
  const [placeType, setPlaceType] = useState<ElType | null>(null);
  const [lineKind, setLineKind] = useState<LineKind | null>(null);
  // Placement-time capacity/species prompt — opens right after a tank or tree
  // is placed (see placeItem below), targeting the just-placed item via the
  // existing selectedId/updateSel plumbing rather than a new update-by-id path.
  const [placementPrompt, setPlacementPrompt] = useState<{ id: string; type: ElType } | null>(null);
  const [tankCustomOpen, setTankCustomOpen] = useState(false);
  const [tankCustomValue, setTankCustomValue] = useState('');
  const [treeSpecies, setTreeSpecies] = useState('');
  const [treeCustomOpen, setTreeCustomOpen] = useState(false);
  const [treeCount, setTreeCount] = useState(1);
  const [scaleMode, setScaleMode] = useState(false);
  const [draftPt, setDraftPt] = useState<number[] | null>(null);
  // Multi-vertex polygon drafting (roof/driveway/patio areas): tap each corner,
  // then Finish. Flat [x,y,x,y,...] like every other points array in this file.
  // Only used when the armed lineKind is one of POLYGON_LINE_KINDS — every
  // other line kind keeps the simple 2-tap draftPt segment above.
  const [polyDraft, setPolyDraft] = useState<number[]>([]);
  const isArmedPolygon = !!lineKind && POLYGON_LINE_KINDS.includes(lineKind);
  const [contoursHidden, setContoursHidden] = useState(false);
  const restoredRef = useRef(false);
  // Flips true once the mount-restore effect's OWN background load (if any — a map
  // site's satellite fetch is async) has settled, so the auto-pick-site-from-URL
  // effect below reads a bgSite that reflects what was ACTUALLY restored, not a
  // stale mount-time value. restoredRef (above) only covers the synchronous part.
  const [restoreSettled, setRestoreSettled] = useState(false);
  const autoPickedRef = useRef(false);

  // IDs of auto-imported map-truth shapes (mapshape-*) the facilitator has
  // deleted. The map-truth import (loadSiteBackground) re-derives ALL
  // mapshape-* lines from the farmer's global traced-shapes store on every
  // load — proximity-matched to this site, not scoped to it — so a shape
  // that doesn't actually belong here (a dam/path traced somewhere else,
  // pulled in because it happens to sit within ~2km) would otherwise silently
  // reappear every time the design reopens, even after being deleted.
  const [dismissedMapshapeIds, setDismissedMapshapeIds] = useState<string[]>([]);
  // Mirror for loadSiteBackground's useCallback closure (same stale-closure
  // reason linesRef exists above) — the map-truth import must see the
  // CURRENT dismissed list, not whatever it was when the callback was built.
  const dismissedMapshapeIdsRef = useRef<string[]>([]);
  dismissedMapshapeIdsRef.current = dismissedMapshapeIds;
  const dismissMapshape = (id: string) => setDismissedMapshapeIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

  // AI detect — vision detection of existing features + boundary as ghost overlays.
  const [ghosts, setGhosts] = useState<GhostFeature[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');
  const [ghostSource, setGhostSource] = useState<'ai' | 'osm'>('ai');
  const [scaleSuggestion, setScaleSuggestion] = useState<{ metresAcross: number; pxPerM: number } | null>(null);
  // Geo frame for the current site background — set inside loadSiteBackground's img.onload
  // (map imports only; file imports have no geo). Lets later actions project geo↔canvas
  // with the SAME maths as the map-truth import above.
  const siteFrameRef = useRef<{ frame: ReturnType<typeof computeCanvasFrame>['frame']; bgX: number; bgY: number; drawnW: number; drawnH: number } | null>(null);
  const [findingFeatures, setFindingFeatures] = useState(false);
  const [findFeaturesError, setFindFeaturesError] = useState('');
  // true when importFromSite / site-restore set the EXACT scale from the map fit;
  // false when a plain file image is loaded (scale is a guess until measured or AI-suggested).
  const [scaleLocked, setScaleLocked] = useState(false);

  const [review, setReview] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [aiPolish, setAiPolish] = useState<AiPolishState>({ phase: 'idle' });
  // Session-only gallery of polish results — never persisted (see PolishGalleryItem).
  const [polishGallery, setPolishGallery] = useState<PolishGalleryItem[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryViewId, setGalleryViewId] = useState<string | null>(null);
  // Labels toggle for the gallery's single-item viewer — separate from the
  // fresh-result toggle above so browsing old maps doesn't inherit whatever
  // state the last live result was left in; resets per item.
  const [galleryShowClean, setGalleryShowClean] = useState(false);
  // When true, the background Layer paints elements ONLY (no satellite/grid/wash)
  // — used to capture the transparent "element sticker" the producer paints back
  // on top of the model's beautified output.
  const [captureStickerMode, setCaptureStickerMode] = useState(false);
  // During a producer capture: hide UI chrome that lives in the Stage (live
  // label callouts, line endpoint handles, ✕ delete pills) so the AI never
  // sees — and never repaints — our interface furniture.
  const [captureCleanMode, setCaptureCleanMode] = useState(false);
  // Map style for the producer. Default = the warm storybook look (the pale
  // "ledger" default was reading as washed-out/blank); the user's last choice
  // is remembered per device (see chooseProducerStyle).
  const [producerStyle, setProducerStyle] = useState('homestead_storybook');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('imbewu_producer_style');
      if (saved && PRODUCER_STYLES.some((s) => s.key === saved)) setProducerStyle(saved);
    } catch { /* unavailable */ }
  }, []);
  const chooseProducerStyle = (key: string) => {
    setProducerStyle(key);
    try { localStorage.setItem('imbewu_producer_style', key); } catch { /* best effort */ }
  };
  // Second producer engine (Pro mode only — "advanced models" toggle). Gemini
  // Pro Preview stays the default (settled winner, see memory); ChatGPT/
  // gpt-image-2 (via fal's async queue — see submitGptImage2 server-side) is
  // an opt-in A/B for anyone who wants to compare.
  const [producerEngine, setProducerEngine] = useState<'gemini' | 'openai'>('gemini');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('imbewu_producer_engine');
      if (saved === 'gemini' || saved === 'openai') setProducerEngine(saved);
    } catch { /* unavailable */ }
  }, []);
  const chooseProducerEngine = (e: 'gemini' | 'openai') => {
    setProducerEngine(e);
    try { localStorage.setItem('imbewu_producer_engine', e); } catch { /* best effort */ }
  };
  // Whether the burned-in identification labels show on produced maps — was
  // hardcoded always-on; now a real toggle so a clean shareable version and a
  // labelled compare-against-reality version are both one tap away, without
  // re-running the AI (both are composited client-side from the same result).
  const [producerLabelsOn, setProducerLabelsOn] = useState(true);
  useEffect(() => {
    try { if (localStorage.getItem('imbewu_producer_labels') === '0') setProducerLabelsOn(false); } catch { /* unavailable */ }
  }, []);
  const chooseProducerLabels = (on: boolean) => {
    setProducerLabelsOn(on);
    try { localStorage.setItem('imbewu_producer_labels', on ? '1' : '0'); } catch { /* best effort */ }
  };
  // Which variant the 'done' result view currently shows — defaults to the
  // saved preference every time a fresh result lands; flipping it (see the
  // 🏷 toggle below) also updates the saved preference via chooseProducerLabels,
  // same "last choice wins" pattern as chooseProducerStyle/chooseProducerEngine.
  const [showCleanResult, setShowCleanResult] = useState(false);
  useEffect(() => {
    if (aiPolish.phase === 'done') setShowCleanResult(!producerLabelsOn);
    // Only re-run when a NEW result lands (its image changes), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiPolish.phase === 'done' ? aiPolish.image : null]);
  // Gallery single-item viewer's labels toggle — same saved preference as
  // above, reset per item so browsing old maps doesn't inherit whatever the
  // main result view happened to be showing.
  useEffect(() => {
    setGalleryShowClean(!producerLabelsOn);
    // Only re-run when a DIFFERENT item is opened, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryViewId]);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [farmers, setFarmers] = useState<Profile[]>([]);
  const [farmersLoading, setFarmersLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  // Transient confirmation when traced map shapes (boundary/water/paths) are imported
  // as map-truth lines — see loadSiteBackground.
  const [mapImportMsg, setMapImportMsg] = useState('');
  // Transient confirmation that a previous design was snapshotted to BACKUP_KEY before
  // a site switch cleared the canvas (see importSite) — separate from mapImportMsg so
  // the two notices never race/clobber each other.
  const [backupMsg, setBackupMsg] = useState('');
  // Whether BACKUP_KEY currently holds a snapshot — gates the "Restore backed-up
  // design" button. Checked once on mount; kept in sync by backupCurrentDesign.
  const [hasBackup, setHasBackup] = useState(false);
  useEffect(() => {
    try { setHasBackup(!!localStorage.getItem(BACKUP_KEY)); } catch { /* unavailable */ }
  }, []);

  // Cloud save/load — designId binds this canvas to a Firestore doc once saved.
  const [designId, setDesignId] = useState<string | null>(null);
  const [designTitle, setDesignTitle] = useState('');
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'local-only'>('idle');
  const [cloudSavedAt, setCloudSavedAt] = useState<number | null>(null);
  const [myDesignsOpen, setMyDesignsOpen] = useState(false);
  const [myDesignsList, setMyDesignsList] = useState<Design[] | null>(null);
  const [designsLoading, setDesignsLoading] = useState(false);
  const manualSaveInFlight = useRef(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Copy / paste ─────────────────────────────────────────────────────────
  // Internal clipboard (deep copy, NOT the OS clipboard) for ⌘C/⌘V duplication
  // of the selected item or sector — see copySelected/pasteClipboard below.
  const clipboardRef = useRef<{ kind: 'item'; data: Item } | { kind: 'sector'; data: SectorEl } | null>(null);

  // ── Undo / redo ──────────────────────────────────────────────────────────
  // History is a stack of full {items, lines, sectors} snapshots (cap 50).
  // Snapshots are pushed via pushHistory() BEFORE a mutating commit lands, so
  // undo restores the state as it was just before that commit. Refs (not
  // state) so pushes from event handlers always see the latest stacks without
  // needing to be in a dependency array.
  interface HistorySnapshot { items: Item[]; lines: LineEl[]; sectors: SectorEl[] }
  const HISTORY_CAP = 50;
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const [historyTick, setHistoryTick] = useState(0); // bump to re-render undo/redo button enabled-state
  const propEditDebounceRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; baseline: HistorySnapshot | null }>({ timer: null, baseline: null });

  const pushHistory = useCallback(() => {
    pastRef.current.push({ items, lines, sectors });
    if (pastRef.current.length > HISTORY_CAP) pastRef.current.shift();
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lines, sectors]);

  const resetHistory = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    if (propEditDebounceRef.current.timer) clearTimeout(propEditDebounceRef.current.timer);
    propEditDebounceRef.current = { timer: null, baseline: null };
    setHistoryTick((t) => t + 1);
  }, []);

  // Property-panel edits (number inputs) fire on every keystroke — debounce so
  // dragging a slider/typing a number doesn't spam 20 history entries. The
  // FIRST edit in a burst captures the pre-edit baseline; the debounce timer
  // just delays when that baseline actually gets pushed onto the stack.
  const pushHistoryDebounced = useCallback((delayMs = 500) => {
    if (!propEditDebounceRef.current.baseline) {
      propEditDebounceRef.current.baseline = { items, lines, sectors };
    }
    if (propEditDebounceRef.current.timer) clearTimeout(propEditDebounceRef.current.timer);
    propEditDebounceRef.current.timer = setTimeout(() => {
      const baseline = propEditDebounceRef.current.baseline;
      if (baseline) {
        pastRef.current.push(baseline);
        if (pastRef.current.length > HISTORY_CAP) pastRef.current.shift();
        futureRef.current = [];
        setHistoryTick((t) => t + 1);
      }
      propEditDebounceRef.current = { timer: null, baseline: null };
    }, delayMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lines, sectors]);

  const applySnapshot = useCallback((snap: HistorySnapshot) => {
    setItems(snap.items);
    setLines(snap.lines);
    setSectors(snap.sectors);
    setSelectedId((prev) => {
      if (!prev) return prev;
      const stillExists = snap.items.some((i) => i.id === prev) || snap.sectors.some((s) => s.id === prev);
      return stillExists ? prev : null;
    });
  }, []);

  const undo = useCallback(() => {
    const snap = pastRef.current.pop();
    if (!snap) return;
    futureRef.current.push({ items, lines, sectors });
    applySnapshot(snap);
    setHistoryTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lines, sectors, applySnapshot]);

  const redo = useCallback(() => {
    const snap = futureRef.current.pop();
    if (!snap) return;
    pastRef.current.push({ items, lines, sectors });
    applySnapshot(snap);
    setHistoryTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lines, sectors, applySnapshot]);
  // historyTick forces these to re-evaluate after every push/undo/redo (the
  // stacks themselves are refs, so mutating them alone wouldn't re-render).
  const canUndo = historyTick >= 0 && pastRef.current.length > 0;
  const canRedo = historyTick >= 0 && futureRef.current.length > 0;

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedSector = !selected && selectedId ? sectors.find((s) => s.id === selectedId) ?? null : null;
  const selectedIsCircle = selected ? CATALOG[selected.type].shape === 'circle' : false;
  const armed = placeType || lineKind || scaleMode || armedSector;

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tr = trRef.current; if (!tr) return;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    tr.nodes(node ? [node] : []);
    tr.rotateEnabled(true);
    tr.enabledAnchors(enabledAnchorsFor(!!selectedSector, selected?.type === 'bed', selectedIsCircle));
    tr.getLayer()?.batchDraw();
  }, [selectedId, selectedSector, selectedIsCircle, items, sectors, pxPerM]);

  // Esc cancels any armed tool; Delete/Backspace removes selection; Ctrl/Cmd+Z
  // undoes, Ctrl/Cmd+Shift+Z (and Ctrl+Y) redoes.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPlaceType(null); setLineKind(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); setPolyDraft([]); setPlacementPrompt(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') { e.preventDefault(); deleteSelected(); }
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'c') {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        if (!selected && !selectedSector) return;
        e.preventDefault();
        copySelected();
      } else if (mod && e.key.toLowerCase() === 'v') {
        const t = e.target as HTMLElement;
        if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
        if (!clipboardRef.current) return;
        e.preventDefault();
        pasteClipboard();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undo, redo, pxPerM]);

  function loadImage(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const W = size.w || 800, H = size.h || 560; // container can measure 0 mid-layout
        const s = Math.min(W / img.width, H / img.height, 1);
        setBg({ img, x: (W - img.width * s) / 2, y: (H - img.height * s) / 2, w: img.width * s, h: img.height * s, opacity: 1 });
        setBgSite(null);
        setBgDataUrl(dataUrl);
        setShowGrid(false);
        setScaleLocked(false);
        setGhosts(null);
        setScaleSuggestion(null);
        siteFrameRef.current = null; // file imports have no geo — can't find map features
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // Shared by importFromSite (live pick) and the on-mount restore (bgSite from storage) —
  // both need the exact same satellite fetch + auto-scale maths.
  //
  // `onBgReady` (used by the mount-restore below) fires synchronously inside the
  // img.onload, right after the fresh bgRect + pxPerM are computed — this is the
  // hook point for METRE→PX geometry conversion (geomVersion 2), which must use
  // the NEW rect/scale rather than whatever was true when the design was saved.
  const loadSiteBackground = useCallback(async (
    site: { lat: number; lon: number; name: string },
    onBgReady?: (bgRect: BgRect, pxPerM: number) => void,
  ) => {
    const siteId = designSiteIdFromLocation({ lat: site.lat, lon: site.lon } as LocationData);
    const saved = loadDesignStudioState(siteId);
    const mergedAll = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), saved, siteId);
    const NEAR = 0.02; // only shapes near THIS site drive the fit (global store)
    const near = mergedAll.layers.filter((l) => {
      const g = l.geometry as { type?: string; coordinates?: unknown };
      const ring =
        g?.type === 'Polygon' ? (g.coordinates as number[][][])[0] :
        g?.type === 'LineString' ? (g.coordinates as number[][]) : [];
      const c = ring?.[0];
      return !!c && Math.abs(c[1] - site.lat) < NEAR && Math.abs(c[0] - site.lon) < NEAR;
    });
    const { frame, url } = computeCanvasFrame(near, site.lat, site.lon);
    if (!url) throw new Error('No Mapbox token configured');
    const dataUrl = await fetchImageAsDataUrl(url);
    const img = new window.Image();
    img.onload = () => {
      const W = size.w || 800, H = size.h || 560; // container can measure 0 mid-layout
      const s0 = Math.min(W / img.width, H / img.height, 1);
      const drawnW = img.width * s0;
      const drawnH = img.height * s0;
      const metresAcross = frame.imgW * frame.mPerPx; // ground truth from the fit
      const bgX = (W - drawnW) / 2, bgY = (H - drawnH) / 2;
      const newPxPerM = drawnW / metresAcross;
      setBg({ img, x: bgX, y: bgY, w: drawnW, h: drawnH, opacity: 1 });
      setBgSite(site);
      setBgDataUrl(null);
      setPxPerM(newPxPerM);
      setScaleSet(true);
      setScaleLocked(true);
      setGhosts(null);
      setScaleSuggestion(null);
      setShowGrid(false);
      setSitePickerOpen(false);
      setSiteLoading(null);

      // Geo frame for later geo↔canvas actions (e.g. "Find map features") — same
      // frame + drawn rect used by the map-truth projector just below.
      siteFrameRef.current = { frame, bgX, bgY, drawnW, drawnH };

      // Metre→px geometry conversion hook (geomVersion 2 restore) — must run with
      // THIS freshly-computed rect/scale, not whatever was saved.
      onBgReady?.({ x: bgX, y: bgY, w: drawnW, h: drawnH }, newPxPerM);

      // ── Map-truth import — draw the farmer's TRACED shapes directly instead of
      // re-guessing them from the satellite. `near` is already classified by
      // mergeFarmShapesIntoDesignState (layerType), so we just project + place.
      const projector = makeMercatorProjector(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH, 0, 0);
      const toCanvasPx = (coord: number[]): [number, number] => {
        const [ix, iy] = projector(coord as [number, number]);
        return [bgX + (ix * drawnW) / frame.imgW, bgY + (iy * drawnH) / frame.imgH];
      };
      const flatten = (ring: number[][]): number[] => ring.flatMap((c) => toCanvasPx(c));

      const boundaryLayers = near.filter((l) => l.layerType === 'property_boundary');
      const boundary = boundaryLayers.find((l) => l.approved) ?? boundaryLayers[0];
      const waterLayers = near.filter((l) => l.layerType === 'water_body');

      // Everything imported here gets clipped to the photo, same as the
      // Find-map-features ghosts — off-image geometry confuses the canvas and
      // inflates BOQ lengths with metres that are not on the plot.
      const importClipRect: ClipRect = { x: bgX, y: bgY, w: drawnW, h: drawnH };

      const newLines: LineEl[] = [];
      if (boundary) {
        const g = boundary.geometry as { type?: string; coordinates?: unknown };
        const ring = g?.type === 'Polygon' ? (g.coordinates as number[][][])[0] : undefined;
        if (ring && ring.length >= 3) {
          const clipped = clipPolygonToRect(flatten(ring), importClipRect);
          if (clipped.length >= 6) {
            newLines.push({ id: 'mapshape-boundary', kind: 'fence', points: clipped, closed: true, layer: 'existing' });
          }
        }
      }
      waterLayers.forEach((l, i) => {
        const g = l.geometry as { type?: string; coordinates?: unknown };
        const ring = g?.type === 'Polygon' ? (g.coordinates as number[][][])[0] : undefined;
        if (ring && ring.length >= 3) {
          const clipped = clipPolygonToRect(flatten(ring), importClipRect);
          if (clipped.length >= 6) {
            newLines.push({ id: `mapshape-water-${i}`, kind: 'waterbody', points: clipped, closed: true, layer: 'existing' });
          }
        }
      });
      near.forEach((l, i) => {
        if (l.layerType === 'property_boundary' || l.layerType === 'water_body') return;
        const g = l.geometry as { type?: string; coordinates?: unknown };
        if (g?.type !== 'LineString') return; // other polygon types are skipped
        const coords = g.coordinates as number[][];
        if (coords.length >= 2) {
          clipPolylineToRect(flatten(coords), importClipRect).forEach((piece, pi) => {
            if (piece.length >= 4) {
              newLines.push({ id: pi === 0 ? `mapshape-line-${i}` : `mapshape-line-${i}-${pi}`, kind: 'path', points: piece, layer: 'existing' });
            }
          });
        }
      });

      // Never re-add a shape the facilitator has explicitly deleted before —
      // see dismissMapshape/dismissedMapshapeIdsRef; without this, a shape
      // that was proximity-matched in from the farmer's global traced-shapes
      // store but doesn't actually belong on THIS property would silently
      // reappear on every subsequent open of the design.
      const keptNewLines = newLines.filter((l) => !dismissedMapshapeIdsRef.current.includes(l.id));
      setLines((prev) => [...prev.filter((l) => !l.id.startsWith('mapshape-')), ...keptNewLines]);

      if (keptNewLines.length > 0) {
        setMapImportMsg(`✓ ${keptNewLines.length} traced shape${keptNewLines.length === 1 ? '' : 's'} imported from your map`);
        setTimeout(() => setMapImportMsg(''), 5000);
      }

      // Auto-run "Find map features" at import — this used to be a manual button, but
      // field testing showed facilitators just want it to happen. Pass the frame info
      // straight through (siteFrameRef.current is also set above, but by the time this
      // promise resolves the surrounding state update batch may not have flushed yet).
      // manual=false: 0 new features is a silent no-op (this also fires on mount-restore,
      // where everything worth finding is usually already accepted).
      runFindMapFeatures({ frame, bgX, bgY, drawnW, drawnH }, false);
    };
    img.onerror = () => setSiteLoading(null);
    img.src = dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.w, size.h]);

  // SITE-SWITCH CONTAMINATION guard, shared by the "From my map sites" picker
  // (importFromSite) and the auto-pick-from-URL path (fix 2): a previous site's
  // manually-placed items/lines/sectors were persisting mis-registered on the new
  // satellite, because importFromSite/loadSiteBackground only ever replaced
  // 'mapshape-' lines. If a real site is already loaded, the new place is actually
  // different, and there's any user content (placed items/sectors, or lines that
  // AREN'T auto-imported map-truth/OSM traces), back the whole design up to
  // BACKUP_KEY first and clear the canvas before loading the new site — so nothing
  // is ever silently lost, just relocated behind "Restore backed-up design".
  async function importSite(site: { lat: number; lon: number; name: string }) {
    const isDifferentSite = !bgSite || Math.abs(bgSite.lat - site.lat) + Math.abs(bgSite.lon - site.lon) > SITE_DIFF_DEG;
    const hasUserContent = items.length > 0 || sectors.length > 0 ||
      lines.some((l) => !l.id.startsWith('mapshape-') && !l.id.startsWith('osm-'));
    if (bgSite && isDifferentSite && hasUserContent) {
      backupCurrentDesign();
      setItems([]); setLines([]); setSectors([]);
      setGhosts(null);
      setSelectedId(null);
      setDesignId(null); setDesignTitle('');
      setDismissedMapshapeIds([]);
      resetHistory();
      setBackupMsg('✓ Previous design backed up — Restore from the Base map section');
      setTimeout(() => setBackupMsg(''), 5000);
    }
    await loadSiteBackground(site);
  }

  // Import a saved place's satellite directly (same fit + maths as the Design Studio),
  // and auto-set pxPerM so 1 m on the stage is true to the ground.
  async function importFromSite(p: SavedPlace) {
    try {
      setSiteLoading(p.id);
      await importSite({ lat: p.lat, lon: p.lon, name: p.name });
    } catch {
      setSiteLoading(null);
    }
  }

  // "Restore backed-up design" (fixes 1 + 4) — swaps whatever BACKUP_KEY holds back
  // in as the live design. SWAPS rather than overwrites: what's currently on screen
  // is written into BACKUP_KEY first, so hitting Restore again always undoes the
  // restore too — nothing is ever lost either direction. Loads the backup fully,
  // via the same metre→px + bgSite-refetch machinery as loadDesignRow/the mount
  // restore (see resolveAndSet there).
  async function restoreBackedUpDesign() {
    let raw: string | null = null;
    try { raw = localStorage.getItem(BACKUP_KEY); } catch { raw = null; }
    if (!raw) return;
    if (!window.confirm('Restore the backed-up design? It swaps places with what you see now — nothing is lost.')) return;

    let parsed: BackupPayload | null = null;
    try { parsed = JSON.parse(raw) as BackupPayload; } catch { parsed = null; }
    if (!parsed || !Array.isArray(parsed.items)) return;
    const backup = parsed; // stable `const` — safe to read from the img.onload closure below

    // Swap, don't overwrite: the design currently on screen becomes the new backup.
    try {
      const payload: BackupPayload = { ...buildLocalStatePayload(), backedUpAt: Date.now() };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
    } catch { /* best effort — still proceed with the restore itself */ }

    const isV2 = backup.geomVersion === 2;
    const rawItems = (backup.items ?? []) as FacItem[];
    const rawLines = (backup.lines ?? []) as FacLine[];
    const rawSectors = (backup.sectors ?? []) as FacSector[];
    const savedPxPerM = backup.pxPerM ?? 26;

    const resolveAndSet = (freshRect: BgRect | null, freshPxPerM: number) => {
      if (isV2) {
        const g = freshRect
          ? geomMToPx(rawItems, rawLines, rawSectors, freshRect, freshPxPerM)
          : geomMToPx(rawItems, rawLines, rawSectors, { x: 0, y: 0, w: 0, h: 0 }, DEFAULT_PX_PER_M);
        setItems(g.items as Item[]);
        setLines(g.lines as LineEl[]);
        setSectors(g.sectors as SectorEl[]);
      } else {
        setItems(rawItems as Item[]);
        setLines(rawLines as LineEl[]);
        setSectors(rawSectors as SectorEl[]);
      }
    };

    setPxPerM(savedPxPerM);
    setActiveLayer(backup.activeLayer ?? 'base');
    setHiddenLayers(backup.hiddenLayers ?? []);
    setWashOn(backup.washOn ?? false);
    setDesignId(backup.designId ?? null);
    setDesignTitle(backup.title ?? '');
    setDismissedMapshapeIds(backup.dismissedMapshapeIds ?? []);
    setSelectedId(null);
    setGhosts(null);
    setScaleSuggestion(null);
    resetHistory();

    if (backup.bgSite) {
      loadSiteBackground(backup.bgSite, (freshRect, freshPxPerM) => resolveAndSet(freshRect, freshPxPerM)).catch(() => {
        resolveAndSet(null, savedPxPerM || DEFAULT_PX_PER_M);
      });
    } else if (backup.bgDataUrl && backup.bgRect) {
      const img = new window.Image();
      const rect = backup.bgRect;
      img.onload = () => {
        setBg({ img, x: rect.x, y: rect.y, w: rect.w, h: rect.h, opacity: backup.bgOpacity ?? 1 });
        setBgDataUrl(backup.bgDataUrl ?? null);
        setBgSite(null);
        setShowGrid(false);
        resolveAndSet(rect, savedPxPerM);
      };
      img.onerror = () => resolveAndSet(null, savedPxPerM || DEFAULT_PX_PER_M);
      img.src = backup.bgDataUrl;
    } else {
      setBg(null); setBgSite(null); setBgDataUrl(null);
      resolveAndSet(null, savedPxPerM || DEFAULT_PX_PER_M);
    }
  }

  // AI detect — draw the base map to an offscreen canvas (downscaled), send it to
  // the vision endpoint, and turn the response into approve/reject ghost overlays.
  async function runDetect() {
    if (!bg || detecting) return;
    setDetecting(true);
    setDetectError('');
    try {
      const longEdge = Math.max(bg.img.naturalWidth || bg.img.width, bg.img.naturalHeight || bg.img.height);
      const scale = Math.min(1, 1400 / longEdge);
      const cw = Math.max(1, Math.round((bg.img.naturalWidth || bg.img.width) * scale));
      const ch = Math.max(1, Math.round((bg.img.naturalHeight || bg.img.height) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not prepare the image');
      ctx.drawImage(bg.img, 0, 0, cw, ch);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const imageBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

      // mPerPx must describe the DOWNSCALED offscreen image actually sent (canvas.width),
      // not the on-screen canvas px (1/pxPerM) — those differ once the satellite is
      // scaled to fit the container. bg.w is the drawn width in canvas px.
      const metresAcrossBg = bg.w / pxPerM;
      const mPerPx = metresAcrossBg / canvas.width;

      const resp = await fetch('/api/design-detect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, imgW: canvas.width, imgH: canvas.height, mPerPx }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => null) as { error?: string } | null;
        throw new Error(err?.error || 'Auto-detect failed — please try again.');
      }
      const res = await resp.json() as DetectResponse;
      const found = buildGhosts(res, { x: bg.x, y: bg.y, w: bg.w, h: bg.h });
      setGhosts(found);
      setGhostSource('ai');
      if (res.metresAcross && !scaleLocked) {
        setScaleSuggestion({ metresAcross: res.metresAcross, pxPerM: bg.w / res.metresAcross });
      }
      if (found.length === 0) setDetectError('No features found in this photo.');
    } catch (e) {
      setDetectError(e instanceof Error ? e.message : 'Auto-detect failed — please try again.');
    } finally {
      setDetecting(false);
    }
  }

  // "Find map features" — pull surveyed OSM buildings/roads/water for the imported
  // site's bbox and turn them into the SAME approve/reject ghost overlays as AI
  // detect, but projected with the EXACT maths as the map-truth import (same
  // projector construction from the same frame) so they line up pixel-for-pixel.
  //
  // `frameOverride` lets loadSiteBackground's img.onload call this synchronously with
  // the freshly-built frame before siteFrameRef/React state have necessarily flushed.
  // `manual` distinguishes an explicit button press (shows a "nothing new" note on 0
  // results) from the silent auto-run on import (0 new is expected on restore).
  async function runFindMapFeatures(
    frameOverride?: { frame: ReturnType<typeof computeCanvasFrame>['frame']; bgX: number; bgY: number; drawnW: number; drawnH: number },
    manual = true,
  ) {
    const sf = frameOverride ?? siteFrameRef.current;
    if (!sf || findingFeatures) return;
    setFindingFeatures(true);
    setFindFeaturesError('');
    try {
      const { frame, bgX, bgY, drawnW, drawnH } = sf;
      const unproject = makeMercatorUnprojector(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH);
      const [lon1, lat1] = unproject([0, 0]);
      const [lon2, lat2] = unproject([1, 1]);
      const south = Math.min(lat1, lat2), north = Math.max(lat1, lat2);
      const west = Math.min(lon1, lon2), east = Math.max(lon1, lon2);

      const resp = await fetch('/api/site-features', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ south, west, north, east }),
      });
      if (!resp.ok) throw new Error('unreachable');
      const res = await resp.json() as { features: Array<{ id: number; kind: 'building' | 'road' | 'water'; ring: Array<[number, number]>; name?: string }> };

      // Same projector construction as loadSiteBackground's map-truth import.
      const projector = makeMercatorProjector(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH, 0, 0);
      const toCanvasPx = (coord: [number, number]): [number, number] => {
        const [ix, iy] = projector(coord);
        return [bgX + (ix * drawnW) / frame.imgW, bgY + (iy * drawnH) / frame.imgH];
      };

      const KIND_TO_LINE: Record<'building' | 'road' | 'water', LineKind> = { building: 'building', road: 'path', water: 'waterbody' };
      const KIND_TO_GHOST: Record<'building' | 'road' | 'water', GhostFeature['kind']> = { building: 'osm_building', road: 'osm_road', water: 'osm_water' };
      const clipRect: ClipRect = { x: bgX, y: bgY, w: drawnW, h: drawnH };

      // Dedupe against lines already accepted in a previous run (or restored from a
      // saved design) — id `osm-${feature.id}` (or a `-N` piece of a split road).
      const alreadyHas = (featureId: number) => linesRef.current.some((l) => l.id === `osm-${featureId}` || l.id.startsWith(`osm-${featureId}-`));

      const buildings: GhostFeature[] = [];
      const others: GhostFeature[] = [];
      (res.features ?? []).forEach((f) => {
        if (!f.ring || f.ring.length < 2 || alreadyHas(f.id)) return;
        const pxPoints = f.ring.flatMap((c) => toCanvasPx(c));

        if (f.kind === 'road') {
          const pieces = clipPolylineToRect(pxPoints, clipRect);
          pieces.forEach((piece, pi) => {
            const ghost: GhostFeature = {
              id: pieces.length > 1 ? `osm-${f.id}-${pi + 1}` : `osm-${f.id}`,
              kind: KIND_TO_GHOST[f.kind],
              lineKind: KIND_TO_LINE[f.kind],
              pxPoints: piece,
              note: f.name,
              layer: 'existing',
            };
            others.push(ghost);
          });
        } else {
          const clippedPoly = clipPolygonToRect(pxPoints, clipRect);
          if (clippedPoly.length < 6) return; // < 3 points
          const ghost: GhostFeature = {
            id: `osm-${f.id}`,
            kind: KIND_TO_GHOST[f.kind],
            lineKind: KIND_TO_LINE[f.kind],
            pxPoints: clippedPoly,
            note: f.name,
            layer: 'existing',
          };
          (f.kind === 'building' ? buildings : others).push(ghost);
        }
      });
      const found = [...buildings, ...others].slice(0, 60);

      if (found.length > 0) {
        setGhosts(found);
        setGhostSource('osm');
      } else if (manual) {
        setFindFeaturesError('No new map features here.');
      }
    } catch {
      if (manual) setFindFeaturesError('No map data reachable — try again in a minute.');
    } finally {
      setFindingFeatures(false);
    }
  }

  const placeItem = (type: ElType, cx: number, cy: number) => {
    pushHistory();
    const c = CATALOG[type];
    const id = `${type}-${Date.now()}-${Math.round(Math.random() * 999)}`;
    const layer = layerForItem(activeLayer, type);
    setItems((prev) => [...prev, { id, type, x: cx - (c.w * pxPerM) / 2, y: cy - (c.h * pxPerM) / 2, wM: c.w, hM: c.h, rotation: 0, litres: c.litres, layer }]);
    setSelectedId(id);
    if (type === 'tank' || type === 'tree') {
      setTankCustomOpen(false); setTankCustomValue('');
      setTreeSpecies(''); setTreeCustomOpen(false); setTreeCount(1);
      setPlacementPrompt({ id, type });
    }
  };

  // ── AI-detect ghost accept/dismiss ──────────────────────────────────────
  const dismissGhost = (id: string) => {
    setGhosts((prev) => {
      const next = (prev ?? []).filter((g) => g.id !== id);
      return next.length ? next : null;
    });
  };

  const acceptGhost = (g: GhostFeature, skipHistory = false) => {
    if (!skipHistory) pushHistory();
    if (g.kind === 'veg_area') {
      // Ring → bed footprint from the bounding box. Checked BEFORE g.elType
      // below — buildGhosts (lib/facilitator-design.ts) sets elType:'bed' on
      // every veg_area ghost too (so existing point-feature code can share
      // its icon), which used to make this whole branch unreachable dead
      // code: the generic point-feature branch always won first, planting a
      // 1x1 bed centered on the ring's raw first vertex instead of a bed
      // sized/positioned from the actual detected shape. `kind` is the more
      // specific signal for a multi-point ring and must be checked first.
      //
      // A raw detected/traced bbox can be any odd width (e.g. a wide
      // vegetable patch), which then silently feeds inaccurate m² into every
      // crop-plan yield/overlap calc downstream. Veg beds are standardised
      // at a 1m width — snap to that here and derive the length from the
      // DETECTED AREA (not just the longer bbox side) so the imported bed's
      // total m² still matches what was actually traced/detected, just
      // reshaped into a 1m-wide strip.
      const xs = g.pxPoints.filter((_, i) => i % 2 === 0);
      const ys = g.pxPoints.filter((_, i) => i % 2 === 1);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const rawWM = (maxX - minX) / pxPerM;
      const rawHM = (maxY - minY) / pxPerM;
      const detectedAreaM2 = rawWM * rawHM;
      const STANDARD_BED_WIDTH_M = 1;
      const lengthM = Math.max(STANDARD_BED_WIDTH_M, detectedAreaM2 / STANDARD_BED_WIDTH_M);
      const id = `bed-${Date.now()}-${Math.round(Math.random() * 999)}`;
      setItems((prev) => [...prev, {
        id, type: 'bed', x: minX, y: minY,
        wM: STANDARD_BED_WIDTH_M, hM: lengthM, rotation: 0, layer: 'existing',
      }]);
    } else if (g.elType) {
      // Point feature — a single [x, y] pair; footprint is square (wM = hM).
      const c = CATALOG[g.elType];
      const px = g.pxPoints[0], py = g.pxPoints[1];
      const sizeM = g.sizeM ?? c.w;
      const sizePx = sizeM * pxPerM;
      const id = `${g.elType}-${Date.now()}-${Math.round(Math.random() * 999)}`;
      setItems((prev) => [...prev, {
        id, type: g.elType!, x: px - sizePx / 2, y: py - sizePx / 2,
        wM: sizeM, hM: sizeM, rotation: 0, litres: c.litres, layer: 'existing',
      }]);
    } else if (g.kind === 'osm_building' || g.kind === 'osm_road' || g.kind === 'osm_water') {
      // Surveyed map data — building/water rings close, roads stay open polylines.
      // g.id IS the final line id already (`osm-${feature.id}`, or `-1`/`-2`/… for a
      // split road piece) — do not re-prefix it.
      setLines((prev) => [...prev, {
        id: g.id, kind: g.lineKind!, points: g.pxPoints, closed: g.kind !== 'osm_road', layer: 'existing',
      }]);
    } else if (g.lineKind) {
      // Polyline / ring — driveway → path, boundary → fence.
      const id = `line-${Date.now()}-${Math.round(Math.random() * 999)}`;
      setLines((prev) => [...prev, {
        id, kind: g.lineKind!, points: g.pxPoints, closed: g.kind === 'boundary', layer: 'existing',
      }]);
    }
    dismissGhost(g.id);
  };

  const acceptAllGhosts = () => {
    if ((ghosts ?? []).length > 0) pushHistory();
    (ghosts ?? []).forEach((g) => acceptGhost(g, true));
  };

  // All zoom — native listeners on wrapRef (always mounted, supports passive:false).
  // Uses refs so handlers never read stale state between rapid events.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const applyZoom = (newScale: number, originX: number, originY: number) => {
      const oldScale = stageScaleRef.current;
      const oldPos = stagePosRef.current;
      const clamped = Math.min(8, Math.max(0.08, newScale));
      const newPos = {
        x: originX - (originX - oldPos.x) * (clamped / oldScale),
        y: originY - (originY - oldPos.y) * (clamped / oldScale),
      };
      stageScaleRef.current = clamped;
      stagePosRef.current = newPos;
      setStageScale(clamped);
      setStagePos(newPos);
    };

    const panBy = (dx: number, dy: number) => {
      const p = stagePosRef.current;
      const np = { x: p.x + dx, y: p.y + dy };
      stagePosRef.current = np;
      setStagePos(np);
    };

    // Wheel: pinch-zoom (trackpad pinch fires ctrlKey; Cmd/Ctrl+wheel too) zooms
    // about the cursor; a plain two-finger/scroll gesture PANS. This means
    // scrolling over the canvas never surprises you by zooming.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        applyZoom(stageScaleRef.current * factor, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        panBy(-e.deltaX, -e.deltaY);
      }
    };

    // Two fingers = pan (by the midpoint's movement) AND pinch-zoom together,
    // exactly like a native map. One finger never reaches here, so it can't pan.
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastCenter.current) panBy(cx - lastCenter.current.x, cy - lastCenter.current.y);
      if (lastDist.current > 0 && dist > 0) applyZoom(stageScaleRef.current * (dist / lastDist.current), cx, cy);
      lastDist.current = dist;
      lastCenter.current = { x: cx, y: cy };
    };

    const onTouchEnd = () => { lastDist.current = 0; lastCenter.current = null; };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  // Hold Space to pan on desktop (released → back to editing); ignore while typing.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      e.preventDefault();
      setSpaceHeld(true);
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Arming a place/line/scale/sector tool cancels the Pan tool, so the two
  // interaction modes are never both live.
  useEffect(() => { if (placeType || lineKind || scaleMode || armedSector) setPanTool(false); }, [placeType, lineKind, scaleMode, armedSector]);

  // Restore a saved design on mount — progressive building survives reload.
  //
  // METRE-BASED PERSISTENCE (geomVersion 2): saved geometry is metres relative to
  // the bg's top-left corner, not absolute px, because the satellite re-fits to
  // whatever container is on screen right now. Since the bg is restored
  // asynchronously (loadSiteBackground's img.onload, or the file-image's own
  // onload below), the metre→px conversion must happen AFTER the fresh
  // bgRect+pxPerM are known — so items/lines/sectors are NOT set immediately for
  // a geomVersion-2 doc with a background; they're set inside the bg's onReady/
  // onload callback instead. A doc with no background at all has no rect to wait
  // for, so it converts immediately using a default px/m.
  //
  // v1 docs (no geomVersion) predate this scheme entirely and were saved in
  // absolute px. They're migrated on load: px (OLD saved bgRect+pxPerM) → metres
  // → px (NEW freshly-computed bgRect+pxPerM). With no saved bgRect there is
  // nothing to convert from, so they load as-is (best effort).
  useEffect(() => {
    const s = loadFacilitatorState();
    if (s) {
      const isV2 = s.geomVersion === 2;
      const rawItems = s.items as FacItem[];
      const rawLines = s.lines as FacLine[];
      const rawSectors = (s.sectors ?? []) as FacSector[];

      // Resolves raw saved geometry (v1 px or v2 metres) into px against a FRESH
      // bgRect+pxPerM, or — if no bg is available at all — a sensible fallback.
      const resolveAndSet = (freshRect: BgRect | null, freshPxPerM: number) => {
        if (isV2) {
          if (freshRect) {
            const g = geomMToPx(rawItems, rawLines, rawSectors, freshRect, freshPxPerM);
            setItems(g.items as Item[]);
            setLines(g.lines as LineEl[]);
            setSectors(g.sectors as SectorEl[]);
          } else {
            // No bg at all — nothing to anchor metres to; use a default px/m so
            // geometry still renders (in a sensible relative layout) instead of crashing.
            const g = geomMToPx(rawItems, rawLines, rawSectors, { x: 0, y: 0, w: 0, h: 0 }, DEFAULT_PX_PER_M);
            setItems(g.items as Item[]);
            setLines(g.lines as LineEl[]);
            setSectors(g.sectors as SectorEl[]);
          }
        } else {
          // v1 migration: if we know the OLD rect+scale this was saved under, go
          // px(old) → metres → px(new fresh rect). Otherwise load as-is.
          if (s.bgRect && freshRect) {
            const oldRect = s.bgRect;
            const oldPxPerM = s.pxPerM;
            const m = geomPxToM(rawItems, rawLines, rawSectors, oldRect, oldPxPerM);
            const g = geomMToPx(m.items, m.lines, m.sectors, freshRect, freshPxPerM);
            setItems(g.items as Item[]);
            setLines(g.lines as LineEl[]);
            setSectors(g.sectors as SectorEl[]);
          } else {
            setItems(rawItems as Item[]);
            setLines(rawLines as LineEl[]);
            setSectors(rawSectors as SectorEl[]);
          }
        }
      };

      setPxPerM(s.pxPerM);
      if (s.pxPerM !== 26) setScaleSet(true);
      setActiveLayer(s.activeLayer ?? 'base');
      setHiddenLayers(s.hiddenLayers ?? []);
      setWashOn(s.washOn ?? false);
      setDesignId(s.designId ?? null);
      setDesignTitle(s.title ?? '');
      setDismissedMapshapeIds(s.dismissedMapshapeIds ?? []);

      if (s.bgSite) {
        // NB: loadSiteBackground's own returned promise resolves once the satellite
        // FETCH completes, not once the image has decoded/onBgReady has fired — so
        // restoreSettled must flip inside onBgReady itself (and inside the .catch
        // fallback), not off a .then() on the outer promise.
        loadSiteBackground(s.bgSite, (freshRect, freshPxPerM) => {
          resolveAndSet(freshRect, freshPxPerM);
          setRestoreSettled(true);
        }).catch(() => {
          // Satellite fetch failed — still show geometry rather than an empty canvas.
          resolveAndSet(null, s.pxPerM || DEFAULT_PX_PER_M);
          setRestoreSettled(true);
        });
      } else if (s.bgDataUrl && s.bgRect) {
        const img = new window.Image();
        const rect = s.bgRect;
        img.onload = () => {
          setBg({ img, x: rect.x, y: rect.y, w: rect.w, h: rect.h, opacity: s.bgOpacity ?? 1 });
          setBgDataUrl(s.bgDataUrl ?? null);
          setShowGrid(false);
          // File imports restore the SAME rect they were saved with — metres
          // convert back losslessly against it.
          resolveAndSet(rect, s.pxPerM);
          setRestoreSettled(true);
        };
        img.onerror = () => setRestoreSettled(true);
        img.src = s.bgDataUrl;
      } else {
        // No background at all.
        resolveAndSet(null, s.pxPerM || DEFAULT_PX_PER_M);
        setRestoreSettled(true);
      }
    } else {
      setRestoreSettled(true);
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AUTO-PICK SITE FROM URL (fix 2) — once the mount restore above (incl. any async
  // background it loaded) has settled, import the site passed via the URL if it
  // isn't already what's on screen. Runs from a FRESH render's closure (not the
  // one-shot mount effect above), so bgSite/importSite here are never stale — the
  // ref guard just ensures it only actually fires once per mount.
  useEffect(() => {
    if (!restoreSettled || !initialSite || autoPickedRef.current) return;
    autoPickedRef.current = true;
    const differs = !bgSite || Math.abs(bgSite.lat - initialSite.lat) + Math.abs(bgSite.lon - initialSite.lon) > SITE_DIFF_DEG;
    if (differs) importSite(initialSite).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreSettled]);

  // Local-state payload builder — same shape saveFacilitatorState persists under its
  // STORE_KEY. Shared by the debounced autosave below AND by backupCurrentDesign
  // (BACKUP_KEY safety-net snapshot for importSite/startFresh) so both always agree
  // on exactly what "the current design" means.
  //
  // METRE-BASED PERSISTENCE (geomVersion 2): the background satellite re-fits to
  // whatever container is on screen at load time, so absolute stage px drift off
  // the image on a different device/window. We persist geometry in metres
  // relative to the bg's top-left corner (using the CURRENT bgRect + pxPerM as
  // the anchor) so load-time can re-derive px against the freshly-fit rect.
  // Runtime state (items/lines/sectors) stays in px throughout — this conversion
  // happens only at the save boundary.
  const buildLocalStatePayload = useCallback((): FacilitatorDesignState => {
    const bgRect: BgRect | undefined = bg ? { x: bg.x, y: bg.y, w: bg.w, h: bg.h } : undefined;
    const geom = bgRect ? geomPxToM(items, lines, sectors, bgRect, pxPerM) : null;
    return {
      version: 1,
      geomVersion: 2,
      items: (geom?.items ?? items) as FacItem[],
      lines: (geom?.lines ?? lines) as FacLine[],
      sectors: (geom?.sectors ?? sectors) as FacSector[],
      pxPerM,
      activeLayer,
      hiddenLayers,
      washOn,
      designId: designId ?? undefined,
      title: designTitle || undefined,
      bgSite: bgSite ?? undefined,
      bgDataUrl: (!bgSite && bgDataUrl && bgDataUrl.length < 1_500_000) ? bgDataUrl : undefined,
      bgRect,
      bgOpacity: bg?.opacity,
      dismissedMapshapeIds: dismissedMapshapeIds.length ? dismissedMapshapeIds : undefined,
      savedAt: Date.now(),
    };
  }, [items, lines, sectors, pxPerM, activeLayer, hiddenLayers, washOn, designId, designTitle, bgSite, bgDataUrl, bg, dismissedMapshapeIds]);

  // Debounced autosave — skip until the initial restore above has completed so we
  // never clobber saved state with the empty initial render.
  useEffect(() => {
    if (!restoredRef.current) return;
    const t = setTimeout(() => {
      saveFacilitatorState(buildLocalStatePayload());
    }, 600);
    return () => clearTimeout(t);
  }, [buildLocalStatePayload]);

  // SITE-SWITCH / START-FRESH SAFETY NET — snapshot the ENTIRE current design (same
  // shape as the local autosave above, plus backedUpAt) to a single backup slot
  // before an action that would otherwise destroy it without recourse (importSite
  // clearing for a new site; startFresh). "Restore backed-up design" in the Base map
  // section swaps it back in — see restoreBackedUpDesign.
  const backupCurrentDesign = useCallback(() => {
    try {
      const payload: BackupPayload = { ...buildLocalStatePayload(), backedUpAt: Date.now() };
      localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
      setHasBackup(true);
    } catch {
      // Quota or unavailable — best effort; never blocks the switch/clear it guards.
    }
  }, [buildLocalStatePayload]);

  // Cloud payload — NEVER include bgDataUrl (Firestore 1 MB doc limit); bgSite is
  // cheap (re-fetches the satellite on load) so it's safe to persist. Same
  // metre-relative conversion as the localStorage save above (geomVersion 2).
  const buildCloudPayload = useCallback(() => {
    const bgRect: BgRect | undefined = bg ? { x: bg.x, y: bg.y, w: bg.w, h: bg.h } : undefined;
    const geom = bgRect ? geomPxToM(items as FacItem[], lines as FacLine[], sectors as FacSector[], bgRect, pxPerM) : null;
    return {
      title: designTitle || siteText || bgSite?.name || 'Garden design',
      data: {
        geomVersion: 2 as const,
        items: geom?.items ?? items,
        lines: geom?.lines ?? lines,
        sectors: geom?.sectors ?? sectors,
        pxPerM, bgSite: bgSite ?? null, activeLayer, hiddenLayers,
        dismissedMapshapeIds: dismissedMapshapeIds.length ? dismissedMapshapeIds : undefined,
      },
    };
  }, [designTitle, siteText, bgSite, items, lines, sectors, pxPerM, activeLayer, hiddenLayers, bg, dismissedMapshapeIds]);

  // Cloud autosave — only once a design is bound (designId set) and the initial
  // localStorage restore has completed, so we never clobber a doc with empty state.
  useEffect(() => {
    if (!restoredRef.current || !designId) return;
    const t = setTimeout(async () => {
      if (manualSaveInFlight.current) return;
      setCloudStatus('saving');
      try {
        const ok = await updateDesign(designId, buildCloudPayload());
        setCloudStatus(ok ? 'saved' : 'error');
        if (ok) setCloudSavedAt(Date.now());
      } catch {
        setCloudStatus('error');
      }
    }, 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lines, sectors, pxPerM, activeLayer, hiddenLayers, bgSite, designId]);

  // FIRST-SAVE CLOUD GAP — the cloud autosave above only ever engages once designId
  // is set, so a signed-in facilitator who never taps "Save design" gets local-only
  // backup forever. Once there's real content (canAiPolish-style check — see below)
  // and 10s of quiet, auto-create the cloud doc via the exact same create path
  // handleSave uses, so designId gets set and the autosave effect above takes over
  // from here. Signed-out facilitators are never touched — saveDesign would no-op
  // for them anyway, but gating explicitly avoids even attempting the write.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!restoredRef.current || designId || autoCreatedRef.current) return;
    const hasContent = !!bg && (items.length > 0 || lines.length > 0); // canAiPolish-style check
    if (!hasContent || !getFirebase()?.auth?.currentUser?.uid) return;
    const t = setTimeout(async () => {
      if (autoCreatedRef.current || designId || manualSaveInFlight.current) return;
      autoCreatedRef.current = true;
      try {
        const id = await saveDesign(buildCloudPayload());
        if (id) {
          setDesignId(id);
          setCloudStatus('saved');
          setCloudSavedAt(Date.now());
        }
      } catch {
        // Best effort — the facilitator can still tap "Save design" manually.
      }
    }, 10000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, lines, bg, designId]);

  function onStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    const p = stage?.getRelativePointerPosition();
    if (!p) return;

    if (scaleMode) {
      if (!draftPt) { setDraftPt([p.x, p.y]); }
      else {
        const px = Math.hypot(p.x - draftPt[0], p.y - draftPt[1]);
        const m = parseFloat(window.prompt('How many metres is this line on the ground?', '10') || '');
        if (m > 0 && px > 4) { setPxPerM(px / m); setScaleSet(true); }
        setScaleMode(false); setDraftPt(null);
      }
      return;
    }
    if (isArmedPolygon) {
      // Each tap adds a corner; the shape is closed via the "Finish shape"
      // button (needs 3+ points) rather than a second tap, since a polygon's
      // vertex count is open-ended.
      setPolyDraft((prev) => [...prev, p.x, p.y]);
      return;
    }
    if (lineKind) {
      if (!draftPt) { setDraftPt([p.x, p.y]); }
      else {
        pushHistory();
        const layer = layerForLine(activeLayer, lineKind);
        setLines((prev) => [...prev, { id: `line-${Date.now()}`, kind: lineKind, points: [draftPt[0], draftPt[1], p.x, p.y], layer }]);
        setDraftPt(null); setLineKind(null);
      }
      return;
    }
    if (placeType) {
      placeItem(placeType, p.x, p.y);
      setPlaceType(null);
      return;
    }
    if (armedSector) {
      pushHistory();
      const def = SECTOR_DEFS[armedSector];
      const id = `sector-${Date.now()}`;
      setSectors((prev) => [...prev, { id, kind: armedSector, x: p.x, y: p.y, rotation: 0, radiusM: def.radiusM, spanDeg: def.spanDeg }]);
      setSelectedId(id);
      setArmedSector(null);
      return;
    }
    if (e.target === stage) setSelectedId(null);
  }

  // Commit the in-progress polygon draft (roof/driveway/patio) as a closed
  // area line, then disarm the tool — same one-shot pattern as every other
  // placement in this file (2-point lines, single items, sectors).
  const finishPolygonDraft = () => {
    if (!lineKind || polyDraft.length < 6) return; // need 3+ points
    pushHistory();
    const layer = layerForLine(activeLayer, lineKind);
    setLines((prev) => [...prev, { id: `line-${Date.now()}`, kind: lineKind, points: polyDraft, closed: true, layer }]);
    setPolyDraft([]); setLineKind(null);
  };
  const undoPolygonVertex = () => setPolyDraft((prev) => prev.slice(0, -2));
  const cancelPolygonDraft = () => { setPolyDraft([]); setLineKind(null); };

  const deleteSelected = () => {
    if (!selectedId) return;
    pushHistory();
    delete nodeRefs.current[selectedId];
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSectors((prev) => prev.filter((s) => s.id !== selectedId));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (selected) {
      pushHistory();
      const id = `${selected.type}-${Date.now()}`;
      setItems((prev) => [...prev, { ...selected, id, x: selected.x + 20, y: selected.y + 20 }]);
      setSelectedId(id);
      return;
    }
    if (selectedSector) {
      pushHistory();
      const id = `sector-${Date.now()}`;
      setSectors((prev) => [...prev, { ...selectedSector, id, x: selectedSector.x + 20, y: selectedSector.y + 20 }]);
      setSelectedId(id);
    }
  };

  // ⌘C/⌘V duplication — distinct from the Duplicate button above: this goes
  // through an internal clipboard, so you can pan/select elsewhere between
  // copy and paste. A fresh ⌘C resets the clipboard to the current selection;
  // repeated ⌘V without a fresh ⌘C keeps offsetting from the LAST paste (not
  // the original source), so a row of ⌘V presses staircases down-right.
  const copySelected = () => {
    if (selected) clipboardRef.current = { kind: 'item', data: { ...selected } };
    else if (selectedSector) clipboardRef.current = { kind: 'sector', data: { ...selectedSector } };
  };
  const PASTE_OFFSET_M = 1.2;
  const pasteClipboard = () => {
    const clip = clipboardRef.current;
    if (!clip) return;
    pushHistory();
    const offset = PASTE_OFFSET_M * pxPerM;
    if (clip.kind === 'item') {
      const id = `${clip.data.type}-${Date.now()}-${Math.round(Math.random() * 999)}`;
      const next: Item = { ...clip.data, id, x: clip.data.x + offset, y: clip.data.y + offset };
      setItems((prev) => [...prev, next]);
      setSelectedId(id);
      clipboardRef.current = { kind: 'item', data: next };
    } else {
      const id = `sector-${Date.now()}`;
      const next: SectorEl = { ...clip.data, id, x: clip.data.x + offset, y: clip.data.y + offset };
      setSectors((prev) => [...prev, next]);
      setSelectedId(id);
      clipboardRef.current = { kind: 'sector', data: next };
    }
  };

  // Property-panel edits (number inputs) — debounced push so a keystroke burst
  // or slider drag collapses into one undo step.
  const updateSel = (patch: Partial<Item>) => { pushHistoryDebounced(); setItems((prev) => prev.map((i) => i.id === selectedId ? { ...i, ...patch } : i)); };
  const updateSelSector = (patch: Partial<SectorEl>) => { pushHistoryDebounced(); setSectors((prev) => prev.map((s) => s.id === selectedId ? { ...s, ...patch } : s)); };

  const bakeTransform = (id: string, node: Konva.Node) => {
    pushHistory();
    const sx = node.scaleX(), sy = node.scaleY();
    node.scaleX(1); node.scaleY(1);
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      if (CATALOG[it.type].shape === 'circle') {
        const sf = (sx + sy) / 2;
        return { ...it, x: node.x(), y: node.y(), rotation: node.rotation(), wM: Math.max(0.2, it.wM * sf), hM: Math.max(0.2, it.hM * sf) };
      }
      return { ...it, x: node.x(), y: node.y(), rotation: node.rotation(), wM: Math.max(0.2, it.wM * sx), hM: Math.max(0.2, it.hM * sy) };
    }));
  };

  // Load real farmers when share panel opens
  useEffect(() => {
    if (!shareOpen) return;
    setFarmersLoading(true);
    listFarmers()
      .then((rows) => { if (rows.length) setFarmers(rows); })
      .catch(() => { /* fallback to FARMERS constant */ })
      .finally(() => setFarmersLoading(false));
  }, [shareOpen]);

  async function sendDesignToFarmer(farmer: Profile) {
    setSharing(true);
    setShareError(null);
    try {
      let id = designId;
      if (id) {
        await updateDesign(id, buildCloudPayload());
      } else {
        id = await saveDesign(buildCloudPayload());
        if (id) setDesignId(id);
      }
      if (!id) throw new Error('Could not save the design to send it.');
      await shareDesign(id, farmer.id);
      setSharedTo(farmer.full_name ?? farmer.id);
      setShareOpen(false);
    } catch {
      // HONEST FAILURE: do not fake a "sent" banner — the farmer would never
      // receive anything and a facilitator relying on the ✓ would be misled.
      setShareError('⚠ Could not send — check connection');
    } finally {
      setSharing(false);
    }
  }

  async function handleSave() {
    manualSaveInFlight.current = true;
    setCloudStatus('saving');
    setSavedMsg('Saving…');
    try {
      const payload = buildCloudPayload();
      if (designId) {
        const ok = await updateDesign(designId, payload);
        if (ok) {
          setCloudStatus('saved'); setCloudSavedAt(Date.now());
          setSavedMsg(`✓ Saved · ${payload.title}`);
        } else {
          setCloudStatus('error');
          setSavedMsg('⚠ Not saved to cloud — sign in. Work is kept on this device.');
        }
      } else {
        const id = await saveDesign(payload);
        if (id) {
          setDesignId(id);
          setCloudStatus('saved'); setCloudSavedAt(Date.now());
          setSavedMsg(`✓ Saved · ${payload.title}`);
        } else {
          setCloudStatus('local-only');
          setSavedMsg('⚠ Not saved to cloud — sign in. Work is kept on this device.');
        }
      }
    } catch {
      setCloudStatus('error');
      setSavedMsg('⚠ Not saved to cloud — sign in. Work is kept on this device.');
    } finally {
      manualSaveInFlight.current = false;
    }
    setTimeout(() => setSavedMsg(''), 3000);
  }

  // ── My designs (load / delete) ──────────────────────────────────────────
  async function openMyDesigns() {
    const next = !myDesignsOpen;
    setMyDesignsOpen(next);
    if (next) {
      setDesignsLoading(true);
      setMyDesignsList(null);
      try {
        const list = await myDesigns();
        setMyDesignsList(list);
      } catch {
        setMyDesignsList([]);
      } finally {
        setDesignsLoading(false);
      }
    }
  }

  async function loadDesignRow(d: Design) {
    const hasUnsavedWork = (items.length > 0 || lines.length > 0) && designId !== d.id;
    if (hasUnsavedWork && !window.confirm('Load this design? Any unsaved changes to the current one will be lost from view (they remain on this device until overwritten).')) {
      return;
    }
    const data = (d.data ?? {}) as {
      geomVersion?: 2;
      items?: FacItem[]; lines?: FacLine[]; sectors?: FacSector[]; pxPerM?: number;
      activeLayer?: LayerId; hiddenLayers?: LayerId[];
      bgSite?: { lat: number; lon: number; name: string } | null;
      dismissedMapshapeIds?: string[];
    };
    const isV2 = data.geomVersion === 2;
    const rawItems = data.items ?? [];
    const rawLines = data.lines ?? [];
    const rawSectors = data.sectors ?? [];
    const savedPxPerM = data.pxPerM ?? 26;

    // Same metre→px restore boundary as the localStorage mount-restore: cloud docs
    // never carry a file-image background (buildCloudPayload only persists bgSite),
    // so the only async case is a map site background; otherwise resolve immediately.
    const resolveAndSet = (freshRect: BgRect | null, freshPxPerM: number) => {
      if (isV2) {
        const g = freshRect
          ? geomMToPx(rawItems, rawLines, rawSectors, freshRect, freshPxPerM)
          : geomMToPx(rawItems, rawLines, rawSectors, { x: 0, y: 0, w: 0, h: 0 }, DEFAULT_PX_PER_M);
        setItems(g.items as Item[]);
        setLines(g.lines as LineEl[]);
        setSectors(g.sectors as SectorEl[]);
      } else {
        // Pre-fix cloud doc: absolute px, no bgRect was ever stored to migrate
        // from — load as-is (best effort).
        setItems(rawItems as Item[]);
        setLines(rawLines as LineEl[]);
        setSectors(rawSectors as SectorEl[]);
      }
    };

    setPxPerM(savedPxPerM);
    setActiveLayer(data.activeLayer ?? 'base');
    setHiddenLayers(data.hiddenLayers ?? []);
    setSelectedId(null);
    setGhosts(null);
    setScaleSuggestion(null);
    setDesignId(d.id);
    setDesignTitle(d.title ?? '');
    setDismissedMapshapeIds(data.dismissedMapshapeIds ?? []);
    setCloudStatus('saved');
    setCloudSavedAt(Date.now());
    resetHistory();
    if (data.bgSite) {
      loadSiteBackground(data.bgSite, (freshRect, freshPxPerM) => resolveAndSet(freshRect, freshPxPerM)).catch(() => {
        resolveAndSet(null, savedPxPerM || DEFAULT_PX_PER_M);
      });
    } else {
      setBg(null); setBgSite(null); setBgDataUrl(null);
      resolveAndSet(null, savedPxPerM || DEFAULT_PX_PER_M);
    }
    setMyDesignsOpen(false);
  }

  async function deleteDesignRow(id: string) {
    if (!window.confirm('Delete this design? This cannot be undone.')) return;
    const ok = await deleteDesign(id);
    if (ok) {
      setMyDesignsList((prev) => (prev ?? []).filter((d) => d.id !== id));
      if (designId === id) setDesignId(null);
    }
  }

  // Farmer list to display: real ones if loaded, else hardcoded fallback.
  // The fallback is a DEMO list only (no backend account behind it) — labelled
  // and handled distinctly below so a facilitator never believes a demo click
  // actually reached a farmer's phone.
  const displayFarmers: Array<{ id: string; name: string; profile?: Profile; isDemo?: boolean }> =
    farmers.length > 0
      ? farmers.map((p) => ({ id: p.id, name: p.full_name ?? p.id, profile: p }))
      : FARMERS.map((name, i) => ({ id: `mock-${i}`, name: `${name} (demo)`, isDemo: true }));

  // ── BOQ ──
  // Ponds/dams have no fixed `litres` spec (unlike tanks) — estimate stored
  // volume from footprint area × an assumed average depth, since a facilitator
  // laying out water storage needs SOME number, not a blank. 1.5 m is a
  // conservative average depth for a small farm dam/pond (shallower at the
  // edges, deeper in the middle) — noted in the row's title attribute below.
  const POND_ASSUMED_DEPTH_M = 1.5;

  // "Already on the land" vs "to add": existing-layer geometry (the traced
  // boundary/house, detected trees, imported roads) is what's THERE, not what
  // the farmer is building — so it must not be costed. Everything on the design
  // layers (water/access/structures/planting) is the plan, and gets a price.
  const isExistingItem = (i: Item) => layerForItem(i.layer, i.type) === 'existing';
  const isExistingLine = (l: LineEl) => (layerForLine(l.layer, l.kind)) === 'existing';

  const groupItems = (list: Item[]) => (Object.keys(CATALOG) as ElType[]).map((type) => {
    const of = list.filter((i) => i.type === type); if (!of.length) return null;
    const c = CATALOG[type];
    const areaM2 = of.reduce((s, i) => s + (c.shape === 'circle' ? Math.PI * (i.wM / 2) ** 2 : i.wM * i.hM), 0);
    const litres = type === 'pond'
      ? areaM2 * POND_ASSUMED_DEPTH_M * 1000
      : of.reduce((s, i) => s + (i.litres ?? 0), 0);
    // Markers vs. real quantity diverge for trees: one marker can represent
    // several trees (Item.count, e.g. "5 mango trees" placed as one pin) — the
    // BOQ/budget must reflect the real count, not the marker count.
    const count = of.reduce((s, i) => s + (i.count ?? 1), 0);
    return { type, label: c.label, icon: c.icon, count, areaM2, litres };
  }).filter(Boolean) as { type: ElType; label: string; icon: string; count: number; areaM2: number; litres: number }[];

  const plannedItems = items.filter((i) => !isExistingItem(i));
  const existingItems = items.filter(isExistingItem);
  const boq = groupItems(items);              // ALL — capacity metrics (growing area, water store, rainwater)
  const plannedBoq = groupItems(plannedItems); // costed "to add"
  const existingItemRows = groupItems(existingItems);

  // `closed` adds the last→first closing segment (a traced property boundary
  // is a closed ring — omitting it under-measures the true perimeter, e.g. a
  // real 54 m boundary reading as 43 m). Every caller (BOQ, costed BOQ, the
  // WhatsApp budget text, AI review) reads off lineTotals below, so fixing the
  // maths here alone is enough — nothing downstream needs its own change.
  const lineLengthM = (points: number[], closed?: boolean) => {
    let d = 0;
    for (let i = 0; i + 3 < points.length; i += 2) d += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    if (closed && points.length >= 4) d += Math.hypot(points[0] - points[points.length - 2], points[1] - points[points.length - 1]);
    return d / pxPerM;
  };
  // Shoelace polygon area, px² — shared by the roof-catchment calc below and
  // by groupLines' per-kind area for driveway/patio (paved AREA kinds are
  // priced/measured by m², not by outline length — a driveway costs by the
  // ground it covers, not by its edge).
  const shoelaceAreaPx2 = (points: number[]): number => {
    let sum = 0;
    const n = points.length / 2;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = [points[i * 2], points[i * 2 + 1]];
      const j = (i + 1) % n;
      const [x1, y1] = [points[j * 2], points[j * 2 + 1]];
      sum += x0 * y1 - x1 * y0;
    }
    return Math.abs(sum) / 2;
  };

  const groupLines = (list: LineEl[]) => (Object.keys(LINES) as LineKind[]).map((kind) => {
    const of = list.filter((l) => l.kind === kind); if (!of.length) return null;
    const m = of.reduce((s, l) => s + lineLengthM(l.points, l.closed), 0);
    const areaM2 = AREA_LINE_KINDS.includes(kind)
      ? of.filter((l) => l.closed && l.points.length >= 6).reduce((s, l) => s + shoelaceAreaPx2(l.points) / (pxPerM * pxPerM), 0)
      : undefined;
    return { kind, label: LINES[kind].label, icon: LINES[kind].icon, count: of.length, m, areaM2 };
  }).filter(Boolean) as { kind: LineKind; label: string; icon: string; count: number; m: number; areaM2?: number }[];

  const plannedLines = lines.filter((l) => !isExistingLine(l));
  const existingLines = lines.filter(isExistingLine);
  const lineTotals = groupLines(lines);             // ALL (AI review context)
  const plannedLineTotals = groupLines(plannedLines); // costed "to add"
  const existingLineRows = groupLines(existingLines);

  const bedArea = boq.find((b) => b.type === 'bed')?.areaM2 ?? 0;
  const totalLitres = boq.reduce((s, b) => s + b.litres, 0);

  // ── Costed BOQ ──
  // Item rows: costForItem's type param matches CATALOG/ElType keys 1:1 (tank,
  // coop, shed, greenhouse, tunnel, etc. are the same strings on both sides) —
  // no extra mapping needed here. Tanks pass litres per-unit average since boq
  // rows are already summed across all placed instances of a type.
  // Costs are computed over PLANNED geometry only — existing features are not purchases.
  const boqCosts = plannedBoq.map((b) => {
    const list = plannedItems.filter((i) => i.type === b.type);
    const zar = list.reduce((s, i) => s + (costForItem(i.type, i.wM, i.hM, i.litres)?.zar ?? 0) * (i.count ?? 1), 0);
    return { type: b.type, zar: zar > 0 ? zar : null };
  });
  const lineCosts = plannedLineTotals.map((l) => ({
    kind: l.kind,
    ...((AREA_LINE_KINDS.includes(l.kind) ? costForAreaLine(l.kind, l.areaM2 ?? 0) : costForLine(l.kind, l.m)) ?? { zar: null }),
  }));
  const estBudgetTotal =
    boqCosts.reduce((s, b) => s + (b.zar ?? 0), 0) + lineCosts.reduce((s, l) => s + (l.zar ?? 0), 0);

  // ── Rainwater harvest potential ──
  // Roof area = closed 'building' line polygons (shoelace, px² ÷ pxPerM²) plus
  // the rect footprint of shed/greenhouse/tunnel/coop items — all roofed
  // structures a downpipe could realistically be hung off.
  const roofM2 = useMemo(() => {
    const buildingM2 = lines
      .filter((l) => l.kind === 'building' && l.closed && l.points.length >= 6)
      .reduce((s, l) => s + shoelaceAreaPx2(l.points) / (pxPerM * pxPerM), 0);
    const roofedItemM2 = items
      .filter((i) => i.type === 'shed' || i.type === 'greenhouse' || i.type === 'tunnel' || i.type === 'coop')
      .reduce((s, i) => s + i.wM * i.hM, 0);
    return buildingM2 + roofedItemM2;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, items, pxPerM]);

  const harvest = useMemo(() => {
    if (roofM2 < 10) return null;
    const { lat, lon } = bgSite ?? { lat: -29.86, lon: 31.02 }; // Durban default when no site set
    return describeHarvest(roofM2, lat, lon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roofM2, bgSite]);

  // Smart map labels: group visible items by type into ONE callout each (summed
  // count), stack the callouts just outside the property's right edge, and run a
  // leader line from each to its group's centre. Coordinates are stage px, so
  // the labels pan/zoom with the design and sit beside the property.
  const labelCallouts = useMemo(() => {
    if (!showLabels) return [];
    const vis = items.filter((it) => !hiddenLayers.includes(layerForItem(it.layer, it.type)));
    if (!vis.length) return [];
    // Group centres (rotation-aware) — by EFFECTIVE label (a custom label if the
    // farmer set one, else the type's catalog name), not by raw type. So two
    // trees renamed "Mango" / "Lemon" get their own pills instead of merging
    // into one generic "Fruit tree ×2".
    const byLabel = new Map<string, { type: ElType; cxs: number[]; cys: number[] }>();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const it of vis) {
      const w = it.wM * pxPerM, h = it.hM * pxPerM;
      const r = (it.rotation * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
      const cx = it.x + (w / 2) * cos - (h / 2) * sin;
      const cy = it.y + (w / 2) * sin + (h / 2) * cos;
      const key = effectiveLabel(it);
      const g = byLabel.get(key) ?? { type: it.type, cxs: [], cys: [] };
      g.cxs.push(cx); g.cys.push(cy); byLabel.set(key, g);
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx); minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
    }
    // Split labels to the side each cluster is nearest — left clusters get
    // left-margin labels, right clusters get right-margin labels — so leaders
    // stay short and don't all pile up crossing the whole plot.
    const fs = 13, hh = fs * 0.9, pad = 6, gap = hh * 2 + 6;
    const centerX = (minX + maxX) / 2;
    const groups = [...byLabel.entries()].map(([label, g]) => {
      const avgX = g.cxs.reduce((a, b) => a + b, 0) / g.cxs.length;
      const avgY = g.cys.reduce((a, b) => a + b, 0) / g.cys.length;
      // Anchor the leader line + marker dot to the REAL instance nearest the
      // group's average, not the raw average itself — when a label's items
      // are spread across the plot (e.g. 3 fruit trees at opposite corners),
      // the mathematical centroid can land in empty ground with no actual
      // feature there, making the leader look like it points at nothing.
      let cx = avgX, cy = avgY, bestD = Infinity;
      for (let i = 0; i < g.cxs.length; i++) {
        const d = (g.cxs[i] - avgX) ** 2 + (g.cys[i] - avgY) ** 2;
        if (d < bestD) { bestD = d; cx = g.cxs[i]; cy = g.cys[i]; }
      }
      const type = g.type, icon = CATALOG[type].icon, count = g.cxs.length;
      const pw = pad * 2 + (label.length + (count > 1 ? 4 : 0)) * fs * 0.6 + fs * 1.3; // icon + text est.
      const side: 'left' | 'right' = cx < centerX ? 'left' : 'right';
      const ax = side === 'left' ? minX - pw - 34 : maxX + 34;
      // The leader meets the pill's INNER edge (right edge of a left pill, left edge of a right pill).
      const lx = side === 'left' ? ax + pw : ax;
      return { type, cx, cy, label, icon, count, ax, lx, ay: cy, pw, hh, fs, pad, side };
    });
    // Spread ay per side so pills never overlap, centred on the vertical span.
    (['left', 'right'] as const).forEach((side) => {
      const col = groups.filter((g) => g.side === side).sort((a, b) => a.cy - b.cy);
      let y = Math.max(minY, (minY + maxY) / 2 - (col.length - 1) * gap / 2);
      for (const g of col) { g.ay = Math.max(g.ay, y); y = g.ay + gap; }
    });
    return groups;
  }, [showLabels, items, hiddenLayers, pxPerM]);

  // ── Layer bookkeeping for the stepper + coach ──
  const itemsByLayer: Partial<Record<LayerId, number>> = {};
  items.forEach((it) => {
    const l = layerForItem(it.layer, it.type);
    itemsByLayer[l] = (itemsByLayer[l] ?? 0) + 1;
  });
  const linesByLayer: Partial<Record<LayerId, number>> = {};
  lines.forEach((l) => {
    const layer = layerForLine(l.layer, l.kind);
    linesByLayer[layer] = (linesByLayer[layer] ?? 0) + 1;
  });
  const layerHasContent = (id: LayerId): boolean =>
    id === 'base' ? !!bg : (itemsByLayer[id] ?? 0) + (linesByLayer[id] ?? 0) > 0 || (id === 'sectors' && sectors.length > 0);
  // AI-polish layer picker candidates: layers with content, sectors excluded —
  // sector wedges are analysis overlays, never captured (see runAiPolishWith).
  // 'base' excluded too: it's the raw satellite (no design elements to illustrate
  // or label), and offering it traps the producer into a fruit-tree-only map that
  // hides every placed element. The full design lives on the other layers.
  const aiPolishCandidates = LAYER_ORDER.filter((id) => id !== 'sectors' && id !== 'base' && layerHasContent(id));
  // Producer candidates DO include sectors: the Sector map is a real map type
  // (exact wedge overlay on the AI-polished land — see runProducer).
  const producerCandidates = LAYER_ORDER.filter((id) => id !== 'base' && layerHasContent(id));
  const coachCounts: CoachCounts = {
    hasBg: !!bg,
    scaleSet,
    itemsByLayer,
    linesByLayer,
    sectors: sectors.length,
    tanks: items.filter((i) => i.type === 'tank').length,
    totalLitres,
    bedAreaM2: bedArea,
    paths: lines.filter((l) => l.kind === 'path').length,
  };

  function resetView() {
    stageScaleRef.current = 1;
    stagePosRef.current = { x: 0, y: 0 };
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
  }

  function startFresh() {
    if (!window.confirm('Clear this design and start fresh? This cannot be undone.')) return;
    // START FRESH SAFETY NET (fix 4): same BACKUP_KEY snapshot as importSite, so an
    // accidental Start fresh is rescued by the same "Restore backed-up design" button.
    backupCurrentDesign();
    clearFacilitatorState();
    setItems([]); setLines([]); setSectors([]);
    setBg(null); setBgSite(null); setBgDataUrl(null);
    setPxPerM(26); setScaleSet(false); setScaleLocked(false);
    setGhosts(null); setScaleSuggestion(null); setDetectError('');
    setFindFeaturesError(''); setGhostSource('ai');
    siteFrameRef.current = null;
    setActiveLayer('base'); setHiddenLayers([]);
    setSelectedId(null);
    setDesignId(null); setDesignTitle(''); setCloudStatus('idle'); setCloudSavedAt(null);
    setDismissedMapshapeIds([]);
    resetHistory();
    resetView();
  }

  async function runReview() {
    if (!items.length) return;
    setReviewing(true); setReview('');
    const desc = items.map((it) => {
      const name = effectiveLabel(it);
      const qty = it.count && it.count > 1 ? ` ×${it.count}` : '';
      return `- ${name}${qty}${it.litres ? ` (${it.litres}L)` : ''} at (${(it.x / pxPerM).toFixed(1)}m east, ${(it.y / pxPerM).toFixed(1)}m south), size ${it.wM.toFixed(1)}×${it.hM.toFixed(1)}m`;
    }).join('\n');
    const ld = lineTotals.map((l) => `- ${l.count} ${l.label.toLowerCase()} run(s), ~${l.m.toFixed(1)}m total`).join('\n');
    const layoutText = `${desc}${ld ? '\n' + ld : ''}\nThe top of the plan is NORTH.`;
    try {
      const res = await fetch('/api/design-review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutText, siteText, language }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const reader = res.body!.getReader(); const dec = new TextDecoder(); let text = '';
      while (true) { const { done, value } = await reader.read(); if (done) break; text += dec.decode(value, { stream: true }); setReview(text); }
    } catch (e) { setReview(`⚠ ${e instanceof Error ? e.message : 'Review failed'}`); }
    finally { setReviewing(false); }
  }

  function exportPNG() {
    setSelectedId(null);
    requestAnimationFrame(() => {
      const uri = stageRef.current?.toDataURL({ pixelRatio: 2 }); if (!uri) return;
      const a = document.createElement('a'); a.href = uri; a.download = 'garden-plan.png'; a.click();
    });
  }

  // WhatsApp budget share — plain text so it opens straight into a chat, no login,
  // no attachment. Truncated to keep the wa.me URL well inside browser/OS limits.
  const WHATSAPP_TEXT_MAX = 1800;
  function shareBudgetOnWhatsApp() {
    const lines: string[] = [];
    lines.push(`*${designTitle || 'Garden design'}* — ImbewuField plan`);
    lines.push('*To add:*');
    plannedBoq.forEach((b) => {
      const cost = boqCosts.find((c) => c.type === b.type);
      const qty = b.litres ? ` (${Math.round(b.litres).toLocaleString()} L)` : b.areaM2 ? ` (${b.areaM2.toFixed(0)} m²)` : '';
      const costTxt = cost?.zar ? ` — ${formatZar(cost.zar)}` : '';
      lines.push(`• ${b.label} ×${b.count}${qty}${costTxt}`);
    });
    plannedLineTotals.forEach((l) => {
      const cost = lineCosts.find((c) => c.kind === l.kind);
      const costTxt = cost?.zar ? ` — ${formatZar(cost.zar)}` : '';
      lines.push(`• ${l.label} — ${l.m.toFixed(0)} m${costTxt}`);
    });
    lines.push(`TOTAL est: ${formatZar(estBudgetTotal)}`);
    if (harvest) lines.push(harvest.sentence);
    lines.push('Planning estimates — prices vary.');
    const text = lines.join('\n').slice(0, WHATSAPP_TEXT_MAX);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  // ── AI polish ──────────────────────────────────────────────────────────
  // Explicit, controlled beautify pass: crop a satellite+layers composite of
  // ONLY the currently-visible layers, build a pixel-lock mask over every
  // placed item/line (OpenAI/fal convention, same as DesignGlossy's
  // buildProtectMask: TRANSPARENT = AI may repaint, OPAQUE = pixel-preserved),
  // and send both through the exact same strict masked pipeline (gpt-image-2
  // via fal queue) DesignGlossy's "Best quality" button uses.
  const canAiPolish = !!bg && (items.length > 0 || lines.length > 0);
  const aiPolishBusy = aiPolish.phase === 'preparing' || aiPolish.phase === 'painting';

  function loadImageEl(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load the rendered image'));
      img.src = src;
    });
  }

  // Re-encode the result (the strict pipeline outputs JPEG bytes) to real PNG
  // bytes via a canvas round-trip — same trick DesignGlossy's handleDownload
  // uses — so the modal's "Download PNG" is byte-accurate, not just named
  // .png. Falls back to the untouched source if the round-trip fails.
  async function toPngDataUrl(src: string): Promise<string> {
    try {
      const img = await loadImageEl(src);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return src;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      return src;
    }
  }

  // Mask canvas, sized to match the composite exactly (outW × outH — the bg
  // rect at the composite's own pixelRatio). Every visible item footprint +
  // visible line stroke is painted OPAQUE black (protected); everything else
  // (the ground) stays transparent (AI may repaint).
  function buildAiPolishMask(
    bgRect: { x: number; y: number; w: number; h: number },
    visItems: Item[],
    visLines: LineEl[],
    outW: number,
    outH: number,
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable for the mask');
    ctx.clearRect(0, 0, outW, outH); // transparent everywhere = editable, by default

    const scale = outW / bgRect.w; // uniform — pixelRatio scales both axes together
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Items — footprint at its stage position/size, rotation applied around the
    // SAME pivot Konva uses: the Group's own origin (it.x, it.y) — a rect's
    // top-left corner, or a circle's offset local centre. Mirrors the exact
    // <Group x={it.x} y={it.y} rotation={it.rotation}><Rect/>|<Circle x={w/2}
    // y={h/2}/></Group> composition in the Stage render below.
    for (const it of visItems) {
      const cat = CATALOG[it.type];
      const w = it.wM * pxPerM * scale;
      const h = it.hM * pxPerM * scale;
      const ox = (it.x - bgRect.x) * scale;
      const oy = (it.y - bgRect.y) * scale;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate((it.rotation * Math.PI) / 180);
      ctx.beginPath();
      if (cat.shape === 'circle') ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      else ctx.rect(0, 0, w, h);
      ctx.fill();
      ctx.restore();
    }

    // Lines — stroked path (points are already absolute stage px, same space
    // as bgRect), kind's on-screen width scaled to output px + 4px flat
    // padding so anti-aliased stroke edges stay fully inside the protected
    // band. Closed lines get their last→first segment too (same as the
    // Line's own `closed` prop, and the same fix as lineLengthM above).
    for (const l of visLines) {
      if (l.points.length < 4) continue;
      const L = LINES[l.kind];
      ctx.beginPath();
      ctx.moveTo((l.points[0] - bgRect.x) * scale, (l.points[1] - bgRect.y) * scale);
      for (let i = 2; i + 1 < l.points.length; i += 2) {
        ctx.lineTo((l.points[i] - bgRect.x) * scale, (l.points[i + 1] - bgRect.y) * scale);
      }
      if (l.closed) ctx.closePath();
      ctx.lineWidth = L.width * scale + 4;
      ctx.stroke();
    }

    return canvas.toDataURL('image/png');
  }

  // Rich element list for the AI's context, e.g. "5000 L jojo tank 1.8 m
  // across (Water); fence 54 m, closed loop (Access)". Same visibility filter
  // as the mask, so the AI is told about exactly what it must paint around.
  function describePlacedElements(visItems: Item[], visLines: LineEl[]): string {
    const layerName = (l: LayerId) => LAYERS[l].name;
    const itemDescs = visItems.map((it) => {
      const c = CATALOG[it.type];
      const name = effectiveLabel(it).toLowerCase();
      const layer = layerName(layerForItem(it.layer, it.type));
      const size = c.shape === 'circle' ? `${it.wM.toFixed(1)} m across` : `${it.wM.toFixed(1)}×${it.hM.toFixed(1)} m`;
      const qty = it.count && it.count > 1 ? ` ×${it.count}` : '';
      const spec = it.litres ? `${it.litres.toLocaleString()} L ${name}${qty} ${size}` : `${name}${qty} ${size}`;
      return `${spec} (${layer})`;
    });
    const lineDescs = visLines.map((l) => {
      const L = LINES[l.kind];
      const layer = layerName(layerForLine(l.layer, l.kind));
      const m = lineLengthM(l.points, l.closed);
      return `${L.label.toLowerCase()} ${m.toFixed(0)} m${l.closed ? ', closed loop' : ''} (${layer})`;
    });
    return [...itemDescs, ...lineDescs].join('; ');
  }

  // STRICT per-map prompts. Field lesson: an open "paint a beautiful
  // permaculture map" brief makes the model INVENT a fantasy farm (herb
  // spirals, chicken runs, name banners) over the real site. The render must
  // be a faithful artistic RESTYLE of exactly what the capture shows — never
  // a redesign — so every prompt leads with hard don't-invent rules.
  function buildAiPolishPrompt(elementsText: string, siteName: string, mapLabel: string): string {
    const siteLine = siteName ? ` of "${siteName}"` : '';
    const hardRules =
      `STRICT RULES — this is a REAL property${siteLine}, not a concept: ` +
      `(1) Do NOT invent, add, move, remove or resize ANY feature — no new gardens, paths, ponds, trees, buildings or decorations of any kind. ` +
      `(2) Do NOT paint any text, labels, banners, legends or compasses. ` +
      `(3) The property boundary line stays EXACTLY where it is drawn. ` +
      `(4) Every real building, roof, driveway, road, tree and open area stays in its true position, shape and size — the result must be recognisably THIS exact property, feature for feature. ` +
      `(5) Keep the crop, scale and orientation identical; top of image is north. When unsure, keep it identical to the input.`;
    const styleLine =
      ` Style: redraw the photo as a clean, soft hand-drawn site map — gentle earth tones, subtle grass and soil texture, South African smallholding character. Change the STYLE only, never the content.`;
    const elementsLine = elementsText
      ? ` These features (existing and planned: ${elementsText}) are pixel-locked by the mask — do not touch, duplicate or restyle them; beautify only the ground texture between them.`
      : ` There are no marked features in this view — this is the ${mapLabel.toLowerCase()}: a faithful 1:1 artistic redraw of what the photo already shows, nothing more.`;
    return hardRules + styleLine + elementsLine;
  }

  // Human label for a chosen layer set — names the gallery entry, the modal
  // header and the AI prompt's scope line. "Water map" for one non-map-named
  // layer, "Full design" when every candidate is chosen, else joined names.
  function polishLabelFor(chosen: LayerId[]): string {
    if (chosen.length === 0) return 'Map';
    if (aiPolishCandidates.length > 0 && chosen.length === aiPolishCandidates.length) return 'Full design';
    if (chosen.length === 1) {
      const name = LAYERS[chosen[0]].name;
      return /map$/i.test(name) ? name : `${name} map`;
    }
    return chosen.map((id) => LAYERS[id].name).join(' + ');
  }

  // Open the modal into the layer picker. Default selection = the layers the
  // facilitator currently has visible (falls back to every candidate if none
  // of them are visible right now, so the picker never opens with nothing
  // checked). Pick itself never touches hiddenLayers — see the type above.
  function openAiPolishPicker(mode: 'polish' | 'producer' = 'polish') {
    if (!canAiPolish || aiPolishBusy) return;
    // Producer defaults to the WHOLE design (one combined map showing every
    // element, sectors as their own map); polish defaults to the visible layers.
    const visible = aiPolishCandidates.filter((id) => !hiddenLayers.includes(id));
    const selected = mode === 'producer' ? producerCandidates : (visible.length ? visible : aiPolishCandidates);
    setAiPolish({ phase: 'pick', selected, mode });
  }

  function toggleAiPolishLayer(id: LayerId) {
    setAiPolish((prev) => {
      if (prev.phase !== 'pick') return prev;
      const has = prev.selected.includes(id);
      return { phase: 'pick', selected: has ? prev.selected.filter((x) => x !== id) : [...prev.selected, id], mode: prev.mode };
    });
  }

  function toggleFullDesignPick() {
    setAiPolish((prev) => {
      if (prev.phase !== 'pick') return prev;
      const cands = prev.mode === 'producer' ? producerCandidates : aiPolishCandidates;
      const isFull = cands.length > 0 && cands.every((id) => prev.selected.includes(id));
      return { phase: 'pick', selected: isFull ? [] : [...cands], mode: prev.mode };
    });
  }

  async function runAiPolishWith(chosen: LayerId[]) {
    if (!bg || (!items.length && !lines.length) || chosen.length === 0 || aiPolishBusy) return;
    const label = polishLabelFor(chosen);
    setAiPolish({ phase: 'preparing', label });

    // Snapshot the user's EXACT prior view/visibility, so it can be restored
    // through the single path below regardless of success or error (there is
    // no cancel mid-run — the modal has no close button while busy).
    const prevScale = stageScaleRef.current;
    const prevPos = stagePosRef.current;
    const prevHidden = hiddenLayers;

    // The 'existing' layer (traced boundary, house footprint, roads) is the
    // ground truth of the site — it is ALWAYS captured and mask-protected, on
    // every map, even when the picker didn't select it. Without this, a
    // Base-map polish had an all-transparent mask and the model repainted the
    // boundary and real features at will (field-tested: it invented a farm).
    const effectiveChosen: LayerId[] = chosen.includes('existing') ? chosen : [...chosen, 'existing'];

    // Complement of the effective set — everything NOT in it gets hidden for
    // the capture. Sectors is never a candidate (excluded from
    // aiPolishCandidates), so it is always in this complement: the same
    // "sectors never captured" rule as before.
    const captureHidden = LAYER_ORDER.filter((id) => !effectiveChosen.includes(id));

    let restored = false;
    const restoreAll = () => {
      if (restored) return;
      restored = true;
      stageScaleRef.current = prevScale;
      stagePosRef.current = prevPos;
      setStageScale(prevScale);
      setStagePos(prevPos);
      setHiddenLayers(prevHidden); // single restore path — the user's 👁 state, untouched
    };

    // Deselect (no transformer handles baked into the capture), flatten the
    // view to scale 1 / pos 0 — bg.x/y/w/h and every item/line coordinate are
    // logical stage px, unrelated to the pan/zoom view transform — then hide
    // exactly the complement of what was chosen.
    setSelectedId(null);
    setStageScale(1);
    setStagePos({ x: 0, y: 0 });
    stageScaleRef.current = 1;
    stagePosRef.current = { x: 0, y: 0 };
    setHiddenLayers(captureHidden);

    try {
      // rAF alone can suspend forever in occluded/backgrounded tabs — race a
      // timeout so the capture proceeds regardless of compositor state.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 150);
        requestAnimationFrame(() => { clearTimeout(t); resolve(); });
      });

      const stage = stageRef.current;
      if (!stage) throw new Error('Canvas is not ready — please try again.');

      // COMPOSITE — satellite + exactly the chosen layers, cropped to the bg rect.
      const compositeDataUrl = stage.toDataURL({ x: bg.x, y: bg.y, width: bg.w, height: bg.h, pixelRatio: 2 });
      restoreAll(); // snap the working view back immediately — no need to hold it through the network round-trip

      const compositeImg = await loadImageEl(compositeDataUrl);
      const outW = compositeImg.naturalWidth;
      const outH = compositeImg.naturalHeight;

      // Same membership the Stage itself just rendered with — including the
      // force-included 'existing' layer, so the boundary/house/roads are in
      // BOTH the composite and the pixel-lock mask.
      const visItems = items.filter((it) => effectiveChosen.includes(layerForItem(it.layer, it.type)));
      const visLines = lines.filter((l) => effectiveChosen.includes(layerForLine(l.layer, l.kind)));

      const maskDataUrl = buildAiPolishMask(bg, visItems, visLines, outW, outH);

      // Dev-note verification: composite/mask must be pixel-identical in size (bg rect × 2).
      console.log(`[ai-polish] ${label} · composite ${outW}×${outH} · mask ${outW}×${outH} · bg ${bg.w.toFixed(0)}×${bg.h.toFixed(0)} × pixelRatio 2`);

      const elementsText = describePlacedElements(visItems, visLines);
      const siteName = designTitle || bgSite?.name || siteText || '';
      const prompt = buildAiPolishPrompt(elementsText, siteName, label);

      setAiPolish({ phase: 'painting', label });
      const image = await requestRender({
        imageBase64: stripDataUrl(compositeDataUrl),
        maskBase64: stripDataUrl(maskDataUrl),
        provider: 'falgpt',
        context: {},
        touchupPrompt: prompt,
      });
      const rawFinal = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
      const pngFinal = await toPngDataUrl(rawFinal);
      setPolishGallery((prev) => [...prev, { id: `polish-${Date.now()}`, label, image: pngFinal, at: Date.now() }]);
      setAiPolish({ phase: 'done', image: pngFinal, label });
    } catch (e) {
      restoreAll();
      setAiPolish({ phase: 'error', message: e instanceof Error ? e.message : 'AI polish failed — please try again.' });
    }
  }

  // Producer: POST the composited scene to nano banana, get the beautified image.
  // Every map (whole-design hero AND single-layer base maps) is AI-illustrated;
  // mapKind 'base' = paint the land as it is today, 'full' = the design map.
  // retry=true tells the prompt the previous attempt blanked the plot.
  async function requestProducer(
    imageBase64: string, layerLabel: string, elementsText: string,
    mapKind: 'base' | 'full' = 'full', retry = false,
  ): Promise<string> {
    const res = await fetch('/api/image-producer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, layerLabel, elementsText, stylePreset: producerStyle, model: 'pro-preview', mapKind, retry, engine: producerEngine }),
    });
    const data = await res.json().catch(() => ({}));
    // gpt-image-2 (the 'openai' engine) runs via fal's async queue — a
    // successful submit returns {pending, statusUrl, responseUrl} instead of
    // an image, and the actual generation is polled for, same as the
    // existing "Polish" flow's falgpt path (lib/ai-render-client.ts).
    if (res.ok && data.pending && data.statusUrl && data.responseUrl) {
      // Resolves to a data: URL (or a raw fal CDN URL) — either is fine, the
      // composite step's asDataUrl() (lib/image-producer.ts) normalises both
      // that and callGemini's bare-base64 convention the same way. May throw.
      return pollFalRender(data.statusUrl, data.responseUrl);
    }
    if (!res.ok || !data.image) {
      // LOCAL DEV STUB — the Gemini key is prod-only, so on localhost echo the
      // captured composite back as the "model" image. This exercises the whole
      // deterministic pipeline (composite-back + boundary clip + burned labels)
      // so the producer is verifiable in dev without the model. Never fires in prod.
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        // eslint-disable-next-line no-console
        console.warn('[producer] dev stub: API failed, echoing composite —', data.error || res.status);
        return imageBase64;
      }
      throw new Error(data.error || `Producer failed (${res.status})`);
    }
    return data.image as string; // bare base64
  }

  // True labels to burn into a produced map: one clustered callout per element
  // type, positioned in OUTPUT px, clamped inside the frame (so nothing is cropped).
  function producerLabelsFor(layerItems: Item[], layerLines: LineEl[], outW: number, outH: number): ProducerLabel[] {
    if (!bg) return [];
    // Grouped by EFFECTIVE label (custom label if set, else the catalog name) —
    // a renamed "Mango tree" gets its own labelled pill on the produced map too.
    const byType = new Map<string, { icon: string; cxs: number[]; cys: number[] }>();
    for (const it of layerItems) {
      const w = it.wM * pxPerM, h = it.hM * pxPerM;
      const r = (it.rotation * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
      const cx = (it.x + (w / 2) * cos - (h / 2) * sin - bg.x) * 2;
      const cy = (it.y + (w / 2) * sin + (h / 2) * cos - bg.y) * 2;
      const key = effectiveLabel(it);
      const g = byType.get(key) ?? { icon: CATALOG[it.type].icon, cxs: [], cys: [] };
      g.cxs.push(cx); g.cys.push(cy); byType.set(key, g);
    }
    const fs = 26;
    // Lines get labels too — the base map is mostly lines (fence, path, pipe,
    // house outline), and "only the fruit tree got a label" was a real complaint.
    // One label per kind, anchored on the midpoint vertex of the longest line.
    const byKind = new Map<LineKind, { best: LineEl; bestLen: number; count: number }>();
    for (const l of layerLines) {
      if (l.points.length < 4) continue;
      let len = 0;
      for (let i = 2; i + 1 < l.points.length; i += 2) {
        len += Math.hypot(l.points[i] - l.points[i - 2], l.points[i + 1] - l.points[i - 1]);
      }
      const g = byKind.get(l.kind);
      if (!g) byKind.set(l.kind, { best: l, bestLen: len, count: 1 });
      else { g.count++; if (len > g.bestLen) { g.best = l; g.bestLen = len; } }
    }
    const lineGroups = [...byKind.entries()].map(([kind, g]) => {
      const pts = g.best.points;
      const mid = 2 * Math.floor(pts.length / 4); // middle vertex, x-index
      const cx = (pts[mid] - bg.x) * 2;
      const cy = (pts[mid + 1] - bg.y) * 2;
      const L = LINES[kind];
      const text = `${L.icon} ${L.label}${g.count > 1 ? ` ×${g.count}` : ''}`;
      return { cx, cy, text, pw: 28 + text.length * fs * 0.6 };
    });
    const groups = [...byType.entries()].map(([label, g]) => {
      const avgX = g.cxs.reduce((a, b) => a + b, 0) / g.cxs.length;
      const avgY = g.cys.reduce((a, b) => a + b, 0) / g.cys.length;
      // Same fix as labelCallouts: anchor to the REAL instance nearest the
      // average rather than the raw average, which can land on empty ground
      // when a label's items are scattered (e.g. trees at opposite corners).
      let cx = avgX, cy = avgY, bestD = Infinity;
      for (let i = 0; i < g.cxs.length; i++) {
        const d = (g.cxs[i] - avgX) ** 2 + (g.cys[i] - avgY) ** 2;
        if (d < bestD) { bestD = d; cx = g.cxs[i]; cy = g.cys[i]; }
      }
      const count = g.cxs.length;
      const text = `${g.icon} ${label}${count > 1 ? ` ×${count}` : ''}`;
      return { cx, cy, text, pw: 28 + text.length * fs * 0.6 };
    }).concat(lineGroups).sort((a, b) => a.cy - b.cy);
    // Split left/right: a cluster on the left half gets a left-margin pill, one on
    // the right half a right-margin pill — leaders stay short, no pile-up. Distribute
    // vertically per side.
    const gap = fs + 22;
    const out: ProducerLabel[] = [];
    (['left', 'right'] as const).forEach((side) => {
      const col = groups.filter((g) => (g.cx < outW / 2 ? 'left' : 'right') === side).sort((a, b) => a.cy - b.cy);
      let y = 40;
      for (const g of col) {
        const ax = side === 'left'
          ? Math.max(14, g.cx - g.pw - 60)
          : Math.min(outW - g.pw - 14, g.cx + 60);
        const lx = side === 'left' ? ax + g.pw : ax; // leader meets the pill's inner edge
        const ay = Math.max(y, Math.max(40, Math.min(outH - 40, g.cy)));
        y = ay + gap;
        out.push({ cx: g.cx, cy: g.cy, ax, lx, ay, text: g.text });
      }
    });
    return out;
  }

  // Accurate per-layer producer: for EACH chosen layer, render the real design
  // (satellite + that layer's elements + boundary), let nano banana beautify it,
  // then deterministically composite-back (clip to boundary, paint the farmer's
  // exact elements on top) so nothing invented survives. One accurate map per layer.
  async function runProducer(chosen: LayerId[], forceCombined = false) {
    if (!bg || chosen.length === 0 || aiPolishBusy) return;

    const prevScale = stageScaleRef.current;
    const prevPos = stagePosRef.current;
    const prevHidden = hiddenLayers;
    let restored = false;
    const restoreAll = () => {
      if (restored) return;
      restored = true;
      stageScaleRef.current = prevScale; stagePosRef.current = prevPos;
      setStageScale(prevScale); setStagePos(prevPos);
      setCaptureStickerMode(false);
      setCaptureCleanMode(false);
      setHiddenLayers(prevHidden);
    };
    const nextFrame = () => new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 150);
      requestAnimationFrame(() => { clearTimeout(t); resolve(); });
    });
    const crop = { x: bg.x, y: bg.y, width: bg.w, height: bg.h, pixelRatio: 2 };
    const bgRect = { x: bg.x, y: bg.y, w: bg.w, h: bg.h };
    const boundaryPx = washBoundary ? boundaryStageToOutput(washBoundary.points, bgRect, 2) : undefined;

    setSelectedId(null);

    const labelStyle: LabelStyle = PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label ?? 'clean';
    // Selecting the whole design → ONE combined map (all your elements together);
    // selecting a subset → one focused map per layer. forceCombined is set by the
    // primary "Produce full-design map" button so the whole-design case never
    // depends on chosen exactly matching a re-derived candidate list.
    // Sectors are their own map (wedge overlay on the polished land) and are
    // kept OFF the combined hero, which stays clean.
    const combined = (forceCombined && chosen.length > 1) || (producerCandidates.length > 1 && chosen.length === producerCandidates.length);
    const mapName = (l: LayerId) =>
      l === 'existing' ? 'Base map' :
      l === 'sectors' ? 'Sun & wind map' :
      /map$/i.test(LAYERS[l].name) ? LAYERS[l].name : `${LAYERS[l].name} map`;
    const jobs: { layers: LayerId[]; label: string }[] = combined
      ? [
          { layers: chosen.filter((l) => l !== 'sectors'), label: designTitle || bgSite?.name || 'Your design' },
          ...(chosen.includes('sectors') ? [{ layers: ['sectors'] as LayerId[], label: 'Sector map' }] : []),
        ]
      : chosen.map((l) => ({ layers: [l], label: mapName(l) }));

    let lastFinal: string | null = null;
    let lastFinalClean: string | null = null;
    let lastLabel = '';
    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        lastLabel = job.label;
        const counter = jobs.length > 1 ? ` (${i + 1}/${jobs.length})` : '';
        setAiPolish({ phase: 'preparing', label: job.label + counter });

        // A sector map is the wedge overlay ON the polished land: the AI paints
        // the ground from an existing-only capture, and the wedges are captured
        // separately as an exact transparent sticker composited on top — the
        // model never gets a chance to repaint them.
        const isSectorJob = job.layers.length === 1 && job.layers[0] === 'sectors';

        // Show the job's layers + the existing base features (boundary/house/roads),
        // and reset the view so the capture crop aligns exactly with the satellite rect.
        // captureCleanMode strips Stage UI chrome (live label pills, line handles,
        // ✕ delete buttons) from everything the AI sees.
        // 'base' (the satellite photo) is always shown in the capture, regardless
        // of which design layers are chosen — Gemini needs to see the real ground
        // to paint it accurately, and compositeAccurateMap's own fallback (using
        // this same capture as the model image on failure) needs real ground too,
        // not a transparent/black hole. ('base' never hosts any item/line type, so
        // this can't accidentally pull extra elements into the job.)
        const inThisMap = (id: LayerId) => id === 'base' || (isSectorJob ? false : job.layers.includes(id)) || id === 'existing';
        setCaptureCleanMode(true);
        setHiddenLayers(LAYER_ORDER.filter((id) => !inThisMap(id)));
        setStageScale(1); setStagePos({ x: 0, y: 0 });
        stageScaleRef.current = 1; stagePosRef.current = { x: 0, y: 0 };
        await nextFrame();
        const stage = stageRef.current;
        if (!stage) throw new Error('Canvas is not ready — please try again.');

        // Capture the real scene: satellite + this job's element markers + boundary.
        // JPEG, not Konva's default PNG — a busy design's PNG composite can run into
        // MBs; JPEG at high quality is a fraction of that, which meaningfully cuts
        // upload + processing time against Gemini and lowers the odds of tripping
        // Vercel's 60s function ceiling on the model call below.
        const composite = stage.toDataURL({ ...crop, mimeType: 'image/jpeg', quality: 0.9 });
        const outW = Math.round(bg.w * 2);
        const outH = Math.round(bg.h * 2);

        // Sector job: second capture — the wedges alone on transparency (sticker
        // mode hides the satellite/grid/wash), pixel-exact for the overlay.
        let sectorSticker: string | null = null;
        if (isSectorJob) {
          setCaptureStickerMode(true);
          setHiddenLayers(LAYER_ORDER.filter((id) => id !== 'sectors'));
          await nextFrame();
          sectorSticker = stage.toDataURL(crop);
          setCaptureStickerMode(false);
        }

        const visItems = items.filter((it) => inThisMap(layerForItem(it.layer, it.type)));
        const visLines = lines.filter((l) => inThisMap(layerForLine(l.layer, l.kind)));
        const elementsText = describePlacedElements(visItems, visLines);

        // Restore the user's real view immediately after the capture, so the canvas
        // behind the modal keeps showing their design (not a blank reset) while the
        // whole-design AI paints.
        setCaptureCleanMode(false);
        setStageScale(prevScale); setStagePos(prevPos);
        stageScaleRef.current = prevScale; stagePosRef.current = prevPos;
        setHiddenLayers(prevHidden);

        setAiPolish({ phase: 'painting', label: job.label + counter });
        // EVERY map is AI-polished — the whole-design hero AND each single-layer
        // "base map" (mapKind 'base' when the ground is the land as it is today).
        // FAILED-RENDER GUARD: if the model blanked the plot (near-white interior),
        // retry once with an explicit correction; if it blanks again, fall back to
        // the accurate captured photo scene — a blank map can never ship.
        const isBaseJob = job.layers.length === 1 && job.layers[0] === 'existing';
        const kind = isBaseJob || isSectorJob ? 'base' : 'full';
        const compositeB64 = stripDataUrl(composite);
        // THROW GUARD: the initial call itself can fail outright — a network
        // blip, or a 502/504 gateway timeout (Gemini image generation can
        // occasionally exceed Vercel's 60s function ceiling on a busy composite).
        // This used to have no try/catch at all, so any such failure aborted the
        // ENTIRE produce run with an opaque "Producer failed (504)" error — the
        // exact asymmetry the blank-render guard below was built to avoid, just
        // one call earlier. One retry before falling back to the accurate photo.
        let model: string;
        let onForcedFallback = false;
        try {
          model = await requestProducer(compositeB64, job.label, elementsText, kind);
        } catch {
          try {
            model = await requestProducer(compositeB64, job.label, elementsText, kind, true);
          } catch {
            model = compositeB64;
            onForcedFallback = true; // already the real photo — skip the blank-check below
          }
        }
        // Skip when we're already on the forced-photo fallback: estimateBlankFraction
        // is tuned to catch an AI render blanking the plot, not to judge a real photo —
        // pale/sandy real terrain could misfire the heuristic and burn a 3rd API call
        // against an endpoint that has already failed twice for this job, for no gain
        // (the outcome is the same compositeB64 either way).
        if (!onForcedFallback && await estimateBlankFraction(model, outW, outH, boundaryPx) > 0.6) {
          // Retry once with an explicit correction; if the retry ITSELF fails
          // (flaky 502 etc.) fall back rather than aborting the whole produce.
          try {
            model = await requestProducer(compositeB64, job.label, elementsText, kind, true);
          } catch {
            model = compositeB64;
          }
          if (await estimateBlankFraction(model, outW, outH, boundaryPx) > 0.6) {
            model = compositeB64; // accurate satellite scene — never a blank map
          }
        }

        // Composite-back: satellite outside the boundary, the AI-illustrated plot
        // inside, exact sector wedges (if a sector map) overlaid, crisp boundary
        // + TRUE labels on top. Composited TWICE (labelled + clean) — cheap,
        // client-side-only canvas work, no extra API call — so the result can
        // be viewed either way with an instant toggle, never a re-produce.
        const jobLabels = isSectorJob ? [] : producerLabelsFor(visItems, visLines, outW, outH);
        const compositeArgs = {
          modelImage: model,
          satelliteImage: bg.img,
          boundaryPx,
          overlayImage: sectorSticker ?? undefined,
          labelStyle,
          width: outW,
          height: outH,
        };
        const [final, finalClean] = await Promise.all([
          compositeAccurateMap({ ...compositeArgs, labels: jobLabels }),
          compositeAccurateMap({ ...compositeArgs, labels: [] }),
        ]);
        lastFinal = final;
        lastFinalClean = finalClean;
        setPolishGallery((prev) => [...prev, { id: `producer-${i}-${Date.now()}`, label: job.label, image: final, imageClean: finalClean, at: Date.now() }]);
      }
      restoreAll();
      if (lastFinal) setAiPolish({ phase: 'done', image: lastFinal, imageClean: lastFinalClean ?? undefined, label: jobs.length > 1 ? `${jobs.length} maps produced` : lastLabel });
      else setAiPolish({ phase: 'idle' });
      if (jobs.length > 1) setGalleryOpen(true);
    } catch (e) {
      restoreAll();
      setAiPolish({ phase: 'error', message: e instanceof Error ? e.message : 'Producing the map failed — please try again.' });
    }
  }

  function removeGalleryItem(id: string) {
    setPolishGallery((prev) => prev.filter((g) => g.id !== id));
    setGalleryViewId((v) => (v === id ? null : v));
  }

  const grid: number[][] = [];
  if (showGrid) {
    for (let x = 0; x <= size.w; x += pxPerM) grid.push([x, 0, x, size.h]);
    for (let y = 0; y <= size.h; y += pxPerM) grid.push([0, y, size.w, y]);
  }

  // Wash overlay boundary: the traced property boundary (map-truth import
  // writes it as 'mapshape-boundary'), else the longest closed fence line
  // drawn by hand. No closed fence at all → wash falls back to the whole
  // image rect (see the background Layer in the Stage below).
  const closedFences = lines.filter((l) => l.kind === 'fence' && l.closed && l.points.length >= 6);
  const washBoundary = closedFences.length === 0 ? null :
    closedFences.find((l) => l.id === 'mapshape-boundary') ??
    closedFences.reduce((best, l) => (lineLengthM(l.points, l.closed) > lineLengthM(best.points, best.closed) ? l : best));

  const tile = (active: boolean) => ({
    background: active ? 'rgba(31,77,43,0.22)' : '#FBF6EC',
    border: `1px solid ${active ? 'rgba(31,77,43,0.55)' : '#E2D8C4'}`,
    color: active ? '#1F4D2B' : '#5C5040',
  });

  // ── Palette filtering: the active layer surfaces a curated "For this step" set
  // and collapses the rest behind "More elements" — except on base/review, which
  // always show everything (those layers don't define a curated set).
  const activeLayerDef = LAYERS[activeLayer];
  const stepElementTypes = activeLayerDef.elementTypes;
  const stepLineKinds = activeLayerDef.lineKinds;
  const stepSectorKinds = activeLayerDef.sectorKinds ?? [];
  const hasStepFilter = stepElementTypes.length > 0 || stepLineKinds.length > 0 || stepSectorKinds.length > 0;
  const showAllGroups = !hasStepFilter || moreElementsOpen;

  const layerIndex = LAYER_ORDER.indexOf(activeLayer);
  const goPrevLayer = () => setActiveLayer(LAYER_ORDER[Math.max(0, layerIndex - 1)]);
  const goNextLayer = () => setActiveLayer(LAYER_ORDER[Math.min(LAYER_ORDER.length - 1, layerIndex + 1)]);
  // Guided step navigation — keeps activeLayer in sync so placement, coach
  // counts and the palette all agree with the guided step underneath.
  const gotoGuidedStep = (i: number) => {
    const idx = Math.max(0, Math.min(GUIDED_STEPS.length - 1, i));
    setGuidedStep(idx);
    setActiveLayer(GUIDED_STEPS[idx].layer);
    setPlaceType(null); setLineKind(null); setScaleMode(false); setArmedSector(null);
  };

  const toggleLayerVisible = (id: LayerId) =>
    setHiddenLayers((prev) => prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]);

  const galleryViewItem = galleryViewId ? polishGallery.find((g) => g.id === galleryViewId) ?? null : null;

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* ── Palette ── (static column on desktop; slide-in drawer on mobile).
          PRO MODE ONLY — guided mode has its own small tool tray on the canvas. */}
      {uiMode === 'pro' && (
      <div
        className={`flex-shrink-0 overflow-y-auto overflow-x-hidden p-2.5 space-y-3 absolute inset-y-0 left-0 z-30 md:static md:z-auto transition-transform duration-300 md:translate-x-0 ${mobilePanel === 'palette' ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: 150, background: '#F5F0E8', borderRight: '1px solid #E2D8C4' }}
      >
        {/* Base map */}
        <div>
          <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>Base map</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadImage(e.target.files?.[0])} />
          <button
            onClick={() => { try { setSitePlaces(loadPlaces()); } catch { setSitePlaces([]); } setSitePickerOpen((v) => !v); }}
            className="w-full py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5"
            style={{ ...tile(sitePickerOpen), fontWeight: 600 }}
          >
            🛰 From my map sites
          </button>
          {sitePickerOpen && (
            <div className="mt-1.5 space-y-1">
              {sitePlaces.length === 0 && (
                <div className="text-xs font-mono px-1" style={{ color: '#9A8268' }}>No saved places yet — save one on the Farmer map first.</div>
              )}
              {sitePlaces.map((p) => (
                <button
                  key={p.id}
                  onClick={() => !siteLoading && importFromSite(p)}
                  className="w-full py-1.5 px-2 rounded-lg text-xs font-display flex items-center gap-1.5 text-left"
                  style={{ background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#3A352C', opacity: siteLoading && siteLoading !== p.id ? 0.5 : 1 }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: resolveColor(p), flexShrink: 0 }} />
                  <span className="flex-1 truncate">{p.name}</span>
                  {siteLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <span style={{ color: '#1F4D2B' }}>→</span>}
                </button>
              ))}
              <div className="text-[10px] font-mono px-1" style={{ color: '#9A8268' }}>Satellite loads with the scale set automatically.</div>
            </div>
          )}
          {mapImportMsg && (
            <div className="mt-1.5 text-[10px] font-mono px-1.5 py-1 rounded-lg" style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.35)', color: '#1F4D2B' }}>
              {mapImportMsg}
            </div>
          )}
          {backupMsg && (
            <div className="mt-1.5 text-[10px] font-mono px-1.5 py-1 rounded-lg" style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.35)', color: '#1F4D2B' }}>
              {backupMsg}
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} className="w-full py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5 mt-1.5" style={tile(false)}>
            <ImageIcon size={14} /> Import garden map
          </button>
          {/* Photo-AI is only offered on FILE imports, where its one reliable trick —
              scale from parked cars — has no better alternative. Site imports have
              exact scale + map data, and field testing showed photo detection adds
              nothing there (Florence: 0 features on a tree-covered plot). */}
          {bg && !scaleLocked && (
            <button onClick={runDetect} disabled={detecting}
              className="w-full py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5 mt-1.5"
              style={detecting ? { background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#C7BCA6' } : tile(false)}>
              {detecting ? <><Loader2 size={14} className="animate-spin" /> Reading photo…</> : <>✨ Suggest scale from photo</>}
            </button>
          )}
          {detectError && (
            <div className="text-[10px] font-mono px-1 mt-1" style={{ color: '#C0531E' }}>{detectError}</div>
          )}
          <button onClick={() => runFindMapFeatures()} disabled={!siteFrameRef.current || findingFeatures}
            title={!siteFrameRef.current ? 'Import from a map site first' : undefined}
            className="w-full py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5 mt-1.5"
            style={!siteFrameRef.current || findingFeatures ? { background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#C7BCA6' } : tile(false)}>
            {findingFeatures ? <><Loader2 size={14} className="animate-spin" /> Finding…</> : <>🗺 Find map features</>}
          </button>
          {findFeaturesError && (
            <div className="text-[10px] font-mono px-1 mt-1" style={{ color: '#C0531E' }}>{findFeaturesError}</div>
          )}
          {bg && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono" style={{ color: '#9A8268' }}>fade</span>
                <input type="range" min={0.15} max={1} step={0.05} value={bg.opacity}
                  onChange={(e) => setBg((b) => b ? { ...b, opacity: parseFloat(e.target.value) } : b)}
                  className="flex-1 min-w-0" style={{ accentColor: '#1F4D2B', width: '100%' }} />
              </div>
              <button onClick={() => setBg(null)} className="w-full py-1 rounded-lg text-xs font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>remove</button>
            </div>
          )}
          <button onClick={() => { setScaleMode(true); setDraftPt(null); setPlaceType(null); setLineKind(null); setArmedSector(null); setPolyDraft([]); }}
            className="w-full mt-1.5 py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5" style={tile(scaleMode)}>
            <Ruler size={14} /> Set scale
          </button>
          <div className="mt-1.5 space-y-1">
            <span className="text-xs font-mono block" style={{ color: '#9A8268' }}>
              1 m = {pxPerM < 10 ? pxPerM.toFixed(1) : pxPerM.toFixed(0)} px
              {scaleLocked && <span style={{ color: '#1F4D2B' }}> · ✓ from map</span>}
            </span>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setShowGrid((g) => !g)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(showGrid)}>grid</button>
              <button onClick={() => setShowLabels((l) => !l)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(showLabels)}>labels</button>
              <button onClick={() => setWashOn((w) => !w)} title="Dim the satellite so placed elements stand out" className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(washOn)}>wash</button>
              <button onClick={() => setContoursHidden((h) => !h)} title="Show/hide contour lines independently of the Water layer, so you can reference them while placing other elements" className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(!contoursHidden)}>contours</button>
            </div>
          </div>
          <button onClick={startFresh} className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
            Start fresh
          </button>
          {hasBackup && (
            <button onClick={restoreBackedUpDesign} title="Swaps back the design that was here before a site switch or Start fresh"
              className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
              ↺ Restore backed-up design
            </button>
          )}
        </div>

        {/* Rainwater harvest potential — surfaced here too while working the water layer */}
        {activeLayer === 'water' && harvest && (
          <div className="rounded-xl p-2.5 space-y-1" style={{ background: '#FBF6EC', border: '1px solid rgba(47,111,158,0.35)' }}>
            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#2F6F9E' }}>💧 Rainwater potential</div>
            <p className="text-[11px] font-display leading-snug" style={{ color: '#20190F' }}>{harvest.sentence}</p>
            <p className="text-[10px] font-mono" style={{ color: '#9A8268' }}>
              from {Math.round(roofM2)} m² of roof, {harvest.annualMm} mm/yr ({harvest.pattern} rainfall)
            </p>
          </div>
        )}

        {/* ── For this step ── (types/lines/sectors the active layer surfaces first) */}
        {stepElementTypes.length > 0 && (
          <div>
            <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#1F4D2B' }}>For this step</div>
            {activeLayer === 'existing' && (
              <>
                <button onClick={() => runFindMapFeatures()} disabled={!siteFrameRef.current || findingFeatures}
                  title={!siteFrameRef.current ? 'Import from a map site first' : undefined}
                  className="w-full py-1.5 mb-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5"
                  style={!siteFrameRef.current || findingFeatures ? { background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#C7BCA6' } : tile(false)}>
                  {findingFeatures ? <><Loader2 size={14} className="animate-spin" /> Finding…</> : <>🗺 Find map features</>}
                </button>
                {findFeaturesError && (
                  <div className="text-[10px] font-mono px-1 mb-1.5" style={{ color: '#C0531E' }}>{findFeaturesError}</div>
                )}
              </>
            )}
            {activeLayer === 'planting' && (
              <button onClick={() => window.open('/facilitator/crops', '_self')}
                className="w-full py-1.5 mb-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5"
                style={tile(false)}>
                🌱 Crop plan
              </button>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {stepElementTypes.map((type) => (
                <button key={type} onClick={() => { setPlaceType(type); setLineKind(null); setScaleMode(false); setArmedSector(null); setPolyDraft([]); }}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(placeType === type)} title={CATALOG[type].label}>
                  <span style={{ fontSize: 15 }}>{CATALOG[type].icon}</span>
                  <span className="truncate w-full text-center" style={{ fontSize: 9.5 }}>{CATALOG[type].label}</span>
                </button>
              ))}
              {stepLineKinds.map((kind) => (
                <button key={kind} onClick={() => { setLineKind(kind); setPlaceType(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); setPolyDraft([]); }}
                  className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(lineKind === kind)}>
                  <span>{LINES[kind].icon}</span><span style={{ fontSize: 10 }}>{LINES[kind].label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {stepSectorKinds.length > 0 && (
          <div>
            <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#1F4D2B' }}>For this step</div>
            <div className="grid grid-cols-2 gap-1.5">
              {stepSectorKinds.map((kind) => {
                const def = SECTOR_DEFS[kind];
                return (
                  <button key={kind} onClick={() => { setArmedSector(kind); setPlaceType(null); setLineKind(null); setScaleMode(false); setPolyDraft([]); }}
                    className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(armedSector === kind)} title={def.hint}>
                    <span style={{ fontSize: 15 }}>{def.icon}</span>
                    <span className="truncate w-full text-center" style={{ fontSize: 9.5 }}>{def.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* More elements toggle — collapsed by default on layers that define a "for this step" set */}
        {hasStepFilter && (
          <button onClick={() => setMoreElementsOpen((v) => !v)}
            className="w-full text-xs font-mono flex items-center justify-center gap-1" style={{ color: '#9A8268' }}>
            More elements {moreElementsOpen ? '▴' : '▾'}
          </button>
        )}

        {showAllGroups && (
          <>
            {/* Element groups */}
            {GROUPS.map((g) => (
              <div key={g.name}>
                <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>{g.name}</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {g.types.map((type) => (
                    <button key={type} onClick={() => { setPlaceType(type); setLineKind(null); setScaleMode(false); setArmedSector(null); setPolyDraft([]); }}
                      className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(placeType === type)} title={CATALOG[type].label}>
                      <span style={{ fontSize: 15 }}>{CATALOG[type].icon}</span>
                      <span className="truncate w-full text-center" style={{ fontSize: 9.5 }}>{CATALOG[type].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Lines */}
            <div>
              <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>Lines</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(LINES) as LineKind[]).map((kind) => (
                  <button key={kind} onClick={() => { setLineKind(kind); setPlaceType(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); setPolyDraft([]); }}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(lineKind === kind)}>
                    <span>{LINES[kind].icon}</span><span style={{ fontSize: 10 }}>{LINES[kind].label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      )}

      {/* ── Canvas ── */}
      <div ref={wrapRef} className="relative flex-1" style={{ background: '#F7F2E9', minWidth: 0, cursor: armed ? 'crosshair' : panMode ? 'grab' : 'default' }}>
        {/* Fit / re-centre + undo/redo — overlaid top-right, above the stepper bar */}
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1 pointer-events-auto">
          <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)"
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: '#FBF6EC', border: '1px solid #E2D8C4', color: canUndo ? '#1F4D2B' : '#C7BCA6', fontSize: 14 }}>
            ↩
          </button>
          <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)"
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: '#FBF6EC', border: '1px solid #E2D8C4', color: canRedo ? '#1F4D2B' : '#C7BCA6', fontSize: 14 }}>
            ↪
          </button>
          <button onClick={() => setPanTool((v) => !v)} title={panTool ? 'Pan on — tap to edit again' : 'Pan the map (or hold Space, or drag with two fingers)'}
            className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: panMode ? '#1F4D2B' : '#FBF6EC', border: `1px solid ${panMode ? '#1F4D2B' : '#E2D8C4'}`, color: panMode ? '#fff' : '#1F4D2B', fontSize: 13 }}>
            ✋
          </button>
          <button onClick={resetView} title="Re-centre" className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', fontSize: 14 }}>
            ⤢
          </button>
        </div>

        {/* GUIDED header — one step, one question, one next button. */}
        {uiMode === 'guided' && (
          <div className="absolute top-2 left-2 right-36 z-10 rounded-xl pointer-events-auto px-3 py-2"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 2px 8px rgba(31,25,15,0.08)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#9A8268' }}>Step {guidedStep + 1} of {GUIDED_STEPS.length}</span>
              <span className="text-sm font-display font-semibold truncate" style={{ color: '#1F4D2B' }}>
                {GUIDED_STEPS[guidedStep].icon} {GUIDED_STEPS[guidedStep].title}
              </span>
              <span className="flex items-center gap-1 ml-auto flex-shrink-0">
                {GUIDED_STEPS.map((s, i) => (
                  <button key={s.key} onClick={() => gotoGuidedStep(i)} title={s.title}
                    className="rounded-full transition-all"
                    style={{ width: i === guidedStep ? 16 : 7, height: 7, background: i === guidedStep ? '#1F4D2B' : i < guidedStep ? '#5DCF80' : '#D8CDB8' }} />
                ))}
              </span>
            </div>
            <p className="text-[11px] font-display mt-0.5" style={{ color: '#5C5040' }}>{GUIDED_STEPS[guidedStep].instruction}</p>
          </div>
        )}

        {/* Stepper + coach — docked at the top of the canvas (PRO mode) */}
        {uiMode === 'pro' && (
        <div className="absolute top-2 left-2 right-12 z-10 rounded-xl pointer-events-auto"
          style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 2px 8px rgba(31,25,15,0.08)' }}>
          <div className="flex items-center gap-1 px-1.5 py-1 overflow-x-auto">
            <button onClick={goPrevLayer} disabled={layerIndex === 0} className="text-xs font-mono px-1 flex-shrink-0" style={{ color: layerIndex === 0 ? '#C7BCA6' : '#9A8268' }}>‹ Back</button>
            {LAYER_ORDER.map((id) => {
              const def = LAYERS[id];
              const active = id === activeLayer;
              return (
                <button key={id} onClick={() => setActiveLayer(id)}
                  className="relative flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-display transition-all"
                  style={{ background: active ? '#1F4D2B' : '#FFFFFF', color: active ? '#fff' : '#5C5040', border: `1px solid ${active ? '#1F4D2B' : '#E2D8C4'}` }}>
                  <span>{def.icon}</span><span>{def.name}</span>
                  {layerHasContent(id) && (
                    <span className="absolute -top-0.5 -right-0.5 rounded-full" style={{ width: 7, height: 7, background: '#5DCF80', border: '1px solid #FBF6EC' }} />
                  )}
                </button>
              );
            })}
            <button onClick={goNextLayer} disabled={layerIndex === LAYER_ORDER.length - 1} className="text-xs font-mono px-1 flex-shrink-0" style={{ color: layerIndex === LAYER_ORDER.length - 1 ? '#C7BCA6' : '#9A8268' }}>Next ›</button>
            <div className="relative flex-shrink-0 ml-auto flex items-center gap-1">
              <button onClick={() => setLayersMenuOpen((v) => !v)} title="Layers" className="text-xs px-1.5 py-1 rounded-full" style={{ color: '#5C5040' }}>👁</button>
              {layersMenuOpen && (
                <div className="absolute right-0 top-full mt-1 rounded-lg p-1.5 space-y-0.5 z-20" style={{ background: '#FFFFFF', border: '1px solid #E2D8C4', width: 180, boxShadow: '0 4px 16px rgba(31,25,15,0.15)' }}>
                  {LAYER_ORDER.map((id) => {
                    const def = LAYERS[id];
                    const count = (itemsByLayer[id] ?? 0) + (linesByLayer[id] ?? 0) + (id === 'sectors' ? sectors.length : 0);
                    const hidden = hiddenLayers.includes(id);
                    return (
                      <div key={id} className="flex items-center justify-between gap-1.5 px-1 py-0.5 rounded text-xs font-display" style={{ color: '#3A352C' }}>
                        <span className="truncate">{def.icon} {def.name} <span className="font-mono" style={{ color: '#9A8268' }}>({count})</span></span>
                        <button onClick={() => toggleLayerVisible(id)} style={{ color: hidden ? '#C7BCA6' : '#1F4D2B' }}>{hidden ? '🚫' : '👁'}</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="px-2 pb-1 flex items-center gap-2">
            <span className="text-[11px] font-display truncate flex-1" style={{ color: '#5C5040' }}>
              ✨ {coachTip(activeLayer, coachCounts)}
            </span>
            <button onClick={() => { chooseUiMode('guided'); gotoGuidedStep(guidedStep); }}
              title="Back to the simple guided flow"
              className="text-[10px] font-mono flex-shrink-0 px-1.5 py-0.5 rounded-full" style={{ background: '#EDE7DB', color: '#5C5040' }}>
              ✨ Guided
            </button>
          </div>
        </div>
        )}

        {/* N badge — moved below the stepper so it doesn't collide */}
        <div className="absolute top-[70px] left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg pointer-events-none"
          style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
          <span className="text-xs font-mono" style={{ color: '#1F4D2B' }}>N ↑</span>
        </div>

        {armed && !isArmedPolygon && (
          <div className="absolute top-[70px] left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-display"
            style={{ background: '#1F4D2B', color: '#fff' }}>
            {scaleMode ? (draftPt ? 'Tap the end of the known distance' : 'Tap the start of a known distance')
              : lineKind ? (draftPt ? `Tap to end the ${LINES[lineKind].label.toLowerCase()}` : `Tap to start the ${LINES[lineKind].label.toLowerCase()}`)
              : armedSector ? 'Tap on the map to place this sector\'s apex'
              : `Tap on the map to place ${placeType ? CATALOG[placeType].label : ''}`} · Esc to cancel
          </div>
        )}

        {/* Polygon drafting controls (roof/driveway/patio): tap each corner on
            the map, then Finish. Undo removes just the last corner. */}
        {isArmedPolygon && (
          <div className="absolute top-[70px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 pointer-events-auto">
            <div className="px-3 py-1 rounded-full text-xs font-display" style={{ background: '#1F4D2B', color: '#fff' }}>
              {polyDraft.length < 6
                ? `Tap corners of the ${lineKind ? LINES[lineKind].label.toLowerCase() : ''} (${polyDraft.length / 2} so far)`
                : `${polyDraft.length / 2} corners — tap more, or finish`} · Esc to cancel
            </div>
            {polyDraft.length > 0 && (
              <button onClick={undoPolygonVertex} className="px-2 py-1 rounded-full text-xs font-mono" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                ↩ point
              </button>
            )}
            {polyDraft.length >= 6 && (
              <button onClick={finishPolygonDraft} className="px-3 py-1 rounded-full text-xs font-display font-semibold" style={{ background: '#5DCF80', color: '#1F4D2B' }}>
                ✓ Finish shape
              </button>
            )}
            <button onClick={cancelPolygonDraft} className="px-2 py-1 rounded-full text-xs font-mono" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#9A8268' }}>
              ✕
            </button>
          </div>
        )}

        {/* GUIDED tool tray — the step's few tools + one big next button. */}
        {uiMode === 'guided' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(94%,560px)] rounded-2xl p-2.5 pointer-events-auto"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 6px 24px rgba(31,25,15,0.18)' }}>
            {GUIDED_STEPS[guidedStep].key === 'setup' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => { try { setSitePlaces(loadPlaces()); } catch { setSitePlaces([]); } setSitePickerOpen((v) => !v); }}
                    className="py-2 rounded-xl text-xs font-display font-semibold" style={tile(sitePickerOpen)}>
                    🛰 Load my land
                  </button>
                  <button onClick={() => runFindMapFeatures()} disabled={!siteFrameRef.current || findingFeatures}
                    className="py-2 rounded-xl text-xs font-display font-semibold"
                    style={!siteFrameRef.current || findingFeatures ? { background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#C7BCA6' } : tile(false)}>
                    {findingFeatures ? 'Finding…' : '🗺 Find my boundary'}
                  </button>
                </div>
                {sitePickerOpen && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {sitePlaces.length === 0 && (
                      <div className="text-xs font-mono px-1" style={{ color: '#9A8268' }}>No saved places yet — save one on the Farmer map first.</div>
                    )}
                    {sitePlaces.map((p) => (
                      <button key={p.id} onClick={() => !siteLoading && importFromSite(p)}
                        className="w-full py-1.5 px-2 rounded-lg text-xs font-display flex items-center gap-1.5 text-left"
                        style={{ background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#3A352C', opacity: siteLoading && siteLoading !== p.id ? 0.5 : 1 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: resolveColor(p), flexShrink: 0 }} />
                        <span className="flex-1 truncate">{p.name}</span>
                        {siteLoading === p.id ? <Loader2 size={12} className="animate-spin" /> : <span style={{ color: '#1F4D2B' }}>→</span>}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] font-mono text-center" style={{ color: '#9A8268' }}>
                  {bg ? (scaleLocked ? '✓ Photo, boundary and scale are set from the map' : '✓ Photo loaded') : 'Your photo and scale come in automatically.'}
                </p>
              </div>
            )}
            {(GUIDED_STEPS[guidedStep].key === 'here' || GUIDED_STEPS[guidedStep].key === 'add') && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {(GUIDED_STEPS[guidedStep].key === 'here' ? GUIDED_HERE_TYPES : GUIDED_ADD_TYPES).map((type) => (
                  <button key={type} onClick={() => { setPlaceType(type); setLineKind(null); setScaleMode(false); setArmedSector(null); setPolyDraft([]); }}
                    className="flex-shrink-0 flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl text-xs font-display transition-all"
                    style={{ ...tile(placeType === type), minWidth: 62 }}>
                    <span style={{ fontSize: 17 }}>{CATALOG[type].icon}</span>
                    <span style={{ fontSize: 9 }}>{CATALOG[type].label}</span>
                  </button>
                ))}
                {(GUIDED_STEPS[guidedStep].key === 'here' ? GUIDED_HERE_LINES : GUIDED_ADD_LINES).map((kind) => (
                  <button key={kind} onClick={() => { setLineKind(kind); setPlaceType(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); setPolyDraft([]); }}
                    className="flex-shrink-0 flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-xl text-xs font-display transition-all"
                    style={{ ...tile(lineKind === kind), minWidth: 62 }}>
                    <span style={{ fontSize: 17 }}>{LINES[kind].icon}</span>
                    <span style={{ fontSize: 9 }}>{LINES[kind].label}</span>
                  </button>
                ))}
              </div>
            )}
            {GUIDED_STEPS[guidedStep].key === 'plan' && (
              <div className="space-y-1.5">
                {estBudgetTotal > 0 && (
                  <div className="flex items-center justify-between px-1 text-xs font-display" style={{ color: '#20190F' }}>
                    <span>Estimated cost of your plan</span>
                    <span className="font-semibold" style={{ color: '#1F4D2B' }}>{formatZar(estBudgetTotal)}</span>
                  </div>
                )}
                <button onClick={() => openAiPolishPicker('producer')} disabled={!canAiPolish || aiPolishBusy}
                  className="w-full py-2.5 rounded-xl text-sm font-display font-semibold inline-flex items-center justify-center gap-1.5"
                  style={!canAiPolish || aiPolishBusy
                    ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' }
                    : { background: '#1F4D2B', color: '#fff' }}>
                  <Sparkles size={15} /> Make my finished maps
                </button>
                {polishGallery.length > 0 && (
                  <button onClick={() => setGalleryOpen(true)} className="w-full py-1.5 rounded-xl text-xs font-mono" style={tile(false)}>
                    🖼 My maps ({polishGallery.length})
                  </button>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              {guidedStep > 0 && (
                <button onClick={() => gotoGuidedStep(guidedStep - 1)} className="px-3 py-2 rounded-xl text-xs font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                  ‹ Back
                </button>
              )}
              {guidedStep < GUIDED_STEPS.length - 1 && (
                <button onClick={() => gotoGuidedStep(guidedStep + 1)}
                  className="flex-1 py-2 rounded-xl text-sm font-display font-semibold"
                  style={{ background: '#1F4D2B', color: '#fff' }}>
                  Done — next step ›
                </button>
              )}
              <button onClick={() => chooseUiMode('pro')}
                title="The full designer: all layers, sun & wind sectors, every element"
                className="px-2 py-2 rounded-xl text-[10px] font-mono flex-shrink-0" style={{ color: '#9A8268' }}>
                Pro ›
              </button>
            </div>
          </div>
        )}

        {/* AI scale suggestion — just under the stepper; never shown once the scale is map-locked */}
        {scaleSuggestion && !scaleLocked && (
          <div className="absolute top-[70px] left-1/2 -translate-x-1/2 z-10 px-3 py-2 rounded-xl text-xs font-display flex items-center gap-2"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 2px 8px rgba(31,25,15,0.08)', color: '#5C5040' }}>
            <span>✨ AI: this image looks ≈ {scaleSuggestion.metresAcross} m across → 1 m = {scaleSuggestion.pxPerM.toFixed(1)} px</span>
            <button onClick={() => { setPxPerM(scaleSuggestion.pxPerM); setScaleSet(true); setScaleSuggestion(null); }}
              className="px-2 py-0.5 rounded-full font-display font-semibold" style={{ background: '#1F4D2B', color: '#fff' }}>
              Apply
            </button>
            <button onClick={() => setScaleSuggestion(null)}
              className="px-2 py-0.5 rounded-full font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
              Ignore
            </button>
          </div>
        )}

        {/* AI-detect approve bar — bottom-centre while ghosts await review */}
        {ghosts && ghosts.length > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full text-xs font-display flex items-center gap-2 pointer-events-auto"
            style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 2px 8px rgba(31,25,15,0.08)', color: '#5C5040' }}>
            <span>{ghostSource === 'osm' ? `🗺 Map data: ${ghosts.length} feature${ghosts.length > 1 ? 's' : ''} found` : `✨ AI found ${ghosts.length} feature${ghosts.length > 1 ? 's' : ''}`}</span>
            <button onClick={acceptAllGhosts}
              className="px-2.5 py-1 rounded-full font-display font-semibold" style={{ background: '#1F4D2B', color: '#fff' }}>
              ✓ Accept all
            </button>
            <button onClick={() => setGhosts(null)}
              className="px-2.5 py-1 rounded-full font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
              Dismiss
            </button>
          </div>
        )}
        <Stage ref={stageRef} width={size.w} height={size.h}
          scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y}
          draggable={panMode} dragDistance={4}
          onDragMove={(e) => {
            // Konva events BUBBLE — an element's dragmove reaches this Stage
            // handler with e.target = the ELEMENT. Only react to the Stage
            // dragging itself, or the map snaps to wherever the element went.
            if (e.target !== e.target.getStage()) return;
            stagePosRef.current = { x: e.target.x(), y: e.target.y() };
          }}
          onDragEnd={(e) => {
            if (e.target !== e.target.getStage()) return;
            const p = { x: e.target.x(), y: e.target.y() };
            stagePosRef.current = p; setStagePos(p);
          }}
          onClick={onStageClick} onTap={onStageClick}>
          <Layer listening={false}>
            {bg && !captureStickerMode && !hiddenLayers.includes('base') && <KonvaImage image={bg.img} x={bg.x} y={bg.y} width={bg.w} height={bg.h} opacity={bg.opacity} />}
            {!captureStickerMode && grid.map((g, i) => <Line key={i} points={g} stroke="#20190F" strokeWidth={1} opacity={0.08} />)}
            {/* Parchment wash — visibility aid over a dark/busy satellite. Sits above
                the image + grid but below sectors/lines/items (next Layer down). */}
            {washOn && !captureStickerMode && bg && (
              washBoundary ? (
                <>
                  {/* Dim everywhere except the boundary, in one paint via an evenodd
                      fill (outer rect ring + inner boundary ring) — avoids punching a
                      destination-out hole through the satellite image painted above. */}
                  <Shape
                    listening={false}
                    fill="rgba(20,25,18,0.35)"
                    fillRule="evenodd"
                    sceneFunc={(ctx, shape) => {
                      ctx.beginPath();
                      ctx.rect(bg.x, bg.y, bg.w, bg.h);
                      const pts = washBoundary.points;
                      ctx.moveTo(pts[0], pts[1]);
                      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
                      ctx.closePath();
                      ctx.fillStrokeShape(shape);
                    }}
                  />
                  <Line points={washBoundary.points} closed fill="rgba(245,240,232,0.5)" listening={false} />
                </>
              ) : (
                <Rect x={bg.x} y={bg.y} width={bg.w} height={bg.h} fill="rgba(245,240,232,0.4)" listening={false} />
              )
            )}
            {draftPt && <Circle x={draftPt[0]} y={draftPt[1]} radius={5} fill="#5DCF80" />}
          </Layer>
          <Layer>
            {/* sectors */}
            {sectors.filter((s) => !hiddenLayers.includes('sectors')).map((s) => {
              const def = SECTOR_DEFS[s.kind];
              const rM = s.radiusM * pxPerM;
              const apexAngle = -s.spanDeg / 2;
              // Label sits along the wedge's centreline (local +x, before the group's own rotation is applied).
              const labelR = rM * 0.65;
              return (
                <Group key={s.id} x={s.x} y={s.y} rotation={s.rotation} draggable
                  ref={(node) => { if (node) nodeRefs.current[s.id] = node; }}
                  onClick={() => setSelectedId(s.id)} onTap={() => setSelectedId(s.id)}
                  onDragStart={pushHistory}
                  onDragEnd={(e) => setSectors((prev) => prev.map((p) => p.id === s.id ? { ...p, x: e.target.x(), y: e.target.y() } : p))}
                  onTransformStart={pushHistory}
                  onTransformEnd={(e) => { const node = e.target; setSectors((prev) => prev.map((p) => p.id === s.id ? { ...p, rotation: node.rotation() } : p)); }}>
                  <Arc innerRadius={0} outerRadius={rM} angle={s.spanDeg} rotation={apexAngle}
                    fill={def.color} opacity={0.16} stroke={def.color} strokeWidth={1.5} dash={[7, 4]} />
                  <Text text={`${def.icon} ${def.label}`} fontSize={11} fill={def.color}
                    x={labelR - 30} y={-6} width={60} align="center" listening={false} />
                  <Circle radius={5} fill={def.color} stroke="#fff" strokeWidth={1.3} />
                </Group>
              );
            })}
            {/* lines */}
            {lines.filter((l) => !hiddenLayers.includes(layerForLine(l.layer, l.kind)) && !(l.kind === 'contour' && contoursHidden)).map((l) => {
              const L = LINES[l.kind];
              const n = l.points.length;
              const mx = (l.points[0] + l.points[n - 2]) / 2, my = (l.points[1] + l.points[n - 1]) / 2;
              const setPt = (idx: number, x: number, y: number) => setLines((prev) => prev.map((q) => q.id === l.id ? { ...q, points: q.points.map((v, k) => k === idx ? x : k === idx + 1 ? y : v) } : q));
              const deleteLine = () => {
                pushHistory();
                setLines((prev) => prev.filter((q) => q.id !== l.id));
                // Auto-imported map-truth shape (dam/fence/path pulled in from the
                // farmer's traced shapes) — remember this was deleted so the next
                // reload's reimport doesn't silently bring it right back.
                if (l.id.startsWith('mapshape-')) dismissMapshape(l.id);
              };
              return (
                <Group key={l.id}>
                  <Line points={l.points} fill={L.fill} closed={l.closed ?? false} stroke={L.color} strokeWidth={L.width} dash={L.dash} lineCap="round" lineJoin="round" />
                  {/* Edit chrome (endpoint handles + delete pill) never goes into a
                      producer capture — it would be painted into the map. */}
                  {!captureCleanMode && (
                    <>
                      <Circle x={l.points[0]} y={l.points[1]} radius={6} fill={L.color} stroke="#fff" strokeWidth={1.3} draggable onDragStart={pushHistory} onDragMove={(e) => setPt(0, e.target.x(), e.target.y())} />
                      <Circle x={l.points[n - 2]} y={l.points[n - 1]} radius={6} fill={L.color} stroke="#fff" strokeWidth={1.3} draggable onDragStart={pushHistory} onDragMove={(e) => setPt(n - 2, e.target.x(), e.target.y())} />
                      <Group x={mx} y={my} onClick={deleteLine} onTap={deleteLine}>
                        <Circle radius={7} fill="#F7F2E9" stroke="#C0531E" strokeWidth={1.3} /><Text text="✕" fontSize={9} fill="#C0531E" x={-3} y={-4.5} />
                      </Group>
                    </>
                  )}
                </Group>
              );
            })}
            {/* Live polygon draft (roof/driveway/patio being traced): the real
                corners placed so far, a dashed "closing" segment back to the
                first corner so the shape reads before it's finished, and a
                dot on each vertex. Never enters a producer capture. */}
            {isArmedPolygon && polyDraft.length >= 2 && !captureCleanMode && (() => {
              const n = polyDraft.length;
              const closing = n >= 4 ? [polyDraft[n - 2], polyDraft[n - 1], polyDraft[0], polyDraft[1]] : null;
              const style = lineKind ? LINES[lineKind] : null;
              return (
                <Group listening={false}>
                  <Line points={polyDraft} stroke={style?.color ?? '#1F4D2B'} strokeWidth={2.5} lineCap="round" lineJoin="round" />
                  {closing && <Line points={closing} stroke={style?.color ?? '#1F4D2B'} strokeWidth={2} dash={[6, 5]} opacity={0.7} />}
                  {Array.from({ length: n / 2 }, (_, i) => (
                    <Circle key={i} x={polyDraft[i * 2]} y={polyDraft[i * 2 + 1]} radius={i === 0 ? 7 : 5}
                      fill={i === 0 ? '#5DCF80' : (style?.color ?? '#1F4D2B')} stroke="#fff" strokeWidth={1.3} />
                  ))}
                </Group>
              );
            })()}
            {/* items */}
            {items.filter((it) => !hiddenLayers.includes(layerForItem(it.layer, it.type))).map((it) => {
              const c = CATALOG[it.type];
              const w = it.wM * pxPerM, h = it.hM * pxPerM;
              return (
                <Group key={it.id} x={it.x} y={it.y} rotation={it.rotation} draggable
                  ref={(node) => { if (node) nodeRefs.current[it.id] = node; }}
                  onClick={() => setSelectedId(it.id)} onTap={() => setSelectedId(it.id)}
                  onDragStart={pushHistory}
                  onDragEnd={(e) => setItems((prev) => prev.map((p) => p.id === it.id ? { ...p, x: e.target.x(), y: e.target.y() } : p))}
                  onTransformEnd={(e) => bakeTransform(it.id, e.target)}>
                  {/* Invisible hit area — the whole footprint, but never smaller
                      than ~32px so tiny elements at low zoom are still easy to
                      grab. fillEnabled + a real (transparent-alpha) fill keeps it
                      reliably in Konva's hit graph (opacity:0 can be skipped). */}
                  {c.shape === 'rect'
                    ? <Rect x={Math.min(0, (w - 32) / 2)} y={Math.min(0, (h - 32) / 2)}
                        width={Math.max(w, 32)} height={Math.max(h, 32)} fill="rgba(0,0,0,0.01)" />
                    : <Circle x={w / 2} y={h / 2} radius={Math.max(w / 2, 16)} fill="rgba(0,0,0,0.01)" />}
                  <ElementIcon type={it.type} w={w} h={h} />
                </Group>
              );
            })}
            {/* Smart labels — one summary callout per element type, stacked in the
                margin beside the property with a leader line to the group centre,
                instead of a cramped label under every element. */}
            {showLabels && !captureCleanMode && labelCallouts.map((g) => (
              <Group key={`lbl-${g.label}`} listening={false}>
                {/* Leader — light with a soft dark under-stroke so it reads on any
                    background (dark satellite or pale parchment wash). */}
                <Line points={[g.cx, g.cy, g.lx, g.ay]} stroke="#1A140A" strokeWidth={2.4} opacity={0.28} lineCap="round" />
                <Line points={[g.cx, g.cy, g.lx, g.ay]} stroke="#FBF6EC" strokeWidth={1.1} opacity={0.9} dash={[4, 3]} lineCap="round" />
                <Circle x={g.cx} y={g.cy} radius={3} fill="#FBF6EC" stroke="#1F4D2B" strokeWidth={1} />
                <Rect x={g.ax} y={g.ay - g.hh} width={g.pw} height={g.hh * 2} cornerRadius={g.hh}
                  fill="#FBF6EC" stroke="#1F4D2B" strokeWidth={0.8} opacity={0.97}
                  shadowColor="#1A140A" shadowBlur={4} shadowOpacity={0.25} shadowOffsetY={1} />
                <Text text={`${g.icon} ${g.label}${g.count > 1 ? `  ×${g.count}` : ''}`}
                  x={g.ax + g.pad} y={g.ay - g.fs * 0.55} fontSize={g.fs}
                  fill="#20190F" fontStyle="600" fontFamily="sans-serif" />
              </Group>
            ))}
            {/* Transformer: proportional for circles/sectors rotate-only, length-only for beds, free for other rects */}
            <Transformer ref={trRef} rotateEnabled keepRatio={selectedIsCircle}
              enabledAnchors={enabledAnchorsFor(!!selectedSector, selected?.type === 'bed', selectedIsCircle)}
              anchorSize={8} anchorStroke="#1F4D2B" anchorFill="rgba(31,77,43,0.7)"
              borderEnabled={false}
              boundBoxFunc={(o, n) => (n.width < 8 || n.height < 8 ? o : n)} />
          </Layer>
          {/* AI-detect ghosts — non-listening except the accept/dismiss pills, drawn above items */}
          <Layer listening={false}>
            {(ghosts ?? []).map((g) => {
              const GHOST_COLOR = '#22B8CF';
              const firstX = g.pxPoints[0], firstY = g.pxPoints[1];
              const isRing = (g.kind === 'boundary' || g.kind === 'veg_area' || g.kind === 'osm_building' || g.kind === 'osm_water') && g.pxPoints.length >= 6;
              const emoji = g.kind === 'tree' ? '🌳' : g.kind === 'water_tank' ? '🛢' : g.kind === 'pond' ? '💧' : g.kind === 'building' ? '🏠' : '';
              return (
                <Group key={g.id}>
                  {isRing ? (
                    <Line points={g.pxPoints} closed stroke={GHOST_COLOR} strokeWidth={2} dash={[8, 5]} fill="rgba(34,184,207,0.07)" />
                  ) : g.lineKind ? (
                    <Line points={g.pxPoints} stroke={GHOST_COLOR} strokeWidth={2} dash={[8, 5]} />
                  ) : (
                    <>
                      <Circle x={firstX} y={firstY} radius={((g.sizeM ?? 4) / 2) * pxPerM} stroke={GHOST_COLOR} strokeWidth={2} dash={[8, 5]} fill="rgba(34,184,207,0.07)" />
                      {emoji && <Text text={emoji} x={firstX - 9} y={firstY - 10} fontSize={18} listening={false} />}
                    </>
                  )}
                  <Group x={firstX - 24} y={firstY - 24} listening>
                    <Group onClick={() => acceptGhost(g)} onTap={() => acceptGhost(g)}>
                      <Circle radius={9} fill="#1F4D2B" stroke="#fff" strokeWidth={1.3} />
                      <Text text="✓" fontSize={11} fill="#fff" x={-4} y={-5.5} listening={false} />
                    </Group>
                    <Group x={22} onClick={() => dismissGhost(g.id)} onTap={() => dismissGhost(g.id)}>
                      <Circle radius={9} fill="#C0531E" stroke="#fff" strokeWidth={1.3} />
                      <Text text="✕" fontSize={11} fill="#fff" x={-4} y={-5.5} listening={false} />
                    </Group>
                  </Group>
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>

      {/* ── Right panel ── (static column on desktop; slide-in drawer on mobile).
          PRO MODE ONLY — guided mode surfaces cost + produce in its own tray. */}
      {uiMode === 'pro' && (
      <div
        className={`flex-shrink-0 overflow-y-auto absolute inset-y-0 right-0 z-30 md:static md:z-auto transition-transform duration-300 md:translate-x-0 ${mobilePanel === 'props' ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'}`}
        style={{ width: 252, maxWidth: '85vw', background: '#F5F0E8', borderLeft: '1px solid #E2D8C4' }}
      >
        <div className="p-3 space-y-3">
          {/* Properties */}
          {selected ? (
            <div className="rounded-xl p-2.5 space-y-2" style={{ background: '#FBF6EC', border: '1px solid rgba(31,77,43,0.25)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold" style={{ color: '#1F4D2B' }}>{CATALOG[selected.type].icon} {CATALOG[selected.type].label}</span>
                <div className="flex gap-1">
                  <button onClick={duplicateSelected} title="Duplicate" className="text-xs px-1.5 py-0.5 rounded font-mono inline-flex items-center" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}><Copy size={13} /></button>
                  <button onClick={deleteSelected} title="Delete" className="text-xs px-1.5 py-0.5 rounded font-mono inline-flex items-center" style={{ background: 'rgba(192,83,30,0.12)', border: '1px solid rgba(192,83,30,0.35)', color: '#C0531E' }}><X size={13} /></button>
                </div>
              </div>
              <label className="text-xs font-mono block" style={{ color: '#9A8268' }}>
                label on the map
                <input type="text" value={selected.label ?? ''} placeholder={CATALOG[selected.type].label}
                  onChange={(e) => updateSel({ label: e.target.value || undefined })}
                  className="w-full mt-0.5 px-1.5 py-1 rounded font-display text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-mono" style={{ color: '#9A8268' }}>
                  {selectedIsCircle ? 'diameter m' : 'width m'}
                  <input type="number" step={0.1} min={0.2} value={selected.wM.toFixed(1)}
                    onChange={(e) => { const v = Math.max(0.2, parseFloat(e.target.value) || 0.2); updateSel(selectedIsCircle ? { wM: v, hM: v } : { wM: v }); }}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
                {!selectedIsCircle && (
                  <label className="text-xs font-mono" style={{ color: '#9A8268' }}>length m
                    <input type="number" step={0.1} min={0.2} value={selected.hM.toFixed(1)}
                      onChange={(e) => updateSel({ hM: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
                      className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                  </label>
                )}
                {selected.litres !== undefined && (
                  <label className="text-xs font-mono" style={{ color: '#9A8268' }}>litres
                    <input type="number" step={500} min={0} value={selected.litres}
                      onChange={(e) => updateSel({ litres: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                  </label>
                )}
                {selected.type === 'tree' && (
                  <>
                    <label className="text-xs font-mono" style={{ color: '#9A8268' }}>species
                      <input type="text" value={selected.species ?? ''} placeholder="e.g. Mango"
                        onChange={(e) => { const species = e.target.value; updateSel({ species: species || undefined, label: species || undefined }); }}
                        className="w-full mt-0.5 px-1.5 py-1 rounded font-display text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                    </label>
                    <label className="text-xs font-mono" style={{ color: '#9A8268' }}>count
                      <input type="number" step={1} min={1} value={selected.count ?? 1}
                        onChange={(e) => updateSel({ count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                    </label>
                  </>
                )}
                <label className="text-xs font-mono" style={{ color: '#9A8268' }}>rotate °
                  <input type="number" step={5} value={Math.round(selected.rotation)}
                    onChange={(e) => updateSel({ rotation: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
              </div>
              <p className="text-[9px] font-mono" style={{ color: '#9A8268' }}>⌘C / ⌘V to duplicate</p>
            </div>
          ) : selectedSector ? (
            <div className="rounded-xl p-2.5 space-y-2" style={{ background: '#FBF6EC', border: `1px solid ${SECTOR_DEFS[selectedSector.kind].color}66` }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold" style={{ color: SECTOR_DEFS[selectedSector.kind].color }}>
                  {SECTOR_DEFS[selectedSector.kind].icon} {SECTOR_DEFS[selectedSector.kind].label}
                </span>
                <div className="flex gap-1">
                  <button onClick={duplicateSelected} title="Duplicate" className="text-xs px-1.5 py-0.5 rounded font-mono inline-flex items-center" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}><Copy size={13} /></button>
                  <button onClick={deleteSelected} title="Delete" className="text-xs px-1.5 py-0.5 rounded font-mono inline-flex items-center" style={{ background: 'rgba(192,83,30,0.12)', border: '1px solid rgba(192,83,30,0.35)', color: '#C0531E' }}><X size={13} /></button>
                </div>
              </div>
              <p className="text-[11px] font-display" style={{ color: '#9A8268' }}>{SECTOR_DEFS[selectedSector.kind].hint}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-mono" style={{ color: '#9A8268' }}>rotate °
                  <input type="number" step={5} value={Math.round(selectedSector.rotation)}
                    onChange={(e) => updateSelSector({ rotation: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
                <label className="text-xs font-mono" style={{ color: '#9A8268' }}>radius m
                  <input type="number" step={1} min={5} max={200} value={Math.round(selectedSector.radiusM)}
                    onChange={(e) => updateSelSector({ radiusM: Math.min(200, Math.max(5, parseFloat(e.target.value) || 5)) })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
                <label className="text-xs font-mono" style={{ color: '#9A8268' }}>span °
                  <input type="number" step={5} min={10} max={180} value={Math.round(selectedSector.spanDeg)}
                    onChange={(e) => updateSelSector({ spanDeg: Math.min(180, Math.max(10, parseFloat(e.target.value) || 10)) })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
              </div>
              <p className="text-[9px] font-mono" style={{ color: '#9A8268' }}>⌘C / ⌘V to duplicate</p>
            </div>
          ) : (
            <p className="text-xs font-display" style={{ color: '#9A8268' }}>Pick a feature on the left, then tap the map to place it. Tap a placed item to edit it here.</p>
          )}

          {/* Rainwater harvest potential */}
          {harvest && (
            <div className="rounded-xl p-2.5 space-y-1" style={{ background: '#FBF6EC', border: '1px solid rgba(47,111,158,0.35)' }}>
              <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#2F6F9E' }}>💧 Rainwater potential</div>
              <p className="text-[11px] font-display leading-snug" style={{ color: '#20190F' }}>{harvest.sentence}</p>
              <p className="text-[10px] font-mono" style={{ color: '#9A8268' }}>
                from {Math.round(roofM2)} m² of roof, {harvest.annualMm} mm/yr ({harvest.pattern} rainfall)
              </p>
            </div>
          )}

          {/* BOQ — split into what's ALREADY on the land (no cost) and what you're
              adding (costed), so the budget only counts things you'll actually buy.
              Collapsed by default: a gogo laying out a food forest doesn't need cost
              line-items always on screen; a facilitator/funder opens it on demand. */}
          <div>
            <button onClick={toggleBoqOpen} aria-expanded={boqOpen}
              className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-wider mb-1.5 py-1"
              style={{ color: '#9A8268' }}>
              <span className="inline-flex items-center gap-1.5"><ClipboardList size={13} /> Budget / Bill of quantities</span>
              {boqOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {!boqOpen ? (
              <p className="text-[11px] font-display" style={{ color: '#9A8268' }}>Tap to view costed quantities.</p>
            ) : items.length || lines.length ? (
              <div className="space-y-2.5">

                {/* Already on the land — existing features, not a purchase */}
                {(existingItemRows.length > 0 || existingLineRows.length > 0) && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider px-0.5" style={{ color: '#9A8268' }}>🏠 Already on the land</div>
                    {existingItemRows.map((b) => (
                      <div key={`ex-${b.type}`} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: 'rgba(226,216,196,0.35)' }}>
                        <span style={{ color: '#9A8268' }}>{b.icon} {b.label}</span>
                        <span className="font-mono" style={{ color: '#9A8268' }}>×{b.count}{b.areaM2 ? ` · ${b.areaM2.toFixed(0)}m²` : ''}</span>
                      </div>
                    ))}
                    {existingLineRows.map((l) => (
                      <div key={`ex-${l.kind}`} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: 'rgba(226,216,196,0.35)' }}>
                        <span style={{ color: '#9A8268' }}>{l.icon} {l.label}</span>
                        <span className="font-mono" style={{ color: '#9A8268' }}>{l.areaM2 != null ? `${l.areaM2.toFixed(0)} m²` : `~${l.m.toFixed(1)} m`}</span>
                      </div>
                    ))}
                    <p className="text-[9px] font-mono px-0.5" style={{ color: '#B0A288' }}>Existing — not counted in the budget.</p>
                  </div>
                )}

                {/* To add — the design, costed */}
                {(plannedBoq.length > 0 || plannedLineTotals.length > 0) ? (
                  <div className="space-y-1">
                    <div className="text-[10px] font-mono uppercase tracking-wider px-0.5" style={{ color: '#1F4D2B' }}>🌱 To add</div>
                    {plannedBoq.map((b) => {
                      const cost = boqCosts.find((c) => c.type === b.type);
                      return (
                        <div key={b.type} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#FBF6EC' }}
                          title={b.type === 'pond' ? `Estimated at an assumed average depth of ${POND_ASSUMED_DEPTH_M} m — actual capacity depends on the dug profile.` : undefined}>
                          <span style={{ color: '#5C5040' }}>{b.icon} {b.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono" style={{ color: '#20190F' }}>×{b.count}{b.litres ? ` · ${Math.round(b.litres).toLocaleString()}L${b.type === 'pond' ? '*' : ''}` : b.areaM2 ? ` · ${b.areaM2.toFixed(0)}m²` : ''}</span>
                            {cost?.zar != null && <span className="font-mono text-right" style={{ color: '#1F4D2B', minWidth: 62 }}>{formatZar(cost.zar)}</span>}
                          </span>
                        </div>
                      );
                    })}
                    {plannedLineTotals.map((l) => {
                      const cost = lineCosts.find((c) => c.kind === l.kind);
                      return (
                        <div key={l.kind} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#FBF6EC' }}>
                          <span style={{ color: '#2F6F9E' }}>{l.icon} {l.label}</span>
                          <span className="flex items-center gap-2">
                            <span className="font-mono" style={{ color: '#20190F' }}>{l.areaM2 != null ? `${l.areaM2.toFixed(0)} m²` : `~${l.m.toFixed(1)} m`}</span>
                            {cost?.zar != null && <span className="font-mono text-right" style={{ color: '#1F4D2B', minWidth: 62 }}>{formatZar(cost.zar)}</span>}
                          </span>
                        </div>
                      );
                    })}
                    {estBudgetTotal > 0 && (
                      <div className="flex items-center justify-between text-xs font-display px-2 py-1.5 mt-1 rounded-lg font-semibold" style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)' }}>
                        <span style={{ color: '#1F4D2B' }}>Est. budget</span>
                        <span className="font-mono" style={{ color: '#1F4D2B' }}>{formatZar(estBudgetTotal)}</span>
                      </div>
                    )}
                    {estBudgetTotal > 0 && (
                      <p className="text-[9px] font-mono leading-snug px-0.5 pt-0.5" style={{ color: '#9A8268' }}>{DISCLAIMER}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-display" style={{ color: '#9A8268' }}>Nothing to add yet — place tanks, beds, paths and more as you move through the steps.</p>
                )}
              </div>
            ) : <p className="text-xs font-display" style={{ color: '#9A8268' }}>Quantities tally here as you place things.</p>}
          </div>

          {/* WhatsApp budget share */}
          <button onClick={shareBudgetOnWhatsApp} disabled={!boq.length && !lineTotals.length}
            className="w-full py-2 rounded-xl text-xs font-display font-medium transition-all"
            style={!boq.length && !lineTotals.length
              ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' }
              : { background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.4)', color: '#128C50' }}>
            <span className="inline-flex items-center justify-center gap-1.5">📱 Share budget</span>
          </button>

          {(bedArea > 0 || totalLitres > 0) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.2)' }}>
                <div className="text-xs font-mono" style={{ color: '#9A8268' }}>Growing area</div>
                <div className="text-sm font-display font-semibold" style={{ color: '#1F4D2B' }}>{bedArea.toFixed(0)} m²</div>
              </div>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(47,111,158,0.08)', border: '1px solid rgba(47,111,158,0.2)' }}>
                <div className="text-xs font-mono" style={{ color: '#9A8268' }}>Water store</div>
                <div className="text-sm font-display font-semibold" style={{ color: '#2F6F9E' }}>{(totalLitres / 1000).toFixed(1)} kL</div>
              </div>
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex flex-wrap gap-2">
            <button onClick={runReview} disabled={reviewing || !items.length}
              className="flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all"
              style={reviewing || !items.length ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' } : { background: 'rgba(31,77,43,0.14)', border: '1px solid rgba(31,77,43,0.45)', color: '#1F4D2B' }}>
              {reviewing ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="animate-spin" size={14} /> Reviewing…</span> : <span className="flex items-center justify-center gap-1.5"><Sparkles size={14} /> AI review</span>}
            </button>
            <button onClick={() => openAiPolishPicker('producer')} disabled={!canAiPolish || aiPolishBusy}
              className={`py-2 rounded-xl text-xs font-display font-semibold transition-all inline-flex items-center justify-center gap-1.5 ${activeLayer === 'review' ? 'flex-1' : 'px-3'}`}
              style={!canAiPolish || aiPolishBusy ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' } : { background: 'rgba(158,92,8,0.14)', border: '1px solid rgba(158,92,8,0.5)', color: '#9E5C08' }}
              title="Produce an accurate illustrated map per layer — nano banana beautifies the ground, your exact elements and boundary stay pixel-true (nothing invented)">
              {aiPolishBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {activeLayer === 'review' ? '🎨 Produce maps' : 'Produce'}
            </button>
            {polishGallery.length > 0 && (
              <button onClick={() => setGalleryOpen(true)}
                className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5"
                style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}
                title="Polished maps from this session">
                🖼 Polished ({polishGallery.length})
              </button>
            )}
            <button onClick={exportPNG} disabled={!items.length && !lines.length} className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }} title="Export PNG"><Download size={14} /> PNG</button>
            <button onClick={() => window.open('/facilitator/print')} className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }} title="Print plan">🖨 Print plan</button>
            <button onClick={() => window.open('/facilitator/crops', '_self')} className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }} title="Plan your crops">🌱 Crop plan</button>
          </div>

          {/* Save button */}
          <div>
            <input
              type="text"
              value={designTitle}
              onChange={(e) => setDesignTitle(e.target.value)}
              placeholder="Design name…"
              className="w-full mb-1.5 px-2 py-1.5 rounded-lg font-mono text-xs"
              style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }}
            />
            <button
              onClick={handleSave}
              disabled={!items.length && !lines.length}
              className="w-full py-2 rounded-xl text-xs font-display font-medium transition-all"
              style={!items.length && !lines.length
                ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' }
                : { background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.35)', color: '#1F4D2B' }}>
              {savedMsg || <span className="inline-flex items-center justify-center gap-1.5"><Download size={14} /> Save design</span>}
            </button>
            {!savedMsg && (
              <div className="mt-1 text-[10px] font-mono px-0.5" style={{
                color: cloudStatus === 'saved' ? '#1F4D2B'
                  : cloudStatus === 'error' ? '#C0531E'
                  : cloudStatus === 'local-only' ? '#C0531E'
                  : '#9A8268',
              }}>
                {cloudStatus === 'saving' && '↻ Saving to cloud…'}
                {cloudStatus === 'saved' && `✓ Cloud · ${cloudSavedAt ? new Date(cloudSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
                {cloudStatus === 'error' && '⚠ Cloud save failed — kept on this device'}
                {cloudStatus === 'local-only' && '📱 Saved on this device only'}
                {cloudStatus === 'idle' && !designId && '📱 Auto-saved on this device — Save to keep it in your account'}
              </div>
            )}
            <button
              onClick={openMyDesigns}
              className="w-full mt-1.5 py-1.5 rounded-lg text-xs font-display transition-all"
              style={tile(myDesignsOpen)}>
              📂 My designs
            </button>
            {myDesignsOpen && (
              <div className="mt-1.5 rounded-xl p-2 space-y-1" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                {designsLoading && (
                  <div className="text-xs font-display px-2 py-1 flex items-center gap-1.5" style={{ color: '#9A8268' }}>
                    <Loader2 className="animate-spin" size={14} /> Loading…
                  </div>
                )}
                {!designsLoading && myDesignsList && myDesignsList.length === 0 && (
                  <div className="text-xs font-mono px-1 py-1" style={{ color: '#9A8268' }}>No saved designs yet.</div>
                )}
                {!designsLoading && myDesignsList && myDesignsList.map((d) => {
                  const data = (d.data ?? {}) as { items?: unknown[]; lines?: unknown[] };
                  const ts = (d as { updated_at?: { toDate?: () => Date }; created_at?: { toDate?: () => Date } });
                  const when = ts.updated_at?.toDate?.() ?? ts.created_at?.toDate?.();
                  return (
                    <div key={d.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg" style={{ background: d.id === designId ? 'rgba(31,77,43,0.1)' : '#FFFFFF', border: '1px solid #E2D8C4' }}>
                      <button onClick={() => loadDesignRow(d)} className="flex-1 min-w-0 text-left">
                        <div className="text-xs font-display truncate" style={{ color: '#3A352C' }}>{d.title || 'Garden design'}</div>
                        <div className="text-[10px] font-mono" style={{ color: '#9A8268' }}>
                          {when ? when.toLocaleDateString() : '—'} · {(data.items?.length ?? 0)} items · {(data.lines?.length ?? 0)} lines
                        </div>
                      </button>
                      <button onClick={() => deleteDesignRow(d.id)} title="Delete" className="flex-shrink-0 text-xs px-1.5 py-1 rounded font-mono" style={{ background: 'rgba(192,83,30,0.12)', border: '1px solid rgba(192,83,30,0.35)', color: '#C0531E' }}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Share to farmer (supervisor power) */}
          <div className="relative">
            <button onClick={() => { setShareOpen((o) => !o); setSharedTo(null); setShareError(null); }} disabled={!items.length && !lines.length}
              className="w-full py-2 rounded-xl text-xs font-display font-medium transition-all"
              style={{ background: 'rgba(47,111,158,0.14)', border: '1px solid rgba(47,111,158,0.4)', color: '#2F6F9E' }}>
              <span className="inline-flex items-center justify-center gap-1.5"><Share2 size={14} /> Share this design with a farmer</span>
            </button>
            {shareOpen && !sharedTo && !shareError && (
              <div className="mt-1.5 rounded-xl p-2 space-y-1" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                <div className="text-xs font-mono uppercase tracking-wider px-1 mb-1" style={{ color: '#9A8268' }}>
                  {farmersLoading ? 'Loading…' : 'Send to'}
                </div>
                {farmersLoading && (
                  <div className="text-xs font-display px-2 py-1 flex items-center gap-1.5" style={{ color: '#9A8268' }}>
                    <Loader2 className="animate-spin" size={14} /> Fetching farmers…
                  </div>
                )}
                {!farmersLoading && displayFarmers.map((f) => (
                  <button key={f.id}
                    onClick={() => {
                      if (f.profile) { sendDesignToFarmer(f.profile); }
                      else { setShareError('⚠ Demo farmer — nothing sent'); }
                    }}
                    disabled={sharing}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-display transition-all inline-flex items-center gap-1.5"
                    style={{ background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                    {sharing ? <Loader2 className="animate-spin" size={14} /> : <Sprout size={14} />} {f.name}
                  </button>
                ))}
              </div>
            )}
            {sharedTo && (
              <div className="mt-1.5 rounded-xl px-3 py-2 text-xs font-display flex items-center gap-1.5" style={{ background: 'rgba(31,77,43,0.1)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B' }}>
                <Check size={14} /> Sent to {sharedTo} — opens on their phone
              </div>
            )}
            {shareError && (
              <div className="mt-1.5 rounded-xl px-3 py-2 text-xs font-display flex items-center justify-between gap-1.5" style={{ background: 'rgba(192,83,30,0.12)', border: '1px solid rgba(192,83,30,0.4)', color: '#C0531E' }}>
                <span>{shareError}</span>
                <button onClick={() => setShareError(null)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'rgba(192,83,30,0.14)', color: '#C0531E' }}>OK</button>
              </div>
            )}
          </div>

          {review && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(31,77,43,0.04)', border: '1px solid rgba(31,77,43,0.15)' }}>
              {review.split('\n').map((line, i) => {
                if (!line.trim()) return null;
                if (line.startsWith('## ')) return <h4 key={i} className="text-xs font-display font-semibold mt-2 mb-1" style={{ color: '#9E5C08' }}>{line.replace('## ', '')}</h4>;
                if (/^\d+\.|^- |^• /.test(line)) return <div key={i} className="flex gap-1.5 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}><span style={{ color: '#1F4D2B' }}>›</span><span>{line.replace(/^[-•]\s*|^\d+\.\s*/, '').replace(/\*\*/g, '')}</span></div>;
                return <p key={i} className="text-xs font-display leading-relaxed" style={{ color: '#5C5040' }}>{line.replace(/\*\*/g, '')}</p>;
              })}
              {reviewing && <span className="inline-block w-1.5 h-3 rounded-sm animate-pulse" style={{ background: '#1F4D2B' }} />}
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── Mobile: scrim + drawer toggle buttons (hidden on desktop; PRO only) ── */}
      {uiMode === 'pro' && mobilePanel && (
        <div className="md:hidden absolute inset-0 z-20" style={{ background: 'rgba(31,25,15,0.12)' }}
          onClick={() => setMobilePanel(null)} aria-hidden="true" />
      )}
      {uiMode === 'pro' && (
      <div className="md:hidden absolute bottom-4 left-0 right-0 z-40 flex justify-between px-4 pointer-events-none">
        <button onClick={() => setMobilePanel((p) => (p === 'palette' ? null : 'palette'))}
          className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-display font-semibold active:scale-95 transition-transform"
          style={{ background: '#FBF6EC', border: '1px solid rgba(31,77,43,0.5)', color: '#1F4D2B', boxShadow: '0 4px 16px rgba(31,25,15,0.12)' }}>
          {mobilePanel === 'palette' ? <><X size={16} /> Close</> : <><LayoutGrid size={16} /> Elements</>}
        </button>
        <button onClick={() => setMobilePanel((p) => (p === 'props' ? null : 'props'))}
          className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-display font-semibold active:scale-95 transition-transform"
          style={{ background: '#FBF6EC', border: '1px solid rgba(47,111,158,0.5)', color: '#2F6F9E', boxShadow: '0 4px 16px rgba(31,25,15,0.12)' }}>
          {mobilePanel === 'props' ? <><X size={16} /> Close</> : <><ClipboardList size={16} /> Plan</>}
        </button>
      </div>
      )}

      {/* ── Placement prompt: capacity/species capture right when a tank or tree is placed ── */}
      {placementPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,16,10,0.55)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 12px 40px rgba(20,16,10,0.35)' }}>
            <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid #E2D8C4' }}>
              <span className="text-sm font-display font-semibold" style={{ color: '#1F4D2B' }}>
                {placementPrompt.type === 'tank' ? '🛢 Tank size' : '🌳 Tree species'}
              </span>
              <button onClick={() => setPlacementPrompt(null)} className="flex items-center justify-center rounded-lg" style={{ width: 24, height: 24, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
                <X size={13} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {placementPrompt.type === 'tank' && (
                <>
                  <p className="text-[11px] font-mono leading-snug" style={{ color: '#9A8268' }}>What size is this tank? Defaults to 5000 L if skipped.</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TANK_SIZE_OPTIONS_L.map((l) => (
                      <button key={l} onClick={() => { updateSel({ litres: l }); setPlacementPrompt(null); }}
                        className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
                        style={selected?.litres === l ? { background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff' } : { background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                        {l.toLocaleString()} L
                      </button>
                    ))}
                    <button onClick={() => setTankCustomOpen((o) => !o)}
                      className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
                      style={tankCustomOpen ? { background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff' } : { background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                      Custom
                    </button>
                  </div>
                  {tankCustomOpen && (
                    <div className="flex gap-1.5">
                      <input type="number" min={0} step={100} autoFocus value={tankCustomValue}
                        onChange={(e) => setTankCustomValue(e.target.value)}
                        placeholder="litres"
                        className="flex-1 px-2.5 py-1.5 rounded-lg font-mono text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#20190F' }} />
                      <button onClick={() => {
                        const v = Math.max(0, parseInt(tankCustomValue, 10) || 0);
                        if (v > 0) { updateSel({ litres: v }); setPlacementPrompt(null); }
                      }}
                        className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold" style={{ background: '#1F4D2B', border: 'none', color: '#fff' }}>
                        Set
                      </button>
                    </div>
                  )}
                </>
              )}
              {placementPrompt.type === 'tree' && (
                <>
                  <p className="text-[11px] font-mono leading-snug" style={{ color: '#9A8268' }}>What species, and how many?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {TREE_SPECIES_OPTIONS.map((s) => (
                      <button key={s} onClick={() => { setTreeSpecies(s); setTreeCustomOpen(false); }}
                        className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
                        style={treeSpecies === s ? { background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff' } : { background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => { setTreeCustomOpen((o) => !o); setTreeSpecies(''); }}
                      className="px-3 py-1.5 rounded-full text-xs font-mono font-semibold transition-all"
                      style={treeCustomOpen ? { background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#fff' } : { background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                      Other
                    </button>
                  </div>
                  {treeCustomOpen && (
                    <input type="text" autoFocus value={treeSpecies}
                      onChange={(e) => setTreeSpecies(e.target.value)}
                      placeholder="species name"
                      className="w-full px-2.5 py-1.5 rounded-lg font-display text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#20190F' }} />
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono" style={{ color: '#9A8268' }}>how many</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setTreeCount((c) => Math.max(1, c - 1))}
                        className="flex items-center justify-center rounded-lg" style={{ width: 26, height: 26, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-mono font-semibold w-6 text-center" style={{ color: '#20190F' }}>{treeCount}</span>
                      <button onClick={() => setTreeCount((c) => c + 1)}
                        className="flex items-center justify-center rounded-lg" style={{ width: 26, height: 26, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setPlacementPrompt(null)}
                      className="px-3 py-2 rounded-xl text-xs font-mono font-semibold" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
                      Skip
                    </button>
                    <button onClick={() => {
                      const species = treeSpecies.trim();
                      updateSel({ species: species || undefined, count: treeCount, label: species || undefined });
                      setPlacementPrompt(null);
                    }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-mono font-semibold" style={{ background: '#1F4D2B', border: 'none', color: '#fff' }}>
                      <Check size={14} /> Confirm
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── AI polish modal ── */}
      {aiPolish.phase !== 'idle' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,16,10,0.55)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 12px 40px rgba(20,16,10,0.35)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-display font-semibold inline-flex items-center gap-1.5" style={{ color: '#9E5C08' }}>
                  <Sparkles size={15} /> {'mode' in aiPolish && aiPolish.mode === 'polish' ? 'Polish maps' : 'Make my finished maps'}
                </span>
                {!aiPolishBusy && (
                  <button onClick={() => setAiPolish({ phase: 'idle' })} className="flex items-center justify-center rounded-lg" style={{ width: 24, height: 24, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
                    <X size={13} />
                  </button>
                )}
              </div>
              <p className="text-[10px] font-mono mt-1 leading-snug" style={{ color: '#9A8268' }}>
                {aiPolish.phase === 'pick' && 'Choose the maps you would like to create — the app makes them clear and ready to print. Nothing on your design will be moved, added or removed.'}
                {(aiPolish.phase === 'preparing' || aiPolish.phase === 'painting' || aiPolish.phase === 'done') && `${aiPolish.label}`}
                {aiPolish.phase === 'error' && 'Something went wrong — nothing about your layers was changed.'}
              </p>
              {aiPolish.phase === 'pick' && aiPolish.mode === 'producer' && (
                <p className="text-[10px] font-mono mt-1.5 leading-snug" style={{ color: '#9E5C08' }}>
                  🧪 Beta — the AI illustration can vary between tries and sometimes gets a detail wrong. Your exact boundary and labels are always accurate; if the picture itself isn&apos;t right, produce again for another attempt.
                </p>
              )}
            </div>
            <div className="p-4">
              {aiPolish.phase === 'pick' && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    {(aiPolish.mode === 'producer' ? producerCandidates : aiPolishCandidates).map((id) => {
                      const def = LAYERS[id];
                      const count = id === 'sectors' ? sectors.length : (itemsByLayer[id] ?? 0) + (linesByLayer[id] ?? 0);
                      const checked = aiPolish.selected.includes(id);
                      // In the producer, the existing layer IS the base map —
                      // say so, since "base map vs what's there" reads ambiguous.
                      const rowName = aiPolish.mode === 'producer' && id === 'existing'
                        ? "Base map — what's there" : def.name;
                      return (
                        <label key={id}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-display cursor-pointer transition-all"
                          style={{ background: checked ? 'rgba(31,77,43,0.10)' : '#FFFFFF', border: `1px solid ${checked ? 'rgba(31,77,43,0.4)' : '#E2D8C4'}` }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleAiPolishLayer(id)} style={{ accentColor: '#1F4D2B' }} />
                          <span>{def.icon}</span>
                          <span className="flex-1" style={{ color: '#3A352C' }}>{rowName}</span>
                          {count > 0 && <span className="font-mono" style={{ color: '#9A8268' }}>({count})</span>}
                        </label>
                      );
                    })}
                  </div>
                  <button onClick={toggleFullDesignPick}
                    className="w-full py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={tile((aiPolish.mode === 'producer' ? producerCandidates : aiPolishCandidates).length > 0 && aiPolish.selected.length === (aiPolish.mode === 'producer' ? producerCandidates : aiPolishCandidates).length)}>
                    🖼 Full design
                  </button>
                  {aiPolish.mode === 'producer' && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider px-0.5" style={{ color: '#9A8268' }}>Map style</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {PRODUCER_STYLES.map((s) => (
                          <button key={s.key} onClick={() => chooseProducerStyle(s.key)}
                            className="py-1.5 px-2 rounded-lg text-left transition-all"
                            style={tile(producerStyle === s.key)}>
                            <div className="text-xs font-display font-semibold">{s.name}</div>
                            <div className="text-[9px] font-mono" style={{ color: '#9A8268' }}>{s.blurb}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {aiPolish.mode === 'producer' && uiMode === 'pro' && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-mono uppercase tracking-wider px-0.5" style={{ color: '#9A8268' }}>Engine (advanced)</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button onClick={() => chooseProducerEngine('gemini')}
                          className="py-1.5 px-2 rounded-lg text-left transition-all"
                          style={tile(producerEngine === 'gemini')}>
                          <div className="text-xs font-display font-semibold">Gemini Pro Preview</div>
                          <div className="text-[9px] font-mono" style={{ color: '#9A8268' }}>Default — most reliable so far</div>
                        </button>
                        <button onClick={() => chooseProducerEngine('openai')}
                          className="py-1.5 px-2 rounded-lg text-left transition-all"
                          style={tile(producerEngine === 'openai')}>
                          <div className="text-xs font-display font-semibold">ChatGPT</div>
                          <div className="text-[9px] font-mono" style={{ color: '#9A8268' }}>gpt-image-2 — try as an alternative</div>
                        </button>
                      </div>
                    </div>
                  )}
                  {aiPolish.mode === 'producer' && uiMode !== 'pro' && (
                    <p className="text-[10px] font-mono px-0.5" style={{ color: '#9A8268' }}>
                      Close this and switch to Pro mode to also try the ChatGPT engine.
                    </p>
                  )}
                  {aiPolish.mode === 'producer' ? (() => {
                    // Whole-design produce is the DEFAULT and is bulletproof: it
                    // always runs every content layer as ONE map (plus a Sector
                    // map if sectors exist), computed from producerCandidates —
                    // never from checkbox state, so a stray selection can never
                    // collapse it to a single layer.
                    const isSubset = aiPolish.selected.length > 0 && aiPolish.selected.length < producerCandidates.length;
                    return (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => runProducer(producerCandidates, true)}
                          disabled={producerCandidates.length === 0}
                          className="w-full py-2 rounded-xl text-xs font-display font-semibold transition-all inline-flex items-center justify-center gap-1.5"
                          style={producerCandidates.length === 0
                            ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' }
                            : { background: 'rgba(158,92,8,0.14)', border: '1px solid rgba(158,92,8,0.5)', color: '#9E5C08' }}>
                          <Sparkles size={14} /> Produce full-design map
                        </button>
                        {isSubset && (
                          <button
                            onClick={() => runProducer(aiPolish.selected, false)}
                            className="w-full py-1.5 rounded-lg text-[11px] font-mono transition-all"
                            style={{ background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                            or produce {aiPolish.selected.length} checked layer{aiPolish.selected.length > 1 ? 's' : ''} separately
                          </button>
                        )}
                      </div>
                    );
                  })() : (
                    <button
                      onClick={() => runAiPolishWith(aiPolish.selected)}
                      disabled={aiPolish.selected.length === 0}
                      className="w-full py-2 rounded-xl text-xs font-display font-semibold transition-all inline-flex items-center justify-center gap-1.5"
                      style={aiPolish.selected.length === 0
                        ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' }
                        : { background: 'rgba(158,92,8,0.14)', border: '1px solid rgba(158,92,8,0.5)', color: '#9E5C08' }}>
                      <Sparkles size={14} /> Polish
                    </button>
                  )}
                </div>
              )}
              {(aiPolish.phase === 'preparing' || aiPolish.phase === 'painting') && (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <Loader2 className="animate-spin" size={28} style={{ color: '#9E5C08' }} />
                  <p className="text-xs font-display text-center" style={{ color: '#5C5040' }}>
                    {aiPolish.phase === 'preparing' ? `Preparing ${aiPolish.label}…` : `AI is painting ${aiPolish.label} — about a minute…`}
                  </p>
                </div>
              )}
              {aiPolish.phase === 'done' && (() => {
                const displayedImage = showCleanResult && aiPolish.imageClean ? aiPolish.imageClean : aiPolish.image;
                const fileTag = `${(designTitle || 'garden-plan').toLowerCase().replace(/[^a-z0-9.\-]+/g, '_')}-${aiPolish.label.toLowerCase().replace(/[^a-z0-9.\-]+/g, '_')}${showCleanResult ? '-clean' : ''}.png`;
                return (
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displayedImage} alt={`AI-polished ${aiPolish.label}`} className="w-full rounded-xl" style={{ border: '1px solid #E2D8C4' }} />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-display" style={{ color: '#5C5040' }}>{aiPolish.label}</p>
                      {aiPolish.imageClean && (
                        <button onClick={() => { const next = !showCleanResult; setShowCleanResult(next); chooseProducerLabels(!next); }}
                          className="shrink-0 py-1 px-2.5 rounded-lg text-[10px] font-mono transition-all inline-flex items-center gap-1"
                          style={tile(!showCleanResult)}>
                          🏷 {showCleanResult ? 'Show labels' : 'Hide labels'}
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] font-mono" style={{ color: '#9A8268' }}>PNG download only — the Print pack draws its own plan sheets.</p>
                    <div className="flex flex-wrap gap-2">
                      <a href={displayedImage} download={fileTag}
                        className="flex-1 py-2 rounded-xl text-xs font-display font-semibold text-center transition-all inline-flex items-center justify-center gap-1.5"
                        style={{ background: '#1F4D2B', color: '#fff' }}>
                        <Download size={14} /> Download
                      </a>
                      <button onClick={() => openAiPolishPicker('producer')}
                        className="flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all inline-flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(158,92,8,0.14)', border: '1px solid rgba(158,92,8,0.5)', color: '#9E5C08' }}>
                        🖼 Add another map
                      </button>
                      <button onClick={() => setAiPolish({ phase: 'idle' })}
                        className="px-4 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                        <X size={14} /> Close
                      </button>
                    </div>
                  </div>
                );
              })()}
              {aiPolish.phase === 'error' && (
                <div className="space-y-3">
                  <p className="text-xs font-display leading-relaxed" style={{ color: '#C0531E' }}>⚠ {aiPolish.message}</p>
                  <button onClick={() => setAiPolish({ phase: 'idle' })}
                    className="w-full py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center justify-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                    <X size={14} /> Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Polished-maps gallery (session-only) ── */}
      {galleryOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(20,16,10,0.55)' }}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 12px 40px rgba(20,16,10,0.35)' }}>
            <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid #E2D8C4' }}>
              <span className="text-sm font-display font-semibold inline-flex items-center gap-1.5" style={{ color: '#9E5C08' }}>
                🖼 Polished maps ({polishGallery.length})
              </span>
              <button onClick={() => { setGalleryOpen(false); setGalleryViewId(null); }} className="flex items-center justify-center rounded-lg" style={{ width: 24, height: 24, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
                <X size={13} />
              </button>
            </div>
            <div className="p-4">
              {galleryViewItem ? (() => {
                const displayedImage = galleryShowClean && galleryViewItem.imageClean ? galleryViewItem.imageClean : galleryViewItem.image;
                return (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={displayedImage} alt={`Polished ${galleryViewItem.label}`} className="w-full rounded-xl" style={{ border: '1px solid #E2D8C4' }} />
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-display" style={{ color: '#5C5040' }}>{galleryViewItem.label}</p>
                    {galleryViewItem.imageClean && (
                      <button onClick={() => { const next = !galleryShowClean; setGalleryShowClean(next); chooseProducerLabels(!next); }}
                        className="shrink-0 py-1 px-2.5 rounded-lg text-[10px] font-mono transition-all inline-flex items-center gap-1"
                        style={tile(!galleryShowClean)}>
                        🏷 {galleryShowClean ? 'Show labels' : 'Hide labels'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={displayedImage} download={`${galleryViewItem.label.toLowerCase().replace(/[^a-z0-9.\-]+/g, '_')}-ai-polished${galleryShowClean ? '-clean' : ''}.png`}
                      className="flex-1 py-2 rounded-xl text-xs font-display font-semibold text-center transition-all inline-flex items-center justify-center gap-1.5"
                      style={{ background: '#1F4D2B', color: '#fff' }}>
                      <Download size={14} /> Download
                    </a>
                    <button onClick={() => removeGalleryItem(galleryViewItem.id)}
                      className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: 'rgba(192,83,30,0.12)', border: '1px solid rgba(192,83,30,0.35)', color: '#C0531E' }}>
                      🗑 Remove
                    </button>
                    <button onClick={() => setGalleryViewId(null)}
                      className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                      ‹ Back
                    </button>
                  </div>
                </div>
                );
              })() : (
                <div className="space-y-3">
                  {polishGallery.length === 0 ? (
                    <p className="text-xs font-display" style={{ color: '#9A8268' }}>No polished maps yet this session.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {polishGallery.map((g) => (
                        <button key={g.id} onClick={() => setGalleryViewId(g.id)}
                          className="relative rounded-lg overflow-hidden" style={{ border: '1px solid #E2D8C4', aspectRatio: '1 / 1' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.image} alt={g.label} className="w-full h-full object-cover" />
                          <span className="absolute bottom-0 left-0 right-0 text-[9px] font-mono px-1 py-0.5 truncate text-left" style={{ background: 'rgba(20,16,10,0.6)', color: '#fff' }}>{g.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] font-mono" style={{ color: '#9A8268' }}>Session-only — kept until you close the app.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
