// Facilitator designer — layered, progressive map building.
//
// The layer order follows the permaculture design canon (Yeomans' Scale of
// Permanence, Mollison's zones & sectors): what changes slowest is designed
// first. Base map → existing features → sectors → water → access →
// structures → planting → review. Each layer is saved independently and the
// coach guides the farmer from one to the next.

import { isSampleMode, getSandboxFacilitatorState, setSandboxFacilitatorState, clearSandboxFacilitatorState } from './sample-mode';

export type ElType =
  | 'tank' | 'pond' | 'well' | 'reedbed'
  | 'bed' | 'hugel' | 'banana' | 'tree' | 'foodforest' | 'herb' | 'shrub'
  | 'coop' | 'compost' | 'greenhouse' | 'tunnel' | 'shed' | 'beehive' | 'biogas'
  | 'swalew' | 'firebreak' | 'nursery';

export type LineKind = 'pipe' | 'swale' | 'fence' | 'path' | 'windbreak' | 'drip' | 'contour' | 'building' | 'driveway' | 'patio' | 'waterbody';

// Area (polygon) kinds — drawn by tapping each corner then finishing the
// shape, unlike the other line kinds which are a simple 2-tap segment.
// Rendered filled, not just stroked, and priced/measured per m².
export const POLYGON_LINE_KINDS: LineKind[] = ['building', 'driveway', 'patio', 'waterbody'];

// Kinds measured/priced by AREA (m²) rather than outline length — a driveway,
// patio or dam costs by the ground/water it covers. 'building' stays
// length-based/free (existing-features roof, not a new purchase). SINGLE
// SOURCE OF TRUTH — every BOQ builder (FacilitatorCanvas.tsx's live estimate,
// app/facilitator/print/page.tsx's printed pack) must import this rather than
// keep its own copy: a second, un-synced list is exactly how the print pack
// silently dropped driveway/patio/waterbody costs before (costForLine was
// called for every kind, costForAreaLine for none — see lib/price-book.ts).
export const AREA_LINE_KINDS: LineKind[] = ['driveway', 'patio', 'waterbody'];

export type SectorKind = 'sun_winter' | 'sun_summer' | 'wind' | 'fire' | 'water_flow' | 'view';

export interface SectorEl {
  id: string;
  kind: SectorKind;
  x: number;         // stage px — apex of the wedge
  y: number;
  rotation: number;  // degrees; 0 = wedge opens to the right (east)
  radiusM: number;   // wedge reach in metres
  spanDeg: number;   // wedge angle
}

export const SECTOR_DEFS: Record<SectorKind, { label: string; icon: string; color: string; spanDeg: number; radiusM: number; hint: string }> = {
  sun_winter: { label: 'Winter sun',  icon: '🌤', color: '#E0A020', spanDeg: 60, radiusM: 30, hint: 'Where low winter sun comes from (north in SA)' },
  sun_summer: { label: 'Summer sun',  icon: '☀️', color: '#E8C43A', spanDeg: 90, radiusM: 30, hint: 'High summer sun arc — plan shade' },
  wind:       { label: 'Wind',        icon: '💨', color: '#6A9AC0', spanDeg: 45, radiusM: 40, hint: 'Prevailing / damaging wind direction' },
  fire:       { label: 'Fire danger', icon: '🔥', color: '#C0531E', spanDeg: 50, radiusM: 45, hint: 'Direction a veld fire would come from' },
  water_flow: { label: 'Water flow',  icon: '🌊', color: '#3E7BB0', spanDeg: 30, radiusM: 35, hint: 'Which way stormwater runs across the land' },
  view:       { label: 'View',        icon: '👁', color: '#8A8070', spanDeg: 35, radiusM: 30, hint: 'A view to keep open (or to screen)' },
};

export type LayerId = 'base' | 'existing' | 'sectors' | 'water' | 'access' | 'structures' | 'planting' | 'review';

export const LAYER_ORDER: LayerId[] = ['base', 'existing', 'sectors', 'water', 'access', 'structures', 'planting', 'review'];

export interface DesignLayerDef {
  id: LayerId;
  name: string;
  icon: string;
  blurb: string;              // one-line coach text shown in the stepper
  elementTypes: ElType[];     // palette groups surfaced first on this layer
  lineKinds: LineKind[];
  sectorKinds?: SectorKind[];
}

