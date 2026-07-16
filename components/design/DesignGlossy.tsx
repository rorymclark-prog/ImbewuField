'use client';

// Design Studio — the STRICT final "glossy" render. Composites the farmer's exact
// design (satellite + zones + lines + items) into an image, builds a protect-mask that
// pixel-locks every farmer feature, then sends both to the AI render pipeline so the AI
// may only repaint background texture — never move, add, or remove anything the farmer
// placed.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Gem, FlaskConical, Images, X } from 'lucide-react';

import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { ZONE_DEFS } from '@/lib/design-elements';
import { requestRender, stripDataUrl, pollFalRender } from '@/lib/ai-render-client';
import { compositeAccurateMap, type LabelStyle, type ProducerLabel } from '@/lib/image-producer';

const PAPER = '#FFFEFA';
const GOLD = '#F7C97E';
const GREEN = '#1F4D2B';
const OCHRE = '#C07A1E';
const DARK = '#0B120B';

const STRICT_MAP_CRITERIA = {
  mustInclude: [
    'the traced property boundary, house roof, and driveway exactly where the farmer drew them',
    'north-up orientation with no rotation',
    'only on-map labels placed directly on or touching the feature they name',
    'the exact framing and aspect of the source image, repainted edge to edge — no crop, no zoom, no rotation, no borders',
  ],
  mustAvoid: [
    'invented buildings, paths, trees, beds, ponds, or decorations',
    'legends, keys, side panels, title cards, or borders',
    '3D perspective, tilt, or a redesign of the site',
    'labels stacked in a column with long leader lines',
    'changing the shape, size or position of ANY drawn outline, line or coloured area — drawn geometry is final',
    'painting any zone colour, canopy or texture beyond the edge of the drawn shape it belongs to',
  ],
  labelPolicy: [
    'use short dark pills only',
    'keep every label attached to the correct feature',
  ],
  composition: [
    'the real satellite image stays dominant',
    'only the unprotected background is repainted',
    'all locked geometry remains pixel-identical',
  ],
} as const;

const STRICT_PROMPT =
  'Repaint the editable ground — the open ground AND the inside of the drawn zone areas — as a ' +
  'beautiful hand-illustrated permaculture map (soft earth tones, gentle textures, subtle ' +
  'grass/soil/planting detail). Keep every drawn OUTLINE, LINE, ICON and LABEL exactly where and ' +
  'how it is — do NOT move, resize, reshape or duplicate them — but you MAY add gentle illustration ' +
  'and colour INSIDE the shapes. Follow the strict map criteria.';

// Per-layer theming. HARD RULE: a theme may only style the EDITABLE BACKGROUND (palette, mood,
// ground texture, labels beside features). It must NEVER instruct the model to draw, render,
// move, resize or rearrange any feature — the farmer's drawn marks are final geometry. (This
// rule is why an earlier "render each zone as a coloured band" version made gpt-image-2 redraw
// the zones and drift the boundaries — see docs/GLOSSY-PROMPT-AUDIT.md.)
const FILTER_THEME: Record<GlossyLayerFilter, { title: string; focus: string; emphasise: string[] }> = {
  all: {
    title: 'whole-farm permaculture design',
    focus: 'a beautiful hand-illustrated permaculture map (soft earth tones, gentle textures, subtle grass/soil detail)',
    emphasise: [],
  },
  water: {
    title: 'water plan',
    focus: 'a WATER-PLAN background: cool blue-green ground wash and damp soil tones on the open ground, so the blue water marks already drawn on the image stand out',
    emphasise: [
      'tint the editable open ground with a soft blue-green wash so the map reads as a water plan',
      'every blue mark already drawn (tank circles, swale/pipe/drip lines, ponds) stays exactly as drawn — brighten the ground AROUND each one, never redraw, thicken, move or duplicate the mark itself',
      'add one short label pill BESIDE (never covering) each drawn water mark, naming it',
    ],
  },
  zones: {
    title: 'zone map',
    focus: 'a ZONE-MAP background: calm, slightly desaturated ground texture so the coloured zone shapes already painted on the image are the loudest thing on the map',
    emphasise: [
      'the coloured shapes already painted on the image ARE the zones — their painted outlines are final; do not move, bend, extend, shrink or re-cut any of them, and never paint any zone colour OUTSIDE a painted outline or past the property boundary',
      'you MAY illustrate richly INSIDE each zone outline (gentle planting texture, soil/grass detail in the zone colour) — just keep the outline and its shape exactly',
      'do not add any zone that is not already painted, and do not rearrange zones around the house — the farmer chose where each zone is',
      'add one small numbered badge inside each painted zone shape, matching the number shown on it',
    ],
  },
  planting: {
    title: 'planting plan',
    focus: 'a PLANTING-PLAN background: lush green growing ground texture on the open soil BETWEEN the drawn features',
    emphasise: [
      'the circles and rectangles already drawn ARE the trees and beds — keep every one at exactly its drawn size and position; do not enlarge canopies, do not regroup beds into rows, do not add plants anywhere',
      'style only the open ground between the drawn features with a rich, green, growing feel',
    ],
  },
  structures: {
    title: 'structures & animals plan',
    focus: 'a STRUCTURES-PLAN background: calm neutral paper-like ground tones so the drawn footprints read clearly',
    emphasise: [
      'the drawn footprints ARE the structures — keep each exactly where and how it is drawn; do not add roofs, sheds, pens or paths anywhere else',
      'add one short label pill BESIDE each drawn footprint, naming it',
    ],
  },
};

