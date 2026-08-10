import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  ridgeAngleOf,
  roofRunoffArrows,
  gutterToTankArrows,
  tankOverflowArrows,
  OVERFLOW_REACH_M,
  type MetreScale,
} from '../lib/water-story.ts';

// THE WATER STORY — roof to gutter to tank to swale.
//
// Rory: "arrows of water running down roof, and gutter, running and spreading in swale."
//
// Most of what these tests defend is the REFUSALS. Every leg of this feature is one step away
// from inventing plumbing that is not on the farm — a downpipe, a fall direction, an overflow run
// to a swale in the next field — and a farmer who trusts an invented arrow digs in the wrong
// place. The assertions below are mostly "and here it draws nothing".

// A 20 m x 10 m frame, so 1.0 normalised x = 20 m and 1.0 normalised y = 10 m. Deliberately NOT
// square: the ridge and its perpendicular are physical facts, and a bug that works in normalised
// space instead of metres passes on a square frame and fails here.
const scale: MetreScale = { mPerUnitX: 20, mPerUnitY: 10 };

/** A house 8 m wide (x) and 4 m deep (y), centred at (10 m, 5 m), in normalised coordinates. */
const house: Array<[number, number]> = [
  [(10 - 4) / 20, (5 - 2) / 10],
  [(10 + 4) / 20, (5 - 2) / 10],
  [(10 + 4) / 20, (5 + 2) / 10],
  [(10 - 4) / 20, (5 + 2) / 10],
];

const toM = (p: [number, number]): [number, number] => [p[0] * scale.mPerUnitX, p[1] * scale.mPerUnitY];

test('the ridge is the longest edge, and the rule is scale-invariant', () => {
  // Exported precisely so drawPaperRoofs and these arrows cannot drift apart; it is handed pixels
  // in one caller and metres in the other, so the same shape at two scales must give one answer.
  const m = house.map(toM);
  const scaled = m.map(([x, y]) => [x * 7, y * 7] as [number, number]);
  assert.equal(ridgeAngleOf(m), ridgeAngleOf(scaled));
  // The 8 m wall runs along x, so the ridge is horizontal.
  assert.ok(Math.abs(Math.sin(ridgeAngleOf(m))) < 1e-9, 'ridge should follow the 8 m wall');
});

test('a gable sheds to BOTH sides of the ridge', () => {
  const arrows = roofRunoffArrows({ rings: [house], scale });
  assert.ok(arrows.length >= 4, `expected arrows on both slopes, got ${arrows.length}`);
  // Ridge is horizontal through y = 5 m, so one slope runs to smaller y and the other to larger.
  const up = arrows.filter((a) => a.to[1] < a.from[1]);
  const down = arrows.filter((a) => a.to[1] > a.from[1]);
  assert.ok(up.length > 0 && up.length === down.length, 'the two slopes must be drawn equally');
});

test('runoff arrows stop at the eave and never cross it', () => {
  for (const a of roofRunoffArrows({ rings: [house], scale })) {
    const [, yM] = toM(a.to);
    // Roof spans y = 3 m to 7 m. Crossing the eave would put the head outside that band.
    assert.ok(yM >= 3 - 1e-9 && yM <= 7 + 1e-9, `arrow head left the roof at y=${yM}`);
    assert.ok(Math.abs(toM(a.from)[1] - 5) < 1e-6, 'arrows must start on the ridge');
  }
});

test('runoff arrows never claim a fall on a roof we cannot draw a ridge for', () => {
  // Degenerate input is the normal case for legacy layers, not an exotic one.
  assert.deepEqual(roofRunoffArrows({ rings: [[[0.1, 0.1], [0.2, 0.2]]], scale }), []);
  assert.deepEqual(roofRunoffArrows({ rings: [[]], scale }), []);
  assert.deepEqual(
    roofRunoffArrows({ rings: [[[Number.NaN, 0.1], [0.2, 0.2], [0.3, Number.NaN], [0.4, 0.4]]], scale }),
    [],
    'a ring with fewer than three finite points must yield nothing, not NaN arrows',
  );
  assert.deepEqual(roofRunoffArrows({ rings: [house], scale: { mPerUnitX: 0, mPerUnitY: 10 } }), []);
  for (const a of roofRunoffArrows({ rings: [house], scale })) {
    assert.ok(a.from.every(Number.isFinite) && a.to.every(Number.isFinite));
  }
});

