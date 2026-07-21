import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateDesign } from '../lib/design-rules.ts';
import type { DesignCanvasState } from '../lib/design-canvas.ts';

// Adversarial review of the terracing feature (docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md) found
// its safety-reviewed decision table was correctly built in lib/terracing.ts, but the advisor tip
// that actually reaches a farmer (lib/design-rules.ts's terraceTip) used the wrong field, dropped
// the mandatory regional footer, never escalated severity, and gutted the whole-site-average
// caveat. These tests lock in the fix so none of that regresses silently a second time.

function baseState(zoneOverrides: Partial<DesignCanvasState['zones'][number]>): DesignCanvasState {
  return {
    siteId: 'site-1',
    frame: { centerLng: 30, centerLat: -29, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 },
    step: 'zones',
    items: [],
    zones: [
      {
        id: 'z1',
        zone: 1,
        points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2]],
        feature: 'terrace_bank',
        ...zoneOverrides,
      },
    ],
    lines: [],
    rev: 1,
    updatedAt: '2026-07-21T00:00:00.000Z',
  } as DesignCanvasState;
}

function terraceMsg(state: DesignCanvasState, site?: { slopePct?: number }) {
  const advice = evaluateDesign(state, {}, site);
  const found = advice.find((a) => a.itemId === undefined && a.layer === 'zones' && /slope/.test(a.msg));
  assert.ok(found, 'expected a terrace tip in the advice list');
  return found!;
}

test('a measured row-5 slope shows the real safety copy, not the internal review rationale', () => {
  const state = baseState({ measuredSlopePct: 25 });
  const advice = terraceMsg(state);

  // The actual safety-reviewed sentence must be on screen — vetiver timing hazard, and the real
  // escalation trigger, not a stripped-down paraphrase.
  assert.match(advice.msg, /never cut the full bench and plant vetiver in the same season/);
  assert.match(advice.msg, /2 m TOTAL stacked height/);
  assert.match(advice.msg, /once stacked height passes about 1 m/);
  // The internal review's own rationale must NOT leak into farmer-facing text.
  assert.doesNotMatch(advice.msg, /adversarial review/);
  assert.doesNotMatch(advice.msg, /`ask_local_expert`/);
});

test('rows above "no" escalate to warn severity; row 1-2 stay a plain tip', () => {
  const low = terraceMsg(baseState({ measuredSlopePct: 1 }));
  assert.equal(low.severity, 'tip');

  const high = terraceMsg(baseState({ measuredSlopePct: 25 }));
  assert.equal(high.severity, 'warn');

  const always = terraceMsg(baseState({ measuredSlopePct: 40 }));
  assert.equal(always.severity, 'warn');
});

test('the mandatory regional footer is present every time a recommendation is shown', () => {
  const advice = terraceMsg(baseState({ measuredSlopePct: 8 }));
  assert.match(advice.msg, /KwaZulu-Natal/);
  assert.match(advice.msg, /SANS 10160-5/);
  assert.match(advice.msg, /Always confirm locally before cutting/);
});

test('a whole-site-average slope in a high-risk band gets the compounding-uncertainty escalation, not the generic caveat', () => {
  const state = baseState({ measuredSlopePct: undefined });
  const advice = terraceMsg(state, { slopePct: 28 });
  assert.match(advice.msg, /WHOLE-SITE AVERAGE/);
  assert.match(advice.msg, /very likely steeper than this number/);
});

test('a whole-site-average slope in a low-risk band gets the plain "next row\'s method" caveat', () => {
  const state = baseState({ measuredSlopePct: undefined });
  const advice = terraceMsg(state, { slopePct: 3 });
  assert.match(advice.msg, /next row's method, not this one/);
  assert.doesNotMatch(advice.msg, /WHOLE-SITE AVERAGE/);
});

test('the row 5/6 boundary is presented as a zone, not a precise line', () => {
  const near = terraceMsg(baseState({ measuredSlopePct: 30 }));
  assert.match(near.msg, /25-35%/);
  assert.match(near.msg, /precise enough to trust to the percentage point/);

  const far = terraceMsg(baseState({ measuredSlopePct: 8 }));
  assert.doesNotMatch(far.msg, /25-35%/);
});
