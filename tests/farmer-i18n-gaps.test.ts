// Regression test for a defect class: farmer-facing text hard-coded in JSX instead of routed
// through t(), so it stayed English no matter which of the eleven languages the farmer chose.
//
// Two different shapes of the same bug are covered here:
//  1. app/farmer/page.tsx — the "Design Studio" nav pill, the floating Details/Results toggle,
//     and the bottom-sheet "tap to close" label (plus their aria-labels) were literal English
//     strings in JSX. Some of these (detailsButton, resultsButton, tapToClose,
//     openDetailsPanelAriaLabel, closeDetailsPanelAriaLabel) already existed fully translated in
//     lib/i18n.tsx for all eleven locales — they just sat unused. designStudioLabel did not exist
//     at all and is genuinely new, English-only.
//  2. components/DataPanel.tsx — the soil "Priority improvements" advice sits under a translated
//     header (soilImprovementHeader... err priorityImprovementsHeader) but the advice sentences
//     themselves were assembled at runtime from raw English template literals interpolating live
//     soil values, so a plain key would not do: each fixed phrase gets its own key with a
//     {placeholder} filled in via .replace(), same pattern as insightSemiArid etc.
//
// Per the absolute rule this change worked under: no isiZulu (or any other language) may be
// coined. New keys go into the English (`en`) block of lib/i18n.tsx ONLY — every other locale is
// left untouched so the existing missing-key fallback (T[lang]?.[key] ?? T.en[key] ?? key) serves
// English until a first-language reviewer supplies the real words. This test enforces that split.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/farmer-i18n-gaps.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const i18nSource = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
const farmerPageSource = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
const dataPanelSource = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');

