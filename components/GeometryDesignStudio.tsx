'use client';

import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Compass,
  Download,
  Droplets,
  FileDown,
  FileText,
  Layers3,
  Lock,
  LockOpen,
  Map as MapIcon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { Geometry, Position } from 'geojson';
import {
  designSiteIdFromLocation,
  emptyDesignStudioState,
  formatDesignArea,
  generateGeometryDesignPlan,
  getDesignLayerColor,
  getDesignLayerTypeLabel,
  loadDesignStudioState,
  mergeFarmShapesIntoDesignState,
  saveDesignStudioState,
  type DesignLayer,
  type DesignLayerType,
  type DesignPlanSection,
  type DesignStudioState,
} from '@/lib/design-studio';
import { MAP_STATE_EVENT, readLocalFarmShapes } from '@/lib/map-sync';
import type { LocationData } from '@/lib/types';
import { loadSurvey } from '@/lib/site-survey';
import { getSiteEvidence } from '@/lib/site-evidence';
import { loadSiteElements, getElementMeta, type SiteElement } from '@/lib/site-elements';
import {
  loadCanvasState,
  makeMercatorUnprojector,
  DESIGN_CANVAS_CHANGED_EVENT,
  type DesignCanvasState,
  type LineShape,
} from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, ZONE_COLORS, ZONE_KEY } from '@/lib/design-elements';
import { reportId } from '@/lib/saved-reports';
import { buildSkeletonReportDoc, type MapRef, type ImplementationPhase } from '@/lib/report-doc';
import ReportDocView from '@/components/ReportDocView';
import HybridRender from '@/components/HybridRender';
import polygonClipping from 'polygon-clipping';

// ── Contract types (kept in sync with /api/design-plan) ──────────────────────

type AnchorHint =
  | 'house'
  | 'near-house'
  | 'existing-garden'
  | 'tree-belt'
  | 'open-north'
  | 'open-south'
  | 'open-east'
  | 'open-west'
  | 'edges';

interface DesignPlanAI {
  summary: string;
  zones: Array<{
    n: 0 | 1 | 2 | 3 | 4 | 5;
    title: string;
    items: string[];
    note: string;
    anchor: AnchorHint;
  }>;
  water: Array<{
    kind: 'runoff' | 'infiltrate' | 'harvest';
    note: string;
    from: 'house' | 'high' | 'garden';
    to: 'low' | 'garden' | 'boundary';
  }>;
  access: Array<{ kind: 'vehicle' | 'foot'; note: string }>;
  opportunities: Array<{ title: string; note: string; anchor: AnchorHint }>;
  notes: string;
}

// Deterministic, INSTANT permaculture plan built locally from the locked features —
// so the design always draws immediately (the AI route is slow on serverless and must
// never block the map). The AI plan, if it returns, enriches/replaces this.
function buildLocalPlan(
  features: { layerType: string; name: string }[],
  site: { biome?: string; rainfallMm?: number; soilTexture?: string },
): DesignPlanAI {
  const has = (t: string) => features.some((f) => f.layerType === t);
  const zones: DesignPlanAI['zones'] = [
    { n: 0, title: 'Zone 0 · House', items: ['Roof catchment', 'Rainwater harvesting'], note: 'The home and the ground right around it.', anchor: 'house' },
    { n: 1, title: 'Zone 1 · Daily use', items: ['Herbs', 'Kitchen garden', 'Compost', 'Nursery'], note: 'What you touch every day — keep it by the door.', anchor: 'near-house' },
    { n: 2, title: 'Zone 2 · Intensive production', items: ['Vegetable beds', 'Small livestock'], note: has('cultivation') ? 'Your existing vegetable garden — main food beds.' : 'Main vegetable beds.', anchor: has('cultivation') ? 'existing-garden' : 'open-north' },
    { n: 3, title: 'Zone 3 · Orchard / food forest', items: ['Fruit trees', 'Guilds', 'Nut trees'], note: 'Trees and perennials in open, sunny ground (north).', anchor: 'open-north' },
    { n: 4, title: 'Zone 4 · Low-care', items: ['Support species', 'Cut-and-come-again', 'Larger perennials'], note: 'Hardier plantings that need less attention.', anchor: 'open-east' },
    { n: 5, title: 'Zone 5 · Conservation / buffer', items: ['Tree belt', 'Wildlife', 'Windbreak'], note: 'Wild edges — privacy, wind and biodiversity.', anchor: has('tree_belt') ? 'tree-belt' : 'edges' },
  ];
  const water: DesignPlanAI['water'] = [
    { kind: 'harvest', from: 'house', to: 'garden', note: 'Roof water to tanks near the garden.' },
    { kind: 'runoff', from: 'high', to: 'low', note: 'Surface runoff follows the slope downhill.' },
    { kind: 'infiltrate', from: 'high', to: 'boundary', note: 'Swales on contour to slow, spread & sink water.' },
  ];
  const access: DesignPlanAI['access'] = [
    { kind: 'vehicle', note: 'Vehicle access along the existing driveway.' },
    { kind: 'foot', note: 'Footpath from the house to the garden.' },
  ];
  const opportunities: DesignPlanAI['opportunities'] = [
    { title: 'Orchard / food forest', note: 'Fruit & nut trees in the open sunny ground.', anchor: 'open-north' },
    { title: 'Compost & nursery', note: 'Set up near the kitchen and garden path.', anchor: 'near-house' },
  ];
  const rain = site.rainfallMm ? `${site.rainfallMm} mm/yr` : 'local rainfall';
  return {
    summary: `Geometry-first permaculture design for this ${site.biome ?? 'site'}. Zones are placed by how often you use each area — from the house outward.`,
    zones, water, access, opportunities,
    notes: `${site.biome ?? 'This region'} · ${rain} · ${site.soilTexture ?? 'mixed'} soil. Focus: food security, water capture, soil building, biodiversity. Figures are estimates — adjust on the ground.`,
  };
}

// ── Shared design brief ───────────────────────────────────────────────────────
// ONE canonical placement spec, derived from the same plan + anchors the SVG maps
// use. Fed identically into EVERY AI map prompt so planting/zones/water/phasing all
// express the SAME design (same positions, same species) instead of each improvising.

// Translate an anchor into a concrete spatial phrase that matches what the SVG draws.
// North is UP on the map, so 'open-north' = the top/north of the property.
function anchorToWords(a: AnchorHint): string {
  switch (a) {
    case 'house': return 'on and around the house';
    case 'near-house': return 'in the ring of ground immediately around the house (the daily-use band)';
    case 'existing-garden': return 'on the existing vegetable-garden ground (the orange-outlined area)';
    case 'tree-belt': return 'along the existing tree belt at the boundary edge';
    case 'open-north': return 'on the open sunny ground on the NORTH side (top of the map — best sun in the Southern Hemisphere)';
    case 'open-south': return 'on the open ground on the SOUTH side (bottom of the map)';
    case 'open-east': return 'on the open ground on the EAST side (right of the map)';
    case 'open-west': return 'on the open ground on the WEST side (left of the map)';
    case 'edges': return 'along the property edges / boundary buffer';
    default: return 'in an appropriate open area inside the boundary';
  }
}

// Canonical species / contents per zone — identical wording across all maps.
const ZONE_PLANTINGS: Record<number, string> = {
  0: 'the home — roof catchment, rainwater tanks, gutters',
  1: 'herbs (basil, coriander, chives), kitchen greens, compost bay, seedling nursery',
  2: 'intensive vegetable beds (tomatoes, beans, brassicas, leafy greens), pollinator strip',
  3: 'orchard / food forest — citrus, mango, avocado, guava, macadamia, with understorey + groundcover',
  4: 'support species (pigeon pea, comfrey, vetiver), hardy perennials, mulch-bank plants',
  5: 'windbreak + indigenous biodiversity buffer (native trees & shrubs)',
};

interface DesignBrief {
  zones: Array<{ n: number; title: string; where: string; contents: string }>;
  water: string[];
  access: string[];
}

function buildDesignBrief(plan: DesignPlanAI): DesignBrief {
  return {
    zones: plan.zones.map((z) => ({
      n: z.n,
      title: z.title,
      where: anchorToWords(z.anchor),
      contents: ZONE_PLANTINGS[z.n] ?? z.items.join(', '),
    })),
    water: plan.water.map((w) => w.note),
    access: plan.access.map((a) => a.note),
  };
}

// ── Props / view types ────────────────────────────────────────────────────────

interface Props {
  locationData: LocationData | null;
  siteName?: string | null;
}

type MapView = 'base' | 'sector' | 'zone' | 'water' | 'design' | 'implementation';

// AI (Gemini) render themes — canonical 8-map pack.
type AiRenderLayer = 'overall' | 'base' | 'sector' | 'zone' | 'water' | 'opportunity' | 'planting' | 'implementation';

// Human-readable map-type label for the render frame title.
const AI_MAP_LABELS: Record<AiRenderLayer, string> = {
  overall: 'Full design map',
  base: 'Existing site map',
  sector: 'Sector analysis',
  zone: 'Zone map',
  water: 'Water map',
  opportunity: 'Opportunities map',
  planting: 'Planting design',
  implementation: 'Implementation plan',
};

// Views that render the overlay on the satellite photo + show the right rail.
const OVERLAY_VIEWS = new Set<MapView>(['sector', 'zone', 'water', 'design', 'implementation']);

// Implementation-phase palette (Phase 1 / 2 / 3).
const PHASE_COLORS: Record<number, string> = { 1: '#C0650A', 2: '#2F7A4A', 3: '#1A5A8A' };

// 16-point compass label → bearing (deg clockwise from North).
const COMPASS_BEARING: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
  S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
};

// Compass label → unit screen vector pointing in that bearing (north = -y, east = +x).
function bearingToDir(label: string | undefined): readonly [number, number] {
  const b = COMPASS_BEARING[(label ?? 'N').toUpperCase()] ?? 0;
  const r = (b * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
}

// Inverse of bearingToDir: a normalised [0..1] position relative to the boundary centroid
// (0.5, 0.5) → an 8-point compass direction ("N"/"NE"/"E"/...). Used to phrase a short,
// plain-English locationHint for AI prompts (e.g. "near the house, NE side").
const COMPASS_8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
function compass8FromNormPos(nx: number, ny: number): string {
  const dx = nx - 0.5;
  const dy = ny - 0.5; // screen space: +y is south/down
  if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) return 'centre';
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI; // bearing clockwise from north
  const idx = Math.round(((deg < 0 ? deg + 360 : deg) / 45)) % 8;
  return COMPASS_8[idx];
}

// Indicative slope from the coarse elevation grid (no DEM). Everything derived from
// this is rendered DASHED + captioned, and suppressed when the slope is ~flat.
function slopeIndicative(elev: { slopeDeg?: number; aspectDeg?: number } | undefined) {
  const slopeDeg = elev?.slopeDeg ?? 0;
  const usable = slopeDeg > 0.5 && elev?.aspectDeg != null;
  const aspect = elev?.aspectDeg ?? 0; // direction the slope FACES (downhill)
  const rad = (aspect * Math.PI) / 180;
  const downhillDir: readonly [number, number] = [Math.sin(rad), -Math.cos(rad)];
  const contourDir: readonly [number, number] = [downhillDir[1], -downhillDir[0]]; // perpendicular
  return { usable, slopeDeg, downhillDir, contourDir };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LAYER_TYPES: DesignLayerType[] = [
  'property_boundary',
  'cultivation',
  'water_body',
  'roof',
  'access',
  'tree_belt',
  'structure',
  'unknown',
];

const CARD_BORDER = 'rgba(98, 83, 61, 0.18)';
const PAPER = '#F7F0E4';
// Public pk.* token — used to fetch the Mapbox Static satellite tile behind the design.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const FILL_COLORS: Partial<Record<DesignLayerType, string>> = {
  water_body: 'rgba(78,166,216,0.22)',
  property_boundary: 'rgba(140,235,106,0.10)',
  cultivation: 'rgba(224,182,63,0.18)',
  roof: 'rgba(116,185,242,0.20)',
  access: 'rgba(217,145,51,0.16)',
  tree_belt: 'rgba(47,143,78,0.18)',
  structure: 'rgba(181,138,88,0.20)',
  unknown: 'rgba(185,170,142,0.14)',
};

// ── Geometry helpers ───────────────────────────────────────────────────────────

function collectPositions(geometry: Geometry | null | undefined): Position[] {
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(collectPositions);
    default:
      return [];
  }
}

