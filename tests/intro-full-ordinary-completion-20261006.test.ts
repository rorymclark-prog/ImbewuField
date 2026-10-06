import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { introFullFixture, introFullNativeBefore, introFullNativeAfter, introFullCanonicalBefore,
  readCurrentIntroNative, validateAndRewindIntroFullNative, type IntroLanguage } from './intro-full-ordinary-native-checks.ts';
import { introFullPairedPacket, readCurrentIntroFullDecks, validateAndRewindIntroFullPaired,
  validateProtectedSTIntro, verifyProtectedIntroAsset } from './intro-full-ordinary-paired-checks.ts';

test('Introduction exposes only the accepted94 source-bound rows, preserving every unlisted native/deck field and all12 answers', () => {
  for (const language of ['ve', 'ts'] as const) assert.deepEqual(validateAndRewindIntroFullNative(language), introFullNativeBefore[language]);
  const historical = validateAndRewindIntroFullPaired();
  for (const language of ['ve', 'ts', 'st']) assert.deepEqual(historical[language], introFullFixture(`${language}-paired-before.json`));
  assert.equal(introFullPairedPacket.objects.length, 72);
  assert.equal(new Set(introFullPairedPacket.objects.map((row: any) => row.path + ':' + row.slide)).size, 36);
  for (const language of ['ve', 'ts'] as const) assert.deepEqual(readCurrentIntroNative()[language].lessons
    .flatMap((lesson: any) => lesson.quiz.map((quiz: any) => quiz.sourceCorrectIndex)), [2, 2, 1, 1, 1, 1]);
});

test('Introduction current hold metadata does not falsely label localized People Care or seed saving as unchanged English', () => {
  const current = readCurrentIntroNative().ts;
  validateAndRewindIntroFullNative('ts', current);
  assert.deepEqual(current.holds, introFullNativeBefore.ts.holds.filter((hold: any) =>
    hold.sourceText !== 'People Care' && hold.sourceText !== 'seed saving'));
  assert.deepEqual(current.holds.map((hold: any) => hold.sourceText), ['all his surplus maize', 'composting', 'ethic']);
  for (const hold of current.holds) {
    assert.equal(hold.lessonId, 'intro-permaculture-l1');
    assert.equal(hold.field, 'quiz[0].q');
    const question = current.lessons[0].quiz[0].question;
    assert.ok(question.sourceEnglish.includes(hold.sourceText));
    assert.ok(question.xitsongaDraft.includes(hold.sourceText));
    assert.ok(hold.reason);
  }
  assert.match(current.lessons[0].quiz[0].question.xitsongaDraft, /a nga hlayisi xilo xa composting kumbe ku hlayisa mbewu/,
    'nothing for composting OR seed saving stays negative, with precise crop/ownership/category anchors');
  assert.ok(current.lessons[0].keyPoints[1].xitsongaDraft.startsWith('Ku Hlayisa Vanhu:'));
  const stale = structuredClone(current); stale.holds.push(introFullNativeBefore.ts.holds[0]);
  assert.throws(() => validateAndRewindIntroFullNative('ts', stale), 'obsolete live hold metadata is real drift, never a history exemption');
});

test('Introduction rejects current source, answer order, modal, metadata and unlisted mutations before any historical rewind', () => {
  const mutations: Array<(draft: any) => void> = [
    draft => { draft.lessons[1].body.sourceEnglish += ' A new source condition.'; },
    draft => { draft.lessons.reverse(); },
    draft => { draft.lessons[0].quiz[0].sourceCorrectIndex = 0; },
    draft => { draft.lessons[1].quiz[1].options.reverse(); },
    draft => { draft.description.reviewStatus = 'hold'; },
    draft => { draft.lessons[0].title.sourceEnglish += ' Changed.'; },
    draft => { draft.lessons[1].body[draft.language === 've' ? 'tshivendaDraft' : 'xitsongaDraft'] += ' Always safe.'; },
  ];
  for (const language of ['ve', 'ts'] as const) for (const mutate of mutations) {
    const current = structuredClone(readCurrentIntroNative()[language]); mutate(current);
    assert.throws(() => validateAndRewindIntroFullNative(language, current), 'full current accepted layer must reject drift before reconstruction');
  }
});

test('Introduction mixed pairs reject false English drafts, changed safety source and unlisted/ST mutations', () => {
  const mutations: Array<(decks: Record<string, any>) => void> = [
    decks => { decks.ve.slides[6].english.body[1] = decks.ve.slides[6].english.body[1].replace('If sharing is allowed and there is enough water', 'Whenever neighbours ask'); },
    decks => { decks.ts.slides[13].target.body[1].segments.find((part: any) => part.sourceEnglish === 'rotate through the beds').status = 'draft'; },
    decks => { const held = decks.ve.slides[10].target.body[0].segments.find((part: any) => part.status === 'english-hold'); held.text = held.sourceEnglish; },
    decks => { decks.ve.slides[1].target.heading.text = 'Unlisted mutation'; },
    decks => { decks.st.slides[21].target.heading.text = 'ST audio-bound mutation'; },
    decks => { decks.ts.slides[21].n = 21; },
    decks => { decks.ts.slides[6].target.heading.segments[1].text = 'Ethics'; },
  ];
  for (const mutate of mutations) {
    const current = readCurrentIntroFullDecks(); mutate(current);
    assert.throws(() => validateAndRewindIntroFullPaired(current), 'full source/status/meaning/unlisted/ST overlay must fail before rewind');
  }
});

