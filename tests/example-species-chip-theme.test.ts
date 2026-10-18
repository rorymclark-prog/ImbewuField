import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// dark-07: /example's 'Key species' chips were a fixed forest-green fill/text in every theme —
// #1F4D2B text on a 10% forest tint, which reads as near-invisible dark blobs on the near-black
// dark-mode card. Tokens follow each theme's own swing instead.

const PAGE = readFileSync(new URL('../app/example/page.tsx', import.meta.url), 'utf8');

test("the Key species chips use theme tokens, not a fixed forest-green hex", () => {
  const chipBlockStart = PAGE.indexOf('cardKeySpecies');
  const chipStyle = PAGE.slice(chipBlockStart, PAGE.indexOf('</span>', chipBlockStart));
  assert.doesNotMatch(chipStyle, /#1F4D2B/, 'the species chip still hardcodes the forest-green hex');
  assert.doesNotMatch(chipStyle, /rgba\(31,77,43/, 'the species chip still hardcodes a forest-green rgba fill/border');
  assert.match(chipStyle, /var\(--badge-bg\)/, 'the species chip background should follow --badge-bg');
  assert.match(chipStyle, /var\(--border\)/, 'the species chip border should follow --border');
  assert.match(chipStyle, /var\(--color-forest-800\)/, 'the species chip text should follow --color-forest-800');
});

test("the last card clears the global floating Lima button instead of sitting flush against it", () => {
  // w14 (desk-19): the fixed 96px floor became the shared clearance token every page uses, with
  // 96px kept as its minimum — the floor may not drop below that again.
  assert.match(PAGE, /padding: '84px 16px calc\(max\(96px, var\(--lima-fab-clearance, 96px\)\)\)'/, 'bottom padding dropped back below enough room for the floating Lima button');
});
