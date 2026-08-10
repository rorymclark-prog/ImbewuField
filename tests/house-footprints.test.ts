// WHICH BUILDINGS EXIST is the rule that decided Rory's store room was not drawn. It lived inside
// DesignGlossy.tsx, which no test imports, so it was covered by source regexes — and the defect was
// a DUPLICATE in a returned array, which no regex can see. These tests measure it instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { authoritativeHouseFootprints, sameFootprint } from '../lib/house-footprints.ts';
import { groundContentRingsForSheet } from '../lib/glossy-filters.ts';
import type { ZoneShape } from '../lib/design-canvas.ts';

const square = (x: number, y: number, w: number): Array<[number, number]> => [
  [x, y],
  [x + w, y],
  [x + w, y + w],
  [x, y + w],
];

const zone = (partial: Partial<ZoneShape> & Pick<ZoneShape, 'id' | 'points'>): ZoneShape => ({
  zone: 1,
  ...partial,
}) as ZoneShape;

test('a house traced in the Studio and promoted into refLayers counts ONCE', () => {
  // resolveBaseLayers promotes the largest Studio house ring into refLayers.house and returns that
  // zone's own points array. Both routes therefore carry the same building, and a caller that FILLS
  // would paint it twice — 20% paint compounding to ~36%, so the main house reads as a different
  // material from the store room beside it.
  const ring = square(0.2, 0.4, 0.2);
  const footprints = authoritativeHouseFootprints(
    { zones: [zone({ id: 'classroom', points: ring, feature: 'house', name: 'Classroom' })] },
    { house: ring },
  );
  assert.equal(footprints.length, 1);
});

test('the duplicate is caught by VALUE, not merely by reference', () => {
  // The promotion returns the array by reference today. A correctness argument resting on that is
  // one refactor from breaking silently, so an equal-but-distinct copy must dedupe too.
  const ring = square(0.2, 0.4, 0.2);
  const copy = ring.map(([x, y]) => [x, y] as [number, number]);
  assert.notEqual(ring, copy);
  const footprints = authoritativeHouseFootprints(
    { zones: [zone({ id: 'classroom', points: copy, feature: 'house' })] },
    { house: ring },
  );
  assert.equal(footprints.length, 1);
});

test('a store room beside the house is a SECOND building, never folded into the first', () => {
  // The whole point of the fix. This is a duplicate test, not a proximity test — two structures
  // built against each other must both survive.
  const house = square(0.2, 0.4, 0.2);
  const store = square(0.4, 0.4, 0.05); // sharing an edge with the house
  const footprints = authoritativeHouseFootprints(
    {
      zones: [
        zone({ id: 'classroom', points: house, feature: 'house', name: 'Classroom' }),
        zone({ id: 'storeroom', points: store, feature: 'house', name: 'Store room' }),
      ],
    },
    { house },
  );
  assert.equal(footprints.length, 2);
  assert.ok(footprints.some((f) => sameFootprint(f, store)), 'the store room must survive');
  assert.ok(footprints.some((f) => sameFootprint(f, house)), 'the house must survive');
});

test('non-house ground features and degenerate rings are not buildings', () => {
  const footprints = authoritativeHouseFootprints(
    {
      zones: [
        zone({ id: 'slab', points: square(0.45, 0.45, 0.1), feature: 'patio', name: 'Concrete Slab' }),
        zone({ id: 'sliver', points: [[0, 0], [1, 1]], feature: 'house' }),
      ],
    },
    { house: [] },
  );
  assert.deepEqual(footprints, []);
});

test('sameFootprint separates rings that differ in shape at equal centroid', () => {
  // A centroid alone would call these one building. Point count is what keeps them apart, and this
  // pins that the test is not purely positional.
  const a = square(0.4, 0.4, 0.2);
  const b: Array<[number, number]> = [...square(0.4, 0.4, 0.2), [0.5, 0.4]];
  assert.equal(sameFootprint(a, b), false);
});

