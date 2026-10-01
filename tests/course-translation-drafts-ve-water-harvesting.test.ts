import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { regionalModuleDraftBadge, resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';

test('regional Study cards distinguish English module copy from available lesson drafts', () => {
  const source = (id: string) => {
    const module = COURSE_MODULES.find(candidate => candidate.id === id);
    assert.ok(module, `missing source module ${id}`);
    return module;
  };
  assert.equal(regionalModuleDraftBadge(source('seeds-sovereignty'), 've'),
    'English module · 1 lesson draft available');
  assert.equal(regionalModuleDraftBadge(source('soil-health'), 'ts'),
    'English module · 2 lesson drafts available');
  assert.equal(regionalModuleDraftBadge(source('market-community'), 've'),
    'English module · 3 lesson drafts available');
  assert.equal(regionalModuleDraftBadge(source('soil-health'), 've'),
    'Tshivenda AI draft · review pending');
  assert.equal(regionalModuleDraftBadge({ ...source('soil-health'), lessons: [] }, 'ts'),
    'English module');

  for (const language of ['st', 've', 'ts'] as const) {
    for (const module of COURSE_MODULES) {
      const lessonDrafts = module.lessons.filter(lesson =>
        resolveLearnerLessonPresentation(lesson, language).status === 'draft').length;
      if (resolveCourseModulePresentation(module, language).status === 'english-fallback' && lessonDrafts > 0) {
        assert.match(regionalModuleDraftBadge(module, language), /lesson drafts? available$/,
          `${language} ${module.id} has lesson drafts that must be discoverable`);
      }
    }
  }
});

test('Water Harvesting Tshivenda draft keeps safety guidance exact and answer mapping intact', () => {
  const source = COURSE_MODULES.find(module => module.id === 'water-harvesting');
  assert.ok(source, 'the draft must stay paired to the canonical Water Harvesting module');
  const draft = TSHIVENDA_WATER_HARVESTING_DRAFT;
  assert.equal(draft.language, 've');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const titles: Record<string, string> = {
    'water-harvesting': 'U Kuvhanganya Maḓi',
    'water-harvesting-l1': 'Mikubo (Swales) na Ṱhanga dza Mavu (Berms): U Fhungudza Luvhilo lwa Maḓi kha U Sendama ha Mavu',
    'water-harvesting-l2': 'Madamu na Zwidziva zwa Bulasini: U Vhulunga Maḓi a Tshifhinga tsha Gomelelo',
    'water-harvesting-l3': 'Dzithanngi dza Maḓi a Mvula na U Kuvhanganya Maḓi kha Mutombo: U Kuvhanganya na U Tsireledza Maḓi',
  };
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: retain exact English beside every draft`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: draft or explicit English hold must exist`);
    assert.deepEqual(numberTokens(pair.tshivendaDraft), numberTokens(english), `${path}: preserve all figures`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.tshivendaDraft, english, `${path}: held safety text must stay exact English`);
    else assert.equal(pair.reviewStatus, 'machine-draft', `${path}: translated text must be marked machine draft`);
  };

  checkPair(draft.title, source.title, 'module.title');
  assert.equal(draft.title.tshivendaDraft, titles[source.id]);
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.description.reviewStatus, 'hold', 'module claim involving greywater stays English');
  assert.equal(draft.lessons.length, 4, 'all four core lessons are represented');
  for (const [i, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[i];
    const path = `lessons[${i}] ${original.id}`;
    assert.equal(lesson.id, original.id);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: pair source infographic copy`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      assert.equal(lesson.infographicAlt.reviewStatus, 'hold', `${path}: safety diagram copy stays English`);
    } else assert.equal(lesson.infographicAlt, undefined);
    checkPair(lesson.title, original.title, `${path}.title`);
    if (titles[original.id]) assert.equal(lesson.title.tshivendaDraft, titles[original.id]);
    else assert.equal(lesson.title.reviewStatus, 'hold', 'greywater reuse title stays English');
    checkPair(lesson.body, original.body, `${path}.body`);
    const bodySentences: Record<string, string> = lesson.id === 'water-harvesting-l2'
      ? {
          'Rainfall seasons differ across South Africa.': 'Tshifhinga tsha mvula tshi a fhambana u mona na Afurika Tshipembe.',
        }
      : lesson.id === 'water-harvesting-l3'
        ? {
            'Your roof can collect rainwater. The amount depends on roof area, rainfall and losses.': 'Ṱhanga ya ṋu i nga kuvhanganya madi a mvula. Madi ane a wanala a bva kha vhuhulwane ha ṱhanga, mvula na madi a xelaho.',
            'An annual total does not tell you how much water will be available during a dry spell.': 'Tshivhalo tsha ṅwaha woṱhe a tshi ni vhudzi uri hu ḓo vha na madi mangana nga tshifhinga tsha gomelelo.',
          }
        : {};
    let expectedBody = original.body;
    for (const [english, tshivenda] of Object.entries(bodySentences)) {
      assert.equal(original.body.split(english).length - 1, 1, `${path}.body: selected sentence occurs once in the source`);
      expectedBody = expectedBody.replace(english, tshivenda);
    }
    assert.equal(lesson.body.reviewStatus, Object.keys(bodySentences).length ? 'machine-draft' : 'hold',
      `${path}: only screened concept sentences are translated`);
    assert.equal(lesson.body.tshivendaDraft, expectedBody,
      `${path}: retain exact source English outside the selected sentences`);
    assert.equal(lesson.body.tshivendaDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}: retain paragraph boundaries`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length);
    for (const [j, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[j], `${path}.keyPoints[${j}]`);
      assert.equal(point.reviewStatus, 'hold', `${path}: actionable safety summary stays English`);
    }
    assert.equal(lesson.quiz.length, original.quiz.length);
    for (const [j, question] of lesson.quiz.entries()) {
      const originalQuestion = original.quiz[j];
      checkPair(question.question, originalQuestion.q, `${path}.quiz[${j}].question`);
      assert.equal(question.options.length, originalQuestion.options.length);
      for (const [k, option] of question.options.entries()) checkPair(option, originalQuestion.options[k], `${path}.quiz[${j}].options[${k}]`);
      assert.equal(question.sourceCorrectIndex, originalQuestion.correct, `${path}.quiz[${j}]: answer index stays unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, originalQuestion.options[originalQuestion.correct], `${path}.quiz[${j}]: correct answer remains paired`);
      checkPair(question.rationale, originalQuestion.rationale, `${path}.quiz[${j}].rationale`);
      assert.equal(question.question.reviewStatus, 'hold', `${path}: water-safety quiz remains English`);
    }
  }

  const held = [draft.description, ...draft.lessons.flatMap(l => [l.body, ...l.keyPoints, ...l.quiz.flatMap(q => [q.question, ...q.options, q.rationale])])]
    .filter(p => p.reviewStatus === 'hold' || p.sourceEnglish !== p.tshivendaDraft)
    .map(p => `${p.sourceEnglish}\n${p.tshivendaDraft}`).join('\n');
  for (const criticalClaim of ['safe overflow', 'earth dam wall', 'first-flush diverter', 'not make the remaining water safe to drink', 'qualified local sanitation adviser', 'soil and mulch do not disinfect']) {
    assert.ok(held.toLowerCase().includes(criticalClaim.toLowerCase()), `critical claim stays held in English: ${criticalClaim}`);
  }
});

test('Tshivenda Water Harvesting keeps technical lesson instructions English and shows source-paired concept drafts', () => {
  const source = COURSE_MODULES.find(module => module.id === TSHIVENDA_WATER_HARVESTING_DRAFT.id);
  assert.ok(source, 'the canonical Water Harvesting module must exist');
  const modulePresentation = resolveCourseModulePresentation(source, 've');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, TSHIVENDA_WATER_HARVESTING_DRAFT.title.tshivendaDraft);
  assert.equal(modulePresentation.description, source.description,
    'the module description stays English while its translation is held');

  assert.equal(source.lessons.length, TSHIVENDA_WATER_HARVESTING_DRAFT.lessons.length);
  for (const [index, lesson] of source.lessons.entries()) {
    const draft = TSHIVENDA_WATER_HARVESTING_DRAFT.lessons[index];
    const presentation = resolveLearnerLessonPresentation(lesson, 've');
    assert.equal(presentation.status, index < 3 ? 'draft' : 'english-fallback',
      `${lesson.id}: report a draft only while at least one source-paired field is translated`);
    assert.equal(presentation.content.title, draft.title.reviewStatus === 'hold'
      ? lesson.title : draft.title.tshivendaDraft, `${lesson.id}: only explicitly drafted titles change`);
    assert.equal(presentation.content.body, draft.body.tshivendaDraft,
      `${lesson.id}: show only exact-source-paired body wording, with technical instructions retained`);
    assert.deepEqual(presentation.content.keyPoints, lesson.keyPoints, `${lesson.id}: safety summary remains English`);
    assert.deepEqual(presentation.content.quiz, lesson.quiz, `${lesson.id}: water-safety quiz remains English`);
    assert.equal(draft.title.sourceEnglish, lesson.title, `${lesson.id}: title is paired to exact English source`);

    const changedSource = { ...lesson, body: `${lesson.body} Changed.` };
    assert.equal(resolveLearnerLessonPresentation(changedSource, 've').status, 'english-fallback',
      `${lesson.id}: changed source withdraws the entire paired draft`);
  }

  assert.equal(resolveCourseModulePresentation({ ...source, title: `${source.title} Changed.` }, 've').status,
    'english-fallback', 'changed module source withdraws its card title');
  assert.deepEqual(resolveDeckLang(source.id, 've'), { lang: 've', exact: true },
    'the silent, source-paired Tshivenda review deck is available');
  assert.deepEqual(resolveNarrationLang(source.id, 've'), { lang: 'en', exact: false },
    'Tshivenda narration remains explicitly identified as English');
});

test('Soil Health Tshivenda L1 pairs observations while holding the jar procedure and uncertain diagnosis', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health');
  assert.ok(source, 'Soil Health draft must remain paired to its canonical English module');
  const draft = TSHIVENDA_SOIL_HEALTH_DRAFT;
  assert.equal(draft.language, 've');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(source.lessons.length, 3);
  assert.equal(draft.lessons.length, 3);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const translated = new Map([
    ['module.title', 'Mutakalo wa Mavu na U Ita Khomposo (Composting)'],
    ['lessons[0].title', 'U Pfesesa Mavu Aṋu: Mutheo wa Zwoṱhe'],
    ['lessons[0].keyPoints[0]', 'Shumisani zwiṱalusi zwo vhalaho u ṱola vhuimo ha mavu.'],
    ['lessons[0].keyPoints[1]', 'Muvhala wa mavu na tshivhalo tsha zwivhungu fhedzi a zwi sumbedzi uri thaidzo yo vhangwa nga mini.'],
    ['lessons[0].keyPoints[2]', 'U lingedza nga jar zwi sumbedza texture nga u anganyela fhedzi, a si soil test yo fhelelaho.'],
    ['lessons[1].title', 'U Ita na U Shumisa Khomposo (Compost)'],
  ]);
  const soilConceptSentences = new Map([
    ['Soil contains many kinds of living organisms.', 'Mavu a na mifuda minzhi ya living organisms.'],
    ['Bacteria and fungi help break down organic matter and cycle nutrients.', 'Bacteria na fungi dzi thusa u kwashekanya organic matter na u cycle nutrients.'],
    ['Some fungi help roots take up nutrients.', 'Dziṅwe fungi dzi thusa midzi u dzhia nutrients.'],
    ['Worm channels can help water and air enter soil.', 'Worm channels dzi nga thusa uri maḓi na muya zwi dzhene mavuni.'],
    ['Compaction, poor drainage and loss of organic matter can limit roots and soil life.', 'Compaction, poor drainage na loss ya organic matter zwi nga limit midzi na soil life.'],
    ['Worm activity also changes with moisture and season.', 'U shuma ha worms na hone hu a shanduka u ya nga moisture na season.'],
    ['Look at roots, soil structure and water movement as well as visible soil life.', 'Sedzani midzi, tshivhumbeo tsha mavu na u tshimbila ha maḓi, ni dovhe ni sedze zwithu zwi tshilaho zwine zwa vhonala mavuni.'],
    ['Compare the settled layers and feel the soil in the field.', 'Vhambedzani zwipiḓa zwe zwa dzula fhasi, ni dovhe ni fare mavu tsimuni.'],
    ['Record what you see and what remains uncertain. Do not prescribe watering or soil treatments from one jar alone.', 'Ṅwalani zwe na zwi vhona na zwine zwa kha ḓi sa vha khagala. Ni songo dzhia phetho ya u sheledza kana u lafha mavu nga u sedza jar nthihi fhedzi.'],
  ]);
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  let heldFields = 0;
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string, shouldTranslate = false) => {
    assert.equal(pair.sourceEnglish, english, `${path}: preserve the exact English source`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: include translated wording or an exact-English hold`);
    assert.deepEqual(numberTokens(pair.tshivendaDraft), numberTokens(english), `${path}: preserve numeric tokens`);
    if (shouldTranslate || translated.has(path)) {
      assert.equal(pair.reviewStatus, 'machine-draft', `${path}: label AI text as an unreviewed draft`);
      assert.equal(pair.tshivendaDraft, translated.get(path), `${path}: keep the pinned (glossary-aligned) draft wording`);
    } else {
      heldFields++;
      assert.equal(pair.reviewStatus, 'hold', `${path}: farming content must remain held for fluent local review`);
      assert.equal(pair.tshivendaDraft, english, `${path}: held wording must stay exact English`);
    }
  };

  checkPair(draft.title, source.title, 'module.title', true);
  checkPair(draft.description, source.description, 'module.description');
  for (const [index, lesson] of source.lessons.entries()) {
    const paired = draft.lessons[index];
    const path = `lessons[${index}]`;
    assert.equal(paired.id, lesson.id);
    if (lesson.infographicAlt) checkPair(paired.infographicAlt!, lesson.infographicAlt, `${path}.infographicAlt`);
    else assert.equal(paired.infographicAlt, undefined);
    checkPair(paired.title, lesson.title, `${path}.title`, index < 2);
    if (index === 0) {
      assert.equal(paired.body.sourceEnglish, lesson.body, `${path}.body: pair the complete canonical lesson exactly`);
      assert.equal(paired.body.reviewStatus, 'machine-draft', `${path}.body: identify the unreviewed learner draft`);
      let expectedBody = lesson.body;
      for (const [english, tshivenda] of soilConceptSentences) {
        assert.equal(lesson.body.split(english).length - 1, 1, `${path}.body: selected English sentence occurs once`);
        expectedBody = expectedBody.replace(english, tshivenda);
      }
      assert.equal(paired.body.tshivendaDraft, expectedBody,
        `${path}.body: only screened concepts and observations change; procedure and complex diagnosis stay exact English`);
      assert.deepEqual(numberTokens(paired.body.tshivendaDraft), numberTokens(lesson.body),
        `${path}.body: preserve every numeric source token`);
      assert.equal(paired.body.tshivendaDraft.split('\n\n').length, lesson.body.split('\n\n').length,
        `${path}.body: preserve every paragraph boundary`);
      assert.ok(paired.body.tshivendaDraft.includes('Pale colour or few worms do not prove that chemicals killed the soil.'),
        `${path}.body: retain the uncertain negation in exact English`);
      assert.ok(paired.body.tshivendaDraft.includes('Put soil and water in a clear jar, with a little suitable dispersing detergent.'),
        `${path}.body: retain the full jar procedure in exact English`);
    } else {
      checkPair(paired.body, lesson.body, `${path}.body`);
      assert.deepEqual(paired.body.tshivendaDraft.split('\n\n'), lesson.body.split('\n\n'), `${path}: preserve paragraph boundaries`);
    }
    assert.equal(paired.keyPoints.length, lesson.keyPoints.length);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      checkPair(paired.keyPoints[pointIndex], point, `${path}.keyPoints[${pointIndex}]`);
    }
    assert.equal(paired.quiz.length, lesson.quiz.length);
    assert.equal(lesson.quiz.length, 2, `${path}: preserve both source quiz items`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const pairedQuestion = paired.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(pairedQuestion.question, question.q, `${questionPath}.question`);
      assert.equal(pairedQuestion.options.length, question.options.length);
      for (const [optionIndex, option] of question.options.entries()) {
        checkPair(pairedQuestion.options[optionIndex], option, `${questionPath}.options[${optionIndex}]`);
      }
      assert.equal(pairedQuestion.sourceCorrectIndex, question.correct, `${questionPath}: preserve answer index`);
      assert.equal(pairedQuestion.options[pairedQuestion.sourceCorrectIndex]?.sourceEnglish, question.options[question.correct],
        `${questionPath}: keep the correct answer paired to its source option`);
      checkPair(pairedQuestion.rationale, question.rationale, `${questionPath}.rationale`);
    }
  }

  assert.equal(heldFields, 52, 'hold the module summary, all illustration descriptions, diagnostic key point and other body and quiz fields');

  const modulePresentation = resolveCourseModulePresentation(source, 've');
  assert.equal(modulePresentation.status, 'draft', 'show the existing, visibly labelled Tshivenda module draft');
  assert.equal(modulePresentation.title, draft.title.tshivendaDraft);
  assert.equal(modulePresentation.description, source.description,
    'technical module summary stays exact English until its terms are checked');
  for (const [index, lesson] of source.lessons.entries()) {
    const presentation = resolveLearnerLessonPresentation(lesson, 've');
    const paired = draft.lessons[index];
    assert.equal(presentation.status, index < 2 ? 'draft' : 'english-fallback',
      `${lesson.id}: status only claims a draft when at least one field is translated`);
    assert.equal(presentation.content.title, paired.title.tshivendaDraft, `${lesson.id}: show the paired title draft`);
    assert.equal(presentation.content.body, paired.body.tshivendaDraft,
      `${lesson.id}: show only its exact-source-paired body draft or exact-English hold`);
    const expectedKeyPoints = lesson.keyPoints.map((point, pointIndex) =>
      translated.get(`lessons[${index}].keyPoints[${pointIndex}]`) ?? point);
    assert.deepEqual(presentation.content.keyPoints, expectedKeyPoints,
      `${lesson.id}: show only the three bounded Tshivenda observation summaries`);
    assert.deepEqual(presentation.content.quiz, lesson.quiz, `${lesson.id}: keep questions and answers in exact English`);
    assert.equal(presentation.content.infographicAlt, lesson.infographicAlt,
      `${lesson.id}: image descriptions stay exact English holds`);

    assert.equal(resolveLearnerLessonPresentation({ ...lesson, title: `${lesson.title} changed` }, 've').status,
      'english-fallback', `${lesson.id}: changed source withdraws the whole paired draft`);
  }
  assert.equal(resolveCourseModulePresentation({ ...source, description: `${source.description} changed` }, 've').status,
    'english-fallback', 'changed module source withdraws the card draft');
});

