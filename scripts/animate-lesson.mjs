#!/usr/bin/env node
// Animated teaching diagrams for the ideas a still image cannot carry.
//
// WHY THESE EXIST: some things in this course are hard precisely because they happen over TIME or
// in SEQUENCE. "Four sowings overlap." "Water slows, spreads, then soaks in." "Establish the maize
// FIRST, then the beans climb it." A still image asserts those; a moving diagram shows them.
//
// DELIBERATELY NOT AI VIDEO. Veo-class tools bill per second and will confidently generate the
// wrong plant — the same NEMBA risk that has two modules held for photographs, and worse in motion
// because it looks more authoritative. Everything here is drawn from the lesson's own numbers, so
// it is free, exactly correct, reproducible, and in the same palette and type as every slide.
//
// USAGE
//   node scripts/animate-lesson.mjs <name> [out.mp4] [--seconds N]
//
//   succession     Module 2 slide 9  — four sowings whose harvests overlap
//   water-slope    Module 4 slide 1  — runoff slowed, spread and soaked in by a swale
//   three-sisters  Module 2 slide 10 — maize first, then beans climb, then pumpkin covers
//   zones          Module 1 slide 3  — rings tended less often the further from the door
//
// Requires python3 + Pillow and ffmpeg.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const NAMES = ['succession', 'water-slope', 'three-sisters', 'zones'];
const args = process.argv.slice(2);
const secIdx = args.indexOf('--seconds');
const SECONDS = secIdx >= 0 && args[secIdx + 1] ? Number(args[secIdx + 1]) : 9;
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--seconds');
const name = positional[0];

if (!name || !NAMES.includes(name)) {
  console.error(`\n  node scripts/animate-lesson.mjs <${NAMES.join('|')}> [out.mp4] [--seconds N]\n`);
  process.exit(1);
}
const outPath = resolve((positional[1] || join(homedir(), 'Downloads', `${name}.mp4`)).replace(/^~/, homedir()));

const FPS = 24;
const work = mkdtempSync(join(tmpdir(), 'imbewu-anim-'));