test('the plain-paper vector pass draws EVERY building, not the largest one', () => {
  // The sheet that was wrong. drawBlueprintGround drops every house zone once houseCovered is true,
  // and resolveBaseLayers guarantees that — so if this call site takes a single ring again, the
  // store room is suppressed by the ground pass and picked up by nothing. It only ever failed on
  // PAPER: the photo path composes through buildHouseOverlay, which has always looped.
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const onPaperCall = source.indexOf('const onPaper = !renderFrame.satDataUrl;');
  assert.ok(onPaperCall >= 0, 'the plain-paper branch moved');
  const window = source.slice(onPaperCall, onPaperCall + 1400);
  assert.match(window, /for \(const footprint of authoritativeHouseFootprints\(/);
  assert.doesNotMatch(window, /drawBlueprintHouse\(\s*ctx,\s*renderRefLayers\.house,/);
});

test('the corrugated paper roof asks the authority instead of unioning both routes', () => {
  // drawPaperRoofs inlined the pre-dedupe union — refLayers.house plus every feature:'house' zone —
  // long after authoritativeHouseFootprints replaced exactly that rule everywhere else. Six other
  // passes in the same file already called the authority; this one did not.
  //
  // It matters HERE more than anywhere the rule was fixed before, because every earlier caller
  // builds a MASK and painting a shape into a mask twice is the same mask. This caller FILLS:
  // weathered zinc, a 22% shade over one slope, then a highlight and a shadow rib per 0.76 m
  // sheet. Drawn twice, all of that compounds, so a promoted Studio house came out darker and
  // denser than the store room beside it — one sheet, two buildings, apparently different metal.
  const source = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('function drawPaperRoofs(');
  assert.ok(start > 0, 'drawPaperRoofs moved — this guard needs updating, not deleting');
  const body = source.slice(start, source.indexOf('\n}\n', start));
  assert.match(body, /const rings = authoritativeHouseFootprints\(state, refLayers\);/);
  // The union it must never grow back.
  assert.doesNotMatch(body, /rings\.push\(refLayers\.house\)/);
  assert.doesNotMatch(body, /z\.feature === 'house'/);
});

test('a second building keeps its name when the map already covers the first', () => {
  // THE ANONYMOUS GREY RECTANGLE. groundContentRingsForSheet dropped EVERY feature:'house' zone as
  // soon as refLayers.house held anything, on the reasoning that the promoted ring already draws
  // and names it. resolveBaseLayers promotes ONE. A farm with a house, a store room and a shade
  // tunnel has three house rings, and the two that were not promoted got painted by drawPaperRoofs
  // and then stripped of their label AND their legend row — a real building arriving on a plan with
  // no name and no way to identify it.
  const promoted = square(0.2, 0.2, 0.12);
  const tunnel = square(0.62, 0.55, 0.09);
  const rings = groundContentRingsForSheet(
    {
      zones: [
        zone({ id: 'main', points: promoted, feature: 'house', name: 'House' }),
        zone({ id: 'tunnel', points: tunnel, feature: 'house', name: 'Shade tunnel' }),
      ],
    },
    { house: promoted, driveway: [] },
    'all',
  );
  assert.deepEqual(rings.map((r) => r.id), ['tunnel'],
    'the promoted ring is named by the map pass; every OTHER building must keep its own label');
});

test('the promoted ring is still suppressed, so no building is named twice', () => {
  const promoted = square(0.3, 0.3, 0.15);
  const rings = groundContentRingsForSheet(
    { zones: [zone({ id: 'main', points: promoted, feature: 'house', name: 'House' })] },
    { house: promoted, driveway: [] },
    'all',
  );
  assert.deepEqual(rings, [], 'the ring the map draws must not also be labelled by the ground pass');
});

test('with no map house, every drawn building is named', () => {
  const rings = groundContentRingsForSheet(
    {
      zones: [
        zone({ id: 'a', points: square(0.2, 0.2, 0.1), feature: 'house', name: 'House' }),
        zone({ id: 'b', points: square(0.6, 0.6, 0.08), feature: 'house', name: 'Shade tunnel' }),
      ],
    },
    { house: [], driveway: [] },
    'all',
  );
  assert.deepEqual(rings.map((r) => r.id), ['a', 'b']);
});
