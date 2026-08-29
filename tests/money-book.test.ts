import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ONE BOOK, THREE TABS — and the guard that keeps it one.
//
// The Gogo Test audit (27 August, 375 x 812, an isiZulu-speaking KZN smallholder farming well on
// a hand-me-down Android) found her money behind separate doors: kilograms at "My Records", rands
// at "Finance", a home tile and a menu row for each, and no screen anywhere that could answer
// "how much did I make this season?". Its recommendation, verbatim: "Merge My Records and Finance
// into Picked · Sold · Spent … one book with three tabs … single route, keep the charts as a view
// inside it rather than a separate destination."
//
// That merge is a page composition, not a lib function, so these are source-shape assertions —
// weaker than a render, and strictly stronger than the nothing that would otherwise notice a
// second money door reappearing. The three things they hold down are the three that would quietly
// undo the merge: /finances growing a page again, a tab going missing, and a second money tile
// arriving on the home screen because someone added a link and nobody counted.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const financesPage = read('../app/finances/page.tsx');
const recordsPage = read('../app/records/page.tsx');
const homePage = read('../app/home/page.tsx');
const tabBar = read('../components/TabBar.tsx');
const navDrawer = read('../components/NavDrawer.tsx');

/* ── 1. The old door still opens, onto the new room ──────────────────────────── */

