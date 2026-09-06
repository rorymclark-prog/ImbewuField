'use client';

import turfArea from '@turf/area';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import {
  isValidFarmGeometry,
  markLocalStorageKeyUpdated,
  readLocalFarmShapes,
} from '@/lib/map-sync';
import {
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  roofHarvestLitres,
} from '@/lib/roof-runoff';
import type { LocationData } from '@/lib/types';
import { loadSurvey } from '@/lib/site-survey';
import type { SiteSurvey } from '@/lib/site-survey';
import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';

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

export interface WaterCalcSummary {
  householdDailyLitres: number;
  householdMonthlyLitres: number;
  dryBufferLitres90Day: number;
  roofHarvestAnnualLitres: number | null;
  roofHarvestAnnualKL: number | null;
  roofAreaM2Used: number;
  cultivationAreaM2: number;
  gardenIrrigationDrySeasonDailyLitres: number | null;
  gardenIrrigationDrySeasonMonthlyLitres: number | null;
  rainfallMmUsed: number | null;
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
  // Optional enrichment fields (backward-compatible additions)
  waterCalc?: WaterCalcSummary;
  surveyGoals?: string[];
  surveySnapshot?: {
    soilCondition?: string;
    challenges?: string[];
    existingCrops?: string[];
    waterSources?: string[];
    isCommercial?: boolean;
    farmingPractice?: string;
    householdSize?: number;
  };
}

export interface DesignStudioState {
  siteId: string;
  layers: DesignLayer[];
  generatedPlan: GeneratedDesignPlan | null;
  updatedAt: string;
}

type StoredDesignState = Record<string, DesignStudioState>;
const DESIGN_LAYER_TYPES = new Set<DesignLayerType>([
  'property_boundary', 'cultivation', 'water_body', 'roof', 'access', 'tree_belt',
  'structure', 'unknown',
]);
const DESIGN_FEATURE_TYPES = new Set<DesignLayer['featureType']>(['site', 'water', 'unknown']);

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

export function designSiteIdFromLocation(locationData: Pick<LocationData, 'lat' | 'lon'> | null): string {
  if (!locationData) return 'site:unselected';
  if (
    !Number.isFinite(locationData.lat)
    || !Number.isFinite(locationData.lon)
    || locationData.lat < -90
    || locationData.lat > 90
    || locationData.lon < -180
    || locationData.lon > 180
  ) return 'site:unselected';
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

function studioRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function studioText(value: unknown): value is string {
  return typeof value === 'string';
}

function studioStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(studioText);
}

function validPlanSections(value: unknown, liveLayerIds: Set<string>): value is DesignPlanSection[] {
  return Array.isArray(value) && value.every((section) => (
    studioRecord(section)
    && studioText(section.title)
    && studioText(section.body)
    && studioStringArray(section.layerIds)
    && section.layerIds.every((id) => liveLayerIds.has(id))
  ));
}

function validWaterCalc(value: unknown): value is WaterCalcSummary {
  if (!studioRecord(value)) return false;
  const required = [
    'householdDailyLitres', 'householdMonthlyLitres', 'dryBufferLitres90Day',
    'roofAreaM2Used', 'cultivationAreaM2',
  ];
  const nullable = [
    'roofHarvestAnnualLitres', 'roofHarvestAnnualKL',
    'gardenIrrigationDrySeasonDailyLitres', 'gardenIrrigationDrySeasonMonthlyLitres',
    'rainfallMmUsed',
  ];
  return required.every((key) => (
    typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0
  )) && nullable.every((key) => (
    value[key] === null
    || (typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0)
  ));
}

function validSurveySnapshot(value: unknown): boolean {
  if (!studioRecord(value)) return false;
  return (value.soilCondition === undefined || studioText(value.soilCondition))
    && (value.challenges === undefined || studioStringArray(value.challenges))
    && (value.existingCrops === undefined || studioStringArray(value.existingCrops))
    && (value.waterSources === undefined || studioStringArray(value.waterSources))
    && (value.isCommercial === undefined || typeof value.isCommercial === 'boolean')
    && (value.farmingPractice === undefined || studioText(value.farmingPractice))
    && (value.householdSize === undefined
      || (typeof value.householdSize === 'number'
        && Number.isFinite(value.householdSize) && value.householdSize >= 0));
}

function normaliseGeneratedPlan(
  value: unknown,
  siteId: string,
  liveLayerIds: Set<string>,
): GeneratedDesignPlan | null {
  if (value === null || value === undefined) return null;
  if (!studioRecord(value)
      || !studioText(value.id) || !value.id
      || !studioText(value.generatedAt) || !Number.isFinite(Date.parse(value.generatedAt))
      || value.siteId !== siteId
      || !studioText(value.summary)
      || !studioStringArray(value.lockedLayerIds)
      || !value.lockedLayerIds.every((id) => liveLayerIds.has(id))
      || !validPlanSections(value.sectorMap, liveLayerIds)
      || !validPlanSections(value.zoneMap, liveLayerIds)
      || !validPlanSections(value.waterMap, liveLayerIds)
      || !validPlanSections(value.opportunityMap, liveLayerIds)
      || !studioStringArray(value.exportNotes)
      || (value.waterCalc !== undefined && !validWaterCalc(value.waterCalc))
      || (value.surveyGoals !== undefined && !studioStringArray(value.surveyGoals))
      || (value.surveySnapshot !== undefined && !validSurveySnapshot(value.surveySnapshot))) {
    return null;
  }
  return value as unknown as GeneratedDesignPlan;
}

function validDesignLayer(value: unknown, siteId: string): value is DesignLayer {
  if (!studioRecord(value)) return false;
  return studioText(value.id) && value.id.length > 0
    && studioText(value.featureId) && value.featureId.length > 0
    && value.siteId === siteId
    && studioText(value.name)
    && DESIGN_LAYER_TYPES.has(value.layerType as DesignLayerType)
    && DESIGN_FEATURE_TYPES.has(value.featureType as DesignLayer['featureType'])
    && studioText(value.geometryType)
    && isValidFarmGeometry(value.geometry)
    && value.geometryType === value.geometry.type
    && typeof value.areaM2 === 'number' && Number.isFinite(value.areaM2) && value.areaM2 >= 0
    && studioText(value.areaLabel)
    && value.source === 'manual_map'
    && typeof value.confidenceScore === 'number' && Number.isFinite(value.confidenceScore)
    && value.confidenceScore >= 0 && value.confidenceScore <= 1
    && typeof value.approved === 'boolean'
    && typeof value.locked === 'boolean'
    && studioText(value.color)
    && (value.notes === undefined || studioText(value.notes))
    && studioText(value.updatedAt) && Number.isFinite(Date.parse(value.updatedAt));
}

