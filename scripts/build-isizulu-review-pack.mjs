#!/usr/bin/env node
// Builds a static reviewer copy outside the repository. Nothing here is wired to learners.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { COURSE_NARRATION } from '../lib/course-audio.ts';
import { courseTranslationReviewState } from '../lib/course-localization.ts';
import { parseScriptBlocks } from '../lib/narration-check.ts';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
const narrationRoot = join(root, 'docs/narration');
const reviewRoot = join(root, 'docs/narration-reviews');
const expected = { lessons: 33, drafts: 25, held: 2, audioOnly: 6 };

function fail(message) {
  console.error(message);
  process.exit(1);
}

function outputArgument() {
  const index = process.argv.indexOf('--out-dir');
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) {
    fail('Usage: node scripts/build-isizulu-review-pack.mjs --out-dir /absolute/path/outside/repository');
  }
  const output = process.argv[index + 1];
  if (!isAbsolute(output)) fail('--out-dir must be an absolute path outside the repository.');
  return resolve(output);
}

function inside(base, target) {
  const path = relative(base, target);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
}

function safeOutputDirectory(candidate) {
  if (inside(root, candidate)) fail('--out-dir must be outside the repository and public assets.');

  let ancestor = candidate;
  const missing = [];
  while (!existsSync(ancestor)) {
    missing.unshift(ancestor.slice(dirname(ancestor).length + 1));
    const parent = dirname(ancestor);
    if (parent === ancestor) fail('Could not find an existing parent for --out-dir.');
    ancestor = parent;
  }
  const resolved = resolve(realpathSync(ancestor), ...missing);
  if (inside(root, resolved)) fail('--out-dir resolves into the repository; choose an external directory.');
  mkdirSync(resolved, { recursive: true });
  const realOutput = realpathSync(resolved);
  if (inside(root, realOutput)) fail('--out-dir resolves into the repository; choose an external directory.');
  return realOutput;
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function draftPath(lessonId) {
  const match = lessonId.match(/^(.*)-l(\d+)$/);
  if (!match) return null;
  const [, moduleName, lessonNumber] = match;
  const moduleSlug = moduleName === 'intro-permaculture' ? 'intro' : moduleName;
  return join(reviewRoot, `${moduleSlug}-l${lessonNumber}.zu.full-draft.md`);
}

function sourceFor(moduleId, lesson) {
  const narrationPath = join(narrationRoot, `${moduleId}.en.md`);
  const narration = existsSync(narrationPath) ? readFileSync(narrationPath, 'utf8') : '';
  const blocks = narration ? parseScriptBlocks(narration) : [];
  const registeredSlides = (COURSE_NARRATION[moduleId]?.tracks ?? [])
    .filter(track => track.lesson === lesson.id)
    .map(track => track.slide);
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      body: lesson.body,
      keyPoints: lesson.keyPoints,
      quiz: lesson.quiz,
    },
    narration: blocks
      .filter(block => registeredSlides.includes(block.slide))
      .map(block => ({ slide: block.slide, text: block.text })),
  };
}

function sourceMarkup(source) {
  const { lesson } = source;
  const quiz = lesson.quiz.map((question, index) => `<article class="quiz">
      <h4>Question ${index + 1}</h4>
      <p>${escapeHtml(question.q)}</p>
      <ol type="A">${question.options.map((option, optionIndex) => `<li${optionIndex === question.correct ? ' class="keyed"' : ''}>${escapeHtml(option)}${optionIndex === question.correct ? ' <strong>(keyed answer)</strong>' : ''}</li>`).join('')}</ol>
      <p><strong>Rationale:</strong> ${escapeHtml(question.rationale)}</p>
    </article>`).join('');
  const slides = source.narration.length
    ? source.narration.map(slide => `<li><strong>Slide ${slide.slide}:</strong> ${escapeHtml(slide.text)}</li>`).join('')
    : '<li>No registered English slide narration found for this lesson.</li>';

  return `<h3>Current English source</h3>
    <p class="fingerprint"><strong>Source SHA-256:</strong> <code>${sha256(JSON.stringify(source))}</code></p>
    <h4>Title</h4><p>${escapeHtml(lesson.title)}</p>
    <h4>Lesson body</h4><div class="preserve">${escapeHtml(lesson.body)}</div>
    <h4>Key points</h4><ul>${lesson.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
    <h4>Quiz questions, options, keyed answers and rationales</h4>${quiz}
    <h4>Registered English slide narration</h4><ol>${slides}</ol>`;
}

