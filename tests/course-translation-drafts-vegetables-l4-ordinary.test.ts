import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';

const evidence = (name: string) => JSON.parse(readFileSync(
  new URL(`../docs/study-translation-reviews/VEGETABLES-L4-ORDINARY-2026-10-05-${name}.json`, import.meta.url), 'utf8'));
const baseline = evidence('BASELINE');
const applied = evidence('APPLIED');
const deckAccepted = evidence('DECK-ACCEPTED');
const l2Applied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L2-FULLER-ORDINARY-2026-10-05-APPLIED.json', import.meta.url), 'utf8'));
const l2DeckApplied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L2-FULLER-ORDINARY-2026-10-05-DECK-APPLIED.json', import.meta.url), 'utf8'));
const drafts = { st, ve, ts } as const;
const targetKey = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
type Language = keyof typeof drafts;
const canonicalModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const canonicalLesson = canonicalModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l4')!;

function pairAt(draft: any, fieldPath: string, lessonId = 'vegetables-staples-l4'): any {
  const lesson = draft.lessons.find((item: any) => item.id === lessonId);
  const parts = fieldPath.split('.');
  if (parts[0] === 'body') return lesson.body;
  if (parts[0] === 'keyPoints') return lesson.keyPoints[Number(parts[1])];
  if (parts[0] === 'quiz') {
    const question = lesson.quiz[Number(parts[1])];
    return parts[2] === 'options' ? question.options[Number(parts[3])] : question[parts[2] === 'q' ? 'question' : parts[2]];
  }
  throw new Error(`Unsupported field path: ${fieldPath}`);
}

function canonicalSource(fieldPath: string): string {
  const parts = fieldPath.split('.');
  if (parts[0] === 'body') return canonicalLesson.body.split('\n\n')[Number(parts[2])];
  if (parts[0] === 'keyPoints') return canonicalLesson.keyPoints[Number(parts[1])];
  const question = canonicalLesson.quiz[Number(parts[1])];
  return parts[2] === 'options' ? question.options[Number(parts[3])] : (question as any)[parts[2] === 'q' ? 'q' : parts[2]];
}

function targetText(pair: any, language: Language, fieldPath: string): string {
  const value = pair[targetKey[language]];
  return fieldPath.startsWith('body.') ? value.split('\n\n')[Number(fieldPath.split('.')[2])] : value;
}

function setExpectedTarget(pair: any, language: Language, row: any): void {
  const key = targetKey[language];
  if (row.fieldPath.startsWith('body.')) {
    const paragraphs = pair[key].split('\n\n');
    paragraphs[Number(row.fieldPath.split('.')[2])] = row.appliedTarget;
    pair[key] = paragraphs.join('\n\n');
  } else pair[key] = row.appliedTarget;
  pair.reviewStatus = row.appliedReviewStatus;
}

