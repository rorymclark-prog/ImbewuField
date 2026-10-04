import assert from 'node:assert/strict';
import test from 'node:test';

import { buildProductionGuide } from '@/lib/crop-export-schedule';
import { CROP_VARIETY_DATA } from '@/lib/crop-varieties-data';
import type { Planting } from '@/lib/crop-plan';
import type { ReportedProduction, SiteSurvey } from '@/lib/site-survey';

function survey(extra: Partial<SiteSurvey> = {}): SiteSurvey {
  return {
    siteId: 'site:-29.80000,30.80000', placeId: 'farm-a', savedAt: '2026-10-02T08:00:00Z',
    siteType: 'community', adults: '2-5', goals: ['food'],
    waterSource: ['municipal'], waterDelivery: ['drip'], waterStorage: ['jojo'],
    roofMainM2: null, roofSecondaryM2: null, hasGutters: false,
    landPrepMethod: 'hand', soilCondition: 'unknown', soilAmendments: [], hasFencing: 'partial',
    existingCrops: ['vegetables', 'fruit-trees'], existingGrowingAreaM2: null,
    livestock: ['chickens', 'bees'], otherInfra: [], farmingPractice: 'mostly-organic',
    challenges: [], isCommercial: false, notes: '', ...extra,
  };
}

function production(extra: Partial<ReportedProduction> = {}): ReportedProduction {
  return { category: 'eggs', quantityPerYear: null, unit: 'eggs', usedByHousehold: null, sold: null, incomeZar: null, ...extra };
}

const planting = (cropKey = 'carrots', extra: Partial<Planting> = {}): Planting =>
  ({ id: 'p1', bedId: 'b1', cropKey, sowMonth: 3, ...extra });

test('an unanswered survey cannot acquire growing-water, frost or production facts from infrastructure', () => {
  const missing = buildProductionGuide(null, [planting()], []);
  const unanswered = buildProductionGuide(survey(), [planting()], []);
  assert.deepEqual(unanswered.siteObservations, missing.siteObservations,
    'municipal water, drip and a tank do not prove reliable dry-season supply');
  assert.deepEqual(unanswered.recordedProduction, []);
  assert.match(JSON.stringify(unanswered), /not recorded|Not recorded/);
  assert.match(unanswered.area, /not resolved/);
  assert.match(unanswered.cropChoices[0].lines.join(' '), /no local shortlist is claimed/);
  assert.doesNotMatch(unanswered.cropChoices[0].lines.join(' '), /Research shortlist for similar climates:/);
});

test('opening another site cannot retain the previous farm observations, production or climate shortlist', () => {
  const first = survey({
    productionYear: 2025,
    productionConditions: { frost: 'yes', frostMonths: [8, 6], drySeasonWater: 'limited', sunlight: 'part-shade', drainage: 'stays-wet' },
    reportedProduction: [production({ quantityPerYear: 120, harvestMonths: [1, 8] })],
  });
  const before = structuredClone(first);
  const guideA = buildProductionGuide(first, [planting('carrots', { variety: 'Scarlet Nantes' })], ['highveld']);
  const guideB = buildProductionGuide(survey({ siteId: 'site:-33.90000,18.50000', placeId: 'farm-b' }), [], []);
  assert.match(JSON.stringify(guideA), /Frost has been observed here in Jun, Aug/);
  assert.match(JSON.stringify(guideA), /120 eggs/);
  assert.deepEqual(guideB.recordedProduction, []);
  assert.deepEqual(guideB.cropChoices, []);
  assert.doesNotMatch(JSON.stringify(guideB), /120 eggs|Scarlet Nantes|Jun, Aug|limited growing water/);
  assert.deepEqual(first, before, 'building a guide must not change the recorded survey');
  assert.deepEqual(buildProductionGuide(first, [planting('carrots', { variety: 'Scarlet Nantes' })], ['highveld']), guideA,
    'switching site must not alter a later reading of the same explicit inputs');
});

