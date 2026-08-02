#!/usr/bin/env node
// Generate branded slide images for a module straight from its narration script.
//
// WHY: NotebookLM's Video Overview bakes in its own English AI-host narration with no silent
// export, and burns English text into every frame — neither is usable for an isiZulu module.
// Rather than generating there and then muting/dubbing 33 lessons x 2 languages by hand, we make
// the slides ourselves from the narration script that ALREADY defines them.
//
// docs/narration/<module>.<lang>.md is written in numbered slide sections with bilingual
// headings, e.g.  **Ikhasi 2 — Izinhlobo Ezimbili Zembewu (Slide 2 — Two Kinds of Seed)**
// so the deck structure and the narration can never drift apart: one file defines both.
//
// USAGE
//   node scripts/make-lesson-slides.mjs <module-id> <lang> [out-dir]
//   node scripts/make-lesson-slides.mjs seeds-sovereignty zu
//
// Then assemble the video with the narration already in the repo:
//   node scripts/build-lesson-video.mjs seeds-sovereignty zu ~/Downloads/seeds-sovereignty-zu-slides
//
// Requires python3 with Pillow (already present on this machine).

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { COURSE_MODULES } from '../lib/course-modules.ts';

const argv = process.argv.slice(2);
const imgFlag = argv.indexOf('--images');
const imagesDir = imgFlag >= 0 && argv[imgFlag + 1] ? resolve(argv[imgFlag + 1].replace(/^~/, homedir())) : null;
const positional = argv.filter((a, i) => a !== '--images' && argv[i - 1] !== '--images');
const [moduleId, lang, outRaw] = positional;
if (!moduleId || !lang) {
  console.error('\n  node scripts/make-lesson-slides.mjs <module-id> <lang> [out-dir]\n');
  process.exit(1);
}

const scriptPath = resolve(join(process.cwd(), 'docs', 'narration', `${moduleId}.${lang}.md`));
if (!existsSync(scriptPath)) {
  console.error(`\n  ✗ no narration script at docs/narration/${moduleId}.${lang}.md\n`);
  process.exit(1);
}

const raw = readFileSync(scriptPath, 'utf8');

// Two heading shapes exist in the wild, because the isiZulu scripts are bilingual and the English
// ones are not:
//   **Ikhasi 2 — Izinhlobo Ezimbili Zembewu (Slide 2 — Two Kinds of Seed)**   → title + subtitle
//   **Slide 2 — Two Kinds of Seed**                                          → title only
// Handle both rather than forcing one format on the writer: the narration script is authored
// content, and the tool should read what is written, not dictate it.
const BILINGUAL = /^\*\*[^\n*]*?(\d+)\s*[—-]\s*([^(*\n]+?)\s*\((?:Slide|Ikhasi)\s*\d+\s*[—-]\s*([^)\n]+)\)\*\*\s*$/gm;
const MONOLINGUAL = /^\*\*(?:Slide|Ikhasi)\s*(\d+)\s*[—-]\s*([^*\n]+?)\s*\*\*\s*$/gm;

const slides = [];
let m;
while ((m = BILINGUAL.exec(raw))) {
  slides.push({ n: Number(m[1]), title: m[2].trim(), subtitle: m[3].trim(), head: m.index, start: m.index + m[0].length });
}
if (slides.length === 0) {
  while ((m = MONOLINGUAL.exec(raw))) {
    slides.push({ n: Number(m[1]), title: m[2].trim(), subtitle: '', head: m.index, start: m.index + m[0].length });
  }
}
slides.sort((a, b) => a.n - b.n);
if (slides.length === 0) {
  console.error(`\n  ✗ found no slide headings in ${scriptPath}\n`);
  process.exit(1);
}

