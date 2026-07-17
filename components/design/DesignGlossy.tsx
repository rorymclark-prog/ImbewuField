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
  { key: 'falgpt', label: 'gpt-image-2', sub: 'best overall · slow (~5 min)' },
  { key: 'gemini', label: 'Gemini Pro', sub: 'faster (~1 min)' },
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

export function itemInFilter(category: string, filter: GlossyLayerFilter): boolean {
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

export function lineInFilter(kind: string, filter: GlossyLayerFilter): boolean {
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

export function zonesInFilter(filter: GlossyLayerFilter): boolean {
  return filter === 'all' || filter === 'zones';
}

export interface DesignGlossyProps {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: {
    boundary: Array<[number, number]>;
    house: Array<[number, number]>;
    driveway: Array<[number, number]>;
    drivewayClosed?: boolean; // driveway traced as an AREA (polygon) → fill as tar, don't outline
  };
  site: { biome?: string; rainfallMm?: number } | null;
  placeName?: string;
  // Seed the layer selector (e.g. a per-step "Preview this map" opener). Defaults to 'all'.
  initialFilter?: GlossyLayerFilter;
}

export const SCALE = 2;

export function drawMarks(ctx: CanvasRenderingContext2D, state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], imgW: number, imgH: number, filter: GlossyLayerFilter = 'all', drawDesign = true) {
  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;
  // Canvas px per real-world metre (this canvas may be SCALE× the logical frame).
  const pxPerM = imgW / (frame.imgW * frame.mPerPx);

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

  // Driveway — a real tar/asphalt road (dark carriageway + light kerb casing) so it reads as a
  // surfaced vehicle track on EVERY map, exact or illustrated (Rory: "build in the driveway as
  // tar coloured for all designs"). Drawing it dark in the composite also nudges the AI Styles to
  // render it as tar rather than repainting it as a garden path.
  if (refLayers.driveway.length >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const tracePath = () => {
      ctx.beginPath();
      refLayers.driveway.forEach(([x, y], i) => {
        const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
        fn.call(ctx, px(x), py(y));
      });
    };
    if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
      // Traced as an AREA → fill the polygon as one tar surface (outlining it looked like a
      // jagged maze — Rory: "look at the driveway?").
      tracePath();
      ctx.closePath();
      ctx.fillStyle = '#3B3A3E';
      ctx.fill();
      ctx.strokeStyle = 'rgba(233,229,221,0.92)';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else {
      // Traced as a track → a tar carriageway with a light kerb casing.
      const roadW = Math.min(46, Math.max(11, pxPerM * 3)); // ~3 m carriageway, clamped
      tracePath();
      ctx.strokeStyle = 'rgba(233,229,221,0.92)';
      ctx.lineWidth = roadW + 5;
      ctx.stroke();
      tracePath();
      ctx.strokeStyle = '#3B3A3E';
      ctx.lineWidth = roadW;
      ctx.stroke();
    }
    ctx.restore();
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
  // width (pxPerM, computed above) — sizing in logical px would draw every footprint at half scale.
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

export async function buildComposite(state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], filter: GlossyLayerFilter = 'all', drawDesign = true): Promise<string> {
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
  engine: 'gemini' | 'openai' = 'openai',
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
      engine, // 'openai' = gpt-image-2 via fal's async queue; 'gemini' = Gemini Pro image
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
function producerElementsText(state: DesignCanvasState, refLayers: DesignGlossyProps['refLayers'], filter: GlossyLayerFilter = 'all'): string {
  const counts = new Map<string, { icon: string; n: number }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter)) continue; // only this layer's elements
    const name = it.label ?? def.name;
    const g = counts.get(name) ?? { icon: def.icon, n: 0 };
    g.n += 1;
    counts.set(name, g);
  }
  const parts = [...counts.entries()].map(([name, g]) => `${g.icon} ${name}${g.n > 1 ? ` ×${g.n}` : ''}`);
  // On the zones layer, describe the effort-zone areas instead of individual elements.
  if (zonesInFilter(filter)) {
    for (const z of state.zones.filter((z) => !z.feature)) parts.push(`Zone ${z.zone} — ${ZONE_DEFS[z.zone].label}`);
  }
  // Name the driveway so the model keeps the vehicle track visible (it's a traced reference,
  // not a placed item — Rory: "it's not picking up driveway").
  if (refLayers.driveway.length >= 2) parts.push('the existing driveway — a simple dark TAR / ASPHALT access track of the exact traced shape (NOT a loop, roundabout or circular drive), kept clear with no plantings on it');
  return parts.join(', ');
}

