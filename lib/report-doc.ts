// ── ImbewuField structured report ("ReportDoc") ──────────────────────────────
// The 11-section, map-linked report is the product differentiator. This is the
// durable, typed source of truth: an instant LOCAL skeleton is built from data we
// already have, then (Phase B) Claude enriches each section in the background.
import type { LocationData } from '@/lib/types';
import type {
  DesignLayer,
  GeneratedDesignPlan,
  WaterCalcSummary,
} from '@/lib/design-studio';
import type { SiteSurvey } from '@/lib/site-survey';
import {
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  roofHarvestLitres,
} from '@/lib/roof-runoff';

// Which map each report section links to ("View [X] map").
export type MapRef = 'base' | 'water' | 'sector' | 'zone' | 'design' | 'implementation';

// Honesty contract: every number-bearing field declares where it came from.
// 'estimated' renders with a visible "~ est." chip so we never fake precision.
export type Provenance = 'measured' | 'calculated' | 'estimated' | 'user-reported';
export interface Valued<T = number> {
  value: T;
  unit?: string;
  provenance: Provenance;
  basis?: string;
}

export const REPORT_SECTION_IDS = [
  'executive',
  'existing-site',
  'water',
  'landscape-soil',
  'sector',
  'zone',
  'master-design',
  'planting',
  'implementation',
  'cost-labour',
  'monitoring',
] as const;
export type ReportSectionId = (typeof REPORT_SECTION_IDS)[number];

export type SectionStatus = 'skeleton' | 'enriching' | 'ready' | 'error';
export interface ReportSectionMeta {
  id: ReportSectionId;
  title: string;
  map: MapRef;
  status: SectionStatus;
}

// ── Section payloads ─────────────────────────────────────────────────────────
export interface ExecutiveSummary {
  farmOverview: string;
  topOpportunities: string[];
  topChallenges: string[];
  priorityActions12mo: { month: string; action: string; why: string }[];
  regenScore?: Valued<number>;
}
export interface ExistingSite {
  sizeHa?: Valued;
  climateSummary: string;
  currentLandUses: string[];
  infrastructure: string[];
  existingCrops: string[];
  existingLivestock: string[];
  existingTrees: string[];
  observations: string[];
}
export interface WaterSection {
  rainfall?: Valued;
  pattern: string;
  sources: string[];
  storageExisting: string[];
  runoffRisk: string;
  erosionRisk: string;
  floodRisk: string;
  harvestingOpportunities: string[];
  recommendedEarthworks: { type: string; note: string }[];
  estStorageCapacity?: Valued;
}
export interface LandscapeSoil {
  slope?: Valued;
  aspect: string;
  soilTexture: string;
  ph?: Valued;
  organicMatter?: Valued;
  compaction: string;
  erosion: string;
  improvementPlan: { action: string; timing: string; provenance: Provenance }[];
  coverCrops: string[];
}
export interface SectorAnalysis {
  sun: string;
  windSummer: string;
  windWinter: string;
  fire: string;
  wildlife: string;
  security: string;
  dust: string;
  frost: string;
  neighbours: string;
  externalOpportunities: string[];
}
export interface ZoneEntry {
  zone: number;
  name: string;
  layerIds: string[];
  purpose: string;
  elements: string[];
  dailyManagement: string;
  expectedBenefits: string;
}
export interface DesignFeature {
  key: string;
  name: string;
  layerIds: string[];
  purpose: string;
  dimensions?: string;
  construction: string[];
  plants?: string[];
  maintenance: string[];
}
export type PlantCategory =
  | 'trees' | 'shrubs' | 'groundcovers' | 'climbers' | 'n-fixers' | 'windbreak' | 'pioneer' | 'to-select';