export const LAYERS: Record<LayerId, DesignLayerDef> = {
  base: {
    id: 'base', name: 'Land setup', icon: '🗺',
    blurb: 'Start here: load your site photo and set the scale. Everything is measured against this.',
    elementTypes: [], lineKinds: [],
  },
  existing: {
    id: 'existing', name: "What's there", icon: '🏠',
    blurb: 'Mark what already exists. 🗺 Find map features pulls buildings and roads from map data; tap to place big trees.',
    elementTypes: ['shed', 'tree', 'well'], lineKinds: ['building', 'fence', 'path'],
  },
  sectors: {
    id: 'sectors', name: 'Sun, wind & land', icon: '🧭',
    blurb: 'Map the energies crossing the land: sun, wind, fire risk, water flow. These decide where things go.',
    elementTypes: [], lineKinds: [],
    sectorKinds: ['sun_winter', 'sun_summer', 'wind', 'fire', 'water_flow', 'view'],
  },
  water: {
    id: 'water', name: 'Water', icon: '💧',
    blurb: 'Water first — it is the hardest thing to move later. Tanks at roofs, swales on contour, ponds at low points.',
    elementTypes: ['tank', 'pond', 'reedbed', 'swalew', 'well'], lineKinds: ['swale', 'pipe', 'drip', 'contour', 'waterbody'],
  },
  access: {
    id: 'access', name: 'Paths & access', icon: '🚶',
    blurb: 'Paths and access next. A bed you cannot reach with a wheelbarrow will not be tended.',
    elementTypes: ['firebreak'], lineKinds: ['driveway', 'path', 'fence'],
  },
  structures: {
    id: 'structures', name: 'Buildings', icon: '🏗',
    blurb: 'Place structures: compost near the kitchen, chickens between garden and orchard, nursery in morning sun.',
    elementTypes: ['coop', 'compost', 'greenhouse', 'tunnel', 'beehive', 'biogas', 'nursery', 'shed'], lineKinds: ['patio', 'building'],
  },
  planting: {
    id: 'planting', name: 'Growing & animals', icon: '🌱',
    blurb: 'Now plant: daily veg within 10 m of the door (zone 1), orchard further out, food forest beyond.',
    elementTypes: ['bed', 'hugel', 'banana', 'tree', 'foodforest', 'herb', 'shrub'], lineKinds: ['windbreak'],
  },
  review: {
    id: 'review', name: 'Review & save', icon: '✅',
    blurb: 'Done building. Check the bill of quantities, run the AI review, then save or share the design.',
    elementTypes: [], lineKinds: [],
  },
};

const TYPE_LAYER: Record<ElType, LayerId> = {
  tank: 'water', pond: 'water', well: 'water', reedbed: 'water', swalew: 'water',
  bed: 'planting', hugel: 'planting', banana: 'planting', tree: 'planting',
  foodforest: 'planting', herb: 'planting', shrub: 'planting',
  coop: 'structures', compost: 'structures', greenhouse: 'structures', tunnel: 'structures',
  shed: 'structures', beehive: 'structures', biogas: 'structures', nursery: 'structures',
  firebreak: 'access',
};

const LINE_LAYER: Record<LineKind, LayerId> = {
  pipe: 'water', swale: 'water', drip: 'water', contour: 'water', waterbody: 'water',
  fence: 'access', path: 'access', driveway: 'access', windbreak: 'planting',
  building: 'existing', patio: 'structures',
};

export function defaultLayerForType(t: ElType): LayerId { return TYPE_LAYER[t]; }
export function defaultLayerForLine(k: LineKind): LayerId { return LINE_LAYER[k]; }

/**
 * The layer an item TRULY belongs to — used for maps, BOQ grouping, visibility
 * and placement alike. The stored/active layer wins only when that layer
 * legitimately hosts the type: 'existing' hosts anything (a real feature is a
 * real feature whatever its kind), and a step layer hosts the types its
 * palette lists. Anything else re-homes to the type's semantic layer — so a
 * JoJo tank placed from the full drawer while the Structures step was active
 * still lives on the Water map, which is what the farmer means.
 */
export function layerForItem(layer: LayerId | undefined, type: ElType): LayerId {
  if (layer === 'existing') return 'existing';
  if (layer && LAYERS[layer]?.elementTypes.includes(type)) return layer;
  return TYPE_LAYER[type];
}
export function layerForLine(layer: LayerId | undefined, kind: LineKind): LayerId {
  if (layer === 'existing') return 'existing';
  if (layer && LAYERS[layer]?.lineKinds.includes(kind)) return layer;
  return LINE_LAYER[kind];
}

