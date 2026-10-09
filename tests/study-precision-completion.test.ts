import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';
import { TSHIVENDA_INTRO_PERMACULTURE_DRAFT } from '../lib/course-translation-drafts-ve.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { precisionBefore, precisionNativeBefore, precisionSourceBytesBefore } from './study-precision-history-checks.ts';

test('young pawpaw and sun hours keep source answers and every unlisted draft intact', () => {
  assert.deepEqual(precisionNativeBefore('zu', COURSE_TRANSLATION_DRAFTS), precisionBefore.zu);
  assert.deepEqual(precisionNativeBefore('ve', TSHIVENDA_INTRO_PERMACULTURE_DRAFT), precisionBefore.ve);
  const lesson = COURSE_MODULES.flatMap(m => m.lessons).find(l => l.id === 'reading-landscape-l2')!;
  const displayed = resolveLearnerLessonPresentation(lesson, 'zu');
  assert.equal(displayed.status, 'draft');
  assert.match(displayed.content.quiz[0].q, /esisencane/);
  assert.doesNotMatch(displayed.content.quiz[0].q, /esincane/);
  assert.match(displayed.content.quiz[1].rationale, /amahora elanga/);
  assert.deepEqual(displayed.content.quiz.map(q => q.correct), lesson.quiz.map(q => q.correct));
});

test('design and waste loop repair preserves twelve principles without invented fruit', () => {
  const alt = TSHIVENDA_INTRO_PERMACULTURE_DRAFT.lessons[1].infographicAlt;
  assert.ok(alt);
  assert.match(alt.tshivendaDraft, /Maitele a fumi na mavhili a design/);
  assert.match(alt.tshivendaDraft, /around a central seedling/);
  assert.match(alt.tshivendaDraft, /loop for returning waste/);
  assert.doesNotMatch(alt.tshivendaDraft, /mitshelo/);
  assert.equal(alt.reviewStatus, 'machine-draft');
  const source = COURSE_MODULES.flatMap(m => m.lessons).find(l => l.id === 'intro-permaculture-l2')!;
  assert.equal(alt.sourceEnglish, source.infographicAlt);
  const shown = resolveLearnerLessonPresentation(source, 've');
  assert.equal(shown.status, 'draft');
  assert.equal(shown.content.infographicAlt, alt.tshivendaDraft);
  const changed = { ...source, infographicAlt: source.infographicAlt + ' New diagram.' };
  const fallback = resolveLearnerLessonPresentation(changed, 've');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.infographicAlt, changed.infographicAlt);
});

test('changed Reading question source withdraws the draft rather than using stale age wording', () => {
  const source = COURSE_MODULES.flatMap(m => m.lessons).find(l => l.id === 'reading-landscape-l2')!;
  const changed = structuredClone(source);
  changed.quiz[0].q += ' Changed source.';
  const displayed = resolveLearnerLessonPresentation(changed, 'zu');
  assert.equal(displayed.status, 'english-fallback');
  assert.equal(displayed.content.quiz[0].q, changed.quiz[0].q);
});

test('complete precision guard rejects source, answer, status and unrelated wording drift', () => {
  for (const mutate of [
    (d: any) => { d.lessons[1].infographicAlt.sourceEnglish += '!'; },
    (d: any) => { d.lessons[1].quiz[0].sourceCorrectIndex = 99; },
    (d: any) => { d.lessons[1].infographicAlt.reviewStatus = 'hold'; },
    (d: any) => { d.lessons[0].body.tshivendaDraft += '!'; },
  ]) {
    const changed = structuredClone(TSHIVENDA_INTRO_PERMACULTURE_DRAFT);
    mutate(changed);
    assert.throws(() => precisionNativeBefore('ve', changed));
  }
  const file = 'lib/course-translation-drafts-ve.ts';
  assert.throws(() => precisionSourceBytesBefore(file, readFileSync(file, 'utf8') + '\n'));
  const binary = Buffer.from([0, 255, 128]);
  assert.equal(precisionSourceBytesBefore('unrelated.webp', binary), binary);
});
