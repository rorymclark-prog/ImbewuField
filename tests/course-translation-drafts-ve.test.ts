import { finalLanguageNextNativeBefore } from './final-language-next-checks.ts';
import { nativeOrdinaryBeforeFinalBatch } from './native-ordinary-final-history-checks.ts';
import { vegetablesL3PresentationBeforeOrdinary } from './vegetables-l3-ordinary-residual-checks.ts';
import { vegetablesBeforePestPrecision } from './vegetables-pest-precision-checks.ts';
import { vegetablesBeforeFuller } from './vegetables-l1-fuller-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES, type QuizQuestion } from '../lib/course-modules.ts';
import { resolveBeforeFullerSoilPresentation as resolveBeforeSoilPresentation } from './soil-ordinary-native-history-checks.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT as currentIntroDraft } from '../lib/course-translation-drafts-ve.ts';
import { validateAndRewindIntroNativeHistory, introPresentationBeforeSilentRelease } from './intro-silent-release-text-checks.ts';
// Historical clauses are exposed only after both accepted source-bound Intro text layers validate.
const TSHIVENDA_INTRO_PERMACULTURE_DRAFT = validateAndRewindIntroNativeHistory('ve', currentIntroDraft) as typeof currentIntroDraft;
const resolveLearnerLessonPresentation: typeof resolveBeforeSoilPresentation = (lesson, language) =>
  introPresentationBeforeSilentRelease(lesson, language, resolveBeforeSoilPresentation(lesson, language));
// Preserve earlier Soil clause coverage against dated text; live accepted targets are checked before rewind.
import { historicalVE as TSHIVENDA_SOIL_HEALTH_DRAFT } from './soil-learner-reviewed-history.ts';
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

test('Tshivenda Soil L1 assessments preserve diagnostic caveats and answer indexes', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_SOIL_HEALTH_DRAFT.id);
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l1');
  const draft = TSHIVENDA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === 'soil-health-l1');
  assert.ok(source);
  assert.ok(draft);
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.infographicAlt?.reviewStatus, 'machine-draft', 'the visual alt is now a paired unreviewed draft; the diagnostic caveats and answer indexes remain checked below');
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.match(draft.infographicAlt!.tshivendaDraft, /worms mbili/);
  assert.match(draft.infographicAlt!.tshivendaDraft, /three layers — sand, silt na clay/);
  assert.equal(draft.body.sourceEnglish, source.body, 'assessment wiring leaves the current body source pair intact');
  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.deepEqual(draft.keyPoints.map(point => point.reviewStatus), [
    'machine-draft', 'machine-draft', 'machine-draft', 'machine-draft',
  ]);
  assert.deepEqual(draft.keyPoints.slice(0, 3).map(point => point.tshivendaDraft), [
    'Shumisani zwiṱalusi zwo vhalaho u ṱola vhuimo ha mavu.',
    'Muvhala wa mavu na tshivhalo tsha zwivhungu fhedzi a zwi sumbedzi uri thaidzo yo vhangwa nga mini.',
    'U lingedza nga jar zwi sumbedza texture nga u anganyela fhedzi, a si soil test yo fhelelaho.',
  ], 'the three existing localized key points remain unchanged');
  assert.match(draft.keyPoints[0].tshivendaDraft, /zwiṱalusi zwo vhalaho/,
    'the existing several-clues draft stays unchanged');
  assert.equal(draft.keyPoints[3].tshivendaDraft, 'Ṱolani drainage, midzi na management history ni sa athu khetha remedy.');

  assert.equal(draft.quiz.length, source.quiz.length);
  for (const [index, item] of draft.quiz.entries()) {
    const sourceQuestion: QuizQuestion = source.quiz[index]!;
    assert.equal(item.question.sourceEnglish, sourceQuestion.q);
    assert.equal(item.question.reviewStatus, 'machine-draft');
    assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceQuestion.options);
    assert.ok(item.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(item.sourceCorrectIndex, sourceQuestion.correct);
    assert.equal(item.options[item.sourceCorrectIndex]?.sourceEnglish, sourceQuestion.options[sourceQuestion.correct]);
    assert.equal(item.rationale.sourceEnglish, sourceQuestion.rationale);
    assert.equal(item.rationale.reviewStatus, 'machine-draft');
  }
  assert.equal(draft.quiz[0].sourceCorrectIndex, 1);
  assert.match(draft.quiz[0].question.tshivendaDraft, /cloudy water.*nga nṱha ha lera la sand/);
  assert.match(draft.quiz[0].options[0].tshivendaDraft, /less water/, 'the comparative remains explicit');
  assert.match(draft.quiz[0].options[1].tshivendaDraft, /Fine particles.*nga kha ḓi vha suspended.*u sedza hafhu/);
  assert.match(draft.quiz[0].rationale.tshivendaDraft, /Cloudy water.*nga vha na fine particles.*sa athu u dzula fhasi.*U sedza ha u thoma luthihi.*final proportions kana right treatment/,
    'possibility, one early observation and both limits remain in the rationale');
  assert.equal(draft.quiz[1].sourceCorrectIndex, 2);
  assert.match(draft.quiz[1].options[2].tshivendaDraft, /drainage, midzi, moisture na management history/);
  assert.match(draft.quiz[1].rationale.tshivendaDraft, /Worm activity.*shanduka u ya nga conditions.*worms dzi si gathi fhedzi a dzi khwaṱhisedzi/,
    'worm activity varies, and few worms alone do not establish a cause');

  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.tshivendaDraft));
  assert.deepEqual(shown.content.quiz, source.quiz.map((item, index) => ({
    q: draft.quiz[index].question.tshivendaDraft,
    options: draft.quiz[index].options.map(option => option.tshivendaDraft),
    correct: item.correct,
    rationale: draft.quiz[index].rationale.tshivendaDraft,
  })), 'the learner sees paired drafts with the canonical answers unchanged');
  const changedSource = {
    ...source,
    quiz: source.quiz.map((item, index) => index === 0
      ? { ...item, rationale: item.rationale.replace('final proportions', 'soil condition') }
      : item),
  };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 've').status, 'english-fallback',
    'a changed diagnostic caveat withdraws the stale assessment draft');
});

