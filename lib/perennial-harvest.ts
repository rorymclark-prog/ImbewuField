// When a tree gives food, how long it takes to start, and roughly how much — per SPECIES.
//
// Rory's audit asked for the orchard to sit beside the vegetables: "fruit, nuts, berries". The
// annual catalogue cannot hold it (lib/perennial-produce.ts says why: a tree's yield is per tree,
// not per m², and it does not give the bed back), so this is its own table, keyed by the same
// catalogue species id a placed tree carries on the design map.
//
// THE RULES THIS TABLE IS HELD TO.
//
// 1. Every value carries the sentence it came from. The data file is generated from the research
//    dossiers in research/perennial-sources/, whose quotes were checked against the fetched source
//    before any value was kept (tests/perennial-harvest.test.ts keeps the two in step). A value no
//    primary South African source states is null, and null is shown as "not sourced" — never
//    filled with a figure from a nursery page, a blog or a guess.
//
// 2. Harvest months are REGIONAL. An avocado in the Lowveld is picked from June; the same cultivar
//    in the KZN midlands from August. The table keeps every sourced window with its region label.
//    The card keeps those windows as references. The farm calendar uses only picking months
//    confirmed locally, after the farmer confirms that its existing plants already give food.
//
// 3. Kilograms per tree are orientation, not a forecast. They come from named trials at named
//    spacings; a tree's crop swings with age, cultivar, water and alternate bearing. Nothing here
//    is ever divided by bed area (lib/produce-scope.ts: per-m² figures always exclude perennials).

import { PERENNIAL_HARVEST_DATA } from './perennial-harvest-data';
import { canonicalSpeciesId } from './species-aliases';
import { activeAccountLocalStorageKey } from './account-local-storage';
import { isSampleMode } from './sample-mode';

export interface HarvestCitation {
  /** Verbatim from the source. Fragments joined with "..." are separate passages of one source. */
  quote: string;
  url: string;
  doc: string;
  page: number | null;
}

export interface HarvestWindow {
  /** The source's own region wording, e.g. "Warm subtropical regions (Hass)". */
  region: string;
  /** 1-12. A window over New Year lists its months in picking order, e.g. [11, 12, 1]. */
  months: number[];
  source: HarvestCitation;
}

export interface SourcedRange {
  /** [min, max]; equal when the source gives one figure. */
  value: [number, number];
  source: HarvestCitation;
  /** How the figure was read or converted from the source (e.g. t/ha at a stated spacing). */
  note?: string;
}

export type Pollination =
  | 'self-fertile'
  | 'partly-self-fertile'
  | 'needs-cross-pollinator'
  | 'separate-male-female-plants';

export interface PerennialHarvest {
  speciesId: string;
  /** Short produce name for a chart row: the catalogue's leading common name. */
  name: string;
  /** What is harvested: "fruit", "nuts", "leaves and fruit"... */
  product: string;
  windows: HarvestWindow[];
  yearsToFirstCrop: SourcedRange | null;
  yearsToFullBearing: SourcedRange | null;
  yieldKgPerTree: SourcedRange | null;
  chillUnits: SourcedRange | null;
  pollination: { value: Pollination; source: HarvestCitation; note?: string } | null;
}

export const PERENNIAL_HARVEST: Readonly<Record<string, PerennialHarvest>> = PERENNIAL_HARVEST_DATA;

/** The harvest record for a catalogue species, following retired ids (lib/species-aliases.ts). */
export function perennialHarvestFor(speciesId: string | null | undefined): PerennialHarvest | null {
  if (!speciesId) return null;
  return PERENNIAL_HARVEST[canonicalSpeciesId(speciesId)] ?? null;
}

/**
 * Every month any sourced South African window covers, ascending.
 *
 * This is the "somewhere in South Africa" span, and it is only ever shown labelled as such. It
 * is not the farm's picking season: that is one of the regional windows, and which one depends on
 * where the farm is and which cultivar went in.
 */
export function sourcedSeasonMonths(h: PerennialHarvest): number[] {
  const months = new Set<number>();
  for (const w of h.windows) for (const m of w.months) months.add(m);
  return [...months].sort((a, b) => a - b);
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "Feb–Oct", "Nov–Jan", "Dec, Mar–Apr": consecutive months (wrapping over New Year) collapsed
 * into ranges, in picking order for a single run.
 */
export function formatMonthSpan(months: readonly number[]): string {
  const set = new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12));
  if (set.size === 0) return '';
  if (set.size === 12) return 'All year';
  // Start each run at a month whose predecessor is absent, so a Nov-Dec-Jan window reads Nov–Jan.
  const starts = [...set].filter((m) => !set.has(m === 1 ? 12 : m - 1)).sort((a, b) => a - b);
  const runs = starts.map((start) => {
    let end = start;
    while (set.has(end === 12 ? 1 : end + 1)) end = end === 12 ? 1 : end + 1;
    return start === end ? MONTH_ABBR[start - 1] : `${MONTH_ABBR[start - 1]}–${MONTH_ABBR[end - 1]}`;
  });
  return runs.join(', ');
}

