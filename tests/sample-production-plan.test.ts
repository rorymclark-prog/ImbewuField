import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompleteProductionExample } from '../lib/sample-production-plan.ts';
import { cropByKey, type RainPattern } from '../lib/crop-catalog.ts';
import {
  benchmarkAreaConflictBedLabels, benchmarkDatedAreaConflictBedLabels,
  buildFoodAvailability, occupiedMonthsForPlanting, tasksForPlan,
} from '../lib/crop-plan.ts';
import { autoSuggestPlan, observedFrostConflicts, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { climateGateFrom, judgeFieldMonths } from '../lib/crop-climate-gate.ts';
import { GROWING_ZONE_IDS, growingZonesForClimate, type GrowingZoneId } from '../lib/growing-zones.ts';
import { siteClimateFromLocationData } from '../lib/site-climate.ts';
import { ANIMAL_ENTERPRISES, buildAnimalAvailability } from '../lib/animal-enterprises.ts';
import { buildTreeAvailability, formatMonthSpan } from '../lib/perennial-harvest.ts';
import { assumedProductSeason, buildProductGuidance, planningTreeSeasons } from '../lib/production-product-guidance.ts';
import { plantingMonthIndex, treeAgeProjection } from '../lib/production-projection.ts';
import { buildCropPlanPdf } from '../lib/crop-export-pdf.ts';
import pigeonPeaResearch from '../research/crop-sources/pigeon-pea.json' with { type: 'json' };

const visibleText = (raw: string) => [...raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
  .map(match => match[1].replace(/\\([\\()])/g, '$1')).join(' ');

test('the standalone example cannot read or replace a farmer account or saved sample storage', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    get localStorage() { throw new Error('A fictional example must not use saved farm storage'); },
    get sessionStorage() { throw new Error('A fictional example must not change global sample mode'); },
  } });
  try {
    const a = buildCompleteProductionExample();
    const b = buildCompleteProductionExample();
    assert.deepEqual(a, b, 'the same scenario must be independent of account, storage and device date');
    assert.equal(a.now.getFullYear(), 2026);
    assert.equal(a.now.getMonth(), 10);
    assert.equal(a.input.now, a.now, 'the PDF must share the sample axis instead of silently using today');
    assert.deepEqual(a.dates[0], { year: 2026, month: 11 });
    assert.deepEqual(a.dates[11], { year: 2027, month: 10 });
    assert.equal(a.months.length, 12);
    assert.equal(new Set(a.months).size, 12);
    a.input.plantings[0].sowMonth = 12;
    a.treeSeasons['musa-acuminata-aaa-group']!.months.push(1);
    assert.deepEqual(buildCompleteProductionExample(), b, 'one viewer must not mutate the next example');
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('the example contains crops, fruit, nuts, berries, eggs, milk, honey, fish and the requested rabbit and duck meat', () => {
  const e = buildCompleteProductionExample();
  const crops = new Set(e.input.plantings.map(p => p.cropKey));
  for (const key of ['swiss-chard', 'cabbage', 'carrots', 'onions', 'tomatoes', 'green-beans',
    'maize', 'dry-beans', 'groundnuts', 'sweet-potato', 'amadumbe', 'pumpkin', 'butternut']) {
    assert.ok(crops.has(key), `${key} is missing from the actual plan`);
  }
  const species = new Set(e.trees.map(g => g.harvest.speciesId));
  for (const id of ['persea-americana', 'musa-acuminata-aaa-group', 'carica-papaya',
    'mangifera-indica', 'litchi-chinensis', 'citrus-limon', 'macadamia-integrifolia',
    'fragaria-x-ananassa', 'syzygium-cordatum', 'moringa-oleifera', 'cajanus-cajan']) assert.ok(species.has(id), `${id} missing`);
  const products = new Set(Object.values(e.animalChoices).map(id => ANIMAL_ENTERPRISES[id!].product));
  assert.deepEqual(products, new Set(['eggs', 'milk', 'honey', 'fish', 'meat']),
    'adding the requested rabbit and duck enterprises must actually include meat in the plan');
  assert.equal(e.animalChoices.rabbit, 'rabbit');
  assert.equal(e.animalChoices.duck, 'duck');
  assert.equal(e.farmZones.flatMap(z => z.bedIds).length, e.input.beds.length);
  assert.equal(new Set(e.farmZones.flatMap(z => z.bedIds)).size, e.input.beds.length);
  assert.ok(e.input.productionGuide!.foodForest!.every(item => item.sources?.length), 'tree advice must retain primary-source references');
  assert.ok(e.input.productionGuide!.animalProducts!.every(item => item.sources?.length), 'animal care qualifiers must keep their sources');
});

test('peanuts retain the existing crop name while mapped pigeon pea and moringa cannot invent timed food or kilograms', () => {
  const e = buildCompleteProductionExample();
  const peanuts = cropByKey('groundnuts')!;
  assert.match(peanuts.name, /groundnuts.*peanuts/i);
  assert.equal(e.input.plantings.filter(row => row.cropKey === peanuts.key).length, 1,
    'a peanut alias must not duplicate the same groundnut crop, food count or ground area');
  assert.match(e.farmZones.find(zone => zone.id === 'staples')!.description, /groundnuts \(peanuts\)/i);
  assert.equal(cropByKey('pigeon-pea'), undefined,
    'verified trial grain and maturity references must not silently become a generic timed annual crop');
  assert.equal(e.input.plantings.length, 13);
  assert.equal(e.input.beds.reduce((sum, bed) => sum + bed.areaM2, 0), 820,
    'mapped shrubs and trees cannot fabricate annual-crop ground or affect its yield denominator');
  const pigeon = e.trees.find(group => group.harvest.speciesId === 'cajanus-cajan')!;
  const moringa = e.trees.find(group => group.harvest.speciesId === 'moringa-oleifera')!;
  assert.equal(e.trees.length, 11);
  // The completed SA grain trials supply evidence, while local picking and plant kg stay unknown.
  assert.notEqual(pigeon.referenceMissing, true, 'available grain-trial evidence must not carry the optional missing-reference flag');
  assert.ok(pigeon.harvest.supplementaryReferences?.some(reference => /ICPL 88039 127 \/ 1823/.test(reference.note)));
  assert.deepEqual(pigeon.harvest.windows, []);
  assert.equal(pigeon.harvest.yearsToFirstCrop, null);
  // The source dates pod development; tender green food-pod picking is a different stage.
  assert.deepEqual(moringa.harvest.windows, [], 'March–April phenology cannot become a ripe or young-pod picking bar');
  const podDevelopment = moringa.harvest.supplementaryReferences?.find(reference => /Pod development/.test(reference.title));
  assert.ok(podDevelopment, 'withdrawn picking bars must retain the actual botanical observation as guidance');
  assert.match(podDevelopment.source.quote, /March and April/);
  assert.match(podDevelopment.note, /young, tender, green pods.*no calendar/i);
  for (const group of [pigeon, moringa]) {
    assert.deepEqual([group.existing, group.proposed], [2, 1]);
    assert.deepEqual(e.treeSeasons[group.harvest.speciesId]!.months, []);
    assert.equal(assumedProductSeason(group, e.zones, e.conditions), undefined,
      'a mapped source or out-of-region reference cannot become a local KZN season');
    assert.ok(!e.planningTrees.some(row => row.speciesId === group.harvest.speciesId));
    assert.ok(e.input.availability!.undated!.some(row => row.iconKey === `tree:${group.harvest.speciesId}`),
      'unknown picking dates must leave an identifiable food-source calendar row');
    assert.ok(e.input.availability!.forest!.flat().every(row => row.iconKey !== `tree:${group.harvest.speciesId}`));
    assert.ok(e.input.availability!.forestPlanning!.flat().every(row => row.iconKey !== `tree:${group.harvest.speciesId}`));
    assert.ok(e.input.productionProjection!.years.every(year => year.trees
      .filter(row => row.speciesId === group.harvest.speciesId).every(row => row.kg === null)),
    'the incomplete harvest references cannot make food-production kg curves');
  }
  const observation = e.input.productionGuide!.siteObservations.find(row => row.title.startsWith(pigeon.harvest.name))!;
  assert.match(observation.lines.join(' '), /reference only.*not a confirmed local sowing or picking record/i);
  assert.ok(observation.lines[0].includes(formatMonthSpan(pigeonPeaResearch.sowMonths['all-year'].months)));
  assert.equal(observation.sources![0].url, pigeonPeaResearch.sowMonths['all-year'].evidence[0].url);
  const moringaGuide = e.input.productionGuide!.foodForest!.find(row => row.title === moringa.harvest.name)!;
  assert.ok(moringaGuide.lines.some(line => /Pod development, not a young green-pod picking calendar/i.test(line)));
  assert.ok(moringaGuide.lines.some(line => /first-crop age above is for leaves, not pods/i.test(line)));
  assert.ok(moringaGuide.lines.some(line => /not an established picking calendar for this KZN example/i.test(line)));
});

test('the example app and printed guide retain every pigeon-pea research citation alongside its distinct sowing note', async () => {
  const e = buildCompleteProductionExample();
  const pigeon = e.trees.find(group => group.harvest.speciesId === 'cajanus-cajan')!;
  const guide = e.input.productionGuide!.foodForest!.find(item => item.title === pigeon.harvest.name)!;
  const sharedGuide = buildProductGuidance({ trees: [pigeon], animals: [], animalChoices: {} }, e.zones, e.conditions).foodForest[0];
  assert.ok(sharedGuide.sources!.length > 1, 'the verified trials and harvest-stage reference must reach shared guidance');
  for (const source of sharedGuide.sources!) {
    assert.ok(guide.sources!.some(row => row.url === source.url && row.label === source.label),
      `${source.label}: adding a sample sowing note must not replace shared source evidence`);
  }
  const supplementalURLs = pigeon.harvest.supplementaryReferences!.map(reference => reference.source.url);
  for (const url of supplementalURLs) assert.ok(guide.sources!.some(source => source.url === url));
  const sowing = pigeonPeaResearch.sowMonths['all-year'].evidence[0];
  const sowingSource = { label: `${sowing.doc}, p. ${sowing.page}`, url: sowing.url };
  assert.equal(guide.sources!.filter(source => source.url === sowingSource.url && source.label === sowingSource.label).length, 1,
    'a sample-only sowing reference is added once without merging different page citations');
  assert.equal(new Set(guide.sources!.map(source => `${source.url}|${source.label}`)).size, guide.sources!.length);
  const observation = e.input.productionGuide!.siteObservations.find(item => item.title.startsWith(pigeon.harvest.name))!;
  assert.deepEqual(observation.sources, [sowingSource], 'the sowing observation cites its own DAFF claim rather than borrowing grain-trial citations');
  const samplePage = readFileSync(new URL('../app/samples/production/page.tsx', import.meta.url), 'utf8');
  assert.match(samplePage, /farm\.input\.productionGuide\?\.foodForest/);
  assert.match(samplePage, /guide\.sources\?\.map/, 'the app must render the same guide citations passed to the PDF');
  const blob = await buildCropPlanPdf({ ...e.input, sections: ['guidance'] });
  const printed = Buffer.from(await blob.arrayBuffer()).toString('latin1');
  for (const url of [...supplementalURLs, sowingSource.url]) assert.ok(printed.includes(url), `${url}: the actual PDF must retain its clickable source`);
});

test('the first dated year and all future repeating crop cycles have separate adequate ground and valid catalogue sowings', () => {
  const e = buildCompleteProductionExample();
  assert.equal(new Set(e.input.plantings.map(p => p.bedId)).size, e.input.plantings.length);
  for (const p of e.input.plantings) {
    const crop = cropByKey(p.cropKey)!;
    const bed = e.input.beds.find(b => b.id === p.bedId)!;
    assert.ok(bed && bed.areaM2 > 0 && bed.minDimM! > 0);
    const rowSpacing = crop.rowSpacingRangeCm?.[1] ?? crop.rowSpacingCm;
    if (rowSpacing) assert.ok(bed.minDimM! >= rowSpacing / 100, `${crop.name} must fit its sourced row width`);
    assert.ok(crop.sowMonths[e.input.meta.rainPattern!].includes(p.sowMonth), `${crop.name} has an out-of-window sowing`);
    assert.notEqual(crop.timingVerified, false, `${crop.name} needs sourced timing before joining this example`);
    assert.equal(p.existing, undefined, 'unobserved example sowings must remain plans');
    assert.equal(p.once, undefined, 'this demonstrates repeating annual crop cycles');
  }
  assert.deepEqual(benchmarkAreaConflictBedLabels(e.input.plantings, e.input.beds), []);
  const start = e.now.getFullYear() * 12 + e.now.getMonth();
  assert.deepEqual(benchmarkDatedAreaConflictBedLabels(e.input.plantings, e.input.beds, {
    startIndex: start, endIndex: start + 119, originIndex: start,
  }), [], 'long-duration staple plots must not double-book later annual cycles');
  assert.deepEqual(e.input.tasks, tasksForPlan(e.input.plantings, e.input.beds, 11));
  assert.deepEqual(e.input.availability!.veg, buildFoodAvailability(e.input.plantings, e.input.beds, 11, 12));
  assert.ok(e.input.availability!.veg.flat().some(item => item.status === 'fresh'));
  assert.ok(e.input.availability!.veg.flat().some(item => item.status === 'stored'), 'the example must distinguish stored staples from picking');
  assert.ok(e.input.productionProjection!.years.every(y => y.vegetableKg !== null));
  const taro = cropByKey('amadumbe')!;
  assert.ok(e.input.productionProjection!.years.every(y => y.vegetableMissing.includes(taro.name)),
    'Amadumbe belongs in the plan but must stay outside the known kg subtotal until a verified benchmark exists');
});

test('research fruit windows remain references and only clearly fictional records supply local banana and animal dates', () => {
  const e = buildCompleteProductionExample();
  assert.match(e.input.meta.climateLine, /assumed/i);
  assert.match(e.input.meta.climateLine, /catalogue.*all-year/i);
  assert.match(e.fictionNotice, /no live climate data is fetched/i);
  assert.match(e.input.meta.documentNotice!, /FICTIONAL EXAMPLE.*banana.*animal.*preserved-stock months/);
  const banana = e.trees.find(g => g.harvest.speciesId === 'musa-acuminata-aaa-group')!;
  assert.equal(banana.existing, 3);
  assert.equal(banana.proposed, 3);
  assert.equal(assumedProductSeason(banana, e.zones, e.conditions), undefined, 'invented banana dates must not become a researched window');
  assert.ok(!e.planningTrees.some(g => g.speciesId === banana.harvest.speciesId));
  assert.deepEqual(e.treeSeasons[banana.harvest.speciesId]!.months, [2, 6, 10], 'three standing bananas must not imply continuous picking');
  for (const tree of e.planningTrees) {
    const group = e.trees.find(g => g.harvest.speciesId === tree.speciesId)!;
    assert.deepEqual(tree.season, assumedProductSeason(group, e.zones, e.conditions));
    assert.ok(tree.season.source?.url, `${tree.name} reference needs its source`);
    assert.deepEqual(e.treeSeasons[tree.speciesId]!.months, []);
    assert.equal(e.treeSeasons[tree.speciesId]!.bearing, false);
  }
  const strawberry = e.planningTrees.find(g => g.speciesId === 'fragaria-x-ananassa')!;
  assert.deepEqual(strawberry.season.months, [5, 6, 7, 8], 'use the researched frost-free KZN berry window, not a cooler-region union');
  assert.ok(e.fictionalRecords.every(row => row.provenance === 'fictional-example' && row.explanation.includes('Invented')));
  const observedTrees = buildTreeAvailability(e.trees, e.months, true, e.treeSeasons);
  assert.ok(observedTrees.flat().every(t => t.speciesId === banana.harvest.speciesId && t.trees === 3));
  assert.ok(e.input.availability!.forestPlanning!.flat().every(t => t.planning?.source?.url));
  const observedAnimals = buildAnimalAvailability(e.animals, e.animalChoices, e.months, true, e.animalSeasons);
  assert.deepEqual(new Set(observedAnimals.flat().map(a => a.product)), new Set(['eggs', 'milk', 'honey', 'fish', 'meat']));
  for (const enterpriseId of ['rabbit', 'duck']) {
    assert.deepEqual(ANIMAL_ENTERPRISES[enterpriseId].windows, [], 'unsourced national meat-production months must remain absent');
    assert.ok(observedAnimals.flat().some(a => a.enterpriseId === enterpriseId && a.product === 'meat'));
    const guide = e.input.productionGuide!.animalProducts!.find(item => item.title.includes(ANIMAL_ENTERPRISES[enterpriseId].name))!;
    assert.ok(guide.sources?.length, `${enterpriseId} care advice must retain its primary sources`);
    assert.ok(guide.lines.some(line => line.includes('No animal head count or output is assumed')));
  }
  assert.deepEqual(buildAnimalAvailability(e.animals, e.animalChoices, e.months, true, {}), e.months.map(() => []), 'housing and source commercial ranges alone must never create local products');
  for (const group of e.animals) {
    const choice = e.animalSeasons[group.housing]!;
    const record = e.fictionalRecords.find(row => row.iconKey === `animal:${choice.enterpriseId}`)!;
    assert.deepEqual(choice.months, record.months);
  }
});

test('older and proposed plant ages are complete but cannot invent tree kilograms or animal totals', () => {
  const e = buildCompleteProductionExample();
  const start = e.now.getFullYear() * 12 + e.now.getMonth();
  for (const tree of e.trees) {
    const ages = e.treeSeasons[tree.harvest.speciesId]!.production!;
    assert.equal(ages.filter(c => c.status === 'existing').reduce((n, c) => n + c.plants, 0), tree.existing);
    assert.equal(ages.filter(c => c.status === 'proposed').reduce((n, c) => n + c.plants, 0), tree.proposed);
    assert.ok(ages.every(c => c.yields.length === 0), 'research mature yields must not be copied into farm age curves');
    assert.ok(ages.filter(c => c.status === 'existing').every(c => plantingMonthIndex(c.planted)! <= start));
    assert.ok(ages.filter(c => c.status === 'proposed').every(c => c.planted === '2026-11'));
  }
  assert.ok(e.input.productionProjection!.years.every(year => year.partial && year.trees.every(tree => tree.kg === null)), 'mature farm kg stay unknown without yield records');
  const macadamia = e.trees.find(g => g.harvest.speciesId === 'macadamia-integrifolia')!;
  const youngChoice = { ...e.treeSeasons[macadamia.harvest.speciesId]!, production: e.treeSeasons[macadamia.harvest.speciesId]!.production!.filter(c => c.status === 'proposed') };
  const young = { ...macadamia, existing: 0 };
  assert.deepEqual(treeAgeProjection(young, youngChoice, start, start + 11).kg, [0, 0], 'new nuts cannot inherit an established orchard harvest');
  assert.equal(treeAgeProjection(young, youngChoice, start + 60, start + 71).kg, null, 'reaching a researched first-crop age still needs an actual kg schedule');
  assert.match(e.input.productionProjection!.assumptions.join(' '), /Eggs, meat, milk, fish and honey are not included/);
  assert.ok(e.input.poultryGuidance!.recordedLayingHens === null, 'a structure count must not become a flock count');
});

test('preserved products are separate dated fictional stock records, not invented safe shelf lives or extra harvests', () => {
  const e = buildCompleteProductionExample();
  const vegetableSlots = e.input.availability?.veg;
  const forestSlots = e.input.availability?.forest;
  assert.ok(vegetableSlots, 'the example must supply its dated vegetable ingredient rows');
  assert.ok(forestSlots, 'the example must supply its fictional local banana ingredient rows');
  assert.deepEqual(new Set(e.preservedProducts.map(row => row.method)),
    new Set(['frozen', 'dried', 'fermented', 'processed', 'stored']));
  assert.equal(e.preservedProducts.length, 6,
    'the requested dried mango and stored nuts must join the four original processing examples');
  assert.ok(e.input.preservedProducts, 'the same explicit stock records must reach the printed plan');
  assert.deepEqual(e.input.preservedProducts, e.preservedProducts);
  assert.ok(e.input.sections!.includes('availabilityGraphs'), 'the full example must include its food-availability graphs');
  assert.equal(new Set(e.preservedProducts.map(row => row.id)).size, e.preservedProducts.length);
  const wanted = [
    ['crop:green-beans', 1, 3], ['tree:musa-acuminata-aaa-group', 6, 8],
    ['crop:cabbage', 8, 10], ['crop:tomatoes', 5, 8],
  ] as const;
  for (const [key, first, last] of wanted) {
    const record = e.preservedProducts.find(row => row.sourceIconKey === key)!;
    assert.ok(record, `${key} needs its own identifiable processed-stock record`);
    assert.equal(record.provenance, 'fictional-example');
    assert.deepEqual(record.dates, Array.from({ length: last - first + 1 }, (_, i) => ({ year: 2027, month: first + i })),
      'these stock dates belong to 2027; they must not recur every named month in future years');
    assert.match(record.note, /invented stock months/i);
    assert.match(record.note, /not a safe shelf life/i);
    assert.match(record.note, /amount.*not supplied/i);
    assert.ok(!('kg' in record) && !('quantity' in record) && !('expiry' in record),
      'invented stock months cannot supply amounts, conversion yields or a safe expiry');
    assert.equal(record.quantities, undefined, 'example stock dates must leave exact-month kilograms unrecorded');
    const firstSlot = e.dates.findIndex(date => date.year === 2027 && date.month === first);
    assert.ok(firstSlot >= 0, 'each preserved-stock record must start within the dated example');
    if (key.startsWith('crop:')) {
      const cropKey = key.slice(5);
      const sourceRows = vegetableSlots[firstSlot];
      assert.ok(sourceRows, 'the corresponding ingredient slot must exist');
      assert.ok(sourceRows.some(row => row.cropKey === cropKey && row.status === 'fresh'),
        'the illustrative processing start must not precede this scenario\'s picking month');
    } else {
      assert.ok(forestSlots[firstSlot].some(row => row.iconKey === key),
        'dried bananas need the separately labelled fictional local banana record');
    }
  }
  assert.match(e.fictionNotice, /preserved-stock months are also invented/i);
  assert.match(e.fictionNotice, /no safe shelf life or processing recipe is supplied/i);
  // The local example editor permits explicit made-up figures, while its starting amounts
  // remain unanswered and stock dates or tree ages cannot manufacture a quantity.
  assert.match(e.fictionNotice, /default tree, animal and stock amounts are not supplied/i);
  assert.match(e.fictionNotice, /no quantities are inferred from plant ages, structures or stock months/i);
  assert.match(e.fictionNotice, /any figures entered here are fictional example records/i);
  assert.deepEqual(e.input.availability!.veg, buildFoodAvailability(e.input.plantings, e.input.beds, 11, 12),
    'processing examples must not extend the sourced raw-crop availability');
});

test('bought or carried mango and nuts do not manufacture local harvests, safe storage durations or kilograms', () => {
  const e = buildCompleteProductionExample();
  const wanted = [
    ['example-dried-mango', 'tree:mangifera-indica', 'dried', 3, 5],
    ['example-stored-macadamia', 'tree:macadamia-integrifolia', 'stored', 8, 10],
  ] as const;
  for (const [id, iconKey, method, first, last] of wanted) {
    const record = e.preservedProducts.find(row => row.id === id);
    assert.ok(record, `${id} must be an identifiable stock record`);
    assert.equal(record.sourceIconKey, iconKey);
    assert.equal(record.method, method);
    assert.equal(record.provenance, 'fictional-example');
    assert.deepEqual(record.dates, Array.from({ length: last - first + 1 }, (_, i) => ({ year: 2027, month: first + i })));
    assert.match(record.note, /made-up bought or carried/i);
    assert.match(record.note, /no harvest.*claimed/i);
    assert.match(record.note, /not a safe shelf life/i);
    assert.match(record.note, /amount.*not supplied/i);
    assert.ok(!('kg' in record) && !('quantity' in record) && !('expiry' in record));
    assert.equal(record.quantities, undefined, 'bought/carried example stock has no farmer-entered kg record');
    const speciesId = iconKey.slice(5);
    assert.deepEqual(e.treeSeasons[speciesId]!.months, [], 'regional reference dates must stay separate from an observed tree harvest');
    assert.ok(e.input.availability!.forest!.flat().every(row => row.iconKey !== iconKey),
      'bought stock must not put this tree into the local picking calendar');
    assert.ok(e.input.productionProjection!.years.every(year => year.trees
      .filter(tree => tree.speciesId === speciesId).every(tree => tree.kg === null)),
    'stock dates and tree reference seasons cannot create farm output kilograms');
  }
  assert.match(e.fictionNotice, /dried mango and stored nuts.*bought or carried stock/i);
});

// Synthetic parser/planner cases, not fetched normals or new agronomic guidance. The seasonal
// shapes and temperature endpoints reuse tests/sa-rain-pattern.test.ts and growing-zones.test.ts.
// The Cfb case recombines their existing mild endpoints/bimodal shape to cover Southern Cape.
const summerRain = (annual: number) => [0.15, 0.13, 0.11, 0.06, 0.03, 0.01, 0.01, 0.02, 0.05, 0.10, 0.14, 0.19].map(weight => weight * annual);
const winterRain = (annual: number) => [0.02, 0.03, 0.04, 0.09, 0.14, 0.17, 0.16, 0.14, 0.10, 0.06, 0.03, 0.02].map(weight => weight * annual);
const bimodalRain = (annual: number) => [0.08, 0.08, 0.11, 0.10, 0.07, 0.05, 0.05, 0.06, 0.08, 0.11, 0.11, 0.10].map(weight => weight * annual);
const temperatures = (coldest: number, hottest: number) => Array.from({ length: 12 }, (_, month) =>
  Math.round(((coldest + hottest) / 2 + (hottest - coldest) / 2 * Math.cos(2 * Math.PI * month / 12)) * 10) / 10);
interface RegionalPlannerCase {
  zone: GrowingZoneId;
  lat: number;
  temp: number[];
  rain: number[];
  expectedZones: GrowingZoneId[];
  pattern: RainPattern;
  frostMonths: number[];
}
const REGIONAL_CASES: RegionalPlannerCase[] = [
  { zone: 'highveld', lat: -26.2, temp: temperatures(11, 20), rain: summerRain(713), expectedZones: ['highveld', 'midlands-mistbelt'], pattern: 'summer', frostMonths: [5, 6, 7, 8] },
  { zone: 'midlands-mistbelt', lat: -26.2, temp: temperatures(11, 20), rain: summerRain(713), expectedZones: ['highveld', 'midlands-mistbelt'], pattern: 'summer', frostMonths: [5, 6, 7, 8] },
  { zone: 'lowveld-bushveld', lat: -25.47, temp: temperatures(14, 25), rain: summerRain(800), expectedZones: ['lowveld-bushveld', 'subtropical-coast'], pattern: 'mild-frost', frostMonths: [] },
  { zone: 'subtropical-coast', lat: -33.02, temp: temperatures(14, 22), rain: bimodalRain(750), expectedZones: ['subtropical-coast'], pattern: 'all-year', frostMonths: [] },
  { zone: 'western-cape', lat: -33.93, temp: temperatures(12, 21), rain: winterRain(515), expectedZones: ['western-cape'], pattern: 'winter', frostMonths: [] },
  { zone: 'southern-cape', lat: -33.02, temp: temperatures(12, 21), rain: bimodalRain(750), expectedZones: ['southern-cape'], pattern: 'all-year', frostMonths: [] },
  { zone: 'karoo-arid', lat: -28.45, temp: temperatures(13, 29), rain: summerRain(190), expectedZones: ['karoo-arid'], pattern: 'summer', frostMonths: [5, 6, 7, 8] },
  { zone: 'high-mountain', lat: -29.6, temp: temperatures(3.5, 16), rain: summerRain(900), expectedZones: ['high-mountain', 'highveld'], pattern: 'summer', frostMonths: [5, 6, 7, 8] },
];
const regionalAnswers: AutoSuggestAnswers = {
  goal: 'family', groups: [], rhythm: 'steady', rotateCrops: true,
  allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
};

test('all eight researched zone cases use their own crop calendar, heat checks and observed frost without claiming nationwide fruit suitability', () => {
  assert.deepEqual(REGIONAL_CASES.map(row => row.zone).sort(), [...GROWING_ZONE_IDS].sort());
  const e = buildCompleteProductionExample();
  for (const row of REGIONAL_CASES) {
    const climate = siteClimateFromLocationData({ rainfall: { rainfallSource: 'nasa-power', monthly: row.rain },
      climate: { monthlyTemp: row.temp } }, row.lat);
    assert.ok(climate, `${row.zone}: a complete synthetic parser case must resolve`);
    assert.equal(climate.pattern, row.pattern, `${row.zone}: warm coastal sowings leaked into a different climate`);
    const zones = growingZonesForClimate(row.temp, row.rain, row.lat);
    assert.deepEqual(zones, row.expectedZones, `${row.zone}: retain all unresolved climate-zone candidates`);
    const answers = { ...regionalAnswers, siteMonthlyTempC: row.temp, siteMonthlyRainMm: row.rain,
      siteLatitude: row.lat, observedFrostMonths: row.frostMonths };
    const result = autoSuggestPlan(answers, climate.pattern, e.input.beds, [], 11);
    assert.ok(result.plantings.length, `${row.zone}: this case must exercise actual crop scheduling`);
    const gate = climateGateFrom(answers, false);
    assert.ok(gate);
    for (const planting of result.plantings) {
      const crop = cropByKey(planting.cropKey)!;
      assert.ok(crop.sowMonths[climate.pattern].includes(planting.sowMonth), `${row.zone}: ${crop.name} outside its matching regional calendar`);
      assert.equal(judgeFieldMonths(crop, occupiedMonthsForPlanting(planting), gate), 'ok', `${row.zone}: heat-excluded crop returned`);
      assert.deepEqual(observedFrostConflicts(crop, planting.sowMonth, row.frostMonths), [], `${row.zone}: tender field crop returned in observed frost`);
    }
    assert.deepEqual(benchmarkAreaConflictBedLabels(result.plantings, e.input.beds), [], `${row.zone}: regional proposal double-booked growing space`);
    const references = planningTreeSeasons(e.trees, zones, { ...e.conditions, frost: row.frostMonths.length ? 'yes' : 'no' });
    assert.ok(references.every(tree => tree.season.source?.url), `${row.zone}: a picking reference lost its source`);
    if (!zones.every(zone => ['lowveld-bushveld', 'subtropical-coast'].includes(zone))) {
      assert.ok(references.every(tree => !['carica-papaya', 'mangifera-indica', 'macadamia-integrifolia', 'litchi-chinensis'].includes(tree.speciesId)),
        `${row.zone}: a warm fruit reference became a nationwide assumption`);
    }
    if (zones.includes('high-mountain')) assert.deepEqual(references, [], 'the broad summer crop column is not proof of a mountain fruit season');
  }
});

test('missing or mismatched climate cannot borrow the warm example as site data or silently establish a rain-fed plan', () => {
  const e = buildCompleteProductionExample();
  const cold = REGIONAL_CASES[0];
  const oldLabel = { rainfall: { rainfallSource: 'nasa-power', monthly: cold.rain },
    climate: { monthlyTemp: cold.temp, koppen: 'Af' } };
  const resolved = siteClimateFromLocationData(oldLabel, cold.lat);
  assert.ok(resolved);
  assert.equal(resolved.pattern, 'summer', 'a stale warm cache label must not override cold monthly data');
  assert.notEqual(resolved.koppen, 'Af');
  for (const data of [undefined, {}, { rainfall: { monthly: cold.rain }, climate: { monthlyTemp: cold.temp } },
    { rainfall: { rainfallSource: 'nasa-power', monthly: cold.rain.slice(1) }, climate: { monthlyTemp: cold.temp } }]) {
    assert.equal(siteClimateFromLocationData(data, cold.lat), null, 'missing, unsourced or incomplete readings must remain unknown');
  }
  assert.deepEqual(growingZonesForClimate([], [], cold.lat), []);
  assert.deepEqual(planningTreeSeasons(e.trees, [], e.conditions), [], 'unknown site climate must not inherit KZN picking references');
  const refused = autoSuggestPlan({ ...regionalAnswers, reliableIrrigation: false }, 'all-year', e.input.beds, [], 11);
  assert.deepEqual(refused.plantings, [], 'neither a coastal calendar nor example beds prove rain-fed water availability');
  assert.ok(refused.notes.some(note => /reliable irrigation was not confirmed/.test(note.text)), 'the missing survey/water answer must be explained');
});

test('both full and calendar-only prints identify animal and preserved-stock dates as fictional records', async () => {
  const e = buildCompleteProductionExample();
  for (const input of [e.input, { ...e.input, sections: ['calendar', 'availability'] as const, pageFormat: 'a2' as const }]) {
    const blob = await buildCropPlanPdf({ ...input, sections: [...input.sections!] });
    assert.ok(blob.size > 5000);
    const text = visibleText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    assert.match(text, /FICTIONAL EXAMPLE - banana, animal and preserved-stock months are made-up records/);
    assert.match(text, /Nov.*2026/);
    if (input.sections!.some(section => section === 'availabilityGraphs')) {
      for (const record of e.preservedProducts) assert.ok(text.includes(record.label),
        `${record.label} must be named on the printed stock graph alongside the fictional notice`);
    }
  }
});
