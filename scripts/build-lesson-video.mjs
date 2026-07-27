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
// A slide can now be a VIDEO CLIP instead of a still image — see "Motion slides" below. Some ideas
// (succession sowing, water soaking into a swale, a bee pollinating) only land in motion, and the
// sync guarantee still holds: a motion slide occupies EXACTLY its narration clip's length, by
// freezing or trimming the clip, never by stretching or compressing it.
//
// USAGE
//   node scripts/build-lesson-video.mjs <module-id> <lang> <slides-dir> [out.mp4]
//
//   node scripts/build-lesson-video.mjs seeds-sovereignty zu ~/Downloads/seeds-slides
//
// Slides:    <slides-dir>/slide-01.png (or .jpg/.jpeg/.webp) for a still,
//            <slides-dir>/slide-01.mp4 (or .mov) for a motion clip — same numbering, same folder,
//            pick ONE per slide number (a still AND a video for the same number is refused, see
//            "Motion slides" below).
// Narration: public/course-audio/<module-id>/<lang>/slide-01.mp3, ... (already in the repo —
//            put it there with scripts/import-course-audio.mjs first).
// Output:    <out.mp4>, default ~/Downloads/<module-id>-<lang>.mp4 — deliberately NOT inside the
//            repo: these are facilitator training videos, far too heavy to ship to a farmer's
//            phone, and public/ is served to every visitor.
//
// Motion slides (slide-NN.mp4 / .mov instead of slide-NN.png)
//   - The clip occupies EXACTLY its narration clip's duration — non-negotiable, same guarantee a
//     still slide has always had.
//   - Clip SHORTER than the narration: the last frame is held (frozen) for the remainder. It is
//     never looped — a looping bee is distracting under a sentence that has moved on.
//   - Clip LONGER than the narration: it is trimmed, and this script prints which slide and by how
//     much BEFORE building, e.g. "slide 07: 10.0s clip trimmed to 8.3s of narration", so you know
//     before you watch rather than discovering it mid-review.
//   - The clip's own audio is always dropped (`-an`) — narration is the only voice. Gemini/Veo
//     clips often carry near-silent ambience (~-34dB) that would otherwise muddy the mix.
//   - Resolution and frame rate are normalised across EVERY slide (still or motion) so the concat
//     can't fail or letterbox. When at least one slide is a motion clip, the whole video is built
//     at 24fps instead of the still-only path's 2fps — 2fps is fine for a static image but turns
//     real motion into an unwatchable slideshow, so it only applies when nothing is moving.
//   - A still AND a video for the same slide number is an ERROR, not a silent preference — which
//     one should win is a guess this script refuses to make. It names the slide and exits.
//
// See docs/COURSE-VISUAL-ASSETS.md for the full slide pipeline (make-lesson-slides.mjs ->
// optionally animate-lesson.mjs for a data-driven motion diagram -> this script).
//
// Requires ffmpeg on PATH (brew install ffmpeg).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
const VIDEO_EXTS = ['.mp4', '.mov'];
const ALL_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS];

// Shared across the still-only and motion-slide build paths so the two can never drift apart.
const SCALE_PAD_VF = 'scale=1280:-2,pad=ceil(iw/2)*2:ceil(ih/2)*2';
const MOTION_FPS = 24; // real motion needs a real frame rate; see "Motion slides" note above.
const DURATION_EPS = 0.05; // seconds — float-noise tolerance so a near-exact clip length doesn't
// randomly tip into the trim or freeze branch.

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

// Runs ffmpeg and dies with the tail of stderr + a label saying which step failed, rather than a
// bare non-zero exit — with several ffmpeg calls now in the motion-slide path, "which one broke"
// matters.
function runFfmpeg(args, label) {
  try {
    execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim().split('\n').slice(-8).join('\n') : '';
    die(`ffmpeg failed (${label}):\n${stderr}`);
  }
}