test('an annual survey keeps its own year, units and observed months without becoming future production', () => {
  const record = production({ quantityPerYear: 120, usedByHousehold: 80, sold: 40, harvestMonths: [1, 8] });
  const guide = buildProductionGuide(survey({ productionYear: 2025, reportedProduction: [record] }), [], []);
  assert.equal(guide.recordedProduction.length, 1);
  assert.deepEqual(guide.recordedProduction[0], {
    title: 'Eggs', lines: [
      'Farmer-reported annual total for 2025: 120 eggs.',
      'Household use: 80 eggs. Sold: 40 eggs.',
      'Reported harvest months: Jan, Aug. These are survey observations, not a new production forecast.',
    ],
  });
  assert.deepEqual(Object.keys(guide).sort(), ['area', 'cropChoices', 'recordedProduction', 'siteObservations']);
  assert.deepEqual(guide.cropChoices, [], 'historical egg or honey reports must not create crop plantings');
});

test('a blank reporting year, total or month stays unknown regardless of when the survey was saved', () => {
  const guide = buildProductionGuide(survey({
    savedAt: '2026-10-02T08:00:00Z', updatedAt: Date.parse('2026-10-02T08:00:00Z'),
    reportedProduction: [production({ sold: 0 })],
  }), [], []);
  const text = guide.recordedProduction[0].lines.join(' ');
  assert.match(text, /annual total - reporting year not recorded: not recorded/);
  assert.match(text, /Household use: not recorded\. Sold: 0 eggs/);
  assert.match(text, /Reported harvest months: not recorded/);
  assert.doesNotMatch(text, /for 2026|Jan|October/);
  assert.doesNotMatch(guide.recordedProduction[0].lines[0], /: 0 eggs/,
    'the blank annual total stays unknown even when the farmer explicitly recorded zero sales');
});

test('an unfinished draft cannot print a future historical year or wrap an invalid month into January', () => {
  for (const year of [new Date().getFullYear() + 1, 1899, 2025.5, Number.NaN]) {
    const record = production({ quantityPerYear: 0, harvestMonths: [13, 0, 7.5, Number.NaN, 8, 8, 6] });
    const guide = buildProductionGuide(survey({ productionYear: year, reportedProduction: [record] }), [], []);
    const text = guide.recordedProduction[0].lines.join(' ');
    assert.match(text, /reporting year not recorded: 0 eggs/);
    assert.match(text, /Reported harvest months: Jun, Aug\./);
    assert.doesNotMatch(text, /Jan|undefined|NaN/);
  }
});

test('invalid draft quantities remain unknown and inconsistent declared totals remain visible for review', () => {
  for (const value of [Number.NaN, Infinity, -1]) {
    const guide = buildProductionGuide(survey({ reportedProduction: [production({ quantityPerYear: value, usedByHousehold: value, sold: value })] }), [], []);
    const text = guide.recordedProduction[0].lines.join(' ');
    assert.match(text, /annual total - reporting year not recorded: not recorded/);
    assert.match(text, /Household use: not recorded\. Sold: not recorded/);
    assert.match(text, /Check the recorded unit and totals/);
    assert.doesNotMatch(text, /NaN|Infinity|∞|-1 eggs/);
  }
  const guide = buildProductionGuide(survey({ reportedProduction: [production({ quantityPerYear: 100, usedByHousehold: 80, sold: 30, unit: '' })] }), [], []);
  const text = guide.recordedProduction[0].lines.join(' ');
  assert.match(text, /100 \(unit not recorded\)/);
  assert.match(text, /80 \(unit not recorded\).*30 \(unit not recorded\)/);
  assert.match(text, /Check the recorded unit and totals/);
});

test('the variety guide only follows active crop records and keeps each chosen packet name once', () => {
  const rows = [
    planting('carrots', { id: 'a', variety: ' Scarlet Nantes ' }),
    planting('carrots', { id: 'b', variety: 'Scarlet Nantes' }),
    planting('carrots', { id: 'c', variety: 'Farmer packet name' }),
    planting('green-beans', { id: 'pending', variety: 'Contender', awaitingSowingConfirmation: true }),
    planting('oats', { id: 'finished', variety: 'Overberg', finishedOnceSowing: true }),
    planting('not-a-catalogue-crop', { id: 'unknown' }),
  ];
  const before = structuredClone(rows);
  const guide = buildProductionGuide(null, rows, ['highveld']);
  assert.equal(guide.cropChoices.length, 1);
  assert.equal(guide.cropChoices[0].title, 'Carrots');
  assert.equal(guide.cropChoices[0].lines[0], 'Recorded variety: Scarlet Nantes; Farmer packet name.');
  assert.doesNotMatch(JSON.stringify(guide), /Contender|Overberg|not-a-catalogue-crop/);
  const sources = guide.cropChoices[0].sources ?? [];
  assert.equal(new Set(sources.map((s) => JSON.stringify(s))).size, sources.length, 'a crop planted twice must not repeat its source list');
  assert.deepEqual(rows, before);
});

