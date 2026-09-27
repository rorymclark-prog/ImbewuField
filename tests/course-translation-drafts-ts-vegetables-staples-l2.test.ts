import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_VEGETABLES_STAPLES_L2_DRAFT } from '../lib/course-translation-drafts-ts-vegetables-staples-l2.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
const sourceParagraphsSelected = [
  'Succession planting is a calendar habit, not a special crop.',
  'Less waste during a glut. Fresh food for longer. And the labour spreads out across the season instead of landing on you all at once.',
];
const draftParagraphsSelected = [
  'Ku byala swibyariwa hi ku landzelelana i ntolovelo wa khalendara, a hi xibyariwa xo hlawuleka.',
  'Ku lahleka ka swakudya ka hunguteka loko ku ri na ntshovelo wo tala. Ku va na swakudya swo tenga nkarhi wo leha. Ntirho wu hangalaka hi nkarhi wa nguva, ematshan\'weni yo ku wu humelela hinkwawo hi nkarhi wun\'we.',
];

test('Vegetables & Staple Crops L2 exposes only its source-paired Xitsonga concept sentences', () => {
  const moduleDraft = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT;
  const draft = moduleDraft.lessons[0];
  assert.equal(moduleDraft.id, sourceModule.id);
  assert.equal(moduleDraft.language, 'ts');
  assert.equal(moduleDraft.reviewStatus, 'machine-draft');
  assert.equal(draft.id, sourceLesson.id);
  assert.equal(draft.body.sourceEnglish, sourceLesson.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(localizedParagraphs.length, sourceParagraphs.length);
  assert.deepEqual([0, 3].map(index => sourceParagraphs[index]), sourceParagraphsSelected);
  assert.deepEqual([0, 3].map(index => localizedParagraphs[index]), draftParagraphsSelected);
  for (const index of sourceParagraphs.keys()) {
    if (![0, 3].includes(index)) assert.equal(localizedParagraphs[index], sourceParagraphs[index], `body paragraph ${index} remains exact English`);
  }

  assert.equal(draft.title.sourceEnglish, sourceLesson.title);
  assert.equal(draft.title.xitsongaDraft, sourceLesson.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
  assert.deepEqual(draft.keyPoints.map(item => item.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(item => item.xitsongaDraft), sourceLesson.keyPoints);
  assert.ok(draft.keyPoints.every(item => item.reviewStatus === 'hold'));
  assert.equal(draft.quiz.length, sourceLesson.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const source = sourceLesson.quiz[index];
    assert.equal(question.question.sourceEnglish, source.q);
    assert.equal(question.question.xitsongaDraft, source.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.options);
    assert.deepEqual(question.options.map(option => option.xitsongaDraft), source.options);
    assert.equal(question.sourceCorrectIndex, source.correct);
    assert.equal(question.rationale.sourceEnglish, source.rationale);
    assert.equal(question.rationale.xitsongaDraft, source.rationale);
  }

  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, sourceLesson.keyPoints);
  assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
});

test('Vegetables & Staple Crops L2 keeps sowing schedules, species, instructions and quizzes exact English', () => {
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  for (const index of [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) {
    assert.equal(draftParagraphs[index], sourceParagraphs[index]);
  }
  assert.ok(draftParagraphs[2].includes('two to three weeks'));
  assert.ok(draftParagraphs[7].includes('Then two to three weeks later'));
  assert.ok(draftParagraphs[12].includes('Indigenous farming traditions in the Americas'));
  assert.ok(draftParagraphs[17].includes('Beans fix nitrogen'));
});

test('Vegetables & Staple Crops L2 keeps sowing-risk and harvest uncertainty exact English', () => {
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const localizedParagraphs = XITSONGA_VEGETABLES_STAPLES_L2_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(sourceParagraphs[4], /Separate sowings may reduce the risk/);
  assert.match(sourceParagraphs[4], /They do not guarantee a harvest if difficult conditions continue/);
  assert.equal(localizedParagraphs[4], sourceParagraphs[4]);
});

test('Vegetables & Staple Crops L2 source drift and undrafted lessons fall back to English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const changed = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(changed.status, 'english-fallback');
  assert.equal(changed.content.body, changedSource.body);

  assert.equal(resolveLearnerLessonPresentation(sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!, 'ts').status,
    'draft', 'L3 is separately source-paired in this combined batch');
  for (const lesson of sourceModule.lessons.filter(lesson => !['vegetables-staples-l2', 'vegetables-staples-l3'].includes(lesson.id))) {
    const shown = resolveLearnerLessonPresentation(lesson, 'ts');
    assert.equal(shown.status, 'english-fallback');
    assert.equal(shown.content.body, lesson.body);
  }
});
