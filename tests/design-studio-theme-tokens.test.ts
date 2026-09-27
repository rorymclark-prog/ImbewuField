// Design Studio dark-mode audit (PROGRESS.md's "design-08" backlog item). The full Design Studio
// surface is ~34,000 lines and most of it is deliberately NOT in scope here: DesignGlossy.tsx and
// most of DesignCanvas.tsx draw onto a raw 2D <canvas> (fillStyle/strokeStyle need a resolved
// colour string, not a CSS custom property) or render the printed/exported design map, which is
// meant to look the same on paper regardless of the app's theme. DesignAdvisor.tsx's dark
// "warm-glass" HUD and SectorOverlay.tsx's sun/wind/fire symbols are ALSO deliberately fixed —
// the former must stay legible over a bright satellite tile in any theme, the latter draws
// physical land energies, not UI chrome. Neither is a bug; painting either with theme vars would
// make them worse, not better.
//
// These three files ARE plain DOM UI chrome — cards, buttons, labels — that painted a real page
// surface with literal light-mode hex instead of a themed var, the same bug class the earlier
// pre-auth/staff-theme-token fixes caught elsewhere in the app. This is the source-text guard for
// that fix, in the style of tests/staff-theme-tokens.test.ts.
//
// The two remaining giants (app/design/page.tsx, DesignPalette.tsx, DesignCanvas.tsx) still need
// this same per-usage audit — hex there is a mix of real UI-chrome bugs and legitimate canvas/fill
// constants, and telling them apart needs the same care as this file, not a blind sweep. Left for
// a follow-up pass; see the PR description.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FILES = [
  '../components/design/DesignWizard.tsx',
  '../components/design/StepGuide.tsx',
  '../components/design/BasePhotoImport.tsx',
].map((p) => fileURLToPath(new URL(p, import.meta.url)));

// Solid brand FILLS, and the fixed light type/icons painted on top of them — kept literal on
// purpose, the same "Ochre/forest is a FILL" rule CLAUDE.md states and tests/staff-theme-
// tokens.test.ts already applies elsewhere. Also: BasePhotoImport.tsx draws two of these straight
// onto a <canvas> (ctx.strokeStyle/fillStyle), which cannot resolve a CSS var at all.
const ALLOWED_HEX = new Set([
  '#1F4D2B',           // forest fill (solid step/button backgrounds, active-tab fills)
  '#FFFEFA',           // fixed light text/icon painted on a forest fill ("PAPER")
  '#F7C97E',           // gold accent — border/fill/progress-pip decoration, not text or a surface
  '#C07A1E',           // ochre FILL (StepGuide's "do this now" pill, undone-step ring)
  '#0B120B', '#20190F', // DesignWizard/StepGuide's dark "DARK" constant: canvas draw colour in
                         // BasePhotoImport, fixed dark-on-light-fill badge text elsewhere
  // StepGuide's STEP_TONE — per-layer accent identity (water/earthworks/zones/planting/
  // structures/review/glossy), the same semantic-colour role as SectorOverlay's physical-energy
  // palette. Not UI chrome; a farmer needs the SAME colour to mean "water" in every theme.
  '#6B6355', '#3E8FBF', '#A9743F', '#2F7A4A', '#7A5C3E',
]);

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

// The :root-only constants from tests/theme-token-coverage.test.ts — they read like theme tokens
// but never change with the theme, so painting a surface/text with them is the same bug as a
// literal hex (the exact trap this file's own fix avoided: PAPER's card background became
// var(--bg-1), never var(--color-card)).
const ROOT_ONLY_TOKENS = ['--color-card', '--color-paper', '--surface-2', '--text', '--text-2', '--text-3', '--brand', '--surface', '--bg', '--ochre'];
const ROOT_ONLY_PATTERN = new RegExp(`var\\(\\s*(${ROOT_ONLY_TOKENS.map((t) => t.replace('-', '\\-')).join('|')})\\s*[,)]`, 'g');

for (const file of FILES) {
  const label = file.split('/').slice(-2).join('/');

  test(`${label} has no un-themed hex colour outside the known brand-fill/canvas allowlist`, () => {
    const src = readFileSync(file, 'utf8');
    const offenders = findHexLiterals(src).filter(({ hex }) => !ALLOWED_HEX.has(hex));
    assert.deepEqual(
      offenders,
      [],
      offenders.length
        ? 'Found hard-coded hex colour(s) that bypass the theme system:\n'
          + offenders.map((o) => `  line ${o.line}: ${o.hex}  —  ${o.text}`).join('\n')
          + '\nRoute these through the matching var(--...) token instead, or add a justified '
          + 'entry to ALLOWED_HEX in this test.'
        : undefined,
    );
  });

  test(`${label} never paints a surface, border or body text with a :root-only constant`, () => {
    const src = readFileSync(file, 'utf8');
    const hits: { token: string; line: number }[] = [];
    src.split('\n').forEach((text, i) => {
      let m: RegExpExecArray | null;
      ROOT_ONLY_PATTERN.lastIndex = 0;
      while ((m = ROOT_ONLY_PATTERN.exec(text))) hits.push({ token: m[1], line: i + 1 });
    });
    assert.deepEqual(hits, [], hits.length
      ? `Found a :root-only token used to paint a surface/text: ${hits.map((h) => `${h.token} (line ${h.line})`).join(', ')}`
      : undefined);
  });
}

test('DesignAdvisor.tsx and SectorOverlay.tsx are deliberately untouched — not a re-check target', () => {
  // Guards the audit's own reasoning, not the files' styling: if either file's role changes (the
  // HUD stops floating over the satellite map, or the overlay starts painting real UI chrome
  // instead of physical sun/wind/fire symbols), this comment is what should send someone back to
  // re-open the theme-token question for them.
  const advisor = readFileSync(fileURLToPath(new URL('../components/design/DesignAdvisor.tsx', import.meta.url)), 'utf8');
  assert.match(advisor, /Dark warm-glass treatment/, 'DesignAdvisor no longer documents its deliberate dark HUD — re-check whether it still needs to stay untouched');
  const sector = readFileSync(fileURLToPath(new URL('../components/design/SectorOverlay.tsx', import.meta.url)), 'utf8');
  assert.match(sector, /Sector energies overlay/, 'SectorOverlay no longer documents its physical-energy symbology — re-check whether it still needs to stay untouched');
});
