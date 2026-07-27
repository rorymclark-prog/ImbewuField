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
  slides.push({ n: Number(m[1]), title: m[2].trim(), subtitle: m[3].trim(), start: m.index + m[0].length });
}
if (slides.length === 0) {
  while ((m = MONOLINGUAL.exec(raw))) {
    slides.push({ n: Number(m[1]), title: m[2].trim(), subtitle: '', start: m.index + m[0].length });
  }
}
slides.sort((a, b) => a.n - b.n);
if (slides.length === 0) {
  console.error(`\n  ✗ found no slide headings in ${scriptPath}\n`);
  process.exit(1);
}

// Body between this heading and the next, minus stage directions and rules.
slides.forEach((s, i) => {
  const end = i + 1 < slides.length ? raw.lastIndexOf('**', slides[i + 1].start) : raw.length;
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
    out.push(first.length > 90 ? first.slice(0, 87).replace(/[,\s]+$/, '') + '…' : first);
    if (out.length === 3) break;
  }
  return out;
}

const outDir = resolve((outRaw || join(homedir(), 'Downloads', `${moduleId}-${lang}-slides`)).replace(/^~/, homedir()));
mkdirSync(outDir, { recursive: true });

// Slide 1's own heading is literally "Isihloko (Title)" — a structural marker, not a title anyone
// wants on screen. The real module name lives in the script's H1, e.g.
//   # Izimbewu neLungelo kuZimbewu (Seeds and Seed Sovereignty) — Narration Script (isiZulu)
// so take it from there and drop the "— Narration Script (…)" tail.
const h1 = (raw.match(/^#\s+(.+)$/m) || [])[1] || moduleId;
const h1Clean = h1.replace(/\s*[—-]\s*Narration Script.*$/i, '').trim();
const h1Local = h1Clean.replace(/\s*\([^)]*\)\s*$/, '').trim();
const h1English = ((h1Clean.match(/\(([^)]+)\)\s*$/) || [])[1] || '').trim();

const payload = slides.map((s) => ({
  n: s.n,
  // Title card: the module's real name, not the structural "Isihloko / Title" marker.
  title: s.n === 1 ? h1Local || s.title : s.title,
  subtitle: s.n === 1 ? h1English || s.subtitle : s.subtitle,
  bullets: s.n === 1 ? [] : bullets(s.body), // title card stays clean
}));

const jsonPath = join(tmpdir(), `imbewu-slides-${moduleId}-${lang}.json`);
writeFileSync(jsonPath, JSON.stringify({ slides: payload, outDir, moduleId, lang, imagesDir }));

// ── Rendering happens in python/Pillow: no npm dependency added, and Pillow is already here.
const PY = String.raw`
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

cfg = json.load(open(sys.argv[1]))
W, H = 1600, 900

# App palette (components/design + student page), so the deck matches the product a farmer uses.
PAPER   = (251, 246, 236)
INK     = (32, 25, 15)
INK2    = (58, 48, 32)
GREEN   = (31, 77, 43)
AMBER   = (192, 122, 30)
MUTED   = (140, 122, 98)
RULE    = (227, 216, 196)

def font(names, size):
    for n in names:
        for base in ('/System/Library/Fonts/Supplemental/', '/System/Library/Fonts/', '/Library/Fonts/'):
            p = base + n
            if os.path.exists(p):
                try: return ImageFont.truetype(p, size)
                except Exception: pass
    return ImageFont.load_default()

# Georgia/Palatino carry diacritics cleanly and read warmer than a UI sans on a projector.
F_TITLE = font(['Georgia Bold.ttf','Georgia.ttf','Palatino.ttc','Times New Roman Bold.ttf'], 74)
F_SUB   = font(['Georgia Italic.ttf','Georgia.ttf','Palatino.ttc'], 34)
F_BULL  = font(['Helvetica.ttc','Arial.ttf','Verdana.ttf'], 38)
F_NUM   = font(['Helvetica.ttc','Arial.ttf'], 26)
F_FOOT  = font(['Helvetica.ttc','Arial.ttf'], 24)

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

def fit(im, box_w, box_h):
    """Contain, never crop: an instructional diagram that loses its edges loses its meaning."""
    r = min(box_w / im.width, box_h / im.height)
    return im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.LANCZOS)

for s in cfg['slides']:
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # A wide green band down the left edge — one strong constant so every slide reads as one deck.
    d.rectangle([0, 0, 26, H], fill=GREEN)
    d.rectangle([26, 0, 32, H], fill=AMBER)

    x = 110
    title_card = (s['n'] == 1)
    illus = find_illustration(s['n'])

    if title_card:
        # Title card: illustration sits BEHIND the words as a quiet band, not beside them, so the
        # module name still lands first.
        if illus:
            try:
                im = Image.open(illus).convert('RGB')
                band_h = int(H * 0.42)
                im = fit(im, W - 32, band_h)
                img.paste(im, ((W - im.width) // 2 + 16, H - im.height - 40))
            except Exception:
                pass
        lines = wrap(d, s['title'], F_TITLE, W - x - 140)
        y = 150
        for ln in lines:
            d.text((x, y), ln, font=F_TITLE, fill=INK); y += 92
        y += 12
        for ln in wrap(d, s['subtitle'], F_SUB, W - x - 140):
            d.text((x, y), ln, font=F_SUB, fill=MUTED); y += 46
        d.line([(x, y + 30), (x + 180, y + 30)], fill=AMBER, width=5)
    else:
        # With an illustration the slide splits: words left, picture right. Without one the text
        # keeps the full width it always had — no awkward empty column where a picture would be.
        text_w = (W - x - 140) if not illus else int(W * 0.44)
        y = 92
        for ln in wrap(d, s['title'], F_TITLE, text_w):
            d.text((x, y), ln, font=F_TITLE, fill=INK); y += 88
        for ln in wrap(d, s['subtitle'], F_SUB, text_w):
            d.text((x, y + 2), ln, font=F_SUB, fill=MUTED); y += 46
        y += 30
        d.line([(x, y), (x + text_w, y)], fill=RULE, width=2)
        y += 46
        for b in s['bullets']:
            d.ellipse([x + 4, y + 16, x + 20, y + 32], fill=AMBER)
            for i, ln in enumerate(wrap(d, b, F_BULL, text_w - 46)):
                d.text((x + 46, y), ln, font=F_BULL, fill=INK2); y += 50
            y += 22
        if illus:
            try:
                im = Image.open(illus).convert('RGB')
                col_x = x + text_w + 60
                im = fit(im, W - col_x - 70, H - 230)
                img.paste(im, (col_x + (W - col_x - 70 - im.width) // 2, (H - im.height) // 2))
            except Exception:
                pass

    d.text((W - 140, H - 74), f"{s['n']}/{total}", font=F_NUM, fill=MUTED, anchor='ra')
    d.text((x, H - 74), 'ImbewuField · Imbewu Yoshintso', font=F_FOOT, fill=MUTED)

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
