import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fullTreatmentProtectPolicy,
  lockedPolishAction,
  lockedPolishStyle,
  type LockedPolishState,
} from '@/lib/locked-polish-flow';

const READY: LockedPolishState = {
  outputMode: 'hybrid',
  exactFlipPending: false,
  hybridAfterExactPending: false,
  hybridFlipPending: false,
  polishAfterHybridPending: false,
  polishFlipPending: false,
  mode: 'ai',
  isExactRender: false,
  loading: false,
  hasResult: false,
};

test('Hybrid mode advances exact render -> switch to hybrid -> hybrid render, then stops', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    exactFlipPending: true,
    hybridAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'render-exact');

  assert.equal(lockedPolishAction({
    ...READY,
    hybridAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'switch-to-hybrid');

  assert.equal(lockedPolishAction({
    ...READY,
    hybridFlipPending: true,
  }), 'render-hybrid');

  // No polishAfterHybridPending set — Hybrid mode has nowhere further to go once rendered.
  assert.equal(lockedPolishAction({
    ...READY,
    hasResult: true,
  }), 'wait');
});

test('Full Treatment continues past Hybrid into a second, polish stage', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    exactFlipPending: true,
    hybridAfterExactPending: true,
    polishAfterHybridPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'render-exact');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    hybridAfterExactPending: true,
    polishAfterHybridPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'switch-to-hybrid');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    hybridFlipPending: true,
    polishAfterHybridPending: true,
  }), 'render-hybrid');

  // Hybrid has finished (hasResult) and polishAfterHybridPending is still set — Full Treatment
  // advances again instead of stopping, unlike the Hybrid-only case above.
  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishAfterHybridPending: true,
    hasResult: true,
  }), 'switch-to-polish');

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishFlipPending: true,
  }), 'render-polish');
});

test('every stage waits for a settled, non-loading state before firing', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    hybridAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'wait'); // no hasResult yet

  assert.equal(lockedPolishAction({
    ...READY,
    hybridFlipPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'wait'); // still in exact mode, not flipped to ai yet

  assert.equal(lockedPolishAction({
    ...READY,
    hybridFlipPending: true,
    loading: true,
  }), 'wait'); // a render is already in flight

  assert.equal(lockedPolishAction({
    ...READY,
    outputMode: 'full',
    polishAfterHybridPending: true,
    mode: 'exact', // Full Treatment's polish stage also runs in 'ai' mode, not 'exact'
    isExactRender: true,
    hasResult: true,
  }), 'wait');
});

test('the exact master step cannot replace the chosen AI style', () => {
  assert.equal(
    lockedPolishStyle('homestead_storybook', 'precision_atlas'),
    'homestead_storybook',
  );
  assert.equal(
    lockedPolishStyle(null, 'precision_atlas'),
    'precision_atlas',
  );
});

test('the guided flow preserves every explicitly selected visual style', () => {
  assert.equal(
    lockedPolishStyle('satellite_overlay', 'precision_atlas'),
    'satellite_overlay',
  );
  assert.equal(
    lockedPolishStyle('master_atlas', 'precision_atlas'),
    'master_atlas',
  );
});

test('Full Treatment restores factual geometry without erasing the second paid polish', () => {
  const policy = fullTreatmentProtectPolicy();

  assert.equal(policy.protectOutside, true);
  assert.equal(policy.protectBoundary, true);
  assert.equal(policy.protectDriveway, true);

  // These regions must remain editable during pass two or the completed Hybrid is simply copied
  // back over nearly the entire paid result.
  assert.equal(policy.protectLines, false);
  assert.equal(policy.protectItems, false);
  assert.equal(policy.protectUnmarkedGround, false);
});
