// What the food forest and the animals give in each column of the bed calendar.
//
// Rory, 2026-09-29: "include fruit and nuts and berries (also add for animal products) into this
// calendar … instead of fruit trees as the icons make them actual fruit and if you hover … it
// opens up as a written version of what's in that month."
//
// The rows reuse the chart's own builders (buildTreeAvailability, buildAnimalAvailability), run
// once for what is standing and once for the whole design, so a tree or coop drawn as PROPOSED is
// still shown — it is part of the plan — but kept apart and never passed off as cropping. The
// months are the sourced ones only; nothing here invents a season or a quantity.

import { ANIMAL_ENTERPRISES, ANIMAL_LABEL, HOUSING_ANIMALS, HOUSING_LABEL, PRODUCT_LABEL, buildAnimalAvailability, confirmedAnimalMonths, isFoodProduct, type AnimalKind, type AnimalProduct, type AnimalSeasonChoices, type FlowRecord, type HousingKind, type PlacedAnimalGroup } from './animal-enterprises';
import type { HarvestCitation } from './perennial-harvest';
import { PERENNIAL_HARVEST, buildTreeAvailability, formatRange, type PlacedTreeGroup, type TreeSeasonChoices } from './perennial-harvest';

export interface CalendarTreeLine {
  speciesId: string;
  name: string;
  /** What is picked, from the harvest record: "fruit", "nut in shell", "leaves and pods"… A
   * trailing parenthetical note (marula's "(also the nut/kernel … is eaten …)") is dropped here:
   * it belongs on the tree's own card, not in a one-line month list. */
  product: string;
  standing: number;
  proposed: number;
  /** Sourced years from planting to a first crop, when the record has one. */
  yearsToFirstCrop: [number, number] | null;
}

export interface CalendarAnimalLine {
  enterpriseId: string;
  name: string;
  animal: AnimalKind;
  product: AnimalProduct;
  /** Structures (coops, hives, pens), not animals. */
  standing: number;
  proposed: number;
}

export interface CalendarProduceMonth {
  trees: CalendarTreeLine[];
  animals: CalendarAnimalLine[];
}

export function calendarProduceByMonth(
  treeGroups: readonly PlacedTreeGroup[],
  animalGroups: readonly PlacedAnimalGroup[],
  choices: Readonly<Partial<Record<HousingKind, string>>>,
  months: readonly number[],
  treeSeasons: TreeSeasonChoices = {},
  animalSeasons: AnimalSeasonChoices = {},
): CalendarProduceMonth[] {
  const treesAll = buildTreeAvailability(treeGroups, months, false, treeSeasons);
  const treesStanding = buildTreeAvailability(treeGroups, months, true, treeSeasons);
  const animalsAll = buildAnimalAvailability(animalGroups, choices, months, false, animalSeasons);
  const animalsStanding = buildAnimalAvailability(animalGroups, choices, months, true, animalSeasons);
  return months.map((_, i) => ({
    trees: treesAll[i].map((t) => {
      const standing = treesStanding[i].find((s) => s.speciesId === t.speciesId)?.trees ?? 0;
      const record = PERENNIAL_HARVEST[t.speciesId];
      return {
        speciesId: t.speciesId,
        name: t.name,
        product: (record?.product ?? 'fruit').replace(/\s*\(.*\)\s*$/, ''),
        standing,
        proposed: t.trees - standing,
        yearsToFirstCrop: record?.yearsToFirstCrop?.value ?? null,
      };
    }),
    animals: animalsAll[i].map((a) => {
      const standing = animalsStanding[i].find((s) => s.enterpriseId === a.enterpriseId)?.structures ?? 0;
      return {
        enterpriseId: a.enterpriseId,
        name: ANIMAL_ENTERPRISES[a.enterpriseId]?.name ?? ANIMAL_LABEL[a.animal],
        animal: a.animal,
        product: a.product,
        standing,
        proposed: a.structures - standing,
      };
    }),
  }));
}

/**
 * One product's lane in the calendar: the product and the runs of columns it is picked in.
 *
 * Rory, 2026-09-30: "I want the avocado like a cabbage planting … this makes it more clearly
 * visible." So each tree kind and each animal product gets its own row of bars, drawn like a bed's
 * planting bars, in place of a stack of icons in every month.
 *
 * A run is cut at column `seamAt` (the start of year two), as the chart draws the second year
 * as the same cycle coming round again, not as one unbroken season.
 */
export interface ProduceLane<L> {
  key: string;
  line: L;
  runs: { start: number; end: number }[];
}

export function produceLanes(
  months: readonly CalendarProduceMonth[],
  kind: 'trees' | 'animals',
  seamAt = 12,
): ProduceLane<CalendarTreeLine>[] | ProduceLane<CalendarAnimalLine>[] {
  return kind === 'trees'
    ? lanesOf(months.map((m) => m.trees), (t) => t.speciesId, seamAt)
    : lanesOf(months.map((m) => m.animals), (a) => a.enterpriseId, seamAt);
}

