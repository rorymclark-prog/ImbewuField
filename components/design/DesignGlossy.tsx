'use client';

// Design Studio — the STRICT final "glossy" render. Composites the farmer's exact
// design (satellite + zones + lines + items) into an image, builds a protect-mask that
// pixel-locks every farmer feature, then sends both to the AI render pipeline so the AI
// may only repaint background texture — never move, add, or remove anything the farmer
// placed.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Gem, FlaskConical, Images, X } from 'lucide-react';

import polygonClipping from 'polygon-clipping';

import type { CanvasFrame, DesignCanvasState, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import type { DesignElementDef, ElementCategory } from '@/lib/design-elements';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID } from '@/lib/design-elements';
import { GROUND_FEATURES, ZONE_DEFS } from '@/lib/design-elements';
import { requestRender, stripDataUrl, pollFalRender } from '@/lib/ai-render-client';
import { compositeAccurateMap, type LabelStyle, type ProducerLabel } from '@/lib/image-producer';
import { buildPhasePlan } from '@/lib/phasing';
import { deriveSectorModel, bearingToUnitVector, type SectorSite, type SectorModel } from '@/lib/sector';
import { computeContourLines } from '@/lib/contours';
import { buildProducerPrompt, type StylePreset } from '@/lib/producer-prompt';
import { enqueueRenderJob, subscribeRenderJob, fetchRenderOutput } from '@/lib/render-jobs';

const PAPER = '#FFFEFA';

// Persist the active background render job per site, so closing/reopening the Studio re-attaches to
// an in-flight render (they take minutes) and still collects the finished sheets instead of wasting
// the spend. Cleared when the job reaches a terminal state.
const queueJobKey = (siteId: string) => `imbewu_render_job_${siteId}`;
function persistJobId(siteId: string, jobId: string) {
  try { localStorage.setItem(queueJobKey(siteId), jobId); } catch { /* ignore */ }
}
function readPersistedJobId(siteId: string): string | null {
  try { return localStorage.getItem(queueJobKey(siteId)); } catch { return null; }
}
function clearPersistedJobId(siteId: string) {
  try { localStorage.removeItem(queueJobKey(siteId)); } catch { /* ignore */ }
}
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
  fence: '#8E7CC3', // dusty violet — distinct from boundary-green; CAD convention for fencing
  path: '#C9A227',
  pipe: '#2B6FA6',
  drip: '#4E8B3B',
  windbreak: '#2F7A4A',
};

// Per-layer glossy: 'all' = the whole design; the others render just one theme (with the
// base map + ground context always kept so the picture is legible). Only the drawn marks in
// the chosen layer are locked; everything else is repainted as background.
export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures';

// Gemini is listed first and is the DEFAULT: gpt-image-2 (via fal.ai) frequently returns 403
// (fal/OpenAI verification), so it can't be the reliable default. When it IS picked and fails,
// generateProducer falls back to Gemini automatically (see the try/catch there).
const ENGINES: Array<{ key: 'falgpt' | 'gemini'; label: string; sub: string }> = [
  { key: 'gemini', label: 'Gemini Pro', sub: 'instant · ~1 min' },
  { key: 'falgpt', label: 'gpt-image-2', sub: 'sharpest · background (~mins)' },
];

const GLOSSY_FILTERS: Array<{ key: GlossyLayerFilter; label: string }> = [
  { key: 'all', label: 'Whole design' },
  { key: 'zones', label: 'Zones' },
  { key: 'water', label: 'Water' },
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

// NOTE: 'earthworks' is deliberately NOT its own glossy/print layer — it folds into 'water'.
// A GlossyLayerFilter is not just a UI filter: FILTER_TO_LAYER below maps it to the API's
// RenderLayer union ('overall'|'base'|'sector'|'zone'|'water'|'opportunity'|'planting'|
// 'implementation'), which has no earthworks theme, and an unmapped filter falls through to the
// full-design theme — the exact bug that made the AI invent ponds and orchards on a layer map.
// Folding into 'water' is also the honest reading: earthworks IS the water layer's land-shaping
// (basins, berms and banana circles are how water is slowed, spread and sunk), and the water
// theme's blue-green "water plan" wash suits them. 'structures' already folds to 'overall' the
// same way. Adding a real earthworks layer means an API-side RenderLayer + layerTheme prompt
// block first — see docs/DESIGN-TAXONOMY.md.
export function itemInFilter(category: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      return category === 'water' || category === 'earthworks';
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
    case 'planting':
      return kind === 'windbreak'; // a windbreak is a planted row → Planting sheet, not Structures
    case 'structures':
      return kind === 'fence' || kind === 'path';
    default:
      return false;
  }
}

// How many REAL things the farmer has drawn on this layer. A layer map with zero content is always
// wrong — either that layer hasn't been drawn yet, or something upstream dropped it. Either way we
// must never render it silently and let the AI invent the layer (Rory: "it should be retrieving my
// zones layer which is detailed — no guessing"). Callers refuse + explain instead.
export function layerContentCount(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
): number {
  let n = 0;
  if (zonesInFilter(filter)) n += state.zones.filter((z) => !z.feature && z.points.length >= 3).length;
  n += state.items.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return !!def && itemInFilter(def.category, filter);
  }).length;
  n += state.lines.filter((l) => lineInFilter(l.kind, filter) && l.points.length >= 2).length;
  // The whole-design map also stands up on the traced base alone.
  if (filter === 'all' && refLayers.boundary.length >= 3) n += 1;
  return n;
}

/** Zones NEST: Zone 1 is typically drawn as a ring right around the house, which is Zone 0. Drawn
 *  naively they simply overlap and whatever paints last wins — so Zone 1's fill covers the house
 *  (the roof came out tinted Zone-1 red) and Zone 1's AREA wrongly counts the house.
 *  A zone's true extent is its ring MINUS every lower-numbered zone and the house footprint —
 *  i.e. a donut. polygon-clipping returns a MultiPolygon whose rings are [outer, ...holes];
 *  canvas' default nonzero fill renders those as holes when each ring is a separate subpath.
 *  Falls back to the raw ring if the boolean op fails on a degenerate trace. */
export function zoneFillPolys(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  z: ZoneShape,
): Array<Array<Array<[number, number]>>> {
  const subject: Array<Array<Array<[number, number]>>> = [[z.points]];
  const cutters: Array<Array<Array<[number, number]>>> = [];
  for (const other of state.zones) {
    if (other.id === z.id || other.feature || other.points.length < 3) continue;
    if (other.zone < z.zone) cutters.push([other.points]);
  }
  if (z.zone !== 0 && refLayers.house.length >= 3) cutters.push([refLayers.house]);
  if (!cutters.length) return subject;
  try {
    const out = polygonClipping.difference(subject as never, ...(cutters as never[]));
    return (out as unknown as Array<Array<Array<[number, number]>>>) ?? subject;
  } catch {
    return subject; // degenerate ring — better an overlapping zone than a crash
  }
}

const EMPTY_LAYER_STEP: Record<GlossyLayerFilter, string> = {
  all: 'design',
  water: 'Water',
  zones: 'Zones',
  planting: 'Planting',
  structures: 'Structures',
};

// Shown instead of rendering an empty layer. Names the step to go draw on, AND says plainly that
// if the farmer HAS drawn it, this is a bug — an empty layer must never be papered over.
function emptyLayerMessage(filter: GlossyLayerFilter): string {
  const step = EMPTY_LAYER_STEP[filter];
  if (filter === 'all') return 'Nothing drawn yet — trace your boundary and place some elements first.';
  return `No ${step.toLowerCase()} found on this design, so there's nothing to map — draw them on the ${step} step first. (A ${step.toLowerCase()} map is built from your real ${step.toLowerCase()}, never guessed. If you HAVE drawn them and still see this, it's a bug — please report it.)`;
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
  // Widened to SectorSite (a superset of {biome?, rainfallMm?}) so the deterministic Sector sheet
  // can read real slope + climate; still structurally assignable to buildPhasePlan's PhasingSite.
  site: SectorSite | null;
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
    // Zones nest: cut each one back by any lower zone + the house so a Zone-1 ring around the
    // house is a donut, not a tint over the roof (zoneFillPolys).
    ctx.beginPath();
    for (const poly of zoneFillPolys(state, refLayers, zone)) {
      for (const r of poly) {
        r.forEach(([x, y], i) => {
          const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
          fn.call(ctx, px(x), py(y));
        });
        ctx.closePath();
      }
    }
    // On the dedicated zones map the interior is mask-locked, so make the composite's own zone
    // fill strong + add a number badge — the protected interior then already looks like the
    // finished zone map and the model only touches the ground outside.
    ctx.fillStyle = `${def.color}${filter === 'zones' ? '59' : '33'}`;
    ctx.fill('evenodd');
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
    ctx.lineWidth = line.kind === 'fence' ? 3 : 4;
    if (line.kind === 'swale' || line.kind === 'drip' || line.kind === 'path') ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]); // fence is SOLID (dashed reads as underground/proposed) — posts mark it
    ctx.stroke();
    ctx.setLineDash([]);
    // Post-and-wire fence: round posts along the line (violet), never the boundary's ticks.
    if (line.kind === 'fence') {
      const pts = line.points;
      const posts: Array<[number, number]> = [[px(pts[0][0]), py(pts[0][1])]];
      for (let i = 0; i < pts.length - 1; i++) {
        const ax = px(pts[i][0]), ay = py(pts[i][1]), bx = px(pts[i + 1][0]), by = py(pts[i + 1][1]);
        const n = Math.max(1, Math.round((Math.hypot(bx - ax, by - ay) || 1) / (14 * SCALE)));
        for (let k = 1; k <= n; k++) posts.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]);
      }
      for (const [cx, cy] of posts) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3.2 * SCALE, 0, Math.PI * 2);
        ctx.fillStyle = LINE_COLORS.fence;
        ctx.fill();
        ctx.strokeStyle = '#FFFEFA';
        ctx.lineWidth = 1.2 * SCALE;
        ctx.stroke();
      }
    }
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

// ── MASTER DESIGN BRIEF ───────────────────────────────────────────────────────
// WHY THIS EXISTS (the "one-shot" insight): ChatGPT produced a coherent 7-sheet plan set in ONE
// pass because a single reasoning pass held the design constant across every sheet. Our sheets are
// INDEPENDENT API calls — each render re-interprets the scene from scratch, so the sheets of one
// plan set disagree with each other (the tank that sits NE on the water sheet drifts E on the whole-
// design sheet). The fix is to hand every call the SAME text description of the WHOLE design, read
// off the real geometry, so every call reasons about one fixed design the way a one-shot pass does.
//
// HARD RULE: the brief MUST be byte-identical for every layer — that is the entire point. It
// therefore takes NO GlossyLayerFilter and must never be filtered by one. Naming the per-layer
// marked features is producerElementsText's separate job; this is the shared constant. Everything
// here is read from real geometry (traced rings, placed items), never guessed — same accuracy
// contract as the deterministic maps.

const BRIEF_MAX = 1500;

// Compass buckets in a fixed reading order, so a group spanning several buckets always renders them
// in the same order ("N/NE", never "NE/N") — a Set's insertion order would leak item order into the
// text and make the brief differ between otherwise-identical designs.
const COMPASS_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'central'];

// Plain-English line names — the model gets no legend, so "drip" alone is ambiguous.
const LINE_BRIEF_LABELS: Record<string, string> = {
  swale: 'swale (on-contour infiltration ditch)',
  fence: 'fence line',
  path: 'footpath',
  pipe: 'water pipe',
  drip: 'drip irrigation line',
  windbreak: 'windbreak planting line',
};

function centroidOf(points: Array<[number, number]>): [number, number] {
  const n = points.length;
  return [
    points.reduce((s, p) => s + p[0], 0) / n,
    points.reduce((s, p) => s + p[1], 0) / n,
  ];
}

/** Joins as many parts as fit in `budget`, tailing with a truthful "+N more" count. An over-long
 *  list degrades to a SHORTER TRUE list — never a name chopped mid-word, and never a silently
 *  dropped line. */
function joinWithin(parts: string[], budget: number, noun: string): string {
  const kept: string[] = [];
  let len = 0;
  for (const p of parts) {
    const add = kept.length ? p.length + 2 : p.length; // '; '
    if (len + add > budget) break;
    kept.push(p);
    len += add;
  }
  if (kept.length === parts.length) return parts.join('; ');
  const more = `…and ${parts.length - kept.length} more ${noun}`;
  return kept.length ? `${kept.join('; ')}; ${more}` : more;
}

/** A compact, deterministic TEXT description of the WHOLE design, identical for every layer.
 *  Sent with every producer render so all sheets in a plan set agree on what the design IS. */
