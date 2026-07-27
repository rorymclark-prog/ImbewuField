import test from 'node:test';
import assert from 'node:assert/strict';

import {
  alignAndDistribute,
  alignAndDistributeSummary,
  ALIGN_ITEMS_DEFAULTS,
  type AlignItemsFrame,
  type AlignInputItem,
  type AlignItemsResult,
} from '../lib/align-items.ts';

// A plain 1 normalised-unit = 1 real metre frame (imgW=imgH=100, mPerPx=1 -> a 100x100m frame) —
// mirrors tests/tidy-outline.test.ts and tests/snap-edges.test.ts's FRAME convention exactly so
// numbers read as real-world distances a farmer would recognise.
const FRAME: AlignItemsFrame = { imgW: 100, imgH: 100, mPerPx: 1 };

function toNorm(ptsM: Array<[number, number]>, frame: AlignItemsFrame): Array<[number, number]> {
  return ptsM.map(([x, y]) => [x / (frame.imgW * frame.mPerPx), y / (frame.imgH * frame.mPerPx)]);
}

// Deterministic pseudo-jitter — a plain sine wave, not a PRNG — so a reader can see exactly what
// perturbation each generated point gets without trusting an RNG algorithm. Same trick
// tests/tidy-outline.test.ts uses for its shaky-square fixture.
function jitter(amplitudeM: number, i: number): number {
  return amplitudeM * Math.sin(i * 2.3);
}

// A farmer's finger-tapped row of 6 beds, roughly 3m apart along a roughly-horizontal line, each
// with a small position jitter (up to ~0.15m) and a small angle jitter (a few degrees either
// side of 0) — exactly the "taps out a row of beds by finger and gets slightly different angles
// and uneven spacing" scenario Clean up exists for (see lib/align-items.ts's module doc, quoting
// Rory directly).
function jitteredRowM(n: number): Array<{ xM: number; yM: number; rotDeg: number }> {
  const rots = [2, -3, 4, -2, 3, -4, 5, -5];
  const out: Array<{ xM: number; yM: number; rotDeg: number }> = [];
  for (let i = 0; i < n; i++) {
    out.push({
      xM: i * 3 + jitter(0.15, i),
      yM: 10 + jitter(0.12, i + 10),
      rotDeg: rots[i % rots.length],
    });
  }
  return out;
}

function rowToItems(n: number): AlignInputItem[] {
  return jitteredRowM(n).map(({ xM, yM, rotDeg }, i) => {
    const [x, y] = toNorm([[xM, yM]], FRAME)[0];
    return { id: `bed${i}`, x, y, rot: rotDeg, shape: 'rect' };
  });
}

// ── main scenario: a jittered row of beds straightens ──────────────────────────────────────────

test('alignAndDistribute: a finger-tapped row of 6 beds with jittered angle and spacing straightens', () => {
  const items = rowToItems(6);
  const result = alignAndDistribute(items, { frame: FRAME });

  assert.equal(result.reason, 'aligned');
  assert.equal(result.changed, true);
  assert.equal(result.items.length, 6); // same count, never adds/removes an item
  assert.equal(result.movedCount, 6);
  assert.equal(result.rotatedCount, 6); // every bed's angle jitter differs from the mean
  assert.ok(Math.abs((result.angleDeg ?? NaN) - 0) < 0.5, `expected the mean angle near 0°, got ${result.angleDeg}`);
  // The row spans ~15m; the jitter amplitudes (0.15m position, a few degrees) should never need
  // more than a couple of tenths of a metre of correction.
  assert.ok(result.maxMovedM > 0 && result.maxMovedM < 1, `maxMovedM ${result.maxMovedM} should be small but nonzero`);

  // Evenly spaced along the fitted line: consecutive x-gaps should now be equal, unlike the
  // jittered input. Tolerance is 1e-4 normalised units (~1cm in this 100m frame), not raw float
  // epsilon: bed0 sits exactly at the frame's own edge (x=0), so its true fitted-line x is a
  // sub-millimetre hair negative and gets pulled back to exactly 0 by the defensive clamp01 at
  // the frame boundary — a legitimate, farmer-imperceptible rounding of the first gap only.
  const xs = result.items.map((it) => it.x).sort((a, b) => a - b);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  for (const g of gaps.slice(1)) {
    assert.ok(Math.abs(g - gaps[0]) < 1e-4, `expected equal spacing, gaps were ${JSON.stringify(gaps)}`);
  }

  assert.equal(
    alignAndDistributeSummary(result),
    `Straightens 6 items to 0° and spaces them evenly. Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`,
  );
});

