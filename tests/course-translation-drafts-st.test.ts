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
      // The new Zones description follows the numbered footpath in the replacement image.
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
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
        'machine-draft');
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz question count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`,
        'machine-draft');
      assert.equal(question.options.length, english.options.length, `${questionPath}: option count/order must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(option, english.options[optionIndex], `${questionPath}.options[${optionIndex}]`,
          'machine-draft');
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: answer index must remain unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct answer must still point to the exact English correct option`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`,
        'machine-draft');
    }
  }
});

test('a Sesotho learner gets the full marked ethics draft and its unchanged English source', () => {
  const source = COURSE_MODULES.find(module => module.id === 'intro-permaculture')?.lessons[0];
  assert.ok(source);
  const draft = SESOTHO_INTRO_PERMACULTURE_DRAFT.lessons[0];
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(draft.body.sourceEnglish, source.body);
  const englishParagraphs = source.body.split('\n\n');
  const draftParagraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draftParagraphs.length, englishParagraphs.length);
  assert.notEqual(draftParagraphs[0], englishParagraphs[0], 'the first ethics explanation is a Sesotho machine draft');
  // The earlier draft held these examples wholesale. The reviewed model draft now
  // preserves them as examples; the exact English remains the authority for review.
  for (const [index, paragraph] of draftParagraphs.entries()) {
    assert.notEqual(paragraph, englishParagraphs[index], `ethics paragraph ${index + 1} must not masquerade as a translated English copy`);
  }
  assert.ok(draftParagraphs[0].includes('(surplus)'));
  assert.ok(draftParagraphs[1].includes('(shared spring)'));
  assert.ok(draftParagraphs[2].includes('swales'));
  assert.ok(!draftParagraphs[1].includes('sebediswang ke bohle'),
    'a locally shared spring must not be broadened to a source used by everyone');
  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.notEqual(presentation.content.title, source.title);
  const changedSource = { ...source, body: `${source.body}\n\nNew ethics example.` };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'a changed English source invalidates the whole paired draft');
});

