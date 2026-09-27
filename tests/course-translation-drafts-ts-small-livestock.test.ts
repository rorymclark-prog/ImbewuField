import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-ts-small-livestock.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'small-livestock')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'small-livestock-l2')!;
const draftedSentences = [
  'Swimilani swo hambana na ti-variety to hambana swi na swilaveko swo hambana swa pollination.',
  "Hive a yi tiyisisi leswaku yields ti ta va ta le henhla hinkwako: weather, mati, rihanyu ra swimilani na pollinators tin'wana na tona i swa nkoka.",
];

test('Small Livestock L2 exposes only the two source-paired Xitsonga concept sentences', () => {
  const draft = XITSONGA_SMALL_LIVESTOCK_DRAFT.lessons[0];
  assert.equal(XITSONGA_SMALL_LIVESTOCK_DRAFT.id, sourceModule.id);
  assert.equal(XITSONGA_SMALL_LIVESTOCK_DRAFT.language, 'ts');
  assert.equal(XITSONGA_SMALL_LIVESTOCK_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(draft.id, sourceLesson.id);
  assert.equal(draft.title.sourceEnglish, sourceLesson.title);
  assert.equal(draft.title.xitsongaDraft, sourceLesson.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
  assert.equal(draft.body.sourceEnglish, sourceLesson.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const candidateParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(candidateParagraphs.length, sourceParagraphs.length);
  const sourceSentences = sourceParagraphs[0].split(/(?<=\.) /);
  assert.equal(sourceSentences.length, 4);
  assert.deepEqual(candidateParagraphs[0].split(/(?<=\.) /), [sourceSentences[0], sourceSentences[1], ...draftedSentences]);
  assert.deepEqual(candidateParagraphs.slice(1), sourceParagraphs.slice(1),
    'bee species, geography, movement rules, safety, regulation and all other instructions remain exact English');

  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(point => point.xitsongaDraft), sourceLesson.keyPoints);
  assert.ok(draft.keyPoints.every(point => point.reviewStatus === 'hold'));
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
    assert.ok(question.options.every(option => option.reviewStatus === 'hold'));
  }

  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, sourceLesson.keyPoints);
  assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
});

test('Small Livestock L2 source drift and other lessons stay English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);

  for (const lesson of sourceModule.lessons.filter(lesson => lesson.id !== sourceLesson.id)) {
    const other = resolveLearnerLessonPresentation(lesson, 'ts');
    assert.equal(other.status, 'english-fallback');
    assert.equal(other.content.body, lesson.body);
  }
});

test('Small Livestock L2 explicitly retains all scope and factor terms in the draft', () => {
  const paragraph = XITSONGA_SMALL_LIVESTOCK_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n')[0];
  assert.match(paragraph, /Swimilani swo hambana na ti-variety to hambana/);
  assert.match(paragraph, /pollination/);
  assert.match(paragraph, /a yi tiyisisi/);
  assert.match(paragraph, /yields ti ta va ta le henhla hinkwako/);
  for (const factor of ['weather', 'mati', 'rihanyu ra swimilani', "pollinators tin'wana"]) assert.ok(paragraph.includes(factor));
  assert.ok(XITSONGA_SMALL_LIVESTOCK_DRAFT.holds.some(hold => hold.field === 'body[1]'));
  assert.ok(XITSONGA_SMALL_LIVESTOCK_DRAFT.holds.some(hold => hold.field === 'body[2]'));
});
