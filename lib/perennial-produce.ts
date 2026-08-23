// What comes off the orchard and the food forest.
//
// Rory: "I also want to be able to include fruit tree berries and anything else that's planted in
// the food forest/orchard but these should be toggled on and off in various places."
//
// THE PROBLEM THIS SOLVES. A farmer could draw twelve avocado trees on the design map and then had
// no way to record a single avocado. lib/crop-entry.ts builds its picker from CROPS, and CROPS is
// twenty-nine ANNUAL vegetables and staples — there is not one fruit tree, berry or nut in it. The
// only way to log a bucket of guavas was to free-type the name, which spelt it differently every
// time and left the produce with no identity anywhere else in the app.
//
// WHY NOT JUST ADD TREES TO CROPS. Because the annual model is load-bearing and would break
// silently rather than loudly:
//   - rotationFamilyOf() THROWS for a crop with no botanical rotation family (lib/crop-groups.ts),
//     and a tree has no rotation family — it never rotates.
//   - harvestMonth() wraps sow + maturity within twelve months (lib/crop-plan.ts), so an avocado at
//     roughly four years to first crop would land on a month inside this year and every task and
//     bar downstream would be quietly wrong.
//   - occupiedMonthsForPlanting() gives a bed back at the end of the fresh-harvest window. A tree
//     never gives the ground back.
//   - yieldKgPerM2 × bed area is the wrong shape entirely: a tree yields per tree, not per m² of
//     bed, and an 8 m avocado's canopy is not bed area.
// So perennials get their own list, and the annual planner never sees them.
//
// WHERE THE NAMES COME FROM. lib/species-catalog.ts — 197 reviewed species with botanical names,
// biome ranking and a NEM:BA category. Nothing here is invented: the label is the species' own
// common name, exactly as the reviewed catalogue states it, which is the same principle
// lib/crop-entry.ts already follows for annuals ("the names themselves remain owned by the reviewed
// crop catalogue").
//
// WHAT THIS DELIBERATELY DOES NOT CARRY: no yield, no price, no days to harvest, no sowing window.
// Species has none of those fields and this file will not invent them. A perennial can therefore be
// RECORDED and COUNTED — kilograms picked, kilograms sold, rands taken — but it cannot be planned,
// scheduled, or given a benchmark, and it must never reach a per-m²-of-bed figure. See
// lib/produce-scope.ts for the switches that keep it out of those places.

import { SPECIES } from './species-catalog';
import { isPlantable, type Species, type SpeciesSection, type SpeciesStratum } from './species-palette';

/** How the picker groups perennial produce. Follows the catalogue's own editorial sections. */
export type PerennialGroup = 'indigenous_fruit' | 'fruit_nut' | 'other_perennial';

export const PERENNIAL_GROUP_LABEL: Record<PerennialGroup, string> = {
  indigenous_fruit: 'Indigenous fruit',
  fruit_nut: 'Fruit & nuts',
  other_perennial: 'Other food-forest plants',
};

export const PERENNIAL_GROUP_ORDER: PerennialGroup[] = ['fruit_nut', 'indigenous_fruit', 'other_perennial'];

export interface PerennialProduce {
  /** Namespaced so it can never collide with a CROPS key, now or after the catalogue grows. */
  key: string;
  /** What the farmer picks. The species' own common name, first segment only. */
  label: string;
  group: PerennialGroup;
  indigenous: boolean;
  /**
   * Every reviewed species that yields this produce.
   *
   * More than one is normal and is not a data error: the catalogue carries three separate
   * low-chill peach entries and four wild olives, because they are distinct PLANTING choices with
   * different sources and biome ranks. They are one thing to pick and sell, so the produce list
   * merges them and keeps the ids.
   */
  speciesIds: string[];
}

/**
 * Woody strata only.
 *
 * A canopy, sub-canopy, shrub or climber is by definition a woody perennial, which is exactly the
 * "planted in the food forest/orchard" the farmer means. 'herb' and 'groundcover' are excluded
 * because that stratum mixes true perennials (ginger, pineapple) with annuals that CROPS already
 * carries (cowpea, broad bean, watermelon, pumpkin, sweet potato, amadumbe) — offering those twice,
 * once schedulable and once not, would be worse than leaving them where they work.
 */
