import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'soil-health')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l1')!;
const selectedParagraphs = [
  'Misava yi na tinxaka to tala ta swilo leswi hanyaka. Bacteria and fungi help break down organic matter and cycle nutrients.',
  "Fungi tin'wana ti pfuna timitsu ku tswonga nutrients. Worm channels ti nga pfuna mati na moya ku nghena emhlabeni.",
];

test('Soil Health L1 shows only source-paired concept sentences as an unreviewed Xitsonga draft', () => {
  const draft = XITSONGA_SOIL_HEALTH_DRAFT.lessons[0];
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.id, sourceModule.id);
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.language, 'ts');
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.reviewStatus, 'machine-draft');
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
  assert.deepEqual(candidateParagraphs.slice(0, 2), selectedParagraphs);
  assert.deepEqual(candidateParagraphs.slice(2), sourceParagraphs.slice(2),
    'all soil observation, jar-test interpretation, uncertainty and remedy advice stays exact English');

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

test('Soil Health L1 keeps technical terms and unreviewed soil claims exact English', () => {
  const paragraphs = XITSONGA_SOIL_HEALTH_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(paragraphs[0], /Bacteria and fungi help break down organic matter and cycle nutrients\./);
  assert.match(paragraphs[1], /Fungi tin'wana.*nutrients/);
  assert.match(paragraphs[1], /Worm channels/);
  assert.equal(paragraphs[0].startsWith('Soil contains many kinds of living organisms.'), false);
  assert.ok(XITSONGA_SOIL_HEALTH_DRAFT.holds.some(item => item.sourceText === 'Bacteria and fungi help break down organic matter and cycle nutrients.'));
  assert.ok(XITSONGA_SOIL_HEALTH_DRAFT.holds.some(item => item.sourceText === sourceParagraphsForHold()[3]));
});

function sourceParagraphsForHold(): string[] {
  return sourceLesson.body.split('\n\n');
}

test('Soil Health lessons 2 and 3 stay exact English until separately reviewed', () => {
  for (const lesson of sourceModule.lessons.slice(1)) {
    const shown = resolveLearnerLessonPresentation(lesson, 'ts');
    assert.equal(shown.status, 'english-fallback');
    assert.equal(shown.content.body, lesson.body);
  }
});

test('Soil Health source drift falls back to exact English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);
});
