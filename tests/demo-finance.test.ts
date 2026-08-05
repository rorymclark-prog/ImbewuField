// The sample farm's books have to survive a funder adding up a column, so the
// three rules buildDemoFinance() is written to (see the comment block above it
// in lib/demo-farm.ts) are asserted here rather than left to inspection:
//   1. nothing is sold that was not harvested first;
//   2. nothing is harvested that the crop plan could not grow;
//   3. every rand is kilograms times a price from the app's own price table.
// The fixture that preceded this one broke rule 1 on every crop — 26.5 kg sold
// against 19 kg logged — which is exactly the kind of error no type check and
// no snapshot test can see.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDemoCropPlan,
  buildDemoFacilitatorState,
  buildDemoFinance,
} from '../lib/demo-farm.ts';
import { DEFAULT_CROP_PRICES } from '../lib/crop-prices.ts';
import {
  bedsFromDesign,
  buildCropAliasIndex,
  intendedKgByMonthPerCrop,
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

test('no sample harvest beats what the seeded crop plan can actually grow', () => {
  const { production } = buildDemoFinance();
  const beds = bedsFromDesign(buildDemoFacilitatorState());
  const plantings = buildDemoCropPlan().plantings;
  const intended = intendedKgByMonthPerCrop(plantings, beds);

  const harvested = new Map<string, number>();
  for (const row of production) {
    const key = cropKeyOf(row.crop);
    harvested.set(key, (harvested.get(key) ?? 0) + row.kg);
  }

  let plannedTotal = 0;
  let loggedTotal = 0;
  for (const [key, kg] of harvested) {
    const months = intended.get(key);
    assert.ok(months, `${key} is logged as harvested but is not in the demo crop plan at all`);
    const planned = months.reduce((sum, m) => sum + m, 0);
    assert.ok(kg <= planned + 1e-9, `${key}: logged ${kg} kg against a plan of only ${planned.toFixed(1)} kg`);
    plannedTotal += planned;
    loggedTotal += kg;
  }
  // A demo farm hitting 100% of an estimate reads as fiction; well under it reads
  // as a farm that is failing. Keep it in the believable band.
  const ratio = loggedTotal / plannedTotal;
  assert.ok(ratio > 0.8 && ratio < 0.99, `the sample farm should run at 80-99% of plan, not ${(ratio * 100).toFixed(0)}%`);
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
    assert.ok(customers.includes(invoice.billTo), `${invoice.id} bills a customer the invoice tool does not know`);
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
