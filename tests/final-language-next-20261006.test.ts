import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePairedDraft, englishSlideRecords } from '../scripts/paired-draft-slides.mjs';
import { finalLanguageNextPresentationBefore, finalLanguageNextPlan, readFinalLanguageNextInputs, validateFinalLanguageNextText, finalLanguageNextNativeBefore, finalLanguageNextDeckBefore } from './final-language-next-checks.ts';

test('final 48 regional fields retain canonical sources, full unlisted objects, quiz keys and protected ST recordings', () => {
  validateFinalLanguageNextText();
  for (const [file, deck] of Object.entries(readFinalLanguageNextInputs().paired)) {
    const module = file.split('/').pop()!.split('.')[0];
    validatePairedDraft(deck, englishSlideRecords(readFileSync(`docs/narration/${module}.en.md`, 'utf8')), (deck as any).language);
    finalLanguageNextDeckBefore(file, deck);
  }
  for (const module of Object.values(readFinalLanguageNextInputs().native)) finalLanguageNextNativeBefore(module);
});

test('source/modal/index/unlisted/status drift fails before exposing dated native or paired fixtures', () => {
  const fresh = readFinalLanguageNextInputs;
  const nativeFile = 'lib/course-translation-drafts-ts-vegetables-staples.ts';
  let input = fresh(); input.native[nativeFile].lessons[2].quiz[1].sourceCorrectIndex = 3;
  assert.throws(() => validateFinalLanguageNextText(input));
  input = fresh(); input.native[nativeFile].lessons[2].quiz[1].rationale.sourceEnglish += ' always';
  assert.throws(() => validateFinalLanguageNextText(input));
  input = fresh(); input.native[nativeFile].lessons[0].body.xitsongaDraft += ' unlisted';
  assert.throws(() => validateFinalLanguageNextText(input));
  assert.throws(() => finalLanguageNextNativeBefore(input.native[nativeFile]));
  const row = finalLanguageNextPlan.pairPlans.find((row: any) => row.file.includes('intro-permaculture.ts'));
  input = fresh(); const slide = input.paired[row.file].slides.find((slide: any) => slide.n === row.slide);
  slide.target.body[row.index].segments[1].text = 'further away than';
  assert.throws(() => validateFinalLanguageNextText(input));
  input = fresh(); input.paired[row.file].slides[0].target.heading.provenance += ' fluent';
  assert.throws(() => finalLanguageNextDeckBefore(row.file, input.paired[row.file]));
});

test('frequency/overlap and comparative sale-price precision remain disclosed instead of false identity drafts', () => {
  const rows = finalLanguageNextPlan.pairPlans;
  const intro = rows.filter((row: any) => row.file.includes('intro-permaculture') && row.slide === 22);
  assert.equal(intro.length, 2);
  // Root accepted VE's comparative after independent check; TS remains an exact scoped English hold.
  const tsIntro = intro.find((row: any) => row.file.includes('.ts.'));
  assert.ok(tsIntro.afterObject.segments.some((segment: any) => segment.status === 'english-hold' && segment.sourceEnglish === 'further away than' && !('text' in segment)));
  const veIntro = intro.find((row: any) => row.file.includes('.ve.'));
  assert.match(veIntro.target, /kule u fhira uri ni tshi shumisa kangani/);
  const overlap = rows.find((row: any) => row.file.includes('vegetables-staples.st') && row.slide === 2);
  assert.ok(overlap.afterObject.segments.some((segment: any) => segment.status === 'english-hold' && segment.sourceEnglish === 'Planting, tending and harvesting overlap.'));
  const sale = rows.find((row: any) => row.file.includes('market-community.ts') && row.slide === 11);
  assert.match(sale.target, /ku nga hlayisa swo tala swa nxavo wo xavisa/);
  assert.doesNotMatch(sale.target, /profit/);
});

test('dated presentation reconstruction rejects mutated current target, correct index and unlisted learner fields', () => {
  const lesson = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons[3];
  const current = resolveLearnerLessonPresentation(lesson, 'ts');
  const restored = finalLanguageNextPresentationBefore(current, lesson.id, 'ts');
  assert.notDeepEqual(restored.content.quiz, current.content.quiz);
  for (const mutate of [(shown: any) => shown.content.quiz[0].options[0] += ' always', (shown: any) => shown.content.quiz[0].correct = 0, (shown: any) => shown.content.keyPoints[0] += ' unlisted']) {
    const changed = structuredClone(current); mutate(changed);
    assert.throws(() => finalLanguageNextPresentationBefore(changed, lesson.id, 'ts'));
  }
  const changedSource = { ...lesson, body: lesson.body + ' changed source' };
  const fallback = resolveLearnerLessonPresentation(changedSource, 'ts');
  assert.equal(fallback.status, 'english-fallback');
  assert.deepEqual(finalLanguageNextPresentationBefore(fallback, lesson.id, 'ts'), fallback);
});
