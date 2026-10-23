import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { rewindMarketOrdinaryPresentation, validateAndRewindMarketOrdinary } from './market-ordinary-completion-history-checks.ts';

const proof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/MARKET-COMMUNITY-L2-L3-ORDINARY-COMPLETION-APPLIED-2026-10-05.json', import.meta.url), 'utf8'));
const source = COURSE_MODULES.find(module => module.id === 'market-community')!;
const targetKeys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;

// Historical tests describe earlier partial drafts. Validate their accepted
// source/prior/final edges before reconstructing that history, so changing a
// final target or its English pair still fails those tests.
export function reconstructMarketBeforeL2L3Completion<T extends { lessons: readonly any[]; language: keyof typeof targetKeys }>(native: T, language: keyof typeof targetKeys): T {
  const prior = validateAndRewindMarketOrdinary(native, language);
  const key = targetKeys[language];
  for (const field of proof.fields.filter((row: any) => row.language === language)) {
    const lesson = prior.lessons.find(item => item.id === field.lessonId)!;
    const canonical = source.lessons.find(item => item.id === field.lessonId)!;
    let pair;
    let english;
    if (field.fieldPath === 'body' || field.fieldPath === 'title') {
      pair = lesson[field.fieldPath];
      english = canonical[field.fieldPath as 'body' | 'title'];
    } else if (field.fieldPath.startsWith('keyPoints.')) {
      const index = Number(field.fieldPath.split('.')[1]);
      pair = lesson.keyPoints[index];
      english = canonical.keyPoints[index];
    } else {
      const match = field.fieldPath.match(/^quiz(?:\[(\d+)\]|\.(\d+))\.(question|q|rationale|options)(?:\[(\d+)\]|\.(\d+))?$/)!;
      assert.ok(match, `known completion field ${field.fieldPath}`);
      const index = Number(match[1] ?? match[2]);
      const option = Number(match[4] ?? match[5]);
      const prop = match[3] === 'q' ? 'question' : match[3];
      pair = prop === 'options' ? lesson.quiz[index].options[option] : lesson.quiz[index][prop];
      english = prop === 'options' ? canonical.quiz[index].options[option] : prop === 'question' ? canonical.quiz[index].q : canonical.quiz[index].rationale;
    }
    assert.equal(english, field.sourceEnglish, 'accepted field remains bound to canonical English');
    assert.equal(pair.sourceEnglish, field.sourceEnglish, 'native source pair remains exact');
    assert.equal(pair[key], field.appliedTarget, 'native target matches the accepted later completion');
    assert.equal(pair.reviewStatus, 'machine-draft', 'later wording remains visibly unreviewed');
    pair[key] = field.currentTarget;
  }
  return prior;
}

export const reconstructMarketPresentationBeforeCompletion: typeof resolveLearnerLessonPresentation = (...args) => {
  let result = resolveLearnerLessonPresentation(...args);
  const [lesson, language] = args;
  if (result.status !== 'draft' || !lesson.id.startsWith('market-community-') || !['st', 've', 'ts'].includes(language)) return result;
  result = rewindMarketOrdinaryPresentation(result, lesson.id, language as keyof typeof targetKeys) as typeof result;
  for (const field of proof.fields.filter((row: any) => row.language === language && row.lessonId === lesson.id)) {
    let container: any = result.content;
    let key = field.fieldPath;
    if (key.startsWith('keyPoints.')) {
      container = result.content.keyPoints;
      key = key.split('.')[1];
    } else if (key.startsWith('quiz')) {
      const match = key.match(/^quiz(?:\[(\d+)\]|\.(\d+))\.(question|q|rationale|options)(?:\[(\d+)\]|\.(\d+))?$/)!;
      assert.ok(match);
      container = result.content.quiz[Number(match[1] ?? match[2])];
      key = match[3] === 'question' ? 'q' : match[3];
      if (key === 'options') {
        container = container.options;
        key = match[4] ?? match[5];
      }
    }
    assert.equal(container[key], field.appliedTarget, 'live resolver returns the accepted completion before historical reconstruction');
    container[key] = field.currentTarget;
  }
  return result;
};
