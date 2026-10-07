import { mapNativeBefore } from './reading-map-comparisons-history-checks.ts';
import { checkMarketPriceQuestion } from './market-l1-completion-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import type { Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation as nativeResolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { TSHIVENDA_SMALL_LIVESTOCK_DRAFT } from '../lib/course-translation-drafts-ve-small-livestock.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT as NATIVE_TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { TSHIVENDA_SEEDS_SOVEREIGNTY_DRAFT } from '../lib/course-translation-drafts-ve-seeds-sovereignty.ts';
import { assertKeeps, checkAnimalNames, checkCompleteModuleDraft, FORBIDDEN_WORDS, sourceDraftPairs } from './regional-full-draft-checks.ts';

import { reconstructMarketBeforeL2L3Completion, reconstructMarketPresentationBeforeCompletion } from './market-l2-l3-completion-checks.ts';

const resolveLearnerLessonPresentation = reconstructMarketPresentationBeforeCompletion;
// 2026-10-05: keep this historical batch's claims; source-bound reconstruction
// validates accepted final targets before reversing only the later 36 field changes.
const TSHIVENDA_MARKET_COMMUNITY_DRAFT = reconstructMarketBeforeL2L3Completion(NATIVE_TSHIVENDA_MARKET_COMMUNITY_DRAFT, 've');

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

