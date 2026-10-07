import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import {
  XITSONGA_INTRO_PERMACULTURE_DRAFT as currentIntroDraft,
  XITSONGA_READING_LANDSCAPE_DRAFT as readingDraft,
} from '../lib/course-translation-drafts-ts.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { resolveLearnerLessonPresentation as resolveCurrentPresentation } from '../lib/course-localization.ts';
import { validateAndRewindIntroNativeHistory, introPresentationBeforeSilentRelease } from './intro-silent-release-text-checks.ts';
// Historical clauses are exposed only after both accepted source-bound Intro text layers validate.
const draft = validateAndRewindIntroNativeHistory('ts', currentIntroDraft) as typeof currentIntroDraft;
const resolveLearnerLessonPresentation: typeof resolveCurrentPresentation = (lesson, language) =>
  introPresentationBeforeSilentRelease(lesson, language, resolveCurrentPresentation(lesson, language));

const source = COURSE_MODULES.find(module => module.id === 'intro-permaculture')!;
const digits = (value: string) => value.match(/\d+/g) ?? [];

test('the Xitsonga draft preserves all Introduction source pairs and quiz answer indexes', () => {
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.language, 'ts');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.equal(draft.lessons.length, 3);

  for (const [index, lesson] of draft.lessons.entries()) {
    const original = source.lessons[index];
    assert.ok(original);
    assert.equal(lesson.id, original.id);
    assert.equal(lesson.title.sourceEnglish, original.title);
    assert.equal(lesson.infographicAlt?.sourceEnglish, original.infographicAlt);
    assert.equal(lesson.body.sourceEnglish, original.body);
    assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), original.keyPoints);
    assert.equal(lesson.quiz.length, original.quiz.length);

    for (const [quizIndex, item] of lesson.quiz.entries()) {
      const sourceItem = original.quiz[quizIndex];
      assert.equal(item.question.sourceEnglish, sourceItem.q);
      assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceItem.options);
      assert.equal(item.rationale.sourceEnglish, sourceItem.rationale);
      assert.equal(item.sourceCorrectIndex, sourceItem.correct, `${lesson.id} quiz ${quizIndex} answer index changed`);
    }
  }
});

