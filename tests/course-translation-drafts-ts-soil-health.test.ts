import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const sourceModule = COURSE_MODULES.find(module => module.id === 'soil-health')!;
const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'soil-health-l1')!;
const expectedL1Paragraphs = [
  'Misava yi na tinxaka to tala ta swilo leswi hanyaka. Bacteria na fungi swi pfuna ku fayelela organic matter ni ku cycle nutrients.',
  "Fungi tin'wana ti pfuna timitsu ku tswonga nutrients. Worm channels ti nga pfuna mati na moya ku nghena emhlabeni.",
  'Languta timitsu, xivumbeko xa misava ni ndlela leyi mati ma fambaka ha yona, swin’we ni leswi hanyaka emisaveni leswi u swi vonaka.',
  'Chela misava na mati eka clear jar, u chela nyana suitable dispersing detergent. Pfala jar u yi ninginika, kutani u yi tshika yi nga ninginiki.',
  'Sand yi sungula ku tshamisa ehansi. Silt yi tshamisa endzhaku ka yona, kasi clay yi nga ha sala yi suspended much longer.',
  'Lowu i rough learning exercise. Clumps na clay leyi nga si tshamaka ehansi swi nga ku hambukisa; tirhisa soil laboratory loko ku laveka accurate soil texture.',
  'Thick sand layer ehansi ka cloudy water a yi si komba final proportions. Fine particles tin’wana ti nga ha va suspended.',
  "Fananisa swiyenge leswi tshamaka ehansi, kutani u twa misava ensin'wini.",
  'Tsala leswi u swi vonaka ni leswi nga si tiyiseka. U nga teki xiboho xa ku cheleta kumbe ku tirhisa ndlela yo lulamisa misava hi ku ya hi jar yin’we ntsena.',
  'Compaction, poor drainage na ku lahleka ka organic matter can limit timitsu ni soil life.',
  'Muhlovo lowu nga vonakaka wa pale kumbe few worms a swi tiyisisi leswaku chemicals ti dlayile misava. Worm activity na yona ya cinca hi ku ya hi moisture na season.',
  "Languta patterns leti humelelaka ensin'wini hinkwaro. Kambela management history, drainage ni ku kula ka swimilani u nga si hlawula remedy.",
];

test('Soil Health L1 keeps all twelve source paragraphs paired while filling the reviewed body gaps', () => {
  const draft = XITSONGA_SOIL_HEALTH_DRAFT.lessons[0];
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.id, sourceModule.id);
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.language, 'ts');
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.reviewStatus, 'machine-draft');
  assert.equal(draft.id, sourceLesson.id);
  assert.equal(draft.title.sourceEnglish, sourceLesson.title);
  assert.equal(draft.title.xitsongaDraft, sourceLesson.title);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.infographicAlt?.sourceEnglish, sourceLesson.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, sourceLesson.infographicAlt);
  assert.equal(draft.body.sourceEnglish, sourceLesson.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');

  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const candidateParagraphs = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(candidateParagraphs.length, sourceParagraphs.length);
  assert.deepEqual(candidateParagraphs, expectedL1Paragraphs);
  assert.equal(candidateParagraphs[0].split('. ')[0], 'Misava yi na tinxaka to tala ta swilo leswi hanyaka',
    'paragraph 1 keeps its already translated first sentence verbatim');
  assert.deepEqual(candidateParagraphs.slice(1, 3), expectedL1Paragraphs.slice(1, 3),
    'paragraphs 2 and 3 remain the existing translated text');
  assert.deepEqual(candidateParagraphs.slice(7, 9), expectedL1Paragraphs.slice(7, 9),
    'paragraphs 8 and 9 remain the existing translated text');
  for (const index of [0, 3, 4, 5, 6, 9, 10, 11]) {
    assert.notEqual(candidateParagraphs[index], sourceParagraphs[index],
      `paragraph ${index + 1}: the checked candidate is surfaced instead of exact-English fallback`);
  }
  assert.match(candidateParagraphs[3], /clear jar.*nyana suitable dispersing detergent.*Pfala jar.*ninginika.*nga ninginiki/);
  assert.match(candidateParagraphs[4], /Sand yi sungula.*tshamisa ehansi/);
  assert.match(candidateParagraphs[4], /Silt.*endzhaku.*clay.*suspended much longer/);
  assert.match(candidateParagraphs[5], /rough learning exercise.*Clumps.*swi nga ku hambukisa.*soil laboratory loko ku laveka accurate soil texture/);
  assert.match(candidateParagraphs[6], /Thick sand layer.*cloudy water.*a yi si.*final proportions.*Fine particles.*suspended/);
  assert.match(candidateParagraphs[9], /Compaction, poor drainage.*organic matter can limit.*timitsu.*soil life/);
  assert.match(candidateParagraphs[10], /few worms.*a swi tiyisisi.*chemicals.*Worm activity.*moisture.*season/);
  assert.match(candidateParagraphs[11], /patterns.*management history, drainage.*ku kula ka swimilani.*u nga si.*remedy/);

  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
});