function statusLabel(status) {
  return ({
    'review-draft': 'IsiZulu lesson draft — human review required',
    'source-held': 'Held — source decision required before translation can proceed',
    'published-audio-only': 'Published isiZulu audio history only — lesson and quiz remain English',
    published: 'Translation record marked published — approval must be verified separately',
    unavailable: 'No isiZulu lesson translation record',
  })[status] ?? `Unmapped review state: ${status}`;
}

function lessonCard(module, lesson) {
  const state = courseTranslationReviewState(lesson.id);
  const source = sourceFor(module.id, lesson);
  const fullDraft = state.status === 'review-draft' ? draftPath(lesson.id) :
    state.status === 'source-held' && state.reviewDocument ? join(root, state.reviewDocument) : null;
  const draftText = fullDraft && existsSync(fullDraft) ? readFileSync(fullDraft, 'utf8') : null;
  const reviewSide = draftText === null
    ? `<h3>${state.status === 'published-audio-only' ? 'Draft lesson text not included' : 'Review material missing'}</h3>
       <p>${state.status === 'published-audio-only'
         ? 'This lesson has isiZulu narration history only. The audio is excluded from this pack; its lesson text and quiz have not been prepared here.'
         : 'No review document was available when this pack was generated.'}</p>`
    : `<h3>${state.status === 'source-held' ? 'Full source-hold review packet' : 'Full isiZulu draft Markdown'}</h3>
       <p class="fingerprint"><strong>${state.status === 'source-held' ? 'Hold packet' : 'Draft'} SHA-256:</strong> <code>${sha256(draftText)}</code></p>
       <pre class="markdown">${escapeHtml(draftText)}</pre>`;

  return `<section class="lesson" id="${escapeHtml(lesson.id)}" data-status="${escapeHtml(state.status)}">
    <header><p class="eyebrow">${escapeHtml(module.title)}</p><h2>${escapeHtml(lesson.title)}</h2>
      <p class="status">${escapeHtml(statusLabel(state.status))}</p></header>
    <div class="columns"><div class="source">${sourceMarkup(source)}</div><div class="review">${reviewSide}</div></div>
  </section>`;
}

const outputDirectory = safeOutputDirectory(outputArgument());
const modules = COURSE_MODULES;
const lessons = modules.flatMap(module => module.lessons.map(lesson => ({ module, lesson })));
const counts = lessons.reduce((result, { lesson }) => {
  const status = courseTranslationReviewState(lesson.id).status;
  result[status] = (result[status] ?? 0) + 1;
  return result;
}, {});
if (lessons.length !== expected.lessons || counts['review-draft'] !== expected.drafts ||
    counts['source-held'] !== expected.held || counts['published-audio-only'] !== expected.audioOnly) {
  fail(`Unexpected source inventory; expected ${JSON.stringify(expected)}, found ${JSON.stringify({
    lessons: lessons.length,
    drafts: counts['review-draft'] ?? 0,
    held: counts['source-held'] ?? 0,
    audioOnly: counts['published-audio-only'] ?? 0,
  })}. Reconcile the pack scope before generating.`);
}