const WOODY: ReadonlySet<SpeciesStratum> = new Set<SpeciesStratum>(['canopy', 'sub-canopy', 'shrub', 'climber']);

function groupFor(section: SpeciesSection): PerennialGroup {
  if (section === 'Indigenous fruit') return 'indigenous_fruit';
  if (section === 'Exotic fruit & nuts') return 'fruit_nut';
  return 'other_perennial';
}

/**
 * The produce name, not the plant name: the first segment of the common name.
 *
 * The catalogue writes "Kei apple / umqokolo" and "Pawpaw / papaya" — a botanical entry naming
 * itself in two languages. A picker row wants one name, and the leading one is the catalogue's own
 * primary. Parenthesised cultivar lists go too: you sell bananas, not "Banana ('Dwarf Cavendish')".
 */
function produceLabel(commonName: string): string {
  const primary = commonName.split('/')[0];
  return primary.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
}

function slug(label: string): string {
  return label
    .toLocaleLowerCase('en-ZA')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isFoodPerennial(s: Species): boolean {
  // 1a and 1b must be removed from the land and may never be planted, so they are never offered —
  // the same guard the design picker uses. A farmer clearing one can still free-type what came off
  // it; the app just will not list it as something you grow.
  return s.uses.includes('food') && WOODY.has(s.stratum) && isPlantable(s);
}

/**
 * One catalogue entry can name TWO produce.
 *
 * The species list carries synonym-merged rows — "Soft citrus and lemon", whose id is literally
 * `citrus-reticulata-citrus-limon`, two species' ids joined. As a PLANTING choice that is a
 * reasonable row ("plant citrus"); as a produce name it is not a thing anybody sells. So a
 * conjoined name is split and its id filed under each real produce, rather than becoming a picker
 * row a farmer would have to interpret.
 */
function produceNames(commonName: string): string[] {
  const label = produceLabel(commonName);
  if (!label) return [];
  const parts = label.split(/\s+and\s+/i).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [label];
}

/**
 * Exported for the tests.
 *
 * SPECIES itself carries no 1a/1b entry — a guard test upstream keeps them out of the catalogue
 * altogether — so asserting against the real list proves nothing about this module's own filter.
 * The tests feed it a fixture that does contain one.
 */
export function buildPerennialProduce(species: readonly Species[]): PerennialProduce[] {
  const byKey = new Map<string, PerennialProduce>();
  for (const s of species) {
    if (!isFoodPerennial(s)) continue;
    for (const label of produceNames(s.commonName)) {
      const slugged = slug(label);
      if (!slugged) continue;
      const key = `perennial:${slugged}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.speciesIds.includes(s.id)) existing.speciesIds.push(s.id);
        // Indigenous fruit is the more specific claim, so a merged pair keeps it.
        if (s.indigenous) existing.indigenous = true;
        if (existing.group === 'other_perennial') existing.group = groupFor(s.section);
        continue;
      }
      byKey.set(key, {
        key,
        label,
        group: groupFor(s.section),
        indigenous: s.indigenous,
        speciesIds: [s.id],
      });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const g = PERENNIAL_GROUP_ORDER.indexOf(a.group) - PERENNIAL_GROUP_ORDER.indexOf(b.group);
    return g !== 0 ? g : a.label.localeCompare(b.label, 'en-ZA');
  });
}

/** Every perennial produce a farmer can record, grouped and sorted for a picker. */
export const PERENNIAL_PRODUCE: PerennialProduce[] = buildPerennialProduce(SPECIES);

const BY_KEY = new Map(PERENNIAL_PRODUCE.map((p) => [p.key, p]));

export function perennialProduceByKey(key: string): PerennialProduce | null {
  return BY_KEY.get(key) ?? null;
}

/** True for a key this module owns, so callers can route without a substring test at each site. */
export function isPerennialProduceKey(key: string | null | undefined): boolean {
  return typeof key === 'string' && BY_KEY.has(key);
}

export function perennialProduceInGroup(group: PerennialGroup): PerennialProduce[] {
  return PERENNIAL_PRODUCE.filter((p) => p.group === group);
}
