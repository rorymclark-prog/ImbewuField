// Eggs, milk, meat and honey: what an animal enterprise gives, when, and what it needs — per
// ENTERPRISE, not per m².
//
// Rory's audit asked for "eggs, meat, dairy, honey" to sit beside the vegetables and the orchard.
// None of it fits the crop catalogue: a hen's eggs are per hen, not per square metre, and a coop
// does not give a bed back. So, like the orchard (lib/perennial-harvest.ts), this is its own table.
//
// THE RULES THIS TABLE IS HELD TO.
//
// 1. Every value carries the sentence it came from. The data file is generated from the research
//    dossiers in research/animal-sources/, whose quotes were checked against the fetched source
//    before any value was kept (tests/animal-enterprises.test.ts keeps the two in step). A value no
//    primary source states is null, and null is shown as "not sourced" — never a figure from a
//    feed-company page, a farming magazine or a guess.
//
// 2. A structure on the map is not a head count. A coop can hold six hens or sixty, and the map
//    does not say which, so nothing here multiplies a per-animal figure by anything. The app shows
//    "per hen" and "per hive" and leaves the herd size to the farmer.
//
// 3. A coop is not an enterprise. The same coop keeps layers, broilers or village chickens, and a
//    goat pen holds milk goats or meat goats; their products and months are nothing alike. The
//    farmer says which (a per-design view choice, below) — the app does not guess.
//
// 4. Nothing here reaches a per-m² figure (lib/produce-scope.ts: the Production score divides by
//    vegetable-bed area). tests/animal-enterprises.test.ts keeps this module out of the bed maths.

import { ANIMAL_ENTERPRISE_DATA } from './animal-enterprises-data';
import type { HarvestCitation, HarvestWindow, SourcedRange } from './perennial-harvest';
import { activeAccountLocalStorageKey } from './account-local-storage';
import { isSampleMode } from './sample-mode';
import type { PoultryManagement, SiteProductionConditions } from './site-survey';

export type AnimalKind = 'chicken' | 'goat' | 'bee' | 'rabbit' | 'duck' | 'cattle' | 'sheep' | 'pig' | 'fish';
export type AnimalProduct = 'eggs' | 'meat' | 'milk' | 'honey' | 'fish' | 'wool';

/** Wool is shorn, not eaten: it has months and a card, but never a place on a food chart. */
export function isFoodProduct(product: AnimalProduct): boolean {
  return product !== 'wool';
}

export interface SourcedPoint {
  /** Plain-English summary; the quote in `source` is what it rests on. */
  point: string;
  source: HarvestCitation;
}

export interface FlowRecord {
  region: string;
  /** The source's own timing words, e.g. "April–May". */
  when: string;
  plant: string | null;
  source: HarvestCitation;
}

export interface AnimalEnterprise {
  enterpriseId: string;
  name: string;
  animal: AnimalKind;
  /** What one "animal" is for the per-animal figures: hen, broiler, doe, hive. */
  animalUnit: string;
  product: AnimalProduct;
  /** Unit of outputPerAnimal, e.g. "eggs/hen/year". */
  outputUnit: string;
  outputPerAnimal: SourcedRange | null;
  /** Months the product is taken, with the source's region label. */
  windows: HarvestWindow[];
  seasonalPattern: { text: string; source: HarvestCitation } | null;
  /** Why the product has no months, when the dossier's sources say why (honey: rainfall). */
  flowNote: { text: string; source: HarvestCitation } | null;
  /** Single recorded flows, each one plant in one place. Listed with their source, never charted. */
  flowRecords: FlowRecord[];
  weeksToFirstProduct: SourcedRange | null;
  productiveLifeYears: SourcedRange | null;
  feedKgPerDay: SourcedRange | null;
  waterLPerDay: SourcedRange | null;
  spaceM2: SourcedRange | null;
  welfare: SourcedPoint[];
  legal: SourcedPoint[];
}

export const ANIMAL_ENTERPRISES: Readonly<Record<string, AnimalEnterprise>> = ANIMAL_ENTERPRISE_DATA;

/** Advice is separate from the enterprise's generated quantities: a named breed and a mapped
 * coop do not establish how many healthy, fed, laying birds a farmer has. */