// REGRESSION, caught during development of this exact test: the row above was being rejected
// with 'would_leave_frame' even though every point stayed comfortably inside [0,1] — see the
// FRAME_EPS_M fix in lib/align-items.ts. The line-fit math (atan2/cos/sin, then reconstructing
// each point from its own projected scalar and the shared unit direction vector) legitimately
// left bed0 — which starts at exactly x=0, the frame's own left edge — a few TENTHS OF A
// MILLIMETRE into negative territory as part of ordinary "align to line" geometry, not float
// garbage. The guard's old epsilon (1e-9, sized for exact structural comparisons elsewhere in
// this file) treated that legitimate sub-millimetre nudge as a genuine escape and reverted the
// whole clean-up. This test's first assertion above (reason === 'aligned') already covers the
// fix; this comment exists so a future reader knows WHY bed0 sits at exactly x=0 in the fixture.
test('a bed starting at exactly the frame edge is not wrongly rejected as leaving the frame', () => {
  const items = rowToItems(6);
  assert.equal(items[0].x, 0, 'fixture sanity: bed0 must sit exactly on the frame edge');
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'aligned');
  assert.ok(result.items[0].x >= 0 && result.items[0].x <= 1, 'bed0 must land back inside the frame');
});

// ── already-aligned items are left alone ────────────────────────────────────────────────────────

test('alignAndDistribute: a perfectly straight, evenly spaced, identically-angled row is left untouched', () => {
  const items: AlignInputItem[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, y] = toNorm([[i * 5, 10]], FRAME)[0];
    items.push({ id: `p${i}`, x, y, rot: 0, shape: 'rect' });
  }
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'already_aligned');
  assert.equal(result.changed, false);
  assert.equal(result.movedCount, 0);
  assert.equal(result.rotatedCount, 0);
  assert.deepEqual(result.items, items.map(({ id, x, y, rot }) => ({ id, x, y, rot })));
  assert.equal(alignAndDistributeSummary(result), 'This selection is already aligned — nothing to clean up.');
});

test('alignAndDistribute: already-evenly-spaced circles (no angle to speak of) are left untouched', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0.1, y: 0.1, shape: 'circle' },
    { id: 'b', x: 0.2, y: 0.1, shape: 'circle' },
    { id: 'c', x: 0.3, y: 0.1, shape: 'circle' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'already_aligned');
  assert.equal(result.changed, false);
});

// Two rects stored at 10° and 190° are the SAME physical orientation (a rectangle's footprint is
// 180°-symmetric — see lib/align-items.ts's fold180 doc comment). This must be recognised as
// "already aligned" and the ORIGINAL stored values (10 and 190) must come back untouched, not
// silently rewritten to a single canonical representation — that would be a real, farmer-visible
// (well, diff-visible) change for zero actual benefit.
test('alignAndDistribute: two rects at 10° and 190° (same physical orientation) are recognised as already aligned, not rewritten to a canonical value', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 10, shape: 'rect' },
    { id: 'b', x: 0.3, y: 0.3, rot: 190, shape: 'rect' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'already_aligned');
  assert.equal(result.changed, false);
  assert.deepEqual(result.items, items.map(({ id, x, y, rot }) => ({ id, x, y, rot })));
});

// ── SAFETY INVARIANT: no item's centre may move farther than maxMoveM, and a breach reverts the
// WHOLE batch, not just the offending item ─────────────────────────────────────────────────────

test('SAFETY: a movement just inside maxMoveM succeeds, the same geometry just outside it reverts the WHOLE batch', () => {
  // b sits 5m off the a-c line; straightening it onto the fitted line needs exactly 10/3 m of
  // movement (verified against a very high maxMoveM override).
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
    { id: 'b', x: 0.1, y: 0.05, rot: 0, shape: 'rect' },
    { id: 'c', x: 0.2, y: 0, rot: 0, shape: 'rect' },
  ];
  const needed = alignAndDistribute(items, { frame: FRAME, maxMoveM: 1000, maxRotateDeg: 1000 }).maxMovedM;
  assert.ok(Math.abs(needed - 10 / 3) < 1e-9, `expected the needed movement to be 10/3 m, got ${needed}`);

  const under = alignAndDistribute(items, { frame: FRAME, maxMoveM: needed - 0.01 });
  const over = alignAndDistribute(items, { frame: FRAME, maxMoveM: needed + 0.01 });

  assert.equal(under.reason, 'movement_exceeded');
  assert.equal(under.changed, false);
  // WHOLE BATCH reverts — a and c, which individually would have moved 0m, come back untouched
  // too, not just b (the offending item).
  assert.deepEqual(under.items, items.map(({ id, x, y, rot }) => ({ id, x, y, rot })));

  assert.equal(over.reason, 'aligned');
  assert.equal(over.changed, true);
  assert.ok(over.maxMovedM <= needed + 0.01 + 1e-9);
});

