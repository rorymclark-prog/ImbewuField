import assert from 'node:assert/strict';
import test from 'node:test';

import { readFileSync } from 'node:fs';

import {
  DESIGN_STEP_GUIDANCE_KEYS,
  DESIGN_STEP_LABEL_KEYS,
  DESIGN_STUDIO_I18N_KEYS,
  formatDesignTranslation,
  translatedDesignStepGuidance,
  translatedDesignStepLabel,
} from '@/lib/design-studio-i18n';
import { announceLanguageChange, listenForLanguageChanges } from '@/lib/i18n-sync';

test('every Design Studio chrome key exists in every language slot instead of silently falling back', () => {
  const source = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  const translationNeeds = readFileSync(
    new URL('../docs/i18n-needs-translation.md', import.meta.url),
    'utf8',
  );
  const localeStarts = [...source.matchAll(/^  ([a-z]+): \{/gm)];
  assert.ok(localeStarts.length > 1, 'the translation dictionary did not expose its language slots');

  for (const key of DESIGN_STUDIO_I18N_KEYS) {
    assert.match(
      source,
      new RegExp(`^  ${key}: [\"']`, 'm'),
      `${key} has no explicit pending English source text`,
    );
    assert.match(
      translationNeeds,
      new RegExp(`\\\`${key}\\\``),
      `${key} is wired but missing from the fluent-review handoff`,
    );
  }
  for (const [index, match] of localeStarts.entries()) {
    const start = match.index ?? 0;
    const end = localeStarts[index + 1]?.index ?? source.indexOf('\\n};', start);
    const localeBlock = source.slice(start, end);
    assert.match(
      localeBlock,
      /\.\.\.DESIGN_STUDIO_ENGLISH_PENDING,/,
      `${match[1]} does not explicitly receive the pending English Design Studio keys`,
    );
  }
  assert.equal(new Set(DESIGN_STUDIO_I18N_KEYS).size, DESIGN_STUDIO_I18N_KEYS.length);
});

test('step labels and guidance are resolved through the active translator, not a fixed English map', () => {
  const firstLanguage = (key: string) => `first:${key}`;
  const switchedLanguage = (key: string) => `switched:${key}`;

  for (const step of Object.keys(DESIGN_STEP_LABEL_KEYS) as Array<keyof typeof DESIGN_STEP_LABEL_KEYS>) {
    assert.equal(translatedDesignStepLabel(firstLanguage, step), `first:${DESIGN_STEP_LABEL_KEYS[step]}`);
    assert.equal(translatedDesignStepLabel(switchedLanguage, step), `switched:${DESIGN_STEP_LABEL_KEYS[step]}`);
    assert.equal(translatedDesignStepGuidance(firstLanguage, step), `first:${DESIGN_STEP_GUIDANCE_KEYS[step]}`);
    assert.equal(translatedDesignStepGuidance(switchedLanguage, step), `switched:${DESIGN_STEP_GUIDANCE_KEYS[step]}`);
  }
});

test('translated chrome templates can reorder their values without leaking placeholders', () => {
  assert.equal(
    formatDesignTranslation('{total} total; now {current}', { current: 3, total: 8 }),
    '8 total; now 3',
  );
  assert.equal(formatDesignTranslation('Next: {step}', { step: 'Water' }), 'Next: Water');
});

test('a nested language switch updates the provider used by Design Studio in the same tab', () => {
  const bus = new EventTarget();
  const received: string[] = [];
  const stop = listenForLanguageChanges(bus, (code) => received.push(code));

  announceLanguageChange(bus, 'zu');
  assert.deepEqual(received, ['zu']);

  stop();
  announceLanguageChange(bus, 'af');
  assert.deepEqual(received, ['zu'], 'an unmounted provider kept receiving language changes');
});

test('every remaining Design Studio surface reads UI chrome from the active language context', () => {
  const components = [
    'BasePhotoImport',
    'DesignAdvisor',
    'DesignCanvas',
    'DesignGlossy',
    'DesignPalette',
    'DesignPrint',
    'LessonLink',
    'LessonPanel',
    'SectorOverlay',
    'SectorSummary',
    'TankCalculator',
  ];
  const representativeKeys: Record<string, string> = {
    BasePhotoImport: 'designPhotoTitle',
    DesignAdvisor: 'designAdvisorAskLima',
    DesignCanvas: 'designCanvasUseInDesign',
    DesignGlossy: 'designGlossyPlanSet',
    DesignPalette: 'designPaletteExistingHelp',
    DesignPrint: 'designPrintTitle',
    LessonLink: 'designLessonHeading',
    LessonPanel: 'designLessonPrinciple',
    SectorOverlay: 'designSectorFire',
    SectorSummary: 'designSectorTitle',
    TankCalculator: 'designTankTitle',
  };

  for (const component of components) {
    const source = readFileSync(
      new URL(`../components/design/${component}.tsx`, import.meta.url),
      'utf8',
    );
    assert.match(source, /\buseLanguage\(\)/, `${component} is still detached from the active locale`);
    assert.match(
      source,
      new RegExp(`t\\(['"]${representativeKeys[component]}['"]\\)`),
      `${component} does not resolve its representative chrome key at render time`,
    );
  }
});

test('localising UI chrome does not translate load-bearing text painted onto exported sheets', () => {
  const glossy = readFileSync(new URL('../components/design/DesignGlossy.tsx', import.meta.url), 'utf8');
  const print = readFileSync(new URL('../components/design/DesignPrint.tsx', import.meta.url), 'utf8');

  assert.match(glossy, /ctx\.fillText\('LEGEND'/, 'the exported glossy legend spelling moved behind UI translation');
  assert.match(print, /ctx\.fillText\('Legend'/, 'the exported print legend spelling moved behind UI translation');
  assert.doesNotMatch(glossy, /ctx\.fillText\(t\(/, 'DesignGlossy now paints translated UI text into a sheet');
  assert.doesNotMatch(print, /ctx\.fillText\(t\(/, 'DesignPrint now paints translated UI text into a sheet');
});