// Body between this heading and the next, minus stage directions and rules.
slides.forEach((s, i) => {
  // Where the NEXT heading BEGINS. Searching backwards for '**' from the next block's start
  // lands on that heading's CLOSING marker, so the body kept the whole of the next slide's title.
  // It stayed invisible only because the bullet cap usually cut it off first.
  const end = i + 1 < slides.length ? slides[i + 1].head : raw.length;
  s.body = raw
    .slice(s.start, end)
    .replace(/\[pause\]/gi, '')
    .replace(/^---\s*$/gm, '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
});

// A slide is a signpost, not a transcript — the narration carries the detail. Take the opening
// sentence of each paragraph, cap at 3 bullets and ~90 characters each, so nothing has to be
// squinted at on a projector at the back of a hall.
function bullets(paras) {
  const out = [];
  for (const p of paras) {
    const first = (p.split(/(?<=[.!?])\s/)[0] || p).trim();
    if (first.length < 12) continue;
    // Cut at a WORD boundary, and not at 90 characters.
    //
    // isiZulu is agglutinative — "angamasentimitha" is one word for what English says in three —
    // so a character cap tuned to English bites far harder there, and slicing blind produced
    // "i-greens ezingam…" mid-word, which reads as a rendering fault rather than an elision.
    // The block is centred and free to take a second line now, so the cap can be generous.
    let s = first;
    if (s.length > 132) {
      const cut = s.slice(0, 130);
      const sp = cut.lastIndexOf(' ');
      s = (sp > 60 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, '') + '…';
    }
    out.push(s);
    // Four, not three. A "Learning Outcomes" slide opens with a lead-in sentence and then lists
    // three outcomes, so a cap of three silently dropped the last one off every such slide.
    if (out.length === 4) break;
  }
  return out;
}

const outDir = resolve((outRaw || join(homedir(), 'Downloads', `${moduleId}-${lang}-slides`)).replace(/^~/, homedir()));
mkdirSync(outDir, { recursive: true });

// Slide 1's own heading is literally "Isihloko (Title)" — a structural marker, not a title anyone
// wants on screen. The real module name lives in the script's H1, e.g.
//   # Izimbewu neLungelo kuZimbewu (Seeds and Seed Sovereignty) — Narration Script (isiZulu)
// so take it from there and drop the "— Narration Script (…)" tail.
const h1 = (raw.match(/^#\s+(.+)$/m) || [])[1] || '';
const h1Clean = h1.replace(/\s*[—-]\s*Narration Script.*$/i, '').trim();
const h1Local = h1Clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
const h1English = ((h1Clean.match(/\(([^)]+)\)\s*$/) || [])[1] || '').trim();

// THE TITLE CARD MUST NEVER SHOW A MODULE ID. It used to fall back to the raw slug when a script
// had no H1 — which is most of them, because the English scripts are not bilingual and never
// needed one — so the first thing a learner saw was "intro-permaculture". The module's real title
// and description are authored data in lib/course-modules.ts; take them from there and treat the
// script's own H1 as an override for the languages that do carry one.
const mod = COURSE_MODULES.find((m) => m.id === moduleId);
const moduleNumber = COURSE_MODULES.findIndex((m) => m.id === moduleId) + 1;
const deckTitle = h1Local || mod?.title || moduleId;
const deckTagline = h1English || mod?.description || '';

// A slide the script marked as carried by a picture: "Watch: Bare Soil and Mulch". The words are
// deliberately thin on these — the picture is the teaching — so they get their own layout rather
// than being rendered as a normal slide that happens to look empty.
const WATCH = /^\s*(?:Watch|Bukela|Buka)\s*[:：]\s*/i;

const payload = slides.map((s) => {
  const watch = WATCH.test(s.title);
  const body = bullets(s.body);
  return {
    n: s.n,
    title: s.n === 1 ? deckTitle : s.title.replace(WATCH, ''),
    subtitle: s.n === 1 ? deckTagline : s.subtitle,
    watch,
    // A watch slide gets one line under the picture, not a bullet list competing with it.
    caption: watch ? body[0] || '' : '',
    bullets: s.n === 1 || watch ? [] : body,
  };
});

// Artwork the module already owns, used when the slides dir has nothing for a slide. Without this
// a freshly written module renders as 20 pages of text on cream, which is the exact gap between
// our decks and the Seeds deck they are measured against.
const lessonArt = (mod?.lessons ?? [])
  .map((l) => resolve(join(process.cwd(), 'public', 'course-images', moduleId, `${l.id}.jpg`)))
  .filter((p) => existsSync(p));

const jsonPath = join(tmpdir(), `imbewu-slides-${moduleId}-${lang}.json`);
writeFileSync(
  jsonPath,
  JSON.stringify({
    slides: payload,
    outDir,
    moduleId,
    lang,
    imagesDir,
    lessonArt,
    moduleNumber,
    footer: 'ImbewuField · Imbewu Yoshintso',
  }),
);

// ── Rendering happens in python/Pillow: no npm dependency added, and Pillow is already here.
const PY = String.raw`
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

cfg = json.load(open(sys.argv[1]))
W, H = 1920, 1080

# Palette read off the produced Seeds deck, which is the standard the rest of the course is
# measured against — warm paper, forest green for anything structural, ochre for the small
# signposting marks, rust reserved for the one italic line on the title card.
PAPER   = (245, 240, 228)
INK     = (32, 25, 15)
INK2    = (58, 48, 32)
GREEN   = (31, 77, 43)
AMBER   = (192, 122, 30)
RUST    = (156, 74, 47)
MUTED   = (140, 122, 98)
RULE    = (223, 213, 193)

def font(cands, size):
    """cands are (filename, ttc-index) — the good text faces on macOS ship as collections."""
    for name, idx in cands:
        for base in ('/System/Library/Fonts/Supplemental/', '/System/Library/Fonts/', '/Library/Fonts/'):
            p = base + name
            if os.path.exists(p):
                try: return ImageFont.truetype(p, size, index=idx)
                except Exception: pass
    return ImageFont.load_default()

SERIF_B = [('Georgia Bold.ttf', 0), ('Iowan Old Style.ttc', 1), ('Charter.ttc', 1)]
SERIF_I = [('Georgia Italic.ttf', 0), ('Charter.ttc', 2), ('Palatino.ttc', 2)]
SANS    = [('Avenir Next.ttc', 0), ('Helvetica.ttc', 0), ('Arial.ttf', 0)]
SANS_B  = [('Avenir Next.ttc', 1), ('Helvetica.ttc', 1), ('Arial Bold.ttf', 0)]

F_HERO   = font(SERIF_B, 92)   # title card only
F_TITLE  = font(SERIF_B, 60)
F_TAG    = font(SERIF_I, 40)   # the rust line under the module name
F_BULL   = font(SANS,   34)
F_CAP    = font(SANS_B, 27)    # caption under a watch frame
F_EYE    = font(SANS_B, 22)    # IMBEWUFIELD · MODULE 4
F_FOOT   = font(SANS,   22)
F_SUBT   = font(SERIF_I, 30)   # the English gloss under an isiZulu slide title

def track(d, xy, text, fnt, fill, sp=3):
    """Letter-spaced caps. Pillow has no tracking, and the eyebrow is the one place it matters."""
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=fnt, fill=fill)
        x += d.textlength(ch, font=fnt) + sp
    return x

def eyebrow(d, x, y, text):
    track(d, (x, y), text.upper(), F_EYE, AMBER)
    d.rectangle([x, y + 40, x + 92, y + 44], fill=AMBER)

def wrap(draw, text, fnt, maxw):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= maxw: cur = t
        else:
            if cur: lines.append(cur)
            cur = w
    if cur: lines.append(cur)
    return lines

total = len(cfg['slides'])
MODNUM = cfg.get('moduleNumber') or 0
LESSON_ART = [p for p in (cfg.get('lessonArt') or []) if os.path.exists(p)]
EYE = ('ImbewuField · Module %d' % MODNUM) if MODNUM else 'ImbewuField'

def find_illustration(n):
    """slide-NN.<ext> in the images dir, if one was supplied. Slides without one are not a
    failure — a module rarely has an illustration for every slide, and a text-only slide beside
    illustrated ones reads as deliberate pacing rather than a gap."""
    base = cfg.get('imagesDir')
    if not base:
        return None
    for ext in ('png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG'):
        p = os.path.join(base, 'slide-%02d.%s' % (n, ext))
        if os.path.exists(p):
            return p
    return None

WATCH_NS = [s['n'] for s in cfg['slides'] if s.get('watch')]

def art_for(s):
    """A per-slide picture wins. Failing that, the module's own lesson artwork is dealt to the
    title card and the watch slides ONLY — never to ordinary teaching slides, because three
    pictures spread over twenty pages means the same picture appearing five times, which reads
    as a mistake rather than as pacing. A watch slide with no picture at all is the one real
    failure: its words were deliberately written thin because a picture was meant to carry it."""
    p = find_illustration(s['n'])
    if p:
        return p
    if not LESSON_ART:
        return None
    if s['n'] == 1:
        return LESSON_ART[0]
    if s.get('watch'):
        # The k-th watch slide belongs to the k-th lesson: the script format allows at most one
        # per lesson and keeps them in lesson order, so position IS the lesson here.
        #
        # NO MODULO. Wrapping the index would hand a slide whatever picture the arithmetic landed
        # on, and a picture that contradicts the words under it is this project's worst failure —
        # the Seeds animations were matched by watching the clips for exactly that reason. If the
        # count does not line up, the assumption has broken and the honest answer is no picture.
        k = WATCH_NS.index(s['n'])
        return LESSON_ART[k] if k < len(LESSON_ART) else None
    return None

def fit(im, box_w, box_h):
    """Contain, never crop: an instructional diagram that loses its edges loses its meaning."""
    r = min(box_w / im.width, box_h / im.height)
    return im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)

def title_art(im, box_w, box_h):
    """The title card's picture, filling its panel where that costs nothing.

    Cropping to fill looks best and is safe for a scene — a farmer at a table, a stand of trees.
    It is NOT safe for a diagram: the lesson artwork includes record-keeping tables and layer
    cutaways, and a full-bleed crop of those slices the grid mid-cell and reads as a printing
    fault. Nothing here can tell a scene from a diagram, so the decision is made on how much
    would actually be thrown away: trim a little, never cut a third of the picture off."""
    scale = max(box_w / im.width, box_h / im.height)
    waste = 1 - (box_w * box_h) / (im.width * scale * im.height * scale)
    if waste <= 0.18:
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
        l, t = (im.width - box_w) // 2, (im.height - box_h) // 2
        return im.crop((l, t, l + box_w, t + box_h)), None
    # Too much would be lost — show the whole picture, centred on the paper.
    im = fit(im, int(box_w * 0.86), int(box_h * 0.7))
    return im, ((box_w - im.width) // 2, (box_h - im.height) // 2)

for s in cfg['slides']:
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)
    x = 132
    illus = art_for(s)

    if s['n'] == 1:
        # Title card: the picture holds the right of the frame edge to edge, the words keep a calm
        # column on the left. No bullets and no rule — the module's name is the whole job here.
        split = int(W * 0.44)
        if illus:
            try:
                im, off = title_art(Image.open(illus).convert('RGB'), W - split, H)
                img.paste(im, (split + off[0], off[1]) if off else (split, 0))
            except Exception:
                split = W
        tw = (split - x - 90) if illus else (W - x - 240)
        eyebrow(d, x, int(H * 0.085), EYE)
        y = int(H * 0.20)
        for ln in wrap(d, s['title'], F_HERO, tw):
            d.text((x, y), ln, font=F_HERO, fill=GREEN); y += 104
        y += 30
        for ln in wrap(d, s['subtitle'], F_TAG, tw):
            d.text((x, y), ln, font=F_TAG, fill=RUST); y += 52
        track(d, (x, H - 98), 'HOME-STUDY LESSON', F_EYE, GREEN)

    elif s.get('watch'):
        eyebrow(d, x, 64, EYE + ' · Animation')
        y = 138
        for ln in wrap(d, s['title'], F_TITLE, W - x - 240):
            d.text((x, y), ln, font=F_TITLE, fill=GREEN); y += 74
        top = y + 30
        box_w = int(W * 0.66)
        box_h = H - top - (140 if s.get('caption') else 90)
        if illus:
            try:
                im = fit(Image.open(illus).convert('RGB'), box_w, box_h)
                ix, iy = (W - im.width) // 2, top + (box_h - im.height) // 2
                d.rectangle([ix - 5, iy - 5, ix + im.width + 4, iy + im.height + 4], outline=AMBER, width=3)
                img.paste(im, (ix, iy))
                top = iy + im.height
            except Exception:
                pass
        if s.get('caption'):
            cy = top + 42
            for ln in wrap(d, s['caption'], F_CAP, int(W * 0.72)):
                d.text((W // 2, cy), ln, font=F_CAP, fill=INK, anchor='ma'); cy += 38

    else:
        text_w = int(W * 0.46) if illus else (W - x - 300)
        eyebrow(d, x, 64, EYE)
        y = 138
        for ln in wrap(d, s['title'], F_TITLE, text_w):
            d.text((x, y), ln, font=F_TITLE, fill=GREEN); y += 72
        if s['subtitle']:
            for ln in wrap(d, s['subtitle'], F_SUBT, text_w):
                d.text((x, y + 4), ln, font=F_SUBT, fill=MUTED); y += 42
        y += 20
        d.rectangle([x, y, x + text_w, y + 2], fill=RULE)
        y += 52

        # Measure before drawing, then centre the block in the space between the rule and the
        # footer. Three short points drawn from the top left the bottom HALF of every text-only
        # slide empty, which reads as a slide that failed to finish rather than as white space.
        blocks = [wrap(d, b, F_BULL, text_w - 48) for b in s['bullets']]
        block_h = sum(len(ls) * 46 + 30 for ls in blocks) - (30 if blocks else 0)
        avail = (H - 120) - y
        if block_h < avail:
            y += (avail - block_h) // 2
        for ls in blocks:
            d.ellipse([x + 3, y + 13, x + 17, y + 27], fill=AMBER)
            for ln in ls:
                d.text((x + 48, y), ln, font=F_BULL, fill=INK2); y += 46
            y += 30
        if illus:
            try:
                col = x + text_w + 72
                im = fit(Image.open(illus).convert('RGB'), W - col - 132, H - 300)
                img.paste(im, (col + (W - col - 132 - im.width) // 2, (H - im.height) // 2))
            except Exception:
                pass

    if s['n'] != 1:
        d.text((x, H - 62), cfg.get('footer') or '', font=F_FOOT, fill=MUTED)
        d.text((W - 132, H - 62), '%d/%d' % (s['n'], total), font=F_FOOT, fill=MUTED, anchor='ra')

    out = os.path.join(cfg['outDir'], 'slide-%02d.png' % s['n'])
    img.save(out, 'PNG')
    print('  %2d  %s' % (s['n'], s['title'][:58]))
`;

const pyPath = join(tmpdir(), 'imbewu-render-slides.py');
writeFileSync(pyPath, PY);

console.log(`\n  ${moduleId} · ${lang} — ${payload.length} slides from docs/narration/${moduleId}.${lang}.md\n`);
try {
  const out = execFileSync('python3', [pyPath, jsonPath], { encoding: 'utf8' });
  process.stdout.write(out);
} catch (err) {
  console.error(`\n  ✗ slide rendering failed:\n${err.stderr || err.message}\n`);
  process.exit(1);
}
console.log(`\n  ✓ ${outDir}\n`);
console.log(`  Next:  node scripts/build-lesson-video.mjs ${moduleId} ${lang} ${outDir}\n`);
