#!/usr/bin/env node
// Builds lib/course-translation-drafts-af.ts from the Afrikaans Studies packet in
// docs/study-translation-reviews/afrikaans-2026-10-31/ (drafts/<module>.json + holds.json).
//
// Every Afrikaans string is paired with the exact English it translates, read from
// lib/course-modules.ts at build time, so lib/course-localization.ts can refuse a draft the moment
// its English changes. A field listed in holds.json ships as a `hold` (the learner sees English).
//
// USAGE
//   node --import ./tests/register-alias.mjs scripts/build-af-course-drafts.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_MODULES } from '../lib/course-modules.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIR = join(ROOT, 'docs/study-translation-reviews/afrikaans-2026-10-31');
const holds = new Set(JSON.parse(readFileSync(join(DIR, 'holds.json'), 'utf8')).map((h) => h.path));
const numbers = (s) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).sort();
// Every figure the English writes in digits must survive; the English sometimes spells a number
// out for narration ("one point two metres") and the draft may write the same value in digits.
const missingNumbers = (english, afrikaans) => {
  const left = [...numbers(afrikaans)];
  return numbers(english).filter((n) => { const i = left.indexOf(n); if (i < 0) return true; left.splice(i, 1); return false; });
};
const problems = [];

function pair(path, english, afrikaans) {
  if (typeof afrikaans !== 'string' || afrikaans.trim() === '') { problems.push(`${path}: missing draft`); return { english, afrikaans: english, hold: true }; }
  const missing = missingNumbers(english, afrikaans);
  if (missing.length) problems.push(`${path}: draft drops the figure(s) ${missing.join(', ')}`);
  return { english, afrikaans, hold: holds.has(path) };
}

const js = (v) => JSON.stringify(v);
const emit = (p, indent) => p.hold ? `hold(${js(p.english)})` : `pair(\n${indent}  ${js(p.english)},\n${indent}  ${js(p.afrikaans)},\n${indent})`;

const modules = COURSE_MODULES.map((mod) => {
  const draft = JSON.parse(readFileSync(join(DIR, 'drafts', `${mod.id}.json`), 'utf8'));
  if (draft.id !== mod.id || draft.lessons.length !== mod.lessons.length) problems.push(`${mod.id}: module shape differs from source`);
  const lessons = mod.lessons.map((lesson, i) => {
    const d = draft.lessons[i] ?? {};
    const base = `${mod.id}/${lesson.id}`;
    if (d.id !== lesson.id) problems.push(`${base}: lesson id differs`);
    if ((d.body ?? '').split('\n\n').length !== lesson.body.split('\n\n').length) problems.push(`${base}: paragraph count differs`);
    if ((d.keyPoints ?? []).length !== lesson.keyPoints.length) problems.push(`${base}: keyPoints length differs`);
    if ((d.quiz ?? []).length !== lesson.quiz.length) problems.push(`${base}: quiz length differs`);
    return {
      id: lesson.id,
      infographicAlt: lesson.infographicAlt ? pair(`${base}/infographicAlt`, lesson.infographicAlt, d.infographicAlt) : null,
      title: pair(`${base}/title`, lesson.title, d.title),
      body: pair(`${base}/body`, lesson.body, d.body),
      keyPoints: lesson.keyPoints.map((k, j) => pair(`${base}/keyPoints/${j}`, k, d.keyPoints?.[j])),
      quiz: lesson.quiz.map((q, j) => {
        const dq = d.quiz?.[j] ?? {};
        if (dq.correct !== q.correct) problems.push(`${base}/quiz/${j}: correct index differs`);
        if ((dq.options ?? []).length !== q.options.length) problems.push(`${base}/quiz/${j}: option count differs`);
        return {
          question: pair(`${base}/quiz/${j}/q`, q.q, dq.q),
          options: q.options.map((o, k) => pair(`${base}/quiz/${j}/options/${k}`, o, dq.options?.[k])),
          sourceCorrectIndex: q.correct,
          rationale: pair(`${base}/quiz/${j}/rationale`, q.rationale, dq.rationale),
        };
      }),
    };
  });
  return {
    id: mod.id, durationMins: mod.durationMins, category: mod.category,
    title: pair(`${mod.id}/title`, mod.title, draft.title),
    description: pair(`${mod.id}/description`, mod.description, draft.description),
    lessons,
  };
});
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }

