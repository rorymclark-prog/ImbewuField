import assert from 'node:assert/strict';
import test from 'node:test';

import { lockedPolishAction, lockedPolishStyle, type LockedPolishState } from '@/lib/locked-polish-flow';

const READY: LockedPolishState = {
  exactFlipPending: false,
  polishAfterExactPending: false,
  aiFlipPending: false,
  mode: 'ai',
  isExactRender: false,
  loading: false,
  hasResult: false,
};

test('one-button polish advances exact render -> AI switch -> AI render', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    exactFlipPending: true,
    polishAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'render-exact');

  assert.equal(lockedPolishAction({
    ...READY,
    polishAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'switch-to-ai');

  assert.equal(lockedPolishAction({
    ...READY,
    aiFlipPending: true,
  }), 'render-ai');
});

test('the paid stage waits for the exact result and settled AI mode', () => {
  assert.equal(lockedPolishAction({
    ...READY,
    polishAfterExactPending: true,
    mode: 'exact',
    isExactRender: true,
  }), 'wait');

  assert.equal(lockedPolishAction({
    ...READY,
    aiFlipPending: true,
    mode: 'exact',
    isExactRender: true,
    hasResult: true,
  }), 'wait');

  assert.equal(lockedPolishAction({
    ...READY,
    aiFlipPending: true,
    loading: true,
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
