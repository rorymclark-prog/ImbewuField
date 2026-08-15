'use client';

// Print-ready plan sheet for a facilitator garden design.
//
// Reads the same localStorage design the facilitator canvas edits
// (imbewu_facilitator_design_v1), and renders it as a static A4-landscape
// multi-page plan pack: page 1 is the full design sheet (title block, plan,
// legend, costed BOQ); it is followed by one page per non-empty design layer
// (water, structures, planting, ...), each showing the same plan with that
// layer's elements full-colour + labelled and every other layer faded to
// grey context (the property-boundary fence stays full-strength everywhere
// as a fixed reference). Screen-only checkboxes let the facilitator choose
// which pages to print (e.g. just the Water map). Pure client-side,
// read-only — never writes back to the design.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  ElType, LineKind, SectorKind, LayerId,
  FacItem, FacLine, FacSector, FacilitatorDesignState,
} from '@/lib/facilitator-design';
import {
  loadFacilitatorState, DEFAULT_PX_PER_M,
  LAYER_ORDER, LAYERS, defaultLayerForType, defaultLayerForLine, AREA_LINE_KINDS,
} from '@/lib/facilitator-design';
import { costForItem, costForLine, costForMeasuredAreaLine, formatZar, isAreaPricedItem, DISCLAIMER } from '@/lib/price-book';
import { describeHarvest } from '@/lib/water-calc';

// ── Copied label/colour tables (kept in sync manually with FacilitatorCanvas.tsx) ──

interface Cat { label: string; icon: string; shape: 'rect' | 'circle'; w: number; h: number; fill: string }

const CATALOG: Record<ElType, Cat> = {
  tank:       { label: 'JoJo tank',    icon: '🛢',  shape: 'circle', w: 1.8, h: 1.8, fill: '#3E7BB0' },
  pond:       { label: 'Pond / dam',   icon: '💧',  shape: 'circle', w: 6,   h: 6,   fill: '#2F6586' },
  well:       { label: 'Well / bore',  icon: '⛲',  shape: 'circle', w: 1.2, h: 1.2, fill: '#3A3030' },
  reedbed:    { label: 'Reed bed',     icon: '🌾',  shape: 'rect',   w: 3,   h: 2,   fill: '#4A6A30' },
  bed:        { label: 'Veg bed',      icon: '🥬',  shape: 'rect',   w: 1,   h: 3,   fill: '#3F7A3C' },
  hugel:      { label: 'Hugelkultur',  icon: '🪵',  shape: 'rect',   w: 2,   h: 5,   fill: '#6B4C2A' },
  banana:     { label: 'Banana circle',icon: '🍌',  shape: 'circle', w: 3,   h: 3,   fill: '#2A5A1A' },
  tree:       { label: 'Fruit tree',   icon: '🌳',  shape: 'circle', w: 4,   h: 4,   fill: '#2C5E33' },
  foodforest: { label: 'Food forest',  icon: '🌲',  shape: 'circle', w: 8,   h: 8,   fill: '#1A3A18' },
  herb:       { label: 'Herb spiral',  icon: '🌀',  shape: 'circle', w: 2,   h: 2,   fill: '#6E8B3D' },
  shrub:      { label: 'Shrub',        icon: '🪴',  shape: 'circle', w: 1.5, h: 1.5, fill: '#4E8B4A' },
  coop:       { label: 'Chicken coop', icon: '🐔',  shape: 'rect',   w: 2,   h: 3,   fill: '#9A6A34' },
  compost:    { label: 'Compost',      icon: '♻',   shape: 'rect',   w: 1.5, h: 1.5, fill: '#5E4E32' },
  greenhouse: { label: 'Greenhouse',   icon: '🏡',  shape: 'rect',   w: 4,   h: 8,   fill: '#6B8A9A' },
  tunnel:     { label: 'Polytunnel',   icon: '⛺',  shape: 'rect',   w: 3,   h: 6,   fill: '#5E86A8' },
  shed:       { label: 'Shed',         icon: '🏚',  shape: 'rect',   w: 2.5, h: 3,   fill: '#6E6757' },
  beehive:    { label: 'Beehive',      icon: '🐝',  shape: 'circle', w: 1,   h: 1,   fill: '#8A5A14' },
  biogas:     { label: 'Biogas',       icon: '⚗',   shape: 'circle', w: 2,   h: 2,   fill: '#5A4A7A' },
  nursery:    { label: 'Nursery',      icon: '🌱',  shape: 'rect',   w: 3,   h: 4,   fill: '#3A5E30' },
  swalew:     { label: 'Swale (berm)', icon: '〰',  shape: 'rect',   w: 8,   h: 1.5, fill: '#3A5A2A' },
  firebreak:  { label: 'Firebreak',    icon: '🔥',  shape: 'rect',   w: 10,  h: 2,   fill: '#8A6040' },
};