export interface PoultryGuidanceSource {
  doc: string;
  url: string;
  page?: string;
}

export interface PoultryGuidancePoint {
  text: string;
  source: PoultryGuidanceSource;
}

export interface PoultryGuidanceOption {
  id: string;
  name: string;
  kind: 'breed' | 'management-system';
  detail: string;
  source: PoultryGuidanceSource;
}

export interface PoultryGuidance {
  purpose: 'eggs' | 'meat' | 'both' | 'unknown';
  selectedEnterprise: { id: string; name: string } | null;
  recordedBreed: string | null;
  recordedLayingHens: number | null;
  status: 'needs-confirmation' | 'care-needs-attention' | 'review-locally';
  statusText: string;
  missing: string[];
  attention: string[];
  careNotes: PoultryGuidancePoint[];
  climateNotes: PoultryGuidancePoint[];
  options: PoultryGuidanceOption[];
  localCheck: string;
  sources: PoultryGuidanceSource[];
}

const POULTRY_GUIDANCE_SOURCES = {
  arcManual: {
    doc: 'ARC: Climate-Smart Agriculture, Poultry Production',
    url: 'https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Pages/assets/modules/11.pdf',
    page: '468–471, 478–480',
  },
  arcBreeds: {
    doc: 'ARC: Conserved South African chicken breeds',
    url: 'https://www.arc.agric.za/arc-api/Pages/Rangelands%20and%20Nutrition/Germplasm-Conservation-and-Reproductive-Biotechnologies.aspx',
  },
  arcTrial: {
    doc: 'ARC: Indigenous chicken egg-production study',
    url: 'https://www.fao.org/4/i1353t/i1353t04.pdf',
    page: '27–32',
  },
  layerManual: {
    doc: 'SAPA: Commercial Layers',
    url: 'https://sapoultry.co.za/pdf-training/commercial-layers.pdf',
    page: '12–15',
  },
  villageFeed: {
    doc: 'South African village-chicken feeding study',
    url: 'https://www.scielo.org.za/pdf/sajas/v45n2/05.pdf',
  },
  localAdaptation: {
    doc: 'ARC researchers: Local chicken environmental suitability',
    url: 'https://www.frontiersin.org/journals/genetics/articles/10.3389/fgene.2024.1450939/full',
  },
} satisfies Record<string, PoultryGuidanceSource>;

/** This is a shortlist to discuss, not a province-to-breed lookup. The ARC egg trial used
 * managed feed, water, housing and lighting at Irene; its results cannot forecast a village flock. */
