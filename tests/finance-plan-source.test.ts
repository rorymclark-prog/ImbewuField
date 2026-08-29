import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { chooseFinanceBeds } from '@/lib/finance-plan-source';
import type { PlanBed } from '@/lib/crop-plan';

const studio: PlanBed[] = [
  { id: 'design-1', label: 'Bed 1', areaM2: 64, minDimM: 1.2 },
  { id: 'design-2', label: 'Bed 2', areaM2: 64, minDimM: 1.2 },
];
const legacy: PlanBed[] = [{ id: 'fac-1', label: 'Old bed', areaM2: 44, minDimM: 1.2 }];

test('finance beds: the Design Studio canvas wins, as it does in the crop planner', () => {
  const chosen = chooseFinanceBeds(studio, legacy);
  assert.equal(chosen.origin, 'studio');
  assert.deepEqual(chosen.beds.map((b) => b.id), ['design-1', 'design-2']);
});

test('finance beds: the legacy design is used only when there is no Studio canvas', () => {
  const chosen = chooseFinanceBeds([], legacy);
  assert.equal(chosen.origin, 'facilitator');
  assert.deepEqual(chosen.beds.map((b) => b.id), ['fac-1']);
});

test('finance beds: a lone placeholder bed is NOT a design', () => {
  // bedsFromDesign() invents one 10 m² 'virtual-bed' so an empty facilitator
  // design can still be planned on. Accepting it here would divide real harvest
  // kilograms by imaginary land and print a density for ground nobody has.
  const chosen = chooseFinanceBeds([], [{ id: 'virtual-bed-1', label: 'Garden', areaM2: 10, minDimM: 1.2 }]);
  assert.equal(chosen.origin, 'none');
  assert.deepEqual(chosen.beds, []);
});

test('finance beds: real legacy beds survive alongside a placeholder', () => {
  const chosen = chooseFinanceBeds([], [
    { id: 'virtual-bed-1', label: 'Garden', areaM2: 10, minDimM: 1.2 },
    ...legacy,
  ]);
  assert.equal(chosen.origin, 'facilitator');
  assert.deepEqual(chosen.beds.map((b) => b.id), ['fac-1'], 'the placeholder is dropped, the real bed is kept');
});

test('finance beds: no mapped ground anywhere is "none", never an empty studio', () => {
  const chosen = chooseFinanceBeds([], []);
  assert.equal(chosen.origin, 'none');
  assert.deepEqual(chosen.beds, []);
});

test('finance beds: the chosen list is a copy, so a card cannot mutate the source', () => {
  const chosen = chooseFinanceBeds(studio, []);
  chosen.beds.push({ id: 'x', label: 'X', areaM2: 1, minDimM: 1 });
  assert.equal(studio.length, 2);
});

test('finance page: every card takes its beds from the ONE plan source', () => {
  // THE REGRESSION THIS STOPS. FarmMetrics read the Design Studio canvas while
  // HarvestReconciliation read the legacy facilitator canvas — 128 m² against
  // 44 m² on the sample farm, densities a factor of three apart, both printed
  // as facts about one farm. If a future edit gives either card its own bed
  // loader again, this fails.
  const src = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');

  const cardUses = [...src.matchAll(/<(FarmMetrics|HarvestReconciliation)\b([^>]*)>/g)];
  assert.ok(cardUses.length >= 2, `expected both cards in the page, found ${cardUses.length}`);
  for (const [, name, props] of cardUses) {
    assert.match(props, /beds=\{planSource\.beds\}/, `${name} must take beds from planSource`);
    assert.match(props, /plantings=\{planSource\.plantings\}/, `${name} must take plantings from planSource`);
  }

  assert.match(src, /useFinancePlanSource\(\)/, 'the page reads the shared source');
  for (const banned of ['bedsFromDesignCanvas', 'bedsFromDesign(', 'loadFacilitatorState']) {
    assert.ok(!src.includes(banned), `the Finance page must not load beds itself (found ${banned})`);
  }
});
