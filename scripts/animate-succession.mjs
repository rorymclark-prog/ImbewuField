#!/usr/bin/env node
// Animate the succession-planting idea: four small sowings whose harvests OVERLAP.
//
// WHY THIS ONE, AND WHY ANIMATED AT ALL: "sow a short row every two to three weeks" is easy to
// say and easy to nod along to. What a farmer actually has to see is that sowing 4 has gone in
// while sowing 1 is still being eaten — the OVERLAP is the whole teaching, and a still image
// cannot show a thing overlapping in time. This is the hardest idea in Module 2 and the one a
// static slide serves worst.
//
// WHY NOT AI VIDEO: Veo-class tools generate photoreal footage, which (a) costs credits per
// second, and (b) will confidently produce the wrong plant — the exact NEMBA risk that already
// has two modules held for photographs. This is a diagram that moves. Its timing is DATA, not a
// model's guess, so it is free, exactly correct, and in the same house style as every slide.
//
// USAGE
//   node scripts/animate-succession.mjs [out.mp4] [--seconds 9]
//
// Output slots straight into a lesson video as a clip, or plays under slide 9's narration.
// Requires python3 + Pillow and ffmpeg (both already present).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const secIdx = args.indexOf('--seconds');
const SECONDS = secIdx >= 0 && args[secIdx + 1] ? Number(args[secIdx + 1]) : 9;
const outArg = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--seconds');
const outPath = resolve((outArg || join(homedir(), 'Downloads', 'succession-planting.mp4')).replace(/^~/, homedir()));

const FPS = 24;
const work = mkdtempSync(join(tmpdir(), 'imbewu-anim-'));

