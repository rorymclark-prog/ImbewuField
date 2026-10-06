import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT as draft } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const dir = 'docs/study-translation-reviews/water-ordinary-ve-2026-10-06/';
const packetBytes = readFileSync(dir + 'root-reviewed-candidates.json');
const packet = JSON.parse(packetBytes.toString());
const baseline = JSON.parse(readFileSync(dir + 'native-before.json', 'utf8'));
const canonical = COURSE_MODULES.find(module => module.id === 'water-harvesting')!;

// The whole-module comparison protects fields omitted from the translation packet too.
function expectedNative() {
  const expected = structuredClone(baseline.draft);
  for (const row of packet.rows) {
    const owner = row.lessonId ? expected.lessons.find((lesson: { id: string }) => lesson.id === row.lessonId) : expected;
    if (row.fieldPath === 'body') continue;
    const keys = row.fieldPath.replace(/\[(\d+)\]/g, '.$1').split('.');
    const pair = keys.reduce((value: any, key: string) => value[key], owner);
    assert.equal(pair.sourceEnglish, row.sourceEnglish);
    assert.equal(pair.tshivendaDraft, row.currentTarget);
    if (row.proposedTarget !== row.currentTarget) {
      pair.tshivendaDraft = row.proposedTarget;
      pair.reviewStatus = row.proposedReviewStatus;
    }
  }
  for (const body of packet.bodyCompositions) {
    const pair = expected.lessons.find((lesson: { id: string }) => lesson.id === body.lessonId).body;
    assert.equal(pair.sourceEnglish, body.sourceEnglish);
    assert.equal(pair.tshivendaDraft, body.currentTarget);
    pair.tshivendaDraft = body.proposedTarget;
  }
  return expected;
}

test('Venda Water follows the reviewed 78-unit packet and preserves every unlisted native field', () => {
  assert.equal(createHash('sha256').update(packetBytes).digest('hex'), 'ba100aa5be8dadd3f2ac6de4b63cbae44cb6bb144990cfaaa1ae0593deb5cb02');
  assert.equal(packet.rows.length, 108);
  assert.equal(new Set(packet.rows.map((row: any) => row.id)).size, 108);
  assert.equal(packet.rows.filter((row: any) => row.currentTarget !== row.proposedTarget).length, 78);
  assert.deepEqual(canonical, baseline.canonical);
  assert.deepEqual(draft, expectedNative());
  for (const lesson of canonical.lessons) {
    const shown = resolveLearnerLessonPresentation(lesson, 've');
    const expected = packet.bodyCompositions.find((body: any) => body.lessonId === lesson.id);
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.body, expected.proposedTarget);
    assert.equal(shown.content.body.split('\n\n').length, lesson.body.split('\n\n').length);
    assert.deepEqual(shown.content.quiz.map(question => question.correct), [1, 1]);
  }
});

test('changed English source or reordered answers invalidates Venda Water rather than presenting mismatched advice', () => {
  for (const lesson of canonical.lessons) {
    const variants = [
      { ...lesson, title: lesson.title + ' changed source' },
      { ...lesson, body: lesson.body + ' changed source' },
      { ...lesson, keyPoints: [lesson.keyPoints[0] + ' changed source', ...lesson.keyPoints.slice(1)] },
      { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, q: q.q + ' changed source' }) },
      { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, rationale: q.rationale + ' changed source' }) },
      { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, options: [q.options[1], q.options[0], ...q.options.slice(2)] }) },
      { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, correct: 0 }) },
    ];
    if (lesson.infographicAlt) variants.push({ ...lesson, infographicAlt: lesson.infographicAlt + ' changed source' });
    for (const variant of variants) {
      const shown = resolveLearnerLessonPresentation(variant, 've');
      assert.equal(shown.status, 'english-fallback', lesson.id);
      assert.equal(shown.content.body, variant.body);
      assert.deepEqual(shown.content.quiz, variant.quiz);
    }
  }
});

test('Venda Water retains hydraulic alternatives, qualifications and the exact PR957 operating triggers', () => {
  const [swale, dam, tank, reuse] = draft.lessons;
  assert.match(swale.body.tshivendaDraft, /slight, controlled grade/);
  assert.match(swale.body.tshivendaDraft, /maḓi o engedzeaho nga u ongologa/);
  assert.match(swale.body.tshivendaDraft, /luvhilo lu fhiraho/);
  assert.match(swale.body.tshivendaDraft, /A downstream swale or dam must be able to receive it safely\./);
  assert.match(dam.body.tshivendaDraft, /suitably qualified person/);
  assert.match(dam.title.tshivendaDraft, /Dry Season$/);
  assert.doesNotMatch(dam.title.tshivendaDraft, /Gomelelo/);
  assert.match(tank.body.tshivendaDraft, /stored water runs low/);
  assert.match(tank.body.tshivendaDraft, /covered; vheani screen kha openings uri zwikhokhonono zwi si dzhene/);
  assert.match(tank.quiz[0].rationale.tshivendaDraft, /wet and dry periods/);
  assert.match(reuse.body.tshivendaDraft, /qualified local sanitation adviser/);
  assert.match(reuse.body.tshivendaDraft, /If a reuse system is already operating and the water smells bad, pools or harms plants,/);
  assert.match(reuse.body.tshivendaDraft, /property/);
  assert.match(reuse.body.tshivendaDraft, /watercourse/);
  assert.match(reuse.keyPoints[1].tshivendaDraft, /locally/);
  assert.doesNotMatch(reuse.keyPoints[1].tshivendaDraft, /na vha henefho/);
  assert.match(draft.description.tshivendaDraft, /sink every drop/);
  assert.match(reuse.quiz[1].rationale.tshivendaDraft, /o tsireledzea kana o tea/);
});
