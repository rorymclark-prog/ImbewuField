// The two mandatory first-run modals — components/Onboarding.tsx (language pick) and
// components/PopiaConsent.tsx (POPIA consent + goal picker) — used to style every surface, border
// and body-text colour with literal light-mode hex (#FFFEFA, #E2D8C4, #20190F, #5C5040, #755942,
// #C9BBA1, #F0E9D9 …). A phone already in dark mode (or on the slate theme) got a bright
// light-mode modal as the very first screen it ever showed, before the theme system had a chance
// to matter to anything else.
//
// This is a flat text scan, not a render test: it can't see contrast, only source. It guards the
// specific regression — a hardcoded light hex, or one of the :root-only constants from
// tests/theme-token-coverage.test.ts, creeping back into these two files as a surface, border or
// body-text colour — the same shape of test as tests/pre-auth-theme-tokens.test.ts uses for the
// login/gate screens.
//
// A few colours are real exceptions, not oversights: the forest (#1F4D2B) and ochre (#C07A1E)
// brand fills keep their fixed light-text pairing (white, #F7F2E9, #EAF3E2) per CLAUDE.md — "Brand
// fills with fixed light text on them … may keep their fixed fill + text pair" — because that pair
// sits on a permanently dark or ochre panel, not on the themed modal surface. The white toggle
// thumb (#fff) is the same story: it always sits on a coloured pill, never on the modal surface.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = [
  '../components/Onboarding.tsx',
  '../components/PopiaConsent.tsx',
].map((p) => fileURLToPath(new URL(p, import.meta.url)));

// The forest/ochre brand-fill + fixed-light-text pairs CLAUDE.md allows to stay literal, plus the
// white toggle thumb — all of them paint a fixed, non-themed panel, never the modal surface.
const ALLOWED_HEX = new Set([
  '#1F4D2B', // forest brand fill (hero icon chip, primary button, selected goal card)
  '#C07A1E', // ochre brand fill (step-2 primary button)
  '#fff', '#FFF', '#FFFFFF', // fixed light text/thumb on a brand fill or coloured pill
  '#F7F2E9', // fixed light text on the forest primary button
  '#EAF3E2', // fixed light icon/text/check on the forest fill or selected goal card
]);

// The :root-only constants from tests/theme-token-coverage.test.ts. They look identical to the
// theme tokens in earth light and do not move in dark — painting a surface or text with them is
// exactly the bug that test exists to catch, repeated here for these two files specifically.
const ROOT_ONLY_TOKENS = [
  '--color-card', '--color-paper', '--surface-2',
  '--text', '--text-2', '--text-3',
  '--brand', '--surface', '--bg', '--ochre',
];

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
    for (const token of ROOT_ONLY_TOKENS) {
      if (text.includes(`var(${token})`)) hits.push({ token, line: i + 1, text: text.trim() });
    }
  });
  return hits;
}

for (const file of FILES) {
  const label = file.split('/').slice(-2).join('/');
  const src = readFileSync(file, 'utf8');
  const allowed = new Set([...ALLOWED_HEX].map((h) => h.toUpperCase()));

  test(`${label} has no un-themed hex colours outside the brand-fill allowlist`, () => {
    const offenders = findHexLiterals(src).filter(({ hex }) => !allowed.has(hex));
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found hard-coded hex colour(s) that bypass the theme system:\n`
          + offenders.map((o) => `  line ${o.line}: ${o.hex}  —  ${o.text}`).join('\n')
          + `\nRoute these through the matching var(--bg-0/1/2 / --border / --text-primary/secondary/muted `
          + `/ --emerald / --gold-dim …) token instead, or add a justified entry to ALLOWED_HEX in this test.`
        : undefined,
    );
  });

  test(`${label} does not paint a surface or text with a :root-only constant`, () => {
    const offenders = findRootOnlyTokens(src);
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found :root-only token(s) that look theme-aware but are not (see tests/theme-token-coverage.test.ts):\n`
          + offenders.map((o) => `  line ${o.line}: var(${o.token})  —  ${o.text}`).join('\n')
        : undefined,
    );
  });
}

test('the scan actually fires — a known-bad colour and a known-bad token are both caught', () => {
  const bogus = `style={{ background: '#FFFEFA', border: '1px solid #E2D8C4', color: 'var(--color-card)' }}`;
  const hexOffenders = findHexLiterals(bogus).filter(
    ({ hex }) => ![...ALLOWED_HEX].map((h) => h.toUpperCase()).includes(hex),
  );
  assert.ok(hexOffenders.length >= 2, 'the light-mode hex in this sample must be caught');
  assert.ok(findRootOnlyTokens(bogus).length >= 1, 'the :root-only token in this sample must be caught');
});
