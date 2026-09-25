import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools on /exchange (lib/app-level.ts), plus the two standing fixes on the same
// track: the 21x-repeated "no way to contact" notice, and the exchange feature's own hardcoded
// hex palette. Source-text guards, in the style of tests/home-next-step-links.test.ts and
// tests/app-level.test.ts, because these are stateful client components rather than pure
// functions of exported data.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const PAGE = source('../app/exchange/page.tsx');
const HEADER = source('../components/exchange/ExchangeHeader.tsx');
const BOARD = source('../components/exchange/ExchangeBoard.tsx');
const CARD = source('../components/exchange/ListingCard.tsx');
const FORM = source('../components/exchange/NewListingForm.tsx');
const THEME = source('../components/exchange/theme.ts');

test('the header hides the "preview · demonstration records" badge in Simple', () => {
  assert.match(HEADER, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(HEADER, /const simple = useAppLevel\(\) === 'simple';/);
  const idx = HEADER.indexOf('preview · demonstration records');
  assert.ok(idx > 0, 'the badge copy moved; recheck this guard');
  const around = HEADER.slice(idx, idx + 250);
  assert.match(around, /\{!simple && \(/, 'the badge must be gated on !simple');
});

test('the board hides its filter row and distance settings in Simple', () => {
  assert.match(BOARD, /const simple = useAppLevel\(\) === 'simple';/);

  const searchAt = BOARD.indexOf("aria-label={tx('Search listings', 'Funa izikhangiso')}");
  assert.ok(searchAt > 0, 'the search input moved; recheck this guard');
  assert.match(BOARD.slice(searchAt - 700, searchAt), /\{!simple && \(/, 'the search box must be gated on !simple');

  const categoryAt = BOARD.indexOf("ChipRow label={tx('Category', 'Umkhakha')}");
  assert.ok(categoryAt > 0, 'the category chip row moved; recheck this guard');
  assert.match(BOARD.slice(categoryAt - 100, categoryAt), /\{!simple && \(/, 'category chips must be gated on !simple');

  const sortAt = BOARD.indexOf("aria-label={tx('Sort listings', 'Hlela izikhangiso')}");
  assert.ok(sortAt > 0, 'the sort control moved; recheck this guard');
  assert.match(BOARD.slice(sortAt - 500, sortAt), /\{!simple && \(/, 'the sort + vantage point panel must be gated on !simple');

  // Crop chips and the offer/want toggle are not filters this track was asked to hide, so they
  // must still render unconditionally in both levels.
  assert.doesNotMatch(
    BOARD.slice(BOARD.indexOf('Crop chips'), BOARD.indexOf('Crop chips') + 120),
    /!simple/,
  );
});

test('Post a listing stays reachable in Simple even with the search box gone', () => {
  const postAt = BOARD.indexOf("tx('Post', 'Faka')");
  assert.ok(postAt > 0);
  assert.doesNotMatch(BOARD.slice(postAt - 500, postAt), /\{!simple &&[\s\S]*$/,
    'the Post button must not end up nested inside the hidden search block');
});

test('the repeated per-card "no way to contact" notice is now said once for the whole list', () => {
  assert.doesNotMatch(CARD, /No way to contact this farmer from the app yet/,
    'ListingCard must not repeat the contact explanation on every non-mine card');
  assert.match(BOARD, /rows\.some\(\(row\) => !isLocalListing\(row\.listing\)\)/,
    'the board should show one contact notice only when the visible list actually has other farmers\' listings');
  assert.match(BOARD, /No way to contact another farmer from the app yet/);
});

test('Share remains the real contact alternative on every non-mine card', () => {
  const idx = CARD.indexOf('NO CONTACT BUTTON, DELIBERATELY');
  assert.ok(idx > 0);
  assert.match(CARD.slice(idx, idx + 700), /<ShareListingButton listing=\{listing\} \/>/);
});

test('Simple simplifies the post-a-listing form to crop, quantity and price/free/swap', () => {
  assert.match(FORM, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(FORM, /const simple = useAppLevel\(\) === 'simple';/);
  assert.match(FORM, /const \[showMore, setShowMore\] = useState\(false\);/);
  assert.match(FORM, /const priceModes = \(simple \? \['zar', 'swap', 'free'\] : Object\.keys\(PRICE_MODE_LABEL\)\) as PriceMode\[\];/,
    "Simple's price choices must drop \"Make an offer\", leaving price / free / swap");

  const simpleStart = FORM.indexOf('{simple ? (');
  assert.ok(simpleStart > 0, 'the Simple layout branch moved; recheck this guard');
  const simpleLayout = FORM.slice(simpleStart, FORM.indexOf(') : (', simpleStart));
  for (const field of ['cropSection', 'quantitySection', 'priceSection']) {
    assert.match(simpleLayout, new RegExp(`\\{${field}\\}`), `Simple must show ${field} up front`);
  }
  for (const field of ['kindSection', 'categorySection', 'titleSection', 'descriptionSection', 'monthSection', 'nameSection', 'townSection', 'shareAreaSection']) {
    assert.match(simpleLayout, new RegExp(`showMore &&[\\s\\S]*\\{${field}\\}[\\s\\S]*\\)\\}`),
      `${field} must sit behind "More options" in Simple`);
  }
});

test('All tools keeps every post-a-listing field exactly as before', () => {
  const allToolsLayout = FORM.slice(FORM.lastIndexOf(') : (\n        <>'), FORM.indexOf('<div\n        className="flex items-start gap-2 rounded-xl"'));
  for (const field of ['kindSection', 'categorySection', 'cropSection', 'titleSection', 'descriptionSection', 'quantitySection', 'priceSection', 'monthSection', 'nameSection', 'townSection', 'shareAreaSection']) {
    assert.match(allToolsLayout, new RegExp(`\\{${field}\\}`), `All tools must still render ${field} unconditionally`);
  }
});

test('the exchange feature paints with theme tokens, not literal hex, so it follows dark mode', () => {
  assert.doesNotMatch(PAGE, /#E4DCC6|#FFFEFA|#E2D8C4|#20190F/,
    'app/exchange/page.tsx must use the shared EX tokens instead of repeating literal hex');
  assert.match(PAGE, /import \{ EX \} from '@\/components\/exchange\/theme';/);

  assert.doesNotMatch(HEADER, /#FFFEFA|#E2D8C4|#5C5040|#20190F/,
    'ExchangeHeader must use EX tokens instead of its own literal hex');

  const expectedTokens = [
    ['bg', 'var(--color-canvas)'], ['card', 'var(--color-surface)'], ['border', 'var(--color-border)'],
    ['ink', 'var(--color-ink)'], ['muted', 'var(--color-muted-strong)'], ['faint', 'var(--color-muted)'],
    ['green', 'var(--color-forest-800)'], ['blue', 'var(--color-water)'],
  ];
  for (const [key, token] of expectedTokens) {
    assert.match(THEME, new RegExp(`${key}: '${token.replace(/[()]/g, '\\$&')}'`),
      `EX.${key} must resolve to the same theme token /prices and /records use`);
  }
});

test('ochre never paints text directly — amberText carries the ochre-safe reading colour', () => {
  assert.match(THEME, /amberText: 'var\(--color-harvest\)'/);
  assert.doesNotMatch(CARD, /color: EX\.amber[,}]/, 'ListingCard text must use EX.amberText, not the EX.amber fill');
  assert.match(CARD, /color: EX\.amberText/);
});
