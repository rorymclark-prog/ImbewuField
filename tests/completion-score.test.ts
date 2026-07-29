import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeCompletionScore,
  deriveSiteStage,
  type CompletionScoreInputs,
} from '../lib/completion-score.ts';

function inputs(overrides: Partial<CompletionScoreInputs> = {}): CompletionScoreInputs {
  return {
    hasSite: false,
    boundaryPointCount: 0,
    surveyFilledFields: 0,
    surveyTotalFields: 10,
    zoneCount: 0,
    elementCount: 0,
    hasCropPlan: false,
    ...overrides,
  };
}

test('an untouched site is zero and every genuinely finished step reaches 100', () => {
  const empty = computeCompletionScore(inputs());
  assert.equal(empty.overallPct, 0);
  assert.ok(empty.steps.every((step) => step.pct === 0 && !step.done));

  const complete = computeCompletionScore(inputs({
    hasSite: true,
    boundaryPointCount: 3,
    surveyFilledFields: 10,
    zoneCount: 1,
    elementCount: 1,
    hasCropPlan: true,
  }));
  assert.equal(complete.overallPct, 100);
  assert.ok(complete.steps.every((step) => step.pct === 100 && step.done));
});

test('each real journey step raises the score without relying on today’s weights', () => {
  const base = computeCompletionScore(inputs()).overallPct;
  const progressed = [
    inputs({ hasSite: true }),
    inputs({ boundaryPointCount: 3 }),
    inputs({ surveyFilledFields: 10 }),
    inputs({ zoneCount: 1, elementCount: 1 }),
    inputs({ hasCropPlan: true }),
  ];
  for (const state of progressed) {
    const score = computeCompletionScore(state);
    assert.ok(score.overallPct > base);
    assert.ok(score.overallPct <= 100);
  }
});

test('a started boundary is partial until it has enough real vertices', () => {
  const one = computeCompletionScore(inputs({ boundaryPointCount: 1 })).steps[1];
  const two = computeCompletionScore(inputs({ boundaryPointCount: 2 })).steps[1];
  const three = computeCompletionScore(inputs({ boundaryPointCount: 3 })).steps[1];
  assert.ok(one.pct > 0 && one.pct < two.pct);
  assert.ok(two.pct < 100 && !two.done);
  assert.equal(three.pct, 100);
  assert.equal(three.done, true);
});

test('survey completion is proportional and overfilled data cannot exceed 100', () => {
  const partial = computeCompletionScore(inputs({
    surveyFilledFields: 4,
    surveyTotalFields: 10,
  })).steps[2];
  const overfilled = computeCompletionScore(inputs({
    surveyFilledFields: 12,
    surveyTotalFields: 10,
  })).steps[2];
  assert.ok(partial.pct > 0 && partial.pct < 100);
  assert.equal(partial.done, false);
  assert.equal(overfilled.pct, 100);
  assert.equal(overfilled.done, true);
});

test('a zone or an element alone is partial, and together they finish design', () => {
  const zoneOnly = computeCompletionScore(inputs({ zoneCount: 1 })).steps[3];
  const elementOnly = computeCompletionScore(inputs({ elementCount: 1 })).steps[3];
  const designed = computeCompletionScore(inputs({ zoneCount: 1, elementCount: 1 })).steps[3];
  assert.ok(zoneOnly.pct > 0 && zoneOnly.pct < 100);
  assert.equal(elementOnly.pct, zoneOnly.pct);
  assert.equal(designed.pct, 100);
  assert.equal(designed.done, true);
});

test('invalid persisted counts never create progress or non-finite output', () => {
  const invalid = [Number.NaN, Infinity, -Infinity, -1];
  for (const bad of invalid) {
    const result = computeCompletionScore(inputs({
      boundaryPointCount: bad,
      surveyFilledFields: bad,
      surveyTotalFields: bad,
      zoneCount: bad,
      elementCount: bad,
    }));
    assert.equal(result.overallPct, 0);
    assert.ok(Number.isFinite(result.overallPct));
    assert.ok(result.steps.every((step) => step.pct === 0 && Number.isFinite(step.pct)));
    assert.equal(deriveSiteStage(inputs({
      boundaryPointCount: bad,
      surveyFilledFields: bad,
      zoneCount: bad,
      elementCount: bad,
    })), 'scout');
  }
});

test('fractional and unsafe persisted counts cannot masquerade as records', () => {
  for (const badCount of [
    0.99,
    1.5,
    2.99,
    3.2,
    Number.MAX_SAFE_INTEGER + 1,
    Number.MAX_VALUE,
  ]) {
    const state = inputs({
      boundaryPointCount: badCount,
      surveyFilledFields: badCount,
      surveyTotalFields: badCount,
      zoneCount: badCount,
      elementCount: badCount,
    });
    const result = computeCompletionScore(state);
    assert.equal(result.overallPct, 0);
    assert.ok(result.steps.every((step) => step.pct === 0 && !step.done));
    assert.equal(deriveSiteStage(state), 'scout');
  }
});

test('all returned percentages remain finite and bounded for extreme input', () => {
  const result = computeCompletionScore(inputs({
    hasSite: true,
    boundaryPointCount: Number.MAX_VALUE,
    surveyFilledFields: Number.MAX_VALUE,
    surveyTotalFields: 1,
    zoneCount: Number.MAX_VALUE,
    elementCount: Number.MAX_VALUE,
    hasCropPlan: true,
  }));
  assert.ok(Number.isFinite(result.overallPct));
  assert.ok(result.overallPct >= 0 && result.overallPct <= 100);
  assert.ok(result.steps.every((step) =>
    Number.isFinite(step.pct) && step.pct >= 0 && step.pct <= 100));
});

test('site stage advances to the furthest valid evidence and never regresses', () => {
  assert.equal(deriveSiteStage(inputs()), 'scout');
  assert.equal(deriveSiteStage(inputs({ hasSite: true })), 'saved');
  assert.equal(deriveSiteStage(inputs({ hasSite: true, boundaryPointCount: 3 })), 'traced');
  assert.equal(deriveSiteStage(inputs({ surveyFilledFields: 1 })), 'designed');
  assert.equal(deriveSiteStage(inputs({ zoneCount: 1 })), 'designed');
  assert.equal(deriveSiteStage(inputs({ zoneCount: 1, hasCropPlan: true })), 'planned');
});

test('a crop plan alone does not claim the design-backed planned stage', () => {
  assert.equal(deriveSiteStage(inputs({ hasCropPlan: true })), 'scout');
  assert.equal(deriveSiteStage(inputs({
    hasSite: true,
    boundaryPointCount: 3,
    hasCropPlan: true,
  })), 'traced');
});