test('held Xitsonga anchors remain exact while mixed fields stay machine drafts', () => {
  // Hold records remain exact metadata; the later question row translates two
  // recorded phrases, while its unresolved ethic term stays visible in English.
  validateAndRewindIntroNativeHistory('ts', currentIntroDraft);
  assert.deepEqual(currentIntroDraft.holds.map(hold => hold.sourceText), ['all his surplus maize', 'composting', 'ethic']);
  assert.ok(currentIntroDraft.holds.length > 0);
  const lessons = new Map(currentIntroDraft.lessons.map(lesson => [lesson.id, lesson]));

  for (const hold of currentIntroDraft.holds) {
    const lesson = lessons.get(hold.lessonId);
    assert.ok(lesson, `hold points to unknown lesson ${hold.lessonId}`);
    const match = hold.field.match(/^(body)|^keyPoints\[(\d+)\]$|^quiz\[(\d+)\](?:\.(q|rationale)|\.options\[(\d+)\])$/);
    assert.ok(match, `unsupported held field ${hold.field}`);
    const [, bodyField, keyPointIndex, quizIndex, part, optionIndexText] = match;
    let pair;
    if (bodyField) pair = lesson.body;
    if (keyPointIndex !== undefined) pair = lesson.keyPoints[Number(keyPointIndex)];
    if (quizIndex !== undefined) {
      const quiz = lesson.quiz[Number(quizIndex)];
      if (part === 'q') pair = quiz?.question;
      else if (part === 'rationale') pair = quiz?.rationale;
      else if (optionIndexText !== undefined) pair = quiz?.options[Number(optionIndexText)];
    }
    assert.ok(pair, `${hold.lessonId} ${hold.field} must resolve to a source pair`);
    assert.ok(pair.sourceEnglish.includes(hold.sourceText), `${hold.field} hold must belong to the exact source`);
    const translatedByLatestSourceBoundRow = hold.lessonId === 'intro-permaculture-l1' && hold.field === 'quiz[0].q' &&
      ['all his surplus maize', 'composting'].includes(hold.sourceText);
    if (!translatedByLatestSourceBoundRow) {
      assert.ok(pair.xitsongaDraft.includes(hold.sourceText), `${hold.field} must retain the exact held source phrase`);
    }
    if (pair.sourceEnglish === hold.sourceText) {
      assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} whole-field hold must remain exact English`);
      assert.equal(pair.reviewStatus, 'hold');
    } else {
      assert.equal(pair.reviewStatus, 'machine-draft', `${hold.field} mixed text must remain visibly unreviewed`);
    }
    assert.ok(hold.reason.length > 0);
  }
  const latestIntro = lessons.get('intro-permaculture-l1');
  assert.ok(latestIntro, 'the source-bound Introduction lesson must remain registered');
  const latestIntroQuestion = latestIntro.quiz[0].question.xitsongaDraft;
  assert.equal(latestIntroQuestion,
    'Murimi u xavisa mavele ya yena lama saleke hinkwawo, kambe a nga hlayisi na xin’we xa ku endla compost kumbe ku hlayisa mbewu. Hi yihi ethic leyi a tsandzekaka ngopfu ku yi landzelela?',
    'the later accepted full question translates the surplus-maize and composting clauses while retaining the exact ethic term');
});

test('Introduction Xitsonga alt text and L1 framing resolve as source-bound machine drafts', () => {
  const expectedAlt = new Map([
    ['intro-permaculture-l1', 'Mahanyelo lawa manharhu ma kombisiwa hi swirhendzevutana swinharhu leswi hlanganisiweke, leswi ringanaka hi vukulu: voko leri khomeke misava ra Ku Hlayisa Misava; vanhu vambirhi va Ku Hlayisa Vanhu; na baskiti leri hundziseriwaka hi mavoko ra Ku Avelana hi Ku Ringana.'],
    ['intro-permaculture-l2', 'Misinya ya milawu ya dizayini ya khume-mbirhi yi vekiwile hi swiphemu leswi rhendzeleke ximilana lexi nga exikarhini. Xiphemu xin’wana ni xin’wana xi kombisiwa hi xifaniso xo olova — tihlo ra ku xiyisisa, thonsi ra ku khoma mati, dyambu ra eneji, na xirhendzevutana lexi kombisaka ku vuyisa thyaka.'],
    ['intro-permaculture-l3', 'Xikombiso xa purasi lexi kombisiweke hi swifaniso: tinomboro ta 0 ku ya eka 5 ti landzelela ndlela yo famba hi milenge leyi jikajikaka ku suka endlwini ni le xirhapeni xa le kusuhi, ti hundza tihuku ni nsimu, ti ya eka mirhi ni a wilder riverside area. Tinomboro leti i swikombiso ntsena; a hi mindzilakano leyi tiyisiweke kumbe mipfhuka leyi tiyisiweke.'],
  ]);

  for (const [lessonId, expectedText] of expectedAlt) {
    const original = source.lessons.find(lesson => lesson.id === lessonId)!;
    const paired = draft.lessons.find(lesson => lesson.id === lessonId)!;
    assert.ok(original.infographicAlt, `${lessonId} canonical alt text must exist`);
    assert.deepEqual(paired.infographicAlt, {
      sourceEnglish: original.infographicAlt,
      xitsongaDraft: expectedText,
      reviewStatus: 'machine-draft',
    }, `${lessonId} alt pair must stay tied to its exact canonical description`);
    const presentation = resolveLearnerLessonPresentation(original, 'ts');
    assert.equal(presentation.status, 'draft');
    assert.equal(presentation.content.infographicAlt, expectedText,
      `${lessonId} should expose the unreviewed regional description with the learner draft`);

    const changedAlt = { ...original, infographicAlt: `${original.infographicAlt} Source changed.` };
    const fallback = resolveLearnerLessonPresentation(changedAlt, 'ts');
    assert.equal(fallback.status, 'english-fallback', `${lessonId} stale alt text must not survive source drift`);
    assert.equal(fallback.content.infographicAlt, changedAlt.infographicAlt);
  }

  const l1Source = source.lessons.find(lesson => lesson.id === 'intro-permaculture-l1')!;
  const l1 = draft.lessons.find(lesson => lesson.id === l1Source.id)!;
  assert.equal(l1.keyPoints[1].sourceEnglish, l1Source.keyPoints[1]);
  assert.equal(l1.keyPoints[1].reviewStatus, 'machine-draft');
  assert.equal(l1.keyPoints[1].xitsongaDraft, 'People Care: swilaveko swa ndyangu wa wena swi rhanga market production');
  assert.ok(l1.keyPoints[1].xitsongaDraft.indexOf('swilaveko swa ndyangu wa wena') <
    l1.keyPoints[1].xitsongaDraft.indexOf('market production'),
  'family needs must remain ahead of market production');

  assert.equal(l1.quiz[0].question.sourceEnglish, l1Source.quiz[0].q);
  assert.equal(l1.quiz[0].question.reviewStatus, 'machine-draft');
  assert.equal(l1.quiz[0].question.xitsongaDraft,
    'Murimi u xavisa all his surplus maize kambe a nga hlayisi xilo xa composting kumbe seed saving. Hi yihi ethic leyi a tsandzekaka ku yi landzelela ngopfu?');
  assert.ok(l1.quiz[0].question.xitsongaDraft.includes('all his surplus maize'),
    'the crop, ownership and complete surplus remain exact English anchors');
  assert.match(l1.quiz[0].question.xitsongaDraft, /kambe a nga hlayisi xilo xa composting kumbe seed saving\./,
    'the draft retains the negative, both purposes and their OR relationship');
  assert.ok(l1.quiz[0].question.xitsongaDraft.endsWith('Hi yihi ethic leyi a tsandzekaka ku yi landzelela ngopfu?'),
    'the existing question framing and “most failing” meaning remain present');
  for (const retainedClause of ['all his surplus maize', 'composting', 'seed saving', 'ethic']) {
    assert.ok(draft.holds.some(hold => hold.lessonId === l1Source.id && hold.field === 'quiz[0].q'
      && hold.sourceText === retainedClause), `${retainedClause} stays an explicit exact-English hold`);
  }
  assert.equal(l1.quiz[0].sourceCorrectIndex, l1Source.quiz[0].correct);
  assert.equal(l1.quiz[0].sourceCorrectIndex, 2, 'the Fair Share answer index must not move');
  assert.deepEqual(l1.quiz[0].options.map(option => option.sourceEnglish), l1Source.quiz[0].options);
  assert.equal(l1.quiz[0].rationale.sourceEnglish, l1Source.quiz[0].rationale);
  const resolvedL1 = resolveLearnerLessonPresentation(l1Source, 'ts');
  assert.equal(resolvedL1.status, 'draft');
  assert.equal(resolvedL1.content.keyPoints[1], l1.keyPoints[1].xitsongaDraft);
  assert.equal(resolvedL1.content.quiz[0].q, l1.quiz[0].question.xitsongaDraft);
  const changedQuestion = l1Source.quiz.map((item, index) => index === 0
    ? { ...item, q: `${item.q} A new source condition.` }
    : item);
  const questionFallback = resolveLearnerLessonPresentation({ ...l1Source, quiz: changedQuestion }, 'ts');
  assert.equal(questionFallback.status, 'english-fallback');
  assert.equal(questionFallback.content.quiz[0].q, changedQuestion[0].q,
    'source drift withdraws the paired machine draft instead of serving stale question wording');
});

test('the draft retains source digits and named authors in paired fields', () => {
  for (const lesson of draft.lessons) {
    assert.deepEqual(digits(lesson.body.xitsongaDraft), digits(lesson.body.sourceEnglish), `${lesson.id} body digits changed`);
    for (const [index, point] of lesson.keyPoints.entries()) {
      assert.deepEqual(digits(point.xitsongaDraft), digits(point.sourceEnglish), `${lesson.id} key point ${index} digits changed`);
    }
    for (const [index, item] of lesson.quiz.entries()) {
      assert.deepEqual(digits(item.question.xitsongaDraft), digits(item.question.sourceEnglish), `${lesson.id} quiz ${index} question digits changed`);
      assert.deepEqual(digits(item.rationale.xitsongaDraft), digits(item.rationale.sourceEnglish), `${lesson.id} quiz ${index} rationale digits changed`);
      for (const [optionIndex, option] of item.options.entries()) {
        assert.deepEqual(digits(option.xitsongaDraft), digits(option.sourceEnglish), `${lesson.id} quiz ${index} option ${optionIndex} digits changed`);
      }
    }
  }

  const l2 = draft.lessons.find(lesson => lesson.id === 'intro-permaculture-l2')!;
  for (const name of ['David Holmgren', 'Bill Mollison', 'Essence of Permaculture']) {
    assert.ok(l2.body.xitsongaDraft.includes(name), `source name ${name} should remain visible`);
  }
});

test('Introduction L3 candidate preserves visit frequencies, observed wind, and assessment pairing', async () => {
  const sourceLesson = source.lessons.find(lesson => lesson.id === 'intro-permaculture-l3')!;
  const lesson = draft.lessons.find(item => item.id === sourceLesson.id)!;
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  const paragraphs = lesson.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, 3);
  assert.match(paragraphs[0], /Zone 0 i yindlu/);
  assert.match(paragraphs[0], /Zone 1.*kusuhi na yindlu.*herbs na salad greens/);
  assert.match(paragraphs[0], /Zone 2.*ntanga lowukulu na xivala xa tihuku.*kan’we kumbe kambirhi hi siku/);
  assert.match(paragraphs[0], /Zone 3.*nsimu leyikulu.*vhiki na vhiki/);
  assert.match(paragraphs[0], /Zone 4.*semi-wild.*mirhi ya mihandzu na fodder.*minkarhi yin’wana/);
  assert.match(paragraphs[0], /Zone 5.*nhova/);
  assert.match(paragraphs[1], /Sectors.*energy.*dyambu, moya, mpfula, flood na fire/);
  assert.match(paragraphs[1], /weather station.*ma nga ku pfuna ku kambela tlhelo leri moya wu humaka eka rona/);
  assert.match(paragraphs[1], /Xiya laha mati ya mpfula ma nghenaka kona ni laha ma khulukaka kona eka ndhawu ya wena/);
  assert.match(paragraphs[1], /Dirowa miseve ya leswi u swi vonaka/);
  assert.match(paragraphs[2], /Dirowa zones na sectors ephepheni.*motheo wa design ya wena/);

  assert.equal(lesson.keyPoints[0].sourceEnglish, sourceLesson.keyPoints[0]);
  assert.equal(lesson.keyPoints[0].reviewStatus, 'machine-draft');
  assert.match(lesson.keyPoints[0].xitsongaDraft, /Zone 1.*herbs leti u ti tshovelaka nkarhi na nkarhi/);
  assert.equal(lesson.keyPoints[2].sourceEnglish, sourceLesson.keyPoints[2]);
  assert.equal(lesson.keyPoints[2].reviewStatus, 'machine-draft');
  assert.match(lesson.keyPoints[2].xitsongaDraft, /dyambu, moya, mati ya mpfula, flood na ndzilo/);

  for (const [quizIndex, item] of lesson.quiz.entries()) {
    const original = sourceLesson.quiz[quizIndex];
    assert.equal(item.question.sourceEnglish, original.q);
    assert.equal(item.sourceCorrectIndex, original.correct);
    assert.equal(item.rationale.sourceEnglish, original.rationale);
    assert.deepEqual(item.options.map(option => option.sourceEnglish), original.options);
    assert.equal(item.question.reviewStatus, 'machine-draft');
    assert.ok(item.options.every(option => option.reviewStatus === 'machine-draft'));
    assert.equal(item.rationale.reviewStatus, 'machine-draft');
  }
  assert.match(lesson.quiz[0].options[1].xitsongaDraft, /nga endla.*herbs hi minkarhi yitsongo|herbs less often/,
    'the extra walk may reduce visit frequency rather than harvest quantity');
  assert.equal(lesson.quiz[0].sourceCorrectIndex, 1);
  assert.match(lesson.quiz[1].question.xitsongaDraft, /damaging wind coming from the North-west on a Highveld farm/,
    'the windbreak question remains conditional on observed direction');
  assert.match(lesson.quiz[1].options[0].xitsongaDraft, /South-east/);
  assert.match(lesson.quiz[1].options[1].xitsongaDraft, /North-west.*vhukati ka moya na crops/);
  assert.equal(lesson.quiz[1].sourceCorrectIndex, 1,
    'the correct option keeps the boundary between the observed wind and crops');
  assert.match(lesson.quiz[1].rationale.xitsongaDraft, /eka tlhelo leri moya wu humaka eka rona hakunene/,
    'the rationale stays tied to where the observed wind actually comes from');

  // Use the validated dated Intro presentation above; changed-source fallback stays live.
  const presentation = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(presentation.status, 'draft');
  assert.equal(presentation.content.body, lesson.body.xitsongaDraft);
  assert.deepEqual(presentation.content.quiz[1], {
    q: lesson.quiz[1].question.xitsongaDraft,
    options: lesson.quiz[1].options.map(option => option.xitsongaDraft),
    correct: sourceLesson.quiz[1].correct,
    rationale: lesson.quiz[1].rationale.xitsongaDraft,
  });
  const changed = {
    ...sourceLesson,
    quiz: sourceLesson.quiz.map((item, index) => index === 1 ? { ...item, q: `${item.q} Changed source.` } : item),
  };
  const fallback = resolveLearnerLessonPresentation(changed, 'ts');
  assert.equal(fallback.status, 'english-fallback', 'wind quiz source drift hides the complete stale candidate');
  assert.equal(fallback.content.body, sourceLesson.body);
  assert.deepEqual(fallback.content.quiz, changed.quiz);
});

test('Reading Landscape preserves source lesson fields and quiz answer indexes', () => {
  const readingSource = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  assert.equal(readingDraft.reviewStatus, 'machine-draft');
  assert.equal(readingDraft.language, 'ts');
  assert.equal(readingDraft.sourceMetadata.durationMins, readingSource.durationMins);
  assert.equal(readingDraft.sourceMetadata.category, readingSource.category);
  assert.equal(readingDraft.title.sourceEnglish, readingSource.title);
  assert.equal(readingDraft.description.sourceEnglish, readingSource.description);
  assert.equal(readingDraft.lessons.length, readingSource.lessons.length);

  for (const [index, lesson] of readingDraft.lessons.entries()) {
    const original = readingSource.lessons[index];
    assert.ok(original);
    assert.equal(lesson.id, original.id);
    assert.equal(lesson.title.sourceEnglish, original.title);
    assert.equal(lesson.infographicAlt?.sourceEnglish, original.infographicAlt);
    assert.equal(lesson.body.sourceEnglish, original.body);
    assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), original.keyPoints);
    assert.equal(lesson.quiz.length, original.quiz.length);

    for (const [quizIndex, item] of lesson.quiz.entries()) {
      const sourceItem = original.quiz[quizIndex];
      assert.equal(item.question.sourceEnglish, sourceItem.q);
      assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceItem.options);
      assert.equal(item.rationale.sourceEnglish, sourceItem.rationale);
      assert.equal(item.sourceCorrectIndex, sourceItem.correct, `${lesson.id} quiz ${quizIndex} answer index changed`);
    }

    const pairs = [lesson.title, lesson.infographicAlt!, lesson.body, ...lesson.keyPoints,
      ...lesson.quiz.flatMap(item => [item.question, ...item.options, item.rationale])];
    for (const pair of pairs) {
      assert.deepEqual(digits(pair.xitsongaDraft), digits(pair.sourceEnglish), `${lesson.id} figures changed`);
      for (const plantName of ['pawpaw', 'citrus', 'khakibos', 'blackjack']) {
        assert.equal(
          pair.xitsongaDraft.match(new RegExp(`\\b${plantName}\\b`, 'gi'))?.length ?? 0,
          pair.sourceEnglish.match(new RegExp(`\\b${plantName}\\b`, 'gi'))?.length ?? 0,
          `${lesson.id} introduced or dropped the source plant term ${plantName}`,
        );
      }
      const sourceTomatoes = pair.sourceEnglish.match(/\btomatoes\b/gi)?.length ?? 0;
      const draftTomatoes = (pair.xitsongaDraft.match(/\btomatoes\b/gi)?.length ?? 0)
        + (pair.xitsongaDraft.match(/\bmatamatisi\b/gi)?.length ?? 0);
      assert.equal(draftTomatoes, sourceTomatoes, `${lesson.id} introduced or dropped the tomato crop reference`);
    }
  }
});

test('Reading Landscape Xitsonga body candidates preserve paragraph order and bounded farming claims', () => {
  const readingSource = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const l1Source = readingSource.lessons.find(lesson => lesson.id === 'reading-landscape-l1')!;
  const l1 = readingDraft.lessons.find(lesson => lesson.id === l1Source.id)!;
  const l1SourceParagraphs = l1Source.body.split('\n\n');
  const l1Paragraphs = l1.body.xitsongaDraft.split('\n\n');
  assert.equal(l1.body.sourceEnglish, l1Source.body);
  assert.equal(l1.body.reviewStatus, 'machine-draft');
  assert.equal(l1Paragraphs.length, l1SourceParagraphs.length);
  assert.equal(l1Paragraphs[0], `Loko u nga se hlengeleta mati, tiva laha ma tshamaka ma ya kona. Hlalela u ri endhawini leyi hlayisekeke loko ku na mpfula ya matimba. Loko swi hlayisekile endzhaku, fambafamba eka misava ya wena. Languta mikhandlu leyitsongo ya mati, tindhawu laha mati ma hangalakaka kona, laha ma halakaka ma yima, na laha ma humaka kona eka ndhawu ya wena. Mati man'wana lama taleke ma lava ndlela leyi hlayisekeke yo famba leswaku ma nga endli khombo.`,
    'the previously localized rain-observation paragraph must remain unchanged');

  assert.match(l1Paragraphs[1], /^A-frame level yi nga ku pfuna ku fungha points at the same height ni ku landzelela contour line\./);
  for (const exact of [
    'points at the same height',
    'contour line',
    'Its marks are an observation',
    'a hi design kumbe mpfumelelo wa earthworks',
    'Soil, slope, drainage, storm flow',
    'trained local adviser',
  ]) assert.ok(l1Paragraphs[1].includes(exact), `L1 paragraph 2 must preserve ${exact}`);
  assert.ok(l1Paragraphs[1].includes('U nga se cela swale, dam') && l1Paragraphs[1].includes('tiyisisa leswaku ndhawu yi kamberiwile'),
    'assessment remains a condition before digging the named or other structure');
  assert.match(l1Paragraphs[1], /Vutisa trained local adviser\.$/);

  assert.match(l1Paragraphs[2], /^A ku na nawu wun’we wa ndhawu lowu faneleke eka slope yin’wana ni yin’wana\. Xiya laha mati ma fambaka kona ni laha ma hlengeletanaka kona\./);
  assert.ok(l1Paragraphs[2].includes('Tikhontara leti endliweke hi ndlela yo biha ti nga engetela erosion') &&
    l1Paragraphs[2].includes('misava leyi tswongaka mati hi ku nonoka yi nga khoma mati yo tala ngopfu'),
    'retain the erosion risk and slow-infiltration overflow condition');
  assert.ok(l1Paragraphs[2].includes("Hlawula water works yin'wana ni yin'wana leyi faneleke ndhawu yoleyo") &&
    l1Paragraphs[2].includes('ndlela leyi hlayisekeke yo humesa mati lama taleke'),
    'the accepted localized choice remains site-specific and retains the safe excess-water exit');

  const l2Source = readingSource.lessons.find(lesson => lesson.id === 'reading-landscape-l2')!;
  const l2 = readingDraft.lessons.find(lesson => lesson.id === l2Source.id)!;
  const l2SourceParagraphs = l2Source.body.split('\n\n');
  const l2Paragraphs = l2.body.xitsongaDraft.split('\n\n');
  assert.equal(l2.body.sourceEnglish, l2Source.body);
  assert.equal(l2Paragraphs.length, l2SourceParagraphs.length);
  assert.equal(l2Paragraphs[0], `Eka tindhawu to tala ta South Africa, ngopfu-ngopfu hi vuxika, dyambu ri le n'walungwini. Ndlela ya rona yi cinca hi tinguva na ndhawu ya wena. Tindhawu to rhelela leti languteke n'walungwini ti tala ku kuma dyambu ro tala naswona ti nga hisa no oma swinene. Tindhawu to rhelela leti languteke dzongeni ti tala ku titimela no tsakamanyana. Xirhami xi nga hlengeletana eka swikhele swa le hansi laha moya wo titimela wu wisaka kona. Xiya ndhawu ya wena u nga se hlawula laha u nga byalaka swimilana leswi tsaneke kumbe ku veka miako.`,
    'the previously localized aspect and site-observation paragraph must remain unchanged');
  assert.equal(l2Paragraphs[1], `Dyambu ra vuxika ri le hansi naswona ri le n'walungwini swinene ku tlula dyambu ra ximumu. Khumbi kumbe shade cloth swi nga sirhelela mubhedhi hi ndzhuti nkarhi wo leha hi vuxika ku tlula hi ximumu. U nga se veka nchumu wo tshama hilaha ku nga heriki, yima eka ndhawu yoleyo hi 8am, nhlikanhi, na 4pm hi siku ra vuxika u languta laha ndzhuti wu welaka kona.`,
    'the previously localized shade and time-of-day paragraph must remain unchanged');
  assert.ok(l2Paragraphs[2].includes('Pawpaw') && l2Paragraphs[2].includes('young citrus') &&
    l2Paragraphs[2].includes('frost'), 'preserve the frost-sensitive crop names and hazard');
  assert.ok(l2Paragraphs[2].includes('Hlayisa') && l2Paragraphs[2].includes('tindhawu ta le hansi') &&
    l2Paragraphs[2].includes('frost'), 'retain the keep-away direction and low frost-pocket restriction');
  assert.ok(l2Paragraphs[2].includes('u nga se byala'), 'observe local frost before planting');
});

