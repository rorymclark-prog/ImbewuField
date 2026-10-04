// The printed "Food availability" page and the month axis it shares with the app's charts.
// Rory, 2026-09-29, on the availability chart: "i dont know what month this is?" and "i would
// prefer icons of fruoit and berrues just like the others so a 3rd, 4th litle box after staple
// crops animal products and food forest pruducts etc with icons".

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { monthAxisSlots } from '@/lib/month-axis';
import { animalEntries, forestEntries, printableAvailability } from '@/lib/crop-export-availability';
import { pdfIconUrl } from '@/lib/pdf-icons';
import { speciesFruitArtworkUrl, speciesPickerArtworkUrl } from '@/lib/species-art';
import { buildTreeAvailability, loadTreeSeasonChoices, placedTreeGroups, saveTreeSeasonChoices, unidentifiedPlantGroups } from '@/lib/perennial-harvest';
import { loadAnimalSeasonChoices, placedAnimalGroups, saveAnimalSeasonChoices } from '@/lib/animal-enterprises';
import { bindMountedAccountLocalStorageUid } from '@/lib/account-local-storage';

test('the month axis names the current month and every year it crosses', () => {
  const slots = monthAxisSlots(9, 2026, 24);
  assert.equal(slots.length, 24);
  assert.deepEqual(slots[0], { month: 9, year: 2026, isNow: true, showYear: true });
  assert.deepEqual(slots[4], { month: 1, year: 2027, isNow: false, showYear: true });
  assert.deepEqual(slots[16], { month: 1, year: 2028, isNow: false, showYear: true });
  assert.equal(slots[23].month, 8);
  assert.equal(slots[23].year, 2028);
  assert.equal(slots.filter((s) => s.isNow).length, 1);
  assert.equal(slots.filter((s) => s.showYear).length, 3);
});

test('a January start shows its year once, not twice', () => {
  const slots = monthAxisSlots(1, 2027, 12);
  assert.equal(slots.filter((s) => s.showYear).length, 1);
  assert.equal(slots[11].month, 12);
  assert.equal(slots[11].year, 2027);
});

test('forest and animal rows become labelled icon entries, one per enterprise', () => {
  const forest = forestEntries([[{ speciesId: 'mangifera-indica', name: 'Mango', trees: 3 }], []]);
  assert.deepEqual(forest, [[{ iconKey: 'tree:mangifera-indica', label: 'Mango' }], []]);

  const animals = animalEntries([[
    { enterpriseId: 'chicken-layer', animal: 'chicken', product: 'eggs', structures: 1 },
    { enterpriseId: 'chicken-layer', animal: 'chicken', product: 'eggs', structures: 2 },
    { enterpriseId: 'fish-tilapia', animal: 'fish', product: 'fish', structures: 1 },
  ]]);
  assert.equal(animals[0].length, 2);
  assert.equal(animals[0][0].iconKey, 'animal:chicken-layer');
  // The bracketed detail stays on the enterprise card; the paper key keeps the plain name.
  assert.equal(animals[0][0].label, 'Laying hens - eggs');
  assert.equal(animals[0][1].label, 'Tilapia - fish');
});

test('the print takes twelve months and respects the chart switches', () => {
  const veg = Array.from({ length: 24 }, () => []);
  const trees = Array.from({ length: 24 }, () => [{ speciesId: 'persea-americana', name: 'Avocado', trees: 1 }]);
  const animals = Array.from({ length: 24 }, () => [
    { enterpriseId: 'chicken-layer', animal: 'chicken' as const, product: 'eggs' as const, structures: 1 },
  ]);
  const utilization = Array.from({ length: 24 }, (_, i) => i / 24);
  const on = printableAvailability({ yearMode: 'fromToday', veg, utilization, trees, animals });
  assert.equal(on.yearMode, 'fromToday');
  assert.equal(on.veg?.length, 12);
  assert.equal(on.utilization?.length, 12);
  assert.equal(on.forest?.length, 12);
  assert.equal(on.animals?.length, 12);

  const off = printableAvailability({
    yearMode: 'established', veg, utilization, trees, animals, includeTrees: false, includeAnimals: false,
  });
  assert.equal(off.forest, undefined);
  assert.equal(off.animals, undefined);
  assert.equal(off.includeTrees, false, 'paper must explain the deliberate fruit switch-off');
  assert.equal(off.includeAnimals, false, 'paper must explain the deliberate animal switch-off');
});