// True labels burned onto the produced map: one pill per element-name group at the group's
// centroid (OUTPUT px). SIMPLIFIED vs FacilitatorCanvas — no left/right column split, just a
// short leader from the cluster to a pill placed above-left of it, clamped inside the WxH
// frame so nothing is cropped. (Refine later toward the facilitator's column layout.)
function producerLabels(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  filter: GlossyLayerFilter = 'all',
): ProducerLabel[] {
  const fs = 26, padX = 14;
  const pillWidth = (text: string) => Math.min(W - 28, padX * 2 + text.length * fs * 0.6);

  // One cluster per element name (renamed items get their own pill) — only for THIS layer, so a
  // Zones/Water/Planting map isn't cluttered with every other layer's labels (Rory: a "Zones"
  // map was showing JoJo Tanks + veg beds).
  const groups = new Map<string, { xs: number[]; ys: number[]; icon: string }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const name = it.label ?? def.name;
    const g = groups.get(name) ?? { xs: [], ys: [], icon: def.icon };
    g.xs.push(it.x);
    g.ys.push(it.y);
    groups.set(name, g);
  }

  type Cluster = { cx: number; cy: number; text: string; pw: number };
  const clusters: Cluster[] = [];
  for (const [name, g] of groups) {
    const n = g.xs.length;
    const cx = (g.xs.reduce((a, b) => a + b, 0) / n) * W;
    const cy = (g.ys.reduce((a, b) => a + b, 0) / n) * H;
    const text = `${g.icon} ${name}${n > 1 ? ` ×${n}` : ''}`;
    clusters.push({ cx, cy, text, pw: pillWidth(text) });
  }
  // On the zones layer, label the effort-zone areas (not individual elements).
  if (zonesInFilter(filter)) {
    for (const z of state.zones) {
      if (z.feature || z.points.length < 3) continue;
      const cx = (z.points.reduce((s, p) => s + p[0], 0) / z.points.length) * W;
      const cy = (z.points.reduce((s, p) => s + p[1], 0) / z.points.length) * H;
      const text = `${z.zone}️⃣ ${ZONE_DEFS[z.zone].label}`;
      clusters.push({ cx, cy, text, pw: pillWidth(text) });
    }
  }
  // Driveway isn't a placed item — label it at the midpoint of the traced access line.
  if (refLayers.driveway.length >= 2) {
    const mid = refLayers.driveway[Math.floor(refLayers.driveway.length / 2)];
    const text = '🚗 Driveway';
    clusters.push({ cx: mid[0] * W, cy: mid[1] * H, text, pw: pillWidth(text) });
  }

  // Pin each pill to the LEFT or RIGHT margin (by which half its element sits in) and hug the
  // element's real vertical position, then DE-COLLIDE: keep pills in anchor order and push the
  // minimum amount to remove overlaps, shifting the whole column up if it runs off the bottom.
  // Because the column stays sorted by cy, leaders never cross each other — the "labels all over
  // the place" mess was the old top-stacked layout letting leaders tangle.
  const pillH = fs + 14;
  const minGap = pillH + 8;
  const top = 36, bot = H - 36;
  const out: ProducerLabel[] = [];
  (['left', 'right'] as const).forEach((side) => {
    const col = clusters.filter((c) => (c.cx < W / 2 ? 'left' : 'right') === side).sort((a, b) => a.cy - b.cy);
    if (!col.length) return;
    // Ideal pill y = the element's own y, clamped into the frame.
    const ys = col.map((c) => Math.min(bot, Math.max(top, c.cy)));
    // Push each pill down just enough to clear the one above it (preserves vertical order).
    for (let i = 1; i < ys.length; i++) if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap;
    // If the stack overran the bottom, slide the whole column up so it fits (clamped at top).
    const overflow = ys[ys.length - 1] - bot;
    if (overflow > 0) for (let i = 0; i < ys.length; i++) ys[i] = Math.max(top, ys[i] - overflow);
    col.forEach((c, i) => {
      const ax = side === 'left' ? 16 : Math.max(16, W - c.pw - 16);
      const lx = side === 'left' ? ax + c.pw : ax; // leader meets the pill's inner edge
      out.push({ cx: c.cx, cy: c.cy, ax, ay: ys[i], lx, text: c.text });
    });
  });
  return out;
}

// Zones are an ABSTRACT overlay (translucent coloured regions), not physical objects — the
// image model repaints the land and wipes them. So on a Zones Style map we draw the exact zone
// regions deterministically and hand them to compositeAccurateMap's overlay slot: the AI paints
// the pretty land, then the true zones are burned back on top (accuracy by construction).
function buildZoneOverlay(state: DesignCanvasState, W: number, H: number): string | undefined {
  const zones = state.zones.filter((z) => !z.feature && z.points.length >= 3);
  if (!zones.length) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  // Region fills + bold outline (white halo so it reads on busy illustration).
  for (const z of zones) {
    const def = ZONE_DEFS[z.zone];
    ctx.beginPath();
    z.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
    ctx.closePath();
    ctx.fillStyle = `${def.color}3D`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  // Number badge at each zone centroid.
  for (const z of zones) {
    const cx = (z.points.reduce((s, p) => s + p[0], 0) / z.points.length) * W;
    const cy = (z.points.reduce((s, p) => s + p[1], 0) / z.points.length) * H;
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = ZONE_DEFS[z.zone].color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(z.zone), cx, cy);
  }
  return canvas.toDataURL('image/png');
}

