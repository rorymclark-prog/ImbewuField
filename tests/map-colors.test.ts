import { suite, test } from 'node:test';
import assert from 'node:assert';
import {
  MAP_COLOR_BOUNDARY_STROKE,
  MAP_COLOR_BOUNDARY_FILL,
  MAP_COLOR_WATER_STROKE,
  MAP_COLOR_WATER_FILL,
  MAP_COLOR_ALERT,
} from '@/lib/map-colors';

suite('Map Colors', () => {
  test('constants equal the exact original values', () => {
    assert.strictEqual(MAP_COLOR_BOUNDARY_STROKE, '#9BE66B', 'Boundary stroke must be #9BE66B');
    assert.strictEqual(MAP_COLOR_BOUNDARY_FILL, '#A8D88A', 'Boundary fill must be #A8D88A');
    assert.strictEqual(MAP_COLOR_WATER_STROKE, '#5B9ED4', 'Water stroke must be #5B9ED4');
    assert.strictEqual(MAP_COLOR_WATER_FILL, '#7CC6F2', 'Water fill must be #7CC6F2');
    assert.strictEqual(MAP_COLOR_ALERT, '#C0492A', 'Alert color must be #C0492A');
  });
});