test('Introduction learner drafts remain visibly unreviewed and fail closed on changed source and answer indices', () => {
  for (const language of ['ve', 'ts'] as const) for (const original of introFullCanonicalBefore.lessons) {
    const current = resolveLearnerLessonPresentation(original, language);
    assert.equal(current.status, 'draft');
    const native = introFullNativeAfter[language].lessons.find((lesson: any) => lesson.id === original.id);
    const key = language === 've' ? 'tshivendaDraft' : 'xitsongaDraft';
    assert.equal(current.content.body, native.body[key]);
    assert.equal(current.content.infographicAlt, native.infographicAlt[key]);
    for (const change of [
      { ...original, title: original.title + ' New source.' },
      { ...original, body: original.body + ' New source.' },
      { ...original, keyPoints: original.keyPoints.map((point: string, index: number) => index === 0 ? point + ' New source.' : point) },
      { ...original, infographicAlt: original.infographicAlt + ' New source.' },
      { ...original, quiz: original.quiz.map((question: any, index: number) => index === 0 ? { ...question, q: question.q + ' New condition.' } : question) },
      { ...original, quiz: original.quiz.map((question: any, index: number) => index === 0 ? { ...question, correct: 0 } : question) },
      { ...original, quiz: original.quiz.map((question: any, index: number) => index === 0 ? { ...question, rationale: question.rationale + ' New source.' } : question) },
      { ...original, quiz: original.quiz.map((question: any, index: number) => index === 0 ? { ...question, options: question.options.map((option: string, at: number) => at === 0 ? option + ' New source.' : option) } : question) },
    ]) {
      const fallback = resolveLearnerLessonPresentation(change, language);
      assert.equal(fallback.status, 'english-fallback');
      // The presentation intentionally carries learner text, not lesson id or image URL.
      // Compare every source content field, including unchanged assessment entries.
      assert.deepEqual(fallback.content, { title: change.title, body: change.body, keyPoints: change.keyPoints,
        quiz: change.quiz, infographicAlt: change.infographicAlt }, 'stale regional text must not survive changed canonical source/index');
    }
  }
});

test('Introduction module cards fail closed when their canonical metadata changes', () => {
  for (const language of ['ve', 'ts'] as const) {
    assert.equal(resolveCourseModulePresentation({ ...introFullCanonicalBefore, title: introFullCanonicalBefore.title + ' Changed.' }, language).status, 'english-fallback');
    assert.equal(resolveCourseModulePresentation({ ...introFullCanonicalBefore, description: introFullCanonicalBefore.description + ' Changed.' }, language).status, 'english-fallback');
  }
});

test('Introduction preserves explicit technical/timing/permission predicates and documents counted English-noun contexts', () => {
  const row = (language: IntroLanguage, slide: number, slot: string) => introFullPairedPacket.objects.find((item: any) =>
    item.path.includes('.' + language + '.') && item.slide === slide && item.targetSlot === slot);
  for (const language of ['ve', 'ts'] as const) {
    const permission = row(language, 7, 'body[1]');
    assert.ok(permission.originalSource.includes('If sharing is allowed and there is enough water'));
    assert.ok(permission.originalSource.includes('Watching the level alone does not make extra use safe or allowed.'));
    for (const anchor of ['People Care', 'Fair Share', 'Earth Care', 'borehole', 'safe']) assert.ok(permission.acceptedFinalTarget.includes(anchor));
    const management = row(language, 14, 'body[1]');
    for (const anchor of ['rotate through the beds', 'Fresh manure', 'germs', 'fertility']) assert.ok(management.acceptedFinalTarget.includes(anchor));
    assert.ok(management.proposedObject.segments.some((part: any) => part.sourceEnglish === 'rotate through the beds' && part.status === 'english-hold'));
    const leaving = row(language, 11, 'body[0]');
    assert.ok(leaving.proposedObject.segments.some((part: any) => part.sourceEnglish === 'before they leave your property.' && part.status === 'english-hold'));
    const ethics = row(language, 7, 'heading');
    assert.ok(ethics.EnglishPrecisionExceptions.some((exception: any) => exception.sourceMeaningUnit === 'Three Ethics' && exception.claimsEnglishTermTranslated === false),
      'postposed three stays in the whole formal-noun meaning unit, never silently omitted by segmentation');
  }
  assert.match(row('ts', 15, 'body[2]').acceptedFinalTarget, /kan’we kumbe kambirhi hi siku.*vhiki na vhiki/);
  assert.match(row('ts', 15, 'body[3]').acceptedFinalTarget, /nyingiso minkarhi yin’wana/);
  assert.match(row('ts', 19, 'body[2]').acceptedFinalTarget, /hundza hi le ka windbreak.*ehenhla ka yona kumbe.*makumu/);
});

test('Introduction protects all22 Sesotho stills and23 narration files, including the slide22 own-clip binding', () => {
  validateProtectedSTIntro();
  const records = introFullFixture('protected-st-intro.json');
  for (const path of ['public/course-decks/intro-permaculture/st/slide-22.webp', 'public/course-audio/intro-permaculture/st/slide-22.mp3']) {
    const record = records.find((row: any) => row.path === path);
    assert.ok(record);
    const bad = Buffer.from(readFileSync(new URL('../' + path, import.meta.url))); bad[bad.length - 1] ^= 1;
    assert.throws(() => verifyProtectedIntroAsset(record, bad), 'same-length protected-media mutation must be noticed');
  }
});