// ── Coach ──────────────────────────────────────────────────────────────────
// Deterministic, state-aware guidance: "start here → add this → move on → save".

export interface CoachCounts {
  hasBg: boolean;
  scaleSet: boolean;        // pxPerM differs from the default / was auto-set
  itemsByLayer: Partial<Record<LayerId, number>>;
  linesByLayer: Partial<Record<LayerId, number>>;
  sectors: number;
  tanks: number;
  totalLitres: number;
  bedAreaM2: number;
  paths: number;
}

export function coachTip(layer: LayerId, c: CoachCounts): string {
  const count = (value: number | undefined): number =>
    Number.isFinite(value) && (value ?? 0) > 0 ? Math.floor(value!) : 0;
  const amount = (value: number): number =>
    Number.isFinite(value) && value > 0 ? value : 0;
  const n = (l: LayerId) => count(c.itemsByLayer[l]) + count(c.linesByLayer[l]);
  const sectors = count(c.sectors);
  const tanks = count(c.tanks);
  const totalLitres = amount(c.totalLitres);
  const bedAreaM2 = amount(c.bedAreaM2);
  const paths = count(c.paths);
  switch (layer) {
    case 'base':
      if (!c.hasBg) return 'Load a base map: "From my map sites" gives you your real satellite photo with the scale already set.';
      if (!c.scaleSet) return 'Photo loaded. Now set the scale — ✨ Suggest scale reads it from parked cars, or measure a known distance with Set scale.';
      return 'Base map and scale are set ✓ — move on to mark what is already on the land.';
    case 'existing':
      if (n('existing') === 0) return 'Nothing marked yet. Tap 🗺 Find map features to pull your buildings and roads from map data, then tap to place your big trees.';
      return `${n('existing')} existing feature${n('existing') > 1 ? 's' : ''} marked ✓ — next, map your sectors: sun, wind and fire.`;
    case 'sectors':
      if (sectors === 0) return 'Place at least winter sun (from the north in SA) and prevailing wind. Drag to position, rotate to aim.';
      if (sectors < 2) return 'Good start. Add the wind sector too — windbreaks and fire planning depend on it.';
      return `${sectors} sectors mapped ✓ — now design water, the hardest thing to change later.`;
    case 'water':
      if (tanks === 0) return 'Every roof needs a tank. Place a JoJo tank at a roof corner, then think about swales on contour.';
      if (totalLitres < 5000) return 'Tank placed — consider more storage. A SA household garden wants 10 kL+ to bridge the dry season.';
      return `${(totalLitres / 1000).toFixed(1)} kL of storage ✓ — move on to paths and access.`;
    case 'access':
      if (paths === 0) return 'Draw the main path from the door to the most-visited spots: tank, veg beds, compost.';
      return 'Access mapped ✓ — now place your structures.';
    case 'structures':
      if (n('structures') === 0) return 'Compost within 20 steps of the kitchen; chicken coop between garden and orchard so the birds work for you.';
      return `${n('structures')} structure${n('structures') > 1 ? 's' : ''} placed ✓ — time to plant.`;
    case 'planting':
      if (bedAreaM2 === 0) return 'Start with veg beds nearest the door — daily-picked food must be on the daily path.';
      if (bedAreaM2 < 20) return `${bedAreaM2.toFixed(0)} m² of beds so far. 20–40 m² feeds a family its vegetables.`;
      return `${bedAreaM2.toFixed(0)} m² growing ✓ — you are ready to review and save.`;
    case 'review':
      return 'Run the AI review for warnings, then Save design. Share it with a farmer to put it on their phone.';
  }
}

// ── AI detect → canvas conversion ──────────────────────────────────────────

export type DetectKind = 'tree' | 'building' | 'water_tank' | 'pond' | 'veg_area' | 'driveway';

export interface DetectedFeature {
  kind: DetectKind;
  points: Array<[number, number]>; // normalised 0..1 in image space
  sizeM?: number;
  note?: string;
}

export interface DetectResponse {
  features: DetectedFeature[];
  boundary?: Array<[number, number]>; // normalised ring, 3+ points
  metresAcross?: number;              // AI-estimated real width of the image
}

export interface GhostFeature {
  id: string;
  kind: DetectKind | 'boundary' | 'osm_building' | 'osm_road' | 'osm_water';
  elType?: ElType;       // what accepting creates (point features)
  lineKind?: LineKind;   // what accepting creates (poly features)
  pxPoints: number[];    // flattened stage px [x1,y1,x2,y2,...]
  sizeM?: number;
  note?: string;
  layer: LayerId;
}