export function poultryGuidance(
  profile?: PoultryManagement,
  conditions?: SiteProductionConditions,
  selectedEnterpriseId?: string | null,
): PoultryGuidance {
  const purpose = profile?.purpose === 'eggs' || profile?.purpose === 'meat' || profile?.purpose === 'both'
    ? profile.purpose : 'unknown';
  const selected = selectedEnterpriseId ? ANIMAL_ENTERPRISES[selectedEnterpriseId] : undefined;
  const missing: string[] = [];
  const attention: string[] = [];
  if (purpose === 'unknown') missing.push('What are the chickens for: eggs, meat or both?');
  if (profile?.drinkingWater !== 'always' && profile?.drinkingWater !== 'sometimes') missing.push('Is clean drinking water always available?');
  if (!['balanced-feed', 'mixed-feed', 'mostly-scavenging'].includes(profile?.feeding ?? '')) missing.push('What feed is available?');
  if (!['enclosed', 'partial', 'none'].includes(profile?.nightProtection ?? '')) missing.push('Are the birds protected at night?');
  if (profile?.drinkingWater === 'sometimes') attention.push('Secure reliable clean drinking water before buying more birds.');
  if (profile?.feeding === 'mixed-feed' || profile?.feeding === 'mostly-scavenging') attention.push('Check feed suitability; scavenging and scraps may not meet laying hens’ needs.');
  if (profile?.nightProtection === 'partial' || profile?.nightProtection === 'none') attention.push('Improve night protection and weatherproof housing.');
  if (selected?.animal === 'chicken' && ((purpose === 'eggs' && selected.product === 'meat') || (purpose === 'meat' && selected.product === 'eggs'))) {
    attention.push('Your selected chicken enterprise and recorded purpose differ; review them together.');
  }

  const careNotes: PoultryGuidancePoint[] = [
    { text: 'Every breed needs clean drinking water, suitable feed and protected housing.', source: POULTRY_GUIDANCE_SOURCES.arcManual },
    { text: 'Foraging alone may not supply enough nutrients for eggs.', source: POULTRY_GUIDANCE_SOURCES.villageFeed },
  ];
  const climateNotes: PoultryGuidancePoint[] = [
    { text: 'In hot weather, provide shade, airflow and reliable water. This is general care advice; heat at this site has not been confirmed.', source: POULTRY_GUIDANCE_SOURCES.arcManual },
    { text: 'Local chicken adaptation varies within provinces. Location alone does not identify the best breed for this farm.', source: POULTRY_GUIDANCE_SOURCES.localAdaptation },
  ];
  if (conditions?.frost === 'yes') climateNotes.unshift({
    text: 'You reported frost. Check winter shelter and chick warmth with a local adviser.', source: POULTRY_GUIDANCE_SOURCES.arcManual,
  });
  else if (conditions?.frost !== 'no') missing.push('Does this site get frost?');
  if (conditions?.drainage === 'stays-wet') climateNotes.unshift({
    text: 'You reported wet ground. Check that chicken housing drains and bedding stays dry.', source: POULTRY_GUIDANCE_SOURCES.arcManual,
  });
  if (conditions?.drySeasonWater === 'limited' || conditions?.drySeasonWater === 'rain-only') climateNotes.unshift({
    text: 'Growing water is limited. Check drinking water separately; garden water does not confirm a safe poultry supply.', source: POULTRY_GUIDANCE_SOURCES.arcManual,
  });

  const options: PoultryGuidanceOption[] = [
    {
      id: 'potchefstroom-koekoek', name: 'Potchefstroom Koekoek', kind: 'breed',
      detail: 'An egg-and-meat option. It outperformed the other indigenous breeds for eggs in a managed ARC trial; those results do not predict this farm.',
      source: POULTRY_GUIDANCE_SOURCES.arcTrial,
    },
    { id: 'venda', name: 'Venda', kind: 'breed', detail: 'An ARC-conserved indigenous option for eggs and meat; check local stock and care needs.', source: POULTRY_GUIDANCE_SOURCES.arcTrial },
    { id: 'ovambo', name: 'Ovambo', kind: 'breed', detail: 'An ARC-conserved indigenous option for eggs and meat; check local stock and care needs.', source: POULTRY_GUIDANCE_SOURCES.arcTrial },
    { id: 'naked-neck', name: 'Naked Neck', kind: 'breed', detail: 'An indigenous option described across diverse South African climates; confirm suitability with local advice.', source: POULTRY_GUIDANCE_SOURCES.arcTrial },
  ];
  if (purpose !== 'meat') options.push({
    id: 'commercial-layers', name: 'Commercial layers — egg system', kind: 'management-system',
    detail: 'Consider only after checking reliable feed, drinking water, housing, health care and managed lighting. Breed and supplier still need local confirmation.',
    source: POULTRY_GUIDANCE_SOURCES.layerManual,
  });
  if (purpose !== 'eggs') options.push({
    id: 'commercial-broilers', name: 'Commercial broilers — meat system', kind: 'management-system',
    detail: 'Needs dependable balanced feed, water, suitable housing and management. Confirm chick supply and a meat outlet before choosing.',
    source: POULTRY_GUIDANCE_SOURCES.arcManual,
  });
  const status = attention.length ? 'care-needs-attention' : missing.length ? 'needs-confirmation' : 'review-locally';
  const recordedBreed = profile?.recordedBreed?.trim().slice(0, 120) || null;
  const hens = profile?.layingHens;
  return {
    purpose,
    selectedEnterprise: selected?.animal === 'chicken' ? { id: selected.enterpriseId, name: selected.name } : null,
    recordedBreed,
    recordedLayingHens: typeof hens === 'number' && Number.isInteger(hens) && hens >= 0 ? hens : null,
    status,
    statusText: status === 'care-needs-attention' ? 'Care needs attention before expansion'
      : status === 'needs-confirmation' ? 'Check the farm details before choosing'
        : 'Discuss these choices with a local adviser',
    missing,
    attention,
    careNotes,
    climateNotes,
    options,
    localCheck: 'These are options to discuss, not a final breed recommendation. Confirm healthy stock, supplier availability, ventilation, chick warmth and a health plan locally. Record actual production months separately; this guide promises no output or dates.',
    sources: [...new Map([...options.map((o) => o.source), ...careNotes.map((p) => p.source), ...climateNotes.map((p) => p.source), POULTRY_GUIDANCE_SOURCES.arcBreeds].map((s) => [s.url, s])).values()],
  };
}