// Water infrastructure is also wiped by the image model (it paints land, not overlays). Burn the
// exact tanks / taps / water lines back on top of a Water Style render — same trick as zones.
function buildWaterOverlay(state: DesignCanvasState, frame: CanvasFrame, W: number, H: number): string | undefined {
  const items = state.items.filter((it) => ELEMENTS_BY_ID[it.defId]?.category === 'water');
  const lines = state.lines.filter((l) => l.kind === 'swale' || l.kind === 'pipe' || l.kind === 'drip');
  if (!items.length && !lines.length) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const pxPerM = W / (frame.imgW * frame.mPerPx);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Water routes — white casing under a coloured line (swale/pipe/drip).
  const LINE_STYLE: Record<string, { color: string; dash: number[] }> = {
    swale: { color: '#4EA6D8', dash: [] },
    pipe: { color: '#2B6FA6', dash: [] },
    drip: { color: '#4E8B3B', dash: [3, 7] },
  };
  for (const l of lines) {
    if (l.points.length < 2) continue;
    const trace = () => {
      ctx.beginPath();
      l.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
    };
    trace();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 6;
    ctx.stroke();
    const st = LINE_STYLE[l.kind];
    trace();
    ctx.setLineDash(st.dash);
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Tanks / taps / ponds — blue markers sized to their footprint, with the element icon on top.
  for (const it of items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    const cx = it.x * W, cy = it.y * H;
    const r = Math.max(9, ((it.wM ?? def.wM) * pxPerM) / 2);
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2E7FC2';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.35, r * 0.72, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,190,240,0.9)';
      ctx.fill();
    } else {
      ctx.fillStyle = '#2E7FC2';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, cx - r, cy - r * 0.7, r * 2, r * 1.4, 4);
      ctx.fill();
      ctx.stroke();
    }
    ctx.font = `${Math.max(12, Math.min(24, r))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy);
  }
  return canvas.toDataURL('image/png');
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Deterministic "Blueprint" ZONE map — the flat cartographic style ChatGPT nailed, but drawn
// exactly from our geometry (guaranteed accurate, instant, reproducible). Dark scrim + hatched
// zone fills + dashed coloured outlines + fence-tick boundary + tar driveway + number badges +
// title + legend panel + scale bar, all on the real satellite. NO AI.
async function buildBlueprintZoneMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  const W = frame.imgW * SCALE;
  const H = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  const ring = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
    ctx.closePath();
  };
  const centroid = (pts: Array<[number, number]>): [number, number] => {
    const n = pts.length;
    return [px(pts.reduce((s, p) => s + p[0], 0) / n), py(pts.reduce((s, p) => s + p[1], 0) / n)];
  };

  // 1. Satellite base + blueprint scrim (so the graphics pop on a moody dark ground).
  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#22303a';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(8,14,22,0.5)';
  ctx.fillRect(0, 0, W, H);

  // 2. Zones 1..5 — translucent wash + diagonal hatch (clipped) + dashed coloured outline.
  const zones = state.zones.filter((z) => !z.feature && z.points.length >= 3 && z.zone !== 0);
  const step = Math.max(12, W * 0.009);
  for (const z of zones) {
    const def = ZONE_DEFS[z.zone];
    ctx.save();
    ring(z.points);
    ctx.clip();
    ctx.fillStyle = `${def.color}2E`;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = `${def.color}99`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = -H; d < W; d += step) {
      ctx.moveTo(d, 0);
      ctx.lineTo(d + H, H);
    }
    ctx.stroke();
    ctx.restore();
    ring(z.points);
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3. Driveway — tar (dark) with a light dashed edge.
  if (refLayers.driveway.length >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const trace = () => {
      ctx.beginPath();
      refLayers.driveway.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
    };
    if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
      trace();
      ctx.closePath();
      ctx.fillStyle = '#2A2A2E';
      ctx.fill();
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      const roadW = Math.min(46, Math.max(11, (W / (frame.imgW * frame.mPerPx)) * 3));
      trace();
      ctx.strokeStyle = '#2A2A2E';
      ctx.lineWidth = roadW;
      ctx.stroke();
      trace();
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // 4. House = Zone 0 — solid fill + white outline.
  const hasHouse = refLayers.house.length >= 3;
  if (hasHouse) {
    ring(refLayers.house);
    ctx.fillStyle = `${ZONE_DEFS[0].color}D9`;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 5. Boundary — green line with perpendicular fence ticks.
  if (refLayers.boundary.length >= 3) {
    const b = refLayers.boundary.map(([x, y]) => [px(x), py(y)] as [number, number]);
    ctx.beginPath();
    b.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
    ctx.closePath();
    ctx.strokeStyle = '#8CEB6A';
    ctx.lineWidth = 3;
    ctx.stroke();
    const tick = Math.max(7, W * 0.006);
    const tstep = Math.max(26, W * 0.02);
    ctx.lineWidth = 2;
    for (let i = 0; i < b.length; i++) {
      const [x1, y1] = b[i];
      const [x2, y2] = b[(i + 1) % b.length];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let t = tstep; t < len; t += tstep) {
        const cx = x1 + dx * (t / len), cy = y1 + dy * (t / len);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + nx * tick, cy + ny * tick);
        ctx.stroke();
      }
    }
  }

  // 6. Number badges (house = 0, then zones).
  const badge = (cx: number, cy: number, color: string, n: number) => {
    const r = Math.max(15, W * 0.011);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(r * 1.1)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(n), cx, cy);
  };
  if (hasHouse) {
    const [cx, cy] = centroid(refLayers.house);
    badge(cx, cy, ZONE_DEFS[0].color, 0);
  }
  for (const z of zones) {
    const [cx, cy] = centroid(z.points);
    badge(cx, cy, ZONE_DEFS[z.zone].color, z.zone);
  }

  // 7. Title (top-left).
  const pad = Math.round(W * 0.02);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F3EEE2';
  ctx.font = `800 ${Math.round(W * 0.028)}px Georgia, serif`;
  ctx.fillText('PERMACULTURE ZONE MAP', pad, pad + Math.round(W * 0.028));
  ctx.fillStyle = '#B9C2C8';
  ctx.font = `600 ${Math.round(W * 0.015)}px system-ui, sans-serif`;
  ctx.fillText(placeName ?? 'Zone plan', pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024));

  // 8. Legend panel (top-right).
  const zoneNums = [...(hasHouse ? [0] : []), ...zones.map((z) => z.zone)].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b) as Array<0 | 1 | 2 | 3 | 4 | 5>;
  const rowH = Math.round(W * 0.026);
  const lgW = Math.round(W * 0.27);
  const lgH = Math.round(rowH * (zoneNums.length + 3 + 2.2));
  const lgX = W - pad - lgW, lgY = pad;
  ctx.fillStyle = 'rgba(10,16,22,0.82)';
  roundRectPath(ctx, lgX, lgY, lgW, lgH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, lgX, lgY, lgW, lgH, 14);
  ctx.stroke();
  const ip = Math.round(lgW * 0.07);
  const sw = Math.round(rowH * 0.62);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let ry = lgY + ip + rowH * 0.4;
  ctx.fillStyle = '#F3EEE2';
  ctx.font = `800 ${Math.round(rowH * 0.72)}px system-ui, sans-serif`;
  ctx.fillText('LEGEND', lgX + ip, ry);
  ry += rowH * 0.9;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(lgX + ip, ry - rowH * 0.25);
  ctx.lineTo(lgX + lgW - ip, ry - rowH * 0.25);
  ctx.stroke();
  ry += rowH * 0.3;
  const textX = lgX + ip + sw * 1.5 + 12;
  for (const n of zoneNums) {
    const def = ZONE_DEFS[n];
    ctx.fillStyle = `${def.color}CC`;
    roundRectPath(ctx, lgX + ip, ry - sw / 2, sw * 1.5, sw, 3);
    ctx.fill();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, lgX + ip, ry - sw / 2, sw * 1.5, sw, 3);
    ctx.stroke();
    ctx.fillStyle = '#EDE7DA';
    ctx.font = `700 ${Math.round(rowH * 0.48)}px system-ui, sans-serif`;
    const zLbl = `ZONE ${n}`;
    ctx.fillText(zLbl, textX, ry);
    const nameX = textX + ctx.measureText(zLbl).width + 8;
    ctx.fillStyle = '#B9C2C8';
    ctx.font = `500 ${Math.round(rowH * 0.44)}px system-ui, sans-serif`;
    let name = `— ${ZONE_DEFS[n].label}`;
    const maxW = lgX + lgW - ip - nameX;
    while (ctx.measureText(name).width > maxW && name.length > 4) name = name.slice(0, -2);
    ctx.fillText(name, nameX, ry);
    ry += rowH;
  }
  // Fence + driveway + scale-note rows.
  ctx.strokeStyle = '#8CEB6A';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lgX + ip, ry);
  ctx.lineTo(lgX + ip + sw * 1.5, ry);
  ctx.stroke();
  ctx.fillStyle = '#EDE7DA';
  ctx.font = `500 ${Math.round(rowH * 0.44)}px system-ui, sans-serif`;
  ctx.fillText('Fence / site boundary', textX, ry);
  ry += rowH;
  ctx.fillStyle = '#2A2A2E';
  roundRectPath(ctx, lgX + ip, ry - sw / 2, sw * 1.5, sw, 3);
  ctx.fill();
  ctx.fillStyle = '#EDE7DA';
  ctx.fillText('Tarred driveway', textX, ry);
  ry += rowH;
  ctx.fillStyle = '#9AA6AC';
  ctx.font = `italic 500 ${Math.round(rowH * 0.4)}px system-ui, sans-serif`;
  ctx.fillText('Zones show frequency of access.', lgX + ip, ry);

  // 9. Scale bar (bottom-left).
  const pxPerM = W / (frame.imgW * frame.mPerPx);
  const niceM = [5, 10, 20, 25, 50, 100, 200];
  let m = niceM[0];
  for (const nm of niceM) if (nm * pxPerM <= W * 0.18) m = nm;
  const barW = m * pxPerM;
  const bx = pad, by = H - pad - rowH * 0.3;
  ctx.strokeStyle = '#F3EEE2';
  ctx.fillStyle = '#F3EEE2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + barW, by);
  ctx.moveTo(bx, by - 8);
  ctx.lineTo(bx, by + 8);
  ctx.moveTo(bx + barW, by - 8);
  ctx.lineTo(bx + barW, by + 8);
  ctx.stroke();
  ctx.font = `700 ${Math.round(W * 0.014)}px system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(`${m} m`, bx, by - 12);

  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" WATER map — the same clean dark-satellite treatment as the zone
// blueprint, but the content layer is water infrastructure (tanks as blue cylinders, swale/pipe/
// drip routes, taps) drawn exactly from geometry. Reliable, instant, no AI.
async function buildBlueprintWaterMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  const W = frame.imgW * SCALE;
  const H = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  const pxPerM = W / (frame.imgW * frame.mPerPx);
  const pad = Math.round(W * 0.02);
  const ring = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
    ctx.closePath();
  };

  // 1. Satellite + blueprint scrim.
  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#22303a';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(8,14,22,0.5)';
  ctx.fillRect(0, 0, W, H);

  // 2. House + driveway context (drawn first, under the water infrastructure).
  if (refLayers.house.length >= 3) {
    ring(refLayers.house);
    ctx.fillStyle = 'rgba(58,63,74,0.85)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  if (refLayers.driveway.length >= 2) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const trace = () => {
      ctx.beginPath();
      refLayers.driveway.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
    };
    if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
      trace();
      ctx.closePath();
      ctx.fillStyle = '#2A2A2E';
      ctx.fill();
    } else {
      trace();
      ctx.strokeStyle = '#2A2A2E';
      ctx.lineWidth = Math.min(46, Math.max(11, pxPerM * 3));
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Water routes — white casing under a coloured line (swale/pipe/drip).
  const LINE_STYLE: Record<string, { color: string; dash: number[] }> = {
    swale: { color: '#4EA6D8', dash: [] },
    pipe: { color: '#2B6FA6', dash: [] },
    drip: { color: '#7FD46B', dash: [4, 8] },
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const l of state.lines) {
    const st = LINE_STYLE[l.kind];
    if (!st || l.points.length < 2) continue;
    const trace = () => {
      ctx.beginPath();
      l.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
    };
    trace();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 6;
    ctx.stroke();
    trace();
    ctx.setLineDash(st.dash);
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. Tanks / taps / ponds — blue markers (cylinders) sized to footprint, icon on top.
  const waterItems = state.items.filter((it) => ELEMENTS_BY_ID[it.defId]?.category === 'water');
  for (const it of waterItems) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    const cx = px(it.x), cy = py(it.y);
    const r = Math.max(9, ((it.wM ?? def.wM) * pxPerM) / 2);
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2E7FC2';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(cx, cy - r * 0.35, r * 0.72, r * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,190,240,0.9)';
      ctx.fill();
    } else {
      ctx.fillStyle = '#2E7FC2';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      roundRectPath(ctx, cx - r, cy - r * 0.7, r * 2, r * 1.4, 4);
      ctx.fill();
      ctx.stroke();
    }
    ctx.font = `${Math.max(12, Math.min(24, r))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy);
  }

  // 5. Boundary — green line with perpendicular fence ticks.
  if (refLayers.boundary.length >= 3) {
    const b = refLayers.boundary.map(([x, y]) => [px(x), py(y)] as [number, number]);
    ctx.beginPath();
    b.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
    ctx.closePath();
    ctx.strokeStyle = '#8CEB6A';
    ctx.lineWidth = 3;
    ctx.stroke();
    const tick = Math.max(7, W * 0.006);
    const tstep = Math.max(26, W * 0.02);
    ctx.lineWidth = 2;
    for (let i = 0; i < b.length; i++) {
      const [x1, y1] = b[i];
      const [x2, y2] = b[(i + 1) % b.length];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let t = tstep; t < len; t += tstep) {
        const cx = x1 + dx * (t / len), cy = y1 + dy * (t / len);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + nx * tick, cy + ny * tick);
        ctx.stroke();
      }
    }
  }

  // 6. Title (top-left).
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F3EEE2';
  ctx.font = `800 ${Math.round(W * 0.028)}px Georgia, serif`;
  ctx.fillText('WATER PLAN', pad, pad + Math.round(W * 0.028));
  ctx.fillStyle = '#B9C2C8';
  ctx.font = `600 ${Math.round(W * 0.015)}px system-ui, sans-serif`;
  ctx.fillText(placeName ?? 'Water plan', pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024));

  // 7. Legend panel (top-right) — only the water elements actually present.
  type Row = { color: string; label: string; style: 'fill' | 'line' | 'dashline' };
  const rows: Row[] = [];
  if (waterItems.length) rows.push({ color: '#2E7FC2', label: 'Tanks / storage', style: 'fill' });
  const kinds = new Set(state.lines.map((l) => l.kind));
  if (kinds.has('swale')) rows.push({ color: '#4EA6D8', label: 'Swale (contour)', style: 'line' });
  if (kinds.has('pipe')) rows.push({ color: '#2B6FA6', label: 'Pipe', style: 'line' });
  if (kinds.has('drip')) rows.push({ color: '#7FD46B', label: 'Drip line', style: 'dashline' });
  rows.push({ color: '#8CEB6A', label: 'Fence / site boundary', style: 'line' });
  if (refLayers.driveway.length >= 2) rows.push({ color: '#2A2A2E', label: 'Tarred driveway', style: 'fill' });

  const rowH = Math.round(W * 0.026);
  const lgW = Math.round(W * 0.27);
  const lgH = Math.round(rowH * (rows.length + 2.4));
  const lgX = W - pad - lgW, lgY = pad;
  ctx.fillStyle = 'rgba(10,16,22,0.82)';
  roundRectPath(ctx, lgX, lgY, lgW, lgH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, lgX, lgY, lgW, lgH, 14);
  ctx.stroke();
  const ip = Math.round(lgW * 0.07);
  const sw = Math.round(rowH * 0.62);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let ry = lgY + ip + rowH * 0.4;
  ctx.fillStyle = '#F3EEE2';
  ctx.font = `800 ${Math.round(rowH * 0.72)}px system-ui, sans-serif`;
  ctx.fillText('LEGEND', lgX + ip, ry);
  ry += rowH * 0.9;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(lgX + ip, ry - rowH * 0.25);
  ctx.lineTo(lgX + lgW - ip, ry - rowH * 0.25);
  ctx.stroke();
  ry += rowH * 0.3;
  const textX = lgX + ip + sw * 1.5 + 12;
  for (const row of rows) {
    if (row.style === 'fill') {
      ctx.fillStyle = `${row.color}CC`;
      roundRectPath(ctx, lgX + ip, ry - sw / 2, sw * 1.5, sw, 3);
      ctx.fill();
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, lgX + ip, ry - sw / 2, sw * 1.5, sw, 3);
      ctx.stroke();
    } else {
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 3;
      ctx.setLineDash(row.style === 'dashline' ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(lgX + ip, ry);
      ctx.lineTo(lgX + ip + sw * 1.5, ry);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = '#EDE7DA';
    ctx.font = `600 ${Math.round(rowH * 0.46)}px system-ui, sans-serif`;
    ctx.fillText(row.label, textX, ry);
    ry += rowH;
  }
  ctx.fillStyle = '#9AA6AC';
  ctx.font = `italic 500 ${Math.round(rowH * 0.4)}px system-ui, sans-serif`;
  ctx.fillText('Blue = water storage & flow.', lgX + ip, ry);

  // 8. Scale bar (bottom-left).
  const niceM = [5, 10, 20, 25, 50, 100, 200];
  let m = niceM[0];
  for (const nm of niceM) if (nm * pxPerM <= W * 0.18) m = nm;
  const barW = m * pxPerM;
  const bx = pad, by = H - pad - rowH * 0.3;
  ctx.strokeStyle = '#F3EEE2';
  ctx.fillStyle = '#F3EEE2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + barW, by);
  ctx.moveTo(bx, by - 8);
  ctx.lineTo(bx, by + 8);
  ctx.moveTo(bx + barW, by - 8);
  ctx.lineTo(bx + barW, by + 8);
  ctx.stroke();
  ctx.font = `700 ${Math.round(W * 0.014)}px system-ui, sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText(`${m} m`, bx, by - 12);

  return canvas.toDataURL('image/png');
}