const PY = String.raw`
import os, sys, math
from PIL import Image, ImageDraw, ImageFont

outdir, frames_total, fps = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
W, H = 1600, 900

PAPER=(251,246,236); INK=(32,25,15); INK2=(58,48,32); GREEN=(31,77,43)
AMBER=(192,122,30); MUTED=(140,122,98); RULE=(227,216,196); SOIL=(150,112,72)

def font(names, size):
    for n in names:
        for b in ('/System/Library/Fonts/Supplemental/','/System/Library/Fonts/','/Library/Fonts/'):
            p=b+n
            if os.path.exists(p):
                try: return ImageFont.truetype(p,size)
                except Exception: pass
    return ImageFont.load_default()

F_TITLE=font(['Georgia Bold.ttf','Georgia.ttf'],62)
F_SUB=font(['Georgia Italic.ttf','Georgia.ttf'],30)
F_LBL=font(['Helvetica.ttc','Arial.ttf'],28)
F_SM=font(['Helvetica.ttc','Arial.ttf'],23)
F_FOOT=font(['Helvetica.ttc','Arial.ttf'],22)

# ── The data. Four sowings, each 2.5 "weeks" apart on a 16-week timeline; each grows for ~7
# weeks then yields for ~4. These are the lesson's own numbers ("every 2-3 weeks"), not invented
# agronomy — the point being demonstrated is the SHAPE of the overlap, not a crop calendar.
WEEKS = 16.0
SOW   = [0.0, 2.5, 5.0, 7.5]
GROW  = 7.0
YIELD = 4.0

LEFT, RIGHT = 300, 1500
TOP  = 300
ROW_H, ROW_GAP = 62, 26

def x_of(week): return LEFT + (RIGHT-LEFT) * (week / WEEKS)

def rounded(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

for f in range(frames_total):
    t = f / (frames_total - 1)          # 0..1
    # Ease so it settles rather than stopping dead — the last second is the "look at the overlap" beat.
    e = 1 - pow(1 - min(t / 0.86, 1.0), 3)
    now = e * WEEKS

    img = Image.new('RGB', (W,H), PAPER)
    d = ImageDraw.Draw(img)
    d.rectangle([0,0,26,H], fill=GREEN); d.rectangle([26,0,32,H], fill=AMBER)

    d.text((110,86), 'Sow Little and Often', font=F_TITLE, fill=INK)
    d.text((112,168), 'Four small sowings create overlapping harvests', font=F_SUB, fill=MUTED)

    # Timeline spine
    d.line([(LEFT,TOP-40),(RIGHT,TOP-40)], fill=RULE, width=2)
    for wk in range(0, int(WEEKS)+1, 4):
        x = x_of(wk)
        d.line([(x,TOP-48),(x,TOP-32)], fill=RULE, width=2)
        d.text((x, TOP-78), 'week %d'%wk, font=F_SM, fill=MUTED, anchor='ma')

    any_yield_now = 0
    for i, s in enumerate(SOW):
        y = TOP + i*(ROW_H+ROW_GAP)
        d.text((LEFT-40, y+ROW_H//2), 'SOW %d'%(i+1), font=F_LBL, fill=INK2, anchor='rm')
        # empty track
        rounded(d, [LEFT, y, RIGHT, y+ROW_H], ROW_H//2, (240,232,216))

        if now <= s:
            continue
        grow_end  = min(now, s+GROW)
        yield_end = min(now, s+GROW+YIELD)

        # growing (soil brown) then yielding (green) — two states, one bar
        gx = x_of(grow_end)
        rounded(d, [x_of(s), y, max(gx, x_of(s)+ROW_H), y+ROW_H], ROW_H//2, SOIL)
        if yield_end > s+GROW:
            yx = x_of(yield_end)
            bar_l, bar_r = x_of(s+GROW)-ROW_H//2, max(yx, x_of(s+GROW)+ROW_H//2)
            rounded(d, [bar_l, y, bar_r, y+ROW_H], ROW_H//2, GREEN)
            # Only label a bar wide enough to hold the word. A bar still growing into place would
            # otherwise push its label past the timeline's right edge and off the slide — which it
            # did on SOW 4 in the first render.
            if d.textlength('harvesting', font=F_SM) + 34 <= bar_r - bar_l:
                d.text((bar_l+26, y+ROW_H//2), 'harvesting', font=F_SM, fill=PAPER, anchor='lm')
            if s+GROW <= now <= s+GROW+YIELD:
                any_yield_now += 1
        else:
            gl, gr = x_of(s), max(gx, x_of(s)+ROW_H)
            if d.textlength('growing', font=F_SM) + 34 <= gr - gl:
                d.text((gl+18, y+ROW_H//2), 'growing', font=F_SM, fill=PAPER, anchor='lm')

    # "today" line sweeping right — what makes it read as time passing rather than bars appearing
    nx = x_of(now)
    d.line([(nx, TOP-56),(nx, TOP+4*(ROW_H+ROW_GAP)+10)], fill=AMBER, width=4)
    d.ellipse([nx-9, TOP-66, nx+9, TOP-48], fill=AMBER)

    # The payoff line: only speaks once two harvests genuinely coincide.
    if any_yield_now >= 2:
        msg = '%d harvests at once — food keeps coming' % any_yield_now
        tw = d.textlength(msg, font=F_LBL)
        bx0 = (W - tw)//2 - 26
        rounded(d, [bx0, 726, bx0+tw+52, 790], 32, GREEN)
        d.text((W//2, 758), msg, font=F_LBL, fill=PAPER, anchor='mm')

    d.text((110, H-70), 'ImbewuField · Imbewu Yoshintso', font=F_FOOT, fill=MUTED)
    img.save(os.path.join(outdir, 'f%04d.png'%f), 'PNG')
print('frames written')
`;

const pyPath = join(work, 'anim.py');
writeFileSync(pyPath, PY);
const frames = Math.round(SECONDS * FPS);

console.log(`\n  succession planting · ${SECONDS}s · ${frames} frames\n`);
try {
  execFileSync('python3', [pyPath, work, String(frames), String(FPS)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(work, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', outPath],
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
