import { test } from 'node:test';
import { deepStrictEqual as expectEqual, ok as expectTrue, strictEqual as expectToBe } from 'node:assert';
import { SPECIES } from '@/lib/species-catalog';
import { validateSpecies } from '@/lib/species-palette';

test('species catalog is valid and merges correct counts', () => {
  const problems = validateSpecies(SPECIES);
  expectEqual(problems, []);

  const nembaProbs = SPECIES.filter(s => s.nemba === '1a' || s.nemba === '1b');
  expectToBe(nembaProbs.length, 0);

  for (const s of SPECIES) {
    expectTrue(s.source);
    expectTrue(s.source.trim().length > 0);
  }

  // Exact count after merging 394 raw entries by botanical name and skipping NEMBA 1a/1b
  expectToBe(SPECIES.length, 197);
});