test('a small outbuilding gets two arrows per slope, a long house three', () => {
  // Three arrows on a short ridge collide into a block of ink; the count follows the ridge length.
  // 3 m ridge, 2.5 m deep. Depth matters as much as the ridge: a roof shallower than about 1.4 m
  // has no slope long enough to carry a legible arrow and correctly draws none at all.
  const shed: Array<[number, number]> = [
    [0.1, 0.4], [0.1 + 3 / 20, 0.4], [0.1 + 3 / 20, 0.4 + 2.5 / 10], [0.1, 0.4 + 2.5 / 10],
  ];
  assert.equal(roofRunoffArrows({ rings: [shed], scale }).length, 4, '3 m ridge → 2 per slope');
  assert.equal(roofRunoffArrows({ rings: [house], scale }).length, 6, '8 m ridge → 3 per slope');
});

// ── Leg 2: the gutter ───────────────────────────────────────────────────────────────────────

/** A tank at (xM, yM) with the catalog's real nearRoofM of 3. */
const tankAt = (xM: number, yM: number, nearRoofM = 3) =>
  ({ x: xM / scale.mPerUnitX, y: yM / scale.mPerUnitY, nearRoofM });

test('a tank inside its nearRoofM is fed from the nearest eave', () => {
  const arrows = gutterToTankArrows({ rings: [house], tanks: [tankAt(10, 9)], scale });
  assert.equal(arrows.length, 1);
  const from = toM(arrows[0].from);
  assert.ok(Math.abs(from[1] - 7) < 1e-6, 'the arrow must start on the near eave (y = 7 m)');
  assert.ok(Math.abs(toM(arrows[0].to)[1] - 9) < 1e-6, 'and end at the tank');
});

test('a tank out of range gets NO arrow — there is no nearest-anyway fallback', () => {
  // 4.5 m clear of the wall, with nearRoofM 3. A tank standing in the field is not roof-fed, and
  // an arrow saying it is sends a farmer to plumb a run that does not exist.
  assert.deepEqual(gutterToTankArrows({ rings: [house], tanks: [tankAt(10, 11.5)], scale }), []);
  // ...and with no house at all there is nothing to be fed from.
  assert.deepEqual(gutterToTankArrows({ rings: [], tanks: [tankAt(10, 9)], scale }), []);
  assert.deepEqual(
    gutterToTankArrows({ rings: [house], tanks: [tankAt(10, 9, Number.NaN)], scale }), [],
    'a tank whose definition carries no nearRoofM is not roof-fed by default',
  );
});

// ── Leg 3: the overflow ─────────────────────────────────────────────────────────────────────

test('a tank overflows to a swale in range, ending in the spread bar', () => {
  const swale: Array<[number, number]> = [[0, 14 / 10], [1, 14 / 10]];
  const arrows = tankOverflowArrows({ tanks: [tankAt(10, 9)], swales: [swale], scale });
  assert.equal(arrows.length, 1);
  assert.equal(arrows[0].spread, true, 'water arriving and being taken in, not passing through');
  assert.ok(Math.abs(toM(arrows[0].to)[1] - 14) < 1e-6);
});

test('no swale in reach means no overflow arrow', () => {
  assert.deepEqual(tankOverflowArrows({ tanks: [tankAt(10, 9)], swales: [], scale }), []);
  const farM = 9 + OVERFLOW_REACH_M + 2;
  const far: Array<[number, number]> = [[0, farM / 10], [1, farM / 10]];
  assert.deepEqual(
    tankOverflowArrows({ tanks: [tankAt(10, 9)], swales: [far], scale }), [],
    'an overflow arrow to nowhere is a claim about drainage the design does not make',
  );
});

