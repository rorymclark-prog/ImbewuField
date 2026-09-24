import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// WHY DARK MODE ONLY HALF-WORKED.
//
// globals.css carries two overlapping families of colour token. One is theme-aware: --bg-0/1/2,
// --border, --text-primary/secondary/muted, --gold, --blue, --emerald and the rest are declared
// once per theme column, so they change when the theme does. The other — --color-card,
// --color-paper, --surface-2, --text, --text-2, --text-3, --brand, --surface, --bg — is declared
// in `:root` ONLY. Those never change. They read like design tokens and behave like constants.
//
// Reaching for the wrong family is invisible in light mode, because in earth light the two
// families hold nearly the same values. It only shows up in dark mode, as a card that stayed
// white under text that went pale, or ink that stayed dark on a ground that went black. That is
// exactly what /calendar was: a light page with a black tab bar.
//
// So this file asserts the property that matters — every token used to paint a SURFACE, TEXT or
// BORDER on a farmer's screen is declared in all four theme columns. A token that is not cannot
// be used for those jobs, whatever its name suggests.

const CSS = fileURLToPath(new URL('../app/globals.css', import.meta.url));

const COLUMNS = [
  'html[data-theme="earth"]',
  'html[data-theme="earth"].dark',
  'html[data-theme="slate"]',
  'html[data-theme="slate"].dark',
];

/**
 * Tokens the components reach for when painting a surface, text or a border. Each must resolve to
 * a different value per theme, or the thing it paints will not follow the theme.
 *
 * This is not every token in the file — an accent used only as a FILL under fixed white type
 * (--ochre) is deliberately constant, and so is anything on a permanently dark panel.
 */
const MUST_BE_THEME_AWARE = [
  '--bg-0', '--bg-1', '--bg-2', '--bg-3',
  '--border', '--border-bright', '--border-strong',
  '--text-primary', '--text-secondary', '--text-muted',
  '--color-forest-800', '--color-forest-700', '--color-muted',
  '--gold', '--gold-dim', '--blue', '--emerald', '--orange', '--teal', '--violet',
  '--color-sage-100',
];

/** Tokens that are `:root`-only by design. Naming them here is the warning, not an exemption. */
const ROOT_ONLY_BY_DESIGN = [
  '--color-card', '--color-paper', '--surface-2',
  '--text', '--text-2', '--text-3',
  '--brand', '--surface', '--bg', '--ochre',
];

type Blocks = Map<string, Map<string, string>>;

/** Every top-level block's declarations, last-one-wins within a block, comments stripped. */
function declarations(css: string): Blocks {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Blocks = new Map();
  let selector: string | null = null;
  for (const raw of withoutComments.split('\n')) {
    const line = raw.trim();
    const opens = line.match(/^([^{}]+)\{\s*$/);
    if (opens) { selector = opens[1].trim(); continue; }
    if (line.startsWith('}')) { selector = null; continue; }
    if (!selector) continue;
    const decl = line.match(/^(--[\w-]+)\s*:\s*([^;]+);/);
    if (!decl) continue;
    if (!blocks.has(selector)) blocks.set(selector, new Map());
    blocks.get(selector)!.set(decl[1], decl[2].trim());
  }
  return blocks;
}

/** What `token` resolves to for `column`: its own declaration, else the `:root` it inherits. */
function resolved(blocks: Blocks, column: string, token: string): string | undefined {
  return blocks.get(column)?.get(token) ?? blocks.get(':root')?.get(token);
}

test('every token used for a surface, text or border changes with the theme', () => {
  const blocks = declarations(readFileSync(CSS, 'utf8'));
  const stuck: string[] = [];

  for (const token of MUST_BE_THEME_AWARE) {
    const values = COLUMNS.map((c) => resolved(blocks, c, token));
    const missing = COLUMNS.filter((c, i) => values[i] === undefined);
    assert.equal(
      missing.length, 0,
      `${token} is not declared for ${missing.join(', ')} — components paint surfaces and text `
        + 'with it, so every column needs its own value.',
    );
    // Light and dark within a theme must differ, or the token is constant where it matters most.
    for (const [light, dark] of [[0, 1], [2, 3]] as const) {
      if (values[light] === values[dark]) {
        stuck.push(`${token}: ${COLUMNS[light]} and ${COLUMNS[dark]} are both ${values[light]}`);
      }
    }
  }

  assert.deepEqual(
    stuck, [],
    'these tokens hold the same value in a theme\'s light and dark columns, so anything painted '
      + `with them will not follow the theme:\n${stuck.map((s) => `  ${s}`).join('\n')}`,
  );
});

test('the :root-only tokens are still :root-only, so nobody mistakes them for theme tokens', () => {
  // The mirror of the test above. If one of these ever gains a per-column override it becomes a
  // theme token and belongs in MUST_BE_THEME_AWARE; until then, painting with it is a bug, and
  // this assertion is what makes that statement true rather than a comment.
  const blocks = declarations(readFileSync(CSS, 'utf8'));
  for (const token of ROOT_ONLY_BY_DESIGN) {
    const overridden = COLUMNS.filter((c) => blocks.get(c)?.has(token));
    assert.deepEqual(
      overridden, [],
      `${token} now has a per-column value (${overridden.join(', ')}). That makes it theme-aware: `
        + 'move it into MUST_BE_THEME_AWARE above rather than leaving this list wrong.',
    );
  }
});

test('the two families really do look alike in earth light — which is why this test exists', () => {
  // Pins the trap itself. --color-card and --bg-1 are the same colour in the theme everyone
  // develops in, and different in the one nobody checks; that is the entire failure mode.
  const blocks = declarations(readFileSync(CSS, 'utf8'));
  const earth = 'html[data-theme="earth"]';
  const earthDark = 'html[data-theme="earth"].dark';
  assert.equal(resolved(blocks, earth, '--color-card'), resolved(blocks, earth, '--bg-1'));
  assert.notEqual(resolved(blocks, earthDark, '--color-card'), resolved(blocks, earthDark, '--bg-1'));
});
