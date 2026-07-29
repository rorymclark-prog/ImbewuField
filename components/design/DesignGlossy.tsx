'use client';

// Design Studio final plan-sheet renderer. The model may paint background texture, but
// the app owns factual geometry, placed features, labels and sheet chrome. Satellite
// Overlay remains the explicit model-authored comparison/rollback style.

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Download, RefreshCw, Gem, FlaskConical, Images, X, Trash2, Share2 } from 'lucide-react';

import polygonClipping from 'polygon-clipping';

import type { CanvasFrame, DesignCanvasState, GroundFeatureKind, LineShape, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { pointInRing } from '@/lib/design-canvas';
import type { DesignElementDef } from '@/lib/design-elements';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID } from '@/lib/design-elements';
import { GROUND_FEATURES, ZONE_DEFS } from '@/lib/design-elements';
import { requestRender, stripDataUrl, pollFalRender } from '@/lib/ai-render-client';
import { compositeAccurateMap, measureRenderDifference, restoreProtectedPixels, type LabelStyle, type ProducerLabel } from '@/lib/image-producer';
import { paidRenderDecision } from '@/lib/render-difference';
import { polishedRenderPoints, type RenderPoint } from '@/lib/render-geometry';
import { buildPhasePlan } from '@/lib/phasing';
import { deriveSectorModel, bearingToUnitVector, type SectorSite, type SectorModel } from '@/lib/sector';
import type { SolarModel } from '@/lib/solar';
import { computeContourLines } from '@/lib/contours';
import {
  gateBoundaryBreaks,
  boundarySegmentsWithBreaks,
  type GateLike as GateLikeGeom,
  type FrameLike as BoundaryFrameGeom,
} from '@/lib/boundary-geometry';
import { buildFinishedSheetPolishPrompt, buildLockedIllustrationPrompt, buildPhasingRestylePrompt, buildSatelliteOverlayPrompt, buildSectorRestylePrompt, buildSectorSheetPolishPrompt, isModelChromeStyle, buildProducerPrompt, buildProducerPromptLegacy, buildShowcasePrompt, buildShowcasePromptLegacy, SHEET_NO, type StylePreset } from '@/lib/producer-prompt';
import { enqueueRenderJob, subscribeRenderJob, fetchRenderOutput } from '@/lib/render-jobs';
// Extracted (behaviour-preserving) — see lib/glossy-filters.ts and lib/producer-labels.ts.
// Re-exported below so existing consumers (lib/producer-prompt.ts comments, app/design/page.tsx,
// components/design/DesignPrint.tsx) keep importing them from this module unchanged.
import {
  cartographicItemPaintRank,
  itemInFilter,
  lineInFilter,
  zonesInFilter,
  sheetForElement,
  isContextElement,
  layerContentCount,
  groundRegister,
  EXACT_CONTEXT_ALPHA,
  INTEGRATED_LEGEND_FAMILIES,
  exactSheetElementLegendGroups,
  REFERENCE_SHEET_LABEL,
  type GlossyLayerFilter,
} from '@/lib/glossy-filters';
import { producerLabels, plotBox } from '@/lib/producer-labels';
import { leaderLabelFontSize, placeLeaderLabel, stackLeaderRows, leaderPath } from '@/lib/leader-labels';
import { exactModelInputMarks, polishModelInputMarks, RENDERED_DRIVEWAY_EDGE, renderAuthorityFlagsForStyle, renderPolicyForStyle } from '@/lib/render-policy';
import { WATER_LEGEND_SECTION_ORDER, WATER_ROUTE_STYLE, nearestWaterNeighbourPx, waterFeaturePresentationDimensions, waterLegendSectionForFeature, waterLegendSectionForRoute, waterRouteLegendEntries, waterRoutesWithVisualBridges, waterRouteStyleFor, type WaterLegendSection } from '@/lib/water-cartography';
import { PLANTING_LEGEND_SECTION_ORDER, plantingFeaturePresentationDimensions, plantingLegendSectionForFeature, plantingRouteStyleFor, type PlantingLegendSection } from '@/lib/planting-cartography';
import { STRUCTURES_LEGEND_SECTION_ORDER, structuresFeaturePresentationDimensions, structuresLegendSectionForFeature, structuresRouteVisualFor, type StructuresLegendSection } from '@/lib/structures-cartography';
import { presentSectorCartography, sectorEvidenceSummary, SECTOR_STYLES, sectorFillColor, sectorStrokeWidth, type SectorLegendIcon, type SectorVisualKind } from '@/lib/sector-cartography';
import { referenceFeatureArtworkUrl } from '@/lib/reference-feature-art';
import { countedLegendText, legendRowGap } from '@/lib/sheet-legend-layout';
import { deriveWaterSystem } from '@/lib/water-system';
import { drawCartographicWaterSymbol } from '@/lib/cartographic-water-symbols';
import { drawCartographicStructureSymbol } from '@/lib/cartographic-structure-symbols';
import {
  fullTreatmentProtectPolicy,
  lockedPolishAction,
  lockedPolishStyle,
  type SheetOutputMode,
} from '@/lib/locked-polish-flow';
import { sheetRenderRoute, DEFAULT_PRODUCER_STYLE, type SheetSpec, type SheetRoutePath } from '@/lib/sheet-render-route';
import {
  calculateBoundaryPresentationLayout,
  calculatePhasingSheetSize,
  styleSheetLegendWidth,
} from '@/lib/reference-presentation';
import { loadSheets, saveSheet, deleteSheet, clearSheets, type SheetProvider, type SheetResultKind } from '@/lib/sheet-store';
import { formatDesignTranslation } from '@/lib/design-studio-i18n';
import { useLanguage } from '@/lib/i18n';
export { itemInFilter, lineInFilter, zonesInFilter, layerContentCount } from '@/lib/glossy-filters';
export type { GlossyLayerFilter } from '@/lib/glossy-filters';

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
    focus: 'a WATER-PLAN background: cool blue-green ground wash and damp soil tones on the open ground, with clear breathing room for labels, legend sections and callouts',
    emphasise: [
      'tint the editable open ground with a soft blue-green wash so the map reads as a water plan',
      'every blue mark already drawn (tank circles, swale/pipe/drip lines, ponds) stays exactly as drawn — brighten the ground AROUND each one, never redraw, thicken, move or duplicate the mark itself',
      'keep the layout editorial and legible, with a right-hand legend block and short label pills BESIDE the real water marks',
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

/** Round posts evenly along a fence run. ONE definition, called by both the AI composite and the
 *  deterministic Structures sheet — they had drifted into two different-looking fences, which meant
 *  a single plan set showed the same fence two ways. `scale` lets the deterministic sheets (which
 *  draw at logical frame size) match the composite (which draws at SCALE×). */
function drawFencePosts(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
  scale: number,
): void {
  if (points.length < 2) return;
  const posts: Array<[number, number]> = [[px(points[0][0]), py(points[0][1])]];
  for (let i = 0; i < points.length - 1; i++) {
    const ax = px(points[i][0]), ay = py(points[i][1]);
    const bx = px(points[i + 1][0]), by = py(points[i + 1][1]);
    const n = Math.max(1, Math.round((Math.hypot(bx - ax, by - ay) || 1) / (14 * scale)));
    for (let k = 1; k <= n; k++) posts.push([ax + (bx - ax) * (k / n), ay + (by - ay) * (k / n)]);
  }
  for (const [cx, cy] of posts) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3.2 * scale, 0, Math.PI * 2);
    ctx.fillStyle = LINE_COLORS.fence;
    ctx.fill();
    ctx.strokeStyle = '#FFFEFA';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
  }
}

/** Boundary fence bone. Deliberately NOT in the green family: every planting fill, the windbreak
 *  line and the drip runs are greens, and a green ring around the plot was read as a planted row.
 *  Bone reads as built infrastructure at any zoom, on pale ground and dark. */
const BOUNDARY_BONE = '#EDE7D9';

/** TAR. One constant, and deliberately near-black rather than slate.
 *
 *  It used to be #3B3A3E in the composite — which is, to within a rounding error, the #3C4247 slate
 *  that prompt rule 1 names as the colour of every ROOF. So we handed the model a slate-grey polygon
 *  beside a house and told it slate-grey polygons are roofs, and it drew the driveway as a roof,
 *  render after render (Rory: "the driveway is a big issue it makes it a roof!!!"). Three commits
 *  attacked that with prompt wording — flat, no thickness, no walls, never a slab or a roof — while
 *  the picture kept saying roof.
 *  #12140F is the near-black tar the prompt's own palette has always named, so image and brief now
 *  agree, and it cannot be confused with a slate roof at any exposure.
 *  Also collapses three colours that shipped simultaneously (#3B3A3E drawn, #2A2A2E legend swatch,
 *  #12140F stated) — an audit finding from docs/LAYER-AUDIT-2026-07-20.md. */
// Existing access is context on every design sheet, not the visual subject. A near-black fill made
// the driveway compete with water, planting and infrastructure, especially on the dark satellite
// base. Keep it recognisably asphalt while letting the designed systems read first.
export const TAR = '#454842';

const LINE_COLORS: Record<string, string> = {
  swale: '#4EA6D8',
  fence: '#8E7CC3', // dusty violet — distinct from boundary-green; CAD convention for fencing
  path: '#C9A227',
  pipe: WATER_ROUTE_STYLE.pipe.color,
  drip: WATER_ROUTE_STYLE.drip.color,
  windbreak: '#2F7A4A',
  // Violet — the reclaimed-water pipe convention — and more saturated than the fence lilac so a
  // greywater run and an internal fence can never read as the same line.
  greywater: WATER_ROUTE_STYLE.greywater.color,
};

// Gemini is listed first and is the DEFAULT: gpt-image-2 (via fal.ai) frequently returns 403
// (fal/OpenAI verification), so it can't be the reliable default. When it IS picked and fails,
// generateProducer falls back to Gemini automatically (see the try/catch there).
// Gemini is switched OFF (Rory, 2026-07-18) — every AI render now goes to gpt-image-2. The
// 'gemini' key is kept in the union only so the legacy branches still type-check; nothing offers
// it. (The single-option picker below hides itself.)
const ENGINES: Array<{ key: 'falgpt' | 'gemini'; label: string; sub: string }> = [
  { key: 'falgpt', label: 'gpt-image-2', sub: 'sharpest · background (~mins)' },
];

const GLOSSY_FILTERS: Array<{ key: GlossyLayerFilter; label: string }> = [
  { key: 'all', label: 'Whole design' },
  { key: 'zones', label: 'Zones' },
  { key: 'water', label: 'Water' },
  { key: 'planting', label: 'Planting' },
  { key: 'structures', label: 'Structures' },
];

// The canonical plan set (docs/PLAN-SET-SPEC.md), shown as ONE numbered 01–08 list in the
// Design-maps picker so it reads exactly like the printed set — analysis (01–02) before design
// (03–07) before implementation (08). EVERY sheet has BOTH an AI version (the default) and an
// exact/no-AI version (the option), chosen with the mode switch:
//   • 01/02/08 are analytical — their EXACT render is a rules-engine sheet (exactSheet), and their
//     AI render is the matching Gemini analysis map (aiAnalysis: base/sector/implementation), i.e.
//     the old "Analysis maps" row, now folded into these sheets.
//   • 03–07 are design layers — EXACT is the deterministic blueprint (filter alone), AI is the
//     image-producer / gpt-image-2 showcase pipeline (filter + a Style).
// `'exact' in sheet` narrows to the analytical variant.
type DesignSheet =
  | { no: string; label: string; exact: 'base' | 'sector' | 'implementation'; aiAnalysis: AnalysisStyle }
  | { no: string; label: string; filter: GlossyLayerFilter };
// Short labels (Rory's mockup): the grid packs 4-up on a phone, so one word each.
const DESIGN_SHEETS: DesignSheet[] = [
  { no: '01', label: 'Site', exact: 'base', aiAnalysis: 'base' },
  { no: '02', label: 'Sector', exact: 'sector', aiAnalysis: 'sector' },
  { no: '03', label: 'Zones', filter: 'zones' },
  { no: '04', label: 'Water', filter: 'water' },
  { no: '05', label: 'Planting', filter: 'planting' },
  { no: '06', label: 'Structures', filter: 'structures' },
  { no: '07', label: 'Whole', filter: 'all' },
  { no: '08', label: 'Phasing', exact: 'implementation', aiAnalysis: 'implementation' },
];
// DEFAULT_PRODUCER_STYLE now lives in lib/sheet-render-route.ts (imported above) so that pure lib
// has no dependency on this component; every call site here keeps the same name.

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
// so accuracy is guaranteed by construction. Seven researched site-plan styles.
// swatch = the card's colour chip (Rory's mockup shows each style as a card with a colour block).
const PRODUCER_STYLES: Array<{ key: StylePreset; label: string; blurb: string; labelStyle: LabelStyle; swatch: string; recommended?: boolean }> = [
  // labelStyle is required by the type but unused here: this style always takes the showcase path,
  // which passes labels: [] because the MODEL letters the sheet itself.
  { key: 'satellite_overlay',   label: 'Satellite Overlay',   blurb: 'experimental · AI controls the labels and layout', labelStyle: 'clean', swatch: 'linear-gradient(135deg,#12140F 0%,#2F4A2A 55%,#B4E000 100%)' },
  { key: 'precision_atlas',      label: 'Reference Blueprint', blurb: 'benchmark look · exact geometry, labels and layout', labelStyle: 'reference', swatch: 'linear-gradient(135deg, #526B59 0%, #A9B58B 45%, #D9C89F 100%)', recommended: true },
  { key: 'field_ledger',        label: 'Field Ledger',        blurb: 'hand-inked surveyor plan',      labelStyle: 'ink',       swatch: '#E4D8B8' },
  { key: 'homestead_storybook', label: 'Homestead Storybook', blurb: 'warm illustrated garden map',   labelStyle: 'storybook', swatch: '#8FAE62' },
  { key: 'extension_blueprint', label: 'Extension Blueprint', blurb: 'clean plan for funders/mentors', labelStyle: 'blueprint', swatch: '#69819B' },
  { key: 'chatgpt_atlas',       label: 'ChatGPT Atlas',       blurb: 'polished editorial cartography', labelStyle: 'blueprint', swatch: '#B7B09D' },
  { key: 'karoo_folk',          label: 'Karoo Folk Map',      blurb: 'bold folk-art farm map',         labelStyle: 'folk',      swatch: '#B5502E' },
  { key: 'master_atlas',        label: 'Master Atlas',        blurb: 'engraved masterplan for boards & funders', labelStyle: 'blueprint', swatch: 'linear-gradient(135deg, #2B2E33 0%, #3E4A5C 55%, #B08D3E 100%)' },
];

// Sector's paid polish starts from a complete exact sheet. Satellite Overlay is omitted because
// its prompt expects editor markers on a photograph, not a finished analytical page. Every style
// shown here supports the same full-sheet AI polish route.
const SECTOR_STYLE_CHOICES = PRODUCER_STYLES.filter((s) => s.key !== 'satellite_overlay');

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
  if (z.zone !== 0) {
    for (const footprint of authoritativeHouseFootprints(state, refLayers)) cutters.push([footprint]);
  }
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
function emptyLayerMessage(filter: GlossyLayerFilter, t: (key: string) => string): string {
  const step = EMPTY_LAYER_STEP[filter];
  if (filter === 'all') return t('designGlossyEmptyAll');
  return formatDesignTranslation(t('designGlossyEmptyLayer'), {
    step,
    stepLower: step.toLowerCase(),
  });
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
  geometryLock?: boolean;
  onGeometryLockChange?: Dispatch<SetStateAction<boolean>>;
  // Seed the layer selector (e.g. a per-step "Preview this map" opener). Defaults to 'all'.
  initialFilter?: GlossyLayerFilter;
}

/**
 * Every saved built footprint is structural authority, regardless of which tracing surface
 * created it. Older projects can carry the house in refLayers while Design Studio projects store
 * it as a ground-feature zone. Render safety must protect and restore both forms.
 */
export function authoritativeHouseFootprints(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
): Array<Array<[number, number]>> {
  const footprints: Array<Array<[number, number]>> = [];
  if (refLayers.house.length >= 3) footprints.push(refLayers.house);
  for (const zone of state.zones) {
    if (zone.feature === 'house' && zone.points.length >= 3) footprints.push(zone.points);
  }
  return footprints;
}

export const SCALE = 2;

export interface CompositeMarkOptions {
  showToolGlyphs?: boolean;
  showDrivewayEdge?: boolean;
  showDesignLines?: boolean;
  showDesignItems?: boolean;
  showHouseMark?: boolean;
  showDrivewayMark?: boolean;
}

// Satellite Overlay keeps the real photograph, so the driveway needs no painted stand-in: drawing
// the dark slab into the INPUT is what made the model reproduce it as a bold black polygon
// competing with the design. Left alone, the photo's own access track reads exactly as it should —
// quiet grey. Tool glyphs go too; they are editor chrome, and this style letters its own sheet.
const OVERLAY_COMPOSITE_MARKS: CompositeMarkOptions = {
  // KEEP the tool glyphs. Every marker footprint is the same translucent green, so the little
  // emoji is the ONLY thing in the image that says which circle is a mango and which is a moringa.
  // Suppressing them (to stop emoji being lettered onto the sheet) left the model guessing, and it
  // guessed — trees landed in each other's places and elements appeared that were never listed.
  // The prompt already handles the lettering risk: it states that the glyph identifies the marker
  // and that the finished icon replaces the whole marker, glyph included.
  showToolGlyphs: true,
  showDrivewayMark: false,
  showDrivewayEdge: false,
};

function lockedCompositeMarks(filter: GlossyLayerFilter): CompositeMarkOptions {
  return exactModelInputMarks(filter);
}

interface ProtectMaskOptions {
  protectOutside?: boolean;
  protectLines?: boolean;
  protectItems?: boolean;
  protectBoundary?: boolean;
  protectDriveway?: boolean;
  protectUnmarkedGround?: boolean;
  editableItemScale?: number;
  houseHaloRatio?: number;
  houseFeatherRatio?: number;
}

function lockedProtectMaskOptions(filter: GlossyLayerFilter): ProtectMaskOptions {
  const structural = {
    protectOutside: true,
    protectLines: false,
    protectItems: false,
    protectUnmarkedGround: true,
    houseHaloRatio: 0.003,
    houseFeatherRatio: 0.0012,
  };
  return filter === 'water'
    ? { ...structural, protectBoundary: true, protectDriveway: true }
    : structural;
}

/**
 * Sector analysis protects factual existing fabric without freezing the plot interior. This leaves
 * room for an illustrated sector underlayer while keeping every house, access route and site edge
 * byte-exact after the model returns.
 */
function sectorProtectMaskOptions(): ProtectMaskOptions {
  return {
    protectOutside: true,
    protectBoundary: true,
    protectDriveway: true,
    protectLines: false,
    protectItems: false,
    protectUnmarkedGround: false,
    houseHaloRatio: 0.003,
    houseFeatherRatio: 0.0012,
  };
}

/**
 * NO_OVERLAY_MASK — Satellite Overlay deliberately sends NO protect mask. Measured, not assumed.
 *
 * The idea was to protect the roof so it could not be merged into the tar driveway. It backfired
 * twice over on a real render:
 *
 *   1. buildProtectMask only draws the house when refLayers.house has >= 3 points. A farmer whose
 *      house is a ground-FEATURE zone (the common case) has no house ref, so the mask came out
 *      100% transparent / 0% protected.
 *   2. A fully transparent mask is not a no-op at the edits endpoint. It is an explicit statement
 *      that EVERY pixel is editable — so the model discarded the supplied aerial photograph and
 *      generated a completely different farm, which is the one failure this style cannot have.
 *
 * The mask-free render keeps the photograph intact and the roof correct, so the prompt alone is
 * carrying it. If the roof ever needs hard protection, the mask must first be built from the house
 * feature zone as well as refLayers.house, and must never be sent when it protects nothing.
 */
const UNUSED_OVERLAY_PROTECT_MASK_OPTIONS: ProtectMaskOptions = {
  protectOutside: false,
  protectBoundary: false,
  protectDriveway: false,
  protectLines: false,
  protectItems: false,
  houseHaloRatio: 0.002,
  houseFeatherRatio: 0.001,
};

export function drawMarks(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  imgW: number,
  imgH: number,
  filter: GlossyLayerFilter = 'all',
  drawDesign = true,
  options: CompositeMarkOptions = {},
) {
  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;
  const showToolGlyphs = options.showToolGlyphs !== false;
  const showDrivewayEdge = RENDERED_DRIVEWAY_EDGE && options.showDrivewayEdge !== false;
  const showDesignLines = options.showDesignLines !== false;
  const showDesignItems = options.showDesignItems !== false;
  const showHouseMark = options.showHouseMark !== false;
  const showDrivewayMark = options.showDrivewayMark !== false;
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
    // CHARTREUSE, not planting green. This was #8CEB6A — the same green family as the planting
    // element fills (mulch_bank #7D9A4A, vetiver_row #4E8B3B) and the windbreak line #2F7A4A — while
    // the prompt tells the model the boundary is "a bright chartreuse #B4E000 line". So the image
    // and the brief disagreed, and the one long green ring on the sheet was easy to read as a
    // planted row. Now the composite says exactly what the prompt says.
    ctx.strokeStyle = 'rgba(180,224,0,0.95)'; // #B4E000
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // House rings — both legacy ref-layer houses and Studio-traced house feature zones are facts.
  if (showHouseMark) {
    for (const footprint of authoritativeHouseFootprints(state, refLayers)) {
      ctx.beginPath();
      footprint.forEach(([x, y], i) => {
        const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
        fn.call(ctx, px(x), py(y));
      });
      ctx.closePath();
      // OUTLINE ONLY — the roof inside stays the photograph.
      //
      // This used to fill the footprint with #8A8D91 at 65%. Rory, looking at a finished sheet:
      // "the quality of the polygons everything is just not good at all". Those were the three flat
      // grey slabs sitting where his buildings are — they read as unrendered placeholder boxes, and
      // they were the single most damaging thing on the page.
      //
      // The fill was never going to work. It was a placeholder the model was asked to convert into
      // a roof (rule 8: "the pale grey shape with the white outline is the ROOF"), but the same
      // prompt tells it every unmarked pixel is the photograph exactly as supplied — so it reads a
      // grey slab as photograph and leaves it. Worse, buildProtectMask protects every house
      // footprint unconditionally and restores it byte-for-byte afterwards, so even a model that
      // DID repaint the roof would have its work copied over. No prompt wording could have fixed
      // this; the pixels were guaranteed to come back.
      //
      // So stop covering the roof. The satellite already contains a real roof, photographed from
      // above, with its true ridges, wings and shadow. Painting over it destroyed the one piece of
      // ground truth we had and replaced it with a grey rectangle. The outline still tells both the
      // model and the reader exactly where the building is — bright, and thicker than before so it
      // survives the crop — and the earlier "driveway bleeds into the house" failure stays fixed,
      // because a photographed roof was never the near-black the model mistook for tar.
      ctx.strokeStyle = 'rgba(255,255,255,0.96)';
      ctx.lineWidth = 3.5;
      ctx.stroke();
    }
  }

  // Driveway — a real tar/asphalt road (dark carriageway + light kerb casing) so it reads as a
  // surfaced vehicle track on EVERY map, exact or illustrated (Rory: "build in the driveway as
  // tar coloured for all designs"). Drawing it dark in the composite also nudges the AI Styles to
  // render it as tar rather than repainting it as a garden path.
  if (showDrivewayMark && refLayers.driveway.length >= 2) {
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
      ctx.fillStyle = TAR;
      ctx.fill();
      if (showDrivewayEdge) {
        ctx.strokeStyle = 'rgba(233,229,221,0.92)';
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    } else {
      // The unlocked legacy input keeps its light kerb casing. Geometry Lock uses a clean,
      // unbordered carriageway because the casing was being restored as a false driveway edge.
      const roadW = Math.min(46, Math.max(11, pxPerM * 3)); // ~3 m carriageway, clamped
      if (showDrivewayEdge) {
        tracePath();
        ctx.strokeStyle = 'rgba(233,229,221,0.92)';
        ctx.lineWidth = roadW + 5;
        ctx.stroke();
      }
      tracePath();
      ctx.strokeStyle = TAR;
      ctx.lineWidth = roadW;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Traced ground — lawn/veg garden/orchard/patio/cleared, plus a Studio-traced house or driveway
  // not already covered by refLayers above. NOT gated on drawDesign: DesignPrint's sheet 01
  // "Existing Site & Base" calls buildComposite(...,'all',false), and that sheet's whole subject
  // IS existing fabric, so a ground wash drawn only when drawDesign is true would never reach the
  // one sheet where it matters most. Fill only, at low alpha, with no stroke and no glyph — the
  // same discriminator the zone-band wash below relies on to read as an area, not a marker.
  {
    const houseCovered = showHouseMark && authoritativeHouseFootprints(state, refLayers).length > 0;
    const drivewayCovered = refLayers.driveway.length >= 2;
    // THE ACCESS TRACK AS FABRIC. OVERLAY_COMPOSITE_MARKS sets showDrivewayMark:false so the tar
    // stops competing with the design — but the consequence was that the driveway was in the
    // composite NOWHERE, and the model cannot preserve a surface it was never shown. Rule 1 telling
    // it "hard surfaces stay hard surfaces" is unenforceable against a blank patch of lawn, which
    // is why Rory's driveway kept disappearing on every AI sheet. Drawn here as quiet ground —
    // tar-toned, low alpha, no kerb, no outline, no label — it is present for the model to keep and
    // still recedes behind the design.
    if (drivewayCovered && !showDrivewayMark) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = TAR;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      refLayers.driveway.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, px(x), py(y)));
      if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
        ctx.closePath();
        ctx.fillStyle = TAR;
        ctx.fill();
      } else {
        ctx.lineWidth = Math.min(46, Math.max(11, pxPerM * 3)); // ~3 m carriageway, clamped
        ctx.stroke();
      }
      ctx.restore();
    }
    const groundRings = state.zones.filter((z) => {
      if (!z.feature || z.points.length < 3) return false;
      if (z.feature === 'house') return !houseCovered;
      if (z.feature === 'driveway') return !drivewayCovered;
      // A Studio-traced boundary is the whole-plot ring, drawn above as the chartreuse #B4E000
      // survey line (drawBlueprintBoundary's composite counterpart) — never a fill wash. Missing
      // this exclusion here painted a near-full-frame #8CEB6A tint under the design, which is the
      // exact green-family confusion the boundary recolour above exists to prevent (ghost-vetiver
      // finding 2). drawBlueprintGround (:2206) and groundRows (:2580) already exclude it.
      if (z.feature === 'boundary') return false;
      return true;
    });
    // Biggest first — a lawn that wraps a veg patch must not bury the patch's own wash.
    const sortedGround = [...groundRings].sort((a, b) => ringArea(b.points) - ringArea(a.points));
    for (const z of sortedGround) {
      const meta = GROUND_FEATURES[z.feature!];
      ctx.beginPath();
      z.points.forEach(([x, y], i) => {
        const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
        fn.call(ctx, px(x), py(y));
      });
      ctx.closePath();
      ctx.fillStyle = `${meta.color}33`;
      ctx.fill();
    }
    // Sheet 01 ("Existing site & base") had zero ground name labels — groundLabelsForSheet was
    // called from exactly one place (buildBlueprintSectorMap, sheet 02 only). Wired in here, gated
    // on the EXACT parameters sheet 01's own call site passes (buildComposite(...,'all',false)),
    // so this never fires on the AI-composite paths that reuse buildComposite with drawDesign:true
    // or a narrower filter (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §4a).
    if (!drawDesign && filter === 'all') {
      drawBlueprintLabelPills(ctx, groundLabelsForSheet(state, refLayers, imgW, imgH));
    }
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
      ctx.font = `bold 18px ${SHEET_BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(String(zone.zone), cx, cy);
    }
  }

  // Lines
  for (const line of drawDesign && showDesignLines ? state.lines : []) {
    if (line.points.length < 2 || !lineInFilter(line.kind, filter)) continue;
    ctx.beginPath();
    line.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.strokeStyle = LINE_COLORS[line.kind] ?? '#8C8577';
    ctx.lineWidth = line.kind === 'fence' ? 3 : 4;
    if (line.kind === 'swale' || line.kind === 'path') ctx.setLineDash([6, 4]);
    else ctx.setLineDash([]); // fence is SOLID (dashed reads as underground/proposed) — posts mark it
    ctx.stroke();
    ctx.setLineDash([]);
    // Post-and-wire fence: round posts along the line (violet), never the boundary's ticks.
    if (line.kind === 'fence') drawFencePosts(ctx, line.points, px, py, SCALE);
  }

  // Items — footprint + emoji label. NB: this canvas may be SCALE× the logical frame
  // (imgW = frame.imgW × SCALE), so convert metres → CANVAS px via the canvas's own
  // width (pxPerM, computed above) — sizing in logical px would draw every footprint at half scale.
  // TWO PASSES, BIGGEST FOOTPRINT FIRST.
  //
  // These used to draw in raw array order with opaque glyphs, so a later item simply erased an
  // earlier one. Measured on the owner's real 46-item design: eleven collisions, including the
  // chicken tractor being painted over by a vegetable bed — it was never in the image the model
  // saw, which is why the sheet drew no chicken tractor where he had placed one. Sorting by
  // footprint means a 6 m canopy can no longer bury a 1 m tank, and splitting footprints from
  // glyphs means no glyph is hidden under a neighbour's fill.
  const visible = (drawDesign && showDesignItems ? state.items : []).filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return def && itemInFilter(def.category, filter, def.id);
  });
  // CONTEXT ELEMENTS — drawn, but not this sheet's content. See contextElementNames: the Water
  // sheet has to show the beds and basins its drip and greywater lines run TO, or the routes cross
  // empty lawn and the plan is unreadable. Naming them in the prompt is not enough; the model
  // places from the picture, so if a bed is not in the composite it is not on the sheet. Drawn
  // FIRST and faintly, so this sheet's own water elements always sit on top of them.
  const contextItems = (drawDesign && showDesignItems ? state.items : []).filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return def && !itemInFilter(def.category, filter, def.id) && isContextElement(def, filter);
  });
  if (contextItems.length) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    for (const item of contextItems) {
      const def = ELEMENTS_BY_ID[item.defId]!;
      const wLogical = (item.wM ?? def.wM) * pxPerM;
      const hLogical = (item.hM ?? def.hM) * pxPerM;
      const cx = px(item.x);
      const cy = py(item.y);
      ctx.fillStyle = def.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      if (def.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(cx, cy, wLogical / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.save();
        ctx.translate(cx, cy);
        if (item.rot) ctx.rotate((item.rot * Math.PI) / 180);
        ctx.fillRect(-wLogical / 2, -hLogical / 2, wLogical, hLogical);
        ctx.strokeRect(-wLogical / 2, -hLogical / 2, wLogical, hLogical);
        ctx.restore();
      }
    }
    ctx.restore();
  }
  const footM2 = (it: PlacedItem) => {
    const def = ELEMENTS_BY_ID[it.defId];
    return (it.wM ?? def.wM) * (it.hM ?? def.hM);
  };
  const ordered = [...visible].sort((a, b) => footM2(b) - footM2(a));

  const glyphJobs: Array<{ cx: number; cy: number; size: number; icon: string; small: boolean }> = [];

  for (const item of ordered) {
    const def = ELEMENTS_BY_ID[item.defId]!;
    const wM = item.wM ?? def.wM;
    const hM = item.hM ?? def.hM;
    const wLogical = wM * pxPerM;
    const hLogical = hM * pxPerM;
    const cx = px(item.x);
    const cy = py(item.y);
    ctx.fillStyle = `${def.color}55`;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2 * SCALE;
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
    // A tap's footprint is ~6 px while its glyph is 14 px: the emoji is bigger than the element it
    // marks and hides the footprint that encodes its true size. Small elements get their glyph
    // OUTSIDE the footprint on a hairline leader, so both the position and the size stay readable.
    const size = Math.max(14 * SCALE, Math.min(56 * SCALE, wLogical * 0.35));
    glyphJobs.push({ cx, cy, size, icon: def.icon, small: wLogical < 12 * SCALE });
  }

  if (showToolGlyphs) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const placed: Array<{ x: number; y: number; r: number }> = [];
    for (const g of glyphJobs) {
      let gx = g.cx;
      let gy = g.cy;
      const r = g.size * 0.6;
      if (g.small) gy = g.cy - (g.size * 0.5 + 6 * SCALE); // lift clear of a tiny footprint
      // Push radially off any glyph already placed, so no two emoji overlap into mush.
      for (let guard = 0; guard < 12; guard++) {
        const hit = placed.find((q) => Math.hypot(q.x - gx, q.y - gy) < q.r + r);
        if (!hit) break;
        const dx = gx - hit.x || 0.001;
        const dy = gy - hit.y || 0.001;
        const d = Math.hypot(dx, dy);
        gx = hit.x + (dx / d) * (hit.r + r + 1);
        gy = hit.y + (dy / d) * (hit.r + r + 1);
      }
      if (gx !== g.cx || gy !== g.cy) {
        ctx.strokeStyle = 'rgba(11,18,11,0.55)';
        ctx.lineWidth = 1 * SCALE;
        ctx.beginPath();
        ctx.moveTo(g.cx, g.cy);
        ctx.lineTo(gx, gy);
        ctx.stroke();
      }
      ctx.font = `${g.size}px ${SHEET_GLYPH_FONT}`;
      ctx.fillStyle = '#0B120B';
      ctx.fillText(g.icon, gx, gy);
      placed.push({ x: gx, y: gy, r });
    }
  }
}

export async function buildComposite(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter = 'all',
  drawDesign = true,
  options: CompositeMarkOptions = {},
): Promise<string> {
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

  drawMarks(ctx, state, frame, refLayers, imgW, imgH, filter, drawDesign, options);

  // PNG (not JPEG): the render must key on the thin drawn geometry lines, and JPEG ringing
  // softens them. The route wraps this as image/png — keep the formats in lockstep.
  return canvas.toDataURL('image/png');
}

async function buildProtectMask(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter = 'all',
  options: ProtectMaskOptions = {},
): Promise<string> {
  const imgW = frame.imgW * SCALE;
  const imgH = frame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = imgW;
  canvas.height = imgH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Fully transparent = editable everywhere, by default.
  ctx.clearRect(0, 0, imgW, imgH);

  const px = (n: number) => n * imgW;
  const py = (n: number) => n * imgH;
  const maskPxPerM = imgW / (frame.imgW * frame.mPerPx);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';

  // A locked Hybrid is not permission to reinterpret the whole property. Start protected and
  // punch out only narrow regions around saved design content. The model may add texture there;
  // untouched lawn, neighbouring land and every unmarked patch are restored from the source.
  if (options.protectUnmarkedGround) {
    ctx.fillRect(0, 0, imgW, imgH);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';

    // Effort-zone boundaries get a modest editable band, not a whole editable field where an AI
    // could invent buildings or gardens. The exact zone polygons are burned back afterwards.
    if (zonesInFilter(filter)) {
      for (const zone of state.zones) {
        if (zone.feature || zone.points.length < 3) continue;
        ctx.beginPath();
        zone.points.forEach(([x, y], i) => {
          const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
          fn.call(ctx, px(x), py(y));
        });
        ctx.closePath();
        ctx.lineWidth = Math.max(16 * SCALE, maskPxPerM * 1.5);
        ctx.stroke();
      }
    }

    for (const line of state.lines) {
      if (line.points.length < 2 || !lineInFilter(line.kind, filter)) continue;
      ctx.beginPath();
      line.points.forEach(([x, y], i) => {
        const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
        fn.call(ctx, px(x), py(y));
      });
      ctx.lineWidth = Math.max(18 * SCALE, maskPxPerM * 2.5);
      ctx.stroke();
    }

    for (const item of state.items) {
      const def = ELEMENTS_BY_ID[item.defId];
      if (!def || (!itemInFilter(def.category, filter, def.id) && !isContextElement(def, filter))) continue;
      const editableItemScale = options.editableItemScale ?? 1.7;
      const w = Math.max(14 * SCALE, (item.wM ?? def.wM) * maskPxPerM * editableItemScale);
      const h = Math.max(14 * SCALE, (item.hM ?? def.hM) * maskPxPerM * editableItemScale);
      const cx = px(item.x);
      const cy = py(item.y);
      ctx.save();
      ctx.translate(cx, cy);
      if (item.rot) ctx.rotate((item.rot * Math.PI) / 180);
      ctx.beginPath();
      if (def.shape === 'circle') {
        ctx.arc(0, 0, Math.max(w, h) / 2, 0, Math.PI * 2);
      } else {
        ctx.rect(-w / 2, -h / 2, w, h);
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#FFFFFF';
  }

  // Whole authoritative house polygons protected, including Studio-traced feature zones.
  for (const footprint of authoritativeHouseFootprints(state, refLayers)) {
    ctx.beginPath();
    footprint.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    // Protect a polygon-shaped halo as well as the footprint. This clears any AI roof that
    // spills just beyond the traced outline without restoring a conspicuous rectangular block
    // of raw satellite around the house. A soft outer fringe blends the restored ground back
    // into the painted ground; the footprint and inner halo stay fully opaque/pixel-exact.
    const houseHaloRadius = Math.max(
      4 * SCALE,
      Math.round((options.houseHaloRatio ?? 0.018) * Math.max(imgW, imgH)),
    );
    const houseFeather = Math.max(
      2 * SCALE,
      Math.round((options.houseFeatherRatio ?? 0.005) * Math.max(imgW, imgH)),
    );
    ctx.save();
    ctx.filter = `blur(${houseFeather}px)`;
    ctx.globalAlpha = 0.78;
    ctx.lineWidth = (houseHaloRadius + houseFeather) * 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fill();
    ctx.lineWidth = houseHaloRadius * 2;
    ctx.stroke();
  }

  // Strict sheets protect ALL land OUTSIDE the property boundary. Showcase sheets leave the page
  // margins editable so GPT can draw its own title/legend there; the boundary ring below remains
  // locked in both modes. Even-odd fill = the whole canvas rect minus the boundary polygon.
  if (options.protectOutside !== false && refLayers.boundary.length >= 3) {
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
  if (options.protectBoundary !== false && refLayers.boundary.length >= 3) {
    ctx.beginPath();
    refLayers.boundary.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.lineWidth = 8 * SCALE;
    ctx.stroke();
  }

  // Protect the driveway's actual surface, not a generic centre-line band. A closed driveway is
  // an area polygon, so its entire fill is locked; an open trace uses the same ~3 m width as the
  // source composite. This keeps the road exact without restoring a decorative kerb around it.
  if (options.protectDriveway !== false && refLayers.driveway.length >= 2) {
    ctx.beginPath();
    refLayers.driveway.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 3 * SCALE;
      ctx.stroke();
    } else {
      ctx.lineWidth = Math.min(46, Math.max(11, maskPxPerM * 3)) + 2 * SCALE;
      ctx.stroke();
    }
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
  for (const line of options.protectLines === false ? [] : state.lines) {
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
  for (const item of options.protectItems === false ? [] : state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !itemInFilter(def.category, filter, def.id)) continue;
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

/**
 * Downscales a saved sheet's full render (1-3 MB, per lib/sheet-store.ts's own sizing note) into a
 * small JPEG for gallery grid display. The grid used to point every thumbnail's <img> straight at
 * the full-resolution PNG data URL — a farmer with a few dozen saved maps (very plausible after
 * iterating across all 8 sheets x 3 output modes) was decoding tens of MB of image data into the DOM
 * at once, on a phone, just to show 3-column thumbnails. JPEG at moderate quality is fine here
 * because this is presentation-only: the full-resolution image is what's actually saved and shown
 * in the zoomed detail view; this function never touches or replaces it.
 */
async function makeGalleryThumbnail(dataUrl: string, maxSize = 240): Promise<string | undefined> {
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.72);
  } catch {
    return undefined; // the grid falls back to the full image — never block a save on a thumbnail
  }
}

// AI-painted feature art is generated once, shipped with the app, and reused without another paid
// model call. The exact renderer waits for only the assets present on this sheet; failures fall back
// to drawTrueFootprint's deterministic vector treatment rather than failing a paid render.
const referenceFeatureArtworkCache = new Map<string, HTMLImageElement>();

async function preloadReferenceFeatureArtwork(
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  _frame?: CanvasFrame,
): Promise<void> {
  const urls = new Set<string>();
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || (
      !itemInFilter(def.category, filter, def.id)
      && !isContextElement(def, filter)
    )) continue;
    const url = referenceFeatureArtworkUrl(def.id);
    if (url && !referenceFeatureArtworkCache.has(url)) urls.add(url);
  }
  await Promise.all([...urls].map(async (url) => {
    try {
      referenceFeatureArtworkCache.set(url, await loadImage(url));
    } catch (error) {
      console.warn('[glossy] painted feature asset unavailable; using exact fallback', url, error);
    }
  }));
}

/**
 * Extend a map composite rightward with a BLANK cream legend panel and a dark sheet frame.
 *
 * Satellite Overlay needs a map on the left and a legend column on the right, but the edits
 * endpoint returns an image aspect-matched to its INPUT. Asking for that layout in words alone
 * forces the model to shrink and reposition the photograph to make room — and the moment the photo
 * has to move, the model REGENERATES it rather than preserving it, which is exactly the "smoothed
 * pseudo-aerial, no grain" failure this style exists to avoid. Building the empty panel into the
 * input means the photograph never moves: the model only letters the panel and overlays the map.
 */
/** Burn a MAP-shaped transparent overlay onto the map half of a SHEET-shaped model render.
 *
 *  Satellite Overlay is handed a sheet (map on the left, cream legend panel on the right, see
 *  extendWithLegendPanel) and returns one. Any deterministic overlay we want to guarantee — the
 *  exact zone regions today, sector bearings next — is drawn in MAP coordinates, so it has to be
 *  placed into the map region alone or it would smear across the legend.
 *
 *  Everything is done in PROPORTIONS rather than the pixel sizes we sent, because the model returns
 *  whatever canvas size it likes. The overlay itself carries the authoritative map aspect, so its
 *  width at the returned sheet height identifies the map panel without a second legend-width rule. */
async function burnOverlayOnSheetMap(sheetDataUrl: string, overlayDataUrl: string): Promise<string> {
  const [sheet, overlay] = await Promise.all([loadImage(sheetDataUrl), loadImage(overlayDataUrl)]);
  const canvas = document.createElement('canvas');
  canvas.width = sheet.naturalWidth || sheet.width;
  canvas.height = sheet.naturalHeight || sheet.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(sheet, 0, 0);
  const overlayWidth = overlay.naturalWidth || overlay.width;
  const overlayHeight = overlay.naturalHeight || overlay.height;
  const mapW = Math.min(canvas.width, canvas.height * (overlayWidth / overlayHeight));
  ctx.drawImage(overlay, 0, 0, mapW, canvas.height);
  return canvas.toDataURL('image/png');
}

async function extendWithLegendPanel(
  mapDataUrl: string,
  W: number,
  H: number,
): Promise<{ dataUrl: string; width: number; height: number }> {
  const panelW = styleSheetLegendWidth(W);
  const outW = W + panelW;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: mapDataUrl, width: W, height: H };
  const img = await loadImage(mapDataUrl);
  ctx.fillStyle = '#12140F'; // sheet frame / bleed
  ctx.fillRect(0, 0, outW, H);
  ctx.drawImage(img, 0, 0, W, H);
  ctx.fillStyle = '#F6F1E4'; // blank cream panel, for the model to letter
  ctx.fillRect(W, 0, panelW, H);
  return { dataUrl: canvas.toDataURL('image/png'), width: outW, height: H };
}

/**
 * Widen a map-sized protect mask onto the sheet canvas, leaving the legend column editable.
 *
 * The mask must match the MODEL OUTPUT's dimensions or restoreProtectedPixels scales it and the
 * protected region lands in the wrong place — so once the input is sheet-shaped, the mask must be
 * too. The panel stays fully transparent because the model has to be free to letter it.
 */
async function extendMaskWithPanel(maskDataUrl: string, W: number, H: number): Promise<string> {
  const outW = W + styleSheetLegendWidth(W);
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return maskDataUrl;
  const img = await loadImage(maskDataUrl);
  ctx.clearRect(0, 0, outW, H); // transparent = editable everywhere by default
  ctx.drawImage(img, 0, 0, W, H);
  return canvas.toDataURL('image/png');
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
  promptVariant: 'rewrite' | 'legacy' = 'rewrite',
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
      promptVariant,
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

// Short comma list of placed element names + counts, e.g. "Vegetable Bed x6, JoJo Tank".
// Locked prompts omit editor glyphs so the image model cannot mistake them for final map art.
/**
 * Which named ground feature an item stands in — "Lawn", "Veg garden", "Patio / Paving".
 *
 * This is the honest way to get the reference sheet's "TAP POINT (COURTYARD)" disambiguation. The
 * alternative — asking the image model to name the part of the site from the aerial photo — needs
 * scene semantics it does not reliably have, and a plausible-but-WRONG place word is worse than
 * none: it sends a farmer to the wrong tap. The farmer has already traced and named these areas,
 * so the answer is data we hold, not a guess. Smallest containing ring wins, so a lawn wrapping a
 * patio doesn't swallow everything inside it.
 */
function placeLabelFor(pt: [number, number], zones: DesignCanvasState['zones']): string | null {
  let best: { label: string; area: number } | null = null;
  for (const z of zones) {
    if (!z.feature || z.points.length < 3 || !pointInRing(pt, z.points)) continue;
    // A Studio-traced 'boundary' ring is the whole plot — every element on the site sits inside
    // it, so "(Property boundary)" as a place suffix disambiguates nothing (it would fire on
    // every item that isn't ALSO inside a smaller named ring) and reads as a non-answer, the same
    // failure the 'cleared' guard below exists to prevent. Unlike 'cleared', a farmer-given name
    // doesn't rescue it — the ring still means "everywhere", not a place.
    if (z.feature === 'boundary') continue;
    // Shoelace — relative area only, so the sign and scale don't matter.
    let a = 0;
    for (let i = 0, j = z.points.length - 1; i < z.points.length; j = i++) {
      a += (z.points[j][0] + z.points[i][0]) * (z.points[j][1] - z.points[i][1]);
    }
    const area = Math.abs(a / 2);
    // 'cleared' is the "none of the above" bucket, so its default label is the non-answer
    // "Cleared / other" — on a sheet that renders as "TREE BASINS (CLEARED / OTHER) ×5", which
    // reads like a leaked database field and disambiguates nothing. A ring the farmer has NAMED
    // is different: "Cleared" they typed themselves is a real place word, so only the default
    // is suppressed.
    if (z.feature === 'cleared' && !z.name) continue;
    const label = z.name ?? GROUND_FEATURES[z.feature]?.label ?? null;
    if (!label) continue;
    if (!best || area < best.area) best = { label, area };
  }
  return best?.label ?? null;
}

/**
 * Element list for Satellite Overlay, where the MODEL letters every label and legend row.
 *
 * Differs from producerElementsText in one way that matters: when several of the same element sit
 * in DIFFERENT named areas, each gets its own row carrying that area — "Tap Point (Lawn)",
 * "Tap Point (Veg garden)" — which is what makes the reference sheet readable. Items that share an
 * area (or sit outside every traced feature) collapse back to a single "Name ×N" row.
 */
function overlayElementsText(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter = 'all',
): { elements: string; fabric: string; served: string } {
  const byName = new Map<string, Array<string | null>>();
  // Strips characters overlayElementsText's own OUTPUT uses as structural delimiters (buildSatelliteOverlayPrompt
  // splits grouped rows on ',' — see its `collapseRows((list ?? '').split(','))`). Moved to the top of
  // this function (it used to be defined only where the FABRIC channel used it, far below) so it can
  // also sanitise farmer-typed element names — a label like "Tank, north side" was going straight
  // into `parts` unsanitised and came out of the legend as two rows, "Tank" and "north side", the
  // second with no icon vocabulary at all (audit finding, 2026-07-25).
  const clean = (label: string) => label.replace(/[,|»]/g, '').trim();
  // Legend section per element name. A flat 30-row legend is unreadable on the whole-design sheet;
  // the reference masterplan groups its key into WATER / PLANTING / INFRASTRUCTURE and that is what
  // makes it scannable.
  const sectionOf = new Map<string, string>();
  const SECTION: Record<string, string> = {
    water: 'WATER', earthworks: 'WATER', growing: 'PLANTING',
    structure: 'INFRASTRUCTURE', animal: 'INFRASTRUCTURE', access: 'INFRASTRUCTURE',
  };
  // 'earthworks' is a build category, not a reading category. A farmer reading the sheet files a
  // banana circle and a tree basin under PLANTING (they are where things grow) and a greywater or
  // infiltration basin under WATER, whatever the catalog calls them. BUT on the WATER sheet
  // specifically, banana_circle/tree_basin appear via ADDITIONAL_SHEETS as genuine water content
  // (they are a greywater sink) — filing them under a PLANTING heading on a sheet titled WATER PLAN
  // is confusing regardless of the catalog's PRIMARY sheet (audit finding, 2026-07-25: this table
  // was not filter-aware, so the same two elements got the same heading on every sheet they appear
  // on, even where that heading doesn't match the sheet). lib/water-cartography.ts's
  // waterLegendSectionForFeature already answers "what heading on the Water sheet" correctly for the
  // deterministic path; mirrored here rather than imported since this table's section names (WATER/
  // PLANTING/INFRASTRUCTURE/ZONES) are coarser than that module's four-way water split.
  const SECTION_BY_ID: Record<string, string> = filter === 'water'
    ? {
        banana_circle: 'WATER', tree_basin: 'WATER', mulch_bank: 'PLANTING',
        keyhole_bed: 'PLANTING', herb_spiral: 'PLANTING', raised_bed: 'PLANTING',
        greywater_basin: 'WATER', infiltration_basin: 'WATER',
      }
    : {
        banana_circle: 'PLANTING', tree_basin: 'PLANTING', mulch_bank: 'PLANTING',
        keyhole_bed: 'PLANTING', herb_spiral: 'PLANTING', raised_bed: 'PLANTING',
        greywater_basin: 'WATER', infiltration_basin: 'WATER',
      };
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter, def.id)) continue;
    const name = clean(it.label ?? def.name);
    sectionOf.set(name, SECTION_BY_ID[def.id] ?? SECTION[def.category] ?? 'INFRASTRUCTURE');
    const arr = byName.get(name) ?? [];
    arr.push(placeLabelFor([it.x, it.y], state.zones));
    byName.set(name, arr);
  }

  const parts: string[] = [];
  for (const [name, places] of byName) {
    const named = places.filter((p): p is string => !!p);
    const distinct = new Set(named);
    // Only worth splitting when the places actually tell them apart.
    if (places.length > 1 && distinct.size > 1 && named.length === places.length) {
      const seen = new Map<string, number>();
      for (const p of places) seen.set(p!, (seen.get(p!) ?? 0) + 1);
      for (const [place, n] of seen) parts.push(`${name} (${clean(place)})${n > 1 ? ` ×${n}` : ''}`);
    } else {
      parts.push(`${name}${places.length > 1 ? ` ×${places.length}` : ''}`);
    }
  }

  // ZONES. Rory's "I don't want zones in the legend" was about the ELEMENT sheets, where a column
  // of "Zone 3 — Orchard / food forest (×1)" rows buried the actual design. It got applied to every
  // sheet — including the Zones sheet, where the zones ARE the design. The old note here claimed
  // "the sheet's own wash carries them": true of the deterministic Blueprint sheet, which paints
  // its own washes, and FALSE of Satellite Overlay, where the model draws everything and this list
  // is the only thing telling it what exists. So the Zones sheet handed the model an EMPTY brief
  // while prompt rule 7 asserts that list is "the COMPLETE contents of this sheet" — and the model,
  // obeying rule 5, read the visible bands as element markers and invented a farm to fill them.
  // Listed on the Zones sheet only; the element sheets stay clean.
  if (filter === 'zones') {
    const byZone = new Map<number, number>();
    for (const z of state.zones) {
      if (z.feature || z.points.length < 3) continue;
      byZone.set(z.zone, (byZone.get(z.zone) ?? 0) + 1);
    }
    for (const [zone, n] of [...byZone.entries()].sort((a, b) => a[0] - b[0])) {
      const name = `Zone ${zone} — ${ZONE_DEFS[zone as 0 | 1 | 2 | 3 | 4 | 5].label}`;
      sectionOf.set(name, 'ZONES');
      parts.push(`${name}${n > 1 ? ` ×${n}` : ''}`);
    }
  }

  const lineCounts = new Map<string, number>();
  for (const l of state.lines) {
    if (!lineInFilter(l.kind, filter)) continue;
    lineCounts.set(l.kind, (lineCounts.get(l.kind) ?? 0) + 1);
  }
  const LINE_NAME: Record<string, string> = {
    swale: 'Swale', fence: 'Fence line', path: 'Walking path',
    pipe: 'Buried water pipe', drip: 'Drip irrigation line', windbreak: 'Windbreak hedge',
    greywater: 'Greywater line',
  };
  for (const [kind, n] of lineCounts) {
    const nm = `${LINE_NAME[kind] ?? kind}${n > 1 ? ` ×${n}` : ''}`;
    const lineSection = kind === 'windbreak' ? 'PLANTING'
      : (kind === 'swale' || kind === 'pipe' || kind === 'drip') ? 'WATER'
      : 'INFRASTRUCTURE'; // paths and fences are access, not plumbing
    sectionOf.set(nm.replace(/ ×\d+$/, ''), lineSection);
    parts.push(nm);
  }
  // THE DRIVEWAY IS CONTENT ON THE MASTERPLAN AND FABRIC EVERYWHERE ELSE — but it must be named on
  // BOTH, and that is the bug that kept erasing it. On a layer sheet it was named nowhere: the
  // ground branch skips it once refLayers covers it, groundRows skips it for the same reason, and
  // this block only fired for 'all'. Meanwhile the composite DOES draw it (the quiet tar fabric in
  // drawMarks). Drawn and unnamed is the worst state there is — rule 7 says nothing outside the
  // list and the rules is drawn, so the model erased a farmer's access track off his own plan,
  // render after render, while every fix went into the drawing instead of the naming.
  // Listing it as ELEMENT content on a layer sheet would give an access track a legend row beside
  // the actual design work, which is why it was excluded in the first place. The fabric channel is
  // exactly the register for this: named so it survives, no caption, no legend row.
  if (refLayers.driveway.length >= 2 && filter === 'all') {
    sectionOf.set('Tarred driveway', 'INFRASTRUCTURE');
    parts.push('Tarred driveway');
  }

  // Group for the legend. Sections only earn their headings when there is more than one, otherwise
  // a single-layer sheet gets a lone heading over its whole list for nothing.
  const groups = new Map<string, string[]>();
  for (const part of parts) {
    const bare = part.replace(/ ×\d+$/, '').replace(/ \([^)]*\)$/, '');
    const sec = sectionOf.get(bare) ?? sectionOf.get(part.replace(/ ×\d+$/, '')) ?? 'PLANTING';
    groups.set(sec, [...(groups.get(sec) ?? []), part]);
  }
  const elements = groups.size < 2
    ? parts.join(', ')
    : [...groups.entries()].map(([sec, rows]) => `${sec} » ${rows.join(', ')}`).join(' | ');

  // FABRIC — a SEPARATE channel from `elements`, never folded in. Rule 7 treats `elements` as "the
  // COMPLETE contents of this sheet" and the empty-brief refusal above tests it for emptiness: a
  // design that is only a traced orchard must still refuse (an orchard is not a design). Folding
  // ground in here would also hand farmer-typed names like "Veg garden" or "Orchard / food forest"
  // straight into the icon matcher, firing ICON_MATCH.bed / .tree the same way zone names once did.
  // Built from the same rings drawMarks now paints, in the same biggest-first, dedupe-by-label
  // order groundRows already uses for the deterministic legend, so the two can never drift on
  // which ground exists or what it's called.
  // CONTEXT ELEMENTS ride the same channel. A layer sheet is not only its own content: a Water plan
  // whose drip lines run to nothing is unreadable, because the beds, banana circles and tree basins
  // the irrigation SERVES now live on the Planting sheet (Rory: "water layer no driveway no beds no
  // tree basins no veg bed drip irrigation!!!"). They have to be visible for the routes to mean
  // anything, WITHOUT becoming water content — no legend row here, and Planting stays the sheet
  // that counts them. Fabric is exactly the right channel: drawn and named, never legended.
  // (clean() is defined near the top of this function now — shared with the element-name sanitising above.)
  // 'all' deliberately, NOT this function's own `filter` — this text feeds every sheet's `fabric`
  // string, content or context alike, and the prompt's own fabricIsContent (groundRegister) is
  // what decides caption/legend wording downstream. Narrowing to `filter` here would silently
  // empty the fabric text on Water/Zones, exactly the "drawn but unnamed gets erased" bug.
  const fabricParts = groundRows(state, refLayers, 'all').map((r) => clean(r.label));
  // …and the driveway joins it on every sheet that is not the masterplan (where it is already
  // content, above). refLayers.driveway is the main-map access layer; a Studio-traced one is
  // already in groundRows, so this covers the case groundRows deliberately skips.
  if (refLayers.driveway.length >= 2 && filter !== 'all') fabricParts.push('Tarred driveway');
  const fabric = fabricParts.filter(Boolean).join(', ');
  // SERVED is a third channel, separate from fabric, because the two want opposite treatment.
  // Ground — lawn, patio, yard — is SILENT: rule 10 forbids captioning what a farmer walks past
  // every day. The beds and basins an irrigation system feeds are not that; leaving them unnamed
  // left him looking at unexplained shapes on his own plan ("why doesnt it include all the right
  // elements"). Folding both into one string would force one rule on both and caption the lawn.
  const served = contextElementNames(state, filter).map(clean).filter(Boolean).join(', ');

  return { elements, fabric, served };
}

/** Things a sheet must SHOW to be readable but must not COUNT as its own content.
 *
 *  Only the Water sheet needs this today, and for a specific reason: irrigation is a set of lines
 *  that mean nothing except in relation to what they water. Drawing the drip runs while hiding the
 *  beds gives a farmer blue dots crossing empty lawn. The Planting sheet OWNS these elements — this
 *  is a borrowed view, which is why they go on the fabric channel and never into `elements`, where
 *  rule 7 would count them as water content and legend them here too. */
/** Which water subsystems the design actually contains. The prompt describes only these; a heading
 *  with nothing behind it is an instruction to invent, and it is where the phantom taps and the
 *  phantom greywater main came from. Derived from placed elements and drawn lines only — never
 *  assumed, never defaulted true. */
export function waterSystemsPresent(state: DesignCanvasState): { rainwater: boolean; irrigation: boolean; greywater: boolean; greywaterLine: boolean } {
  let rainwater = false, irrigation = false, greywater = false, greywaterLine = false;
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    if (/tank|rain barrel|first-flush|pump/i.test(def.name)) rainwater = true;
    if (/tap|valve|regulator|trough|borehole/i.test(def.name)) irrigation = true;
    if (/greywater/i.test(def.name)) greywater = true;
  }
  for (const l of state.lines) {
    if (l.points.length < 2) continue;
    if (l.kind === 'drip' || l.kind === 'pipe') irrigation = true;
    // A greywater BASIN and a greywater RUN are different claims. The prompt may only describe
    // the run when one is actually drawn, or it invents the route.
    if (l.kind === 'greywater') { greywater = true; greywaterLine = true; }
  }
  return { rainwater, irrigation, greywater, greywaterLine };
}

function contextElementNames(state: DesignCanvasState, filter: GlossyLayerFilter): string[] {
  if (filter !== 'water') return [];
  const counts = new Map<string, number>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !isContextElement(def, filter)) continue;
    const name = it.label ?? def.name;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  // NAMED, and that is a deliberate reversal. An earlier version listed them individually and the
  // render came back with invented tree canopies and banana palms — "Tree Basin" contains "tree",
  // "Banana Circle" contains "banana", and naming a thing to a model that draws is asking it to
  // draw that thing. The next version replaced the names with one generic phrase, which stopped the
  // invention but left a farmer looking at unexplained shapes on his own plan. He chose names:
  // "why doesnt it include all the right elements".
  // So the names are back, and the invention is held off by the PROMPT instead — the site-fabric
  // clause states that every one of these is ALREADY MARKED on the photograph, that the count is
  // the marker count, and that no new planting appears anywhere. Naming is safe only while that
  // clause travels with it; the two must be changed together.
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, n]) => `${name}${n > 1 ? ` \u00d7${n}` : ''}`);
}

function producerElementsText(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter = 'all',
  includeToolGlyphs = true,
): string {
  const counts = new Map<string, { icon: string; n: number }>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !itemInFilter(def.category, filter, def.id)) continue; // only this layer's elements
    const name = it.label ?? def.name;
    const g = counts.get(name) ?? { icon: def.icon, n: 0 };
    g.n += 1;
    counts.set(name, g);
  }
  const parts = [...counts.entries()].map(([name, g]) =>
    `${includeToolGlyphs ? `${g.icon} ` : ''}${name}${g.n > 1 ? ` ×${g.n}` : ''}`,
  );
  // On the zones layer, describe the effort-zone areas instead of individual elements.
  if (zonesInFilter(filter)) {
    for (const z of state.zones.filter((z) => !z.feature)) parts.push(`Zone ${z.zone} — ${ZONE_DEFS[z.zone].label}`);
  }
  // Line features (fences, paths, swales, pipes, drip, windbreaks) are drawn into the composite
  // but were never NAMED here — a layer whose only content is a line handed the model a broken
  // sentence and zero guidance (audit find). Group by kind, respect the layer filter.
  const lineCounts = new Map<string, number>();
  for (const l of state.lines) {
    if (!lineInFilter(l.kind, filter)) continue;
    lineCounts.set(l.kind, (lineCounts.get(l.kind) ?? 0) + 1);
  }
  // NAMES ONLY — never drawing instructions. When the model letters the legend itself, every string
  // in this list is printed on the sheet verbatim, so a parenthetical explanation here becomes a
  // paragraph in the legend. (Seen in production: a legend row reading "the existing driveway — a
  // simple dark TAR / ASPHALT access track of the exact traced shape (NOT a loop, roundabout or
  // circular drive), kept clear with no plantings on it".) How to DRAW each feature belongs in the
  // prompt body — FEATURE_LEGEND for the painted styles, the icon vocabulary for Satellite Overlay.
  const LINE_NAME: Record<string, string> = {
    swale: 'Swale', fence: 'Fence line', path: 'Walking path',
    pipe: 'Buried water pipe', drip: 'Drip irrigation line', greywater: 'Greywater line', windbreak: 'Windbreak hedge',
  };
  for (const [kind, n] of lineCounts) parts.push(`${LINE_NAME[kind] ?? kind}${n > 1 ? ` ×${n}` : ''}`);
  // Name the driveway so the model keeps the vehicle track visible (it's a traced reference,
  // not a placed item — Rory: "it's not picking up driveway").
  // Only the whole-design sheet lists the driveway. On a layer sheet it is context, and listing
  // it there gave an access track a legend row and a label alongside the actual design work.
  if (refLayers.driveway.length >= 2 && filter === 'all') parts.push('Tarred driveway');
  return parts.join(', ');
}

// Label layout extracted to lib/producer-labels.ts (producerLabels + plotBox/compassWord/
// clusterByProximity helpers) — see that file for the full implementation and comments.

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
    ctx.strokeStyle = 'rgba(32,25,15,0.42)';
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
    ctx.font = `bold 24px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(z.zone), cx, cy);
  }
  return canvas.toDataURL('image/png');
}

function waterItemsFor(state: DesignCanvasState): PlacedItem[] {
  return state.items
    .filter((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      return !!def && itemInFilter(def.category, 'water', def.id);
    })
    .sort((a, b) => {
      const da = ELEMENTS_BY_ID[a.defId], db = ELEMENTS_BY_ID[b.defId];
      const layerA = cartographicItemPaintRank(da);
      const layerB = cartographicItemPaintRank(db);
      const areaA = (a.wM ?? da.wM) * (a.hM ?? da.hM);
      const areaB = (b.wM ?? db.wM) * (b.hM ?? db.hM);
      return layerA - layerB || areaB - areaA || a.id.localeCompare(b.id);
    });
}

function drawWaterRoutes(ctx: CanvasRenderingContext2D, state: DesignCanvasState, frame: CanvasFrame, W: number, H: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const routeDots = (
    points: Array<[number, number]>,
    spacing: number,
    radius: number,
    fill: string,
    stroke: string,
  ) => {
    for (let i = 1; i < points.length; i += 1) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const dx = (x1 - x0) * W;
      const dy = (y1 - y0) * H;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;
      const count = Math.max(1, Math.floor(length / spacing));
      for (let n = 0; n <= count; n += 1) {
        const t = (n + 0.5) / (count + 1);
        ctx.beginPath();
        ctx.arc(x0 * W + dx * t, y0 * H + dy * t, radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Math.max(0.55, radius * 0.42);
        ctx.stroke();
      }
    }
  };
  for (const line of waterRoutesWithVisualBridges(state.lines, frame)) {
    const style = waterRouteStyleFor(line.kind);
    if (!style || line.points.length < 2) continue;
    const trace = () => {
      ctx.beginPath();
      line.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
    };
    if (line.kind === 'drip') {
      // Benchmark grammar: clean blue tubing with sparse emitters. Too many dots read as noise
      // once the finished sheet is reduced to phone/gallery size.
      trace();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#174E70';
      ctx.lineWidth = Math.max(style.width + 1.5, W * 0.0025);
      ctx.stroke();
      trace();
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.max(style.width, W * 0.00175);
      ctx.stroke();
      if (!line.visualBridge) {
        routeDots(
          line.points,
          Math.max(34, W * 0.017),
          Math.max(2.0, W * 0.00105),
          '#BCE8FF',
          '#15577D',
        );
      }
      continue;
    }
    if (line.kind === 'greywater') {
      // A filtered-greywater run stays visually distinct from clean-water pipework.
      trace();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(55,30,68,0.94)';
      ctx.lineWidth = Math.max(style.width + 1.9, W * 0.0032);
      ctx.stroke();
      trace();
      ctx.setLineDash([]);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = Math.max(style.width, W * 0.0023);
      ctx.stroke();
      if (!line.visualBridge) routeDots(line.points, Math.max(46, W * 0.022), Math.max(2.2, W * 0.00115), '#D9B6E6', '#5E3570');
      ctx.setLineDash([]);
      continue;
    }
    trace();
    ctx.setLineDash([]);
    ctx.strokeStyle = line.kind === 'swale' ? 'rgba(43,52,43,0.78)' : 'rgba(14,42,54,0.72)';
    ctx.lineWidth = Math.max(style.width + 4.8, W * 0.005);
    ctx.stroke();
    trace();
    ctx.setLineDash(style.dash);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = Math.max(style.width, line.kind === 'pipe' ? W * 0.0025 : W * 0.0023);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawWaterFeature(
  ctx: CanvasRenderingContext2D,
  item: PlacedItem,
  def: DesignElementDef,
  W: number,
  H: number,
  pxPerM: number,
  includeToolGlyphs: boolean,
  nearestNeighbourPx?: number,
) {
  const cx = item.x * W;
  const cy = item.y * H;
  const naturalW = Math.max(3, (item.wM ?? def.wM) * pxPerM);
  const naturalH = Math.max(3, (item.hM ?? def.hM) * pxPerM);
  // Taps, valves and boreholes are point symbols at this print scale. Drawing a literal 0.3 m
  // footprint can leave a two-pixel speck that is technically exact but operationally invisible.
  // Cartographic point symbols may be exaggerated while their measured centre remains exact.
  const pointSymbol = def.shape === 'circle' || [
    'tap_point', 'borehole', 'first_flush', 'pump_filter', 'greywater_diverter',
    'greywater_outlet', 'water_trough', 'water_trough2',
  ].includes(def.id);
  const minPoint = Math.max(10, W * 0.0065);
  const pointScale = pointSymbol && Math.min(naturalW, naturalH) < minPoint
    ? minPoint / Math.min(naturalW, naturalH)
    : 1;
  const printed = waterFeaturePresentationDimensions(
    def.id,
    naturalW * pointScale,
    naturalH * pointScale,
    W,
    nearestNeighbourPx,
  );
  const w = printed.width;
  const h = printed.height;
  const radius = Math.min(w, h) / 2;
  const id = def.id;
  const outline = Math.max(1.8, W * 0.00115);
  const isTank = id.startsWith('jojo_') || id === 'rain_barrel';
  const isOpenWater = id === 'pond_small' || id === 'dam';
  const isBasin = ['tree_basin', 'greywater_basin', 'infiltration_basin', 'half_moon', 'herb_spiral'].includes(id);
  const isBank = ['mulch_bank', 'berm', 'terrace'].includes(id);

  ctx.save();
  ctx.translate(cx, cy);
  if (def.shape === 'rect' && item.rot) ctx.rotate((item.rot * Math.PI) / 180);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // The illustrated library is shared by map marks and legend keys. It accepts the catalog's
  // real IDs, clips to this exact footprint and returns false for anything it does not own, so the
  // legacy symbol branches below remain an immediate visual rollback instead of being deleted.
  const illustrated = drawCartographicWaterSymbol({
    ctx,
    id,
    width: w,
    height: h,
    outlineWidth: outline,
    seed: Math.floor(stableCartographicUnit(`${def.id}:${item.id}`, 0) * 0x7fffffff),
  });
  if (illustrated) {
    ctx.restore();
    return;
  }

  if (isTank) {
    // Exact circular footprint, rendered as a directly-overhead ribbed tank rather than an emoji.
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#315F4B';
    ctx.fill();
    ctx.strokeStyle = '#FFFDF4';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72, 0, Math.PI * 2);
    ctx.strokeStyle = '#87B39B';
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.5, radius * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = '#D7E3D8';
    ctx.fill();
  } else if (isOpenWater) {
    ctx.beginPath();
    ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#3D8FAF';
    ctx.fill();
    ctx.strokeStyle = '#F8F1DC';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
    for (const scale of [0.62, 0.34]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, (w / 2) * scale, (h / 2) * scale, 0, Math.PI * 0.1, Math.PI * 0.9);
      ctx.strokeStyle = 'rgba(214,242,245,0.85)';
      ctx.lineWidth = outline * 0.75;
      ctx.stroke();
    }
  } else if (id === 'tap_point') {
    const s = Math.max(5, radius);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3.5, radius), 0, Math.PI * 2);
    ctx.fillStyle = '#F8F1DC';
    ctx.fill();
    ctx.strokeStyle = '#245E85';
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, s * 0.55);
    ctx.lineTo(0, -s * 0.55);
    ctx.lineTo(s * 0.62, -s * 0.55);
    ctx.quadraticCurveTo(s * 0.9, -s * 0.5, s * 0.9, -s * 0.15);
    ctx.strokeStyle = '#245E85';
    ctx.lineWidth = Math.max(2, outline);
    ctx.stroke();
  } else if (id === 'borehole') {
    const r = Math.max(5, radius);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = '#F8F1DC';
    ctx.fill();
    ctx.strokeStyle = '#245E85';
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
    ctx.moveTo(0, -r); ctx.lineTo(0, r);
    ctx.stroke();
  } else if (id === 'banana_circle') {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#B58A4E';
    ctx.fill();
    ctx.strokeStyle = '#FFF8E8';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = '#6B5133';
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 3);
      ctx.beginPath();
      ctx.ellipse(0, -radius * 0.58, radius * 0.18, radius * 0.44, 0, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#60874B' : '#789C55';
      ctx.fill();
      ctx.restore();
    }
  } else if (isBasin) {
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#9A754A';
    ctx.fill();
    ctx.strokeStyle = '#FFF8E8';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = id === 'greywater_basin' ? '#6F9E93' : '#6D5B3E';
    ctx.fill();
    ctx.strokeStyle = '#D8C296';
    ctx.lineWidth = outline;
    ctx.stroke();
  } else if (id === 'water_trough') {
    roundRectPath(ctx, -w / 2, -h / 2, w, h, Math.min(5, w * 0.2));
    ctx.fillStyle = '#D8D2C2';
    ctx.fill();
    ctx.strokeStyle = '#FFFDF4';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
    roundRectPath(ctx, -w * 0.32, -h * 0.38, w * 0.64, h * 0.76, Math.min(4, w * 0.16));
    ctx.fillStyle = '#4C99B6';
    ctx.fill();
  } else if (isBank) {
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = id === 'mulch_bank' ? '#9A7042' : '#A98558';
    ctx.fill();
    ctx.strokeStyle = '#FFF8E8';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(65,48,31,0.65)';
    ctx.lineWidth = 1.3;
    const extent = Math.max(w, h) * 1.5;
    for (let d = -extent; d <= extent; d += 7) {
      ctx.beginPath();
      ctx.moveTo(-extent, d);
      ctx.lineTo(extent, d - extent);
      ctx.stroke();
    }
    ctx.restore();
  } else if (id === 'first_flush' || id === 'pump_filter') {
    const r = Math.max(5, radius);
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    } else {
      roundRectPath(ctx, -w / 2, -h / 2, w, h, 3);
    }
    ctx.fillStyle = '#D8D2C2';
    ctx.fill();
    ctx.strokeStyle = '#245E85';
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.55, 0);
    ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.55);
    ctx.stroke();
  } else {
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    } else {
      roundRectPath(ctx, -w / 2, -h / 2, w, h, Math.min(4, Math.min(w, h) * 0.2));
    }
    ctx.fillStyle = def.category === 'earthworks' ? '#9A754A' : '#397F9E';
    ctx.fill();
    ctx.strokeStyle = '#FFFDF4';
    ctx.lineWidth = outline + 1;
    ctx.stroke();
  }

  if (includeToolGlyphs) {
    ctx.font = `${Math.max(12, Math.min(24, Math.min(w, h) * 0.55))}px ${SHEET_GLYPH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#101812';
    ctx.fillText(def.icon, 0, 0);
  }
  ctx.restore();
}

function drawWaterLeaderLabels(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
) {
  const grouped = new Map<string, { name: string; points: Array<[number, number]> }>();
  for (const item of waterItemsFor(state)) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) continue;
    // Export language follows the tool definition, not an incidental instance nickname. This keeps
    // eight individually named beds as one truthful "Vegetable Bed ×8" callout and prevents a
    // specific type such as Concrete Slab being generalised into "building" downstream.
    const name = def.name;
    const group = grouped.get(name) ?? { name, points: [] };
    group.points.push([item.x * W, item.y * H]);
    grouped.set(name, group);
  }
  // Every water ITEM (tank, tap) got a named callout here; every water LINE (swale, pipe, drip,
  // greywater) got only an unlabelled coloured stroke — you'd have to cross-reference the legend
  // swatch to know a dashed blue line was a swale and not a drip run (Rory: "theres no label for
  // swales"). One callout per KIND (not per individual line — three swales read as one "Swale x3"
  // the same way three taps already do), anchored to that kind's first drawn line's own midpoint,
  // through the exact same grouped map so every downstream layout/leader/collision rule (already
  // proven on items) applies unchanged.
  const WATER_LINE_NAME: Partial<Record<LineShape['kind'], string>> = {
    swale: 'Swale', pipe: 'Buried pipe', drip: 'Drip line', greywater: 'Greywater line',
  };
  const routeNames = new Set(Object.values(WATER_LINE_NAME).filter((name): name is string => Boolean(name)));
  for (const line of state.lines) {
    const name = WATER_LINE_NAME[line.kind];
    if (!name || line.points.length < 2) continue;
    const mid = line.points[Math.floor(line.points.length / 2)];
    const group = grouped.get(name) ?? { name, points: [] };
    group.points.push([mid[0] * W, mid[1] * H]);
    grouped.set(name, group);
  }
  if (!grouped.size) return;

  const box = plotBox(refLayers.boundary);
  const centreX = ((box.x0 + box.x1) / 2) * W;
  const groups = [...grouped.values()].map((group) => {
    const avgX = group.points.reduce((sum, point) => sum + point[0], 0) / group.points.length;
    const avgY = group.points.reduce((sum, point) => sum + point[1], 0) / group.points.length;
    const side: 'left' | 'right' = avgX < centreX ? 'left' : 'right';
    const target = [...group.points].sort((a, b) => side === 'left' ? a[0] - b[0] : b[0] - a[0])[0];
    return { ...group, avgY, side, target };
  });

  const fontSize = leaderLabelFontSize(W);
  const rowGap = Math.max(34, Math.round(fontSize * 1.7));
  // Keep callouts away from the browser/card edges and the deterministic scale bar. The old
  // 1.8% inset made labels look cropped whenever a mobile page drifted horizontally by a few px.
  const top = Math.round(H * 0.12);
  const bottom = Math.round(H * 0.86);
  ctx.font = `700 ${fontSize}px ${REFERENCE_LABEL_FONT}`;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // Measures in the font this canvas will actually paint with — the only reliable answer, since
  // REFERENCE_LABEL_FONT names three condensed faces and then falls back to plain sans-serif,
  // roughly 30% wider, on a device that has none of them.
  const measure = (t: string, size: number) => {
    ctx.font = `700 ${size}px ${REFERENCE_LABEL_FONT}`;
    return ctx.measureText(t).width;
  };

  const placeSide = (side: 'left' | 'right') => {
    const sideGroups = groups.filter((group) => group.side === side).sort((a, b) => a.avgY - b.avgY);
    if (!sideGroups.length) return;
    const positions = stackLeaderRows(sideGroups.map((group) => group.avgY), top, bottom, rowGap);

    sideGroups.forEach((group, index) => {
      // Several touching strokes form one saved network, not seven physical "greywater lines".
      // Counts remain useful for tanks/basins, but route labels name the system once.
      const showCount = group.points.length > 1 && !routeNames.has(group.name);
      const text = `${group.name.toUpperCase()}${showCount ? ` ×${group.points.length}` : ''}`;
      // Placement moved to lib/leader-labels.ts so it could be tested. It used to cap the width
      // used for POSITIONING at 24% of the canvas and then draw the text at its real width, which
      // put long names — "GREYWATER DIVERTER & FILTER ×3" is the worst in the catalog — past the
      // sheet edge on any render narrower than about 1400px.
      const placed = placeLeaderLabel({
        text, side, W, plotX0: box.x0, plotX1: box.x1, fontSize, measure,
      });
      const { x, textW } = placed;
      const drawSize = placed.fontSize;
      const leaderEndX = side === 'left' ? x + textW + drawSize * 0.35 : x - drawSize * 0.35;
      const elbowX = side === 'left'
        ? Math.min(group.target[0] - 16, leaderEndX + Math.round(W * 0.025))
        : Math.max(group.target[0] + 16, leaderEndX - Math.round(W * 0.025));

      // The routing rule (long run on the LABEL's row, never the element's) lives in
      // lib/leader-labels.ts so both drawers share one tested definition of it.
      const path = leaderPath(group.target as [number, number], elbowX, leaderEndX, positions[index]);
      ctx.beginPath();
      ctx.moveTo(path.from[0], path.from[1]);
      ctx.lineTo(path.elbow[0], path.elbow[1]);
      ctx.lineTo(path.to[0], path.to[1]);
      ctx.strokeStyle = 'rgba(18,24,19,0.72)';
      ctx.lineWidth = 4.5;
      ctx.stroke();
      ctx.strokeStyle = '#F3EEDB';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(group.target[0], group.target[1], 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#24362E';
      ctx.fill();
      ctx.strokeStyle = '#F3EEDB';
      ctx.lineWidth = 1;
      ctx.stroke();

      drawReferenceMapText(ctx, text, x, positions[index], drawSize, 700, 'left');
    });
  };
  placeSide('left');
  placeSide('right');
}

function drawWaterInfrastructure(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  includeToolGlyphs: boolean,
  includeLeaderLabels: boolean,
) {
  drawWaterRoutes(ctx, state, frame, W, H);
  const pxPerM = W / (frame.imgW * frame.mPerPx);
  const items = waterItemsFor(state);
  const neighbourInputs = items.map((item) => ({
    id: item.defId,
    cx: item.x * W,
    cy: item.y * H,
  }));
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const def = ELEMENTS_BY_ID[item.defId];
    if (def) {
      drawWaterFeature(
        ctx,
        item,
        def,
        W,
        H,
        pxPerM,
        includeToolGlyphs,
        nearestWaterNeighbourPx(neighbourInputs, index),
      );
    }
  }
  if (includeLeaderLabels) drawWaterLeaderLabels(ctx, state, refLayers, W, H);
}

const WATER_DESTINATION_GROUND_IDS = new Set([
  'tree_basin', 'greywater_basin', 'infiltration_basin', 'half_moon',
]);

function drawWaterFeatures(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  W: number,
  H: number,
  pxPerM: number,
  includeToolGlyphs: boolean,
  select: (item: PlacedItem) => boolean,
) {
  const items = waterItemsFor(state).filter(select);
  const neighbourInputs = items.map((item) => ({
    id: item.defId,
    cx: item.x * W,
    cy: item.y * H,
  }));
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const def = ELEMENTS_BY_ID[item.defId];
    if (def) {
      drawWaterFeature(
        ctx,
        item,
        def,
        W,
        H,
        pxPerM,
        includeToolGlyphs,
        nearestWaterNeighbourPx(neighbourInputs, index),
      );
    }
  }
}

// Geometry Lock treats the AI as a texture painter only. Exact feature symbols and leaders are
// burned in here after generation, so counts and positions come from saved design data, not model
// interpretation. The optional legacy glyph path is retained for Geometry Lock Off.
function buildWaterOverlay(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  includeToolGlyphs = true,
  includeLeaderLabels = false,
): string | undefined {
  const items = waterItemsFor(state);
  const hasLines = state.lines.some((line) => !!waterRouteStyleFor(line.kind) && line.points.length >= 2);
  if (!items.length && !hasLines) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  drawWaterInfrastructure(ctx, state, frame, refLayers, W, H, includeToolGlyphs, includeLeaderLabels);
  return canvas.toDataURL('image/png');
}

type LockedStructureTreatment = 'source' | 'precision_atlas';

function traceNormalisedPath(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  W: number,
  H: number,
  close = false,
) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
  if (close) ctx.closePath();
}

// The house is structural truth, not generative artwork. It is clipped to the user's exact traced
// polygon and sourced from the clean satellite, then lightly colour-matched so it does not read as
// a photographic sticker on a painted map.
async function buildHouseOverlay(
  sourceImage: string,
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  treatment: LockedStructureTreatment = 'source',
): Promise<string | undefined> {
  const footprints = authoritativeHouseFootprints(state, refLayers);
  if (footprints.length === 0) return undefined;
  const img = await loadImage(sourceImage);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.save();
  ctx.beginPath();
  for (const footprint of footprints) {
    footprint.forEach(([x, y], i) => (
      i === 0 ? ctx.moveTo(x * W, y * H) : ctx.lineTo(x * W, y * H)
    ));
    ctx.closePath();
  }
  ctx.clip();
  if (treatment === 'precision_atlas') {
    ctx.filter = 'saturate(0.48) contrast(1.08) brightness(1.05)';
  }
  ctx.drawImage(img, 0, 0, W, H);
  ctx.filter = 'none';
  if (treatment === 'precision_atlas') {
    ctx.fillStyle = 'rgba(42,55,53,0.16)';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  // One fine line records the traced footprint without widening or double-roofing it.
  for (const footprint of footprints) {
    traceNormalisedPath(ctx, footprint, W, H, true);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(45,43,38,0.9)';
    ctx.lineWidth = Math.max(2, W * 0.0012);
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

// Draw the traced driveway after generation. This preserves the exact path/area while avoiding
// the bright editor casing and flat brown guide that Geometry Lock previously pasted back in.
async function buildDrivewayOverlay(
  sourceImage: string | undefined,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  treatment: LockedStructureTreatment = 'source',
): Promise<string | undefined> {
  if (refLayers.driveway.length < 2) return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const precision = treatment === 'precision_atlas';
  const asphalt = precision ? '#50534E' : TAR; // Precision Atlas keeps its lighter paper-plan asphalt

  if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
    ctx.save();
    traceNormalisedPath(ctx, refLayers.driveway, W, H, true);
    ctx.clip();
    if (sourceImage) {
      const img = await loadImage(sourceImage);
      ctx.filter = precision
        ? 'saturate(0.16) contrast(0.78) brightness(0.76)'
        : 'saturate(0.32) contrast(0.82) brightness(0.98)';
      ctx.globalAlpha = precision ? 0.76 : 1;
      ctx.drawImage(img, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.fillStyle = precision ? 'rgba(31,38,33,0.28)' : 'rgba(122,122,112,0.12)';
      ctx.fillRect(0, 0, W, H);
    } else {
      const wash = ctx.createLinearGradient(0, 0, W, H);
      wash.addColorStop(0, precision ? '#666962' : '#4D514B');
      wash.addColorStop(0.52, precision ? '#5A5D57' : asphalt);
      wash.addColorStop(1, precision ? '#50534E' : '#383C38');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, W, H);
    }
    // Keep the source-derived asphalt texture. A diagonal hatch made existing access look like a
    // highlighted design polygon and competed with the Water network in every illustrated sheet.
    ctx.restore();
    if (RENDERED_DRIVEWAY_EDGE) {
      traceNormalisedPath(ctx, refLayers.driveway, W, H, true);
      ctx.strokeStyle = 'rgba(225,216,192,0.34)';
      ctx.lineWidth = Math.max(1.2, W * 0.00072);
      ctx.stroke();
    }
  } else {
    const pxPerM = W / (frame.imgW * frame.mPerPx);
    const roadW = Math.min(46, Math.max(11, pxPerM * 3));
    if (RENDERED_DRIVEWAY_EDGE) {
      traceNormalisedPath(ctx, refLayers.driveway, W, H);
      ctx.strokeStyle = 'rgba(48,51,47,0.56)';
      ctx.lineWidth = roadW + Math.max(1.5, W * 0.0009);
      ctx.stroke();
    }
    traceNormalisedPath(ctx, refLayers.driveway, W, H);
    ctx.strokeStyle = precision ? 'rgba(66,72,66,0.82)' : '#414640';
    ctx.lineWidth = roadW;
    ctx.stroke();
  }
  return canvas.toDataURL('image/png');
}

async function buildLockedStructureOverlay(
  sourceImage: string | undefined,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  styleKey: StylePreset,
): Promise<string | undefined> {
  const treatment: LockedStructureTreatment = styleKey === 'precision_atlas' ? 'precision_atlas' : 'source';
  const driveway = await buildDrivewayOverlay(sourceImage, frame, refLayers, W, H, treatment);
  const house = sourceImage
    ? await buildHouseOverlay(sourceImage, state, refLayers, W, H, treatment)
    : undefined;
  return stackOverlayImages(driveway, house, W, H);
}

async function stackOverlayImages(bottom: string | undefined, top: string | undefined, W: number, H: number): Promise<string | undefined> {
  if (!bottom && !top) return undefined;
  if (!bottom) return top;
  if (!top) return bottom;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return bottom;
  ctx.drawImage(await loadImage(bottom), 0, 0, W, H);
  ctx.drawImage(await loadImage(top), 0, 0, W, H);
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

/** Satellite under an ANALYSIS sheet: desaturated and lightened to a quiet paper tone.
 *
 *  drawBlueprintBase lays a dark scrim so bright design graphics pop on a moody ground, which is
 *  right for the design sheets. The analysis sheets are the opposite problem: their content is
 *  thin coloured arrows, arcs and dotted lines, and on dark subtropical bush a dark scrim leaves
 *  them competing with near-black. Nothing here moves a pixel — the geometry is untouched, only
 *  its saturation and lightness — so this stays a faithful photograph of the site. */
async function drawAnalysisBase(
  ctx: CanvasRenderingContext2D,
  frame: CanvasFrame,
  W: number,
  H: number,
): Promise<void> {
  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.save();
    // MULTIPLICATIVE, never a blend mode. The obvious approach — globalCompositeOperation
    // 'saturation' with a low-saturation fill — SETS saturation to that value rather than reducing
    // it, so it calms vivid foliage and simultaneously ADDS colour to grey roofs and tar. Measured:
    // it raised mean chroma on an already-muted aerial. ctx.filter scales what is there and cannot
    // invert like that. Guarded because Canvas filter support is not universal; without it the
    // paper wash below still lightens, just with the greens left in.
    if ('filter' in ctx) ctx.filter = 'saturate(0.42) brightness(0.96) contrast(0.9)';
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
  } else {
    ctx.fillStyle = '#727466';
    ctx.fillRect(0, 0, W, H);
  }
  drawPaperWash(ctx, W, H);
}

/** The warm paper tint shared by both sector bases — the real satellite (drawAnalysisBase) and the
 *  AI-illustrated ground (composeSectorSheet's baseImage path). Split out so an already-illustrated
 *  AI image gets the same paper tone as the photo without also getting the photo's desaturate/
 *  brighten filter, which belongs only to a raw aerial, not to artwork the model already stylised. */
function drawPaperWash(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.save();
  // A pale neutral veil separates analytical colour from busy aerial texture without hiding the
  // actual site. The previous dark-green scrim amplified dense foliage and made every overlay
  // compete for attention, especially on phone-sized Sector sheets.
  ctx.fillStyle = 'rgba(238, 234, 218, 0.2)';
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Trace a normalised ring as a closed path (leaves fill/stroke to the caller). */
function blueprintRing(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
): void {
  const drawPoints = polishedRenderPoints(
    pts.map(([x, y]) => [px(x), py(y)] as RenderPoint),
    { closed: true },
  );
  ctx.beginPath();
  drawPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
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
 *  Decorative kerbs are globally disabled: existing access must stay quiet site context. */
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
    const drawPoints = polishedRenderPoints(
      refLayers.driveway.map(([x, y]) => [px(x), py(y)] as RenderPoint),
      { closed: refLayers.drivewayClosed },
    );
    ctx.beginPath();
    drawPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
  };
  if (refLayers.drivewayClosed && refLayers.driveway.length >= 3) {
    trace();
    ctx.closePath();
    ctx.fillStyle = TAR;
    ctx.fill();
    if (dashedEdge && RENDERED_DRIVEWAY_EDGE) {
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    trace();
    ctx.strokeStyle = TAR;
    ctx.lineWidth = Math.min(46, Math.max(11, pxPerM * 3)); // ~3 m carriageway, clamped
    ctx.stroke();
    if (dashedEdge && RENDERED_DRIVEWAY_EDGE) {
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

/** Signed-area magnitude of a normalised ring (shoelace). Used only for draw ORDER. */
function ringArea(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
}

/** The GROUND the farmer actually traced — lawn, orchard, veg garden, patio, cleared, and (see
 *  below) the house and driveway. It is the site's EXISTING FABRIC, and it belongs on every sheet
 *  as context: a Water plan still needs to show the paving the pipe runs under, and a Zones plan is
 *  unreadable without the lawn and the yard that define the zones. (Rory: "it should be contained
 *  in all layers including patio lawn all these things! … we were supposed to have ironed this out
 *  already.")
 *
 *  HOUSE AND DRIVEWAY ARE CONDITIONAL, and this is the bug he hit. They used to be excluded flat,
 *  on the reasoning that both have dedicated draws with their own stacking order (the house must
 *  sit ABOVE planting so canopies can't crop the roof) and painting them twice double-darkens the
 *  fill. That is true only when refLayers actually HAS them — and refLayers is built solely from
 *  MAIN-MAP traced layers (app/design/page.tsx), never from Studio-traced ZoneShape features. So a
 *  farmer who traced his driveway and house inside the Design Studio, exactly where the Base step
 *  invites him to, got them drawn on ZERO sheets in BOTH render paths. They are now skipped only
 *  when the dedicated draw will really cover them.
 *
 *  ALPHA NOW COMES FROM `filter` VIA groundRegister — this used to paint every ring at the same
 *  strength regardless of which sheet it was on, so an orchard wash on the Water sheet (ground
 *  there only for orientation) looked IDENTICAL to the same wash on Planting (ground's own
 *  subject there) — a content/context register with no visual difference at all. groundRegister
 *  is also the authority groundRows and producer-prompt.ts's fabricIsContent defer to, so the
 *  three can no longer drift on which sheets treat ground as content. */
function drawBlueprintGround(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  px: (n: number) => number,
  py: (n: number) => number,
  W: number,
  refLayers?: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter = 'all',
  presentation: 'standard' | 'illustrated' = 'standard',
): void {
  // Skip only what a dedicated draw will genuinely cover. refLayers comes from the MAIN MAP, so an
  // empty one means the farmer traced this in the Studio and nothing else will draw it. The
  // boundary is excluded via groundRegister returning 'absent' for it (a drawn LINE, never a fill
  // wash) rather than a hard-coded check here, so this predicate can't disagree with groundRows'.
  const houseCovered = (refLayers?.house.length ?? 0) >= 3;
  const drivewayCovered = (refLayers?.driveway.length ?? 0) >= 2;
  const rings = state.zones.filter((z) => {
    if (!z.feature || z.points.length < 3) return false;
    // The paid Water underlayer already contains the real terrain and the protected existing
    // structures. Repainting every traced lawn/orchard/cleared polygon here created several
    // translucent copies of the design and made hidden Planting layers shine through. Exact-only
    // sheets still retain the full traced context; the illustrated Water overlay stays technical.
    if (presentation === 'illustrated' && filter === 'water') return false;
    if (z.feature === 'house' && houseCovered) return false;
    if (z.feature === 'driveway' && drivewayCovered) return false;
    return groundRegister(z.feature, filter) !== 'absent';
  });
  if (!rings.length) return;
  // Biggest first — a lawn that wraps a veg patch must not bury the patch.
  const sorted = [...rings].sort((a, b) => ringArea(b.points) - ringArea(a.points));
  // Hard / bare surfaces read as SURFACE, not vegetation, so they take a hatch instead of a
  // solid wash (Rory: "driveway patio all those types of polygons should get hatching").
  // The driveway is tar: solid and dark, never hatched — hatching a carriageway reads as gravel.
  // 'terrace_bank' joins this set for the same reason: a terrace riser is structurally a
  // cut/retained face — even when its surface finish is grass, it is not open cultivable ground
  // the way an adjoining lawn platform is, so it must read visually distinct from the flat
  // platforms either side of it (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §2).
  const HARD = new Set<GroundFeatureKind>(['patio', 'cleared', 'terrace_bank']);
  const step = Math.max(9, W * 0.007);
  const illustrated = presentation === 'illustrated';
  for (const z of sorted) {
    const meta = GROUND_FEATURES[z.feature!];
    const hard = HARD.has(z.feature!);
    // CONTENT sheets get the fuller wash this always used to paint; CONTEXT sheets paint the same
    // ground noticeably quieter, so the register the prompt describes in words is also true of the
    // pixels — the visual difference the earthworks-context plan calls the whole point of this fix.
    const isContent = groundRegister(z.feature!, filter) === 'content';
    // An AI-painted Water base already carries real terrain texture. Its factual ground overlay is
    // therefore a quiet registration wash, not a second opaque diagram pasted over the artwork.
    // Exact-only sheets keep the stronger standard treatment.
    const fillAlpha = illustrated
      ? hard ? (isContent ? '28' : '16') : (isContent ? '38' : '20')
      : hard ? (isContent ? '55' : '33') : (isContent ? '99' : '55');
    const strokeAlpha = illustrated ? (isContent ? '80' : '5A') : (isContent ? 'F2' : 'B0');
    // A ROOF IS NOT GROUND, SO IT GETS NO GROUND WASH.
    //
    // Rory, on a finished sheet: "the quality of the polygons everything is just not good at all",
    // pointing at flat grey rectangles where his buildings are. Half of that was the placeholder in
    // drawMarks, fixed separately. This is the other half, and it is the one that shows on the FREE
    // exact sheet: every ground feature here is washed with its own colour, and `house` was in the
    // set — so a Studio-traced building got a 33% grey layer painted over the real roof.
    //
    // The wash is right for ground. Lawn, orchard, cleared veld, patio: the photograph shows you
    // green, and the wash is what tells you which green has been claimed for what. A roof is the
    // opposite case. The satellite already shows the actual building, photographed from above with
    // its true ridges, wings and shadow — the single most recognisable thing on a farmer's own
    // plot — and covering it with flat grey replaces information with a rectangle.
    //
    // The outline below still draws, so the building is still delineated and still legible in the
    // legend. `houseCovered` does not catch this: it only counts LEGACY refLayers houses, and
    // Studio-traced house zones fall straight through it.
    const isRoof = z.feature === 'house';
    ctx.save();
    blueprintRing(ctx, z.points, px, py);
    if (!isRoof) {
      ctx.fillStyle = `${meta.color}${fillAlpha}`;
      ctx.fill();
    }
    if (hard) {
      ctx.clip();
      const xs = z.points.map((p) => px(p[0]));
      const ys = z.points.map((p) => py(p[1]));
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const h = y1 - y0;
      ctx.strokeStyle = `${meta.color}${illustrated ? (isContent ? '55' : '30') : (isContent ? 'CC' : '80')}`;
      ctx.lineWidth = illustrated ? 1.1 : 1.6;
      ctx.beginPath();
      for (let d = x0 - h; d < x1; d += step) {
        ctx.moveTo(d, y0);
        ctx.lineTo(d + h, y1);
      }
      ctx.stroke();
    }
    ctx.restore();
    blueprintRing(ctx, z.points, px, py);
    // With no fill behind it, a roof's outline is the only thing marking the building — and the
    // feature's own grey against a dark aerial is barely a line. White, and thicker, matching the
    // treatment the model composite uses so a house looks the same on the free sheet and the paid
    // one. Every other feature keeps its own colour, which is how the legend stays readable.
    ctx.strokeStyle = isRoof ? 'rgba(255,255,255,0.96)' : `${meta.color}${strokeAlpha}`;
    ctx.lineWidth = isRoof ? (illustrated ? 2.4 : 3.5) : (illustrated ? 1.4 : 2.5);
    ctx.stroke();
  }
}

/** Site boundary styled as the benchmark's lime post-and-wire fence. */
/** Placed Gate items near enough to the boundary to plausibly be its gate — see
 *  lib/boundary-geometry.ts. Extracted once here so every drawBlueprintBoundary caller can pass
 *  the same answer instead of each re-deriving "what counts as a gate" separately. */
function gatesNearBoundary(state: DesignCanvasState): GateLikeGeom[] {
  return state.items
    .filter((it) => it.defId === 'gate')
    .map((it) => ({ x: it.x, y: it.y, wM: it.wM ?? ELEMENTS_BY_ID[it.defId]?.wM }));
}

function drawBlueprintBoundary(
  ctx: CanvasRenderingContext2D,
  boundary: Array<[number, number]>,
  px: (n: number) => number,
  py: (n: number) => number,
  W: number,
  // Optional: when both are supplied, a placed Gate crossing the boundary cuts a measured break in
  // the drawn fence line at the gate's real width (docs/RENDER-GEOMETRY-CLEANUP-TODO.md). Render-only
  // — never touches the saved boundary or gate geometry. Omitted at legacy call sites, which keep
  // drawing an unbroken ring exactly as before.
  state?: DesignCanvasState,
  frame?: BoundaryFrameGeom,
): void {
  if (boundary.length < 3) return;
  const breaks = state && frame ? gateBoundaryBreaks(boundary, gatesNearBoundary(state), frame) : [];
  const segments = boundarySegmentsWithBreaks(boundary, frame ?? { imgW: 1, imgH: 1, mPerPx: 1 }, breaks)
    .map((seg) => polishedRenderPoints(
      seg.map(([x, y]) => [px(x), py(y)] as RenderPoint),
      { closed: breaks.length === 0 },
    ));
  // This is composited after generation, so it can match the reference set without teaching the
  // image model to invent a hedge. A dark casing keeps the lime wire readable on both forest and
  // pale ground; sparse perpendicular crossbars read as fence posts, not editor control points.
  ctx.save();
  for (const seg of segments) {
    if (seg.length < 2) continue;
    ctx.beginPath();
    seg.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
    // Breaks make this an OPEN run, not a closed ring — no closePath. With zero breaks there is
    // exactly one segment already closed back to its own first point (boundarySegmentsWithBreaks'
    // no-breaks case), so this still draws the original unbroken loop byte-for-byte.
    ctx.strokeStyle = 'rgba(20,30,20,0.78)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = '#A8D35F';
    ctx.lineWidth = 2.3;
    ctx.stroke();
  }
  const postHalf = Math.max(6, W * 0.0046);
  const step = Math.max(42, W * 0.03);
  for (const seg of segments) {
    // Open run: post ticks along each consecutive pair, never wrapping the last point back to the
    // first (that wrap only belongs to the no-breaks closed-ring case, already included above via
    // the segment's own repeated first/last point).
    for (let i = 0; i < seg.length - 1; i++) {
      const [x1, y1] = seg[i];
      const [x2, y2] = seg[i + 1];
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let t = 0; t < len; t += step) {
        const cx = x1 + dx * (t / len), cy = y1 + dy * (t / len);
        ctx.beginPath();
        ctx.moveTo(cx - nx * postHalf, cy - ny * postHalf);
        ctx.lineTo(cx + nx * postHalf, cy + ny * postHalf);
        ctx.strokeStyle = 'rgba(20,30,20,0.82)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - nx * postHalf, cy - ny * postHalf);
        ctx.lineTo(cx + nx * postHalf, cy + ny * postHalf);
        ctx.strokeStyle = '#B7DE6F';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Title block, top-left. Scrim (see drawTitleBlockScrim) is the caller's job, not this
 *  function's: this function only knows about the title/subtitle it was handed, but on the
 *  Sector sheet it is one of FOUR stacked lines (title, subtitle, data strip, sources) that all
 *  need the SAME backing — sizing a scrim from just these two args under-covered the other two
 *  and left them unreadable on a real AI render (see drawTitleBlockScrim's own doc for the
 *  incident). */
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
  ctx.font = `800 ${Math.round(W * 0.028)}px ${SHEET_TITLE_FONT}`;
  ctx.fillText(title, pad, pad + Math.round(W * 0.028));
  ctx.fillStyle = '#B9C2C8';
  ctx.font = `600 ${Math.round(W * 0.015)}px ${SHEET_BODY_FONT}`;
  ctx.fillText(subtitle, pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024));
}

/** Backing scrim for the Sector sheet's top-left text block — drawn ONCE, before any of the up-
 *  to-four stacked lines (title, subtitle, data strip, sources), sized from all of them.
 *
 *  A real AI render showed the title readable but the SOURCES line (and the tail of a long
 *  subtitle) sitting on raw, unprotected artwork and nearly invisible (Rory: "Not great at all",
 *  with the sources line and part of the subtitle washed out against a light patch). The cause:
 *  an earlier fix added a scrim, but it lived INSIDE drawBlueprintTitle and was sized from only
 *  the title+subtitle it receives — it has no idea drawSectorAnalysis draws two MORE lines below
 *  it (the data strip added by SECTOR-MODEL-SPEC, then the SOURCES citation line), each of which
 *  can be wider than the title/subtitle and which drew on totally unprotected background. Fixed
 *  by moving the scrim here, where every line that will land in this corner is known up front,
 *  and drawing it FIRST so every line — including ones added by a future line 5 — sits on top of
 *  one shared backing rather than each needing to remember to protect itself. */
function drawTitleBlockScrim(ctx: CanvasRenderingContext2D, pad: number, lines: string[], fonts: string[]): void {
  ctx.save();
  let maxW = 0;
  let totalH = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue;
    ctx.font = fonts[i];
    maxW = Math.max(maxW, ctx.measureText(lines[i]).width);
    // Each line's own font SIZE (the number before "px") is a fair stand-in for its line height.
    // NOT parseInt(fonts[i]) — these strings are "<weight> <size>px <family>" (e.g. "800 34px
    // Georgia, serif"), and parseInt reads the FIRST number in the string, which is the WEIGHT
    // (800), not the size. That bug would have inflated this scrim to roughly (800/34) times too
    // tall — caught here before it ever rendered, by working through the arithmetic by hand
    // rather than trusting the line looked plausible.
    const sizeMatch = fonts[i].match(/(\d+(?:\.\d+)?)px/);
    const fontSizePx = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
    totalH += fontSizePx * 1.25;
  }
  const bw = maxW + pad * 1.4;
  const bh = totalH + pad * 0.8;
  const grad = ctx.createLinearGradient(0, 0, bw + pad, bh + pad * 0.5);
  grad.addColorStop(0, 'rgba(8,10,7,0.6)');
  grad.addColorStop(1, 'rgba(8,10,7,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, bw + pad, bh + pad * 0.5);
  ctx.restore();
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
  heading: string = 'LEGEND',
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
  ctx.font = `800 ${Math.round(rowH * 0.72)}px ${SHEET_BODY_FONT}`;
  ctx.fillText(heading, lgX + ip, ry);
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
  sectorIcon?: SectorLegendIcon;
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
      ctx.font = `${Math.round(rowH * 0.5)}px ${SHEET_GLYPH_FONT}`;
      ctx.fillText(row.icon, tx, ry);
      tx += Math.round(rowH * 0.66);
    }
    ctx.fillStyle = '#EDE7DA';
    ctx.font = `600 ${Math.round(rowH * 0.46)}px ${SHEET_BODY_FONT}`;
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
): number {
  // WRAPS. This was one fillText, so any note longer than the panel simply ran off the edge and was
  // clipped mid-word — which is how the sector sheet shipped "Fire sector not shown: the dry-season
  // fire wind is regional" with the rest of the sentence, including what the farmer should DO about
  // it, cut off the page. A note that gets truncated is worse than no note: it looks like a bug and
  // it loses the actionable half. Returns the line count so a caller can size the panel for it.
  ctx.fillStyle = '#9AA6AC';
  ctx.font = `italic 500 ${Math.round(rowH * 0.4)}px ${SHEET_BODY_FONT}`;
  const maxW = lg.lgW - lg.ip * 2;
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else { line = next; }
  }
  if (line) lines.push(line);
  const lh = Math.round(rowH * 0.52);
  lines.forEach((l, i) => ctx.fillText(l, lg.lgX + lg.ip, ry + i * lh));
  return lines.length;
}

// ── The sheet's typeface system — TWO faces, declared once, used everywhere ───────────────────
//
// Rory kept reporting that the typography looked wrong without being able to say why. The reason
// was that one sheet was set in several families at once: the title in Georgia, the legend in the
// condensed stack below, and everything else — section headings, body copy, week labels, chips,
// pin numbers — in bare `system-ui`. Two of those had been hoisted into constants and thirty other
// sites stayed hardcoded, so the sheet was typographically inconsistent with itself and no single
// edit could fix it. That is this codebase's recurring bug in its purest form: several places
// independently answering one question and drifting apart. Every font on a sheet now comes from
// here, so changing the system is one line rather than a treasure hunt.
//
// WHY A SYSTEM SERIF FOR TITLES RATHER THAN THE APP'S OWN DISPLAY FACE. The app is set in
// Newsreader and Public Sans, loaded through next/font. next/font rewrites those into generated
// family names (`__Newsreader_a1b2c3`) exposed only as CSS variables, while canvas `ctx.font`
// takes a real family string — ask it for "Newsreader" and it silently falls through to the next
// name in the stack. So a sheet claiming the app's display face would in practice be rendering
// that face's FALLBACK, which is exactly what `Georgia, serif` already was: `--font-display` is
// 'Newsreader', Georgia, serif with the real face removed. Naming the fallback honestly beats
// naming a face we cannot reach. A sheet is also an export — a PDF or PNG opened on a phone, a
// borrowed laptop, a print shop's machine — and a webfont that fails there reflows a plan someone
// is holding in a field. System faces do not fail.
//
// WHY CONDENSED FOR EVERYTHING ELSE. Sheet lettering competes with the drawing underneath it and
// must fit inside legend boxes, bed labels and route callouts. A condensed face buys roughly a
// fifth more characters per line at the same size — which is why maps have used them for a century.
//
// A THIRD entry that is deliberately NOT one of the two faces. Icon and emoji glyphs
// (`fillText(row.icon, …)`, tool glyphs, feature symbols) must stay on the generic family: a
// condensed TEXT face is not guaranteed to contain those codepoints, and a canvas asked for a
// glyph its font lacks falls back silently — usually at a different metric, so a symbol that
// looked centred jumps. Four sites draw glyphs and two neighbouring ones draw zone NUMBERS, which
// is why this sweep could not be a find-and-replace: in the source the two cases are the same
// line, and they differ only in what reaches fillText.
const SHEET_GLYPH_FONT = 'sans-serif';
const SHEET_TITLE_FONT = 'Georgia, serif';
const REFERENCE_LABEL_FONT = '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
const SHEET_BODY_FONT = '"Avenir Next Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';

/** Draw benchmark-style map lettering directly over the artwork. A dark outline replaces the
 * dashboard pill while keeping the label readable over both pale lawn and dark forest. */
function drawReferenceMapText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  fontSize: number,
  weight: number,
  align: CanvasTextAlign,
): void {
  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${REFERENCE_LABEL_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = 'rgba(14,20,16,0.82)';
  ctx.lineWidth = Math.max(3.5, fontSize * 0.22);
  ctx.strokeText(value, x, y);
  ctx.fillStyle = '#F5F0DF';
  ctx.fillText(value, x, y);
  ctx.restore();
}

/** Burn short editorial labels with leaders onto a Blueprint-style sheet. */
function drawBlueprintLabelPills(
  ctx: CanvasRenderingContext2D,
  labels: ProducerLabel[],
): void {
  const W = ctx.canvas.width;
  const fs = Math.max(20, Math.round(W * 0.012));
  for (const l of labels) {
    const isHeader = l.kind === 'header';
    const weight = isHeader ? 800 : 650;
    ctx.font = `${weight} ${fs}px ${REFERENCE_LABEL_FONT}`;
    const textW = ctx.measureText(l.text).width;
    const onLeft = l.ax < W / 2;
    const textX = onLeft ? Math.max(20, W * 0.012) : Math.min(W - 20, W * 0.988);
    const align: CanvasTextAlign = onLeft ? 'left' : 'right';
    const leaderEndX = onLeft ? textX + textW + fs * 0.35 : textX - textW - fs * 0.35;
    if (l.leader !== false) {
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(l.cx, l.cy);
      const elbowX = onLeft
        ? Math.min(l.cx - fs * 0.6, leaderEndX + W * 0.018)
        : Math.max(l.cx + fs * 0.6, leaderEndX - W * 0.018);
      // THE LONG RUN GOES ALONG THE LABEL'S OWN ROW, NEVER THE ELEMENT'S.
      //
      // This used to be `lineTo(elbowX, l.cy)` — a long horizontal at the ELEMENT's height, then a
      // diagonal to the label. Label rows are de-collided so no two share a row; element heights
      // are not, and nothing stopped two of them being a few pixels apart. On the Ubhejane demo the
      // JoJo tank sits at y≈239 and the compost bay at y≈245, both on the left: their two horizontal
      // runs overlapped into what reads as ONE unbroken line from "JOJO TANK 2500L" across the sheet
      // to the compost bay. The label was correctly attached in the data and unmistakably wrong on
      // the page — which is how a farmer ends up standing the wrong thing on the wrong base.
      //
      // Routing the long segment along `l.ay` inherits the de-collision the labels already have, so
      // two runs can no longer coincide. What leaves each element is a short diagonal at its own
      // angle, which is also the clearer read: the eye follows the slope back to its own icon.
      // Shared with drawWaterLeaderLabels via lib/leader-labels.ts, where the rule is tested.
      const path = leaderPath([l.cx, l.cy], elbowX, leaderEndX, l.ay);
      ctx.lineTo(path.elbow[0], path.elbow[1]);
      ctx.lineTo(path.to[0], path.to[1]);
      ctx.strokeStyle = 'rgba(14,20,16,0.78)';
      ctx.lineWidth = 4.5;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(path.from[0], path.from[1]);
      ctx.lineTo(path.elbow[0], path.elbow[1]);
      ctx.lineTo(path.to[0], path.to[1]);
      ctx.strokeStyle = '#F3EEDB';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(l.cx, l.cy, 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#24362E';
      ctx.fill();
      ctx.strokeStyle = '#F3EEDB';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    drawReferenceMapText(ctx, l.text, textX, l.ay + 1, fs, weight, align);
  }
}

function referenceBlueprintLabels(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  filter: GlossyLayerFilter,
): ProducerLabel[] {
  const canonicalState: DesignCanvasState = {
    ...state,
    items: state.items.map(({ label: _label, ...item }) => item),
    // The integrated masterplan carries the physical design, not the abstract effort-zone bands.
    // Zones retain their own complete sheet and legend; repeating every zone label here was the
    // largest source of crossed leaders and is not present in the supplied masterplan benchmark.
    zones: filter === 'all' ? state.zones.filter((zone) => Boolean(zone.feature)) : state.zones,
  };
  const labels = producerLabels(canonicalState, refLayers, W, H, filter, false);

  // The legend is the exhaustive inventory. Map callouts are the editorial reading layer: one
  // leader per meaningful system, never the old margin directory where silent member rows formed
  // a long list disconnected from the artwork. This is also how the supplied benchmark sheets
  // stay readable while still naming every species and component in their legends.
  const rebalance = (input: ProducerLabel[], limit: number): ProducerLabel[] => {
    const leaders = input.filter((label) => label.leader !== false).slice(0, limit);
    const gap = Math.max(48, Math.round(W * 0.031));
    const top = Math.round(H * 0.11);
    const bottom = Math.round(H * 0.84);
    const out: ProducerLabel[] = [];
    for (const side of ['left', 'right'] as const) {
      const column = leaders
        .filter((label) => (label.cx < W / 2 ? 'left' : 'right') === side)
        .sort((a, b) => a.cy - b.cy);
      if (!column.length) continue;
      const positions = column.map((label) => Math.max(top, Math.min(bottom, label.cy)));
      for (let i = 1; i < positions.length; i++) positions[i] = Math.max(positions[i], positions[i - 1] + gap);
      const overflow = positions[positions.length - 1] - bottom;
      if (overflow > 0) for (let i = 0; i < positions.length; i++) positions[i] -= overflow;
      if (positions[0] < top) {
        positions[0] = top;
        for (let i = 1; i < positions.length; i++) positions[i] = positions[i - 1] + gap;
      }
      column.forEach((label, index) => out.push({ ...label, ay: positions[index] }));
    }
    return out;
  };

  if (filter === 'planting') {
    // Group headers carry the representative leader. Their member species remain exhaustive in the
    // illustrated legend, avoiding the 12-row left/right label ladders seen in the first v23 QA.
    const ranked = labels
      .filter((label) => label.leader !== false)
      .sort((a, b) => {
        const rank = (label: ProducerLabel) => label.kind === 'header' ? 0
          : /BEDS|CROPS|TREE|ORCHARD|BANANA|VETIVER|POLLINATOR/.test(label.text) ? 1
            : /DRIVEWAY/.test(label.text) ? 3 : 2;
        return rank(a) - rank(b) || a.cy - b.cy;
      });
    return rebalance(ranked, 10);
  }
  if (filter === 'structures') return rebalance(labels, 10);
  if (filter !== 'all') return rebalance(labels, 10);

  // Whole-farm sheets use a curated callout layer. The detailed layer sheets and deterministic
  // legend retain every name/count, while the masterplan calls out only the principal systems.
  const priority = [
    /TANK|RAIN BARREL/, /GREYWATER|POND|BOREHOLE/, /BED|CROP/, /TREE|ORCHARD/,
    /VETIVER|POLLINATOR|WINDBREAK/, /COMPOST|NURSERY/, /CHICKEN|BEEHIVE|LIVESTOCK/,
  ];
  const curated = labels
    .filter((label) => label.leader !== false && !/DRIVEWAY|ZONE\s+[0-5]/.test(label.text))
    .map((label, index) => ({
      label,
      index,
      rank: priority.findIndex((pattern) => pattern.test(label.text)),
    }))
    .sort((a, b) => {
      const ar = a.rank < 0 ? priority.length : a.rank;
      const br = b.rank < 0 ? priority.length : b.rank;
      return ar - br || a.index - b.index;
    })
    .slice(0, 9)
    .sort((a, b) => a.label.cy - b.label.cy)
    .map(({ label }) => label);
  return rebalance(curated, 9);
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
  ctx.font = `700 ${Math.round(W * 0.014)}px ${SHEET_BODY_FONT}`;
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
// Index 7 was '#2F7A4A' — byte-identical to GROUND_FEATURES.orchard.color (lib/design-elements.ts).
// Whichever species landed at that index (Litchi at the time of the audit finding, 2026-07-25;
// SHEET_OVERRIDE's five earthworks-to-planting remaps have since shifted it to Citrus) shared its
// legend swatch with the Orchard ground-feature row on the same sheet — two different rows, same
// colour chip, no way to tell them apart at a glance. Replaced with a muted rust not used elsewhere
// in this palette or by any GROUND_FEATURES colour.
const SPECIES_PALETTE = [
  '#E4572E', '#F4A259', '#F6D55C', '#C9A227', '#A3B565', '#7FD46B',
  '#4E9F3D', '#9C5B3C', '#3CBBB1', '#4EA6D8', '#2B6FA6', '#5C6BC0',
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
      if (!itemInFilter(def.category, filter, def.id)) continue;
      out[def.id] = i++;
    }
  }
  return out;
})();

function speciesColor(defId: string): string {
  const i = SPECIES_INDEX[defId] ?? 0;
  return SPECIES_PALETTE[i % SPECIES_PALETTE.length];
}

/** Legend rows for the traced ground drawn by drawBlueprintGround — same exclusions, same order
 *  (biggest first), so the panel reads down in the order the eye meets the washes. Renamed rings
 *  keep their own name, matching how the farmer labelled them in the editor. */
/** Margin label pills for the TRACED GROUND — house, driveway, lawn, veg garden, cleared ground.
 *
 *  The reference sector sheet labels every area it shows (HOUSE, TARRED DRIVEWAY, EXISTING
 *  VEGETABLE GARDEN, UPPER LAWN TERRACE, LOWER CLEARED GROUND) and that naming is most of why it
 *  reads as a survey rather than a diagram — an arrow crossing "the lawn terrace" says something an
 *  arrow crossing bare green does not. Reuses ProducerLabel so drawBlueprintLabelPills lays these
 *  out in the same margin columns, with the same no-crossing-leaders guarantee, as every other
 *  sheet's labels. */
function groundLabelsForSheet(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  // Reserved rectangle no right-column label may start inside — the Sector sheet's legend panel
  // sits top-right and is drawn AFTER these labels, so a "PAVING" pill that landed under it got
  // silently clipped (Rory: a render showed a label reading "...VING", the rest hidden behind the
  // legend box). This function has no idea the legend panel exists — it always pins right-column
  // labels to the right margin regardless of what else occupies that corner. Optional so every
  // OTHER caller (sheet 01, the AI-composite path) is unaffected.
  avoidTopRight?: { x0: number; y0: number; x1: number; y1: number },
): ProducerLabel[] {
  const fs = 26, padX = 14, pillH = fs + 14;
  const rings = state.zones.filter((z) => z.feature && z.feature !== 'boundary' && z.points.length >= 3);
  if (!rings.length) return [];
  const rows = rings
    .sort((a, b) => ringArea(b.points) - ringArea(a.points))
    .map((z) => {
      // "Cleared / other" is a good CHIP label — it is the none-of-the-above bucket the farmer
      // picks from — and a terrible MAP label: a plan sheet that says "CLEARED / OTHER" is showing
      // the reader a database field. Map-facing names only.
      const MAP_NAME: Partial<Record<GroundFeatureKind, string>> = {
        cleared: 'Cleared ground',
        patio: 'Paving',
        veg_garden: 'Veg garden',
        orchard: 'Orchard',
      };
      // Level suffix — appended BEFORE the dedup filter below, so two platforms of the same kind
      // at DIFFERENT levels (e.g. an upper and a lower lawn) produce two distinct labels, while
      // two at the SAME level (a real duplicate) still correctly collapse to one
      // (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §4a).
      const levelSuffix = z.levelM != null ? ` ${z.levelM >= 0 ? '+' : ''}${z.levelM.toFixed(1)}M` : '';
      const text = (z.name ?? MAP_NAME[z.feature!] ?? GROUND_FEATURES[z.feature!].label).toUpperCase() + levelSuffix;
      const cx = (z.points.reduce((s2, p) => s2 + p[0], 0) / z.points.length) * W;
      const cy = (z.points.reduce((s2, p) => s2 + p[1], 0) / z.points.length) * H;
      return { text, cx, cy, pw: Math.min(W - 28, padX * 2 + text.length * fs * 0.62) };
    })
    // One row per NAME: two lawns AT THE SAME LEVEL are one label, or the margin fills with
    // repeats — but the level suffix above means two lawns at different levels no longer share
    // a name, so this correctly keeps both.
    .filter((r, i, all) => all.findIndex((o) => o.text === r.text) === i);

  // Same margin-column layout the producer labels use: pinned to the nearer side, pushed down only
  // as far as needed to clear the row above, so leaders cannot tangle.
  const out: ProducerLabel[] = [];
  (['left', 'right'] as const).forEach((side) => {
    const col = rows.filter((r) => (r.cx < W / 2 ? 'left' : 'right') === side).sort((a, b) => a.cy - b.cy);
    // A right-column pill overlaps the reserved rectangle horizontally as soon as its OWN right
    // margin (16px from W) sits left of avoidTopRight.x1 — every right-pinned pill's left edge is
    // `W - pw - 16`, so unless pw is wider than the whole reserved box it always intersects the
    // reservation's x-range whenever one exists. Simpler and safe: if this side has a reservation
    // at all, its own margin column IS inside it, so start below the box rather than at the top.
    let lastY = side === 'right' && avoidTopRight ? avoidTopRight.y1 - pillH - 10 : -Infinity;
    for (const r of col) {
      const y = Math.max(r.cy, lastY + pillH + 10);
      lastY = y;
      const ax = side === 'left' ? 16 : Math.max(16, W - r.pw - 16);
      out.push({ cx: r.cx, cy: r.cy, ax, ay: Math.min(y, H - 36), lx: side === 'left' ? ax + r.pw : ax, text: r.text, kind: 'item', leader: true });
    }
  });
  return out;
}

/** Legend rows for the ground drawn by drawBlueprintGround, gated the same way: only rings where
 *  groundRegister(kind, filter) === 'content' earn a row. `filter` defaults to 'all' so the two
 *  existing raw-listing callers (the AI prompt's `fabric` string and the legacy water legend, both
 *  of which want every traced name regardless of which sheet they're feeding) keep exactly their
 *  old unfiltered output without having to know why — 'all' is the one filter every non-boundary
 *  kind resolves to 'content' under. */
export function groundRows(
  state: DesignCanvasState,
  refLayers?: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter = 'all',
): BlueprintLegendRow[] {
  // MUST use the same predicate as drawBlueprintGround, or the legend and the map drift apart —
  // which is exactly what happened when ground started drawing on Zones, Water and Structures while
  // this function was still hard-coded to skip house and driveway: painted areas with no key.
  const houseCovered = (refLayers?.house.length ?? 0) >= 3;
  const drivewayCovered = (refLayers?.driveway.length ?? 0) >= 2;
  return state.zones
    .filter((z) => {
      if (!z.feature || z.points.length < 3) return false;
      if (z.feature === 'house' && houseCovered) return false;
      if (z.feature === 'driveway' && drivewayCovered) return false;
      return groundRegister(z.feature, filter) === 'content';
    })
    .sort((a, b) => ringArea(b.points) - ringArea(a.points))
    .map((z) => ({
      color: GROUND_FEATURES[z.feature!].color,
      label: z.name ?? GROUND_FEATURES[z.feature!].label,
      style: 'fill' as const,
    }))
    // Two lawns are one legend row.
    .filter((row, i, all) => all.findIndex((r) => r.label === row.label) === i);
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
    if (!def || !itemInFilter(def.category, filter, def.id)) continue;
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
export async function buildBlueprintZoneMapLegacy(
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

  // 1b. Existing site fabric UNDER the zone washes. A zone map is about distance from the house, so
  //     it is unreadable without the yard, lawn and paving that give those distances meaning — but
  //     it stays beneath the zones, which are this sheet's subject, so ground here is CONTEXT only.
  drawBlueprintGround(ctx, state, px, py, W, refLayers, 'zones');

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
    ctx.font = `bold ${Math.round(r * 1.1)}px ${SHEET_BODY_FONT}`;
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
  // Same gates as the draws below (boundary line 3005, driveway line 2998) — a legend row for a
  // fence or driveway that isn't on the page is the phantom-row defect (layer-audit RC5).
  const hasBoundary = refLayers.boundary.length >= 3;
  const hasDriveway = refLayers.driveway.length >= 2;
  const extraRows = (hasBoundary ? 1 : 0) + (hasDriveway ? 1 : 0) + 1; // +1 for the scale-note line
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (zoneNums.length + extraRows + 2.2)));
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
    ctx.font = `700 ${Math.round(rowH * 0.48)}px ${SHEET_BODY_FONT}`;
    const zLbl = `ZONE ${n}`;
    ctx.fillText(zLbl, textX, ry);
    const nameX = textX + ctx.measureText(zLbl).width + 8;
    ctx.fillStyle = '#B9C2C8';
    ctx.font = `500 ${Math.round(rowH * 0.44)}px ${SHEET_BODY_FONT}`;
    let name = `— ${ZONE_DEFS[n].label}`;
    const maxW = lgX + lgW - ip - nameX;
    while (ctx.measureText(name).width > maxW && name.length > 4) name = name.slice(0, -2);
    ctx.fillText(name, nameX, ry);
    ry += rowH;
  }
  // Fence + driveway rows, each gated on the same condition its draw above used (hasBoundary/
  // hasDriveway) so a legend key can never promise a line this page didn't draw.
  if (hasBoundary) {
    ctx.strokeStyle = BOUNDARY_BONE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lgX + ip, ry);
    ctx.lineTo(lgX + ip + sw * 1.5, ry);
    ctx.stroke();
    ctx.fillStyle = '#EDE7DA';
    ctx.font = `500 ${Math.round(rowH * 0.44)}px ${SHEET_BODY_FONT}`;
    // "Property boundary", not "Fence" — this map draws only the boundary ring, and the old
    // wording read as a second, planted-row kind of fence (layer-audit RC5).
    ctx.fillText('Property boundary', textX, ry);
    ry += rowH;
  }
  if (hasDriveway) {
    ctx.fillStyle = TAR;
    roundRectPath(ctx, lgX + ip, ry - sw / 2, sw * 1.5, sw, 3);
    ctx.fill();
    ctx.fillStyle = '#EDE7DA';
    ctx.font = `500 ${Math.round(rowH * 0.44)}px ${SHEET_BODY_FONT}`;
    ctx.fillText('Tarred driveway', textX, ry);
    ry += rowH;
  }
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Zones show frequency of access.');

  // 9. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);
  drawImplNorthArrow(ctx, W - pad - Math.round(W * 0.04), H - pad - Math.round(W * 0.04), Math.round(W * 0.05));

  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" WATER map — the same clean dark-satellite treatment as the zone
// blueprint, but the content layer is water infrastructure (tanks as blue cylinders, swale/pipe/
// drip routes, taps) drawn exactly from geometry. Reliable, instant, no AI.
export async function buildBlueprintWaterMapLegacy(
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

  // 3. Water routes — clean technical ink.
  const LINE_STYLE: Record<string, { color: string; dash: number[] }> = {
    swale: { color: '#4EA6D8', dash: [] },
    pipe: { color: '#2B6FA6', dash: [] },
    drip: { color: '#238ACB', dash: [] },
    greywater: { color: '#8E44AD', dash: [] },
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const l of waterRoutesWithVisualBridges(state.lines, frame)) {
    const st = LINE_STYLE[l.kind];
    if (!st || l.points.length < 2) continue;
    const trace = () => {
      const drawPoints = polishedRenderPoints(
        l.points.map(([x, y]) => [px(x), py(y)] as RenderPoint),
      );
      ctx.beginPath();
      drawPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
    };
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
    return !!def && itemInFilter(def.category, 'water', def.id);
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
    ctx.font = `${Math.max(12, Math.min(24, r))}px ${SHEET_GLYPH_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, cx, cy);
  }

  // 4b. Burn true labels in the margins so the sheet reads like the editorial GPT examples.
  drawBlueprintLabelPills(ctx, producerLabels(state, refLayers, W, H, 'water'));

  // 5. Boundary — green line with perpendicular fence ticks.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 6. Title (top-left).
  const rowH = Math.round(W * 0.026);
  drawBlueprintTitle(ctx, W, pad, 'WATER PLAN', placeName ?? 'Water plan');

  const rowsForItems = (items: Array<{ defId: string }>, color: string): BlueprintLegendRow[] => {
    const grouped = new Map<string, { icon: string; n: number }>();
    for (const it of items) {
      const def = ELEMENTS_BY_ID[it.defId];
      if (!def) continue;
      const name = def.name;
      const g = grouped.get(name) ?? { icon: def.icon, n: 0 };
      g.n += 1;
      grouped.set(name, g);
    }
    return [...grouped.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
      .map(([name, g]) => ({
        color,
        icon: g.icon,
        label: `${name}${g.n > 1 ? ` ×${g.n}` : ''}`,
        style: 'fill' as const,
      }));
  };
  const linesByKind = new Map<string, number>();
  for (const l of state.lines) {
    if (l.points.length < 2 || !lineInFilter(l.kind, 'water')) continue;
    linesByKind.set(l.kind, (linesByKind.get(l.kind) ?? 0) + 1);
  }
  const waterInfra = waterItems.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    const n = def?.name ?? '';
    return /Tank|Rain Barrel|Borehole|First-Flush|Pump & Filter|Farm Dam|Small Pond/i.test(n);
  });
  const irrigation = waterItems.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    const n = def?.name ?? '';
    return /Tap Point|Water Trough|Pump & Filter/i.test(n);
  });
  const greywater = waterItems.filter((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    const n = def?.name ?? '';
    return /Greywater Basin|Banana Circle|Tree Basin|Infiltration Basin|Berm \/ Contour Bank|Terrace \/ Retaining Bank|Mulch Bank/i.test(n);
  });
  const sections: Array<{ title: string; rows: BlueprintLegendRow[]; note?: string }> = [];
  if (waterInfra.length) {
    sections.push({
      title: 'RAINWATER',
      rows: rowsForItems(waterInfra, '#2E7FC2'),
      note: 'Storage and capture already traced on the farm.',
    });
  }
  const irrigationRows: BlueprintLegendRow[] = [
    ...rowsForItems(irrigation, '#4EA6D8'),
    ...(linesByKind.has('swale') ? [{ color: '#4EA6D8', label: `Swale / contour line${linesByKind.get('swale')! > 1 ? ` ×${linesByKind.get('swale')}` : ''}`, style: 'line' as const }] : []),
    ...(linesByKind.has('pipe') ? [{ color: '#2B6FA6', label: `Pipe${linesByKind.get('pipe')! > 1 ? ` ×${linesByKind.get('pipe')}` : ''}`, style: 'line' as const }] : []),
    ...(linesByKind.has('drip') ? [{ color: '#238ACB', label: `Drip line${linesByKind.get('drip')! > 1 ? ` ×${linesByKind.get('drip')}` : ''}`, style: 'line' as const }] : []),
  ];
  if (irrigationRows.length) {
    sections.push({
      title: 'IRRIGATION',
      rows: irrigationRows,
      note: 'Distribution and delivery lines stay exactly where they were drawn.',
    });
  }
  const greywaterLineRow: BlueprintLegendRow[] = linesByKind.has('greywater')
    ? [{ color: '#8E44AD', label: `Greywater line${linesByKind.get('greywater')! > 1 ? ` ×${linesByKind.get('greywater')}` : ''}`, style: 'line' as const }]
    : [];
  if (greywater.length || greywaterLineRow.length) {
    sections.push({
      title: 'FILTERED GREYWATER',
      rows: [...rowsForItems(greywater, '#A9743F'), ...greywaterLineRow],
      note: 'Land-shaping and soakaway features are kept to the traced geometry.',
    });
  }
  // EXISTING — the traced ground under the plumbing, plus the beds and basins this system waters.
  // Both are shown so the routes read against something; both get a key row so nothing on the sheet
  // is unexplained (Rory chose named-and-legended over silent). They are NOT water content: they
  // stay out of the RAINWATER / IRRIGATION / GREYWATER sections, and the Planting sheet remains
  // where they are counted.
  const servedRows: BlueprintLegendRow[] = (() => {
    const counts = new Map<string, { color: string; n: number }>();
    for (const it of state.items) {
      const def = ELEMENTS_BY_ID[it.defId];
      if (!def || !isContextElement(def, 'water')) continue;
      const name = it.label ?? def.name;
      const cur = counts.get(name) ?? { color: def.color, n: 0 };
      cur.n += 1;
      counts.set(name, cur);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
      .map(([name, g]) => ({ color: g.color, label: `${name}${g.n > 1 ? ` ×${g.n}` : ''}`, style: 'fill' as const }));
  })();
  const existing = [...groundRows(state, refLayers, 'all'), ...servedRows]; // legacy path — 'all' preserves its original unfiltered EXISTING listing
  if (existing.length) {
    sections.push({
      title: 'EXISTING',
      rows: existing,
      note: 'Already on the site — shown so the water routes read against what they serve.',
    });
  }
  const noteRows: BlueprintLegendRow[] = [
    { color: BOUNDARY_BONE, label: 'Fence / site boundary', style: 'line' },
    ...(refLayers.driveway.length >= 2 ? [{ color: TAR, label: 'Tarred driveway', style: 'fill' as const }] : []),
  ];
  sections.push({
    title: 'NOTES',
    rows: noteRows,
    note: 'No water system is invented; the map only names what the source already shows.',
  });

  const legendRowEstimate = sections.reduce((n, s) => n + 1 + s.rows.length + (s.note ? 1 : 0), 0);
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (legendRowEstimate + 3.2)));
  let ry = lg.ry;
  for (const section of sections) {
    ctx.fillStyle = '#D3DEE5';
    ctx.font = `900 ${Math.round(rowH * 0.5)}px ${SHEET_BODY_FONT}`;
    ctx.fillText(section.title, lg.lgX + lg.ip, ry);
    ry += rowH * 0.72;
    if (section.rows.length) {
      ry = drawBlueprintLegendRows(ctx, { ...lg, ry }, rowH, section.rows);
    }
    if (section.note) {
      drawBlueprintLegendNote(ctx, lg, rowH, ry, section.note);
      ry += rowH * 0.78;
    } else {
      ry += rowH * 0.28;
    }
  }

  // 8. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);
  drawImplNorthArrow(ctx, W - pad - Math.round(W * 0.04), H - pad - Math.round(W * 0.04), Math.round(W * 0.05));

  return canvas.toDataURL('image/png');
}

// The current exact Water sheet uses the same deterministic symbols and leader labels that are
// composited over Geometry Lock AI renders. The former dark-overlay implementation remains above
// as buildBlueprintWaterMapLegacy for one-switch rollback and visual comparison.
export async function buildBlueprintWaterMapLegacyExact(
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

  await drawBlueprintBase(ctx, frame, W, H);
  // Existing site fabric under the plumbing — a water plan has to show the paving a pipe runs
  // beneath and the veg garden a drip line feeds, or the routes float on bare satellite. CONTEXT
  // only: the plumbing is this sheet's content, not the ground it crosses.
  drawBlueprintGround(ctx, state, px, py, W, refLayers, 'water');
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(48,54,59,0.9)', 'rgba(255,253,244,0.9)', 2.5);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);
  drawWaterInfrastructure(ctx, state, frame, refLayers, W, H, false, true);
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  return composeStyleSheet(
    canvas.toDataURL('image/png'),
    state,
    frame,
    refLayers,
    'water',
    placeName,
    'Measured water plan',
    'Water',
    false,
    true,
  );
}

const CANOPY_PALETTES = [
  ['#263C2E', '#426044', '#71805A'],
  ['#2D402E', '#4F6740', '#87905A'],
  ['#243D35', '#3D6551', '#6F8A61'],
  ['#34432A', '#5D6C3B', '#8A8B52'],
  ['#2A4038', '#486758', '#778B6A'],
] as const;

function drawPaintedReferenceFeature(
  ctx: CanvasRenderingContext2D,
  it: PlacedItem,
  def: DesignElementDef,
  cx: number,
  cy: number,
  wPx: number,
  hPx: number,
  outline: number,
): boolean {
  const url = referenceFeatureArtworkUrl(def.id);
  const image = url ? referenceFeatureArtworkCache.get(url) : undefined;
  if (!image) return false;

  const radius = Math.min(wPx, hPx) * 0.08;
  const traceFootprint = () => {
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(0, 0, wPx / 2, hPx / 2, 0, 0, Math.PI * 2);
    } else {
      roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, radius);
    }
  };

  ctx.save();
  ctx.translate(cx, cy);
  if (def.shape === 'rect' && it.rot) ctx.rotate((it.rot * Math.PI) / 180);
  ctx.lineJoin = 'round';

  ctx.save();
  traceFootprint();
  ctx.clip();
  ctx.drawImage(image, -wPx / 2, -hPx / 2, wPx, hPx);
  ctx.restore();

  // Keep the asset integrated with the aerial rather than turning it into a haloed editor sticker.
  // A restrained dark keyline clarifies the saved footprint without changing its geometry.
  traceFootprint();
  ctx.strokeStyle = 'rgba(31,42,29,0.58)';
  ctx.lineWidth = Math.max(0.7, outline * 0.5);
  ctx.stroke();
  ctx.restore();
  return true;
}

function stableCartographicUnit(seed: string, index: number): number {
  let hash = 2166136261;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

/** Draw one element at its exact saved centre with deterministic cartographic artwork.
 *
 * Emoji are editor controls, not plan symbols. They used to be burned into exact sheets and copied
 * by the image model. Area features keep their footprint; tiny infrastructure uses a bounded point
 * symbol at the same centre and rotation so it remains readable over an AI-painted base. */
function drawTrueFootprint(
  ctx: CanvasRenderingContext2D,
  it: PlacedItem,
  def: DesignElementDef,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  emphasizeSmallFeatures = true,
  nearestNeighbourPx?: number,
): void {
  const waterArtwork = def.category === 'water' || [
    'banana_circle', 'tree_basin', 'greywater_basin', 'infiltration_basin',
    'half_moon', 'berm', 'terrace', 'mulch_bank', 'duck_pond',
  ].includes(def.id);
  const artUrl = referenceFeatureArtworkUrl(def.id);
  if (artUrl && referenceFeatureArtworkCache.has(artUrl)) {
    // Reusable art improves material and detail. Area features keep their literal footprint; tiny
    // infrastructure may use a bounded print symbol, but its centre and rotation never move.
    const naturalW = Math.max(1, (it.wM ?? def.wM) * pxPerM);
    const naturalH = Math.max(1, (it.hM ?? def.hM) * pxPerM);
    const printed = emphasizeSmallFeatures && waterArtwork
      ? waterFeaturePresentationDimensions(def.id, naturalW, naturalH, ctx.canvas.width, nearestNeighbourPx)
      : emphasizeSmallFeatures && (
        def.category === 'structure' || def.category === 'animal' || def.category === 'access'
      )
        ? structuresFeaturePresentationDimensions(def.id, naturalW, naturalH, ctx.canvas.width)
        : emphasizeSmallFeatures && (def.category === 'growing' || def.category === 'earthworks')
          ? plantingFeaturePresentationDimensions(def.id, naturalW, naturalH, ctx.canvas.width)
          : { width: naturalW, height: naturalH };
    const assetInset = def.id.startsWith('jojo_') ? 0.88 : 1;
    const cx = px(it.x);
    const cy = py(it.y);
    const outline = Math.max(1.2, ctx.canvas.width * 0.0009);
    if (drawPaintedReferenceFeature(
      ctx,
      it,
      def,
      cx,
      cy,
      printed.width * assetInset,
      printed.height * assetInset,
      outline,
    )) return;
  }
  if (waterArtwork) {
    drawWaterFeature(ctx, it, def, ctx.canvas.width, ctx.canvas.height, pxPerM, false, nearestNeighbourPx);
    return;
  }

  const color = speciesColor(def.id);
  const naturalW = Math.max(1, (it.wM ?? def.wM) * pxPerM);
  const naturalH = Math.max(1, (it.hM ?? def.hM) * pxPerM);
  // Small infrastructure is represented as a conventional point symbol. Preserve its exact
  // centre and rotation, but enforce a printable short side so a hive, tap table or chicken
  // tractor does not collapse into an unreadable pixel beside a perfectly legible leader.
  const isPointInfrastructure = def.category === 'structure' || def.category === 'animal' || def.category === 'access';
  const minShort = Math.max(10, ctx.canvas.width * 0.0065);
  const symbolScale = isPointInfrastructure && Math.min(naturalW, naturalH) < minShort
    ? minShort / Math.min(naturalW, naturalH)
    : 1;
  const plantingPrinted = emphasizeSmallFeatures && (def.category === 'growing' || def.category === 'earthworks')
    ? plantingFeaturePresentationDimensions(def.id, naturalW, naturalH, ctx.canvas.width)
    : null;
  const wPx = plantingPrinted?.width ?? naturalW * symbolScale;
  const hPx = plantingPrinted?.height ?? naturalH * symbolScale;
  const cx = px(it.x), cy = py(it.y);
  const shortPx = Math.min(wPx, hPx);
  const outline = Math.max(1.2, ctx.canvas.width * 0.0009);
  const fruitColor = /citrus|orange/i.test(def.id) ? '#E89B2D'
    : /pomegranate|apple/i.test(def.id) ? '#B94738'
      : /mango|pawpaw|banana/i.test(def.id) ? '#E5B94C'
        : '#D9E7A4';

  ctx.save();
  ctx.translate(cx, cy);
  if (def.shape === 'rect' && it.rot) ctx.rotate((it.rot * Math.PI) / 180);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (
    (def.category === 'structure' || def.category === 'animal' || def.category === 'access') &&
    drawCartographicStructureSymbol(ctx, def, wPx, hPx, outline, {
      seed: Math.floor(stableCartographicUnit(`${def.id}:${it.id}`, 0) * 0x7fffffff),
    })
  ) {
    ctx.restore();
    return;
  }

  if (def.category === 'growing' && def.shape === 'circle') {
    const r = wPx / 2;
    const palette = CANOPY_PALETTES[(SPECIES_INDEX[def.id] ?? 0) % CANOPY_PALETTES.length];
    const seed = `${def.id}:${it.id}`;
    const traceCanopy = () => {
      const points = 24;
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const a = (i / points) * Math.PI * 2;
        const rr = r * (0.83 + stableCartographicUnit(seed, i) * 0.16);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    traceCanopy();
    ctx.shadowColor = 'rgba(20,28,18,0.26)';
    ctx.shadowBlur = Math.max(2, r * 0.13);
    ctx.shadowOffsetX = Math.max(1, r * 0.05);
    ctx.shadowOffsetY = Math.max(1, r * 0.07);
    const canopyWash = ctx.createRadialGradient(-r * 0.22, -r * 0.25, r * 0.05, 0, 0, r);
    canopyWash.addColorStop(0, palette[2]);
    canopyWash.addColorStop(0.56, palette[1]);
    canopyWash.addColorStop(1, palette[0]);
    ctx.fillStyle = canopyWash;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.save();
    traceCanopy();
    ctx.clip();
    const blobCount = r < 7 ? 12 : Math.max(58, Math.min(132, Math.round(r * 1.7)));
    for (let i = 0; i < blobCount; i++) {
      const a = stableCartographicUnit(seed, 100 + i) * Math.PI * 2;
      // sqrt distributes crowns across the canopy area instead of bunching every leaf at centre.
      const d = r * Math.sqrt(stableCartographicUnit(seed, 200 + i)) * 0.86;
      const br = r * (0.028 + stableCartographicUnit(seed, 300 + i) * 0.058);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(1.2, br), 0, Math.PI * 2);
      ctx.fillStyle = palette[i % palette.length];
      ctx.globalAlpha = 0.42 + stableCartographicUnit(seed, 400 + i) * 0.3;
      ctx.fill();
    }
    if (r >= 7) {
      const fleckCount = Math.max(34, Math.min(96, Math.round(r * 1.2)));
      for (let i = 0; i < fleckCount; i++) {
        const a = stableCartographicUnit(seed, 700 + i) * Math.PI * 2;
        const d = r * Math.sqrt(stableCartographicUnit(seed, 800 + i)) * 0.84;
        ctx.beginPath();
        ctx.arc(
          Math.cos(a) * d,
          Math.sin(a) * d,
          Math.max(0.8, r * (0.014 + stableCartographicUnit(seed, 900 + i) * 0.024)),
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = i % 3 === 0 ? '#D7D89A' : '#A9B774';
        ctx.globalAlpha = 0.48;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    traceCanopy();
    ctx.strokeStyle = 'rgba(244,238,218,0.62)';
    ctx.lineWidth = outline + 0.25;
    ctx.stroke();
    if (r >= 5) {
      for (let i = 0; i < 4; i++) {
        const a = stableCartographicUnit(seed, 500 + i) * Math.PI * 2;
        const d = r * (0.26 + stableCartographicUnit(seed, 600 + i) * 0.28);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, Math.max(1, r * 0.045), 0, Math.PI * 2);
        ctx.fillStyle = fruitColor;
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.8, Math.min(5, r * 0.11)), 0, Math.PI * 2);
    ctx.fillStyle = '#3B2C1D';
    ctx.fill();
  } else if (def.category === 'growing') {
    roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, Math.min(5, shortPx * 0.16));
    ctx.fillStyle = def.id === 'pollinator_strip' ? '#536E43' : '#6E5735';
    ctx.fill();
    ctx.strokeStyle = '#F6F0DE';
    ctx.lineWidth = outline + 0.6;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.clip();
    if (def.id === 'pollinator_strip') {
      const dots = ['#F2C84B', '#EEE8D5', '#A98AC7'];
      const step = Math.max(4, shortPx * 0.22);
      let k = 0;
      for (let x = -wPx / 2 + step / 2; x < wPx / 2; x += step) {
        for (let y = -hPx / 2 + step / 2; y < hPx / 2; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, Math.max(1, step * 0.13), 0, Math.PI * 2);
          ctx.fillStyle = dots[k++ % dots.length];
          ctx.fill();
        }
      }
    } else if (/vetiver|spekboom/i.test(def.id)) {
      const step = Math.max(4, shortPx * 0.2);
      ctx.strokeStyle = '#A8C77B';
      ctx.lineWidth = Math.max(1, outline * 0.7);
      for (let x = -wPx / 2 + step / 2; x < wPx / 2; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, hPx / 2);
        ctx.lineTo(x - step * 0.18, -hPx / 2);
        ctx.moveTo(x, hPx / 2);
        ctx.lineTo(x + step * 0.18, -hPx / 2);
        ctx.stroke();
      }
    } else {
      const rows = Math.max(2, Math.min(6, Math.floor(shortPx / 5)));
      ctx.strokeStyle = '#B8D77E';
      ctx.lineWidth = Math.max(1, outline * 0.75);
      for (let i = 1; i <= rows; i++) {
        const y = -hPx / 2 + (i / (rows + 1)) * hPx;
        ctx.beginPath();
        ctx.moveTo(-wPx / 2 + 2, y);
        ctx.lineTo(wPx / 2 - 2, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  } else if (def.category === 'earthworks') {
    const r = wPx / 2;
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = '#9A754A';
      ctx.fill();
      ctx.strokeStyle = '#F6F0DE';
      ctx.lineWidth = outline + 0.6;
      ctx.stroke();
      ctx.beginPath();
      if (def.id === 'herb_spiral') {
        ctx.arc(0, 0, r * 0.72, 0, Math.PI * 1.7);
        ctx.arc(0, 0, r * 0.38, Math.PI * 1.7, Math.PI * 0.2, true);
      } else {
        ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
      }
      ctx.strokeStyle = '#4E6F3D';
      ctx.lineWidth = Math.max(1.2, outline);
      ctx.stroke();
      if (def.id === 'keyhole_bed') {
        ctx.beginPath();
        ctx.moveTo(0, r * 0.18);
        ctx.lineTo(0, r);
        ctx.strokeStyle = '#F6F0DE';
        ctx.stroke();
      }
    } else {
      ctx.beginPath();
      ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
      ctx.fillStyle = '#82613D';
      ctx.fill();
      ctx.strokeStyle = '#F6F0DE';
      ctx.lineWidth = outline + 0.6;
      ctx.stroke();
      ctx.strokeStyle = '#A8C77B';
      ctx.lineWidth = Math.max(1, outline * 0.7);
      for (let y = -hPx * 0.3; y <= hPx * 0.3; y += Math.max(4, hPx * 0.2)) {
        ctx.beginPath();
        ctx.moveTo(-wPx / 2 + 2, y);
        ctx.lineTo(wPx / 2 - 2, y);
        ctx.stroke();
      }
    }
  } else {
    const built = def.category === 'structure' || def.category === 'access';
    const animal = def.category === 'animal';
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, wPx / 2, 0, Math.PI * 2);
    } else {
      roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, Math.min(4, shortPx * 0.14));
    }
    ctx.fillStyle = built ? '#7B7468' : animal ? '#9A764C' : `${color}CC`;
    ctx.fill();
    ctx.strokeStyle = '#F6F0DE';
    ctx.lineWidth = outline + 0.7;
    ctx.stroke();
    if (def.shape === 'rect' && shortPx >= 5) {
      ctx.strokeStyle = built ? '#393D3E' : '#59422B';
      ctx.lineWidth = Math.max(1, outline * 0.75);
      if (/compost/i.test(def.id)) {
        for (const x of [-wPx / 6, wPx / 6]) {
          ctx.beginPath(); ctx.moveTo(x, -hPx / 2); ctx.lineTo(x, hPx / 2); ctx.stroke();
        }
      } else if (/greenhouse|shade_house/i.test(def.id)) {
        for (let x = -wPx * 0.3; x <= wPx * 0.3; x += Math.max(4, wPx * 0.2)) {
          ctx.beginPath(); ctx.moveTo(x, -hPx / 2); ctx.lineTo(x, hPx / 2); ctx.stroke();
        }
      } else if (/beehive/i.test(def.id)) {
        for (let y = -hPx * 0.28; y <= hPx * 0.28; y += Math.max(3, hPx * 0.2)) {
          ctx.beginPath(); ctx.moveTo(-wPx / 2, y); ctx.lineTo(wPx / 2, y); ctx.stroke();
        }
      } else if (/solar_panel/i.test(def.id)) {
        ctx.strokeStyle = '#A8C5D8';
        ctx.beginPath(); ctx.moveTo(0, -hPx / 2); ctx.lineTo(0, hPx / 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-wPx / 2, 0); ctx.lineTo(wPx / 2, 0); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(-wPx / 2, -hPx / 2);
        ctx.lineTo(wPx / 2, hPx / 2);
        ctx.moveTo(wPx / 2, -hPx / 2);
        ctx.lineTo(-wPx / 2, hPx / 2);
        ctx.stroke();
      }
    }
  }

  ctx.restore();

  if (shortPx < 5 && def.shape !== 'circle') {
    ctx.beginPath();
    ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/** Draws every drawn line whose kind `lineInFilter` assigns to `filter` — white-cased then coloured
 *  per LINE_COLORS, with fence posts for fence runs. Shared by buildBlueprintPlantingMap (windbreak)
 *  and buildBlueprintStructuresMap (fence/path) so which lines a sheet DRAWS can never diverge from
 *  which lines `lineInFilter` says it OWNS — the exact split that broke before: windbreak was drawn
 *  and legended on Structures off a hard-coded LINE_STYLE map, while lineInFilter files it under
 *  Planting, so the two disagreed on every plan set (docs/LAYER-AUDIT-2026-07-20.md item on
 *  windbreak). Driving the loop off lineInFilter instead of a per-sheet style-key list makes that
 *  drift structurally impossible. */
function drawFilteredLines(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  px: (n: number) => number,
  py: (n: number) => number,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const l of state.lines) {
    const color = LINE_COLORS[l.kind];
    if (!color || l.points.length < 2 || !lineInFilter(l.kind, filter)) continue;
    const trace = () => {
      const drawPoints = polishedRenderPoints(
        l.points.map(([x, y]) => [px(x), py(y)] as RenderPoint),
      );
      ctx.beginPath();
      drawPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
    };
    const routeVisual = filter === 'structures' ? structuresRouteVisualFor(l.kind) : null;
    const routeDash = routeVisual?.dash ?? [];
    trace();
    ctx.setLineDash([...routeDash]);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 6;
    ctx.stroke();
    trace();
    ctx.setLineDash([...routeDash]);
    ctx.strokeStyle = color;
    ctx.lineWidth = routeVisual?.width ?? 3.5;
    ctx.stroke();
    // Post-and-wire: round posts along the run, matching the composite exactly.
    if (l.kind === 'fence') drawFencePosts(ctx, l.points, px, py, 1);
  }
  ctx.restore();
}

/** Semantic ground-to-canopy stack, then biggest footprint first within each register.
 *  A tree basin must sit UNDER its tree even though it has the smaller footprint; size-only
 *  ordering painted those brown basin symbols over the foliage on the integrated masterplan.
 *  Ties break on id so the same saved design always produces the same sheet. */
function byCartographicStack(state: DesignCanvasState, filter: GlossyLayerFilter): PlacedItem[] {
  return state.items
    .filter((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      return !!def && itemInFilter(def.category, filter, def.id);
    })
    .sort((a, b) => {
      const da = ELEMENTS_BY_ID[a.defId], db = ELEMENTS_BY_ID[b.defId];
      const layerA = cartographicItemPaintRank(da);
      const layerB = cartographicItemPaintRank(db);
      const areaA = (a.wM ?? da.wM) * (a.hM ?? da.hM);
      const areaB = (b.wM ?? db.wM) * (b.hM ?? db.hM);
      return layerA - layerB || areaB - areaA || a.id.localeCompare(b.id);
    });
}

function drawContextItems(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  _frame: CanvasFrame,
): void {
  ctx.save();
  const contextItems = state.items
    .filter((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      return !!def && isContextElement(def, filter);
    })
    .sort((a, b) => {
      const da = ELEMENTS_BY_ID[a.defId], db = ELEMENTS_BY_ID[b.defId];
      const layerA = cartographicItemPaintRank(da);
      const layerB = cartographicItemPaintRank(db);
      const areaA = (a.wM ?? da.wM) * (a.hM ?? da.hM);
      const areaB = (b.wM ?? db.wM) * (b.hM ?? db.hM);
      return layerA - layerB || areaB - areaA || a.id.localeCompare(b.id);
    });
  for (const it of contextItems) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    // Water needs the receiving earthwork footprint, not the Planting sheet's crops or canopy.
    // Draw a quiet bare-soil symbol at the exact saved centre, dimensions and rotation.
    const wPx = Math.max(2, (it.wM ?? def.wM) * pxPerM);
    const hPx = Math.max(2, (it.hM ?? def.hM) * pxPerM);
    ctx.save();
    ctx.translate(px(it.x), py(it.y));
    if (it.rot) ctx.rotate((it.rot * Math.PI) / 180);
    ctx.globalAlpha = EXACT_CONTEXT_ALPHA.water;
    ctx.fillStyle = '#6E5735';
    ctx.strokeStyle = 'rgba(239,226,190,0.88)';
    ctx.lineWidth = Math.max(1, ctx.canvas.width * 0.00075);
    if (def.shape === 'circle') {
      ctx.beginPath();
      ctx.ellipse(0, 0, wPx / 2, hPx / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, Math.min(5, Math.min(wPx, hPx) * 0.12));
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.beginPath();
      ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
      ctx.clip();
      ctx.strokeStyle = 'rgba(205,181,126,0.68)';
      ctx.lineWidth = Math.max(0.8, ctx.canvas.width * 0.0005);
      const spacing = Math.max(4, Math.min(wPx, hPx) * 0.22);
      for (let x = -wPx / 2 + spacing; x < wPx / 2; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, -hPx / 2);
        ctx.lineTo(x, hPx / 2);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawFilteredItems(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  excludeWater = false,
): void {
  const items = byCartographicStack(state, filter);
  const neighbourInputs = items.map((it) => ({
    id: it.defId,
    cx: px(it.x),
    cy: py(it.y),
  }));
  for (let index = 0; index < items.length; index++) {
    const it = items[index];
    const def = ELEMENTS_BY_ID[it.defId];
    // The masterplan draws Water first, then all remaining items. Integrated features such as a
    // banana circle are Water AND Planting content, so test Water membership rather than only the
    // single primary sheet or they are painted twice in the same output.
    if (!def || (excludeWater && itemInFilter(def.category, 'water', def.id))) continue;
    drawTrueFootprint(
      ctx,
      it,
      def,
      px,
      py,
      pxPerM,
      true,
      nearestWaterNeighbourPx(neighbourInputs, index),
    );
  }
}

type ExactFeaturePresentation = 'solid' | 'hybrid';

/**
 * Draw exact feature artwork onto a temporary layer, then blend it over the AI painting.
 *
 * The free exact renderer and the factual Hybrid overlay remain fully opaque. The model's richer
 * material painting is visible around those exact footprints, never through them: translucent
 * tanks, beds and basins read as duplicate/ghost layers and weaken the geometry-lock contract.
 * Routes, labels and the site boundary are also drawn separately at full opacity.
 */
function drawExactFeaturesWithPresentation(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  presentation: ExactFeaturePresentation,
  draw: (featureCtx: CanvasRenderingContext2D) => void,
): void {
  if (presentation === 'solid') {
    draw(ctx);
    return;
  }
  const layer = document.createElement('canvas');
  layer.width = W;
  layer.height = H;
  const layerCtx = layer.getContext('2d');
  if (!layerCtx) {
    draw(ctx);
    return;
  }
  draw(layerCtx);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

/**
 * The exact saved design layer burned over an AI-painted base. This is the shared authority path
 * for every illustrated sheet: the model supplies texture, while this overlay supplies all factual
 * areas, items, routes, counts and the site boundary. House and driveway are stacked separately so
 * they can use the clean source photograph rather than a flat vector fill.
 */
async function buildExactLayerOverlay(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
  W: number,
  H: number,
  phase: 'ground' | 'features' = 'features',
  groundPresentation: 'standard' | 'illustrated' = 'standard',
  featurePresentation: ExactFeaturePresentation = 'solid',
): Promise<string | undefined> {
  await preloadReferenceFeatureArtwork(state, filter, frame);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  const pxPerM = W / (frame.imgW * frame.mPerPx);

  if (phase === 'ground') {
    drawBlueprintGround(ctx, state, px, py, W, refLayers, filter, groundPresentation);
    return canvas.toDataURL('image/png');
  }

  if (filter === 'zones') {
    // Quiet element ghosts make the effort zones falsifiable without claiming those elements as
    // zone content. The exact zone bands then sit above them, as in the benchmark plan.
    ctx.save();
    ctx.globalAlpha = EXACT_CONTEXT_ALPHA.zones;
    drawFilteredItems(ctx, state, 'all', px, py, pxPerM);
    ctx.restore();
    const zones = buildZoneOverlay(state, refLayers, W, H);
    if (zones) ctx.drawImage(await loadImage(zones), 0, 0, W, H);
  } else if (filter === 'water') {
    // Water destination earthworks sit on the ground, their already-saved planting sits above,
    // and pipework/hardware stays readable over both. This is a semantic print stack only: no
    // item is moved, resized in storage, added or removed.
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawWaterFeatures(
        featureCtx,
        state,
        W,
        H,
        pxPerM,
        false,
        (item) => WATER_DESTINATION_GROUND_IDS.has(item.defId),
      );
      drawContextItems(featureCtx, state, filter, px, py, pxPerM, frame);
    });
    drawWaterRoutes(ctx, state, frame, W, H);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawWaterFeatures(
        featureCtx,
        state,
        W,
        H,
        pxPerM,
        false,
        (item) => !WATER_DESTINATION_GROUND_IDS.has(item.defId),
      );
    });
    drawWaterLeaderLabels(ctx, state, refLayers, W, H);
  } else if (filter === 'all') {
    // Zone bands have a dedicated analytical sheet. The integrated benchmark is a physical
    // masterplan, so repeating translucent effort zones here only muddies planting and water.
    drawFilteredLines(ctx, state, 'planting', px, py);
    drawFilteredLines(ctx, state, 'structures', px, py);
    // Routes sit over the ground but below every placed feature. Water and non-Water items then
    // share one biggest-first stack, so a small canopy/fitting is never hidden merely because its
    // category happened to be painted in an earlier subsystem pass.
    drawWaterRoutes(ctx, state, frame, W, H);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawFilteredItems(featureCtx, state, filter, px, py, pxPerM);
    });
  } else if (filter === 'structures') {
    // Prior planting remains visible as quiet context, matching the benchmark infrastructure
    // sheet. It is not counted or legended as Structures content.
    ctx.save();
    ctx.globalAlpha = EXACT_CONTEXT_ALPHA.structures;
    drawFilteredLines(ctx, state, 'planting', px, py);
    drawFilteredItems(ctx, state, 'planting', px, py, pxPerM);
    ctx.restore();
    drawFilteredLines(ctx, state, filter, px, py);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawFilteredItems(featureCtx, state, filter, px, py, pxPerM);
    });
  } else {
    drawFilteredLines(ctx, state, filter, px, py);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawFilteredItems(featureCtx, state, filter, px, py, pxPerM);
    });
  }

  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W, state, frame);
  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" PLANTING map — sheet 05 in docs/PLAN-SET-SPEC.md ("Planting &
// Agroforestry Plan"). Same chrome as the zone/water sheets; the content layer is every growing
// element at its TRUE canopy/bed footprint, coloured per SPECIES (def.color is a per-category
// accent — all 21 growing elements share one green — which is useless on the one sheet whose
// entire job is telling Macadamia from Citrus). Legend lists only the species actually placed,
// with counts. NO AI.
//
// Also draws the windbreak line: lineInFilter puts 'windbreak' on THIS sheet (a windbreak is a
// planted row) and layerContentCount agrees, so a farmer who has drawn one must find it here — it
// used to be drawn and legended on Structures instead, off a hard-coded style map that ignored
// lineInFilter entirely (docs/LAYER-AUDIT-2026-07-20.md).
export async function buildBlueprintPlantingMapLegacy(
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

  // 2. The traced ground — orchard, lawn, veg garden — UNDER the design's own planting. CONTENT
  //    here: an orchard the farmer traced is exactly what this sheet is about.
  drawBlueprintGround(ctx, state, px, py, W, refLayers, 'planting');

  // 3. Windbreak lines — drawn BEFORE the planting itself so a canopy overlapping the hedgerow
  //    still reads on top of it, same stacking as the structures sheet's fence/path lines.
  drawFilteredLines(ctx, state, 'planting', px, py);

  // 3b. The planting itself, at true footprint.
  for (const it of byCartographicStack(state, 'planting')) {
    drawTrueFootprint(ctx, it, ELEMENTS_BY_ID[it.defId], px, py, pxPerM);
  }

  // 4. House + driveway ON TOP of the planting so nearby canopies cannot visually crop the roof.
  //    They stay context, but they must remain readable on the final sheet.
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.9)', '#FFFFFF', 3);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);

  // 4b. Name every species ON THE MAP, grouped, with one leader per group — the same margin-pill
  //     layout the water sheet has had all along. Until now this sheet drew canopies with no way
  //     to tell a mango from a macadamia except by matching legend swatch colours by eye.
  drawBlueprintLabelPills(ctx, producerLabels(state, refLayers, W, H, 'planting'));

  // 5. Boundary — green line with perpendicular fence ticks.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 6. Title (top-left).
  drawBlueprintTitle(ctx, W, pad, 'PLANTING & AGROFORESTRY PLAN', placeName ?? 'Planting plan');

  // 7. Legend (top-right) — the species actually present, then the traced ground, then the fixed
  //    context rows. Ground rows are fixed rather than compressible: they name painted AREAS, and
  //    an unexplained green wash across half the sheet is worse than one fewer species row.
  const rowH = Math.round(W * 0.026);
  const windbreakCount = state.lines.filter((l) => l.kind === 'windbreak' && l.points.length >= 2).length;
  const fixed: BlueprintLegendRow[] = [...groundRows(state, refLayers, 'planting')];
  if (windbreakCount > 0) {
    fixed.push({ color: LINE_COLORS.windbreak, label: `Windbreak${windbreakCount > 1 ? ` ×${windbreakCount}` : ''}`, style: 'line' });
  }
  // Gated on the same test drawBlueprintBoundary uses (line 3562) — same phantom-row bug as the
  // Zones and Structures sheets had (layer-audit RC5): an untraced site must not get a key for a
  // boundary line this sheet never drew.
  if (refLayers.boundary.length >= 3) fixed.push({ color: BOUNDARY_BONE, label: 'Property boundary', style: 'line' });
  if (refLayers.driveway.length >= 2) fixed.push({ color: TAR, label: 'Tarred driveway', style: 'fill' });
  const rows = fitLegendRows(speciesRowsFor(state, 'planting'), fixed, blueprintLegendCapacity(H, pad, rowH));
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 2.4)));
  const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Canopies drawn at mature spread.');

  // 8. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);
  drawImplNorthArrow(ctx, W - pad - Math.round(W * 0.04), H - pad - Math.round(W * 0.04), Math.round(W * 0.05));

  return canvas.toDataURL('image/png');
}

// Deterministic "Blueprint" STRUCTURES map — sheet 06 in docs/PLAN-SET-SPEC.md ("Small Livestock
// & Infrastructure Plan"). Structures + animals + access at true footprint, plus the access/
// boundary LINES (fence/path — NOT windbreak, which lineInFilter files under Planting) that
// lineInFilter assigns to this layer — a farmer who has drawn only paths and fences still has real
// structures-layer content (layerContentCount counts those lines), so this sheet must draw them or
// it would render empty on a design that isn't. NO AI.
export async function buildBlueprintStructuresMapLegacy(
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

  // 1b. Existing site fabric — paving, yard, lawn, and a Studio-traced house/driveway. On the
  //     INFRASTRUCTURE sheet the built surfaces are arguably the subject, so they matter most here
  //     — CONTENT, drawn at full strength.
  drawBlueprintGround(ctx, state, px, py, W, refLayers, 'structures');

  // 2. House + driveway. On THIS sheet the built fabric is content, not background, so the
  //    driveway keeps the zone sheet's dashed kerb and the house gets a brighter outline.
  drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.9)', '#FFFFFF', 3);
  drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, true);

  // 3. Access / boundary lines — white casing under a coloured line, as on the water sheet.
  // FENCE STYLING WAS INVERTED between the two render paths: the AI composite drew it solid violet
  // with round posts (drawMarks), this sheet drew it dashed grey with none — so the same fence in
  // one plan set looked like two different things, and a dash reads as "underground or proposed"
  // when a fence is neither. Both paths now use LINE_COLORS.fence and the post treatment
  // (Rory: "we need to add fence here the one with circles").
  // Driven by lineInFilter('structures') via drawFilteredLines rather than a local style-key map —
  // windbreak used to have its own entry here, drawing and legending it on Structures while
  // lineInFilter files it under Planting (docs/LAYER-AUDIT-2026-07-20.md); a shared helper keyed off
  // the same predicate that legends and counts it makes that pair of sheets structurally unable to
  // disagree again.
  drawFilteredLines(ctx, state, 'structures', px, py);

  // 4. Structures / animals / access, at true footprint.
  for (const it of byCartographicStack(state, 'structures')) {
    drawTrueFootprint(ctx, it, ELEMENTS_BY_ID[it.defId], px, py, pxPerM);
  }

  // 5. Boundary — green line with perpendicular fence ticks.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W);

  // 6. Title (top-left).
  drawBlueprintTitle(ctx, W, pad, 'SMALL LIVESTOCK & INFRASTRUCTURE', placeName ?? 'Structures plan');

  // 7. Legend (top-right) — what's actually present, then the line kinds drawn, then context.
  const rowH = Math.round(W * 0.026);
  const kinds = new Set(state.lines.filter((l) => l.points.length >= 2).map((l) => l.kind));
  // Ground first: this sheet now paints the traced paving, yard and Studio-traced driveway, and a
  // painted area with no key entry is the phantom-legend defect in reverse.
  const fixed: BlueprintLegendRow[] = [...groundRows(state, refLayers, 'structures')];
  if (kinds.has('path')) fixed.push({ color: '#C9A227', label: 'Path', style: 'line' });
  // Windbreak is NOT legended here — lineInFilter files it under Planting (sheet 05), which is
  // now where it is drawn; a row here would advertise a line this sheet's own filter excludes.
  // Swatch must match the line now drawn: solid violet with posts, not a grey dash.
  if (kinds.has('fence')) fixed.push({ color: LINE_COLORS.fence, label: 'Internal fence', style: 'line' });
  // Gated on the same test drawBlueprintBoundary uses (line 3610) — an untraced-boundary design
  // must not print a legend key for a green line that isn't on the page (layer-audit RC5).
  if (refLayers.boundary.length >= 3) fixed.push({ color: BOUNDARY_BONE, label: 'Site boundary', style: 'line' });
  if (refLayers.driveway.length >= 2) fixed.push({ color: TAR, label: 'Tarred driveway', style: 'fill' });
  const rows = fitLegendRows(speciesRowsFor(state, 'structures'), fixed, blueprintLegendCapacity(H, pad, rowH));
  const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 2.4)));
  const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
  drawBlueprintLegendNote(ctx, lg, rowH, ry, 'Footprints drawn at true size.');

  // 8. Scale bar (bottom-left).
  drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);
  drawImplNorthArrow(ctx, W - pad - Math.round(W * 0.04), H - pad - Math.round(W * 0.04), Math.round(W * 0.05));

  return canvas.toDataURL('image/png');
}

/** Sheet 01 uses the same measured editorial composition as the design layers but contains only
 * existing traced fabric. It is the authoritative before-state every later sheet builds upon. */
export async function buildBlueprintBaseMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  const presentation = await boundaryPresentationContext(state, frame, refLayers);
  const renderState = presentation.state;
  const renderFrame = presentation.frame;
  const renderRefLayers = presentation.refLayers;
  const W = renderFrame.imgW * SCALE;
  const H = renderFrame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;

  await drawBlueprintBase(ctx, renderFrame, W, H);
  const ground = await buildExactLayerOverlay(renderState, renderFrame, renderRefLayers, 'all', W, H, 'ground');
  if (ground) ctx.drawImage(await loadImage(ground), 0, 0, W, H);
  const sourceStructures = renderFrame.satDataUrl
    ? await buildLockedStructureOverlay(
        renderFrame.satDataUrl,
        renderState,
        renderFrame,
        renderRefLayers,
        W,
        H,
        'precision_atlas',
      )
    : undefined;
  if (sourceStructures) ctx.drawImage(await loadImage(sourceStructures), 0, 0, W, H);
  drawBlueprintBoundary(ctx, renderRefLayers.boundary, px, py, W, renderState, renderFrame);
  drawBlueprintLabelPills(ctx, groundLabelsForSheet(renderState, renderRefLayers, W, H));

  const legendRows: StyleLegendRow[] = groundRows(renderState, renderRefLayers, 'all').map((row) => ({
    swatch: row.color,
    text: row.label,
    kind: 'ground',
  }));
  if (renderRefLayers.house.length >= 3) {
    legendRows.unshift({ swatch: '#3E4648', text: 'House / building', kind: 'surface' });
  }
  if (renderRefLayers.driveway.length >= 2) {
    legendRows.push({ swatch: '#5A5D57', text: 'Existing tarred driveway', kind: 'surface' });
  }
  if (renderRefLayers.boundary.length >= 3) {
    legendRows.push({ swatch: BOUNDARY_BONE, text: 'Property boundary', lineKind: 'fence' });
  }

  return composeStyleSheet(
    canvas.toDataURL('image/png'),
    renderState,
    renderFrame,
    renderRefLayers,
    'all',
    placeName,
    'Reference Blueprint',
    'Site base map & terrace levels',
    false,
    true,
    { sheetNumber: '01', legendRows },
  );
}

interface ReferencePresentationContext {
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: DesignGlossyProps['refLayers'];
}

/**
 * Finished sheets should feature the designed property, not kilometres of unused satellite.
 * This creates a presentation-only viewport whose shape follows the saved boundary. Metre
 * dimensions remain untouched; one uniform source-to-output scale owns both axes, so an accurately
 * sized bed stays accurately sized and the scale bar stays truthful after the visual zoom.
 */
async function boundaryPresentationContext(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
): Promise<ReferencePresentationContext> {
  const layout = calculateBoundaryPresentationLayout(refLayers.boundary, frame, SCALE);
  if (!layout) return { state, frame, refLayers };
  const {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    imgW,
    imgH,
    sourcePixelsPerOutputPixel,
  } = layout;
  const point = ([x, y]: [number, number]): [number, number] => [
    (x - cropX) / cropWidth,
    (y - cropY) / cropHeight,
  ];
  const offsetX = (value: number | undefined): number | undefined => (
    value == null ? undefined : value / cropWidth
  );
  const offsetY = (value: number | undefined): number | undefined => (
    value == null ? undefined : value / cropHeight
  );

  let satDataUrl = frame.satDataUrl;
  if (frame.satDataUrl) {
    const source = await loadImage(frame.satDataUrl);
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    const sourcePixelScale = Math.min(sourceWidth / frame.imgW, sourceHeight / frame.imgH);
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(1, Math.round(imgW * sourcePixelScale));
    cropCanvas.height = Math.max(1, Math.round(imgH * sourcePixelScale));
    const cropCtx = cropCanvas.getContext('2d');
    if (cropCtx) {
      cropCtx.drawImage(
        source,
        cropX * sourceWidth,
        cropY * sourceHeight,
        cropWidth * sourceWidth,
        cropHeight * sourceHeight,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height,
      );
      satDataUrl = cropCanvas.toDataURL('image/png');
    }
  }

  const presentationFrame: CanvasFrame = {
    ...frame,
    imgW,
    imgH,
    mPerPx: frame.mPerPx * sourcePixelsPerOutputPixel,
    satDataUrl,
  };
  const presentationState: DesignCanvasState = {
    ...state,
    frame: {
      ...state.frame,
      imgW,
      imgH,
      mPerPx: presentationFrame.mPerPx,
    },
    items: state.items.map((item) => {
      const [x, y] = point([item.x, item.y]);
      return { ...item, x, y };
    }),
    zones: state.zones.map((zone) => ({
      ...zone,
      points: zone.points.map(point),
      labelDx: offsetX(zone.labelDx),
      labelDy: offsetY(zone.labelDy),
    })),
    lines: state.lines.map((line) => ({
      ...line,
      points: line.points.map(point),
      labelDx: offsetX(line.labelDx),
      labelDy: offsetY(line.labelDy),
    })),
  };
  return {
    state: presentationState,
    frame: presentationFrame,
    refLayers: {
      boundary: refLayers.boundary.map(point),
      house: refLayers.house.map(point),
      driveway: refLayers.driveway.map(point),
      drivewayClosed: refLayers.drivewayClosed,
    },
  };
}

/**
 * One deterministic sheet pipeline for every design layer.
 *
 * The base may be AI-painted or exact satellite, but the factual overlay, source-derived roof and
 * driveway, leaders, legend, scale and north arrow always come from the saved design. Legacy sheet
 * builders remain above for a one-function rollback while this shared path is verified.
 */
async function buildReferenceBlueprintMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
  placeName?: string,
): Promise<string> {
  const presentation = await boundaryPresentationContext(state, frame, refLayers);
  const renderState = presentation.state;
  const renderFrame = presentation.frame;
  const renderRefLayers = presentation.refLayers;
  const W = renderFrame.imgW * SCALE;
  const H = renderFrame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  await drawBlueprintBase(ctx, renderFrame, W, H);
  const groundOverlay = await buildExactLayerOverlay(renderState, renderFrame, renderRefLayers, filter, W, H, 'ground');
  if (groundOverlay) ctx.drawImage(await loadImage(groundOverlay), 0, 0, W, H);

  // Restore the traced source roof and access after the ground treatment. Factual map features are
  // stacked next, so a pipe, tank or other saved item on the roof remains visible without giving the
  // model any authority to crop, reshape or duplicate the house.
  const source = renderFrame.satDataUrl;
  const sourceStructures = source
    ? await buildLockedStructureOverlay(source, renderState, renderFrame, renderRefLayers, W, H, 'precision_atlas')
    : undefined;
  if (sourceStructures) {
    ctx.drawImage(await loadImage(sourceStructures), 0, 0, W, H);
  } else {
    const px = (n: number) => n * W;
    const py = (n: number) => n * H;
    const pxPerM = W / (renderFrame.imgW * renderFrame.mPerPx);
    drawBlueprintHouse(ctx, renderRefLayers.house, px, py, 'rgba(48,54,59,0.94)', '#FBF6EC', 3);
    drawBlueprintDriveway(ctx, renderRefLayers, px, py, pxPerM, filter === 'structures');
  }

  const featureOverlay = await buildExactLayerOverlay(renderState, renderFrame, renderRefLayers, filter, W, H, 'features');
  if (featureOverlay) ctx.drawImage(await loadImage(featureOverlay), 0, 0, W, H);

  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  if (filter === 'planting' || filter === 'structures' || filter === 'all') {
    drawBlueprintLabelPills(ctx, referenceBlueprintLabels(renderState, renderRefLayers, W, H, filter));
  }

  return composeStyleSheet(
    canvas.toDataURL('image/png'),
    renderState,
    renderFrame,
    renderRefLayers,
    filter,
    placeName,
    'Reference Blueprint',
    REFERENCE_SHEET_LABEL[filter],
    false,
    true,
  );
}

export function buildBlueprintZoneMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'zones', placeName);
}

export function buildBlueprintWaterMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'water', placeName);
}

export function buildBlueprintPlantingMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'planting', placeName);
}

export function buildBlueprintStructuresMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'structures', placeName);
}

export function buildBlueprintWholeMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'all', placeName);
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
  ctx.font = `800 ${Math.round(size * 0.34)}px ${SHEET_BODY_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('N', cx, cy - R * 0.52);
  ctx.restore();
}

interface SectorAnalysisComposition {
  rows: BlueprintLegendRow[];
  noteText: string;
  contextLabel: string;
}

// The deterministic sector geometry (compass ring, fire wedge, sun arc, wind arrows, water/contour
// lines, frost pocket, data strip, title, legend, scale bar, north arrow) — called once from
// composeSectorSheet so the exact and AI sheets draw the EXACT SAME bearings from the EXACT SAME
// code path regardless of which base image sits underneath. Duplicating this ~250-line block into
// a second function would recreate the "two separate traversals that can drift" root cause
// (layer-audit RC2) for the one thing on this sheet that must never disagree between the exact and
// the AI version: the bearings. See docs/RENDER-INVESTIGATION-2026-07-20.md 'sector-ai' finding 4
// — a model-drawn arrow is a coin-flip on both angle and sense, so it must never be redrawn from
// scratch a second time.
function drawSectorAnalysis(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: SectorSite | null,
  placeName: string | undefined,
  pad: number,
  rowH: number,
  pxPerM: number,
  // True over an AI-illustrated base, whose local tone at the title's corner is whatever the model
  // painted there — unlike drawAnalysisBase's always-pale wash, that can be dark enough or light
  // enough to wash the fixed-colour title out to unreadable (a real render did exactly this).
  // False on the exact sheet, which never needs it and shouldn't gain an unasked-for dark corner.
  isAiBase = false,
  // Farmer-traced zones — needed only for the per-terrace fall annotation (§4b), which reads
  // levelM off whatever the farmer entered and is entirely independent of the whole-site water
  // model above. Optional so this function still degrades gracefully if a caller has no state
  // handy (there is currently only one caller, and it always has state).
  state?: DesignCanvasState,
  externalLegend = false,
): SectorAnalysisComposition {
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;

  // Driveway-access geometry (SECTOR-MODEL-SPEC deferred item). Deliberately the SAME centroid
  // priority as cx/cy below (boundary first, frame-centre fallback) — NOT the house centroid.
  // An earlier draft preferred the house centroid ("the house/site centroid" per the spec's own
  // wording), which is defensible in isolation but disagreed with where the arrow is actually
  // drawn FROM: every other energy on this ring (sun, wind, fire) radiates from cx/cy, the
  // boundary centroid, so a house sitting off-centre in the plot produced a computed bearing
  // that didn't match the arrow's own visual origin (adversarial review — real, if minor, since
  // this is a symbolic compass ring, not a to-scale site plan; fixed for internal consistency
  // rather than left as a known skew).
  const bnd = refLayers.boundary;
  const siteCentroidNorm: [number, number] =
    bnd.length >= 3 ? centroidOf(bnd)
    : refLayers.house.length >= 3 ? centroidOf(refLayers.house)
    : [0.5, 0.5];
  const model = deriveSectorModel(
    site, frame.centerLat, frame.centerLng,
    refLayers.driveway.length >= 2 ? { siteCentroid: siteCentroidNorm, drivewayPoints: refLayers.driveway } : null,
  );
  const sectorPresentation = presentSectorCartography(model);
  const evidence = sectorEvidenceSummary(model);
  const sectorPresentationByKey = new Map(sectorPresentation.map((entry) => [entry.key, entry]));
  const isSH = model.southernHemisphere;
  const sectorMarkerKeys: string[] = [];
  const hasSolarPath = (path: SolarModel['summer']) => path.sunriseAzDeg != null && path.sunsetAzDeg != null;
  if (hasSolarPath(model.solar.summer)) sectorMarkerKeys.push('summer-sun');
  if (hasSolarPath(model.solar.winter)) sectorMarkerKeys.push('winter-sun');
  // The polished plan follows the benchmark: the two seasonal arcs carry solar orientation.
  // The legacy in-canvas view retains its separate midday reference.
  if (!externalLegend) sectorMarkerKeys.push('midday-sun');
  for (const wind of model.namedWind) sectorMarkerKeys.push(`wind:${wind.id}`);
  if (model.fire) sectorMarkerKeys.push('fire');
  if (model.driveway) sectorMarkerKeys.push('driveway');
  if (model.water) sectorMarkerKeys.push('water');
  const sectorMarkerIndex = new Map(sectorMarkerKeys.map((key, index) => [key, index + 1]));
  const sectorMarkerRequests: Array<{ key: string; x: number; y: number; color: string }> = [];
  const drawSectorMarker = (key: string, x: number, y: number, color: string): void => {
    if (!externalLegend) return;
    if (!sectorMarkerIndex.has(key)) return;
    sectorMarkerRequests.push({ key, x, y, color });
  };
  const flushSectorMarkers = (): void => {
    // The benchmark numbers legend rows, not the map itself. Earlier composed sheets repeated
    // those numbers as large circles at every arrow tail; the three solar records then piled up
    // at north and obscured the very sun paths they were meant to explain.
    if (externalLegend || sectorMarkerRequests.length === 0) return;
    const r = Math.max(12, W * 0.0105);
    const step = r * 2.35;
    const placed: Array<{ x: number; y: number }> = [];
    const candidates: Array<[number, number]> = [
      [0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [1, 1], [-1, 1],
      [2, 1], [-2, 1], [0, 1], [1, -1], [-1, -1], [3, 0], [-3, 0],
    ];
    const minDistance = r * 2 + Math.max(4, W * 0.003);
    const edgePad = r + Math.max(3, W * 0.003);

    for (const request of [...sectorMarkerRequests].sort((a, b) =>
      (sectorMarkerIndex.get(a.key) ?? 0) - (sectorMarkerIndex.get(b.key) ?? 0))) {
      const n = sectorMarkerIndex.get(request.key);
      if (!n) continue;
      const dx = request.x - cx;
      const dy = request.y - cy;
      const length = Math.hypot(dx, dy) || 1;
      const radialX = dx / length;
      const radialY = dy / length;
      const tangentX = -radialY;
      const tangentY = radialX;
      let chosen = { x: request.x, y: request.y };
      let bestClearance = -Infinity;

      for (const [tangentSteps, radialSteps] of candidates) {
        const x = Math.max(edgePad, Math.min(W - edgePad,
          request.x + tangentX * step * tangentSteps + radialX * r * 1.15 * radialSteps));
        const y = Math.max(edgePad, Math.min(H - edgePad,
          request.y + tangentY * step * tangentSteps + radialY * r * 1.15 * radialSteps));
        const clearance = placed.length === 0
          ? Infinity
          : Math.min(...placed.map((p) => Math.hypot(x - p.x, y - p.y)));
        if (clearance > bestClearance) {
          chosen = { x, y };
          bestClearance = clearance;
        }
        if (clearance >= minDistance) break;
      }

      const shift = Math.hypot(chosen.x - request.x, chosen.y - request.y);
      ctx.save();
      if (shift > 2) {
        ctx.strokeStyle = request.color;
        ctx.globalAlpha = 0.78;
        ctx.lineWidth = Math.max(1.4, W * 0.0011);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(request.x, request.y);
        ctx.lineTo(chosen.x, chosen.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(chosen.x, chosen.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,246,236,0.96)';
      ctx.fill();
      ctx.strokeStyle = request.color;
      ctx.lineWidth = Math.max(2.2, W * 0.0018);
      ctx.stroke();
      ctx.fillStyle = '#20190F';
      ctx.font = `800 ${Math.round(r * 1.05)}px ${SHEET_BODY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), chosen.x, chosen.y + 0.5);
      ctx.restore();
      placed.push(chosen);
    }
  };

  // 3. Ring geometry — centre = boundary centroid (fallback frame centre); radius clamped so arrows
  //    + labels stay inside the frame and clear the top-right legend and top-left title.
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
  // `cap` is the largest radius whose ring + arrow tails + labels still fit on the canvas. It is a
  // HARD ceiling (the trailing Math.min), so a big or edge-hugging boundary shrinks the ring rather
  // than spilling the sun arc / compass ticks / labels off the sheet. Floored at 24 so R stays > 0.
  const cap = Math.max(24, Math.min(maxRx, maxRy) - arrowLen);
  const R = Math.min(Math.max(siteR * 0.7 + 10, Math.min(siteR + W * 0.02, cap)), cap);

  // The full compass ring is useful while editing, but it competes with the actual analysis on a
  // finished sheet. The composed plan already has a north arrow, so keep the ring in legacy view
  // only and let the benchmark-style sheet breathe.
  if (!externalLegend) {
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(232,238,228,0.62)';
    ctx.font = `700 ${Math.round(rowH * 0.6)}px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', cx, cy - R - rowH * 0.5);
    ctx.fillText('S', cx, cy + R + rowH * 0.5);
    ctx.fillText('E', cx + R + rowH * 0.55, cy);
    ctx.fillText('W', cx - R - rowH * 0.55, cy);
    ctx.restore();
  }

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
    const ah = Math.max(12, width * (externalLegend ? 3.4 : 2.6));
    ctx.beginPath();
    ctx.moveTo(exp, eyp);
    ctx.lineTo(exp - ah * Math.cos(ang - 0.42), eyp - ah * Math.sin(ang - 0.42));
    ctx.lineTo(exp - ah * Math.cos(ang + 0.42), eyp - ah * Math.sin(ang + 0.42));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    return { sxp, syp };
  };
  // Every energy label goes through here, and they used to be drawn wherever their own geometry
  // landed — so at the top of the sheet "WATER FLOWS DOWNHILL (INDICATIVE)", "FROST POCKET" and
  // "MIDDAY SUN — N" printed on top of each other, three deep and unreadable. Frost sits at the
  // downhill end, water's label sits just past the same arrow, and the sun arc peaks between them:
  // they collide by construction, not by accident, so a nudge in one place would not have held.
  // Each label now claims a box and later ones step DOWN until they clear it.
  const claimed: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  const labelAt = (x: number, y: number, text: string, color: string) => {
    // On the composed plan sheet the full wording already lives in a numbered, colour-matched
    // external legend. Repeating every sentence around a small real-world plot caused the sun,
    // wind, driveway, fall and frost labels to collide by construction. The exact legacy canvas
    // retains its direct labels; the benchmark sheet uses the clean analysis marks plus legend.
    if (externalLegend) return;
    ctx.save();
    ctx.font = `800 ${Math.round(rowH * 0.48)}px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const halfW = ctx.measureText(text).width / 2 + 6;
    const halfH = rowH * 0.42;
    let ly = y;
    for (let guard = 0; guard < claimed.length + 2; guard++) {
      const hit = claimed.find(
        (b) => x - halfW < b.x1 && b.x0 < x + halfW && ly - halfH < b.y1 && b.y0 < ly + halfH,
      );
      if (!hit) break;
      ly = hit.y1 + halfH + 4;
    }
    claimed.push({ x0: x - halfW, x1: x + halfW, y0: ly - halfH, y1: ly + halfH });
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(8,14,22,0.9)';
    ctx.strokeText(text, x, ly);
    ctx.fillStyle = color;
    ctx.fillText(text, x, ly);
    ctx.restore();
  };

  const directLabelRequests: Array<{
    x: number;
    y: number;
    lines: string[];
    color: string;
    tangentBias?: number;
  }> = [];
  const directLabelAt = (
    x: number,
    y: number,
    lines: string[],
    color: string,
    tangentBias = 0,
  ): void => {
    if (!externalLegend) return;
    directLabelRequests.push({ x, y, lines, color, tangentBias });
  };
  const flushDirectLabels = (): void => {
    if (!externalLegend || directLabelRequests.length === 0) return;
    const directClaims: Array<{ x0: number; x1: number; y0: number; y1: number }> = [
      { x0: 0, x1: W * 0.33, y0: 0, y1: H * 0.18 },
    ];
    const fs = Math.max(18, Math.round(W * 0.0115));
    const lineH = Math.round(fs * 1.08);
    for (const request of directLabelRequests) {
      ctx.save();
      ctx.font = `800 ${fs}px ${REFERENCE_LABEL_FONT}`;
      const halfW = Math.max(...request.lines.map((line) => ctx.measureText(line).width)) / 2 + fs * 0.4;
      const halfH = (lineH * request.lines.length) / 2 + fs * 0.32;
      const candidates: Array<[number, number]> = [
        [request.tangentBias ?? 0, 0],
        [request.tangentBias ?? 0, lineH * 2.4],
        [request.tangentBias ?? 0, -lineH * 2.4],
        [lineH * 4, 0], [-lineH * 4, 0],
        [lineH * 4, lineH * 2.4], [-lineH * 4, lineH * 2.4],
      ];
      let lx = request.x;
      let ly = request.y;
      for (const [dx, dy] of candidates) {
        const tx = Math.max(halfW + W * 0.015, Math.min(W - halfW - W * 0.015, request.x + dx));
        const ty = Math.max(halfH + H * 0.025, Math.min(H - halfH - H * 0.025, request.y + dy));
        const overlaps = directClaims.some(
          (box) => tx - halfW < box.x1 && box.x0 < tx + halfW && ty - halfH < box.y1 && box.y0 < ty + halfH,
        );
        lx = tx;
        ly = ty;
        if (!overlaps) break;
      }
      directClaims.push({ x0: lx - halfW, x1: lx + halfW, y0: ly - halfH, y1: ly + halfH });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(3.5, W * 0.0021);
      ctx.strokeStyle = 'rgba(8,18,12,0.9)';
      request.lines.forEach((line, index) => ctx.strokeText(line, lx, ly + index * lineH));
      ctx.fillStyle = request.color;
      request.lines.forEach((line, index) => ctx.fillText(line, lx, ly + index * lineH));
      ctx.restore();
    }
  };

  // Regional-assumption palette (§4 mechanism 1: these energies are ALWAYS dashed — solid is
  // reserved for computed geometry). Colours match design/benchmark/README.md's transcribed icons
  // (teal / blue / orange wavy wind lines) so the legend and the reference read as the same sheet.
  const SUMMER_COOLING_COLOR = SECTOR_STYLES['summer-cooling-wind'].color;
  const SUMMER_COOLING_LBL = SECTOR_STYLES['summer-cooling-wind'].labelColor;
  const COLD_FRONT_COLOR = SECTOR_STYLES['cold-front-wind'].color;
  const COLD_FRONT_LBL = SECTOR_STYLES['cold-front-wind'].labelColor;
  const BERG_COLOR = SECTOR_STYLES['berg-wind'].color;
  const BERG_LBL = SECTOR_STYLES['berg-wind'].labelColor;

  // A dashed-edge translucent wedge — the shared shape for every regional-assumption wind/fire
  // sector (namedWind + fire). Dashed boundary lines are mechanism 1 of the regional-assumption
  // labelling contract (SECTOR-MODEL-SPEC §4): computed geometry (sun arcs, water/contour lines)
  // is always solid; regional assumptions are always dashed.
  const drawRegionalWedge = (bearingDeg: number, halfWidthDeg: number, kind: SectorVisualKind) => {
    const color = SECTOR_STYLES[kind].color;
    const centerVec = bearingToUnitVector(bearingDeg);
    const v1 = bearingToUnitVector(bearingDeg - halfWidthDeg);
    const v2 = bearingToUnitVector(bearingDeg + halfWidthDeg);
    const rr = R * (externalLegend ? 1.24 : 1.18);
    const tipX = cx + centerVec[0] * R * 0.48;
    const tipY = cy + centerVec[1] * R * 0.48;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + v1[0] * rr, cy + v1[1] * rr);
    ctx.lineTo(cx + v2[0] * rr, cy + v2[1] * rr);
    ctx.closePath();
    ctx.fillStyle = sectorFillColor(kind);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, sectorStrokeWidth(kind, W) * (externalLegend ? 0.42 : 0.28));
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + v1[0] * rr, cy + v1[1] * rr);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + v2[0] * rr, cy + v2[1] * rr);
    ctx.stroke();
    ctx.restore();
  };

  // Finished Sector sheets use the benchmark's broad atmospheric arrows underneath the exact
  // dashed centreline. Their bearing and direction still come from the sourced regional record;
  // this only increases visual weight and never creates another energy or changes its geometry.
  const drawBroadEnergyArrow = (
    fromVec: [number, number],
    color: string,
    emphasis = 1,
  ): { sxp: number; syp: number } => {
    const tailX = cx + fromVec[0] * (R + arrowLen * 1.16);
    const tailY = cy + fromVec[1] * (R + arrowLen * 1.16);
    const tipX = cx + fromVec[0] * R * 0.42;
    const tipY = cy + fromVec[1] * R * 0.42;
    const dx = tipX - tailX;
    const dy = tipY - tailY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const shaftHalf = Math.max(8, W * 0.0074) * emphasis;
    const headHalf = shaftHalf * 2;
    const headLen = Math.max(26, W * 0.029) * emphasis;
    const headBaseX = tipX - ux * headLen;
    const headBaseY = tipY - uy * headLen;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tailX + nx * shaftHalf, tailY + ny * shaftHalf);
    ctx.lineTo(headBaseX + nx * shaftHalf, headBaseY + ny * shaftHalf);
    ctx.lineTo(headBaseX + nx * headHalf, headBaseY + ny * headHalf);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(headBaseX - nx * headHalf, headBaseY - ny * headHalf);
    ctx.lineTo(headBaseX - nx * shaftHalf, headBaseY - ny * shaftHalf);
    ctx.lineTo(tailX - nx * shaftHalf, tailY - ny * shaftHalf);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.76;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, W * 0.0015);
    ctx.stroke();
    // Regional assumptions remain visibly dashed, but the dash is a quiet provenance spine
    // inside one broad benchmark arrow rather than a second arrow and arrowhead on top.
    ctx.globalAlpha = 0.64;
    ctx.strokeStyle = 'rgba(249,246,234,0.9)';
    ctx.lineWidth = Math.max(2, W * 0.0018);
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(tailX + ux * shaftHalf * 0.35, tailY + uy * shaftHalf * 0.35);
    ctx.lineTo(headBaseX + ux * headLen * 0.22, headBaseY + uy * headLen * 0.22);
    ctx.stroke();
    ctx.restore();
    return { sxp: tailX, syp: tailY };
  };

  // The KZN cold-front record explicitly carries driving rain. Small deterministic drops make
  // that sourced effect readable like the benchmark without inventing a separate storm bearing.
  const drawDrivingRain = (bearingDeg: number, halfWidthDeg: number, color: string): void => {
    if (!externalLegend) return;
    // A few drops identify the sourced cold-front sector. A previous 6x7 field obscured the house
    // and lawn and falsely read as 42 separate observations.
    const radii = [0.88, 1.08, 1.27];
    const angular = [-0.5, 0, 0.5];
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.62;
    ctx.lineWidth = Math.max(1.8, W * 0.0014);
    for (const radial of radii) {
      for (const offset of angular) {
        const v = bearingToUnitVector(bearingDeg + halfWidthDeg * offset);
        const x = cx + v[0] * R * radial;
        const y = cy + v[1] * R * radial;
        const dropR = Math.max(4.5, W * 0.0042);
        ctx.beginPath();
        ctx.moveTo(x, y - dropR * 1.35);
        ctx.bezierCurveTo(
          x + dropR * 0.95, y - dropR * 0.15,
          x + dropR * 0.7, y + dropR,
          x, y + dropR,
        );
        ctx.bezierCurveTo(
          x - dropR * 0.7, y + dropR,
          x - dropR * 0.95, y - dropR * 0.15,
          x, y - dropR * 1.35,
        );
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  // 4. FIRE wedge (under everything else) — regional-assumption, derived from the berg wind
  // (never from the demoted NASA winter mean — §0.1). A translucent dashed sector from the
  // berg-wind bearing.
  if (model.fire) {
    drawRegionalWedge(model.fire.bearingDeg, model.fire.halfWidthDeg, 'fire');
    // Fire's bearing EQUALS the berg wind's bearing by construction, so a fire arrow + label on
    // that ray would overprint the berg arrow + label. Let the wedge carry the message and put the
    // label INSIDE the wedge (the ring interior is empty on this sheet).
    const lp = bearingToUnitVector(model.fire.bearingDeg);
    labelAt(cx + lp[0] * R * 0.55, cy + lp[1] * R * 0.55, `FIRE — ${model.fire.fromLabel}`, '#F0A58C');
    drawSectorMarker('fire', cx + lp[0] * R * 0.68, cy + lp[1] * R * 0.68, SECTOR_STYLES.fire.color);
    const fireTangentX = -lp[1];
    // The fire sector shares the berg-wind ray. Its exact wording stays in the external legend;
    // repeating it on the map caused both labels to print over the same upper-left arrow.
  }

  // 5. SUN — TWO real arcs (summer + winter), each swept through the actual computed rise/set
  // azimuths from lib/solar.ts, not a fixed 180° semicircle (SECTOR-MODEL-SPEC §1: "never the
  // octant"). Each arc sweeps through whichever side (N/S) that season's noon sun actually sits on
  // — usually the same side both times, but genuinely different ('mixed') inside the tropics.
  const bearingToCanvasAngle = (bearingDeg: number) => ((bearingDeg - 90) * Math.PI) / 180;
  const drawSunIcon = (x: number, y: number, r: number, color: string): void => {
    ctx.save();
    ctx.strokeStyle = 'rgba(14,20,13,0.82)';
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, W * 0.0012);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
      ctx.lineTo(x + Math.cos(a) * r * 2.05, y + Math.sin(a) * r * 2.05);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.8, W * 0.0011);
      ctx.stroke();
    }
    ctx.restore();
  };
  const drawSunArc = (path: SolarModel['summer'], r: number, color: string) => {
    if (path.sunriseAzDeg == null || path.sunsetAzDeg == null) return null;
    const sweepNorth = path.noonSide !== 'S';
    const startAngle = bearingToCanvasAngle(path.sunriseAzDeg);
    const endAngle = bearingToCanvasAngle(path.sunsetAzDeg);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.5, W * 0.0022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle, sweepNorth);
    ctx.stroke();
    const apexVec = bearingToUnitVector(sweepNorth ? 0 : 180);
    const sunR = Math.max(6, W * 0.0048);
    drawSunIcon(cx + Math.cos(startAngle) * r, cy + Math.sin(startAngle) * r, sunR * 0.75, color);
    drawSunIcon(cx + apexVec[0] * r, cy + apexVec[1] * r, sunR, color);
    drawSunIcon(cx + Math.cos(endAngle) * r, cy + Math.sin(endAngle) * r, sunR * 0.75, color);
    ctx.restore();
    return apexVec;
  };
  const summerR = R + arrowLen * 0.30;
  const winterR = R + arrowLen * 0.62;
  const summerApex = drawSunArc(model.solar.summer, summerR, '#F7C97E');
  const winterApex = drawSunArc(model.solar.winter, winterR, '#F5DFA6');
  if (summerApex) {
    labelAt(
      cx + summerApex[0] * (summerR + rowH * 0.7),
      cy + summerApex[1] * (summerR + rowH * 0.7),
      `SUMMER SUN · ${model.solar.summer.riseLabel16} → ${model.solar.summer.noonSide} → ${model.solar.summer.setLabel16} · noon ${Math.round(model.solar.summer.noonAltitudeDeg)}°`,
      '#F7C97E',
    );
    drawSectorMarker('summer-sun', cx + summerApex[0] * summerR, cy + summerApex[1] * summerR, '#D89A35');
    directLabelAt(
      cx,
      H * 0.08,
      [`SUMMER SUN · ${model.solar.summer.riseLabel16} → ${model.solar.summer.noonSide} → ${model.solar.summer.setLabel16}`],
      SECTOR_STYLES['summer-sun'].labelColor,
    );
  }
  if (winterApex) {
    labelAt(
      cx + winterApex[0] * (winterR + rowH * 0.7),
      cy + winterApex[1] * (winterR + rowH * 0.7),
      `WINTER SUN · ${model.solar.winter.riseLabel16} → ${model.solar.winter.noonSide} → ${model.solar.winter.setLabel16} · noon ${Math.round(model.solar.winter.noonAltitudeDeg)}°`,
      '#F5DFA6',
    );
    drawSectorMarker('winter-sun', cx + winterApex[0] * winterR, cy + winterApex[1] * winterR, '#C9AA5B');
    directLabelAt(
      cx,
      H * 0.125,
      [`WINTER SUN · ${model.solar.winter.riseLabel16} → ${model.solar.winter.noonSide} → ${model.solar.winter.setLabel16}`],
      SECTOR_STYLES['winter-sun'].labelColor,
    );
  }
  // MIDDAY SUN ray — a simple orienting spike toward whichever side(s) the noon sun sits on.
  // 'mixed' (inside the tropics) draws both sides, since the two solstices genuinely disagree.
  const middaySides: Array<'N' | 'S'> = model.sun.middayFrom === 'mixed' ? ['N', 'S'] : [model.sun.middayFrom];
  let middayMarker: { sxp: number; syp: number } | null = null;
  if (!externalLegend) {
    for (const side of middaySides) {
      const arrow = drawArrow(bearingToUnitVector(side === 'N' ? 0 : 180), '#F7C97E', Math.max(3.5, W * 0.0045), []);
      middayMarker ??= arrow;
    }
  }
  const middayLabel =
    model.sun.middayFrom === 'mixed'
      ? `${model.solar.winter.noonSide} (winter) / ${model.solar.summer.noonSide} (summer)`
      : model.sun.middayFrom;
  if (!externalLegend) {
    labelAt(cx, isSH ? cy - R - rowH * 0.2 : cy + R + rowH * 0.2, `MIDDAY SUN — ${middayLabel}`, '#F7C97E');
  }
  if (middayMarker) drawSectorMarker('midday-sun', middayMarker.sxp, middayMarker.syp, '#D89A35');

  // 6. REGIONAL NAMED WIND — summer-cooling / cold-front / berg, dashed wedges (§4 mechanism 1).
  // Replaces the old summer/winter arrows drawn straight off the NASA POWER vector mean, which
  // never places an arrow on this sheet any more (§0.3 — a circular mean of a bimodal wind rose
  // points into the gap between its two real lobes). [] (no regional table for this site) prints
  // a note instead of guessing.
  const windWidth = (kind: SectorVisualKind) => sectorStrokeWidth(kind, W);
  for (const w of model.namedWind) {
    if (w.id === 'berg') drawRegionalWedge(w.bearingDeg, w.halfWidthDeg, 'berg-wind');
    if (w.id === 'summer_cooling') drawRegionalWedge(w.bearingDeg, w.halfWidthDeg, 'summer-cooling-wind');
    if (w.id === 'cold_front') drawRegionalWedge(w.bearingDeg, w.halfWidthDeg, 'cold-front-wind');
    const kind: SectorVisualKind = w.id === 'berg' ? 'berg-wind' : w.id === 'cold_front' ? 'cold-front-wind' : 'summer-cooling-wind';
    const color = SECTOR_STYLES[kind].color;
    const lblColor = w.id === 'berg' ? BERG_LBL : w.id === 'cold_front' ? COLD_FRONT_LBL : SUMMER_COOLING_LBL;
    const v = bearingToUnitVector(w.bearingDeg);
    const marker = externalLegend
      ? drawBroadEnergyArrow(v, color, w.id === 'cold_front' ? 1.08 : 1)
      : drawArrow(v, color, windWidth(kind), [...SECTOR_STYLES[kind].dash], R * 0.4);
    if (w.id === 'cold_front') drawDrivingRain(w.bearingDeg, w.halfWidthDeg, color);
    labelAt(cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `${w.title} ${w.fromLabel}`, lblColor);
    drawSectorMarker(`wind:${w.id}`, marker.sxp, marker.syp, color);
    const directLines = w.id === 'berg'
      ? ['HOT DRY BERG WIND', w.fromLabel]
      : w.id === 'cold_front'
        ? ['COLD-FRONT WIND', w.fromLabel]
        : ['SUMMER COOLING WIND', w.fromLabel];
    const tangentX = -v[1];
    const tangentY = v[0];
    const tangentShift = w.id === 'berg' ? -rowH * 2.8 : 0;
    directLabelAt(
      cx + v[0] * (R + arrowLen * 0.88) + tangentX * tangentShift,
      cy + v[1] * (R + arrowLen * 0.88) + tangentY * tangentShift,
      directLines,
      lblColor,
      w.id === 'berg' ? -rowH * 2 : 0,
    );
  }

  // 6b. DRIVEWAY ACCESS — dust & noise arriving from vehicle access (SECTOR-MODEL-SPEC deferred
  // item, finished 2026-07-21). UNLIKE the regional wedges above, this has a REAL geometric data
  // source — the farmer's own traced driveway — so it is PROVENANCE: computed, not
  // regional-assumption: no region gate, no ᴬ, and drawn SOLID rather than dashed, per §4
  // mechanism 1 ("computed geometry is solid, regional assumptions are dashed") — dashing this
  // would falsely read as a regional guess. The reference benchmark's own row 8 ("Driveway
  // access, dust & noise — NW") carries a solid grey arrow icon, which agrees with that reading.
  // Grey/neutral so it never gets mistaken for one of the wind-palette energies above.
  const DRIVEWAY_COLOR = SECTOR_STYLES.driveway.color, DRIVEWAY_LBL = SECTOR_STYLES.driveway.labelColor;
  if (model.driveway) {
    const v = bearingToUnitVector(model.driveway.bearingDeg);
    const marker = drawArrow(v, DRIVEWAY_COLOR, sectorStrokeWidth('driveway', W) * (externalLegend ? 1.1 : 1), [], externalLegend ? R * 0.48 : R * 0.4);
    labelAt(cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `DRIVEWAY ACCESS — DUST & NOISE — ${model.driveway.fromLabel}`, DRIVEWAY_LBL);
    drawSectorMarker('driveway', marker.sxp, marker.syp, DRIVEWAY_COLOR);
    directLabelAt(
      cx + v[0] * (R + arrowLen * 1.1),
      cy + v[1] * (R + arrowLen * 1.1),
      ['ACCESS · DUST · NOISE', model.driveway.fromLabel],
      DRIVEWAY_LBL,
    );
  }

  // 7. SITE SLOPE / TERRACE FALL — a parallel field of downhill arrows + on-contour lines
  // (dashed = indicative / omitted when flat). This is one single-plane-fit MODEL, not a survey:
  // every arrow has the same computed bearing. Repeating that one bearing across the property
  // matches the benchmark's readable "terrace fall" field without inventing multiple runoff paths.
  let contourIntervalM: number | null = null;
  if (model.water) {
    const dn = bearingToUnitVector(model.water.downhillBearingDeg);
    const cross: [number, number] = [-dn[1], dn[0]];
    // One authoritative downhill arrow is clearer than three parallel copies of the same
    // single-plane estimate. It keeps the bearing honest without covering the building.
    const slopeOffsets = [0];
    const startAlong = externalLegend ? -0.08 : -0.45;
    const endAlong = externalLegend ? 0.44 : 0.58;
    const centerEndX = cx + dn[0] * siteR * endAlong;
    const centerEndY = cy + dn[1] * siteR * endAlong;
    ctx.save();
    if (bnd.length >= 3) {
      blueprintRing(ctx, bnd, px, py);
      ctx.clip();
    }
    ctx.strokeStyle = '#3A8EC4';
    ctx.fillStyle = '#3A8EC4';
    ctx.globalAlpha = externalLegend ? 0.76 : 1;
    ctx.lineWidth = externalLegend ? Math.max(4, W * 0.0048) : Math.max(3, W * 0.004);
    ctx.setLineDash(model.water.indicative ? [8, 6] : []);
    ctx.lineCap = 'round';
    for (const offset of slopeOffsets) {
      const wsx = cx + dn[0] * siteR * startAlong + cross[0] * siteR * offset;
      const wsy = cy + dn[1] * siteR * startAlong + cross[1] * siteR * offset;
      const wex = cx + dn[0] * siteR * endAlong + cross[0] * siteR * offset;
      const wey = cy + dn[1] * siteR * endAlong + cross[1] * siteR * offset;
      ctx.beginPath();
      ctx.moveTo(wsx, wsy);
      ctx.lineTo(wex, wey);
      ctx.stroke();
      ctx.setLineDash([]);
      const wang = Math.atan2(wey - wsy, wex - wsx);
      const wah = Math.max(13, W * (externalLegend ? 0.016 : 0.011));
      ctx.beginPath();
      ctx.moveTo(wex, wey);
      ctx.lineTo(wex - wah * Math.cos(wang - 0.42), wey - wah * Math.sin(wang - 0.42));
      ctx.lineTo(wex - wah * Math.cos(wang + 0.42), wey - wah * Math.sin(wang + 0.42));
      ctx.closePath();
      ctx.fill();
      ctx.setLineDash(model.water.indicative ? [8, 6] : []);
    }
    ctx.restore();
    labelAt(centerEndX, centerEndY + rowH * 0.55, `SLOPE FALL TO ${site?.elevation?.aspectLabel ?? 'DOWNHILL'} · ~${model.water.slopePct.toFixed(0)}%${model.water.indicative ? ' (INDICATIVE)' : ''}`, '#8FD0F0');
    drawSectorMarker('water', centerEndX, centerEndY, '#3A8EC4');
    directLabelAt(
      centerEndX,
      centerEndY + rowH * 1.1,
      ['SLOPE / TERRACE FALL', `${site?.elevation?.aspectLabel ?? 'DOWNHILL'} · ${model.water.slopePct.toFixed(0)}%${model.water.indicative ? ' · INDICATIVE' : ''}`],
      '#8FD0F0',
    );

    // On-contour lines only when the slope is steep enough to be meaningful (>=1.5°).
    if (!model.flat && bnd.length >= 3 && model.water.slopeDeg >= 1.5) {
      const contour = computeContourLines(model.water.slopeDeg, model.water.downhillBearingDeg, bnd, frame.mPerPx, frame.imgW, frame.imgH);
      if (!contour.tooFlat && contour.lines.length) {
        contourIntervalM = contour.intervalM;
        ctx.save();
        // clip to the boundary so the parallel lines don't spill past the plot
        blueprintRing(ctx, bnd, px, py);
        ctx.clip();
        ctx.strokeStyle = 'rgba(126,212,107,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 6]);
        const displayedContourLines = externalLegend && contour.lines.length > 4
          ? contour.lines.filter((_, index) =>
              index === 0
              || index === contour.lines.length - 1
              || index === Math.floor(contour.lines.length / 3)
              || index === Math.floor((contour.lines.length * 2) / 3))
          : contour.lines;
        ctx.globalAlpha = externalLegend ? 0.46 : 1;
        for (const ln of displayedContourLines) {
          ctx.beginPath();
          ctx.moveTo(px(ln.a[0]), py(ln.a[1]));
          ctx.lineTo(px(ln.b[0]), py(ln.b[1]));
          ctx.stroke();
        }
        // Free wins already computed and previously discarded (SECTOR-MODEL-SPEC §5): each line's
        // own elevM, labelled on alternate lines only so it stays legible.
        ctx.font = `700 ${Math.round(rowH * 0.32)}px ${SHEET_BODY_FONT}`;
        ctx.fillStyle = 'rgba(183,232,166,0.85)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        contour.lines.forEach((ln, i) => {
          if (externalLegend) return;
          if (i % 2 !== 0) return;
          const mx = (px(ln.a[0]) + px(ln.b[0])) / 2, my = (py(ln.a[1]) + py(ln.b[1])) / 2;
          ctx.fillText(`${ln.elevM > 0 ? '+' : ''}${ln.elevM}m`, mx, my);
        });
        ctx.restore();
        const mid = contour.lines[Math.floor(contour.lines.length / 2)];
        if (mid) {
          labelAt((px(mid.a[0]) + px(mid.b[0])) / 2, (py(mid.a[1]) + py(mid.b[1])) / 2, 'ON CONTOUR — SWALES RUN THIS WAY', '#B7E8A6');
          labelAt((px(mid.a[0]) + px(mid.b[0])) / 2, (py(mid.a[1]) + py(mid.b[1])) / 2 + rowH * 0.6, `CONTOUR INTERVAL ~${contour.intervalM} m`, '#B7E8A6');
        }
      }
    }
  }

  // 7b. PER-TERRACE FALL — a per-terrace fall/grade annotation computed from what the farmer
  // actually drew and entered (levelM on each ring), NOT from the whole-site plane above. This is
  // a different, narrower thing than the whole-site "TERRACE FALL (uniform-fall model)" legend row
  // already produced by the `model.water` block above: that one is a whole-site decorative claim,
  // this one is a per-terrace measurement, and it stays compatible with either sector
  // implementation because it anchors to the terrace geometry itself, not the sheet-wide bearing.
  // Reuses THIS function's own labelAt/claimed[] collision-avoidance — never a second copy of it
  // (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §4b).
  let terraceFallDrawn = false;
  if (state) {
    // MUST be 'terrace_bank' only, not "any leveled ground feature". The spec's own documented
    // workflow (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §3) has a farmer trace the HOUSE and
    // set levelM: 0.0 as the site's reference datum, then trace terrace_bank rings below it —
    // exactly the kind of leveled-but-not-a-terrace ring this filter used to also match. With the
    // sequential-pairing fix just above, that stopped being harmless: sorting every leveled
    // feature by level and pairing strict neighbours spliced the house straight into the terrace
    // chain as its own "bench", drawing a false TERRACE FALL arrow running from the house to the
    // first real terrace (adversarial review — caught before this shipped, not after).
    const terraces = state.zones.filter((z) => z.feature === 'terrace_bank' && z.levelM != null && z.points.length >= 3);
    // SECTOR-MODEL-SPEC §5: parallel downhill arrows across stacked terrace benches, ONE PER
    // ADJACENT PAIR — never the overall top-to-bottom drop. The previous "biggest-drop-first,
    // claim both rings" greedy pass got this wrong for exactly 3 stacked benches: with levels
    // top/middle/bottom, the top→bottom pair has the single biggest drop, so it was claimed
    // first and both its rings marked used — leaving the middle bench with no arrow on either
    // side and its own grade silently averaged away into the top→bottom figure (a real defect;
    // see this function's header comment). Sorting by LEVEL and pairing each bench with only its
    // immediate next-lower neighbour fixes this by construction: a middle bench is adjacent to
    // both the bench above and the one below, so it gets an arrow to each — N stacked benches
    // produce N-1 arrows, every one of them a real adjacent-pair drop, never an average.
    const sorted = [...terraces].sort((a, b) => b.levelM! - a.levelM!);
    const pairs: Array<{ upper: ZoneShape; lower: ZoneShape; dropM: number }> = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const upper = sorted[i], lower = sorted[i + 1];
      const dropM = upper.levelM! - lower.levelM!;
      if (dropM <= 0) continue; // tied levels — no fall between this pair, nothing to annotate
      pairs.push({ upper, lower, dropM });
    }
    for (const { upper, lower, dropM } of pairs) {
      const [ux, uy] = centroidOf(upper.points);
      const [lx, ly] = centroidOf(lower.points);
      const uxp = px(ux), uyp = py(uy), lxp = px(lx), lyp = py(ly);
      const runM = Math.hypot(lxp - uxp, lyp - uyp) / pxPerM;
      if (runM < 0.5) continue; // degenerate/overlapping rings — don't divide by ~0
      const gradePct = Math.round((dropM / runM) * 100);
      const fallWidth = Math.max(3, W * 0.004);
      ctx.save();
      ctx.strokeStyle = '#3A8EC4';
      ctx.fillStyle = '#3A8EC4';
      ctx.lineWidth = fallWidth;
      ctx.lineCap = 'round';
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.moveTo(uxp, uyp);
      ctx.lineTo(lxp, lyp);
      ctx.stroke();
      ctx.setLineDash([]);
      const ang = Math.atan2(lyp - uyp, lxp - uxp);
      const ah = Math.max(9, fallWidth * 2.6);
      ctx.beginPath();
      ctx.moveTo(lxp, lyp);
      ctx.lineTo(lxp - ah * Math.cos(ang - 0.42), lyp - ah * Math.sin(ang - 0.42));
      ctx.lineTo(lxp - ah * Math.cos(ang + 0.42), lyp - ah * Math.sin(ang + 0.42));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Provenance stated on the label itself — this is computed from the farmer's own entered
      // levels and traced positions, not a survey or SRTM-derived figure, so it must never be
      // mistaken for one (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §4b).
      labelAt(
        (uxp + lxp) / 2, (uyp + lyp) / 2,
        `TERRACE FALL (FROM YOUR ENTERED LEVELS) — ${dropM.toFixed(1)} m OVER ${runM.toFixed(0)} m (${gradePct}%)`,
        '#8FC4E8',
      );
      terraceFallDrawn = true;
    }
  }

  // 8. COLD-AIR DRAINAGE (frost) — downgraded from a fixed-spot pocket ellipse to an open dashed
  // chevron (SECTOR-MODEL-SPEC §5): cold-air pooling is set by micro-topography (a dip, a hedge, a
  // wall) this app holds no data for, so it must never claim a definite pocket at a definite spot.
  if (model.frost) {
    const dn = bearingToUnitVector(model.frost.downhillBearingDeg);
    const fx = cx + dn[0] * siteR * 0.85, fy = cy + dn[1] * siteR * 0.85;
    ctx.save();
    ctx.strokeStyle = '#9FD0E8';
    ctx.lineWidth = 2.4;
    ctx.setLineDash([3, 4]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    // Open chevron (no fill, no fixed pocket) pointing further downhill from the arrow's end.
    const cang = Math.atan2(dn[1], dn[0]);
    const chevLen = Math.max(14, W * 0.018);
    const cx2 = fx + dn[0] * chevLen * 1.4, cy2 = fy + dn[1] * chevLen * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx2 - chevLen * Math.cos(cang - 0.5), cy2 - chevLen * Math.sin(cang - 0.5));
    ctx.lineTo(cx2, cy2);
    ctx.lineTo(cx2 - chevLen * Math.cos(cang + 0.5), cy2 - chevLen * Math.sin(cang + 0.5));
    ctx.stroke();
    ctx.restore();
    labelAt(fx, fy + rowH * 0.6, 'COLD AIR DRAINS THIS WAY — POCKETS FORM IN LOW SPOTS (CHECK ON SITE)', '#CDE7FA');
  }

  // Markers are painted in one final pass so nearby sun paths and winds can share a bearing
  // without stacking their numbered references. Moved markers retain a short coloured leader.
  flushSectorMarkers();
  // Direct labels must be the final cartographic layer. Painting them at the time each sector was
  // created let later sun arcs, wedges and arrows cross straight over earlier words.
  flushDirectLabels();

  // 9. DATA STRIP under the title — real figures only, missing ones omitted.
  const parts: string[] = [];
  // FACING is only meaningful when there's real fall — below 0.5° the aspect is noise, so don't assert it.
  if (site?.elevation) parts.push(`SLOPE ${site.elevation.slopeDeg.toFixed(1)}° (${site.elevation.slopePct.toFixed(0)}%)${site.elevation.slopeDeg > 0.5 ? ` FACING ${site.elevation.aspectLabel}` : ' · ~flat'}`);
  if (site?.climate?.windSpeed != null) parts.push(`WIND ${site.climate.windSpeed.toFixed(1)} m/s`);
  if (site?.climate?.minTemp != null) parts.push(`MIN ${site.climate.minTemp.toFixed(0)}°C`);
  if (site?.rainfallMm != null) parts.push(`${Math.round(site.rainfallMm)} mm/yr`);
  if (contourIntervalM != null) parts.push(`CONTOUR INTERVAL ~${contourIntervalM} m`);
  const dataStripStr = parts.length ? parts.join('  ·  ') : '';
  // Self-citing SOURCES line (SECTOR-MODEL-SPEC §4) — only the sources actually used on this sheet.
  const SOURCE_LABEL: Record<string, string> = {
    'kruger2014': 'Kruger 2014', 'ams-bergwind': 'AMS Glossary', 'tshabalala2023': 'Tshabalala 2023',
  };
  const sourceKeys = new Set<string>(['Meeus ch.13']); // sun geometry is always computed from latitude
  for (const w of model.namedWind) sourceKeys.add(SOURCE_LABEL[w.sourceKey] ?? w.sourceKey);
  if (model.fire) sourceKeys.add(SOURCE_LABEL[model.fire.sourceKey] ?? model.fire.sourceKey);
  const sourcesStr = `SOURCES: ${Array.from(sourceKeys).join(' · ')}`;

  // 10. Chrome — title, SECTOR LEGEND (numbered 1..9, icon per row, regional rows superscripted
  // ᴬ), scale bar, north arrow. HARD INVARIANT: every row here is gated on the EXACT SAME boolean
  // the corresponding draw call above used — never a legend row with nothing drawn, never a drawn
  // energy with no legend row.
  const titleStr = 'SECTOR ANALYSIS';
  const subtitleStr = placeName ?? 'Site energies · sun · wind · water · fire';
  // Scrim FIRST — before any of the up-to-four lines that land in this corner, so it sits
  // underneath every one of them rather than needing each line to protect itself.
  if (isAiBase) {
    drawTitleBlockScrim(
      ctx, pad,
      externalLegend ? [titleStr, subtitleStr] : [titleStr, subtitleStr, dataStripStr, sourcesStr],
      externalLegend
        ? [`800 ${Math.round(W * 0.028)}px ${SHEET_TITLE_FONT}`, `600 ${Math.round(W * 0.015)}px ${SHEET_BODY_FONT}`]
        : [`800 ${Math.round(W * 0.028)}px ${SHEET_TITLE_FONT}`, `600 ${Math.round(W * 0.015)}px ${SHEET_BODY_FONT}`, `600 ${Math.round(W * 0.013)}px ${SHEET_BODY_FONT}`, `600 ${Math.round(W * 0.011)}px ${SHEET_BODY_FONT}`],
    );
  }
  if (dataStripStr && !externalLegend) {
    ctx.save();
    ctx.fillStyle = '#B9C2C8';
    ctx.font = `600 ${Math.round(W * 0.013)}px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(dataStripStr, pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024) + Math.round(W * 0.022));
    ctx.restore();
  }
  if (!externalLegend) {
    ctx.save();
    ctx.fillStyle = 'rgba(185,194,200,0.75)';
    ctx.font = `600 ${Math.round(W * 0.011)}px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(sourcesStr, pad, pad + Math.round(W * 0.028) + Math.round(W * 0.024) + Math.round(W * 0.022) + Math.round(W * 0.018));
    ctx.restore();
  }
  drawBlueprintTitle(ctx, W, pad, titleStr, subtitleStr);
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];
  const markerIcon = (key: string): string | undefined => {
    const n = sectorMarkerIndex.get(key);
    if (!n) return undefined;
    return n <= CIRCLED.length ? CIRCLED[n - 1] : `${n}.`;
  };
  const rows: BlueprintLegendRow[] = [];
  // Gated on the SAME `summerApex`/`winterApex` the arcs above returned — null only inside the
  // polar circles (never reachable at a South African latitude, but honoured anyway per the
  // HARD INVARIANT: no legend row for geometry that wasn't drawn).
  if (summerApex) rows.push({ color: '#F7C97E', label: sectorPresentationByKey.get('summer-sun')?.label ?? 'Summer sun', style: 'line', icon: markerIcon('summer-sun'), sectorIcon: 'sun' });
  if (winterApex) rows.push({ color: '#F5DFA6', label: sectorPresentationByKey.get('winter-sun')?.label ?? 'Winter sun', style: 'line', icon: markerIcon('winter-sun'), sectorIcon: 'sun' });
  if (!externalLegend) {
    rows.push({ color: '#F7C97E', label: `Midday sun (${middayLabel})`, style: 'line', icon: markerIcon('midday-sun'), sectorIcon: 'sun' });
  }
  // Read each direction off the matched w.fromLabel, never hardcode it — this only ever read
  // right for the one region (kzn-coastal) that exists today; a second region would have silently
  // kept printing "NE/SW/NW" while the map arrows correctly pointed wherever that region's own
  // table said (adversarial review finding: "the legend silently lies the day a second region
  // lands").
  const summerCoolingWind = model.namedWind.find((w) => w.id === 'summer_cooling');
  const coldFrontWind = model.namedWind.find((w) => w.id === 'cold_front');
  const bergWind = model.namedWind.find((w) => w.id === 'berg');
  if (summerCoolingWind) rows.push({ color: SUMMER_COOLING_COLOR, label: `Regional summer cooling wind — ${summerCoolingWind.fromLabel} ᴬ`, style: 'dashline', icon: markerIcon(`wind:${summerCoolingWind.id}`), sectorIcon: 'wind' });
  if (coldFrontWind) rows.push({ color: COLD_FRONT_COLOR, label: `Regional cold front — driving rain — ${coldFrontWind.fromLabel} ᴬ`, style: 'dashline', icon: markerIcon(`wind:${coldFrontWind.id}`), sectorIcon: 'wind' });
  if (bergWind) rows.push({ color: BERG_COLOR, label: `Regional berg wind — ${bergWind.fromLabel} ᴬ`, style: 'dashline', icon: markerIcon(`wind:${bergWind.id}`), sectorIcon: 'wind' });
  if (model.fire) rows.push({ color: '#D64A2A', label: `Regional fire approach (${model.fire.fromLabel}) ᴬ`, style: 'dashline', icon: markerIcon('fire'), sectorIcon: 'fire' });
  // No ᴬ — computed from the traced driveway, not a regional assumption (see the draw-call
  // comment above). 'line' not 'dashline' for the same reason: solid is this sheet's register for
  // computed geometry.
  if (model.driveway) rows.push({ color: DRIVEWAY_COLOR, label: `Driveway access — dust & noise — ${model.driveway.fromLabel}`, style: 'line', icon: markerIcon('driveway'), sectorIcon: 'driveway' });
  if (model.water) rows.push({ color: '#3A8EC4', label: `Site slope falls ${site?.elevation?.aspectLabel ?? 'downhill'} · ~${model.water.slopePct.toFixed(0)}% (local DEM · indicative)`, style: model.water.indicative ? 'dashline' : 'line', icon: markerIcon('water'), sectorIcon: 'water' });
  if (model.water && !model.flat && model.water.slopeDeg >= 1.5 && bnd.length >= 3) rows.push({ color: '#7ED46B', label: `On-contour (swale line)${contourIntervalM != null ? ` — ${contourIntervalM} m interval` : ''}`, style: 'dashline', sectorIcon: 'water' });
  // Gated on drawTerraceFallAnnotations (above) having actually drawn at least one pair — never a
  // placeholder row for a design with no terraces (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md
  // §4b). A different row from the whole-site "Terrace fall ~X% (uniform-fall model)" row above:
  // that one is the whole-site plane; this one is per-terrace, from the farmer's own entered levels.
  if (terraceFallDrawn) rows.push({ color: '#3A8EC4', label: 'Terrace fall (from your entered levels)', style: 'dashline' });
  if (model.frost) rows.push({ color: '#9FD0E8', label: 'Cold-air drainage (inferred)', style: 'dashline', sectorIcon: 'frost' });
  // Gated on the SAME test the boundary draw uses (bnd.length >= 3, computed above). Unconditional,
  // this printed a key for a fence line that is not on the page whenever the boundary is untraced —
  // the phantom-row defect from the layer audit, fixed on Zones, Planting, Structures and print
  // sheet 01 in that pass, with sheet 02 out of scope and missed. Site boundary is NOT one of the
  // 9 numbered energies (SECTOR-MODEL-SPEC §6) — it stays a plain, unnumbered fixed row.
  if (bnd.length >= 3) rows.push({ color: BOUNDARY_BONE, label: 'Site boundary', style: 'line' });
  // Footer: the REGIONAL SECTOR ASSUMPTIONS disclosure is MANDATORY, verbatim, whenever any
  // regional-assumption sector is on the sheet (SECTOR-AI-LEGEND-PLAN §4) — it always wins over a
  // generic data-quality caveat, because a farmer must never read a regional wind/fire bearing
  // without also reading that it is not a measurement of their own land.
  const REGIONAL_FOOTER =
    'ᴬ REGIONAL SECTOR ASSUMPTIONS — wind, berg and fire directions are the documented regional pattern for coastal KwaZulu-Natal, not measurements at this site. Confirm local wind, fire and runoff directions by on-site observation before siting windbreaks or firebreaks. Sun path is computed from latitude. Bearings are TRUE north.';
  const siteWindEvidence = model.siteWindEvidence
    ? ` COORDINATE CLIMATE GRID — summer mean FROM ${model.siteWindEvidence.summerFromLabel ?? 'unavailable'}; winter mean FROM ${model.siteWindEvidence.winterFromLabel ?? 'unavailable'}${model.siteWindEvidence.annualMeanSpeedMps != null ? `; annual mean ${model.siteWindEvidence.annualMeanSpeedMps.toFixed(1)} m/s` : ''}. This is coarse climatology for these coordinates, not an on-site wind observation.`
    : '';
  const noteText = model.namedWind.length > 0
    ? `${evidence.footer} ${REGIONAL_FOOTER}${siteWindEvidence}`
    : `${evidence.footer} ${model.dataNotes[0] ?? 'Read the site before you design it.'}${siteWindEvidence}`;
  if (!externalLegend) {
    const noteLines = Math.max(1, Math.ceil(noteText.length / 52));
    const lg = drawBlueprintLegendFrame(ctx, W, pad, rowH, Math.round(rowH * (rows.length + 1.6 + noteLines * 0.6)), 'SECTOR LEGEND');
    const ry = drawBlueprintLegendRows(ctx, lg, rowH, rows);
    drawBlueprintLegendNote(ctx, lg, rowH, ry, noteText);
    drawBlueprintScaleBar(ctx, W, H, pad, rowH, pxPerM);
    drawImplNorthArrow(ctx, W - pad - Math.round(W * 0.04), H - pad - Math.round(W * 0.04), Math.round(W * 0.05));
  }
  return { rows, noteText, contextLabel: evidence.headline };
}

// Deterministic SECTOR ANALYSIS sheet — plan-set 02 (analysis precedes design: the sector energies
// are WHY the zones/water/planting sit where they do). Draws the site's REAL energies — sun (from
// the north in the SH), summer/winter wind, dry-season fire approach, downslope water flow + on-
// contour lines, and frost drainage — from lib/sector.deriveSectorModel. Nothing is invented; each
// energy degrades independently when its data is missing. Same Blueprint chrome as sheets 03–08.
//
// ONE COMPOSER, TWO BASES. This used to be the whole exact-sheet builder, with a second, PARALLEL
// function (buildSectorOverlayImage, now deleted) drawing only the chrome for the AI path onto a
// transparent canvas, trusting the model to have painted the house/driveway/boundary underneath at
// the RIGHT place. That trust is exactly what commit 967c345 found broken: gpt-image-2 reframes the
// scene, our arrows stayed at true frame coordinates, and four renders running had the boundary cut
// through the house. `composeSectorSheet` is the fix — one draw list, parameterised only on WHERE
// the base pixels come from. Every ring, house, driveway, boundary, label and legend row below is
// drawn at `frame`/`refLayers`/`site`-derived coordinates regardless of what the base shows, so the
// AI base can shift, rescale or reframe under this chrome and nothing downstream can ever
// misregister against it — the base carries no geometry anything here reads back or aligns to.
function drawSectorContextLabels(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
): void {
  const labels: Array<{ text: string; x: number; y: number; area: number }> = [];
  if (refLayers.house.length >= 3) {
    const [x, y] = centroidOf(refLayers.house);
    labels.push({ text: 'HOUSE', x: x * W, y: y * H, area: 10 });
  }
  if (refLayers.driveway.length >= 2) {
    const [x, y] = centroidOf(refLayers.driveway);
    labels.push({ text: 'TARRED DRIVEWAY', x: x * W, y: y * H, area: 9 });
  }
  const groundName: Partial<Record<GroundFeatureKind, string>> = {
    lawn: 'LAWN TERRACE',
    veg_garden: 'EXISTING VEGETABLE GARDEN',
    orchard: 'EXISTING ORCHARD',
    cleared: 'LOWER CLEARED GROUND',
    patio: 'PATIO / COURTYARD',
    terrace_bank: 'TERRACE BANK / LEVEL CHANGE',
  };
  const bestByKind = new Map<GroundFeatureKind, ZoneShape>();
  for (const zone of state.zones) {
    if (!zone.feature || !groundName[zone.feature] || zone.points.length < 3) continue;
    const current = bestByKind.get(zone.feature);
    if (!current || ringArea(zone.points) > ringArea(current.points)) bestByKind.set(zone.feature, zone);
  }
  for (const [kind, zone] of bestByKind) {
    const [x, y] = centroidOf(zone.points);
    const level = zone.levelM != null ? ` ${zone.levelM >= 0 ? '+' : ''}${zone.levelM.toFixed(1)} m` : '';
    labels.push({ text: `${groundName[kind]}${level}`, x: x * W, y: y * H, area: ringArea(zone.points) });
  }
  const fs = Math.max(15, Math.round(W * 0.011));
  for (const label of labels.sort((a, b) => b.area - a.area).slice(0, 6)) {
    drawReferenceMapText(ctx, label.text, label.x, label.y, fs, 750, 'center');
  }
}

async function composeSectorSheet(
  baseImage: string | null,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: SectorSite | null,
  placeName?: string,
): Promise<string> {
  const presentation = await boundaryPresentationContext(state, frame, refLayers);
  const renderState = presentation.state;
  const renderFrame = presentation.frame;
  const renderRefLayers = presentation.refLayers;
  const W = renderFrame.imgW * SCALE;
  const H = renderFrame.imgH * SCALE;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  const pxPerM = W / (renderFrame.imgW * renderFrame.mPerPx);
  const pad = Math.round(W * 0.02);
  const rowH = Math.round(W * 0.026);

  // 1. The base. Exact (baseImage null): real satellite, desaturated/lightened + paper wash — an
  //    analysis sheet is arrows and arcs over ground, and over dense KZN bush a dark scrim leaves a
  //    near-black field the sun arc, wind arrows and frost ellipse have to fight. AI (baseImage
  //    set): the model's own illustrated ground, already stylised — no desaturate/brighten filter
  //    (that belongs to a raw photo, not art the model already toned), just the same paper wash so
  //    both bases share one tone. Either way, nothing about this base is trusted for geometry.
  if (baseImage) {
    const img = await loadImage(baseImage);
    ctx.save();
    if ('filter' in ctx) ctx.filter = 'saturate(0.68) brightness(0.94) contrast(0.92)';
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
    drawPaperWash(ctx, W, H);
  } else {
    await drawAnalysisBase(ctx, renderFrame, W, H);
  }
  // 2. Orientation context ONLY — no zones/items/lines (analysis precedes design).
  // The benchmark leaves lawn, garden, paving and cleared-ground overlays out of this sheet:
  // they are base-map information, not sector energies. Keep the satellite quiet beneath the
  // authoritative house, driveway, boundary, arrows and arcs below.
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (const footprint of authoritativeHouseFootprints(renderState, renderRefLayers)) {
    drawBlueprintHouse(
      ctx,
      footprint,
      px,
      py,
      'rgba(58,63,74,0.85)',
      'rgba(255,255,255,0.85)',
      2.5,
    );
  }
  drawBlueprintDriveway(ctx, renderRefLayers, px, py, pxPerM, false);
  ctx.restore();
  drawBlueprintBoundary(ctx, renderRefLayers.boundary, px, py, W, renderState, renderFrame);

  const analysis = drawSectorAnalysis(
    ctx,
    W,
    H,
    renderFrame,
    renderRefLayers,
    site,
    placeName,
    pad,
    rowH,
    pxPerM,
    baseImage !== null,
    renderState,
    true,
  );
  // Keep sheet 02 focused on sector energies. The base fabric stays as quiet orientation, while
  // labels are reserved for sun, wind, fire, access, fall and the legend.
  const legendRows: StyleLegendRow[] = analysis.rows.map((row, index) => ({
    swatch: row.color,
    text: `${index + 1}. ${row.label}`,
    lineKind: row.style === 'dashline' ? 'drip' : row.style === 'line' ? 'pipe' : undefined,
    kind: row.style === 'fill' ? 'surface' : undefined,
    sectorIcon: row.sectorIcon,
  }));

  return composeStyleSheet(
    canvas.toDataURL('image/png'),
    renderState,
    renderFrame,
    renderRefLayers,
    'all',
    placeName,
    analysis.contextLabel,
    'Sector analysis',
    false,
    true,
    { sheetNumber: '02', legendRows, footerText: analysis.noteText },
  );
}

// The exact sheet is composeSectorSheet with no AI base — everything else is identical, which is
// what guarantees the exact and AI sheets are pixel-identical outside their ground texture,
// including the legend: there is only one place drawSectorAnalysis's rows are ever assembled.
export async function buildBlueprintSectorMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: SectorSite | null,
  placeName?: string,
): Promise<string> {
  return composeSectorSheet(null, state, frame, refLayers, site, placeName);
}

// Single source of truth for sheet 08's complete map-plus-schedule envelope. The exact sheet, both
// AI inputs, the panel blank-out and the protect mask must agree byte-for-byte about these bounds:
// a private size in any one path either exposes real schedule text to the model or restores it into
// the wrong place. calculatePhasingSheetSize shares the same map + readable-column rule as 01–07.
//
// Those four used to derive W/H from the RAW frame while nothing else did, which was fine only
// while sheet 08 alone stayed 3:2. The moment it follows the boundary like sheets 01–07, any path
// still measuring the raw frame puts phasingPanelRect somewhere the panel is not — blanking the
// wrong rectangle, protecting the wrong pixels, and exposing real schedule text to the model. That
// is the precise failure the comment on phasingPanelRect warns about, one level up.
//
// Deliberately SYNCHRONOUS. calculateBoundaryPresentationLayout needs only the boundary;
// boundaryPresentationContext is async purely because it re-crops the satellite. Keeping this sync
// means buildPhasingProtectMask does not have to become async and grow a new failure mode.
// Falls back to the raw frame on a site with no usable boundary, exactly as the context does.
function phasingSheetSize(
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
): ReturnType<typeof calculatePhasingSheetSize> {
  return calculatePhasingSheetSize(refLayers.boundary, frame, SCALE);
}

function phasingPanelRect(size: ReturnType<typeof calculatePhasingSheetSize>) {
  const pad = Math.round(size.mapW * 0.02);
  const lgW = size.legendWidth;
  const lgX = size.mapW;
  const lgY = 0;
  const lgBottom = size.H;
  return { pad, lgW, lgX, lgY, lgBottom };
}

// Draws every EXACT-content layer of the Phasing sheet that is not the schedule panel itself:
// ground, structures, features, boundary, and the numbered phase pins. Shared by
// buildImplementationMap (draws it once, then adds the panel) and composePhasingSheet (redraws it
// on top of the model's decorative art, for BOTH the Hybrid and the Full Treatment polish stage —
// the model never owns this content). A second, independently-written copy of the pin-centroid
// logic here is exactly the class of drift bug this file's own recurring-bug-pattern comments warn
// about, so buildImplementationMap no longer has its own inline copy — this is the only one.
async function drawPhasingExactContent(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  plan: ReturnType<typeof buildPhasePlan>,
  W: number,
  H: number,
): Promise<void> {
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  const pxPerM = W / (frame.imgW * frame.mPerPx);

  const groundOverlay = await buildExactLayerOverlay(state, frame, refLayers, 'all', W, H, 'ground');
  if (groundOverlay) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.drawImage(await loadImage(groundOverlay), 0, 0, W, H);
    ctx.restore();
  }
  const sourceStructures = frame.satDataUrl
    ? await buildLockedStructureOverlay(frame.satDataUrl, state, frame, refLayers, W, H, 'precision_atlas')
    : undefined;
  if (sourceStructures) {
    ctx.save();
    ctx.globalAlpha = EXACT_CONTEXT_ALPHA.implementation;
    ctx.drawImage(await loadImage(sourceStructures), 0, 0, W, H);
    ctx.restore();
  } else {
    drawBlueprintHouse(ctx, refLayers.house, px, py, 'rgba(58,63,74,0.85)', 'rgba(255,255,255,0.85)', 2.5);
    drawBlueprintDriveway(ctx, refLayers, px, py, pxPerM, false);
  }
  const featureOverlay = await buildExactLayerOverlay(state, frame, refLayers, 'all', W, H, 'features');
  if (featureOverlay) {
    ctx.save();
    ctx.globalAlpha = EXACT_CONTEXT_ALPHA.implementation;
    ctx.drawImage(await loadImage(featureOverlay), 0, 0, W, H);
    ctx.restore();
  }
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W, state, frame);

  // Phase pin positions: centroid of each phase's built objects, with distinct NW/SE fallback
  // anchors for the two bookend phases so set-out and commissioning never stack when neither a
  // driveway nor a house is traced.
  const centroidOfPts = (pts: Array<[number, number]>): [number, number] | null => {
    if (!pts.length) return null;
    const n = pts.length;
    return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n];
  };
  const itemById = new Map(state.items.map((it) => [it.id, it]));
  const lineById = new Map(state.lines.map((l) => [l.id, l]));
  const houseC = centroidOfPts(refLayers.house);
  const gateC: [number, number] | null = refLayers.driveway.length >= 1 ? refLayers.driveway[0] : null;
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
    return houseC ?? seAnchor;
  };

  // Pins are drawn BEFORE the panel (by the caller, afterward): one whose centroid falls under the
  // right-hand panel is hidden rather than floating over the legend — still fully described in the
  // panel by the same number and colour, so nothing is lost.
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
    ctx.font = `bold ${Math.round(pinR * 1.15)}px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(phase.n), cx, cy);
  }
}

// Composite the Phasing (08) AI result — Hybrid OR Full Treatment polish — back over exact content.
// The model NEVER sees the schedule text at any stage (buildPhasingHybridInput blanks it for the
// Hybrid input; the polish stage separately re-blanks the Hybrid's own output before sending it on,
// see generatePhasingViaQueue). This function is the one place that puts the real facts back: ground,
// structures, boundary and phase pins (drawPhasingExactContent) are redrawn on top of the model's
// art — not merely copied from a side region — and the schedule panel + scale bar + north arrow are
// drawn as exact vector/copied content, never left as whatever the model painted underneath.
//
// baseImage null → exact mode: returns buildImplementationMap directly (zero AI involvement).
// baseImage set → composites the model's decorative art with 100% exact facts on top, for either
// the Hybrid stage or the polish stage — same treatment both times, so a poorly-behaved polish pass
// cannot ship AI-authored geometry or schedule content under an honest 'hybrid'/'ai-polished' label.
async function composePhasingSheet(
  baseImage: string | null,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: DesignGlossyProps['site'],
  placeName?: string,
): Promise<string> {
  if (!baseImage) return buildImplementationMap(state, frame, refLayers, site, placeName);

  // The phase plan comes from the SAVED state — phases are a fact about the design, not about how
  // it is framed. Everything drawn below uses the boundary-framed presentation, matching the exact
  // sheet this composites over.
  const plan = buildPhasePlan(state, refLayers, site);
  const presentation = await boundaryPresentationContext(state, frame, refLayers);
  const renderState = presentation.state;
  const renderFrame = presentation.frame;
  const renderRefLayers = presentation.refLayers;
  const size = phasingSheetSize(frame, refLayers);
  const { mapW, mapH, W, H } = size;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const { pad, lgX } = phasingPanelRect(size);
  const pxPerM = mapW / (renderFrame.imgW * renderFrame.mPerPx);

  // 1. The model's decorative illustrated background, normalised to the complete sheet size.
  const modelImg = await loadImage(baseImage);
  ctx.drawImage(modelImg, 0, 0, W, H);

  // 2. Every exact fact — ground, structures, boundary, phase pins — redrawn on top from saved
  //    design data into the map column only, never copied from (or left as) the model's paint.
  await drawPhasingExactContent(ctx, renderState, renderFrame, renderRefLayers, plan, mapW, mapH);

  // 3. Scale bar and north arrow, drawn as exact vector chrome (not a photographic strip copied
  //    from a separately rendered sheet, which risked a hard seam and could clip the north arrow).
  const scaleRowH = Math.round(mapW * 0.026);
  drawBlueprintScaleBar(ctx, mapW, mapH, pad, scaleRowH, pxPerM);
  const naSize = Math.max(30, Math.round(mapW * 0.026));
  drawImplNorthArrow(ctx, lgX - pad - naSize * 0.6, H - pad - naSize * 0.6, naSize);

  // 4. The schedule panel itself — copied pixel-for-pixel from a freshly built exact sheet, so the
  //    text is guaranteed byte-identical to buildImplementationMap's own render rather than a second,
  //    independently laid-out copy that could drift from it under a future font/wrap change.
  const exactSheet = await buildImplementationMap(state, frame, refLayers, site, placeName);
  const exactImg = await loadImage(exactSheet);
  // The whole right-hand column, full height, is app-owned schedule content.
  ctx.drawImage(exactImg, lgX, 0, W - lgX, H, lgX, 0, W - lgX, H);

  return canvas.toDataURL('image/png');
}

// Build the input image sent to the model for the Phasing Hybrid stage — the complete exact sheet
// with the schedule panel ERASED (opaque blank rectangle, zero text) so the model structurally
// cannot see any date, task or hold point at any stage — not just told not to touch them.
async function buildPhasingHybridInput(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: DesignGlossyProps['site'],
  placeName?: string,
): Promise<string> {
  // The same size buildImplementationMap just drew at — otherwise the blank-out lands somewhere
  // the panel is not and the model is shown real dates.
  const size = phasingSheetSize(frame, refLayers);
  const exactSheet = await buildImplementationMap(state, frame, refLayers, site, placeName);
  return blankPhasingPanel(exactSheet, size);
}

// Erases the schedule panel region on an ARBITRARY already-rendered Phasing sheet with a fully
// OPAQUE fill (not a near-opaque one — an alpha short of 1.0 leaves the text underneath faintly
// recoverable with a contrast stretch, which defeats the entire point of blanking it). Used both
// for the Hybrid stage's input (starting from the exact sheet) and the Full Treatment polish
// stage's input (starting from the Hybrid stage's OWN finished output — see generatePhasingViaQueue
// — so the polish pass is never shown real schedule text either, matching the Hybrid stage's
// guarantee instead of relying on buildFinishedSheetPolishPrompt's prompt-only wording).
async function blankPhasingPanel(
  imageDataUrl: string,
  size: ReturnType<typeof calculatePhasingSheetSize>,
): Promise<string> {
  const { W, H } = size;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(await loadImage(imageDataUrl), 0, 0, W, H);

  const { lgW, lgX, lgY, lgBottom } = phasingPanelRect(size);
  ctx.fillStyle = '#FBF6EC'; // fully opaque — same cream as buildImplementationMap's panel fill
  ctx.fillRect(lgX, lgY, lgW, lgBottom - lgY);
  ctx.strokeStyle = 'rgba(32,25,15,0.34)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lgX, lgY);
  ctx.lineTo(lgX, lgBottom);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

// Build the protect mask for the Phasing Hybrid stage. Uploaded alongside the job but — like every
// other sheet's mask in this file — NOT sent to the OpenAI edit call itself (useProtectMaskForEdit
// is false; see lib/render-jobs.ts's own comment: "a deterministic restoration contract, not an
// OpenAI edit mask"). The actual, structural guarantee that schedule content never ships
// AI-authored is composePhasingSheet's full redraw of exact content on top afterward (both stages)
// plus this mask's real purpose: letting the worker/browser restoration pipeline (shared with every
// other geometry-locked sheet) recognise this as a protected region for its own bookkeeping. Do not
// read the opaque fill below as "the model literally cannot touch these pixels" — it can; the
// guarantee comes from never showing it real content (blankPhasingPanel) and never trusting its
// output for that region (composePhasingSheet's redraw).
function buildPhasingProtectMask(frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers']): string {
  const size = phasingSheetSize(frame, refLayers);
  const { W, H } = size;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.clearRect(0, 0, W, H);

  const { lgW, lgX, lgY, lgBottom } = phasingPanelRect(size);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(lgX, lgY, lgW, lgBottom - lgY);

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
  // FRAMED TO THE BOUNDARY, with a separate schedule column like sheets 01–07.
  //
  // v57 made the map follow the boundary but left the schedule sitting on top of it, so 08 still
  // had no column in its outer dimensions. That kept its print aspect unlike 01–07 and let a tall
  // map exceed the AI 3:1 limit even though the shared sheet calculation had already accounted for
  // a column. The map now stays intact on the left and the schedule owns the full right column.
  //
  // The phase plan is built from the SAVED state, before presentation: phases are a fact about the
  // design, not about how it is being framed, and buildPhasePlan is what the schedule text is
  // written from.
  const plan = buildPhasePlan(state, refLayers, site);
  const presentation = await boundaryPresentationContext(state, frame, refLayers);
  const renderState = presentation.state;
  const renderFrame = presentation.frame;
  const renderRefLayers = presentation.refLayers;
  const size = phasingSheetSize(frame, refLayers);
  const { mapW, mapH, W, H } = size;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const pxPerM = mapW / (renderFrame.imgW * renderFrame.mPerPx);
  const { pad, lgW, lgX, lgY, lgBottom } = phasingPanelRect(size);

  // 1. Satellite + scrim.
  await drawBlueprintBase(ctx, renderFrame, mapW, mapH);

  // 2-4. The complete saved design UNDER the phase pins — ground, structures, features, boundary,
  //    then the numbered phase pins. Shared with composePhasingSheet's AI composite-back via
  //    drawPhasingExactContent, so the exact sheet and the Hybrid/Full-Treatment sheets can never
  //    draw this content two different ways.
  await drawPhasingExactContent(ctx, renderState, renderFrame, renderRefLayers, plan, mapW, mapH);

  // 5. The title moves into the shared right-hand sheet panel below. Keeping a second giant title
  // over the map made sheet 08 the odd one out and consumed the clear northwest map space.

  // 6. Scale bar + north arrow. Scale bottom-left as on every sheet; north on a disc just left of
  //    the panel's foot (this sheet adds a north arrow the other Blueprints still lack).
  const scaleRowH = Math.round(mapW * 0.026);
  drawBlueprintScaleBar(ctx, mapW, mapH, pad, scaleRowH, pxPerM);

  // 7. Right-hand panel — the phasing schedule. Type follows the panel width, not the changing map
  //    or widened sheet width. When content would overflow we shed task bullets and surplus site
  //    rules — never shrink the type — exactly as the spec requires ("fewer task bullets over
  //    unreadable text"). A hard clip at the panel foot guarantees nothing ever spills.
  const ip = Math.round(lgW * 0.055);
  const innerX = lgX + ip;
  const innerW = lgW - ip * 2;
  const panelBottom = lgBottom - ip;

  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(lgX, lgY, lgW, lgBottom - lgY);
  ctx.strokeStyle = 'rgba(32,25,15,0.34)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lgX, lgY);
  ctx.lineTo(lgX, lgBottom);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(lgX, lgY, lgW, lgBottom - lgY);
  ctx.clip();

  const fsHeader = Math.round(lgW * 0.051);
  const fsSection = Math.round(lgW * 0.035);
  const fsBody = Math.round(lgW * 0.029);
  const lineH = Math.round(fsBody * 1.34);
  const blockGap = Math.round(lineH * 0.55);
  const headerFont = `800 ${fsHeader}px ${SHEET_TITLE_FONT}`;
  const sectionFont = `800 ${fsSection}px ${SHEET_BODY_FONT}`;
  const titleFont = `800 ${Math.round(lgW * 0.034)}px ${SHEET_BODY_FONT}`;
  const bodyFont = `500 ${fsBody}px ${SHEET_BODY_FONT}`;
  const weekFont = `600 ${fsBody}px ${SHEET_BODY_FONT}`;
  const holdFont = `italic 600 ${fsBody}px ${SHEET_BODY_FONT}`;

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
  const panelTitleLines = wrap('08 — IMPLEMENTATION MAP & PHASING', innerW, headerFont);

  // ── Measurement (so we can size the phase area and pick the bullet cap) ──────────────────────
  const phaseBlockH = (phase: (typeof plan.phases)[number], bulletCap: number): number => {
    const titleLines = wrap(`${phase.title}`, titleW, titleFont).length;
    let h = Math.max(chipS, titleLines * lineH); // title row (chip beside wrapped title)
    h += lineH; // week range
    for (const t of phase.tasks.slice(0, bulletCap)) h += wrap(t, bulletTextW, bodyFont).length * lineH;
    h += wrap(phase.holdPoint, bulletTextW, holdFont).length * lineH; // hold point
    return h + blockGap;
  };
  const headerH = panelTitleLines.length * Math.round(fsHeader * 1.08) + lineH * 2 + Math.round(lineH * 0.8);
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
  let y = lgY + ip + fsHeader;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#20190F';
  ctx.font = headerFont;
  for (const line of panelTitleLines) {
    ctx.fillText(line, innerX, y);
    y += Math.round(fsHeader * 1.08);
  }
  ctx.fillStyle = '#6B6355';
  ctx.font = `italic 500 ${fsBody}px ${SHEET_BODY_FONT}`;
  ctx.fillText('Reference Blueprint', innerX, y);
  y += lineH;
  ctx.fillStyle = '#8A8172';
  ctx.font = `500 ${fsBody}px ${SHEET_BODY_FONT}`;
  ctx.fillText(placeName ?? 'Your design', innerX, y);
  y += Math.round(lineH * 0.45);
  ctx.strokeStyle = 'rgba(32,25,15,0.24)';
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
    ctx.font = `bold ${Math.round(chipS * 0.62)}px ${SHEET_BODY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(phase.n), innerX + chipS / 2, chipTop + chipS / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = titleFont;
    ctx.fillStyle = '#241E12';
    let ty = y;
    for (const ln of titleLines) { if (ty <= panelBottom) ctx.fillText(ln, titleX, ty); ty += lineH; }
    // Advance below BOTH the chip and the (possibly multi-line) title. A baseline is not a text
    // edge: the old 0.35 × line-height nudge left the week range's cap-height inside the chip by
    // about 4px on the demo sheet. Clear the chip by the next font's measured ascent so this remains
    // true when the schedule column changes width or the browser resolves a different fallback face.
    const lastTitleBaseline = y + (titleLines.length - 1) * lineH;
    ctx.font = weekFont;
    const weekAscent = Math.ceil(ctx.measureText(phase.weekRange).actualBoundingBoxAscent || fsBody * 0.75);
    const weekTopGap = Math.max(1, Math.round(fsBody * 0.15));
    y = Math.max(
      lastTitleBaseline + lineH,
      chipTop + chipS + weekAscent + weekTopGap,
    );
    // Week range.
    drawLines([phase.weekRange], innerX, weekFont, '#6B6355');
    // Task bullets (capped).
    for (const t of phase.tasks.slice(0, bulletCap)) {
      if (y > panelBottom) break;
      const tl = wrap(t, bulletTextW, bodyFont);
      ctx.fillStyle = '#3E7C42';
      ctx.font = bodyFont;
      ctx.fillText('•', bulletDotX, y);
      drawLines(tl, bulletTextX, bodyFont, '#3E3A31');
    }
    // Hold point — the gate — in warm gold so it reads as a stop, not a bullet.
    const hl = wrap(phase.holdPoint, bulletTextW, holdFont);
    drawLines(hl, bulletTextX, holdFont, '#A56818');
    y += blockGap;
  }

  // CRITICAL ORDER — the Scale-of-Permanence sequence made concrete for this design.
  if (plan.criticalOrder.length && y < panelBottom) {
    ctx.font = sectionFont;
    ctx.fillStyle = '#7A4A12';
    ctx.fillText('CRITICAL ORDER', innerX, y);
    y += Math.round(fsSection * 1.3);
    drawLines(coLines, innerX, bodyFont, '#3E3A31');
    y += blockGap;
  }

  // SITE RULES — hard constraints derived from what is actually on the plan.
  if (plan.siteRules.length && y < panelBottom) {
    ctx.font = sectionFont;
    ctx.fillStyle = '#8A3434';
    ctx.fillText('SITE RULES', innerX, y);
    y += Math.round(fsSection * 1.3);
    for (const r of plan.siteRules.slice(0, maxRules)) {
      if (y > panelBottom) break;
      ctx.fillStyle = '#8A3434';
      ctx.font = bodyFont;
      ctx.fillText('!', bulletDotX, y);
      drawLines(wrap(r, bulletTextW, bodyFont), bulletTextX, bodyFont, '#3E3A31');
    }
  }
  ctx.restore();

  // North arrow, on its disc just left of the panel foot.
  const naSize = Math.max(30, Math.round(mapW * 0.026));
  drawImplNorthArrow(ctx, lgX - pad - naSize * 0.6, H - pad - naSize * 0.6, naSize);

  return canvas.toDataURL('image/png');
}

// Legend rows for a Style sheet — the real design content on this layer (zones, grouped
// elements, line kinds, driveway). Deterministic: read straight from state.
interface StyleLegendRow {
  swatch: string;
  text: string;
  defId?: string;
  lineKind?: string;
  kind?: 'zone' | 'ground' | 'surface';
  section?: WaterLegendSection | PlantingLegendSection | StructuresLegendSection
    | 'SITE EDGE' | 'WATER' | 'PLANTING' | 'INFRASTRUCTURE';
  sectorIcon?: SectorLegendIcon;
}

export function sheetLegendRows(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
  _includeToolGlyphs = false,
): StyleLegendRow[] {
  const rows: StyleLegendRow[] = [];
  if (filter === 'zones') {
    // One row per zone NUMBER, not per polygon — a site with three Zone-3 patches listed
    // "Zone 3 — Orchard / food forest" three times.
    const seen = new Set<number>();
    for (const z of [...state.zones].sort((a, b) => a.zone - b.zone)) {
      if (z.feature || z.points.length < 3 || seen.has(z.zone)) continue;
      seen.add(z.zone);
      rows.push({ swatch: ZONE_DEFS[z.zone].color, text: `Zone ${z.zone} — ${ZONE_DEFS[z.zone].label}`, kind: 'zone' });
    }
  }
  // Ground fabric, register-aware. drawBlueprintGround paints traced house/patio/driveway/lawn/
  // veg_garden/orchard/cleared on every sheet now (RC2/RC6), but a legend must not claim OWNERSHIP
  // of ground a sheet only shows for orientation. groundRows(state, refLayers, filter) already
  // returns only the rings groundRegister calls this filter's CONTENT (all/planting/structures) —
  // list those by name, same as the Blueprint builders do. On a CONTEXT sheet (water/zones) that
  // call always returns [] by construction, so we fall back to a single compressed row — present
  // only when ground is actually drawn (checked via filter 'all', under which every non-boundary
  // kind resolves to content) — so the reader gets a key for what they see without this sheet
  // pretending the orchard is its subject. This was the audit's "water Blueprint paints ground its
  // own legend can't explain" gap (RENDER-INVESTIGATION finding 9) — every composeStyleSheet-based
  // sheet (buildBlueprintWaterMap plus every AI-styled render) shared it.
  const contentGround = groundRows(state, refLayers, filter);
  if (contentGround.length) {
    for (const g of contentGround) rows.push({ swatch: g.color, text: g.label, kind: 'ground' });
  } else if (groundRows(state, refLayers, 'all').length) {
    rows.push({ swatch: '#8A8172', text: 'Existing site fabric (traced)', kind: 'ground' });
  }

  if (filter === 'all') {
    const siteRows: StyleLegendRow[] = rows.splice(0).map((row) => ({ ...row, section: 'SITE EDGE' }));
    if (refLayers.boundary.length >= 3) {
      siteRows.push({ swatch: BOUNDARY_BONE, text: 'Property boundary', lineKind: 'fence', section: 'SITE EDGE' });
    }
    if (refLayers.driveway.length >= 2) {
      siteRows.push({ swatch: '#5A5D57', text: 'Existing tarred driveway', kind: 'surface', section: 'SITE EDGE' });
    }
    const accessLines = state.lines.filter((line) => ['path', 'fence', 'windbreak'].includes(line.kind));
    if (accessLines.length) {
      siteRows.push({
        swatch: '#8A6D3B',
        text: `Paths, fences & windbreaks ×${accessLines.length}`,
        lineKind: 'path',
        section: 'SITE EDGE',
      });
    }

    const contentRows: StyleLegendRow[] = [];
    for (const group of exactSheetElementLegendGroups(state, filter)) {
      const summary = INTEGRATED_LEGEND_FAMILIES.find((family) => family.text === group.text);
      if (!summary) continue;
      contentRows.push({
        swatch: summary.swatch,
        defId: group.defId,
        text: `${summary.text} ×${group.count}`,
        section: summary.section,
      });
    }
    const waterRows: StyleLegendRow[] = waterRouteLegendEntries(state.lines).map((route) => ({
      swatch: route.color,
      text: countedLegendText(route.label, route.count),
      lineKind: route.kind,
      section: 'WATER',
    }));
    const orderedContent = [
      ...contentRows.filter((row) => row.section === 'WATER'),
      ...waterRows,
      ...contentRows.filter((row) => row.section === 'PLANTING'),
      ...contentRows.filter((row) => row.section === 'INFRASTRUCTURE'),
    ];
    return [...siteRows, ...orderedContent];
  }

  const groups = exactSheetElementLegendGroups(state, filter).map((group) => {
    return {
      name: group.text,
      defId: group.defId,
      color: speciesColor(group.defId),
      n: group.count,
      section: filter === 'water'
        ? waterLegendSectionForFeature(group.defId)
        : filter === 'planting'
          ? plantingLegendSectionForFeature(group.defId) ?? undefined
          : filter === 'structures'
            ? structuresLegendSectionForFeature(group.defId) ?? undefined
          : undefined,
    };
  });
  const orderedGroups = groups.sort((left, right) => {
    const sectionOrder: readonly string[] = filter === 'water' ? WATER_LEGEND_SECTION_ORDER
      : filter === 'planting' ? PLANTING_LEGEND_SECTION_ORDER
        : filter === 'structures' ? STRUCTURES_LEGEND_SECTION_ORDER : [];
    const leftOrder = left.section ? sectionOrder.indexOf(left.section) : Number.MAX_SAFE_INTEGER;
    const rightOrder = right.section ? sectionOrder.indexOf(right.section) : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.name.localeCompare(right.name);
  });
  for (const group of orderedGroups) {
    rows.push({
      swatch: group.color,
      defId: group.defId,
      text: countedLegendText(group.name, group.n),
      section: group.section,
    });
  }
  const kindCounts = new Map<LineShape['kind'], number>();
  for (const l of state.lines) {
    if (!lineInFilter(l.kind, filter)) continue;
    kindCounts.set(l.kind, (kindCounts.get(l.kind) ?? 0) + 1);
  }
  for (const [kind, count] of kindCounts) {
    const waterStyle = filter === 'water' ? waterRouteStyleFor(kind) : undefined;
    const plantingStyle = filter === 'planting' ? plantingRouteStyleFor(kind) : undefined;
    rows.push({
      swatch: waterStyle?.color ?? plantingStyle?.color ?? LINE_COLORS[kind] ?? '#8C8577',
      text: countedLegendText(waterStyle?.label ?? plantingStyle?.label ?? kind.charAt(0).toUpperCase() + kind.slice(1), count),
      lineKind: kind,
      section: waterStyle
        ? waterLegendSectionForRoute(kind as Parameters<typeof waterLegendSectionForRoute>[0])
        : plantingStyle ? 'PRODUCTION PLANTING' : undefined,
    });
  }
  if (filter === 'water' || filter === 'planting' || filter === 'structures') {
    const contextRows = rows.filter((row) => !row.section);
    const sectionOrder: readonly string[] = filter === 'water' ? WATER_LEGEND_SECTION_ORDER
      : filter === 'planting' ? PLANTING_LEGEND_SECTION_ORDER
        : STRUCTURES_LEGEND_SECTION_ORDER;
    const systemRows = rows.filter((row) => row.section).sort((left, right) => {
      const leftOrder = sectionOrder.indexOf(left.section!);
      const rightOrder = sectionOrder.indexOf(right.section!);
      return leftOrder - rightOrder;
    });
    rows.splice(0, rows.length, ...contextRows, ...systemRows);
  }
  // Water treats the driveway as quiet site context; the compressed "Existing site fabric" row
  // already explains it, so repeating it after the water systems makes the infrastructure look
  // like a Water-plan feature. Other sheets retain the explicit row where built fabric is content.
  if (filter !== 'water' && filter !== 'planting' && filter !== 'structures' && refLayers.driveway.length >= 2) rows.push({ swatch: TAR, text: 'Tarred driveway', kind: 'surface' });
  return rows;
}

function drawStyleLegendSymbol(
  ctx: CanvasRenderingContext2D,
  row: StyleLegendRow,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (row.sectorIcon) {
    const cx = x + w / 2;
    const r = Math.max(5, Math.min(w, h) * 0.24);
    ctx.save();
    ctx.strokeStyle = row.swatch;
    ctx.fillStyle = row.swatch;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, h * 0.075);
    if (row.sectorIcon === 'sun') {
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
        ctx.lineTo(cx + Math.cos(a) * r * 2.05, y + Math.sin(a) * r * 2.05);
        ctx.stroke();
      }
    } else if (row.sectorIcon === 'wind') {
      for (const off of [-r * 0.75, 0, r * 0.75]) {
        ctx.beginPath();
        ctx.moveTo(x, y + off);
        ctx.bezierCurveTo(x + w * 0.25, y + off - r * 0.8, x + w * 0.45, y + off + r * 0.8, x + w * 0.68, y + off);
        ctx.bezierCurveTo(x + w * 0.82, y + off - r * 0.55, x + w * 0.92, y + off - r * 0.2, x + w, y + off);
        ctx.stroke();
      }
    } else if (row.sectorIcon === 'fire') {
      ctx.beginPath();
      ctx.moveTo(cx, y - r * 2.1);
      ctx.bezierCurveTo(cx + r * 1.8, y - r * 0.7, cx + r * 1.35, y + r * 1.7, cx, y + r * 2);
      ctx.bezierCurveTo(cx - r * 1.5, y + r * 1.5, cx - r * 1.65, y - r * 0.25, cx - r * 0.4, y - r * 1.1);
      ctx.bezierCurveTo(cx - r * 0.3, y - r * 0.4, cx + r * 0.2, y - r * 0.35, cx, y - r * 2.1);
      ctx.fill();
    } else if (row.sectorIcon === 'driveway') {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.42);
      ctx.lineTo(x + w * 0.62, y - r * 0.42);
      ctx.lineTo(x + w * 0.62, y - r * 1.15);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w * 0.62, y + r * 1.15);
      ctx.lineTo(x + w * 0.62, y + r * 0.42);
      ctx.lineTo(x, y + r * 0.42);
      ctx.closePath();
      ctx.fill();
    } else if (row.sectorIcon === 'water') {
      for (const off of [-r * 0.6, r * 0.35]) {
        ctx.beginPath();
        ctx.moveTo(x, y + off);
        ctx.bezierCurveTo(x + w * 0.25, y + off - r, x + w * 0.55, y + off + r, x + w * 0.82, y + off);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x + w * 0.78, y - r * 0.5);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w * 0.78, y + r * 0.5);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(cx, y - r * 1.8); ctx.lineTo(cx, y + r * 1.8);
      ctx.moveTo(cx - r * 1.55, y - r * 0.9); ctx.lineTo(cx + r * 1.55, y + r * 0.9);
      ctx.moveTo(cx + r * 1.55, y - r * 0.9); ctx.lineTo(cx - r * 1.55, y + r * 0.9);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (row.defId) {
    const def = ELEMENTS_BY_ID[row.defId];
    if (def) {
      const aspect = Math.max(0.35, Math.min(2.8, def.wM / Math.max(0.01, def.hM)));
      const targetW = aspect >= 1 ? w : Math.max(w * 0.42, w * aspect);
      const targetH = aspect >= 1 ? Math.max(h * 0.42, h / aspect) : h;
      const item: PlacedItem = {
        id: `legend-${def.id}`,
        defId: def.id,
        x: (x + w / 2) / ctx.canvas.width,
        y: y / ctx.canvas.height,
        wM: targetW,
        hM: targetH,
      };
      drawTrueFootprint(
        ctx,
        item,
        def,
        (n) => n * ctx.canvas.width,
        (n) => n * ctx.canvas.height,
        1,
        false,
      );
      return;
    }
  }

  if (row.lineKind) {
    const cy = y;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(32,25,15,0.22)';
    ctx.lineWidth = Math.max(4, h * 0.18);
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
    ctx.strokeStyle = row.swatch;
    ctx.lineWidth = Math.max(2, h * 0.09);
    ctx.setLineDash(row.lineKind === 'path' ? [7, 5] : []);
    ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + w, cy); ctx.stroke();
    ctx.setLineDash([]);
    if (row.lineKind === 'drip') {
      for (let px = x + w * 0.08; px < x + w; px += Math.max(7, w / 5)) {
        ctx.beginPath();
        ctx.arc(px, cy, Math.max(1.3, h * 0.075), 0, Math.PI * 2);
        ctx.fillStyle = '#BCE8FF';
        ctx.fill();
        ctx.strokeStyle = '#15577D';
        ctx.lineWidth = Math.max(0.7, h * 0.035);
        ctx.stroke();
      }
    }
    if (row.lineKind === 'fence') {
      for (let px = x; px <= x + w; px += Math.max(8, w / 4)) {
        ctx.beginPath(); ctx.arc(px, cy, Math.max(1.5, h * 0.09), 0, Math.PI * 2);
        ctx.fillStyle = row.swatch; ctx.fill();
      }
    }
    ctx.restore();
    return;
  }

  ctx.save();
  roundRectPath(ctx, x, y - h * 0.34, w, h * 0.68, Math.max(2, h * 0.08));
  ctx.fillStyle = row.swatch;
  ctx.globalAlpha = row.kind === 'zone' ? 0.72 : 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(32,25,15,0.38)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (row.kind === 'zone' || row.kind === 'ground') {
    ctx.save();
    roundRectPath(ctx, x, y - h * 0.34, w, h * 0.68, Math.max(2, h * 0.08));
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    for (let d = -h; d < w + h; d += Math.max(5, h * 0.28)) {
      ctx.beginPath(); ctx.moveTo(x + d, y - h / 2); ctx.lineTo(x + d - h, y + h / 2); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
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
  includeToolGlyphs = true,
  exactGeometry = false,
  options: { sheetNumber?: string; legendRows?: StyleLegendRow[]; footerHeading?: string; footerText?: string } = {},
): Promise<string> {
  const map = await loadImage(mapDataUrl);
  const W = map.width;
  const H = map.height;
  const legendW = styleSheetLegendWidth(W);
  const outW = W + legendW;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return mapDataUrl;
  ctx.drawImage(map, 0, 0);

  // ── Legend panel ──
  const benchmarkPanel = styleLabel === 'Reference Blueprint' && (filter === 'water' || filter === 'planting' || filter === 'structures');
  const panelInset = benchmarkPanel ? Math.max(12, Math.round(legendW * 0.035)) : 0;
  ctx.fillStyle = benchmarkPanel ? '#0B2116' : '#FBF6EC';
  ctx.fillRect(W, 0, legendW, H);
  if (benchmarkPanel) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = Math.round(legendW * 0.035);
    ctx.shadowOffsetY = Math.round(legendW * 0.012);
    roundRectPath(
      ctx,
      W + panelInset,
      panelInset,
      legendW - panelInset * 2,
      H - panelInset * 2,
      Math.round(legendW * 0.055),
    );
    ctx.fillStyle = '#F7F2E7';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(67,61,48,0.36)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  const pad = Math.round(legendW * 0.075);
  const lx = W + panelInset + pad;
  const maxX = outW - panelInset - pad;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  let y = panelInset + pad + Math.round(legendW * 0.07);
  ctx.fillStyle = '#20190F';
  const titleSize = Math.round(legendW * 0.067);
  ctx.font = `800 ${titleSize}px ${REFERENCE_LABEL_FONT}`;
  const titleWords = `${options.sheetNumber ?? SHEET_NO[filter]} — ${layerLabel.toUpperCase()}`.split(/\s+/);
  const titleLines: string[] = [];
  let titleLine = '';
  for (const word of titleWords) {
    const next = titleLine ? `${titleLine} ${word}` : word;
    if (titleLine && ctx.measureText(next).width > maxX - lx && titleLines.length < 2) {
      titleLines.push(titleLine);
      titleLine = word;
    } else {
      titleLine = next;
    }
  }
  if (titleLine) titleLines.push(titleLine);
  for (const line of titleLines.slice(0, 3)) {
    ctx.fillText(line, lx, y);
    y += Math.round(titleSize * 1.08);
  }
  y += Math.round(legendW * 0.006);
  ctx.fillStyle = '#6B6355';
  ctx.font = `700 ${Math.round(legendW * 0.045)}px ${SHEET_BODY_FONT}`;
  const styleWords = styleLabel.split(/\s+/);
  const styleLines: string[] = [];
  let styleLine = '';
  for (const word of styleWords) {
    const next = styleLine ? `${styleLine} ${word}` : word;
    if (styleLine && ctx.measureText(next).width > maxX - lx && styleLines.length < 2) {
      styleLines.push(styleLine);
      styleLine = word;
    } else {
      styleLine = next;
    }
  }
  if (styleLine) styleLines.push(styleLine);
  const styleLineH = Math.round(legendW * 0.05);
  for (const line of styleLines.slice(0, 3)) {
    ctx.fillText(line, lx, y);
    y += styleLineH;
  }
  ctx.fillStyle = '#8A8172';
  ctx.font = `600 ${Math.round(legendW * 0.04)}px ${SHEET_BODY_FONT}`;
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
  ctx.font = `800 ${Math.round(legendW * 0.05)}px ${REFERENCE_LABEL_FONT}`;
  ctx.fillText('LEGEND', lx, y);

  const rows = options.legendRows ?? sheetLegendRows(state, refLayers, filter, includeToolGlyphs);
  const legendTop = y + Math.round(legendW * 0.03);
  const sw = Math.round(legendW * 0.064);
  const tx = lx + sw + Math.round(legendW * 0.03);
  const textW = maxX - tx;
  const wrapLegendText = (value: string, fontSize: number): string[] => {
    ctx.font = `600 ${fontSize}px ${SHEET_BODY_FONT}`;
    const lines: string[] = [];
    let current = '';
    for (const word of value.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > textW) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [value];
  };
  const footerFs = options.footerText ? Math.max(9, Math.round(legendW * 0.025)) : Math.round(legendW * 0.036);
  const footerLineH = Math.max(11, Math.round(footerFs * 1.28));
  const footerTextW = maxX - lx;
  const wrapFooterText = (value: string): string[] => {
    ctx.font = options.footerHeading
      ? `600 ${footerFs}px ${SHEET_BODY_FONT}`
      : `italic 500 ${footerFs}px ${SHEET_BODY_FONT}`;
    const lines: string[] = [];
    let current = '';
    for (const word of value.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > footerTextW) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const customFooterLines = options.footerText ? wrapFooterText(options.footerText) : [];
  const footerHeadingH = options.footerHeading ? Math.round(legendW * 0.06) : 0;
  const footerBlockH = customFooterLines.length
    ? customFooterLines.length * footerLineH + footerHeadingH + Math.round(legendW * 0.035)
    : Math.round(legendW * 0.16);
  const panelBottom = H - panelInset;
  const footerTop = panelBottom - pad - footerBlockH;
  const availableRowsH = Math.max(1, footerTop - legendTop);
  const layoutRows = (fontSize: number) => {
    const lineH = Math.max(11, Math.round(fontSize * 1.22));
    const sectionFs = Math.max(9, Math.round(fontSize * 0.82));
    let previousSection: string | undefined;
    return rows.map((row) => {
      const lines = wrapLegendText(row.text, fontSize);
      const contentHeight = Math.max(sw, lines.length * lineH) + Math.max(2, Math.round(fontSize * 0.22));
      const startsSection = Boolean(row.section && row.section !== previousSection);
      const headingHeight = startsSection ? Math.round(sectionFs * 1.7) : 0;
      previousSection = row.section;
      return { row, lines, contentHeight, headingHeight, height: contentHeight + headingHeight };
    });
  };
  let fs = Math.max(14, Math.round(legendW * 0.036));
  let rowLayout = layoutRows(fs);
  while (rowLayout.reduce((sum, row) => sum + row.height, 0) > availableRowsH && fs > 9) {
    fs -= 1;
    rowLayout = layoutRows(fs);
  }
  const usedRowsH = rowLayout.reduce((sum, row) => sum + row.height, 0);
  const rowGap = legendRowGap(availableRowsH, usedRowsH, rowLayout.length);
  const lineH = Math.max(11, Math.round(fs * 1.22));
  const sectionFs = Math.max(9, Math.round(fs * 0.82));
  y = legendTop;
  for (const { row, lines, contentHeight, headingHeight } of rowLayout) {
    if (headingHeight && row.section) {
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#1F4D2B';
      ctx.font = `800 ${sectionFs}px ${REFERENCE_LABEL_FONT}`;
      ctx.fillText(row.section, lx, y + sectionFs);
      y += headingHeight;
    }
    const symbolY = y + contentHeight / 2;
    drawStyleLegendSymbol(ctx, row, lx, symbolY, sw, Math.min(sw, contentHeight * 0.82));
    ctx.fillStyle = '#241E12';
    ctx.font = `600 ${fs}px ${SHEET_BODY_FONT}`;
    ctx.textBaseline = 'middle';
    const textTop = symbolY - ((lines.length - 1) * lineH) / 2;
    lines.forEach((line, index) => ctx.fillText(line, tx, textTop + index * lineH));
    y += contentHeight + rowGap;
  }
  if (!rows.length) {
    ctx.fillStyle = '#6B6355';
    ctx.font = `italic 500 ${fs}px ${SHEET_BODY_FONT}`;
    ctx.fillText('Nothing placed on this layer.', lx, y);
  }
  // Footer contract. Exact sheets state their provenance plainly; AI texture sheets retain the
  // illustrative caveat while confirming that geometry and placed elements are deterministic.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8A8172';
  if (customFooterLines.length) {
    let footerY = footerTop + Math.round(legendW * 0.035);
    if (options.footerHeading) {
      ctx.strokeStyle = 'rgba(11,18,11,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, footerTop);
      ctx.lineTo(maxX, footerTop);
      ctx.stroke();
      ctx.fillStyle = '#1F4D2B';
      ctx.font = `800 ${Math.round(legendW * 0.034)}px ${REFERENCE_LABEL_FONT}`;
      ctx.fillText(options.footerHeading, lx, footerY);
      footerY += footerHeadingH;
      ctx.fillStyle = '#6C6457';
      ctx.font = `600 ${footerFs}px ${SHEET_BODY_FONT}`;
    } else {
      ctx.font = `italic 500 ${footerFs}px ${SHEET_BODY_FONT}`;
    }
    for (const line of customFooterLines) {
      ctx.fillText(line, lx, footerY);
      footerY += footerLineH;
    }
  } else if (exactGeometry) {
    ctx.font = `italic 600 ${Math.round(legendW * 0.036)}px ${SHEET_BODY_FONT}`;
    ctx.fillText('Exact plan — geometry and counts', lx, H - pad - Math.round(legendW * 0.05));
    ctx.fillText('come from your saved design.', lx, H - pad - Math.round(legendW * 0.005));
    ctx.fillText('No unsaved features added.', lx, H - pad + Math.round(legendW * 0.04));
  } else {
    ctx.font = `italic 600 ${Math.round(legendW * 0.036)}px ${SHEET_BODY_FONT}`;
    ctx.fillText('Illustrated render — boundary, labels', lx, H - pad - Math.round(legendW * 0.05));
    ctx.fillText('and elements are exact; artwork is', lx, H - pad - Math.round(legendW * 0.005));
    ctx.fillText('indicative. Confirm on site.', lx, H - pad + Math.round(legendW * 0.04));
  }

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
  ctx.font = `700 ${Math.round(W * 0.016)}px ${REFERENCE_LABEL_FONT}`;
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
  ctx.font = `700 ${Math.round(W * 0.017)}px ${REFERENCE_LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(11,14,10,0.65)';
  ctx.strokeText('N', nx, ny - 34);
  ctx.fillStyle = '#FBF6EC';
  ctx.fillText('N', nx, ny - 34);

  return canvas.toDataURL('image/png');
}

/**
 * Full Treatment receives a complete Hybrid sheet, while buildProtectMask works in map
 * coordinates. Hybrid keeps deterministic chrome exact; Full Treatment deliberately leaves the
 * chrome editable so the second paid pass can produce the richer typography, pictorial legend and
 * notes layout that distinguish it from Hybrid.
 */
async function extendProtectMaskToStyleSheet(
  mapMaskDataUrl: string,
  mapWidth: number,
  mapHeight: number,
  protectChrome = true,
): Promise<string> {
  const mask = await loadImage(mapMaskDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = mapWidth + styleSheetLegendWidth(mapWidth);
  canvas.height = mapHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return mapMaskDataUrl;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (protectChrome) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(mapWidth, 0, canvas.width - mapWidth, mapHeight);
  }
  ctx.drawImage(mask, 0, 0, mapWidth, mapHeight);
  return canvas.toDataURL('image/png');
}

/** Extract the map panel from a deterministic sheet before an AI background-only polish pass. */
async function cropStyleSheetToMap(
  sheetDataUrl: string,
  mapWidth: number,
  mapHeight: number,
): Promise<string> {
  const sheet = await loadImage(sheetDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = mapWidth;
  canvas.height = mapHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sheetDataUrl;
  // GPT Image can return either the same sheet proportions or a normalised output size. Derive the
  // map panel from the returned image's height rather than assuming its pixels equal our canvas.
  // When the model returned map-only imagery this naturally selects the full image.
  const sourceMapWidth = Math.min(sheet.width, sheet.height * (mapWidth / mapHeight));
  ctx.drawImage(sheet, 0, 0, sourceMapWidth, sheet.height, 0, 0, mapWidth, mapHeight);
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
// PLAN VERSION — bump whenever a change alters sheet content or its deterministic finishing layer.
// The cache keys on siteId + style + layer with no content hash, so without this the fix you just
// shipped is invisible: the same key hands back the pre-change picture and the farmer concludes
// nothing happened. (It has already happened once this session — a Zones sheet that still had no
// zones on it, because the broken render was cached.) One line, and it must move in the same commit
// as the change that needs it.
//   v2 — 2026-07-21: prompt stopped naming irrigation routes on Planting/Structures, rule 7 stopped
//        asserting ground and served items absent, icon rule no longer renders empty.
//   v14 — 2026-07-21: Sector Analysis (sheet 02) Part B — real two-arc sun geometry, regional named
//        wind sectors (summer-cooling/cold-front/berg), fire re-derived from berg not winter wind,
//        numbered "SECTOR LEGEND" with icons + regional-assumption footer. A cached sheet 02 from
//        before this change is the old 6-row legend with the old wrong content — must not be served.
//   v19 — 2026-07-21: Reference Blueprint makes the app authoritative for geometry/chrome on all
//        five design sheets, restores every exact layer, groups canonical labels, and removes emoji.
//   v20 — 2026-07-22: integrated banana circles, tree basins and vetiver banks are factual content
//        on both Water and Planting, while retaining one primary editor owner and no duplicate marks.
//   v21 — 2026-07-22: benchmark-style direct labels, lime fence crossbars and naturalistic canopy
//        symbols replace dashboard pills, dotted boundaries and glossy discs.
//   v22 — 2026-07-22: queued Reference Blueprint renders use the same direct label treatment.
//   v23 — 2026-07-22: illustrated water/structure symbols are shared by map and legend; Site and
//        Sector gain the benchmark panel; Whole is curated; Phasing carries the complete design.
//   v24 — 2026-07-22: benchmark QA pass quiets access, enlarges small point symbols, removes label
//        ladders, declutters Sector and fits Phasing into the shared cream editorial panel.
//   v25 — 2026-07-22: numbered Sector map markers now match the numbered external legend exactly.
//   v26 — 2026-07-22: Sector numbers de-conflict and keep short leaders to shared bearings.
//   v27 — 2026-07-22: realistic vetiver and tree texture plus dedicated catalogue symbols.
//   v28 — 2026-07-22: Vetiver Bank is curated to Planting and Whole, not Water.
//   v29 — 2026-07-22: Water routes use real pipe, emitter and greywater visual grammar.
//   v30 — 2026-07-22: AI marker vocabulary is derived only from saved sheet content.
// v32: Water symbols and routes gain print-scale emphasis over detailed illustrated ground.
// v34: Water technical ink is strengthened for phone-size reading; geometry is unchanged.
// v35: Water AI terrain gains the benchmark tonal brief; exact ground washes and access recede.
// v36: Water gains benchmark focus grading, close callouts and an inset editorial legend panel.
// v37: Water symbols and route ink gain the restrained finish used by the benchmark sheet.
// v38: Water, Planting and Structures gain reusable AI-painted feature art clipped to exact saved
//      footprints; blue drip emitters and grouped editorial legends remain deterministic.
// v39: ponds, tree/greywater basins, taps, pumps and greywater diverters join the painted Water set.
// v40: banana, pawpaw, moringa, keyhole, herb-spiral and spekboom receive literal Planting art.
// v42: Sector gains benchmark-strength aerial grading, marks, labels and legend symbols.
// v43: Sector wind/fire/access sectors gain phone-readable benchmark stroke/fill emphasis.
// v44: Painted Water assets use bounded print emphasis and all active routes share blue/purple ink.
// v45: Whole uses one factual feature stack and a grouped legend with distinct Water route keys.
// v48: Sector sheet drops base-fabric context labels so the analysis reads like the benchmark.
// v49: Water routes use solid blue/purple technical ink with sparse emitters and no pale symbol halos.
// v50: Sector uses a quieter aerial base, broad sourced energies, visible driving rain and three
//      larger terrain-fall arrows; bearings and evidence gates remain unchanged.
// v51: reusable feature art loses its pale sticker halo and map callouts remain readable on phones.
// v53: paid Sector polish sends the complete exact sheet to GPT Image instead of repainting only
//      the ground and rebuilding the same hybrid page over it.
//   v57 — 2026-07-28: every sheet now takes the shape of the traced boundary instead of a fixed
//        3:2 frame (sheets 01-07 via calculateBoundaryPresentationLayout, sheet 08 routed through
//        the same presentation), and the Phasing schedule panel uses styleSheetLegendWidth like
//        every other panel rather than a private flat 34%. Without this bump none of it is
//        visible to anyone who has already rendered a sheet — the cached picture comes back.
//   v58 — 2026-07-28: Phasing owns a separate schedule column instead of covering its map, so its
//        outer aspect matches 01-07 and remains within the AI 3:1 limit on tall farms.
//   v59 — 2026-07-28: map callout type follows the boundary-derived map width instead of staying
//        fixed at 19px across radically different sheet shapes.
//   v60 — 2026-07-28: phasing week ranges clear their chips by the resolved font ascent, preventing
//        the chip edge from striking through the tops of the week text.
//   v61 — 2026-07-28: exact sheet paths and polygons remove shallow hand jitter at paint time while
//        preserving meaningful corners and every saved vertex.
//   v63 — 2026-07-28: map callout type is 2% of map width, measured against a model-drawn render
//        of the same design. v59 made it width-relative but kept the old 0.011 coefficient, which
//        the 19px floor had always been hiding — so on Rory's 1480px water map the labels would
//        have gone from 19px to 16px, the wrong way.
//   v62 — 2026-07-28: non-reference label pills clamp from their measured browser-font width,
//        preventing wide fallbacks from crossing the right map edge. (Two branches each landed a
//        'v61' independently; this is the merge of both, so the number moves on rather than one
//        of the two render changes quietly inheriting the other's cache entry.)
//   v64 — 2026-07-28: Water notes compare measured annual roof harvest with the stated capacity
//        of placed tanks, and explicitly flag missing or unknown storage. (The unmeasured-area
//        pricing fix that also landed as 'v63' on another branch is NOT listed here: it changes
//        the facilitator BOQ, not a rendered sheet, so it has no business invalidating a render
//        cache. Only things that change the PICTURE belong in this list.)
//   v65 — 2026-07-29: the ×N fix reaches the SECOND place a count was welded to a name. v63's fix
//        covered the designed-element list; the Water sheet's "what this system serves" clause
//        still said to caption each served bed or basin "exactly as written above", where "above"
//        is an inventory reading "Vegetable Bed ×7" — so the served fixtures kept the numbering the
//        design elements had just lost. Zones sheets also get their own rule 10/14: their element
//        list is zone names, so `labelNames` was empty and the model was told its only legal
//        labels were "" while also being told to label every element.
//        (Merged from codex/prompt-data-audit, which changed the prompt without bumping this. A
//        prompt change with no bump is invisible to every farmer who has already rendered.)
//   v66 — 2026-07-29: leader lines run along the LABEL's row instead of the ELEMENT's, so two
//        elements at a similar height stop merging into one line that appears to point at the
//        wrong icon. Found by rendering the exact sheet 07 for the Ubhejane demo and looking at
//        it: "JOJO TANK 2500L" read as pointing at the compost bay.
//   v69 — 2026-07-29: the Water sheet footer reads the same twelve-month dry-season balance as the
//        Tank Calculator. Daily use is saved only when the farmer enters it; without that input the
//        sheet says what is missing instead of inventing household demand.
//   v70 — 2026-07-29: invalid facilitator roof/location inputs no longer fabricate a Durban
//        harvest card or print NaN/Infinity; valid harvest figures are unchanged.
const PLAN_VERSION = 'v93'; // Queue metadata is validated before upload, billing, and later assembly.
const WATER_REFERENCE_NOTES = 'Use plant-compatible cleaning products. Keep greywater below mulch and off edible leaves. Confirm pipe sizes, soil infiltration and local requirements on site.';

function waterReferenceFooterText(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: SectorSite | null,
): string {
  const storageNotes = deriveWaterSystem(state, refLayers, {
    rainfallMm: site?.rainfallMm,
    monthlyRainfallMm: site?.monthlyRainfallMm,
  }).storageNotes;
  return [...storageNotes, WATER_REFERENCE_NOTES].join(' ');
}

const glossyKey = (siteId: string, mapKey: string = 'all') =>
  mapKey === 'all'
    ? `imbewu_design_glossy_${PLAN_VERSION}_${siteId}`
    : `imbewu_design_glossy_${PLAN_VERSION}_${siteId}_${mapKey}`;

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

/** "Clear all" on the Saved Maps gallery emptied the durable IndexedDB store (clearSheets) but left
 *  this separate localStorage last-render cache untouched — GLOSSY_CACHE_MAX keeps it small (2
 *  entries across ALL sites), so this was never an unbounded leak, but a farmer who cleared their
 *  gallery could still briefly see one of their own just-cleared renders reappear as the "last
 *  shown result" for whichever sheet+style it was cached under, since loadSavedGlossy checks this
 *  cache independently of the gallery. Removes every glossyKey for this site, any mapKey suffix. */
function clearGlossyCacheForSite(siteId: string) {
  try {
    const prefix = `imbewu_design_glossy_${PLAN_VERSION}_${siteId}`;
    for (const k of Object.keys(localStorage)) {
      if (k === prefix || k.startsWith(`${prefix}_`)) localStorage.removeItem(k);
    }
  } catch {
    /* best effort — Clear all already cleared the durable store either way */
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

interface GalleryItem {
  id: string;
  label: string;
  image: string;
  /** Small JPEG for grid display — see makeGalleryThumbnail. Absent on sheets saved before this
   *  existed; the grid falls back to `image` for those rather than force-migrating old records. */
  thumb?: string;
  resultKind: SheetResultKind;
  provider: SheetProvider;
  geometryLock: boolean;
  showcase: boolean;
}

function galleryResultBadge(item: GalleryItem): string {
  if (item.resultKind === 'exact') return 'Exact master · no AI';
  if (item.resultKind === 'hybrid') {
    return `Geometry-locked hybrid · ${item.provider === 'gemini' ? 'Gemini' : 'gpt-image-2'}`;
  }
  if (item.resultKind === 'ai-polished') {
    return `Paid AI-polished result · ${item.provider === 'gemini' ? 'Gemini' : 'gpt-image-2'}`;
  }
  if (item.resultKind === 'ai-illustrated') {
    return `AI illustrated · ${item.provider === 'gemini' ? 'Gemini' : item.provider === 'openai' ? 'gpt-image-2' : 'provider unknown'}`;
  }
  return 'Older saved map · provenance unavailable';
}

/** The same provenance, compressed to fit a 3-across thumbnail.
 *
 *  WHY THIS EXISTS: Full Treatment deliberately saves THREE entries — exact master, AI hybrid, AI
 *  polished — and that is the render handover's own requirement, not a bug to collapse. But a
 *  gallery item's `label` is only the sheet name, so all three read "Water", and the thumbnails of
 *  one sheet at three levels of polish are near-identical at 100px. Rory had to open every tile to
 *  find the render he had PAID for. The honest text already existed in galleryResultBadge() — it
 *  was just rendered in one place, inside the opened detail view, which is the one moment you no
 *  longer need it.
 *
 *  Colour does the work before the word does: at thumbnail size the eye resolves a warm chip
 *  against two cool ones long before it resolves five letters. Amber is spent on the paid result
 *  for that reason — it is the one being searched for. `legacy` returns null rather than a "?"
 *  chip: an old map with no recorded provenance should look plain, not faulty. */
function galleryTileChip(kind: SheetResultKind): { text: string; bg: string; fg: string } | null {
  switch (kind) {
    case 'exact':          return { text: 'EXACT',  bg: 'rgba(56,52,44,0.88)',   fg: '#EFE7D6' };
    case 'hybrid':         return { text: 'HYBRID', bg: 'rgba(43,86,112,0.90)',  fg: '#DCEEF8' };
    case 'ai-polished':    return { text: 'PAID',   bg: 'rgba(178,124,26,0.94)', fg: '#FFF6E2' };
    case 'ai-illustrated': return { text: 'AI',     bg: 'rgba(92,70,120,0.90)',  fg: '#EFE4F8' };
    case 'legacy':         return null;
    default: {
      // Exhaustive on purpose. A `default: return null` would let a NEW SheetResultKind ship with
      // no chip at all — the tile would look like a legacy map and the gallery would quietly go
      // back to being unreadable, which is the bug this function exists to fix. This way adding a
      // kind is a compile error until someone decides how it should read.
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export default function DesignGlossy({
  state,
  frame,
  refLayers,
  site,
  placeName,
  geometryLock: geometryLockProp,
  onGeometryLockChange,
  initialFilter,
}: DesignGlossyProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState<'gemini' | 'falgpt' | 'exact' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Non-alarming status line (green) — e.g. "used Gemini instead" after a gpt-image-2 fallback, or
  // "N sheets done" during Generate-all. Distinct from `error` so a SUCCESSFUL render never shows red.
  const [notice, setNotice] = useState<string | null>(null);
  // The active BACKGROUND render job (gpt-image-2 via the Cloud Function queue). null = none in flight.
  const [queueJobId, setQueueJobId] = useState<string | null>(null);
  // Kept for old persisted sessions and synchronous rollback code. New queue jobs derive authority
  // from the selected style: Reference Blueprint and every painted style are app-owned; Satellite
  // Overlay is the explicit model-authored alternative.
  const [geometryLockInternal, setGeometryLockInternal] = useState(false); // OFF by default to preserve the current path
  const geometryLock = geometryLockProp ?? geometryLockInternal;
  const setGeometryLock = onGeometryLockChange ?? setGeometryLockInternal;
  const refreshPendingRef = useRef(false);
  const exactAfterFlipRef = useRef(false);
  const hybridAfterExactRef = useRef(false);
  const hybridAfterFlipRef = useRef(false);
  // Full Treatment only: after the Hybrid stage completes, advance once more into the polish stage.
  // Hybrid-only stops here, so this stays false for that flow.
  const polishAfterHybridRef = useRef(false);
  const polishAfterFlipRef = useRef(false);
  const polishStyleRef = useRef<StylePreset>(DEFAULT_PRODUCER_STYLE);
  // Full Treatment's polish stage feeds on the Hybrid stage's OWN finished sheet — not a rebuilt
  // exact sheet — so there is something actually painted for the model to polish. Set when the
  // Hybrid stage completes with polishAfterHybridRef pending; read by generateOneViaQueue's
  // 'polish' branch; cleared once consumed so a stale image can never leak into an unrelated run.
  const hybridResultRef = useRef<string | null>(null);
  /** The image the paid polish pass was handed, kept so its output can be scored against it. */
  const polishInputRef = useRef<string | null>(null);
  /** Plain-English note when a paid pass came back with nothing new. Null when it went fine. */
  const [polishNoChange, setPolishNoChange] = useState<string | null>(null);
  const [lockedPolishStage, setLockedPolishStage] = useState<'exact' | 'hybrid' | 'polish' | null>(null);
  const [promptRewrite, setPromptRewrite] = useState(true); // ON = rewritten prompts, OFF = legacy prompt for A/B rollback
  // Which sheet keys in the CURRENT job used the showcase prompt (so the async finisher softens
  // exactly those — no boundary clip, no burned labels, no cream chrome over the model's own).
  const showcaseKeysRef = useRef<Set<string>>(new Set());
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGlossy | null>(null);
  const [filter, setFilter] = useState<GlossyLayerFilter>(initialFilter ?? 'all');
  // When set, an analysis map style is chosen instead of a design-layer filter — it always
  // renders via Gemini's generative path (see GLOSSY_STYLES). null = a design-layer map.
  const [analysisStyle, setAnalysisStyle] = useState<AnalysisStyle | null>(null);
  // When set, an illustrated "producer" style is chosen — renders via the boundary-locked
  // image-producer pipeline (compositeAccurateMap). null = a design/analysis map. Defaults to a
  // style because AI is now the DEFAULT output (see `mode`); exact is the opt-in option.
  const [producerStyle, setProducerStyle] = useState<StylePreset | null>(DEFAULT_PRODUCER_STYLE);
  const renderPolicy = renderPolicyForStyle(producerStyle ?? DEFAULT_PRODUCER_STYLE);
  const effectiveModelChrome = renderPolicy.modelChrome;
  const lockActive = renderPolicy.exactGeometry;
  // Output mode — AI illustration is the DEFAULT; exact/no-AI is the option (Rory's ask). A sheet's
  // chip + this switch together decide which generator runs (see applySheet). selectedNo tracks
  // which of the 8 sheets is active so toggling mode re-maps the SAME sheet to the other generator.
  const [mode, setMode] = useState<'ai' | 'exact'>('ai');
  // "More options" collapse (mockup): engine, AI-legend toggle, Gemini analysis maps, style-all.
  const [moreOpen, setMoreOpen] = useState(false);
  const [selectedNo, setSelectedNo] = useState(() => {
    const s = DESIGN_SHEETS.find((d) => 'filter' in d && d.filter === (initialFilter ?? 'all'));
    return s?.no ?? '07';
  });

  // Select a sheet in a given mode by setting the four generator-selection states so the existing
  // Generate dispatch renders the right thing. AI on 01/02/08 → the Gemini analysis map; AI on a
  // layer → keep/seed a producer Style; exact → the deterministic sheet. Keeps the user's chosen
  // Style when staying in AI mode across sheets.
  const applySheet = useCallback((sheet: DesignSheet, m: 'ai' | 'exact') => {
    setSelectedNo(sheet.no);
    if ('exact' in sheet) {
      // Site (01) AND Sector (02) are the two analytical sheets with an AI option: a restyle-only
      // render with the deterministic bearings/house/driveway/boundary/legend composited on top
      // afterwards (never model-drawn — see buildSectorRestylePrompt and composeSectorSheet). Leave
      // exactSheet null so runCurrentSheet doesn't route to the deterministic renderBaseMap/
      // renderSectorMap, and seed/keep a non-satellite_overlay producer style — satellite_overlay's
      // whole premise is the MODEL lettering its own labels/legend, which is exactly what a sector
      // render must never do (see the Style-grid filter below).
      if ((sheet.exact === 'base' || sheet.exact === 'sector') && m === 'ai') {
        setExactSheet(null); setAnalysisStyle(null);
        // Seeded style comes from the single routing authority (lib/sheet-render-route.ts) instead
        // of a second inline copy of "null or satellite_overlay -> DEFAULT" — 'hybrid' vs 'full'
        // makes no difference to styleUsed, see sheetRenderRoute's doc.
        setProducerStyle((cur) => sheetRenderRoute({ exact: sheet.exact }, 'hybrid', cur).styleUsed);
        return;
      }
      // Phasing (08) in AI mode: the model paints only a decorative background; the complete
      // schedule text is composited back on top by composePhasingSheet afterwards. The protect mask
      // covers the ENTIRE panel region structurally, so the model never modifies schedule pixels.
      // Compare with the Sector branch above — same "AI mode seeds producerStyle, applySheet keeps
      // exactSheet null so runCurrentSheet routes to generatePhasingViaQueue" contract.
      if (sheet.exact === 'implementation' && m === 'ai') {
        setExactSheet(null); setAnalysisStyle(null);
        // Same single-authority seeding as the Site/Sector branch above.
        setProducerStyle((cur) => sheetRenderRoute({ exact: sheet.exact }, 'hybrid', cur).styleUsed);
        return;
      }
      // Reached by Site/Sector in exact mode (their AI mode returned above), and by Phasing in
      // exact mode. The deterministic rules-engine render is reliable and accurate; exact mode for
      // these three sheets always goes through renderImplementationMap / renderSectorMap / renderBaseMap.
      setExactSheet(sheet.exact); setAnalysisStyle(null); setProducerStyle(null);
    } else {
      setFilter(sheet.filter);
      setExactSheet(null);
      setAnalysisStyle(null);
      setProducerStyle(m === 'ai' ? (cur) => cur ?? DEFAULT_PRODUCER_STYLE : null);
    }
  }, []);

  // The currently-selected sheet, and whether we're in AI mode on a design LAYER (03–07) — the only
  // case that needs the Style/engine pickers. AI on 01/02/08 uses the Gemini analysis path (no
  // Style), and exact mode uses no AI at all.
  const selectedSheet = DESIGN_SHEETS.find((s) => s.no === selectedNo);
  // Derived (not a separate useState) so it can never fall out of sync with what applySheet set.
  // RESTYLE SHEETS: Sector (02) and Site (01) both take an AI option of the same shape — the model
  // repaints the ground of a drawDesign=false composite and is forbidden from drawing any analysis,
  // then the deterministic content goes back on top. They share one code path because they share
  // one input. Phasing (08) is deliberately NOT here: its content is lettered schedule text, and a
  // model that misspells "greywater" must never own a build calendar.
  // WHY SECTOR NOW HAS AN AI OPTION TOO — the line was registration, not taste, and it moved.
  //
  // gpt-image-2 recomposes the scene: it returns a picture at a slightly different scale and offset
  // from the one we sent, and there is no way to recover that transform. Sector's content — sun
  // arc, wind arrows, bearings, the house, the driveway, the boundary — used to be drawn by us at
  // TRUE coordinates and laid over the MODEL's OWN depiction of the ground. When the model shifted
  // the ground beneath, every arrow pointed at the wrong part of the farm: four renders running
  // came back with the boundary cutting through the house.
  //
  // The fix was not a better prompt — the model is not disobeying, it is reframing, and no prompt
  // measures by how much. The fix was to stop asking the model to depict the house/driveway/
  // boundary AT ALL, and stop compositing over its depiction of them. `composeSectorSheet` now
  // draws the house, driveway, boundary and every arrow itself, at true coordinates, over WHATEVER
  // ground texture the model returns — so the model's reframing can only ever shift decorative
  // texture, never a feature anything aligns to. See docs/SECTOR-AI-LEGEND-PLAN-2026-07-21.md.
  const restyleAiKind: 'sector' | 'base' | null =
    mode === 'ai' && selectedSheet && 'exact' in selectedSheet && (selectedSheet.exact === 'base' || selectedSheet.exact === 'sector')
      ? selectedSheet.exact
      : null;
  const sectorAiMode = restyleAiKind !== null;
  // Phasing (08) in AI mode: decorative background pass + schedule composite-back. exactSheet is
  // null (AI mode cleared it) and producerStyle is set, so runCurrentSheet must check this BEFORE
  // falling through to generateOneViaQueue's GlossyLayerFilter path. See generatePhasingViaQueue.
  const phasingAiMode = mode === 'ai' && !!selectedSheet && 'exact' in selectedSheet && selectedSheet.exact === 'implementation';
  const aiLayerMode = mode === 'ai' && !!selectedSheet && (!('exact' in selectedSheet) || sectorAiMode || phasingAiMode);
  // Preview-map mount (initialFilter set): a focused single-sheet view — hide the full studio
  // (sheet grid, exact-all link, More options) so the overlay isn't a second copy of everything
  // (audit find). The main Glossy step passes no initialFilter and shows it all.
  const compact = initialFilter != null;
  // The deterministic Implementation & Phasing sheet (plan-set 08). It is the EXACT counterpart to
  // the Gemini 'implementation' ANALYSIS style — a rules-engine render (lib/phasing), always
  // reliable — so it belongs with the exact Design maps, not the illustrated ones. When true it
  // overrides filter/analysis/producer for the render dispatch.
  // Which deterministic EXACT sheet (if any) is selected — the two rules-engine sheets (Sector 02,
  // Implementation 08) that carry their own chrome and override filter/analysis/producer. One union
  // state (not two booleans) makes the selection mutually exclusive by construction.
  const [exactSheet, setExactSheet] = useState<null | 'base' | 'sector' | 'implementation'>(null);
  // Whether the CURRENT selection renders without any model — drives the honest caption/pill.
  const isExactRender = exactSheet !== null || (!producerStyle && !analysisStyle);
  // Render engine. Gemini is the DEFAULT because gpt-image-2 (via fal.ai) frequently 403s
  // (fal/OpenAI verification); gpt-image-2 stays selectable and auto-falls-back to Gemini on error.
  const [engine, setEngine] = useState<'falgpt' | 'gemini'>('falgpt');
  // DURABLE gallery of every successful render (producer OR the strict/analysis paths), backed by
  // IndexedDB (lib/sheet-store.ts). It used to be session-only: created empty on every mount and
  // written nowhere, so closing the tab destroyed sheets that cost real money and minutes to
  // render. `storageWarning` is set when a sheet could not be persisted, so we say so rather than
  // let the word "Saved" imply a durability we do not have.
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryViewId, setGalleryViewId] = useState<string | null>(null);
  const [galleryZoomOpen, setGalleryZoomOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A stable cache key per chosen map (producer style OR design filter OR analysis style).
  // Each map+style combination caches its own render (e.g. producer:storybook:zones).
  const mapKey = exactSheet === 'base'
    ? 'base-exact'
    : exactSheet === 'sector'
    ? 'sector-exact'
    : exactSheet === 'implementation'
      ? 'implementation-exact'
      // Own cache namespace: without it an AI Sector render would key under
      // `producer:${style}:${filter}` where `filter` is whatever GlossyLayerFilter was last
      // selected (e.g. 'all'), silently colliding with the real Whole-design AI sheet's entry.
      // Phasing AI similarly needs its own namespace so it can't collide with a design-layer sheet.
      : phasingAiMode && producerStyle
        ? `producer:${producerStyle}:implementation`
      : restyleAiKind && producerStyle
        ? `producer:${producerStyle}:${restyleAiKind}`
      : producerStyle
        ? `producer:${producerStyle}:${filter}`
        : (analysisStyle ?? filter);
  const mapKeyRef = useRef(mapKey);
  mapKeyRef.current = mapKey;
  const galleryViewItem = gallery.find((g) => g.id === galleryViewId) ?? null;

  useEffect(() => {
    if (!galleryZoomOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGalleryZoomOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [galleryZoomOpen]);

  // Restore this site's saved sheets on mount / site change. Failure is silent by design: an
  // unavailable IndexedDB must still leave a working session-only gallery.
  useEffect(() => {
    let cancelled = false;
    void loadSheets(state.siteId).then((rows) => {
      if (cancelled) return;
      // Sheets from an earlier generation of the render rules stay in the gallery — they are the
      // farmer's, and some are downloaded already — but they are labelled, so two sheets with the
      // same title from different eras are never confusable.
      setGallery(rows.map((r) => ({
        id: r.id,
        label: r.planVersion === PLAN_VERSION ? r.label : `${r.label} · older version`,
        image: r.image,
        thumb: r.thumb,
        resultKind: r.resultKind ?? 'legacy',
        provider: r.provider ?? 'unknown',
        geometryLock: r.geometryLock ?? false,
        showcase: r.showcase ?? false,
      })));
      // Backfill thumbnails for sheets saved before makeGalleryThumbnail existed — otherwise a
      // farmer's EXISTING gallery (the case most likely to actually have the memory problem this
      // fixes, having had the longest time to accumulate full-resolution entries) never benefits.
      // One at a time, best-effort, never blocking the already-shown grid.
      for (const r of rows) {
        if (r.thumb) continue;
        void makeGalleryThumbnail(r.image).then((thumb) => {
          if (cancelled || !thumb) return;
          setGallery((prev) => prev.map((g) => (g.id === r.id ? { ...g, thumb } : g)));
          void saveSheet({ ...r, thumb });
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.siteId]);

  const pushGallery = useCallback(
    (
      label: string,
      image: string,
      provenance: Partial<Pick<GalleryItem, 'resultKind' | 'provider' | 'geometryLock' | 'showcase'>> = {},
    ) => {
      const item: GalleryItem = {
        id: `map-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        image,
        resultKind: provenance.resultKind ?? 'legacy',
        provider: provenance.provider ?? 'unknown',
        geometryLock: provenance.geometryLock ?? false,
        showcase: provenance.showcase ?? false,
      };
      setGallery((prev) => [...prev, item]);
      // Persist alongside the state update, never instead of it — a sheet that fails to save must
      // still be on screen and downloadable.
      void saveSheet({ ...item, siteId: state.siteId, at: new Date().toISOString(), planVersion: PLAN_VERSION }).then((ok) => {
        setStorageWarning(
          ok
            ? null
            : `Couldn't save “${label}” to this device (storage full or unavailable) — download it before you close this tab.`,
        );
      });
      // Thumbnail generation is separate and best-effort: the sheet is already on screen and saved
      // above, so a slow or failed thumbnail must never delay or block that. Once ready, patch it
      // onto both the visible gallery item and the persisted record.
      void makeGalleryThumbnail(image).then((thumb) => {
        if (!thumb) return;
        setGallery((prev) => prev.map((g) => (g.id === item.id ? { ...g, thumb } : g)));
        void saveSheet({ ...item, thumb, siteId: state.siteId, at: new Date().toISOString(), planVersion: PLAN_VERSION });
      });
      return item.id;
    },
    [state.siteId],
  );

  // Remove one saved map, from the screen AND from storage. If the deleted item is the one open in
  // the detail view, drop back to the grid.
  const removeGallery = useCallback((id: string) => {
    setGallery((prev) => prev.filter((g) => g.id !== id));
    setGalleryViewId((cur) => (cur === id ? null : cur));
    void deleteSheet(id).then((ok) => {
      if (!ok) {
        setStorageWarning(
          "The map was removed from this tab, but couldn't be removed from device storage. It may reappear when you reopen this design.",
        );
      }
    });
  }, []);

  const clearGallery = useCallback(() => {
    setGallery([]);
    setGalleryViewId(null);
    clearGlossyCacheForSite(state.siteId);
    void clearSheets(state.siteId).then((ok) => {
      if (!ok) {
        setStorageWarning(
          "The gallery was cleared from this tab, but couldn't be cleared from device storage. Saved maps may reappear when you reopen this design.",
        );
      }
    });
  }, [state.siteId]);

  // Load the cached render for this site + chosen map. Runs on mount and whenever the map
  // changes, so each map keeps its own last render.
  useEffect(() => {
    const cached = loadSavedGlossy(state.siteId, mapKey);
    // Exact and AI outputs must never share a visible slot. Older builds saved the deterministic
    // Zones sheet under its producer key, which made the free master look like a completed paid
    // polish. Reject that legacy collision; exact sheets have their own cache namespace below.
    const visibleCached = mapKey.startsWith('producer:') && cached?.provider === 'exact'
      ? null
      : cached;
    setSaved(visibleCached);
    setResultImage(visibleCached ? visibleCached.image : null);
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
              return def && itemInFilter(def.category, compositeFilter, def.id);
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
        pushGallery(`${mapLabel} · AI illustrated`, finalImage, {
          resultKind: 'ai-illustrated',
          provider: useProvider === 'gemini' ? 'gemini' : 'openai',
          geometryLock: false,
          showcase: true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
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
      setError(emptyLayerMessage(filter, t));
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
      const composite = await buildComposite(
        state,
        frame,
        refLayers,
        filter,
        true,
        geometryLock ? lockedCompositeMarks(filter) : undefined,
      );
      // b. Short comma list of placed elements + counts (this layer only).
      const elementsText = producerElementsText(state, refLayers, filter, !geometryLock);
      // b2. The WHOLE design as text — deliberately NOT filtered by `filter`, so every layer's
      //     render is handed the identical brief and the sheets agree with each other.
      const designBrief = buildDesignBrief(state, refLayers, placeName, site);
      const protectMaskDataUrl = geometryLock
        ? await buildProtectMask(state, frame, refLayers, filter, lockedProtectMaskOptions(filter))
        : undefined;
      // c. Beautify via the image-producer route (gemini engine; async path handled inside).
      //    ZONES runs the model too now. The old rule ("AI mustn't invent under my zones —
      //    just the clean satellite") predates the Exact mode: today "clean satellite zones"
      //    IS the Exact render, one link away, while an AI-mode zones tap used to silently
      //    return a no-model sheet captioned "AI artist's impression" (audit must-fix; also
      //    Rory: "gpt zones keeps coming up autogenerated"). Accuracy is still guaranteed by
      //    construction: buildZoneOverlay burns the EXACT zone regions over whatever the model
      //    paints, so the zones themselves can never drift.
      let modelImage: string;
      {
        try {
          modelImage = await requestProducer(
            stripDataUrl(composite),
            layerLabel,
            elementsText,
            producerStyle,
            producerEngine,
            designBrief,
            promptRewrite ? 'rewrite' : 'legacy',
          );
        } catch (err) {
          // gpt-image-2 (via fal.ai) frequently returns 403 (fal/OpenAI verification). Don't fail
          // the whole render — fall back to the always-available Gemini engine and say so.
          if (producerEngine === 'openai') {
            setNotice(t('designGlossyFallbackGemini'));
            modelImage = await requestProducer(
              stripDataUrl(composite),
              layerLabel,
              elementsText,
              producerStyle,
              'gemini',
              designBrief,
              promptRewrite ? 'rewrite' : 'legacy',
            );
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
      const labels = filter === 'water' && geometryLock
        ? []
        : producerLabels(state, refLayers, W, H, filter, !geometryLock);
      // e2. On a Zones map, burn the exact zone REGIONS back on top — the model can't render an
      //     abstract coloured overlay, so we guarantee it (see buildZoneOverlay).
      const overlayImage =
        filter === 'zones' ? buildZoneOverlay(state, refLayers, W, H)
        : filter === 'water' ? buildWaterOverlay(state, frame, refLayers, W, H, !geometryLock, geometryLock)
        : undefined;
      const structureOverlay = geometryLock
        ? await buildLockedStructureOverlay(frame.satDataUrl ?? composite, state, frame, refLayers, W, H, styleDef.key)
        : undefined;
      const mergedOverlay = filter === 'water' && geometryLock
        ? await stackOverlayImages(structureOverlay, overlayImage, W, H)
        : await stackOverlayImages(overlayImage, structureOverlay, W, H);
      // f. Deterministic composite-back — accuracy guaranteed by construction.
      const final = await compositeAccurateMap({
        modelImage: protectMaskDataUrl
          ? await restoreProtectedPixels(frame.satDataUrl ?? composite, modelImage, protectMaskDataUrl)
          : modelImage,
        // Satellite is the ground truth OUTSIDE the boundary; fall back to the composite when
        // there's no satellite so the map is never left blank/transparent there.
        satelliteImage: frame.satDataUrl ?? composite,
        boundaryPx,
        overlayImage: mergedOverlay,
        labels,
        labelStyle: styleDef.labelStyle,
        contextTreatment: geometryLock && styleDef.key === 'precision_atlas' ? 'precision_atlas' : 'original',
        focusBoundaryPx: geometryLock && styleDef.key === 'precision_atlas' && filter === 'water'
          ? refLayers.boundary.flatMap(([x, y]) => [x * W, y * H])
          : undefined,
        width: W,
        height: H,
      });
      // g. Sheet chrome — titled legend panel + scale bar + north arrow, so the Style render comes
      //    out as a proper plan sheet (see docs/PLAN-SET-SPEC.md), not a bare picture.
      const sheet = await composeStyleSheet(
        final,
        state,
        frame,
        refLayers,
        filter,
        placeName,
        styleDef.label,
        geometryLock ? REFERENCE_SHEET_LABEL[filter] : layerLabel,
        !geometryLock,
        geometryLock,
        geometryLock && filter === 'water'
          ? {
              footerHeading: 'NOTES',
              footerText: waterReferenceFooterText(state, frame, refLayers, site),
            }
          : {},
      );
      // h. Show, cache (mapKey = producer:<style>) and add to the session gallery.
      setResultImage(sheet);
      const record: SavedGlossy = { image: sheet, provider: producerEngine === 'openai' ? 'falgpt' : 'gemini', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      pushGallery(`${layerLabel} · ${styleDef.label} · Geometry-locked hybrid`, sheet, {
        resultKind: 'hybrid',
        provider: producerEngine === 'openai' ? 'openai' : 'gemini',
        geometryLock,
        showcase: false,
      });
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        setNotice(t('designGlossyRefreshed'));
      }
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
    } finally {
      setLoading(null);
    }
    // `site` joins the deps because buildDesignBrief reads it for the CONTEXT line.
  }, [producerStyle, filter, engine, state, frame, refLayers, mapKey, pushGallery, placeName, site, promptRewrite, geometryLock]);

  // Deterministic design-layer map — the ACCURATE-BY-CONSTRUCTION reference map.
  // Real satellite + your EXACT zones / elements / lines / labels drawn on top, and
  // NOTHING else. No model runs, so nothing can be invented (no imaginary lavender
  // field, orchard or veg beds — the "amazing picture but completely wrong" failure).
  // Instant, free, always correct. The illustrated "Style" buttons remain the AI
  // beautify path for when a farmer wants the artist's impression instead.
  const renderDesignMap = useCallback(async () => {
    if (layerContentCount(state, refLayers, filter) === 0) {
      setError(emptyLayerMessage(filter, t));
      return;
    }
    setLoading('exact');
    setError(null);
    try {
      // Every design layer, including the integrated masterplan, uses the same deterministic
      // Reference Blueprint sheet template and exact source geometry.
      const composite = filter === 'zones'
        ? await buildBlueprintZoneMap(state, frame, refLayers, placeName)
        : filter === 'water'
          ? await buildBlueprintWaterMap(state, frame, refLayers, placeName)
          : filter === 'planting'
            ? await buildBlueprintPlantingMap(state, frame, refLayers, placeName)
            : filter === 'structures'
              ? await buildBlueprintStructuresMap(state, frame, refLayers, placeName)
              : await buildBlueprintWholeMap(state, frame, refLayers, placeName);
      setResultImage(composite);
      const record: SavedGlossy = { image: composite, provider: 'exact', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      const mapLabel = filter === 'all'
        ? 'Whole design'
        : `${GLOSSY_FILTERS.find((f) => f.key === filter)?.label ?? filter} map`;
      pushGallery(`${mapLabel} · Exact master`, composite, {
        resultKind: 'exact',
        provider: 'exact',
        geometryLock: true,
        showcase: false,
      });
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        setNotice(t('designGlossyRefreshed'));
      }
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
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
        t('designGlossyNothingToPhase'),
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
      pushGallery('Implementation & phasing · Exact master', composite, {
        resultKind: 'exact',
        provider: 'exact',
        geometryLock: true,
        showcase: false,
      });
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        setNotice(t('designGlossyRefreshed'));
      }
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
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
      pushGallery('Sector analysis · Exact master', composite, {
        resultKind: 'exact',
        provider: 'exact',
        geometryLock: true,
        showcase: false,
      });
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        setNotice(t('designGlossyRefreshed'));
      }
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
    } finally {
      setLoading(null);
    }
  }, [state, frame, refLayers, site, mapKey, pushGallery, placeName]);

  // Deterministic EXISTING-SITE sheet (plan-set 01) — the plain satellite + boundary with NO design
  // drawn (drawDesign=false). The honest "before" the whole plan builds on; exact, never invented.
  const renderBaseMap = useCallback(async () => {
    setLoading('exact');
    setError(null);
    try {
      const composite = await buildBlueprintBaseMap(state, frame, refLayers, placeName);
      setResultImage(composite);
      const record: SavedGlossy = { image: composite, provider: 'exact', at: new Date().toISOString() };
      saveGlossy(state.siteId, mapKey, record);
      setSaved(record);
      pushGallery('Existing site & base · Exact master', composite, {
        resultKind: 'exact',
        provider: 'exact',
        geometryLock: true,
        showcase: false,
      });
      if (refreshPendingRef.current) {
        refreshPendingRef.current = false;
        setNotice(t('designGlossyRefreshed'));
      }
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
    } finally {
      setLoading(null);
    }
  }, [state, frame, refLayers, mapKey, pushGallery, placeName]);

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
      pushGallery(`${label} · Exact master`, image, {
        resultKind: 'exact',
        provider: 'exact',
        geometryLock: true,
        showcase: false,
      });
      made += 1;
      setNotice(formatDesignTranslation(t('designGlossyGeneratingProgress'), {
        count: made,
        sheets: t(made === 1 ? 'designGlossySheet' : 'designGlossySheets'),
      }));
    };
    try {
      // Canonical 8-map order (docs/PLAN-SET-SPEC.md). Analysis (02 Sector) before design.
      // 01 — Existing site & base (satellite + boundary + existing features, no proposed design).
      step('01 · Existing site & base', await buildBlueprintBaseMap(state, frame, refLayers, placeName), 'base');
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
      step('07 · Whole design (masterplan)', await buildBlueprintWholeMap(state, frame, refLayers, placeName), 'all');
      // 08 — Implementation & phasing (exact rules-engine sheet), when there's anything to phase.
      const plan = buildPhasePlan(state, refLayers, site);
      if (plan.phases.length > 0) {
        step('08 · Implementation & phasing', await buildImplementationMap(state, frame, refLayers, site, placeName), 'implementation-exact');
      }
      setNotice(formatDesignTranslation(t('designGlossyDoneExact'), { count: made }));
      setGalleryViewId(null);
      setGalleryOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
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
    // Deliberately does NOT touch producerStyle/exactSheet: the batch passes styleKey explicitly,
    // and leaking it into the selection state flipped a user parked on an Exact sheet into AI
    // without them choosing it (audit find — "exact mode silently turns into an AI render").
    const styleKey = producerStyle ?? DEFAULT_PRODUCER_STYLE;
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
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
        const composite = await buildComposite(
          state,
          frame,
          refLayers,
          f,
          true,
          geometryLock ? lockedCompositeMarks(f) : undefined,
        );
        const elementsText = producerElementsText(state, refLayers, f, !geometryLock);
        const designBrief = buildDesignBrief(state, refLayers, placeName, site);
        let modelImage: string;
        {
          // Zones runs the model too (same contract change as the single-sheet path — the exact
          // zone overlay is burned back on top below, so the regions can never drift).
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
        const labels = f === 'water' && geometryLock
          ? []
          : producerLabels(state, refLayers, W, H, f, !geometryLock);
        const overlayImage =
          f === 'zones' ? buildZoneOverlay(state, refLayers, W, H)
          : f === 'water' ? buildWaterOverlay(state, frame, refLayers, W, H, !geometryLock, geometryLock)
          : undefined;
        const structureOverlay = geometryLock
          ? await buildLockedStructureOverlay(frame.satDataUrl ?? composite, state, frame, refLayers, W, H, styleDef.key)
          : undefined;
        const mergedOverlay = f === 'water' && geometryLock
          ? await stackOverlayImages(structureOverlay, overlayImage, W, H)
          : await stackOverlayImages(overlayImage, structureOverlay, W, H);
        const protectMaskDataUrl = geometryLock
          ? await buildProtectMask(state, frame, refLayers, f, lockedProtectMaskOptions(f))
          : undefined;
        const final = await compositeAccurateMap({
          modelImage: protectMaskDataUrl
          ? await restoreProtectedPixels(frame.satDataUrl ?? composite, modelImage, protectMaskDataUrl)
          : modelImage,
          satelliteImage: frame.satDataUrl ?? composite,
          boundaryPx,
          overlayImage: mergedOverlay,
          labels,
          labelStyle: styleDef.labelStyle,
          contextTreatment: geometryLock && styleDef.key === 'precision_atlas' ? 'precision_atlas' : 'original',
          focusBoundaryPx: geometryLock && styleDef.key === 'precision_atlas' && f === 'water'
            ? refLayers.boundary.flatMap(([x, y]) => [x * W, y * H])
            : undefined,
          width: W,
          height: H,
        });
        const sheet = await composeStyleSheet(
          final,
          state,
          frame,
          refLayers,
          f,
          placeName,
          styleDef.label,
          geometryLock ? REFERENCE_SHEET_LABEL[f] : layerLabel,
          !geometryLock,
          geometryLock,
          geometryLock && f === 'water'
            ? {
                footerHeading: 'NOTES',
                footerText: waterReferenceFooterText(state, frame, refLayers, site),
              }
            : {},
        );
        try {
          saveGlossy(state.siteId, `producer:${styleKey}:${f}`, {
            image: sheet,
            provider: producerEngine === 'openai' && !fellBack ? 'falgpt' : 'gemini',
            at: new Date().toISOString(),
          });
        } catch { /* cache full — gallery still holds it */ }
        pushGallery(`${layerLabel} · ${styleDef.label} · Geometry-locked hybrid`, sheet, {
          resultKind: 'hybrid',
          provider: producerEngine === 'openai' && !fellBack ? 'openai' : 'gemini',
          geometryLock,
          showcase: false,
        });
        made += 1;
        setNotice(formatDesignTranslation(t('designGlossyStylingProgress'), {
          style: styleDef.label,
          count: made,
          sheets: t(made === 1 ? 'designGlossySheet' : 'designGlossySheets'),
        }));
      }
      if (made === 0) {
        setError(t('designGlossyNothingToStyle'));
        setNotice(null);
      } else {
        setNotice(formatDesignTranslation(t('designGlossyDoneStyle'), {
          count: made,
          style: styleDef.label,
          fallback: fellBack ? ' (gpt-image-2 unavailable → Gemini)' : '',
        }));
        setGalleryViewId(null);
        setGalleryOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('designGlossyRenderFailed'));
    } finally {
      setLoading(null);
    }
  }, [producerStyle, engine, state, frame, refLayers, site, placeName, pushGallery, geometryLock]);

  // ── Background render queue (Stage 2) — gpt-image-2 direct via the Cloud Function ──────────────
  // The slow model call runs in functions/runRenderJob, NOT in the browser, so it escapes Vercel's
  // 60s wall and scales. The browser only builds each composite + prompt (client-side, so all the
  // exact-map logic stays here), hands them to the queue, then finishes each returned sheet with the
  // same deterministic composite-back the synchronous path uses.

  // Composite-back for one sheet. STRICT (default): clip the model output to the boundary, put the
  // real satellite outside, burn our exact labels + the cream sheet chrome — accuracy by
  // construction. SHOWCASE: the model drew its own legend + labels, so keep its whole output (no
  // clip, no burned labels, no chrome), with only the transparency backstop.
  const finishStyledSheet = useCallback(
    async (
      modelImage: string,
      f: GlossyLayerFilter,
      styleDef: { key: StylePreset; label: string; labelStyle: LabelStyle },
      showcase = false,
      sourceImage?: string,
      protectMask?: string,
      locked = false,
    ): Promise<string> => {
      // Model-authored pages and geometry-locked pages must use the same boundary-focused frame
      // as the image sent to GPT. Otherwise exact overlays are rebuilt in the original satellite
      // coordinates and land as a tiny or displaced design on the returned page.
      const useBoundaryPresentation = locked || isModelChromeStyle(styleDef.key);
      const presentation = useBoundaryPresentation
        ? await boundaryPresentationContext(state, frame, refLayers)
        : { state, frame, refLayers };
      const renderState = presentation.state;
      const renderFrame = presentation.frame;
      const renderRefLayers = presentation.refLayers;
      const W = renderFrame.imgW * SCALE;
      const H = renderFrame.imgH * SCALE;
      // Satellite Overlay renders the ENTIRE sheet — map, labels, legend panel, title, north arrow
      // and scale bar — from a sheet-shaped input. Its output is wider than the map frame, so
      // running it through compositeAccurateMap (which draws into W×H, the MAP dimensions) would
      // squash the sheet and paint the satellite back over the model's own work. Ship it as-is.
      if (isModelChromeStyle(styleDef.key) && !locked) {
        // Put the real roof back. sourceImage is this job's own sheet-shaped input, so it lines up
        // with the model output pixel-for-pixel; frame.satDataUrl is map-only and would not.
        let sheetImage = modelImage;
        if (protectMask && sourceImage) {
          try {
            sheetImage = await restoreProtectedPixels(sourceImage, modelImage, protectMask);
          } catch (err) {
            console.error('[glossy] roof restore failed, shipping the raw sheet', err);
          }
        }
        // ZONE GEOMETRY IS NOT THE MODEL'S TO DRAW. Every other style burns buildZoneOverlay — the
        // farmer's EXACT traced regions — back over the render; this early return skipped it. So on
        // Satellite Overlay the model drew the bands freehand from the composite, and did what
        // models do: smoothed hand-traced polygons into tidy concentric rings around the house.
        // Prettier than the design, and not the design. (Rory: "it didnt actually follow my zones i
        // drew.") A zone map's entire job is WHERE the lines are, so the browser draws them and the
        // model keeps the ground it is genuinely good at.
        const exactZones = f === 'zones'
          ? buildZoneOverlay(renderState, renderRefLayers, W, H)
          : undefined;
        if (exactZones) {
          try {
            sheetImage = await burnOverlayOnSheetMap(sheetImage, exactZones);
          } catch (err) {
            // A failed burn must never lose a paid render — ship the model's sheet rather than nothing.
            console.error('[glossy] exact zone burn failed, shipping the model sheet', err);
          }
        }
        return sheetImage;
      }

      // Full Treatment's second paid pass receives the complete finished Hybrid page. Restore only
      // the factual pixels in its sheet-sized mask. The remaining page is intentionally left to
      // the second pass so Full Treatment looks richer than Hybrid instead of being copied back to
      // it almost wholesale. Never ship the model page raw: houses, access and site edges remain
      // protected because a prompt alone is not a geometry guarantee.
      if (showcase && !locked && protectMask && sourceImage) {
        try {
          return await restoreProtectedPixels(sourceImage, modelImage, protectMask);
        } catch (err) {
          console.error('[glossy] Full Treatment restore failed; keeping the exact Hybrid', err);
          return sourceImage;
        }
      }

      // The model input and every exact overlay must share one presentation coordinate system.
      // Small properties are cropped around their saved boundary for the finished page; applying
      // raw-frame overlays to that cropped model image caused the tiny-site and displaced-house
      // defects seen on Ubhejane.
      const layerLabel = f === 'all' ? 'Full design' : GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? 'Full design';
      // OpenAI documents GPT Image masks as guidance rather than an exact clipping contract.
      // Geometry Lock therefore wins here, after generation: every opaque mask pixel is copied
      // back from the uploaded source before any labels or sheet chrome are drawn.
      const cleanSource = renderFrame.satDataUrl ?? sourceImage;
      const restoredImage = locked && protectMask && cleanSource
        ? await restoreProtectedPixels(cleanSource, modelImage, protectMask)
        : modelImage;
      const structureOverlay = locked
        ? await buildLockedStructureOverlay(cleanSource, renderState, renderFrame, renderRefLayers, W, H, styleDef.key)
        : undefined;
      const exactGroundOverlay = locked
        ? await buildExactLayerOverlay(renderState, renderFrame, renderRefLayers, f, W, H, 'ground', f === 'water' ? 'illustrated' : 'standard')
        : undefined;
      const exactFeatureOverlay = locked
        ? await buildExactLayerOverlay(
            renderState,
            renderFrame,
            renderRefLayers,
            f,
            W,
            H,
            'features',
            'standard',
            protectMask ? 'hybrid' : 'solid',
          )
        : undefined;
      // A showcase job owns the complete page: title, map, pictorial legend and labels. Step 1 has
      // already saved the exact app-owned master separately, so compositing app chrome back over
      // this paid result would only turn it into the same hybrid again.
      if (showcase && !locked) return restoredImage;
      // Locked sheets are painted edge to edge, so they must NOT be clipped to the plot: clipping
      // is what produced a small illustrated patch dropped into an untouched satellite photo.
      // Unlocked sheets keep the clip, which is what holds their art inside the boundary.
      const boundaryPx = locked || renderRefLayers.boundary.length < 3
        ? undefined
        : renderRefLayers.boundary.flatMap(([x, y]) => [x * W, y * H]);
      // The locked Water sheet must NOT also go through burnLabels: buildWaterOverlay below is
      // called with includeLeaderLabels = locked and already draws every water label itself.
      // Passing labels here too burned a SECOND set a few pixels off the first, which is why every
      // pill had a half-hidden twin behind it ("MULCH BANK" over "MU…", "SMALL POND" over "SM…").
      const labels = f === 'water' && locked
        ? []
        : locked
          ? referenceBlueprintLabels(renderState, renderRefLayers, W, H, f)
          : producerLabels(renderState, renderRefLayers, W, H, f, true);
      const overlayImage = locked
        ? exactFeatureOverlay
        : f === 'zones' ? buildZoneOverlay(renderState, renderRefLayers, W, H)
          : f === 'water' ? buildWaterOverlay(renderState, renderFrame, renderRefLayers, W, H, true, false)
            : undefined;
      // Ground first, then the exact source-derived roof and driveway, then factual marks. This keeps
      // the structure exact without hiding a saved pipe, tank, bed or leader that crosses it.
      const groundedStructures = locked
        ? await stackOverlayImages(exactGroundOverlay, structureOverlay, W, H)
        : structureOverlay;
      const mergedOverlay = await stackOverlayImages(groundedStructures, overlayImage, W, H);
      const final = await compositeAccurateMap({
        modelImage: restoredImage,
        satelliteImage: renderFrame.satDataUrl ?? sourceImage ?? modelImage,
        boundaryPx,
        overlayImage: mergedOverlay,
        labels,
        labelStyle: styleDef.labelStyle,
        contextTreatment: locked && styleDef.key === 'precision_atlas' ? 'precision_atlas' : 'original',
        focusBoundaryPx: locked && styleDef.key === 'precision_atlas' && f === 'water'
          ? renderRefLayers.boundary.flatMap(([x, y]) => [x * W, y * H])
          : undefined,
        width: W,
        height: H,
      });
      return composeStyleSheet(
        final,
        renderState,
        renderFrame,
        renderRefLayers,
        f,
        placeName,
        styleDef.label,
        locked ? REFERENCE_SHEET_LABEL[f] : layerLabel,
        !locked,
        locked,
        locked && f === 'water'
          ? {
              footerHeading: 'NOTES',
              footerText: waterReferenceFooterText(renderState, renderFrame, renderRefLayers, site),
            }
          : {},
      );
    },
    [state, frame, refLayers, site, placeName],
  );

  // "AI · ALL sheets" when the engine is gpt-image-2: enqueue a background job for the model sheets
  // (Zones is satellite-only → produced exactly, here and now), then the subscription effect below
  // collects each finished sheet into the gallery as it lands.
  const generateAllViaQueue = useCallback(async () => {
    const styleKey = producerStyle ?? DEFAULT_PRODUCER_STYLE;
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
    // No selection side-effects here — the batch passes styleKey explicitly; leaking it into the
    // chips used to flip a user parked on an Exact sheet into AI mode (audit find).
    setError(null);
    setNotice(null);
    setLoading('falgpt');
    try {
      const presentation = await boundaryPresentationContext(state, frame, refLayers);
      const renderState = presentation.state;
      const renderFrame = presentation.frame;
      const renderRefLayers = presentation.refLayers;
      const mapW = renderFrame.imgW * SCALE;
      const mapH = renderFrame.imgH * SCALE;
      // App-owned styles create Zones deterministically because there is no useful texture-only AI
      // work on that sheet. Satellite Overlay remains the explicit model-authored comparison path.
      if (!effectiveModelChrome && layerContentCount(renderState, renderRefLayers, 'zones') > 0) {
        const base = renderFrame.satDataUrl
          ?? (await buildComposite(renderState, renderFrame, renderRefLayers, 'zones'));
        const zsheet = await finishStyledSheet(
          base,
          'zones',
          styleDef,
          false,
          renderFrame.satDataUrl ?? undefined,
          undefined,
          lockActive,
        );
        try { saveGlossy(state.siteId, `producer:${styleKey}:zones:exact`, { image: zsheet, provider: 'exact', at: new Date().toISOString() }); } catch { /* cache full */ }
        pushGallery(`Zones map · ${styleDef.label} · Exact styled`, zsheet, {
          resultKind: 'exact',
          provider: 'exact',
          geometryLock: true,
          showcase: false,
        });
      }
      // With showcase on, zones joins the model list — 5 sheets, exactly MAX_SHEETS_PER_JOB.
      const modelFilters: GlossyLayerFilter[] = effectiveModelChrome
        ? ['all', 'zones', 'water', 'planting', 'structures']
        : ['all', 'water', 'planting', 'structures'];
      const designBrief = buildDesignBrief(renderState, renderRefLayers, placeName, site);
      const authorityFlags = renderAuthorityFlagsForStyle(styleKey);
      const sheets = [] as Array<{
        key: string;
        label: string;
        prompt: string;
        compositeDataUrl: string;
        protectMaskDataUrl?: string;
        useProtectMaskForEdit?: boolean;
        showcase?: boolean;
        geometryLock?: boolean;
      }>;
      for (const f of modelFilters) {
        if (layerContentCount(renderState, renderRefLayers, f) === 0) continue;
        const composite = await buildComposite(
          renderState,
          renderFrame,
          renderRefLayers,
          f,
          true,
          isModelChromeStyle(styleKey)
            ? OVERLAY_COMPOSITE_MARKS
            : lockActive
              ? polishModelInputMarks(f)
              : undefined,
        );
        const { elements: elementsText, fabric, served } = isModelChromeStyle(styleKey)
          ? overlayElementsText(renderState, renderRefLayers, f)
          : { elements: producerElementsText(renderState, renderRefLayers, f, !lockActive), fabric: '' };
        const layerLabel = f === 'all' ? 'Full design' : GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? 'Full design';
        // Satellite Overlay is handed a sheet-shaped canvas (map + blank cream panel) so the photo
        // never has to be moved to make room for the legend. See extendWithLegendPanel.
        const sheetInput = isModelChromeStyle(styleKey)
          ? (await extendWithLegendPanel(composite, mapW, mapH)).dataUrl
          : composite;
        // Carry the structural mask through the queue for deterministic post-generation restore.
        // It is deliberately NOT sent to the edits endpoint: GPT Image keeps the Precision Atlas
        // style reference, then the browser restores house/driveway/boundary/outside pixels and
        // verifies the opaque mask pixels byte-for-byte.
        const protectMaskDataUrl = lockActive
          ? await buildProtectMask(
              renderState,
              renderFrame,
              renderRefLayers,
              f,
              lockedProtectMaskOptions(f),
            )
          : undefined;
        const prompt = isModelChromeStyle(styleKey)
          ? buildSatelliteOverlayPrompt({
              layerLabel,
              stylePreset: styleKey,
              elementsText,
              fabric,
              served,
              systems: waterSystemsPresent(renderState),
              placeName,
              sheetKind: f,
              hasDriveway: renderRefLayers.driveway.length >= 2,
            })
          : lockActive
          ? buildLockedIllustrationPrompt(layerLabel, styleKey, elementsText, designBrief)
          : effectiveModelChrome
            ? (promptRewrite
              ? buildShowcasePrompt(layerLabel, styleKey, elementsText, placeName ?? '', f)
              : buildShowcasePromptLegacy(layerLabel, styleKey, elementsText, placeName ?? '', designBrief))
            : (promptRewrite
              ? buildProducerPrompt(layerLabel, styleKey, elementsText, 'full', false, designBrief)
              : buildProducerPromptLegacy(layerLabel, styleKey, elementsText, 'full', false, designBrief));
        sheets.push({
          key: f,
          label: layerLabel,
          prompt,
          compositeDataUrl: sheetInput,
          ...(protectMaskDataUrl ? { protectMaskDataUrl } : {}),
          ...(protectMaskDataUrl ? { useProtectMaskForEdit: false } : {}),
          showcase: authorityFlags.showcase,
          geometryLock: authorityFlags.geometryLock,
        });
      }
      // Record which keys used the showcase prompt AFTER the list is final, so the async finisher
      // softens exactly those (no boundary clip / burned labels over the model's own chrome).
      showcaseKeysRef.current = new Set(effectiveModelChrome ? sheets.map((s) => s.key) : []);
      if (sheets.length === 0) {
        setNotice(
          layerContentCount(renderState, renderRefLayers, 'zones') > 0
            ? t('designGlossyZonesDone')
            : t('designGlossyNothingToRender'),
        );
        setLoading(null);
        return;
      }
      const jobId = await enqueueRenderJob({ siteId: state.siteId, style: styleKey, engine: 'openai', sheets });
      persistJobId(state.siteId, jobId);
      setQueueJobId(jobId);
      setNotice(formatDesignTranslation(t('designGlossyBackgroundCount'), {
        count: sheets.length,
        sheets: t(sheets.length === 1 ? 'designGlossySheet' : 'designGlossySheets'),
      }));
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyCouldNotStart'));
      setLoading(null);
    }
  }, [producerStyle, state, frame, refLayers, site, placeName, finishStyledSheet, pushGallery, effectiveModelChrome, lockActive, promptRewrite]);

  // Single-sheet gpt-image-2 via the SAME background queue as "AI · ALL" (direct OpenAI). This is
  // what the per-sheet "Generate my … Blueprint" button routes to when gpt-image-2 is selected —
  // the OLD synchronous /api/image-producer path went through fal.ai, which 403s on an empty balance
  // and then silently fell back to a rate-limited Gemini ("Gemini error 429" even though gpt was
  // chosen). Renders only the currently-chosen layer; the subscription effect above finishes it into
  // the gallery. Zones is never routed here (it's satellite-only → produced deterministically in
  // generateProducer), so `filter` is always a model layer.
  const generateOneViaQueue = useCallback(async () => {
    const styleKey = producerStyle ?? DEFAULT_PRODUCER_STYLE;
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
    if (layerContentCount(state, refLayers, filter) === 0) {
      setError(emptyLayerMessage(filter, t));
      return;
    }
    setExactSheet(null);
    setError(null);
    setNotice(null);
    setLoading('falgpt');
    try {
      // Full Treatment's polish stage feeds on the FINISHED HYBRID sheet — the AI-painted
      // underlayer with our exact elements already locked back on top — stashed in hybridResultRef
      // by the queue-completion handler when the Hybrid stage finishes. It never rebuilds the bare
      // exact sheet here: sending the model something it never touched to "polish" is the exact bug
      // this two-stage rewrite exists to fix (Water's paid result used to look untouched because
      // there was nothing painted underneath for the polish pass to actually polish).
      const fullSheetPolish = lockedPolishStage === 'polish';
      if (fullSheetPolish && !hybridResultRef.current) {
        throw new Error('The AI hybrid sheet was not available to polish — please try again.');
      }
      const exactSheetInput = fullSheetPolish ? hybridResultRef.current : null;
      // Keep a SECOND reference to the same image, deliberately not consumed. The paid pass has to
      // be scored against what it was actually given, and hybridResultRef is nulled on the next
      // line so a stale hybrid can never leak into an unrelated render. Without this copy there is
      // nothing left to compare the paid result to, which is precisely why six attempts to fix
      // "the polished sheet looks identical to the hybrid" could each be signed off green: no code
      // in this app has ever looked at the output image.
      if (fullSheetPolish) polishInputRef.current = exactSheetInput;
      if (fullSheetPolish) hybridResultRef.current = null; // consume-once — never leaks into an unrelated render
      const presentation = await boundaryPresentationContext(state, frame, refLayers);
      const renderState = presentation.state;
      const renderFrame = presentation.frame;
      const renderRefLayers = presentation.refLayers;
      const mapW = renderFrame.imgW * SCALE;
      const mapH = renderFrame.imgH * SCALE;
      const composite = exactSheetInput ?? await buildComposite(
        renderState,
        renderFrame,
        renderRefLayers,
        filter,
        true,
        isModelChromeStyle(styleKey)
          ? OVERLAY_COMPOSITE_MARKS
          : lockActive
            ? polishModelInputMarks(filter)
            : undefined,
      );
      const { elements: elementsText, fabric, served } = isModelChromeStyle(styleKey)
        ? overlayElementsText(renderState, renderRefLayers, filter)
        : { elements: producerElementsText(renderState, renderRefLayers, filter, !lockActive), fabric: '' };
      const sheetInput = fullSheetPolish
        ? composite
        : isModelChromeStyle(styleKey)
        ? (await extendWithLegendPanel(composite, mapW, mapH)).dataUrl
        : composite;
      const designBrief = buildDesignBrief(renderState, renderRefLayers, placeName, site);
      const renderStage = fullSheetPolish ? 'full' : 'hybrid';
      const route = sheetRenderRoute({ filter }, renderStage, styleKey);
      // Workflow stage owns render authority. A visual style may change colour, texture and type,
      // but it must never silently turn Hybrid into an unlocked showcase or Full into Hybrid.
      const authorityFlags = fullSheetPolish
        ? route.polishFlags ?? { showcase: true, geometryLock: false }
        : route.hybridFlags ?? { showcase: false, geometryLock: true };
      const layerLabel = filter === 'all' ? 'Full design' : GLOSSY_FILTERS.find((x) => x.key === filter)?.label ?? 'Full design';
      // Showcase ("AI legend") mode now applies to WHATEVER sheet is selected — the model renders the
      // whole frame freely and draws its own legend + labels (the free-ChatGPT look), with NO boundary
      // clip and NO burned chrome. This is the only path that matches a raw ChatGPT render; the
      // composite-back path always seams the model art against the real satellite (visible edges,
      // occasional clipped roof). Zones included: when the toggle is on the farmer wants the pretty
      // model version, so we DON'T force the deterministic satellite-only sheet here.
      const useShowcase = effectiveModelChrome;
      // See generateAllViaQueue: this mask is a deterministic restoration contract, not an
      // OpenAI edit mask. That preserves the style reference and still restores protected pixels.
      let protectMaskDataUrl: string | undefined;
      if (fullSheetPolish) {
        // The second pass may improve the complete map artwork and sheet design. Restore only
        // genuinely factual geometry afterwards; protecting the Hybrid's unmarked ground, routes
        // and chrome made the paid result visually indistinguishable from Hybrid.
        const mapMask = await buildProtectMask(
          renderState,
          renderFrame,
          renderRefLayers,
          filter,
          fullTreatmentProtectPolicy(),
        );
        protectMaskDataUrl = await extendProtectMaskToStyleSheet(mapMask, mapW, mapH, false);
      } else if (authorityFlags.geometryLock) {
        protectMaskDataUrl = await buildProtectMask(
          renderState,
          renderFrame,
          renderRefLayers,
          filter,
          lockedProtectMaskOptions(filter),
        );
      }
      showcaseKeysRef.current = new Set(authorityFlags.showcase ? [filter] : []);
      const prompt = fullSheetPolish
        ? buildFinishedSheetPolishPrompt(layerLabel, styleKey, placeName)
        : isModelChromeStyle(styleKey)
        ? buildSatelliteOverlayPrompt({ layerLabel, stylePreset: styleKey, elementsText, fabric, served, systems: waterSystemsPresent(renderState), placeName, sheetKind: filter, hasDriveway: renderRefLayers.driveway.length >= 2 })
        : lockActive
        ? buildLockedIllustrationPrompt(layerLabel, styleKey, elementsText, designBrief)
        : useShowcase
          ? (promptRewrite
            ? buildShowcasePrompt(layerLabel, styleKey, elementsText, placeName ?? '', filter)
            : buildShowcasePromptLegacy(layerLabel, styleKey, elementsText, placeName ?? '', designBrief))
          : (promptRewrite
            ? buildProducerPrompt(layerLabel, styleKey, elementsText, 'full', false, designBrief)
            : buildProducerPromptLegacy(layerLabel, styleKey, elementsText, 'full', false, designBrief));
      const jobId = await enqueueRenderJob({
        siteId: state.siteId,
        style: styleKey,
        engine: 'openai',
        sheets: [{
          key: filter,
          label: layerLabel,
          prompt,
          compositeDataUrl: sheetInput,
          ...(protectMaskDataUrl ? { protectMaskDataUrl } : {}),
          ...(protectMaskDataUrl ? { useProtectMaskForEdit: false } : {}),
          showcase: authorityFlags.showcase,
          geometryLock: authorityFlags.geometryLock,
          resultKind: fullSheetPolish ? 'ai-polished' : 'hybrid',
        }],
      });
      persistJobId(state.siteId, jobId);
      setQueueJobId(jobId);
      setNotice(fullSheetPolish
        ? formatDesignTranslation(t('designGlossyFullPolishProgress'), {
          layer: layerLabel,
          style: styleDef.label,
        })
        : formatDesignTranslation(t('designGlossyBackgroundSheet'), { layer: layerLabel }));
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyCouldNotStart'));
      setLoading(null);
    }
  }, [producerStyle, state, frame, refLayers, site, placeName, filter, effectiveModelChrome, lockActive, promptRewrite, lockedPolishStage]);

  // Compatibility finisher for older queued Sector jobs, which contain a ground-only AI pass.
  // New paid Sector jobs persist showcase:true and return the model's complete polished sheet
  // directly; old in-flight jobs remain safe and still receive deterministic analysis geometry.
  const finishSectorSheet = useCallback(
    (modelImage: string): Promise<string> => composeSectorSheet(modelImage, state, frame, refLayers, site, placeName),
    [state, frame, refLayers, site, placeName],
  );

  // Finisher for BOTH Phasing (08) stages — Hybrid and Full Treatment polish. The model painted a
  // decorative background over the map area (and, for polish, over an already-blanked hybrid); this
  // composites every exact fact — ground, structures, boundary, phase pins, the real schedule panel
  // — back on top, regardless of which stage produced the input. Unlike every other sheet, Phasing's
  // polish stage does NOT ship the model's raw output (see handleSnapshot below): a build calendar
  // must never be AI-authored even under a well-worded polish prompt.
  const finishPhasingSheet = useCallback(
    (modelImage: string): Promise<string> => composePhasingSheet(modelImage, state, frame, refLayers, site, placeName),
    [state, frame, refLayers, site, placeName],
  );

  // Finisher for Site 01 Hybrid jobs (geometryLock:true). The model paints ground texture; this
  // composites the app's exact house, driveway and boundary back on top — the same "AI owns the
  // fabric, app owns the facts" contract every other sheet's Hybrid mode already enforces.
  // Mirrors buildBlueprintBaseMap's recipe: buildLockedStructureOverlay for source-pixel-derived
  // structures, then drawBlueprintBoundary for vector-exact boundary. Never touches geometry.
  const finishSiteSheet = useCallback(
    async (modelImage: string, styleKey: StylePreset): Promise<string> => {
      const presentation = await boundaryPresentationContext(state, frame, refLayers);
      const renderState = presentation.state;
      const renderFrame = presentation.frame;
      const renderRefLayers = presentation.refLayers;
      const W = renderFrame.imgW * SCALE;
      const H = renderFrame.imgH * SCALE;
      // Satellite photo is the source of truth for what the house/driveway pixels look like —
      // same source buildBlueprintBaseMap uses. Do not derive structure pixels from the AI output.
      const cleanSource = renderFrame.satDataUrl;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return modelImage; // fallback: ship the raw model image rather than nothing
      const px = (n: number) => n * W;
      const py = (n: number) => n * H;
      // Model's painted ground is the underlayer.
      ctx.drawImage(await loadImage(modelImage), 0, 0, W, H);
      // Exact existing ground, then house + driveway from source pixels. The AI is texture only:
      // it cannot turn a lawn, slab or terrace into a different saved feature.
      const exactGround = await buildExactLayerOverlay(
        renderState,
        renderFrame,
        renderRefLayers,
        'all',
        W,
        H,
        'ground',
      );
      if (exactGround) ctx.drawImage(await loadImage(exactGround), 0, 0, W, H);
      if (cleanSource) {
        const structureOverlay = await buildLockedStructureOverlay(
          cleanSource,
          renderState,
          renderFrame,
          renderRefLayers,
          W,
          H,
          styleKey,
        );
        if (structureOverlay) ctx.drawImage(await loadImage(structureOverlay), 0, 0, W, H);
      }
      // Property boundary — vector data, always exact regardless of what the model painted.
      drawBlueprintBoundary(ctx, renderRefLayers.boundary, px, py, W, renderState, renderFrame);
      // Ground-feature label pills (patio, lawn, veg garden, ...) — same call buildBlueprintBaseMap
      // makes on the exact sheet. Without this the Hybrid result had no labels at all (adversarial
      // review, 2026-07-25, noted this as an acknowledged follow-up rather than a safety gap).
      drawBlueprintLabelPills(ctx, groundLabelsForSheet(renderState, renderRefLayers, W, H));

      // Title, legend, north arrow and scale — the other half of "our exact elements locked back on
      // top" that every other sheet's Hybrid mode already delivers. Same legend-row recipe as
      // buildBlueprintBaseMap, so the exact sheet and this Hybrid sheet can never list different
      // ground features. styleLabel reflects the CHOSEN style (unlike the exact sheet, which is
      // always labelled "Reference Blueprint" since it has no style choice) — matching how every
      // other sheet's finishStyledSheet passes styleDef.label through to composeStyleSheet.
      const legendRows: StyleLegendRow[] = groundRows(renderState, renderRefLayers, 'all').map((row) => ({
        swatch: row.color,
        text: row.label,
        kind: 'ground',
      }));
      if (renderRefLayers.house.length >= 3) {
        legendRows.unshift({ swatch: '#3E4648', text: 'House / building', kind: 'surface' });
      }
      if (renderRefLayers.driveway.length >= 2) {
        legendRows.push({ swatch: '#5A5D57', text: 'Existing tarred driveway', kind: 'surface' });
      }
      if (renderRefLayers.boundary.length >= 3) {
        legendRows.push({ swatch: BOUNDARY_BONE, text: 'Property boundary', lineKind: 'fence' });
      }
      const styleLabel = PRODUCER_STYLES.find((s) => s.key === styleKey)?.label ?? 'AI Hybrid';

      return composeStyleSheet(
        canvas.toDataURL('image/png'),
        renderState,
        renderFrame,
        renderRefLayers,
        'all',
        placeName,
        styleLabel,
        'Existing Site',
        false,
        true,
        { sheetNumber: '01', legendRows },
      );
    },
    [frame, refLayers, state, placeName],
  );

  // Sector's paid path starts with the complete deterministic sheet, not a bare aerial. This makes
  // the second result a visibly AI-authored page while Step 1 remains the separately saved exact
  // authority. Site 01 retains its ground-only restyle route.
  const generateSectorViaQueue = useCallback(async (kind: 'sector' | 'base' = 'sector') => {
    const styleKey = lockedPolishStyle(producerStyle, DEFAULT_PRODUCER_STYLE);
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
    setError(null);
    setNotice(null);
    setLoading('falgpt');
    try {
      // Same two-stage contract as generateOneViaQueue: the polish stage feeds on the FINISHED
      // Hybrid sheet stashed in hybridResultRef, never a rebuilt ground-only composite — Sector
      // used to send composeSectorSheet(null,...) (nothing painted yet) straight to the polish
      // prompt, the same "polish an empty page" bug the 5-sheet path had.
      const polishStage = lockedPolishStage === 'polish';
      if (polishStage && !hybridResultRef.current) {
        throw new Error('The AI hybrid sheet was not available to polish — please try again.');
      }
      const hybridInput = polishStage ? hybridResultRef.current : null;
      if (polishStage) hybridResultRef.current = null; // consume-once
      // MEASURE THIS PAID PASS TOO. The difference gate exists because a polish pass that returned
      // its own input verbatim cleared every other check and was still stored, labelled "AI
      // polished", and charged for. It was wired into generateOneViaQueue only, so the three
      // analysis sheets — Site, Sector and Phasing — kept paying for an unverified pass on exactly
      // the sheets where the app redraws the most on top and a near-copy is hardest to spot.
      if (polishStage) polishInputRef.current = hybridInput;
      const presentation = await boundaryPresentationContext(state, frame, refLayers);
      const renderFrame = presentation.frame;
      const mapWidth = renderFrame.imgW * SCALE;
      const mapHeight = renderFrame.imgH * SCALE;
      // Hybrid starts with map-only imagery. Feeding composeSectorSheet's complete page into a
      // map-space finisher made the model's legend and title shrink into the map panel. Full
      // Treatment may receive the finished Hybrid page, but its returned page is cropped back to
      // the map panel before the same deterministic finisher restores every factual layer.
      const composite = hybridInput
        ?? renderFrame.satDataUrl
        ?? await buildComposite(
          presentation.state,
          renderFrame,
          presentation.refLayers,
          'all',
          false,
        );
      const sectorMapMask = kind === 'sector'
        ? await buildProtectMask(
          presentation.state,
          renderFrame,
          presentation.refLayers,
          'all',
          sectorProtectMaskOptions(),
        )
        : undefined;
      const protectMaskDataUrl = sectorMapMask && polishStage
        ? await extendProtectMaskToStyleSheet(sectorMapMask, mapWidth, mapHeight, false)
        : sectorMapMask;
      const prompt = polishStage
        ? kind === 'sector'
          ? buildSectorSheetPolishPrompt(styleKey, placeName)
          : buildFinishedSheetPolishPrompt('Existing Site', styleKey, placeName)
        : buildSectorRestylePrompt(styleKey, placeName);
      const jobId = await enqueueRenderJob({
        siteId: state.siteId,
        style: styleKey,
        engine: 'openai',
        sheets: [{
          key: kind,
          label: kind === 'sector' ? 'Sector analysis' : 'Existing site',
          prompt,
          compositeDataUrl: composite,
          ...(protectMaskDataUrl ? { protectMaskDataUrl, useProtectMaskForEdit: false } : {}),
          // showcase:true on the polish stage means the model owns the already-complete polished
          // page — the finisher must not redraw the hybrid analysis over it. The hybrid stage is
          // now genuinely geometry-locked (composeSectorSheet(modelImage,...) composites our own
          // bearings/legend/labels back on top), so it earns resultKind:'hybrid', not 'legacy'.
          showcase: polishStage,
          geometryLock: !polishStage,
          resultKind: polishStage ? 'ai-polished' : 'hybrid',
        }],
      });
      persistJobId(state.siteId, jobId);
      setQueueJobId(jobId);
      setNotice(polishStage
        ? formatDesignTranslation(t('designGlossySectorPolishProgress'), {
          sheet: kind === 'sector' ? 'Sector Analysis' : 'Existing Site',
        })
        : kind === 'sector'
          ? t('designGlossySectorHybrid')
          : t('designGlossyBaseHybrid'));
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyCouldNotStart'));
      setLoading(null);
    }
  }, [producerStyle, state, frame, refLayers, site, placeName, lockedPolishStage]);

  // Phasing (08) AI Hybrid + Full Treatment — mirrors generateSectorViaQueue's two-stage pattern.
  //
  // Hybrid stage:  build a redacted input (schedule panel BLANKED), build a protect mask covering
  //                the ENTIRE panel, send to gpt-image-2. The model paints the map area only.
  //                On completion, composePhasingSheet (via finishPhasingRef) draws the REAL
  //                schedule panel back on top. showcase:false, geometryLock:true.
  //
  // Polish stage:  takes hybridResultRef.current (the finished hybrid, WITH the real schedule
  //                already composited on top by the Hybrid stage) and re-blanks the same panel
  //                region via blankPhasingPanel BEFORE sending it to buildFinishedSheetPolishPrompt.
  //                showcase:true (model owns the complete polished page) but geometryLock:false,
  //                exactly like every other sheet's polish stage — those two flags can never both be
  //                true (enqueueRenderJob's hasConflictingRenderAuthority rejects the job outright;
  //                an earlier version of this code set geometryLock:true here and broke Full
  //                Treatment entirely — adversarial review, 2026-07-25). Unlike every other sheet,
  //                the real schedule is NEVER visible to the model at this stage either — this is a
  //                deliberate departure from "the polish step receives the complete finished sheet",
  //                because a build calendar must never be AI-authored even under a well-worded
  //                prompt-only instruction not to touch it.
  //
  // SAFETY NOTE: neither stage's protect mask is actually enforced by the OpenAI edit call itself
  // (useProtectMaskForEdit is false here, same as every other sheet's mask — see
  // buildPhasingProtectMask's own comment). The real, load-bearing guarantee is two-fold: the model
  // is never shown real schedule text in the first place (blankPhasingPanel, both stages), and
  // finishPhasingRef's composePhasingSheet redraws every exact fact back on top of whatever the
  // model returns, regardless of stage. The saved exact master is the authority in every case.
  const generatePhasingViaQueue = useCallback(async () => {
    const styleKey = lockedPolishStyle(producerStyle, DEFAULT_PRODUCER_STYLE);
    const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
    if (!styleDef) return;
    setError(null);
    setNotice(null);
    setLoading('falgpt');
    try {
      // Same consume-once stash contract as generateOneViaQueue / generateSectorViaQueue.
      const polishStage = lockedPolishStage === 'polish';
      if (polishStage && !hybridResultRef.current) {
        throw new Error('The AI hybrid sheet was not available to polish — please try again.');
      }
      let hybridInput = polishStage ? hybridResultRef.current : null;
      if (polishStage) hybridResultRef.current = null; // consume-once
      // Baseline for the paid-difference gate — captured BEFORE blankPhasingPanel below. Comparing
      // against the blanked image would score the app's own redraw of the schedule panel as the
      // model's work, so a verbatim copy would pass as "redrawn" and the gate would be worse than
      // absent: it would actively certify the failure it was built to catch.
      if (polishStage) polishInputRef.current = hybridInput;

      // Full Treatment's polish stage must NEVER see the real schedule text either — not just the
      // Hybrid stage. hybridInput here is the Hybrid stage's own FINISHED sheet (composePhasingSheet
      // already composited the real panel back onto it), so re-blank the same panel region before
      // sending it on. Without this, the model saw dates/tasks/hold-points with only
      // buildFinishedSheetPolishPrompt's generic wording asking it not to touch them — exactly the
      // prompt-only protection this sheet was built to avoid (adversarial review, 2026-07-25).
      if (polishStage && hybridInput) {
        // The hybrid sheet was rendered at the boundary-framed size, so blank at that size — the
        // raw frame would clear a rectangle that is no longer where the panel sits.
        hybridInput = await blankPhasingPanel(hybridInput, phasingSheetSize(frame, refLayers));
      }

      const compositeDataUrl = hybridInput ?? await buildPhasingHybridInput(state, frame, refLayers, site, placeName);
      const protectMaskDataUrl = polishStage ? undefined : buildPhasingProtectMask(frame, refLayers);

      const prompt = polishStage
        ? buildFinishedSheetPolishPrompt('Implementation & Phasing', styleKey, placeName)
        : buildPhasingRestylePrompt(styleKey, placeName);

      const jobId = await enqueueRenderJob({
        siteId: state.siteId,
        style: styleKey,
        engine: 'openai',
        sheets: [{
          key: 'implementation',
          label: 'Implementation & Phasing',
          prompt,
          compositeDataUrl,
          ...(protectMaskDataUrl ? { protectMaskDataUrl } : {}),
          ...(protectMaskDataUrl ? { useProtectMaskForEdit: false } : {}),
          // geometryLock:true + showcase:true is a REJECTED combination — enqueueRenderJob's
          // hasConflictingRenderAuthority throws before anything uploads (adversarial review,
          // 2026-07-25, caught this as a live regression: an earlier version of this fix set both
          // true, which meant Full Treatment could never even start). geometryLock therefore stays
          // false on the polish stage exactly like every other sheet — but unlike every other sheet,
          // Phasing's actual safety does NOT come from that flag or from trusting the polish prompt:
          // it comes structurally from blankPhasingPanel (the model is never shown real schedule
          // text, at either stage) and composePhasingSheet (every exact fact is redrawn on top of
          // whatever the model returns, at either stage, regardless of showcase/geometryLock). The
          // "Geometry locked" gallery badge simply won't show on the polish result; that's cosmetic,
          // not a safety gap.
          showcase: polishStage,
          geometryLock: !polishStage,
          resultKind: polishStage ? 'ai-polished' : 'hybrid',
        }],
      });
      persistJobId(state.siteId, jobId);
      setQueueJobId(jobId);
      setNotice(polishStage
        ? t('designGlossyPhasingPolish')
        : t('designGlossyPhasingHybrid'));
    } catch (err) {
      refreshPendingRef.current = false;
      setError(err instanceof Error ? err.message : t('designGlossyCouldNotStart'));
      setLoading(null);
    }
  }, [producerStyle, state, frame, refLayers, site, placeName, lockedPolishStage]);

  // One explicit rerun path for the visible refresh button and the main CTA.
  const runCurrentSheet = useCallback(() => {
    // Cross-check against the single routing authority (lib/sheet-render-route.ts): the dispatch
    // below must never independently drift from what sheetRenderRoute computes for the SAME
    // sheet+style — the exact drift pattern that has bitten repeatedly (see that file's header,
    // commit e0bf17a). Never throws — a disagreement is logged, not fatal, so a real mismatch is
    // caught in dev/tests without ever taking down a live render.
    //
    // Two branches below are DELIBERATELY outside sheetRenderRoute's model (its SheetRoutePath has
    // no slot for them) and are skipped rather than flagged: the Gemini analysis-map path
    // (analysisStyle — not one of the 3 farmer-facing output modes sheetRenderRoute knows about at
    // all) and the direct non-queue /api/image-producer path (engine 'gemini' + no lock + a
    // non-chrome style — the acknowledged secondary route the comment below explains).
    if (selectedSheet) {
      const spec: SheetSpec = 'exact' in selectedSheet ? { exact: selectedSheet.exact } : { filter: selectedSheet.filter };
      // runCurrentSheet's own state never distinguishes 'hybrid' from 'full' — both dispatch to the
      // identical branch below; the hybrid-stage-vs-polish-stage split happens INSIDE the queue
      // functions via lockedPolishStage. 'hybrid' is a faithful stand-in for PATH comparison:
      // sheetRenderRoute returns the same path for 'hybrid' and 'full'.
      const outputMode: SheetOutputMode = isExactRender ? 'exact' : 'hybrid';
      const route = sheetRenderRoute(spec, outputMode, producerStyle);
      const viaQueue = !producerStyle || engine === 'falgpt' || geometryLock || isModelChromeStyle(producerStyle);
      const actual: SheetRoutePath | null =
        exactSheet === 'base' ? 'render-base'
        : exactSheet === 'sector' ? 'render-sector'
        : exactSheet === 'implementation' ? 'render-implementation'
        : phasingAiMode ? 'phasing-queue'
        : restyleAiKind ? 'sector-queue'
        : producerStyle ? (viaQueue ? 'one-via-queue' : null)
        : analysisStyle ? null
        : 'render-design-map';
      if (actual !== null && actual !== route.path) {
        console.error('[glossy] sheet-render-route disagreement — runCurrentSheet is about to take a different path than sheetRenderRoute computed', { spec, outputMode, computedPath: route.path, actualPath: actual });
      }
    }
    if (exactSheet === 'base') return renderBaseMap();
    if (exactSheet === 'sector') return renderSectorMap();
    if (exactSheet === 'implementation') return renderImplementationMap();
    // phasingAiMode implies producerStyle is truthy (applySheet seeds it), and must come BEFORE
    // the generic `if (producerStyle)` branch — otherwise Phasing AI would fall through into
    // generateOneViaQueue/generateProducer (wrong: those are for GlossyLayerFilter sheets only).
    if (phasingAiMode) return generatePhasingViaQueue();
    // sectorAiMode implies producerStyle is truthy (applySheet seeds it), so this must come BEFORE
    // the generic `if (producerStyle)` branch below — otherwise every AI-sector run would fall
    // through into generateOneViaQueue/generateProducer with whichever GlossyLayerFilter `filter`
    // last held, i.e. it would render the wrong sheet (e.g. re-render "Whole design").
    if (restyleAiKind) return generateSectorViaQueue(restyleAiKind);
    if (producerStyle) {
      // Geometry Lock only EXISTS on the queue path: /api/image-producer accepts no protect mask
      // and generateProducer sends the unlocked prompt, so running a locked sheet there tells the
      // model to paint every feature while the browser also draws the deterministic overlay —
      // duplicated tanks and pipes, the exact thing the lock is meant to prevent. Keep the lock on
      // the one path that implements it.
      // Satellite Overlay is queue-only for the same reason: generateProducer always clips to the
      // boundary and burns our own labels, which would crop the model's legend panel clean off.
      return engine === 'falgpt' || geometryLock || isModelChromeStyle(producerStyle)
        ? generateOneViaQueue()
        : generateProducer();
    }
    if (analysisStyle) return generate('gemini');
    return renderDesignMap();
  }, [exactSheet, restyleAiKind, phasingAiMode, producerStyle, engine, geometryLock, analysisStyle, selectedSheet, isExactRender, renderBaseMap, renderSectorMap, renderImplementationMap, generatePhasingViaQueue, generateSectorViaQueue, generateOneViaQueue, generateProducer, generate, renderDesignMap]);

  // Direct Step 1 button. If this sheet is already in exact mode, redraw immediately. Otherwise,
  // wait for React to switch the generator selection and then run the deterministic renderer.
  // This removes the old "pick a mode, then find the Generate button" two-click workflow.
  useEffect(() => {
    const action = lockedPolishAction({
      outputMode: polishAfterHybridRef.current ? 'full' : 'hybrid',
      exactFlipPending: exactAfterFlipRef.current,
      hybridAfterExactPending: hybridAfterExactRef.current,
      hybridFlipPending: hybridAfterFlipRef.current,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode,
      isExactRender,
      loading: loading !== null,
      hasResult: resultImage !== null,
    });
    if (action !== 'render-exact') return;
    exactAfterFlipRef.current = false;
    setNotice(hybridAfterExactRef.current
      ? formatDesignTranslation(t('designGlossySavingExact'), {
        total: polishAfterHybridRef.current ? 3 : 2,
      })
      : t('designGlossyBuildingExact'));
    void runCurrentSheet();
  }, [mode, isExactRender, loading, resultImage, selectedNo, runCurrentSheet]);

  // The primary guided flow always saves an exact master before spending any AI render, then
  // moves to the selected AI style so the next effect can enqueue the real Hybrid pass — an
  // AI-painted underlayer with our own exact elements composited back on top, never a rebuilt
  // exact sheet with nothing painted for a later polish step to actually polish.
  useEffect(() => {
    const action = lockedPolishAction({
      outputMode: polishAfterHybridRef.current ? 'full' : 'hybrid',
      exactFlipPending: exactAfterFlipRef.current,
      hybridAfterExactPending: hybridAfterExactRef.current,
      hybridFlipPending: hybridAfterFlipRef.current,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode,
      isExactRender,
      loading: loading !== null,
      hasResult: resultImage !== null,
    });
    if (action !== 'switch-to-hybrid') return;
    hybridAfterExactRef.current = false;
    hybridAfterFlipRef.current = true;
    setLockedPolishStage('hybrid');
    setNotice(formatDesignTranslation(t('designGlossyPaintingHybrid'), {
      total: polishAfterHybridRef.current ? 3 : 2,
    }));
    setMode('ai');
    if (selectedSheet) {
      applySheet(selectedSheet, 'ai');
      setProducerStyle(polishStyleRef.current);
    }
    setResultImage(null);
  }, [mode, isExactRender, loading, resultImage, selectedSheet, applySheet]);

  // Direct Step-2 trigger. The exact result remains in the gallery; after React has switched this
  // same sheet into its locked AI mode, start the existing queue path automatically. That path
  // uses the deterministic composite as the factual input and restores protected geometry after
  // generation, so this is a child illustration rather than a replacement of the master.
  useEffect(() => {
    const action = lockedPolishAction({
      outputMode: polishAfterHybridRef.current ? 'full' : 'hybrid',
      exactFlipPending: exactAfterFlipRef.current,
      hybridAfterExactPending: hybridAfterExactRef.current,
      hybridFlipPending: hybridAfterFlipRef.current,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode,
      isExactRender,
      loading: loading !== null,
      hasResult: resultImage !== null,
    });
    if (action !== 'render-hybrid') return;
    hybridAfterFlipRef.current = false;
    setNotice(t('designGlossyPreparingHybrid'));
    void runCurrentSheet();
  }, [mode, isExactRender, loading, resultImage, selectedNo, producerStyle, restyleAiKind, phasingAiMode, runCurrentSheet]);

  // Full Treatment only: once the Hybrid stage has actually finished and its image is stashed in
  // hybridResultRef (see the queue-completion handler), advance once more into the polish stage —
  // still mode 'ai', so no mode flip is needed, just a fresh render pass over the SAME sheet.
  useEffect(() => {
    const action = lockedPolishAction({
      outputMode: polishAfterHybridRef.current ? 'full' : 'hybrid',
      exactFlipPending: exactAfterFlipRef.current,
      hybridAfterExactPending: hybridAfterExactRef.current,
      hybridFlipPending: hybridAfterFlipRef.current,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode,
      isExactRender,
      loading: loading !== null,
      hasResult: resultImage !== null,
    });
    if (action !== 'switch-to-polish') return;
    if (!hybridResultRef.current) {
      // The Hybrid stage finished but nothing was stashed — a real bug, not a transient state.
      // Never silently fall back to polishing the bare exact sheet again (the exact bug this
      // whole rewrite exists to remove); surface it and stop the guided flow instead.
      setError(t('designGlossyMissingHybrid'));
      polishAfterHybridRef.current = false;
      setLockedPolishStage(null);
      return;
    }
    polishAfterHybridRef.current = false;
    polishAfterFlipRef.current = true;
    setLockedPolishStage('polish');
    setNotice(t('designGlossyStartingPolish'));
    setResultImage(null);
  }, [mode, isExactRender, loading, resultImage]);

  useEffect(() => {
    const action = lockedPolishAction({
      outputMode: polishAfterHybridRef.current ? 'full' : 'hybrid',
      exactFlipPending: exactAfterFlipRef.current,
      hybridAfterExactPending: hybridAfterExactRef.current,
      hybridFlipPending: hybridAfterFlipRef.current,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode,
      isExactRender,
      loading: loading !== null,
      hasResult: resultImage !== null,
    });
    if (action !== 'render-polish') return;
    polishAfterFlipRef.current = false;
    setNotice(t('designGlossyPolishing'));
    void runCurrentSheet();
  }, [mode, isExactRender, loading, resultImage, selectedNo, producerStyle, restyleAiKind, phasingAiMode, runCurrentSheet]);

  useEffect(() => {
    if (!error || loading !== null) return;
    exactAfterFlipRef.current = false;
    hybridAfterExactRef.current = false;
    hybridAfterFlipRef.current = false;
    polishAfterHybridRef.current = false;
    polishAfterFlipRef.current = false;
    hybridResultRef.current = null;
    setLockedPolishStage(null);
  }, [error, loading]);

  const runExactStep = useCallback(() => {
    if (!selectedSheet || loading !== null) return;
    setError(null);
    setNotice(null);
    if (mode === 'exact' && isExactRender) {
      void runCurrentSheet();
      return;
    }
    exactAfterFlipRef.current = true;
    setMode('exact');
    applySheet(selectedSheet, 'exact');
    setResultImage(null);
  }, [selectedSheet, loading, mode, isExactRender, runCurrentSheet, applySheet]);

  // Drives both the Hybrid and Full Treatment guided flows — they share every stage up to and
  // including Hybrid; Full Treatment alone continues into the polish stage afterward.
  // Phasing (08) is now included: at BOTH the Hybrid and the polish stage, the model is shown a
  // blanked panel (buildPhasingHybridInput / blankPhasingPanel) — never any date, task or hold
  // point — and the real schedule composites back on top afterward via composePhasingSheet,
  // regardless of stage. The previous early-return for Phasing is intentionally removed — see
  // generatePhasingViaQueue for the full safety architecture that makes this safe.
  const runLockedPolishFlow = useCallback((targetMode: Extract<SheetOutputMode, 'hybrid' | 'full'>) => {
    if (!selectedSheet || loading !== null) return;
    setError(null);
    const totalSteps = targetMode === 'full' ? 3 : 2;
    polishStyleRef.current = lockedPolishStyle(producerStyle, DEFAULT_PRODUCER_STYLE);
    setNotice(formatDesignTranslation(t('designGlossySavingExact'), { total: totalSteps }));
    setLockedPolishStage('exact');
    hybridAfterExactRef.current = true;
    polishAfterHybridRef.current = targetMode === 'full';
    hybridResultRef.current = null;
    // Clear the last run's "the polish pass returned the same map" note. Leaving it up over a fresh
    // render would read as a verdict on THIS attempt before it has produced anything.
    polishInputRef.current = null;
    setPolishNoChange(null);
    setResultImage(null);
    if (mode === 'exact' && isExactRender) {
      void runCurrentSheet();
      return;
    }
    exactAfterFlipRef.current = true;
    setMode('exact');
    applySheet(selectedSheet, 'exact');
  }, [selectedSheet, loading, mode, isExactRender, producerStyle, runCurrentSheet, applySheet]);

  // User-facing refresh action. Give immediate feedback, then kick the rerun off on the next
  // tick so the UI has a chance to paint the "refreshing" state before the work starts.
  const refreshCurrentSheet = useCallback(() => {
    if (loading !== null) return;
    setError(null);
    refreshPendingRef.current = true;
    setNotice(t('designGlossyRefreshing'));
    setTimeout(() => {
      void runCurrentSheet();
    }, 0);
  }, [loading, runCurrentSheet]);

  // Refs so the subscription effect below doesn't re-subscribe on every design edit.
  const finishRef = useRef(finishStyledSheet);
  finishRef.current = finishStyledSheet;
  const styleRef = useRef(producerStyle);
  styleRef.current = producerStyle;
  const finishSectorRef = useRef(finishSectorSheet);
  finishSectorRef.current = finishSectorSheet;
  const finishPhasingRef = useRef(finishPhasingSheet);
  finishPhasingRef.current = finishPhasingSheet;
  const finishSiteRef = useRef(finishSiteSheet);
  finishSiteRef.current = finishSiteSheet;

  // Stream the active job; finish each sheet as it completes; clear on a terminal status.
  useEffect(() => {
    if (!queueJobId) return;
    const siteId = state.siteId;
    const finished = new Set<string>();
    // A sheet only counts as delivered once the BROWSER has assembled and stored it. The worker
    // saying "done" is not enough: the locked path adds two more downloads plus canvas work, and
    // a failure there used to be swallowed while the user still got the green success notice with
    // an unchanged preview — the "Refresh does nothing" report.
    const assembled = new Set<string>();
    // A measured copy/filter-only return is neither assembled nor an assembly failure. Keep it
    // separate so the terminal snapshot does not replace the honest paid-pass warning with the
    // generic "could not assemble" error merely because we deliberately refused to save it.
    const rejected = new Set<string>();
    let lockedAssembled = 0;
    let lastAssembledGalleryId: string | null = null;
    let lastAssembleError = '';
    // Snapshots must be handled ONE AT A TIME. Assembling a sheet takes seconds (two downloads plus
    // canvas work) while `finished` is marked synchronously, so an unserialised handler lets the
    // terminal "complete" snapshot overtake an in-flight assembly: it skips the sheet as already
    // handled, sees nothing assembled yet, and reports a failure for a render that was fine.
    let queue: Promise<void> = Promise.resolve();
    const unsub = subscribeRenderJob(
      queueJobId,
      (job) => {
        queue = queue.then(() => handleSnapshot(job)).catch((e) => {
          console.error('[glossy] render-job snapshot handler failed', e);
        });
      },
      () => {
        // Clear the job reference too — leaving it made the next Generate silently orphan a
        // still-running, still-billed render (audit find). The old job may still finish
        // server-side; its outputs land in the cache for this site if the user reopens.
        setError(t('designGlossyLostConnection'));
        setLockedPolishStage(null);
        setLoading(null);
        clearPersistedJobId(siteId);
        setQueueJobId(null);
      },
    );

    async function handleSnapshot(job: Parameters<Parameters<typeof subscribeRenderJob>[1]>[0]): Promise<void> {
      {
        if (!job) {
          // A TTL-deleted or malformed durable job must not leave this design permanently attached
          // to a queue entry it can never finish. Clear the persisted pointer so Generate works.
          setError(t('designGlossyRenderIncomplete'));
          setLockedPolishStage(null);
          setLoading(null);
          clearPersistedJobId(siteId);
          setQueueJobId(null);
          return;
        }
        // Style + showcase come off the JOB DOC, not React state: a remount (Preview-map hop,
        // reload on a spotty connection) resets local state to defaults, and the old code then
        // finished a Storybook/showcase job as strict Extension Blueprint (audit must-fix).
        // showcaseKeysRef stays as fallback for jobs enqueued before the field existed.
        const styleKey = ((job.style || styleRef.current) ?? 'extension_blueprint') as StylePreset;
        const styleDef = PRODUCER_STYLES.find((s) => s.key === styleKey);
        for (const sheet of job.sheets) {
          if (sheet.status === 'done' && sheet.outputPath && !finished.has(sheet.key)) {
            finished.add(sheet.key); // BEFORE the await, so a re-fired snapshot can't double-finish
            try {
              const raw = await fetchRenderOutput(sheet.outputPath);
              const showcase = sheet.showcase ?? showcaseKeysRef.current.has(sheet.key);
              // Jobs can finish after a navigation or reload. Use the flag persisted with the
              // sheet, never the current toggle value. Existing in-flight jobs created before the
              // flag was added remain locked when they contain a protect mask.
              const locked = sheet.geometryLock ?? Boolean(sheet.protectMaskPath);
              const queuedResultKind = sheet.resultKind
                ?? (showcase ? 'ai-polished' : locked ? 'hybrid' : 'legacy-ai');
              const isHybridResult = queuedResultKind === 'hybrid';
              const isPolishedResult = queuedResultKind === 'ai-polished';
              // Fetch on the MASK's existence, not on `locked`. Satellite Overlay persists
              // geometryLock:false (it is not a locked style) but still ships a roof mask, and
              // gating on `locked` silently skipped the restore that keeps its roof intact.
              // Hybrid scoring compares the bytes sent TO the model with the bytes returned BY it,
              // before any exact geometry/chrome is composited back. Fetch the input even when
              // there is no mask; after a reload this Storage object is the only durable baseline.
              const sourceImage = (isHybridResult || sheet.protectMaskPath)
                ? await fetchRenderOutput(sheet.inputPath)
                : undefined;
              const protectMask = sheet.protectMaskPath ? await fetchRenderOutput(sheet.protectMaskPath) : undefined;
              if (isHybridResult && sourceImage) {
                try {
                  const diff = await measureRenderDifference(sourceImage, raw, protectMask);
                  const decision = paidRenderDecision(diff, 'hybrid');
                  console.info('[glossy] paid hybrid difference', sheet.key, diff);
                  if (!decision.keep) {
                    rejected.add(sheet.key);
                    setPolishNoChange(decision.message);
                    // Full Treatment must not advance to polish a Hybrid the gate just proved was
                    // unchanged. Hybrid-only stops here for the same reason: no AI result exists
                    // to present, save, or label.
                    polishAfterHybridRef.current = false;
                    hybridResultRef.current = null;
                    setLockedPolishStage(null);
                    continue;
                  }
                } catch (err) {
                  // Scoring is diagnostic, never a new failure mode. If pixels cannot be measured,
                  // finish and keep the paid result exactly as before.
                  console.warn('[glossy] could not score the paid hybrid — keeping it', err);
                }
              }
              // finishStyledSheet's zone/water-overlay branches and producerLabels() call are
              // meaningless for a sheet with no GlossyLayerFilter — `sheet.key as GlossyLayerFilter`
              // becomes a lie the moment 'sector' can reach this code (RENDER-INVESTIGATION.md
              // 'sector-ai' finding 3), so route it to the dedicated finisher instead of casting.
              // 'base' and 'sector': both stages finish deterministically. Full Treatment may return
              // a complete page, so first extract its map panel; then restore the app-owned house,
              // ground, boundary, analysis marks, labels and chrome. No paid result is trusted as
              // factual merely because its prompt asked the model not to move anything.
              // 'implementation' (Phasing 08): BOTH stages route to finishPhasingRef, unlike every
              // other sheet's showcase:true branch. The polish stage never earns a "ship raw" exit
              // here — a build calendar's dates/tasks/hold-points must never be AI-authored, so
              // finishPhasingRef's composePhasingSheet always redraws the real schedule panel and
              // every exact fact (ground, structures, boundary, phase pins) back on top, regardless
              // of which stage produced the model's decorative background underneath it.
              let factualModelImage = raw;
              if (sheet.key === 'sector' && sourceImage && protectMask) {
                try {
                  factualModelImage = await restoreProtectedPixels(sourceImage, raw, protectMask);
                } catch (restoreError) {
                  console.error('[glossy] Sector protected-pixel restore failed; using factual source', restoreError);
                  factualModelImage = sourceImage;
                }
              }
              if (showcase && (sheet.key === 'sector' || sheet.key === 'base')) {
                const presentation = await boundaryPresentationContext(state, frame, refLayers);
                factualModelImage = await cropStyleSheetToMap(
                  factualModelImage,
                  presentation.frame.imgW * SCALE,
                  presentation.frame.imgH * SCALE,
                );
              }
              const finalSheet = sheet.key === 'implementation'
                ? await finishPhasingRef.current(raw)
                : sheet.key === 'sector'
                ? await finishSectorRef.current(factualModelImage)
                : sheet.key === 'base'
                ? await finishSiteRef.current(factualModelImage, styleKey)
                : styleDef
                  ? await finishRef.current(raw, sheet.key as GlossyLayerFilter, styleDef, showcase, sourceImage, protectMask, locked)
                  : raw;
              const finalGeometryLocked = locked
                || sheet.key === 'implementation'
                || sheet.key === 'sector'
                || sheet.key === 'base'
                || (showcase && Boolean(protectMask));
              // Full Treatment only: this completion IS the Hybrid stage — stash its finished image
              // so the polish stage (generateOneViaQueue's 'polish' branch) has something genuinely
              // painted to poish, instead of silently falling back to the bare exact sheet again.
              // Gated on the ref, not on `showcase`/`locked` alone, so an unrelated Hybrid-only or
              // batch render can never be mistaken for the one this flow is actually waiting on.
              if (polishAfterHybridRef.current && isHybridResult) {
                hybridResultRef.current = finalSheet;
              }
              // ── Did the paid pass actually redraw anything? ──────────────────────────────────
              // Rory paid for Full Treatment again and again and got back the picture he already
              // had. Six commits over two days were reported as fixing it, each with a green suite,
              // because until now no code in this app had ever looked at the output image. A pass
              // that returned its own input verbatim cleared every existing check — the restore
              // verifier only confirms that protected pixels came back, which a copy satisfies
              // perfectly — and was then stored, labelled "AI polished", and charged for.
              //
              // Protected pixels are excluded from the score. fullTreatmentProtectPolicy restores
              // the boundary, driveway, house halo and everything outside the plot byte-for-byte,
              // which on a cropped frame is roughly a third of the sheet; counting that guaranteed
              // -identical region would drag an honest render toward "unchanged" and make this gate
              // useless exactly where it matters.
              //
              // Scoring never blocks a good render: any failure here is swallowed and the sheet
              // ships. A measurement that can reject work it cannot measure is worse than none.
              let polishRejected = false;
              if (isPolishedResult && polishInputRef.current) {
                try {
                  const diff = await measureRenderDifference(polishInputRef.current, finalSheet, protectMask);
                  const decision = paidRenderDecision(diff, 'polish');
                  console.info('[glossy] paid polish difference', sheet.key, diff);
                  if (!decision.keep) {
                    polishRejected = true;
                    setPolishNoChange(decision.message);
                  }
                } catch (err) {
                  console.warn('[glossy] could not score the paid polish — keeping it', err);
                }
                polishInputRef.current = null;
              }
              if (polishRejected) {
                // Keep the Hybrid on screen and add nothing to the gallery. A third near-identical
                // thumbnail is exactly what made the gallery unreadable, and presenting a copy as a
                // paid result is the app claiming something it did not get.
                setLockedPolishStage(null);
                rejected.add(sheet.key);
                continue;
              }
              const record: SavedGlossy = { image: finalSheet, provider: 'falgpt', at: new Date().toISOString() };
              try { saveGlossy(siteId, `producer:${styleKey}:${sheet.key}`, record); } catch { /* cache full */ }
              // A one-sheet refresh must update the actual preview, not only append a gallery
              // thumbnail, but only while its original target remains open. Batch jobs still
              // collect every sheet without flickering the preview.
              const targetMapKey = `producer:${styleKey}:${sheet.key}`;
              if (job.sheets.length === 1) {
                // Full Treatment: leave lockedPolishStage set (still 'hybrid') so the progress
                // panel doesn't blink to nothing between this stage finishing and the polish stage's
                // own switch-to-polish effect setting it to 'polish' a moment later.
                if (!(polishAfterHybridRef.current && isHybridResult)) setLockedPolishStage(null);
                if (job.siteId === state.siteId && mapKeyRef.current === targetMapKey) {
                  setResultImage(finalSheet);
                  setSaved(record);
                }
              }
              const finishLabel = styleDef?.label ? ` · ${styleDef.label}` : '';
              // Label text must track resultKind, not always say "AI polished" — a Hybrid-only save
              // (mode 2, stops there) is genuinely AI-touched but is not a paid polish pass (mode 3).
              const finishKindLabel = isPolishedResult ? 'AI polished' : isHybridResult ? 'AI hybrid' : 'AI (legacy)';
              lastAssembledGalleryId = pushGallery(
                `${sheet.label}${finishLabel} · ${finishKindLabel}${finalGeometryLocked ? ' · Geometry locked' : ''}`,
                finalSheet,
                {
                  // showcase:false + locked:false is only reachable for a pre-flag legacy job (see
                  // the comment on showcaseKeysRef above) — under the 3-mode contract that
                  // combination is never a genuine paid polish, so it must not claim to be one.
                  resultKind: isPolishedResult ? 'ai-polished' : isHybridResult ? 'hybrid' : 'legacy',
                  provider: 'openai',
                  geometryLock: finalGeometryLocked,
                  showcase,
                },
              );
              assembled.add(sheet.key);
              if (locked) lockedAssembled += 1;
            } catch (e) {
              console.error('[glossy] finishing a queued sheet failed', sheet.key, e);
              // Let a later snapshot retry this sheet — the worker's output is still in Storage.
              finished.delete(sheet.key);
              lastAssembleError = e instanceof Error ? e.message : String(e);
            }
          }
        }
        if (job.status === 'complete' || job.status === 'failed' || job.status === 'error') {
          // Count what this device actually produced, not what the worker reported. A sheet the
          // browser could not assemble is a failure the farmer must be told about — otherwise a
          // paid render silently vanishes behind a success message.
          const done = assembled.size;
          const rejectedDone = rejected.size;
          const lockedDone = lockedAssembled;
          const serverDone = job.sheets.filter((s) => s.status === 'done').length;
          const failedSheets = job.sheets.filter((s) => s.status === 'error');
          // Surface the worker's actual reason (quota, moderation, …) — it was captured
          // server-side but never shown, leaving farmers guessing (audit find).
          const firstErr = failedSheets[0]?.error;
          if (done > 0) {
            setNotice(refreshPendingRef.current
              ? `AI POLISH COMPLETE — the new gpt-image-2 result is open now${lockedDone ? ' with Geometry Lock applied' : ''}. The exact no-AI master remains separately saved.`
              : `AI POLISH COMPLETE — ${done} paid gpt-image-2 result${done === 1 ? '' : 's'} finished${lockedDone ? ` with Geometry Lock applied on ${lockedDone}` : ''}${failedSheets.length ? ` · ${failedSheets.length} failed${firstErr ? ` (${firstErr})` : ''} — try again` : ''}. The new AI result is open now; the exact no-AI master is saved separately.`);
            refreshPendingRef.current = false;
            setGalleryViewId(lastAssembledGalleryId);
            setGalleryOpen(true);
          } else if (rejectedDone > 0) {
            // The worker succeeded, and the browser deliberately rejected the measured output as
            // unchanged/filter-only. The amber paid-pass explanation is already on screen.
            setNotice(null);
            setLockedPolishStage(null);
            refreshPendingRef.current = false;
          } else if (serverDone > 0) {
            // The render succeeded and was paid for, but this device could not assemble it.
            setError(formatDesignTranslation(t('designGlossyAssembleError'), {
              detail: lastAssembleError ? ` (${lastAssembleError})` : '',
            }));
            setLockedPolishStage(null);
            refreshPendingRef.current = false;
          } else {
            setError(job.error || firstErr || t('designGlossyRenderIncomplete'));
            setLockedPolishStage(null);
            refreshPendingRef.current = false;
          }
          setLoading(null);
          clearPersistedJobId(siteId);
          setQueueJobId(null);
        }
      }
    }

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueJobId, state.siteId, pushGallery]);

  // Re-attach to an in-flight job after a reload / tab reopen (renders take minutes).
  useEffect(() => {
    const stored = readPersistedJobId(state.siteId);
    if (stored) {
      setLoading('falgpt');
      setNotice(t('designGlossyReconnecting'));
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

  // The exact master is an implementation detail of the one-button workflow. Keep it in Saved
  // maps, but never present it in the main preview while the paid style pass is still running:
  // doing that made the selected style look as though it had silently degraded to Geometry Lock.
  const visibleResultImage = lockedPolishStage === null ? resultImage : null;
  const lockedPolishStyleLabel =
    PRODUCER_STYLES.find((style) => style.key === polishStyleRef.current)?.label ?? 'selected style';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        background: PAPER,
        color: DARK,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Which map? — Rory's mockup layout: SHEET grid → quiet exact-all link → STYLE cards →
          one primary CTA → collapsed More options. The old top banner + big Output switch are
          gone: beta lives as a pill ON the AI preview, exact is reached via the links. */}
      <div>
        {/* SHEET — the plan set as a compact 4-up grid (Rory's mockup), canonical 01–08 order.
            Tapping a chip selects it in the CURRENT mode (AI by default); the "View non-AI exact
            version" link under the preview flips the same sheet to its exact render and back. */}
        {!compact && (
        <>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
          {t('designGlossyPlanSet')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {DESIGN_SHEETS.map((sheet) => {
            const active = selectedNo === sheet.no;
            return (
              <button
                key={sheet.no}
                type="button"
                onClick={() => applySheet(sheet, mode)}
                disabled={loading !== null}
                aria-pressed={active}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 46,
                  padding: '6px 4px',
                  borderRadius: 12,
                  border: active ? `2px solid ${GREEN}` : '1px solid rgba(31,77,43,0.35)',
                  background: active ? GREEN : 'transparent',
                  color: active ? PAPER : DARK,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: loading !== null ? 'default' : 'pointer',
                  opacity: loading !== null && !active ? 0.5 : 1,
                }}
              >
                <span>{sheet.label}</span>
                <span style={{ fontSize: 9.5, fontWeight: 600, opacity: active ? 0.85 : 0.55 }}>
                  {formatDesignTranslation(t('designGlossySheetNumber'), { number: sheet.no })}
                </span>
              </button>
            );
          })}
        </div>
        {/* THE one-tap plan set: AI all-sheets, hard-wired to the gpt-image-2 background queue
            (never Gemini — Rory: "must only go to chat gpt"). With the AI-legend default ON this
            is the showcase pipeline for all 5 model sheets. */}
        <button
          type="button"
          onClick={generateAllViaQueue}
          disabled={loading !== null}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 50, marginTop: 10, padding: '12px 20px', borderRadius: 12, border: 'none', background: GREEN, color: PAPER, fontWeight: 800, fontSize: 15, cursor: loading !== null ? 'default' : 'pointer', opacity: loading !== null ? 0.7 : 1 }}
        >
          <Gem size={18} />
          {loading === 'falgpt' ? t('designGlossyRenderingBackground') : t('designGlossyGenerateFive')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
          {/* Honest about what this button does NOT cover. Site (build-schedule facts) and Phasing
              stay exact-only by design; inventing those via image-gen would be actively wrong, not
              just lower quality. Sector DOES have an AI option now (composeSectorSheet composites
              our own bearings/legend over the model's ground either way) — it's just not in this
              5-sheet batch (MAX_SHEETS_PER_JOB caps it at 5 and the batch is already full); reach it
              from the Sector chip's own AI toggle. Was silently omitted before — Rory: "it produced
              5 not 8 sheets?" */}
          <span style={{ fontSize: 11, opacity: 0.65 }}>{t('designGlossyBatchNote')}</span>
          {/* Quiet exact-all link (mockup) — the non-AI option. */}
          <button
            type="button"
            onClick={generateAllSheets}
            disabled={loading !== null}
            style={{ flexShrink: 0, padding: '4px 2px', background: 'transparent', border: 'none', color: GREEN, fontWeight: 700, fontSize: 12.5, cursor: loading !== null ? 'default' : 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
          >
            {loading === 'exact' ? t('designGlossyDrawing') : t('designGlossyAllExact')}
          </button>
        </div>
        </>
        )}

        {/* Illustrated styles — the boundary-locked image-producer pipeline (beautiful AND
            accurate). Shown in AI mode on a design LAYER (03–07) and now also on Sector (02),
            whose AI render is a restyle with the measured bearings composited on top; Site (01) and
            Phasing (08) render exact-only, so neither needs a Style. */}
        {aiLayerMode && (
        <>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, margin: '12px 0 6px' }}>
          {t('designGlossyStyle')} {`(on your ${restyleAiKind === 'base' ? 'Existing Site' : restyleAiKind === 'sector' ? 'Sector' : filter === 'all' ? 'whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map)`}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
          {(sectorAiMode ? SECTOR_STYLE_CHOICES : PRODUCER_STYLES).map((s) => {
            const active = producerStyle === s.key;
            return (
              <button
                key={s.key}
                type="button"
                // Selecting only — tapping the active card keeps it (deselecting used to leave
                // "AI mode with no style", which silently fell back to the exact renderer).
                onClick={() => {
                  setProducerStyle(s.key);
                  setAnalysisStyle(null);
                  setExactSheet(null);
                  // PICKING A STYLE MEANS "RENDER IT THIS WAY". On Sector and Site the sheet could
                  // be sitting in EXACT mode, and clearing exactSheet without switching mode left
                  // restyleAiKind null — so runCurrentSheet fell through to the generic producer
                  // branch and rendered whatever `filter` happened to be, not the sheet on screen.
                  // From the farmer's side: tap a style, press the button, nothing changes.
                  // (Rory: "the style selector is not working i select the satelite overlay and
                  // nothing".)
                  if (selectedSheet && 'exact' in selectedSheet) {
                    setMode('ai');
                    applySheet(selectedSheet, 'ai');
                    setProducerStyle(s.key); // applySheet seeds a default; the farmer's pick wins
                  }
                  setResultImage(null);
                }}
                disabled={loading !== null}
                aria-pressed={active}
                title={`${s.blurb}${s.recommended ? t('designGlossyRecommendedSuffix') : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 6,
                  padding: 6,
                  borderRadius: 12,
                  border: active ? `2px solid ${GREEN}` : '1px solid rgba(0,0,0,0.18)',
                  background: active ? 'rgba(31,77,43,0.08)' : 'transparent',
                  color: DARK,
                  fontWeight: 700,
                  fontSize: 11.5,
                  cursor: loading !== null ? 'default' : 'pointer',
                  opacity: loading !== null && !active ? 0.5 : 1,
                  position: 'relative',
                }}
              >
                {s.recommended && (
                  <span
                    style={{
                      position: 'absolute',
                      zIndex: 1,
                      top: 9,
                      left: 9,
                      padding: '2px 6px',
                      borderRadius: 999,
                      background: '#F8E0A2',
                      color: '#3B3528',
                      fontSize: 8,
                      fontWeight: 900,
                      letterSpacing: 0.35,
                      textTransform: 'uppercase',
                    }}
                  >
                    {t('designGlossyRecommended')}
                  </span>
                )}
                <span aria-hidden style={{ display: 'block', height: 34, borderRadius: 8, background: s.swatch, border: '1px solid rgba(20,16,10,0.12)' }} />
                <span style={{ textAlign: 'center', lineHeight: 1.15 }}>{s.label}</span>
                <span style={{ fontSize: 9.5, fontWeight: 600, textAlign: 'center', opacity: 0.6, lineHeight: 1.2 }}>{s.blurb}</span>
              </button>
            );
          })}
        </div>
        </>
        )}
      </div>

      {selectedSheet && (
        <div style={{ padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(31,77,43,0.24)', background: 'rgba(31,77,43,0.06)', fontSize: 12.5, lineHeight: 1.45 }}>
          <strong>{t('designGlossyChooseFinish')}</strong> {t('designGlossyFinishHelp')}
        </div>
      )}

      {lockedPolishStage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minHeight: 210,
            padding: '24px',
            borderRadius: 16,
            border: `3px solid ${GOLD}`,
            background: 'linear-gradient(145deg, #132319 0%, #1E4128 62%, #315A38 100%)',
            color: PAPER,
            textAlign: 'center',
          }}
        >
          <Gem size={30} color={GOLD} />
          <strong style={{ fontSize: 19 }}>
            {(() => {
              const total = polishAfterHybridRef.current || lockedPolishStage === 'polish' ? 3 : 2;
              if (lockedPolishStage === 'exact') return `Step 1 of ${total} · locking the exact map`;
              if (lockedPolishStage === 'hybrid') return `Step 2 of ${total} · painting the AI hybrid underlayer`;
              return `Step 3 of 3 · polishing the AI hybrid in ${lockedPolishStyleLabel}`;
            })()}
          </strong>
          <span style={{ maxWidth: 620, fontSize: 13.5, lineHeight: 1.55, opacity: 0.86 }}>
            {lockedPolishStage === 'exact'
              ? 'The accurate master is being saved to Saved maps. It will not replace your chosen style.'
              : lockedPolishStage === 'hybrid'
              ? `Your exact master is safe. gpt-image-2 is painting the ${lockedPolishStyleLabel} underlayer, then your exact elements lock back on top.`
              : `Your exact master and AI hybrid are both safe. gpt-image-2 is now polishing the complete hybrid sheet; only that finished AI image will replace this progress screen.`}
          </span>
        </div>
      )}

      {!visibleResultImage && !lockedPolishStage && (
        <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
          {exactSheet === 'base'
            ? 'Draw your Existing Site sheet (plan-set 01) — just your real satellite with the boundary marked and nothing designed yet. The honest "before" that the whole plan builds on. Exact, no AI.'
            : exactSheet === 'sector'
            ? "Draw your Sector Analysis sheet (plan-set 02) — sun geometry, slope, drainage, contours and traced access are computed for this property. Named winds and fire are sourced regional context, clearly identified as assumptions and checked against coarse climate-grid data for these coordinates. Confirm wind and fire on site before building. Deterministic and exact — no AI."
            : restyleAiKind === 'base'
            ? `Generate an AI-styled Existing Site sheet (plan-set 01) in the ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} style — the model repaints the ground only; your boundary, roof and access stay exactly where they are, and nothing is designed onto it. Renders in the background (~mins).`
            : sectorAiMode
            ? `Create a paid AI-polished Sector Analysis sheet (plan-set 02) in the ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} style. The exact computed sheet is saved first, then GPT Image polishes the complete page — aerial, arrows, labels and legend — as a separate visual copy. All visible Sector styles support this route; Satellite Overlay is intentionally unavailable here.`
            : exactSheet === 'implementation'
            ? 'Draw your Implementation & Phasing sheet (plan-set 08) — the build order, week ranges, hold points, critical order and site rules, all worked out from your real design by the rules engine (permaculture Scale of Permanence + your rainfall). Deterministic and exact: no AI, no guessing. This is the reliable version of the illustrated Implementation analysis map.'
            : producerStyle
            ? `Generate your ${filter === 'all' ? 'whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map in the ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} style. ${engine === 'falgpt' ? (effectiveModelChrome ? 'gpt-image-2 paints the whole sheet with its own legend & labels. Renders in the background (~mins); it lands in your gallery.' : 'gpt-image-2 paints the map artwork in the background (~mins); exact framing, protected geometry, labels, legend, north arrow and scale are composited afterwards.') : 'Gemini renders in about a minute — your real satellite, boundary and labels are composited back on top, so it stays boundary-accurate.'}`
            : analysisStyle
              ? `Generate the ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} analysis map — an illustrated Gemini render (sun/wind, opportunities, phasing) over your real site. These are freer than the design maps: great to look at, less exact on geometry. Takes about a minute.`
              : filter === 'all'
                ? `Draw your whole design map — your real satellite with every zone, element, line and label placed exactly where you put them. Drawn straight from your plan, so it’s always accurate. Instant, no AI.${aiLayerMode ? ' Want an artist’s impression? Pick a Style above.' : ''}`
                : `Draw your ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} map — your real satellite with just that layer drawn exactly as you placed it. Instant and accurate, no AI guessing.${aiLayerMode ? ' For an illustrated version, pick a Style above.' : ''}`}
        </p>
      )}

      {visibleResultImage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: '100%', minWidth: 0 }}>
          <div
            style={{
              border: `4px solid ${GOLD}`,
              borderRadius: 16,
              overflow: 'hidden',
              background: DARK,
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              boxSizing: 'border-box',
            }}
          >
            <div style={{ padding: '10px 14px', background: DARK, color: GOLD, fontWeight: 700, fontSize: 14 }}>
              <span
                style={{
                  display: 'inline-flex',
                  marginRight: 10,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: isExactRender ? 'rgba(255,255,255,0.12)' : GOLD,
                  color: isExactRender ? PAPER : DARK,
                  fontSize: 10,
                  fontWeight: 900,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {isExactRender ? 'Exact master · no AI' : 'AI-polished · gpt-image-2'}
              </span>
              {placeName ?? 'Your design'}
              {exactSheet === 'base'
                ? ' · Existing site (sheet 01)'
                : exactSheet === 'sector'
                ? ' · Sector analysis (sheet 02)'
                : restyleAiKind === 'base'
                ? ` · Existing site (sheet 01) · ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label}`
                : sectorAiMode
                ? ` · Sector analysis (sheet 02) · ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label}`
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
            <div style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={visibleResultImage}
                alt={t(isExactRender ? 'designGlossyExactAlt' : 'designGlossyAiAlt')}
                style={{ width: '100%', maxWidth: '100%', height: 'auto', display: 'block' }}
              />
              {/* Beta pill ON the AI preview (mockup) — honesty without a screen-wide banner. */}
              {!isExactRender && (
                <span style={{ position: 'absolute', left: 10, bottom: 10, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: 'rgba(20,16,10,0.72)', color: '#F5E9CE', fontSize: 11.5, fontWeight: 700 }}>
                  <FlaskConical size={12} /> {t('designGlossyBeta')}
                </span>
              )}
            </div>
            <div style={{ padding: '10px 14px', background: DARK, color: PAPER, fontSize: 12, opacity: 0.75 }}>
              {isExactRender
                ? 'Exact sheet — drawn straight from your design + site data, no AI.'
                : 'AI artist’s impression of YOUR design — the canvas is the exact version.'}
            </div>
          </div>
          {saved && visibleResultImage === saved.image && (
            <div style={{ fontSize: 12, opacity: 0.65 }}>
              {formatDesignTranslation(t('designGlossySavedRender'), {
                date: relativeDate(saved.at),
                provider: PROVIDER_LABEL[saved.provider],
              })}
            </div>
          )}
          {/* Flip the SAME sheet between its AI and exact renders. From an exact result this is a
              true one-tap polish: switch modes and immediately start the geometry-locked queue. */}
          {selectedSheet && (
            <button
              type="button"
              onClick={() => {
                if (mode === 'exact') {
                  runLockedPolishFlow('full');
                  return;
                }
                setMode('exact');
                applySheet(selectedSheet, 'exact');
                setResultImage(null);
                setNotice(null);
              }}
              disabled={loading !== null}
              style={{
                alignSelf: 'flex-end',
                minHeight: mode === 'exact' ? 44 : undefined,
                padding: mode === 'exact' ? '10px 16px' : '4px 2px',
                borderRadius: mode === 'exact' ? 12 : undefined,
                background: mode === 'exact' ? GREEN : 'transparent',
                border: mode === 'exact' ? `2px solid ${GREEN}` : 'none',
                color: mode === 'exact' ? PAPER : GREEN,
                fontWeight: 800,
                fontSize: 12.5,
                cursor: loading !== null ? 'default' : 'pointer',
                textDecoration: mode === 'exact' ? 'none' : 'underline',
                textUnderlineOffset: 3,
              }}
            >
              {mode === 'ai' ? 'View the saved exact master →' : '✨ AI-polish this exact map · 1 AI render →'}
            </button>
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
              {t('designGlossyDownload')}
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
                {formatDesignTranslation(t('designGlossySavedMaps'), { count: gallery.length })}
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Gemini note for the analytical sheets (01/02/08 in AI mode) — no Style, no engine. */}
        {!producerStyle && analysisStyle && (
          <div style={{ fontSize: 11.5, opacity: 0.7 }}>
            {t('designGlossyGeminiNote')}
          </div>
        )}

        {/* More options (mockup) — everything power-user lives in one collapse: engine, the
            AI-legend experiment, the bonus Gemini analysis maps (incl. Opportunities, which has
            no sheet of its own), and the style-ALL batch. Hidden on the compact Preview mount. */}
        {!compact && (
        <div style={{ borderRadius: 14, border: '1px solid rgba(0,0,0,0.14)' }}>
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', color: DARK, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
          >
            <span>{t('designGlossyMoreOptions')}</span>
            <span style={{ opacity: 0.55 }}>{moreOpen ? '▴' : '▾'}</span>
          </button>
          {moreOpen && (
            <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Engine picker — only shown if there's more than one engine to choose. Gemini is
                  switched off, so this hides; everything renders with gpt-image-2. */}
              {ENGINES.length > 1 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
                  {t('designGlossyEngine')}
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

              {/* RETIRED — the Prompt-rewrite, Geometry Lock and AI-legend toggles used to live
                  here. Rory: "I even get confused every time; it's a layer of complexity I don't
                  want." They were also dishonest: Satellite Overlay overrides all three in code, so
                  on the recommended style they switched nothing at all. Behaviour is now a property
                  of the STYLE you choose — isModelChromeStyle() decides who letters the sheet, and
                  the state below keeps the defaults these toggles used to set. The legacy prompt
                  builders stay exported for a developer-level rollback, which is what they were
                  always for. */}

              {/* (The old "Analysis maps · Gemini" chip row is RETIRED — Rory. Sheets 01/02/08 in
                  AI mode still use the Gemini analysis path via applySheet; only the extra picker
                  row (incl. the sheet-less Opportunities map) is gone.) */}

              {/* Style ALL sheets — the AI batch (mockup naming). gpt-image-2 → background queue;
                  Gemini → synchronous. */}
              <div>
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
                    fontSize: 14,
                    cursor: loading !== null ? 'default' : 'pointer',
                    opacity: loading !== null ? 0.6 : 1,
                  }}
                >
                  <Gem size={17} />
                  {loading !== null && loading !== 'exact' ? 'Styling every sheet… hang on' : `Style all sheets — ${PRODUCER_STYLES.find((s) => s.key === (producerStyle ?? DEFAULT_PRODUCER_STYLE))?.label}`}
                </button>
                <div style={{ fontSize: 11, opacity: 0.72, lineHeight: 1.5, marginTop: 6 }}>
                  {engine === 'gemini'
                    ? 'Runs now with Gemini — about a minute per sheet, varies shot to shot.'
                    : 'gpt-image-2 renders in the background — sharpest result, a few minutes; the sheets drop into your gallery when ready and you can keep working. (Print / Export always builds the exact plan set.)'}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {selectedSheet && (
            <div style={{ color: DARK, fontWeight: 850, fontSize: 13, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
              {t('designGlossyFinishHeading')}
            </div>
          )}
          {selectedSheet ? (
          // The three modes every sheet supports: Exact Canvas (free), AI Hybrid (one paid render,
          // stops there), Full Treatment (Hybrid, then a second paid render polishes it). Full
          // Treatment always runs through Hybrid first — see runLockedPolishFlow/generateOneViaQueue.
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
            <button
              type="button"
              onClick={runExactStep}
              disabled={loading !== null}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minHeight: 72,
                padding: '11px 14px',
                border: `2px solid ${GREEN}`,
                borderRadius: 12,
                background: '#fffdf8',
                color: GREEN,
                fontWeight: 800,
                fontSize: 14,
                cursor: loading !== null ? 'default' : 'pointer',
                opacity: loading !== null ? 0.55 : 1,
              }}
            >
              <span>{t('designGlossyExactCanvas')}</span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.72, textAlign: 'center' }}>
                {t('designGlossyExactCanvasHint')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => runLockedPolishFlow('hybrid')}
              disabled={loading !== null}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minHeight: 72,
                padding: '11px 14px',
                borderRadius: 12,
                border: `2px solid ${DARK}`,
                background: 'rgba(31,77,43,0.06)',
                color: DARK,
                fontWeight: 800,
                fontSize: 14,
                cursor: loading !== null ? 'default' : 'pointer',
                opacity: loading !== null ? 0.55 : 1,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{resultImage ? <RefreshCw size={16} /> : <Gem size={16} />} {t('designGlossyAiHybrid')}</span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.72, textAlign: 'center' }}>
                {t('designGlossyAiHybridHint')}
              </span>
            </button>
            <button
              type="button"
              onClick={() => runLockedPolishFlow('full')}
              disabled={loading !== null}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                minHeight: 72,
                padding: '12px 14px',
                borderRadius: 12,
                border: 'none',
                background: GOLD,
                color: DARK,
                fontWeight: 800,
                fontSize: 14,
                cursor: loading !== null ? 'default' : 'pointer',
                opacity: loading !== null ? 0.7 : 1,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{resultImage ? <RefreshCw size={16} /> : <Gem size={16} />} {t('designGlossyFullTreatment')}</span>
              <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.78, textAlign: 'center' }}>
                {t('designGlossyFullTreatmentHint')}
              </span>
            </button>
          </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 10 }}>
          <button
            onClick={
              selectedSheet
                ? runExactStep
                : resultImage
                  ? refreshCurrentSheet
                  : () => { void runCurrentSheet(); }
            }
            disabled={loading !== null}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              minHeight: 64,
              padding: '12px 22px',
              borderRadius: 12,
              border: 'none',
              background: GOLD,
              color: DARK,
              fontWeight: 800,
              fontSize: 15,
              cursor: loading !== null ? 'default' : 'pointer',
              opacity: loading !== null ? 0.7 : 1,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {resultImage ? <RefreshCw size={18} /> : <Gem size={18} />}
              {loading !== null
                ? loading === 'exact'
                  ? 'Drawing your exact map…'
                  : loading === 'falgpt'
                    ? 'AI working in the background…'
                    : 'Generating your map… ~1 min'
                : exactSheet === 'implementation'
                  ? `${resultImage ? 'Redraw' : 'Draw'} my implementation & phasing sheet · instant`
                  : producerStyle
                    ? `✨ ${resultImage ? 'Regenerate' : 'Generate'} this sheet — ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} ${engine === 'falgpt' ? '(background · ~mins)' : '(~1 min)'}`
                    : analysisStyle
                      ? `✨ ${resultImage ? 'Regenerate' : 'Generate'} this sheet — ${GLOSSY_STYLES.find((s) => s.key === analysisStyle)?.label} (~1 min)`
                      : `${resultImage ? 'Redraw' : 'Draw'} this sheet — exact · instant`}
            </span>
          </button>
          </div>
          )}
        </div>

        <div style={{ fontSize: 11, opacity: 0.6 }}>
          {!producerStyle && !analysisStyle ? (
            <>
              {t('designGlossyExactFootnote')}
              {aiLayerMode ? ' For an illustrated version, pick a Style above.' : ''}
            </>
          ) : (
            <>
              {analysisStyle
                ? t('designGlossyAnalysisFootnote')
                : formatDesignTranslation(t('designGlossyEngineFootnote'), {
                  engine: ENGINES.find((e) => e.key === engine)?.label ?? '',
                })}{' '}
              {t('designGlossyExactVersion')}
            </>
          )}
        </div>
        {!visibleResultImage && !lockedPolishStage && gallery.length > 0 && (
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
            {formatDesignTranslation(t('designGlossySavedMaps'), { count: gallery.length })}
          </button>
        )}
        {error && <p style={{ color: '#B53A3A', fontSize: 13 }}>{error}</p>}
        {/* A paid pass that came back with nothing new. Amber, not red — nothing is broken and no
            work was lost; the farmer simply needs to know the second render did not earn its place,
            rather than being handed a copy of the map they already had and told it was polished. */}
        {polishNoChange && (
          <div
            role="status"
            style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#FDF4E3', border: '1px solid #E8D5A8' }}
          >
            <span aria-hidden style={{ fontSize: 14, lineHeight: '18px' }}>⚠︎</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.45, color: '#6B5320' }}>{polishNoChange}</p>
              <button
                onClick={() => setPolishNoChange(null)}
                style={{ marginTop: 6, padding: 0, background: 'none', border: 'none', color: '#8A6D2A', fontWeight: 700, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {t('designGlossyGotIt')}
              </button>
            </div>
          </div>
        )}
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
              <span style={{ fontSize: 14, fontWeight: 700, color: '#9E5C08' }}>🖼 {formatDesignTranslation(t('designGlossySavedMaps'), { count: gallery.length })}</span>
              <button
                onClick={() => { setGalleryOpen(false); setGalleryViewId(null); setGalleryZoomOpen(false); }}
                aria-label={t('designGlossyCloseSaved')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#9A8268', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ padding: 16, overflowY: 'auto' }}>
              {galleryViewItem ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <button
                    type="button"
                    onClick={() => setGalleryZoomOpen(true)}
                    aria-label={formatDesignTranslation(t('designGlossyOpenFullScreen'), { label: galleryViewItem.label })}
                    style={{ padding: 0, border: 'none', borderRadius: 12, background: 'transparent', cursor: 'zoom-in' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={galleryViewItem.image} alt={galleryViewItem.label} style={{ width: '100%', borderRadius: 12, border: '1px solid #E2D8C4', display: 'block' }} />
                  </button>
                  <span style={{ marginTop: -7, color: '#8A8172', fontSize: 11, fontWeight: 700 }}>{t('designGlossyInspectFullScreen')}</span>
                  <p style={{ fontSize: 13, color: '#5C5040', margin: 0 }}>{galleryViewItem.label}</p>
                  <div
                    style={{
                      alignSelf: 'flex-start',
                      padding: '5px 9px',
                      borderRadius: 999,
                      background: galleryViewItem.resultKind === 'ai-polished' ? '#F2C977' : '#E8E3D8',
                      color: DARK,
                      fontSize: 10.5,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {galleryResultBadge(galleryViewItem)}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={galleryViewItem.image}
                      download={`imbewu-${galleryViewItem.label.toLowerCase().replace(/[^a-z0-9.\-]+/g, '_')}.png`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, background: GREEN, color: PAPER, fontWeight: 700, fontSize: 13, textDecoration: 'none' }}
                    >
                      <Download size={15} /> {t('designDownload')}
                    </a>
                    {/* Native share (WhatsApp-first — how SA farmers actually pass maps around).
                        Rendered only where the Web Share API exists (i.e. phones); data-URL →
                        blob → File. A cancelled share (AbortError) is not an error. */}
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        onClick={async () => {
                          try {
                            const blob = await (await fetch(galleryViewItem.image)).blob();
                            const file = new File([blob], `imbewu-${galleryViewItem.label.toLowerCase().replace(/[^a-z0-9.\-]+/g, '_')}.png`, { type: blob.type || 'image/png' });
                            if (navigator.canShare?.({ files: [file] })) {
                              await navigator.share({ files: [file], title: galleryViewItem.label, text: `${galleryViewItem.label} — my farm plan, made with ImbewuField` });
                            } else {
                              await navigator.share({ title: galleryViewItem.label, text: `${galleryViewItem.label} — my farm plan, made with ImbewuField`, url: 'https://imbewufield.vercel.app' });
                            }
                          } catch (err) {
                            if (!(err instanceof DOMException && err.name === 'AbortError')) setError(t('designGlossyShareError'));
                          }
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, background: 'transparent', border: `2px solid ${GREEN}`, color: GREEN, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                      >
                        <Share2 size={15} /> {t('designShare')}
                      </button>
                    )}
                    <button
                      onClick={() => setGalleryViewId(null)}
                      style={{ padding: '8px 14px', borderRadius: 12, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      ‹ {t('designBackAction')}
                    </button>
                    <button
                      onClick={() => removeGallery(galleryViewItem.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 'auto', padding: '8px 14px', borderRadius: 12, background: '#FBEAEA', border: '1px solid #E8C4C4', color: '#B53A3A', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                    >
                      <Trash2 size={15} /> {t('designDelete')}
                    </button>
                  </div>
                </div>
              ) : gallery.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9A8268', margin: 0 }}>{t('designGlossyNoSaved')}</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {gallery.map((g) => (
                      <div
                        key={g.id}
                        style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #E2D8C4', aspectRatio: '1 / 1', background: DARK }}
                      >
                        <button
                          onClick={() => {
                            setGalleryViewId(g.id);
                            setGalleryZoomOpen(true);
                          }}
                          // The sheet name alone is ambiguous here: Full Treatment saves three
                          // entries for one sheet, so three tiles all announce "Water". Screen
                          // reader users hit the same wall Rory did, with no thumbnail to fall
                          // back on, so the provenance goes in the label too — full words, not
                          // the chip's abbreviation.
                          aria-label={formatDesignTranslation(t('designGlossyOpenResult'), {
                            label: g.label,
                            result: galleryResultBadge(g),
                          })}
                          style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={g.thumb ?? g.image} alt={g.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          {(() => {
                            const chip = galleryTileChip(g.resultKind);
                            if (!chip) return null;
                            return (
                              <span
                                aria-hidden
                                style={{ position: 'absolute', top: 4, left: 4, fontSize: 8, lineHeight: 1, fontWeight: 800, letterSpacing: '0.06em', padding: '3px 5px', borderRadius: 5, background: chip.bg, color: chip.fg, boxShadow: '0 1px 3px rgba(20,16,10,0.45)', pointerEvents: 'none' }}
                              >
                                {chip.text}
                              </span>
                            );
                          })()}
                          <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 9, padding: '2px 4px', background: 'rgba(20,16,10,0.6)', color: '#fff', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
                        </button>
                        <button
                          onClick={() => removeGallery(g.id)}
                          aria-label={formatDesignTranslation(t('designGlossyDeleteNamed'), { label: g.label })}
                          style={{ position: 'absolute', top: 4, right: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(181,58,58,0.92)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', cursor: 'pointer', boxShadow: '0 1px 4px rgba(20,16,10,0.4)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <p style={{ fontSize: 10, color: storageWarning ? '#B53A3A' : '#9A8268', margin: 0 }}>
                      {storageWarning ?? t('designGlossySavedOnDevice')}
                    </p>
                    <button
                      onClick={clearGallery}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, background: '#FBEAEA', border: '1px solid #E8C4C4', color: '#B53A3A', fontWeight: 700, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      <Trash2 size={12} /> {t('designClearAll')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {galleryZoomOpen && galleryViewItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={formatDesignTranslation(t('designGlossyFullScreenNamed'), { label: galleryViewItem.label })}
          onClick={() => setGalleryZoomOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 12,
            background: 'rgba(8,12,8,0.94)',
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setGalleryZoomOpen(false)}
            aria-label={t('designGlossyCloseFullScreen')}
            style={{
              position: 'fixed',
              top: 14,
              right: 14,
              zIndex: 81,
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.45)',
              background: 'rgba(251,246,236,0.94)',
              color: DARK,
              cursor: 'pointer',
            }}
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={galleryViewItem.image}
            alt={galleryViewItem.label}
            onClick={(event) => event.stopPropagation()}
            style={{
              maxWidth: '97vw',
              maxHeight: '88vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              borderRadius: 10,
              boxShadow: '0 18px 70px rgba(0,0,0,0.55)',
              cursor: 'default',
            }}
          />
          <span style={{ maxWidth: '90vw', color: '#FBF6EC', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
            {galleryViewItem.label}
          </span>
        </div>
      )}
    </div>
  );
}
