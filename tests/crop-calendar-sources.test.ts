import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CROPS, FROST_FREE_CALENDAR_CITED, MONTHS_SHORT, type RainPattern } from '@/lib/crop-catalog';

// EVERY SOWING MONTH MUST BE ABLE TO NAME ITS ROW.
//
// The 10 November 2026 accuracy audit found that the catalogue's comments said "KZN DARD
// Table 6" where the months did not match the table: seventeen hot-area rows differed
// from the column they were filed under (peas offered in a hot-area January), six
// hard-frost rows carried months no interior source lists (peas in February, flowering
// into frost), and nine Western Cape rows were copies of the hard-frost column. Nothing
// failed, because nothing compared the catalogue with the tables.
//
// This file does. The tables are held as text, exactly as transcribed, in
// research/crop-sources/_kzn-table6-rows.json (KZN Department of Agriculture, second-hand:
// the document could not be re-read during the audit) and _sansor-sowing-guide.json (the
// seed industry's regional guide, a secondary source). A month the catalogue offers must be
// inside the published row, or be listed below with the reason it is not. Adding a month
// nobody has sourced, or a new exception with no reason, fails here.

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const KZN: { rows: Record<string, { row: string; cold: string | null; warm: string | null; hot: string | null }> } =
  read('../research/crop-sources/_kzn-table6-rows.json');
const SANSOR: { regions: string[]; rows: Record<string, { row: string; cells: string[] }> } =
  read('../research/crop-sources/_sansor-sowing-guide.json');

const MONTH_INDEX = new Map(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((m, i) => [m, i + 1]));
const month = (text: string): number => {
  const found = MONTH_INDEX.get(text.trim().toLowerCase().slice(0, 3));
  if (!found) throw new Error(`not a month: "${text}"`);
  return found;
};
const span = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let m = from; ; m = (m % 12) + 1) { out.push(m); if (m === to) return out; }
};

/**
 * A table cell as two month sets. A slash marks an ambiguous endpoint: 'Feb - Jun/Jul'
 * is Feb-Jun read narrowly and Feb-Jul read widely; 'Sept/Oct - Dec' is Oct-Dec and
 * Sep-Dec. A cell with no slash has one reading.
 */
function readCell(cell: string | null): { narrow: Set<number>; wide: Set<number> } | null {
  if (cell === null) return null;
  const text = cell.trim();
  if (text === '' || text === '-') return { narrow: new Set(), wide: new Set() };
  if (text.toLowerCase() === 'all year') return { narrow: new Set(span(1, 12)), wide: new Set(span(1, 12)) };
  const narrow = new Set<number>();
  const wide = new Set<number>();
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const ends = part.split(/\s*[-–]\s*/);
    if (ends.length === 1) {
      const options = ends[0].split('/').map(month);
      options.forEach((m) => wide.add(m));
      // 'April/May' with no range is one of two months: neither is certain.
      if (options.length === 1) narrow.add(options[0]);
      continue;
    }
    assert.equal(ends.length, 2, `cannot read the cell "${cell}"`);
    const starts = ends[0].split('/').map(month);
    const finishes = ends[1].split('/').map(month);
    span(starts[0], finishes[finishes.length - 1]).forEach((m) => wide.add(m));
    span(starts[starts.length - 1], finishes[0]).forEach((m) => narrow.add(m));
  }
  return { narrow, wide };
}

const names = (months: Iterable<number>) => [...months].sort((a, b) => a - b).map((m) => MONTHS_SHORT[m - 1]).join(' ');
const monthsOf = (key: string, column: RainPattern) => new Set(CROPS.find((crop) => crop.key === key)!.sowMonths[column]);
const outside = (months: Set<number>, allowed: Set<number>) => [...months].filter((m) => !allowed.has(m));

