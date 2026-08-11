// ── ImbewuField structured report ("ReportDoc") ──────────────────────────────
// The 11-section, map-linked report is the product differentiator. This is the
// durable, typed source of truth for the instant local skeleton built from data
// already available in the farmer's design.
import type { LocationData, SoilData } from '@/lib/types';
import type {
  DesignLayer,
  GeneratedDesignPlan,
  WaterCalcSummary,
} from '@/lib/design-studio';
import type { SiteSurvey } from '@/lib/site-survey';
import type { PhasePlan } from '@/lib/phasing';
import {
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  roofHarvestLitres,
} from '@/lib/roof-runoff';
import { studioSummaryHasContent, type StudioReportSummary } from '@/lib/design-studio-report';
import { resolveSiteEcology } from '@/lib/site-ecology';

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

export type SectionStatus = 'skeleton' | 'ready' | 'error';
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
  // 'placed' = species the farmer actually put on their Design Studio plan, with a counted qty —
  // as opposed to the advisory buckets below, which describe roles a species could fill.
  | 'placed'
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

/**
 * What to print as the BASIS of a soil figure — the source that actually answered.
 *
 * SoilGrids is only the basis when SoilGrids replied. When the ISRIC call fails the app
 * substitutes the same seven numbers for every site on Earth (Loam, pH 6.5, 1.2% OC), and
 * naming SoilGrids beside those is a citation of a source that was never consulted. An
 * older stored site carries no `soilSource` at all, and unknown provenance is stated as
 * unknown rather than assumed good.
 */
function soilBasis(soil: SoilData | undefined, suffix = ''): string {
  // A lab result takes no hedging suffix. Every branch below ends by telling
  // the farmer to get a soil test; once they have, repeating it is noise — and
  // worse, it casts doubt on the one figure in the document that actually
  // measured their ground.
  if (soil?.soilSource === 'lab') return 'your uploaded soil test — measured on this site';
  if (soil?.soilSource === 'soilgrids') return `SoilGrids model${suffix}`;
  if (soil?.soilSource === 'estimate') {
    return `no soil data for this point — app default, not a reading${suffix || ' — a soil test is the only way to know'}`;
  }
  return `source not recorded — treat as unverified${suffix || ' — a soil test is the only way to know'}`;
}

