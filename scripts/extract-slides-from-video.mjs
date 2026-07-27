#!/usr/bin/env node
// Pull the distinct slide frames out of a NotebookLM Video Overview, so its illustrated visuals
// can be reused with OUR OWN narration instead of its AI hosts.
//
// WHY: NotebookLM makes genuinely rich illustrated slides — better than anything we can generate
// locally — but its video always bakes in English AI-host narration with no silent export. Muting
// and dubbing 33 lessons x 2 languages by hand is not a workflow. So: keep their pictures, drop
// their voice. Extract one still per slide, then feed those stills to build-lesson-video.mjs with
// our recorded isiZulu/English narration.
//
// USAGE
//   node scripts/extract-slides-from-video.mjs <video.mp4> [out-dir] [--expect N] [--threshold 0.25]
//   node scripts/extract-slides-from-video.mjs ~/Downloads/notebooklm-seeds.mp4 --expect 10
//
// Then:
//   node scripts/build-lesson-video.mjs seeds-sovereignty zu <out-dir>
//
// LANGUAGE WARNING: whatever text NotebookLM burned into those slides stays burned in. If the
// deck is in English, the extracted slides are in English — fine for a facilitator video, WRONG
// for a farmer-facing isiZulu lesson. Set NotebookLM's output language BEFORE generating if you
// want isiZulu slides. This script cannot translate pixels and does not pretend to.
//
// Requires ffmpeg (brew install ffmpeg).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

const [videoRaw, outRaw] = positional;
const expect = Number(flag('--expect', '0')) || 0;
const threshold = Number(flag('--threshold', '0.25'));

if (!videoRaw) {
  console.error(`
  Extract the distinct slides from a NotebookLM Video Overview.

    node scripts/extract-slides-from-video.mjs <video.mp4> [out-dir] [--expect N] [--threshold 0.25]

  --expect N   how many slides you know are in the deck. The script retries with a looser or
               tighter scene threshold until it finds exactly N — far more reliable than guessing.
`);
  process.exit(1);
}

try {
  execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
} catch {
  console.error('\n  ✗ ffmpeg is not on PATH. Install it with:  brew install ffmpeg\n');
  process.exit(1);
}

const video = resolve(videoRaw.replace(/^~/, homedir()));
if (!existsSync(video)) {
  console.error(`\n  ✗ no such video: ${video}\n`);
  process.exit(1);
}

const outDir = resolve(
  (outRaw || join(homedir(), 'Downloads', basename(video).replace(/\.[^.]+$/, '') + '-slides')).replace(/^~/, homedir()),
);

function extract(sceneThreshold, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  // scene detection: emit a frame whenever the picture changes by more than the threshold. A
  // slideshow's cuts are hard, so almost any threshold finds them — but NotebookLM animates
  // within a slide (pans, elements appearing), which is exactly what over-triggers a low
  // threshold and produces six near-identical frames of the same slide.
  // `eq(n,0)+` is load-bearing, not decoration: the very first frame of a video can never trigger
  // a scene CHANGE (there is nothing before it to differ from), so scene detection alone always
  // returns N-1 stills for an N-slide deck and silently loses the title card. Caught by
  // round-tripping a known 10-slide video and getting 9 back.
  execFileSync(
    'ffmpeg',
    ['-y', '-i', video, '-vf', `select='eq(n,0)+gt(scene,${sceneThreshold})',showinfo`, '-vsync', 'vfr',
     '-q:v', '2', join(dir, 'raw-%03d.png')],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  return readdirSync(dir).filter((f) => f.startsWith('raw-')).sort();
}

const tmpDir = outDir + '.tmp';
let best = null;

if (expect > 0) {
  // Walk thresholds from strict to loose and keep the first that yields exactly the expected
  // count; otherwise keep whichever came closest, so the farmer-facing failure is "you got 9 of
  // 10, here they are" rather than a silent wrong answer.
  const ladder = [0.5, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1, 0.08, 0.06, 0.04];
  for (const t of ladder) {
    const frames = extract(t, tmpDir);
    // The first frame of a video never triggers a scene cut, so a deck of N slides usually yields
    // N-1 detections; ffmpeg's own first-frame emission covers it, hence the tolerance below.
    if (!best || Math.abs(frames.length - expect) < Math.abs(best.count - expect)) {
      best = { threshold: t, count: frames.length, frames: frames.slice() };
    }
    if (frames.length === expect) break;
  }
  if (best.count !== expect) extract(best.threshold, tmpDir);
} else {
  const frames = extract(threshold, tmpDir);
  best = { threshold, count: frames.length, frames };
}

const frames = readdirSync(tmpDir).filter((f) => f.startsWith('raw-')).sort();
if (frames.length === 0) {
  rmSync(tmpDir, { recursive: true, force: true });
  console.error('\n  ✗ no scene changes found — is this actually a slideshow video?\n');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
frames.forEach((f, i) => {
  renameSync(join(tmpDir, f), join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`));
});
rmSync(tmpDir, { recursive: true, force: true });

const sizes = readdirSync(outDir).map((f) => statSync(join(outDir, f)).size);
const totalMb = (sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(1);

console.log(`\n  ${basename(video)}`);
console.log(`  scene threshold ${best.threshold}  →  ${frames.length} slides  (${totalMb} MB)\n`);
if (expect > 0 && frames.length !== expect) {
  console.log(`  ! expected ${expect}, got ${frames.length}.`);
  console.log(`    Look through ${outDir} and delete duplicates or add a missing slide by hand,`);
  console.log(`    then renumber slide-01..slide-NN contiguously. build-lesson-video.mjs will`);
  console.log(`    refuse to run on a gap rather than silently dropping one.\n`);
}
console.log(`  ✓ ${outDir}\n`);
console.log(`  CHECK BEFORE USING: open the folder and confirm each image is a DIFFERENT slide.`);
console.log(`  Animated builds inside one slide can produce near-duplicates — delete those.`);
console.log(`  Any text in these frames is whatever NotebookLM burned in; this cannot translate it.\n`);
console.log(`  Next:  node scripts/build-lesson-video.mjs <module-id> <lang> ${outDir}\n`);
