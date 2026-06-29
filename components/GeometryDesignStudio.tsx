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
  Copy,
  Check,
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
  buildMapPackPrompts,
  type DesignLayer,
  type DesignLayerType,
  type DesignPlanSection,
  type DesignStudioState,
  type MapPackEntry,
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
  const dx = Math.max(bounds.maxX - bounds.minX, 0.000001);
  const dy = Math.max(bounds.maxY - bounds.minY, 0.000001);
  const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy);
  const mapWidth = dx * scale;
  const mapHeight = dy * scale;
  const offsetX = (width - mapWidth) / 2;
  const offsetY = (height - mapHeight) / 2;

  return (coord: Position) => {
    const x = offsetX + (coord[0] - bounds.minX) * scale;
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

function GeometryPreview({
  layers,
  title,
  hasPlan,
  svgRef,
}: {
  layers: DesignLayer[];
  title: string;
  hasPlan: boolean;
  svgRef: React.RefObject<SVGSVGElement>;
}) {
  const width = 960;
  const height = 620;
  const drawableLayers = layers.filter((layer) => layer.approved);
  const visibleLayers = drawableLayers.length ? drawableLayers : layers;
  const bounds = getBounds(visibleLayers);
  const project = makeProjector(bounds, width, height, 62);
  const boundary = visibleLayers.find((layer) => layer.layerType === 'property_boundary') ?? visibleLayers[0];
  const center = boundary
    ? (() => {
        const coords = collectPositions(boundary.geometry);
        if (!coords.length) return [width / 2, height / 2] as const;
        const mid = coords.reduce<[number, number]>((sum, coord) => [sum[0] + coord[0], sum[1] + coord[1]], [0, 0]);
        return project([mid[0] / coords.length, mid[1] / coords.length]);
      })()
    : [width / 2, height / 2] as const;

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
      </defs>
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

      <text x="52" y="64" fontFamily="serif" fontWeight="800" fontSize="31" fill="#20190F">{title}</text>
      <text x="54" y="94" fontFamily="sans-serif" fontSize="16" fill="#7B6A52">Geometry-first permaculture design</text>

      {visibleLayers.length === 0 ? (
        <g>
          <rect x="235" y="226" width="490" height="150" rx="26" fill="#EFE6D6" stroke="#D8C9AC" />
          <text x="480" y="288" textAnchor="middle" fontFamily="serif" fontWeight="800" fontSize="24" fill="#20190F">Draw land first</text>
          <text x="480" y="324" textAnchor="middle" fontFamily="sans-serif" fontSize="16" fill="#7B6A52">Add a boundary or water shape on the map, then refresh this studio.</text>
        </g>
      ) : (
        <>
          {hasPlan && (
            <g opacity="0.92">
              <ellipse cx={center[0]} cy={center[1]} rx="92" ry="64" fill="rgba(255, 193, 82, 0.16)" stroke="#D58A18" strokeWidth="3" strokeDasharray="9 9" />
              <ellipse cx={center[0]} cy={center[1]} rx="158" ry="104" fill="rgba(90, 180, 103, 0.12)" stroke="#65A45F" strokeWidth="3" strokeDasharray="12 10" />
              <ellipse cx={center[0]} cy={center[1]} rx="228" ry="150" fill="rgba(50, 113, 74, 0.08)" stroke="#2F8F4E" strokeWidth="3" strokeDasharray="16 12" />
              <text x={center[0]} y={center[1] - 75} textAnchor="middle" fontFamily="sans-serif" fontSize="15" fontWeight="700" fill="#9E5C08">Zone 1</text>
              <text x={center[0] + 132} y={center[1] - 105} textAnchor="middle" fontFamily="sans-serif" fontSize="15" fontWeight="700" fill="#2F6B3F">Zone 2</text>
              <text x={center[0] - 190} y={center[1] + 130} textAnchor="middle" fontFamily="sans-serif" fontSize="15" fontWeight="700" fill="#1F4D2B">Zone 3</text>
            </g>
          )}

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
        </>
      )}

      <g transform="translate(820 55)">
        <circle cx="42" cy="42" r="34" fill="#1F4D2B" opacity="0.94" />
        <path d="M42 14 L52 45 L42 39 L32 45 Z" fill="#F7F0E4" />
        <text x="42" y="84" textAnchor="middle" fontFamily="sans-serif" fontSize="14" fontWeight="800" fill="#1F4D2B">N</text>
      </g>

      <g transform="translate(52 476)">
        <rect width="390" height="96" rx="22" fill="rgba(32,25,15,0.82)" />
        <text x="22" y="31" fontFamily="sans-serif" fontWeight="800" fontSize="15" fill="#F7F0E4">Legend</text>
        {LAYER_TYPES.slice(0, 6).map((type, index) => (
          <g key={type} transform={`translate(${22 + (index % 3) * 122} ${48 + Math.floor(index / 3) * 27})`}>
            <rect width="14" height="14" rx="4" fill={getDesignLayerColor(type)} />
            <text x="20" y="12" fontFamily="sans-serif" fontSize="12" fill="#F7F0E4">{getDesignLayerTypeLabel(type)}</text>
          </g>
        ))}
      </g>

      <text x={width - 52} y={height - 36} textAnchor="end" fontFamily="sans-serif" fontSize="13" fill="#7B6A52">
        Locked geometry stays fixed
      </text>
    </svg>
  );
}

