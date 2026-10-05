import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import type { Lesson } from '../lib/course-modules.ts';
import { historicalST as SESOTHO_SOIL_HEALTH_DRAFT } from './soil-learner-reviewed-history.ts';
// Earlier clause checks retain their dated wording; the helper verifies live accepted text before rewinding it.
import { resolveHistoricalPresentation as resolveLearnerLessonPresentation } from './soil-learner-reviewed-history.ts';

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

  assert.deepEqual(holds, [], 'the three formerly held infographic descriptions now have source-paired machine drafts; all other assessed fields remain covered above');
  for (const lessonId of ['soil-health-l1', 'soil-health-l2', 'soil-health-l3']) {
    const metadataSourceLesson: Lesson = source.lessons.find((lesson: Lesson) => lesson.id === lessonId)!;
    const draftLesson = draft.lessons.find(lesson => lesson.id === lessonId)!;
    assert.equal(draftLesson.infographicAlt?.sourceEnglish, metadataSourceLesson.infographicAlt);
    assert.equal(draftLesson.infographicAlt?.reviewStatus, 'machine-draft');
    assert.notEqual(draftLesson.infographicAlt?.sesothoDraft, metadataSourceLesson.infographicAlt,
      `${lessonId}: the paired description is visibly drafted rather than an English copy`);
  }

  const compostLesson = source.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(compostLesson);
  const compostDraft = draft.lessons.find(lesson => lesson.id === 'soil-health-l2');
  assert.ok(compostDraft);
  assert.equal(compostDraft.body.reviewStatus, 'machine-draft');
  const presentation = resolveLearnerLessonPresentation(compostLesson, 'st');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, compostDraft.body.sesothoDraft,
    'the complete marked body draft must be shown beside its exact English source');
  assert.equal(presentation.content.keyPoints[1], compostDraft.keyPoints[1].sesothoDraft,
    'the localized key point must preserve the source sanitation limitation');

  const sanitationPoint = compostDraft.keyPoints[1];
  assert.equal(sanitationPoint.sourceEnglish, compostLesson.keyPoints[1]);
  assert.equal(sanitationPoint.reviewStatus, 'machine-draft');
  assert.match(sanitationPoint.sesothoDraft, /chesang.*ha e pake.*qubu yohle.*sanitised/,
    'a hot centre must not be presented as proof of whole-heap sanitation');

  const ammoniaSource = compostLesson.quiz[0];
  const ammoniaDraft = compostDraft.quiz[0];
  assert.equal(ammoniaDraft.question.sourceEnglish, ammoniaSource.q);
  assert.equal(ammoniaDraft.question.reviewStatus, 'machine-draft');
  assert.match(ammoniaDraft.question.sesothoDraft, /nkha ammonia haholo.*metsi.*slimy/,
    'the question must retain the strong ammonia smell and wet, slimy heap conditions');
  assert.equal(ammoniaDraft.sourceCorrectIndex, ammoniaSource.correct);
  assert.equal(ammoniaDraft.sourceCorrectIndex, 1);
  assert.deepEqual(ammoniaDraft.options.map(option => option.sourceEnglish), ammoniaSource.options,
    'all four existing options stay in source order');
  assert.deepEqual(presentation.content.quiz[0], {
    q: ammoniaDraft.question.sesothoDraft,
    options: ammoniaDraft.options.map(option => option.sesothoDraft),
    correct: ammoniaSource.correct,
    rationale: ammoniaDraft.rationale.sesothoDraft,
  }, 'the exact-paired question and rationale reach the learner while options and answer index stay unchanged');
  assert.match(ammoniaDraft.rationale.sesothoDraft, /e ka hloka moya o mongata le material e ommeng ho feta/,
    'a wet, slimy heap may need more air and drier material');
  assert.match(ammoniaDraft.rationale.sesothoDraft, /Eketsa dry browns.*phethole qubu.*hore e bulehe.*moya o kene/,
    'the rationale preserves adding dry browns and turning the heap to open it up');
  assert.match(ammoniaDraft.rationale.sesothoDraft, /Monko wa ammonia le wona o ka bontsha.*material e ngata haholo.*nitrogen/,
    'the ammonia smell can also suggest excess nitrogen-rich material without asserting it as certain');
  assert.match(ammoniaDraft.rationale.sesothoDraft, /e dule e le damp, e se be soggy/,
    'the final moisture check remains damp, not soggy');

  const wattleSource = compostLesson.quiz[1];
  const wattleDraft = compostDraft.quiz[1];
  assert.equal(wattleDraft.sourceCorrectIndex, wattleSource.correct);
  assert.equal(wattleDraft.sourceCorrectIndex, 1);
  assert.deepEqual(wattleDraft.options.map(option => option.sourceEnglish), wattleSource.options,
    'the existing wattle answer options and order stay unchanged');
  assert.equal(wattleDraft.rationale.sourceEnglish, wattleSource.rationale);
  assert.equal(wattleDraft.rationale.reviewStatus, 'machine-draft');
  assert.deepEqual(presentation.content.quiz[1], {
    q: wattleDraft.question.sesothoDraft,
    options: wattleDraft.options.map(option => option.sesothoDraft),
    correct: wattleSource.correct,
    rationale: wattleDraft.rationale.sesothoDraft,
  }, 'the unchanged source-paired wattle question/options and new rationale reach the learner');
  assert.match(wattleDraft.rationale.sesothoDraft, /e ka nna ya se pepesetse peo e nngwe le e nngwe/,
    'an ordinary heap may fail to expose every seed to non-viable conditions');
  assert.match(wattleDraft.rationale.sesothoDraft, /maemong a ka e etsang hore e se hlole e kgona ho mela \(non-viable\)/,
    'non-viability stays tied to the conditions');
  assert.match(wattleDraft.rationale.sesothoDraft, /Ho ntsha makgapha a dipeo ho thibela hore a se ke a nama mmoho le kompose/,
    'excluding seed pods is explained as preventing their spread with compost');

  const changedQuizSource = {
    ...compostLesson,
    quiz: compostLesson.quiz.map((question, index) => index === 0
      ? { ...question, rationale: `${question.rationale} Changed source.` }
      : question),
  };
  assert.equal(resolveLearnerLessonPresentation(changedQuizSource, 'st').status, 'english-fallback',
    'source drift in an assessment field withdraws the entire paired lesson draft');
});

