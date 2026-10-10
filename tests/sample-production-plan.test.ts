import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCompleteProductionExample } from '../lib/sample-production-plan.ts';
import { cropByKey } from '../lib/crop-catalog.ts';
import {
  benchmarkAreaConflictBedLabels, benchmarkDatedAreaConflictBedLabels,
  buildFoodAvailability, tasksForPlan,
} from '../lib/crop-plan.ts';
import { ANIMAL_ENTERPRISES, buildAnimalAvailability } from '../lib/animal-enterprises.ts';
import { buildTreeAvailability } from '../lib/perennial-harvest.ts';
import { assumedProductSeason } from '../lib/production-product-guidance.ts';
import { plantingMonthIndex, treeAgeProjection } from '../lib/production-projection.ts';
import { buildCropPlanPdf } from '../lib/crop-export-pdf.ts';

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

test('the example actually contains vegetables, staples, fruit, nuts, cultivated and indigenous berries, eggs, milk, honey and fish', () => {
  const e = buildCompleteProductionExample();
  const crops = new Set(e.input.plantings.map(p => p.cropKey));
  for (const key of ['swiss-chard', 'cabbage', 'carrots', 'onions', 'tomatoes', 'green-beans',
    'maize', 'dry-beans', 'groundnuts', 'sweet-potato', 'amadumbe', 'pumpkin', 'butternut']) {
    assert.ok(crops.has(key), `${key} is missing from the actual plan`);
  }
  const species = new Set(e.trees.map(g => g.harvest.speciesId));
  for (const id of ['persea-americana', 'musa-acuminata-aaa-group', 'carica-papaya',
    'mangifera-indica', 'litchi-chinensis', 'citrus-limon', 'macadamia-integrifolia',
    'fragaria-x-ananassa', 'syzygium-cordatum']) assert.ok(species.has(id), `${id} missing`);
  const products = new Set(Object.values(e.animalChoices).map(id => ANIMAL_ENTERPRISES[id!].product));
  assert.deepEqual(products, new Set(['eggs', 'milk', 'honey', 'fish']));
  assert.equal(e.farmZones.flatMap(z => z.bedIds).length, e.input.beds.length);
  assert.equal(new Set(e.farmZones.flatMap(z => z.bedIds)).size, e.input.beds.length);
  assert.ok(e.input.productionGuide!.foodForest!.every(item => item.sources?.length), 'tree advice must retain primary-source references');
  assert.ok(e.input.productionGuide!.animalProducts!.every(item => item.sources?.length), 'animal care qualifiers must keep their sources');
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
  assert.match(e.input.meta.documentNotice!, /FICTIONAL EXAMPLE.*banana and animal months/);
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
  assert.deepEqual(new Set(observedAnimals.flat().map(a => a.product)), new Set(['eggs', 'milk', 'honey', 'fish']));
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

test('both a full plan and a calendar-only print retain the fictional-record notice in the actual PDF', async () => {
  const e = buildCompleteProductionExample();
  for (const input of [e.input, { ...e.input, sections: ['calendar', 'availability'] as const, pageFormat: 'a2' as const }]) {
    const blob = await buildCropPlanPdf({ ...input, sections: [...input.sections!] });
    assert.ok(blob.size > 5000);
    const text = visibleText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    assert.match(text, /FICTIONAL EXAMPLE - banana and animal months are made-up records/);
    assert.match(text, /Nov.*2026/);
  }
});