test('alignAndDistributeSummary: an honest "would move too far" message, not a fabricated count', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
    { id: 'b', x: 0.1, y: 0.05, rot: 0, shape: 'rect' },
    { id: 'c', x: 0.2, y: 0, rot: 0, shape: 'rect' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME, maxMoveM: 1 });
  assert.equal(result.reason, 'movement_exceeded');
  assert.equal(
    alignAndDistributeSummary(result),
    'Cleaning up would move an item farther than the allowed distance, so nothing was changed.',
  );
});

// ── SAFETY INVARIANT: no rect item may rotate farther than maxRotateDeg (measured in the FOLDED
// 180° space), and a breach reverts the WHOLE batch ────────────────────────────────────────────

test('SAFETY: a rotation just inside maxRotateDeg succeeds, the same outlier just outside it reverts the WHOLE batch', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
    { id: 'b', x: 0.05, y: 0, rot: 0, shape: 'rect' },
    { id: 'c', x: 0.1, y: 0, rot: 45, shape: 'rect' }, // outlier angle
  ];
  const needed = alignAndDistribute(items, { frame: FRAME, maxMoveM: 1000, maxRotateDeg: 1000 });
  assert.ok(needed.angleDeg !== undefined);
  const neededDelta = Math.abs(45 - needed.angleDeg!); // c is the outlier; well under 90° here so unfolded delta is exact

  const under = alignAndDistribute(items, { frame: FRAME, maxRotateDeg: neededDelta - 0.5 });
  const over = alignAndDistribute(items, { frame: FRAME, maxRotateDeg: neededDelta + 0.5 });

  assert.equal(under.reason, 'rotation_exceeded');
  assert.equal(under.changed, false);
  // WHOLE BATCH reverts — a and b, whose own rotation would have needed almost no change, come
  // back with their ORIGINAL rot (0), not the group's target angle.
  assert.deepEqual(under.items, items.map(({ id, x, y, rot }) => ({ id, x, y, rot })));

  assert.equal(over.reason, 'aligned');
  assert.equal(over.changed, true);
});

test('alignAndDistributeSummary: an honest "would rotate too far" message', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
    { id: 'b', x: 0.05, y: 0, rot: 0, shape: 'rect' },
    { id: 'c', x: 0.1, y: 0, rot: 45, shape: 'rect' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME, maxRotateDeg: 10 });
  assert.equal(result.reason, 'rotation_exceeded');
  assert.equal(
    alignAndDistributeSummary(result),
    'Cleaning up would rotate an item more than the allowed amount, so nothing was changed.',
  );
});

// ── SAFETY INVARIANT: a resulting centre landing outside [0,1] reverts the WHOLE batch ─────────
// A genuine escape (NOT the sub-millimetre float residue the FRAME_EPS_M fix absorbs — see the
// regression test above): four items scattered widely enough that the fitted line's own extent,
// combined with a large maxMoveM/maxRotateDeg override (isolating this guard from the other two),
// pushes at least one projected centre measurably outside the frame.

test('SAFETY: a genuine out-of-frame result reverts the WHOLE batch untouched', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0.3, y: 0.54, rot: 0, shape: 'circle' },
    { id: 'b', x: 0.99, y: 0.67, rot: 0, shape: 'circle' },
    { id: 'c', x: 0.53, y: 0.87, rot: 0, shape: 'circle' },
    { id: 'd', x: 0.92, y: 0.07, rot: 0, shape: 'circle' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME, maxMoveM: 1000, maxRotateDeg: 1000 });
  assert.equal(result.reason, 'would_leave_frame');
  assert.equal(result.changed, false);
  assert.deepEqual(result.items, items.map(({ id, x, y, rot }) => ({ id, x, y, rot })));
  assert.equal(
    alignAndDistributeSummary(result),
    'Cleaning up would push an item off the map, so nothing was changed.',
  );
});

