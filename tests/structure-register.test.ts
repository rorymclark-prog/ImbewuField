// The STRUCTURE REGISTER exists because the paid polish pass roofed the concrete slab and the
// driveway (Rory's first two v93 Full Treatments): nothing ever told the model what each traced
// rectangle IS. These tests pin the classification — house kinds are the only roofed buildings,
// every other ground feature is described as open to the sky — and the computed size/position
// phrasing, so a refactor cannot quietly turn a slab back into a building.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

// THE GUARD THAT WAS MISSING. Everything above proves the register is BUILT correctly. Nothing
// proved it was ever SENT — and it was not: structureRegisterText was exported, documented and
// unit-tested, while all three buildFinishedSheetPolishPrompt call sites passed only three
// arguments, so the STRUCTURE REGISTER paragraph never reached a single paid render. The model
// went on guessing which rectangles were buildings, which is exactly what this file's own header
// records happening (the concrete slab rendered as a corrugated gable roof, the driveway as a
// third dark-roofed building) and what Rory reported again as "a deformed roof".
//
// A unit test on a pure function cannot see that its caller dropped an optional argument. This
// reads the call sites.
test('every paid polish prompt is actually GIVEN the structure register', async () => {
  const source = await readFile(
    new URL('../components/design/DesignGlossy.tsx', import.meta.url),
    'utf8',
  );
  const calls = source.match(/buildFinishedSheetPolishPrompt\(([^;]*?)\)\s*$/gm)
    ?? source.split('buildFinishedSheetPolishPrompt(').slice(1).map((tail) => tail.split('\n')[0]);
  assert.ok(calls.length >= 3, `expected the known polish call sites, found ${calls.length}`);
  for (const call of calls) {
    if (call.includes('import') || call.includes('function ')) continue;
    assert.ok(
      call.includes('structureRegisterText'),
      `a polish prompt is built without the structure register, so the model will guess which '
      + 'shapes are buildings: ${call.trim().slice(0, 160)}`,
    );
  }
});
