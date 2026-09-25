import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { defaultAppLevel } from '../lib/app-level-core.ts';

// Simple / All tools (lib/app-level.ts). Rory: "by default is on simple" for farmers, with the
// farmer always able to switch to all tools, and staff who need every tool not having to.

test('farmers and first-time visitors start on Simple; staff roles start on All tools', () => {
  assert.equal(defaultAppLevel('farmer', ''), 'simple');
  assert.equal(defaultAppLevel(null, ''), 'simple', 'someone not signed in is most likely a new farmer');
  for (const role of ['mentor', 'student', 'ngo', 'funder', 'admin'] as const) {
    assert.equal(defaultAppLevel(role, ''), 'full', `${role} needs every tool by default`);
  }
});

test('the sample tour starts on All tools unless it is previewing the farmer', () => {
  // The tour's stops walk an evaluator through charts and invoices a Simple screen may leave out.
  assert.equal(defaultAppLevel(null, 'sample'), 'full');
  assert.equal(defaultAppLevel(null, 'ngo'), 'full');
  assert.equal(defaultAppLevel(null, 'farmer'), 'simple');
});

test('the choice is kept per account and the switch lives in Settings', () => {
  const lib = readFileSync(new URL('../lib/app-level.ts', import.meta.url), 'utf8');
  assert.match(lib, /activeAccountLocalStorageKey\(APP_LEVEL_KEY\)/,
    'one person\'s choice must not carry onto another account on a shared phone');
  const settings = readFileSync(new URL('../components/ThemePanel.tsx', import.meta.url), 'utf8');
  assert.match(settings, /role="radiogroup"[\s\S]*onClick=\{\(\) => setAppLevel\(l\.key\)\}/,
    'Settings must offer the two positions as one radio group');
  // It must be findable: straight after the language picker, before anything else in the panel
  // (the tour and support links used to sit on top and pushed it below the fold on a phone).
  const language = settings.indexOf("t('pickLang')");
  const level = settings.indexOf("How much to show");
  const tour = settings.indexOf("'Tour and support'");
  const textSize = settings.indexOf("'Text size'");
  assert.ok(language > 0 && level > language && textSize > level && tour > textSize,
    'Settings order must be: language, How much to show, text size … with the tour links further down');
});
