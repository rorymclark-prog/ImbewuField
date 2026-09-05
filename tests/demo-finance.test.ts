import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { buildAreaReturns } from '../lib/area-returns.ts';
// The sample farm's books have to survive a funder adding up a column, so the
// three rules buildDemoFinance() is written to (see the comment block above it
// in lib/demo-farm.ts) are asserted here rather than left to inspection:
//   1. nothing is sold that was not harvested first;
//   2. no sample harvest exceeds the catalog's published planning band;
//   3. every rand is kilograms times a price from the app's own price table.
// The fixture that preceded this one broke rule 1 on every crop — 26.5 kg sold
// against 19 kg logged — which is exactly the kind of error no type check and
// no snapshot test can see.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  buildDemoCropPlan,
  buildDemoDesignCanvasState,
  buildDemoFacilitatorState,
  buildDemoFinance,
} from '../lib/demo-farm.ts';
import { DEFAULT_CROP_PRICES } from '../lib/crop-prices.ts';
import { cropByKey } from '../lib/crop-catalog.ts';
import { benchmarkAreaConflictBedLabels, estimatedYieldKgAdjusted } from '../lib/crop-plan.ts';
import {
  bedsFromDesign,
  buildCropAliasIndex,
  matchCropKey,
} from '../lib/harvest-reconciliation.ts';
import { suspectedDuplicateIncomeIds } from '../lib/duplicate-income.ts';

const aliasIndex = buildCropAliasIndex();
const cropKeyOf = (label: string): string => {
  const key = matchCropKey(label, aliasIndex);
  assert.ok(key, `"${label}" must resolve to one catalog crop, or the reconciliation panel cannot match it`);
  return key;
};
const monthKey = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

test('every sample sale is whole rand at a price from the app\'s own price table', () => {
  const { sales } = buildDemoFinance();
  assert.ok(sales.length >= 24, 'a twelve-month trading record needs a sale in most months');
  for (const sale of sales) {
    const price = DEFAULT_CROP_PRICES[cropKeyOf(sale.crop)];
    assert.ok(price, `${sale.crop} must be priced by lib/crop-prices.ts, never by a figure typed into the fixture`);
    const retail = price.retailPerKg;
    const shop = Math.round(retail * 0.7);
    assert.ok(shop >= price.wholesalePerKg, `${sale.crop}: the shop price must still beat wholesale`);
    assert.ok(
      sale.amount === Math.round(sale.kg * retail) || sale.amount === Math.round(sale.kg * shop),
      `${sale.id}: R${sale.amount} for ${sale.kg} kg is neither the retail (R${retail}) nor the shop (R${shop}) price`,
    );
    assert.ok(Number.isInteger(sale.amount), `${sale.id}: sample money is whole rand so the arithmetic reads on screen`);
    assert.ok(sale.kg > 0 && sale.buyer, `${sale.id}: every sale names a quantity and a buyer`);
  }
});

test('no sample crop is ever sold before it was harvested', () => {
  const { sales, production } = buildDemoFinance();
  const ledger = new Map<string, { harvested: number; sold: number }>();
  const cell = (crop: string, iso: string) => {
    const k = `${cropKeyOf(crop)} in ${monthKey(iso)}`;
    if (!ledger.has(k)) ledger.set(k, { harvested: 0, sold: 0 });
    return ledger.get(k)!;
  };
  for (const row of production) cell(row.crop, row.logged_at).harvested += row.kg;
  for (const row of sales) cell(row.crop, row.sold_at).sold += row.kg;
  for (const [where, { harvested, sold }] of ledger) {
    assert.ok(sold <= harvested + 1e-9, `${where}: sold ${sold} kg out of ${harvested} kg harvested`);
  }
});

