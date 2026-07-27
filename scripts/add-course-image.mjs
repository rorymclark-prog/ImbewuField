#!/usr/bin/env node
// Take an infographic straight out of ChatGPT/NotebookLM and file it correctly: resized,
// compressed, renamed, and dropped in the right folder — with the size a farmer will actually
// pay for printed at the end.
//
// WHY: image tools export ~1536px PNGs of 1–2 MB. Farmers here are on entry-level Android over
// metered mobile data, so a 2 MB illustration is a real cost to them for one lesson. This makes
// "get it under 200 KB and into the right path" a command instead of 33 rounds of manual fiddling
// with a filename that has to match exactly or the app never shows it.
//
// USAGE — one image:
//   node scripts/add-course-image.mjs <source-file> <lesson-id>
//   node scripts/add-course-image.mjs ~/Downloads/gpt-seeds-1.png seeds-sovereignty-l1
//
// USAGE — a whole folder, matched by filename:
//   node scripts/add-course-image.mjs --batch ~/Downloads/gpt-images
//   Any file whose name CONTAINS a lesson id (e.g. "seeds-sovereignty-l2 final.png") is filed
//   to that lesson. Files that match nothing are listed and left alone — never guessed at.
//
// Uses macOS `sips` (built in). No dependency added.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const MAX_W = 1200;       // plenty for a phone; more is bytes a farmer pays for and cannot see
const TARGET_KB = 200;    // the budget in docs/COURSE-VISUAL-ASSETS.md
const QUALITY_LADDER = [72, 62, 52, 44, 36]; // step down only as far as needed to hit the budget

const args = process.argv.slice(2);
const batch = args[0] === '--batch';

function die(msg) { console.error(`\n  ✗ ${msg}\n`); process.exit(1); }
const kb = (p) => Math.round(statSync(p).size / 1024);

function lessonIds() {
  const src = readFileSafe(join(process.cwd(), 'lib', 'course-modules.ts'));
  const ids = [...src.matchAll(/id: "([a-z0-9-]+-l\d)"/g)].map((m) => m[1]);
  if (ids.length === 0) die('could not read lesson ids from lib/course-modules.ts — run this from the repo root');
  return ids;
}
function readFileSafe(p) {
  try { return execFileSync('cat', [p], { encoding: 'utf8' }); } catch { die(`cannot read ${p}`); }
}

const IDS = lessonIds();
const moduleOf = (lessonId) => lessonId.replace(/-l\d+$/, '');

function file(source, lessonId) {
  const src = resolve(source.replace(/^~/, homedir()));
  if (!existsSync(src)) die(`no such file: ${src}`);
  if (!IDS.includes(lessonId)) {
    die(`"${lessonId}" is not a lesson id.\n    Ids look like seeds-sovereignty-l1 — see the production sheet.`);
  }
  const dir = join(process.cwd(), 'public', 'course-images', moduleOf(lessonId));
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${lessonId}.jpg`);
  const before = kb(src);

  // Resize once, then walk the quality ladder only as far as the budget requires — re-encoding
  // from the ORIGINAL each time, never from an already-compressed pass, so we never stack
  // artefacts on artefacts.
  let used = null;
  for (const q of QUALITY_LADDER) {
    if (existsSync(out)) unlinkSync(out);
    execFileSync('sips', ['-Z', String(MAX_W), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(q), src, '--out', out], { stdio: ['ignore', 'ignore', 'pipe'] });
    used = q;
    if (kb(out) <= TARGET_KB) break;
  }

  const after = kb(out);
  const dims = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out], { encoding: 'utf8' })
    .match(/pixelWidth: (\d+)[\s\S]*pixelHeight: (\d+)/);
  const size = dims ? `${dims[1]}×${dims[2]}` : '';
  const flag = after > TARGET_KB ? '  ! still over budget — the picture may be too detailed' : '';
  console.log(`  ${lessonId.padEnd(26)} ${String(before).padStart(5)} KB → ${String(after).padStart(4)} KB  ${size.padEnd(10)} q${used}${flag}`);
  return { lessonId, after, over: after > TARGET_KB };
}

if (batch) {
  const dir = resolve((args[1] || '').replace(/^~/, homedir()));
  if (!args[1] || !existsSync(dir)) die('usage: node scripts/add-course-image.mjs --batch <folder>');
  const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  if (files.length === 0) die(`no images in ${dir}`);

  const matched = [];
  const unmatched = [];
  for (const f of files) {
    // Longest id first, so "…-l10" is never shadowed by "…-l1".
    const hit = [...IDS].sort((a, b) => b.length - a.length).find((id) => f.includes(id));
    if (hit) matched.push([f, hit]); else unmatched.push(f);
  }
  if (matched.length === 0) {
    die(`none of those filenames contain a lesson id.\n    Rename them to include e.g. seeds-sovereignty-l1, or file them one at a time.`);
  }

  console.log(`\n  filing ${matched.length} image${matched.length === 1 ? '' : 's'} into public/course-images/\n`);
  const results = matched.map(([f, id]) => file(join(dir, f), id));
  const over = results.filter((r) => r.over);
  console.log('');
  if (unmatched.length) {
    console.log(`  left alone (no lesson id in the filename) — never guessed at:`);
    unmatched.forEach((f) => console.log(`    · ${f}`));
    console.log('');
  }
  if (over.length) {
    console.log(`  ${over.length} still above ${TARGET_KB} KB. Not fatal, but on metered rural data it is`);
    console.log(`  a real cost — consider asking for a simpler picture with fewer elements.\n`);
  }
  console.log(`  Next: send Claude each filename plus one line on what it shows, for the alt text.\n`);
} else {
  const [source, lessonId] = args;
  if (!source || !lessonId) {
    console.error(`
  node scripts/add-course-image.mjs <source-file> <lesson-id>
  node scripts/add-course-image.mjs --batch <folder>

  e.g. node scripts/add-course-image.mjs ~/Downloads/gpt-1.png seeds-sovereignty-l1
`);
    process.exit(1);
  }
  console.log('');
  file(source, lessonId);
  console.log(`\n  Next: send Claude the filename plus one line on what it shows, for the alt text.\n`);
}
