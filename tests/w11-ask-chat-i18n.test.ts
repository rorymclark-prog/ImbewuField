import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';

// swarm/w11-ask-photos-zu, lang-01 + a11y-03 + the chat part of a11y-01: components/ChatPanel.tsx
// was entirely hard-coded English, including a developer "Load Ubhejane farm data" button that
// writes demo records straight to a real farmer's device whenever Ask was opened — not gated on
// sample mode at all. A failed send also surfaced its message by overwriting the bubble's content
// with raw English, which this test pins as a state flag (`error`) instead so every language
// renders its own translated message, never the literal string.
//
// components/ChatWidget.tsx's sheet drew itself as a plain div with no role, no Escape handling,
// a 32px close button and a hard-coded cream background that stayed bright in dark mode; this
// pins the dialog semantics, the 44px close target and the themed background.

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('ChatPanel.tsx routes its chrome through t(), not literal English', () => {
  const s = source('components/ChatPanel.tsx');
  assert.match(s, /const \{ t, lang \} = useLanguage\(\)/, 'ChatPanel must read t()/lang from useLanguage()');
  assert.match(s, /from '@\/lib\/sample-mode'/, 'ChatPanel must import the shared sample-mode helper');

  for (const call of [
    "t('chatGreeting')",
    "t('chatIntro')",
    "t('chatSampleDataLoaded')",
    "t('chatSampleDataLoad')",
    "t('chatPhotoAttached')",
    "t('chatRemovePhoto')",
    "t('chatTakePhotoTitle')",
    "t('chatInputPlaceholder')",
    "t('chatThinking')",
    "t('chatDefaultPhotoQuestion')",
  ]) {
    assert.ok(s.includes(call), `ChatPanel.tsx no longer calls ${call}`);
  }

  // Regression guard: these exact hard-coded English literals must not come back.
  assert.doesNotMatch(s, /Hi — I&apos;m Lima\./, 'the greeting regressed to hard-coded English');
  assert.doesNotMatch(s, /placeholder="Ask Lima anything\.\.\."/, 'the input placeholder regressed to hard-coded English');
  assert.doesNotMatch(s, /"Ubhejane farm data loaded — tap to clear"/, 'the sample-data label regressed to a hard-coded string');
});

