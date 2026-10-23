import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// sdesk-08/desk-10/nav-14 (2026-10-16 visual/UX audit): same bug as components/Map.tsx (covered
// by tests/map-unsupported-fallback.test.ts) on the other two map components this track owns —
// a flat beige/black slab with zoom and legend controls drawn as if a map were there, and no
// message, icon or next step.

const atlas = readFileSync(new URL('../components/atlas/AtlasExplorer.tsx', import.meta.url), 'utf8');
const network = readFileSync(new URL('../components/network/NetworkMap.tsx', import.meta.url), 'utf8');

test('AtlasExplorer checks mapboxgl.supported() and falls back to EmptyState', () => {
  assert.match(atlas, /mapboxgl\.supported\(\)/);
  assert.match(atlas, /mapSupported \? \(/, 'the ReactMapGL must be conditional on the capability check');
  assert.match(atlas, /<EmptyState/);
  assert.match(atlas, /icon=\{MapPinOff\}/);
  // The first-run "tap anywhere" hint promises an interaction the device cannot offer.
  assert.match(atlas, /mapSupported && state\.status === 'idle'/, 'the tap-anywhere hint must not show when there is nothing to tap');
});

test('NetworkMap checks mapboxgl.supported() and falls back to EmptyState', () => {
  assert.match(network, /mapboxgl\.supported\(\)/);
  assert.match(network, /\{mapSupported \? \(/);
  assert.match(network, /<EmptyState/);
  assert.match(network, /icon=\{MapPinOff\}/);
});

test('staff-03: the legend moved off the FAB-collision corner instead of staying tuned to one FAB offset', () => {
  const legendAt = network.indexOf('Legend: says exactly what the pins encode');
  assert.ok(legendAt > 0);
  const legendBlock = network.slice(legendAt, legendAt + 1200);
  assert.match(legendBlock, /top:\s*100/, 'the legend must anchor from the top so an expanded panel grows downward, never into a bottom-left FAB band');
  assert.doesNotMatch(legendBlock, /bottom:\s*78/, 'the old bottom-anchored position (safe only while collapsed) must be gone');
});