// ── SAFETY INVARIANT: circles are NEVER rotated, and NEVER pollute the group's average angle ───
// PRESERVE_CIRCLE_ROTATION (lib/align-items.ts's own name for this) — circles are
// rotation-invariant footprints, so this must hold even when a circle happens to carry a
// (physically meaningless) leftover `rot` value.

test('SAFETY: a circle with a leftover rot value is never rotated and never counted toward the group angle', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0.02, y: 0.02, rot: 10, shape: 'rect' },
    { id: 'b', x: 0.05, y: 0.023, rot: 15, shape: 'rect' },
    { id: 'c', x: 0.1, y: 0.022, rot: 90, shape: 'circle' }, // residual rot — must never count
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'aligned');
  // The mean is of the two RECTS only (10, 15 -> 12.5), not pulled toward the circle's stray 90°.
  assert.ok(Math.abs((result.angleDeg ?? NaN) - 12.5) < 1e-6, `expected angleDeg ~12.5, got ${result.angleDeg}`);
  const circleOut = result.items.find((it) => it.id === 'c')!;
  assert.equal(circleOut.rot, 90, "the circle's own rot must come back bit-for-bit unchanged");
  assert.equal(result.rotatedCount, 2, 'only the two rects count as rotated');
  const rectA = result.items.find((it) => it.id === 'a')!;
  const rectB = result.items.find((it) => it.id === 'b')!;
  assert.equal(rectA.rot, rectB.rot); // both rects land on the same shared angle
});

// ── 2-item special case: angle only, spacing/line-fit honestly skipped ─────────────────────────

test('alignAndDistribute: exactly 2 items only straightens the angle — spacing is honestly left as is', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 10, shape: 'rect' },
    { id: 'b', x: 0.1, y: 0.1, rot: 20, shape: 'rect' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'angle_only');
  assert.equal(result.changed, true);
  assert.equal(result.movedCount, 0); // positions never touched for a 2-item group
  assert.ok(Math.abs((result.angleDeg ?? NaN) - 15) < 1e-6);
  for (const it of result.items) assert.equal(it.rot, 15);
  assert.equal(
    alignAndDistributeSummary(result),
    'Straightens 2 items to 15° — only 2 items selected, so spacing is left as is.',
  );
});

test('alignAndDistribute: 2 circles have no angle to straighten, so angle_only degrades to already_aligned', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, shape: 'circle' },
    { id: 'b', x: 0.1, y: 0.1, shape: 'circle' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'already_aligned');
  assert.equal(result.changed, false);
});

// ── too_few_items / invalid_frame: refused gracefully, never thrown ────────────────────────────

test('too_few_items: 0 or 1 item is left alone, not thrown on', () => {
  assert.equal(alignAndDistribute([], { frame: FRAME }).reason, 'too_few_items');
  const one: AlignInputItem[] = [{ id: 'a', x: 0.1, y: 0.1, rot: 0, shape: 'rect' }];
  const result = alignAndDistribute(one, { frame: FRAME });
  assert.equal(result.reason, 'too_few_items');
  assert.deepEqual(result.items, one.map(({ id, x, y, rot }) => ({ id, x, y, rot })));
  assert.equal(alignAndDistributeSummary(result), 'Select at least 2 items to clean up.');
});

test('invalid_frame: an unusable frame (mPerPx <= 0, or imgW/imgH <= 0) is refused, not divided-by-zero into garbage', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
    { id: 'b', x: 0.1, y: 0.1, rot: 0, shape: 'rect' },
  ];
  const zeroMPerPx = alignAndDistribute(items, { frame: { imgW: 100, imgH: 100, mPerPx: 0 } });
  const negMPerPx = alignAndDistribute(items, { frame: { imgW: 100, imgH: 100, mPerPx: -1 } });
  const zeroImgW = alignAndDistribute(items, { frame: { imgW: 0, imgH: 100, mPerPx: 1 } });
  for (const r of [zeroMPerPx, negMPerPx, zeroImgW]) {
    assert.equal(r.reason, 'invalid_frame');
    assert.equal(r.changed, false);
  }
  assert.equal(alignAndDistributeSummary(zeroMPerPx), "Map scale isn't ready yet — try again in a moment.");
});

// ── tolerance is real METRES, converted via the frame's mPerPx — not a raw [0..1] number ───────
// Mirrors tests/snap-edges.test.ts's identical proof: the SAME normalised coordinates, reinterpreted
// at two different mPerPx scales, must behave differently.