function lanesOf<L>(columns: readonly (readonly L[])[], keyOf: (line: L) => string, seamAt: number): ProduceLane<L>[] {
  const lanes = new Map<string, ProduceLane<L>>();
  columns.forEach((lines, col) => {
    for (const line of lines) {
      const key = keyOf(line);
      let lane = lanes.get(key);
      if (!lane) { lane = { key, line, runs: [] }; lanes.set(key, lane); }
      const last = lane.runs[lane.runs.length - 1];
      if (last && last.end === col - 1 && col !== seamAt) last.end = col;
      else lane.runs.push({ start: col, end: col });
    }
  });
  return [...lanes.values()];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** One written line per tree kind, e.g. "Mango — fruit · 3 plants, 1 of them proposed". */
export function treeLineText(line: CalendarTreeLine): string {
  const total = line.standing + line.proposed;
  const count = plural(total, 'plant', 'plants');
  let tail = '';
  if (line.proposed > 0) {
    const wait = line.yearsToFirstCrop ? ` (first crop ${formatRange(line.yearsToFirstCrop)} years after planting)` : '';
    tail = line.standing === 0
      ? ` · proposed, not cropping yet${wait}`
      : ` · ${line.proposed} of them proposed${wait}`;
  }
  return `${line.name} — ${line.product} · ${count} on your map${tail}`;
}

// The same nouns as the "Animals on your map" card, by animal. Goats, cattle and sheep can live in
// a pen or a kraal, and the chart item does not say which, so the noun says both.
const STRUCTURE: Readonly<Record<AnimalKind, [string, string]>> = {
  chicken: ['coop or tractor', 'coops and tractors'],
  bee: ['hive', 'hives'],
  rabbit: ['hutch', 'hutches'],
  duck: ['duck pond', 'duck ponds'],
  pig: ['pig pen', 'pig pens'],
  fish: ['pond', 'ponds'],
  goat: ['pen or kraal', 'pens or kraals'],
  cattle: ['pen or kraal', 'pens or kraals'],
  sheep: ['pen or kraal', 'pens or kraals'],
};

/** One written line per enterprise, e.g. "Eggs — Layer hens · 2 coops". */
export function animalLineText(line: CalendarAnimalLine): string {
  const [one, many] = STRUCTURE[line.animal];
  const total = line.standing + line.proposed;
  const tail = line.proposed === 0 ? ''
    : line.standing === 0 ? ' · proposed, no animals yet'
    : ` · ${line.proposed} of them proposed`;
  return `${PRODUCT_LABEL[line.product]} — ${line.name} · ${plural(total, one, many)}${tail}`;
}

/**
 * A product on the map that the sources cannot put in months, shown as a line with no month bar.
 *
 * Rory, 2026-09-30, choosing option 1 for honey: show the honey row with no bar, say that honey
 * flows depend on local plants and rain, and list the recorded flows with their sources on hover.
 * Each record is one plant's flow in one place (Strelitzia 37), so none of them is a region's
 * honey season and none is drawn as months — see the round-2 and round-4 lines in bees.json.
 */
export interface CalendarUnmarkedLine {
  enterpriseId: string;
  name: string;
  animal: AnimalKind;
  product: AnimalProduct;
  standing: number;
  proposed: number;
  note: { text: string; source: HarvestCitation } | null;
  records: FlowRecord[];
}

export function unmarkedAnimalLines(
  groups: readonly PlacedAnimalGroup[],
  choices: Readonly<Partial<Record<HousingKind, string>>>,
  seasons: AnimalSeasonChoices = {},
): CalendarUnmarkedLine[] {
  const lines: CalendarUnmarkedLine[] = [];
  for (const g of groups) {
    if (g.existing + g.proposed === 0) continue;
    const e = choices[g.housing] ? ANIMAL_ENTERPRISES[choices[g.housing]!] : undefined;
    if (!e || !HOUSING_ANIMALS[g.housing].includes(e.animal) || !isFoodProduct(e.product) || confirmedAnimalMonths(g.housing, e.enterpriseId, seasons).length > 0) continue;
    lines.push({
      enterpriseId: e.enterpriseId,
      name: e.name,
      animal: e.animal,
      product: e.product,
      standing: g.existing,
      proposed: g.proposed,
      note: e.flowNote,
      records: e.flowRecords,
    });
  }
  return lines;
}

/** "Honey — Honeybee (managed hives) · 2 hives", the same shape as animalLineText. */
export function unmarkedLineText(line: CalendarUnmarkedLine): string {
  return animalLineText({ ...line });
}

/** One recorded flow as a farmer reads it: "Western Cape (Stellenbosch, Cape Peninsula): April–May, Blue gum (Eucalyptus globulus)". */
export function flowRecordText(record: FlowRecord): string {
  return `${record.region}: ${record.when}${record.plant ? `, ${record.plant}` : ''}`;
}

/**
 * Why an animal structure on the map gives nothing in the calendar, so honey that never shows is
 * explained, not silently missing: either the farmer has not said what the structure is for, or the
 * chosen enterprise's months are unsourced. Wool is left out on purpose (not food), so not listed.
 */
export function animalsNotShownNote(
  groups: readonly PlacedAnimalGroup[],
  choices: Readonly<Partial<Record<HousingKind, string>>>,
  seasons: AnimalSeasonChoices = {},
): string | null {
  const noMonths: string[] = [];
  const unchosen: string[] = [];
  for (const g of groups) {
    if (g.existing + g.proposed === 0) continue;
    const e = choices[g.housing] ? ANIMAL_ENTERPRISES[choices[g.housing]!] : undefined;
    if (!e) unchosen.push(HOUSING_LABEL[g.housing]);
    // Honey has its own line with no month bar (unmarkedAnimalLines), so it is shown, not missing.
    else if (isFoodProduct(e.product) && confirmedAnimalMonths(g.housing, e.enterpriseId, seasons).length === 0) noMonths.push(`${PRODUCT_LABEL[e.product].toLowerCase()} from ${e.name}`);
  }
  const parts: string[] = [];
  if (noMonths.length) parts.push(`confirm local production months for ${noMonths.join(', ')}`);
  if (unchosen.length) parts.push(`say what it is for under Animals on your map: ${unchosen.join(', ')}`);
  return parts.length ? `On your map, with no month bar — ${parts.join('; ')}.` : null;
}
