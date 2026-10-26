import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import typescript from 'typescript';
import { recordsMonthLong } from '../lib/records-months.ts';
import { translationGaps } from '../lib/lang-coverage.ts';
import zu from '../lib/locales/zu.ts';
import st from '../lib/locales/st.ts';
import ts from '../lib/locales/ts.ts';
import ve from '../lib/locales/ve.ts';
import { englishDictionary } from './translation-inventory.ts';
import { beforeCoreEntryTranslations, type UiLocale } from './navigation-translation-preservation.ts';

const english = englishDictionary();
const locales = { zu, st, ts, ve };
const codes = ['zu', 'st', 'ts', 've'] as const;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const packet = JSON.parse(read('docs/translation/four-language-completion/core-entry-drafts.json')) as {
  status: string;
  entries: Array<{ key: string; english: string } & Partial<Record<UiLocale, string>>>;
  preserved: Array<{ key: string; language: UiLocale; wording: string }>;
};
const require = createRequire(import.meta.url);
const escape = (value: string) => renderToStaticMarkup(React.createElement('span', null, value)).slice(6, -7);

/** Exercise the shipped JSX, with only browser services and stored progress substituted. */
function homeComponents(lang: UiLocale, heroSource = read('components/home/HomeHeroCard.tsx')) {
  const dict = locales[lang];
  const dependencies: Record<string, unknown> = {
    '@/lib/i18n': { useLanguage: () => ({ lang, t: (key: string) => dict[key] ?? english[key] ?? key }) },
    '@/lib/site-progress': { useSiteProgress: () => ({ pct: 40, score: { steps: [{ done: true }, { done: true }, { done: false }, { done: false }, { done: false }] } }) },
    '@/lib/home-next-step': { nextAction: () => null },
    'next/link': { default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => React.createElement('a', props) },
    'next/dynamic': { default: () => () => null },
  };
  for (const name of ['ProgressSprout', 'HomeHeroCard']) {
    const source = name === 'HomeHeroCard' ? heroSource : read(`components/home/${name}.tsx`);
    const javascript = typescript.transpileModule(source, { compilerOptions: {
      target: typescript.ScriptTarget.ES2020, module: typescript.ModuleKind.CommonJS, jsx: typescript.JsxEmit.ReactJSX,
    } }).outputText;
    const module = { exports: {} as { default: React.ComponentType<any> } };
    new Function('require', 'module', 'exports', javascript)(
      (specifier: string) => dependencies[specifier] ?? require(specifier), module, module.exports,
    );
    dependencies[`@/components/home/${name}`] = module.exports;
  }
  return {
    hero: (props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(
      (dependencies['@/components/home/HomeHeroCard'] as { default: React.ComponentType<any> }).default,
      { places: [], mainSite: null, firstName: null, ...props },
    )),
    sprout: () => renderToStaticMarkup(React.createElement(
      (dependencies['@/components/home/ProgressSprout'] as { default: React.ComponentType<any> }).default,
      { completedSteps: 2, totalSteps: 5, progressPct: 40, interactive: true },
    )),
  };
}

test('Home welcome, staff destinations and sprout help render native controls without changing progress or links', () => {
  for (const lang of codes) {
    const components = homeComponents(lang);
    const welcome = components.hero({});
    for (const key of ['welcomeHeroTitle', 'welcomeHeroSub', 'welcomeFindLand', 'welcomeShowExample']) {
      assert.notEqual(locales[lang][key], english[key], `${lang}/${key}: English fallback is not a native action`);
      assert.ok(welcome.includes(escape(locales[lang][key])), `${lang}/${key}: translated text must reach Home`);
    }
    assert.ok(welcome.includes('href="/farmer?guided=1"'));
    for (const [role, prefix, href] of [['mentor', 'Mentor', '/mentor'], ['ngo', 'Organisation', '/ngo'], ['funder', 'Funder', '/funder']]) {
      const html = components.hero({ staffRole: role });
      for (const suffix of ['Title', 'Description', 'Open']) {
        const key = `home${prefix}Hero${suffix}`;
        assert.ok(html.includes(escape(locales[lang][key])), `${lang}/${role}: missing ${key}`);
      }
      assert.ok(html.includes(`href="${href}"`), 'staff must still reach their own workspace');
    }
    const sprout = components.sprout();
    assert.ok(sprout.includes(`aria-label="${escape(locales[lang].homeSproutAria)}"`));
    assert.ok(sprout.includes(escape(locales[lang].homeSproutDescription)));
    assert.ok(sprout.includes(escape(locales[lang].homeSproutStatus.replace('{completed}', '2').replace('{total}', '5').replace('{percent}', '40'))));
    assert.ok(sprout.includes('data-stage="2"'), 'translation cannot alter growth stage');
    assert.doesNotMatch(sprout, /\{(?:completed|total|percent)\}/);
  }
  const broken = homeComponents('st', read('components/home/HomeHeroCard.tsx').replace("t('welcomeFindLand')", "'Find my land'"));
  assert.ok(!broken.hero({}).includes(escape(st.welcomeFindLand)), 'the render check must expose a hardcoded English action');
});

