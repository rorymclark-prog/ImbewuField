'use client';

// Design Studio final plan-sheet renderer. The model may paint background texture, but
// the app owns factual geometry, placed features, labels and sheet chrome. Satellite
// Overlay remains the explicit model-authored comparison/rollback style.

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Download, RefreshCw, Gem, FlaskConical, Images, X, Trash2, Share2, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';
import {
  SHEET_EXPORT_PROFILES,
  imageMimeType,
  isMultiSheetFormat,
  sheetExportFileName,
  sheetSetFileName,
  type SheetExportFormat,
  type SheetExportQuality,
} from '@/lib/sheet-export';

import polygonClipping from 'polygon-clipping';

import type { CanvasFrame, DesignCanvasState, GroundFeatureKind, LineShape, PlacedItem, ZoneShape } from '@/lib/design-canvas';
import { groundFeatureLayer } from '@/lib/design-canvas';
import type { DesignElementDef } from '@/lib/design-elements';
import { ELEMENT_CATALOG, ELEMENTS_BY_ID } from '@/lib/design-elements';
import { GROUND_FEATURES, ZONE_DEFS } from '@/lib/design-elements';
import { requestRender, stripDataUrl, pollFalRender } from '@/lib/ai-render-client';
import { compositeAccurateMap, measureRenderDifference, restoreProtectedPixels, type LabelStyle, type ProducerLabel } from '@/lib/image-producer';
import { paidRenderDecision } from '@/lib/render-difference';
import { auditFromReport, recordRenderAudit } from '@/lib/render-audit';
import { polishedRenderPoints, type RenderPoint } from '@/lib/render-geometry';
import { buildPhasePlan } from '@/lib/phasing';
import { deriveSectorModel, bearingToUnitVector, type SectorSite, type SectorModel } from '@/lib/sector';
import type { SolarModel } from '@/lib/solar';
import { fetchSheetContours, type SheetContourResult } from '@/lib/sheet-contours';
import {
  gateBoundaryBreaks,
  boundarySegmentsWithBreaks,
  polygonAreaCentroid,
  type GateLike as GateLikeGeom,
  type FrameLike as BoundaryFrameGeom,
} from '@/lib/boundary-geometry';
import { structureRegisterText } from '@/lib/structure-register';
import { buildFinishedSheetPolishPrompt, buildLockedIllustrationPrompt, buildPhasingRestylePrompt, buildSatelliteOverlayPrompt, buildSectorRestylePrompt, buildSectorSheetPolishPrompt, isModelChromeStyle, buildProducerPrompt, buildProducerPromptLegacy, buildShowcasePrompt, buildShowcasePromptLegacy, SHEET_NO, type StylePreset } from '@/lib/producer-prompt';
import { zoneBadgePositions } from '@/lib/canvas-labels';
import { enqueueRenderJob, subscribeRenderJob, fetchRenderOutput, type RenderQuality } from '@/lib/render-jobs';
import type { RenderEngine } from '@/lib/render-job-contract';
import { authoritativeHouseFootprints } from '@/lib/house-footprints';
// Extracted (behaviour-preserving) — see lib/glossy-filters.ts and lib/producer-labels.ts.
// Re-exported below so existing consumers (lib/producer-prompt.ts comments, app/design/page.tsx,
// components/design/DesignPrint.tsx) keep importing them from this module unchanged.
import {
  compareCartographicPaint,
  itemInFilter,
  lineInFilter,
  zonesInFilter,
  sheetForElement,
  isContextElement,
  layerContentCount,
  groundRegister,
  groundContentRingsForSheet,
  EXACT_CONTEXT_ALPHA,
  EXACT_FULL_STRENGTH_ALPHA,
  EXACT_DRIVEWAY_LEGEND_TEXT,
  INTEGRATED_LEGEND_FAMILIES,
  exactSheetElementLegendGroups,
  exactSheetGroundLegendGroups,
  existingSiteGroundRings,
  existingSiteItems,
  existingSiteGroundLegendGroups,
  exactSheetLineLegendGroups,
  exactSheetLineRegister,
  exactSheetZoneLegendGroups,
  sheetElementNaming,
  REFERENCE_SHEET_LABEL,
  type GlossyLayerFilter,
} from '@/lib/glossy-filters';
import { compareLabelRows, gutterCalloutRows, planPlantNameChips, producerLabels, producerLabelsWithinBudget, plotBox, type PlantChipSpecimen } from '@/lib/producer-labels';
import {
  layoutGutterRows,
  sheetGutterWidth,
  type GutterLayout,
  type GutterRow,
} from '@/lib/plan-label-gutter';
import { leaderLabelFontSize, placeLeaderLabel, stackLeaderRows, leaderPath } from '@/lib/leader-labels';
import { exactModelInputMarks, polishModelInputMarks, RENDERED_DRIVEWAY_EDGE, renderAuthorityFlagsForStyle, renderPolicyForStyle } from '@/lib/render-policy';
import { EARTHWORKS_ROUTE_STYLE, WATER_LEGEND_SECTION_ORDER, WATER_ROUTE_STYLE, nearestWaterNeighbourPx, offsetPolyline, waterFeaturePresentationDimensions, waterLegendSectionForFeature, waterLegendSectionForRoute, waterRoutesWithVisualBridges, waterRouteStyleFor, type EarthworksRouteStyle, type WaterLegendSection } from '@/lib/water-cartography';
import { PLANTING_CANOPY_PAINT, PLANTING_LEGEND_SECTION_ORDER, PLANTING_ROUTE_STYLE, overstoryCanopyIds, plantingFeaturePresentationDimensions, plantingLegendSectionForFeature, plantingRouteStyleFor, type PlantingLegendSection } from '@/lib/planting-cartography';
import { STRUCTURES_LEGEND_SECTION_ORDER, structuresFeaturePresentationDimensions, structuresLegendSectionForFeature, structuresRouteVisualFor, type StructuresLegendSection } from '@/lib/structures-cartography';
import { presentSectorCartography, seasonalSunArcRadii, sectorEvidenceSummary, SECTOR_STYLES, sectorFillColor, sectorStrokeWidth, type SectorLegendIcon, type SectorVisualKind } from '@/lib/sector-cartography';
import { referenceFeatureArtworkUrl, stapleTileUrl, vegSpriteUrl, VEG_SPRITES } from '@/lib/reference-feature-art';
import {
  DEFAULT_SHEET_LABEL_MODE,
  codedLegendText,
  labelModeCacheSuffix,
  marksPlantsOnMap,
  plantCodesForSheet,
  type SheetLabelMode,
} from '@/lib/plant-codes';
import { paintTopDownVetiverHedge, VETIVER_HEDGE_IDS } from '@/lib/vetiver-hedge';
import {
  balancedLegendColumnRanges,
  countedLegendText,
  fitLegendFontSize,
  layoutLegendColumn,
  legendHeightFillRatio,
  legendMaxFontSize,
  legendRowFontSize,
} from '@/lib/sheet-legend-layout';
import { PLAIN_HARD_SURFACE_PAINT, SHEET_BASE_MUTE_STYLE, SHEET_STRUCTURE_MUTE_STYLE, type SheetBaseMute } from '@/lib/sheet-base-mute';
import { frameForUnderlay, hasFarmerPhoto, sheetUnderlayOptions, underlayCacheSuffix, type SheetUnderlay } from '@/lib/sheet-underlay';
import { overlandFlowArrows, overlandFlowLegendText, interceptFlowArrows, type FlowArrow } from '@/lib/overland-flow';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';
import {
  bedCropMarkPitchPx,
  bedCropMarkUnitPx,
  bedCropRows,
  cabbageHeadLeaves,
  cropGlyphFor,
  polygonCropRows,
  stableUnit,
  staplePlotGlyphs,
  staplePlotOrdinalById,
  unnamedBedGlyph,
  type CropGlyph,
  type CropRowLayout,
} from '@/lib/crop-row-cartography';
import { overlayElementsText } from '@/lib/overlay-elements';
import { annualRoofHarvestLitres, deriveWaterSystem, ringAreaM2, statedTankCapacityLitres } from '@/lib/water-system';
import { WATER_SHEET_ROOF_RUNOFF_COEFFICIENT } from '@/lib/roof-runoff';
import { drawCartographicWaterSymbol } from '@/lib/cartographic-water-symbols';
import { drawCartographicStructureSymbol } from '@/lib/cartographic-structure-symbols';
import {
  fullTreatmentProtectPolicy,
  lockedPolishAction,
  lockedPolishResultKind,
  lockedPolishStyle,
  useLockedPolishHandoff,
  type SheetOutputMode,
} from '@/lib/locked-polish-flow';
import { modelInputCarriesChrome, paidPolishNeedsChromePass } from '@/lib/sheet-chrome-pass';
import { sheetRenderRoute, DEFAULT_PRODUCER_STYLE, type SheetSpec, type SheetRoutePath } from '@/lib/sheet-render-route';
import {
  calculateBoundaryPresentationLayout,
  calculatePhasingSheetSize,
  paperSheetCanvas,
  styleSheetLegendWidth,
} from '@/lib/reference-presentation';
import { loadSheetMetas, loadSheetImage, patchSheetThumb, saveSheet, deleteSheet, clearSheets, type SheetProvider, type SheetResultKind } from '@/lib/sheet-store';
import { backfillThumbnails } from '@/lib/gallery-thumbnails';
import { basemapAttribution } from '@/lib/basemap-imagery';
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
/**
 * THE AI FINISHES ARE SHELVED, NOT DELETED. Rory, 2026-08-10: "Yeah shelve it but don't delete it
 * I may decide to look at it again later."
 *
 * Why: a paid Full Treatment sheet came back with no labels and no legend at all, and a boundary
 * that read as stamped on rather than drawn. That is structural, not a tuning miss — the second
 * paid pass is handed the ALREADY-COMPOSED sheet (legend panel, every label, title block, north
 * arrow, scale bar) and fullTreatmentProtectPolicy() byte-locks only the boundary, so an image
 * model that cannot render small text is asked to repaint a page covered in it, and erases it.
 * Meanwhile the deterministic Exact path has absorbed all of the sheet-quality work — painted
 * canopies, roofs, staple fields, vetiver, beds, labels, legends — instantly, free and identically
 * every time. lib/render-difference.ts exists because the paid pass repeatedly returned a picture
 * indistinguishable from its input.
 *
 * What shelving means, precisely: the paid finishes are not OFFERED, so no farmer spends a render
 * on them. Every line of the hybrid/polish pipeline stays exactly where it is, and every paid sheet
 * already in a gallery still opens, downloads and shares — shelving must never orphan work that has
 * been paid for. Flip this to false (or open the studio with ?aifinish=1) to bring them back.
 */
const AI_FINISHES_SHELVED = true;

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
  // Sheet 05. The one theme with NO blue in it: a swale printed in irrigation blue on the water
  // plan is exactly what made a farmer unable to tell a dug trench from a buried pipe, and is why
  // this sheet was split out. Earth palette only, and the marks stay as drawn like every layer.
  earthworks: {
    title: 'earthworks & contour plan',
    focus: 'an EARTHWORKS background: dry worked-soil ground in ochre, umber and raw sienna, reading as a civil setting-out drawing rather than a garden picture',
    emphasise: [
      'tint the editable open ground in earth tones — ochre, umber, raw sienna — and use NO blue anywhere on this sheet; blue belongs to the water plan',
      'every earthwork already drawn (swale trenches and their berms, contour banks, terrace steps, half-moon bunds) stays exactly as drawn — shade the ground AROUND each one so its raised side reads, never redraw, thicken, move or duplicate the mark itself',
      'where a platform is cut into a slope, shade the cut side darker and the filled side lighter so cut and fill are readable at a glance',
      'keep the layout editorial and legible, with a right-hand legend block and short label pills BESIDE the real earthworks',
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
/**
 * The colour drawBlueprintBoundary actually strokes the property line in — bright green over a dark
 * casing — and therefore the colour its legend swatch has to be.
 *
 * Three legend rows stood for the boundary and all three used BOUNDARY_BONE, which is the cream of
 * the vertex dots, not the line. On cream paper that swatch is very nearly invisible: the key for
 * the one mark that appears on every sheet was a pale smudge. Named, so the next person to add a
 * boundary row cannot pick the wrong one of the two colours involved.
 */
const BOUNDARY_LINE_GREEN = '#A8D35F';

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

/** Sheet 02 draws the house as a hairline over the photograph rather than as a filled shape — see
 *  composeSectorSheet. Fully transparent rather than skipping the fill call, so the ring is still
 *  traced exactly once and the stroke that follows cannot drift from the fill it replaces. */
const SECTOR_CONTEXT_NO_FILL = 'rgba(0,0,0,0)';

const LINE_COLORS: Record<string, string> = {
  swale: '#4EA6D8',
  fence: '#8E7CC3', // dusty violet — distinct from boundary-green; CAD convention for fencing
  path: '#C9A227',
  // 'bedpath' missing from this map was Rory's sheet-08 "ghost worms": every renderer keys off
  // LINE_COLORS, so the kind was SKIPPED by drawFilteredLines (invisible on the exact sheets it
  // is admitted to) while buildComposite's `?? '#8C8577'` fallback painted it pale grey into the
  // paid model input — where the protect mask punches an editable ribbon along every line, so the
  // model repainted each bed path as a pale unfinished worm and nothing burned the real path back.
  // Fourth registration site for this line kind; tests/line-kind-coverage.test.ts guards the
  // others, and a LINE_COLORS completeness check now guards this one.
  bedpath: PLANTING_ROUTE_STYLE.bedpath.color,
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
// Gemini was switched OFF (Rory, 2026-07-18) and is back ON (Rory, 2026-08-03: "then we need to
// try hook it up") now that the account is on a paid Gemini tier with a real spend cap.
//
// It had never actually worked from here, and not for one reason. Selecting Gemini did nothing to
// the queue — all four enqueueRenderJob call sites hardcoded engine 'openai' and ignored this
// picker entirely — and even a job that DID carry 'gemini' would have been rendered on OpenAI,
// because the worker branched on a `provider` field nothing ever wrote. Both are fixed; see
// RENDER_ENGINES in lib/render-job-contract.ts.
//
// gpt-image-2 stays the DEFAULT. Changing which vendor a render bills to is Rory's call, not a
// side effect of making the other one selectable.
const ENGINES: Array<{ key: 'falgpt' | 'gemini'; label: string; sub: string }> = [
  { key: 'falgpt', label: 'gpt-image-2', sub: 'sharpest · background (~mins)' },
  { key: 'gemini', label: 'Gemini', sub: 'cheaper · background (~mins)' },
];

/**
 * The three paid-render quality settings, offered so the SAME sheet can be rendered all three ways
 * and compared before anyone commits to one.
 *
 * The costs in the sub-labels are the reason this exists. At the ~3.3 megapixels these sheets are
 * rendered, 'high' is roughly 4x 'medium' and roughly 35x 'low'. Those are computed from OpenAI's
 * own published rates and are estimates, not invoices — which is exactly why the worker now logs
 * the API's real usage block (functions/src/index.ts) instead of discarding it. Treat these as
 * "order of magnitude" until a real bill confirms them.
 *
 * Why 'high' may be waste here specifically: the model paints an UNDERLAYER. Every piece of exact
 * geometry, every label and the whole legend are composited back on top afterwards, so much of the
 * fine detail 'high' pays for is covered up again before the farmer ever sees the sheet.
 */
const RENDER_QUALITY_CHOICES: ReadonlyArray<{ key: RenderQuality; labelKey: string; subKey: string }> = [
  { key: 'high', labelKey: 'designGlossyQualityHigh', subKey: 'designGlossyQualityHighSub' },
  { key: 'medium', labelKey: 'designGlossyQualityMedium', subKey: 'designGlossyQualityMediumSub' },
  { key: 'low', labelKey: 'designGlossyQualityLow', subKey: 'designGlossyQualityLowSub' },
];

const GLOSSY_FILTERS: Array<{ key: GlossyLayerFilter; label: string }> = [
  { key: 'all', label: 'Whole design' },
  { key: 'zones', label: 'Zones' },
  { key: 'water', label: 'Water' },
  { key: 'earthworks', label: 'Earthworks' },
  { key: 'planting', label: 'Planting' },
  { key: 'structures', label: 'Structures' },
];

// The canonical plan set (docs/PLAN-SET-SPEC.md), shown as ONE numbered 01–09 list in the
// Design-maps picker so it reads exactly like the printed set — analysis (01–02) before design
// (03–08) before implementation (09). EVERY sheet has BOTH an AI version (the default) and an
// exact/no-AI version (the option), chosen with the mode switch:
//   • 01/02/09 are analytical — their EXACT render is a rules-engine sheet (exactSheet), and their
//     AI render is the matching Gemini analysis map (aiAnalysis: base/sector/implementation), i.e.
//     the old "Analysis maps" row, now folded into these sheets.
//   • 03–08 are design layers — EXACT is the deterministic blueprint (filter alone), AI is the
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
  // Earthworks — the land-shaping / setting-out sheet, split out of Water so a swale (an
  // earthwork you dig) no longer prints in irrigation blue (a pipe you plumb). See FILTER_THEME
  // 'earthworks' above for the full rationale.
  { no: '05', label: 'Earthworks', filter: 'earthworks' },
  { no: '06', label: 'Planting', filter: 'planting' },
  { no: '07', label: 'Structures', filter: 'structures' },
  { no: '08', label: 'Whole', filter: 'all' },
  { no: '09', label: 'Phasing', exact: 'implementation', aiAnalysis: 'implementation' },
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
  // Photo Plan leads the list because it is the only style that keeps the farmer's real aerial
  // photograph AND our exact labels, counts and legend. Every other AI style repaints the ground;
  // Satellite Overlay keeps it but hands the lettering to the model.
  { key: 'photo_plan',          label: 'Photo Plan',          blurb: 'your real aerial photo · design drawn on top · exact labels', labelStyle: 'reference', swatch: 'linear-gradient(135deg,#2B3A24 0%,#4E8B3A 50%,#B4E000 100%)', recommended: true },
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
  // Earthworks has its own wizard step now. The fallback remains Water because the category is
  // also offered there for existing designs and for earth-shaped water features.
  earthworks: 'Water',
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
  // Opens the base-photo importer. The Underlay control offers the farmer's own aerial on every
  // site; where none has been imported yet, that pill calls this instead of selecting.
  onImportPhoto?: () => void;
}

/**
 * Every saved built footprint is structural authority, regardless of which tracing surface
 * created it. Older projects can carry the house in refLayers while Design Studio projects store
 * it as a ground-feature zone. Render safety must protect and restore both forms.
 */

// SCALE moved to lib/sheet-scale.ts — a farmer-facing quality setting now, not a constant.
// Re-exported so existing importers keep working. See that module for the cost boundary
// (AI_INPUT_WIDTH) that makes the setting safe to raise.
export { SCALE, setSheetScale, AI_INPUT_WIDTH } from '@/lib/sheet-scale';
import { SCALE, AI_INPUT_WIDTH, setSheetScale } from '@/lib/sheet-scale';

/** Farmer-facing names for the underlay control. Short enough to sit on a pill on a phone. */
const UNDERLAY_LABEL: Readonly<Record<SheetUnderlay, string>> = {
  photo: 'Your photo',
  satellite: 'Satellite',
  plain: 'Plain paper',
};

/** One line saying what each underlay is FOR — the reason to pick it, not what it looks like. */
const UNDERLAY_HINT: Readonly<Record<SheetUnderlay, string>> = {
  photo: 'sharper · current',
  satellite: 'shows the surrounding land',
  plain: 'no photo — the crispest sheet to print',
};

/** Farmer-facing names for the plant-label control. */
const LABEL_MODE_LABEL: Readonly<Record<SheetLabelMode, string>> = {
  codes: 'Codes',
  names: 'Beside',
  onplant: 'On plant',
};

/** The trade-off each mode makes, in one line — this is a genuine choice, so say what it costs. */
const LABEL_MODE_HINT: Readonly<Record<SheetLabelMode, string>> = {
  codes: 'every plant marked · look the code up in the legend',
  names: 'full names in the margin · nothing written on the drawing',
  onplant: 'full name under each plant · no lookup, most ink on the map',
};

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
  protectHouse?: boolean;
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
      drawBlueprintLabelPills(ctx, groundLabelsForSheet(state, refLayers, imgW, imgH, filter));
    }
  }

  // Zones — translucent fill (only when this layer is in the chosen filter, and design marks
  // are wanted — analysis maps like sector/base draw NO design overlay so Gemini renders clean)
  const compositeZoneBadges = zoneBadgePositions(
    state.zones.filter((z) => !z.feature && z.points.length >= 3),
    15 / Math.max(1, imgW),
  );
  // 'zones' ONLY — not zonesInFilter, which also admits 'all'. On sheet 08 the finisher
  // deliberately burns back NO zone bands ("repeating translucent effort zones here only muddies
  // planting and water"), so a ring shown to the model here had nothing drawn over it afterwards:
  // the model's repaint of each boundary survived in the mask ribbon as the pale worms tracing
  // Rory's zone outlines across open ground on the flagship masterplan. What the model must not
  // be asked to preserve, it must not be shown.
  for (const zone of drawDesign && filter === 'zones' ? state.zones : []) {
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
      // Same placement authority as the exact overlay — farmer's drag honoured, collisions nudged.
      const at = compositeZoneBadges.get(zone.id);
      if (!at) continue;
      const cx = px(at[0]);
      const cy = py(at[1]);
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
    if (line.kind === 'swale' || line.kind === 'path' || line.kind === 'bedpath') ctx.setLineDash([6, 4]);
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
    // could invent buildings or gardens. 'zones' ONLY, matching drawMarks above: the "burned back
    // afterwards" promise this comment used to make held on the zones sheet and was FALSE on
    // 'all', where buildExactLayerOverlay draws no zone bands — the carve preserved model paint
    // that nothing ever covered.
    if (filter === 'zones') {
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
  // Full Treatment deliberately opts out: two real second-pass outputs rendered the traced roofs
  // correctly, while copying the Hybrid source pixels back here recreated the blurry rectangular
  // roof patches the polish had removed.
  if (options.protectHouse !== false) {
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

/**
 * Hand finished files to the phone's own share sheet.
 *
 * WhatsApp-first, because that is how a plan actually reaches a mentor, an NGO officer or a buyer
 * in South Africa — not email, and not a link to a site with no signal to load it. `canShare` is
 * checked with the real files rather than assumed: some browsers expose `share` but refuse file
 * payloads, and finding that out after building six JPEGs is the wrong order.
 */
async function shareSheetFiles(files: File[], labels: string[]): Promise<void> {
  const one = labels.length === 1;
  const title = one ? labels[0] : `${labels.length} plan sheets`;
  const text = one
    ? `${labels[0]} — my farm plan, made with ImbewuField`
    : `${labels.length} sheets from my farm plan, made with ImbewuField`;
  if (typeof navigator === 'undefined' || !navigator.canShare?.({ files })) {
    throw new Error('This phone cannot share files directly — use Download instead.');
  }
  await navigator.share({ files, title, text });
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
 * iterating across all 9 sheets x 3 output modes) was decoding tens of MB of image data into the DOM
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
  // PRELOAD FOR EVERYTHING THE SHEET MIGHT DRAW, NOT FOR WHAT THE FILTER OWNS.
  //
  // This used to gate on itemInFilter || isContextElement, and isContextElement returns false for
  // every sheet except Water. But sheets draw context passes of their own: the Structures sheet
  // paints the planting layer underneath its infrastructure, and the Zones sheet paints element
  // ghosts under its bands. Neither of those items passed the gate, so their artwork was never
  // loaded and drawPaintedReferenceFeature fell through to the flat wash — which is why a tree on
  // sheet 07 came out as a pale disc with speckles rather than a tree, and why raising that sheet's
  // context alpha made it more conspicuous instead of more legible.
  //
  // The gate is dropped rather than extended per sheet, because "which sheets draw which other
  // layer as context" is exactly the kind of second list that drifts from the renderer. The cost is
  // loading a few more small PNGs into a cache that is shared across every sheet in the set, and
  // any sheet rendered after the first pays nothing.
  const urls = new Set<string>();
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) continue;
    const url = referenceFeatureArtworkUrl(def.id);
    if (url && !referenceFeatureArtworkCache.has(url)) urls.add(url);
  }
  // Veg sprites are keyed off the row engine's CropGlyph, not off an element id — preloaded
  // whenever the design has any bed, since one bed can rotate through several glyphs.
  if (state.items.some((it) => (BED_DEF_IDS as readonly string[]).includes(it.defId))) {
    for (const glyph of Object.keys(VEG_SPRITES)) {
      const url = vegSpriteUrl(glyph);
      if (url && !referenceFeatureArtworkCache.has(url)) urls.add(url);
    }
  }
  // Staple-plot field tiles are keyed off ZONES, not items — the loop above can never find them.
  // Preloaded by each plot's own ordinal so a two-plot farm loads two tiles, not four.
  {
    const ordinals = staplePlotOrdinalById(state.zones);
    for (const z of state.zones) {
      if (z.feature !== 'staple_garden') continue;
      const url = stapleTileUrl(ordinals.get(z.id) ?? 0);
      if (!referenceFeatureArtworkCache.has(url)) urls.add(url);
    }
  }
  void filter;
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
  useHighQualityScaling(ctx);
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
  useHighQualityScaling(ctx);
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
/** Cap an AI-bound bitmap back to the historical master width (AI_INPUT_WIDTH), whatever SCALE
 *  the sheet was drawn at. A UNIFORM downscale of the FINISHED composite: the whole picture
 *  shrinks together, so line weights, glyphs and the protect mask stay mutually consistent —
 *  unlike pinning the canvas size, which would have drawn 3x-scale line widths into a 2x-size
 *  frame on the paid path. At SCALE 2 the image is already at the cap and passes through
 *  untouched, byte-for-byte. */
/** enqueueRenderJob, with every sheet's composite AND protect mask capped to AI_INPUT_WIDTH.
 *  One wrapper so all four call sites share the boundary; the mask is capped with the same
 *  helper so it stays pixel-aligned with the picture it protects. */
async function enqueueRenderJobCapped(opts: Parameters<typeof enqueueRenderJob>[0]): ReturnType<typeof enqueueRenderJob> {
  const sheets = await Promise.all(opts.sheets.map(async (sheet) => ({
    ...sheet,
    compositeDataUrl: await capForAiInput(sheet.compositeDataUrl),
    ...(sheet.protectMaskDataUrl ? { protectMaskDataUrl: await capForAiInput(sheet.protectMaskDataUrl) } : {}),
  })));
  return enqueueRenderJob({ ...opts, sheets });
}

async function capForAiInput(dataUrl: string): Promise<string> {
  try {
    const img = await loadImage(dataUrl);
    if (img.naturalWidth <= AI_INPUT_WIDTH) return dataUrl;
    const scale = AI_INPUT_WIDTH / img.naturalWidth;
    const canvas = document.createElement('canvas');
    canvas.width = AI_INPUT_WIDTH;
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // PNG, matching what buildAccurateComposite produces — the render keys on thin geometry
    // lines and JPEG ringing softens them (that function's own note).
    return canvas.toDataURL('image/png');
  } catch {
    return dataUrl; // an uncapped upload is a cost bug, not a correctness bug — never block a render on it
  }
}

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
  // The cap applies at the boundary itself so no future call site can forget it.
  const capped = stripDataUrl(await capForAiInput(`data:image/png;base64,${imageBase64}`));
  const res = await fetch('/api/image-producer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: capped,
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
  // TRACED GROUND AREAS — the veg garden, orchard, staple garden, lawn and paving the farmer drew
  // as rings. This list was ITEMS, LINES AND EFFORT-ZONES ONLY: `state.zones.filter((z) => !z.feature)`
  // above deliberately drops every ground FEATURE, and nothing downstream put them back. So on every
  // painted style — which is every style except Satellite Overlay, the one path that has its own
  // `fabric` channel (buildSatelliteOverlayPrompt) — a farmer's traced orchard reached the model as
  // an unexplained coloured polygon on the composite, while the prompt's own NO-INVENT clause told
  // it "the feature list below is complete". A model resolves that by painting the polygon as
  // whatever the surrounding land is, which is why traced cultivation kept coming back as lawn.
  //
  // Gated by groundRegister via groundRows — the same authority that decides the wash alpha and the
  // legend row — so a ring is NAMED on exactly the sheets where it is the subject, and stays silent
  // context on Water and Zones. NAMES ONLY, per this function's contract above: how to draw each
  // one lives in the prompt body (the shared marker glossary in lib/producer-prompt.ts).
  for (const row of groundRows(state, refLayers, filter)) parts.push(row.label);
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
    // A ZONE IS A FLAT TRANSLUCENT COLOUR. NOT HATCHED. Rory has now said this twice — "in the
    // case of zones it must be a translucent colour you can control with a slider", and, looking
    // at a ruled Zones sheet, "I don't like hatching for zones" — and the second time was because
    // of a decision made here, not a misunderstanding of the first.
    //
    // What happened is worth keeping, because it is this file's documented failure mode wearing a
    // new coat. The rule "a hatch REPLACES a fill rather than stacking on it" is correct, and it
    // was the right fix for the ground surfaces — driveway, patio, cleared ground — where ruling
    // says "hard surface" in the same language a site plan already uses. It was then applied to
    // every ruled area at once, zones included, which quietly overrode a direct instruction about
    // one specific layer with a general principle about another. General rules do not get to
    // outvote the farmer on the sheet he actually looked at.
    //
    // Zones are also the wrong candidate for ruling on the merits. Ruling is a CATEGORY symbol —
    // it separates kinds of surface. Zones are an ORDERED SERIES, 0 out to 5, and the thing a
    // reader needs from them is sequence, which colour carries and line-spacing does not. Six
    // ruled fills over an aerial photograph read as one texture with six tints in it.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = def.color;
    ctx.fill('evenodd'); // outer + hole rings in one path → real holes
    ctx.restore();
    // IDENTITY LIVES AT THE EDGE, so the middle can stay see-through.
    //
    // A flat tint strong enough to name its colour across a whole paddock is also strong enough to
    // hide the ground under it, and the ground is the thing Rory asked to see. Planning-designation
    // maps solve exactly this with a graduated edge: a saturated band just inside the boundary,
    // falling away to a light wash in the middle. The band is where zones meet, which is where a
    // reader compares them, so the colour is at its strongest precisely where the comparison is
    // made — and the centre of a zone, where nothing needs comparing, is the clearest ground on
    // the sheet.
    //
    // Drawn by stroking the zone's own outline inside a clip of itself: half the stroke falls
    // outside the shape and is discarded, so a 2-pass stroke becomes a band that follows every
    // corner and hole without any offset geometry to get wrong.
    ctx.save();
    ctx.clip('evenodd');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = def.color;
    for (const [alpha, width] of [
      [0.3, Math.max(14, W * 0.028)] as const,
      [0.42, Math.max(7, W * 0.013)] as const,
    ]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.stroke();
    }
    ctx.restore();
    // Re-declare the path: clip() left it intact but the fill rings must be re-walked for the
    // outline strokes below to describe the same donut the fill did.
    ctx.beginPath();
    for (const poly of zoneFillPolys(state, refLayers, z)) {
      for (const ring of poly) {
        ring.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
        ctx.closePath();
      }
    }
    ctx.strokeStyle = 'rgba(32,25,15,0.42)';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  // Number badge per zone — at the centroid, PLUS whatever the farmer dragged it to on the canvas,
  // and nudged apart from any badge it would otherwise sit on top of. Both halves were missing:
  // the sheet computed a raw centroid, so nested rings printed "1" on top of "0" (Rory: "zone 1
  // icon is sitting over zone 0 we must also be able to move these icons if needed"), and a farmer
  // who moved the badge on the canvas saw the sheet ignore them. See zoneBadgePositions.
  const badgeR = 20;
  const badges = zoneBadgePositions(zones, badgeR / W);
  for (const z of zones) {
    const at = badges.get(z.id);
    if (!at) continue;
    const cx = at[0] * W;
    const cy = at[1] * H;
    ctx.beginPath();
    ctx.arc(cx, cy, badgeR, 0, Math.PI * 2);
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
      return compareCartographicPaint(
        { def: da, area: (a.wM ?? da.wM) * (a.hM ?? da.hM), id: a.id },
        { def: db, area: (b.wM ?? db.wM) * (b.hM ?? db.hM), id: b.id },
      );
    });
}

/** @param sheet which sheet is being painted — NOT always Water. See the membership note below. */
function drawWaterRoutes(ctx: CanvasRenderingContext2D, state: DesignCanvasState, frame: CanvasFrame, W: number, H: number, sheet: GlossyLayerFilter = 'water') {
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
    // OBEY THE SHEET'S OWN MEMBERSHIP RULE — AND IT IS THE CALLER'S SHEET, NOT ALWAYS WATER.
    //
    // lineInFilter decided long ago that a swale is dug, not plumbed, and belongs to Earthworks
    // (sheet 05) — but only the LEGEND was taught that, so a swale still appeared on the Water
    // sheet in pipe-blue with no legend row to explain it. Asking lineInFilter here is what makes
    // the two halves of that decision agree.
    //
    // The first version of this check hard-coded 'water', which was wrong in a way that only shows
    // up two sheets away: this function is ALSO the only route painter for the masterplan (sheet
    // 08, filter 'all') — the drawFilteredLines calls beside it there cover planting and
    // structures, neither of which owns a swale. So hard-coding the sheet silently deleted every
    // swale from sheet 08 while exactSheetLineLegendGroups('all') carried on listing it: the exact
    // "nothing in the legend without a mark on the map" invariant this change set out to restore,
    // broken again one sheet over. Caught by an adversarial audit of this very commit, not by the
    // tests — tests/legend-map-agreement.test.ts compares the legend against the AI prompt
    // inventory, and both are built from the same helper, so neither notices what the canvas did.
    const style = waterRouteStyleFor(line.kind);
    // Membership is now the three-state register, not the yes/no of lineInFilter. Ownership is
    // unchanged — lineInFilter still says the swale belongs to Earthworks and nowhere else — but a
    // sheet may additionally show a line it does not own, quietly, when the sheet cannot be read
    // without it. See exactSheetLineRegister.
    const register = exactSheetLineRegister(line.kind, sheet);
    if (!style || line.points.length < 2 || register === 'absent') continue;
    const routeAlpha = register === 'context'
      ? (EXACT_CONTEXT_ALPHA[sheet as keyof typeof EXACT_CONTEXT_ALPHA] ?? 0.72)
      : 1;
    const trace = () => {
      ctx.beginPath();
      line.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x * W, y * H));
    };
    // A SWALE IS DUG, NOT PLUMBED — AND WHERE IT IS THE SUBJECT, IT MUST LOOK DUG.
    //
    // Water (sheet 04) keeps the flat dashed stroke on purpose: there the swale is a CROSS-
    // REFERENCE, labelled "see sheet 05", and a full earthwork band would compete with the
    // plumbing the sheet is actually about. But this function is also the only route painter for
    // the masterplan (filter 'all') and the phasing sheet (09), and on those the swale is the
    // thing itself — phase 3 on 09 tells the farmer to "dig the swales on true contour and spread
    // the spoil onto the downhill berm", beside a 5.6px dash that shows neither ditch nor berm nor
    // the ground the work occupies. Rory, looking at 09: "this thin brown line".
    //
    // So reuse sheet 05's cross-section, which draws from the SAVED width at true ground size.
    // Geometry, width and membership are untouched; this is a drawing choice only.
    if (line.kind === 'swale') {
      // Now drawn on the WATER sheet too, quietly, as a context earthwork. It used to be excluded
      // there and then excluded entirely, which left sheet 04's overland-flow arrows running
      // downhill into blank ground — the swale is where that water is going. Rory, twice: "we
      // should have arrows in the swales and show swales too?" and "theres no swale arrows? or
      // swale?". Drawn as the dug cross-section rather than a dashed blue stroke, because reading
      // as plumbing is exactly what got it removed from this sheet in the first place.
      ctx.save();
      ctx.globalAlpha *= routeAlpha;
      drawSwaleCrossSection(
        ctx,
        line.points.map(([x, y]) => [x * W, y * H] as [number, number]),
        EARTHWORKS_ROUTE_STYLE.swale,
        frame.mPerPx > 0 ? W / (frame.imgW * frame.mPerPx) : undefined,
        line.widthM,
      );
      ctx.restore();
      continue;
    }
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
    // Every swale now takes the cross-section branch above and never reaches here, so the casing
    // is plumbing-dark unconditionally. The swale arm of the old ternary was dead code that tsc
    // caught the moment the branch stopped being conditional on the sheet.
    ctx.strokeStyle = 'rgba(14,42,54,0.72)';
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

  // THE PAINTED TANK WINS OVER THE VECTOR SYMBOL, when its sprite has loaded. Rory, on the blue
  // dartboard: "new graphic for jojo tank (this is the old one?)" — the top-down sprites carry
  // the family's capacity colour code (charcoal/green/teal/sandstone/blue lids) so the plan says
  // WHICH tank the way the picker already does. The vector symbol below remains the fallback,
  // and small tanks stay legible because the sprite is drawn to the same footprint the symbol
  // would have owned.
  if (isTank) {
    const url = referenceFeatureArtworkUrl(id);
    const sprite = url ? referenceFeatureArtworkCache.get(url) : undefined;
    if (sprite) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      ctx.restore();
      return;
    }
  }

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
    // A LABEL FOR A LINE THIS SHEET DOES NOT DRAW IS A LEADER POINTING AT NOTHING. Third place the
    // same half-applied move surfaced: when swales left the Water sheet, the legend was told and
    // the renderer was not — and neither was this. Stopping drawWaterRoutes alone left a "SWALE"
    // callout with a leader running to bare ground. Asking lineInFilter here keeps callouts,
    // strokes and legend rows answering to one authority.
    if (!name || line.points.length < 2 || !lineInFilter(line.kind, 'water')) continue;
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
      const { textW } = placed;
      const drawSize = placed.fontSize;
      // THE SAME LEADER CAP THE OTHER PAINTER HAS. placeLeaderLabel puts the callout at the PLOT
      // edge, which is right for something already near that edge and wrong for anything mid-map:
      // the greywater line's midpoint sits in the middle of the site, so its label went to the far
      // margin and dragged a horizontal rule clear across the sheet, over the beds, the tank and
      // the boundary. Capping the run pulls the label back toward its own feature — the far edge
      // stays the limit, not the destination. Identical rule and identical constant to
      // drawBlueprintLabelPills, because two label systems drifting apart is the defect, not a
      // detail of one of them.
      const maxRun = W * LEADER_MAX_RUN_RATIO;
      const x = side === 'left'
        ? Math.max(placed.x, group.target[0] - maxRun - textW)
        : Math.min(placed.x, group.target[0] + maxRun);
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

      drawLabelPlaque(ctx, x, positions[index], textW, drawSize, 'left');
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
// SAME chrome — see docs/PLAN-SET-SPEC.md "Sheet anatomy": satellite + restrained scrim, tar driveway,
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

/**
 * Push a traced-building photo cutout back into the sheet's tonal range.
 *
 * The veil has to be confined to the cutout's own pixels — it is a transparent PNG with a building
 * shape in it, and a veil painted straight onto the sheet would wash everything already drawn.
 * `source-atop` on an offscreen canvas does exactly that: it paints only where the cutout is
 * already opaque, and leaves the rest transparent for the caller to draw through.
 *
 * See SHEET_STRUCTURE_MUTE_STYLE for why a building takes different values from its ground.
 */
async function muteStructureCutout(
  cutout: CanvasImageSource,
  W: number,
  H: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  if ('filter' in ctx) ctx.filter = SHEET_STRUCTURE_MUTE_STYLE.filter;
  ctx.drawImage(cutout, 0, 0, W, H);
  if ('filter' in ctx) ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = SHEET_STRUCTURE_MUTE_STYLE.veil;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

/**
 * Paint the overland-flow field.
 *
 * Deliberately quiet: this is the CONDITION the water plan responds to, not part of the plan, so it
 * must be readable without competing with a pipe or a tank. Rory, on what may sit over the
 * photograph: "remember this mustn't overlay base map etc etc" — hence a thin stroke, a wide gap
 * between arrows, and a cream casing rather than a heavier colour, which is how every other mark on
 * these sheets survives busy ground without shouting.
 */
function drawOverlandFlowArrows(
  ctx: CanvasRenderingContext2D,
  arrows: FlowArrow[],
  W: number,
  H: number,
): void {
  if (!arrows.length) return;
  const width = Math.max(1.6, W * 0.0016);
  const head = Math.max(6, W * 0.0055);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [stroke, lineWidth] of [
    ['rgba(250,246,232,0.72)', width * 2.6] as const,
    ['rgba(28,96,140,0.62)', width] as const,
  ]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    for (const arrow of arrows) {
      const fx = arrow.from[0] * W;
      const fy = arrow.from[1] * H;
      const tx = arrow.to[0] * W;
      const ty = arrow.to[1] * H;
      const angle = Math.atan2(ty - fy, tx - fx);
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      if (arrow.spread) {
        // INTERCEPTED: the arrow ends AT a swale, bed or plot, and the head becomes a bar lying
        // ALONG that feature with two short wings — water arriving and spreading sideways, the
        // thing the farmer dug the feature to do. An arrowhead here would say "and onward",
        // which is exactly the claim Rory flagged: "must show spreading by veg beds and swales,
        // not going through them".
        const across = angle + Math.PI / 2;
        const bar = head * 1.4;
        ctx.moveTo(tx - Math.cos(across) * bar, ty - Math.sin(across) * bar);
        ctx.lineTo(tx + Math.cos(across) * bar, ty + Math.sin(across) * bar);
        const wing = head * 0.55;
        for (const side of [-1, 1] as const) {
          const wx = tx + Math.cos(across) * bar * side;
          const wy = ty + Math.sin(across) * bar * side;
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(across) * wing * side - Math.cos(angle) * wing * 0.4,
                     wy + Math.sin(across) * wing * side - Math.sin(angle) * wing * 0.4);
        }
        continue;
      }
      // Open V head, not a filled triangle: at this weight a solid head reads as a blob and the
      // arrow stops looking like a direction.
      ctx.moveTo(tx - Math.cos(angle - 0.42) * head, ty - Math.sin(angle - 0.42) * head);
      ctx.lineTo(tx, ty);
      ctx.lineTo(tx - Math.cos(angle + 0.42) * head, ty - Math.sin(angle + 0.42) * head);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Satellite base + a restrained blueprint scrim that keeps labels legible without drowning the map. */
async function drawBlueprintBase(
  ctx: CanvasRenderingContext2D,
  frame: CanvasFrame,
  W: number,
  H: number,
  mute: SheetBaseMute = 'design',
): Promise<void> {
  // MUTE THE BASE, DO NOT DARKEN IT. This used to lay an 18% BLACK veil over the aerial, which is
  // the wrong direction twice over: it makes dense subtropical foliage darker and busier, and it
  // pushes the photo's contrast UP against the drawn content rather than down. Rory, on the real
  // planting sheet: "having a raw map in the background, especially the detailed drone photo, can
  // be very distracting ... maybe dim everything in the boundary right back depending on the
  // layer." lib/sheet-base-mute.ts holds that per-sheet policy, so the design sheets and the
  // Sector sheet can no longer end up with independently invented treatments the way they had.
  const style = SHEET_BASE_MUTE_STYLE[mute];
  if (frame.satDataUrl) {
    const img = await loadImage(frame.satDataUrl);
    ctx.save();
    // Guarded: Canvas filter support is not universal. Without it the paper veil below still
    // lightens the photo, just with the greens left in — degraded, not broken.
    if ('filter' in ctx) ctx.filter = style.filter;
    ctx.drawImage(img, 0, 0, W, H);
    ctx.restore();
  } else {
    // No photo: a warm paper ground, not the old near-black slate. Every mark on these sheets is
    // drawn for paper — cream casings, dark keylines, coloured hatch — so a dark fallback was
    // inverting the whole sheet's contrast the moment imagery was unavailable.
    ctx.fillStyle = '#EDE7D6';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = style.veil;
  ctx.fillRect(0, 0, W, H);
}

/** Satellite under an ANALYSIS sheet: desaturated and lightened to a quiet paper tone.
 *
 *  drawBlueprintBase lays a restrained scrim so bright design graphics remain legible over the
 *  satellite, which is
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
 *  Decorative kerbs are globally disabled: existing access must stay quiet site context.
 *
 *  ON PAPER IT IS A WASH BETWEEN EDGES, NOT A SLAB. Near-solid tar is the right weight over a
 *  photograph and the wrong one over paper, where it becomes the darkest thing on a sheet about
 *  planting — see PLAIN_HARD_SURFACE_PAINT. The white dashed edge goes with it: white dashes on a
 *  pale wash are invisible, so the edge is drawn dark instead and is what gives the run its shape. */
function drawBlueprintDriveway(
  ctx: CanvasRenderingContext2D,
  refLayers: DesignGlossyProps['refLayers'],
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  dashedEdge: boolean,
  onPaper = false,
): void {
  if (refLayers.driveway.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tar = onPaper ? PLAIN_HARD_SURFACE_PAINT.tarFill : TAR;
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
    ctx.fillStyle = tar;
    ctx.fill();
    if (onPaper) {
      ctx.strokeStyle = PLAIN_HARD_SURFACE_PAINT.tarEdge;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (dashedEdge && RENDERED_DRIVEWAY_EDGE) {
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = onPaper ? PLAIN_HARD_SURFACE_PAINT.tarEdge : 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else {
    trace();
    ctx.strokeStyle = tar;
    ctx.lineWidth = Math.min(46, Math.max(11, pxPerM * 3)); // ~3 m carriageway, clamped
    ctx.stroke();
    if (dashedEdge && RENDERED_DRIVEWAY_EDGE) {
      trace();
      ctx.setLineDash([10, 7]);
      ctx.strokeStyle = onPaper ? PLAIN_HARD_SURFACE_PAINT.tarEdge : 'rgba(255,255,255,0.7)';
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
  /** Sheet 01 only: the caller has already vetted these rings with existingSiteGroundRings, which
   *  is the narrower "what is on the ground today" question. groundRegister answers the DESIGN
   *  sheets' question and deliberately drops hard standing and the staple garden; on the site
   *  record those are exactly the facts being recorded, so it must not be consulted here. */
  siteRecord = false,
  /** Canvas px per real-world metre — anchors the staple field tiles to the ground. Optional:
   *  a caller without it gets the glyph-row fallback, never a mis-scaled pattern. */
  pxPerM?: number,
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
    // The boundary is a drawn LINE, never a fill wash — that exclusion is universal and must
    // survive the siteRecord bypass. Without this, a farmer who traced their boundary as a ground
    // ring (rather than with the boundary tool) would get the whole property flooded with a colour
    // wash on sheet 01, and a second "Property boundary" legend row beside the real one.
    if (z.feature === 'boundary') return false;
    return siteRecord || groundRegister(z.feature, filter) !== 'absent';
  });
  if (!rings.length) return;
  // Biggest first — a lawn that wraps a veg patch must not bury the patch.
  const sorted = [...rings].sort((a, b) => ringArea(b.points) - ringArea(a.points));
  // Counted over every staple plot in the design, not just the ones this sheet draws, so a plot
  // keeps the same crop on every sheet it appears on. The helper deliberately uses saved creation
  // order rather than this area's paint order — see its own no-swap rule in crop-row-cartography.
  const staplePlotOrdinal = staplePlotOrdinalById(state.zones);
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
      : hard ? (isContent ? '55' : '1E') : (isContent ? '99' : '3D');
    const strokeAlpha = illustrated ? (isContent ? '80' : '5A') : (isContent ? 'F2' : '6E');
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
      // CONTEXT HATCHING IS ORIENTATION, NOT CONTENT. Rory, on the Water sheet: "in this layer we
      // musnt have the slab or wha ever this polygon is leaking though its not approiate" — the
      // traced slab was drawn there at 50% stroke, 1.6px, and the same spacing a CONTENT sheet
      // uses, so a hard surface the water plan only mentions in passing became the loudest block
      // on the page and read as this sheet's subject.
      //
      // It is not removed, because a slab is real to a water plan: it is the runoff catchment the
      // pipes and the swale exist to deal with. It is demoted — twice the spacing, under half the
      // line weight, a fraction of the alpha — so it registers where the hard ground is without
      // competing with the pipework. Same marks, quieter voice, which is what the content/context
      // split is supposed to mean in pixels and until now only meant in the prompt.
      ctx.strokeStyle = `${meta.color}${illustrated ? (isContent ? '55' : '30') : (isContent ? 'CC' : '3A')}`;
      ctx.lineWidth = illustrated ? 1.1 : (isContent ? 1.6 : 0.9);
      const hatchStep = isContent ? step : step * 2;
      ctx.beginPath();
      for (let d = x0 - h; d < x1; d += hatchStep) {
        ctx.moveTo(d, y0);
        ctx.lineTo(d + h, y1);
      }
      ctx.stroke();
    }
    // A STAPLE PLOT IS A FIELD OF CROPS, NOT A COLOURED SHAPE. Rory, twice, on two different
    // sheets: "staple plot polygons ... they need to have actual rows of maize, beans, potatoes,
    // and another for 4 plots! not a polygon!"
    //
    // He is right, and it is also how the drawing convention works: on a planting plan the pattern
    // inside the outline IS the instruction, because the farmer sets out to the rows he can see.
    // Each plot draws as ONE crop and neighbouring plots draw as different crops — maize, then
    // beans, then pumpkin, then an identity-neutral mixed block — because that is the distinction
    // a reader can actually make at plan scale. Two earlier versions varied the MIX inside each plot instead, and both
    // came out as four patches of identical speckle; see staplePlotGlyph for that history.
    //
    // Rows are drawn only where the plot is big enough on THIS sheet to read as rows — below that
    // the plain wash above is left alone, because a field of illegible dots is worse than an
    // honest polygon. Nothing here is agronomic: the rhythm is a drawing rhythm, and no spacing,
    // yield or variety is implied. See lib/crop-row-cartography.ts.
    if (z.feature === 'staple_garden' && isContent) {
      // THE ILLUSTRATED FIELD, when its tile has loaded. Rory: "the staple plots now to be
      // rendered like the trees" — the same painterly standard as the canopies, as a seamless
      // repeating tile clipped to the traced plot. One tile per plot in the SAME rotation the
      // glyph engine uses (stapleTileFor ↔ STAPLE_PLOT_CROPS, both driven by the plot's saved-
      // creation ordinal), so a plot's crop identity is one fact however it is drawn.
      //
      // TILE_METRES anchors the pattern to the GROUND, not the sheet: 9 m of field per repeat
      // keeps the drawn plants plausibly plant-sized at every zoom the plan set uses, and two
      // plots at different sizes show the same crop at the same scale. pxPerM may be absent on
      // older call paths — those fall through to the glyph rows below, never to a blank plot.
      const ordinal = staplePlotOrdinal.get(z.id) ?? 0;
      const tile = referenceFeatureArtworkCache.get(stapleTileUrl(ordinal));
      const TILE_METRES = 9;
      let tiled = false;
      if (tile && pxPerM && pxPerM > 0) {
        const pattern = ctx.createPattern(tile, 'repeat');
        if (pattern) {
          const scale = (TILE_METRES * pxPerM) / tile.width;
          // ROWS RUN WITH THE PLOT, WHICH RUNS WITH THE CONTOUR. Rory: "staple crops must be top
          // view and with the contour!" polygonCropRows' own note says a row bearing is drawn
          // only when the caller can defend one — and the defensible bearing is the plot's own
          // longest edge: a farmer laying out an on-contour plot traces it ALONG the contour, so
          // the ring the farmer drew already records the direction. Same longest-edge rule the
          // paper roofs use for their ridge. The tile's rows are horizontal in tile space;
          // rotating pattern space lays them down the plot's long axis.
          const ptsPx = z.points.map(([zx, zy]) => [px(zx), py(zy)] as [number, number]);
          let rowAngle = 0;
          let longestEdge = -1;
          for (let i = 0; i < ptsPx.length; i++) {
            const [x0, y0] = ptsPx[i];
            const [x1, y1] = ptsPx[(i + 1) % ptsPx.length];
            const len = Math.hypot(x1 - x0, y1 - y0);
            if (len > longestEdge) { longestEdge = len; rowAngle = Math.atan2(y1 - y0, x1 - x0); }
          }
          pattern.setTransform(new DOMMatrix().rotate((rowAngle * 180) / Math.PI).scale(scale, scale));
          ctx.save();
          blueprintRing(ctx, z.points, px, py);
          ctx.clip();
          // FULL STRENGTH, OVER NOTHING. The first version drew the tile at 0.92 over the plot's
          // pale registration wash, and 8% of cream paper bleeding through dark painted crops is
          // exactly the washed-out field Rory saw: "staples dont look good". The tile is OPAQUE
          // artwork — it is the ground here, the way a canopy is the tree — so it owns its pixels
          // the way the wash owned them before. The wash still draws first (these lines run after
          // it), which keeps the plot registered on sheets where the tile has not loaded.
          ctx.fillStyle = pattern;
          const priorAlpha = ctx.globalAlpha;
          ctx.globalAlpha = 1;
          const xs = z.points.map(([x]) => px(x));
          const ys = z.points.map(([, y]) => py(y));
          ctx.fillRect(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
          ctx.globalAlpha = priorAlpha;
          ctx.restore();
          tiled = true;
        }
      }
      if (!tiled) {
        const ring = z.points.map(([x, y]) => [px(x), py(y)] as [number, number]);
        const rowGap = Math.max(11, W * 0.011);
        // One crop per plot, so four staple plots read as four crops rather than one texture
        // repeated — see staplePlotGlyph for why mixing inside each plot never survived plan scale.
        const layout = polygonCropRows(ring, staplePlotGlyphs(ordinal), z.id, rowGap);
        if (layout.plants.length) {
          ctx.save();
          blueprintRing(ctx, z.points, px, py);
          ctx.clip();
          drawCropRowLayout(ctx, layout, meta.color);
          ctx.restore();
        }
      }
    }
    ctx.restore();
    blueprintRing(ctx, z.points, px, py);
    // With no fill behind it, a roof's outline is the only thing marking the building — and the
    // feature's own grey against a dark aerial is barely a line. White, and thicker, matching the
    // treatment the model composite uses so a house looks the same on the free sheet and the paid
    // one. Every other feature keeps its own colour, which is how the legend stays readable.
    ctx.strokeStyle = isRoof ? 'rgba(255,255,255,0.96)' : `${meta.color}${strokeAlpha}`;
    // A context ring's outline is demoted with its hatch, for the same reason — a 2.5px band
    // around a slab is a claim, and on a sheet the slab is not the subject of it is a false one.
    ctx.lineWidth = isRoof ? (illustrated ? 2.4 : 3.5) : (illustrated ? 1.4 : (isContent ? 2.5 : 1.4));
    ctx.stroke();
  }
}

/** Soil under a crop bed: the brown a worked bed actually is, so plants read as plants on it. */
const CROP_SOIL_COLOR = '#5A4130';

/**
 * Paint one crop-row layout: a faint drill line per row, then a plant glyph at every position.
 *
 * Every glyph gets a cream casing before its own colour, the same treatment the canopies, sector
 * arrows and route lines use — these sit on an aerial photograph and a thin green stroke on green
 * ground is invisible, which is the failure this whole evening has been about.
 */
function drawCropRowLayout(
  ctx: CanvasRenderingContext2D,
  layout: CropRowLayout,
  accent: string,
  /** Multiplies the plant glyph only — never the row pitch — so a caller can grow the plants
   *  without re-spacing the drills. Beds pass >1: Rory, on the bed rows: "make the veg look
   *  more real, perhaps make the veg a little oversized". At true scale a lettuce is a 25 cm
   *  dot the eye reads as texture; oversizing the SYMBOL (not the bed) is standard plan-drawing
   *  practice — the same license the minimum-symbol-size rule in planting-cartography already
   *  claims for tiny infrastructure. */
  glyphScale = 1,
  /** Overrides the pitch-derived size entirely. Beds pass the sheet-legible mark size from
   *  lib/crop-row-cartography's bedCropMarkUnitPx: a bed's row pitch is its own 1.2 m width
   *  divided by its rows, which at sheet scale is ~11 px and can never answer "is this readable
   *  on a phone". The staple-plot path passes nothing and keeps its field rhythm. */
  unitPx?: number,
): void {
  const unit = Number.isFinite(unitPx) && (unitPx as number) > 0
    ? (unitPx as number)
    : Math.max(3.4, layout.rowGapPx * 0.42) * glyphScale;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Drill lines: what a farmer sees from the air before the crop closes over.
  ctx.strokeStyle = 'rgba(46,32,20,0.34)';
  ctx.lineWidth = Math.max(0.8, unit * 0.14);
  ctx.beginPath();
  for (const row of layout.rows) {
    ctx.moveTo(row.x0, row.y0);
    ctx.lineTo(row.x1, row.y1);
  }
  ctx.stroke();

  for (const plant of layout.plants) {
    const s = unit * (0.82 + plant.jitter * 0.36);
    ctx.save();
    ctx.translate(plant.x, plant.y);
    // REAL VEGETABLES WHERE THE SPRITE HAS LOADED. Rory: "the veg garden next with oversize real
    // looking veg" — the painterly sprites replace the vector glyphs plant-for-plant on the same
    // rows, same jitter, same pitch. A touch of per-plant rotation keeps a row from stamping as
    // a rubber-stamp repeat; the vector glyph below remains the fallback for any kind whose
    // sprite is missing, so a bed can never go blank.
    //
    // EXCEPT THE ROSETTE. Rory, reviewing the live sheet on his phone: "the veg beds — make
    // actual cabbages, even oversized." The rosette sprite still read as a generic green blob at
    // phone size, so the leafy kind now always paints the deterministic layered cabbage head
    // below (see cabbageHeadLeaves) — same rows, same pitch, drawn from the plant's own stable
    // jitter so every render of a design is identical.
    if (plant.glyph !== 'rosette') {
      const spriteUrl = vegSpriteUrl(plant.glyph);
      const sprite = spriteUrl ? referenceFeatureArtworkCache.get(spriteUrl) : undefined;
      if (sprite) {
        const d = s * 2.6;
        ctx.rotate((plant.jitter - 0.5) * 0.6);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(sprite, -d / 2, -d / 2, d, d);
        ctx.restore();
        continue;
      }
    }
    // Casing first, then the plant — see the note above.
    for (const pass of ['casing', 'body'] as const) {
      const casing = pass === 'casing';
      ctx.strokeStyle = casing ? 'rgba(252,248,236,0.9)' : CROP_GLYPH_COLOR[plant.glyph] ?? accent;
      ctx.fillStyle = casing ? 'rgba(252,248,236,0.9)' : CROP_GLYPH_COLOR[plant.glyph] ?? accent;
      ctx.lineWidth = casing ? Math.max(2, s * 0.5) : Math.max(1, s * 0.22);
      drawCropGlyphPath(ctx, plant.glyph, s, casing, plant.jitter);
    }
    ctx.restore();
  }
  ctx.restore();
}

/** One colour per silhouette. Distinct enough that a maize row and a bean row read apart at
 *  sheet scale, which is the entire reason for drawing rows rather than a fill. */
const CROP_GLYPH_COLOR: Record<CropGlyph, string> = {
  grain: '#C9A227',
  legume: '#4E9A3E',
  vine: '#2F7A4A',
  root: '#8A5A2B',
  staked: '#C1462F',
  rosette: '#54903F',
  generic: '#5E8C43',
};

/** The cabbage head's leaf greens, outer wrapper then inner whorl then heart — the muted
 *  blue-greens a brassica actually is, sitting inside the sheet's soft earth palette. */
const CABBAGE_LEAF_TONES = ['#4C8140', '#578F4A'] as const;
const CABBAGE_INNER_TONE = '#6CA355';
const CABBAGE_HEART_TONE = '#8FBE6B';

/** Draw one plant silhouette at the current origin. `casingOnly` strokes the same path fatter so
 *  the body that follows sits inside a light halo. `jitter` is the plant's stable 0..1 — it seeds
 *  the cabbage head's leaf arrangement so no two heads in a row are the same stamp while every
 *  render of a design stays identical. */
function drawCropGlyphPath(
  ctx: CanvasRenderingContext2D,
  glyph: CropGlyph,
  s: number,
  casingOnly: boolean,
  jitter = 0.5,
): void {
  switch (glyph) {
    case 'grain': {
      // A maize stalk: upright stem, two blade leaves, and the ear that makes it unmistakable.
      ctx.beginPath();
      ctx.moveTo(0, s * 0.9);
      ctx.lineTo(0, -s * 0.95);
      ctx.moveTo(0, -s * 0.15); ctx.lineTo(s * 0.62, -s * 0.62);
      ctx.moveTo(0, s * 0.12); ctx.lineTo(-s * 0.62, -s * 0.35);
      ctx.stroke();
      if (!casingOnly) {
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.72, s * 0.2, s * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    case 'legume': {
      // A climbing bean: a slim twining stroke with a leaf pair.
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.quadraticCurveTo(s * 0.4, s * 0.1, 0, -s * 0.8);
      ctx.moveTo(0, -s * 0.2); ctx.lineTo(s * 0.5, -s * 0.42);
      ctx.stroke();
      return;
    }
    case 'vine': {
      // Pumpkin on the ground: a wide low lobe, deliberately sprawling rather than upright.
      ctx.beginPath();
      ctx.ellipse(0, s * 0.15, s * 0.95, s * 0.5, 0, 0, Math.PI * 2);
      casingOnly ? ctx.stroke() : ctx.fill();
      return;
    }
    case 'root': {
      // Root crop: a low mound with a leaf tuft, the half-below-ground convention.
      ctx.beginPath();
      ctx.arc(0, s * 0.3, s * 0.5, Math.PI, 0);
      casingOnly ? ctx.stroke() : ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, s * 0.25); ctx.lineTo(0, -s * 0.7);
      ctx.moveTo(0, -s * 0.3); ctx.lineTo(s * 0.42, -s * 0.72);
      ctx.moveTo(0, -s * 0.3); ctx.lineTo(-s * 0.42, -s * 0.72);
      ctx.stroke();
      return;
    }
    case 'staked': {
      // Tomato or pepper: a stake with a fruiting canopy on it.
      ctx.beginPath();
      ctx.moveTo(0, s); ctx.lineTo(0, -s * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -s * 0.5, s * 0.55, 0, Math.PI * 2);
      casingOnly ? ctx.stroke() : ctx.fill();
      return;
    }
    case 'rosette': {
      // AN ACTUAL CABBAGE, NOT A DISC. Rory: "the veg beds — make actual cabbages, even
      // oversized." Layered rounded wrapper leaves around a tight pale heart is the one
      // silhouette that says brassica from above, and the head is drawn a third larger than the
      // other glyphs (symbol size only — the rows and pitch this glyph sits on are untouched, the
      // same license drawCropRowLayout's glyphScale note claims) so it stays a cabbage on a
      // phone. Leaf positions come from lib/crop-row-cartography's cabbageHeadLeaves — pure
      // seeded geometry, so a bed paints identically on every render.
      const cs = s * 1.3;
      if (casingOnly) {
        // No cream halo, deliberately: the head is drawn at the same oversized footprint the veg
        // SPRITES use (d = 2.6 s), and at that size neighbouring halos merged into a pale band
        // behind the row. Rosettes only ever sit on a bed's own worked-soil fill, where the deep
        // leaf greens carry their own contrast — the casing pass the other glyphs need against an
        // aerial photograph has nothing to rescue here.
        return;
      }
      const leaves = cabbageHeadLeaves(jitter);
      for (const [index, leaf] of leaves.entries()) {
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(leaf.angle) * leaf.dist * cs,
          Math.sin(leaf.angle) * leaf.dist * cs,
          leaf.rx * cs,
          leaf.ry * cs,
          leaf.angle + Math.PI / 2,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = leaf.whorl === 1
          ? CABBAGE_INNER_TONE
          : CABBAGE_LEAF_TONES[index % CABBAGE_LEAF_TONES.length];
        ctx.fill();
      }
      // The tight heart, and a fine pale ring where the youngest leaves wrap it — the centre
      // detail is what stops the head reading as a green flower.
      ctx.beginPath();
      ctx.arc(0, 0, cs * 0.24, 0, Math.PI * 2);
      ctx.fillStyle = CABBAGE_HEART_TONE;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, cs * 0.13, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(252,248,236,0.75)';
      ctx.lineWidth = Math.max(0.7, cs * 0.09);
      ctx.stroke();
      return;
    }
    default: {
      // A plain leafy plant seen from above. 'generic' means the farmer told us nothing this
      // module recognises, so the mark stays deliberately non-committal — drawing a recognisable
      // cabbage here would assert a crop nobody named (see cropGlyphFor's doctrine).
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
      casingOnly ? ctx.stroke() : ctx.fill();
      if (!casingOnly) {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(252,248,236,0.75)';
        ctx.lineWidth = Math.max(0.7, s * 0.16);
        ctx.stroke();
      }
      return;
    }
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
  // pale ground.
  //
  // POSTS ARE ROUND, NOT CROSSBARS. This used to stroke a short perpendicular bar at each interval
  // and the comment claimed they "read as fence posts". They do not — they read as tick marks on a
  // drawing, which is exactly what Rory has now said more than once. The AI prompt has required the
  // right thing for a while ("Posts are circles, never ticks, dashes or leaves", rule 9), so the
  // deterministic renderer was contradicting the app's own stated rule, and the exact sheets were
  // the ones getting it wrong.
  //
  // Seen from above, a post IS a circle: the wire runs THROUGH it, so each post is drawn over the
  // wire as a filled disc with a dark casing, at the same spacing the crossbars used.
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
  // Radius, not half-length: a crossbar had to be long to be visible, a post has to be round.
  const postR = Math.max(3.2, W * 0.0026);
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
        ctx.arc(cx, cy, postR, 0, Math.PI * 2);
        ctx.fillStyle = '#D7E9A8';
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,30,20,0.85)';
        ctx.lineWidth = 1.6;
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
 *  so it keeps rendering exactly as before; sheets 06/07 need them for long species names. */
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
// THE SHEET'S TYPE, settled once and applied everywhere.
//
// Rory, more times than I can count and finally: "i still og gawd help me hate the legend! …
// big text, change fonts, for the love of god do it now and once and for all forever and across
// all sheets."
//
// TWO THINGS WERE WRONG, and both were in these four lines.
//
// CONDENSED. Every label, every legend row, every section heading was set in a CONDENSED stack —
// Avenir Next Condensed, falling back to Roboto Condensed and then Arial Narrow. Condensed faces
// exist to fit more characters into less width, which is the opposite of what a plan legend needs:
// it is read at arm's length, on paper, in daylight, by someone checking a count. Worse, most
// machines do not have Avenir Next Condensed, so the real-world fallback was Arial Narrow — the
// least legible face in the stack, doing the most important job on the sheet.
//
// TWO FAMILIES FIGHTING. The title was Georgia while everything under it was a narrow sans, so
// the panel read as two documents stacked. A drawing set is set in ONE family at several weights;
// that is what makes it look like a drawing set.
//
// So: one normal-width grotesque, everywhere, at weights — and it is the APP'S OWN grotesque.
// Rory, repeatedly, sheet after sheet: change the fonts. The sheets were the one surface still set
// in whatever neutral sans the device happened to have (Helvetica on his phone, Arial on Windows,
// Roboto on Android), which is exactly the "no decision was made" look, and it didn't even match
// the app around it. The app already self-hosts Public Sans through next/font (--font-sans on
// <html>, see app/layout.tsx) — the same face the farmer has been reading in every panel and
// button — so the sheets now resolve that first. Resolved at runtime because next/font's real
// family name is build-scrambled ('__Public_Sans_xxx'); never a network fetch at render time —
// the face is either already in the document (self-hosted, cached with the app shell) or the
// stack falls through to the old device-native names, so an offline sheet still cannot change
// shape mid-print. SSR import gets the fallback only; the canvas only ever draws client-side.
function appSheetSans(): string {
  const DEVICE_FALLBACK = '"Public Sans", "Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, system-ui, sans-serif';
  if (typeof document === 'undefined') return DEVICE_FALLBACK;
  const appSans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  return appSans ? `${appSans}, ${DEVICE_FALLBACK}` : DEVICE_FALLBACK;
}
const SHEET_SANS = appSheetSans();
const SHEET_GLYPH_FONT = 'sans-serif';
const SHEET_TITLE_FONT = SHEET_SANS;
const REFERENCE_LABEL_FONT = SHEET_SANS;
const SHEET_BODY_FONT = SHEET_SANS;

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
// Longest a map callout's leader may run before the label is pulled in off the sheet edge and
// placed closer to its own feature instead. Was unconditional: textX always jumped to the far
// canvas margin regardless of how close the feature already was, which is what put a leader
// clear across the sheet on anything sitting near the centre — the Hybrid Masterplan QA kit's
// #1 finding ("TREES is not connected by a full-width line across the building", "leader lines
// dominate the map"), and visible on Rory's own reference screenshot. 0.22 ≈ the kit's own
// 360px-on-a-1540px-map-panel rule (~23%), applied against the full canvas width here since this
// renderer has no separate map/legend panel split to measure against.
const LEADER_MAX_RUN_RATIO = 0.22;

/**
 * How far a canopy's artwork is drawn past its own footprint, to close the artwork's clear margin.
 *
 * Measured off the assets rather than guessed: orchard-canopy-v1 and its siblings are ~450px square
 * with roughly 6-7% of clear space on each side, so ~1.14 puts the painted foliage on the ring.
 * The footprint clip means this can only ever fill the gap, never enlarge the tree.
 */
const ARTWORK_EDGE_BLEED = 1.14;

/**
 * WHICH SHAPE A CANOPY'S MARKS FOLLOW — the footprint circle, or the artwork's own alpha.
 *
 * Rory: *"the canopy must not be a circle edge but a jagged leaf canopy."* That is not achievable
 * in artwork alone, and a probe proved it: a crown drawn with lobes at 98% of the radius and
 * transparent notches at 78% comes out of this function as a **perfect disc**, because the code
 * draws a circle five separate times around every canopy — a cream casing ring, a radial soil
 * gradient, a mulch stipple, a footprint clip that the 1.14 bleed pushes the notches outside of,
 * and a dark outline stroke over the top.
 *
 * 'artwork' mode replaces the four silhouette-defining marks with ones that follow the PNG's own
 * alpha channel (canvas shadows do this natively, which is what makes a leaf-hugging casing
 * possible without a traced path), and drops the bleed to 1.0 so the notches survive the clip.
 * The footprint circle stays as a clip — a safety net that must never bite, because the crown is
 * drawn to sit inside it, so the tree still occupies exactly the ground the farmer allocated.
 *
 * IT MUST NOT BE SWITCHED ON BEFORE THE NEW ARTWORK LANDS. The current canopies carry a painted
 * mulch band — the outer 75-100% of orchard-canopy-v1, avocado-tree-v1 and marula-tree-v1 is
 * 56-70% brown pixels — and today the cream casing and the soil fill are what hide it. Remove
 * them from the old art and that brown band is what a farmer sees. New art under 'footprint' is
 * a disc; old art under 'artwork' is a brown ring. Neither half is worth shipping alone.
 *
 * See docs/CANOPY-ART-BRIEF-V2.md, which is the artwork half of this change.
 */
const CANOPY_EDGE_MODE: 'footprint' | 'artwork' = 'artwork';

/**
 * Turn on the browser's best resampling for a canvas that is about to scale an image.
 *
 * Canvas defaults to a fast, low-quality filter. Exactly ONE place in this file had ever set
 * `imageSmoothingQuality = 'high'`, while every plan sheet resamples the aerial photograph at least
 * twice on its way to the page — crop, then composite — and each of those passes at the default
 * setting is visible softness that no amount of drawing detail can win back. Rory: "the quality of
 * the image is very poor please increase the quality so things are more crisp".
 *
 * This is free: no extra pixels, no extra fetches, just asking for the better filter that is
 * already there. It does NOT create detail that was never captured — see the note on asset and
 * imagery resolution, which is the real ceiling.
 */
function useHighQualityScaling(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
}



/**
 * SEASONAL SUN — WARM FOR SUMMER, COOL FOR WINTER.
 *
 * The two solstice arcs were near-identical creams (#F7C97E and #F5DFA6), so the only thing
 * distinguishing them was reading the noon altitude off each label — on the diagram whose entire
 * job is to make that difference obvious at a glance. Rory: "summer sun part of it including line
 * and sun is a dark orange? and the winter one make it cooler?".
 *
 * The encoding earns its keep: the high summer arc IS the heat you plant shade against, and the
 * low winter arc IS the light you must not block. Warm/cool reads before any number does.
 *
 * The winter blue is deliberately kept clear of the water arrow's blue, so a sun path can never be
 * mistaken for drainage on a sheet that carries both.
 */
const SUN_SUMMER_COLOR = '#E2761B';
const SUN_WINTER_COLOR = '#8FC0DC';


/**
 * A CALLOUT SITS ON ITS OWN PLAQUE.
 *
 * Cream text with a dark outline is a halo, and a halo only works where the ground behind it is
 * reasonably even. These labels do not land on even ground: the leader-length cap exists precisely
 * to stop a label marching to the sheet edge, so a callout for a feature mid-canvas is placed back
 * over the drawing — on the planting sheet, straight across two painted tree canopies, where
 * "AVOCADO TREE" read as words scattered on foliage rather than as a label.
 *
 * This is the move the file already makes for canopies, sector arrows and routes crossing busy
 * ground: an opaque body inside a light casing. The plaque is the label's body. It goes UNDER the
 * text and OVER the leader, so the line visibly runs to the plaque's edge and stops, which is what
 * tells the eye the two belong together.
 *
 * Shared by BOTH label painters. The sheets have two — drawBlueprintLabelPills for the design
 * layers and drawWaterLeaderLabels for sheet 04 — and giving only one of them the plaque is how a
 * fix ends up landing on seven sheets out of nine.
 */
function drawLabelPlaque(
  ctx: CanvasRenderingContext2D,
  textX: number,
  centreY: number,
  textW: number,
  fontSize: number,
  align: CanvasTextAlign,
): void {
  const padX = fontSize * 0.34;
  const padY = fontSize * 0.3;
  const x = (align === 'right' ? textX - textW : textX) - padX;
  const y = centreY - fontSize * 0.5 - padY;
  const w = textW + padX * 2;
  const h = fontSize + padY * 2;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, Math.min(h * 0.34, fontSize * 0.42));
  ctx.fillStyle = 'rgba(24,32,26,0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(243,238,219,0.72)';
  ctx.lineWidth = Math.max(1.2, fontSize * 0.045);
  ctx.stroke();
  ctx.restore();
}

function drawBlueprintLabelPills(
  ctx: CanvasRenderingContext2D,
  labels: ProducerLabel[],
): void {
  const W = ctx.canvas.width;
  // Map callouts sit on a photograph and are read at arm's length on paper or on a phone, so they
  // carry a floor as well as a scale factor. Lifted on Rory's ask across the whole set — "on all
  // maps I think you can increase the map labels a bit more" — after the legend band was settled,
  // so map type and panel type were judged against each other rather than one at a time.
  const fs = Math.max(24, Math.round(W * 0.0145));
  const maxRun = W * LEADER_MAX_RUN_RATIO;
  for (const l of labels) {
    const isHeader = l.kind === 'header';
    const weight = isHeader ? 800 : 650;
    ctx.font = `${weight} ${fs}px ${REFERENCE_LABEL_FONT}`;
    const textW = ctx.measureText(l.text).width;
    const onLeft = l.ax < W / 2;
    // The far-edge position stays the FLOOR/CEILING — a feature already near the margin still
    // reads exactly as it always did. Only a feature far from the edge is pulled in: the leader
    // stops at maxRun and the label sits back toward its own feature, mid-canvas, rather than
    // being marched all the way across.
    const edgeX = onLeft ? Math.max(20, W * 0.012) : Math.min(W - 20, W * 0.988);
    const textX = onLeft ? Math.max(edgeX, l.cx - maxRun) : Math.min(edgeX, l.cx + maxRun);
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
    drawLabelPlaque(ctx, textX, l.ay + 1, textW, fs, align);
    drawReferenceMapText(ctx, l.text, textX, l.ay + 1, fs, weight, align);
  }
}

/** "STAPLE GARDEN" → "Staple garden". Ground labels are built in CAPS for on-map pills, and a
 *  gutter is a schedule that has to read as the legend's twin, so it takes the legend's case. */
function sentenceCase(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/** Greedy two-line wrap. One line is always preferred; a name only breaks when it cannot be made
 *  to fit at the shrink floor, because a column of mixed one- and two-line rows is harder to scan
 *  than a column of slightly smaller ones. */
function wrapGutterText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return [text];
  let best: [string, string] | null = null;
  let bestWorst = Infinity;
  for (let split = 1; split < words.length; split++) {
    const first = words.slice(0, split).join(' ');
    const second = words.slice(split).join(' ');
    const worst = Math.max(ctx.measureText(first).width, ctx.measureText(second).width);
    if (worst < bestWorst) {
      bestWorst = worst;
      best = [first, second];
    }
  }
  return best ?? [text];
}

/**
 * THE LABEL GUTTER — a reserved paper band down each side of the map, and every callout in it.
 *
 * Rory: "the labels must not be drawn over the design, they must be to the side of the design."
 * lib/plan-label-gutter.ts holds the why, the reserve and the row policy; this is the paint.
 *
 * WHAT IS DELIBERATE HERE, so it survives the next edit:
 *
 * The band is drawn AFTER the map and its overlays and BEFORE the leaders, so it covers whatever
 * photograph was under it and no leader is ever clipped by its own label's background. The rule
 * line at the band's inner edge is what makes the band read as drawing furniture rather than as a
 * badly cropped photo — without it the sheet looks broken rather than composed.
 *
 * Rows carry NO plaque. A plaque exists to hold a label together against a busy aerial; on clean
 * paper it is just a dark box shouting on a quiet margin. Losing it is also what buys the long
 * names their single line — a plaque costs about 20% of the band's width in padding alone.
 *
 * Text is flush to the MAP, ragged to the outside. That is the way ranged callouts are set on every
 * plan sheet, and it is not decoration: it keeps every leader's horizontal run the same short
 * length, so the eye reads them as a set rather than as a fan.
 */
function drawLabelGutter(
  ctx: CanvasRenderingContext2D,
  layout: GutterLayout,
  mapX: number,
  mapW: number,
  H: number,
): void {
  const { gutter, rows, pitch } = layout;
  if (!rows.length || gutter <= 0) return;
  const inset = Math.max(6, Math.round(mapW * 0.006));
  const bandX = { left: 0, right: mapX + mapW };
  const edgeX = { left: mapX, right: mapX + mapW };

  for (const side of ['left', 'right'] as const) {
    ctx.save();
    ctx.fillStyle = '#FBF6EC';
    ctx.fillRect(bandX[side], 0, gutter, H);
    ctx.strokeStyle = 'rgba(32,25,15,0.34)';
    ctx.lineWidth = Math.max(1, Math.round(mapW * 0.0009));
    ctx.beginPath();
    ctx.moveTo(edgeX[side], 0);
    ctx.lineTo(edgeX[side], H);
    ctx.stroke();
    ctx.restore();
  }

  // One size for the whole column. The sheet audit caught three different callout sizes on one
  // sheet once already; a per-row "shrink until it fits" is exactly how that happens, so the shrink
  // below is a single factor derived from the WORST row and then applied to every row.
  const maxFs = Math.round(mapW * 0.0155);
  const baseFs = Math.max(15, Math.min(maxFs, Math.round(pitch * 0.46)));
  const room = Math.max(10, gutter - inset * 2);
  const setFont = (size: number) => {
    ctx.font = `650 ${size}px ${REFERENCE_LABEL_FONT}`;
  };
  let fs = baseFs;
  setFont(fs);
  let widest = 1;
  for (const row of rows) widest = Math.max(widest, ctx.measureText(row.text).width / room);
  if (widest > 1) fs = Math.max(Math.round(baseFs * 0.78), Math.round(fs / widest));
  setFont(fs);

  // A row may never paint past its band. "Allowed to be a shade wide" was fine when wide meant
  // nudging the map edge; for a LEFT row right-aligned at the band's inner edge it means growing
  // past x=0, and a cropped head prints as the beheaded fragments Rory read on the flagship
  // ("VE", "ANA", "ROV ×2"). Wrap first; the ellipsis is the last resort, because a truncated
  // tail at least announces itself.
  const trimToRoom = (text: string): string => {
    if (ctx.measureText(text).width <= room) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > room) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  };
  const lineH = fs * 1.12;
  for (const row of rows) {
    // Two lines where the pitch can hold them — and ALSO whenever the single line would overrun
    // the band, pitch or no pitch: colliding with a neighbour is recoverable by the reader,
    // beheaded text is not.
    const overruns = ctx.measureText(row.text).width > room;
    const lines = (pitch >= lineH * 2.1 || overruns ? wrapGutterText(ctx, row.text, room) : [row.text])
      .map(trimToRoom);
    const textX = row.side === 'left' ? edgeX.left - inset : edgeX.right + inset;
    const align: CanvasTextAlign = row.side === 'left' ? 'right' : 'left';
    const top = row.ay - ((lines.length - 1) * lineH) / 2;

    // Leader: out of the band's inner edge, along its OWN row, then a single diagonal to the mark.
    // Same rule as the pills — the long run rides the de-collided label row, never the element's
    // undecollided y, or two leaders at nearly the same feature height merge into one line.
    const targetX = mapX + row.cx;
    const startX = row.side === 'left' ? edgeX.left : edgeX.right;
    const elbowX = row.side === 'left'
      ? Math.min(targetX - fs * 0.5, startX + mapW * 0.02)
      : Math.max(targetX + fs * 0.5, startX - mapW * 0.02);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, row.ay);
    ctx.lineTo(elbowX, row.ay);
    ctx.lineTo(targetX, row.cy);
    ctx.strokeStyle = 'rgba(248,244,232,0.9)';
    ctx.lineWidth = Math.max(3, mapW * 0.0022);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,28,22,0.82)';
    ctx.lineWidth = Math.max(1.2, mapW * 0.0009);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(targetX, row.cy, Math.max(3, mapW * 0.0022), 0, Math.PI * 2);
    ctx.fillStyle = '#24362E';
    ctx.fill();
    ctx.strokeStyle = '#F3EEDB';
    ctx.lineWidth = Math.max(1, mapW * 0.0007);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    setFont(fs);
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#20190F';
    lines.forEach((line, i) => ctx.fillText(line, textX, top + i * lineH));
    ctx.restore();
  }
}

/** Everything the gutter needs for one sheet: the widths it may take, and the rows to range in it.
 *  Kept apart from the paint so a test can assert the layout without a canvas. */
function sheetGutterLayout(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  filter: GlossyLayerFilter,
  labelMode: SheetLabelMode,
): GutterLayout {
  // Both marking modes put the plant's identity on the drawing, so neither may also spend a gutter
  // row on it — one answer per plant. But that trade only holds where codes are actually DRAWN:
  // drawPlantMarks returns early unless sheetElementNaming(filter) === 'individual', and on a
  // grouped sheet ('all') the legend groups still emit one representative defId per family — so
  // gating on labelMode alone silently dropped those defIds' gutter rows on the masterplan while
  // nothing on the map identified them either. Same bug class as "created on a layer its own step
  // switches off": skipped here on the promise of a mark drawn elsewhere, under a different gate.
  const coded = sheetElementNaming(filter) === 'individual' && marksPlantsOnMap(labelMode)
    ? new Set(plantCodesForSheet(exactSheetElementLegendGroups(state, filter).map((g) => g.defId)).keys())
    : new Set<string>();
  const rows: GutterRow[] = [
    ...gutterCalloutRows(state, refLayers, W, H, filter, coded),
  ];
  return layoutGutterRows(rows, {
    mapWidth: W,
    gutter: sheetGutterWidth(W),
    minPitch: Math.max(26, Math.round(H * 0.026)),
    maxPitch: Math.max(44, Math.round(H * 0.052)),
    top: Math.round(H * 0.045),
    // Clear of the scale bar, which is burned into the bottom-left of the map afterwards.
    bottom: H - Math.round(H * 0.075),
  });
}

/**
 * THE LABEL LAYER, AS ONE REUSABLE STEP. This is the exact builder's own label block
 * (see buildReferenceBlueprintMap: drawGroundAreaNames + drawPlantMarks + sheetGutterLayout)
 * extracted so the PAID paths can run it too. Before this existed, the Hybrid finisher stripped
 * every coded plant from its pill layer on the promise of codes it never drew and gutter rows it
 * never laid out — Rory, on the polished planting sheet: "theres no labels". Text is never the
 * model's to draw: everything here is canvas-drawn from the saved design, after the model has
 * returned, so a paid sheet's names are exactly the exact sheet's names.
 */
async function burnExactLabelLayer(
  mapDataUrl: string,
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  filter: GlossyLayerFilter,
  W: number,
  H: number,
  labelMode: SheetLabelMode,
): Promise<{ map: string; gutterLayout?: GutterLayout }> {
  const gutterLayout = filter === 'planting' || filter === 'structures' || filter === 'all'
    ? sheetGutterLayout(state, refLayers, W, H, filter, labelMode)
    : undefined;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { map: mapDataUrl, gutterLayout };
  ctx.drawImage(await loadImage(mapDataUrl), 0, 0, W, H);
  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  if (filter === 'planting') drawGroundAreaNames(ctx, state, refLayers, W, H, filter);
  drawPlantMarks(ctx, state, filter, px, py, W / (frame.imgW * frame.mPerPx), labelMode);
  return { map: canvas.toDataURL('image/png'), gutterLayout };
}

/**
 * The name of a traced AREA, written inside the area.
 *
 * An area label is not a callout. A callout points at a thing too small to write on; a staple
 * garden or a lawn terrace is a region, and every plan sheet ever drawn writes the region's name
 * across the region. Sending these to the label gutter gave "Staple garden" a row on the far right
 * of the sheet with a leader running the whole width of the drawing to reach a plot that was in
 * plain sight — Rory: "look at staple garden label". The leader was carrying no information the
 * position had not already given.
 *
 * Drawn before the per-plant marks, so a plant's own name wins where the two meet: the plot is the
 * context, the plant is the detail.
 */
function drawGroundAreaNames(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  filter: GlossyLayerFilter,
): void {
  const rings = groundLabelsForSheet(state, refLayers, W, H, filter);
  if (!rings.length) return;
  const fs = Math.max(13, Math.round(W * 0.0115));
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${fs}px ${REFERENCE_LABEL_FONT}`;
  for (const ring of rings) {
    const text = sentenceCase(ring.text);
    const textW = ctx.measureText(text).width;
    const padX = fs * 0.5;
    const boxW = textW + padX * 2;
    const boxH = fs * 1.55;
    roundRectPath(ctx, ring.cx - boxW / 2, ring.cy - boxH / 2, boxW, boxH, boxH * 0.32);
    ctx.fillStyle = 'rgba(24,32,26,0.86)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(243,238,219,0.6)';
    ctx.lineWidth = Math.max(0.9, fs * 0.06);
    ctx.stroke();
    ctx.fillStyle = '#F6F1E2';
    ctx.fillText(text, ring.cx, ring.cy + fs * 0.04);
  }
  ctx.restore();
}

function referenceBlueprintLabels(
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  W: number,
  H: number,
  filter: GlossyLayerFilter,
  labelMode: SheetLabelMode = DEFAULT_SHEET_LABEL_MODE,
): ProducerLabel[] {
  // ONE ANSWER PER PLANT. In 'codes' mode the coded plants are withheld from the label engine
  // entirely rather than having their pills drawn and then hidden — a pill that exists is a pill
  // the layout has already spent a leader slot and a margin row on, so suppressing it late would
  // leave the remaining callouts spread as if the plant were still there. Everything WITHOUT a
  // code — tanks, gates, ground features, routes — keeps its callout in both modes, because a
  // legend key it does not appear in cannot name it.
  const coded = labelMode === 'codes'
    ? plantCodesForSheet(exactSheetElementLegendGroups(state, filter).map((group) => group.defId))
    : new Map<string, string>();
  const canonicalState: DesignCanvasState = {
    ...state,
    items: state.items
      .filter((item) => !coded.has(item.defId))
      .map(({ label: _label, ...item }) => item),
    // The integrated masterplan carries the physical design, not the abstract effort-zone bands.
    // Zones retain their own complete sheet and legend; repeating every zone label here was the
    // largest source of crossed leaders and is not present in the supplied masterplan benchmark.
    zones: filter === 'all' ? state.zones.filter((zone) => Boolean(zone.feature)) : state.zones,
  };
  const labels = [
    // Budgeted for the design sheets: merges crowded clusters rather than dropping callouts.
    // See producerLabelsWithinBudget for why a hard cap was the wrong fix in both directions.
    ...producerLabelsWithinBudget(canonicalState, refLayers, W, H, filter, false),
    ...(filter === 'planting' ? groundLabelsForSheet(state, refLayers, W, H, filter) : []),
  ];

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
        .sort(compareLabelRows);
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
    // illustrated legend. Every leader is retained: a dense inventory may need a crowded margin,
    // but silently dropping a valid tree/bed callout makes the map disagree with its own legend.
    const ranked = labels
      .filter((label) => label.leader !== false)
      .sort((a, b) => {
        const rank = (label: ProducerLabel) => label.kind === 'header' ? 0
          : /BEDS|CROPS|TREE|ORCHARD|BANANA|VETIVER|POLLINATOR/.test(label.text) ? 1
            : /DRIVEWAY/.test(label.text) ? 3 : 2;
        return rank(a) - rank(b) || compareLabelRows(a, b);
      });
    // Already budgeted upstream by merging clusters, so nothing is dropped here — this only lays
    // the surviving leaders out down the margins.
    return rebalance(ranked, ranked.length);
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
    .sort((a, b) => compareLabelRows(a.label, b.label))
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
// telling Macadamia from Citrus. So sheets 06/07 colour by SPECIES.
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

/** Existing placed items are discrete site facts, not another ground ring. Keep their marks in
 * the same exact footprint renderer as the design sheets, then name them through the Base sheet's
 * existing extraRows label path so exact and paid Site sheets cannot invent separate callouts.
 *
 * SORTED LIKE EVERY OTHER ITEM STACK. This was the one paint loop that drew items in SAVED ARRAY
 * ORDER, so on the Site and Site-Hybrid sheets a bed the farmer recorded after their citrus
 * painted its crop rows straight over the crown — the same ground-above-canopy inversion
 * compareCartographicPaint exists to settle everywhere else. Nothing about which items are drawn
 * changes; only the order they are laid down in. */
function drawExistingSiteItems(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
): void {
  const items = existingSiteItems(state)
    .filter((item) => !!ELEMENTS_BY_ID[item.defId])
    .sort((a, b) => {
      const da = ELEMENTS_BY_ID[a.defId], db = ELEMENTS_BY_ID[b.defId];
      return compareCartographicPaint(
        { def: da, area: (a.wM ?? da.wM) * (a.hM ?? da.hM), id: a.id },
        { def: db, area: (b.wM ?? db.wM) * (b.hM ?? db.hM), id: b.id },
      );
    });
  for (const item of items) {
    drawTrueFootprint(ctx, item, ELEMENTS_BY_ID[item.defId], px, py, pxPerM);
  }
}

function existingSiteItemRows(
  state: DesignCanvasState,
  W: number,
  H: number,
): Array<{ id: string; text: string; cx: number; cy: number }> {
  return existingSiteItems(state).flatMap((item) => {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) return [];
    return [{
      id: `existing-item-${item.id}`,
      text: (item.label ?? def.name).toUpperCase(),
      cx: item.x * W,
      cy: item.y * H,
    }];
  });
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
  filter: GlossyLayerFilter,
  // Reserved rectangle no right-column label may start inside — the Sector sheet's legend panel
  // sits top-right and is drawn AFTER these labels, so a "PAVING" pill that landed under it got
  // silently clipped (Rory: a render showed a label reading "...VING", the rest hidden behind the
  // legend box). This function has no idea the legend panel exists — it always pins right-column
  // labels to the right margin regardless of what else occupies that corner. Optional so every
  // OTHER caller (sheet 01, the AI-composite path) is unaffected.
  avoidTopRight?: { x0: number; y0: number; x1: number; y1: number },
  // Overrides `filter`'s own selection with a caller-supplied ring set. The Base/Site sheet has no
  // GlossyLayerFilter of its own to pass (it isn't an AI-rendered design layer) and needs a
  // different question answered — see existingSiteGroundRings. Every other caller omits this and
  // keeps today's groundRegister-based selection exactly as before.
  ringsOverride?: DesignCanvasState['zones'],
  // Fixed extra pills this sheet must print that are not Studio zones at all — the Base sheet's
  // main-map house/driveway, whose real geometry lives in refLayers with no name attached (see
  // authoritativeHouseFootprints). Laid out through the SAME left/right column algorithm as every
  // ring pill below, so a farmer reads one consistent kind of label for "what's already here".
  extraRows?: Array<{ id: string; text: string; cx: number; cy: number }>,
): ProducerLabel[] {
  const fs = 26, padX = 14, pillH = fs + 14;
  const rings = ringsOverride ?? groundContentRingsForSheet(state, refLayers, filter);
  if (!rings.length && !extraRows?.length) return [];
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
        // The chip has to say what the plot IS to a farmer choosing a tool ("Staple garden (maize
        // & beans)"); the map has to fit inside the ring it labels. Same reasoning as 'cleared'.
        staple_garden: 'Staple garden',
      };
      // Level suffix — appended BEFORE the dedup filter below, so two platforms of the same kind
      // at DIFFERENT levels (e.g. an upper and a lower lawn) produce two distinct labels, while
      // two at the SAME level (a real duplicate) still correctly collapse to one
      // (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §4a).
      const levelSuffix = z.levelM != null ? ` ${z.levelM >= 0 ? '+' : ''}${z.levelM.toFixed(1)}M` : '';
      const text = (z.name ?? MAP_NAME[z.feature!] ?? GROUND_FEATURES[z.feature!].label).toUpperCase() + levelSuffix;
      const cx = (z.points.reduce((s2, p) => s2 + p[0], 0) / z.points.length) * W;
      const cy = (z.points.reduce((s2, p) => s2 + p[1], 0) / z.points.length) * H;
      return { id: z.id, text, cx, cy, pw: Math.min(W - 28, padX * 2 + text.length * fs * 0.62) };
    })
    // One row per NAME: two lawns AT THE SAME LEVEL are one label, or the margin fills with
    // repeats — but the level suffix above means two lawns at different levels no longer share
    // a name, so this correctly keeps both.
    .filter((r, i, all) => all.findIndex((o) => o.text === r.text) === i)
    .concat((extraRows ?? []).map((r) => ({
      id: r.id,
      text: r.text,
      cx: r.cx,
      cy: r.cy,
      pw: Math.min(W - 28, padX * 2 + r.text.length * fs * 0.62),
    })));

  // Same margin-column layout the producer labels use: pinned to the nearer side, pushed down only
  // as far as needed to clear the row above, so leaders cannot tangle.
  const out: ProducerLabel[] = [];
  (['left', 'right'] as const).forEach((side) => {
    const col = rows
      .filter((r) => (r.cx < W / 2 ? 'left' : 'right') === side)
      .sort(compareLabelRows);
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
      out.push({ id: r.id, cx: r.cx, cy: r.cy, ax, ay: Math.min(y, H - 36), lx: side === 'left' ? ax + r.pw : ax, text: r.text, kind: 'item', leader: true });
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
  return exactSheetGroundLegendGroups(state, refLayers, filter)
    .map((group) => ({
      color: group.color,
      label: group.text,
      style: 'fill' as const,
    }));
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
  /** True when something smaller is planted inside this canopy — see overstoryCanopyIds. */
  isOverstory = false,
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
  const isMatureCanopy = def.category === 'growing' && def.shape === 'circle';
  const inheritedAlpha = ctx.globalAlpha;

  // A CONTEXT CANOPY MUST NOT WEAR THE CASING. The cream ring and opaque backing below exist to
  // separate a canopy this sheet is ABOUT from busy ground and from its neighbours. Drawn at a
  // context alpha they do the opposite: the cream dominates the artwork and a tree comes out as a
  // pale frosted disc — conspicuous, and no longer recognisable as a tree. Raising the structures
  // context alpha to make trees visible made this plainly worse rather than better, which is how
  // it was found. Below full strength, the artwork alone is what reads as a tree.
  const isContextDraw = inheritedAlpha < EXACT_FULL_STRENGTH_ALPHA;

  // The banana circle joins the alpha-following treatment WITHOUT being a canopy. It is category
  // 'earthworks' (a dug basin first), so isMatureCanopy never matched it — and once its v2 art
  // arrived with jagged leaf edges and a transparent field, the old non-canopy path did to it
  // exactly what 'footprint' mode did to every tree: clipped the leaf tips at the footprint
  // circle and stroked a solid ring over the plants. Rory, cropped in on one: "look how blurry
  // the banana circle is, plus a circle border, plus the leaf edges are cropped." The dark void
  // at its centre is painted into the art, so it needs no basin backing either.
  const artworkEdge = (isMatureCanopy || def.id === 'banana_circle') && CANOPY_EDGE_MODE === 'artwork';

  if (isMatureCanopy && !isContextDraw && !artworkEdge) {
    // CASING FIRST, then an opaque backing — the route-line convention this file already uses for
    // sector arrows and water pipes, applied to a canopy. The cream ring is what separates one
    // placed tree from the next where they overlap, and separates all of them from the existing
    // dark-green trees in the photograph. That separation used to be attempted with transparency,
    // which is why Rory could not find his trees at all on a real render.
    traceFootprint();
    ctx.strokeStyle = 'rgba(252,248,236,0.95)';
    ctx.globalAlpha = inheritedAlpha;
    // A SEPARATOR, NOT A HALO. At 3.2x this read as a cut-out sticker rim — Rory: "it just looks
    // like its a bit wrong or off". The casing only has to do one job, which is stop the dark edge
    // below from disappearing into dark photographic foliage; past a hairline it stops separating
    // and starts framing. It cannot go to zero, because a dark-on-dark edge with no casing is
    // exactly the render where he could not find his trees at all — see PLANTING_CANOPY_PAINT.
    // Half the stroke is covered by the artwork drawn over it, so this shows as ~1px of cream.
    ctx.lineWidth = Math.max(1.6, outline * 1.5);
    ctx.lineJoin = 'round';
    ctx.stroke();
    // THE BACKING IS THE BASIN THE TREE STANDS IN — see PLANTING_CANOPY_PAINT's note. A flat cream
    // disc only ever looked right under a dense crown; under an open-crowned pawpaw or moringa the
    // gaps the artwork is painted with showed white, and the tree read as leaves on a coin.
    traceFootprint();
    const soilR = Math.max(1, Math.min(wPx, hPx) / 2);
    const soil = ctx.createRadialGradient(0, 0, soilR * 0.06, 0, 0, soilR);
    soil.addColorStop(0, PLANTING_CANOPY_PAINT.basinCoreColor);
    soil.addColorStop(0.62, PLANTING_CANOPY_PAINT.basinSoilColor);
    soil.addColorStop(1, PLANTING_CANOPY_PAINT.basinRimColor);
    ctx.fillStyle = soil;
    ctx.globalAlpha = inheritedAlpha * PLANTING_CANOPY_PAINT.baseAlpha;
    ctx.fill();
    // Mulch, so the soil is ground rather than an airbrushed disc. Clipped to the footprint and
    // seeded off the item's own id: the same tree stipples identically on every render, and two
    // trees side by side do not stamp as copies of each other.
    if (soilR > 9) {
      ctx.save();
      traceFootprint();
      ctx.clip();
      ctx.globalAlpha = inheritedAlpha * PLANTING_CANOPY_PAINT.mulchAlpha;
      ctx.strokeStyle = PLANTING_CANOPY_PAINT.basinCoreColor;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(0.7, soilR * 0.035);
      ctx.beginPath();
      const flecks = Math.min(46, Math.max(12, Math.round(soilR * 0.5)));
      for (let i = 0; i < flecks; i++) {
        const angle = stableCartographicUnit(it.id, i * 3) * Math.PI * 2;
        // sqrt spreads the flecks evenly over the AREA instead of crowding them at the centre.
        const dist = Math.sqrt(stableCartographicUnit(it.id, i * 3 + 1)) * soilR * 0.93;
        const lie = stableCartographicUnit(it.id, i * 3 + 2) * Math.PI;
        const len = soilR * 0.1;
        const fx = Math.cos(angle) * dist;
        const fy = Math.sin(angle) * dist;
        ctx.moveTo(fx - Math.cos(lie) * len, fy - Math.sin(lie) * len);
        ctx.lineTo(fx + Math.cos(lie) * len, fy + Math.sin(lie) * len);
      }
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = inheritedAlpha;
  }

  ctx.save();
  if (artworkEdge) {
    // In artwork mode the clip is the artwork's own SQUARE bounds, not the inscribed circle.
    // The art is drawn edge-to-edge in a square frame, and clipping that square to its inscribed
    // circle slices every leaf that reaches toward a corner — Rory, on the banana circle: "the
    // leaf edges are cropped". The square is the same saved footprint (wM x hM), so the
    // occupies-exactly-its-ground guarantee is unchanged; only the corner-cutting stops.
    ctx.beginPath();
    ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.clip();
  } else {
    traceFootprint();
    ctx.clip();
  }
  if (isMatureCanopy) ctx.globalAlpha *= PLANTING_CANOPY_PAINT.artworkAlpha;
  // THE BORDER MUST SNUG THE LEAVES, NOT FLOAT OFF THEM.
  //
  // Every one of these PNGs is painted with clear space around the subject, so drawing it at
  // exactly the footprint left the leaves stopping short of the ring — and the cream backing
  // filled that gap, which is the pale band Rory saw between the canopy and its outline: "black
  // border must wrap around the leaves and snug the element, look its offset". Thinning the ring
  // could never fix that, because the gap is not the ring: it is the artwork's own margin.
  //
  // Overdrawing past the footprint pushes the painted subject out to the edge the ring is on. The
  // clip above is what makes this safe — nothing escapes the saved footprint, so the tree still
  // occupies exactly the ground the farmer allocated and no spacing claim changes. Only canopies
  // and beds get it; a tank or a gate is drawn to its own outline and has no margin to close.
  //
  // ...and in 'artwork' mode the bleed is exactly what must NOT happen. Scaling a lobed crown up
  // 14% and letting the clip crop the excess trims the notches off and hands back a disc — the
  // bleed exists to close a margin that jagged art does not have.
  const bleed = isMatureCanopy && !artworkEdge ? ARTWORK_EDGE_BLEED : 1;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (artworkEdge && !isContextDraw) {
    // THE CASING, FOLLOWING THE LEAVES. A canvas shadow is cast from the source's alpha channel,
    // so drawing the image once with a coloured shadow and no offset paints a rim that hugs the
    // crown's real silhouette. Dark first and tight — that is what stops one crown dissolving
    // into the next where two overlap — then cream over it, wider, which is what carries the
    // tree clear of dark photographic foliage (the reason the circular casing existed at all).
    //
    // ONE PASS EACH, and deliberately narrow. Doubling the draws at twice this blur read as a
    // cut-out sticker rim in the probe, which is the same complaint the circular casing already
    // collected once: "it just looks like its a bit wrong or off". A separator, not a halo.
    const span = Math.min(wPx, hPx);
    ctx.save();
    ctx.shadowColor = 'rgba(31,42,29,0.85)';
    ctx.shadowBlur = Math.max(1.5, span * 0.007);
    ctx.drawImage(image, -wPx / 2, -hPx / 2, wPx, hPx);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = 'rgba(252,248,236,0.95)';
    ctx.shadowBlur = Math.max(2, span * 0.011);
    ctx.drawImage(image, -wPx / 2, -hPx / 2, wPx, hPx);
    ctx.restore();
  }
  ctx.drawImage(image, (-wPx / 2) * bleed, (-hPx / 2) * bleed, wPx * bleed, hPx * bleed);
  ctx.restore();

  // A mature canopy is spacing evidence, not an opaque sticker: its illustrated fill lets the
  // neighbouring tree and ground remain readable while the stronger edge keeps both saved
  // footprints explicit through an overlap. Non-canopy assets retain their previous treatment.
  // In 'artwork' mode the solid circular outline is the fifth and last circle to go: the crown's
  // edge is now carried by the alpha-following rim above, and stroking the footprint over it puts
  // the disc straight back.
  //
  // THE DASHED OVERSTORY LINE STAYS, and is the one circle that was never wrong. It does not
  // claim to be the tree's edge — it was the roof-overhang mark. IT NO LONGER DRAWS IN ARTWORK
  // MODE: defended twice on paper, it lost on a real sheet — Rory, pointing at the one ringed
  // litchi among unringed neighbours: "that weird circle around the one tree". A mark only some
  // trees wear reads as an error on those trees, not as a convention; and the crowns now paint
  // smallest-first (compareCartographicPaint), so the big canopy honestly occludes what stands
  // under its edge instead of needing a ring to say so. The legend line goes with it. Classic
  // footprint mode keeps the dash — there the flat washes genuinely need it.
  const skipSolidEdge = artworkEdge;
  if (!skipSolidEdge) {
  traceFootprint();
  ctx.strokeStyle = isMatureCanopy ? PLANTING_CANOPY_PAINT.edgeColor : 'rgba(31,42,29,0.58)';
  if (isMatureCanopy) ctx.globalAlpha *= PLANTING_CANOPY_PAINT.edgeAlpha;
  ctx.lineWidth = isMatureCanopy
    ? Math.max(1, outline * PLANTING_CANOPY_PAINT.edgeWidthScale)
    : Math.max(0.7, outline * 0.5);
  // A DASHED EDGE MEANS "THIS IS ABOVE WHAT YOU CAN SEE INSIDE IT" — the same mark a floor plan
  // uses for a roof overhang. Crowns paint smallest-first now, so the big canopy genuinely covers
  // its understory; the dash is what tells the reader there IS planting beneath this crown, since
  // occlusion alone cannot say so.
  if (isOverstory && isMatureCanopy) {
    const dash = Math.max(4, Math.min(wPx, hPx) * 0.055);
    ctx.setLineDash([dash, dash * 0.72]);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  }
  // Outside the branch: this restore pairs with the save() that opened the whole element draw,
  // so it must run whether or not the solid edge was stroked.
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
/**
 * Sheet 05 treatment for every dug/built feature: bare worked soil, a mulch stipple, a dark
 * keyline, all inside a cream casing.
 *
 * This is the same footprint the Planting and Water sheets draw — same centre, same rotation, same
 * saved size, nothing is moved or resized. What changes is that it is shown as GROUND rather than
 * as a planted thing, because that is what sheet 05 is for: the state of the site after the
 * digging and before the planting. A green bed on a setting-out drawing tells a farmer to plant;
 * a brown one tells them to dig, which is the instruction this sheet exists to give.
 */
function drawEarthworksFeatures(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
): void {
  const items = state.items
    .map((item) => ({ item, def: ELEMENTS_BY_ID[item.defId] }))
    .filter((entry): entry is { item: PlacedItem; def: DesignElementDef } =>
      !!entry.def && itemInFilter(entry.def.category, filter, entry.def.id))
    .sort((a, b) => {
      const areaA = (a.item.wM ?? a.def.wM) * (a.item.hM ?? a.def.hM);
      const areaB = (b.item.wM ?? b.def.wM) * (b.item.hM ?? b.def.hM);
      return areaB - areaA;
    });
  const casing = Math.max(2.5, ctx.canvas.width * 0.0021);
  for (const { item, def } of items) {
    const wPx = Math.max(4, (item.wM ?? def.wM) * pxPerM);
    const hPx = Math.max(4, (item.hM ?? def.hM) * pxPerM);
    const cx = px(item.x);
    const cy = py(item.y);
    ctx.save();
    ctx.translate(cx, cy);
    if (def.shape === 'rect' && item.rot) ctx.rotate((item.rot * Math.PI) / 180);
    const trace = () => {
      if (def.shape === 'circle') {
        ctx.beginPath();
        ctx.ellipse(0, 0, wPx / 2, hPx / 2, 0, 0, Math.PI * 2);
      } else {
        roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, Math.min(wPx, hPx) * 0.1);
      }
    };
    trace();
    ctx.strokeStyle = 'rgba(252,248,236,0.92)';
    ctx.lineWidth = casing * 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    trace();
    ctx.fillStyle = CROP_SOIL_COLOR;
    ctx.fill();

    // Mulch: deterministic flecks, so the same bed stipples identically on every render and every
    // device. Straw over bare soil is what these features actually look like once built, and it is
    // the fastest way to read "this is a finished earthwork" rather than "this is a coloured box".
    // A MOUND IS NOT A CUT, AND MUST NOT LOOK LIKE ONE. Rory, looking at sheet 05: "what is the
    // difference between a berm/contour bank and a swale?" — asked because the sheet was drawing
    // them as near-identical brown bars, when they are opposite structures. A swale is a level
    // trench that INFILTRATES water where it falls; a contour bank is a raised, usually graded
    // ridge that INTERCEPTS runoff and leads it to a safe outlet. Drawing them alike tells a
    // farmer to build the wrong one.
    //
    // The swale already reads as a cut (ditch lane plus hachures, the standard convention for a
    // cut face — see drawSwaleCrossSection). These read as raised ground instead: a lit crest
    // along the ridge with a shadow down one flank, and deliberately NO hachures, because
    // hachures on a mound would say "excavated" about something that was heaped up.
    if (EARTH_MOUND_IDS.has(def.id)) {
      ctx.save();
      trace();
      ctx.clip();
      const alongX = wPx >= hPx;
      const half = (alongX ? hPx : wPx) / 2;
      const grad = alongX
        ? ctx.createLinearGradient(0, -half, 0, half)
        : ctx.createLinearGradient(-half, 0, half, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.22)');
      grad.addColorStop(0.42, 'rgba(233,205,158,0.5)');
      grad.addColorStop(0.55, 'rgba(198,161,110,0.32)');
      grad.addColorStop(1, 'rgba(0,0,0,0.34)');
      ctx.fillStyle = grad;
      ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
      // The crest line: where the ridge actually peaks, and the thing a farmer pegs to.
      ctx.strokeStyle = 'rgba(244,226,190,0.85)';
      ctx.lineWidth = Math.max(1, half * 0.16);
      ctx.beginPath();
      if (alongX) { ctx.moveTo(-wPx / 2, -half * 0.12); ctx.lineTo(wPx / 2, -half * 0.12); }
      else { ctx.moveTo(-half * 0.12, -hPx / 2); ctx.lineTo(-half * 0.12, hPx / 2); }
      ctx.stroke();
      ctx.restore();
      trace();
      ctx.strokeStyle = 'rgba(40,28,17,0.92)';
      ctx.lineWidth = casing * 0.75;
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    trace();
    ctx.clip();
    const fleck = Math.max(1.6, Math.min(wPx, hPx) * 0.055);
    const count = Math.min(90, Math.max(8, Math.round((wPx * hPx) / (fleck * fleck * 26))));
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.9, fleck * 0.34);
    for (let i = 0; i < count; i += 1) {
      const fx = (stableUnit(item.id, i * 3) - 0.5) * wPx;
      const fy = (stableUnit(item.id, i * 3 + 1) - 0.5) * hPx;
      const angle = stableUnit(item.id, i * 3 + 2) * Math.PI;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(214,188,142,0.75)' : 'rgba(150,118,80,0.75)';
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(angle) * fleck, fy - Math.sin(angle) * fleck);
      ctx.lineTo(fx + Math.cos(angle) * fleck, fy + Math.sin(angle) * fleck);
      ctx.stroke();
    }
    ctx.restore();

    trace();
    ctx.strokeStyle = 'rgba(40,28,17,0.92)';
    ctx.lineWidth = casing * 0.75;
    ctx.stroke();
    ctx.restore();
  }

  // A PIT PER TREE, because that is the ground work planting a tree actually is. Rory: "tree basin
  // should automatically appear here" — on the setting-out sheet, every tree the design places is
  // a hole somebody has to dig, and a sheet that lists swales and beds but not thirty-two tree
  // pits under-states the job.
  //
  // DERIVED, NOT PLACED. These are drawn from the trees, never written into the saved design and
  // never counted in the Bill of Quantities — a farmer who also placed real tree_basin elements
  // would otherwise find every pit listed twice, and a render that silently added items to a
  // design would break the rule that rendering never mutates what the farmer drew. Trees that DO
  // already have their own basin element are skipped, so the two can never double up on the page
  // either.
  const placedBasins = state.items.filter((item) => item.defId === 'tree_basin');
  const basinDef = ELEMENTS_BY_ID.tree_basin;
  if (basinDef) {
    for (const item of state.items) {
      const def = ELEMENTS_BY_ID[item.defId];
      if (!def || def.category !== 'growing' || def.shape !== 'circle') continue;
      const alreadyDug = placedBasins.some((basin) => {
        const dx = (basin.x - item.x) * ctx.canvas.width;
        const dy = (basin.y - item.y) * ctx.canvas.height;
        return Math.hypot(dx, dy) < Math.max(6, (basinDef.wM * pxPerM) * 0.75);
      });
      if (alreadyDug) continue;
      const r = Math.max(5, (basinDef.wM * pxPerM) / 2);
      const cx = px(item.x);
      const cy = py(item.y);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(252,248,236,0.9)';
      ctx.lineWidth = casing * 1.2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = CROP_SOIL_COLOR;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([Math.max(3, r * 0.3), Math.max(2, r * 0.22)]);
      ctx.strokeStyle = 'rgba(40,28,17,0.9)';
      ctx.lineWidth = casing * 0.6;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

/** How many tree pits sheet 05 will DERIVE — trees with no basin of their own already placed.
 *  Exported so the legend can name them: nothing is drawn on these sheets without a legend row,
 *  and a derived mark is no exception. */
export function derivedTreeBasinCount(state: DesignCanvasState, frame: CanvasFrame): number {
  const basinDef = ELEMENTS_BY_ID.tree_basin;
  if (!basinDef) return 0;
  const pxPerM = 1 / frame.mPerPx;
  const placed = state.items.filter((item) => item.defId === 'tree_basin');
  return state.items.filter((item) => {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || def.category !== 'growing' || def.shape !== 'circle') return false;
    return !placed.some((basin) => {
      const dx = (basin.x - item.x) * frame.imgW;
      const dy = (basin.y - item.y) * frame.imgH;
      return Math.hypot(dx, dy) < Math.max(6, basinDef.wM * pxPerM * 0.75);
    });
  }).length;
}

/** Earthworks that are HEAPED UP rather than dug out, and so must read as raised ground. A swale is
 *  the opposite case and keeps its cut treatment; see the note in drawEarthworksFeatures. */
const EARTH_MOUND_IDS = new Set(['berm', 'terrace', 'mulch_bank', 'half_moon']);

/** The beds that get drawn as rows of a real crop rather than one shared bed illustration. */
const PRODUCTION_BED_IDS = new Set(['veg_bed', 'raised_bed']);

/**
 * Draw a production bed as worked soil with its actual crop in rows. Returns false when the bed is
 * too small on this sheet for rows to read, so the caller can fall back to the shared artwork.
 *
 * The crop comes from the bed's own saved data — its chosen species, else the farmer's label — and
 * an unrecognised name draws a plain plant rather than guessing at a crop. Nothing about spacing,
 * plant count or variety is asserted: this draws what the farmer chose, at a drawing rhythm.
 */
/**
 * Vetiver: drawn from above rather than pasted in from the side. The geometry, the reasoning and
 * the constants live in lib/vetiver-hedge.ts so they can be tested and rendered on their own.
 */
function paintVetiverHedge(
  ctx: CanvasRenderingContext2D,
  it: PlacedItem,
  def: DesignElementDef,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
): boolean {
  const wM = it.wM ?? def.wM;
  const hM = it.hM ?? def.hM;
  // THE SAME PRESENTATION STEP EVERY OTHER PLANTING FEATURE GETS. Drawing the hedge before the
  // artwork block also stepped around plantingFeaturePresentationDimensions, which every bed,
  // canopy and strip on this sheet passes through — so a vetiver bank came out smaller on the
  // finished sheet than the identical bank the farmer had just placed on the canvas beside it.
  // Rory: "look at the width/height of the vetiver here compared to the map i posted earlier on
  // the final sheet its way to small - i want it true to width just like when i post the element
  // in designing." The floor only ever enlarges a symbol already too small to measure and never
  // shrinks one, so this restores agreement without overriding a stated size.
  const printed = plantingFeaturePresentationDimensions(
    def.id,
    Math.max(1, wM * pxPerM),
    Math.max(1, hM * pxPerM),
    ctx.canvas.width,
  );
  const wPx = printed.width;
  const hPx = printed.height;
  // Metres per drawn pixel follow the printed size, so the tuft geometry stays consistent with the
  // band it is drawn in rather than with the unscaled footprint.
  const drawnPxPerM = wM > 0 ? wPx / wM : pxPerM;
  // A clump below this is a smudge rather than a plant, so the hedge becomes a legible map symbol
  // instead of a literal one-mark-per-slip drawing. See lib/vetiver-hedge.ts.
  const minClumpPx = Math.max(2.6, ctx.canvas.width * 0.0015);
  ctx.save();
  ctx.translate(px(it.x), py(it.y));
  if (it.rot) ctx.rotate((it.rot * Math.PI) / 180);
  // THE CASING IS A HAIRLINE, NOT A SECOND HEDGE. It is stroked ON the tussock band's edge, so
  // half of it lies outside the drawn clumps — on a 0.52 m row that was another ~55% of width
  // added to a band already drawn too wide. Capped against the band for the same reason the clump
  // radius is: a legibility device may not enlarge a stated measurement. See VETIVER_BLADE_REACH.
  const casing = Math.min(Math.max(2, ctx.canvas.width * 0.0018), Math.min(wPx, hPx) * 0.3);
  const painted = paintTopDownVetiverHedge(
    ctx,
    {
      widthPx: wPx,
      heightPx: hPx,
      widthM: wM,
      heightM: hM,
      pxPerM: drawnPxPerM,
      minClumpPx,
      seedId: it.id,
      casingWidth: casing,
    },
  );
  ctx.restore();
  return painted;
}

function drawProductionBedCrop(
  ctx: CanvasRenderingContext2D,
  it: PlacedItem,
  def: DesignElementDef,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
): boolean {
  const wPx = Math.max(1, (it.wM ?? def.wM) * pxPerM);
  const hPx = Math.max(1, (it.hM ?? def.hM) * pxPerM);
  // A named crop always wins. Only when the farmer has told us nothing usable — no species, and a
  // label like "Bed 3" that names no plant — does the bed take a rotated silhouette so a garden of
  // seven unassigned beds stops printing as seven identical rectangles. See unnamedBedGlyph for why
  // this varies the DRAWING and never the legend, the callouts or the BOQ.
  const named = cropGlyphFor(it.speciesId ?? it.label);
  const glyph = named === 'generic' ? unnamedBedGlyph(it.id) : named;
  // THE MARK IS SIZED FROM THE PAGE, NOT FROM THE ROW PITCH. Rory, off a live sheet and AFTER the
  // oversized cabbage head shipped: "veg beds still don't have large veg." The head was fine; it
  // was drawn at 0.42 of a row pitch that is itself the bed's 1.2 m width divided by its rows, so
  // every mark in every bed came out around 15 px on a 1920 px master — a speck. bedCropMarkUnitPx
  // asks the page how big a vegetable has to be to be a vegetable, then the layout is given that
  // pitch so the bed carries a few large heads instead of a dusting of dots. The bed's own
  // footprint, rotation, legend row and count are untouched: this is symbol size only.
  const markUnitPx = bedCropMarkUnitPx(Math.min(wPx, hPx), Math.max(wPx, hPx), ctx.canvas.width);
  // Zero means this bed is too small on THIS sheet for any vegetable to read — the shared bed
  // artwork is the honest answer there. See MIN_DRAWN_VEG_MARK_SHEET_FRACTION.
  if (markUnitPx <= 0) return false;
  const layout = bedCropRows(
    wPx,
    hPx,
    glyph,
    it.id,
    Math.max(10, ctx.canvas.width * 0.0085),
    bedCropMarkPitchPx(markUnitPx),
  );
  // ONE REAL VEGETABLE BEATS THE SHARED STICKER. This used to demand three plants before it would
  // draw, and at sheet scale a 1.2 m bed rarely reached three — so the bed fell through to
  // production-bed-v1.png, the one green rectangle every bed on the farm shared, and the crop
  // drawing below was never reached at all. That is the "beds are still small generic marks"
  // report, one layer under the mark size. With the marks now page-sized, a bed carrying a single
  // recognisable cabbage says more than the sticker ever did.
  if (!layout.plants.length) return false;

  const cx = px(it.x);
  const cy = py(it.y);
  const radius = Math.min(wPx, hPx) * 0.1;
  ctx.save();
  ctx.translate(cx, cy);
  if (it.rot) ctx.rotate((it.rot * Math.PI) / 180);
  ctx.lineJoin = 'round';

  // Cream casing, then worked soil, then the crop — the same body-inside-a-casing order every
  // other mark on these sheets now uses to survive an aerial photograph.
  roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, radius);
  ctx.strokeStyle = 'rgba(252,248,236,0.92)';
  ctx.lineWidth = Math.max(2.5, ctx.canvas.width * 0.0022);
  ctx.stroke();
  roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, radius);
  ctx.fillStyle = CROP_SOIL_COLOR;
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, radius);
  ctx.clip();
  drawCropRowLayout(ctx, layout, '#6B8F4E', 1, markUnitPx);
  ctx.restore();

  roundRectPath(ctx, -wPx / 2, -hPx / 2, wPx, hPx, radius);
  ctx.strokeStyle = 'rgba(38,28,18,0.9)';
  ctx.lineWidth = Math.max(1.2, ctx.canvas.width * 0.0011);
  ctx.stroke();
  ctx.restore();
  return true;
}

function drawTrueFootprint(
  ctx: CanvasRenderingContext2D,
  it: PlacedItem,
  def: DesignElementDef,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  emphasizeSmallFeatures = true,
  nearestNeighbourPx?: number,
  /** Ids of canopies with something smaller planted inside them — see overstoryCanopyIds. */
  overstory?: ReadonlySet<string>,
): void {
  const waterArtwork = def.category === 'water' || [
    'banana_circle', 'tree_basin', 'greywater_basin', 'infiltration_basin',
    'half_moon', 'berm', 'terrace', 'mulch_bank', 'duck_pond',
  ].includes(def.id);
  // A PRODUCTION BED SHOWS THE CROP THAT IS IN IT. Every vegetable and raised bed on every sheet
  // shared ONE piece of artwork (production-bed-v1.png), so nine beds of nine different crops
  // printed as nine identical green rectangles. Rory, having asked before: "veg beds improve,
  // brown background with actual veg — i hav asked and asked gawd please do it! put cabbages
  // tomotoes etc etc".
  //
  // Drawn rather than painted, because the crop is per-bed data: the bed's chosen species (or the
  // farmer's own label) picks the silhouette, so a cabbage bed and a tomato bed are different
  // drawings of the farm rather than the same sticker twice. Falls through to the shared artwork
  // when the bed is too small on this sheet to read as rows — an unreadable smudge of dots is
  // worse than the rectangle it replaced.
  if (PRODUCTION_BED_IDS.has(def.id)) {
    if (drawProductionBedCrop(ctx, it, def, px, py, pxPerM)) return;
  }
  // Ahead of the artwork for the same reason production beds are: the shared asset is a photograph
  // taken from the side, and this draws the thing itself, from above. Falls through only when the
  // footprint is too short to read as a hedge at all.
  if (VETIVER_HEDGE_IDS.has(def.id)) {
    if (paintVetiverHedge(ctx, it, def, px, py, pxPerM)) return;
  }
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
      overstory?.has(it.id) ?? false,
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
    const inheritedAlpha = ctx.globalAlpha;
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

    // The pale backing quiets busy satellite texture beneath a newly placed tree without the
    // alpha increase that previously made overlapping placed canopies merge into one wash.
    traceCanopy();
    ctx.fillStyle = PLANTING_CANOPY_PAINT.baseColor;
    ctx.globalAlpha = inheritedAlpha * PLANTING_CANOPY_PAINT.baseAlpha;
    ctx.fill();
    ctx.globalAlpha = inheritedAlpha;

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
    ctx.globalAlpha = inheritedAlpha * PLANTING_CANOPY_PAINT.washAlpha;
    ctx.fill();
    ctx.globalAlpha = inheritedAlpha;
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
      ctx.globalAlpha = inheritedAlpha * (
        PLANTING_CANOPY_PAINT.detailAlphaMin
        + stableCartographicUnit(seed, 400 + i)
          * (PLANTING_CANOPY_PAINT.detailAlphaMax - PLANTING_CANOPY_PAINT.detailAlphaMin)
      );
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
        ctx.globalAlpha = inheritedAlpha * PLANTING_CANOPY_PAINT.detailAlphaMax;
        ctx.fill();
      }
    }
    ctx.globalAlpha = inheritedAlpha;
    ctx.restore();

    traceCanopy();
    ctx.strokeStyle = PLANTING_CANOPY_PAINT.edgeColor;
    ctx.globalAlpha = inheritedAlpha * PLANTING_CANOPY_PAINT.edgeAlpha;
    ctx.lineWidth = Math.max(1, outline * PLANTING_CANOPY_PAINT.edgeWidthScale);
    ctx.stroke();
    ctx.globalAlpha = inheritedAlpha;
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
      // A single hairline per row collapsed into a flat brown block at normal sheet size. Keep
      // the saved bed footprint, but make the planting readable as repeated rows at a glance.
      ctx.strokeStyle = '#B9E36C';
      ctx.lineWidth = Math.max(1.4, outline * 1.15);
      for (let i = 1; i <= rows; i++) {
        const y = -hPx / 2 + (i / (rows + 1)) * hPx;
        ctx.beginPath();
        ctx.moveTo(-wPx / 2 + 2, y);
        ctx.lineTo(wPx / 2 - 2, y);
        ctx.stroke();

        const plantCount = Math.max(3, Math.min(10, Math.round(wPx / 12)));
        const spacing = (wPx - 8) / plantCount;
        // A pair of angled ticks read as generic grass at sheet scale. A small repeated rosette
        // reads as a planted vegetable without pretending to identify a particular crop species.
        const rosetteRadius = Math.max(1.6, Math.min(3.2, shortPx * 0.11));
        const petalRadius = rosetteRadius * 0.62;
        ctx.lineWidth = Math.max(1.1, outline * 0.9);
        for (let j = 0; j < plantCount; j++) {
          const x = -wPx / 2 + 4 + spacing * (j + 0.5);
          ctx.save();
          ctx.translate(x, y);
          for (let petal = 0; petal < 5; petal++) {
            const angle = (petal / 5) * Math.PI * 2 - Math.PI / 2;
            ctx.beginPath();
            ctx.ellipse(
              Math.cos(angle) * rosetteRadius * 0.38,
              Math.sin(angle) * rosetteRadius * 0.38,
              petalRadius * 0.48,
              petalRadius * 0.76,
              angle,
              0,
              Math.PI * 2,
            );
            ctx.fillStyle = '#A7D266';
            ctx.fill();
            ctx.strokeStyle = '#D5F28A';
            ctx.stroke();
          }
          ctx.beginPath();
          ctx.arc(0, 0, Math.max(0.9, rosetteRadius * 0.24), 0, Math.PI * 2);
          ctx.fillStyle = '#6F9C45';
          ctx.fill();
          ctx.restore();
        }
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
/**
 * Drawing fallback for a swale whose width the farmer has not set — how wide the band is PAINTED,
 * not advice about how wide to dig. Nothing prints it as a dimension, and a farmer who sets
 * LineShape.widthM overrides it entirely. Real swale sizing depends on rainfall, slope and soil,
 * which is a decision for the farmer and their extension officer, not a constant in a renderer.
 */
const SWALE_DEFAULT_WIDTH_M = 1.5;

/** Paints a swale as the earthwork it is: a cut ditch, a spoil berm beside it, and the pegged
 *  contour centreline between them — so the sheet can be used to set the work out on the ground
 *  rather than only showing the route water takes. Geometry is offset for drawing only; the saved
 *  centreline is never modified. See offsetPolyline for the side convention and why. */
function drawSwaleCrossSection(
  ctx: CanvasRenderingContext2D,
  screenPoints: Array<[number, number]>,
  style: EarthworksRouteStyle,
  pxPerM?: number,
  widthM?: number,
): void {
  if (screenPoints.length < 2) return;
  const smooth = polishedRenderPoints(screenPoints as RenderPoint[]) as Array<[number, number]>;
  // GROUND SIZE, NOT PIXEL WEIGHT. A stated width is a farmer's measurement, so it owns the
  // printed band outright: the old Math.max below a pixel floor quietly redrew narrow swales
  // wider than they were saved. Only an UNSTATED width may take the scale-aware presentation
  // fallback; it is deliberately never printed as a dimension or offered as digging advice.
  const hasStatedWidth = Number.isFinite(widthM) && (widthM as number) > 0;
  const statedHalf = hasStatedWidth && pxPerM && pxPerM > 0
    ? (widthM as number) * pxPerM * 0.5
    : null;
  const unstatedHalf = pxPerM && pxPerM > 0
    ? SWALE_DEFAULT_WIDTH_M * pxPerM * 0.5
    : style.width * 0.9;
  // A caller without a map scale cannot convert saved metres to pixels. Its single line is a
  // visibility fallback only; every exact sheet supplies pxPerM and therefore preserves width.
  const half = statedHalf ?? Math.max(style.width * 0.9, unstatedHalf);
  // Each half of the band is one LANE. Its stroke is `half` wide, so its centreline sits at
  // half/2 — a stroke centred on the full offset would hang outside the band and leave the
  // middle showing bare casing, which is what made the first attempt read as three flat stripes.
  const lane = half;
  const ditch = offsetPolyline(smooth, half / 2);
  const berm = offsetPolyline(smooth, -half / 2);
  const path = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
  };

  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'round';

  // The whole disturbed strip first, as one dark cut edge, so ditch and berm read as one built
  // thing rather than two unrelated lines running side by side.
  path(smooth);
  ctx.strokeStyle = style.casing;
  ctx.lineWidth = half * 2 + Math.max(2, lane * 0.28);
  ctx.stroke();

  // The DITCH: the excavated channel. Darker than the spoil, because it is a hole.
  path(ditch);
  ctx.strokeStyle = '#4A2F1B';
  ctx.lineWidth = lane;
  ctx.stroke();

  // The BERM: the spoil bank, in the warmer loose-soil tone.
  path(berm);
  ctx.strokeStyle = style.color;
  ctx.lineWidth = lane;
  ctx.stroke();

  // Hachure ticks ACROSS the berm — the standard plan symbol for an embankment, and the thing
  // that stops a two-tone band still reading as one flat plank. They run down the face of the
  // bank, from the pegged contour out to its toe, the way a surveyor draws a batter.
  //
  // Stepped along the line by DISTANCE and interpolated WITHIN each segment. Hanging them off the
  // saved vertices instead put three ticks on a near-straight swale, hundreds of pixels apart,
  // because a straight run has almost no vertices to hang them from — so the bank went on reading
  // as a plain block no matter how the spacing rule was tuned.
  ctx.strokeStyle = style.casing;
  ctx.lineWidth = Math.max(1, lane * 0.16);
  const tickGap = Math.max(6, lane * 1.25);
  let carry = 0;
  for (let i = 1; i < smooth.length; i++) {
    const [ax, ay] = smooth[i - 1];
    const [bx, by] = smooth[i];
    const segLen = Math.hypot(bx - ax, by - ay);
    if (segLen < 1e-6) continue;
    // Unit normal pointing at the berm — the same side offsetPolyline puts a negative offset on.
    const nx = (by - ay) / segLen;
    const ny = -(bx - ax) / segLen;
    for (let d = carry; d < segLen; d += tickGap) {
      const t = d / segLen;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + nx * half, y + ny * half);
      ctx.stroke();
    }
    carry = (carry - segLen) % tickGap;
    if (carry < 0) carry += tickGap;
  }

  // The pegged contour itself, hairline, between the two — this is the line the farmer sets out
  // with an A-frame before anything is cut (phasing text: "Peg the contour ... before you cut").
  path(smooth);
  ctx.strokeStyle = 'rgba(246,240,222,0.8)';
  ctx.lineWidth = Math.max(0.8, lane * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawFilteredLines(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  px: (n: number) => number,
  py: (n: number) => number,
  /** Pixels per ground metre. Supplied so an EARTHWORK can be drawn at the size it will actually
   *  be dug, rather than at a fixed pixel width that shrinks to a hairline on a big sheet. */
  pxPerM?: number,
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const l of state.lines) {
    const color = LINE_COLORS[l.kind];
    if (!color || l.points.length < 2 || !lineInFilter(l.kind, filter)) continue;
    const earthworksStyle = filter === 'earthworks' && l.kind === 'swale'
      ? EARTHWORKS_ROUTE_STYLE.swale
      : undefined;
    const trace = () => {
      const drawPoints = polishedRenderPoints(
        l.points.map(([x, y]) => [px(x), py(y)] as RenderPoint),
      );
      ctx.beginPath();
      drawPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, y));
    };
    // A bed path prints with planting-cartography's own tight-dash hairline wherever it is
    // admitted (planting + all) — the declared style, not the generic 3.5px route stroke.
    // Windbreak stays on its LINE_COLORS stroke deliberately: restyling it here would change
    // sheets this fix has no business touching.
    const routeVisual = filter === 'structures'
      ? structuresRouteVisualFor(l.kind)
      : l.kind === 'bedpath' ? PLANTING_ROUTE_STYLE.bedpath
      : null;
    if (earthworksStyle) {
      drawSwaleCrossSection(
        ctx,
        l.points.map(([x, y]) => [px(x), py(y)] as [number, number]),
        earthworksStyle,
        pxPerM,
        l.widthM,
      );
      continue;
    }
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

/** Semantic ground-to-canopy stack, then footprint size within each register — largest first for
 *  ground systems (a tree basin must sit UNDER its tree even though it has the smaller footprint;
 *  size-only ordering painted those brown basin symbols over the foliage on the integrated
 *  masterplan), SMALLEST first for canopies so a big crown occludes the smaller plants under its
 *  edge. The direction lives in compareCartographicPaint — one authority for every paint loop. */
function byCartographicStack(state: DesignCanvasState, filter: GlossyLayerFilter): PlacedItem[] {
  return state.items
    .filter((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      return !!def && itemInFilter(def.category, filter, def.id);
    })
    .sort((a, b) => {
      const da = ELEMENTS_BY_ID[a.defId], db = ELEMENTS_BY_ID[b.defId];
      return compareCartographicPaint(
        { def: da, area: (a.wM ?? da.wM) * (a.hM ?? da.hM), id: a.id },
        { def: db, area: (b.wM ?? db.wM) * (b.hM ?? db.hM), id: b.id },
      );
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
      return compareCartographicPaint(
        { def: da, area: (a.wM ?? da.wM) * (a.hM ?? da.hM), id: a.id },
        { def: db, area: (b.wM ?? db.wM) * (b.hM ?? db.hM), id: b.id },
      );
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
  // Which canopies have something planted UNDER them. Measured off the printed footprint, not the
  // saved metres, because the question is about the drawing: does another plant's centre fall
  // inside this one's disc as it will appear on the sheet. See overstoryCanopyIds.
  const overstory = overstoryCanopyIds(items.map((it) => {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) return { id: it.id, cx: px(it.x), cy: py(it.y), rPx: 0 };
    const naturalW = Math.max(1, (it.wM ?? def.wM) * pxPerM);
    const naturalH = Math.max(1, (it.hM ?? def.hM) * pxPerM);
    const printed = plantingFeaturePresentationDimensions(def.id, naturalW, naturalH, ctx.canvas.width);
    return {
      id: it.id,
      cx: px(it.x),
      cy: py(it.y),
      rPx: def.shape === 'circle' ? Math.min(printed.width, printed.height) / 2 : 0,
    };
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
      overstory,
    );
  }
}

/**
 * A short code on every plant, keyed to the legend row that names it — see lib/plant-codes.ts.
 *
 * DRAWN LAST, AFTER THE CALLOUT PILLS, and that ordering is the whole reason this is its own pass
 * rather than a few lines inside drawTrueFootprint. Two things want the same pixels: a leader
 * terminates at an item's centre, and the pills are burned onto the sheet after the feature overlay
 * is composited. Drawn with the footprints, both moringas on the first real render carried a code
 * that the moringa pill then sat straight on top of — a mark that identifies nothing. Lifting the
 * chip off centre only moved which pill covered it. A code is small and a pill is large, so the
 * only ordering where neither is destroyed is this one.
 *
 * Only where the legend names species individually. On the masterplan the legend groups them into
 * families, so a code there would be a mark with nothing to look it up in — which is the "nothing
 * drawn without a legend row" invariant, read in the other direction.
 */
/**
 * The plant's own identity, written ON the drawing — a two-letter code, or its full name.
 *
 * ONE FUNCTION FOR BOTH because they are the same decision made at two lengths: is this plant big
 * enough on the page to carry its own identity, and where does the mark sit so it belongs to that
 * plant and no other. Splitting them produced two answers to those questions within a week.
 *
 * 'codes'   sits just above the plant's centre — a two-letter chip fits on almost anything.
 * 'onplant' sits just UNDER the plant's footprint, because a full name rarely fits on top of one
 *           without covering the artwork the farmer is trying to read. Rory: "names just under
 *           plant or on tree/plant".
 */
function drawPlantMarks(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  filter: GlossyLayerFilter,
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
  mode: SheetLabelMode,
): void {
  if (sheetElementNaming(filter) !== 'individual') return;
  if (!marksPlantsOnMap(mode)) return;
  // THE LEGEND ASSIGNS THE CODES, NOT THE MAP. Both sides call plantCodesForSheet with the SAME
  // input — this sheet's legend groups — so the two cannot drift apart. Deriving map codes from the
  // drawn items instead would work today and break the first time a farmer adds a plant the catalog
  // does not know, because an unknown plant's code is derived and therefore depends on what else is
  // in the set. A code that does not appear in the legend is a mark with no key.
  //
  // In 'onplant' the set still decides WHICH plants are marked, for the same reason: a plant with
  // no legend row of its own is one the sheet has grouped, and writing its species on the map would
  // contradict the key.
  const codes = plantCodesForSheet(exactSheetElementLegendGroups(state, filter).map((g) => g.defId));
  if (!codes.size) return;
  // The same stack the footprints were drawn from, so a mark cannot appear on a plant this sheet
  // did not draw.
  const drawable = byCartographicStack(state, filter).filter((it) => codes.has(it.defId));
  if (!drawable.length) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const printedFor = (it: (typeof drawable)[number], def: DesignElementDef) => {
    const naturalW = Math.max(1, (it.wM ?? def.wM) * pxPerM);
    const naturalH = Math.max(1, (it.hM ?? def.hM) * pxPerM);
    return plantingFeaturePresentationDimensions(def.id, naturalW, naturalH, ctx.canvas.width);
  };
  // The same dark plaque the map callouts and sector marks wear. A mark has to survive landing on
  // dark foliage, on cream mulch and on plain paper, and only an opaque plate does all three.
  const paintChip = (text: string, fs: number, cx: number, cy: number, chipW: number, chipH: number) => {
    ctx.font = `800 ${fs}px ${REFERENCE_LABEL_FONT}`;
    roundRectPath(ctx, cx - chipW / 2, cy - chipH / 2, chipW, chipH, chipH * 0.34);
    ctx.fillStyle = 'rgba(24,32,26,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(243,238,219,0.72)';
    ctx.lineWidth = Math.max(0.8, fs * 0.07);
    ctx.stroke();
    ctx.fillStyle = '#F6F1E2';
    ctx.fillText(text, cx, cy + fs * 0.04);
  };

  if (mode === 'onplant') {
    // EVERY PLANT IS COVERED — its own chip, or a counted group chip. This mode used to keep three
    // quiet ways of writing nothing: a <22 px size gate, a width budget that rejected long names on
    // small plants, and a clash check that DELETED the losing chip. The gutter had already withheld
    // these plants on the promise of a mark drawn here, so a dropped chip was a plant with no label
    // anywhere on the sheet — Rory, off a live render: small crowns with no caption, and three
    // banana clumps of which one said "Banana Clump". planPlantNameChips owns the layout now:
    // same-name neighbours whose chips would collide MERGE into "Banana Clump ×3" anchored on a
    // real clump, cross-name clashes push downward, and nothing is dropped. Grouping stays under
    // labelsEverySpecimen's authority — perennials a chip each, beds/rows/strips one counted chip
    // (Rory: "please only put one raised bed label").
    const specimens = drawable.map((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      const printed = printedFor(it, def);
      return {
        id: it.id,
        defId: it.defId,
        name: it.label ?? def.name,
        cx: px(it.x),
        cy: py(it.y),
        w: printed.width,
        h: printed.height,
      };
    });
    const measure = (text: string, anchor: PlantChipSpecimen) => {
      // TWO SIZES, AND ONLY TWO. Rory: "you can have 2 size fonts again to accommodate name
      // length." A free shrink-to-fit is what produced three different callout sizes on one sheet
      // and it is still the wrong answer; one deliberate smaller step for the long names is not.
      // The chip takes the first size that fits its plant, or the smaller size regardless — a name
      // slightly wide of a small plant still marks it; a missing name marks nothing.
      //
      // Floored at the old 22 px gate value so a tiny crown takes a normal small chip rather than
      // a microscopic one — the name sits BELOW the footprint, so plant size never made it
      // unreadable, only the old gate's refusal did.
      const gateSide = Math.max(anchor.w, anchor.h, 22);
      const baseFs = Math.max(11, Math.min(gateSide * 0.34, ctx.canvas.width * 0.0125));
      const widthBudget = gateSide * 1.9;
      let fs = baseFs * 0.76;
      let w = 0;
      for (const candidate of [baseFs, baseFs * 0.76]) {
        ctx.font = `800 ${candidate}px ${REFERENCE_LABEL_FONT}`;
        w = ctx.measureText(text).width + candidate * 0.84;
        fs = candidate;
        if (w <= widthBudget) break;
      }
      return { fs, w, h: fs * 1.5 };
    };
    for (const chip of planPlantNameChips(specimens, measure, { W: ctx.canvas.width, H: ctx.canvas.height })) {
      paintChip(chip.text, chip.fs, chip.cx, chip.cy, chip.w, chip.h);
    }
    ctx.restore();
    return;
  }

  // 'codes': a two-letter chip on every plant — a code IS per-plant identity and the legend keys
  // it, so unlike names there is nothing to group or count.
  for (const it of drawable) {
    const def = ELEMENTS_BY_ID[it.defId];
    const text = codes.get(def.id);
    if (!text) continue;
    const printed = printedFor(it, def);
    const shortSide = Math.min(printed.width, printed.height);
    // There used to be a 22 px long-side gate here ("an unreadable label is a worse answer than
    // the honest absence of one") and a width budget that dropped any code wider than its plant.
    // Both deleted the plant's only identity: the gutter withholds every coded defId on the
    // promise of a code drawn here, so a skipped chip left the plant unlabelled everywhere —
    // exactly the audit failure Rory reported ("not all plants have labels"). A floor-size code
    // slightly overhanging a tiny crown is the lesser wrong: it is still centred on the one plant
    // it names.
    //
    // Sized off the SHORT side so a code stays proportionate to the plant, floored so it stays
    // readable — a long bed does not want a code as tall as it is wide.
    const fs = Math.max(9, Math.min(Math.max(shortSide, 22) * 0.3, ctx.canvas.width * 0.0115));
    ctx.font = `800 ${fs}px ${REFERENCE_LABEL_FONT}`;
    const chipW = ctx.measureText(text).width + fs * 0.84;
    const chipH = fs * 1.5;
    // Lifted slightly off centre so the leader's own terminus dot stays visible under it.
    paintChip(text, fs, px(it.x), py(it.y) - printed.height * 0.18, chipW, chipH);
  }
  ctx.restore();
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
/** Corrugated-iron roofs for buildings on PAPER sheets — where there is no photograph to show
 *  the real one.
 *
 *  Rory, on a plain-paper Planting sheet: "where is the roof for the buildings" — pointing at
 *  blank grey rectangles. The blankness is deliberate on the PHOTO underlay: the satellite
 *  already shows the actual roof with its true ridges and shadow, and painting over it replaces
 *  information with a rectangle (see drawBlueprintGround's A ROOF IS NOT GROUND note, and the
 *  sourceStructures restore). On paper that logic inverts — there is nothing underneath, so the
 *  outline-only treatment leaves the most recognisable object on the farm as an empty box.
 *
 *  The drawing is the standard SA farm roof: corrugated sheeting. A ridge along the building's
 *  long axis, sheet lines perpendicular to it at real sheet width (~0.76 m), and one slope a
 *  step darker — the minimum that reads as "roofed building" at plan scale without inventing
 *  ridge layouts for L-shaped buildings this function cannot know. Deterministic: no randomness,
 *  same building, same roof, every render. */
function drawPaperRoofs(
  ctx: CanvasRenderingContext2D,
  state: DesignCanvasState,
  refLayers: DesignGlossyProps['refLayers'],
  px: (n: number) => number,
  py: (n: number) => number,
  pxPerM: number,
): void {
  const rings: Array<Array<[number, number]>> = [];
  if (refLayers.house.length >= 3) rings.push(refLayers.house);
  for (const z of state.zones) {
    if (z.feature === 'house' && z.points.length >= 3) rings.push(z.points);
  }
  if (!rings.length) return;

  for (const ring of rings) {
    const pts = ring.map(([x, y]) => [px(x), py(y)] as [number, number]);
    // Ridge direction = the polygon's longest edge. For the rectangles farmers trace this is the
    // long wall, which is where a real ridge runs; for an L-shape it follows the longest wing,
    // which is the honest simple answer rather than a guessed hip layout.
    let angle = 0;
    let longest = -1;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (len > longest) { longest = len; angle = Math.atan2(y1 - y0, x1 - x0); }
    }
    const cx = pts.reduce((sum, p) => sum + p[0], 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
    const span = Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy))) * 2 + 4;

    const trace = () => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
    };

    ctx.save();
    trace();
    ctx.clip();
    // The sheeting. Weathered zinc, cool and clearly DARKER than the paper — the first pass used
    // near-paper grey with 10-16% marks and at masterplan scale the roof read as a blank box
    // again (Rory, round two: "improve the roof too"). A roof must be the most definite object
    // on the sheet, the same rule the photo-underlay mute logic states.
    ctx.fillStyle = '#B9B4A8';
    ctx.fillRect(cx - span, cy - span, span * 2, span * 2);
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    // One slope clearly darker — the fold is what says "pitched roof" rather than "grey slab".
    ctx.fillStyle = 'rgba(50,45,38,0.22)';
    ctx.fillRect(-span, 0, span * 2, span);
    // CORRUGATION AS RIBS, NOT RULED LINES. Rory, round three: "more of a corrugated iron look".
    // A lone dark line per sheet reads as ruled paper; real corrugation is alternating light and
    // shadow as each rib catches the sun. Each 0.76 m sheet gets a highlight stripe beside a
    // shadow stripe — the pairing is what reads as metal at plan scale.
    const gap = Math.max(4, 0.76 * pxPerM);
    const rib = Math.max(1.2, gap * 0.22);
    for (let d = -span; d <= span; d += gap) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(d, -span, rib, span * 2);
      ctx.fillStyle = 'rgba(50,45,38,0.30)';
      ctx.fillRect(d + rib, -span, rib, span * 2);
    }
    // The ridge itself, along the long axis.
    ctx.strokeStyle = 'rgba(50,45,38,0.7)';
    ctx.lineWidth = Math.max(1.4, pxPerM * 0.1);
    ctx.beginPath();
    ctx.moveTo(-span, 0);
    ctx.lineTo(span, 0);
    ctx.stroke();
    ctx.restore();

    // NO BUILDING BORDER. Rory: "the roofs with no border". The sheeting, its ribs and the
    // darker slope carry the building's edge on pale paper by contrast alone — a dark outline
    // around a metal roof read as a sticker. The eave line is the place the ribs simply stop.
    // (The ground-phase house treatment still owns whatever outline the SITE record needs.)
  }
}

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
  /** Sheet 01 only — see drawBlueprintGround's own note. */
  siteRecord = false,
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
    drawBlueprintGround(ctx, state, px, py, W, refLayers, filter, groundPresentation, siteRecord, pxPerM);
    return canvas.toDataURL('image/png');
  }

  // PAPER SHEETS GET DRAWN ROOFS; photo sheets keep the photograph's real one. frame.satDataUrl
  // is the same signal the composers use to decide whether sourceStructures can restore the roof
  // from the photo — absent here means nothing else will ever draw one. First in the features
  // phase, so a tank or tap placed on the roof still draws on top of it.
  if (!frame.satDataUrl) drawPaperRoofs(ctx, state, refLayers, px, py, pxPerM);

  // THE PROPERTY LINE IS A SITE FACT, NOT THE TOP OF THE DRAWING.
  //
  // This used to be the LAST thing this function drew, so on every exact sheet the boundary was
  // stroked at full weight across whatever the design had already put there — most visibly the
  // tree canopies that overhang it. Rory, on sheet 06: "the fence is on the top layer over
  // threes!?" A canopy that crosses the property line is a real thing on the ground, and the
  // drawing should show the tree in front of the line, the way it looks standing there.
  //
  // It cannot simply move into the 'ground' phase: drawBlueprintGround deliberately excludes the
  // boundary ("a drawn LINE, never a fill wash"), so that phase never strokes it and gating it
  // there would delete the property line from every exact sheet. Drawing it FIRST inside this
  // phase keeps one stroke, at the same weight, on the same sheets — the planting simply sits
  // over it now. Sheets that stroke the boundary again themselves after compositing this overlay
  // (the phasing sheet, where walking and pegging the boundary IS phase 1) are unaffected.
  drawBlueprintBoundary(ctx, refLayers.boundary, px, py, W, state, frame);

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
    drawWaterRoutes(ctx, state, frame, W, H, filter);
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
    drawFilteredLines(ctx, state, 'planting', px, py, pxPerM);
    drawFilteredLines(ctx, state, 'structures', px, py, pxPerM);
    // Routes sit over the ground but below every placed feature. Water and non-Water items then
    // share one biggest-first stack, so a small canopy/fitting is never hidden merely because its
    // category happened to be painted in an earlier subsystem pass.
    drawWaterRoutes(ctx, state, frame, W, H, filter);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawFilteredItems(featureCtx, state, filter, px, py, pxPerM);
    });
  } else if (filter === 'structures') {
    // Prior planting remains visible as quiet context, matching the benchmark infrastructure
    // sheet. It is not counted or legended as Structures content.
    ctx.save();
    ctx.globalAlpha = EXACT_CONTEXT_ALPHA.structures;
    drawFilteredLines(ctx, state, 'planting', px, py, pxPerM);
    drawFilteredItems(ctx, state, 'planting', px, py, pxPerM);
    ctx.restore();
    drawFilteredLines(ctx, state, filter, px, py, pxPerM);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawFilteredItems(featureCtx, state, filter, px, py, pxPerM);
    });
  } else if (filter === 'earthworks') {
    // EARTH, NOT FOLIAGE. Sheet 05 is what a farmer digs before anything is planted, so a raised
    // bed here is bare soil with mulch on it — not the green, planted-up bed the Planting sheet
    // rightly shows. Rory: "in the earth works section raised beds must just be brown ... all
    // earth coloured possibly with mulch." Same saved footprints, same centres and rotations;
    // only the surface treatment differs, which is exactly what a per-sheet register means.
    drawFilteredLines(ctx, state, filter, px, py, pxPerM);
    drawEarthworksFeatures(ctx, state, filter, px, py, pxPerM);
  } else {
    drawFilteredLines(ctx, state, filter, px, py, pxPerM);
    drawExactFeaturesWithPresentation(ctx, W, H, featurePresentation, (featureCtx) => {
      drawFilteredItems(featureCtx, state, filter, px, py, pxPerM);
    });
  }

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
  const pxPerM = W / (renderFrame.imgW * renderFrame.mPerPx);

  // 'site': this sheet's SUBJECT is the photograph — it is the record of what is on the ground
  // today — so it takes the gentlest mute in the set. Every other sheet pushes the aerial right
  // back, because there the photo only says where you are standing.
  await drawBlueprintBase(ctx, renderFrame, W, H, 'site');
  // THE FILL MUST OBEY THE SAME "what's already here" RULE THE LEGEND DOES. The legend below was
  // moved onto existingSiteGroundRings when the staple garden was first reported on this sheet;
  // this call was left passing 'all' — the filter meaning "the whole FINISHED DESIGN" — so the
  // garden stopped being NAMED on the Site sheet while still being PAINTED on it. That is worse
  // than the original bug, not better: four green polygons with no legend row at all, which is
  // this sheet's own stated invariant ("nothing drawn without a legend row") broken. Rory, on the
  // real render: "why is staple gardens polygons in here?"
  //
  // One selector now feeds both, so a future change to what counts as existing cannot move the
  // legend without moving the paint with it.
  const baseRings = existingSiteGroundRings(renderState, renderRefLayers);
  const ground = await buildExactLayerOverlay(
    { ...renderState, zones: baseRings },
    renderFrame,
    renderRefLayers,
    'all',
    W,
    H,
    'ground',
    'standard',
    'solid',
    true,
  );
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
  // Existing placed items are discrete site facts, so they sit above the traced ground and locked
  // source structures as symbols/footprints rather than becoming another zone wash.
  drawExistingSiteItems(ctx, renderState, px, py, pxPerM);

  // THE SITE SHEET SHOWS "WHAT'S ALREADY HERE", NOTHING ELSE. Rory: "still more staple garden
  // issues - it came under base map in map generation ... we need to sort out once and for all
  // the difference between existing and base map." The old call passed filter 'all' — the
  // GlossyLayerFilter meaning "the whole FINISHED DESIGN" — because this sheet has no filter of
  // its own (it isn't an AI-rendered design layer). Under 'all' every ground feature reads as
  // content, staple_garden included, so a plot the farmer has not even reached Planting to design
  // yet printed on the Site sheet as if it were surveyed fact. existingSiteGroundRings answers the
  // narrower, correct question via ownedByCurrentStep('base', ...) — the SAME authority the wizard
  // itself already uses to decide what the Base step may edit — so this can never drift from it.
  // (Computed above, where the ground fill is built from the very same list.)

  // A MAP MISSING ITS OWN HOUSE LABEL. The refLayers-sourced house/driveway (traced on the main
  // map before the Studio, the common path — see authoritativeHouseFootprints) has always
  // rendered as an outline only, with a legend swatch but no on-map callout — while a Studio-
  // traced ground ring next to it (a Slab, a lawn) gets a proper pointer-and-pill. Rory: "you can
  // see there is labels missing for house etc." Same words a Studio-traced house zone would
  // receive (GROUND_FEATURES.house/driveway .label), so a farmer reads one consistent label
  // regardless of which tool put the shape there.
  const extraRows: Array<{ id: string; text: string; cx: number; cy: number }> = [];
  if (renderRefLayers.house.length >= 3) {
    const pts = renderRefLayers.house;
    extraRows.push({
      id: 'reflayer-house',
      text: GROUND_FEATURES.house.label.toUpperCase(),
      cx: (pts.reduce((s, p) => s + p[0], 0) / pts.length) * W,
      cy: (pts.reduce((s, p) => s + p[1], 0) / pts.length) * H,
    });
  }
  if (renderRefLayers.driveway.length >= 2) {
    const pts = renderRefLayers.driveway;
    extraRows.push({
      id: 'reflayer-driveway',
      text: GROUND_FEATURES.driveway.label.toUpperCase(),
      cx: (pts.reduce((s, p) => s + p[0], 0) / pts.length) * W,
      cy: (pts.reduce((s, p) => s + p[1], 0) / pts.length) * H,
    });
  }
  extraRows.push(...existingSiteItemRows(renderState, W, H));
  drawBlueprintLabelPills(ctx, groundLabelsForSheet(renderState, renderRefLayers, W, H, 'all', undefined, baseRings, extraRows));

  const legendRows: StyleLegendRow[] = existingSiteGroundLegendGroups(renderState, renderRefLayers).map((group) => ({
    swatch: group.color,
    text: group.text,
    kind: 'ground',
  }));
  if (renderRefLayers.house.length >= 3) {
    legendRows.unshift({ swatch: '#3E4648', text: 'House / building', kind: 'surface' });
  }
  if (renderRefLayers.driveway.length >= 2) {
    legendRows.push({ swatch: '#5A5D57', text: 'Existing tarred driveway', kind: 'surface' });
  }
  if (renderRefLayers.boundary.length >= 3) {
    legendRows.push({ swatch: BOUNDARY_LINE_GREEN, text: 'Property boundary', lineKind: 'fence' });
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
/**
 * The extent the finished sheet has to FRAME — the plot, plus everything drawn on it.
 *
 * The viewport used to be derived from the boundary alone, which is right about the land and wrong
 * about the drawing: a tree planted on the fence line has a canopy several metres across, and half
 * of it falls outside the boundary. The crop then cut through it and through its label, so the
 * sheet showed a tree sliced off by the edge of the page. Rory, on his own planting sheet: "icons
 * are clipped?"
 *
 * Item CENTRES are inside the plot by construction, so nothing here can run away with the framing —
 * the extent grows by at most one canopy radius, which is exactly the amount that was being cut.
 * Saved metres, not printed pixels: the presentation scale is what this feeds into, so using the
 * printed size would be circular.
 */
function presentationExtentRing(
  state: DesignCanvasState,
  frame: CanvasFrame,
  boundary: Array<[number, number]>,
): Array<[number, number]> {
  const frameWm = frame.imgW * frame.mPerPx;
  const frameHm = frame.imgH * frame.mPerPx;
  if (!(frameWm > 0) || !(frameHm > 0) || boundary.length < 3) return boundary;
  const points: Array<[number, number]> = [...boundary];
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
    const halfX = ((it.wM ?? def.wM) / 2) / frameWm;
    const halfY = ((it.hM ?? def.hM) / 2) / frameHm;
    if (!Number.isFinite(halfX) || !Number.isFinite(halfY)) continue;
    points.push([it.x - halfX, it.y - halfY], [it.x + halfX, it.y + halfY]);
  }
  // Clamped: the crop may never reach outside the source photograph, and a canopy hanging past the
  // edge of the imagery cannot be framed however much the viewport would like to.
  return points.map(([x, y]) => [
    Math.min(1, Math.max(0, x)),
    Math.min(1, Math.max(0, y)),
  ] as [number, number]);
}

async function boundaryPresentationContext(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
): Promise<ReferencePresentationContext> {
  const layout = calculateBoundaryPresentationLayout(
    presentationExtentRing(state, frame, refLayers.boundary),
    frame,
    SCALE,
  );
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
      useHighQualityScaling(cropCtx);
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
  /** Only the Water sheet uses this today, for its harvest block. Optional everywhere else, and
   *  the block simply does not print without it — see roofHarvestFooterLines. */
  site?: DesignGlossyProps['site'],
  /** Codes on every plant, or named callouts on one plant per kind — see SheetLabelMode. Optional
   *  so DesignPrint's per-layer render table keeps the default without a signature change. */
  labelMode: SheetLabelMode = DEFAULT_SHEET_LABEL_MODE,
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
    // MUTE THE BUILDING CUTOUT WITH THE GROUND IT SITS ON. This overlay is a slice of the SAME
    // photograph as the base, restored at full strength so a roof stays sharp. Once the base was
    // pushed back for legibility (lib/sheet-base-mute.ts) that made every traced building a dark,
    // saturated blob on a pale sheet — the one thing on the page shouting, and it is context.
    // Same filter, one step lighter than the ground, so the building still reads as the most
    // definite object on the sheet without being the loudest.
    // The gentler 'site' mute, not the design one: a building is the most recognisable thing on a
    // farmer's own plot and the anchor they orient everything else from. It should sit in the same
    // tonal world as the muted ground without being bleached into it.
    //
    // THE VEIL HAD TO BE APPLIED THROUGH THE CUTOUT, NOT UNDER IT. Filtering alone left the
    // building outside the sheet's tonal range on any site with dark roofs — see
    // SHEET_STRUCTURE_MUTE_STYLE. It is composited offscreen because the veil must land on the
    // building's own pixels and nothing else: painting it straight onto `ctx` would wash the ground,
    // the boundary and every mark already drawn underneath.
    ctx.save();
    ctx.drawImage(
      await muteStructureCutout(await loadImage(sourceStructures), W, H),
      0,
      0,
      W,
      H,
    );
    ctx.restore();
  } else {
    const px = (n: number) => n * W;
    const py = (n: number) => n * H;
    const pxPerM = W / (renderFrame.imgW * renderFrame.mPerPx);
    // NO PHOTOGRAPH MEANS NO CUTOUT TO RESTORE, so these vectors ARE the building and the access
    // on this sheet — and on paper they must be drawn as a plan draws them, not as the near-solid
    // marks that were tuned to survive a busy aerial. See PLAIN_HARD_SURFACE_PAINT.
    const onPaper = !renderFrame.satDataUrl;
    // EVERY BUILDING, NOT THE BIGGEST ONE. This drew `renderRefLayers.house` alone — a single ring —
    // while drawBlueprintGround drops EVERY house zone whenever houseCovered is true, and
    // resolveBaseLayers guarantees it is true by promoting the largest Studio house ring into
    // refLayers.house. So a farm with a house and a store room drew the house, and the store room
    // was suppressed by the ground pass and never picked up by this one. Rory, on a plain-paper
    // sheet: "store room not showing".
    //
    // It only went missing on PAPER. The photo path composes through buildHouseOverlay, which has
    // always used authoritativeHouseFootprints and so has always known about both — which is
    // exactly why this survived: the same sheet, rendered on satellite, looked right.
    for (const footprint of authoritativeHouseFootprints(state, renderRefLayers)) {
      drawBlueprintHouse(
        ctx,
        footprint,
        px,
        py,
        onPaper ? PLAIN_HARD_SURFACE_PAINT.houseFill : 'rgba(48,54,59,0.94)',
        onPaper ? PLAIN_HARD_SURFACE_PAINT.houseStroke : '#FBF6EC',
        3,
      );
    }
    drawBlueprintDriveway(ctx, renderRefLayers, px, py, pxPerM, filter === 'structures', onPaper);
  }

  // WHERE THE RAIN GOES ONCE IT IS ON THE GROUND — under the plumbing, because it is the condition
  // the plumbing answers, not a thing the farmer placed. Rory: "show arrows of where the rain
  // drains on the roof and ground?"
  //
  // Only the ground half is drawn, and only when the app actually knows: aspectDeg comes from a real
  // elevation sample and arrives with a confidence flag that is 'unconfirmed' on ground too flat to
  // call. A roof's fall is NOT known — a traced outline says nothing about ridge, pitch or which
  // wall the gutter is on — so no arrow is drawn off a roof. See lib/overland-flow.ts.
  const flowArrows = filter === 'water'
    ? interceptFlowArrows(
      overlandFlowArrows({
        boundary: renderRefLayers.boundary,
        aspectDeg: site?.elevation?.aspectDeg ?? Number.NaN,
        slopeDeg: site?.elevation?.slopeDeg ?? Number.NaN,
        directionConfidence: site?.elevation?.directionConfidence,
      }),
      // Everything whose JOB is stopping runoff, in the arrows' own normalised space. Bed
      // footprints convert metres to normalised through the frame; a rotated bed keeps its
      // rotation so the arrow is cut at the bed's true edge, not its bounding box.
      {
        polylines: renderState.lines
          .filter((line) => line.kind === 'swale' && line.points.length >= 2)
          .map((line) => line.points),
        rects: renderState.items
          .filter((it) => (BED_DEF_IDS as readonly string[]).includes(it.defId))
          .map((it) => {
            const def = ELEMENTS_BY_ID[it.defId];
            return {
              cx: it.x,
              cy: it.y,
              w: (it.wM ?? def?.wM ?? 1) / (renderFrame.imgW * renderFrame.mPerPx),
              h: (it.hM ?? def?.hM ?? 1) / (renderFrame.imgH * renderFrame.mPerPx),
              rotDeg: it.rot ?? 0,
            };
          }),
        rings: renderState.zones
          .filter((z) => z.feature === 'staple_garden' && z.points.length >= 3)
          .map((z) => z.points),
      },
    )
    : [];
  drawOverlandFlowArrows(ctx, flowArrows, W, H);

  const featureOverlay = await buildExactLayerOverlay(renderState, renderFrame, renderRefLayers, filter, W, H, 'features');
  if (featureOverlay) ctx.drawImage(await loadImage(featureOverlay), 0, 0, W, H);

  const px = (n: number) => n * W;
  const py = (n: number) => n * H;
  // Codes before the gutter, not after. They used to be drawn last because the on-map pills covered
  // them; with the callouts moved into a reserved band there is nothing left to hide behind, and
  // the band must be free to cover anything that strays into it.
  if (filter === 'planting') drawGroundAreaNames(ctx, renderState, renderRefLayers, W, H, filter);
  drawPlantMarks(ctx, renderState, filter, px, py, W / (renderFrame.imgW * renderFrame.mPerPx), labelMode);
  // CALLOUTS ARE NOT DRAWN HERE ANY MORE. They live in the sheet's label gutters, which only exist
  // once composeStyleSheet has widened the map into a sheet — see drawLabelGutter. What is computed
  // here is only the LAYOUT, because this is where the presentation-space state and refLayers are
  // in hand; the paint happens below, at sheet coordinates.
  const gutterLayout = filter === 'planting' || filter === 'structures' || filter === 'all'
    ? sheetGutterLayout(renderState, renderRefLayers, W, H, filter, labelMode)
    : undefined;

  // THE WATER SHEET CARRIES ITS OWN SIZING CALCULATION. That is how real rainwater-harvesting
  // drawings work: the sheet that shows the tanks also shows the arithmetic that says whether they
  // are big enough, so a farmer or a funder can check it without a second document. Rory: "should
  // you show info like how rain can be harvested on the roof?"
  //
  // Every figure is measured or sourced — traced roof area, the site's own annual rainfall, and
  // the runoff coefficient from lib/roof-runoff.ts (0.80, cited to the CSIR Red Book). Nothing
  // here is estimated into existence: when the roof is untraced or the rainfall unknown the block
  // simply does not print, because a harvest figure resting on a guessed roof is worse than none.
  const waterBudget = filter === 'water'
    ? roofHarvestFooterLines(renderState, renderFrame, renderRefLayers, site ?? null)
    : [];

  // NOTHING IS DRAWN WITHOUT A ROW. A dashed canopy edge is meaningless to a reader who has not
  // been told what it means, so the row appears only when at least one canopy has actually earned
  // the dash — recomputed here from the same printed geometry drawFilteredItems uses.
  // The dashed-canopy mark no longer draws in artwork mode (see skipSolidEdge's note — "that
  // weird circle around the one tree"), so its legend row must not print either: a key to a mark
  // that never appears is the legend lying about the map. Kept for 'footprint' mode, where the
  // dash still draws.
  const canopiesAbove = CANOPY_EDGE_MODE === 'footprint' && (filter === 'planting' || filter === 'all')
    ? overstoryCanopyIds(byCartographicStack(renderState, filter).map((it) => {
      const def = ELEMENTS_BY_ID[it.defId];
      if (!def) return { id: it.id, cx: px(it.x), cy: py(it.y), rPx: 0 };
      const scale = W / (renderFrame.imgW * renderFrame.mPerPx);
      const printed = plantingFeaturePresentationDimensions(
        def.id,
        Math.max(1, (it.wM ?? def.wM) * scale),
        Math.max(1, (it.hM ?? def.hM) * scale),
        W,
      );
      return {
        id: it.id,
        cx: px(it.x),
        cy: py(it.y),
        rPx: def.shape === 'circle' ? Math.min(printed.width, printed.height) / 2 : 0,
      };
    })).size
    : 0;

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
    {
      // The legend is the key the map codes are looked up in, so it only carries them in the mode
      // that draws them. A "MG ·" prefix on a sheet with no MG anywhere is a key to nothing.
      labelMode,
      gutterLayout,
      ...(waterBudget.length
        ? { footerHeading: 'WATER BUDGET', footerText: waterBudget.join('\n'), footerBox: true }
        : {}),
      // NOTHING IS DRAWN WITHOUT A ROW, and the converse: the row exists only when the arrows do.
      // The flow field is computed from site elevation, which sheetLegendRows never sees, so it
      // could not derive this one — hence extraLegendRows rather than a special case in there.
      ...(canopiesAbove
        ? {
          extraLegendRows: [{
            swatch: PLANTING_CANOPY_PAINT.edgeColor,
            visual: 'canopy-above' as const,
            text: 'Dashed canopy — tree above; planting shown beneath it',
          }],
        }
        : {}),
      ...(flowArrows.length
        ? {
          extraLegendRows: [{
            swatch: '#1C608C',
            visual: 'flow-arrow' as const,
            text: overlandFlowLegendText(
              site?.elevation?.slopeDeg ?? Number.NaN,
              site?.elevation?.aspectLabel ?? 'downhill',
            ),
            // No section, deliberately. The headed sections on this sheet name what the farmer has
            // PLACED — rainwater, filtered greywater, irrigation. Overland flow is not placed and
            // cannot be moved; it is the condition all of that responds to. Filing it under a
            // "WATER" heading of its own put a heading on the sheet that read as a fourth system.
          }]
        }
        : {}),
    },
  );
}

/**
 * The Water sheet's rainwater-harvest block: roof area × annual rainfall × runoff coefficient,
 * against the storage actually placed.
 *
 * Returns an EMPTY list rather than a partial block whenever a term is missing. A harvest figure
 * is only as good as the roof it is measured from, and a farmer sizing tanks off an invented roof
 * area would be worse served than by no number at all — the same rule statedTankCapacityLitres
 * already follows when a tank's name does not state its size.
 */
function roofHarvestFooterLines(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  site: DesignGlossyProps['site'],
): string[] {
  const metrics = { imgW: frame.imgW, imgH: frame.imgH, mPerPx: frame.mPerPx };
  const roofRings: Array<Array<[number, number]>> = [];
  if (refLayers.house.length >= 3) roofRings.push(refLayers.house);
  for (const zone of state.zones) {
    if (zone.feature === 'house' && zone.points.length >= 3) roofRings.push(zone.points);
  }
  const roofM2 = roofRings.reduce((sum, ring) => sum + ringAreaM2(ring, metrics), 0);
  const rainfallMm = site?.rainfallMm;
  if (!(roofM2 > 1) || !Number.isFinite(rainfallMm ?? NaN) || !((rainfallMm ?? 0) > 0)) return [];

  const harvestL = annualRoofHarvestLitres(roofM2, rainfallMm as number);
  if (!(harvestL > 0)) return [];
  const storedL = state.items.reduce((sum, item) => {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || !itemInFilter(def.category, 'water', def.id)) return sum;
    return sum + (statedTankCapacityLitres(def) ?? 0);
  }, 0);

  const lines = [
    `Roof catchment traced: ${Math.round(roofM2).toLocaleString()} m²`,
    `Annual rainfall: ${Math.round(rainfallMm as number).toLocaleString()} mm`,
    `Runoff coefficient: ${WATER_SHEET_ROOF_RUNOFF_COEFFICIENT} (generic roof)`,
    `Harvestable: ~${Math.round(harvestL).toLocaleString()} L a year`,
  ];
  // Storage is stated only when the catalog actually knows the capacities. A "Rain Barrel" with no
  // size in its name contributes nothing, so a total built from those would understate the storage
  // and make it look inadequate.
  if (storedL > 0) {
    lines.push(`Storage placed: ${Math.round(storedL).toLocaleString()} L`);
    lines.push(`That is ${Math.round((storedL / harvestL) * 100)}% of one year's harvest.`);
  }
  return lines;
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
  site?: DesignGlossyProps['site'],
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'water', placeName, site);
}

// Earthworks = sheet 05, the land-shaping setting-out sheet split out of Water.
export function buildBlueprintEarthworksMap(
  state: DesignCanvasState,
  frame: CanvasFrame,
  refLayers: DesignGlossyProps['refLayers'],
  placeName?: string,
): Promise<string> {
  return buildReferenceBlueprintMap(state, frame, refLayers, 'earthworks', placeName);
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

// ── Sheet 09: Implementation & Phasing ────────────────────────────────────────────────────────
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
  sheetContours?: SheetContourResult,
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
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const [x, y] of bnd) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
    // AREA centroid, not the average of the vertices. Rory, on a real sector sheet: "center the
    // azimuth properly in the centre of the site." The vertex average is only the centre of a
    // polygon whose corners are evenly spaced — and a farmer's traced boundary never is. Ubhejane's
    // has dozens of points crowded along the walked road edge and four on the straight far side, so
    // the mean was dragged bodily toward the road and the whole sun-path ring with it. Area
    // centroid is indifferent to how densely an edge happens to have been tapped.
    const centre = polygonAreaCentroid(bnd);
    cx = centre[0] * W;
    cy = centre[1] * H;
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
  // Arrow bodies claim their space so the direct labels dodge THEM, not just each other. The
  // opaque label plates made this visible: a plate that lands on an arrow now fully hides it
  // (Rory: "the text blocks the arrows a lot"), where the old translucent pill merely dimmed it.
  // Fed into flushDirectLabels' claims as pre-seeded boxes.
  //
  // SEGMENTED, not one bounding box: a benchmark-mass arrow entering at 45° has a bbox covering a
  // quarter of the map, most of it empty — with two of those claimed, the sun labels' candidate
  // scan found no free spot anywhere along the arc and fell back to overlapping the arrow name
  // anyway. A chain of small boxes hugging the painted band claims what the arrow actually
  // covers and nothing more, so the dodger keeps the empty corners to work with.
  const arrowClaims: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];
  const claimArrowBox = (x1: number, y1: number, x2: number, y2: number, pad: number): void => {
    if (!externalLegend) return;
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const px = x1 + ((x2 - x1) * i) / steps;
      const py = y1 + ((y2 - y1) * i) / steps;
      arrowClaims.push({ x0: px - pad, x1: px + pad, y0: py - pad, y1: py + pad });
    }
  };
  const drawArrow = (fromVec: [number, number], color: string, width: number, dash: number[], lenIn = R * 0.4) => {
    const sxp = cx + fromVec[0] * (R + arrowLen * 0.75), syp = cy + fromVec[1] * (R + arrowLen * 0.75);
    const exp = cx + fromVec[0] * (R - lenIn), eyp = cy + fromVec[1] * (R - lenIn);
    const ang = Math.atan2(eyp - syp, exp - sxp);
    const ah = Math.max(12, width * (externalLegend ? 3.4 : 2.6));
    const shaft = () => {
      ctx.beginPath();
      ctx.moveTo(sxp, syp);
      ctx.lineTo(exp, eyp);
      ctx.stroke();
    };
    const head = () => {
      ctx.beginPath();
      ctx.moveTo(exp, eyp);
      ctx.lineTo(exp - ah * Math.cos(ang - 0.42), eyp - ah * Math.sin(ang - 0.42));
      ctx.lineTo(exp - ah * Math.cos(ang + 0.42), eyp - ah * Math.sin(ang + 0.42));
      ctx.closePath();
    };
    ctx.save();
    // Same route-casing lesson as drawBroadEnergyArrow: on the composed sheet these thin arrows
    // (driveway access especially — mid-grey on a grey-scrimmed photo) vanished entirely. A cream
    // under-stroke separates the arrow from any ground before the colour goes down; the legacy
    // in-canvas view (externalLegend false) keeps its original quiet look.
    if (externalLegend) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(252,250,240,0.92)';
      ctx.lineWidth = width + Math.max(4, W * 0.003);
      ctx.setLineDash(dash);
      shaft();
      ctx.setLineDash([]);
      head();
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);
    shaft();
    ctx.setLineDash([]);
    head();
    ctx.fill();
    ctx.restore();
    claimArrowBox(sxp, syp, exp, eyp, ah);
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
    /** Fixed sheet furniture: placed before anything else and never nudged. See below. */
    reserved = false,
  ): void => {
    if (!externalLegend) return;
    // THE DODGER IS FIRST-COME-FIRST-SERVED, SO QUEUE ORDER IS A DESIGN DECISION.
    //
    // The two sun-path banners are the headline facts of this sheet and sit in a fixed band across
    // the top, like a title block — they are the one thing on it a farmer looks up. But they were
    // queued AFTER the fire-approach label, so fire claimed the band first and the winter banner
    // was pushed down onto it: two pieces of text printed over each other in the most important
    // strip of the sheet. Reserved requests go to the front, so the movable labels move.
    if (reserved) directLabelRequests.unshift({ x, y, lines, color, tangentBias });
    else directLabelRequests.push({ x, y, lines, color, tangentBias });
  };
  const flushDirectLabels = (): void => {
    if (!externalLegend || directLabelRequests.length === 0) return;
    const directClaims: Array<{ x0: number; x1: number; y0: number; y1: number }> = [
      { x0: 0, x1: W * 0.33, y0: 0, y1: H * 0.18 },
      // Every drawn arrow claimed its body earlier — labels must clear the arrows they annotate,
      // not sit on top of them (an opaque plate on an arrow deletes the arrow from the sheet).
      ...arrowClaims,
    ];
    // A stroke halo alone was not enough: it was sized for a flat cartographic tint, and this base
    // is a real drone photo — dense foliage, bare soil, tin roof and shadow all in the same frame,
    // several of them darker AND more saturated than the halo could out-contrast. Rory, looking at
    // an actual farm sheet on his phone: "I can't see anything on this image." Every direct label
    // now sits on its own solid dark plate — same technique as the AI-queue "AI?" chip elsewhere on
    // this canvas — so contrast is guaranteed by what's UNDER the label, never by what's under the
    // photo. Font bumped alongside it: 18px-min/×0.0115 was sized before this sheet carried a real
    // photo at phone-viewing scale.
    const fs = Math.max(21, Math.round(W * 0.0135));
    const lineH = Math.round(fs * 1.1);
    for (const request of directLabelRequests) {
      ctx.save();
      ctx.font = `800 ${fs}px ${REFERENCE_LABEL_FONT}`;
      const halfW = Math.max(...request.lines.map((line) => ctx.measureText(line).width)) / 2 + fs * 0.55;
      const halfH = (lineH * request.lines.length) / 2 + fs * 0.42;
      // Wider escape net than the original seven: with two benchmark-mass arrows, both sun arcs
      // and the access arrow all anchored in the same top band, the close candidates are often
      // ALL claimed, and a fallback that overlaps defeats the whole dodger. The far candidates
      // (±4.8 lineH vertically, ±7 horizontally, and the diagonals) let a crowded-out label step
      // down into the open arc interior instead of printing across a neighbour.
      const candidates: Array<[number, number]> = [
        [request.tangentBias ?? 0, 0],
        [request.tangentBias ?? 0, lineH * 2.4],
        [request.tangentBias ?? 0, -lineH * 2.4],
        [lineH * 4, 0], [-lineH * 4, 0],
        [lineH * 4, lineH * 2.4], [-lineH * 4, lineH * 2.4],
        [request.tangentBias ?? 0, lineH * 4.8],
        [request.tangentBias ?? 0, -lineH * 4.8],
        [lineH * 4, -lineH * 2.4], [-lineH * 4, -lineH * 2.4],
        [lineH * 7, 0], [-lineH * 7, 0],
        [lineH * 7, lineH * 2.4], [-lineH * 7, lineH * 2.4],
        [lineH * 4, lineH * 4.8], [-lineH * 4, lineH * 4.8],
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
      // BENCHMARK LETTERING, NOT PLATES. design/benchmark/08...Sector_Analysis_Map.png sets every
      // free-floating label as bold outlined type straight on the artwork — no black pill
      // anywhere on the sheet. The pills were this renderer's own invention (first translucent,
      // then opaque), and each step made a different complaint: translucent = "can't see
      // anything", opaque = "the text blocks the arrows". The reference solves both at once: a
      // HEAVY dark outline (~0.22em, far past the old 3px halo that failed on this photo) gives
      // the contrast a plate used to, without hiding a single pixel of arrow, arc or ground —
      // and the wind names moved inside their own arrows, so what floats here is short.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(5, fs * 0.22);
      ctx.strokeStyle = 'rgba(8,12,10,0.92)';
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

  // A translucent wedge — the shared shape for every regional-assumption wind/fire sector
  // (namedWind + fire). Its two long edges used to repeat the dashed register twice per energy,
  // leaving eight unexplained rays at the frame edge. The regional-assumption dash now has one
  // owner: each named wind's arrow centreline below, or the fire centreline drawn after the winds.
  // That keeps SECTOR-MODEL-SPEC §4's dashed register without outlining both sides of every wedge.
  // WHERE AN INCOMING REGIONAL ENERGY STOPS, as a fraction of the ring radius R (which sits just
  // outside the plot). Rory, comparing sheet 02 with a set of reference sheets he rates: "I don't
  // like the look of the sector map."
  //
  // The reason was geometric, not decorative. Both energy renderers drove their tip to ~0.45 R —
  // roughly halfway from the plot centre to its edge — so every wind, the fire approach and the
  // access arrow were drawn straight ACROSS the farm, over the house, the beds and the contours.
  // Five overlapping translucent wedges on top of the one thing the sheet is about.
  //
  // On the reference sheets each energy enters from outside and STOPS AT THE BOUNDARY. The farm
  // underneath stays completely readable, which is the whole reason those sheets breathe. Same
  // bearings, same half-widths, same sourced regional record — only where the shape ends changes.
  const SECTOR_ENERGY_TIP = 0.94;

  const drawRegionalWedge = (bearingDeg: number, halfWidthDeg: number, kind: SectorVisualKind) => {
    const centerVec = bearingToUnitVector(bearingDeg);
    const v1 = bearingToUnitVector(bearingDeg - halfWidthDeg);
    const v2 = bearingToUnitVector(bearingDeg + halfWidthDeg);
    // The wedge now lives entirely OUTSIDE the plot: it reaches the boundary and stops. The base is
    // pushed further out so it still reads as a broad regional energy rather than a thin pennant.
    const rr = R * (externalLegend ? 1.52 : 1.45);
    const tipX = cx + centerVec[0] * R * SECTOR_ENERGY_TIP;
    const tipY = cy + centerVec[1] * R * SECTOR_ENERGY_TIP;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(cx + v1[0] * rr, cy + v1[1] * rr);
    ctx.lineTo(cx + v2[0] * rr, cy + v2[1] * rr);
    ctx.closePath();
    ctx.fillStyle = sectorFillColor(kind);
    ctx.fill();
    ctx.restore();
    return { centerVec, rr, tipX, tipY };
  };

  const drawRegionalCenterline = (
    wedge: ReturnType<typeof drawRegionalWedge>,
    color: string,
  ): void => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, sectorStrokeWidth('fire', W) * (externalLegend ? 0.42 : 0.28));
    ctx.setLineDash([10, 7]);
    ctx.beginPath();
    ctx.moveTo(wedge.tipX, wedge.tipY);
    ctx.lineTo(cx + wedge.centerVec[0] * wedge.rr, cy + wedge.centerVec[1] * wedge.rr);
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
    labelLines?: string[],
  ): { sxp: number; syp: number } => {
    // BENCHMARK MASS. design/benchmark/08...Sector_Analysis_Map.png — the sheet this whole
    // renderer answers to — draws each regional wind as a huge tapered wedge arrow that OWNS its
    // corner of the frame and carries its own name inside its body. Ours was a fraction of that
    // visual weight, which is why no casing/opacity tweak ever satisfied ("you can't see the
    // arrows"): the arrow wasn't just faint, it was small. Tail wider than the shaft's head end
    // gives the benchmark's wedge silhouette rather than a parallel-sided dart.
    const tailX = cx + fromVec[0] * (R + arrowLen * 2.6);
    const tailY = cy + fromVec[1] * (R + arrowLen * 2.6);
    const tipX = cx + fromVec[0] * R * SECTOR_ENERGY_TIP;
    const tipY = cy + fromVec[1] * R * SECTOR_ENERGY_TIP;
    const dx = tipX - tailX;
    const dy = tipY - tailY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const tailHalf = Math.max(18, W * 0.017) * emphasis;
    const shaftHalf = Math.max(11, W * 0.0105) * emphasis;
    const headHalf = shaftHalf * 2.1;
    const headLen = Math.max(40, W * 0.046) * emphasis;
    const headBaseX = tipX - ux * headLen;
    const headBaseY = tipY - uy * headLen;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tailX + nx * tailHalf, tailY + ny * tailHalf);
    ctx.lineTo(headBaseX + nx * shaftHalf, headBaseY + ny * shaftHalf);
    ctx.lineTo(headBaseX + nx * headHalf, headBaseY + ny * headHalf);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(headBaseX - nx * headHalf, headBaseY - ny * headHalf);
    ctx.lineTo(headBaseX - nx * shaftHalf, headBaseY - ny * shaftHalf);
    ctx.lineTo(tailX - nx * tailHalf, tailY - ny * tailHalf);
    ctx.closePath();
    // ROUTE-CASING TREATMENT, not a tint. The previous pass (30%-alpha fill, 76%-alpha edge, a
    // half-strength dark halo) was three translucent layers stacked on a photograph whose foliage
    // is often darker AND more saturated than the arrow colour — Rory, on the shipped Hybrid:
    // "you can't see the arrows." Same lesson the labels already learned: on a real photo,
    // visibility comes from an opaque body with a light casing (the Google-Maps route convention),
    // never from alpha. Cream casing first so the arrow is separated from the ground on every
    // terrain, then a near-solid colour body, then a crisp dark edge to hold the silhouette.
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(252,250,240,0.92)';
    ctx.lineWidth = Math.max(7, W * 0.0055);
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(6,10,8,0.85)';
    ctx.lineWidth = Math.max(2, W * 0.0015);
    ctx.stroke();
    // Regional assumptions remain visibly dashed, but the dash is a quiet provenance spine
    // inside one broad benchmark arrow rather than a second arrow and arrowhead on top.
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = 'rgba(252,250,240,0.95)';
    ctx.lineWidth = Math.max(2, W * 0.0018);
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(tailX + ux * shaftHalf * 0.35, tailY + uy * shaftHalf * 0.35);
    ctx.lineTo(headBaseX + ux * headLen * 0.22, headBaseY + uy * headLen * 0.22);
    ctx.stroke();
    // THE ARROW CARRIES ITS OWN NAME — the benchmark's other answer to "the text blocks the
    // arrows": there is no separate label to collide with the arrow when the label lives inside
    // it. Horizontal (never rotated — the benchmark keeps all lettering upright), cream on the
    // opaque colour with a dark outline so it reads on the teal and orange bodies alike. Biased
    // toward the TAIL, as the benchmark sets its wind names near the frame edge — the mid-body
    // point of a near-vertical arrow lands exactly in the sun-arc label band at the top of the
    // sheet, which is how "HOT DRY BERG WIND" ended up printed across "SUMMER SUN". Clamped into
    // the frame because these tails deliberately start beyond it. The caller must then NOT queue
    // a floating directLabelAt for this energy.
    if (labelLines?.length) {
      const lfs = Math.max(19, Math.round(W * 0.0115));
      const llh = Math.round(lfs * 1.12);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = `800 ${lfs}px ${REFERENCE_LABEL_FONT}`;
      const labelHalfW = Math.max(...labelLines.map((l) => ctx.measureText(l).width)) / 2;
      const labelHalfH = (llh * labelLines.length) / 2;
      const rawX = tailX + (headBaseX - tailX) * 0.42;
      const rawY = tailY + (headBaseY - tailY) * 0.42;
      const midX = Math.max(labelHalfW + W * 0.015, Math.min(W - labelHalfW - W * 0.015, rawX));
      const midY = Math.max(labelHalfH + H * 0.03, Math.min(H - labelHalfH - H * 0.03, rawY));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(4, lfs * 0.22);
      ctx.strokeStyle = 'rgba(8,12,10,0.9)';
      const firstY = midY - ((labelLines.length - 1) * llh) / 2;
      labelLines.forEach((line, i) => ctx.strokeText(line, midX, firstY + i * llh));
      ctx.fillStyle = 'rgba(252,250,240,0.98)';
      labelLines.forEach((line, i) => ctx.fillText(line, midX, firstY + i * llh));
      // The name's own box joins the claims so the flushed labels dodge it like any other mark.
      arrowClaims.push({ x0: midX - labelHalfW, x1: midX + labelHalfW, y0: midY - labelHalfH, y1: midY + labelHalfH });
    }
    ctx.restore();
    claimArrowBox(tailX, tailY, tipX, tipY, headHalf);
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
  const fireWedge = model.fire
    ? drawRegionalWedge(model.fire.bearingDeg, model.fire.halfWidthDeg, 'fire')
    : null;
  if (model.fire) {
    // Fire's bearing EQUALS the berg wind's bearing by construction. The legacy canvas keeps its
    // interior label; on the composed sheet queue a final-layer label off the shared ray so the
    // broad berg-wind arrow cannot paint over it.
    const lp = bearingToUnitVector(model.fire.bearingDeg);
    labelAt(cx + lp[0] * R * 0.55, cy + lp[1] * R * 0.55, `FIRE — ${model.fire.fromLabel}`, '#F0A58C');
    drawSectorMarker('fire', cx + lp[0] * R * 0.68, cy + lp[1] * R * 0.68, SECTOR_STYLES.fire.color);
    const fireTangentX = -lp[1];
    const fireTangentY = lp[0];
    directLabelAt(
      cx + lp[0] * R * 0.72 + fireTangentX * rowH * 2.2,
      cy + lp[1] * R * 0.72 + fireTangentY * rowH * 2.2,
      ['FIRE APPROACH', model.fire.fromLabel],
      '#F0A58C',
    );
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
  const drawSunArc = (path: SolarModel['summer'], r: number, color: string, endCaptions = false) => {
    if (path.sunriseAzDeg == null || path.sunsetAzDeg == null) return null;
    const sweepNorth = path.noonSide !== 'S';
    const startAngle = bearingToCanvasAngle(path.sunriseAzDeg);
    const endAngle = bearingToCanvasAngle(path.sunsetAzDeg);
    ctx.save();
    // A plain coloured stroke was the whole problem: Rory, on a real Hybrid render, "I can't see
    // things — the blue, the orange, the sun path." Pale gold on an AI-painted ground that can be
    // any tone at all is the same failure the labels had before their solid plate — this is that
    // same fix applied to a LINE instead of text: a dark halo stroke first, the real colour on top.
    if (externalLegend) {
      ctx.strokeStyle = 'rgba(6,10,8,0.55)';
      ctx.lineWidth = Math.max(2.5, W * 0.0022) + Math.max(3, W * 0.0026);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle, sweepNorth);
      ctx.stroke();
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2.5, W * 0.0022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle, sweepNorth);
    ctx.stroke();
    const apexVec = bearingToUnitVector(sweepNorth ? 0 : 180);
    // MUCH bigger, and the ARC ENDS especially — Rory: "make the suns bigger at the ends of the
    // arcs, like much bigger." The ends are sunrise and sunset, which is the pair of facts a
    // farmer actually sites a windbreak or a shade tree against; they were drawn at three
    // quarters of the noon sun and vanished into the photograph entirely. They now lead, and the
    // noon marker (which already has the banner and the altitude number carrying it) follows.
    const sunR = Math.max(14, W * 0.0125);
    drawSunIcon(cx + Math.cos(startAngle) * r, cy + Math.sin(startAngle) * r, sunR, color);
    drawSunIcon(cx + apexVec[0] * r, cy + apexVec[1] * r, sunR * 0.82, color);
    drawSunIcon(cx + Math.cos(endAngle) * r, cy + Math.sin(endAngle) * r, sunR, color);
    // SAY WHICH END IS WHICH. Two suns on the ends of an arc are obvious to anyone who has read a
    // sun-path diagram before and mean nothing to anyone who has not — and this sheet is printed
    // for farmers, not for designers. Rory: "maybe put sunrise and sun set under the suns as rural
    // farmers might not understand".
    //
    // Only on ONE arc, and the outer one. Both seasons put a sun at each end on their own rise and
    // set bearings, so captioning both would put four words on a crowded ring and risk exactly the
    // symbol overlap this sheet has just been cleared of. The word is the same for either season;
    // the compass point that differs is already spelled out in each arc's own banner.
    if (endCaptions) {
      const capFs = Math.max(13, Math.round(W * 0.0072));
      ctx.font = `800 ${capFs}px ${REFERENCE_LABEL_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      const caption = (ax: number, ay: number, text: string) => {
        const tx = cx + Math.cos(ax) * r;
        const ty = cy + Math.sin(ax) * r + sunR * 1.9;
        ctx.lineWidth = Math.max(3.5, capFs * 0.24);
        ctx.strokeStyle = 'rgba(8,12,10,0.9)';
        ctx.strokeText(text, tx, ty);
        ctx.fillStyle = 'rgba(252,250,240,0.98)';
        ctx.fillText(text, tx, ty);
        void ay;
      };
      caption(startAngle, 0, 'SUNRISE');
      caption(endAngle, 0, 'SUNSET');
    }
    ctx.restore();
    return apexVec;
  };
  // THE TWO NOON SUNS MUST NOT TOUCH, but their clearance may never reverse the seasons. Both
  // arcs put an icon on the same noon bearing, so the radial gap keeps them apart while the shared
  // layout helper keeps the low winter arc INSIDE the high summer one.
  const noonIconR = Math.max(14, W * 0.0125) * 0.82;
  const { summerR, winterR } = seasonalSunArcRadii(R, arrowLen, noonIconR);
  // WARM FOR SUMMER, COOL FOR WINTER. Both arcs were near-identical creams, so the only thing
  // separating the two solstices was reading the altitude off the label — on the diagram whose
  // entire job is to make that difference obvious at a glance. Rory: "summer sun part of it
  // including line and sun is a dark orange? and the winter one make it cooler?".
  //
  // The encoding is not arbitrary: the high summer arc IS the heat you shade against, and the low
  // winter arc IS the light you must not block. Colour carries that before a number does. The
  // winter blue is kept clear of the water arrow's blue so a sun path never reads as drainage.
  const summerApex = drawSunArc(model.solar.summer, summerR, SUN_SUMMER_COLOR);
  const winterApex = drawSunArc(model.solar.winter, winterR, SUN_WINTER_COLOR, true);
  if (summerApex) {
    labelAt(
      cx + summerApex[0] * (summerR + rowH * 0.7),
      cy + summerApex[1] * (summerR + rowH * 0.7),
      `SUMMER SUN · ${model.solar.summer.riseLabel16} → ${model.solar.summer.noonSide} → ${model.solar.summer.setLabel16} · noon ${Math.round(model.solar.summer.noonAltitudeDeg)}°`,
      SUN_SUMMER_COLOR,
    );
    drawSectorMarker('summer-sun', cx + summerApex[0] * summerR, cy + summerApex[1] * summerR, '#D89A35');
    // The NOON ALTITUDE belongs on the banner, not only on the apex label the dodger is free to
    // move or drop. Two arcs of different radii say "these are different seasons"; only the angle
    // says HOW different, and it is the number a farmer measures a shade tree against. Rory, of
    // the on-canvas twin: "put the winter sun as well properly with angle."
    directLabelAt(
      cx,
      H * 0.08,
      [`SUMMER SUN · ${model.solar.summer.riseLabel16} → ${model.solar.summer.noonSide} → ${model.solar.summer.setLabel16} · NOON ${Math.round(model.solar.summer.noonAltitudeDeg)}°`],
      SECTOR_STYLES['summer-sun'].labelColor,
      0,
      true,
    );
  }
  if (winterApex) {
    labelAt(
      cx + winterApex[0] * (winterR + rowH * 0.7),
      cy + winterApex[1] * (winterR + rowH * 0.7),
      `WINTER SUN · ${model.solar.winter.riseLabel16} → ${model.solar.winter.noonSide} → ${model.solar.winter.setLabel16} · noon ${Math.round(model.solar.winter.noonAltitudeDeg)}°`,
      SUN_WINTER_COLOR,
    );
    drawSectorMarker('winter-sun', cx + winterApex[0] * winterR, cy + winterApex[1] * winterR, '#C9AA5B');
    directLabelAt(
      cx,
      H * 0.125,
      [`WINTER SUN · ${model.solar.winter.riseLabel16} → ${model.solar.winter.noonSide} → ${model.solar.winter.setLabel16} · NOON ${Math.round(model.solar.winter.noonAltitudeDeg)}°`],
      SECTOR_STYLES['winter-sun'].labelColor,
      0,
      true,
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
    const directLines = w.id === 'berg'
      ? ['HOT DRY BERG WIND', w.fromLabel]
      : w.id === 'cold_front'
        ? ['COLD-FRONT WIND', w.fromLabel]
        : ['SUMMER COOLING WIND', w.fromLabel];
    // Composed sheet: the benchmark arrow carries its own name in its body, so there is no
    // floating label to queue and nothing left to collide with the arrow (the old tangent-shifted
    // directLabelAt pills were exactly what kept landing on top of the arrows they named).
    const marker = externalLegend
      ? drawBroadEnergyArrow(v, color, w.id === 'cold_front' ? 1.08 : 1, directLines)
      : drawArrow(v, color, windWidth(kind), [...SECTOR_STYLES[kind].dash], R * 0.4);
    if (w.id === 'cold_front') drawDrivingRain(w.bearingDeg, w.halfWidthDeg, color);
    labelAt(cx + v[0] * (R + arrowLen), cy + v[1] * (R + arrowLen), `${w.title} ${w.fromLabel}`, lblColor);
    drawSectorMarker(`wind:${w.id}`, marker.sxp, marker.syp, color);
  }
  // Fire and the berg wind deliberately share a bearing. Painting this when the fire wedge is
  // created lets the later berg arrow erase it, so the fire legend's red dashed swatch describes
  // no visible red dash. One final centreline after the wind arrows keeps both registers honest
  // without restoring the wedge's two long edge rays.
  if (fireWedge) drawRegionalCenterline(fireWedge, SECTOR_STYLES.fire.color);

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
    // BESIDE the tail, never on the arrow's own axis — the benchmark sets this text to the side
    // of its grey arrow. Anchored on-axis, the label's downward escape candidates were blocked by
    // its own arrow's claim chain and its horizontal ones by the sun-arc labels, so the dodger
    // had nowhere legal left and fell back onto "WINTER SUN". Tangent side picked outward (away
    // from the plot centre), where the frame edge keeps ground mostly empty.
    const accessTangent: [number, number] = [-v[1], v[0]];
    const accessBaseX = cx + v[0] * (R + arrowLen * 1.05);
    const accessBaseY = cy + v[1] * (R + arrowLen * 1.05);
    const outwardSign =
      Math.hypot(accessBaseX + accessTangent[0] - cx, accessBaseY + accessTangent[1] - cy)
        >= Math.hypot(accessBaseX - accessTangent[0] - cx, accessBaseY - accessTangent[1] - cy)
        ? 1
        : -1;
    directLabelAt(
      accessBaseX + outwardSign * accessTangent[0] * rowH * 3.4,
      accessBaseY + outwardSign * accessTangent[1] * rowH * 3.4,
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
    // Same fix as the sun arc and the wind arrows: a plain blue line at 76% alpha was built for a
    // flat tint and vanishes into a busy AI-painted ground. One dark halo pass under the real line
    // and arrowhead first — same path, wider, dark — then the actual colour on top.
    if (externalLegend) {
      ctx.strokeStyle = 'rgba(6,10,8,0.5)';
      ctx.fillStyle = 'rgba(6,10,8,0.5)';
      ctx.lineWidth = Math.max(4, W * 0.0048) + Math.max(3, W * 0.0026);
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
        const wah = Math.max(13, W * 0.016) + Math.max(3, W * 0.0026);
        ctx.beginPath();
        ctx.moveTo(wex, wey);
        ctx.lineTo(wex - wah * Math.cos(wang - 0.42), wey - wah * Math.sin(wang - 0.42));
        ctx.lineTo(wex - wah * Math.cos(wang + 0.42), wey - wah * Math.sin(wang + 0.42));
        ctx.closePath();
        ctx.fill();
        ctx.setLineDash(model.water.indicative ? [8, 6] : []);
      }
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

    // Terrain-RGB marching-squares paths, fetched through the same API as the interactive map.
    // The five-point SRTM plane above still supplies the explicitly indicative FALL arrow and the
    // established adaptive interval; it supplies no contour endpoint.
    if (
      !model.flat
      && bnd.length >= 3
      && model.water.slopeDeg >= 1.5
      && sheetContours?.status === 'ok'
      && sheetContours.lines.length > 0
    ) {
      contourIntervalM = sheetContours.intervalM;
      ctx.save();
      // The API traces beyond the request edge so paths are not truncated; the property ring is
      // the authoritative sheet crop.
      blueprintRing(ctx, bnd, px, py);
      ctx.clip();
      // MORE PRESENT — Rory: "make the contours a little more prominent." They were drawn at 46%
      // alpha on the finished sheet, which on a real aerial is barely a suggestion, and contours
      // are the one thing on this sheet a swale is actually set out against. Lifted to 78%, with
      // index (major) lines properly heavier than intermediates as on any topographic sheet, and
      // a dark casing under the colour — the same body-inside-a-casing rule the arrows, canopies
      // and crop rows all follow, and the only thing that reliably survives dark foliage.
      ctx.setLineDash([7, 6]);
      ctx.globalAlpha = externalLegend ? 0.78 : 1;
      for (const line of sheetContours.lines) {
        const core = line.major ? 3.4 : 2.2;
        ctx.beginPath();
        line.points.forEach(([x, y], index) => {
          if (index === 0) ctx.moveTo(px(x), py(y));
          else ctx.lineTo(px(x), py(y));
        });
        ctx.strokeStyle = 'rgba(10,22,10,0.55)';
        ctx.lineWidth = core + 2.4;
        ctx.stroke();
        ctx.strokeStyle = line.major ? 'rgba(160,235,140,0.98)' : 'rgba(126,212,107,0.95)';
        ctx.lineWidth = core;
        ctx.stroke();
      }
      // Absolute elevations come from Terrain-RGB thresholds, not relative offsets on a plane.
      ctx.font = `700 ${Math.round(rowH * 0.32)}px ${SHEET_BODY_FONT}`;
      ctx.fillStyle = 'rgba(183,232,166,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      sheetContours.lines.forEach((line, index) => {
        if (externalLegend) return;
        if (index % 2 !== 0) return;
        const midpoint = line.points[Math.floor(line.points.length / 2)];
        ctx.fillText(`${line.elevM}m`, px(midpoint[0]), py(midpoint[1]));
      });
      ctx.restore();
      const middleLine = sheetContours.lines[Math.floor(sheetContours.lines.length / 2)];
      if (middleLine) {
        const midpoint = middleLine.points[Math.floor(middleLine.points.length / 2)];
        labelAt(px(midpoint[0]), py(midpoint[1]), 'REAL TERRAIN CONTOUR — SWALES FOLLOW THIS CURVE', '#B7E8A6');
        labelAt(px(midpoint[0]), py(midpoint[1]) + rowH * 0.6, `CONTOUR INTERVAL ${sheetContours.intervalM} m`, '#B7E8A6');
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
  //
  // isAiBase alone was the wrong gate: it means "an AI-illustrated ground", but the thing that
  // actually threatens this title's legibility is ANY real photographic ground — the exact sheet's
  // drone photo (frame.satDataUrl) is every bit as dark/saturated in places as AI art, and unlike
  // AI art it was never gated on needing a scrim at all. Rory, on a real farm sheet: "the text and
  // font sizes and everything is terrible, I can't see anything on this image" — dense KZN bush
  // under white title text, no scrim, exactly this case. The flat-colour fallback (no satDataUrl,
  // solid #727466 — see drawAnalysisBase) is the one base that was genuinely always light enough;
  // that's the only case this now leaves unscrimmed.
  // No title on the map when the panel carries it, so no scrim is needed to protect one.
  if ((isAiBase || frame.satDataUrl) && !externalLegend) {
    drawTitleBlockScrim(
      ctx, pad,
      [titleStr, subtitleStr, dataStripStr, sourcesStr],
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
  // GATED like the two lines above it. When the sheet has an external legend panel, that panel
  // already prints "02 — SECTOR ANALYSIS" and the place name — so burning the same title onto the
  // map said it twice AND crowded the top-left corner, where the berg-wind arrow and both sun-path
  // labels also land. The dataStrip and sources lines directly above were already gated this way;
  // the title simply missed the gate.
  if (!externalLegend) drawBlueprintTitle(ctx, W, pad, titleStr, subtitleStr);
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
  if (winterApex) rows.push({ color: SUN_WINTER_COLOR, label: sectorPresentationByKey.get('winter-sun')?.label ?? 'Winter sun', style: 'line', icon: markerIcon('winter-sun'), sectorIcon: 'sun' });
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
  if (model.water) rows.push({ color: '#3A8EC4', label: `Site slope estimate falls ${site?.elevation?.aspectLabel ?? 'downhill'} · ~${model.water.slopePct.toFixed(0)}% (five-point SRTM · indicative)`, style: model.water.indicative ? 'dashline' : 'line', icon: markerIcon('water'), sectorIcon: 'water' });
  if (model.water && sheetContours?.status === 'ok' && contourIntervalM != null) rows.push({ color: '#7ED46B', label: `Terrain-RGB contour — ${contourIntervalM} m interval`, style: 'dashline', sectorIcon: 'water' });
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
  const baseNoteText = model.namedWind.length > 0
    ? `${evidence.footer} ${REGIONAL_FOOTER}${siteWindEvidence}`
    : `${evidence.footer} ${model.dataNotes[0] ?? 'Read the site before you design it.'}${siteWindEvidence}`;
  const contourEvidenceNote = !model.water
    ? ''
    : sheetContours?.status === 'ok'
      ? ' CONTOURS — Mapbox Terrain-RGB marching-squares geometry. The slope arrow and percentage remain a separate five-point SRTM plane estimate and are indicative.'
      : sheetContours?.status === 'too-flat' && sheetContours.source === 'mapbox-terrain-rgb'
        ? ` TERRAIN-RGB CONTOURS — no ${sheetContours.intervalM} m contour crosses the traced property; no contour lines drawn.`
        : sheetContours?.status === 'too-flat'
          ? ' CONTOURS OMITTED — the five-point SRTM slope reads too flat for a useful interval.'
          : ' REAL CONTOURS UNAVAILABLE — no contour lines drawn; the five-point SRTM slope arrow remains indicative.';
  const noteText = `${baseNoteText}${contourEvidenceNote}`;
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
// energy degrades independently when its data is missing. Same Blueprint chrome as sheets 03–09.
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
    // Generic — the tool covers whatever staple crop the farmer actually grows there, not just one
    // combination (Rory: "its not just for maize and beans byt way it for many staple crops").
    staple_garden: 'STAPLE GARDEN',
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
  const elevation = site?.elevation;
  const sheetContours = await fetchSheetContours(
    renderFrame,
    renderRefLayers.boundary,
    elevation?.directionConfidence === 'unconfirmed' ? Number.NaN : elevation?.slopeDeg ?? Number.NaN,
    elevation?.directionConfidence === 'unconfirmed' ? Number.NaN : elevation?.aspectDeg ?? Number.NaN,
  );
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
  // authoritative house, boundary, arrows and arcs below.
  //
  // OUTLINES, NOT SLABS — and the driveway is not drawn here at all. This sheet used to paint the
  // house AND the traced driveway as filled dark shapes at 55% alpha. On the demo farm that is two
  // grey rectangles; on a farm where the drive was traced as a sprawling area it is a dark lattice
  // laid over the one thing sheet 02 is meant to show — the photograph the energies are read
  // against. Rory: "look at those polygons they mess up the image … if the underlying reproduction
  // is good, maybe we just leave it without basemap polygons, maybe just the fence line?"
  //
  // He is right about the fill and the driveway; the driveway keeps its meaning through the access
  // arrow and legend row 7 (bearing — dust & noise), which is the only sector-relevant fact the tar
  // carries. Neither change touches saved geometry: this is what gets PAINTED, not what is stored,
  // and sheets 01 and 03–09 are untouched — the existing fabric is their subject.
  //
  // THE HOUSE OUTLINE ONLY SURVIVES WHERE THERE IS NO BASE IMAGE — "the double roof". A hollow
  // outline over a photograph that ALREADY shows the roof draws a second roof by construction: a
  // hand-traced polygon never lands exactly on a photographed roof edge, so the drawn hairline sits
  // a few pixels off the real one and the farmer sees his building twice. Rory, on the drone-photo
  // sheet: "genuinely a lot better but the double roof". Every other sheet escapes this because it
  // fills the footprint (an opaque roof covers the photographed one — exactly one roof); sector
  // deliberately cannot fill, per the paragraph above.
  //
  // So the conditional in Rory's own earlier sentence is the rule: "IF THE UNDERLYING REPRODUCTION
  // IS GOOD, maybe we just leave it without basemap polygons, maybe just the fence line?" With a
  // real aerial or an AI-illustrated ground the reproduction IS good — the buildings are plainly
  // visible, and the outline adds nothing but the duplicate. It is also the only mark on this sheet
  // with no legend row (rows 1–10 are sun, winds, fire, access, slope, contour, boundary), i.e. an
  // unexplained polygon by this sheet's own standard. Drawn only on the flat-grey fallback base,
  // where without it the buildings would not be visible at all.
  const sectorHasImageryBase = baseImage !== null || Boolean(renderFrame.satDataUrl);
  if (!sectorHasImageryBase) {
    ctx.save();
    for (const footprint of authoritativeHouseFootprints(renderState, renderRefLayers)) {
      drawBlueprintHouse(
        ctx,
        footprint,
        px,
        py,
        SECTOR_CONTEXT_NO_FILL,
        'rgba(255,255,255,0.92)',
        Math.max(2, W * 0.0016),
      );
    }
    ctx.restore();
  }
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
    sheetContours,
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
    {
      sheetNumber: '02',
      legendRows,
      footerHeading: 'NOTES & PROVENANCE',
      footerText: analysis.noteText,
      footerBox: true,
    },
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

// Single source of truth for sheet 09's complete map-plus-schedule envelope. The exact sheet, both
// AI inputs, the panel blank-out and the protect mask must agree byte-for-byte about these bounds:
// a private size in any one path either exposes real schedule text to the model or restores it into
// the wrong place. calculatePhasingSheetSize shares the same map + readable-column rule as 01–08.
//
// Those four used to derive W/H from the RAW frame while nothing else did, which was fine only
// while sheet 08 alone stayed 3:2. The moment it follows the boundary like sheets 01–08, any path
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

/** Where the Phasing sheet's schedule panel sits.
 *
 * `mapX` is the label gutter: sheet 09 composes its own panel instead of going through
 * composeStyleSheet, so it has to inset the map by hand or its column geometry stops matching the
 * rest of the set — and, worse, stops matching calculateStyleSheetSize, which is what the A-series
 * aspect search solves against. A sheet whose panel is drawn one gutter left of where the size
 * calculation says it is prints with the schedule half over the map. */
function phasingPanelRect(size: ReturnType<typeof calculatePhasingSheetSize>) {
  const pad = Math.round(size.mapW * 0.02);
  const lgW = size.legendWidth;
  const mapX = size.gutter;
  const lgX = mapX + size.mapW + size.gutter;
  const lgY = 0;
  const lgBottom = size.H;
  return { pad, lgW, lgX, lgY, lgBottom, mapX };
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
  const { pad, lgX, mapX } = phasingPanelRect(size);
  const pxPerM = mapW / (renderFrame.imgW * renderFrame.mPerPx);

  // 1. The model's decorative illustrated background, normalised to the MAP column — not the whole
  //    sheet. The gutters are drawing furniture and must stay paper; letting the model's art run
  //    into them is how a "margin" turns back into more picture.
  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(0, 0, W, H);
  const modelImg = await loadImage(baseImage);
  ctx.drawImage(modelImg, mapX, 0, mapW, H);

  // 2. Every exact fact — ground, structures, boundary, phase pins — redrawn on top from saved
  //    design data into the map column only, never copied from (or left as) the model's paint.
  ctx.save();
  ctx.translate(mapX, 0);
  await drawPhasingExactContent(ctx, renderState, renderFrame, renderRefLayers, plan, mapW, mapH);

  // 3. Scale bar and north arrow, drawn as exact vector chrome (not a photographic strip copied
  //    from a separately rendered sheet, which risked a hard seam and could clip the north arrow).
  const scaleRowH = Math.round(mapW * 0.026);
  drawBlueprintScaleBar(ctx, mapW, mapH, pad, scaleRowH, pxPerM);
  ctx.restore();
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

// buildPhasingProtectMask lived here. It marked the schedule panel as protected on a sheet-shaped
// model input, and it is gone because the panel is no longer part of that input at all:
// generatePhasingViaQueue uploads the MAP COLUMN, so there is no panel region on the image to
// protect, and a sheet-shaped mask stretched over a map-shaped input would have frozen the
// right-hand quarter of the map instead. The guarantee it was standing in for is unchanged and
// stronger: the model is never shown real schedule text (the crop, plus blankPhasingPanel), and
// composePhasingSheet redraws every exact fact on top of whatever comes back, at either stage.

// Deterministic "Blueprint" IMPLEMENTATION & PHASING sheet — sheet 09 in docs/PLAN-SET-SPEC.md,
// the product differentiator. This is the EXACT / reliable counterpart to the Gemini
// 'Implementation' ANALYSIS style: that one is an illustrated free-hand render (great to look at,
// not guaranteed); THIS one is a RULES-ENGINE render — lib/phasing.buildPhasePlan derives the
// phases deterministically from the placed design + the permaculture Scale of Permanence + the
// rainfall season, and we draw them precisely. Same chrome as sheets 03–07 (satellite + scrim, tar
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
  // FRAMED TO THE BOUNDARY, with a separate schedule column like sheets 01–08.
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
  const { pad, lgW, lgX, lgY, lgBottom, mapX } = phasingPanelRect(size);

  // 1. Satellite + scrim, inset into the map column so the label gutters stay paper.
  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(mapX, 0);
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
  ctx.restore(); // end of the map column — the panel below is in SHEET coordinates

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
  // Sheet 08's header used SHEET_TITLE_FONT (Georgia) while 01–07 set theirs in
  // REFERENCE_LABEL_FONT, so one sheet of a printed plan set arrived in a different typeface. It
  // also made the sheet number read as "o8": Georgia has oldstyle figures, so its zero sits at
  // x-height next to a full-height 8. Nobody chose that — the phasing panel was written separately
  // and reached for the nearest title constant.
  const headerFont = `800 ${fsHeader}px ${REFERENCE_LABEL_FONT}`;
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
  // 09, not 08. This sheet printed the same number as the Whole-design sheet, so a plan set handed
  // to a funder or a builder had two sheet 08s and no sheet 09 — see docs/PLAN-SET-SPEC.md, where
  // Phasing has been 09 since Earthworks took 05. A hardcoded string is why it drifted; the number
  // is now taken from the same table the sheet buttons read.
  const phasingSheetNo = DESIGN_SHEETS.find(
    (sheet) => 'exact' in sheet && sheet.exact === 'implementation',
  )?.no ?? '09';
  const panelTitleLines = wrap(`${phasingSheetNo} — IMPLEMENTATION MAP & PHASING`, innerW, headerFont);

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

  // ONE PAPER SIZE FOR THE WHOLE SET. Sheet 09 builds its own canvas and returns it directly rather
  // than going through composeStyleSheet, so it was the only sheet that never reached the paper
  // step: eight sheets came out at the A-series 1.414 and this one at 1.985. A plan set is bound,
  // printed and read as one document, and a sheet that is a different shape from its siblings
  // announces itself as an afterthought before anyone has read a word of it.
  //
  // padToPaperSheet only ever ADDS margin around a finished sheet, so nothing here moves relative
  // to anything else and nothing can be clipped.
  return padToPaperSheet(canvas);
}

// Legend rows for a Style sheet — the real design content on this layer (zones, grouped
// elements, line kinds, driveway). Deterministic: read straight from state.
interface StyleLegendRow {
  swatch: string;
  text: string;
  defId?: string;
  lineKind?: string;
  /** A swatch that must be drawn as a specific symbol rather than derived from `swatch`/`defId`.
   *  Named `visual`, not `lineVisual`, because it is no longer only for lines: sheet 05 paints its
   *  areas with a soil treatment that no generic footprint painter reproduces. */
  visual?: 'earthworks-swale' | 'earthworks-soil' | 'flow-arrow' | 'canopy-above';
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
  /** Needed only by sheet 05's derived tree pits, which are counted in metre space. */
  legendFrame: CanvasFrame = { imgW: 1000, imgH: 1000, mPerPx: 0.1 } as CanvasFrame,
  /** The legend is the key the map's plant codes are looked up in, so it prints them only in the
   *  mode that draws them — a "MG ·" prefix on a sheet with no MG anywhere keys nothing. */
  labelMode: SheetLabelMode = DEFAULT_SHEET_LABEL_MODE,
): StyleLegendRow[] {
  const rows: StyleLegendRow[] = [];
  // Sheet 05 derives a pit for every tree that has no basin of its own (drawEarthworksFeatures).
  // Derived or not, it is a mark on the map, so it gets a row — that rule has no exceptions, and
  // the word "derived" in the label is what stops a reader counting it as something they placed.
  if (filter === 'earthworks') {
    const pits = derivedTreeBasinCount(state, legendFrame);
    if (pits > 0) {
      rows.push({
        swatch: ELEMENTS_BY_ID.tree_basin?.color ?? '#A9743F',
        text: countedLegendText('Tree pit to dig (one per tree)', pits),
        defId: 'tree_basin',
        visual: 'earthworks-soil',
      });
    }
  }
  if (filter === 'zones') {
    for (const group of exactSheetZoneLegendGroups(state, filter)) {
      rows.push({ swatch: ZONE_DEFS[group.zone].color, text: group.text, kind: 'zone' });
    }
  }
  // Ground fabric, register-aware. drawBlueprintGround paints traced house/patio/driveway/lawn/
  // veg_garden/orchard/cleared on every sheet now (RC2/RC6), but a legend must not claim OWNERSHIP
  // of ground a sheet only shows for orientation. groundRows(state, refLayers, filter) already
  // returns only the rings groundRegister calls this filter's CONTENT (all/planting/structures) —
  // list those by name, same as the Blueprint builders do. On a CONTEXT sheet (water/zones) that
  // call returns [] by construction: the quieter wash is deliberately orientation context, never
  // a caption or legend claim.
  const contentGround = exactSheetGroundLegendGroups(state, refLayers, filter);
  for (const g of contentGround) {
    rows.push({
      swatch: g.color,
      text: g.text,
      kind: 'ground',
      // The staple garden is DESIGNED planting, not site fabric. groundFeatureLayer is the same
      // authority that hands its ring to the Planting layer switch — a third system asking "whose
      // is this ring" must give the same answer as the other two. Tagged only on 'all' because the
      // blanket SITE EDGE stamp below is the only place a ground row gets a section at all.
      ...(filter === 'all' && groundFeatureLayer(g.feature) === 'planting'
        ? { section: 'PLANTING' as const }
        : {}),
    });
  }

  if (filter === 'all') {
    const allGround = rows.splice(0);
    const plantingGround = allGround.filter((row) => row.section === 'PLANTING');
    const siteRows: StyleLegendRow[] = allGround
      .filter((row) => row.section !== 'PLANTING')
      .map((row) => ({ ...row, section: 'SITE EDGE' }));
    if (refLayers.boundary.length >= 3) {
      siteRows.push({ swatch: BOUNDARY_LINE_GREEN, text: 'Property boundary', lineKind: 'fence', section: 'SITE EDGE' });
    }
    if (refLayers.driveway.length >= 2) {
      siteRows.push({ swatch: '#5A5D57', text: EXACT_DRIVEWAY_LEGEND_TEXT, kind: 'surface', section: 'SITE EDGE' });
    }
    const allLineGroups = exactSheetLineLegendGroups(state, filter);
    const accessLineGroup = allLineGroups.find((group) => !group.lineKind);
    if (accessLineGroup) {
      siteRows.push({
        swatch: '#8A6D3B',
        text: countedLegendText(accessLineGroup.text, accessLineGroup.count),
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
        text: countedLegendText(summary.text, group.count, group.status),
        section: summary.section,
      });
    }
    const waterRows: StyleLegendRow[] = allLineGroups
      .filter((group): group is typeof group & { lineKind: LineShape['kind'] } => Boolean(group.lineKind))
      .map((group) => ({
        swatch: waterRouteStyleFor(group.lineKind)?.color ?? LINE_COLORS[group.lineKind] ?? '#8C8577',
        text: countedLegendText(group.text, group.count),
        lineKind: group.lineKind,
        section: 'WATER',
      }));
    const orderedContent = [
      ...contentRows.filter((row) => row.section === 'WATER'),
      ...waterRows,
      // Planting-owned ground (the staple garden) sits WITH the planting cluster: the renderer
      // prints a heading whenever row.section changes, so a stray PLANTING row inside the SITE
      // EDGE run would print the heading twice.
      ...plantingGround,
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
      status: group.status,
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
  // The key the map codes are looked up in — same function, same input as drawPlantMarks, so a code
  // on a canopy and the row that explains it can never disagree. See lib/plant-codes.ts. Empty in
  // 'names' mode, where the map carries no codes for this to be a key to.
  const legendPlantCodes = labelMode === 'codes'
    ? plantCodesForSheet(groups.map((group) => group.defId))
    : new Map<string, string>();
  for (const group of orderedGroups) {
    rows.push({
      swatch: group.color,
      defId: group.defId,
      text: codedLegendText(legendPlantCodes.get(group.defId), countedLegendText(group.name, group.n, group.status)),
      section: group.section,
      // SHEET 05 DOES NOT PAINT ITS AREAS THE WAY THE OTHER SHEETS DO. drawEarthworksFeatures
      // gives every earth feature a cream casing over bare mulched soil, because on this sheet a
      // vegetable bed is a hole to dig rather than a thing to grow in — Rory: "in the earthworks
      // section raised beds must just be brown". Deriving these swatches from the generic footprint
      // painter keyed the same bed with its green planting icon, so the sheet's key described a
      // different drawing from the one beside it.
      ...(filter === 'earthworks' ? { visual: 'earthworks-soil' as const } : {}),
    });
  }
  for (const group of exactSheetLineLegendGroups(state, filter)) {
    const kind = group.lineKind;
    if (!kind) continue;
    const earthworksStyle = filter === 'earthworks' && kind === 'swale' ? EARTHWORKS_ROUTE_STYLE.swale : undefined;
    const waterStyle = filter === 'water' ? waterRouteStyleFor(kind) : undefined;
    const plantingStyle = filter === 'planting' ? plantingRouteStyleFor(kind) : undefined;
    rows.push({
      swatch: earthworksStyle?.color ?? waterStyle?.color ?? plantingStyle?.color ?? LINE_COLORS[kind] ?? '#8C8577',
      text: countedLegendText(group.text, group.count),
      lineKind: kind,
      ...(earthworksStyle ? { visual: 'earthworks-swale' as const } : {}),
      section: earthworksStyle ? 'WATER EARTHWORKS'
        : waterStyle
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

  // THE MARKS EVERY SHEET DRAWS AND ONLY ONE SHEET KEYED.
  //
  // The property boundary and the driveway are drawn on all nine sheets — the boundary as a bone
  // line with fence ticks, the driveway as dark tar — and until now they were legended only on
  // sheet 08, because the rows that describe them sat inside `if (filter === 'all')`. Six sheets
  // therefore carried a distinctive green-and-bone line, at full strength, with nothing anywhere
  // saying what it was. It is not self-evident: a farmer who has also drawn fences cannot tell
  // from the drawing whether that line is their cadastral boundary or one of their fences, and
  // those are different things to build.
  //
  // Appended last and without a section heading, which is both the conventional plan-set order —
  // the sheet's own content first, the site context it sits in afterwards — and the thing that
  // keeps it out of the per-sheet section sort above.
  //
  // The traced BUILDING deliberately gets no row. On these sheets it is not a drawn symbol at all:
  // it is the photograph itself, restored to full sharpness inside its own outline. A key explains
  // marks the renderer invented, and an aerial photograph of a roof needs no key.
  // Sheet 08 has already returned by here with its own SITE EDGE section, so this is exactly the
  // six sheets that were missing these rows.
  if (refLayers.boundary.length >= 3) {
    rows.push({ swatch: BOUNDARY_LINE_GREEN, text: 'Property boundary', lineKind: 'fence' });
  }
  if (refLayers.driveway.length >= 2) {
    rows.push({ swatch: '#5A5D57', text: EXACT_DRIVEWAY_LEGEND_TEXT, kind: 'surface' });
  }
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

  if (row.visual === 'canopy-above') {
    // The mark it explains: a dashed ring with something solid inside it. Nothing is drawn on these
    // sheets without a legend row to explain it, and a dashed canopy edge is meaningless to a reader
    // who has not been told it means "tree above".
    const r = Math.min(w, h) * 0.42;
    const cx = x + w / 2;
    ctx.save();
    ctx.strokeStyle = row.swatch;
    ctx.lineWidth = Math.max(1.4, h * 0.05);
    ctx.setLineDash([Math.max(3, r * 0.34), Math.max(2, r * 0.24)]);
    ctx.beginPath();
    ctx.arc(cx, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = row.swatch;
    ctx.beginPath();
    ctx.arc(cx, y, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (row.visual === 'flow-arrow') {
    // The same open V the map draws, at chip scale — a filled head would read as a different symbol.
    const head = Math.max(4, h * 0.16);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [stroke, lineWidth] of [
      ['rgba(250,246,232,0.85)', Math.max(3, h * 0.11)] as const,
      [row.swatch, Math.max(1.4, h * 0.045)] as const,
    ]) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.moveTo(x + w - head, y - head * 0.7);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w - head, y + head * 0.7);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (row.visual === 'earthworks-soil') {
    // The same three moves drawEarthworksFeatures makes on the map: cream casing, bare mulched
    // soil, and the element's own shape. Circles stay circles — a tree pit keyed as a rectangle
    // sends a farmer out to dig the wrong hole.
    const def = row.defId ? ELEMENTS_BY_ID[row.defId] : undefined;
    const round = def?.shape === 'circle';
    const boxH = h * 0.72;
    const boxW = round ? boxH : w;
    const boxX = round ? x + (w - boxW) / 2 : x;
    const boxY = y - boxH / 2;
    const shape = () => {
      ctx.beginPath();
      if (round) ctx.ellipse(boxX + boxW / 2, y, boxW / 2, boxH / 2, 0, 0, Math.PI * 2);
      else roundRectPath(ctx, boxX, boxY, boxW, boxH, Math.min(boxW, boxH) * 0.1);
    };
    ctx.save();
    shape();
    ctx.strokeStyle = 'rgba(252,248,236,0.92)';
    ctx.lineWidth = Math.max(2, h * 0.07);
    ctx.lineJoin = 'round';
    ctx.stroke();
    shape();
    ctx.fillStyle = CROP_SOIL_COLOR;
    ctx.fill();
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

  if (row.visual === 'earthworks-swale') {
    // The Earthworks map draws a swale as a cut ditch, a spoil berm and hachures. A flat brown
    // stroke in its legend was the last place that still described the old route-only symbol.
    const mid = y;
    const half = Math.max(5, h * 0.27);
    const path = (fromY: number, toY: number, color: string, width: number) => {
      ctx.beginPath();
      ctx.moveTo(x, fromY);
      ctx.lineTo(x + w, toY);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'butt';
    path(mid, mid, EARTHWORKS_ROUTE_STYLE.swale.casing, half * 2.2);
    path(mid - half * 0.28, mid - half * 0.28, '#4A2F1B', half);
    path(mid + half * 0.28, mid + half * 0.28, row.swatch, half);
    ctx.strokeStyle = EARTHWORKS_ROUTE_STYLE.swale.casing;
    ctx.lineWidth = Math.max(1, half * 0.16);
    for (let px = x + w * 0.16; px < x + w; px += Math.max(8, w * 0.22)) {
      ctx.beginPath();
      ctx.moveTo(px, mid);
      ctx.lineTo(px, mid + half * 0.82);
      ctx.stroke();
    }
    path(mid, mid, 'rgba(246,240,222,0.8)', Math.max(1, half * 0.12));
    ctx.restore();
    return;
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
  // A SWATCH MUST LOOK LIKE THE THING ON THE MAP. That is this file's rule and it is the only
  // reason these two branches differ.
  //
  // GROUND surfaces — driveway, patio, cleared ground — are ruled on the map, because ruling is
  // how a site plan says "hard surface", so their chips are ruled too.
  //
  // ZONES are a flat translucent colour with a stronger band at the edge (buildZoneOverlay), so
  // their chips are that. They were ruled here, and stayed ruled after the map stopped being —
  // which is exactly the "two systems answering one question" drift this codebase keeps finding:
  // the swatch and the map are two descriptions of one symbol, and only one of them got updated.
  const ruledArea = row.kind === 'ground';
  const zoneArea = row.kind === 'zone';
  const swatchTop = y - h * 0.34;
  const swatchH = h * 0.68;
  const swatchR = Math.max(2, h * 0.08);
  roundRectPath(ctx, x, swatchTop, w, swatchH, swatchR);
  ctx.fillStyle = row.swatch;
  ctx.globalAlpha = ruledArea ? 0.14 : zoneArea ? 0.3 : 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  if (ruledArea) {
    ctx.save();
    roundRectPath(ctx, x, swatchTop, w, swatchH, swatchR);
    ctx.clip();
    ctx.strokeStyle = row.swatch;
    ctx.lineWidth = Math.max(1.1, h * 0.055);
    for (let d = -h; d < w + h; d += Math.max(5, h * 0.26)) {
      ctx.beginPath(); ctx.moveTo(x + d, y - h / 2); ctx.lineTo(x + d - h, y + h / 2); ctx.stroke();
    }
    ctx.restore();
  } else if (zoneArea) {
    // The map's edge band, at chip scale: stroked inside a clip of the chip so only the inner half
    // lands, same as buildZoneOverlay does around a real zone.
    ctx.save();
    roundRectPath(ctx, x, swatchTop, w, swatchH, swatchR);
    ctx.clip();
    roundRectPath(ctx, x, swatchTop, w, swatchH, swatchR);
    ctx.strokeStyle = row.swatch;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(3, swatchH * 0.34);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  roundRectPath(ctx, x, swatchTop, w, swatchH, swatchR);
  ctx.strokeStyle = ruledArea || zoneArea ? row.swatch : 'rgba(32,25,15,0.38)';
  ctx.lineWidth = ruledArea || zoneArea ? Math.max(1.4, h * 0.06) : 1;
  ctx.stroke();
  ctx.restore();
}

// Compose the illustrated Style render into a proper SHEET: map left, titled legend panel right,
// scale bar + north arrow over the map — the layout of the reference plan sets (see
// docs/PLAN-SET-SPEC.md). The Blueprint maps bake this in; the Style output never had it, which is
// most of the visible gap vs ChatGPT's sheets. All drawn deterministically from the real design.
/**
 * Centre a finished sheet on A-series landscape paper.
 *
 * Pure addition: the composed sheet is drawn unchanged into a larger paper-coloured canvas, so no
 * mark moves relative to any other mark and nothing can be clipped. Where the plot's shape does not
 * match the paper the difference shows as margin, which is what the research on odd-shaped sites
 * recommends over cropping the property or rotating the sheet (rotating would break the Sector
 * sheet, whose sun and wind arrows depend on true north).
 *
 * Applied at the very end of composeStyleSheet, which is the FINAL composer on every path —
 * including the paid ones, where the model has already rendered and this only adds chrome. No AI
 * input is ever a padded sheet.
 */
function padToPaperSheet(sheet: HTMLCanvasElement): string {
  const paper = paperSheetCanvas(sheet.width, sheet.height);
  if (paper.width === sheet.width && paper.height === sheet.height) return sheet.toDataURL('image/png');
  const canvas = document.createElement('canvas');
  canvas.width = paper.width;
  canvas.height = paper.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sheet.toDataURL('image/png');
  // The legend panel's own cream, so the margin reads as the sheet's paper rather than as a border
  // someone forgot to fill.
  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(0, 0, paper.width, paper.height);
  ctx.drawImage(
    sheet,
    Math.round((paper.width - sheet.width) / 2),
    Math.round((paper.height - sheet.height) / 2),
  );
  return canvas.toDataURL('image/png');
}

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
  options: {
    sheetNumber?: string;
    legendRows?: StyleLegendRow[];
    /** Rows a SHEET adds that sheetLegendRows cannot derive from the design alone — sheet 04's
     *  overland-flow field is computed from site elevation, which the legend builder never sees.
     *  Appended, never replacing, so the derived inventory stays complete. */
    extraLegendRows?: StyleLegendRow[];
    footerHeading?: string;
    footerText?: string;
    footerBox?: boolean;
    /** Whether this sheet's map carries plant codes. The legend keys them, so it must only print
     *  them in the mode that draws them — see SheetLabelMode. */
    labelMode?: SheetLabelMode;
    /** Ranged callouts for the label gutters, already laid out in MAP coordinates. Omitted by the
     *  sheets that burn their own on-map labels (01, 02, 09) — they still get the gutter WIDTH, so
     *  every sheet in the set carries the same margins, they just leave it as clean paper. */
    gutterLayout?: GutterLayout;
  } = {},
): Promise<string> {
  const map = await loadImage(mapDataUrl);
  // THE SHEET IS [gutter][map][gutter][legend]. `W` remains "everything left of the legend panel",
  // which is what every measurement below already means by it, so the panel code is untouched.
  const mapW = map.width;
  const H = map.height;
  const gutter = sheetGutterWidth(mapW);
  const W = mapW + gutter * 2;
  const legendW = styleSheetLegendWidth(W);
  const outW = W + legendW;
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return mapDataUrl;
  // Paper under the bands first: the map is inset, and whatever is not map must read as sheet.
  ctx.fillStyle = '#FBF6EC';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(map, gutter, 0);
  if (options.gutterLayout) drawLabelGutter(ctx, options.gutterLayout, gutter, mapW, H);

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
  const titleSize = Math.round(legendW * 0.078);
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
  ctx.font = `600 ${Math.round(legendW * 0.05)}px ${SHEET_BODY_FONT}`;
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
  ctx.font = `600 ${Math.round(legendW * 0.045)}px ${SHEET_BODY_FONT}`;
  ctx.fillText(placeName ?? 'Your design', lx, y);
  y += Math.round(legendW * 0.035);
  ctx.strokeStyle = 'rgba(11,18,11,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lx, y);
  ctx.lineTo(maxX, y);
  ctx.stroke();

  // The word LEGEND is gone, and its line of vertical space with it. A key under a rule, on a plan
  // sheet, beside a map, is a legend — printing the word tells the reader nothing they cannot see
  // and costs the rows about 8% of the panel's height, which is exactly the height the type needed
  // to grow into. The reference sheet Rory has sent me repeatedly does not have it either.
  y += Math.round(legendW * 0.045);

  const rows = [
    ...(options.legendRows ?? sheetLegendRows(state, refLayers, filter, includeToolGlyphs, frame, options.labelMode ?? DEFAULT_SHEET_LABEL_MODE)),
    ...(options.extraLegendRows ?? []),
  ];
  const legendTop = y + Math.round(legendW * 0.03);
  const footerFs = options.footerText ? Math.max(9, Math.round(legendW * 0.025)) : Math.round(legendW * 0.036);
  const footerLineH = Math.max(11, Math.round(footerFs * 1.28));
  const footerBoxPad = options.footerBox ? Math.max(6, Math.round(legendW * 0.024)) : 0;
  const footerTextX = lx + footerBoxPad;
  const footerTextW = maxX - lx - footerBoxPad * 2;
  const wrapFooterText = (value: string): string[] => {
    ctx.font = options.footerHeading
      ? `600 ${footerFs}px ${SHEET_BODY_FONT}`
      : `italic 500 ${footerFs}px ${SHEET_BODY_FONT}`;
    // A NEWLINE IS A HARD BREAK, NOT A SPACE.
    //
    // This wrapped on /\s+/, which treats "\n" as whitespace like any other. The Water sheet's
    // budget is built as one fact per line and joined with newlines, so every fact ran into the
    // next: "Roof catchment traced: 144 m² Annual rainfall: 768 mm Runoff coefficient: 0.8 (generic
    // roof) Harvestable: ~88,474 L a year…". A block of numbers a farmer is meant to check against
    // their own tank came out as an unreadable paragraph — the data was right and the page was
    // wrong, which is the pairing this file keeps having to fix.
    //
    // Callers that pass a single line are unaffected: a string with no newline yields one segment
    // and wraps exactly as before.
    const lines: string[] = [];
    for (const segment of value.split('\n')) {
      if (!segment.trim()) continue;
      let current = '';
      for (const word of segment.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (current && ctx.measureText(next).width > footerTextW) {
          lines.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  };
  const customFooterLines = options.footerText ? wrapFooterText(options.footerText) : [];
  const footerHeadingH = options.footerHeading ? Math.round(legendW * 0.06) : 0;
  // Esri's imagery must be credited wherever it is shown — a licence term, not a courtesy — so the
  // exact-plan footer grows a fourth line for it. basemapAttribution() is '' on Mapbox, so this
  // reserves no extra space and changes nothing until NEXT_PUBLIC_ARCGIS_API_KEY is actually set.
  //
  // "WHEREVER IT IS SHOWN" CUTS BOTH WAYS. On the 'plain' underlay there is no photograph on the
  // sheet at all (lib/sheet-underlay.ts), and a credit for imagery that is not there is a false
  // statement about the drawing's sources — the opposite failure to an uncredited one, and on a
  // plan a farmer may hand to a funder it is the more embarrassing of the two. The absence of
  // satDataUrl is the same condition drawBlueprintBase uses to lay paper instead of a photo, so the
  // credit and the picture can never disagree.
  const attributionLine = frame.satDataUrl ? basemapAttribution() : '';
  const footerBlockH = customFooterLines.length
    ? customFooterLines.length * footerLineH
      + footerHeadingH
      + Math.round(legendW * 0.035)
      + footerBoxPad * 2
    : Math.round(legendW * (attributionLine ? 0.2 : 0.16));
  const panelBottom = H - panelInset;
  const footerTop = panelBottom - pad - footerBlockH;
  const availableRowsH = Math.max(1, footerTop - legendTop);
  const contentW = maxX - lx;
  const normalFs = legendRowFontSize(legendW, availableRowsH, rows.length);
  const baseSw = Math.round(legendW * 0.064);
  const columnGap = Math.max(10, Math.round(legendW * 0.025));
  const singleColumnTextGap = Math.round(legendW * 0.03);
  const compactColumnTextGap = Math.max(8, Math.round(legendW * 0.018));
  const wrapLegendText = (value: string, fontSize: number, textWidth: number): string[] => {
    ctx.font = `600 ${fontSize}px ${SHEET_BODY_FONT}`;
    const lines: string[] = [];
    let current = '';
    for (const word of value.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > textWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [value];
  };
  const wrapSectionHeading = (value: string, fontSize: number, columnWidth: number): string[] => {
    ctx.font = `800 ${fontSize}px ${REFERENCE_LABEL_FONT}`;
    const lines: string[] = [];
    let current = '';
    for (const word of value.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > columnWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [value];
  };
  const symbolSizeFor = (fontSize: number, columnWidth: number, columnCount: number) =>
    columnCount === 1
      ? Math.max(baseSw, Math.round(fontSize * 1.45))
      : Math.min(
          baseSw,
          Math.max(16, Math.round(fontSize * 1.45), Math.round(columnWidth * 0.12)),
        );
  const layoutRows = (
    sourceRows: StyleLegendRow[],
    fontSize: number,
    columnWidth: number,
    symbolSize: number,
    rowTextGap: number,
  ) => {
    const lineH = Math.max(11, Math.round(fontSize * 1.22));
    const sectionFs = Math.max(12, Math.round(fontSize * 0.88));
    const sectionLineH = Math.max(10, Math.round(sectionFs * 1.15));
    const textWidth = Math.max(1, columnWidth - symbolSize - rowTextGap);
    let previousSection: string | undefined;
    return sourceRows.map((row) => {
      const lines = wrapLegendText(row.text, fontSize, textWidth);
      const contentHeight = Math.max(symbolSize, lines.length * lineH)
        + Math.max(2, Math.round(fontSize * 0.22));
      const startsSection = Boolean(row.section && row.section !== previousSection);
      const headingLines = startsSection && row.section
        ? wrapSectionHeading(row.section, sectionFs, columnWidth)
        : [];
      // One-line headings keep the previous 1.7× block exactly; wrapped headings add one normal
      // heading line at a time and are remeasured by the same column-fit pass as factual rows.
      const headingHeight = startsSection
        ? sectionLineH * headingLines.length + Math.round(sectionFs * 0.55)
        : 0;
      previousSection = row.section;
      return {
        row,
        lines,
        contentHeight,
        headingHeight,
        headingLines,
        sectionLineH,
        height: contentHeight + headingHeight,
      };
    });
  };

  type LegendColumnPlan = {
    x: number;
    fontSize: number;
    symbolSize: number;
    textX: number;
    columnWidth: number;
    rowLayout: ReturnType<typeof layoutRows>;
    columnLayout: ReturnType<typeof layoutLegendColumn>;
  };
  const planColumns = (columnCount: number, fontSize: number): LegendColumnPlan[] => {
    const columnWidth = (contentW - columnGap * (columnCount - 1)) / columnCount;
    const rowTextGap = columnCount === 1 ? singleColumnTextGap : compactColumnTextGap;
    const symbolSize = symbolSizeFor(fontSize, columnWidth, columnCount);
    const provisionalRows = layoutRows(rows, fontSize, columnWidth, symbolSize, rowTextGap);
    const measuredSlices = new Map<string, ReturnType<typeof layoutRows>>();
    const measuredSlice = (start: number, end: number) => {
      const key = `${start}:${end}`;
      const cached = measuredSlices.get(key);
      if (cached) return cached;
      const measured = layoutRows(
        rows.slice(start, end),
        fontSize,
        columnWidth,
        symbolSize,
        rowTextGap,
      );
      measuredSlices.set(key, measured);
      return measured;
    };
    const ranges = balancedLegendColumnRanges(
      provisionalRows.map((row) => row.height),
      columnCount,
      (start, end) => measuredSlice(start, end).reduce((sum, row) => sum + row.height, 0),
    );
    const lineH = Math.max(11, Math.round(fontSize * 1.22));
    return ranges.map((range, columnIndex) => {
      const rowLayout = measuredSlice(range.start, range.end);
      return {
        x: lx + columnIndex * (columnWidth + columnGap),
        fontSize,
        symbolSize,
        textX: symbolSize + rowTextGap,
        columnWidth,
        rowLayout,
        columnLayout: layoutLegendColumn(
          availableRowsH,
          rowLayout.map((row) => ({ height: row.height })),
          lineH,
        ),
      };
    });
  };

  // wrapLegendText/wrapSectionHeading only break BETWEEN words — a single word or short heading
  // that alone is wider than the column cannot be shrunk by wrapping. A sparse legend (as little
  // as one row) was reaching this search with an enormous height-derived ceiling (availableRowsH
  // divided by a tiny row count), and because "WATER EARTHWORKS" / "Swale / cut-and-fill
  // earthworks x1" never wrap into enough EXTRA lines to blow the height budget, the height-only
  // fit accepted a font size whose individual words ran off the edge of the panel (Rory: "font
  // size now in the legend is over sized"). Reject any candidate where a rendered line's actual
  // width overflows its column, not just its total height.
  const columnPlanOverflowsWidth = (plan: LegendColumnPlan): boolean => {
    const bodyTextWidth = Math.max(1, plan.columnWidth - plan.textX);
    const sectionFs = Math.max(12, Math.round(plan.fontSize * 0.88));
    for (const measured of plan.rowLayout) {
      ctx.font = `600 ${plan.fontSize}px ${SHEET_BODY_FONT}`;
      for (const line of measured.lines) {
        if (ctx.measureText(line).width > bodyTextWidth) return true;
      }
      if (measured.headingLines.length) {
        ctx.font = `800 ${sectionFs}px ${REFERENCE_LABEL_FONT}`;
        for (const line of measured.headingLines) {
          if (ctx.measureText(line).width > plan.columnWidth) return true;
        }
      }
    }
    return false;
  };

  // The old pass started at a width-derived size and only counted DOWN. That made the panel's
  // height irrelevant for a sparse Water legend: its rows occupied a small block, then the
  // renderer justified the unused space into giant gaps. Measure the finished row blocks at each
  // candidate size instead. Sparse legends stay in one column, so their extra height becomes type
  // and icon size; a dense Planting inventory keeps the existing column search and its step-down.
  // THE CEILING MUST OBEY THE SAME SPARSE/DENSE POLICY THE REST OF THE PANEL DOES.
  //
  // It was availableRowsH / rows.length outright: on the Site sheet — three rows in a tall panel —
  // that is a ceiling near 300px, and the search happily returned type that dwarfed the sheet's own
  // title (Rory: "look at the text size for this legend", "the font ... is over sized"). Capping
  // the search by measured WIDTH stopped the words running off the edge but did nothing about the
  // scale, because three enormous words still fit a wide panel.
  //
  // lib/sheet-legend-layout.ts already owns this decision for gaps: a legend of three rows or fewer
  // is A LIST and must stay compact; six or more is an inventory that may span the reserved height;
  // four and five interpolate. legendHeightFillRatio IS that curve. Type now rides the same curve,
  // so a sparse legend cannot grow past its width-derived size, and a dense one keeps the
  // fill-the-panel behaviour that fixed the Water sheet.
  //
  // AND THE CURVE ALONE WAS STILL NOT ENOUGH, because it is entirely height-derived. On sheet 01
  // and sheet 03 — four rows in a tall boundary-framed panel — the interpolated ceiling still
  // landed near 120px, so "House / building" and "Zone 0 — Home & hub" set larger than the sheet
  // title and wrapped over three lines each. legendMaxFontSize is the missing absolute bound: it
  // comes from panel WIDTH, the thing that actually decides how many characters fit on a line.
  //
  // The row-count gate below went with it. Capping the fitting search at 8 rows is what left the
  // Sector sheet's nine-row legend stuck at the bare floor ("the text and icons in the legend are
  // too small") — a dense legend was denied the search entirely rather than being allowed to grow
  // and then step back down. The step-down loop underneath already guarantees it fits.
  //
  // FINALLY: THE SEARCH MUST MEASURE THE LAYOUT IT WILL ACTUALLY USE. It only ever measured a
  // ONE-COLUMN plan. A 22-row Planting inventory does not fit one column at any readable size, so
  // the search bottomed out at the 9px floor, and the step-down loop below then started from 9 and
  // "succeeded" immediately in two columns — 9px type with the leftover height justified into
  // enormous gaps between rows. Rory, on exactly that sheet: "look at the legend, big spaces
  // between items, icons way way too small and text way too small."
  //
  // Searching per column count fixes both symptoms at once, and they were always one bug: the
  // space that became gaps is the space the type should have grown into. Fewest columns wins on a
  // tie, so a sparse legend still stays a single readable list.
  const growthCeiling = legendMaxFontSize(legendW);
  const fitForColumns = (columnCount: number): number => fitLegendFontSize(
    (fontSize) => {
      const candidate = planColumns(columnCount, fontSize);
      if (!candidate.length || candidate.some(columnPlanOverflowsWidth)) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.max(...candidate.map((column) => column.columnLayout.contentBottom));
    },
    availableRowsH,
    Math.max(normalFs, growthCeiling),
    9,
  );
  let desiredFs = normalFs;
  let desiredColumns = 1;
  if (rows.length) {
    desiredFs = 0;
    for (let columnCount = 1; columnCount <= Math.min(3, rows.length); columnCount += 1) {
      const fitted = fitForColumns(columnCount);
      if (fitted > desiredFs) {
        desiredFs = fitted;
        desiredColumns = columnCount;
      }
    }
    if (desiredFs <= 0) desiredFs = normalFs;
  }

  let columnPlans: LegendColumnPlan[] = [];
  if (rows.length) {
    // Preserve legibility before compactness: a two-column 16px inventory is preferable to a
    // one-column 9px inventory. At a shared font size, the fewest columns still wins — except the
    // count the search above actually sized for, which is tried first so its answer is not
    // silently discarded in favour of a one-column plan that only "fits" by being smaller.
    // THE FALLBACK MUST NOT ACCEPT WHAT THE SEARCH REFUSED. The fitting search above rejects any
    // candidate whose text overruns its column (columnPlanOverflowsWidth) AND targets the panel
    // height; this loop only ever checked `columnLayout.overflow`, which is height alone. So a plan
    // the search had already ruled out on WIDTH could be selected here — and nothing downstream
    // reports it, because the clip rect below quietly cuts whatever crosses the panel edge. A
    // silent crop is the worst available outcome: the sheet still looks finished, and the farmer
    // just gets a legend row with its end sliced off.
    //
    // Width-clean plans are therefore tried first, at every size, before any height-only plan is
    // considered. The second pass is kept deliberately: without it a legend with one unbreakably
    // long word would fit nothing and hit the throw below, turning a cosmetic crop into a sheet
    // that will not render at all. Degrade to the old behaviour, never to nothing.
    const findPlan = (requireWidthFit: boolean): LegendColumnPlan[] => {
      for (let fontSize = desiredFs; fontSize >= 9; fontSize -= 1) {
        for (const columnCount of [
          desiredColumns,
          ...Array.from({ length: Math.min(3, rows.length) }, (_, i) => i + 1),
        ]) {
          const candidate = planColumns(columnCount, fontSize);
          if (!candidate.length) continue;
          if (candidate.some((column) => column.columnLayout.overflow)) continue;
          if (requireWidthFit && candidate.some(columnPlanOverflowsWidth)) continue;
          return candidate;
        }
      }
      return [];
    };
    columnPlans = findPlan(true);
    if (!columnPlans.length) columnPlans = findPlan(false);
    if (!columnPlans.length) {
      throw new Error('Legend facts cannot fit the finished sheet at the 9px readability floor.');
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(lx, legendTop, maxX - lx, availableRowsH);
  ctx.clip();
  for (const column of columnPlans) {
    const lineH = Math.max(11, Math.round(column.fontSize * 1.22));
    const sectionFs = Math.max(12, Math.round(column.fontSize * 0.88));
    ctx.save();
    ctx.translate(column.x, legendTop);
    for (const [
      index,
      { row, lines, contentHeight, headingHeight, headingLines, sectionLineH },
    ] of column.rowLayout.entries()) {
      y = column.columnLayout.offsets[index] ?? 0;
      if (headingHeight && row.section) {
        ctx.textBaseline = 'alphabetic';
        // Near-black, not the brand green. A section heading is structure, not an accent: in green
        // it competed with the coloured swatches beside it and read as one more piece of colour to
        // decode. Ink says "this is a heading" and lets the swatches be the only colour that means
        // something.
        ctx.fillStyle = '#20190F';
        ctx.font = `800 ${sectionFs}px ${REFERENCE_LABEL_FONT}`;
        headingLines.forEach((line, headingIndex) => {
          ctx.fillText(line, 0, y + sectionFs + headingIndex * sectionLineH);
        });
        y += headingHeight;
      }
      const symbolY = y + contentHeight / 2;
      drawStyleLegendSymbol(
        ctx,
        row,
        0,
        symbolY,
        column.symbolSize,
        Math.min(column.symbolSize, contentHeight * 0.82),
      );
      ctx.fillStyle = '#241E12';
      ctx.font = `600 ${column.fontSize}px ${SHEET_BODY_FONT}`;
      ctx.textBaseline = 'middle';
      const textTop = symbolY - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, lineIndex) => {
        ctx.fillText(line, column.textX, textTop + lineIndex * lineH);
      });
    }
    ctx.restore();
  }
  ctx.restore();
  y = legendTop + Math.max(0, ...columnPlans.map((column) => column.columnLayout.contentBottom));
  if (!rows.length) {
    ctx.fillStyle = '#6B6355';
    ctx.font = `italic 500 ${desiredFs}px ${SHEET_BODY_FONT}`;
    ctx.fillText('Nothing placed on this layer.', lx, y);
  }
  // Footer contract. Exact sheets state their provenance plainly; AI texture sheets retain the
  // illustrative caveat while confirming that geometry and placed elements are deterministic.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#8A8172';
  if (customFooterLines.length) {
    if (options.footerBox) {
      ctx.strokeStyle = 'rgba(31,77,43,0.46)';
      ctx.lineWidth = 1;
      roundRectPath(
        ctx,
        lx,
        footerTop,
        maxX - lx,
        footerBlockH,
        Math.max(3, Math.round(legendW * 0.012)),
      );
      ctx.stroke();
    }
    let footerY = footerTop + footerBoxPad + Math.round(legendW * 0.035);
    if (options.footerHeading) {
      if (!options.footerBox) {
        ctx.strokeStyle = 'rgba(11,18,11,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, footerTop);
        ctx.lineTo(maxX, footerTop);
        ctx.stroke();
      }
      ctx.fillStyle = '#20190F';
      ctx.font = `800 ${Math.round(legendW * 0.04)}px ${REFERENCE_LABEL_FONT}`;
      ctx.fillText(options.footerHeading, footerTextX, footerY);
      footerY += footerHeadingH;
      ctx.fillStyle = '#6C6457';
      ctx.font = `600 ${footerFs}px ${SHEET_BODY_FONT}`;
    } else {
      ctx.font = `italic 500 ${footerFs}px ${SHEET_BODY_FONT}`;
    }
    for (const line of customFooterLines) {
      ctx.fillText(line, footerTextX, footerY);
      footerY += footerLineH;
    }
  } else if (exactGeometry) {
    ctx.font = `italic 600 ${Math.round(legendW * 0.036)}px ${SHEET_BODY_FONT}`;
    // A fourth line does not fit BELOW the third — appending one put the Esri credit through the
    // bottom of the panel, half-clipped, on the first render that used it. The block is LIFTED
    // instead, so whatever its line count, it still ends on the baseline the three-line version
    // ended on. footerBlockH already reserved the extra height above (0.16 -> 0.2 of legendW), so
    // the legend rows above have the clearance for it.
    const lift = attributionLine ? Math.round(legendW * 0.045) : 0;
    ctx.fillText('Exact plan — geometry and counts', lx, H - pad - Math.round(legendW * 0.05) - lift);
    ctx.fillText('come from your saved design.', lx, H - pad - Math.round(legendW * 0.005) - lift);
    ctx.fillText('No unsaved features added.', lx, H - pad + Math.round(legendW * 0.04) - lift);
    // Esri's imagery must be credited wherever it is shown — a licence term, not a courtesy. Only
    // drawn when the live provider is actually Esri; on Mapbox attributionLine is '' and lift is 0,
    // so nothing on the sheet moves at all.
    if (attributionLine) {
      ctx.fillText(attributionLine, lx, H - pad + Math.round(legendW * 0.04));
    }
  } else {
    ctx.font = `italic 600 ${Math.round(legendW * 0.036)}px ${SHEET_BODY_FONT}`;
    ctx.fillText('Illustrated render — boundary, labels', lx, H - pad - Math.round(legendW * 0.05));
    ctx.fillText('and elements are exact; artwork is', lx, H - pad - Math.round(legendW * 0.005));
    ctx.fillText('indicative. Confirm on site.', lx, H - pad + Math.round(legendW * 0.04));
    // AN ILLUSTRATED SHEET IS BUILT ON THE SAME PHOTOGRAPH. The credit was first added only to the
    // exact branch, which reads as reasonable until you follow where the imagery goes: satDataUrl
    // is the underlay handed to the AI hybrid and full-treatment passes, so the illustrated sheets
    // are DERIVED from Esri's imagery too — and those are the ones a farmer pays for. Crediting the
    // free sheet and not the paid one would leave the obligation unmet exactly where it matters.
    if (attributionLine) {
      ctx.fillText(attributionLine, lx, H - pad + Math.round(legendW * 0.085));
    }
  }

  // ── Scale bar (over the map, bottom-left) ──
  //
  // MEASURED AGAINST THE MAP, NOT THE SHEET. `W` is everything left of the legend panel, which now
  // includes a label gutter on each side; deriving pxPerM from it would draw a bar 26% longer than
  // the distance it claims. A scale bar is the one mark on a plan a farmer is entitled to hold a
  // ruler against, so this must key off the map's own width and sit inside the map's own column.
  const pxPerM = mapW / (frame.imgW * frame.mPerPx);
  const niceM = [5, 10, 20, 25, 50, 100, 200];
  let m = niceM[0];
  for (const nm of niceM) if (nm * pxPerM <= mapW * 0.18) m = nm;
  const barW = m * pxPerM;
  const bx = gutter + Math.round(mapW * 0.03);
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
  ctx.font = `700 ${Math.round(mapW * 0.016)}px ${REFERENCE_LABEL_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(11,14,10,0.6)';
  ctx.strokeText(`${m} m`, bx, by - 14);
  ctx.fillStyle = '#FBF6EC';
  ctx.fillText(`${m} m`, bx, by - 14);

  // ── North arrow (over the map, top-right) ──
  const nx = gutter + mapW - Math.round(mapW * 0.04);
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
  ctx.font = `700 ${Math.round(mapW * 0.017)}px ${REFERENCE_LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(11,14,10,0.65)';
  ctx.strokeText('N', nx, ny - 34);
  ctx.fillStyle = '#FBF6EC';
  ctx.fillText('N', nx, ny - 34);

  // A2 LANDSCAPE, added as PAPER rather than taken out of the map. See PAPER_SHEET_RATIO.
  return padToPaperSheet(canvas);
}

// extendProtectMaskToStyleSheet lived here. It widened a map-space protect mask onto a composed
// page, for the days when Full Treatment was handed a composed page to improve. No paid pass is
// handed a page any more — every one of them receives map-area artwork and gets its chrome drawn
// back afterwards — so there is no page-shaped mask left to build. Its geometry was wrong for the
// real sheet in any case: it placed the map at x=0 with no gutters, a layout composeStyleSheet has
// never produced, so every restore it guided landed displaced by one gutter width.

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

/** Copy one rectangle out of an already-composed sheet, in the sheet's own coordinates.
 *  Used to take the MAP COLUMN off a finished page before that page's next paid pass, so the
 *  model is handed artwork instead of a page full of type it cannot reproduce. The incoming image
 *  is normalised to (sheetW x sheetH) first, so a cached or re-encoded sheet at a different pixel
 *  size still yields the same region. */
async function cropSheetRegion(
  sheetDataUrl: string,
  sheetW: number,
  sheetH: number,
  region: { x: number; y: number; w: number; h: number },
): Promise<string> {
  const sheet = await loadImage(sheetDataUrl);
  const scaleX = sheet.width / sheetW;
  const scaleY = sheet.height / sheetH;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.w));
  canvas.height = Math.max(1, Math.round(region.h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return sheetDataUrl;
  useHighQualityScaling(ctx);
  ctx.drawImage(
    sheet,
    region.x * scaleX,
    region.y * scaleY,
    region.w * scaleX,
    region.h * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL('image/png');
}

/**
 * THE CHROME PASS. Every mark the app owns on a design-layer sheet, drawn AFTER the paid model
 * pass, from the saved design, over whatever the model returned:
 *
 *   boundary stroke · plant labels + leaders · label gutters · legend panel · title block ·
 *   north arrow · scale bar
 *
 * NONE of it is ever sent to the model, and NONE of it is conditional. That combination is the
 * whole fix (see lib/sheet-chrome-pass.ts for the sheet that made it necessary): handed a composed
 * page, an image model erases every label and repaints the legend, because it cannot draw 9px
 * type; and when the app's re-draw is guarded by anything the model or the upload pipeline can
 * change, the guard eventually fires and the farmer pays for a page with no labels on it at all.
 *
 * The boundary belongs HERE rather than in a byte-restore for the same reason. Restoring the
 * boundary corridor from the source was the one and only element put back on repainted ground, so
 * it read as a hard vector line stamped over the artwork instead of a fence sitting on the land.
 * Drawn in the same pass as the legend and the labels, it is simply another app-drawn mark.
 *
 * Returns the composed sheet AND the map artwork it was built from. The paid-difference gate must
 * score map against map: comparing the composed PAGE with the map the model was given would count
 * this function's own gutters, legend and title as the model's work.
 */
async function composeSheetChromeOverMapArt(opts: {
  /** What the model returned. Map-area artwork under the current contract. */
  modelArt: string;
  /** Pixel size of the image the job actually uploaded, when it is known — used ONLY to recognise
   *  a legacy in-flight job whose input was a composed page, never to decide whether to run. */
  modelInputSize?: { width: number; height: number };
  state: DesignCanvasState;
  frame: CanvasFrame;
  refLayers: DesignGlossyProps['refLayers'];
  filter: GlossyLayerFilter;
  W: number;
  H: number;
  placeName: string | undefined;
  styleLabel: string;
  labelMode: SheetLabelMode;
  site: SectorSite | null;
}): Promise<{ sheet: string; mapArt: string }> {
  const { state, frame, refLayers, filter, W, H, labelMode } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('chrome pass: 2D context unavailable');
  useHighQualityScaling(ctx);
  const art = await loadImage(opts.modelArt);
  // A job enqueued before the map-only contract carries a composed PAGE as its input, so its
  // output is a page too and its map panel is the left-hand column. Decided from the INPUT's
  // aspect ratio — the upload is uniformly downscaled to AI_INPUT_WIDTH, so its pixel size says
  // nothing while its ratio is exact. (Comparing sizes here is the bug this rewrite removes.)
  const legacyPageInput = opts.modelInputSize
    ? modelInputCarriesChrome(opts.modelInputSize.width, opts.modelInputSize.height, W, H)
    : false;
  const srcW = legacyPageInput ? Math.min(art.width, art.height * (W / H)) : art.width;
  ctx.drawImage(art, 0, 0, srcW, art.height, 0, 0, W, H);
  drawBlueprintBoundary(ctx, refLayers.boundary, (n) => n * W, (n) => n * H, W, state, frame);
  const mapArt = canvas.toDataURL('image/png');
  const labelled = await burnExactLabelLayer(mapArt, state, frame, refLayers, filter, W, H, labelMode);
  const sheet = await composeStyleSheet(
    labelled.map,
    state,
    frame,
    refLayers,
    filter,
    opts.placeName,
    opts.styleLabel,
    REFERENCE_SHEET_LABEL[filter],
    false,
    true,
    {
      labelMode,
      gutterLayout: labelled.gutterLayout,
      ...(filter === 'water'
        ? {
            footerHeading: 'NOTES',
            footerText: waterReferenceFooterText(state, frame, refLayers, opts.site),
          }
        : {}),
    },
  );
  return { sheet, mapArt };
}

// ── Persistence — cache the last render per site so a page refresh doesn't lose it.
// dataURLs can be large; localStorage has a quota, so writes are best-effort.
interface SavedGlossy {
  image: string;
  provider: 'gemini' | 'falgpt' | 'exact';
  at: string;
  /**
   * Which treatment produced this picture — 'exact', 'hybrid' or 'full'.
   *
   * It recorded the provider and the timestamp but never this, so a cached Hybrid and a cached
   * Full Treatment were indistinguishable and nothing downstream could tell they had been swapped.
   * The cache key carries the mode now (see requestedMode), which is what actually prevents the
   * collision; this is the belt to that pair of braces, and it makes an old record — written
   * before the key scheme changed — identifiable rather than anonymous.
   */
  mode?: SheetOutputMode;
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
//   v67 — 2026-07-29: a callout can no longer shrink to a quarter of its neighbours. Rendered
//        water sheet 04 had SWALE full size, GREYWATER LINE middling and JOJO TANK 2500L a
//        scratch — the margins went narrow when sheets started following the boundary (v57), and
//        shrink-to-fit turned that into three type sizes on one page. It now stops at 72% of the
//        sheet's size and overruns onto the map, where the existing halo keeps it readable.
//   v68 — 2026-07-29: sheet 08's header joins the rest of the plan set. It was set in Georgia
//        while 01-07 use the condensed face, so one sheet of a printed set arrived in a different
//        typeface — and Georgia's oldstyle figures made the number read as "o8".
//
// NOT bumped for codex/legend-map-agreement: that branch moved the context alphas and the legend
// families into lib/glossy-filters.ts with identical values, so no pixel changes. A bump is not
// free — it re-keys the gallery, and an AI sheet a farmer already PAID for stops being found.
// Bump when the picture changes; do not bump for a refactor.
//   v69 — 2026-07-29: exact legend rows spread down the whole cream column instead of keeping a
//        rhythm sized for the old short 3:2 sheet, which left two thirds of a boundary-framed
//        panel empty; and every countable row now states its count, so a missing number can no
//        longer mean either "one" or "not counted". (codex/legend-panel-fill arrived reusing v68,
//        which the typeface fix above already owns — reusing a number means the second change
//        inherits the first's cache entries and is invisible to anyone who rendered in between.)
//   v70 - 2026-07-29: that legend distribution is capped. Sharing ALL the slack justified a
//        three-row legend down a full-height panel with a hole between every row - it read as
//        broken rather than full, and was still empty at the bottom. A legend is a list, not a
//        justified column.
//   v71 — 2026-07-29: the Water sheet footer reads the same twelve-month dry-season balance as the
//        Tank Calculator. Daily use is saved only when the farmer enters it; without that input the
//        sheet says what is missing instead of inventing household demand.
//        (Arrived as v69, which the legend-count change already owned — renumbered on merge.)
//   v72 — 2026-07-29: invalid facilitator roof/location inputs no longer fabricate a Durban
//        harvest card or print NaN/Infinity; valid harvest figures are unchanged.
//        (Arrived as v70 — the fourth version collision of this run. See AGENTS.md: read
//        PLAN_VERSION from origin/main at the START of each item, not from the queue text.)
//   v73 — 2026-07-29: the national border is the real Natural Earth outline instead of a
//        lat/lon rectangle, so site context can change on a sheet. The rectangle called Lesotho
//        and Eswatini South African; the polygon carries the Lesotho enclave as a hole.
//        (Arrived as v71 — fifth collision.)
//   v74 — 2026-07-29: climate rainfall now rejects an incomplete series instead of reading a
//        missing day as zero rain, so a site's monthly normals can change on a sheet.
//        (Arrived reusing a taken number — sixth collision.)
//   v75 — 2026-07-29: water routes never cross the house and an overflow sink is never placed
//        outside the boundary. A route may now take TWO elbows to get around a structure rather
//        than falling back to a straight line through it. These are DERIVED routes — no saved
//        item, line or ring is touched, which is the guardrail that matters here.
//   v76 — 2026-07-29: the phasing schedule names only work that is actually planned. A design
//        with no pipes was still told to pressure-test the main line before backfilling, and
//        one with no drip to check every emitter — hold points for work that does not exist.
//   v77 — 2026-07-29: water symbols reject invalid geometry instead of drawing from it, and
//        persisted symbol ids normalise whitespace/underscores/hyphens to one key — the same
//        legacy-id class as the string zone numbers that once read 0 of 4 zones.
//   v78 — 2026-07-29: structure symbols get the same treatment as v77's water symbols —
//        invalid geometry rejected, persisted ids normalised to one key.
//   v79 — 2026-07-29: the paid render queue validates its untrusted boundary — job and sheet
//        statuses are closed sets, sheet keys are checked against the canonical list, and a
//        base64 payload must be well-formed. A malformed job could previously reach the
//        completion handler and be presented as a result.
//   v80 — 2026-07-29: the property boundary is a POST-AND-WIRE fence, not a ticked line. The exact
//        renderer stroked a perpendicular crossbar at each interval while the AI prompt has long
//        required "posts are circles, never ticks" — so the deterministic sheets contradicted the
//        app's own rule. Posts are now round, drawn over the wire. (Rory, twice: "it must be wire
//        and post, not these lines".)
//   v81 — 2026-07-29: the DRIVEWAY callout is gone from the layer sheets. Sheets 05 and 06 of the
//        Ubhejane render each carried a leadered DRIVEWAY pill while neither legend held a driveway
//        row — correctly, since on a layer sheet the driveway is CONTEXT and context is "never
//        captioned, never legended" (groundRegister). So the single label on the sheet that was not
//        part of the plan was the single label the legend could not decode. DesignGlossy had
//        already written the rule down where it names a sheet's parts; producerLabels just never
//        applied it, and only the masterplan's curated callout layer filtered the pill back out.
//   v82 — 2026-07-29: a 25-commit hardening pass across the geometry modules — elevation, sector,
//        solar, contours, base layers, overlays, planting/structures presentation sizes, legend
//        layout, label geometry, phasing inventory, render metadata and the paid-render gate. Each
//        rejects malformed or non-finite input instead of drawing from it, which is this codebase's
//        recurring defect: bad saved data rendering a believable wrong picture rather than an error.
//
//        ARRIVED AS v97. That branch was cut at v79 and bumped the version on every one of its
//        commits — eighteen times, for work that is almost entirely defensive. A bump is not free:
//        it re-keys the sheet gallery, so an AI sheet a farmer has already PAID for stops being
//        found. None of v82–v97 ever shipped, so no farmer's cache is owed them, and they collapse
//        to this single bump. The protocol changed with this merge — PLAN_VERSION is now assigned
//        once, at merge, and never by a working branch. Eight collisions was enough.
//   v83 — 2026-07-29: a callout on a layer sheet names the same thing its legend row does. Sheet 05
//        labelled two trees `SOUTHERN TREES` while the legend listed `Avocado Tree ×1` and
//        `Mango Tree ×1` — nothing in the legend decoded that label, the same disagreement as v81's
//        DRIVEWAY pill reached by a different route. `sheetElementNaming()` is now the single
//        authority both the label path and the legend path read: layer sheets name individually,
//        only the integrated masterplan groups, and its legend groups by the same families.
//   v84 — 2026-07-29: traced ground is only NAMED on the sheets it is content for.
//        groundLabelsForSheet took no `filter` at all, so a farmer's traced lawn or orchard was
//        labelled identically on every sheet — including Water and Zones, where groundRegister
//        calls it context and context is "never captioned, never legended". The demo farm traces no
//        ground rings, which is the only reason this was invisible on a rendered sheet rather than
//        obvious. groundContentRingsForSheet() is now the shared selector, and it also drops a
//        Studio ring whose feature the main map already draws, so nothing is named twice.
//   v85 — 2026-07-29: two labels whose targets share a y no longer cross their leaders, and a
//        species label no longer points at empty ground between distant specimens. Every row sort
//        ordered by `cy` alone, so a tie fell back to catalogue order — and the demo farm plants
//        mango and avocado at exactly y=0.650491, because that is what a ROW of trees is. On sheet
//        05 the upper pill took the further tree and the lower one the nearer, so the leaders
//        crossed. `compareLabelRows()` is now the one total ordering (cy, then cx, then id).
//        The second half was subtler: a family cluster is SINGLE-LINK, so an avocado could
//        transitively join a mango to two moringas far from each other, and the merged "×2" leader
//        landed at the empty centroid between them. Species labels now re-cluster their own
//        specimens — which is what producer-labels.ts's own comment said clustering was for.
//   v86 — 2026-07-29: the fire sector is finally NAMED on the map. Sheet 02 labelled every energy
//        on it except fire — the one with a safety consequence — which had a legend row and nothing
//        readable on the plan. The label was never missing from the code; it was drawn and then
//        painted over by the berg-wind arrow, because fire shares the berg bearing by construction
//        and an earlier fix had moved the label INSIDE the wedge to dodge the berg LABEL, landing it
//        under the berg ARROW instead. Now offset perpendicular to the shared ray. Measured, not
//        eyeballed: the label colour went from 20 px to 1 743 px in the rendered sheet.
//   v87 — 2026-07-29: the plan sheets draw REAL contours. They had been drawing straight parallel
//        lines: lib/elevation.ts sampled FIVE points (centre, N, S, E, W) from SRTM 30 m, derived
//        ONE slope and ONE aspect for the whole farm, and ruled lines at that angle — lib/contours.ts
//        said so in its own header. A farmer siting a swale on contour was given a line that could
//        not bend, because there was one number behind it. The real tracer already existed at
//        app/api/contours/route.ts (Mapbox terrain-RGB stitched to a grid, marchingsquares
//        isoLines) and only the interactive map used it. Now lib/sheet-contours.ts feeds the sheets
//        from the same source, clipped to the plot, and keeps the too-flat / unavailable honesty:
//        land the data cannot resolve still SAYS so rather than drawing confident wrong lines.
//   v88 — 2026-07-29: the sector energies stop AT the boundary instead of driving across the farm.
//        Rory, comparing sheet 02 with reference sheets he rates: "I don't like the look of the
//        sector map." The cause was geometric. Both energy renderers put their tip at ~0.45 R —
//        about halfway from the plot centre to its edge — so every wind, the fire approach and the
//        access arrow were painted straight over the house, the beds and the new contours. Five
//        translucent wedges layered on top of the one thing the sheet exists to show. On the
//        reference sheets each energy enters from outside and stops at the boundary, which is why
//        they breathe and ours did not. SECTOR_ENERGY_TIP is the one rule both renderers now read.
//        Bearings, half-widths and the sourced regional record are untouched — only where the
//        shape ends.
//   v93 — 2026-07-30: Full Treatment stops copying the Hybrid's house, driveway and exterior
//        pixels back over the paid second pass (that restoration was the ghost-roof and blurred
//        satellite-keyhole source; only the boundary ring stays byte-locked, saved Hybrid remains
//        the rollback), and the polish prompt gains the SOURCE INVENTORY rule: never reinterpret
//        roof/driveway/paving pixels as tanks or new structures. Measured before merge: the two
//        invented tanks disappear, 90.8% of real edges kept.
const PLAN_VERSION = 'v93';
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
  /** ABSENT ON RESTORED ITEMS, BY DESIGN — the other half of the crash fix #84 started. The
   *  gallery used to hold every saved sheet's full 1-3 MB data URL in React state from the
   *  moment this section mounted; 30 sheets is 60-90 MB of strings before a pixel draws, which
   *  is most of an in-app iOS webview's budget, and expanding one sheet then tipped it over
   *  ("still crashes", with #84 live). Restored items carry metadata + thumb only; the full
   *  image is fetched for ONE sheet at a time when the farmer opens it (loadSheetImage) and
   *  released when they close it. Present only on items rendered THIS session, whose data URL
   *  already exists in memory anyway. */
  image?: string;
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
  frame: frameProp,
  refLayers,
  site,
  placeName,
  geometryLock: geometryLockProp,
  onGeometryLockChange,
  initialFilter,
  onImportPhoto,
}: DesignGlossyProps) {
  const { t } = useLanguage();
  /**
   * WHICH PICTURE THE SHEETS ARE DRAWN ON. Rory: "I want the option when rendering the map to have
   * the drone image as underlay or satellite."
   *
   * Both already exist and are already aligned. When a farmer brings their own aerial, the Studio
   * swaps it INTO frame.satDataUrl — the single field every sheet, composite and export reads — and
   * keeps the true satellite tile beside it in `underlayDataUrl` so the two can be lined up. So the
   * choice is not a new pipeline; it is which of two images that one field carries.
   *
   * Deliberately implemented by SHADOWING the `frame` prop rather than threading a flag through the
   * thirty-odd render call sites below. Every one of them reads `frame`, so one decision here
   * reaches all of them and there is no call site that can be forgotten and quietly keep rendering
   * the other picture — which is this codebase's most-repeated bug (two systems answering one
   * question, then drifting).
   *
   * A drone photo is sharper and current; the satellite is what the neighbours, the roads and the
   * surrounding land are on, and it is what a reader outside the farm recognises; plain paper is
   * the drawing on its own, at full sheet resolution with nothing soft behind it. None is correct
   * in general, which is why it is a control and not a constant.
   */
  // Defaults to whichever picture the frame actually carries: the farmer's aerial when one has
  // been imported, otherwise the satellite. 'photo' must never be the selection on a site with no
  // photo — the sheet would render the satellite under a pill claiming otherwise.
  const [underlay, setUnderlay] = useState<SheetUnderlay>(() => (hasFarmerPhoto(frameProp) ? 'photo' : 'satellite'));
  useEffect(() => {
    if (underlay === 'photo' && !hasFarmerPhoto(frameProp)) setUnderlay('satellite');
  }, [underlay, frameProp]);
  const underlayOptions = useMemo(() => sheetUnderlayOptions(frameProp), [frameProp]);
  // Escape hatch so the shelved finishes can be looked at again without a redeploy — the whole
  // pipeline is still here, it is only unadvertised. See AI_FINISHES_SHELVED.
  const aiFinishesVisible = useMemo(() => {
    if (!AI_FINISHES_SHELVED) return true;
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('aifinish') === '1';
  }, []);
  const frame = useMemo(() => frameForUnderlay(frameProp, underlay), [frameProp, underlay]);
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
  /** WHAT THE FARMER ASKED FOR — the stable authority for both the guided flow and audit trail.
   *  Pending refs say which transition has not yet been consumed; they cannot also encode intent,
   *  because switch-to-polish consumes its pending bit before render-polish runs. Without this
   *  separate value Full was downgraded to Hybrid between those two effects, so enqueue 2 could
   *  never happen. The audit uses the same stable intent. See lib/render-audit.ts. */
  const requestedModeRef = useRef<SheetOutputMode>('exact');
  /**
   * THE SAME VALUE AS THE REF, AS STATE, BECAUSE THE CACHE KEY HAS TO SEE IT.
   *
   * Rory, repeatedly and finally: "this looks definitely like the hybrid even tho i selected the
   * full treatment — i can't keep correcting these things." He is right that it keeps coming back,
   * and this is why: the render pipeline was fixed more than once, and the CACHE was never part of
   * the fix. mapKey was `producer:<style>:<filter>` with no output mode in it, so Exact, Hybrid and
   * Full Treatment all read from and wrote to ONE localStorage slot. Render a Hybrid, then ask for
   * Full Treatment, and the cache hands back the Hybrid — with no way for anything downstream to
   * notice, because SavedGlossy recorded the provider and the timestamp but never which of the
   * three treatments produced the picture.
   *
   * A ref cannot fix it: mapKey is computed during render and a ref change does not re-render, so
   * the key would keep lagging a frame behind the mode. Hence state, set beside every write to the
   * ref rather than replacing it — the ref is read inside callbacks and async continuations where
   * a stale closure would be worse than the bug it fixes.
   */
  const [requestedMode, setRequestedMode] = useState<SheetOutputMode>('exact');
  const polishStyleRef = useRef<StylePreset>(DEFAULT_PRODUCER_STYLE);
  // Full Treatment's polish stage feeds on the Hybrid stage's OWN finished sheet — not a rebuilt
  // exact sheet — so there is something actually painted for the model to polish. Set when the
  // Hybrid stage completes with polishAfterHybridRef pending; read by generateOneViaQueue's
  // 'polish' branch; cleared once consumed so a stale image can never leak into an unrelated run.
  const hybridResultRef = useRef<string | null>(null);
  // React signal paired with hybridResultRef. The finished Hybrid may be intentionally hidden from
  // the preview when the user changes maps, so resultImage is not proof that the handoff exists.
  // Unlike the ref, this state also guarantees the switch-to-polish effect runs after the async
  // completion handler has stashed the image.
  const [hybridHandoffReady, setHybridHandoffReady] = useState(false);
  // The Hybrid stage's OWN gallery entry id, kept past that job's subscription (which unmounts
  // when the polish stage enqueues its own separate job — see the queueJobId effect). Full
  // Treatment paid for a genuinely different Hybrid than a farmer already had, then the polish
  // pass came back too similar to keep — the app correctly reverted to protect against paying for
  // a copy, but said so only in a toast in the compose panel. Rory, looking at this exact saved
  // Hybrid sheet later in the gallery, with no idea why it wasn't Full Treatment: "I'm sure it's
  // just stuck on hybrid." It was never stuck — the outcome just never reached the one place he
  // actually went to check it. Set when the Hybrid stage's own entry is pushed; consumed (and
  // cleared) if the later polish pass is rejected, so the SAME saved sheet carries the explanation.
  const hybridGalleryIdRef = useRef<string | null>(null);
  /** The image the paid polish pass was handed, kept so its output can be scored against it. */
  const polishInputRef = useRef<string | null>(null);
  /** The Hybrid's finished MAP — exact content burned back, NO text — stashed by finishStyledSheet
   *  for the polish stage. This, not the composed page, is what Full Treatment sends to the model:
   *  a model shown no text can mangle no text. Keyed by filter so a stale map from another sheet
   *  can never be polished by mistake. */
  const hybridMapForPolishRef = useRef<{ key: GlossyLayerFilter; map: string } | null>(null);
  /** The polished MAP as returned (post-restore, pre-chrome), so the difference gate scores the
   *  model's actual work map-against-map rather than page-against-map. */
  const polishedMapRef = useRef<string | null>(null);
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
  /**
   * CODES OR NAMES — see SheetLabelMode. Offered only where this sheet actually has coded plants,
   * which is a question about THIS design on THIS sheet, not a fixed list of sheets: a farm with no
   * planting on the Water sheet must not be shown a control with nothing to control. Same call and
   * same input the renderer and the legend use, so the control cannot appear when the sheet would
   * draw no codes, or vanish when it would.
   */
  const [labelMode, setLabelMode] = useState<SheetLabelMode>(DEFAULT_SHEET_LABEL_MODE);
  const sheetHasPlantCodes = useMemo(
    () => plantCodesForSheet(exactSheetElementLegendGroups(state, filter).map((group) => group.defId)).size > 0,
    [state, filter],
  );
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
  // which of the 9 sheets is active so toggling mode re-maps the SAME sheet to the other generator.
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
  // Render engine. gpt-image-2 is the default; Gemini is selectable again (see ENGINES).
  const [engine, setEngine] = useState<'falgpt' | 'gemini'>('falgpt');
  // The picker's key is a UI label ('falgpt'); the job doc's is a VENDOR ('openai'). Every queue
  // enqueue below must use this rather than a literal — four of them hardcoded 'openai', which is
  // why picking Gemini and pressing Hybrid silently rendered on OpenAI instead of failing.
  const queueEngine: RenderEngine = engine === 'gemini' ? 'gemini' : 'openai';
  // Defaults to 'high' — what every paid render used before this dial existed, so nothing changes
  // for anyone who never opens More options.
  const [quality, setQuality] = useState<RenderQuality>('high');

  // Rendered in BOTH mounts. It lived inside More options, which is `!compact` — so the dial sat on
  // a different screen from the AI Hybrid / Full Treatment buttons that actually spend the money.
  // A money dial belongs beside the money buttons.
  // ENGINE — the OTHER money dial, and the one that decides WHICH ACCOUNT gets charged. It lived
  // only inside More options, on a different screen from the buttons that spend, for the same
  // reason the quality dial did; it now renders in both mounts alongside it. Hidden when there is
  // only one engine to choose, because a picker with one option is furniture, not a choice.
  const enginePicker = ENGINES.length > 1 ? (
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
  ) : null;

  // QUALITY — the other MONEY dial. Three options are shown rather than one
  // best guess because the right answer genuinely isn't known yet: the AI paints an underlayer, and
  // every piece of exact geometry, every label and the whole legend are composited back on top
  // afterwards — so much of what 'high' pays for is covered up before the farmer sees the sheet.
  // The point is to render the SAME sheet three ways and compare before committing to one.
  const qualityPicker = (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
                {t('designGlossyQuality')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RENDER_QUALITY_CHOICES.map((q) => {
                  const active = quality === q.key;
                  return (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => setQuality(q.key)}
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
                      <span style={{ fontWeight: 800, fontSize: 13 }}>{t(q.labelKey)}</span>
                      <span style={{ fontSize: 10.5, opacity: active ? 0.85 : 0.6 }}>{t(q.subKey)}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.6, marginTop: 6, lineHeight: 1.4 }}>
                {t('designGlossyQualityNote')}
              </div>
            </div>
  );
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
  /**
   * TAKING SEVERAL SHEETS OFF THE PHONE AT ONCE. Rory: "let's be able to select and download
   * multiple files at once with a quality selector and also perhaps just have a share option?
   * file options jpeg or pdf etc."
   *
   * Selection is a MODE rather than a permanent row of tick boxes, because the common action on
   * this grid is opening one sheet to look at it, and a grid that is always armed for selection
   * makes the common action the awkward one. Same shape as every phone photo gallery: tap opens,
   * "Select" arms, then tap picks.
   *
   * The decisions themselves — what a file is called, what a quality step costs, which formats can
   * carry a whole set — live in lib/sheet-export.ts, where they are testable without a canvas.
   */
  const [exportMode, setExportMode] = useState(false);
  const [exportSel, setExportSel] = useState<Set<string>>(() => new Set());
  const [exportFormat, setExportFormat] = useState<SheetExportFormat>('jpeg');
  const [exportQuality, setExportQuality] = useState<SheetExportQuality>('high');
  const [exportBusy, setExportBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // A stable cache key per chosen map (producer style OR design filter OR analysis style).
  // Each map+style combination caches its own render (e.g. producer:storybook:zones).
  // The chosen underlay is part of a sheet's identity: the same sheet on the drone photo and on the
  // satellite are two different pictures, and a cache that cannot tell them apart re-serves the one
  // you just switched away from. Suffixed rather than woven in, so every branch below inherits it
  // and no key can be left out. Absent entirely on the default, which keeps every sheet already in
  // a farmer's gallery addressable by the key it was stored under.
  // The same sheet in codes and in names is two different pictures, so the mode is part of a
  // sheet's identity for exactly the reason the underlay is — a cache that cannot tell them apart
  // re-serves the one you just switched away from. Empty unless the sheet HAS codes, so switching
  // the control on a sheet it does not affect cannot split that sheet's cache in two.
  // RECIPE TOKEN — the narrow alternative to a PLAN_VERSION bump. The last-render display effect
  // re-serves whatever localStorage holds for this key on mount, so after a renderer fix the
  // farmer (and Rory, checking the fix) sees the PRE-fix picture without rendering — the "code
  // change looks like it did nothing" trap. Bumping this token orphans only the last-render
  // display slots (a cache miss shows an empty slot; it never enqueues or re-charges anything, and
  // the gallery keeps every paid sheet addressable). PLAN_VERSION stays untouched — bumping THAT
  // re-keys the gallery and takes paid renders away from farmers. Bump the token whenever a change
  // alters what a sheet LOOKS like: r1 = bedpath registration + zone-ring removal + legend
  // grouping + gutter architecture on paid sheets (2026-08-03); r2 = the chrome pass moved after
  // the AI pass on every paid path, so a Full Treatment sheet carries the app's legend, labels and
  // title again instead of whatever the model left of them (2026-08-10). A cached r1 Full
  // Treatment is exactly the picture this change exists to stop re-serving.
  const underlaySuffix = underlayCacheSuffix(underlay, frameProp)
    + (sheetHasPlantCodes ? labelModeCacheSuffix(labelMode) : '')
    + ':r2'
    // A sheet drawn at SCALE 3 is a different picture from the same sheet at 2 — re-serving a
    // 1920px cache under a High setting would look like the setting did nothing (the exact
    // "code change looks like it did nothing" trap the r-token note above describes). EMPTY at
    // the default so every existing scale-2 cache key stays byte-identical; only High keys
    // diverge, and switching back re-serves the old caches untouched.
    + (SCALE !== 2 ? `:s${SCALE}` : '');
  const mapKey = (exactSheet === 'base'
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
        // …:<mode> so Exact, Hybrid and Full Treatment can never share a slot. Without it the
        // three treatments overwrote and re-served each other's pictures — see requestedMode.
        ? `producer:${producerStyle}:${filter}:${requestedMode}`
        : (analysisStyle ?? filter)) + underlaySuffix;
  const mapKeyRef = useRef(mapKey);
  mapKeyRef.current = mapKey;
  // The queue-completion handler needs the CURRENT suffix when it builds a save key — it runs in
  // an effect whose closure would otherwise pin the value from the render that armed it.
  const underlaySuffixRef = useRef(underlaySuffix);
  underlaySuffixRef.current = underlaySuffix;
  const galleryViewItem = gallery.find((g) => g.id === galleryViewId) ?? null;
  // The opened sheet's full image — ONE at a time, fetched when the farmer opens it and dropped
  // when they close it or open another. Fresh renders already carry item.image and skip the
  // fetch. Falls back to the thumbnail while loading (and permanently, if the row is gone),
  // which is the honest degradation: a soft picture now beats a spinner over a crash later.
  const [galleryViewImage, setGalleryViewImage] = useState<string | null>(null);
  useEffect(() => {
    if (!galleryViewId) { setGalleryViewImage(null); return; }
    const item = gallery.find((g) => g.id === galleryViewId);
    if (!item) { setGalleryViewImage(null); return; }
    if (item.image) { setGalleryViewImage(item.image); return; }
    let stale = false;
    setGalleryViewImage(null); // show the thumb, not the PREVIOUS sheet's full image
    void loadSheetImage(item.id).then((image) => {
      if (!stale) setGalleryViewImage(image);
    });
    return () => { stale = true; };
    // gallery identity churns on thumb backfill; keying on the id is what stops this effect
    // refetching a multi-MB image every time a thumbnail lands elsewhere in the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryViewId]);

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
    // METAS ONLY — no image payloads. This is what keeps the heap flat however many sheets a
    // farmer has saved; see GalleryItem.image's own note. The full image is fetched per sheet
    // when opened, and the backfill below fetches one at a time.
    void loadSheetMetas(state.siteId).then((rows) => {
      if (cancelled) return;
      // Sheets from an earlier generation of the render rules stay in the gallery — they are the
      // farmer's, and some are downloaded already — but they are labelled, so two sheets with the
      // same title from different eras are never confusable.
      setGallery(rows.map((r) => ({
        id: r.id,
        label: r.planVersion === PLAN_VERSION ? r.label : `${r.label} · older version`,
        thumb: r.thumb,
        resultKind: r.resultKind ?? 'legacy',
        provider: r.provider ?? 'unknown',
        geometryLock: r.geometryLock ?? false,
        showcase: r.showcase ?? false,
      })));
      // Backfill thumbnails for sheets saved before makeGalleryThumbnail existed — otherwise a
      // farmer's EXISTING gallery (the case most likely to actually have the memory problem this
      // fixes, having had the longest time to accumulate full-resolution entries) never benefits.
      // ONE AT A TIME, AND THIS TIME ACTUALLY. The previous version said "one at a time" in this
      // comment and then fired every makeGalleryThumbnail from a plain for-loop with no await, so
      // a gallery of N legacy sheets began N CONCURRENT decodes on mount — each a full-resolution
      // PNG (1-3 MB encoded, ~10 MB decoded at sheet size) with its own canvas alongside it. That
      // is precisely the memory spike the thumbnail work was introduced to prevent, moved out of
      // the grid and into the backfill. Rory: "whenever I expand a map that I have created in the
      // glossy section it crashes the app" — this runs on that same screen, moments earlier.
      //
      // Sequential means peak cost is ONE decode whatever the gallery's size, and each is released
      // before the next starts. Best-effort and non-blocking as before: the grid is already up.
      // The walk itself lives in lib/gallery-thumbnails.ts so its SCHEDULE is testable. Both
      // versions of this code produce identical thumbnails and identical saved records — they
      // differ only in how many decodes are alive at once, which no assertion about the result
      // could ever catch. tests/gallery-thumbnails.test.ts asserts peak concurrency is 1.
      void backfillThumbnails(rows, {
        // Each make() now also FETCHES its row's image — still exactly one full sheet in memory
        // at a time, and it becomes garbage as soon as the thumbnail is drawn from it.
        make: async (r) => {
          const image = await loadSheetImage(r.id);
          return image ? makeGalleryThumbnail(image) : undefined;
        },
        onThumb: (r, thumb) => {
          setGallery((prev) => prev.map((g) => (g.id === r.id ? { ...g, thumb } : g)));
          // patchSheetThumb, NOT saveSheet({...r, thumb}): r is a meta with no image, and a
          // saveSheet from it would write a row whose image field is GONE — the thumbnail
          // backfill quietly destroying every sheet it touched. The patch helper reads the
          // stored row and refuses to write one that has no image.
          void patchSheetThumb(r.id, thumb);
        },
        isCancelled: () => cancelled,
      });
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
      // GalleryItem & {image: string}: fresh renders are the one case that always carries the
      // full image (it is already in memory — it was just drawn), and the type says so, which is
      // what lets the two saveSheet calls below stay whole-row writes.
      const item: GalleryItem & { image: string } = {
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
  /**
   * Re-encode one saved sheet at a chosen size and format.
   *
   * A saved sheet is a full-size PNG. Both other formats need a real re-encode rather than a
   * rename: JPEG has NO ALPHA CHANNEL, so every transparent pixel encodes as black unless something
   * opaque is painted first — which on an A2 sheet with margins is most of the page. The paper fill
   * below is that something, and it is the sheet's own cream so a downloaded JPEG and the sheet on
   * screen are the same object.
   */
  const encodeSheet = useCallback(
    // Named `level`, not `quality`: the component already has a `quality` state of its own for PAID
    // AI renders, with the same three string values and a completely different meaning. Shadowing
    // it here would compile perfectly and be wrong.
    async (src: string, format: Exclude<SheetExportFormat, 'pdf'>, level: SheetExportQuality) => {
      const img = await loadImage(src);
      const profile = SHEET_EXPORT_PROFILES[level];
      const w = Math.max(1, Math.round(img.naturalWidth * profile.scale));
      const h = Math.max(1, Math.round(img.naturalHeight * profile.scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      if (format === 'jpeg') {
        ctx.fillStyle = '#FBF6EC';
        ctx.fillRect(0, 0, w, h);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      return { dataUrl: canvas.toDataURL(imageMimeType(format), profile.jpegQuality), w, h };
    },
    [],
  );

  /** The full image for one gallery item — from memory when this session rendered it, from
   *  IndexedDB otherwise. Export paths call this INSIDE their per-sheet loops, so a six-sheet
   *  export holds one original at a time rather than six; the same discipline as the thumbnail
   *  backfill, for the same reason. */
  const resolveGalleryImage = useCallback(async (item: GalleryItem): Promise<string | null> => {
    if (item.image) return item.image;
    return loadSheetImage(item.id);
  }, []);

  /** One PDF carrying every chosen sheet, a page each, at its own aspect. */
  const buildGalleryPdf = useCallback(
    async (picked: GalleryItem[], level: SheetExportQuality) => {
      let doc: jsPDF | null = null;
      for (const item of picked) {
        const src = await resolveGalleryImage(item);
        // A missing row is skipped rather than aborting the set: five sheets a farmer can send
        // beat zero because a sixth had been deleted underneath the selection.
        if (!src) continue;
        // PDF pages carry JPEG regardless of the format chips: those choose the FILE the farmer
        // gets, and inside a PDF a lossless page would multiply the size of a document whose whole
        // job is to be small enough to send.
        const { dataUrl, w, h } = await encodeSheet(src, 'jpeg', level);
        const orientation = w >= h ? 'landscape' : 'portrait';
        if (!doc) doc = new jsPDF({ unit: 'px', format: [w, h], orientation, hotfixes: ['px_scaling'] });
        else doc.addPage([w, h], orientation);
        doc.addImage(dataUrl, 'JPEG', 0, 0, w, h);
      }
      return doc;
    },
    [encodeSheet, resolveGalleryImage],
  );

  const exportSelection = useCallback(
    async (mode: 'download' | 'share') => {
      const picked = gallery.filter((g) => exportSel.has(g.id));
      if (!picked.length || exportBusy) return;
      setExportBusy(true);
      setError(null);
      try {
        if (isMultiSheetFormat(exportFormat)) {
          const doc = await buildGalleryPdf(picked, exportQuality);
          if (!doc) return;
          const name = picked.length === 1
            ? sheetExportFileName(placeName, picked[0].label, 'pdf')
            : sheetSetFileName(placeName, picked.length);
          if (mode === 'download') {
            doc.save(name);
          } else {
            const file = new File([doc.output('blob')], name, { type: 'application/pdf' });
            await shareSheetFiles([file], picked.map((g) => g.label));
          }
          return;
        }

        const files: File[] = [];
        for (let i = 0; i < picked.length; i++) {
          const src = await resolveGalleryImage(picked[i]);
          if (!src) continue;
          const { dataUrl } = await encodeSheet(src, exportFormat, exportQuality);
          const name = sheetExportFileName(
            placeName,
            picked[i].label,
            exportFormat,
            picked.length > 1 ? i : undefined,
          );
          if (mode === 'share') {
            const blob = await (await fetch(dataUrl)).blob();
            files.push(new File([blob], name, { type: blob.type || imageMimeType(exportFormat) }));
            continue;
          }
          // SEQUENTIAL, WITH A GAP. A browser asked to start six downloads in one tick treats the
          // second onwards as a popup and silently drops them; the farmer sees one file and assumes
          // the feature is broken. Yielding between anchors is what makes "download 6" mean six.
          const a = document.createElement('a');
          a.href = dataUrl;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          if (i < picked.length - 1) await new Promise((r) => setTimeout(r, 350));
        }
        if (mode === 'share' && files.length) await shareSheetFiles(files, picked.map((g) => g.label));
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        setExportBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gallery, exportSel, exportFormat, exportQuality, exportBusy, placeName, encodeSheet, buildGalleryPdf, resolveGalleryImage],
  );

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
            imageBase64: stripDataUrl(await capForAiInput(composite)),
            maskBase64: stripDataUrl(await capForAiInput(mask)),
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
            // Its own theme, not 'water' — a swale drawn in irrigation blue is the whole reason
            // this sheet was split out. See layerTheme's 'earthworks' case.
            earthworks: 'earthworks',
            planting: 'planting',
            structures: 'overall',
          };
          const layer = analysisStyle ?? FILTER_TO_LAYER[filter];
          image = await requestRender({
            imageBase64: stripDataUrl(await capForAiInput(composite)),
            satBase64: frame.satDataUrl ? stripDataUrl(await capForAiInput(frame.satDataUrl)) : undefined,
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
      // Reference Blueprint sheet template and exact source geometry — so the sheet is chosen by
      // PASSING the filter, not by a hand-written chain of comparisons.
      //
      // It used to be that chain, and it had no `earthworks` branch: selecting Earthworks (05)
      // fell through the whole ladder to the final else and rendered buildBlueprintWholeMap, so
      // the sheet came back captioned "Earthworks map" with "08 — FINAL INTEGRATED MASTERPLAN"
      // printed inside it. Rory: "earth works is showing final master plan sheet". A ladder whose
      // last rung is a real sheet cannot fail loudly — every filter it forgets silently becomes
      // the masterplan — and buildBlueprintEarthworksMap had existed the whole time. One call
      // makes forgetting impossible.
      const composite = await buildReferenceBlueprintMap(state, frame, refLayers, filter, placeName, site, labelMode);
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
      // 03–08 — every design layer that has content, driven off GLOSSY_FILTERS and the canonical
      // SHEET_NO rather than a hand-kept copy. The copy had gone stale twice over: EARTHWORKS was
      // missing outright (so "all exact" quietly produced a set with no sheet 05 in it), and the
      // numbers it printed while working — planting 05, structures 06, whole 07 — were the numbers
      // from before Earthworks was split out of Water, so the progress line disagreed with the
      // number printed on the sheet it was rendering.
      // Sorted by sheet number, not by GLOSSY_FILTERS' own order — that list leads with 'all'
      // (it is a picker, and "Whole design" belongs at the top of a picker), while the plan set
      // ends with it.
      const sheetOrder = [...GLOSSY_FILTERS].sort((a, b) => SHEET_NO[a.key].localeCompare(SHEET_NO[b.key]));
      for (const { key: f } of sheetOrder) {
        if (layerContentCount(state, refLayers, f) === 0) continue;
        step(
          `${SHEET_NO[f]} · ${GLOSSY_FILTERS.find((x) => x.key === f)?.label ?? f} map`,
          await buildReferenceBlueprintMap(state, frame, refLayers, f, placeName, site, labelMode),
          f,
        );
      }
      // 09 — Implementation & phasing (exact rules-engine sheet), when there's anything to phase.
      const plan = buildPhasePlan(state, refLayers, site);
      if (plan.phases.length > 0) {
        step('09 · Implementation & phasing', await buildImplementationMap(state, frame, refLayers, site, placeName), 'implementation-exact');
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

  // Composite-back for one sheet. Three shapes, and the middle one is the fix:
  //
  //   HYBRID (locked)   clip the model output to the boundary, put the real satellite outside,
  //                     restore protected pixels, then burn our exact labels + the cream chrome.
  //   FULL (polishStage) no clip and no restore — the model repainted the map and the app draws
  //                     every chrome element back over it (composeSheetChromeOverMapArt).
  //   SHOWCASE          "AI legend" only: the model was commissioned to draw its own legend and
  //                     labels, so its whole output ships with just the transparency backstop.
  //
  // The tier is decided by the flags the JOB was enqueued with, never by what happens to be
  // fetchable at finish time. Chrome is app-owned in the first two and is not optional in either.
  const finishStyledSheet = useCallback(
    async (
      modelImage: string,
      f: GlossyLayerFilter,
      styleDef: { key: StylePreset; label: string; labelStyle: LabelStyle },
      showcase = false,
      sourceImage?: string,
      protectMask?: string,
      locked = false,
      /**
       * The COMMITTED workflow stage, taken from the job doc's resultKind — never inferred from a
       * protect mask, an image size or a visual style. Those were the old discriminators for "is
       * this the Full Treatment polish", and each of them can be absent for reasons that have
       * nothing to do with who owns the page; when one was, the chrome pass silently did not run.
       */
      polishStage = false,
    ): Promise<string> => {
      // Model-authored pages and geometry-locked pages must use the same boundary-focused frame
      // as the image sent to GPT. Otherwise exact overlays are rebuilt in the original satellite
      // coordinates and land as a tiny or displaced design on the returned page.
      //
      // The polish stage arrives with locked=false (its provenance is honest: the model owns the
      // map ARTWORK) but its INPUT was the Hybrid's map, built in this same boundary-focused
      // frame, and the chrome the app draws back over it must land in that same frame too.
      const useBoundaryPresentation = locked || isModelChromeStyle(styleDef.key) || polishStage;
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

      // ── FULL TREATMENT: THE CHROME PASS, UNCONDITIONALLY ───────────────────────────────────
      //
      // The second paid pass receives the Hybrid's MAP PANEL, text-free — the same contract the
      // Hybrid pass itself has always had. It used to receive the complete finished page, whose
      // prompt then had to demand "WRITE NOTHING" and "keep the supplied labels with their exact
      // spellings" IN THE SAME BREATH: the flagship render resolved that contradiction by erasing
      // every map label and repainting the legend. The model polishes artwork; every glyph of text
      // is drawn afterwards, from the saved design, by composeSheetChromeOverMapArt.
      //
      // WHAT CHANGED HERE, AND WHY IT IS THE WHOLE FIX: this branch used to be guarded on
      // `protectMask && sourceImage` and then on `|src| == |map|`, and any of those three could
      // fail for reasons unrelated to the sheet. The size comparison failed ALWAYS once the render
      // scale went above 2, because every AI-bound bitmap is uniformly downscaled to
      // AI_INPUT_WIDTH before upload (capForAiInput) — so the "legacy page input" escape hatch
      // fired on every polish, and what shipped was the model's repainted page with the boundary
      // corridor byte-restored over it: no labels, no legend, and one hard vector line stamped
      // across repainted ground. Nothing gates the chrome pass now. The committed stage decides
      // that it runs; the input's ASPECT (never its size) decides only whether a legacy page's map
      // column has to be taken out of the returned image first.
      //
      // NO byte-restore on the polish tier either. The mask's boundary corridor used to stamp the
      // Hybrid's PHOTO ground (plus the drawn line and its vertex dots) back through the model's
      // fully repainted artwork. The property line is a site FACT, so the app draws it as a vector
      // at the exact saved position — inside the same pass as the labels and the legend, which is
      // what makes it read as part of the sheet rather than as a mark laid on top of it.
      if (paidPolishNeedsChromePass({
        resultKind: polishStage ? 'ai-polished' : 'hybrid',
        geometryLock: locked,
        modelChromeStyle: isModelChromeStyle(styleDef.key),
      })) {
        const chromeInput = {
          state: renderState,
          frame: renderFrame,
          refLayers: renderRefLayers,
          filter: f,
          W,
          H,
          placeName,
          styleLabel: styleDef.label,
          labelMode,
          site,
        };
        // Only ever used to recognise a legacy page-shaped input; a missing source never stops the
        // chrome pass, it just means the current map-only contract is assumed.
        let modelInputSize: { width: number; height: number } | undefined;
        if (sourceImage) {
          try {
            const src = await loadImage(sourceImage);
            modelInputSize = { width: src.width, height: src.height };
          } catch { /* unmeasurable input — assume the map-only contract */ }
        }
        try {
          const composed = await composeSheetChromeOverMapArt({
            ...chromeInput,
            modelArt: modelImage,
            modelInputSize,
          });
          polishedMapRef.current = composed.mapArt;
          return composed.sheet;
        } catch (err) {
          // A paid sheet WITHOUT its legend and labels is not an acceptable degraded result — that
          // is the exact failure this branch exists to prevent — so the fallback re-runs the same
          // chrome pass over the map the model was given rather than shipping a bare image.
          console.error('[glossy] Full Treatment chrome pass failed over the model art', err);
          if (!sourceImage) throw err;
          const fallback = await composeSheetChromeOverMapArt({
            ...chromeInput,
            modelArt: sourceImage,
            modelInputSize,
          });
          polishedMapRef.current = fallback.mapArt;
          return fallback.sheet;
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
      // The "AI legend" showcase tier ONLY — the farmer explicitly asked the model to author the
      // whole page: title, map, pictorial legend and labels. Step 1 has already saved the exact
      // app-owned master separately, so compositing app chrome back over this paid result would
      // only turn it into the same hybrid again.
      //
      // Full Treatment does NOT reach this line: it returns from the chrome pass above, decided by
      // its committed stage. It used to fall through to here whenever its protect mask or its
      // uploaded input could not be fetched, which shipped a paid sheet with no chrome at all.
      if (showcase && !locked && !polishStage) return restoredImage;
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
      // Planting/structures/all now match the exact architecture instead of the pre-gutter one:
      // no on-map pills — names live in the label gutters and the plant codes, both drawn by
      // burnExactLabelLayer below. Keeping the pills alongside them would name one plant twice.
      const gutterOwnsLabels = locked && (f === 'planting' || f === 'structures' || f === 'all');
      const labels = (f === 'water' && locked) || gutterOwnsLabels
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
      // Full Treatment polishes THIS image — the finished map with exact content burned back and
      // not one glyph of text on it. Stashed pre-labels, so what the model receives has nothing
      // writable to mangle; the label layer is re-drawn from the design over its output.
      if (locked) hybridMapForPolishRef.current = { key: f, map: final };
      const labelled = gutterOwnsLabels
        ? await burnExactLabelLayer(final, renderState, renderFrame, renderRefLayers, f, W, H, labelMode)
        : { map: final, gutterLayout: undefined };
      return composeStyleSheet(
        labelled.map,
        renderState,
        renderFrame,
        renderRefLayers,
        f,
        placeName,
        styleDef.label,
        locked ? REFERENCE_SHEET_LABEL[f] : layerLabel,
        !locked,
        locked,
        locked
          ? {
              // The legend prints code prefixes only in the mode that draws them, and the gutter
              // rows must honour the farmer's label-mode choice — same contract as the exact sheet.
              labelMode,
              gutterLayout: labelled.gutterLayout,
              ...(f === 'water'
                ? {
                    footerHeading: 'NOTES',
                    footerText: waterReferenceFooterText(renderState, renderFrame, renderRefLayers, site),
                  }
                : {}),
            }
          : {},
      );
    },
    [state, frame, refLayers, site, placeName, labelMode],
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
              items: renderState.items,
            })
          : lockActive
          ? buildLockedIllustrationPrompt(layerLabel, styleKey, elementsText, designBrief)
          : effectiveModelChrome
            ? (promptRewrite
              ? buildShowcasePrompt(layerLabel, styleKey, elementsText, placeName ?? '', f, renderState.items)
              : buildShowcasePromptLegacy(layerLabel, styleKey, elementsText, placeName ?? '', designBrief))
            : (promptRewrite
              ? buildProducerPrompt(layerLabel, styleKey, elementsText, 'full', false, designBrief, renderState.items)
              : buildProducerPromptLegacy(layerLabel, styleKey, elementsText, 'full', false, designBrief, renderState.items));
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
      const jobId = await enqueueRenderJobCapped({ siteId: state.siteId, style: styleKey, engine: queueEngine, quality, sheets });
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
  }, [producerStyle, state, frame, refLayers, site, placeName, finishStyledSheet, pushGallery, effectiveModelChrome, lockActive, promptRewrite, queueEngine, quality]);

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
      // The polish input is the Hybrid's MAP — exact content burned back, no text — stashed by
      // finishStyledSheet, keyed by filter so another sheet's map can never be polished by
      // mistake. The composed PAGE (hybridResultRef) is no longer what the model receives: a page
      // input forced the prompt to say "WRITE NOTHING" and "keep the supplied labels" at once,
      // and the flagship render obeyed both by erasing the labels and repainting the legend.
      const polishSource = fullSheetPolish ? hybridMapForPolishRef.current : null;
      if (fullSheetPolish && (!polishSource || polishSource.key !== filter)) {
        throw new Error('The AI hybrid sheet was not available to polish — please try again.');
      }
      const exactSheetInput = fullSheetPolish && polishSource ? polishSource.map : null;
      // Keep a SECOND reference to the same image, deliberately not consumed. The paid pass has to
      // be scored against what it was actually given, and the refs are nulled below so a stale
      // hybrid can never leak into an unrelated render. Without this copy there is nothing left to
      // compare the paid result to, which is precisely why six attempts to fix "the polished sheet
      // looks identical to the hybrid" could each be signed off green: no code in this app had
      // ever looked at the output image.
      if (fullSheetPolish) polishInputRef.current = exactSheetInput;
      if (fullSheetPolish) { hybridMapForPolishRef.current = null; hybridResultRef.current = null; } // consume-once
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
        // The second pass improves the map artwork. Restore only the narrow boundary ring
        // afterwards; broader Hybrid source restoration creates photographic seams and blurred
        // roof/driveway keyholes in otherwise unified artwork. The mask stays at MAP dimensions —
        // the input is the map now, and extendProtectMaskToStyleSheet built its sheet at a
        // geometry (map at x=0, no gutters) the composed page never had, so its rescaled restores
        // landed displaced. With no page in the pipeline there is nothing to extend over.
        protectMaskDataUrl = await buildProtectMask(
          renderState,
          renderFrame,
          renderRefLayers,
          filter,
          fullTreatmentProtectPolicy(),
        );
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
        ? buildFinishedSheetPolishPrompt(layerLabel, styleKey, placeName, structureRegisterText(renderState, renderRefLayers))
        : isModelChromeStyle(styleKey)
        ? buildSatelliteOverlayPrompt({ layerLabel, stylePreset: styleKey, elementsText, fabric, served, systems: waterSystemsPresent(renderState), placeName, sheetKind: filter, hasDriveway: renderRefLayers.driveway.length >= 2, items: renderState.items })
        : lockActive
        ? buildLockedIllustrationPrompt(layerLabel, styleKey, elementsText, designBrief)
        : useShowcase
          ? (promptRewrite
            ? buildShowcasePrompt(layerLabel, styleKey, elementsText, placeName ?? '', filter, renderState.items)
            : buildShowcasePromptLegacy(layerLabel, styleKey, elementsText, placeName ?? '', designBrief))
          : (promptRewrite
            ? buildProducerPrompt(layerLabel, styleKey, elementsText, 'full', false, designBrief, renderState.items)
            : buildProducerPromptLegacy(layerLabel, styleKey, elementsText, 'full', false, designBrief, renderState.items));
      const jobId = await enqueueRenderJobCapped({
        siteId: state.siteId,
        style: styleKey,
        engine: queueEngine, quality,
        sheets: [{
          key: filter,
          label: layerLabel,
          prompt,
          compositeDataUrl: sheetInput,
          ...(protectMaskDataUrl ? { protectMaskDataUrl } : {}),
          ...(protectMaskDataUrl ? { useProtectMaskForEdit: false } : {}),
          showcase: authorityFlags.showcase,
          geometryLock: authorityFlags.geometryLock,
          resultKind: lockedPolishResultKind(lockedPolishStage),
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
  }, [producerStyle, state, frame, refLayers, site, placeName, filter, effectiveModelChrome, lockActive, promptRewrite, lockedPolishStage, queueEngine, quality]);

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
      const pxPerM = W / (renderFrame.imgW * renderFrame.mPerPx);
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
      // Keep the Site Hybrid's discrete existing-item facts identical to the free exact Site map.
      drawExistingSiteItems(ctx, renderState, px, py, pxPerM);
      // Ground-feature label pills (patio, lawn, veg garden, ...) — same call buildBlueprintBaseMap
      // makes on the exact sheet. Without this the Hybrid result had no labels at all (adversarial
      // review, 2026-07-25, noted this as an acknowledged follow-up rather than a safety gap).
      //
      // existingSiteGroundRings + the refLayers house/driveway extraRows: the SAME existing-vs-
      // design split buildBlueprintBaseMap now applies (Rory: "still more staple garden issues -
      // it came under base map ... also labels missing for house"). Keeping this Hybrid sheet on
      // the OLD 'all'-filter selection while the exact sheet used the new one would have put the
      // two Site sheets back into disagreement — exactly the invariant this function's own comment
      // below says must never happen.
      const hybridBaseRings = existingSiteGroundRings(renderState, renderRefLayers);
      const hybridExtraRows: Array<{ id: string; text: string; cx: number; cy: number }> = [];
      if (renderRefLayers.house.length >= 3) {
        const pts = renderRefLayers.house;
        hybridExtraRows.push({
          id: 'reflayer-house',
          text: GROUND_FEATURES.house.label.toUpperCase(),
          cx: (pts.reduce((s, p) => s + p[0], 0) / pts.length) * W,
          cy: (pts.reduce((s, p) => s + p[1], 0) / pts.length) * H,
        });
      }
      if (renderRefLayers.driveway.length >= 2) {
        const pts = renderRefLayers.driveway;
        hybridExtraRows.push({
          id: 'reflayer-driveway',
          text: GROUND_FEATURES.driveway.label.toUpperCase(),
          cx: (pts.reduce((s, p) => s + p[0], 0) / pts.length) * W,
          cy: (pts.reduce((s, p) => s + p[1], 0) / pts.length) * H,
        });
      }
      hybridExtraRows.push(...existingSiteItemRows(renderState, W, H));
      drawBlueprintLabelPills(ctx, groundLabelsForSheet(renderState, renderRefLayers, W, H, 'all', undefined, hybridBaseRings, hybridExtraRows));

      // Title, legend, north arrow and scale — the other half of "our exact elements locked back on
      // top" that every other sheet's Hybrid mode already delivers. Same legend-row recipe as
      // buildBlueprintBaseMap, so the exact sheet and this Hybrid sheet can never list different
      // ground features. styleLabel reflects the CHOSEN style (unlike the exact sheet, which is
      // always labelled "Reference Blueprint" since it has no style choice) — matching how every
      // other sheet's finishStyledSheet passes styleDef.label through to composeStyleSheet.
      const legendRows: StyleLegendRow[] = existingSiteGroundLegendGroups(renderState, renderRefLayers).map((group) => ({
        swatch: group.color,
        text: group.text,
        kind: 'ground',
      }));
      if (renderRefLayers.house.length >= 3) {
        legendRows.unshift({ swatch: '#3E4648', text: 'House / building', kind: 'surface' });
      }
      if (renderRefLayers.driveway.length >= 2) {
        legendRows.push({ swatch: '#5A5D57', text: 'Existing tarred driveway', kind: 'surface' });
      }
      if (renderRefLayers.boundary.length >= 3) {
        legendRows.push({ swatch: BOUNDARY_LINE_GREEN, text: 'Property boundary', lineKind: 'fence' });
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
      // (The baseline itself is captured below, once the map column has been cut out.)
      const presentation = await boundaryPresentationContext(state, frame, refLayers);
      const renderFrame = presentation.frame;
      const mapWidth = renderFrame.imgW * SCALE;
      const mapHeight = renderFrame.imgH * SCALE;
      // BOTH stages send MAP-AREA ARTWORK, never a composed page. The Hybrid stage always did;
      // the polish stage used to upload the finished Hybrid PAGE — bearings, legend rows, notes,
      // title and all — and an image model cannot redraw a page of 9px type, so it erased it. The
      // finished page is still what the polish stage improves; only its map column is sent, and
      // composeSectorSheet draws every app-owned mark back over what comes home.
      const hybridMapInput = hybridInput
        ? await cropStyleSheetToMap(hybridInput, mapWidth, mapHeight)
        : null;
      const composite = hybridMapInput
        ?? renderFrame.satDataUrl
        ?? await buildComposite(
          presentation.state,
          renderFrame,
          presentation.refLayers,
          'all',
          false,
        );
      // Score the paid pass against the artwork it was actually handed, not against the page that
      // artwork was cut from — a page baseline would count the app's own legend and notes columns
      // as pixels the model failed to change.
      if (polishStage) polishInputRef.current = composite;
      // HYBRID STAGE ONLY. A protect mask is a promise that those pixels come back byte-for-byte,
      // and the polish stage restores nothing — pushing photo fabric into repainted artwork is
      // what made the restored element read as a mark stamped on the picture. Sending the mask
      // anyway would also have excluded the whole exterior from the difference gate's score, on a
      // stage where the model is free to (and does) repaint it. Scoring the whole map is stricter.
      // (extendProtectMaskToStyleSheet is gone from this path with it: it built a sheet-shaped
      // mask — map at x=0, no gutters — that no composed page ever matched.)
      const protectMaskDataUrl = kind === 'sector' && !polishStage
        ? await buildProtectMask(
          presentation.state,
          renderFrame,
          presentation.refLayers,
          'all',
          sectorProtectMaskOptions(),
        )
        : undefined;
      const prompt = polishStage
        ? kind === 'sector'
          ? buildSectorSheetPolishPrompt(styleKey, placeName)
          : buildFinishedSheetPolishPrompt('Existing Site', styleKey, placeName, structureRegisterText(presentation.state, presentation.refLayers))
        : buildSectorRestylePrompt(styleKey, placeName);
      const jobId = await enqueueRenderJobCapped({
        siteId: state.siteId,
        style: styleKey,
        engine: queueEngine, quality,
        sheets: [{
          key: kind,
          label: kind === 'sector' ? 'Sector analysis' : 'Existing site',
          prompt,
          compositeDataUrl: composite,
          ...(protectMaskDataUrl ? { protectMaskDataUrl, useProtectMaskForEdit: false } : {}),
          // showcase:true on the polish stage records that the model, not the app, painted the
          // GROUND on this pass — it no longer means "the model owns the page". It cannot: the
          // model is handed the map column alone and never sees the bearings, legend or notes, so
          // composeSectorSheet draws all of them back over its artwork at BOTH stages. (These two
          // flags may never both be true — hasConflictingRenderAuthority rejects the job.)
          showcase: polishStage,
          geometryLock: !polishStage,
          resultKind: lockedPolishResultKind(lockedPolishStage),
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
  }, [producerStyle, state, frame, refLayers, site, placeName, lockedPolishStage, queueEngine, quality]);

  // Phasing (08) AI Hybrid + Full Treatment — mirrors generateSectorViaQueue's two-stage pattern.
  //
  // Hybrid stage:  build the exact sheet, blank nothing, and upload its MAP COLUMN — the schedule
  //                panel, the critical-order list and the site rules are simply not in the image.
  //                On completion, composePhasingSheet (via finishPhasingRef) draws the REAL
  //                schedule panel back on top. showcase:false, geometryLock:true.
  //
  // Polish stage:  takes hybridResultRef.current (the finished hybrid, WITH the real schedule
  //                already composited on top by the Hybrid stage), re-blanks the panel region via
  //                blankPhasingPanel and then cuts the same map column out of it before sending it
  //                to buildFinishedSheetPolishPrompt. showcase:true (the model painted the ground
  //                on this pass) but geometryLock:false, exactly like every other sheet's polish
  //                stage — those two flags can never both be true (enqueueRenderJob's
  //                hasConflictingRenderAuthority rejects the job outright; an earlier version of
  //                this code set geometryLock:true here and broke Full Treatment entirely —
  //                adversarial review, 2026-07-25).
  //
  // Phasing was the first sheet to send map-area artwork instead of a composed page, because a
  // build calendar must never be AI-authored even under a well-worded prompt-only instruction not
  // to touch it. Every paid path now works this way, for the same reason generalised: an image
  // model cannot reproduce small text, so a page of it comes back erased (see
  // lib/sheet-chrome-pass.ts).
  //
  // SAFETY NOTE: no protect mask is sent on either stage, and none is needed. A mask was never
  // enforced by the OpenAI edit call anyway (useProtectMaskForEdit is false on every sheet in this
  // file — lib/render-jobs.ts: "a deterministic restoration contract, not an OpenAI edit mask").
  // The load-bearing guarantee is two-fold and structural: the model is never shown real schedule
  // text (the map-column crop, plus blankPhasingPanel on the polish stage), and finishPhasingRef's
  // composePhasingSheet redraws every exact fact back on top of whatever the model returns,
  // regardless of stage. The saved exact master is the authority in every case.
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
      // Full Treatment's polish stage must NEVER see the real schedule text either — not just the
      // Hybrid stage. hybridInput here is the Hybrid stage's own FINISHED sheet (composePhasingSheet
      // already composited the real panel back onto it), so re-blank the same panel region before
      // sending it on. Without this, the model saw dates/tasks/hold-points with only
      // buildFinishedSheetPolishPrompt's generic wording asking it not to touch them — exactly the
      // prompt-only protection this sheet was built to avoid (adversarial review, 2026-07-25).
      //
      // The map-column crop below now removes the panel from the upload entirely, which makes this
      // blanking redundant on its own terms. It stays: two independent steps have to be wrong
      // before a date reaches a model, and this one is the cheaper of the two to reason about.
      if (polishStage && hybridInput) {
        // The hybrid sheet was rendered at the boundary-framed size, so blank at that size — the
        // raw frame would clear a rectangle that is no longer where the panel sits.
        hybridInput = await blankPhasingPanel(hybridInput, phasingSheetSize(frame, refLayers));
      }

      // BOTH STAGES SEND THE MAP COLUMN ALONE. Everything to the right of it is app-owned chrome —
      // the schedule panel, the critical-order list, the site rules — and everything around it is
      // gutter. The Hybrid stage used to upload the whole page with the panel merely blanked, so
      // the model was still asked to reproduce sheet furniture it cannot draw, and its page-shaped
      // return was then squeezed into the narrower map column by composePhasingSheet: the model's
      // ground landed horizontally compressed against exact content redrawn at full map width.
      // Sending the column means what comes back is the column.
      const phasingSize = phasingSheetSize(frame, refLayers);
      const phasingMapColumn = {
        x: phasingPanelRect(phasingSize).mapX,
        y: 0,
        w: phasingSize.mapW,
        h: phasingSize.H,
      };
      const phasingPage = hybridInput ?? await buildPhasingHybridInput(state, frame, refLayers, site, placeName);
      const compositeDataUrl = await cropSheetRegion(
        phasingPage,
        phasingSize.W,
        phasingSize.H,
        phasingMapColumn,
      );
      // Baseline for the paid-difference gate — the map artwork the model was actually handed, so
      // the app's own redraw of the schedule panel can never be scored as the model's work. (A
      // baseline that included the panel would let a verbatim copy pass as "redrawn", making the
      // gate worse than absent: it would certify the exact failure it was built to catch.)
      if (polishStage) polishInputRef.current = compositeDataUrl;
      // NO PROTECT MASK. buildPhasingProtectMask only ever covered the schedule panel, and the
      // panel is no longer inside the uploaded image — a sheet-shaped mask stretched onto a
      // map-shaped input would instead have frozen the right-hand quarter of the MAP and excluded
      // it from the difference gate's score. Removing the panel from the upload is the stronger
      // version of what the mask was for.
      const protectMaskDataUrl: string | undefined = undefined;

      const prompt = polishStage
        ? buildFinishedSheetPolishPrompt('Implementation & Phasing', styleKey, placeName, structureRegisterText(state, refLayers))
        : buildPhasingRestylePrompt(styleKey, placeName);

      const jobId = await enqueueRenderJobCapped({
        siteId: state.siteId,
        style: styleKey,
        engine: queueEngine, quality,
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
          resultKind: lockedPolishResultKind(lockedPolishStage),
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
  }, [producerStyle, state, frame, refLayers, site, placeName, lockedPolishStage, queueEngine, quality]);

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
      // Every engine now takes the queue, so this no longer depends on which one is selected. It is
      // kept as a named constant rather than inlined because sheetRenderRoute's model still has a
      // non-queue slot, and the disagreement check below is what would catch a re-divergence.
      const viaQueue = true;
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
      // EVERY ENGINE GOES THROUGH THE QUEUE. This used to send Gemini to generateProducer — the
      // direct /api/image-producer route — which is why "I tried Gemini and it didn't work" left no
      // trace anywhere: it never wrote a render_jobs doc, so there was no job, no error field and
      // no worker log to read. The picker was not choosing an ENGINE, it was choosing a whole
      // different PIPELINE, and the older one silently dropped everything the newer one does.
      //
      // What that path cannot do is the reason it must not be the Gemini default: it accepts no
      // protect mask and sends the unlocked prompt, so a locked sheet tells the model to paint
      // every feature while the browser also draws the deterministic overlay — duplicated tanks and
      // pipes, the exact thing Geometry Lock exists to prevent. It also always clips to the boundary
      // and burns our own labels, which crops a model-lettered legend panel clean off. Quota, the
      // kill switch and the render audit trail live on the queue too.
      //
      // generateProducer is left defined and unreferenced so restoring it is a one-line change.
      return generateOneViaQueue();
    }
    if (analysisStyle) return generate('gemini');
    return renderDesignMap();
  }, [exactSheet, restyleAiKind, phasingAiMode, producerStyle, engine, geometryLock, analysisStyle, selectedSheet, isExactRender, renderBaseMap, renderSectorMap, renderImplementationMap, generatePhasingViaQueue, generateSectorViaQueue, generateOneViaQueue, generateProducer, generate, renderDesignMap]);

  // Direct Step 1 button. If this sheet is already in exact mode, redraw immediately. Otherwise,
  // wait for React to switch the generator selection and then run the deterministic renderer.
  // This removes the old "pick a mode, then find the Generate button" two-click workflow.
  useEffect(() => {
    const action = lockedPolishAction({
      outputMode: requestedModeRef.current,
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
      outputMode: requestedModeRef.current,
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
      outputMode: requestedModeRef.current,
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

  const clearLockedPolishResult = useCallback(() => setResultImage(null), []);

  // Full Treatment only: the mounted hook owns the two consecutive React effects between a
  // completed Hybrid and enqueue 2. It waits for the finished-image state signal, commits the
  // 'polish' stage, then invokes the freshly committed polish-stage runCurrentSheet callback.
  useLockedPolishHandoff(
    {
      exactFlipPending: exactAfterFlipRef.current,
      hybridAfterExactPending: hybridAfterExactRef.current,
      hybridFlipPending: hybridAfterFlipRef.current,
      polishAfterHybridPending: polishAfterHybridRef.current,
      polishFlipPending: polishAfterFlipRef.current,
      mode,
      isExactRender,
      loading: loading !== null,
      hasResult: resultImage !== null,
      stage: lockedPolishStage,
      hybridHandoffReady,
    },
    {
      requestedModeRef,
      polishAfterHybridRef,
      polishAfterFlipRef,
      hybridResultRef,
      setHybridHandoffReady,
      setStage: setLockedPolishStage,
      setError,
      missingHybridMessage: t('designGlossyMissingHybrid'),
      setNotice,
      startingPolishMessage: t('designGlossyStartingPolish'),
      polishingMessage: t('designGlossyPolishing'),
      clearResult: clearLockedPolishResult,
      renderCurrentSheet: runCurrentSheet,
    },
  );

  useEffect(() => {
    if (!error || loading !== null) return;
    exactAfterFlipRef.current = false;
    hybridAfterExactRef.current = false;
    hybridAfterFlipRef.current = false;
    polishAfterHybridRef.current = false;
    polishAfterFlipRef.current = false;
    hybridResultRef.current = null;
    setHybridHandoffReady(false);
    setLockedPolishStage(null);
  }, [error, loading]);

  const runExactStep = useCallback(() => {
    if (!selectedSheet || loading !== null) return;
    setError(null);
    setNotice(null);
    requestedModeRef.current = 'exact';
    setRequestedMode('exact');
    setHybridHandoffReady(false);
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
    requestedModeRef.current = targetMode;
    setRequestedMode(targetMode);
    hybridResultRef.current = null;
    setHybridHandoffReady(false);
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
        setHybridHandoffReady(false);
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
          setHybridHandoffReady(false);
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
                  recordRenderAudit(auditFromReport(
                    { at: new Date().toISOString(), sheetKey: sheet.key, stage: 'hybrid', outputMode: requestedModeRef.current, style: styleKey },
                    diff,
                    decision.keep,
                  ));
                  if (!decision.keep) {
                    // Record the CONSEQUENCE, not just the rejection. A Full Treatment that stops
                    // here leaves the farmer on layer 2 with no polish entry at all, which is
                    // indistinguishable from a flow that stalled — and telling those two apart is
                    // the whole reason this trail exists.
                    if (requestedModeRef.current === 'full') {
                      recordRenderAudit({
                        at: new Date().toISOString(),
                        sheetKey: sheet.key,
                        stage: 'polish',
                        outputMode: 'full',
                        style: styleKey,
                        outcome: 'blocked',
                        note: 'the Hybrid returned the map it was given, so there was nothing new to polish',
                      });
                    }
                    rejected.add(sheet.key);
                    setPolishNoChange(decision.message);
                    // Full Treatment must not advance to polish a Hybrid the gate just proved was
                    // unchanged. Hybrid-only stops here for the same reason: no AI result exists
                    // to present, save, or label.
                    polishAfterHybridRef.current = false;
                    hybridResultRef.current = null;
                    setHybridHandoffReady(false);
                    setLockedPolishStage(null);
                    continue;
                  }
                } catch (err) {
                  // Scoring is diagnostic, never a new failure mode. If pixels cannot be measured,
                  // finish and keep the paid result exactly as before — but SAY that it went
                  // unmeasured, so an unscored pass can never later be read as a proven one.
                  console.warn('[glossy] could not score the paid hybrid — keeping it', err);
                  recordRenderAudit({
                    at: new Date().toISOString(),
                    sheetKey: sheet.key,
                    stage: 'hybrid',
                    outputMode: requestedModeRef.current,
                    style: styleKey,
                    outcome: 'unscored',
                    note: 'the pixels could not be compared, so this pass was kept unmeasured',
                  });
                }
              }
              // finishStyledSheet's zone/water-overlay branches and producerLabels() call are
              // meaningless for a sheet with no GlossyLayerFilter — `sheet.key as GlossyLayerFilter`
              // becomes a lie the moment 'sector' can reach this code (RENDER-INVESTIGATION.md
              // 'sector-ai' finding 3), so route it to the dedicated finisher instead of casting.
              //
              // EVERY ANALYSIS SHEET RECOMPOSES ITS OWN CHROME, AT BOTH STAGES. Sector's polish
              // used to ship the model's returned page verbatim (`showcase && key === 'sector'`),
              // on the reasoning that the polish tier had to be allowed to author "richer
              // typography, a pictorial legend and notes layout" — but that reasoning only ever
              // made sense while the model was HANDED a composed page to improve. It no longer is:
              // its input is the map column alone (see generateSectorViaQueue), so the returned
              // image is artwork, and shipping it raw would deliver a Sector sheet with no
              // bearings, no legend rows, no notes and no title. The two stages still genuinely
              // differ — the polish stage repaints the ground the Hybrid stage merely restyled,
              // and that ground is the whole base of the page — but the analysis on top of it is
              // the app's, at both stages, as it always was for Phasing.
              //
              // 'implementation' (Phasing 08) already worked this way: composePhasingSheet redraws
              // the real schedule panel and every exact fact (ground, structures, boundary, phase
              // pins) back on top of whatever the model returns, at either stage.
              //
              // No byte-restore on either polish tier: pushing photo fabric back into fully
              // repainted artwork punches photographic patches through it, and the restored
              // element then reads as a mark stamped on the picture rather than part of it. The
              // Hybrid stage remains the geometry-restored tier.
              let factualModelImage = raw;
              if (sheet.key === 'sector' && sourceImage && protectMask && !isPolishedResult) {
                try {
                  factualModelImage = await restoreProtectedPixels(sourceImage, raw, protectMask);
                } catch (restoreError) {
                  console.error('[glossy] Sector protected-pixel restore failed; using factual source', restoreError);
                  factualModelImage = sourceImage;
                }
              }
              if (showcase && sheet.key === 'base') {
                const presentation = await boundaryPresentationContext(state, frame, refLayers);
                factualModelImage = await cropStyleSheetToMap(
                  factualModelImage,
                  presentation.frame.imgW * SCALE,
                  presentation.frame.imgH * SCALE,
                );
              }
              // Map against map for the paid-difference gate below. finishStyledSheet publishes a
              // more precise value (the model art normalised into the map frame) for design-layer
              // sheets; the analysis finishers do not, and scoring their composed PAGE against the
              // map they were given would count the app's own legend and notes as the model's work.
              if (isPolishedResult) polishedMapRef.current = factualModelImage;
              const finalSheet = sheet.key === 'implementation'
                ? await finishPhasingRef.current(raw)
                : sheet.key === 'sector'
                ? await finishSectorRef.current(factualModelImage)
                : sheet.key === 'base'
                ? await finishSiteRef.current(factualModelImage, styleKey)
                : styleDef
                  ? await finishRef.current(raw, sheet.key as GlossyLayerFilter, styleDef, showcase, sourceImage, protectMask, locked, isPolishedResult)
                  : raw;
              // Geometry is app-drawn on every sheet that reaches a finisher — the chrome pass and
              // the analysis composers redraw the boundary, labels and legend from saved data over
              // whatever the model returned, so the badge is honest at both stages. Only the
              // model-authored "AI legend" showcase tier (no protect mask, no app chrome) is not.
              const finalGeometryLocked = locked
                || sheet.key === 'implementation'
                || sheet.key === 'sector'
                || sheet.key === 'base'
                || (showcase && Boolean(protectMask));
              // THE HANDOFF KEY MUST BE BUILT THE SAME WAY THE CACHE KEY IS. This compared
              // `producer:<style>:<sheet>` against mapKeyRef, but mapKey for a producer sheet is
              // `producer:<style>:<filter>:<mode>` — it grew a fourth `:<mode>` segment when Exact,
              // Hybrid and Full Treatment were given separate cache slots, and this comparison was
              // never updated to match. So the strings could never be equal on the producer path,
              // handoffTargetIsCurrent was ALWAYS false, and every Full Treatment aborted the
              // moment its Hybrid stage completed — reporting "the AI hybrid finished but its
              // image was not captured" even though the Hybrid had rendered perfectly and been
              // saved to the gallery. That is the "it never gets past the hybrid" report.
              //
              // Compared on style + sheet and deliberately NOT on mode: the question this guard
              // asks is "is the farmer still looking at the sheet this paid job was for", and
              // during a Full Treatment the mode segment is mid-flight by definition.
              const targetMapKey = `producer:${styleKey}:${sheet.key}`;
              const stillOnTargetSheet = mapKeyRef.current === targetMapKey
                || mapKeyRef.current.startsWith(`${targetMapKey}:`);
              const handoffTargetIsCurrent = job.sheets.length === 1
                && job.siteId === state.siteId
                && stillOnTargetSheet;
              // Full Treatment only: this completion IS the Hybrid stage — stash its finished image
              // so the polish stage (generateOneViaQueue's 'polish' branch) has something genuinely
              // painted to polish, instead of silently falling back to the bare exact sheet again.
              // Gated on the ref, not on `showcase`/`locked` alone, so an unrelated Hybrid-only or
              // batch render can never be mistaken for the one this flow is actually waiting on.
              // If the farmer navigated meanwhile, stop explicitly: dispatching runCurrentSheet
              // from the new UI state would spend the second pass on the wrong farm or sheet.
              if (polishAfterHybridRef.current && isHybridResult) {
                if (handoffTargetIsCurrent) {
                  hybridResultRef.current = finalSheet;
                  setHybridHandoffReady(true);
                } else {
                  polishAfterHybridRef.current = false;
                  hybridResultRef.current = null;
                  setHybridHandoffReady(false);
                  setLockedPolishStage(null);
                  setError(t('designGlossyMissingHybrid'));
                }
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
                  // Map against map: the finisher now composes deterministic chrome around the
                  // polished map, and scoring the composed PAGE against the map input would count
                  // our own gutter and legend as the model's work. polishedMapRef is the restored
                  // model output before any chrome; the page is only the fallback for a legacy
                  // in-flight job that still carried a page input.
                  const polishedArtifact = polishedMapRef.current ?? finalSheet;
                  polishedMapRef.current = null;
                  const diff = await measureRenderDifference(polishInputRef.current, polishedArtifact, protectMask);
                  const decision = paidRenderDecision(diff, 'polish');
                  console.info('[glossy] paid polish difference', sheet.key, diff);
                  recordRenderAudit(auditFromReport(
                    { at: new Date().toISOString(), sheetKey: sheet.key, stage: 'polish', outputMode: requestedModeRef.current, style: styleKey },
                    diff,
                    decision.keep,
                  ));
                  if (!decision.keep) {
                    polishRejected = true;
                    setPolishNoChange(decision.message);
                  }
                } catch (err) {
                  console.warn('[glossy] could not score the paid polish — keeping it', err);
                  recordRenderAudit({
                    at: new Date().toISOString(),
                    sheetKey: sheet.key,
                    stage: 'polish',
                    outputMode: requestedModeRef.current,
                    style: styleKey,
                    outcome: 'unscored',
                    note: 'the pixels could not be compared, so this pass was kept unmeasured',
                  });
                }
                polishInputRef.current = null;
              }
              if (polishRejected) {
                // Keep the Hybrid on screen and add nothing to the gallery. A third near-identical
                // thumbnail is exactly what made the gallery unreadable, and presenting a copy as a
                // paid result is the app claiming something it did not get.
                //
                // But say so on the Hybrid entry itself, not only in a toast the farmer may never
                // see again. Rory, looking at exactly this saved sheet later: "I'm sure it's just
                // stuck on hybrid" — it wasn't stuck, Full Treatment ran and correctly reverted, but
                // that outcome lived only in a dismissible banner in the compose panel. The gallery
                // caption is the one place he actually goes to check a result, so it has to carry
                // the explanation.
                if (hybridGalleryIdRef.current) {
                  const revertedId = hybridGalleryIdRef.current;
                  const note = ' — Full Treatment was tried: the 2nd AI pass came back too similar to keep, so this Hybrid was kept instead.';
                  setGallery((prev) => prev.map((g) => {
                    if (g.id !== revertedId || g.label.includes('Full Treatment was tried')) return g;
                    const amended = { ...g, label: `${g.label}${note}` };
                    // Whole-row write ONLY while the full image is in memory (it is — the hybrid
                    // was rendered this session). If this ever runs against a restored meta, a
                    // spread-save would write the row WITHOUT its image and destroy the sheet;
                    // skipping the persist loses only a caption amendment, never a picture.
                    if (amended.image) {
                      void saveSheet({ ...amended, image: amended.image, siteId: state.siteId, at: new Date().toISOString(), planVersion: PLAN_VERSION });
                    }
                    return amended;
                  }));
                  hybridGalleryIdRef.current = null;
                }
                setLockedPolishStage(null);
                setHybridHandoffReady(false);
                rejected.add(sheet.key);
                continue;
              }
              const record: SavedGlossy = { image: finalSheet, provider: 'falgpt', at: new Date().toISOString() };
              // The display effect reads `producer:<style>:<filter>:<mode>` plus the underlay/
              // label-mode suffixes; this save used a three-segment key, so every queue-rendered
              // Hybrid and Full Treatment was written to a slot NOTHING reads — the farmer came
              // back to a blank sheet while orphan entries piled up against the localStorage
              // quota. Sector/Phasing/restyle keys genuinely have no mode segment, so only
              // design-layer sheets append one.
              const savedMode: SheetOutputMode = isPolishedResult ? 'full' : 'hybrid';
              const saveKey = GLOSSY_FILTERS.some((x) => x.key === sheet.key)
                ? `producer:${styleKey}:${sheet.key}:${savedMode}${underlaySuffixRef.current}`
                : `producer:${styleKey}:${sheet.key}${underlaySuffixRef.current}`;
              try { saveGlossy(siteId, saveKey, record); } catch { /* cache full */ }
              // A one-sheet refresh must update the actual preview, not only append a gallery
              // thumbnail, but only while its original target remains open. Batch jobs still
              // collect every sheet without flickering the preview.
              if (job.sheets.length === 1) {
                // Full Treatment: leave lockedPolishStage set (still 'hybrid') so the progress
                // panel doesn't blink to nothing between this stage finishing and the polish stage's
                // own switch-to-polish effect setting it to 'polish' a moment later.
                if (!(polishAfterHybridRef.current && isHybridResult)) setLockedPolishStage(null);
                if (handoffTargetIsCurrent) {
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
              // Only Full Treatment's own Hybrid stage can later need amending (see
              // hybridGalleryIdRef above) — a plain Hybrid-only save has no polish stage to reject.
              if (isHybridResult && polishAfterHybridRef.current) hybridGalleryIdRef.current = lastAssembledGalleryId;
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
            setHybridHandoffReady(false);
            setLockedPolishStage(null);
            refreshPendingRef.current = false;
          } else if (serverDone > 0) {
            // The render succeeded and was paid for, but this device could not assemble it.
            setError(formatDesignTranslation(t('designGlossyAssembleError'), {
              detail: lastAssembleError ? ` (${lastAssembleError})` : '',
            }));
            setHybridHandoffReady(false);
            setLockedPolishStage(null);
            refreshPendingRef.current = false;
          } else {
            setError(job.error || firstErr || t('designGlossyRenderIncomplete'));
            setHybridHandoffReady(false);
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
        {/* SHEET — the plan set as a compact 4-up grid (Rory's mockup), canonical 01–09 order.
            Tapping a chip selects it in the CURRENT mode (AI by default); the "View non-AI exact
            version" link under the preview flips the same sheet to its exact render and back. */}
        {/* THE SHEET PICKER SHOWS ON BOTH MOUNTS, including the compact Preview overlay.
            Rory: "if i click preview map from any map section it should open the layer selector as
            well". Preview used to inherit one filter from the wizard step with no way off it, so
            the farmer had to close the overlay, walk to step 8 and start again just to see the
            next sheet. Earthworks now has its own wizard step and picker entry, so it remains
            reachable even though some earth-shaped elements are still offered from Water.
            What stays studio-only below is the money — the 5-sheet AI batch and the exact-all run
            are plan-set actions, not "look at this layer" actions. */}
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
        {/* WHICH PICTURE THE SHEETS SIT ON — always all three: the farmer's own drone/phone aerial,
            the satellite, and plain paper. The drone pill used to disappear on a site with no
            imported photo, which read as the option having been removed. It is always present now;
            without a photo it OPENS THE IMPORTER instead of selecting, because selecting it would
            render the satellite under a pill that says "Your photo". See lib/sheet-underlay.ts. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55 }}>
            Underlay
          </span>
          {underlayOptions.map((key) => {
            const needsImport = key === 'photo' && !hasFarmerPhoto(frameProp);
            const active = underlay === key && !needsImport;
            return (
              <button
                key={key}
                type="button"
                onClick={() => (needsImport ? onImportPhoto?.() : setUnderlay(key))}
                disabled={loading !== null || (needsImport && !onImportPhoto)}
                aria-pressed={active}
                title={needsImport ? 'Import a drone or phone aerial to draw your sheets on it' : undefined}
                style={{
                  padding: '6px 12px', borderRadius: 999,
                  border: `1px ${needsImport ? 'dashed' : 'solid'} ${active ? DARK : '#E2D8C4'}`,
                  background: active ? DARK : PAPER,
                  color: active ? PAPER : '#5C5040',
                  fontWeight: 700, fontSize: 12,
                  opacity: needsImport ? 0.75 : 1,
                  cursor: loading !== null || (needsImport && !onImportPhoto) ? 'default' : 'pointer',
                }}
              >
                {needsImport ? `+ ${UNDERLAY_LABEL.photo}` : UNDERLAY_LABEL[key]}
              </button>
            );
          })}
          <span style={{ fontSize: 10.5, opacity: 0.6 }}>
            {underlay === 'photo' && !hasFarmerPhoto(frameProp)
              ? 'tap “+ Your photo” to import a drone or phone aerial'
              : UNDERLAY_HINT[underlay]}
          </span>
        </div>
        {/* SHEET QUALITY — the option Rory asked for ("imagine when this is printed on even A3").
            Standard is the 1920px master everything has always used; High renders the same
            drawing at 2880px (~90 dpi on A2, ~128 on A3). It reloads on change: SCALE is read at
            module load and a half-drawn sheet must never span two scales. AI render costs do NOT
            change with this setting — every AI-bound bitmap is capped back to the standard width
            at the upload boundary (lib/sheet-scale.ts). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55 }}>
            Quality
          </span>
          {([[2, 'Standard'], [3, 'High — sharper print']] as const).map(([value, label]) => {
            const active = SCALE === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => { if (setSheetScale(value)) window.location.reload(); }}
                disabled={loading !== null}
                aria-pressed={active}
                style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${active ? DARK : '#E2D8C4'}`, background: active ? DARK : PAPER, color: active ? PAPER : '#5C5040', fontWeight: 700, fontSize: 12, cursor: loading !== null ? 'default' : 'pointer' }}
              >
                {label}
              </button>
            );
          })}
          <span style={{ fontSize: 10.5, opacity: 0.6 }}>
            {SCALE === 3 ? 'Exact sheets redraw sharper; AI render cost is unchanged' : 'High redraws exact sheets at 1.5× resolution for printing'}
          </span>
        </div>
        {/* HOW THIS SHEET NAMES ITS PLANTS — one or the other, never both. Shown only where the
            selected sheet actually has coded plants, so it appears on Planting and disappears on
            Site or Sector rather than sitting there doing nothing. See lib/plant-codes.ts. */}
        {sheetHasPlantCodes && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55 }}>
              Plant labels
            </span>
            {(['codes', 'names', 'onplant'] as const).map((key) => {
              const active = labelMode === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLabelMode(key)}
                  disabled={loading !== null}
                  aria-pressed={active}
                  style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${active ? DARK : '#E2D8C4'}`, background: active ? DARK : PAPER, color: active ? PAPER : '#5C5040', fontWeight: 700, fontSize: 12, cursor: loading !== null ? 'default' : 'pointer' }}
                >
                  {LABEL_MODE_LABEL[key]}
                </button>
              );
            })}
            <span style={{ fontSize: 10.5, opacity: 0.6 }}>{LABEL_MODE_HINT[labelMode]}</span>
          </div>
        )}
        {!compact && (
        <>
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
          <strong>{t('designGlossyChooseFinish')}</strong> {aiFinishesVisible ? t('designGlossyFinishHelp') : t('designGlossyFinishHelpExactOnly')}
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
            ? `Generate your ${filter === 'all' ? 'whole design' : GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map in the ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} style. ${engine === 'falgpt' ? (effectiveModelChrome ? 'gpt-image-2 paints the whole sheet with its own legend & labels. Renders in the background (~mins); it lands in your gallery.' : 'gpt-image-2 paints the map artwork in the background (~mins); exact framing, protected geometry, labels, legend, north arrow and scale are composited afterwards.') : 'Gemini paints the map artwork in the background (~mins); exact framing, protected geometry, labels, legend, north arrow and scale are composited afterwards. It lands in your gallery.'}`
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
                ? ' · Implementation & phasing (sheet 09)'
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
              true one-tap polish: switch modes and immediately start the geometry-locked queue —
              which is a PAID render, so while the finishes are shelved this direction is closed.
              Flipping BACK to exact from an older AI result stays available: that spends nothing,
              and a farmer looking at a sheet they already paid for must still be able to leave it. */}
          {selectedSheet && (aiFinishesVisible || mode !== 'exact') && (
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
        {/* Gemini note for the analytical sheets (01/02/09 in AI mode) — no Style, no engine. */}
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
              {enginePicker}

              {qualityPicker}

              {/* RETIRED — the Prompt-rewrite, Geometry Lock and AI-legend toggles used to live
                  here. Rory: "I even get confused every time; it's a layer of complexity I don't
                  want." They were also dishonest: Satellite Overlay overrides all three in code, so
                  on the recommended style they switched nothing at all. Behaviour is now a property
                  of the STYLE you choose — isModelChromeStyle() decides who letters the sheet, and
                  the state below keeps the defaults these toggles used to set. The legacy prompt
                  builders stay exported for a developer-level rollback, which is what they were
                  always for. */}

              {/* (The old "Analysis maps · Gemini" chip row is RETIRED — Rory. Sheets 01/02/09 in
                  AI mode still use the Gemini analysis path via applySheet; only the extra picker
                  row (incl. the sheet-less Opportunities map) is gone.) */}

              {/* Style ALL sheets — the AI batch (mockup naming). gpt-image-2 → background queue;
                  Gemini → synchronous. */}
              <div>
                <button
                  onClick={generateAllViaQueue}
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
                    ? 'Gemini renders in the background — cheaper per sheet; the sheets drop into your gallery when ready and you can keep working. (Print / Export always builds the exact plan set.)'
                    : 'gpt-image-2 renders in the background — sharpest result, a few minutes; the sheets drop into your gallery when ready and you can keep working. (Print / Export always builds the exact plan set.)'}
                </div>
              </div>
            </div>
          )}
        </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {/* On the compact Preview mount this is the ONLY place the money dials appear, because
              More options is hidden there — and the two buttons directly below them are the ones
              that spend real money. Engine decides WHICH account is charged and quality decides how
              much, so neither belongs a screen away from the button. Both also appear under More
              options on the full mount. */}
          {compact && selectedSheet && enginePicker}
          {compact && selectedSheet && qualityPicker}
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
            {aiFinishesVisible && (
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
            )}
            {aiFinishesVisible && (
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
            )}
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
                    ? `✨ ${resultImage ? 'Regenerate' : 'Generate'} this sheet — ${PRODUCER_STYLES.find((s) => s.key === producerStyle)?.label} (background · ~mins)`
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
            // FIXED, NOT ABSOLUTE. `inset: 0` on an absolute box covers the nearest positioned
            // ancestor, and that is the whole Studio — which is several screens tall. So the panel's
            // maxHeight of 90% meant 90% of the PAGE, and its bottom (the storage note, Clear all,
            // and now the export bar) sat below the fold with no way to scroll to it: the modal
            // itself was the thing that had run off the screen, not its contents.
            position: 'fixed',
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
              <span style={{ fontSize: 14, fontWeight: 700, color: '#9E5C08' }}>
                {exportMode
                  ? `${exportSel.size} selected`
                  : `🖼 ${formatDesignTranslation(t('designGlossySavedMaps'), { count: gallery.length })}`}
              </span>
              {!galleryViewItem && gallery.length > 0 && (
                <button
                  onClick={() => {
                    setExportMode((on) => !on);
                    setExportSel(new Set());
                  }}
                  style={{ marginLeft: 'auto', padding: '5px 11px', borderRadius: 9, background: exportMode ? GREEN : '#EDE7DB', border: `1px solid ${exportMode ? GREEN : '#E2D8C4'}`, color: exportMode ? PAPER : '#5C5040', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {exportMode ? 'Cancel' : 'Select'}
                </button>
              )}
              <button
                onClick={() => { setGalleryOpen(false); setGalleryViewId(null); setGalleryZoomOpen(false); setExportMode(false); setExportSel(new Set()); }}
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
                    {/* While the full-screen overlay is up, this image is behind a 94%-opaque
                        backdrop and cannot be seen — but it is still mounted, so the browser holds
                        a SECOND decode of the same full-resolution sheet. Showing the thumbnail
                        here for that moment halves the peak cost of the expand, and nothing on
                        screen changes; the overlay is what the farmer is looking at. Falls back to
                        the full image when a legacy sheet has no thumbnail yet. */}
                    <img
                      src={galleryZoomOpen
                        ? (galleryViewItem.thumb ?? galleryViewImage ?? galleryViewItem.image ?? '')
                        : (galleryViewImage ?? galleryViewItem.thumb ?? galleryViewItem.image ?? '')}
                      alt={galleryViewItem.label}
                      style={{ width: '100%', borderRadius: 12, border: '1px solid #E2D8C4', display: 'block' }}
                    />
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
                      href={galleryViewImage ?? galleryViewItem.image ?? galleryViewItem.thumb ?? '#'}
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
                            const shareSrc = galleryViewImage ?? galleryViewItem.image ?? galleryViewItem.thumb;
                            if (!shareSrc) return;
                            const blob = await (await fetch(shareSrc)).blob();
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
                            // In select mode the tile PICKS instead of opening. One control, two
                            // jobs, decided by the mode — rather than a second invisible hit area
                            // over a 100px thumbnail, which on a phone is a coin toss.
                            if (exportMode) {
                              setExportSel((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.id)) next.delete(g.id);
                                else next.add(g.id);
                                return next;
                              });
                              return;
                            }
                            setGalleryViewId(g.id);
                            setGalleryZoomOpen(true);
                          }}
                          // The sheet name alone is ambiguous here: Full Treatment saves three
                          // entries for one sheet, so three tiles all announce "Water". Screen
                          // reader users hit the same wall Rory did, with no thumbnail to fall
                          // back on, so the provenance goes in the label too — full words, not
                          // the chip's abbreviation.
                          aria-label={
                            exportMode
                              ? `${exportSel.has(g.id) ? 'Deselect' : 'Select'} ${g.label}`
                              : formatDesignTranslation(t('designGlossyOpenResult'), {
                                  label: g.label,
                                  result: galleryResultBadge(g),
                                })
                          }
                          aria-pressed={exportMode ? exportSel.has(g.id) : undefined}
                          style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
                        >
                          {/* NO FULL-RESOLUTION FALLBACK IN THE GRID. `g.thumb ?? g.image` looks
                              harmless — one tile, one image — but it is per-tile: a farmer whose
                              sheets predate thumbnails had EVERY tile pointing at a 1-3 MB PNG
                              data URL, decoding ~10 MB apiece, three-across on a phone. That is
                              the whole reason makeGalleryThumbnail was written, still reachable
                              through its own fallback.
                              The backfill above fills these in one at a time, so the placeholder
                              is what a legacy sheet shows for a second or two on first open. A
                              tile that says what it is beats a tile that costs 10 MB to draw. */}
                          {g.thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={g.thumb} alt={g.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <span
                              aria-hidden
                              style={{
                                display: 'flex', width: '100%', height: '100%', alignItems: 'center',
                                justifyContent: 'center', padding: 6, textAlign: 'center',
                                background: '#EDE7DB', color: '#9A8268', fontSize: 10, fontWeight: 700,
                                lineHeight: 1.25,
                              }}
                            >
                              {g.label}
                            </span>
                          )}
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
                          {exportMode && (
                            <span
                              aria-hidden
                              style={{ position: 'absolute', inset: 0, background: exportSel.has(g.id) ? 'rgba(47,109,58,0.32)' : 'rgba(20,16,10,0.18)', pointerEvents: 'none' }}
                            />
                          )}
                        </button>
                        {/* The tick sits where the delete button was, so the corner a farmer
                            already reaches for is the corner that answers in select mode. */}
                        {exportMode ? (
                          <span
                            aria-hidden
                            style={{ position: 'absolute', top: 4, right: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: exportSel.has(g.id) ? GREEN : 'rgba(255,253,244,0.85)', border: `2px solid ${exportSel.has(g.id) ? PAPER : 'rgba(92,80,64,0.5)'}`, color: PAPER, boxShadow: '0 1px 4px rgba(20,16,10,0.4)', pointerEvents: 'none' }}
                          >
                            {exportSel.has(g.id) && <Check size={14} strokeWidth={3.5} />}
                          </span>
                        ) : (
                          <button
                            onClick={() => removeGallery(g.id)}
                            aria-label={formatDesignTranslation(t('designGlossyDeleteNamed'), { label: g.label })}
                            style={{ position: 'absolute', top: 4, right: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(181,58,58,0.92)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', cursor: 'pointer', boxShadow: '0 1px 4px rgba(20,16,10,0.4)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {exportMode && (
                    // STICKY, because the grid is as long as the farmer's history. With 30-odd
                    // saved sheets the controls sat below all of them: pick two tiles at the top,
                    // then scroll past everything you did not pick to find Download. The bar is
                    // the point of the mode, so it stays on screen for as long as the mode does.
                    <div style={{ position: 'sticky', bottom: 0, zIndex: 1, display: 'flex', flexDirection: 'column', gap: 9, padding: 11, borderRadius: 12, background: '#F4EEE1', border: '1px solid #E2D8C4', boxShadow: '0 -6px 18px rgba(20,16,10,0.13)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', color: '#8A7B64', textTransform: 'uppercase' }}>Format</span>
                        {(['jpeg', 'png', 'pdf'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setExportFormat(f)}
                            aria-pressed={exportFormat === f}
                            style={{ padding: '5px 11px', borderRadius: 999, background: exportFormat === f ? DARK : PAPER, border: `1px solid ${exportFormat === f ? DARK : '#E2D8C4'}`, color: exportFormat === f ? PAPER : '#5C5040', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          >
                            {f === 'jpeg' ? 'JPEG' : f === 'png' ? 'PNG' : 'PDF'}
                          </button>
                        ))}
                        <span style={{ fontSize: 10.5, color: '#8A7B64' }}>
                          {/* Says what the choice DOES, because "PDF" only means "one file" to
                              someone who already knows that, and it is the whole reason to pick it. */}
                          {exportFormat === 'pdf'
                            ? exportSel.size > 1 ? `all ${exportSel.size} sheets in one file` : 'one document'
                            : exportFormat === 'png' ? 'lossless — bigger files' : 'smallest — best for WhatsApp'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', color: '#8A7B64', textTransform: 'uppercase' }}>Quality</span>
                        {(['high', 'medium', 'low'] as const).map((q) => (
                          <button
                            key={q}
                            onClick={() => setExportQuality(q)}
                            aria-pressed={exportQuality === q}
                            style={{ padding: '5px 11px', borderRadius: 999, background: exportQuality === q ? DARK : PAPER, border: `1px solid ${exportQuality === q ? DARK : '#E2D8C4'}`, color: exportQuality === q ? PAPER : '#5C5040', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                          >
                            {SHEET_EXPORT_PROFILES[q].label}
                          </button>
                        ))}
                        <span style={{ fontSize: 10.5, color: '#8A7B64' }}>{SHEET_EXPORT_PROFILES[exportQuality].hint}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => void exportSelection('download')}
                          disabled={exportSel.size === 0 || exportBusy}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, background: exportSel.size && !exportBusy ? GREEN : '#CFC6B4', color: PAPER, border: 'none', fontWeight: 700, fontSize: 13, cursor: exportSel.size && !exportBusy ? 'pointer' : 'default' }}
                        >
                          <Download size={15} /> {exportBusy ? 'Preparing…' : `Download${exportSel.size ? ` (${exportSel.size})` : ''}`}
                        </button>
                        {typeof navigator !== 'undefined' && 'share' in navigator && (
                          <button
                            onClick={() => void exportSelection('share')}
                            disabled={exportSel.size === 0 || exportBusy}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, background: 'transparent', border: `2px solid ${exportSel.size && !exportBusy ? GREEN : '#CFC6B4'}`, color: exportSel.size && !exportBusy ? GREEN : '#9A8268', fontWeight: 700, fontSize: 13, cursor: exportSel.size && !exportBusy ? 'pointer' : 'default' }}
                          >
                            <Share2 size={15} /> {t('designShare')}
                          </button>
                        )}
                        <button
                          onClick={() => setExportSel(new Set(exportSel.size === gallery.length ? [] : gallery.map((g) => g.id)))}
                          style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: 12, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040', fontWeight: 700, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {exportSel.size === gallery.length ? 'Select none' : 'Select all'}
                        </button>
                      </div>
                    </div>
                  )}
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
            src={galleryViewImage ?? galleryViewItem.thumb ?? galleryViewItem.image ?? ''}
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
