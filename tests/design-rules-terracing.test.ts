import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateDesign } from '../lib/design-rules.ts';
import type { DesignCanvasState, LineShape, PlacedItem, ZoneShape } from '../lib/design-canvas.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';

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

function designState({
  items = [],
  zones = [],
  lines = [],
  frame = { centerLng: 30, centerLat: -29, zoom: 18, imgW: 1000, imgH: 500, mPerPx: 0.1 },
}: {
  items?: PlacedItem[];
  zones?: ZoneShape[];
  lines?: LineShape[];
  frame?: DesignCanvasState['frame'];
} = {}): DesignCanvasState {
  return {
    siteId: 'rules-test',
    frame,
    step: 'review',
    items,
    zones,
    lines,
    rev: 1,
    updatedAt: '2026-07-29T00:00:00.000Z',
  };
}

function placed(id: string, defId: string, x: number, y: number): PlacedItem {
  return { id, defId, x, y };
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

test('shade advice follows the southern-hemisphere direction and metre geometry', () => {
  const tree = placed('tree', 'tree_indigenous', 0.5, 0.4);
  const southBed = placed('south', 'veg_bed', 0.5, 0.5);
  const northBed = placed('north', 'veg_bed', 0.5, 0.3);
  const farEastBed = placed('east', 'veg_bed', 0.61, 0.5);
  const advice = evaluateDesign(
    designState({ items: [tree, southBed, northBed, farEastBed] }),
    ELEMENTS_BY_ID,
  ).filter((entry) => /will shade/.test(entry.msg));

  assert.deepEqual(advice.map((entry) => entry.itemId), ['south']);
  assert.ok(advice.every((entry) => entry.layer === 'planting' && entry.severity === 'warn'));
});

test('roof proximity uses true metres on a non-square frame and includes the stated threshold', () => {
  const exactlyAtLimit = placed('at-limit', 'jojo_5000', 0.53, 0.5);
  const beyondLimit = placed('beyond', 'jojo_5000', 0.531, 0.5);
  const advice = evaluateDesign(
    designState({ items: [exactlyAtLimit, beyondLimit] }),
    ELEMENTS_BY_ID,
    undefined,
    { houseXY: [0.5, 0.5] },
  ).filter((entry) => entry.layer === 'water' && /roof/.test(entry.msg));

  assert.deepEqual(advice.map((entry) => entry.itemId), ['beyond']);
});

test('zone-fit advice reads effort zones only and says nothing for unclassified ground', () => {
  const citrus = placed('citrus', 'tree_citrus', 0.5, 0.5);
  const ring: ZoneShape['points'] = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]];
  const groundOnly = designState({
    items: [citrus],
    zones: [{ id: 'ground', zone: 4, feature: 'lawn', points: ring }],
  });
  const effortZone = designState({
    items: [citrus],
    zones: [{ id: 'effort', zone: 4, points: ring }],
  });

  assert.equal(evaluateDesign(groundOnly, ELEMENTS_BY_ID).some((entry) => /usually belongs/.test(entry.msg)), false);
  const mismatch = evaluateDesign(effortZone, ELEMENTS_BY_ID)
    .find((entry) => /usually belongs/.test(entry.msg));
  assert.equal(mismatch?.itemId, citrus.id);
  assert.match(mismatch?.msg ?? '', /Zone 2\/3.*Zone 4/);
});

test('beehive clearance measures the nearest path segment rather than its distant endpoints', () => {
  const hive = placed('hive', 'beehive', 0.5, 0.5);
  const nearbyPath: LineShape = {
    id: 'path',
    kind: 'path',
    points: [[0.2, 0.6], [0.8, 0.6]],
  };
  const advice = evaluateDesign(
    designState({ items: [hive], lines: [nearbyPath] }),
    ELEMENTS_BY_ID,
  );

  assert.ok(advice.some((entry) => entry.itemId === hive.id && /flight path/.test(entry.msg)));
});

test('banana-circle feed advice clears only for a real nearby basin or pipe', () => {
  const banana = placed('banana', 'banana_circle', 0.5, 0.5);
  const noFeed = evaluateDesign(designState({ items: [banana] }), ELEMENTS_BY_ID);
  const nearbyBasin = evaluateDesign(designState({
    items: [banana, placed('basin', 'greywater_basin', 0.55, 0.5)],
  }), ELEMENTS_BY_ID);
  const nearbyPipe = evaluateDesign(designState({
    items: [banana],
    lines: [{ id: 'pipe', kind: 'pipe', points: [[0.3, 0.55], [0.7, 0.55]] }],
  }), ELEMENTS_BY_ID);

  assert.ok(noFeed.some((entry) => /Feed the Banana Circle/.test(entry.msg)));
  assert.equal(nearbyBasin.some((entry) => /Feed the Banana Circle/.test(entry.msg)), false);
  assert.equal(nearbyPipe.some((entry) => /Feed the Banana Circle/.test(entry.msg)), false);
});

test('an unfinished one-point windbreak cannot suppress the regional wind advice', () => {
  const unfinished: LineShape = { id: 'half', kind: 'windbreak', points: [[0.5, 0.5]] };
  const complete: LineShape = {
    id: 'complete',
    kind: 'windbreak',
    points: [[0.2, 0.2], [0.8, 0.2]],
  };
  const site = { windFromSummer: 'NE' };

  assert.ok(evaluateDesign(designState({ lines: [unfinished] }), ELEMENTS_BY_ID, site)
    .some((entry) => /Summer wind/.test(entry.msg)));
  assert.equal(evaluateDesign(designState({ lines: [complete] }), ELEMENTS_BY_ID, site)
    .some((entry) => /Summer wind/.test(entry.msg)), false);
});

test('advice is deterministic, input-safe, capped, and keeps warnings ahead of tips', () => {
  const customDefs = Object.fromEntries(Array.from({ length: 10 }, (_, index) => {
    const id = `tank-${index}`;
    return [id, { ...ELEMENTS_BY_ID.jojo_5000, id, name: `Tank ${index}` }];
  }));
  const state = designState({
    items: Object.keys(customDefs).map((defId, index) => placed(`item-${index}`, defId, 0.9, 0.9)),
  });
  const before = structuredClone(state);
  const first = evaluateDesign(state, customDefs, { windFromSummer: 'NE' }, { houseXY: [0.1, 0.1] });
  const second = evaluateDesign(structuredClone(state), customDefs, { windFromSummer: 'NE' }, {
    houseXY: [0.1, 0.1],
  });

  assert.deepEqual(second, first);
  assert.deepEqual(state, before);
  assert.equal(first.length, 8);
  assert.ok(first.every((entry) => entry.severity === 'warn'));
  assert.equal(new Set(first.map((entry) => entry.msg)).size, first.length);
});