export function buildDesignBrief(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  placeName: string | undefined,
  site: DesignGlossyProps['site'],
): string {
  // Split so ELEMENTS can be sized against whatever budget the other lines leave (see below).
  const before: string[] = [];
  const after: string[] = [];

  before.push(`PLACE: ${placeName ?? 'this smallholding'} — a real South African smallholding.`);

  // ── Traced base geometry (the references every sheet must agree on first) ──
  if (refLayers.boundary.length >= 3) {
    before.push('BOUNDARY: the property boundary is traced; the whole design sits inside it.');
  }
  if (refLayers.house.length >= 3) {
    const [hx, hy] = centroidOf(refLayers.house);
    before.push(
      `HOUSE: one main house, ${compass8(hx, hy)} on the plot — the ONLY building on this site unless another is named under ELEMENTS below.`,
    );
  }
  if (refLayers.driveway.length >= 2) {
    const a = refLayers.driveway[0];
    const b = refLayers.driveway[refLayers.driveway.length - 1];
    const from = compass8(a[0], a[1]);
    const to = compass8(b[0], b[1]);
    // "tar" per the driveway rule the producer prompt already enforces — stated here too so every
    // sheet renders the same surface, not gravel on one sheet and paving on the next.
    before.push(
      `DRIVEWAY: one dark TAR / ASPHALT access track of the exact traced shape (never a loop, roundabout or circular drive)${from === to ? ` at the ${from} of the plot` : `, running ${from} to ${to}`}, kept clear with no plantings on it.`,
    );
  }

  // ── Ground / built features the farmer traced (what is really there today) ──
  const features = state.zones.filter((z) => z.feature && z.points.length >= 3);
  if (features.length) {
    const parts = features.map((z) => {
      const [cx, cy] = centroidOf(z.points);
      const meta = GROUND_FEATURES[z.feature!];
      return `${z.name ?? meta.label} (${compass8(cx, cy)})`;
    });
    before.push(`GROUND: ${joinWithin(parts, 220, 'ground features')}.`);
  }

  // ── Permaculture effort-zones (rings), lowest zone first ──
  // Sorted by zone number rather than draw order: the brief must read the same for two designs
  // that are identical but were drawn in a different sequence.
  const zones = state.zones
    .filter((z) => !z.feature && z.points.length >= 3)
    .sort((a, b) => a.zone - b.zone);
  if (zones.length) {
    const parts = zones.map((z) => {
      const [cx, cy] = centroidOf(z.points);
      return `Zone ${z.zone} ${ZONE_DEFS[z.zone].label} (${compass8(cx, cy)})`;
    });
    before.push(`ZONES: ${joinWithin(parts, 300, 'zone rings')}.`);
  }

  // ── Placed elements, grouped by name with counts + the buckets they occupy ──
  const groups = new Map<string, { icon: string; n: number; dirs: Set<string> }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue; // NO itemInFilter here — see the HARD RULE above
    const name = it.label ?? def.name;
    const g = groups.get(name) ?? { icon: def.icon, n: 0, dirs: new Set<string>() };
    g.n += 1;
    g.dirs.add(compass8(it.x, it.y));
    groups.set(name, g);
  }
  const elementParts = [...groups.entries()].map(([name, g]) => {
    const dirs = COMPASS_ORDER.filter((d) => g.dirs.has(d)).join('/');
    return `${g.icon} ${name}${g.n > 1 ? ` ×${g.n}` : ''} (${dirs})`;
  });

  // ── Line kinds + counts ──
  // Naturally bounded — only six line kinds exist, so this can never run away.
  const lineCounts = new Map<string, number>();
  for (const l of state.lines) {
    if (l.points.length < 2) continue;
    lineCounts.set(l.kind, (lineCounts.get(l.kind) ?? 0) + 1);
  }
  if (lineCounts.size) {
    const parts = [...lineCounts.entries()].map(
      ([kind, n]) => `${n}× ${LINE_BRIEF_LABELS[kind] ?? kind}`,
    );
    after.push(`LINES: ${parts.join('; ')}.`);
  }

  const ctx: string[] = [];
  if (site?.biome) ctx.push(`${site.biome} biome`);
  if (typeof site?.rainfallMm === 'number' && Number.isFinite(site.rainfallMm)) {
    ctx.push(`~${Math.round(site.rainfallMm)} mm rain/year`);
  }
  if (ctx.length) after.push(`CONTEXT: ${ctx.join(', ')}.`);

  // ELEMENTS is the only genuinely UNBOUNDED line — a renamed item gets its own group, so a rich
  // design (exactly our target user) can produce hundreds — AND it is the most load-bearing line
  // in the brief: it is what actually pins WHERE things are across sheets. So it gets whatever
  // budget the other, naturally-short lines leave, and degrades to a shorter TRUE list. Sizing it
  // last is deliberate: an earlier version simply dropped any line that broke the budget, which on
  // a big design silently threw away ELEMENTS *and* every line after it — the one outcome that
  // defeats the whole point of a shared brief.
  const fixedLen = [...before, ...after].reduce((s, l) => s + l.length + 1, 0);
  const elementsBudget = BRIEF_MAX - fixedLen - 'ELEMENTS: .'.length - 1;
  const out = [...before];
  if (elementParts.length && elementsBudget > 40) {
    out.push(`ELEMENTS: ${joinWithin(elementParts, elementsBudget, 'elements')}.`);
  }
  out.push(...after);

  // Backstop: assemble on LINE boundaries, so even a pathological design degrades to a shorter but
  // still well-formed brief rather than a sentence chopped mid-word. Order is priority order — the
  // base geometry every sheet hangs off survives first.
  let text = '';
  for (const line of out) {
    const next = text ? `${text}\n${line}` : line;
    if (next.length > BRIEF_MAX) break;
    text = next;
  }
  return text;
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
  // The shared whole-design description (buildDesignBrief). IDENTICAL on every layer's call —
  // that's what keeps the sheets of a plan set agreeing with each other. Optional so an older
  // caller that omits it behaves exactly as before.
  designBrief = '',
): Promise<string> {
  const res = await fetch('/api/image-producer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64,
      layerLabel,
      elementsText,
      designBrief,
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

// ── Burned map labels: CAPS + grouped headers (docs/PLAN-SET-SPEC.md) ─────────
//
// The reference plan set labels an AREA once — "SOUTHERN ORCHARD GUILDS" as a header over
// Macadamia / Citrus / Avocado / Mango — instead of firing one emoji pill AND one leader at
// every element name. A dozen fruit trees in one orchard used to mean a dozen pills and a
// dozen leaders: the single worst source of burned-label clutter. So we cluster same-family
// nearby elements and give the cluster ONE header + its members underneath.

/** The bucket we're willing to put under one header. */
type LabelFamily = 'trees' | ElementCategory;

const FAMILY_LABEL: Record<LabelFamily, string> = {
  trees: 'TREES',
  growing: 'BEDS & CROPS',
  water: 'WATER',
  earthworks: 'EARTHWORKS',
  structure: 'STRUCTURES',
  animal: 'LIVESTOCK',
  access: 'ACCESS',
};

// Trees get their own family because they're the worst offender (a whole orchard of species
// dropped in one corner). NOTE the category guard: `tree_basin` also starts with 'tree_' but is
// category 'earthworks' — the mulch ring that shapes the LAND around a tree — and the taxonomy
// (docs/DESIGN-TAXONOMY.md) deliberately keeps land-shaping apart from planting. It stays in
// EARTHWORKS.
function labelFamily(def: DesignElementDef): LabelFamily {
  return def.category === 'growing' && def.id.startsWith('tree_') ? 'trees' : def.category;
}

// How many DISTINCT element names a cluster needs before a header earns its row. Below this a
// header is mostly ceremony: "TREES" over rows that already read CITRUS TREE / MANGO TREE tells
// the reader nothing, and two nearby pills with two leaders already scan fine.
// (Measured over 800 simulated designs: dropping this to 2 buys ~16% fewer leader lines for ~5%
// more rows — a real but marginal trade. 3 matches the reference sheet's 4-member groups.)
const GROUP_MIN_NAMES = 3;
// Members listed under one header before we roll the tail up into "+N MORE" — stops a 15-species
// food forest from turning the header block into a column that overruns the sheet.
const GROUP_MAX_ROWS = 6;
// Cluster radius as a fraction of the frame HEIGHT. Single-link, so it chains along a row of
// trees (a hedgerow IS one label) — which is the behaviour we want.
const GROUP_PROXIMITY = 0.18;

/** Normalised bbox of the traced plot, falling back to the whole frame when untraced. */
function plotBox(boundary: Array<[number, number]>): { x0: number; y0: number; x1: number; y1: number } {
  if (boundary.length < 3) return { x0: 0, y0: 0, x1: 1, y1: 1 };
  const xs = boundary.map((p) => p[0]);
  const ys = boundary.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Compass word for a header ("SOUTHERN TREES"). Maps are north-up (Web-Mercator satellite), so
// normalised +y is south. Measured inside the PLOT's bbox, not the photo's, so "SOUTHERN" means
// the southern part of the farmer's land. Only used when a family has more than one cluster —
// the prefix exists to tell two clusters apart, and on a single cluster it's just noise.
function compassWord(x: number, y: number, box: ReturnType<typeof plotBox>): string {
  const u = box.x1 > box.x0 ? (x - box.x0) / (box.x1 - box.x0) : 0.5;
  const v = box.y1 > box.y0 ? (y - box.y0) / (box.y1 - box.y0) : 0.5;
  if (v < 0.34) return 'NORTHERN';
  if (v > 0.66) return 'SOUTHERN';
  if (u < 0.34) return 'WESTERN';
  if (u > 0.66) return 'EASTERN';
  return 'CENTRAL';
}

type LabelPt = { x: number; y: number; name: string; icon: string };

/** Single-link clustering by proximity. `aspect` (W/H) makes the metric isotropic despite x and y
 *  both being normalised 0..1 over a non-square frame. Element counts are tens — O(n²) is fine. */
function clusterByProximity(pts: LabelPt[], aspect: number): LabelPt[][] {
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot((pts[i].x - pts[j].x) * aspect, pts[i].y - pts[j].y);
      if (d <= GROUP_PROXIMITY) parent[find(i)] = find(j);
    }
  }
  const by = new Map<number, LabelPt[]>();
  pts.forEach((p, i) => {
    const root = find(i);
    const arr = by.get(root) ?? [];
    arr.push(p);
    by.set(root, arr);
  });
  return [...by.values()];
}

// True labels burned onto the produced map (all coords OUTPUT px): grouped CAPS headers with
// their members beneath, pinned to the left/right margins and de-collided.
function producerLabels(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  filter: GlossyLayerFilter = 'all',
): ProducerLabel[] {
  const fs = 26, padX = 14;
  // Pill-width ESTIMATE — only used to right-align the right-hand column (burnLabels measures the
  // real width for the pill itself). CAPS runs wider than mixed case, and bold headers wider
  // still, so the per-char factor went up with them; under-estimating here would hang the
  // right-hand pills off the edge of the frame.
  const pillWidth = (text: string, bold: boolean) =>
    Math.min(W - 28, padX * 2 + text.length * fs * (bold ? 0.66 : 0.62));

  type Row = { text: string; kind: 'header' | 'item'; leader: boolean; pw: number };
  /** One margin-pinned unit: a lone pill (head = null, one leader-carrying member), or a header
   *  plus the members it speaks for. cx/cy is the single point the block's ONE leader points at.
   *  `hidden` is how many member names got rolled up into a "+N MORE" row. */
  type Block = { cx: number; cy: number; head: Row | null; members: Row[]; hidden: number };
  const blocks: Block[] = [];

  const itemRow = (icon: string, name: string, n: number): Row => {
    // CAPS on every on-map label, per the reference sheets ("On-map labels: CAPS, short").
    // The emoji stays on members — it's the fastest recognition cue on a busy illustration —
    // and is dropped from headers, which carry their meaning in the words.
    const text = `${icon} ${name}${n > 1 ? ` ×${n}` : ''}`.toUpperCase();
    return { text, kind: 'item', leader: true, pw: pillWidth(text, false) };
  };
  const moreRow = (n: number): Row => {
    const text = `+${n} MORE`;
    return { text, kind: 'item', leader: false, pw: pillWidth(text, false) };
  };
  const rowCount = (b: Block) => (b.head ? 1 : 0) + b.members.length + (b.hidden > 0 ? 1 : 0);
  const blockRows = (b: Block): Row[] => [
    ...(b.head ? [b.head] : []),
    ...b.members,
    ...(b.hidden > 0 ? [moreRow(b.hidden)] : []),
  ];

  // Bucket this layer's items by family — only THIS layer, so a Zones/Water/Planting map isn't
  // cluttered with every other layer's labels (Rory: a "Zones" map was showing JoJo Tanks + veg
  // beds).
  const families = new Map<LabelFamily, LabelPt[]>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const key = labelFamily(def);
    const arr = families.get(key) ?? [];
    arr.push({ x: it.x, y: it.y, name: it.label ?? def.name, icon: def.icon });
    families.set(key, arr);
  }

  const box = plotBox(refLayers.boundary);
  const aspect = H > 0 ? W / H : 1;
  for (const [family, pts] of families) {
    const clusters = clusterByProximity(pts, aspect);
    for (const cluster of clusters) {
      // Name groups within this cluster (renamed items get their own row), biggest first.
      const byName = new Map<string, { icon: string; xs: number[]; ys: number[] }>();
      for (const p of cluster) {
        const g = byName.get(p.name) ?? { icon: p.icon, xs: [], ys: [] };
        g.xs.push(p.x);
        g.ys.push(p.y);
        byName.set(p.name, g);
      }
      const names = [...byName.entries()].sort((a, b) => b[1].xs.length - a[1].xs.length || a[0].localeCompare(b[0]));

      if (names.length < GROUP_MIN_NAMES) {
        // Too few kinds to be worth a header — one pill per kind with its own leader, as before.
        // It now anchors on the name's centroid WITHIN this cluster, so two veg patches at
        // opposite ends of the plot no longer share one pill pointing at the empty middle.
        for (const [name, g] of names) {
          const n = g.xs.length;
          blocks.push({
            cx: (g.xs.reduce((a, b) => a + b, 0) / n) * W,
            cy: (g.ys.reduce((a, b) => a + b, 0) / n) * H,
            head: null,
            members: [itemRow(g.icon, name, n)],
            hidden: 0,
          });
        }
        continue;
      }

      // Header + members: ONE leader, aimed at the cluster's centroid.
      const nx = cluster.reduce((s, p) => s + p.x, 0) / cluster.length;
      const ny = cluster.reduce((s, p) => s + p.y, 0) / cluster.length;
      const prefix = clusters.length > 1 ? `${compassWord(nx, ny, box)} ` : '';
      const head = `${prefix}${FAMILY_LABEL[family]}`;
      // Members ride under the header WITHOUT a leader of their own — see the layout note below.
      const members = names
        .slice(0, GROUP_MAX_ROWS)
        .map(([name, g]) => ({ ...itemRow(g.icon, name, g.xs.length), leader: false }));
      blocks.push({
        cx: nx * W,
        cy: ny * H,
        head: { text: head, kind: 'header', leader: true, pw: pillWidth(head, true) },
        members,
        hidden: Math.max(0, names.length - GROUP_MAX_ROWS),
      });
    }
  }

  // On the zones layer, label the effort-zone areas (not individual elements). Each zone is its
  // own distinct region, so there is nothing to group — one pill each, as before.
  if (zonesInFilter(filter)) {
    for (const z of state.zones) {
      if (z.feature || z.points.length < 3) continue;
      const cx = (z.points.reduce((s, p) => s + p[0], 0) / z.points.length) * W;
      const cy = (z.points.reduce((s, p) => s + p[1], 0) / z.points.length) * H;
      const text = `${z.zone}️⃣ ${ZONE_DEFS[z.zone].label}`.toUpperCase();
      blocks.push({ cx, cy, head: null, members: [{ text, kind: 'item', leader: true, pw: pillWidth(text, false) }], hidden: 0 });
    }
  }
  // Driveway isn't a placed item — label it at the midpoint of the traced access line.
  if (refLayers.driveway.length >= 2) {
    const mid = refLayers.driveway[Math.floor(refLayers.driveway.length / 2)];
    const text = '🚗 DRIVEWAY';
    blocks.push({ cx: mid[0] * W, cy: mid[1] * H, head: null, members: [{ text, kind: 'item', leader: true, pw: pillWidth(text, false) }], hidden: 0 });
  }

  // Pin each BLOCK to the LEFT or RIGHT margin (by which half its elements sit in) and hug their
  // real vertical position, then DE-COLLIDE: keep blocks in anchor order and push the minimum
  // amount to remove overlaps, shifting the whole column up if it runs off the bottom.
  // NO-CROSSING LEADERS — the property this layout won and must not lose: the column stays sorted
  // by cy, AND exactly one row per block carries a leader (a block's members are silent). So the
  // leaders on a side are still one-per-anchor in anchor order, and cannot tangle. This is also
  // why members don't keep their own leaders: N leaders fanning out of a block would re-order
  // against the column and bring the "labels all over the place" mess straight back.
  const pillH = fs + 14;
  const rowGap = pillH + 4; // rows inside a block hug each other → they read as one group…
  const blockGap = 14; // …and blocks stay clearly apart
  const top = 36, bot = H - 36;
  const out: ProducerLabel[] = [];
  (['left', 'right'] as const).forEach((side) => {
    const col = blocks.filter((b) => (b.cx < W / 2 ? 'left' : 'right') === side).sort((a, b) => a.cy - b.cy);
    if (!col.length) return;
    // FIT THE COLUMN FIRST. A column only holds ~28 rows; past that the overflow shift below
    // clamps at `top` and starts stacking pills on top of each other. (That degradation is not
    // new — the old one-pill-per-name layout hit it on a big design too — but headers add rows,
    // so grouping must not make it easier to reach.) MEMBERS are the compressible part: the
    // header's leader carries the group's position, so rolling members up into "+N MORE" costs
    // detail, never truth, and the legend panel still names everything. Leader-carrying rows are
    // never dropped — they ARE the identity+position guarantee. Trim the greediest block first.
    const columnSpan = () =>
      col.reduce((s, b) => s + (rowCount(b) - 1) * rowGap, 0) + (col.length - 1) * (pillH + blockGap);
    // Each block can waste one no-op pass (popping its first member adds the "+N MORE" row back),
    // then every pass shrinks the column — so this always terminates; the cap is belt-and-braces.
    for (let guard = 0; columnSpan() > bot - top && guard < col.length * GROUP_MAX_ROWS + 8; guard++) {
      const victim = col.filter((b) => b.members.length > 1).sort((a, b) => b.members.length - a.members.length)[0];
      if (!victim) break; // nothing compressible left — accept the pre-existing degradation
      victim.members.pop();
      victim.hidden += 1;
    }
    const rows = col.map(blockRows);
    // Header centre → last row centre, i.e. how far below its anchor a block reaches.
    const span = rows.map((r) => (r.length - 1) * rowGap);
    // Ideal header y = the elements' own y, clamped so the whole block fits in the frame.
    const ys = col.map((b, i) => Math.max(top, Math.min(b.cy, bot - span[i])));
    // Push each block down just enough to clear the one above it (preserves vertical order).
    const pushDown = () => {
      for (let i = 1; i < ys.length; i++) {
        const min = ys[i - 1] + span[i - 1] + pillH + blockGap;
        if (ys[i] < min) ys[i] = min;
      }
    };
    pushDown();
    // If the stack overran the bottom, slide the whole column up so it fits (clamped at top).
    const overflow = ys[ys.length - 1] + span[span.length - 1] - bot;
    if (overflow > 0) {
      for (let i = 0; i < ys.length; i++) ys[i] = Math.max(top, ys[i] - overflow);
      // …then push down AGAIN. That per-block clamp at `top` is applied blindly, so it silently
      // re-breaks the separations the first pass just established and stacks pills on top of each
      // other (an old bug: a full column could land two pills at the same y). Re-pushing restores
      // them, and because the fit pass above trimmed the column to fit, this cannot re-overflow.
      pushDown();
    }
    col.forEach((b, i) => {
      rows[i].forEach((row, k) => {
        const ax = side === 'left' ? 16 : Math.max(16, W - row.pw - 16);
        const lx = side === 'left' ? ax + row.pw : ax; // leader meets the pill's inner edge
        out.push({ cx: b.cx, cy: b.cy, ax, ay: ys[i] + k * rowGap, lx, text: row.text, kind: row.kind, leader: row.leader });
      });
    });
  });
  return out;
}

