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
// The original gate held all new translations until first-language review. Rory subsequently
// authorised clearly marked isiZulu drafts before review. English remains the fixed source for
// consequential advice, while languages without drafts still use the English fallback.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/farmer-i18n-gaps.test.ts

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// lib/i18n.tsx used to hold all eleven language dictionaries inline as one ~420KB module,
// shipped in full on every page load. It's since been split for bundle size: English (the
// only locale ever loaded eagerly) stays inline as T_en in lib/i18n.tsx, and the other ten
// locales live one-per-file under lib/locales/, lazy-loaded on demand. localeBlocks() below
// reassembles the same { locale, block } shape the original single-file regex produced, so
// the assertions after it read the same either way.
const i18nSource = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');
const farmerPageSource = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
const dataPanelSource = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
const mapSource = readFileSync(new URL('../components/Map.tsx', import.meta.url), 'utf8');
const tipsSource = readFileSync(new URL('../app/tips/page.tsx', import.meta.url), 'utf8');
const recordsSource = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');
const studentPageSource = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
const homePageSource = readFileSync(new URL('../app/home/page.tsx', import.meta.url), 'utf8');
const draftNoteSource = readFileSync(new URL('../components/LanguageDraftNote.tsx', import.meta.url), 'utf8');
const sesothoUiReviewSource = readFileSync(new URL('../docs/study-translation-reviews/SESOTHO-STUDENT-WELCOME-UI-DRAFT-REVIEW.md', import.meta.url), 'utf8');

const OTHER_LOCALES = ['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr'] as const;

// All eleven locale blocks — the same set the original single-file version of this test
// iterated when it walked every `^  ([a-z]+): {` match in one lib/i18n.tsx.
function localeBlocks(): Array<{ locale: string; block: string }> {
  const enStart = i18nSource.indexOf('const T_en: Dict = {');
  const enEnd = i18nSource.indexOf('\n};', enStart);
  return [
    { locale: 'en', block: i18nSource.slice(enStart, enEnd) },
    ...OTHER_LOCALES.map((locale) => ({
      locale,
      block: readFileSync(new URL(`../lib/locales/${locale}.ts`, import.meta.url), 'utf8'),
    })),
  ];
}

