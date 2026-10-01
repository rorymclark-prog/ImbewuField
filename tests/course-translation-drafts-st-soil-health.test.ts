import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

test('Soil Health Sesotho draft preserves exact sources, safety holds, plant names and quiz indexes', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health');
  assert.ok(source, 'the translated module must have an English source');
  const draft = SESOTHO_SOIL_HEALTH_DRAFT;
  assert.equal(draft.language, 'st');
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id));

  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;
  const numberTokens = (text: string) => text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const placeholders = (text: string) => text.match(/\{[^{}]+\}/g) ?? [];
  const checkPair = (pair: { sourceEnglish: string; sesothoDraft: string; reviewStatus: string }, english: string, path: string) => {
    assert.equal(pair.sourceEnglish, english, `${path}: exact English source must be retained`);
    assert.ok(pair.sesothoDraft.trim(), `${path}: draft or exact-English hold must be present`);
    assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${path}: review status must be explicit`);
    assert.doesNotMatch(pair.sesothoDraft, nonLatin, `${path}: draft must use Latin script`);
    assert.deepEqual(placeholders(pair.sesothoDraft), placeholders(english), `${path}: preserve placeholders`);
    assert.deepEqual(numberTokens(pair.sesothoDraft), numberTokens(english), `${path}: preserve figures`);
    if (pair.reviewStatus === 'hold') assert.equal(pair.sesothoDraft, english, `${path}: held text must stay exact English`);
  };

  checkPair(draft.title, source.title, 'module.title');
  checkPair(draft.description, source.description, 'module.description');
  assert.equal(draft.lessons.length, source.lessons.length, 'all source lessons must be represented');

  const holds: string[] = [];
  const namedPlants = ['wattle', 'oats', 'lupins', 'sunn hemp', 'cowpea', 'maize'];
  for (const [index, lesson] of draft.lessons.entries()) {
    const original: (typeof source.lessons)[number] = source.lessons[index];
    const path = `lessons[${index}] ${original.id}`;
    assert.equal(lesson.id, original.id, `${path}: IDs and lesson order must match`);
    if (original.infographicAlt) {
      assert.ok(lesson.infographicAlt, `${path}: infographic source must be paired`);
      checkPair(lesson.infographicAlt, original.infographicAlt, `${path}.infographicAlt`);
      if (lesson.infographicAlt.reviewStatus === 'hold') holds.push(`${path}.infographicAlt`);
    } else assert.equal(lesson.infographicAlt, undefined, `${path}: do not invent infographic text`);
    checkPair(lesson.title, original.title, `${path}.title`);
    checkPair(lesson.body, original.body, `${path}.body`);
    assert.equal(lesson.body.sesothoDraft.split('\n\n').length, original.body.split('\n\n').length,
      `${path}.body: paragraph boundaries must match`);
    if (lesson.body.reviewStatus === 'hold') holds.push(`${path}.body`);
    for (const plant of namedPlants) {
      if (original.body.toLowerCase().includes(plant)) {
        assert.ok(lesson.body.sesothoDraft.toLowerCase().includes(plant), `${path}.body: preserve named plant ${plant}`);
      }
    }
    assert.equal(lesson.keyPoints.length, original.keyPoints.length, `${path}: key-point count must match`);
    for (const [pointIndex, point] of lesson.keyPoints.entries()) {
      const pointPath = `${path}.keyPoints[${pointIndex}]`;
      checkPair(point, original.keyPoints[pointIndex], pointPath);
      if (point.reviewStatus === 'hold') holds.push(pointPath);
    }
    assert.equal(lesson.quiz.length, original.quiz.length, `${path}: quiz count must match`);
    for (const [questionIndex, question] of lesson.quiz.entries()) {
      const english = original.quiz[questionIndex];
      const questionPath = `${path}.quiz[${questionIndex}]`;
      checkPair(question.question, english.q, `${questionPath}.question`);
      if (question.question.reviewStatus === 'hold') holds.push(`${questionPath}.question`);
      assert.equal(question.options.length, english.options.length, `${questionPath}: option order/count must match`);
      for (const [optionIndex, option] of question.options.entries()) {
        const optionPath = `${questionPath}.options[${optionIndex}]`;
        checkPair(option, english.options[optionIndex], optionPath);
        if (option.reviewStatus === 'hold') holds.push(optionPath);
      }
      assert.equal(question.sourceCorrectIndex, english.correct, `${questionPath}: keep the source answer index`);
      assert.equal(question.options[question.sourceCorrectIndex]?.sourceEnglish, english.options[english.correct],
        `${questionPath}: correct choice must still reference the exact source answer`);
      checkPair(question.rationale, english.rationale, `${questionPath}.rationale`);
      if (question.rationale.reviewStatus === 'hold') holds.push(`${questionPath}.rationale`);
    }
  }

  assert.deepEqual(holds, [
    'lessons[0] soil-health-l1.infographicAlt',
    'lessons[1] soil-health-l2.infographicAlt',
    'lessons[1] soil-health-l2.keyPoints[1]',
    'lessons[1] soil-health-l2.quiz[0].question',
    'lessons[1] soil-health-l2.quiz[0].rationale',
    'lessons[1] soil-health-l2.quiz[1].rationale',
    'lessons[2] soil-health-l3.infographicAlt',
    'lessons[2] soil-health-l3.keyPoints[3]',
    'lessons[2] soil-health-l3.quiz[0].options[2]',
    'lessons[2] soil-health-l3.quiz[0].rationale',
    'lessons[2] soil-health-l3.quiz[1].rationale',
  ], 'uncertain and untranslated fields must remain exact-English holds');

  const compostLesson = source.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(compostLesson);
  const compostDraft = draft.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(compostDraft);
  assert.equal(compostDraft.body.reviewStatus, 'machine-draft');
  const presentation = resolveLearnerLessonPresentation(compostLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, compostDraft.body.sesothoDraft,
    'the complete marked body draft must be shown beside its exact English source');
  assert.equal(presentation.content.keyPoints[1], compostLesson.keyPoints[1],
    'the visible summary must retain the exact sanitation claim until its Sesotho wording is reviewed');
});

test('Soil Health Sesotho L3 drafts only the screened seasonal risks and falls back after source drift', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health')!.lessons[2];
  const draft = SESOTHO_SOIL_HEALTH_DRAFT.lessons[2];
  const english = source.body.split('\n\n');
  const localized = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draft.id, source.id);
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(localized.length, english.length);
  assert.deepEqual(localized.slice(0, 9), english.slice(0, 9));
  assert.deepEqual(localized.slice(9, 12), [
    'Tšimo ea Highveld e siiloeng e sa koaheloa ka mor’a kotulo ea maize e tobana le likotsi tse peli tse kholo.',
    'Moea oa mariha o ka nka mobu o ommeng o ka holimo.',
    'Sefefo sa pele se matla sa selemo se ka otla mobu o sa koaheloang ’me sa senya bokaholimo le sebopeho sa mobu. Ha metsi a phalla holim’a tšimo, a ka nka mobu o khoehileng.',
  ]);
  assert.equal(localized[12], english[12]);
  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.deepEqual(shown.content.quiz.map(question => question.correct), source.quiz.map(question => question.correct));
  const changedSource = { ...source, body: source.body.replace('Winter wind', 'Cold wind') };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback');
});

test('Soil L1 preserves the reviewed jar limits while completing its source-paired Sesotho body', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health')!.lessons[0];
  const draft = SESOTHO_SOIL_HEALTH_DRAFT.lessons[0];
  const english = source.body.split('\n\n');
  const localized = draft.body.sesothoDraft.split('\n\n');

  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(localized.length, english.length);
  assert.deepEqual(localized.slice(0, 3), [
    'Mobung ho na le mefuta e mengata ya dintho tse phelang. Baktheria le fungi di thusa ho qhaqha organic matter le ho tsamaisa dimatlafatsi ka potoloho.',
    'Fungi tse ding di thusa metso ho monya dimatlafatsi. Meselana e entsweng ke diboko e ka thusa metsi le moya ho kena mobung.',
    'Sheba metso, sebopeho sa mobu le motsamao wa metsi, hammoho le dintho tse phelang mobung tse bonahalang.',
  ], 'the previously localized opening paragraphs must remain untouched');
  assert.deepEqual(localized.slice(7, 9), [
    'Bapisa likarolo tse lutseng, ’me u utloe mobu tšimong.',
    'Ngola seo u se bonang le seo u sa kholisehang ka sona. U se ke ua etsa qeto ea ho nosetsa kapa ho alafa mobu ka lebaka la nkho e le ’ngoe feela.',
  ], 'the existing field-comparison and one-jar caution must remain untouched');
  assert.equal(localized[11],
    'Batla mekhoa e iphetang tšimong. Hlahloba nalane ea tsamaiso, metsi a phallang le kholo ea limela pele u khetha tharollo.',
    'the existing remedy-selection paragraph must remain untouched');

  assert.match(localized[3], /clear jar.*suitable dispersing detergent.*E kwale mme o e sisinye.*e sa sisinyehe/,
    'jar procedure must keep the clear container, suitable dispersant, shaking and undisturbed steps');
  assert.match(localized[4], /Sand.*pele.*Silt.*clay.*suspended/,
    'settling order must distinguish sand, silt and clay that remains suspended');
  assert.match(localized[5], /rough learning exercise.*clumps.*clay.*kgelosa.*soil laboratory.*soil texture/,
    'the learning-only limit, misleading clumps and laboratory condition must remain');
  assert.match(localized[6], /Lera le letenya la sand.*cloudy water.*final proportions.*Fine particles.*suspended/,
    'the sand layer and cloudy water must remain distinct; neither establishes final proportions');
  assert.match(localized[9], /compaction.*drainage.*organic matter.*metso.*bophelo ba mobu/,
    'all three possible limits to roots and soil life must remain represented');
  assert.match(localized[10], /ha e pake.*dikhemikhale.*diboko.*mongobo.*sehla/,
    'pale colour or few worms must not become proof of chemical damage, and seasonal variation must remain');

  const jarPoint = draft.keyPoints[2];
  assert.equal(jarPoint.sourceEnglish, source.keyPoints[2]);
  assert.equal(jarPoint.sesothoDraft,
    'Boikwetliso ba jar bo fana ka rough indication ya soil texture, eseng complete soil test.',
    'the summary must say rough indication and not imply a complete soil test');

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.equal(shown.content.keyPoints[2], jarPoint.sesothoDraft);
  assert.deepEqual(shown.content.quiz.map(question => question.correct), source.quiz.map(question => question.correct),
    'body localization must not change the answer mapping');
  const changedSource = { ...source, body: `${source.body}\n\nNew advice requires review.` };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'a changed English source must invalidate the old draft before it reaches a learner');
});

test('Soil L1 Quiz 0 translates only its reviewed assessment fields and keeps the correct index', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health')!.lessons[0];
  const draft = SESOTHO_SOIL_HEALTH_DRAFT.lessons[0];
  const quiz = draft.quiz[0];
  const english = source.quiz[0];

  assert.equal(quiz.question.sourceEnglish, english.q);
  assert.equal(quiz.question.reviewStatus, 'machine-draft');
  assert.match(quiz.question.sesothoDraft, /cloudy water.*lera la sand/,
    'the question must name the sand layer and retain the precise cloudy-water term');
  assert.equal(quiz.options.length, english.options.length);
  assert.deepEqual(quiz.options.map(option => option.sourceEnglish), english.options,
    'all distractors and the correct option must preserve the source order');
  assert.equal(quiz.options[1].reviewStatus, 'machine-draft');
  assert.match(quiz.options[1].sesothoDraft, /Fine particles.*di ka nna tsa sala di suspended.*further observation/,
    'the correct option must preserve may-remain-suspended and the need for further observation');
  assert.equal(quiz.sourceCorrectIndex, 1);
  assert.equal(quiz.options[quiz.sourceCorrectIndex].sourceEnglish, english.options[1]);
  assert.equal(quiz.rationale.sourceEnglish, english.rationale);
  assert.equal(quiz.rationale.reviewStatus, 'machine-draft');
  assert.match(quiz.rationale.sesothoDraft, /Cloudy water.*fine particles.*eso dule fatshe.*hang feela qalong.*ke ke.*final proportions.*treatment/,
    'the rationale must retain unsettled particles and explain that one early check cannot determine proportions or treatment');

  const secondQuiz = draft.quiz[1];
  assert.deepEqual({
    question: secondQuiz.question.sesothoDraft,
    options: secondQuiz.options.map(option => option.sesothoDraft),
    correctIndex: secondQuiz.sourceCorrectIndex,
    rationale: secondQuiz.rationale.sesothoDraft,
  }, {
    question: 'Molemi o fumana mobu o kitlaneng le diboko tse mmalwa feela. Mohato o latelang o nang le thuso ke ofe?',
    options: [
      'Nahana hore setshedi se seng le se seng sa mobu se shwele',
      'Kenya pheko kapa kalafo ntle le ho hlahloba setsha',
      'Hlahloba drainage, metso, mongobo le nalane ya tshebediso le botsamaisi',
      'Nyahama hobane mobu o ke ke wa hlola o ntlafala',
    ],
    correctIndex: 2,
    rationale: 'Diteko le ditekolo tse mmalwa di thusa ho fumana bothata. Mosebetsi wa diboko o fapana le maemo, kahoo diboko tse mmalwa feela ha di tiise sesosa sa tsona.',
  }, 'the existing second quiz must remain untouched by the scoped first-quiz update');
});

test('Soil L2 exposes all twelve compost paragraphs without adding safety or readiness claims', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health')!.lessons[1];
  const draft = SESOTHO_SOIL_HEALTH_DRAFT.lessons[1];
  const english = source.body.split('\n\n');
  const localized = draft.body.sesothoDraft.split('\n\n');

  assert.equal(draft.id, source.id);
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(localized.length, 12);
  assert.equal(english.length, 12);
  for (const [index, paragraph] of localized.entries()) {
    assert.notEqual(paragraph, english[index], `paragraph ${index + 1} must contain the marked Sesotho draft`);
  }
  assert.match(localized[0], /Compost.*organic matter.*qhaqhollwang/,
    'compost remains organic matter broken down under controlled conditions');
  assert.match(localized[1], /Compost.*e phethilweng.*ka ntlafatsa.*sebopeho sa mobu.*dimatlafatsi/,
    'finished compost may improve structure and contribute nutrients without a complete-fertiliser claim');
  assert.match(localized[2], /materials.*mongobo.*moya.*thempereitjha.*province.*dibeke.*readiness test/,
    'readiness depends on listed conditions, not a province name or fixed weeks');
  assert.match(localized[3], /dry browns.*fresh greens.*layers tse teteaneng.*tse metsi.*moya/,
    'the material categories and thick-wet-layer air warning remain');
  assert.match(localized[4], /slimy.*ammonia.*dry browns.*phethole/,
    'the slimy or strong-ammonia condition triggers dry browns and turning');
  assert.match(localized[5], /mongobo.*moya.*recipe e le nngwe.*motswako.*materials/,
    'moisture, air and recipe variability remain explicit');
  assert.match(localized[6], /Karolo e bohareng.*ha e pake.*karolo e nngwe le e nngwe.*treated.*Nako.*temperature.*management/,
    'a hot centre does not guarantee every part was treated');
  assert.match(localized[7], /meat.*dairy.*diseased plants.*pet waste.*contaminated materials.*ka ntle/,
    'every prohibited input remains excluded from the simple household system');
  assert.match(localized[8], /U se ke ua nahana.*home composting.*peo e nngwe le e nngwe.*disease organism.*recognised process.*sanitation/,
    'home composting is not guaranteed to destroy every seed or disease organism; sanitation still requires a recognised process');
  assert.match(localized[9], /wattle seed pods.*ka ntle.*Qubu e tlwaelehileng.*e ka nna ya se.*non-viable/,
    'wattle seed pods stay out and an ordinary heap may not make every seed non-viable');
  assert.match(localized[10], /materials tse hlwekileng feela.*sa alafwang.*Bark.*butle.*ha le pake.*contamination/,
    'clean untreated materials and the bark-name contamination caveat remain');
  assert.match(localized[11], /phethole.*ha e hloka.*moya.*kopanngwa.*mongobo.*waterlogged/,
    'turning remains conditional on need, and moist is distinguished from waterlogged');

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);
  assert.deepEqual(draft.keyPoints.map(point => point.sesothoDraft), [
    'Lekanyetsa tse sootho, tse tala, mongobo le moya',
    'A hot centre does not prove the whole heap is sanitised',
    'Boloka makgapha a dipeo le disebediswa tse nang le ditshila kantle',
    'Ahlola ho loka ho tswa boemong ba kompose, eseng lenaneong le behilweng la nako la lebatowa',
  ], 'all existing key-point wording, including the sanitation hold, stays unchanged');
  assert.deepEqual(shown.content.quiz.map(question => question.correct), source.quiz.map(question => question.correct),
    'both quizzes and answer indices remain unchanged by this body-only batch');
  const changedSource = { ...source, body: source.body.replace('fresh greens', 'fresh material') };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'any changed English compost instruction must invalidate the paired body draft');
});