test('every icon key resolves to the app art the chart itself shows', () => {
  assert.match(pdfIconUrl('crop:cabbage') ?? '', /^\/crop-art\/.+\.png$/);
  // A harvest calendar pictures the product, matching the app. Pinning tree PNGs
  // hid berries behind letter codes and contradicted Rory's fruit-icon request.
  for (const id of ['mangifera-indica', 'fragaria-x-ananassa', 'vaccinium-corymbosum', 'rubus-idaeus']) {
    assert.equal(pdfIconUrl(`tree:${id}`), speciesFruitArtworkUrl(id));
  }
  assert.equal(pdfIconUrl('tree:olea-europaea-subsp-europaea'), speciesPickerArtworkUrl('olea-europaea-subsp-europaea'), 'a food plant without product art keeps its own available plant picture');
  assert.equal(pdfIconUrl('animal:chicken-layer'), '/animal-art/chicken-layer.png');
  assert.equal(pdfIconUrl('element:banana_circle'), '/element-art/banana_circle-v3.png');
  assert.equal(pdfIconUrl('nonsense'), null);
  assert.equal(pdfIconUrl('planet:mars'), null);
});

test('banana, hives and coops survive printing without invented products or harvest months', () => {
  const items = [{ defId: 'banana_clump', status: 'existing' as const }, { defId: 'banana_circle', status: 'proposed' as const }, { defId: 'beehive', status: 'existing' as const }, { defId: 'chicken_coop', status: 'proposed' as const }];
  const printed = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], treeGroups: placedTreeGroups(items), unidentifiedPlants: unidentifiedPlantGroups(items), animalGroups: placedAnimalGroups(items) });
  assert.equal(printed.undated?.length, 3);
  const banana = printed.undated?.find((e) => e.iconKey === 'tree:musa-acuminata-aaa-group');
  assert.match(banana?.detail ?? '', /Picking months.*need local confirmation/);
  assert.ok(!printed.undated?.some((e) => e.label === 'Banana Circle'));
  assert.match(banana?.detail ?? '', /1 existing; 3 proposed/);
  const hives = printed.undated?.find((e) => e.label === 'Hives');
  assert.match(hives?.detail ?? '', /No product or production dates assumed/);
  assert.ok(printed.undated?.some((e) => e.label === 'Coops / chicken tractors' && e.detail.includes('1 proposed')));
  assert.ok(printed.undated?.every((e) => !!pdfIconUrl(e.iconKey)), 'retained map items have printable artwork');
  const honey = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], animalGroups: placedAnimalGroups(items), animalChoices: { bee: 'bees' } });
  assert.match(honey.undated?.find((e) => e.label.includes('honey'))?.detail ?? '', /Honey flows depend on local plants and rain/);
  assert.equal(honey.animals, undefined, 'no months silently supplied for honey');
  const hidden = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], treeGroups: placedTreeGroups(items), unidentifiedPlants: unidentifiedPlantGroups(items), animalGroups: placedAnimalGroups(items), includeTrees: false, includeAnimals: false });
  assert.deepEqual(hidden.undated, []);
});

test('food plants missing harvest research retain names counts and artwork on paper without a false banana label', () => {
  const items = [
    { defId: 'tree_other', speciesId: 'olea-europaea-subsp-europaea', status: 'existing' as const },
    { defId: 'tree_other', speciesId: 'olea-europaea-subsp-europaea', status: 'proposed' as const },
    { defId: 'tree_pear', status: 'existing' as const },
  ];
  const printed = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], treeGroups: placedTreeGroups(items), unidentifiedPlants: unidentifiedPlantGroups(items) });
  assert.equal(printed.undated?.length, 2);
  const olive = printed.undated?.find(entry => entry.label === 'Olive');
  assert.equal(olive?.iconKey, 'tree:olea-europaea-subsp-europaea');
  assert.match(olive?.detail ?? '', /1 existing; 1 proposed.*need local confirmation.*No harvest reference/);
  assert.doesNotMatch(olive?.detail ?? '', /Choose its species|Jan|all year|kg/);
  const pear = printed.undated?.find(entry => entry.label === 'Pear Tree');
  assert.equal(pear?.iconKey, 'element:tree_pear');
  assert.equal(pdfIconUrl(pear?.iconKey ?? ''), '/element-art/tree_pear.png');
  assert.ok(printed.undated?.every(entry => !!pdfIconUrl(entry.iconKey)), 'use each mapped plant\'s own available artwork');
  const hidden = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], treeGroups: placedTreeGroups(items), unidentifiedPlants: unidentifiedPlantGroups(items), includeTrees: false });
  assert.deepEqual(hidden.undated, []);
});

