import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { animalLineText, animalsNotShownNote, calendarProduceByMonth, flowRecordText, produceLanes, treeLineText, unmarkedAnimalLines, unmarkedLineText } from '@/lib/calendar-produce';
import { ANIMAL_ENTERPRISES, sourcedProductMonths } from '@/lib/animal-enterprises';
import { PERENNIAL_HARVEST, sourcedSeasonMonths } from '@/lib/perennial-harvest';
import { FRUIT_ART_SPECIES, speciesFruitArtworkUrl } from '@/lib/species-art';

const MONTHS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
const mango = PERENNIAL_HARVEST['mangifera-indica'];
const moringa = PERENNIAL_HARVEST['moringa-oleifera'];

test('every species with a harvest record has a fruit icon, and it is fruit art, not the tree', () => {
  assert.deepEqual([...FRUIT_ART_SPECIES].sort(), Object.keys(PERENNIAL_HARVEST).sort());
  for (const id of FRUIT_ART_SPECIES) {
    const url = speciesFruitArtworkUrl(id)!;
    assert.match(url, /^\/fruit-art\//, id);
    assert.ok(existsSync(join(process.cwd(), 'public', url)), `${url} is on disk`);
  }
  assert.equal(speciesFruitArtworkUrl('not-a-species'), null);
  assert.equal(speciesFruitArtworkUrl(null), null);
});

test('a tree shows only in its sourced months, with what it gives and how many are proposed', () => {
  const season = new Set(sourcedSeasonMonths(mango));
  const out = calendarProduceByMonth([{ harvest: mango, existing: 2, proposed: 1 }], [], {}, MONTHS);
  MONTHS.forEach((m, i) => {
    assert.equal(out[i].trees.length, season.has(m) ? 1 : 0, `month ${m}`);
  });
  const line = out.find((m) => m.trees.length)!.trees[0];
  assert.deepEqual({ standing: line.standing, proposed: line.proposed, product: line.product }, { standing: 2, proposed: 1, product: 'fruit' });
  assert.match(treeLineText(line), /^Mango — fruit · 3 plants on your map · 1 of them proposed/);
});

test('an all-proposed planting is said not to be cropping yet, never passed off as picking', () => {
  const out = calendarProduceByMonth([{ harvest: moringa, existing: 0, proposed: 4 }], [], {}, MONTHS);
  const line = out.find((m) => m.trees.length)!.trees[0];
  assert.equal(line.standing, 0);
  assert.equal(line.product, 'leaves and pods');
  assert.match(treeLineText(line), /proposed, not cropping yet/);
});

test('the month list keeps the product short: a parenthetical note stays on the tree card', () => {
  const marula = PERENNIAL_HARVEST['sclerocarya-birrea-subsp-caffra'];
  assert.match(marula.product, /\(/, 'the record still carries its note');
  const out = calendarProduceByMonth([{ harvest: marula, existing: 1, proposed: 0 }], [], {}, MONTHS);
  const line = out.find((m) => m.trees.length)?.trees[0];
  if (line) assert.equal(line.product, 'fruit');
});

test('a plant with no sourced month never appears', () => {
  const noSeason = Object.values(PERENNIAL_HARVEST).find((h) => sourcedSeasonMonths(h).length === 0);
  assert.ok(noSeason, 'the table still has at least one plant without a sourced season');
  const out = calendarProduceByMonth([{ harvest: noSeason!, existing: 5, proposed: 0 }], [], {}, MONTHS);
  assert.ok(out.every((m) => m.trees.length === 0));
});

test('animals give their product in its sourced months, only once the farmer says what the coop is for', () => {
  const layer = ANIMAL_ENTERPRISES['chicken-layer'];
  const season = new Set(sourcedProductMonths(layer));
  const groups = [{ housing: 'chicken' as const, existing: 1, proposed: 1 }];
  assert.ok(calendarProduceByMonth([], groups, {}, MONTHS).every((m) => m.animals.length === 0),
    'no enterprise chosen, nothing claimed');
  const out = calendarProduceByMonth([], groups, { chicken: 'chicken-layer' }, MONTHS);
  MONTHS.forEach((m, i) => assert.equal(out[i].animals.length, season.has(m) ? 1 : 0, `month ${m}`));
  const line = out.find((m) => m.animals.length)!.animals[0];
  assert.equal(line.product, 'eggs');
  assert.equal(animalLineText(line), `Eggs — ${layer.name} · 2 coops and tractors · 1 of them proposed`);
});

test('an animal that gives nothing in the calendar is explained, not silently missing', () => {
  const groups = [{ housing: 'bee' as const, existing: 2, proposed: 0 }, { housing: 'kraal' as const, existing: 1, proposed: 0 }];
  const bees = ANIMAL_ENTERPRISES.bees;
  const note = animalsNotShownNote(groups, { bee: 'bees' });
  // Honey has no months but is shown as its own line (see the honey test below), so it is not listed here.
  assert.ok(!note!.includes('honey'), note!);
  assert.match(note!, /say what it is for under Animals on your map: Kraal/);
  assert.equal(animalsNotShownNote([{ housing: 'chicken', existing: 1, proposed: 0 }], { chicken: 'chicken-layer' }), null);
});

test('the bed calendar carries the produce rows and hover card', () => {
  const page = readFileSync(join(process.cwd(), 'app/facilitator/crops/page.tsx'), 'utf8');
  assert.match(page, /<ProduceCalendarRow\s+kind="trees"/);
  assert.match(page, /<ProduceCalendarRow\s+kind="animals"/);
  assert.match(page, /role="tooltip"/);
  assert.doesNotMatch(page, /speciesPickerArtworkUrl\(tree\.speciesId\)/, 'the tray shows fruit, not tree art');
});

test('honey shows as a line with no month bar, with each recorded flow and its source', () => {
  // Rory, 2026-09-30, option 1: no month bar, "honey flows depend on local plants and rain", and
  // the verified Strelitzia 37 flow records in the hover.
  const bees = ANIMAL_ENTERPRISES.bees;
  const groups = [{ housing: 'bee' as const, existing: 2, proposed: 1 }];
  if (sourcedProductMonths(bees).length > 0) return; // a sourced season would chart normally
  assert.ok(calendarProduceByMonth([], groups, { bee: 'bees' }, MONTHS).every((m) => m.animals.length === 0),
    'no month is claimed for honey');
  const [line, ...rest] = unmarkedAnimalLines(groups, { bee: 'bees' });
  assert.equal(rest.length, 0);
  assert.equal(line.product, 'honey');
  assert.equal(unmarkedLineText(line), `Honey — ${bees.name} · 3 hives · 1 of them proposed`);
  assert.match(line.note!.text, /depend on local plants and rain/);
  assert.match(line.note!.source.quote, /primarily dependent on rainfall/);
  assert.ok(line.records.length >= 5);
  for (const r of line.records) {
    assert.ok(r.source.quote.length > 20 && /^https:\/\//.test(r.source.url) && r.source.page !== null, flowRecordText(r));
  }
  assert.ok(line.records.some((r) => flowRecordText(r) === 'Western Cape (Stellenbosch, Cape Peninsula): April–May, Blue gum (Eucalyptus globulus)'));
  assert.equal(animalsNotShownNote(groups, { bee: 'bees' }), null, 'honey is shown, so not listed as missing');
  assert.deepEqual(unmarkedAnimalLines(groups, {}), [], 'nothing until the farmer says the hive is for honey');
  const page = readFileSync(join(process.cwd(), 'app/facilitator/crops/page.tsx'), 'utf8');
  assert.match(page, /unmarked=\{animalsUnmarked\}/);
});

test('each tree kind is one lane of bars over its picking months, cut at year two', () => {
  const axis = [...MONTHS, ...MONTHS];
  const season = new Set(sourcedSeasonMonths(mango));
  const out = calendarProduceByMonth([{ harvest: mango, existing: 1, proposed: 0 }, { harvest: moringa, existing: 0, proposed: 2 }], [], {}, axis);
  const lanes = produceLanes(out, 'trees');
  assert.deepEqual(lanes.map((l) => l.key).sort(), ['mangifera-indica', 'moringa-oleifera']);
  const mangoLane = lanes.find((l) => l.key === 'mangifera-indica')!;
  const covered = new Set<number>();
  for (const run of mangoLane.runs) {
    assert.ok(run.start <= run.end);
    assert.ok(!(run.start < 12 && run.end >= 12), 'a bar ran across the year-two seam');
    for (let c = run.start; c <= run.end; c++) covered.add(c);
  }
  // Exactly the sourced months, in both years — no month added or dropped by the bars.
  axis.forEach((m, col) => assert.equal(covered.has(col), season.has(m), `column ${col} (month ${m})`));
  // Adjacent runs are merged: no two bars in a lane touch except across the seam.
  mangoLane.runs.slice(1).forEach((run, i) => {
    assert.ok(run.start > mangoLane.runs[i].end + 1 || run.start === 12, 'two touching bars were not merged');
  });
});
