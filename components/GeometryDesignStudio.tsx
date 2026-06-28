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

interface Props {
  locationData: LocationData | null;
}

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
  const xs = coords.map((coord) => coord[0]).filter(Number.isFinite);
  const ys = coords.map((coord) => coord[1]).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function makeProjector(bounds: ReturnType<typeof getBounds>, width: number, height: number, pad: number) {
  // GEOMETRY MUST STAY EXACT. 1° longitude is shorter than 1° latitude away from the
  // equator (× cos(lat)), so projecting raw degrees with one scale stretches shapes
  // horizontally. Correct longitude by cos(centre latitude) so real proportions are kept.
  const cosLat = Math.max(Math.cos(((bounds.minY + bounds.maxY) / 2) * Math.PI / 180), 0.01);
  const dx = Math.max((bounds.maxX - bounds.minX) * cosLat, 0.000001); // lng span in lat-equivalent units
  const dy = Math.max(bounds.maxY - bounds.minY, 0.000001);
  const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy);
  const mapWidth = dx * scale;
  const mapHeight = dy * scale;
  const offsetX = (width - mapWidth) / 2;
  const offsetY = (height - mapHeight) / 2;

  return (coord: Position) => {
    const x = offsetX + (coord[0] - bounds.minX) * cosLat * scale;
    const y = offsetY + (bounds.maxY - coord[1]) * scale;
    return [Number.isFinite(x) ? x : width / 2, Number.isFinite(y) ? y : height / 2] as const;
  };
}

