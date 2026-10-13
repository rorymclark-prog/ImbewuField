import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPECIES } from '@/lib/species-catalog';
import {
  ELEMENT_SPECIES,
  PERENNIAL_HARVEST,
  buildTreeAvailability,
  cleanTreeSeasonChoices,
  formatMonthSpan,
  formatRange,
  perennialHarvestFor,
  confirmedTreeMonths,
  placedTreeGroups,
  sourcedSeasonMonths,
  speciesIdForPlaced,
  treePickingByMonth,
  treePickingPhrase,
  unidentifiedPlantGroups,
} from '@/lib/perennial-harvest';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { ageReadyForSeason, buildProductionProjection, plantingMonthIndex, projectedKgLabel, treeAgeCalendarNote, treeAgeProjection } from '@/lib/production-projection';
import { estimatedYieldKgAdjusted, type PlanBed, type Planting } from '@/lib/crop-plan';
import { calendarProduceByMonth } from '@/lib/calendar-produce';
import { printableAvailability } from '@/lib/crop-export-availability';
import { planningTreeSeasons } from '@/lib/production-product-guidance';
import { harvestFromDossier, loadDossiers } from '../scripts/build-perennial-harvest.mjs';

test('a contextual age or hectare result survives research generation without becoming a universal plant yield', () => {
  const reference = { title: 'Age and native-unit fixture', quote: 'At year six, this particular trial gave a measured result.', url: 'https://www.arc.agric.za/fixture', doc: 'Synthetic generator contract fixture', page: 3, note: 'Named cultivar at year six; measured kg/ha, no matched tree density.' };
  const h = harvestFromDossier({ speciesId: 'fixture', commonName: 'Fixture', yieldKgPerTreeMature: { value: null, evidence: null }, supplementaryReferences: [reference], productionGuidance: { care: ['Check the source conditions.'], purchase: ['Confirm identified stock.'] }, householdFoodStatus: 'specialist-review' });
  assert.equal(h.yieldKgPerTree, null);
  assert.deepEqual(h.supplementaryReferences, [{ title: reference.title, note: reference.note, source: { quote: reference.quote, url: reference.url, doc: reference.doc, page: reference.page } }]);
  assert.deepEqual(h.productionGuidance, { care: ['Check the source conditions.'], purchase: ['Confirm identified stock.'] });
  assert.equal(h.householdFoodStatus, 'specialist-review');
});

test('a food-use hold retains inventory but blocks saved picking dates and entered yield from ordinary food forecasts', () => {
  const original = { harvest: PERENNIAL_HARVEST['persea-americana'], existing: 1, proposed: 0 };
  const group = { ...original, harvest: { ...original.harvest, householdFoodStatus: 'specialist-review' as const } };
  const choices = { 'persea-americana': { months: [10], bearing: true, production: [{ status: 'existing' as const, plants: 1, planted: '2016-10', yields: [{ age: 1, kg: 20 }] }] } };
  assert.deepEqual(confirmedTreeMonths(group.harvest, choices), []);
  assert.deepEqual(buildTreeAvailability([group], [10], true, choices), [[]]);
  assert.deepEqual(treePickingByMonth([group], [10], choices), [[]]);
  assert.deepEqual(planningTreeSeasons([group], ['subtropical-coast']), []);
  const projection = treeAgeProjection(group, choices['persea-americana'], 2026 * 12 + 9, 2027 * 12 + 8);
  assert.equal(projection.plants, 1);
  assert.equal(projection.kg, null);
  assert.deepEqual(projection.knownKg, [0, 0]);
  assert.match(projection.missing.join(' '), /Food use needs review/);
  assert.equal(ageReadyForSeason(group, choices['persea-americana'], 2026 * 12 + 9), false);
  assert.deepEqual(choices['persea-americana'].months, [10], 'the gate must not mutate the farmer’s saved observation');
});

const speciesIds = new Set(SPECIES.map((s) => s.id));
const records = Object.values(PERENNIAL_HARVEST);

// The kg schedules below are deliberately synthetic farm entries, not agronomic recommendations.
const projectionNow = new Date(2026, 9, 4);
const projectionStart = 2026 * 12 + 9;
const youngAvocado = { harvest: PERENNIAL_HARVEST['persea-americana'], existing: 0, proposed: 1 };

test('a young tree has growing years before first crop and never inherits a mature research yield', () => {
  const choices = { 'persea-americana': { months: [], bearing: false, production: [{ status: 'proposed' as const, plants: 1, planted: '2026-10', yields: [] }] } };
  const projection = buildProductionProjection({ plantings: [], beds: [], trees: [youngAvocado], choices, now: projectionNow });
  assert.deepEqual(projection.years[0].trees[0].kg, [0, 0]);
  assert.deepEqual(projection.years[1].trees[0].kg, [0, 0]);
  assert.equal(projection.years[2].trees[0].kg, null, 'first-crop age is not a quantity');
  assert.equal(projection.years[9].trees[0].kg, null, 'maturity does not authorise trial kg for this site');
  assert.equal(projection.years[2].partial, true);
});

test('a first-crop transition within a projected year stays unknown instead of claiming zero for the whole year', () => {
  const t = treeAgeProjection(youngAvocado, { months: [], bearing: false, production: [{ status: 'proposed', plants: 1, planted: '2026-04', yields: [] }] }, projectionStart + 12, projectionStart + 23);
  assert.equal(t.kg, null);
});

test('older and younger plants keep their own ages and explicit farm yield schedules', () => {
  const g = { ...youngAvocado, existing: 2, proposed: 1 };
  const choices = { 'persea-americana': { months: [9], bearing: true, production: [
    { status: 'existing' as const, plants: 2, planted: '2016-10', yields: [{ age: 10, kg: 4 }] },
    { status: 'proposed' as const, plants: 1, planted: '2026-10', yields: [{ age: 2, kg: 1 }, { age: 4, kg: 3 }] },
  ] } };
  const p = buildProductionProjection({ plantings: [], beds: [], trees: [g], choices, now: projectionNow });
  assert.deepEqual(p.years[0].treeKg, [8, 8]);
  assert.deepEqual(p.years[2].treeKg, [9, 9]);
  assert.deepEqual(p.years[4].treeKg, [11, 11]);
  assert.match(p.years[0].trees[0].ages, /10\.0/);
  assert.match(p.years[0].trees[0].ages, /0\.0/);
});