export interface PlantingTable {
  category: PlantCategory;
  rows: { species: string; qty?: Valued; spacing: string; season: string; purpose: string }[];
}
export interface ImplementationPhase {
  phase: number;
  label: string;
  monthRange?: string;
  budgetBand?: 'low' | 'medium' | 'high';
  steps: { seq: number; task: string; layerIds: string[]; map: MapRef; why?: string }[];
}
export interface CostLine {
  phase: number;
  item: string;
  materialsCostZar?: Valued;
  labourDays?: Valued;
  equipment: string[];
}
export interface MonitoringMetric {
  key: 'tree-survival' | 'soil-om' | 'water-storage' | 'ground-cover' | 'biodiversity' | 'yields' | 'carbon';
  label: string;
  baseline?: Valued;
  target?: Valued;
  howToMeasure: string;
}

export interface ReportDoc {
  schemaVersion: 1;
  id: string;
  siteId: string;
  name: string;
  createdAt: string;
  lang: string;
  location: LocationData;
  survey?: SiteSurvey;
  waterCalc?: WaterCalcSummary;
  layerSnapshot: Pick<DesignLayer, 'id' | 'name' | 'layerType' | 'areaM2'>[];
  sectionsMeta: ReportSectionMeta[];
  sections: {
    executive?: ExecutiveSummary;
    'existing-site'?: ExistingSite;
    water?: WaterSection;
    'landscape-soil'?: LandscapeSoil;
    sector?: SectorAnalysis;
    zone?: ZoneEntry[];
    'master-design'?: DesignFeature[];
    planting?: PlantingTable[];
    implementation?: ImplementationPhase[];
    'cost-labour'?: CostLine[];
    monitoring?: MonitoringMetric[];
  };
}

const SECTION_TITLES: Record<ReportSectionId, { title: string; map: MapRef }> = {
  executive: { title: 'Executive Summary', map: 'design' },
  'existing-site': { title: 'Existing Site', map: 'base' },
  water: { title: 'Water', map: 'water' },
  'landscape-soil': { title: 'Landscape & Soil', map: 'base' },
  sector: { title: 'Sector Analysis', map: 'sector' },
  zone: { title: 'Zones', map: 'zone' },
  'master-design': { title: 'Master Design', map: 'design' },
  planting: { title: 'Planting', map: 'zone' },
  implementation: { title: 'Implementation Plan', map: 'implementation' },
  'cost-labour': { title: 'Cost & Labour', map: 'implementation' },
  monitoring: { title: 'Monitoring', map: 'design' },
};

const LIVESTOCK_LABELS: Record<string, string> = {
  chickens: 'chickens', goats: 'goats', cattle: 'cattle', pigs: 'pigs', bees: 'bees',
};
const CROP_LABELS: Record<string, string> = {
  vegetables: 'vegetables', 'fruit-trees': 'fruit trees', herbs: 'herbs',
  indigenous: 'indigenous plants', fodder: 'fodder', grain: 'grain',
};

