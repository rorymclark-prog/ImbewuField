import test from 'node:test';
import assert from 'node:assert/strict';

import { blendProtectedPixels, countProtectedPixelMismatches, precisionAtlasContextPixels, shouldUseModelChrome } from '../lib/image-producer.ts';
import { buildLockedBackgroundPrompt, buildProducerPrompt, buildProducerPromptLegacy, buildShowcasePrompt, buildShowcasePromptLegacy, STYLE_LINES } from '../lib/producer-prompt.ts';
import { isDifferentBuild } from '../lib/pwa-update.ts';
import { preserveCanvasNavigation, type DesignCanvasState } from '../lib/design-canvas.ts';

function px(r: number, g: number, b: number, a: number): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

function canvasState(step: DesignCanvasState['step'], rev: number): DesignCanvasState {
  return {
    siteId: 'site-1',
    frame: { centerLng: 30, centerLat: -29, zoom: 18, imgW: 960, imgH: 640, mPerPx: 0.4 },
    step,
    items: [],
    zones: [],
    lines: [],
    rev,
    updatedAt: '2026-07-19T00:00:00.000Z',
  };
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

test('remote design content cannot force the open tab back to a stale wizard step', () => {
  const local = canvasState('water', 2);
  const remote = { ...canvasState('planting', 5), items: [{ id: 'tank', defId: 'jojo_5000l', x: 0.4, y: 0.3 }] };

  const merged = preserveCanvasNavigation(remote, local);

  assert.equal(merged.step, 'water');
  assert.equal(merged.rev, 5);
  assert.equal(merged.items.length, 1);
  assert.equal(remote.step, 'planting');
});

test('Precision Atlas context treatment lightens and calms satellite pixels without moving data', () => {
  const source = px(20, 80, 30, 255);
  const treated = precisionAtlasContextPixels(source);
  const sourceMean = (source[0] + source[1] + source[2]) / 3;
  const treatedMean = (treated[0] + treated[1] + treated[2]) / 3;
  const sourceChroma = Math.max(source[0], source[1], source[2]) - Math.min(source[0], source[1], source[2]);
  const treatedChroma = Math.max(treated[0], treated[1], treated[2]) - Math.min(treated[0], treated[1], treated[2]);

  assert.equal(treated.length, source.length);
  assert.equal(treated[3], source[3]);
  assert.ok(treatedMean > sourceMean);
  assert.ok(treatedChroma < sourceChroma);
  assert.deepEqual(Array.from(source), [20, 80, 30, 255]);
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

test('locked Water prompt delegates features and map furniture to deterministic drawing', () => {
  const prompt = buildLockedBackgroundPrompt('Water', 'precision_atlas');

  assert.ok(prompt.startsWith(STYLE_LINES.precision_atlas));
  assert.ok(prompt.includes('premium WATER map-art background'));
  assert.ok(prompt.includes('visibly repaint every editable lawn, veld and soil pixel'));
  assert.ok(prompt.includes('not a faint tint, filter or lightly softened satellite photo'));
  assert.ok(prompt.includes('Leave no raw, dark or photographic satellite texture'));
  assert.ok(prompt.includes('restores clean source geometry'));
  assert.ok(prompt.includes('redraws the exact traced structures'));
  assert.ok(prompt.includes('design infrastructure deterministically after this artwork pass'));
  assert.ok(prompt.includes('flat orthographic top-down'));
  assert.ok(prompt.includes('add no objects or infrastructure'));
  assert.ok(prompt.includes('map-tool symbols, emoji, pins'));
  assert.ok(prompt.includes('protected geometry is unchanged'));
  assert.ok(!prompt.includes('JoJo'));
  assert.ok(!prompt.includes('Tap Point'));
  assert.ok(!prompt.includes('Small Pond'));
  assert.ok(STYLE_LINES.precision_atlas.includes('never a dark satellite filter'));
  assert.ok(STYLE_LINES.precision_atlas.includes('never oblique or isometric'));
  assert.ok(!STYLE_LINES.extension_blueprint.includes('slight isometric'));
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
