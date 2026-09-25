import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Money charts on /records (Charts tab) hardcoded light-mode ink colours — INK/MUTED/FAINT/
// HAIRLINE and a handful of one-off hexes — while the card behind them followed the theme
// (var(--bg-1)). In dark mode the card went near-black and the text stayed near-black too:
// the figures, axis labels and per-crop returns became unreadable. This file pins the fix —
// these components must read text/line/surface colour off theme tokens, not a fixed hex.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const CASHFLOW = '../components/CashflowChart.tsx';
const FINANCE = '../components/FinanceGraphs.tsx';
const AREA = '../components/AreaReturnCards.tsx';
const HARVESTS = '../components/ComingUpHarvests.tsx';

test('CashflowChart and FinanceGraphs define their ink/hairline constants as theme tokens, not fixed hex', () => {
  for (const rel of [CASHFLOW, FINANCE]) {
    const src = source(rel);
    for (const stale of ["'#20190F'", "'#5C5040'", "'#5d5143'", "'#E2D8C4'"]) {
      assert.ok(
        !new RegExp(`const \\w+ = ${stale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(src),
        `${rel} still hardcodes a light-only ink constant (${stale}) — text on the card must follow the theme`,
      );
    }
    assert.ok(src.includes("const INK = 'var(--text-primary)'"), `${rel} must define INK from var(--text-primary)`);
    assert.ok(src.includes("const MUTED = 'var(--text-secondary)'"), `${rel} must define MUTED from var(--text-secondary)`);
    assert.ok(src.includes("const FAINT = 'var(--text-muted)'"), `${rel} must define FAINT from var(--text-muted)`);
    assert.ok(src.includes("const HAIRLINE = 'var(--border)'"), `${rel} must define HAIRLINE from var(--border)`);
  }
});

test('CashflowChart and FinanceGraphs set SVG text fill via style, not a fill="{var}" presentation attribute', () => {
  for (const rel of [CASHFLOW, FINANCE]) {
    const src = source(rel);
    assert.ok(
      !/fill=\{FAINT\}/.test(src),
      `${rel} still sets fill={FAINT} as an SVG presentation attribute — CSS variables there are unreliable across engines; use a style object instead`,
    );
    assert.ok(
      /style=\{\{ fill: FAINT, fontFamily: 'monospace' \}\}/.test(src),
      `${rel} should carry the axis-label fill through a style object so the CSS variable resolves`,
    );
  }
});

test('CashflowChart and FinanceGraphs no longer paint a footer band or hairline with a fixed light hex', () => {
  for (const rel of [CASHFLOW, FINANCE]) {
    const src = source(rel);
    assert.ok(!src.includes('#FBF7EF'), `${rel} still hardcodes the #FBF7EF footer background`);
    assert.ok(!src.includes('#F0E9DA'), `${rel} still hardcodes the #F0E9DA hairline`);
  }
});

test('the headline money figures read their colour off a theme-aware token, not the fixed forest-green/ochre fill', () => {
  const cashflow = source(CASHFLOW);
  assert.ok(cashflow.includes('tone={IN_TEXT}'), 'the "In" figure must use the theme-aware text colour, not the fixed bar-fill green');
  assert.ok(cashflow.includes('tone={OUT_TEXT}'), 'the "Out" figure must use var(--gold-dim) — CLAUDE.md: ochre text is #7A4408, not the raw ochre fill');
  assert.ok(cashflow.includes("const IN_TEXT = 'var(--color-forest-800)'"));
  assert.ok(cashflow.includes("const OUT_TEXT = 'var(--gold-dim)'"));

  const finance = source(FINANCE);
  assert.ok(finance.includes('tone={SOLD_TEXT}'), 'the "Sold" figure must use the theme-aware text colour, not the fixed bar-fill green');
  assert.ok(finance.includes("const SOLD_TEXT = 'var(--color-forest-800)'"));
  assert.ok(!/color: SOLD,/.test(finance), 'no label/link should still colour its text with the raw forest-green fill (fails ~1.9:1 on a dark card)');
  assert.ok(!/color: on \? SOLD :/.test(finance), 'the orchard-toggle label must not colour ON text with the raw fill either');
});

test('AreaReturnCards paints its card, border and per-crop return figures with theme tokens', () => {
  const src = source(AREA);
  for (const hex of ['#263b2d', '#f1ede3', '#d2c7b5', '#9a312b', '#245d35']) {
    assert.ok(!src.includes(hex), `AreaReturnCards.tsx still hardcodes ${hex} — this must follow the theme`);
  }
  assert.ok(src.includes("color: 'var(--text-primary)'"), 'the card ink must be var(--text-primary)');
  assert.ok(src.includes("borderColor: 'var(--border)'"), 'the card and article borders must be var(--border)');
  assert.ok(src.includes("background: 'var(--bg-2)'"), 'the per-area article background must be an inset theme token');
  assert.ok(
    src.includes("'var(--danger)' : 'var(--color-forest-800)'"),
    'the R/m² figure must colour its positive/negative return from theme tokens',
  );
});

test('ComingUpHarvests paints its figures, empty-state kg and footer with theme tokens', () => {
  const src = source(HARVESTS);
  for (const hex of ['#1F4D2B', '#20190F', '#F0E9DA', '#FBF7EF', '#B8AC96']) {
    assert.ok(!src.includes(hex), `ComingUpHarvests.tsx still hardcodes ${hex} — this must follow the theme`);
  }
  assert.ok(src.includes("tone=\"var(--color-forest-800)\""), '"If sold" must use the same theme-aware green as the other money-in figures');
});
