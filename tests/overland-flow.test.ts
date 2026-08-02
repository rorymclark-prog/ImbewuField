import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIN_DRAWABLE_SLOPE_DEG,
  overlandFlowArrows,
  overlandFlowLegendText,
  pointInRing,
} from '@/lib/overland-flow';

const SQUARE: Array<[number, number]> = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]];

const base = {
  boundary: SQUARE,
  aspectDeg: 180, // due south
  slopeDeg: 6,
  directionConfidence: 'site-local-indicative' as const,
};

test('no arrows at all when the direction cannot be trusted', () => {
  // A flat site's "downhill" is a rounding artefact. Drawing nothing is the correct output; arrows
  // pointing at noise are worse than none because they look authoritative.
  assert.deepEqual(overlandFlowArrows({ ...base, directionConfidence: 'unconfirmed' }), []);
  assert.deepEqual(overlandFlowArrows({ ...base, slopeDeg: 0 }), []);
  assert.deepEqual(overlandFlowArrows({ ...base, slopeDeg: MIN_DRAWABLE_SLOPE_DEG / 2 }), []);
  assert.deepEqual(overlandFlowArrows({ ...base, slopeDeg: Number.NaN }), []);
  assert.deepEqual(overlandFlowArrows({ ...base, aspectDeg: Number.NaN }), []);
  assert.deepEqual(overlandFlowArrows({ ...base, boundary: [[0, 0], [1, 1]] }), []);
});

test('a real slope produces a field of arrows', () => {
  const arrows = overlandFlowArrows(base);
  assert.ok(arrows.length > 4, 'a whole plot should carry more than a token arrow or two');
});

test('arrows point DOWNHILL in screen space, not compass space', () => {
  // Canvas y grows downward, so a bearing of 180 (south) must increase y. Getting this wrong points
  // every arrow uphill — the failure that looks most convincing and is most wrong.
  const south = overlandFlowArrows({ ...base, aspectDeg: 180 })[0];
  assert.ok(south.to[1] > south.from[1], 'due south must run down the page');
  assert.ok(Math.abs(south.to[0] - south.from[0]) < 1e-9, 'due south must not drift sideways');

  const north = overlandFlowArrows({ ...base, aspectDeg: 0 })[0];
  assert.ok(north.to[1] < north.from[1], 'due north must run up the page');

  const east = overlandFlowArrows({ ...base, aspectDeg: 90 })[0];
  assert.ok(east.to[0] > east.from[0], 'due east must run right');
  assert.ok(Math.abs(east.to[1] - east.from[1]) < 1e-9);

  const west = overlandFlowArrows({ ...base, aspectDeg: 270 })[0];
  assert.ok(west.to[0] < west.from[0], 'due west must run left');
});

test('every arrow lies wholly inside the plot', () => {
  // An arrow crossing the fence is a claim about someone else's ground.
  for (const aspectDeg of [0, 45, 90, 135, 180, 225, 270, 315]) {
    for (const arrow of overlandFlowArrows({ ...base, aspectDeg })) {
      assert.ok(pointInRing(arrow.from, SQUARE), `tail outside plot at ${aspectDeg}deg`);
      assert.ok(pointInRing(arrow.to, SQUARE), `head outside plot at ${aspectDeg}deg`);
    }
  }
});

test('an L-shaped plot gets no arrows in the missing corner', () => {
  const lShape: Array<[number, number]> = [
    [0.1, 0.1], [0.5, 0.1], [0.5, 0.5], [0.9, 0.5], [0.9, 0.9], [0.1, 0.9],
  ];
  const arrows = overlandFlowArrows({ ...base, boundary: lShape, spacing: 0.08 });
  assert.ok(arrows.length > 0);
  for (const arrow of arrows) {
    // The absent quadrant is x > 0.5 and y < 0.5.
    assert.ok(!(arrow.from[0] > 0.5 && arrow.from[1] < 0.5), 'arrow placed outside the L');
  }
});

test('spacing controls density and stays sane on bad input', () => {
  const sparse = overlandFlowArrows({ ...base, spacing: 0.3 });
  const dense = overlandFlowArrows({ ...base, spacing: 0.08 });
  assert.ok(dense.length > sparse.length);
  // A nonsense spacing must not produce an infinite loop or an empty field.
  assert.ok(overlandFlowArrows({ ...base, spacing: 0 }).length > 0);
  assert.ok(overlandFlowArrows({ ...base, spacing: Number.NaN }).length > 0);
});

test('the legend row says where the direction came from', () => {
  const text = overlandFlowLegendText(6.2, 'north-east');
  assert.match(text, /north-east/);
  assert.match(text, /6\.2/);
  // No provenance is how a guess gets built on.
  assert.match(text, /slope/i);
  assert.equal(overlandFlowLegendText(Number.NaN, 'north'), 'Overland flow — downhill to the north (—° site slope)');
});
