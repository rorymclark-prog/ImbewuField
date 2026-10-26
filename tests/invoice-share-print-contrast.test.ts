// a11y-02 / a11y-09 / a11y-08 (invoice part) — the invoice header and its bottom-of-form
// duplicate painted white labels on WhatsApp green (#25D366, ~2:1) and the brand ochre
// (#C07A1E, ~3.5:1), both under the 4.5:1 body-text floor. The header's Share/Print also had
// no icon-only form, so the header overflowed sideways at 360px, and both buttons sat under
// the 44px touch-target floor. Fixed by routing the Share fill through the same themed
// forest-fill/on-forest-text pairing already used elsewhere (var(--color-forest-800) +
// var(--on-forest), see tests/firstrun-theme-tokens.test.ts), the Print fill through the
// CLAUDE.md-prescribed #9A6018 "ochre fill under white type", min-h-11 on both, and a
// `hidden sm:inline` label on the header pair so the icon alone carries it below 640px (with
// aria-label on both, since the Print button's visible text can now disappear).
//
// ShareListingButton (the Exchange board's own WhatsApp share) had the same #25D366/white
// pairing and gets the same forest-fill fix.
//
// This is a flat text scan, not a render test — it can't see contrast, only source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const invoiceSrc = readFileSync(fileURLToPath(new URL('../app/invoice/page.tsx', import.meta.url)), 'utf8');
const shareButtonSrc = readFileSync(
  fileURLToPath(new URL('../components/exchange/ShareListingButton.tsx', import.meta.url)),
  'utf8',
);

test('invoice page no longer fills Share/Print with the failing WhatsApp-green or light-ochre + white pairing', () => {
  assert.doesNotMatch(invoiceSrc, /#25D366/, 'WhatsApp green literal should be gone from the invoice page');
  assert.doesNotMatch(
    invoiceSrc,
    /background:\s*valid\s*\?\s*'#C07A1E'/,
    'the light ochre fill (3.5:1 under white text) should not be reintroduced as a button background',
  );
});

test('invoice header Share/Print use the themed forest fill and the CLAUDE.md ochre-fill value', () => {
  const shareCount = (invoiceSrc.match(/background:\s*valid\s*\?\s*'var\(--color-forest-800\)'/g) ?? []).length;
  const printCount = (invoiceSrc.match(/background:\s*valid\s*\?\s*'#9A6018'/g) ?? []).length;
  // header pair + the bottom-of-form duplicate pair = 2 each, plus (code-05, w14 dark-leftovers)
  // the "Save invoice" button below the form, which used to fill with a literal '#1F4D2B' and now
  // shares the same themed forest-fill token — a third, equally correct match for Share's pattern.
  // w19-15: the header pair was removed (it duplicated the bottom row and squeezed the title in
  // isiZulu on phone), so Share is now the bottom button + Save invoice, and Print the bottom one.
  assert.equal(shareCount, 2, 'expected the Share button fill at the bottom of the form and the Save invoice button');
  assert.equal(printCount, 1, 'expected the Print button fill at the bottom of the form');
});

test('invoice Share/Print (bottom row only, w19-15) clear the 44px tap-target floor', () => {
  assert.equal((invoiceSrc.match(/onClick=\{shareInvoice\}/g) ?? []).length, 1, 'Share lives once, at the bottom');
  assert.equal((invoiceSrc.match(/onClick=\{printInvoice\}/g) ?? []).length, 1, 'Print lives once, at the bottom');
  assert.match(invoiceSrc, /onClick=\{shareInvoice\}[\s\S]{0,400}min-h-11/, 'Share button should carry min-h-11');
  assert.match(invoiceSrc, /onClick=\{printInvoice\}[\s\S]{0,400}min-h-11/, 'Print button should carry min-h-11');
});

test('ShareListingButton no longer fills its WhatsApp-share pill with white-on-green', () => {
  assert.doesNotMatch(shareButtonSrc, /#25D366/, 'WhatsApp green literal should be gone from ShareListingButton');
  assert.match(shareButtonSrc, /background:\s*'var\(--color-forest-800\)'/);
  // Wave 16 (w16-01): white type on a forest-800 fill uses --on-forest-800, which stays light in
  // every theme column where plain --on-forest would not.
  assert.match(shareButtonSrc, /color:\s*'var\(--on-forest-800(?:, var\(--on-forest\))?\)'/);
});
