import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(p, 'utf8');

test('w18-27: mentor tab bar points at Assessments, and tabsForRole filters through the role gate', () => {
  const src = read('components/TabBar.tsx');
  const mentor = src.match(/mentor: \[([\s\S]*?)\],\n  ngo/)![1];
  assert.doesNotMatch(mentor, /\/network/);
  assert.match(mentor, /href: '\/assessments'[^}]*ClipboardList/);
  assert.match(src, /canSeeNavLink\(navigationRole as UserRole \| null, href\)/);
});

test('w18-27: /network title is neutral', () => {
  assert.doesNotMatch(read('app/network/page.tsx'), /funder portfolio'/);
});

test('w18-33: active tab pill follows the theme', () => {
  const src = read('components/TabBar.tsx');
  assert.doesNotMatch(src, /#e4eee8|#1F4D2B/i);
  assert.match(src, /color-mix\(in srgb, var\(--emerald\) 16%, transparent\)/);
});

test('w18-28: FieldVisitGuide tiles use theme tokens', () => {
  const src = read('components/FieldVisitGuide.tsx');
  assert.doesNotMatch(src, /#[0-9a-f]{6}/i);
  assert.match(src, /color-mix\(in srgb, var\(--\$\{tone\}\) 12%, var\(--bg-1\)\)/);
});

test('w18-29: one tour entry point and a pill-style Portfolio map on /ngo and /funder', () => {
  for (const p of ['app/ngo/page.tsx', 'app/funder/page.tsx']) {
    const src = read(p);
    assert.doesNotMatch(src, /href="\/tour"/);
    assert.doesNotMatch(src, /Portfolio map →/);
    assert.match(src, /<Map size=\{16\}/);
  }
});

test('w18-34: MenuButton tour state has no clipped label and no :root-only colour', () => {
  const src = read('components/MenuButton.tsx');
  assert.doesNotMatch(src, /color-harvest/);
  assert.doesNotMatch(src, /fontSize:lang === 'zu' \? 10/);
  assert.match(src, /var\(--gold-dim\)/);
});

test('w18-30: cohort h2 sits below the h1', () => {
  const src = read('components/funder/CohortDashboard.tsx');
  assert.doesNotMatch(src, /clamp\(25px, 2\.5vw, 32px\)/);
  assert.match(src, /className="t-h2 font-display"/);
});

test('w18-31: staff tab strips share one style and use distinct icons', () => {
  for (const p of ['app/mentor/page.tsx', 'app/ngo/page.tsx', 'app/funder/page.tsx']) {
    const src = read(p);
    const strip = src.slice(src.indexOf('<DashboardTabs>'), src.indexOf('</DashboardTabs>'));
    assert.match(strip, /font-sans text-sm font-semibold/);
    assert.doesNotMatch(strip, /icon: BarChart3/);
    const icons = [...strip.matchAll(/icon: (\w+)/g)].map((m) => m[1]);
    // the simple and full ngo/funder sets list the same destination twice; compare per set
    assert.ok(new Set(icons).size >= 4, `${p} tab icons are not distinct enough`);
  }
});

test('w18-32: /network stats are a phone grid with dividers only at sm+, pill does not wrap', () => {
  const src = read('app/network/page.tsx');
  assert.match(src, /grid grid-cols-2/);
  assert.match(src, /sm:border-r/);
  assert.doesNotMatch(src, /marginRight: 16,\n\s*borderRight/);
  assert.match(src, /font-sans font-semibold whitespace-nowrap shrink-0/);
});
