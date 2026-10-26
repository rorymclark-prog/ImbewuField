import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import typescript from 'typescript';
import { AI_FEATURES } from '../lib/ai-features.ts';
import { coverageOf, translationGaps } from '../lib/lang-coverage.ts';
import zu from '../lib/locales/zu.ts';
import st from '../lib/locales/st.ts';
import ts from '../lib/locales/ts.ts';
import ve from '../lib/locales/ve.ts';
import { englishDictionary } from './translation-inventory.ts';
import { beforeSettingsTranslations, englishBeforeSettingsTranslations } from './settings-translation-preservation.ts';

const english = englishDictionary();
const locales = { en: english, zu, st, ts, ve };
const packet = JSON.parse(readFileSync(new URL('../docs/translation/four-language-completion/settings-drafts.json', import.meta.url), 'utf8')) as {
  status: string; entries: Array<Record<string, string>>; supplementalEntries: Array<Record<string, string>>;
};
const appLanguagesLiteral = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8').match(/export const APP_LANGS = (\[[\s\S]*?\n\]) as const;/)![1];
const appLanguages = new Function(`return (${appLanguagesLiteral})`)();
const require = createRequire(import.meta.url);
const noOp = () => {};

/** Render the shipped components: a translated dictionary alone cannot expose an unwired label. */
function settingsHtml(lang: keyof typeof locales, replacement?: string): string {
  const dictionary = locales[lang];
  const dependencies: Record<string, unknown> = {
    '@/lib/i18n': {
      APP_LANGS: appLanguages, T_en: english, loadLocale: async () => {}, getLoadedDict: () => dictionary,
      translate: (code: keyof typeof locales, key: string) => locales[code]?.[key] ?? english[key] ?? key,
      useLanguage: () => ({ lang, setLang: noOp, t: (key: string) => dictionary[key] ?? english[key] ?? key }),
    },
    '@/lib/theme': { useTheme: () => ({ theme: 'earth', mode: 'light', textScale: 1, setTheme: noOp, setMode: noOp, setTextScale: noOp }) },
    '@/lib/site-progress': {}, '@/lib/tts': {},
    '@/lib/app-level': { useAppLevel: () => 'simple', setAppLevel: noOp },
    '@/lib/use-dialog-focus': { useDialogFocus: noOp },
    '@/lib/lang-coverage': { coverageOf }, '@/lib/ai-features': { AI_FEATURES },
    '@/lib/ai-preferences': { disabledAiFeatures: () => [], saveDisabledAiFeatures: () => true },
    'next/link': { default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', props) },
  };
  for (const name of ['AiFeatureSettings', 'LanguageDraftNote', 'ThemePanel']) {
    const source = name === 'ThemePanel' && replacement !== undefined ? replacement
      : readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), 'utf8');
    const javascript = typescript.transpileModule(source, { compilerOptions: {
      target: typescript.ScriptTarget.ES2020, module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX,
    } }).outputText;
    const module = { exports: {} as { default: React.ComponentType<{ open: boolean; onClose: () => void }> } };
    new Function('require', 'module', 'exports', javascript)(
      (specifier: string) => dependencies[specifier] ?? require(specifier), module, module.exports,
    );
    dependencies[`./${name}`] = module.exports;
  }
  const Panel = (dependencies['./ThemePanel'] as { default: React.ComponentType<{ open: boolean; onClose: () => void }> }).default;
  return renderToStaticMarkup(React.createElement(Panel, { open: true, onClose: noOp }));
}

const visibleControlKeys = [
  'settingsSubtitle', 'settingsShowAmount', 'settingsSimple', 'settingsSimpleDesc', 'settingsAllTools', 'settingsAllToolsDesc',
  'settingsTextSize', 'settingsTextNormal', 'settingsTextLarge', 'settingsTextLarger', 'settingsGuidance',
  'settingsColourTheme', 'settingsThemeEarth', 'settingsThemeEarthDesc', 'settingsThemeSlate', 'settingsThemeSlateDesc',
  'settingsDisplayMode', 'settingsModeLight', 'settingsModeDark', 'settingsModeAuto', 'settingsModeAutoHelp',
  'settingsAiTitle', 'settingsAiDescription', 'settingsAiAllowAll', 'settingsAiChat', 'settingsAiReceipts',
  'settingsAiReports', 'settingsAiNotes', 'settingsAiPhotos', 'settingsAiDesigns', 'settingsSavedAutomatically',
];
const escaped = (text: string) => renderToStaticMarkup(React.createElement('span', null, text)).slice(6, -7);

