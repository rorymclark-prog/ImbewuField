// a11y-02 / a11y-09 / a11y-08 (invoice part) — the invoice header and its bottom-of-form
// duplicate painted white labels on WhatsApp green (#25D366, ~2:1) and the brand ochre
// (#C07A1E, ~3.5:1), both under the 4.5:1 body-text floor. The header's Share/Print also had
// no icon-only form, so the header overflowed sideways at 360px, and both buttons sat under
// the 44px touch-target floor. Fixed by routing the Share fill through the same themed
// forest-fill/on-forest-text pairing already used elsewhere (var(--color-forest-800) +
// var(--color-canvas), see tests/firstrun-theme-tokens.test.ts), the Print fill through the
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
  // header pair + the bottom-of-form duplicate pair = 2 each.
  assert.equal(shareCount, 2, 'expected the Share button fill in both the header and the bottom duplicate');
  assert.equal(printCount, 2, 'expected the Print button fill in both the header and the bottom duplicate');
});

test('invoice header Share/Print clear the 44px tap-target floor and keep an aria-label once icon-only', () => {
  const header = invoiceSrc.slice(invoiceSrc.indexOf('<MenuButton />'), invoiceSrc.indexOf('<SettingsButton />'));
  assert.match(header, /onClick=\{shareInvoice\}[\s\S]{0,400}min-h-11/, 'Share button should carry min-h-11');
  assert.match(header, /onClick=\{printInvoice\}[\s\S]{0,400}min-h-11/, 'Print button should carry min-h-11');
  assert.match(
    header,
    /onClick=\{printInvoice\}[\s\S]{0,200}aria-label=\{ui\('Print'/,
    'Print button needs an aria-label now that its text label can be hidden below sm',
  );
  assert.match(header, /<Share2[^/]*\/><span className="hidden sm:inline">/, 'Share label should collapse to icon-only below sm');
  assert.match(header, /<Printer[^/]*\/><span className="hidden sm:inline">/, 'Print label should collapse to icon-only below sm');
});

test('ShareListingButton no longer fills its WhatsApp-share pill with white-on-green', () => {
  assert.doesNotMatch(shareButtonSrc, /#25D366/, 'WhatsApp green literal should be gone from ShareListingButton');
  assert.match(shareButtonSrc, /background:\s*'var\(--color-forest-800\)'/);
  assert.match(shareButtonSrc, /color:\s*'var\(--color-canvas\)'/);
});
