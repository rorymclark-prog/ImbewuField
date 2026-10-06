import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';

const dir = 'docs/study-translation-reviews/soil-ordinary-ve-2026-10-06/';
const fixtureBytes = readFileSync(dir + 'test-fixtures.json');
const fixture = JSON.parse(fixtureBytes.toString());
const canonical = COURSE_MODULES.find(module => module.id === 'soil-health')!;
type Lang = 'st' | 've' | 'ts';
type Data = Record<string, any>;
const natives: Record<Lang, Data> = { st: SESOTHO_SOIL_HEALTH_DRAFT, ve: TSHIVENDA_SOIL_HEALTH_DRAFT, ts: XITSONGA_SOIL_HEALTH_DRAFT };
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
type Row = { unitId: string; sourceEnglish: string; currentTarget: string; acceptedTarget: string };
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

function slot(native: Data, row: Row): { pair: Data; index: number | null } {
  const parts = row.unitId.split('::');
  if (parts[1] === 'st' || parts[1] === 've' || parts[1] === 'ts') {
    return { pair: native[parts[2] === 'moduleTitle' ? 'title' : 'description'], index: null };
  }
  const lesson = native.lessons.find((lesson: Data) => lesson.id === parts[1]);
  assert.ok(lesson, row.unitId);
  if (parts[3] === 'body') return { pair: lesson.body, index: Number(parts[4].match(/paragraph\[(\d+)\]/)![1]) };
  const path = parts[3].replace(/\[(\d+)\]/g, '.$1').split('.');
  return { pair: path.reduce((owner: Data, key) => owner[key], lesson), index: null };
}

function value(pair: Data, index: number | null, key: string): string {
  return index === null ? pair[key] : pair[key].split('\n\n')[index];
}

function setValue(pair: Data, index: number | null, key: string, target: string) {
  if (index === null) pair[key] = target;
  else {
    const paragraphs = pair[key].split('\n\n');
    paragraphs[index] = target;
    pair[key] = paragraphs.join('\n\n');
  }
}

function expected(lang: Lang) {
  const result = structuredClone(fixture.before[lang]);
  for (const row of fixture.accepted[lang].rows as Row[]) {
    const { pair, index } = slot(result, row);
    assert.equal(value(pair, index, 'sourceEnglish'), row.sourceEnglish, row.unitId);
    assert.equal(value(pair, index, keys[lang]), row.currentTarget, row.unitId);
    assert.notEqual(row.acceptedTarget, row.currentTarget, row.unitId);
    setValue(pair, index, keys[lang], row.acceptedTarget);
    pair.reviewStatus = 'machine-draft';
  }
  return result;
}

// 6 October supersedes listed ordinary wording, not historical precision coverage.
// Validate the entire live object first: otherwise a rewind could hide an unlisted regression.
function validateAndRewind(lang: Lang, current: Data) {
  assert.deepEqual(current, expected(lang));
  const rewind = structuredClone(current);
  for (const row of fixture.accepted[lang].rows as Row[]) {
    const live = slot(rewind, row);
    const before = slot(fixture.before[lang], row);
    setValue(live.pair, live.index, keys[lang], row.currentTarget);
    live.pair.reviewStatus = before.pair.reviewStatus;
  }
  assert.deepEqual(rewind, fixture.before[lang]);
  return rewind;
}

