// The app's availability chart, handed to the printed crop plan (lib/crop-export-pdf.ts).
//
// The PDF module draws plain entries (an icon key and a name) so it never has to know what a
// placed tree group or an animal enterprise is. This is the one place that turns the chart's own
// rows into those entries, used by the planner's export card and by the regional PDF harness
// (scripts/crop-plan-pdf-regions.ts), so the paper page and the screen read the same data.

import type { AvailabilityEntry, CropPlanAvailability } from '@/lib/crop-export-pdf';
import type { FoodAvailabilityItem } from '@/lib/crop-plan';
import type { TreeAvailabilityItem } from '@/lib/perennial-harvest';
import { ANIMAL_ENTERPRISES, PRODUCT_LABEL, type AnimalAvailabilityItem } from '@/lib/animal-enterprises';

export function forestEntries(slots: readonly TreeAvailabilityItem[][]): AvailabilityEntry[][] {
  return slots.map((slot) => slot.map((t) => ({ iconKey: `tree:${t.speciesId}`, label: t.name })));
}

// "Tilapia (Mozambique tilapia, small-scale pond)" does not fit a 127pt key column; the
// bracketed detail is on the enterprise card, and the print keeps the plain name.
const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

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
}): CropPlanAvailability {
  return {
    yearMode: opts.yearMode,
    veg: opts.veg.slice(0, 12).map((slot) => [...slot]),
    utilization: opts.utilization.slice(0, 12),
    forest: opts.includeTrees !== false && opts.trees ? forestEntries(opts.trees.slice(0, 12)) : undefined,
    animals: opts.includeAnimals !== false && opts.animals ? animalEntries(opts.animals.slice(0, 12)) : undefined,
  };
}
