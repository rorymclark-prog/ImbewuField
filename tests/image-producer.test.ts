import test from 'node:test';
import assert from 'node:assert/strict';

import { blendProtectedPixels, countProtectedPixelMismatches, shouldUseModelChrome } from '../lib/image-producer.ts';
import { buildProducerPrompt, buildProducerPromptLegacy, buildShowcasePrompt, buildShowcasePromptLegacy, STYLE_LINES } from '../lib/producer-prompt.ts';
import { isDifferentBuild } from '../lib/pwa-update.ts';

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

test('geometry lock verifies every fully protected pixel byte-for-byte', () => {
  const source = new Uint8ClampedArray([
    10, 20, 30, 255,
    40, 50, 60, 255,
    70, 80, 90, 255,
  ]);
  const model = new Uint8ClampedArray([
    200, 201, 202, 255,
    203, 204, 205, 255,
    206, 207, 208, 255,
  ]);
  const mask = new Uint8ClampedArray([
    255, 255, 255, 255,
    255, 255, 255, 0,
    255, 255, 255, 255,
  ]);

  const restored = blendProtectedPixels(source, model, mask);

  assert.equal(countProtectedPixelMismatches(source, restored, mask), 0);
  restored[8] += 1;
  assert.equal(countProtectedPixelMismatches(source, restored, mask), 1);
});

test('geometry lock always overrides free-form model chrome', () => {
  assert.equal(shouldUseModelChrome(true, true), false);
  assert.equal(shouldUseModelChrome(false, true), false);
  assert.equal(shouldUseModelChrome(true, false), true);
  assert.equal(shouldUseModelChrome(false, false), false);
});

test('update notifier detects a newly deployed build without false first-load prompts', () => {
  assert.equal(isDifferentBuild('5b9982b', '7abc123'), true);
  assert.equal(isDifferentBuild('5b9982b', '5b9982b'), false);
  assert.equal(isDifferentBuild(null, '7abc123'), false);
  assert.equal(isDifferentBuild('5b9982b', null), false);
});

test('buildProducerPrompt keeps the style anchor first and the geometry lock last', () => {
  const prompt = buildProducerPrompt(
    'Zones',
    'extension_blueprint',
    'green rectangles are vegetable beds',
    'full',
    false,
    'Site brief text',
  );

  assert.ok(prompt.startsWith(STYLE_LINES.extension_blueprint));
  assert.ok(prompt.includes('TASK: edit this satellite photo of a real South African smallholding'));
  assert.ok(prompt.includes('HOUSE RULE: keep the house whole and fully visible'));
  assert.ok(prompt.includes('FINAL RULE: the source composite geometry is final.'));
  assert.ok(prompt.includes('flat orthographic top-down plan only'));
  assert.ok(prompt.includes('produce edge-to-edge map artwork at exactly the source crop'));
  assert.ok(prompt.includes('Do not add a title block, legend panel, paper border'));
  assert.ok(prompt.includes('Do not copy any emoji, map pin, tool icon, badge'));
  assert.ok(!prompt.includes('clean right-hand title/legend panel'));
});

test('buildShowcasePrompt includes the title, labels and panel instructions', () => {
  const prompt = buildShowcasePrompt(
    'Zones',
    'extension_blueprint',
    'Zone 1, Zone 2',
    'Carl and Sandys Place',
    'zones',
  );

  assert.ok(prompt.includes('title block reading'));
  assert.ok(prompt.includes('LABELS AND PANELS:'));
  assert.ok(prompt.includes('Do not copy any emoji, map pin, tool icon, badge'));
  assert.ok(prompt.includes('small north arrow'));
  assert.ok(prompt.includes('FINAL RULE: the source composite geometry is final.'));
});

test('legacy prompt remains available for rollback and A/B comparison', () => {
  const legacyProducer = buildProducerPromptLegacy(
    'Zones',
    'extension_blueprint',
    'green rectangles are vegetable beds',
    'full',
    false,
    'Site brief text',
  );
  const legacyShowcase = buildShowcasePromptLegacy(
    'Zones',
    'extension_blueprint',
    'Zone 1, Zone 2',
    'Carl and Sandys Place',
    'Site brief text',
  );

  assert.ok(legacyProducer.includes('ABSOLUTELY NO WRITING'));
  assert.ok(legacyProducer.includes('PAINT THE WHOLE PLOT'));
  assert.ok(legacyShowcase.includes('EXACT GEOMETRY, NON-NEGOTIABLE'));
  assert.ok(legacyShowcase.includes('CARTOGRAPHY — THIS SHEET MUST INCLUDE'));
});

test('chatgpt atlas style is wired through the prompt builder', () => {
  const prompt = buildProducerPrompt(
    'Water',
    'chatgpt_atlas',
    'blue area is a pond',
    'full',
    false,
    'Site brief text',
  );

  assert.ok(prompt.includes('STYLE — ChatGPT Atlas'));
  assert.ok(prompt.includes('premium printed design sheet'));
  assert.ok(prompt.includes('NO INVENT:'));
});
