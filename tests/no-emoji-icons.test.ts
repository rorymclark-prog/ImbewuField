import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// "No emoji as UI icons — Lucide only." (CLAUDE.md, and design/DESIGN.md's design-kit section.)
//
// A source grep for emoji reports about 418 of them across 48 files, which is the number the
// audit first carried, and it is misleading. Most never reach a screen: components/CropIcon.tsx
// renders lib/crop-art.ts's hand-drawn produce and only falls back to the catalog's emoji when a
// crop has no art, and all 23 catalog crops have art. The home tiles are illustrated PNGs with a
// Lucide fallback. Counting source is counting dead fallbacks.
//
// Measured in the rendered DOM instead — visible text nodes, at 390x844, sample mode on — the
// real number on the farmer's screens was 78: 57 on /facilitator/crops, 20 on /journal, 1 on
// /exchange, and zero on /home, /records, /calendar and /prices. That is what got fixed, and
// this file is what keeps it fixed.
//
// WHAT THIS CHECKS, AND WHAT IT DELIBERATELY DOES NOT.
//
// It scans the files that render the farmer's screens for an emoji in a position where it would
// become UI: JSX text, a `label`/`title` string, an `icon:` field. It does NOT object to emoji in
// a message the farmer SENDS (the WhatsApp share text, an .ics description) — that is content,
// not an icon — nor in prose, comments or a Claude prompt, which CLAUDE.md explicitly allows.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const ROUTES = [
  'app/home/page.tsx',
  'app/records/page.tsx',
  'app/journal/page.tsx',
  'app/calendar/page.tsx',
  'app/cropplan/page.tsx',
  'app/facilitator/crops/page.tsx',
  'app/exchange/page.tsx',
  'app/prices/page.tsx',
  'app/survey/page.tsx',
  'app/vision/page.tsx',
];

/**
 * Files the sweep skips, each for a stated reason — not a backlog.
 *
 * Every entry here holds emoji that are either never rendered or are message content. Adding a
 * file to this list is a claim that its emoji do not reach a farmer's screen as an icon, and that
 * claim should be checked in a browser before it is made.
 */
const NOT_ICONS: Record<string, string> = {
  'lib/crop-catalog.ts':
    'the `icon` field is CropIcon\'s FALLBACK for a crop with no art in lib/crop-art.ts. All 23 '
    + 'catalog crops have art, so none of these render; they are the safety net if a crop is '
    + 'added before its drawing is.',
  'lib/i18n-pending.ts': 'translation scaffolding, not markup',
};

/**
 * A RATCHET, not a pass — the same device tests/type-floor.test.ts uses.
 *
 * The DOM sweep that drove this work could only count what it could see, and it never opened the
 * crop planner's dialogs: the space-hungry warning, the rotation picker, the bed-conflict
 * notices, the auto-suggest questionnaire. Those still hold emoji. `budget` is how many lines of
 * that file carried one on 24 September, asserted EXACTLY, so the number can only be edited
 * downwards on purpose. It is a list of work owed, not permission.
 */
const RATCHET: Record<string, { reason: string; budget: number }> = {
  'lib/design-elements.ts': {
    reason: 'the Design Studio\'s element palette — 96 lines of `icon:` across water, earthworks, '
      + 'structures, growing, animals and access. A laptop tool for a mentor or a designer, not one '
      + 'of the farmer\'s screens, and the biggest single piece of this work still owed. Several '
      + 'already resolve to drawn art through lib/element-art-2.ts; the rest want either art or a '
      + 'Lucide equivalent, which is a job with a design decision in it rather than a sweep.',
    budget: 96,
  },
  'lib/facilitator-design.ts': {
    reason: 'the sector-analysis and zone legends on the same Design Studio surface',
    budget: 19,
  },
  'lib/weather.ts': {
    reason: 'the eleven weather-condition glyphs. A sun and a rain cloud are the one case where '
      + 'the emoji is arguably the better picture, so this wants deciding rather than sweeping.',
    budget: 11,
  },
  'lib/water-points.ts': { reason: 'water-feature markers on the Design Studio map', budget: 7 },
  'lib/field-journal.ts': {
    reason: 'the seven journal kinds. Every one of them resolves to drawn art via '
      + 'lib/element-art-2.ts at all three render sites, so none currently reaches a screen — but '
      + 'unlike the crop catalog there is no test proving that, so they are counted, not skipped.',
    budget: 7,
  },
  'lib/evidence-catalogue.ts': { reason: 'the NGO evidence library\'s category icons', budget: 7 },
  'lib/network-demo.ts': { reason: 'two glyphs in the network showcase\'s demo data', budget: 2 },
  'lib/forward-harvests.ts': { reason: 'one glyph in a harvest projection label', budget: 1 },
  'lib/crop-plan.ts': { reason: 'one CropIcon fallback, same shape as the catalog\'s', budget: 1 },
};