/** "2–3", "5" — a sourced range as a farmer reads it. */
export function formatRange([min, max]: [number, number]): string {
  const f = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
  return min === max ? f(min) : `${f(min)}–${f(max)}`;
}

/**
 * Built-in design elements that ARE one catalogue species.
 *
 * A farmer can place "Mango Tree" straight from the element palette without opening the species
 * picker, and that tree carries no speciesId. Only elements whose name leaves no doubt are listed:
 * "Citrus Tree", "Orange Tree", "Plum Tree" and "Banana Circle" could each be several things (or,
 * for oranges, a species this table does not hold yet), so they are not guessed at.
 */
export const ELEMENT_SPECIES: Readonly<Record<string, string>> = {
  tree_lemon: 'citrus-limon',
  tree_mango: 'mangifera-indica',
  tree_avocado: 'persea-americana',
  tree_macadamia: 'macadamia-integrifolia',
  tree_guava: 'psidium-guajava',
  tree_litchi: 'litchi-chinensis',
  tree_pawpaw: 'carica-papaya',
  tree_natal_plum: 'carissa-macrocarpa',
  tree_wild_plum: 'harpephyllum-caffrum',
  tree_waterberry: 'syzygium-cordatum',
  tree_marula: 'sclerocarya-birrea-subsp-caffra',
  tree_kei_apple: 'dovyalis-afra',
  tree_peach: 'prunus-persica',
  tree_fig: 'ficus-carica',
  tree_pomegranate: 'punica-granatum',
  tree_moringa: 'moringa-oleifera',
  banana_clump: 'musa-acuminata-aaa-group',
};

export interface PlacedPlant {
  defId: string;
  speciesId?: string;
  status?: 'existing' | 'proposed';
}

/** The catalogue species a placed item is, or null. A picked species beats the element's own. */
export function speciesIdForPlaced(item: PlacedPlant): string | null {
  if (item.speciesId) return canonicalSpeciesId(item.speciesId);
  return ELEMENT_SPECIES[item.defId] ?? null;
}

export interface PlacedTreeGroup {
  harvest: PerennialHarvest;
  existing: number;
  proposed: number;
}

/** A banana circle is a design layout, not evidence of one catalogue species. */
export interface UnidentifiedPlantGroup {
  defId: 'banana_circle';
  label: 'Banana Circle';
  existing: number;
  proposed: number;
}

export function unidentifiedPlantGroups(items: readonly PlacedPlant[]): UnidentifiedPlantGroup[] {
  const itemsWithoutSpecies = items.filter((item) => item.defId === 'banana_circle' && !perennialHarvestFor(speciesIdForPlaced(item)));
  if (itemsWithoutSpecies.length === 0) return [];
  return [{ defId: 'banana_circle', label: 'Banana Circle', existing: itemsWithoutSpecies.filter((item) => item.status !== 'proposed').length, proposed: itemsWithoutSpecies.filter((item) => item.status === 'proposed').length }];
}

/**
 * The design's trees that have a harvest record, grouped by species.
 *
 * Status matters to the chart. A tree drawn as proposed is a plan: it will not crop for the years
 * its yearsToFirstCrop says, so a "from today" calendar must not show its fruit. Legacy items with
 * no status count as existing, which is what lib/design-canvas.ts's statusOf does for them too.
 */
export function placedTreeGroups(items: readonly PlacedPlant[]): PlacedTreeGroup[] {
  const bySpecies = new Map<string, PlacedTreeGroup>();
  for (const item of items) {
    const harvest = perennialHarvestFor(speciesIdForPlaced(item));
    if (!harvest) continue;
    const group = bySpecies.get(harvest.speciesId) ?? { harvest, existing: 0, proposed: 0 };
    if (item.status === 'proposed') group.proposed++; else group.existing++;
    bySpecies.set(harvest.speciesId, group);
  }
  return [...bySpecies.values()].sort((a, b) => a.harvest.name.localeCompare(b.harvest.name, 'en-ZA'));
}

