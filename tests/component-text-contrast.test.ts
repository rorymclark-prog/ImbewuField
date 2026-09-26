import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// THE GAP THAT LET #8C7A62 SURVIVE A CONTRAST PASS.
//
// tests/theme-text-contrast.test.ts computes WCAG ratios for real — but it reads app/globals.css,
// so it only ever sees colour that arrives through a CSS variable. The app paints 82% of its
// colour as literal hex inside inline style objects, and that is where the worst offender lived:
// `#8C7A62`, the palette's own "Ink-faint", set as `color:` in 453 places. It measured 3.02:1
// against the page, 4.10:1 against a card and 3.36:1 against an inset — failing the 4.5:1
// body-text floor on every surface it is ever painted on — and it carried overlines, captions,
// entry dates and the whole /calendar month strip. docs/CODEX-QUEUE.md had already flagged the
// card case ("4.1:1 contrast, below the WCAG AA") and nothing caught it, because no test looked
// at components.
//
// This file looks at components.
//
// WHAT IT CHECKS, AND WHY THE CARD
//
// The floor here is 4.5:1 against the CARD (#FFFEFA) — the surface nearly all copy in this app
// sits on. The page (#E4DCC6) is a harder surface still, and a colour that fails it is worth
// fixing too, but plenty of legitimate card-only text lands between the two, so a page floor
// would fail honest code. The card floor fails only text that is unreadable wherever it is put.
//
// LIGHT COLOURS ARE SKIPPED, NOT EXEMPTED
//
// A light hex set as `color:` is text on a fixed dark ground — the forest hero card, the map's
// dark glass panels, the near-black Site-completeness card. Which ground is not knowable from
// the source, so this test cannot judge those and does not pretend to; anything at relative
// luminance 0.40 or above is left alone. The `no saved places` case in
// theme-text-contrast.test.ts is how a specific dark panel gets checked by hand.
//
// SCOPE: EVERY FILE A FARMER'S SCREENS CAN REACH
//
// The route list below is the farmer's app, and the walk follows its imports — static and
// dynamic — exactly as tests/type-floor.test.ts does, so a new component dropped onto one of
// these screens is covered without anyone remembering to add it. The budget is zero. It was zero
// when this test was written, with the whole reachable set (93 .tsx files) already clean, so
// there is nothing to ratchet down: any failure here is a regression introduced after the fact.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

/** The card, the surface this floor is measured against. */
const CARD = '#FFFEFA';
/** The page, reported alongside the card so a failure message says how bad it really is. */
const PAGE = '#E4DCC6';
const BODY_TEXT_MIN = 4.5;
/** At or above this relative luminance a colour is text on a dark ground — not judgeable here. */
const ON_DARK_LUMINANCE = 0.40;

const ROUTES = [
  'app/home/page.tsx',
  'app/farmer/page.tsx',
  'app/records/page.tsx',
  'app/finances/page.tsx',
  'app/reports/page.tsx',
  'app/journal/page.tsx',
  'app/calendar/page.tsx',
  'app/cropplan/page.tsx',
  'app/plan/page.tsx',
  'app/invoice/page.tsx',
  'app/account/page.tsx',
  'app/vision/page.tsx',
  'app/offline/page.tsx',
  'app/tips/page.tsx',
];

const source = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Resolve a `@/…` or relative import to a repo-relative file, or null if it is a package. */
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

/** Every file reachable from the farmer routes, static imports and dynamic alike. */
function reachable(): string[] {
  const seen = new Set<string>();
  const queue = [...ROUTES];
  while (queue.length) {
    const f = queue.shift() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    let src: string;
    try { src = source(f); } catch { continue; }
    const specs = [...src.matchAll(/from\s+'([^']+)'/g), ...src.matchAll(/import\(\s*'([^']+)'/g)];
    for (const m of specs) {
      const r = resolveImport(m[1], f);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  return [...seen].sort();
}

type Offence = { file: string; line: number; hex: string; card: number; page: number };

/** Every `color: '#rrggbb'` in `rel` that is dark enough to be judged and fails the card floor. */
function offences(rel: string): Offence[] {
  const src = source(rel);
  const out: Offence[] = [];
  for (const m of src.matchAll(/\bcolor:\s*'(#[0-9A-Fa-f]{6})'/g)) {
    const hex = m[1].toUpperCase();
    if (relativeLuminance(hex) >= ON_DARK_LUMINANCE) continue;
    const card = contrastRatio(hex, CARD);
    if (card >= BODY_TEXT_MIN) continue;
    out.push({
      file: rel,
      line: src.slice(0, m.index).split('\n').length,
      hex,
      card,
      page: contrastRatio(hex, PAGE),
    });
  }
  return out;
}

test('every text colour a farmer reads clears 4.5:1 against the card it sits on', () => {
  const found = reachable()
    .filter((f) => f.endsWith('.tsx'))
    .flatMap(offences);

  const detail = found
    .map((o) => `  ${o.file}:${o.line}  ${o.hex}  ${o.card.toFixed(2)}:1 card, ${o.page.toFixed(2)}:1 page`)
    .join('\n');

  assert.equal(
    found.length,
    0,
    `${found.length} text colour(s) below the 4.5:1 body-text floor on a card:\n${detail}\n\n`
      + 'Darken the colour rather than widening this test. The values this codebase already uses '
      + 'and has checked: #755942 for muted copy (6.38:1 card, 5.22:1 inset), #5C5040 for '
      + 'secondary (7.77:1), #7A4408 for ochre text (7.83:1), #9A6018 for an ochre warning or a '
      + 'fill under white type (5.12:1), #A83A2C for an error (6.29:1).',
  );
});

test('the scan actually fires — a known-bad colour is caught, a known-good one is not', () => {
  // Pins the detector itself, not the app: #8C7A62 is the value this whole file exists because of,
  // and #755942 is what replaced it.
  assert.ok(contrastRatio('#8C7A62', CARD) < BODY_TEXT_MIN, '#8C7A62 must still measure as failing');
  assert.ok(contrastRatio('#755942', CARD) >= BODY_TEXT_MIN, '#755942 must still measure as passing');
  assert.ok(
    relativeLuminance('#EAF3E2') >= ON_DARK_LUMINANCE,
    'a light-on-dark colour must still be skipped rather than judged against the card',
  );
  assert.ok(
    relativeLuminance('#8C7A62') < ON_DARK_LUMINANCE,
    'a muted brown must still be dark enough to be judged',
  );
});

test('the farmer routes this test walks all exist', () => {
  // A renamed or deleted route would silently shrink the scope to nothing.
  for (const r of ROUTES) {
    assert.ok(existsSync(path.join(ROOT, r)), `${r} is in the route list but not on disk`);
  }
  const walked = reachable().filter((f) => f.endsWith('.tsx'));
  assert.ok(
    walked.length >= 80,
    `the import walk reached only ${walked.length} .tsx files — it reached 93 when this test was `
      + 'written, so something has broken the resolver rather than the app getting smaller',
  );
});