const LINES: Record<LineKind, { label: string; icon: string; color: string; dash: number[]; width: number }> = {
  pipe:      { label: 'Pipe',       icon: '〰', color: '#5B9ED4', dash: [9, 5], width: 3 },
  swale:     { label: 'Swale',      icon: '⌇', color: '#7AAA50', dash: [3, 5], width: 4 },
  windbreak: { label: 'Windbreak',  icon: '🌿', color: '#3A7A30', dash: [],     width: 8 },
  drip:      { label: 'Drip line',  icon: '·', color: '#4A9ED4', dash: [2, 4], width: 1.5 },
  contour:   { label: 'Contour',    icon: '~', color: '#B89A60', dash: [6, 4], width: 2 },
  fence:     { label: 'Fence',      icon: '┃', color: '#C2A878', dash: [],     width: 2.5 },
  path:      { label: 'Path',       icon: '⋯', color: '#C9B896', dash: [],     width: 7 },
  building:  { label: 'Building',   icon: '▢', color: '#5A5448', dash: [],     width: 2.5 },
  driveway:  { label: 'Driveway',   icon: '🚗', color: '#8A7F6B', dash: [],     width: 2.5 },
  patio:     { label: 'Patio',      icon: '▦', color: '#B08A5A', dash: [],     width: 2.5 },
  waterbody: { label: 'Dam / pond', icon: '🌊', color: '#3E7BB0', dash: [],     width: 2.5 },
};

const SECTOR_LABELS: Record<SectorKind, { label: string; icon: string; color: string }> = {
  sun_winter: { label: 'Winter sun',  icon: '🌤', color: '#E0A020' },
  sun_summer: { label: 'Summer sun',  icon: '☀️', color: '#E8C43A' },
  wind:       { label: 'Wind',        icon: '💨', color: '#6A9AC0' },
  fire:       { label: 'Fire danger', icon: '🔥', color: '#C0531E' },
  water_flow: { label: 'Water flow',  icon: '🌊', color: '#3E7BB0' },
  view:       { label: 'View',        icon: '👁', color: '#8A8070' },
};

const ROOF_TYPES: ElType[] = ['shed', 'greenhouse', 'tunnel', 'coop'];

// ── Layer resolution ─────────────────────────────────────────────────────
//
// An item/line carries an explicit `layer` field once placed via the
// facilitator canvas (stamped at creation time by layerForPlacement there).
// Older/imported geometry may lack it, so we fall back to the element
// type's canonical home layer — the exact rule FacilitatorCanvas itself
// uses. Sectors have no `layer` field at all: every sector kind lives on
// the single 'sectors' layer.

function resolveItemLayer(it: FacItem): LayerId {
  return it.layer ?? defaultLayerForType(it.type);
}
function resolveLineLayer(l: FacLine): LayerId {
  return l.layer ?? defaultLayerForLine(l.kind);
}
function resolveSectorLayer(): LayerId {
  return 'sectors';
}
/** The property-boundary fence (see FacilitatorCanvas) is always shown full-strength as a reference frame, even on other layers' pages. */
function isBoundaryLine(l: FacLine): boolean {
  return l.id === 'mapshape-boundary';
}

// ── Geometry helpers ────────────────────────────────────────────────────────

interface Pt { x: number; y: number }

/** Item's metre-space position, falling back to px÷pxPerM when metre fields are absent. */
function itemM(it: FacItem, pxPerM: number): Pt {
  if (typeof it.xM === 'number' && typeof it.yM === 'number') return { x: it.xM, y: it.yM };
  return { x: it.x / pxPerM, y: it.y / pxPerM };
}

/** Line's metre-space point list, falling back to px÷pxPerM when pointsM is absent. */
function lineM(l: FacLine, pxPerM: number): number[] {
  if (l.pointsM && l.pointsM.length >= 4) return l.pointsM;
  return l.points.map((v) => v / pxPerM);
}

function sectorM(s: FacSector, pxPerM: number): Pt {
  if (typeof s.xM === 'number' && typeof s.yM === 'number') return { x: s.xM, y: s.yM };
  return { x: s.x / pxPerM, y: s.y / pxPerM };
}

function flatToPts(flat: number[]): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}

