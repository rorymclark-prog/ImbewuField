import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ANIMAL_PRODUCT_ENTRY_OPTIONS, CROP_ENTRY_OPTIONS, cropEntryOption, produceEntryOption } from '@/lib/crop-entry';
import { ANIMAL_ENTERPRISES, PRODUCT_LABEL } from '@/lib/animal-enterprises';
import { recordQuantityPayload, recordQuantityLabel, quantityTotals } from '@/lib/farm-records';

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

test('eggs and honey are direct record choices from the animal catalogue without becoming plannable crops', () => {
  const products = [...new Set(Object.values(ANIMAL_ENTERPRISES).map(enterprise => enterprise.product))];
  assert.deepEqual(ANIMAL_PRODUCT_ENTRY_OPTIONS, products.map(product => ({ key: `animal-product:${product}`, label: PRODUCT_LABEL[product] })));
  assert.equal(produceEntryOption('Eggs')?.key, 'animal-product:eggs');
  assert.equal(produceEntryOption('honey')?.key, 'animal-product:honey');
  assert.equal(cropEntryOption('Eggs'), null, 'a product must never acquire a bed yield or sowing rule');
  assert.ok(!CROP_ENTRY_OPTIONS.some(option => option.key.startsWith('animal-product:')));
  const picker = readFileSync(new URL('../components/CropSelect.tsx', import.meta.url), 'utf8');
  assert.match(picker, /<optgroup label="Animal products">/);
  assert.match(picker, /ANIMAL_PRODUCT_ENTRY_OPTIONS\.find/, 'selecting an animal product must resolve the same catalogue option that was displayed');
});

test('picked, quick-sale and sale-edit forms keep quantities with their units and readable labels', () => {
  const pickedAndSale = myRecords();
  const ledger = recordsPage();
  assert.match(pickedAndSale, /idPrefix="picked"[^>]*quantity=\{form\.quantity\}[^>]*unit=\{form\.unit\}/);
  assert.match(pickedAndSale, /idPrefix="quick-sale"[^>]*quantity=\{form\.quantity\}[^>]*unit=\{form\.unit\}/);
  assert.match(ledger, /idPrefix=\{alwaysOpen[^>]*quantity=\{form\.quantity\}[^>]*unit=\{form\.unit\}/);
  assert.match(ledger, /quantity: String\(recordQuantity\(editing\.row\) \?\? ''\), unit: recordUnit\(editing\.row\) \?\? 'kg'/, 'editing eggs must preserve eggs rather than resetting to kg');
  assert.match(pickedAndSale, /recordQuantityPayload\(quantity, form\.unit\)/);
  assert.match(ledger, /recordQuantityPayload\(quantity, form\.unit\)/);
  assert.match(pickedAndSale, /form\.unit === 'kg' && form\.cropKey \? priceFor/, 'per-kg guide prices must never price an egg or a jar');
  assert.match(ledger, /qty: recordQuantityLabel\(s\)/, 'sale CSV and ledger rows must retain their unit');
  assert.match(ledger, /qty: recordQuantityLabel\(p\)/, 'picked CSV and ledger rows must retain their unit');
});

test('quantity controls remain labelled and counts never erase weighed produce from a summary', () => {
  const controls = readFileSync(new URL('../components/records/RecordQuantityFields.tsx', import.meta.url), 'utf8');
  assert.match(controls, /const instanceId = useId\(\)/, 'the phone and desktop forms must not share field IDs');
  assert.match(controls, /htmlFor=\{quantityId\}/);
  assert.match(controls, /id=\{quantityId\}/);
  assert.match(controls, /htmlFor=\{unitId\}/);
  assert.match(controls, /id=\{unitId\}/);
  assert.match(controls, /minHeight: 44/);
  assert.match(controls, /unit === 'eggs' \|\| unit === 'each' \? 'numeric' : 'decimal'/, 'packages may be fractional while eggs and items need whole numbers');
  const rows = [recordQuantityPayload(2.5, 'kg'), recordQuantityPayload(12, 'eggs'), recordQuantityPayload(3, 'jars')];
  const labels = quantityTotals(rows).map(row => recordQuantityLabel(recordQuantityPayload(row.quantity, row.unit)));
  assert.deepEqual(quantityTotals(rows), [{ unit: 'kg', quantity: 2.5 }, { unit: 'eggs', quantity: 12 }, { unit: 'jars', quantity: 3 }], 'mixed records must remain separate quantities rather than a made-up combined weight');
  assert.deepEqual(labels, [`${(2.5).toLocaleString('en-ZA')} kg`, '12 eggs', '3 jars']);
  assert.throws(() => recordQuantityPayload(1.5, 'eggs'), /whole numbers/);
  assert.doesNotThrow(() => recordQuantityPayload(1.5, 'bunches'));
  assert.match(myRecords(), /quantityTotals\(counted\)/, 'the picked summary must use the grouped record authority');
  assert.match(recordsPage(), /quantities: quantityTotals/, 'the financial sheet must retain nonweight observations');
});

test('staff book mappings and print previews retain count units without assigning them weight', () => {
  const staff = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');
  assert.match(staff, /quantity: p\.quantity,\s+unit: p\.unit/);
  assert.match(staff, /quantity: s\.quantity,\s+unit: s\.unit/);
  assert.match(staff, /Production entries[^\n]+recordQuantityLabel\(p\)/);
  assert.match(staff, /Sales entries[^\n]+recordQuantityLabel\(p\)/);
  // Weight coverage must be explicit; a missing weight cannot become a zero
  // contribution to a confidently reported kept-food total.
  assert.match(staff, /weightCoverageUnknown =[^\n]+recordWeightKg\(p\) === null/);
  assert.doesNotMatch(staff, /reduce\([^\n]*\+ p\.kg/, 'staff weight totals must reject nonweight or inconsistent quantity rows');
});

test('staff garden totals and unmatched harvest share decimal arithmetic without losing zero or unknown weight', () => {
  const staff = readFileSync(new URL('../components/NgoDashboard.tsx', import.meta.url), 'utf8');
  assert.match(staff, /const gardenQuantities = quantityTotals\(gardenProduction\)/, 'the garden figure must use the same decimal accumulator as Records');
  assert.match(staff, /gardenWeight = gardenQuantities\.find\(row => row\.unit === 'kg'\)/, 'count units must not become the garden weight figure');
  assert.doesNotMatch(staff, /gardenWeights\.reduce/, 'a raw garden sum would reintroduce decimal noise');
  assert.match(staff, /const balance = weightCoverageUnknown \? null : decimalQuantitySum\(\[/, 'unweighed rows must keep the unmatched amount unknown');
  assert.match(staff, /\.\.\.gardener\.production\.map\(p => recordWeightKg\(p\)!\)/);
  assert.match(staff, /\.\.\.gardener\.sales\.map\(p => -recordWeightKg\(p\)!\)/, 'subtract original observations within the accumulator, not already rounded totals');
  assert.match(staff, /const kept = balance !== null && balance >= 0 \? balance : null/, 'equal harvest and sales must retain zero, while oversold or unknown balance stays unknown');
  assert.doesNotMatch(staff, /produced - soldKg/, 'raw subtraction would still leak a floating-point tail');
});
