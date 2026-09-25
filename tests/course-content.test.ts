// Guards over the optional visual-asset fields on Lesson (infographicUrl/Alt, videoUrl,
// relatedLessonIds) — see lib/course-modules.ts and docs/COURSE-VISUAL-ASSETS.md.
//
// These fields are free-form data added by hand, not generated, so nothing stops a typo'd
// lesson id or a missing alt text from being committed. This file is what catches that in CI
// instead of a farmer finding it as a dead button or a broken image on their phone.

import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES, LESSON_INDEX } from '../lib/course-modules.ts';
import { courseTranslationReviewState, isCourseTranslationLearnerReady, learnerLessonForLanguage, resolveLearnerLessonPresentation, type CourseTranslationRecord } from '../lib/course-localization.ts';
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';
import { COURSE_MODULE_TRANSLATION_DRAFTS, resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-st.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT, XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-st-water-harvesting.ts';

test('Sesotho and Xitsonga Introduction appear as labelled drafts only while their exact source and answers match', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'intro-permaculture')!;
  for (const [language, draft] of [
    ['st', SESOTHO_INTRO_PERMACULTURE_DRAFT],
    ['ts', XITSONGA_INTRO_PERMACULTURE_DRAFT],
  ] as const) {
    const modulePresentation = resolveCourseModulePresentation(sourceModule, language);
    assert.equal(modulePresentation.status, 'draft', language);
    assert.notEqual(modulePresentation.title, sourceModule.title, language);
    assert.equal(draft.lessons.length, sourceModule.lessons.length, language);
    for (const lesson of sourceModule.lessons) {
      const translation = draft.lessons.find(candidate => candidate.id === lesson.id)!;
      const presentation = resolveLearnerLessonPresentation(lesson, language);
      assert.equal(presentation.status, 'draft', `${language}: ${lesson.id}`);
      assert.equal(translation.body.sourceEnglish, lesson.body, `${language}: body source drift`);
      assert.equal(presentation.content.quiz.length, lesson.quiz.length, `${language}: quiz length`);
      assert.deepEqual(presentation.content.quiz.map(question => question.correct),
        lesson.quiz.map(question => question.correct), `${language}: answer order`);
      assert.equal(translation.keyPoints.length, lesson.keyPoints.length, `${language}: key points`);
      for (const [index, point] of translation.keyPoints.entries()) {
        assert.equal(point.sourceEnglish, lesson.keyPoints[index], `${language}: key point source drift`);
        if (point.reviewStatus === 'hold') {
          assert.equal(presentation.content.keyPoints[index], lesson.keyPoints[index], `${language}: held text remains English`);
        }
      }
      for (const [index, question] of translation.quiz.entries()) {
        assert.equal(question.question.sourceEnglish, lesson.quiz[index].q, `${language}: question source drift`);
        assert.equal(question.sourceCorrectIndex, lesson.quiz[index].correct, `${language}: answer source drift`);
        assert.equal(question.rationale.sourceEnglish, lesson.quiz[index].rationale, `${language}: rationale source drift`);
        assert.deepEqual(question.options.map(option => option.sourceEnglish), lesson.quiz[index].options,
          `${language}: option source drift`);
      }
      const changedSource = { ...lesson, body: `${lesson.body} Changed.` };
      assert.equal(resolveLearnerLessonPresentation(changedSource, language).status, 'english-fallback',
        `${language}: a changed farming source withdraws the whole draft`);
    }
    assert.equal(resolveCourseModulePresentation({ ...sourceModule, title: `${sourceModule.title} Changed.` }, language).status,
      'english-fallback', `${language}: changed module source withdraws its card draft`);
    const landscape = COURSE_MODULES.find(module => module.id === 'reading-landscape')!;
    assert.equal(resolveLearnerLessonPresentation(landscape.lessons[0], language).status,
      'draft', `${language}: later modules require their own source-paired draft`);
    assert.equal(resolveCourseModulePresentation(landscape, language).status,
      'draft', `${language}: module card follows its source-paired draft`);
  }
});