test('a permitted mapped food plant with no dossier uses confirmed local months consistently on screen and paper', () => {
  const items = [
    { defId: 'tree_other', speciesId: 'olea-europaea-subsp-europaea', status: 'existing' as const },
    { defId: 'tree_other', speciesId: 'olea-europaea-subsp-europaea', status: 'proposed' as const },
  ];
  const groups = placedTreeGroups(items);
  const treeSeasons = { 'olea-europaea-subsp-europaea': { bearing: true, months: [4] } };
  const slots = buildTreeAvailability(groups, [3, 4, 5], true, treeSeasons);
  const printed = printableAvailability({ yearMode: 'fromToday', veg: [], utilization: [], trees: slots, treeGroups: groups, treeSeasons });
  assert.deepEqual(printed.forest, [[], [{ iconKey: 'tree:olea-europaea-subsp-europaea', label: 'Olive' }], []]);
  assert.match(printed.undated?.[0].detail ?? '', /1 proposed.*Local months: Apr.*Proposed plants are not a current harvest.*No harvest reference/);
  assert.equal(slots[1][0].trees, 1, 'a proposed mapped plant must not inflate current output');
});

test('Simple farmers can confirm crop timing and get a picture calendar without opening All tools', () => {
  // The old Simple-mode guard excluded export/control access; Rory's audit exposed that hidden
  // enterprise selection was precisely why coops never produced a visible paper inventory.
  const page = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /<AnimalEnterprisesCard[^>]+compact=\{simple\}/);
  assert.match(page, /<TreeSeasonsCard/);
  assert.match(page, /\{simple && <CropPlanExportCard/);
  const card = readFileSync(new URL('../components/crops/CropPlanExportCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /sections: FARMER_SECTIONS/);
  assert.match(card, /sections: \['availability', 'calendar', 'taskSummary'\]/);
  assert.doesNotMatch(card, /Quick print \(2 pages\)|Two pages only/);
});

test('local harvest confirmations survive a reload without crossing farms or signed-in accounts', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const rows = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => rows.set(key, value) }, sessionStorage: { getItem: () => null } } });
  try {
    bindMountedAccountLocalStorageUid('farmer-a');
    const trees = { 'persea-americana': { months: [8, 9], bearing: true, production: [{ status: 'existing' as const, plants: 1, planted: '2016-10', yields: [{ age: 10, kg: 4 }] }] } };
    const animals = { chicken: { enterpriseId: 'chicken-indigenous', months: [10] } };
    saveTreeSeasonChoices('farm-one', trees);
    saveAnimalSeasonChoices('farm-one', animals);
    assert.deepEqual(loadTreeSeasonChoices('farm-one'), trees);
    assert.deepEqual(loadAnimalSeasonChoices('farm-one'), animals);
    assert.deepEqual(loadTreeSeasonChoices('farm-two'), {});
    assert.deepEqual(loadAnimalSeasonChoices('farm-two'), {});
    bindMountedAccountLocalStorageUid('farmer-b');
    assert.deepEqual(loadTreeSeasonChoices('farm-one'), {});
    assert.deepEqual(loadAnimalSeasonChoices('farm-one'), {});
    saveTreeSeasonChoices('farm-one', { 'persea-americana': { months: [12], bearing: true } });
    bindMountedAccountLocalStorageUid('farmer-a');
    assert.deepEqual(loadTreeSeasonChoices('farm-one'), trees, 'another account must not overwrite local observations');
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    bindMountedAccountLocalStorageUid(null);
  }
});


import { planningTreeSeasons } from '@/lib/production-product-guidance';
import { buildTreeAvailability as datedTrees } from '@/lib/perennial-harvest';

test('printed planning references follow the rolling months but stay out of confirmed food slots', () => {
  const treeGroups = placedTreeGroups([{ defId: 'tree_avocado', status: 'proposed' }]);
  const months = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const references = planningTreeSeasons(treeGroups, ['subtropical-coast']);
  const options = { yearMode: 'fromToday' as const, veg: [], utilization: [], treeGroups, trees: datedTrees(treeGroups, months, true), planning: { months, trees: references } };
  const printed = printableAvailability(options);
  assert.deepEqual(printed.forestPlanning?.map((slot, i) => slot.length ? months[i] : null).filter(Boolean), [10, 6, 7, 8, 9]);
  assert.ok(printed.forest?.every(slot => !slot.length), 'reference seasons cannot silently become confirmed picking or monthly jobs');
  assert.match(printed.forestPlanning?.[0][0].planning?.label ?? '', /Hass/);
  assert.match(printed.undated?.[0].detail ?? '', /0 existing; 1 proposed/);
  assert.equal(printableAvailability({ ...options, includeTrees: false }).forestPlanning, undefined);
});

test('age and picking edits report an unavailable device store instead of silently claiming a save', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => { throw new Error('device storage full'); } }, sessionStorage: { getItem: () => null } } });
  try {
    assert.equal(saveTreeSeasonChoices('fixture-farm', { 'persea-americana': { months: [9], bearing: true } }), false);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    bindMountedAccountLocalStorageUid(null);
  }
});
