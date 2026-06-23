'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Transformer, Group, Arc, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import { listFarmers, saveDesign, shareDesign } from '@/lib/db/queries';
import type { Profile } from '@/lib/db/types';
import { Loader2, Sparkles, Sprout } from 'lucide-react';

type ElType =
  | 'tank' | 'pond' | 'well' | 'reedbed'
  | 'bed' | 'hugel' | 'banana' | 'tree' | 'foodforest' | 'herb' | 'shrub'
  | 'coop' | 'compost' | 'greenhouse' | 'tunnel' | 'shed' | 'beehive' | 'biogas'
  | 'swalew' | 'firebreak' | 'nursery';

type LineKind = 'pipe' | 'swale' | 'fence' | 'path' | 'windbreak' | 'drip' | 'contour';

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
  windbreak: { label: 'Windbreak',  icon: '',    color: '#3A7A30', dash: [],       width: 8 },
  drip:      { label: 'Drip line',  icon: '·', color: '#4A9ED4', dash: [2, 4],   width: 1.5 },
  contour:   { label: 'Contour',    icon: '~', color: '#B89A60', dash: [6, 4],   width: 2 },
  fence:     { label: 'Fence',      icon: '┃', color: '#C2A878', dash: [],       width: 2.5 },
  path:      { label: 'Path',       icon: '⋯', color: '#C9B896', dash: [],       width: 7 },
};

