'use client';

import turfArea from '@turf/area';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
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