test('Tshivenda Soil L2 compost body preserves source conditions and falls back after source drift', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_SOIL_HEALTH_DRAFT.id);
  assert.ok(sourceModule, 'Soil Health source module must exist');
  const source = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l2');
  const draft = TSHIVENDA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(source, 'canonical Soil L2 source must exist');
  assert.ok(draft, 'Tshivenda Soil L2 draft must exist');

  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(draft.body.sourceEnglish, source.body,
    'the body draft must remain paired to the exact canonical source');
  const english = source.body.split('\n\n');
  const paragraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(english.length, 12);
  assert.equal(paragraphs.length, english.length,
    'all compost paragraphs must remain aligned with their source');
  assert.ok(paragraphs.every((paragraph, index) => paragraph !== english[index]),
    'no former full-paragraph English hold may silently remain');

  assert.match(paragraphs[0], /organic matter.*broken down.*managed conditions/,
    'compost remains organic matter broken down under managed conditions');
  assert.match(paragraphs[1], /Compost yo fhelelaho i nga.*tshivhumbeo tsha mavu.*contribute nutrients/,
    'finished compost can improve soil structure and contribute nutrients');
  assert.match(paragraphs[2], /materials.*vhunyunyu.*muya.*temperature.*Dzina.*vhege.*a si tsedzuluso/,
    'readiness varies with the source factors and neither province nor fixed weeks is a readiness test');
  assert.match(paragraphs[3], /dry browns.*fresh greens.*Avoid thick, wet layers that keep air out/,
    'brown/green material categories and the air-exclusion warning remain precise');
  assert.match(paragraphs[4], /slimy.*kana ya nukha ammonia nga maanḓa.*dry browns.*rembuluse/,
    'either sliminess or strong ammonia smell triggers dry browns and turning');
  assert.match(paragraphs[5], /Sedzulusani vhunyunyu na muya.*thulwi.*recipe nthihi.*materials/,
    'moisture and air are checked as the heap changes and one recipe does not fit every mix');
  assert.match(paragraphs[6], /Hot centre a i khwaṱhisedzi uri tshipida tshiṅwe na tshiṅwe.*tsho treated.*Time, temperature na management/,
    'a hot centre does not prove every part has been treated; time, temperature and management matter');
  assert.match(paragraphs[7], /nyama, dairy, zwimela zwi re na malwadze, pet waste na contaminated materials.*simple household system/,
    'all prohibited material categories remain out of the simple household system');
  assert.match(paragraphs[8], /home composting.*weed seed iṅwe na iṅwe.*disease organism iṅwe na iṅwe.*recognised process.*sanitation ya ṱoḓea/,
    'the warning covers every weed seed and disease organism and keeps the sanitation condition');
  assert.match(paragraphs[9], /wattle seed pods.*thulwi ya manyoro.*An ordinary heap may not make every seed non-viable/,
    'wattle seed pods remain excluded and the ordinary-heap limitation remains modal, not absolute');
  assert.match(paragraphs[10], /clean, untreated materials.*Bark breaks down slowly.*dzina layo fhedzi a si proof.*contamination/,
    'materials must be clean and untreated; bark breaks down slowly and its name alone proves no freedom from contamination');
  assert.match(paragraphs[11], /Sedzulusani thulwi ni i rembuluse musi i tshi toda muya wo engedzeaho kana u tanganiswa.*Keep it moist.*waterlogged/,
    'turning occurs when more air or mixing is needed, and moist remains distinct from waterlogged');

  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.tshivendaDraft,
    'the complete marked body draft reaches the learner');
  const changedSource = { ...source, body: source.body.replace('more air or mixing', 'more air only') };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 've').status, 'english-fallback',
    'changing a source condition withdraws the complete paired body draft');
});

test('Tshivenda Soil L2 assessment drafts preserve caveats and answer indexes', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_SOIL_HEALTH_DRAFT.id);
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l2');
  const draft = TSHIVENDA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(source);
  assert.ok(draft);

  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.ok(draft.keyPoints.every(point => point.reviewStatus === 'machine-draft'));
  assert.match(draft.keyPoints[0].tshivendaDraft, /browns, greens, moisture.*air/,
    'the balance key point does not add dry or fresh qualifiers');
  assert.match(draft.keyPoints[1].tshivendaDraft, /Vhukati ho fhisaho.*a vhu sumbedzi.*heap yoṱhe.*sanitised/,
    'a hot centre is not evidence that the whole heap is sanitised');
  assert.match(draft.keyPoints[2].tshivendaDraft, /seed pods.*contaminated materials.*nnḓa/,
    'seed pods and contaminated materials remain excluded');
  assert.match(draft.keyPoints[3].tshivendaDraft, /compost.*condition.*fixed regional timetable/,
    'readiness is judged from condition, not a fixed regional timetable');

  assert.equal(draft.quiz.length, source.quiz.length);
  for (const [index, item] of draft.quiz.entries()) {
    assert.equal(item.question.sourceEnglish, source.quiz[index]!.q);
    assert.equal(item.question.reviewStatus, 'machine-draft');
    assert.deepEqual(item.options.map(option => option.sourceEnglish), source.quiz[index]!.options);
    assert.ok(item.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(item.sourceCorrectIndex, source.quiz[index]!.correct, `quiz ${index} source answer index is stable`);
    assert.equal(item.options[item.sourceCorrectIndex].sourceEnglish, source.quiz[index]!.options[source.quiz[index]!.correct]);
    assert.equal(item.rationale.sourceEnglish, source.quiz[index]!.rationale);
    assert.equal(item.rationale.reviewStatus, 'machine-draft');
  }
  assert.match(draft.quiz[0].question.tshivendaDraft, /ammonia.*nga maanḓa.*wet.*slimy/,
    'the Q0 symptoms retain the strong smell and wet/slimy conditions');
  assert.match(draft.quiz[0].rationale.tshivendaDraft, /may need more air and drier material/,
    'the corrective advice remains qualified');
  assert.match(draft.quiz[0].rationale.tshivendaDraft, /can also suggest too much nitrogen-rich material/,
    'ammonia can suggest excess nitrogen but is not made a definitive diagnosis');
  assert.match(draft.quiz[0].rationale.tshivendaDraft, /damp, not soggy/,
    'the moisture limit remains explicit');
  assert.match(draft.quiz[1].rationale.tshivendaDraft, /may not expose every seed.*non-viable.*U bvisa pods.*zwi thivhela uri dzi phaḓalale/,
    'the ordinary-heap caveat and reason for excluding pods remain in source order');

  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.tshivendaDraft));
  assert.deepEqual(shown.content.quiz, source.quiz.map((item, index) => ({
    q: draft.quiz[index].question.tshivendaDraft,
    options: draft.quiz[index].options.map(option => option.tshivendaDraft),
    correct: item.correct,
    rationale: draft.quiz[index].rationale.tshivendaDraft,
  })), 'learner assessment keeps the same options and answer while showing paired drafts');
  const changedQuizSource = {
    ...source,
    quiz: source.quiz.map((item, index) => index === 0
      ? { ...item, rationale: item.rationale.replace('may need more air', 'may need more water') }
      : item),
  };
  assert.equal(resolveLearnerLessonPresentation(changedQuizSource, 've').status, 'english-fallback',
    'changing a translated quiz caveat withdraws the stale assessment draft');
});

