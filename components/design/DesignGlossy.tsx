'use client';

// Design Studio — the STRICT final "glossy" render. Composites the farmer's exact
// design (satellite + zones + lines + items) into an image, builds a protect-mask that
// pixel-locks every farmer feature, then sends both to the AI render pipeline so the AI
// may only repaint background texture — never move, add, or remove anything the farmer
// placed.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, Gem, FlaskConical } from 'lucide-react';

import type { CanvasFrame, DesignCanvasState } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { ZONE_DEFS } from '@/lib/design-elements';
import { requestRender, stripDataUrl } from '@/lib/ai-render-client';

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
    'a square canvas that reaches all four edges',
  ],
  mustAvoid: [
    'invented buildings, paths, trees, beds, ponds, or decorations',
    'legends, keys, side panels, title cards, or borders',
    '3D perspective, tilt, or a redesign of the site',
    'labels stacked in a column with long leader lines',
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
  'Repaint ONLY the unprotected background as a beautiful hand-illustrated permaculture map ' +
  '(soft earth tones, gentle textures, subtle grass/soil detail). This design was drawn by the ' +
  'farmer: do NOT add, move, remove, resize or restyle ANY element, zone, line or label — every ' +
  'feature stays exactly where and how it is. Follow the strict map criteria.';

// Per-layer theming so each map READS as its own kind of map instead of one generic look.
// `title` names it; `focus` steers the background repaint; `emphasise` becomes extra
// must-include criteria pointing the AI at the features that matter for this map type.
const FILTER_THEME: Record<GlossyLayerFilter, { title: string; focus: string; emphasise: string[] }> = {
  all: {
    title: 'whole-farm permaculture design',
    focus: 'a complete permaculture homestead — zones, water, planting and structures reading together as one plan',
    emphasise: [],
  },
  water: {
    title: 'water plan',
    focus: 'a WATER-HARVESTING map: cool blue-green palette, rainwater tanks reading as tanks beside the roofs, swale lines as soft earth contours holding water, drip/pipe runs, ponds and greywater basins',
    emphasise: [
      'render the water background so it clearly reads as a water plan (subtle blue tint around tanks, swales and ponds; damp soil tones)',
      'make each rainwater tank, tap point, swale line, pipe/drip run and pond visually obvious and labelled',
      'suggest water soaking into the land along the swale lines, not running off',
    ],
  },
  zones: {
    title: 'zone map',
    focus: 'a permaculture ZONE map: each numbered zone (0–5) as a clearly coloured band radiating out from the house, warm near the home and wilder toward the edges',
    emphasise: [
      'render each zone as a distinct, clearly coloured and numbered area (Zone 1 nearest the house, higher numbers further out)',
      'keep the zone colours strong and legible so the zoning is the story of the map',
    ],
  },
  planting: {
    title: 'planting plan',
    focus: 'a PLANTING map: fruit and nut trees drawn at their mature canopy size, vegetable beds in neat rows, pollinator strips and mulch banks, lush green growing palette',
    emphasise: [
      'draw each tree as a leafy canopy at roughly its real mature size; show beds as tidy planted rows',
      'render tree shade falling to the south side so the planting logic is visible',
      'keep a rich, green, growing feel across the planted areas',
    ],
  },
  structures: {
    title: 'structures & animals plan',
    focus: 'a STRUCTURES map: sheds, coops, kraals, compost bays and beehives as clear little buildings, with access paths and fences, on a calm neutral palette',
    emphasise: [
      'render each structure as a clear, simple building footprint with a roof',
      'make animal housing, compost and beehives easy to pick out; show fences and access paths',
    ],
  },
};

function strictPromptFor(filter: GlossyLayerFilter): string {
  const theme = FILTER_THEME[filter];
  if (filter === 'all') return STRICT_PROMPT;
  return (
    `Repaint ONLY the unprotected background as ${theme.focus}. Keep it a beautiful hand-illustrated ` +
    'map. This design was drawn by the farmer: do NOT add, move, remove, resize or restyle ANY element, ' +
    'zone, line or label — every feature stays exactly where and how it is. Follow the strict map criteria.'
  );
}

function mapCriteriaFor(filter: GlossyLayerFilter) {
  const theme = FILTER_THEME[filter];
  return {
    mustInclude: [...theme.emphasise, ...STRICT_MAP_CRITERIA.mustInclude],
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

const GLOSSY_FILTERS: Array<{ key: GlossyLayerFilter; label: string }> = [
  { key: 'all', label: 'Whole design' },
  { key: 'water', label: 'Water' },
  { key: 'zones', label: 'Zones' },
  { key: 'planting', label: 'Planting' },
  { key: 'structures', label: 'Structures' },
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

function drawMarks(ctx: CanvasRenderingContext2D, state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], imgW: number, imgH: number, filter: GlossyLayerFilter = 'all') {
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

  // Zones — translucent fill (only when this layer is in the chosen filter)
  for (const zone of zonesInFilter(filter) ? state.zones : []) {
    if (zone.points.length < 3 || zone.feature) continue; // skip ground-feature areas — not effort-zones
    const def = ZONE_DEFS[zone.zone];
    ctx.beginPath();
    zone.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.fillStyle = `${def.color}33`;
    ctx.fill();
    ctx.strokeStyle = `${def.color}CC`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Lines
  for (const line of state.lines) {
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
  for (const item of state.items) {
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

async function buildComposite(state: DesignCanvasState, frame: CanvasFrame, refLayers: DesignGlossyProps['refLayers'], filter: GlossyLayerFilter = 'all'): Promise<string> {
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

  drawMarks(ctx, state, frame, refLayers, imgW, imgH, filter);

  return canvas.toDataURL('image/jpeg', 0.9);
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

  // Boundary ring stroke band.
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

  // Zone ring stroke bands (edges locked; interior remains editable background).
  for (const zone of zonesInFilter(filter) ? state.zones : []) {
    if (zone.points.length < 3 || zone.feature) continue; // ground-feature areas aren't effort-zones
    ctx.beginPath();
    zone.points.forEach(([x, y], i) => {
      const fn = i === 0 ? ctx.moveTo : ctx.lineTo;
      fn.call(ctx, px(x), py(y));
    });
    ctx.closePath();
    ctx.lineWidth = 8 * SCALE;
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

// ── Persistence — cache the last render per site so a page refresh doesn't lose it.
// dataURLs can be large; localStorage has a quota, so writes are best-effort.
interface SavedGlossy {
  image: string;
  provider: 'gemini' | 'falgpt';
  at: string;
}

// 'all' keeps the original site-scoped key (so existing saved renders survive); each other
// layer gets its own suffixed key so per-layer renders don't overwrite each other.
const glossyKey = (siteId: string, filter: GlossyLayerFilter = 'all') =>
  filter === 'all' ? `imbewu_design_glossy_${siteId}` : `imbewu_design_glossy_${siteId}_${filter}`;

function loadSavedGlossy(siteId: string, filter: GlossyLayerFilter = 'all'): SavedGlossy | null {
  try {
    const raw = localStorage.getItem(glossyKey(siteId, filter));
    if (!raw) return null;
    return JSON.parse(raw) as SavedGlossy;
  } catch {
    return null;
  }
}

function saveGlossy(siteId: string, filter: GlossyLayerFilter, saved: SavedGlossy) {
  try {
    localStorage.setItem(glossyKey(siteId, filter), JSON.stringify(saved));
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
  gemini: 'Gemini',
  falgpt: 'Strict map',
};

export default function DesignGlossy({ state, frame, refLayers, site, placeName, initialFilter }: DesignGlossyProps) {
  const [loading, setLoading] = useState<'gemini' | 'falgpt' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedGlossy | null>(null);
  const [filter, setFilter] = useState<GlossyLayerFilter>(initialFilter ?? 'all');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load the cached render for this site + chosen layer. Runs on mount and whenever the
  // farmer switches layer, so each map keeps its own last render.
  useEffect(() => {
    const cached = loadSavedGlossy(state.siteId, filter);
    setSaved(cached);
    setResultImage(cached ? cached.image : null);
    setError(null);
    // Only re-check when the site or layer changes, not on every state edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.siteId, filter]);

  const generate = useCallback(
    async (provider: 'gemini' | 'falgpt') => {
      setLoading(provider);
      setError(null);
      try {
        const composite = await buildComposite(state, frame, refLayers, filter);
        let image: string;
        if (provider === 'falgpt') {
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
              return def && itemInFilter(def.category, filter);
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
          const zones = zonesInFilter(filter)
            ? state.zones.filter((z) => !z.feature).map((z) => ({ n: z.zone, title: ZONE_DEFS[z.zone].label }))
            : [];
          const polygons = state.lines.filter((l) => lineInFilter(l.kind, filter)).map((l) => ({ name: l.kind, type: 'line' }));
          image = await requestRender({
            imageBase64: stripDataUrl(composite),
            satBase64: frame.satDataUrl ? stripDataUrl(frame.satDataUrl) : undefined,
            provider: 'gemini',
            geminiModel: 'pro-preview',
            context: {
              placeName,
              layer: filter === 'all' ? 'overall' : filter,
              mapType: FILTER_THEME[filter].title,
              mapFocus: FILTER_THEME[filter].focus,
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
        const record: SavedGlossy = { image: finalImage, provider, at: new Date().toISOString() };
        saveGlossy(state.siteId, filter, record);
        setSaved(record);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Render failed.');
      } finally {
        setLoading(null);
      }
    },
    [state, frame, refLayers, site, placeName, filter],
  );

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

      {/* Which map? — render the whole design, or a single-theme glossy (water/zones/…). */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4, opacity: 0.55, marginBottom: 6 }}>
          Which map?
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GLOSSY_FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
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
      </div>

      {!resultImage && (
        <p style={{ fontSize: 14, lineHeight: 1.5, opacity: 0.85 }}>
          {filter === 'all'
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
              {filter !== 'all' ? ` · ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map` : ''}
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
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Single best-quality render (geometry-locked). The looser "Gemini (fast)" option
            was retired — it repainted the scene and lost your exact layout. */}
        <button
          onClick={() => generate('falgpt')}
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
          {loading === 'falgpt'
            ? 'Generating your map… 30–90s'
            : resultImage
              ? `Regenerate ${filter === 'all' ? 'my map' : `my ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map`} (~1 min)`
              : `Generate ${filter === 'all' ? 'my map' : `my ${GLOSSY_FILTERS.find((f) => f.key === filter)?.label} map`} (~1 min)`}
        </button>
        {error && <p style={{ color: '#B53A3A', fontSize: 13 }}>{error}</p>}
      </div>
    </div>
  );
}
