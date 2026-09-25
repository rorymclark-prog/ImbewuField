import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Tshivenda Study controls match their review pairs and sensitive controls stay English', async () => {
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
    ['studentLocked', 'Locked'],
  ] as const) {
    assert.ok(!new RegExp(`\\b${key}:`).test(ve), `${key}: do not introduce an unreviewed completion, submission or access translation`);
    assert.ok(english.includes(`${key}: '${expectedEnglish}'`), `${key}: preserve the exact English fallback`);
  }
  assert.ok(english.includes('return LOADED[lang]?.[key] ?? LOADED.en[key] ?? key;'), 'missing Tshivenda keys must fall back to English');
});
