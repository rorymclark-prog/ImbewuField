import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/WATER-DECK-REVIEWED-PRECISION-2026-10-05.json', import.meta.url), 'utf8'));
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
// These tests describe the earlier independently drafted decks. Current cells
// must match the reviewed application before any dated snapshot is reconstructed.
export function waterDeckBeforeReviewedPrecision<T extends { slides: any[] }>(deck: T, language: string): T {
  const prior = structuredClone(deck);
  for (const row of proof.targetFieldChanges.filter((r: any) => r.language === language)) {
    const slide = prior.slides[row.slide - 1];
    assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish);
    assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTarget);
    slide.target.body[row.bodyIndex] = row.previousTarget;
  }
  assert.equal(sha(JSON.stringify(prior.slides)), proof.pairedInputs.find((r: any) => r.language === language).slidesSha256);
  return prior;
}
const media = JSON.parse(readFileSync(new URL('../docs/media/water-reviewed-precision-2026-10-05/frames.json', import.meta.url), 'utf8'));
export function mediaSHAForEarlierSoilProof(path: string) {
  const changed = media.changed.find((r: any) => r.path === path);
  const current = sha(readFileSync(path));
  if (!changed) return current;
  assert.equal(current, changed.sha256, 'new Water image must match its applied proof before reconstructing the earlier Soil media snapshot');
  return changed.baselineSha256;
}
