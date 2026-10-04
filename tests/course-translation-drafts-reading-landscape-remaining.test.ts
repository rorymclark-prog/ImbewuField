import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';

const packet = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-REMAINING-ORDINARY-CANDIDATES-2026-10-04.json', import.meta.url), 'utf8'));
const candidates = packet.candidateFields as Array<{
  language: 've' | 'ts';
  lessonId: string;
  canonicalSourceBody: string;
  canonicalSourceParagraph: string;
  currentTargetBody: string;
  paragraphIndex: number;
  targetedSourceSentence: string;
  proposedSentence: string;
  proposedTargetBody: string;
  segments: Array<{ sourceEnglish: string; targetText: string }>;
}>;
const module = COURSE_MODULES.find(item => item.id === 'reading-landscape')!;
const drafts = { ve: TSHIVENDA_READING_LANDSCAPE_DRAFT, ts: XITSONGA_READING_LANDSCAPE_DRAFT };

test('Reading L1 localizes only the approved before-digging clause and falls back on source drift', () => {
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    const source = module.lessons.find(lesson => lesson.id === candidate.lessonId)!;
    const draft = drafts[candidate.language].lessons.find(lesson => lesson.id === candidate.lessonId)!;
    const pair = draft.body;
    const target = 'tshivendaDraft' in pair ? pair.tshivendaDraft : pair.xitsongaDraft;
    const sourceParagraphs = source.body.split('\n\n');
    const currentTargetParagraphs = candidate.currentTargetBody.split('\n\n');
    const targetParagraphs = target.split('\n\n');
    const proposedTargetParagraphs = candidate.proposedTargetBody.split('\n\n');

    assert.equal(source.body, candidate.canonicalSourceBody, `${candidate.language}: source body remains canonical`);
    assert.equal(pair.sourceEnglish, source.body, `${candidate.language}: full body source pair remains exact`);
    assert.equal(pair.reviewStatus, 'machine-draft', `${candidate.language}: body remains visibly unreviewed`);
    assert.equal(sourceParagraphs[candidate.paragraphIndex], candidate.canonicalSourceParagraph);
    assert.equal(target, candidate.currentTargetBody.replace(candidate.targetedSourceSentence, candidate.proposedSentence),
      `${candidate.language}: only the approved sentence changes in the existing learner draft`);
    assert.equal(sourceParagraphs.length, targetParagraphs.length);
    assert.equal(targetParagraphs.length, proposedTargetParagraphs.length);
    assert.equal(sourceParagraphs[candidate.paragraphIndex].split(candidate.targetedSourceSentence).length, 2,
      `${candidate.language}: the canonical sentence occurs exactly once`);
    assert.equal(candidate.segments.map((segment: { sourceEnglish: string }) => segment.sourceEnglish).join(''), candidate.targetedSourceSentence);
    assert.equal(candidate.segments.map((segment: { targetText: string }) => segment.targetText).join(''), candidate.proposedSentence);
    assert.equal(targetParagraphs[candidate.paragraphIndex], proposedTargetParagraphs[candidate.paragraphIndex]);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('a swale, dam'), `${candidate.language}: named structures remain exact English`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('Its marks are an observation, not a design or approval for earthworks.'),
      `${candidate.language}: A-frame is not presented as earthworks design or approval`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('Soil, slope, drainage, storm flow'),
      `${candidate.language}: all site assessment factors remain present`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('safe overflow route'),
      `${candidate.language}: safe overflow route remains present`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('trained local adviser'),
      `${candidate.language}: trained local adviser remains specified`);

    const shown = resolveLearnerLessonPresentation(source, candidate.language);
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.body, target);
    const changedSource = { ...source, body: `${source.body}\nChanged site instruction.` };
    const fallback = resolveLearnerLessonPresentation(changedSource, candidate.language);
    assert.equal(fallback.status, 'english-fallback', `${candidate.language}: changed source withdraws the stale translation`);
    assert.equal(fallback.content.body, changedSource.body);
  }
});
