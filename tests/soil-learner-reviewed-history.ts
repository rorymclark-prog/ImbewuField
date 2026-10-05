import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Lesson } from '../lib/course-modules.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

const folder = new URL('../docs/study-translation-reviews/soil-learner-fuller-2026-10-05/', import.meta.url);
export const soilPacket = JSON.parse(readFileSync(new URL('soil-learner-final-accepted-candidates.json', folder), 'utf8'));
export const soilBefore = JSON.parse(readFileSync(new URL('native-before.json', folder), 'utf8'));
export const historicalST = soilBefore.st as typeof SESOTHO_SOIL_HEALTH_DRAFT;
export const historicalVE = soilBefore.ve as typeof TSHIVENDA_SOIL_HEALTH_DRAFT;
export const historicalTS = soilBefore.ts as typeof XITSONGA_SOIL_HEALTH_DRAFT;
export function fieldAt(value: any, path: string): any {
  return path.replaceAll('[', '.').replaceAll(']', '').split('.').reduce((item, key) => item[key], value);
}

// These earlier tests document the original mixed-language clause decisions. Every
// accepted replacement is checked against the live resolver before restoring that
// dated wording for the historical assertions; new tests cover current safeguards.
export function resolveHistoricalPresentation(lesson: Lesson, language: Parameters<typeof resolveLearnerLessonPresentation>[1]) {
  const shown = resolveLearnerLessonPresentation(lesson, language);
  if (shown.status !== 'draft') return shown;
  const content = structuredClone(shown.content);
  for (const field of soilPacket.fields.filter((f: any) => f.language === language && f.lessonId === lesson.id)) {
    const path = field.fieldPath.replace(/\.question$/, '.q');
    assert.equal(fieldAt(content, path), field.proposedTarget, `live resolver: ${language}/${lesson.id}/${path}`);
    const parts = path.replaceAll('[', '.').replaceAll(']', '').split('.');
    const key = parts.pop()!;
    const parent = parts.reduce((item: any, part: string) => item[part], content);
    parent[key] = field.currentTarget;
  }
  return { ...shown, content };
}
