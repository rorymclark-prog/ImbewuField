import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAIR = readFileSync('components/SurveyZuluDraftPair.tsx', 'utf8');

test('w15-02: the isiZulu draft and its English source are separated in the text, not just visually', () => {
  assert.match(PAIR, /<span lang="zu">\{children\}<\/span>[\s\S]*?\{' '\}\s*\n\s*<small lang="en"/,
    'a heading built from SurveyZuluDraftPair must not read as "…wasensiminiEnglish:"');
  assert.match(PAIR, /display: 'inline-flex', flexDirection: 'column'/,
    'the space only stays invisible while the pair is a flex column');
});
