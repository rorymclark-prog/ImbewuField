import assert from 'node:assert/strict';
import test from 'node:test';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';

type PairLike = { sourceEnglish: string; reviewStatus: string; [key: string]: unknown };
type DraftEntry = {
  code: 'st' | 'ts' | 've';
  targetKey: 'sesothoDraft' | 'xitsongaDraft' | 'tshivendaDraft';
  module: typeof SESOTHO_READING_LANDSCAPE_DRAFT | typeof XITSONGA_READING_LANDSCAPE_DRAFT | typeof TSHIVENDA_READING_LANDSCAPE_DRAFT;
};

const drafts: DraftEntry[] = [
  { code: 'st', targetKey: 'sesothoDraft', module: SESOTHO_READING_LANDSCAPE_DRAFT },
  { code: 'ts', targetKey: 'xitsongaDraft', module: XITSONGA_READING_LANDSCAPE_DRAFT },
  { code: 've', targetKey: 'tshivendaDraft', module: TSHIVENDA_READING_LANDSCAPE_DRAFT },
];
const numberTokens = (value: string) => value.match(/\d+(?:[.,]\d+)?/g) ?? [];
const placeholders = (value: string) => value.match(/\{[^{}]+\}/g) ?? [];
const valueAt = (pair: PairLike, key: DraftEntry['targetKey']) => String(pair[key] ?? '');
const checkPair = (pairValue: unknown, sourceEnglish: string, entry: DraftEntry, path: string) => {
  const pair = pairValue as PairLike;
  const target = valueAt(pair, entry.targetKey);
  assert.equal(pair.sourceEnglish, sourceEnglish, `${entry.code} ${path}: exact current English source is retained`);
  assert.ok(target.trim(), `${entry.code} ${path}: candidate or exact English hold is present`);
  assert.ok(['machine-draft', 'hold'].includes(pair.reviewStatus), `${entry.code} ${path}: explicit unreviewed status`);
  assert.deepEqual(numberTokens(target), numberTokens(sourceEnglish), `${entry.code} ${path}: figures and times stay paired`);
  assert.deepEqual(placeholders(target), placeholders(sourceEnglish), `${entry.code} ${path}: placeholders stay paired`);
  if (pair.reviewStatus === 'hold') assert.equal(target, sourceEnglish, `${entry.code} ${path}: a whole-field hold stays exact`);
};