test('the Ubhejane test-data button only renders in sample mode', () => {
  const s = source('components/ChatPanel.tsx');
  assert.match(s, /\{isSampleMode\(\) && \(/, 'the sample-data button is not gated on isSampleMode()');
});

test('a failed send or an unreadable photo sets an error flag, never raw server/JS text', () => {
  const s = source('components/ChatPanel.tsx');
  assert.match(s, /error\?: boolean/, 'Msg needs an error flag instead of embedding error text in content');
  assert.doesNotMatch(s, /content: 'Sorry, something went wrong/, 'the catch block still writes raw English into message content');
  assert.doesNotMatch(s, /content: 'This photo could not be opened/, 'the photo-open failure still writes raw English into message content');
  assert.match(s, /error: true \}/, 'the catch block must set the error flag instead');
  assert.match(s, /t\(m\.errorKind === 'photo' \? 'chatPhotoOpenError' : 'chatErrorMessage'\)/,
    'the rendered error bubble must come from t(), not raw content');
});

test('the Lima chat sheet is a real modal dialog with a 44px close target and themed background', () => {
  const s = source('components/ChatWidget.tsx');
  assert.match(s, /role="dialog"/, 'the sheet does not identify itself as a dialog');
  assert.match(s, /aria-modal="true"/, 'the sheet does not mark itself modal');
  assert.match(s, /aria-labelledby=\{titleId\}/, 'the sheet has no accessible name tied to its title');
  assert.match(s, /id=\{titleId\}/, 'the title span is never given the id the dialog points to');
  assert.match(s, /e\.key === 'Escape'/, 'the sheet does not listen for Escape');
  assert.match(s, /width: 44,\s*\n\s*height: 44,/, 'the close button is not a 44px tap target');
  assert.doesNotMatch(s, /className="[^"]*u-glass/, 'the sheet still uses the fixed warm-cream .u-glass class instead of theme tokens');
  assert.match(s, /background: 'var\(--bg-0\)'/, 'the sheet panel background is not a theme token');
  assert.match(s, /background: 'var\(--bg-1\)'/, 'the sheet header background is not a theme token');
});

test('opening the Lima sheet moves focus in and closing it returns focus to the opener', () => {
  const s = source('components/ChatWidget.tsx');
  assert.match(s, /openerRef\.current = document\.activeElement/, 'the sheet never records what opened it');
  assert.match(s, /toFocus\?\.focus\(\)/, 'the sheet never moves focus in when it opens');
  assert.match(s, /openerRef\.current\?\.focus\?\.\(\)/, 'the sheet never returns focus to the opener on close');
  assert.match(s, /FOCUSABLE_SELECTOR/, 'the sheet has no Tab focus trap');
});

// Another track changes only ChatWidget's ChatPanel import to next/dynamic — this guards that
// this track's edits stayed off that import line.
test('ChatWidget still imports ChatPanel directly (another track owns the dynamic-import change)', () => {
  const s = source('components/ChatWidget.tsx');
  assert.match(s, /^import ChatPanel from '\.\/ChatPanel';$/m, 'the ChatPanel import line changed unexpectedly');
});

// lang-02: components/PhotoUpload.tsx was entirely hard-coded English, named the model
// "Claude Vision" instead of Lima, said "click" instead of "tap", and showed raw server/JS
// error text (`Server error ${res.status}`, a thrown Error's own .message) straight to the
// farmer.
test('PhotoUpload.tsx routes its chrome through t(), names Lima, and says "tap"', () => {
  const s = source('components/PhotoUpload.tsx');
  assert.match(s, /const \{ t, lang \} = useLanguage\(\)/, 'PhotoUpload must read t()/lang from useLanguage()');

  for (const call of [
    "t('photoAnalysisHeading')",
    "t('photoSatelliteViewTitle')",
    "t('photoSatelliteViewDesc')",
    "t('photoDropOrTap')",
    "t('photoUpToFive')",
    "t('photoClearButton')",
    "t('photoSelectLocationFirst')",
    "t('photoErrorBlankOrDark')",
    "t('photoErrorAnalysisFailed')",
  ]) {
    assert.ok(s.includes(call), `PhotoUpload.tsx no longer calls ${call}`);
  }

  assert.doesNotMatch(s, /Claude Vision/, 'the model is still named "Claude Vision" instead of Lima');
  assert.doesNotMatch(s, /Claude is analysing/, 'the loading copy still names Claude instead of Lima');
  assert.doesNotMatch(s, /click to upload/, 'the upload zone still says "click" instead of "tap"');
});

test('PhotoUpload.tsx never shows a raw server status or thrown-error message to the farmer', () => {
  const s = source('components/PhotoUpload.tsx');
  assert.doesNotMatch(s, /setError\(`Server error/, 'a raw server status can still reach setError');
  assert.doesNotMatch(s, /setError\(err instanceof Error \? err\.message/, 'a raw thrown-error message can still reach setError');
  assert.match(s, /setError\(t\('photoErrorAnalysisFailed'\)\)/, 'the catch block must set a translated message');
  assert.match(s, /console\.error\('Photo analysis failed:'/, 'the real error should still be logged for debugging');
});

// lang-06: components/ProfileSheet.tsx was entirely hard-coded English. The location-sharing
// switch is pinned as the first field after the photo picker, and must carry a plain-language
// explanation (not just a bare label) of who can see the farmer's pin on the map.
test('ProfileSheet.tsx routes its chrome through t(), with the location-sharing switch first', () => {
  const s = source('components/ProfileSheet.tsx');
  assert.match(s, /const \{ t, lang \} = useLanguage\(\)/, 'ProfileSheet must read t()/lang from useLanguage()');

  for (const call of [
    "t('profileTitle')",
    "t('profileClose')",
    "t('profileChangePhoto')",
    "t('profileFullNameLabel')",
    "t('profileRoleLabel')",
    "t('profileAboutYouLabel')",
    "t('profileSkillsLabel')",
    "t('profileMapVisibilityLabel')",
    "t('profileShowOnMapLabel')",
    "t('profileShowOnMapExplanation')",
    "t('profileSaveButton')",
  ]) {
    assert.ok(s.includes(call), `ProfileSheet.tsx no longer calls ${call}`);
  }

  // The map-visibility block (location-sharing switch) must come before the name field.
  const mapVisibilityAt = s.indexOf("t('profileMapVisibilityLabel')");
  const fullNameAt = s.indexOf("t('profileFullNameLabel')");
  assert.ok(mapVisibilityAt > -1 && fullNameAt > -1 && mapVisibilityAt < fullNameAt,
    'the location-sharing switch must render before the full-name field');

  // The switch must carry a plain-language explanation, not just a bare label.
  assert.match(s, /label=\{t\('profileShowOnMapLabel'\)\}\s*\n\s*sub=\{t\('profileShowOnMapExplanation'\)\}/,
    'the location-sharing switch lost its plain-language explanation');

  // Regression guard: these exact hard-coded English literals must not come back.
  assert.doesNotMatch(s, /aria-label="Your profile"/, 'the dialog label regressed to a hard-coded string');
  assert.doesNotMatch(s, />Change photo<\//, 'the change-photo button regressed to a hard-coded string');
  assert.doesNotMatch(s, /label="Show my location on the project map"/, 'the location switch regressed to a hard-coded label');
});

test("ProfileSheet.tsx leaves the close button's size alone (another track owns it)", () => {
  const s = source('components/ProfileSheet.tsx');
  assert.match(s, /width: 38,\s*\n\s*height: 38,/, 'the close button size changed unexpectedly');
});

// lang-07: app/error.tsx rendered error.message straight to the farmer (a raw JS stack-trace
// fragment is unreadable and unactionable), and app/error.tsx/not-found.tsx/global-error.tsx
// were English-only. None of the three can rely on useLanguage()/t() — a route-segment error
// can fire because the root layout (which mounts LanguageProvider) itself failed, and
// global-error.tsx replaces that layout outright — so lib/error-page-copy.ts reads
// localStorage directly and safely instead.
test('lib/error-page-copy.ts reads the saved language safely and never throws', () => {
  const s = source('lib/error-page-copy.ts');
  assert.match(s, /function readErrorPageLang/, 'the safe language reader is missing');
  assert.match(s, /try \{[\s\S]*?window\.localStorage\.getItem\('permamap_lang'\)[\s\S]*?\} catch/, 'the localStorage read is not wrapped in try/catch');
  assert.match(s, /errorTitle:/, 'the English copy pair is missing');
  assert.match(s, /errorTitle: 'Kukhona okungahambi kahle'/, 'the isiZulu copy pair is missing');
});

test('app/error.tsx never renders the raw JS error message and reads language safely', () => {
  const s = source('app/error.tsx');
  assert.doesNotMatch(s, /\{error\.message/, 'the raw error.message can still reach the farmer');
  assert.match(s, /console\.error\(error\)/, 'the real error should still be logged for debugging');
  assert.match(s, /readErrorPageLang/, 'app/error.tsx must use the safe language reader, not useLanguage()');
  assert.doesNotMatch(s, /useLanguage/, 'app/error.tsx must not depend on the language provider, which may have failed');
});

test('app/not-found.tsx and app/global-error.tsx are translated and read language safely', () => {
  for (const path of ['app/not-found.tsx', 'app/global-error.tsx']) {
    const s = source(path);
    assert.match(s, /readErrorPageLang/, `${path} must use the safe language reader, not useLanguage()`);
    assert.doesNotMatch(s, /useLanguage/, `${path} must not depend on the language provider, which may have failed`);
    assert.match(s, /copy\.(notFoundTitle|errorTitle)/, `${path} does not render translated copy`);
  }
});

test('app/global-error.tsx does not rely on globals.css custom properties (it replaces the root layout that loads it)', () => {
  const s = source('app/global-error.tsx');
  const styleBlocks = s.match(/style=\{\{[^}]*\}\}/g) ?? [];
  assert.ok(styleBlocks.length > 0, 'expected inline style objects to check — did the markup change?');
  for (const block of styleBlocks) {
    assert.doesNotMatch(block, /var\(--/, `global-error.tsx uses a CSS variable that app/globals.css may never have loaded here: ${block}`);
  }
});

// lang-08 + bug-10: app/farmer/page.tsx's header pill, AreaPanel, AtlasExplorer and
// SiteDesign's design-generation call each built their own ad hoc string from a bare
// `res.status` ('500', 'API error 500', 'Server error 500', 'HTTP 429') or showed the thrown
// Error's own .message straight to the farmer. lib/network-failure.ts is the one shared helper
// that replaces all of them, with an offline variant and a busy (429) variant.
test('lib/network-failure.ts classifies offline/busy/generic failures without ever echoing a status code', () => {
  const s = source('lib/network-failure.ts');
  assert.match(s, /function isOffline/, 'the offline check is missing');
  assert.match(s, /function networkFailureMessage/, 'the shared message helper is missing');
  assert.match(s, /opts\.status === 429/, 'the helper does not special-case 429');
  assert.doesNotMatch(s, /\$\{.*status/, 'the helper must never interpolate the status into a string shown to the farmer');
});

test('the four call sites route their network failures through the shared helper, never a bare status', () => {
  const sites: Array<{ path: string; status: string }> = [
    { path: 'app/farmer/page.tsx', status: 'res.status' },
    { path: 'components/AreaPanel.tsx', status: 'res.status' },
    { path: 'components/atlas/AtlasExplorer.tsx', status: 'res.status' },
    { path: 'components/SiteDesign.tsx', status: 'res.status' },
  ];
  for (const { path } of sites) {
    const s = source(path);
    assert.match(s, /networkFailureMessage\(t/, `${path} no longer calls networkFailureMessage(t, ...)`);
  }

  // Regression guard: these exact hard-coded fallback literals must not come back.
  assert.doesNotMatch(source('app/farmer/page.tsx'), /throw new Error\(`\$\{res\.status\}`\)/, 'the bare status-code throw regressed');
  assert.doesNotMatch(source('components/AreaPanel.tsx'), /throw new Error\(`API error \$\{res\.status\}`\)/, 'the "API error" throw regressed');
  assert.doesNotMatch(source('components/atlas/AtlasExplorer.tsx'), /`HTTP \$\{res\.status\}`/, 'the "HTTP <status>" fallback regressed');
  assert.doesNotMatch(source('components/SiteDesign.tsx'), /throw new Error\(`Server error \$\{res\.status\}`\)/, 'the "Server error" throw regressed');
  assert.doesNotMatch(source('components/SiteDesign.tsx'), /setError\(err instanceof Error \? err\.message : 'Design failed'\)/, 'the raw-message fallback regressed');
});

test('AtlasExplorer still shows the rate-limit API\'s own farmer-facing 429 message verbatim', () => {
  const s = source('components/atlas/AtlasExplorer.tsx');
  assert.match(s, /serverMessage: typeof serverMessage === 'string' \? serverMessage : undefined/,
    'the 429 rate-limit body message is no longer passed through to the helper');
});

// lib/locales/ve.ts carries a content hash several unrelated history-check tests gate on
// (tests/study-remaining-controls-next-history-checks.ts), so wiring new pending-English dicts
// into every lib/locales/<code>.ts file — this branch's first approach — silently broke a wide
// swath of unrelated course-content tests. New wave-11 keys are merged centrally in
// lib/i18n.tsx's loadLocale() instead, and no lib/locales/*.ts file is touched for it.
test('new wave-11 English-pending keys are merged centrally in loadLocale(), not spread into each locale file', () => {
  const i18n = source('lib/i18n.tsx');
  assert.match(i18n, /const WAVE11_ENGLISH_PENDING: Dict = \{/, 'the central wave-11 merge dict is missing');
  assert.match(i18n, /LOADED\[code\] = \{ \.\.\.WAVE11_ENGLISH_PENDING, \.\.\.mod\.default \}/,
    'loadLocale() no longer merges the wave-11 English defaults ahead of a locale\'s own overrides');

  for (const code of ['af', 'nr', 'nso', 'ss', 'st', 'tn', 'ts', 've', 'xh']) {
    const locale = source(`lib/locales/${code}.ts`);
    for (const dictName of ['CHAT_PANEL_ENGLISH_PENDING', 'PHOTO_UPLOAD_ENGLISH_PENDING', 'PROFILE_SHEET_ENGLISH_PENDING', 'NETWORK_FAILURE_ENGLISH_PENDING']) {
      assert.doesNotMatch(locale, new RegExp(dictName), `lib/locales/${code}.ts must not import or spread ${dictName} — see lib/i18n.tsx's loadLocale()`);
    }
  }
});

test('lib/locales/ve.ts is untouched by this track (its content hash is pinned elsewhere)', () => {
  const sha = createHash('sha256').update(readFileSync(new URL('../lib/locales/ve.ts', import.meta.url))).digest('hex');
  assert.equal(sha, 'e9deff4c7b627e99378bbc574111e23dd346911fcc8d4afb3ac60358c910db0e',
    'lib/locales/ve.ts no longer matches the baseline tests/study-remaining-controls-next-history-checks.ts gates on');
});

// lang-12: owner decision — 'supervisor'/'facilitator' on screen become 'mentor'.
test('on-screen role words say "mentor", not "supervisor" or "facilitator"', () => {
  const ngo = source('components/NgoDashboard.tsx');
  assert.doesNotMatch(ngo, /upervisor/, 'NgoDashboard.tsx still shows "supervisor" on screen');
  assert.match(ngo, /'logged by mentors'/, 'the produce-logged-by stat no longer says mentors');
  assert.match(ngo, /mentor \$\{garden\.facilitator\}/, 'the garden detail line no longer says mentor');

  const partners = source('app/partners/page.tsx');
  assert.doesNotMatch(partners, /facilitators/, 'app/partners/page.tsx still shows "facilitators" on screen');
  assert.match(partners, /Mentors see every farm in the programme/, 'the partners copy no longer reads as a single merged role');
});

// lang-13: the farmer's own site form had six different English names; this pins them down to
// "Site survey" (or "site survey" mid-sentence). The different NGO-built/sent questionnaire
// feature (home screen "Surveys" tile, /surveys) is renamed to "Questionnaires" so the two no
// longer collide.
test('the farmer\'s own site form consistently says "Site survey" in English', () => {
  const i18n = source('lib/i18n.tsx');
  assert.match(i18n, /siteQuestionnaireTitle: 'Site survey'/);
  assert.match(i18n, /navGardenSurvey: 'Site survey'/);
  assert.match(i18n, /openSurveyNoSiteMessage: 'The site survey belongs to a saved site\./);
  assert.match(i18n, /surveyPromptBody: "The site survey takes 2 minutes/);
  assert.match(i18n, /surveyFillButton: 'Fill in the site survey \(2 min\)'/);
  assert.match(i18n, /offlinePageFarmer: 'Site survey'/);

  // Regression guard: the old, inconsistent names must not come back.
  assert.doesNotMatch(i18n, /'Site questionnaire'/);
  assert.doesNotMatch(i18n, /'Garden Survey'/);
  assert.doesNotMatch(i18n, /'Garden & site survey'/);
});

test('the NGO-built/sent questionnaire feature is renamed away from "Surveys" so it stops colliding with "Site survey"', () => {
  const i18n = source('lib/i18n.tsx');
  assert.match(i18n, /homeSurveysLabel: 'Questionnaires'/);
  assert.match(i18n, /homeSurveysDesc: 'Answer field questionnaires/);
});