for (const lang of Object.keys(natives) as Lang[]) {
  test(`${lang} Soil shows only root-accepted ordinary changes and preserves every unlisted source, field and answer index`, () => {
    assert.equal(hash(fixtureBytes), '800a5b343170469b8f71873145a93cc58aed1ad69d00f724409786dcb6850820');
    const packet = fixture.accepted[lang];
    const packetBytes = readFileSync(dir + packet.filename);
    assert.equal(hash(packetBytes), packet.sha256);
    const original = JSON.parse(packetBytes.toString());
    const authority = (original.rows ?? original.changes).map((row: Data) => ({ ...row, acceptedTarget: row.acceptedTarget ?? row.recommendedTarget ?? row.proposedTarget }));
    assert.deepEqual(packet.rows, authority);
    assert.equal(packet.rows.length, { st: 3, ve: 13, ts: 12 }[lang]);
    assert.equal(new Set(packet.rows.map((row: Row) => row.unitId)).size, packet.rows.length);
    assert.deepEqual(canonical, fixture.canonical);
    validateAndRewind(lang, natives[lang]);
    for (const [index, lesson] of canonical.lessons.entries()) {
      const shown = resolveLearnerLessonPresentation(lesson, lang);
      const wanted = expected(lang).lessons[index];
      assert.equal(shown.status, 'draft');
      assert.equal(shown.content.body, wanted.body[keys[lang]]);
      assert.equal(shown.content.infographicAlt, wanted.infographicAlt[keys[lang]]);
      assert.equal(shown.content.body.split('\n\n').length, lesson.body.split('\n\n').length);
      assert.deepEqual(shown.content.quiz.map(question => question.correct), lesson.quiz.map(question => question.correct));
    }
    const corrupt = structuredClone(natives[lang]);
    corrupt.lessons[0].body.sourceEnglish += ' changed';
    assert.throws(() => validateAndRewind(lang, corrupt), 'source mutation must be caught before rewind');
    const unlisted = structuredClone(natives[lang]);
    unlisted.lessons[0].keyPoints[0][keys[lang]] += ' unlisted change';
    assert.throws(() => validateAndRewind(lang, unlisted), 'unlisted target mutation must be caught before rewind');
  });

  test(`${lang} Soil source drift and reordered or rekeyed answers fail closed instead of showing stale farming advice`, () => {
    for (const lesson of canonical.lessons) {
      const variants: Lesson[] = [
        { ...lesson, title: lesson.title + ' changed' },
        { ...lesson, body: lesson.body + ' changed' },
        { ...lesson, infographicAlt: lesson.infographicAlt + ' changed' },
        { ...lesson, keyPoints: [lesson.keyPoints[0] + ' changed', ...lesson.keyPoints.slice(1)] },
        { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, q: q.q + ' changed' }) },
        { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, rationale: q.rationale + ' changed' }) },
        { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, options: [q.options[1], q.options[0], ...q.options.slice(2)] }) },
        { ...lesson, quiz: lesson.quiz.map((q, i) => i ? q : { ...q, correct: (q.correct + 1) % 4 }) },
      ];
      for (const variant of variants) {
        const shown = resolveLearnerLessonPresentation(variant, lang);
        assert.equal(shown.status, 'english-fallback', lesson.id);
        assert.equal(shown.content.body, variant.body);
        assert.deepEqual(shown.content.quiz, variant.quiz);
      }
    }
  });

  test(`${lang} Soil card is visibly draft only for its exact title, description, duration and category`, () => {
    const current = natives[lang];
    const shown = resolveCourseModulePresentation(canonical, lang);
    assert.equal(shown.status, 'draft');
    assert.equal(shown.title, current.title[keys[lang]]);
    assert.equal(shown.description, current.description[keys[lang]]);
    for (const changed of [
      { ...canonical, title: canonical.title + ' changed' },
      { ...canonical, description: canonical.description + ' changed' },
      { ...canonical, durationMins: canonical.durationMins + 1 },
      { ...canonical, category: 'water' as const },
    ]) {
      assert.deepEqual(resolveCourseModulePresentation(changed, lang), { title: changed.title, description: changed.description, status: 'english-fallback' });
    }
  });
}

test('Soil translation completion keeps sedimentation uncertainty, the laboratory boundary and independent leachate prohibitions', () => {
  for (const lang of Object.keys(natives) as Lang[]) {
    const before = fixture.before[lang];
    const current = natives[lang];
    const key = keys[lang];
    const beforeBody = before.lessons[0].body[key].split('\n\n');
    const body = current.lessons[0].body[key].split('\n\n');
    // These full clauses were intentionally not approved for change: not-yet, may-still,
    // rough exercise, laboratory WHEN needed and settled completed-state remain exact.
    for (const index of [4, 5, 6, 7, 8]) assert.equal(body[index], beforeBody[index]);
    assert.match(body[0], /break down organic matter/);
    assert.match(current.lessons[1].body[key].split('\n\n')[0], /broken down/);
    assert.match(current.lessons[0].infographicAlt[key], /settles into three layers/);
    assert.match(current.lessons[1].infographicAlt[key], /cut open/);
    const leachate = current.lessons[2].body[key].split('\n\n');
    const original = before.lessons[2].body[key].split('\n\n');
    assert.equal(leachate[7], original[7]);
    assert.equal(leachate[8], original[8]);
    assert.deepEqual(current.lessons[2].quiz[1].options[1], before.lessons[2].quiz[1].options[1]);
    assert.deepEqual(current.lessons[2].quiz[1].rationale, before.lessons[2].quiz[1].rationale);
  }
  assert.match(SESOTHO_SOIL_HEALTH_DRAFT.lessons[2].body.sesothoDraft.split('\n\n')[12], /di ka thusa/);
  assert.match(XITSONGA_SOIL_HEALTH_DRAFT.lessons[2].body.xitsongaDraft.split('\n\n')[12], /swi nga pfuna/);
  assert.equal(TSHIVENDA_SOIL_HEALTH_DRAFT.description.reviewStatus, 'machine-draft');
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.title.reviewStatus, 'machine-draft');
  assert.equal(XITSONGA_SOIL_HEALTH_DRAFT.description.reviewStatus, 'machine-draft');
  assert.match(TSHIVENDA_SOIL_HEALTH_DRAFT.lessons[0].body.tshivendaDraft, /Thick sand layer/);
  assert.match(TSHIVENDA_SOIL_HEALTH_DRAFT.lessons[0].body.tshivendaDraft, /Pale colour/);
  assert.doesNotMatch(TSHIVENDA_SOIL_HEALTH_DRAFT.lessons[0].body.tshivendaDraft, /dombileaho|u aluwa ha midzi/);
});