// Zones are an ABSTRACT overlay (translucent coloured regions), not physical objects — the
// image model repaints the land and wipes them. So on a Zones Style map we draw the exact zone
// regions deterministically and hand them to compositeAccurateMap's overlay slot: the AI paints
// the pretty land, then the true zones are burned back on top (accuracy by construction).
function buildZoneOverlay(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
): string | undefined {
  const zones = state.zones.filter((z) => !z.feature && z.points.length >= 3);
  if (!zones.length) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  // Region fills + bold outline (white halo so it reads on busy illustration). Each zone is cut
  // back by any lower zone + the house (zoneFillPolys) so a Zone-1 ring around the house reads as
  // a donut instead of painting over the roof.
  for (const z of zones) {
    const def = ZONE_DEFS[z.zone];
    ctx.beginPath();
    for (const poly of zoneFillPolys(state, refLayers, z)) {
      for (const ring of poly) {
        ring.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
        ctx.closePath();
      }
    }
    ctx.fillStyle = `${def.color}3D`;
    ctx.fill('evenodd'); // outer + hole rings in one path → real holes
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
// Membership MUST come from itemInFilter, not a `category === 'water'` literal: the water layer
// also carries earthworks now, and the protect mask, legend and burned-on labels all use
// itemInFilter. A literal here would burn a tree basin's LABEL onto the sheet while leaving its
// marker to be painted over by the model — a pill pointing at nothing.
function buildWaterOverlay(state: DesignCanvasState, frame: CanvasFrame, W: number, H: number): string | undefined {
  const items = state.items.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return !!def && itemInFilter(def.category, 'water');
  });
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

// ── Shared Blueprint sheet chrome ─────────────────────────────────────────────────────────────
// Every deterministic Blueprint sheet (02 Zones, 03 Water, 04 Planting, 05 Structures) wears the
// SAME chrome — see docs/PLAN-SET-SPEC.md "Sheet anatomy": satellite + dark scrim, tar driveway,
// fence-tick boundary, title block, legend panel, scale bar. That chrome was written twice (zone +
// water) and would have been written FOUR times once 04/05 landed. It lives here once instead,
// because the spec's load-bearing principle is that every sheet in the set agrees with every other
// — and four hand-maintained copies of the chrome is exactly how that guarantee quietly rots.
//
// Each helper is a verbatim extraction of the call sequence the zone/water sheets already ran, in
// the same order, leaving the same ctx state behind, so both existing sheets stay pixel-identical.
// Every parameter is a point where those two ALREADY differed (title text, whether the driveway
// carries a dashed kerb, the house's fill/stroke) — none is a new styling choice.
//
// NB: there is deliberately no north-arrow helper. Despite the sheet anatomy listing one, the
// Blueprint sheets have never drawn a north arrow — only composeStyleSheet does. Adding one here
// would change the zone/water sheets, which this refactor must not do. Left as a known gap.

/** Satellite base + the blueprint scrim that makes graphics pop on a moody dark ground. */
async function drawBlueprintBase(
  ctx: CanvasRenderingContext2D,
  frame: CanvasFrame,
  W: number,
  H: number,
): Promise<void> {
  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.drawImage(img, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#22303a';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = 'rgba(8,14,22,0.5)';
  ctx.fillRect(0, 0, W, H);
}

/** Trace a normalised ring as a closed path (leaves fill/stroke to the caller). */
function blueprintRing(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
  ctx.closePath();
}

/** House footprint. The zone sheet paints it as Zone 0 in the zone palette; the other sheets draw
 *  it as neutral context beneath their own content — hence fill/stroke/width are the caller's. */
function drawBlueprintHouse(
  ctx: CanvasRenderingContext2D,
  house: Array<[number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
  fill: string,
  stroke: string,
  lineWidth: number,
): void {
  if (house.length < 3) return;
  blueprintRing(ctx, house, px, py);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/** Tar driveway — filled when traced as an AREA, else a ~3 m carriageway stroke (clamped).
 *  `dashedEdge` reproduces the zone sheet's light dashed kerb; the water sheet omits it (there the
 *  driveway is background context, not content), so it stays a caller's choice rather than a rule. */
function drawBlueprintDriveway(
  ctx: CanvasRenderingContext2D,
  refLayers: DesignGlossyProps['refLayers'],
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  dashedEdge: boolean,
): void {
  if (refLayers.driveway.length < 2) return;
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
    if (dashedEdge) {
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    trace();
    ctx.strokeStyle = '#2A2A2E';
    ctx.lineWidth = Math.min(46, Math.max(11, pxPerM * 3)); // ~3 m carriageway, clamped
    ctx.stroke();
    if (dashedEdge) {
      trace();
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

/** Site boundary — green line with perpendicular fence ticks. */
function drawBlueprintBoundary(
  ctx: CanvasRenderingContext2D,
  boundary: Array<[number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
  W: number,
): void {
  if (boundary.length < 3) return;
  const b = boundary.map(([x, y]) => [px(x), py(y)] as [number, number]);
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

/** Title block, top-left. */
function drawBlueprintTitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  pad: number,
  title: string,
  subtitle: string,
): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F3EEE2';
  ctx.font = `800 ${Math.round(W * 0.028)}px Georgia, serif`;
  ctx.fillText(title, pad, pad + Math.round(W * 0.028));
  ctx.fillStyle = '#B9C2C8';
  ctx.font = `600 ${Math.round(W * 0.015)}px system-ui, sans-serif`;
  ctx.fillText(subtitle, pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024));
}

interface BlueprintLegend {
  lgX: number;
  lgY: number;
  lgW: number;
  ip: number; // inner padding
  sw: number; // swatch size
  textX: number; // x of the row label
  ry: number; // y of the first row
}

/** Legend panel shell + "LEGEND" header + divider, top-right. Returns the panel metrics and the y
 *  of the first row so each sheet can draw its own rows — the zone sheet's rows are bespoke
 *  two-part text, the rest use drawBlueprintLegendRows. `lgH` stays the caller's job: only the
 *  caller knows its row count. */
function drawBlueprintLegendFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  pad: number,
  rowH: number,
  lgH: number,
): BlueprintLegend {
  const lgW = Math.round(W * 0.27);
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
  return { lgX, lgY, lgW, ip, sw, textX, ry };
}

interface BlueprintLegendRow {
  color: string;
  label: string;
  style: 'fill' | 'line' | 'dashline';
  icon?: string;
}

/** Generic legend rows (swatch + optional icon + label). Returns the y after the last row.
 *  The icon and the label-ellipsis are both no-ops for the water sheet's short, icon-less rows,
 *  so it keeps rendering exactly as before; sheets 05/06 need them for long species names. */
function drawBlueprintLegendRows(
  ctx: CanvasRenderingContext2D,
  lg: BlueprintLegend,
  rowH: number,
  rows: BlueprintLegendRow[],
): number {
  let ry = lg.ry;
  for (const row of rows) {
    if (row.style === 'fill') {
      ctx.fillStyle = `${row.color}CC`;
      roundRectPath(ctx, lg.lgX + lg.ip, ry - lg.sw / 2, lg.sw * 1.5, lg.sw, 3);
      ctx.fill();
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 1.5;
      roundRectPath(ctx, lg.lgX + lg.ip, ry - lg.sw / 2, lg.sw * 1.5, lg.sw, 3);
      ctx.stroke();
    } else {
      ctx.strokeStyle = row.color;
      ctx.lineWidth = 3;
      ctx.setLineDash(row.style === 'dashline' ? [4, 4] : []);
      ctx.beginPath();
      ctx.moveTo(lg.lgX + lg.ip, ry);
      ctx.lineTo(lg.lgX + lg.ip + lg.sw * 1.5, ry);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    let tx = lg.textX;
    if (row.icon) {
      ctx.fillStyle = '#EDE7DA';
      ctx.font = `${Math.round(rowH * 0.5)}px sans-serif`;
      ctx.fillText(row.icon, tx, ry);
      tx += Math.round(rowH * 0.66);
    }
    ctx.fillStyle = '#EDE7DA';
    ctx.font = `600 ${Math.round(rowH * 0.46)}px system-ui, sans-serif`;
    // Ellipsise rather than spill past the panel edge — species names + counts get long.
    let label = row.label;
    const maxW = lg.lgX + lg.lgW - lg.ip - tx;
    if (ctx.measureText(label).width > maxW) {
      while (label.length > 1 && ctx.measureText(`${label}…`).width > maxW) label = label.slice(0, -1);
      label = `${label}…`;
    }
    ctx.fillText(label, tx, ry);
    ry += rowH;
  }
  return ry;
}

/** Italic caveat line at the foot of the legend. */
function drawBlueprintLegendNote(
  ctx: CanvasRenderingContext2D,
  lg: BlueprintLegend,
  rowH: number,
  ry: number,
  text: string,
): void {
  ctx.fillStyle = '#9AA6AC';
  ctx.font = `italic 500 ${Math.round(rowH * 0.4)}px system-ui, sans-serif`;
  ctx.fillText(text, lg.lgX + lg.ip, ry);
}

/** Scale bar, bottom-left — the largest "nice" round metre count fitting ~18% of the sheet. */
function drawBlueprintScaleBar(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  pad: number,
  rowH: number,
  pxPerM: number,
): void {
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
}

/** How many legend rows fit the sheet at this size (the panel must not run off the bottom).
 *  Mirrors the lgH formula the sheets use: pad + rowH × (rows + 2.4) ≤ H − pad. */
function blueprintLegendCapacity(H: number, pad: number, rowH: number): number {
  return Math.max(3, Math.floor((H - pad * 2) / rowH - 2.4));
}

// ── Per-species colour ────────────────────────────────────────────────────────────────────────
// WHY a palette instead of def.color: def.color is a per-CATEGORY accent — every one of the 21
// 'growing' elements is the same #4E8B3B, every 'structure' the same #7A5C3E. That's right for the
// studio canvas (category at a glance) but useless on a planting sheet, where the entire job is
// telling Macadamia from Citrus. So sheets 05/06 colour by SPECIES.
//
// The index is the element's position within ITS OWN SHEET's category set (planting = growing;
// structures = structure+animal+access). That makes the colour:
//   • deterministic  — same design → same sheet, always; no hashing, no randomness;
//   • collision-free — the biggest set is 23 elements against a 24-entry palette, and the two sets
//     are disjoint, so no two species on one sheet can ever share a colour;
//   • stable         — a given species keeps its colour across renders and across designs, so this
//     month's sheet is comparable with last month's.
// A catalog edit can shift the palette, which is cosmetic only: the legend on the sheet always
// shows the mapping that sheet actually used.
const SPECIES_PALETTE = [
  '#E4572E', '#F4A259', '#F6D55C', '#C9A227', '#A3B565', '#7FD46B',
  '#4E9F3D', '#2F7A4A', '#3CBBB1', '#4EA6D8', '#2B6FA6', '#5C6BC0',
  '#9B6FD4', '#C879C0', '#E8639B', '#D64550', '#B5651D', '#8C6239',
  '#C98A2C', '#7A9E9F', '#B8C4A9', '#E0B0A0', '#6FB1FC', '#D9D06A',
];

const SPECIES_INDEX: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  // 'planting' and 'structures' partition the catalog's placeable elements between them, so one
  // flat record is unambiguous. Membership comes from itemInFilter — never a category literal —
  // so a taxonomy change (docs/DESIGN-TAXONOMY.md) can't silently drop a species from its sheet.
  for (const filter of ['planting', 'structures'] as const) {
    let i = 0;
    for (const def of ELEMENT_CATALOG) {
      if (!itemInFilter(def.category, filter)) continue;
      out[def.id] = i++;
    }
  }
  return out;
})();

function speciesColor(defId: string): string {
  const i = SPECIES_INDEX[defId] ?? 0;
  return SPECIES_PALETTE[i % SPECIES_PALETTE.length];
}

/** Group a sheet's items into legend rows: one row per distinct name, with a count, commonest
 *  first. Grouping is by `it.label ?? def.name` (matching sheetLegendRows) so a renamed item reads
 *  as its own line; the colour still comes from the def, so the row matches its marks on the map. */
function speciesRowsFor(
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
): BlueprintLegendRow[] {
  const groups = new Map<string, { icon: string; color: string; n: number }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter)) continue;
    const name = it.label ?? def.name;
    const g = groups.get(name) ?? { icon: def.icon, color: speciesColor(def.id), n: 0 };
    g.n += 1;
    groups.set(name, g);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
    .map(([name, g]) => ({
      color: g.color,
      icon: g.icon,
      label: `${name}${g.n > 1 ? ` ×${g.n}` : ''}`,
      style: 'fill' as const,
    }));
}

/** Fit species rows into the panel, keeping the fixed context rows (boundary/driveway) and
 *  collapsing whatever spills into a "+N more" row. A food forest can carry 20+ species. */
function fitLegendRows(
  species: BlueprintLegendRow[],
  fixed: BlueprintLegendRow[],
  capacity: number,
): BlueprintLegendRow[] {
  const budget = Math.max(1, capacity - fixed.length);
  if (species.length <= budget) return [...species, ...fixed];
  const shown = species.slice(0, Math.max(0, budget - 1));
  const hidden = species.length - shown.length;
  return [...shown, { color: '#9AA6AC', label: `+${hidden} more`, style: 'fill' as const }, ...fixed];
}

// Deterministic "Blueprint" ZONE map — the flat cartographic style ChatGPT nailed, but drawn
// exactly from our geometry (guaranteed accurate, instant, reproducible). Dark scrim + hatched
// zone fills + dashed coloured outlines + fence-tick boundary + tar driveway + number badges +
// title + legend panel + scale bar, all on the real satellite. NO AI.
export async function buildBlueprintZoneMap(
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
  const centroid = (pts: Array<[number, number]>): [number, number] => {
    const n = pts.length;
    return [px(pts.reduce((s, p) => s + p[0], 0) / n), py(pts.reduce((s, p) => s + p[1], 0) / n)];
  };

  // 1. Satellite base + blueprint scrim (so the graphics pop on a moody dark ground).
  await drawBlueprintBase(ctx, frame, W, H);

  // 2. Zones 1..5 — translucent wash + diagonal hatch (clipped) + dashed coloured outline.
  const zones = state.zones.filter((z) => !z.feature && z.points.length >= 3 && z.zone !== 0);
  const step = Math.max(12, W * 0.009);
  for (const z of zones) {
    const def = ZONE_DEFS[z.zone];
    // Cut each zone back by any lower zone + the house so nested rings read as donuts.
    const zoneRings = () => {
      ctx.beginPath();
      for (const poly of zoneFillPolys(state, refLayers, z)) {
        for (const r of poly) {
          r.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
          ctx.closePath();
        }
      }
    };
    ctx.save();
    zoneRings();
    ctx.clip('evenodd');
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
    zoneRings();
    ctx.setLineDash([12, 8]);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3. Driveway — tar (dark) with a light dashed edge.
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, true);

  // 4. House = Zone 0 — solid fill + white outline.
  const hasHouse = refLayers.house.length >= 3;
  drawBlueprintHouse(ctx, refLayers.house, px, py, `${ZONE_DEFS[0].color}D9`, '#FFFFFF', 3);

  // 5. Boundary — green line with perpendicular fence ticks.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

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
  drawBlueprintTitle(ctx, W, pad, 'PERMACULTURE ZONE MAP', placeName ?? 'Zone plan');

  // 8. Legend panel (top-right). The rows stay hand-drawn here rather than going through
  //    drawBlueprintLegendRows: a zone row is two-part text ("ZONE 3" + "— Orchard / food forest"
  //    in a second colour and weight), which the generic swatch+label row can't express.
  const zoneNums = [...(hasHouse ? [0] : []), ...zones.map((z) => z.zone)].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b) as Array<0 | 1 | 2 | 3 | 4 | 5>;
  const rowH = Math.round(W * 0.026);
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (zoneNums.length + 3 + 2.2)));
  const { lgX, lgW, ip, sw, textX } = lg;
  let ry = lg.ry;
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
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Zones show frequency of access.');

  // 9. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);

  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" WATER map — the same clean dark-satellite treatment as the zone