test('Reading Landscape Xitsonga source drift falls back to the complete current English lesson', async () => {
  const readingSource = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const sourceLesson = readingSource.lessons.find(lesson => lesson.id === 'reading-landscape-l1')!;
  // Use the validated dated Intro presentation above; changed-source fallback stays live.
  const draftView = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  const paired = readingDraft.lessons.find(lesson => lesson.id === sourceLesson.id)!;
  assert.equal(draftView.status, 'draft');
  assert.equal(draftView.content.body, paired.body.xitsongaDraft);

  const changedSource = { ...sourceLesson, body: `${sourceLesson.body} A source condition changed.` };
  const fallback = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.deepEqual(fallback.content, {
    title: changedSource.title,
    body: changedSource.body,
    keyPoints: changedSource.keyPoints,
    quiz: changedSource.quiz,
    infographicAlt: changedSource.infographicAlt,
  }, 'stale translations must not leak through when the canonical body changes');
});

test('Reading Landscape retained Xitsonga terms stay exact, source-bound and visibly unreviewed', () => {
  assert.ok(readingDraft.holds.length > 0);
  const lessons = new Map(readingDraft.lessons.map(lesson => [lesson.id, lesson]));
  for (const hold of readingDraft.holds) {
    const lesson = lessons.get(hold.lessonId);
    assert.ok(lesson, `hold points to a Reading lesson: ${hold.lessonId}`);
    const match = hold.field.match(/^(body)|^keyPoints\[(\d+)\]$|^quiz\[(\d+)\](?:\.(q|rationale)|\.options\[(\d+)\])$/);
    assert.ok(match, `hold field resolves: ${hold.field}`);
    const [, bodyField, pointIndex, quizIndex, part, optionIndex] = match;
    let pair;
    if (bodyField) pair = lesson.body;
    if (pointIndex !== undefined) pair = lesson.keyPoints[Number(pointIndex)];
    if (quizIndex !== undefined) {
      const quiz = lesson.quiz[Number(quizIndex)];
      if (part === 'q') pair = quiz?.question;
      else if (part === 'rationale') pair = quiz?.rationale;
      else if (optionIndex !== undefined) pair = quiz?.options[Number(optionIndex)];
    }
    assert.ok(pair, `hold ${hold.lessonId} ${hold.field} resolves to a learner field`);
    assert.ok(hold.reason.trim(), `${hold.field}: state why this exact source term is retained`);
    assert.ok(pair.sourceEnglish.includes(hold.sourceText), `${hold.field}: retained term belongs to the exact source`);
    if (hold.lessonId === 'reading-landscape-l1' && hold.field === 'body' && hold.sourceText === 'any water works for the site') {
      // 6 October review localized the ordinary any/site frame but retained the
      // technical label; the full accepted candidate is guarded above.
      assert.ok(pair.xitsongaDraft.includes('water works'), `${hold.field}: technical label stays exact after ordinary framing was localized`);
    } else assert.ok(pair.xitsongaDraft.includes(hold.sourceText), `${hold.field}: retained term stays exact in the mixed draft`);
    if (pair.sourceEnglish === hold.sourceText) {
      assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field}: whole-field hold remains exact English`);
      assert.equal(pair.reviewStatus, 'hold');
    } else {
      assert.equal(pair.reviewStatus, 'machine-draft', `${hold.field}: mixed prose stays unreviewed`);
    }
  }
});


test('the Xitsonga principles body translates every paragraph while remaining bound to the exact source', async () => {
  const lesson = source.lessons.find(lesson => lesson.id === 'intro-permaculture-l2')!;
  const paired = draft.lessons.find(candidate => candidate.id === lesson.id)!;
  assert.equal(paired.body.sourceEnglish, lesson.body);
  assert.equal(paired.body.reviewStatus, 'machine-draft');
  const english = lesson.body.split('\n\n');
  const paragraphs = paired.body.xitsongaDraft.split('\n\n');
  assert.equal(paragraphs.length, english.length);
  paragraphs.forEach((paragraph, index) => assert.notEqual(paragraph, english[index],
    'English-only paragraphs must not masquerade as a completed regional body'));
  assert.ok(!draft.holds.some(hold => hold.lessonId === lesson.id && hold.field === 'body'),
    'body metadata must not claim already translated passages are English holds');
  for (const term of ['David Holmgren', 'Bill Mollison', 'Essence of Permaculture', 'earthworks', 'biomass', '(strip)', 'planting bed', 'maize', 'growth stage']) {
    assert.ok(paired.body.xitsongaDraft.includes(term), `retain source concept: ${term}`);
  }
  assert.ok(!paragraphs[0].includes('Tinhlokomhaka'), 'starting points must not become topics or headings');
  assert.match(paragraphs[1], /swi ya hi storm na growth stage/, 'preserve the dependence of hail damage on storm and crop stage');
  // Dated literal targets use the full-current-validated Intro wrapper above.
  const view = resolveLearnerLessonPresentation(lesson, 'ts');
  assert.equal(view.status, 'draft');
  assert.equal(view.content.body, paired.body.xitsongaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} New condition.` }, 'ts').status,
    'english-fallback', 'changed English guidance invalidates the whole body draft');
});

