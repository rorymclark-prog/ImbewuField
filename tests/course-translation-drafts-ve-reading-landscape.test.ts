import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import type { Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { TSHIVENDA_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-ve-small-livestock.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { TSHIVENDA_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-ve-seeds-sovereignty.ts';
import { assertKeeps, checkAnimalNames, checkCompleteModuleDraft, FORBIDDEN_WORDS, sourceDraftPairs } from './regional-full-draft-checks.ts';

test('Tshivenda Seeds drafts every lesson field, keeps English genetics terms and leaves quiz answers unchanged', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'seeds-sovereignty');
  assert.ok(sourceModule);
  // 2 October 2026: lessons 2 and 3, the key points and the quizzes were exact English until now. The complete
  // edition is a labelled machine draft beside its exact English source; each passage had a blind
  // back-translation and an independent semantic check. Correct-answer indices stay canonical.
  checkCompleteModuleDraft(sourceModule, TSHIVENDA_SEEDS_SOVEREIGNTY_DRAFT, 've', FORBIDDEN_WORDS.ve);
  const shown = resolveLearnerLessonPresentation(sourceModule.lessons[0], 've');
  for (const term of ['open-pollinated', 'stable variety', 'F1 hybrid', 'pollination']) {
    assert.ok(shown.content.body.includes(term), `${term} stays English inside the translated sentence`);
  }
  assertKeeps(TSHIVENDA_SEEDS_SOVEREIGNTY_DRAFT.lessons[2].body.tshivendaDraft.split('\n\n')[1],
    ['yo omaho', 'yo valiwaho', 'ho rotholaho', 'swiswi'], 'storage keeps dry seed in a sealed container, cool and dark');
});

test('Tshivenda Market lesson drafts retain exact English guidance around short descriptive drafts', () => {
  const market = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(market);
  assert.deepEqual(TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.map(lesson => lesson.id),
    ['market-community-l1', 'market-community-l3', 'market-community-l2']);
  for (const lessonId of ['market-community-l1', 'market-community-l3']) {
    const source: Lesson | undefined = market.lessons.find(lesson => lesson.id === lessonId);
    const draft = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(lesson => lesson.id === lessonId);
    assert.ok(source);
    assert.ok(draft);
    assert.equal(draft.title.sourceEnglish, source.title);
    assert.equal(draft.body.sourceEnglish, source.body);
    assert.equal(draft.body.reviewStatus, 'machine-draft');
    assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
    assert.deepEqual(draft.keyPoints.map(point => point.tshivendaDraft), source.keyPoints);
    assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
    const shown = resolveLearnerLessonPresentation(source, 've');
    assert.equal(shown.status, 'draft');
    assert.deepEqual(shown.content.quiz, source.quiz);
    assert.deepEqual(shown.content.keyPoints, source.keyPoints);
    const originalParagraphs: string[] = source.body.split('\n\n');
    const shownParagraphs: string[] = shown.content.body.split('\n\n');
    assert.equal(shownParagraphs.length, originalParagraphs.length);
    const translatedIndices = lessonId === 'market-community-l1' ? [0, 1, 3, 4, 6, 10, 14] : [3, 4, 5, 9];
    for (const [index, paragraph] of originalParagraphs.entries()) {
      if (translatedIndices.includes(index)) assert.notEqual(shownParagraphs[index], paragraph);
      else assert.equal(shownParagraphs[index], paragraph);
    }
    if (lessonId === 'market-community-l1') {
      const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
      assert.equal(shownParagraphs[0], draftParagraphs[0],
        'select the Tshivenda source-paired learner draft');
      assert.equal(shownParagraphs[3], draftParagraphs[3],
        'select the source-paired sentence about recording each harvest as it happens');
      assert.equal(shownParagraphs[6], draftParagraphs[6],
        'select the source-paired end-of-season memory reminder');
      assert.equal(shownParagraphs[1], draftParagraphs[1],
        'show the paired sentence about recording uses and what reaches customers');
      assert.equal(shownParagraphs[7], originalParagraphs[7],
        'keep the phrase about practical questions in English until reviewed');
      assert.equal(shownParagraphs[4],
        'Ṅwalani kilograms dza matamatisi, dozens dza makumba, na bundles dza morogo; ni dovhe ni ṅwale uri tshiṅwe na tshiṅwe tsho ya ngafhi.',
        'keep unit labels and morogo exact while recording where each item went');
      assert.equal(shownParagraphs[5],
        originalParagraphs[5],
        'keep the compost destination exact until its meaning is confirmed');
      assert.equal(shownParagraphs[10],
        'Rekhodo i dovha ya sumbedza miṅwedzi ine muṱa wa renga zwiḽiwa.',
        'state only which months the household buys food');
      assert.equal(shownParagraphs[14], 'Shumisani rekhodo yaṋu u wana tshifhinga tshine zwiḽiwa zwa muṱa zwa vha zwi siho nga ho eḓanaho.',
        'the household food-gap prompt is screened while crop and price decisions stay in English');
      assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), market.lessons[0].keyPoints);
      assert.ok(draft.keyPoints.every(point => point.reviewStatus === 'hold' && point.tshivendaDraft === point.sourceEnglish),
        'cash, cost, price and local crop timing key points remain exact English');
    }
    assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} Changed.` }, 've').status,
      'english-fallback');
  }
});

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
    if (original.id === 'reading-landscape-l3') {
      assert.equal(lesson.body.reviewStatus, 'machine-draft');
      const sourceParagraphs = original.body.split('\n\n');
      const draftParagraphs = lesson.body.tshivendaDraft.split('\n\n');
      assert.equal(draftParagraphs[0], sourceParagraphs[0]
        .replace('Walk the land on windy days.', 'Tshimbilani kha shango nga maḓuvha a re na muya.')
        .replace('Record where the wind comes from and what it affects.', 'Ṅwalani hune muya wa bva hone na zwine wa kwama.'),
      'only the checked wind-observation sentences change');
      assert.equal(draftParagraphs[1], sourceParagraphs[1]
        .replace('On a clear, still night, cold air can flow downhill and collect in low places.',
          'Vhusiku vhu sa na makole, hu si na muya, muya wo rotholaho u nga elela u tshi ya fhasi ha kuvhangana fhethu ho tsaho.'),
      'preserve the earlier cold-air draft and all adjoining frost guidance');
      assert.deepEqual(draftParagraphs.slice(2), sourceParagraphs.slice(2),
        'keep frost identification and late-blight guidance exact English');
      assert.equal(resolveLearnerLessonPresentation({ ...original, body: `${original.body} changed` }, 've').status,
        'english-fallback', 'changed source wording withdraws the whole paired learner draft');
    }
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
    'lessons[0] reading-landscape-l1.keyPoints[1]',
    'lessons[0] reading-landscape-l1.quiz[0].options[0]',
    'lessons[0] reading-landscape-l1.quiz[0].options[2]',
    'lessons[0] reading-landscape-l1.quiz[0].rationale',
    'lessons[1] reading-landscape-l2.keyPoints[1]',
    'lessons[2] reading-landscape-l3.keyPoints[1]',
    'lessons[2] reading-landscape-l3.quiz[0].rationale',
    'lessons[2] reading-landscape-l3.quiz[1].rationale',
    'lessons[3] reading-landscape-l4.keyPoints[2]',
    'lessons[3] reading-landscape-l4.quiz[1].options[1]',
  ], 'uncertain wording stays held until checked by a fluent Tshivenda speaker');

  const waterEnglish = source.lessons[0].body.split('\n\n');
  const waterDraft = draft.lessons[0].body.tshivendaDraft.split('\n\n');
  assert.equal(waterDraft[1], waterEnglish[1], 'all A-frame and earthworks guidance stays exact English');
  for (const sentence of [
    'When it is safe afterward, walk your land.',
    'Look for rills, places where water fans out, where it ponds, and where it leaves your property.',
    'Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much.',
  ]) assert.ok(draft.lessons[0].body.tshivendaDraft.includes(sentence), `held site guidance stays exact English: ${sentence}`);
  assert.equal(draft.lessons[1].keyPoints[1].reviewStatus, 'hold', 'winter-sun position stays English');
});

test('Tshivenda Small Livestock drafts the module card and every lesson, with animal names checked separately', () => {
  const source = COURSE_MODULES.find(module => module.id === 'small-livestock');
  assert.ok(source, 'the canonical Small Livestock module must exist');
  const draft = TSHIVENDA_SMALL_LIVESTOCK_DRAFT;
  // 2 October 2026: the English title hold and the unwired lesson candidates give way to a complete edition.
  // Each passage had a blind back-translation and an independent semantic check, and animal names were
  // checked on their own because an earlier draft confused ducks with frogs.
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  checkCompleteModuleDraft(source, draft, 've', FORBIDDEN_WORDS.ve);
  assert.ok(checkAnimalNames(sourceDraftPairs(draft, 've'), 've', 'Tshivenda Small Livestock') >= 30);
  assert.ok(draft.description.tshivendaDraft.includes('dakisi (ducks)'), 'the duck name is glossed on the module card');
  const body = (lesson: number, paragraph: number) => draft.lessons[lesson].body.tshivendaDraft.split('\n\n')[paragraph];
  assertKeeps(body(0, 0), ['a hu dzhii fhethu'], 'foraging does not replace a balanced diet or daily care');
  assertKeeps(body(0, 1), ['phanḓa ha uri'], 'move the pen before the ground is bare, muddy or covered in manure');
  assertKeeps(body(0, 2), ['Manure ntswa i nga vha na germs', 'phanḓa ha zwilimiwa zwi tevhelaho'],
    'fresh manure can carry germs; ask about safe handling before the next crop');
  assertKeeps(body(2, 0), ['zwo fhelelaho phanḓa ha u i shumisa'], 'compost manure fully before using it near food crops');
  assertKeeps(body(2, 1), ['Ni songo ḓitika'], 'do not rely on guinea fowl for tick protection');
  assertKeeps(body(2, 3), ['a si nḓila yo khwaṱhisedzwaho', 'Ni songo litsha u alafha'],
    'chickens are not proven goat worm control; do not stop treatment');
  assert.equal(resolveCourseModulePresentation({ ...source, durationMins: source.durationMins + 1 }, 've').status,
    'english-fallback', 'changed module metadata withdraws the paired draft');
});

test('Tshivenda Market L2 pairs bounded customer text and holds uncertain terms in English', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l2');
  assert.ok(sourceLesson);
  const lesson = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === sourceLesson.id);
  assert.ok(lesson);

  assert.equal(lesson.id, sourceLesson.id);
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(lesson.title.reviewStatus, 'hold');
  assert.equal(lesson.title.tshivendaDraft, sourceLesson.title);
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = lesson.body.tshivendaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  for (const index of [0, 6]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index]);
  for (const index of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) assert.equal(draftParagraphs[index], sourceParagraphs[index],
    'price, box promises and uncertain delivery wording stay exact English');
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
  assert.equal(presentation.content.body, lesson.body.tshivendaDraft);
  assert.deepEqual(presentation.content.quiz, sourceLesson.quiz);

  const changedSource = {
    ...sourceLesson,
    keyPoints: sourceLesson.keyPoints.map((point, index) => index === 1 ? `${point} ` : point),
  };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 've');
  assert.equal(stalePresentation.status, 'english-fallback');
  assert.deepEqual(stalePresentation.content.keyPoints, changedSource.keyPoints);
});
