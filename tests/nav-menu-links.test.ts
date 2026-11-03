import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

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
// and the score now agree. The orphaned /survey wizard itself was deleted on 2026-09-26.
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

  // And it must be the same link Home's own next-step nudge uses (lib/home-next-step.ts, shared
  // by both Home layouts), so the two doors into the survey agree with each other.
  const homeNextStep = read('../lib/home-next-step.ts');
  assert.match(homeNextStep, /href: \(\) => '\/farmer\?openSurvey=1'/,
    "home's own 'do the site survey' nudge must point at the same URL as the drawer entry");
});

test('the Planting Calendar has a translated door in Farm Tools for every target language', async () => {
  const nav = read('../components/NavDrawer.tsx');
  assert.match(nav, /href: '\/calendar', Icon: Calendar,\s*label: t\('navPlantingCalendar'\)/,
    'the calendar entry must sit alongside the other Farm Tools items, translated like they are');
  assert.match(nav, /import \{[\s\S]*?\bCalendar\b[\s\S]*?\} from 'lucide-react'/,
    'Lucide only — no emoji as UI icons');

  // Rory's whole-app pass extends the isiZulu label to all four target languages.
  // Reachability and a real local label are the rule; exactly two declarations was a snapshot.
  const i18n = read('../lib/i18n.tsx');
  const enBlockStart = i18n.indexOf('const T_en: Dict = {');
  const enBlockEnd = i18n.indexOf('\n};', enBlockStart);
  const enBlock = i18n.slice(enBlockStart, enBlockEnd);
  assert.match(enBlock, /navPlantingCalendar: 'Planting calendar'/,
    'navPlantingCalendar must exist in the en block for the fallback to have something to fall back to');

  const zu = read('../lib/locales/zu.ts');
  assert.match(zu, /navPlantingCalendar: '[^']+'/,
    'isiZulu navigation needs its own calendar label when that language is selected');

  const localeFiles = [
    i18n,
    ...['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr']
      .map((code) => read(`../lib/locales/${code}.ts`)),
  ];
  for (const src of localeFiles) {
    assert.ok((src.match(/^\s*navPlantingCalendar:/gm) ?? []).length <= 1, 'a second label must not silently override the first');
  }
  for (const code of ['zu', 'st', 'ts', 've']) {
    const { default: dict } = await import(`../lib/locales/${code}.ts`);
    assert.ok(dict.navPlantingCalendar?.trim(), `${code}: calendar navigation cannot be blank`);
    assert.notEqual(dict.navPlantingCalendar, 'Planting Calendar', `${code}: calendar navigation still falls back to English`);
  }
});

test('the calendar opens its own readable context while empty or unreadable storage cannot approve farming advice', async () => {
  // The old page-level catch/comment disappeared when storage readers became
  // shared and an unconfirmed site stopped inheriting a summer guide. Readable
  // context controls and safe reads are the rule, not that old source spelling.
  const page = read('../app/calendar/page.tsx');
  assert.match(page, /const CROP_BASE: \{[^}]*\}\[\] = \[/, 'the calendar must ship its own crop data, not expect it from a prop');
  assert.match(page, /export default function CalendarPage\(\)/, 'the route must not require external component props');
  assert.match(page, /aria-label="Calendar reference context"/);
  assert.match(page, /aria-label="Calendar unavailable"/);
  assert.doesNotMatch(page, /useState<RainPattern>\('summer'\)|plan\.rainPattern\s*\?\?\s*'summer'/,
    'missing site context must not silently select the South African summer guide');
  const tree = ts.createSourceFile('calendar.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const guards: ts.Expression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'allowCalendar' && node.initializer) guards.push(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(tree); assert.equal(guards.length, 1, 'one authority must decide whether reference instructions may appear');
  const allowed = new Function('support', 'rainPattern', `return (${guards[0].getText(tree)});`) as (support: { allowCataloguePlanning: boolean }, pattern: string | null) => boolean;
  assert.equal(allowed({ allowCataloguePlanning: false }, null), false);
  assert.equal(allowed({ allowCataloguePlanning: false }, 'summer'), false);
  assert.equal(allowed({ allowCataloguePlanning: true }, null), false);
  assert.equal(allowed({ allowCataloguePlanning: true }, 'summer'), true);
  const keys = ['window', 'localStorage', 'sessionStorage'] as const;
  const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let mode: 'empty' | 'corrupt' | 'unavailable' = 'empty', writes = 0;
  const storage = { getItem() { if (mode === 'unavailable') throw Error('storage unavailable'); return mode === 'corrupt' ? '{invalid JSON' : null; },
    setItem() { writes++; }, removeItem() { writes++; }, key() { return null; }, length: 0 };
  const session = { getItem() { return null; } };
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: session } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  try {
    const { loadCropPlan } = await import('../lib/crop-plan.ts');
    const { loadPlaces } = await import('../lib/saved-places.ts');
    const { resolvePlanningSupport } = await import('../lib/international/planning-policy.ts');
    for (mode of ['empty', 'corrupt', 'unavailable'] as const) {
      const plan = loadCropPlan(), places = loadPlaces();
      assert.deepEqual(plan.plantings, [], mode); assert.deepEqual(places, [], mode);
      assert.equal(resolvePlanningSupport({ places, siteId: 'calendar-context-not-selected', workspaceReferences: plan.workspaceReferences }).allowCataloguePlanning, false, mode);
    }
    assert.equal(writes, 0, 'opening the calendar must not rewrite unreadable saved data');
  } finally {
    for (const key of keys) { const original = originals.get(key); if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); }
  }
});