function strictPromptFor(filter: GlossyLayerFilter): string {
  const theme = FILTER_THEME[filter];
  if (filter === 'all') return STRICT_PROMPT;
  return (
    `Repaint ONLY the unprotected background in the style of ${theme.focus}. ` +
    'Every shape, line, coloured area and icon already visible in the source image was drawn by the farmer and is FINAL GEOMETRY: ' +
    'do NOT add, move, remove, resize, reshape or restyle any of them — style the ground around them only. ' +
    'The output must overlay the source image exactly: same framing, same north-up orientation, every drawn feature in the same pixels. ' +
    'Follow the strict map criteria.'
  );
}

function mapCriteriaFor(filter: GlossyLayerFilter) {
  const theme = FILTER_THEME[filter];
  return {
    // Geometry-preservation criteria FIRST, theme styling last (recency should not favour theming).
    mustInclude: [...STRICT_MAP_CRITERIA.mustInclude, ...theme.emphasise],
    mustAvoid: STRICT_MAP_CRITERIA.mustAvoid,
    labelPolicy: STRICT_MAP_CRITERIA.labelPolicy,
    composition: STRICT_MAP_CRITERIA.composition,
  };
}

const LINE_COLORS: Record<string, string> = {
  swale: '#4EA6D8',
  fence: '#8C8577',
  path: '#C9A227',
  pipe: '#2B6FA6',
  drip: '#4E8B3B',
  windbreak: '#2F7A4A',
};

// Per-layer glossy: 'all' = the whole design; the others render just one theme (with the
// base map + ground context always kept so the picture is legible). Only the drawn marks in
// the chosen layer are locked; everything else is repainted as background.
export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures';

const ENGINES: Array<{ key: 'falgpt' | 'gemini'; label: string; sub: string }> = [
  { key: 'falgpt', label: 'gpt-image-2', sub: 'best overall' },
  { key: 'gemini', label: 'Gemini Pro', sub: 'may retire' },
];

const GLOSSY_FILTERS: Array<{ key: GlossyLayerFilter; label: string }> = [
  { key: 'all', label: 'Whole design' },
  { key: 'water', label: 'Water' },
  { key: 'zones', label: 'Zones' },
  { key: 'planting', label: 'Planting' },
  { key: 'structures', label: 'Structures' },
];

// Analysis map styles — the richer report-style maps (the "8-map pack"). These are illustrated
// / analytical (sun & wind arrows, opportunity notes, phased build-out) that the strict
// gpt-image-2 mask-edit can't draw, so they always render via the Gemini generative path with
// the matching `layer` theme (see app/api/ai-render/route.ts layerTheme). `layer` values are
// valid RenderLayer strings on the API side.
type AnalysisStyle = 'sector' | 'base' | 'opportunity' | 'implementation';
const GLOSSY_STYLES: Array<{ key: AnalysisStyle; label: string }> = [
  { key: 'sector', label: 'Sun & Wind (sector)' },
  { key: 'base', label: "What's here now" },
  { key: 'opportunity', label: 'Opportunities' },
  { key: 'implementation', label: 'Implementation' },
];
const STYLE_TITLE: Record<AnalysisStyle, string> = {
  sector: 'sun & wind (sector analysis)',
  base: 'existing site map',
  opportunity: 'opportunities map',
  implementation: 'implementation plan',
};

// ── Illustrated "producer" styles — the superior image-producer pipeline ──────
// These render via app/api/image-producer + lib/image-producer's compositeAccurateMap:
// the model beautifies the whole scene, then we deterministically composite (satellite
// everywhere → clip the model to the boundary → stroke the boundary → burn true labels),
// so accuracy is guaranteed by construction. Four researched site-plan styles.
const PRODUCER_STYLES: Array<{ key: string; label: string; blurb: string; labelStyle: LabelStyle }> = [
  { key: 'field_ledger',        label: 'Field Ledger',        blurb: 'hand-inked surveyor plan',      labelStyle: 'ink' },
  { key: 'homestead_storybook', label: 'Homestead Storybook', blurb: 'warm illustrated garden map',   labelStyle: 'storybook' },
  { key: 'extension_blueprint', label: 'Extension Blueprint', blurb: 'clean plan for funders/mentors', labelStyle: 'blueprint' },
  { key: 'karoo_folk',          label: 'Karoo Folk Map',      blurb: 'bold folk-art farm map',         labelStyle: 'folk' },
];

function itemInFilter(category: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      return category === 'water';
    case 'planting':
      return category === 'growing';
    case 'structures':
      return category === 'structure' || category === 'animal' || category === 'access';
    case 'zones':
      return false;
  }
}

function lineInFilter(kind: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      return kind === 'swale' || kind === 'pipe' || kind === 'drip';
    case 'structures':
      return kind === 'fence' || kind === 'path' || kind === 'windbreak';
    default:
      return false;
  }
}

function zonesInFilter(filter: GlossyLayerFilter): boolean {
  return filter === 'all' || filter === 'zones';
}

export interface DesignGlossyProps {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: {
    boundary: Array<[number, number]>;
    house: Array<[number, number]>;
    driveway: Array<[number, number]>;
  };
  site: { biome?: string; rainfallMm?: number } | null;
  placeName?: string;
  // Seed the layer selector (e.g. a per-step "Preview this map" opener). Defaults to 'all'.
  initialFilter?: GlossyLayerFilter;
}

const SCALE = 2;

