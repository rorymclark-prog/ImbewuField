#!/usr/bin/env node
// Render a module's slide deck as SVG, straight from the content that already exists.
//
// WHY THIS EXISTS
// ---------------
// Seeds was produced by hand: 24 painted, laid-out JPEGs, one bespoke composition per slide. That
// is the right way to make one module and the wrong way to make nine, and the nine that have
// English narration today have no deck at all — a farmer gets the reading page and loses the
// sequence the course was authored in.
//
// This renderer does not try to reproduce Seeds. It cannot: Seeds' register is illustration, and
// an illustrator is a person, not a script. It produces the OTHER honest register — a clean
// typographic slide that is plainly what it is. Read the report in the PR: the two registers
// differ on purpose, and a deck that looks like a poor imitation of the painted one would be worse
// than one that never pretended.
//
// WHY SVG AND NOT JPEG
// --------------------
// The audience is smallholders in KwaZulu-Natal buying data by the megabyte. Seeds' stills are
// 47–152 KB each; these are 3–6 KB. A whole 22-slide module lands under 100 KB — roughly what ONE
// slide of Seeds costs. On a metered connection that is not a nicety, it is the entire argument.
//
// Three further things fall out of it, and they matter on a phone:
//   * A 16:9 slide inside a phone-width card is small. SVG is resolution-independent, so turning
//     the handset sideways or pinching to zoom gives sharp type at any size. A 960 px JPEG goes
//     soft the moment anyone does that — which is exactly when a farmer is trying to read it.
//   * There is no `hi/` twin to produce or to ship. The standard file IS the high-quality file.
//   * The bytes recorded in lib/course-asset-sizes.ts are the UNCOMPRESSED file size. SVG is text
//     and every server gzips it, so the number the download button shows is an honest ceiling the
//     real transfer comes in under — the direction of error we want.
//
// DETERMINISM
// -----------
// Same inputs, same bytes. No AI, no network, no randomness, no clock. Every string on a slide is
// lifted verbatim from docs/narration/<module>.<lang>.md or from the manifests in lib/ — this
// script writes no agronomy of its own, and translates nothing. `--check` re-renders and diffs
// against disk, so drift fails loudly instead of quietly.
//
// USAGE
//   npm run course:render-deck -- <module-id> [lang]         write public/course-decks/<m>/<lang>/
//   npm run course:render-deck -- <module-id> [lang] --check verify disk matches, exit 1 on drift
//   npm run course:render-deck -- <module-id> [lang] --out <dir>
//
// After rendering: register the deck in lib/course-deck.ts, then `npm run assets:sizes`.

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COURSE_NARRATION } from '../lib/course-audio.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';

// fileURLToPath, not .pathname — .pathname keeps percent-encoding, so on a checkout whose path
// contains a space every path built here would point at a directory that does not exist. This
// repo has been bitten by that exact bug before (see scripts/gen-asset-sizes.mjs).
const ROOT = resolve(join(fileURLToPath(new URL('.', import.meta.url)), '..'));

// ---------------------------------------------------------------------------------------------
// Palette — the app's own, not a new one.
//
// #1F4D2B, #F7F2E9, #E2D8C4, #8C7A62 and #20190F are already all over components/; a deck in
// different greens would read as somebody else's material pasted into the app. AMBER and RUST are
// the two accents the Seeds deck established, kept so the decks sit in one family even though
// their register differs.
// ---------------------------------------------------------------------------------------------
const C = {
  paper: '#F7F2E9',
  ink: '#20190F',
  ink2: '#3A3020',
  green: '#1F4D2B',
  greenDeep: '#173B21',
  amber: '#B07A1E',
  rust: '#8A4B2A',
  muted: '#8C7A62',
  line: '#E2D8C4',
  cream: '#F7F2E9',
  creamMuted: '#CFC5AC',
  amberLight: '#E3B65C',
};

const W = 1600;
const H = 900;
const M = 96; // side margin — generous on purpose; this is read at arm's length
const COL = W - M * 2;