test('Tshivenda Soil L3 body preserves cover-crop, season and leachate safeguards', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_SOIL_HEALTH_DRAFT.id);
  assert.ok(sourceModule);
  const source = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l3');
  const draft = TSHIVENDA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === 'soil-health-l3');
  assert.ok(source);
  assert.ok(draft);
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = source.body.split('\n\n');
  const paragraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(sourceParagraphs.length, 13);
  assert.equal(paragraphs.length, sourceParagraphs.length,
    'all 13 source paragraphs must keep their alignment');
  for (const [index, paragraph] of paragraphs.entries()) {
    assert.notEqual(paragraph, sourceParagraphs[index],
      `paragraph ${index + 1} must not silently remain an exact-English hold`);
  }
  assert.match(paragraphs[0], /mavu a songo fukwaho.*mulch yo kunaho, yo teaho.*straw.*hatsi ho omaho.*wood chips/,
    'bare soil, clean and suitable mulch, and all three examples remain');
  assert.match(paragraphs[1], /i nga fhungudza evaporation; i nga soften the impact of rain; i nga suppress weeds/,
    'can scopes all three benefits and weeds are suppressed rather than eliminated');
  assert.match(paragraphs[2], /Keep it clear of trunks and stems.*moisture nga fhasi.*lulamise layer.*mulch nnzhi a i dzuli/,
    'trunks and stems stay distinct; underneath moisture, layer adjustment and more-is-not-always-better remain');
  assert.match(paragraphs[3], /Cover crops dzi nga tsireledza.*vhukati ha main crops.*mutsho wa henefho.*maḓi ane a vha hone na next planting/,
    'cover crops protect between main crops and selection retains local weather, available water and next planting');
  assert.match(paragraphs[4], /oats, lupins, sunn hemp na cowpea.*Sedzani arali dzi tshi fanela fhethu haṋu ni sa athu dzi zwala/,
    'all four named course examples remain in order and local suitability is checked before sowing');
  assert.match(paragraphs[5], /Legumes.*bacteria dzo teaho.*growth conditions dzo teaho.*fix nitrogen.*Nutrients.*masalela.*material i tshi decompose/,
    'nitrogen fixation needs suitable bacteria and conditions, and residue nutrients become available during decomposition');
  assert.match(paragraphs[6], /Worm farms dzi nga.*food scraps na bedding zwo teaho.*castings.*songo lavhelela fixed harvest date/,
    'worm farms can process suitable scraps and bedding into castings, with no fixed harvest date');
  assert.match(paragraphs[7], /Liquid that drains naturally from a worm bin.*leachate.*A si tshithu tshithihi na prepared worm-casting tea/,
    'natural drainage is distinguished from prepared worm-casting tea');
  assert.match(paragraphs[8], /Leachate i nga vha na harmful organisms kana substances.*Do not use it on edible plants or assume that dilution makes it safe/,
    'possible harmful contents, no edible-plant use and no dilution safety assumption remain');
  assert.match(paragraphs[9], /Field ya Highveld.*nga murahu ha harvest ya maize.*risks mbili/,
    'the specific Highveld field after maize harvest faces exactly two risks');
  assert.match(paragraphs[10], /Mhepo ya winter i nga.*topsoil yo omaho/,
    'winter wind may carry away dry topsoil');
  assert.match(paragraphs[11], /Storm ya u thoma khulwane ya spring i nga rwa.*tshinyadza surface na structure.*Arali maḓi.*a nga hwala loosened soil/,
    'the first heavy spring storm and its damage remain possible; soil is carried only if water runs over the field');
  assert.match(paragraphs[12], /Cover crops, mulch na organic matter zwi nga thusa.*fhethu hayo.*dzule.*tshi khou tshila/,
    'the final soil benefits remain possible rather than guaranteed');

  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.ok(draft.keyPoints.every(point => point.reviewStatus === 'machine-draft'));
  assert.match(draft.keyPoints[0].tshivendaDraft, /exposed soil.*cover yo teaho/);
  assert.match(draft.keyPoints[1].tshivendaDraft, /mulch kule na trunks na stems/);
  assert.match(draft.keyPoints[2].tshivendaDraft, /cover crops.*maḓi a henefho.*mutsho.*crop i tevhelaho/);
  assert.match(draft.keyPoints[3].tshivendaDraft, /a i sokou vha safe fertiliser; i vhetseni kule na edible plants/);
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((item, index) => {
    const original = source.quiz[index]!;
    assert.equal(item.question.sourceEnglish, original.q);
    assert.equal(item.question.reviewStatus, 'machine-draft');
    assert.deepEqual(item.options.map(option => option.sourceEnglish), original.options);
    assert.ok(item.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(item.rationale.sourceEnglish, original.rationale);
    assert.equal(item.rationale.reviewStatus, 'machine-draft');
    assert.equal(item.sourceCorrectIndex, original.correct);
    assert.equal(item.options[item.sourceCorrectIndex]?.sourceEnglish, original.options[original.correct]);
  });
  assert.deepEqual(draft.quiz.map(item => item.sourceCorrectIndex), [2, 1]);
  assert.match(draft.quiz[0].question.tshivendaDraft, /Highveld.*maize nga April.*all winter/);
  assert.match(draft.quiz[0].options[0].tshivendaDraft, /waterlogging from rain/,
    'keep the specific waterlogging condition instead of broadening it to a large amount of water');
  assert.match(draft.quiz[0].options[1].tshivendaDraft, /Frost.*weeds.*nga u ṱavhanya/);
  assert.match(draft.quiz[0].rationale.tshivendaDraft, /nga hwala dry topsoil.*hu nga tshinyadza surface; where water runs over the field, it can carry loosened soil away/,
    'wind and raindrop effects remain possible, and runoff soil loss stays conditional');
  assert.match(draft.quiz[1].question.tshivendaDraft, /liquid draining from a worm bin/);
  assert.match(draft.quiz[1].options[1].tshivendaDraft, /nga vha na harmful organisms.*dilution a si safety guarantee/);
  assert.match(draft.quiz[1].rationale.tshivendaDraft, /^Leachate ndi liquid that drains naturally from a worm bin\. Composition yayo i a fhambana/);
  assert.match(draft.quiz[1].rationale.tshivendaDraft, /a i tei u sumbedzwa sa feed yo khwaṱhisedzwaho uri yo safe kha edible crops/);
  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.tshivendaDraft);
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.tshivendaDraft));
  assert.deepEqual(shown.content.quiz, source.quiz.map((item, index) => ({
    q: draft.quiz[index].question.tshivendaDraft,
    options: draft.quiz[index].options.map(option => option.tshivendaDraft),
    correct: item.correct,
    rationale: draft.quiz[index].rationale.tshivendaDraft,
  })));
  const changedSource = {
    ...source,
    body: source.body.replace('Do not use it on edible plants', 'Use it on edible plants'),
  };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 've').status, 'english-fallback',
    'changing the edible-plant prohibition withdraws the stale body draft');
  const changedAssessmentSource = {
    ...source,
    quiz: source.quiz.map((item, index) => index === 1
      ? { ...item, rationale: item.rationale.replace('composition varies', 'composition is constant') }
      : item),
  };
  assert.equal(resolveLearnerLessonPresentation(changedAssessmentSource, 've').status, 'english-fallback',
    'source drift in leachate composition withdraws the stale quiz pairing');
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

  // Use the validated dated Intro presentation above; changed-source fallback stays live.
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

