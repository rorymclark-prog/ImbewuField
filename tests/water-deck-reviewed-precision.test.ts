import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-st-water-harvesting.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { XITSONGA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ts-water-harvesting.ts';
const proof = JSON.parse(readFileSync('docs/study-translation-reviews/WATER-DECK-REVIEWED-PRECISION-2026-10-05.json', 'utf8'));
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const drafts = { st: SESOTHO_WATER_HARVESTING_DRAFT, ve: TSHIVENDA_WATER_HARVESTING_DRAFT, ts: XITSONGA_WATER_HARVESTING_DRAFT };
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
test('Water replacements bind complete source predicates and preserve every unlisted independent field', () => {
  assert.equal(proof.targetFieldChanges.length, 27);
  assert.equal(proof.targetFieldChanges.filter((r: any) => r.candidateEqualsCurrentNative).length, 23);
  const narration = englishSlideRecords(readFileSync('docs/narration/water-harvesting.en.md', 'utf8'));
  const canonical = COURSE_MODULES.find(m => m.id === 'water-harvesting')!;
  for (const language of ['st', 've', 'ts'] as const) {
    const deck = JSON.parse(readFileSync(`docs/narration/water-harvesting.${language}.paired-draft.json`, 'utf8'));
    validatePairedDraft(deck, narration, language);
    const drift = structuredClone(narration); drift[5].body[0] += ' changed source';
    assert.throws(() => validatePairedDraft(deck, drift, language), /English body differs/);
    const restored = structuredClone(deck.slides);
    for (const row of proof.targetFieldChanges.filter((r: any) => r.language === language)) {
      const slide = restored[row.slide - 1];
      assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish);
      assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTarget);
      assert.equal(row.currentTarget.status, 'draft');
      assert.equal(row.currentTarget.text, row.acceptedCandidate);
      const match = row.currentNativeMatches[0];
      const native = drafts[language].lessons.find(l => l.id === match.lessonId)!;
      const source = canonical.lessons.find(l => l.id === match.lessonId)!;
      assert.equal(source.body.split('\n\n')[match.paragraphIndex], row.sourceEnglish);
      assert.equal(native.body.sourceEnglish, source.body);
      const target = (native.body as any)[keys[language]].split('\n\n')[match.paragraphIndex];
      assert.equal(target, match.currentNativeTarget);
      if (row.candidateEqualsCurrentNative) assert.equal(row.acceptedCandidate, target);
      slide.target.body[row.bodyIndex] = row.previousTarget;
    }
    assert.equal(sha(JSON.stringify(restored)), proof.pairedInputs.find((r: any) => r.language === language).slidesSha256,
      'rewind only 27 accepted cells: all sources, headings, statuses, four PR953 repairs and unlisted wording remain exact');
  }
});
test('only selected Water frames change while other stills, narration and films retain exact bytes', () => {
  const media = JSON.parse(readFileSync('docs/media/water-reviewed-precision-2026-10-05/frames.json', 'utf8'));
  assert.equal(media.changed.length, 20);
  for (const row of media.changed) {
    const bytes = readFileSync(row.path);
    assert.equal(sha(bytes), row.sha256); assert.notEqual(row.sha256, row.baselineSha256);
    assert.equal(bytes.length, row.bytes); assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const row of media.preserved) assert.equal(sha(readFileSync(row.path)), row.sha256, row.path);
  let sizes = readFileSync(media.assetSizeManifest.path, 'utf8');
  for (const row of media.assetSizeManifest.selectedEntries) {
    const current = `'${row.url}': ${row.currentSize}`;
    assert.equal(sizes.split(current).length - 1, 1, 'only an exact selected manifest entry is replaced');
    sizes = sizes.replace(current, `'${row.url}': ${row.previousSize}`);
  }
  assert.equal(sha(sizes), media.assetSizeManifest.baselineSHA256, 'all unlisted asset-size entries retain exact text');

});
