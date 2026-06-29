'use client';

import turfArea from '@turf/area';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { markLocalStorageKeyUpdated } from '@/lib/map-sync';
import type { LocationData } from '@/lib/types';

export const DESIGN_STUDIO_KEY = 'imbewu_design_studio_v1';

export type DesignLayerType =
  | 'property_boundary'
  | 'cultivation'
  | 'water_body'
  | 'roof'
  | 'access'
  | 'tree_belt'
  | 'structure'
  | 'unknown';

export interface DesignLayer {
  id: string;
  featureId: string;
  siteId: string;
  name: string;
  layerType: DesignLayerType;
  featureType: 'site' | 'water' | 'unknown';
  geometryType: string;
  geometry: Geometry;
  areaM2: number;
  areaLabel: string;
  source: 'manual_map';
  confidenceScore: number;
  approved: boolean;
  locked: boolean;
  color: string;
  notes?: string;
  updatedAt: string;
}

export interface DesignPlanSection {
  title: string;
  body: string;
  layerIds: string[];
}

export interface GeneratedDesignPlan {
  id: string;
  generatedAt: string;
  siteId: string;
  summary: string;
  lockedLayerIds: string[];
  sectorMap: DesignPlanSection[];
  zoneMap: DesignPlanSection[];
  waterMap: DesignPlanSection[];
  opportunityMap: DesignPlanSection[];
  exportNotes: string[];
}

export interface DesignStudioState {
  siteId: string;
  layers: DesignLayer[];
  generatedPlan: GeneratedDesignPlan | null;
  updatedAt: string;
}

type StoredDesignState = Record<string, DesignStudioState>;

const TYPE_LABELS: Record<DesignLayerType, string> = {
  property_boundary: 'Property boundary',
  cultivation: 'Cultivation',
  water_body: 'Water',
  roof: 'Roof / catchment',
  access: 'Access',
  tree_belt: 'Trees / shelter',
  structure: 'Structure',
  unknown: 'Site feature',
};

const TYPE_COLORS: Record<DesignLayerType, string> = {
  property_boundary: '#8CEB6A',
  cultivation: '#E0B63F',
  water_body: '#4EA6D8',
  roof: '#74B9F2',
  access: '#D99133',
  tree_belt: '#2F8F4E',
  structure: '#B58A58',
  unknown: '#B9AA8E',
};

export function getDesignLayerTypeLabel(type: DesignLayerType): string {
  return TYPE_LABELS[type];
}

export function getDesignLayerColor(type: DesignLayerType): string {
  return TYPE_COLORS[type];
}

export function formatDesignArea(m2: number): string {
  if (!Number.isFinite(m2) || m2 <= 0) return 'area unknown';
  if (m2 < 10_000) return `${Math.round(m2).toLocaleString()} m2`;
  return `${(m2 / 10_000).toFixed(2)} ha`;
}

export function designSiteIdFromLocation(locationData: LocationData | null): string {
  if (!locationData) return 'site:unselected';
  return `site:${locationData.lat.toFixed(5)},${locationData.lon.toFixed(5)}`;
}

export function emptyDesignStudioState(siteId: string): DesignStudioState {
  return {
    siteId,
    layers: [],
    generatedPlan: null,
    updatedAt: new Date().toISOString(),
  };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readStore(): StoredDesignState {
  if (typeof window === 'undefined') return {};
  return safeParse<StoredDesignState>(window.localStorage.getItem(DESIGN_STUDIO_KEY), {});
}

function writeStore(store: StoredDesignState, notify: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DESIGN_STUDIO_KEY, JSON.stringify(store));
  if (notify) markLocalStorageKeyUpdated(DESIGN_STUDIO_KEY);
}

export function loadDesignStudioState(siteId: string): DesignStudioState {
  return readStore()[siteId] ?? emptyDesignStudioState(siteId);
}

export function saveDesignStudioState(state: DesignStudioState, opts?: { notify?: boolean }): DesignStudioState {
  const next = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  writeStore({ ...readStore(), [state.siteId]: next }, opts?.notify ?? true);
  return next;
}

