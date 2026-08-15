// WCAG contrast, computed for real rather than eyeballed — for the tokens that carried body copy
// or small labels and turned out to fail 4.5:1 in every theme column they appeared in.
//
// --text-muted is not decorative: components/ThemePanel.tsx (the Appearance panel, reachable from
// every top-level page's settings button) uses it at 11-13px for section labels, toggle
// descriptions and the footer line — exactly the sizes that need the full 4.5:1 body-text ratio,
// not the 3:1 large-text one. It measured 3.61:1 (earth light), 2.49:1 (earth dark), 2.82:1 (slate
// light) and 2.59:1 (slate dark) against the card surface it actually sits on: failing in all four
// theme columns, on the one panel whose whole job is to make the app easier to read.
//
// --color-harvest is a Vision 2 token (see css-token-collisions.test.ts) whose single earth-light
// authority lived in the top :root block at #D18A1F — 2.82:1 against the card, 2.08:1 against the
// page. Every other theme column's own --color-harvest override already equals that column's
// --gold; earth light's #D18A1F was simply never brought into line. It renders on the /home header
// (the date label, on every load) and the sample-farm CTA icon.
//
// This file parses globals.css directly, the same shallow top-level scan css-token-collisions.test
// uses, so it exercises the real shipped values rather than a copy that can drift from them.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CSS = fileURLToPath(new URL('../app/globals.css', import.meta.url));

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

/** WCAG 2.x contrast ratio between two opaque hex colours, order-independent. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The value of `token` as last declared under `selector` in globals.css — i.e. the value that
 * actually wins the cascade for that selector, following the same "later declaration in the same
 * block wins" rule the file relies on throughout (see the --border/--text-muted history above).
 * Deliberately the same flat top-level-only scan as css-token-collisions.test.ts.
 */
function tokenValue(css: string, selector: string, token: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = withoutComments.split('\n');
  let inBlock = false;
  let depth = 0;
  let value: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const opens = line.match(/^([^{}]+)\{\s*$/);
    if (opens && depth === 0) {
      inBlock = opens[1].trim() === selector;
      depth = 1;
      continue;
    }
    if (line.startsWith('}')) {
      depth = 0;
      inBlock = false;
      continue;
    }
    if (inBlock) {
      const decl = line.match(new RegExp(`^${token.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\s*:\\s*([^;]+);`));
      if (decl) value = decl[1].trim();
    }
  }
  assert.ok(value, `${token} not found under ${selector} in globals.css`);
  return value as string;
}

const THEME_COLUMNS = [
  { name: 'earth light', selector: 'html[data-theme="earth"]', card: '#FFFEFA', page: '#E4DCC6' },
  { name: 'earth dark', selector: 'html[data-theme="earth"].dark', card: '#181208', page: '#0D0A06' },
  { name: 'slate light', selector: 'html[data-theme="slate"]', card: '#F8FAFC', page: '#FFFFFF' },
  { name: 'slate dark', selector: 'html[data-theme="slate"].dark', card: '#0C1526', page: '#060A12' },
];

const BODY_TEXT_MIN = 4.5;

test('--text-muted clears 4.5:1 against both the card and the page, in every theme column', () => {
  const css = readFileSync(CSS, 'utf8');
  for (const col of THEME_COLUMNS) {
    const hex = tokenValue(css, col.selector, '--text-muted');
    const cardRatio = contrastRatio(hex, col.card);
    const pageRatio = contrastRatio(hex, col.page);
    assert.ok(
      cardRatio >= BODY_TEXT_MIN,
      `${col.name} --text-muted (${hex}) is ${cardRatio.toFixed(2)}:1 against the card ${col.card} — ` +
        `under 4.5:1, and this token carries real body copy in components/ThemePanel.tsx`,
    );
    assert.ok(
      pageRatio >= BODY_TEXT_MIN,
      `${col.name} --text-muted (${hex}) is ${pageRatio.toFixed(2)}:1 against the page ${col.page} — under 4.5:1`,
    );
  }
});

test('--color-harvest (earth light) clears 4.5:1 against the card and the page', () => {
  // Only earth light: it is the one column whose --color-harvest is the Vision 2 :root authority
  // rather than a per-column override (see css-token-collisions.test.ts) — so it is the one place
  // this exact value can regress without a collision test catching it.
  const css = readFileSync(CSS, 'utf8');
  const hex = tokenValue(css, ':root', '--color-harvest');
  const cardRatio = contrastRatio(hex, '#FFFEFA');
  const pageRatio = contrastRatio(hex, '#E4DCC6');
  assert.ok(cardRatio >= BODY_TEXT_MIN, `--color-harvest (${hex}) is ${cardRatio.toFixed(2)}:1 against the card — under 4.5:1`);
  assert.ok(pageRatio >= BODY_TEXT_MIN, `--color-harvest (${hex}) is ${pageRatio.toFixed(2)}:1 against the page — under 4.5:1`);
});

test('the map\'s "no saved places" message no longer reads a theme colour on its fixed-dark panel', () => {
  // This panel (components/Map.tsx) is a dark glass overlay on the map in every theme — its
  // sibling rows use rgba(234,243,226,...), a fixed light colour, for exactly that reason. The
  // empty-state message used var(--text-muted) instead, which resolves to a dark earth/slate tone
  // and is worst in dark mode (~2.5:1 against this same panel). A literal rgba(234,243,226,*)
  // keeps it in the sibling rows' colour family regardless of which theme is active.
  const map = readFileSync(fileURLToPath(new URL('../components/Map.tsx', import.meta.url)), 'utf8');
  const at = map.indexOf("rgba(22,37,20,0.5)");
  assert.ok(at > 0, 'the "no saved places" panel background moved — recheck this test by hand');
  const nearby = map.slice(at, at + 200);
  assert.doesNotMatch(
    nearby,
    /color:\s*'var\(--text-muted\)'/,
    'the empty-state message is back to a theme-dependent colour on a panel that is always dark',
  );
  const colourMatch = nearby.match(/color:\s*'rgba\((\d+),(\d+),(\d+),([\d.]+)\)'/);
  assert.ok(colourMatch, 'could not find the empty-state message\'s literal text colour');
  const [, r, g, b, a] = colourMatch!;
  // Blend the translucent text colour against the panel's own (opaque-black worst case)
  // background, the same way a browser composites it, then check the result against that
  // background — the same maths contrastRatio()/relativeLuminance() above already verify.
  const alpha = Number(a);
  const panelBg: [number, number, number] = [11, 18, 10]; // rgba(22,37,20,0.5) over black, rounded
  const blended = [Number(r), Number(g), Number(b)].map((c, i) => c * alpha + panelBg[i] * (1 - alpha));
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  const blendedHex = `#${toHex(blended[0])}${toHex(blended[1])}${toHex(blended[2])}`;
  const panelHex = `#${toHex(panelBg[0])}${toHex(panelBg[1])}${toHex(panelBg[2])}`;
  const ratio = contrastRatio(blendedHex, panelHex);
  assert.ok(ratio >= BODY_TEXT_MIN, `empty-state text is ${ratio.toFixed(2)}:1 against its panel — under 4.5:1`);
});

test('the contrast maths itself is sound (sanity check against known WCAG pairs)', () => {
  // Black on white is the textbook 21:1 ratio; this pins the formula, not the app's tokens.
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 0.01);
  // Identical colours are 1:1 — no contrast at all.
  assert.ok(Math.abs(contrastRatio('#336699', '#336699') - 1) < 0.001);
});
