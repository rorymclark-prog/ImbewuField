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

test('w20-43: partners h1 keeps "community‑farming" together with a non-breaking hyphen', () => {
  assert.ok(read('app/partners/page.tsx').includes('community‑farming programmes'));
});

test('w20-44: login has no sign-in subtitle and its card follows the theme tokens', () => {
  const l = read('app/login/page.tsx');
  assert.doesNotMatch(l, /t\('loginSubtitleSignIn'\)/);
  assert.doesNotMatch(l, /--color-surface|--color-ink|--color-muted-strong/);
  assert.match(l, /background: 'var\(--bg-1\)', border: '1px solid var\(--border\)'/);
});

test('w20-45: print sheet toolbar uses forest tokens and font tokens; north arrow says N once', () => {
  const p = read('app/facilitator/print/page.tsx');
  assert.match(p, /background: 'var\(--color-forest-800\)', color: 'var\(--on-forest-800\)', fontFamily: 'var\(--font-sans\), sans-serif'/);
  assert.doesNotMatch(p, /fontFamily: 'sans-serif'/);
  assert.doesNotMatch(p, /N ↑/);
});

test('w20-46: pitch nav uses Lucide chevrons and the counter sits inside .navbtns', () => {
  const p = read('app/pitch/page.tsx');
  assert.match(p, /<ChevronLeft size=\{16\}/);
  assert.match(p, /<ChevronRight size=\{16\}/);
  assert.doesNotMatch(p, /‹ Back|Next ›/);
  const group = p.slice(p.indexOf('<div className="pitch-ui navbtns">'), p.indexOf('<div className="pitch-ui hints">'));
  assert.match(group, /className="counter" aria-live="polite"/);
});
