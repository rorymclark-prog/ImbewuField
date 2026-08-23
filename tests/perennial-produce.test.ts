import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PERENNIAL_PRODUCE,
  PERENNIAL_GROUP_ORDER,
  perennialProduceByKey,
  isPerennialProduceKey,
  perennialProduceInGroup,
  buildPerennialProduce,
} from '@/lib/perennial-produce';
import type { Species } from '@/lib/species-palette';
import { SPECIES } from '@/lib/species-catalog';
import { CROPS } from '@/lib/crop-catalog';
import { CROP_ENTRY_OPTIONS } from '@/lib/crop-entry';

test('perennial produce: the orchard actually has something in it', () => {
  // The whole point: before this, a farmer with twelve avocado trees could not log one avocado.
  assert.ok(PERENNIAL_PRODUCE.length >= 60, `only ${PERENNIAL_PRODUCE.length} produce`);
  const labels = PERENNIAL_PRODUCE.map((p) => p.label);
  for (const expected of ['Avocado', 'Mango', 'Guava', 'Macadamia', 'Marula', 'Kei apple', 'Banana']) {
    assert.ok(labels.includes(expected), `missing ${expected}`);
  }
});

test('perennial produce: a key can never collide with an annual crop key', () => {
  // Both lists end up in one picker and one saved record. A collision would silently reassign a
  // farmer's harvest from one plant to another.
  const cropKeys = new Set(CROPS.map((c) => c.key));
  for (const p of PERENNIAL_PRODUCE) {
    assert.ok(!cropKeys.has(p.key), `${p.key} collides with an annual crop`);
    assert.ok(p.key.startsWith('perennial:'), `${p.key} is not namespaced`);
  }
});

test('perennial produce: no name is offered twice across the two lists', () => {
  // A farmer seeing "Watermelon" under both Crops and Orchard would have to guess which one counts.
  const annual = new Set(CROP_ENTRY_OPTIONS.map((c) => c.label.toLocaleLowerCase('en-ZA')));
  for (const p of PERENNIAL_PRODUCE) {
    assert.ok(!annual.has(p.label.toLocaleLowerCase('en-ZA')), `${p.label} is in both lists`);
  }
});

test('perennial produce: keys and labels are each unique', () => {
  const keys = new Set<string>();
  const labels = new Set<string>();
  for (const p of PERENNIAL_PRODUCE) {
    assert.ok(!keys.has(p.key), `duplicate key ${p.key}`);
    assert.ok(!labels.has(p.label), `duplicate label ${p.label}`);
    keys.add(p.key);
    labels.add(p.label);
  }
});

test('perennial produce: several species yielding one produce merge into one row', () => {
  // The catalogue carries three low-chill peaches and four wild olives — distinct PLANTING choices
  // with their own sources and biome ranks, but one thing to pick and sell.
  const peach = PERENNIAL_PRODUCE.find((p) => p.label === 'Low-chill peach');
  assert.ok(peach, 'low-chill peach missing');
  assert.ok(peach.speciesIds.length >= 2, 'the duplicate peach entries did not merge');
  for (const id of peach.speciesIds) {
    assert.ok(SPECIES.some((s) => s.id === id), `${id} is not a real species id`);
  }
});

test('perennial produce: a catalogue row naming two produce becomes two rows, not one nonsense row', () => {
  // 'Soft citrus and lemon' (id citrus-reticulata-citrus-limon) is a sensible thing to PLANT and a
  // meaningless thing to SELL. Its id must reach both real produce instead.
  assert.equal(PERENNIAL_PRODUCE.find((p) => /\band\b/i.test(p.label)), undefined,
    'a conjoined produce name survived');
  const both = PERENNIAL_PRODUCE.filter((p) => p.speciesIds.includes('citrus-reticulata-citrus-limon'));
  assert.deepEqual(both.map((p) => p.label).sort(), ['Lemon', 'Soft citrus']);
});

test('perennial produce: a cultivar list is not part of the name', () => {
  // The catalogue writes "Banana ('Dwarf Cavendish', 'Williams')". You sell bananas.
  const banana = PERENNIAL_PRODUCE.find((p) => p.label === 'Banana');
  assert.ok(banana, 'banana missing');
  assert.ok(!PERENNIAL_PRODUCE.some((p) => p.label.includes('(')), 'a cultivar list leaked into a name');
});

test('perennial produce: a second language name is not a second produce', () => {
  // "Kei apple / umqokolo" is one fruit written twice, not two picker rows.
  assert.ok(!PERENNIAL_PRODUCE.some((p) => p.label.includes('/')), 'a slashed name leaked through');
  const kei = PERENNIAL_PRODUCE.find((p) => p.label === 'Kei apple');
  assert.ok(kei && kei.speciesIds.length >= 2, 'the two Kei apple entries did not merge');
});

function fixture(over: Partial<Species> & Pick<Species, 'id' | 'commonName'>): Species {
  return {
    botanicalName: 'Testus plantus',
    indigenous: false,
    section: 'Exotic fruit & nuts',
    stratum: 'sub-canopy',
    uses: ['food'],
    matureHeightM: 4,
    matureWidthM: 4,
    crownForm: 'rounded',
    waterNeed: 'moderate',
    frostTolerance: 'light',
    biomes: [{ biome: 'grassland', rank: 1 }],
    why: 'fixture',
    source: 'fixture',
    nemba: 'none',
    reviewed: true,
    ...over,
  } as Species;
}