// ---------------------------------------------------------------------------------------------
// Text measurement.
//
// An SVG loaded through <img> gets NO external resources, so it renders in whatever the device
// calls `serif` and `sans-serif` — Georgia here, Noto Serif on Android, Times on an old iPhone.
// Their advance widths differ by a few percent, which means line breaks cannot be measured with
// the renderer's own font the way a Pillow script measures with its.
//
// So: measure against Arial's advance widths (below, per 1000 em — the widest of the common
// grotesques), apply a per-family factor, and carry ~7% headroom on top. Lines are then broken
// somewhat early on a narrow font and exactly right on a wide one, which is the failure direction
// that costs nothing. The alternative — SVG `textLength` — cannot overflow but distorts letter
// spacing on every device that does not have Georgia, and distorted type at 11 px is worse than a
// short line.
// ---------------------------------------------------------------------------------------------
const ARIAL = (() => {
  const w = {};
  const put = (chars, adv) => { for (const ch of chars) w[ch] = adv; };
  put(' ', 278); put('!', 278); put('"', 355); put('#', 556); put('$', 556); put('%', 889);
  put('&', 667); put("'", 191); put('(', 333); put(')', 333); put('*', 389); put('+', 584);
  put(',', 278); put('-', 333); put('.', 278); put('/', 278); put('0123456789', 556);
  put(':;', 278); put('<=>', 584); put('?', 556); put('@', 1015);
  put('A', 667); put('B', 667); put('C', 722); put('D', 722); put('E', 667); put('F', 611);
  put('G', 778); put('H', 722); put('I', 278); put('J', 500); put('K', 667); put('L', 556);
  put('M', 833); put('N', 722); put('O', 778); put('P', 667); put('Q', 778); put('R', 722);
  put('S', 667); put('T', 611); put('U', 722); put('V', 667); put('W', 944); put('X', 667);
  put('Y', 667); put('Z', 611);
  put('[]', 278); put('\\', 278); put('^', 469); put('_', 556); put('`', 333);
  put('a', 556); put('b', 556); put('c', 500); put('d', 556); put('e', 556); put('f', 278);
  put('g', 556); put('h', 556); put('i', 222); put('j', 222); put('k', 500); put('l', 222);
  put('m', 833); put('n', 556); put('o', 556); put('p', 556); put('q', 556); put('r', 333);
  put('s', 500); put('t', 278); put('u', 556); put('v', 500); put('w', 722); put('x', 500);
  put('y', 500); put('z', 500);
  put('{}', 334); put('|', 260); put('~', 584);
  // The punctuation the narration scripts actually use.
  put('—', 1000); put('–', 556); put('…', 1000); put('’', 191);
  put('“”', 333); put('·', 278); put(' ', 278);
  return w;
})();

/** Widest common face in the family, relative to Arial. Serif lowercase runs a little wider. */
const FAMILY_FACTOR = { sans: 1.0, sansBold: 1.06, serif: 1.09, serifItalic: 1.05 };
const TRACK = 3.4; // eyebrow letter-spacing, in units — it has to be counted, not just set
const HEADROOM = 1.07;

function textWidth(text, size, family) {
  let em = 0;
  for (const ch of text) em += ARIAL[ch] ?? 600; // 600 for anything unmapped — deliberately wide
  return (em / 1000) * size * FAMILY_FACTOR[family] * HEADROOM;
}

/** Greedy wrap. Never truncates: a word longer than the column gets its own over-long line and the
 *  fitter shrinks the block instead, because half a teaching sentence is not a slide. */
