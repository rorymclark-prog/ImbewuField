'use client';

// Print-ready plan sheet for a facilitator garden design.
//
// Reads the same localStorage design the facilitator canvas edits
// (imbewu_facilitator_design_v1), and renders it as a static A4-landscape
// SVG sheet: title block, plan drawing (from metre coordinates), legend,
// and a bill-of-quantities table costed from the price book. Pure
// client-side, read-only — never writes back to the design.

import { useEffect, useMemo, useState } from 'react';
import type {
  ElType, LineKind, SectorKind, LayerId,
  FacItem, FacLine, FacSector, FacilitatorDesignState,
} from '@/lib/facilitator-design';
import { loadFacilitatorState, DEFAULT_PX_PER_M } from '@/lib/facilitator-design';
import { costForItem, costForLine, formatZar, DISCLAIMER } from '@/lib/price-book';
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

export default function FacilitatorPrintPage() {
  const [state, setState] = useState<FacilitatorDesignState | null | undefined>(undefined);

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

    // Legend + BOQ tallies.
    const itemTally: Partial<Record<ElType, { count: number; areaM2: number; litres: number }>> = {};
    itemPts.forEach(({ it }) => {
      const cur = itemTally[it.type] ?? { count: 0, areaM2: 0, litres: 0 };
      cur.count += 1;
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

    const lineTally: Partial<Record<LineKind, { count: number; m: number }>> = {};
    linePts.forEach(({ l, pts }) => {
      const cur = lineTally[l.kind] ?? { count: 0, m: 0 };
      cur.count += 1;
      cur.m += polylineLengthM(pts, l.closed ?? false);
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
      if (type === 'bed' || type === 'hugel' || type === 'foodforest' || type === 'nursery' || type === 'greenhouse' || type === 'tunnel' || type === 'shed' || type === 'reedbed' || type === 'pond' || type === 'firebreak') {
        qty = `${t.areaM2.toFixed(1)} m²`;
        const c2 = costForItem(type, t.areaM2, 1);
        zar = c2 ? c2.zar : null;
      } else if (type === 'tank') {
        qty = `×${t.count} (${Math.round(t.litres).toLocaleString()} L)`;
        const c2 = costForItem(type, c.w, c.h, t.litres);
        zar = c2 ? c2.zar * t.count : null;
      } else if (cost) {
        zar = cost.zar * t.count;
      }
      if (zar !== null) total += zar;
      boqRows.push({ label: c.label, icon: c.icon, qty, zar });
    });
    (Object.keys(lineTally) as LineKind[]).forEach((kind) => {
      const t = lineTally[kind]!;
      const L = LINES[kind];
      const cost = costForLine(kind, t.m);
      if (cost) total += cost.zar;
      boqRows.push({ label: L.label, icon: L.icon, qty: `${t.m.toFixed(1)} m`, zar: cost ? cost.zar : null });
    });

    const harvest = roofM2 >= 10 && state.bgSite
      ? describeHarvest(roofM2, state.bgSite.lat, state.bgSite.lon)
      : null;

    const scaleBarM = niceScaleLength(rawW);

    return {
      pxPerM, itemPts, linePts, sectorPts, toDraw, scale,
      drawW, drawH, roofM2, itemTally, lineTally, boqRows, total, harvest, scaleBarM,
      boxMinX, boxMinY, boxW, boxH,
    };
  }, [state]);

  if (state === undefined) {
    return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#5C5040' }}>Loading…</div>;
  }

  if (state === null) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, fontFamily: 'sans-serif', color: '#5C5040', background: '#F7F2E9' }}>
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

  // North arrow + grid + scale bar geometry in draw space.
  const gridLinesM = () => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const step = 10; // 10 m grid
    const startX = Math.floor(c.boxMinX / step) * step;
    const endX = c.boxMinX + c.boxW;
    for (let gx = startX; gx <= endX; gx += step) {
      const p1 = c.toDraw({ x: gx, y: c.boxMinY });
      const p2 = c.toDraw({ x: gx, y: c.boxMinY + c.boxH });
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    const startY = Math.floor(c.boxMinY / step) * step;
    const endY = c.boxMinY + c.boxH;
    for (let gy = startY; gy <= endY; gy += step) {
      const p1 = c.toDraw({ x: c.boxMinX, y: gy });
      const p2 = c.toDraw({ x: c.boxMinX + c.boxW, y: gy });
      lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    return lines;
  };

  const scaleBarPx = c.scaleBarM * c.scale;

  return (
    <div>
      <style>{`
        @media print {
          .print-toolbar { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
          body { background: #fff !important; }
          .sheet { box-shadow: none !important; margin: 0 !important; }
        }
        @media screen {
          body { background: #EDE7DB; }
        }
      `}</style>

      <div className="print-toolbar" style={{ position: 'sticky', top: 0, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', background: '#1F4D2B', color: '#fff', fontFamily: 'sans-serif' }}>
        <button
          onClick={() => history.back()}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13 }}
        >
          ‹ Back
        </button>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#fff', color: '#1F4D2B', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          🖨 Print / Save as PDF
        </button>
        <span style={{ fontSize: 12, opacity: 0.85, marginLeft: 8 }}>A4 landscape plan sheet</span>
      </div>

      <div
        className="sheet"
        style={{
          width: '297mm',
          minHeight: '210mm',
          margin: '16px auto',
          background: '#fff',
          color: '#161311',
          fontFamily: 'Georgia, "Times New Roman", serif',
          padding: '12mm 14mm',
          boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
          boxSizing: 'border-box',
        }}
      >
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
            <svg width="240mm" height="160mm" viewBox={`0 0 ${c.drawW} ${c.drawH}`} style={{ border: '1px solid #C7BCA6', background: '#FBF9F4' }}>
              {/* grid */}
              {gridLinesM().map((g, i) => (
                <line key={`grid-${i}`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#E2D8C4" strokeWidth={0.2} />
              ))}

              {/* lines */}
              {c.linePts.map(({ l, pts }, i) => {
                if (pts.length < 2) return null;
                const L = LINES[l.kind];
                const draw = pts.map((p) => c.toDraw(p));
                const pointsAttr = draw.map((p) => `${p.x},${p.y}`).join(' ');
                if (l.closed) {
                  const isBuilding = l.kind === 'building';
                  const isFence = l.kind === 'fence';
                  const isPipe = l.kind === 'pipe';
                  return (
                    <polygon
                      key={l.id ?? i}
                      points={pointsAttr}
                      fill={isBuilding ? '#5A5448' : isFence ? 'none' : isPipe ? 'none' : 'none'}
                      fillOpacity={isBuilding ? 0.2 : 0}
                      stroke={L.color}
                      strokeWidth={Math.max(L.width * (c.scale / c.pxPerM) * c.pxPerM * 0.15, 0.6)}
                      strokeDasharray={L.dash.join(',')}
                    />
                  );
                }
                return (
                  <polyline
                    key={l.id ?? i}
                    points={pointsAttr}
                    fill="none"
                    stroke={L.color}
                    strokeWidth={Math.max(L.width * 0.3, 0.6)}
                    strokeDasharray={L.dash.join(',')}
                    strokeLinecap="round"
                  />
                );
              })}

              {/* sectors (translucent wedges) */}
              {c.sectorPts.map(({ s, p }, i) => {
                const def = SECTOR_LABELS[s.kind];
                const center = c.toDraw(p);
                const r = s.radiusM * c.scale;
                const a0 = (s.rotation - s.spanDeg / 2) * (Math.PI / 180);
                const a1 = (s.rotation + s.spanDeg / 2) * (Math.PI / 180);
                const x0 = center.x + r * Math.cos(a0);
                const y0 = center.y + r * Math.sin(a0);
                const x1 = center.x + r * Math.cos(a1);
                const y1 = center.y + r * Math.sin(a1);
                const large = s.spanDeg > 180 ? 1 : 0;
                return (
                  <path
                    key={`sector-${i}`}
                    d={`M ${center.x} ${center.y} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`}
                    fill={def.color}
                    fillOpacity={0.14}
                    stroke={def.color}
                    strokeOpacity={0.4}
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* items */}
              {c.itemPts.map(({ it, p }, i) => {
                const cat = CATALOG[it.type];
                const center = c.toDraw(p);
                const w = (it.wM || cat.w) * c.scale;
                const h = (it.hM || cat.h) * c.scale;
                const showLabel = Math.max(w, h) > 8;
                return (
                  <g key={it.id ?? i} transform={`rotate(${it.rotation || 0} ${center.x} ${center.y})`}>
                    {cat.shape === 'circle' ? (
                      <ellipse cx={center.x} cy={center.y} rx={w / 2} ry={h / 2} fill={cat.fill} fillOpacity={0.75} stroke="#161311" strokeWidth={0.3} />
                    ) : (
                      <rect x={center.x - w / 2} y={center.y - h / 2} width={w} height={h} fill={cat.fill} fillOpacity={0.75} stroke="#161311" strokeWidth={0.3} />
                    )}
                    <text x={center.x} y={center.y + 2} fontSize={Math.min(6, Math.max(w, h) * 0.5)} textAnchor="middle" fill="#fff">{cat.icon}</text>
                    {showLabel && (
                      <text x={center.x} y={center.y + h / 2 + 4} fontSize={3} textAnchor="middle" fill="#161311">{cat.label}</text>
                    )}
                  </g>
                );
              })}

              {/* north arrow */}
              <g transform={`translate(${c.drawW - 18}, 14)`}>
                <line x1={0} y1={10} x2={0} y2={-6} stroke="#161311" strokeWidth={1} />
                <polygon points="0,-9 -3,-2 3,-2" fill="#161311" />
                <text x={0} y={19} fontSize={6} textAnchor="middle" fill="#161311" fontWeight="bold">N ↑</text>
              </g>

              {/* scale bar */}
              <g transform={`translate(10, ${c.drawH - 8})`}>
                <line x1={0} y1={0} x2={scaleBarPx} y2={0} stroke="#161311" strokeWidth={1.5} />
                <line x1={0} y1={-2} x2={0} y2={2} stroke="#161311" strokeWidth={1} />
                <line x1={scaleBarPx} y1={-2} x2={scaleBarPx} y2={2} stroke="#161311" strokeWidth={1} />
                <text x={scaleBarPx / 2} y={-4} fontSize={4.5} textAnchor="middle" fill="#161311">{c.scaleBarM} m</text>
              </g>
            </svg>
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
                  return (
                    <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2, breakInside: 'avoid' }}>
                      <span style={{ width: 14, height: 3, background: L.color, flexShrink: 0, display: 'inline-block' }} />
                      <span style={{ fontSize: 9 }}>{L.icon} {L.label} — {t.m.toFixed(1)} m</span>
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
              <div style={{ fontSize: 7.5, color: '#9A8268', marginTop: 4, lineHeight: 1.35 }}>{DISCLAIMER}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