function drawMarks(ctx: CanvasRenderingContext2D, state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], imgW: number, imgH: number, filter: GlossyLayerFilter = 'all', drawDesign = true) {
  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;

  // Boundary ring
  if (refLayers.boundary.length >= 3) {
    ctx.beginPath();
    refLayers.boundary.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.strokeStyle = 'rgba(140,235,106,0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // House ring
  if (refLayers.house.length >= 3) {
    ctx.beginPath();
    refLayers.house.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(58,53,44,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,53,44,0.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Driveway
  if (refLayers.driveway.length >= 2) {
    ctx.beginPath();
    refLayers.driveway.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.strokeStyle = 'rgba(217,145,51,0.85)';
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  // Zones — translucent fill (only when this layer is in the chosen filter, and design marks
  // are wanted — analysis maps like sector/base draw NO design overlay so Gemini renders clean)
  for (const zone of drawDesign && zonesInFilter(filter) ? state.zones : []) {
    if (zone.points.length < 3 || zone.feature) continue; // skip ground-feature areas — not effort-zones
    const def = ZONE_DEFS[zone.zone];
    ctx.beginPath();
    zone.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    // On the dedicated zones map the interior is mask-locked, so make the composite's own zone
    // fill strong + add a number badge — the protected interior then already looks like the
    // finished zone map and the model only touches the ground outside.
    ctx.fillStyle = `${def.color}${filter === 'zones' ? '59' : '33'}`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}CC`;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (filter === 'zones') {
      const cx = px(zone.points.reduce((s, p) => s + p[0], 0) / zone.points.length);
      const cy = py(zone.points.reduce((s, p) => s + p[1], 0) / zone.points.length);
      ctx.beginPath();
      ctx.arc(cx, cy, 15, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(String(zone.zone), cx, cy);
    }
  }

  // Lines
  for (const line of drawDesign ? state.lines : []) {
    if (line.points.length < 2 || !lineInFilter(line.kind, filter)) continue;
    ctx.beginPath();
    line.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.strokeStyle = LINE_COLORS[line.kind] ?? '#8C8577';
    ctx.lineWidth = line.kind === 'fence' ? 2 : 4;
    if (line.kind === 'fence') ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Items — footprint + emoji label. NB: this canvas may be SCALE× the logical frame
  // (imgW = frame.imgW × SCALE), so convert metres → CANVAS px via the canvas's own
  // width — sizing in logical px here would draw every footprint at half scale.
  const pxPerM = imgW / (frame.imgW * frame.mPerPx);
  for (const item of drawDesign ? state.items : []) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const wM = item.wM ?? def.wM;
    const hM = item.hM ?? def.hM;
    const wLogical = wM * pxPerM;
    const hLogical = hM * pxPerM;
    const cx = px(item.x);
    const cy = py(item.y);
    ctx.fillStyle = `${def.color}55`;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, wLogical / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Rect strips/beds/rows can be rotated in the studio — mirror that here about the
      // footprint centre so the glossy matches exactly. Icon is drawn upright afterwards.
      const rot = def.shape === 'rect' ? item.rot ?? 0 : 0;
      ctx.save();
      ctx.translate(cx, cy);
      if (rot) ctx.rotate((rot * Math.PI) / 180);
      ctx.beginPath();
      ctx.rect(-wLogical / 2, -hLogical / 2, wLogical, hLogical);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.font = `${Math.max(14, Math.min(28, wLogical * 0.6))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0B120B';
    ctx.fillText(def.icon, cx, cy);
  }
}

async function buildComposite(state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], filter: GlossyLayerFilter = 'all', drawDesign = true): Promise<string> {
  const imgW = frame.imgW * SCALE;
  const imgH = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.drawImage(img, 0, 0, imgW, imgH);
  } else {
    ctx.fillStyle = '#CBB98A';
    ctx.fillRect(0, 0, imgW, imgH);
  }

  drawMarks(ctx, state, frame, refLayers, imgW, imgH, filter, drawDesign);

  // PNG (not JPEG): the render must key on the thin drawn geometry lines, and JPEG ringing
  // softens them. The route wraps this as image/png — keep the formats in lockstep.
  return canvas.toDataURL('image/png');
}

async function buildProtectMask(state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], filter: GlossyLayerFilter = 'all'): Promise<string> {
  const imgW = frame.imgW * SCALE;
  const imgH = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  // Fully transparent = editable everywhere, by default.
  ctx.clearRect(0, 0, imgW, imgH);

  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';

  // Whole house polygon protected.
  if (refLayers.house.length >= 3) {
    ctx.beginPath();
    refLayers.house.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fill();
  }

  // Protect ALL land OUTSIDE the property boundary (all filters). Even-odd fill = the whole
  // canvas rect minus the boundary polygon → pins the boundary from the outside and stops the
  // model repainting the neighbours' land or re-cutting the fence line. See GLOSSY-PROMPT-AUDIT §2.3.
  if (refLayers.boundary.length >= 3) {
    ctx.beginPath();
    ctx.rect(0, 0, imgW, imgH);
    refLayers.boundary.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fill('evenodd');
  }

  // Boundary ring stroke band (pins it from the inside too).
  if (refLayers.boundary.length >= 3) {
    ctx.beginPath();
    refLayers.boundary.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.lineWidth = 8 * SCALE;
    ctx.stroke();
  }

  // Driveway stroke band.
  if (refLayers.driveway.length >= 2) {
    ctx.beginPath();
    refLayers.driveway.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.lineWidth = 10 * SCALE;
    ctx.stroke();
  }

  // Zones — lock only the OUTLINE band, never the interior. Locking the whole fill made the
  // model unable to illustrate inside a zone → flat, plain outline maps. The edge band + the
  // outside-boundary protection + "stay inside the outline" prompt hold the shape while the
  // interior stays free for rich illustration. (Reverted the interior fill-lock, 1871db9→.)
  for (const zone of zonesInFilter(filter) ? state.zones : []) {
    if (zone.points.length < 3 || zone.feature) continue; // ground-feature areas aren't effort-zones
    ctx.beginPath();
    zone.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.lineWidth = 10 * SCALE; // a little wider so the locked outline reads clearly
    ctx.stroke();
  }

  // Line strokes.
  for (const line of state.lines) {
    if (line.points.length < 2 || !lineInFilter(line.kind, filter)) continue;
    ctx.beginPath();
    line.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.lineWidth = 10 * SCALE;
    ctx.stroke();
  }

  // Item footprints (+25% margin). Same canvas-scale-aware conversion as the composite:
  // metres → CANVAS px (the mask is SCALE× the logical frame, and it MUST protect the
  // full true-scale footprint, not half of it).
  const maskPxPerM = imgW / (frame.imgW * frame.mPerPx);
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const wM = (item.wM ?? def.wM) * 1.25;
    const hM = (item.hM ?? def.hM) * 1.25;
    const wLogical = wM * maskPxPerM;
    const hLogical = hM * maskPxPerM;
    const cx = px(item.x);
    const cy = py(item.y);
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, wLogical / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Match the rotated footprint so the protect-mask covers exactly what's drawn.
      const rot = item.rot ?? 0;
      ctx.save();
      ctx.translate(cx, cy);
      if (rot) ctx.rotate((rot * Math.PI) / 180);
      ctx.beginPath();
      ctx.rect(-wLogical / 2, -hLogical / 2, wLogical, hLogical);
      ctx.fill();
      ctx.restore();
    }
  }

  return canvas.toDataURL('image/png');
}