test('the real Settings panel and paid-AI controls render the selected language, including screen-reader close labels', () => {
  const home = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
  assert.match(home, /aria-label=\{t\('settingsButtonAriaLabel'\)\}/, 'Home must also name the settings launcher in the selected language');
  for (const lang of ['zu', 'st', 'ts', 've'] as const) {
    const html = settingsHtml(lang);
    for (const key of visibleControlKeys) assert.ok(html.includes(escaped(locales[lang][key])), `${lang}/${key}: translated text never reaches the rendered control`);
    assert.ok(html.includes(`aria-label="${escaped(locales[lang].settingsClose)}"`), `${lang}: close label is still English`);
    assert.equal((html.match(/type="checkbox"/g) ?? []).length, Object.keys(AI_FEATURES).length + 1, 'translation must preserve every feature control and its master switch');
    assert.equal((html.match(/role="radio"/g) ?? []).length, 2, 'both Simple and All tools remain available');
  }
  const source = readFileSync(new URL('../components/ThemePanel.tsx', import.meta.url), 'utf8');
  const broken = settingsHtml('st', source.replace("t('settingsShowAmount')", "'How much to show'"));
  assert.ok(!broken.includes(escaped(st.settingsShowAmount)), 'this render check must notice a control hardcoded back to English');
});

test('Settings source pairs preserve figures, placeholders and the existing English feature authority', () => {
  assert.match(packet.status, /Unreviewed AI drafts/);
  for (const entry of [...packet.entries, ...packet.supplementalEntries]) {
    assert.equal(english[entry.key], entry.english, `${entry.key}: source wording changed`);
    for (const lang of ['zu', 'st', 'ts', 've'] as const) {
      const value = locales[lang][entry.key];
      if (entry[lang] !== undefined) assert.equal(value, entry[lang], `${lang}/${entry.key}: match the review packet`);
      // Slate is the existing theme's proper name; ordinary controls must use their own words.
      assert.deepEqual(translationGaps({ [entry.key]: entry.english }, { [entry.key]: value })
        .filter((gap) => !(gap.reason === 'english' && entry.key === 'settingsThemeSlate')), []);
      assert.deepEqual(value.match(/\d+/g) ?? [], entry.english.match(/\d+/g) ?? [], `${lang}/${entry.key}: source figures must not change`);
    }
  }
  for (const [suffix, feature] of Object.entries({ Chat: 'chat', Receipts: 'receipts', Reports: 'reports', Notes: 'notes', Photos: 'photos', Designs: 'designs' })) {
    assert.equal(english[`settingsAi${suffix}`], AI_FEATURES[feature as keyof typeof AI_FEATURES]);
  }
});

test('historical source guards allow only the declared Settings additions and continue exposing unrelated changes', () => {
  const source = readFileSync(new URL('../lib/locales/zu.ts', import.meta.url), 'utf8');
  const before = beforeSettingsTranslations(source, 'zu');
  assert.throws(() => beforeSettingsTranslations(source.replace('settingsClose: "Vala izilungiselelo"', 'settingsClose: "Close settings"'), 'zu'));
  assert.throws(() => beforeSettingsTranslations(source.replace('const dict: Dict = {', 'const dict: Dict = {\n  settingsClose: "Override",'), 'zu'));
  assert.notEqual(beforeSettingsTranslations(source.replace('studentKeyPoints:', 'studentKeyPointsChanged:'), 'zu'), before);
  const englishSource = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
  assert.ok(!englishBeforeSettingsTranslations(englishSource).includes('SETTINGS_ENGLISH_PENDING'));
});
