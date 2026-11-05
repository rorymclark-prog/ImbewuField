// Every farmer in the country invoiced their buyers from one particular smallholding in the
// Tugela valley.
//
// `app/invoice/page.tsx` printed the literal string 'Tugela Valley smallholding' under the seller's
// name — on the screen at one line, and again in the generated PDF at another. The seller's NAME
// and PHONE were never hardcoded; they have read the signed-in profile since the file's first
// commit. So the document looked personalised, carried the right person's name and number, and
// then named somebody else's farm underneath it. That is the failure mode this repo keeps hitting:
// a plausible value standing in for a missing one, indistinguishable in the output from a real one.
//
// It goes out to buyers. An invoice is the one artefact here that a third party keeps.
//
// The fix is a real `farm_name` on the profile, editable in Account, and NO fallback — an unset
// farm prints nothing on either path. A blank line is honest; a borrowed one is not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
const INVOICE = src('../app/invoice/page.tsx');

/**
 * The file with its comments removed.
 *
 * The rule is that no place name reaches a farmer's document — not that the codebase may never
 * mention one. The comment explaining this very bug names the string it removed, as house style
 * requires, and the first version of the test below failed on that comment. A check that forbids
 * its own documentation gets deleted rather than obeyed.
 */
const INVOICE_CODE = INVOICE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const ACCOUNT = src('../app/account/page.tsx');
const TYPES = src('../lib/db/types.ts');

test('no real place name is hardcoded into the invoice', () => {
  // Named literally, because this is the string that shipped. A generic "no capitalised phrase"
  // rule would be unmaintainable; the specific regression is what needs a lock on it.
  assert.ok(!/Tugela/i.test(INVOICE_CODE), 'app/invoice/page.tsx still renders the hardcoded farm name');
});

test('the seller block on screen and in the PDF read the same profile field', () => {
  // Two render paths. The bug lived in both, and a fix that repaired only the screen would leave
  // the wrong farm on the document the buyer actually keeps.
  //
  // The original version of this test counted `sellerFarm` references, because at the time the
  // screen and the PDF each drew the letterhead themselves. They no longer do: both now render
  // one `InvoiceDocument`, and the guarantee is stronger for it — there is a single place where
  // the farm name enters the document, so the two paths cannot disagree. What is checked here is
  // that this remains true, and `tests/invoice-document.test.ts` checks that both renderers
  // actually read every field of that document.
  assert.ok(
    /const sellerFarm = profile\?\.farm_name/.test(INVOICE),
    'sellerFarm must come from the signed-in profile, not from a constant',
  );
  // The shared input now annotates DEMO documents so convincing practice bank
  // details cannot be mistaken for a real invoice. Real invoices still receive
  // exactly the saved farm name; this is no permission to invent a fallback.
  const ast = ts.createSourceFile('invoice.tsx', INVOICE, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'buildInvoiceDocument') calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(ast); assert.equal(calls.length, 1, 'screen, print and PDF must still share one document construction authority');
  const input = calls[0].arguments[0]; assert.ok(ts.isObjectLiteralExpression(input));
  const seller = input.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(ast) === 'seller');
  assert.ok(seller && ts.isObjectLiteralExpression(seller.initializer));
  const farm = seller.initializer.properties.find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && property.name.getText(ast) === 'farm');
  assert.ok(farm, 'the profile farm must enter the shared document input');
  const actualFarm = new Function('demoInvoice', 'sellerFarm', 'sellerName', `return (${farm.initializer.getText(ast)});`);
  assert.equal(actualFarm(false, 'Own farm', 'Own seller'), 'Own farm');
  assert.equal(actualFarm(false, '', 'Own seller'), '', 'a real unset farm still prints no invented name');
  assert.match(actualFarm(true, 'Practice farm', 'Practice seller'), /^DEMO\b/);
  assert.match(actualFarm(true, '', ''), /^DEMO\b/, 'sample data must remain identifiable even without a farm name');
  assert.match(INVOICE, /const demoInvoice = renderedBook\?\.status === 'sample';/, 'DEMO must come from the actual captured sample book');
  assert.ok(
    !/sellerFarm/.test(src('../lib/invoice-pdf.ts')),
    'the PDF writer has gone back to reading the profile itself instead of the shared document',
  );
});

test('an unset farm name prints nothing, rather than a stand-in', () => {
  // Executed, not pattern-matched: `buildInvoiceDocument` with no farm produces no farm line, and
  // tests/invoice-document.test.ts asserts exactly that against both an empty and a blank value.
  // What is left to guard here is the source of the value — no `??`/`||` default string sneaking
  // a borrowed farm back in, on the profile read or anywhere downstream of it.
  assert.ok(
    !/farm_name\s*\?\?\s*['"][^'"]+['"]/.test(INVOICE),
    'a default farm name has been reintroduced — an unset farm must print nothing',
  );
  assert.ok(
    /profile\?\.farm_name\?\.trim\(\) \?\? ''/.test(INVOICE),
    'an unset farm must resolve to the empty string, which the document model drops',
  );
});

test('the farm name is editable, or it is a field no farmer can ever set', () => {
  // The half of this fix that is easy to forget: a new profile field with no UI is invisible, and
  // every invoice would simply lose the line instead of gaining a correct one.
  assert.ok(/farm_name\?: string \| null;/.test(TYPES), 'Profile has no farm_name field');
  assert.ok(/farmName/.test(ACCOUNT), 'the account screen has no farm-name input');
  assert.ok(
    /farm_name: form\.farmName\.trim\(\) \|\| null/.test(ACCOUNT),
    'the account screen must save farm_name as null when cleared, so clearing it actually clears it',
  );
});