function getBounds(layers: DesignLayer[]) {
  const coords = layers.flatMap((layer) => collectPositions(layer.geometry));
  if (coords.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const xs = coords.map((c) => c[0]).filter(Number.isFinite);
  const ys = coords.map((c) => c[1]).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function makeProjector(
  bounds: ReturnType<typeof getBounds>,
  width: number,
  height: number,
  pad: number,
) {
  // cos-lat correction so shapes aren't stretched horizontally
  const cosLat = Math.max(
    Math.cos(((bounds.minY + bounds.maxY) / 2) * (Math.PI / 180)),
    0.01,
  );
  const dx = Math.max((bounds.maxX - bounds.minX) * cosLat, 0.000001);
  const dy = Math.max(bounds.maxY - bounds.minY, 0.000001);
  const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy);
  const mapWidth = dx * scale;
  const mapHeight = dy * scale;
  const offsetX = (width - mapWidth) / 2;
  const offsetY = (height - mapHeight) / 2;

  return (coord: Position): readonly [number, number] => {
    const x = offsetX + (coord[0] - bounds.minX) * cosLat * scale;
    const y = offsetY + (bounds.maxY - coord[1]) * scale;
    return [
      Number.isFinite(x) ? x : width / 2,
      Number.isFinite(y) ? y : height / 2,
    ];
  };
}

// ── Satellite base: Web-Mercator helpers (match Mapbox Static tile exactly) ──
const TILE = 512;

function lngLatToWorld(lng: number, lat: number, zoom: number): [number, number] {
  const worldSize = TILE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * worldSize;
  const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
  return [x, y];
}

// Fractional zoom so the bbox fits inside (imgW x imgH) logical px, with breathing room.
function fitZoom(
  bounds: ReturnType<typeof getBounds>,
  imgW: number,
  imgH: number,
  padFrac = 0.76,
): { zoom: number; centerLng: number; centerLat: number } {
  const centerLng = (bounds.minX + bounds.maxX) / 2;
  const centerLat = (bounds.minY + bounds.maxY) / 2;
  const [x1, y1] = lngLatToWorld(bounds.minX, bounds.maxY, 0); // top-left
  const [x2, y2] = lngLatToWorld(bounds.maxX, bounds.minY, 0); // bottom-right
  const spanX = Math.max(Math.abs(x2 - x1), 1e-9);
  const spanY = Math.max(Math.abs(y2 - y1), 1e-9);
  const zoomX = Math.log2((imgW * padFrac) / spanX);
  const zoomY = Math.log2((imgH * padFrac) / spanY);
  let zoom = Math.min(zoomX, zoomY);
  zoom = Math.max(1, Math.min(zoom, 19.5)); // clamp into a sane satellite range
  return { zoom, centerLng, centerLat };
}

// Static Images API URL (center+zoom, satellite, no labels), logical px (<=1280), @2x.
function buildSatelliteUrl(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  token: string,
): string {
  const w = Math.min(Math.round(imgW), 1280);
  const h = Math.min(Math.round(imgH), 1280);
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${centerLng.toFixed(6)},${centerLat.toFixed(6)},${zoom.toFixed(4)},0,0/` +
    `${w}x${h}@2x?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`
  );
}

// Projector that lines up exactly with the static tile (center-relative Mercator).
function makeMercatorProjector(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  originX: number,
  originY: number,
) {
  const [cx, cy] = lngLatToWorld(centerLng, centerLat, zoom);
  return (coord: Position): readonly [number, number] => {
    const [wx, wy] = lngLatToWorld(coord[0], coord[1], zoom);
    const x = originX + imgW / 2 + (wx - cx);
    const y = originY + imgH / 2 + (wy - cy);
    return [
      Number.isFinite(x) ? x : originX + imgW / 2,
      Number.isFinite(y) ? y : originY + imgH / 2,
    ];
  };
}

async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox static ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('Could not read satellite image.'));
    fr.readAsDataURL(blob);
  });
}

// SHARED fit — called identically by the parent (to fetch) and GeometryPreview (to
// project), so the overlay can never drift from the photo. Mirrors the preview's
// visibleLayers/bounds/mapAreaW derivation.
function computeSatFit(layers: DesignLayer[], mapView: MapView) {
  const SVG_W = 960;
  const SVG_H = 640;
  const RAIL_W = 220;
  const mapAreaW = OVERLAY_VIEWS.has(mapView) ? SVG_W - RAIL_W - 16 : SVG_W;
  const drawable = layers.filter((l) => l.approved);
  const visible = drawable.length ? drawable : layers;
  const bounds = getBounds(visible);
  const imgX = 20;
  const imgY = 20;
  const imgW = mapAreaW - 40;
  const imgH = SVG_H - 40;
  const useSatellite =
    (OVERLAY_VIEWS.has(mapView) || mapView === 'base') &&
    !!MAPBOX_TOKEN &&
    visible.length > 0 &&
    Number.isFinite(bounds.minX) &&
    bounds.maxX - bounds.minX > 0 &&
    bounds.maxY - bounds.minY > 0;
  const fit = fitZoom(bounds, imgW, imgH);
  const url = useSatellite
    ? buildSatelliteUrl(fit.centerLng, fit.centerLat, fit.zoom, imgW, imgH, MAPBOX_TOKEN)
    : '';
  return { useSatellite, fit, imgX, imgY, imgW, imgH, url };
}

function ringToPath(
  ring: Position[],
  project: (c: Position) => readonly [number, number],
): string {
  if (!ring.length) return '';
  return (
    ring
      .map((c, i) => {
        const [x, y] = project(c);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

function lineToPath(
  line: Position[],
  project: (c: Position) => readonly [number, number],
): string {
  if (!line.length) return '';
  return line
    .map((c, i) => {
      const [x, y] = project(c);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function geometryToPaths(
  geometry: Geometry,
  project: (c: Position) => readonly [number, number],
): string[] {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates
        .map((ring) => ringToPath(ring, project))
        .filter(Boolean);
    case 'MultiPolygon':
      return geometry.coordinates
        .flatMap((poly) => poly.map((ring) => ringToPath(ring, project)))
        .filter(Boolean);
    case 'LineString':
      return [lineToPath(geometry.coordinates, project)].filter(Boolean);
    case 'MultiLineString':
      return geometry.coordinates
        .map((line) => lineToPath(line, project))
        .filter(Boolean);
    case 'GeometryCollection':
      return geometry.geometries.flatMap((child) =>
        geometryToPaths(child, project),
      );
    default:
      return [];
  }
}

function layerCentroid(
  layer: DesignLayer,
  project: (c: Position) => readonly [number, number],
  fallback: readonly [number, number],
): readonly [number, number] {
  const coords = collectPositions(layer.geometry);
  if (!coords.length) return fallback;
  const sum = coords.reduce<[number, number]>(
    (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
    [0, 0],
  );
  return project([sum[0] / coords.length, sum[1] / coords.length]);
}

// ── Polygon-clipping helpers (non-overlapping zone partition) ────────────────
// All ops happen in PIXEL space after projection, so half-planes/disks are simple.
type PcPair = [number, number];
type PcPoly = PcPair[][]; // [outerRing, ...holes]
type PcMulti = PcPoly[];

function geomToPixelMulti(
  geometry: Geometry,
  project: (c: Position) => readonly [number, number],
): PcMulti {
  const ringPx = (ring: Position[]): PcPair[] =>
    ring.map((c) => {
      const [x, y] = project(c);
      return [x, y] as PcPair;
    });
  switch (geometry.type) {
    case 'Polygon':
      return [geometry.coordinates.map(ringPx)];
    case 'MultiPolygon':
      return geometry.coordinates.map((poly) => poly.map(ringPx));
    case 'GeometryCollection':
      return geometry.geometries.flatMap((g) => geomToPixelMulti(g, project));
    default:
      return [];
  }
}

function multiToPaths(mp: PcMulti): string[] {
  return mp.map((poly) =>
    poly
      .map(
        (ring) =>
          ring
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
            .join(' ') + ' Z',
      )
      .join(' '),
  );
}

function ringSignedArea(ring: PcPair[]): number {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

// Centroid of the largest outer ring across the multipolygon (for badge placement).
function multiCentroid(mp: PcMulti): readonly [number, number] | null {
  let best: PcPair[] | null = null;
  let bestA = 0;
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const a = Math.abs(ringSignedArea(outer));
    if (a > bestA) {
      bestA = a;
      best = outer;
    }
  }
  if (!best) return null;
  let cx = 0;
  let cy = 0;
  let area = 0;
  for (let i = 0, n = best.length; i < n; i++) {
    const [x1, y1] = best[i];
    const [x2, y2] = best[(i + 1) % n];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    const sx = best.reduce((s, p) => s + p[0], 0) / best.length;
    const sy = best.reduce((s, p) => s + p[1], 0) / best.length;
    return [sx, sy];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

function diskPoly(cx: number, cy: number, r: number): PcPoly {
  const pts: PcPair[] = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return [pts];
}

function rectPoly(x0: number, y0: number, x1: number, y1: number): PcPoly {
  return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
}

// Wrap each boolean op so a degenerate input can never crash the render.
function safePc(fn: () => PcMulti): PcMulti {
  try {
    return fn();
  } catch {
    return [];
  }
}

function metersPerDegreeLon(latDeg: number): number {
  return 111_320 * Math.cos((latDeg * Math.PI) / 180);
}

function niceScaleMetres(rawM: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawM)));
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map(
    (v) => v * magnitude,
  );
  const target = rawM * 0.4;
  let best = candidates[0];
  for (const c of candidates) {
    if (c <= target) best = c;
  }
  return best;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'imbewu-design'
  );
}

// ── Anchor → pixel position resolver ─────────────────────────────────────────

function resolveAnchor(
  anchor: AnchorHint,
  layers: DesignLayer[],
  project: (c: Position) => readonly [number, number],
  boundsCenter: readonly [number, number],
  bboxPx: { minX: number; maxX: number; minY: number; maxY: number },
): readonly [number, number] {
  let houseLike = layers.find((l) => l.layerType === 'roof' || l.layerType === 'structure');
  if (!houseLike) {
    const candidates = layers.filter(
      (l) => l.layerType !== 'property_boundary' && l.layerType !== 'water_body' &&
             l.layerType !== 'access' && l.layerType !== 'tree_belt' && l.areaM2 > 0,
    );
    if (candidates.length > 0) houseLike = candidates.reduce((min, l) => l.areaM2 < min.areaM2 ? l : min);
  }
  const gardenLike = layers.find((l) => l.layerType === 'cultivation');
  const treeLike = layers.find((l) => l.layerType === 'tree_belt');

  const house = houseLike
    ? layerCentroid(houseLike, project, boundsCenter)
    : boundsCenter;
  const garden = gardenLike
    ? layerCentroid(gardenLike, project, boundsCenter)
    : boundsCenter;
  const tree = treeLike
    ? layerCentroid(treeLike, project, boundsCenter)
    : boundsCenter;

  const [cx, cy] = boundsCenter;
  const W = bboxPx.maxX - bboxPx.minX;
  const H = bboxPx.maxY - bboxPx.minY;

  switch (anchor) {
    case 'house':
      return house;
    case 'near-house': {
      // offset from house toward centre (garden side)
      const dx = cx - house[0];
      const dy = cy - house[1];
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      return [house[0] + (dx / len) * 60, house[1] + (dy / len) * 60];
    }
    case 'existing-garden':
      return garden;
    case 'tree-belt':
      return tree;
    case 'open-north':
      return [cx, bboxPx.minY + H * 0.2];
    case 'open-south':
      return [cx, bboxPx.maxY - H * 0.2];
    case 'open-east':
      return [bboxPx.maxX - W * 0.2, cy];
    case 'open-west':
      return [bboxPx.minX + W * 0.2, cy];
    case 'edges':
      return [bboxPx.minX + W * 0.15, cy];
    default:
      return boundsCenter;
  }
}

// ── Water arrow helpers ───────────────────────────────────────────────────────

function resolveWaterPoint(
  role: 'house' | 'high' | 'garden',
  layers: DesignLayer[],
  project: (c: Position) => readonly [number, number],
  boundsCenter: readonly [number, number],
  bboxPx: { minX: number; maxX: number; minY: number; maxY: number },
): readonly [number, number] {
  if (role === 'house') {
    let houseLike = layers.find((l) => l.layerType === 'roof' || l.layerType === 'structure');
    if (!houseLike) {
      const candidates = layers.filter(
        (l) => l.layerType !== 'property_boundary' && l.layerType !== 'water_body' &&
               l.layerType !== 'access' && l.layerType !== 'tree_belt' && l.areaM2 > 0,
      );
      if (candidates.length > 0) houseLike = candidates.reduce((min, l) => l.areaM2 < min.areaM2 ? l : min);
    }
    return houseLike
      ? layerCentroid(houseLike, project, boundsCenter)
      : boundsCenter;
  }
  if (role === 'garden') {
    const g = layers.find((l) => l.layerType === 'cultivation');
    return g ? layerCentroid(g, project, boundsCenter) : boundsCenter;
  }
  // 'high' → top of the bbox
  return [bboxPx.minX + (bboxPx.maxX - bboxPx.minX) / 2, bboxPx.minY + 30];
}

function resolveWaterTarget(
  role: 'low' | 'garden' | 'boundary',
  layers: DesignLayer[],
  project: (c: Position) => readonly [number, number],
  boundsCenter: readonly [number, number],
  bboxPx: { minX: number; maxX: number; minY: number; maxY: number },
): readonly [number, number] {
  if (role === 'garden') {
    const g = layers.find((l) => l.layerType === 'cultivation');
    return g ? layerCentroid(g, project, boundsCenter) : boundsCenter;
  }
  if (role === 'boundary') {
    return [bboxPx.minX + (bboxPx.maxX - bboxPx.minX) * 0.15, bboxPx.maxY - 40];
  }
  // 'low' → bottom of bbox
  return [bboxPx.minX + (bboxPx.maxX - bboxPx.minX) / 2, bboxPx.maxY - 30];
}

// ── SVG export ────────────────────────────────────────────────────────────────

// crop: when set, only this sub-rectangle (in SVG px) is captured — used to send the AI
// model the SATELLITE AREA ONLY (no legend rail, no paper border), so the model's output
// and our boundary-clip mask share one coordinate frame.
function svgToPngDataUrl(
  svg: SVGSVGElement,
  crop?: { x: number; y: number; w: number; h: number },
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const W = Number(svg.getAttribute('width')) || 960;
    const H = Number(svg.getAttribute('height')) || 620;
    const cx = crop?.x ?? 0;
    const cy = crop?.y ?? 0;
    const cw = crop?.w && crop.w > 0 ? crop.w : W;
    const ch = crop?.h && crop.h > 0 ? crop.h : H;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cw * 2;
      canvas.height = ch * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not prepare export canvas.'));
        return;
      }
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      // Shift the full SVG so (cx,cy) sits at the canvas origin; the canvas size crops the rest.
      ctx.translate(-cx, -cy);
      ctx.drawImage(image, 0, 0, W, H);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(mime, mime === 'image/jpeg' ? 0.88 : undefined));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the design map.'));
    };
    image.src = url;
  });
}

// ── AI clip frame ─────────────────────────────────────────────────────────────
// The boundary (and driveway) projected into the SATELLITE-AREA frame and normalised to
// [0..1], so HybridRender can hard-clip the AI render to the real traced boundary and
// redraw the driveway crisply — deterministic, regardless of what the model painted.
interface AiClipFrame {
  ring: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed: boolean; // true = traced as an area (polygon) → draw as a filled lane, not a dashed loop
  house: Array<[number, number]>; // roof/structure polygon (normalised) — protected by the gpt-image-2 mask
  aspect: number; // w / h of the satellite area
  elements: Array<{ type: string; icon: string; label: string; note?: string; x: number; y: number }>; // farmer-placed point elements (normalised [0..1])
}

function ringFromGeometry(geom: DesignLayer['geometry'] | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0] ?? [];
  return [];
}
function lineFromGeometry(geom: DesignLayer['geometry'] | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'LineString') return geom.coordinates ?? [];
  if (geom.type === 'MultiLineString') return geom.coordinates[0] ?? [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  return [];
}

function computeClipFrame(layers: DesignLayer[], elements: SiteElement[] = []): AiClipFrame | null {
  // Use the overlay fit (matches how every design map is rendered).
  const fit = computeSatFit(layers, 'design');
  if (!fit.useSatellite) return null;
  const boundary =
    layers.find((l) => l.layerType === 'property_boundary' && l.approved) ??
    layers.find((l) => l.layerType === 'property_boundary');
  if (!boundary) return null;
  const project = makeMercatorProjector(
    fit.fit.centerLng,
    fit.fit.centerLat,
    fit.fit.zoom,
    fit.imgW,
    fit.imgH,
    fit.imgX,
    fit.imgY,
  );
  const norm = (c: Position): [number, number] => {
    const [px, py] = project(c);
    return [(px - fit.imgX) / fit.imgW, (py - fit.imgY) / fit.imgH];
  };
  const ring = ringFromGeometry(boundary.geometry).map(norm);
  if (ring.length < 3) return null;
  const drive = layers.find((l) => l.layerType === 'access' && l.approved) ?? layers.find((l) => l.layerType === 'access');
  const driveway = drive ? lineFromGeometry(drive.geometry).map(norm) : [];
  const drivewayClosed = !!drive && (drive.geometry?.type === 'Polygon' || drive.geometry?.type === 'MultiPolygon');
  const houseLayer =
    layers.find((l) => (l.layerType === 'roof' || l.layerType === 'structure') && l.approved) ??
    layers.find((l) => l.layerType === 'roof' || l.layerType === 'structure');
  const house = houseLayer ? ringFromGeometry(houseLayer.geometry).map(norm) : [];
  const elementPoints = elements.map((el) => {
    const meta = getElementMeta(el.type);
    const [x, y] = norm([el.lon, el.lat]);
    return { type: el.type, icon: meta.icon, label: el.label ?? meta.label, note: el.note, x, y };
  });
  return { ring, driveway, drivewayClosed, house, aspect: fit.imgW / fit.imgH, elements: elementPoints };
}

// Build a PNG edit-mask for gpt-image-2 (OpenAI convention: TRANSPARENT = editable, OPAQUE
// = preserved). Editable = inside the boundary MINUS the house and driveway → the model only
// paints the open ground, leaving the real house/driveway/neighbours untouched. Must be the
// SAME pixel dimensions as the composite image we send. Returns a data URL, or null.
function buildEditMask(clip: AiClipFrame, pxW: number, pxH: number): string | null {
  if (clip.ring.length < 3 || pxW < 2 || pxH < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const path = (pts: Array<[number, number]>) => {
    ctx.beginPath();
    pts.forEach(([nx, ny], i) => {
      const x = nx * pxW, y = ny * pxH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };
  // 1) Preserve everything (fully opaque).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pxW, pxH);
  // 2) Make inside-the-boundary editable (erase to transparent).
  ctx.globalCompositeOperation = 'destination-out';
  path(clip.ring);
  ctx.fill();
  // 3) Re-preserve the house + driveway (opaque again).
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  if (clip.house.length >= 3) { path(clip.house); ctx.fill(); }
  if (clip.driveway.length >= 2) {
    if (clip.drivewayClosed) {
      path(clip.driveway);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(pxW * 0.05, 24);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      clip.driveway.forEach(([nx, ny], i) => {
        const x = nx * pxW, y = ny * pxH;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }
  // 4) Re-preserve each placed site element (tank/tap/borehole/etc) — a small circular
  // region around its position, so gpt-image-2 never repaints over it.
  if (clip.elements.length) {
    const r = Math.min(Math.max(pxW * 0.018, 24), 32); // ~24-32px radius scaled to pxW
    for (const el of clip.elements) {
      ctx.beginPath();
      ctx.arc(el.x * pxW, el.y * pxH, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas.toDataURL('image/png');
}

// Poll a fal queue job (gpt-image-2 async path) until the render is ready (~30–90s), or throw
// on failure/timeout. Shared by the full-render flow (runAiRender) and the touch-up flow
// (handleTouchUp) — SAME 45×3000ms polling loop and error messages either way.
async function pollFalRender(statusUrl: string, responseUrl: string): Promise<string> {
  let finalImage: string | undefined;
  for (let i = 0; i < 60 && !finalImage; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const pr = await fetch('/api/ai-render/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statusUrl, responseUrl }),
    });
    const pd: { image?: string; error?: string; detail?: string; pending?: boolean } = await pr.json().catch(() => ({}));
    if (pd.image) { finalImage = pd.image; break; }
    // Surface ANY non-ok poll response (even with no JSON body) instead of silently looping to a timeout.
    if (!pr.ok) throw new Error(pd.error ? `${pd.error}${pd.detail ? ` — ${pd.detail}` : ''}` : `Poll failed (HTTP ${pr.status})`);
    // otherwise still pending → keep polling
  }
  if (!finalImage) throw new Error('Timed out waiting for the render — try again.');
  return finalImage;
}

// ── Plan card (text side-panel) ───────────────────────────────────────────────

function PlanCard({
  title,
  sections,
  icon,
}: {
  title: string;
  sections: DesignPlanSection[];
  icon: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-3"
      style={{
        background: 'rgba(255,255,255,0.45)',
        border: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-7 h-7 rounded-xl flex items-center justify-center"
          style={{ background: '#E8DDC9', color: '#1F4D2B' }}
        >
          {icon}
        </span>
        <h4
          className="font-display font-semibold text-sm"
          style={{ color: '#20190F' }}
        >
          {title}
        </h4>
      </div>
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div
              className="text-xs font-display font-semibold"
              style={{ color: '#9E5C08' }}
            >
              {section.title}
            </div>
            <p
              className="text-xs font-display leading-relaxed"
              style={{ color: '#5C5040' }}
            >
              {section.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const buttonBase =
  'rounded-xl px-3 py-2 text-xs font-display font-semibold transition-all flex items-center justify-center gap-1.5';

// ── Main SVG preview component ────────────────────────────────────────────────

function GeometryPreview({
  layers,
  title,
  svgRef,
  locationData,
  mapView,
  showFill,
  aiPlan,
  satDataUrl,
  implementationPhases,
  siteElements,
  studioBuild,
}: {
  layers: DesignLayer[];
  title: string;
  hasPlan: boolean;
  svgRef: React.RefObject<SVGSVGElement>;
  locationData: LocationData | null;
  mapView: MapView;
  showFill: boolean;
  aiPlan: DesignPlanAI | null;
  satDataUrl: string | null;
  implementationPhases?: ImplementationPhase[];
  siteElements?: SiteElement[];
  studioBuild?: DesignCanvasState | null;
}) {
  const SVG_W = 960;
  const SVG_H = 640;
  // Right rail width for Design view
  const RAIL_W = 220;
  // Map area width changes in design view to make room for the rail
  const mapAreaW = OVERLAY_VIEWS.has(mapView) ? SVG_W - RAIL_W - 16 : SVG_W;

  const drawableLayers = layers.filter((l) => l.approved);
  const visibleLayers = drawableLayers.length ? drawableLayers : layers;
  const bounds = getBounds(visibleLayers);
  const PAD = 68;

  // Satellite base: when the photo has loaded, project with the matching Mercator
  // transform so traced geometry registers pixel-perfect on the imagery. Otherwise
  // fall back to the parchment projector (no token / load failed / not design view).
  const sat = computeSatFit(layers, mapView);
  const showSat = sat.useSatellite && !!satDataUrl;
  const project = showSat
    ? makeMercatorProjector(
        sat.fit.centerLng,
        sat.fit.centerLat,
        sat.fit.zoom,
        sat.imgW,
        sat.imgH,
        sat.imgX,
        sat.imgY,
      )
    : makeProjector(bounds, mapAreaW, SVG_H, PAD);

  // Boundary centroid (pixel)
  const boundary = visibleLayers.find((l) => l.layerType === 'property_boundary') ?? visibleLayers[0];
  const boundsCenter: readonly [number, number] = boundary
    ? layerCentroid(boundary, project, [mapAreaW / 2, SVG_H / 2])
    : [mapAreaW / 2, SVG_H / 2];

  // BBox of rendered geometry (pixel)
  const allPx = visibleLayers.flatMap((l) =>
    collectPositions(l.geometry).map((c) => project(c)),
  );
  const bboxPx =
    allPx.length > 0
      ? {
          minX: Math.min(...allPx.map((p) => p[0])),
          maxX: Math.max(...allPx.map((p) => p[0])),
          minY: Math.min(...allPx.map((p) => p[1])),
          maxY: Math.max(...allPx.map((p) => p[1])),
        }
      : { minX: PAD, maxX: mapAreaW - PAD, minY: PAD, maxY: SVG_H - PAD };

  // ── Scale bar ──────────────────────────────────────────────────────────────
  const midLatDeg = locationData?.lat ?? (bounds.minY + bounds.maxY) / 2;
  const lonSpanDeg = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const dx = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const dy = Math.max(bounds.maxY - bounds.minY, 0.000001);
  const renderW = mapAreaW - PAD * 2;
  const renderH = SVG_H - PAD * 2;
  const mapPixelWidth = Math.min(renderW, renderH * (dx / dy));
  const metersPerPixel = showSat
    ? (156543.03392 * Math.cos((sat.fit.centerLat * Math.PI) / 180)) / Math.pow(2, sat.fit.zoom)
    : (lonSpanDeg * metersPerDegreeLon(midLatDeg)) / mapPixelWidth;
  const scaleBarRawM = mapPixelWidth * metersPerPixel * 0.28;
  const scaleBarM = visibleLayers.length ? niceScaleMetres(scaleBarRawM) : 50;
  const scaleBarPx = scaleBarM / metersPerPixel;
  const scaleBarLabel =
    scaleBarM >= 1000
      ? `${(scaleBarM / 1000).toFixed(1)} km`
      : `${scaleBarM} m`;
  const scaleBarX = 52;
  const scaleBarY = SVG_H - 44;

  // ── Site data strip ────────────────────────────────────────────────────────
  const annualRainfall = locationData?.rainfall?.annual;
  const soilTexture = locationData?.soil?.textureClass;
  const minTemp = locationData?.climate?.minTemp;
  const maxTemp = locationData?.climate?.maxTemp;
  const elevation = locationData?.elevation?.elevation;
  const totalDesignedM2 = layers
    .filter((l) => l.approved && l.layerType !== 'water_body')
    .reduce((s, l) => s + l.areaM2, 0);
  const roofAreaM2 = layers
    .filter((l) => l.approved && l.layerType === 'roof')
    .reduce((s, l) => s + l.areaM2, 0);
  const roofHarvestKL =
    roofAreaM2 > 0 && annualRainfall != null && annualRainfall > 0
      ? Math.round((roofAreaM2 * annualRainfall * 0.8) / 1000)
      : null;
  const totalHa = totalDesignedM2 / 10_000;

  type DataRow = { label: string; value: string };
  const dataRows: DataRow[] = [];
  if (annualRainfall != null)
    dataRows.push({ label: 'Rainfall (est.)', value: `${Math.round(annualRainfall)} mm/yr` });
  if (soilTexture)
    dataRows.push({ label: 'Soil texture', value: soilTexture });
  if (minTemp != null && maxTemp != null)
    dataRows.push({ label: 'Temp range', value: `${Math.round(minTemp)}–${Math.round(maxTemp)} °C` });
  if (elevation != null)
    dataRows.push({ label: 'Elevation', value: `${Math.round(elevation)} m` });
  if (totalDesignedM2 > 0)
    dataRows.push({
      label: 'Designed area',
      value: totalHa >= 1 ? `${totalHa.toFixed(2)} ha` : `${Math.round(totalDesignedM2)} m²`,
    });
  if (roofHarvestKL != null)
    dataRows.push({ label: 'Roof harvest (est.)', value: `${roofHarvestKL.toLocaleString()} kL/yr` });

  // ── Legend (layer types) ───────────────────────────────────────────────────
  const presentTypes = Array.from(new Set(visibleLayers.map((l) => l.layerType)));
  const legendCols = Math.min(presentTypes.length, 3);
  const legendRows = Math.ceil(presentTypes.length / legendCols);
  const legendW = legendCols * 132 + 22;
  const legendH = 36 + legendRows * 26;
  // In design view legend goes above scale bar on left; in other views bottom-left
  const legendX = 52;
  const legendY = SVG_H - 52 - legendH;

  // North arrow (top-right of map area)
  const northX = mapAreaW - 106;
  const northY = 42;

  // ── View toggles ───────────────────────────────────────────────────────────
  const showZoneBadges = mapView === 'zone' || mapView === 'design';
  const showDesignElements = mapView === 'design';
  const showSectorPanel = mapView === 'sector';
  const showWater = mapView === 'water';
  const showImplementation = mapView === 'implementation';
  const showZoneKey = mapView === 'zone' || mapView === 'design';
  const slope = slopeIndicative(locationData?.elevation);
  const effectivePlan = buildLocalPlan(
    visibleLayers.map((l) => ({ layerType: l.layerType, name: l.name })),
    {
      biome: locationData?.biome?.name,
      rainfallMm: locationData?.rainfall?.annual ?? undefined,
      soilTexture: locationData?.soil?.textureClass ?? undefined,
    },
  );

  // ── Boundary path for clipPath (zone/design views) ─────────────────────────
  // Build an SVG path from the property_boundary ring (or all approved coords hull)
  const boundaryPathForClip: string = (() => {
    if (!showZoneBadges) return '';
    const boundaryLayer = visibleLayers.find((l) => l.layerType === 'property_boundary');
    const source = boundaryLayer ?? visibleLayers[0];
    if (!source) return '';
    const g = source.geometry;
    if (g.type === 'Polygon' && g.coordinates[0]) {
      return ringToPath(g.coordinates[0], project);
    }
    if (g.type === 'MultiPolygon' && g.coordinates[0]?.[0]) {
      return ringToPath(g.coordinates[0][0], project);
    }
    // Fallback: convex-ish rect from bboxPx
    const { minX, maxX, minY, maxY } = bboxPx;
    return `M ${minX} ${minY} L ${maxX} ${minY} L ${maxX} ${maxY} L ${minX} ${maxY} Z`;
  })();

  // ── Zone partition — non-overlapping polygons carved from the open space ─────
  // Existing features ARE their zone (0 house, 2 garden, 5 tree). The remaining
  // open space (boundary − features) is split by proximity/direction from the
  // house: zone 1 = near-house disk, zone 3 = north, zone 4 = east, zone 5 = the
  // rest at the edges. All clipped to the boundary, so zones never overlap or spill.
  const zonePartition: {
    paths: Record<number, string[]>;
    centroids: Record<number, readonly [number, number]>;
  } = (() => {
    const paths: Record<number, string[]> = {};
    const centroids: Record<number, readonly [number, number]> = {};
    if (!showZoneBadges) return { paths, centroids };
    const boundaryLayer =
      visibleLayers.find((l) => l.layerType === 'property_boundary') ?? visibleLayers[0];
    if (!boundaryLayer) return { paths, centroids };
    const boundaryMP = geomToPixelMulti(boundaryLayer.geometry, project);
    if (!boundaryMP.length) return { paths, centroids };

    const byType = (t: DesignLayerType) => visibleLayers.find((l) => l.layerType === t);
    // House detection: named keyword match first, then size-based fallback (smallest
    // non-boundary land polygon) so unrecognised or Afrikaans names still work.
    let houseLayer = byType('roof') ?? byType('structure');
    if (!houseLayer) {
      const candidates = visibleLayers.filter(
        (l) => l.layerType !== 'property_boundary' && l.layerType !== 'water_body' &&
               l.layerType !== 'access' && l.layerType !== 'tree_belt' && l.areaM2 > 0,
      );
      if (candidates.length > 0) {
        houseLayer = candidates.reduce((min, l) => l.areaM2 < min.areaM2 ? l : min);
      }
    }
    const gardenLayer = byType('cultivation');
    const treeLayer = byType('tree_belt');
    const waterLayer = byType('water_body');

    const houseMP = houseLayer ? geomToPixelMulti(houseLayer.geometry, project) : [];
    const gardenMP = gardenLayer ? geomToPixelMulti(gardenLayer.geometry, project) : [];
    const treeMP = treeLayer ? geomToPixelMulti(treeLayer.geometry, project) : [];
    const waterMP = waterLayer ? geomToPixelMulti(waterLayer.geometry, project) : [];

    // Open space = boundary minus the existing feature footprints.
    const obstacles = [houseMP, gardenMP, treeMP, waterMP].filter((m) => m.length);
    let open = boundaryMP;
    if (obstacles.length) {
      const merged = obstacles.length === 1 ? obstacles[0] : safePc(() => polygonClipping.union(obstacles[0], ...obstacles.slice(1)));
      const diff = merged.length ? safePc(() => polygonClipping.difference(boundaryMP, merged)) : boundaryMP;
      open = diff.length ? diff : boundaryMP;
    }

    const cx0 = (bboxPx.minX + bboxPx.maxX) / 2;
    const cy0 = (bboxPx.minY + bboxPx.maxY) / 2;
    const [hx, hy] = houseLayer
      ? layerCentroid(houseLayer, project, [cx0, cy0])
      : [cx0, cy0];
    const bboxW = bboxPx.maxX - bboxPx.minX;
    const bboxH = bboxPx.maxY - bboxPx.minY;
    const PAD = Math.max(bboxW, bboxH) * 4 + 2000;

    // Zone 1 — near-house disk ∩ open
    const disk1 = diskPoly(hx, hy, Math.min(bboxW, bboxH) * 0.3);
    const zone1 = safePc(() => polygonClipping.intersection(open, disk1));
    let rest = safePc(() => polygonClipping.difference(open, disk1));

    // Zone 3 — north of house (smaller screen-y = north) ∩ rest
    const northRect = rectPoly(bboxPx.minX - PAD, bboxPx.minY - PAD, bboxPx.maxX + PAD, hy);
    const zone3 = rest.length ? safePc(() => polygonClipping.intersection(rest, northRect)) : [];
    rest = rest.length ? safePc(() => polygonClipping.difference(rest, northRect)) : [];

    // Zone 4 — east of house (larger screen-x) ∩ rest
    const eastRect = rectPoly(hx, bboxPx.minY - PAD, bboxPx.maxX + PAD, bboxPx.maxY + PAD);
    const zone4 = rest.length ? safePc(() => polygonClipping.intersection(rest, eastRect)) : [];
    const zone5open = rest.length ? safePc(() => polygonClipping.difference(rest, eastRect)) : [];

    // Zone 5 — existing tree belt ∪ the remaining edge open space
    const z5parts = [treeMP, zone5open].filter((m) => m.length);
    const zone5 =
      z5parts.length === 0
        ? []
        : z5parts.length === 1
          ? z5parts[0]
          : safePc(() => polygonClipping.union(z5parts[0], ...z5parts.slice(1)));

    const byN: Record<number, PcMulti> = {
      0: houseMP,
      1: zone1,
      2: gardenMP,
      3: zone3,
      4: zone4,
      5: zone5,
    };
    for (const zone of effectivePlan.zones) {
      const mp = byN[zone.n] ?? [];
      if (!mp.length) continue;
      paths[zone.n] = multiToPaths(mp);
      const c = multiCentroid(mp);
      if (c) centroids[zone.n] = c;
    }
    return { paths, centroids };
  })();

  // ── Label de-collision state ────────────────────────────────────────────────
  // We compute placed-rect bookkeeping once during render.
  // Each call to placeLabel returns a possibly-nudged y offset.
  const placedRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  function placeLabel(cx: number, cy: number, textLen: number): number {
    const w = Math.min(textLen * 6 + 16, 210);
    const h = 18;
    const x0 = cx - w / 2;
    let y0 = cy - 9; // top of label pill
    const maxNudges = 6;
    const step = 16;
    for (let n = 0; n < maxNudges; n++) {
      const overlaps = placedRects.some(
        (r) =>
          x0 < r.x + r.w &&
          x0 + w > r.x &&
          y0 < r.y + r.h &&
          y0 + h > r.y,
      );
      if (!overlaps) break;
      // nudge down, or up if close to bottom
      if (y0 + h + step < SVG_H - 30) {
        y0 += step;
      } else {
        y0 -= step;
      }
    }
    placedRects.push({ x: x0, y: y0, w, h });
    return y0 + 9; // return centreY of the pill
  }

  // ── Zone badge positions (de-collided so 0/1/2 don't stack near the house) ──
  // Computed up front so on-map labels can be told to avoid the badges too.
  const badgePositions: Record<number, readonly [number, number]> = {};
  if (showZoneBadges) {
    const placed: Array<{ x: number; y: number }> = [];
    for (const zone of effectivePlan.zones) {
      let [bx, by] =
        zonePartition.centroids[zone.n] ??
        resolveAnchor(zone.anchor, visibleLayers, project, boundsCenter, bboxPx);
      for (let iter = 0; iter < 10; iter++) {
        const clash = placed.find((p) => Math.hypot(p.x - bx, p.y - by) < 36);
        if (!clash) break;
        const ang = Math.atan2(by - clash.y, bx - clash.x) || (iter * 1.1 + 0.4);
        bx = clash.x + Math.cos(ang) * 38;
        by = clash.y + Math.sin(ang) * 38;
      }
      placed.push({ x: bx, y: by });
      badgePositions[zone.n] = [bx, by];
    }
    // Seed the label-collision map with badge footprints so labels never sit on a badge.
    for (const p of placed) {
      placedRects.push({ x: p.x - 17, y: p.y - 17, w: 34, h: 34 });
    }
  }

  // ── Sector inset (Sector view — left side below data strip) ───────────────
  const sectorInsetX = mapAreaW - 192;
  const sectorInsetY = northY + 82;
  const sectorInsetW = 170;
  const sectorInsetH = 180;

  // ── Zone key panel (Zone view: right of north arrow; Design view: in rail) ─
  const zoneKeyX = mapAreaW - 192;
  const zoneKeyY = northY + 82;
  const zoneKeyW = 170;
  const zoneKeyItemH = 24;
  const zoneKeyH = 30 + ZONE_KEY.length * zoneKeyItemH;

  // VIEW_LABELS
  const VIEW_LABELS: Record<MapView, string> = {
    base: 'Base Map',
    sector: 'Sector Analysis',
    zone: 'Zone Map',
    water: 'Water & Hydrology',
    design: 'Permaculture Design',
    implementation: 'Implementation',
  };

  return (
    <svg
      ref={svgRef}
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      className="w-full h-auto rounded-2xl shadow-sm"
      role="img"
      aria-label={`${VIEW_LABELS[mapView]} — ImbewuField design map`}
    >
      <defs>
        <filter id="ps-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#2A1D10" floodOpacity="0.18" />
        </filter>
        <filter id="soft-glow" x="-15%" y="-30%" width="130%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Water arrow markers */}
        <marker id="arrow-runoff" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#3A8EC4" opacity="0.9" />
        </marker>
        <marker id="arrow-infiltrate" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#6BAED6" opacity="0.85" />
        </marker>
        <marker id="arrow-harvest" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#1565A4" opacity="0.9" />
        </marker>
        {/* Access arrow markers */}
        <marker id="arrow-vehicle" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#D4A24A" opacity="0.9" />
        </marker>
        <marker id="arrow-foot" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#C8B890" opacity="0.85" />
        </marker>
        {/* Sector / water / soil markers */}
        <marker id="arrow-wind" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#E08A2C" opacity="0.92" />
        </marker>
        <marker id="arrow-fire" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#C0392B" opacity="0.92" />
        </marker>
        <marker id="arrow-frost" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#9FD0E8" opacity="0.92" />
        </marker>
        <marker id="arrow-flood" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 Z" fill="#3A8EC4" opacity="0.95" />
        </marker>
        {/* Hatch pattern for suggested-area blobs */}
        <pattern id="hatch-soft" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#8B6A20" strokeWidth="1.2" opacity="0.18" />
        </pattern>
        {/* Boundary clip — zone area fills are clipped to the property outline */}
        {showZoneBadges && boundaryPathForClip && (
          <clipPath id="design-boundary-clip">
            <path d={boundaryPathForClip} />
          </clipPath>
        )}
        {/* Rounded-rect clip so the satellite photo keeps the parchment's soft corners */}
        {showSat && (
          <clipPath id="design-photo-clip">
            <rect x={sat.imgX} y={sat.imgY} width={sat.imgW} height={sat.imgH} rx="18" />
          </clipPath>
        )}
      </defs>

      {/* ── BACKGROUND ────────────────────────────────────────────────────── */}
      <rect width={SVG_W} height={SVG_H} rx="32" fill={PAPER} />
      {/* Inner parchment */}
      <rect
        x="20" y="20"
        width={SVG_W - 40} height={SVG_H - 40}
        rx="24"
        fill="#FAF5EA"
        stroke="#D4C4A0"
        strokeWidth="1.5"
      />
      {/* ── SATELLITE BASE (design view, when loaded) ───────────────────────── */}
      {showSat && satDataUrl && (
        <g clipPath="url(#design-photo-clip)">
          <image
            href={satDataUrl}
            x={sat.imgX}
            y={sat.imgY}
            width={sat.imgW}
            height={sat.imgH}
            preserveAspectRatio="xMidYMid slice"
          />
          {/* Gentle darken so light strokes & labels read over bright soil/sky */}
          <rect
            x={sat.imgX}
            y={sat.imgY}
            width={sat.imgW}
            height={sat.imgH}
            fill="#0B1A0B"
            opacity="0.16"
          />
        </g>
      )}
      {/* Very subtle contour lines (parchment fallback only — hidden over photo) */}
      {!showSat && (
        <g opacity="0.28">
          {Array.from({ length: 7 }).map((_, i) => (
            <path
              key={i}
              d={`M ${62 + i * 130} ${SVG_H - 30} C ${80 + i * 110} ${SVG_H * 0.65}, ${90 + i * 100} ${SVG_H * 0.38}, ${220 + i * 90} 54`}
              fill="none"
              stroke="#CEBF96"
              strokeWidth="1.8"
            />
          ))}
        </g>
      )}

      {/* ── TITLE BLOCK ───────────────────────────────────────────────────── */}
      {/* Over the photo, sit the title on a translucent dark card (like a real plan) */}

      {(() => {
        const titleCardW = Math.min(Math.max(title.length * 15 + 44, 240), mapAreaW - 80);
        return (
          <>
            {showSat && (
              <rect x="40" y="40" width={titleCardW} height="62" rx="14" fill="rgba(11,18,11,0.60)" />
            )}
            {/* Title bar rule — clipped to the title card width so it doesn't cut across the map */}
            <line x1="48" y1="96" x2={Math.min(40 + titleCardW - 8, mapAreaW - 48)} y2="96"
              stroke={showSat ? 'rgba(255,255,255,0.22)' : '#C4B48C'} strokeWidth="1" />
          </>
        );
      })()}
      <text
        x="52" y="66"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="800"
        fontSize="28"
        fill={showSat ? '#FFFFFF' : '#20190F'}
      >
        {title}
      </text>
      <text
        x="52" y="87"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="12"
        fill={showSat ? '#D9E8C9' : '#7B6A52'}
        letterSpacing="0.04em"
      >
        Permaculture Design Map · {VIEW_LABELS[mapView]}
      </text>

      {/* ── DATA STRIP ────────────────────────────────────────────────────── */}
      {dataRows.length > 0 && (
        <g>
          <rect
            x="52" y="104"
            width="212" height={26 + dataRows.length * 20}
            rx="10"
            fill="rgba(32,25,15,0.78)"
          />
          <text
            x="64" y="118"
            fontFamily="'Helvetica Neue', sans-serif"
            fontWeight="800"
            fontSize="9.5"
            fill="#F7C97E"
            letterSpacing="0.09em"
          >
            SITE DATA
          </text>
          {dataRows.map((row, i) => (
            <g key={row.label} transform={`translate(64 ${122 + i * 20})`}>
              <text x="0" y="12" fontFamily="sans-serif" fontSize="9.5" fill="#B9AA8E">{row.label}</text>
              <text
                x="148" y="12"
                textAnchor="end"
                fontFamily="sans-serif"
                fontWeight="700"
                fontSize="9.5"
                fill="#F4EDD8"
              >
                {row.value}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* ── EMPTY STATE ───────────────────────────────────────────────────── */}
      {visibleLayers.length === 0 ? (
        <g>
          <rect x="220" y="220" width="520" height="160" rx="24" fill="#EFE6D6" stroke="#D8C9AC" />
          <text x="480" y="286" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="800" fontSize="22" fill="#20190F">Draw land first</text>
          <text x="480" y="322" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fill="#7B6A52">Add a boundary or shape on the map, then refresh this studio.</text>
        </g>
      ) : (
        <>
          {/* ── GEOMETRY PATHS (always drawn in all views) ─────────────── */}
          {visibleLayers.map((layer) => {
            const paths = geometryToPaths(layer.geometry, project);
            const stroke = getDesignLayerColor(layer.layerType);
            const fill = layer.geometryType.includes('Line')
              ? 'none'
              : showFill
                ? (FILL_COLORS[layer.layerType] ?? 'none')
                : 'none';
            const strokeWidth =
              layer.layerType === 'property_boundary' ? 6 : 3;
            const dash =
              !layer.locked && layer.approved
                ? '10,5'
                : undefined;
            return (
              <g
                key={layer.id}
                filter={layer.locked ? 'url(#ps-shadow)' : undefined}
                opacity={layer.approved ? 1 : 0.35}
              >
                {paths.map((path, idx) => (
                  <path
                    key={`${layer.id}-${idx}`}
                    d={path}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    strokeDasharray={dash}
                  />
                ))}
                {layer.geometry.type === 'Point' && (() => {
                  const [px, py] = project(layer.geometry.coordinates);
                  return (
                    <circle cx={px} cy={py} r="11" fill={stroke} stroke="#fff" strokeWidth="3.5" />
                  );
                })()}
              </g>
            );
          })}

          {/* ── FEATURE LABELS (always shown — BASE: only these) ─────────── */}
          {visibleLayers.map((layer) => {
            // Over the photo, drop the property-boundary's centre label — its huge
            // centroid pill stacks on the house; the green outline + legend show it.
            if (layer.layerType === 'property_boundary') return null;
            const [cx, cy] = layerCentroid(layer, project, [SVG_W / 2, SVG_H / 2]);
            const text = layer.name.length > 26 ? `${layer.name.slice(0, 25)}…` : layer.name;
            const area = layer.areaLabel !== 'area unknown' ? ` · ${layer.areaLabel}` : '';
            const full = `${text}${area}`;
            const pillW = Math.min(Math.max(full.length * 6.2 + 16, 52), 210);
            // De-collide: placeLabel returns the nudged centreY for the pill
            const labelCy = placeLabel(cx, cy, full.length);
            return (
              <g key={`lbl-${layer.id}`} opacity={layer.approved ? 1 : 0.52}>
                <rect
                  x={cx - pillW / 2} y={labelCy - 9}
                  width={pillW} height={18}
                  rx="9"
                  fill="rgba(32,25,15,0.74)"
                />
                <text
                  x={cx} y={labelCy + 5}
                  textAnchor="middle"
                  fontFamily="'Helvetica Neue', sans-serif"
                  fontSize="9"
                  fontWeight="600"
                  fill="#F4EDD8"
                >
                  {full.length > 30 ? `${full.slice(0, 29)}…` : full}
                </text>
              </g>
            );
          })}

          {/* ── SITE ELEMENTS (farmer-placed: tanks/taps/boreholes/etc) ─────── */}
          {siteElements?.map((el) => {
            const meta = getElementMeta(el.type);
            const [ex, ey] = project([el.lon, el.lat]);
            const label = el.label ?? meta.label;
            const text = label.length > 22 ? `${label.slice(0, 21)}…` : label;
            const pillW = Math.min(Math.max(text.length * 6 + 18, 26), 170);
            const labelCy = placeLabel(ex, ey + 16, text.length);
            return (
              <g key={`elem-${el.id}`}>
                <circle cx={ex} cy={ey} r="10" fill={meta.color} stroke="#fff" strokeWidth="2.5" />
                <text x={ex} y={ey + 4} textAnchor="middle" fontSize="11">{meta.icon}</text>
                <rect
                  x={ex - pillW / 2} y={labelCy - 8}
                  width={pillW} height={16}
                  rx="8"
                  fill="rgba(32,25,15,0.74)"
                />
                <text
                  x={ex} y={labelCy + 4}
                  textAnchor="middle"
                  fontFamily="'Helvetica Neue', sans-serif"
                  fontSize="8.5"
                  fontWeight="600"
                  fill="#F4EDD8"
                >
                  {text}
                </text>
              </g>
            );
          })}

          {/* ── STUDIO BUILD (Design Studio /design canvas: placed items, drawn ─ */}
          {/* zones, lines) — projected from the studio's own normalised frame  ─ */}
          {/* into lng/lat, then through this map's own `project`, so the       ─ */}
          {/* studio build always registers correctly on this SVG/photo.       ─ */}
          {(mapView === 'design' || mapView === 'zone' || mapView === 'water') &&
            studioBuild &&
            studioBuild.items.length + studioBuild.zones.length + studioBuild.lines.length > 0 &&
            (() => {
              const f = studioBuild.frame;
              const unproj = makeMercatorUnprojector(f.centerLng, f.centerLat, f.zoom, f.imgW, f.imgH);
              const toPx = (n: [number, number]): readonly [number, number] => project(unproj(n));
              // Approximate metres→px scale at this map's centre (same trick used
              // elsewhere in this file: project two points 0.001° apart in latitude).
              const [, pyA] = project([f.centerLng, f.centerLat]);
              const [, pyB] = project([f.centerLng, f.centerLat + 0.001]);
              const pxPerM = Math.abs(pyA - pyB) / 111.32 || 0;

              const lineStyle: Record<LineShape['kind'], { color: string; dash?: string; width: number }> = {
                swale: { color: '#4EA6D8', dash: '6,4', width: 2.5 },
                fence: { color: '#8A7860', dash: '3,3', width: 1.6 },
                path: { color: '#C8B890', dash: '4,3', width: 2 },
                pipe: { color: '#3A8EC4', width: 2 },
                drip: { color: '#3A8EC4', dash: '2,3', width: 1.6 },
                windbreak: { color: '#2F7A4A', dash: '8,3', width: 2.5 },
                // Violet dashed — the reclaimed-water pipe convention, and deliberately more
                // saturated than the fence so the two never read as the same line.
                greywater: { color: '#8E44AD', dash: '7,4', width: 2.2 },
              };

              return (
                <g>
                  {/* Zones — soft washes with dashed border + numbered badge */}
                  {studioBuild.zones.map((z) => {
                    if (z.points.length < 3) return null;
                    const color = ZONE_COLORS[z.zone] ?? '#555';
                    const pxPoints = z.points.map(toPx);
                    const d = `M ${pxPoints.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
                    const cx = pxPoints.reduce((s, p) => s + p[0], 0) / pxPoints.length;
                    const cy = pxPoints.reduce((s, p) => s + p[1], 0) / pxPoints.length;
                    return (
                      <g key={`studio-zone-${z.id}`}>
                        <path
                          d={d}
                          fill={color}
                          fillOpacity={0.16}
                          stroke={color}
                          strokeWidth={1.6}
                          strokeDasharray="6,4"
                        />
                        <circle cx={cx} cy={cy} r="9" fill={color} stroke="#FAF5EA" strokeWidth="2" />
                        <text
                          x={cx} y={cy + 3.5}
                          textAnchor="middle"
                          fontFamily="sans-serif"
                          fontSize="9"
                          fontWeight="900"
                          fill="#FFFFFF"
                        >
                          {z.zone}
                        </text>
                      </g>
                    );
                  })}

                  {/* Lines — swales/fences/paths/pipes/drip/windbreak, styled by kind */}
                  {studioBuild.lines.map((l) => {
                    if (l.points.length < 2) return null;
                    const style = lineStyle[l.kind] ?? { color: '#8A7860', width: 2 };
                    const pxPoints = l.points.map(toPx);
                    const d = `M ${pxPoints.map(([x, y]) => `${x} ${y}`).join(' L ')}`;
                    return (
                      <path
                        key={`studio-line-${l.id}`}
                        d={d}
                        fill="none"
                        stroke={style.color}
                        strokeWidth={style.width}
                        strokeDasharray={style.dash}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  })}

                  {/* Items — icon discs, matching the SITE ELEMENTS marker style above */}
                  {studioBuild.items.map((item) => {
                    const def = ELEMENTS_BY_ID[item.defId];
                    if (!def) return null;
                    const [ix, iy] = toPx([item.x, item.y]);
                    const wM = item.wM ?? def.wM;
                    const rPx = pxPerM > 0 ? Math.max((wM * pxPerM) / 2, 6) : 10;
                    const label = item.label ?? def.name;
                    const text = label.length > 22 ? `${label.slice(0, 21)}…` : label;
                    const pillW = Math.min(Math.max(text.length * 6 + 18, 26), 170);
                    const labelCy = placeLabel(ix, iy + rPx + 12, text.length);
                    return (
                      <g key={`studio-item-${item.id}`}>
                        <circle cx={ix} cy={iy} r={rPx} fill={def.color} stroke="#fff" strokeWidth="2.5" />
                        <text x={ix} y={iy + 4} textAnchor="middle" fontSize="11">{def.icon}</text>
                        <rect
                          x={ix - pillW / 2} y={labelCy - 8}
                          width={pillW} height={16}
                          rx="8"
                          fill="rgba(32,25,15,0.74)"
                        />
                        <text
                          x={ix} y={labelCy + 4}
                          textAnchor="middle"
                          fontFamily="'Helvetica Neue', sans-serif"
                          fontSize="8.5"
                          fontWeight="600"
                          fill="#F4EDD8"
                        >
                          {text}
                        </text>
                      </g>
                    );
                  })}
                </g>
              );
            })()}

          {/* ── ZONE AREA FILLS — real non-overlapping polygons (Zone + Design) ─ */}
          {/* Carved from the open space + existing features; already inside the */}
          {/* boundary. Drawn BEFORE badges so outlines + badges sit on top.     */}
          {showZoneBadges && (
            <g clipPath={boundaryPathForClip ? 'url(#design-boundary-clip)' : undefined}>
              {effectivePlan.zones.map((zone) => {
                const ds = zonePartition.paths[zone.n];
                if (!ds || !ds.length) return null;
                const color = ZONE_COLORS[zone.n] ?? '#555';
                // Existing-feature zones (house/garden) draw solid; proposed zones dashed.
                const isFeatureZone = zone.n === 0 || zone.n === 2;
                return (
                  <g key={`zone-area-${zone.n}`}>
                    {ds.map((d, idx) => (
                      <path
                        key={idx}
                        d={d}
                        fillRule="evenodd"
                        fill={color}
                        fillOpacity={showSat ? 0.17 : 0.17}
                        stroke={color}
                        strokeWidth={showSat ? 3 : 1.3}
                        strokeOpacity={showSat ? 0.98 : 0.55}
                        strokeDasharray={isFeatureZone ? undefined : '6,4'}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          )}

          {/* ── ZONE BADGES (Zone + Design views) ────────────────────────────── */}
          {showZoneBadges && effectivePlan.zones.map((zone) => {
            const color = ZONE_COLORS[zone.n] ?? '#555';
            // Use the pre-computed, de-collided badge position (falls back to anchor).
            const [bx, by] =
              badgePositions[zone.n] ??
              zonePartition.centroids[zone.n] ??
              resolveAnchor(zone.anchor, visibleLayers, project, boundsCenter, bboxPx);
            const badgeCy = by;
            // Zone title caption: de-collide
            const captionFull = zone.title.length > 20 ? `${zone.title.slice(0, 19)}…` : zone.title;
            const captionCy = placeLabel(bx, badgeCy + 32, captionFull.length);
            return (
              <g key={`zone-${zone.n}`}>
                {/* Badge circle */}
                <circle
                  cx={bx} cy={badgeCy}
                  r="15"
                  fill={color}
                  stroke="#FAF5EA"
                  strokeWidth="2.5"
                  filter="url(#ps-shadow)"
                />
                <text
                  x={bx}
                  y={badgeCy + 5}
                  textAnchor="middle"
                  fontFamily="'Helvetica Neue', sans-serif"
                  fontSize="13"
                  fontWeight="900"
                  fill="#FFFFFF"
                >
                  {zone.n}
                </text>
                {/* Zone title caption — hidden in Design view (opportunity cards + legend cover it) */}
                {!showDesignElements && (
                  <text
                    x={bx}
                    y={captionCy + 5}
                    textAnchor="middle"
                    fontFamily="'Helvetica Neue', sans-serif"
                    fontSize="8.5"
                    fontWeight="700"
                    fill={showSat ? '#FFFFFF' : color}
                    opacity={showSat ? 1 : 0.88}
                    stroke={showSat ? 'rgba(0,0,0,0.65)' : undefined}
                    strokeWidth={showSat ? 2.5 : undefined}
                    paintOrder={showSat ? 'stroke' : undefined}
                  >
                    {captionFull}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── OPPORTUNITY LABELS (Design view, satellite only, max 3) ──── */}
          {showDesignElements && showSat && effectivePlan.opportunities.slice(0, 3).map((opp, i) => {
            // Over the photo, drop opportunity cards onto the zone they describe
            // (orchard → Zone 3, low-care → Zone 4) so they spread out like a real
            // plan instead of stacking on the house.
            const theme = `${opp.title} ${opp.note}`.toLowerCase();
            let center = resolveAnchor(opp.anchor, visibleLayers, project, boundsCenter, bboxPx);
            if (showSat) {
              if (/orchard|food forest|fruit|\btree/.test(theme) && zonePartition.centroids[3]) {
                center = zonePartition.centroids[3];
              } else if (/low.?care|graz|fodder|support/.test(theme) && zonePartition.centroids[4]) {
                center = zonePartition.centroids[4];
              }
            }
            const [rawOx, oy] = center;
            // Clamp x so the card stays within the map area
            const oppW = 180;
            const ox = Math.max(oppW / 2 + 8, Math.min(rawOx, mapAreaW - oppW / 2 - 8));
            const short = opp.note.length > 70 ? `${opp.note.slice(0, 68)}…` : opp.note;
            // De-collide: treat the opp card as a ~42px-tall rect, centred at ox
            // placeLabel gives us the pill centreY; we use it as the card top + 9
            const cardTopCy = placeLabel(ox, oy + 22 + i * 52, oppW / 6);
            const cardY = cardTopCy - 9;
            return (
              <g key={`opp-${i}`} transform={`translate(${ox - oppW / 2} ${cardY})`}>
                <rect
                  width={oppW} height={42}
                  rx="10"
                  fill="rgba(30,20,5,0.72)"
                  stroke="#F7C97E"
                  strokeWidth="1.5"
                  strokeDasharray="5,3"
                />
                <text
                  x="10" y="14"
                  fontFamily="'Helvetica Neue', sans-serif"
                  fontSize="9"
                  fontWeight="800"
                  fill="#F7C97E"
                >
                  {opp.title.length > 24 ? `${opp.title.slice(0, 23)}…` : opp.title}
                </text>
                <text x="10" y="30" fontFamily="sans-serif" fontSize="8" fill="#D8CDBA">{short}</text>
              </g>
            );
          })}

          {/* ── WATER ARROWS (Design view — from plan.water) ──────────────── */}
          {showDesignElements && effectivePlan.water.map((w, i) => {
            const [x1, y1] = resolveWaterPoint(w.from, visibleLayers, project, boundsCenter, bboxPx);
            const [x2, y2] = resolveWaterTarget(w.to, visibleLayers, project, boundsCenter, bboxPx);
            // Offset slightly per index so arrows don't overlap
            const off = i * 12;
            const markerId =
              w.kind === 'harvest'
                ? 'arrow-harvest'
                : w.kind === 'infiltrate'
                  ? 'arrow-infiltrate'
                  : 'arrow-runoff';
            const strokeColor =
              w.kind === 'harvest' ? '#1565A4' : w.kind === 'infiltrate' ? '#6BAED6' : '#3A8EC4';
            const dashArr =
              w.kind === 'infiltrate' ? '8,5' : w.kind === 'harvest' ? '4,3' : undefined;
            const strokeW = w.kind === 'harvest' ? 3.5 : 3;
            // Cubic bezier for a natural curve
            const mx = (x1 + x2) / 2 + off;
            const my = (y1 + y2) / 2 - 30 - off;
            return (
              <path
                key={`water-${i}`}
                d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeDasharray={dashArr}
                markerEnd={`url(#${markerId})`}
                opacity="0.82"
              />
            );
          })}

          {/* ── ACCESS ARROWS (Design view — from plan.access) ────────────── */}
          {showDesignElements && effectivePlan.access.map((a, i) => {
            // Vehicle: from boundary edge toward house; foot: from house outward
            let houseLike = visibleLayers.find((l) => l.layerType === 'roof' || l.layerType === 'structure');
            if (!houseLike) {
              const candidates = visibleLayers.filter(
                (l) => l.layerType !== 'property_boundary' && l.layerType !== 'water_body' &&
                       l.layerType !== 'access' && l.layerType !== 'tree_belt' && l.areaM2 > 0,
              );
              if (candidates.length > 0) houseLike = candidates.reduce((min, l) => l.areaM2 < min.areaM2 ? l : min);
            }
            const house = houseLike
              ? layerCentroid(houseLike, project, boundsCenter)
              : boundsCenter;
            const startX = a.kind === 'vehicle'
              ? bboxPx.minX + (bboxPx.maxX - bboxPx.minX) * 0.12
              : house[0];
            const startY = a.kind === 'vehicle'
              ? bboxPx.minY + (bboxPx.maxY - bboxPx.minY) * 0.5
              : house[1];
            const endX = a.kind === 'vehicle' ? house[0] : boundsCenter[0] + i * 30 - 30;
            const endY = a.kind === 'vehicle' ? house[1] : boundsCenter[1] + 60 + i * 20;
            const dashArr = a.kind === 'vehicle' ? '12,6' : '5,4';
            const strokeColor = a.kind === 'vehicle' ? '#D4A24A' : '#C8B890';
            const markerId = a.kind === 'vehicle' ? 'arrow-vehicle' : 'arrow-foot';
            return (
              <line
                key={`access-${i}`}
                x1={startX.toFixed(1)} y1={startY.toFixed(1)}
                x2={endX.toFixed(1)} y2={endY.toFixed(1)}
                stroke={strokeColor}
                strokeWidth="2.8"
                strokeDasharray={dashArr}
                markerEnd={`url(#${markerId})`}
                opacity="0.80"
              />
            );
          })}

          {/* ── WATER LAYER — catchment, runoff, swales, harvest math ──────── */}
          {showWater && (() => {
            // Aggregate ALL roof + structure footprints for catchment (multi-roof).
            const roofLayers = visibleLayers.filter(
              (l) => l.layerType === 'roof' || l.layerType === 'structure',
            );
            const roofLayer = roofLayers[0] ?? null;
            const roofM2 = Math.round(roofLayers.reduce((s, l) => s + (l.areaM2 || 0), 0));
            const waterBodies = visibleLayers.filter((l) => l.layerType === 'water_body');
            const rainMm = Math.round(locationData?.rainfall?.annual ?? 0);
            const harvestKL = Math.round((roofM2 * rainMm * 0.8) / 1000);
            const roofC = roofLayer ? layerCentroid(roofLayer, project, boundsCenter) : boundsCenter;
            const bboxW = bboxPx.maxX - bboxPx.minX;
            const bboxH = bboxPx.maxY - bboxPx.minY;
            const railX = mapAreaW + 8;
            const dn = slope.downhillDir;
            const ct = slope.contourDir;
            const rows: Array<{ glyph: string; color: string; label: string }> = [
              { glyph: '▦', color: '#3A8EC4', label: 'Roof catchment → tank' },
              { glyph: '→', color: '#3A8EC4', label: 'Runoff downslope (indicative)' },
              { glyph: '〜', color: '#4EA6D8', label: 'Swale on contour' },
              { glyph: '◐', color: '#2C5F8A', label: 'Rain tank (near house)' },
            ];
            if (waterBodies.length) rows.push({ glyph: '◆', color: '#1565A4', label: 'Existing dam / pond' });
            return (
              <g>
                {/* roof catchment fill — all roofs */}
                {roofLayers.flatMap((rl, ri) =>
                  geometryToPaths(rl.geometry, project).map((d, i) => (
                    <path key={`rc-${ri}-${i}`} d={d} fill="rgba(116,185,242,0.32)" stroke="#3A8EC4" strokeWidth="1.6" />
                  )),
                )}
                {/* existing water bodies (dam / pond) */}
                {waterBodies.map((wb, wi) => {
                  const c = layerCentroid(wb, project, boundsCenter);
                  return (
                    <g key={`wb-${wi}`}>
                      {geometryToPaths(wb.geometry, project).map((d, i) => (
                        <path key={i} d={d} fill="rgba(21,101,164,0.4)" stroke="#1565A4" strokeWidth="1.8" />
                      ))}
                      <circle cx={c[0]} cy={c[1]} r="11" fill="#1565A4" stroke="#fff" strokeWidth="2" />
                      <text x={c[0]} y={c[1] + 3} textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="800" fill="#fff">◆</text>
                    </g>
                  );
                })}
                {/* swales on contour (indicative) */}
                {slope.usable &&
                  [0.34, 0.56, 0.78].map((t, i) => {
                    const px = bboxPx.minX + bboxW * t;
                    const py = bboxPx.minY + bboxH * t;
                    const len = Math.min(bboxW, bboxH) * 0.62;
                    return (
                      <line
                        key={`sw-${i}`}
                        x1={px - ct[0] * len / 2} y1={py - ct[1] * len / 2}
                        x2={px + ct[0] * len / 2} y2={py + ct[1] * len / 2}
                        stroke="#4EA6D8" strokeWidth="2" strokeDasharray="7,5" opacity="0.7"
                      />
                    );
                  })}
                {/* runoff flow arrows downslope */}
                {slope.usable &&
                  [0.3, 0.5, 0.7].map((t, i) => {
                    const sx = bboxPx.minX + bboxW * t - dn[0] * bboxH * 0.26;
                    const sy = bboxPx.minY + bboxH * t - dn[1] * bboxH * 0.26;
                    return (
                      <line
                        key={`fl-${i}`}
                        x1={sx} y1={sy}
                        x2={sx + dn[0] * bboxH * 0.4} y2={sy + dn[1] * bboxH * 0.4}
                        stroke="#3A8EC4" strokeWidth="2.6" strokeDasharray="2,4"
                        markerEnd="url(#arrow-flood)" opacity="0.8"
                      />
                    );
                  })}
                {/* rain tank near roof */}
                {roofLayer && (
                  <g>
                    <ellipse cx={roofC[0] + 24} cy={roofC[1] + 24} rx="9" ry="4.5" fill="#2C5F8A" stroke="#fff" strokeWidth="1.4" />
                    <rect x={roofC[0] + 15} y={roofC[1] + 24} width="18" height="15" fill="#2C5F8A" stroke="#fff" strokeWidth="1.4" />
                    <ellipse cx={roofC[0] + 24} cy={roofC[1] + 39} rx="9" ry="4.5" fill="#3A6E9C" stroke="#fff" strokeWidth="1.4" />
                  </g>
                )}
                {/* droplet badge on roof */}
                {roofLayer && (
                  <g transform={`translate(${roofC[0]} ${roofC[1]})`}>
                    <circle r="15" fill="#1565A4" stroke="#fff" strokeWidth="2.5" filter="url(#ps-shadow)" />
                    <path d="M0,-8 C5,-1 6,3 0,7 C-6,3 -5,-1 0,-8 Z" fill="#fff" />
                  </g>
                )}
                {/* harvest math callout */}
                {roofLayer && roofM2 > 0 && (() => {
                  const ly = placeLabel(roofC[0], roofC[1] - 30, 32);
                  return (
                    <g>
                      <rect x={roofC[0] - 96} y={ly - 11} width="192" height="22" rx="11" fill="rgba(18,38,66,0.92)" />
                      <text x={roofC[0]} y={ly + 4} textAnchor="middle" fontFamily="sans-serif" fontSize="9.5" fontWeight="700" fill="#CDE7FA">
                        {`Roof ${roofM2} m² × ${rainMm} mm = ~${harvestKL} kL/yr`}
                      </text>
                    </g>
                  );
                })()}
                {/* indicative-slope chip when slope unknown/flat */}
                {!slope.usable && (
                  <g>
                    <rect x={boundsCenter[0] - 104} y={boundsCenter[1] + 30} width="208" height="20" rx="10" fill="rgba(18,38,66,0.88)" />
                    <text x={boundsCenter[0]} y={boundsCenter[1] + 44} textAnchor="middle" fontFamily="sans-serif" fontSize="8.5" fill="#CDE7FA">
                      Flow direction: observe after rain (flat/coarse slope)
                    </text>
                  </g>
                )}

                {/* ── WATER RIGHT RAIL ── */}
                <rect x={railX} y="20" width={RAIL_W} height={SVG_H - 40} rx="16" fill="rgba(16,34,52,0.94)" stroke="#2C5F8A" strokeWidth="1.2" />
                <text x={railX + 14} y="44" fontFamily="Georgia, serif" fontWeight="800" fontSize="11" fill="#9FD4F2" letterSpacing="0.06em">WATER & HYDROLOGY</text>
                <text x={railX + 14} y="64" fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#7FB8DC" letterSpacing="0.08em">RAINWATER HARVEST</text>
                <text x={railX + 14} y="82" fontFamily="sans-serif" fontSize="9.5" fontWeight="700" fill="#EAF4FB">{`~${harvestKL} kL / year`}</text>
                <text x={railX + 14} y="96" fontFamily="sans-serif" fontSize="8" fill="#A9C7DC">{`${roofM2} m² roof × ${rainMm} mm × 0.8`}</text>
                <text x={railX + 14} y="124" fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#7FB8DC" letterSpacing="0.08em">LEGEND</text>
                {rows.map((r, i) => (
                  <g key={`wr-${i}`} transform={`translate(${railX + 14} ${138 + i * 22})`}>
                    <text x="0" y="0" fontFamily="sans-serif" fontSize="12" fill={r.color}>{r.glyph}</text>
                    <text x="20" y="0" fontFamily="sans-serif" fontSize="8.5" fill="#D8E6F0">{r.label}</text>
                  </g>
                ))}
                <text x={railX + 14} y="250" fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#7FB8DC" letterSpacing="0.08em">NOTES</text>
                {[
                  'Roof tanks + small dams need no',
                  'licence (Nat. Water Act general',
                  'authorisation). Slow, spread & sink',
                  'runoff with swales on contour.',
                  'Flow lines are indicative — confirm',
                  'the low point on the ground.',
                ].map((line, i) => (
                  <text key={`wn-${i}`} x={railX + 14} y={266 + i * 12} fontFamily="sans-serif" fontSize="7.5" fill="#A9C7DC">{line}</text>
                ))}
              </g>
            );
          })()}

          {/* ── IMPLEMENTATION MAP — numbered phased build sequence ─────────── */}
          {showImplementation && (() => {
            const phases = implementationPhases ?? [];
            if (!phases.length) return null;
            const bboxW = bboxPx.maxX - bboxPx.minX;
            const bboxH = bboxPx.maxY - bboxPx.minY;
            const layerById = new Map(visibleLayers.map((l) => [l.id, l] as const));
            const pins: { seq: number; phase: number; task: string; x: number; y: number }[] = [];
            phases.forEach((ph, pi) => {
              ph.steps.forEach((st, si) => {
                const ls = st.layerIds
                  .map((id) => layerById.get(id))
                  .filter((l): l is DesignLayer => !!l);
                let x: number;
                let y: number;
                if (ls.length) {
                  const cs = ls.map((l) => layerCentroid(l, project, boundsCenter));
                  x = cs.reduce((s, c) => s + c[0], 0) / cs.length;
                  y = cs.reduce((s, c) => s + c[1], 0) / cs.length;
                } else {
                  x = bboxPx.minX + bboxW * (0.22 + pi * 0.26);
                  y = bboxPx.minY + bboxH * (0.28 + si * 0.16);
                }
                pins.push({ seq: st.seq, phase: ph.phase, task: st.task, x, y });
              });
            });
            pins.sort((a, b) => a.seq - b.seq);
            const railX = mapAreaW + 8;
            let yy = 86;
            const railRows: React.ReactNode[] = [];
            phases.forEach((ph) => {
              railRows.push(
                <g key={`ph-${ph.phase}`} transform={`translate(${railX + 14} ${yy})`}>
                  <circle cx="4" cy="-3" r="5" fill={PHASE_COLORS[ph.phase] ?? '#555'} />
                  <text x="16" y="0" fontFamily="sans-serif" fontSize="9" fontWeight="800" fill="#EAF4FB">{ph.label}</text>
                  {ph.monthRange ? (
                    <text x="16" y="11" fontFamily="sans-serif" fontSize="7.5" fill="#9DB4C8">
                      {ph.monthRange}{ph.budgetBand ? ` · ${ph.budgetBand} budget` : ''}
                    </text>
                  ) : null}
                </g>,
              );
              yy += ph.monthRange ? 26 : 18;
              ph.steps.slice(0, 4).forEach((st) => {
                railRows.push(
                  <text key={`st-${st.seq}`} x={railX + 20} y={yy} fontFamily="sans-serif" fontSize="8.5" fill="#C9D7E2">
                    {st.seq}. {st.task.length > 30 ? `${st.task.slice(0, 29)}…` : st.task}
                  </text>,
                );
                yy += 13;
              });
              yy += 6;
            });
            return (
              <g>
                <polyline
                  points={pins.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                  fill="none" stroke="rgba(250,245,234,0.7)" strokeWidth="2" strokeDasharray="5,5"
                />
                {pins.map((p, i) => (
                  <g key={`pin-${i}`}>
                    <circle cx={p.x} cy={p.y} r="13" fill={PHASE_COLORS[p.phase] ?? '#555'} stroke="#FAF5EA" strokeWidth="2.5" filter="url(#ps-shadow)" />
                    <text x={p.x} y={p.y + 4} textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="900" fill="#fff">{p.seq}</text>
                  </g>
                ))}
                <rect x={railX} y="20" width={RAIL_W} height={SVG_H - 40} rx="16" fill="rgba(20,28,40,0.94)" stroke="#1A5A8A" strokeWidth="1.2" />
                <text x={railX + 14} y="44" fontFamily="Georgia, serif" fontWeight="800" fontSize="11" fill="#9FD4F2" letterSpacing="0.06em">IMPLEMENTATION</text>
                <text x={railX + 14} y="62" fontFamily="sans-serif" fontSize="8" fill="#9DB4C8">Phased build sequence — follow the numbers</text>
                {railRows}
              </g>
            );
          })()}

          {/* ── SECTOR VIEW — sun-path inset + wind notes ──────────────────── */}
          {showSectorPanel && (
            <g>
              <rect
                x={sectorInsetX} y={sectorInsetY}
                width={sectorInsetW} height={sectorInsetH}
                rx="14"
                fill="rgba(30,20,5,0.88)"
                stroke="#F7C97E"
                strokeWidth="1.5"
              />
              <text
                x={sectorInsetX + sectorInsetW / 2} y={sectorInsetY + 17}
                textAnchor="middle"
                fontFamily="sans-serif"
                fontWeight="800"
                fontSize="9.5"
                fill="#F7C97E"
                letterSpacing="0.08em"
              >
                SUN PATH
              </text>
              {/* Compass labels */}
              <text x={sectorInsetX + sectorInsetW / 2} y={sectorInsetY + 34} textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#E0D8C4">N</text>
              <text x={sectorInsetX + 10} y={sectorInsetY + 90} textAnchor="start" fontFamily="sans-serif" fontSize="9" fill="#E0D8C4">W</text>
              <text x={sectorInsetX + sectorInsetW - 10} y={sectorInsetY + 90} textAnchor="end" fontFamily="sans-serif" fontSize="9" fill="#E0D8C4">E</text>
              <text x={sectorInsetX + sectorInsetW / 2} y={sectorInsetY + 148} textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="#E0D8C4">S</text>
              {/* High summer arc */}
              <path
                d={`M ${sectorInsetX + 22} ${sectorInsetY + 110} Q ${sectorInsetX + sectorInsetW / 2} ${sectorInsetY + 38} ${sectorInsetX + sectorInsetW - 22} ${sectorInsetY + 110}`}
                fill="none"
                stroke="#F7C97E"
                strokeWidth="2.5"
                opacity="0.92"
              />
              <text x={sectorInsetX + sectorInsetW / 2} y={sectorInsetY + 56} textAnchor="middle" fontFamily="sans-serif" fontSize="7.5" fill="#F7C97E">High summer</text>
              {/* Low winter arc */}
              <path
                d={`M ${sectorInsetX + 22} ${sectorInsetY + 122} Q ${sectorInsetX + sectorInsetW / 2} ${sectorInsetY + 76} ${sectorInsetX + sectorInsetW - 22} ${sectorInsetY + 122}`}
                fill="none"
                stroke="#74B9F2"
                strokeWidth="2"
                strokeDasharray="5,3"
                opacity="0.82"
              />
              <text x={sectorInsetX + sectorInsetW / 2} y={sectorInsetY + 96} textAnchor="middle" fontFamily="sans-serif" fontSize="7.5" fill="#74B9F2">Low winter</text>
              {/* Caption */}
              <text x={sectorInsetX + sectorInsetW / 2} y={sectorInsetY + 160} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#9A8268">
                {(locationData?.lat ?? 0) < 0 ? 'Midday sun from the north (SH).' : 'Midday sun from the south (NH).'}
              </text>
              {/* Wind sector notes if available */}
              {locationData?.climate?.windFromSummer && (
                <g>
                  <text
                    x={sectorInsetX + sectorInsetW / 2}
                    y={sectorInsetY + 172}
                    textAnchor="middle"
                    fontFamily="sans-serif"
                    fontSize="7.5"
                    fill="#B9AA8E"
                  >
                    {`Wind: ${locationData.climate.windFromSummer} (summer)`}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* ── SECTOR RADIAL ENERGIES + RAIL (upgrade) ─────────────────────── */}
          {showSectorPanel && (() => {
            const cx = boundsCenter[0];
            const cy = boundsCenter[1];
            const siteR = 0.5 * Math.hypot(bboxPx.maxX - bboxPx.minX, bboxPx.maxY - bboxPx.minY);
            const isSH = (locationData?.lat ?? -29) < 0;
            const climate = locationData?.climate;
            const railX = mapAreaW + 8;
            // Cap the ring so arrows (+ their tails) always stay inside the map frame,
            // not the rail. Leaves room for the ~50px arrow tail + labels.
            const margin = 30;
            const maxRx = Math.min(cx - margin, mapAreaW - margin - cx);
            const maxRy = Math.min(cy - margin, SVG_H - margin - cy);
            const R = Math.max(siteR + 18, Math.min(siteR + 54, Math.min(maxRx, maxRy) - 52));
            const ray = (from: readonly [number, number], lenOut = 44, lenIn = 16) => ({
              sx: cx + from[0] * (R + lenOut), sy: cy + from[1] * (R + lenOut),
              ex: cx + from[0] * (R - lenIn), ey: cy + from[1] * (R - lenIn),
            });
            const sun = ray(bearingToDir(isSH ? 'N' : 'S'), 30, 8);
            const sumW = climate?.windFromSummer ? ray(bearingToDir(climate.windFromSummer)) : null;
            const winW = climate?.windFromWinter ? ray(bearingToDir(climate.windFromWinter)) : null;
            const windW = 2 + Math.min(climate?.windSpeed ?? 3, 8) * 0.5;
            const showFrost = (climate?.minTemp ?? 99) < 5 && slope.usable;
            const rows: Array<{ glyph: string; color: string; label: string }> = [
              { glyph: '☀', color: '#F7C97E', label: `Midday sun from ${isSH ? 'N' : 'S'} — face beds to it` },
            ];
            if (climate?.windFromSummer) rows.push({ glyph: '⤙', color: '#E08A2C', label: `Summer wind from ${climate.windFromSummer}` });
            if (climate?.windFromWinter) rows.push({ glyph: '⤙', color: '#C97B25', label: `Winter wind from ${climate.windFromWinter}` });
            if (showFrost) rows.push({ glyph: '❄', color: '#9FD0E8', label: 'Frost drains to low corner' });
            if (slope.usable) rows.push({ glyph: '→', color: '#3A8EC4', label: 'Runoff enters from uphill' });
            return (
              <g>
                {/* sun ray (from N in SH) */}
                <line x1={sun.sx} y1={sun.sy} x2={sun.ex} y2={sun.ey} stroke="#F7C97E" strokeWidth="4" markerEnd="url(#arrow-harvest)" opacity="0.9" />
                <circle cx={sun.sx} cy={sun.sy} r="9" fill="#F7C97E" opacity="0.95" />
                <text x={sun.sx} y={sun.sy - 12} textAnchor="middle" fontFamily="sans-serif" fontSize="8.5" fontWeight="700" fill="#F7C97E">Midday sun</text>
                {/* summer wind */}
                {sumW && (
                  <g>
                    <line x1={sumW.sx} y1={sumW.sy} x2={sumW.ex} y2={sumW.ey} stroke="#E08A2C" strokeWidth={windW} strokeDasharray="8,5" markerEnd="url(#arrow-wind)" opacity="0.88" />
                    <text x={sumW.sx} y={sumW.sy} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#E08A2C">Summer wind</text>
                  </g>
                )}
                {/* winter wind */}
                {winW && (
                  <g>
                    <line x1={winW.sx} y1={winW.sy} x2={winW.ex} y2={winW.ey} stroke="#C97B25" strokeWidth={windW} strokeDasharray="8,5" markerEnd="url(#arrow-wind)" opacity="0.82" />
                    <text x={winW.sx} y={winW.sy} textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="700" fill="#C97B25">Winter wind</text>
                  </g>
                )}
                {/* frost drainage downslope + pocket */}
                {showFrost && (() => {
                  const dn = slope.downhillDir;
                  const fx = cx + dn[0] * siteR * 0.85;
                  const fy = cy + dn[1] * siteR * 0.85;
                  return (
                    <g>
                      <line x1={cx} y1={cy} x2={fx} y2={fy} stroke="#9FD0E8" strokeWidth="2.4" strokeDasharray="3,4" markerEnd="url(#arrow-frost)" opacity="0.8" />
                      <ellipse cx={fx} cy={fy} rx="26" ry="16" fill="rgba(159,208,232,0.18)" stroke="#9FD0E8" strokeWidth="1.4" strokeDasharray="4,3" />
                      <text x={fx} y={fy + 3} textAnchor="middle" fontFamily="sans-serif" fontSize="7.5" fill="#CDE7FA">frost pocket</text>
                    </g>
                  );
                })()}
                {/* runoff inflow from uphill */}
                {slope.usable && (() => {
                  const r2 = ray([-slope.downhillDir[0], -slope.downhillDir[1]] as const);
                  return <line x1={r2.sx} y1={r2.sy} x2={r2.ex} y2={r2.ey} stroke="#3A8EC4" strokeWidth="2.6" markerEnd="url(#arrow-flood)" opacity="0.75" />;
                })()}

                {/* SECTOR RAIL */}
                <rect x={railX} y="20" width={RAIL_W} height={SVG_H - 40} rx="16" fill="rgba(28,22,10,0.94)" stroke="#F7C97E" strokeWidth="1.2" />
                <text x={railX + 14} y="44" fontFamily="Georgia, serif" fontWeight="800" fontSize="11" fill="#F7C97E" letterSpacing="0.06em">SECTOR ANALYSIS</text>
                <text x={railX + 14} y="62" fontFamily="sans-serif" fontSize="8" fill="#C9B48E">Energies entering the site</text>
                {rows.map((r, i) => (
                  <g key={`sr-${i}`} transform={`translate(${railX + 14} ${88 + i * 24})`}>
                    <text x="0" y="0" fontFamily="sans-serif" fontSize="13" fill={r.color}>{r.glyph}</text>
                    <text x="22" y="0" fontFamily="sans-serif" fontSize="8.5" fill="#E6DAC2">{r.label}</text>
                  </g>
                ))}
                <text x={railX + 14} y={112 + rows.length * 24} fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#C9B48E" letterSpacing="0.08em">DESIGN RESPONSE</text>
                {[
                  '• North beds catch winter sun',
                  `• Windbreak on the ${climate?.windFromWinter ?? 'cold'}-wind edge`,
                  '• Frost-tender crops off low corner',
                  '• Slow & sink runoff with swales',
                ].map((line, i) => (
                  <text key={`sd-${i}`} x={railX + 14} y={130 + rows.length * 24 + i * 14} fontFamily="sans-serif" fontSize="8" fill="#B9AA8E">{line}</text>
                ))}
              </g>
            );
          })()}

          {/* ── ZONE KEY PANEL (Zone view — in map area) ───────────────────── */}
          {showZoneKey && mapView === 'zone' && (
            <g>
              <rect
                x={zoneKeyX} y={zoneKeyY}
                width={zoneKeyW} height={zoneKeyH}
                rx="13"
                fill="rgba(30,20,5,0.86)"
              />
              <text
                x={zoneKeyX + 14} y={zoneKeyY + 18}
                fontFamily="sans-serif"
                fontWeight="800"
                fontSize="9.5"
                fill="#F7C97E"
                letterSpacing="0.08em"
              >
                ZONES
              </text>
              {ZONE_KEY.map((entry, i) => {
                const color = ZONE_COLORS[entry.z];
                return (
                  <g key={entry.z} transform={`translate(${zoneKeyX + 12} ${zoneKeyY + 24 + i * zoneKeyItemH})`}>
                    <circle cx="10" cy="10" r="9" fill={color} stroke="#FAF5EA" strokeWidth="1.5" />
                    <text x="10" y="14" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="900" fill="#fff">{entry.z}</text>
                    <text x="26" y="9" fontFamily="sans-serif" fontWeight="700" fontSize="9" fill="#F4EDD8">{entry.label}</text>
                    <text x="26" y="19" fontFamily="sans-serif" fontSize="7.5" fill="#9A8268">{entry.desc}</text>
                  </g>
                );
              })}
            </g>
          )}
        </>
      )}

      {/* ── NORTH ARROW (always, top-right of map area) ─────────────────── */}
      <g transform={`translate(${northX} ${northY})`}>
        <circle cx="28" cy="28" r="24" fill="#1F4D2B" opacity="0.92" />
        <path d="M28 8 L35 28 L28 24 L21 28 Z" fill="#F4EDD8" />
        <path d="M28 48 L21 28 L28 33 L35 28 Z" fill="#8BAB80" opacity="0.5" />
        <text x="28" y="64" textAnchor="middle" fontFamily="sans-serif" fontSize="11" fontWeight="800" fill="#1F4D2B">N</text>
      </g>

      {/* ── SCALE BAR ────────────────────────────────────────────────────── */}
      {visibleLayers.length > 0 && (
        <g transform={`translate(${scaleBarX} ${scaleBarY})`}>
          <rect x="0" y="-4" width={scaleBarPx + 84} height="22" rx="8" fill="rgba(32,25,15,0.70)" />
          <line x1="8" y1="9" x2={8 + scaleBarPx} y2="9" stroke="#F4EDD8" strokeWidth="2.5" />
          <line x1="8" y1="4" x2="8" y2="14" stroke="#F4EDD8" strokeWidth="2" />
          <line x1={8 + scaleBarPx} y1="4" x2={8 + scaleBarPx} y2="14" stroke="#F4EDD8" strokeWidth="2" />
          <text
            x={8 + scaleBarPx + 9} y="13"
            fontFamily="sans-serif"
            fontSize="10"
            fontWeight="700"
            fill="#F7C97E"
          >
            {scaleBarLabel}
          </text>
        </g>
      )}

      {/* ── LAYER LEGEND (not in Design view — rail handles it there) ──── */}
      {presentTypes.length > 0 && mapView !== 'design' && mapView !== 'implementation' && (
        <g transform={`translate(${legendX} ${legendY})`}>
          <rect width={legendW} height={legendH} rx="13" fill="rgba(32,25,15,0.82)" />
          <text
            x="14" y="21"
            fontFamily="sans-serif"
            fontWeight="800"
            fontSize="9.5"
            fill="#F7C97E"
            letterSpacing="0.08em"
          >
            LEGEND
          </text>
          {presentTypes.map((type, idx) => {
            const col = idx % legendCols;
            const row = Math.floor(idx / legendCols);
            return (
              <g key={type} transform={`translate(${14 + col * 132} ${32 + row * 26})`}>
                <rect width="11" height="11" rx="3" fill={getDesignLayerColor(type)} />
                <text x="17" y="10" fontFamily="sans-serif" fontSize="9.5" fill="#F4EDD8">
                  {getDesignLayerTypeLabel(type)}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* ── FOOTER NOTE ──────────────────────────────────────────────────── */}
      <text
        x={mapAreaW - 52} y={SVG_H - 30}
        textAnchor="end"
        fontFamily="sans-serif"
        fontSize="9.5"
        fill="#9A8268"
      >
        Locked geometry stays fixed · WGS 84 · ImbewuField
      </text>

      {/* ═══════════════════════════════════════════════════════════════════
          ── RIGHT RAIL — DESIGN VIEW ONLY ───────────────────────────────
          ═══════════════════════════════════════════════════════════════════ */}
      {mapView === 'design' && (
        <g transform={`translate(${mapAreaW + 8} 20)`}>
          {/* Rail background */}
          <rect
            width={RAIL_W - 4} height={SVG_H - 40}
            rx="18"
            fill="rgba(28,18,6,0.88)"
            stroke="#4A3C24"
            strokeWidth="1"
          />

          {/* Rail title */}
          <text x="14" y="20" fontFamily="Georgia, serif" fontWeight="800" fontSize="11" fill="#F7C97E" letterSpacing="0.06em">DESIGN LEGEND</text>
          <line x1="10" y1="26" x2={RAIL_W - 18} y2="26" stroke="#4A3C24" strokeWidth="1" />

          {/* ZONES section */}
          <text x="14" y="40" fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#F7C97E" letterSpacing="0.09em">ZONES</text>
          {ZONE_KEY.map((entry, i) => {
            const color = ZONE_COLORS[entry.z];
            return (
              <g key={entry.z} transform={`translate(14 ${48 + i * 22})`}>
                <circle cx="9" cy="9" r="8" fill={color} stroke="#FAF5EA" strokeWidth="1.5" />
                <text x="9" y="13" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontWeight="900" fill="#fff">{entry.z}</text>
                <text x="22" y="8" fontFamily="sans-serif" fontWeight="700" fontSize="8" fill="#F4EDD8">{entry.label}</text>
                <text x="22" y="17" fontFamily="sans-serif" fontSize="7" fill="#7A6E5A">{entry.desc}</text>
              </g>
            );
          })}

          {/* ACCESS & MOVEMENT section */}
          <text x="14" y={48 + ZONE_KEY.length * 22 + 14} fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#F7C97E" letterSpacing="0.09em">ACCESS & MOVEMENT</text>
          <g transform={`translate(14 ${48 + ZONE_KEY.length * 22 + 22})`}>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#D4A24A" strokeWidth="2.5" strokeDasharray="8,4" />
            <text x="28" y="10" fontFamily="sans-serif" fontSize="8" fill="#D4A24A">Vehicle track</text>
          </g>
          <g transform={`translate(14 ${48 + ZONE_KEY.length * 22 + 36})`}>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#C8B890" strokeWidth="2" strokeDasharray="4,3" />
            <text x="28" y="10" fontFamily="sans-serif" fontSize="8" fill="#C8B890">Foot path</text>
          </g>

          {/* WATER STRATEGY section */}
          <text x="14" y={48 + ZONE_KEY.length * 22 + 60} fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#F7C97E" letterSpacing="0.09em">WATER STRATEGY</text>
          <g transform={`translate(14 ${48 + ZONE_KEY.length * 22 + 68})`}>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#3A8EC4" strokeWidth="2.5" />
            <text x="28" y="10" fontFamily="sans-serif" fontSize="8" fill="#3A8EC4">Runoff / flow</text>
          </g>
          <g transform={`translate(14 ${48 + ZONE_KEY.length * 22 + 82})`}>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#6BAED6" strokeWidth="2.5" strokeDasharray="6,4" />
            <text x="28" y="10" fontFamily="sans-serif" fontSize="8" fill="#6BAED6">Infiltrate / swale</text>
          </g>
          <g transform={`translate(14 ${48 + ZONE_KEY.length * 22 + 96})`}>
            <line x1="0" y1="6" x2="22" y2="6" stroke="#1565A4" strokeWidth="3" strokeDasharray="3,3" />
            <text x="28" y="10" fontFamily="sans-serif" fontSize="8" fill="#74B9F2">Harvest / tank</text>
          </g>

          {/* SUN PATH mini inset */}
          {(() => {
            const sunBaseY = 48 + ZONE_KEY.length * 22 + 120;
            const sw = RAIL_W - 28;
            const sh = 82;
            return (
              <g>
                <text x="14" y={sunBaseY} fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#F7C97E" letterSpacing="0.09em">SUN PATH</text>
                <rect x="14" y={sunBaseY + 5} width={sw} height={sh} rx="8" fill="rgba(255,200,50,0.06)" stroke="#4A3C24" strokeWidth="1" />
                {/* High arc */}
                <path
                  d={`M ${14 + 12} ${sunBaseY + sh - 8} Q ${14 + sw / 2} ${sunBaseY + 14} ${14 + sw - 12} ${sunBaseY + sh - 8}`}
                  fill="none" stroke="#F7C97E" strokeWidth="2" opacity="0.85"
                />
                {/* Low arc */}
                <path
                  d={`M ${14 + 12} ${sunBaseY + sh - 8} Q ${14 + sw / 2} ${sunBaseY + sh / 2} ${14 + sw - 12} ${sunBaseY + sh - 8}`}
                  fill="none" stroke="#74B9F2" strokeWidth="1.5" strokeDasharray="4,3" opacity="0.75"
                />
                <text x={14 + sw / 2} y={sunBaseY + 26} textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#F7C97E" opacity="0.82">Summer</text>
                <text x={14 + sw / 2} y={sunBaseY + sh - 18} textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#74B9F2" opacity="0.75">Winter</text>
                <text x={14 + sw / 2} y={sunBaseY + sh} textAnchor="middle" fontFamily="sans-serif" fontSize="6.5" fill="#7A6E5A">
                  {(locationData?.lat ?? 0) < 0 ? 'Sun: N (SH)' : 'Sun: S (NH)'}
                </text>
              </g>
            );
          })()}

          {/* NOTES section */}
          {(() => {
            const notesBaseY = 48 + ZONE_KEY.length * 22 + 216;
            const notesText = effectivePlan.notes ?? 'Generate a plan to see design notes here.';
            // Word-wrap at ~26 chars
            const words = notesText.split(' ');
            const lines: string[] = [];
            let cur = '';
            for (const w of words) {
              if ((cur + ' ' + w).trim().length > 26) {
                if (cur) lines.push(cur);
                cur = w;
              } else {
                cur = cur ? `${cur} ${w}` : w;
              }
              if (lines.length >= 6) break;
            }
            if (cur && lines.length < 6) lines.push(cur);
            return (
              <g>
                <line x1="10" y1={notesBaseY - 6} x2={RAIL_W - 18} y2={notesBaseY - 6} stroke="#4A3C24" strokeWidth="1" />
                <text x="14" y={notesBaseY + 6} fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#F7C97E" letterSpacing="0.09em">NOTES</text>
                {lines.map((line, i) => (
                  <text key={i} x="14" y={notesBaseY + 18 + i * 12} fontFamily="sans-serif" fontSize="7.5" fill="#9A8268">{line}</text>
                ))}
              </g>
            );
          })()}

          {/* Layer legend in rail */}
          {(() => {
            const legBaseY = SVG_H - 40 - 20 - presentTypes.length * 20;
            return (
              <g>
                <line x1="10" y1={legBaseY - 8} x2={RAIL_W - 18} y2={legBaseY - 8} stroke="#4A3C24" strokeWidth="1" />
                <text x="14" y={legBaseY} fontFamily="sans-serif" fontWeight="800" fontSize="8.5" fill="#F7C97E" letterSpacing="0.09em">FEATURES</text>
                {presentTypes.map((type, i) => (
                  <g key={type} transform={`translate(14 ${legBaseY + 8 + i * 20})`}>
                    <rect width="10" height="10" rx="3" fill={getDesignLayerColor(type)} />
                    <text x="16" y="9" fontFamily="sans-serif" fontSize="8" fill="#D8CDBA">{getDesignLayerTypeLabel(type)}</text>
                  </g>
                ))}
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

// ── Main exported component ───────────────────────────────────────────────────

export default function GeometryDesignStudio({ locationData, siteName }: Props) {
  const siteId = designSiteIdFromLocation(locationData);
  const [studio, setStudio] = useState<DesignStudioState>(() =>
    emptyDesignStudioState(siteId),
  );
  const [aiPlan, setAiPlan] = useState<DesignPlanAI | null>(null);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState<'png' | 'pdf' | ''>('');
  const [mapView, setMapView] = useState<MapView>('design');
  const [showFill, setShowFill] = useState(false);
  const [satDataUrl, setSatDataUrl] = useState<string | null>(null);
  const [aiRender, setAiRender] = useState<string | null>(null);
  const [aiRendering, setAiRendering] = useState(false);
  const [aiRenderError, setAiRenderError] = useState('');
  const [renderLayer, setRenderLayer] = useState<AiRenderLayer>('overall');
  const [aiSatOnly, setAiSatOnly] = useState(false);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'fal' | 'falgpt'>('gemini');
  const [geminiModel, setGeminiModel] = useState<'flash' | 'pro' | 'pro-preview'>('pro-preview');
  const [aiRenderCache, setAiRenderCache] = useState<Partial<Record<AiRenderLayer, string>>>(() => {
    // Warm the cache from localStorage on first mount (keyed by siteId so farms don't share)
    try {
      const sid = designSiteIdFromLocation(locationData);
      const raw = localStorage.getItem(`imbewu_airender_${sid}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [showReportDoc, setShowReportDoc] = useState(false);
  const [siteElements, setSiteElements] = useState<SiteElement[]>(() =>
    loadSiteElements(designSiteIdFromLocation(locationData)),
  );
  const [studioBuild, setStudioBuild] = useState<DesignCanvasState | null>(() =>
    loadCanvasState(designSiteIdFromLocation(locationData)),
  );
  const [showStudioBuild, setShowStudioBuild] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch the Mapbox satellite tile for the design view and inline it as a base64
  // data URL (so PNG/PDF export stays taint-free). Uses the SAME computeSatFit as
  // GeometryPreview, so the photo and the overlay projector can never drift.
  const satFit = computeSatFit(studio.layers, mapView);
  const satKey = satFit.useSatellite ? satFit.url : '';
  useEffect(() => {
    if (!satKey) {
      setSatDataUrl(null);
      return;
    }
    let cancelled = false;
    fetchImageAsDataUrl(satKey)
      .then((d) => {
        if (!cancelled) setSatDataUrl(d);
      })
      .catch(() => {
        if (!cancelled) setSatDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [satKey]);

  useEffect(() => {
    // A NEW site was selected — immediately drop the previous site's satellite tile and
    // AI render so we never flash another property's imagery while the new site loads,
    // and reload the per-site render cache (keyed by siteId) for the new site.
    setSatDataUrl(null);
    setAiRender(null);
    try {
      const sid = designSiteIdFromLocation(locationData);
      const raw = localStorage.getItem(`imbewu_airender_${sid}`);
      setAiRenderCache(raw ? JSON.parse(raw) : {});
    } catch {
      setAiRenderCache({});
    }

    const refresh = () => {
      const nextSiteId = designSiteIdFromLocation(locationData);
      const saved = loadDesignStudioState(nextSiteId);
      const merged = mergeFarmShapesIntoDesignState(
        readLocalFarmShapes(),
        saved,
        nextSiteId,
      );
      startTransition(() => setStudio(merged));
    };
    refresh();
    window.addEventListener(MAP_STATE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(MAP_STATE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [locationData]);

  // Farmer-placed site elements (tanks/taps/boreholes/etc) — reload whenever the site
  // switches, and whenever an element is added/edited/removed elsewhere.
  useEffect(() => {
    const refreshElements = () => {
      setSiteElements(loadSiteElements(designSiteIdFromLocation(locationData)));
    };
    refreshElements();
    window.addEventListener('imbewu-site-elements-changed', refreshElements);
    window.addEventListener('storage', refreshElements);
    return () => {
      window.removeEventListener('imbewu-site-elements-changed', refreshElements);
      window.removeEventListener('storage', refreshElements);
    };
  }, [locationData]);

  // Design Studio build (/design canvas: placed items, drawn zones, lines) — reload
  // whenever the site switches, and whenever the studio canvas changes elsewhere
  // (same tab via DESIGN_CANVAS_CHANGED_EVENT, other tab via 'storage').
  useEffect(() => {
    const refreshStudioBuild = () => {
      setStudioBuild(loadCanvasState(designSiteIdFromLocation(locationData)));
    };
    refreshStudioBuild();
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refreshStudioBuild);
    window.addEventListener('storage', refreshStudioBuild);
    return () => {
      window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refreshStudioBuild);
      window.removeEventListener('storage', refreshStudioBuild);
    };
  }, [locationData]);

  // Boundary + driveway + placed elements projected into the satellite frame — drives the
  // hard clip in HybridRender (per-site, same for every map). null when no boundary/satellite yet.
  const aiClipFrame = useMemo(
    () => computeClipFrame(studio.layers, siteElements),
    [studio.layers, siteElements],
  );

  // Base-map completeness: house (roof/structure) + driveway (access) are the two most
  // commonly-missing features — flag them so the user knows to trace them (then the SVG
  // base map fills them in automatically; no AI needed).
  const hasHouse = studio.layers.some((l) => l.layerType === 'roof' || l.layerType === 'structure');
  const hasDriveway = studio.layers.some((l) => l.layerType === 'access');
  const hasStudioBuild = !!studioBuild &&
    studioBuild.items.length + studioBuild.zones.length + studioBuild.lines.length > 0;

  const approvedCount = studio.layers.filter((l) => l.approved).length;
  const lockedCount = studio.layers.filter((l) => l.locked).length;
  const totalArea = studio.layers
    .filter((l) => l.approved && l.layerType !== 'water_body')
    .reduce((s, l) => s + l.areaM2, 0);
  const waterArea = studio.layers
    .filter((l) => l.approved && l.layerType === 'water_body')
    .reduce((s, l) => s + l.areaM2, 0);
  const title = siteName ?? locationData?.biome?.name ?? 'ImbewuField Design';

  function commit(recipe: (current: DesignStudioState) => DesignStudioState) {
    setStudio((current) => {
      const next = saveDesignStudioState(recipe(current), { notify: true });
      setMessage('Saved. This design setup can now sync to your other browser.');
      return next;
    });
  }

  function updateLayer(id: string, patch: Partial<DesignLayer>) {
    commit((current) => ({
      ...current,
      generatedPlan: null,
      layers: current.layers.map((layer) => {
        if (layer.id !== id) return layer;
        const layerType = patch.layerType ?? layer.layerType;
        return {
          ...layer,
          ...patch,
          layerType,
          color: getDesignLayerColor(layerType),
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
  }

  function approveAll() {
    commit((current) => ({
      ...current,
      generatedPlan: null,
      layers: current.layers.map((layer) => ({
        ...layer,
        approved: true,
        locked: true,
        updatedAt: new Date().toISOString(),
      })),
    }));
  }

  function refreshNow() {
    const saved = loadDesignStudioState(siteId);
    const merged = mergeFarmShapesIntoDesignState(
      readLocalFarmShapes(),
      saved,
      siteId,
    );
    setStudio(merged);
    setMessage('Refreshed from the map shapes.');
  }

  async function generatePlan() {
    if (!approvedCount) {
      setMessage('Approve at least one real map layer first.');
      return;
    }
    setGenerating(true);
    setMessage('');

    // Build the boundary ring from the property_boundary layer (or all coords)
    const boundaryLayer = studio.layers.find(
      (l) => l.layerType === 'property_boundary' && l.approved,
    );
    const boundary: number[][] = boundaryLayer
      ? collectPositions(boundaryLayer.geometry).map((p) => [p[0], p[1]])
      : studio.layers
          .filter((l) => l.approved)
          .flatMap((l) => collectPositions(l.geometry))
          .map((p) => [p[0], p[1]]);

    // Feature list for approved layers
    const features = studio.layers
      .filter((l) => l.approved)
      .map((l) => {
        const coords = collectPositions(l.geometry);
        const mid = coords.reduce<[number, number]>(
          (acc, c) => [acc[0] + c[0], acc[1] + c[1]],
          [0, 0],
        );
        const centroid: [number, number] =
          coords.length > 0
            ? [mid[0] / coords.length, mid[1] / coords.length]
            : [locationData?.lon ?? 0, locationData?.lat ?? 0];
        return {
          layerType: l.layerType,
          name: l.name,
          centroid,
          areaM2: l.areaM2,
        };
      });

    const site = {
      lat: locationData?.lat ?? 0,
      lon: locationData?.lon ?? 0,
      biome: locationData?.biome?.name,
      rainfallMm: locationData?.rainfall?.annual ?? undefined,
      soilTexture: locationData?.soil?.textureClass ?? undefined,
      elevation: locationData?.elevation?.elevation ?? undefined,
      householdSize: studio.generatedPlan?.surveySnapshot?.householdSize,
      goals: studio.generatedPlan?.surveyGoals,
    };

    // Render an INSTANT local plan so the design elements ALWAYS draw — the AI route is
    // slow on serverless and must never block (or hide) the map. Also keep the local
    // rule-based text plan in sync for the report cards.
    setAiPlan(buildLocalPlan(features, site));
    commit((current) => ({ ...current, generatedPlan: generateGeometryDesignPlan(current, locationData) }));
    setGenerating(false);
    setMessage('Design generated — switch Base / Sector / Zone / Design to explore.');

    // Best-effort: enrich the text with the AI plan in the background (replaces if it returns).
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch('/api/design-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boundary, features, site }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const plan = (await res.json()) as DesignPlanAI;
        if (plan && Array.isArray(plan.zones) && plan.zones.length) {
          setAiPlan(plan);
          setMessage('AI-enhanced design ready.');
        }
      }
    } catch { /* keep the instant local plan */ }
  }

  async function exportPng() {
    if (!svgRef.current) return;
    setExporting('png');
    setMessage('');
    try {
      const dataUrl = await svgToPngDataUrl(svgRef.current, undefined, 'image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${slugify(title)}-${mapView}-map.png`;
      link.click();
      setMessage('PNG exported.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'PNG export failed.');
    } finally {
      setExporting('');
    }
  }

  async function exportPdf() {
    if (!svgRef.current) return;
    setExporting('pdf');
    setMessage('');
    try {
      const dataUrl = await svgToPngDataUrl(svgRef.current, undefined, 'image/png');
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
      });
      doc.setFillColor(247, 240, 228);
      doc.rect(0, 0, 842, 595, 'F');
      doc.setFont('times', 'bold');
      doc.setTextColor(32, 25, 15);
      doc.setFontSize(26);
      doc.text('ImbewuField Design Map', 42, 52);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(92, 80, 64);
      doc.text(
        `${title} · ${mapView.charAt(0).toUpperCase() + mapView.slice(1)} view · ${new Date().toLocaleDateString()}`,
        42,
        70,
      );
      doc.addImage(dataUrl, 'PNG', 42, 88, 756, 440);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(158, 92, 8);
      doc.setFontSize(9);
      doc.text(`Approved: ${approvedCount}`, 42, 548);
      doc.text(`Locked: ${lockedCount}`, 160, 548);
      doc.text(`Land: ${formatDesignArea(totalArea)}`, 270, 548);
      doc.text(`Water: ${formatDesignArea(waterArea)}`, 420, 548);
      doc.text('ImbewuField · permaculture design', 700, 548);
      doc.save(`${slugify(title)}-${mapView}-map.pdf`);
      setMessage('PDF exported.');
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'PDF export failed.',
      );
    } finally {
      setExporting('');
    }
  }

  // Generate the AI "hero" render: send the real satellite + plan context to Gemini.
  async function runAiRender(layer: AiRenderLayer = 'overall', forceRegenerate = false) {
    // Show cached render instantly — no Gemini call needed (unless forced)
    if (!forceRegenerate && aiRenderCache[layer]) {
      setAiRender(aiRenderCache[layer]!);
      return;
    }
    if (!svgRef.current || !satDataUrl) {
      setAiRenderError('Open a site and switch to the Design view so the satellite loads first.');
      return;
    }
    setAiRendering(true);
    setAiRenderError('');
    setAiRender(null);
    try {
      // IMAGE 1 = composite (geometry reference: satellite + overlay baked in).
      // IMAGE 2 = raw satellite (visual reference), omitted in sat-only mode.
      // Crop the composite to the SATELLITE AREA only (no rail, no paper border) so the
      // model's output shares the exact coordinate frame the boundary clip uses.
      const satFitNow = computeSatFit(studio.layers, mapView);
      const cropRect = satFitNow.useSatellite
        ? { x: satFitNow.imgX, y: satFitNow.imgY, w: satFitNow.imgW, h: satFitNow.imgH }
        : undefined;
      const compositeDataUrl = aiSatOnly ? satDataUrl : await svgToPngDataUrl(svgRef.current, cropRect);
      const satRef = aiSatOnly ? null : satDataUrl;

      // gpt-image-2 (fal queue) supports a MASK: protect the house + driveway so the model
      // only repaints the open ground — keeps the REAL structures, big accuracy win. Same
      // pixel dims as the composite (svgToPngDataUrl renders cropRect at 2×). Design maps only.
      let maskBase64: string | undefined;
      if (
        aiProvider === 'falgpt' && !aiSatOnly && aiClipFrame &&
        layer !== 'base' && layer !== 'sector' && satFitNow.useSatellite
      ) {
        const m = buildEditMask(aiClipFrame, satFitNow.imgW * 2, satFitNow.imgH * 2);
        if (m) maskBase64 = m;
      }

      // (b) full site data
      const siteId = designSiteIdFromLocation(locationData);
      const survey = loadSurvey(siteId);
      const layers = studio.layers.filter((l) => l.approved);

      // (c) ground-level site photos as extra reference images (≤4)
      let photos: string[] = [];
      try {
        const evidence = getSiteEvidence(siteId);
        photos = Object.values(evidence)
          .flat()
          .filter((e) => e.type === 'photo' && !!e.dataUrl)
          .slice(0, 4)
          .map((e) => e.dataUrl as string);
      } catch {
        photos = [];
      }

      // Shared design brief — the SAME canonical placement spec for every map, so
      // planting/zones/water/phasing all express one integrated design.
      const effectivePlan: DesignPlanAI = buildLocalPlan(
        layers.map((l) => ({ layerType: l.layerType, name: l.name })),
        {
          biome: locationData?.biome?.name,
          rainfallMm: locationData?.rainfall?.annual ?? undefined,
          soilTexture: locationData?.soil?.textureClass ?? undefined,
        },
      );
      const designBrief = buildDesignBrief(effectivePlan);

      // Farmer-placed site elements (tanks/taps/boreholes/etc) — same normalised frame as
      // aiClipFrame (boundary centroid = 0.5,0.5), reduced to a short compass locationHint
      // for the AI prompt (e.g. "near the house, NE side"). `note` travels with each element
      // through computeClipFrame itself — no index-based zipping against siteElements.
      const placedElements = (aiClipFrame?.elements ?? []).map((el) => ({
        type: el.type,
        label: el.label,
        note: el.note,
        locationHint: `${compass8FromNormPos(el.x, el.y)} side of the property`,
      }));

      const context = {
        placeName: title,
        layer,
        // Real signed latitude, so the server can say which side the noon sun is actually on
        // (middayFromLat) instead of hardcoding "north" — false inside the tropics (SECTOR-MODEL-
        // SPEC §0.2).
        lat: locationData?.lat,
        biome: locationData?.biome?.name,
        rainfallMm: locationData?.rainfall?.annual ?? undefined,
        rainfallPattern: locationData?.rainfall?.pattern,
        soilTexture: locationData?.soil?.textureClass ?? undefined,
        soilPh: locationData?.soil?.ph ?? undefined,
        slopeDeg: locationData?.elevation?.slopeDeg ?? undefined,
        aspectLabel: locationData?.elevation?.aspectLabel,
        minTemp: locationData?.climate?.minTemp ?? undefined,
        maxTemp: locationData?.climate?.maxTemp ?? undefined,
        zones: effectivePlan.zones.map((z) => ({ n: z.n, title: z.title, items: z.items })),
        polygons: layers.map((l) => ({ name: l.name, type: l.layerType, area: l.areaLabel })),
        survey: survey ?? undefined,
        designBrief,
        placedElements: placedElements.length ? placedElements : undefined,
      };

      const res = await fetch('/api/ai-render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: compositeDataUrl, satBase64: satRef, maskBase64, photos, context, provider: aiProvider, geminiModel }),
      });
      let data: { image?: string; error?: string; detail?: string; pending?: boolean; statusUrl?: string; responseUrl?: string } = {};
      try {
        data = await res.json();
      } catch {
        const raw = await res.text().catch(() => '');
        throw new Error(`Server error (${res.status})${raw ? ` — ${raw.slice(0, 200)}` : ''}`);
      }
      if (!res.ok) {
        throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : 'Render failed.');
      }

      let finalImage = data.image;
      // Async path (gpt-image-2 via fal queue): poll until the render is ready (~30–90s).
      if (!finalImage && data.pending && data.statusUrl && data.responseUrl) {
        finalImage = await pollFalRender(data.statusUrl, data.responseUrl);
      }

      if (!finalImage) {
        throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : 'Render failed.');
      }
      const img = finalImage; // const snapshot for the setState closures below
      setAiRender(img);
      // Persist in memory cache and localStorage so the tab shows it instantly next time
      setAiRenderCache((prev) => {
        const next = { ...prev, [layer]: img };
        try {
          const sid = designSiteIdFromLocation(locationData);
          localStorage.setItem(`imbewu_airender_${sid}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    } catch (e) {
      setAiRenderError(e instanceof Error ? e.message : 'Render failed.');
    } finally {
      setAiRendering(false);
    }
  }

  // "Touch up": the user draws a rectangle directly on the CURRENT AI render + types a short
  // instruction — ONLY that region regenerates via gpt-image-2's mask (transparent = editable,
  // opaque = preserved). Reuses the same fal gpt-image-2/edit queue as the full render, just fed
  // with the previous render as base image + a user-drawn rectangular mask + a short raw prompt.
  async function handleTouchUp(
    rectNorm: { x0: number; y0: number; x1: number; y1: number },
    promptText: string,
  ): Promise<void> {
    if (!aiRender) throw new Error('No render to touch up yet.');

    // Load the current render to read its real pixel dimensions — the mask must match exactly.
    const img = new Image();
    img.src = aiRender;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Could not load the current render.'));
    });
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Build the touch-up mask: fully opaque (preserved) except a transparent (editable) hole
    // over the user-drawn rectangle — same gpt-image-2 convention as buildEditMask.
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare the touch-up mask.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(
      rectNorm.x0 * w,
      rectNorm.y0 * h,
      (rectNorm.x1 - rectNorm.x0) * w,
      (rectNorm.y1 - rectNorm.y0) * h,
    );
    const maskDataUrl = canvas.toDataURL('image/png');

    const stripDataUrl = (s: string) => s.replace(/^data:image\/\w+;base64,/, '');

    const res = await fetch('/api/ai-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: stripDataUrl(aiRender),
        maskBase64: stripDataUrl(maskDataUrl),
        touchupPrompt: promptText,
        provider: 'falgpt',
        context: {},
      }),
    });
    let data: { image?: string; error?: string; detail?: string; pending?: boolean; statusUrl?: string; responseUrl?: string } = {};
    try {
      data = await res.json();
    } catch {
      const raw = await res.text().catch(() => '');
      throw new Error(`Server error (${res.status})${raw ? ` — ${raw.slice(0, 200)}` : ''}`);
    }
    if (!res.ok) {
      throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : 'Render failed.');
    }

    let finalImage = data.image;
    if (!finalImage && data.pending && data.statusUrl && data.responseUrl) {
      finalImage = await pollFalRender(data.statusUrl, data.responseUrl);
    }
    if (!finalImage) {
      throw new Error(data.error ? `${data.error}${data.detail ? ` — ${data.detail}` : ''}` : 'Render failed.');
    }

    const finalImg = finalImage; // const snapshot for the setState closures below
    setAiRender(finalImg);
    setAiRenderCache((prev) => {
      const next = { ...prev, [renderLayer]: finalImg };
      try {
        const sid = designSiteIdFromLocation(locationData);
        localStorage.setItem(`imbewu_airender_${sid}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  // Render a specific layer: switch the map to that layer's view first so the
  // baked-in composite Gemini sees matches the layer, then call the renderer.
  async function renderSelectedLayer(layer: AiRenderLayer) {
    setRenderLayer(layer);
    // Map each AI layer to a real SVG MapView so the baked composite is valid.
    // opportunity/planting/overall have no dedicated SVG view → use the master 'design'.
    const VIEW_FOR_LAYER: Record<AiRenderLayer, MapView> = {
      overall: 'design', base: 'base', sector: 'sector', zone: 'zone',
      water: 'water', opportunity: 'design', planting: 'design', implementation: 'implementation',
    };
    const view: MapView = VIEW_FOR_LAYER[layer];
    if (mapView !== view) {
      setMapView(view);
      // wait for the SVG to re-render to the target view + its satellite to be ready
      await new Promise((r) => setTimeout(r, 600));
    }
    await runAiRender(layer);
  }

  const MAP_VIEWS: Array<{ id: MapView; label: string }> = [
    { id: 'base', label: 'Base' },
    { id: 'sector', label: 'Sector' },
    { id: 'zone', label: 'Zone' },
    { id: 'water', label: 'Water' },
    { id: 'design', label: 'Design' },
    { id: 'implementation', label: 'Impl.' },
  ];

  // Effective plan: prefer AI plan; fall back to local generated plan for text cards
  const hasPlan = !!aiPlan || !!studio.generatedPlan;

  // Instant LOCAL structured report (skeleton) — Executive + Implementation +
  // data-derived sections, built from what we already have. Claude enrichment
  // and the remaining sections come in a later phase.
  const reportDoc = useMemo(() => {
    const siteId = designSiteIdFromLocation(locationData);
    return buildSkeletonReportDoc({
      id: reportId(),
      siteId,
      location: locationData ?? ({} as NonNullable<typeof locationData>),
      survey: loadSurvey(siteId),
      layers: studio.layers,
      plan: studio.generatedPlan ?? null,
      createdAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationData, studio.layers, studio.generatedPlan]);

  const viewMapFromReport = (m: MapRef) => setMapView(m);

  return (
    <div className="space-y-4">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-4"
        style={{
          background:
            'linear-gradient(145deg, rgba(31,77,43,0.12), rgba(158,92,8,0.08))',
          border: `1px solid ${CARD_BORDER}`,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: '#1F4D2B', color: '#EAF3E2' }}
          >
            <ShieldCheck size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="text-xs font-mono uppercase tracking-wider"
              style={{ color: '#9E5C08' }}
            >
              Geometry-first Design Studio
            </div>
            <h3
              className="font-display font-bold text-base leading-tight"
              style={{ color: '#20190F' }}
            >
              Approve the real land first. Then design.
            </h3>
            <p
              className="text-xs font-display leading-relaxed mt-1"
              style={{ color: '#6B5A44' }}
            >
              The studio reads your saved parcels and water shapes. Locked
              geometry is treated as farmer truth — the AI designs around it
              without moving it.
            </p>
          </div>
        </div>
      </div>

      {/* ── STATS ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ['Layers found', String(studio.layers.length), <Layers3 key="layers" size={15} />],
            ['Approved', String(approvedCount), <CheckCircle2 key="approved" size={15} />],
            ['Locked', String(lockedCount), <Lock key="locked" size={15} />],
            ['Water area', formatDesignArea(waterArea), <Droplets key="water" size={15} />],
          ] as [string, string, React.ReactNode][]
        ).map(([label, value, icon]) => (
          <div
            key={String(label)}
            className="rounded-2xl p-3"
            style={{ background: '#F6EFE4', border: `1px solid ${CARD_BORDER}` }}
          >
            <div
              className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider"
              style={{ color: '#9A8268' }}
            >
              {icon}
              {label}
            </div>
            <div
              className="font-display font-bold text-base mt-1"
              style={{ color: '#20190F' }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── LAYER MANAGER ─────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-3 space-y-2"
        style={{ background: '#F5EFE5', border: `1px solid ${CARD_BORDER}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4
              className="font-display font-semibold text-sm"
              style={{ color: '#20190F' }}
            >
              Real map layers
            </h4>
            <p
              className="text-xs font-display"
              style={{ color: '#8A7860' }}
            >
              Approve and lock only what the farmer agrees is correct.
            </p>
          </div>
          <button
            onClick={refreshNow}
            className={buttonBase}
            style={{
              background: '#EDE2CF',
              color: '#5C5040',
              border: `1px solid ${CARD_BORDER}`,
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {studio.layers.length === 0 ? (
          <div
            className="rounded-2xl p-4 text-center"
            style={{
              background: '#FBF7ED',
              border: `1px dashed ${CARD_BORDER}`,
            }}
          >
            <MapIcon size={22} className="mx-auto mb-2" style={{ color: '#1F4D2B' }} />
            <div
              className="font-display font-semibold text-sm"
              style={{ color: '#20190F' }}
            >
              No drawn geometry found yet
            </div>
            <p
              className="text-xs font-display mt-1"
              style={{ color: '#7B6A52' }}
            >
              Go back to the map, draw a land boundary or water shape, then
              tap Refresh.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {studio.layers.map((layer) => (
              <div
                key={layer.id}
                className="rounded-2xl p-3"
                style={{
                  background: layer.approved ? '#FBF7ED' : 'rgba(251,247,237,0.62)',
                  border: `1px solid ${layer.approved ? 'rgba(31,77,43,0.28)' : CARD_BORDER}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-3 h-12 rounded-full flex-shrink-0"
                    style={{ background: getDesignLayerColor(layer.layerType) }}
                  />
                  <div className="flex-1 min-w-0">
                    <input
                      value={layer.name}
                      onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                      className="w-full bg-transparent outline-none font-display font-bold text-sm"
                      style={{ color: '#20190F' }}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <select
                        value={layer.layerType}
                        onChange={(e) =>
                          updateLayer(layer.id, {
                            layerType: e.target.value as DesignLayerType,
                          })
                        }
                        className="rounded-lg px-2 py-1 text-xs font-display outline-none"
                        style={{
                          background: '#EFE6D6',
                          border: `1px solid ${CARD_BORDER}`,
                          color: '#5C5040',
                        }}
                      >
                        {LAYER_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {getDesignLayerTypeLabel(type)}
                          </option>
                        ))}
                      </select>
                      <span
                        className="text-xs font-mono"
                        style={{ color: '#8A7860' }}
                      >
                        {layer.areaLabel}
                      </span>
                      <span
                        className="text-xs font-mono"
                        style={{ color: '#8A7860' }}
                      >
                        {layer.geometryType}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() =>
                        updateLayer(layer.id, { approved: !layer.approved })
                      }
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: layer.approved ? '#D9F0CD' : '#EFE6D6',
                        color: layer.approved ? '#1F4D2B' : '#8A7860',
                        border: `1px solid ${CARD_BORDER}`,
                      }}
                      aria-label={
                        layer.approved ? 'Unapprove layer' : 'Approve layer'
                      }
                    >
                      {layer.approved ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <CircleDashed size={17} />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        updateLayer(layer.id, {
                          locked: !layer.locked,
                          approved: layer.locked ? layer.approved : true,
                        })
                      }
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{
                        background: layer.locked ? '#1F4D2B' : '#EFE6D6',
                        color: layer.locked ? '#EAF3E2' : '#8A7860',
                        border: `1px solid ${CARD_BORDER}`,
                      }}
                      aria-label={
                        layer.locked ? 'Unlock layer' : 'Lock layer'
                      }
                    >
                      {layer.locked ? (
                        <Lock size={16} />
                      ) : (
                        <LockOpen size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              onClick={approveAll}
              className={`${buttonBase} w-full`}
              style={{
                background: '#E0F2D2',
                color: '#1F4D2B',
                border: '1px solid rgba(31,77,43,0.24)',
              }}
            >
              <ShieldCheck size={14} /> Approve and lock all drawn layers
            </button>
          </div>
        )}
      </div>

      {/* ── DESIGN OUTPUTS ────────────────────────────────────────────────── */}
      <div
        className="rounded-3xl p-3 space-y-3"
        style={{ background: '#EFE6D6', border: `1px solid ${CARD_BORDER}` }}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4
              className="font-display font-semibold text-sm"
              style={{ color: '#20190F' }}
            >
              Generated design outputs
            </h4>
            <p
              className="text-xs font-display"
              style={{ color: '#7B6A52' }}
            >
              AI-enhanced zone, water, access, opportunity maps. PNG & PDF export.
            </p>
          </div>
          <button
            onClick={generatePlan}
            disabled={!approvedCount || generating}
            className={buttonBase}
            style={
              !approvedCount || generating
                ? {
                    background: '#D8CDBA',
                    color: '#998A75',
                    border: `1px solid ${CARD_BORDER}`,
                  }
                : {
                    background: '#1F4D2B',
                    color: '#EAF3E2',
                    border: '1px solid rgba(31,77,43,0.35)',
                  }
            }
          >
            <Wand2 size={14} />
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {!approvedCount && (
          <div
            className="rounded-2xl p-3 flex gap-2"
            style={{
              background: 'rgba(192,83,30,0.08)',
              border: '1px solid rgba(192,83,30,0.2)',
              color: '#8B451D',
            }}
          >
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs font-display leading-relaxed">
              Approve at least one layer before generating design maps. Best
              result: approve and lock the boundary, roof/home, access,
              cultivation, and water.
            </p>
          </div>
        )}

        {/* ── VIEW CONTROLS ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div
            className="flex rounded-xl overflow-hidden"
            style={{ border: `1px solid ${CARD_BORDER}` }}
          >
            {MAP_VIEWS.map((view, i) => (
              <button
                key={view.id}
                onClick={() => setMapView(view.id)}
                className="px-3 py-1.5 text-xs font-display font-semibold transition-all"
                style={{
                  background:
                    mapView === view.id ? '#1F4D2B' : '#FBF7ED',
                  color:
                    mapView === view.id ? '#EAF3E2' : '#5C5040',
                  borderRight:
                    i < MAP_VIEWS.length - 1
                      ? `1px solid ${CARD_BORDER}`
                      : 'none',
                }}
              >
                {view.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFill((v) => !v)}
            className={buttonBase}
            style={{
              background: showFill ? '#E8DDC9' : '#FBF7ED',
              color: showFill ? '#9E5C08' : '#8A7860',
              border: `1px solid ${showFill ? 'rgba(158,92,8,0.35)' : CARD_BORDER}`,
            }}
            aria-pressed={showFill}
          >
            <Layers3 size={13} />
            Fill / hatch {showFill ? 'on' : 'off'}
          </button>

          {hasStudioBuild && (
            <button
              onClick={() => setShowStudioBuild((v) => !v)}
              className={buttonBase}
              style={{
                background: showStudioBuild ? '#E8DDC9' : '#FBF7ED',
                color: showStudioBuild ? '#9E5C08' : '#8A7860',
                border: `1px solid ${showStudioBuild ? 'rgba(158,92,8,0.35)' : CARD_BORDER}`,
              }}
              aria-pressed={showStudioBuild}
            >
              🎨 Studio design {showStudioBuild ? 'on' : 'off'}
            </button>
          )}
        </div>

        {/* Base-map completeness hint — house & driveway are what's usually missing */}
        {studio.layers.length > 0 && (!hasHouse || !hasDriveway) && (
          <div
            className="rounded-xl px-3 py-2 text-xs flex items-start gap-2"
            style={{ background: 'rgba(158,92,8,0.08)', border: '1px solid rgba(158,92,8,0.25)', color: '#7A5208' }}
          >
            <span aria-hidden>🏠</span>
            <span>
              {!hasHouse && !hasDriveway
                ? 'Your house and driveway aren’t on the map yet. Trace them on the map (House/Roof + Driveway) and they’ll fill in here automatically — no AI needed.'
                : !hasHouse
                  ? 'Your house isn’t traced yet. Trace it on the map as House/Roof so it shows filled in on every map.'
                  : 'Your driveway isn’t traced yet. Trace it on the map as Driveway/Access so it shows on every map.'}
            </span>
          </div>
        )}

        {/* ── SVG PREVIEW ─────────────────────────────────────────────────── */}
        <GeometryPreview
          layers={studio.layers}
          title={title}
          hasPlan={hasPlan}
          svgRef={svgRef}
          locationData={locationData}
          mapView={mapView}
          showFill={showFill}
          aiPlan={aiPlan}
          satDataUrl={satDataUrl}
          implementationPhases={reportDoc.sections.implementation}
          siteElements={siteElements}
          studioBuild={showStudioBuild ? studioBuild : null}
        />

        {/* ── EXPORT BUTTONS ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={exportPng}
            disabled={exporting !== '' || studio.layers.length === 0}
            className={buttonBase}
            style={{
              background: '#FBF7ED',
              color: '#9E5C08',
              border: `1px solid ${CARD_BORDER}`,
            }}
          >
            <Download size={14} />
            {exporting === 'png' ? 'Exporting…' : 'Export PNG'}
          </button>
          <button
            onClick={exportPdf}
            disabled={exporting !== '' || studio.layers.length === 0}
            className={buttonBase}
            style={{
              background: '#FBF7ED',
              color: '#1F4D2B',
              border: `1px solid ${CARD_BORDER}`,
            }}
          >
            <FileDown size={14} />
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>

        {/* ── AI RENDERS — glossy Gemini version of any map ─────────────────── */}
        {OVERLAY_VIEWS.has(mapView) && (
          <div
            className="space-y-2 rounded-2xl p-3"
            style={{ background: 'linear-gradient(135deg,#10240F,#1F4D2B)', border: `1px solid ${CARD_BORDER}` }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={16} color="#F7C97E" />
              <span className="text-sm font-display font-bold" style={{ color: '#FFFFFF' }}>AI Render — glossy version of any map</span>
            </div>
            <p className="text-xs" style={{ color: '#C9E0BE' }}>
              Pick a map, then generate a photo-style render of it (fed your real satellite,
              survey, polygons & photos). Beautiful for sharing — the exact SVG maps stay the source of truth.
            </p>
            {/* 8-map picker */}
            <div className="flex flex-wrap gap-1.5">
              {([
                { id: 'overall', label: 'Full Design' },
                { id: 'base', label: 'Existing Site' },
                { id: 'sector', label: 'Sector' },
                { id: 'zone', label: 'Zones' },
                { id: 'water', label: 'Water' },
                { id: 'opportunity', label: 'Opportunities' },
                { id: 'planting', label: 'Planting' },
                { id: 'implementation', label: 'Phasing' },
              ] as Array<{ id: AiRenderLayer; label: string }>).map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setRenderLayer(l.id);
                    // Auto-show cached render if available — no need to regenerate
                    if (aiRenderCache[l.id]) setAiRender(aiRenderCache[l.id]!);
                    else setAiRender(null);
                  }}
                  disabled={aiRendering}
                  className="text-xs rounded-full px-3 py-1 font-semibold"
                  style={{
                    background: renderLayer === l.id ? '#F7C97E' : 'rgba(255,255,255,0.1)',
                    color: renderLayer === l.id ? '#20190F' : '#EAF3E2',
                    border: aiRenderCache[l.id] ? '1px solid #F7C97E' : '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  {l.label}{aiRenderCache[l.id] ? ' ✓' : ''}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => aiRenderCache[renderLayer] ? runAiRender(renderLayer, true) : renderSelectedLayer(renderLayer)}
                disabled={aiRendering || !satDataUrl}
                className={buttonBase}
                style={{
                  flex: 1,
                  background: aiRendering ? '#EFE7D6' : '#F7C97E',
                  color: aiRendering ? '#6B5B3E' : '#20190F',
                  border: 'none',
                  opacity: !satDataUrl ? 0.5 : 1,
                  fontWeight: 700,
                }}
                title={!satDataUrl ? 'Let the satellite load first' : 'Generate a glossy AI render of this map'}
              >
                <Sparkles size={14} />
                {aiRendering ? 'Generating… (~20s)' : aiRenderCache[renderLayer] ? `Regenerate ${renderLayer} map` : `Render ${renderLayer} map`}
              </button>
              <button
                onClick={() => setAiSatOnly((v) => !v)}
                title={aiSatOnly ? 'Satellite only — AI interprets the land freely. Click for composite (with traced polygons).' : 'Composite — overlay + satellite baked together so AI sees your geometry. Click for satellite-only.'}
                style={{
                  flexShrink: 0,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.22)',
                  background: aiSatOnly ? 'rgba(120,200,255,0.18)' : 'rgba(255,255,255,0.08)',
                  color: aiSatOnly ? '#7ECFFF' : '#C8D4C0',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {aiSatOnly ? '🛰 sat only' : '🗺 overlaid'}
              </button>
            </div>
            {/* Provider + model toggles */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(['gemini', 'openai', 'falgpt'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setAiProvider(p)}
                  title={p === 'falgpt' ? 'GPT Image 2 via fal queue — slower (~30–90s), uses your fal credit, no 60s limit' : undefined}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: aiProvider === p ? '1.5px solid #F7C97E' : '1px solid rgba(255,255,255,0.15)',
                    background: aiProvider === p ? 'rgba(247,201,126,0.12)' : 'rgba(255,255,255,0.05)',
                    color: aiProvider === p ? '#F7C97E' : '#8FA882',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {p === 'gemini' ? '✦ Gemini' : p === 'openai' ? '⬡ ChatGPT' : '◆ GPT-2'}
                </button>
              ))}
              {aiProvider === 'gemini' && (
                <div className="flex gap-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 6 }}>
                  {(['flash', 'pro', 'pro-preview'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setGeminiModel(m)}
                      style={{
                        padding: '3px 7px',
                        borderRadius: 5,
                        border: geminiModel === m ? '1px solid #F7C97E' : '1px solid rgba(255,255,255,0.1)',
                        background: geminiModel === m ? 'rgba(247,201,126,0.1)' : 'transparent',
                        color: geminiModel === m ? '#F7C97E' : '#6B7C65',
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {m === 'flash' ? '3.1 Flash' : m === 'pro' ? '3 Pro' : '3 Pro preview'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {aiRenderError && (
              <p className="text-xs" style={{ color: '#FFC7B5' }}>{aiRenderError}</p>
            )}
            {aiRender && (
              <div className="space-y-1">
                <HybridRender
                  imageDataUrl={aiRender}
                  placeName={title}
                  mapType={AI_MAP_LABELS[renderLayer]}
                  biome={locationData?.biome?.name}
                  rainfallMm={locationData?.rainfall?.annual ?? undefined}
                  soilTexture={locationData?.soil?.textureClass ?? undefined}
                  satUrl={renderLayer === 'base' || renderLayer === 'sector' ? null : satDataUrl}
                  clip={renderLayer === 'base' || renderLayer === 'sector' ? null : aiClipFrame}
                  filename={`${slugify(title)}-${renderLayer}-hybrid.png`}
                  onTouchUp={handleTouchUp}
                />
                <p className="text-xs" style={{ color: '#9DB48E' }}>
                  AI render ({aiProvider}) — visualisation only; the SVG map above is the exact version.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STRUCTURED REPORT (beta) — 11-section, map-linked ─────────────── */}
        {locationData && studio.layers.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setShowReportDoc((v) => !v)}
              className={buttonBase}
              style={{
                width: '100%',
                background: '#FBF7ED',
                color: '#1F4D2B',
                border: `1px solid ${CARD_BORDER}`,
              }}
            >
              <FileText size={14} />
              {showReportDoc ? 'Hide structured report' : 'Structured Report (beta) — Executive + Implementation + more'}
            </button>
            {showReportDoc && <ReportDocView doc={reportDoc} onViewMap={viewMapFromReport} />}
          </div>
        )}

        {/* ── TEXT PLAN CARDS ─────────────────────────────────────────────── */}
        {studio.generatedPlan && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <PlanCard
              title="Sector map"
              sections={studio.generatedPlan.sectorMap}
              icon={<Compass size={15} />}
            />
            <PlanCard
              title="Zone map"
              sections={studio.generatedPlan.zoneMap}
              icon={<Layers3 size={15} />}
            />
            <PlanCard
              title="Water movement"
              sections={studio.generatedPlan.waterMap}
              icon={<Droplets size={15} />}
            />
            <PlanCard
              title="Opportunities"
              sections={studio.generatedPlan.opportunityMap}
              icon={<Sparkles size={15} />}
            />
          </div>
        )}

        {/* AI plan summary card */}
        {aiPlan && (
          <div
            className="rounded-2xl p-3"
            style={{
              background: 'rgba(31,77,43,0.07)',
              border: '1px solid rgba(31,77,43,0.20)',
            }}
          >
            <div
              className="text-xs font-mono uppercase tracking-wider mb-1"
              style={{ color: '#1F4D2B' }}
            >
              AI design summary
            </div>
            <p
              className="text-xs font-display leading-relaxed"
              style={{ color: '#3D5A44' }}
            >
              {aiPlan.summary}
            </p>
            {aiPlan.notes && (
              <p
                className="text-xs font-display leading-relaxed mt-1"
                style={{ color: '#6B7D6E' }}
              >
                {aiPlan.notes}
              </p>
            )}
          </div>
        )}

        {/* Message */}
        {message && (
          <div
            className="text-xs font-display rounded-xl px-3 py-2"
            style={{
              background: '#FBF7ED',
              border: `1px solid ${CARD_BORDER}`,
              color: '#5C5040',
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
