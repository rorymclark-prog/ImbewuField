import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('w18-43: page titles use the shared t-h1 class', () => {
  for (const p of ['app/journal/page.tsx', 'app/offline/page.tsx', 'app/calendar/page.tsx', 'app/prices/page.tsx', 'app/updates/page.tsx', 'components/exchange/ExchangeHeader.tsx']) {
    assert.match(read(p), /<h1 className="t-h1[ "]/, `${p} h1 must use t-h1`);
  }
  assert.match(read('app/updates/page.tsx'), /<h2 className="t-h2"/);
});

test('w18-42: /offline has t-h2 section headings and a chevron disclosure', () => {
  const s = read('app/offline/page.tsx');
  assert.doesNotMatch(s, /<h2>/);
  assert.match(s, /ChevronDown/);
  assert.match(s, /details\[open\]>\.offline-summary \.offline-chevron/);
  assert.match(read('lib/i18n.tsx'), /offlineTitle: 'Saved on this device'/);
});

test('w18-44: tight tracking only on h1/h2', () => {
  const css = read('app/globals.css');
  assert.match(css, /h1, h2, h3, h4, h5, h6 \{[^}]*letter-spacing: 0;/);
  assert.match(css, /\nh1, h2 \{\s*letter-spacing: -0\.02em;/);
});

test('w18-45: Home quick tiles share one themed Lucide chip and leave no orphan', () => {
  const s = read('app/home/page.tsx');
  assert.doesNotMatch(s, /#5A7A3A/);
  assert.doesNotMatch(s, /home-icons\//);
  assert.match(s, /grid-cols-2 gap-3\$\{simple/);
  assert.match(s, /last-child:nth-child\(odd\)/);
});

test('w18-46: staff hero has no repeated overline and Home links real pages', () => {
  assert.match(read('components/home/HomeHeroCard.tsx'), /\{firstName && <Overline>/);
  const s = read('app/home/page.tsx');
  assert.match(s, /STAFF_LINKS/);
  assert.match(s, /'\/assessments'[\s\S]*'\/reports'[\s\S]*'\/network'[\s\S]*canSeeNavLink\(role, href\)/);
});

test('w18-47: exchange card meta, segment fill and rand format', () => {
  const card = read('components/exchange/ListingCard.tsx');
  assert.doesNotMatch(card, /flex: 1, minWidth: 8/);
  assert.match(card, /produceLabel\(listing\.cropKey/);
  const board = read('components/exchange/ExchangeBoard.tsx');
  assert.match(board, /kind === value \? 'var\(--color-forest-800\)'/);
  assert.match(board, /md:flex-none/);
  assert.doesNotMatch(board, /EX\.fillInk/);
  assert.match(read('lib/exchange.ts'), /randCentsLabel/);
});
