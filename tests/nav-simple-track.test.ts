import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Menu, Settings & app chrome — Simple mode + fixes (swarm/nav-simple).
//
// One file for the whole track rather than one per fix, because most of these fixes are a few
// lines each and share the same source-text-guard style the rest of this repo's UI-wiring tests
// use (see tests/home-next-step-links.test.ts, tests/app-level.test.ts).

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const NAV_DRAWER = read('../components/NavDrawer.tsx');
const TAB_BAR = read('../components/TabBar.tsx');
const THEME_PANEL = read('../components/ThemePanel.tsx');
const TOUR_DISCOVERY = read('../components/TourDiscovery.tsx');
const PWA_NOTIFIER = read('../components/PWAUpdateNotifier.tsx');
const UPDATE_GUIDE = read('../components/UpdateGuide.tsx');
const UPDATES_PAGE = read('../app/updates/page.tsx');
const LIMA_BAR = read('../components/LimaBar.tsx');
const APP_ROOT_PAGE = read('../app/page.tsx');
const I18N = read('../lib/i18n.tsx');
const I18N_ZU = read('../lib/locales/zu.ts');

/* ── Task 1: Simple menu ──────────────────────────────────────────────────────────────────── */

test('NavDrawer reads Simple / All tools and filters its rows by it, on top of role filtering', () => {
  assert.match(NAV_DRAWER, /import \{ useAppLevel \} from '@\/lib\/app-level'/,
    'NavDrawer must read the Simple / All tools level');
  assert.match(NAV_DRAWER, /const simple = useAppLevel\(\) === 'simple';/);
  // The Simple allow-list keeps the core jobs and nothing else — checked as a set, not a
  // sequence, since it is written as one across the file.
  const CORE_HREFS = [
    '/home', '/farmer', '/records', '/facilitator/crops', '/calendar',
    '/journal', '/student', '/contact', '/design', '/account',
  ];
  for (const href of CORE_HREFS) {
    assert.match(NAV_DRAWER, new RegExp(`'${href.replace(/\//g, '\\/')}'`),
      `Simple's allow-list must name ${href}`);
  }
  // Simple filtering must be additive to, not a replacement for, role/workspace filtering.
  assert.match(NAV_DRAWER,
    /\(sample \|\| canSeeNavLink\(role, href\)\) &&\s*\n\s*canSeeWorkspaceLink\(navigationRole, href\) &&\s*\n\s*\(!simple \|\| SIMPLE_NAV_HREFS\.has\(href\)\)/,
    'the Simple check must sit alongside canSeeNavLink/canSeeWorkspaceLink, not instead of them');
});

