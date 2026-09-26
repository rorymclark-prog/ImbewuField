import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';

const hold = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, where: string) => {
  assert.equal(pair.sourceEnglish, english, `${where}: preserve the canonical English source exactly`);
  assert.equal(pair.tshivendaDraft, english, `${where}: keep held text in exact English`);
  assert.equal(pair.reviewStatus, 'hold', `${where}: identify held text explicitly`);
};

test('Tshivenda Food Forest L2 adds one body sentence without changing its existing drafts', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(sourceModule, 'Food Forest must remain in the canonical Study source');
  const source = sourceModule.lessons.find(lesson => lesson.id === 'food-forest-l2');
  assert.ok(source, 'Food Forest L2 must remain in the canonical Study source');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the paired machine draft must include L2');

  assert.equal(TSHIVENDA_FOOD_FOREST_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(TSHIVENDA_FOOD_FOREST_DRAFT.language, 've');
  assert.equal(draft.id, source.id);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.tshivendaDraft, 'U Nanga Lushaka lwa Zwimela zwa Daka ḽa Zwiḽiwa ḽa Afrika Tshipembe');
  assert.equal(draft.title.reviewStatus, 'machine-draft', 'preserve the existing learner-visible title draft');
  assert.ok(source.infographicAlt);
  assert.ok(draft.infographicAlt);
  hold(draft.infographicAlt, source.infographicAlt, 'infographicAlt');

  assert.equal(draft.body.sourceEnglish, source.body, 'body: keep the complete canonical lesson beside its draft');
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length, 'body: preserve every paragraph boundary');
  assert.equal(draftParagraphs[9],
    'Zwimela zwa mupo (indigenous plants) zwi teaho fhethu zwi nga tikedza habitat sa tshipiḓa tsha design.');
  sourceParagraphs.forEach((paragraph, index) => {
    if (index !== 9) assert.equal(draftParagraphs[index], paragraph, `body paragraph ${index + 1}: keep exact English`);
  });

  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  draft.keyPoints.forEach((point, index) => hold(point, source.keyPoints[index], `keyPoints[${index}]`));
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    const sourceQuestion = source.quiz[index];
    assert.equal(question.sourceCorrectIndex, sourceQuestion.correct, `quiz[${index}]: preserve the source answer index`);
    hold(question.question, sourceQuestion.q, `quiz[${index}].question`);
    assert.equal(question.options.length, sourceQuestion.options.length);
    question.options.forEach((option, optionIndex) => hold(option, sourceQuestion.options[optionIndex], `quiz[${index}].options[${optionIndex}]`));
    hold(question.rationale, sourceQuestion.rationale, `quiz[${index}].rationale`);
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

test('Tshivenda Food Forest L3 drafts only selected concepts and preserves every field safeguard', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'food-forest-l3');
  assert.ok(source, 'Food Forest L3 must remain in the canonical Study source');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the new source-paired L3 draft must be present');

  assert.equal(draft.id, source.id);
  assert.ok(source.infographicAlt);
  assert.ok(draft.infographicAlt);
  hold(draft.infographicAlt, source.infographicAlt, 'infographicAlt');
  hold(draft.title, source.title, 'title');
  assert.equal(draft.body.sourceEnglish, source.body, 'retain the complete exact English lesson');
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length, 'retain all paragraph boundaries');
  assert.equal(draftParagraphs[1], sourceParagraphs[1], 'the physical shelter claim stays exact English');
  assert.equal(draftParagraphs[2],
    'Main trees na lower layers zwi nga ḓiswa musi nyimele dzi tshi tendela. Ground cover need not wait until the end; avoid plants competing with young trees.');
  assert.equal(draftParagraphs[8],
    'Prune or thin support plants when needed, using methods suited to each species. Clean cuttings dzo teaho dzi nga dovha dza shumiswa sa mulch. Do not wait for a fixed year if competition is already harming plants.');
  assert.equal(draftParagraphs[11],
    'Check young plants after planting. Tshifhinga tsha harvest na outside inputs zwi bva kha species, fhethu na ndondolo; a hu na fifth-year result ine ya khwaṱhisedzwa.');
  sourceParagraphs.forEach((paragraph, index) => {
    if (![2, 8, 11].includes(index)) assert.equal(draftParagraphs[index], paragraph, `body paragraph ${index + 1}: preserve exact English`);
  });

  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  draft.keyPoints.forEach((point, index) => hold(point, source.keyPoints[index], `keyPoints[${index}]`));
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    const sourceQuestion = source.quiz[index];
    assert.equal(question.sourceCorrectIndex, sourceQuestion.correct);
    hold(question.question, sourceQuestion.q, `quiz[${index}].question`);
    assert.equal(question.options.length, sourceQuestion.options.length);
    question.options.forEach((option, optionIndex) => hold(option, sourceQuestion.options[optionIndex], `quiz[${index}].options[${optionIndex}]`));
    hold(question.rationale, sourceQuestion.rationale, `quiz[${index}].rationale`);
  });

  const presentation = resolveLearnerLessonPresentation(source, 've');
  assert.equal(presentation.status, 'draft', 'Study should visibly mark the unreviewed source-paired body');
  assert.equal(presentation.content.title, source.title);
  assert.equal(presentation.content.body, draft.body.tshivendaDraft);
  assert.deepEqual(presentation.content.keyPoints, source.keyPoints);
  assert.deepEqual(presentation.content.quiz, source.quiz);
  assert.equal(presentation.content.infographicAlt, source.infographicAlt);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 've').status,
    'english-fallback', 'source drift must withdraw the complete paired body');
});
