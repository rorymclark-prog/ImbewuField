import assert from 'node:assert/strict';
import test from 'node:test';

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  canonicalCartographicWaterId,
  supportsCartographicWaterSymbol,
} from '@/lib/cartographic-water-symbols';
import { supportsCartographicStructureSymbol } from '@/lib/cartographic-structure-symbols';

test('real catalog water IDs resolve to illustrated symbols', () => {
  for (const id of [
    'jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000', 'rain_barrel',
    'pond_small', 'dam', 'borehole', 'tap_point', 'water_trough', 'first_flush',
    'pump_filter', 'banana_circle', 'tree_basin', 'greywater_basin',
    'greywater_outlet', 'greywater_diverter', 'infiltration_basin', 'mulch_bank',
  ]) {
    assert.equal(supportsCartographicWaterSymbol(id), true, id);
  }
  assert.equal(canonicalCartographicWaterId('mulch_bank'), 'vetiver-bank');
  assert.equal(supportsCartographicWaterSymbol('invented_water_feature'), false);
});

test('benchmark structure catalog IDs resolve to illustrated symbols', () => {
  for (const id of [
    'chicken_coop', 'chicken_tractor', 'compost_bay', 'nursery_table', 'beehive',
    'rabbit_hutch', 'shade_house', 'greenhouse_tunnel', 'shed', 'kraal',
  ]) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} exists in the catalog`);
    assert.equal(supportsCartographicStructureSymbol(ELEMENTS_BY_ID[id]), true, id);
  }
  assert.equal(supportsCartographicStructureSymbol('unknown_structure'), false);
});
