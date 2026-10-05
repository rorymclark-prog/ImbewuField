import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import {
  courseTranslationReviewState,
  resolveLearnerLessonPresentation,
  type LocalizedLessonContent,
  type CourseTranslationRecord,
} from '../lib/course-localization.ts';
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';
import { ISIZULU_REVIEW_DRAFT_SOURCE_SNAPSHOTS } from '../lib/course-translation-draft-sources-zu.ts';
import { SESOTHO_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-st.ts';
import { XITSONGA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';

const allLessons = COURSE_MODULES.flatMap(module => module.lessons);
const checkedZuluLessons = allLessons.filter(lesson => courseTranslationReviewState(lesson.id).status === 'review-draft');

function sourceContent(lesson: typeof allLessons[number]): LocalizedLessonContent {
  return {
    title: lesson.title,
    body: lesson.body,
    keyPoints: lesson.keyPoints,
    quiz: lesson.quiz,
    infographicAlt: lesson.infographicAlt,
  };
}

test('all 33 checked isiZulu lessons are bound to their complete canonical English source snapshots', () => {
  assert.equal(checkedZuluLessons.length, 33);
  assert.deepEqual(Object.keys(ISIZULU_REVIEW_DRAFT_SOURCE_SNAPSHOTS).sort(),
    checkedZuluLessons.map(lesson => lesson.id).sort(),
    'source snapshots must cover every checked draft and no unrelated lesson');
  assert.deepEqual(Object.keys(COURSE_TRANSLATION_DRAFTS).sort(),
    checkedZuluLessons.map(lesson => lesson.id).sort(),
    'the checked-in proposal set remains aligned with checked draft state');

  for (const lesson of checkedZuluLessons) {
    const expected = {
      lessonId: lesson.id,
      title: lesson.title,
      body: lesson.body,
      keyPoints: lesson.keyPoints,
      quiz: lesson.quiz.map(({ q, options, correct, rationale }) => ({ q, options, correct, rationale })),
      infographicAlt: lesson.infographicAlt ?? null,
    };
    assert.deepEqual(ISIZULU_REVIEW_DRAFT_SOURCE_SNAPSHOTS[lesson.id], expected, `${lesson.id}: exact source snapshot`);
    const shown = resolveLearnerLessonPresentation(lesson, 'zu');
    assert.equal(shown.status, 'draft', `${lesson.id}: exact source enables the visibly unreviewed draft`);
    assert.deepEqual(shown.content, COURSE_TRANSLATION_DRAFTS[lesson.id], `${lesson.id}: resolver uses checked-in ZU proposal`);
    assert.deepEqual(shown.content.quiz.map(question => question.correct), lesson.quiz.map(question => question.correct),
      `${lesson.id}: source answer positions are retained`);
  }
});

test('any changed ZU source field withdraws the entire lesson to current English', () => {
  const lesson = checkedZuluLessons.find(item => item.id === 'intro-permaculture-l1')!;
  const changed = [
    ['title', { ...lesson, title: `${lesson.title} changed` }],
    ['body wording', { ...lesson, body: lesson.body.replace('Permaculture rests', 'Permaculture stands') }],
    ['body paragraph order/count', { ...lesson, body: `${lesson.body}\n\nAdditional source paragraph.` }],
    ['body same-count paragraph order', { ...lesson, body: lesson.body.split('\n\n').reverse().join('\n\n') }],
    ['key point wording', { ...lesson, keyPoints: lesson.keyPoints.map((point, i) => i === 0 ? `${point} changed` : point) }],
    ['key point order', { ...lesson, keyPoints: [...lesson.keyPoints].reverse() }],
    ['key point count', { ...lesson, keyPoints: lesson.keyPoints.slice(1) }],
    ['quiz question wording', { ...lesson, quiz: lesson.quiz.map((question, i) => i === 0 ? { ...question, q: `${question.q} changed` } : question) }],
    ['quiz question order', { ...lesson, quiz: [...lesson.quiz].reverse() }],
    ['quiz option wording', { ...lesson, quiz: lesson.quiz.map((question, i) => i === 0 ? { ...question, options: question.options.map((option, j) => j === 0 ? `${option} changed` : option) } : question) }],
    ['quiz option order', { ...lesson, quiz: lesson.quiz.map((question, i) => i === 0 ? { ...question, options: [...question.options].reverse() } : question) }],
    ['correct answer index', { ...lesson, quiz: lesson.quiz.map((question, i) => i === 0 ? { ...question, correct: (question.correct + 1) % question.options.length } : question) }],
    ['quiz rationale', { ...lesson, quiz: lesson.quiz.map((question, i) => i === 0 ? { ...question, rationale: `${question.rationale} changed` } : question) }],
    ['quiz question count', { ...lesson, quiz: lesson.quiz.slice(1) }],
    ['infographic alt edit', { ...lesson, infographicAlt: `${lesson.infographicAlt} changed` }],
  ] as const;

  for (const [field, source] of changed) {
    const shown = resolveLearnerLessonPresentation(source, 'zu');
    assert.equal(shown.status, 'english-fallback', `${field}: stale draft is withdrawn`);
    assert.deepEqual(shown.content, sourceContent(source), `${field}: every field comes from the changed English lesson`);
  }

  const lessonWithoutAlt = checkedZuluLessons.find(item => item.infographicAlt === undefined)!;
  const addedAlt = { ...lessonWithoutAlt, infographicAlt: 'New source alt text.' };
  const shown = resolveLearnerLessonPresentation(addedAlt, 'zu');
  assert.equal(shown.status, 'english-fallback', 'adding a previously absent alt field also invalidates the full lesson draft');
  assert.deepEqual(shown.content, sourceContent(addedAlt));
});

test('a caller cannot replace a checked isiZulu draft with arbitrary complete text', () => {
  const lesson = checkedZuluLessons.find(item => item.id === 'intro-permaculture-l1')!;
  const registered = COURSE_TRANSLATION_DRAFTS[lesson.id];
  const base: CourseTranslationRecord = { lessonId: lesson.id, language: 'zu', status: 'review-draft', draft: registered };
  const exactClone = structuredClone(registered);
  assert.equal(resolveLearnerLessonPresentation(lesson, 'zu', { ...base, draft: exactClone }).status, 'draft',
    'an exact deep clone of the checked-in proposal remains compatible');
  assert.deepEqual(resolveLearnerLessonPresentation(lesson, 'zu', { ...base, draft: exactClone }).content, registered);

  const injected = { ...registered, title: 'Injected complete proposal' };
  const rejected = resolveLearnerLessonPresentation(lesson, 'zu', { ...base, draft: injected });
  assert.equal(rejected.status, 'english-fallback', 'same lesson ID and complete shape do not authorize caller text');
  assert.deepEqual(rejected.content, sourceContent(lesson));

  const malformed = { ...registered, keyPoints: undefined } as unknown as LocalizedLessonContent;
  const malformedResult = resolveLearnerLessonPresentation(lesson, 'zu', { ...base, draft: malformed });
  assert.equal(malformedResult.status, 'english-fallback', 'incomplete caller shapes fail closed without throwing');
  assert.deepEqual(malformedResult.content, sourceContent(lesson));
  for (const malformedDraft of [
    { ...registered, quiz: undefined },
    { ...registered, quiz: registered.quiz.map((question, i) => i === 0 ? { ...question, options: undefined } : question) },
  ]) {
    const result = resolveLearnerLessonPresentation(lesson, 'zu', {
      ...base, draft: malformedDraft as unknown as LocalizedLessonContent,
    });
    assert.equal(result.status, 'english-fallback', 'malformed question/options arrays withdraw the draft without throwing');
    assert.deepEqual(result.content, sourceContent(lesson));
  }
});

test('source pairing leaves approved isiZulu and the other regional resolver paths intact', () => {
  const lesson = checkedZuluLessons.find(item => item.id === 'intro-permaculture-l1')!;
  const approved: LocalizedLessonContent = {
    title: 'Approved title', body: 'Approved body', keyPoints: lesson.keyPoints.map((_, i) => `Approved point ${i}`),
    quiz: lesson.quiz.map(question => ({ q: 'Approved question', options: question.options.map((_, i) => `Approved option ${i}`), correct: question.correct, rationale: 'Approved rationale' })),
    infographicAlt: lesson.infographicAlt,
  };
  const record: CourseTranslationRecord = {
    lessonId: lesson.id, language: 'zu', status: 'published', published: approved,
    approvals: [
      { reviewer: 'fluent reviewer', role: 'fluent-isiZulu', reviewedAt: '2026-01-01', accepted: true },
      { reviewer: 'local reviewer', role: 'local-farming', reviewedAt: '2026-01-01', accepted: true },
    ],
  };
  assert.deepEqual(resolveLearnerLessonPresentation(lesson, 'zu', record), { content: approved, status: 'approved' });

  for (const [language, draft] of [
    ['st', SESOTHO_INTRO_PERMACULTURE_DRAFT],
    ['ts', XITSONGA_INTRO_PERMACULTURE_DRAFT],
    ['ve', TSHIVENDA_INTRO_PERMACULTURE_DRAFT],
  ] as const) {
    const shown = resolveLearnerLessonPresentation(lesson, language);
    const sourceDraft = draft.lessons.find(item => item.id === lesson.id)!;
    assert.equal(shown.status, 'draft', `${language}: regional draft remains available`);
    const expectedBody = 'sesothoDraft' in sourceDraft.body ? sourceDraft.body.sesothoDraft
      : 'xitsongaDraft' in sourceDraft.body ? sourceDraft.body.xitsongaDraft : sourceDraft.body.tshivendaDraft;
    assert.equal(shown.content.body, expectedBody);
  }
  assert.equal(resolveLearnerLessonPresentation(lesson, 'en').content.body, lesson.body);
});

test('Student shows English source panels only for source-paired drafts', () => {
  const page = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /const isiZuluDraft = lang === 'zu' && presentation\.status === 'draft';/);
  assert.match(page, /const sourcePairedDraft = regionalDraft \|\| isiZuluDraft;/);
  assert.match(page, /sourcePairedDraft && lessonContent\.body === lesson\.body/);
  assert.match(page, /sourcePairedDraft && <div lang="en"[\s\S]*?Exact English source/,
    'translated ZU body is paired with the complete exact English source');
  assert.match(page, /sourcePairedDraft && kp !== lesson\.keyPoints\[i\]/,
    'a localized ZU key point shows its exact English counterpart');
  assert.match(page, /englishSource=\{sourcePairedDraft \? lesson\.quiz\[i\] : undefined\}/,
    'question, ordered options, and rationale receive the matching English source');
  assert.match(page, /lang === 'zu' \? 'isiZulu' : 'Tshivenda'/,
    'a ZU infographic description is labelled with the correct language and source');
  assert.match(page, /lang === 'zu' && presentation\.status === 'draft'[\s\S]*?studentZuluLessonDraftNotice/,
    'the existing truthful unreviewed ZU notice remains visible');
  assert.match(page, /Exact English source is shown alongside the lesson and answers/);
  assert.match(page, /The isiZulu draft has not received fluent-speaker or local-farming approval/);
  assert.match(page, /lang === 'zu' && presentation\.status === 'english-fallback'[\s\S]*?studentZuluLessonEnglishFallbackNotice/,
    'a withdrawn draft shows the English fallback notice rather than draft source panels');
  assert.match(page, /its checked English source no longer matches the current lesson/);
  assert.match(page, /IsiZulu audio, if available, does not mean the lesson text or questions have been reviewed/);
});
