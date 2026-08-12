import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// "THE REPORT PICKER IN MENU DOESNT WORK" — Rory, 12 August.
//
// It didn't. One line in DataPanel decided it:
//
//     if (!data && !loading) return <EmptyState />;
//
// That returns the map's "tap a spot" empty state for EVERY tab, whatever was asked for. So the
// Site report entry added to the drawer the day before — which deep-links to ?panel=Reports —
// landed on the map empty state for any farmer who had not analysed a site yet. Which is exactly
// the farmer a menu entry exists for.
//
// The Farm tab already had an escape hatch immediately above that line, carrying a comment
// describing this same bug in the same words. Nobody noticed that saved reports have the same
// property: they live in the farmer's own storage, keyed to their account, not to a pin.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PANEL = '../components/DataPanel.tsx';
const LIST = '../components/report/SavedReportsList.tsx';

test('a deep link to Reports survives having no site yet', () => {
  const panel = source(PANEL);
  assert.match(panel, /const wantsSavedReports = \(tab: Tab, forcedTab\?: string \| null\)/,
    'the Reports escape hatch is gone');
  assert.match(panel, /tab === 'Reports' \|\| forcedTab === 'Reports'/,
    'the hatch must fire on the deep link as well as the tab — the link is the whole point');

  // ORDER IS THE BUG. The hatch is worthless below the empty-state return.
  const hatch = panel.indexOf('wantsSavedReports(tab, forcedTab)');
  const empty = panel.indexOf('if (!data && !loading) return <EmptyState />;');
  assert.ok(hatch > 0 && empty > 0, 'expected both the hatch and the empty-state return');
  assert.ok(hatch < empty, 'the Reports hatch must run BEFORE the map empty state, not after it');

  // And the Farm hatch it was modelled on must still be there — same class, same fix.
  assert.match(panel, /wantsFarmRecords\(tab, forcedTab\)/);
});

test('the saved list has one implementation, used in both places', () => {
  // It went unrendered for months because it lived in exactly one hard-to-reach spot. Two copies
  // would be the same failure with extra steps.
  const panel = stripComments(source(PANEL));
  const uses = [...panel.matchAll(/<SavedReportsList/g)];
  assert.equal(uses.length, 2, 'expected the list in the Reports tab AND in the no-site panel');
  assert.match(panel, /import SavedReportsList from '\.\/report\/SavedReportsList'/);
  // The old inline copy must be gone, or the two will drift.
  assert.doesNotMatch(panel, /t\('savedReportsHeader'\)[\s\S]{0,400}savedReports\.map/,
    'an inline copy of the saved list is still in DataPanel');
});

test('generating is offered only when there is a site to generate from', () => {
  const list = source(LIST);
  assert.match(list, /canGenerate && \(/, 'the Generate button must be hidden without a site');
  // And the empty-state sentence must not name a button that is not on screen.
  const block = list.slice(list.indexOf('reports.length === 0'), list.indexOf('reports.length > 0'));
  assert.match(block, /canGenerate \? \(/, 'the no-site copy must differ from the has-site copy');
  assert.match(block, /t\('heroSub'\)/, 'with no site, say the thing they can actually do');
});

test('every translated string on these screens actually exists', () => {
  // THE TRAP I FELL INTO WHILE FIXING THIS. `t('reportsNeedSiteHint')` typechecked cleanly and
  // would have rendered the literal text "reportsNeedSiteHint" to a farmer, because t() takes any
  // string. That is the same failure as the untranslated empty state this whole change exists to
  // fix, so it gets a test rather than a promise to be careful.
  const i18n = source('../lib/i18n.tsx');
  const keys = new Set<string>();
  for (const file of [PANEL, LIST]) {
    for (const m of stripComments(source(file)).matchAll(/\bt\('([A-Za-z0-9_]+)'\)/g)) keys.add(m[1]);
  }
  assert.ok(keys.size > 5, 'expected these screens to use translated copy');
  const missing = [...keys].filter((k) => !new RegExp(`^\\s*${k}:`, 'm').test(i18n));
  assert.deepEqual(missing, [], `keys used but never translated: ${missing.join(', ')}`);
});

test('the drawer entry and the panel it opens still agree', () => {
  // Two halves, two files. The entry is useless if the panel name changes under it.
  const nav = source('../components/NavDrawer.tsx');
  assert.match(nav, /href: '\/farmer\?panel=Reports'/);
  const page = source('../app/farmer/page.tsx');
  assert.match(page, /VALID_PANELS = \[[^\]]*'Reports'/, "'Reports' must stay a valid panel name");
  assert.match(page, /searchParams\.get\('panel'\)/);
});