test('organisation, expert and marketing rows are named as hidden from Simple, not carried into its allow-list', () => {
  const HIDDEN_FROM_SIMPLE = [
    '/reports', '/atlas', '/network', '/exchange', '/community',
    '/cropplan', '/farmer?openSurvey=1', '/vision',
    '/surveys', '/assessments', '/mentor', '/ngo', '/funder',
    '/offline', '/samples', '/samples/gardens', '/feedback', '/updates',
  ];
  const setBlock = NAV_DRAWER.match(/const SIMPLE_NAV_HREFS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(setBlock, 'could not find the Simple allow-list');
  for (const href of HIDDEN_FROM_SIMPLE) {
    assert.doesNotMatch(setBlock![1], new RegExp(`'${href.replace(/[/?=]/g, '\\$&')}'`),
      `${href} must not be in Simple's allow-list — it is an organisation, expert or marketing row`);
  }
});

test('All tools is unaffected — every row NavDrawer offered before still exists, unfiltered by default', () => {
  // A quick canary that the item arrays themselves were not pruned, only filtered at render time.
  for (const href of ['/reports', '/atlas', '/network', '/exchange', '/cropplan',
    '/farmer?openSurvey=1', '/vision', '/surveys', '/assessments', '/mentor', '/ngo', '/funder',
    '/offline', '/samples', '/samples/gardens', '/feedback', '/updates']) {
    assert.match(NAV_DRAWER, new RegExp(`href: '${href.replace(/[/?=]/g, '\\$&')}'`),
      `${href} must still be a real row in NavDrawer — Simple hides it at render time, it does not remove it`);
  }
});

/* ── Task 2: Take a tour / Show me the menu contrast ─────────────────────────────────────── */

test('the Take a tour row and the tour tip button use a real fill under white type, not the text-only harvest token', () => {
  assert.doesNotMatch(NAV_DRAWER, /background:\s*'var\(--color-harvest\)'/,
    'NavDrawer must not paint a background with the text-only --color-harvest token');
  assert.match(NAV_DRAWER, /background:'#9A6018',color:'#fff'/,
    'the Take a tour row must use the CLAUDE.md ochre fill with white text');

  assert.doesNotMatch(TOUR_DISCOVERY, /background: 'var\(--color-harvest\)', color: 'var\(--text-primary\)'/,
    'TourDiscovery\'s "Show me the menu" button must not pair the harvest token background with primary text');
  assert.match(TOUR_DISCOVERY, /background: '#9A6018', color: '#fff'/,
    'the "Show me the menu" button must use the CLAUDE.md ochre fill with white text');
});

/* ── Task 3: TabBar /network label ───────────────────────────────────────────────────────── */

test('the NGO and funder tab bars label /network with navNetwork, not the menu-section heading key', () => {
  const tabsBlock = TAB_BAR.slice(TAB_BAR.indexOf('const tabs ='), TAB_BAR.indexOf(';', TAB_BAR.indexOf('TABS;')) + 1);
  assert.doesNotMatch(tabsBlock, /'navSectionOrganisation'/,
    '/network must not reuse the "Organisation" section heading as a tab label');
  assert.match(tabsBlock, /href: '\/network', key: 'navNetwork'/g);
});

/* ── Task 4: no data-vendor badges ───────────────────────────────────────────────────────── */

test('Settings no longer names data vendors', () => {
  for (const vendor of ['NASA', 'ISRIC', 'Claude AI']) {
    assert.doesNotMatch(THEME_PANEL, new RegExp(vendor), `ThemePanel must not name ${vendor} — CLAUDE.md forbids data-vendor badges`);
  }
  assert.doesNotMatch(THEME_PANEL, /Satellite,\s*Sprout,\s*Mountain,\s*Sparkles/,
    'the vendor-badge icon imports should be gone along with the block that used them');
});

/* ── Task 5: i18n + icons for TourDiscovery / PWAUpdateNotifier / UpdateGuide ────────────── */

test('TourDiscovery, PWAUpdateNotifier and UpdateGuide route their copy through t(), with isiZulu drafts', () => {
  for (const [name, src] of [['TourDiscovery', TOUR_DISCOVERY], ['PWAUpdateNotifier', PWA_NOTIFIER], ['UpdateGuide', UPDATE_GUIDE]] as const) {
    assert.match(src, /from '@\/lib\/i18n'/, `${name} must import the translation hook`);
    assert.match(src, /\bt\(/, `${name} must call t()`);
  }
  // Spot-check a handful of the new keys actually exist in both English and the isiZulu draft.
  const KEYS = [
    'tourMenuTipTitle', 'tourMenuTipShowMenu',
    'updateBannerReady', 'updateBannerRefreshButton',
    'updateGuideOfferTitle', 'updateGuideStop',
  ];
  for (const key of KEYS) {
    assert.match(I18N, new RegExp(`^\\s*${key}:`, 'm'), `${key} must exist in T_en`);
    assert.match(I18N_ZU, new RegExp(`^\\s*${key}:`, 'm'), `${key} must have an isiZulu draft`);
  }
});

test('the raw glyphs are gone from these three files, replaced by Lucide icons', () => {
  for (const [name, src] of [['TourDiscovery', TOUR_DISCOVERY], ['PWAUpdateNotifier', PWA_NOTIFIER], ['UpdateGuide', UPDATE_GUIDE]] as const) {
    assert.doesNotMatch(src, /[⌃✕]/, `${name} must not use a raw ⌃/✕ glyph as an icon`);
    assert.doesNotMatch(src, />\s*×\s*</, `${name} must not use a raw × glyph as an icon`);
  }
  assert.match(PWA_NOTIFIER, /from 'lucide-react'/);
  assert.match(PWA_NOTIFIER, /ChevronUp/);
  assert.match(UPDATE_GUIDE, /from 'lucide-react'/);
  assert.match(UPDATE_GUIDE, /\bX\b/);
});

/* ── Task 6: /updates caps to recent entries and drops the SHA ──────────────────────────── */

test('/updates shows only the recent entries, with an All-tools-only disclosure, and never prints a SHA', () => {
  assert.match(UPDATES_PAGE, /const RECENT_COUNT = 10;/);
  assert.match(UPDATES_PAGE, /RELEASE_NOTES\.slice\(0, RECENT_COUNT\)/);
  assert.match(UPDATES_PAGE, /!simple && hasOlder/,
    'the "Show older updates" disclosure must be gated to All tools');
  assert.doesNotMatch(UPDATES_PAGE, /entry\.sha\s*&&/,
    'the page must not render a release note\'s git SHA to a farmer');
  assert.doesNotMatch(UPDATES_PAGE, /build \{buildSha\}/,
    'the header must not print the running build\'s SHA either');
});

/* ── Task 7: small fixes ─────────────────────────────────────────────────────────────────── */

test('LimaBar\'s caption follows the theme and app/page.tsx no longer says "supervisors"', () => {
  assert.doesNotMatch(LIMA_BAR, /#7A6B52/, 'LimaBar must not hardcode the caption colour');
  assert.match(LIMA_BAR, /color: 'var\(--text-muted\)'/);
  assert.doesNotMatch(APP_ROOT_PAGE, /supervisors/i, 'app/page.tsx\'s comment must say mentors, not supervisors');
  assert.match(APP_ROOT_PAGE, /mentors/);
});