test('Reading Landscape L4 translates observation framing while retaining the compaction diagnostic limit', async () => {
  const sourceLesson = COURSE_MODULES.find(module => module.id === 'reading-landscape')!.lessons
    .find(lesson => lesson.id === 'reading-landscape-l4')!;
  const lesson = readingDraft.lessons.find(item => item.id === sourceLesson.id)!;
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = lesson.body.xitsongaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);
  assert.ok(draftParagraphs[0].includes('Mepe wa ndhawu') && draftParagraphs[0].includes("'not to scale'") &&
    draftParagraphs[0].includes('fences') && draftParagraphs[0].includes('ximumu na vuxika'),
    'keep the sketch scale warning, mapped fence feature and separate summer/winter wind arrows');
  assert.ok(draftParagraphs[1].startsWith('Tsala laha frost yi tshamaka kona'));
  assert.ok(draftParagraphs[1].includes('nkarhi wo leha ngopfu'));
  assert.ok(draftParagraphs[1].includes('misava yi nun') && draftParagraphs[1].includes('leti omeke'));
  assert.ok(draftParagraphs[1].includes('khakibos kumbe blackjack'));
  assert.ok(draftParagraphs[1].includes('Swimilana leswi swi nga kula etindhawini leti kavanyetiweke'));
  assert.ok(draftParagraphs[1].includes('kambe ku va kona ka swona ntsena a ku kombisi leswaku misava yi tsindziyerile.'),
    'translate the ordinary plant subject while preserving the full limitation against diagnosing compaction from presence alone');
  assert.ok(draftParagraphs[1].includes('Kambela misava u nga se teka xiboho'));
  assert.equal(draftParagraphs[2], "Veka ti-zone na ti-sector ta wena ehenhla ka xifaniso xolexo. Xi pfuxete hi nguva na nguva. Xifaniso xa phensele lexi u xi tirhisaka kahle xi ni nkoka ku tlula lexi hetisekeke lexi dirowiweke kan'we ntsena.",
    'preserve the neighboring localized sketch-value paragraph exactly');
  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const view = resolveLearnerLessonPresentation(sourceLesson, 'ts');
  assert.equal(view.status, 'draft');
  assert.equal(view.content.body, lesson.body.xitsongaDraft);
  const drifted = { ...sourceLesson, body: sourceLesson.body.replace('Note where frost sits longest,', 'Note where frost sits briefly,') };
  assert.notEqual(drifted.body, sourceLesson.body);
  const fallback = resolveLearnerLessonPresentation(drifted, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, drifted.body, 'withdraw the whole stale body when its source changes');
});