function wrap(text, size, family, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, size, family) > maxWidth) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Letter-spaced small caps, the one place tracking earns its keep. `letter-spacing` is honoured
 *  inside <img>-embedded SVG; it is presentation, so it degrades to a slightly tighter line. */
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------------------------------------------------------------------------------------------
// Reading the authored content.
//
// docs/narration/<module>.<lang>.md is the script the voice was recorded from, and its slide
// blocks have a shape the whole course follows:
//
//     **Slide 11 — Catch and Store Energy**
//     Harvest rain, sun and biomass before they leave your property.   <- the one idea
//     Every one of those arrives free and leaves free. ...             <- support
//     Catching them is almost always cheaper ...                       <- support
//     [pause]
//     Name one thing that arrives on your land free ...                <- the reflection
//
// That is already a slide. The renderer's whole job is to give it a frame, so nothing here
// paraphrases, summarises or invents: every string that lands on a slide is a substring of the
// script or of the manifests.
// ---------------------------------------------------------------------------------------------
const BILINGUAL = /^\*\*[^\n*]*?(\d+)\s*[—-]\s*([^(*\n]+?)\s*\((?:Slide|Ikhasi)\s*\d+\s*[—-]\s*([^)\n]+)\)\*\*\s*$/gm;
const MONOLINGUAL = /^\*\*(?:Slide|Ikhasi)\s*(\d+)\s*[—-]\s*([^*\n]+?)\s*\*\*\s*$/gm;