test('alignAndDistribute: the exact same normalised positions behave differently depending on the frame — proves maxMoveM is metres, not normalised units', () => {
  const items = rowToItems(6); // fixed, frame-independent normalised input from here on

  // Interpreted at FRAME's scale (mPerPx=1 -> a 100m-wide frame): the row's ~15m span and small
  // jitter need well under the 2m default maxMoveM, so it aligns.
  const atFrameScale = alignAndDistribute(items, { frame: FRAME });

  // The SAME normalised numbers, reinterpreted at a much coarser scale (mPerPx=1000 -> a
  // 100,000m-wide frame): the identical normalised deltas now represent ~1000x more real metres,
  // so the same default 2m cap is blown through. If maxMoveM were applied in raw normalised units
  // instead of metres, these two calls would behave identically.
  const coarseFrame: AlignItemsFrame = { imgW: 100, imgH: 100, mPerPx: 1000 };
  const atCoarseScale = alignAndDistribute(items, { frame: coarseFrame });

  assert.equal(atFrameScale.reason, 'aligned');
  assert.equal(atCoarseScale.reason, 'movement_exceeded');
});

// ── structural invariants: never adds/removes/reorders items, never carries wM/hM/defId/label,
// never mutates its input ───────────────────────────────────────────────────────────────────────

test('SAFETY: the result has exactly the same ids, order and length as the input, whether or not anything changed', () => {
  const changedCase = rowToItems(6);
  const unchangedCase: AlignInputItem[] = [
    { id: 'x', x: 0.1, y: 0.1, rot: 0, shape: 'rect' },
    { id: 'y', x: 0.2, y: 0.1, rot: 0, shape: 'rect' },
    { id: 'z', x: 0.3, y: 0.1, rot: 0, shape: 'rect' },
  ];
  for (const items of [changedCase, unchangedCase]) {
    const result = alignAndDistribute(items, { frame: FRAME });
    assert.deepEqual(result.items.map((it) => it.id), items.map((it) => it.id));
  }
});

test('SAFETY: a returned item is exactly {id, x, y, rot} — no wM/hM/defId/label can ride along, even if the input object carried extra fields', () => {
  // AlignInputItem's own type already excludes wM/hM/defId/label (see lib/align-items.ts's doc
  // comment on why), but a caller could still hand in a wider object at the JS level — prove the
  // return value never echoes anything beyond the four documented keys.
  const items = [
    { id: 'a', x: 0.1, y: 0.1, rot: 0, shape: 'rect', wM: 3, hM: 1.5, defId: 'veg-bed', label: 'Bed 1' },
    { id: 'b', x: 0.2, y: 0.1, rot: 0, shape: 'rect', wM: 3, hM: 1.5, defId: 'veg-bed', label: 'Bed 2' },
  ] as unknown as AlignInputItem[];
  const result = alignAndDistribute(items, { frame: FRAME });
  for (const it of result.items) {
    assert.deepEqual(Object.keys(it).sort(), ['id', 'rot', 'x', 'y']);
  }
});

test('SAFETY: the input array and its items are never mutated', () => {
  const items = rowToItems(6);
  const before = JSON.stringify(items);
  alignAndDistribute(items, { frame: FRAME });
  assert.equal(JSON.stringify(items), before);
});

// ── ALIGN_ITEMS_DEFAULTS sanity ─────────────────────────────────────────────────────────────────

test('ALIGN_ITEMS_DEFAULTS matches the documented defaults (2m move, 30° rotate)', () => {
  assert.equal(ALIGN_ITEMS_DEFAULTS.maxMoveM, 2);
  assert.equal(ALIGN_ITEMS_DEFAULTS.maxRotateDeg, 30);
});

// ── alignAndDistributeSummary: rotation-only and spacing-only phrasing ─────────────────────────

test('alignAndDistributeSummary: rotation-only (nothing moved) phrases just the angle half of the sentence', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0.1, y: 0.1, rot: 5, shape: 'rect' },
    { id: 'b', x: 0.5, y: 0.1, rot: -5, shape: 'rect' },
    { id: 'c', x: 0.9, y: 0.1, rot: 5, shape: 'rect' },
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'aligned');
  assert.equal(result.movedCount, 0); // already on a straight, evenly spaced line
  assert.ok(result.rotatedCount > 0);
  assert.equal(
    alignAndDistributeSummary(result),
    `Straightens ${result.rotatedCount} items to ${Math.round(result.angleDeg!)}°. Nothing moves more than 0.0 m.`,
  );
});