test('no sample harvest exceeds the seeded area at the catalog’s published upper benchmark', () => {
  const { production } = buildDemoFinance();
  const beds = bedsFromDesign(buildDemoFacilitatorState());
  const plantings = buildDemoCropPlan().plantings;
  for (let month = 1; month <= 12; month++) {
    assert.deepEqual(
      benchmarkAreaConflictBedLabels(plantings, beds, month),
      [],
      `the sample plan overbooks mapped land when opened in month ${month}`,
    );
  }

  // Once the independent area check above proves the plan is not granting two
  // crops the same land, sum the complete crop-cycle area benchmarks. This
  // fixture check deliberately includes finished one-off crops: its harvest
  // ledger spans the full trailing year, not only what remains in the ground.
  const intended = new Map<string, number>();
  for (const planting of plantings) {
    const bed = beds.find((candidate) => candidate.id === planting.bedId);
    assert.ok(bed, `${planting.cropKey} is planted on a bed missing from the demo map`);
    const kg = estimatedYieldKgAdjusted(planting, bed.areaM2, plantings);
    if (kg > 0) intended.set(planting.cropKey, (intended.get(planting.cropKey) ?? 0) + kg);
  }

  const harvested = new Map<string, number>();
  for (const row of production) {
    const key = cropKeyOf(row.crop);
    harvested.set(key, (harvested.get(key) ?? 0) + row.kg);
  }

  for (const [key, kg] of harvested) {
    const planned = intended.get(key);
    assert.ok(planned !== undefined, `${key} is logged as harvested but is not in the demo crop plan at all`);
    const crop = cropByKey(key)!;
    const upperPerM2 = crop.yieldRangeKgPerM2?.[1] ?? crop.yieldKgPerM2;
    assert.ok(crop.yieldKgPerM2 !== null && upperPerM2 !== null && upperPerM2 > 0, `${key} has no yield evidence for the demo claim`);
    const upper = planned * (upperPerM2 / crop.yieldKgPerM2);
    assert.ok(kg <= upper + 1e-9, `${key}: logged ${kg} kg above the published area-scaled upper benchmark of ${upper.toFixed(1)} kg`);
  }
});

test('the sample books never trip the app\'s own double-counted-income warning', () => {
  const { sales, invoices } = buildDemoFinance();
  const flagged = suspectedDuplicateIncomeIds([
    ...sales.map((s) => ({ id: `sale-${s.id}`, kind: 'sale' as const, amount: s.amount, iso: s.sold_at })),
    ...invoices
      .filter((i) => i.status === 'paid')
      .map((i) => ({ id: `invoice-${i.id}`, kind: 'invoice' as const, amount: i.total, iso: i.paidAt! })),
  ]);
  assert.deepEqual([...flagged], [], 'a sale and a paid invoice of the same amount within 3 days puts an amber warning on the demo');
});

test('sample invoices are a real numbered sequence that the invoice tool continues', () => {
  const { invoices, customers } = buildDemoFinance();
  assert.ok(invoices.length >= 5, 'a standing order should have a run of invoices behind it');
  for (const invoice of invoices) {
    assert.equal(invoice.total, invoice.items.reduce((sum, i) => sum + i.qty * i.price, 0));
    assert.ok(
      customers.some((customer) => customer.name === invoice.billTo),
      `${invoice.id} bills a customer the invoice tool does not know`,
    );
    // lib/invoices.ts cleanInvoice() downgrades a paid invoice with no usable
    // payment date to unpaid, which would silently delete income from the demo.
    if (invoice.status === 'paid') {
      assert.ok(invoice.paidAt && Number.isFinite(Date.parse(invoice.paidAt)), `${invoice.id} is paid but has no usable payment date`);
      assert.ok(Date.parse(invoice.paidAt) >= Date.parse(invoice.dateISO), `${invoice.id} was paid before it was issued`);
    }
    // loadNextInvoiceNumber()'s fallback is 44; numbering above it would make the
    // invoice tool offer a number that sits underneath the saved ones.
    assert.ok(invoice.no > 0 && invoice.no < 44, `#${invoice.no} must leave 44 as the next number in the sequence`);
  }
  assert.equal(new Set(invoices.map((i) => i.no)).size, invoices.length, 'invoice numbers must be unique');
  assert.equal(invoices.filter((i) => i.status !== 'paid').length, 1, 'exactly one invoice should still be outstanding');
});

test('the sample ledger covers the trailing twelve months and stops at today', () => {
  const finance = buildDemoFinance();
  const now = new Date();
  const stamps = [
    ...finance.sales.map((r) => r.sold_at),
    ...finance.expenses.map((r) => r.spent_at),
    ...finance.production.map((r) => r.logged_at),
    ...finance.invoices.flatMap((r) => [r.dateISO, ...(r.paidAt ? [r.paidAt] : [])]),
  ];
  for (const iso of stamps) {
    const t = Date.parse(iso);
    assert.ok(Number.isFinite(t), `${iso} is not a real date`);
    assert.ok(t <= now.getTime(), `${iso} is in the future — the demo must never show money it has not made yet`);
    assert.ok(now.getTime() - t < 400 * 86_400_000, `${iso} is older than the twelve months the fixture claims to cover`);
  }
  const months = new Set(stamps.map(monthKey));
  assert.equal(months.size, 12, 'every one of the trailing twelve months should carry activity');
  // The finances page opens on the current month: it must never be the empty one.
  const thisMonth = monthKey(now.toISOString());
  const rowsThisMonth = [
    ...finance.sales.filter((r) => monthKey(r.sold_at) === thisMonth),
    ...finance.production.filter((r) => monthKey(r.logged_at) === thisMonth),
    ...finance.expenses.filter((r) => monthKey(r.spent_at) === thisMonth),
  ];
  assert.ok(rowsThisMonth.length >= 4, `the default month view opened on only ${rowsThisMonth.length} rows`);
});