// Legend rows for a Style sheet — the real design content on this layer (zones, grouped
// elements, line kinds, driveway). Deterministic: read straight from state.
function sheetLegendRows(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
): Array<{ swatch: string; icon?: string; text: string }> {
  const rows: Array<{ swatch: string; icon?: string; text: string }> = [];
  if (zonesInFilter(filter)) {
    for (const z of state.zones) {
      if (z.feature || z.points.length < 3) continue;
      rows.push({ swatch: ZONE_DEFS[z.zone].color, text: `Zone ${z.zone} — ${ZONE_DEFS[z.zone].label}` });
    }
  }
  const groups = new Map<string, { icon: string; color: string; n: number }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const name = it.label ?? def.name;
    const g = groups.get(name) ?? { icon: def.icon, color: def.color, n: 0 };
    g.n += 1;
    groups.set(name, g);
  }
  for (const [name, g] of groups) rows.push({ swatch: g.color, icon: g.icon, text: `${name}${g.n > 1 ? ` ×${g.n}` : ''}` });
  const kinds = new Set<string>();
  for (const l of state.lines) {
    if (!lineInFilter(l.kind, filter) || kinds.has(l.kind)) continue;
    kinds.add(l.kind);
    rows.push({ swatch: LINE_COLORS[l.kind] ?? '#8C8577', text: l.kind.charAt(0).toUpperCase() + l.kind.slice(1) });
  }
  if (refLayers.driveway.length >= 2) rows.push({ swatch: '#3B3A3E', text: 'Tarred driveway' });
  return rows;
}

