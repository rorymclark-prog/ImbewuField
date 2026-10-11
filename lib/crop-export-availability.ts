// The app's availability chart, handed to the printed crop plan (lib/crop-export-pdf.ts).
//
// The PDF module draws plain entries (an icon key and a name) so it never has to know what a
// placed tree group or an animal enterprise is. This is the one place that turns the chart's own
// rows into those entries, used by the planner's export card and by the regional PDF harness
// (scripts/crop-plan-pdf-regions.ts), so the paper page and the screen read the same data.

import type { AvailabilityEntry, CropPlanAvailability, ResolvedAvailability } from '@/lib/crop-export-pdf';
import type { PlanningTreeSeason } from '@/lib/production-product-guidance';
import type { FoodAvailabilityItem, Planting, PlanBed } from '@/lib/crop-plan';
import { benchmarkDatedAreaConflictBedLabels, datedPlantingSowIndex, estimatedYieldKgAdjusted, occupiedMonthsForPlanting, planningMaturityMonths, TRANSPLANT_BED_RESERVED_FROM_MONTHS, TRANSPLANT_ENTRY_PLANNED_MONTHS } from '@/lib/crop-plan';
import { SPECIES } from '@/lib/species-catalog';
import { cropByKey, hasPlanningYield } from '@/lib/crop-catalog';
import { sanitiseProductionRecords, sanitisePreservedFoodRecords, type DatedProductionRecord, type PreservedFoodRecord, type PreservedFoodMethod, type ProductionUnit, type ProductionDate } from '@/lib/production-records';
export type { DatedProductionRecord, PreservedFoodRecord, PreservedFoodMethod, ProductionUnit, ProductionDate } from '@/lib/production-records';
import { ageReadyForSeason, treeAgeCalendarNote, buildProductionProjection } from '@/lib/production-projection';
import { confirmedTreeMonths, formatMonthSpan, isHouseholdFoodHarvest, perennialHarvestFor, type PlacedTreeGroup, type TreeAvailabilityItem, type TreeSeasonChoices, type UnidentifiedPlantGroup } from '@/lib/perennial-harvest';
import { ANIMAL_ENTERPRISES, HOUSING_ANIMALS, PRODUCT_LABEL, confirmedAnimalMonths, isFoodProduct, type AnimalAvailabilityItem, type AnimalSeasonChoices, type HousingKind, type PlacedAnimalGroup } from '@/lib/animal-enterprises';

export function forestEntries(slots: readonly TreeAvailabilityItem[][]): AvailabilityEntry[][] {
  return slots.map((slot) => slot.map((t) => ({ iconKey: `tree:${t.speciesId}`, label: t.name })));
}

// "Tilapia (Mozambique tilapia, small-scale pond)" does not fit a 127pt key column; the
// bracketed detail is on the enterprise card, and the print keeps the plain name.
const shortName = (name: string) => name.replace(/\s*\([^)]*\)\s*$/, '');

const HOUSING_PRINT: Record<HousingKind, string> = { chicken: 'Coops / chicken tractors', bee: 'Hives', goat: 'Goat pens', rabbit: 'Hutches', duck: 'Duck ponds', pig: 'Pig pens', kraal: 'Kraals', pond: 'Small ponds' };
const mapCounts = (g: { existing: number; proposed: number }) => `${g.existing} existing${g.proposed ? `; ${g.proposed} proposed` : ''}`;

