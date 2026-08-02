#!/usr/bin/env node
// Turn a narration script into a recording sheet — the exact text of each clip, one per slide.
//
// WHY: the recordings are made outside this repo (Rory narrates through Gemini in Antigravity,
// one clip per slide, per language) and scripts/import-course-audio.mjs is the seam that brings
// them back. Nothing existed for the OTHER end of that trip. The markdown script is written for
// a human — bold headings, [pause] marks, --- rules, a title line that is a structural marker
// rather than words anyone says — and every one of those has to come out before the text can be
// read aloud. Doing that by hand, 209 times across ten modules, is exactly how a clip ends up
// holding the wrong block: the Seeds isiZulu deck came back one slide short and shifted ELEVEN
// consecutive slides out of step with their narration, with nothing visibly broken to warn anyone.
//
// So the sheet is generated, numbered to match, and carries its own word count — which is what
// lib/narration-check.ts later divides clip duration by to catch a clip built from the wrong block.
//
// USAGE
//   node scripts/course-narration-export.mjs <module-id> [en|zu] [out-dir]
//   node scripts/course-narration-export.mjs --all en
//
// Writes <out-dir>/slide-NN.txt per slide, plus RECORD.md — the instruction sheet for whoever
// (or whatever) does the recording.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { COURSE_MODULES } from '../lib/course-modules.ts';

const argv = process.argv.slice(2);
const all = argv[0] === '--all';
const [moduleArg, langArg = 'en', outArg] = all ? [null, argv[1] || 'en', argv[2]] : argv;
const lang = (langArg || 'en').toLowerCase();

if ((!moduleArg && !all) || !['en', 'zu'].includes(lang)) {
  console.error('\n  node scripts/course-narration-export.mjs <module-id|--all> [en|zu] [out-dir]\n');
  console.error('modules:');
  for (const m of COURSE_MODULES) console.error(`  ${m.id}`);
  process.exit(1);
}

// Same two heading shapes make-lesson-slides.mjs reads, for the same reason: the isiZulu scripts
// are bilingual and the English ones are not. Read what is written rather than dictating a format.
const BILINGUAL = /^\*\*[^\n*]*?(\d+)\s*[—-]\s*([^(*\n]+?)\s*\((?:Slide|Ikhasi)\s*\d+\s*[—-]\s*([^)\n]+)\)\*\*\s*$/gm;
const MONOLINGUAL = /^\*\*(?:Slide|Ikhasi)\s*(\d+)\s*[—-]\s*([^*\n]+?)\s*\*\*\s*$/gm;

function parse(raw) {
  const slides = [];
  let m;
  BILINGUAL.lastIndex = 0;
  while ((m = BILINGUAL.exec(raw))) {
    slides.push({ n: Number(m[1]), title: m[2].trim(), head: m.index, start: m.index + m[0].length });
  }
  if (slides.length === 0) {
    MONOLINGUAL.lastIndex = 0;
    while ((m = MONOLINGUAL.exec(raw))) {
      slides.push({ n: Number(m[1]), title: m[2].trim(), head: m.index, start: m.index + m[0].length });
    }
  }
  slides.sort((a, b) => a.n - b.n);
  slides.forEach((s, i) => {
    // Where the NEXT heading begins. Searching backwards for '**' from the next block's start
    // lands on that heading's CLOSING marker, so the slice kept the whole of the next title —
    // and this is the file a narrator reads aloud, so slide 5 ended "Slide 6 — Test Your Soil
    // with a Jar" in the recorded voice.
    const end = i + 1 < slides.length ? slides[i + 1].head : raw.length;
    // What is actually SPOKEN: no stage directions, no rules, no headings, no markdown emphasis.
    s.text = raw
      .slice(s.start, end)
      // STOP AT AN APPENDIX. A reviewer appendix lives under its own '## ' heading AFTER the last
      // slide, and the last block runs to end-of-file — so without this the final clip is the
      // whole appendix read aloud. That is not hypothetical: vegetables-staples.zu.md's glossary
      // sat there and made block 18 thirteen times its English length.
      .split(/^#{1,6}\s/m)[0]
      .replace(/\[pause\]/gi, '')
      .replace(/^---\s*$/gm, '')
      .replace(/\*\*/g, '')
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
      .join('\n\n');
    s.words = s.text.split(/\s+/).filter(Boolean).length;
  });
  return slides;
}

function exportModule(moduleId) {
  const scriptPath = resolve(join(process.cwd(), 'docs', 'narration', `${moduleId}.${lang}.md`));
  if (!existsSync(scriptPath)) return null;

  const slides = parse(readFileSync(scriptPath, 'utf8'));
  if (!slides.length) return null;

  const outDir = resolve(
    (outArg || join(homedir(), 'Downloads', 'imbewu-record', `${moduleId}-${lang}`)).replace(/^~/, homedir()),
  );
  mkdirSync(outDir, { recursive: true });

  for (const s of slides) {
    writeFileSync(join(outDir, `slide-${String(s.n).padStart(2, '0')}.txt`), `${s.text}\n`);
  }

  const mod = COURSE_MODULES.find((m) => m.id === moduleId);
  const langName = lang === 'zu' ? 'isiZulu' : 'English';
  const voice = lang === 'zu' ? 'an isiZulu (zu-ZA) voice' : 'a South African English (en-ZA) voice';
  const total = slides.reduce((a, s) => a + s.words, 0);

  const sheet = [
    `# Recording sheet — ${mod?.title || moduleId} (${langName})`,
    '',
    `${slides.length} clips, ${total} words. One clip per slide, numbered to match the deck.`,
    '',
    '## What to produce',
    '',
    `Read each slide-NN.txt aloud in ${voice} and save the clip as its own mp3.`,
    'Name the files exactly as below — scripts/import-course-audio.mjs reads these names, and a',
    'clip under the wrong number puts the voice against the wrong picture for the rest of the deck.',
    '',
    '```',
    `${langName.toLowerCase()}/Slide_01_${langName}.mp3`,
    `${langName.toLowerCase()}/Slide_02_${langName}.mp3`,
    '...',
    `${langName.toLowerCase()}/Full_Narration_${langName}.mp3   (all slides read end to end)`,
    '```',
    '',
    'Then bring them back with:',
    '',
    '```',
    `node scripts/import-course-audio.mjs ${moduleId} <folder>`,
    '```',
    '',
    'That command checks the pacing of every clip against the word counts below and refuses a set',
    'where a clip is missing, empty, truncated, or built from the wrong block.',
    '',
    '## The clips',
    '',
    '| Slide | Words | Title |',
    '|---|---|---|',
    ...slides.map((s) => `| ${String(s.n).padStart(2, '0')} | ${s.words} | ${s.title} |`),
    '',
  ].join('\n');

  writeFileSync(join(outDir, 'RECORD.md'), sheet);
  return { moduleId, slides: slides.length, words: total, outDir };
}

const ids = all
  ? readdirSync(resolve(join(process.cwd(), 'docs', 'narration')))
      .filter((f) => f.endsWith(`.${lang}.md`))
      .map((f) => f.replace(`.${lang}.md`, ''))
  : [moduleArg];

console.log('');
let any = false;
for (const id of ids) {
  const r = exportModule(id);
  if (!r) {
    console.log(`  ·  ${id} — no ${lang} script`);
    continue;
  }
  any = true;
  console.log(`  ✓  ${r.moduleId} — ${r.slides} clips, ${r.words} words`);
  if (!all) console.log(`     ${r.outDir}`);
}
if (all && any) {
  console.log(`\n  ${resolve(join(homedir(), 'Downloads', 'imbewu-record'))}`);
}
console.log('');