test('Reading full learner drafts keep all fields source-bound, ordered, withdrawable and semantically bounded', () => {
  const source = COURSE_MODULES.find(module => module.id === 'reading-landscape');
  assert.ok(source);
  for (const entry of drafts) {
    const draft = entry.module;
    assert.equal(draft.id, source.id, `${entry.code}: module identity matches`);
    assert.equal(draft.language, entry.code, `${entry.code}: language label is correct`);
    assert.equal(draft.reviewStatus, 'machine-draft', `${entry.code}: facilitator review remains pending`);
    assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
    assert.equal(draft.sourceMetadata.category, source.category);
    checkPair(draft.title, source.title, entry, 'title');
    checkPair(draft.description, source.description, entry, 'description');
    assert.deepEqual(draft.lessons.map(lesson => lesson.id), source.lessons.map(lesson => lesson.id),
      `${entry.code}: lesson IDs and order match the canonical module`);

    for (const [lessonIndex, lesson] of draft.lessons.entries()) {
      const original: (typeof source.lessons)[number] = source.lessons[lessonIndex];
      assert.equal(lesson.id, original.id);
      checkPair(lesson.title, original.title, entry, `${lesson.id}.title`);
      checkPair(lesson.body, original.body, entry, `${lesson.id}.body`);
      const body = valueAt(lesson.body as unknown as PairLike, entry.targetKey);
      assert.equal(body.split('\n\n').length, original.body.split('\n\n').length,
        `${entry.code} ${lesson.id}: body paragraph count and order remain aligned`);
      if (original.infographicAlt === undefined) assert.equal(lesson.infographicAlt, undefined);
      else {
        assert.ok(lesson.infographicAlt);
        checkPair(lesson.infographicAlt, original.infographicAlt, entry, `${lesson.id}.infographicAlt`);
      }
      assert.equal(lesson.keyPoints.length, original.keyPoints.length);
      for (const [pointIndex, point] of lesson.keyPoints.entries()) {
        checkPair(point, original.keyPoints[pointIndex], entry, `${lesson.id}.keyPoints[${pointIndex}]`);
      }
      assert.equal(lesson.quiz.length, original.quiz.length);
      for (const [quizIndex, quiz] of lesson.quiz.entries()) {
        const sourceQuiz = original.quiz[quizIndex];
        checkPair(quiz.question, sourceQuiz.q, entry, `${lesson.id}.quiz[${quizIndex}].question`);
        assert.equal(quiz.options.length, sourceQuiz.options.length);
        for (const [optionIndex, option] of quiz.options.entries()) {
          checkPair(option, sourceQuiz.options[optionIndex], entry, `${lesson.id}.quiz[${quizIndex}].options[${optionIndex}]`);
        }
        assert.equal(quiz.sourceCorrectIndex, sourceQuiz.correct,
          `${entry.code} ${lesson.id}.quiz[${quizIndex}]: correct answer index stays canonical`);
        assert.equal(quiz.options[quiz.sourceCorrectIndex]?.sourceEnglish, sourceQuiz.options[sourceQuiz.correct],
          `${entry.code} ${lesson.id}.quiz[${quizIndex}]: correct option remains in place`);
        checkPair(quiz.rationale, sourceQuiz.rationale, entry, `${lesson.id}.quiz[${quizIndex}].rationale`);
      }

      const changedSource = { ...original, body: `${original.body} A changed source condition.` };
      const fallback = resolveLearnerLessonPresentation(changedSource, entry.code);
      assert.equal(fallback.status, 'english-fallback', `${entry.code} ${lesson.id}: body drift withdraws the whole stale draft`);
      assert.equal(fallback.content.body, changedSource.body, `${entry.code} ${lesson.id}: show current English after drift`);
    }
  }

  const byCode = Object.fromEntries(drafts.map(entry => [entry.code, entry])) as Record<'st' | 'ts' | 've', DraftEntry>;
  const text = (code: 'st' | 'ts' | 've', lessonId: string, field: 'body' | 'quiz0question' | 'quiz0rationale' | 'quiz0option0' | 'quiz1question' | 'quiz1rationale' | 'quiz1option1') => {
    const entry = byCode[code];
    const lesson = entry.module.lessons.find(item => item.id === lessonId);
    assert.ok(lesson);
    const pair = field === 'body' ? lesson.body
      : field === 'quiz0question' ? lesson.quiz[0].question
        : field === 'quiz0rationale' ? lesson.quiz[0].rationale
          : field === 'quiz0option0' ? lesson.quiz[0].options[0]
            : field === 'quiz1question' ? lesson.quiz[1].question
              : field === 'quiz1rationale' ? lesson.quiz[1].rationale
                : lesson.quiz[1].options[1];
    return valueAt(pair as unknown as PairLike, entry.targetKey);
  };

  for (const code of ['st', 'ts', 've'] as const) {
    const l2Body = text(code, 'reading-landscape-l2', 'body');
    assert.ok(l2Body.includes('young citrus'), `${code}: preserve young citrus as an age qualifier`);
    assert.doesNotMatch(l2Body, /small citrus|citrus (?:trees|plants) are small/i,
      `${code}: do not change young plants into small plants`);
    const l3Question = text(code, 'reading-landscape-l3', 'quiz0question');
    assert.doesNotMatch(l3Question, /\bseeds?\b|\bpeo\b|\btimbe?wu\b|\bmbeu\b/i,
      `${code}: do not replace seedling nursery stock with seeds`);
    const l3Lesson = byCode[code].module.lessons.find(item => item.id === 'reading-landscape-l3')!;
    const l3Body = valueAt(l3Lesson.body as unknown as PairLike, byCode[code].targetKey).split('\n\n')[1];
    const frostRationale = valueAt(l3Lesson.quiz[0].rationale as unknown as PairLike, byCode[code].targetKey);
    assert.ok(l3Body.includes('through the local frost season'), `${code}: compare sites throughout the frost season`);
    assert.ok(frostRationale.includes('through the local frost season'),
      `${code}: nursery comparison covers the full frost season in the assessment too`);
    const l3Rationale = text(code, 'reading-landscape-l3', 'quiz1rationale');
    assert.ok(/prolonged|tshifhinga tshilapfu|nkarhi wo leha|nako e telele/i.test(l3Rationale),
      `${code}: late-blight weather condition remains prolonged`);
    assert.ok(/cool|rothola|titimela|phodileng/i.test(l3Rationale) && /damp|vhunyisi|tsakama|mongobo/i.test(l3Rationale),
      `${code}: late-blight condition retains both cool and damp`);
    assert.ok(/alone|fhedzi|ntsena|feela/i.test(l3Rationale), `${code}: bed movement alone is not described as control`);
  }

  for (const code of ['ts', 've'] as const) {
    const entry = byCode[code];
    const l1 = entry.module.lessons.find(lesson => lesson.id === 'reading-landscape-l1')!;
    const measurement = valueAt(l1.body as unknown as PairLike, entry.targetKey);
    assert.ok(measurement.includes('points at the same height'), `${code}: preserve the vertical contour measurement in English`);
    const safeOverflow = valueAt(l1.quiz[1].options[1] as unknown as PairLike, entry.targetKey);
    assert.ok(/safe overflow|ndlela leyi hlayisekeke yo humesa mati lama taleke/i.test(safeOverflow),
      `${code}: keep the whole safe-overflow route requirement`);
    assert.ok(/trained local adviser|o gudiswaho|loyi a leteriweke/i.test(safeOverflow),
      `${code}: retain the trained qualification on the local adviser`);
  }

  const stAFrame = valueAt(byCode.st.module.lessons[0].body as unknown as PairLike, 'sesothoDraft');
  assert.ok(stAFrame.includes('dintlha tse bophahamong bo lekanang'), 'ST: equal-height contour points retain vertical meaning');
  for (const code of ['st', 'ts', 've'] as const) {
    const entry = byCode[code];
    const l4 = entry.module.lessons.find(lesson => lesson.id === 'reading-landscape-l4')!;
    const mapped = valueAt(l4.body as unknown as PairLike, entry.targetKey).split('\n\n')[0];
    const features = code === 'ts' ? ['yindlu', 'mirhi', 'mati', 'magondzo', 'fences']
      : code === 've' ? ['nnḓu', 'miri', 'maḓi', 'bada', 'fences']
        : ['ntlo', 'difate', 'metsi', 'ditsela', 'fences'];
    const positions = features.map(feature => mapped.indexOf(feature));
    assert.ok(positions.every(position => position >= 0), `${code}: retain all mapped site features`);
    assert.ok(positions.every((position, index) => index === 0 || positions[index - 1] < position),
      `${code}: retain mapped feature order`);
    assert.ok(mapped.includes('ximumu na vuxika') || mapped.includes('tshilimo na wa vhuria') ||
      mapped.includes('lehlabula le wa mariha'), `${code}: keep summer and winter wind directions separately marked`);
  }

  const veL4 = byCode.ve.module.lessons.find(lesson => lesson.id === 'reading-landscape-l4')!;
  const patchText = valueAt(veL4.body as unknown as PairLike, 'tshivendaDraft').split('\n\n')[1];
  assert.ok(patchText.includes('patch ya amba'), 'VE: keep patch as the mapped area term');
  assert.doesNotMatch(patchText, /tsinde/i, 'VE: do not substitute stem or trunk for patch');
});
