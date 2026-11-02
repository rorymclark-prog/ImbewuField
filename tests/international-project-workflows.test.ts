import assert from 'node:assert/strict';
import test from 'node:test';
import { PROJECT_TEMPLATES, projectTemplate } from '@/lib/international/projects/templates';
import { reviewProjectIndicator, validProjectDate } from '@/lib/international/projects/evaluate';
import { existingProjectReference, productionProjectEvidence } from '@/lib/international/projects/sources';
import { PROJECT_DEMO_CONTEXT, projectDemoEvidence } from '@/lib/international/projects/demo';
import type { ProjectEvidence, ProjectReviewContext } from '@/lib/international/projects/types';

const context: ProjectReviewContext = { projectId: 'demo-project', siteId: 'demo-site', periodStart: '2026-10-01',
  periodEnd: '2026-10-31', cutoffDate: '2026-11-02', timeZone: 'Africa/Johannesburg', audience: 'grower-review', allowDemo: true };
const harvest = projectTemplate('food-security')!.indicators[0];
const survival = projectTemplate('agroforestry')!.indicators[1];
const soil = projectTemplate('agroecology')!.indicators[1];
const receipts = projectTemplate('livelihoods')!.indicators[0];
const row = (patch: Partial<ProjectEvidence> = {}): ProjectEvidence => ({
  reference: { authority: 'farm-records', id: 'harvest-1' }, projectId: context.projectId, siteId: context.siteId,
  kind: 'harvest', level: 'output', basis: 'actual', provenance: 'fictional-demo', periodStart: '2026-10-03',
  periodEnd: '2026-10-03', recordedOn: '2026-10-04', stage: 'current', quantity: 4, unit: 'kg',
  consent: 'granted', published: false, ...patch,
});
const paired = (kind: 'survival' | 'soil-observation' = 'survival'): ProjectEvidence[] => [
  row({ reference: { authority: 'programme-evidence', id: 'baseline' }, kind, level: 'outcome', unit: kind === 'survival' ? 'trees' : 'example-score',
    stage: 'baseline', periodStart: '2026-09-01', periodEnd: '2026-09-01', recordedOn: '2026-09-02', quantity: 10, denominator: 10, population: 'cohort-A', method: 'documented-example' }),
  row({ reference: { authority: 'programme-evidence', id: 'follow-up' }, kind, level: 'outcome', unit: kind === 'survival' ? 'trees' : 'example-score',
    stage: 'follow-up', quantity: 8, denominator: 10, population: 'cohort-A', method: 'documented-example' }),
];

test('all five grower-owned workflows have actionable source-linked steps and defined indicator limits', () => {
  assert.deepEqual(new Set(PROJECT_TEMPLATES.map(template => template.id)), new Set(['food-security', 'livelihoods', 'agroforestry', 'agroecology', 'market-garden']));
  for (const template of PROJECT_TEMPLATES) {
    assert.equal(template.owner, 'grower');
    assert.equal(template.readiness, 'workflow-reference');
    assert.ok(template.steps.length >= 3);
    assert.ok(template.steps.every(step => step.action && step.authority && step.review));
    assert.ok(template.indicators.every(indicator => indicator.definition && indicator.evidenceNeeded && indicator.limits));
    assert.equal(new Set(template.indicators.map(indicator => indicator.id)).size, template.indicators.length);
  }
  assert.equal(projectTemplate('unsupported'), undefined);
});

test('each selectable demo indicator has a positive control and rejects the planned-only scenario', () => {
  for (const template of PROJECT_TEMPLATES) for (const indicator of template.indicators) {
    assert.equal(reviewProjectIndicator(indicator, projectDemoEvidence(indicator, 'observed'), PROJECT_DEMO_CONTEXT).state, 'reported', indicator.id);
    assert.equal(reviewProjectIndicator(indicator, projectDemoEvidence(indicator, 'estimate'), PROJECT_DEMO_CONTEXT).value, null, indicator.id);
  }
});

