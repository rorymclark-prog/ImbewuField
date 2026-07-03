'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Transformer, Group, Arc, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { ImageIcon, Ruler, Copy, X, Loader2, Sparkles, Download, Share2, Sprout, Check, LayoutGrid, ClipboardList } from 'lucide-react';
import { listFarmers, saveDesign, updateDesign, myDesigns, deleteDesign, shareDesign } from '@/lib/db/queries';
import type { Profile, Design } from '@/lib/db/types';
import { loadPlaces, resolveColor, type SavedPlace } from '@/lib/saved-places';
import { designSiteIdFromLocation, loadDesignStudioState, mergeFarmShapesIntoDesignState } from '@/lib/design-studio';
import { readLocalFarmShapes } from '@/lib/map-sync';
import { computeCanvasFrame, fetchImageAsDataUrl, makeMercatorProjector, makeMercatorUnprojector } from '@/lib/design-canvas';
import type { LocationData } from '@/lib/types';
import type { ElType, LineKind, LayerId, SectorKind, SectorEl, GhostFeature, DetectResponse, FacItem, FacLine, FacSector, BgRect } from '@/lib/facilitator-design';
import {
  LAYERS, LAYER_ORDER, SECTOR_DEFS, defaultLayerForType, defaultLayerForLine, layerForPlacement,
  coachTip, type CoachCounts,
  saveFacilitatorState, loadFacilitatorState, clearFacilitatorState,
  buildGhosts,
  DEFAULT_PX_PER_M, geomPxToM, geomMToPx,
} from '@/lib/facilitator-design';

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

const LINES: Record<LineKind, { label: string; icon: string; color: string; dash: number[]; width: number }> = {
  pipe:      { label: 'Pipe',       icon: '〰', color: '#5B9ED4', dash: [9, 5],   width: 3 },
  swale:     { label: 'Swale',      icon: '⌇', color: '#7AAA50', dash: [3, 5],   width: 4 },
  windbreak: { label: 'Windbreak',  icon: '🌿', color: '#3A7A30', dash: [],       width: 8 },
  drip:      { label: 'Drip line',  icon: '·', color: '#4A9ED4', dash: [2, 4],   width: 1.5 },
  contour:   { label: 'Contour',    icon: '~', color: '#B89A60', dash: [6, 4],   width: 2 },
  fence:     { label: 'Fence',      icon: '┃', color: '#C2A878', dash: [],       width: 2.5 },
  path:      { label: 'Path',       icon: '⋯', color: '#C9B896', dash: [],       width: 7 },
  building:  { label: 'Building',   icon: '▢', color: '#5A5448', dash: [],       width: 2.5 },
};

interface Item { id: string; type: ElType; x: number; y: number; wM: number; hM: number; rotation: number; litres?: number; layer?: LayerId }
interface LineEl { id: string; kind: LineKind; points: number[]; closed?: boolean; layer?: LayerId }

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

