// A crop's name may never be SUBSTITUTED for another crop's name.
//
// components/NgoDashboard.tsx carried a display helper that ended `?? CROPS[0]` — CROPS being a
// ten-item DEMO array at the top of that file, there to give fake gardeners plausible rows. Real
// gardener records went through it too. Nothing in the array is a substring of "Avocado", so the
// fallback fired and an NGO programme officer or funder saw a real farmer's avocado harvest
// reported as "Spinach", drawn with swiss-chard artwork, on the screen they fund her from. The
// photo strip then deduped on that fabricated name, collapsing every unrecognised crop into one
// tile and discarding her other photos before the 5-item slice ran.
//
// That is worse than a blank: a missing icon says "I do not know", a substituted crop says
// something false and says it confidently. The rule this file guards:
//
//   Resolve a written crop name through lib/crop-identity.ts. When neither catalogue knows it,
//   fall back to THE FARMER'S OWN WORDS — never to some other crop's name, art or emoji.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/crop-name-substitution-guard.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildCropAliasIndex, cropIdentityOf } from '@/lib/crop-identity';

const ngoSource = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');

/** Comments are stripped before scanning: the fix documents the old line verbatim so the next
 *  reader knows what the trap looked like, and a guard that fires on its own explanation is a
 *  guard nobody keeps. */
const ngoCode = ngoSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('no display helper falls back to a named crop from the demo array', () => {
  // The exact shape of the bug, and the near-misses that would reintroduce it.
  for (const banned of ['?? CROPS[0]', '|| CROPS[0]', ': CROPS[0]', 'return CROPS[0]']) {
    assert.equal(
      ngoCode.includes(banned), false,
      `NgoDashboard must not fall back to a named demo crop (found "${banned}")`,
    );
  }
});

test('the NGO panel resolves live crop names through the shared identity module', () => {
  assert.match(ngoSource, /from '@\/lib\/crop-identity'/, 'NgoDashboard imports the identity module');
  assert.match(ngoCode, /cropIdentityOf\(/, 'and actually uses it to name a crop');
});

test('the produce-photo strip cannot dedupe on a displayed name alone', () => {
  // Deduping on the label merges two crops that happen to print the same word. The resolved
  // catalogue key is the identity; the written words are only the fallback for a crop the
  // catalogues do not know.
  assert.equal(
    /new Map\(gardener\.production\.map\(\(p\) => \[p\.crop\.n,/.test(ngoCode), false,
    'photoCrops must key on the resolved crop key, not the displayed name',
  );
  assert.match(ngoCode, /p\.crop\.k \|\| p\.crop\.n/, 'key first, written words only as fallback');
});

test('an unknown crop keeps the farmer’s words and claims no catalogue identity', () => {
  // The invariant the fallback broke, asserted at the level every caller shares.
  const aliases = buildCropAliasIndex();
  const identity = cropIdentityOf('umbhida wesintu', aliases);
  assert.equal(identity.key, null, 'no catalogue claims a name neither catalogue knows');
  assert.equal(identity.label, 'umbhida wesintu', 'so her own words are what gets shown');
});
