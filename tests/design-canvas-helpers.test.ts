import test from 'node:test';
import assert from 'node:assert/strict';

import { normaliseRotation } from '../lib/design-canvas.ts';

// normaliseRotation is the single source of truth for PlacedItem.rot's on-disk convention
// (rounded integer degrees, wrapped into [0,360), 0 stored as undefined) shared by the
// drag-rotate handle (DesignCanvas.tsx endDragRotate) and the Angle number field
// (DesignPalette.tsx + app/design/page.tsx onRotateSelected) — see handoff §5 "Angle field for
// linear/rectangular elements". These cases lock in that contract so the two commit paths can
// never silently drift apart on rounding/wrapping.
test('normaliseRotation: 0 stores as undefined (footprint natural orientation)', () => {
  assert.equal(normaliseRotation(0), undefined);
});

test('normaliseRotation: 360 wraps to 0, which also stores as undefined', () => {
  assert.equal(normaliseRotation(360), undefined);
});

test('normaliseRotation: 361 wraps to 1', () => {
  assert.equal(normaliseRotation(361), 1);
});

test('normaliseRotation: -5 wraps to 355', () => {
  assert.equal(normaliseRotation(-5), 355);
});

test('normaliseRotation: 359.6 rounds to 360, which wraps to 0 and stores as undefined', () => {
  assert.equal(normaliseRotation(359.6), undefined);
});

test('normaliseRotation: 45.4 rounds to 45', () => {
  assert.equal(normaliseRotation(45.4), 45);
});
