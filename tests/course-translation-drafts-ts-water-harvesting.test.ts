import assert from 'node:assert/strict';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { XITSONGA_WATER_HARVESTING_DRAFT as draft } from '../lib/course-translation-drafts-ts-water-harvesting.ts';
import type { XitsongaCourseModuleDraft, XitsongaSourcePair } from '../lib/course-translation-drafts-ts.ts';

const source = COURSE_MODULES.find(module => module.id === 'water-harvesting')!;
const digits = (value: string) => value.match(/\d+/g) ?? [];

function pairForHold(hold: XitsongaCourseModuleDraft['holds'][number]): XitsongaSourcePair | undefined {
  if (hold.lessonId === 'module') {
    if (hold.field === 'title') return draft.title;
    if (hold.field === 'description') return draft.description;
    return undefined;
  }

  const lesson = draft.lessons.find(item => item.id === hold.lessonId);
  if (!lesson) return undefined;
  if (hold.field === 'title') return lesson.title;
  if (hold.field === 'infographicAlt') return lesson.infographicAlt;
  const body = hold.field.match(/^body(?:\[(\d+)\])?$/);
  if (body) return lesson.body;
  const point = hold.field.match(/^keyPoints\[(\d+)\]$/);
  if (point) return lesson.keyPoints[Number(point[1])];
  const quiz = hold.field.match(/^quiz\[(\d+)\]\.(question|rationale|options\[(\d+)\])$/);
  if (!quiz) return undefined;
  const item = lesson.quiz[Number(quiz[1])];
  if (quiz[2] === 'question') return item?.question;
  if (quiz[2] === 'rationale') return item?.rationale;
  return item?.options[Number(quiz[3])];
}

test('Water Harvesting Xitsonga data retains all canonical sources, lesson shape and quiz indexes', () => {
  assert.equal(draft.reviewStatus, 'machine-draft');
  assert.equal(draft.language, 'ts');
  assert.equal(draft.sourceMetadata.durationMins, source.durationMins);
  assert.equal(draft.sourceMetadata.category, source.category);
  assert.equal(draft.title.sourceEnglish, source.title);
  assert.equal(draft.description.sourceEnglish, source.description);
  assert.equal(draft.lessons.length, source.lessons.length);

  for (const [index, lesson] of draft.lessons.entries()) {
    const original = source.lessons[index];
    assert.ok(original);
    assert.equal(lesson.id, original.id);
    assert.equal(lesson.title.sourceEnglish, original.title);
    assert.equal(lesson.infographicAlt?.sourceEnglish, original.infographicAlt);
    assert.equal(lesson.body.sourceEnglish, original.body);
    assert.deepEqual(lesson.keyPoints.map(point => point.sourceEnglish), original.keyPoints);
    assert.equal(lesson.quiz.length, original.quiz.length);

    const pairs = [lesson.title, ...(lesson.infographicAlt ? [lesson.infographicAlt] : []), lesson.body,
      ...lesson.keyPoints, ...lesson.quiz.flatMap(item => [item.question, ...item.options, item.rationale])];
    for (const pair of pairs) {
      assert.deepEqual(digits(pair.xitsongaDraft), digits(pair.sourceEnglish), `${lesson.id} figures changed`);
    }

    for (const [quizIndex, item] of lesson.quiz.entries()) {
      const sourceItem = original.quiz[quizIndex];
      assert.equal(item.question.sourceEnglish, sourceItem.q);
      assert.deepEqual(item.options.map(option => option.sourceEnglish), sourceItem.options);
      assert.equal(item.rationale.sourceEnglish, sourceItem.rationale);
      assert.equal(item.sourceCorrectIndex, sourceItem.correct, `${lesson.id} quiz ${quizIndex} answer index changed`);
    }
  }
});

test('Water Harvesting held wording remains exact where dam, water-law and reuse claims need local review', () => {
  assert.ok(draft.holds.length > 0);
  for (const hold of draft.holds) {
    const pair = pairForHold(hold);
    assert.ok(pair, `${hold.lessonId} ${hold.field} must resolve to a source pair`);
    if (hold.field.startsWith('body')) assert.ok(pair.xitsongaDraft.includes(hold.sourceText), `${hold.field} must retain its exact source passage`);
    else assert.equal(pair.xitsongaDraft, hold.sourceText, `${hold.field} must remain exact English`);
    assert.equal(pair.reviewStatus, 'hold');
    assert.ok(hold.reason.length > 0);
  }

  const exactHolds = draft.holds.map(hold => hold.sourceText);
  for (const required of [
    'Before changing a watercourse or building storage works, check the required authorisation with the water authority.',
    'A dam needs a site investigation and a design by a suitably qualified person. Catchment runoff, soil, foundations, downstream risk and a safe spillway all matter.',
    'Do not plant trees on an earth dam wall.',
    'A diverter does not make the remaining water safe to drink.',
    'Water that looks clear may still contain germs or chemicals. Ask the local health authority about testing and treatment suited to the intended use.',
    'A basic filter alone is not a drinking-water guarantee. Water used on food crops also needs a safety assessment.',
  ]) assert.ok(exactHolds.some(held => held.includes(required)), `safety or legal claim needs an exact hold: ${required}`);
});
