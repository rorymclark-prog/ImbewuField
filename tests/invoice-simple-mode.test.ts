import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Simple / All tools on /invoice (lib/app-level.ts). /invoice showed four advanced disclosures
// and an entry-kind picker up front even for a farmer just recording a quick farm-gate sale.
// This file is the source-text guard for the swarm/invoice-exchange-simple track: it reads the
// real shipped file, the same pattern tests/home-next-step-links.test.ts and tests/app-level.test.ts
// use, because app/invoice/page.tsx renders as a stateful page rather than a pure function of
// exported data.

const SOURCE = readFileSync(new URL('../app/invoice/page.tsx', import.meta.url), 'utf8');

test('invoice reads the Simple / All tools level', () => {
  assert.match(SOURCE, /import \{ useAppLevel \} from '@\/lib\/app-level';/);
  assert.match(SOURCE, /const simple = useAppLevel\(\) === 'simple';/);
});

test('Simple hides the entry-kind picker and defaults to a new sale', () => {
  const anchor = SOURCE.indexOf("ui('What are you recording?', 'Urekhoda ini?')");
  assert.ok(anchor > 0, 'the "What are you recording?" field label moved; recheck this guard');
  const block = SOURCE.slice(anchor - 400, anchor);
  assert.match(block, /\{!simple && \(/, 'the "What are you recording?" picker must be gated on !simple');
  // entryKind still defaults to 'new' in state, so a farmer who never sees the picker still
  // gets a plain new-sale invoice.
  assert.match(SOURCE, /const \[entryKind, setEntryKind\] = useState<InvoiceEntryKind>\('new'\);/);
});

test('Simple hides the payment-terms chooser and uses the existing default', () => {
  const idx = SOURCE.indexOf("FieldLabel>{ui('Payment due')}");
  const before = SOURCE.slice(idx - 200, idx);
  assert.match(before, /\{!simple && \(/, 'the Payment due term pills must be gated on !simple');
});

test('Simple keeps the growing-area field but starts it collapsed, like the banking disclosure', () => {
  assert.match(SOURCE, /simple \? \(\s*<Disclosure/, 'Simple must render Growing area as a Disclosure');
  assert.match(SOURCE, /useState<'seller' \| 'buyer' \| 'enterprise' \| null>\(null\)/);
  // All tools keeps the plain always-open select — same options, no collapse.
  const disclosureAt = SOURCE.indexOf('icon={<Sprout size={16} />}');
  assert.ok(disclosureAt > 0, 'the Growing area disclosure lost its icon');
  const allToolsBranch = SOURCE.slice(disclosureAt, disclosureAt + 1400);
  assert.match(allToolsBranch, /\) : \(\s*<label className="block">\s*<FieldLabel>\{ui\('Growing area for these sales'\)\}/);
});

test('the banking disclosure still starts collapsed and stays reachable', () => {
  assert.match(SOURCE, /const \[openPanel, setOpenPanel\] = useState<'seller' \| 'buyer' \| 'enterprise' \| null>\(null\);/,
    'openPanel must still start at null so "Your details & banking" opens on request, not by default');
});

test('Simple hides the saved-invoice payment-method chip row', () => {
  assert.match(SOURCE, /\{inv\.status === 'paid' && !simple && \(/);
});

test('Simple hides the per-line guide-price detail box, keeping one product + quantity + price row', () => {
  const idx = SOURCE.indexOf("const crop = cropEntryOption(it.desc);");
  const before = SOURCE.slice(idx - 60, idx);
  assert.match(before, /\{!simple && \(\(\) => \{/);
});

test('the add-item action reads "Add another item" in Simple, "Add line item" in All tools', () => {
  assert.match(SOURCE, /\{simple \? ui\('Add another item'\) : ui\('Add line item'\)\}/);
  assert.match(SOURCE, /'Add another item': 'Engeza enye into',/);
});

test('a real pending sales-sync warning is never hidden by Simple', () => {
  const idx = SOURCE.indexOf("invoice.id === currentId)?.salesSyncPending && (");
  assert.ok(idx > 0, 'the pending-sync notice condition moved; recheck this guard');
  const block = SOURCE.slice(idx, idx + 400);
  assert.match(block, /Retry sales sync/, 'the pending-sync block should still offer the retry action');
  assert.doesNotMatch(block, /!simple/, 'Simple must not additionally suppress a genuine pending-sync warning');
});

test('the saved-invoice delete control clears the 44px tap-target floor and keeps its label', () => {
  const idx = SOURCE.indexOf("aria-label={ui('Delete invoice')}");
  assert.ok(idx > 0, 'the delete control lost its aria-label');
  const block = SOURCE.slice(idx, idx + 500);
  assert.match(block, /width: 44, height: 44, minWidth: 44, minHeight: 44/,
    'the delete "x" must offer a real 44x44 hit area, not just a 15px icon in 4px of padding');
  assert.match(block, /<X size=\{15\} \/>/, 'the glyph must be the Lucide X icon, not a text "×"');
});
