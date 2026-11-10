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
  // The crop plan calendar. It was outside this walk, so its white-on-green bar labels (2.57:1)
  // and #1F4D2B month label on the dark header (1.72:1) were never measured by anything.
  'app/facilitator/crops/page.tsx',
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

/**
 * Every `color:` in `rel` that resolves to a literal hex and is dark enough to be judged and
 * fails the card floor — including a ternary (`color: ok ? '#3C6B3F' : '#B07A1E'`), which a plain
 * `color: '#hex'` match missed (code-06: DataPanel's status copy used exactly this shape).
 *
 * A `const x = '#hex'` declaration used later as a `color` value is NOT matched here: probing it
 * against every route this test walks surfaces 4 hits in files this track does not own (AddSheet,
 * CashflowChart, FinanceGraphs, SiteManageMenu) — widening the regex that far would fail this test
 * for other tracks' code without this track being able to fix it.
 */
function offences(rel: string): Offence[] {
  const src = source(rel);
  const out: Offence[] = [];
  for (const m of src.matchAll(/\bcolor:\s*[^,}]*?'(#[0-9A-Fa-f]{6})'/g)) {
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

// THE CROP PLAN BARS, WHICH THE hex-IN-`color:` SCAN ABOVE CANNOT SEE.
//
// The planting bars paint a label over a FIXED fill (the same hex in light and dark). The label
// used to be `color: '#fff'` at 11px: 2.57:1 on the planned green, 3.71:1 on the already-growing
// olive, 2.87:1 over the gold harvest cap, and 1.61:1 on year two, where the whole button was
// faded to 50% so the text faded with it (docs/audits/2026-11-10 CP-050). The scan above only
// finds a literal in a `color:` property; the label colour and the fills are now named constants,
// so these tests read the constants and measure every label/fill pair.
const cropPage = () => source('app/facilitator/crops/page.tsx');

function constHex(name: string): string {
  const m = cropPage().match(new RegExp(`const ${name}\\s*=\\s*'(#[0-9A-Fa-f]{6})'`));
  assert.ok(m, `${name} is no longer a single hex constant in the crop plan page, so this test cannot read it`);
  return m[1].toUpperCase();
}
function constPair(name: string): [string, string] {
  const m = cropPage().match(new RegExp(`const ${name}[^=]*=\\s*\\['(#[0-9A-Fa-f]{6})',\\s*'(#[0-9A-Fa-f]{6})'\\]`));
  assert.ok(m, `${name} is no longer a [growing, cap] pair of hexes in the crop plan page`);
  return [m[1].toUpperCase(), m[2].toUpperCase()];
}

test('crop bar labels clear 4.5:1 on every fixed bar fill, in every theme', () => {
  // The fills do not follow the theme, so the label ink must not either: a themed token here would
  // pass in light and fail in dark (or the reverse) with no way to notice from the source.
  const ink = constHex('BAR_LABEL_INK');
  const fills = [...constPair('BAR_FILL_PLANNED'), ...constPair('BAR_FILL_EXISTING')];
  assert.equal(fills.length, 4, 'planned and already-growing, each with a growing colour and a harvest cap');
  for (const fill of fills) {
    const ratio = contrastRatio(ink, fill);
    assert.ok(ratio >= BODY_TEXT_MIN, `label ink ${ink} on bar fill ${fill} is ${ratio.toFixed(2)}:1, under 4.5:1`);
  }
});

test('crop bar fills keep planned apart from already-growing', () => {
  // Contrast alone is satisfied by painting every bar one colour; the audit asks for the olive
  // already-growing treatment to survive the fix.
  const planned = constPair('BAR_FILL_PLANNED');
  const existing = constPair('BAR_FILL_EXISTING');
  assert.notEqual(planned[0], existing[0]);
  assert.notEqual(planned[1], existing[1]);
});

test('the crop bar label is not painted white or faded with its fill', () => {
  const src = cropPage();
  const start = src.indexOf('function PlantingBar');
  const body = src.slice(start, src.indexOf('\nfunction ', start + 10));
  assert.ok(!/color:\s*'#(?:fff|FFF|ffffff|FFFFFF)'/.test(body), 'a white label is back on the planting bars');
  // Year two fades the fill layer only. Opacity on the button took its label to 1.61:1.
  const buttonStyle = body.slice(body.indexOf('<button'), body.indexOf('aria-hidden="true"'));
  assert.ok(!/opacity/.test(buttonStyle), 'opacity is back on the bar button, which fades the label with the fill');
  assert.match(body, /\{yearTwo \? \([\s\S]*?opacity: 0\.5, background: barFill/, 'year two must still be drawn quieter than year one, by fading the fill layer');
});

test('crop plan calendar text that follows the theme uses a token that clears 4.5:1 in earth light and dark', () => {
  const css = source('app/globals.css');
  const block = (selector: string) => {
    const at = css.indexOf(selector);
    assert.ok(at >= 0, `${selector} not found in globals.css`);
    return css.slice(at, css.indexOf('\n}', at));
  };
  const rootBlock = block(':root {');
  const token = (b: string, name: string) => {
    // A token a column does not redeclare comes from the first :root block.
    const m = b.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`)) ?? rootBlock.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
    assert.ok(m, `${name} not declared as a hex in that column or in :root`);
    return m[1];
  };
  const light = block('html[data-theme="earth"] {');
  const dark = block('html[data-theme="earth"].dark {');
  // current month on the header, "By crop" active, the chip and legend, "Clear all".
  const pairs: [string, string, string, string][] = [
    ['--color-forest-800', '--bg-1', 'current month label', 'both'],
    ['--color-forest-800', '--bg-2', 'current month label on the opaque dark header', 'dark'],
    ['--on-forest-800', '--color-forest-800', 'By crop (active)', 'both'],
    ['--bg-1', '--text-secondary', 'From today (active)', 'both'],
    ['--gold-dim', '--bg-1', 'check / transplant chip and legend', 'both'],
    ['--orange', '--bg-1', 'Clear all', 'both'],
    ['--gold-dim', '--bg-0', 'age-group line on the tinted card', 'both'],
    ['--gold-dim', '--bg-2', 'age-group line on the tinted card (opaque dark)', 'dark'],
  ];
  for (const [fgName, bgName, label, which] of pairs) {
    for (const [theme, b] of [['light', light], ['dark', dark]] as const) {
      if (which === 'dark' && theme === 'light') continue;
      const fg = token(b, fgName);
      const bgHex = token(b, bgName);
      const ratio = contrastRatio(fg, bgHex);
      assert.ok(ratio >= BODY_TEXT_MIN, `${label}: ${fgName} ${fg} on ${bgName} ${bgHex} in earth ${theme} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test('the month strips and the age-group line keep a theme-safe pairing', () => {
  // The strips painted white on var(--emerald), which turns leaf green in dark (2.04:1), and the
  // age-group line was --gold (3.85:1 on the tinted card). --on-forest-800 is the only token declared
  // to pair with a forest fill in every theme (asserted above); --emerald has no on-colour.
  const guide = source('components/crops/ProductionGuideCard.tsx');
  assert.ok(!/'white'|#fff\b/i.test(guide.slice(guide.indexOf('grid-cols-12'), guide.indexOf('grid-cols-12') + 600)), 'a white label is back on the month strips');
  assert.match(guide, /'var\(--color-forest-800\)' : 'var\(--bg-2\)', color: [^:]*'var\(--on-forest-800\)'/);
  const card = source('components/crops/ProductionProjectionCard.tsx');
  assert.ok(!/fontSize: 12, color: 'var\(--gold\)'/.test(card), 'ProductionProjectionCard text is --gold again (3.85:1 on its card)');
});