export const ANIMAL_LABEL: Readonly<Record<AnimalKind, string>> = {
  chicken: 'Chickens',
  goat: 'Goats',
  bee: 'Bees',
  rabbit: 'Rabbits',
  duck: 'Ducks',
  cattle: 'Cattle',
  sheep: 'Sheep',
  pig: 'Pigs',
  fish: 'Fish',
};

export const PRODUCT_LABEL: Readonly<Record<AnimalProduct, string>> = {
  eggs: 'Eggs',
  meat: 'Meat',
  milk: 'Milk',
  honey: 'Honey',
  fish: 'Fish',
  wool: 'Wool',
};

/**
 * What a structure on the map can house. Most house one kind of animal; a kraal holds cattle,
 * sheep or goats, and a small pond may or may not have fish in it. Either way the farmer says
 * what it is for (rule 3) — a kraal is never assumed to be cattle, nor a pond to hold fish.
 */
export type HousingKind = 'chicken' | 'goat' | 'bee' | 'rabbit' | 'duck' | 'pig' | 'kraal' | 'pond';

export const HOUSING_ANIMALS: Readonly<Record<HousingKind, readonly AnimalKind[]>> = {
  chicken: ['chicken'],
  goat: ['goat'],
  bee: ['bee'],
  rabbit: ['rabbit'],
  duck: ['duck'],
  pig: ['pig'],
  kraal: ['cattle', 'sheep', 'goat'],
  pond: ['fish'],
};

export const HOUSING_LABEL: Readonly<Record<HousingKind, string>> = {
  chicken: 'Chickens',
  goat: 'Goats',
  bee: 'Bees',
  rabbit: 'Rabbits',
  duck: 'Ducks',
  pig: 'Pigs',
  kraal: 'Kraal',
  pond: 'Pond',
};

/**
 * Design elements that house animals. Only elements whose name says what can live there are
 * listed; the livestock trough waters whatever drinks from it, so it is not.
 */
export const ELEMENT_HOUSING: Readonly<Record<string, HousingKind>> = {
  chicken_coop: 'chicken',
  chicken_tractor: 'chicken',
  goat_pen: 'goat',
  beehive: 'bee',
  rabbit_hutch: 'rabbit',
  duck_pond: 'duck',
  pig_pen: 'pig',
  kraal: 'kraal',
  pond_small: 'pond',
};

/** The enterprises one kind of animal can be kept for, in table order. */
export function enterprisesFor(animal: AnimalKind): AnimalEnterprise[] {
  return Object.values(ANIMAL_ENTERPRISES).filter((e) => e.animal === animal);
}

/** The enterprises a structure can be used for: every enterprise of every animal it can hold. */
export function enterprisesForHousing(housing: HousingKind): AnimalEnterprise[] {
  const animals = HOUSING_ANIMALS[housing];
  return Object.values(ANIMAL_ENTERPRISES).filter((e) => animals.includes(e.animal));
}

export interface PlacedAnimalItem {
  defId: string;
  status?: 'existing' | 'proposed';
}

export interface PlacedAnimalGroup {
  housing: HousingKind;
  /** Structures (coops, hives, pens) on the map — NOT animals. */
  existing: number;
  proposed: number;
}

/**
 * The design's animal structures, grouped by what they house.
 *
 * Kinds with no enterprise in the table are dropped: a hutch with nothing to say about rabbits
 * would be a row of blanks. Legacy items with no status count as existing, as they do for trees.
 */