function MapPromptPack({ studio, locationData }: { studio: DesignStudioState; locationData: LocationData | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const prompts: MapPackEntry[] = buildMapPackPrompts(studio, locationData);

  async function copy(entry: MapPackEntry) {
    try {
      await navigator.clipboard.writeText(entry.prompt);
      setCopied(entry.id);
      setTimeout(() => setCopied((c) => (c === entry.id ? null : c)), 1800);
    } catch { /* clipboard blocked */ }
  }

  return (
    <div className="rounded-xl p-3" style={{ background: '#FBF7ED', border: `1px solid ${CARD_BORDER}` }}>
      <div className="flex items-center gap-2 mb-1">
        <MapIcon size={15} style={{ color: '#1F4D2B' }} />
        <span className="text-sm font-display font-semibold" style={{ color: '#1F4D2B' }}>Map prompt pack</span>
      </div>
      <p className="text-xs font-display mb-3 leading-relaxed" style={{ color: '#7B6A52' }}>
        8 canonical maps for Gemini / ChatGPT image generation. Each prompt is woven with this site&apos;s data and your approved geometry. Use the Export PNG above as <strong>Image 1</strong> and a satellite screenshot as <strong>Image 2</strong>, then paste a prompt below. Generate one map at a time.
      </p>
      <div className="flex flex-col gap-1.5">
        {prompts.map((p) => (
          <div key={p.id} className="rounded-lg" style={{ background: PAPER, border: `1px solid ${CARD_BORDER}` }}>
            <div className="flex items-center gap-2 px-2.5 py-2">
              <span className="flex items-center justify-center rounded-md flex-shrink-0 text-xs font-display font-bold" style={{ width: 22, height: 22, background: 'rgba(31,77,43,0.1)', color: '#1F4D2B' }}>{p.n}</span>
              <button onClick={() => setOpenId((o) => (o === p.id ? null : p.id))} className="flex-1 min-w-0 text-left" style={{ cursor: 'pointer', background: 'none', border: 'none' }}>
                <div className="text-sm font-display font-semibold truncate" style={{ color: '#20190F' }}>{p.title}</div>
                <div className="text-xs font-display truncate" style={{ color: '#7B6A52' }}>{p.purpose}</div>
              </button>
              <button onClick={() => copy(p)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md flex-shrink-0 text-xs font-display font-semibold" style={{ background: copied === p.id ? 'rgba(31,77,43,0.15)' : '#FBF7ED', border: `1px solid ${CARD_BORDER}`, color: '#1F4D2B', cursor: 'pointer' }}>
                {copied === p.id ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>
            {openId === p.id && (
              <pre className="text-xs px-2.5 pb-2.5 whitespace-pre-wrap" style={{ color: '#5C5040', maxHeight: 220, overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>{p.prompt}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
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

        <GeometryPreview layers={studio.layers} title={title} hasPlan={!!studio.generatedPlan} svgRef={svgRef} />

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

        <MapPromptPack studio={studio} locationData={locationData} />

        {message && (
          <div className="text-xs font-display rounded-xl px-3 py-2" style={{ background: '#FBF7ED', border: `1px solid ${CARD_BORDER}`, color: '#5C5040' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