export default function FacilitatorCanvas({ siteText, language }: { siteText?: string; language?: string }) {
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
  // Mobile: palette + properties are slide-in drawers over a full-screen canvas
  const [mobilePanel, setMobilePanel] = useState<null | 'palette' | 'props'>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  // Refs mirror state so native event handlers always read current values
  const stageScaleRef = useRef(1);
  const stagePosRef = useRef({ x: 0, y: 0 });
  const lastDist = useRef(0);

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
  const [scaleMode, setScaleMode] = useState(false);
  const [draftPt, setDraftPt] = useState<number[] | null>(null);
  const restoredRef = useRef(false);

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
    tr.enabledAnchors(selectedSector ? [] : selectedIsCircle
      ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']);
    tr.getLayer()?.batchDraw();
  }, [selectedId, selectedSector, selectedIsCircle, items, sectors, pxPerM]);

  // Esc cancels any armed tool; Delete/Backspace removes selection; Ctrl/Cmd+Z
  // undoes, Ctrl/Cmd+Shift+Z (and Ctrl+Y) redoes.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPlaceType(null); setLineKind(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); }
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
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, undo, redo]);

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

      const newLines: LineEl[] = [];
      if (boundary) {
        const g = boundary.geometry as { type?: string; coordinates?: unknown };
        const ring = g?.type === 'Polygon' ? (g.coordinates as number[][][])[0] : undefined;
        if (ring && ring.length >= 3) {
          newLines.push({ id: 'mapshape-boundary', kind: 'fence', points: flatten(ring), closed: true, layer: 'existing' });
        }
      }
      waterLayers.forEach((l, i) => {
        const g = l.geometry as { type?: string; coordinates?: unknown };
        const ring = g?.type === 'Polygon' ? (g.coordinates as number[][][])[0] : undefined;
        if (ring && ring.length >= 3) {
          newLines.push({ id: `mapshape-water-${i}`, kind: 'pipe', points: flatten(ring), closed: true, layer: 'existing' });
        }
      });
      near.forEach((l, i) => {
        if (l.layerType === 'property_boundary' || l.layerType === 'water_body') return;
        const g = l.geometry as { type?: string; coordinates?: unknown };
        if (g?.type !== 'LineString') return; // other polygon types are skipped
        const coords = g.coordinates as number[][];
        if (coords.length >= 2) {
          newLines.push({ id: `mapshape-line-${i}`, kind: 'path', points: flatten(coords), layer: 'existing' });
        }
      });

      setLines((prev) => [...prev.filter((l) => !l.id.startsWith('mapshape-')), ...newLines]);

      if (newLines.length > 0) {
        setMapImportMsg(`✓ ${newLines.length} traced shape${newLines.length === 1 ? '' : 's'} imported from your map`);
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

  // Import a saved place's satellite directly (same fit + maths as the Design Studio),
  // and auto-set pxPerM so 1 m on the stage is true to the ground.
  async function importFromSite(p: SavedPlace) {
    try {
      setSiteLoading(p.id);
      await loadSiteBackground({ lat: p.lat, lon: p.lon, name: p.name });
    } catch {
      setSiteLoading(null);
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

      const KIND_TO_LINE: Record<'building' | 'road' | 'water', LineKind> = { building: 'building', road: 'path', water: 'pipe' };
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
    const layer = layerForPlacement(activeLayer, defaultLayerForType(type));
    setItems((prev) => [...prev, { id, type, x: cx - (c.w * pxPerM) / 2, y: cy - (c.h * pxPerM) / 2, wM: c.w, hM: c.h, rotation: 0, litres: c.litres, layer }]);
    setSelectedId(id);
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
    if (g.elType) {
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
    } else if (g.kind === 'veg_area') {
      // Ring → bed footprint from the bounding box.
      const xs = g.pxPoints.filter((_, i) => i % 2 === 0);
      const ys = g.pxPoints.filter((_, i) => i % 2 === 1);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const id = `bed-${Date.now()}-${Math.round(Math.random() * 999)}`;
      setItems((prev) => [...prev, {
        id, type: 'bed', x: minX, y: minY,
        wM: (maxX - minX) / pxPerM, hM: (maxY - minY) / pxPerM, rotation: 0, layer: 'existing',
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

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyZoom(stageScaleRef.current * factor, e.clientX - rect.left, e.clientY - rect.top);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastDist.current > 0 && dist > 0) {
        const rect = el.getBoundingClientRect();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        applyZoom(stageScaleRef.current * (dist / lastDist.current), cx, cy);
      }
      lastDist.current = dist;
    };

    const onTouchEnd = () => { lastDist.current = 0; };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

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
      setDesignId(s.designId ?? null);
      setDesignTitle(s.title ?? '');

      if (s.bgSite) {
        loadSiteBackground(s.bgSite, (freshRect, freshPxPerM) => resolveAndSet(freshRect, freshPxPerM)).catch(() => {
          // Satellite fetch failed — still show geometry rather than an empty canvas.
          resolveAndSet(null, s.pxPerM || DEFAULT_PX_PER_M);
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
        };
        img.src = s.bgDataUrl;
      } else {
        // No background at all.
        resolveAndSet(null, s.pxPerM || DEFAULT_PX_PER_M);
      }
    }
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave — skip until the initial restore above has completed so we
  // never clobber saved state with the empty initial render.
  //
  // METRE-BASED PERSISTENCE (geomVersion 2): the background satellite re-fits to
  // whatever container is on screen at load time, so absolute stage px drift off
  // the image on a different device/window. We persist geometry in metres
  // relative to the bg's top-left corner (using the CURRENT bgRect + pxPerM as
  // the anchor) so load-time can re-derive px against the freshly-fit rect.
  // Runtime state (items/lines/sectors) stays in px throughout — this conversion
  // happens only at the save boundary.
  useEffect(() => {
    if (!restoredRef.current) return;
    const t = setTimeout(() => {
      const bgRect: BgRect | undefined = bg ? { x: bg.x, y: bg.y, w: bg.w, h: bg.h } : undefined;
      const geom = bgRect ? geomPxToM(items, lines, sectors, bgRect, pxPerM) : null;
      saveFacilitatorState({
        version: 1,
        geomVersion: 2,
        items: (geom?.items ?? items) as FacItem[],
        lines: (geom?.lines ?? lines) as FacLine[],
        sectors: (geom?.sectors ?? sectors) as FacSector[],
        pxPerM,
        activeLayer,
        hiddenLayers,
        designId: designId ?? undefined,
        title: designTitle || undefined,
        bgSite: bgSite ?? undefined,
        bgDataUrl: (!bgSite && bgDataUrl && bgDataUrl.length < 1_500_000) ? bgDataUrl : undefined,
        bgRect,
        bgOpacity: bg?.opacity,
        savedAt: Date.now(),
      });
    }, 600);
    return () => clearTimeout(t);
  }, [items, lines, sectors, pxPerM, activeLayer, hiddenLayers, bg, bgSite, bgDataUrl, designId, designTitle]);

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
      },
    };
  }, [designTitle, siteText, bgSite, items, lines, sectors, pxPerM, activeLayer, hiddenLayers, bg]);

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
    if (lineKind) {
      if (!draftPt) { setDraftPt([p.x, p.y]); }
      else {
        pushHistory();
        const layer = layerForPlacement(activeLayer, defaultLayerForLine(lineKind));
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
  const boq = (Object.keys(CATALOG) as ElType[]).map((type) => {
    const list = items.filter((i) => i.type === type); if (!list.length) return null;
    const c = CATALOG[type];
    const areaM2 = list.reduce((s, i) => s + (c.shape === 'circle' ? Math.PI * (i.wM / 2) ** 2 : i.wM * i.hM), 0);
    const litres = type === 'pond'
      ? areaM2 * POND_ASSUMED_DEPTH_M * 1000
      : list.reduce((s, i) => s + (i.litres ?? 0), 0);
    return { type, label: c.label, icon: c.icon, count: list.length, areaM2, litres };
  }).filter(Boolean) as { type: ElType; label: string; icon: string; count: number; areaM2: number; litres: number }[];

  const lineLengthM = (points: number[]) => {
    let d = 0;
    for (let i = 0; i + 3 < points.length; i += 2) d += Math.hypot(points[i + 2] - points[i], points[i + 3] - points[i + 1]);
    return d / pxPerM;
  };

  const lineTotals = (Object.keys(LINES) as LineKind[]).map((kind) => {
    const list = lines.filter((l) => l.kind === kind); if (!list.length) return null;
    const m = list.reduce((s, l) => s + lineLengthM(l.points), 0);
    return { kind, label: LINES[kind].label, icon: LINES[kind].icon, count: list.length, m };
  }).filter(Boolean) as { kind: LineKind; label: string; icon: string; count: number; m: number }[];

  const bedArea = boq.find((b) => b.type === 'bed')?.areaM2 ?? 0;
  const totalLitres = boq.reduce((s, b) => s + b.litres, 0);

  // ── Layer bookkeeping for the stepper + coach ──
  const itemsByLayer: Partial<Record<LayerId, number>> = {};
  items.forEach((it) => {
    const l = it.layer ?? defaultLayerForType(it.type);
    itemsByLayer[l] = (itemsByLayer[l] ?? 0) + 1;
  });
  const linesByLayer: Partial<Record<LayerId, number>> = {};
  lines.forEach((l) => {
    const layer = l.layer ?? defaultLayerForLine(l.kind);
    linesByLayer[layer] = (linesByLayer[layer] ?? 0) + 1;
  });
  const layerHasContent = (id: LayerId): boolean =>
    id === 'base' ? !!bg : (itemsByLayer[id] ?? 0) + (linesByLayer[id] ?? 0) > 0 || (id === 'sectors' && sectors.length > 0);
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
    resetHistory();
    resetView();
  }

  async function runReview() {
    if (!items.length) return;
    setReviewing(true); setReview('');
    const desc = items.map((it) => {
      const c = CATALOG[it.type];
      return `- ${c.label}${it.litres ? ` (${it.litres}L)` : ''} at (${(it.x / pxPerM).toFixed(1)}m east, ${(it.y / pxPerM).toFixed(1)}m south), size ${it.wM.toFixed(1)}×${it.hM.toFixed(1)}m`;
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

  const grid: number[][] = [];
  if (showGrid) {
    for (let x = 0; x <= size.w; x += pxPerM) grid.push([x, 0, x, size.h]);
    for (let y = 0; y <= size.h; y += pxPerM) grid.push([0, y, size.w, y]);
  }

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

  const toggleLayerVisible = (id: LayerId) =>
    setHiddenLayers((prev) => prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]);

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* ── Palette ── (static column on desktop; slide-in drawer on mobile) */}
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
          <button onClick={() => { setScaleMode(true); setDraftPt(null); setPlaceType(null); setLineKind(null); setArmedSector(null); }}
            className="w-full mt-1.5 py-1.5 rounded-lg text-xs font-display transition-all flex items-center justify-center gap-1.5" style={tile(scaleMode)}>
            <Ruler size={14} /> Set scale
          </button>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-mono" style={{ color: '#9A8268' }}>
              1 m = {pxPerM < 10 ? pxPerM.toFixed(1) : pxPerM.toFixed(0)} px
              {scaleLocked && <span style={{ color: '#1F4D2B' }}> · ✓ from map</span>}
            </span>
            <div className="flex gap-1">
              <button onClick={() => setShowGrid((g) => !g)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(showGrid)}>grid</button>
              <button onClick={() => setShowLabels((l) => !l)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(showLabels)}>labels</button>
            </div>
          </div>
          <button onClick={startFresh} className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268' }}>
            Start fresh
          </button>
        </div>

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
            <div className="grid grid-cols-2 gap-1.5">
              {stepElementTypes.map((type) => (
                <button key={type} onClick={() => { setPlaceType(type); setLineKind(null); setScaleMode(false); setArmedSector(null); }}
                  className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(placeType === type)} title={CATALOG[type].label}>
                  <span style={{ fontSize: 15 }}>{CATALOG[type].icon}</span>
                  <span className="truncate w-full text-center" style={{ fontSize: 9.5 }}>{CATALOG[type].label}</span>
                </button>
              ))}
              {stepLineKinds.map((kind) => (
                <button key={kind} onClick={() => { setLineKind(kind); setPlaceType(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); }}
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
                  <button key={kind} onClick={() => { setArmedSector(kind); setPlaceType(null); setLineKind(null); setScaleMode(false); }}
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
                    <button key={type} onClick={() => { setPlaceType(type); setLineKind(null); setScaleMode(false); setArmedSector(null); }}
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
                  <button key={kind} onClick={() => { setLineKind(kind); setPlaceType(null); setScaleMode(false); setDraftPt(null); setArmedSector(null); }}
                    className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(lineKind === kind)}>
                    <span>{LINES[kind].icon}</span><span style={{ fontSize: 10 }}>{LINES[kind].label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Canvas ── */}
      <div ref={wrapRef} className="relative flex-1" style={{ background: '#F7F2E9', minWidth: 0, cursor: armed ? 'crosshair' : 'grab' }}>
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
          <button onClick={resetView} title="Re-centre" className="flex items-center justify-center rounded-lg"
            style={{ width: 28, height: 28, background: '#FBF6EC', border: '1px solid #E2D8C4', color: '#1F4D2B', fontSize: 14 }}>
            ⤢
          </button>
        </div>

        {/* Stepper + coach — docked at the top of the canvas */}
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
            <div className="relative flex-shrink-0 ml-auto">
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
          <div className="px-2 pb-1 text-[11px] font-display truncate" style={{ color: '#5C5040' }}>
            ✨ {coachTip(activeLayer, coachCounts)}
          </div>
        </div>

        {/* N badge — moved below the stepper so it doesn't collide */}
        <div className="absolute top-[70px] left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg pointer-events-none"
          style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
          <span className="text-xs font-mono" style={{ color: '#1F4D2B' }}>N ↑</span>
        </div>

        {armed && (
          <div className="absolute top-[70px] left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-display"
            style={{ background: '#1F4D2B', color: '#fff' }}>
            {scaleMode ? (draftPt ? 'Tap the end of the known distance' : 'Tap the start of a known distance')
              : lineKind ? (draftPt ? `Tap to end the ${LINES[lineKind].label.toLowerCase()}` : `Tap to start the ${LINES[lineKind].label.toLowerCase()}`)
              : armedSector ? 'Tap on the map to place this sector\'s apex'
              : `Tap on the map to place ${placeType ? CATALOG[placeType].label : ''}`} · Esc to cancel
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
          draggable={!armed} dragDistance={5}
          onDragMove={(e) => { stagePosRef.current = { x: e.target.x(), y: e.target.y() }; }}
          onDragEnd={(e) => { const p = { x: e.target.x(), y: e.target.y() }; stagePosRef.current = p; setStagePos(p); }}
          onClick={onStageClick} onTap={onStageClick}>
          <Layer listening={false}>
            {bg && !hiddenLayers.includes('base') && <KonvaImage image={bg.img} x={bg.x} y={bg.y} width={bg.w} height={bg.h} opacity={bg.opacity} />}
            {grid.map((g, i) => <Line key={i} points={g} stroke="#20190F" strokeWidth={1} opacity={0.08} />)}
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
            {lines.filter((l) => !hiddenLayers.includes(l.layer ?? defaultLayerForLine(l.kind))).map((l) => {
              const L = LINES[l.kind];
              const n = l.points.length;
              const mx = (l.points[0] + l.points[n - 2]) / 2, my = (l.points[1] + l.points[n - 1]) / 2;
              const setPt = (idx: number, x: number, y: number) => setLines((prev) => prev.map((q) => q.id === l.id ? { ...q, points: q.points.map((v, k) => k === idx ? x : k === idx + 1 ? y : v) } : q));
              const deleteLine = () => { pushHistory(); setLines((prev) => prev.filter((q) => q.id !== l.id)); };
              return (
                <Group key={l.id}>
                  <Line points={l.points} stroke={L.color} strokeWidth={L.width} dash={L.dash} lineCap="round" closed={l.closed ?? false} />
                  <Circle x={l.points[0]} y={l.points[1]} radius={6} fill={L.color} stroke="#fff" strokeWidth={1.3} draggable onDragStart={pushHistory} onDragMove={(e) => setPt(0, e.target.x(), e.target.y())} />
                  <Circle x={l.points[n - 2]} y={l.points[n - 1]} radius={6} fill={L.color} stroke="#fff" strokeWidth={1.3} draggable onDragStart={pushHistory} onDragMove={(e) => setPt(n - 2, e.target.x(), e.target.y())} />
                  <Group x={mx} y={my} onClick={deleteLine} onTap={deleteLine}>
                    <Circle radius={7} fill="#F7F2E9" stroke="#C0531E" strokeWidth={1.3} /><Text text="✕" fontSize={9} fill="#C0531E" x={-3} y={-4.5} />
                  </Group>
                </Group>
              );
            })}
            {/* items */}
            {items.filter((it) => !hiddenLayers.includes(it.layer ?? defaultLayerForType(it.type))).map((it) => {
              const c = CATALOG[it.type];
              const w = it.wM * pxPerM, h = it.hM * pxPerM;
              return (
                <Group key={it.id} x={it.x} y={it.y} rotation={it.rotation} draggable
                  ref={(node) => { if (node) nodeRefs.current[it.id] = node; }}
                  onClick={() => setSelectedId(it.id)} onTap={() => setSelectedId(it.id)}
                  onDragStart={pushHistory}
                  onDragEnd={(e) => setItems((prev) => prev.map((p) => p.id === it.id ? { ...p, x: e.target.x(), y: e.target.y() } : p))}
                  onTransformEnd={(e) => bakeTransform(it.id, e.target)}>
                  {/* Invisible hit area — makes the whole footprint draggable/clickable without a visible background */}
                  {c.shape === 'rect'
                    ? <Rect width={w} height={h} fill="#000000" opacity={0} />
                    : <Circle x={w / 2} y={h / 2} radius={w / 2} fill="#000000" opacity={0} />}
                  <ElementIcon type={it.type} w={w} h={h} />
                  {showLabels && (
                    <Text text={CATALOG[it.type].label}
                      x={0} y={h + 3} width={w} align="center"
                      fontSize={Math.max(8, Math.min(12, pxPerM * 0.45))}
                      fill="rgba(255,255,255,0.82)" fontFamily="monospace"
                      listening={false} />
                  )}
                </Group>
              );
            })}
            {/* Transformer: proportional for circles/sectors rotate-only, free for rects */}
            <Transformer ref={trRef} rotateEnabled keepRatio={selectedIsCircle}
              enabledAnchors={selectedSector ? [] : selectedIsCircle
                ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
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

      {/* ── Right panel ── (static column on desktop; slide-in drawer on mobile) */}
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
                <label className="text-xs font-mono" style={{ color: '#9A8268' }}>rotate °
                  <input type="number" step={5} value={Math.round(selected.rotation)}
                    onChange={(e) => updateSel({ rotation: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
              </div>
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
            </div>
          ) : (
            <p className="text-xs font-display" style={{ color: '#9A8268' }}>Pick a feature on the left, then tap the map to place it. Tap a placed item to edit it here.</p>
          )}

          {/* BOQ */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#9A8268' }}>Bill of quantities</div>
            {boq.length || lineTotals.length ? (
              <div className="space-y-1">
                {boq.map((b) => (
                  <div key={b.type} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#FBF6EC' }}
                    title={b.type === 'pond' ? `Estimated at an assumed average depth of ${POND_ASSUMED_DEPTH_M} m — actual capacity depends on the dug profile.` : undefined}>
                    <span style={{ color: '#5C5040' }}>{b.icon} {b.label}</span>
                    <span className="font-mono" style={{ color: '#20190F' }}>×{b.count}{b.litres ? ` · ${Math.round(b.litres).toLocaleString()}L${b.type === 'pond' ? '*' : ''}` : b.areaM2 ? ` · ${b.areaM2.toFixed(0)}m²` : ''}</span>
                  </div>
                ))}
                {lineTotals.map((l) => (
                  <div key={l.kind} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: '#FBF6EC' }}>
                    <span style={{ color: '#2F6F9E' }}>{l.icon} {l.label}</span>
                    <span className="font-mono" style={{ color: '#20190F' }}>~{l.m.toFixed(1)} m</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs font-display" style={{ color: '#9A8268' }}>Quantities tally here as you place things.</p>}
          </div>

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
          <div className="flex gap-2">
            <button onClick={runReview} disabled={reviewing || !items.length}
              className="flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all"
              style={reviewing || !items.length ? { background: '#E2D8CB', border: '1px solid #E2D8C4', color: '#9A8268' } : { background: 'rgba(31,77,43,0.14)', border: '1px solid rgba(31,77,43,0.45)', color: '#1F4D2B' }}>
              {reviewing ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="animate-spin" size={14} /> Reviewing…</span> : <span className="flex items-center justify-center gap-1.5"><Sparkles size={14} /> AI review</span>}
            </button>
            <button onClick={exportPNG} disabled={!items.length && !lines.length} className="px-3 py-2 rounded-xl text-xs font-mono transition-all inline-flex items-center gap-1.5" style={{ background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040' }} title="Export PNG"><Download size={14} /> PNG</button>
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

      {/* ── Mobile: scrim + drawer toggle buttons (hidden on desktop) ── */}
      {mobilePanel && (
        <div className="md:hidden absolute inset-0 z-20" style={{ background: 'rgba(31,25,15,0.12)' }}
          onClick={() => setMobilePanel(null)} aria-hidden="true" />
      )}
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
    </div>
  );
}