test('a yield schedule changing inside a year produces a range without inventing a monthly picking curve', () => {
  const choice = { months: [], bearing: false, production: [{ status: 'proposed' as const, plants: 1, planted: '2022-04', yields: [{ age: 4, kg: 3 }, { age: 5, kg: 6 }] }] };
  assert.deepEqual(treeAgeProjection(youngAvocado, choice, projectionStart, projectionStart + 11).kg, [3, 6]);
});

test('an unknown younger cohort does not discard the known production of older plants of the same species', () => {
  const choice = { months: [], bearing: true, production: [
    { status: 'existing' as const, plants: 1, planted: '2016-10', yields: [{ age: 10, kg: 4 }] },
    { status: 'proposed' as const, plants: 1, planted: '2026-10', yields: [] },
  ] };
  const g = { ...youngAvocado, existing: 1 };
  const projection = buildProductionProjection({ plantings: [], beds: [], trees: [g], choices: { 'persea-americana': choice }, now: projectionNow });
  assert.equal(projection.years[2].trees[0].kg, null);
  assert.deepEqual(projection.years[2].treeKg, [4, 4]);
  assert.equal(projection.years[2].partial, true);
});

test('missing dates, unassigned plants, over-counts and conflicting ages remain missing rather than zero', () => {
  assert.equal(treeAgeProjection(youngAvocado, undefined, projectionStart, projectionStart + 11).kg, null);
  for (const production of [
    [{ status: 'proposed' as const, plants: 1, planted: '', yields: [] }],
    [{ status: 'proposed' as const, plants: 2, planted: '2026-10', yields: [] }],
    [{ status: 'proposed' as const, plants: NaN, planted: '2026-10', yields: [] }],
    [{ status: 'proposed' as const, plants: 1, planted: '2020-10', yields: [{ age: 2, kg: 3 }, { age: 2, kg: 9 }] }],
  ]) assert.equal(treeAgeProjection(youngAvocado, { months: [], bearing: false, production }, projectionStart, projectionStart + 11).kg, null);
});

test('age records survive season saving while invalid dates and kg cannot become forecasts', () => {
  const clean = cleanTreeSeasonChoices({ 'persea-americana': { months: [9], bearing: false, production: [{ status: 'proposed', plants: 1, planted: '2026-10', yields: [{ age: 4, kg: 3 }, { age: -1, kg: 5 }, { age: 2, kg: NaN }] }] } });
  assert.deepEqual(clean['persea-americana']?.production?.[0].yields, [{ age: 4, kg: 3 }]);
  assert.equal(clean['persea-americana']?.production?.[0].planted, '2026-10');
  assert.equal(plantingMonthIndex('2026-13'), null);
  assert.equal(plantingMonthIndex('2026-10'), projectionStart);
});

test('one dated vegetable crop is forecast in its actual future year, while only recurring rows repeat', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', kind: 'bed', areaM2: 10 }];
  const p: Planting = { id: 'dated', bedId: 'bed', cropKey: 'carrots', sowMonth: 10, once: '2028-10' };
  const kg = estimatedYieldKgAdjusted(p, 10, [p]);
  const future = buildProductionProjection({ plantings: [p], beds, trees: [], choices: {}, now: projectionNow });
  assert.equal(future.years[0].vegetableKg, 0);
  assert.equal(future.years[1].vegetableKg, 0);
  assert.equal(future.years[2].vegetableKg, kg);
  assert.equal(future.years[3].vegetableKg, 0);
  const recurring = { ...p, once: undefined };
  const annual = buildProductionProjection({ plantings: [recurring], beds, trees: [], choices: {}, now: projectionNow });
  assert.ok(annual.years.every(y => y.vegetableKg === kg));
});

test('double-booked vegetables cannot inflate the combined orchard and vegetable projection', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', kind: 'bed', areaM2: 10 }];
  const p: Planting = { id: 'one', bedId: 'bed', cropKey: 'carrots', sowMonth: 10 };
  const projection = buildProductionProjection({ plantings: [p, { ...p, id: 'two' }], beds, trees: [], choices: {}, now: projectionNow });
  assert.ok(projection.years.every(y => y.vegetableKg === null && y.combinedKg === null && y.partial));
});

test('the same bed used in separate future years keeps its production instead of a phantom conflict', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 10 }];
  const p: Planting = { id: 'first', bedId: 'bed', cropKey: 'carrots', sowMonth: 10, once: '2028-10' };
  const q = { ...p, id: 'next', once: '2029-10' };
  const kg = estimatedYieldKgAdjusted(p, 10, [p, q]);
  const projection = buildProductionProjection({ plantings: [p, q], beds, trees: [], choices: {}, now: projectionNow });
  assert.deepEqual(projection.years.map(y => y.vegetableKg), [0, 0, kg, kg, 0, 0, 0, 0, 0, 0]);
  assert.ok(projection.years.every(y => !y.partial));
});

test('a real dated future bed conflict blocks that period without erasing all the other years', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 10 }];
  const p: Planting = { id: 'first', bedId: 'bed', cropKey: 'carrots', sowMonth: 10, once: '2028-10' };
  const q = { ...p, id: 'overlap', sowMonth: 11, once: '2028-11' };
  const projection = buildProductionProjection({ plantings: [p, q], beds, trees: [], choices: {}, now: projectionNow });
  assert.equal(projection.years[2].vegetableKg, null);
  assert.equal(projection.years[2].combinedKg, null);
  assert.deepEqual(projection.years[2].vegetableMissing, ['Resolve double-booked beds']);
  assert.ok(projection.years.filter((_, i) => i !== 2).every(y => y.vegetableKg === 0 && !y.partial));
});