test('/finances is a redirect onto the merged book, not a second money screen', () => {
  // NOT DELETED. /finances is a tab-bar destination in every build already installed on a phone,
  // it is linked from the Journal and the invoice tool, and it is what a bookmark points at. A
  // 404 there reads as "my books are gone" — the single worst thing this screen can say.
  assert.match(financesPage, /from 'next\/navigation'/, '/finances must still resolve to a page');
  assert.match(financesPage, /redirect\(/, '/finances must redirect rather than render money');
  assert.match(
    financesPage,
    /redirect\(qs \? `\/records\?\$\{qs\}` : '\/records'\)/,
    'the redirect must land on /records and carry any query string with it',
  );

  // A redirect page renders nothing, so nothing may have crept back in beside it.
  for (const gone of ['SalesLedger', 'LogSaleForm', 'FinancialSheet', 'CashflowChart', 'SummaryCards']) {
    assert.ok(!financesPage.includes(gone), `/finances is rendering ${gone} again — the money must live in one place`);
  }
  assert.ok(!/'use client'/.test(financesPage), 'the redirect should run on the server, before the phone paints anything');
});

test('nothing still points a farmer at the retired route', () => {
  // The redirect is a safety net for links this repo does not control (an installed PWA, a
  // bookmark, a printed QR). Anything inside the app should go straight to the book.
  for (const [name, src] of [['the tab bar', tabBar], ['the menu', navDrawer], ['the home screen', homePage]] as const) {
    assert.ok(
      !/href: '\/finances'|href="\/finances"/.test(src),
      `${name} still sends a farmer through the redirect instead of straight to /records`,
    );
  }
});

/* ── 2. The book itself ──────────────────────────────────────────────────────── */

test('the merged book carries all three tabs plus the charts view', () => {
  assert.match(
    recordsPage,
    /const BOOK_TABS = \['picked', 'sold', 'spent', 'charts'\] as const;/,
    'Picked · Sold · Spent — the audit\'s words, in her order — and the charts as a view inside the book',
  );
  for (const key of ['bookTabPicked', 'bookTabSold', 'bookTabSpent', 'bookTabCharts']) {
    assert.ok(recordsPage.includes(`t('${key}')`), `the ${key} tab must take its label from the dictionary`);
  }

  // Each tab has to actually hold something. The failure this catches is a tab that renders an
  // empty branch — a door that opens onto nothing is worse than no door.
  assert.match(recordsPage, /\{\(tab === 'picked' \|\| tab === 'sold'\) && \(/, 'Picked and Sold share one mounted MyRecords');
  assert.match(recordsPage, /\{tab === 'sold' && \(/, 'Sold must render its own money-in surface');
  assert.match(recordsPage, /\{tab === 'spent' && \(/, 'Spent must render its own money-out surface');
  assert.match(recordsPage, /\{tab === 'charts' && \(/, 'the charts must be a view inside the book');

  // The charts are a VIEW, not a destination: every chart the old /finances carried is mounted
  // here, so the merge did not quietly drop one on the way.
  for (const chart of ['CashflowChart', 'FinanceGraphs', 'FarmMetrics', 'ComingUpHarvests', 'HarvestReconciliation', 'FinancialSheet']) {
    assert.ok(recordsPage.includes(`<${chart}`), `the charts view lost ${chart}`);
  }
});

test('every write path that existed on either screen still has a door', () => {
  // THE BUG CLASS THIS REPO FEARS MOST. A UI merge that silently drops a form is future data
  // loss: the farmer keeps tapping, the entry never gets written, and nothing says so. Both
  // mutations that only ever had ONE caller are the sharp edges — addProduction (the harvest
  // form) and addExpense (the cost form, the only door to the till-slip camera).
  const myRecords = read('../components/MyRecords.tsx');
  for (const write of ['addProduction(', 'addSale(', 'uploadPhoto(']) {
    assert.ok(myRecords.includes(write), `MyRecords lost its ${write} path`);
  }
  for (const write of ['addSale(', 'addExpense(', 'updateSale(', 'updateExpense(', 'deleteSale(', 'deleteExpense(']) {
    assert.ok(recordsPage.includes(write), `the book lost its ${write} path`);
  }
  // The sandbox twins, so sample mode can still be edited without touching real books.
  for (const write of ['addSandboxSale', 'addSandboxExpense', 'updateSandboxSale', 'updateSandboxExpense', 'deleteSandboxSale', 'deleteSandboxExpense']) {
    assert.ok(recordsPage.includes(write), `the book lost its ${write} path`);
  }
  // The till slip: the one write path with a camera in front of it.
  assert.ok(recordsPage.includes("'/api/read-slip'"), 'the till-slip scanner must survive on the Spent page');
  // And the harvest form itself is mounted, not merely imported.
  assert.match(recordsPage, /<MyRecords section=\{tab\}/, 'the book must mount the harvest form it did not rewrite');
});

test('the harvest form kept its shape: crop, kilograms, optional photo, save', () => {
  // The audit's "what not to touch" list, first entry: "The harvest form. Crop, kilograms,
  // optional photo, save. Three fields, one optional. This is already the right shape; the
  // problem is finding it, not filling it." Only its front door moved.
  const myRecords = read('../components/MyRecords.tsx');
  const start = myRecords.indexOf('function LogProductionForm');
  assert.ok(start > 0, 'the harvest form is gone');
  const form = myRecords.slice(start, myRecords.indexOf('/* ── Log sale form', start));
  for (const field of ['myRecordsCropLabel', 'myRecordsKgHarvestedLabel', 'myRecordsPhotoLabel', 'myRecordsSaveHarvest']) {
    assert.ok(form.includes(`t('${field}')`), `the harvest form lost ${field}`);
  }
  assert.match(form, /<CropSelect/, 'the crop picker must stay');
  assert.match(form, /capture="environment"/, 'the optional photo must stay a camera, not a file browser');
});

/* ── 3. One money tile, one money row ────────────────────────────────────────── */

test('the home screen offers one money tile, not two', () => {
  const quickStart = homePage.indexOf('const QUICK_ACTIONS = [');
  assert.ok(quickStart > 0, 'the home quick-action grid is gone');
  const grid = homePage.slice(quickStart, homePage.indexOf('];', quickStart));

  const moneyTiles = [...grid.matchAll(/href: '(\/records|\/finances)'/g)].map((m) => m[1]);
  assert.deepEqual(
    moneyTiles,
    ['/records'],
    'the home screen must offer exactly one money door — the split between "Finance" and "My Records" is the whole finding',
  );
  assert.ok(
    !grid.includes('homeQuickFinance'),
    'the Finance tile\'s label is still on the home screen; two names for one book is how the split started',
  );
});

test('the menu and the tab bar each offer one money door, and it is the book', () => {
  const moneyRows = [...navDrawer.matchAll(/href: '(\/records|\/finances)'/g)].map((m) => m[1]);
  assert.deepEqual(moneyRows, ['/records'], 'the menu must offer exactly one money row');

  const tabs = [...tabBar.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    tabs,
    ['/home', '/farmer', '/records', '/account'],
    'the four bottom tabs — the money one is the book now',
  );
  // Its label has to be the SAME word as the tile and the header. Two names for one door is what
  // sent her looking for her sales under "Finance" and her kilograms under "My Records".
  assert.match(tabBar, /key: 'homeQuickMyRecords'/, 'the money tab must reuse the already-translated door name');
});

test('the tab label keys exist in English and were not coined in any other language', () => {
  // The repo rule (see tests/farmer-i18n-gaps.test.ts): new farmer copy goes into the English
  // block alone, and translate()'s fallback serves English until a first-language reviewer
  // supplies the real words. A fluent invented isiZulu label is worse than a true English one.
  const en = read('../lib/i18n.tsx');
  const NEW_KEYS = ['bookTabPicked', 'bookTabSold', 'bookTabSpent', 'bookTabCharts'] as const;
  for (const key of NEW_KEYS) {
    assert.match(en, new RegExp(`^  ${key}: '`, 'm'), `${key} has no English source text`);
  }
  for (const locale of ['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr']) {
    const block = read(`../lib/locales/${locale}.ts`);
    for (const key of NEW_KEYS) {
      assert.ok(!block.includes(`${key}:`), `${key} was coined in ${locale} without a first-language reviewer`);
    }
  }
  // The door name itself was NOT renamed, precisely so this list stays short: it is already
  // translated everywhere, and renaming it would have traded ten real words for one English one.
  for (const locale of ['zu', 'af', 'xh']) {
    assert.ok(read(`../lib/locales/${locale}.ts`).includes('homeQuickMyRecords:'), `${locale} lost the door name`);
  }
});
