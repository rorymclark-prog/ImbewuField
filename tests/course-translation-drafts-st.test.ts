import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-st.ts';
import { SESOTHO_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-st-seeds-sovereignty.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';

test('the Sesotho Foundation draft retains exact paired source and complete course content shape', () => {
  const source = COURSE_MODULES.find(module => module.id === SESOTHO_INTRO_PERMACULTURE_DRAFT.id);
  assert.ok(source, 'the paired draft must resolve to its exact English source module');
  const draft = SESOTHO_INTRO_PERMACULTURE_DRAFT;

  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.ok(draft.title.sesothoDraft.trim());
  assert.ok(draft.description.sesothoDraft.trim());
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string, status: 'machine-draft' | 'hold' = 'machine-draft') => {
    assert.equal(pair.sourceEnglish, english, `${path}: paired English source must match course-modules.ts byte for byte`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: machine draft must not omit this source field`);
    assert.equal(pair.reviewStatus, status, `${path}: review state must match the field decision`);
    if (status === 'hold') assert.equal(pair.sesothoDraft, english, `${path}: held guidance must remain exact English`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: draft must remain Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: placeholders must be preserved`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: numeric figures must be preserved`);
    if (status === 'machine-draft' && /\bmaize\b/i.test(english) && /\bpoone\b/i.test(pair.sesothoDraft)) {
      assert.match(pair.sesothoDraft, /\(maize\)/i, `${path}: keep the exact crop name beside its Sesotho rendering`);
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'every source lesson must be represented');

  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: source ID/order must be unchanged`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source infographic alt needs a paired draft`);
      // The replacement zones picture no longer depicts rings; its previous translated alt
      // would misdescribe the actual lesson image until a fluent speaker rewrites it.
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`,
        original.id === 'intro-permaculture-l3' ? 'hold' : 'machine-draft');
    } else {
      assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent image alt text`);
    }
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sourceEnglish.split('\n\n').length, lesson.body.sesothoDraft.split('\n\n').length,
      `${path}.body: paragraph structure must stay aligned for review`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[pointIndex], `${path}.keyPoints[${pointIndex}]`,
        original.id === 'intro-permaculture-l2' ? 'hold' : 'machine-draft');
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz question count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`,
        original.id === 'intro-permaculture-l2' ? 'hold' : 'machine-draft');
      assert.equal(question.options.length, english.options.length, `${questionPath}: option count/order must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`,
          original.id === 'intro-permaculture-l2' ? 'hold' : 'machine-draft');
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must remain unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct answer must still point to the exact English correct option`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`,
        original.id === 'intro-permaculture-l2' ? 'hold' : 'machine-draft');
    }
  }
});

test('a Sesotho learner sees the ethics concepts while water and drought examples remain exact English', () => {
  const source = COURSE_MODULES.find(module => module.id === 'intro-permaculture')?.lessons[0];
  assert.ok(source);
  const draft = SESOTHO_INTRO_PERMACULTURE_DRAFT.lessons[0];
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(draft.body.sourceEnglish, source.body);
  const englishParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, englishParagraphs.length);
  assert.notEqual(draftParagraphs[0], englishParagraphs[0], 'the first ethics explanation is a Sesotho machine draft');
  assert.ok(draftParagraphs[0].endsWith('Fair Share means taking only what you need and returning the surplus — seeds, food, water, knowledge — back into the system.'),
    'the source sentence that names water as a surplus must remain exact English');
  assert.deepEqual(draftParagraphs.slice(1), englishParagraphs.slice(1),
    'shared spring, cattle after drought, flood and action examples remain exact English');
  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.notEqual(presentation.content.title, source.title);
  const changedSource = { ...source, body: `${source.body}\n\nNew ethics example.` };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'a changed English source invalidates the whole paired draft');
});