test('the cell reader reads the table conventions the way the catalogue comments describe them', () => {
  assert.equal(names(readCell('Feb - Jun/Jul')!.narrow), 'Feb Mar Apr May Jun');
  assert.equal(names(readCell('Feb - Jun/Jul')!.wide), 'Feb Mar Apr May Jun Jul');
  assert.equal(names(readCell('Sept/Oct - Dec')!.narrow), 'Oct Nov Dec');
  assert.equal(names(readCell('Sept/Oct - Dec')!.wide), 'Sep Oct Nov Dec');
  assert.equal(names(readCell('Mar - May, Jul - Oct')!.narrow), 'Mar Apr May Jul Aug Sep Oct');
  assert.equal(names(readCell('Aug - Mar')!.narrow), 'Jan Feb Mar Aug Sep Oct Nov Dec', 'a range must wrap the year end');
  assert.equal(readCell('All year')!.narrow.size, 12);
  assert.equal(names(readCell('April/May')!.wide), 'Apr May');
  assert.equal(readCell('April/May')!.narrow.size, 0, 'a bare either-or cell has no certain month');
  assert.equal(readCell('-')!.wide.size, 0);
  assert.equal(readCell(null), null, 'an untranscribed cell is unknown, not empty');
  assert.equal(names(readCell('Aug-Oct, Jan-Mar')!.wide), 'Jan Feb Mar Aug Sep Oct');
});

// ── Hot areas, frost-free: the 'all-year' column ───────────────────────────

/** Cited rows that are deliberately narrower than the table row, and why. */
const HOT_NARROWER: Record<string, string> = {
  'dry-beans': "The table's one 'Bean, bush' row covers green beans; dry beans keep the March-April the dry-bean guidance names.",
  watermelon: "The table's one 'Cucurbits' row is a family proxy; watermelon keeps the Aug-Oct of its own chart, which lies inside it.",
  // 'April/May' is an either-or cell: both months are offered, neither is certain alone.
  potato: "The cell is 'April/May'; the catalogue offers both months.",
};