test('recording a researched cultivar preserves its source even outside the inferred climate shortlist', () => {
  const known = CROP_VARIETY_DATA['sweet-potato'].varieties.find((v) => v.name === 'Bophelo');
  assert.ok(known && known.zones.length === 0, 'this fixture must exercise an ungrouped research option');
  const guide = buildProductionGuide(null, [planting('sweet-potato', { variety: 'Bophelo' })], []);
  assert.equal(guide.cropChoices[0].lines[0], 'Recorded variety: Bophelo.');
  assert.match(guide.cropChoices[0].lines[1], /no local shortlist is claimed/);
  assert.ok(guide.cropChoices[0].sources?.some((source) => source.url === known.sources[0].url));
  assert.doesNotMatch(guide.cropChoices[0].lines.join(' '), /local fit|suitable for your farm|66g|vitamin/);
});

test('a climate shortlist never copies unverified maturity, traits, season or zone instructions', () => {
  const guide = buildProductionGuide(null, [planting('carrots')], ['highveld']);
  const choice = guide.cropChoices[0];
  assert.match(choice.lines[1], /Research shortlist for similar climates:/);
  assert.ok(choice.sources?.length);
  const text = choice.lines.join(' ');
  for (const option of CROP_VARIETY_DATA.carrots.varieties) {
    for (const value of [option.season, option.traits, option.maturity]) {
      if (value) assert.ok(!text.includes(value), `the ${value} summary leaked into farming instructions`);
    }
  }
  assert.doesNotMatch(text, /cool-season only|days|kg|high yield|seed can be saved|frost-free/);
});

test('fruit berries eggs and honey reports retain distinct labels and their chosen units', () => {
  const rows: ReportedProduction[] = [
    production({ category: 'fruit', quantityPerYear: 20, unit: 'kg', harvestMonths: [12] }),
    production({ category: 'nuts_berries', quantityPerYear: 5, unit: 'kg' }),
    production({ category: 'eggs', quantityPerYear: 0, unit: 'eggs' }),
    production({ category: 'honey', quantityPerYear: 2, unit: 'jars', harvestMonths: [4] }),
  ];
  const guide = buildProductionGuide(survey({ reportedProduction: rows }), [], []);
  assert.deepEqual(guide.recordedProduction.map((row) => row.title), ['Fruit', 'Nuts and berries', 'Eggs', 'Honey']);
  assert.match(guide.recordedProduction[3].lines[0], /2 jars/);
  assert.match(guide.recordedProduction[2].lines[0], /0 eggs/);
  assert.equal(guide.recordedProduction.length, rows.length);
});

test('observed frost checks planned field occupancy without repeating an already finished observed crop', () => {
  const observations = survey({ productionConditions: { frost: 'yes', frostMonths: [12, 7, 6] } });
  const rows = [
    planting('tomatoes', { id: 'future', sowMonth: 4 }),
    planting('tomatoes', { id: 'duplicate', sowMonth: 4 }),
    planting('tomatoes', { id: 'already-picked', sowMonth: 4, existing: true }),
    planting('green-beans', { id: 'pending', sowMonth: 6, awaitingSowingConfirmation: true }),
    planting('maize', { id: 'finished', sowMonth: 6, finishedOnceSowing: true }),
    planting('carrots', { id: 'hardier', sowMonth: 4 }),
  ];
  const guide = buildProductionGuide(observations, rows, [], 10);
  const warning = guide.siteObservations.find(item => item.title === 'Planned crops to check for frost');
  assert.ok(warning, 'a manually saved tender crop must be checked as well as an auto-suggested crop');
  assert.equal(warning.lines[0], 'Tomatoes: Jun, Jul.');
  assert.equal(warning.lines.length, 2, 'duplicate cohorts should not repeat the same warning');
  assert.doesNotMatch(warning.lines.join(' '), /Dec|Carrots|Maize|Green beans|already-picked|future/);
  const oldOnly = buildProductionGuide(observations, rows.slice(2), [], 10);
  assert.equal(oldOnly.siteObservations.length, 3,
    'a past confirmed cohort must not acquire next winter\'s frost months');
});

