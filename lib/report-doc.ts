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
  | 'trees' | 'shrubs' | 'groundcovers' | 'climbers' | 'n-fixers' | 'windbreak' | 'pioneer';
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
  const rainMm = Math.round(location.rainfall?.annual ?? 0);
  const approved = layers.filter((l) => l.approved);
  const totalM2 = approved
    .filter((l) => l.layerType === 'property_boundary')
    .reduce((s, l) => s + (l.areaM2 || 0), 0) || approved.reduce((s, l) => s + (l.areaM2 || 0), 0);
  const sizeHa = totalM2 > 0 ? +(totalM2 / 10000).toFixed(3) : undefined;
  const roof = approved.find((l) => l.layerType === 'roof');
  const garden = approved.find((l) => l.layerType === 'cultivation');
  const tree = approved.find((l) => l.layerType === 'tree_belt');
  const harvestKL = wc?.roofHarvestAnnualKL ?? (roof ? Math.round((roof.areaM2 * rainMm * 0.8) / 1000) : null);

  const crops = clean(survey?.existingCrops, ['nothing']).map((c) => CROP_LABELS[c] ?? c);
  const livestock = clean(survey?.livestock, ['none']).map((l) => LIVESTOCK_LABELS[l] ?? l);
  const goals = clean(survey?.goals);

  // ── Executive ──
  const opportunities: string[] = [];
  if (harvestKL) opportunities.push(`Harvest ~${harvestKL.toLocaleString()} kL/year of rainwater off the roof — connect gutters to a tank.`);
  if (garden) opportunities.push(`Intensify the existing ${Math.round(garden.areaM2)} m² vegetable garden with beds, compost and drip irrigation.`);
  opportunities.push('Establish a north-facing orchard / food forest on the open sunny ground.');
  if (tree) opportunities.push('Keep the existing tree belt as a windbreak and biodiversity buffer.');

  const challenges = clean(survey?.challenges);
  if ((location.climate?.minTemp ?? 99) < 5) challenges.push('Frost risk in the low-lying corner — keep tender crops off it.');
  if (rainMm && rainMm < 500) challenges.push('Low/erratic rainfall — water capture and storage are the priority.');
  if (survey?.soilCondition === 'compacted') challenges.push('Compacted soil — needs aeration and organic-matter building.');
  if (!challenges.length) challenges.push('Building soil fertility and year-round food production.');

  const executive: ExecutiveSummary = {
    farmOverview: `A ${sizeHa ? `${sizeHa} ha` : ''} site in the ${biome}${rainMm ? ` (~${rainMm} mm/yr)` : ''}.${goals.length ? ` The household's main goals are ${goals.join(', ')}.` : ''} This plan organises the land into permaculture zones from the house outward, captures water high in the landscape, and builds a layered, largely self-feeding system.`,
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
    sizeHa: sizeHa ? { value: sizeHa, unit: 'ha', provenance: 'measured', basis: 'traced property boundary' } : undefined,
    climateSummary: `${biome}. ~${rainMm} mm/year (${location.rainfall?.pattern ?? 'seasonal'} rainfall), ${location.climate ? `${Math.round(location.climate.minTemp)}–${Math.round(location.climate.maxTemp)} °C` : 'temperate'}.`,
    currentLandUses: [garden ? 'vegetable garden' : '', tree ? 'trees / bush' : '', 'dwelling'].filter(Boolean),
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
    runoffRisk: location.elevation?.slopeDeg && location.elevation.slopeDeg > 5 ? 'Moderate — slope drives runoff; slow it with swales.' : 'Low–moderate on gentle slopes.',
    erosionRisk: location.elevation?.slopeDeg && location.elevation.slopeDeg > 10 ? 'Watch bare slopes — keep them covered.' : 'Low if ground stays covered.',
    floodRisk: 'Observe the low corner after heavy rain (no detailed survey).',
    harvestingOpportunities: [
      harvestKL ? `Roof catchment ~${harvestKL.toLocaleString()} kL/yr to tanks.` : 'Connect roof gutters to a tank.',
      'Swales on contour to slow, spread and sink runoff.',
    ],
    recommendedEarthworks: [
      { type: 'Swale', note: 'On contour, upslope of the garden.' },
      { type: 'Tank', note: roof ? `Sized to the roof harvest above.` : 'JoJo tank at the house.' },
    ],
    estStorageCapacity: wc?.dryBufferLitres90Day
      ? { value: Math.round(wc.dryBufferLitres90Day / 1000), unit: 'kL', provenance: 'calculated', basis: '90-day household dry-season buffer' }
      : undefined,
  };

  // ── Landscape & soil ──
  const el = location.elevation;
  const so = location.soil;
  const landscapeSoil: LandscapeSoil = {
    slope: el ? { value: el.slopeDeg, unit: '°', provenance: 'estimated', basis: 'coarse elevation grid — confirm on site' } : undefined,
    aspect: el?.aspectLabel ?? 'unknown',
    soilTexture: so?.textureClass ?? 'unknown',
    ph: so?.ph != null ? { value: so.ph, provenance: 'estimated', basis: 'SoilGrids model — confirm with a soil test' } : undefined,
    organicMatter: so?.organicCarbon != null ? { value: so.organicCarbon, unit: '% OC', provenance: 'estimated', basis: 'SoilGrids model' } : undefined,
    compaction: survey?.soilCondition === 'compacted' ? 'Reported compacted — aerate before planting.' : 'Assess by digging a test hole.',
    erosion: water.erosionRisk,
    improvementPlan: [
      { action: 'Add compost and mulch to build organic matter', timing: 'ongoing', provenance: 'estimated' },
      { action: so?.ph != null && so.ph < 5.5 ? 'Lime to raise pH toward 6.5' : 'Maintain pH with compost', timing: 'before planting', provenance: 'estimated' },
    ],
    coverCrops: ['cowpea', 'sunn hemp', 'oats/vetch (winter)'],
  };

  // ── Sector ──
  const cl = location.climate;
  const isSH = (location.lat ?? -29) < 0;
  const sector: SectorAnalysis = {
    sun: `Strongest sun from the ${isSH ? 'north' : 'south'} (${isSH ? 'Southern' : 'Northern'} Hemisphere) — face beds and orchard that way.`,
    windSummer: cl?.windFromSummer ? `Summer wind from the ${cl.windFromSummer}.` : 'Note the prevailing summer wind.',
    windWinter: cl?.windFromWinter ? `Winter wind from the ${cl.windFromWinter} — plant a windbreak on this edge.` : 'Note the cold winter wind direction.',
    fire: 'Keep fuel load down on the dry-wind edge; a green firebreak helps.',
    wildlife: tree ? 'The tree belt is a wildlife corridor — keep a wild buffer.' : 'Leave a wild edge for beneficial wildlife.',
    security: 'Position the house with clear sightlines to the gate and garden.',
    dust: 'Screen dust from the road/driveway with a hedge.',
    frost: (cl?.minTemp ?? 99) < 5 ? 'Cold air drains to the low corner — keep tender crops above it.' : 'Low frost risk.',
    neighbours: 'Screen overlooked edges; keep neighbourly access clear.',
    externalOpportunities: ['Roof + driveway runoff to harvest', 'Sun on the northern slope for the orchard'],
  };

  // ── Zones (from the generated plan if present) ──
  const zone: ZoneEntry[] = (plan?.zoneMap ?? []).map((s, i) => ({
    zone: i,
    name: s.title,
    layerIds: s.layerIds ?? [],
    purpose: s.body,
    elements: [],
    dailyManagement: '',
    expectedBenefits: '',
  }));

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
    layerSnapshot: approved.map((l) => ({ id: l.id, name: l.name, layerType: l.layerType, areaM2: l.areaM2 })),
    sectionsMeta,
    sections: {
      executive,
      'existing-site': existingSite,
      water,
      'landscape-soil': landscapeSoil,
      sector,
      zone,
      implementation,
    },
  };
}
