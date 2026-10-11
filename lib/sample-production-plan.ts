// A separate read-only example must never enter the sample-mode storage shim or a farmer's
// saved design. Use the real calculation authorities; only layout and example records are made up.
import { cropByKey, type RainPattern } from './crop-catalog';
import {
  buildFieldUtilizationByMonth, buildFoodAvailability, buildYearReport, nextValidSowMonth,
  tasksForPlan, totalGrowingAreaM2, type PlanBed, type Planting,
} from './crop-plan';
import {
  buildAnimalAvailability, placedAnimalGroups, poultryGuidance,
  type AnimalSeasonChoices, type HousingKind, type PlacedAnimalGroup,
} from './animal-enterprises';
import {
  bananaCirclesIn, buildTreeAvailability, formatMonthSpan, placedTreeGroups,
  type PlacedPlant, type PlacedTreeGroup, type TreeSeasonChoices,
} from './perennial-harvest';
import { printableAvailability, type PreservedFoodRecord } from './crop-export-availability';
import { buildProductionGuide } from './crop-export-schedule';
import type { CropPlanPdfInput } from './crop-export-pdf';
import { planningTreeSeasons, type PlanningTreeSeason } from './production-product-guidance';
import { buildProductionProjection } from './production-projection';
import type { GrowingZoneId } from './growing-zones';
import type { SiteProductionConditions, SiteSurvey } from './site-survey';
import pigeonPeaResearch from '../research/crop-sources/pigeon-pea.json' with { type: 'json' };

export interface SampleFarmZone {
  id: 'vegetables' | 'staples' | 'food-forest' | 'animals';
  title: string;
  description: string;
  bedIds: string[];
  speciesIds: string[];
  housing: HousingKind[];
}

export interface FictionalProductionRecord {
  iconKey: string;
  label: string;
  months: number[];
  provenance: 'fictional-example';
  explanation: string;
}

export interface CompleteProductionExample {
  input: CropPlanPdfInput;
  now: Date;
  months: number[];
  dates: { year: number; month: number }[];
  trees: PlacedTreeGroup[];
  treeSeasons: TreeSeasonChoices;
  planningTrees: PlanningTreeSeason[];
  animals: PlacedAnimalGroup[];
  animalChoices: Partial<Record<HousingKind, string>>;
  animalSeasons: AnimalSeasonChoices;
  zones: GrowingZoneId[];
  conditions: SiteProductionConditions;
  farmZones: SampleFarmZone[];
  fictionalRecords: FictionalProductionRecord[];
  preservedProducts: PreservedFoodRecord[];
  fictionNotice: string;
}

const VEGETABLE_KEYS = ['swiss-chard', 'cabbage', 'carrots', 'onions', 'tomatoes', 'green-beans'];
const STAPLE_KEYS = ['maize', 'dry-beans', 'groundnuts', 'sweet-potato', 'amadumbe', 'pumpkin', 'butternut'];
const FOOD_FOREST_IDS = [
  'persea-americana', 'musa-acuminata-aaa-group', 'carica-papaya', 'mangifera-indica',
  'litchi-chinensis', 'citrus-limon', 'macadamia-integrifolia', 'fragaria-x-ananassa',
  'syzygium-cordatum', 'moringa-oleifera', 'cajanus-cajan',
];
const BANANA_ID = 'musa-acuminata-aaa-group';
const FICTION_NOTICE = 'Fictional example, not a real farm or Ubhejane. Areas, plant ages and care records are made up. Banana, egg, milk, honey, fish, rabbit and duck production months are invented example records, not South African harvest recommendations. Preserved-stock months are also invented; no safe shelf life or processing recipe is supplied. Default tree, animal and stock amounts are not supplied. No quantities are inferred from plant ages, structures or stock months. Any figures entered here are fictional example records. Dried mango and stored nuts are made-up bought or carried stock, not claimed harvests from these trees. Uses the catalogue frost-free coastal / all-year sowing column; no live climate data is fetched. Other fruit dates are researched reference windows.';

