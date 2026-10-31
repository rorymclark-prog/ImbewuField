import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPECIES } from '@/lib/species-catalog';
import { canonicalSpeciesId, SPECIES_ID_ALIASES } from '@/lib/species-aliases';
import {
  PERENNIAL_HARVEST, perennialHarvestFor, placedTreeGroups, cleanTreeSeasonChoices,
  confirmedTreeMonths, buildTreeAvailability, isHouseholdFoodHarvest,
} from '@/lib/perennial-harvest';
import { planningTreeSeasons, buildProductGuidance } from '@/lib/production-product-guidance';
import { treeAgeProjection } from '@/lib/production-projection';
import { buildProductionAvailabilityGraphs } from '@/lib/crop-export-availability';
import { sanitiseProductionRecords } from '@/lib/production-records';
import { harvestFromDossier } from '../scripts/build-perennial-harvest.mjs';

const bridges = [
  ['harpephyllum-afrum', 'harpephyllum-caffrum'],
  ['prunus-persica-low-chill-cultivars-200-500-chill-units', 'prunus-persica'],
  ['prunus-persica-low-chill-arc-infruitec-selections', 'prunus-persica'],
  ['olea-europaea-subsp-africana-o-e-subsp-cuspidata', 'olea-europaea-subsp-africana'],
  ['olea-europaea-subsp-africana-subsp-cuspidata', 'olea-europaea-subsp-africana'],
  ['olea-europaea-subsp-cuspidata', 'olea-europaea-subsp-africana'],
  ['salvia-rosmarinus-rosmarinus-officinalis', 'salvia-rosmarinus'],
] as const;
const catalogueIds = new Set(SPECIES.map(species => species.id));
const date = { year: 2027, month: 1 };
const emptyAvailability = { yearMode: 'fromToday' as const, bands: [], utilization: [0] };

// Counts and entered amounts below are synthetic regression fixtures, not farming advice.
test('live equivalent names reach verified evidence without retiring the farmer’s map identity', () => {
  for (const [live, evidence] of bridges) {
    assert.ok(catalogueIds.has(live));
    assert.equal(canonicalSpeciesId(live), live);
    assert.equal(SPECIES_ID_ALIASES[live], undefined);
    const source = structuredClone(PERENNIAL_HARVEST[evidence]);
    const linked = perennialHarvestFor(live);
    assert.ok(linked, `${live} must reach its retained source dossier`);
    assert.equal(linked.speciesId, live);
    assert.equal(linked.evidenceSpeciesId, evidence);
    assert.deepEqual(linked.windows, source.windows);
    assert.deepEqual(linked.supplementaryReferences, source.supplementaryReferences);
    assert.deepEqual(PERENNIAL_HARVEST[evidence], source, 'reading a bridge must not rewrite the source record');
  }
});

test('two live wild-olive choices retain separate plant counts and farmer dates despite sharing evidence', () => {
  const first = bridges[3][0], second = bridges[5][0];
  const items = [
    { defId: 'tree_avocado', speciesId: first, status: 'existing' as const },
    { defId: 'tree_avocado', speciesId: first, status: 'existing' as const },
    { defId: 'tree_avocado', speciesId: second, status: 'proposed' as const },
  ];
  const before = structuredClone(items);
  const groups = placedTreeGroups(items);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find(group => group.harvest.speciesId === first)?.existing, 2);
  assert.deepEqual(groups.find(group => group.harvest.speciesId === second)?.proposed, 1);
  const choices = cleanTreeSeasonChoices({
    [first]: { months: [1], bearing: true },
    [second]: { months: [8], bearing: true },
  });
  assert.deepEqual(Object.keys(choices).sort(), [first, second].sort());
  assert.deepEqual(buildTreeAvailability(groups, [1, 8], false, choices).map(slot => slot.map(row => [row.speciesId, row.trees])), [
    [[first, 2]], [[second, 1]],
  ]);
  assert.deepEqual(items, before, 'production lookup must not mutate saved map items');
  const records = sanitiseProductionRecords([first, second].map((id, index) => ({
    id: `separate-${index}`, sourceIconKey: `tree:${id}`, label: 'Synthetic separate wild olive',
    date, quantity: index + 1, unit: 'kg' as const, status: 'actual' as const,
  })));
  assert.deepEqual(records.map(record => [record.sourceIconKey, record.quantity]), [
    [`tree:${first}`, 1], [`tree:${second}`, 2],
  ], 'source equivalence must not merge independent saved quantity records');
});

test('generic low-chill peach choices expose named references without selecting a cultivar or joining seasons', () => {
  const groups = placedTreeGroups(bridges.slice(1, 3).map(([speciesId]) => ({ defId: 'tree_avocado', speciesId })));
  assert.equal(groups.length, 2);
  assert.ok(groups.every(group => group.harvest.windows.length > 0), 'the verified cultivar references remain available');
  assert.deepEqual(planningTreeSeasons(groups, ['western-cape']), [], 'a generic saved choice must not silently become Earligold');
  assert.deepEqual(buildTreeAvailability(groups, [12, 1], true), [[], []], 'source references do not supply actual food');
  const guide = buildProductGuidance({ trees: groups, animals: [] }, ['western-cape']);
  for (const item of guide.foodForest) {
    assert.match(item.lines.join(' '), /actual peach or nectarine cultivar/);
    assert.match(item.lines.join(' '), /does not select Earligold, Cederberg or Afrisun/);
    assert.equal(item.expectedSeason, undefined);
  }
});

