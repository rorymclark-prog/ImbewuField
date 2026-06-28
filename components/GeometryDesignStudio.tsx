'use client';

import { startTransition, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Compass,
  Download,
  Droplets,
  FileDown,
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

// ── Props / view types ────────────────────────────────────────────────────────

interface Props {
  locationData: LocationData | null;
}

type MapView = 'base' | 'sector' | 'zone' | 'design';

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

// Zone badge colours — 0 charcoal, 1 red, 2 orange, 3 amber, 4 pale-green, 5 teal
const ZONE_COLORS: Record<number, string> = {
  0: '#3A352C',
  1: '#B53A3A',
  2: '#C66A1C',
  3: '#9B8B1E',
  4: '#2F7A4A',
  5: '#1A6B58',
};

const ZONE_KEY: Array<{ z: number; label: string; desc: string }> = [
  { z: 0, label: 'House', desc: 'Dwelling & immediate surroundings' },
  { z: 1, label: 'Daily use', desc: 'Herbs, kitchen garden, chickens' },
  { z: 2, label: 'Intensive', desc: 'Veggie beds, small animals' },
  { z: 3, label: 'Orchard / food forest', desc: 'Trees, perennials, larger plots' },
  { z: 4, label: 'Low-care', desc: 'Grazing, woodlot, fodder' },
  { z: 5, label: 'Conservation / buffer', desc: 'Wild, tree belts, boundary' },
];

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
  const houseLike = layers.find(
    (l) => l.layerType === 'roof' || l.layerType === 'structure',
  );
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
    const houseLike = layers.find(
      (l) => l.layerType === 'roof' || l.layerType === 'structure',
    );
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

function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const W = Number(svg.getAttribute('width')) || 960;
    const H = Number(svg.getAttribute('height')) || 620;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * 2;
      canvas.height = H * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not prepare export canvas.'));
        return;
      }
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(image, 0, 0, W, H);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the design map.'));
    };
    image.src = url;
  });
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
}: {
  layers: DesignLayer[];
  title: string;
  hasPlan: boolean;
  svgRef: React.RefObject<SVGSVGElement>;
  locationData: LocationData | null;
  mapView: MapView;
  showFill: boolean;
  aiPlan: DesignPlanAI | null;
}) {
  const SVG_W = 960;
  const SVG_H = 640;
  // Right rail width for Design view
  const RAIL_W = 220;
  // Map area width changes in design view to make room for the rail
  const mapAreaW = mapView === 'design' ? SVG_W - RAIL_W - 16 : SVG_W;

  const drawableLayers = layers.filter((l) => l.approved);
  const visibleLayers = drawableLayers.length ? drawableLayers : layers;
  const bounds = getBounds(visibleLayers);
  const PAD = 68;
  const project = makeProjector(bounds, mapAreaW, SVG_H, PAD);

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
  const metersPerPixel = (lonSpanDeg * metersPerDegreeLon(midLatDeg)) / mapPixelWidth;
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
  const showZoneKey = mapView === 'zone' || mapView === 'design';

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
    design: 'Permaculture Design',
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
      {/* Very subtle contour lines */}
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

      {/* ── TITLE BLOCK ───────────────────────────────────────────────────── */}
      {/* Title bar rule */}
      <line x1="48" y1="96" x2={mapAreaW - 48} y2="96" stroke="#C4B48C" strokeWidth="1" />
      <text
        x="52" y="66"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="800"
        fontSize="28"
        fill="#20190F"
      >
        {title}
      </text>
      <text
        x="52" y="87"
        fontFamily="'Helvetica Neue', Helvetica, Arial, sans-serif"
        fontSize="12"
        fill="#7B6A52"
        letterSpacing="0.04em"
      >
        Permaculture Design Map · {VIEW_LABELS[mapView]}
        {locationData?.biome?.name ? ` · ${locationData.biome.name}` : ''}
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
              layer.layerType === 'property_boundary' ? 7 : 4.5;
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

          {/* ── ZONE AREA FILLS — clipped to boundary (Zone + Design views) ─── */}
          {/* Drawn BEFORE badges so outlines + badges sit on top */}
          {showZoneBadges && aiPlan && boundaryPathForClip && (
            <g clipPath="url(#design-boundary-clip)">
              {aiPlan.zones.map((zone) => {
                const color = ZONE_COLORS[zone.n] ?? '#555';
                const [bx, by] = resolveAnchor(
                  zone.anchor,
                  visibleLayers,
                  project,
                  boundsCenter,
                  bboxPx,
                );
                const bboxW = bboxPx.maxX - bboxPx.minX;
                const bboxH = bboxPx.maxY - bboxPx.minY;

                // For anchors that map to a real feature layer, use the feature's
                // actual polygon path. Otherwise draw a generous ellipse.
                const anchorToLayerType: Partial<Record<AnchorHint, DesignLayerType>> = {
                  house: 'roof',
                  'existing-garden': 'cultivation',
                  'tree-belt': 'tree_belt',
                };
                const featureLayerType = anchorToLayerType[zone.anchor];
                const featureLayer = featureLayerType
                  ? visibleLayers.find((l) => l.layerType === featureLayerType)
                  : undefined;

                if (featureLayer) {
                  // Use the real projected polygon path
                  const paths = geometryToPaths(featureLayer.geometry, project);
                  return (
                    <g key={`zone-area-${zone.n}`}>
                      {paths.map((d, idx) => (
                        <path
                          key={idx}
                          d={d}
                          fill={color}
                          fillOpacity="0.16"
                          stroke={color}
                          strokeWidth="1.2"
                          strokeDasharray="5,3"
                          strokeOpacity="0.55"
                        />
                      ))}
                    </g>
                  );
                }

                // Proposed zone — generous ellipse (22-34% of bbox), clipped to boundary
                const rx = bboxW * (0.22 + zone.n * 0.025);
                const ry = bboxH * (0.22 + zone.n * 0.025);
                return (
                  <g key={`zone-area-${zone.n}`}>
                    <ellipse
                      cx={bx} cy={by}
                      rx={rx} ry={ry}
                      fill={color}
                      fillOpacity="0.16"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeDasharray="6,4"
                      strokeOpacity="0.60"
                    />
                  </g>
                );
              })}
            </g>
          )}

          {/* ── ZONE BADGES (Zone + Design views) ────────────────────────────── */}
          {showZoneBadges && aiPlan && aiPlan.zones.map((zone) => {
            const color = ZONE_COLORS[zone.n] ?? '#555';
            const [bx, by] = resolveAnchor(
              zone.anchor,
              visibleLayers,
              project,
              boundsCenter,
              bboxPx,
            );
            // Badge sits at the anchor point (no blob offset needed — areas are now fills)
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
                {/* Zone title caption below badge — de-collided */}
                <text
                  x={bx}
                  y={captionCy + 5}
                  textAnchor="middle"
                  fontFamily="'Helvetica Neue', sans-serif"
                  fontSize="8.5"
                  fontWeight="700"
                  fill={color}
                  opacity="0.88"
                >
                  {captionFull}
                </text>
              </g>
            );
          })}

          {/* ── OPPORTUNITY LABELS (Design view) ─────────────────────────── */}
          {showDesignElements && aiPlan && aiPlan.opportunities.map((opp, i) => {
            const [ox, oy] = resolveAnchor(
              opp.anchor,
              visibleLayers,
              project,
              boundsCenter,
              bboxPx,
            );
            const oppW = 180;
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
          {showDesignElements && aiPlan && aiPlan.water.map((w, i) => {
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
          {showDesignElements && aiPlan && aiPlan.access.map((a, i) => {
            // Vehicle: from boundary edge toward house; foot: from house outward
            const houseLike = visibleLayers.find(
              (l) => l.layerType === 'roof' || l.layerType === 'structure',
            );
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
      {presentTypes.length > 0 && mapView !== 'design' && (
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
        Locked geometry stays fixed · ImbewuField
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
            const notesText = aiPlan?.notes ?? 'Generate a plan to see design notes here.';
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

export default function GeometryDesignStudio({ locationData }: Props) {
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
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
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

  const approvedCount = studio.layers.filter((l) => l.approved).length;
  const lockedCount = studio.layers.filter((l) => l.locked).length;
  const totalArea = studio.layers
    .filter((l) => l.approved && l.layerType !== 'water_body')
    .reduce((s, l) => s + l.areaM2, 0);
  const waterArea = studio.layers
    .filter((l) => l.approved && l.layerType === 'water_body')
    .reduce((s, l) => s + l.areaM2, 0);
  const title = locationData?.biome?.name ?? 'ImbewuField Design';

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
      const dataUrl = await svgToPngDataUrl(svgRef.current);
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
      const dataUrl = await svgToPngDataUrl(svgRef.current);
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

  const MAP_VIEWS: Array<{ id: MapView; label: string }> = [
    { id: 'base', label: 'Base' },
    { id: 'sector', label: 'Sector' },
    { id: 'zone', label: 'Zone' },
    { id: 'design', label: 'Design' },
  ];

  // Effective plan: prefer AI plan; fall back to local generated plan for text cards
  const hasPlan = !!aiPlan || !!studio.generatedPlan;

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
        </div>

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
