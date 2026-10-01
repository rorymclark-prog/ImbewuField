import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT as vegetablesL3Draft, TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as learnerVegetablesDraft } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';

test('the Tshivenda Introduction draft stays paired to the English Study source', () => {
  const draft = TSHIVENDA_INTRO_PERMACULTURE_DRAFT;
  const source = COURSE_MODULES.find(module => module.id === draft.id);
  assert.ok(source, 'draft module must exist in the canonical Study source');
  assert.equal(draft.language, 've');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);

  const digitTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; tshivendaDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: English source must match byte for byte`);
    assert.ok(pair.tshivendaDraft.trim(), `${path}: draft or exact-English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: unknown review state`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.tshivendaDraft, english, `${path}: held text must remain exact English`);
    assert.deepEqual(placeholders(pair.tshivendaDraft), placeholders(english), `${path}: placeholders must be preserved`);
    assert.deepEqual(digitTokens(pair.tshivendaDraft), digitTokens(english), `${path}: numeric figures must be preserved`);
    if (/\bmaize\b/i.test(english) && pair.reviewStatus === 'machine-draft') {
      // Crop identity can be explicit English, with or without parentheses.
      assert.match(pair.tshivendaDraft, /\bmaize\b/i, `${path}: retain source crop identity in translated text`);
    }
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  for (const [lessonIndex, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
    const path = `lessons[${lessonIndex}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: lesson order and IDs must match`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sourceEnglish.split('\n\n').length, lesson.body.tshivendaDraft.split('\n\n').length,
      `${path}.body: paragraph breaks must stay aligned`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: source infographic alt must be represented`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      if (original.id === 'intro-permaculture-l3') {
        assert.equal(lesson.infographicAlt.reviewStatus, 'hold', 'the old Tshivenda rings description must not describe the footpath picture');
      }
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic alt text`);
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key point count must match`);
    lesson.keyPoints.forEach((point, index) => checkPair(point, original.keyPoints[index], `${path}.keyPoints[${index}]`));
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz count must match`);
    lesson.quiz.forEach((question, questionIndex) => {
      const sourceQuestion = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, sourceQuestion.q, `${questionPath}.question`);
      assert.equal(question.options.length, sourceQuestion.options.length, `${questionPath}: option order/count must match`);
      question.options.forEach((option, optionIndex) => checkPair(option, sourceQuestion.options[optionIndex], `${questionPath}.options[${optionIndex}]`));
      assert.equal(question.sourceCorrectIndex, sourceQuestion.correct, `${questionPath}: answer index must be copied unchanged`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, sourceQuestion.options[sourceQuestion.correct],
        `${questionPath}: correct index must still point to the canonical answer`);
      checkPair(question.rationale, sourceQuestion.rationale, `${questionPath}.rationale`);
    });
  }
});

test('Tshivenda Soil L1 jar draft stays aligned and preserves diagnostic limits', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_SOIL_HEALTH_DRAFT.id);
  assert.ok(sourceModule, 'Soil Health source module must exist');
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l1');
  const draftLesson = TSHIVENDA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === 'soil-health-l1');
  assert.ok(sourceLesson, 'canonical Soil L1 source must exist');
  assert.ok(draftLesson, 'Tshivenda Soil L1 draft must exist');

  assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
  assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body,
    'the translation must remain paired to the exact canonical body');
  const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, draftLesson.body.tshivendaDraft,
    'the matched complete body must reach the learner as a marked draft');
  assert.equal(resolveLearnerLessonPresentation({ ...sourceLesson, body: `${sourceLesson.body} Changed source.` }, 've').status,
    'english-fallback', 'source drift must fail closed to the canonical English body');
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const paragraphs = draftLesson.body.tshivendaDraft.split('\n\n');
  assert.equal(sourceParagraphs.length, 12);
  assert.equal(paragraphs.length, sourceParagraphs.length,
    'every learner paragraph must remain aligned with its English source');

  assert.equal(paragraphs[0], 'Mavu a na mifuda minzhi ya living organisms. Bacteria na fungi dzi thusa u kwashekanya organic matter na u cycle nutrients.');
  assert.equal(paragraphs[1], 'Dziṅwe fungi dzi thusa midzi u dzhia nutrients. Worm channels dzi nga thusa uri maḓi na muya zwi dzhene mavuni.');
  assert.equal(paragraphs[2], 'Sedzani midzi, tshivhumbeo tsha mavu na u tshimbila ha maḓi, ni dovhe ni sedze zwithu zwi tshilaho zwine zwa vhonala mavuni.');
  assert.equal(paragraphs[7], 'Vhambedzani zwipiḓa zwe zwa dzula fhasi, ni dovhe ni fare mavu tsimuni.');
  assert.equal(paragraphs[8], 'Ṅwalani zwe na zwi vhona na zwine zwa kha ḓi sa vha khagala. Ni songo dzhia phetho ya u sheledza kana u lafha mavu nga u sedza jar nthihi fhedzi.');
  assert.ok(paragraphs[10].endsWith('U shuma ha worms na hone hu a shanduka u ya nga moisture na season.'),
    'the previously translated seasonal caveat must stay intact');

  assert.match(paragraphs[3], /soil na water kha clear jar.*little suitable dispersing detergent.*vale jar.*dzinginye.*i sa tshintshwi/,
    'the clear-jar procedure must retain the suitable small detergent amount and shake/rest sequence');
  assert.match(paragraphs[4], /Sand.*settles pele.*Silt.*settles nga murahu.*clay.*suspended much longer/,
    'the sand, silt and clay settling order and longer suspension must remain distinct');
  assert.match(paragraphs[5], /rough learning exercise.*Clumps.*zwi nga ni xedza.*soil laboratory.*accurate texture/,
    'the jar exercise must remain rough and defer accurate texture to a soil laboratory');
  assert.match(paragraphs[6], /Thick sand layer.*cloudy water.*a i athu.*final proportions.*Fine particles.*nga kha ḓi.*suspended/,
    'cloudy water must not be treated as final proportions while fine particles may remain suspended');
  assert.match(paragraphs[9], /Compaction.*poor drainage.*loss ya organic matter.*zwi nga limit/,
    'the three soil limitations must remain possible rather than certain outcomes');
  assert.match(paragraphs[10], /few worms.*a zwi prove.*chemicals.*moisture na season/,
    'pale colour or few worms must not prove chemical damage, and worm activity remains seasonal');
  assert.match(paragraphs[11], /patterns.*management history.*drainage.*u aluwa ha plants.*ni sa athu khetha remedy/,
    'management history, drainage and growth must be checked before choosing a remedy');
  for (const [index, source] of sourceParagraphs.entries()) {
    assert.notEqual(paragraphs[index], source, `paragraph ${index + 1} must not silently fall back to an English hold`);
  }
});

test('Tshivenda Introduction L3 preserves zone frequencies and the observed wind direction', async () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_INTRO_PERMACULTURE_DRAFT.id);
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'intro-permaculture-l3');
  const draftLesson = TSHIVENDA_INTRO_PERMACULTURE_DRAFT.lessons.find(lesson => lesson.id === 'intro-permaculture-l3');
  assert.ok(sourceLesson);
  assert.ok(draftLesson);

  assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
  assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);
  const paragraphs = draftLesson.body.tshivendaDraft.split('\n\n');
  assert.equal(paragraphs.length, 3, 'all three source paragraphs must be translated and aligned');
  assert.match(paragraphs[0], /Zone 0 ndi nnḓu/);
  assert.match(paragraphs[0], /Zone 1.*tsini na nnḓu.*herbs na muroho wa saladi/);
  assert.match(paragraphs[0], /Zone 2.*serapa tshihulwane.*chicken run.*luthihi kana luvhili.*nga ḓuvha/);
  assert.match(paragraphs[0], /Zone 3.*tsimu khulwane.*vhege iṅwe na iṅwe/);
  assert.match(paragraphs[0], /Zone 4.*semi-wild.*miri ya mitshelo.*fodder.*zwiṅwe zwifhinga/);
  assert.match(paragraphs[0], /Zone 5.*wild/);
  assert.match(paragraphs[1], /Sectors.*energy.*ḓuvha, muya, mvula, mandindi na mulilo/);
  assert.match(paragraphs[1], /weather station.*dzi nga thusa.*thungo ya muya/,
    'nearby records can help check wind direction; they do not guarantee it');
  assert.match(paragraphs[1], /Sedzani hune maḓi a mvula a dzhena hone na hune a elela hone kha land yaṋu/);
  assert.match(paragraphs[1], /Olani misevhe.*zwe na zwi vhona/);
  assert.match(paragraphs[2], /Olani zones na sectors.*motheo wa pulane yaṋu/);

  const herbPoint = draftLesson.keyPoints[0];
  const designPoint = draftLesson.keyPoints[3];
  assert.equal(herbPoint.sourceEnglish, sourceLesson.keyPoints[0]);
  assert.equal(herbPoint.reviewStatus, 'machine-draft');
  assert.match(herbPoint.tshivendaDraft, /Zone 1.*herbs.*ka lunzhi/);
  assert.doesNotMatch(herbPoint.tshivendaDraft, /zwilavhele/,
    'keep the ambiguous herb name in its exact English form');
  assert.equal(designPoint.sourceEnglish, sourceLesson.keyPoints[3]);
  assert.match(designPoint.tshivendaDraft, /design/);
  assert.doesNotMatch(designPoint.tshivendaDraft, /mufhaṱo/,
    'starting a design must not be narrowed to starting construction');

  const sourceHerbQuiz = sourceLesson.quiz[0];
  const draftHerbQuiz = draftLesson.quiz[0];
  assert.equal(draftHerbQuiz.sourceCorrectIndex, sourceHerbQuiz.correct);
  assert.equal(draftHerbQuiz.question.sourceEnglish, sourceHerbQuiz.q);
  assert.match(draftHerbQuiz.question.tshivendaDraft, /herbs.*Zone 3.*kule na nnḓu/);
  assert.match(draftHerbQuiz.options[1].tshivendaDraft, /nga amba.*herbs less often/,
    'preserve the source possibility and frequency phrase instead of suggesting a smaller quantity');
  assert.match(draftHerbQuiz.rationale.tshivendaDraft, /Bed.*less often/,
    'keep the planting bed and lower visit frequency distinct');
  assert.match(draftHerbQuiz.options[2].tshivendaDraft, /herbs.*cross-pollinate/i);
  assert.doesNotMatch(draftHerbQuiz.options[2].tshivendaDraft, /nga.*cross-pollinate/,
    'do not weaken the direct distractor into a possibility');
  assert.equal(draftHerbQuiz.options[1].sourceEnglish, sourceHerbQuiz.options[1]);

  const sourceWindQuestion = sourceLesson.quiz[1];
  const draftWindQuestion = draftLesson.quiz[1];
  assert.equal(draftWindQuestion.sourceCorrectIndex, sourceWindQuestion.correct);
  for (const [name, pair, source] of [
    ['question', draftWindQuestion.question, sourceWindQuestion.q],
    ...draftWindQuestion.options.map((option, index) => [`option ${index}`, option, sourceWindQuestion.options[index]] as const),
    ['rationale', draftWindQuestion.rationale, sourceWindQuestion.rationale],
  ] as const) {
    assert.equal(pair.reviewStatus, 'machine-draft', `${name}: learner text is visibly an unreviewed draft`);
    assert.equal(pair.sourceEnglish, source, `${name}: exact canonical source remains paired`);
  }
  assert.match(draftWindQuestion.question.tshivendaDraft,
    /damaging wind coming from the north-west on a Highveld farm/,
    'the source-direction condition stays explicit and compass wording remains exact');
  assert.match(draftWindQuestion.options[0].tshivendaDraft, /South-east/);
  assert.match(draftWindQuestion.options[1].tshivendaDraft, /North-west.*vhukati ha muya na zwimela/);
  assert.equal(draftWindQuestion.sourceCorrectIndex, 1,
    'the canonical answer remains the boundary between the observed wind source and crops');
  assert.match(draftWindQuestion.rationale.tshivendaDraft, /muya wa bva khaḽo zwa vhukuma/,
    'the rationale points to the side the observed wind actually comes from');

  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, draftLesson.body.tshivendaDraft);
  assert.deepEqual(presentation.content.quiz[1], {
    q: draftWindQuestion.question.tshivendaDraft,
    options: draftWindQuestion.options.map(option => option.tshivendaDraft),
    correct: sourceWindQuestion.correct,
    rationale: draftWindQuestion.rationale.tshivendaDraft,
  });

  const changedQuizSource = {
    ...sourceLesson,
    quiz: sourceLesson.quiz.map((question, index) => index === 1
      ? { ...question, q: `${question.q} Changed English source.` }
      : question),
  };
  const staleDraft = resolveLearnerLessonPresentation(changedQuizSource, 've');
  assert.equal(staleDraft.status, 'english-fallback', 'quiz source drift invalidates the complete lesson candidate');
  assert.equal(staleDraft.content.body, sourceLesson.body);
  assert.deepEqual(staleDraft.content.quiz, changedQuizSource.quiz);
});

test('Tshivenda Study control drafts stay paired to review text and sensitive controls stay English', async () => {
  const { readFileSync } = await import('node:fs');
  const review = readFileSync(new URL('../docs/study-translation-reviews/STUDY-CONTROLS-VE-AI-DRAFT-REVIEW.md', import.meta.url), 'utf8');
  const ve = readFileSync(new URL('../lib/locales/ve.ts', import.meta.url), 'utf8');
  const english = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  const studentPage = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
  const expectedPairs = [
    ['studentMyStudies', 'My Studies', 'Ngudo dzanga'],
    ['studentCourseDescription', 'Your permaculture course, one practical lesson at a time.', 'Khoso yaṋu ya permaculture, ngudo nthihi ya u shumisa nga tshifhinga.'],
    ['studentOpenLesson', 'Open lesson', 'Vulani ngudo'],
    ['studentCloseLesson', 'Close lesson', 'Valani ngudo'],
    ['studentModule', 'Module {number}', 'Modulu {number}'],
    ['studentModules', 'modules', 'modulu'],
    ['studentLessonOne', 'lesson', 'ngudo'],
    ['studentLessons', 'lessons', 'ngudo'],
    ['studentLessonsLabel', 'Lessons', 'Ngudo'],
    ['studentStart', 'Start studying', 'Thoma u guda'],
    ['studentReady', 'Ready to start', 'No lugela u thoma'],
    ['studentYourCourse', 'Your course', 'Khoso yaṋu'],
    ['studentStudyOffline', 'Study offline', 'Guda u si na inthanethe'],
    ['studentTshivendaUiDraftNotice', 'Unreviewed Tshivenda interface draft. These Study controls have not been checked by a fluent Tshivenda speaker.', 'Unreviewed Tshivenda interface draft. These Study controls have not been checked by a fluent Tshivenda speaker.'],
  ] as const;

  for (const [key, source, draft] of expectedPairs) {
    assert.ok(review.includes(`| \`${key}\` | \`${source}\` | \`${draft}\` |`), `${key}: keep its exact source and draft in the review note`);
    assert.ok(ve.includes(`${key}: '${draft}'`), `${key}: the locale must show the reviewed draft text`);
  }
  assert.ok(studentPage.includes("{lang === 've' && ("), 'show the English draft status whenever Tshivenda is selected in Study');
  assert.ok(studentPage.includes("t('studentTshivendaUiDraftNotice')"), 'render the explicit draft notice');
  assert.ok(ve.includes("studentTshivendaUiDraftNotice: 'Unreviewed Tshivenda interface draft."), 'keep the review notice in exact English');

  for (const [key, expectedEnglish] of [
    ['studentSubmit', 'Submit'],
    ['studentProgressError', 'Progress could not be loaded or saved. Check your connection or account access.'],
    ['studentComplete', 'Complete'],
    ['studentCourseComplete', 'Course complete!'],
    ['studentSubmitting', 'Submitting…'],
    ['studentLocked', 'Locked'],
  ] as const) {
    assert.ok(!new RegExp(`\\b${key}:`).test(ve), `${key}: do not introduce an unreviewed completion, submission or access translation`);
    assert.ok(english.includes(`${key}: '${expectedEnglish}'`), `${key}: preserve the exact English fallback`);
  }
  assert.ok(english.includes('return LOADED[lang]?.[key] ?? LOADED.en[key] ?? key;'), 'missing Tshivenda keys must fall back to English');
});

