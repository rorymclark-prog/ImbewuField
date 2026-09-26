import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';

test('Tshivenda Food Forest L2 pairs one marked heading with exact English farming holds', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(sourceModule, 'Food Forest must remain in the canonical Study source');
  const source = sourceModule.lessons.find(lesson => lesson.id === 'food-forest-l2');
  assert.ok(source, 'Food Forest L2 must remain in the canonical Study source');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the paired machine draft must include L2');

  const checkHeld = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, where: string) => {
    assert.equal(pair.sourceEnglish, english, `${where}: preserve the canonical English source exactly`);
    assert.equal(pair.tshivendaDraft, english, `${where}: keep unreviewed farming content in exact English`);
    assert.equal(pair.reviewStatus, 'hold', `${where}: identify held text explicitly`);
  };

  assert.equal(TSHIVENDA_FOOD_FOREST_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(TSHIVENDA_FOOD_FOREST_DRAFT.language, 've');
  assert.equal(draft.id, source.id);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.tshivendaDraft, 'U Nanga Lushaka lwa Zwimela zwa Daka ḽa Zwiḽiwa ḽa Afrika Tshipembe');
  assert.equal(draft.title.reviewStatus, 'machine-draft');

  assert.ok(source.infographicAlt);
  assert.ok(draft.infographicAlt);
  checkHeld(draft.infographicAlt, source.infographicAlt, 'infographicAlt');
  assert.equal(draft.body.sourceEnglish, source.body, 'body: keep the complete canonical lesson beside its draft');
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length, 'body: preserve every paragraph boundary');
  const habitatParagraph = 'Zwimela zwa mupo zwo teaho vhupo hazwo zwi nga tikedza vhupo sa tshipiḓa tsha nzudzanyo.';
  assert.equal(draftParagraphs[9], habitatParagraph, 'body: include only the independently checked habitat sentence');
  draftParagraphs.forEach((paragraph, index) => {
    if (index !== 9) assert.equal(paragraph, sourceParagraphs[index], `body paragraph ${index + 1}: keep exact English`);
  });
  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  draft.keyPoints.forEach((point, index) => checkHeld(point, source.keyPoints[index], `keyPoints[${index}]`));
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    const sourceQuestion = source.quiz[index];
    assert.equal(question.sourceCorrectIndex, sourceQuestion.correct, `quiz[${index}]: preserve the source answer index`);
    checkHeld(question.question, sourceQuestion.q, `quiz[${index}].question`);
    assert.equal(question.options.length, sourceQuestion.options.length);
    question.options.forEach((option, optionIndex) =>
      checkHeld(option, sourceQuestion.options[optionIndex], `quiz[${index}].options[${optionIndex}]`));
    checkHeld(question.rationale, sourceQuestion.rationale, `quiz[${index}].rationale`);
  });

  const presentation = resolveLearnerLessonPresentation(source, 've');
  assert.equal(presentation.status, 'draft', 'Study must visibly mark the paired source draft');
  assert.equal(presentation.content.title, draft.title.tshivendaDraft);
  assert.equal(presentation.content.body, draft.body.tshivendaDraft);
  assert.deepEqual(presentation.content.keyPoints, source.keyPoints);
  assert.deepEqual(presentation.content.quiz, source.quiz);
  assert.equal(presentation.content.infographicAlt, source.infographicAlt);
  assert.equal(resolveLearnerLessonPresentation({ ...source, title: `${source.title} changed` }, 've').status,
    'english-fallback', 'a changed English source must withdraw the paired draft');
});
