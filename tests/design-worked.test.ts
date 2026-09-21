import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_WORKED, existingFeatureIds, workedArea, workedProblems } from '@/lib/design-worked';

test('the worked design example is a bounded fictional metre model with a named source for every revision', () => {
  assert.equal(DESIGN_WORKED.coordinateSystem.unit, 'metres');
  assert.match(DESIGN_WORKED.notice, /Fictional classroom model/);
  assert.ok(DESIGN_WORKED.sourceCards.some(card => card.id === DESIGN_WORKED.revision.source));
  assert.ok(DESIGN_WORKED.sourceCards.some(card => card.kind === 'unknown'));
});

test('the alternatives share one supplied growing-area basis and revisions do not rewrite existing evidence', () => {
  const existing = DESIGN_WORKED.existing.find(feature => feature.id === 'E-PLOT-A')!;
  const alternative = DESIGN_WORKED.concepts.find(concept => concept.id === 'B')!.geometry[0]!;
  assert.equal(workedArea(existing), 48);
  assert.equal(workedArea(alternative), 48);
  assert.deepEqual(existingFeatureIds(), ['E-PLOT-A', 'E-HOME', 'E-ROUTE', 'E-GATE', 'E-WATER']);
  assert.equal(DESIGN_WORKED.proposal.status, 'deferred after W-CARE');
});

test('the source pack catches a layout or revision that stops being internally honest', () => {
  assert.deepEqual(workedProblems(), []);
});