test('planned work and participation cannot satisfy an observed outcome indicator', () => {
  for (const patch of [{ basis: 'estimate' as const }, { level: 'participation' as const }, { level: 'output' as const }]) {
    const evidence = paired().map(item => ({ ...item, ...patch }));
    const result = reviewProjectIndicator(survival, evidence, context);
    assert.equal(result.value, null);
    assert.equal(result.state, 'unavailable');
    assert.equal(result.accepted.length, 0);
    assert.ok(result.rejected.length > 0);
  }
});

test('known actual weights sum exactly while a recorded zero remains distinct from no observation', () => {
  const result = reviewProjectIndicator(harvest, [row({ quantity: 0.1 }), row({ reference: { authority: 'farm-records', id: 'another' }, quantity: 0.2 })], context);
  assert.equal(result.value, 0.3);
  assert.equal(result.state, 'reported');
  assert.equal(reviewProjectIndicator(harvest, [row({ quantity: 0 })], context).value, 0);
  assert.equal(reviewProjectIndicator(harvest, [], context).value, null);
  assert.equal(reviewProjectIndicator(harvest, [row({ quantity: null })], context).value, null);
});

test('fixed-cohort survival reports a percentage with a positive denominator and matched baseline', () => {
  const result = reviewProjectIndicator(survival, paired(), context);
  assert.equal(result.value, 80);
  assert.equal(result.unit, '%');
  assert.equal(result.baseline, 10);
  assert.equal(result.followUp, 8);
  assert.match(result.interpretation, /not carbon/);
  for (const denominator of [undefined, null, 0, 9]) {
    const evidence = paired(); evidence[1] = { ...evidence[1], denominator };
    assert.equal(reviewProjectIndicator(survival, evidence, context).value, null);
  }
  assert.equal(reviewProjectIndicator(survival, paired().slice(1), context).value, null);
});

test('a changed population, changed method or overlapping baseline cannot produce a matched outcome', () => {
  for (const patch of [{ population: 'replacement-trees' }, { method: 'different-protocol' }, { periodStart: '2026-09-01', periodEnd: '2026-10-03' }]) {
    const evidence = paired(); evidence[1] = { ...evidence[1], ...patch };
    assert.equal(reviewProjectIndicator(survival, evidence, context).value, null);
  }
  const tooMany = paired(); tooMany[1].quantity = 11;
  assert.equal(reviewProjectIndicator(survival, tooMany, context).value, null);
});

test('soil comparisons require an explicit unit and retain adverse change without claiming improvement', () => {
  assert.equal(reviewProjectIndicator(soil, paired('soil-observation'), context).value, null);
  const result = reviewProjectIndicator(soil, paired('soil-observation'), { ...context, measurementUnit: 'example-score' });
  assert.equal(result.value, -2);
  assert.match(result.interpretation, /does not prove/);
});

test('wrong site, project, units, source, dates and submission cutoff are excluded rather than borrowed', () => {
  for (const patch of [
    { siteId: 'other-farm' }, { projectId: 'other-project' }, { unit: 'crates' },
    { reference: { authority: 'task-board' as const, id: 'planned-harvest' } },
    { periodStart: '2026-09-30', periodEnd: '2026-09-30' }, { recordedOn: '2026-11-03' },
    { periodStart: '2026-02-30' }, { recordedOn: '2026-10-01' },
  ]) {
    const result = reviewProjectIndicator(harvest, [row(patch)], context);
    assert.equal(result.value, null, JSON.stringify(patch));
    assert.equal(result.accepted.length, 0);
  }
  assert.equal(reviewProjectIndicator(harvest, [row()], { ...context, timeZone: 'invalid-zone' }).value, null);
  assert.equal(reviewProjectIndicator(harvest, [row()], { ...context, cutoffDate: '2026-10-20' }).value, null, 'an unfinished reporting period is not complete');
});

test('duplicate references are reconciled before either copy can increase the total', () => {
  const result = reviewProjectIndicator(harvest, [row(), row({ quantity: 99 })], context);
  assert.equal(result.value, null);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected.length, 2);
  assert.ok(result.rejected.every(item => item.reasons.some(reason => /Duplicate/.test(reason))));
});