const generatedAt = new Date().toISOString();
const nav = modules.map(module => `<li><a href="#module-${escapeHtml(module.id)}">${escapeHtml(module.title)} (${module.lessons.length})</a></li>`).join('');
const content = modules.map(module => `<section class="module" id="module-${escapeHtml(module.id)}">
  <h2>${escapeHtml(module.title)}</h2>${module.lessons.map(lesson => lessonCard(module, lesson)).join('')}
</section>`).join('');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>isiZulu course review pack</title>
<style>
  :root{color-scheme:light;--ink:#1f2b25;--muted:#56645d;--line:#cfd8cf;--paper:#fffef9;--wash:#f0f4ec;--hold:#fff2db;--draft:#e9f2e7}
  *{box-sizing:border-box}body{margin:0;background:#eef0e8;color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
  main{max-width:1440px;margin:auto;padding:clamp(16px,4vw,44px)}h1,h2,h3,h4{line-height:1.2}h1{font-size:clamp(2rem,5vw,3.2rem)}h2{font-size:1.8rem}h3{font-size:1.2rem;margin-top:0}h4{font-size:1rem;margin:1.2rem 0 .4rem}
  .intro,.module{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:clamp(18px,3vw,32px);margin-bottom:22px}.warning{background:var(--hold);border-left:5px solid #9c5b00;padding:16px;border-radius:8px}
  .overview{display:flex;gap:10px;flex-wrap:wrap}.pill,.status{display:inline-block;background:var(--draft);border-radius:999px;padding:5px 12px;font-weight:650}.status{border-radius:8px}.lesson{border-top:2px solid var(--line);padding:28px 0;scroll-margin-top:16px}.lesson[data-status="source-held"]{background:linear-gradient(90deg,var(--hold),transparent);padding-inline:14px}.lesson[data-status="published-audio-only"]{background:linear-gradient(90deg,#f0eff8,transparent);padding-inline:14px}
  .columns{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:20px;align-items:start}.source,.review{min-width:0;background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px}.source{border-top:4px solid #476b4c}.review{border-top:4px solid #805d32}.preserve,.markdown{white-space:pre-wrap;overflow-wrap:anywhere}.markdown{max-height:none;background:#f7f6f0;border-radius:8px;padding:14px;font:13px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace}.fingerprint{overflow-wrap:anywhere;font-size:.88rem;color:var(--muted)}code{overflow-wrap:anywhere}.quiz{border-top:1px solid var(--line);padding-top:10px}.keyed{font-weight:650}.eyebrow{color:var(--muted);font-size:.9rem;margin:0}
  nav ul{display:flex;gap:8px;flex-wrap:wrap;padding-left:20px}a{color:#245b36}footer{color:var(--muted);padding:24px 0}
  @media(max-width:850px){.columns{grid-template-columns:1fr}.lesson{padding-block:20px}.source,.review{padding:14px}.markdown{font-size:12px}}
  @media print{body{background:#fff}.intro,.module{border:0;padding:0}.lesson{break-inside:avoid}.markdown{max-height:none}nav{display:none}}
</style></head><body><main>
<section class="intro"><h1>isiZulu core course review pack</h1>
<p>Static comparison for independent fluent-language and local farming review. English source material appears beside the complete draft or source-hold packet. Drafts are not learner-ready. This pack records no human approval.</p>
<div class="warning"><strong>Recording freshness:</strong> a prior inventory counted 165 older isiZulu review recordings. They predate English lesson corrections made on 23 September 2026 and are treated as stale pending recheck. No audio files are included here.</div>
<p>Generated: <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedAt)}</time></p>
<div class="overview"><span class="pill">${lessons.length} core lessons</span><span class="pill">${counts['review-draft']} full draft comparisons</span><span class="pill">${counts['source-held']} source holds</span><span class="pill">${counts['published-audio-only']} audio-history-only</span></div>
<nav aria-label="Core course modules"><h2>Modules</h2><ul>${nav}</ul></nav></section>
${content}
<footer>Generated from the current English course module data, registered narration scripts, isiZulu review drafts and translation review state. SHA-256 fingerprints identify the exact text used; they do not establish translation accuracy or approval.</footer>
</main></body></html>`;

const { writeFileSync } = await import('node:fs');
const outputPath = join(outputDirectory, 'index.html');
writeFileSync(outputPath, html, { encoding: 'utf8', flag: 'wx' });
console.log(`Wrote static review pack: ${outputPath}`);
console.log(`Inventory: ${lessons.length} lessons; ${counts['review-draft']} draft, ${counts['source-held']} held, ${counts['published-audio-only']} audio-only.`);
console.log(`Generated at ${generatedAt}`);
