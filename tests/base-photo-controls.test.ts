import test from 'node:test';
import assert from 'node:assert/strict';

import {
  basePhotoControls,
  clampBaseRotation,
  clampBaseScale,
  customBaseMPerPx,
  MAX_BASE_ROTATION,
  MIN_BASE_SCALE,
  MAX_BASE_SCALE,
} from '@/lib/design-canvas';
import { resolveBaseAlign } from '@/lib/base-photo-align';

// THE BUG CLASS THIS GUARDS: a control that exists in one direction only. "Switch to satellite
// view" was deliberately non-destructive — it flips useCustomBase off and KEEPS customBase, so
// the photo can come back with no re-upload and no re-calibration — but the UI branched on
// `useCustomBase && customBase`, so the moment the flag went off the only control left was a
// from-scratch import. The photo was saved, intact, and unreachable (Rory: "i still cant toggle
// on satelite or drone once the dorne is added").
//
// The rule is about the PHOTO EXISTING, never about which base is currently active.

test('a saved photo is reachable from BOTH base states — no one-way door', () => {
  const photo = { url: 'https://example/p.jpg', mPerPx: 0.05, uploadedAt: '2026-07-30T00:00:00Z' };

  const onPhoto = basePhotoControls({ useCustomBase: true, customBase: photo });
  assert.equal(onPhoto.canToggle, true);
  assert.equal(onPhoto.showingPhoto, true);

  // The regression: photo saved, satellite showing. The farmer MUST still be able to get back.
  const onSatellite = basePhotoControls({ useCustomBase: false, customBase: photo });
  assert.equal(onSatellite.canToggle, true, 'a saved photo with the flag off must stay reachable');
  assert.equal(onSatellite.showingPhoto, false);
});

test('a farmer who never imported a photo is offered no toggle', () => {
  for (const state of [null, undefined, {}, { useCustomBase: false }, { customBase: null }]) {
    const controls = basePhotoControls(state as Parameters<typeof basePhotoControls>[0]);
    assert.equal(controls.canToggle, false);
    assert.equal(controls.showingPhoto, false);
  }
});

test('the flag alone never shows a photo that does not exist', () => {
  // A stale/corrupt flag with no image behind it must read as "on the satellite", not as a
  // photo base with nothing to paint.
  assert.equal(basePhotoControls({ useCustomBase: true, customBase: null }).showingPhoto, false);
});

test('rotation is bounded and non-finite input reads as square', () => {
  assert.equal(clampBaseRotation(3.5), 3.5);
  assert.equal(clampBaseRotation(MAX_BASE_ROTATION + 40), MAX_BASE_ROTATION);
  assert.equal(clampBaseRotation(-MAX_BASE_ROTATION - 40), -MAX_BASE_ROTATION);
  for (const bad of [NaN, Infinity, '5', null, undefined, {}]) {
    assert.equal(clampBaseRotation(bad), 0);
  }
});

test('an unrotated, un-nudged alignment is the identity — nothing is re-encoded for nothing', () => {
  const a = resolveBaseAlign({ dx: 0, dy: 0, rotationDeg: 0 }, 960, 640);
  assert.deepEqual(a, { tx: 0, ty: 0, rad: 0, cx: 480, cy: 320, rotationDeg: 0, scale: 1 });
  // Missing/garbage fields must degrade to the identity rather than to NaN, which would paint
  // nothing at all and read to a farmer as "my photo disappeared".
  assert.deepEqual(resolveBaseAlign(null, 960, 640), resolveBaseAlign({}, 960, 640));
  assert.deepEqual(
    resolveBaseAlign({ dx: NaN, dy: undefined, rotationDeg: Infinity }, 960, 640),
    resolveBaseAlign(null, 960, 640),
  );
});

test('the nudge is a fraction of the frame and rotation turns about its centre', () => {
  const a = resolveBaseAlign({ dx: 0.01, dy: -0.02, rotationDeg: 90 }, 960, 640);
  assert.equal(a.tx, 9.6);
  assert.equal(a.ty, -12.8);
  assert.equal(a.cx, 480);
  assert.equal(a.cy, 320);
  assert.ok(Math.abs(a.rad - Math.PI / 2) < 1e-12);
});