export interface TreeAvailabilityItem {
  speciesId: string;
  name: string;
  /** Trees counted for this chart: existing only when trees must already be standing. */
  trees: number;
}

/** Farmer-confirmed months for this design, separate from regional source references. */
export type TreeSeasonChoices = Partial<Record<string, { months: number[]; bearing: boolean }>>;

export function confirmedTreeMonths(h: PerennialHarvest, choices: TreeSeasonChoices): number[] {
  const choice = choices[h.speciesId];
  return choice?.bearing ? validMonths(choice.months) : [];
}

function validMonths(raw: unknown): number[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b) : [];
}

export function cleanTreeSeasonChoices(raw: unknown): TreeSeasonChoices {
  const out: TreeSeasonChoices = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!Object.hasOwn(PERENNIAL_HARVEST, id) || !value || typeof value !== 'object') continue;
    const candidate = value as { months?: unknown; bearing?: unknown };
    out[id] = { months: validMonths(candidate.months), bearing: candidate.bearing === true };
  }
  return out;
}

const TREE_SEASONS_KEY = 'imbewu_tree_seasons_v1';
let sampleTreeSeasons: Record<string, TreeSeasonChoices> = {};

export function loadTreeSeasonChoices(siteId: string): TreeSeasonChoices {
  if (isSampleMode()) return cleanTreeSeasonChoices(sampleTreeSeasons[siteId]);
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(TREE_SEASONS_KEY));
    return cleanTreeSeasonChoices(raw ? JSON.parse(raw)?.[siteId] : undefined);
  } catch { return {}; }
}

export function saveTreeSeasonChoices(siteId: string, choices: TreeSeasonChoices): void {
  const clean = cleanTreeSeasonChoices(choices);
  if (isSampleMode()) { sampleTreeSeasons = { ...sampleTreeSeasons, [siteId]: clean }; return; }
  if (typeof window === 'undefined') return;
  try {
    const key = activeAccountLocalStorageKey(TREE_SEASONS_KEY);
    const raw = window.localStorage.getItem(key);
    const all = raw ? JSON.parse(raw) : {};
    window.localStorage.setItem(key, JSON.stringify({ ...(all && typeof all === 'object' ? all : {}), [siteId]: clean }));
  } catch { /* An unavailable store must not change the saved design. */ }
}

/**
 * Which placed trees can be picking in each chart slot, by locally confirmed picking months.
 *
 * `onlyStanding` is the "from today" chart's rule: proposed trees are left out because they are
 * years from a crop. The established-year chart shows the whole design, as it does for beds.
 * `months` are the chart's own slots as calendar months (1-12), in display order.
 */
export function buildTreeAvailability(
  groups: readonly PlacedTreeGroup[],
  months: readonly number[],
  onlyStanding: boolean,
  choices: TreeSeasonChoices = {},
): TreeAvailabilityItem[][] {
  const rows = groups
    .map((g) => ({ g, trees: onlyStanding ? g.existing : g.existing + g.proposed, season: new Set(confirmedTreeMonths(g.harvest, choices)) }))
    .filter((r) => r.trees > 0 && r.season.size > 0);
  return months.map((m) => rows
    .filter((r) => r.season.has(m))
    .map((r) => ({ speciesId: r.g.harvest.speciesId, name: r.g.harvest.name, trees: r.trees })));
}

export interface TreePickingLine {
  speciesId: string;
  name: string;
  /** Standing trees (or bushes) of this species on the design. */
  trees: number;
  /** The farmer-confirmed picking months for this design. */
  season: number[];
}

/**
 * The crop plan's "pick from your trees" lines: for each month given, the standing trees whose
 * locally confirmed season includes it.
 *
 * This is a to-do list read from today, so it follows the "from today" chart's rule — a tree drawn
 * as proposed is years from its first crop and is left out. A regional reference cannot silently
 * become a dated picking instruction; the farmer must confirm months and productive plants.
 */
export function treePickingByMonth(groups: readonly PlacedTreeGroup[], months: readonly number[], choices: TreeSeasonChoices = {}): TreePickingLine[][] {
  const seasons = new Map(groups.map((g) => [g.harvest.speciesId, confirmedTreeMonths(g.harvest, choices)]));
  return buildTreeAvailability(groups, months, true, choices).map((slot) => slot.map((item) => ({
    ...item,
    season: seasons.get(item.speciesId) ?? [],
  })));
}

/** One locally confirmed picking instruction, the same on screen and on paper. */
export function treePickingPhrase(line: TreePickingLine): string {
  return `Pick ${line.name} (${line.trees}) — confirmed local months ${formatMonthSpan(line.season)}`;
}
