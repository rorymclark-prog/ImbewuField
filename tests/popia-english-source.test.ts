import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/PopiaConsent.tsx', import.meta.url), 'utf8');

test('first-run consent pairs supported draft languages with English and leaves Xitsonga out', () => {
  assert.match(source, /ENGLISH_SOURCE_LANGS = new Set\(\['zu', 'st', 've'\]\)/);
  assert.match(source, /translate\('en', key\)/);
  assert.match(source, /English source:/);
  assert.match(source, /Translation status: unreviewed/);
  assert.doesNotMatch(source, /ENGLISH_SOURCE_LANGS[^\n]*\bts\b/);
});

test('consent storage stays required, sharing stays opt-in, and a goal is required to finish', () => {
  assert.match(source, /useState\(true\);\s*\/\/ required — cannot proceed without/);
  assert.match(source, /useState\(false\);\s*\/\/ optional — privacy-preserving default: off/);
  assert.match(source, /onClick=\{\(\) => storeData && setStep\(2\)\}/);
  assert.match(source, /if \(!goal\) return;/);
  assert.match(source, /disabled=\{!goal\}/);
});