test('Tshivenda Study controls retain reviewed pairs, draft status and unresolved English fallbacks', async () => {
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

  // These five controls were deliberately English in the earlier packet. The 7 October
  // independent checks now bind exact drafts; subsequent context checks also resolve
  // loading/saving and completion actions without claiming professional status.
  const expandedReview = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/study-silent-entry-2026-10-07/imbewu-study-ui-full-approved-20261007.json', import.meta.url), 'utf8'));
  const { default: liveVenda } = await import('../lib/locales/ve.ts');
  for (const [key, expectedEnglish, expectedDraft] of [
    ['studentSubmit', 'Submit', 'Rumelani'],
    ['studentComplete', 'Complete', 'Yo fhela'],
    ['studentCourseComplete', 'Course complete!', 'Khoso yo fhela!'],
    ['studentSubmitting', 'Submitting…', 'I khou rumela…'],
    ['studentLocked', 'Locked', 'Zwo valelwa'],
  ] as const) {
    const pair = expandedReview.rows.find((row: { language: string; key: string }) => row.language === 've' && row.key === key);
    assert.ok(pair, `${key}: the expanded source-bound reviewer packet must contain the control`);
    assert.equal(pair.sourceEnglish, expectedEnglish, `${key}: preserve its exact English source`);
    assert.equal(pair.candidate, expectedDraft, `${key}: do not silently replace the independently checked draft`);
    assert.equal(pair.status, 'unreviewed-machine-draft');
    assert.equal(liveVenda[key], expectedDraft, `${key}: actual locale imports must expose the checked draft`);
    assert.ok(english.includes(`${key}: '${expectedEnglish}'`), `${key}: preserve the exact English fallback`);
  }
  const contextReview = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/STUDY-CONTEXT-CONTROLS-APPLIED-2026-10-08.json', import.meta.url), 'utf8'));
  const progressPair = contextReview.rows.find((row: { language: string; key: string }) => row.language === 've' && row.key === 'studentProgressError');
  assert.ok(progressPair, 'the loading/saving recovery message needs its independently checked context pair');
  assert.equal(progressPair.sourceEnglish, 'Progress could not be loaded or saved. Check your connection or account access.');
  assert.equal(progressPair.status, 'unreviewed-machine-draft');
  assert.equal(liveVenda.studentProgressError, progressPair.candidate);
  assert.ok(liveVenda.studentProgressError.includes('laisiwa kana u vhulungwa'), 'retain both load and save failure, not only one failure mode');
  assert.ok(liveVenda.studentProgressError.includes('vhuṱumani haṋu kana account access'), 'retain both connection and permission recovery choices');
  const runtimeReview = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/STUDY-UI-DUE-UNLOCK-AND-CONTROLS-2026-10-08.json', import.meta.url), 'utf8'));
  const practitionerPair = runtimeReview.rows.find((row: { id: string }) => row.id === 'study-ui/ve/studentPractitioner');
  assert.ok(practitionerPair, 'the dated source-bound review must include the VE practitioner label');
  assert.equal(practitionerPair.sourceEnglish, 'Permaculture practitioner');
  assert.equal(practitionerPair.targetAfter, 'Muthu ane a shumisa Permaculture');
  assert.match(practitionerPair.candidateReview, /fluent review pending/);
  assert.ok(practitionerPair.semanticConstraints.some((reason: string) => /Do not imply expert status, professional credential, or certification/.test(reason)),
    'the ordinary person-using paraphrase must not upgrade course completion into a credential');
  assert.equal(liveVenda.studentPractitioner, practitionerPair.targetAfter, 'the shipped value must match the reviewed draft exactly');
  assert.ok(english.includes("studentProgressError: 'Progress could not be loaded or saved. Check your connection or account access.'"), 'preserve the exact progress-error source');
  assert.ok(english.includes('return LOADED[lang]?.[key] ?? LOADED.en[key] ?? key;'), 'missing Tshivenda keys must fall back to English');
});