test('Tshivenda Market drafts keep exact sources, numeric premises and answer safeguards', () => {
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
    assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
    for (const point of draft.keyPoints) {
      assert.ok(['hold', 'machine-draft'].includes(point.reviewStatus));
      if (point.reviewStatus === 'hold') assert.equal(point.tshivendaDraft, point.sourceEnglish,
        'remaining holds must be exact English, not unmarked translations');
    }
    assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
    const shown = resolveLearnerLessonPresentation(source, 've');
    assert.equal(shown.status, 'draft');
    // The price question now localizes its question tail; its numerical premise stays exact.
    assert.deepEqual(shown.content.quiz, ['market-community-l1', 'market-community-l3'].includes(lessonId) ? source.quiz.map((question, index) => ({
      q: draft.quiz[index].question.tshivendaDraft,
      options: draft.quiz[index].options.map(pair => pair.tshivendaDraft),
      correct: question.correct,
      rationale: draft.quiz[index].rationale.tshivendaDraft,
    })) : source.quiz);
    assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(pair => pair.tshivendaDraft));
    const originalParagraphs: string[] = source.body.split('\n\n');
    const shownParagraphs: string[] = shown.content.body.split('\n\n');
    assert.equal(shownParagraphs.length, originalParagraphs.length);
    // Checked household and community framing is now drafted; source-bound seed and advice holds stay exact.
    const translatedIndices = lessonId === 'market-community-l1' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (const [index, paragraph] of originalParagraphs.entries()) {
      if (translatedIndices.includes(index)) assert.notEqual(shownParagraphs[index], paragraph);
      else assert.equal(shownParagraphs[index], paragraph);
    }
    if (lessonId === 'market-community-l1') {
      assert.deepEqual(draft.keyPoints.map(point => point.reviewStatus),
        ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft'],
        'the record/cash wording is now drafted while its exact English categories remain embedded');
      const priceQuestion = draft.quiz[0];
      assert.equal(priceQuestion.sourceCorrectIndex, 2);
      assert.equal(priceQuestion.question.reviewStatus, 'machine-draft');
      checkMarketPriceQuestion('ve', priceQuestion.question.tshivendaDraft);
      assert.deepEqual(priceQuestion.options.map(option => option.sourceEnglish), source.quiz[0].options);
      assert.ok(priceQuestion.options.every(option => option.reviewStatus === 'machine-draft'));
      assert.ok(priceQuestion.options[2].tshivendaDraft.includes('tshi nga netshedza return i khwine'),
        'the correct answer still compares another crop conditionally rather than promising a better return');
      assert.ok(priceQuestion.rationale.tshivendaDraft.includes('fhasi ha cost') &&
        priceQuestion.rationale.tshivendaDraft.includes('ni sa athu dzhia tsheo'),
      'cost comparison and review before the next production decision remain explicit');

      const gapQuestion = draft.quiz[1];
      const gapSource = source.quiz[1];
      assert.equal(gapQuestion.sourceCorrectIndex, 1);
      assert.equal(gapQuestion.question.sourceEnglish, gapSource.q);
      assert.equal(gapQuestion.question.reviewStatus, 'machine-draft');
      assert.ok(gapQuestion.question.tshivendaDraft.includes('June na July ṅwaha muṅwe na muṅwe'),
        'the repeated June/July household shortage remains exact');
      assert.deepEqual(gapQuestion.options.map(option => option.sourceEnglish), gapSource.options,
        'the translated choices retain the exact source order');
      assert.equal(gapQuestion.options[1].reviewStatus, 'machine-draft');
      assert.ok(gapQuestion.options[1].tshivendaDraft.startsWith('Pulani ni tshi humela murahu u bva kha tshikhala tsha zwiḽiwa'),
        'the keyed answer still works backwards from the food gap');
      for (const technicalAnchor of ['zwimela zwi fanelaho vhupo ha henefho', 'tshifhinga tshazwo tsha u kaṋa']) {
        assert.ok(gapQuestion.options[1].tshivendaDraft.includes(technicalAnchor),
          `the keyed answer retains the source-bound ${technicalAnchor} condition`);
      }
      assert.equal(gapQuestion.sourceCorrectIndex, 1,
        'the localized correct choice stays at its original answer index');
      assert.ok(gapQuestion.rationale.tshivendaDraft.includes('zwimela') &&
        gapQuestion.rationale.tshivendaDraft.includes('maḓuvha a u zwala') &&
        gapQuestion.rationale.tshivendaDraft.includes('maḓi') &&
        gapQuestion.rationale.tshivendaDraft.includes('tshifhinga tsho lavhelelwaho tsha u kaṋa'),
        'the rationale retains crop choice, sowing dates, water and expected harvest time');
      assert.deepEqual(gapQuestion.options.map(option => option.reviewStatus), ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft']);
      const changedQuestion = { ...source, quiz: source.quiz.map((question, index) => index === 1
        ? { ...question, q: `${question.q} Changed timing.` }
        : question) };
      const staleAssessment = resolveLearnerLessonPresentation(changedQuestion, 've');
      assert.equal(staleAssessment.status, 'english-fallback', 'changed seasonal question source withdraws its paired lesson draft');
      assert.deepEqual(staleAssessment.content.quiz, changedQuestion.quiz);
      const draftParagraphs = draft.body.tshivendaDraft.split('\n\n');
      assert.equal(shownParagraphs[0], draftParagraphs[0],
        'select the Tshivenda source-paired learner draft');
      assert.equal(shownParagraphs[3], draftParagraphs[3],
        'select the source-paired sentence about recording each harvest as it happens');
      assert.equal(shownParagraphs[6], draftParagraphs[6],
        'select the source-paired end-of-season memory reminder');
      assert.equal(shownParagraphs[1], draftParagraphs[1],
        'show the paired sentence about recording uses and what reaches customers');
      assert.equal(shownParagraphs[7], 'Rekhodo dza khalanwaha nthihi dzi fhindula mbudziso dzine dza thusa.',
        'the ordinary practical-questions sentence is now a Tshivenda draft paired with its English source');
      assert.equal(shownParagraphs[4],
        'Ṅwalani kilograms dza matamatisi, dozens dza makumba, na bundles dza morogo; ni dovhe ni ṅwale uri tshiṅwe na tshiṅwe tsho ya ngafhi.',
        'keep unit labels and morogo exact while recording where each item went');
      assertKeeps(shownParagraphs[5], ['hayani', 'rengiswaho', 'mpho', 'compost'],
        'the four destinations stay distinct after localizing the old English category labels');
      assert.equal(shownParagraphs[10],
        'Rekhodo i dovha ya sumbedza miṅwedzi ine muṱa wa renga zwiḽiwa.',
        'state only which months the household buys food');
      assert.equal(shownParagraphs[14], 'Shumisani rekhodo yaṋu u wana tshifhinga tshine zwiḽiwa zwa muṱa zwa vha zwi siho nga ho eḓanaho.',
        'the household food-gap prompt is screened while crop and price decisions stay in English');
      assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), market.lessons[0].keyPoints);
      assert.ok(draft.keyPoints[1].tshivendaDraft.includes('masheleni a u bveledza na u rengisa'),
        'the price assessment still includes both production and selling costs');
      assert.ok(draft.keyPoints[2].tshivendaDraft.includes('costs dzaṋu dza vhukuma'),
        'decisions must use actual costs rather than the teaching example');
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
      assert.equal(lesson.body.reviewStatus, 'machine-draft', `${path}.body: candidate remains visibly unreviewed`);
      const sourceParagraphs = original.body.split('\n\n');
      const draftParagraphs = lesson.body.tshivendaDraft.split('\n\n');
      assert.equal(draftParagraphs.length, 4, `${path}.body: preserve all four source paragraphs`);
      assert.ok(draftParagraphs[0].includes('Tshimbilani') && draftParagraphs[0].includes('nga maḓuvha a re na muya'),
        `${path}.body: retain the windy-day land-walk instruction`);
      assert.ok(draftParagraphs[0].includes('Ṅwalani hune muya wa bva hone') && draftParagraphs[0].includes('zwine wa kwama'),
        `${path}.body: preserve the existing wind-observation sentence`);
      assert.ok(draftParagraphs[0].startsWith('Muya u nga tshinyadza zwimela kha shamba ḽiṱuku.'),
        `${path}.body: translate the ordinary wind/crop framing while preserving smallholding scale`);
      // The later reviewed ownership phrase localizes ordinary site framing while retaining both landform terms.
      assert.ok(draftParagraphs[0].includes("dzi-ridges and gaps dza tshitentsi tshaṋu"),
        `${path}.body: preserve both landforms and ownership without changing land to soil`);
      assert.ok(draftParagraphs[0].includes('Sedzani rekhodo dza mutsho wa henefho') &&
        draftParagraphs[0].includes('musi ni sa athu dzhia tsheo ya hune tsireledzo ya ṱoḓea hone'),
        `${path}.body: localize the checking verb while retaining local records and the before-deciding-shelter condition`);
      assert.ok(draftParagraphs[1].startsWith(
        'Vhusiku vhu sa na makole, hu si na muya, muya wo rotholaho u nga elela u tshi ya fhasi ha kuvhangana fhethu ho tsaho. Fhethu afho hu nga rothola u fhira u sendama ha mavu ha tsini.'),
        `${path}.body: preserve the clear/still-night condition and can-be-colder comparison`);
      assert.ok(draftParagraphs[1].includes('Maitele a frost na one a ya nga fhethu') &&
        draftParagraphs[1].includes('Vhambedzani fhethu hune ha nga nangiwa hone kha khalaṅwaha yoṱhe ya tshando ya henefho.') &&
        draftParagraphs[1].includes('Ṱolani rekhodo dza minimum temperatures dza henefho hune dza wanala hone.') &&
        draftParagraphs[1].includes('Arali dzi sa wanali, bvelani phanḓa ni tshi sedza nga vhusiku vhu rotholaho') &&
        draftParagraphs[1].includes('mueletshedzi wa zwa vhulimi wa henefho musi ni sa athu nanga fhethu ha tshifhinga tshilapfu ha tender seedlings.'),
        `${path}.body: retain the full-season comparison, no-record fallback, cold-night observation and adviser-before-permanent-placement condition`);
      assert.ok(draftParagraphs[2].startsWith(
        'Frost ndi ice ine ya vhumbwa kha surface yo rotholaho. Mist fhedzi a i sumbedzi uri ice yo vhumbwa, nahone frost damage i nga itea hu si na ice ine ya vhonala.'),
        `${path}.body: localize ordinary definition/negative framing while retaining the physical definition, mist limitation and no-visible-ice damage condition`);
      assert.ok(draftParagraphs[2].includes('Sedzani ice na u tshinyala ha zwimela'));
      assert.ok(draftParagraphs[2].includes('fhethu hu re fhasi na u sendama ha mavu'),
        `${path}.body: translate the low-ground versus slope comparison without reversing it`);
      assert.ok(draftParagraphs[2].includes('minimum temperatures hune zwa konadzea'),
        `${path}.body: preserve the minimum-temperature check and where-possible condition`);
      assert.ok(draftParagraphs[2].includes('tshilapfusesa'),
        `${path}.body: the field comparison still marks where cold or damage lasts longest`);
      assert.ok(draftParagraphs[2].includes('Vhetshelani zwimela zwi sa konḓeleliho kule na cold pockets dzine na dzi vhona'),
        `${path}.body: retain the keep-away instruction and localize the observed-pocket qualifier`);
      assert.ok(draftParagraphs[0].startsWith('Muya u nga tshinyadza zwimela kha shamba ḽiṱuku.'), `${path}.body: preserve the neighboring wind paragraph`);
      assert.ok(draftParagraphs[3].startsWith('Kha matamatisi a re na thaidzo ya late blight,'), `${path}.body: preserve the neighboring late-blight paragraph`);
      assert.ok(draftParagraphs[3].includes('zwi nga thusa uri maṱari a ome'),
        `${path}.body: retain affected-tomato framing and can-help drying modality`);
      assert.ok(draftParagraphs[3].includes('Late blight i nga bvela phanḓa u phaḓalala') &&
        draftParagraphs[3].toLowerCase().includes('u sudzisa bed fhedzi a zwi nga i langi') &&
        draftParagraphs[3].includes('nyeletshedzo ya mutakalo wa zwimela ya henefho'),
        `${path}.body: keep disease-spread conditions and no-control-alone/local-advice guidance exact`);
      const drifted = {
        ...original,
        body: original.body.replace('Mark places where cold or damage lasts longest.',
          'Mark places where cold or damage lasts briefly.'),
      };
      assert.notEqual(drifted.body, original.body, `${path}.body: drift fixture must change the comparative source`);
      const fallback = resolveLearnerLessonPresentation(drifted, 've');
      assert.equal(fallback.status, 'english-fallback', `${path}.body: changed frost comparison withdraws the paired draft`);
      assert.equal(fallback.content.body, drifted.body, `${path}.body: show the exact current source after drift`);
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
  // Ordinary shade/drying/soil-check framing is now independently checked and source-paired;
  // precise technical clauses remain English and are checked separately below.
  assert.deepEqual(holds, [
    'lessons[0] reading-landscape-l1.quiz[0].options[0]',
  ], 'only the vertical measurement option remains a whole-field exact-English hold; other checked clauses are mixed drafts');

  const aFrameSuitability = draft.lessons[0].keyPoints[1];
  assert.equal(aFrameSuitability.sourceEnglish, source.lessons[0].keyPoints[1]);
  assert.equal(aFrameSuitability.reviewStatus, 'machine-draft');
  assert.ok(aFrameSuitability.tshivendaDraft.includes('points at the same height') &&
    aFrameSuitability.tshivendaDraft.includes('a i sumbedzi arali earthworks dzi tshi tea'),
  'ordinary A-frame framing is drafted while equal-height and site-suitability limits stay exact');
  assert.doesNotMatch(aFrameSuitability.tshivendaDraft, /earthworks should/i,
    'marking equal-height points must not become an instruction to build earthworks');

  const seasonalWindOption = draft.lessons[3].quiz[1].options[1];
  assert.equal(seasonalWindOption.sourceEnglish, source.lessons[3].quiz[1].options[1]);
  assert.equal(draft.lessons[3].quiz[1].sourceCorrectIndex, source.lessons[3].quiz[1].correct);
  assert.equal(seasonalWindOption.reviewStatus, 'machine-draft');
  assert.ok(seasonalWindOption.tshivendaDraft.includes('zwa shandula hune windbreaks') &&
    seasonalWindOption.tshivendaDraft.includes('zwa fanela u vhewa hone'),
    'the different-directions consequence remains attached to its original quiz option');

  const landscapeL1Source = source.lessons.find(lesson => lesson.id === 'reading-landscape-l1');
  const landscapeL1Draft = draft.lessons.find(lesson => lesson.id === 'reading-landscape-l1');
  const landscapeL2Source = source.lessons.find(lesson => lesson.id === 'reading-landscape-l2');
  const landscapeL2Draft = draft.lessons.find(lesson => lesson.id === 'reading-landscape-l2');
  assert.ok(landscapeL1Source && landscapeL1Draft && landscapeL2Source && landscapeL2Draft);
  assert.equal(landscapeL1Draft.body.sourceEnglish, landscapeL1Source.body);
  assert.equal(landscapeL1Draft.body.reviewStatus, 'machine-draft');
  const l1Quiz0 = landscapeL1Draft.quiz[0];
  const l1Quiz0Source = landscapeL1Source.quiz[0];
  assert.equal(l1Quiz0.rationale.sourceEnglish, l1Quiz0Source.rationale,
    'the rationale remains paired to the exact current canonical source');
  assert.equal(l1Quiz0.rationale.reviewStatus, 'machine-draft',
    'the bounded learner-facing rationale is visibly unreviewed');
  assert.ok(l1Quiz0.rationale.tshivendaDraft.startsWith('A-frame i nga thusa u swaya '),
    'localize the ordinary helper phrase and leave difficult equal-height wording in English');
  assert.ok(l1Quiz0.rationale.tshivendaDraft.includes('A i toli mavu, nḓila ine maḓi a bva ngayo') &&
    l1Quiz0.rationale.tshivendaDraft.includes('kana uri earthworks dzi a fanelea naa'),
    'retain the no-assessment and no-suitability limits while localizing ordinary wording');
  const rationaleDrift = {
    ...landscapeL1Source,
    quiz: landscapeL1Source.quiz.map((question, index) => index === 0
      ? { ...question, rationale: `${question.rationale} Changed.` }
      : question),
  };
  const rationaleFallback = resolveLearnerLessonPresentation(rationaleDrift, 've');
  assert.equal(rationaleFallback.status, 'english-fallback',
    'a changed source rationale withdraws this paired machine draft');
  assert.equal(rationaleFallback.content.quiz[0].rationale, rationaleDrift.quiz[0].rationale,
    'source drift shows the exact updated canonical rationale');
  const l1SourceParagraphs = landscapeL1Source.body.split('\n\n');
  const l1DraftParagraphs = landscapeL1Draft.body.tshivendaDraft.split('\n\n');
  assert.equal(l1DraftParagraphs.length, l1SourceParagraphs.length);
  assert.ok(l1DraftParagraphs[0].startsWith(
    'Musi ni sa athu kuvhanganya maḓi, thomani nga u guda hune a ya hone zwino. Sedzani musi hu na mvula khulu ni fhethu ho tsireledzeaho.'),
  'keep the two existing Tshivenda opening sentences unchanged');
  assert.ok(l1DraftParagraphs[0].includes('Musi zwo no tsireledzea nga murahu, tshimbilani kha land yaṋu.'),
    'translate the ordinary land-walk wording without broadening the holding to a country');
  assert.ok(l1DraftParagraphs[0].includes('Sedzani musi hu na mvula khulu ni fhethu ho tsireledzeaho.'),
    'preserve the safe-place observation during heavy rain');
  assert.ok(l1DraftParagraphs[0].includes('kha tshitentsi tshaṋu') &&
    l1DraftParagraphs[0].includes('nḓila yo tsireledzeaho ya u bva ngayo'),
    'retain the property boundary and safe excess-water route conditions');
  assert.ok(l1DraftParagraphs[1].includes('u swaya points at the same height na u tevhela contour line'),
    'the A-frame action must mark equal-height points and trace a contour');
  assert.ok(l1DraftParagraphs[1].includes('Its marks are an observation; a si pulane kana thendelo ya earthworks.'),
    'A-frame marks remain observation, not earthworks design or approval');
  assert.ok(l1DraftParagraphs[1].includes('Musi ni sa athu bwa swale, dam kana tshiṅwe tshivhumbeo, itani uri fhethu hu ṱolwe.'),
    'assessment remains a condition before digging the named or other structure');
  assert.ok(l1DraftParagraphs[1].includes('u elela ha maḓi musi hu na mvula khulu') &&
    l1DraftParagraphs[1].includes('nḓila yo tsireledzeaho ya u bvisa maḓi manzhisa') &&
    l1DraftParagraphs[1].includes('mueletshedzi wa zwa vhulimi wa henefho o gudiswaho'),
  'keep all site factors, safe overflow, and trained local adviser in the instruction');
  assert.ok(l1DraftParagraphs[2].startsWith(
    'A hu na mulayo muthihi wa fhethu une wa shuma kha u sendama ha mavu hoṱhe. Ṱhogomelani hune maḓi a tshimbila na hune a kuvhangana hone.'),
  'keep the existing Tshivenda site-observation prefix unchanged');
  assert.ok(l1DraftParagraphs[2].includes('Dzi-contour dzo vhewaho nga nḓila i songo teaho dzi nga engedza erosion') &&
    l1DraftParagraphs[2].includes('mavu ane a nwa maḓi nga u lenga a nga fara maḓi manzhisa'),
    'preserve the can-increase erosion risk and slow-infiltration overflow condition');
  assert.ok(l1DraftParagraphs[2].includes('Nangani water works dzinwe na dzinwe dzine dza fanelea fhethu hono') &&
    l1DraftParagraphs[2].includes('nḓila yo tsireledzeaho ya u bvisa maḓi a re manzhisa'),
    'the accepted localized choice remains site-specific and retains the safe excess-water route');
  const changedL1Source = { ...landscapeL1Source, body: landscapeL1Source.body.replace('walk your land', 'walk a different field') };
  assert.notEqual(changedL1Source.body, landscapeL1Source.body);
  assert.equal(resolveLearnerLessonPresentation(changedL1Source, 've').status, 'english-fallback',
    'source drift withdraws the whole paired landscape lesson');

  assert.equal(landscapeL2Draft.body.sourceEnglish, landscapeL2Source.body);
  assert.equal(landscapeL2Draft.body.reviewStatus, 'machine-draft');
  const l2SourceParagraphs = landscapeL2Source.body.split('\n\n');
  const l2DraftParagraphs = landscapeL2Draft.body.tshivendaDraft.split('\n\n');
  assert.equal(l2DraftParagraphs.length, l2SourceParagraphs.length);
  assert.equal(l2DraftParagraphs[0], "Kha zwipiḓa zwinzhi zwa South Africa, zwiholisesa vhuria (winter), ḓuvha ḽi vha ḽi devhula (north). Nḓila yaḽo i shanduka hu tshi tevhedzwa khalaṅwaha na vhuimo haṋu. U sendama ho lavhelesaho devhula (north-facing slopes) lunzhi hu wana ḓuvha ḽinzhisa nahone hu nga duderana ha dovha ha oma. U sendama ho lavhelesaho tshipembe (south-facing slopes) lunzhi hu fhola ha vha na vhunyisi. Tshando (frost) tshi nga kuvhangana kha milindi i re fhasi hune muya wo rotholaho wa dzula hone. Ṱhogomelani tshitentsi tshaṋu musi ni sa athu nanga hune na ḓo ṱavha zwimela zwi sa konḓeleliho tshando (tender crops) kana u vhea zwifhaṱo.",
    'preserve the existing Tshivenda north/south slope and local observation paragraph byte-for-byte');
  assert.equal(l2DraftParagraphs[1], "Ḓuvha ḽa vhuria ḽi fhasi nahone ḽi kule devhula u fhira ḓuvha ḽa tshilimo. Luvhondo kana lilaṱa ḽa murunzi (shade cloth) zwi nga thivhela ndima lwa tshifhinga tshilapfu vhuria u fhira tshilimo. Musi ni sa athu vhea tshithu tshi sa rembuluswi, imani henefho fhethu nga 8am, masiari, na 4pm nga ḓuvha ḽa vhuria nahone ni sedze hune murunzi wa wela hone.",
    'preserve the existing Tshivenda winter shade observation paragraph byte-for-byte');
  // The earlier exact phrase predated the accepted locative correction: the guard is the
  // keep-out instruction and its destination, so pin those semantics with the explicit locative.
  assert.ok(l2DraftParagraphs[2].includes('Pawpaw na young citrus zwi a kwamea nga frost nga u leluwa.') &&
    l2DraftParagraphs[2].includes('Ni songo vhea zwimela zwi sa konḓeleliho kha known low frost pockets.') &&
    l2DraftParagraphs[2].includes('Sedzani frost ya henefho musi ni sa athu ṱavha.'),
  'preserve the named young plants, frost sensitivity, explicit keep-out location, and local check before planting');
  const changedL2Source = { ...landscapeL2Source, body: landscapeL2Source.body.replace('young citrus', 'mature citrus') };
  assert.notEqual(changedL2Source.body, landscapeL2Source.body);
  assert.equal(resolveLearnerLessonPresentation(changedL2Source, 've').status, 'english-fallback',
    'a changed frost instruction withdraws its complete paired lesson');

  const waterDraft = draft.lessons[0].body.tshivendaDraft.split('\n\n');
  assert.equal(waterDraft[1], l1DraftParagraphs[1], 'show the source-paired mixed Tshivenda A-frame candidate with its exact safeguards');
  assert.ok(waterDraft[0].includes('Musi zwo no tsireledzea nga murahu, tshimbilani kha land yaṋu.'),
    'preserve the safe-afterward condition and land scope');
  assert.ok(waterDraft[0].includes('rills') && waterDraft[0].includes('(fans out)') &&
    waterDraft[0].includes('(ponds)') && waterDraft[0].includes('kha tshitentsi tshaṋu'),
    'retain the technical channel term and clarify spreading, ponding, and property exit');
  assert.ok(waterDraft[2].includes('Dzi-contour dzo vhewaho nga nḓila i songo teaho') &&
    waterDraft[2].includes('dzi nga engedza erosion') &&
    waterDraft[2].includes('mavu ane a nwa maḓi nga u lenga') &&
    waterDraft[2].includes('a nga fara maḓi manzhisa'),
  'preserve that poorly placed contours may increase erosion and slow-draining soil may hold excess water');
  // The checked winter-sun summary is now a draft; preserve its exact source and directional comparison.
  const winterPoint = draft.lessons[1].keyPoints[1];
  assert.equal(winterPoint.sourceEnglish, source.lessons[1].keyPoints[1]);
  assert.equal(winterPoint.reviewStatus, 'machine-draft');
  assert.ok(winterPoint.tshivendaDraft.includes('ḽi fhasi') && winterPoint.tshivendaDraft.includes('kule devhula'),
    'winter sun must remain lower and farther north, never reversed');
});