export function placedAnimalGroups(items: readonly PlacedAnimalItem[]): PlacedAnimalGroup[] {
  const byKind = new Map<HousingKind, PlacedAnimalGroup>();
  for (const item of items) {
    const housing = ELEMENT_HOUSING[item.defId];
    if (!housing || enterprisesForHousing(housing).length === 0) continue;
    const group = byKind.get(housing) ?? { housing, existing: 0, proposed: 0 };
    if (item.status === 'proposed') group.proposed++; else group.existing++;
    byKind.set(housing, group);
  }
  const order = Object.keys(HOUSING_LABEL) as HousingKind[];
  return [...byKind.values()].sort((a, b) => order.indexOf(a.housing) - order.indexOf(b.housing));
}

/** Whether an enterprise can be kept in a kind of structure. */
function fits(housing: HousingKind, e: AnimalEnterprise): boolean {
  return HOUSING_ANIMALS[housing].includes(e.animal);
}

/**
 * A per-animal range as a farmer reads it.
 *
 * The orchard's formatRange keeps one decimal, which is right for kilograms off a tree and wrong
 * here: a hen eats 0.11 kg a day and needs 0.083 m², and one decimal turns both into "0.1".
 * Below 1, two significant figures; from 1 up, one decimal as the orchard does.
 */
export function formatAmountRange([min, max]: [number, number]): string {
  const f = (n: number) => {
    if (Number.isInteger(n)) return String(n);
    if (Math.abs(n) < 1) return String(Number(n.toPrecision(2)));
    return n.toFixed(1).replace(/\.0$/, '');
  };
  return min === max ? f(min) : `${f(min)}–${f(max)}`;
}


export type AnimalRangeField = 'outputPerAnimal' | 'weeksToFirstProduct' | 'productiveLifeYears' | 'feedKgPerDay' | 'waterLPerDay' | 'spaceM2';

/** Source notes distinguish a trial result from a ration or space instruction. Keep the
 * most consequential conditions beside the number; the full dossier note remains available. */
export function animalReferenceQualifier(e: AnimalEnterprise, field: AnimalRangeField): string | undefined {
  if (!e[field]) return undefined;
  const context: Partial<Record<AnimalRangeField, Partial<Record<string, string>>>> = {
    outputPerAnimal: {
      bees: 'National survey reference from 2008; not a forecast for this hive.',
      'cattle-beef': 'Live calf weaning weight from communal Nguni herds in Limpopo; not meat weight.',
      'cattle-dairy': 'Milk-recorded Jersey and Holstein herds, per lactation; not an annual total.',
      'chicken-broiler': 'Commercial industry reference at slaughter; not a household flock forecast.',
      'chicken-indigenous': 'Village-chicken reference from dry and wet KZN environments.',
      'chicken-layer': 'Commercial laying-cycle reference; not eggs per year.',
      duck: 'Non-South African study reference; live weight, not meat weight.',
      'fish-tilapia': 'Harvest weight per Mozambique tilapia; not yield per pond.',
      'goat-dairy': 'Milk-recorded Saanen herds, per lactation; not an annual total.',
      'goat-meat': 'Extensive Boer-goat reference for kids weaned; not meat weight.',
      rabbit: 'FAO backyard-system reference; not a South African farm forecast.',
      'sheep-mutton': 'Farmer-reported lambs born; not lambs weaned or meat weight.',
      'sheep-wool': 'Semi-arid Merino reference; pasture and management affect the clip.',
    },
    weeksToFirstProduct: {
      'chicken-layer': 'Bird age from hatch; not time after buying point-of-lay birds.',
      'cattle-dairy': 'Age at first calving; not time after buying a cow.',
      'goat-indigenous': 'Age at first kidding; not age of the first weaned kids.',
      'fish-tilapia': 'Mozambique tilapia grow-out reference; confirm starting stock and water conditions.',
    },
    productiveLifeYears: {
      'cattle-beef': 'From first calving to culling in the study; not lifespan from birth.',
      'cattle-dairy': 'From first calving to culling in recorded herds; not lifespan from birth.',
      rabbit: 'French intensive commercial reference; not a backyard-doe lifespan.',
    },
    feedKgPerDay: {
      'cattle-dairy': 'Dry-matter intake for lactating cows; not the weight of fresh feed.',
      'chicken-layer': 'Commercial-system reference; confirm a suitable ration locally.',
    },
    waterLPerDay: {
      'cattle-dairy': 'Lactating Holstein-type cow reference; heat and animal stage affect demand.',
      'chicken-layer': 'Commercial reference under normal conditions; water must stay available.',
      'pig-pork': 'Pregnant and lactating sow reference; not a rate for growing pigs.',
    },
    spaceM2: {
      'chicken-layer': 'Indoor house space with suitable perches; not outdoor ranging space.',
      duck: 'Outdoor free-range space in the study; not indoor housing space.',
      rabbit: 'Hutch cage for one breeding adult; not floor space for a group.',
    },
  };
  return context[field]?.[e.enterpriseId];
}

