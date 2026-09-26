import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT as vegetablesL3Draft } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';

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
      assert.match(pair.tshivendaDraft, /\(maize\)/i, `${path}: retain source crop identity in translated text`);
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

test('Vegetables L3 Tshivenda review data pairs one concept sentence and keeps practical text held', async () => {
  const module = COURSE_MODULES.find(candidate => candidate.id === vegetablesL3Draft.moduleId);
  assert.ok(module, 'the review pair must point to a canonical module');
  const lesson = module.lessons.find(candidate => candidate.id === vegetablesL3Draft.lessonId);
  assert.ok(lesson, 'the review pair must point to the canonical Vegetables L3 lesson');

  assert.equal(vegetablesL3Draft.language, 've');
  assert.equal(vegetablesL3Draft.reviewStatus, 'machine-draft');
  assert.equal(vegetablesL3Draft.bodyConcept.reviewStatus, 'machine-draft');
  assert.equal(vegetablesL3Draft.bodyConcept.sourceEnglish,
    lesson.body.split('\n\n')[vegetablesL3Draft.bodyConcept.paragraphIndex],
    'the English source must exactly match the selected canonical paragraph');
  assert.ok(vegetablesL3Draft.bodyConcept.tshivendaDraft.trim(), 'the review packet needs its marked draft text');
  assert.match(vegetablesL3Draft.bodyConcept.tshivendaDraft, /\[staple\]/,
    'retain the uncertain food-security term in English inside the machine draft');
  assert.doesNotMatch(vegetablesL3Draft.bodyConcept.tshivendaDraft, /\d|maize|beans|sweet potato|amadumbe/i,
    'the concept draft must not add figures or crop/species names');

  assert.deepEqual(vegetablesL3Draft.exactEnglishHoldPaths, [
    'title',
    'infographicAlt',
    'body paragraphs 2 onward',
    'keyPoints',
    'quiz questions, options, and rationales',
  ]);
  assert.equal(lesson.title, 'Staple Crops: Maize, Beans, and Root Vegetables');
  assert.equal(lesson.keyPoints.length, 4);
  assert.equal(lesson.quiz.length, 2);
  assert.deepEqual(lesson.quiz.map(question => question.correct), [1, 1]);

  const { readFileSync } = await import('node:fs');
  const localization = readFileSync(new URL('../lib/course-localization.ts', import.meta.url), 'utf8');
  const moduleDrafts = readFileSync(new URL('../lib/course-module-translation-drafts.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(localization, /TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT/,
    'review data must not appear in learner lesson wiring');
  assert.doesNotMatch(moduleDrafts, /TSHIVENDA_VEGETABLES_STAPLES_L3_REVIEW_DRAFT/,
    'review data must not appear in learner module-card wiring');

  const packet = readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-STAPLES-L3-VE-AI-DRAFT-REVIEW.md', import.meta.url), 'utf8');
  assert.ok(packet.includes(vegetablesL3Draft.bodyConcept.sourceEnglish), 'the review packet must show the exact source');
  assert.ok(packet.includes(vegetablesL3Draft.bodyConcept.tshivendaDraft), 'the review packet must show the exact machine draft');
  assert.match(packet, /not wired into Study and not learner-visible/);
});