// blueprint, but the content layer is water infrastructure (tanks as blue cylinders, swale/pipe/
// drip routes, taps) drawn exactly from geometry. Reliable, instant, no AI.
export async function buildBlueprintWaterMap(
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

  // 1. Satellite + blueprint scrim.
  await drawBlueprintBase(ctx, frame, W, H);

  // 2. House + driveway context (drawn first, under the water infrastructure).
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.85)', 'rgba(255,255,255,0.85)', 2.5);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);

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
  // Via itemInFilter so this deterministic Blueprint sheet shows exactly what the Water layer
  // claims (earthworks included — tree/greywater basins used to draw here as 'water' elements
  // and must keep doing so). Each marker carries its own def.icon, so they stay readable.
  const waterItems = state.items.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return !!def && itemInFilter(def.category, 'water');
  });
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
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 6. Title (top-left).
  drawBlueprintTitle(ctx, W, pad, 'WATER PLAN', placeName ?? 'Water plan');

  // 7. Legend panel (top-right) — only the water elements actually present.
  type Row = BlueprintLegendRow;
  const rows: Row[] = [];
  if (waterItems.length) rows.push({ color: '#2E7FC2', label: 'Tanks / storage', style: 'fill' });
  const kinds = new Set(state.lines.map((l) => l.kind));
  if (kinds.has('swale')) rows.push({ color: '#4EA6D8', label: 'Swale (contour)', style: 'line' });
  if (kinds.has('pipe')) rows.push({ color: '#2B6FA6', label: 'Pipe', style: 'line' });
  if (kinds.has('drip')) rows.push({ color: '#7FD46B', label: 'Drip line', style: 'dashline' });
  rows.push({ color: '#8CEB6A', label: 'Fence / site boundary', style: 'line' });
  if (refLayers.driveway.length >= 2) rows.push({ color: '#2A2A2E', label: 'Tarred driveway', style: 'fill' });

  const rowH = Math.round(W * 0.026);
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 2.4)));
  const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Blue = water storage & flow.');

  // 8. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);

  return canvas.toDataURL('image/png');
}

/** Draw one element at its TRUE ground footprint, species-coloured.
 *
 *  This is the whole point of sheets 05/06 and the one thing the AI styles can never guarantee:
 *  wM/hM are real METRES, so a 10 m mango canopy occupies 10 m of canvas. Nothing here is clamped
 *  to a "nice" marker size — spacing and canopy OVERLAP are exactly the design decisions these
 *  sheets exist to expose, and a legibility clamp would silently draw a lie.
 *
 *  Legibility is bought back WITHOUT touching the geometry: the icon is only drawn when the true
 *  footprint is big enough to host it, and anything smaller gets a centre dot so it stays findable
 *  (a 0.5 × 0.1 m sign is genuinely sub-pixel at site scale). Mirrors drawMarks' rect/rot/circle
 *  conventions — rot is degrees clockwise about the footprint centre, and is meaningless for
 *  circles (see PlacedItem in lib/design-canvas.ts). */
function drawTrueFootprint(
  ctx: CanvasRenderingContext2D,
  it: PlacedItem,
  def: DesignElementDef,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
): void {
  const color = speciesColor(def.id);
  const wPx = (it.wM ?? def.wM) * pxPerM;
  const hPx = (it.hM ?? def.hM) * pxPerM;
  const cx = px(it.x), cy = py(it.y);
  ctx.fillStyle = `${color}59`; // translucent — overlapping canopies must both stay readable
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (def.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, wPx / 2, 0, Math.PI * 2); // catalog convention: circles use wM as DIAMETER
    ctx.fill();
    ctx.stroke();
    // Trunk/centre dot: the actual planting point, which is what gets pegged out on site — the
    // canopy ring alone doesn't tell you where to dig.
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, Math.min(5, wPx * 0.05)), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    const rot = it.rot ?? 0;
    ctx.save();
    ctx.translate(cx, cy);
    if (rot) ctx.rotate((rot * Math.PI) / 180);
    ctx.beginPath();
    ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const shortPx = def.shape === 'circle' ? wPx : Math.min(wPx, hPx);
  if (shortPx >= 15) {
    // Icon upright (never rotated with the bed) and never larger than the footprint it sits in.
    ctx.font = `${Math.max(11, Math.min(26, shortPx * 0.6))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0B120B';
    ctx.fillText(def.icon, cx, cy);
  } else if (def.shape !== 'circle') {
    // Too small to host its icon and no trunk dot of its own — mark the spot, don't fake the size.
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** Biggest footprint first, so a pawpaw under a mango canopy is drawn last and stays visible.
 *  Ties break on id: two same-size trees must never swap order between renders (determinism is
 *  the product promise — same design in, same sheet out). */
function bySizeDesc(state: DesignCanvasState, filter: GlossyLayerFilter): PlacedItem[] {
  return state.items
    .filter((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      return !!def && itemInFilter(def.category, filter);
    })
    .sort((a, b) => {
      const da = ELEMENTS_BY_ID[a.defId], db = ELEMENTS_BY_ID[b.defId];
      const areaA = (a.wM ?? da.wM) * (a.hM ?? da.hM);
      const areaB = (b.wM ?? db.wM) * (b.hM ?? db.hM);
      return areaB - areaA || a.id.localeCompare(b.id);
    });
}

// Deterministic "Blueprint" PLANTING map — sheet 05 in docs/PLAN-SET-SPEC.md ("Planting &
// Agroforestry Plan"). Same chrome as the zone/water sheets; the content layer is every growing
// element at its TRUE canopy/bed footprint, coloured per SPECIES (def.color is a per-category
// accent — all 21 growing elements share one green — which is useless on the one sheet whose
// entire job is telling Macadamia from Citrus). Legend lists only the species actually placed,
// with counts. NO AI.
//
// NB: no lines are drawn here, deliberately. lineInFilter puts 'windbreak' on the STRUCTURES
// sheet, not this one, and layerContentCount agrees — so a windbreak is never counted as planting
// content. Drawing it here would make this sheet disagree with the layer it claims to be, which is
// precisely the guarantee the deterministic sheets exist to hold.
export async function buildBlueprintPlantingMap(
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

  // 1. Satellite + blueprint scrim.
  await drawBlueprintBase(ctx, frame, W, H);

  // 2. House + driveway as neutral context, UNDER the planting (this sheet's content is plants;
  //    the built stuff is only here so the farmer can orient — hence no dashed kerb).
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.85)', 'rgba(255,255,255,0.85)', 2.5);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);

  // 3. The planting itself, at true footprint.
  for (const it of bySizeDesc(state, 'planting')) {
    drawTrueFootprint(ctx, it, ELEMENTS_BY_ID[it.defId], px, py, pxPerM);
  }

  // 4. Boundary — green line with perpendicular fence ticks.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 5. Title (top-left).
  drawBlueprintTitle(ctx, W, pad, 'PLANTING & AGROFORESTRY PLAN', placeName ?? 'Planting plan');

  // 6. Legend (top-right) — the species actually present, then the fixed context rows.
  const rowH = Math.round(W * 0.026);
  const fixed: BlueprintLegendRow[] = [{ color: '#8CEB6A', label: 'Fence / site boundary', style: 'line' }];
  if (refLayers.driveway.length >= 2) fixed.push({ color: '#2A2A2E', label: 'Tarred driveway', style: 'fill' });
  const rows = fitLegendRows(speciesRowsFor(state, 'planting'), fixed, blueprintLegendCapacity(H, pad, rowH));
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 2.4)));
  const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Canopies drawn at mature spread.');

  // 7. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);

  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" STRUCTURES map — sheet 06 in docs/PLAN-SET-SPEC.md ("Small Livestock
// & Infrastructure Plan"). Structures + animals + access at true footprint, plus the access/
// boundary LINES (fence/path/windbreak) that lineInFilter assigns to this layer — a farmer who has
// drawn only paths and fences still has real structures-layer content (layerContentCount counts
// those lines), so this sheet must draw them or it would render empty on a design that isn't. NO AI.
export async function buildBlueprintStructuresMap(
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

  // 1. Satellite + blueprint scrim.
  await drawBlueprintBase(ctx, frame, W, H);

  // 2. House + driveway. On THIS sheet the built fabric is content, not background, so the
  //    driveway keeps the zone sheet's dashed kerb and the house gets a brighter outline.
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.9)', '#FFFFFF', 3);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, true);

  // 3. Access / boundary lines — white casing under a coloured line, as on the water sheet.
  const LINE_STYLE: Record<string, { color: string; dash: number[] }> = {
    path: { color: '#C9A227', dash: [] },
    fence: { color: '#8C8577', dash: [6, 4] },
    windbreak: { color: '#2F7A4A', dash: [] },
  };
  ctx.save();
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
  ctx.restore();

  // 4. Structures / animals / access, at true footprint.
  for (const it of bySizeDesc(state, 'structures')) {
    drawTrueFootprint(ctx, it, ELEMENTS_BY_ID[it.defId], px, py, pxPerM);
  }

  // 5. Boundary — green line with perpendicular fence ticks.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 6. Title (top-left).
  drawBlueprintTitle(ctx, W, pad, 'SMALL LIVESTOCK & INFRASTRUCTURE', placeName ?? 'Structures plan');

  // 7. Legend (top-right) — what's actually present, then the line kinds drawn, then context.
  const rowH = Math.round(W * 0.026);
  const kinds = new Set(state.lines.filter((l) => l.points.length >= 2).map((l) => l.kind));
  const fixed: BlueprintLegendRow[] = [];
  if (kinds.has('path')) fixed.push({ color: '#C9A227', label: 'Path', style: 'line' });
  if (kinds.has('windbreak')) fixed.push({ color: '#2F7A4A', label: 'Windbreak', style: 'line' });
  if (kinds.has('fence')) fixed.push({ color: '#8C8577', label: 'Internal fence', style: 'dashline' });
  fixed.push({ color: '#8CEB6A', label: 'Fence / site boundary', style: 'line' });
  if (refLayers.driveway.length >= 2) fixed.push({ color: '#2A2A2E', label: 'Tarred driveway', style: 'fill' });
  const rows = fitLegendRows(speciesRowsFor(state, 'structures'), fixed, blueprintLegendCapacity(H, pad, rowH));
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 2.4)));
  const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Footprints drawn at true size.');

  // 8. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);

  return canvas.toDataURL('image/png');
}

// ── Sheet 07: Implementation & Phasing ────────────────────────────────────────────────────────
// Contrast text for a number sitting on a phase-colour chip/pin. The phase palette spans chalk and
// light green (readable only with dark text) through to deep canopy green and magenta (readable
// only with white) — so the label colour is chosen from the chip's luminance, never fixed.
function readableTextOn(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length < 6) return '#FFFFFF';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Rec. 601 luma, 0..1. Above ~0.6 the chip is light enough that only dark text is legible.
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#0B120B' : '#FFFFFF';
}

/** North arrow on a translucent disc so it reads over any satellite. Frames are north-up with no
 *  rotation (CanvasFrame, lib/design-canvas.ts), so "up" is always true north — no bearing to apply. */
function drawImplNorthArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const R = size * 0.6;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(10,16,22,0.72)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Arrow: filled triangle pointing up, tail notched so it reads as a compass needle, not a play icon.
  ctx.beginPath();
  ctx.moveTo(cx, cy - R * 0.5);
  ctx.lineTo(cx - R * 0.32, cy + R * 0.34);
  ctx.lineTo(cx, cy + R * 0.16);
  ctx.lineTo(cx + R * 0.32, cy + R * 0.34);
  ctx.closePath();
  ctx.fillStyle = '#F3EEE2';
  ctx.fill();
  ctx.fillStyle = '#F3EEE2';
  ctx.font = `800 ${Math.round(size * 0.34)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - R * 0.52);
  ctx.restore();
}

