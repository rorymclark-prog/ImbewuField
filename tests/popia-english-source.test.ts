import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../components/PopiaConsent.tsx', import.meta.url), 'utf8');

// Xitsonga now has source-bound corrections and a missing-goal prompt in this unreviewed flow.
// The former exclusion assertion pinned the old language list; every target needs source backing.
// isiXhosa (an unreviewed machine draft on this branch) is paired with the English source too.
test('first-run consent pairs every target draft with English source and separates the source language', () => {
  assert.match(source, /ENGLISH_SOURCE_LANGS = new Set\(\['zu', 'xh', 'st', 'ts', 've'\]\)/);
  assert.match(source, /translate\('en', key\)/);
  assert.match(source, /<small lang="en"/);
  assert.match(source, /t\('popiaEnglishSourceLabel'\)/);
  assert.match(source, /t\('popiaConsentDraftNotice'\)/);
  assert.match(source, /const copyString = \(key: string\) => t\(key\)/, 'switch names use the native label while tagged source text stays in the reading flow');
});

test('consent storage stays required, sharing stays opt-in, and a goal is required to finish', () => {
  assert.match(source, /useState\(true\);\s*\/\/ required — cannot proceed without/);
  assert.match(source, /useState\(false\);\s*\/\/ optional — privacy-preserving default: off/);
  assert.match(source, /onClick=\{\(\) => storeData && setStep\(2\)\}/);
  assert.match(source, /if \(!goal\) return;/);
  assert.match(source, /disabled=\{!goal\}/);
});
