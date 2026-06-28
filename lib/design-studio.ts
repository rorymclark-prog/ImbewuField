'use client';

import turfArea from '@turf/area';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { markLocalStorageKeyUpdated } from '@/lib/map-sync';
import type { LocationData } from '@/lib/types';
import { loadSurvey } from '@/lib/site-survey';
import type { SiteSurvey } from '@/lib/site-survey';

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
  let roofAreaM2 = roofLayers.reduce((sum, layer) => sum + (layer.areaM2 ?? 0), 0);
  if (roofAreaM2 === 0 && survey) {
    roofAreaM2 = (survey.roofMainM2 ?? 0) + (survey.roofSecondaryM2 ?? 0);
  }

  let roofHarvestAnnualLitres: number | null = null;
  let roofHarvestAnnualKL: number | null = null;
  if (roofAreaM2 > 0 && annualRainfallMm != null && annualRainfallMm > 0) {
    // mm × m2 = litres (1 mm over 1 m2 = 1 litre), × 0.8 efficiency
    roofHarvestAnnualLitres = Math.round(roofAreaM2 * annualRainfallMm * 0.8);
    roofHarvestAnnualKL = Math.round(roofHarvestAnnualLitres / 1000);
  }

  // Garden irrigation: 2–5 L/m2/day dry season; use 3.5 as midpoint estimate
  const cultivationAreaM2 = cultivationLayers.reduce((sum, layer) => sum + (layer.areaM2 ?? 0), 0);
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
    rainfallMmUsed: annualRainfallMm ?? null,
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

  const annualRainfall = locationData?.rainfall?.annual;
  const slope = locationData?.elevation?.slopeDeg;
  const summerWind = locationData?.climate?.windFromSummer;
  const winterWind = locationData?.climate?.windFromWinter;
  const soilTexture = locationData?.soil?.textureClass;
  const biome = locationData?.biome?.name;
  const rainfallPattern = locationData?.rainfall?.pattern;
  const wetSeason = locationData?.rainfall?.wetSeason;
  const drySeason = locationData?.rainfall?.drySeason;
  const minTemp = locationData?.climate?.minTemp;
  const elevation = locationData?.elevation?.elevation;

  // Load site survey — key is the placeId which matches siteId in this context
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
    ? `Estimated roof harvest (${waterCalc.roofAreaM2Used} m² × ${Math.round(annualRainfall ?? 0)} mm × 80%): ~${waterCalc.roofHarvestAnnualKL.toLocaleString()} kL/year.`
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

  return {
    id: `plan-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    siteId: state.siteId,
    summary: summaryParts.join(' '),
    lockedLayerIds: locked.map((layer) => layer.id),
    sectorMap: [
      {
        title: 'Sun sector',
        body: [
          'In the Southern Hemisphere, the best winter sun comes from the north — keep that side of productive beds and structures open.',
          frostNote,
          elevationNote,
          practiceNote,
        ].filter(Boolean).join(' '),
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Wind sector',
        body: [
          `Use trees, hedges, or robust crops as wind filters.`,
          (summerWind || winterWind)
            ? `Summer wind from ${summerWind ?? 'unknown'}, winter wind from ${winterWind ?? 'unknown'} — shelter plantings on those sides protect your beds and reduce water loss.`
            : '',
          biome ? `This site sits in the ${biome} biome.` : '',
        ].filter(Boolean).join(' '),
        layerIds: treeBelts.map((layer) => layer.id),
      },
      {
        title: 'Fire and access sector',
        body: [
          `Keep access clear around ${layerList(access, 'the entrance and paths')} so water, people, and tools can move quickly.`,
          fencingNote,
          livestockNote,
        ].filter(Boolean).join(' '),
        layerIds: access.map((layer) => layer.id),
      },
    ],
    zoneMap: [
      {
        title: 'Zone 0 / daily base',
        body: [
          `Anchor daily activity around ${layerList(roof, 'the home, shed, or main working point')}.`,
          infraNote,
        ].filter(Boolean).join(' '),
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Zone 1 / high-care food',
        body: [
          `Put herbs, seedlings, salad beds, compost, and daily watering near ${layerList(roof.length ? roof : cultivation, 'the easiest-to-reach cultivation area')}.`,
          cropsNote,
          soilNotes.length ? `Soil notes: ${soilNotes.join('; ')}.` : '',
        ].filter(Boolean).join(' '),
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Zone 2 / stable production',
        body: [
          `Use ${layerList(cultivation, 'mapped crop areas')} for main vegetables, perennial beds, and seasonal rotations.`,
          gardenIrrigNote,
          survey?.isCommercial ? 'Plan for consistent, market-sized yields from Zone 2 beds.' : '',
        ].filter(Boolean).join(' '),
        layerIds: cultivation.map((layer) => layer.id),
      },
      {
        title: 'Zone 3 / low-maintenance support',
        body: [
          `Use ${layerList(treeBelts, 'outer edges and less visited areas')} for shelter, mulch plants, fruit trees, and biodiversity.`,
          surveyLivestock.includes('chickens') ? 'Chickens can range here for pest control — rotate access with temporary fencing.' : '',
          surveyLivestock.includes('goats') || surveyLivestock.includes('cattle') ? 'Large livestock should stay out of planted areas — build a kraal on the boundary and use manure as a resource.' : '',
        ].filter(Boolean).join(' '),
        layerIds: treeBelts.map((layer) => layer.id),
      },
    ],
    waterMap: [
      {
        title: 'Household water need',
        body: [householdNeedNote, waterSourceNote, waterStorageNote].filter(Boolean).join(' '),
        layerIds: water.map((layer) => layer.id),
      },
      {
        title: 'Catch and store from roofs',
        body: [
          annualRainfall != null
            ? `Rainfall at this site: ${rainfallDesc}.`
            : 'Reload location data to get rainfall figures.',
          roofHarvestNote ?? '',
          hasGutters ? 'Gutters are already in place — maintain clean downpipes and first-flush diverters.' : 'No gutters recorded yet — fitting gutters and connecting them to a tank is the highest-return water upgrade on most homesteads.',
        ].filter(Boolean).join(' '),
        layerIds: roof.map((layer) => layer.id),
      },
      {
        title: 'Slow and spread on the land',
        body: [
          slope != null
            ? `The mapped slope is about ${slope.toFixed(1)} degrees.`
            : 'Confirm the slope on the ground.',
          'Walk the site after rain to see where water flows and pools, then dig swales, berms, or simple trenches across the slope to slow runoff before it leaves the boundary.',
          soilCondition === 'compacted' ? 'Compacted soil sheds water fast — deep fork or subsoil before planting and add mulch to restore absorption.' : '',
          soilCondition === 'sandy' ? 'Sandy soil drains fast — prioritise mulch, hugelkultur beds, and shade to hold moisture.' : '',
          soilCondition === 'clay' ? 'Clay soil holds water but can waterlog — raised beds and deep-rooted plants help structure it over time.' : '',
        ].filter(Boolean).join(' '),
        layerIds: boundary ? [boundary.id] : [],
      },
      {
        title: 'Existing water features',
        body: water.length
          ? `Design around ${layerList(water, 'existing water bodies')} — record volume and surface area in reports to track changes season to season.`
          : 'No water bodies mapped yet. Add dams, ponds, tanks, or seasonal wet patches to improve the water movement picture.',
        layerIds: water.map((layer) => layer.id),
      },
    ],
    opportunityMap: [
      {
        title: 'Compost and nursery',
        body: [
          'Place compost bays, seedling work, and tool storage close to Zone 1 so daily care stays easy.',
          surveyOtherInfra.includes('compost-bay') ? 'Compost bay already noted — keep it within 20–30 steps of the main beds.' : 'Build at least two compost bays so one always has finished compost while the other fills.',
          survey?.isCommercial && !surveyOtherInfra.includes('shade-tunnel') ? 'A shade tunnel or simple polypipe tunnel house for seedling production pays back quickly if you are selling.' : '',
        ].filter(Boolean).join(' '),
        layerIds: [...roof, ...cultivation].map((layer) => layer.id),
      },
      {
        title: 'Food forest edge',
        body: [
          'Use boundary edges and lower-care corners for a layered food forest — tall fruit trees, mid-layer shrubs, and ground-cover herbs and vegetables.',
          'Pollinator plants on the edges improve vegetable yields in Zone 1 and 2.',
          surveyCrops.includes('fruit-trees') ? 'Fruit trees already growing — plan for succession planting so you always have trees at different stages.' : '',
        ].filter(Boolean).join(' '),
        layerIds: boundary ? [boundary.id, ...treeBelts.map((layer) => layer.id)] : treeBelts.map((layer) => layer.id),
      },
      {
        title: 'Water-first upgrades',
        body: [
          'Before decorative planting, finish the water system: gutters → tank → overflow path → swale → mulch basin.',
          waterCalc.roofHarvestAnnualKL != null && waterCalc.dryBufferLitres90Day > 0
            ? `Your roof can harvest ~${waterCalc.roofHarvestAnnualKL.toLocaleString()} kL/year; the 90-day household buffer is ~${Math.round(waterCalc.dryBufferLitres90Day / 1000)} kL — size your tank storage to cover the gap.`
            : 'Complete the roof harvest estimate in the site survey to size your tank correctly.',
          surveyChallenges.includes('drought') ? 'Drought is a listed challenge — shade cloth, thick mulch, and buried drip irrigation are the most reliable dry-season tools.' : '',
          surveyChallenges.includes('flooding') ? 'Flooding is a listed challenge — swales and raised beds keep crops producing when the land is wet.' : '',
        ].filter(Boolean).join(' '),
        layerIds: [...water, ...roof].map((layer) => layer.id),
      },
      ...(challengeNote ? [{
        title: 'Addressing your main challenges',
        body: [
          challengeNote,
          surveyChallenges.includes('pests') ? 'Companion planting, beneficial insect habitat, and crop rotation reduce pest pressure without chemicals.' : '',
          surveyChallenges.includes('labour') ? 'Reduce labour by mulching heavily, using drip irrigation, and focusing effort on a small intensive Zone 1 before expanding.' : '',
          surveyChallenges.includes('soil') ? 'Restore soil biology first — compost, mulch, and cover crops before adding mineral fertilisers.' : '',
          surveyChallenges.includes('market-access') ? 'Focus on high-value, low-weight crops (herbs, salad leaves, seedlings) that are easy to transport to local markets.' : '',
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
