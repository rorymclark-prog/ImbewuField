import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Swarm wave 2 — Records polish: tap targets, isiZulu, theme colours.
// Pins the fixes from the w2-records-polish audit so they cannot silently regress.

const recordsPage = () => readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');
const myRecords = () => readFileSync(new URL('../components/MyRecords.tsx', import.meta.url), 'utf8');

/* ── 1. Tap targets ─────────────────────────────────────────────────────── */

test('SalesLedger Edit and Delete buttons clear the 44px tap-target floor and keep their aria-labels', () => {
  const src = recordsPage();
  const start = src.indexOf("{item.kind !== 'invoice' && (");
  assert.ok(start > 0, 'the SalesLedger row action buttons moved — recheck by hand');
  const block = src.slice(start, src.indexOf('</div>', src.indexOf('</div>', start) + 1));

  // Both buttons must declare a 44x44 hit area, not just the old 4px padding.
  const editBtn = block.slice(0, block.indexOf('</button>') + 9);
  assert.match(editBtn, /minWidth: 44/, 'Edit button lost its 44px min width');
  assert.match(editBtn, /minHeight: 44/, 'Edit button lost its 44px min height');
  assert.match(editBtn, /aria-label=\{recordsText\(lang, 'Edit', 'Hlela'\)\}/, 'Edit button lost its aria-label');

  const deleteBtn = block.slice(block.indexOf('</button>') + 9);
  assert.match(deleteBtn, /minWidth: 44/, 'Delete button lost its 44px min width');
  assert.match(deleteBtn, /minHeight: 44/, 'Delete button lost its 44px min height');
  assert.match(deleteBtn, /aria-label=\{pendingDelete === item\.id/, 'Delete button lost its aria-label');
});

test('the desktop FinancialSheet edit pencil clears the 44px tap-target floor', () => {
  const src = recordsPage();
  const start = src.indexOf('<td className="pr-4 py-3">');
  assert.ok(start > 0, 'the desktop ledger edit-pencil cell moved — recheck by hand');
  const block = src.slice(start, src.indexOf('</td>', start));
  assert.match(block, /minWidth: 44/, 'desktop edit pencil lost its 44px min width');
  assert.match(block, /minHeight: 44/, 'desktop edit pencil lost its 44px min height');
  assert.match(block, /aria-label=\{recordsText\(lang, 'Edit', 'Hlela'\)\}/, 'desktop edit pencil lost its aria-label');
});

/* ── 2. isiZulu ──────────────────────────────────────────────────────────── */

test('the lender-export card reads its copy from recordsUi, not bare English', () => {
  const src = myRecords();
  assert.doesNotMatch(src, />\s*Building document…\s*</, 'lender-export loading label regressed to hard-coded English');
  assert.doesNotMatch(src, /<Landmark size=\{14\} \/> Export records for a lender/, 'lender-export button label regressed to hard-coded English');
  assert.match(src, /recordsUi\(lang, 'Building document…', '[^']+'\)/, 'lender-export loading label must be wrapped in recordsUi');
  assert.match(src, /recordsUi\(lang, 'Export records for a lender', '[^']+'\)/, 'lender-export button label must be wrapped in recordsUi');
  assert.doesNotMatch(src, /: 'Could not build the document\. Please try again\.'/, 'lender-export error fallback regressed to hard-coded English');
  assert.match(src, /recordsUi\(lang, 'Could not build the document\. Please try again\.', '[^']+'\)/, 'lender-export error fallback must be wrapped in recordsUi');
});

test('metricNumber takes the farmer\'s language and never prints a bare "Unknown"', () => {
  const src = recordsPage();
  assert.match(src, /function metricNumber\(value: number \| null, unit: string, lang: string\): string/,
    'metricNumber must accept a lang parameter');
  assert.match(src, /recordsText\(lang, 'Unknown', 'Akwaziwa'\)/, 'metricNumber must return recordsText(lang, ...) for a missing value');
  assert.doesNotMatch(src, /: 'Unknown' : `\$\{value\.toFixed\(1\)\}/, 'metricNumber regressed to a bare English "Unknown"');
  // Every call site inside FarmMetrics must pass lang through.
  const start = src.indexOf('function FarmMetrics');
  const end = src.indexOf('\n/* ', start + 10);
  const calls = [...src.slice(start, end).matchAll(/metricNumber\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)];
  assert.ok(calls.length >= 9, 'expected every FarmMetrics metricNumber() call site to still be present');
  for (const m of calls) {
    assert.match(m[1], /,\s*lang\)?$|,\s*lang$/, `metricNumber call "${m[0]}" does not pass lang through`);
  }
});

/* ── 3. Theme tokens ─────────────────────────────────────────────────────── */

test('MyRecords form and lender-export errors use the --danger token, not a hardcoded hex', () => {
  const src = myRecords();
  assert.doesNotMatch(src, /#C0531E/i, 'a hardcoded error hex survived in MyRecords.tsx');
  const errorStyles = [...src.matchAll(/style=\{\{ color: 'var\(--danger\)' \}\}/g)];
  assert.ok(errorStyles.length >= 3, 'expected the three form/export error messages to use var(--danger)');
});

test('the MyRecords load-error banner accent follows --orange, matching its own text', () => {
  const src = myRecords();
  const start = src.indexOf('Load error banner');
  const block = src.slice(start, src.indexOf('</div>', src.indexOf('</span>', start)));
  assert.doesNotMatch(block, /rgba\(139,32,32/, 'the load-error banner accent is still a hardcoded rgba red');
  assert.match(block, /color-mix\(in srgb, var\(--orange\) 8%, transparent\)/, 'the load-error banner background must derive from var(--orange)');
  assert.match(block, /color-mix\(in srgb, var\(--orange\) 25%, transparent\)/, 'the load-error banner border must derive from var(--orange)');
  assert.match(block, /color: 'var\(--orange\)'/, 'the load-error banner text should still read var(--orange)');
});

test('FarmMetrics headings use var(--text-primary), matching the perennial crop-name sibling', () => {
  const src = recordsPage();
  assert.doesNotMatch(src, /#203c2c/i, 'a hardcoded FarmMetrics heading colour survived');
  const start = src.indexOf('function FarmMetrics');
  const end = src.indexOf('\n/* ', start + 10);
  const block = src.slice(start, end);
  assert.match(block, /Crop performance', 'Ukusebenza kwezitshalo'\)\}<\/h2>/, 'the section heading moved — recheck by hand');
  const headingLine = block.slice(0, block.indexOf('Crop performance'));
  assert.match(headingLine.slice(headingLine.lastIndexOf('style=')), /var\(--text-primary\)/, 'the "Crop performance" heading must use var(--text-primary)');
});

test('the records offline banner follows --orange instead of a hardcoded amber', () => {
  const src = recordsPage();
  assert.doesNotMatch(src, /#FDF3E3|#E8D6B0|#7A5B18/i, 'the offline banner still hardcodes its amber colours');
  const start = src.indexOf('{!online && (');
  const block = src.slice(start, src.indexOf('</div>', start));
  assert.match(block, /color-mix\(in srgb, var\(--orange\) 12%, transparent\)/, 'offline banner background must derive from var(--orange)');
  assert.match(block, /color-mix\(in srgb, var\(--orange\) 30%, transparent\)/, 'offline banner border must derive from var(--orange)');
  assert.match(block, /color: 'var\(--orange\)'/, 'offline banner text must use var(--orange)');
});
