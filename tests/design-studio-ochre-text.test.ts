// Design Studio — ochre (#C07A1E) is a FILL, not a text or icon colour: as text on paper it
// measures 2.54:1, well under the 4.5:1 floor (CLAUDE.md's "Ochre is a FILL" rule; the same rule
// tests/firstrun-theme-tokens.test.ts and app/calendar's SeasonIcon already enforce elsewhere).
// Four Design Studio files painted a text or icon-stroke colour directly with ochre or a
// hard-coded imitation of its "dim" text variant instead of the theme-aware var(--gold-dim):
// components/design/DesignGlossy.tsx (a saved-maps gallery header, literal #9E5C08 — earth
// light's own --gold fill value, reused as text) and components/design/StepGuide.tsx (the collapsed
// step-guide bar's done-count label and its chevron painted directly with the per-step accent,
// which is literal ochre for three of the nine wizard steps).
//
// The gallery header, SectorSummary.tsx and TankCalculator.tsx sit on the fixed PAPER constant
// (#FFFEFA) in every theme, so they keep the fixed ochre-text hex #7A4408. var(--gold-dim) there
// would turn into dark mode's #B49040 on near-white paper, about 2.6:1. StepGuide's label sits on
// var(--bg-1), which does follow the theme, so it reads var(--gold-dim).
//
// This only pins the TEXT/icon fix — the fill and border uses in these same files (STEP_ACCENT's
// badge/header-band fills, SectorSummary's and TankCalculator's OCHRE constant) are correctly left
// as literal ochre, and this file does not touch them: a parallel track is moving Design Studio
// surfaces onto theme tokens, and taking on those fills is explicitly out of this track's scope.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const DESIGN_GLOSSY = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
const SECTOR_SUMMARY = readFileSync(new URL('../components/design/SectorSummary.tsx', import.meta.url), 'utf8');
const TANK_CALCULATOR = readFileSync(new URL('../components/design/TankCalculator.tsx', import.meta.url), 'utf8');
const STEP_GUIDE = readFileSync(new URL('../components/design/StepGuide.tsx', import.meta.url), 'utf8');

test('DesignGlossy.tsx\'s gallery header label reads the ochre-text hex, not the --gold fill hex', () => {
  assert.doesNotMatch(DESIGN_GLOSSY, /color: '#9E5C08'/, 'the gallery header label reverted to the ochre fill hex');
  // Fixed PAPER sheet, so the fixed text hex; the theme var would go pale on it in dark mode.
  assert.match(DESIGN_GLOSSY, /fontWeight: 700, color: '#7A4408' \/\* fixed PAPER sheet/);
});

test('SectorSummary.tsx and TankCalculator.tsx keep the fixed ochre-text hex on their fixed PAPER card', () => {
  for (const [label, src] of [['SectorSummary.tsx', SECTOR_SUMMARY], ['TankCalculator.tsx', TANK_CALCULATOR]] as const) {
    assert.match(src, /const PAPER = '#FFFEFA'/, `${label} no longer paints a fixed PAPER card — revisit whether GOLD_DIM can follow the theme`);
    assert.match(src, /GOLD_DIM = '#7A4408'/, `${label}'s GOLD_DIM must stay #7A4408 while the card is fixed PAPER`);
    assert.doesNotMatch(src, /GOLD_DIM = 'var\(--gold-dim\)'/, `${label}: dark mode's --gold-dim is ~2.6:1 on the fixed PAPER card`);
    // The sibling OCHRE constant is a deliberate literal fill/border — left untouched.
    assert.match(src, /OCHRE = '#C07A1E'/, `${label}'s OCHRE fill constant must stay a literal hex`);
  }
});

test('StepGuide.tsx\'s done-count label and its chevron read a text-safe accent, not the raw per-step fill', () => {
  assert.match(
    STEP_GUIDE,
    /const STEP_ACCENT_TEXT: Record<WizardStep, string> = \{\s*\n\s*\.\.\.STEP_ACCENT,\s*\n\s*sector: 'var\(--gold-dim\)',\s*\n\s*zones: 'var\(--gold-dim\)',\s*\n\s*glossy: 'var\(--gold-dim\)',/,
    'the three ochre-accented steps (sector, zones, glossy) must resolve to var(--gold-dim) in the text-safe map',
  );
  assert.match(STEP_GUIDE, /color: accentText, flexShrink: 0 \}\}>\s*\n\s*\{doneCount\}/, 'the done-count label must read accentText, not the raw fill accent');
  assert.match(STEP_GUIDE, /<ChevronDown size=\{16\} color=\{accentText\}/, 'the chevron must read accentText, not the raw fill accent');
  // The fill/border uses (badge background, header band, collapsed-bar border) are untouched.
  assert.match(STEP_GUIDE, /border: `1\.5px solid \$\{accent\}`/);
  assert.match(STEP_GUIDE, /background: accent,/);
});
