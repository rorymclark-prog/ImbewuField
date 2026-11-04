import assert from 'node:assert/strict';
import test from 'node:test';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { configureFieldBlock } from '../lib/bed-block.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

// Synthetic engineering geometry, never growing dimensions or survey accuracy.
function canvas(): DesignCanvasState {
  return { siteId: 'site:0.00000,0.00000',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 1, imgH: 1, mPerPx: 1 },
    items: [], zones: [], lines: [], step: 'planting', updatedAt: '2026-11-04T00:00:00.000Z', rev: 1 };
}
const unrounded = { areaRounding: 'none' } as const;

test('own arithmetic can retain a positive saved rectangle that legacy presentation rounded to zero', () => {
  const state = canvas();
  state.items.push({ id: 'small-measured-bed', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 0.5, hM: 0.08, label: 'Synthetic measured bed' });
  const before = JSON.stringify(state);
  const legacy = bedsFromDesignCanvas(state), precise = bedsFromDesignCanvas(state, unrounded);
  assert.equal(legacy[0].areaM2, 0);
  assert.equal(precise[0].areaM2, 0.04, 'halving the declared 0.08-metre side leaves its positive 0.04-square-metre footprint');
  const { savedRectangleM, ...projected } = precise[0];
  assert.deepEqual(savedRectangleM, [0.5, 0.08]);
  assert.ok(Object.isFrozen(savedRectangleM));
  assert.equal(Object.hasOwn(legacy[0], 'savedRectangleM'), false, 'default projection does not expose a new runtime field');
  assert.deepEqual({ ...projected, areaM2: legacy[0].areaM2 }, legacy[0], 'identity, label and reach remain the same');
  assert.deepEqual(bedsFromDesignCanvas(state, {}), legacy, 'omitting the explicit opt-in preserves the legacy projection');
  assert.equal(JSON.stringify(state), before, 'neither mode mutates saved dimensions or placement');
});

test('the opt-in preserves declared rectangular area without treating a rounded label as a measurement', () => {
  const state = canvas();
  state.items.push({ id: 'decimal-measured-bed', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 0.58, hM: 1 });
  assert.equal(bedsFromDesignCanvas(state)[0].areaM2, 0.6);
  assert.equal(bedsFromDesignCanvas(state, unrounded)[0].areaM2, 0.58);
  assert.equal(state.items[0].wM, 0.58);
});

test('unrounded circular definitions keep their ellipse footprint rather than borrowing the bounding rectangle', () => {
  const state = canvas();
  state.items.push(
    { id: 'ellipse', defId: 'keyhole_bed', x: 0.5, y: 0.5, wM: 2, hM: 1, rot: 90 },
    { id: 'rectangle', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 1 },
  );
  const [ellipse, rectangle] = bedsFromDesignCanvas(state, unrounded);
  assert.equal(ellipse.areaM2, Math.PI / 2, 'an ellipse with semi-axes 1 and 0.5 has area pi/2');
  assert.notEqual(ellipse.areaM2, 2, 'explicit dimensions do not make a circular definition rectangular');
  assert.equal(ellipse.minDimM, 1);
  assert.equal(rectangle.areaM2, 2);
  assert.deepEqual(rectangle.savedRectangleM, [2, 1]);
  assert.equal(Object.hasOwn(ellipse, 'savedRectangleM'), false, 'ellipse bounding dimensions are not rectangle area factors');
  assert.equal(bedsFromDesignCanvas(state)[0].areaM2, 1.6, 'the default still uses its existing one-decimal area');
});