const I = '      ';
const lessonSrc = (l) => `    {
      id: ${js(l.id)},${l.infographicAlt ? `\n      infographicAlt: ${emit(l.infographicAlt, I)},` : ''}
      title: ${emit(l.title, I)},
      body: ${emit(l.body, I)},
      keyPoints: [
${l.keyPoints.map((k) => `        ${emit(k, '        ')},`).join('\n')}
      ],
      quiz: [
${l.quiz.map((q) => `        {
          question: ${emit(q.question, '          ')},
          options: [
${q.options.map((o) => `            ${emit(o, '            ')},`).join('\n')}
          ],
          sourceCorrectIndex: ${q.sourceCorrectIndex},
          rationale: ${emit(q.rationale, '          ')},
        },`).join('\n')}
      ],
    },`;

const body = modules.map((m) => `  {
  id: ${js(m.id)},
  language: 'af',
  reviewStatus: 'machine-draft',
  sourceMetadata: { durationMins: ${m.durationMins}, category: ${js(m.category)} },
  title: ${emit(m.title, '  ')},
  description: ${emit(m.description, '  ')},
  lessons: [
${m.lessons.map(lessonSrc).join('\n')}
  ],
  },`).join('\n');

writeFileSync(join(ROOT, 'lib/course-translation-drafts-af.ts'), `// GENERATED by scripts/build-af-course-drafts.mjs from docs/study-translation-reviews/afrikaans-2026-10-31/.
// Do not edit by hand: change the packet's drafts/<module>.json or holds.json and rebuild.
//
// Source-paired Afrikaans machine drafts for every Studies module (Rory asked for the whole app in
// Afrikaans, 31 Oct 2026). Unreviewed: no fluent Afrikaans speaker or local farming reviewer has
// checked them. Each pair carries the exact English it translates; lib/course-localization.ts
// shows a lesson in Afrikaans only while every pair still matches lib/course-modules.ts.

export type AfrikaansDraftReviewStatus = 'machine-draft' | 'hold';

export interface AfrikaansSourcePair {
  sourceEnglish: string;
  afrikaansDraft: string;
  reviewStatus: AfrikaansDraftReviewStatus;
}

export interface AfrikaansCourseQuizDraft {
  question: AfrikaansSourcePair;
  options: AfrikaansSourcePair[];
  /** Answer index copied unchanged from the English source. */
  sourceCorrectIndex: number;
  rationale: AfrikaansSourcePair;
}

export interface AfrikaansCourseLessonDraft {
  id: string;
  infographicAlt?: AfrikaansSourcePair;
  title: AfrikaansSourcePair;
  body: AfrikaansSourcePair;
  keyPoints: AfrikaansSourcePair[];
  quiz: AfrikaansCourseQuizDraft[];
}

export interface AfrikaansCourseModuleDraft {
  id: string;
  language: 'af';
  reviewStatus: 'machine-draft';
  sourceMetadata: { durationMins: number; category: string };
  title: AfrikaansSourcePair;
  description: AfrikaansSourcePair;
  lessons: AfrikaansCourseLessonDraft[];
}

const pair = (sourceEnglish: string, afrikaansDraft: string): AfrikaansSourcePair => ({
  sourceEnglish,
  afrikaansDraft,
  reviewStatus: 'machine-draft',
});

const hold = (sourceEnglish: string): AfrikaansSourcePair => ({
  sourceEnglish,
  afrikaansDraft: sourceEnglish,
  reviewStatus: 'hold',
});

export const AFRIKAANS_COURSE_DRAFTS: AfrikaansCourseModuleDraft[] = [
${body}
];
`);
const fields = JSON.stringify(modules).match(/"english"/g).length;
console.log(`wrote ${modules.length} modules, ${fields} source pairs, ${holds.size} holds`);
