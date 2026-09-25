import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Records — Simple mode (lib/app-level.ts). The Gogo Test audit called the Charts tab
// "challenging" and "intimidating" for a simple farmer: about 2,770 words, 153 tappable things,
// roughly 20 phone screens on the sample farm. This is a page composition, like the merge
// tests/money-book.test.ts guards, so these are source-shape assertions rather than a render:
// weaker than mounting the component, strictly stronger than nothing noticing Charts creeping
// back into Simple or the book losing a write path on the way.

const RECORDS_SOURCE = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');

test('Records reads the Simple / All tools level and Charts stays All tools only', () => {
  assert.match(RECORDS_SOURCE, /const level = useAppLevel\(\);/, 'Records must read the Simple / All tools level');
  assert.match(RECORDS_SOURCE, /const simple = level === 'simple';/);

  // BOOK_TABS itself — the constant tests/money-book.test.ts pins — must stay all four; only the
  // rendered tab list is filtered, so All tools keeps every tab exactly as today.
  assert.match(RECORDS_SOURCE, /const BOOK_TABS = \['picked', 'sold', 'spent', 'charts'\] as const;/);
  const tabsBlock = RECORDS_SOURCE.slice(
    RECORDS_SOURCE.indexOf('const bookTabs:'),
    RECORDS_SOURCE.indexOf('return (', RECORDS_SOURCE.indexOf('const bookTabs:')),
  );
  assert.match(tabsBlock, /\.\.\.\(simple \? \[\] : \[\{ id: 'charts'/, 'Simple must drop the charts tab from the rendered tab list');

  // A Simple visitor landing on ?tab=charts (or switching to Simple while already there) is
  // bounced to Picked, never shown Charts.
  assert.match(RECORDS_SOURCE, /if \(simple && tab === 'charts'\) setTab\('picked'\);/);
});

test('Simple gets one plain-language money card, computed from the same series Charts uses', () => {
  const cardStart = RECORDS_SOURCE.indexOf('function SimpleMoneySummary');
  assert.ok(cardStart > 0, 'SimpleMoneySummary is missing');
  const card = RECORDS_SOURCE.slice(cardStart, RECORDS_SOURCE.indexOf('\n/* ── Recent sales', cardStart));

  // No card at all when nothing is recorded.
  assert.match(card, /if \(!series\.hasRecords\) return null;/);

  // The headline, the money-in/out line and the honesty note — reading straight off the series,
  // never a second sum of sales/expenses.
  assert.match(card, /series\.totalNetZar/);
  assert.match(card, /You kept \$\{fmtZAR\(net\)\}/);
  assert.match(card, /You spent \$\{fmtZAR\(Math\.abs\(net\)\)\} more than you made/);
  assert.match(card, /Money in \$\{fmtZAR\(series\.totalInZar\)\}/);
  assert.match(card, /Money out \$\{fmtZAR\(series\.totalOutZar\)\}/);
  assert.match(card, /Only what you have written down\./);
  assert.match(card, /font-display font-bold/, 'the headline must use the display font');

  // The page must build that series with buildFinanceSeries — the exact function
  // lib/finance-series.ts documents as the one place moneyInZar/moneyOutZar are computed, the same
  // one CashflowChart calls — and over a 12-month window, matching Charts' default.
  assert.match(RECORDS_SOURCE, /import \{ buildFinanceSeries, type FinanceSeries \} from '@\/lib\/finance-series';/);
  const seriesBlock = RECORDS_SOURCE.slice(
    RECORDS_SOURCE.indexOf('const simpleMoneySeries'),
    RECORDS_SOURCE.indexOf(';', RECORDS_SOURCE.indexOf('const simpleMoneySeries')) + 200,
  );
  assert.match(seriesBlock, /buildFinanceSeries\(production, sales, expenses, invoices, now, 12\)/);

  // And it only renders for Simple visitors, beside (not instead of) the totals tiles every level keeps.
  assert.match(RECORDS_SOURCE, /\{simple && !dataLoading && <SimpleMoneySummary series=\{simpleMoneySeries\} lang=\{lang\} \/>\}/);
});

test('Simple drops the header Back button; All tools keeps it', () => {
  assert.match(RECORDS_SOURCE, /<MenuButton \/>\s*\{\/\*[^*]*\*\/\}\s*\{!simple && <BackButton fallback="\/home" \/>\}/,
    'Records is a tab-bar root screen — Simple must render no Back button, the same rule Simple Home follows');
});

test('every level keeps the totals tiles, the harvest/sale/cost forms and the Invoice chip', () => {
  // None of these may sit behind `simple &&` / `!simple &&` — they are the acceptance floor both
  // levels must keep.
  assert.match(RECORDS_SOURCE, /<SummaryCards\n/, 'the three totals tiles must render unconditionally');
  assert.match(RECORDS_SOURCE, /\{\(tab === 'picked' \|\| tab === 'sold'\) && \(/, 'the harvest/sale forms stay behind their tab, not behind the level');
  assert.match(RECORDS_SOURCE, /\{tab === 'spent' && \(/, 'the cost form stays behind its tab, not behind the level');
  assert.match(RECORDS_SOURCE, /href="\/invoice"/, 'the Invoice chip must stay in the header for every level');
});