test('partial known evidence stays separate from a complete reported total', () => {
  const result = reviewProjectIndicator(harvest, [row(), row({ reference: { authority: 'farm-records', id: 'unknown' }, quantity: null })], context);
  assert.equal(result.state, 'incomplete');
  assert.equal(result.value, null);
  assert.equal(result.knownSubtotal, 4);
});

test('a monthly summary and its harvest book cannot be added as independent production', () => {
  const result = reviewProjectIndicator(harvest, [row(), row({ reference: { authority: 'production-records', id: 'monthly-summary' } })], context);
  assert.equal(result.value, null);
  assert.equal(result.knownSubtotal, null);
  assert.ok(result.gaps.some(gap => /cross-book/.test(gap)));
});

test('consent, publication and fictional examples cannot be promoted into live shared results', () => {
  for (const consent of ['unknown', 'withheld'] as const) assert.equal(reviewProjectIndicator(harvest, [row({ consent })], context).value, null);
  assert.equal(reviewProjectIndicator(harvest, [row()], { ...context, allowDemo: false }).value, null);
  assert.equal(reviewProjectIndicator(harvest, [row({ published: true })], { ...context, audience: 'publication' }).value, null);
  assert.equal(reviewProjectIndicator(harvest, [row({ provenance: 'source-record' })], { ...context, audience: 'publication' }).value, null);
  assert.equal(reviewProjectIndicator(harvest, [row({ provenance: 'source-record', published: true })], { ...context, audience: 'publication' }).value, 4);
});

test('money preserves its recorded denomination and refuses mixed currency even as a subtotal', () => {
  const payment = row({ kind: 'payment', unit: 'currency', currency: 'ZAR', quantity: 100 });
  assert.equal(reviewProjectIndicator(receipts, [payment], { ...context, currency: 'ZAR' }).value, 100);
  assert.equal(reviewProjectIndicator(receipts, [payment], { ...context, currency: 'USD' }).value, null);
  assert.equal(reviewProjectIndicator(receipts, [payment], context).value, null);
  const mixed = reviewProjectIndicator(receipts, [payment, { ...payment, reference: { authority: 'farm-records', id: 'usd' }, currency: 'USD' }], { ...context, currency: 'ZAR' });
  assert.equal(mixed.value, null);
  assert.equal(mixed.knownSubtotal, null);
});

test('monthly production adapter retains actual/expected, site, units and whole-month coverage', () => {
  const records = [{ id: 'p', siteId: context.siteId, sourceIconKey: 'crop:cabbage', label: 'Recorded production',
    date: { year: 2026, month: 10 }, quantity: 4, unit: 'kg' as const, status: 'actual' as const }];
  const envelope = { projectId: context.projectId, recordedOn: '2026-11-01', consent: 'granted' as const, published: false };
  const [evidence] = productionProjectEvidence(records, envelope);
  assert.equal(evidence.periodStart, '2026-10-01');
  assert.equal(evidence.periodEnd, '2026-10-31');
  assert.equal(reviewProjectIndicator(harvest, [evidence], context).value, 4);
  assert.equal(reviewProjectIndicator(harvest, [evidence], { ...context, periodStart: '2026-10-02' }).value, null, 'monthly totals cannot be prorated into an unrecorded daily value');
  const [expected] = productionProjectEvidence([{ ...records[0], status: 'expected' }], envelope);
  assert.equal(expected.basis, 'estimate');
  assert.equal(reviewProjectIndicator(harvest, [expected], context).value, null);
  assert.equal(productionProjectEvidence([{ ...records[0], siteId: undefined }], envelope).length, 0);
  assert.deepEqual(existingProjectReference('production-records', records[0]), { authority: 'production-records', id: 'p' });
});

test('invalid counts and impossible result magnitudes cannot pass as complete evidence', () => {
  assert.equal(validProjectDate('2024-02-29'), true);
  assert.equal(validProjectDate('2026-02-29'), false);
  const fractional = paired(); fractional[1].quantity = 8.5;
  assert.equal(reviewProjectIndicator(survival, fractional, context).value, null);
  const huge = reviewProjectIndicator(harvest, [row({ quantity: Number.MAX_VALUE }), row({ reference: { authority: 'farm-records', id: 'huge2' }, quantity: Number.MAX_VALUE })], context);
  assert.equal(huge.value, null);
});