test('Soil Health Sesotho L3 preserves screened seasonal risks and checks mulch/leachate claims against source drift', () => {
  const source = COURSE_MODULES.find(module => module.id === 'soil-health')!.lessons[2];
  const draft = SESOTHO_SOIL_HEALTH_DRAFT.lessons[2];
  const english = source.body.split('\n\n');
  const localized = draft.body.sesothoDraft.split('\n\n');
  assert.equal(draft.id, source.id);
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  assert.equal(localized.length, 13);
  assert.ok(localized.every((paragraph, index) => paragraph !== english[index]),
    'all previous English body holds must now have paired draft prose');

  assert.match(localized[0], /mulch e hlwekileng e loketseng.*straw.*dry grass.*wood chips/,
    'the cover instruction retains clean, suitable mulch and all three source examples');
  assert.match(localized[1], /e ka fokotsa evaporation.*pula.*mefoka/,
    'the benefits remain modal and include evaporation, rain impact and weeds');
  assert.match(localized[2], /trunks and stems.*mongobo.*layer.*ha e dule e le betere/,
    'keep mulch clear of trunks/stems, check moisture underneath, and do not imply more is always better');
  assert.match(localized[3], /Cover crops.*main crops.*metsi a fumanehang.*next planting/,
    'cover-crop choice remains between main crops and depends on local weather, available water and next planting');
  assert.match(localized[4], /oats, lupins, sunn hemp le cowpea.*pele o jala/,
    'the four named examples remain unchanged and local suitability is checked before sowing');
  assert.match(localized[5], /Legumes.*bacteria tse loketseng.*maemo a kgolo.*fix nitrogen.*masalleng.*di a fumaneha ha.*bola/,
    'nitrogen fixation keeps its bacteria/growing conditions requirements and residues release nutrients as they decompose');
  assert.match(localized[6], /Worm farms.*food scraps le bedding tse loketseng.*worm castings.*Hlahloba bin.*letsatsi le behilweng/,
    'suitable scraps and bedding become castings, and bin condition takes precedence over a fixed harvest date');
  assert.match(localized[7], /^Liquid that drains naturally from a worm bin.*leachate.*worm-casting tea/,
    'natural drainage remains distinct from prepared worm-casting tea');
  assert.match(localized[8], /Leachate e ka ba le harmful organisms kapa substances.*O se ke wa e sebedisa hodima edible plants.*hlapolla.*bolokehe/,
    'leachate may contain harm, must not be used on edible plants, and dilution is not treated as safe');
  assert.deepEqual(localized.slice(9, 12), [
    'Tšimo ea Highveld e siiloeng e sa koaheloa ka mor’a kotulo ea maize e tobana le likotsi tse peli tse kholo.',
    'Moea oa mariha o ka nka mobu o ommeng o ka holimo.',
    'Sefefo sa pele se matla sa selemo se ka otla mobu o sa koaheloang ’me sa senya bokaholimo le sebopeho sa mobu. Ha metsi a phalla holim’a tšimo, a ka nka mobu o khoehileng.',
  ], 'the existing 10–12 seasonal risk translations remain verbatim, including conditional runoff');
  assert.match(localized[12], /Cover crops, mulch le organic matter di ka thusa ho tshwara mobu.*dule o phela/,
    'the closing claim remains that these covers can help hold soil and keep it alive');

  const shown = resolveLearnerLessonPresentation(source, 'st');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.sesothoDraft);

  const kp = draft.keyPoints[3];
  assert.equal(kp.sourceEnglish, source.keyPoints[3]);
  assert.equal(kp.reviewStatus, 'machine-draft');
  assert.match(kp.sesothoDraft, /Leachate.*do not use it on edible plants/,
    'the leachate summary explicitly prohibits use on edible plants');
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.sesothoDraft));

  const seasonalQuiz = draft.quiz[0];
  assert.equal(seasonalQuiz.sourceCorrectIndex, source.quiz[0].correct);
  assert.equal(seasonalQuiz.sourceCorrectIndex, 2);
  assert.deepEqual(seasonalQuiz.options.map(option => option.sourceEnglish), source.quiz[0].options,
    'seasonal quiz options remain paired and in canonical order');
  assert.equal(seasonalQuiz.options[2].reviewStatus, 'machine-draft');
  assert.match(seasonalQuiz.options[2].sesothoDraft, /Wind erosion.*topsoil e ommeng.*soil structure.*spring storm/,
    'the correct risk answer retains wind erosion, dry topsoil, structure loss and spring storm impact');
  assert.match(seasonalQuiz.rationale.sesothoDraft, /moya wa mariha.*topsoil e ommeng.*marothodi a pula.*moo metsi a phallang.*mobu o hlephileng/,
    'the rationale keeps the winter-wind and raindrop claims and runoff conditional');
  assert.equal(shown.content.quiz[0].correct, source.quiz[0].correct);

  const leachateQuiz = draft.quiz[1];
  assert.equal(leachateQuiz.sourceCorrectIndex, source.quiz[1].correct);
  assert.equal(leachateQuiz.sourceCorrectIndex, 1);
  assert.equal(leachateQuiz.rationale.sourceEnglish, source.quiz[1].rationale);
  assert.equal(leachateQuiz.rationale.reviewStatus, 'machine-draft');
  assert.match(leachateQuiz.rationale.sesothoDraft, /^Leachate ke liquid that drains naturally from a worm bin/,
    'the rationale retains that leachate drains naturally from the worm bin');
  assert.match(leachateQuiz.rationale.sesothoDraft, /Composition ya yona e a fapana.*feed e bolokehileng ka tiisetso.*edible crops/,
    'variable composition is not presented as a guaranteed-safe feed for edible crops');
  assert.match(shown.content.quiz[1].rationale, /liquid that drains naturally from a worm bin/);

  const changedSource = { ...source, body: source.body.replace('Winter wind', 'Cold wind') };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'changing one canonical body condition withdraws the complete source-paired draft');
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

