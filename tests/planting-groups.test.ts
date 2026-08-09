import test from 'node:test';
import assert from 'node:assert/strict';

// The Planting palette's SECTIONS (Rory: "I want indig fruit to have their own section").
//
// The strip is one horizontal scroller, so a section is only real if two things hold: every chip
// lands in exactly one section, and the sections come out in a fixed order. Both are properties
// of plantingGroupFor + PLANTING_GROUP_ORDER, which is why they are tested here and not through
// the component — components/design/DesignPalette.tsx is a 'use client' TSX file this suite's
// type-stripping loader cannot import (see the header of tests/catalog-matrix.test.ts).

import {
  ELEMENT_CATALOG,
  INDIGENOUS_FRUIT_IDS,
  PLANTING_GROUP_LABEL,
  PLANTING_GROUP_ORDER,
  TREE_CLIMATES,
  biomeClimates,
  elementVisibleInPalette,
  plantingGroupFor,
  type ClimateZone,
} from '../lib/design-elements.ts';

/** The chips the Planting step actually offers: category 'growing', plus the earthworks features
 *  that reach the step via alsoSteps. Mirrors DesignPalette's stepCatalog for step='planting'. */
const PLANTING_CHIPS = ELEMENT_CATALOG.filter(
  (def) => def.category === 'growing' || def.alsoSteps?.includes('planting'),
);

test('every planting chip lands in exactly one section, and every section is labelled', () => {
  for (const def of PLANTING_CHIPS) {
    const group = plantingGroupFor(def);
    assert.ok(
      PLANTING_GROUP_ORDER.includes(group),
      `${def.id} → "${group}", which is not in PLANTING_GROUP_ORDER — it would render under no heading`,
    );
    assert.ok(PLANTING_GROUP_LABEL[group], `section "${group}" has no label`);
  }
});

test('a dug feature is not filed as a tree, whatever its id starts with', () => {
  // The sort this replaced discriminated on the `tree_` prefix alone, which put Tree Basin — a
  // 2 m planting pit — under Fruit & nut trees, and Banana Circle under Beds. Under a plain sort
  // that was invisible; under a printed heading it is a wrong answer on screen.
  assert.equal(plantingGroupFor(ELEMENT_CATALOG.find((d) => d.id === 'tree_basin')!), 'beds');
  assert.equal(plantingGroupFor(ELEMENT_CATALOG.find((d) => d.id === 'banana_circle')!), 'beds');
  assert.equal(plantingGroupFor(ELEMENT_CATALOG.find((d) => d.id === 'banana_clump')!), 'fruit_nut');
});

test('the Indigenous fruit section holds exactly the indigenous FRUIT species', () => {
  const inSection = PLANTING_CHIPS.filter((d) => plantingGroupFor(d) === 'indigenous_fruit').map((d) => d.id);
  assert.deepEqual(inSection.sort(), [...INDIGENOUS_FRUIT_IDS].sort());

  // The generic indigenous shade tree is a placeholder for any broad-crowned indigenous tree, not
  // a fruiting species. Under a heading that promises fruit it would be a lie, so it stays out.
  assert.equal(plantingGroupFor(ELEMENT_CATALOG.find((d) => d.id === 'tree_indigenous')!), 'other_trees');
  // Moringa is indigenous to India and grown here for LEAF. Neither half of the heading fits.
  assert.equal(plantingGroupFor(ELEMENT_CATALOG.find((d) => d.id === 'tree_moringa')!), 'other_trees');

  // Every one of them must be a real catalog id, or the section silently shrinks.
  for (const id of INDIGENOUS_FRUIT_IDS) {
    assert.ok(ELEMENT_CATALOG.some((d) => d.id === id), `INDIGENOUS_FRUIT_IDS names ${id}, which is not in the catalog`);
  }
});

test('Indigenous fruit sorts ahead of the exotic fruit trees — the point of giving it a section', () => {
  const rank = (group: string) => PLANTING_GROUP_ORDER.indexOf(group as never);
  assert.ok(rank('indigenous_fruit') < rank('fruit_nut'));
  assert.ok(rank('indigenous_fruit') < rank('other_trees'));
  // Beds and strips still lead: they are what you lay out first, and there are only a handful.
  assert.ok(rank('beds') < rank('indigenous_fruit'));
});

test('no South African site filters the Indigenous fruit section down to nothing', () => {
  // A heading over an empty run is worse than no heading. The palette only renders a heading when
  // a chip follows it, but the section still has to have SOMETHING to offer in every climate, or
  // a Karoo farmer is told indigenous fruit exists and shown none of it.
  const BIOMES = [
    'Indian Ocean Coastal Belt', 'Savanna', 'Albany Thicket', 'Afromontane Forest',
    'Grassland', 'Fynbos', 'Succulent Karoo', 'Nama-Karoo', 'Desert',
  ];
  for (const biome of BIOMES) {
    const climates = biomeClimates(biome);
    assert.notEqual(climates, null, `biomeClimates does not know "${biome}" — fix the test, not the app`);
    const offered = INDIGENOUS_FRUIT_IDS.filter((id) =>
      elementVisibleInPalette(ELEMENT_CATALOG.find((d) => d.id === id)!, climates));
    assert.ok(offered.length > 0, `${biome} offers no indigenous fruit at all`);
  }
});

test('kei apple is the species carrying that guarantee, and it is climate-mapped to do so', () => {
  // Named explicitly so that dropping kei apple, or narrowing its climates, fails HERE with the
  // reason attached rather than only in the sweep above.
  const ALL: ClimateZone[] = ['subtropical', 'temperate', 'mediterranean', 'arid'];
  assert.deepEqual([...(TREE_CLIMATES.tree_kei_apple ?? [])].sort(), [...ALL].sort());
});