test('each regional Reading the Landscape lesson keeps its exact English source and held claims', () => {
  const module = COURSE_MODULES.find(item => item.id === 'reading-landscape')!;
  for (const [language, moduleDraft] of [
    ['st', SESOTHO_READING_LANDSCAPE_DRAFT],
    ['ts', XITSONGA_READING_LANDSCAPE_DRAFT],
  ] as const) {
    assert.equal(resolveCourseModulePresentation(module, language).status, 'draft', language);
    for (const lesson of module.lessons) {
      const draft = moduleDraft.lessons.find(item => item.id === lesson.id)!;
      const presentation = resolveLearnerLessonPresentation(lesson, language);
      assert.equal(presentation.status, 'draft', `${language}: ${lesson.id}`);
      assert.equal(draft.body.sourceEnglish, lesson.body, `${language}: ${lesson.id}`);
      assert.deepEqual(presentation.content.quiz.map(question => question.correct),
        lesson.quiz.map(question => question.correct), `${language}: ${lesson.id}`);
      assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} Changed.` }, language).status,
        'english-fallback', `${language}: ${lesson.id}: source drift withdraws the entire draft`);
      if (draft.infographicAlt) {
        assert.equal(resolveLearnerLessonPresentation({ ...lesson, infographicAlt: `${lesson.infographicAlt} Changed.` }, language).status,
          'english-fallback', `${language}: ${lesson.id}: changed visual teaching also withdraws the draft`);
      }
      for (const [index, point] of draft.keyPoints.entries()) {
        if (point.reviewStatus === 'hold') {
          assert.equal(presentation.content.keyPoints[index], lesson.keyPoints[index],
            `${language}: ${lesson.id}: uncertain wording must remain English`);
        }
      }
    }
  }
});

test('Sesotho Water Harvesting uses a source-paired learner draft and keeps unresolved water advice in English', () => {
  const module = COURSE_MODULES.find(item => item.id === 'water-harvesting')!;
  assert.equal(resolveCourseModulePresentation(module, 'st').status, 'draft');
  assert.equal(SESOTHO_WATER_HARVESTING_DRAFT.lessons.length, module.lessons.length);
  for (const lesson of module.lessons) {
    const draft = SESOTHO_WATER_HARVESTING_DRAFT.lessons.find(item => item.id === lesson.id)!;
    const presentation = resolveLearnerLessonPresentation(lesson, 'st');
    assert.equal(presentation.status, 'draft', lesson.id);
    assert.equal(draft.body.sourceEnglish, lesson.body, lesson.id);
    assert.deepEqual(presentation.content.quiz.map(question => question.correct),
      lesson.quiz.map(question => question.correct), lesson.id);
    assert.equal(resolveLearnerLessonPresentation({ ...lesson, body: `${lesson.body} Changed.` }, 'st').status,
      'english-fallback', `${lesson.id}: a changed water source withdraws the whole draft`);
    if (draft.body.reviewStatus === 'hold') {
      assert.equal(presentation.content.body, lesson.body, `${lesson.id}: held safety body stays English`);
    }
    for (const [index, question] of draft.quiz.entries()) {
      if (question.question.reviewStatus === 'hold') {
        assert.equal(presentation.content.quiz[index].q, lesson.quiz[index].q,
          `${lesson.id}: held safety quiz stays English`);
      }
    }
  }
  assert.equal(resolveCourseModulePresentation({ ...module, description: `${module.description} Changed.` }, 'st').status,
    'english-fallback', 'changed module description withdraws the card draft');
  assert.equal(resolveCourseModulePresentation(module, 'ts').status,
    'english-fallback', 'paused Xitsonga Water Harvesting keeps its English card');
  assert.equal(resolveLearnerLessonPresentation(module.lessons[0], 'ts').status,
    'english-fallback', 'paused Xitsonga Water Harvesting stays English');
});

test('every module id is unique', () => {
  const ids = COURSE_MODULES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate module id found in COURSE_MODULES');
});

test('every lesson id is unique across all modules', () => {
  const ids = COURSE_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  assert.equal(new Set(ids).size, ids.length, 'duplicate lesson id found across modules');
});

test('every existing lesson still satisfies the base shape after extending Lesson with optional fields', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      assert.equal(typeof lesson.id, 'string');
      assert.ok(lesson.id.length > 0, `${mod.id}: a lesson has an empty id`);
      assert.equal(typeof lesson.title, 'string');
      assert.ok(lesson.title.length > 0, `${lesson.id}: empty title`);
      assert.equal(typeof lesson.body, 'string');
      assert.ok(lesson.body.length > 0, `${lesson.id}: empty body`);
      assert.ok(Array.isArray(lesson.keyPoints), `${lesson.id}: keyPoints is not an array`);
      assert.ok(Array.isArray(lesson.quiz), `${lesson.id}: quiz is not an array`);
    }
  }
});

test('infographicUrl is always paired with a non-empty infographicAlt', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      if (lesson.infographicUrl) {
        assert.ok(
          lesson.infographicAlt && lesson.infographicAlt.trim().length > 0,
          `${lesson.id}: infographicUrl is set but infographicAlt is missing or empty`,
        );
      }
      if (lesson.infographicAlt) {
        assert.ok(
          lesson.infographicUrl,
          `${lesson.id}: infographicAlt is set with no infographicUrl for it to describe`,
        );
      }
    }
  }
});

test('no lesson lists itself in relatedLessonIds', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      assert.ok(
        !(lesson.relatedLessonIds ?? []).includes(lesson.id),
        `${lesson.id} lists itself in relatedLessonIds`,
      );
    }
  }
});

test('every relatedLessonIds entry resolves to a real lesson somewhere in COURSE_MODULES', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      for (const relatedId of lesson.relatedLessonIds ?? []) {
        assert.ok(
          LESSON_INDEX.has(relatedId),
          `${lesson.id} references a related lesson that does not exist: "${relatedId}"`,
        );
      }
    }
  }
});

test('relatedLessonIds has no duplicate entries within one lesson', () => {
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      const ids = lesson.relatedLessonIds ?? [];
      assert.equal(new Set(ids).size, ids.length, `${lesson.id}: duplicate id in relatedLessonIds`);
    }
  }
});

test('LESSON_INDEX contains exactly the real lessons, keyed by id, pointing at their owning module', () => {
  const allIds = COURSE_MODULES.flatMap((m) => m.lessons.map((l) => l.id));
  assert.equal(LESSON_INDEX.size, allIds.length);
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      const entry = LESSON_INDEX.get(lesson.id);
      assert.ok(entry, `LESSON_INDEX is missing ${lesson.id}`);
      assert.equal(entry.moduleId, mod.id);
      assert.equal(entry.lesson.id, lesson.id);
    }
  }
});

// ─── A synthetic fixture proves the guards above actually fire on bad data, not just pass ───
// vacuously on a real catalog that happens to set none of these optional fields yet.

test('the pairing and cross-link guards actually catch bad data (synthetic fixture)', () => {
  const badLessons = [
    { id: 'fx-1', title: 't', body: 'b', keyPoints: [], quiz: [], infographicUrl: '/x.jpg' }, // no alt
    { id: 'fx-2', title: 't', body: 'b', keyPoints: [], quiz: [], infographicAlt: 'alt only' }, // no url
    { id: 'fx-3', title: 't', body: 'b', keyPoints: [], quiz: [], relatedLessonIds: ['fx-3'] }, // self-reference
    { id: 'fx-4', title: 't', body: 'b', keyPoints: [], quiz: [], relatedLessonIds: ['nope-not-real'] }, // dangling
  ];
  const fixtureIndex = new Map(badLessons.map((l) => [l.id, l] as const));

  const pairingFailures = badLessons.filter(
    (l) => Boolean(l.infographicUrl) !== Boolean(l.infographicAlt),
  );
  assert.deepEqual(pairingFailures.map((l) => l.id).sort(), ['fx-1', 'fx-2'].sort());

  const selfRefFailures = badLessons.filter((l) => (l.relatedLessonIds ?? []).includes(l.id));
  assert.deepEqual(selfRefFailures.map((l) => l.id), ['fx-3']);

  const danglingFailures = badLessons.filter(
    (l) => (l.relatedLessonIds ?? []).some((id) => !fixtureIndex.has(id) && id !== l.id),
  );
  assert.deepEqual(danglingFailures.map((l) => l.id), ['fx-4']);
});

test('an isiZulu lesson cannot reach learners with missing review or a changed quiz answer', () => {
  const lesson = COURSE_MODULES[0].lessons[0];
  const published = {
    title: 'Reviewed title',
    body: 'Reviewed body',
    keyPoints: lesson.keyPoints.map((_, i) => `Reviewed point ${i}`),
    quiz: lesson.quiz.map((q, i) => ({
      q: `Reviewed question ${i}`,
      options: q.options.map((_, j) => `Reviewed option ${j}`),
      correct: q.correct,
      rationale: `Reviewed rationale ${i}`,
    })),
  };
  const record: CourseTranslationRecord = {
    lessonId: lesson.id,
    language: 'zu',
    status: 'published',
    published,
    approvals: [
      { reviewer: 'Language reviewer', role: 'fluent-isiZulu', reviewedAt: '2026-09-23', accepted: true },
      { reviewer: 'Farming reviewer', role: 'local-farming', reviewedAt: '2026-09-23', accepted: true },
    ],
  };

  assert.equal(learnerLessonForLanguage(lesson, 'zu', { ...record, approvals: [] }).title, lesson.title);
  assert.equal(learnerLessonForLanguage(lesson, 'zu', { ...record, status: 'review-draft' }).title, lesson.title);
  assert.equal(learnerLessonForLanguage(lesson, 'zu', {
    ...record, published: { ...published, quiz: published.quiz.map((q, i) => i === 0 ? { ...q, correct: (q.correct + 1) % q.options.length } : q) },
  }).title, lesson.title);
  assert.equal(isCourseTranslationLearnerReady(lesson, { ...record, published: { ...published, quiz: [] } }), false);
  assert.equal(isCourseTranslationLearnerReady(lesson, { ...record, lessonId: 'different-lesson' }), false);
  assert.equal(isCourseTranslationLearnerReady(lesson, record), true);
  assert.equal(learnerLessonForLanguage(lesson, 'zu', record).title, published.title);
});

test('owner-authorized isiZulu drafts remain labelled drafts after their English source is cleared', () => {
  const lessons = COURSE_MODULES.flatMap(module => module.lessons);
  const draftIds = lessons.filter(lesson => courseTranslationReviewState(lesson.id).status === 'review-draft').map(lesson => lesson.id);
  assert.ok(draftIds.includes('seeds-sovereignty-l1'), 'the authorized Seeds L1 packet is learner-visible as a labelled draft');
  assert.ok(draftIds.includes('seeds-sovereignty-l2'), 'the authorized Seeds L2 packet is learner-visible as a labelled draft');
  assert.ok(draftIds.includes('seeds-sovereignty-l3'), 'the authorized Seeds L3 packet is learner-visible as a labelled draft');
  for (const lessonId of ['plant-guilds-l1', 'plant-guilds-l2', 'plant-guilds-l3']) {
    assert.ok(draftIds.includes(lessonId), `${lessonId}: authorized Guilds packet is learner-visible as a labelled draft`);
    const lesson = lessons.find(item => item.id === lessonId)!;
    const presentation = resolveLearnerLessonPresentation(lesson, 'zu');
    assert.equal(presentation.status, 'draft', `${lessonId}: lesson must carry the unreviewed-draft label`);
    assert.deepEqual(presentation.content.quiz.map(question => question.correct), lesson.quiz.map(question => question.correct),
      `${lessonId}: draft must preserve every English answer index`);
  }
  assert.ok(draftIds.includes('soil-health-l3'), 'the corrected Soil Health L3 packet is learner-visible as a labelled draft');
  assert.deepEqual(Object.keys(COURSE_TRANSLATION_DRAFTS).sort(), draftIds.sort());
  const seedsL1 = lessons.find(lesson => lesson.id === 'seeds-sovereignty-l1')!;
  assert.match(seedsL1.keyPoints[2], /can support adaptation to climate change when varieties are suited to local conditions/,
    'the climate point describes conditional support for adaptation rather than guaranteed protection');
  assert.match(COURSE_TRANSLATION_DRAFTS[seedsL1.id].keyPoints[2], /kungasiza.*uma izinhlobo zifanele izimo zendawo/,
    'the isiZulu draft preserves the same conditional climate claim');
  const waterL4 = lessons.find(lesson => lesson.id === 'water-harvesting-l4')!;
  const waterL4Zu = resolveLearnerLessonPresentation(waterL4, 'zu');
  assert.equal(waterL4Zu.status, 'draft', 'the owner-authorized L4 draft stays visibly unreviewed');
  assert.equal(waterL4.infographicUrl, undefined, 'the old diagram cannot imply a safe direct washwater route');
  assert.match(waterL4.body, /If this advice is unavailable or unclear, do not reuse the water/);
  assert.match(waterL4Zu.content.body, /Uma lesi seluleko singatholakali noma singacacile, ungawasebenzisi kabusha amanzi/);
  assert.match(waterL4Zu.content.body, /Umhlabathi ne-mulch akuwabulali amagciwane/);
  assert.doesNotMatch(waterL4Zu.content.body, /izihlahla zezithelo|ngaphansi kwe-mulch azungeze isihlahla/i,
    'the new lesson cannot inherit the withdrawn fruit-tree reuse recipe');
  for (const lessonId of ['seeds-sovereignty-l2', 'seeds-sovereignty-l3']) {
    const lesson = lessons.find(item => item.id === lessonId)!;
    const draft = COURSE_TRANSLATION_DRAFTS[lessonId];
    const presentation = resolveLearnerLessonPresentation(lesson, 'zu');
    assert.equal(presentation.status, 'draft', `${lessonId}: lesson text must be labelled as an unreviewed draft`);
    assert.deepEqual(draft.quiz.map(question => question.correct), lesson.quiz.map(question => question.correct), `${lessonId}: answer indexes must stay fixed`);
    assert.equal(draft.keyPoints.length, lesson.keyPoints.length, `${lessonId}: all key points must be translated`);
    assert.equal(draft.quiz.length, lesson.quiz.length, `${lessonId}: all quiz questions must be translated`);
    assert.doesNotMatch(draft.body, /\b(?:Dry|Seed|Tomato|Maize|Store|Test)\b/, `${lessonId}: learner body must not fall back to English`);
  }
  assert.match(COURSE_TRANSLATION_DRAFTS['plant-guilds-l1'].body, /Lokhu kuthatha isikhathi/,
    'Guilds L1 keeps nutrient release gradual instead of promising an immediate transfer');
  assert.match(COURSE_TRANSLATION_DRAFTS['plant-guilds-l2'].body, /I-Bocking 14 ayisakazeki ngembewu ekwazi ukuhluma, kodwa izingcezu zezimpande zingaphinde zikhule/,
    'Guilds L2 preserves the cultivar-specific seed and root-fragment distinction');
  assert.match(COURSE_TRANSLATION_DRAFTS['plant-guilds-l3'].body, /akukuqedi ngokushesha ukuncintisana kwezimpande/,
    'Guilds L3 does not promise that thinning instantly ends root competition');
  assert.match(COURSE_TRANSLATION_DRAFTS['intro-permaculture-l1'].body, /\n\n/,
    'long isiZulu body paragraphs must remain separated for low-literacy reading');

  const soilHealthL3 = COURSE_TRANSLATION_DRAFTS['soil-health-l3'];
  assert.match(soilHealthL3.body, /Uma imvula ishaya i-mulch .* ingxenye enkulu yamandla amaconsi emvula ingadamba/,
    'the mulch claim stays conditional on rain hitting the cover');
  assert.match(soilHealthL3.body, /Uma amanzi egeleza phezu kwensimu, angathwala umhlabathi osuxegisiwe/,
    'the spring rain passage separates soil impact from conditional runoff transport');
  assert.match(soilHealthL3.body, /Uketshezi oluphuma ngokwemvelo emgqonyeni wezikelemu lubizwa nge-leachate/,
    'leachate means natural liquid drainage from a worm bin');
  assert.match(soilHealthL3.body, /Ungayisebenzisi ezitshalweni ezidliwayo/,
    'the translated leachate warning keeps it off edible plants');
  assert.match(soilHealthL3.body, /zingasiza ukugcina umhlabathi endaweni yawo/,
    'cover crops, mulch and organic matter are described as helping to hold soil');

  for (const lesson of lessons) {
    const presentation = resolveLearnerLessonPresentation(lesson, 'zu');
    if (courseTranslationReviewState(lesson.id).status === 'review-draft') {
      assert.equal(presentation.status, 'draft', lesson.id);
      assert.equal(presentation.content.quiz.length, lesson.quiz.length, lesson.id);
      assert.deepEqual(presentation.content.quiz.map(q => q.correct), lesson.quiz.map(q => q.correct), lesson.id);
      assert.ok(presentation.content.body.trim().length > 0, lesson.id);
      const learnerText = [presentation.content.title, presentation.content.body, ...presentation.content.keyPoints,
        ...presentation.content.quiz.flatMap(q => [q.q, ...q.options, q.rationale])].join('\n');
      assert.doesNotMatch(learnerText, /\[HELD:|\*\*Explicit source holds:|NOT APPROVED|NOT FOR LEARNER USE/i,
        `${lesson.id}: editorial review instructions must not appear as learner text`);
    } else {
      assert.equal(presentation.status, 'english-fallback', lesson.id);
      assert.equal(presentation.content.body, lesson.body, lesson.id);
    }
  }

  for (const heldId of ['small-livestock-l2']) {
    const lesson = lessons.find(item => item.id === heldId)!;
    assert.equal(resolveLearnerLessonPresentation(lesson, 'zu', {
      lessonId: heldId, language: 'zu', status: 'review-draft', draft: COURSE_TRANSLATION_DRAFTS[draftIds[0]],
    }).status, 'english-fallback', `${heldId} must stay held even if draft data is passed`);
  }
});

test('an incomplete or answer-shifted isiZulu draft falls back to English', () => {
  const lesson = COURSE_MODULES.flatMap(module => module.lessons).find(item => item.id === 'intro-permaculture-l1')!;
  const draft = COURSE_TRANSLATION_DRAFTS[lesson.id];
  const base: CourseTranslationRecord = { lessonId: lesson.id, language: 'zu', status: 'review-draft', draft };
  assert.equal(resolveLearnerLessonPresentation(lesson, 'zu', { ...base, draft: { ...draft, keyPoints: [] } }).status, 'english-fallback');
  assert.equal(resolveLearnerLessonPresentation(lesson, 'zu', {
    ...base, draft: { ...draft, quiz: draft.quiz.map((question, index) => index === 0
      ? { ...question, correct: (question.correct + 1) % question.options.length } : question) },
  }).status, 'english-fallback');
  assert.equal(resolveLearnerLessonPresentation(lesson, 'en').content.body, lesson.body);
});

test('isiZulu core module card drafts stay paired with exact English source and disclose their status', () => {
  assert.equal(Object.keys(COURSE_MODULE_TRANSLATION_DRAFTS).length, 10);
  const moduleIds = new Set(COURSE_MODULES.map(module => module.id));
  assert.deepEqual(Object.keys(COURSE_MODULE_TRANSLATION_DRAFTS).sort(), [...moduleIds].sort());

  for (const module of COURSE_MODULES) {
    const draft = COURSE_MODULE_TRANSLATION_DRAFTS[module.id as keyof typeof COURSE_MODULE_TRANSLATION_DRAFTS];
    const presentation = resolveCourseModulePresentation(module, 'zu');
    assert.ok(draft, `${module.id}: missing core card draft`);
    assert.equal(module.title, draft.sourceTitle, `${module.id}: source title changed; draft must be rechecked`);
    assert.equal(module.description, draft.sourceDescription, `${module.id}: source description changed; draft must be rechecked`);
    assert.equal(presentation.status, 'draft', module.id);
    assert.equal(presentation.title, draft.title, module.id);
    assert.equal(presentation.description, draft.description, module.id);
    assert.ok(presentation.title.trim().length > 0 && presentation.description.trim().length > 0, module.id);
    assert.equal(resolveCourseModulePresentation(module, 'en').title, module.title, module.id);
  }

  const changedSource = { ...COURSE_MODULES[0], description: `${COURSE_MODULES[0].description} Changed.` };
  assert.deepEqual(resolveCourseModulePresentation(changedSource, 'zu'), {
    title: changedSource.title,
    description: changedSource.description,
    status: 'english-fallback',
  });
  const reserveCourse = { ...COURSE_MODULES[0], id: 'farm-finance' };
  assert.equal(resolveCourseModulePresentation(reserveCourse, 'zu').status, 'english-fallback');
});
