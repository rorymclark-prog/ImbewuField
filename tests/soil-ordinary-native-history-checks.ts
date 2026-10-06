import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { soilPacket, fieldAt } from './soil-learner-reviewed-history.ts';
import { soilWaterResidualNativeBefore } from './soil-water-residual-history-checks.ts';

// 6 October: only the root-approved 3 ST, 13 VE and 12 TS ordinary units
// supersede the 5 October layer. Check the full live object before any rewind,
// so historical assertions cannot conceal an unlisted target or source regression.
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
export function validateAndRewindSoilOrdinary(lang: Lang, current: Data = natives[lang]) {
  assert.equal(hash(fixtureBytes), '800a5b343170469b8f71873145a93cc58aed1ad69d00f724409786dcb6850820');
  assert.deepEqual(canonical, fixture.canonical);
  for (const language of Object.keys(natives) as Lang[]) {
    const packet = fixture.accepted[language];
    assert.equal(packet.rows.length, { st: 3, ve: 13, ts: 12 }[language]);
    const bytes = readFileSync(dir + packet.filename);
    assert.equal(hash(bytes), packet.sha256);
    const authority = JSON.parse(bytes.toString());
    assert.deepEqual(packet.rows, (authority.rows ?? authority.changes).map((row: Data) => ({ ...row, acceptedTarget: row.acceptedTarget ?? row.recommendedTarget ?? row.proposedTarget })));
  }
  const residualBefore = soilWaterResidualNativeBefore(lang, 'soil-health', current);
  assert.deepEqual(residualBefore, expected(lang));
  const rewind = structuredClone(residualBefore);
  for (const row of fixture.accepted[lang].rows as Row[]) {
    const live = slot(rewind, row);
    const before = slot(fixture.before[lang], row);
    setValue(live.pair, live.index, keys[lang], row.currentTarget);
    live.pair.reviewStatus = before.pair.reviewStatus;
  }
  assert.deepEqual(rewind, fixture.before[lang]);
  return rewind;
}


export function resolveBeforeSoilOrdinary(lesson: Lesson, language: Parameters<typeof resolveLearnerLessonPresentation>[1]) {
  const shown = resolveLearnerLessonPresentation(lesson, language);
  if (shown.status !== 'draft' || !['st', 've', 'ts'].includes(language)) return shown;
  const lang = language as Lang;
  const before = validateAndRewindSoilOrdinary(lang);
  const content = structuredClone(shown.content);
  for (const field of soilPacket.fields.filter((f: Data) => f.language === lang && f.lessonId === lesson.id)) {
    const path = field.fieldPath.replace(/\.question$/, '.q');
    const native = natives[lang].lessons.find((l: Data) => l.id === lesson.id);
    assert.equal(fieldAt(content, path), fieldAt(native, field.fieldPath)[keys[lang]], `actual resolver ${lang}/${lesson.id}/${path}`);
    const prior = before.lessons.find((l: Data) => l.id === lesson.id);
    const parts = path.replaceAll('[', '.').replaceAll(']', '').split('.');
    const key = parts.pop()!;
    const parent = parts.reduce((item: Data, part: string) => item[part], content);
    parent[key] = fieldAt(prior, field.fieldPath)[keys[lang]];
  }
  return { ...shown, content };
}

export function resolveBeforeFullerSoilPresentation(lesson: Lesson, language: Parameters<typeof resolveLearnerLessonPresentation>[1]) {
  const shown = resolveBeforeSoilOrdinary(lesson, language);
  if (shown.status !== 'draft') return shown;
  const content = structuredClone(shown.content);
  for (const field of soilPacket.fields.filter((f: Data) => f.language === language && f.lessonId === lesson.id)) {
    const path = field.fieldPath.replace(/\.question$/, '.q');
    assert.equal(fieldAt(content, path), field.proposedTarget, `accepted 5 October resolver ${language}/${lesson.id}/${path}`);
    const parts = path.replaceAll('[', '.').replaceAll(']', '').split('.');
    const key = parts.pop()!;
    const parent = parts.reduce((item: Data, part: string) => item[part], content);
    parent[key] = field.currentTarget;
  }
  return { ...shown, content };
}
