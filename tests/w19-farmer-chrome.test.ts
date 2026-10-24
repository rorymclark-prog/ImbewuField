import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

test('w19-01: farmer pages hide the phone TabBar at desktop', () => {
  for (const p of ['app/journal/page.tsx', 'app/home/page.tsx', 'app/farmer/page.tsx']) {
    assert.match(read(p), /<TabBar hideAtDesktop \/>/, p);
  }
  // Hiding the bar is only safe where the header carries the same four links at lg+: /journal and
  // staff Home get them from AppHeader, /farmer and farmer Home from DesktopPrimaryNav.
  for (const p of ['app/home/page.tsx', 'app/farmer/page.tsx']) {
    const s = read(p);
    const header = s.slice(s.indexOf('<header'), s.indexOf('</header>'));
    assert.match(header, /<DesktopPrimaryNav \/>/, `${p} header has no desktop nav to replace the TabBar`);
  }
  const header = read('components/exchange/ExchangeHeader.tsx');
  assert.match(header, /<AppHeader/);
  assert.equal((header.match(/<h1/g) ?? []).length, 1);
});

test('w19-02: farmer error is a banner outside the header; LangSwitcher is compact', () => {
  const s = read('app/farmer/page.tsx');
  const headerEnd = s.indexOf('</header>');
  assert.ok(s.indexOf('{error && (\n          <div role="alert"') > headerEnd);
  assert.doesNotMatch(s.slice(0, headerEnd), /\{error && \(\n\s+<span/);
  assert.match(s, /hidden 2xl:block font-sans whitespace-nowrap[^>]*>\{t\('tagline'\)\}/);
  // The header role switcher overflowed the bar and clipped Settings; it lives in the drawer.
  assert.doesNotMatch(s.slice(0, headerEnd), /<RoleSwitcher/);
  const lang = read('components/LangSwitcher.tsx');
  assert.match(lang, /minHeight: 40/);
  assert.doesNotMatch(lang, /fontSize: 20/);
});

test('w19-03: controls and chips use sans', () => {
  assert.match(read('components/BackButton.tsx'), /text-xs font-sans/);
  assert.match(read('components/SettingsButton.tsx'), /text-xs font-sans/);
  const acct = read('app/account/page.tsx');
  assert.match(acct, /text-sm font-sans font-semibold"\n\s+style=\{\{ background: 'var\(--color-forest-800\)'/);
  assert.match(read('components/DataPanel.tsx'), /text-xs font-sans leading-relaxed/);
});

test('w19-04: offline cards keep space-y spacing; disabled buttons look disabled', () => {
  const s = read('app/offline/page.tsx');
  assert.doesNotMatch(s, /marginTop:0,background/);
  assert.doesNotMatch(s, /\.\.\.card,marginTop:0/);
  assert.match(s, /button:disabled\{opacity:\.5;cursor:not-allowed\}/);
});

test('w19-05/06: inline art is exempt from the tile minimum; meta row is a two-column grid', () => {
  assert.match(read('app/globals.css'), /\.produce-art\.produce-art--inline \{ min-width:0; min-height:0; \}/);
  for (const p of ['components/exchange/ExchangeLede.tsx', 'components/exchange/ListingCard.tsx', 'components/journal/FieldJournal.tsx']) {
    assert.match(read(p), /produce-art produce-art--inline/, p);
  }
  assert.doesNotMatch(read('components/exchange/ExchangeLede.tsx'), /i > 0 && ' · '/);
  // w20-01 widened the identity column to minmax(min-content, 1fr) so the kind badge cannot run under
  // the status cell; still two columns with status fixed on the right.
  assert.match(read('components/exchange/ListingCard.tsx'), /gridTemplateColumns: '(?:minmax\(min-content, 1fr\)|1fr) auto'/);
});

test('w19-07/08: account chip follows the theme; journal rail is narrow', () => {
  const acct = read('app/account/page.tsx');
  assert.doesNotMatch(acct, /rgba\(31,77,43,0\.08\)', border: '1px solid rgba\(31,77,43,0\.15\)', color: 'var\(--color-forest-800\)' \}\}>/);
  assert.match(acct, /w-full flex lg:hidden/);
  assert.match(read('app/globals.css'), /journal-narrow-sidebar > div \{ grid-template-columns: 320px/);
  assert.match(read('app/journal/page.tsx'), /title=""/);
});

test('w19-09: staff Home uses AppHeader and drops the duplicate dashboard link', () => {
  const s = read('app/home/page.tsx');
  assert.match(s, /\{staffRole && \(\s+<AppHeader/);
  assert.match(s, /\{!staffRole && <header/);
  assert.doesNotMatch(s, /href: `\/\$\{staffRole\}`/);
  assert.match(s, /href: '\/assessments'[^\n]*desc:/);
});