test('perennial produce: nothing regulated 1a or 1b is ever offered', () => {
  // Category 1a and 1b must be REMOVED from the land and may never be planted. The design picker
  // already refuses them; a produce list that quietly offered them would read as endorsement.
  //
  // SPECIES has no 1a/1b entry at all — an upstream guard keeps them out of the catalogue — so this
  // has to be proved against a fixture, or it proves nothing about the filter in this module.
  const rows = buildPerennialProduce([
    fixture({ id: 'good', commonName: 'Perfectly Fine Fruit' }),
    fixture({ id: 'must-go', commonName: 'Banned Berry', nemba: '1b' }),
    fixture({ id: 'must-go-now', commonName: 'Worse Berry', nemba: '1a' }),
    fixture({ id: 'permitted', commonName: 'Permit Fruit', nemba: '2' }),
  ]);
  assert.deepEqual(rows.map((r) => r.label).sort(), ['Perfectly Fine Fruit', 'Permit Fruit']);
});

test('perennial produce: a herb or groundcover gets in on a fruit section and nothing else', () => {
  // "Groundcovers & herbaceous" mixes annual vegetables CROPS already schedules with real
  // perennials, and no field in the catalogue separates them — so that section stays out. A fruit
  // section is a person's judgement already made, so a herb filed there is taken at its word.
  const rows = buildPerennialProduce([
    fixture({ id: 'tree', commonName: 'Real Tree Fruit', stratum: 'canopy' }),
    fixture({ id: 'vine', commonName: 'Real Vine Fruit', stratum: 'climber' }),
    fixture({ id: 'herb', commonName: 'Herb Thing', stratum: 'herb', section: 'Groundcovers & herbaceous' }),
    fixture({ id: 'ground', commonName: 'Ground Thing', stratum: 'groundcover', section: 'Groundcovers & herbaceous' }),
    fixture({ id: 'pondweed', commonName: 'Water Flower', stratum: 'herb', section: 'Indigenous fruit' }),
    fixture({ id: 'sourfig', commonName: 'Sour Thing', stratum: 'groundcover', section: 'Indigenous fruit' }),
    fixture({ id: 'nonfood', commonName: 'Timber Tree', stratum: 'canopy', uses: ['shade'] as Species['uses'] }),
  ]);
  assert.deepEqual(
    rows.map((r) => r.label).sort(),
    ['Real Tree Fruit', 'Real Vine Fruit', 'Sour Thing', 'Water Flower'],
  );
});

test('perennial produce: every entry is woody or in a fruit section, and all of them are food', () => {
  // The whole membership rule, checked against the real catalogue. A non-woody plant is only here
  // because a reviewer put it in a fruit section; nothing gets in on a name.
  const byId = new Map(SPECIES.map((s) => [s.id, s]));
  for (const p of PERENNIAL_PRODUCE) {
    for (const id of p.speciesIds) {
      const s = byId.get(id);
      assert.ok(s, `${id} missing`);
      const woody = ['canopy', 'sub-canopy', 'shrub', 'climber'].includes(s.stratum);
      const fruitSection = s.section === 'Indigenous fruit' || s.section === 'Exotic fruit & nuts';
      assert.ok(woody || fruitSection,
        `${p.label} is a ${s.stratum} in "${s.section}" — neither woody nor filed as fruit`);
      assert.ok(s.uses.includes('food'), `${p.label} has no food use`);
    }
  }
});

test('perennial produce: the annual vegetables of the herb section are still kept out', () => {
  // The named risk of widening the rule. Each of these is an annual a farmer plants into a bed;
  // if one appeared here the orchard switch could hide their harvest from the bed totals.
  const labels = new Set(PERENNIAL_PRODUCE.map((p) => p.label.toLocaleLowerCase('en-ZA')));
  for (const annual of ['cowpea', 'sweet potato', 'grain sorghum', 'watermelon', 'amaranth', 'broad bean']) {
    assert.ok(!labels.has(annual), `${annual} reached the orchard list`);
  }
});

test('perennial produce: fruit and nuts sort before the marginal edibles', () => {
  // A farmer opening the picker wants avocados and mangoes first, not quiver tree.
  const order = PERENNIAL_PRODUCE.map((p) => PERENNIAL_GROUP_ORDER.indexOf(p.group));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'groups are interleaved');
  assert.equal(PERENNIAL_GROUP_ORDER[0], 'fruit_nut');
  assert.ok(perennialProduceInGroup('fruit_nut').length >= 20);
  assert.ok(perennialProduceInGroup('indigenous_fruit').length >= 15);
});

test('perennial produce: lookup answers for its own keys and refuses everything else', () => {
  const first = PERENNIAL_PRODUCE[0];
  assert.equal(perennialProduceByKey(first.key)?.label, first.label);
  assert.equal(isPerennialProduceKey(first.key), true);
  assert.equal(isPerennialProduceKey('maize'), false);
  assert.equal(isPerennialProduceKey('perennial:not-a-thing'), false);
  assert.equal(isPerennialProduceKey(null), false);
  assert.equal(isPerennialProduceKey(undefined), false);
  assert.equal(perennialProduceByKey('maize'), null);
});

test('perennial produce: it claims no yield, price or schedule anywhere', () => {
  // The load-bearing refusal. Species has no yield, price or days-to-harvest, and this module will
  // not invent them — a perennial can be RECORDED but never planned or benchmarked. If a future
  // edit adds one of those fields, the annual planner's assumptions become reachable and this test
  // is the thing that says so.
  for (const p of PERENNIAL_PRODUCE) {
    const fields = Object.keys(p).sort();
    assert.deepEqual(fields, ['group', 'indigenous', 'key', 'label', 'speciesIds']);
  }
});
