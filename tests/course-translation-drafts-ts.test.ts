import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import {
  XITSONGA_INTRO_PERMACULTURE_DRAFT as draft,
  XITSONGA_READING_LANDSCAPE_DRAFT as readingDraft,
} from '../lib/course-translation-drafts-ts.ts';

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

test('held Xitsonga fields stay exact English until fluent review resolves them', () => {
  assert.ok(draft.holds.length > 0);
  const lessons = new Map(draft.lessons.map(lesson => [lesson.id, lesson]));

  for (const hold of draft.holds) {
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
    if (bodyField) assert.ok(pair.xitsongaDraft.includes(hold.sourceText), `${hold.field} must retain the exact held source phrase`);
    else assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exactly as sourced`);
    if (!bodyField) assert.equal(pair.reviewStatus, 'hold');
    assert.ok(hold.reason.length > 0);
  }
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

  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
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
      for (const plantName of ['pawpaw', 'citrus', 'tomatoes', 'khakibos', 'blackjack']) {
        assert.equal(
          pair.xitsongaDraft.match(new RegExp(`\\b${plantName}\\b`, 'gi'))?.length ?? 0,
          pair.sourceEnglish.match(new RegExp(`\\b${plantName}\\b`, 'gi'))?.length ?? 0,
          `${lesson.id} introduced or dropped the source plant term ${plantName}`,
        );
      }
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

  assert.match(l1Paragraphs[1], /^An A-frame level yi nga ku pfuna ku mark points at the same height and trace a contour line\./);
  for (const exact of [
    'points at the same height',
    'mark points',
    'trace a contour line',
    'Its marks are an observation, not a design or approval for earthworks.',
    'Before digging a swale, dam, or other structure, have the site assessed.',
    'Soil, slope, drainage, storm flow, and a safe overflow route all matter.',
    'a trained local adviser',
  ]) assert.ok(l1Paragraphs[1].includes(exact), `L1 paragraph 2 must preserve ${exact}`);
  assert.match(l1Paragraphs[1], /Vutisa a trained local adviser\.$/);

  assert.match(l1Paragraphs[2], /^A ku na placement rule yin’we ya slope yin’wana ni yin’wana\. Xiya laha mati ma fambaka kona ni laha ma hlengeletanaka kona\./);
  for (const exact of [
    'Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much.',
    'Choose any water works for the site and plan a safe route for excess water.',
  ]) assert.ok(l1Paragraphs[2].includes(exact), `L1 paragraph 3 must preserve ${exact}`);

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
  assert.ok(l2Paragraphs[2].includes('Pawpaw and young citrus are sensitive to frost.'), 'the frost-sensitive crops must remain exactly named');
  assert.ok(l2Paragraphs[2].includes('Keep tender plants out of known low frost pockets.'), 'the known-frost-pocket instruction must remain exact');
  assert.ok(l2Paragraphs[2].endsWith('Xiya local frost u nga se byala.'), 'observe local frost before planting');
});

test('Reading Landscape Xitsonga source drift falls back to the complete current English lesson', async () => {
  const readingSource = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
  const sourceLesson = readingSource.lessons.find(lesson => lesson.id === 'reading-landscape-l1')!;
  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
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

test('Reading Landscape safety and terminology holds remain exact in their paired fields', () => {
  assert.ok(readingDraft.holds.length > 0);
  const lessons = new Map(readingDraft.lessons.map(lesson => [lesson.id, lesson]));
  for (const hold of readingDraft.holds) {
    const lesson = lessons.get(hold.lessonId);
    assert.ok(lesson, `hold points to unknown lesson ${hold.lessonId}`);
    const match = hold.field.match(/^(body)|^keyPoints\[(\d+)\]$|^quiz\[(\d+)\](?:\.(q|rationale)|\.options\[(\d+)\])$/);
    assert.ok(match, `unsupported held field ${hold.field}`);
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
    assert.ok(pair, `hold ${hold.lessonId} ${hold.field} must resolve`);
    if (bodyField) assert.ok(pair.xitsongaDraft.includes(hold.sourceText), `${hold.field} must retain its exact held text`);
    else assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exact English`);
    if (!bodyField) assert.equal(pair.reviewStatus, 'hold');
    assert.ok(hold.reason.length > 0);
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
  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const view = resolveLearnerLessonPresentation(lesson, 'ts');
  assert.equal(view.status, 'draft');
  assert.equal(view.content.body, paired.body.xitsongaDraft);
  assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} New condition.` }, 'ts').status,
    'english-fallback', 'changed English guidance invalidates the whole body draft');
});