test('Tshivenda Reading soil notes keep the checked compaction limit and exact patch sentence', () => {
  const proof = JSON.parse(readFileSync(
    new URL('../docs/study-translation-reviews/READING-LANDSCAPE-OBSERVATION-NEXT-2026-10-04.json', import.meta.url), 'utf8'));
  const fuller = JSON.parse(readFileSync(
    new URL('../docs/study-translation-reviews/READING-BODY-FULLER-ROOT-READY-2026-10-04.json', import.meta.url), 'utf8'));
  const applied = JSON.parse(readFileSync(
    new URL('../docs/study-translation-reviews/READING-FULL-LEARNER-APPLIED-CANDIDATES-2026-10-05.json', import.meta.url), 'utf8'));
  const canonical = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const source = canonical.lessons.find(lesson => lesson.id === 'reading-landscape-l4')!;
  const lesson = TSHIVENDA_READING_LANDSCAPE_DRAFT.lessons.find(item => item.id === source.id)!;
  const repair = proof.veLearnerRepair;
  const sourceParagraphs = source.body.split('\n\n');
  const targetParagraphs = lesson.body.tshivendaDraft.split('\n\n');

  assert.equal(sourceParagraphs[repair.paragraphIndex], repair.sourceEnglish,
    'the learner source keeps its registry wording, including “whether soil”');
  assert.match(sourceParagraphs[repair.paragraphIndex], /whether soil is compacted/);
  assert.doesNotMatch(sourceParagraphs[repair.paragraphIndex], /whether the soil is compacted/,
    'do not silently substitute slide narration for the learner registry source');
  assert.equal(lesson.body.sourceEnglish, source.body, 'the exact English learner source remains bound');
  assert.equal(lesson.body.reviewStatus, 'machine-draft', 'facilitator review remains pending');
  assert.equal(targetParagraphs.length, sourceParagraphs.length, 'the lesson keeps its original paragraph breaks');
  assert.ok(targetParagraphs[0].includes('Engedzani nnḓu, miri, maḓi, bada, fences') &&
    targetParagraphs[0].includes('muya wa tshilimo na wa vhuria'),
    'retain fences on the map and keep summer and winter wind arrows distinct');
  // The independently checked perfect-versus-beautified repair supersedes this
  // dated whole-paragraph claim; the complete current module is checked first.
  const prior = mapNativeBefore('ve', TSHIVENDA_READING_LANDSCAPE_DRAFT);
  assert.equal(prior.lessons.find(item => item.id === source.id)!.body.tshivendaDraft.split('\n\n')[2], repair.previousBody.split('\n\n')[2]);
  const fullerRow = fuller.fields.find((row: { language: string; lessonId: string; paragraphIndex: number }) =>
    row.language === 've' && row.lessonId === 'reading-landscape-l4' && row.paragraphIndex === repair.paragraphIndex);
  assert.ok(fullerRow, 'the separately checked fuller body target must be recorded');
  assert.equal(targetParagraphs[1], fullerRow.currentTargetParagraph,
    'the later ordinary-prose draft changes only the two accepted clauses in this paragraph');
  assert.equal(targetParagraphs[1].split('. ')[0], repair.previousBody.split('\n\n')[1].split('. ')[0],
    'retain the already checked frost/damp/species observation sentence exactly');
  assert.ok(targetParagraphs[1].includes('Zwimela izwi zwi nga mela'),
    'translate “These plants” without adding a time cue');
  assert.doesNotMatch(targetParagraphs[1], /Zwino zwimela/,
    'do not turn the source subject into “Now these plants”');
  assert.ok(targetParagraphs[1].includes('fhedzi u vha hone hazwo fhedzi a zwi sumbedzi arali mavu o tsitsikana (compacted).'),
    'the presence of these plants remains insufficient to diagnose compacted soil');
  assert.ok(targetParagraphs[1].endsWith('Ṱolani mavu ni sa athu dzhia tsheo ya zwine patch ya amba kha design yaṋu.'),
    'translate checking before interpreting the patch while preserving its exact area term and decision order');
  assert.doesNotMatch(targetParagraphs[1], /tsinde/i,
    'the Tshivenda word for stem/trunk cannot stand in for “patch”');
  const expectedOtherFields = structuredClone(repair.otherFieldsBefore);
  const appliedTarget = (field: string): string => {
    const row = applied.entries.find((item: { languageCode: string; lessonId: string; field: string }) =>
      item.languageCode === 've' && item.lessonId === 'reading-landscape-l4' && item.field === field);
    assert.ok(row, `independent applied proof records the approved repair to ${field}`);
    return row.appliedTarget;
  };
  expectedOtherFields.keyPoints[2].tshivendaDraft = appliedTarget('keyPoints[2]');
  expectedOtherFields.quiz[0].rationale.tshivendaDraft = appliedTarget('quiz[0].rationale');
  expectedOtherFields.quiz[1].rationale.tshivendaDraft = appliedTarget('quiz[1].rationale');
  expectedOtherFields.quiz[1].options[1].tshivendaDraft = appliedTarget('quiz[1].options[1]');
  assert.deepEqual({ title: lesson.title, infographicAlt: lesson.infographicAlt, keyPoints: lesson.keyPoints, quiz: lesson.quiz },
    expectedOtherFields,
    'retain every previously checked field except the four exact content repairs independently recorded in the applied proof');

  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, lesson.body.tshivendaDraft);
  const drifted = { ...source, body: source.body.replace('whether soil is compacted', 'whether soil stays compacted') };
  assert.equal(resolveLearnerLessonPresentation(drifted, 've').status, 'english-fallback',
    'a changed source withdraws the learner draft instead of showing a stale soil claim');
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

test('Tshivenda Market L2 pairs customer and assessment drafts without weakening commitments', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'market-community-l2');
  assert.ok(sourceLesson);
  const lesson = TSHIVENDA_MARKET_COMMUNITY_DRAFT.lessons.find(item => item.id === sourceLesson.id);
  assert.ok(lesson);

  assert.equal(lesson.id, sourceLesson.id);
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(lesson.title.reviewStatus, 'machine-draft', 'ordinary where-to-sell/how-to-price title copy is now available as an unreviewed source pair');
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(lesson.title.tshivendaDraft, 'U rengisa surplus: Hune wa nga rengisa hone na uri wa vhea mutengo hani');
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = lesson.body.tshivendaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  // Independently checked ordinary customer framing replaces old full holds; commitment clauses stay exact.
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index]);
  assert.ok(draftParagraphs[3].startsWith('Direct selling can retain more of the sale price,'));
  assert.ok(draftParagraphs[5].includes('Regular orders') &&
    draftParagraphs[5].includes('only when customers and growers can keep the agreement.'),
  'ordinary planning wording must retain the only-when qualification for both sides');
  assert.ok(draftParagraphs[7].includes('costs na household food needs musi ni sa athu fulufhedzisa regular boxes.'),
    'cost and household checks precede the promise, rather than follow it');
  assert.ok(draftParagraphs[9].includes('avoid promising a fixed delivery you cannot supply'));
  assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.equal(lesson.keyPoints[1].reviewStatus, 'machine-draft');
  assert.equal(lesson.keyPoints[1].tshivendaDraft, 'Vhambedzani tsengo na ndozwo khathihi na mutengo wa u rengisa.');
  assert.ok(lesson.keyPoints.every(point => point.reviewStatus === 'machine-draft'),
    'checked supply and compliance framing now joins the existing source-paired customer/cost drafts');
  assert.ok(lesson.keyPoints[0].tshivendaDraft.includes('tshibveledzwa') && lesson.keyPoints[0].tshivendaDraft.includes('tshivhalo'),
    'the agreement still names product and quantity');
  assert.ok(lesson.keyPoints[1].tshivendaDraft.includes('tsengo') && lesson.keyPoints[1].tshivendaDraft.includes('ndozwo'),
    'the comparison still names costs and losses alongside price');
  assert.ok(lesson.keyPoints[2].tshivendaDraft.includes('fhedzi musi supply na customer terms'),
    'regular boxes cannot be promised without supporting supply and customer terms');
  assert.ok(lesson.keyPoints[3].tshivendaDraft.includes('nga u fulufhedzea'),
    'claims about growing practices must remain honest');
  assert.deepEqual(lesson.quiz.map(question => question.sourceCorrectIndex), sourceLesson.quiz.map(question => question.correct));

  const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.keyPoints[1], lesson.keyPoints[1].tshivendaDraft);
  assert.equal(presentation.content.keyPoints[0], lesson.keyPoints[0].tshivendaDraft);
  assert.equal(presentation.content.keyPoints[2], lesson.keyPoints[2].tshivendaDraft);
  assert.equal(presentation.content.body, lesson.body.tshivendaDraft);
  assert.deepEqual(lesson.quiz.map(question => question.sourceCorrectIndex), [2, 2]);
  for (const question of lesson.quiz) {
    assert.equal(question.question.reviewStatus, 'machine-draft');
    assert.equal(question.rationale.reviewStatus, 'machine-draft');
    assert.ok(question.options.every(option => option.reviewStatus === 'machine-draft' ||
      (option.reviewStatus === 'hold' && option.tshivendaDraft === option.sourceEnglish)));
  }
  assert.equal(lesson.quiz[1].options[3].reviewStatus, 'machine-draft');
  assert.equal(lesson.quiz[1].options[3].tshivendaDraft, 'Box schemes dzi iledza tax obligations',
    'the false distractor still says box schemes avoid tax obligations, without turning the claim into a prohibition or negation');
  assert.equal(lesson.quiz[1].sourceCorrectIndex, 2,
    'the translated false tax claim stays at its original distractor position');
  assert.ok(lesson.quiz[0].question.tshivendaDraft.includes('Mulimi wa bulasi ḽiṱuku') &&
    lesson.quiz[0].question.tshivendaDraft.includes('production ine ya fhambana vhege nga vhege'),
  'the farm is small and weekly production varies; neither actor nor the supply condition may change');
  assert.ok(lesson.quiz[1].rationale.tshivendaDraft.includes('reliable supply, payment na costs'),
    'confirmed orders do not guarantee income independently of supply, payment and fulfilment costs');
  assert.deepEqual(presentation.content.quiz, lesson.quiz.map(question => ({
    q: question.question.tshivendaDraft,
    options: question.options.map(option => option.tshivendaDraft),
    correct: question.sourceCorrectIndex,
    rationale: question.rationale.tshivendaDraft,
  })));

  const changedSource = {
    ...sourceLesson,
    keyPoints: sourceLesson.keyPoints.map((point, index) => index === 1 ? `${point} ` : point),
  };
  const stalePresentation = resolveLearnerLessonPresentation(changedSource, 've');
  assert.equal(stalePresentation.status, 'english-fallback');
  assert.deepEqual(stalePresentation.content.keyPoints, changedSource.keyPoints);
});