/** Shoelace formula — absolute area in m² of a closed ring given metre points. */
function shoelaceArea(pts: Pt[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function polylineLengthM(pts: Pt[], closed: boolean): number {
  if (pts.length < 2) return 0;
  let len = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  if (closed) len += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
  return len;
}

/** Round a target metre span down to a "nice" scale-bar length. */
function niceScaleLength(plotWidthM: number): number {
  const candidates = [5, 10, 20, 50, 100, 200, 500];
  const target = plotWidthM / 4;
  let best = candidates[0];
  for (const c of candidates) {
    if (c <= target) best = c;
  }
  return best;
}

interface BoqRow { label: string; icon: string; qty: string; zar: number | null; basis?: string }

interface GridLine { x1: number; y1: number; x2: number; y2: number }

// ── Plan SVG (shared by the full-design page and every layer page) ─────────

interface PlanSvgProps {
  itemPts: { it: FacItem; p: Pt }[];
  linePts: { l: FacLine; pts: Pt[] }[];
  sectorPts: { s: FacSector; p: Pt }[];
  toDraw: (p: Pt) => Pt;
  scale: number;
  pxPerM: number;
  drawW: number;
  drawH: number;
  scaleBarM: number;
  gridLines: GridLine[];
  /** Omit for the full-design page (everything full-colour). Set to a LayerId to fade every other layer to grey context. */
  highlightLayer?: LayerId;
}

const CONTEXT_GREY = '#B4ADA0';
const CONTEXT_OPACITY = 0.25;

function PlanSvg({ itemPts, linePts, sectorPts, toDraw, scale, pxPerM, drawW, drawH, scaleBarM, gridLines, highlightLayer }: PlanSvgProps) {
  const scaleBarPx = scaleBarM * scale;
  const isContext = (layer: LayerId) => highlightLayer !== undefined && layer !== highlightLayer;

  return (
    <svg width="240mm" height="160mm" viewBox={`0 0 ${drawW} ${drawH}`} style={{ border: '1px solid #C7BCA6', background: '#FBF9F4' }}>
      {/* grid */}
      {gridLines.map((g, i) => (
        <line key={`grid-${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#E2D8C4" strokeWidth={0.2} />
      ))}

      {/* lines */}
      {linePts.map(({ l, pts }, i) => {
        if (pts.length < 2) return null;
        const L = LINES[l.kind];
        const boundary = isBoundaryLine(l);
        const context = !boundary && isContext(resolveLineLayer(l));
        const strokeColor = context ? CONTEXT_GREY : L.color;
        const draw = pts.map((p) => toDraw(p));
        const pointsAttr = draw.map((p) => `${p.x},${p.y}`).join(' ');
        if (l.closed) {
          const isBuilding = l.kind === 'building';
          return (
            <polygon
              key={l.id ?? i}
              points={pointsAttr}
              fill={isBuilding ? (context ? CONTEXT_GREY : '#5A5448') : 'none'}
              fillOpacity={isBuilding ? (context ? CONTEXT_OPACITY : 0.2) : 0}
              stroke={strokeColor}
              strokeOpacity={context ? CONTEXT_OPACITY : 1}
              strokeWidth={Math.max(L.width * (scale / pxPerM) * pxPerM * 0.15, 0.6)}
              strokeDasharray={L.dash.join(',')}
            />
          );
        }
        return (
          <polyline
            key={l.id ?? i}
            points={pointsAttr}
            fill="none"
            stroke={strokeColor}
            strokeOpacity={context ? CONTEXT_OPACITY : 1}
            strokeWidth={Math.max(L.width * 0.3, 0.6)}
            strokeDasharray={L.dash.join(',')}
            strokeLinecap="round"
          />
        );
      })}

      {/* sectors (translucent wedges) */}
      {sectorPts.map(({ s, p }, i) => {
        const def = SECTOR_LABELS[s.kind];
        const context = isContext(resolveSectorLayer());
        const center = toDraw(p);
        const r = s.radiusM * scale;
        const a0 = (s.rotation - s.spanDeg / 2) * (Math.PI / 180);
        const a1 = (s.rotation + s.spanDeg / 2) * (Math.PI / 180);
        const x0 = center.x + r * Math.cos(a0);
        const y0 = center.y + r * Math.sin(a0);
        const x1 = center.x + r * Math.cos(a1);
        const y1 = center.y + r * Math.sin(a1);
        const large = s.spanDeg > 180 ? 1 : 0;
        const color = context ? CONTEXT_GREY : def.color;
        return (
          <path
            key={`sector-${i}`}
            d={`M ${center.x} ${center.y} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
            fill={color}
            fillOpacity={context ? CONTEXT_OPACITY * 0.6 : 0.14}
            stroke={color}
            strokeOpacity={context ? CONTEXT_OPACITY : 0.4}
            strokeWidth={0.5}
          />
        );
      })}

      {/* items */}
      {itemPts.map(({ it, p }, i) => {
        const cat = CATALOG[it.type];
        const context = isContext(resolveItemLayer(it));
        const center = toDraw(p);
        const w = (it.wM || cat.w) * scale;
        const h = (it.hM || cat.h) * scale;
        const showLabel = !context && Math.max(w, h) > 8;
        const fillColor = context ? CONTEXT_GREY : cat.fill;
        return (
          <g key={it.id ?? i} transform={`rotate(${it.rotation || 0} ${center.x} ${center.y})`}>
            {cat.shape === 'circle' ? (
              <ellipse cx={center.x} cy={center.y} rx={w / 2} ry={h / 2} fill={fillColor} fillOpacity={context ? CONTEXT_OPACITY : 0.75} stroke={context ? CONTEXT_GREY : '#161311'} strokeWidth={0.3} />
            ) : (
              <rect x={center.x - w / 2} y={center.y - h / 2} width={w} height={h} fill={fillColor} fillOpacity={context ? CONTEXT_OPACITY : 0.75} stroke={context ? CONTEXT_GREY : '#161311'} strokeWidth={0.3} />
            )}
            {!context && (
              <text x={center.x} y={center.y + 2} fontSize={Math.min(6, Math.max(w, h) * 0.5)} textAnchor="middle" fill="#fff">{cat.icon}</text>
            )}
            {showLabel && (
              <text x={center.x} y={center.y + h / 2 + 4} fontSize={3} textAnchor="middle" fill="#161311">{cat.label}</text>
            )}
          </g>
        );
      })}

      {/* north arrow */}
      <g transform={`translate(${drawW - 18}, 14)`}>
        <line x1={0} y1={10} x2={0} y2={-6} stroke="#161311" strokeWidth={1} />
        <polygon points="0,-9 -3,-2 3,-2" fill="#161311" />
        <text x={0} y={19} fontSize={6} textAnchor="middle" fill="#161311" fontWeight="bold">N ↑</text>
      </g>

      {/* scale bar */}
      <g transform={`translate(10, ${drawH - 8})`}>
        <line x1={0} y1={0} x2={scaleBarPx} y2={0} stroke="#161311" strokeWidth={1.5} />
        <line x1={0} y1={-2} x2={0} y2={2} stroke="#161311" strokeWidth={1} />
        <line x1={scaleBarPx} y1={-2} x2={scaleBarPx} y2={2} stroke="#161311" strokeWidth={1} />
        <text x={scaleBarPx / 2} y={-4} fontSize={4.5} textAnchor="middle" fill="#161311">{scaleBarM} m</text>
      </g>
    </svg>
  );
}

// ── Page shell (shared A4-landscape sheet chrome) ───────────────────────────

const SHEET_STYLE: CSSProperties = {
  width: '297mm',
  minHeight: '210mm',
  margin: '16px auto',
  background: '#fff',
  color: '#161311',
  fontFamily: 'Georgia, "Times New Roman", serif',
  padding: '12mm 14mm',
  boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
  boxSizing: 'border-box',
};

type PageKey = 'full' | LayerId;

export default function FacilitatorPrintPage() {
  const [state, setState] = useState<FacilitatorDesignState | null | undefined>(undefined);
  const [enabledPages, setEnabledPages] = useState<Partial<Record<PageKey, boolean>>>({});
  // This route survives specifically for old bookmarks (see app/facilitator/page.tsx) — and a
  // page whose whole purpose is "reopen this to print" is exactly the kind a facilitator adds to
  // their home screen. window.print() is a silent no-op there (manifest display: "standalone"; the
  // same bug already fixed for the Site Analysis Report, the crop plan and the garden survey — see
  // lib/report-pdf.ts, lib/crop-export-pdf.ts, lib/survey-pdf.ts). This page is live HTML/CSS, not
  // a generated file, so the fix here is not "build a PDF" — it is "say so" instead of doing
  // nothing, and point at the one route that does work: this same URL, opened in a real browser.
  const [standalone, setStandalone] = useState(false);
  const [showPrintHint, setShowPrintHint] = useState(false);
  useEffect(() => {
    // After mount only — matchMedia and navigator.standalone do not exist during SSR.
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setStandalone(iosStandalone || window.matchMedia('(display-mode: standalone)').matches);
  }, []);

  useEffect(() => {
    setState(loadFacilitatorState());
  }, []);

  const computed = useMemo(() => {
    if (!state) return null;
    const pxPerM = state.pxPerM || DEFAULT_PX_PER_M;
    const items = state.items ?? [];
    const lines = state.lines ?? [];
    const sectors = state.sectors ?? [];

    // Metre-space geometry for every element.
    const itemPts = items.map((it) => ({ it, p: itemM(it, pxPerM) }));
    const linePts = lines.map((l) => ({ l, pts: flatToPts(lineM(l, pxPerM)) }));
    const sectorPts = sectors.map((s) => ({ s, p: sectorM(s, pxPerM) }));

    // Bounding box across all geometry (items include their own half-width/height).
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const grow = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    itemPts.forEach(({ it, p }) => {
      const hw = (it.wM || CATALOG[it.type].w) / 2;
      const hh = (it.hM || CATALOG[it.type].h) / 2;
      grow(p.x - hw, p.y - hh);
      grow(p.x + hw, p.y + hh);
    });
    linePts.forEach(({ pts }) => pts.forEach((pt) => grow(pt.x, pt.y)));
    sectorPts.forEach(({ s, p }) => {
      grow(p.x - s.radiusM, p.y - s.radiusM);
      grow(p.x + s.radiusM, p.y + s.radiusM);
    });

    if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 10; maxY = 10; }

    const rawW = Math.max(maxX - minX, 1);
    const rawH = Math.max(maxY - minY, 1);
    const padX = rawW * 0.08;
    const padY = rawH * 0.08;
    const boxMinX = minX - padX;
    const boxMinY = minY - padY;
    const boxW = rawW + padX * 2;
    const boxH = rawH + padY * 2;

    // Fit into ~24 x 16 cm drawing area (rendered as SVG units where 1 unit = 1mm for simplicity: 240 x 160).
    const drawW = 240;
    const drawH = 160;
    const scale = Math.min(drawW / boxW, drawH / boxH);
    const offX = (drawW - boxW * scale) / 2;
    const offY = (drawH - boxH * scale) / 2;

    const toDraw = (p: Pt): Pt => ({
      x: offX + (p.x - boxMinX) * scale,
      y: offY + (p.y - boxMinY) * scale,
    });

    // 10 m grid, precomputed once — identical on every page.
    const gridLines: GridLine[] = [];
    {
      const step = 10;
      const startX = Math.floor(boxMinX / step) * step;
      const endX = boxMinX + boxW;
      for (let gx = startX; gx <= endX; gx += step) {
        const p1 = toDraw({ x: gx, y: boxMinY });
        const p2 = toDraw({ x: gx, y: boxMinY + boxH });
        gridLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
      const startY = Math.floor(boxMinY / step) * step;
      const endY = boxMinY + boxH;
      for (let gy = startY; gy <= endY; gy += step) {
        const p1 = toDraw({ x: boxMinX, y: gy });
        const p2 = toDraw({ x: boxMinX + boxW, y: gy });
        gridLines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
      }
    }

    // Roof area (m²) for rainwater harvest sentence: closed 'building' lines +
    // shed/greenhouse/tunnel/coop footprints (wM x hM).
    let roofM2 = 0;
    linePts.forEach(({ l, pts }) => {
      if (l.kind === 'building' && l.closed && pts.length >= 3) roofM2 += shoelaceArea(pts);
    });
    itemPts.forEach(({ it }) => {
      if (ROOF_TYPES.includes(it.type)) {
        const w = it.wM || CATALOG[it.type].w;
        const h = it.hM || CATALOG[it.type].h;
        roofM2 += w * h;
      }
    });

    // ONLY WHAT IS BEING PROPOSED IS COSTED.
    //
    // The canvas has always excluded the 'existing' layer before costing (FacilitatorCanvas's
    // plannedItems/plannedLines) and shows the rest under "Already on the land — not counted in
    // the budget". This page had no notion of it at all: every traced feature was priced.
    //
    // Existing geometry is not rare or hand-marked — it is created automatically. Accepting "Find
    // map features" writes the property boundary as an existing fence, map water as an existing
    // waterbody and OSM roads as existing paths, and the "What's there" step exists precisely to
    // record what is already standing. So a farmer who traced a 400 m boundary, a 300 m track and
    // a dam saw R0 for them on screen and a printed total tens of thousands of rand higher — on
    // the document that goes to a funder.
    //
    // lib/price-book.ts states the intended rule in its own note on the dam price: "Only applies
    // when planning a NEW dam — an existing one traced from the map is not costed."
    const plannedItemPts = itemPts.filter(({ it }) => resolveItemLayer(it) !== 'existing');
    const plannedLinePts = linePts.filter(({ l }) => resolveLineLayer(l) !== 'existing');
    const existingItemPts = itemPts.filter(({ it }) => resolveItemLayer(it) === 'existing');
    const existingLinePts = linePts.filter(({ l }) => resolveLineLayer(l) === 'existing');

    // Legend + BOQ tallies.
    const itemTally: Partial<Record<ElType, { count: number; areaM2: number; litres: number }>> = {};
    plannedItemPts.forEach(({ it }) => {
      const cur = itemTally[it.type] ?? { count: 0, areaM2: 0, litres: 0 };
      // A marker can represent several trees at once (Item.count, e.g. "5
      // mango trees" placed as one pin) — the printed BOQ must reflect the
      // real quantity, not the marker count. Mirrors FacilitatorCanvas's
      // groupItems() (components/FacilitatorCanvas.tsx).
      cur.count += it.count ?? 1;
      const c = CATALOG[it.type];
      if (c.shape === 'circle') {
        const w = it.wM || c.w;
        cur.areaM2 += Math.PI * (w / 2) ** 2;
      } else {
        cur.areaM2 += (it.wM || c.w) * (it.hM || c.h);
      }
      if (it.type === 'tank') cur.litres += it.litres ?? 5000;
      itemTally[it.type] = cur;
    });

    const lineTally: Partial<Record<LineKind, { count: number; m: number; areaM2?: number }>> = {};
    plannedLinePts.forEach(({ l, pts }) => {
      const cur = lineTally[l.kind] ?? { count: 0, m: 0 };
      cur.count += 1;
      cur.m += polylineLengthM(pts, l.closed ?? false);
      // Area kinds (driveway/patio/waterbody) are priced by ground/water
      // covered, not outline length — same shoelace helper used for roof m².
      if (AREA_LINE_KINDS.includes(l.kind) && l.closed && pts.length >= 3) {
        cur.areaM2 = (cur.areaM2 ?? 0) + shoelaceArea(pts);
      }
      lineTally[l.kind] = cur;
    });

    // BOQ rows costed from price-book.
    const boqRows: BoqRow[] = [];
    let total = 0;
    (Object.keys(itemTally) as ElType[]).forEach((type) => {
      const t = itemTally[type]!;
      const c = CATALOG[type];
      const cost = costForItem(type, t.areaM2 > 0 && c.shape === 'rect' ? (t.areaM2 / t.count) : c.w, c.h, t.litres > 0 ? t.litres / t.count : undefined);
      let zar: number | null = null;
      let qty = `×${t.count}`;
      // ASK THE PRICE BOOK WHICH ITEMS ARE AREA-PRICED, rather than keeping a second list of them
      // here. The hardcoded list this replaces had already lost `swalew` — the only per-m2 entry
      // missing from it — so every swale fell through to the per-unit branch and was costed on the
      // wrong basis. A copy of a fact another file owns will drift; this cannot.
      if (isAreaPricedItem(type)) {
        qty = `${t.areaM2.toFixed(1)} m²`;
        const c2 = costForItem(type, t.areaM2, 1);
        zar = c2 ? c2.zar : null;
      } else if (type === 'tank') {
        // PER TANK, NOT PER BANK. `t.litres` is the SUM across every tank of this type, and passing
        // that sum to costForItem snapped it to the nearest SIZE in the price book before the
        // result was multiplied by the count again. Three 5 000 L tanks became one 15 000 L tank,
        // snapped up to the 10 000 L rate, times three — R39 000 printed against R21 000 on screen.
        // The error grows with every tank added and always overstates.
        //
        // Summing each tank's own cost also prices a MIXED bank correctly, which an average of the
        // litres could not: one 2 500 and one 10 000 average to two 5 000s and are wrong both ways.
        qty = `×${t.count} (${Math.round(t.litres).toLocaleString()} L)`;
        const perTank = plannedItemPts
          .filter(({ it }) => it.type === type)
          .map(({ it }) => {
            const line = costForItem(type, c.w, c.h, it.litres ?? 5000);
            return line ? line.zar * (it.count ?? 1) : null;
          });
        zar = perTank.every((v) => v !== null) ? (perTank as number[]).reduce((a, b) => a + b, 0) : null;
      } else if (cost) {
        zar = cost.zar * t.count;
      }
      if (zar !== null) total += zar;
      boqRows.push({ label: c.label, icon: c.icon, qty, zar });
    });
    (Object.keys(lineTally) as LineKind[]).forEach((kind) => {
      const t = lineTally[kind]!;
      const L = LINES[kind];
      const isArea = AREA_LINE_KINDS.includes(kind);
      const cost = isArea ? costForMeasuredAreaLine(kind, t.areaM2) : costForLine(kind, t.m);
      if (cost) total += cost.zar;
      const qty = isArea
        ? t.areaM2 === undefined ? '— m²' : `${t.areaM2.toFixed(1)} m²`
        : `${t.m.toFixed(1)} m`;
      boqRows.push({ label: L.label, icon: L.icon, qty, zar: cost ? cost.zar : null });
    });

    // ALREADY ON THE LAND — listed, never priced. Dropping existing geometry out of the BOQ must
    // not make it disappear from the printed pack: a funder reading the plan needs to see that the
    // dam and the boundary fence exist, precisely so they understand why they are not being asked
    // to pay for them. Mirrors the on-screen "Already on the land" block.
    const existingRows: BoqRow[] = [];
    {
      const tally = new Map<string, { label: string; icon: string; count: number; m: number }>();
      existingItemPts.forEach(({ it }) => {
        const c2 = CATALOG[it.type];
        const cur = tally.get(`i:${it.type}`) ?? { label: c2.label, icon: c2.icon, count: 0, m: 0 };
        cur.count += it.count ?? 1;
        tally.set(`i:${it.type}`, cur);
      });
      existingLinePts.forEach(({ l, pts }) => {
        const L2 = LINES[l.kind];
        const cur = tally.get(`l:${l.kind}`) ?? { label: L2.label, icon: L2.icon, count: 0, m: 0 };
        cur.m += polylineLengthM(pts, l.closed ?? false);
        tally.set(`l:${l.kind}`, cur);
      });
      tally.forEach((v) => existingRows.push({
        label: v.label,
        icon: v.icon,
        qty: v.m > 0 ? `${v.m.toFixed(1)} m` : `×${v.count}`,
        zar: null,
      }));
    }

    const harvest = roofM2 >= 10 && state.bgSite
      ? describeHarvest(roofM2, state.bgSite.lat, state.bgSite.lon)
      : null;

    const scaleBarM = niceScaleLength(rawW);

    // One page per non-empty layer, in canon order, skipping the base-map and review pseudo-stages.
    const layersPresent: LayerId[] = LAYER_ORDER.filter((lid) => {
      if (lid === 'base' || lid === 'review') return false;
      if (lid === 'sectors') return sectorPts.length > 0;
      return itemPts.some(({ it }) => resolveItemLayer(it) === lid) || linePts.some(({ l }) => resolveLineLayer(l) === lid);
    });

    return {
      pxPerM, itemPts, linePts, sectorPts, toDraw, scale,
      drawW, drawH, roofM2, itemTally, lineTally, boqRows, existingRows, total, harvest, scaleBarM,
      boxMinX, boxMinY, boxW, boxH, gridLines, layersPresent,
    };
  }, [state]);

  // Seed the page-visibility checkboxes (all on by default) once the layer list is known,
  // without clobbering toggles the user has already made.
  useEffect(() => {
    if (!computed) return;
    setEnabledPages((prev) => {
      let changed = false;
      const next = { ...prev };
      if (next.full === undefined) { next.full = true; changed = true; }
      computed.layersPresent.forEach((lid) => {
        if (next[lid] === undefined) { next[lid] = true; changed = true; }
      });
      return changed ? next : prev;
    });
  }, [computed]);

  if (state === undefined) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#5C5040' }}>Loading…</div>;
  }

  if (state === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'sans-serif', color: '#5C5040', background: '#E4DCC6' }}>
        <div style={{ fontSize: 15 }}>No design on this device yet.</div>
        <button
          onClick={() => history.back()}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #C2A878', background: '#fff', color: '#3A352C', cursor: 'pointer' }}
        >
          ‹ Back
        </button>
      </div>
    );
  }

  const c = computed!;
  const title = state.title || state.bgSite?.name || 'Garden design';
  const dateStr = new Date(state.savedAt || Date.now()).toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' });

  const togglePage = (key: PageKey) => {
    setEnabledPages((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };

  const fullOn = enabledPages.full ?? true;
  const activeLayerPages = c.layersPresent.filter((lid) => enabledPages[lid] ?? true);
  const nothingToPrint = !fullOn && activeLayerPages.length === 0;

  return (
    <div>
      <style>{`
        @media print {
          .print-toolbar { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
          body { background: #fff !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; break-inside: avoid; break-after: page; page-break-after: always; }
          .sheet:last-child { break-after: auto; page-break-after: auto; }
        }
        @media screen {
          body { background: #EDE7DB; }
        }
      `}</style>

      <div className="print-toolbar" style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '10px 16px', background: '#1F4D2B', color: '#fff', fontFamily: 'sans-serif' }}>
        <button
          onClick={() => history.back()}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          ‹ Back
        </button>
        {/* history.back() no-ops when this page was opened directly (e.g. a new tab) —
            give a real destination so the facilitator is never stranded here. */}
        <a
          href="/facilitator"
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13, textDecoration: 'none' }}
        >
          ✎ Back to Design map
        </a>
        <button
          onClick={() => {
            if (standalone) {
              // Never a silent no-op again. The link itself still works — it is the printing
              // that fails in this shell — so hand the facilitator the one route that does:
              // this same page, opened in a real browser tab.
              setShowPrintHint(true);
              try { navigator.clipboard.writeText(window.location.href); } catch { /* clipboard denied — the hint still tells them where they are */ }
              return;
            }
            window.print();
          }}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#fff', color: '#1F4D2B', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          🖨 Print / Save as PDF
        </button>
        <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 8 }}>
          A4 landscape plan pack{nothingToPrint ? ' — select at least one page below' : ''}
        </span>
        {showPrintHint && (
          <span style={{ fontSize: 12, color: '#FFE9B3', marginLeft: 8 }}>
            Printing isn&apos;t available in the installed app. This page&apos;s link is copied — open it in Safari or Chrome to print.
          </span>
        )}

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={fullOn} onChange={() => togglePage('full')} />
            Full design
          </label>
          {c.layersPresent.map((lid) => (
            <label key={lid} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={enabledPages[lid] ?? true} onChange={() => togglePage(lid)} />
              {LAYERS[lid].icon} {LAYERS[lid].name}
            </label>
          ))}
        </div>
      </div>

      {fullOn && (
        <div className="sheet" style={SHEET_STYLE}>
          {/* Title block */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #161311', paddingBottom: '4mm', marginBottom: '5mm' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{title}</div>
              {state.bgSite && (
                <div style={{ fontSize: 11, marginTop: 3, color: '#3A352C' }}>
                  {state.bgSite.name} · {state.bgSite.lat.toFixed(4)}, {state.bgSite.lon.toFixed(4)}
                </div>
              )}
              <div style={{ fontSize: 11, marginTop: 2, color: '#5C5040' }}>{dateStr}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.5, color: '#1F4D2B' }}>ImbewuField</div>
              <div style={{ fontSize: 9.5, color: '#9A8268' }}>Permaculture plan sheet</div>
            </div>
          </div>

          {/* Body: drawing left, legend+BOQ right */}
          <div style={{ display: 'flex', gap: '8mm' }}>
            {/* Plan drawing */}
            <div style={{ flex: '0 0 auto' }}>
              <PlanSvg
                itemPts={c.itemPts} linePts={c.linePts} sectorPts={c.sectorPts}
                toDraw={c.toDraw} scale={c.scale} pxPerM={c.pxPerM}
                drawW={c.drawW} drawH={c.drawH} scaleBarM={c.scaleBarM} gridLines={c.gridLines}
              />
            </div>

            {/* Legend + BOQ */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4mm', fontSize: 10 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #C7BCA6', marginBottom: 3, paddingBottom: 2 }}>Legend</div>
                <div style={{ columnCount: 2, columnGap: '4mm' }}>
                  {(Object.keys(c.itemTally) as ElType[]).map((type) => {
                    const t = c.itemTally[type]!;
                    const cat = CATALOG[type];
                    return (
                      <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, breakInside: 'avoid' }}>
                        <span style={{ width: 9, height: 9, borderRadius: cat.shape === 'circle' ? '50%' : 2, background: cat.fill, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 9 }}>{cat.icon} {cat.label} × {t.count}</span>
                      </div>
                    );
                  })}
                  {(Object.keys(c.lineTally) as LineKind[]).map((kind) => {
                    const t = c.lineTally[kind]!;
                    const L = LINES[kind];
                    const measure = AREA_LINE_KINDS.includes(kind)
                      ? t.areaM2 === undefined ? '— m²' : `${t.areaM2.toFixed(1)} m²`
                      : `${t.m.toFixed(1)} m`;
                    return (
                      <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, breakInside: 'avoid' }}>
                        <span style={{ width: 14, height: 3, background: L.color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 9 }}>{L.icon} {L.label} — {measure}</span>
                      </div>
                    );
                  })}
                  {Object.keys(c.itemTally).length === 0 && Object.keys(c.lineTally).length === 0 && (
                    <div style={{ fontSize: 9, color: '#9A8268' }}>No elements placed yet.</div>
                  )}
                </div>
              </div>

              {c.harvest && (
                <div style={{ fontSize: 9, background: '#EEF4EC', border: '1px solid #C7D9C0', borderRadius: 4, padding: '3mm', lineHeight: 1.4 }}>
                  💧 {c.harvest.sentence}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, borderBottom: '1px solid #C7BCA6', marginBottom: 3, paddingBottom: 2 }}>Bill of quantities</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #C7BCA6' }}>
                      <th style={{ textAlign: 'left', padding: '2px 0' }}>Item</th>
                      <th style={{ textAlign: 'right', padding: '2px 0' }}>Qty</th>
                      <th style={{ textAlign: 'right', padding: '2px 0' }}>ZAR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.boqRows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #EDE7DB' }}>
                        <td style={{ padding: '2px 0' }}>{r.icon} {r.label}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0' }}>{r.qty}</td>
                        <td style={{ textAlign: 'right', padding: '2px 0' }}>{r.zar !== null ? formatZar(r.zar) : '—'}</td>
                      </tr>
                    ))}
                    {c.boqRows.length === 0 && (
                      <tr><td colSpan={3} style={{ padding: '4px 0', color: '#9A8268' }}>Nothing to cost yet.</td></tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #161311', fontWeight: 700 }}>
                      <td style={{ padding: '3px 0' }} colSpan={2}>TOTAL</td>
                      <td style={{ textAlign: 'right', padding: '3px 0' }}>{formatZar(c.total)}</td>
                    </tr>
                  </tfoot>
                </table>
                {c.existingRows.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: '#5C5040' }}>
                      Already on the land — not counted in the budget
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8, color: '#5C5040' }}>
                      <tbody>
                        {c.existingRows.map((r, i) => (
                          <tr key={i}>
                            <td style={{ padding: '2px 0' }}>{r.icon}</td>
                            <td style={{ padding: '2px 0' }}>{r.label}</td>
                            <td style={{ textAlign: 'right', padding: '2px 0' }}>{r.qty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ fontSize: 7.5, color: '#9A8268', marginTop: 4, lineHeight: 1.35 }}>{DISCLAIMER}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeLayerPages.map((lid) => {
        const def = LAYERS[lid];
        return (
          <div key={lid} className="sheet" style={SHEET_STYLE}>
            <div style={{ borderBottom: '2px solid #161311', paddingBottom: '4mm', marginBottom: '5mm' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{def.icon} {def.name} map</div>
              <div style={{ fontSize: 11, marginTop: 3, color: '#5C5040' }}>{title}</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PlanSvg
                itemPts={c.itemPts} linePts={c.linePts} sectorPts={c.sectorPts}
                toDraw={c.toDraw} scale={c.scale} pxPerM={c.pxPerM}
                drawW={c.drawW} drawH={c.drawH} scaleBarM={c.scaleBarM} gridLines={c.gridLines}
                highlightLayer={lid}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
