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

import { pluralFormsOf } from './plural-forms';
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

/**
 * Sections a reviewer has already called fruit.
 *
 * A second way in, alongside WOODY, because two indigenous food plants sit in a fruit section
 * without being trees — sour fig, a groundcover, and waterblommetjie, a herb. Both are picked and
 * eaten off ground a farmer keeps for years, and a person who reviewed this catalogue filed them
 * under fruit. Deferring to that beats a stratum rule that would drop them.
 */
const FRUIT_SECTIONS: ReadonlySet<SpeciesSection> = new Set<SpeciesSection>([
  'Indigenous fruit',
  'Exotic fruit & nuts',
]);

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
  return s.uses.includes('food') && (WOODY.has(s.stratum) || FRUIT_SECTIONS.has(s.section)) && isPlantable(s);
}

/*
 * WHAT IS KNOWINGLY LEFT OUT, AND WHY IT IS NOT AN OVERSIGHT.
 *
 * "Groundcovers & herbaceous" holds both halves of the thing this file has to tell apart, and the
 * catalogue carries no field that separates them: cowpea, sweet potato, pumpkin, watermelon, grain
 * sorghum and broad bean are annual vegetables; pineapple, ginger, globe artichoke, wild garlic and
 * Livingstone potato are perennials a food forest really does hold. `Species` records stratum,
 * section and use — it does not record whether a plant lives one season or ten.
 *
 * Taking the whole section would file a cowpea harvest as orchard produce, and the orchard switch
 * would then hide it from the vegetable-bed totals. That is a wrong answer arriving quietly, which
 * is worse than the gap: a farmer with a pineapple types the name, it is treated as their own
 * entry, and their own entries are NEVER hidden by the switch. The safe direction is the default.
 *
 * The fix is a perennial/annual field on Species, set by whoever reviews the botany — not a guess
 * made here from a name.
 */

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

/* ── Matching a written name to this catalogue ───────────────────────────────
   Lives here rather than beside the finance switch that first needed it: this is catalogue data,
   and lib/harvest-reconciliation.ts needs it while being contractually free of storage reads. */

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase('en-ZA').replace(/\s+/g, ' ');
}

/**
 * Names to match a perennial by.
 *
 * Logs store a NAME, not a key (ProductionLog.crop and SalesLog.crop are both `string`), so
 * matching is by text. A plural is included because a farmer records "Avocados" and the catalogue
 * says "Avocado", and both plainly mean the same fruit.
 */
function perennialAliases(): Map<string, string> {
  const map = new Map<string, string>();
  // Two passes so a real catalogue name always beats a plural GENERATED from another name. One
  // fruit's plural colliding with another fruit's actual name would file every log of the second
  // under the first, and nothing on screen would show it happening.
  for (const produce of PERENNIAL_PRODUCE) map.set(normalise(produce.label), produce.key);
  for (const produce of PERENNIAL_PRODUCE) {
    for (const form of pluralFormsOf(normalise(produce.label))) {
      if (!map.has(form)) map.set(form, produce.key);
    }
  }
  return map;
}

const PERENNIAL_ALIASES = perennialAliases();

/** The perennial produce key a recorded name refers to, or null. */
export function perennialKeyForName(name: string): string | null {
  return PERENNIAL_ALIASES.get(normalise(name)) ?? null;
}

/**
 * The name to SHOW for a recorded produce.
 *
 * Every screen that lists what a filter left out was building its list from the raw logged text,
 * so one avocado tree appeared as "Avocado, Avocados" — the harvest form writes the catalogue name
 * from a picker while a sale's crop is free text the farmer types. A farmer reading that has to
 * work out which of their trees is which, and there is only one.
 *
 * A name in no catalogue is returned exactly as written. Filing it under a fruit it merely
 * resembles would rename the farmer's own record on their own screen.
 */
export function produceDisplayName(name: string): string {
  const written = typeof name === 'string' ? name.trim() : '';
  const key = perennialKeyForName(written);
  return (key && perennialProduceByKey(key)?.label) || written;
}