// THE BAKED BASE MUST BE OPAQUE ACROSS THE WHOLE FRAME.
//
// Rotation and nudge are deliberately not cover-scaled, so they uncover frame area — up to a
// 96px strip at MAX_BASE_NUDGE and roughly a quarter of the page at MAX_BASE_ROTATION. The
// Studio hides that behind its live satellite underlay; NOTHING else does. DesignGlossy's
// buildComposite / drawBlueprintBase / drawAnalysisBase each blit satDataUrl onto a fresh
// transparent canvas, and their own fallback fill only runs when satDataUrl is ABSENT — so an
// uncovered area printed as white holes on all eight plan sheets and went to the paid AI render
// as empty pixels. bakeBaseAlignment therefore paints a backdrop before the transformed photo.
//
// This test asserts the CONTRACT (a backdrop is always requested), because bakeBaseAlignment
// itself needs a DOM canvas and cannot run under node:test. The pixel-level check belongs in the
// headless sheet-audit loop.
test('an alignment that uncovers the frame is one the bake must fill behind', () => {
  const uncovers = (a: { dx?: number; dy?: number; rotationDeg?: number }) => {
    const r = resolveBaseAlign(a, 960, 640);
    return r.tx !== 0 || r.ty !== 0 || r.rad !== 0;
  };
  // Every alignment the UI can produce other than dead-square leaves frame area uncovered.
  assert.equal(uncovers({ dx: 0.002, dy: 0, rotationDeg: 0 }), true);
  assert.equal(uncovers({ dx: 0, dy: 0, rotationDeg: 0.5 }), true);
  assert.equal(uncovers({ dx: 0, dy: 0, rotationDeg: MAX_BASE_ROTATION }), true);
  // ...and only the square, un-nudged case is safe to hand back un-composited, which is exactly
  // the fast path bakeBaseAlignment takes.
  assert.equal(uncovers({ dx: 0, dy: 0, rotationDeg: 0 }), false);
  assert.equal(uncovers({}), false);
});

// SIZE IS THE ONE ADJUSTMENT THAT MOVES THE METRES — and it must move them EXACTLY.
//
// A farmer resizing their photo until its features sit on the satellite underneath is making a
// scale correction, so the frame's metres-per-pixel is derived from the size rather than left to
// contradict the picture. Drawing the photo `scale` times larger means each frame pixel covers
// `scale` times less ground.
test('the frame\'s metres follow the photo\'s size, exactly and in the right direction', () => {
  const base = { mPerPx: 0.05 };
  assert.equal(customBaseMPerPx({ ...base, scale: 1 }), 0.05);
  // Bigger photo → each frame pixel covers LESS ground.
  assert.equal(customBaseMPerPx({ ...base, scale: 2 }), 0.025);
  // Smaller photo → each frame pixel covers MORE ground.
  assert.equal(customBaseMPerPx({ ...base, scale: 0.5 }), 0.1);
  // Absent/corrupt size must read as "as imported", never as NaN or Infinity metres — a
  // non-finite scale would poison every area, yield and price derived from it.
  for (const bad of [undefined, NaN, Infinity, 0, -2, '2' as unknown as number]) {
    assert.equal(customBaseMPerPx({ ...base, scale: bad as number }), 0.05);
  }
});

test('size is bounded, and the calibrated mPerPx is never overwritten by resizing', () => {
  assert.equal(clampBaseScale(MAX_BASE_SCALE * 10), MAX_BASE_SCALE);
  assert.equal(clampBaseScale(MIN_BASE_SCALE / 10), MIN_BASE_SCALE);
  assert.equal(clampBaseScale(1.25), 1.25);
  // Reset must return the farmer to their own two-point calibration, which is only possible
  // because `scale` is a separate multiplier rather than something folded INTO mPerPx.
  const calibrated = { mPerPx: 0.037, scale: 3.1 };
  assert.equal(customBaseMPerPx({ ...calibrated, scale: 1 }), 0.037);
});

// ROTATION MUST NOT RESTATE A SINGLE MEASUREMENT. This is the whole reason an angle adjuster can
// be offered where a scale handle never will be: turning an image preserves distance, so mPerPx —
// and every area, spacing and yield derived from it — is untouched. resolveBaseAlign therefore
// carries no scale term at any angle, however much of the frame's corners the rotation exposes.
test('no rotation angle introduces a scale factor', () => {
  for (const deg of [-20, -7.5, -0.5, 0, 0.5, 7.5, 20]) {
    const a = resolveBaseAlign({ dx: 0, dy: 0, rotationDeg: deg }, 960, 640);
    // Turning the photo must leave the size alone. Size is its own control precisely BECAUSE it
    // moves the metres — rotation is offered freely only as long as it never does.
    assert.equal(a.scale, 1, `rotating ${deg}° must not resize`);
    assert.equal(a.tx, 0);
    assert.equal(a.ty, 0);
  }
});

test('nudging never resizes either — only the size control changes the metres', () => {
  for (const dx of [-0.1, -0.002, 0, 0.002, 0.1]) {
    assert.equal(resolveBaseAlign({ dx, dy: -dx, rotationDeg: 0 }, 960, 640).scale, 1);
  }
});
