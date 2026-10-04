import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCropPlanPdf, FARMER_SECTIONS, ALL_SECTIONS, type CropPlanPdfInput } from '@/lib/crop-export-pdf';
import { poultryGuidance } from '@/lib/animal-enterprises';
import type { ProductionGuide } from '@/lib/crop-export-schedule';

test('the picture calendar scopes local-date confirmation to fruit rather than claiming modelled vegetables were observed', async () => {
  const text = visibleText(await rawPdf({ sections: ['availability'], availability: { yearMode: 'fromToday', veg: [], forest: [], animals: [] } }));
  assert.ok(text.includes('Fruit, nuts and berries: solid marks are local dates.'));
  assert.ok(!text.includes('Solid marks: confirmed locally.'));
});

const guide: ProductionGuide = {
  area: 'Research fixture climate',
  siteObservations: [{ title: 'Observed frost', lines: ['Farmer reports frost in June.'] }],
  recordedProduction: [{ title: 'Eggs', lines: ['Farmer-reported annual total for 2025: 240 eggs.', 'These are survey observations, not a new production forecast.'] }],
  cropChoices: [{ title: 'Carrots', lines: ['Recorded variety: Chosen fixture variety.', 'Research shortlist for similar climates: Reference fixture variety.'], sources: [{ label: 'Provincial source, p. 12', url: 'https://www.arc.agric.za/' }] }],
};