test('alignAndDistributeSummary: spacing-only (nothing rotated) phrases just the "spaces them evenly" half', () => {
  const items: AlignInputItem[] = [
    { id: 'a', x: 0, y: 0.1, shape: 'circle' },
    { id: 'b', x: 0.2, y: 0.1, shape: 'circle' },
    { id: 'c', x: 0.39, y: 0.1, shape: 'circle' }, // uneven spacing, no angle to speak of
  ];
  const result = alignAndDistribute(items, { frame: FRAME });
  assert.equal(result.reason, 'aligned');
  assert.equal(result.rotatedCount, 0);
  assert.ok(result.movedCount > 0);
  assert.equal(
    alignAndDistributeSummary(result),
    `Spaces ${result.movedCount} ${result.movedCount === 1 ? 'item' : 'items'} evenly. Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`,
  );
});

// ── switch-exhaustiveness: every AlignItemsReason produces distinct, non-empty copy ────────────
// Mirrors tests/snap-edges.test.ts's identical convention: the summary function's switch has no
// default case on purpose, so adding a reason without adding copy is a compile error, not a
// silently blank message. Exercised end-to-end (real geometry) for every reason that IS reachable
// through normal use.

test('alignAndDistributeSummary: every AlignItemsReason has distinct, non-empty copy', () => {
  const aligned = alignAndDistribute(rowToItems(6), { frame: FRAME });
  const angleOnly = alignAndDistribute(
    [
      { id: 'a', x: 0, y: 0, rot: 10, shape: 'rect' },
      { id: 'b', x: 0.1, y: 0.1, rot: 20, shape: 'rect' },
    ],
    { frame: FRAME },
  );
  const alreadyAligned = alignAndDistribute(
    [
      { id: 'a', x: 0.1, y: 0.1, shape: 'circle' },
      { id: 'b', x: 0.2, y: 0.1, shape: 'circle' },
      { id: 'c', x: 0.3, y: 0.1, shape: 'circle' },
    ],
    { frame: FRAME },
  );
  const tooFewItems = alignAndDistribute([{ id: 'a', x: 0.1, y: 0.1, rot: 0, shape: 'rect' }], { frame: FRAME });
  const invalidFrame = alignAndDistribute(
    [
      { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
      { id: 'b', x: 0.1, y: 0.1, rot: 0, shape: 'rect' },
    ],
    { frame: { imgW: 100, imgH: 100, mPerPx: 0 } },
  );
  const movementExceeded = alignAndDistribute(
    [
      { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
      { id: 'b', x: 0.1, y: 0.05, rot: 0, shape: 'rect' },
      { id: 'c', x: 0.2, y: 0, rot: 0, shape: 'rect' },
    ],
    { frame: FRAME, maxMoveM: 1 },
  );
  const rotationExceeded = alignAndDistribute(
    [
      { id: 'a', x: 0, y: 0, rot: 0, shape: 'rect' },
      { id: 'b', x: 0.05, y: 0, rot: 0, shape: 'rect' },
      { id: 'c', x: 0.1, y: 0, rot: 45, shape: 'rect' },
    ],
    { frame: FRAME, maxRotateDeg: 10 },
  );
  const wouldLeaveFrame = alignAndDistribute(
    [
      { id: 'a', x: 0.3, y: 0.54, rot: 0, shape: 'circle' },
      { id: 'b', x: 0.99, y: 0.67, rot: 0, shape: 'circle' },
      { id: 'c', x: 0.53, y: 0.87, rot: 0, shape: 'circle' },
      { id: 'd', x: 0.92, y: 0.07, rot: 0, shape: 'circle' },
    ],
    { frame: FRAME, maxMoveM: 1000, maxRotateDeg: 1000 },
  );

  const results: AlignItemsResult[] = [
    aligned,
    angleOnly,
    alreadyAligned,
    tooFewItems,
    invalidFrame,
    movementExceeded,
    rotationExceeded,
    wouldLeaveFrame,
  ];
  const reasons = results.map((r) => r.reason);
  assert.deepEqual(
    reasons,
    ['aligned', 'angle_only', 'already_aligned', 'too_few_items', 'invalid_frame', 'movement_exceeded', 'rotation_exceeded', 'would_leave_frame'],
    'sanity: each fixture really does produce the reason it claims to',
  );
  const messages = results.map((r) => alignAndDistributeSummary(r));
  for (const m of messages) assert.ok(m.length > 0);
  assert.equal(new Set(messages).size, messages.length, 'expected every reason to produce distinct copy');
});
