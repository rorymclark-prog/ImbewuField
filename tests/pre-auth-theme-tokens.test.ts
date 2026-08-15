// The sign-in screen didn't follow the app's Light/Dark/Auto theme. `lib/theme.tsx` sets
// `data-theme` and toggles a `dark` class, and the rest of the app reads CSS custom properties
// (`var(--color-ink)`, `var(--color-surface)`, `var(--border)` and friends) so those roles flip
// with the theme. `app/login/page.tsx` and `app/gate/page.tsx` — the two screens every user must
// pass through before the theme system can even apply to anything else — were written almost
// entirely in hard-coded hex instead: a farmer whose phone was in dark mode got a blazing white
// card with dark-on-dark text at the one screen everyone hits first.
//
// This is a flat text scan, not a render test: it can't see contrast, only source. It guards the
// specific regression — a literal hex colour creeping back into these two files — by asserting
// every `background`/`border`/`color`/`stroke`/Tailwind-ring hex in them is one of a short,
// named allowlist. Anything else fails loudly with the offending line, rather than silently
// reintroducing a colour that can't respond to `data-theme`/`.dark`.
//
// Two exceptions are real, not oversights:
//  - The Google "G" logo's four brand-colour SVG paths (`fill="#4285F4"` etc.) are Google's mark
//    and must never be themed.
//  - `#8C6A2E` (the in-app-browser notice text) has no dark-aware token anywhere in
//    app/globals.css — verified by hand against rendered dark-mode contrast rather than swapped
//    for a token that would have shifted its hue. If globals.css ever grows one for this role,
//    swap it in and drop it from ALLOWED_HEX below.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = [
  '../app/login/page.tsx',
  '../app/gate/page.tsx',
].map((p) => fileURLToPath(new URL(p, import.meta.url)));

// Google's own brand-colour swatches (components/GoogleIcon in login/page.tsx) — never themed.
const GOOGLE_LOGO_HEX = new Set(['#4285F4', '#34A853', '#FBBC05', '#EA4335']);

// Colours with no dark-aware equivalent in app/globals.css, kept deliberately literal and
// verified by hand — see the file-level comment above.
const ALLOWED_HEX = new Set(['#8C6A2E']);

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

for (const file of FILES) {
  const label = file.split('/').slice(-2).join('/');
  test(`${label} has no un-themed hex colours outside the known allowlist`, () => {
    const src = readFileSync(file, 'utf8');
    const offenders = findHexLiterals(src).filter(
      ({ hex }) => !GOOGLE_LOGO_HEX.has(hex) && !ALLOWED_HEX.has(hex),
    );
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? `Found hard-coded hex colour(s) that bypass the theme system:\n` +
          offenders.map((o) => `  line ${o.line}: ${o.hex}  —  ${o.text}`).join('\n') +
          `\nRoute these through the matching var(--...) token instead (see app/globals.css / app/home/page.tsx),` +
          ` or add a justified entry to ALLOWED_HEX in this test.`
        : undefined,
    );
  });
}
