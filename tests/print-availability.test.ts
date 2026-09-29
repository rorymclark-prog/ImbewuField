// The printed "Food availability" page and the month axis it shares with the app's charts.
// Rory, 2026-09-29, on the availability chart: "i dont know what month this is?" and "i would
// prefer icons of fruoit and berrues just like the others so a 3rd, 4th litle box after staple
// crops animal products and food forest pruducts etc with icons".

import assert from 'node:assert/strict';
import test from 'node:test';

import { monthAxisSlots } from '@/lib/month-axis';
import { animalEntries, forestEntries, printableAvailability } from '@/lib/crop-export-availability';
import { pdfIconUrl } from '@/lib/pdf-icons';

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
});

test('every icon key resolves to the app art the chart itself shows', () => {
  assert.match(pdfIconUrl('crop:cabbage') ?? '', /^\/crop-art\/.+\.png$/);
  assert.match(pdfIconUrl('tree:mangifera-indica') ?? '', /^\/element-art\/tree_.+\.png$/);
  assert.equal(pdfIconUrl('animal:chicken-layer'), '/animal-art/chicken-layer.png');
  assert.equal(pdfIconUrl('nonsense'), null);
  assert.equal(pdfIconUrl('planet:mars'), null);
});