test('Soil L2 body and scoped assessment drafts preserve compost caveats and answer indexes', () => {
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
    'Karolo e bohareng e chesang ha e pake hore qubu yohle e sanitised.',
    'Boloka makgapha a dipeo le disebediswa tse nang le ditshila kantle',
    'Ahlola ho loka ho tswa boemong ba kompose, eseng lenaneong le behilweng la nako la lebatowa',
  ], 'only the held sanitation key point changes; the other key points remain as they were');
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.sesothoDraft),
    'the scoped keypoint draft appears in learner view');
  assert.deepEqual(shown.content.quiz.map(question => question.correct), source.quiz.map(question => question.correct),
    'both source answer indexes remain unchanged');
  assert.equal(shown.content.quiz[0].q, draft.quiz[0].question.sesothoDraft);
  assert.equal(shown.content.quiz[0].rationale, draft.quiz[0].rationale.sesothoDraft);
  assert.equal(shown.content.quiz[1].q, draft.quiz[1].question.sesothoDraft,
    'the existing wattle question remains as it was');
  assert.deepEqual(shown.content.quiz[1].options, draft.quiz[1].options.map(option => option.sesothoDraft),
    'the existing wattle options remain in source order and unchanged');
  assert.equal(shown.content.quiz[1].rationale, draft.quiz[1].rationale.sesothoDraft);
  const changedSource = { ...source, body: source.body.replace('fresh greens', 'fresh material') };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'st').status, 'english-fallback',
    'any changed English compost instruction must invalidate the paired body draft');
});