export function normaliseDesignStudioState(value: unknown, siteId: string): DesignStudioState | null {
  let copy: unknown;
  try {
    copy = JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
  if (!studioRecord(copy) || !siteId || copy.siteId !== siteId
      || !Array.isArray(copy.layers)
      || !studioText(copy.updatedAt) || !Number.isFinite(Date.parse(copy.updatedAt))) return null;

  const layers: DesignLayer[] = [];
  const layerIds = new Set<string>();
  const featureIds = new Set<string>();
  for (const candidate of copy.layers) {
    if (!validDesignLayer(candidate, siteId)
        || layerIds.has(candidate.id) || featureIds.has(candidate.featureId)) continue;
    layerIds.add(candidate.id);
    featureIds.add(candidate.featureId);
    layers.push(candidate);
  }
  if (copy.layers.length > 0 && layers.length === 0) return null;
  return {
    siteId,
    layers,
    generatedPlan: normaliseGeneratedPlan(copy.generatedPlan, siteId, layerIds),
    updatedAt: copy.updatedAt,
  };
}

function readStore(): StoredDesignState {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(activeAccountLocalStorageKey(DESIGN_STUDIO_KEY)) ?? '{}',
    );
    if (!studioRecord(parsed)) return {};
    const store: StoredDesignState = {};
    for (const [siteId, value] of Object.entries(parsed)) {
      const state = normaliseDesignStudioState(value, siteId);
      if (state) store[siteId] = state;
    }
    return store;
  } catch {
    return {};
  }
}

function writeStore(store: StoredDesignState, notify: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(activeAccountLocalStorageKey(DESIGN_STUDIO_KEY), JSON.stringify(store));
  if (notify) markLocalStorageKeyUpdated(DESIGN_STUDIO_KEY);
}

export function loadDesignStudioState(siteId: string): DesignStudioState {
  return readStore()[siteId] ?? emptyDesignStudioState(siteId);
}