test('a current one-off overlap stops blocking a recurring crop after the observed cohort finishes', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 10 }];
  const recurring: Planting = { id: 'annual', bedId: 'bed', cropKey: 'carrots', sowMonth: 10 };
  const existing = { ...recurring, id: 'observed', existing: true, confirmedOnceSowing: '2026-10' };
  const kg = estimatedYieldKgAdjusted(recurring, 10, [recurring]);
  const projection = buildProductionProjection({ plantings: [recurring, existing], beds, trees: [], choices: {}, now: projectionNow });
  assert.equal(projection.years[0].vegetableKg, null);
  assert.ok(projection.years.slice(1).every(y => y.vegetableKg === kg && !y.partial));
});

test('dated occupation and harvest stay in their real years over December and January', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 10 }];
  const p: Planting = { id: 'december', bedId: 'bed', cropKey: 'carrots', sowMonth: 12, once: '2027-12' };
  const q = { ...p, id: 'january', sowMonth: 1, once: '2028-01' };
  const kg = estimatedYieldKgAdjusted(p, 10, [p]);
  const single = buildProductionProjection({ plantings: [p], beds, trees: [], choices: {}, now: projectionNow });
  assert.equal(single.years[0].vegetableKg, 0);
  assert.equal(single.years[1].vegetableKg, kg);
  const conflict = buildProductionProjection({ plantings: [p, q], beds, trees: [], choices: {}, now: projectionNow });
  assert.equal(conflict.years[0].vegetableKg, 0);
  assert.equal(conflict.years[1].vegetableKg, null);
  assert.equal(conflict.years[2].vegetableKg, 0);
});

test('a crop-cycle conflict before the year boundary still blocks the crop harvested after it', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 10 }];
  const p: Planting = { id: 'first', bedId: 'bed', cropKey: 'carrots', sowMonth: 5, once: '2027-05' };
  const q = { ...p, id: 'next', sowMonth: 9, once: '2027-09' };
  const projection = buildProductionProjection({ plantings: [p, q], beds, trees: [], choices: {}, now: projectionNow });
  assert.equal(projection.years[0].vegetableKg, null, 'whole-bed crops conflict in September');
  assert.equal(projection.years[1].vegetableKg, null, 'January picking cannot undo the same crop-cycle conflict');
  assert.ok(projection.years.slice(2).every(y => y.vegetableKg === 0 && !y.partial));
});

test('invalid or inconsistent sowing dates cannot create crop kilograms absent from the calendar', () => {
  const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2: 10 }];
  const base: Planting = { id: 'invalid', bedId: 'bed', cropKey: 'carrots', sowMonth: 10 };
  for (const p of [
    ...[0, 13, NaN, 1.5].map(sowMonth => ({ ...base, sowMonth })),
    { ...base, once: '' },
    { ...base, once: '2028-11' },
    { ...base, confirmedOnceSowing: '2026-11', existing: true },
  ]) {
    const projection = buildProductionProjection({ plantings: [p], beds, trees: [], choices: {}, now: projectionNow });
    assert.ok(projection.years.every(y => y.vegetableKg === 0 && y.partial));
    assert.ok(projection.years.every(y => y.vegetableMissing.includes('Carrots: check sowing date')));
  }
});

test('a damaged growing area remains missing instead of entering a negative or nonfinite crop total', () => {
  const p: Planting = { id: 'crop', bedId: 'bed', cropKey: 'carrots', sowMonth: 10 };
  for (const areaM2 of [0, -1, NaN, Infinity]) {
    const beds: PlanBed[] = [{ id: 'bed', label: 'Fixture bed', areaM2 }];
    const projection = buildProductionProjection({ plantings: [p], beds, trees: [], choices: {}, now: projectionNow });
    assert.ok(projection.years.every(y => y.vegetableKg === 0 && y.partial));
    assert.ok(projection.years.every(y => y.vegetableMissing.includes('Fixture bed: check growing area')));
  }
});

test('invalid age or kg drafts do not change a reference season when the saved projection rejects them', () => {
  for (const yields of [[{ age: -1, kg: 2 }], [{ age: 0, kg: -1 }], [{ age: 0, kg: NaN }]]) {
    const choice = { months: [], bearing: false, production: [{ status: 'proposed' as const, plants: 1, planted: '2026-10', yields }] };
    assert.equal(ageReadyForSeason(youngAvocado, choice, projectionStart), false);
    assert.equal(ageReadyForSeason(youngAvocado, choice, projectionStart + 36), true);
    const cleaned = cleanTreeSeasonChoices({ 'persea-americana': choice })['persea-americana'];
    assert.equal(ageReadyForSeason(youngAvocado, choice, projectionStart), ageReadyForSeason(youngAvocado, cleaned, projectionStart));
    assert.equal(ageReadyForSeason(youngAvocado, choice, projectionStart + 36), ageReadyForSeason(youngAvocado, cleaned, projectionStart + 36));
  }
});

test('contradictory yield ages are visible even before the first crop reference', () => {
  const choice = { months: [], bearing: false, production: [{ status: 'proposed' as const, plants: 1, planted: '2026-10', yields: [{ age: 0, kg: 0 }, { age: 0, kg: 0 }] }] };
  const p = treeAgeProjection(youngAvocado, choice, projectionStart, projectionStart + 11);
  assert.equal(p.kg, null);
  assert.ok(p.missing.includes('Check duplicate yield ages'));
});

test('small positive production keeps its decimals in the shared app and printed label', () => {
  assert.equal(projectedKgLabel([0.4, 0.4]), '0.4 kg');
  assert.equal(projectedKgLabel([0.004, 0.08]), '0.004–0.08 kg');
  assert.equal(projectedKgLabel([0.0004, 0.0004]), '<0.001 kg');
  assert.equal(projectedKgLabel([0, 0]), '0 kg');
  assert.equal(projectedKgLabel(null), 'Needs information');
  assert.equal(projectedKgLabel([NaN, Infinity]), 'Needs information');
});