const PY = String.raw`
import os, sys, math
from PIL import Image, ImageDraw, ImageFont

which, outdir, frames_total = sys.argv[1], sys.argv[2], int(sys.argv[3])
W, H = 1600, 900

PAPER=(251,246,236); INK=(32,25,15); INK2=(58,48,32); GREEN=(31,77,43)
AMBER=(192,122,30); MUTED=(140,122,98); RULE=(227,216,196); SOIL=(150,112,72)
DEEPSOIL=(112,82,52); WATER=(35,94,134); LEAF=(108,142,86); PUMPKIN=(214,140,52)

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

def chrome(d, title, sub):
    d.rectangle([0,0,26,H], fill=GREEN); d.rectangle([26,0,32,H], fill=AMBER)
    d.text((110,86), title, font=F_TITLE, fill=INK)
    d.text((112,168), sub, font=F_SUB, fill=MUTED)
    d.text((110,H-70), 'ImbewuField · Imbewu Yoshintso', font=F_FOOT, fill=MUTED)

def rounded(d, box, r, fill): d.rounded_rectangle(box, radius=r, fill=fill)

def caption(d, msg):
    tw = d.textlength(msg, font=F_LBL)
    x0 = (W - tw)//2 - 26
    rounded(d, [x0, 762, x0+tw+52, 826], 32, GREEN)
    d.text((W//2, 794), msg, font=F_LBL, fill=PAPER, anchor='mm')

def ease(t, hold=0.86):
    return 1 - pow(1 - min(t/hold, 1.0), 3)

# ── SUCCESSION ────────────────────────────────────────────────────────────────────────────────
WEEKS=16.0; SOW=[0.0,2.5,5.0,7.5]; GROW=7.0; YIELD=4.0
LEFT,RIGHT,TOP = 300,1500,300; ROW_H,ROW_GAP = 62,26
def x_of(wk): return LEFT + (RIGHT-LEFT)*(wk/WEEKS)

def draw_succession(d, e):
    now = e*WEEKS
    chrome(d, 'Sow Little and Often', 'Four small sowings create overlapping harvests')
    d.line([(LEFT,TOP-40),(RIGHT,TOP-40)], fill=RULE, width=2)
    for wk in range(0,int(WEEKS)+1,4):
        x=x_of(wk); d.line([(x,TOP-48),(x,TOP-32)],fill=RULE,width=2)
        d.text((x,TOP-78),'week %d'%wk,font=F_SM,fill=MUTED,anchor='ma')
    live=0
    for i,s in enumerate(SOW):
        y=TOP+i*(ROW_H+ROW_GAP)
        d.text((LEFT-40,y+ROW_H//2),'SOW %d'%(i+1),font=F_LBL,fill=INK2,anchor='rm')
        rounded(d,[LEFT,y,RIGHT,y+ROW_H],ROW_H//2,(240,232,216))
        if now<=s: continue
        gx=x_of(min(now,s+GROW)); ye=min(now,s+GROW+YIELD)
        rounded(d,[x_of(s),y,max(gx,x_of(s)+ROW_H),y+ROW_H],ROW_H//2,SOIL)
        if ye> s+GROW:
            bl,br = x_of(s+GROW)-ROW_H//2, max(x_of(ye), x_of(s+GROW)+ROW_H//2)
            rounded(d,[bl,y,br,y+ROW_H],ROW_H//2,GREEN)
            if d.textlength('harvesting',font=F_SM)+34 <= br-bl:
                d.text((bl+26,y+ROW_H//2),'harvesting',font=F_SM,fill=PAPER,anchor='lm')
            if s+GROW<=now<=s+GROW+YIELD: live+=1
        else:
            gl,gr = x_of(s), max(gx,x_of(s)+ROW_H)
            if d.textlength('growing',font=F_SM)+34 <= gr-gl:
                d.text((gl+18,y+ROW_H//2),'growing',font=F_SM,fill=PAPER,anchor='lm')
    nx=x_of(now)
    d.line([(nx,TOP-56),(nx,TOP+4*(ROW_H+ROW_GAP)+10)],fill=AMBER,width=4)
    d.ellipse([nx-9,TOP-66,nx+9,TOP-48],fill=AMBER)
    if live>=2: caption(d,'%d harvests at once — food keeps coming'%live)

# ── WATER ON A SLOPE ──────────────────────────────────────────────────────────────────────────
# Left half: bare slope, water runs straight off. Right half: same slope with a swale, water is
# held, spreads sideways and soaks in. Same rain on both, so the DIFFERENCE is the whole point.
def slope_y(x, x0, x1, ytop, ybot):
    t=(x-x0)/(x1-x0); return ytop + (ybot-ytop)*t

def draw_panel(d, x0, x1, label, with_swale, e):
    ytop, ybot = 330, 640
    pts=[(x0,slope_y(x0,x0,x1,ytop,ybot))]
    for xx in range(int(x0), int(x1)+1, 8): pts.append((xx, slope_y(xx,x0,x1,ytop,ybot)))
    pts += [(x1,726),(x0,726)]
    d.polygon(pts, fill=SOIL)

    sw_x = x0 + (x1-x0)*0.55
    if with_swale:
        sy = slope_y(sw_x,x0,x1,ytop,ybot)
        d.ellipse([sw_x-70, sy-6, sw_x+70, sy+52], fill=DEEPSOIL)
        d.polygon([(sw_x+58,sy+8),(sw_x+112,sy+26),(sw_x+56,sy+30)], fill=DEEPSOIL)

    # falling rain, then flow
    for k in range(9):
        px = x0 + 46 + k*((x1-x0-92)/8.0)
        phase = (e*2.2 + k*0.11) % 1.0
        py = ytop - 150 + phase*150
        if py < slope_y(px,x0,x1,ytop,ybot):
            d.line([(px,py),(px,py+22)], fill=WATER, width=4)

    if e > 0.30:
        p = min((e-0.30)/0.45, 1.0)
        if with_swale:
            # runs to the swale, stops, then soaks sideways and down
            end = min(x0+30 + (sw_x-x0-30)*min(p*1.7,1.0), sw_x-4)
            d.line([(x0+30, slope_y(x0+30,x0,x1,ytop,ybot)-6),(end, slope_y(end,x0,x1,ytop,ybot)-6)], fill=WATER, width=9)
            if p > 0.58:
                q=(p-0.58)/0.42
                sy = slope_y(sw_x,x0,x1,ytop,ybot)
                d.ellipse([sw_x-66, sy+2, sw_x+66, sy+44], fill=WATER)
                for j in range(5):
                    dx = -60 + j*30
                    d.line([(sw_x+dx, sy+46),(sw_x+dx, sy+46+int(56*q))], fill=WATER, width=6)
                if q > 0.5:
                    d.text((sw_x, sy+128), 'soaks in', font=F_SM, fill=WATER, anchor='ma')
        else:
            end = x0+30 + (x1-40-x0-30)*p
            d.line([(x0+30, slope_y(x0+30,x0,x1,ytop,ybot)-6),(end, slope_y(end,x0,x1,ytop,ybot)-6)], fill=WATER, width=9)
            if p > 0.9:
                d.polygon([(x1-38,ybot-14),(x1-6,ybot+4),(x1-38,ybot+22)], fill=WATER)
                d.text((x1-52, ybot+46), 'runs away', font=F_SM, fill=WATER, anchor='ra')

    # Label drawn LAST: rain falls through the label band, and text under animated rain is
    # unreadable. Painting it on top costs nothing and keeps the panel legible every frame.
    d.text(((x0+x1)//2, 258), label, font=F_LBL, fill=INK2, anchor='ma')

def draw_water(d, e):
    chrome(d, 'Slowing Water on the Slope', 'A swale holds runoff long enough for it to soak in')
    draw_panel(d, 150, 740,  'BARE SLOPE',       False, e)
    draw_panel(d, 860, 1450, 'SLOPE WITH SWALE', True,  e)
    if e > 0.86: caption(d, 'Same rain. One slope keeps it.')

# ── THREE SISTERS ─────────────────────────────────────────────────────────────────────────────
# Sequence is the teaching: maize must be established BEFORE beans climb it.
def draw_sisters(d, e):
    chrome(d, 'Each Crop Earns Its Place', 'Establish the maize first, then the beans climb it')
    gy = 700
    d.rectangle([180, gy, 1420, gy+70], fill=SOIL)
    stalks = [420, 640, 860, 1080]
    m = min(e/0.42, 1.0)                       # maize grows first
    b = 0.0 if e < 0.40 else min((e-0.40)/0.34, 1.0)   # beans climb after
    p = 0.0 if e < 0.66 else min((e-0.66)/0.28, 1.0)   # pumpkin spreads last
    if p > 0:
        for k in range(9):
            px = 230 + k*152; r = int(62*p)
            d.ellipse([px-r, gy-r//2, px+r, gy+int(r*0.75)], fill=LEAF)
        if p > 0.7:
            for px in (500, 940, 1240):
                rr=int(24*min((p-0.7)/0.3,1.0))
                d.ellipse([px-rr, gy+6-rr, px+rr, gy+6+rr], fill=PUMPKIN)
    for sx in stalks:
        top = gy - int(380*m)
        # Tapered stalk — a constant-width line reads as a stick, not a plant.
        d.polygon([(sx-9, gy),(sx+9, gy),(sx+4, top),(sx-4, top)], fill=GREEN)
        for j in range(5):
            ly = gy - int(64*m) - j*int(70*m)
            if ly > top + 20:
                # Leaves arch: two segments per side, so they curve instead of spiking out.
                d.line([(sx, ly),(sx-52, ly-16)], fill=GREEN, width=9)
                d.line([(sx-52, ly-16),(sx-92, ly+4)], fill=GREEN, width=7)
                d.line([(sx, ly-14),(sx+52, ly-32)], fill=GREEN, width=9)
                d.line([(sx+52, ly-32),(sx+92, ly-14)], fill=GREEN, width=7)
        if m > 0.9:
            d.ellipse([sx+6, gy-186, sx+30, gy-126], fill=AMBER)
        if b > 0:
            bh = int((gy-top)*b)
            for s in range(0, bh, 12):
                yy = gy - s
                off = 18*math.sin(s/26.0)
                d.ellipse([sx+off-7, yy-7, sx+off+7, yy+7], fill=LEAF)
    lbl = 'maize gives height' if e<0.40 else ('beans climb and store protein' if e<0.66 else 'pumpkin covers the soil')
    caption(d, lbl)

# ── ZONES ─────────────────────────────────────────────────────────────────────────────────────
def draw_zones(d, e):
    chrome(d, 'Zones and Sectors', 'The ring nearest your door is the one you visit every day')
    cx, cy = 800, 520
    rings = [(120,'ZONE 1','every day'),(230,'ZONE 2','every few days'),
             (340,'ZONE 3','weekly'),(450,'ZONE 4','now and then')]
    for i,(r,nm,freq) in enumerate(rings):
        appear = i*0.19
        if e < appear: continue
        k = min((e-appear)/0.17, 1.0)
        rr = int(r*k)
        shade = 236 - i*14
        d.ellipse([cx-rr, cy-int(rr*0.62), cx+rr, cy+int(rr*0.62)], outline=(shade-40,shade-58,shade-84), width=3)
        if k > 0.85:
            # Labels stack in a clear column to the right with a leader back to their own ring.
            # Sitting them on the ring put ZONE 1's text behind the house — unreadable.
            ly = 300 + i*84
            d.line([(cx+rr-6, cy), (1230, ly+16)], fill=RULE, width=2)
            d.ellipse([cx+rr-13, cy-7, cx+rr+1, cy+7], fill=AMBER)
            d.text((1250, ly), nm, font=F_SM, fill=INK2)
            d.text((1250, ly+30), freq, font=F_SM, fill=MUTED)
    d.rectangle([cx-52, cy-40, cx+52, cy+34], fill=SOIL)
    d.polygon([(cx-64, cy-40),(cx, cy-84),(cx+64, cy-40)], fill=DEEPSOIL)
    d.rectangle([cx-14, cy-4, cx+14, cy+34], fill=DEEPSOIL)
    if e > 0.86: caption(d, 'Closest gets the most care')

DRAW = {'succession':draw_succession, 'water-slope':draw_water,
        'three-sisters':draw_sisters, 'zones':draw_zones}

for f in range(frames_total):
    t = f/(frames_total-1)
    img = Image.new('RGB',(W,H),PAPER); d = ImageDraw.Draw(img)
    DRAW[which](d, ease(t))
    img.save(os.path.join(outdir,'f%04d.png'%f),'PNG')
print('ok')
`;

const pyPath = join(work, 'anim.py');
writeFileSync(pyPath, PY);
const frames = Math.round(SECONDS * FPS);

console.log(`\n  ${name} · ${SECONDS}s · ${frames} frames\n`);
try {
  execFileSync('python3', [pyPath, name, work, String(frames)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', join(work, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', outPath], { stdio: ['ignore', 'ignore', 'pipe'] });
} catch (err) {
  const e = err.stderr ? err.stderr.toString().trim().split('\n').slice(-6).join('\n') : err.message;
  console.error(`\n  ✗ ${e}\n`);
  process.exit(1);
} finally {
  rmSync(work, { recursive: true, force: true });
}

const mb = (execFileSync('stat', ['-f', '%z', outPath], { encoding: 'utf8' }).trim() / 1e6).toFixed(1);
console.log(`  ✓ ${outPath}  (${mb} MB)\n`);
