import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-st-small-livestock.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Sesotho Small Livestock L3 drafts only the observation checklist and keeps farm guidance exact English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'small-livestock-l3');
  assert.ok(source);
  const draft = SESOTHO_SMALL_LIVESTOCK_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the L3 source-paired lesson must be present');

  assert.equal(SESOTHO_SMALL_LIVESTOCK_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.sesothoDraft, source.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.equal(draft.infographicAlt?.sesothoDraft, source.infographicAlt);
  assert.equal(draft.infographicAlt?.reviewStatus, 'hold');

  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  assert.deepEqual(draftParagraphs.filter((_, index) => index !== 2),
    sourceParagraphs.filter((_, index) => index !== 2),
    'manure hygiene, tick and disease advice, and goat parasite guidance stay exact English');
  assert.notEqual(draftParagraphs[2], sourceParagraphs[2], 'only the observation checklist is drafted');
  assert.match(draftParagraphs[2], /phoofolo ka nngwe/);
  assert.match(draftParagraphs[2], /metsi/);
  assert.match(draftParagraphs[2], /terata/);

  assert.deepEqual(draft.keyPoints.map(point => [point.sourceEnglish, point.sesothoDraft, point.reviewStatus]),
    source.keyPoints.map(point => [point, point, 'hold']), 'all animal-care key points stay exact English');
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    const original = source.quiz[index];
    assert.equal(question.sourceCorrectIndex, original.correct);
    assert.deepEqual([question.question, ...question.options, question.rationale]
      .map(pair => [pair.sourceEnglish, pair.sesothoDraft, pair.reviewStatus]),
    [original.q, ...original.options, original.rationale].map(text => [text, text, 'hold']),
    'species, quiz options, correct answers and animal-health rationale stay exact English');
  });

  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft', 'the learner view must identify this as an unreviewed draft');
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.equal(presentation.content.quiz[0].correct, source.quiz[0].correct);
  assert.deepEqual(resolveLearnerLessonPresentation({ ...source, body: `${source.body} Changed.` }, 'st').status,
    'english-fallback', 'source drift must withdraw the paired paragraph draft');
});