test('Sesotho Introduction L2 drafts the general learning prompt while retaining concrete farm guidance in English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'intro-permaculture');
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'intro-permaculture-l2');
  assert.ok(source);
  const draft = SESOTHO_INTRO_PERMACULTURE_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft);

  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(draft.body.sourceEnglish, source.body);
  const sourceParagraphs = source.body.split('\n\n');
  const pairedParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(pairedParagraphs.length, sourceParagraphs.length, 'each English paragraph has one aligned review paragraph');
  assert.deepEqual(pairedParagraphs.slice(0, 2), sourceParagraphs.slice(0, 2),
    'authorship, earthworks, water, compost, irrigation, crop and hail claims remain exact English');
  assert.notEqual(pairedParagraphs[2], sourceParagraphs[2], 'the general learning prompt is proposed in Sesotho');
  draft.keyPoints.forEach((point, index) => {
    assert.equal(point.reviewStatus, 'hold');
    assert.equal(point.sesothoDraft, source.keyPoints[index]);
  });
  assert.equal(draft.quiz[0].rationale.reviewStatus, 'hold');
  assert.equal(draft.quiz[0].rationale.sourceEnglish, source.quiz[0].rationale);
  assert.equal(draft.quiz[0].rationale.sesothoDraft, source.quiz[0].rationale);
  assert.equal(draft.quiz[1].options[1].reviewStatus, 'hold');
  assert.equal(draft.quiz[1].options[1].sourceEnglish, source.quiz[1].options[1]);
  assert.equal(draft.quiz[1].options[1].sesothoDraft, source.quiz[1].options[1]);
  assert.equal(draft.quiz[1].sourceCorrectIndex, source.quiz[1].correct);

  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.equal(presentation.content.quiz[0].q, source.quiz[0].q);
  assert.deepEqual(presentation.content.quiz[0].options, source.quiz[0].options,
    'all earthworks and rainfall quiz guidance remains English');
  assert.equal(presentation.content.quiz[0].rationale, source.quiz[0].rationale);
  assert.equal(presentation.content.quiz[1].q, source.quiz[1].q);
  assert.deepEqual(presentation.content.quiz[1].options, source.quiz[1].options,
    'all poultry and edible-crop safety guidance remains English');
  assert.equal(presentation.content.quiz[1].options[source.quiz[1].correct], source.quiz[1].options[source.quiz[1].correct]);
  assert.equal(presentation.content.quiz[1].correct, source.quiz[1].correct);
  assert.equal(presentation.content.quiz[1].rationale, source.quiz[1].rationale);
  assert.deepEqual(presentation.content.keyPoints, source.keyPoints,
    'earthwork, water, crop and weather key points remain exact English');
  assert.notEqual(presentation.content.title, source.title);
});

test('Sesotho Seeds prose stays paired to English while genetics assessment remains held', () => {
  const draft = SESOTHO_SEEDS_SOVEREIGNTY_DRAFT;
  const source = COURSE_MODULES.find(module => module.id === draft.id);
  assert.ok(source);
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.deepEqual(draft.sourceMetadata, { durationMins: source.durationMins, category: source.category });
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: preserve the exact English source`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: mark review state`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: include translated copy or an explicit English hold`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.sesothoDraft, english, `${path}: a hold stays exact English`);
  };
  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.notEqual(draft.title.sesothoDraft, source.title);
  assert.notEqual(draft.description.sesothoDraft, source.description);

  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    assert.equal(lesson.id, original.id);
    checkPair(lesson.title, original.title, `${lesson.id}.title`);
    checkPair(lesson.body, original.body, `${lesson.id}.body`);
    if (lesson.id === 'seeds-sovereignty-l1') {
      assert.notEqual(lesson.body.sesothoDraft, original.body, 'translate the complete learner prose for lesson one');
      assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
        'keep the source paragraph boundaries for review');
      assert.match(lesson.body.sesothoDraft, /F1 hybrid/, 'retain the technical F1 term in the translated explanation');
    }
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${lesson.id}.infographicAlt`);
    }
    assert.equal(lesson.keyPoints.length, original.keyPoints.length);
    lesson.keyPoints.forEach((point, index) => checkPair(point, original.keyPoints[index], `${lesson.id}.keyPoints[${index}]`));
    assert.equal(lesson.quiz.length, original.quiz.length);
    lesson.quiz.forEach((question, index) => {
      const originalQuestion = original.quiz[index];
      checkPair(question.question, originalQuestion.q, `${lesson.id}.quiz[${index}].question`);
      assert.equal(question.options.length, originalQuestion.options.length);
      question.options.forEach((option, optionIndex) => checkPair(option, originalQuestion.options[optionIndex], `${lesson.id}.quiz[${index}].options[${optionIndex}]`));
      assert.equal(question.sourceCorrectIndex, originalQuestion.correct);
      checkPair(question.rationale, originalQuestion.rationale, `${lesson.id}.quiz[${index}].rationale`);
    });
  }
});