test('unknown or unobserved frost does not infer a frost-free guarantee or a planned conflict', () => {
  for (const frost of [undefined, 'unknown', 'no'] as const) {
    const guide = buildProductionGuide(survey({ productionConditions: { frost, frostMonths: [6, 7] } }), [planting('tomatoes', { sowMonth: 4 })], [], 10);
    assert.equal(guide.siteObservations.length, 3);
    assert.doesNotMatch(JSON.stringify(guide), /Planned crops to check|safe from frost/);
    assert.match(guide.siteObservations[1].lines.join(' '), frost === 'no'
      ? /does not establish that future winters will be frost-free/
      : /cannot establish first and last frost dates/);
  }
});

import { assumedProductSeason, planningTreeSeasons, buildProductGuidance, productContextFromItems, productPurchasingMarkdown, PRODUCT_PROFILES } from '@/lib/production-product-guidance';
import { placedTreeGroups, buildTreeAvailability } from '@/lib/perennial-harvest';
import { SPECIES } from '@/lib/species-catalog';
import { GROWING_ZONE_IDS } from '@/lib/growing-zones';
import { ANIMAL_ENTERPRISES, placedAnimalGroups, buildAnimalAvailability } from '@/lib/animal-enterprises';

test('a warm or cool avocado assumption uses Hass alone rather than the country-wide cultivar union', () => {
  const context = productContextFromItems([{ defId: 'tree_avocado', status: 'proposed' }]);
  assert.deepEqual(assumedProductSeason(context.trees[0], ['subtropical-coast', 'lowveld-bushveld'])?.months, [6, 7, 8, 9, 10]);
  assert.deepEqual(assumedProductSeason(context.trees[0], ['midlands-mistbelt', 'highveld'])?.months, [8, 9, 10, 11, 12]);
  for (const zones of [[], ['high-mountain'], ['karoo-arid'], ['subtropical-coast', 'midlands-mistbelt']] as const) {
    assert.equal(assumedProductSeason(context.trees[0], zones), undefined, 'unresolved, hard-frost or contradictory area must not get one invented local season');
  }
  for (const conditions of [{ frost: 'yes' }, { drainage: 'stays-wet' }, { sunlight: 'mostly-shade' }] as const) {
    assert.equal(assumedProductSeason(context.trees[0], ['subtropical-coast'], conditions), undefined);
  }
  const guide = buildProductionGuide(null, [], ['subtropical-coast'], 10, context);
  assert.match(JSON.stringify(guide.foodForest), /Assumed variety: Hass|not a confirmed crop this year/);
  assert.ok(buildTreeAvailability(context.trees, [6, 7, 8], true).every(slot => !slot.length), 'research assumptions never silently feed current food availability');
});

test('purchase advice stages fruit cultivars but requires flowering compatibility separately', () => {
  const items = [{ defId: 'tree_avocado' }, { defId: 'tree_other', speciesId: 'carya-illinoinensis' }, { defId: 'tree_other', speciesId: 'prunus-salicina' }];
  const text = productPurchasingMarkdown(productContextFromItems(items), ['subtropical-coast']);
  assert.match(text, /earlier Fuerte.*middle Hass.*later Ryan/);
  assert.match(text, /seasons overlap/);
  assert.match(text, /Ukulinga.*Cape Fear.*Choctaw/);
  assert.match(text, /Pioneer or African Rose/);
  assert.match(text, /compatible flowering is a separate/);
  assert.match(text, /inventory, not repeat purchases/);
});

