import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools (lib/app-level.ts) for the Farm map site panel (components/DataPanel.tsx)
// and its fixes — swarm/map-simple. Source-text guards, in the style tests/tap-targets.test.ts
// and tests/home-next-step-links.test.ts already use for this codebase: read the real shipped
// file and assert the wiring a farmer or a mentor would actually hit is present.

const DATA_PANEL = readFileSync(new URL('../components/DataPanel.tsx', import.meta.url), 'utf8');
const FARMER_PAGE = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
const SURVEY_SHEET = readFileSync(new URL('../components/SiteSurveySheet.tsx', import.meta.url), 'utf8');
const MAP_SOURCE = readFileSync(new URL('../components/Map.tsx', import.meta.url), 'utf8');
const I18N = readFileSync(new URL('../lib/i18n.tsx', import.meta.url), 'utf8');

test('Simple shows five tabs; All tools keeps every tab', () => {
  assert.match(DATA_PANEL, /const simple = useAppLevel\(\) === 'simple';/,
    'DataPanel must read the Simple / All tools level');
  const simpleTabs = DATA_PANEL.match(/const SIMPLE_TABS: Tab\[\] = \[([^\]]+)\];/);
  assert.ok(simpleTabs, 'could not find SIMPLE_TABS in DataPanel.tsx');
  const names = simpleTabs![1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  assert.deepEqual(names, ['Overview', 'Ask', 'Water', 'Photos', 'Reports'],
    'Simple must show exactly Overview, Ask, Water, Photos, Reports');
  assert.match(DATA_PANEL, /\(simple \? SIMPLE_TABS : VISIBLE_TABS\)\.map\(\(tabName\) =>/,
    'the tab strip must switch on the Simple / All tools level, not drop VISIBLE_TABS');
});

test('Simple Overview folds the stats ledger, insights, Lima card and calendar behind one disclosure', () => {
  // The four blocks fold together; All tools renders them inline exactly as before (no wrapper).
  const overview = DATA_PANEL.slice(DATA_PANEL.indexOf("tab === 'Overview' && ("), DATA_PANEL.indexOf("tab === 'People'"));
  assert.match(overview, /if \(!simple\) return detailContent;/,
    'All tools must render the detail blocks unwrapped');
  assert.match(overview, /setDetailOpen\(\(open\) => !open\)/, 'Simple needs a disclosure toggle');
  assert.match(overview, /aria-expanded=\{detailOpen\}/, 'the disclosure button must expose its state');
  assert.match(overview, /\{detailOpen && \(/, 'the folded content must be collapsed by default (detailOpen starts false)');
  assert.match(DATA_PANEL, /const \[detailOpen, setDetailOpen\] = useState\(false\)/,
    'the disclosure must start collapsed');

  // The hero / completion score / NextStepCoach / weather stay before the fold, and the primary
  // CTA stays right after it — none of them move inside the disclosure, in either level.
  const foldStart = overview.indexOf('{(() => {');
  for (const anchor of ['quickSavePlace', '<CompletionScore', '<NextStepCoach', '<WeatherWidget']) {
    const at = overview.indexOf(anchor);
    assert.ok(at > 0 && at < foldStart, `${anchor} must render before the folded detail block`);
  }
  const foldEnd = overview.indexOf('})()}') + '})()}'.length;
  const ctaAt = overview.indexOf("t('generateFullReport')");
  assert.ok(ctaAt > foldEnd, "the primary CTA (generateFullReport) must render after the folded detail block, not inside it");
});

test('no ERA5 / NASA vendor pill beside annual rainfall, in either level (CLAUDE.md: no data-vendor badges)', () => {
  assert.doesNotMatch(DATA_PANEL, /ERA5-Land 9km grid/, 'the vendor-naming tooltip is still present');
  assert.doesNotMatch(DATA_PANEL, /rainfallSource === 'open-meteo' \? 'ERA5' : 'NASA'/, 'the ERA5/NASA pill is still present');
});

test('?openSurvey=1 tells a farmer with no saved site to save one first, instead of doing nothing', () => {
  const handler = FARMER_PAGE.slice(FARMER_PAGE.indexOf('openSurveyHandled.current = true;'), FARMER_PAGE.indexOf('}, [searchKey]);', FARMER_PAGE.indexOf('openSurveyHandled.current = true;')));
  assert.match(handler, /const main = resolveMainSite\(loadPlaces\(\)\);/);
  assert.match(handler, /\}\s*else\s*\{[\s\S]*appConfirm\(\{/, 'no main site must reach the appConfirm notice');
  assert.match(handler, /message: lang === 'zu'[\s\S]*translate\('en', 'openSurveyNoSiteMessage'\)/);
  // The old bug: setOpenSurvey(true) ran unconditionally, so DataPanel (gated on activePlaceId)
  // silently did nothing. It must not fire on the no-site branch.
  const noSiteBranch = handler.slice(handler.indexOf('} else {'), handler.indexOf('return undefined;'));
  assert.doesNotMatch(noSiteBranch, /setOpenSurvey\(true\)/,
    'the no-site branch must not still flag the survey open — DataPanel would silently ignore it');
});

test('the Design Studio pill and the survey photo tip use Lucide icons, not emoji', () => {
  assert.doesNotMatch(FARMER_PAGE, /aria-hidden>🎨</, 'the palette emoji is still in the Design Studio pill');
  assert.match(FARMER_PAGE, /<Palette size=\{15\} aria-hidden \/>/, 'the Design Studio pill must use the Lucide Palette icon');
  assert.doesNotMatch(SURVEY_SHEET, /📷/, 'the camera emoji is still in the photo tip');
  assert.match(SURVEY_SHEET, /<Camera size=\{14\} aria-hidden \/>/, 'the photo tip must use the Lucide Camera icon');
});

test('the header hairline, sheet grabber and report banner follow the theme instead of a hardcoded colour', () => {
  assert.doesNotMatch(FARMER_PAGE, /#E2D8C4/, 'a hardcoded hairline colour is still in app/farmer/page.tsx');
  assert.doesNotMatch(FARMER_PAGE, /#f2f7f2|#cbd9cc/, 'the report banner still hardcodes its background/border');
  const banner = FARMER_PAGE.slice(FARMER_PAGE.indexOf('reportSiteFlow && !showReport'), FARMER_PAGE.indexOf('reportSiteFlow && !showReport') + 200);
  assert.match(banner, /background:'var\(--bg-1\)'/);
  assert.match(banner, /borderBottom:'1px solid var\(--border\)'/);
});

test('the tree-count stepper and the map quick-guide button clear the 44px tap floor without growing their paint', () => {
  for (const [marker, key] of [
    ["setElCount((c) => Math.max(1, c - 1))", 'elementCountFewer'],
    ["setElCount((c) => c + 1)", 'elementCountMore'],
  ]) {
    const at = MAP_SOURCE.indexOf(marker as string);
    assert.ok(at > 0, `could not find the ${marker} stepper button`);
    const chunk = MAP_SOURCE.slice(at, at + 750);
    assert.match(chunk, /aria-label=\{lang === 'zu'/);
    assert.match(chunk, new RegExp(`translate\\('en', '${key}'\\)`));
    assert.match(chunk, /u-tap-target/);
    assert.match(chunk, /'--tap-inset': '-8px'/);
    assert.match(chunk, /width: 28, height: 28/, `${marker} must keep its painted 28px size`);
  }

  const guideAt = MAP_SOURCE.indexOf('onClick={() => setGuideOpen(true)}');
  assert.ok(guideAt > 0, 'could not find the quick-guide button');
  const guideChunk = MAP_SOURCE.slice(guideAt, guideAt + 500);
  assert.match(guideChunk, /u-tap-target/);
  assert.match(guideChunk, /'--tap-inset': '-9px'/);
  assert.match(guideChunk, /width: 26, height: 26/, 'the quick-guide button must keep its painted 26px size');
});

test('the new copy keys exist in the English dictionary', () => {
  for (const key of ['seeMoreDetail', 'openSurveyNoSiteTitle', 'openSurveyNoSiteMessage', 'openSurveyNoSiteConfirm', 'elementCountFewer', 'elementCountMore']) {
    assert.match(I18N, new RegExp(`\\b${key}:\\s*'`), `${key} is missing from T_en in lib/i18n.tsx`);
  }
});