test('Soil Health L1 Xitsonga assessments preserve diagnostic limits and answer indexes', () => {
  const source = sourceModule.lessons[0];
  const draft = XITSONGA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft);
  assert.equal(draft.title.reviewStatus, 'hold');
  assert.equal(draft.infographicAlt?.reviewStatus, 'hold');
  assert.equal(draft.body.sourceEnglish, source.body, 'assessment wiring leaves the existing body pairing intact');
  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.deepEqual(draft.keyPoints.map(point => point.reviewStatus), Array(4).fill('machine-draft'));
  assert.match(draft.keyPoints[0].xitsongaDraft, /swikombiso swo hlayanyana/,
    'several clues remains a quantity, not just a difference between clues');
  assert.match(draft.keyPoints[1].xitsongaDraft, /worm[s]? ntsena.*a swi diagnose cause/,
    'soil colour and worm counts alone are not made diagnostic');
  assert.match(draft.keyPoints[2].xitsongaDraft, /rough indication.*a hi complete soil test/,
    'the jar remains approximate rather than a complete test');
  assert.match(draft.keyPoints[3].xitsongaDraft, /drainage, timitsu na management history.*u nga si.*remedy/,
    'all three checks remain before choosing a remedy');

  assert.equal(draft.quiz.length, source.quiz.length);
  for (const [index, item] of draft.quiz.entries()) {
    const original = source.quiz[index]!;
    assert.equal(item.question.sourceEnglish, original.q);
    assert.equal(item.question.reviewStatus, 'machine-draft');
    assert.deepEqual(item.options.map(option => option.sourceEnglish), original.options);
    assert.ok(item.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(item.sourceCorrectIndex, original.correct);
    assert.equal(item.options[item.sourceCorrectIndex]?.sourceEnglish, original.options[original.correct]);
    assert.equal(item.rationale.sourceEnglish, original.rationale);
    assert.equal(item.rationale.reviewStatus, 'machine-draft');
  }
  assert.equal(draft.quiz[0].sourceCorrectIndex, 1);
  assert.match(draft.quiz[0].question.xitsongaDraft, /cloudy water ehenhla ka sand layer/);
  assert.match(draft.quiz[0].options[0].xitsongaDraft, /less water/, 'the comparative remains explicit');
  assert.match(draft.quiz[0].options[1].xitsongaDraft, /Fine particles.*nga ha va suspended.*ku languta nakambe/);
  assert.match(draft.quiz[0].rationale.xitsongaDraft, /nga va na fine particles leti nga se tshamaka ehansi.*Observation yin'we ya le masungulweni.*a yi koti ku tiyisisa final proportions kumbe right treatment/,
    'possibility, an early observation and both limits remain in the rationale');
  assert.equal(draft.quiz[1].sourceCorrectIndex, 2);
  assert.match(draft.quiz[1].options[2].xitsongaDraft, /drainage, timitsu, moisture ni management history/);
  assert.match(draft.quiz[1].rationale.xitsongaDraft, /Worm activity yi cinca hi conditions.*worms ti nga ri tingani ntsena a ti kombisi cause/,
    'worm activity varies, and few worms alone do not establish cause');

  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.xitsongaDraft));
  assert.deepEqual(shown.content.quiz, source.quiz.map((item, index) => ({
    q: draft.quiz[index].question.xitsongaDraft,
    options: draft.quiz[index].options.map(option => option.xitsongaDraft),
    correct: item.correct,
    rationale: draft.quiz[index].rationale.xitsongaDraft,
  })));
  const changedSource = {
    ...source,
    quiz: source.quiz.map((item, index) => index === 0
      ? { ...item, rationale: item.rationale.replace('final proportions', 'soil condition') }
      : item),
  };
  assert.equal(resolveLearnerLessonPresentation(changedSource, 'ts').status, 'english-fallback',
    'a changed diagnostic caveat withdraws the stale paired assessment');
});