test('Tshivenda Food Forest L1 draft keeps only bounded teaching text translated and preserves the planting safeguards', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(source, 'Food Forest must remain paired to the canonical English module');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT;
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.language, 've');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), ['food-forest-l1', 'food-forest-l2', 'food-forest-l3'],
    'only the bounded L1, L2 and L3 learner drafts are included');

  const lesson = source.lessons.find(item => item.id === 'food-forest-l1');
  assert.ok(lesson, 'the canonical L1 must remain available');
  const lessonDraft = draft.lessons[0];
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: keep the canonical English beside its draft`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: keep a draft or exact-English hold`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.tshivendaDraft, english, `${path}: hold must remain exact English`);
    else assert.equal(pair.reviewStatus, 'machine-draft', `${path}: unreviewed wording must remain labelled`);
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  checkPair(lessonDraft.title, lesson.title, 'lesson.title');
  assert.ok(lesson.infographicAlt);
  assert.ok(lessonDraft.infographicAlt);
  checkPair(lessonDraft.infographicAlt, lesson.infographicAlt, 'lesson.infographicAlt');
  assert.doesNotMatch(lesson.infographicAlt, /root crops|seven layers/i,
    'the actual diagram shows woody roots and overlapping heights, not identifiable root crops or seven countable layers');
  assert.equal(lessonDraft.infographicAlt.reviewStatus, 'hold',
    'the corrected image description needs a new Tshivenda translation');
  checkPair(lessonDraft.body, lesson.body, 'lesson.body');
  const originalParagraphs = lesson.body.split('\n\n');
  const draftParagraphs = lessonDraft.body.tshivendaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, 13, 'the body keeps all thirteen original paragraph boundaries');
  for (const index of [0, 1, 2, 3, 4, 5, 6]) {
    assert.notEqual(draftParagraphs[index], originalParagraphs[index], `paragraph ${index + 1} carries its machine draft`);
  }
  assert.equal(draftParagraphs[1],
    'Zwimela zwo fhambanaho zwi shumisa tshedza na u tsakama zwine zwa vha hone hune zwi aluwa hone.',
    'describe the light and moisture available at each layer for Tshivenda learners');
  assert.equal(draftParagraphs[10],
    'Zwimela zwiṱuku zwi ṱoḓa ṱhogomelo musi zwi tshi thoma u ḓowela fhethu: sedzani u tsakama ha mavu, ni lange tsheṋe, ni zwi tsireledze kha u huvhala.',
    'pair the bounded establishment-care sentence with its English source');
  assert.equal(draftParagraphs[11],
    'Musi zwimela zwi tshi aluwa, murunzi na matoko a maṱari zwi shandula nyimele fhasi hazwo.',
    'describe the changing conditions below growing plants');
  for (const index of [7, 8, 9, 12]) {
    assert.equal(draftParagraphs[index], originalParagraphs[index], `paragraph ${index + 1} stays exact English`);
  }
  assert.equal(lessonDraft.keyPoints.length, lesson.keyPoints.length);
  for (const [index, point] of lessonDraft.keyPoints.entries()) {
    checkPair(point, lesson.keyPoints[index], `keyPoints[${index}]`);
    assert.equal(point.reviewStatus, index === 0 || index === 1 || index === 3 ? 'machine-draft' : 'hold');
  }
  assert.equal(lessonDraft.quiz.length, lesson.quiz.length);
  for (const [index, question] of lessonDraft.quiz.entries()) {
    const originalQuestion: (typeof lesson.quiz)[number] = lesson.quiz[index];
    checkPair(question.question, originalQuestion.q, `quiz[${index}].question`);
    assert.equal(question.options.length, originalQuestion.options.length);
    for (const [optionIndex, option] of question.options.entries()) {
      checkPair(option, originalQuestion.options[optionIndex], `quiz[${index}].options[${optionIndex}]`);
    }
    assert.equal(question.sourceCorrectIndex, originalQuestion.correct, `quiz[${index}]: retain source answer index`);
    assert.equal(question.options[question.sourceCorrectIndex].sourceEnglish, originalQuestion.options[originalQuestion.correct]);
    checkPair(question.rationale, originalQuestion.rationale, `quiz[${index}].rationale`);
  }

  const sensitiveEnglish = [
    'Wild Fig', 'pecan', 'lemon', 'naartjie', 'black mulberry', 'Cape gooseberry', 'Wild Medlar',
    'wild garlic', 'sweet potato', 'granadilla', 'local restrictions', 'frost tolerance', 'fixed birthday',
  ];
  for (const term of sensitiveEnglish) {
    assert.ok(lessonDraft.body.tshivendaDraft.includes(term), `source-sensitive content remains present: ${term}`);
  }

  const modulePresentation = resolveCourseModulePresentation(source, 've');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.tshivendaDraft);
  assert.equal(modulePresentation.description, draft.description.tshivendaDraft);
  const learnerPresentation = resolveLearnerLessonPresentation(lesson, 've');
  assert.equal(learnerPresentation.status, 'draft');
  assert.equal(learnerPresentation.content.title, lessonDraft.title.tshivendaDraft);
  assert.equal(learnerPresentation.content.body, lessonDraft.body.tshivendaDraft);
  assert.equal(learnerPresentation.content.keyPoints[0], lessonDraft.keyPoints[0].tshivendaDraft);
  assert.equal(learnerPresentation.content.keyPoints[1], lessonDraft.keyPoints[1].tshivendaDraft);
  assert.equal(learnerPresentation.content.keyPoints[2], lesson.keyPoints[2],
    'ambiguous establishment wording stays exact English');
  assert.equal(learnerPresentation.content.keyPoints[3], lessonDraft.keyPoints[3].tshivendaDraft);
  assert.equal(learnerPresentation.content.quiz[0].q, lesson.quiz[0].q,
    'the unclear next-action question stays exact English');
  assert.deepEqual(learnerPresentation.content.quiz[0].options.slice(0, 2), lesson.quiz[0].options.slice(0, 2));
  assert.equal(learnerPresentation.content.quiz[0].options[2], lessonDraft.quiz[0].options[2].tshivendaDraft);
  assert.equal(learnerPresentation.content.quiz[0].options[3], lessonDraft.quiz[0].options[3].tshivendaDraft);
  assert.equal(learnerPresentation.content.quiz[0].correct, lesson.quiz[0].correct,
    'the translated options must not move the correct answer');
  assert.equal(learnerPresentation.content.quiz[0].rationale, lessonDraft.quiz[0].rationale.tshivendaDraft);
  assert.deepEqual(learnerPresentation.content.quiz[1], lesson.quiz[1],
    'the water-demand question remains exact English');
  assert.equal(learnerPresentation.content.infographicAlt, lessonDraft.infographicAlt.tshivendaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, title: `${lesson.title} changed` }, 've').status,
    'english-fallback', 'a changed English source withdraws the whole paired lesson draft');
  assert.equal(resolveCourseModulePresentation({ ...source, description: `${source.description} changed` }, 've').status,
    'english-fallback', 'a changed module source withdraws its paired card draft');
});