test('every cited hot-area row is the published hot-area row', () => {
  const wrong: string[] = [];
  for (const key of FROST_FREE_CALENDAR_CITED) {
    const cell = readCell(KZN.rows[key]?.hot ?? null);
    if (!cell) { wrong.push(`${key}: cited, but no hot-area cell is held in _kzn-table6-rows.json`); continue; }
    const months = monthsOf(key, 'all-year');
    const extra = outside(months, cell.wide);
    if (extra.length) wrong.push(`${key}: ${names(extra)} is outside the row "${KZN.rows[key].hot}"`);
    const missing = outside(cell.narrow, months);
    if (missing.length && !HOT_NARROWER[key]) wrong.push(`${key}: lacks ${names(missing)} of the row "${KZN.rows[key].hot}" and is not a documented narrower row`);
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
  for (const key of Object.keys(HOT_NARROWER)) assert.ok(FROST_FREE_CALENDAR_CITED.has(key), `${key}: a narrower-row note for a crop that is not cited`);
});

/** Crops with hot-area months and no published row for them. Each must say what it rests on. */
const HOT_UNCITED: Record<string, { borrows?: string; reason: string }> = {
  kale: { borrows: 'cabbage', reason: 'No table has a kale row; same species as cabbage, so its hot-area row is borrowed.' },
  coriander: { borrows: 'lettuce', reason: "No table has a coriander row; the entry's own rule is 'bolts in heat, same logic as lettuce'." },
  maize: { reason: "The table's 'Sweet corn' row is not applied to rain-fed grain maize." },
  groundnuts: { reason: 'Not a vegetable the table covers; no production-guideline month table was reachable.' },
  oats: { reason: 'A winter cover crop: the autumn window after the summer staple.' },
  cowpea: { reason: "DAFF's cowpea guideline: 'The optimum sowing times are December to January' — published, but not this table." },
  'sunn-hemp': { reason: 'A summer cover crop; no row.' },
  medic: { reason: 'A winter-rainfall pasture legume; no row.' },
};

test('a hot-area month with no published row is a named exception, and a borrowed row is exactly the row it borrows', () => {
  const uncited = CROPS.filter((crop) => crop.sowMonths['all-year'].length && !FROST_FREE_CALENDAR_CITED.has(crop.key)).map((crop) => crop.key);
  assert.deepEqual(uncited.sort(), Object.keys(HOT_UNCITED).sort(),
    'a crop gained or lost unsourced hot-area months: cite its row in FROST_FREE_CALENDAR_CITED or record why it has none');
  for (const [key, { borrows }] of Object.entries(HOT_UNCITED)) {
    if (!borrows) continue;
    assert.deepEqual([...monthsOf(key, 'all-year')].sort(), [...monthsOf(borrows, 'all-year')].sort(), `${key} must carry exactly ${borrows}'s hot-area months`);
    assert.ok(FROST_FREE_CALENDAR_CITED.has(borrows), `${key} borrows from ${borrows}, which must itself be a cited row`);
  }
});

test('the hot-area column closes midsummer for the cool-season crops, as its source does', () => {
  // The harm the audit found, stated as what a grower would see: lettuce, peas, cabbage and
  // broccoli offered for sowing in a Lowveld or Zululand December or January.
  for (const key of ['lettuce', 'peas', 'cabbage', 'broccoli', 'kale', 'coriander', 'true-spinach']) {
    const midsummer = [...monthsOf(key, 'all-year')].filter((m) => m === 12 || m === 1);
    assert.deepEqual(midsummer, [], `${key} must not be sown in a hot-area December or January`);
  }
});

// ── Warm areas, light frost: the 'mild-frost' column ───────────────────────

const WARM_EXCEPTIONS: Record<string, string> = {
  potato: "KZN's potato-specific bulletin (Aug-Oct plus January for cooler areas) is preferred over the table's 'Jun - Aug' cell; see the potato entry.",
};

test('no light-frost month lies outside its published warm-area row', () => {
  const wrong: string[] = [];
  for (const [key, row] of Object.entries(KZN.rows)) {
    const cell = readCell(row.warm);
    if (!cell || WARM_EXCEPTIONS[key]) continue;
    const extra = outside(monthsOf(key, 'mild-frost'), cell.wide);
    if (extra.length) wrong.push(`${key}: ${names(extra)} is outside the row "${row.warm}"`);
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
  for (const key of Object.keys(WARM_EXCEPTIONS)) {
    const cell = readCell(KZN.rows[key].warm)!;
    assert.ok(outside(monthsOf(key, 'mild-frost'), cell.wide).length, `${key}: the exception is no longer needed — remove it`);
  }
});

// ── Hard frost: the 'summer' column ────────────────────────────────────────

const INTERIOR_REGIONS = ['Highveld', 'Middleveld', 'Northern Cape and Great Karoo', 'KwaZulu-Natal Midlands'];

test('every hard-frost month is listed by the cold-area table or by the regional guide for an interior region', () => {
  // Peas in February and March, broccoli in March and August, broad beans in March, June and
  // July, potatoes in August: months on the interior calendar that neither table lists.
  const wrong: string[] = [];
  for (const crop of CROPS) {
    const cold = readCell(KZN.rows[crop.key]?.cold ?? null);
    const guide = SANSOR.rows[crop.key];
    if (!cold && !guide) continue;
    const supported = new Set<number>(cold ? cold.wide : []);
    if (guide) {
      for (const region of INTERIOR_REGIONS) readCell(guide.cells[SANSOR.regions.indexOf(region)])!.wide.forEach((m) => supported.add(m));
    }
    const extra = outside(new Set(crop.sowMonths.summer), supported);
    if (extra.length) wrong.push(`${crop.key}: ${names(extra)} is in no interior source`);
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
});

test('peas wait for the frost to pass in a hard-frost area', () => {
  // It is the flowers that frost kills. Seed sown in February flowers in April and May.
  assert.deepEqual([...monthsOf('peas', 'summer')].sort(), [7, 8, 9]);
});

// ── Winter rainfall: the 'winter' column ───────────────────────────────────

const CAPE = SANSOR.regions.indexOf('Western Cape and South Coast');

const CAPE_EXCEPTIONS: Record<string, string> = {
  tomatoes: "Starke Ayres' tomato guideline: 'Western Cape - Oct to Dec' for establishment, so October seed is inside a Western Cape source.",
  brinjal: "Starke Ayres' eggplant guideline: 'Western Cape - Oct to Dec'; the row is that window, not the regional guide's.",
};

test('no Western Cape month lies outside the regional guide\'s Western Cape row', () => {
  assert.ok(CAPE >= 0);
  const wrong: string[] = [];
  for (const [key, row] of Object.entries(SANSOR.rows)) {
    if (CAPE_EXCEPTIONS[key]) continue;
    const extra = outside(monthsOf(key, 'winter'), readCell(row.cells[CAPE])!.wide);
    if (extra.length) wrong.push(`${key}: ${names(extra)} is outside the row "${row.cells[CAPE]}"`);
  }
  assert.deepEqual(wrong, [], `\n  ${wrong.join('\n  ')}\n`);
  for (const key of Object.keys(CAPE_EXCEPTIONS)) {
    assert.ok(outside(monthsOf(key, 'winter'), readCell(SANSOR.rows[key].cells[CAPE])!.wide).length, `${key}: the exception is no longer needed — remove it`);
  }
});

test('a Western Cape row is the hard-frost row only where a Western Cape source says the same', () => {
  // Nine rows were copies made "by inference". A copy is allowed to survive only when the
  // Cape's own source gives those months, or when it is admitted to be borrowed.
  const SAME_BY_SOURCE: Record<string, string> = {
    tomatoes: 'Starke Ayres Western Cape window, overlapping the regional guide (see CAPE_EXCEPTIONS).',
    peppers: "The regional guide's Capsicum row is Aug-Oct for the Western Cape and for the Highveld.",
    chilli: "The regional guide's Capsicum row is Aug-Oct for the Western Cape and for the Highveld.",
    kale: 'BORROWED and said to be: no table has a kale row and no Western Cape source was found.',
    // Sourced from the Cape's own guide rows; the months coincide with the interior's.
    'gem-squash': "The regional guide's Western Cape squash row (Aug - Jan), opened from September for frost.",
    'baby-marrow': "The regional guide's Western Cape bush-squash row (Aug - Jan), opened from September for frost.",
    spanspek: "The regional guide's Western Cape sweet-melon row: Sept - Dec.",
    sweetcorn: "September to December: the months the regional guide and Starke Ayres' Western Cape window both give.",
  };
  const same = CROPS
    .filter((crop) => crop.sowMonths.winter.length && names(crop.sowMonths.winter) === names(crop.sowMonths.summer))
    .map((crop) => crop.key);
  assert.deepEqual(same.sort(), Object.keys(SAME_BY_SOURCE).sort(),
    'a Western Cape row became (or stopped being) identical to the hard-frost row: source it or record why');
});

test('cowpea can be scheduled in a warm area, in the month its national guide names', () => {
  // CP-082: the light-frost row was empty, so a grower in the warm areas could not plan cowpea.
  // Cowpeas Infopak: "In warmer areas the crop can be planted during the middle of December."
  assert.deepEqual([...monthsOf('cowpea', 'mild-frost')], [12]);
  const dossier = read('../research/crop-sources/cowpea.json');
  assert.deepEqual(dossier.sowMonths['mild-frost'].months, [12], 'the dossier must carry the month the catalogue offers');
  assert.match(dossier.sowMonths['mild-frost'].evidence[0].quote, /warmer areas.*middle of December/);
});

test('the Western Cape grows its peas and onions in its own season', () => {
  // Peas belong to the winter rain; onions bulb by day length and bolt from February seed.
  assert.deepEqual([...monthsOf('peas', 'winter')].sort((a, b) => a - b), [4, 5, 6, 7, 8]);
  assert.deepEqual([...monthsOf('onions', 'winter')].sort((a, b) => a - b), [4, 5]);
});