export function saveDesignStudioState(state: DesignStudioState, opts?: { notify?: boolean }): DesignStudioState {
  const next = normaliseDesignStudioState({
    ...state,
    updatedAt: new Date().toISOString(),
  }, state?.siteId);
  if (!next) throw new Error('Could not save an invalid Design Studio state.');
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

// Explicit category the farmer picked in the shape-naming sheet (components/Map.tsx's
// SHAPE_CATEGORIES water list) — respected ahead of the blanket "every water-tool
// shape is a dam/pond" fallback below. A swale, contour bank, road run-off or
// earthwork is water-RELATED infrastructure, not a body of water itself; forcing
// all of them to 'water_body' is what made farmer-traced swales/earthworks show up
// mislabelled (and costed) as dams downstream. 'Other' is deliberately omitted —
// it falls through to the keyword rules below, same as every other feature type.
const WATER_CATEGORY_LAYER: Partial<Record<string, DesignLayerType>> = {
  'Dam / pond': 'water_body',
  Roof: 'roof',
  Swale: 'unknown',
  'Contour bank': 'unknown',
  'Road run-off': 'unknown',
  Earthwork: 'unknown',
};

function classifyFeature(feature: Feature, index: number, largestLandIndex: number): DesignLayerType {
  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const featureType = props.featureType === 'water' ? 'water' : props.featureType === 'site' ? 'site' : 'unknown';
  const rawName = String(props.name ?? '');
  const rawCat  = String(props.category ?? '');
  const text = `${rawName} ${rawCat}`.toLowerCase().trim();

  if (featureType === 'water') {
    const explicit = WATER_CATEGORY_LAYER[rawCat];
    if (explicit) return explicit;
  }

  // ---- Named-keyword rules (high specificity first) — now also reachable for
  // water-tool shapes with no/an 'Other' category, instead of skipping straight
  // to water_body regardless of what the shape is actually named.
  // Roof/catchment: must include an explicit roof/house/home/dwelling/structure keyword
  if (/(^|\s|\/)(roof|house roof|main roof|catchment)(\s|\/|$)/.test(text)) return 'roof';
  // Access / roads / paths
  if (/(drive|access road|access track|access path|driveway|road|track|path|gate|entrance)/.test(text)) return 'access';
  // Roof-like structures (house, home, dwelling, shed, barn, building) — named shapes only
  // Includes Afrikaans: huis, woning, plaashuis, huisie, gebou
  if (text && /(^|\s)(house|home|dwelling|structure|shed|barn|building|main building|farmhouse|cottage|cabin|lodge|residence|bungalow|huis|woning|plaashuis|huisie|gebou|homestead)(\s|$)/.test(text)) return 'roof';
  // Tree belts / shelter / windbreaks
  if (/(tree belt|shelter belt|windbreak|wind break|hedge|hedgerow|orchard|food forest|woodlot|woodland|forest|trees|belt)/.test(text)) return 'tree_belt';
  // Cultivation / gardens / beds / crops / fields
  if (/(veg|vegetable|garden|bed|crop|field|food garden|market garden|pasture|paddock|nursery|polyculture)/.test(text)) return 'cultivation';
  // Water body named explicitly
  if (/(dam|pond|swale|tank|reservoir|wetland|vlei|stream|river|canal|irrigation)/.test(text)) return 'water_body';

  // A water-tool shape with no more specific signal above (category 'Other' or
  // unset, name doesn't say what it is) — the honest fallback is still "water",
  // since that's the tool the farmer chose to draw it with.
  if (featureType === 'water') return 'water_body';

  // ---- Boundary: the LARGEST non-water land polygon that is not a small named structure ----
  // Exclude shapes that are almost certainly a structure (small area) even without a keyword name
  if (index === largestLandIndex) return 'property_boundary';

  // Unnamed or unrecognised site polygon → default to cultivation
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
  // `shapes` is drawn from ONE global localStorage pool shared by every site the farmer
  // has ever visited. Shapes tagged with a siteId (Map.tsx stamps this at creation/edit
  // time) only belong here if it matches; untagged legacy shapes pass through unfiltered
  // so they keep behaving as they always have until the farmer re-saves them.
  //
  // The "genuinely nothing to merge" check must be against the GLOBAL pool, not the
  // site-scoped subset — a site whose shapes haven't been re-tagged yet (or that has zero
  // currently-traced shapes but previously-approved/renamed/locked Design Studio layers)
  // is a much more common case than the pool being empty, and must not wipe those layers.
  if (!shapes?.features?.length) {
    return {
      ...previous,
      siteId,
      layers: [],
      updatedAt: new Date().toISOString(),
    };
  }

  const scopedFeatures = shapes.features.filter((feature) => {
    const featureSiteId = (feature.properties as Record<string, unknown> | null)?.siteId;
    return typeof featureSiteId !== 'string' || featureSiteId === siteId;
  });

  if (!scopedFeatures.length) {
    // Pool isn't empty, just nothing matches THIS site right now — keep this site's
    // existing layers instead of overwriting them with an empty array.
    return {
      ...previous,
      siteId,
      updatedAt: new Date().toISOString(),
    };
  }

  const featuresWithArea = scopedFeatures.map((feature, index) => ({
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

// Matches the ring/line coordinate extraction in app/design/page.tsx and
// components/GeometryDesignStudio.tsx exactly — kept local here since neither of those
// modules exports it.
function ringFromGeometry(geom: Geometry | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0] ?? [];
  return [];
}

function lineFromGeometry(geom: Geometry | undefined): Position[] {
  if (!geom) return [];
  if (geom.type === 'LineString') return geom.coordinates ?? [];
  if (geom.type === 'MultiLineString') return geom.coordinates[0] ?? [];
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? [];
  return [];
}

// Read-only convenience wrapper for callers (e.g. the site survey sheet) that just want
// today's traced area totals and must NOT trigger a save/Firestore push as a side effect of
// merely looking. Sums ALL traced shapes of the relevant type regardless of `approved` state —
// unlike generateGeometryDesignPlan's use of mergeFarmShapesIntoDesignState, which only counts
// layers a farmer has explicitly approved in Design Studio. Requiring that approval pass before
// the survey can ever show a pre-fill would defeat the point (most farmers filling in the
// survey will never have opened Design Studio).
//
// mergeFarmShapesIntoDesignState passes untagged legacy shapes through into EVERY site
// unconditionally (by design, for backward compatibility) — FacilitatorCanvas.tsx and
// app/design/page.tsx both layer an additional ~0.02deg (~2km) proximity filter on top of
// that merge to contain legacy-shape bleed across a farmer's other sites. Match that same
// guard here, or a farmer with multiple mapped sites gets a distant site's shapes silently
// summed into this site's auto-filled survey figures.
export function computeTracedAreaTotals(
  siteId: string,
  siteLat: number | null,
  siteLon: number | null,
): { roofAreaM2: number; cultivationAreaM2: number } {
  const merged = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), loadDesignStudioState(siteId), siteId);
  const NEAR_DEG = 0.02;
  const nearLayers = siteLat != null && siteLon != null
    ? merged.layers.filter((l) => {
        const c = ringFromGeometry(l.geometry)[0] ?? lineFromGeometry(l.geometry)[0];
        if (!c) return false;
        return Math.abs(c[1] - siteLat) < NEAR_DEG && Math.abs(c[0] - siteLon) < NEAR_DEG;
      })
    : merged.layers;
  const roofAreaM2 = nearLayers.filter((l) => l.layerType === 'roof').reduce((sum, l) => sum + l.areaM2, 0);
  const cultivationAreaM2 = nearLayers.filter((l) => l.layerType === 'cultivation').reduce((sum, l) => sum + l.areaM2, 0);
  return { roofAreaM2, cultivationAreaM2 };
}

function layerList(layers: DesignLayer[], fallback: string): string {
  if (layers.length === 0) return fallback;
  return layers.map((layer) => layer.name).join(', ');
}

// ---------------------------------------------------------------------------
// Helpers for human-readable survey labels
// ---------------------------------------------------------------------------

const GOAL_LABELS: Record<string, string> = {
  food: 'food security for household',
  income: 'generate income from produce',
  soil: 'restore / rebuild the soil',
  education: 'education / demonstration site',
};

const CROP_LABELS: Record<string, string> = {
  vegetables: 'vegetables',
  'fruit-trees': 'fruit trees',
  herbs: 'herbs',
  indigenous: 'indigenous plants',
  fodder: 'fodder crops',
  grain: 'grain',
  nothing: 'nothing yet',
};

const CHALLENGE_LABELS: Record<string, string> = {
  drought: 'drought',
  flooding: 'flooding / waterlogging',
  erosion: 'soil erosion',
  pests: 'pests and diseases',
  weeds: 'weed pressure',
  labour: 'not enough labour',
  finance: 'limited finances',
  water: 'water shortage',
  'market-access': 'difficulty getting produce to market',
  soil: 'poor / degraded soil',
  fencing: 'lack of fencing (livestock intrusion)',
};

function labelList(items: string[], labels: Record<string, string>): string {
  return items.map((item) => labels[item] ?? item).join(', ');
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
  const finite = finiteNumber(value);
  return finite !== undefined && finite >= 0 ? finite : undefined;
}

function sumUsableArea(layers: readonly DesignLayer[]): number {
  return layers.reduce((sum, layer) => sum + (nonNegativeNumber(layer.areaM2) ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Water calculation helper
// ---------------------------------------------------------------------------

function computeWaterCalc(
  survey: SiteSurvey | null,
  roofLayers: DesignLayer[],
  cultivationLayers: DesignLayer[],
  annualRainfallMm: number | null | undefined,
): WaterCalcSummary {
  // Household size: adults string from survey or default 4
  let householdSize = 4;
  if (survey?.adults) {
    const adultMap: Record<string, number> = { '1': 1, '2-5': 3, '6-10': 8, '10+': 12 };
    householdSize = adultMap[survey.adults] ?? 4;
  }
  const householdDailyLitres = householdSize * 50;
  const householdMonthlyLitres = householdDailyLitres * 30;
  const dryBufferLitres90Day = householdDailyLitres * 90;

  // Roof harvest: prefer mapped roof layers, fall back to survey roof m2
  let roofAreaM2 = sumUsableArea(roofLayers);
  if (roofAreaM2 === 0 && survey) {
    roofAreaM2 =
      (nonNegativeNumber(survey.roofMainM2) ?? 0)
      + (nonNegativeNumber(survey.roofSecondaryM2) ?? 0);
  }

  let roofHarvestAnnualLitres: number | null = null;
  let roofHarvestAnnualKL: number | null = null;
  const rainfallMm = nonNegativeNumber(annualRainfallMm);
  if (roofAreaM2 > 0 && rainfallMm != null && rainfallMm > 0) {
    // mm × m² = litres before the shared, centrally reviewed collection loss.
    roofHarvestAnnualLitres = Math.round(roofHarvestLitres(
      roofAreaM2,
      rainfallMm,
      WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
    ));
    roofHarvestAnnualKL = Math.round(roofHarvestAnnualLitres / 1000);
  }

  // Garden irrigation: 2–5 L/m2/day dry season; use 3.5 as midpoint estimate.
  // Prefer mapped cultivation layers, fall back to the survey's existing-growing-area figure —
  // mirrors the roof-area fallback above.
  let cultivationAreaM2 = sumUsableArea(cultivationLayers);
  const surveyedGrowingAreaM2 = nonNegativeNumber(survey?.existingGrowingAreaM2);
  if (cultivationAreaM2 === 0 && surveyedGrowingAreaM2) {
    cultivationAreaM2 = surveyedGrowingAreaM2;
  }
  let gardenIrrigationDrySeasonDailyLitres: number | null = null;
  let gardenIrrigationDrySeasonMonthlyLitres: number | null = null;
  if (cultivationAreaM2 > 0) {
    gardenIrrigationDrySeasonDailyLitres = Math.round(cultivationAreaM2 * 3.5);
    gardenIrrigationDrySeasonMonthlyLitres = gardenIrrigationDrySeasonDailyLitres * 30;
  }

  return {
    householdDailyLitres,
    householdMonthlyLitres,
    dryBufferLitres90Day,
    roofHarvestAnnualLitres,
    roofHarvestAnnualKL,
    roofAreaM2Used: roofAreaM2,
    cultivationAreaM2,
    gardenIrrigationDrySeasonDailyLitres,
    gardenIrrigationDrySeasonMonthlyLitres,
    rainfallMmUsed: rainfallMm ?? null,
  };
}

// ---------------------------------------------------------------------------
// Main plan generator
// ---------------------------------------------------------------------------

export function generateGeometryDesignPlan(state: DesignStudioState, locationData: LocationData | null): GeneratedDesignPlan {
  const approved = state.layers.filter((layer) => layer.approved);
  const locked = approved.filter((layer) => layer.locked);
  const boundary = approved.find((layer) => layer.layerType === 'property_boundary') ?? approved[0];
  const water = approved.filter((layer) => layer.layerType === 'water_body');
  const cultivation = approved.filter((layer) => layer.layerType === 'cultivation');
  const roofOnly = approved.filter((layer) => layer.layerType === 'roof');
  const roof = approved.filter((layer) => layer.layerType === 'roof' || layer.layerType === 'structure');
  const access = approved.filter((layer) => layer.layerType === 'access');
  const treeBelts = approved.filter((layer) => layer.layerType === 'tree_belt');

  const annualRainfall = nonNegativeNumber(locationData?.rainfall?.annual);
  const slope = nonNegativeNumber(locationData?.elevation?.slopeDeg);
  const summerWind = locationData?.climate?.windFromSummer;
  const winterWind = locationData?.climate?.windFromWinter;
  const soilTexture = locationData?.soil?.textureClass;
  const biome = locationData?.biome?.name;
  const rainfallPattern = locationData?.rainfall?.pattern;
  const wetSeason = locationData?.rainfall?.wetSeason;
  const drySeason = locationData?.rainfall?.drySeason;
  const minTemp = finiteNumber(locationData?.climate?.minTemp);
  const elevation = finiteNumber(locationData?.elevation?.elevation);

  // Load site survey by siteId. loadSurvey() also runs a one-time legacy-placeId migration
  // internally if nothing is filed under this key yet (see lib/site-survey.ts).
  const survey: SiteSurvey | null = loadSurvey(state.siteId);

  // Normalise survey arrays defensively
  const surveyGoals: string[] = survey?.goals ?? [];
  const surveyWaterSources: string[] = survey?.waterSource ?? [];
  const surveyWaterStorage: string[] = survey?.waterStorage ?? [];
  const surveyCrops: string[] = (survey?.existingCrops ?? []).filter((c) => c !== 'nothing');
  const surveyChallenges: string[] = survey?.challenges ?? [];
  const surveyLivestock: string[] = (survey?.livestock ?? []).filter((l) => l !== 'none');
  const surveyOtherInfra: string[] = survey?.otherInfra ?? [];
  const soilCondition: string = survey?.soilCondition ?? '';
  const farmingPractice: string = survey?.farmingPractice ?? '';
  const hasGutters: boolean = survey?.hasGutters ?? false;

  // Water calculations
  const waterCalc = computeWaterCalc(survey, roofOnly, cultivation, annualRainfall);

  // Derive household size label for readable text
  const adultLabels: Record<string, string> = { '1': '1 person', '2-5': '2–5 people', '6-10': '6–10 people', '10+': 'more than 10 people' };
  const householdLabel = survey?.adults ? (adultLabels[survey.adults] ?? survey.adults) : '4 people (estimated)';

  // Soil notes from climate + survey
  const soilNotes: string[] = [];
  if (soilCondition && soilCondition !== 'unknown') soilNotes.push(`soil is described as ${soilCondition}`);
  if (soilTexture) soilNotes.push(`texture class is ${soilTexture}`);
  if (survey?.soilAmendments?.length && survey.soilAmendments.filter((a) => a !== 'none').length > 0) {
    soilNotes.push(`amendments in use: ${survey.soilAmendments.filter((a) => a !== 'none').join(', ')}`);
  }

  // Challenge-driven priority note
  const challengeNote = surveyChallenges.length
    ? `Key challenges to address: ${labelList(surveyChallenges, CHALLENGE_LABELS)}.`
    : '';

  // Goal-driven summary line
  const goalNote = surveyGoals.length
    ? `Main goals: ${labelList(surveyGoals, GOAL_LABELS)}.`
    : '';

  // Commercial vs household framing
  const commercialNote = survey?.isCommercial
    ? `This site sells produce${survey.marketType ? ` (${survey.marketType.replace(/-/g, ' ')})` : ''} — scale and continuity of production matters.`
    : '';

  // Farming practice note
  const practiceNote = farmingPractice && farmingPractice !== 'conventional'
    ? `Farming approach: ${farmingPractice.replace(/-/g, ' ')}.`
    : '';

  // Existing crops note
  const cropsNote = surveyCrops.length
    ? `Already growing: ${labelList(surveyCrops, CROP_LABELS)}.`
    : 'No crops mapped yet — start with beds closest to the kitchen.';

  // Livestock note
  const livestockNote = surveyLivestock.length
    ? `Livestock on site: ${surveyLivestock.join(', ')} — keep them out of Zone 1 beds with fencing or electric wire.`
    : '';

  // Water source note
  const waterSourceNote = surveyWaterSources.length
    ? `Water sources available: ${surveyWaterSources.join(', ')}.`
    : 'No water sources recorded — use the survey to add them.';

  // Water storage note
  const storagePieces = surveyWaterStorage.filter((s) => s !== 'none');
  const waterStorageNote = storagePieces.length
    ? `Existing storage: ${storagePieces.join(', ')}.`
    : 'No on-site storage yet — even one 5 000 L JoJo tank makes a big difference.';

  // Roof harvest human-readable
  const roofHarvestNote = waterCalc.roofHarvestAnnualKL != null
    ? `Estimated roof harvest (${waterCalc.roofAreaM2Used} m² × ${Math.round(annualRainfall ?? 0)} mm × ${Math.round(WATER_SHEET_ROOF_RUNOFF_COEFFICIENT * 100)}%): ~${waterCalc.roofHarvestAnnualKL.toLocaleString()} kL/year.`
    : roofOnly.length === 0 && (survey?.roofMainM2 ?? 0) === 0
      ? 'Roof area not yet mapped or surveyed — add it to calculate harvest potential.'
      : annualRainfall == null
        ? 'Rainfall data not loaded — reload the location to get harvest estimates.'
        : null;

  const householdNeedNote = `Household need (${householdLabel} × 50 L/day): ~${waterCalc.householdDailyLitres} L/day, ~${Math.round(waterCalc.householdMonthlyLitres / 1000)} kL/month. A 90-day dry-season buffer needs ~${Math.round(waterCalc.dryBufferLitres90Day / 1000)} kL stored.`;

  const gardenIrrigNote = waterCalc.gardenIrrigationDrySeasonDailyLitres != null
    ? `Estimated dry-season garden irrigation for ${formatDesignArea(waterCalc.cultivationAreaM2)} of beds: ~${waterCalc.gardenIrrigationDrySeasonDailyLitres.toLocaleString()} L/day (at 3.5 L/m²).`
    : '';

  // Frost / elevation note for sector map
  const frostNote = (minTemp != null && minTemp < 2)
    ? ` Watch for frost — minimum temperatures around ${minTemp.toFixed(0)}°C can damage tender plants.`
    : '';

  // Elevation note
  const elevationNote = elevation != null && elevation > 1200
    ? ` At ${Math.round(elevation)} m elevation expect cooler nights and shorter growing seasons.`
    : '';

  // Rainfall pattern for wind / sector advice
  const rainfallDesc = annualRainfall != null
    ? `${Math.round(annualRainfall)} mm/year (${rainfallPattern ?? 'unknown'} rainfall${wetSeason ? `, wet season: ${wetSeason}` : ''}${drySeason ? `, dry season: ${drySeason}` : ''})`
    : 'rainfall data not loaded';

  // Build fencing note
  const fencingNote = survey?.hasFencing === 'none'
    ? 'No fencing in place — prioritise a small fully-fenced Zone 1 first before expanding further.'
    : survey?.hasFencing === 'partial'
      ? 'Partial fencing — close the gaps around your most productive beds first.'
      : '';

  // Infrastructure
  const infraNote = surveyOtherInfra.length
    ? `Other infrastructure: ${surveyOtherInfra.join(', ')}.`
    : '';

  // Summary
  const summaryParts = [
    boundary
      ? `Design generated from ${approved.length} approved layer${approved.length !== 1 ? 's' : ''}. Locked layers: ${layerList(locked, 'none yet')}.`
      : 'Design generated from approved farmer geometry. Add a property boundary for stronger zone placement.',
    goalNote,
    challengeNote,
    commercialNote,
  ].filter(Boolean);

  // ---------------------------------------------------------------------------
  // Derived area labels for richer text
  // ---------------------------------------------------------------------------
  const boundaryAreaLabel = boundary ? ` (${formatDesignArea(boundary.areaM2)})` : '';
  const cultivationTotalM2 = sumUsableArea(cultivation);
  const cultivationAreaLabel = cultivationTotalM2 > 0 ? ` (${formatDesignArea(cultivationTotalM2)} total)` : '';
  const treeBeltTotalM2 = sumUsableArea(treeBelts);
  const treeBeltAreaLabel = treeBeltTotalM2 > 0 ? ` (${formatDesignArea(treeBeltTotalM2)})` : '';

  // Biome-specific advice
  const biomeAdvice: Record<string, string> = {
    'Fynbos': 'Fynbos soils are naturally low in nutrients — avoid heavy manuring; rather mulch with local leaf litter and let the soil biology do the work.',
    'Succulent Karoo': 'Water is the main constraint here. Every litre harvested and stored buys you another season of production.',
    'Nama-Karoo': 'This semi-arid biome demands water-first design — swales, shade, and mulch are non-negotiable before planting intensively.',
    'Grassland': 'Grassland soils can be very productive once you add organic matter. Focus on cover crops and compost to build the topsoil layer.',
    'Savanna': 'Fire risk is real — keep Zone 1 beds moist and clear of dry mulch near structures during dry season.',
    'Albany Thicket': 'This biome recovers slowly from disturbance. Protect existing thicket patches and work with them as windbreaks and habitat.',
    'Indian Ocean Coastal Belt': 'High humidity can drive fungal disease — space plants well, prioritise airflow, and avoid overhead irrigation.',
    'Forest': 'Use forest edges as productive shelter — shade-tolerant crops (taro, ginger, leafy greens) thrive here year-round.',
  };
  const biomeSpecificNote = biome ? (biomeAdvice[biome] ?? `This site is in the ${biome} biome — adapt planting to local rainfall and soil.`) : '';

  // Wind protection priority
  const windProtectionNote = (summerWind && winterWind && summerWind !== winterWind)
    ? `Wind shifts between seasons: it comes from the ${summerWind} in summer and the ${winterWind} in winter. You need shelter on both those sides — a mix of deciduous and evergreen trees gives year-round cover.`
    : (summerWind || winterWind)
      ? `Prevailing wind is from the ${summerWind ?? winterWind}. Plant a tree belt or dense hedge on that side to cut wind speed and reduce moisture loss from beds by 30–50%.`
      : 'No wind direction data yet — walk the site on a windy day and note which side the grasses lean toward; that is the side to shelter first.';

  // Slope-driven water movement
  const slopeText = slope != null
    ? slope < 1
      ? `The slope is nearly flat (${slope.toFixed(1)}°) — water sits rather than runs. Focus on drainage channels and raised beds to prevent waterlogging.`
      : slope < 5
        ? `A gentle slope of ${slope.toFixed(1)}° means water moves slowly. A few on-contour swales will capture most of the runoff before it leaves.`
        : slope < 15
          ? `The slope is ${slope.toFixed(1)}° — significant runoff potential. Contour swales every 10–20 m across the slope will slow and sink rain into the soil.`
          : `The slope is steep at ${slope.toFixed(1)}°. Prioritise erosion control: grass cover, stone lines on contour, and terraced beds before anything else.`
    : 'Measure the slope after rain — follow the water and note where it speeds up; that is where you need a barrier first.';

  // Aspect-driven sun advice
  const aspectLabel = locationData?.elevation?.aspectLabel;
  const aspectNote = aspectLabel
    ? `Slope faces ${aspectLabel} — ${
        /north/i.test(aspectLabel) ? 'maximum sun exposure in winter, ideal for beds and warm-season crops.' :
        /south/i.test(aspectLabel) ? 'less direct sun; favour shade-tolerant crops and use north-facing raised beds where possible.' :
        /east/i.test(aspectLabel) ? 'morning sun, afternoon shade — good for leafy greens and reduces afternoon heat stress.' :
        'afternoon sun — use shade cloth in summer and keep water-hungry crops on the eastern side.'
      }`
    : '';

  return {
    id: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    siteId: state.siteId,
    summary: summaryParts.join(' '),
    lockedLayerIds: locked.map((layer) => layer.id),
    sectorMap: [
      {
        title: 'Sun and temperature',
        body: [
          'In the Southern Hemisphere, the best winter sun comes from the north.',
          boundary
            ? `Keep the northern side of ${boundary.name}${boundaryAreaLabel} open — no tall structures or dense trees between your beds and the northern sky.`
            : 'Keep the northern side of the property open for winter sun.',
          aspectNote,
          frostNote,
          elevationNote,
          biomeSpecificNote,
          practiceNote,
        ].filter(Boolean).join(' '),
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Wind and shelter',
        body: [
          windProtectionNote,
          treeBelts.length
            ? `You have ${treeBelts.length} tree/shelter layer${treeBelts.length > 1 ? 's' : ''} mapped${treeBeltAreaLabel}: ${layerList(treeBelts, '')}. Confirm they are on the windward side and fill any gaps.`
            : 'No tree belts mapped yet — even a double row of fast-growing indigenous trees (buffalo thorn, fever tree, wild olive) reduces wind damage within 2–3 seasons.',
          annualRainfall != null
            ? `At ${Math.round(annualRainfall)} mm/year${drySeason ? `, dry season ${drySeason}` : ''}, wind-driven moisture loss is a real yield killer — shelter pays for itself.`
            : '',
        ].filter(Boolean).join(' '),
        layerIds: treeBelts.map((layer) => layer.id),
      },
      {
        title: 'Water flow and slope',
        body: [
          slopeText,
          'Walk the site after rain to see where water flows and pools — that ground survey beats any map.',
          fencingNote,
          livestockNote,
        ].filter(Boolean).join(' '),
        layerIds: boundary ? [boundary.id, ...access.map((l) => l.id)] : access.map((l) => l.id),
      },
      {
        title: 'Fire and access',
        body: [
          `Keep ${layerList(access, 'your entrance and main paths')} wide enough for a vehicle — this is your fire break and your supply route.`,
          biome === 'Savanna' || biome === 'Grassland'
            ? 'Clear dry grass to 3 m on each side of the access route before fire season every year.'
            : '',
          infraNote,
        ].filter(Boolean).join(' '),
        layerIds: access.map((layer) => layer.id),
      },
    ],
    zoneMap: [
      {
        title: 'Zone 0 — your home base',
        body: [
          roof.length
            ? `Zone 0 is centred on ${layerList(roof, 'the main structure')} — this is where tools, seeds, and energy radiate out from.`
            : 'Mark your main structure or working point on the map as Zone 0 — it is the anchor for all other zones.',
          'Everything within 10–15 steps of the kitchen door should be Zone 1 — the highest-care food production area.',
          infraNote,
          surveyOtherInfra.includes('shed') ? 'Shed noted — use it as a dry store for seeds, tools, and dried herbs close to the working zone.' : '',
        ].filter(Boolean).join(' '),
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Zone 1 — daily food production',
        body: [
          cultivation.length
            ? `Zone 1 covers ${layerList(cultivation, 'your mapped cultivation areas')}${cultivationAreaLabel} — the beds you visit every day for watering, harvesting, and care.`
            : 'No cultivation areas mapped yet — start small: 4 to 6 raised beds within easy reach of the kitchen.',
          cropsNote,
          soilNotes.length ? `Soil notes: ${soilNotes.join('; ')}.` : '',
          soilCondition === 'compacted' ? 'Compacted soil in Zone 1 — break it up with a fork, add compost, and mulch before planting.' : '',
          soilCondition === 'sandy' ? 'Sandy soil loses nutrients and water fast — add compost generously and mulch 10 cm deep.' : '',
          'Priority crops for Zone 1: leafy greens, herbs, tomatoes, chillies, and beans — all high-value, low-space, frequent-harvest.',
        ].filter(Boolean).join(' '),
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Zone 2 — main seasonal production',
        body: [
          cultivation.length
            ? `Zone 2 uses the outer parts of ${layerList(cultivation, 'your cultivation areas')} for main-crop rotations, squash, sweet potato, maize, and longer-season vegetables.`
            : 'Zone 2 is the mid-distance growing area — plan paths between beds so you can reach everything without stepping on soil.',
          gardenIrrigNote,
          survey?.isCommercial
            ? `Commercial focus: Zone 2 is where consistent, market-volume yields come from. Plan succession planting so you always have a crop ready. ${goalNote}`
            : goalNote,
          surveyLivestock.includes('chickens') ? 'Rotate chickens through fallow Zone 2 beds between seasons — they scratch, fertilise, and control pests in one pass.' : '',
        ].filter(Boolean).join(' '),
        layerIds: cultivation.map((layer) => layer.id),
      },
      {
        title: 'Zone 3 — low-maintenance and support',
        body: [
          treeBelts.length
            ? `Zone 3 includes ${layerList(treeBelts, 'the outer/boundary areas')}${treeBeltAreaLabel} — planted for shelter, mulch material, nitrogen fixation, and wildlife habitat.`
            : `Zone 3 covers the outer edges of the property${boundaryAreaLabel} — this is where you plant for the long term: nitrogen-fixing trees, fruit trees, hedge species, and fodder crops that look after themselves once established.`,
          surveyCrops.includes('fruit-trees') ? 'Fruit trees already growing — these are your Zone 3 backbone. Under-plant with comfrey, nasturtium, and other dynamic accumulators.' : 'Good Zone 3 trees for SA: wild fig, buffalo thorn, wattle (for mulch), moringa, and indigenous fruit trees.',
          surveyLivestock.includes('goats') || surveyLivestock.includes('cattle')
            ? 'Large livestock need to stay out of planted Zone 1 and 2 — build a kraal at the Zone 3/4 boundary and bring manure to the beds instead.'
            : '',
          surveyLivestock.includes('bees') ? 'Beehives belong in Zone 3 — away from daily foot traffic but close enough to benefit from Zone 1 and 2 flowers.' : '',
        ].filter(Boolean).join(' '),
        layerIds: treeBelts.map((layer) => layer.id),
      },
      {
        title: 'Zone 4/5 — boundary and wild margin',
        body: [
          boundary
            ? `The property boundary${boundaryAreaLabel} defines your outer limit. Use the margin inside the fence for pioneer species, fodder, and wildlife corridors.`
            : 'Map your full property boundary to understand how much space is available for outer zones.',
          'Leave at least a 3–5 m wild strip inside the boundary fence — it reduces wind speed, provides habitat for beneficial insects, and stops erosion at the edge.',
          surveyLivestock.includes('cattle') ? 'Keep cattle in Zone 4/5 on rotational grazing. Move them before they overgraze and let pasture recover fully.' : '',
        ].filter(Boolean).join(' '),
        layerIds: boundary ? [boundary.id] : [],
      },
    ],
    waterMap: [
      {
        title: 'How much water does this place need?',
        body: [
          householdNeedNote,
          waterSourceNote,
          waterStorageNote,
          annualRainfall != null
            ? `Annual rainfall here: ${rainfallDesc}. ${
                annualRainfall < 300
                  ? 'Below 300 mm/year — this is serious water stress territory. Every drop must be caught, stored, and used twice.'
                  : annualRainfall < 600
                    ? 'Between 300–600 mm/year — water is the main limiting factor. Fill tanks from every roof and harvest every drop of rain that falls on site.'
                    : annualRainfall < 900
                      ? 'Between 600–900 mm/year — enough to grow well with good water management. Focus on eliminating runoff.'
                      : 'Above 900 mm/year — good rainfall, but it often arrives unevenly. Store the surplus from wet season to carry through the dry.'
              }`
            : 'Reload location data to get rainfall figures.',
          drySeason ? `Dry season (${drySeason}) is the critical period — plan storage and irrigation to cover these months without relying on rain.` : '',
        ].filter(Boolean).join(' '),
        layerIds: water.map((layer) => layer.id),
      },
      {
        title: 'Roof harvest potential',
        body: [
          annualRainfall != null
            ? `Rainfall at this site: ${rainfallDesc}.`
            : 'Reload location data to get rainfall figures.',
          roofHarvestNote ?? '',
          waterCalc.roofHarvestAnnualKL != null
            ? `To store a 90-day household buffer (${Math.round(waterCalc.dryBufferLitres90Day / 1000)} kL), you need tanks sized to that volume minimum. A 5 000 L JoJo tank costs roughly R2 000–R3 500 — compare that to what you currently pay for water or trucking.`
            : '',
          hasGutters
            ? 'Gutters in place — make sure each downpipe has a first-flush diverter (cheap to build) to keep the tank clean.'
            : 'No gutters yet — a simple IBR roof with 100 mm gutters and a downpipe to a JoJo is a weekend project that pays back for decades.',
        ].filter(Boolean).join(' '),
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Slow, sink, and spread rainfall',
        body: [
          slopeText,
          slope != null && slope > 1
            ? `Dig on-contour swales ${slope < 5 ? '20–30 m' : '10–15 m'} apart across the slope. Pile the soil on the downhill side as a berm and plant it with nitrogen-fixing shrubs.`
            : 'Even on flat land, slight depressions and mulched basins around trees slow water down long enough for it to sink in.',
          soilCondition === 'compacted' ? 'Compacted soil sheds water like a roof — break the hardpan with a subsoiler or deep-forked swale trenches before you expect water to sink in.' : '',
          soilCondition === 'sandy' ? 'Sandy soil drains too fast — hugelkultur beds (buried logs) act as underground sponges and slow drainage significantly.' : '',
          soilCondition === 'clay' ? 'Clay is slow to absorb but holds water once it does — keep it covered with mulch to prevent surface sealing after heavy rain.' : '',
          'After every rain event, walk the boundary and note where water exits the property — that is your first swale location.',
        ].filter(Boolean).join(' '),
        layerIds: boundary ? [boundary.id] : [],
      },
      {
        title: 'Existing water features',
        body: [
          water.length
            ? `${layerList(water, 'Existing water bodies')} are mapped on site. Record their water level at the start and end of each dry season to track how your land is changing over time.`
            : 'No water bodies mapped yet. Even a simple earth dam or pond stores water between rain events and raises the local water table under the surrounding land.',
          water.length && surveyWaterSources.length
            ? `Water sources available (from survey): ${surveyWaterSources.join(', ')}. Cross-check with what you see on the map.`
            : '',
          surveyChallenges.includes('flooding') ? 'Flooding listed as a challenge — map where water pools and consider converting those low spots into productive dams or wetland gardens rather than fighting the water.' : '',
        ].filter(Boolean).join(' '),
        layerIds: water.map((layer) => layer.id),
      },
    ],
    opportunityMap: [
      {
        title: 'Highest-return first moves',
        body: [
          'The sequence that works on almost every SA smallholding: (1) fix the water system, (2) fence a small intensive Zone 1, (3) build soil with compost, then (4) expand planting. Skipping steps wastes effort.',
          waterCalc.roofHarvestAnnualKL != null
            ? `Your roof can catch ~${waterCalc.roofHarvestAnnualKL.toLocaleString()} kL/year — if you only do one thing this season, connect gutters to a tank.`
            : 'Start with water: map your roof area in the site survey to see what harvest is possible before buying any tanks.',
          goalNote,
          commercialNote,
        ].filter(Boolean).join(' '),
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Compost and soil building',
        body: [
          surveyOtherInfra.includes('compost-bay')
            ? 'Compost bay already in place — aim for two bays so you always have one filling and one finishing. Turn every 2–3 weeks for fast results.'
            : 'Build two compost bays from pallets or wire mesh within 30 steps of Zone 1. Fill with kitchen scraps, green garden waste, dry stalks, and livestock manure in layers.',
          cultivation.length
            ? `With ${formatDesignArea(cultivationTotalM2)} of beds, you need roughly ${Math.round(cultivationTotalM2 * 0.05)} m³ of compost per season (5 cm top-dress). Two standard 1 m³ bays running continuously can supply that.`
            : 'Even a single 1 m³ compost heap cycling kitchen scraps and garden waste builds soil faster than any bought fertiliser.',
          soilNotes.length ? `Current soil notes: ${soilNotes.join('; ')}.` : '',
          survey?.isCommercial && !surveyOtherInfra.includes('shade-tunnel') ? 'Selling produce? A simple polypipe tunnel house (R3 000–R8 000 DIY) extends the season and doubles seedling production capacity.' : '',
        ].filter(Boolean).join(' '),
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Food forest and orchard',
        body: [
          boundary
            ? `The boundary margin of ${boundary.name}${boundaryAreaLabel} is ideal for a layered food forest — tall canopy fruit trees (mango, avocado, macadamia by biome), mid-layer natal plum, lemon, and groundcover of comfrey, sweet potato, and herbs.`
            : 'Use the outer edges of the property for long-term food tree planting — they take years to mature but need very little attention once established.',
          'A 10 m × 10 m food forest patch — once established — can supply fruit, firewood, mulch material, and habitat for beneficial insects with almost no ongoing labour.',
          surveyCrops.includes('fruit-trees')
            ? 'Fruit trees already on site — plan succession so you always have trees at 1, 3, 5, and 10+ years of age. Mark them on the map and track yields.'
            : biome && /Savanna|Grassland|Natal|Limpopo/i.test(biome)
              ? 'Good trees for this biome: marula, wild fig, natal plum, buffalo thorn, moringa, and fever tree for the outer zone.'
              : 'Talk to a local nursery about which indigenous fruit trees succeed in your specific district — local provenance stock always outperforms exotic transplants.',
          'Pollinator strips (sunflower, borage, phacelia, indigenous wildflowers) along Zone 2 edges improve vegetable yields by 20–30% without any other change.',
        ].filter(Boolean).join(' '),
        layerIds: boundary ? [boundary.id, ...treeBelts.map((l) => l.id)] : treeBelts.map((l) => l.id),
      },
      {
        title: 'Water infrastructure upgrades',
        body: [
          waterCalc.roofHarvestAnnualKL != null && waterCalc.dryBufferLitres90Day > 0
            ? `Tank sizing guide: roof harvest ~${waterCalc.roofHarvestAnnualKL.toLocaleString()} kL/year, 90-day household buffer ~${Math.round(waterCalc.dryBufferLitres90Day / 1000)} kL. If harvest > buffer, one good rainy season fills your reserve. If not, supplement with a borehole or grey-water reuse.`
            : 'Complete the roof harvest estimate in the site survey to size your tanks correctly.',
          waterCalc.gardenIrrigationDrySeasonDailyLitres != null
            ? `Dry-season garden irrigation for ${formatDesignArea(cultivationTotalM2)}: roughly ${waterCalc.gardenIrrigationDrySeasonDailyLitres.toLocaleString()} L/day. Drip irrigation reduces this by 40–60% versus overhead watering.`
            : '',
          surveyChallenges.includes('drought') ? 'Drought is your main challenge — invest in shade cloth (30–40%), thick mulch (10 cm minimum), and drip lines before the dry season. These three together can halve your irrigation demand.' : '',
          surveyChallenges.includes('flooding') ? 'Flooding challenge noted — raised beds (30 cm above current grade) and swale cut-off drains above the growing area keep production going through wet spells.' : '',
        ].filter(Boolean).join(' '),
        layerIds: [...water, ...roof].map((layer) => layer.id),
      },
      ...(challengeNote ? [{
        title: 'Tackling your main challenges',
        body: [
          challengeNote,
          surveyChallenges.includes('pests') ? 'Pest control without chemicals: companion planting (marigolds, basil, nasturtium), beneficial insect habitat (flower strips), chickens on rotation, and a strict crop-rotation calendar.' : '',
          surveyChallenges.includes('labour') ? 'Labour shortage: heavily mulch all beds (less weeding), install drip irrigation (less watering), and focus on a small, super-productive Zone 1 rather than spreading effort across a large plot.' : '',
          surveyChallenges.includes('soil') ? 'Soil restoration sequence: (1) stop bare soil exposure with mulch or cover crops, (2) add compost and kraal manure, (3) plant nitrogen-fixers on the edges, (4) test and adjust pH only after 12 months of organic build-up.' : '',
          surveyChallenges.includes('weeds') ? 'Weed pressure drops dramatically with 10 cm of wood-chip or straw mulch. Pull a weed once before mulching and you may not see it again for a season.' : '',
          surveyChallenges.includes('market-access') ? 'For market access challenges: focus on high-value, low-weight, long-shelf-life crops — dried herbs, chilli, baby salad leaves, and seedlings travel well and command better margins than bulk vegetables.' : '',
          surveyChallenges.includes('erosion') ? 'Erosion control first: plant vetiver grass or stone lines on contour, cover bare soil immediately with mulch or a fast-growing cover crop (vetch, oats, or cowpeas), and keep foot traffic on designated paths.' : '',
          surveyChallenges.includes('finance') ? 'On a tight budget: propagate from seed not seedlings, make your own compost, and barter or share tools with neighbours. A small intensive plot produces far more value per rand spent than a large neglected one.' : '',
        ].filter(Boolean).join(' '),
        layerIds: [...cultivation, ...treeBelts].map((layer) => layer.id),
      }] : []),
    ],
    exportNotes: [
      'North is preserved from the map. Do not rotate the base geometry in the final map.',
      'Locked layers are farmer-approved and must not be moved by AI-generated styling.',
      'Use the PNG for quick sharing and the PDF for a one-page farmer handout.',
      ...(waterCalc.roofHarvestAnnualKL != null ? [`Water estimates are approximate: roof harvest ~${waterCalc.roofHarvestAnnualKL.toLocaleString()} kL/year, household need ~${Math.round(waterCalc.householdMonthlyLitres / 1000)} kL/month.`] : []),
    ],
    // Enrichment fields
    waterCalc,
    surveyGoals,
    surveySnapshot: survey ? {
      soilCondition: survey.soilCondition,
      challenges: survey.challenges,
      existingCrops: survey.existingCrops,
      waterSources: survey.waterSource,
      isCommercial: survey.isCommercial,
      farmingPractice: survey.farmingPractice,
      householdSize: waterCalc.householdDailyLitres / 50,
    } : undefined,
  };
}