// Rough compass bucket for a normalised [0..1] point relative to the property centre,
// used to give Gemini a plain-English location hint for each placed element.
function compass8(x: number, y: number): string {
  const dx = x - 0.5;
  const dy = y - 0.5;
  if (Math.hypot(dx, dy) < 0.12) return 'central';
  const angle = Math.atan2(dx, -dy); // 0 = N, clockwise
  const deg = (angle * (180 / Math.PI) + 360) % 360;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

// ── image-producer helpers (adapted from FacilitatorCanvas) ───────────────────

// POST the composited scene to the image-producer route and get the beautified image.
// The route is engine-agnostic; we always use the gemini engine here (its bare-base64
// {image} path). The openai engine's async fal-queue {pending} branch is handled too,
// exactly like FacilitatorCanvas.requestProducer, in case it is ever switched on.
async function requestProducer(
  imageBase64: string,
  layerLabel: string,
  elementsText: string,
  stylePreset: string,
): Promise<string> {
  const res = await fetch('/api/image-producer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      layerLabel,
      elementsText,
      stylePreset,
      model: 'pro-preview',
      mapKind: 'full',
      engine: 'gemini',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.pending && data.statusUrl && data.responseUrl) {
    return pollFalRender(data.statusUrl, data.responseUrl);
  }
  if (!res.ok || !data.image) {
    throw new Error(data.error || `Producer failed (${res.status})`);
  }
  return data.image as string; // bare base64 (compositeAccurateMap's asDataUrl normalises it)
}

// Short comma list of placed element names + counts, e.g. "🥬 Vegetable Bed ×6, 🛢 JoJo Tank".
function producerElementsText(state: DesignCanvasState): string {
  const counts = new Map<string, { icon: string; n: number }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    const name = it.label ?? def.name;
    const g = counts.get(name) ?? { icon: def.icon, n: 0 };
    g.n += 1;
    counts.set(name, g);
  }
  return [...counts.entries()].map(([name, g]) => `${g.icon} ${name}${g.n > 1 ? ` ×${g.n}` : ''}`).join(', ');
}

// True labels burned onto the produced map: one pill per element-name group at the group's
// centroid (OUTPUT px). SIMPLIFIED vs FacilitatorCanvas — no left/right column split, just a
// short leader from the cluster to a pill placed above-left of it, clamped inside the WxH
// frame so nothing is cropped. (Refine later toward the facilitator's column layout.)
function producerLabels(state: DesignCanvasState, W: number, H: number): ProducerLabel[] {
  const groups = new Map<string, { xs: number[]; ys: number[]; icon: string }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    const name = it.label ?? def.name;
    const g = groups.get(name) ?? { xs: [], ys: [], icon: def.icon };
    g.xs.push(it.x);
    g.ys.push(it.y);
    groups.set(name, g);
  }
  const fs = 26, padX = 14;
  const out: ProducerLabel[] = [];
  for (const [name, g] of groups) {
    const n = g.xs.length;
    const cx = (g.xs.reduce((a, b) => a + b, 0) / n) * W;
    const cy = (g.ys.reduce((a, b) => a + b, 0) / n) * H;
    const text = `${g.icon} ${name}${n > 1 ? ` ×${n}` : ''}`;
    // Rough pill width (burnLabels measures exactly at 600 26px; this only needs to keep the
    // pill in-frame, so an estimate is fine): 2·padX + ~0.6·fs per char.
    const pillW = Math.min(W - 28, padX * 2 + text.length * fs * 0.6);
    const ax = Math.max(14, Math.min(W - pillW - 14, cx - pillW - 20));
    const ay = Math.max(40, Math.min(H - 40, cy - 30));
    const lx = ax + pillW; // leader meets the pill's inner (right) edge
    out.push({ cx, cy, ax, ay, lx, text });
  }
  return out;
}