test('circle counts, tropical variety assumptions and missing dates survive in the shared product guide', () => {
  const items = [{ defId: 'banana_circle', status: 'proposed' as const }, { defId: 'banana_clump' }, { defId: 'tree_pawpaw', status: 'proposed' as const }];
  const before = structuredClone(items);
  const context = productContextFromItems(items);
  const guide = buildProductGuidance(context, ['subtropical-coast']);
  const banana = guide.foodForest.find(item => item.title.includes('Banana'))!;
  assert.match(banana.lines.join(' '), /1 existing; 3 proposed/);
  assert.match(banana.lines.join(' '), /3 planted bananas/);
  assert.match(banana.lines.join(' '), /13–20 months.*Grand Nain/);
  assert.match(guide.foodForest.find(item => /pawpaw/i.test(item.title))!.lines.join(' '), /18 months.*9–11.*Sunrise Solo/);
  assert.equal(banana.expectedSeason, undefined, 'an elapsed first-bunch range supplies no fixed picking months');
  assert.deepEqual(items, before);
});

test('mapped coops and hives get product choices without becoming laying hens or populated colonies', () => {
  const context = productContextFromItems([{ defId: 'chicken_coop', status: 'proposed' }, { defId: 'beehive' }]);
  const unselected = buildProductGuidance(context, ['subtropical-coast']);
  assert.equal(unselected.animalProducts.length, 2, 'unselected housing stays one simple options card');
  assert.match(JSON.stringify(unselected.animalProducts), /No animal count or production dates assumed/);
  assert.match(JSON.stringify(unselected.animalProducts), /Koekoek|commercial layers/);
  const selected = buildProductGuidance({ ...context, animalChoices: { chicken: 'chicken-layer', bee: 'bees' } }, ['subtropical-coast']);
  assert.match(JSON.stringify(selected.animalProducts), /vaccinated point-of-lay|rainfall/);
  assert.ok(buildAnimalAvailability(context.animals, { chicken: 'chicken-layer', bee: 'bees' }, [1, 2], true).every(slot => !slot.length));
  const invalid = buildProductGuidance({ ...context, animalChoices: { bee: 'chicken-layer' } }, []);
  assert.match(invalid.animalProducts.find(item => item.title.startsWith('Bees'))!.title, /choose the product/);
});

test('indigenous food guidance retains edible portions and species-specific conditions without fake cultivars', () => {
  const items = ['strychnos-spinosa', 'syzygium-cordatum', 'rhoicissus-tomentosa', 'pappea-capensis'].map(speciesId => ({ defId: 'tree_other', speciesId }));
  const guide = buildProductGuidance(productContextFromItems(items), ['subtropical-coast']);
  const text = JSON.stringify(guide.foodForest);
  assert.match(text, /Seeds and unripe fruit are toxic/);
  assert.match(text, /Tuberous roots are poisonous/);
  assert.match(text, /Water-loving/);
  assert.match(text, /not presented here as cooking oil/);
  assert.doesNotMatch(text, /medicinal|cure|nitrogen.fix/);
});

