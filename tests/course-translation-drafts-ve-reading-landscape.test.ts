import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
    const translatedIndices = lessonId === 'market-community-l1' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16]
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
      assert.ok(priceQuestion.question.tshivendaDraft.startsWith(
        'In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce.'),
      'the question must not reverse costs and sale price or present the example as a market price');
      assert.deepEqual(priceQuestion.options.map(option => option.sourceEnglish), source.quiz[0].options);
      assert.ok(priceQuestion.options.every(option => option.reviewStatus === 'machine-draft'));
      assert.ok(priceQuestion.options[2].tshivendaDraft.includes('tshi nga netshedza return i khwine'),
        'the correct answer still compares another crop conditionally rather than promising a better return');
      assert.ok(priceQuestion.rationale.tshivendaDraft.includes('fhasi ha cost') &&
        priceQuestion.rationale.tshivendaDraft.includes('musi ni sa athu dzhia tsheo'),
      'cost comparison and review before the next production decision remain explicit');

      const gapQuestion = draft.quiz[1];
      const gapSource = source.quiz[1];
      assert.equal(gapQuestion.sourceCorrectIndex, 1);
      assert.equal(gapQuestion.question.sourceEnglish, gapSource.q);
      assert.equal(gapQuestion.question.reviewStatus, 'machine-draft');
      assert.ok(gapQuestion.question.tshivendaDraft.includes('June and July'),
        'the repeated June/July household shortage remains exact');
      assert.deepEqual(gapQuestion.options.map(option => option.sourceEnglish), gapSource.options,
        'the translated choices retain the exact source order');
      assert.equal(gapQuestion.options[1].reviewStatus, 'machine-draft');
      assert.ok(gapQuestion.options[1].tshivendaDraft.startsWith('Pulani ni tshi humela murahu u bva kha food gap'),
        'the keyed answer still works backwards from the food gap');
      for (const technicalAnchor of ['suitable local crops', 'their harvest timing']) {
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
      assert.ok(draft.keyPoints[1].tshivendaDraft.includes('production na selling costs'),
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
      assert.equal(draftParagraphs[0].includes('Tshimbilani kha shango nga maḓuvha a re na muya.'), true,
        `${path}.body: preserve the existing windy-day land-walk sentence`);
      assert.equal(draftParagraphs[0].includes('Ṅwalani hune muya wa bva hone na zwine wa kwama.'), true,
        `${path}.body: preserve the existing wind-observation sentence`);
      assert.ok(draftParagraphs[0].startsWith('Muya u nga tshinyadza zwimela kha smallholding.'),
        `${path}.body: localize ordinary wind/crop framing and retain smallholding as an English anchor`);
      assert.ok(draftParagraphs[0].includes("your site's ridges and gaps"),
        `${path}.body: preserve the exact difficult site-landform phrase`);
      assert.ok(draftParagraphs[0].includes('Check local weather records') &&
        draftParagraphs[0].includes('musi ni sa athu dzhia tsheo ya hune tsireledzo ya ṱoḓea hone'),
        `${path}.body: retain local-records anchor and before-deciding-shelter scope`);
      assert.ok(draftParagraphs[1].startsWith(
        'Vhusiku vhu sa na makole, hu si na muya, muya wo rotholaho u nga elela u tshi ya fhasi ha kuvhangana fhethu ho tsaho. Fhethu afho hu nga rothola u fhira u sendama ha mavu ha tsini.'),
        `${path}.body: preserve the clear/still-night condition and can-be-colder comparison`);
      assert.ok(draftParagraphs[1].includes('Frost patterns zwi dovha zwa ya nga site.') &&
        draftParagraphs[1].includes('Vhambedzani candidate places through the local frost season.') &&
        draftParagraphs[1].includes('Sedzani local minimum-temperature records where available.') &&
        draftParagraphs[1].includes('If records are not available, keep observing across cold nights and ask a local agriculture adviser before choosing a permanent home for tender seedlings.'),
        `${path}.body: retain the full-season comparison, record availability, no-record fallback, observations and adviser-before-placement condition`);
      assert.ok(draftParagraphs[2].startsWith(
        'Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice.'),
        `${path}.body: retain the frost definition, mist limitation and possibility of damage without visible ice exactly`);
      assert.ok(draftParagraphs[2].includes('Ṱolani ice na u tshinyala ha zwimela'));
      assert.ok(draftParagraphs[2].includes('fhethu hu re fhasi na u sendama ha mavu'),
        `${path}.body: translate the low-ground versus slope comparison without reversing it`);
      assert.ok(draftParagraphs[2].includes('minimum temperatures hune zwa konadzea'),
        `${path}.body: preserve the minimum-temperature check and where-possible condition`);
      assert.ok(draftParagraphs[2].includes('tshilapfusesa'),
        `${path}.body: the field comparison still marks where cold or damage lasts longest`);
      assert.ok(draftParagraphs[2].endsWith('Keep sensitive plants away from the cold pockets you observe.'),
        `${path}.body: retain the exact sensitive-plant protection instruction`);
      assert.ok(draftParagraphs[0].startsWith('Muya u nga tshinyadza zwimela kha smallholding.'), `${path}.body: preserve the neighboring wind paragraph`);
      assert.ok(draftParagraphs[3].startsWith('For tomatoes troubled by late blight,'), `${path}.body: preserve the neighboring late-blight paragraph`);
      assert.ok(draftParagraphs[3].startsWith('For tomatoes troubled by late blight, u elela ha muya na ḓuvha ḽa matsheloni zwi nga thusa uri maṱari a ome.'),
        `${path}.body: retain affected-tomato framing and can-help drying modality`);
      assert.ok(draftParagraphs[3].includes('Late blight can still spread during prolonged cool, damp weather.') &&
        draftParagraphs[3].includes('Moving a bed alone will not control it; seek local crop-health guidance too.'),
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
    'lessons[0] reading-landscape-l1.quiz[0].options[2]',
    'lessons[2] reading-landscape-l3.keyPoints[1]',
    'lessons[2] reading-landscape-l3.quiz[0].rationale',
  ], 'remaining whole-field technical holds remain exact English; new drafts remain unreviewed');

  const aFrameSuitability = draft.lessons[0].keyPoints[1];
  assert.equal(aFrameSuitability.sourceEnglish, source.lessons[0].keyPoints[1]);
  assert.equal(aFrameSuitability.reviewStatus, 'machine-draft');
  assert.ok(aFrameSuitability.tshivendaDraft.includes('points at the same height') &&
    aFrameSuitability.tshivendaDraft.includes('whether earthworks are suitable'),
  'ordinary A-frame framing is drafted while equal-height and site-suitability limits stay exact');
  assert.doesNotMatch(aFrameSuitability.tshivendaDraft, /earthworks should/i,
    'marking equal-height points must not become an instruction to build earthworks');

  const seasonalWindOption = draft.lessons[3].quiz[1].options[1];
  assert.equal(seasonalWindOption.sourceEnglish, source.lessons[3].quiz[1].options[1]);
  assert.equal(draft.lessons[3].quiz[1].sourceCorrectIndex, source.lessons[3].quiz[1].correct);
  assert.equal(seasonalWindOption.reviewStatus, 'machine-draft');
  assert.ok(seasonalWindOption.tshivendaDraft.includes('changing where windbreaks and tender crops should go'),
    'the exact different-directions consequence remains attached to its original quiz option');

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
  assert.ok(l1Quiz0.rationale.tshivendaDraft.startsWith('A-frame i nga ni thusa u swaya '),
    'localize the ordinary helper phrase and leave difficult equal-height wording in English');
  assert.ok(l1Quiz0.rationale.tshivendaDraft.endsWith(
    'It does not assess soil, drainage, storm flow, or whether earthworks are suitable.'),
    'retain the full exact no-assessment and no-suitability limitation');
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
  assert.ok(l1DraftParagraphs[0].includes('your property') && l1DraftParagraphs[0].includes('nḓila yo tsireledzeaho'),
    'retain the property boundary and safe excess-water route conditions');
  assert.ok(l1DraftParagraphs[1].includes('u mark points at the same height and trace a contour line'),
    'the A-frame action must mark equal-height points and trace a contour');
  assert.ok(l1DraftParagraphs[1].includes('Its marks are an observation, not a design or approval for earthworks.'),
    'A-frame marks remain observation, not earthworks design or approval');
  assert.ok(l1DraftParagraphs[1].includes('Ni sa athu u bwa a swale, dam, kana tshiṅwe tshivhumbeo, itani uri fhethu hu ṱolwe.'),
    'assessment remains a condition before digging the named or other structure');
  assert.ok(l1DraftParagraphs[1].includes('Soil, slope, drainage, storm flow na safe overflow route zwoṱhe ndi zwa ndeme.') &&
    l1DraftParagraphs[1].includes('Vhudzisani a trained local adviser.'),
  'keep all site factors, safe overflow, and trained local adviser in the instruction');
  assert.ok(l1DraftParagraphs[2].startsWith(
    'A hu na mulayo muthihi wa fhethu une wa shuma kha u sendama ha mavu hoṱhe. Ṱhogomelani hune maḓi a tshimbila na hune a kuvhangana hone.'),
  'keep the existing Tshivenda site-observation prefix unchanged');
  assert.ok(l1DraftParagraphs[2].includes('Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much.'),
    'preserve the full erosion and slow-infiltration condition');
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
  assert.ok(l2DraftParagraphs[2].includes('Pawpaw and young citrus are sensitive to frost.') &&
    l2DraftParagraphs[2].includes('Ni songo vhea tender plants kha known low frost pockets.') &&
    l2DraftParagraphs[2].includes('Ṱhogomelani tshando tsha henefho musi ni sa athu ṱavha.'),
  'preserve the named young plants, frost sensitivity, keep-out direction, and local check before planting');
  const changedL2Source = { ...landscapeL2Source, body: landscapeL2Source.body.replace('young citrus', 'mature citrus') };
  assert.notEqual(changedL2Source.body, landscapeL2Source.body);
  assert.equal(resolveLearnerLessonPresentation(changedL2Source, 've').status, 'english-fallback',
    'a changed frost instruction withdraws its complete paired lesson');

  const waterDraft = draft.lessons[0].body.tshivendaDraft.split('\n\n');
  assert.equal(waterDraft[1], l1DraftParagraphs[1], 'show the source-paired mixed Tshivenda A-frame candidate with its exact safeguards');
  assert.ok(waterDraft[0].includes('Musi zwo no tsireledzea nga murahu, tshimbilani kha land yaṋu.'),
    'preserve the safe-afterward condition and land scope');
  assert.ok(waterDraft[0].includes('rills') && waterDraft[0].includes('(fans out)') &&
    waterDraft[0].includes('(ponds)') && waterDraft[0].includes('your property'),
    'retain the technical channel term and clarify spreading, ponding, and property exit');
  assert.ok(draft.lessons[0].body.tshivendaDraft.includes(
    'Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much.'),
    'preserve the erosion and slow-infiltration condition in exact English');
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
  assert.equal(targetParagraphs[0], repair.previousBody.split('\n\n')[0]);
  assert.equal(targetParagraphs[2], repair.previousBody.split('\n\n')[2]);
  assert.equal(targetParagraphs[1], repair.currentTarget,
    'retain the checked first sentence and hold only the ambiguous patch decision sentence');
  assert.ok(targetParagraphs[1].includes('These plants '),
    'keep the exact source subject rather than adding an unsupported “Now” time cue');
  assert.doesNotMatch(targetParagraphs[1], /Zwino zwimela/,
    'do not turn the source subject into “Now these plants”');
  assert.ok(targetParagraphs[1].includes(repair.retainedFirstSentence.slice('These plants '.length)),
    'the checked compaction-limitation predicate stays unchanged');
  assert.ok(targetParagraphs[1].includes('arali mavu o tsitsikana (compacted)'),
    'the translated first sentence preserves the source’s “whether soil is compacted” uncertainty');
  assert.ok(targetParagraphs[1].endsWith('Check the soil before deciding what the patch means for your design.'),
    'the second sentence is the exact learner registry source, with “patch” intact');
  assert.doesNotMatch(targetParagraphs[1], /tsinde/i,
    'the Tshivenda word for stem/trunk cannot stand in for “patch”');
  assert.deepEqual({ title: lesson.title, infographicAlt: lesson.infographicAlt, keyPoints: lesson.keyPoints, quiz: lesson.quiz },
    repair.otherFieldsBefore, 'the repair changes no title, infographic, key point or quiz field');

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
  assert.ok(l3.quiz[1].rationale.tshivendaDraft.includes('Late blight is favoured by prolonged cool, damp weather, and moving the bed alone is not a complete control plan.'));
  assert.equal(l4.keyPoints[2].reviewStatus, 'machine-draft');
  assert.ok(l4.keyPoints[2].tshivendaDraft.includes('khakibos kana blackjack'));
  assert.ok(l4.keyPoints[2].tshivendaDraft.includes('zwa mela zwo tsitsikana'));
  assert.ok(l4.keyPoints[2].tshivendaDraft.includes('it does not prove compaction.'));
  const sourceL4 = sourceModule.lessons.find(lesson => lesson.id === l4.id)!;
  assert.equal(l4.quiz[1].options[1].sourceEnglish, sourceL4.quiz[1].options[1],
    'the localized seasonal-wind option remains bound to its exact source and position');
  assert.equal(l4.quiz[1].options[1].reviewStatus, 'machine-draft');
  assert.ok(l4.quiz[1].options[1].tshivendaDraft.includes('changing where windbreaks and tender crops should go'),
    'retain the exact placement consequence after localizing the direction clause');
  const drifted = { ...sourceL4, keyPoints: sourceL4.keyPoints.map((point, index) => index === 2 ? `${point} A new diagnostic condition.` : point) };
  assert.equal(resolveLearnerLessonPresentation(drifted, 've').status, 'english-fallback');
});