/** Never lose a placed food source just because it cannot honestly be assigned a harvest date. */
export function undatedAvailability(opts: {
  now?: Date;
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
      const now = opts.now ?? new Date();
      const ageNote = treeAgeCalendarNote(g, opts.treeSeasons?.[g.harvest.speciesId], now.getFullYear() * 12 + now.getMonth());
      entries.push({ iconKey: `tree:${g.harvest.speciesId}`, label: g.harvest.name, ...(ageNote ? { ageNote } : {}), detail: `Plants on map: ${mapCounts(g)}. ${ageNote ? `${ageNote}. ` : ''}${season.length ? `Local months: ${formatMonthSpan(season)}. Proposed plants are not a current harvest.` : 'Picking months and fruit-bearing plants need local confirmation.'}${g.referenceMissing ? ' No harvest reference is available in this plan; only local observations can supply picking months.' : ''}` });
    }
    for (const g of opts.unidentifiedPlants ?? []) entries.push({
      iconKey: g.speciesId ? `tree:${g.speciesId}` : `element:${g.defId}`,
      label: g.label,
      detail: `${mapCounts(g)} on your map. ${g.legalCheck ?? (g.speciesId ? 'No harvest reference is available in this plan. Picking months are not recorded.' : 'Choose its species in the design, then confirm picking months locally.')}`,
    });
  }
  if (opts.includeAnimals !== false) {
    for (const g of opts.animalGroups ?? []) {
      const id = opts.animalChoices?.[g.housing];
      const e = id ? ANIMAL_ENTERPRISES[id] : undefined;
      const fits = e && HOUSING_ANIMALS[g.housing].includes(e.animal);
      const season = fits ? confirmedAnimalMonths(g.housing, e.enterpriseId, opts.animalSeasons ?? {}) : [];
      if (season.length > 0 && g.proposed === 0) continue;
      entries.push({
        iconKey: fits ? `animal:${e.enterpriseId}` : `housing:${g.housing}`,
        label: fits ? `${HOUSING_PRINT[g.housing]} — ${PRODUCT_LABEL[e.product].toLowerCase()}` : HOUSING_PRINT[g.housing],
        detail: `Structures on map: ${mapCounts(g)}. Structure counts do not show animal numbers. ${fits ? e.flowNote?.text ?? (season.length ? 'Proposed housing has no animals yet.' : 'Confirm production months for this farm before expecting this product.') : 'Choose what they are kept for. No product or production dates assumed.'}`,
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
 * are the chart's own switches: products switched off stay out of the paper's dated rows,
 * while their section explains that they are hidden.
 */
export function printableAvailability(opts: {
  now?: Date;
  yearMode: 'established' | 'fromToday';
  planning?: { months: readonly number[]; trees: readonly PlanningTreeSeason[]; dates?: readonly { year: number; month: number }[] };
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
    includeTrees: opts.includeTrees !== false,
    includeAnimals: opts.includeAnimals !== false,
    forest: opts.includeTrees !== false && opts.trees ? forestEntries(opts.trees.slice(0, 12)) : undefined,
    forestPlanning: opts.includeTrees !== false && opts.planning ? opts.planning.months.slice(0, 12).map((month, i) => opts.planning!.trees.filter(tree => {
      const date = opts.planning!.dates?.[i];
      const group = opts.treeGroups?.find(g => g.harvest.speciesId === tree.speciesId);
      return tree.season.months.includes(month) && (!date || !group || ageReadyForSeason(group, opts.treeSeasons?.[tree.speciesId], date.year * 12 + date.month - 1));
    }).map(tree => ({ iconKey: `tree:${tree.speciesId}`, label: tree.name, planning: tree.season }))) : undefined,
    animals: opts.includeAnimals !== false && opts.animals ? animalEntries(opts.animals.slice(0, 12)) : undefined,
    undated: undatedAvailability(opts),
  };
}


/** Graphs keep the print's food identity and source qualifier; no second crop catalogue. */
export type PrintFoodEntry = AvailabilityEntry;
export interface ProductionAvailabilityGraphInput {
  availability: ResolvedAvailability;
  dates: { year: number; month: number }[];
  /** The mapped crop beds and plots, not the site's forest, housing or pond footprint. */
  growingAreaM2: number;
  preservedProducts?: PreservedFoodRecord[];
  productionRecords?: readonly DatedProductionRecord[];
  includeTrees?: boolean;
  includeAnimals?: boolean;
  /** Filters apply before source deduplication, so selected forms remain one food kind. */
  preservedMethods?: readonly PreservedFoodMethod[];
}

export interface ProductionAvailabilityGraphMonth {
  year: number;
  month: number;
  fresh: PrintFoodEntry[];
  stored: PrintFoodEntry[];
  preserved: PreservedFoodRecord[];
  freshCount: number;
  storedCount: number;
  preservedCount: number;
  keptCount: number;
  totalCount: number;
  /** Reference windows stay visible without becoming confirmed food. */
  referenceCount: number;
  preservedCounts: Record<PreservedFoodMethod, number>;
  utilization: number;
  growingUsedM2: number;
  growingFreeM2: number;
}

export interface ProductionAvailabilityGraphs {
  months: ProductionAvailabilityGraphMonth[];
  growingAreaM2: number;
  /** Missing records mean unknown preserved stock; an explicit empty list means none recorded. */
  preservationRecordsProvided: boolean;
}

const foodSpeciesIds = new Set(SPECIES.filter(species => species.uses.includes('food')).map(species => species.id));
function graphFoodKey(key: string): boolean {
  if (key.startsWith('animal:')) {
    const enterprise = ANIMAL_ENTERPRISES[key.slice('animal:'.length)];
    return !!enterprise && isFoodProduct(enterprise.product);
  }
  if (key.startsWith('crop:')) {
    const crop = cropByKey(key.slice('crop:'.length));
    return !!crop && crop.yieldKgPerM2 !== 0;
  }
  if (!key.startsWith('tree:')) return false;
  const speciesId = key.slice('tree:'.length);
  const harvest = perennialHarvestFor(speciesId);
  return foodSpeciesIds.has(speciesId) && (!harvest || isHouseholdFoodHarvest(harvest));
}

export function isVisibleProductionFoodSource(key: string, input: Pick<ProductionAvailabilityGraphInput, 'includeTrees' | 'includeAnimals'>): boolean {
  return graphFoodKey(key) && !(input.includeTrees === false && key.startsWith('tree:'))
    && !(input.includeAnimals === false && key.startsWith('animal:'));
}

/**
 * Count food kinds with dated windows, never kilograms, meals or a second harvest. Fresh food
 * wins over pantry storage, which wins over recorded preservation of the same source. Thus
 * fresh tomatoes plus frozen tomatoes remain one option; the kept stack shows additional kinds.
 * The record supplies its exact years/months, not a shelf-life constant or an annual recurrence.
 */
export function buildProductionAvailabilityGraphs(input: ProductionAvailabilityGraphInput): ProductionAvailabilityGraphs {
  if (!Number.isFinite(input.growingAreaM2) || input.growingAreaM2 < 0) {
    throw new RangeError('Growing area must be a finite non-negative number.');
  }
  const preservedProducts = sanitisePreservedFoodRecords(input.preservedProducts);
  const productionRecords = sanitiseProductionRecords(input.productionRecords).filter(record => isVisibleProductionFoodSource(record.sourceIconKey, input));
  const allowedMethods = input.preservedMethods ? new Set(input.preservedMethods) : null;
  const freshBands = new Set(['fresh', 'staples', 'forest', 'animals']);
  const storedBands = new Set(['stored', 'staples-stored']);
  const months = input.dates.map((date, slot): ProductionAvailabilityGraphMonth => {
    if (!Number.isInteger(date.year) || !Number.isInteger(date.month) || date.month < 1 || date.month > 12) {
      throw new RangeError('A graph column needs an exact year and a month from 1 to 12.');
    }
    const freshBySource = new Map<string, PrintFoodEntry>();
    const storedBySource = new Map<string, PrintFoodEntry>();
    const referenceSources = new Set<string>();
    for (const band of input.availability.bands) {
      for (const entry of band.planningCells?.[slot] ?? []) {
        if (isVisibleProductionFoodSource(entry.iconKey, input)) referenceSources.add(entry.iconKey);
      }
      for (const entry of band.cells[slot] ?? []) {
        if (!isVisibleProductionFoodSource(entry.iconKey, input)) continue;
        if (entry.planning) {
          referenceSources.add(entry.iconKey);
          continue;
        }
        const target = freshBands.has(band.key) ? freshBySource : storedBands.has(band.key) && (!allowedMethods || allowedMethods.has('stored')) ? storedBySource : undefined;
        if (target && !target.has(entry.iconKey)) target.set(entry.iconKey, { ...entry });
      }
    }
    for (const record of selectedMonthlyProductionRecords(productionRecords, date)) {
      if (record.quantity > 0) {
        freshBySource.set(record.sourceIconKey, { iconKey: record.sourceIconKey, label: record.label });
        referenceSources.delete(record.sourceIconKey);
      } else freshBySource.delete(record.sourceIconKey);
    }
    // A measured empty pantry supersedes the catalogue's storage window. A frozen
    // batch is separate, and a positive or unweighed stored batch still leaves food.
    const emptyStoredSources = new Map<string, boolean>();
    for (const record of preservedProducts) {
      if (record.method !== 'stored' || !isVisibleProductionFoodSource(record.sourceIconKey, input)
        || !record.dates.some(recordDate => sameDate(recordDate, date))) continue;
      const quantity = record.quantities?.find(recordDate => sameDate(recordDate, date));
      emptyStoredSources.set(record.sourceIconKey, (emptyStoredSources.get(record.sourceIconKey) ?? true) && quantity?.kg === 0);
    }
    for (const [key, empty] of emptyStoredSources) if (empty) storedBySource.delete(key);
    for (const key of freshBySource.keys()) storedBySource.delete(key);
    const preservedBySource = new Map<string, PreservedFoodRecord>();
    for (const record of preservedProducts) {
      if (allowedMethods && !allowedMethods.has(record.method)) continue;
      if (!isVisibleProductionFoodSource(record.sourceIconKey, input) || freshBySource.has(record.sourceIconKey)
        || storedBySource.has(record.sourceIconKey) || preservedBySource.has(record.sourceIconKey)) continue;
      if (!record.dates.some(recordDate => recordDate.year === date.year && recordDate.month === date.month)) continue;
      // An explicit empty batch is not food present; a later positive/unknown batch may be.
      if (record.quantities?.some(q => q.year === date.year && q.month === date.month && q.kg === 0)) continue;
      preservedBySource.set(record.sourceIconKey, { ...record, dates: record.dates.map(d => ({ ...d })) });
    }
    const fresh = [...freshBySource.values()];
    const stored = [...storedBySource.values()];
    const preserved = [...preservedBySource.values()];
    const preservedCounts: Record<PreservedFoodMethod, number> = { frozen: 0, dried: 0, fermented: 0, processed: 0, stored: 0 };
    for (const record of preserved) preservedCounts[record.method]++;
    const rawUtilization = input.availability.utilization[slot] ?? 0;
    if (!Number.isFinite(rawUtilization)) throw new RangeError('Growing-space utilization must be finite.');
    const utilization = Math.max(0, Math.min(1, rawUtilization));
    const growingUsedM2 = input.growingAreaM2 * utilization;
    return {
      ...date, fresh, stored, preserved,
      freshCount: fresh.length, storedCount: stored.length, preservedCount: preserved.length,
      keptCount: stored.length + preserved.length,
      totalCount: fresh.length + stored.length + preserved.length,
      referenceCount: referenceSources.size, preservedCounts,
      utilization, growingUsedM2, growingFreeM2: input.growingAreaM2 - growingUsedM2,
    };
  });
  return { months, growingAreaM2: input.growingAreaM2, preservationRecordsProvided: input.preservedProducts !== undefined };
}

export interface CropCycleKgEntry {
  plantingId: string;
  sourceIconKey: string;
  label: string;
  bedLabel: string;
  firstPick: ProductionDate;
  lastPick: ProductionDate;
  /** The full cycle benchmark, never the kg harvested in firstPick's month. */
  kg: number | null;
  missingReason?: string;
}
export interface ProductionKgGraphInput extends ProductionAvailabilityGraphInput {
  now: Date;
  plantings: readonly Planting[];
  beds: readonly PlanBed[];
  treeGroups?: readonly PlacedTreeGroup[];
  treeSeasons?: TreeSeasonChoices;
}
export interface ProductionKgGraphMonth {
  year: number;
  month: number;
  /** Null means no quantified monthly kg record; an explicit record may be zero. */
  recordedKg: number | null;
  actualKg: number | null;
  expectedKg: number | null;
  /** Actual replaces expected for the same source/month. Native units are never converted. */
  records: DatedProductionRecord[];
  nativeUnits: Record<ProductionUnit, number | null>;
  actualUnits: Record<ProductionUnit, number | null>;
  expectedUnits: Record<ProductionUnit, number | null>;
  unrecordedSources: PrintFoodEntry[];
  recordedKgMissingSources: PrintFoodEntry[];
  nativeUnitSources: (PrintFoodEntry & { unit: ProductionUnit })[];
  planningReferenceSources: PrintFoodEntry[];
  /** Full-cycle estimates grouped by the first picking date, not a monthly picking curve. */
  cropCycleKgStartingHarvest: number | null;
  cropCycleMissingSources: PrintFoodEntry[];
  cropCycles: CropCycleKgEntry[];
  /** Stock present this month, never added to recordedKg or crop-cycle production. */
  stockKg: number | null;
  stockKgPartial: boolean;
  stockRecords: PreservedFoodRecord[];
  stockKgMissingSources: PrintFoodEntry[];
}
export interface ProductionKgGraphs {
  months: ProductionKgGraphMonth[];
  productionRecordsProvided: boolean;
  stockRecordsProvided: boolean;
  recordIssues: string[];
  unquantifiedCropSources: PrintFoodEntry[];
  undatedSources: PrintFoodEntry[];
  /** Existing annual age authority, deliberately outside every monthly kg field. */
  annualTreeEstimates: {
    label: string;
    trees: ReturnType<typeof buildProductionProjection>['years'][number]['trees'];
    knownKg: [number, number] | null;
    partial: boolean;
  }[];
}
const dateIndex = (date: ProductionDate): number => date.year * 12 + date.month - 1;
const indexDate = (index: number): ProductionDate => ({ year: Math.floor(index / 12), month: index % 12 + 1 });
const sameDate = (a: ProductionDate, b: ProductionDate): boolean => a.year === b.year && a.month === b.month;
const emptyUnits = (): Record<ProductionUnit, number | null> => ({ kg: null, litres: null, eggs: null, items: null });
function selectedMonthlyProductionRecords(records: readonly DatedProductionRecord[], date: ProductionDate): DatedProductionRecord[] {
  const monthly = records.filter(record => sameDate(record.date, date));
  const actualSources = new Set(monthly.filter(record => record.status === 'actual').map(record => record.sourceIconKey));
  return monthly.filter(record => record.status === 'actual' || !actualSources.has(record.sourceIconKey));
}
/** Individually finite entries can overflow when added. Null preserves that failure rather
 * than printing Infinity, a false zero, or restarting a partial sum after overflow. */
function finiteQuantitySum(values: readonly number[]): number | null {
  if (!values.length) return null;
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isFinite(total)) return null;
  }
  return total;
}
function unitTotals(records: readonly DatedProductionRecord[]): Record<ProductionUnit, number | null> {
  const totals = emptyUnits();
  for (const unit of Object.keys(totals) as ProductionUnit[]) totals[unit] = finiteQuantitySum(records.filter(record => record.unit === unit).map(record => record.quantity));
  return totals;
}

/** Dated farmer quantities and whole-cycle benchmarks answer different questions. Keeping them
 * in separate fields makes it impossible for a month chart to distribute a cycle yield or an
 * annual tree assumption across picking months. Pantry and preserved stock are a third series. */
export function buildProductionKgGraphs(input: ProductionKgGraphInput): ProductionKgGraphs {
  const food = buildProductionAvailabilityGraphs(input);
  const origin = input.now.getFullYear() * 12 + input.now.getMonth();
  if (!Number.isFinite(origin)) throw new RangeError('Production graphs need a valid plan date.');
  const slots = new Set(input.dates.map(dateIndex));
  const end = Math.max(origin, ...slots);
  const plantings = [...input.plantings], beds = [...input.beds];
  const bedById = new Map(beds.map(bed => [bed.id, bed]));
  const cycles = new Map<number, CropCycleKgEntry[]>();
  const unquantified = new Map<string, PrintFoodEntry>();
  const recordIssues: string[] = [];
  for (const planting of plantings) {
    if (planting.finishedOnceSowing) continue;
    const crop = cropByKey(planting.cropKey);
    if (crop?.yieldKgPerM2 === 0) continue;
    const source = { iconKey: `crop:${planting.cropKey}`, label: crop?.name ?? planting.cropKey };
    const bed = bedById.get(planting.bedId);
    const sow = datedPlantingSowIndex(planting, origin);
    if (!crop || !bed || planting.awaitingSowingConfirmation || sow === null || crop.timingVerified === false) {
      unquantified.set(source.iconKey, source);
      continue;
    }
    const maturity = planningMaturityMonths(crop.daysToHarvest) + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);
    const first = sow + maturity;
    const oneTime = planting.existing || (planting.confirmedOnceSowing ?? planting.once) !== undefined;
    if (first < origin && first + (crop.harvestWindowMonths ?? 0) >= origin) unquantified.set(source.iconKey, source);
    const repeatCount = oneTime ? 1 : Math.max(0, Math.floor((end - first) / 12) + 1);
    for (let occurrence = 0; occurrence < repeatCount; occurrence++) {
      const pick = first + occurrence * 12;
      if (!slots.has(pick)) continue;
      const cycleStart = pick - maturity + (crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0);
      const cycleEnd = cycleStart + occupiedMonthsForPlanting(planting).length - 1;
      const conflicts = benchmarkDatedAreaConflictBedLabels(plantings, beds, { startIndex: cycleStart, endIndex: cycleEnd, originIndex: origin, plantingId: planting.id });
      const missingReason = !Number.isFinite(bed.areaM2) || bed.areaM2 <= 0 ? 'Check growing area'
        : conflicts.length ? `Resolve growing-space conflicts: ${conflicts.join(', ')}`
          : !hasPlanningYield(crop) ? 'No sourced crop-cycle kg benchmark' : undefined;
      const kg = missingReason ? null : estimatedYieldKgAdjusted(planting, bed.areaM2, plantings);
      const safeKg = kg !== null && Number.isFinite(kg) && kg >= 0 ? kg : null;
      if (kg !== null && !Number.isFinite(kg)) recordIssues.push(`${indexDate(pick).year}-${String(indexDate(pick).month).padStart(2, '0')}: ${source.label} crop-cycle kg cannot be calculated; check growing area and quantity.`);
      const row: CropCycleKgEntry = { plantingId: planting.id, sourceIconKey: source.iconKey, label: source.label,
        bedLabel: bed.label, firstPick: indexDate(pick), lastPick: indexDate(pick + (crop.harvestWindowMonths ?? 0)),
        kg: safeKg, ...(missingReason || safeKg === null ? { missingReason: missingReason ?? 'Check crop-cycle quantity' } : {}),
      };
      const rows = cycles.get(pick) ?? [];
      rows.push(row); cycles.set(pick, rows);
      if (safeKg === null) unquantified.set(source.iconKey, source);
    }
  }
  const allRecords = sanitiseProductionRecords(input.productionRecords).filter(record => graphFoodKey(record.sourceIconKey));
  const allStock = sanitisePreservedFoodRecords(input.preservedProducts).filter(record => graphFoodKey(record.sourceIconKey));
  const records = allRecords.filter(record => isVisibleProductionFoodSource(record.sourceIconKey, input));
  const stock = allStock.filter(record => isVisibleProductionFoodSource(record.sourceIconKey, input));
  const allowedMethods = input.preservedMethods ? new Set(input.preservedMethods) : null;
  if (input.productionRecords && allRecords.length !== input.productionRecords.length) recordIssues.push('Invalid, duplicate or non-food production records were excluded or replaced.');
  if (input.preservedProducts && allStock.length !== input.preservedProducts.length) recordIssues.push('Invalid, duplicate or non-food stock records were excluded or replaced.');
  const undated = new Map<string, PrintFoodEntry>();
  for (const band of input.availability.bands) for (const entry of band.undated ?? []) if (isVisibleProductionFoodSource(entry.iconKey, input)) undated.set(entry.iconKey, { ...entry });
  const months = input.dates.map((date, slot): ProductionKgGraphMonth => {
    const selectedRecords = selectedMonthlyProductionRecords(records, date);
    const actualUnits = unitTotals(selectedRecords.filter(record => record.status === 'actual'));
    const expectedUnits = unitTotals(selectedRecords.filter(record => record.status === 'expected'));
    const nativeUnits = unitTotals(selectedRecords);
    const overflowUnits = (Object.keys(nativeUnits) as ProductionUnit[]).filter(unit => nativeUnits[unit] === null && selectedRecords.some(record => record.unit === unit));
    for (const unit of overflowUnits) recordIssues.push(`${date.year}-${String(date.month).padStart(2, '0')}: ${unit} production total cannot be calculated; check quantities.`);
    const sources = new Map(food.months[slot].fresh.map(entry => [entry.iconKey, entry]));
    const positiveRecordSources = new Set(selectedRecords.filter(record => record.quantity > 0).map(record => record.sourceIconKey));
    const references = new Map<string, PrintFoodEntry>();
    for (const band of input.availability.bands) {
      for (const entry of [...(band.planningCells?.[slot] ?? []), ...(band.cells[slot] ?? []).filter(entry => entry.planning)]) {
        if (!isVisibleProductionFoodSource(entry.iconKey, input)) continue;
        if (positiveRecordSources.has(entry.iconKey)) continue;
        references.set(entry.iconKey, { ...entry });
        if (!sources.has(entry.iconKey)) sources.set(entry.iconKey, { ...entry });
      }
    }
    const quantified = new Set(selectedRecords.map(record => record.sourceIconKey));
    const stockRecords = stock.filter(record => (!allowedMethods || allowedMethods.has(record.method)) && record.dates.some(d => sameDate(d, date)));
    const stockQuantities: number[] = [];
    const stockMissing = new Map(food.months[slot].stored.map(entry => [entry.iconKey, entry]));
    const fullyQuantifiedStock = new Set<string>();
    const unknownStock = new Map<string, PrintFoodEntry>();
    for (const record of stockRecords) {
      const quantity = record.quantities?.find(q => sameDate(q, date));
      if (quantity) {
        stockQuantities.push(quantity.kg);
        if (record.method === 'stored') fullyQuantifiedStock.add(record.sourceIconKey);
      } else unknownStock.set(record.sourceIconKey, { iconKey: record.sourceIconKey, label: record.label });
    }
    // A measured frozen batch does not measure separate unrecorded pantry stock.
    for (const key of fullyQuantifiedStock) if (!unknownStock.has(key)) stockMissing.delete(key);
    for (const [key, entry] of unknownStock) stockMissing.set(key, entry);
    const stockKg = finiteQuantitySum(stockQuantities);
    if (stockQuantities.length && stockKg === null) {
      for (const record of stockRecords) stockMissing.set(record.sourceIconKey, { iconKey: record.sourceIconKey, label: record.label });
      recordIssues.push(`${date.year}-${String(date.month).padStart(2, '0')}: stock kg total cannot be calculated; check batch quantities.`);
    }
    const cropCycles = cycles.get(dateIndex(date)) ?? [];
    const knownCycles = cropCycles.filter(cycle => cycle.kg !== null);
    const cycleMissing = new Map<string, PrintFoodEntry>();
    for (const cycle of cropCycles) if (cycle.kg === null) cycleMissing.set(cycle.sourceIconKey, { iconKey: cycle.sourceIconKey, label: cycle.label });
    const cycleKg = finiteQuantitySum(knownCycles.map(cycle => cycle.kg!));
    if (knownCycles.length && cycleKg === null) {
      for (const cycle of knownCycles) {
        const entry = { iconKey: cycle.sourceIconKey, label: cycle.label };
        cycleMissing.set(cycle.sourceIconKey, entry); unquantified.set(cycle.sourceIconKey, entry);
      }
      recordIssues.push(`${date.year}-${String(date.month).padStart(2, '0')}: crop-cycle kg total cannot be calculated; check growing areas and quantities.`);
    }
    const missingKg = new Map([...sources.values()].filter(entry => {
      const enterprise = entry.iconKey.startsWith('animal:') ? ANIMAL_ENTERPRISES[entry.iconKey.slice('animal:'.length)] : undefined;
      return !quantified.has(entry.iconKey) && (!enterprise || (enterprise.product !== 'eggs' && enterprise.product !== 'milk'));
    }).map(entry => [entry.iconKey, entry]));
    if (overflowUnits.includes('kg')) for (const record of selectedRecords.filter(record => record.unit === 'kg')) missingKg.set(record.sourceIconKey, { iconKey: record.sourceIconKey, label: record.label });
    return { ...date, recordedKg: nativeUnits.kg, actualKg: actualUnits.kg, expectedKg: expectedUnits.kg,
      records: selectedRecords, nativeUnits, actualUnits, expectedUnits,
      unrecordedSources: [...sources.values()].filter(entry => !quantified.has(entry.iconKey)),
      recordedKgMissingSources: [...missingKg.values()],
      nativeUnitSources: selectedRecords.filter(record => record.unit !== 'kg').map(record => ({ iconKey: record.sourceIconKey, label: record.label, unit: record.unit })),
      planningReferenceSources: [...references.values()],
      cropCycleKgStartingHarvest: cycleKg,
      cropCycleMissingSources: [...cycleMissing.values()], cropCycles,
      stockKg, stockKgPartial: stockMissing.size > 0, stockRecords, stockKgMissingSources: [...stockMissing.values()],
    };
  });
  const annualTreeEstimates = input.includeTrees !== false && input.treeGroups?.length ? buildProductionProjection({ plantings: [], beds: [], trees: input.treeGroups,
    choices: input.treeSeasons ?? {}, now: input.now, years: Math.max(1, Math.ceil((end - origin + 1) / 12)),
  }).years.map(year => {
    const finite = year.treeKg.every(Number.isFinite) && !year.trees.some(tree => tree.numericOverflow);
    if (!finite) recordIssues.push(`${year.label}: annual tree kg total cannot be calculated; check entered plant counts and yield schedules.`);
    return { label: year.label, trees: year.trees, knownKg: finite ? year.treeKg : null, partial: year.partial || !finite };
  }) : [];
  return { months, productionRecordsProvided: input.productionRecords !== undefined, stockRecordsProvided: input.preservedProducts !== undefined,
    recordIssues, unquantifiedCropSources: [...unquantified.values()], undatedSources: [...undated.values()], annualTreeEstimates,
  };
}