test('Vegetables L3 preserves crop conditions and exact technical clauses while showing source-paired prose', async () => {
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
  // Checked ordinary prose can grow; protect each selected source sentence rather than pinning a draft count.
  assert.equal(draftLesson.body.sourceEnglish, lesson.body, 'source drift must invalidate the entire learner draft');
  assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
  // 6 October: the accepted eleven-paragraph layer localizes consequence and young-leaf
  // framing. Validate its whole source/status/unlisted snapshot before this older exact
  // clause view; retain every original crop, timing, index and drift assertion below.
  const shown = vegetablesL3PresentationBeforeOrdinary(lesson, 've');
  assert.equal(shown.status, 'draft');
  const translated = shown.content.body.split('\n\n');
  assert.equal(translated.length, paragraphs.length);
  assert.equal(translated[0], vegetablesL3Draft.bodyConcept.tshivendaDraft);
  assert.equal(translated[vegetablesL3Draft.secondBodyConcept.paragraphIndex], vegetablesL3Draft.secondBodyConcept.tshivendaDraft);
  const expectedParagraphs = [...paragraphs];
  expectedParagraphs[vegetablesL3Draft.bodyConcept.paragraphIndex] = vegetablesL3Draft.bodyConcept.tshivendaDraft;
  expectedParagraphs[vegetablesL3Draft.secondBodyConcept.paragraphIndex] = vegetablesL3Draft.secondBodyConcept.tshivendaDraft;
  expectedParagraphs[4] = "Ndi tshiḽiwa tsha vhuthogwa tshifhio tshine muṱa waṋu wa ḓitika ngatsho nga maanḓa u fhira zwiṅwe zwino? That's the one whose failure would hurt most — so that's the one that needs a companion.";
  for (const concept of vegetablesL3Draft.additionalBodyConcepts) {
    assert.equal(paragraphs[concept.paragraphIndex].split(concept.sourceEnglish).length - 1, 1,
      `source paragraph ${concept.paragraphIndex + 1}: selected sentence occurs once`);
    expectedParagraphs[concept.paragraphIndex] = expectedParagraphs[concept.paragraphIndex]
      .replace(concept.sourceEnglish, concept.tshivendaDraft);
  }
  expectedParagraphs[6] = "Maize i ṋea calories nahone i a vhulungea yo oma. Open-pollinated maize i dovha ya ni tendela ni vhulunga mbeu yaṋu, arali ni tshi langula isolation na selection.";
  expectedParagraphs[7] = "Beans na cowpeas zwi ṋea protein harvest ine ya nga vhulungwa.";
  expectedParagraphs[8] = "Sweet potato i wana drought tolerance nyana nga murahu ha musi storage roots dza yo dzo no vhumbea. I ṱoḓa maḓi kha vhege dza u thoma na musi storage roots dzi tshi kha ḓi vhumbea; water stress nga tshifhinga tshenetsho i nga fhungudza harvest. Its young leaves are edible too.";
  expectedParagraphs[9] = "Amadumbe i a konḓelela mavu ane a vha na maḓi manzhi u fhira, hune zwiṅwe zwimela zwa vhuthogwa zwa konḓelwa.";
  assert.deepEqual(translated, expectedParagraphs,
    'preserve both existing drafts and every other body sentence exactly, including counts and crop guidance');
  assert.match(translated[2], /zwivhili kana zwo engaho/, 'the two-or-more qualifier must survive the new draft');
  assert.match(translated[3], /zwivhili kana zwo engaho/, 'grow-at-least-two threshold stays explicit');
  assert.match(translated[14], /zwivhili kana zwo engaho/, 'two-or-more staples remains explicit');
  assert.equal(translated[4], "Ndi tshiḽiwa tsha vhuthogwa tshifhio tshine muṱa waṋu wa ḓitika ngatsho nga maanḓa u fhira zwiṅwe zwino? That's the one whose failure would hurt most — so that's the one that needs a companion.", 'only the checked ordinary reliance question is localized; consequence and companion reasoning stay English');
  assert.match(translated[6], /calories.*yo oma.*Open-pollinated maize.*arali.*isolation na selection/,
    'seed-saving permission remains conditional on managed isolation and selection');
  assert.match(translated[7], /Beans na cowpeas.*protein harvest.*nga vhulungwa/,
    'both named crops still yield storable protein');
  assert.match(translated[8], /drought tolerance.*nga murahu ha musi storage roots.*vhege dza u thoma.*storage roots.*water stress.*i nga fhungudza harvest.*Its young leaves are edible too\.$/,
    'the drought tolerance timing, water needs, conditional loss, and exact young-leaves claim remain');
  assert.match(translated[9], /Amadumbe.*maḓi manzhi.*u fhira.*zwiṅwe zwimela.*konḓelwa/,
    'the wetter-ground comparison remains bounded to the source claim');
  assert.ok(translated[15].endsWith('Phambano yeneyo ndi yone tsireledzo.'), 'difference remains the protection');
  // All sixteen paragraphs now have draft prose; retained technical clauses,
  // rather than whole English paragraphs, are the remaining source safeguards.
  assert.equal(translated.length, paragraphs.length, 'no paragraph is lost when the crop prose is drafted');
  assert.equal(translated[8].split('. ').at(-1), paragraphs[8].split('. ').at(-1),
    'the young-leaf food claim remains the exact source clause, never a broader leaf claim');
  assert.equal(shown.content.title, lesson.title);
  // 6 October: approved source-paired L3 assessment leaves replace the old hold-only claim.
  // Exact source/current edges, B,B and all unlisted fields are covered by the completion checks.
  assert.equal(shown.content.infographicAlt, draftLesson.infographicAlt!.tshivendaDraft);
  assert.deepEqual(shown.content.keyPoints, draftLesson.keyPoints.map(point => point.tshivendaDraft));
  assert.deepEqual(shown.content.quiz, lesson.quiz.map((question, index) => ({
    ...question,
    q: draftLesson.quiz[index].question.tshivendaDraft,
    options: draftLesson.quiz[index].options.map(option => option.tshivendaDraft),
    rationale: draftLesson.quiz[index].rationale.tshivendaDraft,
  })), 'source-bound draft wording and unchanged order, rationales and correct indexes remain paired');
  assert.equal(learnerVegetablesDraft.title.sourceEnglish, module.title);
  assert.equal(learnerVegetablesDraft.description.sourceEnglish, module.description);
  assert.equal(learnerVegetablesDraft.sourceMetadata.durationMins, module.durationMins);
  assert.equal(learnerVegetablesDraft.sourceMetadata.category, module.category);
  const card = resolveCourseModulePresentation(module, 've');
  assert.equal(card.status, 'draft', 'the reviewed module metadata candidate is now routed to the Tshivenda Study card');
  assert.equal(card.title, learnerVegetablesDraft.title.tshivendaDraft);
  assert.equal(card.description, learnerVegetablesDraft.description.tshivendaDraft);
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

test('Tshivenda bed preparation preserves reachability, soil conditions and crop establishment while translating ordinary prose', () => {
  const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  // 5 October: current67 source/target edges and full preservation are checked before retaining this historical baseline coverage.
  const draft = vegetablesBeforeFuller('ve', learnerVegetablesDraft).lessons.find(lesson => lesson.id === source.id)!;
  assert.equal(draft.body.sourceEnglish, source.body);
  const english = source.body.split('\n\n');
  const paragraphs = draft.body.tshivendaDraft.split('\n\n');
  assert.equal(paragraphs.length, english.length);
  assert.equal(paragraphs.length, 20);
  assert.match(paragraphs[0], /^Compacted soil loses its air spaces\. Midzi i aluwa nga u ongolowa\. Maḓi a nwela nga nḓila yo fhambanaho\. Bed gets harder to work kha khalaṅwaha iṅwe na iṅwe\.$/,
    'the technical compaction mechanism remains exact while root, water and seasonal work effects are localized');
  assert.match(paragraphs[7], /^Ni songo bwa wet clay\. If compaction or poor drainage is severe, identify the cause with local advice before choosing deeper cultivation\.$/,
    'the prohibition and full severe-condition/adviser/timing safeguard remain');
  assert.match(paragraphs[17], /^Nga murahu ni lugiselele u ya nga mavu aṋu — no-dig first, and dig deeper only if your ground genuinely needs it\.$/,
    'no-dig remains first and deeper cultivation is conditional on genuine need');
  assert.equal(paragraphs.filter((paragraph, index) => paragraph !== english[index]).length, 20);

  assert.match(paragraphs[1], /narrow enough to reach into from both sides/);
  assert.match(paragraphs[2], /One metre to one point two metres wide/);
  assert.match(paragraphs[2], /feet never touch the growing area/);
  assert.match(paragraphs[5], /least disturbance that solves your problem/);
  assert.match(paragraphs[6], /No-dig suits most garden soils/);
  assert.match(paragraphs[7], /before choosing deeper cultivation/);
  assert.match(paragraphs[11], /They do better sown straight where they'll grow/);
  assert.match(paragraphs[11], /Beans, carrots na maize/);
  assert.match(paragraphs[12], /then transplanting/);
  assert.match(paragraphs[12], /Tomatoes na brassicas/);
  assert.match(paragraphs[15], /One point two metres wide\. Three metres long/);
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), [1, 2]);
  draft.quiz.forEach((question, index) => {
    assert.equal(question.question.sourceEnglish, source.quiz[index].q);
    // Assessment drafts now localize ordinary wording; the canonical source remains binding.
    assert.equal(question.question.sourceEnglish, source.quiz[index].q);
    assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
  });
  // The learner resolver exposes 'draft'; record-level provenance uses 'machine-draft'.
  assert.equal(resolveLearnerLessonPresentation(source, 've').status, 'draft');
  assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 've').status, 'english-fallback');
});