// Deterministic SECTOR ANALYSIS sheet — plan-set 02 (analysis precedes design: the sector energies
// are WHY the zones/water/planting sit where they do). Draws the site's REAL energies — sun (from
// the north in the SH), summer/winter wind, dry-season fire approach, downslope water flow + on-
// contour lines, and frost drainage — from lib/sector.deriveSectorModel. Nothing is invented; each
// energy degrades independently when its data is missing. Same Blueprint chrome as sheets 03–08.
export async function buildBlueprintSectorMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: SectorSite | null,
  placeName?: string,
): Promise<string> {
  void state; // signature parity with the other builders; content is refLayers + site only
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
  const rowH = Math.round(W * 0.026);

  const model = deriveSectorModel(site, frame.centerLat);
  const isSH = model.southernHemisphere;

  // 1. Satellite + scrim.
  await drawBlueprintBase(ctx, frame, W, H);
  // 2. Orientation context ONLY — no zones/items/lines (analysis precedes design).
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.85)', 'rgba(255,255,255,0.85)', 2.5);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 3. Ring geometry — centre = boundary centroid (fallback frame centre); radius clamped so arrows
  //    + labels stay inside the frame and clear the top-right legend and top-left title.
  const bnd = refLayers.boundary;
  let cx = W / 2, cy = H / 2, siteR = Math.min(W, H) * 0.22;
  if (bnd.length >= 3) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0, sx = 0, sy = 0;
    for (const [x, y] of bnd) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); sx += x; sy += y; }
    cx = (sx / bnd.length) * W;
    cy = (sy / bnd.length) * H;
    siteR = 0.5 * Math.hypot((maxX - minX) * W, (maxY - minY) * H);
  }
  const margin = Math.round(W * 0.035);
  const arrowLen = Math.round(W * 0.055); // room for the tail + label outside the ring
  const maxRx = Math.min(cx - margin, W - margin - cx);
  const maxRy = Math.min(cy - margin, H - margin - cy);
  const R = Math.max(siteR * 0.7 + 10, Math.min(siteR + W * 0.02, Math.min(maxRx, maxRy) - arrowLen));

  // dashed compass ring + N/E/S/W ticks
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#D8DEE3';
  ctx.font = `700 ${Math.round(rowH * 0.6)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - R - rowH * 0.5);
  ctx.fillText('S', cx, cy + R + rowH * 0.5);
  ctx.fillText('E', cx + R + rowH * 0.55, cy);
  ctx.fillText('W', cx - R - rowH * 0.55, cy);
  ctx.restore();

  // Inward energy arrow: tail OUTSIDE the ring in `fromVec`, head INSIDE — energy entering the site.
  const drawArrow = (fromVec: [number, number], color: string, width: number, dash: number[], lenIn = R * 0.4) => {
    const sxp = cx + fromVec[0] * (R + arrowLen * 0.75), syp = cy + fromVec[1] * (R + arrowLen * 0.75);
    const exp = cx + fromVec[0] * (R - lenIn), eyp = cy + fromVec[1] * (R - lenIn);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(sxp, syp);
    ctx.lineTo(exp, eyp);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2(eyp - syp, exp - sxp);
    const ah = Math.max(9, width * 2.6);
    ctx.beginPath();
    ctx.moveTo(exp, eyp);
    ctx.lineTo(exp - ah * Math.cos(ang - 0.42), eyp - ah * Math.sin(ang - 0.42));
    ctx.lineTo(exp - ah * Math.cos(ang + 0.42), eyp - ah * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return { sxp, syp };
  };
  const labelAt = (x: number, y: number, text: string, color: string) => {
    ctx.save();
    ctx.font = `800 ${Math.round(rowH * 0.48)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(8,14,22,0.9)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // 4. FIRE wedge (under everything else) — a translucent sector from the dry-season wind direction.
  if (model.fire) {
    const v1 = bearingToUnitVector(model.fire.bearingDeg - 24);
    const v2 = bearingToUnitVector(model.fire.bearingDeg + 24);
    const rr = R * 1.16;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + v1[0] * rr, cy + v1[1] * rr);
    ctx.lineTo(cx + v2[0] * rr, cy + v2[1] * rr);
    ctx.closePath();
    ctx.fillStyle = 'rgba(214,74,42,0.20)';
    ctx.fill();
    ctx.restore();
    drawArrow(bearingToUnitVector(model.fire.bearingDeg), '#D64A2A', Math.max(3, W * 0.004), [10, 6]);
    const lp = bearingToUnitVector(model.fire.bearingDeg);
    labelAt(cx + lp[0] * (R + arrowLen * 0.95), cy + lp[1] * (R + arrowLen * 0.95), `FIRE — ${model.fire.fromLabel}`, '#F0A58C');
  }

  // 5. SUN — a bold gold arc across the sky on the equator-facing side (north for SH), + midday ray.
  const sunR = R + arrowLen * 0.45;
  ctx.save();
  ctx.strokeStyle = '#F7C97E';
  ctx.lineWidth = Math.max(3, W * 0.005);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI, isSH); // isSH=anticlockwise → arc over the TOP (north)
  ctx.stroke();
  const sunApexY = isSH ? cy - sunR : cy + sunR;
  ctx.beginPath();
  ctx.arc(cx, sunApexY, Math.max(7, W * 0.011), 0, Math.PI * 2);
  ctx.fillStyle = '#F7C97E';
  ctx.fill();
  ctx.restore();
  drawArrow(bearingToUnitVector(isSH ? 0 : 180), '#F7C97E', Math.max(3.5, W * 0.0045), []);
  labelAt(cx, isSH ? cy - sunR - rowH * 0.7 : cy + sunR + rowH * 0.7, `MIDDAY SUN — ${model.sun.middayFrom}`, '#F7C97E');

  // 6. WIND — summer + winter arrows entering from where the wind blows FROM.
  const windWidth = (spd?: number) => Math.max(2.5, (2 + Math.min(spd ?? 3, 8) * 0.5) * (W / 700));
  if (model.windSummer) {
    const v = bearingToUnitVector(model.windSummer.bearingDeg);
    drawArrow(v, '#E08A2C', windWidth(model.windSummer.speed), [9, 5]);
    labelAt(cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `SUMMER WIND ${model.windSummer.fromLabel}`, '#F0B76A');
  }
  if (model.windWinter) {
    const v = bearingToUnitVector(model.windWinter.bearingDeg);
    drawArrow(v, '#C97B25', windWidth(model.windWinter.speed), [9, 5]);
    labelAt(cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `WINTER WIND ${model.windWinter.fromLabel}`, '#E0A45A');
  }

  // 7. WATER — downslope arrow through the centre + on-contour lines (dashed = indicative / omitted when flat).
  if (model.water) {
    const dn = bearingToUnitVector(model.water.downhillBearingDeg);
    ctx.save();
    ctx.strokeStyle = '#3A8EC4';
    ctx.fillStyle = '#3A8EC4';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.setLineDash(model.water.indicative ? [8, 6] : []);
    ctx.lineCap = 'round';
    const wsx = cx - dn[0] * siteR * 0.7, wsy = cy - dn[1] * siteR * 0.7;
    const wex = cx + dn[0] * siteR * 0.9, wey = cy + dn[1] * siteR * 0.9;
    ctx.beginPath();
    ctx.moveTo(wsx, wsy);
    ctx.lineTo(wex, wey);
    ctx.stroke();
    ctx.setLineDash([]);
    const wang = Math.atan2(wey - wsy, wex - wsx);
    const wah = Math.max(10, W * 0.011);
    ctx.beginPath();
    ctx.moveTo(wex, wey);
    ctx.lineTo(wex - wah * Math.cos(wang - 0.42), wey - wah * Math.sin(wang - 0.42));
    ctx.lineTo(wex - wah * Math.cos(wang + 0.42), wey - wah * Math.sin(wang + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    labelAt(wex, wey + rowH * 0.55, `WATER FLOWS DOWNHILL${model.water.indicative ? ' (INDICATIVE)' : ''}`, '#8FD0F0');

    // On-contour lines only when the slope is steep enough to be meaningful (>=1.5°).
    if (!model.flat && bnd.length >= 3 && model.water.slopeDeg >= 1.5) {
      const contour = computeContourLines(model.water.slopeDeg, model.water.downhillBearingDeg, bnd, frame.mPerPx, frame.imgW, frame.imgH);
      if (!contour.tooFlat && contour.lines.length) {
        ctx.save();
        // clip to the boundary so the parallel lines don't spill past the plot
        blueprintRing(ctx, bnd, px, py);
        ctx.clip();
        ctx.strokeStyle = 'rgba(126,212,107,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 6]);
        for (const ln of contour.lines) {
          ctx.beginPath();
          ctx.moveTo(px(ln.a[0]), py(ln.a[1]));
          ctx.lineTo(px(ln.b[0]), py(ln.b[1]));
          ctx.stroke();
        }
        ctx.restore();
        const mid = contour.lines[Math.floor(contour.lines.length / 2)];
        if (mid) labelAt((px(mid.a[0]) + px(mid.b[0])) / 2, (py(mid.a[1]) + py(mid.b[1])) / 2, 'ON CONTOUR — SWALES RUN THIS WAY', '#B7E8A6');
      }
    }
  }

  // 8. FROST — icy dashed downslope arrow + frost-pocket ellipse at the low end.
  if (model.frost) {
    const dn = bearingToUnitVector(model.frost.downhillBearingDeg);
    const fx = cx + dn[0] * siteR * 0.85, fy = cy + dn[1] * siteR * 0.85;
    ctx.save();
    ctx.strokeStyle = '#9FD0E8';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.ellipse(fx, fy, Math.max(20, W * 0.026), Math.max(12, W * 0.016), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(159,208,232,0.16)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    labelAt(fx, fy, 'FROST POCKET', '#CDE7FA');
  }

  // 9. DATA STRIP under the title — real figures only, missing ones omitted.
  const parts: string[] = [];
  if (site?.elevation) parts.push(`SLOPE ${site.elevation.slopeDeg.toFixed(1)}° (${site.elevation.slopePct.toFixed(0)}%) FACING ${site.elevation.aspectLabel}`);
  if (site?.climate?.windSpeed != null) parts.push(`WIND ${site.climate.windSpeed.toFixed(1)} m/s`);
  if (site?.climate?.minTemp != null) parts.push(`MIN ${site.climate.minTemp.toFixed(0)}°C`);
  if (site?.rainfallMm != null) parts.push(`${Math.round(site.rainfallMm)} mm/yr`);
  if (parts.length) {
    ctx.save();
    ctx.fillStyle = '#B9C2C8';
    ctx.font = `600 ${Math.round(W * 0.013)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(parts.join('  ·  '), pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024) + Math.round(W * 0.022));
    ctx.restore();
  }

  // 10. Chrome — title, legend (only energies drawn), scale bar, north arrow.
  drawBlueprintTitle(ctx, W, pad, 'SECTOR ANALYSIS', placeName ?? 'Site energies · sun · wind · water · fire');
  const rows: BlueprintLegendRow[] = [{ color: '#F7C97E', label: `Midday sun (from ${model.sun.middayFrom})`, style: 'line' }];
  if (model.windSummer) rows.push({ color: '#E08A2C', label: `Summer wind (${model.windSummer.fromLabel})`, style: 'dashline' });
  if (model.windWinter) rows.push({ color: '#C97B25', label: `Winter wind (${model.windWinter.fromLabel})`, style: 'dashline' });
  if (model.fire) rows.push({ color: '#D64A2A', label: `Fire approach (${model.fire.fromLabel})`, style: 'dashline' });
  if (model.water) rows.push({ color: '#3A8EC4', label: 'Water flows downhill', style: 'line' });
  if (model.water && !model.flat && model.water.slopeDeg >= 1.5) rows.push({ color: '#7ED46B', label: 'On-contour (swale line)', style: 'dashline' });
  if (model.frost) rows.push({ color: '#9FD0E8', label: 'Frost pocket', style: 'dashline' });
  rows.push({ color: '#8CEB6A', label: 'Site boundary', style: 'line' });
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 2.6)));
  const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
  drawBlueprintLegendNote(ctx, lg, rowH, ry, model.dataNotes[0] ?? 'Read the site before you design it.');
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);
  drawImplNorthArrow(ctx, W - pad - Math.round(W * 0.04), H - pad - Math.round(W * 0.04), Math.round(W * 0.05));

  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" IMPLEMENTATION & PHASING sheet — sheet 08 in docs/PLAN-SET-SPEC.md,
// the product differentiator. This is the EXACT / reliable counterpart to the Gemini
// 'Implementation' ANALYSIS style: that one is an illustrated free-hand render (great to look at,
// not guaranteed); THIS one is a RULES-ENGINE render — lib/phasing.buildPhasePlan derives the
// phases deterministically from the placed design + the permaculture Scale of Permanence + the
// rainfall season, and we draw them precisely. Same chrome as sheets 03–06 (satellite + scrim, tar
// driveway, fence-tick boundary, title, scale) plus a north arrow. The content layer is numbered
// phase PINS at each phase's element centroid + a right-hand panel listing every phase (colour
// chip, number, title, week range, tasks, Hold Point), a CRITICAL ORDER list and a SITE RULES box.
export async function buildImplementationMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: DesignGlossyProps['site'],
  placeName?: string,
): Promise<string> {
  const plan = buildPhasePlan(state, refLayers, site);
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

  // 1. Satellite + scrim.
  await drawBlueprintBase(ctx, frame, W, H);

  // 2. Built context UNDER the pins — house, driveway, fence-tick boundary. On this sheet the built
  //    fabric is only orientation context, so the driveway keeps its plain (un-kerbed) treatment.
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.85)', 'rgba(255,255,255,0.85)', 2.5);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 3. Resolve each phase's pin position (normalised 0..1) as the centroid of the objects it builds.
  //    itemIds hold BOTH PlacedItem and LineShape ids (one id space), so a pin averages item points
  //    and line centroids together. The two bookend phases carry no elements, so they fall back to a
  //    semantic anchor: set-out starts at the gate (driveway head), commissioning ends at the house
  //    — distinct points, so the two never stack.
  const centroidOfPts = (pts: Array<[number, number]>): [number, number] | null => {
    if (!pts.length) return null;
    const n = pts.length;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  };
  const itemById = new Map(state.items.map((it) => [it.id, it]));
  const lineById = new Map(state.lines.map((l) => [l.id, l]));
  const houseC = centroidOfPts(refLayers.house);
  const gateC: [number, number] | null = refLayers.driveway.length >= 1 ? refLayers.driveway[0] : null;
  // Distinct bookend fallbacks. When NEITHER a driveway nor a house is traced, both bookends used
  // to collapse onto boundaryC/frameC and stack the "1" and last pins on the same spot. Anchor
  // set-out to the NW quarter and commissioning to the SE quarter of the boundary bbox (or fixed
  // offset points if there's no boundary) so they can never coincide.
  const bpts = refLayers.boundary;
  const bb = bpts.length
    ? { x0: Math.min(...bpts.map((p) => p[0])), y0: Math.min(...bpts.map((p) => p[1])), x1: Math.max(...bpts.map((p) => p[0])), y1: Math.max(...bpts.map((p) => p[1])) }
    : null;
  const nwAnchor: [number, number] = bb ? [bb.x0 + (bb.x1 - bb.x0) * 0.28, bb.y0 + (bb.y1 - bb.y0) * 0.28] : [0.4, 0.4];
  const seAnchor: [number, number] = bb ? [bb.x0 + (bb.x1 - bb.x0) * 0.72, bb.y0 + (bb.y1 - bb.y0) * 0.72] : [0.6, 0.6];
  const pinPos = (phase: (typeof plan.phases)[number]): [number, number] => {
    const pts: Array<[number, number]> = [];
    for (const id of phase.itemIds) {
      const it = itemById.get(id);
      if (it) { pts.push([it.x, it.y]); continue; }
      const ln = lineById.get(id);
      if (ln) { const c = centroidOfPts(ln.points); if (c) pts.push(c); }
    }
    const c = centroidOfPts(pts);
    if (c) return c;
    if (phase.key === 'setout') return gateC ?? nwAnchor;
    return houseC ?? seAnchor; // commissioning → hand over at the house (SE if no house traced)
  };

  // 4. Phase pins. Drawn BEFORE the panel: a pin whose centroid falls under the right-hand panel is
  //    hidden rather than floating over the legend — it is still fully described in the panel by the
  //    same number and colour, so nothing is lost. (Every sheet's legend covers some of the map;
  //    this panel is just taller. The phase palette is chosen to stay distinct on the dark scrim.)
  const pinR = Math.max(15, W * 0.015);
  for (const phase of plan.phases) {
    const [nx, ny] = pinPos(phase);
    const cx = px(nx), cy = py(ny);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, pinR, 0, Math.PI * 2);
    ctx.fillStyle = phase.colour;
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, pinR, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.fillStyle = readableTextOn(phase.colour);
    ctx.font = `bold ${Math.round(pinR * 1.15)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(phase.n), cx, cy);
  }

  // 5. Title (top-left).
  drawBlueprintTitle(ctx, W, pad, 'IMPLEMENTATION & PHASING', placeName ?? 'Build sequence & hold points');

  // 6. Scale bar + north arrow. Scale bottom-left as on every sheet; north on a disc just left of
  //    the panel's foot (this sheet adds a north arrow the other Blueprints still lack).
  const scaleRowH = Math.round(W * 0.026);
  drawBlueprintScaleBar(ctx, W, H, pad, scaleRowH, pxPerM);

  // 7. Right-hand panel — the phasing schedule. Wider than the legend panel (0.34 vs 0.27) because
  //    it carries wrapped phase text. Fonts are FIXED at the established readable size (~W·0.012,
  //    the legend body size); when content would overflow we shed task bullets and surplus site
  //    rules — never shrink the type — exactly as the spec requires ("fewer task bullets over
  //    unreadable text"). A hard clip at the panel foot guarantees nothing ever spills.
  const lgW = Math.round(W * 0.34);
  const lgX = W - pad - lgW;
  const lgY = pad;
  const lgBottom = H - pad;
  const ip = Math.round(lgW * 0.055);
  const innerX = lgX + ip;
  const innerW = lgW - ip * 2;
  const panelBottom = lgBottom - ip;

  ctx.fillStyle = 'rgba(10,16,22,0.86)';
  roundRectPath(ctx, lgX, lgY, lgW, lgBottom - lgY, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, lgX, lgY, lgW, lgBottom - lgY, 14);
  ctx.stroke();

  const fsHeader = Math.round(W * 0.019);
  const fsSection = Math.round(W * 0.0135);
  const fsBody = Math.round(W * 0.0118);
  const lineH = Math.round(fsBody * 1.42);
  const blockGap = Math.round(lineH * 0.55);
  const headerFont = `800 ${fsHeader}px system-ui, sans-serif`;
  const sectionFont = `800 ${fsSection}px system-ui, sans-serif`;
  const titleFont = `800 ${Math.round(W * 0.0135)}px system-ui, sans-serif`;
  const bodyFont = `500 ${fsBody}px system-ui, sans-serif`;
  const weekFont = `600 ${fsBody}px system-ui, sans-serif`;
  const holdFont = `italic 600 ${fsBody}px system-ui, sans-serif`;

  // Word-wrap to a pixel width in the given font. Returns at least one line.
  const wrap = (text: string, maxW: number, font: string): string[] => {
    ctx.font = font;
    const out: string[] = [];
    let cur = '';
    for (const word of text.split(/\s+/)) {
      const test = cur ? `${cur} ${word}` : word;
      if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = word; }
      else cur = test;
    }
    if (cur) out.push(cur);
    return out.length ? out : [text];
  };

  // Chip geometry (colour swatch carrying the phase number, mirroring the map pin).
  const chipS = Math.round(fsBody * 1.7);
  const titleX = innerX + chipS + Math.round(fsBody * 0.7);
  const titleW = lgX + lgW - ip - titleX;
  const bulletDotX = innerX + Math.round(fsBody * 0.2);
  const bulletTextX = innerX + Math.round(fsBody * 1.0);
  const bulletTextW = lgX + lgW - ip - bulletTextX;

  // ── Measurement (so we can size the phase area and pick the bullet cap) ──────────────────────
  const phaseBlockH = (phase: (typeof plan.phases)[number], bulletCap: number): number => {
    const titleLines = wrap(`${phase.title}`, titleW, titleFont).length;
    let h = Math.max(chipS, titleLines * lineH); // title row (chip beside wrapped title)
    h += lineH; // week range
    for (const t of phase.tasks.slice(0, bulletCap)) h += wrap(t, bulletTextW, bodyFont).length * lineH;
    h += wrap(phase.holdPoint, bulletTextW, holdFont).length * lineH; // hold point
    return h + blockGap;
  };
  const headerH = Math.round(fsHeader * 1.25) + lineH + Math.round(lineH * 0.6); // title + sub + divider
  const coLines = wrap(plan.criticalOrder.join('  →  '), innerW, bodyFont);
  const criticalH = plan.criticalOrder.length
    ? Math.round(fsSection * 1.3) + coLines.length * lineH + blockGap
    : 0;
  const siteRulesH = (maxRules: number): number => {
    if (!plan.siteRules.length) return 0;
    let h = Math.round(fsSection * 1.3);
    for (const r of plan.siteRules.slice(0, maxRules)) h += wrap(r, bulletTextW, bodyFont).length * lineH;
    return h + blockGap;
  };

  // One line of cushion so a small measurement under-estimate clips gracefully at the foot rather
  // than crowding it — the header/divider spacing rounds a hair looser than phaseBlockH models.
  const availH = panelBottom - (lgY + ip) - lineH;
  // Degrade to fit, most-expendable first: surplus site rules (beyond 4) → bullets to 2 → surplus
  // rules to 3 → bullets to 1 → rules to 2 → bullets to 0 → rules to 1. Keeps at least two bullets
  // and several rules for as long as the sheet has room; the type never changes size.
  let bulletCap = 3;
  let maxRules = plan.siteRules.length;
  const fits = () =>
    headerH + plan.phases.reduce((s, p) => s + phaseBlockH(p, bulletCap), 0) + criticalH + siteRulesH(maxRules) <= availH;
  while (!fits() && maxRules > 4) maxRules--;
  while (!fits() && bulletCap > 2) bulletCap--;
  while (!fits() && maxRules > 3) maxRules--;
  while (!fits() && bulletCap > 1) bulletCap--;
  while (!fits() && maxRules > 2) maxRules--;
  while (!fits() && bulletCap > 0) bulletCap--;
  while (!fits() && maxRules > 1) maxRules--;

  // ── Render top-down (with a hard clip at the panel foot as a belt-and-braces guard) ──────────
  let y = lgY + ip + Math.round(fsHeader * 0.9);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#F3EEE2';
  ctx.font = headerFont;
  ctx.fillText('PHASING PLAN', innerX, y);
  y += lineH;
  ctx.fillStyle = '#9AA6AC';
  ctx.font = `italic 500 ${fsBody}px system-ui, sans-serif`;
  ctx.fillText('Built exactly from your design — no AI.', innerX, y);
  y += Math.round(lineH * 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(lgX + lgW - ip, y);
  ctx.stroke();
  y += Math.round(lineH * 0.75);

  const drawLines = (lines: string[], x: number, font: string, color: string): void => {
    ctx.font = font;
    ctx.fillStyle = color;
    for (const ln of lines) {
      if (y > panelBottom) return;
      ctx.fillText(ln, x, y);
      y += lineH;
    }
  };

  for (const phase of plan.phases) {
    if (y > panelBottom) break;
    // Chip (colour swatch carrying the phase number) + wrapped title beside it. The chip is lifted
    // ~one cap-height above the first title baseline so number and title read on the same line.
    const titleLines = wrap(phase.title, titleW, titleFont);
    const chipTop = y - Math.round(fsBody * 0.95);
    ctx.fillStyle = phase.colour;
    roundRectPath(ctx, innerX, chipTop, chipS, chipS, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, innerX, chipTop, chipS, chipS, 4);
    ctx.stroke();
    ctx.fillStyle = readableTextOn(phase.colour);
    ctx.font = `bold ${Math.round(chipS * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(phase.n), innerX + chipS / 2, chipTop + chipS / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = titleFont;
    ctx.fillStyle = '#F3EEE2';
    let ty = y;
    for (const ln of titleLines) { if (ty <= panelBottom) ctx.fillText(ln, titleX, ty); ty += lineH; }
    // Advance below BOTH the chip and the (possibly multi-line) title.
    const lastTitleBaseline = y + (titleLines.length - 1) * lineH;
    y = Math.max(lastTitleBaseline, chipTop + chipS) + Math.round(lineH * 0.35);
    // Week range.
    drawLines([phase.weekRange], innerX, weekFont, '#C9D3D9');
    // Task bullets (capped).
    for (const t of phase.tasks.slice(0, bulletCap)) {
      if (y > panelBottom) break;
      const tl = wrap(t, bulletTextW, bodyFont);
      ctx.fillStyle = '#8CEB6A';
      ctx.font = bodyFont;
      ctx.fillText('•', bulletDotX, y);
      drawLines(tl, bulletTextX, bodyFont, '#E4E9EC');
    }
    // Hold point — the gate — in warm gold so it reads as a stop, not a bullet.
    const hl = wrap(phase.holdPoint, bulletTextW, holdFont);
    drawLines(hl, bulletTextX, holdFont, GOLD);
    y += blockGap;
  }

  // CRITICAL ORDER — the Scale-of-Permanence sequence made concrete for this design.
  if (plan.criticalOrder.length && y < panelBottom) {
    ctx.font = sectionFont;
    ctx.fillStyle = '#F7C97E';
    ctx.fillText('CRITICAL ORDER', innerX, y);
    y += Math.round(fsSection * 1.3);
    drawLines(coLines, innerX, bodyFont, '#E4E9EC');
    y += blockGap;
  }

  // SITE RULES — hard constraints derived from what is actually on the plan.
  if (plan.siteRules.length && y < panelBottom) {
    ctx.font = sectionFont;
    ctx.fillStyle = '#F19E9E';
    ctx.fillText('SITE RULES', innerX, y);
    y += Math.round(fsSection * 1.3);
    for (const r of plan.siteRules.slice(0, maxRules)) {
      if (y > panelBottom) break;
      ctx.fillStyle = '#F19E9E';
      ctx.font = bodyFont;
      ctx.fillText('!', bulletDotX, y);
      drawLines(wrap(r, bulletTextW, bodyFont), bulletTextX, bodyFont, '#E4E9EC');
    }
  }

  // North arrow, on its disc just left of the panel foot.
  const naSize = Math.max(30, Math.round(W * 0.026));
  drawImplNorthArrow(ctx, lgX - pad - naSize * 0.6, H - pad - naSize * 0.6, naSize);

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
    // One row per zone NUMBER, not per polygon — a site with three Zone-3 patches listed
    // "Zone 3 — Orchard / food forest" three times.
    const seen = new Set<number>();
    for (const z of [...state.zones].sort((a, b) => a.zone - b.zone)) {
      if (z.feature || z.points.length < 3 || seen.has(z.zone)) continue;
      seen.add(z.zone);
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

// How many cached renders we keep across ALL sites. Each is a full-res dataURL (2–8 MB of
// base64), and localStorage only has ~5–10 MB total. Unbounded, this cache silently ate the
// quota and starved the DESIGN's own save — a farmer lost their zones to it. Cached pictures are
// disposable; the design is not. Keep a couple, prune the rest, newest first.
const GLOSSY_CACHE_MAX = 2;

function pruneGlossyCache(keepKey: string) {
  try {
    const entries: Array<{ key: string; at: number }> = [];
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('imbewu_design_glossy_') || k === keepKey) continue;
      let at = 0;
      try {
        at = Date.parse((JSON.parse(localStorage.getItem(k) ?? '{}') as SavedGlossy).at) || 0;
      } catch {
        at = 0; // unparseable → oldest → first to go
      }
      entries.push({ key: k, at });
    }
    entries.sort((a, b) => b.at - a.at); // newest first
    for (const e of entries.slice(GLOSSY_CACHE_MAX - 1)) localStorage.removeItem(e.key);
  } catch {
    /* best effort */
  }
}

function saveGlossy(siteId: string, mapKey: string, saved: SavedGlossy) {
  const key = glossyKey(siteId, mapKey);
  pruneGlossyCache(key);
  try {
    localStorage.setItem(key, JSON.stringify(saved));
  } catch {
    // Still no room — drop every other cached render and try once. If it STILL fails we simply
    // don't cache: the render stays on screen for this session and the design's save is safe.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('imbewu_design_glossy_') && k !== key) localStorage.removeItem(k);
      }
      localStorage.setItem(key, JSON.stringify(saved));
    } catch {
      /* non-fatal — never let a cached picture cost the farmer their design */
    }
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
  // Non-alarming status line (green) — e.g. "used Gemini instead" after a gpt-image-2 fallback, or
  // "N sheets done" during Generate-all. Distinct from `error` so a SUCCESSFUL render never shows red.
  const [notice, setNotice] = useState<string | null>(null);
  // The active BACKGROUND render job (gpt-image-2 via the Cloud Function queue). null = none in flight.
  const [queueJobId, setQueueJobId] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGlossy | null>(null);
  const [filter, setFilter] = useState<GlossyLayerFilter>(initialFilter ?? 'all');
  // When set, an analysis map style is chosen instead of a design-layer filter — it always
  // renders via Gemini's generative path (see GLOSSY_STYLES). null = a design-layer map.
  const [analysisStyle, setAnalysisStyle] = useState<AnalysisStyle | null>(null);
  // When set, an illustrated "producer" style is chosen — renders via the boundary-locked
  // image-producer pipeline (compositeAccurateMap). null = a design/analysis map.
  const [producerStyle, setProducerStyle] = useState<string | null>(null);
  // The deterministic Implementation & Phasing sheet (plan-set 08). It is the EXACT counterpart to
  // the Gemini 'implementation' ANALYSIS style — a rules-engine render (lib/phasing), always
  // reliable — so it belongs with the exact Design maps, not the illustrated ones. When true it
  // overrides filter/analysis/producer for the render dispatch.
  // Which deterministic EXACT sheet (if any) is selected — the two rules-engine sheets (Sector 02,
  // Implementation 08) that carry their own chrome and override filter/analysis/producer. One union
  // state (not two booleans) makes the selection mutually exclusive by construction.
  const [exactSheet, setExactSheet] = useState<null | 'sector' | 'implementation'>(null);
  // Render engine. Gemini is the DEFAULT because gpt-image-2 (via fal.ai) frequently 403s
  // (fal/OpenAI verification); gpt-image-2 stays selectable and auto-falls-back to Gemini on error.
  const [engine, setEngine] = useState<'falgpt' | 'gemini'>('gemini');
  // Session-only gallery of every successful render (producer OR the strict/analysis paths).
  // Never persisted — kept only until the component unmounts.
  const [gallery, setGallery] = useState<Array<{ id: string; label: string; image: string }>>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryViewId, setGalleryViewId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A stable cache key per chosen map (producer style OR design filter OR analysis style).
  // Each map+style combination caches its own render (e.g. producer:storybook:zones).
  const mapKey = exactSheet === 'sector'
    ? 'sector-exact'
    : exactSheet === 'implementation'
      ? 'implementation-exact'
      : producerStyle
        ? `producer:${producerStyle}:${filter}`
        : (analysisStyle ?? filter);
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
    setNotice(null);
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
    if (layerContentCount(state, refLayers, filter) === 0) {
      setError(emptyLayerMessage(filter));
      return;
    }
    setLoading(engine);
    setError(null);
    setNotice(null);
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
      // b2. The WHOLE design as text — deliberately NOT filtered by `filter`, so every layer's
      //     render is handed the identical brief and the sheets agree with each other.
      const designBrief = buildDesignBrief(state, refLayers, placeName, site);
      // c. Beautify via the image-producer route (gemini engine; async path handled inside).
      //    EXCEPTION — the ZONES sheet does NOT run the model at all (Rory: "it musn't for the
      //    zones invent things underneath — it must just be the clean satellite image"). A zones
      //    map's whole job is "where are my zones on MY REAL LAND", so the AI can only add risk;
      //    the photograph IS the truth. We hand the real satellite straight through as the base —
      //    then buildZoneOverlay burns the exact zone regions + labels + sheet chrome on top,
      //    exactly as before. Result: instant, free, no ~5-min gpt-image-2 wait, never invented.
      let modelImage: string;
      if (filter === 'zones') {
        modelImage = frame.satDataUrl ?? composite;
      } else {
        try {
          modelImage = await requestProducer(stripDataUrl(composite), layerLabel, elementsText, producerStyle, producerEngine, designBrief);
        } catch (err) {
          // gpt-image-2 (via fal.ai) frequently returns 403 (fal/OpenAI verification). Don't fail
          // the whole render — fall back to the always-available Gemini engine and say so.
          if (producerEngine === 'openai') {
            setNotice('gpt-image-2 was unavailable — generated with Gemini Pro instead.');
            modelImage = await requestProducer(stripDataUrl(composite), layerLabel, elementsText, producerStyle, 'gemini', designBrief);
          } else {
            throw err;
          }
        }
      }
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
        filter === 'zones' ? buildZoneOverlay(state, refLayers, W, H)
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
    // `site` joins the deps because buildDesignBrief reads it for the CONTEXT line.
  }, [producerStyle, filter, engine, state, frame, refLayers, mapKey, pushGallery, placeName, site]);

  // Deterministic design-layer map — the ACCURATE-BY-CONSTRUCTION reference map.
  // Real satellite + your EXACT zones / elements / lines / labels drawn on top, and
  // NOTHING else. No model runs, so nothing can be invented (no imaginary lavender
  // field, orchard or veg beds — the "amazing picture but completely wrong" failure).
  // Instant, free, always correct. The illustrated "Style" buttons remain the AI
  // beautify path for when a farmer wants the artist's impression instead.
  const renderDesignMap = useCallback(async () => {
    if (layerContentCount(state, refLayers, filter) === 0) {
      setError(emptyLayerMessage(filter));
      return;
    }
    setLoading('exact');
    setError(null);
    try {
      // Every single-layer map now gets the deterministic "Blueprint" treatment (legend, scale,
      // fence ticks, true footprints) — the flat cartographic look ChatGPT nailed, but drawn
      // exactly from geometry. Only 'all' still falls through to the plain composite: the whole-
      // design sheet (07) has no Blueprint of its own yet — see docs/PLAN-SET-SPEC.md.
      const composite = filter === 'zones'
        ? await buildBlueprintZoneMap(state, frame, refLayers, placeName)
        : filter === 'water'
          ? await buildBlueprintWaterMap(state, frame, refLayers, placeName)
          : filter === 'planting'
            ? await buildBlueprintPlantingMap(state, frame, refLayers, placeName)
            : filter === 'structures'
              ? await buildBlueprintStructuresMap(state, frame, refLayers, placeName)
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

  // Deterministic Implementation & Phasing sheet (plan-set 08) — the RULES-ENGINE render. Unlike
  // the Gemini 'Implementation' analysis style, nothing here is drawn by a model: lib/phasing
  // derives the phases from the placed design + the Scale of Permanence + rainfall, and we draw
  // them exactly. Refuses (with the same "draw it first" honesty as the layer maps) when the design
  // has nothing to phase, so we never present an empty schedule as a finished plan.
  const renderImplementationMap = useCallback(async () => {
    const plan = buildPhasePlan(state, refLayers, site);
    if (plan.phases.length === 0) {
      setError(
        'Nothing to phase yet — trace your boundary and place some elements (water, beds, trees…) first. The implementation plan is built from your real design, never guessed.',
      );
      return;
    }
    setLoading('exact');
    setError(null);
    try {
      const composite = await buildImplementationMap(state, frame, refLayers, site, placeName);
      setResultImage(composite);
      const record: SavedGlossy = { image: composite, provider: 'exact', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      pushGallery('Implementation & phasing', composite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [state, frame, refLayers, site, mapKey, pushGallery, placeName]);

  // Deterministic SECTOR ANALYSIS sheet (plan-set 02) — the RULES-ENGINE render (lib/sector). Never
  // refuses: the sun is always real content and the sheet degrades honestly when slope/climate data
  // is missing, so it can't block the print set on a device-local cache.
  const renderSectorMap = useCallback(async () => {
    setLoading('exact');
    setError(null);
    try {
      const composite = await buildBlueprintSectorMap(state, frame, refLayers, site, placeName);
      setResultImage(composite);
      const record: SavedGlossy = { image: composite, provider: 'exact', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      pushGallery('Sector analysis', composite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [state, frame, refLayers, site, mapKey, pushGallery, placeName]);

  // "Generate all sheets" — Rory's ask: one tap for the WHOLE plan set, not one map at a time.
  // Uses the DETERMINISTIC exact renders (accurate by construction, instant, and — unlike
  // gpt-image-2 — they never 403) for every design layer that has content, plus the exact
  // Implementation & phasing sheet, dropping them all into the gallery ready to view or Print.
  // The illustrated AI Styles stay per-sheet (slow / experimental); the exact set IS the reliable
  // "all at once".
  const generateAllSheets = useCallback(async () => {
    setLoading('exact');
    setError(null);
    setNotice(null);
    let made = 0;
    const step = (label: string, image: string, cacheKey: string) => {
      try { saveGlossy(state.siteId, cacheKey, { image, provider: 'exact', at: new Date().toISOString() }); } catch { /* cache full — gallery still holds it */ }
      pushGallery(label, image);
      made += 1;
      setNotice(`Generating your plan set… ${made} sheet${made === 1 ? '' : 's'} done`);
    };
    try {
      // Canonical 8-map order (docs/PLAN-SET-SPEC.md). Analysis (02 Sector) before design.
      // 02 — Sector analysis (always: the sun is real content even before slope/climate load).
      step('02 · Sector analysis', await buildBlueprintSectorMap(state, frame, refLayers, site, placeName), 'sector-exact');
      // 03–06 — the design layers that have content.
      const layers: Array<{ f: GlossyLayerFilter; no: string; build: () => Promise<string> }> = [
        { f: 'zones', no: '03', build: () => buildBlueprintZoneMap(state, frame, refLayers, placeName) },
        { f: 'water', no: '04', build: () => buildBlueprintWaterMap(state, frame, refLayers, placeName) },
        { f: 'planting', no: '05', build: () => buildBlueprintPlantingMap(state, frame, refLayers, placeName) },
        { f: 'structures', no: '06', build: () => buildBlueprintStructuresMap(state, frame, refLayers, placeName) },
      ];
      for (const { f, no, build } of layers) {
        if (layerContentCount(state, refLayers, f) === 0) continue;
        step(`${no} · ${GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? f} map`, await build(), f);
      }
      // 07 — Final integrated masterplan (the whole design over the satellite).
      step('07 · Whole design (masterplan)', await buildComposite(state, frame, refLayers, 'all', true), 'all');
      // 08 — Implementation & phasing (exact rules-engine sheet), when there's anything to phase.
      const plan = buildPhasePlan(state, refLayers, site);
      if (plan.phases.length > 0) {
        step('08 · Implementation & phasing', await buildImplementationMap(state, frame, refLayers, site, placeName), 'implementation-exact');
      }
      setNotice(`Done — ${made} sheets in your gallery. Open it to view or Print the set.`);
      setGalleryViewId(null);
      setGalleryOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [state, frame, refLayers, site, placeName, pushGallery]);

  // "Generate ALL sheets in this style" — the AI counterpart Rory asked for ("generating all
  // images at once was best · gpt gave the best results"). Runs the full boundary-locked producer
  // pipeline for EVERY design layer in the chosen Style + engine, one after another, so the whole
  // illustrated plan set lands in the gallery from one tap. Each sheet inherits the same
  // gpt-image-2 → Gemini fallback as the single-sheet path, so a fal 403 degrades to Gemini rather
  // than aborting the batch. Slow by nature (one model call per sheet); the button warns about it.
  const generateAllStyledSheets = useCallback(async () => {
    // Default to Extension Blueprint when no Style is chosen, so this button always works.
    const styleKey = producerStyle ?? 'extension_blueprint';
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
    if (!producerStyle) setProducerStyle(styleKey); // reflect the default in the Style chips
    const producerEngine: 'gemini' | 'openai' = engine === 'gemini' ? 'gemini' : 'openai';
    setLoading(engine);
    setError(null);
    setNotice(null);
    const order: GlossyLayerFilter[] = ['all', 'water', 'zones', 'planting', 'structures'];
    let made = 0;
    let fellBack = false;
    try {
      const W = frame.imgW * SCALE;
      const H = frame.imgH * SCALE;
      for (const f of order) {
        if (layerContentCount(state, refLayers, f) === 0) continue;
        const layerLabel = f === 'all' ? 'Full design' : GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? 'Full design';
        const composite = await buildComposite(state, frame, refLayers, f);
        const elementsText = producerElementsText(state, refLayers, f);
        const designBrief = buildDesignBrief(state, refLayers, placeName, site);
        let modelImage: string;
        if (f === 'zones') {
          // Same rule as the single Zones sheet: never let the model invent under the zones.
          modelImage = frame.satDataUrl ?? composite;
        } else {
          try {
            modelImage = await requestProducer(stripDataUrl(composite), layerLabel, elementsText, styleKey, producerEngine, designBrief);
          } catch (err) {
            if (producerEngine === 'openai') {
              fellBack = true;
              modelImage = await requestProducer(stripDataUrl(composite), layerLabel, elementsText, styleKey, 'gemini', designBrief);
            } else {
              throw err;
            }
          }
        }
        const boundaryPx = refLayers.boundary.length >= 3 ? refLayers.boundary.flatMap(([x, y]) => [x * W, y * H]) : undefined;
        const labels = producerLabels(state, refLayers, W, H, f);
        const overlayImage =
          f === 'zones' ? buildZoneOverlay(state, refLayers, W, H)
          : f === 'water' ? buildWaterOverlay(state, frame, W, H)
          : undefined;
        const final = await compositeAccurateMap({
          modelImage,
          satelliteImage: frame.satDataUrl ?? composite,
          boundaryPx,
          overlayImage,
          labels,
          labelStyle: styleDef.labelStyle,
          width: W,
          height: H,
        });
        const sheet = await composeStyleSheet(final, state, frame, refLayers, f, placeName, styleDef.label, layerLabel);
        try {
          saveGlossy(state.siteId, `producer:${styleKey}:${f}`, {
            image: sheet,
            provider: producerEngine === 'openai' && !fellBack ? 'falgpt' : 'gemini',
            at: new Date().toISOString(),
          });
        } catch { /* cache full — gallery still holds it */ }
        pushGallery(`${layerLabel} · ${styleDef.label}`, sheet);
        made += 1;
        setNotice(`Styling your ${styleDef.label} plan set… ${made} sheet${made === 1 ? '' : 's'} done`);
      }
      if (made === 0) {
        setError('Nothing to style yet — trace your boundary and place some elements first.');
        setNotice(null);
      } else {
        setNotice(`Done — ${made} ${styleDef.label} sheets in your gallery${fellBack ? ' (gpt-image-2 unavailable → Gemini)' : ''}. Open it to view or Print.`);
        setGalleryViewId(null);
        setGalleryOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Render failed.');
    } finally {
      setLoading(null);
    }
  }, [producerStyle, engine, state, frame, refLayers, site, placeName, pushGallery]);

  // ── Background render queue (Stage 2) — gpt-image-2 direct via the Cloud Function ──────────────
  // The slow model call runs in functions/runRenderJob, NOT in the browser, so it escapes Vercel's
  // 60s wall and scales. The browser only builds each composite + prompt (client-side, so all the
  // exact-map logic stays here), hands them to the queue, then finishes each returned sheet with the
  // same deterministic composite-back the synchronous path uses.

  // Deterministic composite-back for one sheet: boundary clip + burned labels + sheet chrome.
  const finishStyledSheet = useCallback(
    async (modelImage: string, f: GlossyLayerFilter, styleDef: { label: string; labelStyle: LabelStyle }): Promise<string> => {
      const W = frame.imgW * SCALE;
      const H = frame.imgH * SCALE;
      const layerLabel = f === 'all' ? 'Full design' : GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? 'Full design';
      const boundaryPx = refLayers.boundary.length >= 3 ? refLayers.boundary.flatMap(([x, y]) => [x * W, y * H]) : undefined;
      const labels = producerLabels(state, refLayers, W, H, f);
      const overlayImage =
        f === 'zones' ? buildZoneOverlay(state, refLayers, W, H)
        : f === 'water' ? buildWaterOverlay(state, frame, W, H)
        : undefined;
      const final = await compositeAccurateMap({
        modelImage,
        satelliteImage: frame.satDataUrl ?? modelImage,
        boundaryPx,
        overlayImage,
        labels,
        labelStyle: styleDef.labelStyle,
        width: W,
        height: H,
      });
      return composeStyleSheet(final, state, frame, refLayers, f, placeName, styleDef.label, layerLabel);
    },
    [state, frame, refLayers, placeName],
  );

  // "AI · ALL sheets" when the engine is gpt-image-2: enqueue a background job for the model sheets
  // (Zones is satellite-only → produced exactly, here and now), then the subscription effect below
  // collects each finished sheet into the gallery as it lands.
  const generateAllViaQueue = useCallback(async () => {
    const styleKey = (producerStyle ?? 'extension_blueprint') as StylePreset;
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
    if (!producerStyle) setProducerStyle(styleKey);
    setError(null);
    setNotice(null);
    setLoading('falgpt');
    try {
      if (layerContentCount(state, refLayers, 'zones') > 0) {
        const base = frame.satDataUrl ?? (await buildComposite(state, frame, refLayers, 'zones'));
        const zsheet = await finishStyledSheet(base, 'zones', styleDef);
        try { saveGlossy(state.siteId, `producer:${styleKey}:zones`, { image: zsheet, provider: 'exact', at: new Date().toISOString() }); } catch { /* cache full */ }
        pushGallery(`Zones map · ${styleDef.label}`, zsheet);
      }
      const modelFilters: GlossyLayerFilter[] = ['all', 'water', 'planting', 'structures'];
      const designBrief = buildDesignBrief(state, refLayers, placeName, site);
      const sheets = [] as Array<{ key: string; label: string; prompt: string; compositeDataUrl: string }>;
      for (const f of modelFilters) {
        if (layerContentCount(state, refLayers, f) === 0) continue;
        const composite = await buildComposite(state, frame, refLayers, f);
        const elementsText = producerElementsText(state, refLayers, f);
        const layerLabel = f === 'all' ? 'Full design' : GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? 'Full design';
        const prompt = buildProducerPrompt(layerLabel, styleKey, elementsText, 'full', false, designBrief);
        sheets.push({ key: f, label: layerLabel, prompt, compositeDataUrl: composite });
      }
      if (sheets.length === 0) {
        setNotice(
          layerContentCount(state, refLayers, 'zones') > 0
            ? 'Zones sheet done. Add water, planting or structures for more.'
            : 'Nothing to render yet — place some elements first.',
        );
        setLoading(null);
        return;
      }
      const jobId = await enqueueRenderJob({ siteId: state.siteId, style: styleKey, engine: 'openai', sheets });
      persistJobId(state.siteId, jobId);
      setQueueJobId(jobId);
      setNotice(`Rendering ${sheets.length} sheet${sheets.length === 1 ? '' : 's'} in the background — they'll appear in your gallery when ready (a few minutes). You can keep working.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the render.');
      setLoading(null);
    }
  }, [producerStyle, state, frame, refLayers, site, placeName, finishStyledSheet, pushGallery]);

  // Refs so the subscription effect below doesn't re-subscribe on every design edit.
  const finishRef = useRef(finishStyledSheet);
  finishRef.current = finishStyledSheet;
  const styleRef = useRef(producerStyle);
  styleRef.current = producerStyle;

  // Stream the active job; finish each sheet as it completes; clear on a terminal status.
  useEffect(() => {
    if (!queueJobId) return;
    const siteId = state.siteId;
    const finished = new Set<string>();
    const unsub = subscribeRenderJob(
      queueJobId,
      async (job) => {
        if (!job) return;
        const styleKey = (styleRef.current ?? 'extension_blueprint') as StylePreset;
        const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
        for (const sheet of job.sheets) {
          if (sheet.status === 'done' && sheet.outputPath && !finished.has(sheet.key)) {
            finished.add(sheet.key); // BEFORE the await, so a re-fired snapshot can't double-finish
            try {
              const raw = await fetchRenderOutput(sheet.outputPath);
              const finalSheet = styleDef ? await finishRef.current(raw, sheet.key as GlossyLayerFilter, styleDef) : raw;
              try { saveGlossy(siteId, `producer:${styleKey}:${sheet.key}`, { image: finalSheet, provider: 'falgpt', at: new Date().toISOString() }); } catch { /* cache full */ }
              pushGallery(`${sheet.label} · ${styleDef?.label ?? ''}`, finalSheet);
            } catch (e) {
              console.error('[glossy] finishing a queued sheet failed', sheet.key, e);
            }
          }
        }
        if (job.status === 'complete' || job.status === 'failed' || job.status === 'error') {
          const done = job.sheets.filter((s) => s.status === 'done').length;
          const failed = job.sheets.filter((s) => s.status === 'error').length;
          if (done > 0) {
            setNotice(`Done — ${done} AI sheet${done === 1 ? '' : 's'} in your gallery${failed ? ` · ${failed} failed, try again` : ''}.`);
            setGalleryViewId(null);
            setGalleryOpen(true);
          } else {
            setError(job.error || 'The render did not complete — please try again.');
          }
          setLoading(null);
          clearPersistedJobId(siteId);
          setQueueJobId(null);
        }
      },
      () => {
        setError('Lost connection to the background render — it may still finish; reopen the Glossy step to check.');
        setLoading(null);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueJobId, state.siteId, pushGallery]);

  // Re-attach to an in-flight job after a reload / tab reopen (renders take minutes).
  useEffect(() => {
    const stored = readPersistedJobId(state.siteId);
    if (stored) {
      setLoading('falgpt');
      setNotice('Reconnecting to your background render…');
      setQueueJobId(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.siteId]);

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
          {/* Sheet 02 — the deterministic SECTOR ANALYSIS sheet. Analysis precedes design, so it
              leads the row. Exact (rules-engine, no AI), like the Implementation sheet. */}
          <button
            key="sector-exact"
            type="button"
            onClick={() => { setExactSheet('sector'); setAnalysisStyle(null); setProducerStyle(null); }}
            disabled={loading !== null}
            aria-pressed={exactSheet === 'sector'}
            title="Sun path, wind, water flow, fire & frost — drawn from your site's real slope and climate data (no AI)"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minHeight: 38,
              padding: '5px 14px',
              borderRadius: 19,
              border: exactSheet === 'sector' ? `2px solid ${GREEN}` : '1px solid rgba(31,77,43,0.4)',
              background: exactSheet === 'sector' ? GREEN : 'transparent',
              color: exactSheet === 'sector' ? PAPER : DARK,
              fontWeight: 700,
              fontSize: 13,
              cursor: loading !== null ? 'default' : 'pointer',
              opacity: loading !== null && exactSheet !== 'sector' ? 0.5 : 1,
            }}
          >
            <span>Sector analysis</span>
            <span style={{ fontSize: 10, fontWeight: 600, opacity: exactSheet === 'sector' ? 0.85 : 0.55 }}>
              sheet 02 · exact, no AI
            </span>
          </button>
          {GLOSSY_FILTERS.map((f) => {
            // A design layer stays selected even with an illustrated style chosen — the two
            // combine (e.g. Zones + Homestead Storybook). Analysis maps override the layer.
            const active = exactSheet === null && analysisStyle === null && filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => { setFilter(f.key); setAnalysisStyle(null); setExactSheet(null); }}
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
          {/* Sheet 07 — the deterministic Implementation & Phasing sheet. Exact (rules-engine, no
              AI), so it sits with the Design maps; a two-line chip marks it apart from the layer
              filters AND from the Gemini "Implementation" analysis chip below (which is the
              illustrated, less-reliable version). */}
          <button
            key="impl-exact"
            type="button"
            onClick={() => { setExactSheet('implementation'); setAnalysisStyle(null); setProducerStyle(null); }}
            disabled={loading !== null}
            aria-pressed={exactSheet === 'implementation'}
            title="Deterministic build sequence, hold points and site rules — derived from your design (no AI)"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              minHeight: 38,
              padding: '5px 14px',
              borderRadius: 19,
              border: exactSheet === 'implementation' ? `2px solid ${GREEN}` : '1px solid rgba(31,77,43,0.4)',
              background: exactSheet === 'implementation' ? GREEN : 'transparent',
              color: exactSheet === 'implementation' ? PAPER : DARK,
              fontWeight: 700,
              fontSize: 13,
              cursor: loading !== null ? 'default' : 'pointer',
              opacity: loading !== null && exactSheet !== 'implementation' ? 0.5 : 1,
            }}
          >
            <span>Implementation &amp; phasing</span>
            <span style={{ fontSize: 10, fontWeight: 600, opacity: exactSheet === 'implementation' ? 0.85 : 0.55 }}>
              sheet 08 · exact, no AI
            </span>
          </button>
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
                onClick={() => { setAnalysisStyle(s.key); setProducerStyle(null); setExactSheet(null); }}
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
                onClick={() => { setProducerStyle(producerStyle === s.key ? null : s.key); setAnalysisStyle(null); setExactSheet(null); }}
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
          {exactSheet === 'sector'
            ? "Draw your Sector Analysis sheet (plan-set 02) — the sun path (from the north), prevailing summer/winter winds, dry-season fire approach, downhill water flow with on-contour lines, and frost pockets, all read from your site's real slope and climate. Analysis comes before design: these energies are WHY your zones, water and planting belong where they do. Deterministic and exact — no AI."
            : exactSheet === 'implementation'
            ? 'Draw your Implementation & Phasing sheet (plan-set 08) — the build order, week ranges, hold points, critical order and site rules, all worked out from your real design by the rules engine (permaculture Scale of Permanence + your rainfall). Deterministic and exact: no AI, no guessing. This is the reliable version of the illustrated Implementation analysis map.'
            : producerStyle
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
              {exactSheet === 'sector'
                ? ' · Sector analysis (sheet 02)'
                : exactSheet === 'implementation'
                ? ' · Implementation & phasing (sheet 08)'
                : producerStyle
                ? ` · ${filter === 'all' ? 'Whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} · ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label}`
                : analysisStyle
                  ? ` · ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} map`
                  : filter !== 'all'
                    ? ` · ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map`
                    : ''}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultImage}
              alt={exactSheet ? 'Deterministic plan sheet of the design' : "AI artist's impression of the design"}
              style={{ width: '100%', display: 'block' }}
            />
            <div style={{ padding: '10px 14px', background: DARK, color: PAPER, fontSize: 12, opacity: 0.75 }}>
              {exactSheet
                ? 'Deterministic plan sheet — built from your design + site data by the rules engine, no AI.'
                : 'AI artist’s impression of YOUR design — the canvas is the exact version.'}
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
        {/* Two "generate everything" paths, side by side, with the trade-off spelled out (Rory:
            "should say non-ai for all sheets and then ai for all sheets, explaining the drawbacks
            of both"). Both produce the WHOLE plan set in one tap; they differ exact-vs-beautified. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 14,
            border: '1px solid rgba(31,77,43,0.25)',
            background: 'rgba(31,77,43,0.04)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.6 }}>
            Generate every sheet at once
          </div>

          {/* NON-AI — exact deterministic set */}
          <button
            onClick={generateAllSheets}
            disabled={loading !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              minHeight: 50,
              padding: '12px 20px',
              borderRadius: 12,
              border: 'none',
              background: GREEN,
              color: PAPER,
              fontWeight: 800,
              fontSize: 15,
              cursor: loading !== null ? 'default' : 'pointer',
              opacity: loading !== null ? 0.7 : 1,
            }}
          >
            <Images size={18} />
            {loading === 'exact' ? 'Drawing your plan set…' : 'Non-AI · ALL sheets (exact)'}
          </button>
          <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.5 }}>
            <strong>Reliable choice.</strong> Your real satellite + exact geometry for every layer
            (Whole · Water · Zones · Planting · Structures · Implementation). Instant, never invented,
            ready to <strong>Print</strong>. Drawback: plain — no artistic styling.
          </div>

          {/* AI — illustrated set in a Style (defaults to Extension Blueprint). gpt-image-2 runs in
              the BACKGROUND queue (direct OpenAI, escapes the 60s wall); Gemini stays synchronous. */}
          <button
            onClick={engine === 'gemini' ? generateAllStyledSheets : generateAllViaQueue}
            disabled={loading !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              minHeight: 48,
              padding: '11px 18px',
              borderRadius: 12,
              border: `2px solid ${GREEN}`,
              background: 'transparent',
              color: GREEN,
              fontWeight: 800,
              fontSize: 14.5,
              cursor: loading !== null ? 'default' : 'pointer',
              opacity: loading !== null ? 0.6 : 1,
            }}
          >
            <Gem size={17} />
            {loading !== null && loading !== 'exact' ? 'Styling every sheet… hang on' : 'AI · ALL sheets (illustrated)'}
          </button>
          <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.5 }}>
            <strong>Beautiful, less exact.</strong> An artist's impression of every layer in a Style
            {producerStyle ? ` (${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label})` : ' (defaults to Extension Blueprint — pick another below)'}.
            {engine === 'gemini'
              ? ' Runs now with Gemini (~a minute per sheet, varies shot to shot).'
              : ' With gpt-image-2 it renders in the BACKGROUND — sharpest result, takes a few minutes; the sheets drop into your gallery when ready and you can keep working or come back.'}
          </div>
        </div>

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
            exactSheet === 'sector'
              ? renderSectorMap()
              : exactSheet === 'implementation'
                ? renderImplementationMap()
                : producerStyle
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
            : exactSheet === 'sector'
              ? `${resultImage ? 'Redraw' : 'Draw'} my sector analysis sheet · instant`
            : exactSheet === 'implementation'
              ? `${resultImage ? 'Redraw' : 'Draw'} my implementation & phasing sheet · instant`
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
        {notice && !error && <p style={{ color: GREEN, fontSize: 12.5, fontWeight: 600 }}>{notice}</p>}
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