test('Vegetables L4 ordinary drafts change only the 38 accepted source-bound learner fields', () => {
  assert.deepEqual(canonicalModule, baseline.canonical,
    'localization must not rewrite canonical English teaching, assessment, or quiz order');
  assert.equal(applied.fields.length, 40);
  assert.equal(applied.summary.changedLearnerFields, 38);
  assert.equal(applied.summary.unchangedLearnerRows, 2);
  // The L4 packet records its own pre-render application phase. This test checks
  // its source-bound content; render evidence is kept separately for each batch.
  assert.ok(applied.fields.every((row: any) => row.sourceEnglish && row.appliedTarget && row.appliedReviewStatus),
    'the dated L4 application record retains every source-bound target and draft status');
  const unchangedRows = applied.fields.filter((row: any) => !row.changedFromCurrent);
  assert.equal(unchangedRows.length, 2);

  for (const language of Object.keys(drafts) as Language[]) {
    const expected = structuredClone(baseline.drafts[language]);
    const current = drafts[language];
    for (const row of applied.fields.filter((field: any) => field.language === language)) {
      const prior = pairAt(baseline.drafts[language], row.fieldPath);
      const source = canonicalSource(row.fieldPath);
      assert.equal(row.sourceEnglish, source, `${language}/${row.fieldPath}: candidate remains bound to exact canonical English`);
      assert.equal(prior.sourceEnglish.split('\n\n')[Number(row.fieldPath.split('.')[2])] ?? prior.sourceEnglish, row.sourceEnglish,
        `${language}/${row.fieldPath}: source snapshot remains the original field`);
      assert.equal(targetText(prior, language, row.fieldPath), row.currentTarget,
        `${language}/${row.fieldPath}: recorded before-state is exact`);
      const live = pairAt(current, row.fieldPath);
      assert.equal(targetText(live, language, row.fieldPath), row.appliedTarget,
        `${language}/${row.fieldPath}: the accepted target reaches the source-paired draft`);
      assert.equal(live.reviewStatus, row.appliedReviewStatus, `${language}/${row.fieldPath}: draft status is preserved`);
      if (row.changedFromCurrent) setExpectedTarget(pairAt(expected, row.fieldPath), language, row);
      else {
        assert.equal(row.currentTarget, row.candidateTarget, `${language}/${row.fieldPath}: no-op fields are not rewritten`);
        assert.equal(row.currentReviewStatus, row.candidateReviewStatus);
      }
    }
    // 5 October 2026: L2 followed the L4 snapshot. Layer only its final exact-source
    // learner rows into the reconstructed whole-module expectation.
    for (const row of l2Applied.fields.filter((field: any) => field.language === language && field.language !== 'ts')) {
      const pair = pairAt(expected, row.fieldPath, row.lessonId);
      if (row.fieldPath.startsWith('body.')) {
        const paragraphs = pair[targetKey[language]].split('\n\n');
        const index = Number(row.fieldPath.split('.')[2]);
        assert.equal(paragraphs[index], row.currentTarget, `${language}/${row.fieldPath}: frozen L2 before-state`);
        assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish);
        paragraphs[index] = row.appliedTarget;
        pair[targetKey[language]] = paragraphs.join('\n\n');
      } else {
        assert.equal(pair[targetKey[language]], row.currentTarget, `${language}/${row.fieldPath}: frozen L2 before-state`);
        assert.equal(pair.sourceEnglish, row.sourceEnglish);
        pair[targetKey[language]] = row.appliedTarget;
      }
      pair.reviewStatus = row.appliedReviewStatus;
    }
    for (const row of l2Applied.restoredToBaseline.filter((field: any) => field.language === language && field.language !== 'ts')) {
      const pair = pairAt(expected, row.fieldPath, row.lessonId);
      const paragraphs = pair[targetKey[language]].split('\n\n');
      const index = Number(row.fieldPath.split('.')[2]);
      assert.equal(paragraphs[index], row.restoredTarget,
        `${language}/${row.fieldPath}: reconciliation preserves the frozen localized wording`);
    }
    assert.deepEqual(current, expected, `${language}: every unlisted learner field and status remains byte-for-byte equivalent as parsed data`);
    const lessonDraft = current.lessons.find(item => item.id === 'vegetables-staples-l4')!;
    assert.deepEqual(lessonDraft.quiz.map((question: any) => question.sourceCorrectIndex), [1, 0],
      `${language}: correct-answer positions remain unchanged`);
    const shown = resolveLearnerLessonPresentation(canonicalLesson, language);
    assert.equal(shown.status, 'draft', `${language}: machine draft remains visibly marked as a draft`);
    assert.equal(shown.content.body, (lessonDraft.body as any)[targetKey[language]]);
    assert.deepEqual(shown.content.keyPoints, lessonDraft.keyPoints.map((point: any) => point[targetKey[language]]));
    assert.deepEqual(shown.content.quiz.map((question: any) => question.correct), [1, 0]);
    const changedSource = { ...canonicalLesson, body: canonicalLesson.body.replace('Pest pressure usually rises for a reason.', 'Pest pressure always rises for one reason.') };
    assert.equal(resolveLearnerLessonPresentation(changedSource, language).status, 'english-fallback',
      `${language}: source drift withdraws the whole stale draft`);
  }

  const sesotho = st.lessons.find(item => item.id === 'vegetables-staples-l4')!;
  const venda = ve.lessons.find(item => item.id === 'vegetables-staples-l4')!;
  const xitsonga = ts.lessons.find(item => item.id === 'vegetables-staples-l4')!;
  for (const text of [sesotho.body.sesothoDraft, venda.body.tshivendaDraft, xitsonga.body.xitsongaDraft]) {
    const paragraphs = text.split('\n\n');
    assert.match(paragraphs[6], /underside|bokatlase|tlhelo ḽa fhasi|tlhelo ra le hansi/i,
      'the observation step retains the lower leaf surface');
    assert.match(paragraphs[6], /stem|kutu|tsinde/i, 'the observation step retains the stem');
    assert.match(paragraphs[6], /nearby|haufinyane|tsini|ekusuhi/i, 'the observation step still includes nearby plants');
    assert.match(paragraphs[9], /Only then|Ke ka morao feela|Ndi hone fhedzi|Hi kona ntsena/i,
      'action stays after observation and diagnosis');
    assert.match(paragraphs[9], /lightest thing that works/,
      'the least intensive effective action remains explicit');
    for (const safeguard of ['registered for that crop and pest', 'label', 'neem products', 'protection and harvest waiting instructions', 'Do not improvise mixtures or stronger doses']) {
      assert.ok(paragraphs[10].includes(safeguard), `the full treatment restriction remains explicit: ${safeguard}`);
    }
  }
  assert.deepEqual(unchangedRows.map((row: any) => row.sourceEnglish), [
    'An improvised stronger mixture',
    'An improvised stronger mixture',
  ], 'the two exact-English wrong-answer options remain unchanged');
});

