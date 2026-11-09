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
import ts from 'typescript';

const invoiceSrc = readFileSync(fileURLToPath(new URL('../app/invoice/page.tsx', import.meta.url)), 'utf8');
const shareButtonSrc = readFileSync(
  fileURLToPath(new URL('../components/exchange/ShareListingButton.tsx', import.meta.url)),
  'utf8',
);

const invoiceAst = ts.createSourceFile('invoice.tsx', invoiceSrc, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actionButton(action: string): string {
  const matches: ts.JsxOpeningElement[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(invoiceAst) === 'button') {
      const click = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(invoiceAst) === 'onClick');
      const disabled = node.attributes.properties.find((attribute): attribute is ts.JsxAttribute => ts.isJsxAttribute(attribute) && attribute.name.getText(invoiceAst) === 'disabled');
      // The underlined Retry action also invokes persist. Its text-only style
      // is not one of the validity-gated filled primary action buttons.
      const primary = disabled?.initializer && ts.isJsxExpression(disabled.initializer) && disabled.initializer.expression?.getText(invoiceAst) === '!valid';
      if (primary && click?.initializer && ts.isJsxExpression(click.initializer) && click.initializer.expression) {
        let ownsAction = false;
        const handler = click.initializer.expression;
        const find = (part: ts.Node) => {
          if (ts.isCallExpression(part) && ts.isIdentifier(part.expression) && part.expression.text === action) ownsAction = true;
          ts.forEachChild(part, find);
        };
        if (ts.isIdentifier(handler)) ownsAction = handler.text === action;
        else find(handler);
        if (ownsAction) matches.push(node);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(invoiceAst); assert.equal(matches.length, 1, `${action} should have one validity-gated primary action button`);
  return matches[0].getText(invoiceAst);
}

test('invoice page no longer fills Share/Print with the failing WhatsApp-green or light-ochre + white pairing', () => {
  assert.doesNotMatch(invoiceSrc, /#25D366/, 'WhatsApp green literal should be gone from the invoice page');
  assert.doesNotMatch(
    invoiceSrc,
    /background:\s*valid\s*\?\s*'#C07A1E'/,
    'the light ochre fill (3.5:1 under white text) should not be reintroduced as a button background',
  );
});

test('invoice Save, Download and Share use the themed forest pairing while Print keeps the prescribed ochre pairing', () => {
  // Download is a separate user choice because native Share may offer no file
  // download. Check each real action, not a total that rejects a new safe button.
  for (const action of ['persist', 'deliverInvoicePdf', 'shareInvoice']) {
    const button = actionButton(action);
    assert.match(button, /background:\s*valid\s*\?\s*'var\(--color-forest-800\)'/, `${action} lost the themed forest fill`);
    assert.match(button, /color:\s*valid\s*\?\s*'var\(--on-forest-800\)'/, `${action} lost the matching on-forest text`);
  }
  const print = actionButton('printInvoice');
  assert.match(print, /background:\s*valid\s*\?\s*'#9A6018'/); assert.match(print, /color:\s*valid\s*\?\s*'#fff'/);
});

test('invoice Share/Print (bottom row only, w19-15) clear the 44px tap-target floor', () => {
  assert.equal((invoiceSrc.match(/onClick=\{shareInvoice\}/g) ?? []).length, 1, 'Share lives once, at the bottom');
  assert.equal((invoiceSrc.match(/onClick=\{printInvoice\}/g) ?? []).length, 1, 'Print lives once, at the bottom');
  assert.match(invoiceSrc, /onClick=\{shareInvoice\}[\s\S]{0,400}min-h-11/, 'Share button should carry min-h-11');
  assert.match(invoiceSrc, /onClick=\{printInvoice\}[\s\S]{0,400}min-h-11/, 'Print button should carry min-h-11');
  const download = actionButton('deliverInvoicePdf');
  assert.match(download, /deliverInvoicePdf\(true\)/, 'Download must use the explicit shared delivery mode');
  assert.match(download, /min-h-11/, 'Download must also clear the touch-target floor');
});

test('ShareListingButton no longer fills its WhatsApp-share pill with white-on-green', () => {
  assert.doesNotMatch(shareButtonSrc, /#25D366/, 'WhatsApp green literal should be gone from ShareListingButton');
  assert.match(shareButtonSrc, /background:\s*'var\(--color-forest-800\)'/);
  // Wave 16 (w16-01): white type on a forest-800 fill uses --on-forest-800, which stays light in
  // every theme column where plain --on-forest would not.
  assert.match(shareButtonSrc, /color:\s*'var\(--on-forest-800(?:, var\(--on-forest\))?\)'/);
});