// Brand new — did not exist anywhere in the dictionary before this change.
const ENGLISH_SOURCE_KEYS = [
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

const ZULU_UI_DRAFT_SOURCE_KEYS = [
  'elementCountFewer', 'elementCountMore', 'seeMoreDetail',
  'soilImprovementPhAcidic', 'soilImprovementPhAlkaline', 'soilImprovementLowCarbon',
  'soilImprovementCompacted', 'soilImprovementHighClay', 'soilImprovementSandy',
  'openSurveyNoSiteTitle', 'openSurveyNoSiteMessage', 'openSurveyNoSiteConfirm',
  'tipsEyebrow', 'tipsTitle', 'tipsIntro', 'tipsChoosePracticeView', 'tipsBrowseGardensReports',
  'tipsFindLabel', 'tipsSearchPlaceholder', 'tipsNoMatch', 'tipsAskForHelp',
  'tipsVideoGuidesTitle', 'tipsVideoGuidesBody', 'tipsYoutubeLink', 'tipsYoutubeNote',
  'bookTabPicked', 'bookTabSold', 'bookTabSpent', 'bookTabCharts',
] as const;

test('farmer-facing English source stays present while only isiZulu gains marked drafts', () => {
  const blocks = localeBlocks();
  assert.ok(blocks.length >= 11, 'expected all eleven ImbewuField locales to be present');

  const en = blocks.find((b) => b.locale === 'en');
  assert.ok(en, 'no `en` locale block found in lib/i18n.tsx');
  for (const key of ENGLISH_SOURCE_KEYS) {
    assert.match(en!.block, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} has no English source text in the en block`);
  }

  for (const { locale, block } of blocks) {
    if (locale === 'en') continue;
    for (const key of ENGLISH_SOURCE_KEYS) {
      if (locale === 'zu' && key === 'designStudioLabel') {
        assert.match(block, /^  designStudioLabel: ['"]/m, 'the isiZulu Design Studio draft is missing');
        assert.match(block, /^  designStudioZuluDraftBadge: ['"]/m, 'the isiZulu draft marker is missing');
        continue;
      }
      // isiXhosa (23 Oct 2026): Rory asked for the whole app in isiXhosa, so its nav label is a
      // machine draft too, marked by the same page-level <LanguageDraftNote> DataPanel renders.
      // The soil advice keys stay English-only: DataPanel shows imp.source for every non-zu locale.
      if (locale === 'xh' && key === 'designStudioLabel') {
        assert.match(block, /^  designStudioLabel: ['"]/m, 'the isiXhosa Design Studio draft is missing');
        continue;
      }
      assert.doesNotMatch(
        block,
        new RegExp(`^  ${key}:`, 'm'),
        `${locale} must use the English source for ${key} unless a separately marked draft is displayed`,
      );
    }
  }
  // zu-04 (wave 14): the draft marker used to live as a second line inside the "Design Studio"
  // nav pill itself (`t('designStudioZuluDraftBadge')` right there in app/farmer/page.tsx),
  // which grew the pill to two lines. It now lives once, under the header, in the shared
  // <LanguageDraftNote> DataPanel renders — so the pill stays a single-line label and the draft
  // is marked by the page-level note instead of inside the pill.
  assert.doesNotMatch(farmerPageSource, /designStudioZuluDraftBadge['")][\s\S]{0,40}English: Design Studio/, 'the Design Studio draft marker must not grow the nav pill to two lines any more');
  assert.match(dataPanelSource, /<LanguageDraftNote lang=\{lang\} scope="farmer" \/>/, 'the Design Studio draft is not visibly marked');
  assert.match(dataPanelSource, /translate\('en', imp\.key\)/, 'soil advice must retain the English source even if a draft is added');
  const zu = blocks.find((b) => b.locale === 'zu')!.block;
  for (const key of ENGLISH_SOURCE_KEYS.filter((key) => key.startsWith('soilImprovement'))) {
    assert.match(zu, new RegExp(`^  ${key}ZuDraft: ['"]`, 'm'), `${key} has no marked isiZulu draft`);
  }
  assert.match(zu, /^  soilImprovementZuluDraftNotice: ['"]/m, 'the soil advice draft notice is missing');
});

test('the rewired keys (Details/Results, tap to close, panel aria-labels) were already fully translated', () => {
  const blocks = localeBlocks();
  for (const { locale, block } of blocks) {
    for (const key of REWIRED_EXISTING_KEYS) {
      assert.match(block, new RegExp(`^  ${key}: ['"]`, 'm'), `${locale} is missing ${key} — it should predate this change`);
    }
  }
});

test('the remaining 29 English UI sources have marked isiZulu drafts and keep their source meaning available', () => {
  const blocks = localeBlocks();
  const en = blocks.find((b) => b.locale === 'en')!.block;
  const zu = blocks.find((b) => b.locale === 'zu')!.block;
  assert.equal(ZULU_UI_DRAFT_SOURCE_KEYS.length, 29, 'keep the reviewed gap-audit batch complete');
  for (const key of ZULU_UI_DRAFT_SOURCE_KEYS) {
    assert.match(en, new RegExp(`^  ${key}: ['"]`, 'm'), `${key} lost its exact English source`);
    assert.match(zu, new RegExp(`^  ${key}ZuDraft: ['"]`, 'm'), `${key} has no separately marked isiZulu draft`);
    for (const { locale, block } of blocks) {
      if (locale === 'en' || locale === 'zu') continue;
      assert.doesNotMatch(block, new RegExp(`^  ${key}ZuDraft:`, 'm'), `${locale} must not use an unreviewed isiZulu draft`);
    }
  }
  assert.match(dataPanelSource, /soilImprovementZuluDraftNotice/);
  assert.match(dataPanelSource, /translate\('en', imp\.key\)/, 'soil advice must keep the English wording beside each draft');
  for (const key of ['elementCountFewer', 'elementCountMore']) {
    assert.match(
      mapSource,
      new RegExp(`aria-label=\\{lang === 'zu'[\\s\\S]*?t\\('${key}ZuDraft'\\)[\\s\\S]*?translate\\('en', '${key}'\\)[\\s\\S]*?: t\\('${key}'\\)`),
      `${key} must announce its draft and English source to assistive technology`,
    );
  }
  assert.match(farmerPageSource, /Unreviewed isiZulu draft\. English source:[\s\S]*openSurveyNoSiteMessage/);
  assert.match(tipsSource, /Unreviewed isiZulu draft\. Each guide keeps its exact English source below\./,
    'Tips now drafts the instructions as well as the page labels, so the notice must describe both');
  assert.match(tipsSource, /English source: \{g\.en\.text\}/,
    'record and money guides must keep their exact English instructions beside the isiZulu draft');
  // zu-04 (wave 14): the tab-label draft notice used to sit between the tabs and the form,
  // English-first ('Uhlaka olungakabuyekezwa — Unreviewed isiZulu tab-label drafts...'). It now
  // lives once, under the header, in the shared <LanguageDraftNote>; the separate regional
  // (Sesotho/Tshivenda/Xitsonga) tab-label notice stays, since it covers languages this shared
  // component doesn't.
  assert.match(recordsSource, /<LanguageDraftNote lang=\{lang\} scope="records" \/>/);
  assert.doesNotMatch(recordsSource, /Unreviewed isiZulu tab-label drafts/);
});

const SESOTHO_STUDY_DRAFT_KEYS = [
  'studentPortal', 'studentPortalTitle', 'studentBackHome', 'studentMyStudies',
  'studentLearnPracticeGrow', 'studentRevisit', 'studentStart', 'studentContinue',
  'studentReady', 'studentKeepGoing', 'studentModulesComplete', 'studentRemaining',
  'studentPractitioner', 'studentCategoryFoundation', 'studentCategoryWater',
  'studentCategorySoil', 'studentCategoryPlants', 'studentCategoryDesign',
  'studentCategoryBusiness', 'studentCategorySeeds', 'studentCorrect',
  'studentCloseLesson', 'studentOpenLesson', 'studentListenOrRead',
  'studentReadAndPractise', 'studentListenToLesson', 'studentWatchAndListen',
  'studentKeyPoints', 'studentCheckUnderstanding', 'studentRelatedLessons',
  'studentStudyOffline', 'studentSaveBeforeSignal', 'studentSaveAvailable',
  'studentYourCourse', 'studentModule', 'studentModules', 'studentLocked',
  'studentComplete', 'studentContinueHere', 'studentAssigned', 'studentAudio',
  'studentLessonOne', 'studentLessons', 'studentDone', 'studentMarkDone',
  'studentLessonsLabel', 'studentSesothoUiDraftNotice',
] as const;

const SESOTHO_STUDY_HOLD_KEYS = [
  'studentCourseDescription',
  'studentCourseComplete',
  'studentMarkComplete',
] as const;

const SESOTHO_SAFE_UI_DRAFT_KEYS = [
  'studentAppGuidesHeading',
  'studentAppGuidesTitle',
  'studentOpenDesignStudio',
  'welcomeShowExample',
] as const;

function dictionaryString(block: string, key: string): string | undefined {
  return block.match(new RegExp(`^\\s{2}${key}: '([^']*)',?$`, 'm'))?.[1];
}

test('a QwaQwa learner sees Latin-script Sesotho drafts and English for held study wording', () => {
  const enStart = i18nSource.indexOf('const T_en: Dict = {');
  const enEnd = i18nSource.indexOf('\n};', enStart);
  const english = i18nSource.slice(enStart, enEnd);
  const sesotho = readFileSync(new URL('../lib/locales/st.ts', import.meta.url), 'utf8');
  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;

  for (const key of SESOTHO_STUDY_DRAFT_KEYS) {
    const source = dictionaryString(english, key);
    const draft = dictionaryString(sesotho, key);
    assert.ok(source, `${key} must keep its English source`);
    assert.ok(draft, `${key} must be present in the Sesotho draft`);
    assert.doesNotMatch(draft, nonLatin, `${key} must not contain non-Latin script`);
    assert.deepEqual(
      draft.match(/\{[^{}]+\}/g) ?? [],
      source.match(/\{[^{}]+\}/g) ?? [],
      `${key} must preserve every runtime placeholder`,
    );
  }

  for (const key of SESOTHO_STUDY_HOLD_KEYS) {
    assert.ok(dictionaryString(english, key), `${key} must keep its English source`);
    assert.equal(dictionaryString(sesotho, key), undefined, `${key} must remain in English until the wording is reviewed`);
  }

  assert.equal(
    dictionaryString(sesotho, 'studentSesothoUiDraftNoticeSource'),
    dictionaryString(english, 'studentSesothoUiDraftNoticeSource'),
    'the Study page must show the exact English source beside the Sesotho notice',
  );
  assert.match(studentPageSource, /lang === 'st'/, 'the Study page must identify the Sesotho draft');
  assert.match(studentPageSource, /t\('studentSesothoUiDraftNotice'\)/, 'the unreviewed Sesotho notice must be visible');
  assert.match(studentPageSource, /t\('studentSesothoUiDraftNoticeSource'\)/, 'the notice must show its exact English source');
  assert.match(studentPageSource, /<span lang="st">\{t\('studentSesothoUiDraftNotice'\)\}<\/span>/, 'the Sesotho notice must expose its language to assistive technology');
  assert.match(studentPageSource, /<span lang="en"[^>]*>English source: \{t\('studentSesothoUiDraftNoticeSource'\)\}<\/span>/, 'the paired English source must expose its language');
});

test('the small Sesotho Student and Welcome draft keeps its English sources and visible review notice', () => {
  const enStart = i18nSource.indexOf('const T_en: Dict = {');
  const enEnd = i18nSource.indexOf('\n};', enStart);
  const english = i18nSource.slice(enStart, enEnd);
  const sesotho = readFileSync(new URL('../lib/locales/st.ts', import.meta.url), 'utf8');
  const nonLatin = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u;

  for (const key of SESOTHO_SAFE_UI_DRAFT_KEYS) {
    const source = dictionaryString(english, key);
    const draft = dictionaryString(sesotho, key);
    assert.ok(source, `${key} must retain its English source`);
    assert.ok(draft, `${key} must have its marked Sesotho UI draft`);
    assert.notEqual(draft, source, `${key} must not silently show English`);
    assert.doesNotMatch(draft, nonLatin, `${key} must use Latin script`);
    assert.deepEqual(draft.match(/\{[^{}]+\}/g) ?? [], source.match(/\{[^{}]+\}/g) ?? [],
      `${key} must preserve any runtime placeholders`);
    assert.ok(sesothoUiReviewSource.includes(`| \`${key}\` | ${source} | ${draft} |`),
      `${key} must keep its exact source and draft in the review packet`);
  }

  // Home now has one shared warning for all four drafts, outside the welcome card.
  // The old Sesotho-only card note would duplicate that warning and miss the other languages.
  assert.match(homePageSource, /<LanguageDraftNote lang=\{lang\} scope="home" \/>/,
    'Welcome must remain covered by the page draft notice');
  assert.match(draftNoteSource, /\['zu', 'st', 'ts', 've'\]\.includes\(lang\)/,
    'the shared warning must include Sesotho and the other target languages');
  assert.match(draftNoteSource, /t\('languageDraftNoticeText'\)/,
    'the shared notice must identify its unreviewed wording');
  assert.match(draftNoteSource, /<p lang="en"[^>]*>\{translate\('en', 'languageDraftNoticeEnglishText'\)/,
    'the collapsed notice must retain the canonical English source');
  assert.match(draftNoteSource, /onClick=\{\(\) => setLang\('en'\)\}/,
    'the English source page must remain accessible');
  assert.match(sesothoUiReviewSource, /No human fluent review has been completed/);
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
  const en = localeBlocks().find((b) => b.locale === 'en')!.block;
  assert.match(en, /soilImprovementPhAcidic: '[^']*\{ph\}[^']*'/);
  assert.match(en, /soilImprovementLowCarbon: '[^']*\{oc\}[^']*'/);
  assert.match(en, /soilImprovementCompacted: '[^']*\{bd\}[^']*'/);
  assert.match(en, /soilImprovementHighClay: '[^']*\{clay\}[^']*'/);
  assert.match(en, /soilImprovementSandy: '[^']*\{sand\}[^']*'/);
  const zu = localeBlocks().find((b) => b.locale === 'zu')!.block;
  for (const [key, token] of [
    ['soilImprovementPhAcidic', '{ph}'], ['soilImprovementPhAlkaline', '{ph}'],
    ['soilImprovementLowCarbon', '{oc}%'], ['soilImprovementCompacted', '{bd} g/cm³'],
    ['soilImprovementHighClay', '{clay}%'], ['soilImprovementSandy', '{sand}%'],
  ] as const) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(zu, new RegExp(`^  ${key}ZuDraft: '[^']*${escaped}[^']*'`, 'm'), `${key} draft lost its live value placeholder`);
  }
  assert.match(zu, /^  soilImprovementPhAcidicZuDraft: '[^']*1–2 t\/ha[^']*'/m);
  assert.match(zu, /^  soilImprovementLowCarbonZuDraft: '[^']*5 cm[^']*'/m);

  // The defect this guards against: the exact hard-coded template literals that used to sit here,
  // directly under the translated priorityImprovementsHeader — the worst version of this bug,
  // because the farmer can see the app knows their language and is choosing not to use it here.
  assert.doesNotMatch(dataPanelSource, /is acidic — add agricultural lime/, 'soil advice regressed to a hard-coded template literal');
  assert.doesNotMatch(dataPanelSource, /is low — layer compost 5 cm deep/, 'soil advice regressed to a hard-coded template literal');
  assert.doesNotMatch(dataPanelSource, /suggests compaction — deep-rooted cover crops/, 'soil advice regressed to a hard-coded template literal');
});

// copy-07 (wave 13 audit): nav*/tab*/home* English values were Title Case ("Farm Tools", "Task
// Planner"...) against the rest of the UI's sentence-case convention. Most were fixed in that
// wave; this guards against new ones creeping back in. A handful of pre-existing keys are left
// out deliberately rather than fixed, because their exact string is pinned by another, unowned
// test or by a reviewed-translation pairing — see the wave-13 PR body for the list.
const TITLE_CASE_NAV_TAB_HOME_ALLOWLIST = new Set([
  'navPlantingCalendar', // tests/nav-menu-links.test.ts asserts the literal 'Planting Calendar'
  'homeQuickMyRecords', // "My Records" is the deliberately-chosen name (copy-04)
  'homeRoleNGOLabel', 'navNGOLabel', // "NGO" is an initialism, not a Title Case violation
  'homeQuickContactDesc', // 'Mentor · Organisation' — a role list, each word a proper role name
  'homeLimaVisionLabel', // 'Lima Vision' — Lima is the product's AI assistant, a proper noun
]);

test('new nav*/tab*/home* English keys stay sentence case, not Title Case', () => {
  const en = localeBlocks().find((b) => b.locale === 'en')!.block;
  const re = /^  (nav|tab|home)[A-Za-z0-9_]*: '([^']*)',$/gm;
  const offenders: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(en))) {
    const [full, , value] = m;
    const key = full.slice(2, full.indexOf(':'));
    if (TITLE_CASE_NAV_TAB_HOME_ALLOWLIST.has(key)) continue;
    // A short label with two or more capitalised words (and no sentence punctuation) reads as
    // Title Case; proper nouns (Lima, ImbewuField, NGO, isiZulu names) stay capitalised, so this
    // only flags when capitalised words make up most of a short phrase.
    const words = value.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
    if (words.length < 2 || words.length > 4 || /[.!?]/.test(value)) continue;
    const capRatio = words.filter((w) => {
      const bare = w.replace(/[^A-Za-z]/g, '');
      return bare.length > 0 && bare[0] === bare[0].toUpperCase() && bare[0] !== bare[0].toLowerCase();
    }).length;
    if (capRatio >= 2 && capRatio === words.length) offenders.push(`${key}: '${value}'`);
  }
  assert.deepEqual(offenders, [], 'new nav/tab/home keys must use sentence case (one capital letter, proper nouns aside) — see CLAUDE.md');
});
