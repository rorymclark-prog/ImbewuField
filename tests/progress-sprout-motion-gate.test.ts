import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// perf-09: components/home/ProgressSprout.tsx loaded an 870 KB Rive runtime for an 80px
// decorative sprout unconditionally (once reduced-motion/save-data allowed it at all). The SVG
// fallback already draws every growth stage, so Rive now only loads when the connection and
// device both look able to afford it. This extracts the real `update` closure from the shipped
// source (same approach as the sw.js navigate-handler test) and drives it with mocked
// preference/connection/device inputs, so the test proves the actual gating math rather than
// just matching text.

const source = readFileSync(new URL('../components/home/ProgressSprout.tsx', import.meta.url), 'utf8');

function extractUpdate(): string {
  const match = source.match(/const update = \(\) => \{([\s\S]*?)\n {4}\};/);
  assert.ok(match, 'the update() closure must be found in ProgressSprout.tsx');
  return match[1];
}

function motionAllowedFor(connection: { saveData?: boolean; effectiveType?: string } | undefined, deviceMemory: number | undefined, reducedMotion = false) {
  const body = extractUpdate();
  let riveReady: boolean | undefined;
  let motionAllowed: boolean | undefined;
  const fn = new Function(
    'preference', 'connection', 'nav', 'setRiveReady', 'setMotionAllowed',
    body,
  );
  fn(
    { matches: reducedMotion },
    connection,
    { connection, deviceMemory },
    (v: boolean) => { riveReady = v; },
    (v: boolean) => { motionAllowed = v; },
  );
  assert.equal(riveReady, false, 'the stage-change reset must always clear riveReady first');
  return motionAllowed;
}

test('Rive loads on a normal connection with no device-memory signal', () => {
  assert.equal(motionAllowedFor(undefined, undefined), true);
});

test('Rive is withheld on save-data', () => {
  assert.equal(motionAllowedFor({ saveData: true }, 8), false);
});

test('Rive is withheld on 2g and slow-2g', () => {
  assert.equal(motionAllowedFor({ effectiveType: '2g' }, 8), false);
  assert.equal(motionAllowedFor({ effectiveType: 'slow-2g' }, 8), false);
});

test('Rive is allowed on 3g/4g with no save-data', () => {
  assert.equal(motionAllowedFor({ effectiveType: '4g' }, 8), true);
});

test('Rive is withheld under 4GB of device memory, allowed at or above it', () => {
  assert.equal(motionAllowedFor(undefined, 2), false);
  assert.equal(motionAllowedFor(undefined, 3.9), false);
  assert.equal(motionAllowedFor(undefined, 4), true);
});

test('prefers-reduced-motion still wins outright, as before', () => {
  assert.equal(motionAllowedFor(undefined, 8, true), false);
});
