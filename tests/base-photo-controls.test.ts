import test from 'node:test';
import assert from 'node:assert/strict';

import { basePhotoControls, clampBaseRotation, MAX_BASE_ROTATION } from '@/lib/design-canvas';
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
  assert.deepEqual(a, { tx: 0, ty: 0, rad: 0, cx: 480, cy: 320, rotationDeg: 0 });
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

// ROTATION MUST NOT RESTATE A SINGLE MEASUREMENT. This is the whole reason an angle adjuster can
// be offered where a scale handle never will be: turning an image preserves distance, so mPerPx —
// and every area, spacing and yield derived from it — is untouched. resolveBaseAlign therefore
// carries no scale term at any angle, however much of the frame's corners the rotation exposes.
test('no rotation angle introduces a scale factor', () => {
  for (const deg of [-20, -7.5, -0.5, 0, 0.5, 7.5, 20]) {
    const a = resolveBaseAlign({ dx: 0, dy: 0, rotationDeg: deg }, 960, 640);
    assert.deepEqual(Object.keys(a).sort(), ['cx', 'cy', 'rad', 'rotationDeg', 'tx', 'ty']);
    assert.equal(a.tx, 0);
    assert.equal(a.ty, 0);
  }
});