test('Home dates use the selected weekday and the existing month authority without moving the stored date', () => {
  const source = read('app/home/page.tsx');
  const snippet = source.slice(source.indexOf('const ZU_WEEKDAY_KEYS'), source.indexOf('\nfunction LastSiteCard'));
  const js = typescript.transpileModule(snippet, { compilerOptions: { target: typescript.ScriptTarget.ES2020 } }).outputText;
  const format = new Function('translate', 'recordsMonthLong', 'LANG_TO_LOCALE', `${js}; return getDayDate;`)(
    (lang: UiLocale, key: string) => locales[lang][key], recordsMonthLong, { en: 'en-ZA' },
  ) as (lang: string, date: Date) => string;
  const date = new Date(2026, 9, 21, 12);
  const before = date.getTime();
  for (const lang of codes) {
    assert.equal(format(lang, date), `${locales[lang].homeWeekdayWed} · 21 ${recordsMonthLong(lang, 10)}`);
    assert.notEqual(format(lang, date), format('en', date));
  }
  assert.equal(date.getTime(), before);
});

test('core control drafts retain exact English sources, runtime values and earlier native wording', () => {
  assert.match(packet.status, /Unreviewed AI drafts/);
  for (const entry of packet.entries) {
    assert.equal(english[entry.key], entry.english, `${entry.key}: source changed`);
    for (const lang of codes) {
      const value = entry[lang];
      if (value === undefined) continue;
      assert.equal(locales[lang][entry.key], value, `${lang}/${entry.key}: review packet drift`);
      assert.deepEqual(translationGaps({ [entry.key]: entry.english }, { [entry.key]: value }), [], `${lang}/${entry.key}`);
      assert.deepEqual(value.match(/\d+/g) ?? [], entry.english.match(/\d+/g) ?? [], `${lang}/${entry.key}: source figures changed`);
    }
  }
  for (const row of packet.preserved) assert.equal(locales[row.language][row.key], row.wording, `${row.language}/${row.key}: previous native wording must remain`);
});

test('historical learning guards allow only the declared UI block and recorded direct-English replacements', () => {
  const source = read('lib/locales/ve.ts');
  const before = beforeCoreEntryTranslations(source, 've');
  assert.ok(before.includes("reportBiomeLabel: 'Biome'"), 'restore the exact prior English line before comparing history');
  assert.throws(() => beforeCoreEntryTranslations(source.replace(`homeSproutAria: ${JSON.stringify(ve.homeSproutAria)}`, 'homeSproutAria: "English"'), 've'));
  assert.throws(() => beforeCoreEntryTranslations(source.replace(`reportBiomeLabel: ${JSON.stringify(ve.reportBiomeLabel)}`, 'reportBiomeLabel: "Wrong"'), 've'));
  assert.throws(() => beforeCoreEntryTranslations(source.replace('const dict: Dict = {', 'const dict: Dict = {\n  homeSproutAria: "Override",'), 've'));
  assert.notEqual(beforeCoreEntryTranslations(source.replace('studentKeyPoints:', 'studentKeyPointsChanged:'), 've'), before,
    'unrelated learning changes must still reach the original historical hashes');
});