const DETECT_TO_EL: Partial<Record<DetectKind, ElType>> = {
  tree: 'tree', water_tank: 'tank', pond: 'pond', building: 'shed',
};
const DETECT_TO_LINE: Partial<Record<DetectKind, LineKind>> = {
  driveway: 'path',
};

export interface BgRect { x: number; y: number; w: number; h: number }

/** Map normalised detect output into stage-pixel ghosts positioned over the background image. */
export function buildGhosts(res: DetectResponse, bg: BgRect): GhostFeature[] {
  if (![bg.x, bg.y, bg.w, bg.h].every(Number.isFinite) || bg.w <= 0 || bg.h <= 0) {
    return [];
  }
  const normalisePoints = (value: unknown): Array<[number, number]> | null => {
    if (!Array.isArray(value)) return null;
    const points: Array<[number, number]> = [];
    for (const point of value) {
      if (!Array.isArray(point) || point.length < 2) return null;
      const [nx, ny] = point;
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return null;
      points.push([
        Math.max(0, Math.min(1, nx as number)),
        Math.max(0, Math.min(1, ny as number)),
      ]);
    }
    return points;
  };
  const toPx = (pts: Array<[number, number]>): number[] =>
    pts.flatMap(([nx, ny]) => [bg.x + nx * bg.w, bg.y + ny * bg.h]);
  const ghosts: GhostFeature[] = [];
  const boundary = normalisePoints(res.boundary);
  if (boundary && boundary.length >= 3) {
    ghosts.push({ id: 'ghost-boundary', kind: 'boundary', lineKind: 'fence', pxPoints: toPx(boundary), note: 'Property boundary', layer: 'existing' });
  }
  const features = Array.isArray(res.features) ? res.features : [];
  features.forEach((f, i) => {
    const points = normalisePoints(f?.points);
    if (!points) return;
    const sizeM = Number.isFinite(f.sizeM) && (f.sizeM ?? 0) > 0 ? f.sizeM : undefined;
    if (f.kind === 'veg_area' && points.length >= 3) {
      ghosts.push({ id: `ghost-${i}`, kind: f.kind, elType: 'bed', pxPoints: toPx(points), sizeM, note: f.note, layer: 'existing' });
      return;
    }
    const line = DETECT_TO_LINE[f.kind];
    if (line && points.length >= 2) {
      ghosts.push({ id: `ghost-${i}`, kind: f.kind, lineKind: line, pxPoints: toPx(points), note: f.note, layer: 'existing' });
      return;
    }
    const el = DETECT_TO_EL[f.kind];
    if (el && points.length >= 1) {
      ghosts.push({ id: `ghost-${i}`, kind: f.kind, elType: el, pxPoints: toPx([points[0]]), sizeM, note: f.note, layer: 'existing' });
    }
  });
  return ghosts;
}

// ── Persistence ────────────────────────────────────────────────────────────
//
// geomVersion 2 — metre-based persistence. Designs used to be saved in absolute
// stage px, but the satellite background re-fits to whatever container size
// loads it (a different device/window), so px-based geometry drifts off the
// satellite on every load except the one it was saved on. From geomVersion 2
// onward we persist geometry in METRES relative to the background image's
// top-left corner (xM/yM/pointsM), alongside the existing px fields (which
// remain the live/runtime representation — nothing about in-canvas behaviour
// changes). bgRect + pxPerM at save time are the anchor used to convert px→m;
// a freshly computed bgRect + pxPerM at load time converts m→px again, so the
// geometry always lines up with whatever satellite frame is actually on screen.

export interface FacItem { id: string; type: ElType; x: number; y: number; wM: number; hM: number; rotation: number; litres?: number; layer?: LayerId; xM?: number; yM?: number; label?: string; species?: string; count?: number }
export interface FacLine { id: string; kind: LineKind; points: number[]; closed?: boolean; layer?: LayerId; pointsM?: number[] }
export interface FacSector extends SectorEl { xM?: number; yM?: number }