test('Reading Landscape L3 drafts ordinary body guidance while keeping precise cold and disease clauses exact', async () => {
  const sourceLesson = COURSE_MODULES.find(module => module.id === 'reading-landscape')!.lessons
    .find(lesson => lesson.id === 'reading-landscape-l3')!;
  const lesson = readingDraft.lessons.find(item => item.id === sourceLesson.id)!;
  assert.equal(lesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(lesson.body.reviewStatus, 'machine-draft');
  const sourceParagraphs = sourceLesson.body.split('\n\n');
  const draftParagraphs = lesson.body.xitsongaDraft.split('\n\n');
  assert.equal(draftParagraphs.length, sourceParagraphs.length);

  assert.ok(draftParagraphs[0].includes("ti-ridges and gaps ta ndhawu ya wena"));
  assert.ok(draftParagraphs[0].includes('Fambafamba eka misava hi masiku ya moya.'));
  assert.ok(!draftParagraphs[0].includes('Check local weather records before deciding where shelter is needed.'));
  assert.ok(draftParagraphs[0].includes('Kambela matsalwa ya maxelo ya laha kaya') && draftParagraphs[0].includes('u nga se teka xiboho'));

  assert.ok(draftParagraphs[1].startsWith('Eka vusiku byo tenga ni byo rhula'));
  assert.ok(draftParagraphs[1].includes('moya wo titimela wu nga khulukela ehansi') &&
    draftParagraphs[1].includes('Tindhawu leti ti nga titimela ku tlurisa tindhawu to rhelela leti nga ekusuhi'),
    'preserve cold-air downhill flow, its can-modality and the colder-than-nearby-slopes comparison');
  assert.ok(draftParagraphs[1].includes('Maendlelo ya frost na wona ya ya hi ndhawu'));
  assert.ok(draftParagraphs[1].includes('Kambela matsalwa ya mahiselo ya le hansi swinene ya laha kaya loko ma kumeka'),
    'preserve minimum-temperature records and their where-available condition');
  assert.ok(draftParagraphs[1].includes('Loko ma nga ri kona') && draftParagraphs[1].includes('eka vusiku byo titimela'));
  assert.ok(draftParagraphs[1].includes('vutisa mutsundzuxi wa swa vurimi wa laha kaya') &&
    draftParagraphs[1].includes('u nga si hlawula ndhawu ya nkarhi wo leha ya tender seedlings'),
    'preserve local-adviser consultation before choosing a permanent location for tender seedlings');

  assert.ok(draftParagraphs[2].startsWith('Frost i ice leyi vumbekaka'));
  assert.ok(draftParagraphs[2].includes('Mist ntsena a yi kombisi') &&
    draftParagraphs[2].includes('frost damage yi nga endleka handle ka ice leyi vonakaka'),
    'retain both limits: mist alone does not show ice, and damage can occur without visible ice');
  assert.ok(draftParagraphs[2].includes('misava ya le hansi') && draftParagraphs[2].includes('tindhawu to rhelela'));
  assert.ok(draftParagraphs[2].includes('minimum temperatures laha swi kotekaka'));
  assert.ok(draftParagraphs[2].includes('Fungha tindhawu laha cold or damage swi tshamaka kona nkarhi wo leha ngopfu.'),
    'localize the marking sentence while retaining longest duration as the criterion');
  assert.ok(draftParagraphs[2].includes('cold pockets leti u ti vonaka'));

  assert.ok(draftParagraphs[3].startsWith('Eka matamatisi'));
  assert.ok(draftParagraphs[3].includes('Late blight yi nga ya mahlweni yi hangalaka loko ku titimela ni ku tsakama swi teka nkarhi wo leha'),
    'retain the possibility and prolonged cool/damp condition without turning it into a certainty');
  assert.ok(draftParagraphs[3].includes('Ku rhurhisa mubhedhi ntsena a swi nge yi lawuli') &&
    draftParagraphs[3].includes('xitsundzuxo xa rihanyo ra swimilana xa laha kaya'),
    'a bed move alone does not control the disease; local crop-health advice is still required');

  const bodyHolds = readingDraft.holds.filter(hold => hold.lessonId === sourceLesson.id && hold.field === 'body');
  assert.ok(bodyHolds.length > 0);
  assert.ok(!bodyHolds.some(hold => sourceParagraphs.includes(hold.sourceText)),
    'metadata must identify exact held clauses instead of claiming a whole body paragraph is held');
  const scopedReplacementAnchors = new Map<string, { paragraphIndex: number; retained: string[]; reason: string }>([
    ['can be colder than nearby slopes.', { paragraphIndex: 1, retained: ['Tindhawu leti ti nga va colder than nearby slopes.'], reason: 'localized subject/modal with the exact colder-than comparison retained' }],
    ['local minimum-temperature records where available', { paragraphIndex: 1, retained: ['local minimum-temperature records loko ti kumeka.'], reason: 'localized availability while preserving the exact measurement evidence' }],
    ['Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice.', { paragraphIndex: 2, retained: ['Frost i ice that forms on a cold surface.', 'Mist ntsena a yi kombisi leswaku ice has formed, naswona frost damage can happen without visible ice.'], reason: 'localized ordinary definition framing while keeping the physical definition and negative qualifications' }],
    ['where cold or damage lasts longest.', { paragraphIndex: 2, retained: ['laha cold or damage swi tshamaka kona nkarhi wo leha ngopfu'], reason: 'localized marking instruction while retaining the longest-duration criterion' }],
  ]);
  for (const hold of bodyHolds) {
    if (hold.sourceText === 'across cold nights') {
      assert.ok(sourceParagraphs[1].includes(hold.sourceText), 'the prior held timing phrase belongs to this canonical paragraph');
      assert.ok(draftParagraphs[1].includes('eka vusiku byo titimelaka'),
        'the approved refinement localizes cold-night observation without dropping its timing condition');
      continue;
    }
    const scoped = scopedReplacementAnchors.get(hold.sourceText);
    if (scoped) {
      assert.ok(sourceParagraphs[scoped.paragraphIndex].includes(hold.sourceText),
        `${hold.sourceText}: retained as source-bound provenance for the narrower updated draft`);
      for (const anchor of scoped.retained) {
        assert.ok(draftParagraphs[scoped.paragraphIndex].includes(anchor),
          `${scoped.reason}: preserve ${anchor}`);
      }
      continue;
    }
    assert.ok(lesson.body.xitsongaDraft.includes(hold.sourceText), `remaining held clause stays exact: ${hold.sourceText}`);
  }

  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const changedSource = { ...sourceLesson, body: `${sourceLesson.body} A source condition changed.` };
  const fallback = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changedSource.body, 'source drift must not serve stale regional safety instructions');
});

