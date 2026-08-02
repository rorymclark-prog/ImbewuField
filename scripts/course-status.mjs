#!/usr/bin/env node
// Course production board — what is finished, what is missing, per module.
//
// WHY: producing a module is a chain across four tools and three people — ChatGPT builds the deck
// and narration script, Gemini/Antigravity records the voice, an isiZulu speaker reviews the
// translation, and the video is assembled here. Rory keeps asking "status?" and until now the only
// honest answer meant opening five directories and a manifest and holding it all in your head.
// So: read the actual artefacts on disk and print what is real. No status file to keep in sync —
// a status file drifts from the truth the moment someone forgets to update it, and then it is
// worse than nothing because it is confidently wrong.
//
// A cell says YES only when the artefact EXISTS. It never trusts a manifest entry alone: the
// manifest is a promise, the file is the delivery. Where the two disagree it says so loudly,
// because that disagreement is the exact bug tests/course-audio.test.ts exists to catch.
//
// USAGE
//   npm run course:status            full board
//   npm run course:status -- --todo  only what is missing, as a work list
//
// Runs under `node --import ./tests/register-alias.mjs` (see package.json) so it can import the
// TypeScript course data directly rather than re-parsing it — a second parser is a second source
// of truth waiting to drift from the first.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasNarrationBlocker } from '../lib/narration-blockers.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const TODO_ONLY = process.argv.includes('--todo');

const { COURSE_MODULES } = await import(join(ROOT, 'lib/course-modules.ts'));
const { COURSE_NARRATION } = await import(join(ROOT, 'lib/course-audio.ts'));

const LANGS = ['en', 'zu'];

/** Slide mp3s actually on disk for a module+language — the delivery, not the promise. */
function audioClips(moduleId, lang) {
  const dir = join(ROOT, 'public/course-audio', moduleId, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^slide-\d+\.mp3$/.test(f));
}

/** Narration script blocks. Must match the deck's slide count or build-lesson-video refuses.
 *
 *  BOTH HEADING WORDS, deliberately. The English scripts head each block `**Slide 7 — Title**`
 *  and the isiZulu ones `**Ikhasi 7 — Isihloko (Slide 7 — Title)**`. The first version of this
 *  counter matched only "Slide" and so reported every isiZulu script as having zero blocks —
 *  which then surfaced as a fake integrity failure against a manifest that was perfectly fine.
 *  An English-only parser in a bilingual course is a bug that reads as a content problem, which
 *  is the worst kind: it sends you to fix the wrong file. */
const SLIDE_HEADING = /^\*\*(?:Slide|Ikhasi)\s*\d+/gm;

function scriptBlocks(moduleId, lang) {
  const path = join(ROOT, 'docs/narration', `${moduleId}.${lang}.md`);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  return {
    blocks: (text.match(SLIDE_HEADING) || []).length,
    // Shared with tests/narration-scripts.test.ts. These used to be two different lists, and
    // the board printed "isiZulu script reviewed" for seven drafts the test was correctly
    // refusing to release.
    draft: hasNarrationBlocker(text),
  };
}

function illustrations(moduleId) {
  const dir = join(ROOT, 'public/course-images', moduleId);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
}

const rows = COURSE_MODULES.map((mod) => {
  const lessons = mod.lessons.length;
  const withImage = mod.lessons.filter((l) => l.infographicUrl).length;
  const promised = COURSE_NARRATION[mod.id]?.tracks.length ?? 0;

  const audio = {};
  for (const lang of LANGS) audio[lang] = audioClips(mod.id, lang).length;

  const script = {};
  for (const lang of LANGS) script[lang] = scriptBlocks(mod.id, lang);

  return { id: mod.id, title: mod.title, lessons, withImage, files: illustrations(mod.id), promised, audio, script };
});