function localeBlocks(source: string): Array<{ locale: string; block: string }> {
  const starts = [...source.matchAll(/^  ([a-z]+): \{/gm)];
  return starts.map((match, index) => {
    const start = match.index ?? 0;
    const end = starts[index + 1]?.index ?? source.length;
    return { locale: match[1], block: source.slice(start, end) };
  });
}

// Brand new — did not exist anywhere in the dictionary before this change.
const NEW_ENGLISH_ONLY_KEYS = [
  'designStudioLabel',
  'soilImprovementPhAcidic',
  'soilImprovementPhAlkaline',
  'soilImprovementLowCarbon',
  'soilImprovementCompacted',
  'soilImprovementHighClay',
  'soilImprovementSandy',
] as const;

// Already existed, already fully translated in all eleven locales — they were just never called
// by the JSX. Wiring these up unlocks real translations, not English-only fallback text.
const REWIRED_EXISTING_KEYS = [
  'detailsButton',
  'resultsButton',
  'tapToClose',
  'openDetailsPanelAriaLabel',
  'closeDetailsPanelAriaLabel',
] as const;

test('the new farmer-facing keys exist in English only, and no other locale was touched', () => {
  const blocks = localeBlocks(i18nSource);
  assert.ok(blocks.length >= 11, 'expected all eleven ImbewuField locales to be present');

  const en = blocks.find((b) => b.locale === 'en');
  assert.ok(en, 'no `en` locale block found in lib/i18n.tsx');
  for (const key of NEW_ENGLISH_ONLY_KEYS) {
    assert.match(en!.block, new RegExp(`^    ${key}: ['"]`, 'm'), `${key} has no English source text in the en block`);
  }

  for (const { locale, block } of blocks) {
    if (locale === 'en') continue;
    for (const key of NEW_ENGLISH_ONLY_KEYS) {
      assert.doesNotMatch(
        block,
        new RegExp(`^    ${key}:`, 'm'),
        `${locale} must stay untouched — ${key} is English-only until a first-language reviewer supplies real words`,
      );
    }
  }
});

test('the rewired keys (Details/Results, tap to close, panel aria-labels) were already fully translated', () => {
  const blocks = localeBlocks(i18nSource);
  for (const { locale, block } of blocks) {
    for (const key of REWIRED_EXISTING_KEYS) {
      assert.match(block, new RegExp(`^    ${key}: ['"]`, 'm'), `${locale} is missing ${key} — it should predate this change`);
    }
  }
});

test('the Design Studio pill, Details/Results toggle, and close controls read from t(), not hard-coded English', () => {
  assert.match(farmerPageSource, /t\('designStudioLabel'\)/, 'Design Studio pill is not translated');
  assert.match(farmerPageSource, /t\('detailsButton'\)/, 'floating "Details" label is not translated');
  assert.match(farmerPageSource, /t\('resultsButton'\)/, 'floating "Results" label is not translated');
  assert.match(farmerPageSource, /t\('tapToClose'\)/, 'bottom-sheet "tap to close" label is not translated');
  assert.match(farmerPageSource, /t\('openDetailsPanelAriaLabel'\)/, '"Open details panel" aria-label is not translated');
  assert.match(farmerPageSource, /t\('closeDetailsPanelAriaLabel'\)/, '"Close details panel" aria-label is not translated');

  // The defect this guards against: these exact literals hard-coded straight in JSX.
  assert.doesNotMatch(farmerPageSource, /<span>Design Studio<\/span>/, 'Design Studio pill regressed to a hard-coded string');
  assert.doesNotMatch(farmerPageSource, /'Results' : 'Details'/, 'Details/Results toggle regressed to hard-coded strings');
  assert.doesNotMatch(farmerPageSource, /aria-label="Open details panel"/, 'Open details panel aria-label regressed to a hard-coded string');
  assert.doesNotMatch(farmerPageSource, /aria-label="Close details panel/, 'Close details panel aria-label regressed to a hard-coded string');
  assert.doesNotMatch(farmerPageSource, /^\s+tap to close\s*$/m, 'bottom-sheet close label regressed to a hard-coded string');
});

test('soil "Priority improvements" advice is built from translated fixed phrases with interpolated values, not raw template literals', () => {
  const soilKeys = [
    'soilImprovementPhAcidic',
    'soilImprovementPhAlkaline',
    'soilImprovementLowCarbon',
    'soilImprovementCompacted',
    'soilImprovementHighClay',
    'soilImprovementSandy',
  ];
  for (const key of soilKeys) {
    assert.match(dataPanelSource, new RegExp(`t\\('${key}'\\)`), `${key} is not referenced by DataPanel`);
  }

  // Each translated phrase carries a {placeholder} that DataPanel fills with .replace(), the same
  // interpolation pattern already used by insightSemiArid / insightLowSoilCarbon etc.
  const en = localeBlocks(i18nSource).find((b) => b.locale === 'en')!.block;
  assert.match(en, /soilImprovementPhAcidic: '[^']*\{ph\}[^']*'/);
  assert.match(en, /soilImprovementLowCarbon: '[^']*\{oc\}[^']*'/);
  assert.match(en, /soilImprovementCompacted: '[^']*\{bd\}[^']*'/);
  assert.match(en, /soilImprovementHighClay: '[^']*\{clay\}[^']*'/);
  assert.match(en, /soilImprovementSandy: '[^']*\{sand\}[^']*'/);

  // The defect this guards against: the exact hard-coded template literals that used to sit here,
  // directly under the translated priorityImprovementsHeader — the worst version of this bug,
  // because the farmer can see the app knows their language and is choosing not to use it here.
  assert.doesNotMatch(dataPanelSource, /is acidic — add agricultural lime/, 'soil advice regressed to a hard-coded template literal');
  assert.doesNotMatch(dataPanelSource, /is low — layer compost 5 cm deep/, 'soil advice regressed to a hard-coded template literal');
  assert.doesNotMatch(dataPanelSource, /suggests compaction — deep-rooted cover crops/, 'soil advice regressed to a hard-coded template literal');
});