test('a combined lemon and mandarin choice stays one unresolved plant until its actual product is selected', () => {
  // This identity hold exercises a standing plant. An unmarked item is a proposal under
  // the canvas contract, so the fixture must record existing status explicitly.
  const item = { defId: 'tree_avocado', speciesId: 'citrus-reticulata-citrus-limon', status: 'existing' as const };
  const groups = placedTreeGroups([item]);
  assert.equal(groups.length, 1);
  const group = groups[0];
  assert.equal(group.existing, 1);
  assert.equal(isHouseholdFoodHarvest(group.harvest), false);
  assert.deepEqual(group.harvest.windows, []);
  assert.equal(group.harvest.yieldKgPerTree, null);
  const choices = cleanTreeSeasonChoices({ [item.speciesId]: {
    months: [1, 6], bearing: true,
    production: [{ status: 'existing', plants: 1, planted: '2016-01', yields: [{ age: 1, kg: 4 }] }],
  } });
  assert.deepEqual(choices[item.speciesId]?.months, [1, 6], 'the hold retains the original observation for review');
  assert.deepEqual(confirmedTreeMonths(group.harvest, choices), []);
  assert.deepEqual(buildTreeAvailability(groups, [1, 6], true, choices), [[], []]);
  assert.deepEqual(planningTreeSeasons(groups, ['western-cape']), []);
  assert.deepEqual(planningTreeSeasons(groups, ['subtropical-coast']), []);
  assert.equal(treeAgeProjection(group, choices[item.speciesId], 2027 * 12, 2027 * 12 + 11).kg, null);
  const graph = buildProductionAvailabilityGraphs({
    availability: emptyAvailability, dates: [date], growingAreaM2: 0,
    productionRecords: [{ id: 'unresolved', sourceIconKey: `tree:${item.speciesId}`, label: 'Unselected citrus', date, quantity: 4, unit: 'kg', status: 'actual' }],
  });
  assert.equal(graph.months[0].freshCount, 0, 'a generic record cannot resolve the actual citrus product');
  const selected = placedTreeGroups([{ ...item, speciesId: 'citrus-limon' }]);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].harvest.speciesId, 'citrus-limon');
  assert.equal(selected[0].existing, 1);
  assert.equal(isHouseholdFoodHarvest(selected[0].harvest), true);
  assert.ok(selected[0].harvest.windows.length > 0);
  assert.equal(item.speciesId, 'citrus-reticulata-citrus-limon');
});

const annualIds = ['cajanus-cajan', 'lablab-purpureus', 'lupinus-angustifolius'] as const;
test('verified SA annual trial references reach mapped guidance without becoming generic calendar, age or plant kg', () => {
  for (const id of annualIds) {
    assert.ok(catalogueIds.has(id));
    const dossier = JSON.parse(readFileSync(new URL(`../research/perennial-sources/${id}.json`, import.meta.url), 'utf8'));
    const generated = harvestFromDossier(dossier);
    const live = perennialHarvestFor(id);
    assert.deepEqual(live, generated, `${id} must be included in the shared generated authority`);
    assert.ok(live);
    assert.deepEqual(live.windows, []);
    for (const key of ['yearsToFirstCrop', 'yearsToFullBearing', 'yieldKgPerTree', 'chillUnits', 'pollination'] as const) assert.equal(live[key], null);
    assert.ok(live.supplementaryReferences?.every(reference => reference.source.url && reference.note));
    const groups = placedTreeGroups([{ defId: 'tree_avocado', speciesId: id, status: 'proposed' }]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].referenceMissing, undefined);
    assert.deepEqual(planningTreeSeasons(groups, ['subtropical-coast']), []);
    const guide = buildProductGuidance({ trees: groups, animals: [] }, ['subtropical-coast']).foodForest[0];
    assert.ok(guide.sources?.length);
    assert.ok(guide.lines.some(line => /trial|Trial|reference|Reference/.test(line)));
  }
  const pigeon = perennialHarvestFor(annualIds[0])!;
  assert.match(pigeon.supplementaryReferences![0].note, /ICPL 88039 127 \/ 1823/);
  const lablab = perennialHarvestFor(annualIds[1])!;
  assert.match(lablab.supplementaryReferences![0].note, /CPI 52552 99\.3 \/ 576\.2/);
  assert.match(lablab.supplementaryReferences![0].note, /Rongai black 197\.0 \/ 2\.6/);
  const lupin = perennialHarvestFor(annualIds[2])!;
  assert.match(lupin.supplementaryReferences![0].note, /Swellendam 12 May \/ 1003–1289/);
  assert.match(lupin.supplementaryReferences![0].note, /estimate harvest losses, not weighed harvest/);
});

test('food-qualified annual observations remain farm evidence while unqualified feed lupin stays out of food totals', () => {
  const graph = buildProductionAvailabilityGraphs({
    availability: emptyAvailability, dates: [date], growingAreaM2: 0,
    productionRecords: annualIds.map((id, index) => ({
      id: `annual-${index}`, sourceIconKey: `tree:${id}`, label: 'Synthetic recorded food', date,
      quantity: index + 1, unit: 'kg' as const, status: 'actual' as const,
    })),
  });
  assert.deepEqual(graph.months[0].fresh.map(row => row.iconKey), ['tree:cajanus-cajan', 'tree:lablab-purpureus']);
  assert.equal(isHouseholdFoodHarvest(perennialHarvestFor('lupinus-angustifolius')!), false);
});