test('Reading assessment drafts retain before-building shade, conditional drying and non-proof soil checks', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const l2 = TSHIVENDA_READING_LANDSCAPE_DRAFT.lessons.find(lesson => lesson.id === 'reading-landscape-l2')!;
  const l3 = TSHIVENDA_READING_LANDSCAPE_DRAFT.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!;
  const l4 = TSHIVENDA_READING_LANDSCAPE_DRAFT.lessons.find(lesson => lesson.id === 'reading-landscape-l4')!;
  assert.equal(l2.keyPoints[1].reviewStatus, 'machine-draft');
  assert.ok(l2.keyPoints[1].tshivendaDraft.includes('devhula'));
  assert.ok(l2.keyPoints[1].tshivendaDraft.includes('musi ni sa athu fhaṱa'));
  assert.equal(l3.quiz[1].rationale.reviewStatus, 'machine-draft');
  assert.ok(l3.quiz[1].rationale.tshivendaDraft.includes('zwi nga thusa'));
  assert.ok(l3.quiz[1].rationale.tshivendaDraft.includes('Late blight i nga engedzea kha mutsho wa u rothola na vhunyisi ha tshifhinga tshilapfu') &&
    l3.quiz[1].rationale.tshivendaDraft.includes('u sudzula bed fhedzi a si pulane yo fhelelaho ya u langa'),
    'preserve the can-increase condition, prolonged cool/damp weather, and the fact that moving the bed alone is insufficient');
  const frostRationale = l3.quiz[0].rationale;
  const frostSource = sourceModule.lessons.find(lesson => lesson.id === l3.id)!.quiz[0].rationale;
  assert.equal(frostRationale.sourceEnglish, frostSource);
  assert.equal(frostRationale.reviewStatus, 'machine-draft');
  assert.ok(frostRationale.tshivendaDraft.includes('vhu sa na makole') && frostRationale.tshivendaDraft.includes('hu si na muya'),
    'clear, still nights retain both no-cloud and no-wind conditions');
  // Independently checked whole-season phrasing replaces the former English hold.
  assert.ok(frostRationale.tshivendaDraft.includes('Vhambedzani fhethu hune nursery ya nga vhewa hone') &&
    frostRationale.tshivendaDraft.includes('kha khalaṅwaha yoṱhe ya tshando ya henefho'));
  assert.ok(frostRationale.tshivendaDraft.includes('matsalwa a minimum temperatures a henefho kana') &&
    frostRationale.tshivendaDraft.includes('mueletshedzi wa zwa vhulimi wa henefho') &&
    frostRationale.tshivendaDraft.includes('musi ni sa athu dzhia tsheo ya fhethu ha tshifhinga tshilapfu'));
  assert.ok(frostRationale.tshivendaDraft.includes('Frost ine ya vhonala a si yone fhedzi') &&
    frostRationale.tshivendaDraft.includes('a hu na fhethu ha kha thavha hune ha fulufhedzisa'),
    'retain visible-frost limits and do not guarantee a frost-free hillside location');
  const changedL3Rationale = {
    ...sourceModule.lessons.find(lesson => lesson.id === l3.id)!,
    quiz: sourceModule.lessons.find(lesson => lesson.id === l3.id)!.quiz.map((question, index) => index === 0
      ? { ...question, rationale: `${question.rationale} Changed source.` }
      : question),
  };
  const rationaleFallback = resolveLearnerLessonPresentation(changedL3Rationale, 've');
  assert.equal(rationaleFallback.status, 'english-fallback');
  assert.equal(rationaleFallback.content.quiz[0].rationale, changedL3Rationale.quiz[0].rationale,
    'a changed frost assessment source withdraws the mixed rationale');

  assert.equal(l4.keyPoints[2].reviewStatus, 'machine-draft');
  assert.ok(l4.keyPoints[2].tshivendaDraft.includes('khakibos kana blackjack'));
  assert.ok(l4.keyPoints[2].tshivendaDraft.includes('zwa mela zwo tsitsikana'));
  assert.ok(l4.keyPoints[2].tshivendaDraft.includes('a zwi sumbedzi uri mavu o tsitsikana'),
    'dense marker growth prompts a soil check but does not prove compaction');
  const sourceL4 = sourceModule.lessons.find(lesson => lesson.id === l4.id)!;
  assert.equal(l4.quiz[1].options[1].sourceEnglish, sourceL4.quiz[1].options[1],
    'the localized seasonal-wind option remains bound to its exact source and position');
  assert.equal(l4.quiz[1].options[1].reviewStatus, 'machine-draft');
  assert.ok(l4.quiz[1].options[1].tshivendaDraft.includes('zwa shandula hune windbreaks') &&
    l4.quiz[1].options[1].tshivendaDraft.includes('zwa fanela u vhewa hone'),
    'retain the consequence that seasonal direction changes where windbreaks and tender crops belong');
  const drifted = { ...sourceL4, keyPoints: sourceL4.keyPoints.map((point, index) => index === 2 ? `${point} A new diagnostic condition.` : point) };
  assert.equal(resolveLearnerLessonPresentation(drifted, 've').status, 'english-fallback');
});