const source = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(ROOT, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(path.join(ROOT, fromFile)), spec);
  else return null;
  for (const c of [`${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (existsSync(c)) return path.relative(ROOT, c);
  }
  return null;
}

function reachable(): string[] {
  const seen = new Set<string>();
  const queue = [...ROUTES];
  while (queue.length) {
    const f = queue.shift() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    let src: string;
    try { src = source(f); } catch { continue; }
    for (const m of [...src.matchAll(/from\s+'([^']+)'/g), ...src.matchAll(/import\(\s*'([^']+)'/g)]) {
      const r = resolveImport(m[1], f);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return [...seen].sort();
}

/**
 * WHICH CHARACTERS COUNT AS AN ICON — DEFINED HERE, NOT BY THE RUNTIME.
 *
 * This started as `/\p{Extended_Pictographic}/u`, and that made the test's verdict depend on
 * whichever Unicode data the running Node happened to ship. It is not a small difference:
 * Node 22.22 carries Unicode 17, Node 24.9 carries Unicode 16, and Unicode 17 REMOVED U+2605 ★
 * and U+2630 ☰ from Extended_Pictographic. So the same tree passed locally on 22 and failed on
 * CI's 24 — a test that reports a different answer on two machines is worse than no test, and it
 * is the same class of defect as the toLocaleString bug this branch fixed.
 *
 * The ranges are explicit and pinned by the membership test below:
 *
 *   U+2600–U+27BF   misc symbols and dingbats — ☀ ⚠ ✂ ✅ ✨ ★ ☰
 *   U+2B00–U+2BFF   the extra arrows and shapes emoji are drawn from — ⬇ ⭘
 *   U+1F000–U+1FAFF the emoji planes proper — 🌱 🧺 🪴
 *
 * The plain typographic arrows (U+2190–U+21FF) are deliberately OUT. This app writes "Open my
 * site →" as prose, and an arrow in a sentence is punctuation, not an icon standing in for one.
 */
const EMOJI_RANGES: [number, number][] = [
  [0x2600, 0x27BF],
  [0x2B00, 0x2BFF],
  [0x1F000, 0x1FAFF],
];

function isIconGlyph(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return EMOJI_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
}

const EMOJI = { test: (s: string) => [...s].some(isIconGlyph) };

/** Every line of `rel` carrying an emoji in a position that would render as UI. */
function emojiLines(rel: string): string[] {
  const code = iconPositionsOnly(source(rel));
  const out: string[] = [];
  code.split('\n').forEach((text, i) => {
    if (!EMOJI.test(text)) return;
    // `icon={... ?? '🌱'}` on a CropIcon is the fallback PROP, not a rendered glyph — CropIcon
    // draws lib/crop-art.ts's artwork and only falls through when a crop has no drawing.
    if (/<CropIcon\b/.test(text)) return;
    const glyphs = [...text].filter(isIconGlyph).join('');
    out.push(`${rel}:${i + 1}  ${glyphs}  ${text.trim().slice(0, 60)}`);
  });
  return out;
}

/** `src` with comments and template literals blanked — prose and share text are not icons. */
function iconPositionsOnly(src: string): string {
  // Blanks everything but the newlines, so reported line numbers still match the real file — a
  // multi-line block comment or template flattened to spaces shifts every line after it, which is
  // how this test first reported offences twenty lines away from where they actually were.
  const blank = (m: string) => m.replace(/[^\n]/g, ' ');
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])\/\/[^\n]*/g, blank)
    // Template literals carry the WhatsApp share text and the .ics descriptions.
    .replace(/`[^`]*`/g, blank);
}

test('no emoji reaches a farmer\'s screen as an icon', () => {
  const offences: string[] = [];
  for (const rel of reachable()) {
    if (rel in NOT_ICONS || rel in RATCHET) continue;
    for (const o of emojiLines(rel)) offences.push(o);
  }
  assert.deepEqual(
    offences, [],
    `${offences.length} emoji in a position that renders as UI:\n${offences.map((o) => `  ${o}`).join('\n')}\n\n`
      + 'CLAUDE.md is Lucide-only. Use a Lucide icon, or components/CropIcon.tsx for a crop (it '
      + 'already has hand-drawn art for all 23). If this one is genuinely message content a '
      + 'farmer sends rather than an icon, put it in a template literal or add the file to '
      + 'NOT_ICONS with the reason.',
  );
});

test('the sweep reaches the screens it claims to, and the skip list is honest', () => {
  const walked = reachable();
  assert.ok(walked.length >= 80, `the import walk reached only ${walked.length} files — the resolver has broken`);
  for (const rel of Object.keys(NOT_ICONS)) {
    assert.ok(existsSync(path.join(ROOT, rel)), `${rel} is skipped but no longer exists — drop it from NOT_ICONS`);
    assert.ok(
      EMOJI.test(source(rel)),
      `${rel} is on the skip list but has no emoji left in it — drop it from NOT_ICONS rather than `
        + 'leaving a permanent hole in the sweep.',
    );
  }
});

test('the crop catalog\'s emoji really are unreachable fallbacks', () => {
  // The claim NOT_ICONS makes about lib/crop-catalog.ts, asserted rather than trusted: every crop
  // in the catalog has art, so CropIcon never falls through to the emoji.
  const catalog = source('lib/crop-catalog.ts');
  const art = source('lib/crop-art.ts');
  const cropKeys = [...catalog.matchAll(/key:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  assert.ok(cropKeys.length >= 20, `only ${cropKeys.length} crops parsed from the catalog — the shape changed`);
  const without = cropKeys.filter((k) => !new RegExp(`\\b${k}\\s*:`).test(art));
  assert.deepEqual(
    without, [],
    `these crops have no art in lib/crop-art.ts, so CropIcon WILL render their emoji: ${without.join(', ')}. `
      + 'Either draw them (docs/CROP-ART-BRIEF.md) or stop claiming the catalog\'s emoji are unreachable.',
  );
});

test('the crop planner\'s remaining emoji are held at their recorded count', () => {
  // Asserted exactly, both ways: adding one fails, and so does removing one without lowering the
  // number — a fix that is not recorded is a fix the next person cannot see was made.
  for (const [rel, { budget, reason }] of Object.entries(RATCHET)) {
    const found = emojiLines(rel);
    assert.equal(
      found.length, budget,
      `${rel} has ${found.length} emoji line(s), recorded as ${budget} (${reason}).\n`
        + `${found.map((f) => `  ${f}`).join('\n')}\n\n`
        + 'Going UP: use a Lucide icon. Going DOWN: lower the budget in the same commit.',
    );
  }
});

test('what counts as an icon glyph does not move with the runtime\'s Unicode version', () => {
  // The whole point of the explicit ranges above. These assertions fail if someone swaps the
  // detector back to a \p{...} class, because that class disagrees with itself across Node
  // versions: U+2605 and U+2630 are Extended_Pictographic in Unicode 16 and not in Unicode 17.
  for (const ch of ['\u2605', '\u2606', '\u2630', '\u26A0', '\u2728', '\u2B07', '🌱', '🧺']) {
    assert.ok(isIconGlyph(ch), `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()}) must count as an icon glyph`);
  }
  // Punctuation and typographic arrows are text, whatever a Unicode property says about them.
  for (const ch of ['\u2192', '\u2190', '\u21A9', '\u2022', '\u00B7', '\u25BE', '\u00A7', 'a', '7']) {
    assert.ok(!isIconGlyph(ch), `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase()}) must NOT count as an icon glyph`);
  }
});