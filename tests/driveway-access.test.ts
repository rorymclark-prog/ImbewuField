import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveDrivewayAccess } from '../lib/sector.ts';

// Adversarial review of this function found the FROM/TO bearing convention correct by hand-trace,
// but flagged it as the one place in this change with zero regression coverage — exactly the class
// of mistake (a bearing pointing the wrong way) this codebase has shipped before with wind arrows.
// These tests exist so that mistake can't recur here silently.

test('driveway due west of the site centroid bears 270 (W)', () => {
  const site: [number, number] = [0.5, 0.5];
  const driveway: Array<[number, number]> = [[0.1, 0.48], [0.1, 0.52]]; // centroid [0.1, 0.5] — west
  const d = deriveDrivewayAccess(site, driveway);
  assert.ok(d);
  assert.ok(Math.abs(d!.bearingDeg - 270) < 0.5);
  assert.equal(d!.fromLabel, 'W');
  assert.equal(d!.provenance, 'computed');
});

test('driveway due north (smaller y = north, screen convention) bears 0 (N)', () => {
  const site: [number, number] = [0.5, 0.5];
  const driveway: Array<[number, number]> = [[0.48, 0.1], [0.52, 0.1]]; // centroid [0.5, 0.1] — north
  const d = deriveDrivewayAccess(site, driveway);
  assert.ok(d);
  assert.ok(Math.abs(d!.bearingDeg - 0) < 0.5 || Math.abs(d!.bearingDeg - 360) < 0.5);
  assert.equal(d!.fromLabel, 'N');
});

test('driveway due south-east bears ~135 (SE)', () => {
  const site: [number, number] = [0.5, 0.5];
  const driveway: Array<[number, number]> = [[0.8, 0.8], [0.82, 0.82]]; // centroid roughly SE
  const d = deriveDrivewayAccess(site, driveway);
  assert.ok(d);
  assert.ok(Math.abs(d!.bearingDeg - 135) < 1);
  assert.equal(d!.fromLabel, 'SE');
});

test('fewer than 2 driveway points → null, never a fabricated bearing', () => {
  assert.equal(deriveDrivewayAccess([0.5, 0.5], []), null);
  assert.equal(deriveDrivewayAccess([0.5, 0.5], [[0.1, 0.1]]), null);
});

test('driveway centroid coinciding with the site centroid → null, not a divide-by-zero bearing', () => {
  const site: [number, number] = [0.5, 0.5];
  const driveway: Array<[number, number]> = [[0.5, 0.5], [0.5, 0.5]];
  assert.equal(deriveDrivewayAccess(site, driveway), null);
});
