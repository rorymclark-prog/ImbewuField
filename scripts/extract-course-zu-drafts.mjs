#!/usr/bin/env node
// Converts the 25 source comparison packets into learner-shape data without rewriting proposals.
// The English catalog supplies canonical answer indexes; every translated field is read verbatim
// from its packet and this script fails closed when it cannot find a complete field.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { courseTranslationReviewState } from '../lib/course-localization.ts';
import { COURSE_TRANSLATION_DRAFT_OVERRIDES } from '../lib/course-translation-draft-overrides.ts';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'lib/course-translation-drafts.ts');
const expectedIds = COURSE_MODULES.flatMap(module => module.lessons)
  .filter(lesson => courseTranslationReviewState(lesson.id).status === 'review-draft')
  .map(lesson => lesson.id);
if (courseTranslationReviewState('small-livestock-l2').status !== 'source-held') {
  throw new Error('small-livestock-l2 is excluded because its English bee-registration and range claims remain source-held.');
}

function packetPath(id) {
  const match = id.match(/^(.*)-l(\d+)$/);
  if (!match) throw new Error(`Unsupported lesson id: ${id}`);
  const slug = match[1] === 'intro-permaculture' ? 'intro' : match[1];
  return resolve(root, `docs/narration-reviews/${slug}-l${match[2]}.zu.full-draft.md`);
}

