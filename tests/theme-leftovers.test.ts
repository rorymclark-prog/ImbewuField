// swarm/w9 — "Last theme leftovers: Community, Contact, first-run consent" — converted the last
// screens that painted forest fill, text-on-forest and error red with literal light-mode hex:
// app/community/page.tsx, app/community/profile/page.tsx and app/contact/page.tsx. A dark-mode or
// slate-theme farmer used to get a dark-green button invisible on an equally dark card, and error
// notices that never followed the theme either.
//
// This is a flat text scan, not a render test — it can't see contrast, only source. It guards the
// specific regression (forest #1F4D2B, its text pairing #F7F2E9/#EAF3E2, or error #8B2020
// creeping back in as a literal), the same shape of test as tests/staff-theme-tokens.test.ts and
// tests/firstrun-theme-tokens.test.ts use for their own tracks. tests/theme-token-coverage.test.ts
// is what proves the CSS variables themselves resolve per theme.
//
// components/PopiaConsent.tsx, components/Onboarding.tsx and app/login/page.tsx were touched in
// the same wave but already have their own dedicated guard tests (tests/firstrun-theme-tokens.test.ts,
// tests/pre-auth-theme-tokens.test.ts) — updated alongside this file rather than duplicated here.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RELATIVE_PATHS = [
  'app/community/page.tsx',
  'app/community/profile/page.tsx',
  'app/contact/page.tsx',
];
const FILES = RELATIVE_PATHS.map((p) => fileURLToPath(new URL(`../${p}`, import.meta.url)));

// Per-file exceptions that are not the regression this test guards against:
//  - '#fff' is always a fixed white toggle-thumb/icon painted on a coloured pill or fill, never
//    the modal/card surface itself.
//  - '#235E86' (water) and '#C07A1E' (ochre) are app/community/page.tsx's KIND_COLOR fixed
//    category-badge fills for "want" and "free" listings — deliberately literal, fixed category
//    swatches (the same role var(--info)/var(--ochre) play elsewhere as root-only status
//    colours), not the forest brand colour this test polices. Only KIND_COLOR.have (the forest
//    swatch) was converted to var(--color-forest-800).
const ALLOWED_HEX: Record<string, Set<string>> = {
  'app/community/page.tsx': new Set(['#FFF', '#235E86', '#C07A1E']),
  'app/community/profile/page.tsx': new Set(['#FFF']),
  'app/contact/page.tsx': new Set(['#FFF']),
};

// The forest/paper/error hexes this wave removed. Any of these creeping back into these three
// files as a literal is exactly the regression this test exists to catch.
const BANNED_HEX = new Set([
  '#1F4D2B', '#F7F2E9', '#EAF3E2', // forest fill + its text-on-forest pairing
  '#8B2020', // error red
  '#D8B7A8', '#8C4938', // the warm error-notice pair (app/contact/page.tsx)
]);

// The :root-only constants from tests/theme-token-coverage.test.ts — these look like theme tokens
// but never change with the theme, so painting a surface, border or body text with them is the
// same bug as a literal hex.
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

for (let i = 0; i < FILES.length; i++) {
  const file = FILES[i];
  const label = RELATIVE_PATHS[i];
  const allowed = ALLOWED_HEX[label] ?? new Set<string>();

  test(`${label} has not regressed to the forest/paper/error hexes this wave removed`, () => {
    const src = readFileSync(file, 'utf8');
    const offenders = findHexLiterals(src).filter(({ hex }) => BANNED_HEX.has(hex));
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found a hard-coded hex colour this track already routed through a theme token:\n` +
          offenders.map((o) => `  line ${o.line}: ${o.hex}  —  ${o.text}`).join('\n') +
          `\nUse var(--color-forest-800) / var(--color-canvas) / var(--danger) instead.`
        : undefined,
    );
  });

  test(`${label} has no other un-themed hex colours outside the known allowlist`, () => {
    const src = readFileSync(file, 'utf8');
    const offenders = findHexLiterals(src).filter(({ hex }) => !allowed.has(hex));
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found hard-coded hex colour(s) that bypass the theme system:\n` +
          offenders.map((o) => `  line ${o.line}: ${o.hex}  —  ${o.text}`).join('\n') +
          `\nRoute these through the matching var(--...) token instead, or add a justified entry ` +
          `to ALLOWED_HEX in this test.`
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
          `theme):\n` + offenders.map((o) => `  line ${o.line}: var(${o.token})  —  ${o.text}`).join('\n')
        : undefined,
    );
  });
}

test('the scan actually fires — a known-banned colour is caught', () => {
  const bogus = `style={{ background: '#1F4D2B', color: '#F7F2E9' }}`;
  const offenders = findHexLiterals(bogus).filter(({ hex }) => BANNED_HEX.has(hex));
  assert.equal(offenders.length, 2, 'both banned hexes in this sample must be caught');
});
