import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// THE REPORT HAD NO DOOR.
//
// The site report is the thing a farmer walks away with, and the only way to reach it was to open
// the map, scroll a panel strip, find "Reports", and know that was where it lived. Rory: "i like
// [it] appears until there is one and then you can choose from various site reports."
//
// So: an entry in the drawer that lands on the list, and a list that says something when it is
// empty. The five empty-state strings had been sitting translated in all eleven languages and
// rendered in none of them — arriving at an empty Reports tab looked like a bug, which is exactly
// what a new farmer following a fresh nav entry would have hit first.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the drawer has a way into the site report', () => {
  const nav = read('../components/NavDrawer.tsx');
  assert.match(nav, /href: '\/farmer\?panel=Reports'/, 'the entry must land on the report list, not the map');
  assert.match(nav, /label: t\('siteReportOverline'\)/,
    'the label must come from the translations — this drawer is read in eleven languages');
  // Reusing an existing key rather than minting one is the whole reason this ships translated:
  // `siteReportOverline` already reads "Site report" in every block of lib/i18n.tsx.
  const i18n = read('../lib/i18n.tsx');
  const translated = i18n.match(/^\s*siteReportOverline:/gm) ?? [];
  assert.ok(translated.length >= 11, `siteReportOverline is missing from a language block (${translated.length})`);
  // Icon has to be one that is already imported, or the drawer does not compile.
  assert.match(nav, /Icon: FileText, label: t\('siteReportOverline'\)/);
  assert.match(nav, /import \{[\s\S]*?\bFileText\b[\s\S]*?\} from 'lucide-react'/,
    'Lucide only — no emoji as UI icons');
});

test('the panel deep link the entry uses is a real one', () => {
  // `panel=Reports` is read by app/farmer/page.tsx and handed to DataPanel as forcedTab; if either
  // half moves, the drawer entry silently lands on the Overview tab instead.
  const page = read('../app/farmer/page.tsx');
  assert.match(page, /searchParams\.get\('panel'\)/, 'the farmer page no longer reads ?panel=');
  assert.match(page, /forcedTab=\{forcedTab\}/);
  const panel = read('../components/DataPanel.tsx');
  assert.match(panel, /const TABS = \[[^\]]*'Reports'/, "the 'Reports' tab was renamed or removed");
  // And it must stay in the visible strip — the only filter today drops 'Farm'.
  assert.match(panel, /VISIBLE_TABS = TABS\.filter\(\(t\) => t !== 'Farm'\)/);
});

test('an empty report list explains itself instead of looking broken', () => {
  // The list MOVED on 12 August, out of DataPanel and into its own component, so that the drawer
  // entry could open it with no site selected — see tests/report-picker.test.ts. This test follows
  // it rather than being deleted: what it protects is that the five translated strings reach a
  // farmer's screen, and that is true wherever the markup lives.
  const list = read('../components/report/SavedReportsList.tsx');
  assert.match(list, /reports\.length === 0 && \(/, 'there is no empty state again');
  for (const key of [
    'noSavedReportsMessage',
    'noSavedReportsGenerateLink',
    'noSavedReportsSaveTip',
    'noSavedReportsSaveLink',
    'noSavedReportsSuffix',
  ]) {
    assert.match(list, new RegExp(`t\\('${key}'\\)`), `${key} is translated in eleven languages and shown in none`);
  }
  // The one actionable phrase has to actually generate a report, not just describe one.
  const start = list.indexOf('reports.length === 0');
  const block = list.slice(start, list.indexOf('reports.length > 0', start));
  assert.match(block, /onClick=\{\(\) => onOpenReport\?\.\(\)\}/, 'the "Generate" phrase does nothing');
  // And the saved list still renders when there IS one — the two states are exclusive.
  assert.match(list, /reports\.length > 0 && \(/);
  // DataPanel must still be the thing that mounts it, in both of its places.
  assert.match(read('../components/DataPanel.tsx'), /<SavedReportsList/);
});