function clean(arr: string[] | undefined, drop: string[] = []): string[] {
  return (arr ?? []).filter((x) => x && !drop.includes(x));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function finiteNonNegative(value: unknown): number | undefined {
  const finite = finiteNumber(value);
  return finite !== undefined && finite >= 0 ? finite : undefined;
}

function finitePositive(value: unknown): number | undefined {
  const finite = finiteNonNegative(value);
  return finite !== undefined && finite > 0 ? finite : undefined;
}

// ── Instant LOCAL skeleton — no AI, renders in <1s ───────────────────────────
export function buildSkeletonReportDoc(args: {
  id: string;
  siteId: string;
  location: LocationData;
  survey: SiteSurvey | null;
  layers: DesignLayer[];
  plan: GeneratedDesignPlan | null;
  lang?: string;
  createdAt: string;
}): ReportDoc {
  const { id, siteId, location, survey, layers, plan, createdAt } = args;
  const lang = args.lang ?? 'en';
  const wc = plan?.waterCalc;
  const biome = location.biome?.name ?? 'this region';
  // KZN sites get a finer zone note appended (BRU code + best-effort named
  // Bioresource Group). Non-KZN sites are unaffected — location.bru is null.
  const bruNote = location.bru
    ? ` (BRU ${location.bru.brucode}, approx. ${location.bru.nearestBrg})`
    : '';
  const annualRainfall = finitePositive(location.rainfall?.annual);
  const rainMm = annualRainfall !== undefined ? Math.round(annualRainfall) : 0;
  const approved = layers.filter((l) => l.approved);
  const areaOf = (layer: DesignLayer): number => finitePositive(layer.areaM2) ?? 0;
  const boundaryM2 = approved
    .filter((l) => l.layerType === 'property_boundary')
    .reduce((sum, layer) => sum + areaOf(layer), 0);
  const totalM2 = boundaryM2 || approved.reduce((sum, layer) => sum + areaOf(layer), 0);
  const sizeHa = totalM2 > 0 ? +(totalM2 / 10000).toFixed(3) : undefined;
  const roof = approved.find((l) => l.layerType === 'roof');
  const garden = approved.find((l) => l.layerType === 'cultivation');
  const tree = approved.find((l) => l.layerType === 'tree_belt');
  const roofAreaM2 = roof ? finitePositive(roof.areaM2) : undefined;
  const gardenAreaM2 = garden ? finitePositive(garden.areaM2) : undefined;
  const calculatedHarvestLitres = roofAreaM2 && rainMm
    ? roofHarvestLitres(roofAreaM2, rainMm, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT)
    : 0;
  const harvestKL = finitePositive(wc?.roofHarvestAnnualKL)
    ?? (calculatedHarvestLitres > 0 ? Math.round(calculatedHarvestLitres / 1000) : null);

  const crops = clean(survey?.existingCrops, ['nothing']).map((c) => CROP_LABELS[c] ?? c);
  const livestock = clean(survey?.livestock, ['none']).map((l) => LIVESTOCK_LABELS[l] ?? l);
  const goals = clean(survey?.goals);

  // ── Executive ──
  const opportunities: string[] = [];
  if (harvestKL) opportunities.push(`Harvest ~${harvestKL.toLocaleString()} kL/year of rainwater off the roof — connect gutters to a tank.`);
  if (gardenAreaM2) opportunities.push(`Intensify the existing ${Math.round(gardenAreaM2)} m² vegetable garden with beds, compost and drip irrigation.`);
  opportunities.push('Establish a north-facing orchard / food forest on the open sunny ground.');
  if (tree) opportunities.push('Keep the existing tree belt as a windbreak and biodiversity buffer.');

  const challenges = clean(survey?.challenges);
  const minTemp = finiteNumber(location.climate?.minTemp);
  const maxTemp = finiteNumber(location.climate?.maxTemp);
  if (minTemp !== undefined && minTemp < 5) challenges.push('Frost risk in the low-lying corner — keep tender crops off it.');
  if (rainMm && rainMm < 500) challenges.push('Low/erratic rainfall — water capture and storage are the priority.');
  if (survey?.soilCondition === 'compacted') challenges.push('Compacted soil — needs aeration and organic-matter building.');
  if (!challenges.length) challenges.push('Building soil fertility and year-round food production.');

  const executive: ExecutiveSummary = {
    farmOverview: `A ${sizeHa !== undefined ? `${sizeHa} ha ` : ''}site in the ${biome}${bruNote}${rainMm ? ` (~${rainMm} mm/yr)` : ''}.${goals.length ? ` The household's main goals are ${goals.join(', ')}.` : ''} This plan organises the land into permaculture zones from the house outward, captures water high in the landscape, and builds a layered, largely self-feeding system.`,
    topOpportunities: opportunities.slice(0, 5),
    topChallenges: challenges.slice(0, 5),
    priorityActions12mo: [
      { month: 'Months 1–2', action: 'Set up compost and connect roof gutters to a tank', why: 'Fast wins: fertility + stored water before the dry season.' },
      { month: 'Months 2–3', action: 'Mark and dig the first swale on contour above the garden', why: 'Slows and sinks runoff where it is most useful.' },
      { month: 'Months 3–5', action: 'Plant fruit & nut trees in the orchard zone', why: 'Get perennials established in the planting season.' },
      { month: 'Months 6–9', action: 'Expand the kitchen garden and add small livestock if planned', why: 'Builds daily food production close to the house.' },
      { month: 'Months 9–12', action: 'Plant the windbreak / tree-belt edge and review progress', why: 'Protects the system and closes the first cycle.' },
    ],
  };

  // ── Existing site ──
  const existingSite: ExistingSite = {
    sizeHa: sizeHa !== undefined ? { value: sizeHa, unit: 'ha', provenance: 'measured', basis: 'traced property boundary' } : undefined,
    climateSummary: `${biome}${bruNote}. ${rainMm ? `~${rainMm} mm/year (${location.rainfall?.pattern ?? 'seasonal'} rainfall)` : 'Rainfall unavailable'}, ${minTemp !== undefined && maxTemp !== undefined ? `${Math.round(minTemp)}–${Math.round(maxTemp)} °C` : 'temperature unavailable'}.`,
    currentLandUses: [gardenAreaM2 ? 'vegetable garden' : '', tree ? 'trees / bush' : '', 'dwelling'].filter(Boolean),
    infrastructure: clean(survey?.otherInfra),
    existingCrops: crops,
    existingLivestock: livestock,
    existingTrees: tree ? ['existing tree belt'] : [],
    observations: [],
  };

  // ── Water ──
  const water: WaterSection = {
    rainfall: rainMm ? { value: rainMm, unit: 'mm/yr', provenance: 'measured', basis: 'NASA POWER / Open-Meteo' } : undefined,
    pattern: location.rainfall?.pattern ?? 'seasonal',
    sources: clean(survey?.waterSource),
    storageExisting: clean(survey?.waterStorage, ['none']),
    runoffRisk: (finiteNonNegative(location.elevation?.slopeDeg) ?? 0) > 5 ? 'Moderate — slope drives runoff; slow it with swales.' : 'Low–moderate on gentle slopes.',
    erosionRisk: (finiteNonNegative(location.elevation?.slopeDeg) ?? 0) > 10 ? 'Watch bare slopes — keep them covered.' : 'Low if ground stays covered.',
    floodRisk: 'Observe the low corner after heavy rain (no detailed survey).',
    harvestingOpportunities: [
      harvestKL ? `Roof catchment ~${harvestKL.toLocaleString()} kL/yr to tanks.` : 'Connect roof gutters to a tank.',
      'Swales on contour to slow, spread and sink runoff.',
    ],
    recommendedEarthworks: [
      { type: 'Swale', note: 'On contour, upslope of the garden.' },
      { type: 'Tank', note: roof ? `Sized to the roof harvest above.` : 'JoJo tank at the house.' },
    ],
    estStorageCapacity: finitePositive(wc?.dryBufferLitres90Day)
      ? { value: Math.round(finitePositive(wc?.dryBufferLitres90Day)! / 1000), unit: 'kL', provenance: 'calculated', basis: '90-day household dry-season buffer' }
      : undefined,
  };

  // ── Landscape & soil ──
  const el = location.elevation;
  const so = location.soil;
  const slopeDeg = finiteNonNegative(el?.slopeDeg);
  const ph = finitePositive(so?.ph);
  const organicCarbon = finiteNonNegative(so?.organicCarbon);
  const landscapeSoil: LandscapeSoil = {
    slope: slopeDeg !== undefined ? { value: slopeDeg, unit: '°', provenance: 'estimated', basis: 'coarse elevation grid — confirm on site' } : undefined,
    aspect: el?.aspectLabel ?? 'unknown',
    soilTexture: so?.textureClass ?? 'unknown',
    ph: ph !== undefined ? { value: ph, provenance: 'estimated', basis: 'SoilGrids model — confirm with a soil test' } : undefined,
    organicMatter: organicCarbon !== undefined ? { value: organicCarbon, unit: '% OC', provenance: 'estimated', basis: 'SoilGrids model' } : undefined,
    compaction: survey?.soilCondition === 'compacted' ? 'Reported compacted — aerate before planting.' : 'Assess by digging a test hole.',
    erosion: water.erosionRisk,
    improvementPlan: [
      { action: 'Add compost and mulch to build organic matter', timing: 'ongoing', provenance: 'estimated' },
      { action: ph !== undefined && ph < 5.5 ? 'Lime to raise pH toward 6.5' : 'Maintain pH with compost', timing: 'before planting', provenance: 'estimated' },
    ],
    coverCrops: ['cowpea', 'sunn hemp', 'oats/vetch (winter)'],
  };

  // ── Sector ──
  const cl = location.climate;
  const validLatitude = finiteNonNegative(Math.abs(location.lat));
  const isSH = validLatitude !== undefined ? location.lat < 0 : null;
  const windDescription = (direction: string | undefined, fallback: string): string =>
    direction && direction !== '—' ? direction : fallback;
  const sector: SectorAnalysis = {
    sun: isSH === null ? 'Hemisphere unavailable — confirm the sun-facing side on site.' : `Strongest sun from the ${isSH ? 'north' : 'south'} (${isSH ? 'Southern' : 'Northern'} Hemisphere) — face beds and orchard that way.`,
    windSummer: cl?.windFromSummer && cl.windFromSummer !== '—' ? `Summer wind from the ${cl.windFromSummer}.` : windDescription(undefined, 'Note the prevailing summer wind.'),
    windWinter: cl?.windFromWinter && cl.windFromWinter !== '—' ? `Winter wind from the ${cl.windFromWinter} — plant a windbreak on this edge.` : windDescription(undefined, 'Note the cold winter wind direction.'),
    fire: 'Keep fuel load down on the dry-wind edge; a green firebreak helps.',
    wildlife: tree ? 'The tree belt is a wildlife corridor — keep a wild buffer.' : 'Leave a wild edge for beneficial wildlife.',
    security: 'Position the house with clear sightlines to the gate and garden.',
    dust: 'Screen dust from the road/driveway with a hedge.',
    frost: minTemp !== undefined && minTemp < 5 ? 'Cold air drains to the low corner — keep tender crops above it.' : minTemp !== undefined ? 'Low frost risk.' : 'Frost data unavailable — confirm the coldest low point on site.',
    neighbours: 'Screen overlooked edges; keep neighbourly access clear.',
    externalOpportunities: ['Roof + driveway runoff to harvest', 'Sun on the northern slope for the orchard'],
  };

  // ── Zones (from the generated plan if present) ──
  const plannedZones: ZoneEntry[] = (plan?.zoneMap ?? []).map((s, i) => ({
    zone: i,
    name: s.title,
    layerIds: s.layerIds ?? [],
    purpose: s.body,
    elements: [],
    dailyManagement: '',
    expectedBenefits: '',
  }));
  const zone: ZoneEntry[] = plannedZones.length ? plannedZones : [{
    zone: 0,
    name: 'Zone plan pending',
    layerIds: [],
    purpose: 'Generate the design plan to place and describe management zones.',
    elements: [],
    dailyManagement: 'Confirm access frequency with the farmer.',
    expectedBenefits: 'A zone plan keeps frequently used elements close to daily routes.',
  }];

  // ── Master design / planting placeholders ──
  // These remain deliberately non-numeric until the farmer approves exact
  // features, species and spacing. A visible pending row is safer than a
  // section that silently disappears from an “11-section” report.
  const masterDesign: DesignFeature[] = approved.length
    ? approved.map((layer) => ({
      key: layer.id,
      name: layer.name || layer.layerType,
      layerIds: [layer.id],
      purpose: `Use the approved ${layer.layerType.replace(/_/g, ' ')} footprint shown on the design map.`,
      dimensions: areaOf(layer) > 0 ? `${Math.round(areaOf(layer))} m² traced area` : undefined,
      construction: ['Confirm materials and construction detail before work starts.'],
      maintenance: ['Check this feature during the seasonal design review.'],
    }))
    : [{
      key: 'design-pending',
      name: 'Master design pending',
      layerIds: [],
      purpose: 'Approve traced site features before finalising the master design.',
      construction: ['Confirm dimensions and construction detail on the design map.'],
      maintenance: ['Review after the first site walk.'],
    }];

  const planting: PlantingTable[] = [{
    category: 'to-select',
    rows: crops.length
      ? crops.map((crop) => ({
        species: `Crop group: ${crop}`,
        spacing: 'Confirm after species selection',
        season: 'Confirm from the local planting calendar',
        purpose: 'Retain and integrate what is already growing.',
      }))
      : [{
        species: 'Species selection pending',
        spacing: 'Confirm after species selection',
        season: 'Confirm from the local planting calendar',
        purpose: 'Choose plants only after climate, soil and farmer goals are confirmed.',
      }],
  }];

  // ── Implementation (default 3-phase ordering) ──
  const roofIds = roof ? [roof.id] : [];
  const gardenIds = garden ? [garden.id] : [];
  const implementation: ImplementationPhase[] = [
    {
      phase: 1, label: 'Phase 1 — Water & Soil', monthRange: 'Months 1–3', budgetBand: 'low',
      steps: [
        { seq: 1, task: 'Build a compost system near the kitchen', layerIds: gardenIds, map: 'zone', why: 'Free fertility from day one.' },
        { seq: 2, task: 'Connect roof gutters to a rainwater tank', layerIds: roofIds, map: 'water', why: harvestKL ? `Captures ~${harvestKL.toLocaleString()} kL/yr.` : 'Stores water for the dry season.' },
        { seq: 3, task: 'Mark & dig the first swale on contour above the garden', layerIds: gardenIds, map: 'water', why: 'Slows, spreads and sinks runoff.' },
      ],
    },
    {
      phase: 2, label: 'Phase 2 — Planting', monthRange: 'Months 3–6', budgetBand: 'medium',
      steps: [
        { seq: 4, task: 'Plant fruit & nut trees in the orchard zone (north)', layerIds: [], map: 'zone', why: 'Establish perennials in the planting season.' },
        { seq: 5, task: 'Expand kitchen-garden beds + drip irrigation', layerIds: gardenIds, map: 'zone', why: 'Daily food close to the house.' },
        { seq: 6, task: 'Sow cover crops on bare ground', layerIds: [], map: 'base', why: 'Protect and build the soil.' },
      ],
    },
    {
      phase: 3, label: 'Phase 3 — Systems & Edges', monthRange: 'Months 6–12', budgetBand: 'medium',
      steps: [
        { seq: 7, task: 'Plant the windbreak / tree-belt edge', layerIds: tree ? [tree.id] : [], map: 'sector', why: 'Wind protection + biodiversity.' },
        ...(livestock.length ? [{ seq: 8, task: `Set up the ${livestock[0]} system with fencing & rotation`, layerIds: [], map: 'zone' as MapRef, why: 'Integrated fertility & pest control.' }] : []),
      ],
    },
  ];

  const costLabour: CostLine[] = implementation.map((phase) => ({
    phase: phase.phase,
    item: `Get local material, labour and equipment quotes for ${phase.label}.`,
    equipment: [],
  }));

  const monitoring: MonitoringMetric[] = [
    { key: 'tree-survival', label: 'Tree survival', howToMeasure: 'Count living planted trees and record replacements.' },
    { key: 'water-storage', label: 'Stored water', howToMeasure: 'Record tank or dam level at the same time each month.' },
    { key: 'ground-cover', label: 'Ground cover', howToMeasure: 'Photograph the same marked ground points each season.' },
    { key: 'yields', label: 'Harvest yields', howToMeasure: 'Weigh and log each harvest by crop.' },
  ];

  const sectionsMeta: ReportSectionMeta[] = REPORT_SECTION_IDS.map((id) => ({
    id,
    title: SECTION_TITLES[id].title,
    map: SECTION_TITLES[id].map,
    status: 'skeleton',
  }));

  return {
    schemaVersion: 1,
    id,
    siteId,
    name: `${biome} · ${createdAt.slice(0, 10)}`,
    createdAt,
    lang,
    location,
    survey: survey ?? undefined,
    waterCalc: wc,
    layerSnapshot: approved.map((l) => ({ id: l.id, name: l.name, layerType: l.layerType, areaM2: areaOf(l) })),
    sectionsMeta,
    sections: {
      executive,
      'existing-site': existingSite,
      water,
      'landscape-soil': landscapeSoil,
      sector,
      zone,
      'master-design': masterDesign,
      planting,
      implementation,
      'cost-labour': costLabour,
      monitoring,
    },
  };
}