test('small calibrated polygons keep their positive area and the existing scale correction in the same geometry authority', () => {
  const state = canvas();
  state.zones.push({ id: 'small-open-field', zone: 2, feature: 'staple_garden', name: 'Synthetic open field',
    points: [[0, 0], [0.25, 0], [0.25, 0.125], [0, 0.125]] });
  const before = JSON.stringify(state);
  assert.equal(bedsFromDesignCanvas(state)[0].areaM2, 0);
  const plot = bedsFromDesignCanvas(state, unrounded)[0];
  assert.deepEqual(plot, { id: 'small-open-field', label: 'Synthetic open field', areaM2: 0.03125, minDimM: 0.125, kind: 'plot' });
  assert.equal(Object.hasOwn(plot, 'savedRectangleM'), false, 'a polygon does not acquire bounding rectangle factors');
  const scaled = { ...state, scaleFactor: 2 };
  assert.equal(bedsFromDesignCanvas(scaled, unrounded)[0].areaM2, 0.125, 'doubling both calibrated axes quadruples the same saved ring area');
  assert.equal(bedsFromDesignCanvas(scaled)[0].areaM2, 0.1);
  assert.equal(JSON.stringify(state), before, 'scale interpretation cannot rewrite the ring');
});

test('generated field beds keep unrounded capacity while their path-containing parent is still excluded', () => {
  const state = canvas();
  state.zones.push({ id: 'field-block', zone: 2, feature: 'staple_garden', points: [[0, 0], [1, 0], [1, 1], [0, 1]] });
  const filled = configureFieldBlock(state, 'field-block', 'Synthetic block', {
    mode: 'beds', bedLengthM: 0.5, bedWidthM: 0.25, pathWidthM: 0.125, angleDeg: 0,
  }, state.frame);
  const before = JSON.stringify(filled);
  assert.ok(filled.items.length > 0, 'the real field-block generator must produce children for this fixture');
  const precise = bedsFromDesignCanvas(filled, unrounded), legacy = bedsFromDesignCanvas(filled);
  assert.deepEqual(precise.map(bed => bed.id), filled.items.map(item => item.id));
  assert.ok(precise.every(bed => bed.areaM2 === 0.125));
  assert.ok(precise.every(bed => JSON.stringify(bed.savedRectangleM) === JSON.stringify([0.25, 0.5])));
  assert.ok(legacy.every(bed => bed.areaM2 === 0.1));
  assert.ok(legacy.every(bed => !Object.hasOwn(bed, 'savedRectangleM')));
  assert.equal(precise.some(bed => bed.id === 'field-block'), false, 'adding the parent would allocate paths and children twice');
  assert.equal(JSON.stringify(filled), before);
  const opened = configureFieldBlock(filled, 'field-block', 'Synthetic open block', {
    mode: 'open', bedLengthM: 0.5, bedWidthM: 0.25, pathWidthM: 0.125, angleDeg: 0,
  }, filled.frame);
  assert.equal(opened.items.length, 0);
  assert.deepEqual(bedsFromDesignCanvas(opened, unrounded), [{ id: 'field-block', label: 'Synthetic open block', areaM2: 1, minDimM: 1, kind: 'plot' }]);
});

test('catalog fallback dimensions cannot become evidence that a rectangle was actually saved with those sides', () => {
  const state = canvas();
  state.items.push(
    { id: 'catalog-only', defId: 'veg_bed', x: 0.5, y: 0.5 },
    { id: 'one-saved-side', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2 },
  );
  const before = JSON.stringify(state);
  const beds = bedsFromDesignCanvas(state, unrounded);
  assert.equal(beds.length, 2, 'the existing bridge fallback behavior itself remains unchanged');
  assert.ok(beds.every(bed => !Object.hasOwn(bed, 'savedRectangleM')));
  assert.equal(JSON.stringify(state), before);
});

test('the opt-in keeps null, degenerate rings and non-growing features excluded', () => {
  assert.deepEqual(bedsFromDesignCanvas(null, unrounded), []);
  const state = canvas();
  state.zones.push(
    { id: 'too-few-points', zone: 2, feature: 'staple_garden', points: [[0, 0], [1, 1]] },
    { id: 'zero-area', zone: 2, feature: 'staple_garden', points: [[0, 0], [0.5, 0], [1, 0]] },
    { id: 'other-feature', zone: 0, feature: 'cleared', points: [[0, 0], [1, 0], [1, 1]] },
  );
  assert.deepEqual(bedsFromDesignCanvas(state, unrounded), []);
  assert.deepEqual(bedsFromDesignCanvas(state), []);
});
