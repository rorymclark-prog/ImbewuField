#!/usr/bin/env node
// Animate an EXISTING illustration by revealing its own annotation marks in narrative order.
//
// WHY THIS REPLACES DRAWING DIAGRAMS FROM SCRATCH: the hand-drawn course illustrations — textured
// soil, inked outlines, warm paper — are far better artwork than anything that can be drawn in
// Pillow. The first animation pass redrew the scene as flat shapes and looked, in Rory's words,
// "decent not amazing". It was competing with the artwork instead of using it.
//
// So: keep the picture exactly as drawn, and animate only its ANNOTATION LAYER — the blue arrows
// and water that explain what is happening. They appear in the order the process actually occurs,
// so a farmer watches runoff arrive, fill the swale, then soak outward into the soil. The teaching
// is in the sequence; the beauty is already in the file.
//
// TWO IMAGES, NOT ONE. Pass the scene WITHOUT its annotations and the same scene WITH them. The
// difference between them is an exact mask — no guessing, no reconstruction — and the reveal is
// then provably perfect.
//
// This is the second design. The first took ONE image and tried to erase the annotations
// automatically (isolate the blue marks, inpaint the hole). It does not work well enough to ship:
// thin arrows erase to grey ghosts, and a large filled region like a swale's water body cannot be
// reconstructed from its edges at all — one attempt left a black hole where the water had been.
// Reconstructing what an artist drew over is a genuinely hard problem, and the cheap fix is to
// not create it: ask for both versions when the artwork is commissioned. A second render of the
// same scene costs one extra prompt; a good inpainter costs far more and still guesses.
//
// USAGE
//   node scripts/animate-illustration.mjs <plain.jpg> <annotated.jpg> [out.mp4] [--seconds N] [--order downhill|outward|lr]
//
//   downhill   top-left to bottom-right — runoff arriving, then infiltration (water lessons)
//   outward    from the centre outward — radiating from a point
//   lr         plain left-to-right
//
// Requires python3 + Pillow and ffmpeg.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SECONDS = Number(flag('--seconds', '8'));
const ORDER = flag('--order', 'downhill');
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));

const plainPath = positional[0] && resolve(positional[0].replace(/^~/, homedir()));
const annotPath = positional[1] && resolve(positional[1].replace(/^~/, homedir()));
if (!plainPath || !annotPath || !existsSync(plainPath) || !existsSync(annotPath)) {
  console.error(`
  node scripts/animate-illustration.mjs <plain.jpg> <annotated.jpg> [out.mp4] [--seconds N] [--order downhill|outward|lr]

  Two renders of the SAME scene: one without its explanatory arrows, one with.
  Ask for both when commissioning the artwork — reconstructing the plain version
  from the annotated one does not work well enough to ship.
`);
  process.exit(1);
}
const outPath = resolve((positional[2] || join(homedir(), 'Downloads', basename(annotPath).replace(/\.[^.]+$/, '') + '-animated.mp4')).replace(/^~/, homedir()));

const FPS = 24;
const work = mkdtempSync(join(tmpdir(), 'imbewu-illus-'));

const PY = String.raw`
import os, sys, math
import numpy as np
from PIL import Image

plain_path, annot_path, outdir, frames_total, order = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]

plain = Image.open(plain_path).convert('RGB')
annot = Image.open(annot_path).convert('RGB')
if plain.size != annot.size:
    plain = plain.resize(annot.size, Image.LANCZOS)
W, H = annot.size
base = np.asarray(plain).astype(np.float32)
a = np.asarray(annot).astype(np.float32)

# The mask is simply where the two renders differ. Exact by construction — nothing is inferred,
# nothing is reconstructed, so an annotation of any size or colour reveals cleanly.
diff = np.abs(a - base).max(axis=2)
mask = diff > 18
if not mask.any():
    print('NO_MARKS'); sys.exit(2)

ys, xs = np.nonzero(mask)
cx, cy = W * 0.47, H * 0.46
if order == 'outward':
    rank = np.hypot(xs - cx, ys - cy)
elif order == 'lr':
    rank = xs.astype(np.float32)
else:
    # downhill: down and to the right, vertical dominating, so infiltration below a swale always
    # follows the runoff above it. The ORDER is the teaching.
    rank = ys * 1.7 + xs * 0.6
rank = rank.astype(np.float32)
lo, hi = float(rank.min()), float(rank.max())
span = (hi - lo) or 1.0

for f in range(frames_total):
    t = f / (frames_total - 1)
    prog = min(t / 0.78, 1.0)      # reveal, then hold on the finished picture
    prog = 1 - pow(1 - prog, 2)
    cutoff = lo + span * prog
    soft = span * 0.045            # soft leading edge so marks fade in rather than pop

    alpha = np.zeros((H, W), np.float32)
    alpha[ys, xs] = np.clip((cutoff - rank) / soft, 0.0, 1.0)
    frame = base * (1 - alpha[:, :, None]) + a * alpha[:, :, None]
    Image.fromarray(np.clip(frame, 0, 255).astype(np.uint8), 'RGB').save(os.path.join(outdir, 'f%04d.png' % f), 'PNG')

print('ok %d marks' % int(mask.sum()))
`;

const pyPath = join(work, 'illus.py');
writeFileSync(pyPath, PY);
const frames = Math.round(SECONDS * FPS);

console.log(`\n  ${basename(annotPath)} · ${SECONDS}s · order=${ORDER}\n`);
try {
  const out = execFileSync('python3', [pyPath, plainPath, annotPath, work, String(frames), ORDER], { encoding: 'utf8' });
  if (out.includes('NO_MARKS')) {
    console.error('  ✗ the two images are identical — nothing to reveal\n');
    process.exit(1);
  }
  console.log('  ' + out.trim());
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(work, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', outPath],
    { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (err) {
  const e = err.stderr ? err.stderr.toString().trim().split('\n').slice(-6).join('\n') : err.message;
  console.error(`\n  ✗ ${e}\n`);
  process.exit(1);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const mb = (execFileSync('stat', ['-f', '%z', outPath], { encoding: 'utf8' }).trim() / 1e6).toFixed(1);
console.log(`  ✓ ${outPath}  (${mb} MB)\n`);
