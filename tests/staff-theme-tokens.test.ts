// Mentor, Surveys, Funder and the map page follow the theme now. In dark or slate theme these
// screens used to stay light because they painted surfaces, borders and text with literal
// light-mode hex — a page background of '#E4DCC6', cards at '#FFFEFA', hairlines at '#E2D8C4',
// and forest/ochre used directly as text colour instead of the themed var(--color-forest-800) /
// var(--gold-dim). tests/pre-auth-theme-tokens.test.ts guards the same regression on the two
// screens every user passes through before the theme system applies at all; this file is that
// same flat text scan for the staff/mentor track.
//
// The regex only looks for a literal hex colour string; it cannot see contrast or judge a
// var(--...) reference, so this is a source guard against the specific mistake (a hex creeping
// back in), not a rendered-page check. tests/theme-token-coverage.test.ts is what proves the CSS
// variables themselves resolve per theme.
//
// ALLOWED_HEX is intentionally small: solid brand fills (forest #1F4D2B / #2D6B3C, ochre
// #C07A1E) painted under fixed light type (#fff, #F7F2E9, #EAF3E2), and the two ProgressBar /
// module-status colours (#805416 ochre, #235E86 water-blue) that are only ever used as a
// *background fill* for a progress-bar track in app/mentor/page.tsx, the same role
// var(--ok)/var(--warn)/var(--danger)/var(--info) already play as fixed, non-themed fills
// elsewhere in this app. Anything reached for as TEXT routes through a themed var instead — see
// STATUS_TONE / SIMPLE_STATUS_TONE in app/mentor/page.tsx for the converted equivalent.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = [
  '../app/mentor/page.tsx',
  '../app/surveys/page.tsx',
  '../app/funder/page.tsx',
  '../app/farmer/page.tsx',
].map((p) => fileURLToPath(new URL(p, import.meta.url)));

// Solid brand fills (forest / ochre) and the fixed light type painted on top of them, kept
// literal on purpose — see the file-level comment above.
const ALLOWED_HEX = new Set([
  '#1F4D2B', '#2D6B3C', // forest fill (solid button/badge backgrounds, active-toggle fills)
  '#C07A1E',            // ochre fill (the survey "Send" button)
  '#FFF', '#F7F2E9', '#EAF3E2', // fixed light type/icons painted on a forest or ochre fill
  '#805416', '#235E86', // app/mentor/page.tsx ProgressBar track-fill only, not text — see above
]);

// The :root-only constants from tests/theme-token-coverage.test.ts — these read like theme
// tokens but never change with the theme, so painting a surface, border or body text with them
// is the same bug as a literal hex.
const ROOT_ONLY_TOKENS = [
  '--color-card', '--color-paper', '--surface-2',
  '--text', '--text-2', '--text-3',
  '--brand', '--surface', '--bg', '--ochre',
];
const ROOT_ONLY_PATTERN = new RegExp(`var\\(\\s*(${ROOT_ONLY_TOKENS.map((t) => t.replace('-', '\\-')).join('|')})\\s*[,)]`, 'g');

function findHexLiterals(src: string): { hex: string; line: number; text: string }[] {
  const hits: { hex: string; line: number; text: string }[] = [];
  const lines = src.split('\n');
  const hexPattern = /#[0-9A-Fa-f]{3,8}\b/g;
  lines.forEach((text, i) => {
    let m: RegExpExecArray | null;
    while ((m = hexPattern.exec(text))) {
      hits.push({ hex: m[0].toUpperCase(), line: i + 1, text: text.trim() });
    }
  });
  return hits;
}

function findRootOnlyTokens(src: string): { token: string; line: number; text: string }[] {
  const hits: { token: string; line: number; text: string }[] = [];
  const lines = src.split('\n');
  lines.forEach((text, i) => {
    let m: RegExpExecArray | null;
    ROOT_ONLY_PATTERN.lastIndex = 0;
    while ((m = ROOT_ONLY_PATTERN.exec(text))) {
      hits.push({ token: m[1], line: i + 1, text: text.trim() });
    }
  });
  return hits;
}

for (const file of FILES) {
  const label = file.split('/').slice(-2).join('/');

  test(`${label} has no un-themed hex colours outside the known brand-fill allowlist`, () => {
    const src = readFileSync(file, 'utf8');
    const offenders = findHexLiterals(src).filter(({ hex }) => !ALLOWED_HEX.has(hex));
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found hard-coded hex colour(s) that bypass the theme system:\n` +
          offenders.map((o) => `  line ${o.line}: ${o.hex}  —  ${o.text}`).join('\n') +
          `\nRoute these through the matching var(--...) token instead (see app/globals.css / ` +
          `app/gate/page.tsx), or add a justified entry to ALLOWED_HEX in this test.`
        : undefined,
    );
  });

  test(`${label} never paints a surface, border or body text with a :root-only constant`, () => {
    const src = readFileSync(file, 'utf8');
    const offenders = findRootOnlyTokens(src);
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found a :root-only token used as a surface/text/border colour (it will not follow the ` +
          `theme):\n` + offenders.map((o) => `  line ${o.line}: var(${o.token})  —  ${o.text}`).join('\n') +
          `\nUse the theme-aware equivalent instead (--bg-0/1/2, --border, --text-primary/secondary/` +
          `muted, --color-forest-800, --gold-dim, --color-surface, ...).`
        : undefined,
    );
  });
}