/** Every month any sourced window of an enterprise covers, ascending. */
export function sourcedProductMonths(e: AnimalEnterprise): number[] {
  const months = new Set<number>();
  for (const w of e.windows) for (const m of w.months) months.add(m);
  return [...months].sort((a, b) => a - b);
}

export interface AnimalAvailabilityItem {
  enterpriseId: string;
  animal: AnimalKind;
  product: AnimalProduct;
  /** Structures counted for this chart. */
  structures: number;
}

/** Locally confirmed product months, tied to the enterprise so changing purpose clears dates. */
export type AnimalSeasonChoices = Partial<Record<HousingKind, { enterpriseId: string; months: number[] }>>;

export function confirmedAnimalMonths(housing: HousingKind, enterpriseId: string, choices: AnimalSeasonChoices): number[] {
  const choice = choices[housing];
  return choice?.enterpriseId === enterpriseId ? validAnimalMonths(choice.months) : [];
}

function validAnimalMonths(raw: unknown): number[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b) : [];
}

export function cleanAnimalSeasonChoices(raw: unknown): AnimalSeasonChoices {
  const out: AnimalSeasonChoices = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [housing, value] of Object.entries(raw)) {
    if (!Object.hasOwn(HOUSING_ANIMALS, housing) || !value || typeof value !== 'object') continue;
    const choice = value as { enterpriseId?: unknown; months?: unknown };
    const enterprise = typeof choice.enterpriseId === 'string' ? ANIMAL_ENTERPRISES[choice.enterpriseId] : undefined;
    if (enterprise && fits(housing as HousingKind, enterprise)) out[housing as HousingKind] = { enterpriseId: enterprise.enterpriseId, months: validAnimalMonths(choice.months) };
  }
  return out;
}

/**
 * Which chosen enterprises give FOOD in each chart slot, by locally confirmed months.
 *
 * Only structures the farmer has said what they keep them for are shown (rule 3). Wool has
 * months but is not food, so a wool flock stays on its card and off the chart. Source references
 * do not establish this farm's production: commercial layers, for example, require managed
 * conditions that a coop on the map does not prove. `onlyStanding` is
 * the "from today" chart's rule, as for trees: a coop drawn as proposed has no hens in it yet.
 */
export function buildAnimalAvailability(
  groups: readonly PlacedAnimalGroup[],
  choices: Readonly<Partial<Record<HousingKind, string>>>,
  months: readonly number[],
  onlyStanding: boolean,
  seasons: AnimalSeasonChoices = {},
): AnimalAvailabilityItem[][] {
  const rows = groups
    .map((g) => {
      const e = choices[g.housing] ? ANIMAL_ENTERPRISES[choices[g.housing]!] : undefined;
      return { g, e, structures: onlyStanding ? g.existing : g.existing + g.proposed };
    })
    .filter((r): r is { g: PlacedAnimalGroup; e: AnimalEnterprise; structures: number } =>
      !!r.e && fits(r.g.housing, r.e) && isFoodProduct(r.e.product) && r.structures > 0)
    .map((r) => ({ ...r, season: new Set(confirmedAnimalMonths(r.g.housing, r.e.enterpriseId, seasons)) }))
    .filter((r) => r.season.size > 0);
  return months.map((m) => rows
    .filter((r) => r.season.has(m))
    .map((r) => ({ enterpriseId: r.e.enterpriseId, animal: r.e.animal, product: r.e.product, structures: r.structures })));
}

// ── The two view choices ────────────────────────────────────────────────────
//
// Both are view controls in the lib/produce-scope.ts sense: they never change the saved map. The
// enterprise choice is per design (one farm's coop is layers, another's broilers); the animals
// switch is one preference, like the orchard's.