/** Fixed November 2026–October 2027 baseline, with no browser, account or storage access. */
export function buildCompleteProductionExample(): CompleteProductionExample {
  const now = new Date(2026, 10, 1);
  const months = Array.from({ length: 12 }, (_, i) => (now.getMonth() + i) % 12 + 1);
  const dates = months.map((month, i) => ({ year: now.getFullYear() + Math.floor((now.getMonth() + i) / 12), month }));
  // This is an explicitly assumed warm coastal scenario, not fetched climate normals or an
  // identification of a real private site. Sow timing keeps the catalogue's own coastal column.
  const zones: GrowingZoneId[] = ['subtropical-coast'];
  const rainPattern: RainPattern = 'all-year';
  const conditions: SiteProductionConditions = {
    frost: 'no', drySeasonWater: 'reliable', drainage: 'drains-well', sunlight: 'full-sun',
  };
  const beds: PlanBed[] = [...VEGETABLE_KEYS, ...STAPLE_KEYS].map((key) => {
    const crop = cropByKey(key);
    if (!crop) throw new Error(`Example crop is missing from the catalogue: ${key}`);
    const plot = STAPLE_KEYS.includes(key);
    return { id: `example-${key}`, label: crop.name, kind: plot ? 'plot' : 'bed', areaM2: plot ? 100 : 20, minDimM: plot ? 10 : 2 };
  });
  // Each recurring crop owns separate ground. The next valid sowing comes from the catalogue,
  // so the example cannot manufacture a November sowing for a crop whose window starts later.
  const plantings: Planting[] = [...VEGETABLE_KEYS, ...STAPLE_KEYS].map((key) => ({
    id: `example-sowing-${key}`, bedId: `example-${key}`, cropKey: key,
    sowMonth: nextValidSowMonth(cropByKey(key)!, rainPattern, months[0]),
  }));
  const tasks = tasksForPlan(plantings, beds, months[0]);

  const plantItems: PlacedPlant[] = FOOD_FOREST_IDS.flatMap((speciesId) => {
    if (speciesId === BANANA_ID) return [
      { defId: 'banana_circle', status: 'existing' }, { defId: 'banana_circle', status: 'proposed' },
    ];
    const count = speciesId === 'fragaria-x-ananassa' ? 12 : 2;
    return [
      ...Array.from({ length: count }, () => ({ defId: 'tree_other', speciesId, status: 'existing' as const })),
      { defId: 'tree_other', speciesId, status: 'proposed' },
    ];
  });
  const trees = placedTreeGroups(plantItems);
  const treeSeasons: TreeSeasonChoices = {};
  for (const group of trees) {
    const id = group.harvest.speciesId;
    const planted = id === 'carica-papaya' || id === BANANA_ID ? '2024-11'
      : id === 'fragaria-x-ananassa' ? '2026-05' : id === 'cajanus-cajan' ? '2026-01' : '2016-11';
    treeSeasons[id] = {
      months: [], bearing: false,
      production: [
        { status: 'existing', plants: group.existing, planted, yields: [] },
        { status: 'proposed', plants: group.proposed, planted: '2026-11', yields: [] },
      ],
    };
  }
  const fictionalRecords: FictionalProductionRecord[] = [
    { iconKey: `tree:${BANANA_ID}`, label: 'Banana', months: [2, 6, 10], provenance: 'fictional-example', explanation: 'Invented local picking record for the existing three-plant circle. No fixed regional banana picking months are sourced.' },
    { iconKey: 'animal:chicken-layer', label: 'Eggs', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], provenance: 'fictional-example', explanation: 'Invented egg-production record with assumed balanced feed, drinking water and night protection. Neither a coop nor a breed guarantees these months.' },
    { iconKey: 'animal:goat-dairy', label: 'Milk', months: [11, 12, 1, 2, 3, 4], provenance: 'fictional-example', explanation: 'Invented local milking record. Real milking months need the animals, kidding and lactation records; a goat pen establishes no milk supply.' },
    { iconKey: 'animal:bees', label: 'Honey', months: [11, 2], provenance: 'fictional-example', explanation: 'Invented local honey-harvest record. Confirm real nectar flow and colony stores; flowering and rainfall alone establish no harvest.' },
    { iconKey: 'animal:fish-tilapia', label: 'Fish', months: [3, 6], provenance: 'fictional-example', explanation: 'Invented pond harvest record, not year-round harvest dates or a stocking recommendation. Real output needs stocking, water-quality and harvest records.' },
    { iconKey: 'animal:rabbit', label: 'Rabbit meat', months: [5, 8], provenance: 'fictional-example', explanation: 'Invented rabbit meat-harvest record. The FAO backyard reference supplies no South African production months. Hutch counts do not establish breeding stock, kits or meat kilograms; confirm local heat protection and care.' },
    { iconKey: 'animal:duck', label: 'Duck meat', months: [4, 9], provenance: 'fictional-example', explanation: 'Invented duck meat-harvest record. Source grow-out ages and live weights are not calendar dates or dressed meat quantities. Confirm actual birds, feeding, water, biosecurity and local harvest records.' },
  ];
  treeSeasons[BANANA_ID]!.months = [...fictionalRecords[0].months];
  treeSeasons[BANANA_ID]!.bearing = true;

  // These are labelled stock observations for a made-up example. Neither the processing
  // method nor the interval is a preservation instruction or an automatically derived expiry.
  const preservedProducts: PreservedFoodRecord[] = [
    { id: 'example-frozen-green-beans', label: 'Frozen green beans', sourceIconKey: 'crop:green-beans', method: 'frozen', dates: [1, 2, 3].map(month => ({ year: 2027, month })), provenance: 'fictional-example', note: 'Invented stock months from January to March 2027, not a safe shelf life. Freezer conditions, a safe processing method and the amount held are not supplied.' },
    { id: 'example-dried-banana', label: 'Dried banana', sourceIconKey: `tree:${BANANA_ID}`, method: 'dried', dates: [6, 7, 8].map(month => ({ year: 2027, month })), provenance: 'fictional-example', note: 'Invented stock months from June to August 2027, not a safe shelf life. The example banana picking record is also invented; a safe drying method and the amount held are not supplied.' },
    { id: 'example-fermented-cabbage', label: 'Fermented cabbage', sourceIconKey: 'crop:cabbage', method: 'fermented', dates: [8, 9, 10].map(month => ({ year: 2027, month })), provenance: 'fictional-example', note: 'Invented stock months from August to October 2027, not a safe shelf life. Fermentation controls, a tested processing recipe and the amount held are not supplied.' },
    { id: 'example-processed-tomatoes', label: 'Processed tomatoes', sourceIconKey: 'crop:tomatoes', method: 'processed', dates: [5, 6, 7, 8].map(month => ({ year: 2027, month })), provenance: 'fictional-example', note: 'Invented stock months from May to August 2027, not a safe shelf life. The processing method, a tested preservation recipe and the amount held are not supplied.' },
    { id: 'example-dried-mango', label: 'Dried mango', sourceIconKey: 'tree:mangifera-indica', method: 'dried', dates: [3, 4, 5].map(month => ({ year: 2027, month })), provenance: 'fictional-example', note: 'Invented stock months from March to May 2027, not a safe shelf life. Made-up bought or carried stock; no harvest from this example mango tree is claimed. A safe drying method and the amount held are not supplied.' },
    { id: 'example-stored-macadamia', label: 'Stored macadamia nuts', sourceIconKey: 'tree:macadamia-integrifolia', method: 'stored', dates: [8, 9, 10].map(month => ({ year: 2027, month })), provenance: 'fictional-example', note: 'Invented stock months from August to October 2027, not a safe shelf life. Made-up bought or carried nuts in shell; no harvest from these example trees is claimed. Storage conditions, kernel weight and the amount held are not supplied.' },
  ];

  const animals = placedAnimalGroups([
    { defId: 'chicken_coop', status: 'existing' }, { defId: 'goat_pen', status: 'existing' },
    { defId: 'beehive', status: 'existing' }, { defId: 'pond_small', status: 'existing' },
    { defId: 'rabbit_hutch', status: 'existing' }, { defId: 'duck_pond', status: 'existing' },
  ]);
  const animalChoices: Partial<Record<HousingKind, string>> = {
    chicken: 'chicken-layer', goat: 'goat-dairy', bee: 'bees', pond: 'fish-tilapia',
    rabbit: 'rabbit', duck: 'duck',
  };
  const animalSeasons: AnimalSeasonChoices = {};
  for (const group of animals) {
    const enterpriseId = animalChoices[group.housing]!;
    const record = fictionalRecords.find(row => row.iconKey === `animal:${enterpriseId}`)!;
    animalSeasons[group.housing] = { enterpriseId, months: [...record.months] };
  }

  const survey: SiteSurvey = {
    siteId: 'fictional-production-example', placeId: 'fictional-production-example', savedAt: '2026-11-01',
    siteType: 'homestead', adults: '', goals: ['food'], waterSource: [], waterDelivery: [], waterStorage: [],
    roofMainM2: null, roofSecondaryM2: null, hasGutters: false, landPrepMethod: 'hand',
    soilCondition: 'unknown', soilAmendments: [], hasFencing: '', existingCrops: [],
    existingGrowingAreaM2: null, livestock: [], otherInfra: [], farmingPractice: '', challenges: [],
    isCommercial: false, productionConditions: conditions,
    poultryManagement: { purpose: 'eggs', layingHens: null, drinkingWater: 'always', feeding: 'balanced-feed', nightProtection: 'enclosed' },
    notes: FICTION_NOTICE,
  };
  const planningTrees = planningTreeSeasons(trees, zones, conditions, treeSeasons);
  const availability = printableAvailability({
    now, yearMode: 'fromToday',
    planning: { months, dates, trees: planningTrees },
    veg: buildFoodAvailability(plantings, beds, months[0], 12),
    utilization: buildFieldUtilizationByMonth(plantings, beds, months[0], 12),
    trees: buildTreeAvailability(trees, months, true, treeSeasons),
    animals: buildAnimalAvailability(animals, animalChoices, months, true, animalSeasons),
    treeGroups: trees, treeSeasons, animalGroups: animals, animalChoices, animalSeasons,
  });
  const productionGuide = buildProductionGuide(survey, plantings, zones, months[0], {
    trees, animals, animalChoices, bananaCircles: bananaCirclesIn(plantItems),
  });
  productionGuide.siteObservations.unshift({ title: 'Fictional example records', lines: [FICTION_NOTICE] });
  // Grain trials and pod-development references remain visible without turning
  // their source conditions into this example farm's timed harvest.
  const pigeonPea = trees.find(group => group.harvest.speciesId === 'cajanus-cajan')!;
  const pigeonGuide = productionGuide.foodForest!.find(item => item.title === pigeonPea.harvest.name)!;
  const pigeonSowing = pigeonPeaResearch.sowMonths['all-year'];
  const pigeonSource = pigeonSowing.evidence[0];
  const pigeonSowingSource = { label: `${pigeonSource.doc}, p. ${pigeonSource.page}`, url: pigeonSource.url };
  // The sample adds its sowing explanation without discarding the shared grain-trial evidence.
  if (!pigeonGuide.sources?.some(source => source.url === pigeonSowingSource.url && source.label === pigeonSowingSource.label)) {
    pigeonGuide.sources = [...(pigeonGuide.sources ?? []), pigeonSowingSource];
  }
  productionGuide.siteObservations.push({
    title: `${pigeonPea.harvest.name}: mapped food source`,
    lines: [
      `Reference only: the DAFF/ARC Lowveld brochure gives ${formatMonthSpan(pigeonSowing.months)} sowing. This is not a confirmed local sowing or picking record for this KZN example.`,
      'Locally confirmed picking duration, complete plant spacing and food kilograms are not supplied for this example. This mapped source has no timed annual crop row or counted sowing recommendation; record local dates and amounts yourself.',
    ],
    sources: [pigeonSowingSource],
  });
  const moringa = trees.find(group => group.harvest.speciesId === 'moringa-oleifera')!;
  const moringaGuide = productionGuide.foodForest!.find(item => item.title === moringa.harvest.name)!;
  moringaGuide.lines.push('The first-crop age above is for leaves, not pods. Local leaf-picking months are not sourced. The pod reference describes North West provincial production, not an established picking calendar for this KZN example.');
  const productionProjection = buildProductionProjection({ plantings, beds, trees, choices: treeSeasons, now });
  productionProjection.assumptions.unshift(FICTION_NOTICE);
  const input: CropPlanPdfInput = {
    plantings, beds, tasks, now,
    meta: {
      planTitle: 'Fictional KZN example',
      siteLine: 'Fictional warm KZN farm · Banana and animal months invented',
      locationLine: 'Fictional KZN farm',
      climateLine: 'Assumed warm coast; uses catalogue frost-free coastal / all-year sowing column',
      documentNotice: 'FICTIONAL EXAMPLE - banana, animal and preserved-stock months are made-up records',
      rainPattern, bedsSummary: `6 vegetable beds · 7 staple plots · ${totalGrowingAreaM2(beds)} m² of fictional growing space`,
      dateLabel: '1 November 2026', estimatedKgPerYear: null, lossPercent: 0, lossAllowanceConfirmed: false,
    },
    sections: ['calendar', 'availability', 'availabilityGraphs', 'projection', 'guidance', 'buying', 'fieldsheets', 'record'],
    availability, availabilityDetails: true, treeGroups: trees, treeSeasons, productionGuide, productionProjection,
    preservedProducts,
    poultryGuidance: poultryGuidance(survey.poultryManagement, conditions, animalChoices.chicken),
    yearReport: [FICTION_NOTICE, ...buildYearReport(plantings, beds, { includeCalendarNarrative: false })],
    planNotes: [{ kind: 'basis', text: FICTION_NOTICE }], planNotesAt: now.getTime(),
  };
  const farmZones: SampleFarmZone[] = [
    { id: 'vegetables', title: 'Vegetable beds', description: 'Six separate example beds. Each crop keeps its own growing space and sourced sowing window.', bedIds: beds.filter(b => b.kind === 'bed').map(b => b.id), speciesIds: [], housing: [] },
    { id: 'staples', title: 'Staple plots', description: 'Seven separate example plots, including groundnuts (peanuts). Fresh picking and stored food follow the catalogue rules.', bedIds: beds.filter(b => b.kind === 'plot').map(b => b.id), speciesIds: [], housing: [] },
    { id: 'food-forest', title: 'Fruit, nuts, berries and other food plants', description: 'Existing and proposed plant cohorts, including indigenous waterberry in an assumed moist position, moringa and pigeon pea. Moringa leaf and pod dates and pigeon pea picking dates need local records. Plant ages and counts are fictional; no kg curve is supplied.', bedIds: [], speciesIds: trees.map(g => g.harvest.speciesId), housing: [] },
    { id: 'animals', title: 'Eggs, milk, honey, fish and meat', description: 'Existing example housing with chosen products, including rabbit and duck meat. Structure counts do not show stock numbers. Production months are invented local records; output quantities stay unknown.', bedIds: [], speciesIds: [], housing: animals.map(g => g.housing) },
  ];
  return { input, now, months, dates, trees, treeSeasons, planningTrees, animals, animalChoices, animalSeasons, zones, conditions, farmZones, fictionalRecords, preservedProducts, fictionNotice: FICTION_NOTICE };
}
