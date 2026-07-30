import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calibratedMPerPx,
  canvasToPhoto,
  carriedMPerPx,
  coverScale,
  photoToCanvas,
  type PhotoTransform,
} from '../lib/base-photo-align.ts';

// The failure this module exists to prevent: a farmer taps two corners of a wall they have
// measured, then zooms or pans the photo, and the app ships a metres-per-pixel computed from a
// distance that no longer corresponds to that wall. So the assertions here are not about the
// algebra — they are about what survives the farmer doing things in any order.

const BASE: PhotoTransform = {
  naturalW: 4000,
  naturalH: 3000,
  frameW: 960,
  frameH: 640,
  rotationDeg: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
};

test('projecting and unprojecting is the identity, at every zoom, pan and rotation', () => {
  for (const rotationDeg of [0, 17, 90, 233]) {
    for (const zoom of [0.5, 1, 1.7, 3]) {
      const t = { ...BASE, rotationDeg, zoom, panX: -80, panY: 45 };
      for (const p of [{ ix: 0, iy: 0 }, { ix: 2000, iy: 1500 }, { ix: 3999, iy: 12 }]) {
        const back = canvasToPhoto(t, photoToCanvas(t, p));
        assert.ok(Math.abs(back.ix - p.ix) < 1e-9 && Math.abs(back.iy - p.iy) < 1e-9,
          `rot ${rotationDeg} zoom ${zoom} point ${p.ix},${p.iy} → ${back.ix},${back.iy}`);
      }
    }
  }
});

test('a photo-anchored point stays on its feature when the photo moves; a canvas point does not', () => {
  // The regression itself, as a test. The farmer taps a building corner, then zooms 2x.
  const before = { ...BASE };
  const after = { ...BASE, zoom: 2, panX: -120, panY: 60 };
  const corner = { ix: 2400, iy: 900 }; // the building corner, in the photo's own pixels
  const tapped = photoToCanvas(before, corner); // where the finger touched the glass
  // Photo-anchored: reprojecting the IMAGE point lands wherever the corner is NOW.
  const ridden = photoToCanvas(after, corner);
  // Canvas-anchored (the old behaviour): the tap stays put while the corner moves away.
  const drift = Math.hypot(ridden.x - tapped.x, ridden.y - tapped.y);
  // ~87px for this geometry — on a 960px canvas that is a calibration point sitting nowhere
  // near the wall it claims to measure.
  assert.ok(drift > 50, `the corner moved ${drift}px across the canvas — a canvas-anchored point would now be off by that much`);
  // And the photo-anchored point still identifies the same image pixel.
  const back = canvasToPhoto(after, ridden);
  assert.ok(Math.abs(back.ix - corner.ix) < 1e-9 && Math.abs(back.iy - corner.iy) < 1e-9);
});

test('THE INVARIANT: mPerPx times a feature\'s baked pixel span is constant under any adjustment', () => {
  // A 12 m wall between two photo points. However the farmer zooms/pans/rotates before baking,
  // (metres per canvas px) × (canvas px the wall spans) must equal 12 m — i.e. the baked image
  // and the number shipped with it always agree. This is the property whose absence shrank a
  // real farm design.
  const a = { ix: 1000, iy: 1200 };
  const b = { ix: 1600, iy: 1200 };
  for (const rotationDeg of [0, 33, 90, 178]) {
    for (const zoom of [0.6, 1, 1.9, 3.4]) {
      for (const [panX, panY] of [[0, 0], [-200, 130]]) {
        const t = { ...BASE, rotationDeg, zoom, panX, panY };
        const m = calibratedMPerPx(t, a, b, 12);
        assert.ok(m != null, `no scale at rot ${rotationDeg} zoom ${zoom}`);
        const ca = photoToCanvas(t, a);
        const cb = photoToCanvas(t, b);
        const span = Math.hypot(ca.x - cb.x, ca.y - cb.y);
        assert.ok(Math.abs(m! * span - 12) < 1e-9, `rot ${rotationDeg} zoom ${zoom}: ${m! * span}`);
      }
    }
  }
});

test('tap at one zoom, bake at another — the shipped scale describes the BAKE, not the tap', () => {
  const tapTime = { ...BASE, zoom: 1 };
  const bakeTime = { ...BASE, zoom: 2 };
  const a = { ix: 1000, iy: 1200 };
  const b = { ix: 1600, iy: 1200 };
  const mAtTap = calibratedMPerPx(tapTime, a, b, 12)!;
  const mAtBake = calibratedMPerPx(bakeTime, a, b, 12)!;
  // Zooming in 2x makes every feature span twice the pixels, so each pixel is worth HALF the
  // metres. The old code would have shipped mAtTap with the zoomed bake — off by exactly 2x,
  // which is a farm plan at half or double size.
  assert.ok(Math.abs(mAtBake - mAtTap / 2) < 1e-12);
});

test('carrying an existing scale through a reopen is lossless when nothing is touched', () => {
  // "Adjust photo" reopens on the PREVIOUS bake: natural size equals the frame, so cover fit is
  // exactly 1 and the stored number must come back out untouched. This is what makes opening
  // and immediately re-applying a no-op instead of a fresh corruption.
  const reopened: PhotoTransform = { ...BASE, naturalW: 960, naturalH: 640 };
  assert.equal(coverScale(reopened), 1);
  assert.equal(carriedMPerPx(0.0421, reopened), 0.0421);
});

test('carrying an existing scale through a zoomed re-bake compensates by exactly the zoom', () => {
  const reopened: PhotoTransform = { ...BASE, naturalW: 960, naturalH: 640, zoom: 2 };
  const carried = carriedMPerPx(0.05, reopened);
  assert.ok(Math.abs(carried! - 0.025) < 1e-12);
  // Pan alone changes the crop, never the scale.
  const panned: PhotoTransform = { ...BASE, naturalW: 960, naturalH: 640, panX: -300, panY: 200 };
  assert.equal(carriedMPerPx(0.05, panned), 0.05);
});

test('degenerate inputs yield null, never NaN or a zero scale', () => {
  const t = { ...BASE };
  const a = { ix: 1000, iy: 1000 };
  assert.equal(calibratedMPerPx(t, a, a, 12), null, 'coincident points are a double-tap, not a measurement');
  assert.equal(calibratedMPerPx(t, a, { ix: 1600, iy: 1000 }, 0), null);
  assert.equal(calibratedMPerPx(t, a, { ix: 1600, iy: 1000 }, Number.NaN), null);
  assert.equal(carriedMPerPx(Number.NaN, t), null);
  assert.equal(carriedMPerPx(0, t), null);
  assert.equal(carriedMPerPx(-1, t), null);
});