function input(extra: Partial<CropPlanPdfInput> = {}): CropPlanPdfInput {
  return {
    plantings: [], beds: [], tasks: [],
    now: new Date('2026-10-02T08:00:00Z'),
    meta: { planTitle: 'Print fixture', siteLine: 'Fixture location', locationLine: 'Fixture location', climateLine: '', bedsSummary: 'No beds', dateLabel: '2 October 2026', estimatedKgPerYear: null, lossPercent: 25 },
    ...extra,
  };
}
const rawPdf = async (extra: Partial<CropPlanPdfInput>) => Buffer.from(await (await buildCropPlanPdf(input(extra))).arrayBuffer()).toString('latin1');
// Wrapping changes PDF drawing commands, not the farmer's sentence. Inspect visible text
// across drawing runs so a line break can neither masquerade as truncation nor hide it.
const visibleText = (raw: string) => [...raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
  .map((match) => match[1].replace(/\\([\\()])/g, '$1')).join(' ');

test('the farmer and reference copies retain the shared farm guide, past-year records and clickable sources', async () => {
  assert.ok(FARMER_SECTIONS.includes('guidance'));
  assert.ok(ALL_SECTIONS.includes('guidance'));
  const raw = await rawPdf({ sections: ['guidance'], productionGuide: guide, poultryGuidance: poultryGuidance({ purpose: 'both', recordedBreed: 'Farmer fixture birds', layingHens: 3 }, { frost: 'yes' }) });
  const text = visibleText(raw);
  for (const phrase of ['Before you buy or start', 'Farmer reports frost in June.', 'annual total for 2025: 240 eggs.', 'not a new production forecast.', 'Recorded variety: Chosen fixture variety.', 'Research shortlist for similar climates:', 'Provincial source, p. 12', 'Farmer fixture birds', 'Potchefstroom Koekoek', 'promises no output or dates.']) {
    assert.ok(text.includes(phrase), `the shared guide lost ${phrase}`);
  }
  assert.ok(raw.includes('/Subtype /Link'));
  assert.ok(raw.includes('/URI (https://www.arc.agric.za/)'));
  assert.ok(!raw.includes('(https://www.arc.agric.za/) Tj'), 'raw URLs must not crowd the printed source labels');
});

test('long guidance keeps the final crop and repeats its page context instead of truncating at a page break', async () => {
  const fat: ProductionGuide = {
    ...guide,
    cropChoices: Array.from({ length: 30 }, (_, index) => ({
      title: `Crop reference ${index + 1}`,
      lines: [`Recorded variety ${index + 1}. ` + 'A long source-grounded review note that needs several wrapped lines before the farmer buys planting material. '.repeat(3)],
      sources: [{ label: `Official source ${index + 1}, p. 8`, url: 'https://www.arc.agric.za/' }],
    })),
  };
  const raw = await rawPdf({ sections: ['guidance'], productionGuide: fat });
  assert.ok(raw.includes('Farm choices - continued'));
  assert.ok(raw.includes('Crop varieties to check locally \\(continued\\)'));
  assert.ok(raw.includes('Official source 30, p. 8'), 'the last source was silently dropped');
});

test('identically labelled beds do not inherit another bed’s overlap warning and exact sowing rows retain named varieties', async () => {
  const raw = await rawPdf({
    sections: ['calendar'],
    beds: [{ id: 'conflict', label: 'Twin bed', kind: 'bed', areaM2: 10 }, { id: 'safe', label: 'Twin bed', kind: 'bed', areaM2: 10 }],
    plantings: [{ id: 'overbooked', bedId: 'conflict', cropKey: 'carrots', sowMonth: 10, areaFraction: 2, variety: 'Farmer chosen fixture variety' }, { id: 'okay', bedId: 'safe', cropKey: 'carrots', sowMonth: 10, areaFraction: 1 / 3 }],
  });
  assert.equal(raw.match(/CHECK SPACE/g)?.length, 1, 'the second bed was flagged just because its name matched');
  assert.ok(raw.includes('Variety: Farmer chosen'), 'the chosen variety disappeared from its actual sowing row');
  assert.ok(raw.includes('fixture variety'), 'wrapping discarded the variety name');
  assert.ok(raw.includes('200% area - sow Oct 2026'), 'variety text displaced the allocation or sowing year');
});

test('monthly field sheets use only the first twelve confirmed local slots, with undated care kept separate', async () => {
  const forest = Array.from({ length: 13 }, () => [] as { iconKey: string; label: string }[]);
  const animals = Array.from({ length: 13 }, () => [] as { iconKey: string; label: string }[]);
  forest[1] = [{ iconKey: 'tree:avocado', label: 'Confirmed avocado' }];
  animals[4] = [{ iconKey: 'animal:chicken-indigenous', label: 'Confirmed eggs' }];
  forest[12] = [{ iconKey: 'tree:banana', label: 'Beyond year banana' }];
  const raw = await rawPdf({ sections: ['fieldsheets'], availability: {
    yearMode: 'fromToday', forest, animals,
    undated: [{ iconKey: 'element:banana_circle', label: 'Unconfirmed Banana Circle', detail: 'Species and local picking dates are not yet known.' }],
  } });
  const text = visibleText(raw);
  assert.ok(text.includes('October 2026 field sheet'));
  assert.ok(text.includes('November 2026 field sheet'));
  assert.ok(text.includes('February 2027 field sheet'));
  assert.ok(text.includes('Pick Confirmed avocado when ready'));
  assert.ok(text.includes('Confirmed eggs: record actual production'));
  assert.ok(text.includes('Care and establishment - dates to confirm'));
  assert.ok(text.includes('Undated reminders, not scheduled harvests.'));
  assert.equal(text.match(/Unconfirmed Banana Circle/g)?.length, 1, 'undated inventory turned into twelve scheduled jobs');
  assert.ok(!text.includes('Beyond year banana'), 'a future anniversary leaked into this dated year');
  assert.ok(!text.includes('October 2027 field sheet'));
});

test('absence of locally confirmed products does not invent picking jobs on field sheets', async () => {
  const raw = await rawPdf({ sections: ['fieldsheets'], availability: { undated: [{ iconKey: 'animal:chicken-indigenous', label: 'Unchosen coop', detail: 'Choose enterprise and confirm local production months.' }] } });
  assert.ok(raw.includes('Unchosen coop'));
  assert.ok(!raw.includes('Fruit, berries and animal products - record'));
  assert.ok(!raw.includes('Pick '));
});

test('the paper shows the same assumed cultivar season with twelve months and a clear established-production qualifier', async () => {
  const pdf = await rawPdf({ sections: ['guidance'], productionGuide: {
    ...guide, foodForest: [{ title: 'Avocado', lines: ['Assumed variety: Hass. Expected when established; not a confirmed crop this year.'], expectedSeason: { label: 'Assumed variety: Hass', months: [6, 7, 8, 9, 10], basis: 'Warm subtropical reference' }, sources: [{ label: 'DAFF avocado guide', url: 'https://www.avocadosource.com/international/south_africa_papers/cultivation_of_avocados.pdf' }] }],
    animalProducts: [{ title: 'Hives: choose the product', lines: ['No animal count or production dates assumed.'] }],
  } });
  const text = visibleText(pdf);
  assert.match(text, /Fruit, nuts and indigenous foods/);
  assert.match(text, /Assumed variety: Hass/);
  assert.match(text, /expected when established/);
  assert.match(text, /not a confirmed crop this year/);
  for (const month of ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']) assert.ok(text.includes(month), month);
  assert.match(text, /Animal products and care/);
  assert.match(pdf, /\/URI \(https:\/\/www.avocadosource.com/);
});


test('the picture calendar distinguishes regional references and never turns them into picking jobs', async () => {
  const planning = { label: 'Assumed variety: Hass', months: [6, 7, 8, 9, 10], basis: 'Warm source reference when established; confirm local dates.', source: { label: 'Fixture primary reference', url: 'https://www.arc.agric.za/' } };
  const slots = Array.from({ length: 12 }, (_, i) => planning.months.includes(((9 + i) % 12) + 1) ? [{ iconKey: 'tree:persea-americana', label: 'Avocado', planning }] : []);
  const raw = await rawPdf({ sections: ['availability', 'fieldsheets'], availability: { forestPlanning: slots } });
  const text = visibleText(raw);
  for (const phrase of ['Outlined marks', 'Plan: Hass', 'When established', 'Why these months are marked', 'Fixture primary reference']) assert.ok(text.includes(phrase), phrase);
  assert.ok(raw.includes('/URI (https://www.arc.agric.za/)'));
  assert.ok(!text.includes('Pick Avocado'), 'reference windows must not instruct a farmer to harvest an unconfirmed crop');
  const hidden = await rawPdf({ sections: ['availability'], availability: { forestPlanning: slots, includeTrees: false } });
  assert.ok(!visibleText(hidden).includes('Avocado'));
});