test('Tshivenda succession and pest drafts preserve repeated sowing, uncertainty and treatment order', () => {
  const module = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
  for (const [id, count, correct] of [['vegetables-staples-l2', 23, [1, 1]], ['vegetables-staples-l4', 12, [1, 0]]] as const) {
    const source = module.lessons.find(lesson => lesson.id === id)!;
    const draft = learnerVegetablesDraft.lessons.find(lesson => lesson.id === id)!;
    assert.equal(learnerVegetablesDraft.lessons.filter(lesson => lesson.id === id).length, 1);
    assert.equal(draft.body.sourceEnglish, source.body);
    assert.equal(draft.body.tshivendaDraft.split('\n\n').length, count);
    assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), correct);
    draft.quiz.forEach((question, index) => {
      // Later assessment drafts keep the same claims and source, rather than staying all English.
      assert.equal(question.question.sourceEnglish, source.quiz[index].q);
      assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
      assert.deepEqual(question.options.map(option => option.sourceEnglish), source.quiz[index].options);
    });
    assert.equal(resolveLearnerLessonPresentation(source, 've').status, 'draft');
    assert.equal(resolveLearnerLessonPresentation({ ...source, body: `${source.body} changed` }, 've').status, 'english-fallback');
  }
  const l2 = learnerVegetablesDraft.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!.body.tshivendaDraft.split('\n\n');
  assert.match(l2[1], /^Nangani tshithu tshine muṱa waṋu wa tshi ḽa kanzhi vhukuma\. Nga murahu, sow zwiṱuku zwa tshithu itsho, ni dovhe ni ite tano hafhu na hafhu\.$/, 'L2 p1 preserves frequent household use, a small amount, and repeated sowing in a checked unreviewed draft');
  assert.match(l2[2], /vhege dziṅwe na dziṅwe dza mbili u swika kha tharu/,
    'the short row keeps its recurring two-to-three-week interval');
  assert.match(l2[3], /^U tambisea ha zwiḽiwa hu a fhungudzea musi hu na khaṋo nnzhi\. Zwiḽiwa zwiswa zwi a wanala for longer\./,
    'the checked wording names food waste, preserves the for-longer comparison anchor, and keeps the season-long labour point');
  assert.match(l2[4], /A zwi khwaṱhisedzi uri ni ḓo wana khaṋo arali nyimele dzi konḓaho dzi tshi bvela phanḓa/, 'repeated sowings are not framed as a harvest guarantee under continuing difficult conditions');
  assert.match(l2[8], /A si tshifhinga tshoṱhe tshine tshigwada tsha u thoma tsha vha tsho lugela u kaṋiwa musi ni tshi zwala lwa vhuṋa/, 'suitable timing allows possible overlap without promising the first batch is ready by sowing four');
  assert.match(l2[9], /Musi hu tshi fhisa, zwi nga ṱavhanyisa zwithu kana zwa ita uri zwi kundelwe/, 'heat still carries both possible faster timing and failure');
  assert.match(l2[12], /Indigenous farming traditions in the Americas/);
  // The source-bound October 7 draft translates the ordinary water-limit
  // clause; retain all three possible timings and the limiting-water condition.
  assert.match(l2[19], /^Hungry gap yaṋu i nga ḓa nga murahu ha musi maize yo vhulungwaho yo fhela\. I nga ḓa musi winter greens dzi sa athu u luga\. I nga ḓa nga tshifhinga tsho omaho musi maḓi a tshi fhungudza zwine zwa nga aluswa tsimuni\.$/, 'L2 p19 retains all three possible gap timings and the exact water-limits condition');
  assert.match(l2[8], /^Arali tshifhinga tsha crop tsho tea, khaṋo dzi nga thoma u overlap\. A si tshifhinga tshoṱhe.*lwa vhuṋa\.$/, 'possible overlap remains qualified by crop timing and the first-batch caveat stays intact');
  // Tshivenda connector is localized in the accepted exact span; the protein term stays technical English.
  assert.equal(l2[14], 'Beans dzi gonya maize, na store as protein.');
  assert.equal(l2[15], 'Pumpkin i phadalala fhasi, i ita murunzi kha mavu na u vhulunga moisture.',
    'the ground-spreading action and soil shade remain localized while the crop and moisture terms stay English');
  assert.match(l2[16], /Tshifhinga tshi a vha tsha ndeme\. Thomani nga u ita uri maize i khwaṱhe, u itela uri i kone u tikedza beans musi dzi tshi thoma u gonya\./, 'maize is established first and is strong enough before beans start climbing');
  assert.match(l2[17], /do not assume they immediately feed the maize/);
  assert.match(l2[17], /nutrients in residues are released during decomposition/);
  const sourceL4 = module.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!.body.split('\n\n');
  // 6 October: validate the complete accepted quiz+pest layers, then retain this older treatment-order wording.
  const l4 = vegetablesBeforePestPrecision('ve', learnerVegetablesDraft).lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!.body.tshivendaDraft.split('\n\n');
  assert.ok(l4[1].startsWith('Zwimela zwi re na stress. '));
  assert.ok(l4[1].endsWith('One crop dominating the ground. Kana broad chemical use yo no bvisa predators dze dza vha dzi tshi ni thusa.'),
    'the translated clause preserves broad chemical use as an already-happened removal of helpful predators');
  assert.match(l4[2], /^Ngazwenezwo, before you treat anything,/,
    'whole-system observation remains explicitly before treatment');
  assert.equal(l4[3], 'Is the plant short of water? Soil yo compacted kana yo “hungry”? Predators dzi khou shuma kha thaidzo iyi dzi tshi ni thusa already naa?',
    'the diagnostic keeps water shortage distinct from compacted or hungry soil and asks whether predators already help');
  assert.ok(l4[4].startsWith('Yellow leaf a i ambi automatically uri ndi insect.'));
  assert.ok(l4[4].includes('water') && l4[4].includes('nutrition') && l4[4].includes('root damage'));
  assert.ok(l4[4].endsWith('Wanani uri ndi zwifhio ni sa athu dzhia vhukando.'),
    'the cause list still asks the grower to find which cause before acting');
  assert.equal(l4[6].startsWith('Tsha u thoma. Sedzani. Sedzani '), true,
    'the localized checklist keeps both source commands: One/Observe and Look');
  for (const target of ['damage pattern', 'tlhelo ḽa fhasi ḽa ḽiṱari', 'tsinde', 'zwimela zwi re tsini']) {
    assert.ok(l4[6].includes(target), `the translated source checklist keeps ${target}`);
  }
  for (const target of ['Soil moisture', 'midzi', 'spacing', 'nutrition', 'drainage']) assert.ok(l4[7].includes(target));
  assert.ok(l4[8].includes('Beneficial insects') && l4[8].includes('mushumo'),
    'the translated protection sentence still says beneficial insects do useful work');
  assert.match(l4[9], /^Tsha vhuṋa\. Ndi hone fhedzi ni tshi dzhia vhukando —/);
  assert.ok(l4[9].includes('thomani nga the lightest thing that works.'));
  assert.ok(l4[9].includes('Physical removal, barriers kana tshanduko kha crop care zwi nga thusa.'));
  assert.ok(l4[9].endsWith('Ṱolani arali vhukando vhu tshi tea thaidzo, ni bvele phanḓa ni tshi sedza mvelelo.'), 'the action-fit and outcome checks stay in the ordered final step');
  for (const safeguard of ['registered for that crop and pest', 'label yayo', 'neem products', 'protection and harvest waiting instructions', 'Do not improvise mixtures or stronger doses']) {
    assert.ok(l4[10].includes(safeguard), `the treatment safeguard remains explicit: ${safeguard}`);
  }
  const sourceL4Lesson = module.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
  const changedChecklistSource = {
    ...sourceL4Lesson,
    body: sourceL4Lesson.body.replace('the plants nearby', 'the plants in a nearby row'),
  };
  assert.notEqual(changedChecklistSource.body, sourceL4Lesson.body);
  assert.equal(resolveLearnerLessonPresentation(changedChecklistSource, 've').status, 'english-fallback',
    'changing one of the four inspection locations withdraws this source-bound checklist rather than serving a stale instruction');
});