test('recorded young tree ages suppress premature seasonal references in both the app and the printed calendar', () => {
  const choices = { 'persea-americana': { months: [], bearing: false, production: [{ status: 'proposed' as const, plants: 1, planted: '2026-10', yields: [] }] } };
  const dates = Array.from({ length: 36 }, (_, i) => ({ year: Math.floor((projectionStart + i) / 12), month: (projectionStart + i) % 12 + 1 }));
  const months = dates.map(d => d.month);
  const planning = planningTreeSeasons([youngAvocado], ['subtropical-coast']);
  const app = calendarProduceByMonth([youngAvocado], [], {}, months, choices, {}, planning, dates);
  assert.ok(app.slice(0, 24).every(m => !m.trees.length));
  assert.ok(app.slice(24).some(m => m.trees.length));
  const paper = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], treeGroups: [youngAvocado], treeSeasons: choices, planning: { months, trees: planning, dates } });
  assert.ok(paper.forestPlanning!.every(m => m.length === 0));
  assert.equal(paper.undated?.[0].label, 'Avocado', 'growing plants must remain in the map inventory');
  assert.equal(ageReadyForSeason(youngAvocado, choices['persea-americana'], projectionStart + 23), false);
  assert.equal(treeAgeCalendarNote(youngAvocado, choices['persea-americana'], projectionStart), 'Growing · first-crop ref 2028–2029');
});

test('a banana circle remains three plants in age-based production, never three mats plus followers', () => {
  const g = placedTreeGroups([{ defId: 'banana_circle', status: 'proposed' }])[0];
  const choice = { months: [], bearing: false, production: [{ status: 'proposed' as const, plants: 3, planted: '2024-10', yields: [{ age: 2, kg: 2 }] }] };
  assert.equal(g.proposed, 3);
  assert.deepEqual(treeAgeProjection(g, choice, projectionStart, projectionStart + 11).kg, [6, 6]);
});

test('the generated table is exactly what the dossiers say', () => {
  // lib/perennial-harvest-data.ts is generated; a hand edit there would put a value in the app
  // that no dossier — and so no checked quote — stands behind.
  const dossiers = loadDossiers();
  assert.equal(records.length, dossiers.length, 're-run node scripts/build-perennial-harvest.mjs');
  for (const d of dossiers) {
    assert.deepEqual(PERENNIAL_HARVEST[d.speciesId], harvestFromDossier(d), `${d.speciesId} drifted from its dossier`);
  }
});

test('every harvest record names a live catalogue species', () => {
  for (const h of records) assert.ok(speciesIds.has(h.speciesId), `${h.speciesId} is not in SPECIES`);
});