test('Reading Landscape L1 assessment drafts keep the A-frame limit and safe-overflow conditions', async () => {
  const sourceLesson = COURSE_MODULES.find(module => module.id === 'reading-landscape')!.lessons
    .find(lesson => lesson.id === 'reading-landscape-l1')!;
  const lesson = readingDraft.lessons.find(item => item.id === sourceLesson.id)!;
  const sourceQ0 = sourceLesson.quiz[0];
  const sourceQ1 = sourceLesson.quiz[1];
  const q0 = lesson.quiz[0];
  const q1 = lesson.quiz[1];
  assert.deepEqual(lesson.quiz.map(item => item.sourceCorrectIndex), [0, 1]);
  assert.deepEqual(q0.options.map(option => option.sourceEnglish), sourceQ0.options);
  assert.deepEqual(q1.options.map(option => option.sourceEnglish), sourceQ1.options);
  assert.equal(q0.options[0].xitsongaDraft, sourceQ0.options[0],
    'the vertical contour measurement remains an exact-English technical hold');
  assert.equal(q0.options[0].reviewStatus, 'hold');
  assert.ok(q0.options.slice(1).every(option => option.xitsongaDraft.trim()),
    'all three distractors remain present in their canonical order');
  assert.equal(q0.sourceCorrectIndex, 0, 'translating the distractors does not move the correct answer');
  assert.equal(q0.rationale.sourceEnglish, sourceQ0.rationale);
  assert.equal(q1.options[1].sourceEnglish, sourceQ1.options[1]);
  assert.equal(q0.rationale.reviewStatus, 'machine-draft');
  assert.equal(q1.options[1].reviewStatus, 'machine-draft');
  assert.ok(q0.rationale.xitsongaDraft.startsWith('A-frame yi nga ku pfuna'));
  assert.ok(q0.rationale.xitsongaDraft.includes('points at the same height'));
  // The broader water-flow phrase and hailstorm wording narrowed the source conditions.
  // Keep each technical assessment limit explicit rather than pinning the old translation.
  assert.ok(q0.rationale.xitsongaDraft.includes('A yi kambeli misava, drainage, storm flow') &&
    q0.rationale.xitsongaDraft.includes('kumbe loko earthworks ti fanerile'));
  assert.ok(q1.options[1].xitsongaDraft.startsWith('Kambela misava, ndhawu leyi rhelelaka') &&
    q1.options[1].xitsongaDraft.includes('storm flow'));
  assert.ok(q1.options[1].xitsongaDraft.includes('ndlela leyi hlayisekeke yo humesa mati lama taleke'));
  assert.ok(q1.options[1].xitsongaDraft.includes('loyi a leteriweke'),
    'retain the trained qualification on the local adviser');
  assert.equal(q1.rationale.reviewStatus, 'machine-draft');
  assert.ok(q1.rationale.xitsongaDraft.includes('a wu kombisi') && q1.rationale.xitsongaDraft.includes('fanele') &&
    q1.rationale.xitsongaDraft.includes('ndlela leyi hlayisekeke'),
    'retain the site-rule limit and safe excess-water exit without requiring the former English hold');
  assert.ok(!readingDraft.holds.some(hold => hold.lessonId === sourceLesson.id && hold.field === 'quiz[1].rationale'
    && hold.sourceText === sourceQ1.rationale), 'a mixed rationale is not marked as a whole-field hold');
  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const changedQuiz = sourceLesson.quiz.map((item, index) => index === 0
    ? { ...item, rationale: `${item.rationale} A new source condition.` }
    : item);
  const fallback = resolveLearnerLessonPresentation({ ...sourceLesson, quiz: changedQuiz }, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.quiz[0].rationale, changedQuiz[0].rationale,
    'changed canonical assessment wording must not serve a stale translated rationale');
  for (const changedOptionIndex of [1, 3]) {
    const driftedOptions = sourceLesson.quiz.map((item, index) => index === 0
      ? { ...item, options: item.options.map((option, optionIndex) => optionIndex === changedOptionIndex
        ? `${option} Changed source.`
        : option) }
      : item);
    const optionFallback = resolveLearnerLessonPresentation({ ...sourceLesson, quiz: driftedOptions }, 'ts');
    assert.equal(optionFallback.status, 'english-fallback',
      `changed option ${changedOptionIndex} withdraws the stale paired distractor`);
    assert.equal(optionFallback.content.quiz[0].options[changedOptionIndex], driftedOptions[0].options[changedOptionIndex]);
  }
});

