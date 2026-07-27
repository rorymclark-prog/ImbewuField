#!/usr/bin/env node
// Assemble a narrated lesson video from a NotebookLM slide export + our own recorded narration.
//
// WHY THIS EXISTS: NotebookLM's video generator always bakes in its own AI-host narration and
// offers no silent export, so an isiZulu module would ship with English AI voices talking over it.
// Their suggested workaround — export the video, mute it, and dub in an editor — is manual work
// repeated 33 lessons x 2 languages, and it re-syncs by hand every time content changes.
//
// Instead we take the SLIDE DECK (NotebookLM exports slides as images) and pair it with the
// narration we already produce in Gemini. Each slide is held on screen for exactly the length of
// its own narration clip, so audio and picture are in sync BY CONSTRUCTION rather than by careful
// scrubbing. Re-running the script after a content change costs one command.
//
// USAGE
//   node scripts/build-lesson-video.mjs <module-id> <lang> <slides-dir> [out.mp4]
//
//   node scripts/build-lesson-video.mjs seeds-sovereignty zu ~/Downloads/seeds-slides
//
// Slides:    <slides-dir>/slide-01.png (or .jpg/.jpeg/.webp), slide-02..., zero-padded.
// Narration: public/course-audio/<module-id>/<lang>/slide-01.mp3, ... (already in the repo —
//            put it there with scripts/import-course-audio.mjs first).
// Output:    <out.mp4>, default ~/Downloads/<module-id>-<lang>.mp4 — deliberately NOT inside the
//            repo: these are facilitator training videos, far too heavy to ship to a farmer's
//            phone, and public/ is served to every visitor.
//
// Requires ffmpeg on PATH (brew install ffmpeg).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

function die(msg) {
  console.error(`\n  ✗ ${msg}\n`);
  process.exit(1);
}

function ffprobeDuration(file) {
  const out = execFileSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  ).trim();
  const secs = Number.parseFloat(out);
  if (!Number.isFinite(secs) || secs <= 0) die(`could not read a duration from ${file}`);
  return secs;
}

function findSlide(dir, n) {
  const padded = String(n).padStart(2, '0');
  for (const ext of IMAGE_EXTS) {
    const p = join(dir, `slide-${padded}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

const [, , moduleId, lang, slidesDirRaw, outRaw] = process.argv;

if (!moduleId || !lang || !slidesDirRaw) {
  console.error(`
  Assemble a narrated lesson video from slides + our own narration.

    node scripts/build-lesson-video.mjs <module-id> <lang> <slides-dir> [out.mp4]

  e.g. node scripts/build-lesson-video.mjs seeds-sovereignty zu ~/Downloads/seeds-slides
`);
  process.exit(1);
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  die('ffmpeg is not on PATH. Install it with:  brew install ffmpeg');
}

const slidesDir = resolve(slidesDirRaw.replace(/^~/, homedir()));
if (!existsSync(slidesDir)) die(`no such slides directory: ${slidesDir}`);

const audioDir = resolve(join(process.cwd(), 'public', 'course-audio', moduleId, lang));
if (!existsSync(audioDir)) {
  die(
    `no narration at public/course-audio/${moduleId}/${lang}/\n` +
      `    Import it first:  node scripts/import-course-audio.mjs ${moduleId} <export-dir>`,
  );
}

const audioFiles = readdirSync(audioDir)
  .filter((f) => /^slide-\d+\.mp3$/.test(f))
  .sort();
if (audioFiles.length === 0) die(`no slide-NN.mp3 narration clips in ${audioDir}`);

// Pair each narration clip with its slide image, and fail LOUDLY on a mismatch rather than
// quietly dropping a slide — a silently missing slide is the kind of error nobody notices until
// a facilitator is standing in front of a room.
const pairs = [];
for (let i = 1; i <= audioFiles.length; i++) {
  const audio = join(audioDir, `slide-${String(i).padStart(2, '0')}.mp3`);
  if (!existsSync(audio)) die(`narration clips are not contiguous — missing ${audio}`);
  const image = findSlide(slidesDir, i);
  if (!image) {
    die(
      `narration has ${audioFiles.length} clips but there is no slide-${String(i).padStart(2, '0')} ` +
        `image in ${slidesDir}\n    (looked for ${IMAGE_EXTS.join(', ')})`,
    );
  }
  pairs.push({ image, audio, seconds: ffprobeDuration(audio) });
}

const extraSlides = readdirSync(slidesDir).filter((f) =>
  IMAGE_EXTS.some((e) => f.toLowerCase().endsWith(e)) && /^slide-\d+/.test(f),
).length;
if (extraSlides > pairs.length) {
  console.warn(
    `  ! ${extraSlides} slide images but only ${pairs.length} narration clips — ` +
      `slides ${pairs.length + 1}+ will be left out.`,
  );
}

const outPath = resolve(
  (outRaw || join(homedir(), 'Downloads', `${moduleId}-${lang}.mp4`)).replace(/^~/, homedir()),
);
const total = pairs.reduce((s, p) => s + p.seconds, 0);

console.log(`\n  ${moduleId} · ${lang}`);
pairs.forEach((p, i) => {
  console.log(`   ${String(i + 1).padStart(2, '0')}  ${p.seconds.toFixed(1)}s  ${p.image.split('/').pop()}`);
});
console.log(`   ── ${pairs.length} slides · ${Math.floor(total / 60)}m ${Math.round(total % 60)}s\n`);

const work = mkdtempSync(join(tmpdir(), 'imbewu-video-'));
try {
  // Concat demuxer: each image held for exactly its narration length. The last entry is repeated
  // without a duration because the demuxer ignores the final duration otherwise (documented
  // ffmpeg quirk) — without this the last slide flashes past instead of being held.
  const listLines = [];
  for (const p of pairs) {
    listLines.push(`file '${p.image.replace(/'/g, "'\\''")}'`);
    listLines.push(`duration ${p.seconds.toFixed(3)}`);
  }
  listLines.push(`file '${pairs[pairs.length - 1].image.replace(/'/g, "'\\''")}'`);
  const listFile = join(work, 'slides.txt');
  writeFileSync(listFile, listLines.join('\n'));

  const audioList = join(work, 'audio.txt');
  writeFileSync(audioList, pairs.map((p) => `file '${p.audio.replace(/'/g, "'\\''")}'`).join('\n'));

  const joinedAudio = join(work, 'narration.m4a');
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', audioList, '-c:a', 'aac', '-b:a', '128k', joinedAudio], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });

  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-i', joinedAudio,
      // Pad to even dimensions — H.264 rejects odd width/height, and slide exports are often odd.
      '-vf', 'scale=1280:-2,pad=ceil(iw/2)*2:ceil(ih/2)*2',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-r', '2', // a slideshow needs no real frame rate; 2fps keeps the file small
      '-c:a', 'copy',
      '-shortest',
      outPath,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
} catch (err) {
  const stderr = err.stderr ? err.stderr.toString().trim().split('\n').slice(-8).join('\n') : '';
  die(`ffmpeg failed:\n${stderr}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const sizeMb = (execFileSync('stat', ['-f', '%z', outPath], { encoding: 'utf8' }).trim() / 1e6).toFixed(1);
console.log(`  ✓ ${outPath}  (${sizeMb} MB)\n`);
console.log(`  Facilitator video — this is far too heavy for a farmer's phone. Host it and add`);
console.log(`  the URL as the lesson's videoUrl; the app renders it as a link, never an inline`);
console.log(`  player. See docs/COURSE-VISUAL-ASSETS.md.\n`);