export interface FacilitatorDesignState {
  version: 1;
  /** Geometry persistence scheme. Absent/undefined = v1 (raw stage px, no bg-relative metres). */
  geomVersion?: 2;
  items: FacItem[];
  lines: FacLine[];
  sectors: FacSector[];
  pxPerM: number;
  activeLayer: LayerId;
  hiddenLayers: LayerId[];
  /** Parchment wash overlay toggle (visibility aid over a busy satellite) — see FacilitatorCanvas. */
  washOn?: boolean;
  /** Cloud design doc this canvas is bound to, once saved — drives update-not-create autosave. */
  designId?: string;
  title?: string;
  /** For site imports we re-fetch the satellite on load instead of storing megabytes of image. */
  bgSite?: { lat: number; lon: number; name: string };
  /** For small file imports only (quota-guarded). */
  bgDataUrl?: string;
  bgRect?: BgRect;
  bgOpacity?: number;
  /**
   * IDs of auto-imported map-truth shapes (`mapshape-*`) the facilitator has
   * explicitly deleted — the map-truth import re-derives ALL mapshape-* lines
   * from the farmer's global traced-shapes store on every load (proximity-
   * matched, not scoped to this exact site), so without this list a deleted
   * shape that doesn't actually belong on this property silently reappears
   * the next time the design is opened. Once dismissed, stays dismissed.
   */
  dismissedMapshapeIds?: string[];
  savedAt: number;
}

/** Default px-per-metre used when metre-based geometry must be restored with no background at all. */
export const DEFAULT_PX_PER_M = 5;

function validTransform(bgRect: BgRect, pxPerM: number): boolean {
  return Number.isFinite(pxPerM) && pxPerM > 0
    && [bgRect.x, bgRect.y].every(Number.isFinite);
}

/** Convert one item's px geometry to bg-relative metres (mutating copy). */
export function itemPxToM(it: FacItem, bgRect: BgRect, pxPerM: number): FacItem {
  if (!validTransform(bgRect, pxPerM) || !Number.isFinite(it.x) || !Number.isFinite(it.y)) return { ...it };
  return { ...it, xM: (it.x - bgRect.x) / pxPerM, yM: (it.y - bgRect.y) / pxPerM };
}
export function itemMToPx(it: FacItem, bgRect: BgRect, pxPerM: number): FacItem {
  const { xM, yM } = it;
  if (!validTransform(bgRect, pxPerM) || !Number.isFinite(xM) || !Number.isFinite(yM)) return { ...it };
  return { ...it, x: bgRect.x + xM! * pxPerM, y: bgRect.y + yM! * pxPerM };
}

export function linePxToM(l: FacLine, bgRect: BgRect, pxPerM: number): FacLine {
  if (!validTransform(bgRect, pxPerM) || l.points.length % 2 !== 0 || !l.points.every(Number.isFinite)) return { ...l };
  const pointsM = l.points.map((v, i) => i % 2 === 0 ? (v - bgRect.x) / pxPerM : (v - bgRect.y) / pxPerM);
  return { ...l, pointsM };
}
export function lineMToPx(l: FacLine, bgRect: BgRect, pxPerM: number): FacLine {
  if (!l.pointsM || !validTransform(bgRect, pxPerM) || l.pointsM.length % 2 !== 0 || !l.pointsM.every(Number.isFinite)) return { ...l };
  const points = l.pointsM.map((v, i) => i % 2 === 0 ? bgRect.x + v * pxPerM : bgRect.y + v * pxPerM);
  return { ...l, points };
}

export function sectorPxToM(s: FacSector, bgRect: BgRect, pxPerM: number): FacSector {
  if (!validTransform(bgRect, pxPerM) || !Number.isFinite(s.x) || !Number.isFinite(s.y)) return { ...s };
  return { ...s, xM: (s.x - bgRect.x) / pxPerM, yM: (s.y - bgRect.y) / pxPerM };
}
export function sectorMToPx(s: FacSector, bgRect: BgRect, pxPerM: number): FacSector {
  const { xM, yM } = s;
  if (!validTransform(bgRect, pxPerM) || !Number.isFinite(xM) || !Number.isFinite(yM)) return { ...s };
  return { ...s, x: bgRect.x + xM! * pxPerM, y: bgRect.y + yM! * pxPerM };
}

/** Convert full geometry px → metres relative to bgRect, for saving under geomVersion 2. */
export function geomPxToM(
  items: FacItem[], lines: FacLine[], sectors: FacSector[], bgRect: BgRect, pxPerM: number,
): { items: FacItem[]; lines: FacLine[]; sectors: FacSector[] } {
  return {
    items: items.map((it) => itemPxToM(it, bgRect, pxPerM)),
    lines: lines.map((l) => linePxToM(l, bgRect, pxPerM)),
    sectors: sectors.map((s) => sectorPxToM(s, bgRect, pxPerM)),
  };
}

