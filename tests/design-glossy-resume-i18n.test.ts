import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// swarm/w5-design-i18n: two narrow gaps left after the Design Studio i18n/print-preview audit
// (tests/design-simple-mode.test.ts already covers the rest of that audit).
//
//  1. DesignGlossy's crash-loop "resume gave up" banner (components/design/DesignGlossy.tsx)
//     read t('designGlossyResumeGaveUp'), but that key existed only in lib/i18n-pending.ts — so
//     an isiZulu farmer silently got the English fallback with no isiZulu at all. Same paired
//     "isiZulu draft \n\n English source" convention lib/locales/zu.ts already uses for
//     designStorageFull, right beside it.
//  2. DesignPrint's live-preview effect already turned a render failure into a real error state
//     with a retry button (tests/design-simple-mode.test.ts), but never told anyone WHY it
//     failed — the catch block had no console logging at all.

const ZU = readFileSync(new URL('../lib/locales/zu.ts', import.meta.url), 'utf8');
const PENDING = readFileSync(new URL('../lib/i18n-pending.ts', import.meta.url), 'utf8');
const PRINT = readFileSync(new URL('../components/design/DesignPrint.tsx', import.meta.url), 'utf8');

test('designGlossyResumeGaveUp has an isiZulu draft that keeps its exact English source', () => {
  const pendingMatch = PENDING.match(/^ {2}designGlossyResumeGaveUp: (['"])((?:[^\\]|\\.)*?)\1,$/m);
  assert.ok(pendingMatch, 'designGlossyResumeGaveUp must still have a pending English source');
  const english = pendingMatch[2].replace(/\\n/g, '\n').replace(/\\'/g, "'");

  const zuMatch = ZU.match(/^ {2}designGlossyResumeGaveUp: (['"])((?:[^\\]|\\.)*?)\1,$/m);
  assert.ok(zuMatch, 'designGlossyResumeGaveUp has no isiZulu draft in lib/locales/zu.ts');
  const draft = zuMatch[2].replace(/\\n/g, '\n').replace(/\\'/g, "'");

  assert.ok(draft.endsWith(english), 'the isiZulu draft must keep its complete English source appended, per the designStorageFull pattern');
  assert.notEqual(draft, english, 'the isiZulu draft must add real isiZulu text, not just repeat the English source');
});

test('the DesignPrint live-preview failure is logged to the console, not only shown to the farmer', () => {
  const catchBlock = PRINT.match(/\.catch\(\(e\) => \{[\s\S]*?setPreviewErr\(formatDesignTranslation/);
  assert.ok(catchBlock, 'could not find the live-preview .catch((e) => { ... }) block');
  assert.match(catchBlock[0], /console\.error\([^)]*\be\b[^)]*\)/, 'the live-preview catch must log the real error to the console before setting previewErr');
});
