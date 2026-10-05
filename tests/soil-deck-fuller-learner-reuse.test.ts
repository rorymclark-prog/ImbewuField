import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';

const proof = JSON.parse(readFileSync('docs/study-translation-reviews/SOIL-DECK-FULLER-LEARNER-REUSE-2026-10-05.json', 'utf8'));
const packet = JSON.parse(readFileSync(proof.learnerPacket, 'utf8'));
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const drafts = { st: SESOTHO_SOIL_HEALTH_DRAFT, ve: TSHIVENDA_SOIL_HEALTH_DRAFT, ts: XITSONGA_SOIL_HEALTH_DRAFT };
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;

test('Soil deck replacements bind complete current learner paragraphs to exact narration without regressing independent drafts', () => {
  assert.equal(proof.targetFieldChanges.length, 69);
  assert.equal(proof.independentDeckPreservation.length, 13);
  assert.equal(sha(readFileSync(proof.learnerPacket)), proof.learnerPacketSha256);
  const narration = englishSlideRecords(readFileSync('docs/narration/soil-health.en.md', 'utf8'));
  const canonical = COURSE_MODULES.find(module => module.id === 'soil-health')!;
  for (const language of ['st', 've', 'ts'] as const) {
    const deck = JSON.parse(readFileSync(`docs/narration/soil-health.${language}.paired-draft.json`, 'utf8'));
    validatePairedDraft(deck, narration, language);
    const drift = structuredClone(narration);
    drift[5].body[0] += ' changed source';
    assert.throws(() => validatePairedDraft(deck, drift, language), /English body differs from narration/);
    assert.equal(deck.reviewStatus, 'unreviewed');
    const restored = structuredClone(deck.slides);
    for (const row of proof.targetFieldChanges.filter((row: any) => row.language === language)) {
      const unit = packet.units.find((unit: any) => unit.id === row.learnerUnitId)!;
      const lesson = drafts[language].lessons.find(lesson => lesson.id === row.learnerLessonId)!;
      const source = canonical.lessons.find(lesson => lesson.id === row.learnerLessonId)!;
      assert.equal(row.learnerField, 'body', 'no approximate title or quiz copies');
      assert.equal(source.body.split('\n\n')[row.learnerParagraphIndex], row.sourceEnglish);
      assert.equal(lesson.body.sourceEnglish, source.body);
      assert.equal((lesson.body as any)[keys[language]].split('\n\n')[row.learnerParagraphIndex], unit.proposedTarget);
      assert.equal(unit.sourceEnglish, row.sourceEnglish);
      assert.equal(row.currentTarget.text, unit.proposedTarget);
      const slide = restored[row.slide - 1];
      assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish);
      assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTarget);
      assert.equal(row.currentTarget.status, 'draft');
      assert.deepEqual(row.segments.map((segment: any) => segment.sourceEnglish).join(''), row.sourceEnglish);
      slide.target.body[row.bodyIndex] = structuredClone(row.previousTarget);
    }
    for (const row of proof.independentDeckPreservation.filter((row: any) => row.language === language)) {
      const slide = deck.slides[row.slide - 1];
      assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish);
      assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTargetObject,
        'independently translated framing must not inherit more English from the learner draft');
    }
    assert.equal(sha(JSON.stringify(restored)), proof.pairedInputs.find((row: any) => row.language === language).slidesSha256,
      'rewinding only accepted cells preserves all headings, sources and unrelated target cells');
  }
});

test('only the thirty-four selected Soil frames redraw and all other course media retain exact bytes', () => {
  const media = JSON.parse(readFileSync('docs/media/soil-learner-fuller-2026-10-05/frames.json', 'utf8'));
  assert.equal(media.changed.length, 34);
  assert.equal(media.unchangedSoilRegionalFrames, 26);
  assert.equal(new Set(media.changed.map((row: any) => row.path)).size, 34);
  for (const row of media.changed) {
    const bytes = readFileSync(row.path);
    assert.equal(sha(bytes), row.sha256);
    assert.equal(bytes.length, row.bytes);
    assert.notEqual(row.sha256, row.baselineSha256, 'the render must change actual pixels');
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  }
  for (const row of media.preserved) {
    assert.equal(sha(readFileSync(row.path)), row.sha256, `${row.path}: preserve existing offline media`);
  }
});
