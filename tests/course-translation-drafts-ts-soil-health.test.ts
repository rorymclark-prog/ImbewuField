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

test('Soil Health L1 pairs observations while jar procedure and diagnosis stay exact English', () => {
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
  for (const index of [3, 4, 5, 6, 9, 10, 11]) {
    assert.equal(candidateParagraphs[index], sourceParagraphs[index],
      `paragraph ${index + 1}: jar procedure, interpretation limits and diagnostic cause stay exact English`);
  }
  for (const index of [2, 7, 8]) {
    assert.notEqual(candidateParagraphs[index], sourceParagraphs[index],
      `paragraph ${index + 1}: screened observation is visible beside exact English`);
  }

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

test('Soil Health L2 stays English while L3 exposes only the screened seasonal risk draft', () => {
  const l2 = sourceModule.lessons[1];
  const l2Shown = resolveLearnerLessonPresentation(l2, 'ts');
  assert.equal(l2Shown.status, 'english-fallback');
  assert.equal(l2Shown.content.body, l2.body);

  const source = sourceModule.lessons[2];
  const draft = XITSONGA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the paired L3 draft must be present without adding L2');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const english = source.body.split('\n\n');
  const localized = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(localized.length, english.length);
  assert.deepEqual(localized.slice(0, 9), english.slice(0, 9));
  assert.deepEqual(localized.slice(9, 12), [
    'Nsimu ya Highveld leyi tshikiweke yi nga funengetiwangi endzhaku ka ntshovelo wa maize yi langutana ni makhombo mambirhi lamakulu.',
    'Mheho wa xixika wu nga susa misava ya le henhla leyi omeke.',
    'Xidzedze xo sungula xo tika xa ximun’wana xi nga hlasela misava leyi nga funengetiwangi, xi onha vuandlalo ni xivumbeko xa yona. Loko mati ma khuluka ehenhla ka nsimu, ma nga teka misava leyi ntshunxekeke ma famba na yona.',
  ]);
  assert.equal(localized[12], english[12]);

  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, source.keyPoints);
  assert.deepEqual(shown.content.quiz.map(question => question.correct), source.quiz.map(question => question.correct));
  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    assert.equal(question.question.sourceEnglish, source.quiz[index].q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.quiz[index].options);
    assert.equal(question.sourceCorrectIndex, source.quiz[index].correct);
    assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
  });
  const changedSource = { ...source, body: source.body.replace('Winter wind', 'Cold wind') };
  const changedShown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(changedShown.status, 'english-fallback');
  assert.equal(changedShown.content.body, changedSource.body);
});

test('Soil Health source drift falls back to exact English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);
});