// Compose the illustrated Style render into a proper SHEET: map left, titled legend panel right,
// scale bar + north arrow over the map — the layout of the reference plan sets (see
// docs/PLAN-SET-SPEC.md). The Blueprint maps bake this in; the Style output never had it, which is
// most of the visible gap vs ChatGPT's sheets. All drawn deterministically from the real design.
async function composeStyleSheet(
  mapDataUrl: string,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
  placeName: string | undefined,
  styleLabel: string,
  layerLabel: string,
): Promise<string> {
  const map = await loadImage(mapDataUrl);
  const W = map.width;
  const H = map.height;
  const legendW = Math.min(620, Math.max(360, Math.round(W * 0.3)));
  const outW = W + legendW;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return mapDataUrl;
  ctx.drawImage(map, 0, 0);

  // ── Legend panel ──
  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(W, 0, legendW, H);
  const pad = Math.round(legendW * 0.075);
  const lx = W + pad;
  const maxX = outW - pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let y = pad + Math.round(legendW * 0.09);
  ctx.fillStyle = '#20190F';
  ctx.font = `800 ${Math.round(legendW * 0.082)}px Georgia, serif`;
  ctx.fillText(`${layerLabel.toUpperCase()}`, lx, y);
  y += Math.round(legendW * 0.055);
  ctx.fillStyle = '#6B6355';
  ctx.font = `600 ${Math.round(legendW * 0.045)}px system-ui, sans-serif`;
  ctx.fillText(styleLabel, lx, y);
  y += Math.round(legendW * 0.05);
  ctx.fillStyle = '#8A8172';
  ctx.font = `500 ${Math.round(legendW * 0.04)}px system-ui, sans-serif`;
  ctx.fillText(placeName ?? 'Your design', lx, y);
  y += Math.round(legendW * 0.035);
  ctx.strokeStyle = 'rgba(11,18,11,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lx, y);
  ctx.lineTo(maxX, y);
  ctx.stroke();

  y += Math.round(legendW * 0.075);
  ctx.fillStyle = '#1F4D2B';
  ctx.font = `800 ${Math.round(legendW * 0.05)}px system-ui, sans-serif`;
  ctx.fillText('LEGEND', lx, y);

  const rows = sheetLegendRows(state, refLayers, filter);
  const rowH = Math.round(legendW * 0.072);
  const fs = Math.round(legendW * 0.042);
  const sw = Math.round(rowH * 0.42);
  y += Math.round(rowH * 0.7);
  ctx.textBaseline = 'middle';
  for (const row of rows) {
    if (y > H - pad - rowH) {
      ctx.fillStyle = '#6B6355';
      ctx.font = `500 ${fs}px system-ui, sans-serif`;
      ctx.fillText('…', lx, y);
      break;
    }
    ctx.beginPath();
    ctx.arc(lx + sw / 2, y, sw / 2, 0, Math.PI * 2);
    ctx.fillStyle = row.swatch;
    ctx.fill();
    ctx.strokeStyle = 'rgba(11,18,11,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    let tx = lx + sw + Math.round(legendW * 0.03);
    if (row.icon) {
      ctx.fillStyle = '#20190F';
      ctx.font = `${fs}px sans-serif`;
      ctx.fillText(row.icon, tx, y);
      tx += Math.round(fs * 1.5);
    }
    ctx.fillStyle = '#241E12';
    ctx.font = `500 ${fs}px system-ui, sans-serif`;
    let text = row.text;
    while (ctx.measureText(text).width > maxX - tx && text.length > 4) text = text.slice(0, -2);
    if (text !== row.text) text = `${text.slice(0, -1)}…`;
    ctx.fillText(text, tx, y);
    y += rowH;
  }
  if (!rows.length) {
    ctx.fillStyle = '#6B6355';
    ctx.font = `italic 500 ${fs}px system-ui, sans-serif`;
    ctx.fillText('Nothing placed on this layer.', lx, y);
  }
  // Footer caveat — the Style render is illustrative; the exact map is the record.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8A8172';
  ctx.font = `italic 500 ${Math.round(legendW * 0.036)}px system-ui, sans-serif`;
  ctx.fillText('Illustrated render — boundary, labels', lx, H - pad - Math.round(legendW * 0.05));
  ctx.fillText('and elements are exact; artwork is', lx, H - pad - Math.round(legendW * 0.005));
  ctx.fillText('indicative. Confirm on site.', lx, H - pad + Math.round(legendW * 0.04));

  // ── Scale bar (over the map, bottom-left) ──
  const pxPerM = W / (frame.imgW * frame.mPerPx);
  const niceM = [5, 10, 20, 25, 50, 100, 200];
  let m = niceM[0];
  for (const nm of niceM) if (nm * pxPerM <= W * 0.18) m = nm;
  const barW = m * pxPerM;
  const bx = Math.round(W * 0.03);
  const by = H - Math.round(H * 0.045);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(11,14,10,0.55)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + barW, by);
  ctx.moveTo(bx, by - 9); ctx.lineTo(bx, by + 9);
  ctx.moveTo(bx + barW, by - 9); ctx.lineTo(bx + barW, by + 9);
  ctx.stroke();
  ctx.strokeStyle = '#FBF6EC';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(bx, by); ctx.lineTo(bx + barW, by);
  ctx.moveTo(bx, by - 9); ctx.lineTo(bx, by + 9);
  ctx.moveTo(bx + barW, by - 9); ctx.lineTo(bx + barW, by + 9);
  ctx.stroke();
  ctx.font = `700 ${Math.round(W * 0.016)}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(11,14,10,0.6)';
  ctx.strokeText(`${m} m`, bx, by - 14);
  ctx.fillStyle = '#FBF6EC';
  ctx.fillText(`${m} m`, bx, by - 14);

  // ── North arrow (over the map, top-right) ──
  const nx = W - Math.round(W * 0.04);
  const ny = Math.round(H * 0.08);
  ctx.beginPath();
  ctx.moveTo(nx, ny - 30);
  ctx.lineTo(nx - 11, ny);
  ctx.lineTo(nx, ny - 9);
  ctx.lineTo(nx + 11, ny);
  ctx.closePath();
  ctx.fillStyle = '#FBF6EC';
  ctx.strokeStyle = 'rgba(11,14,10,0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fill();
  ctx.font = `700 ${Math.round(W * 0.017)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(11,14,10,0.65)';
  ctx.strokeText('N', nx, ny - 34);
  ctx.fillStyle = '#FBF6EC';
  ctx.fillText('N', nx, ny - 34);

  return canvas.toDataURL('image/png');
}

