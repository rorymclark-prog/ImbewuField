import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// TWO ENTRIES THAT LIED ABOUT WHERE THEY WENT.
//
// (1) 'Garden Survey' used to link to /survey, a 554-line wizard that writes
// imbewu_garden_survey to localStorage. lib/site-progress.ts — the single source
// for the Home progress bar and its "do this next" nudge — reads the DataPanel
// survey via lib/site-survey.ts's imbewu_site_survey_<id> instead. The two stores
// never meet, so a farmer who finished the wizard came back to Home, saw the bar
// unmoved, and was told to do the survey again. The fix repoints the menu entry
// to /farmer?openSurvey=1 — the same deep link app/home/page.tsx already uses for
// its own "Do the site survey" nudge (see STEP_ACTIONS.survey there), so the menu
// and the score now agree. /survey itself is untouched: it may still be bookmarked,
// and merging the two survey stores is a product decision, not a menu fix.
//
// (2) app/calendar/page.tsx — a maintained seasonal planting calendar — had no
// entry anywhere in the app. It now sits in Farm Tools beside Field Journal and
// Task Planner.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('Garden Survey opens the survey the progress bar actually reads', () => {
  const nav = read('../components/NavDrawer.tsx');
  assert.doesNotMatch(nav, /href: '\/survey'/,
    'the drawer must not link the orphaned /survey wizard — it feeds a store site-progress.ts never reads');
  assert.match(nav, /href: '\/farmer\?openSurvey=1', Icon: LayoutGrid, label: t\('navGardenSurvey'\)/,
    'Garden Survey must land on the deep link that actually opens the scored survey');

  // That deep link has to be a real one, not a dead query param.
  const farmerPage = read('../app/farmer/page.tsx');
  assert.match(farmerPage, /searchParams\.get\('openSurvey'\)/,
    'app/farmer/page.tsx no longer reads ?openSurvey= — the nav entry would silently land on the plain map');

  // And it must be the same link app/home/page.tsx's own progress-bar nudge uses,
  // so the two doors into the survey agree with each other.
  const homePage = read('../app/home/page.tsx');
  assert.match(homePage, /href: \(\) => '\/farmer\?openSurvey=1'/,
    "home's own 'do the site survey' nudge must point at the same URL as the drawer entry");
});

test('the Planting Calendar has a door in Farm Tools', () => {
  const nav = read('../components/NavDrawer.tsx');
  assert.match(nav, /href: '\/calendar', Icon: Calendar,\s*label: t\('navPlantingCalendar'\)/,
    'the calendar entry must sit alongside the other Farm Tools items, translated like they are');
  assert.match(nav, /import \{[\s\S]*?\bCalendar\b[\s\S]*?\} from 'lucide-react'/,
    'Lucide only — no emoji as UI icons');

  // English-only key: this repo never invents non-English strings. Every other
  // language block falls back to T.en at lookup time (see translate()/t() in
  // lib/i18n.tsx), so a single en entry is enough for the label to render everywhere.
  const i18n = read('../lib/i18n.tsx');
  const enBlockStart = i18n.indexOf('\n  en: {');
  const afBlockStart = i18n.indexOf('\n  af: {');
  const enBlock = i18n.slice(enBlockStart, afBlockStart);
  assert.match(enBlock, /navPlantingCalendar: 'Planting Calendar'/,
    'navPlantingCalendar must exist in the en block for the fallback to have something to fall back to');

  // Guard against someone "helpfully" adding translated copies later without review —
  // that would violate the no-invented-language rule this fix was built under.
  const allOccurrences = i18n.match(/^\s*navPlantingCalendar:/gm) ?? [];
  assert.equal(allOccurrences.length, 1, 'navPlantingCalendar should exist only in the en block');
});

test('the calendar page it links to renders real content on its own', () => {
  // Static seasonal data (CROPS/MONTHLY_DATA) plus an optional localStorage read that
  // is wrapped in try/catch and falls back to showing everything — no required props,
  // no auth gate, no site selection needed before something useful is on screen.
  const page = read('../app/calendar/page.tsx');
  assert.match(page, /const CROPS: CropRow\[\] = \[/, 'the calendar must ship its own crop data, not expect it from a prop');
  assert.match(page, /catch \{ \/\* ignore \*\/ \}/, 'the localStorage read must degrade gracefully with no saved planner crops');
});