// ── Persistence — cache the last render per site so a page refresh doesn't lose it.
// dataURLs can be large; localStorage has a quota, so writes are best-effort.
interface SavedGlossy {
  image: string;
  provider: 'gemini' | 'falgpt';
  at: string;
}

// 'all' keeps the original site-scoped key (so existing saved renders survive); each other
// layer gets its own suffixed key so per-layer renders don't overwrite each other.
const glossyKey = (siteId: string, mapKey: string = 'all') =>
  mapKey === 'all' ? `imbewu_design_glossy_${siteId}` : `imbewu_design_glossy_${siteId}_${mapKey}`;

function loadSavedGlossy(siteId: string, mapKey: string = 'all'): SavedGlossy | null {
  try {
    const raw = localStorage.getItem(glossyKey(siteId, mapKey));
    if (!raw) return null;
    return JSON.parse(raw) as SavedGlossy;
  } catch {
    return null;
  }
}

function saveGlossy(siteId: string, mapKey: string, saved: SavedGlossy) {
  try {
    localStorage.setItem(glossyKey(siteId, mapKey), JSON.stringify(saved));
  } catch {
    // QuotaExceededError or similar — skip persisting, non-fatal.
  }
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const PROVIDER_LABEL: Record<'gemini' | 'falgpt', string> = {
  gemini: 'Gemini Pro',
  falgpt: 'gpt-image-2',
};

export default function DesignGlossy({ state, frame, refLayers, site, placeName, initialFilter }: DesignGlossyProps) {
  const [loading, setLoading] = useState<'gemini' | 'falgpt' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGlossy | null>(null);
  const [filter, setFilter] = useState<GlossyLayerFilter>(initialFilter ?? 'all');
  // When set, an analysis map style is chosen instead of a design-layer filter — it always
  // renders via Gemini's generative path (see GLOSSY_STYLES). null = a design-layer map.
  const [analysisStyle, setAnalysisStyle] = useState<AnalysisStyle | null>(null);
  // When set, an illustrated "producer" style is chosen — renders via the boundary-locked
  // image-producer pipeline (compositeAccurateMap). null = a design/analysis map.
  const [producerStyle, setProducerStyle] = useState<string | null>(null);
  // Render engine — both experimental. gpt-image-2 (default, best overall) + Gemini Pro
  // (kept for comparison; may be retired after more experimenting).
  const [engine, setEngine] = useState<'falgpt' | 'gemini'>('falgpt');
  // Session-only gallery of every successful render (producer OR the strict/analysis paths).
  // Never persisted — kept only until the component unmounts.
  const [gallery, setGallery] = useState<Array<{ id: string; label: string; image: string }>>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryViewId, setGalleryViewId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A stable cache key per chosen map (producer style OR design filter OR analysis style).
  // Each map+style combination caches its own render (e.g. producer:storybook:zones).
  const mapKey = producerStyle ? `producer:${producerStyle}:${filter}` : (analysisStyle ?? filter);
  const galleryViewItem = gallery.find((g) => g.id === galleryViewId) ?? null;

  const pushGallery = useCallback((label: string, image: string) => {
    setGallery((prev) => [
      ...prev,
      { id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label, image },
    ]);
  }, []);

  // Load the cached render for this site + chosen map. Runs on mount and whenever the map
  // changes, so each map keeps its own last render.
  useEffect(() => {
    const cached = loadSavedGlossy(state.siteId, mapKey);
    setSaved(cached);
    setResultImage(cached ? cached.image : null);
    setError(null);
    // Only re-check when the site or chosen map changes, not on every state edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.siteId, mapKey]);

  const generate = useCallback(
    async (provider: 'gemini' | 'falgpt') => {
      // Analysis styles are illustrated/analytical maps only Gemini can draw — force Gemini and
      // composite ALL geometry as context (they show the whole site, not one design layer).
      const isAnalysis = analysisStyle !== null;
      const useProvider = isAnalysis ? 'gemini' : provider;
      const compositeFilter: GlossyLayerFilter = isAnalysis ? 'all' : filter;
      // Sun & Wind (sector) and What's-here (base) are pure analysis — draw NO design overlay so
      // they don't come out as a zone map with a sun compass tacked on (Rory: "it combined
      // sector and zone"). Opportunities/Implementation build on the design, so keep it.
      const drawDesign = !(analysisStyle === 'sector' || analysisStyle === 'base');
      setLoading(useProvider);
      setError(null);
      try {
        const composite = await buildComposite(state, frame, refLayers, compositeFilter, drawDesign);
        let image: string;
        if (useProvider === 'falgpt') {
          const mask = await buildProtectMask(state, frame, refLayers, filter);
          image = await requestRender({
            imageBase64: stripDataUrl(composite),
            maskBase64: stripDataUrl(mask),
            provider: 'falgpt',
            context: {
              strictMap: true,
              mapType: FILTER_THEME[filter].title,
              mapCriteria: mapCriteriaFor(filter),
            },
            touchupPrompt: strictPromptFor(filter),
          });
        } else {
          const placedElements = state.items
            .filter((item) => {
              const def = ELEMENTS_BY_ID[item.defId];
              return def && itemInFilter(def.category, compositeFilter);
            })
            .map((item) => {
              const def = ELEMENTS_BY_ID[item.defId];
              return {
                type: item.defId,
                label: item.label ?? def?.name ?? item.defId,
                note: item.note,
                locationHint: `${compass8(item.x, item.y)} part of the property`,
              };
            });
          const zones = zonesInFilter(compositeFilter)
            ? state.zones.filter((z) => !z.feature).map((z) => ({ n: z.zone, title: ZONE_DEFS[z.zone].label }))
            : [];
          const polygons = state.lines.filter((l) => lineInFilter(l.kind, compositeFilter)).map((l) => ({ name: l.kind, type: 'line' }));
          // Analysis style → its own RenderLayer theme; design filter → the layer it maps to.
          // IMPORTANT: the API's layerTheme cases are 'overall'|'water'|'zone'|'planting'|… —
          // NOT the plural GlossyLayerFilter keys. Passing 'zones'/'structures' fell through to
          // the full-design theme, which invents ponds/orchards + a sun compass on the zones map.
          const FILTER_TO_LAYER: Record<GlossyLayerFilter, string> = {
            all: 'overall',
            water: 'water',
            zones: 'zone',
            planting: 'planting',
            structures: 'overall',
          };
          const layer = analysisStyle ?? FILTER_TO_LAYER[filter];
          image = await requestRender({
            imageBase64: stripDataUrl(composite),
            satBase64: frame.satDataUrl ? stripDataUrl(frame.satDataUrl) : undefined,
            provider: 'gemini',
            geminiModel: 'pro-preview',
            context: {
              placeName,
              layer,
              mapType: analysisStyle ? STYLE_TITLE[analysisStyle] : FILTER_THEME[filter].title,
              mapFocus: analysisStyle ? undefined : FILTER_THEME[filter].focus,
              biome: site?.biome,
              rainfallMm: site?.rainfallMm,
              placedElements,
              zones,
              polygons,
            },
          });
        }
        const finalImage = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;
        setResultImage(finalImage);
        const record: SavedGlossy = { image: finalImage, provider: useProvider, at: new Date().toISOString() };
        saveGlossy(state.siteId, mapKey, record);
        setSaved(record);
        const mapLabel = analysisStyle
          ? `${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label ?? 'Analysis'} map`
          : filter === 'all'
            ? 'Whole design'
            : `${GLOSSY_FILTERS.find((f) => f.key === filter)?.label ?? filter} map`;
        pushGallery(mapLabel, finalImage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Render failed.');
      } finally {
        setLoading(null);
      }
    },
    [state, frame, refLayers, site, placeName, filter, analysisStyle, mapKey, pushGallery],
  );

  // Producer render path — the boundary-locked image-producer pipeline. The model beautifies
  // the whole design composite; we then composite deterministically (satellite outside the
  // boundary, model clipped inside, crisp boundary, burned true labels) so the result is
  // beautiful AND accurate by construction.
  const generateProducer = useCallback(async () => {
    if (!producerStyle) return;
    const styleDef = PRODUCER_STYLES.find((s) => s.key === producerStyle);
    if (!styleDef) return;
    setLoading('gemini');
    setError(null);
    try {
      const W = frame.imgW * SCALE;
      const H = frame.imgH * SCALE;
      // Style renders the CURRENTLY-CHOSEN design layer (Whole design / Water / Zones / …) —
      // so "Zones + Homestead Storybook" illustrates just the zones in that style.
      const layerLabel = filter === 'all' ? 'Full design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label ?? 'Full design';
      // a. Model input — the composite for the chosen layer.
      const composite = await buildComposite(state, frame, refLayers, filter);
      // b. Short comma list of placed elements + counts.
      const elementsText = producerElementsText(state);
      // c. Beautify via the image-producer route (gemini engine; async path handled inside).
      const modelImage = await requestProducer(stripDataUrl(composite), layerLabel, elementsText, producerStyle);
      // d. Boundary → flat OUTPUT-px ring (the normalised ring just multiplies by W/H).
      const boundaryPx =
        refLayers.boundary.length >= 3
          ? refLayers.boundary.flatMap(([x, y]) => [x * W, y * H])
          : undefined;
      // e. True labels (one pill per element-name group at its centroid).
      const labels = producerLabels(state, W, H);
      // f. Deterministic composite-back — accuracy guaranteed by construction.
      const final = await compositeAccurateMap({
        modelImage,
        // Satellite is the ground truth OUTSIDE the boundary; fall back to the composite when
        // there's no satellite so the map is never left blank/transparent there.
        satelliteImage: frame.satDataUrl ?? composite,
        boundaryPx,
        labels,
        labelStyle: styleDef.labelStyle,
        width: W,
        height: H,
      });
      // g. Show, cache (mapKey = producer:<style>) and add to the session gallery.
      setResultImage(final);
      const record: SavedGlossy = { image: final, provider: 'gemini', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      pushGallery(`${layerLabel} · ${styleDef.label}`, final);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [producerStyle, filter, state, frame, refLayers, mapKey, pushGallery]);

  const handleDownload = useCallback(() => {
    if (!resultImage) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `imbewu-design-${placeName ?? 'site'}.png`.replace(/[^a-z0-9.\-]+/gi, '_');
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = resultImage;
  }, [resultImage, placeName]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        background: PAPER,
        color: DARK,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Beta / experimental notice — the AI render is not reliable yet; set expectations up front. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          background: 'rgba(192,122,30,0.12)',
          border: '1px solid rgba(192,122,30,0.4)',
        }}
      >
        <FlaskConical size={18} color={OCHRE} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, lineHeight: 1.45, color: DARK }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: PAPER,
              background: OCHRE,
              borderRadius: 6,
              padding: '2px 7px',
              marginRight: 6,
            }}
          >
            Beta · Experimental
          </span>
          The glossy map is an experiment — the AI isn&apos;t reliable enough yet to depend on. It
          may get things wrong, and you often need to <strong>generate a few times</strong> before
          you get a decent result. Your actual design (the canvas) is always the exact version.
        </div>
      </div>

      {/* Which map? — a design-overlay layer (locks your geometry) OR a richer analysis style. */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
          Design maps
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GLOSSY_FILTERS.map((f) => {
            // A design layer stays selected even with an illustrated style chosen — the two
            // combine (e.g. Zones + Homestead Storybook). Analysis maps override the layer.
            const active = analysisStyle === null && filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => { setFilter(f.key); setAnalysisStyle(null); }}
                disabled={loading !== null}
                aria-pressed={active}
                style={{
                  minHeight: 38,
                  padding: '6px 14px',
                  borderRadius: 19,
                  border: active ? `2px solid ${GREEN}` : '1px solid rgba(0,0,0,0.18)',
                  background: active ? GREEN : 'transparent',
                  color: active ? PAPER : DARK,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading !== null ? 'default' : 'pointer',
                  opacity: loading !== null && !active ? 0.5 : 1,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, margin: '12px 0 6px' }}>
          Analysis maps · Gemini
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GLOSSY_STYLES.map((s) => {
            const active = producerStyle === null && analysisStyle === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => { setAnalysisStyle(s.key); setProducerStyle(null); }}
                disabled={loading !== null}
                aria-pressed={active}
                style={{
                  minHeight: 38,
                  padding: '6px 14px',
                  borderRadius: 19,
                  border: active ? `2px solid ${OCHRE}` : '1px solid rgba(0,0,0,0.18)',
                  background: active ? OCHRE : 'transparent',
                  color: active ? PAPER : DARK,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading !== null ? 'default' : 'pointer',
                  opacity: loading !== null && !active ? 0.5 : 1,
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Illustrated styles — the boundary-locked image-producer pipeline (beautiful AND
            accurate). These COMBINE with the chosen Design map above (e.g. Zones + Storybook). */}
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, margin: '12px 0 6px' }}>
          Style · illustrated {producerStyle && analysisStyle === null ? `(on your ${filter === 'all' ? 'whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map)` : '· tap a Design map + a style'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRODUCER_STYLES.map((s) => {
            const active = producerStyle === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => { setProducerStyle(producerStyle === s.key ? null : s.key); setAnalysisStyle(null); }}
                disabled={loading !== null}
                aria-pressed={active}
                title={s.blurb}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  minHeight: 38,
                  padding: '6px 14px',
                  borderRadius: 19,
                  border: active ? `2px solid ${GREEN}` : '1px solid rgba(0,0,0,0.18)',
                  background: active ? GREEN : 'transparent',
                  color: active ? PAPER : DARK,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading !== null ? 'default' : 'pointer',
                  opacity: loading !== null && !active ? 0.5 : 1,
                }}
              >
                <span>{s.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, opacity: active ? 0.85 : 0.55 }}>{s.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!resultImage && (
        <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
          {producerStyle
            ? `Generate your ${filter === 'all' ? 'whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map in the ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} style — the polished pipeline. The model beautifies the scene, then your real satellite, boundary and labels are composited back on top, so it's beautiful AND accurate (boundary-locked by construction). Takes about a minute.`
            : analysisStyle
              ? `Generate the ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} analysis map — an illustrated Gemini render (sun/wind, opportunities, phasing) over your real site. These are freer than the design maps: great to look at, less exact on geometry. Takes about a minute.`
              : filter === 'all'
                ? 'Generate an artist’s impression of your whole design. It pixel-locks every item, zone and line you placed — only the background is repainted — so the picture stays true to your plan. Takes about a minute.'
                : `Generate a glossy map of just your ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} layer. The base map stays as context; only that layer is locked and drawn. Takes about a minute.`}
        </p>
      )}

      {resultImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              border: `4px solid ${GOLD}`,
              borderRadius: 16,
              overflow: 'hidden',
              background: DARK,
            }}
          >
            <div style={{ padding: '10px 14px', background: DARK, color: GOLD, fontWeight: 700, fontSize: 14 }}>
              {placeName ?? 'Your design'}
              {producerStyle
                ? ` · ${filter === 'all' ? 'Whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} · ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label}`
                : analysisStyle
                  ? ` · ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} map`
                  : filter !== 'all'
                    ? ` · ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map`
                    : ''}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resultImage} alt="AI artist's impression of the design" style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: '10px 14px', background: DARK, color: PAPER, fontSize: 12, opacity: 0.75 }}>
              AI artist&apos;s impression of YOUR design — the canvas is the exact version.
            </div>
          </div>
          {saved && resultImage === saved.image && (
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              Saved render · {relativeDate(saved.at)} · {PROVIDER_LABEL[saved.provider]}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 44,
                padding: '10px 18px',
                borderRadius: 12,
                border: 'none',
                background: GREEN,
                color: PAPER,
                fontWeight: 700,
              }}
            >
              <Download size={18} />
              Download
            </button>
            {gallery.length > 0 && (
              <button
                onClick={() => { setGalleryViewId(null); setGalleryOpen(true); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.18)',
                  background: 'transparent',
                  color: DARK,
                  fontWeight: 700,
                }}
              >
                <Images size={18} />
                Saved maps ({gallery.length})
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Engine picker — only for design maps. Analysis maps are drawn by Gemini (the strict
            gpt-image-2 mask-edit can't produce sun/wind arrows or opportunity annotations);
            illustrated Styles render via the boundary-locked image-producer pipeline. */}
        {producerStyle ? (
          <div style={{ fontSize: 11.5, opacity: 0.7 }}>
            Illustrated styles render via the polished pipeline (boundary-locked).
          </div>
        ) : analysisStyle ? (
          <div style={{ fontSize: 11.5, opacity: 0.7 }}>
            Analysis maps are drawn by <strong>Gemini Pro</strong>.
          </div>
        ) : (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
            Engine · both experimental
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ENGINES.map((e) => {
              const active = engine === e.key;
              return (
                <button
                  key={e.key}
                  type="button"
                  onClick={() => setEngine(e.key)}
                  disabled={loading !== null}
                  aria-pressed={active}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    minHeight: 44,
                    padding: '6px 14px',
                    borderRadius: 12,
                    border: active ? `2px solid ${GREEN}` : '1px solid rgba(0,0,0,0.18)',
                    background: active ? GREEN : 'transparent',
                    color: active ? PAPER : DARK,
                    cursor: loading !== null ? 'default' : 'pointer',
                    opacity: loading !== null && !active ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{e.label}</span>
                  <span style={{ fontSize: 10.5, opacity: active ? 0.85 : 0.6 }}>{e.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
        )}

        <button
          onClick={() => (producerStyle ? generateProducer() : generate(engine))}
          disabled={loading !== null}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 48,
            padding: '12px 22px',
            borderRadius: 12,
            border: 'none',
            background: GOLD,
            color: DARK,
            fontWeight: 800,
            fontSize: 15,
            cursor: loading !== null ? 'default' : 'pointer',
            opacity: loading !== null ? 0.7 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {resultImage ? <RefreshCw size={18} /> : <Gem size={18} />}
          {loading !== null
            ? 'Generating your map… 30–90s'
            : `${resultImage ? 'Regenerate' : 'Generate'} ${
                producerStyle
                  ? `my ${filter === 'all' ? '' : `${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} `}${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label}`
                  : analysisStyle
                    ? `my ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} map`
                    : filter === 'all'
                      ? 'my map'
                      : `my ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map`
              } (~1 min)`}
        </button>
        <div style={{ fontSize: 11, opacity: 0.6 }}>
          Using{' '}
          <strong>
            {producerStyle ? 'the polished pipeline' : analysisStyle ? 'Gemini Pro' : ENGINES.find((e) => e.key === engine)?.label}
          </strong>
          . If the result looks off, try generating again{producerStyle || analysisStyle ? '' : ' or switch engine'} — results vary shot to shot.
        </div>
        {!resultImage && gallery.length > 0 && (
          <button
            onClick={() => { setGalleryViewId(null); setGalleryOpen(true); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 40,
              padding: '8px 16px',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.18)',
              background: 'transparent',
              color: DARK,
              fontWeight: 700,
              fontSize: 13,
              alignSelf: 'flex-start',
              cursor: 'pointer',
            }}
          >
            <Images size={16} />
            Saved maps ({gallery.length})
          </button>
        )}
        {error && <p style={{ color: '#B53A3A', fontSize: 13 }}>{error}</p>}
      </div>

      {/* ── Saved-maps gallery (session-only) ── */}
      {galleryOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(20,16,10,0.55)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '90%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16,
              overflow: 'hidden',
              background: PAPER,
              border: '1px solid #E2D8C4',
              boxShadow: '0 12px 40px rgba(20,16,10,0.35)',
            }}
          >
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid #E2D8C4' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#9E5C08' }}>🖼 Saved maps ({gallery.length})</span>
              <button
                onClick={() => { setGalleryOpen(false); setGalleryViewId(null); }}
                aria-label="Close saved maps"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto' }}>
              {galleryViewItem ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={galleryViewItem.image} alt={galleryViewItem.label} style={{ width: '100%', borderRadius: 12, border: '1px solid #E2D8C4', display: 'block' }} />
                  <p style={{ fontSize: 13, color: '#5C5040', margin: 0 }}>{galleryViewItem.label}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={galleryViewItem.image}
                      download={`imbewu-${galleryViewItem.label.toLowerCase().replace(/[^a-z0-9.\-]+/g, '_')}.png`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, background: GREEN, color: PAPER, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                    >
                      <Download size={15} /> Download
                    </a>
                    <button
                      onClick={() => setGalleryViewId(null)}
                      style={{ padding: '8px 14px', borderRadius: 12, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      ‹ Back
                    </button>
                  </div>
                </div>
              ) : gallery.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9A8268', margin: 0 }}>No saved maps yet this session.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {gallery.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => setGalleryViewId(g.id)}
                        style={{ position: 'relative', padding: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid #E2D8C4', aspectRatio: '1 / 1', cursor: 'pointer', background: DARK }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={g.image} alt={g.label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9, padding: '2px 4px', background: 'rgba(20,16,10,0.6)', color: '#fff', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: '#9A8268', margin: 0 }}>Session-only — kept until you leave this screen.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