test('every value carries a quote and a primary-source URL', () => {
  // The research brief ruled out nurseries, blogs and encyclopaedias; these hosts are the ones a
  // web search surfaces first, so they are the ones that would slip in.
  const banned = /wikipedia\.org|blogspot\.|wordpress\.com|medium\.com|pinterest\.|facebook\.com|youtube\.com/i;
  const citations = records.flatMap((h) => [
    ...h.windows.map((w) => ({ at: `${h.speciesId} ${w.region}`, c: w.source })),
    ...(['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits'] as const)
      .flatMap((k) => (h[k] ? [{ at: `${h.speciesId} ${k}`, c: h[k]!.source }] : [])),
    ...(h.pollination ? [{ at: `${h.speciesId} pollination`, c: h.pollination.source }] : []),
    ...(h.supplementaryReferences ?? []).map((reference, index) => ({ at: `${h.speciesId} supplemental reference ${index}`, c: reference.source })),
  ]);
  assert.ok(citations.length > 0);
  for (const { at, c } of citations) {
    assert.ok(c.quote.trim().length >= 12, `${at}: no quote`);
    assert.match(c.url, /^https?:\/\//, `${at}: no URL`);
    assert.doesNotMatch(c.url, banned, `${at}: ${c.url} is not a primary source`);
    assert.ok(c.doc.trim(), `${at}: no document name`);
  }
});

test('months and ranges are well formed', () => {
  for (const h of records) {
    if (h.householdFoodStatus) assert.ok(['confirmed-food', 'specialist-review', 'not-food'].includes(h.householdFoodStatus), `${h.speciesId}: invalid food-use status`);
    for (const reference of h.supplementaryReferences ?? []) assert.ok(reference.title.trim() && reference.note.trim(), `${h.speciesId}: missing reference conditions`);
    for (const w of h.windows) {
      assert.ok(w.months.length > 0, `${h.speciesId} ${w.region}: empty window`);
      for (const m of w.months) assert.ok(Number.isInteger(m) && m >= 1 && m <= 12, `${h.speciesId}: month ${m}`);
      assert.equal(new Set(w.months).size, w.months.length, `${h.speciesId} ${w.region}: repeated month`);
    }
    for (const k of ['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits'] as const) {
      const r = h[k];
      if (!r) continue;
      const [min, max] = r.value;
      assert.ok(Number.isFinite(min) && Number.isFinite(max) && min >= 0 && min <= max, `${h.speciesId} ${k}: [${min}, ${max}]`);
    }
    if (h.yearsToFirstCrop && h.yearsToFullBearing) {
      assert.ok(h.yearsToFirstCrop.value[0] <= h.yearsToFullBearing.value[1], `${h.speciesId}: full bearing before first crop`);
    }
  }
});

test('a retired species id still finds its harvest', () => {
  const kei = perennialHarvestFor('dovyalis-afra');
  assert.equal(perennialHarvestFor('dovyalis-caffra'), kei);
  assert.equal(perennialHarvestFor('not-a-species'), null);
  assert.equal(perennialHarvestFor(undefined), null);
});

test('element shortcuts point at real elements and real species', () => {
  for (const [defId, speciesId] of Object.entries(ELEMENT_SPECIES)) {
    assert.ok(ELEMENTS_BY_ID[defId], `${defId} is not a design element`);
    assert.ok(speciesIds.has(speciesId), `${defId} → ${speciesId} is not in SPECIES`);
  }
  // A picked species beats the element it was placed as.
  assert.equal(speciesIdForPlaced({ defId: 'tree_mango', speciesId: 'persea-americana' }), 'persea-americana');
  assert.equal(speciesIdForPlaced({ defId: 'tree_mango' }), 'mangifera-indica');
  assert.equal(speciesIdForPlaced({ defId: 'tree_other', speciesId: 'dovyalis-caffra' }), 'dovyalis-afra');
  // Ambiguous elements are not guessed at.
  assert.equal(speciesIdForPlaced({ defId: 'tree_citrus' }), null);
  assert.equal(speciesIdForPlaced({ defId: 'tree_plum' }), null);
});

test('month spans read the way a farmer says them', () => {
  assert.equal(formatMonthSpan([2, 3, 4, 5, 6, 7, 8, 9, 10]), 'Feb–Oct');
  assert.equal(formatMonthSpan([11, 12, 1]), 'Nov–Jan');
  assert.equal(formatMonthSpan([12, 3, 4]), 'Mar–Apr, Dec');
  assert.equal(formatMonthSpan([5]), 'May');
  assert.equal(formatMonthSpan([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'All year');
  assert.equal(formatMonthSpan([]), '');
  assert.equal(formatRange([2, 3]), '2–3');
  assert.equal(formatRange([5, 5]), '5');
  assert.equal(formatRange([100, 112.5]), '100–112.5');
});

test('locally confirmed seasons count standing trees from today and preserve proposed plants in the repeated design', () => {
  const avocado = PERENNIAL_HARVEST['persea-americana'];
  assert.ok(avocado, 'avocado dossier missing');
  const groups = placedTreeGroups([
    { defId: 'tree_avocado', status: 'existing' },
    { defId: 'tree_other', speciesId: 'persea-americana', status: 'proposed' },
    { defId: 'tree_other', speciesId: 'persea-americana' }, // legacy: no status = existing
    { defId: 'veg_bed' },
    { defId: 'tree_citrus' },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual([groups[0].existing, groups[0].proposed], [2, 1]);

  // The audit found an eleven-month avocado season made by unioning different regions. This
  // fixture represents one farmer-confirmed window; the national union must never choose it.
  const choices = { 'persea-americana': { months: [8, 9, 10, 11, 12], bearing: true } };
  const season = choices['persea-americana'].months;
  const off = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => !season.includes(m));
  const inSeason = season[0];
  const months = off === undefined ? [inSeason] : [inSeason, off];
  assert.ok(buildTreeAvailability(groups, months, false).every((m) => m.length === 0));
  const established = buildTreeAvailability(groups, months, false, choices);
  const fromToday = buildTreeAvailability(groups, months, true, choices);
  assert.equal(established[0][0].trees, 3);
  assert.equal(fromToday[0][0].trees, 2);
  if (off !== undefined) assert.deepEqual(established[1], []);

  // Only proposed trees: nothing from today.
  const young = placedTreeGroups([{ defId: 'tree_avocado', status: 'proposed' }]);
  assert.deepEqual(buildTreeAvailability(young, [inSeason], true, choices), [[]]);
});

test('an avocado reference never extends a locally confirmed season, and unproductive plants do not promise food', () => {
  const groups = placedTreeGroups([{ defId: 'tree_avocado', status: 'existing' }]);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  assert.deepEqual(buildTreeAvailability(groups, months, true).map((m) => m.length), months.map(() => 0));
  const choices = { 'persea-americana': { months: [8, 9], bearing: true } };
  assert.deepEqual(buildTreeAvailability(groups, months, true, choices).map((m) => m.length), [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0]);
  assert.ok(buildTreeAvailability(groups, months, true, { 'persea-americana': { months: [8, 9], bearing: false } }).every((m) => m.length === 0));
});

test('each banana circle contributes three planted bananas without changing the design or inventing seasons', () => {
  const items = [{ defId: 'banana_clump', status: 'existing' as const, x: 10, y: 20 }, { defId: 'banana_circle', status: 'proposed' as const, x: 33, y: 44, widthM: 7, rotation: 23 }];
  const before = structuredClone(items);
  const groups = placedTreeGroups(items);
  assert.deepEqual(items, before, 'count assumption must not alter saved geometry');
  assert.equal(groups[0].existing, 1);
  assert.equal(groups[0].proposed, 3);
  assert.equal(groups.length, 1, 'circles and individual bananas share one product');
  assert.equal(groups[0].harvest.speciesId, 'musa-acuminata-aaa-group');
  assert.equal(sourcedSeasonMonths(groups[0].harvest).length, 0, 'do not invent an all-year banana season');
  assert.equal(speciesIdForPlaced(items[1]), 'musa-acuminata-aaa-group', 'Rory explicitly defines a circle as three bananas');
  assert.deepEqual(unidentifiedPlantGroups(items), []);
  assert.deepEqual(unidentifiedPlantGroups([{ defId: 'banana_circle', speciesId: 'musa-acuminata-aaa-group' }]), []);
  assert.equal(unidentifiedPlantGroups([{ defId: 'banana_circle', speciesId: 'unsupported-id' }]).length, 1, 'an unavailable harvest record must not erase the design layout');
});

test('mapped food species without a harvest dossier remain counted and permit only confirmed local dates without invented yields', () => {
  // Research coverage grows. Exercise an actual permitted catalogue identity without a
  // perennial dossier rather than requiring any named food to stay unresearched forever.
  const food = SPECIES.find(species => species.uses.includes('food') && species.nemba === 'none' && !perennialHarvestFor(species.id));
  assert.ok(food && food.uses.includes('food') && food.nemba === 'none');
  assert.equal(perennialHarvestFor(food.id), null, 'the fixture must exercise a genuinely missing harvest dossier');
  const items = [
    { defId: 'tree_other', speciesId: food.id, status: 'existing' as const },
    { defId: 'tree_apple', speciesId: food.id },
    { defId: 'tree_other', speciesId: food.id, status: 'proposed' as const },
    { defId: 'tree_other', speciesId: 'morus-nigra', status: 'proposed' as const },
    { defId: 'tree_avocado', status: 'existing' as const },
  ];
  const before = structuredClone(items);
  const groups = placedTreeGroups(items);
  assert.equal(groups.length, 3, 'unknown research must not erase known catalogue food plants');
  assert.deepEqual(unidentifiedPlantGroups(items), [], 'an identified permitted food plant uses the same month-confirmation authority');
  const group = groups.find(entry => entry.harvest.speciesId === food.id);
  assert.ok(group?.referenceMissing);
  assert.deepEqual([group.existing, group.proposed, group.harvest.name], [2, 1, food.commonName]);
  assert.deepEqual(group.harvest.windows, []);
  for (const key of ['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits', 'pollination'] as const) assert.equal(group.harvest[key], null);
  assert.deepEqual(buildTreeAvailability(groups, [1, 6, 12], true), [[], [], []]);
  const choices = cleanTreeSeasonChoices({ [food.id]: { bearing: true, months: [6, 6, 13, 0] }, 'morus-nigra': { bearing: true, months: [6] } });
  assert.deepEqual(choices[food.id], { bearing: true, months: [6] });
  const locallyConfirmed = buildTreeAvailability(groups, [1, 6, 12], true, choices);
  assert.deepEqual(locallyConfirmed[1], [{ speciesId: food.id, name: food.commonName, trees: 2 }]);
  assert.deepEqual(locallyConfirmed[0], []);
  assert.deepEqual(locallyConfirmed[2], []);
  assert.equal(treePickingByMonth(groups, [6], choices)[0][0].name, food.commonName);
  assert.equal(locallyConfirmed[1].some(entry => entry.speciesId === 'morus-nigra'), false, 'proposed-only plants have no current picking jobs even with dates supplied');
  assert.deepEqual(items, before, 'reading an inventory must not change map geometry or status');
});

test('apple references keep cultivar and Western Cape location distinct without creating warm KZN harvests or kilograms', () => {
  const apple = perennialHarvestFor('malus-domestica');
  assert.ok(apple, 'the named ordinary apple must have its own source profile, separate from Kei apple');
  assert.deepEqual(apple.windows.map(window => window.months), [[12, 1], [3]]);
  assert.match(apple.windows[0].region, /Bien Donne, Simondium, Western Cape.*Afri-Star/);
  assert.match(apple.windows[1].region, /Elgin, Western Cape.*Granny Smith.*first pick/);
  // The recovered KZN guide states light crop at year three and full production at
  // year seven. These are qualified age references, not a kg curve or coast suitability.
  assert.deepEqual(apple.yearsToFirstCrop?.value, [3, 3]);
  assert.deepEqual(apple.yearsToFullBearing?.value, [7, 7]);
  for (const age of [apple.yearsToFirstCrop, apple.yearsToFullBearing]) {
    assert.match(age!.source.url, /kzndard\.gov\.za/);
    assert.match(age!.note!, /Dry Highland Sourveld|rootstock|chilling/i);
  }
  for (const field of ['yieldKgPerTree', 'chillUnits', 'pollination'] as const) {
    assert.equal(apple[field], null, `${field} cannot be extrapolated from a cultivar date or per-hectare claim`);
  }
  const [group] = placedTreeGroups([{ defId: 'tree_other', speciesId: apple.speciesId, status: 'existing' },
    { defId: 'tree_other', speciesId: apple.speciesId, status: 'proposed' }]);
  assert.equal(group.referenceMissing, undefined, 'a checked source profile replaces the unidentified-reference fallback');
  const conditions = { frost: 'no' as const, drySeasonWater: 'reliable' as const, drainage: 'drains-well' as const, sunlight: 'full-sun' as const };
  assert.deepEqual(planningTreeSeasons([group], ['subtropical-coast'], conditions), [],
    'an apple profile or low-chill label does not establish a KZN picking window');
  const western = planningTreeSeasons([group], ['western-cape'], conditions);
  assert.equal(western.length, 1);
  assert.match(western[0].season.label, /Granny Smith.*chilling.*pollen/);
  assert.deepEqual(western[0].season.months, [3], 'one assumed cultivar cannot inherit the other cultivar\'s December–January dates');
  assert.match(western[0].season.basis, /Elgin first-pick reference.*not the whole harvest duration/);
  assert.deepEqual(buildTreeAvailability([group], [1, 3, 12], true), [[], [], []],
    'references must not turn an unconfirmed standing apple into local picking jobs');
  const projection = buildProductionProjection({ plantings: [], beds: [], trees: [group], choices: {}, now: projectionNow });
  assert.ok(projection.years.every(year => year.partial && year.trees[0].kg === null),
    'source timing cannot supply a tree age curve, output quantity or assured zero');
});

test('default Apple Tree map elements retain their exact counts without acquiring Cape picking dates or overriding chosen non-food species', () => {
  const items = [{ defId: 'tree_apple', status: 'existing' as const },
    { defId: 'tree_apple', status: 'proposed' as const }];
  const before = structuredClone(items);
  const groups = placedTreeGroups(items);
  assert.equal(groups.length, 1, 'the ordinary Apple Tree element must resolve to its existing catalogue identity');
  assert.equal(groups[0].harvest.speciesId, 'malus-domestica');
  assert.deepEqual([groups[0].existing, groups[0].proposed], [1, 1]);
  assert.deepEqual(unidentifiedPlantGroups(items), [], 'a canonical default apple must not ask the farmer to identify it again');
  const months = [1, 3, 12];
  const conditions = { frost: 'no' as const, drySeasonWater: 'reliable' as const, drainage: 'drains-well' as const, sunlight: 'full-sun' as const };
  const planning = planningTreeSeasons(groups, ['subtropical-coast'], conditions);
  assert.deepEqual(planning, [], 'identifying a mapped apple does not copy its Western Cape references into warm KZN');
  const localFood = buildTreeAvailability(groups, months, true);
  assert.deepEqual(localFood, [[], [], []], 'standing plants alone do not confirm food or picking dates');
  const printed = printableAvailability({ now: projectionNow, yearMode: 'fromToday', veg: [], utilization: [],
    trees: localFood, treeGroups: groups, planning: { months, trees: planning } });
  assert.deepEqual(printed.forest, [[], [], []]);
  assert.equal(printed.forestPlanning?.flat().length, 0);
  assert.ok(printed.undated?.some(row => row.iconKey === 'tree:malus-domestica' && /1 existing; 1 proposed/.test(row.detail)),
    'the unknown local season still needs a counted apple row on paper');
  const ornamental = SPECIES.find(species => !species.uses.includes('food') && species.nemba === 'none')!;
  const explicit = [{ defId: 'tree_apple', speciesId: ornamental.id, status: 'existing' as const }];
  assert.equal(speciesIdForPlaced(explicit[0]), ornamental.id, 'a chosen botanical identity always beats the default Apple Tree symbol');
  assert.deepEqual(placedTreeGroups(explicit), []);
  assert.deepEqual(unidentifiedPlantGroups(explicit), [], 'a selected non-food plant must not acquire an apple food record');
  assert.deepEqual(items, before, 'resolving an apple inventory cannot rewrite mapped status or geometry');
});

test('generic fruit elements retain their names while restricted mapped food remains inventory without gaining production dates', () => {
  const ornamental = SPECIES.find(species => !species.uses.includes('food') && species.nemba === 'none');
  const restricted = SPECIES.find(species => species.nemba !== 'none');
  assert.ok(ornamental && restricted);
  const items = [
    { defId: 'tree_pear' }, { defId: 'tree_plum', status: 'proposed' as const },
    { defId: 'tree_olive' }, { defId: 'tree_citrus' },
    { defId: 'tree_other' }, { defId: 'tree_indigenous' }, { defId: 'tree_basin' },
    { defId: 'tree_apple', speciesId: ornamental.id },
    { defId: 'tree_other', speciesId: restricted.id },
  ];
  const groups = unidentifiedPlantGroups(items);
  assert.deepEqual(groups.map(group => group.label).sort(), [...['tree_pear', 'tree_plum', 'tree_olive', 'tree_citrus'].map(id => ELEMENTS_BY_ID[id].name), restricted.commonName].sort());
  assert.ok(groups.filter(group => !group.legalCheck).every(group => group.speciesId === undefined), 'generic element names do not prove a botanical identity');
  assert.equal(groups.find(group => group.defId === 'tree_plum')?.proposed, 1);
  assert.match(groups.find(group => group.speciesId === restricted.id)?.legalCheck ?? '', new RegExp(`NEMBA ${restricted.nemba}`));
  assert.equal(placedTreeGroups(items).some(group => group.harvest.speciesId === restricted.id), false);
  assert.deepEqual(cleanTreeSeasonChoices({ [restricted.id]: { bearing: true, months: [1] } }), {});
  const aliased = cleanTreeSeasonChoices({ 'dovyalis-caffra': { bearing: true, months: [12, 1] } });
  assert.deepEqual(aliased, { 'dovyalis-afra': { bearing: true, months: [1, 12] } }, 'retired catalogue IDs must use the current stored observation key');
});

test('saved local seasons discard invalid months and unknown species without assuming productive plants', () => {
  const clean = cleanTreeSeasonChoices({ 'persea-americana': { months: [8, 8, 0, 13, '9', 9], bearing: 'true' }, missing: { months: [1], bearing: true }, constructor: { months: [1], bearing: true } });
  assert.deepEqual(clean, { 'persea-americana': { months: [8, 9], bearing: false } });
});

test('trees never reach a per-m² figure', () => {
  // lib/produce-scope.ts: the Production score divides by vegetable-bed area, so tree fruit must
  // stay out of it whatever the orchard switch says. Keep the harvest table out of the modules
  // that compute bed yields and value.
  for (const file of ['lib/crop-plan.ts', 'lib/plan-value.ts', 'lib/crop-yield.ts']) {
    let src = '';
    try { src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'); } catch { continue; }
    assert.doesNotMatch(src, /perennial-harvest/, `${file} must not read tree harvests`);
  }
});

test('the crop plan\'s pick lines require local confirmation and keep proposed plants out of current jobs', () => {
  const raspberry = PERENNIAL_HARVEST['rubus-idaeus'];
  assert.ok(raspberry, 'raspberry dossier missing');
  const groups = placedTreeGroups([
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'existing' },
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'existing' },
    { defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'proposed' },
  ]);
  // KZN DARD: "1st week November to late January".
  const choices = { 'rubus-idaeus': { months: [11, 12, 1], bearing: true } };
  assert.ok(treePickingByMonth(groups, [10, 11, 12, 1, 2]).every((slot) => slot.length === 0));
  const lines = treePickingByMonth(groups, [10, 11, 12, 1, 2], choices);
  assert.deepEqual(lines.map((slot) => slot.length), [0, 1, 1, 1, 0]);
  assert.equal(lines[1][0].trees, 2, 'a proposed cane is not picking this year');
  assert.equal(treePickingPhrase(lines[1][0]), 'Pick Raspberry (2) — confirmed local months Nov–Jan');
  assert.deepEqual(treePickingByMonth(placedTreeGroups([{ defId: 'tree_other', speciesId: 'rubus-idaeus', status: 'proposed' }]), [11], choices), [[]]);
});

test('berries and moringa: harvest records only for what a primary source gave', () => {
  // Rory, 2026-09-29: "what about berries and other food forest crops can we add them to the design
  // studio etc? what about moringa". Blackberry is not here: NEMBA category 2.
  for (const id of ['fragaria-x-ananassa', 'vaccinium-corymbosum', 'rubus-idaeus', 'passiflora-edulis', 'physalis-peruviana']) {
    assert.ok(PERENNIAL_HARVEST[id]?.windows.length, `${id} has no sourced window`);
  }
  assert.equal(PERENNIAL_HARVEST['rubus-fruticosus'], undefined);
  // Cape gooseberry's only SA months are one Stellenbosch tunnel trial's picking dates; its
  // "120 days after transplanting" is not a years-to-first-crop figure.
  assert.deepEqual(PERENNIAL_HARVEST['physalis-peruviana'].windows.map((w) => w.months), [[10, 11, 12, 1]]);
  assert.equal(PERENNIAL_HARVEST['physalis-peruviana'].yearsToFirstCrop, null);
  // North West DARD dates pod development, but food pods must be young, tender and green.
  // That stage is not dated; a botanical fruit-production interval cannot stand in for it.
  // Its separate first-leaf age remains useful without becoming a pod-picking calendar.
  const moringa = PERENNIAL_HARVEST['moringa-oleifera'];
  assert.ok(moringa);
  assert.deepEqual(moringa.yearsToFirstCrop?.value, [0.5, 1]);
  assert.equal(moringa.product, 'leaves and pods');
  assert.deepEqual(moringa.windows, []);
  const podPhenology = moringa.supplementaryReferences?.find(reference => reference.source.quote.includes('Fruits production'));
  assert.ok(podPhenology);
  assert.match(podPhenology.source.quote, /March and April/);
  assert.match(podPhenology.note, /young, tender, green/);
  // Mulberry now has edible-product and care evidence. That must not manufacture
  // a harvest calendar or per-plant yield when those fields remain unsourced.
  assert.ok(PERENNIAL_HARVEST['morus-nigra']?.productionGuidance);
  assert.deepEqual(PERENNIAL_HARVEST['morus-nigra'].windows, []);
  assert.equal(PERENNIAL_HARVEST['morus-nigra'].yieldKgPerTree, null);
  assert.equal(speciesIdForPlaced({ defId: 'tree_moringa' }), 'moringa-oleifera');
  // Blueberry's chill figure is in hours, which the chill-units field must not carry.
  assert.equal(PERENNIAL_HARVEST['vaccinium-corymbosum'].chillUnits, null);
});

test('fruit development observations remain guidance without creating ripe-food months', () => {
  // These primary accounts describe flowering, fruit appearance or development. A farmer
  // must not see those months marked as food ready to pick, even on an established plant.
  const phenologyQuotes = [
    ['dovyalis-afra', /flowering and fruiting/],
    ['pappea-capensis', /fruit is produced from December to July/],
    ['syzygium-cordatum', /fruiting in November–March/],
  ] as const;
  for (const [id, quote] of phenologyQuotes) {
    const harvest = PERENNIAL_HARVEST[id];
    assert.ok(harvest);
    assert.deepEqual(harvest.windows, [], `${id}: fruit-development dates became ripe picking dates`);
    assert.deepEqual(sourcedSeasonMonths(harvest), []);
    const reference = harvest.supplementaryReferences?.find(reference => quote.test(reference.source.quote));
    assert.ok(reference, `${id}: the useful original observation was lost`);
    assert.match(reference.note, /picking months remain unknown/);
    const groups = placedTreeGroups([{ defId: 'tree_other', speciesId: id, status: 'existing' }]);
    assert.equal(groups.length, 1, `${id}: mapped food product was lost`);
    assert.deepEqual(planningTreeSeasons(groups, ['subtropical-coast']), [], `${id}: phenology leaked into a regional food reference`);
    assert.ok(treePickingByMonth(groups, [1, 3, 7, 11, 12]).every(slot => slot.length === 0));
  }
  const medlar = PERENNIAL_HARVEST['vangueria-infausta'];
  assert.deepEqual(medlar.windows.map(window => window.months), [[1, 2, 3, 4]], 'SANBI describes soft edible ripe fruit in this narrower interval');
  assert.match(medlar.windows[0].source.url, /pza\.sanbi\.org\/vangueria-infausta/);
  assert.match(medlar.supplementaryReferences?.[0].source.quote ?? '', /fruits from November to April/);
  assert.match(medlar.supplementaryReferences?.[0].note ?? '', /does not date that ripening change/);
  const groups = placedTreeGroups([{ defId: 'tree_other', speciesId: 'vangueria-infausta', status: 'existing' }]);
  assert.deepEqual(planningTreeSeasons(groups, ['subtropical-coast'])[0].season.months, [1, 2, 3, 4], 'the wider undated ripening interval must not extend the farm reference');
});


test('projected food labels stay readable while small positive harvests remain visible', () => {
  assert.equal(projectedKgLabel([66.27, 66.27]), '66.3 kg');
  assert.equal(projectedKgLabel([0.083, 0.4]), '0.083–0.4 kg');
});


test('seedling flowering never becomes the first food crop age for clonal Guava stock', () => {
  const first = PERENNIAL_HARVEST['psidium-guajava'].yearsToFirstCrop;
  assert.ok(first);
  assert.deepEqual(first.value, [1, 1], 'ICRAF gives clonal first-year bearing; seedling flowering within two years is not a fruit crop');
  assert.match(first.source.quote, /clonally propagated trees.*begin to bear.*first year/i);
  assert.doesNotMatch(first.source.quote, /seedlings.*flower/i);
  assert.match(first.note ?? '', /clonally propagated stock only/i);
  assert.match(first.note ?? '', /no seed-grown first fruit age/i);
  assert.deepEqual(placedTreeGroups([{ defId: 'tree_guava', status: 'existing' }]), [], 'the sourced clonal age does not override the existing catalogue restriction');
});

test('spiny monkey orange review values retain their geography and period without becoming South African farm forecasts', () => {
  const harvest = PERENNIAL_HARVEST['strychnos-spinosa'];
  assert.deepEqual(harvest.yearsToFirstCrop?.value, [3, 5], 'retain the review statement with its actual citation geography');
  assert.match(harvest.yearsToFirstCrop?.note ?? '', /Benin, West Africa/);
  assert.match(harvest.yearsToFirstCrop?.note ?? '', /not a locally validated age/);
  assert.deepEqual(harvest.yieldKgPerTree?.value, [40, 100], 'preserve the original per-plant weight without manufacturing an annual rate');
  assert.match(harvest.yieldKgPerTree?.note ?? '', /without an annual period, mature age/);
  assert.match(harvest.yieldKgPerTree?.note ?? '', /do not relabel it kg\/year/);
  assert.deepEqual(harvest.windows, [], 'an interval whose harvest locality is unstated cannot claim a general South African season');
  assert.ok(harvest.supplementaryReferences?.some(reference => /harvested between August and December/.test(reference.source.quote) && /does not identify a locality/.test(reference.note)));
  assert.ok(harvest.supplementaryReferences?.some(reference => /study.*Benin/.test(reference.source.quote) && /West Africa/.test(reference.note)));
  const groups = placedTreeGroups([{ defId: 'tree_other', speciesId: harvest.speciesId, status: 'existing' }]);
  assert.equal(groups.length, 1);
  assert.deepEqual(planningTreeSeasons(groups, ['subtropical-coast']), [], 'unverified review geography must not become a warm-coast calendar');
  const projectionStart = 2027 * 12;
  const projection = treeAgeProjection(groups[0], { months: [], bearing: false, production: [{ status: 'existing', plants: 1, planted: '2010-01', yields: [] }] }, projectionStart, projectionStart + 11);
  assert.equal(projection.kg, null, 'even an established plant needs an entered annual yield schedule; source kg/plant is not kg/year');
  assert.deepEqual(projection.knownKg, [0, 0], 'no source weight can silently fill the known annual subtotal');
});
