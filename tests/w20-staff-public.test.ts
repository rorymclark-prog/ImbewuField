import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w20-37: nav never clips, title and divider only when set and hidden at lg when nav shows', () => {
  const h = read('components/layout/AppHeader.tsx');
  assert.doesNotMatch(h, /overflow-hidden whitespace-nowrap/);
  assert.match(h, /ml-2 shrink-0 whitespace-nowrap/);
  assert.match(h, /\{title && \(/);
  assert.match(h, /lg:hidden/);
  assert.match(read('app/ngo/page.tsx'), /hidden sm:inline-flex lg:hidden/);
});

test('w20-38: network demo badge leaves the header below sm and sits in the body', () => {
  const n = read('app/network/page.tsx');
  assert.match(n, /whitespace-nowrap shrink-0 hidden sm:inline-block/);
  assert.match(n, /sm:hidden flex-shrink-0 px-3 py-1\.5/);
});

test('w20-39: map and list share one status token map; legend uses Lucide Plus/Minus', () => {
  const shared = read('components/network/status-colors.ts');
  assert.match(shared, /thriving: 'var\(--emerald\)'/);
  const m = read('components/network/NetworkMap.tsx');
  assert.match(m, /NETWORK_STATUS_COLOR/);
  assert.doesNotMatch(m, /#1F4D2B|#C0531E/);
  assert.doesNotMatch(m, /\? '−' : '\+'/);
  assert.match(m, /<Minus size=\{14\}/);
  assert.match(m, /<Plus size=\{14\}/);
  assert.match(read('app/network/page.tsx'), /NETWORK_STATUS_COLOR/);
});

test('w20-40: mentor follow-up date is formatted; metric numbers are primary text; names use display font', () => {
  assert.match(read('components/FieldTeams.tsx'), /formatStaffDate\(record\.followUpDate,lang\)/);
  const css = read('components/FieldWork.module.css');
  assert.match(css, /\.metric strong \{[^}]*color:var\(--text-primary\)/);
  assert.doesNotMatch(css, /\.metric strong \{[^}]*var\(--emerald\)/);
  assert.match(css, /\.personHeading strong \{ font-family:var\(--font-display\)/);
});

test('w20-41: vision toggle never wraps and has equal segments; h1 is centred with the column', () => {
  const v = read('app/vision/page.tsx');
  assert.match(v, /grid grid-cols-2 rounded-2xl p-1 gap-1 w-fit mx-auto/);
  assert.match(v, /font-sans font-semibold whitespace-nowrap transition-all/);
  assert.match(v, /<h1 className="font-display text-center"/);
});

test('w20-42: cohort Export CSV and filled chips use the forest fill pair, not emerald', () => {
  const c = read('components/funder/CohortDashboard.tsx');
  assert.match(c, /background: 'var\(--color-forest-800\)', color: 'var\(--on-forest-800\)'/);
  assert.match(c, /background: on \? 'var\(--color-forest-800\)' : 'var\(--bg-2\)'/);
});