function featureAreaM2(feature: Feature): number {
  try {
    return turfArea(feature);
  } catch {
    return 0;
  }
}

function featureId(feature: Feature, index: number, areaM2: number): string {
  if (feature.id != null) return String(feature.id);
  const geometry = feature.geometry?.type ?? 'unknown';
  return `shape-${index}-${geometry}-${Math.round(areaM2)}`;
}

function classifyFeature(feature: Feature, index: number, largestLandIndex: number): DesignLayerType {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const featureType = props.featureType === 'water' ? 'water' : props.featureType === 'site' ? 'site' : 'unknown';
  const text = `${String(props.name ?? '')} ${String(props.category ?? '')}`.toLowerCase();

  if (featureType === 'water') return 'water_body';
  if (/(roof|catchment|house roof|main roof)/.test(text)) return 'roof';
  if (/(drive|access|road|track|path|gate|entrance)/.test(text)) return 'access';
  if (/(house|home|shed|barn|building|structure|dwelling)/.test(text)) return 'structure';
  if (/(tree|orchard|forest|wood|windbreak|hedge|shelter)/.test(text)) return 'tree_belt';
  if (/(veg|vegetable|garden|bed|crop|field|food|market)/.test(text)) return 'cultivation';
  if (featureType === 'site' && index === largestLandIndex) return 'property_boundary';
  if (featureType === 'site') return 'cultivation';
  return 'unknown';
}

function displayName(feature: Feature, layerType: DesignLayerType, index: number): string {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const explicitName = typeof props.name === 'string' && props.name.trim() ? props.name.trim() : '';
  if (explicitName) return explicitName;
  return `${TYPE_LABELS[layerType]} ${index + 1}`;
}