function ringToPath(ring: Position[], project: (coord: Position) => readonly [number, number]) {
  if (!ring.length) return '';
  return ring.map((coord, index) => {
    const [x, y] = project(coord);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function lineToPath(line: Position[], project: (coord: Position) => readonly [number, number]) {
  if (!line.length) return '';
  return line.map((coord, index) => {
    const [x, y] = project(coord);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

function geometryToPaths(geometry: Geometry, project: (coord: Position) => readonly [number, number]): string[] {
  switch (geometry.type) {
    case 'Polygon':
      return geometry.coordinates.map((ring) => ringToPath(ring, project)).filter(Boolean);
    case 'MultiPolygon':
      return geometry.coordinates.flatMap((polygon) => polygon.map((ring) => ringToPath(ring, project))).filter(Boolean);
    case 'LineString':
      return [lineToPath(geometry.coordinates, project)].filter(Boolean);
    case 'MultiLineString':
      return geometry.coordinates.map((line) => lineToPath(line, project)).filter(Boolean);
    case 'GeometryCollection':
      return geometry.geometries.flatMap((child) => geometryToPaths(child, project));
    default:
      return [];
  }
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'imbewu-design';
}

function svgToPngDataUrl(svg: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const width = Number(svg.getAttribute('width')) || 960;
    const height = Number(svg.getAttribute('height')) || 620;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * 2;
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Could not prepare export canvas.'));
        return;
      }
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(2, 2);
      ctx.drawImage(image, 0, 0, width, height);
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

function PlanCard({ title, sections, icon }: { title: string; sections: DesignPlanSection[]; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'rgba(255,255,255,0.45)', border: `1px solid ${CARD_BORDER}` }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: '#E8DDC9', color: '#1F4D2B' }}>
          {icon}
        </span>
        <h4 className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{title}</h4>
      </div>
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="text-xs font-display font-semibold" style={{ color: '#9E5C08' }}>{section.title}</div>
            <p className="text-xs font-display leading-relaxed" style={{ color: '#5C5040' }}>{section.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const buttonBase = 'rounded-xl px-3 py-2 text-xs font-display font-semibold transition-all flex items-center justify-center gap-1.5';

/**
 * Compute centroid pixel coordinates for a layer's geometry.
 */
function layerCentroid(
  layer: DesignLayer,
  project: (coord: Position) => readonly [number, number],
  fallback: readonly [number, number],
): readonly [number, number] {
  const coords = collectPositions(layer.geometry);
  if (!coords.length) return fallback;
  const mid = coords.reduce<[number, number]>((sum, c) => [sum[0] + c[0], sum[1] + c[1]], [0, 0]);
  return project([mid[0] / coords.length, mid[1] / coords.length]);
}

/**
 * Approximate metres per degree of longitude at a given latitude.
 * Used only for the scale bar — accuracy is sufficient at parcel scale.
 */
function metersPerDegreeLon(latDeg: number): number {
  const latRad = (latDeg * Math.PI) / 180;
  return 111_320 * Math.cos(latRad);
}

/**
 * Given a raw metre span, round to a "nice" scale bar length.
 */
function niceScaleMetres(rawM: number): number {
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawM)));
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].map((v) => v * magnitude);
  // pick the largest candidate ≤ rawM * 0.4
  const target = rawM * 0.4;
  let best = candidates[0];
  for (const c of candidates) {
    if (c <= target) best = c;
  }
  return best;
}

function GeometryPreview({
  layers,
  title,
  hasPlan,
  svgRef,
  locationData,
}: {
  layers: DesignLayer[];
  title: string;
  hasPlan: boolean;
  svgRef: React.RefObject<SVGSVGElement>;
  locationData: LocationData | null;
}) {
  const width = 960;
  const height = 620;
  const drawableLayers = layers.filter((layer) => layer.approved);
  const visibleLayers = drawableLayers.length ? drawableLayers : layers;
  const bounds = getBounds(visibleLayers);
  const project = makeProjector(bounds, width, height, 62);
  const boundary = visibleLayers.find((layer) => layer.layerType === 'property_boundary') ?? visibleLayers[0];
  const center = boundary
    ? layerCentroid(boundary, project, [width / 2, height / 2])
    : ([width / 2, height / 2] as const);

  // --- Scale bar ---
  // Compute metres-per-pixel in the X direction using Web Mercator approximation.
  const midLatDeg = locationData?.lat ?? (bounds.minY + bounds.maxY) / 2;
  const lonSpanDeg = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const dx = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const dy = Math.max(bounds.maxY - bounds.minY, 0.000001);
  const mapRenderWidth = width - 62 * 2;
  const mapRenderHeight = height - 62 * 2;
  const scaleFromX = (lonSpanDeg * metersPerDegreeLon(midLatDeg)) / Math.min(mapRenderWidth, mapRenderHeight * (dx / dy));
  const metersPerPixel = scaleFromX;
  const mapPixelWidth = Math.min(mapRenderWidth, mapRenderHeight * (dx / dy));
  const scaleBarRawM = mapPixelWidth * metersPerPixel * 0.3;
  const scaleBarM = visibleLayers.length ? niceScaleMetres(scaleBarRawM) : 50;
  const scaleBarPx = scaleBarM / metersPerPixel;
  const scaleBarLabel = scaleBarM >= 1000 ? `${(scaleBarM / 1000).toFixed(1)} km` : `${scaleBarM} m`;
  const scaleBarX = 52;
  const scaleBarY = height - 50;

  // --- Data strip values ---
  const annualRainfall = locationData?.rainfall?.annual;
  const soilTexture = locationData?.soil?.textureClass;
  const minTemp = locationData?.climate?.minTemp;
  const maxTemp = locationData?.climate?.maxTemp;
  const elevation = locationData?.elevation?.elevation;
  const totalDesignedM2 = layers
    .filter((l) => l.approved && l.layerType !== 'water_body')
    .reduce((sum, l) => sum + l.areaM2, 0);
  const roofLayers = layers.filter((l) => l.approved && (l.layerType === 'roof'));
  const roofAreaM2 = roofLayers.reduce((sum, l) => sum + l.areaM2, 0);
  const hasRoof = roofAreaM2 > 0 && annualRainfall != null && annualRainfall > 0;
  const roofHarvestKL = hasRoof ? Math.round((roofAreaM2 * (annualRainfall ?? 0) * 0.8) / 1000) : null;
  const totalHa = totalDesignedM2 / 10_000;

  // Data strip rows — only include what we have
  type DataRow = { label: string; value: string };
  const dataRows: DataRow[] = [];
  if (annualRainfall != null) dataRows.push({ label: 'Rainfall (est.)', value: `${Math.round(annualRainfall)} mm/yr` });
  if (soilTexture) dataRows.push({ label: 'Soil texture', value: soilTexture });
  if (minTemp != null && maxTemp != null) dataRows.push({ label: 'Temp range', value: `${Math.round(minTemp)}–${Math.round(maxTemp)} °C` });
  if (elevation != null) dataRows.push({ label: 'Elevation', value: `${Math.round(elevation)} m` });
  if (totalDesignedM2 > 0) dataRows.push({ label: 'Designed area', value: totalHa >= 1 ? `${totalHa.toFixed(2)} ha` : `${Math.round(totalDesignedM2)} m²` });
  if (roofHarvestKL != null) dataRows.push({ label: 'Roof harvest (est.)', value: `${roofHarvestKL.toLocaleString()} kL/yr` });

  // Data panel geometry — left side, below title
  const dataPanelX = 52;
  const dataPanelY = 108;
  const dataPanelW = 220;
  const rowH = 22;
  const dataPanelH = dataRows.length > 0 ? 28 + dataRows.length * rowH : 0;

  // --- Legend: only layer types actually present ---
  const presentTypes = Array.from(new Set(visibleLayers.map((l) => l.layerType)));
  const legendCols = Math.min(presentTypes.length, 3);
  const legendRows = Math.ceil(presentTypes.length / legendCols);
  const legendW = legendCols * 130 + 22;
  const legendH = 36 + legendRows * 26;
  const legendX = 52;
  const legendY = height - 52 - legendH;

  // North arrow position (top-right, always)
  const northX = width - 118;
  const northY = 48;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto rounded-2xl shadow-sm"
      role="img"
      aria-label="Geometry first design map"
    >
      <defs>
        <pattern id="studio-grid" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="26" stroke="#C8B998" strokeWidth="3" opacity="0.35" />
        </pattern>
        <filter id="paper-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="9" floodColor="#2A1D10" floodOpacity="0.16" />
        </filter>
        <filter id="label-glow" x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width={width} height={height} rx="34" fill={PAPER} />
      <rect x="24" y="24" width={width - 48} height={height - 48} rx="28" fill="#FBF7ED" stroke="#D8C9AC" />
      <g opacity="0.48">
        {Array.from({ length: 8 }).map((_, index) => (
          <path
            key={index}
            d={`M ${60 + index * 116} 560 C ${120 + index * 50} 450, ${120 + index * 95} 210, ${220 + index * 86} 66`}
            fill="none"
            stroke="#E4D7BE"
            strokeWidth="2"
          />
        ))}
      </g>

      {/* Title */}
      <text x="52" y="64" fontFamily="serif" fontWeight="800" fontSize="31" fill="#20190F">{title}</text>
      <text x="54" y="90" fontFamily="sans-serif" fontSize="14" fill="#7B6A52">Geometry-first permaculture design</text>

      {/* Data strip — site info panel below title */}
      {dataRows.length > 0 && (
        <g>
          <rect x={dataPanelX} y={dataPanelY} width={dataPanelW} height={dataPanelH} rx="12" fill="rgba(32,25,15,0.80)" />
          <text x={dataPanelX + 12} y={dataPanelY + 18} fontFamily="sans-serif" fontWeight="800" fontSize="11" fill="#F7C97E" letterSpacing="0.08em">SITE DATA</text>
          {dataRows.map((row, i) => (
            <g key={row.label} transform={`translate(${dataPanelX + 12} ${dataPanelY + 28 + i * rowH})`}>
              <text x="0" y="13" fontFamily="sans-serif" fontSize="10" fill="#B9AA8E">{row.label}</text>
              <text x={dataPanelW - 24} y="13" textAnchor="end" fontFamily="sans-serif" fontWeight="700" fontSize="10" fill="#F7F0E4">{row.value}</text>
            </g>
          ))}
        </g>
      )}

      {visibleLayers.length === 0 ? (
        <g>
          <rect x="235" y="226" width="490" height="150" rx="26" fill="#EFE6D6" stroke="#D8C9AC" />
          <text x="480" y="288" textAnchor="middle" fontFamily="serif" fontWeight="800" fontSize="24" fill="#20190F">Draw land first</text>
          <text x="480" y="324" textAnchor="middle" fontFamily="sans-serif" fontSize="16" fill="#7B6A52">Add a boundary or water shape on the map, then refresh this studio.</text>
        </g>
      ) : (
        <>
          {/* Real geometry paths */}
          {visibleLayers.map((layer) => {
            const paths = geometryToPaths(layer.geometry, project);
            const stroke = getDesignLayerColor(layer.layerType);
            const fill = layer.layerType === 'water_body' ? 'rgba(78,166,216,0.32)' : layer.layerType === 'property_boundary' ? 'rgba(140,235,106,0.12)' : 'url(#studio-grid)';
            const strokeWidth = layer.layerType === 'property_boundary' ? 8 : 5;
            return (
              <g key={layer.id} filter={layer.locked ? 'url(#paper-shadow)' : undefined} opacity={layer.approved ? 1 : 0.38}>
                {paths.map((path, index) => (
                  <path
                    key={`${layer.id}-${index}`}
                    d={path}
                    fill={layer.geometryType.includes('Line') ? 'none' : fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
                {layer.geometry.type === 'Point' && (() => {
                  const [x, y] = project(layer.geometry.coordinates);
                  return <circle cx={x} cy={y} r="12" fill={stroke} stroke="#fff" strokeWidth="4" />;
                })()}
              </g>
            );
          })}

          {/* Feature labels — one per layer, near centroid, pill background */}
          {visibleLayers.map((layer) => {
            const [cx, cy] = layerCentroid(layer, project, [width / 2, height / 2]);
            const labelText = layer.name;
            const areaText = layer.areaLabel !== 'area unknown' ? ` · ${layer.areaLabel}` : '';
            const fullText = `${labelText}${areaText}`;
            // Estimate pill width by character count (monospace approximation)
            const pillW = Math.min(Math.max(fullText.length * 6.5 + 16, 60), 200);
            const pillH = 18;
            const pillX = cx - pillW / 2;
            const pillY = cy - pillH / 2;
            return (
              <g key={`label-${layer.id}`} opacity={layer.approved ? 1 : 0.55}>
                <rect x={pillX} y={pillY} width={pillW} height={pillH} rx="9" fill="rgba(32,25,15,0.76)" />
                <text
                  x={cx}
                  y={cy + 5}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  fontSize="9.5"
                  fontWeight="600"
                  fill="#F7F0E4"
                >
                  {fullText.length > 28 ? `${fullText.slice(0, 27)}…` : fullText}
                </text>
              </g>
            );
          })}

          {/* Permaculture ZONES — anchored to the REAL features they describe (Zone 0 = house,
              2 = existing cultivation, 5 = tree belt/buffer). Not generic concentric rings:
              real zones map to actual areas + daily-use distance. A numbered badge sits on each. */}
          {(() => {
            const ZONE_BY_TYPE: Record<string, { z: number; color: string }> = {
              structure: { z: 0, color: '#3A352C' },
              roof: { z: 0, color: '#3A352C' },
              cultivation: { z: 2, color: '#C66A1C' },
              tree_belt: { z: 5, color: '#1F6E5A' },
            };
            return visibleLayers.map((layer) => {
              const zone = ZONE_BY_TYPE[layer.layerType];
              if (!zone) return null;
              const [cx, cy] = layerCentroid(layer, project, [width / 2, height / 2]);
              const by = cy - 26;
              return (
                <g key={`zone-${layer.id}`}>
                  <circle cx={cx} cy={by} r="13" fill={zone.color} stroke="#FBF7ED" strokeWidth="2.5" filter="url(#paper-shadow)" />
                  <text x={cx} y={by + 5} textAnchor="middle" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#FBF7ED">{zone.z}</text>
                </g>
              );
            });
          })()}
        </>
      )}

      {/* North arrow — top-right */}
      <g transform={`translate(${northX} ${northY})`}>
        <circle cx="34" cy="34" r="28" fill="#1F4D2B" opacity="0.94" />
        <path d="M34 10 L42 36 L34 31 L26 36 Z" fill="#F7F0E4" />
        <text x="34" y="72" textAnchor="middle" fontFamily="sans-serif" fontSize="12" fontWeight="800" fill="#1F4D2B">N</text>
      </g>

      {/* Legend — only present layer types, bottom-left */}
      {presentTypes.length > 0 && (
        <g transform={`translate(${legendX} ${legendY})`}>
          <rect width={legendW} height={legendH} rx="14" fill="rgba(32,25,15,0.82)" />
          <text x="14" y="22" fontFamily="sans-serif" fontWeight="800" fontSize="11" fill="#F7C97E" letterSpacing="0.08em">LEGEND</text>
          {presentTypes.map((type, index) => {
            const col = index % legendCols;
            const row = Math.floor(index / legendCols);
            return (
              <g key={type} transform={`translate(${14 + col * 130} ${34 + row * 26})`}>
                <rect width="12" height="12" rx="3" fill={getDesignLayerColor(type)} />
                <text x="18" y="10" fontFamily="sans-serif" fontSize="10" fill="#F7F0E4">{getDesignLayerTypeLabel(type)}</text>
              </g>
            );
          })}
        </g>
      )}

      {/* Scale bar — bottom, just above legend */}
      {visibleLayers.length > 0 && (
        <g transform={`translate(${scaleBarX} ${scaleBarY})`}>
          <rect x="0" y="-4" width={scaleBarPx + 80} height="22" rx="8" fill="rgba(32,25,15,0.72)" />
          <line x1="8" y1="9" x2={8 + scaleBarPx} y2="9" stroke="#F7F0E4" strokeWidth="2.5" />
          <line x1="8" y1="4" x2="8" y2="14" stroke="#F7F0E4" strokeWidth="2" />
          <line x1={8 + scaleBarPx} y1="4" x2={8 + scaleBarPx} y2="14" stroke="#F7F0E4" strokeWidth="2" />
          <text x={8 + scaleBarPx + 8} y="13" fontFamily="sans-serif" fontSize="10" fontWeight="700" fill="#F7C97E">{scaleBarLabel}</text>
        </g>
      )}

      {/* Footer note */}
      <text x={width - 52} y={height - 36} textAnchor="end" fontFamily="sans-serif" fontSize="11" fill="#7B6A52">
        Locked geometry stays fixed · ImbewuField
      </text>
    </svg>
  );
}

export default function GeometryDesignStudio({ locationData }: Props) {
  const siteId = designSiteIdFromLocation(locationData);
  const [studio, setStudio] = useState<DesignStudioState>(() => emptyDesignStudioState(siteId));
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState<'png' | 'pdf' | ''>('');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const refresh = () => {
      const nextSiteId = designSiteIdFromLocation(locationData);
      const saved = loadDesignStudioState(nextSiteId);
      const merged = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), saved, nextSiteId);
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

  const approvedCount = studio.layers.filter((layer) => layer.approved).length;
  const lockedCount = studio.layers.filter((layer) => layer.locked).length;
  const totalArea = studio.layers
    .filter((layer) => layer.approved && layer.layerType !== 'water_body')
    .reduce((sum, layer) => sum + layer.areaM2, 0);
  const waterArea = studio.layers
    .filter((layer) => layer.approved && layer.layerType === 'water_body')
    .reduce((sum, layer) => sum + layer.areaM2, 0);
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
    const merged = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), saved, siteId);
    setStudio(merged);
    setMessage('Refreshed from the map shapes.');
  }

  function generatePlan() {
    if (!approvedCount) {
      setMessage('Approve at least one real map layer first.');
      return;
    }
    commit((current) => ({
      ...current,
      generatedPlan: generateGeometryDesignPlan(current, locationData),
    }));
    setMessage('Design maps generated without moving the approved geometry.');
  }

  async function exportPng() {
    if (!svgRef.current) return;
    setExporting('png');
    setMessage('');
    try {
      const dataUrl = await svgToPngDataUrl(svgRef.current);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${slugify(title)}-design-map.png`;
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
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFillColor(247, 240, 228);
      doc.rect(0, 0, 842, 595, 'F');
      doc.setFont('times', 'bold');
      doc.setTextColor(32, 25, 15);
      doc.setFontSize(28);
      doc.text('ImbewuField Design Map', 42, 54);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(92, 80, 64);
      doc.text(`${title} - ${new Date().toLocaleDateString()}`, 42, 75);
      doc.addImage(dataUrl, 'PNG', 42, 96, 535, 346);
      doc.setDrawColor(216, 201, 172);
      doc.roundedRect(600, 96, 200, 346, 16, 16, 'S');
      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(31, 77, 43);
      doc.text('Farmer Notes', 620, 126);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(92, 80, 64);
      const notes = studio.generatedPlan?.exportNotes ?? [
        'Approve and lock real geometry before final design.',
        'Use map outputs as discussion material with the farmer.',
      ];
      let y = 152;
      notes.forEach((note) => {
        const lines = doc.splitTextToSize(`- ${note}`, 158);
        doc.text(lines, 620, y);
        y += lines.length * 13 + 9;
      });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(158, 92, 8);
      doc.text(`Approved layers: ${approvedCount}`, 42, 474);
      doc.text(`Locked layers: ${lockedCount}`, 190, 474);
      doc.text(`Land area: ${formatDesignArea(totalArea)}`, 320, 474);
      doc.text(`Water area: ${formatDesignArea(waterArea)}`, 470, 474);
      doc.save(`${slugify(title)}-design-map.pdf`);
      setMessage('PDF exported.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(145deg, rgba(31,77,43,0.12), rgba(158,92,8,0.08))', border: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm" style={{ background: '#1F4D2B', color: '#EAF3E2' }}>
            <ShieldCheck size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-mono uppercase tracking-wider" style={{ color: '#9E5C08' }}>Geometry-first Design Studio</div>
            <h3 className="font-display font-bold text-lg leading-tight" style={{ color: '#20190F' }}>Approve the real land first. Then design.</h3>
            <p className="text-xs font-display leading-relaxed mt-1" style={{ color: '#6B5A44' }}>
              The studio reads your saved parcels and water shapes. Locked geometry is treated as farmer truth, so generated design maps can style and label it but not move it.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ['Layers found', String(studio.layers.length), <Layers3 key="layers" size={15} />],
          ['Approved', String(approvedCount), <CheckCircle2 key="approved" size={15} />],
          ['Locked', String(lockedCount), <Lock key="locked" size={15} />],
          ['Water area', formatDesignArea(waterArea), <Droplets key="water" size={15} />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="rounded-2xl p-3" style={{ background: '#F6EFE4', border: `1px solid ${CARD_BORDER}` }}>
            <div className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider" style={{ color: '#9A8268' }}>
              {icon}{label}
            </div>
            <div className="font-display font-bold text-lg mt-1" style={{ color: '#20190F' }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl p-3 space-y-2" style={{ background: '#F5EFE5', border: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>Real map layers</h4>
            <p className="text-xs font-display" style={{ color: '#8A7860' }}>Approve and lock only what the farmer agrees is correct.</p>
          </div>
          <button onClick={refreshNow} className={buttonBase} style={{ background: '#EDE2CF', color: '#5C5040', border: `1px solid ${CARD_BORDER}` }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {studio.layers.length === 0 ? (
          <div className="rounded-2xl p-4 text-center" style={{ background: '#FBF7ED', border: `1px dashed ${CARD_BORDER}` }}>
            <MapIcon size={22} className="mx-auto mb-2" style={{ color: '#1F4D2B' }} />
            <div className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>No drawn geometry found yet</div>
            <p className="text-xs font-display mt-1" style={{ color: '#7B6A52' }}>Go back to the map, draw a land boundary or water shape, then tap Refresh.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {studio.layers.map((layer) => (
              <div key={layer.id} className="rounded-2xl p-3" style={{ background: layer.approved ? '#FBF7ED' : 'rgba(251,247,237,0.62)', border: `1px solid ${layer.approved ? 'rgba(31,77,43,0.28)' : CARD_BORDER}` }}>
                <div className="flex items-start gap-3">
                  <span className="w-3 h-12 rounded-full flex-shrink-0" style={{ background: getDesignLayerColor(layer.layerType) }} />
                  <div className="flex-1 min-w-0">
                    <input
                      value={layer.name}
                      onChange={(event) => updateLayer(layer.id, { name: event.target.value })}
                      className="w-full bg-transparent outline-none font-display font-bold text-sm"
                      style={{ color: '#20190F' }}
                    />
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <select
                        value={layer.layerType}
                        onChange={(event) => updateLayer(layer.id, { layerType: event.target.value as DesignLayerType })}
                        className="rounded-lg px-2 py-1 text-xs font-display outline-none"
                        style={{ background: '#EFE6D6', border: `1px solid ${CARD_BORDER}`, color: '#5C5040' }}
                      >
                        {LAYER_TYPES.map((type) => (
                          <option key={type} value={type}>{getDesignLayerTypeLabel(type)}</option>
                        ))}
                      </select>
                      <span className="text-xs font-mono" style={{ color: '#8A7860' }}>{layer.areaLabel}</span>
                      <span className="text-xs font-mono" style={{ color: '#8A7860' }}>{layer.geometryType}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => updateLayer(layer.id, { approved: !layer.approved })}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: layer.approved ? '#D9F0CD' : '#EFE6D6', color: layer.approved ? '#1F4D2B' : '#8A7860', border: `1px solid ${CARD_BORDER}` }}
                      aria-label={layer.approved ? 'Unapprove layer' : 'Approve layer'}
                    >
                      {layer.approved ? <CheckCircle2 size={17} /> : <CircleDashed size={17} />}
                    </button>
                    <button
                      onClick={() => updateLayer(layer.id, { locked: !layer.locked, approved: layer.locked ? layer.approved : true })}
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: layer.locked ? '#1F4D2B' : '#EFE6D6', color: layer.locked ? '#EAF3E2' : '#8A7860', border: `1px solid ${CARD_BORDER}` }}
                      aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                    >
                      {layer.locked ? <Lock size={16} /> : <LockOpen size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={approveAll} className={`${buttonBase} w-full`} style={{ background: '#E0F2D2', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.24)' }}>
              <ShieldCheck size={14} /> Approve and lock all drawn layers
            </button>
          </div>
        )}
      </div>

      <div className="rounded-3xl p-3 space-y-3" style={{ background: '#EFE6D6', border: `1px solid ${CARD_BORDER}` }}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>Generated design outputs</h4>
            <p className="text-xs font-display" style={{ color: '#7B6A52' }}>Sector, zone, water, opportunity, PNG, and one-page PDF.</p>
          </div>
          <button
            onClick={generatePlan}
            disabled={!approvedCount}
            className={buttonBase}
            style={!approvedCount
              ? { background: '#D8CDBA', color: '#998A75', border: `1px solid ${CARD_BORDER}` }
              : { background: '#1F4D2B', color: '#EAF3E2', border: '1px solid rgba(31,77,43,0.35)' }}
          >
            <Wand2 size={14} /> Generate
          </button>
        </div>

        {!approvedCount && (
          <div className="rounded-2xl p-3 flex gap-2" style={{ background: 'rgba(192,83,30,0.08)', border: '1px solid rgba(192,83,30,0.2)', color: '#8B451D' }}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-xs font-display leading-relaxed">Approve at least one layer before generating design maps. Best result: approve and lock the boundary, roof/home, access, cultivation, and water.</p>
          </div>
        )}

        <GeometryPreview layers={studio.layers} title={title} hasPlan={!!studio.generatedPlan} svgRef={svgRef} locationData={locationData} />

        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportPng} disabled={exporting !== '' || studio.layers.length === 0} className={buttonBase} style={{ background: '#FBF7ED', color: '#9E5C08', border: `1px solid ${CARD_BORDER}` }}>
            <Download size={14} /> {exporting === 'png' ? 'Exporting...' : 'Export PNG'}
          </button>
          <button onClick={exportPdf} disabled={exporting !== '' || studio.layers.length === 0} className={buttonBase} style={{ background: '#FBF7ED', color: '#1F4D2B', border: `1px solid ${CARD_BORDER}` }}>
            <FileDown size={14} /> {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>

        {studio.generatedPlan && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <PlanCard title="Sector map" sections={studio.generatedPlan.sectorMap} icon={<Compass size={15} />} />
            <PlanCard title="Zone map" sections={studio.generatedPlan.zoneMap} icon={<Layers3 size={15} />} />
            <PlanCard title="Water movement" sections={studio.generatedPlan.waterMap} icon={<Droplets size={15} />} />
            <PlanCard title="Opportunities" sections={studio.generatedPlan.opportunityMap} icon={<Sparkles size={15} />} />
          </div>
        )}

        {message && (
          <div className="text-xs font-display rounded-xl px-3 py-2" style={{ background: '#FBF7ED', border: `1px solid ${CARD_BORDER}`, color: '#5C5040' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
