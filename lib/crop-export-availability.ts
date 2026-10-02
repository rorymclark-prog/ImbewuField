// The app's availability chart, handed to the printed crop plan (lib/crop-export-pdf.ts).
//
// The PDF module draws plain entries (an icon key and a name) so it never has to know what a
// placed tree group or an animal enterprise is. This is the one place that turns the chart's own
// rows into those entries, used by the planner's export card and by the regional PDF harness
// (scripts/crop-plan-pdf-regions.ts), so the paper page and the screen read the same data.

import type { AvailabilityEntry, CropPlanAvailability } from '@/lib/crop-export-pdf';
import type { FoodAvailabilityItem } from '@/lib/crop-plan';
import { confirmedTreeMonths, formatMonthSpan, type PlacedTreeGroup, type TreeAvailabilityItem, type TreeSeasonChoices, type UnidentifiedPlantGroup } from '@/lib/perennial-harvest';
import { ANIMAL_ENTERPRISES, HOUSING_ANIMALS, PRODUCT_LABEL, confirmedAnimalMonths, type AnimalAvailabilityItem, type AnimalSeasonChoices, type HousingKind, type PlacedAnimalGroup } from '@/lib/animal-enterprises';

export function forestEntries(slots: readonly TreeAvailabilityItem[][]): AvailabilityEntry[][] {
  return slots.map((slot) => slot.map((t) => ({ iconKey: `tree:${t.speciesId}`, label: t.name })));
}

// "Tilapia (Mozambique tilapia, small-scale pond)" does not fit a 127pt key column; the
// bracketed detail is on the enterprise card, and the print keeps the plain name.
const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

const HOUSING_PRINT: Record<HousingKind, string> = { chicken: 'Coops / chicken tractors', bee: 'Hives', goat: 'Goat pens', rabbit: 'Hutches', duck: 'Duck ponds', pig: 'Pig pens', kraal: 'Kraals', pond: 'Small ponds' };
const HOUSING_ICON: Record<HousingKind, string> = { chicken: 'chicken-indigenous', bee: 'bees', goat: 'goat-meat', rabbit: 'rabbit', duck: 'duck', pig: 'pig-pork', kraal: 'cattle-beef', pond: 'fish-tilapia' };
const mapCounts = (g: { existing: number; proposed: number }) => `${g.existing} existing${g.proposed ? `; ${g.proposed} proposed` : ''}`;

/** Never lose a placed food source just because it cannot honestly be assigned a harvest date. */
export function undatedAvailability(opts: {
  treeGroups?: readonly PlacedTreeGroup[];
  unidentifiedPlants?: readonly UnidentifiedPlantGroup[];
  treeSeasons?: TreeSeasonChoices;
  animalGroups?: readonly PlacedAnimalGroup[];
  animalChoices?: Partial<Record<HousingKind, string>>;
  animalSeasons?: AnimalSeasonChoices;
  includeTrees?: boolean;
  includeAnimals?: boolean;
}): NonNullable<CropPlanAvailability['undated']> {
  const entries: NonNullable<CropPlanAvailability['undated']> = [];
  if (opts.includeTrees !== false) {
    for (const g of opts.treeGroups ?? []) {
      const season = confirmedTreeMonths(g.harvest, opts.treeSeasons ?? {});
      if (season.length > 0 && g.proposed === 0) continue;
      entries.push({ iconKey: `tree:${g.harvest.speciesId}`, label: g.harvest.name, detail: `Plants on map: ${mapCounts(g)}. ${season.length ? `Local months: ${formatMonthSpan(season)}. Proposed plants are not a current harvest.` : 'Picking months and fruit-bearing plants need local confirmation.'}` });
    }
    for (const g of opts.unidentifiedPlants ?? []) entries.push({ iconKey: 'element:banana_circle', label: g.label, detail: `${mapCounts(g)} on your map. Choose its species in the design, then confirm picking months locally.` });
  }
  if (opts.includeAnimals !== false) {
    for (const g of opts.animalGroups ?? []) {
      const id = opts.animalChoices?.[g.housing];
      const e = id ? ANIMAL_ENTERPRISES[id] : undefined;
      const fits = e && HOUSING_ANIMALS[g.housing].includes(e.animal);
      const season = fits ? confirmedAnimalMonths(g.housing, e.enterpriseId, opts.animalSeasons ?? {}) : [];
      if (season.length > 0 && g.proposed === 0) continue;
      entries.push({
        iconKey: `animal:${fits ? e.enterpriseId : HOUSING_ICON[g.housing]}`,
        label: fits ? `${HOUSING_PRINT[g.housing]} — ${PRODUCT_LABEL[e.product].toLowerCase()}` : HOUSING_PRINT[g.housing],
        detail: `Structures on map: ${mapCounts(g)}; animal numbers are not recorded. ${fits ? e.flowNote?.text ?? (season.length ? 'Proposed housing has no animals yet.' : 'Confirm production months for this farm before expecting this product.') : 'Choose what they are kept for. No product or production dates assumed.'}`,
      });
    }
  }
  return entries;
}

export function animalEntries(slots: readonly AnimalAvailabilityItem[][]): AvailabilityEntry[][] {
  return slots.map((slot) => {
    const seen = new Set<string>();
    return slot.filter((a) => !seen.has(a.enterpriseId) && seen.add(a.enterpriseId)).map((a) => ({
      iconKey: `animal:${a.enterpriseId}`,
      label: `${shortName(ANIMAL_ENTERPRISES[a.enterpriseId]?.name ?? a.animal)} - ${PRODUCT_LABEL[a.product].toLowerCase()}`,
    }));
  });
}

/**
 * The first twelve slots of the chart as the print wants them. `includeTrees` / `includeAnimals`
 * are the chart's own switches: a row the farmer switched off on screen stays off the paper.
 */
export function printableAvailability(opts: {
  yearMode: 'established' | 'fromToday';
  veg: readonly FoodAvailabilityItem[][];
  utilization: readonly number[];
  trees?: readonly TreeAvailabilityItem[][];
  animals?: readonly AnimalAvailabilityItem[][];
  includeTrees?: boolean;
  includeAnimals?: boolean;
  treeGroups?: readonly PlacedTreeGroup[];
  unidentifiedPlants?: readonly UnidentifiedPlantGroup[];
  treeSeasons?: TreeSeasonChoices;
  animalGroups?: readonly PlacedAnimalGroup[];
  animalChoices?: Partial<Record<HousingKind, string>>;
  animalSeasons?: AnimalSeasonChoices;
}): CropPlanAvailability {
  return {
    yearMode: opts.yearMode,
    veg: opts.veg.slice(0, 12).map((slot) => [...slot]),
    utilization: opts.utilization.slice(0, 12),
    forest: opts.includeTrees !== false && opts.trees ? forestEntries(opts.trees.slice(0, 12)) : undefined,
    animals: opts.includeAnimals !== false && opts.animals ? animalEntries(opts.animals.slice(0, 12)) : undefined,
    undated: undatedAvailability(opts),
  };
}
