import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson, type QuizQuestion } from '../lib/course-modules.ts';
import { XITSONGA_PLANT_GUILDS_DRAFT } from '../lib/course-translation-drafts-ts-plant-guilds.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'plant-guilds')!;
const selectedParagraphs: Record<string, Record<number, string>> = {
  'plant-guilds-l2': {
    2: 'Mulch yi sirhelela misava ya le henhla, yi pfuna ku hlayisa ku tsakama naswona yi vuyisela organic material.',
  },
  'plant-guilds-l3': {
    0: "Combine the support functions your site needs: nitrogen fixation, food, mulch, flowers and ground cover. Swimilana swin'wana swi tirha mintirho yo hlayanyana.",
  },
};

const sourceLessonById = new Map(sourceModule.lessons.map(lesson => [lesson.id, lesson]));

test('Plant Guilds Xitsonga drafts replace only two selected concept sentences, with source paired', () => {
  assert.equal(XITSONGA_PLANT_GUILDS_DRAFT.id, sourceModule.id);
  assert.equal(XITSONGA_PLANT_GUILDS_DRAFT.language, 'ts');
  assert.equal(XITSONGA_PLANT_GUILDS_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(XITSONGA_PLANT_GUILDS_DRAFT.sourceMetadata.durationMins, sourceModule.durationMins);
  assert.equal(XITSONGA_PLANT_GUILDS_DRAFT.sourceMetadata.category, sourceModule.category);
  assert.deepEqual(XITSONGA_PLANT_GUILDS_DRAFT.lessons.map(lesson => lesson.id), ['plant-guilds-l2', 'plant-guilds-l3']);

  for (const draftLesson of XITSONGA_PLANT_GUILDS_DRAFT.lessons) {
    const sourceLesson = sourceLessonById.get(draftLesson.id);
    assert.ok(sourceLesson);
    assert.equal(draftLesson.title.sourceEnglish, sourceLesson.title);
    assert.equal(draftLesson.title.xitsongaDraft, sourceLesson.title);
    assert.equal(draftLesson.title.reviewStatus, 'hold');
    assert.equal(draftLesson.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
    assert.equal(draftLesson.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
    assert.equal(draftLesson.infographicAlt?.reviewStatus, 'hold');
    assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);

    const sourceParagraphs = sourceLesson.body.split('\n\n');
    const localizedParagraphs = draftLesson.body.xitsongaDraft.split('\n\n');
    assert.equal(localizedParagraphs.length, sourceParagraphs.length, `${sourceLesson.id}: keep body paragraph boundaries`);
    for (const [paragraphIndex, sourceParagraph] of sourceParagraphs.entries()) {
      const candidate: string | undefined = selectedParagraphs[sourceLesson.id]?.[paragraphIndex];
      assert.equal(localizedParagraphs[paragraphIndex], candidate ?? sourceParagraph,
        `${sourceLesson.id} body paragraph ${paragraphIndex}: only selected learner sentence may change`);
    }

    assert.deepEqual(draftLesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
    assert.deepEqual(draftLesson.keyPoints.map(point => point.xitsongaDraft), sourceLesson.keyPoints);
    assert.ok(draftLesson.keyPoints.every(point => point.reviewStatus === 'hold'));
    assert.equal(draftLesson.quiz.length, sourceLesson.quiz.length);
    for (const [quizIndex, item] of draftLesson.quiz.entries()) {
      const sourceQuiz: QuizQuestion = sourceLesson.quiz[quizIndex];
      assert.equal(item.question.sourceEnglish, sourceQuiz.q);
      assert.equal(item.question.xitsongaDraft, sourceQuiz.q);
      assert.equal(item.question.reviewStatus, 'hold');
      assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceQuiz.options);
      assert.deepEqual(item.options.map(option => option.xitsongaDraft), sourceQuiz.options);
      assert.ok(item.options.every(option => option.reviewStatus === 'hold'));
      assert.equal(item.sourceCorrectIndex, sourceQuiz.correct, `${sourceLesson.id} quiz ${quizIndex}: answer index changed`);
      assert.equal(item.rationale.sourceEnglish, sourceQuiz.rationale);
      assert.equal(item.rationale.xitsongaDraft, sourceQuiz.rationale);
      assert.equal(item.rationale.reviewStatus, 'hold');
    }

    const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.title, sourceLesson.title);
    assert.equal(shown.content.body, draftLesson.body.xitsongaDraft);
    assert.deepEqual(shown.content.keyPoints, sourceLesson.keyPoints);
    assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
  }
});

test('Plant Guilds lesson 1 stays English because it has no Xitsonga learner text', () => {
  const lesson = sourceModule.lessons.find(item => item.id === 'plant-guilds-l1')!;
  const shown = resolveLearnerLessonPresentation(lesson, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.title, lesson.title);
  assert.equal(shown.content.body, lesson.body);
});

test('Plant Guilds legal, biological and management advice stays exact English in lessons 2 and 3', () => {
  const heldSources = XITSONGA_PLANT_GUILDS_DRAFT.holds.map(item => item.sourceText);
  for (const required of [
    'Bocking 14 does not spread by viable seed, but root pieces can regrow.',
    'Many ladybirds eat aphids; some parasitoid wasps attack crop pests.',
    'Tulbaghia violacea has narrow leaves and lilac flowers.',
    'Plant into a suitable season, mulch and maintain establishment water.',
    'Manage regrowth to keep the opening.',
  ]) assert.ok(heldSources.some(source => source.includes(required)), `must document the exact English hold: ${required}`);

  for (const lesson of XITSONGA_PLANT_GUILDS_DRAFT.lessons) {
    assert.ok(lesson.quiz.every(question => [question.question, ...question.options, question.rationale]
      .every(pair => pair.xitsongaDraft === pair.sourceEnglish)), `${lesson.id}: quiz content stays exact English`);
  }
});

test('Plant Guilds source drift sends the affected lesson back to exact English', () => {
  const lesson = sourceLessonById.get('plant-guilds-l2')!;
  const changedSource: Lesson = { ...lesson, body: `${lesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);
});