test('Sesotho principles assessment retains every English safety condition beside its complete draft', () => {
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
  // Technical labels may stay English inside translated prose, but a source-only
  // paragraph must never be presented as a completed regional body.
  pairedParagraphs.forEach((paragraph, index) => assert.notEqual(paragraph, sourceParagraphs[index]));
  for (const term of ['David Holmgren', 'Bill Mollison', 'Essence of Permaculture', 'earthworks', 'biomass']) {
    assert.ok(pairedParagraphs[0].includes(term), `preserve attribution and technical source term: ${term}`);
  }
  assert.ok(pairedParagraphs[1].includes('(maize)'));
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} Changed source.` }, 'st').status,
    'english-fallback', 'source edits invalidate the complete principles draft');
  draft.keyPoints.forEach((point, index) => {
    assert.equal(point.reviewStatus, 'machine-draft');
    assert.equal(point.sourceEnglish, source.keyPoints[index]);
    assert.notEqual(point.sesothoDraft, point.sourceEnglish, 'a translated key point cannot just copy English');
  });
  draft.quiz.forEach((question, index) => {
    const english = source.quiz[index];
    for (const pair of [question.question, ...question.options, question.rationale]) {
      assert.equal(pair.reviewStatus, 'machine-draft');
      assert.notEqual(pair.sesothoDraft, pair.sourceEnglish);
    }
    assert.equal(question.sourceCorrectIndex, english.correct);
  });
  // Model checks caught dangerous narrowing and missing timing. Keep the technical
  // terms explicit and the full source visible; these are still unreviewed drafts.
  assert.match(draft.quiz[0].options[1].sesothoDraft, /bonyane/, 'at least one wet season must not become a shorter observation');
  assert.match(draft.quiz[0].rationale.sesothoDraft, /mohato wa pele feela/, 'observation remains only a first step');
  assert.match(draft.quiz[0].rationale.sesothoDraft, /Pele o cheka/, 'checks must happen before digging');
  for (const term of ['drainage', 'safe overflow route', 'moeletsi wa lehae ya kwetlisitsweng']) {
    assert.ok(draft.quiz[0].rationale.sesothoDraft.includes(term));
  }
  assert.match(draft.quiz[1].options[1].sesothoDraft, /ka mora kotulo; ebe.*safe management pele edible crops di kgutla/,
    'harvest, safety check and edible crop return must remain in that order');
  for (const term of ['clean up pests', 'fertility', 'fixed pen', 'Fresh manure', 'germs', 'safe management', 'pele edible crops di kgutla']) {
    assert.ok(draft.quiz[1].rationale.sesothoDraft.includes(term));
  }
  assert.ok(!draft.quiz[1].rationale.sesothoDraft.includes('thusa ho clean up'), 'do not weaken the source pest-cleanup claim');

  const presentation = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, draft.body.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints, draft.keyPoints.map(point => point.sesothoDraft));
  draft.quiz.forEach((question, index) => {
    assert.equal(presentation.content.quiz[index].q, question.question.sesothoDraft);
    assert.deepEqual(presentation.content.quiz[index].options, question.options.map(option => option.sesothoDraft));
    assert.equal(presentation.content.quiz[index].rationale, question.rationale.sesothoDraft);
    assert.equal(presentation.content.quiz[index].correct, source.quiz[index].correct);
  });
  assert.equal(resolveLearnerLessonPresentation({ ...source, quiz: source.quiz.map((question, index) =>
    index === 0 ? { ...question, rationale: `${question.rationale} New safety condition.` } : question) }, 'st').status,
    'english-fallback', 'a changed source safety condition invalidates the assessment draft');
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
  // Checked ordinary prose now replaces whole-paragraph holds; the worked price example remains exact.
  assert.equal(draftParagraphs[12], sourceParagraphs[12], 'R18 cost and R15 sale teaching example remain exact English');
  assert.ok(draftParagraphs[13].includes('ha e tiise thekiso'), 'the sale remains explicitly non-guaranteed');
  for (const index of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16]) {
    assert.notEqual(draftParagraphs[index], sourceParagraphs[index], `selected record-keeping paragraph ${index + 1} should be a visible draft`);
  }
  assert.equal(draftParagraphs[4],
    'Ngola kilograms tsa tamati, dozens tsa mahe le bundles tsa morogo, ebe u ngola hore e nngwe le e nngwe e ile hokae.',
    'retain source units and produce names in the paired Sesotho draft');
  assert.equal(draftParagraphs[10],
    'Rekoto e boetse e bontsha dikgwedi tseo lelapa le qetellang le reka dijo ka tsona.');
  assert.equal(draftParagraphs[14],
    'Sebelisa rekoto ya hao ho fumana hore na dijo tsa lelapa di a haella neng.',
    'the household food-gap prompt remains source-paired before the translated planning guidance');

  assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.equal(lesson.keyPoints[0].reviewStatus, 'machine-draft', 'the previously drafted harvest destination point remains a draft');
  assert.ok(lesson.keyPoints.every(point => point.reviewStatus === 'machine-draft'), 'ordinary key point wording remains visibly unreviewed');
  assert.equal(lesson.quiz.length, sourceLesson.quiz.length);
  const priceQuestion = lesson.quiz[0];
  assert.equal(priceQuestion.question.sourceEnglish, sourceLesson.quiz[0].q);
  assert.ok(priceQuestion.question.sesothoDraft.startsWith('In this teaching example, tomatoes sell at R15/kg and cost R18/kg to produce.'), 'the R15/R18 premise remains exact while the ordinary question is drafted');
  assert.equal(priceQuestion.question.reviewStatus, 'machine-draft');
  assert.ok(priceQuestion.rationale.sesothoDraft.startsWith('The example price is below the stated cost.'), 'the numeric conclusion remains exact while ordinary review wording is drafted');
  assert.equal(priceQuestion.rationale.reviewStatus, 'machine-draft');
  assert.deepEqual(priceQuestion.options.map(option => option.sourceEnglish), sourceLesson.quiz[0].options,
    'price-example answer wording remains paired in canonical order');
  assert.ok(priceQuestion.options.every(option => option.reviewStatus === 'machine-draft'), 'ordinary options remain visibly unreviewed');
  assert.equal(priceQuestion.sourceCorrectIndex, sourceLesson.quiz[0].correct);

  const gapQuestion = lesson.quiz[1];
  const gapSource = sourceLesson.quiz[1];
  assert.equal(gapQuestion.question.sourceEnglish, gapSource.q);
  assert.equal(gapQuestion.question.reviewStatus, 'machine-draft');
  assert.equal(gapQuestion.options.length, gapSource.options.length);
  assert.deepEqual(gapQuestion.options.map(option => option.sourceEnglish), gapSource.options,
    'translation keeps all four choices in their canonical order');
  assert.ok(gapQuestion.question.sesothoDraft.includes('June le July selemo se seng le se seng'),
    'the recurring food gap keeps its exact months and yearly frequency');
  assert.ok(gapQuestion.options[gapSource.correct].sesothoDraft.includes('dijalo tse loketseng sebaka sa heno') &&
    gapQuestion.options[gapSource.correct].sesothoDraft.includes('nako ya tsona ya kotulo'),
    'the correct action still uses locally suitable crops and their harvest timing');
  assert.ok(gapQuestion.rationale.sesothoDraft.includes('tlelaemete ya sebaka') &&
    gapQuestion.rationale.sesothoDraft.includes('metsi') &&
    gapQuestion.rationale.sesothoDraft.includes('nako e lebelletsweng ya kotulo'),
    'the rationale keeps local climate, water and expected harvest time as conditions');
  assert.deepEqual(gapQuestion.options.map(option => option.reviewStatus), ['machine-draft', 'machine-draft', 'machine-draft', 'machine-draft']);
  assert.equal(gapQuestion.rationale.sourceEnglish, gapSource.rationale);
  assert.equal(gapQuestion.rationale.reviewStatus, 'machine-draft');
  assert.equal(gapQuestion.sourceCorrectIndex, 1, 'the same source answer remains correct after translation');

  const modulePresentation = resolveCourseModulePresentation(sourceModule, 'st');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.sesothoDraft);
  assert.equal(modulePresentation.description, draft.description.sesothoDraft);

  const presentation = resolveLearnerLessonPresentation(sourceLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, lesson.body.sesothoDraft);
  assert.deepEqual(presentation.content.keyPoints, lesson.keyPoints.map(point => point.sesothoDraft), 'Study displays each source-paired unreviewed point');
  assert.deepEqual(presentation.content.quiz, sourceLesson.quiz.map((question, index) => ({
    q: lesson.quiz[index].question.sesothoDraft,
    options: lesson.quiz[index].options.map(option => option.sesothoDraft),
    correct: question.correct,
    rationale: lesson.quiz[index].rationale.sesothoDraft,
  })));

  const changedQuestion = { ...sourceLesson, quiz: sourceLesson.quiz.map((question, index) => index === 1
    ? { ...question, q: `${question.q} Changed season.` }
    : question) };
  const staleQuestionPresentation = resolveLearnerLessonPresentation(changedQuestion, 'st');
  assert.equal(staleQuestionPresentation.status, 'english-fallback', 'changed seasonal assessment wording withdraws its paired draft');
  assert.deepEqual(staleQuestionPresentation.content.quiz, changedQuestion.quiz);

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
  // New ordinary framing was independently checked; unresolved comparative and reliability claims still hold.
  for (const index of [1, 2, 3, 5, 7, 8, 10, 11]) assert.notEqual(draftParagraphs[index], sourceParagraphs[index]);
  assert.ok(draftParagraphs[3].startsWith('Direct selling can retain more of the sale price, empa ho boetse ho hloka nako,'),
    'the bounded sale-price claim remains English while ordinary time and customer-care wording is drafted');
  assert.ok(draftParagraphs[6].startsWith('Qala ka what you can reliably supply'),
    'the reliability criterion stays exact English inside its checked Sesotho framing');
  assert.notEqual(draftParagraphs[2], sourceParagraphs[2], 'ordinary market compliance framing is now source-paired');
  assert.ok(draftParagraphs[2].includes('Setala sa informal ha se bolele ka boyona hore ha ho na melao kapa ditjeo.'),
    'the Sesotho framing keeps the caveat that informal stalls may still have rules and costs');
  assert.ok(draftParagraphs[5].includes('only when customers and growers can keep the agreement.'), 'orders remain conditional on both sides honoring terms');
  assert.ok(draftParagraphs[7].includes('ditlhoko tsa dijo tsa lelapa pele o tshepisa'), 'household food needs are checked before promising regular boxes');
  assert.ok(draftParagraphs[8].startsWith('Garden area or customer count alone does not predict income.'));
  assert.ok(draftParagraphs[10].includes('surplus eo o nang le yona'));
  assert.ok(draftParagraphs[11].startsWith('Hlalosa ditsela tseo o lemang ka tsona ka botshepehi.'));
  assert.ok(draftParagraphs[11].includes('Pele o sebedisa label') && draftParagraphs[11].includes('certification efe kapa efe kapa claim'),
    'the certification and buyer-claim check remains present in the Sesotho framing');
  assert.equal(lesson.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(lesson.infographicAlt?.reviewStatus, 'machine-draft');
  assert.equal(lesson.infographicAlt?.sesothoDraft,
    'Mekgwa e meraro ya ho rekisa ho tswa polasing e le nngwe: setala se pela tsela, thomelo ya sehlopha lebenkeleng, le lebokose le yang ka kotloloho lapeng.');
  assert.equal(lesson.title.reviewStatus, 'machine-draft', 'ordinary where-to-sell/how-to-price title wording is now paired as an unreviewed draft');
  assert.equal(lesson.title.sourceEnglish, sourceLesson.title);
  assert.equal(lesson.title.sesothoDraft, 'Ho rekisa surplus: moo o ka rekisang le kamoo o ka behang theko.');
  assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.ok(lesson.keyPoints.every(point => point.reviewStatus === 'machine-draft'), 'ordinary key-point wording remains visibly unreviewed');
  assert.ok(lesson.keyPoints[2].sesothoDraft.includes('supply') && lesson.keyPoints[2].sesothoDraft.includes('customer'), 'the supply and customer agreement safeguard remains explicit');
  assert.ok(lesson.keyPoints[3].sesothoDraft.includes('market rules') && lesson.keyPoints[3].sesothoDraft.includes('growing practices'), 'compliance and honest-description safeguards remain explicit');

  const presentation = resolveLearnerLessonPresentation(sourceLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.keyPoints[1], lesson.keyPoints[1].sesothoDraft);
  assert.equal(presentation.content.keyPoints[0], lesson.keyPoints[0].sesothoDraft);
  assert.equal(presentation.content.keyPoints[2], lesson.keyPoints[2].sesothoDraft);
  assert.equal(presentation.content.infographicAlt, lesson.infographicAlt?.sesothoDraft);
  assert.equal(presentation.content.body, lesson.body.sesothoDraft);
  assert.deepEqual(presentation.content.quiz, sourceLesson.quiz.map((question, index) => ({
    q: lesson.quiz[index].question.sesothoDraft,
    options: lesson.quiz[index].options.map(option => option.sesothoDraft),
    correct: question.correct,
    rationale: lesson.quiz[index].rationale.sesothoDraft,
  })), 'Study displays paired assessments without changing canonical answer indices');

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


test('Sesotho bed-body drafts keep reachability, wet-clay safeguards, crop grouping and soil-specific preparation while withdrawing on source drift', async () => {
  const { SESOTHO_VEGETABLES_STAPLES_DRAFT } = await import('../lib/course-translation-drafts-st-vegetables-staples.ts');
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  const draft = SESOTHO_VEGETABLES_STAPLES_DRAFT.lessons.find(lesson => lesson.id === source.id)!;
  const english = source.body.split('\n\n');
  const paragraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(paragraphs.length, english.length);
  assert.equal(paragraphs.length, 20);
  assert.match(paragraphs[1], /narrow enough to reach into from both sides/);
  assert.match(paragraphs[2], /One metre to one point two metres wide/);
  assert.match(paragraphs[2], /centre from either path, and your feet never touch the growing area/);
  assert.match(paragraphs[7], /^U se ke ua cheka wet clay\. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation\.$/, 'wet-clay prohibition and full severity/adviser/timing safeguard remain');
  assert.match(paragraphs[12], /^Others do better with a protected start in a nursery, then transplanting\. Tomatoes le brassicas ke tsa sehlopha seo\.$/, 'nursery-first sequence and source crop group remain intact');
  assert.match(paragraphs[17], /^Jwale lokisetsa ho ya ka mobu wa hao — no-dig first, and dig deeper only if your ground genuinely needs it\.$/, 'no-dig remains first and deeper digging remains conditional on genuine need');
  assert.match(paragraphs[11], /They do better sown straight where they'll grow\. Beans, carrots and maize belong in that group/);
  assert.match(paragraphs[14], /mark the bed out\.$/, 'mark-out means the bed boundary, not just a mark on it');
  assert.match(paragraphs[15], /Bophara ba One point two metres\. Bolelele ba Three metres/);
  assert.match(paragraphs[16], /mark both access paths/);
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: source.body + ' changed soil instruction' }, 'st').status, 'english-fallback');
});

test('Sesotho pest step framing preserves diagnosis before action and treatment safeguards with source drift fallback', async () => {
  const { SESOTHO_VEGETABLES_STAPLES_DRAFT } = await import('../lib/course-translation-drafts-st-vegetables-staples.ts');
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons[3];
  const draft = SESOTHO_VEGETABLES_STAPLES_DRAFT.lessons[3];
  assert.equal(draft.body.sourceEnglish, source.body);
  const paragraphs = draft.body.sesothoDraft.split('\n\n');
  assert.equal(paragraphs.length, source.body.split('\n\n').length);
  assert.match(paragraphs[2], /pele o phekola eng kapa eng.*system yohle/);
  assert.match(paragraphs[5], /mehato e mene, ka tatellano/);
  assert.match(paragraphs[9], /Ke ka morao feela/);
  assert.ok(paragraphs[9].includes('lightest thing that works'));
  assert.ok(paragraphs[9].includes('Netefatsa hore ketso e loketse bothata') &&
    paragraphs[9].includes('behe leihlo sephethong'),
  'the action-fit and result-monitoring clauses are localized without changing the preceding treatment safeguards');
  assert.equal(paragraphs[10], source.body.split('\n\n')[10]);
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), source.quiz.map(question => question.correct));
  assert.equal(resolveLearnerLessonPresentation(source, 'st').content.body, draft.body.sesothoDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: source.body + ' Changed treatment condition.' }, 'st').status, 'english-fallback');
});