/* ── The Finance page's own sample entry point (23 Aug 2026) ─────────────────
   The Finance page used to offer its demo in the one shape that could hurt a
   farmer: a phone-only button, shown only while the ledger was empty, that
   wrote thirteen 'Sample —' rows through the REAL addSale/addExpense/
   saveInvoice paths into her own books. It also meant a signed-in farmer with
   one entry — the exact state a new user reaches after their first sale —
   could not see a worked example at all.

   The page now enters sample mode instead. That is a page composition rather
   than a lib function, so it is asserted against the source: weaker than a
   render, strictly stronger than the nothing that let the writing version
   ship. */
// The money screen moved: /records is the merged Picked · Sold · Spent book and /finances is
// now only a redirect onto it (app/finances/page.tsx). The rule this test protects is unchanged.
test('the finances page offers its sample through sample mode, never by writing demo rows into real books', () => {
  const page = readFileSync(new URL('../app/records/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /function handleSeeSample\(\)/, 'the finances page lost its sample entry point');
  assert.match(page, /if \(enterSampleMode\(\)\) window\.location\.href = '\/records\?tab=charts'/,
    'the sample entry must enter sample mode and hard-navigate so every hook remounts');

  // The destructive seeder and its real-write imports must stay gone.
  assert.doesNotMatch(page, /loadSampleData/, 'the real-books sample seeder is back');
  assert.doesNotMatch(page, /^import \{[^}]*\bsaveInvoice\b/m,
    'the finances page must not import invoice writers it only needed for the old seeder');

  // Offered on both layouts: the desktop sheet takes it as a prop, the phone view renders it inline.
  assert.match(page, /onSeeSample=\{sampling \? undefined : handleSeeSample\}/,
    'the desktop financial sheet must offer the sample (and not while already in it)');
  assert.match(page, /onClick=\{handleSeeSample\}/, 'the phone view must offer the sample');

  // No longer gated on an empty ledger — a farmer with one row still needs the example.
  assert.doesNotMatch(page, /!hasAnyData && online/,
    'the sample offer must not be hidden once the farmer has logged anything');

  // A signed-in farmer inside sample mode must never see her own name over demo books.
  assert.match(page, /name=\{sampling \? 'Ubhejane Creche \(sample\)'/,
    "the sheet's farm name must follow sample mode, not the signed-in user");
});

test('sample returns use the mapped beds and plots without losing or duplicating money', () => {
  const { sales, expenses, invoices } = buildDemoFinance();
  const beds = bedsFromDesignCanvas(buildDemoDesignCanvasState());
  const september = new Date(expenses.find(e => e.id === 'demo-expense-11')!.spent_at);
  const result = buildAreaReturns(beds, sales, expenses, invoices, 'month', september);
  assert.equal(result.unassignedEntries, 0);
  assert.ok(sales.every(row => row.enterprise === 'vegetables'));
  assert.ok(invoices.every(row => row.enterprise === 'vegetables'));
  // The sample plan grows even its maize and sweet potato on beds. The separate
  // mapped staple plots have preparation costs, not an invented harvest.
  assert.ok(buildDemoCropPlan().plantings.every(p => beds.some(b => b.id === p.bedId && b.kind !== 'plot')));
  assert.equal(result.cards[0].areaM2, 44);
  assert.ok(Math.abs(result.cards[1].areaM2 - 84) < 0.01);
  for (const card of result.cards) assert.notEqual(card.contributionPerM2, null);
  assert.equal(result.cards[1].sales, 0);
  assert.ok(result.cards[1].costs > 0);
  const inPeriod = (iso: string) => new Date(iso).getFullYear() === september.getFullYear() && new Date(iso).getMonth() === 8;
  assert.equal(result.cards[2].sales, sales.filter(s => inPeriod(s.sold_at)).reduce((n, s) => n + s.amount, 0) + invoices.filter(i => i.status === 'paid' && i.paidAt && inPeriod(i.paidAt)).reduce((n, i) => n + i.total, 0));
  assert.equal(result.cards[2].costs, expenses.filter(e => inPeriod(e.spent_at)).reduce((n, e) => n + e.amount, 0));
});
