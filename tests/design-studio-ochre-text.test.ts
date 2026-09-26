// Design Studio — ochre (#C07A1E) is a FILL, not a text or icon colour: as text on paper it
// measures 2.54:1, well under the 4.5:1 floor (CLAUDE.md's "Ochre is a FILL" rule; the same rule
// tests/firstrun-theme-tokens.test.ts and app/calendar's SeasonIcon already enforce elsewhere).
// Four Design Studio files painted a text or icon-stroke colour directly with ochre or a
// hard-coded imitation of its "dim" text variant instead of the theme-aware var(--gold-dim):
// components/design/DesignGlossy.tsx (a saved-maps gallery header, literal #9E5C08 — earth
// light's own --gold fill value, reused as text), components/design/SectorSummary.tsx and
// components/design/TankCalculator.tsx (both defined a GOLD_DIM constant hard-coded to the earth
// light hex #7A4408 instead of the token), and components/design/StepGuide.tsx (the collapsed
// step-guide bar's done-count label and its chevron painted directly with the per-step accent,
// which is literal ochre for three of the nine wizard steps).
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

test('DesignGlossy.tsx\'s gallery header label reads --gold-dim, not the hard-coded --gold hex', () => {
  assert.doesNotMatch(DESIGN_GLOSSY, /color: '#9E5C08'/, 'the gallery header label reverted to a hard-coded ochre hex');
  assert.match(DESIGN_GLOSSY, /color: 'var\(--gold-dim\)' \}\}>/);
});

test('SectorSummary.tsx and TankCalculator.tsx route their ochre-text constant through the theme token', () => {
  for (const [label, src] of [['SectorSummary.tsx', SECTOR_SUMMARY], ['TankCalculator.tsx', TANK_CALCULATOR]] as const) {
    assert.doesNotMatch(src, /GOLD_DIM = '#7A4408'/, `${label}'s GOLD_DIM constant reverted to a hard-coded hex`);
    assert.match(src, /GOLD_DIM = 'var\(--gold-dim\)'/, `${label}'s GOLD_DIM constant must route through var(--gold-dim)`);
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