// ── Instant LOCAL skeleton — no AI, renders in <1s ───────────────────────────
export function buildSkeletonReportDoc(args: {
  id: string;
  siteId: string;
  location: LocationData;
  survey: SiteSurvey | null;
  layers: DesignLayer[];
  plan: GeneratedDesignPlan | null;
  phasePlan: PhasePlan;
  /** Facts from the farmer's saved Design Studio plan (lib/design-studio-report.ts). Optional so
   *  every existing caller keeps working; null/empty falls back to the pending placeholders. */
  studio?: StudioReportSummary | null;
  lang?: string;
  createdAt: string;
}): ReportDoc {
  const { id, siteId, location, survey, layers, plan, phasePlan, studio, createdAt } = args;
  const lang = args.lang ?? 'en';
  const wc = plan?.waterCalc;
  // The SANBI vegetation unit when it is known, not the coarse biome polygon — see
  // lib/site-ecology.ts for why the two disagree and which one a farmer should be planting from.
  const biome = location.biome
    ? resolveSiteEcology(location.biome, location.vegetation).placeName
    : 'this region';
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
  // Feature footprints often overlap one another, so they cannot stand in for
  // the site's area. Only a traced property boundary earns a size claim.
  const sizeHa = boundaryM2 > 0 ? +(boundaryM2 / 10000).toFixed(3) : undefined;
  const roofs = approved.filter((l) => l.layerType === 'roof');
  const gardens = approved.filter((l) => l.layerType === 'cultivation');
  const trees = approved.filter((l) => l.layerType === 'tree_belt');
  const roofAreaM2 = roofs.reduce((sum, layer) => sum + areaOf(layer), 0) || undefined;
  const gardenAreaM2 = gardens.reduce((sum, layer) => sum + areaOf(layer), 0) || undefined;
  const hasTreeBelt = trees.length > 0;
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
  if (hasTreeBelt) opportunities.push('Keep the existing tree belt as a windbreak and biodiversity buffer.');

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
    currentLandUses: [gardenAreaM2 ? 'vegetable garden' : '', hasTreeBelt ? 'trees / bush' : '', 'dwelling'].filter(Boolean),
    infrastructure: clean(survey?.otherInfra),
    existingCrops: crops,
    existingLivestock: livestock,
    existingTrees: hasTreeBelt ? ['existing tree belt'] : [],
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
      { type: 'Tank', note: roofs.length ? `Sized to the roof harvest above.` : 'JoJo tank at the house.' },
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
    // The basis has to name what was ACTUALLY consulted. When the ISRIC call fails, the
    // route substitutes Loam / pH 6.5 / 1.2% OC for every site alike, and this line used to
    // print "SoilGrids model" beside those constants — crediting a source that never
    // answered. A farmer reading "SoilGrids model" reasonably believes something looked at
    // their land, and the 45-page Ubhejane report built its whole soil section on exactly
    // that misplaced trust. See SoilData.soilSource.
    ph: ph !== undefined ? { value: ph, provenance: 'estimated', basis: soilBasis(so, ' — confirm with a soil test') } : undefined,
    organicMatter: organicCarbon !== undefined ? { value: organicCarbon, unit: '% OC', provenance: 'estimated', basis: soilBasis(so) } : undefined,
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
  const latitude = finiteNumber(location.lat);
  const isSH = latitude !== undefined && Math.abs(latitude) <= 90 ? latitude < 0 : null;
  const windDescription = (direction: string | undefined, fallback: string): string =>
    direction && direction !== '—' ? direction : fallback;
  const sector: SectorAnalysis = {
    sun: isSH === null ? 'Hemisphere unavailable — confirm the sun-facing side on site.' : `Strongest sun from the ${isSH ? 'north' : 'south'} (${isSH ? 'Southern' : 'Northern'} Hemisphere) — face beds and orchard that way.`,
    windSummer: cl?.windFromSummer && cl.windFromSummer !== '—' ? `Summer wind from the ${cl.windFromSummer}.` : windDescription(undefined, 'Note the prevailing summer wind.'),
    windWinter: cl?.windFromWinter && cl.windFromWinter !== '—' ? `Winter wind from the ${cl.windFromWinter} — plant a windbreak on this edge.` : windDescription(undefined, 'Note the cold winter wind direction.'),
    fire: 'Keep fuel load down on the dry-wind edge; a green firebreak helps.',
    wildlife: hasTreeBelt ? 'The tree belt is a wildlife corridor — keep a wild buffer.' : 'Leave a wild edge for beneficial wildlife.',
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
  // ── What the farmer actually designed (Design Studio) ──
  // For as long as the report was blind to the Studio, this section said "Master design pending"
  // to a farmer whose finished plan was one tab away. Studio facts lead; the approved geometry
  // layers still follow; the pending placeholder appears only when there is genuinely nothing.
  const studioFacts = studioSummaryHasContent(studio) ? studio : null;
  const studioFeatures: DesignFeature[] = studioFacts
    ? [
      ...studioFacts.elements.map((group) => ({
        key: `studio-${group.defId}-${group.name}`,
        name: group.count > 1 ? `${group.name} ×${group.count}` : group.name,
        layerIds: [],
        purpose: group.status === 'existing'
          ? 'Already on the farm — recorded in your Design Studio plan.'
          : group.status === 'mixed'
            ? 'Partly existing, partly planned — from your Design Studio plan.'
            : 'Planned — placed by you in the Design Studio.',
        construction: ['Positions and sizes are on the plan sheets.'],
        maintenance: [],
      })),
      ...studioFacts.routes.map((route) => ({
        key: `studio-route-${route.kind}`,
        name: route.count > 1 ? `${route.label} ×${route.count}` : route.label,
        layerIds: [],
        purpose: 'Traced route from your Design Studio plan.',
        dimensions: `${Math.round(route.totalLengthM)} m total${route.statedWidthM ? ` · stated width ${route.statedWidthM} m` : ''}`,
        construction: [],
        maintenance: [],
      })),
      ...studioFacts.groundAreas.map((area) => ({
        key: `studio-ground-${area.name}`,
        name: area.name,
        layerIds: [],
        purpose: 'Traced ground area from your Design Studio plan.',
        dimensions: `${area.areaM2.toLocaleString()} m² traced area`,
        construction: [],
        maintenance: [],
      })),
    ]
    : [];
  const approvedFeatures: DesignFeature[] = approved.map((layer) => ({
    key: layer.id,
    name: layer.name || layer.layerType,
    layerIds: [layer.id],
    purpose: `Use the approved ${layer.layerType.replace(/_/g, ' ')} footprint shown on the design map.`,
    dimensions: areaOf(layer) > 0 ? `${Math.round(areaOf(layer))} m² traced area` : undefined,
    construction: ['Confirm materials and construction detail before work starts.'],
    maintenance: ['Check this feature during the seasonal design review.'],
  }));
  const masterDesign: DesignFeature[] = studioFeatures.length || approvedFeatures.length
    ? [...studioFeatures, ...approvedFeatures]
    : [{
      key: 'design-pending',
      name: 'Master design pending',
      layerIds: [],
      purpose: 'Approve traced site features before finalising the master design.',
      construction: ['Confirm dimensions and construction detail on the design map.'],
      maintenance: ['Review after the first site walk.'],
    }];

  // Placed species lead the planting section, with the count the farmer can check against their
  // own sheets. 'user-reported' because a design is the farmer's statement of intent, restated —
  // not a measurement and not an estimate.
  const placedPlanting: PlantingTable[] = studioFacts && studioFacts.planted.length
    ? [{
      category: 'placed',
      rows: studioFacts.planted.map((group) => ({
        species: group.name,
        qty: {
          value: group.count,
          provenance: 'user-reported' as const,
          basis: 'counted from your saved Design Studio plan',
        },
        spacing: 'As placed on the plan sheets',
        season: group.status === 'existing' ? 'Already growing' : 'To plant',
        purpose: 'From your Design Studio plan.',
      })),
    }]
    : [];
  const planting: PlantingTable[] = [...placedPlanting, {
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

  // Sheet 09 and the report consume the same pure phase plan. There is no
  // report-only fallback schedule that can drift from what was drawn.
  const implementation: ImplementationPhase[] = phasePlan.phases.map((phase) => ({
    phase: phase.n,
    label: `Phase ${phase.n} — ${phase.title}`,
    monthRange: phase.weekRange,
    steps: phase.tasks.map((task, index) => ({
      seq: index + 1,
      task,
      layerIds: phase.itemIds,
      map: 'implementation' as MapRef,
      why: phase.holdPoint,
    })),
  }));

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