test('Tshivenda Vegetables assessments keep source answers and withdraw after question or keypoint drift', () => {
  const module = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
  for (const [id, indices] of [['vegetables-staples-l1', [1, 2]], ['vegetables-staples-l2', [1, 1]], ['vegetables-staples-l4', [1, 0]]] as const) {
    const source = module.lessons.find(lesson => lesson.id === id)!;
    const draft = learnerVegetablesDraft.lessons.find(lesson => lesson.id === id)!;
    assert.equal(draft.title.sourceEnglish, source.title);
    assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
    assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), indices);
    for (const [index, question] of draft.quiz.entries()) {
      assert.equal(question.question.sourceEnglish, source.quiz[index].q);
      assert.deepEqual(question.options.map(option => option.sourceEnglish), source.quiz[index].options);
      assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
    }
    assert.equal(resolveLearnerLessonPresentation(source, 've').status, 'draft');
    const changedQuiz = source.quiz.map((question, index) => index === 0 ? { ...question, q: `${question.q} changed` } : question);
    assert.equal(resolveLearnerLessonPresentation({ ...source, quiz: changedQuiz }, 've').status, 'english-fallback');
    assert.equal(resolveLearnerLessonPresentation({ ...source, keyPoints: [`${source.keyPoints[0]} changed`, ...source.keyPoints.slice(1)] }, 've').status, 'english-fallback');
  }
  // 5 October: old exact holds record the before-state; current language/source composition is validated first.
  const l1 = vegetablesBeforeFuller('ve', learnerVegetablesDraft).lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
  assert.match(l1.keyPoints[0].tshivendaDraft, /1-1.2m wide so you never need to step on the growing area/);
  assert.doesNotMatch(l1.keyPoints[0].tshivendaDraft, /masia oṱhe/);
  assert.match(l1.quiz[0].options[1].tshivendaDraft, /either side without stepping on the growing area, avoiding compaction/);
  assert.match(l1.quiz[1].rationale.tshivendaDraft, /transplant shock/);
  // Later exact9 native leaves are validated before this historical English negative.
  const l2 = finalLanguageNextNativeBefore(learnerVegetablesDraft).lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
  // Unchecked comparisons and absolutes remain English; well is not better, nor not-yet never.
  assert.equal(l2.quiz[0].options[0].tshivendaDraft, 'Zwi shumisa less seed nga u angaredza.');
  assert.equal(l2.quiz[0].options[0].reviewStatus, 'machine-draft');
  assert.equal(l2.quiz[0].options[2].tshivendaDraft, 'Lettuce i mela better nga zwipiḓa zwiṱuku.');
  assert.equal(l2.quiz[0].options[2].reviewStatus, 'machine-draft');
  assert.equal(l2.quiz[1].options[3].tshivendaDraft, 'I nga never be released.');
  assert.equal(l2.quiz[1].options[3].reviewStatus, 'machine-draft');
  assert.match(l2.quiz[0].question.tshivendaDraft, /vhege dziṅwe na dziṅwe dza mbili u swika kha tharu/);
  assert.match(l2.quiz[1].rationale.tshivendaDraft, /does not guarantee immediate feeding/);
  // The final ordinary layer localizes safe/suitable without changing the negative.
  // Validate its entire accepted registry before retaining this dated wording.
  const l4 = nativeOrdinaryBeforeFinalBatch(learnerVegetablesDraft).lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;
  assert.equal(l4.keyPoints[3].tshivendaDraft, 'Arali treatment i tshi ṱoḓea, shumisani registered product for the crop and pest nahone ni tevhele label.');
  assert.match(l4.quiz[0].rationale.tshivendaDraft, /dose, protection and harvest waiting instructions/);
  assert.match(l4.quiz[0].rationale.tshivendaDraft, /a i iti uri improvised treatment i vhe safe or suitable/);
  assert.equal(l4.quiz[1].options[3].tshivendaDraft, 'Arali hu aphids specifically');
  assert.equal(l4.quiz[1].options[3].reviewStatus, 'machine-draft');
});
