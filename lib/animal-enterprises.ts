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

export type AnimalKind = 'chicken' | 'goat' | 'bee' | 'rabbit' | 'duck';
export type AnimalProduct = 'eggs' | 'meat' | 'milk' | 'honey';

export interface SourcedPoint {
  /** Plain-English summary; the quote in `source` is what it rests on. */
  point: string;
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
  weeksToFirstProduct: SourcedRange | null;
  productiveLifeYears: SourcedRange | null;
  feedKgPerDay: SourcedRange | null;
  waterLPerDay: SourcedRange | null;
  spaceM2: SourcedRange | null;
  welfare: SourcedPoint[];
  legal: SourcedPoint[];
}

export const ANIMAL_ENTERPRISES: Readonly<Record<string, AnimalEnterprise>> = ANIMAL_ENTERPRISE_DATA;

export const ANIMAL_LABEL: Readonly<Record<AnimalKind, string>> = {
  chicken: 'Chickens',
  goat: 'Goats',
  bee: 'Bees',
  rabbit: 'Rabbits',
  duck: 'Ducks',
};

export const PRODUCT_LABEL: Readonly<Record<AnimalProduct, string>> = {
  eggs: 'Eggs',
  meat: 'Meat',
  milk: 'Milk',
  honey: 'Honey',
};

/**
 * Design elements that house one kind of animal.
 *
 * Only elements whose name leaves no doubt are listed. The kraal holds cattle, goats or sheep and
 * the pig pen has no dossier yet, so neither is guessed at; the livestock trough waters whatever
 * drinks from it.
 */
export const ELEMENT_ANIMAL: Readonly<Record<string, AnimalKind>> = {
  chicken_coop: 'chicken',
  chicken_tractor: 'chicken',
  goat_pen: 'goat',
  beehive: 'bee',
  rabbit_hutch: 'rabbit',
  duck_pond: 'duck',
};

/** The enterprises one kind of animal can be kept for, in table order. */
export function enterprisesFor(animal: AnimalKind): AnimalEnterprise[] {
  return Object.values(ANIMAL_ENTERPRISES).filter((e) => e.animal === animal);
}

export interface PlacedAnimalItem {
  defId: string;
  status?: 'existing' | 'proposed';
}

export interface PlacedAnimalGroup {
  animal: AnimalKind;
  /** Structures (coops, hives, pens) on the map — NOT animals. */
  existing: number;
  proposed: number;
}

/**
 * The design's animal structures, grouped by the animal they house.
 *
 * Kinds with no enterprise in the table are dropped: a hutch with nothing to say about rabbits
 * would be a row of blanks. Legacy items with no status count as existing, as they do for trees.
 */
export function placedAnimalGroups(items: readonly PlacedAnimalItem[]): PlacedAnimalGroup[] {
  const byKind = new Map<AnimalKind, PlacedAnimalGroup>();
  for (const item of items) {
    const animal = ELEMENT_ANIMAL[item.defId];
    if (!animal || enterprisesFor(animal).length === 0) continue;
    const group = byKind.get(animal) ?? { animal, existing: 0, proposed: 0 };
    if (item.status === 'proposed') group.proposed++; else group.existing++;
    byKind.set(animal, group);
  }
  const order = Object.keys(ANIMAL_LABEL) as AnimalKind[];
  return [...byKind.values()].sort((a, b) => order.indexOf(a.animal) - order.indexOf(b.animal));
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

/**
 * Which chosen enterprises give their product in each chart slot, by the sourced months.
 *
 * Only kinds the farmer has said what they keep them for are shown (rule 3). `onlyStanding` is
 * the "from today" chart's rule, as for trees: a coop drawn as proposed has no hens in it yet.
 */
export function buildAnimalAvailability(
  groups: readonly PlacedAnimalGroup[],
  choices: Readonly<Partial<Record<AnimalKind, string>>>,
  months: readonly number[],
  onlyStanding: boolean,
): AnimalAvailabilityItem[][] {
  const rows = groups
    .map((g) => {
      const e = choices[g.animal] ? ANIMAL_ENTERPRISES[choices[g.animal]!] : undefined;
      return { g, e, structures: onlyStanding ? g.existing : g.existing + g.proposed };
    })
    .filter((r): r is { g: PlacedAnimalGroup; e: AnimalEnterprise; structures: number } =>
      !!r.e && r.e.animal === r.g.animal && r.structures > 0)
    .map((r) => ({ ...r, season: new Set(sourcedProductMonths(r.e)) }))
    .filter((r) => r.season.size > 0);
  return months.map((m) => rows
    .filter((r) => r.season.has(m))
    .map((r) => ({ enterpriseId: r.e.enterpriseId, animal: r.g.animal, product: r.e.product, structures: r.structures })));
}

// ── The two view choices ────────────────────────────────────────────────────
//
// Both are view controls in the lib/produce-scope.ts sense: they never change the saved map. The
// enterprise choice is per design (one farm's coop is layers, another's broilers); the animals
// switch is one preference, like the orchard's.

const INCLUDE_ANIMALS_KEY = 'imbewu_crops_include_animals_v1';
const ENTERPRISE_CHOICE_KEY = 'imbewu_animal_enterprise_choice_v1';

export const DEFAULT_INCLUDE_ANIMALS = true;

let sandboxIncludeAnimals = DEFAULT_INCLUDE_ANIMALS;
let sandboxChoices: Record<string, Partial<Record<AnimalKind, string>>> = {};

export function loadIncludeAnimals(): boolean {
  if (isSampleMode()) return sandboxIncludeAnimals;
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_INCLUDE_ANIMALS;
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

/** Drop anything that is not a live enterprise of the kind it is filed under. */
function cleanChoices(raw: unknown): Partial<Record<AnimalKind, string>> {
  const out: Partial<Record<AnimalKind, string>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [kind, id] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id !== 'string') continue;
    const e = ANIMAL_ENTERPRISES[id];
    if (e && e.animal === kind) out[kind as AnimalKind] = id;
  }
  return out;
}

export function loadEnterpriseChoices(siteId: string): Partial<Record<AnimalKind, string>> {
  if (isSampleMode()) return { ...(sandboxChoices[siteId] ?? {}) };
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(ENTERPRISE_CHOICE_KEY));
    const all = raw ? JSON.parse(raw) : {};
    return cleanChoices(all?.[siteId]);
  } catch {
    return {};
  }
}

export function saveEnterpriseChoices(siteId: string, choices: Partial<Record<AnimalKind, string>>): void {
  const clean = cleanChoices(choices);
  if (isSampleMode()) { sandboxChoices = { ...sandboxChoices, [siteId]: clean }; return; }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = activeAccountLocalStorageKey(ENTERPRISE_CHOICE_KEY);
    const raw = window.localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(key, JSON.stringify({ ...(all && typeof all === 'object' ? all : {}), [siteId]: clean }));
  } catch {
    // Storage unavailable or corrupt — fail silently.
  }
}

/** Test seam: the sample-mode sandbox is module state, reset by a full page load. */
export function resetSampleAnimalChoices(): void {
  sandboxIncludeAnimals = DEFAULT_INCLUDE_ANIMALS;
  sandboxChoices = {};
}
