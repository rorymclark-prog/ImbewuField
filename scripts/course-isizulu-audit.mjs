#!/usr/bin/env node
// Read-only inventory of isiZulu course readiness. This reports source fingerprints and review
// artifacts; it does not decide that a translation matches its English source or is approved.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { COURSE_NARRATION } from '../lib/course-audio.ts';
import { courseTranslationReviewState } from '../lib/course-localization.ts';
import { parseScriptBlocks } from '../lib/narration-check.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const reviewRoot = resolve(root, 'docs/narration-reviews');
const narrationRoot = resolve(root, 'docs/narration');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const shortHash = (value) => hash(value).slice(0, 16);

function reviewPath(lessonId) {
  const match = lessonId.match(/^(.*)-l(\d+)$/);
  if (!match) return null;
  const [, rawModule, lessonNumber] = match;
  const moduleSlug = rawModule === 'intro-permaculture' ? 'intro' : rawModule;
  return resolve(reviewRoot, `${moduleSlug}-l${lessonNumber}.zu.full-draft.md`);
}

function sourceSnapshot(moduleId, lesson) {
  const narrationPath = resolve(narrationRoot, `${moduleId}.en.md`);
  const narrationText = existsSync(narrationPath) ? readFileSync(narrationPath, 'utf8') : '';
  const slides = narrationText ? parseScriptBlocks(narrationText) : [];
  const registeredSlides = (COURSE_NARRATION[moduleId]?.tracks ?? [])
    .filter(track => track.lesson === lesson.id)
    .map(track => track.slide);
  const lessonSlides = slides.filter(block => registeredSlides.includes(block.slide));
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      body: lesson.body,
      keyPoints: lesson.keyPoints,
      quiz: lesson.quiz,
    },
    narration: lessonSlides.map(block => ({ slide: block.slide, text: block.text })),
  };
}

function documentChecks(path) {
  if (!existsSync(path)) return { present: false, sha256: null };
  const text = readFileSync(path, 'utf8');
  return {
    present: true,
    sha256: shortHash(text),
  };
}

const lessons = COURSE_MODULES.flatMap(module => module.lessons.map(lesson => {
  const state = courseTranslationReviewState(lesson.id);
  const path = state.status === 'review-draft'
    ? reviewPath(lesson.id)
    : state.reviewDocument ? resolve(root, state.reviewDocument) : null;
  const doc = path ? documentChecks(path) : { present: false, sha256: null };
  const source = sourceSnapshot(module.id, lesson);
  const held = state.status === 'source-held';
  const baseline = state.status === 'published-audio-only';
  return {
    module: module.id,
    lesson: lesson.id,
    reviewStatus: state.status,
    reviewDocument: path ? relative(root, path) : null,
    reviewDocumentPresent: doc.present,
    reviewDocumentSha256: doc.sha256,
    englishSourceSha256: shortHash(JSON.stringify(source)),
    englishSlideCount: source.narration.length,
    sourceComparison: 'human comparison required; hashes identify the current source only',
    humanApprovalRecorded: false,
    readiness: held ? 'source-held' : baseline ? 'published-audio-only' :
      doc.present ? 'draft-needs-human-review' : 'review-material-missing',
  };
}));

const result = {
  schemaVersion: 1,
  audit: 'read-only; no learner publication or approval is inferred',
  lessons,
};

if (process.argv.includes('--pretty')) console.log(JSON.stringify(result, null, 2));
else console.log(JSON.stringify(result));