const INCLUDE_ANIMALS_KEY = 'imbewu_crops_include_animals_v1';
const ENTERPRISE_CHOICE_KEY = 'imbewu_animal_enterprise_choice_v1';
const ANIMAL_SEASON_KEY = 'imbewu_animal_seasons_v1';

export const DEFAULT_INCLUDE_ANIMALS = true;

let sandboxIncludeAnimals = DEFAULT_INCLUDE_ANIMALS;
let sandboxChoices: Record<string, Partial<Record<HousingKind, string>>> = {};
let sampleAnimalSeasons: Record<string, AnimalSeasonChoices> = {};

export function loadAnimalSeasonChoices(siteId: string): AnimalSeasonChoices {
  if (isSampleMode()) return cleanAnimalSeasonChoices(sampleAnimalSeasons[siteId]);
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(ANIMAL_SEASON_KEY));
    return cleanAnimalSeasonChoices(raw ? JSON.parse(raw)?.[siteId] : undefined);
  } catch { return {}; }
}

export function saveAnimalSeasonChoices(siteId: string, seasons: AnimalSeasonChoices): boolean {
  const clean = cleanAnimalSeasonChoices(seasons);
  if (isSampleMode()) { sampleAnimalSeasons = { ...sampleAnimalSeasons, [siteId]: clean }; return true; }
  if (typeof window === 'undefined') return false;
  try {
    const key = activeAccountLocalStorageKey(ANIMAL_SEASON_KEY);
    const raw = window.localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(key, JSON.stringify({ ...(all && typeof all === 'object' ? all : {}), [siteId]: clean }));
    return true;
  } catch { return false; }
}

export function loadIncludeAnimals(): boolean {
  if (isSampleMode()) return sandboxIncludeAnimals;
  if (typeof window === 'undefined') return DEFAULT_INCLUDE_ANIMALS;
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(INCLUDE_ANIMALS_KEY));
    return raw === null ? DEFAULT_INCLUDE_ANIMALS : raw === '1';
  } catch {
    return DEFAULT_INCLUDE_ANIMALS;
  }
}

export function saveIncludeAnimals(include: boolean): void {
  if (isSampleMode()) { sandboxIncludeAnimals = include; return; }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(INCLUDE_ANIMALS_KEY), include ? '1' : '0');
  } catch {
    // Storage unavailable — fail silently, as produce-scope does.
  }
}

/** Drop anything that is not a live enterprise the structure it is filed under can hold. */
export function cleanChoices(raw: unknown): Partial<Record<HousingKind, string>> {
  const out: Partial<Record<HousingKind, string>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [housing, id] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== 'string' || !Object.hasOwn(HOUSING_ANIMALS, housing)) continue;
    const e = ANIMAL_ENTERPRISES[id];
    if (e && fits(housing as HousingKind, e)) out[housing as HousingKind] = id;
  }
  return out;
}

export function loadEnterpriseChoices(siteId: string): Partial<Record<HousingKind, string>> {
  if (isSampleMode()) return { ...(sandboxChoices[siteId] ?? {}) };
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(ENTERPRISE_CHOICE_KEY));
    const all = raw ? JSON.parse(raw) : {};
    return cleanChoices(all?.[siteId]);
  } catch {
    return {};
  }
}

export function saveEnterpriseChoices(siteId: string, choices: Partial<Record<HousingKind, string>>): boolean {
  const clean = cleanChoices(choices);
  if (isSampleMode()) { sandboxChoices = { ...sandboxChoices, [siteId]: clean }; return true; }
  if (typeof window === 'undefined') return false;
  try {
    const key = activeAccountLocalStorageKey(ENTERPRISE_CHOICE_KEY);
    const raw = window.localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(key, JSON.stringify({ ...(all && typeof all === 'object' ? all : {}), [siteId]: clean }));
    return true;
  } catch { return false; }
}

/** Test seam: the sample-mode sandbox is module state, reset by a full page load. */
export function resetSampleAnimalChoices(): void {
  sandboxIncludeAnimals = DEFAULT_INCLUDE_ANIMALS;
  sandboxChoices = {};
  sampleAnimalSeasons = {};
}
