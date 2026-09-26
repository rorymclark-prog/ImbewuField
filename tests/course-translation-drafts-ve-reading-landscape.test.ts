import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { TSHIVENDA_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-ve-small-livestock.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';

test('Reading the Landscape Tshivenda draft stays paired to every exact Study source field', () => {
  const draft = TSHIVENDA_READING_LANDSCAPE_DRAFT;
  const source = COURSE_MODULES.find(module => module.id === draft.id);
  assert.ok(source, 'the translated module must have its canonical English source');
  assert.equal(draft.language, 've');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);

  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const holds: string[] = [];
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: keep the exact English source`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: include a draft or exact English hold`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: review state must be explicit`);
    if (pair.reviewStatus === 'hold') {
      assert.equal(pair.tshivendaDraft, english, `${path}: held wording must remain exact English`);
      holds.push(path);
    }
    assert.deepEqual(numberTokens(pair.tshivendaDraft), numberTokens(english), `${path}: preserve all figures and times`);
    assert.deepEqual(placeholders(pair.tshivendaDraft), placeholders(english), `${path}: preserve placeholders`);
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'include every source lesson');

  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: lesson IDs and order must match`);
    if (original.infographicAlt !== undefined) {
      assert.ok(lesson.infographicAlt, `${path}: include the source infographic description`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.tshivendaDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: preserve paragraph breaks`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: preserve key-point count and order`);
    lesson.keyPoints.forEach((point, pointIndex) => {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`);
    });
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: preserve quiz count and order`);
    lesson.quiz.forEach((question, questionIndex) => {
      const sourceQuestion = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, sourceQuestion.q, `${questionPath}.question`);
      assert.equal(question.options.length, sourceQuestion.options.length, `${questionPath}: preserve option count and order`);
      question.options.forEach((option, optionIndex) => checkPair(option, sourceQuestion.options[optionIndex], `${questionPath}.options[${optionIndex}]`));
      assert.equal(question.sourceCorrectIndex, sourceQuestion.correct, `${questionPath}: preserve the source answer index`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, sourceQuestion.options[sourceQuestion.correct],
        `${questionPath}: answer index must still point to the canonical English answer`);
      checkPair(question.rationale, sourceQuestion.rationale, `${questionPath}.rationale`);
    });
  }
  assert.deepEqual(holds, [
    'lessons[0] reading-landscape-l1.body',
    'lessons[0] reading-landscape-l1.keyPoints[1]',
    'lessons[0] reading-landscape-l1.quiz[0].options[0]',
    'lessons[0] reading-landscape-l1.quiz[0].options[2]',
    'lessons[0] reading-landscape-l1.quiz[0].rationale',
    'lessons[1] reading-landscape-l2.keyPoints[1]',
    'lessons[1] reading-landscape-l2.quiz[1].question',
    'lessons[2] reading-landscape-l3.body',
    'lessons[2] reading-landscape-l3.keyPoints[1]',
    'lessons[2] reading-landscape-l3.quiz[0].rationale',
    'lessons[2] reading-landscape-l3.quiz[1].rationale',
    'lessons[3] reading-landscape-l4.keyPoints[2]',
    'lessons[3] reading-landscape-l4.quiz[1].options[1]',
  ], 'uncertain wording stays held until checked by a fluent Tshivenda speaker');
});

test('Tshivenda Small Livestock shows only the checked module description draft and keeps lesson copy English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source, 'the canonical Small Livestock module must exist');
  const draft = TSHIVENDA_SMALL_LIVESTOCK_DRAFT;

  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.title.tshivendaDraft, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.equal(draft.description.reviewStatus, 'machine-draft');
  assert.equal(draft.description.tshivendaDraft,
    'Chickens, ducks and bees sa system components — hu si zwithu zwo humbulwaho nga murahu.');
  assert.deepEqual(draft.lessons, [], 'back-checked lesson title candidates with terminology mismatches are not wired');

  const card = resolveCourseModulePresentation(source, 've');
  assert.equal(card.status, 'draft', 'the module description is visibly marked as unreviewed');
  assert.equal(card.title, source.title, 'the uncertain module title remains English');
  assert.equal(card.description, draft.description.tshivendaDraft);

  for (const lesson of source.lessons) {
    const presentation = resolveLearnerLessonPresentation(lesson, 've');
    assert.equal(presentation.status, 'english-fallback', `${lesson.id} has no approved lesson title draft`);
    assert.equal(presentation.content.title, lesson.title, `${lesson.id}: title stays English`);
    assert.equal(presentation.content.body, lesson.body, `${lesson.id}: animal-care and manure guidance stays English`);
    assert.deepEqual(presentation.content.keyPoints, lesson.keyPoints, `${lesson.id}: safety key points stay English`);
    assert.deepEqual(presentation.content.quiz, lesson.quiz, `${lesson.id}: quiz and answer choices stay English`);
  }

  assert.equal(resolveCourseModulePresentation({ ...source, description: `${source.description} Changed.` }, 've').status,
    'english-fallback', 'a changed module description withdraws the paired draft');
  assert.equal(resolveCourseModulePresentation({ ...source, durationMins: source.durationMins + 1 }, 've').status,
    'english-fallback', 'changed module metadata withdraws the paired draft');
});

test('Tshivenda Market L2 shows only the checked cost comparison draft and falls back if its source changes', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l2');
  assert.ok(sourceLesson);
  const lesson = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons[0];

  assert.equal(lesson.id, sourceLesson.id);
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(lesson.title.reviewStatus, 'hold');
  assert.equal(lesson.title.tshivendaDraft, sourceLesson.title);
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(lesson.body.reviewStatus, 'hold');
  assert.equal(lesson.body.tshivendaDraft, sourceLesson.body);
  assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.equal(lesson.keyPoints[1].reviewStatus, 'machine-draft');
  assert.equal(lesson.keyPoints[1].tshivendaDraft, 'Vhambedzani tsengo na ndozwo khathihi na mutengo wa u rengisa.');
  for (const index of [0, 2, 3]) {
    assert.equal(lesson.keyPoints[index].reviewStatus, 'hold');
    assert.equal(lesson.keyPoints[index].tshivendaDraft, sourceLesson.keyPoints[index]);
  }
  assert.deepEqual(lesson.quiz.map(question => question.sourceCorrectIndex), sourceLesson.quiz.map(question => question.correct));

  const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.keyPoints[1], lesson.keyPoints[1].tshivendaDraft);
  assert.equal(presentation.content.keyPoints[0], sourceLesson.keyPoints[0]);
  assert.equal(presentation.content.keyPoints[2], sourceLesson.keyPoints[2]);
  assert.equal(presentation.content.body, sourceLesson.body);
  assert.deepEqual(presentation.content.quiz, sourceLesson.quiz);

  const changedSource = {
    ...sourceLesson,
    keyPoints: sourceLesson.keyPoints.map((point, index) => index === 1 ? `${point} ` : point),
  };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 've');
  assert.equal(stalePresentation.status, 'english-fallback');
  assert.deepEqual(stalePresentation.content.keyPoints, changedSource.keyPoints);
});