test('Sesotho Market L1 pairs the unit-preserving harvest line and keeps risky guidance held', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l1');
  assert.ok(sourceLesson);
  const draft = SESOTHO_MARKET_COMMUNITY_DRAFT;

  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.deepEqual(draft.sourceMetadata, { durationMins: sourceModule.durationMins, category: sourceModule.category });
  assert.equal(draft.title.sourceEnglish, sourceModule.title);
  assert.equal(draft.description.sourceEnglish, sourceModule.description);
  assert.equal(draft.description.sesothoDraft,
    'Ho boloka direkoto, ho rekisa dihlahiswa tse fetang tlhoko le ho aha marang-rang a dijo tsa lehae.');
  assert.equal(draft.description.reviewStatus, 'machine-draft');
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), sourceModule.lessons.map(lesson => lesson.id),
    'all Market source lessons must be represented, including the closing community lesson');

  const lesson = draft.lessons[0];
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(lesson.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = lesson.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  for (const index of [5, 8, 9, 11, 12, 13, 15, 16]) {
    assert.equal(draftParagraphs[index], sourceParagraphs[index], `held source paragraph ${index + 1} must remain exact English`);
  }
  for (const index of [0, 1, 2, 3, 4, 6, 7, 10, 14]) {
    assert.notEqual(draftParagraphs[index], sourceParagraphs[index], `selected record-keeping paragraph ${index + 1} should be a visible draft`);
  }
  assert.equal(draftParagraphs[4],
    'Ngola kilograms tsa tamati, dozens tsa mahe le bundles tsa morogo, ebe u ngola hore e nngwe le e nngwe e ile hokae.',
    'retain source units and produce names in the paired Sesotho draft');
  assert.equal(draftParagraphs[10],
    'Rekoto e boetse e bontsha dikgwedi tseo lelapa le qetellang le reka dijo ka tsona.');
  assert.equal(draftParagraphs[14],
    'Sebelisa rekoto ya hao ho fumana hore na dijo tsa lelapa di a haella neng.',
    'the household food-gap prompt is a screened draft, while crop and price decisions stay exact English');

  assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(lesson.keyPoints.slice(1).map(point => [point.sesothoDraft, point.reviewStatus]),
    sourceLesson.keyPoints.slice(1).map(point => [point, 'hold']));
  assert.equal(lesson.quiz.length, sourceLesson.quiz.length);
  lesson.quiz.forEach((question, questionIndex) => {
    const original = sourceLesson.quiz[questionIndex];
    assert.equal(question.sourceCorrectIndex, original.correct);
    assert.equal(question.question.sesothoDraft, original.q);
    assert.equal(question.question.reviewStatus, 'hold');
    assert.equal(question.rationale.sesothoDraft, original.rationale);
    assert.equal(question.options.length, original.options.length);
    question.options.forEach((option, optionIndex) => {
      assert.equal(option.sourceEnglish, original.options[optionIndex]);
      assert.equal(option.sesothoDraft, original.options[optionIndex]);
      assert.equal(option.reviewStatus, 'hold');
    });
  });

  const modulePresentation = resolveCourseModulePresentation(sourceModule, 'st');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.sesothoDraft);
  assert.equal(modulePresentation.description, draft.description.sesothoDraft);

  const presentation = resolveLearnerLessonPresentation(sourceLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, lesson.body.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints.slice(1), sourceLesson.keyPoints.slice(1));
  assert.deepEqual(presentation.content.quiz, sourceLesson.quiz);

  const changedSource = { ...sourceLesson, body: `${sourceLesson.body} ` };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(stalePresentation.status, 'english-fallback', 'changed English source must withdraw a stale review draft');
  assert.equal(stalePresentation.content.body, changedSource.body);
});

test('Sesotho Market L2 pairs screened sales concepts while uncertain advice stays English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l2');
  assert.ok(sourceLesson);
  const lesson = SESOTHO_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === sourceLesson.id);
  assert.ok(lesson);

  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = lesson.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  for (const index of [0, 4, 9]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index],
    'the screened customer, box and variable-supply concepts reach the learner');
  for (const index of [1, 2, 3, 5, 6, 7, 8, 10, 11]) assert.equal(draftParagraphs[index], sourceParagraphs[index],
    'price, legal, income and uncertain reliability advice stays exact English');
  assert.equal(lesson.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(lesson.infographicAlt?.reviewStatus, 'machine-draft');
  assert.equal(lesson.infographicAlt?.sesothoDraft,
    'Mekgwa e meraro ya ho rekisa ho tswa polasing e le nngwe: setala se pela tsela, thomelo ya sehlopha lebenkeleng, le lebokose le yang ka kotloloho lapeng.');
  assert.equal(lesson.title.reviewStatus, 'hold');
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.equal(lesson.keyPoints[1].reviewStatus, 'machine-draft');
  assert.equal(lesson.keyPoints[1].sesothoDraft, 'Bapisa ditshenyehelo le ditahlehelo mmoho le theko ya thekiso');
  for (const index of [0, 2, 3]) {
    assert.equal(lesson.keyPoints[index].reviewStatus, 'hold');
    assert.equal(lesson.keyPoints[index].sesothoDraft, sourceLesson.keyPoints[index]);
  }

  const presentation = resolveLearnerLessonPresentation(sourceLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.keyPoints[1], lesson.keyPoints[1].sesothoDraft);
  assert.equal(presentation.content.keyPoints[0], sourceLesson.keyPoints[0]);
  assert.equal(presentation.content.keyPoints[2], sourceLesson.keyPoints[2]);
  assert.equal(presentation.content.infographicAlt, lesson.infographicAlt?.sesothoDraft);
  assert.equal(presentation.content.body, lesson.body.sesothoDraft);
  assert.deepEqual(presentation.content.quiz, sourceLesson.quiz);

  const changedSource = {
    ...sourceLesson,
    keyPoints: sourceLesson.keyPoints.map((point, index) => index === 1 ? `${point} ` : point),
  };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 'st');
  assert.equal(stalePresentation.status, 'english-fallback');
  assert.deepEqual(stalePresentation.content.keyPoints, changedSource.keyPoints);

  const changedAltSource = { ...sourceLesson, infographicAlt: `${sourceLesson.infographicAlt} ` };
  const staleAltPresentation = resolveLearnerLessonPresentation(changedAltSource, 'st');
  assert.equal(staleAltPresentation.status, 'english-fallback');
  assert.equal(staleAltPresentation.content.infographicAlt, changedAltSource.infographicAlt);
});