test('Soil Health L1 retains difficult jar and diagnostic terms in the checked mixed-language draft', () => {
  const paragraphs = XITSONGA_SOIL_HEALTH_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n');
  assert.match(paragraphs[0], /Bacteria na fungi.*organic matter.*cycle nutrients/);
  assert.match(paragraphs[1], /Fungi tin'wana.*nutrients/);
  assert.match(paragraphs[1], /Worm channels/);
  assert.equal(paragraphs[0].startsWith('Soil contains many kinds of living organisms.'), false);
  assert.ok(XITSONGA_SOIL_HEALTH_DRAFT.holds.every(item => item.lessonId !== 'soil-health-l1' || !item.field.startsWith('body[')),
    'a completed mixed-language body must not leave superseded exact-English paragraph holds');
  assert.match(paragraphs[3], /clear jar.*suitable dispersing detergent/);
  assert.match(paragraphs[5], /rough learning exercise.*soil laboratory/);
  assert.match(paragraphs[6], /cloudy water.*final proportions/);
  assert.match(paragraphs[9], /Compaction, poor drainage.*organic matter/);
  assert.match(paragraphs[10], /few worms.*chemicals.*moisture.*season/);
  assert.match(paragraphs[11], /management history, drainage.*remedy/);
});

test('Soil Health L2/L3 expose source-paired lesson and assessment drafts with safe fallback', () => {
  const l2 = sourceModule.lessons[1];
  const l2Matches = XITSONGA_SOIL_HEALTH_DRAFT.lessons.filter(lesson => lesson.id === l2.id);
  assert.equal(l2Matches.length, 1, 'the source lesson must have exactly one registry entry');
  const l2Draft = l2Matches[0];
  assert.ok(l2Draft, 'the completed Xitsonga L2 draft must be present');
  assert.equal(l2Draft.title.sourceEnglish, l2.title);
  assert.equal(l2Draft.title.xitsongaDraft, 'Ku Endla ni Ku Tirhisa Compost');
  assert.equal(l2Draft.title.reviewStatus, 'machine-draft');
  assert.equal(l2Draft.infographicAlt?.sourceEnglish, l2.infographicAlt);
  assert.equal(l2Draft.infographicAlt?.xitsongaDraft, 'Heap ya compost cut open, yi komba alternating layers ta dry brown material na fresh green material; ku hisa ku tlakuka ku suka exikarhini, naswona arrow yi komba leswaku heap ya hundzuluxiwa.');
  assert.equal(l2Draft.infographicAlt?.reviewStatus, 'machine-draft');
  assert.equal(l2Draft.body.sourceEnglish, l2.body);
  assert.equal(l2Draft.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = l2.body.split('\n\n');
  const paragraphs = l2Draft.body.xitsongaDraft.split('\n\n');
  assert.equal(sourceParagraphs.length, 12);
  assert.equal(paragraphs.length, sourceParagraphs.length);
  for (const [index, sourceParagraph] of sourceParagraphs.entries()) {
    assert.notEqual(paragraphs[index], sourceParagraph,
      `paragraph ${index + 1} must not remain an obsolete whole-paragraph English hold`);
  }
  assert.match(paragraphs[0], /Compost i organic matter.*broken down.*managed conditions/,
    'paragraph 1 preserves broken-down state and managed conditions');
  assert.match(paragraphs[1], /Finished compost yi nga antswisa.*xivumbeko xa misava.*contribute nutrients/,
    'finished compost can improve soil structure and contribute nutrients');
  assert.match(paragraphs[2], /materials, moisture, air na temperature.*province.*nhlayo leyi vekiweke ya mavhiki.*a hi readiness test/,
    'readiness varies with all four factors and neither province nor fixed weeks is a test');
  assert.match(paragraphs[3], /dry browns.*fresh greens.*thick, wet layers.*sivelaka air ku nghena/,
    'the mixing categories and thick wet layer air-blocking warning remain intact');
  assert.match(paragraphs[4], /Loko heap yi va slimy kumbe.*ammonia swinene.*dry browns.*turn/,
    'either sliminess or a strong ammonia smell conditionally calls for dry browns and turning');
  assert.match(paragraphs[5], /moisture na air.*heap yi ri karhi yi cinca.*recipe.*nkatsakanyo wun'wana ni wun'wana wa materials/,
    'moisture and air are checked as the heap changes; a single recipe is not universal');
  assert.match(paragraphs[6], /Hot centre.*a yi tiyisisi.*every part.*treated.*Time, temperature and management all matter/,
    'a hot centre is not proof every part was treated, and the three factors remain');
  assert.match(paragraphs[7], /meat, dairy, diseased plants, pet waste na contaminated materials.*simple household system/,
    'all five prohibited inputs remain out of the simple household system');
  assert.match(paragraphs[8], /U nga teki.*home composting.*weed seed yin'wana ni yin'wana.*disease organism yin'wana ni yin'wana.*recognised process.*sanitation yi lavekaka/,
    'the no-assumption warning covers every weed seed and disease organism, with sanitation conditional');
  assert.match(paragraphs[9], /wattle seed pods.*compost heap.*may not make every seed non-viable/,
    'wattle pods stay excluded and may-not/every-seed viability scope remains');
  assert.match(paragraphs[10], /clean, untreated materials ntsena.*Bark breaks down slowly.*vito ra yona ntsena.*contamination/,
    'clean and untreated is mandatory; slow bark and the name-alone caveat remain');
  assert.match(paragraphs[11], /turn.*loko yi lava air yo tala kumbe mixing.*moist.*waterlogged/,
    'turning is conditional on more air or mixing, and moist is not waterlogged');
  assert.deepEqual(l2Draft.keyPoints.map(item => item.sourceEnglish), l2.keyPoints);
  assert.ok(l2Draft.keyPoints.every(item => item.reviewStatus === 'machine-draft'));
  assert.match(l2Draft.keyPoints[0].xitsongaDraft, /^Ringanisa browns, greens, moisture ni air\./);
  assert.match(l2Draft.keyPoints[1].xitsongaDraft, /Hot centre a yi tiyisisi leswaku heap hinkwaro ri sanitised/);
  assert.match(l2Draft.keyPoints[2].xitsongaDraft, /seed pods na contaminated materials.*handle ka heap/);
  assert.match(l2Draft.keyPoints[3].xitsongaDraft, /xiyimo xa yona.*ku nga ri hi fixed regional timetable/);
  assert.equal(l2Draft.quiz.length, l2.quiz.length);
  l2Draft.quiz.forEach((item, index) => {
    const original = l2.quiz[index]!;
    assert.equal(item.question.sourceEnglish, original.q);
    assert.equal(item.question.reviewStatus, 'machine-draft');
    assert.deepEqual(item.options.map(option => option.sourceEnglish), original.options);
    assert.ok(item.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(item.sourceCorrectIndex, original.correct);
    assert.equal(item.options[item.sourceCorrectIndex]?.sourceEnglish, original.options[original.correct]);
    assert.equal(item.rationale.sourceEnglish, original.rationale);
    assert.equal(item.rationale.reviewStatus, 'machine-draft');
  });
  assert.deepEqual(l2Draft.quiz.map(item => item.sourceCorrectIndex), l2.quiz.map(item => item.correct));
  assert.match(l2Draft.quiz[0].options[1].xitsongaDraft, /Engetela more dry carbon material yo fana na straw.*hundzuluxa heap/);
  assert.match(l2Draft.quiz[0].rationale.xitsongaDraft, /nga lava more air na drier material.*dry browns.*hundzuluxa heap.*ammonia na wona wu nga suggest.*nitrogen-rich material yo tala ngopfu.*damp, ku nga ri soggy/,
    'the wet/slimy fix remains qualified, ammonia can also suggest excess nitrogen, and damp-not-soggy stays explicit');
  assert.match(l2Draft.quiz[1].rationale.xitsongaDraft, /^An ordinary heap may not expose every seed to conditions that make it non-viable\./);
  assert.match(l2Draft.quiz[1].options[1].xitsongaDraft, /Mbewu tin'wana ti nga ha pona kutani ti hangalaka/,
    'some seeds may survive and spread remains possible rather than certain');
  assert.match(l2Draft.quiz[1].rationale.xitsongaDraft, /Ku susa pods swi papalata ku ti hangalasa na compost/,
    'wattle seed pods are excluded to avoid spreading them with compost');
  const shownL2 = resolveLearnerLessonPresentation(l2, 'ts');
  assert.equal(shownL2.status, 'draft');
  assert.equal(shownL2.content.body, l2Draft.body.xitsongaDraft);
  assert.deepEqual(shownL2.content.title, l2Draft.title.xitsongaDraft);
  assert.deepEqual(shownL2.content.keyPoints, l2Draft.keyPoints.map(item => item.xitsongaDraft));
  assert.deepEqual(shownL2.content.quiz, l2.quiz.map((item, index) => ({
    q: l2Draft.quiz[index].question.xitsongaDraft,
    options: l2Draft.quiz[index].options.map(option => option.xitsongaDraft),
    correct: item.correct,
    rationale: l2Draft.quiz[index].rationale.xitsongaDraft,
  })));
  const changedL2 = { ...l2, body: l2.body.replace('may not make every seed non-viable', 'may not make any seed non-viable') };
  assert.equal(resolveLearnerLessonPresentation(changedL2, 'ts').status, 'english-fallback',
    'changing the seed-viability caveat withdraws the whole source-paired body draft');
  const changedL2Assessment = {
    ...l2,
    quiz: l2.quiz.map((item, index) => index === 1
      ? { ...item, rationale: item.rationale.replace('may not expose every seed', 'does not expose any seed') }
      : item),
  };
  assert.equal(resolveLearnerLessonPresentation(changedL2Assessment, 'ts').status, 'english-fallback',
    'source drift in the seed-survival caveat withdraws the stale assessment draft');

  const source = sourceModule.lessons[2];
  const l3Matches = XITSONGA_SOIL_HEALTH_DRAFT.lessons.filter(lesson => lesson.id === source.id);
  assert.equal(l3Matches.length, 1, 'the L3 source lesson must have exactly one registry entry');
  const draft = l3Matches[0];
  assert.ok(draft, 'the paired L3 draft must be present in the existing three-lesson module');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.title.xitsongaDraft, 'Ku Tirhisa Mulch na Cover Crops: Ku Sirhelela Misava na Building Soil');
  assert.equal(draft.title.reviewStatus, 'machine-draft');
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.equal(draft.infographicAlt?.xitsongaDraft, 'Swiphemu swimbirhi swa misava ehansi ka dyambu rin\'we: misava leyi nga funengetiwangi yi pandzekile naswona yi omile; misava leyi nga na mulch ya ha ri ya ntima naswona yi tsakamile.');
  assert.equal(draft.infographicAlt?.reviewStatus, 'machine-draft');
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const english = source.body.split('\n\n');
  const localized = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(localized.length, english.length);
  assert.deepEqual(localized.slice(0, 9).map((paragraph, index) => paragraph === english[index]), Array(9).fill(false),
    'the ten previously held body paragraphs now use source-paired mixed-language drafts');
  assert.match(localized[0], /Funengetani misava.*mulch leyi basekile.*straw.*byanyi byo oma.*wood chips/);
  assert.match(localized[1], /yi nga hunguta evaporation.*yi nga olovisa.*mpfula.*yi nga suppress weeds/,
    'mulch benefits remain possible effects, not guarantees');
  assert.match(localized[2], /^Keep it clear of trunks and stems\./);
  assert.match(localized[2], /moisture.*lulamisa layer.*mulch yo tala a yi vuli/);
  assert.match(localized[3], /between main crops.*weather ya laha.*mati lama kumekaka.*next planting/);
  assert.match(localized[4], /oats, lupins, sunn hemp na cowpea.*mi nga si swi byala/);
  assert.match(localized[5], /Legumes.*bacteria leti faneleke.*suitable growing conditions.*fix nitrogen.*masalela.*material.*yi bola/);
  assert.match(localized[6], /Worm farms.*food scraps.*bedding.*castings.*Kambelani bin.*fixed harvest date/);
  assert.match(localized[7], /^Liquid that drains naturally from a worm bin.*leachate.*prepared worm-casting tea/);
  assert.match(localized[8], /yi nga va na harmful organisms kumbe substances.*Do not use it on edible plants or assume that dilution makes it safe/);
  assert.deepEqual(localized.slice(9, 12), [
    'Nsimu ya Highveld leyi tshikiweke yi nga funengetiwangi endzhaku ka ntshovelo wa maize yi langutana ni makhombo mambirhi lamakulu.',
    'Mheho wa xixika wu nga susa misava ya le henhla leyi omeke.',
    'Xidzedze xo sungula xo tika xa ximun’wana xi nga hlasela misava leyi nga funengetiwangi, xi onha vuandlalo ni xivumbeko xa yona. Loko mati ma khuluka ehenhla ka nsimu, ma nga teka misava leyi ntshunxekeke ma famba na yona.',
  ]);
  assert.match(localized[12], /Cover crops, mulch ni organic matter.*swi nga pfuna ku khoma misava.*yi ya mahlweni yi hanya/);
  assert.ok(XITSONGA_SOIL_HEALTH_DRAFT.holds.every(item => item.lessonId !== 'soil-health-l3' || !item.field.startsWith('body[')),
    'all L3 body paragraphs are now source-paired drafts, so superseded body holds must be removed');

  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.title, draft.title.xitsongaDraft);
  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.ok(draft.keyPoints.every(point => point.reviewStatus === 'machine-draft'));
  assert.match(draft.keyPoints[3].xitsongaDraft, /^Worm-bin leachate is not automatically safe fertiliser;/,
    'the no-automatic-safety claim stays exact while the edible-plant instruction is translated');
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    assert.equal(question.question.sourceEnglish, source.quiz[index].q);
    assert.equal(question.question.reviewStatus, 'machine-draft');
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.quiz[index].options);
    assert.ok(question.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(question.sourceCorrectIndex, source.quiz[index].correct);
    assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
    assert.equal(question.rationale.reviewStatus, 'machine-draft');
  });
  assert.deepEqual(draft.quiz.map(question => question.sourceCorrectIndex), [2, 1]);
  assert.match(draft.quiz[0].question.xitsongaDraft, /maize hi April.*all winter/);
  assert.match(draft.quiz[0].options[0].xitsongaDraft, /waterlogging from rain/,
    'retain the technical waterlogging condition rather than broadening it to too much water');
  assert.match(draft.quiz[0].options[1].xitsongaDraft, /Frost kills soil life.*weeds take over early/);
  assert.match(draft.quiz[0].rationale.xitsongaDraft, /lowu nga susaka dry topsoil.*ku nga onha surface; laha mati ma khulukaka.*ma nga teka misava leyi ntshunxekeke/,
    'wind and raindrop effects remain possible, with runoff loss conditional on water over the field');
  assert.match(draft.quiz[1].question.xitsongaDraft, /liquid draining from a worm bin/);
  assert.match(draft.quiz[1].options[1].xitsongaDraft, /nga va na harmful organisms kumbe substances; dilution a hi safety guarantee/);
  assert.match(draft.quiz[1].rationale.xitsongaDraft, /^Leachate i liquid that drains naturally from a worm bin\. Composition ya yona ya hambana/);
  assert.match(draft.quiz[1].rationale.xitsongaDraft, /a yi fanelanga ku kombisiwa yi ri feed leyi tiyisekisiweke leswaku yi hlayisekile eka edible crops/,
    'natural drainage, variable composition and no edible-crop safety guarantee remain explicit');
  assert.deepEqual(shown.content.keyPoints, draft.keyPoints.map(point => point.xitsongaDraft));
  assert.deepEqual(shown.content.quiz, source.quiz.map((item, index) => ({
    q: draft.quiz[index].question.xitsongaDraft,
    options: draft.quiz[index].options.map(option => option.xitsongaDraft),
    correct: item.correct,
    rationale: draft.quiz[index].rationale.xitsongaDraft,
  })));
  const changedSource = { ...source, body: source.body.replace('Do not use it on edible plants', 'Use it on edible plants') };
  const changedShown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(changedShown.status, 'english-fallback');
  assert.equal(changedShown.content.body, changedSource.body);
  const changedLeachateSource = {
    ...source,
    quiz: source.quiz.map((item, index) => index === 1
      ? { ...item, rationale: item.rationale.replace('composition varies', 'composition is constant') }
      : item),
  };
  assert.equal(resolveLearnerLessonPresentation(changedLeachateSource, 'ts').status, 'english-fallback',
    'source drift in the variable-composition warning withdraws the stale assessment draft');
});

test('Soil Health source drift falls back to exact English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);
});