test('all profiles refer to existing identities, and every area and animal enterprise can render a sourced guide', () => {
  for (const [id, profile] of Object.entries(PRODUCT_PROFILES)) {
    assert.ok(SPECIES.some(species => species.id === id), `${id}: do not create a new species through a care card`);
    assert.ok(profile.sources.length);
    assert.ok(profile.sources.every(source => /^https:\/\//.test(source.url)));
  }
  const trees = placedTreeGroups(Object.keys(PRODUCT_PROFILES).map(speciesId => ({ defId: 'tree_other', speciesId, status: 'proposed' })));
  for (const zone of GROWING_ZONE_IDS) {
    const guide = buildProductGuidance({ trees, animals: [] }, [zone]);
    assert.equal(guide.foodForest.length, trees.length);
    for (const item of guide.foodForest) assert.ok(item.sources?.length);
  }
  for (const enterprise of Object.values(ANIMAL_ENTERPRISES)) {
    const defId = enterprise.animal === 'cattle' || enterprise.animal === 'sheep' ? 'kraal' : { chicken: 'chicken_coop', goat: 'goat_pen', bee: 'beehive', rabbit: 'rabbit_hutch', duck: 'duck_pond', pig: 'pig_pen', fish: 'pond_small' }[enterprise.animal];
    const animals = placedAnimalGroups([{ defId }]);
    assert.equal(animals.length, 1, `${enterprise.name}: fixture must exercise mapped housing`);
    const guide = buildProductGuidance({ trees: [], animals, animalChoices: { [animals[0].housing]: enterprise.enterpriseId } }, ['highveld']);
    assert.equal(guide.animalProducts.length, 1);
    assert.ok(guide.animalProducts[0].sources?.length);
    assert.match(guide.animalProducts[0].lines.join(' '), /No animal head count or output is assumed/);
    if (enterprise.product === 'wool') assert.match(guide.animalProducts[0].lines.join(' '), /non-food/);
  }
});


test('regional planning covers fruit, nuts and berries without flattening lemon climates or berry systems', () => {
  const groups = placedTreeGroups(['citrus-limon', 'macadamia-integrifolia', 'carica-papaya', 'litchi-chinensis', 'fragaria-x-ananassa', 'vaccinium-corymbosum', 'rubus-idaeus', 'carya-illinoinensis'].map(speciesId => ({ defId: 'tree_other', speciesId, status: 'proposed' })));
  const season = (id: string, zones: Parameters<typeof assumedProductSeason>[1], conditions?: Parameters<typeof assumedProductSeason>[2]) => assumedProductSeason(groups.find(g => g.harvest.speciesId === id)!, zones, conditions);
  assert.deepEqual(season('citrus-limon', ['subtropical-coast'])?.months, [2, 3]);
  assert.deepEqual(season('citrus-limon', ['midlands-mistbelt'])?.months, [5, 6, 7]);
  assert.deepEqual(season('fragaria-x-ananassa', ['western-cape'])?.months, [9, 10, 11, 12]);
  assert.deepEqual(season('fragaria-x-ananassa', ['subtropical-coast'], { frost: 'no' })?.months, [5, 6, 7, 8]);
  assert.equal(season('fragaria-x-ananassa', ['highveld']), undefined, 'a tunnel window cannot become an outdoor Highveld season');
  assert.deepEqual(season('vaccinium-corymbosum', ['western-cape'])?.months, [8, 9, 10, 11]);
  assert.equal(season('vaccinium-corymbosum', ['subtropical-coast']), undefined, 'national blueberry supply cannot fill a warm farm calendar');
  assert.match(season('rubus-idaeus', ['midlands-mistbelt'])?.basis ?? '', /Spring-bearing.*not use.*autumn-bearing/);
  assert.equal(season('carya-illinoinensis', ['karoo-arid']), undefined, 'a mapped pecan does not prove irrigation');
  assert.deepEqual(season('carya-illinoinensis', ['karoo-arid'], { drySeasonWater: 'reliable' })?.months, [3, 4, 5, 6]);
  assert.deepEqual(season('litchi-chinensis', ['lowveld-bushveld'])?.months, [11, 12, 1]);
  assert.match(season('litchi-chinensis', ['lowveld-bushveld'])?.label ?? '', /Mauritius/);
  assert.ok(!season('litchi-chinensis', ['lowveld-bushveld'])?.months.includes(2), 'later Wai Chee cannot extend the assumed Mauritius season');
  for (const zone of GROWING_ZONE_IDS) {
    const rows = planningTreeSeasons(groups, [zone], { drySeasonWater: 'reliable' });
    for (const row of rows) {
      assert.ok(row.season.source?.url);
      assert.ok(row.season.months.length && row.season.months.every(month => month >= 1 && month <= 12));
      assert.match(row.season.basis, /when established.*confirm local/i);
    }
    if (zone === 'high-mountain') assert.deepEqual(rows, []);
  }
  assert.deepEqual(planningTreeSeasons(groups, []), []);
  const avocado = placedTreeGroups([{ defId: 'tree_avocado', status: 'existing' }]);
  assert.equal(planningTreeSeasons(avocado, ['subtropical-coast'], undefined, { 'persea-americana': { bearing: true, months: [7] } }).length, 0, 'confirmed July replaces the entire reference; no invented June/October extension');
});