export function mergeFarmShapesIntoDesignState(
  shapes: FeatureCollection | null,
  previous: DesignStudioState,
  siteId: string,
): DesignStudioState {
  if (!shapes?.features?.length) {
    return {
      ...previous,
      siteId,
      layers: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const featuresWithArea = shapes.features.map((feature, index) => ({
    feature,
    index,
    areaM2: featureAreaM2(feature),
  }));
  const largestLandIndex = featuresWithArea
    .filter(({ feature }) => (feature.properties as Record<string, unknown> | null)?.featureType !== 'water')
    .sort((a, b) => b.areaM2 - a.areaM2)[0]?.index ?? -1;
  const previousByFeatureId = new Map(previous.layers.map((layer) => [layer.featureId, layer]));

  const layers = featuresWithArea.map(({ feature, index, areaM2 }) => {
    const id = featureId(feature, index, areaM2);
    const existing = previousByFeatureId.get(id);
    const inferredType = classifyFeature(feature, index, largestLandIndex);
    const layerType = existing?.layerType ?? inferredType;
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const featureType: DesignLayer['featureType'] =
      props.featureType === 'water' ? 'water' : props.featureType === 'site' ? 'site' : 'unknown';

    return {
      id: existing?.id ?? `${siteId}:${id}`,
      featureId: id,
      siteId,
      name: existing?.name ?? displayName(feature, inferredType, index),
      layerType,
      featureType,
      geometryType: feature.geometry?.type ?? 'Unknown',
      geometry: feature.geometry,
      areaM2,
      areaLabel: formatDesignArea(areaM2),
      source: 'manual_map' as const,
      confidenceScore: existing?.confidenceScore ?? 1,
      approved: existing?.approved ?? false,
      locked: existing?.locked ?? false,
      color: getDesignLayerColor(layerType),
      notes: existing?.notes,
      updatedAt: existing?.updatedAt ?? new Date().toISOString(),
    };
  });

  const liveLayerIds = new Set(layers.map((layer) => layer.id));
  const generatedPlan = previous.generatedPlan && previous.generatedPlan.lockedLayerIds.every((id) => liveLayerIds.has(id))
    ? previous.generatedPlan
    : null;

  return {
    ...previous,
    siteId,
    layers,
    generatedPlan,
    updatedAt: new Date().toISOString(),
  };
}

function layerList(layers: DesignLayer[], fallback: string): string {
  if (layers.length === 0) return fallback;
  return layers.map((layer) => layer.name).join(', ');
}

export function generateGeometryDesignPlan(state: DesignStudioState, locationData: LocationData | null): GeneratedDesignPlan {
  const approved = state.layers.filter((layer) => layer.approved);
  const locked = approved.filter((layer) => layer.locked);
  const boundary = approved.find((layer) => layer.layerType === 'property_boundary') ?? approved[0];
  const water = approved.filter((layer) => layer.layerType === 'water_body');
  const cultivation = approved.filter((layer) => layer.layerType === 'cultivation');
  const roof = approved.filter((layer) => layer.layerType === 'roof' || layer.layerType === 'structure');
  const access = approved.filter((layer) => layer.layerType === 'access');
  const treeBelts = approved.filter((layer) => layer.layerType === 'tree_belt');
  const annualRainfall = locationData?.rainfall?.annual;
  const slope = locationData?.elevation?.slopeDeg;
  const summerWind = locationData?.climate?.windFromSummer;
  const winterWind = locationData?.climate?.windFromWinter;

  return {
    id: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    siteId: state.siteId,
    summary: boundary
      ? `Design generated from approved farmer geometry. Locked layers stay fixed: ${layerList(locked, 'none yet')}.`
      : 'Design generated from approved farmer geometry. Add a property boundary for stronger zone placement.',
    lockedLayerIds: locked.map((layer) => layer.id),
    sectorMap: [
      {
        title: 'Sun sector',
        body: 'Keep winter sun access open on the northern side of productive beds and structures.',
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Wind sector',
        body: `Use trees, hedges, or robust crops as filters for seasonal wind${summerWind || winterWind ? `, especially summer wind from ${summerWind ?? 'unknown'} and winter wind from ${winterWind ?? 'unknown'}` : ''}.`,
        layerIds: treeBelts.map((layer) => layer.id),
      },
      {
        title: 'Fire and access sector',
        body: `Keep access clear around ${layerList(access, 'the entrance and paths')} so water, people, and tools can move quickly.`,
        layerIds: access.map((layer) => layer.id),
      },
    ],
    zoneMap: [
      {
        title: 'Zone 0 / daily base',
        body: `Anchor daily activity around ${layerList(roof, 'the home, shed, or main working point')}.`,
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Zone 1 / high-care food',
        body: `Put herbs, seedlings, salad beds, compost, and daily watering near ${layerList(roof.length ? roof : cultivation, 'the easiest-to-reach cultivation area')}.`,
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Zone 2 / stable production',
        body: `Use ${layerList(cultivation, 'approved crop areas')} for larger vegetables, perennial beds, and seasonal rotations.`,
        layerIds: cultivation.map((layer) => layer.id),
      },
      {
        title: 'Zone 3 / low-maintenance support',
        body: `Use ${layerList(treeBelts, 'outer edges and less visited areas')} for shelter, mulch plants, fruit trees, and biodiversity.`,
        layerIds: treeBelts.map((layer) => layer.id),
      },
    ],
    waterMap: [
      {
        title: 'Catch and store',
        body: annualRainfall
          ? `With about ${Math.round(annualRainfall)} mm/year rainfall, roof catchment and small tanks should be protected as first-priority water assets.`
          : 'Protect roof catchment and small tanks as first-priority water assets.',
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Slow and spread',
        body: slope != null
          ? `The mapped slope is about ${slope.toFixed(1)} degrees. Confirm flow on the ground, then slow runoff before it leaves the boundary.`
          : 'Confirm flow on the ground, then slow runoff before it leaves the boundary.',
        layerIds: boundary ? [boundary.id] : [],
      },
      {
        title: 'Existing water',
        body: water.length
          ? `Design around ${layerList(water, 'existing water')} and show both volume and surface area in reports.`
          : 'Add tanks, ponds, drains, or wet areas to improve the water movement map.',
        layerIds: water.map((layer) => layer.id),
      },
    ],
    opportunityMap: [
      {
        title: 'Compost and nursery',
        body: 'Place compost, seedling work, and tool storage close to Zone 1 so daily care stays easy.',
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Food forest edge',
        body: 'Use boundary edges and lower-care corners for layered trees, pollinator plants, mulch species, and habitat.',
        layerIds: boundary ? [boundary.id, ...treeBelts.map((layer) => layer.id)] : treeBelts.map((layer) => layer.id),
      },
      {
        title: 'Water-first upgrades',
        body: 'Prioritise gutters, tanks, overflow paths, mulch basins, and contour observation before adding decorative elements.',
        layerIds: [...water, ...roof].map((layer) => layer.id),
      },
    ],
    exportNotes: [
      'North is preserved from the map. Do not rotate the base geometry in the final map.',
      'Locked layers are farmer-approved and must not be moved by AI-generated styling.',
      'Use the PNG for quick sharing and the PDF for a one-page farmer handout.',
    ],
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Canonical ImbewuField 8-map pack — image-generation prompt builder.

   Turns the selected site (its data + the farmer's approved geometry) into the
   8 copy-paste prompts for Gemini / ChatGPT image generation. The two reference
   images are: IMAGE 1 = the studio's traced site map (PNG export), IMAGE 2 =
   the satellite capture. The shared header enforces geometry fidelity and the
   Southern-Hemisphere sun rule (useful sun to the NORTH).
   ────────────────────────────────────────────────────────────────────────── */

export interface MapPackEntry {
  id: string;
  n: number;
  title: string;
  purpose: string;
  prompt: string;
}

const SHARED_HEADER = `IMBEWUFIELD CANONICAL MAP GENERATION INSTRUCTIONS

You are creating professional permaculture site-design maps from two reference images of the same property.

IMAGE 1 is the app/site-map reference. Use it as the authoritative source for: property boundary, parcel shape, roof catchment / house roof outline, existing vegetable garden location, mapped labels, mapped dimensions and proportions.

IMAGE 2 is the satellite reference. Use it as the visual source for: the real driveway and access, house position and roof shape, surrounding roads, neighbouring buildings, tree belts and vegetation, garden/lawn texture, overall landscape appearance.

Critical accuracy rules:
- Keep north up exactly as shown.
- Preserve the exact relative position, scale, shape and proportions of the property boundary, house, driveway, vegetable garden, existing trees and yard.
- Do not invent a new house shape. Do not move the driveway. Do not rotate the property. Do not change the proportions of the site.
- Do not invent new roads, ponds, buildings, beds or paths unless clearly labelled PROPOSED.
- Existing features are solid lines; proposed features are dashed lines or lighter transparent fills.
- The map may be redrawn and visually improved, but the geometry must stay faithful to the two references.

Render mode (critical for accuracy):
- Strict top-down orthographic plan view. This is a flat MAP, never a 3D render, never an angled/perspective illustration, never a bird's-eye tilt.
- Treat IMAGE 1 as a base layer and trace directly on top of it. Reproduce EVERY corner of the property boundary and the exact footprint and angle of the house/roof, driveway, and existing vegetable garden.
- Match IMAGE 1's aspect ratio, framing and north orientation. Do not crop, pan, or zoom differently from IMAGE 1.
- Only the thematic overlay for the requested map changes between maps; the underlying traced geometry is identical every time.

Style: professional permaculture site-plan map; clean illustrated/GIS hybrid; soft earth-colour palette; semi-transparent overlays; clear labels; simple legend; north arrow; scale bar if possible; readable and not overcrowded; not fantasy art; never sacrifice spatial accuracy for beauty.

Sun-sector rule: This property is in South Africa (Southern Hemisphere). The main useful sun sector is to the NORTH. Do not draw a random sun arc across the property. Show the sun path as a clean inset diagram in a corner: north side = strongest useful sun; east = sunrise; west = sunset; summer sun = high and strong; winter sun = lower and weaker (rises NE, sits low in the northern sky, sets NW).

Generate only the requested map type below. Use the same traced geometry every time — do not let each map reinvent the site.`;

interface MapSpec {
  id: string;
  n: number;
  title: string;
  purpose: string;
  spec: string;
}

const MAP_SPECS: MapSpec[] = [
  {
    id: 'base', n: 1, title: 'Base Site Map', purpose: 'What is here now — the truth map. No design yet.',
    spec: `MAP 1 — BASE SITE MAP
Title: Existing Site Map
Purpose: Show what is already on the site before any design.
Include: property boundary; house / roof footprint; driveway and access; surrounding road; existing vegetable garden; existing trees and tree belts; lawn / open areas; hard surfaces / patio / parking if visible; water tanks / ponds / taps if visible; fence or gate if visible; north arrow; scale bar; simple legend.
Do not include: zones; plant recommendations; proposed orchard; proposed food forest; water-flow arrows unless already visible; decorative design elements.
Visual rule: This must be the cleanest, most restrained and most accurate map — a clean redrawn site plan.`,
  },
  {
    id: 'sector', n: 2, title: 'Sector Map', purpose: 'What outside forces affect this site?',
    spec: `MAP 2 — SECTOR MAP
Title: Sector Analysis Map
Purpose: Show the outside forces that enter the property.
Include: property boundary; house; driveway; existing trees; sun sector from the north; summer sun and winter sun as a separate inset; prevailing wind arrows; storm wind arrows if known; water entering and leaving the site; fire risk direction if relevant; noise / dust direction from road or neighbours; privacy / view issues; pest or wildlife movement if relevant; frost / cold-air movement if relevant; legend.
Do not: place the sun arc randomly across the property; obscure the driveway; add planting details.
Visual rule: Use large soft arrows entering the site from outside the boundary. Sun shown as a corner inset, not warped across the property.`,
  },
  {
    id: 'slope', n: 3, title: 'Slope & Topography Map', purpose: 'How does the land lie — where is high, low, steep and flat?',
    spec: `MAP 3 — SLOPE & TOPOGRAPHY MAP
Title: Slope and Topography Map
Purpose: Show the lie of the land so water, access and planting can follow the landform.
Include: approximate contour lines or height bands from high to low; downhill slope-direction arrows; the steepest areas; flat / terrace-able areas; ridge lines and valley / drainage lines; the property high point and low point; where water naturally collects and where it leaves the site; level areas suitable for beds, dams or buildings; north arrow; scale bar; legend.
Do not: invent dramatic cliffs or hills not supported by the references; contradict the water map's flow direction; add planting detail.
Visual rule: Soft contour shading (lighter high, darker low) with clear downhill arrows. A calm analysis map.`,
  },
  {
    id: 'soil', n: 4, title: 'Soil & Fertility Map', purpose: 'Where is soil strong, weak, wet or dry — and where to build it?',
    spec: `MAP 4 — SOIL & FERTILITY MAP
Title: Soil and Fertility Map
Purpose: Show where soil is strong, weak, wet, dry or compacted, and where to build fertility first.
Include: existing good soil / productive beds; poor or compacted soil zones; eroded or bare ground; wet / waterlogged soil; dry / shallow soil; mulch-bank and compost-building locations; where to add organic matter first; areas to keep covered with living mulch; legend. Show the site's soil texture, pH and organic-carbon figures in a small notes box.
Do not: invent soil-test results beyond the provided data; place compost far from where it is needed; ignore slope and water.
Visual rule: Earth-tone fertility gradient (rich to poor) with compost / mulch icons and a small data-notes box.`,
  },
  {
    id: 'water', n: 5, title: 'Water Map', purpose: 'Where does water come from, go, and need storing?',
    spec: `MAP 5 — WATER MAP
Title: Water Catchment and Flow Map
Purpose: Show how water is caught, stored, slowed, used and safely overflowed.
Include: roof catchment; gutter/downpipe direction if known; existing tanks / ponds / water points; proposed tanks if suitable; tank overflow route; surface runoff arrows; wet areas; dry areas; swales / contour bunds / infiltration lines if suitable; greywater opportunity; high-water planting zones; low-water planting zones; erosion risk points; safe overflow direction away from foundations; legend.
Do not: send overflow toward the house; draw swales running downhill; invent large dams unless labelled proposed and spatially sensible.
Visual rule: Blue arrows and soft blue catchment areas; water movement easy to read.`,
  },
  {
    id: 'climate', n: 6, title: 'Climate Map — Sun Path & Wind Rose', purpose: 'The site\'s sun and wind tools, drawn properly for South Africa.',
    spec: `MAP 6 — CLIMATE MAP (SUN PATH & WIND ROSE)
Title: Climate Map — Sun Path and Wind Rose
Purpose: Show the site's sun and wind the way a professional site analysis does.
Include: a sun-path diagram inset for the Southern Hemisphere (sun travels across the NORTHERN sky; summer arc high, winter arc low; sunrise NE/E, sunset NW/W); a wind-rose inset showing prevailing and storm wind directions; the useful north solar sector marked lightly on the plan; winter shade cast by the house and tall trees (toward the south); warm north-facing micro-climates; cold / frost pockets; legend.
Do not: draw the sun arc across the property; put strong sun to the south; crowd the plan with weather symbols.
Visual rule: Two clean corner insets (sun path + wind rose) plus light north-sector shading on the plan.`,
  },
  {
    id: 'circulation', n: 7, title: 'Circulation & Access Map', purpose: 'How do people, vehicles, water and tools move through the site?',
    spec: `MAP 7 — CIRCULATION & ACCESS MAP
Title: Circulation, Access and Services Map
Purpose: Show how people, vehicles, water and tools move through the site, and where services run.
Include: driveway and vehicle access; main walking paths and desire lines; gates and entrances; the daily routes between house, water, beds and storage; wheelbarrow / harvest routes; service lines if known (water taps, electricity, drainage, washing / greywater); the delivery / market-out point; legend.
Do not: block existing access; route paths through productive beds unnecessarily; invent utilities not supported by the references.
Visual rule: Clear path lines (existing solid, proposed dashed) with movement arrows; keep the main access spine obvious.`,
  },
  {
    id: 'zone', n: 8, title: 'Zone Map', purpose: 'Where should things go by frequency of use?',
    spec: `MAP 8 — ZONE MAP
Title: Permaculture Zone Map
Purpose: Show how often different parts of the site are used.
Include: Zone 0 house; Zone 1 daily-use area close to house, kitchen, patio and main path; Zone 2 existing vegetable garden and regular-use production; Zone 3 orchard / food forest / larger production; Zone 4 low-care managed production / support species; Zone 5 existing tree belt / biodiversity / quiet wild area; driveway as the main access spine; walking paths; simple zone legend.
Do not: list every plant species; cover the whole map with heavy colours; move zones away from real access patterns.
Visual rule: Zones semi-transparent, strongest detail near the house. Show the pattern of use, not every plant.`,
  },
  {
    id: 'opportunity', n: 9, title: 'Opportunity Map', purpose: 'Where are the highest-return upgrades?',
    spec: `MAP 9 — OPPORTUNITY MAP
Title: Best Opportunities Map
Purpose: Show the highest-value upgrades on the site.
Include: best compost location; nursery / seedling table; rainwater tank upgrade; tank overflow improvement; banana circle / wet productive area; orchard opportunity; food forest edge; pollinator strip; windbreak; mulch bank; chicken / animal opportunity if relevant; market garden expansion area if relevant; priority symbols: Do First / Do Next / Later.
Do not: show too many opportunities; make it feel like a shopping list; ignore access and water.
Visual rule: Use numbered opportunity circles and a side legend.`,
  },
  {
    id: 'planting', n: 10, title: 'Planting Design Map', purpose: 'What should be planted where?',
    spec: `MAP 10 — PLANTING DESIGN MAP
Title: What to Plant Where
Purpose: Show plant GROUPS and tree systems in the correct places.
Include: kitchen herbs near house; vegetables in existing/intensive beds; fruit trees in the orchard area; food forest on a suitable edge; bananas / wet-loving plants near greywater / moist area; drought-tolerant plants on dry edges; support species where soil must be built first; windbreak trees on exposed boundaries; pollinator strips near vegetable beds; mulch bank species near production; indigenous biodiversity planting in Zone 5; legend with plant groups. Use icons for: herbs, vegetables, fruit trees, bananas/wet crops, support species, pollinators, windbreak, food forest, mulch bank, indigenous buffer.
Side-legend examples (put detail here, not on the map): citrus and stone fruit in the orchard; bananas and taro near greywater; herbs and salad at the kitchen door; pigeon pea, vetiver, comfrey and tagasaste as support / mulch species; indigenous species in the Zone 5 buffer.
Do not: write every crop name directly on the map; place high-water crops in dry areas; place daily herbs far from the house; ignore existing tree belts.
Visual rule: Map shows plant groups; the side panel gives plant examples.`,
  },
  {
    id: 'cropplan', n: 11, title: 'Crop Plan & Rotation Map', purpose: 'How is the veg area laid out into beds, crop families and rotation?',
    spec: `MAP 11 — CROP PLAN & ROTATION MAP
Title: Crop Plan and Rotation Map
Purpose: Turn the vegetable area into a workable bed layout with crop families and rotation.
Include: the existing / intensive growing area drawn as a tidy bed grid; crop-family blocks across the beds (leaf, fruiting, root, legume); this-season vs next-season rotation direction arrows; quick-succession beds nearest the house; perennial / permanent beds; nursery and seedling area; paths between beds; a small rotation legend (which family follows which); a seasonal note tuned to the site's rainfall pattern.
Do not: name every single cultivar on the beds; follow legumes with legumes or heavy feeders with heavy feeders; place water-hungry beds far from water.
Visual rule: Tidy bed grid, colour-coded crop families, rotation arrows; detail in the side legend.`,
  },
  {
    id: 'phasing', n: 12, title: 'Implementation / Phasing Map', purpose: 'Where do I start?',
    spec: `MAP 12 — IMPLEMENTATION / PHASING MAP
Title: Step-by-Step Implementation Map
Purpose: Turn the design into numbered work across the site.
Include numbered action points by phase:
Phase 1 (0-30 days): fix water movement; mulch existing beds; set compost position; mark main paths.
Phase 2 (1-3 months): improve vegetable beds; start nursery; plant herbs; first tank/overflow improvements.
Phase 3 (3-6 months): plant support species; plant windbreak; establish pollinator strips; start orchard prep.
Phase 4 (6-12 months): plant fruit trees; expand food forest; improve irrigation; add animal system if suitable.
Phase 5 (Year 2+): expand orchard; expand market garden; add value-adding / enterprise systems.
Visual rule: Large numbered circles on the site map; the farmer must clearly know where to start.`,
  },
  {
    id: 'full', n: 13, title: 'Full Design Map', purpose: 'What does the whole design become? (poster map)',
    spec: `MAP 13 — FULL DESIGN MAP
Title: Full Permaculture Design Map
Purpose: Show the final design direction in one beautiful, readable poster map.
Include: property boundary; house / Zone 0; driveway / access spine; existing vegetable garden; Zone 1 daily-use; Zone 2 regular-use production; Zone 3 orchard / food forest; Zone 4 low-care managed production; Zone 5 wild / biodiversity buffer; water catchment and overflow; main paths; compost; nursery; orchard; food forest; windbreaks; planting groups; pollinator strips; existing tree belts; north arrow; scale bar; legend; sun-sector inset.
Do not include: every crop name; every calculation; every risk; every monthly task; too many arrows.
Visual rule: This is the poster map — accurate, beautiful and readable.`,
  },
];

function collectCoords(geometry: Geometry | undefined, out: Position[]): void {
  if (!geometry) return;
  const g = geometry as { type: string; coordinates?: unknown };
  const push = (c: unknown) => { if (Array.isArray(c) && typeof c[0] === 'number') out.push(c as Position); };
  if (g.type === 'Point') push(g.coordinates);
  else if (g.type === 'LineString' || g.type === 'MultiPoint') (g.coordinates as Position[]).forEach(push);
  else if (g.type === 'Polygon' || g.type === 'MultiLineString') (g.coordinates as Position[][]).forEach((r) => r.forEach(push));
  else if (g.type === 'MultiPolygon') (g.coordinates as Position[][][]).forEach((p) => p.forEach((r) => r.forEach(push)));
}

// Real ground dimensions of the site (E-W x N-S) in metres, so the image model
// has true proportions to anchor on rather than guessing.
function siteExtentMeters(layers: DesignLayer[]): { w: number; h: number } | null {
  const coords: Position[] = [];
  for (const l of layers) collectCoords(l.geometry, coords);
  if (coords.length < 2) return null;
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    if (typeof lon !== 'number' || typeof lat !== 'number') continue;
    if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;
  const midLatRad = ((minLat + maxLat) / 2) * Math.PI / 180;
  const w = (maxLon - minLon) * 111_320 * Math.cos(midLatRad);
  const h = (maxLat - minLat) * 110_540;
  if (w <= 0 || h <= 0) return null;
  return { w: Math.round(w), h: Math.round(h) };
}

function mapPackSiteData(state: DesignStudioState, locationData: LocationData | null): string {
  const approved = state.layers.filter((l) => l.approved);
  const lines: string[] = ['Country: South Africa (Southern Hemisphere — useful sun sector is to the NORTH).'];

  const boundary = approved.find((l) => l.layerType === 'property_boundary');
  const extent = siteExtentMeters(boundary ? [boundary] : approved);
  if (extent) lines.push(`Site extent: about ${extent.w} m east-west by ${extent.h} m north-south — keep this width:height proportion exactly.`);

  const d = locationData;
  if (d) {
    lines.push(`Location: ${d.lat.toFixed(4)} S, ${d.lon.toFixed(4)} E${d.biome?.name ? ` - ${d.biome.name} biome` : ''}.`);
    if (d.rainfall?.annual) lines.push(`Rainfall: about ${Math.round(d.rainfall.annual)} mm/year${d.rainfall.pattern ? ` (${d.rainfall.pattern})` : ''}.`);
    if (d.climate?.meanTemp != null) lines.push(`Climate: mean ${d.climate.meanTemp} C${d.climate.windFromSummer ? `, summer wind from ${d.climate.windFromSummer}` : ''}${d.climate.windFromWinter ? `, winter wind from ${d.climate.windFromWinter}` : ''}.`);
    if (d.elevation) lines.push(`Terrain: ${d.elevation.elevation ?? '?'} m ASL, slope ${d.elevation.slopeDeg != null ? `${d.elevation.slopeDeg.toFixed(1)} deg` : 'unknown'}${d.elevation.aspectLabel ? `, ${d.elevation.aspectLabel}-facing` : ''}.`);
    if (d.soil) lines.push(`Soil: ${d.soil.textureClass ?? 'unknown'}, pH ${d.soil.ph ?? '?'}, organic carbon ${d.soil.organicCarbon ?? '?'}%.`);
  }

  if (approved.length) {
    lines.push('');
    lines.push('Approved mapped features (faithful geometry — keep these exactly):');
    for (const l of approved) {
      lines.push(`- ${l.name} (${TYPE_LABELS[l.layerType]}, ${l.areaLabel})${l.locked ? ' [LOCKED]' : ''}`);
    }
    const waterArea = approved.filter((l) => l.layerType === 'water_body').reduce((s, l) => s + l.areaM2, 0);
    if (waterArea > 0) lines.push(`Mapped water surface: about ${Math.round(waterArea).toLocaleString()} m2.`);
  } else {
    lines.push('No farmer-approved geometry yet — rely on the two reference images for all features.');
  }

  return lines.join('\n');
}

const ALWAYS_PRESERVE = `--- KEEP UNCHANGED FROM IMAGE 1 (solid lines, identical on every map) ---
Property boundary (every corner), house / roof footprint and its angle, driveway and access, existing vegetable garden, and existing trees. Do not move, rotate, resize or restyle these. Only the thematic overlay for THIS map is new.`;

export function buildMapPackPrompts(state: DesignStudioState, locationData: LocationData | null): MapPackEntry[] {
  const data = mapPackSiteData(state, locationData);
  return MAP_SPECS.map((m) => ({
    id: m.id,
    n: m.n,
    title: m.title,
    purpose: m.purpose,
    prompt: `${SHARED_HEADER}\n\n${m.spec}\n\n${ALWAYS_PRESERVE}\n\n--- SITE DATA (weave into the map; do not invent beyond this) ---\n${data}`,
  }));
}
