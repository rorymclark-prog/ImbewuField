import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveElevationData } from '../lib/elevation.ts';
import { deriveSectorModel } from '../lib/sector.ts';

test('derives site-local downhill direction from a five-point central difference', () => {
  const elevation = deriveElevationData({
    center: 328,
    north: 333,
    south: 321,
    east: 328,
    west: 325,
  });

  assert.equal(elevation.elevation, 328);
  assert.ok(elevation.aspectDeg >= 180 && elevation.aspectDeg <= 210);
  assert.ok(elevation.slopePct >= 9 && elevation.slopePct <= 11);
  assert.equal(elevation.sampleBaselineM, 120);
  assert.equal(elevation.directionConfidence, 'site-local-indicative');
});

test('does not turn DEM noise into a downhill arrow', () => {
  const elevation = deriveElevationData({
    center: 100,
    north: 100,
    south: 100,
    east: 100,
    west: 100,
  });

  assert.equal(elevation.directionConfidence, 'unconfirmed');
  const sector = deriveSectorModel({ elevation }, -27.7, 31.9);
  assert.equal(sector.water, null);
  assert.match(sector.dataNotes.join(' '), /too small to confirm a downhill direction/i);
});
