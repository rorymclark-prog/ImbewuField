#!/usr/bin/env node
// Import a module's narration recordings into public/course-audio/.
//
//   node scripts/import-course-audio.mjs <moduleId> <sourceDir>
//   node scripts/import-course-audio.mjs seeds-sovereignty ~/Downloads/imbewu_seeds_audio
//
// The recordings are produced outside this repo (Rory narrates the facilitator deck through
// Gemini in Antigravity IDE, one clip per slide, per language). This script is the seam: it
// takes whatever that export looks like and lands it in the one layout lib/course-audio.ts
// expects, so adding the next module is one command rather than a manual copy and a hand-edited
// path list.
//
// Expected source shape (case-insensitive, extra files ignored):
//   <sourceDir>/english/Slide_01_English.mp3 ... Full_Narration_English.mp3
//   <sourceDir>/isizulu/Slide_01_isiZulu.mp3  ... Full_Narration_isiZulu.mp3
//
// Written shape:
//   public/course-audio/<moduleId>/<lang>/slide-01.mp3 ... full.mp3
//
// Nothing is deleted and nothing outside public/course-audio/<moduleId> is touched. Re-running
// overwrites that module's files, which is what you want after a re-record.

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';

// Directory name in the export -> app language code (lib/tts.ts LANG_TO_BCP47 keys).
// Add a row here when a new language is recorded; nothing else needs to change.
const LANG_DIRS = {
  english: 'en',
  en: 'en',
  isizulu: 'zu',
  zulu: 'zu',
  zu: 'zu',
  afrikaans: 'af',
  af: 'af',
};

const expandHome = (p) => (p.startsWith('~') ? join(homedir(), p.slice(1)) : p);

function fail(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

const [, , moduleId, rawSource] = process.argv;
if (!moduleId || !rawSource) {
  fail('Usage: node scripts/import-course-audio.mjs <moduleId> <sourceDir>');
}

const source = resolve(expandHome(rawSource));
if (!existsSync(source) || !statSync(source).isDirectory()) {
  fail(`Source is not a directory: ${source}`);
}

const outRoot = resolve(process.cwd(), 'public', 'course-audio', moduleId);

const imported = {};
let copied = 0;

for (const entry of readdirSync(source)) {
  const dir = join(source, entry);
  if (!statSync(dir).isDirectory()) continue;
  const lang = LANG_DIRS[entry.toLowerCase()];
  if (!lang) {
    console.warn(`  skipped (unknown language folder): ${entry}`);
    continue;
  }

  const outDir = join(outRoot, lang);
  mkdirSync(outDir, { recursive: true });
  const tracks = [];

  for (const file of readdirSync(dir)) {
    if (!/\.(mp3|m4a|wav|ogg)$/i.test(file)) continue;
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();

    const slide = file.match(/slide[_\-\s]*(\d+)/i);
    if (slide) {
      const n = String(Number(slide[1])).padStart(2, '0');
      const name = `slide-${n}${ext}`;
      copyFileSync(join(dir, file), join(outDir, name));
      tracks.push({ n: Number(slide[1]), name });
      copied += 1;
      continue;
    }

    if (/full[_\-\s]*narration|^full\b/i.test(file)) {
      copyFileSync(join(dir, file), join(outDir, `full${ext}`));
      copied += 1;
      continue;
    }

    console.warn(`  skipped (no slide number, not a full narration): ${entry}/${file}`);
  }

  tracks.sort((a, b) => a.n - b.n);
  imported[lang] = tracks;
}

const langs = Object.keys(imported);
if (langs.length === 0) fail(`No recognised language folders under ${source}`);

// A track present in one language but missing in another is the failure that actually bites:
// the player would silently drop a slide when a learner switches language. Say so, loudly.
const counts = langs.map((l) => `${l}=${imported[l].length}`).join(' ');
const sizes = new Set(langs.map((l) => imported[l].length));
console.log(`\n  Imported ${copied} files into public/course-audio/${moduleId}/  (${counts})`);
if (sizes.size > 1) {
  console.warn('  WARNING: languages have different track counts — a learner switching language will lose slides.');
}

const first = imported[langs[0]] ?? [];
console.log('\n  Add or update this module in lib/course-audio.ts:\n');
console.log(`    '${moduleId}': {`);
console.log(`      languages: [${langs.map((l) => `'${l}'`).join(', ')}],`);
console.log(`      tracks: [`);
for (const t of first) {
  console.log(`        { slide: ${t.n}, title: 'TODO — slide ${t.n} title', lesson: null },`);
}
console.log('      ],');
console.log('    },\n');
console.log('  Set `lesson` to the lesson id each slide belongs to, or null for module-level');
console.log('  intro/recap tracks, then run: npx tsc --noEmit && npm test\n');
