import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
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

test('Introduction field and wind-direction advice stay exact English until Tshivenda review', async () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === TSHIVENDA_INTRO_PERMACULTURE_DRAFT.id);
  assert.ok(sourceModule);
  const sourceLesson = sourceModule.lessons.find(lesson => lesson.id === 'intro-permaculture-l3');
  const draftLesson = TSHIVENDA_INTRO_PERMACULTURE_DRAFT.lessons.find(lesson => lesson.id === 'intro-permaculture-l3');
  assert.ok(sourceLesson);
  assert.ok(draftLesson);

  assert.equal(draftLesson.body.reviewStatus, 'hold');
  assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body);
  assert.equal(draftLesson.body.tshivendaDraft, sourceLesson.body,
    'field observations and practical wind or water instructions must not leak unreviewed wording');

  const sourceWindQuestion = sourceLesson.quiz[1];
  const draftWindQuestion = draftLesson.quiz[1];
  assert.equal(draftWindQuestion.sourceCorrectIndex, sourceWindQuestion.correct,
    'keep the canonical answer key while holding wind-direction wording');
  for (const [name, pair, source] of [
    ['question', draftWindQuestion.question, sourceWindQuestion.q],
    ...draftWindQuestion.options.map((option, index) => [`option ${index}`, option, sourceWindQuestion.options[index]] as const),
    ['rationale', draftWindQuestion.rationale, sourceWindQuestion.rationale],
  ] as const) {
    assert.equal(pair.reviewStatus, 'hold', `${name}: direction-dependent quiz wording stays held`);
    assert.equal(pair.sourceEnglish, source, `${name}: exact canonical English source remains paired`);
    assert.equal(pair.tshivendaDraft, source, `${name}: no unreviewed compass-direction wording is shown`);
  }

  const { resolveLearnerLessonPresentation } = await import('../lib/course-localization.ts');
  const presentation = resolveLearnerLessonPresentation(sourceLesson, 've');
  assert.equal(presentation.content.body, sourceLesson.body);
  assert.deepEqual(presentation.content.quiz[1], sourceLesson.quiz[1]);
  assert.equal(presentation.status, 'draft', 'other existing Tshivenda lesson fields remain visibly labelled drafts');

  const changedSource = { ...sourceLesson, body: `${sourceLesson.body}\nChanged English source.` };
  const staleDraft = resolveLearnerLessonPresentation(changedSource, 've');
  assert.equal(staleDraft.status, 'english-fallback', 'source drift must hide the complete stale lesson draft');
  assert.equal(staleDraft.content.body, changedSource.body);
  assert.deepEqual(staleDraft.content.quiz, changedSource.quiz);
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

test('Vegetables L3 shows eight bounded concept sentences and keeps farming answers in English', async () => {
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
  assert.equal(vegetablesL3Draft.additionalBodyConcepts.length, 6);
  assert.equal(draftLesson.body.sourceEnglish, lesson.body, 'source drift must invalidate the entire learner draft');
  assert.equal(draftLesson.body.reviewStatus, 'machine-draft');
  const shown = resolveLearnerLessonPresentation(lesson, 've');
  assert.equal(shown.status, 'draft');
  const translated = shown.content.body.split('\n\n');
  assert.equal(translated.length, paragraphs.length);
  assert.equal(translated[0], vegetablesL3Draft.bodyConcept.tshivendaDraft);
  assert.equal(translated[vegetablesL3Draft.secondBodyConcept.paragraphIndex], vegetablesL3Draft.secondBodyConcept.tshivendaDraft);
  const expectedParagraphs = [...paragraphs];
  expectedParagraphs[vegetablesL3Draft.bodyConcept.paragraphIndex] = vegetablesL3Draft.bodyConcept.tshivendaDraft;
  expectedParagraphs[vegetablesL3Draft.secondBodyConcept.paragraphIndex] = vegetablesL3Draft.secondBodyConcept.tshivendaDraft;
  for (const concept of vegetablesL3Draft.additionalBodyConcepts) {
    assert.equal(paragraphs[concept.paragraphIndex].split(concept.sourceEnglish).length - 1, 1,
      `source paragraph ${concept.paragraphIndex + 1}: selected sentence occurs once`);
    expectedParagraphs[concept.paragraphIndex] = expectedParagraphs[concept.paragraphIndex]
      .replace(concept.sourceEnglish, concept.tshivendaDraft);
  }
  assert.deepEqual(translated, expectedParagraphs,
    'preserve both existing drafts and every other body sentence exactly, including counts and crop guidance');
  assert.equal(translated[2],
    'Tshiḽiwa tshithihi tsha vhuthogwa tshi ni sia ni vulnerable. Two or more give you options when weather or pests hit.',
    'translate only the first paragraph-3 sentence; preserve the count-based benefit in English');
  assert.equal(translated[14], paragraphs[14], 'keep the two-or-more staples benefit in English');
  assert.equal(translated[15], paragraphs[15], 'keep water, soil, seasons and protection claims in English');
  paragraphs.forEach((paragraph, index) => {
    if (![0, 1, 2, 11, 12, 13].includes(index)) {
      assert.equal(translated[index], paragraph, `paragraph ${index + 1} stays English`);
    }
  });
  assert.equal(shown.content.title, lesson.title);
  assert.equal(shown.content.infographicAlt, lesson.infographicAlt);
  assert.deepEqual(shown.content.keyPoints, lesson.keyPoints);
  assert.deepEqual(shown.content.quiz, lesson.quiz, 'quiz wording, order, rationales and correct indexes stay exact English');
  assert.equal(learnerVegetablesDraft.title.sourceEnglish, module.title);
  assert.equal(learnerVegetablesDraft.description.sourceEnglish, module.description);
  assert.equal(learnerVegetablesDraft.sourceMetadata.durationMins, module.durationMins);
  assert.equal(learnerVegetablesDraft.sourceMetadata.category, module.category);
  const card = resolveCourseModulePresentation(module, 've');
  assert.equal(card.status, 'english-fallback');
  assert.equal(card.title, module.title);
  assert.equal(card.description, module.description);
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