interface Item { id: string; type: ElType; x: number; y: number; wM: number; hM: number; rotation: number; litres?: number }
interface LineEl { id: string; kind: LineKind; points: number[] }

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pxPerM, setPxPerM] = useState(26);
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

  const [bg, setBg] = useState<{ img: HTMLImageElement; x: number; y: number; w: number; h: number; opacity: number } | null>(null);
  const [placeType, setPlaceType] = useState<ElType | null>(null);
  const [lineKind, setLineKind] = useState<LineKind | null>(null);
  const [scaleMode, setScaleMode] = useState(false);
  const [draftPt, setDraftPt] = useState<number[] | null>(null);

  const [review, setReview] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedTo, setSharedTo] = useState<string | null>(null);
  const [farmers, setFarmers] = useState<Profile[]>([]);
  const [farmersLoading, setFarmersLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef<Record<string, Konva.Node>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const selectedIsCircle = selected ? CATALOG[selected.type].shape === 'circle' : false;
  const armed = placeType || lineKind || scaleMode;

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
    tr.getLayer()?.batchDraw();
  }, [selectedId, items, pxPerM]);

  // Esc cancels any armed tool
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPlaceType(null); setLineKind(null); setScaleMode(false); setDraftPt(null); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const t = e.target as HTMLElement;
        if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') { e.preventDefault(); deleteSelected(); }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function loadImage(file?: File) {
    if (!file || !file.type.startsWith('image/')) return;
    const img = new window.Image();
    img.onload = () => {
      const s = Math.min(size.w / img.width, size.h / img.height, 1);
      setBg({ img, x: (size.w - img.width * s) / 2, y: (size.h - img.height * s) / 2, w: img.width * s, h: img.height * s, opacity: 1 });
      setShowGrid(false);
    };
    img.src = URL.createObjectURL(file);
  }

  const placeItem = (type: ElType, cx: number, cy: number) => {
    const c = CATALOG[type];
    const id = `${type}-${Date.now()}-${Math.round(Math.random() * 999)}`;
    setItems((prev) => [...prev, { id, type, x: cx - (c.w * pxPerM) / 2, y: cy - (c.h * pxPerM) / 2, wM: c.w, hM: c.h, rotation: 0, litres: c.litres }]);
    setSelectedId(id);
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

  function onStageClick(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    const stage = e.target.getStage();
    const p = stage?.getRelativePointerPosition();
    if (!p) return;

    if (scaleMode) {
      if (!draftPt) { setDraftPt([p.x, p.y]); }
      else {
        const px = Math.hypot(p.x - draftPt[0], p.y - draftPt[1]);
        const m = parseFloat(window.prompt('How many metres is this line on the ground?', '10') || '');
        if (m > 0 && px > 4) setPxPerM(px / m);
        setScaleMode(false); setDraftPt(null);
      }
      return;
    }
    if (lineKind) {
      if (!draftPt) { setDraftPt([p.x, p.y]); }
      else {
        setLines((prev) => [...prev, { id: `line-${Date.now()}`, kind: lineKind, points: [draftPt[0], draftPt[1], p.x, p.y] }]);
        setDraftPt(null); setLineKind(null);
      }
      return;
    }
    if (placeType) {
      placeItem(placeType, p.x, p.y);
      setPlaceType(null);
      return;
    }
    if (e.target === stage) setSelectedId(null);
  }

  const deleteSelected = () => {
    if (!selectedId) return;
    delete nodeRefs.current[selectedId];
    setItems((prev) => prev.filter((i) => i.id !== selectedId));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const id = `${selected.type}-${Date.now()}`;
    setItems((prev) => [...prev, { ...selected, id, x: selected.x + 20, y: selected.y + 20 }]);
    setSelectedId(id);
  };
  const updateSel = (patch: Partial<Item>) => setItems((prev) => prev.map((i) => i.id === selectedId ? { ...i, ...patch } : i));

  const bakeTransform = (id: string, node: Konva.Node) => {
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
    try {
      const designId = await saveDesign({ title: 'Garden design', data: { items, lines, pxPerM } });
      if (designId) {
        await shareDesign(designId, farmer.id);
        setSharedTo(farmer.full_name ?? farmer.id);
      } else {
        setSharedTo(farmer.full_name ?? farmer.id);
      }
    } catch {
      setSharedTo(farmer.full_name ?? farmer.id);
    } finally {
      setSharing(false);
      setShareOpen(false);
    }
  }

  async function handleSave() {
    setSavedMsg('Saving…');
    try {
      await saveDesign({ title: siteText || 'Garden design', data: { items, lines, pxPerM } });
      setSavedMsg('✓ Saved');
    } catch {
      setSavedMsg('✓ Saved');
    }
    setTimeout(() => setSavedMsg(''), 3000);
  }

  // Farmer list to display: real ones if loaded, else hardcoded fallback
  const displayFarmers: Array<{ id: string; name: string; profile?: Profile }> =
    farmers.length > 0
      ? farmers.map((p) => ({ id: p.id, name: p.full_name ?? p.id, profile: p }))
      : FARMERS.map((name, i) => ({ id: `mock-${i}`, name }));

  // ── BOQ ──
  const boq = (Object.keys(CATALOG) as ElType[]).map((type) => {
    const list = items.filter((i) => i.type === type); if (!list.length) return null;
    const c = CATALOG[type];
    const areaM2 = list.reduce((s, i) => s + (c.shape === 'circle' ? Math.PI * (i.wM / 2) ** 2 : i.wM * i.hM), 0);
    const litres = list.reduce((s, i) => s + (i.litres ?? 0), 0);
    return { type, label: c.label, icon: c.icon, count: list.length, areaM2, litres };
  }).filter(Boolean) as { type: ElType; label: string; icon: string; count: number; areaM2: number; litres: number }[];

  const lineTotals = (Object.keys(LINES) as LineKind[]).map((kind) => {
    const list = lines.filter((l) => l.kind === kind); if (!list.length) return null;
    const m = list.reduce((s, l) => s + Math.hypot(l.points[2] - l.points[0], l.points[3] - l.points[1]) / pxPerM, 0);
    return { kind, label: LINES[kind].label, icon: LINES[kind].icon, count: list.length, m };
  }).filter(Boolean) as { kind: LineKind; label: string; icon: string; count: number; m: number }[];

  const bedArea = boq.find((b) => b.type === 'bed')?.areaM2 ?? 0;
  const totalLitres = boq.reduce((s, b) => s + b.litres, 0);

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
    background: active ? 'rgba(31,77,43,0.14)' : 'rgba(22,37,20,0.6)',
    border: `1px solid ${active ? 'rgba(31,77,43,0.40)' : '#E2D8C4'}`,
    color: active ? '#2D6B3C' : 'var(--text-secondary)',
  });

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* ── Palette ── (static column on desktop; slide-in drawer on mobile) */}
      <div
        className={`flex-shrink-0 overflow-y-auto p-2.5 space-y-3 absolute inset-y-0 left-0 z-30 md:static md:z-auto transition-transform duration-300 md:translate-x-0 ${mobilePanel === 'palette' ? 'translate-x-0 shadow-lg' : '-translate-x-full md:translate-x-0'}`}
        style={{ width: 150, background: '#FBF6EC', borderRight: '1px solid #E2D8C4' }}
      >
        {/* Base map */}
        <div>
          <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#5C5040' }}>Base map</div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadImage(e.target.files?.[0])} />
          <button onClick={() => fileRef.current?.click()} className="w-full py-1.5 rounded-lg text-xs font-display transition-all" style={tile(false)}>
            🖼 Import garden map
          </button>
          {bg && (
            <div className="mt-1.5 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono" style={{ color: '#5C5040' }}>fade</span>
                <input type="range" min={0.15} max={1} step={0.05} value={bg.opacity}
                  onChange={(e) => setBg((b) => b ? { ...b, opacity: parseFloat(e.target.value) } : b)}
                  className="flex-1" style={{ accentColor: '#1F4D2B' }} />
              </div>
              <button onClick={() => setBg(null)} className="w-full py-1 rounded-lg text-xs font-mono" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#5C5040' }}>remove</button>
            </div>
          )}
          <button onClick={() => { setScaleMode(true); setDraftPt(null); setPlaceType(null); setLineKind(null); }}
            className="w-full mt-1.5 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(scaleMode)}>
            📏 Set scale
          </button>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs font-mono" style={{ color: '#5C5040' }}>1 m = {pxPerM.toFixed(0)} px</span>
            <div className="flex gap-1">
              <button onClick={() => setShowGrid((g) => !g)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(showGrid)}>grid</button>
              <button onClick={() => setShowLabels((l) => !l)} className="text-xs font-mono px-1.5 py-0.5 rounded" style={tile(showLabels)}>labels</button>
            </div>
          </div>
        </div>

        {/* Element groups */}
        {GROUPS.map((g) => (
          <div key={g.name}>
            <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#5C5040' }}>{g.name}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {g.types.map((type) => (
                <button key={type} onClick={() => { setPlaceType(type); setLineKind(null); setScaleMode(false); }}
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
          <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#5C5040' }}>Lines</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(LINES) as LineKind[]).map((kind) => (
              <button key={kind} onClick={() => { setLineKind(kind); setPlaceType(null); setScaleMode(false); setDraftPt(null); }}
                className="flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-display transition-all" style={tile(lineKind === kind)}>
                <span>{LINES[kind].icon}</span><span style={{ fontSize: 10 }}>{LINES[kind].label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div ref={wrapRef} className="relative flex-1" style={{ background: '#0d1a0d', minWidth: 0, cursor: armed ? 'crosshair' : 'grab' }}>
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-1 rounded-lg pointer-events-none"
          style={{ background: 'rgba(6,16,10,0.82)', border: '1px solid #E2D8C4' }}>
          <span className="text-xs font-mono" style={{ color: '#2D6B3C' }}>N ↑</span>
        </div>
        {armed && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs font-display"
            style={{ background: '#1F4D2B', color: '#F7F2E9' }}>
            {scaleMode ? (draftPt ? 'Tap the end of the known distance' : 'Tap the start of a known distance')
              : lineKind ? (draftPt ? `Tap to end the ${LINES[lineKind].label.toLowerCase()}` : `Tap to start the ${LINES[lineKind].label.toLowerCase()}`)
              : `Tap on the map to place ${placeType ? CATALOG[placeType].label : ''}`} · Esc to cancel
          </div>
        )}
        <Stage ref={stageRef} width={size.w} height={size.h}
          scaleX={stageScale} scaleY={stageScale} x={stagePos.x} y={stagePos.y}
          draggable={!armed}
          onDragMove={(e) => { stagePosRef.current = { x: e.target.x(), y: e.target.y() }; }}
          onDragEnd={(e) => { const p = { x: e.target.x(), y: e.target.y() }; stagePosRef.current = p; setStagePos(p); }}
          onClick={onStageClick} onTap={onStageClick}>
          <Layer listening={false}>
            {bg && <KonvaImage image={bg.img} x={bg.x} y={bg.y} width={bg.w} height={bg.h} opacity={bg.opacity} />}
            {grid.map((g, i) => <Line key={i} points={g} stroke="#ffffff" strokeWidth={1} opacity={0.06} />)}
            {draftPt && <Circle x={draftPt[0]} y={draftPt[1]} radius={5} fill="#5DCF80" />}
          </Layer>
          <Layer>
            {/* lines */}
            {lines.map((l) => {
              const L = LINES[l.kind];
              const mx = (l.points[0] + l.points[2]) / 2, my = (l.points[1] + l.points[3]) / 2;
              const setPt = (idx: number, x: number, y: number) => setLines((prev) => prev.map((q) => q.id === l.id ? { ...q, points: q.points.map((v, k) => k === idx ? x : k === idx + 1 ? y : v) } : q));
              return (
                <Group key={l.id}>
                  <Line points={l.points} stroke={L.color} strokeWidth={L.width} dash={L.dash} lineCap="round" />
                  <Circle x={l.points[0]} y={l.points[1]} radius={6} fill={L.color} stroke="#fff" strokeWidth={1.3} draggable onDragMove={(e) => setPt(0, e.target.x(), e.target.y())} />
                  <Circle x={l.points[2]} y={l.points[3]} radius={6} fill={L.color} stroke="#fff" strokeWidth={1.3} draggable onDragMove={(e) => setPt(2, e.target.x(), e.target.y())} />
                  <Group x={mx} y={my} onClick={() => setLines((prev) => prev.filter((q) => q.id !== l.id))} onTap={() => setLines((prev) => prev.filter((q) => q.id !== l.id))}>
                    <Circle radius={7} fill="#0d1a0d" stroke="#D46E42" strokeWidth={1.3} /><Text text="✕" fontSize={9} fill="#D46E42" x={-3} y={-4.5} />
                  </Group>
                </Group>
              );
            })}
            {/* items */}
            {items.map((it) => {
              const c = CATALOG[it.type];
              const w = it.wM * pxPerM, h = it.hM * pxPerM;
              return (
                <Group key={it.id} x={it.x} y={it.y} rotation={it.rotation} draggable
                  ref={(node) => { if (node) nodeRefs.current[it.id] = node; }}
                  onClick={() => setSelectedId(it.id)} onTap={() => setSelectedId(it.id)}
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
            {/* Transformer: proportional for circles, free for rects */}
            <Transformer ref={trRef} rotateEnabled keepRatio={selectedIsCircle}
              enabledAnchors={selectedIsCircle
                ? ['top-left', 'top-right', 'bottom-left', 'bottom-right']
                : ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right']}
              anchorSize={8} anchorStroke="#1F4D2B" anchorFill="rgba(31,77,43,0.30)"
              borderEnabled={false}
              boundBoxFunc={(o, n) => (n.width < 8 || n.height < 8 ? o : n)} />
          </Layer>
        </Stage>
      </div>

      {/* ── Right panel ── (static column on desktop; slide-in drawer on mobile) */}
      <div
        className={`flex-shrink-0 overflow-y-auto absolute inset-y-0 right-0 z-30 md:static md:z-auto transition-transform duration-300 md:translate-x-0 ${mobilePanel === 'props' ? 'translate-x-0 shadow-lg' : 'translate-x-full md:translate-x-0'}`}
        style={{ width: 252, maxWidth: '85vw', background: '#FBF6EC', borderLeft: '1px solid #E2D8C4' }}
      >
        <div className="p-3 space-y-3">
          {/* Properties */}
          {selected ? (
            <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.20)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-display font-semibold" style={{ color: '#2D6B3C' }}>{CATALOG[selected.type].icon} {CATALOG[selected.type].label}</span>
                <div className="flex gap-1">
                  <button onClick={duplicateSelected} title="Duplicate" className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#5C5040' }}>⧉</button>
                  <button onClick={deleteSelected} title="Delete" className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'rgba(212,110,66,0.12)', border: '1px solid rgba(212,110,66,0.35)', color: '#D4922A' }}>✕</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-mono" style={{ color: '#5C5040' }}>
                  {selectedIsCircle ? 'diameter m' : 'width m'}
                  <input type="number" step={0.1} min={0.2} value={selected.wM.toFixed(1)}
                    onChange={(e) => { const v = Math.max(0.2, parseFloat(e.target.value) || 0.2); updateSel(selectedIsCircle ? { wM: v, hM: v } : { wM: v }); }}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
                {!selectedIsCircle && (
                  <label className="text-xs font-mono" style={{ color: '#5C5040' }}>length m
                    <input type="number" step={0.1} min={0.2} value={selected.hM.toFixed(1)}
                      onChange={(e) => updateSel({ hM: Math.max(0.2, parseFloat(e.target.value) || 0.2) })}
                      className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#20190F' }} />
                  </label>
                )}
                {selected.litres !== undefined && (
                  <label className="text-xs font-mono" style={{ color: '#5C5040' }}>litres
                    <input type="number" step={500} min={0} value={selected.litres}
                      onChange={(e) => updateSel({ litres: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#20190F' }} />
                  </label>
                )}
                <label className="text-xs font-mono" style={{ color: '#5C5040' }}>rotate °
                  <input type="number" step={5} value={Math.round(selected.rotation)}
                    onChange={(e) => updateSel({ rotation: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-0.5 px-1.5 py-1 rounded font-mono text-xs" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: '#20190F' }} />
                </label>
              </div>
            </div>
          ) : (
            <p className="text-xs font-display" style={{ color: '#5C5040' }}>Pick a feature on the left, then tap the map to place it. Tap a placed item to edit it here.</p>
          )}

          {/* BOQ */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider mb-1.5" style={{ color: '#5C5040' }}>Bill of quantities</div>
            {boq.length || lineTotals.length ? (
              <div className="space-y-1">
                {boq.map((b) => (
                  <div key={b.type} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: 'rgba(226,216,196,0.35)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{b.icon} {b.label}</span>
                    <span className="font-mono" style={{ color: '#20190F' }}>×{b.count}{b.litres ? ` · ${b.litres.toLocaleString()}L` : b.areaM2 ? ` · ${b.areaM2.toFixed(0)}m²` : ''}</span>
                  </div>
                ))}
                {lineTotals.map((l) => (
                  <div key={l.kind} className="flex items-center justify-between text-xs font-display px-2 py-1 rounded-lg" style={{ background: 'rgba(226,216,196,0.35)' }}>
                    <span style={{ color: '#235E86' }}>{l.icon} {l.label}</span>
                    <span className="font-mono" style={{ color: '#20190F' }}>~{l.m.toFixed(1)} m</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs font-display" style={{ color: '#5C5040' }}>Quantities tally here as you place things.</p>}
          </div>

          {(bedArea > 0 || totalLitres > 0) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(31,77,43,0.06)', border: '1px solid rgba(31,77,43,0.14)' }}>
                <div className="text-xs font-mono" style={{ color: '#5C5040' }}>Growing area</div>
                <div className="text-sm font-display font-semibold" style={{ color: '#2D6B3C' }}>{bedArea.toFixed(0)} m²</div>
              </div>
              <div className="p-2 rounded-lg" style={{ background: 'rgba(91,158,212,0.08)', border: '1px solid rgba(91,158,212,0.2)' }}>
                <div className="text-xs font-mono" style={{ color: '#5C5040' }}>Water store</div>
                <div className="text-sm font-display font-semibold" style={{ color: '#235E86' }}>{(totalLitres / 1000).toFixed(1)} kL</div>
              </div>
            </div>
          )}

          {/* Action buttons row */}
          <div className="flex gap-2">
            <button onClick={runReview} disabled={reviewing || !items.length}
              className="flex-1 py-2 rounded-xl text-xs font-display font-semibold transition-all"
              style={reviewing || !items.length ? { background: 'rgba(226,216,196,0.35)', border: '1px solid #E2D8C4', color: '#5C5040' } : { background: '#1F4D2B', color: '#F7F2E9', border: '1px solid #1F4D2B' }}>
              {reviewing ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin inline-block" /> Reviewing…</span> : <span className="flex items-center justify-center gap-1"><Sparkles size={14} className="inline mr-1" /> AI review</span>}
            </button>
            <button onClick={exportPNG} disabled={!items.length && !lines.length} className="px-3 py-2 rounded-xl text-xs font-mono transition-all" style={{ background: 'rgba(226,216,196,0.55)', border: '1px solid #E2D8C4', color: 'var(--text-secondary)' }} title="Export PNG">↓ PNG</button>
          </div>

          {/* Save button */}
          <div>
            <button
              onClick={handleSave}
              disabled={!items.length && !lines.length}
              className="w-full py-2 rounded-xl text-xs font-display font-medium transition-all"
              style={!items.length && !lines.length
                ? { background: 'rgba(226,216,196,0.35)', border: '1px solid #E2D8C4', color: '#5C5040' }
                : { background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.22)', color: '#2D6B3C' }}>
              {savedMsg || '↓ Save design'}
            </button>
          </div>

          {/* Share to farmer (supervisor power) */}
          <div className="relative">
            <button onClick={() => { setShareOpen((o) => !o); setSharedTo(null); }} disabled={!items.length && !lines.length}
              className="w-full py-2 rounded-xl text-xs font-display font-medium transition-all"
              style={{ background: 'rgba(91,158,212,0.14)', border: '1px solid rgba(91,158,212,0.4)', color: '#235E86' }}>
              ↗ Share this design with a farmer
            </button>
            {shareOpen && !sharedTo && (
              <div className="mt-1.5 rounded-xl p-2 space-y-1" style={{ background: 'rgba(226,216,196,0.35)', border: '1px solid #E2D8C4' }}>
                <div className="text-xs font-mono uppercase tracking-wider px-1 mb-1" style={{ color: '#5C5040' }}>
                  {farmersLoading ? 'Loading…' : 'Send to'}
                </div>
                {farmersLoading && (
                  <div className="text-xs font-display px-2 py-1" style={{ color: '#5C5040' }}>
                    <Loader2 size={14} className="animate-spin inline-block mr-1" /> Fetching farmers…
                  </div>
                )}
                {!farmersLoading && displayFarmers.map((f) => (
                  <button key={f.id}
                    onClick={() => { if (f.profile) { sendDesignToFarmer(f.profile); } else { setSharedTo(f.name); setShareOpen(false); } }}
                    disabled={sharing}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-display transition-all"
                    style={{ background: 'rgba(226,216,196,0.35)', border: '1px solid #E2D8C4', color: 'var(--text-secondary)' }}>
                    {sharing ? <Loader2 size={14} className="animate-spin inline-block mr-1" /> : <Sprout size={14} className="inline mr-1" />} {f.name}
                  </button>
                ))}
              </div>
            )}
            {sharedTo && (
              <div className="mt-1.5 rounded-xl px-3 py-2 text-xs font-display" style={{ background: 'rgba(31,77,43,0.08)', border: '1px solid rgba(31,77,43,0.20)', color: '#2D6B3C' }}>
                ✓ Sent to {sharedTo} — opens on their phone
              </div>
            )}
          </div>

          {review && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(31,77,43,0.04)', border: '1px solid rgba(31,77,43,0.12)' }}>
              {review.split('\n').map((line, i) => {
                if (!line.trim()) return null;
                if (line.startsWith('## ')) return <h4 key={i} className="text-xs font-display font-semibold mt-2 mb-1" style={{ color: '#C07A1E' }}>{line.replace('## ', '')}</h4>;
                if (/^\d+\.|^- |^• /.test(line)) return <div key={i} className="flex gap-1.5 text-xs font-display leading-relaxed" style={{ color: '#20190F' }}><span style={{ color: '#1F4D2B' }}>›</span><span>{line.replace(/^[-•]\s*|^\d+\.\s*/, '').replace(/\*\*/g, '')}</span></div>;
                return <p key={i} className="text-xs font-display leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{line.replace(/\*\*/g, '')}</p>;
              })}
              {reviewing && <span className="inline-block w-1.5 h-3 rounded-sm animate-pulse" style={{ background: '#2D6B3C' }} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile: scrim + drawer toggle buttons (hidden on desktop) ── */}
      {mobilePanel && (
        <div className="md:hidden absolute inset-0 z-20" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setMobilePanel(null)} aria-hidden="true" />
      )}
      <div className="md:hidden absolute bottom-4 left-0 right-0 z-40 flex justify-between px-4 pointer-events-none">
        <button onClick={() => setMobilePanel((p) => (p === 'palette' ? null : 'palette'))}
          className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-display font-semibold active:scale-95 transition-transform"
          style={{ background: '#FBF6EC', border: '1px solid rgba(31,77,43,0.40)', color: '#2D6B3C', boxShadow: '0 2px 8px rgba(31,77,43,0.15)' }}>
          {mobilePanel === 'palette' ? '✕ Close' : '🧩 Elements'}
        </button>
        <button onClick={() => setMobilePanel((p) => (p === 'props' ? null : 'props'))}
          className="pointer-events-auto flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-display font-semibold active:scale-95 transition-transform"
          style={{ background: '#FBF6EC', border: '1px solid rgba(91,158,212,0.5)', color: '#235E86', boxShadow: '0 2px 8px rgba(35,94,134,0.15)' }}>
          {mobilePanel === 'props' ? '✕ Close' : '📋 Plan'}
        </button>
      </div>
    </div>
  );
}
