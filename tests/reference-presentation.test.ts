import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBoundaryPresentationCrop } from '@/lib/reference-presentation';

test('compact properties fill the finished sheet instead of staying at the old 24% floor', () => {
  const crop = calculateBoundaryPresentationCrop([
    [0.45, 0.46],
    [0.55, 0.46],
    [0.55, 0.54],
    [0.45, 0.54],
  ]);

  assert.ok(crop);
  assert.ok(crop.cropFraction < 0.24);
  assert.ok(crop.cropFraction >= 0.08);
});

test('presentation crop stays inside the source image near an edge', () => {
  const crop = calculateBoundaryPresentationCrop([
    [0.01, 0.01],
    [0.13, 0.01],
    [0.13, 0.12],
    [0.01, 0.12],
  ]);

  assert.ok(crop);
  assert.equal(crop.cropX, 0);
  assert.equal(crop.cropY, 0);
  assert.ok(crop.cropX + crop.cropFraction <= 1);
  assert.ok(crop.cropY + crop.cropFraction <= 1);
});

test('large properties retain the original frame', () => {
  assert.equal(calculateBoundaryPresentationCrop([
    [0.05, 0.05],
    [0.90, 0.05],
    [0.90, 0.90],
    [0.05, 0.90],
  ]), null);
});