function parseScript(path) {
  const raw = readFileSync(path, 'utf8');
  const blocks = [];
  let m;
  BILINGUAL.lastIndex = 0;
  while ((m = BILINGUAL.exec(raw))) blocks.push({ n: Number(m[1]), head: m.index, start: m.index + m[0].length });
  if (blocks.length === 0) {
    MONOLINGUAL.lastIndex = 0;
    while ((m = MONOLINGUAL.exec(raw))) blocks.push({ n: Number(m[1]), head: m.index, start: m.index + m[0].length });
  }
  blocks.sort((a, b) => a.n - b.n);

  return blocks.map((b, i) => {
    const end = i + 1 < blocks.length ? blocks[i + 1].head : raw.length;
    // Stop at any appendix: reviewer notes sit under their own '## ' heading after the last slide,
    // and the final block otherwise runs to end-of-file and bullets the reviewer.
    const body = raw.slice(b.start, end).split(/^#{1,6}\s/m)[0];
    const [before, after = ''] = body.split(/\[pause\]/i);
    const paras = (s) => s.replace(/^---\s*$/gm, '').split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { n: b.n, before: paras(before), after: paras(after) };
  });
}

// ---------------------------------------------------------------------------------------------
// Layout.
//
// Sizes are set so the slide survives the worst case it will actually meet: a 16:9 card about
// 330 CSS px wide on a phone. At that width one viewBox unit is ~0.21 px, so a 64-unit lead line
// lands near 13 px and a 92-unit title near 19 px. That budget is why a slide carries a title, one
// idea and at most a few supporting lines — not because there was nothing else to say, but because
// anything more would be unreadable at the size it is actually read.
// ---------------------------------------------------------------------------------------------
const SZ = { title: 88, lead: 60, point: 52, question: 46, eye: 30, hero: 132, heroTag: 58 };
const LH = { title: 1.12, lead: 1.24, point: 1.22, question: 1.26 };
const GAP = { afterTitle: 28, afterLead: 28, betweenPoints: 18 };
const TOP = 176; // under the eyebrow and its tick, with air

/**
 * Solve one slide's layout: how much of the script fits, and how large.
 *
 * THE FLOOR IS THE FIXED POINT. 0.82 of base puts a supporting line at ~43 units, which on a
 * 16:9 card about 330 CSS px wide — a phone in the DeckPlayer — is ~9 px. Below that nothing on
 * the slide is worth showing, so the answer is less content, never smaller type.
 *
 * Above the floor, CONTENT WINS: show every supporting line the script wrote, as large as it can
 * be shown. What gets sacrificed first is the reflection question, because it is a prompt the
 * narration also speaks, and the supporting lines are the teaching. The previous ordering had
 * this backwards and it showed — "Learning Outcomes" announced three outcomes and then listed
 * one, with the reflection prompt sitting underneath in the space the other two needed.
 */
const FLOOR = 0.82;

function fit(title, lead, points, question) {
  const measure = (k, s, withQ) => {
    const t = wrap(title, SZ.title * s, 'serif', COL);
    const l = lead ? wrap(lead, SZ.lead * s, 'sans', COL) : [];
    const p = points.slice(0, k).map((x) => wrap(x, SZ.point * s, 'sans', COL - 54));
    const h = t.length * SZ.title * s * LH.title
      + (l.length ? GAP.afterTitle * s + l.length * SZ.lead * s * LH.lead : 0)
      + (p.length
        ? GAP.afterLead * s + p.reduce((a, ls) => a + ls.length * SZ.point * s * LH.point + GAP.betweenPoints * s, 0) - GAP.betweenPoints * s
        : 0);
    return { t, l, p, h, question: withQ ? question : '' };
  };

  const room = (withQ) => {
    const qh = withQ && question
      ? wrap(question, SZ.question, 'serifItalic', COL).length * SZ.question * LH.question + 40
      : 0;
    return H - M - qh - 18 - TOP;
  };

  // SEARCH ON THE MEASURED HEIGHT, never on a scale derived from it. Deriving `scale = available /
  // height-at-full-size` and then re-measuring is wrong in a way that is invisible until you look
  // at the slides: smaller type wraps into FEWER lines, so the re-measured block came out far
  // shorter than the space it was shrunk to fit. Every slide in the first render was scaled twice
  // — typeset small AND sitting in a half-empty frame, the worst of both. Stepping down 2% at a
  // time and taking the first size that genuinely fits costs ten cheap measurements and lands on
  // the largest type the slide can actually carry.
  const STEP = 0.02;
  const steps = Math.round((1 - FLOOR) / STEP);

  for (let k = points.length; k >= 0; k--) {
    for (const withQ of [true, false]) {
      if (withQ && !question) continue;
      const available = room(withQ);
      for (let i = 0; i <= steps; i++) {
        const scale = 1 - i * STEP;
        const m = measure(k, scale, withQ);
        if (m.h <= available) return { ...m, scale, top: TOP, available, shown: k };
      }
    }
  }
  // Unreachable in practice — a title alone always fits — but a slide must still render.
  const available = room(false);
  return { ...measure(0, FLOOR, false), scale: FLOOR, top: TOP, available, shown: 0 };
}

function tspans(lines, x, y, lh, size) {
  return lines.map((ln, i) => `<tspan x="${x}" y="${round(y + i * size * lh)}">${esc(ln)}</tspan>`).join('');
}

const round = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------------------------------------
// The slide itself.
// ---------------------------------------------------------------------------------------------
function renderSlide(ctx) {
  const { slide, total, title, eyebrow, lead, points, question, dark, hero } = ctx;
  const bg = dark ? C.greenDeep : C.paper;
  const titleColor = dark ? C.cream : C.green;
  const bodyColor = dark ? C.cream : C.ink;
  const supportColor = dark ? C.creamMuted : C.ink2;
  const accent = dark ? C.amberLight : C.amber;
  const rule = dark ? 'rgba(247,242,233,0.22)' : C.line;
  const out = [];
  let dropped = 0; // supporting lines the script has that would not fit — reported, never hidden
  let shown = 0;
  let questionShown = false;

  out.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);

  // Eyebrow row: where you are on the left, how far through on the right.
  //
  // Measured, not assumed. The eyebrow carries a module title on module-level slides, and the
  // longest one today ("Introduction to Permaculture") uses about half the width available — but
  // nothing stops a future module from being named something longer, and the failure mode is the
  // eyebrow silently running under the slide count in the opposite corner. Shrinking is the graceful
  // answer; overlapping type is not.
  const eyeRoom = COL - 190; // the slide count and a clear gap own the right end
  const eyeWidth = textWidth(eyebrow, SZ.eye, 'sansBold') + eyebrow.length * TRACK;
  const eyeSize = eyeWidth > eyeRoom ? round((SZ.eye * eyeRoom) / eyeWidth) : SZ.eye;
  out.push(`<text class="eye" font-size="${eyeSize}" x="${M}" y="88" fill="${accent}">${esc(eyebrow)}</text>`);
  out.push(`<text class="eye num" x="${W - M}" y="88" fill="${dark ? C.creamMuted : C.muted}">${slide} / ${total}</text>`);
  out.push(`<rect x="${M}" y="106" width="88" height="5" fill="${accent}"/>`);

  if (hero) {
    // The module's own name, given the room a cover deserves. One idea, nothing else on the page.
    const t = wrap(title, SZ.hero, 'serif', COL);
    const tag = lead ? wrap(lead, SZ.heroTag, 'serifItalic', COL - 120) : [];
    const blockH = t.length * SZ.hero * 1.1 + (tag.length ? 56 + tag.length * SZ.heroTag * 1.3 : 0);
    let y = (H - blockH) / 2 + SZ.hero * 0.78;
    out.push(`<text class="hero" fill="${C.cream}">${tspans(t, M, y, 1.1, SZ.hero)}</text>`);
    y += (t.length - 1) * SZ.hero * 1.1 + 56 + SZ.heroTag * 0.8;
    if (tag.length) {
      out.push(`<rect x="${M}" y="${round(y - SZ.heroTag * 1.05)}" width="6" height="${round(tag.length * SZ.heroTag * 1.3)}" fill="${C.amberLight}"/>`);
      out.push(`<text class="tag" fill="${C.creamMuted}">${tspans(tag, M + 34, y, 1.3, SZ.heroTag)}</text>`);
    }
  } else {
    const f = fit(title, lead, points, question);
    const s = f.scale;
    dropped = points.length - f.p.length;
    shown = f.shown;
    questionShown = Boolean(f.question);
    let y = f.top + (f.available - f.h) / 2 + SZ.title * s * 0.82;

    out.push(`<text class="title" font-size="${round(SZ.title * s)}" fill="${titleColor}">${tspans(f.t, M, y, LH.title, SZ.title * s)}</text>`);
    y += (f.t.length - 1) * SZ.title * s * LH.title;

    if (f.l.length) {
      y += GAP.afterTitle * s + SZ.lead * s * 0.9;
      out.push(`<text class="lead" font-size="${round(SZ.lead * s)}" fill="${bodyColor}">${tspans(f.l, M, y, LH.lead, SZ.lead * s)}</text>`);
      y += (f.l.length - 1) * SZ.lead * s * LH.lead;
    }

    if (f.p.length) {
      y += GAP.afterLead * s;
      f.p.forEach((lines, i) => {
        y += SZ.point * s * 0.9;
        // DOTS, NEVER NUMERALS. Numbering these tried a version where module-level slides got
        // "1, 2, 3", and on "Why This Matters" it turned two explanatory sentences into a list the
        // author never wrote — the slide asserting a structure the script does not have. A dot
        // says "here is a supporting line" and claims nothing else, which is all the renderer is
        // entitled to say about somebody else's prose.
        out.push(`<circle cx="${round(M + 12)}" cy="${round(y - SZ.point * s * 0.28)}" r="${round(9 * s)}" fill="${accent}"/>`);
        out.push(`<text class="point" font-size="${round(SZ.point * s)}" fill="${supportColor}">${tspans(lines, M + 54, y, LH.point, SZ.point * s)}</text>`);
        y += (lines.length - 1) * SZ.point * s * LH.point + GAP.betweenPoints * s;
      });
    }

    if (f.question) {
      // The script's own closing line. It is a question the farmer is meant to sit with, so it is
      // set apart rather than folded in with the teaching points.
      const q = wrap(f.question, SZ.question, 'serifItalic', COL);
      const qTop = H - M - q.length * SZ.question * LH.question;
      out.push(`<rect x="${M}" y="${round(qTop - 36)}" width="${COL}" height="2" fill="${rule}"/>`);
      out.push(`<text class="q" fill="${dark ? C.amberLight : C.rust}">${tspans(q, M, round(qTop + SZ.question * 0.78), LH.question, SZ.question)}</text>`);
    }
  }

  // How far through the module, as a line rather than a number nobody reads.
  out.push(`<rect x="0" y="${H - 8}" width="${W}" height="8" fill="${dark ? 'rgba(247,242,233,0.14)' : C.line}"/>`);
  out.push(`<rect x="0" y="${H - 8}" width="${round((W * slide) / total)}" height="8" fill="${accent}"/>`);

  const style = [
    `.eye{font:700 ${SZ.eye}px ${FONT_SANS};letter-spacing:${TRACK}px}`,
    `.num{text-anchor:end;letter-spacing:2px}`,
    `.hero{font:700 ${SZ.hero}px ${FONT_SERIF}}`,
    `.tag{font:italic 400 ${SZ.heroTag}px ${FONT_SERIF}}`,
    `.title{font-family:${FONT_SERIF};font-weight:700}`,
    `.lead{font-family:${FONT_SANS};font-weight:400}`,
    `.point{font-family:${FONT_SANS};font-weight:400}`,
    `.q{font:italic 400 ${SZ.question}px ${FONT_SERIF}}`,
  ].join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`
    + `<title>${esc(title)}</title><style>${style}</style>`
    + out.join('')
    + '</svg>\n';
  return { svg, dropped, shown, questionShown };
}

// Generic families only. An <img>-embedded SVG loads no external font, so naming a webfont here
// would silently fall back on every device and change the metrics the lines were broken for.
const FONT_SERIF = "Georgia,'Iowan Old Style','Times New Roman',serif";
const FONT_SANS = "'Helvetica Neue',Helvetica,Arial,'Liberation Sans',sans-serif";

// ---------------------------------------------------------------------------------------------
// Deck assembly.
// ---------------------------------------------------------------------------------------------
export function renderDeck(moduleId, lang) {
  const narration = COURSE_NARRATION[moduleId];
  if (!narration) throw new Error(`no narration manifest for ${moduleId} — lib/course-audio.ts is the source of the slide list`);
  const mod = COURSE_MODULES.find((m) => m.id === moduleId);
  if (!mod) throw new Error(`no such module: ${moduleId}`);

  const scriptPath = join(ROOT, 'docs', 'narration', `${moduleId}.${lang}.md`);
  if (!existsSync(scriptPath)) throw new Error(`no narration script at docs/narration/${moduleId}.${lang}.md`);
  const parsed = new Map(parseScript(scriptPath).map((b) => [b.n, b]));

  const total = narration.tracks.length;
  const lessonIndex = new Map(mod.lessons.map((l, i) => [l.id, i + 1]));
  const out = [];

  for (const track of narration.tracks) {
    const block = parsed.get(track.slide);
    if (!block) throw new Error(`${moduleId}.${lang}.md has no block for slide ${track.slide} — the script and lib/course-audio.ts disagree`);

    // The title the app already shows for this slide. Taking it from the manifest rather than from
    // the markdown heading means the picture and the player can never caption the same slide two
    // different ways. titleByLang is used verbatim where it exists and never machine-translated.
    const title = track.titleByLang?.[lang] ?? track.title;

    // Keep paragraphs whole. A continuation frame now creates room when it is needed, so there is
    // no honest reason to trade an author's second sentence for a little more space on the first.
    const fullLead = block.before[0] ?? '';
    const fullPoints = block.before.slice(1).filter((p) => p.length >= 12);
    const question = block.after[0] ?? '';

    // Register is read off the manifest, not chosen slide by slide: module-level slides (the cover,
    // the outcomes, the field work) invert to a dark field, lesson slides sit on paper. That gives
    // the deck the same chapter rhythm the Seeds deck has, derived rather than hand-assigned.
    const dark = track.lesson === null;
    const hero = track.slide === 1 && dark;
    const n = track.lesson ? lessonIndex.get(track.lesson) : null;
    const eyebrow = hero
      ? 'IMBEWUFIELD · HOME-STUDY MODULE'
      : (n ? `LESSON ${n}` : mod.title.toUpperCase());

    const draw = (lead, points) => renderSlide({
      slide: track.slide, total, title, eyebrow, lead, points, question: hero ? '' : question,
      dark, hero,
    });
    const render = draw(fullLead, fullPoints);
    out.push({
      slide: track.slide,
      title,
      file: `slide-${String(track.slide).padStart(2, '0')}.svg`,
      svg: render.svg,
      dropped: 0,
      continuation: false,
    });

    if (render.dropped > 0) {
      // A recording is one authored block, not one visual frame. Splitting the markdown here
      // would make a recorded module gain an unrecorded slide (and put its translated script out
      // of step); dropping the final point is worse. Keep the first frame under its normal name
      // and put the remaining script on a second, explicitly named frame. The player/video route
      // can therefore keep the block/audio count unchanged while showing both frames during the
      // one clip.
      const continuation = renderSlide({
        slide: track.slide,
        total,
        title,
        eyebrow: `${eyebrow} · CONTINUED`,
        lead: '',
        points: fullPoints.slice(render.shown),
        // The fitter gives teaching points priority over the reflection. If it had to hide the
        // reflection on the first frame, it belongs at the end of the continuation, not nowhere.
        question: render.questionShown ? '' : question,
        dark,
        hero: false,
      });
      if (continuation.dropped > 0) {
        throw new Error(`${moduleId}/${lang} slide ${track.slide} still overflows its continuation`);
      }
      out.push({
        slide: track.slide,
        title,
        file: `slide-${String(track.slide).padStart(2, '0')}-continuation.svg`,
        svg: continuation.svg,
        dropped: 0,
        continuation: true,
      });
    }
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const outFlag = argv.indexOf('--out');
  const outOverride = outFlag >= 0 ? resolve(argv[outFlag + 1]) : null;
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out');
  const [moduleId, lang = 'en'] = positional;

  if (!moduleId) {
    console.error('\n  npm run course:render-deck -- <module-id> [lang] [--check] [--out <dir>]\n');
    process.exit(1);
  }

  const slides = renderDeck(moduleId, lang);
  const dir = outOverride ?? join(ROOT, 'public', 'course-decks', moduleId, lang);

  if (check) {
    const wrong = [];
    for (const s of slides) {
      const path = join(dir, s.file);
      if (!existsSync(path)) { wrong.push(`missing: ${path}`); continue; }
      if (readFileSync(path, 'utf8') !== s.svg) wrong.push(`differs: ${path}`);
    }
    if (wrong.length) {
      console.error(`\n  ✗ ${moduleId}/${lang} is stale:\n${wrong.map((w) => `      ${w}`).join('\n')}\n`);
      process.exit(1);
    }
    console.log(`  ✓ ${moduleId}/${lang}: ${slides.length} slides match disk`);
    return;
  }

  mkdirSync(dir, { recursive: true });
  // Sweep slides the manifest no longer has, so shortening a deck cannot leave an orphan file that
  // the size manifest keeps advertising and no page ever shows.
  const keep = new Set(slides.map((s) => s.file));
  for (const name of readdirSync(dir)) if (name.endsWith('.svg') && !keep.has(name)) unlinkSync(join(dir, name));

  let bytes = 0;
  for (const s of slides) {
    const path = join(dir, s.file);
    writeFileSync(path, s.svg);
    bytes += Buffer.byteLength(s.svg);
  }
  const continuations = slides.filter((s) => s.continuation).length;
  console.log(`  ${slides.length - continuations} narration blocks -> ${slides.length} frames in ${dir}`);
  console.log(`  ${(bytes / 1024).toFixed(1)} KB total, ${(bytes / slides.length / 1024).toFixed(1)} KB average`);

  // Said out loud rather than swallowed. A continuation is the normal answer when a card is full,
  // so a non-zero value now means the renderer has broken its no-silent-loss promise.
  const thin = slides.filter((s) => s.dropped > 0);
  if (thin.length) {
    console.log(`\n  ${thin.length} slide(s) carry fewer supporting lines than the script has:`);
    for (const s of thin) console.log(`      slide ${String(s.slide).padStart(2, '0')} — ${s.title} (${s.dropped} not shown)`);
  } else console.log('\n  0 supporting lines dropped.');
  console.log('\n  next: register the deck in lib/course-deck.ts, then npm run assets:sizes');
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) main();