/** Convert full geometry metres → px against a freshly-computed bgRect, for loading geomVersion 2 docs. */
export function geomMToPx(
  items: FacItem[], lines: FacLine[], sectors: FacSector[], bgRect: BgRect, pxPerM: number,
): { items: FacItem[]; lines: FacLine[]; sectors: FacSector[] } {
  return {
    items: items.map((it) => itemMToPx(it, bgRect, pxPerM)),
    lines: lines.map((l) => lineMToPx(l, bgRect, pxPerM)),
    sectors: sectors.map((s) => sectorMToPx(s, bgRect, pxPerM)),
  };
}

const STORE_KEY = 'imbewu_facilitator_design_v1';

const layerIds = new Set<LayerId>(LAYER_ORDER);
const elementTypes = new Set<ElType>(Object.keys(TYPE_LAYER) as ElType[]);
const lineKinds = new Set<LineKind>(Object.keys(LINE_LAYER) as LineKind[]);
const sectorKinds = new Set<SectorKind>(Object.keys(SECTOR_DEFS) as SectorKind[]);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * Validate the storage boundary without mutating the parsed document. One corrupt
 * feature is discarded rather than poisoning every BOQ total with NaN.
 */
export function normaliseFacilitatorState(value: unknown): FacilitatorDesignState | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as Partial<FacilitatorDesignState>;
  if (s.version !== 1 || !Array.isArray(s.items)) return null;

  const items = s.items.filter((item): item is FacItem =>
    !!item && typeof item.id === 'string' && elementTypes.has(item.type)
    && [item.x, item.y, item.wM, item.hM, item.rotation].every(finite)
    && item.wM > 0 && item.hM > 0);
  const lines = (Array.isArray(s.lines) ? s.lines : []).filter((line): line is FacLine =>
    !!line && typeof line.id === 'string' && lineKinds.has(line.kind)
    && Array.isArray(line.points) && line.points.length % 2 === 0
    && line.points.every(finite));
  const sectors = (Array.isArray(s.sectors) ? s.sectors : []).filter((sector): sector is FacSector =>
    !!sector && typeof sector.id === 'string' && sectorKinds.has(sector.kind)
    && [sector.x, sector.y, sector.rotation, sector.radiusM, sector.spanDeg].every(finite)
    && sector.radiusM > 0 && sector.spanDeg > 0);
  const pxPerM = finite(s.pxPerM) && s.pxPerM > 0 ? s.pxPerM : DEFAULT_PX_PER_M;
  const activeLayer = s.activeLayer && layerIds.has(s.activeLayer) ? s.activeLayer : 'base';
  const hiddenLayers = Array.isArray(s.hiddenLayers)
    ? [...new Set(s.hiddenLayers.filter((layer): layer is LayerId => layerIds.has(layer)))]
    : [];
  const bgRect = s.bgRect && [s.bgRect.x, s.bgRect.y, s.bgRect.w, s.bgRect.h].every(finite)
    && s.bgRect.w > 0 && s.bgRect.h > 0
    ? { ...s.bgRect }
    : undefined;
  const { bgRect: _storedBgRect, ...stored } = s;

  return {
    ...stored,
    version: 1,
    items: items.map((item) => ({ ...item })),
    lines: lines.map((line) => {
      const { points, pointsM, ...rest } = line;
      return {
        ...rest,
        points: [...points],
        ...(Array.isArray(pointsM) && pointsM.length % 2 === 0 && pointsM.every(finite)
          ? { pointsM: [...pointsM] }
          : {}),
      };
    }),
    sectors: sectors.map((sector) => ({ ...sector })),
    pxPerM,
    activeLayer,
    hiddenLayers,
    ...(bgRect ? { bgRect } : {}),
    savedAt: finite(s.savedAt) ? s.savedAt : 0,
  };
}

export function saveFacilitatorState(s: FacilitatorDesignState): void {
  if (isSampleMode()) { setSandboxFacilitatorState(s); return; }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // Quota — retry without the embedded image.
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...s, bgDataUrl: undefined }));
    } catch { /* give up quietly */ }
  }
}

export function loadFacilitatorState(): FacilitatorDesignState | null {
  if (isSampleMode()) return normaliseFacilitatorState(getSandboxFacilitatorState());
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return normaliseFacilitatorState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearFacilitatorState(): void {
  if (isSampleMode()) { clearSandboxFacilitatorState(); return; }
  try { localStorage.removeItem(STORE_KEY); } catch { /* noop */ }
}
