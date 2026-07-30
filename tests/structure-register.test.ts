// The STRUCTURE REGISTER exists because the paid polish pass roofed the concrete slab and the
// driveway (Rory's first two v93 Full Treatments): nothing ever told the model what each traced
// rectangle IS. These tests pin the classification — house kinds are the only roofed buildings,
// every other ground feature is described as open to the sky — and the computed size/position
// phrasing, so a refactor cannot quietly turn a slab back into a building.
import test from 'node:test';
import assert from 'node:assert/strict';
import { structureRegisterText } from '../lib/structure-register.ts';
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
});

const REF_EMPTY = { boundary: square(0, 0, 1), house: [] as Array<[number, number]>, driveway: [] as Array<[number, number]> };

test('house rings are roofed buildings, ranked by traced size; slabs stay flat', () => {
  const register = structureRegisterText(
    {
      zones: [
        zone({ id: 'classroom', points: square(0.2, 0.4, 0.2), feature: 'house', name: 'Classroom' }),
        zone({ id: 'storeroom', points: square(0.7, 0.1, 0.1), feature: 'house', name: 'Storeroom' }),
        zone({ id: 'slab', points: square(0.45, 0.45, 0.1), feature: 'patio', name: 'Concrete Slab' }),
      ],
    },
    REF_EMPTY,
  );

  assert.ok(
    register.includes(
      '"Classroom" (western part of the site) is the largest roofed building on the site — draw exactly one roof on its exact footprint.',
    ),
    register,
  );
  assert.ok(
    register.includes('"Storeroom" (northern part of the site) is a roofed building, smaller than "Classroom"'),
    register,
  );
  assert.ok(
    register.includes(
      '"Concrete Slab" (central part of the site) is flat paving at ground level — bare concrete open to the sky, with NO roof and NO walls.',
    ),
    register,
  );
});

test('effort zones and the boundary ring never reach the register', () => {
  const register = structureRegisterText(
    {
      zones: [
        zone({ id: 'z1', points: square(0.1, 0.1, 0.5) }), // plain effort zone, no feature
        zone({ id: 'edge', points: square(0, 0, 1), feature: 'boundary' }),
      ],
    },
    REF_EMPTY,
  );
  assert.equal(register, '');
});

test('a reference-traced driveway with no Studio ring is still declared a ground track', () => {
  const register = structureRegisterText(
    { zones: [] },
    { ...REF_EMPTY, driveway: [[0.6, 0.6], [0.9, 0.9]] },
  );
  assert.ok(
    register.includes('"The driveway" (southern part of the site) is a vehicle track on the ground'),
    register,
  );
  assert.match(register, /never a roof/);
});

test('the main-map house ring is listed once — skipped when a Studio ring is the same building', () => {
  const classroom = zone({ id: 'c', points: square(0.2, 0.4, 0.2), feature: 'house', name: 'Classroom' });

  const distinct = structureRegisterText(
    { zones: [classroom] },
    { ...REF_EMPTY, house: square(0.7, 0.7, 0.15) },
  );
  assert.ok(distinct.includes('"The main farm building"'), distinct);

  const duplicate = structureRegisterText(
    { zones: [classroom] },
    { ...REF_EMPTY, house: square(0.21, 0.41, 0.2) }, // centroid within 0.05 of the Classroom ring
  );
  assert.ok(!duplicate.includes('The main farm building'), duplicate);
});

test('an untouched site produces an empty register, not filler', () => {
  assert.equal(structureRegisterText({ zones: [] }, REF_EMPTY), '');
});
