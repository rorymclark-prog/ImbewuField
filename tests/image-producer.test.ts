import test from 'node:test';
import assert from 'node:assert/strict';

import { blendProtectedPixels } from '../lib/image-producer.ts';

function px(r: number, g: number, b: number, a: number): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

test('blendProtectedPixels keeps the model output where the mask is transparent', () => {
  const source = px(10, 20, 30, 255);
  const model = px(90, 80, 70, 255);
  const mask = px(255, 255, 255, 0);

  const out = blendProtectedPixels(source, model, mask);

  assert.deepEqual(Array.from(out), Array.from(model));
});

test('blendProtectedPixels restores the source where the mask is opaque', () => {
  const source = px(10, 20, 30, 255);
  const model = px(90, 80, 70, 255);
  const mask = px(255, 255, 255, 255);

  const out = blendProtectedPixels(source, model, mask);

  assert.deepEqual(Array.from(out), Array.from(source));
});

test('blendProtectedPixels blends partially protected edges', () => {
  const source = px(200, 100, 0, 255);
  const model = px(0, 0, 200, 255);
  const mask = px(255, 255, 255, 128);

  const out = blendProtectedPixels(source, model, mask);

  assert.deepEqual(Array.from(out), [100, 50, 100, 255]);
});