test('Vegetables L3 shows screened concept sentences while crop advice and answers stay English', async () => {
  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const { resolveCourseModulePresentation } = await import('../lib/course-module-translation-drafts.ts');
  const module = COURSE_MODULES.find(candidate => candidate.id === vegetablesL3Draft.moduleId);
  assert.ok(module);
  const lesson = module.lessons.find(candidate => candidate.id === vegetablesL3Draft.lessonId);
  assert.ok(lesson);
  const paragraphs = lesson.body.split('\n\n');
  const draftLesson = learnerVegetablesDraft.lessons[0];
  assert.equal(paragraphs[0], vegetablesL3Draft.bodyConcept.sourceEnglish);
  assert.equal(paragraphs[vegetablesL3Draft.secondBodyConcept.paragraphIndex], vegetablesL3Draft.secondBodyConcept.sourceEnglish);
  assert.equal(vegetablesL3Draft.additionalBodyConcepts.length, 9);
  assert.equal(draftLesson.body.sourceEnglish, lesson.body, 'source drift must invalidate the entire learner draft');
  assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
  const shown = resolveLearnerLessonPresentation(lesson, 've');
  assert.equal(shown.status, 'draft');
  const translated = shown.content.body.split('\n\n');
  assert.equal(translated.length, paragraphs.length);
  assert.equal(translated[0], vegetablesL3Draft.bodyConcept.tshivendaDraft);
  assert.equal(translated[vegetablesL3Draft.secondBodyConcept.paragraphIndex], vegetablesL3Draft.secondBodyConcept.tshivendaDraft);
  const expectedParagraphs = [...paragraphs];
  expectedParagraphs[vegetablesL3Draft.bodyConcept.paragraphIndex] = vegetablesL3Draft.bodyConcept.tshivendaDraft;
  expectedParagraphs[vegetablesL3Draft.secondBodyConcept.paragraphIndex] = vegetablesL3Draft.secondBodyConcept.tshivendaDraft;
  for (const concept of vegetablesL3Draft.additionalBodyConcepts) {
    assert.equal(paragraphs[concept.paragraphIndex].split(concept.sourceEnglish).length - 1, 1,
      `source paragraph ${concept.paragraphIndex + 1}: selected sentence occurs once`);
    expectedParagraphs[concept.paragraphIndex] = expectedParagraphs[concept.paragraphIndex]
      .replace(concept.sourceEnglish, concept.tshivendaDraft);
  }
  assert.deepEqual(translated, expectedParagraphs,
    'preserve both existing drafts and every other body sentence exactly, including counts and crop guidance');
  assert.match(translated[2], /zwivhili kana zwo engaho/, 'the two-or-more qualifier must survive the new draft');
  assert.equal(translated[14], paragraphs[14], 'keep the two-or-more staples recommendation in English');
  assert.ok(translated[15].endsWith('That difference is the protection.'),
    'the separate protection claim remains exact English');
  paragraphs.forEach((paragraph, index) => {
    if (![0, 1, 2, 5, 11, 12, 13, 15].includes(index)) {
      assert.equal(translated[index], paragraph, `paragraph ${index + 1} stays English`);
    }
  });
  assert.equal(shown.content.title, lesson.title);
  assert.equal(shown.content.infographicAlt, lesson.infographicAlt);
  assert.deepEqual(shown.content.keyPoints, lesson.keyPoints);
  assert.deepEqual(shown.content.quiz, lesson.quiz, 'quiz wording, order, rationales and correct indexes stay exact English');
  assert.equal(learnerVegetablesDraft.title.sourceEnglish, module.title);
  assert.equal(learnerVegetablesDraft.description.sourceEnglish, module.description);
  assert.equal(learnerVegetablesDraft.sourceMetadata.durationMins, module.durationMins);
  assert.equal(learnerVegetablesDraft.sourceMetadata.category, module.category);
  const card = resolveCourseModulePresentation(module, 've');
  assert.equal(card.status, 'english-fallback');
  assert.equal(card.title, module.title);
  assert.equal(card.description, module.description);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} changed` }, 've').status, 'english-fallback');
  assert.equal(resolveCourseModulePresentation({ ...module, description: `${module.description} changed` }, 've').status, 'english-fallback');
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /Unreviewed Tshivenda AI draft/);
  assert.match(page, /lesson\.body\.split\('\\n\\n'\)/, 'the learner view must show every exact English body paragraph');
  const packet = readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-STAPLES-L3-VE-AI-DRAFT-REVIEW.md', import.meta.url), 'utf8');
  assert.ok(packet.includes(vegetablesL3Draft.bodyConcept.sourceEnglish));
  assert.ok(packet.includes(vegetablesL3Draft.bodyConcept.tshivendaDraft));
  assert.ok(packet.includes(vegetablesL3Draft.secondBodyConcept.sourceEnglish));
  assert.ok(packet.includes(vegetablesL3Draft.secondBodyConcept.tshivendaDraft));
  for (const concept of vegetablesL3Draft.additionalBodyConcepts) {
    assert.ok(packet.includes(concept.sourceEnglish), `review packet includes source: ${concept.sourceEnglish}`);
    assert.ok(packet.includes(concept.tshivendaDraft), `review packet includes draft: ${concept.tshivendaDraft}`);
  }
});