test('Reading module assessment drafts preserve frost uncertainty, seasonal checks and incomplete disease control', async () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const l2 = readingDraft.lessons.find(lesson => lesson.id === 'reading-landscape-l2')!;
  const l3 = readingDraft.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!;
  const l4 = readingDraft.lessons.find(lesson => lesson.id === 'reading-landscape-l4')!;
  for (const lesson of [l2, l3, l4]) {
    const original = sourceModule.lessons.find(item => item.id === lesson.id)!;
    assert.deepEqual(lesson.quiz.map(q => q.sourceCorrectIndex), original.quiz.map(q => q.correct));
  }
  assert.ok(l2.quiz[0].rationale.xitsongaDraft.includes('frost pocket') &&
    l2.quiz[0].rationale.xitsongaDraft.includes('hunguta khombo') &&
    l2.quiz[0].rationale.xitsongaDraft.includes('frost ya ndhawu') &&
    l2.quiz[0].rationale.xitsongaDraft.includes('fanele ku kongomisa'),
  'retain the frost-pocket condition, uncertainty, and local-observation rule across mixed prose');
  assert.ok(l2.quiz[1].rationale.xitsongaDraft.includes('hi 8am, nhlikanhi, na 4pm') &&
    l2.quiz[1].rationale.xitsongaDraft.includes('u nga se yi tiyisa endhawini'),
  'preserve all three observation times and the before-fixing condition');
  const frostRationale = l3.quiz[0].rationale.xitsongaDraft;
  assert.ok(frostRationale.includes('vusiku byo tenga ni byo rhula') && frostRationale.includes('etindhawini ta le hansi'),
    'cold-air risk remains tied to low ground on clear, still nights');
  assert.ok(frostRationale.includes('matsalwa ya mahiselo ya le hansi swinene') &&
    frostRationale.includes('mutsundzuxi wa swa vurimi wa laha kaya') &&
    frostRationale.includes('u nga se teka xiboho xa ndhawu ya nkarhi wo leha'),
    'preserve alternative evidence/adviser checks and their before-permanent-choice condition');
  assert.ok(frostRationale.includes('a ku na ndhawu') && frostRationale.includes('tiyisekisaka') &&
    frostRationale.includes('frost'), 'do not promise that any hillside position is frost-free');
  assert.equal(l3.quiz[1].question.sourceEnglish,
    sourceModule.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!.quiz[1].q,
    'the localized crop scenario must remain paired to quiz 1, where its source actually appears');
  assert.ok(l3.quiz[1].question.xitsongaDraft.startsWith('Matamatisi ya murimi wa KZN '),
    'localize the farmer-and-tomato subject without moving the question to another quiz item');
  assert.ok(l3.quiz[1].question.xitsongaDraft.includes('hi ku phindha-phindha') &&
    l3.quiz[1].question.xitsongaDraft.includes('ku titimela ni ku tsakama'),
    'retain the repeated disease and cool, damp weather condition');
  assert.ok(l3.quiz[1].question.xitsongaDraft.includes('nga pfunaka') &&
    l3.quiz[1].question.xitsongaDraft.includes('swin’we ni xitsundzuxo xa rihanyo ra swimilana xa laha kaya'));
  assert.equal(l3.quiz[1].sourceCorrectIndex,
    sourceModule.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!.quiz[1].correct,
    'translating the scenario subject must not change its answer binding');
  assert.ok(l3.quiz[1].rationale.xitsongaDraft.includes('Late blight yi tsakela ku titimela loku tekaka nkarhi wo leha ni ku tsakama') &&
    l3.quiz[1].rationale.xitsongaDraft.includes('ku rhurhisa mubedhi ntsena a hi kungu leri heleleke'),
    'retain disease-favouring prolonged cool/damp conditions and the limit of moving the bed alone');
  assert.ok(l4.quiz[0].rationale.xitsongaDraft.includes('Blackjack yi nga kula') &&
    l4.quiz[0].rationale.xitsongaDraft.includes('ku va kona ka yona ntsena a ku kombisi compaction'),
    'retain the distinction between disturbed-ground growth and evidence of compaction');
  assert.ok(l4.quiz[0].rationale.xitsongaDraft.includes('u nga se teka xiboho'));
  const sourceWind = sourceModule.lessons.find(lesson => lesson.id === l4.id)!.quiz[1].rationale;
  assert.ok(sourceWind.includes('can be wrong') &&
    l4.quiz[1].rationale.xitsongaDraft.includes('yi nga va yi nga ri kahle eka nguva yin’wana'),
    'preserve the source claim that a placement working in one season can be wrong in the other');
  assert.ok(l4.quiz[1].rationale.xitsongaDraft.includes('moya wa ximumu') &&
    l4.quiz[1].rationale.xitsongaDraft.includes('ra vuxika') &&
    l4.quiz[1].rationale.xitsongaDraft.includes('hi ku hambana'));
  const original = sourceModule.lessons.find(lesson => lesson.id === l3.id)!;
  const quiz = original.quiz.map((q, index) => index === 1 ? { ...q, q: `${q.q} New crop-health condition.` } : q);
  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const fallback = resolveLearnerLessonPresentation({ ...original, quiz }, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.notEqual(quiz[1].q, original.quiz[1].q, 'fixture changes the canonical question field');
  assert.equal(fallback.content.quiz[1].q, quiz[1].q);
});
test('Reading Landscape ordinary drafts keep frost instructions, suitability limits and quiz identity source-bound', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const source = sourceModule;
  const drafts = [
    { language: 'st' as const, code: 'st' as const, module: SESOTHO_READING_LANDSCAPE_DRAFT },
    { language: 've' as const, code: 've' as const, module: TSHIVENDA_READING_LANDSCAPE_DRAFT },
    { language: 'ts' as const, code: 'ts' as const, module: readingDraft },
  ];

  for (const { language, code, module } of drafts) {
    const sourceLesson = source.lessons.find(lesson => lesson.id === 'reading-landscape-l2')!;
    const draftLesson = module.lessons.find(lesson => lesson.id === 'reading-landscape-l2')!;
    assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body,
      `${language}: keep the complete English source paired`);
    assert.equal(draftLesson.body.reviewStatus, 'machine-draft',
      `${language}: mixed prose remains visibly unreviewed`);
    const sourceParagraphs = sourceLesson.body.split('\n\n');
    const draftText = 'sesothoDraft' in draftLesson.body
      ? draftLesson.body.sesothoDraft
      : 'tshivendaDraft' in draftLesson.body
        ? draftLesson.body.tshivendaDraft
        : draftLesson.body.xitsongaDraft;
    const draftParagraphs = draftText.split('\n\n');
    assert.equal(draftParagraphs.length, sourceParagraphs.length,
      `${language}: preserve the complete paragraph sequence`);
    assert.ok(draftParagraphs[2].includes('Pawpaw') && draftParagraphs[2].includes('young citrus'),
      `${language}: retain the crop identity and young age qualifier`);
    assert.doesNotMatch(draftParagraphs[2], /small citrus|citrus (?:trees|plants) are small/i,
      `${language}: do not turn young citrus into a size description`);
    if (language === 've') {
      assert.ok(draftParagraphs[2].includes('Ni songo vhea') && draftParagraphs[2].includes('known low frost pockets'),
        'VE: retain the prohibition and known-pocket restriction');
    } else if (language === 'ts') {
      assert.ok(draftParagraphs[2].includes('Hlayisa') && draftParagraphs[2].includes('tindhawu ta le hansi'),
        'TS: retain the keep-away direction and low frost-pocket restriction');
    }

    const changedSource = { ...sourceLesson, body: `${sourceLesson.body} New source condition.` };
    const fallback = resolveLearnerLessonPresentation(changedSource, code);
    assert.equal(fallback.status, 'english-fallback',
      `${language}: any changed source body must withdraw the full paired draft`);
    assert.equal(fallback.content.body, changedSource.body,
      `${language}: show the new English guidance after source drift`);
  }

  const veL1Source = source.lessons.find(lesson => lesson.id === 'reading-landscape-l1')!;
  const veL1 = TSHIVENDA_READING_LANDSCAPE_DRAFT.lessons.find(lesson => lesson.id === veL1Source.id)!;
  const aFrame = veL1.keyPoints[1];
  assert.equal(aFrame.sourceEnglish, veL1Source.keyPoints[1]);
  assert.equal(aFrame.reviewStatus, 'machine-draft');
  assert.ok(aFrame.tshivendaDraft.includes('points at the same height') &&
    aFrame.tshivendaDraft.includes('a i sumbedzi arali earthworks dzi tshi tea'),
  'the candidate must retain both the measurement and site-suitability limits');
  assert.doesNotMatch(aFrame.tshivendaDraft, /earthworks should/i,
    'a measurement aid must not become an instruction to do earthworks');
  const changedKeyPoint = {
    ...veL1Source,
    keyPoints: veL1Source.keyPoints.map((point, index) => index === 1 ? `${point} Changed.` : point),
  };
  assert.equal(resolveLearnerLessonPresentation(changedKeyPoint, 've').status, 'english-fallback',
    'changed A-frame suitability guidance must invalidate its mixed draft');

  const veL4Source = source.lessons.find(lesson => lesson.id === 'reading-landscape-l4')!;
  const veL4 = TSHIVENDA_READING_LANDSCAPE_DRAFT.lessons.find(lesson => lesson.id === veL4Source.id)!;
  const windQuiz = veL4.quiz[1];
  assert.equal(windQuiz.sourceCorrectIndex, veL4Source.quiz[1].correct);
  assert.equal(windQuiz.options[1].sourceEnglish, veL4Source.quiz[1].options[1]);
  assert.equal(windQuiz.options[1].reviewStatus, 'machine-draft');
  assert.ok(windQuiz.options[1].tshivendaDraft.includes('zwa shandula hune windbreaks') &&
    windQuiz.options[1].tshivendaDraft.includes('zwa fanela u vhewa hone'),
    'the localized direction phrase must retain the placement consequence');

  const tsL2Source = source.lessons.find(lesson => lesson.id === 'reading-landscape-l2')!;
  const tsL2 = readingDraft.lessons.find(lesson => lesson.id === tsL2Source.id)!;
  const frostRationale = tsL2.quiz[0].rationale;
  assert.equal(tsL2.quiz[0].sourceCorrectIndex, tsL2Source.quiz[0].correct);
  assert.equal(frostRationale.sourceEnglish, tsL2Source.quiz[0].rationale);
  assert.ok(frostRationale.xitsongaDraft.includes('frost pocket') &&
    frostRationale.xitsongaDraft.includes('nga ha hunguta khombo') &&
    frostRationale.xitsongaDraft.includes('frost ya ndhawu') && frostRationale.xitsongaDraft.includes('fanele ku kongomisa'),
  'the local wording must not remove the known-pocket condition, uncertainty, or final-position instruction');
  const shadeRationale = tsL2.quiz[1].rationale;
  assert.equal(tsL2.quiz[1].sourceCorrectIndex, tsL2Source.quiz[1].correct);
  assert.ok(shadeRationale.xitsongaDraft.includes('Dyambu ra vuxika ri le hansi') &&
    shadeRationale.xitsongaDraft.includes('Shade cloth yi nga cinca tiawara leti dyambu ri voningaka mubhedhi') &&
    shadeRationale.xitsongaDraft.includes('hi 8am, nhlikanhi, na 4pm') &&
    shadeRationale.xitsongaDraft.includes('u nga se yi tiyisa endhawini'),
  'preserve seasonal direction, the shade effect, all observation times, and the before-fixing condition');

  const tsL3Source = source.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!;
  const tsL3 = readingDraft.lessons.find(lesson => lesson.id === tsL3Source.id)!;
  const sourceQuestion = tsL3Source.quiz[1];
  const cropQuestion = tsL3.quiz[1].question;
  assert.equal(cropQuestion.sourceEnglish, source.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!.quiz[1].q,
    'the translated KZN crop scenario must bind to quiz 1, where that source question occurs');
  assert.equal(tsL3.quiz[1].sourceCorrectIndex, sourceQuestion.correct);
  assert.ok(cropQuestion.xitsongaDraft.startsWith('Matamatisi ya murimi wa KZN '));
  assert.ok(cropQuestion.xitsongaDraft.includes('ma khomiwa hi late blight hi ku phindha-phindha') &&
    cropQuestion.xitsongaDraft.includes('loko ku titimela ni ku tsakama'),
    'preserve repeated disease and cool, damp weather conditions in the translated question');
  assert.ok(cropQuestion.xitsongaDraft.includes('swin’we ni xitsundzuxo xa rihanyo ra swimilana xa laha kaya?'),
    'keep the crop-health qualification attached to the question');
  assert.notEqual(cropQuestion.sourceEnglish, tsL3Source.quiz[0].q,
    'the disease scenario must not be wired to quiz 0');
  const metadata = readingDraft.holds.find(hold =>
    hold.lessonId === tsL3Source.id && hold.field === 'quiz[1].q' && hold.sourceText === 'late blight');
  assert.ok(metadata, 'hold metadata identifies the disease term retained in the mixed question');
  assert.ok(cropQuestion.xitsongaDraft.includes(metadata.sourceText));
  assert.ok(!readingDraft.holds.some(hold =>
    hold.lessonId === tsL3Source.id && hold.field === 'quiz[1].q' &&
    hold.sourceText === sourceQuestion.q),
  'metadata must not label the entire source sentence held after its subject has been localized');

  const changedQuestion = {
    ...tsL3Source,
    quiz: tsL3Source.quiz.map((question, index) => index === 1
      ? { ...question, q: `${question.q} New crop-health condition.` }
      : question),
  };
  assert.equal(resolveLearnerLessonPresentation(changedQuestion, 'ts').status, 'english-fallback',
    'changed quiz wording must withdraw the source-paired disease question and its answer binding');
});