// Finds slide N as EITHER a still or a motion clip. Both existing for the same number is an error:
// which one should win is a guess, not a default this script is willing to make silently.
function findSlideAsset(dir, n) {
  const padded = String(n).padStart(2, '0');
  const image = IMAGE_EXTS.map((ext) => join(dir, `slide-${padded}${ext}`)).find(existsSync);
  const video = VIDEO_EXTS.map((ext) => join(dir, `slide-${padded}${ext}`)).find(existsSync);
  if (image && video) {
    die(
      `slide-${padded} has BOTH a still (${image.split('/').pop()}) and a video ` +
        `(${video.split('/').pop()}) — pick one. Which should win is a guess, so this refuses ` +
        `rather than silently preferring one.`,
    );
  }
  if (video) return { path: video, kind: 'video' };
  if (image) return { path: image, kind: 'image' };
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

// Pair each narration clip with its slide (still or video), and fail LOUDLY on a mismatch rather
// than quietly dropping a slide — a silently missing slide is the kind of error nobody notices
// until a facilitator is standing in front of a room.
const pairs = [];
for (let i = 1; i <= audioFiles.length; i++) {
  const padded = String(i).padStart(2, '0');
  const audio = join(audioDir, `slide-${padded}.mp3`);
  if (!existsSync(audio)) die(`narration clips are not contiguous — missing ${audio}`);
  const asset = findSlideAsset(slidesDir, i);
  if (!asset) {
    die(
      `narration has ${audioFiles.length} clips but there is no slide-${padded} still or video ` +
        `in ${slidesDir}\n    (looked for ${ALL_EXTS.join(', ')})`,
    );
  }
  const seconds = ffprobeDuration(audio);
  const entry = { ...asset, padded, audio, seconds };
  if (asset.kind === 'video') entry.clipSeconds = ffprobeDuration(asset.path);
  pairs.push(entry);
}

const extraSlides = readdirSync(slidesDir).filter(
  (f) => ALL_EXTS.some((e) => f.toLowerCase().endsWith(e)) && /^slide-\d+/.test(f),
).length;
if (extraSlides > pairs.length) {
  console.warn(
    `  ! ${extraSlides} slide files but only ${pairs.length} narration clips — ` +
      `slides ${pairs.length + 1}+ will be left out.`,
  );
}

const hasVideoSlide = pairs.some((p) => p.kind === 'video');

const outPath = resolve(
  (outRaw || join(homedir(), 'Downloads', `${moduleId}-${lang}.mp4`)).replace(/^~/, homedir()),
);
const total = pairs.reduce((s, p) => s + p.seconds, 0);

console.log(`\n  ${moduleId} · ${lang}`);
pairs.forEach((p) => {
  const tag = p.kind === 'video' ? '  [video]' : '';
  console.log(`   ${p.padded}  ${p.seconds.toFixed(1)}s  ${p.path.split('/').pop()}${tag}`);
});
console.log(`   ── ${pairs.length} slides · ${Math.floor(total / 60)}m ${Math.round(total % 60)}s\n`);

// Motion-slide behaviour, reported BEFORE building — so a trim is known before Rory watches, not
// discovered mid-review.
for (const p of pairs) {
  if (p.kind !== 'video') continue;
  const diff = p.clipSeconds - p.seconds;
  if (diff > DURATION_EPS) {
    console.warn(
      `  ! slide ${p.padded}: ${p.clipSeconds.toFixed(1)}s clip trimmed to ${p.seconds.toFixed(1)}s of narration`,
    );
  } else if (diff < -DURATION_EPS) {
    console.log(
      `    slide ${p.padded}: ${p.clipSeconds.toFixed(1)}s clip, holding last frame for ${(-diff).toFixed(1)}s more`,
    );
  }
}
if (hasVideoSlide) console.log('');

const work = mkdtempSync(join(tmpdir(), 'imbewu-video-'));
try {
  const audioList = join(work, 'audio.txt');
  writeFileSync(audioList, pairs.map((p) => `file '${p.audio.replace(/'/g, "'\\''")}'`).join('\n'));
  const joinedAudio = join(work, 'narration.m4a');
  runFfmpeg(
    ['-y', '-f', 'concat', '-safe', '0', '-i', audioList, '-c:a', 'aac', '-b:a', '128k', joinedAudio],
    'joining narration clips',
  );

  if (!hasVideoSlide) {
    // Original, unchanged path: concat demuxer of stills at 2fps — a slideshow needs no real
    // frame rate, and this keeps the file small. Kept exactly as before so nothing about the
    // still-only case (file size, quality, timing) changes for the 33 lessons already using it.
    //
    // Concat demuxer: each image held for exactly its narration length. The last entry is
    // repeated without a duration because the demuxer ignores the final duration otherwise
    // (documented ffmpeg quirk) — without this the last slide flashes past instead of being held.
    const listLines = [];
    for (const p of pairs) {
      listLines.push(`file '${p.path.replace(/'/g, "'\\''")}'`);
      listLines.push(`duration ${p.seconds.toFixed(3)}`);
    }
    listLines.push(`file '${pairs[pairs.length - 1].path.replace(/'/g, "'\\''")}'`);
    const listFile = join(work, 'slides.txt');
    writeFileSync(listFile, listLines.join('\n'));

    runFfmpeg(
      [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', listFile,
        '-i', joinedAudio,
        // Pad to even dimensions — H.264 rejects odd width/height, and slide exports are often odd.
        '-vf', SCALE_PAD_VF,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
        '-r', '2',
        '-c:a', 'copy',
        '-shortest',
        outPath,
      ],
      'building still-slide video',
    );
  } else {
    // At least one motion slide: build every slide as its own homogeneously-encoded segment
    // (same resolution, fps, codec) first, THEN concat those segments. The plain concat demuxer
    // that the still-only path uses does raw stream-level concatenation and requires matching
    // codecs across every entry — mixing PNG stills and an H.264 clip in it directly fails or
    // corrupts. Pre-encoding every slide to the same params sidesteps that, and doubles as the
    // "normalise resolution/fps" step needed so the concat can't fail or letterbox.
    pairs.forEach((p, i) => {
      const segPath = join(work, `seg-${p.padded}.mp4`);
      if (p.kind === 'image') {
        runFfmpeg(
          [
            '-y', '-loop', '1', '-i', p.path,
            '-t', p.seconds.toFixed(3),
            '-vf', SCALE_PAD_VF,
            '-r', String(MOTION_FPS),
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-an',
            segPath,
          ],
          `slide ${p.padded} (still segment)`,
        );
      } else {
        const shortfall = p.seconds - p.clipSeconds; // > 0 means the clip is shorter than narration
        const vf =
          shortfall > DURATION_EPS
            ? `${SCALE_PAD_VF},tpad=stop_mode=clone:stop_duration=${shortfall.toFixed(3)}`
            : SCALE_PAD_VF;
        runFfmpeg(
          [
            '-y', '-i', p.path,
            '-vf', vf,
            '-t', p.seconds.toFixed(3), // exact clamp either way: trims a long clip, caps a frozen one
            '-r', String(MOTION_FPS),
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
            '-an',
            segPath,
          ],
          `slide ${p.padded} (video segment)`,
        );
      }
      pairs[i].segPath = segPath;
    });

    const segList = join(work, 'segments.txt');
    writeFileSync(segList, pairs.map((p) => `file '${p.segPath.replace(/'/g, "'\\''")}'`).join('\n'));
    const silentPath = join(work, 'silent.mp4');
    // Segments are already homogeneously encoded above, so this concat is a plain stream copy.
    runFfmpeg(
      ['-y', '-f', 'concat', '-safe', '0', '-i', segList, '-c', 'copy', silentPath],
      'concatenating slide segments',
    );

    runFfmpeg(
      ['-y', '-i', silentPath, '-i', joinedAudio, '-c:v', 'copy', '-c:a', 'copy', '-shortest', outPath],
      'muxing narration onto the video',
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const sizeMb = (execFileSync('stat', ['-f', '%z', outPath], { encoding: 'utf8' }).trim() / 1e6).toFixed(1);
console.log(`  ✓ ${outPath}  (${sizeMb} MB)\n`);
console.log(`  Facilitator video — this is far too heavy for a farmer's phone. Host it and add`);
console.log(`  the URL as the lesson's videoUrl; the app renders it as a link, never an inline`);
console.log(`  player. See docs/COURSE-VISUAL-ASSETS.md.\n`);