function section(text, heading, nextHeading = /^## /m) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = text.search(new RegExp(`^## ${escaped}(?:\\s|$).*?$`, 'm'));
  if (start < 0) return '';
  const contentStart = text.indexOf('\n', start) + 1;
  const rest = text.slice(contentStart);
  const end = rest.search(nextHeading);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

function clean(value) {
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join(' ')
    .replace(/\s+/g, ' ').replace(/\\([*_])/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}

function cleanParagraphs(value) {
  return value.split(/\n\s*\n/).map(clean).filter(Boolean).join('\n\n');
}

function contentAfter(text, startExpression, stopExpression) {
  const start = text.search(startExpression);
  if (start < 0) return '';
  const lineEnd = text.slice(start).search(/\n/);
  const contentStart = start + (lineEnd < 0 ? 0 : lineEnd + 1);
  const rest = text.slice(contentStart);
  const stop = rest.search(stopExpression);
  return (stop < 0 ? rest : rest.slice(0, stop)).trim();
}

function between(text, startRe, endRe) {
  const start = text.search(startRe);
  if (start < 0) return '';
  const offset = text.slice(start).search(/\n/);
  const contentStart = start + (offset < 0 ? 0 : offset + 1);
  const rest = text.slice(contentStart);
  const end = rest.search(endRe);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

function proposalBlocks(text) {
  const marker = /^\*\*(?:Proposed )?isiZulu(?: proposal)?\s*:\*\*\s*|^### (?:Proposed )?isiZulu(?: proposal)?\s*$/gim;
  const found = [];
  for (const match of text.matchAll(marker)) {
    const start = match.index + match[0].length;
    const rest = text.slice(start);
    const stop = rest.search(/\n\s*(?:\*\*(?:English|Proposed|Drafting|Rationale|IsiZulu|Media|Safety|Source|Release|Keep|Correct)|### |## |\|)/i);
    const block = cleanParagraphs(stop < 0 ? rest : rest.slice(0, stop));
    if (block) found.push(block);
  }
  return found;
}

function bodyFor(text, source) {
  if (/^## Proposed learner lesson/m.test(text)) {
    const learner = section(text, 'Proposed learner lesson', /^## /m);
    const titleText = contentAfter(learner, /^### Title\s*$/m, /^### /m);
    const bodyText = contentAfter(learner, /^### Body\s*$/m, /^### /m);
    if (!bodyText) throw new Error('Proposed learner lesson has no Body field');
    const title = titleText ? clean(titleText) : source.title;
    return { title, body: bodyText.split(/\n\s*\n/).map(clean).join('\n\n') };
  }
  const part = section(text, 'Lesson body', /^## (?:Key points|Quiz)\b/m);
  if (!part) throw new Error('Lesson body section missing');
  const blocks = proposalBlocks(part);
  if (!blocks.length) throw new Error(`${source.id ?? 'lesson'}: no isiZulu body proposal found`);
  return { title: source.title, body: blocks.join('\n\n') };
}

function keyPointsFor(text, lessonId) {
  let part = section(text, 'Key points', /^## Quiz\b/m);
  if (!part && lessonId === 'intro-permaculture-l3') {
    const source = section(text, 'Proposed learner lesson', /^## Proposed quiz/m);
    const start = source.search(/^### Key points\s*$/m);
    if (start >= 0) {
      const offset = source.slice(start).search(/\n/);
      part = source.slice(start + offset + 1).trim();
    }
  }
  if (!part) throw new Error(`${lessonId}: key points section missing`);
  const rows = part.split(/\r?\n/).filter(line => /^\|/.test(line) && !/^\|\s*:?-+/.test(line));
  if (rows.length > 1) {
    const values = rows.slice(1).map(row => row.split('|').slice(1, -1).map(cell => cell.trim()).at(-1))
      .filter(Boolean).map(clean);
    if (values.length) return values;
  }
  const subsectionStart = part.search(/^### Proposed isiZulu\s*$/m);
  let listSource = part;
  if (subsectionStart >= 0) {
    const contentStart = part.indexOf('\n', subsectionStart) + 1;
    const rest = part.slice(contentStart);
    const nextSubsection = rest.search(/^### /m);
    listSource = nextSubsection < 0 ? rest : rest.slice(0, nextSubsection);
  }
  const values = [];
  for (const line of listSource.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:\d+[.)]|[-*])\s+(.+)$/);
    if (match) values.push(clean(match[1]));
    else if (values.length && /^\s{2,}\S/.test(line)) values[values.length - 1] += ` ${clean(line)}`;
  }
  if (!values.length) throw new Error('No translated key points found');
  return values;
}

function quizFor(text, source) {
  let quiz = section(text, 'Quiz', /^## (?:Narration|Slide narration|Proposed spoken script|Questions for|Reviewer|Source|Release)\b/m);
  if (!quiz && source.id === 'intro-permaculture-l3') quiz = section(text, 'Proposed quiz', /^## Proposed spoken script/m);
  if (!quiz) throw new Error(`${source.id}: quiz section missing`);
  if (source.id === 'intro-permaculture-l3') {
    const items = [...quiz.matchAll(/^\d+\.\s+\*\*Question:\*\*\s*([\s\S]*?)(?=^\d+\.\s+\*\*Question:\*\*|(?![\s\S]))/gm)];
    if (items.length !== source.quiz.length) throw new Error(`${source.id}: expected ${source.quiz.length} question blocks; found ${items.length}`);
    return items.map((item, index) => {
      const block = item[1];
      const lines = block.split(/\r?\n/);
      const bullets = [];
      let current = null;
      let questionLines = [];
      let rationaleText = '';
      let inRationale = false;
      for (const line of lines) {
        const option = line.match(/^\s*-\s*(?:\*\*)?[A-D](?:\s*\([^)]*\))?:(?:\*\*)?\s*(.*)$/);
        if (option) { current = option[1]; bullets.push(current); inRationale = false; continue; }
        const rationale = line.match(/^\s*\*\*Rationale:\*\*\s*(.*)$/);
        if (rationale) { current = null; inRationale = true; rationaleText = rationale[1]; continue; }
        if (inRationale) rationaleText += ` ${line.trim()}`;
        else if (current !== null && line.trim()) { bullets[bullets.length - 1] += ` ${line.trim()}`; }
        else if (!bullets.length && line.trim()) questionLines.push(line.trim());
      }
      const question = questionLines.join(' ');
      const options = bullets.map(clean);
      const rationale = clean(rationaleText);
      if (!question || options.length !== source.quiz[index].options.length || !rationale) throw new Error(`${source.id}: incomplete translated question ${index + 1}`);
      return { q: clean(question), options, correct: source.quiz[index].correct, rationale };
    });
  }
  const qBlocks = [];
  const headers = [...quiz.matchAll(/^### (?:Question\s*\d+|Q\d+)\b.*$/gm)];
  if (headers.length) {
    headers.forEach((h, i) => qBlocks.push(quiz.slice(h.index + h[0].length, headers[i + 1]?.index ?? quiz.length)));
  } else {
    const list = quiz.match(/^1\. \*\*Question\*\*:([\s\S]*?)(?=^## |^## |$)/m);
    if (!list) throw new Error('Could not identify quiz questions');
    const items = [...quiz.matchAll(/^\d+\. \*\*Question\*\*:\s*([\s\S]*?)(?=^\d+\. \*\*Question\*\*|$)/gm)];
    qBlocks.push(...items.map(item => item[1]));
  }
  if (qBlocks.length !== source.quiz.length) throw new Error(`Found ${qBlocks.length} questions; English source has ${source.quiz.length}`);
  return qBlocks.map((block, index) => {
    const markers = [];
    for (const row of block.split(/\r?\n/).filter(line => /^\|/.test(line))) {
      const firstCell = row.split('|')[1]?.trim() ?? '';
      const marked = firstCell.match(/^(?:\*\*)?([0-3]|[A-D])\s*(?:—|-)?\s*correct\b/i);
      if (marked) markers.push(/[A-D]/i.test(marked[1]) ? marked[1].toUpperCase().charCodeAt(0) - 65 : Number(marked[1]));
    }
    for (const match of block.matchAll(/\*\*(?:Correct option|Correct answer):\*\*\s*([0-3])\b/gi)) markers.push(Number(match[1]));
    for (const match of block.matchAll(/\*\*([A-D])\s*\(correct\)\*\*:/gi)) markers.push(match[1].toUpperCase().charCodeAt(0) - 65);
    if (!markers.length) throw new Error(`${source.id}: packet has no explicit correct-index marker for question ${index + 1}`);
    if (new Set(markers).size !== 1 || markers[0] !== source.quiz[index].correct) {
      throw new Error(`${source.id}: packet/source correct-index mismatch in question ${index + 1}: ${markers.join(',')} vs ${source.quiz[index].correct}`);
    }
    const question = block.match(/^\*\*(?:Proposed )?(?:isiZulu proposal|IsiZulu proposal|Proposed isiZulu question|isiZulu question):\*\*\s*([\s\S]*?)(?=\n\s*\||\n\s*\*\*(?:English|Rationale)|$)/im)
      ?? block.match(/^\*\*Question\*\*:\s*([\s\S]*?)(?=\n\s*- |\n\s*\*\*Rationale)/m);
    // Some packets supply English quiz questions beside isiZulu choices/rationales only.
    // Preserve the canonical English question verbatim instead of inventing a translation.
    const rows = block.split(/\r?\n/).filter(line => /^\|/.test(line) && !/^\|\s*:?-+/.test(line));
    let options = [];
    if (rows.length > 1) options = rows.slice(1).map(row => clean(row.split('|').slice(1, -1).map(cell => cell.trim()).at(-1)));
    if (!options.length) {
      options = [...block.matchAll(/^\s*-\s*(?:\*\*)?[A-D](?:\s*\([^)]*\))?(?:\*\*)?\s*:\s*([\s\S]*?)(?=\n\s*-\s*(?:\*\*)?[A-D]|\n\s*\*\*Rationale|$)/gm)].map(m => clean(m[1]));
    }
    if (options.length !== source.quiz[index].options.length) throw new Error(`Question ${index + 1}: found ${options.length} options; expected ${source.quiz[index].options.length}`);
    const rationale = block.match(/^\*\*(?:Rationale \(isiZulu\)|isiZulu rationale proposal|Proposed isiZulu rationale):\*\*\s*([\s\S]*?)(?=\n\s*### |$)/im)
      ?? block.match(/^\*\*Rationale\*\*:\s*([\s\S]*?)(?=\n\s*\d+\. \*\*Question|$)/m);
    if (!rationale) throw new Error(`Question ${index + 1}: isiZulu rationale missing`);
    return {
      q: question ? clean(question[1]) : source.quiz[index].q,
      options,
      correct: source.quiz[index].correct,
      rationale: clean(rationale[1]),
    };
  });
}

const data = {};
for (const module of COURSE_MODULES) for (const lesson of module.lessons) {
  if (courseTranslationReviewState(lesson.id).status !== 'review-draft') continue;
  const path = packetPath(lesson.id);
  const text = readFileSync(path, 'utf8');
  const body = bodyFor(text, lesson);
  const keyPoints = keyPointsFor(text, lesson.id);
  const quiz = quizFor(text, { ...lesson, id: lesson.id });
  const titleOverride = COURSE_TRANSLATION_DRAFT_OVERRIDES.titles[lesson.id];
  if (titleOverride) {
    if (titleOverride.source !== lesson.title) throw new Error(`${lesson.id}: title override source no longer matches the English catalog`);
    body.title = titleOverride.proposal;
  }
  const questionOverrides = COURSE_TRANSLATION_DRAFT_OVERRIDES.quizQuestions[lesson.id] ?? [];
  if (questionOverrides.length && questionOverrides.length !== lesson.quiz.length) {
    throw new Error(`${lesson.id}: expected an override for every quiz question`);
  }
  for (const [index, override] of questionOverrides.entries()) {
    if (override.source !== lesson.quiz[index]?.q) throw new Error(`${lesson.id}: quiz question ${index + 1} override source no longer matches the English catalog`);
    quiz[index].q = override.proposal;
  }
  if (keyPoints.length !== lesson.keyPoints.length) throw new Error(`${lesson.id}: ${keyPoints.length} key points vs ${lesson.keyPoints.length} source points`);
  data[lesson.id] = { ...body, keyPoints, quiz };
}

if (Object.keys(data).length !== 24 || expectedIds.length !== 24) throw new Error(`Expected 24 releasable review drafts; found ${Object.keys(data).length}`);
if (Object.keys(COURSE_TRANSLATION_DRAFT_OVERRIDES.titles).length !== 23 ||
    Object.values(COURSE_TRANSLATION_DRAFT_OVERRIDES.quizQuestions).flat().length !== 4) {
  throw new Error('Expected exactly 23 title and 4 question overrides; reconcile the explicit draft additions.');
}
const editorialMarker = /\*\*Explicit source holds?:\*\*|^\s*#{1,6}\s*(?:Reviewer questions?|Questions for|Source and safety holds?|Release boundary)|^\s*\*\*(?:Status|Unreviewed|English meaning|Sources and holds|Review only|Drafting note|Media\/source hold|Safety hold|Release boundary):/im;
for (const [lessonId, content] of Object.entries(data)) {
  for (const [field, value] of [['title', content.title], ['body', content.body], ...content.keyPoints.map((point, index) => [`keyPoints[${index}]`, point]),
    ...content.quiz.flatMap((question, index) => [[`quiz[${index}].q`, question.q], [`quiz[${index}].rationale`, question.rationale],
      ...question.options.map((option, optionIndex) => [`quiz[${index}].options[${optionIndex}]`, option])])]) {
    if (editorialMarker.test(value)) throw new Error(`${lessonId}.${field} contains packet review or hold text.`);
  }
}
const outputText = `import type { LocalizedLessonContent } from './course-localization';\n\n/** Unreviewed packet proposals, kept separate from published learner translations. */\nexport const COURSE_TRANSLATION_DRAFTS: Record<string, LocalizedLessonContent> = ${JSON.stringify(data, null, 2)};\n`;
writeFileSync(output, outputText);
console.log(`Wrote ${Object.keys(data).length} draft lesson records to ${output}`);