// ── Integrity: a promise without a delivery, or audio nobody claims ───────────
// Both directions matter. A manifest entry with no file is a dead player button for a farmer on a
// metered connection; a file no manifest claims is a recording nobody can reach, and usually means
// a superseded take was left behind. tests/course-audio.test.ts fails the build on either.
const problems = [];
for (const r of rows) {
  for (const lang of LANGS) {
    if (r.promised && r.audio[lang] && r.audio[lang] !== r.promised) {
      problems.push(`${r.id}/${lang}: manifest promises ${r.promised} clips, ${r.audio[lang]} on disk`);
    }
    if (!r.promised && r.audio[lang]) {
      problems.push(`${r.id}/${lang}: ${r.audio[lang]} clips on disk that lib/course-audio.ts does not claim`);
    }
    // A script longer than the recording is NOT an integrity failure — it is the normal state of a
    // module whose script has been rewritten and is waiting to be re-recorded. Seeds-Sovereignty
    // sat exactly here: a new 24-block script against 10 existing clips. Flagging that as a problem
    // sends someone hunting for a bug in a module that is simply mid-production, and the two are
    // not even the same surface — the manifest feeds the app's per-lesson player, the script feeds
    // the video build. It belongs on the work list, which is where it goes below.
    const s = r.script[lang];
    if (s && r.promised && s.blocks !== r.promised && s.blocks < r.promised) {
      problems.push(`${r.id}/${lang}: script has only ${s.blocks} blocks but ${r.promised} clips are claimed`);
    }
  }
}

const mark = (ok, partial) => (ok ? '  ✓  ' : partial ? '  ~  ' : '  ·  ');
const pad = (s, n) => String(s).padEnd(n);

if (!TODO_ONLY) {
  console.log(`\n  ImbewuField course — ${rows.length} modules, ${rows.reduce((a, r) => a + r.lessons, 0)} lessons\n`);
  console.log(`  ${pad('MODULE', 22)}${pad('LESSONS', 9)}${pad('IMAGES', 9)}${pad('SCRIPT EN', 11)}${pad('SCRIPT ZU', 11)}${pad('AUDIO EN', 10)}AUDIO ZU`);
  console.log(`  ${'─'.repeat(80)}`);
  for (const r of rows) {
    const imgs = `${r.withImage}/${r.lessons}`;
    console.log(
      `  ${pad(r.id, 22)}${pad(r.lessons, 9)}${pad(imgs, 9)}` +
        pad(r.script.en ? `${r.script.en.blocks} blk` : '·', 11) +
        pad(r.script.zu ? `${r.script.zu.blocks} blk${r.script.zu.draft ? ' draft' : ''}` : '·', 11) +
        pad(r.audio.en ? `${r.audio.en} clip` : '·', 10) +
        (r.audio.zu ? `${r.audio.zu} clip` : '·'),
    );
  }
  console.log();
}

// ── The work list ─────────────────────────────────────────────────────────────
const todo = [];
for (const r of rows) {
  if (r.withImage < r.lessons) todo.push(`${r.id}: ${r.lessons - r.withImage} lesson illustration(s) missing (${r.withImage}/${r.lessons})`);
  if (!r.script.en) todo.push(`${r.id}: no English narration script — ChatGPT, deck + script prompt`);
  else if (!r.audio.en) todo.push(`${r.id}: English script written, not yet recorded — Antigravity, en-ZA voice`);
  else if (r.script.en.blocks > r.audio.en) todo.push(`${r.id}: English script rewritten to ${r.script.en.blocks} blocks, only ${r.audio.en} clips recorded — RE-RECORD`);
  if (!r.script.zu) todo.push(`${r.id}: no isiZulu script`);
  else if (r.script.zu.draft) todo.push(`${r.id}: isiZulu script is a DRAFT — needs a human isiZulu speaker before recording`);
  else if (!r.audio.zu) todo.push(`${r.id}: isiZulu script reviewed, not yet recorded`);
  else if (r.script.zu.blocks > r.audio.zu) todo.push(`${r.id}: isiZulu script rewritten to ${r.script.zu.blocks} blocks, only ${r.audio.zu} clips recorded — RE-RECORD`);
}

if (problems.length) {
  console.log('  ⚠ INTEGRITY — these fail tests/course-audio.test.ts:');
  for (const p of problems) console.log(`     ${p}`);
  console.log();
}

console.log(`  TO PRODUCE — ${todo.length} item(s)\n`);
for (const t of todo) console.log(`   · ${t}`);
console.log();

const done = rows.filter((r) => r.withImage === r.lessons && r.audio.en && r.audio.zu).length;
console.log(`  ${done}/${rows.length} modules fully produced (illustrated + narrated in both languages)\n`);