test('a known downhill bearing drops an uphill swale, an unknown one skips the test', () => {
  // Swale 4 m NORTH (up-screen) of the tank, with the site falling south (bearing 180).
  const uphill: Array<[number, number]> = [[0, 5 / 10], [1, 5 / 10]];
  const tanks = [tankAt(10, 9)];
  assert.deepEqual(
    tankOverflowArrows({ tanks, swales: [uphill], scale, aspectDeg: 180 }), [],
    'overflow does not run uphill',
  );
  assert.equal(
    tankOverflowArrows({ tanks, swales: [uphill], scale, aspectDeg: 0 }).length, 1,
    'with the site falling north that same swale IS downhill',
  );
  assert.equal(
    tankOverflowArrows({ tanks, swales: [uphill], scale, aspectDeg: Number.NaN }).length, 1,
    'an unknown bearing must skip the test, never invent a slope to filter on',
  );
});

// ── The two facts that must never drift ─────────────────────────────────────────────────────

const GLOSSY = readFileSync(join(process.cwd(), 'components', 'design', 'DesignGlossy.tsx'), 'utf8');

test('drawPaperRoofs derives its ridge from the shared rule, not its own copy', () => {
  // Two derivations of "which way does this roof fall" is how a sheet ends up with water running
  // across the fold. See lib/water-story.ts's header.
  const body = GLOSSY.slice(GLOSSY.indexOf('function drawPaperRoofs('));
  const fn = body.slice(0, body.indexOf('\n}\n'));
  assert.ok(fn.includes('ridgeAngleOf('), 'drawPaperRoofs stopped using the shared ridge rule');
  assert.ok(
    !/longest\s*=\s*-1/.test(fn),
    'drawPaperRoofs grew its own longest-edge scan again — delete it and call ridgeAngleOf',
  );
});

test('roof arrows are drawn on paper sheets only', () => {
  // drawPaperRoofs runs only when there is no satellite photo. On a photo sheet the farmer sees
  // their REAL roof, whose ridge is whatever the photograph shows — our arrows would contradict a
  // visible fact rather than restate a drawn one.
  // The trailing '(' is what makes this the CALL and not the import line — the import lists the
  // symbol followed by a comma. Match on the call so an import-only regression still fails here.
  const at = GLOSSY.lastIndexOf('roofRunoffArrows(');
  assert.ok(at > 0, 'the roof runoff leg is not wired up');
  const window = GLOSSY.slice(Math.max(0, at - 900), at + 200);
  assert.ok(
    window.includes('!frame.satDataUrl') || window.includes('!renderFrame.satDataUrl'),
    'roof runoff arrows must be gated on the same no-photo condition drawPaperRoofs uses',
  );
});

test('roof runoff is painted AFTER the feature overlay, on top of the roof', () => {
  // THE BUG THIS PINS SHIPPED. drawPaperRoofs runs inside buildExactLayerOverlay's features phase
  // and fills the roof with OPAQUE sheeting. The roof arrows were drawn before that composite, so
  // they were painted correctly and then buried under the very roof they describe: six arrows
  // produced for the demo creche's 16x12 m roof, zero pixels on the sheet. Every unit test on the
  // arrow maths passed throughout — only rendering the sheet and looking at it found this.
  //
  // The ground legs (gutter, overflow) stay BEFORE the composite on purpose, so an arrow slides
  // under the tank it feeds rather than across its face.
  const composite = GLOSSY.indexOf("buildExactLayerOverlay(renderState, renderFrame, renderRefLayers, filter, W, H, 'features')");
  const roofDraw = GLOSSY.indexOf('drawOverlandFlowArrows(ctx, roofArrows');
  assert.ok(composite > 0, 'the feature-overlay composite moved — re-check the arrow ordering');
  assert.ok(roofDraw > 0, 'roof arrows are no longer drawn as their own pass');
  assert.ok(
    roofDraw > composite,
    'roof runoff arrows are drawn BEFORE the feature overlay again — the roof will cover them',
  );
});
