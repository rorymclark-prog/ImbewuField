import assert from 'node:assert/strict';
import test from 'node:test';

import { CROPS, cropByKey } from '@/lib/crop-catalog';
import {
  FOOD_GROUP,
  ROTATION_FAMILY,
  foodGroupOf,
  rotationFamilyOf,
} from '@/lib/crop-groups';

function crop(key: string) {
  const found = cropByKey(key);
  assert.ok(found, `test names unknown crop "${key}"`);
  return found;
}

test('every catalog crop has exactly one declared botanical rotation family', () => {
  const catalogKeys = new Set(CROPS.map((entry) => entry.key));

  for (const entry of CROPS) {
    assert.ok(ROTATION_FAMILY[entry.key], `${entry.key} has no botanical rotation family`);
    assert.equal(rotationFamilyOf(entry), ROTATION_FAMILY[entry.key]);
  }
  for (const key of Object.keys(ROTATION_FAMILY)) {
    assert.ok(catalogKeys.has(key), `rotation family map contains stale crop "${key}"`);
  }
});

test('rotation follows shared pest families rather than household food groups', () => {
  const sameFamilySets = [
    ['tomatoes', 'peppers', 'potato'],
    ['swiss-chard', 'beetroot'],
    ['kale', 'cabbage', 'broccoli'],
    ['carrots', 'coriander'],
    ['onions', 'garlic'],
    ['dry-beans', 'green-beans', 'broad-beans', 'groundnuts', 'peas'],
    ['butternut', 'pumpkin', 'cucumber', 'watermelon'],
    ['maize', 'oats'],
  ];

  for (const keys of sameFamilySets) {
    const families = new Set(keys.map((key) => rotationFamilyOf(crop(key))));
    assert.equal(families.size, 1, `${keys.join(', ')} were split across botanical families`);
  }

  assert.notEqual(
    foodGroupOf(crop('tomatoes')),
    foodGroupOf(crop('potato')),
    'test premise broken: tomato and potato must still serve different nutrition groups',
  );
  assert.equal(
    rotationFamilyOf(crop('tomatoes')),
    rotationFamilyOf(crop('potato')),
    'a food-group rotation would wrongly allow tomato followed by potato',
  );
});

test('nutrition groups and rotation families cover the same crop catalog without becoming one authority', () => {
  assert.deepEqual(
    Object.keys(FOOD_GROUP).sort(),
    Object.keys(ROTATION_FAMILY).sort(),
    'adding a crop must classify both its household-food role and its botanical family',
  );
});