// ── Persistence — cache the last render per site so a page refresh doesn't lose it.
// dataURLs can be large; localStorage has a quota, so writes are best-effort.
interface SavedGlossy {
  image: string;
  provider: 'gemini' | 'falgpt' | 'exact';
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

const PROVIDER_LABEL: Record<'gemini' | 'falgpt' | 'exact', string> = {
  gemini: 'Gemini Pro',
  falgpt: 'gpt-image-2',
  exact: 'Exact map · no AI',
};

export default function DesignGlossy({ state, frame, refLayers, site, placeName, initialFilter }: DesignGlossyProps) {
  const [loading, setLoading] = useState<'gemini' | 'falgpt' | 'exact' | null>(null);
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
    // The engine picker applies to styles too: gpt-image-2 (the "used to be very good" one, via
    // the image-producer's 'openai' path) or Gemini Pro.
    const producerEngine: 'gemini' | 'openai' = engine === 'gemini' ? 'gemini' : 'openai';
    setLoading(engine);
    setError(null);
    try {
      const W = frame.imgW * SCALE;
      const H = frame.imgH * SCALE;
      // Style renders the CURRENTLY-CHOSEN design layer (Whole design / Water / Zones / …) —
      // so "Zones + Homestead Storybook" illustrates just the zones in that style.
      const layerLabel = filter === 'all' ? 'Full design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label ?? 'Full design';
      // a. Model input — the composite for the chosen layer.
      const composite = await buildComposite(state, frame, refLayers, filter);
      // b. Short comma list of placed elements + counts (this layer only).
      const elementsText = producerElementsText(state, refLayers, filter);
      // c. Beautify via the image-producer route (gemini engine; async path handled inside).
      const modelImage = await requestProducer(stripDataUrl(composite), layerLabel, elementsText, producerStyle, producerEngine);
      // d. Boundary → flat OUTPUT-px ring (the normalised ring just multiplies by W/H).
      const boundaryPx =
        refLayers.boundary.length >= 3
          ? refLayers.boundary.flatMap(([x, y]) => [x * W, y * H])
          : undefined;
      // e. True labels (one pill per element-name group at its centroid) — this layer only.
      const labels = producerLabels(state, refLayers, W, H, filter);
      // e2. On a Zones map, burn the exact zone REGIONS back on top — the model can't render an
      //     abstract coloured overlay, so we guarantee it (see buildZoneOverlay).
      const overlayImage =
        filter === 'zones' ? buildZoneOverlay(state, W, H)
        : filter === 'water' ? buildWaterOverlay(state, frame, W, H)
        : undefined;
      // f. Deterministic composite-back — accuracy guaranteed by construction.
      const final = await compositeAccurateMap({
        modelImage,
        // Satellite is the ground truth OUTSIDE the boundary; fall back to the composite when
        // there's no satellite so the map is never left blank/transparent there.
        satelliteImage: frame.satDataUrl ?? composite,
        boundaryPx,
        overlayImage,
        labels,
        labelStyle: styleDef.labelStyle,
        width: W,
        height: H,
      });
      // g. Sheet chrome — titled legend panel + scale bar + north arrow, so the Style render comes
      //    out as a proper plan sheet (see docs/PLAN-SET-SPEC.md), not a bare picture.
      const sheet = await composeStyleSheet(final, state, frame, refLayers, filter, placeName, styleDef.label, layerLabel);
      // h. Show, cache (mapKey = producer:<style>) and add to the session gallery.
      setResultImage(sheet);
      const record: SavedGlossy = { image: sheet, provider: producerEngine === 'openai' ? 'falgpt' : 'gemini', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      pushGallery(`${layerLabel} · ${styleDef.label}`, sheet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [producerStyle, filter, engine, state, frame, refLayers, mapKey, pushGallery, placeName]);

  // Deterministic design-layer map — the ACCURATE-BY-CONSTRUCTION reference map.
  // Real satellite + your EXACT zones / elements / lines / labels drawn on top, and
  // NOTHING else. No model runs, so nothing can be invented (no imaginary lavender
  // field, orchard or veg beds — the "amazing picture but completely wrong" failure).
  // Instant, free, always correct. The illustrated "Style" buttons remain the AI
  // beautify path for when a farmer wants the artist's impression instead.
  const renderDesignMap = useCallback(async () => {
    setLoading('exact');
    setError(null);
    try {
      // The Zones map gets the deterministic "Blueprint" treatment (hatched zones, legend, scale,
      // fence ticks) — the flat cartographic look ChatGPT nailed, but drawn exactly from geometry.
      const composite = filter === 'zones'
        ? await buildBlueprintZoneMap(state, frame, refLayers, placeName)
        : filter === 'water'
          ? await buildBlueprintWaterMap(state, frame, refLayers, placeName)
          : await buildComposite(state, frame, refLayers, filter, true);
      setResultImage(composite);
      const record: SavedGlossy = { image: composite, provider: 'exact', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      const mapLabel = filter === 'all'
        ? 'Whole design'
        : `${GLOSSY_FILTERS.find((f) => f.key === filter)?.label ?? filter} map`;
      pushGallery(mapLabel, composite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [state, frame, refLayers, filter, mapKey, pushGallery, placeName]);

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
            ? `Generate your ${filter === 'all' ? 'whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map in the ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} style — the polished pipeline. The model beautifies the scene, then your real satellite, boundary and labels are composited back on top, so it's beautiful AND boundary-accurate by construction. ${engine === 'falgpt' ? 'gpt-image-2 is slow — up to ~5 min. For a quick preview, switch the engine to Gemini (~1 min).' : 'Gemini takes about a minute.'}`
            : analysisStyle
              ? `Generate the ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} analysis map — an illustrated Gemini render (sun/wind, opportunities, phasing) over your real site. These are freer than the design maps: great to look at, less exact on geometry. Takes about a minute.`
              : filter === 'all'
                ? 'Draw your whole design map — your real satellite with every zone, element, line and label placed exactly where you put them. Drawn straight from your plan, so it’s always accurate. Instant, no AI. Want an artist’s impression? Pick a Style below.'
                : `Draw your ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} map — your real satellite with just that layer drawn exactly as you placed it. Instant and accurate, no AI guessing. For an illustrated version, add a Style below.`}
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
        {/* Engine picker — only for illustrated Styles (they render via the boundary-locked
            image-producer pipeline, gpt-image-2 or Gemini). Analysis maps are Gemini-only.
            Bare Design maps are drawn deterministically from your plan — no model, no engine. */}
        {!producerStyle ? (
          analysisStyle ? (
            <div style={{ fontSize: 11.5, opacity: 0.7 }}>
              Analysis maps are drawn by <strong>Gemini Pro</strong>.
            </div>
          ) : null
        ) : (
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
            Engine for this style · both experimental
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
          onClick={() =>
            producerStyle
              ? generateProducer()
              : analysisStyle
                ? generate('gemini')
                : renderDesignMap()
          }
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
            ? loading === 'exact'
              ? 'Drawing your exact map…'
              : loading === 'falgpt'
                ? 'Generating… gpt-image-2 is slow (up to ~5 min)'
                : 'Generating your map… ~1 min'
            : producerStyle
              ? `${resultImage ? 'Regenerate' : 'Generate'} my ${filter === 'all' ? '' : `${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} `}${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} (~1 min)`
              : analysisStyle
                ? `${resultImage ? 'Regenerate' : 'Generate'} my ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} map (~1 min)`
                : `${resultImage ? 'Redraw' : 'Draw'} my ${filter === 'all' ? 'design map' : `${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map`} · instant`}
        </button>
        <div style={{ fontSize: 11, opacity: 0.6 }}>
          {!producerStyle && !analysisStyle ? (
            <>
              Drawn straight from your design — <strong>exact, no AI</strong>. Your satellite,
              boundary, zones, elements and labels, nothing invented. For an illustrated
              version, pick a <strong>Style</strong> below.
            </>
          ) : (
            <>
              Using{' '}
              <strong>
                {analysisStyle
                  ? 'Gemini Pro'
                  : `${ENGINES.find((e) => e.key === engine)?.label} · polished pipeline`}
              </strong>
              . If the result looks off, try generating again{analysisStyle ? '' : ' or switch engine'} — results vary shot to shot.
            </>
          )}
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