// Ordinary-prose completion supersedes dated target wording, while canonical
// fields, quiz mapping and every unlisted native property stay protected.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SESOTHO_SOIL_HEALTH_DRAFT as liveST } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT as liveVE } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT as liveTS } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { resolveLearnerLessonPresentation as liveResolve } from '../lib/course-localization.ts';
import { soilPacket, soilBefore, fieldAt } from './soil-learner-reviewed-history.ts';

const liveSoil = { st: liveST, ve: liveVE, ts: liveTS };
const targetKeys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' };

test('Soil ordinary completion binds all 153 fields to canonical source and preserves every unlisted native property', () => {
  const bytes = readFileSync(new URL('../docs/study-translation-reviews/soil-learner-fuller-2026-10-05/soil-learner-final-accepted-candidates.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '38d5cc52ba57f5e1b7da2461010af86ddfb9697a76963ec23d64e78580867016');
  // The later independently checked decomposition layer supersedes four terms,
  // and SA spelling supersedes one word; retain the original audit binding.
  const historicalBytes = readFileSync(new URL('../docs/study-translation-reviews/soil-learner-fuller-2026-10-05/soil-learner-ordinary-full-repaired-candidates.json', import.meta.url));
  assert.equal(createHash('sha256').update(historicalBytes).digest('hex'), '5728a9b2899c4e18562e3b716bdea53e9dabaf5524509c382910457aa911a84f');
  assert.equal(soilPacket.fields.length, 153);
  assert.equal(soilPacket.fields.filter((f: any) => f.changed).length, 77);
  const source = COURSE_MODULES.find(m => m.id === 'soil-health')!;
  for (const language of ['st', 've', 'ts'] as const) {
    const draft = liveSoil[language];
    const rewind = structuredClone(draft);
    for (const field of soilPacket.fields.filter((f: any) => f.language === language)) {
      const index = draft.lessons.findIndex(l => l.id === field.lessonId);
      const native = fieldAt(draft.lessons[index], field.fieldPath);
      const canonicalPath = field.fieldPath.replace(/\.question$/, '.q');
      assert.equal(fieldAt(source.lessons[index], canonicalPath), field.sourceEnglish);
      assert.equal(native.sourceEnglish, field.sourceEnglish);
      assert.equal(native[targetKeys[language]], field.proposedTarget);
      assert.equal(native.reviewStatus, field.reviewStatusProposed);
      assert.deepEqual(native[targetKeys[language]].match(/\d+(?:[.,]\d+)?/g) ?? [], field.sourceEnglish.match(/\d+(?:[.,]\d+)?/g) ?? [], 'source quantities remain exact');
      for (const species of ['oats', 'lupins', 'sunn hemp', 'cowpea', 'wattle']) {
        if (field.sourceEnglish.includes(species)) assert.ok(native[targetKeys[language]].includes(species), `retain canonical species: ${species}`);
      }
      const shown = liveResolve(source.lessons[index], language);
      assert.equal(shown.status, 'draft');
      assert.equal(fieldAt(shown.content, canonicalPath), field.proposedTarget);
      const changedSource = structuredClone(source.lessons[index]);
      const parts = canonicalPath.replaceAll('[', '.').replaceAll(']', '').split('.');
      const last = parts.pop()!;
      const parent: any = parts.reduce((v: any, k: string) => v[k], changedSource);
      parent[last] += ' Source changed.';
      assert.equal(liveResolve(changedSource, language).status, 'english-fallback', `${language}/${field.lessonId}/${canonicalPath}: source drift withdraws draft`);
      const oldPair = fieldAt(rewind.lessons[index], field.fieldPath);
      oldPair[targetKeys[language]] = field.currentTarget;
      oldPair.reviewStatus = field.reviewStatus;
    }
    assert.deepEqual(rewind, soilBefore[language], `${language}: titles, holds, metadata, all unlisted pairs and answer indices stay unchanged`);
  }
});

test('Soil repaired diagnostic and sanitation clauses retain their independent checked scope', () => {
  const st = liveST.lessons, ts = liveTS.lessons, ve = liveVE.lessons;
  assert.match(st[0].body.sesothoDraft.split('\n\n')[7], /layers tse lutseng fatshe/);
  assert.match(ve[0].body.tshivendaDraft.split('\n\n')[7], /layers dze dza dzula fhasi/);
  assert.match(ts[0].body.xitsongaDraft.split('\n\n')[7], /settled layers/);
  assert.match(st[0].body.sesothoDraft.split('\n\n')[11], /drainage.*kholo ea limela.*pele/);
  assert.match(st[0].quiz[1].rationale.sesothoDraft, /ha di tiise sesosa sa bothata/);
  assert.match(st[1].keyPoints[2].sesothoDraft, /seed pods.*contaminated materials.*kantle/);
  assert.match(st[2].keyPoints[1].sesothoDraft, /hole le trunks le stems/);
  assert.match(st[2].quiz[0].options[0].sesothoDraft, /waterlogging.*puleng/);
  assert.match(ve[0].quiz[1].options[1].tshivendaDraft, /ni songo ṱola/);
  assert.match(ve[1].quiz[0].options[1].tshivendaDraft, /dry carbon material yo engedzeaho/);
  assert.match(ve[2].quiz[1].options[1].tshivendaDraft, /harmful organisms.*zwithu zwi re na khombo.*a si safety guarantee/);
  assert.match(ts[0].quiz[1].question.xitsongaDraft, /goza/);
  assert.doesNotMatch(JSON.stringify(liveTS), /\bmohato\b/i, 'Sesotho step wording must not pollute the Xitsonga draft');
  const warning = ts[2].body.xitsongaDraft.split('\n\n')[8];
  const safe = (text: string) => /harmful organisms kumbe substances leswi nga ni khombo\. U nga yi tirhisi eka edible plants\. U nga ehleketi leswaku dilution yi endla leswaku yi hlayiseka\./.test(text);
  assert.ok(safe(warning));
  assert.equal(safe(warning.replace('U nga yi tirhisi', 'Yi tirhisi')), false, 'removing the edible-plant prohibition must fail the safety check');
  assert.equal(safe(warning.replace('U nga ehleketi', 'Ehleketi')), false, 'removing the dilution prohibition must fail the safety check');
  assert.match(ts[2].quiz[1].options[1].xitsongaDraft, /harmful organisms kumbe substances leswi nga ni khombo; dilution a hi safety guarantee/);
});

test('Soil decomposition clauses retain exact English process and completed-state anchors after the four-flag audit', () => {
  const st0 = liveST.lessons[0].body.sesothoDraft.split('\n\n')[0];
  const stCompost = liveST.lessons[1].body.sesothoDraft.split('\n\n')[0];
  const ve0 = liveVE.lessons[0].body.tshivendaDraft.split('\n\n')[0];
  const ts0 = liveTS.lessons[0].body.xitsongaDraft.split('\n\n')[0];
  assert.match(st0, /di thusa ho break down organic matter/);
  assert.doesNotMatch(st0, /qhaqha/);
  assert.match(stCompost, /organic matter e broken down ka tsela e laolwang/);
  assert.doesNotMatch(stCompost, /qhaqhollwang/);
  assert.match(ve0, /dzi thusa u break down organic matter/);
  assert.doesNotMatch(ve0, /kwashekanya/);
  assert.match(ts0, /swi pfuna ku break down organic matter/);
  assert.doesNotMatch(ts0, /fayelela/);
});

import { checkSouthAfricanSesotho } from './regional-full-draft-checks.ts';
test('Soil natural worm-bin liquid keeps its meaning while using South African Sesotho spelling', () => {
  const english = liveST.lessons[2].body.sourceEnglish.split('\n\n')[7];
  const shown = liveST.lessons[2].body.sesothoDraft.split('\n\n')[7];
  assert.ok(shown.startsWith('Mokedikedi o itshollang ka tlhaho'));
  assert.doesNotMatch(shown, /Mokelikeli/);
  assert.match(shown, /worm bin.*leachate.*Ha o tshwane le worm-casting tea/);
  checkSouthAfricanSesotho([[english, shown]], 'Soil ST L3 paragraph 7');
  assert.throws(() => checkSouthAfricanSesotho([[english, shown.replace('Mokedikedi', 'Mokelikeli')]], 'bad spelling'), /Lesotho/);
});
