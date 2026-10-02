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

  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), sourceLesson.keyPoints);
  assert.deepEqual(draft.keyPoints.map(point => point.xitsongaDraft), sourceLesson.keyPoints);
  assert.ok(draft.keyPoints.every(point => point.reviewStatus === 'hold'));
  assert.equal(draft.quiz.length, sourceLesson.quiz.length);
  for (const [index, question] of draft.quiz.entries()) {
    const source = sourceLesson.quiz[index];
    assert.equal(question.question.sourceEnglish, source.q);
    assert.equal(question.question.xitsongaDraft, source.q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.options);
    assert.deepEqual(question.options.map(option => option.xitsongaDraft), source.options);
    assert.equal(question.sourceCorrectIndex, source.correct);
    assert.equal(question.rationale.sourceEnglish, source.rationale);
    assert.equal(question.rationale.xitsongaDraft, source.rationale);
    assert.ok(question.options.every(option => option.reviewStatus === 'hold'));
  }

  const shown = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, sourceLesson.keyPoints);
  assert.deepEqual(shown.content.quiz, sourceLesson.quiz);
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

test('Soil Health L2 stays English while L3 exposes only the screened seasonal risk draft', () => {
  const l2 = sourceModule.lessons[1];
  const l2Shown = resolveLearnerLessonPresentation(l2, 'ts');
  assert.equal(l2Shown.status, 'english-fallback');
  assert.equal(l2Shown.content.body, l2.body);

  const source = sourceModule.lessons[2];
  const draft = XITSONGA_SOIL_HEALTH_DRAFT.lessons.find(lesson => lesson.id === source.id);
  assert.ok(draft, 'the paired L3 draft must be present without adding L2');
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.infographicAlt?.sourceEnglish, source.infographicAlt);
  assert.equal(draft.body.sourceEnglish, source.body);
  assert.equal(draft.body.reviewStatus, 'machine-draft');
  const english = source.body.split('\n\n');
  const localized = draft.body.xitsongaDraft.split('\n\n');
  assert.equal(localized.length, english.length);
  assert.deepEqual(localized.slice(0, 9), english.slice(0, 9));
  assert.deepEqual(localized.slice(9, 12), [
    'Nsimu ya Highveld leyi tshikiweke yi nga funengetiwangi endzhaku ka ntshovelo wa maize yi langutana ni makhombo mambirhi lamakulu.',
    'Mheho wa xixika wu nga susa misava ya le henhla leyi omeke.',
    'Xidzedze xo sungula xo tika xa ximun’wana xi nga hlasela misava leyi nga funengetiwangi, xi onha vuandlalo ni xivumbeko xa yona. Loko mati ma khuluka ehenhla ka nsimu, ma nga teka misava leyi ntshunxekeke ma famba na yona.',
  ]);
  assert.equal(localized[12], english[12]);

  const shown = resolveLearnerLessonPresentation(source, 'ts');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.body, draft.body.xitsongaDraft);
  assert.deepEqual(shown.content.keyPoints, source.keyPoints);
  assert.deepEqual(shown.content.quiz.map(question => question.correct), source.quiz.map(question => question.correct));
  assert.equal(draft.keyPoints.length, source.keyPoints.length);
  assert.deepEqual(draft.keyPoints.map(point => point.sourceEnglish), source.keyPoints);
  assert.equal(draft.quiz.length, source.quiz.length);
  draft.quiz.forEach((question, index) => {
    assert.equal(question.question.sourceEnglish, source.quiz[index].q);
    assert.deepEqual(question.options.map(option => option.sourceEnglish), source.quiz[index].options);
    assert.equal(question.sourceCorrectIndex, source.quiz[index].correct);
    assert.equal(question.rationale.sourceEnglish, source.quiz[index].rationale);
  });
  const changedSource = { ...source, body: source.body.replace('Winter wind', 'Cold wind') };
  const changedShown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(changedShown.status, 'english-fallback');
  assert.equal(changedShown.content.body, changedSource.body);
});

test('Soil Health source drift falls back to exact English', () => {
  const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body}\nChanged.` };
  const shown = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(shown.status, 'english-fallback');
  assert.equal(shown.content.body, changedSource.body);
});
