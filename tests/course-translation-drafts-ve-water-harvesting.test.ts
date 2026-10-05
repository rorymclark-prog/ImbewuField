import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
// Preserve earlier Soil clause coverage against dated text; live accepted targets are checked before rewind.
import { historicalVE as TSHIVENDA_SOIL_HEALTH_DRAFT } from './soil-learner-reviewed-history.ts';
import { TSHIVENDA_FOOD_FOREST_DRAFT } from '../lib/course-translation-drafts-ve-food-forest.ts';
import { resolveHistoricalPresentation as resolveLearnerLessonPresentation } from './soil-learner-reviewed-history.ts';
import { regionalModuleDraftBadge, resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { resolveDeckLang } from '../lib/course-deck.ts';
import { resolveNarrationLang } from '../lib/course-audio.ts';
import { checkCompleteLessonDraft } from './regional-full-draft-checks.ts';

test('regional Study cards distinguish English module copy from available lesson drafts', () => {
  const source = (id: string) => {
    const module = COURSE_MODULES.find(candidate => candidate.id === id);
    assert.ok(module, `missing source module ${id}`);
    return module;
  };
  assert.equal(regionalModuleDraftBadge(source('seeds-sovereignty'), 've'),
    'Tshivenda AI draft · review pending');
  assert.equal(regionalModuleDraftBadge(source('soil-health'), 'ts'),
    'English module · 3 lesson drafts available');
  // 2026-10-05 phone QA found Market's checked card draft missing from the registry.
  // Its registered card now carries the draft badge; Soil TS still exercises English fallback.
  assert.equal(regionalModuleDraftBadge(source('market-community'), 've'),
    'Tshivenda AI draft · review pending');
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

test('Water Harvesting Tshivenda draft keeps safety clauses exact and answer mapping intact', () => {
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
    // 2026-10-05 source-bound title candidate: retain the formal English technical terms and the checked Tshivenda subtitle.
    'water-harvesting-l1': 'Swales and Berms: U Fhungudza Luvhilo lwa Maḓi kha U Sendama ha Mavu',
    'water-harvesting-l2': 'Madamu na Zwidziva zwa Bulasini: U Vhulunga Maḓi a Tshifhinga tsha Gomelelo',
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
    else if (lesson.id === 'water-harvesting-l4') {
      assert.equal(lesson.title.reviewStatus, 'machine-draft', 'greywater reuse title is visibly unreviewed');
    } else if (lesson.id === 'water-harvesting-l3') {
      assert.equal(lesson.title.tshivendaDraft, 'Rainwater Tanks and Roof Catchment: U kuvhanganya na u tsireledza maḓi');
      assert.equal(lesson.title.reviewStatus, 'machine-draft', 'the checked ordinary purpose clause is visibly unreviewed');
    } else assert.equal(lesson.title.reviewStatus, 'hold', 'untranslated title stays English');
    if (lesson.id === 'water-harvesting-l1' || lesson.id === 'water-harvesting-l2') {
      assert.equal(lesson.body.sourceEnglish, original.body, `${path}.body: retain exact canonical source`);
      assert.equal(lesson.body.reviewStatus, 'machine-draft', `${path}.body: label the full learner copy as unreviewed`);
      assert.notEqual(lesson.body.tshivendaDraft, original.body,
        `${path}.body: do not mark an all-English hold as translated`);
    } else if (lesson.id === 'water-harvesting-l4') {
      assert.equal(lesson.body.sourceEnglish, original.body, `${path}.body: retain exact canonical source`);
      assert.equal(lesson.body.reviewStatus, 'machine-draft', `${path}.body: unreviewed regional prose is visibly a draft`);
      assert.equal(lesson.body.tshivendaDraft.split('\n\n').length, original.body.split('\n\n').length,
        `${path}.body: retain all five canonical safety paragraphs`);
    } else {
      checkPair(lesson.body, original.body, `${path}.body`);
    }
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
    if (lesson.id === 'water-harvesting-l1') {
      const bodyParagraphs = lesson.body.tshivendaDraft.split('\n\n');
      const sourceParagraphs = original.body.split('\n\n');
      assert.equal(sourceParagraphs.length, 8, `${path}.body: canonical lesson has eight paragraphs`);
      bodyParagraphs.forEach((paragraph, paragraphIndex) => {
        assert.notEqual(paragraph, sourceParagraphs[paragraphIndex],
          `${path}.body paragraph ${paragraphIndex + 1}: an English-only hold must not be marked translated`);
      });
      assert.ok(bodyParagraphs[0].startsWith('Lushaka luthihi lwa swale ndi a level trench on contour.'),
        `${path}.body: retain the source-specific level trench geometry`);
      assert.ok(bodyParagraphs[0].includes('Other swales are designed with a slight, controlled grade to carry excess water slowly to a safe outlet.'),
        `${path}.body: preserve the alternative graded design and safe outlet`);
      assert.ok(bodyParagraphs[0].includes('Musi ni sa athu u bwa, humbelani trained local adviser uri a sedze line, overflow na receiving point.'),
        `${path}.body: adviser must check line, overflow and receiver before digging`);
      assert.ok(bodyParagraphs[1].includes('berm nga thungo ya le downhill') &&
        bodyParagraphs[1].includes('miri ya nga ṱavhiwa arali site design yo tea'),
        `${path}.body: retain berm direction and conditional tree planting`);
      assert.ok(bodyParagraphs[2].includes('Miri yo ṱavhiwaho henefho i nga shumisa moisture yo vhulungwaho mavuni') &&
        bodyParagraphs[2].includes('zwi tshi ya nga site'),
        `${path}.body: preserve the conditional moisture benefit`);
      assert.ok(bodyParagraphs[3].startsWith('Heavy rain can fill a swale faster than water soaks into the soil.') &&
        bodyParagraphs[3].includes('Pulani safe overflow ni sa athu u bwa'),
        `${path}.body: preserve the can-risk and overflow-before-digging instruction`);
      assert.ok(bodyParagraphs[4].includes('Route a i tei u erode slope kana u rumela damaging water kha neighbour') &&
        bodyParagraphs[4].includes('Swale kana dam ya fhasi i tea u kona u ṱanganedza maḓi ayo nga vhuḓi'),
        `${path}.body: preserve the erosion/neighbour prohibition and safe downstream capacity`);
      assert.ok(bodyParagraphs[5].includes('Humbelani trained local adviser uri a assess soil, slope na storm flow') &&
        bodyParagraphs[5].includes('Tshifanyiso a si construction design'),
        `${path}.body: retain the adviser request and translate the picture/design limitation`);
      assert.ok(bodyParagraphs[6].startsWith('Slope fhedzi a i sumbedzi arali swale i suitable'),
        `${path}.body: translate that slope alone is insufficient`);
      assert.ok(bodyParagraphs[7].includes('Keep good ground cover.') &&
        bodyParagraphs[7].includes('Wanani local assessment ni sa athu u bwa kha fhethu ha steep, wet kana unstable') &&
        bodyParagraphs[7].includes('Grass barriers na terraces na zwone zwi ṱoḓa design yo teaho site'),
        `${path}.body: retain the imperative and all pre-dig site conditions`);
      assert.ok(bodyParagraphs[0].includes('I fhungudza luvhilo na u phaḓaladza runoff, uri maḓi maṅwe a kone u dzhena kha suitable soil'),
        `${path}.body: translate runoff slowing/spreading and preserve possibility and suitable soil`);
      assert.ok(bodyParagraphs[1].startsWith('Mavu o excavated a vhumba berm nga thungo ya le downhill'),
        `${path}.body: translate berm formation while preserving direction`);
      assert.ok(bodyParagraphs[2].startsWith('Miri yo ṱavhiwaho henefho') &&
        bodyParagraphs[2].includes('zwi tshi ya nga site'),
        `${path}.body: translate the planted-tree subject while preserving its site-dependent qualification`);
      assert.ok(bodyParagraphs[4].startsWith('Route a i tei u erode slope kana u rumela damaging water kha neighbour'),
        `${path}.body: express the prohibition while preserving routing terms`);
      assert.ok(bodyParagraphs[7].includes('Wanani local assessment ni sa athu u bwa kha fhethu ha steep, wet kana unstable'),
        `${path}.body: preserve the local-assessment-before-digging condition`);
      assert.equal(lesson.body.tshivendaDraft.split('\n\n').length, sourceParagraphs.length,
        `${path}.body: preserve all eight source paragraph boundaries`);
      const changedSafetySource = {
        ...original,
        body: original.body.replace(
          'Get a local assessment before digging on steep, wet or unstable land.',
          'Dig on steep, wet or unstable land without an assessment.',
        ),
      };
      assert.notEqual(changedSafetySource.body, original.body,
        `${path}.body safety-drift fixture must actually change the paired source`);
      const drifted = resolveLearnerLessonPresentation(changedSafetySource, 've');
      assert.equal(drifted.status, 'english-fallback', `${path}.body: changing a before-dig safety condition withdraws the draft`);
      assert.equal(drifted.content.body, changedSafetySource.body,
        `${path}.body: show current English after before-dig safety source drift`);
    } else if (lesson.id === 'water-harvesting-l2') {
      const bodyParagraphs = lesson.body.tshivendaDraft.split('\n\n');
      const sourceParagraphs = original.body.split('\n\n');
      assert.equal(sourceParagraphs.length, 9, `${path}.body: canonical lesson has nine paragraphs`);
      assert.equal(bodyParagraphs.length, sourceParagraphs.length, `${path}.body: preserve all paragraph boundaries`);
      bodyParagraphs.forEach((paragraph, paragraphIndex) => {
        assert.notEqual(paragraph, sourceParagraphs[paragraphIndex],
          `${path}.body paragraph ${paragraphIndex + 1}: an English-only hold must not be marked translated`);
      });
      assert.ok(bodyParagraphs[0].startsWith('Dam kana pond i nga vhulunga runoff') &&
        bodyParagraphs[0].includes('maḓi ane a wanala a bva kha mvula ya henefho, catchment, losses') &&
        bodyParagraphs[0].includes('uri ni shumisa maḓi mangana'),
      `${path}.body: retain possibility and local supply dependencies`);
      const existingRainfallSentence = 'Tshifhinga tsha mvula tshi a fhambana u mona na Afurika Tshipembe.';
      assert.ok(bodyParagraphs[1].startsWith(`${existingRainfallSentence} Shumisani local records`),
        `${path}.body: preserve the existing localized rainfall sentence byte-for-byte`);
      assert.ok(bodyParagraphs[1].includes('dry periods') && bodyParagraphs[1].includes('dam yo ḓalaho a yo khwaṱhisedzwi'),
        `${path}.body: keep dry-period planning and the no-guarantee qualifier`);
      assert.ok(bodyParagraphs[2].startsWith('Musi ni sa athu u shandula watercourse kana u fhaṱa storage works') &&
        bodyParagraphs[2].includes('ṱolani authorisation ine ya ṱoḓea kha water authority'),
      `${path}.body: keep the authority check before either regulated activity`);
      assert.ok(bodyParagraphs[3].includes('Dam i ṱoḓa site investigation na design yo itwaho nga suitably qualified person') &&
        bodyParagraphs[3].includes('Catchment runoff, soil, foundations, downstream risk na safe spillway'),
      `${path}.body: retain qualified design and all listed assessment factors`);
      assert.ok(bodyParagraphs[4].startsWith('Ni songo humbula uri annual rainfall i ni vhudza size ya flood'),
        `${path}.body: preserve the warning against inferring flood/storage from annual rainfall`);
      assert.ok(bodyParagraphs[5].startsWith('Overflow i songo langiwaho i nga erode na breach wall') &&
        bodyParagraphs[5].includes('Pulani safe route ya excess water ni sa athu u thoma construction'),
      `${path}.body: preserve possible overflow damage and the before-construction safe route`);
      assert.ok(bodyParagraphs[6].startsWith('Maḓi a nga xela nga evaporation na seepage') &&
        bodyParagraphs[6].includes('Sedzani water level') && bodyParagraphs[6].includes('ṱole leaks kana erosion'),
      `${path}.body: preserve possible losses and the inspection steps`);
      assert.ok(bodyParagraphs[7].startsWith('Keep the spillway clear') &&
        bodyParagraphs[7].includes('maintain the bank cover specified in the design') &&
        bodyParagraphs[7].includes('Ni songo ṱavha trees kha earth dam wall'),
      `${path}.body: retain clear spillway, design-specified bank cover and wall prohibition`);
      assert.ok(bodyParagraphs[8].startsWith('Animals can damage banks and add manure to the water.') &&
        bodyParagraphs[8].includes('U vha hone hadzo a hu iti uri maḓi a vhe clean kana safe'),
      `${path}.body: keep animal scope exact and translate the no-cleanliness/safety inference`);
      const changedWallRule = {
        ...original,
        body: original.body.replace('Do not plant trees on an earth dam wall.', 'Plant trees on an earth dam wall.'),
      };
      assert.notEqual(changedWallRule.body, original.body, `${path}.body drift fixture must change the wall rule`);
      const drifted = resolveLearnerLessonPresentation(changedWallRule, 've');
      assert.equal(drifted.status, 'english-fallback', `${path}.body: changed wall-safety rule withdraws the draft`);
      assert.equal(drifted.content.body, changedWallRule.body);
    } else if (lesson.id === 'water-harvesting-l3') {
      const bodyParagraphs = lesson.body.tshivendaDraft.split('\n\n');
      assert.equal(bodyParagraphs.length, 13, `${path}.body: preserve all source paragraphs`);
      assert.ok(bodyParagraphs[0].includes('i nga kuvhanganya') &&
        bodyParagraphs[0].includes('vhuhulwane ha ṱhanga, mvula na madi a xelaho'),
        `${path}.body: retain collection possibility and all yield factors`);
      assert.ok(bodyParagraphs[2].includes('misses the gutter, is diverted or overflows a full tank'),
        `${path}.body: account for each collection-loss path`);
      assert.ok(bodyParagraphs[3].includes('Tshivhalo tsha ṅwaha woṱhe a tshi ni vhudzi') &&
        bodyParagraphs[3].includes('kha dry spell') && bodyParagraphs[3].includes('Vhambedzani supply') &&
        bodyParagraphs[3].includes('mishumo ine na pulana'),
        `${path}.body: annual rainfall cannot imply dry-spell availability`);
      assert.ok(bodyParagraphs[4].includes('maṅwe maḓi a first runoff'),
        `${path}.body: preserve that only some first runoff is diverted`);
      // These source-checked mixed-language drafts carry the safety rules, so assert those rules here rather than requiring an English hold.
      assert.ok(bodyParagraphs[6].includes('Diverter a i iti uri maḓi o salaho a vhe o tsireledzea u nwiwa'),
        `${path}.body: diverting runoff does not make remaining water safe to drink`);
      assert.ok(bodyParagraphs[10].includes('screen openings against insects') &&
        bodyParagraphs[10].includes('Keep rainwater separate from drinking-water pipes'),
        `${path}.body: preserve insect screening and separate drinking-water plumbing`);
      assert.ok(bodyParagraphs[11].includes('Maḓi ane a vhonala o kuna a nga kha ḓi vha na germs kana chemicals') &&
        bodyParagraphs[11].includes('local health authority') && bodyParagraphs[11].includes('testing na treatment') &&
        bodyParagraphs[11].includes('intended use'),
        `${path}.body: clear-looking water is not proof of safety`);
      assert.ok(bodyParagraphs[12].includes('Basic filter fhedzi a si drinking-water guarantee') &&
        bodyParagraphs[12].includes('food crops') && bodyParagraphs[12].includes('safety assessment'),
        `${path}.body: preserve filter and food-crop safety limits`);
      const changedSource = { ...original, body: original.body.replace('some of the first runoff', 'all of the first runoff') };
      const fallback = resolveLearnerLessonPresentation(changedSource, 've');
      assert.equal(fallback.status, 'english-fallback');
      assert.equal(fallback.content.body, changedSource.body);
    } else if (lesson.id === 'water-harvesting-l4') {
      assert.equal(lesson.body.reviewStatus, 'machine-draft', `${path}.body: unreviewed regional prose is visibly a draft`);
      const bodyParagraphs = lesson.body.tshivendaDraft.split('\n\n');
      assert.equal(bodyParagraphs.length, original.body.split('\n\n').length,
        `${path}.body: retain all five canonical safety paragraphs`);
      assert.ok(bodyParagraphs[1].includes('Ni songo katela toilet water') &&
        bodyParagraphs[1].includes('water from nappies') && bodyParagraphs[1].includes('washing animals') &&
        bodyParagraphs[1].includes('Ni songo dovha na shumisa maḓi a re na harmful chemicals'),
      `${path}.body: retain every excluded water source and harmful-chemical prohibition`);
      assert.ok(bodyParagraphs[2].includes('Before any reuse') && bodyParagraphs[2].includes('municipality') &&
        bodyParagraphs[2].includes('qualified local sanitation adviser') && bodyParagraphs[2].includes('exact source') &&
        bodyParagraphs[2].includes('water na sanitation services') && bodyParagraphs[2].includes('intended use na site') &&
        bodyParagraphs[2].includes('Arali nyeletshedzo iyi i siho kana i unclear') &&
        bodyParagraphs[2].includes('ni songo shumisa maḓi hafhu'),
      `${path}.body: require the authority/adviser checks, with no reuse if advice is missing or unclear`);
      assert.ok(bodyParagraphs[4].includes('reuse system i tshi khou shuma nahone the water smells bad') &&
        bodyParagraphs[4].includes('pools or harms plants') && bodyParagraphs[4].includes('litshani u a shumisa') &&
        bodyParagraphs[4].includes('qualified local advice'),
      `${path}.body: preserve the operating AND symptom OR stop trigger and qualified-advice action`);
    } else {
      assert.equal(lesson.body.reviewStatus, Object.keys(bodySentences).length ? 'machine-draft' : 'hold',
        `${path}: only screened concept sentences are translated`);
      assert.equal(lesson.body.tshivendaDraft, expectedBody,
        `${path}: retain exact source English outside the selected sentences`);
      assert.equal(lesson.body.tshivendaDraft.split('\n\n').length, original.body.split('\n\n').length,
        `${path}: retain paragraph boundaries`);
    }
    assert.equal(lesson.keyPoints.length, original.keyPoints.length);
    for (const [j, point] of lesson.keyPoints.entries()) {
      checkPair(point, original.keyPoints[j], `${path}.keyPoints[${j}]`);
      const shouldDraftPoint = ((lesson.id === 'water-harvesting-l2' || lesson.id === 'water-harvesting-l3') &&
        (j === 0 || j === 2)) || (lesson.id === 'water-harvesting-l4' && j === 0);
      assert.equal(point.reviewStatus, shouldDraftPoint ? 'machine-draft' : 'hold',
        `${path}.keyPoints[${j}]: only reviewed prose becomes a machine draft`);
      if (lesson.id === 'water-harvesting-l2' && (j === 1 || j === 3)) {
        assert.equal(point.tshivendaDraft, original.keyPoints[j],
          `${path}.keyPoints[${j}]: English-only technical wording must have no punctuation-only “translation”`);
      }
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
      const assessedQuiz = lesson.id === 'water-harvesting-l2' || lesson.id === 'water-harvesting-l3' ||
        lesson.id === 'water-harvesting-l4';
      assert.equal(question.question.reviewStatus, assessedQuiz ? 'machine-draft' : 'hold',
        `${path}.quiz[${j}]: source-paired questions are visibly marked when translated`);
      if (lesson.id === 'water-harvesting-l2' && j === 1) {
        for (const optionIndex of [0,1]) {
          assert.equal(question.options[optionIndex].reviewStatus, 'hold',
            `${path}.quiz[${j}].options[${optionIndex}]: English-only option remains held`);
          assert.equal(question.options[optionIndex].tshivendaDraft, originalQuestion.options[optionIndex],
            `${path}.quiz[${j}].options[${optionIndex}]: do not treat added punctuation as translation`);
        }
        assert.equal(question.options[1].sourceEnglish, originalQuestion.options[originalQuestion.correct],
          `${path}.quiz[${j}]: correct answer stays at its original index`);
        assert.ok(question.rationale.tshivendaDraft.startsWith('A clear spillway and maintained banks help the dam work as designed.'),
          `${path}.quiz[${j}].rationale: preserve the source's direct help claim`);
        assert.ok(question.rationale.tshivendaDraft.includes('Trees a dzi tei u ṱavhiwa kha earth dam wall'),
          `${path}.quiz[${j}].rationale: preserve the earth-dam-wall tree prohibition`);
      }
    }
    if (lesson.id === 'water-harvesting-l2') {
      assert.equal(lesson.keyPoints[1].tshivendaDraft, 'Design a safe spillway before construction');
      assert.equal(lesson.keyPoints[3].tshivendaDraft, 'Maintain bank cover and keep trees off an earth dam wall');
      assert.ok(lesson.quiz[0].question.tshivendaDraft.includes('exceptional storm'));
      assert.ok(lesson.quiz[0].question.tshivendaDraft.includes('Ndi mvelelo ifhio ine ya nga tevhela?'),
        'the question asks for a likely result rather than making failure certain');
      assert.ok(lesson.quiz[0].options[1].tshivendaDraft.includes('khombo ya catastrophic breach'),
        'the correct option retains risk rather than certainty of a catastrophic breach');
    }
    if (lesson.id === 'water-harvesting-l3') {
      assert.deepEqual(lesson.quiz.map(item => item.sourceCorrectIndex), [1, 1]);
      assert.ok(lesson.quiz[1].options[1].tshivendaDraft.includes('dzine dza nga contaminate crops dzine dza ḽiwa'),
        'retain can-contaminate modality and edible-crop exposure');
      assert.ok(lesson.quiz[1].rationale.tshivendaDraft.includes('zwi nga fhungudza contamination') &&
        lesson.quiz[1].rationale.tshivendaDraft.includes('a zwi khwaṱhisedzi') &&
        lesson.quiz[1].rationale.tshivendaDraft.includes('intended use'),
      'keep first-flush risk-reduction separate from water-safety assurance');
    }
    if (lesson.id === 'water-harvesting-l4') {
      const paragraphs = lesson.body.tshivendaDraft.split('\n\n');
      assert.equal(original.body.split('\n\n').length, 5, `${path}.body: canonical safety lesson has five paragraphs`);
      assert.equal(paragraphs.length, 5, `${path}.body: preserve every canonical safety paragraph`);
      // 2026-10-05: the previously held exclusion and advice paragraphs now contain checked
      // mixed-language text. Their clauses are asserted above; keep source-exact operational
      // controls and the symptom trigger where the candidate still preserves those sentences.
      for (const exactClause of [
        'Soil and mulch do not disinfect wastewater.',
        'Keep wastewater away from drinking-water plumbing and prevent contact with people or animals.',
        'Do not spray it, let it pool, or allow it to run off the property into a street, drain or watercourse.',
        'the water smells bad, pools or harms plants, litshani u a shumisa ni humbele qualified local advice.',
      ]) assert.ok(lesson.body.tshivendaDraft.includes(exactClause), `${path}.body retains safety clause: ${exactClause}`);
      assert.ok(paragraphs[0].startsWith('Maḓi o shumiswaho hayani') && paragraphs[0].includes('kitchen water na laundry water'),
        `${path}.body: source-paired ordinary introduction retains household and laundry scope`);
      assert.ok(paragraphs[3].startsWith('Tshifanyiso tshi angaredzaho a si farm design.'),
        `${path}.body: keep the generic-picture limitation tied to farm design`);
      assert.deepEqual(lesson.quiz.map(item => item.sourceCorrectIndex), [1, 1],
        `${path}: preserve both canonical answer indices`);
      assert.equal(lesson.keyPoints[1].tshivendaDraft, original.keyPoints[1],
        `${path}: retain the complete local-check/no-advice rule as English`);
      assert.equal(lesson.keyPoints[2].tshivendaDraft, original.keyPoints[2],
        `${path}: retain the wastewater disinfection claim exactly`);
      assert.equal(lesson.quiz[0].options[lesson.quiz[0].sourceCorrectIndex].tshivendaDraft,
        original.quiz[0].options[original.quiz[0].correct], `${path}: correct reuse option stays exact English`);
      assert.ok(lesson.quiz[0].question.tshivendaDraft.includes('before any household washwater is reused'),
        `${path}: mixed question preserves the exact washwater topic and timing`);
      assert.ok(lesson.quiz[1].options[1].tshivendaDraft.includes('Water composition na effects dza products zwi a fhambana') &&
        lesson.quiz[1].options[1].tshivendaDraft.includes('source ya vhukuma na products zwi ṱoḓa assessment'),
        `${path}: preserve exact source-composition and product-assessment claims around the Tshivenda connective`);
    }
  }

  const held = [draft.description, ...draft.lessons.flatMap(l => [l.body, ...l.keyPoints, ...l.quiz.flatMap(q => [q.question, ...q.options, q.rationale])])]
    .filter(p => p.reviewStatus === 'hold' || p.sourceEnglish !== p.tshivendaDraft)
    .map(p => `${p.sourceEnglish}\n${p.tshivendaDraft}`).join('\n');
  for (const criticalClaim of ['safe overflow', 'earth dam wall', 'first-flush diverter', 'not make the remaining water safe to drink', 'qualified local sanitation adviser', 'soil and mulch do not disinfect', 'Do not spray it, let it pool', 'water smells bad, pools or harms plants']) {
    assert.ok(held.toLowerCase().includes(criticalClaim.toLowerCase()), `critical technical anchor remains source-paired: ${criticalClaim}`);
  }
});

test('Tshivenda Water Harvesting shows source-paired lesson drafts and retains held technical claims', () => {
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
    assert.equal(presentation.status, index < 4 ? 'draft' : 'english-fallback',
      `${lesson.id}: report a draft only while at least one source-paired field is translated`);
    assert.equal(presentation.content.title, draft.title.reviewStatus === 'hold'
      ? lesson.title : draft.title.tshivendaDraft, `${lesson.id}: only explicitly drafted titles change`);
    assert.equal(presentation.content.body, draft.body.tshivendaDraft,
      `${lesson.id}: show only exact-source-paired body wording, with technical instructions retained`);
    const expectedKeyPoints = index === 1 || index === 2 || index === 3
      ? lesson.keyPoints.map((point, pointIndex) =>
          (index === 3 ? pointIndex === 0 : [0,2].includes(pointIndex)) ? draft.keyPoints[pointIndex].tshivendaDraft : point)
      : lesson.keyPoints;
    assert.deepEqual(presentation.content.keyPoints, expectedKeyPoints,
      `${lesson.id}: show only source-paired key-point drafts and preserve held text`);
    const expectedQuiz = index === 1 || index === 2 || index === 3
      ? draft.quiz.map(item => ({
          q: item.question.tshivendaDraft,
          options: item.options.map(option => option.tshivendaDraft),
          correct: item.sourceCorrectIndex,
          rationale: item.rationale.tshivendaDraft,
        }))
      : lesson.quiz;
    assert.deepEqual(presentation.content.quiz, expectedQuiz,
      `${lesson.id}: show reviewed-pair candidates without changing option order or correct indices`);
    assert.equal(draft.title.sourceEnglish, lesson.title, `${lesson.id}: title is paired to exact English source`);

    const changedSource = { ...lesson, body: `${lesson.body} Changed.` };
    assert.equal(resolveLearnerLessonPresentation(changedSource, 've').status, 'english-fallback',
      `${lesson.id}: changed source withdraws the entire paired draft`);
    if (lesson.id === 'water-harvesting-l2') {
      const changedKeyPointSource = {
        ...lesson,
        keyPoints: lesson.keyPoints.map((point, pointIndex) =>
          pointIndex === 0 ? `${point} Changed.` : point),
      };
      assert.equal(resolveLearnerLessonPresentation(changedKeyPointSource, 've').status, 'english-fallback',
        `${lesson.id}: changed key-point source withdraws every paired assessment draft`);
      const changedQuizSource = {
        ...lesson,
        quiz: lesson.quiz.map((item, quizIndex) => quizIndex === 0
          ? { ...item, q: `${item.q} Changed.` }
          : item),
      };
      assert.equal(resolveLearnerLessonPresentation(changedQuizSource, 've').status, 'english-fallback',
        `${lesson.id}: changed quiz source withdraws every paired assessment draft`);
    }
    if (lesson.id === 'water-harvesting-l4') {
      const changedKeyPointSource = {
        ...lesson,
        keyPoints: lesson.keyPoints.map((point, pointIndex) =>
          pointIndex === 0 ? `${point} Changed.` : point),
      };
      assert.equal(resolveLearnerLessonPresentation(changedKeyPointSource, 've').status, 'english-fallback',
        `${lesson.id}: changed reuse key point withdraws the entire safety draft`);
      const changedQuizSource = {
        ...lesson,
        quiz: lesson.quiz.map((item, quizIndex) => quizIndex === 0
          ? { ...item, q: `${item.q} Changed.` }
          : item),
      };
      assert.equal(resolveLearnerLessonPresentation(changedQuizSource, 've').status, 'english-fallback',
        `${lesson.id}: changed reuse question withdraws the entire safety draft`);
    }
  }

  assert.equal(resolveCourseModulePresentation({ ...source, title: `${source.title} Changed.` }, 've').status,
    'english-fallback', 'changed module source withdraws its card title');
  assert.deepEqual(resolveDeckLang(source.id, 've'), { lang: 've', exact: true },
    'the silent, source-paired Tshivenda review deck is available');
  assert.deepEqual(resolveNarrationLang(source.id, 've'), { lang: 'en', exact: false },
    'Tshivenda narration remains explicitly identified as English');
});

test('Soil Health Tshivenda L1 keeps the complete paired body visibly in draft', () => {
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
    ['lessons[0].keyPoints[3]', 'Ṱolani drainage, midzi na management history ni sa athu khetha remedy.'],
    ['lessons[0].quiz[0].question', 'Jar ya mavu i kha ḓi vha na cloudy water nga nṱha ha lera la sand. Mulimi u fanela u phetha mini?'],
    ['lessons[0].quiz[0].options[0]', 'Mavu a ṱoḓa less water nga ngoho'],
    ['lessons[0].quiz[0].options[1]', 'Fine particles dzi nga kha ḓi vha suspended; u sedza hafhu zwi a ṱoḓea'],
    ['lessons[0].quiz[0].options[2]', 'Clay yoṱhe yo no dzula fhasi'],
    ['lessons[0].quiz[0].options[3]', 'Crop i ṱoḓa gypsum nga ngoho'],
    ['lessons[0].quiz[0].rationale', 'Cloudy water i nga vha na fine particles dzi sa athu u dzula fhasi. U sedza ha u thoma luthihi a hu nga khwaṱhisedzi final proportions kana right treatment.'],
    ['lessons[0].quiz[1].question', 'Mulimi u wana mavu o compacted na worms dzi si gathi. Ndi vhukando vhufhio vhu tevhelaho vhune ha nga thusa?'],
    ['lessons[0].quiz[1].options[0]', 'Humbulani uri soil organism iṅwe na iṅwe yo fa'],
    ['lessons[0].quiz[1].options[1]', 'Engedzani treatment ni sa athu ṱola site'],
    ['lessons[0].quiz[1].options[2]', 'Ṱolani drainage, midzi, moisture na management history'],
    ['lessons[0].quiz[1].options[3]', 'Litshani u lingedza ngauri mavu a nga si khwinifhadzee'],
    ['lessons[0].quiz[1].rationale', 'U sedza zwithu zwo vhalaho zwi thusa u wana thaidzo. Worm activity i a shanduka u ya nga conditions, ngauralo worms dzi si gathi fhedzi a dzi khwaṱhisedzi uri thaidzo yo vhangwa nga mini.'],
    ['lessons[1].title', 'U Ita na U Shumisa Khomposo (Compost)'],
    ['lessons[0].infographicAlt', 'Soil cross-section i sumbedza dark topsoil nga nṱha ha pale subsoil, i na worms mbili. Kha thungo, the soil in the jar settles into three layers — sand, silt na clay.'],
    ['lessons[1].infographicAlt', 'Heap ya compost cut open i sumbedza alternating layers dza dry brown material na fresh green material. Heat i gonya i tshi bva vhukati; an arrow shows the heap being turned.'],
    ['lessons[2].infographicAlt', 'Zwipiḓa zwivhili zwa soil nga fhasi ha ḓuvha ḽithihi: bare ground, cracked and dry; mulched ground i kha ḓi vha dark nahone i na moisture.'],
    ['lessons[2].title', 'Mulching and Cover Crops: U tsireledza mavu na Building Soil'],
    ['lessons[1].keyPoints[0]', 'Linganyisani browns, greens, moisture na air.'],
    ['lessons[1].keyPoints[1]', 'Vhukati ho fhisaho a vhu sumbedzi uri heap yoṱhe yo sanitised.'],
    ['lessons[1].keyPoints[2]', 'Siyani seed pods na contaminated materials nnḓa ha heap.'],
    ['lessons[1].keyPoints[3]', 'Ṱolani uri compost yo lugela nga condition yayo; ni songo shumisa fixed regional timetable.'],
    ['lessons[1].quiz[0].question', 'Heap ya compost ya mulimi i nukha ammonia nga maanḓa nahone i wet na slimy. Ndi mini zwine zwa nga lugisa?'],
    ['lessons[1].quiz[0].options[0]', 'Engedzani green material ine ya vha na nitrogen nnzhi'],
    ['lessons[1].quiz[0].options[1]', 'Engedzani dry carbon material i ngaho straw nahone ni i rembuluse.'],
    ['lessons[1].quiz[0].options[2]', 'Litshani u rembulusa heap, ni i tende i rothole.'],
    ['lessons[1].quiz[0].options[3]', 'Engedzani maḓi manzhi — honoyo munukho u amba uri yo oma nga maanḓa'],
    ['lessons[1].quiz[0].rationale', 'A wet, slimy heap may need more air and drier material. Engedzani dry browns ni i rembuluse heap to open it up. An ammonia smell can also suggest too much nitrogen-rich material. Check that the heap stays damp, not soggy.'],
    ['lessons[1].quiz[1].question', 'Ndi ngani ni tshi tea u vhea wattle seed pods nnḓa ha ordinary compost heap?'],
    ['lessons[1].quiz[1].options[0]', 'Bark i ita uri heap iṅwe na iṅwe i fhise nga maanḓa'],
    ['lessons[1].quiz[1].options[1]', 'Dziṅwe seeds dzi nga survive nahone dza phaḓalala musi compost i tshi shumiswa'],
    ['lessons[1].quiz[1].options[2]', 'Pods dzi kunga termites tshifhinga tshoṱhe'],
    ['lessons[1].quiz[1].options[3]', 'Pods dzi bvisa gas ine ya vhulaha zwivhumbiwa zwoṱhe zwa soil'],
    ['lessons[1].quiz[1].rationale', 'An ordinary heap may not expose every seed to conditions that make it non-viable. U bvisa pods zwi thivhela uri dzi phaḓalale dzi tshi ṱuwa na compost.'],
    ['lessons[2].keyPoints[0]', 'Tsireledzani exposed soil nga cover yo teaho.'],
    ['lessons[2].keyPoints[1]', 'Vhetseni mulch kule na trunks na stems.'],
    ['lessons[2].keyPoints[2]', 'Khethani cover crops u ya nga maḓi a henefho, mutsho na crop i tevhelaho.'],
    ['lessons[2].keyPoints[3]', 'Worm-bin leachate a i sokou vha safe fertiliser; i vhetseni kule na edible plants.'],
    ['lessons[2].quiz[0].question', 'Mulimi wa Highveld u kaṋa maize nga April a sia field i songo fukedzwaho all winter. Ndi khombo dzifhio mbili khulwane?'],
    ['lessons[2].quiz[0].options[0]', 'U fhisa nga maanḓa fhasi ha ḓuvha ḽa winter na waterlogging from rain'],
    ['lessons[2].quiz[0].options[1]', 'Frost i vhulaha zwivhumbiwa zwi tshilaho mavuni, weeds dzi dzhia fhethu nga u ṱavhanya'],
    ['lessons[2].quiz[0].options[2]', 'Wind erosion ya dry topsoil na u tshinyala ha soil structure nga u rwa ha spring storm'],
    ['lessons[2].quiz[0].options[3]', 'Soil pH i tsela fhasi na nitrogen i a kuvhangana'],
    ['lessons[2].quiz[0].rationale', 'Mavu a songo fukedzwaho a vha khagala kha wind ya winter, ine ya nga hwala dry topsoil ya i bvisa. U rwa ha marothi a mvula hu nga tshinyadza surface; where water runs over the field, it can carry loosened soil away.'],
    ['lessons[2].quiz[1].question', 'Ni fanela u humbula mini nga liquid draining from a worm bin?'],
    ['lessons[2].quiz[1].options[0]', 'I dzula yo safe tshifhinga tshoṱhe kha salad leaves'],
    ['lessons[2].quiz[1].options[1]', 'I nga vha na harmful organisms kana substances; dilution a si safety guarantee'],
    ['lessons[2].quiz[1].options[2]', 'I fana tshoṱhe na finished worm castings'],
    ['lessons[2].quiz[1].options[3]', 'Fixed dilution i ita uri liquid iṅwe na iṅwe i vhe safe'],
    ['lessons[2].quiz[1].rationale', 'Leachate ndi liquid that drains naturally from a worm bin. Composition yayo i a fhambana, ngauralo a i tei u sumbedzwa sa feed yo khwaṱhisedzwaho uri yo safe kha edible crops.'],
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
    if (lesson.infographicAlt) checkPair(paired.infographicAlt!, lesson.infographicAlt, `${path}.infographicAlt`, translated.has(`${path}.infographicAlt`));
    else assert.equal(paired.infographicAlt, undefined);
    checkPair(paired.title, lesson.title, `${path}.title`, index < 2);
    if (index === 0) {
      assert.equal(paired.body.sourceEnglish, lesson.body, `${path}.body: pair the complete canonical lesson exactly`);
      assert.equal(paired.body.reviewStatus, 'machine-draft', `${path}.body: identify the unreviewed learner draft`);
      const sourceParagraphs = lesson.body.split('\n\n');
      const bodyParagraphs = paired.body.tshivendaDraft.split('\n\n');
      assert.equal(bodyParagraphs.length, sourceParagraphs.length, `${path}.body: preserve all source paragraph boundaries`);
      sourceParagraphs.forEach((paragraph, paragraphIndex) => {
        assert.notEqual(bodyParagraphs[paragraphIndex], paragraph,
          `${path}.body paragraph ${paragraphIndex + 1}: don't show an English-only hold as translated`);
      });
      assert.deepEqual(numberTokens(paired.body.tshivendaDraft), numberTokens(lesson.body),
        `${path}.body: preserve every numeric source token`);
    } else {
      if (index === 1) {
        assert.equal(paired.body.sourceEnglish, lesson.body, `${path}.body: preserve the exact canonical source pairing`);
        assert.equal(paired.body.reviewStatus, 'machine-draft', `${path}.body: keep the complete unreviewed translation visibly marked`);
        const sourceParagraphs = lesson.body.split('\n\n');
        const bodyParagraphs = paired.body.tshivendaDraft.split('\n\n');
        assert.equal(bodyParagraphs.length, sourceParagraphs.length, `${path}.body: preserve all 12 paragraph boundaries`);
        sourceParagraphs.forEach((paragraph, paragraphIndex) => {
          assert.notEqual(bodyParagraphs[paragraphIndex], paragraph,
            `${path}.body paragraph ${paragraphIndex + 1}: the reviewed candidate replaces this obsolete exact-English hold`);
        });
        assert.deepEqual(numberTokens(paired.body.tshivendaDraft), numberTokens(lesson.body),
          `${path}.body: preserve every numeric source token`);
      } else if (index === 2) {
        assert.equal(paired.body.sourceEnglish, lesson.body, `${path}.body: preserve the exact canonical source pairing`);
        assert.equal(paired.body.reviewStatus, 'machine-draft', `${path}.body: mark the complete unreviewed L3 draft`);
        const sourceParagraphs = lesson.body.split('\n\n');
        const bodyParagraphs = paired.body.tshivendaDraft.split('\n\n');
        assert.equal(bodyParagraphs.length, 13, `${path}.body: preserve all 13 source paragraph boundaries`);
        sourceParagraphs.forEach((paragraph, paragraphIndex) => {
          assert.notEqual(bodyParagraphs[paragraphIndex], paragraph,
            `${path}.body paragraph ${paragraphIndex + 1}: replace this obsolete full-paragraph English hold`);
        });
        assert.deepEqual(numberTokens(paired.body.tshivendaDraft), numberTokens(lesson.body),
          `${path}.body: preserve every numeric source token`);
      } else {
        checkPair(paired.body, lesson.body, `${path}.body`);
        assert.deepEqual(paired.body.tshivendaDraft.split('\n\n'), lesson.body.split('\n\n'), `${path}: preserve paragraph boundaries`);
      }
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

  assert.equal(heldFields, 1, 'the module summary remains held; the three image descriptions now use exact-source machine drafts while compost diagnostics and the L3 purpose title keep their existing checks');

  const modulePresentation = resolveCourseModulePresentation(source, 've');
  assert.equal(modulePresentation.status, 'draft', 'show the existing, visibly labelled Tshivenda module draft');
  assert.equal(modulePresentation.title, draft.title.tshivendaDraft);
  assert.equal(modulePresentation.description, source.description,
    'technical module summary stays exact English until its terms are checked');
  for (const [index, lesson] of source.lessons.entries()) {
    const presentation = resolveLearnerLessonPresentation(lesson, 've');
    const paired = draft.lessons[index];
    assert.equal(presentation.status, 'draft',
      `${lesson.id}: status only claims a draft when at least one field is translated`);
    assert.equal(presentation.content.title, paired.title.tshivendaDraft, `${lesson.id}: show the paired title draft`);
    assert.equal(presentation.content.body, paired.body.tshivendaDraft,
      `${lesson.id}: show its exact-source-paired body draft`);
    const expectedKeyPoints = lesson.keyPoints.map((point, pointIndex) =>
      translated.get(`lessons[${index}].keyPoints[${pointIndex}]`) ?? point);
    assert.deepEqual(presentation.content.keyPoints, expectedKeyPoints,
      `${lesson.id}: show source-paired key-point drafts and retain exact-English holds`);
    const expectedQuiz = lesson.quiz.map((question, questionIndex) => ({
      q: translated.get(`lessons[${index}].quiz[${questionIndex}].question`) ?? question.q,
      options: question.options.map((option, optionIndex) =>
        translated.get(`lessons[${index}].quiz[${questionIndex}].options[${optionIndex}]`) ?? option),
      correct: question.correct,
      rationale: translated.get(`lessons[${index}].quiz[${questionIndex}].rationale`) ?? question.rationale,
    }));
    assert.deepEqual(presentation.content.quiz, expectedQuiz,
      `${lesson.id}: show only the source-paired quiz drafts and keep the original answer mapping`);
    assert.equal(presentation.content.infographicAlt, translated.get(`lessons[${index}].infographicAlt`) ?? lesson.infographicAlt,
      `${lesson.id}: show only exact-source infographic drafts; unchanged descriptions remain English`);

    assert.equal(resolveLearnerLessonPresentation({ ...lesson, title: `${lesson.title} changed` }, 've').status,
      'english-fallback', `${lesson.id}: changed source withdraws the whole paired draft`);
    if (index === 0 || index === 2) {
      assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} changed` }, 've').status,
        'english-fallback', `${lesson.id}: changed body withdraws the whole paired draft`);
    }
  }
  assert.equal(resolveCourseModulePresentation({ ...source, description: `${source.description} changed` }, 've').status,
    'english-fallback', 'changed module source withdraws the card draft');
});

// Rewritten 2 October 2026 (Food Forest batch; the Water and Soil tests in this file are unchanged): Food
// Forest L1 is now a complete Tshivenda draft. The old pins on seven translated paragraphs, four English
// paragraphs and held key points and quiz fields give way to a complete-lesson check; the species names
// and "frost tolerance" stay exact English, and "local restrictions" and "fixed birthday" are translated.
test('Tshivenda Food Forest L1 draft translates every field and preserves the planting safeguards', () => {
  const source = COURSE_MODULES.find(module => module.id === 'food-forest');
  assert.ok(source, 'Food Forest must remain paired to the canonical English module');
  const draft = TSHIVENDA_FOOD_FOREST_DRAFT;
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.language, 've');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), ['food-forest-l1', 'food-forest-l2', 'food-forest-l3'],
    'every lesson is drafted, in source order');

  const lesson = source.lessons.find(item => item.id === 'food-forest-l1');
  assert.ok(lesson, 'the canonical L1 must remain available');
  const lessonDraft = draft.lessons[0];
  assert.ok(lesson.infographicAlt);
  assert.doesNotMatch(lesson.infographicAlt, /root crops|seven layers/i,
    'the actual diagram shows woody roots and overlapping heights, not identifiable root crops or seven countable layers');
  checkCompleteLessonDraft(lesson, lessonDraft, 've');
  assert.equal(lessonDraft.body.tshivendaDraft.split('\n\n').length, 13, 'the body keeps all thirteen original paragraph boundaries');

  const sensitiveEnglish = [
    'Wild Fig', 'pecan', 'lemon', 'naartjie', 'black mulberry', 'Cape gooseberry', 'Wild Medlar',
    'wild garlic', 'sweet potato', 'granadilla', 'frost tolerance',
  ];
  for (const term of sensitiveEnglish) {
    assert.ok(lessonDraft.body.tshivendaDraft.includes(term), `source-sensitive content remains present: ${term}`);
  }

  const modulePresentation = resolveCourseModulePresentation(source, 've');
  assert.equal(modulePresentation.status, 'draft');
  assert.equal(modulePresentation.title, draft.title.tshivendaDraft);
  assert.equal(modulePresentation.description, draft.description.tshivendaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, title: `${lesson.title} changed` }, 've').status,
    'english-fallback', 'a changed English source withdraws the whole paired lesson draft');
  assert.equal(resolveCourseModulePresentation({ ...source, description: `${source.description} changed` }, 've').status,
    'english-fallback', 'a changed module source withdraws its paired card draft');
});