test('Vegetables L4 paired decks reuse only 12 exact-source rows and preserve every other deck field', () => {
  assert.equal(deckAccepted.matches.length, 12);
  assert.equal(deckAccepted.counts.noExactFullEnglishDeckMatch, 26,
    'learner fields without a complete matching English deck sentence are not copied into deck rows');
  const targetByLanguage: Record<Language, string> = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' };
  const matches = deckAccepted.matches;

  for (const language of ['st', 've', 'ts'] as const) {
    const path = `docs/narration/vegetables-staples.${language}.paired-draft.json`;
    const live = JSON.parse(readFileSync(path, 'utf8'));
    const expected = structuredClone(baseline.pairedDrafts[path]);
    const sourceSlides = englishSlideRecords(readFileSync('docs/narration/vegetables-staples.en.md', 'utf8'));
    const validated = validatePairedDraft(live, sourceSlides, language);
    assert.equal(live.reviewStatus, 'unreviewed', `${language}: paired deck remains unreviewed`);
    const languageMatches = matches.filter((row: any) => row.language === language);
    for (const row of languageMatches) {
      const slide = live.slides[row.slide - 1];
      const previous = expected.slides[row.slide - 1].target.body[row.englishBodyIndexZeroBased];
      assert.deepEqual(previous, row.currentDeckTarget, `${language} slide ${row.slide}: recorded old field matches the exact base`);
      assert.equal(slide.english.body[row.englishBodyIndexZeroBased], row.exactEnglishSource,
        `${language} slide ${row.slide}: English sentence remains byte-identical`);
      const target = slide.target.body[row.englishBodyIndexZeroBased];
      assert.deepEqual(target, row.proposedDeckTarget, `${language} slide ${row.slide}: accepted segmented target applied`);
      assert.equal(target.status, 'mixed', `${language} slide ${row.slide}: translated clauses remain visibly draft beside held English`);
      assert.equal(target.segments.map((segment: any) => segment.sourceEnglish).join(''), row.exactEnglishSource,
        `${language} slide ${row.slide}: segments cover the full original English source in order`);
      const visible = target.segments.map((segment: any) => segment.status === 'draft' ? segment.text : segment.sourceEnglish).join('');
      assert.equal(visible, row.finalLearnerCandidateTarget,
        `${language} slide ${row.slide}: visible segment composition equals the accepted learner field`);
      for (const segment of target.segments) {
        if (segment.status === 'english-hold') {
          assert.equal(segment.text, undefined, `${language} slide ${row.slide}: held clauses use exact source copy only`);
        } else assert.equal(segment.status, 'draft');
      }
      const learnerRow = applied.fields.find((field: any) => field.language === language && field.fieldPath === row.lessonField);
      assert.ok(learnerRow?.changedFromCurrent);
      assert.equal(learnerRow.appliedTarget, row.finalLearnerCandidateTarget,
        `${language} slide ${row.slide}: exact-source reuse points at the matching accepted learner body field`);
      expected.slides[row.slide - 1].target.body[row.englishBodyIndexZeroBased] = row.proposedDeckTarget;
      assert.equal(validated[row.slide - 1].english.body[row.englishBodyIndexZeroBased], row.exactEnglishSource);
    }
    // The later L2 batch adds separate exact source rows to this historical packet.
    for (const row of l2DeckApplied.entries.filter((entry: any) => entry.language === language)) {
      const slide = expected.slides[row.slideArrayIndex];
      assert.equal(slide.english.body[row.bodyIndex], row.sourceEnglish,
        `${language}/slide${row.slideNumber}: later L2 row keeps its exact English source`);
      assert.deepEqual(slide.target.body[row.bodyIndex], row.currentTarget,
        `${language}/slide${row.slideNumber}: frozen L2 deck before-state remains exact`);
      slide.target.body[row.bodyIndex] = row.proposedTarget;
    }
    assert.deepEqual(live, expected, `${language}: all unlisted source, target, status, heading and metadata fields remain unchanged`);
  }
});
