import test from 'node:test';
import assert from 'node:assert/strict';
import { recordQuantity, recordUnit, recordWeightKg, recordQuantityLabel, recordQuantityPayload, quantityTotals, decimalQuantitySum } from '../lib/farm-records.ts';
import { invoiceSalesForPaidInvoice, cashIncomeTotal } from '../lib/invoice-sales.ts';
import { recordedSaleInvoiceError } from '../lib/invoice-entry.ts';
import { buildFarmMetrics } from '../lib/farm-metrics.ts';
import { buildFinanceSeries } from '../lib/finance-series.ts';
import { creditPackTrackRecord } from '../lib/credit-pack.ts';
import { buildReconciliation } from '../lib/harvest-reconciliation.ts';
import { buildFarmerMetrics } from '../lib/network.ts';
import { buildCohortSeries } from '../lib/cohort-series.ts';
import { readFileSync } from 'node:fs';
import type { ProductionLog, SalesLog } from '../lib/db/types.ts';
import type { SavedInvoice } from '../lib/invoices.ts';

const date = '2026-10-02T12:00:00.000Z', now = new Date(date);
const harvest = (id: string, crop: string, fields = { kg: 2 } as Partial<ProductionLog>): ProductionLog => ({ id, crop, profile_id: 'f', garden_id: null, kg: null, photo_url: null, logged_at: date, created_at: date, ...fields });
const sale = (id: string, crop: string, amount: number, fields = { kg: 2 } as Partial<SalesLog>): SalesLog => ({ id, crop, amount, profile_id: 'f', garden_id: null, kg: null, buyer: null, sold_at: date, created_at: date, ...fields });
const invoice = (items: SavedInvoice['items']): SavedInvoice => ({ id: 'inv', no: 1, billTo: 'Buyer', dateISO: date, paidAt: date, status: 'paid', items, total: items.reduce((sum, item) => sum + item.qty * item.price, 0) });

test('older kilogram records retain their exact observed weight without a migration', () => {
  assert.equal(recordQuantity({ kg: 2.75 }), 2.75);
  assert.equal(recordUnit({ kg: 2.75 }), 'kg');
  assert.equal(recordWeightKg({ kg: 2.75 }), 2.75);
  assert.match(recordQuantityLabel({ kg: 2.75 }), /^2[,.]75 kg$/);
  assert.match(recordQuantityLabel({ kg: 0.00000007 }), /^0[,.]00000007 kg$/, 'a small observed weight must never print as zero');
  assert.equal(recordQuantityLabel(recordQuantityPayload(Number.MAX_SAFE_INTEGER, 'eggs')).replace(/[^0-9]/g, ''), String(Number.MAX_SAFE_INTEGER), 'a valid whole count must not be rounded by its display formatter');
});

test('eggs and honey jars retain real quantities with unknown weight', () => {
  const eggs = recordQuantityPayload(17, 'eggs'), honey = recordQuantityPayload(3.5, 'jars');
  assert.deepEqual(eggs, { quantity: 17, unit: 'eggs', kg: null });
  assert.equal(recordQuantity(eggs), 17);
  assert.match(recordQuantityLabel(honey), /^3[,.]5 jars$/);
  assert.equal(recordWeightKg(eggs), null);
  assert.equal(recordWeightKg(honey), null);
  assert.equal(recordQuantityLabel(recordQuantityPayload(4, 'each')), '4 items');
});

test('malformed units, fake count weights and contradictory kg fields never become weight evidence', () => {
  for (const row of [
    { kg: 99, quantity: 6, unit: 'eggs' }, { kg: 99, quantity: 6, unit: 'hours' },
    { kg: 99, quantity: 6 }, { kg: 99, quantity: 6, unit: 'kg' },
    { kg: Infinity }, { kg: NaN }, { kg: -2 }, { kg: 0 },
  ]) assert.equal(recordWeightKg(row), null);
  assert.equal(recordQuantity({ kg: null, quantity: 2.5, unit: 'eggs' }), null);
  for (const quantity of [0, -1, NaN, Infinity, 2.5]) assert.throws(() => recordQuantityPayload(quantity, 'eggs'));
  assert.throws(() => recordQuantityPayload(2, 'hours' as 'kg'));
});

test('a mixed farm summary adds matching units and never adds eggs to kilograms', () => {
  assert.deepEqual(quantityTotals([{ kg: 2 }, recordQuantityPayload(4, 'kg'), recordQuantityPayload(12, 'eggs'), recordQuantityPayload(8, 'eggs'), recordQuantityPayload(3, 'jars')]), [
    { unit: 'kg', quantity: 6 }, { unit: 'eggs', quantity: 20 }, { unit: 'jars', quantity: 3 },
  ]);
  assert.deepEqual(quantityTotals([recordQuantityPayload(Number.MAX_SAFE_INTEGER, 'eggs'), recordQuantityPayload(1, 'eggs'), { kg: 2 }]), [{ unit: 'kg', quantity: 2 }], 'an unrepresentable total must not crash or invent a partial egg count');
});

test('decimal harvest totals do not invent digits through binary floating-point addition', () => {
  const rows = [0.1, 0.2].map(quantity => recordQuantityPayload(quantity, 'kg'));
  assert.deepEqual(quantityTotals(rows), [{ unit: 'kg', quantity: 0.3 }]);
  assert.match(recordQuantityLabel(recordQuantityPayload(quantityTotals(rows)[0].quantity, 'kg')), /^0[,.]3 kg$/);
});

test('a 1203.6 kg record total stays readable without discarding precision from saved inputs', () => {
  // These decimal entries reproduced the live 1 203,6000000000001 kg total.
  // The individual observations are valid; only their derived addition needs repair.
  const rows = [0.13, 1203.47].map(quantity => recordQuantityPayload(quantity, 'kg'));
  assert.deepEqual(quantityTotals(rows), [{ unit: 'kg', quantity: 1203.6 }]);
  assert.deepEqual(quantityTotals([...rows].reverse()), [{ unit: 'kg', quantity: 1203.6 }]);
  assert.match(recordQuantityLabel(recordQuantityPayload(quantityTotals(rows)[0].quantity, 'kg')), /^1[\s\u00a0]?203[,.]6 kg$/);
  assert.deepEqual(rows.map(row => row.quantity), [0.13, 1203.47], 'summing must not rewrite the saved observations');
});

test('decimal totals preserve tiny exponent observations and explicit high-precision inputs', () => {
  assert.deepEqual(quantityTotals([{ kg: 1e-8 }, { kg: 2e-8 }]), [{ unit: 'kg', quantity: 3e-8 }]);
  assert.deepEqual(quantityTotals([{ kg: Number.MIN_VALUE }, { kg: Number.MIN_VALUE }]), [{ unit: 'kg', quantity: 1e-323 }]);
  assert.match(recordQuantityLabel(recordQuantityPayload(quantityTotals([{ kg: 1e-8 }, { kg: 2e-8 }])[0].quantity, 'kg')), /^0[,.]00000003 kg$/);
  for (const quantity of [1.2345678901234567, 0.30000000000000004]) {
    assert.deepEqual(quantityTotals([{ kg: quantity }]), [{ unit: 'kg', quantity }], 'an explicit observed value must not be rounded to hide a different arithmetic defect');
    assert.equal(recordQuantityLabel({ kg: quantity }).replace(',', '.'), `${quantity} kg`);
  }
});

test('exact decimal accumulation keeps safe whole counts and withholds overflowing units', () => {
  assert.deepEqual(quantityTotals([recordQuantityPayload(Number.MAX_SAFE_INTEGER - 1, 'eggs'), recordQuantityPayload(1, 'eggs')]), [{ unit: 'eggs', quantity: Number.MAX_SAFE_INTEGER }]);
  assert.deepEqual(quantityTotals([recordQuantityPayload(Number.MAX_SAFE_INTEGER, 'eggs'), recordQuantityPayload(1, 'eggs'), recordQuantityPayload(1, 'eggs'), { kg: 0.3 }]), [{ unit: 'kg', quantity: 0.3 }]);
  assert.deepEqual(quantityTotals([recordQuantityPayload(Number.MAX_SAFE_INTEGER, 'each'), recordQuantityPayload(1, 'each')]), []);
  assert.deepEqual(quantityTotals([{ kg: 1e308 }, { kg: 1e308 }, recordQuantityPayload(2, 'jars')]), [{ unit: 'jars', quantity: 2 }]);
});

test('signed observed weights derive an exact balance while preserving zero and oversold values', () => {
  assert.equal(decimalQuantitySum([0.3, -0.2]), 0.1);
  assert.equal(decimalQuantitySum([-0.1, 0.3, -0.2]), 0);
  assert.equal(decimalQuantitySum([0.1, -0.2]), -0.1, 'the arithmetic must not clamp an oversold balance into kept food');
  assert.equal(decimalQuantitySum([Number.MIN_VALUE, -Number.MIN_VALUE]), 0);
  assert.equal(decimalQuantitySum([]), 0);
});

test('signed decimal accumulation rejects invalid observations and only converts its final result', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(decimalQuantitySum([1, invalid]), null);
  assert.equal(decimalQuantitySum([1e308, 1e308]), null);
  assert.equal(decimalQuantitySum([1e308, 1e308, -1e308]), 1e308, 'an exact finite balance must survive an intermediate sum beyond Number range');
  assert.equal(decimalQuantitySum([1.2345678901234567]), 1.2345678901234567);
});

test('paid invoices log counted produce once with deterministic line identity and no weight conversion', () => {
  const inv = invoice([{ desc: 'Eggs', qty: 12, unit: 'eggs', price: 3 }, { desc: 'Honey', qty: 2, unit: 'jars', price: 80 }, { desc: 'Delivery', qty: 1, unit: 'hours', price: 20 }]);
  const rows = invoiceSalesForPaidInvoice(inv);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => [row.crop, row.quantity, row.unit, row.kg, row.invoice_line]), [['Eggs', 12, 'eggs', null, 0], ['Honey', 2, 'jars', null, 1]]);
  assert.equal(cashIncomeTotal(rows, [inv]), 216, 'the whole invoice remains one cash event, including the service line');
  assert.deepEqual(invoiceSalesForPaidInvoice({ ...inv, status: 'unpaid' }), []);
});

test('documenting an existing egg sale pins its quantity, unit, ownership and payment date', () => {
  const row = sale('sale-egg', 'Eggs', 36, recordQuantityPayload(12, 'eggs'));
  const doc = { ...invoice([{ desc: 'Eggs', qty: 12, unit: 'eggs', price: 3 }]), sourceSaleId: row.id };
  assert.equal(recordedSaleInvoiceError(doc, row, 'f'), null);
  assert.ok(recordedSaleInvoiceError(doc, row, 'other'));
  assert.ok(recordedSaleInvoiceError({ ...doc, items: [{ ...doc.items[0], unit: 'kg' }] }, row, 'f'));
  assert.ok(recordedSaleInvoiceError({ ...doc, items: [{ ...doc.items[0], qty: 6, price: 6 }] }, row, 'f'));
  assert.ok(recordedSaleInvoiceError({ ...doc, paidAt: '2026-09-30T12:00:00Z' }, row, 'f'));
});

test('count sales contribute income but cannot inflate price per kilogram or bed yields', () => {
  const metrics = buildFarmMetrics([{ id: 'p', cropKey: 'tomatoes', bedId: 'b', sowMonth: 1 }], [{ id: 'b', label: 'Bed', areaM2: 4 }],
    [harvest('weighed', 'Tomatoes'), harvest('counted', 'Tomatoes', recordQuantityPayload(100, 'each'))],
    [sale('weighed', 'Tomatoes', 20), sale('counted', 'Tomatoes', 300, recordQuantityPayload(100, 'each'))], [], 'year', now);
  assert.equal(metrics.crops[0].harvestedKg, 2);
  assert.equal(metrics.crops[0].yieldKgPerM2, 0.5);
  assert.equal(metrics.crops[0].soldKg, 2);
  assert.equal(metrics.crops[0].turnoverZar, 320);
  assert.equal(metrics.crops[0].priceZarPerKg, 10, 'count-sale money is not a price for the weighed kilograms');
  const countOnly = buildFarmMetrics([{ id: 'p', cropKey: 'tomatoes', bedId: 'b', sowMonth: 1 }], [{ id: 'b', label: 'Bed', areaM2: 4 }], [harvest('counted', 'Tomatoes', recordQuantityPayload(100, 'each'))], [], [], 'year', now);
  assert.equal(countOnly.crops[0].yieldKgPerM2, null, 'unknown weight cannot prove a zero harvest');
});

test('monthly finance and reconciliation exclude counted produce from weighed stock', () => {
  const production = [harvest('kg', 'Tomatoes'), harvest('eggs', 'Eggs', recordQuantityPayload(50, 'eggs'))];
  const sales = [sale('kg', 'Tomatoes', 20), sale('eggs', 'Eggs', 150, recordQuantityPayload(50, 'eggs'))];
  const series = buildFinanceSeries(production, sales, [], [], now, 1);
  assert.equal(series.months.at(-1)!.producedKg, 2);
  assert.equal(series.months.at(-1)!.soldKg, 2);
  assert.equal(series.totalInZar, 170);
  assert.deepEqual(series.productionQuantities, [{ unit: 'kg', quantity: 2 }, { unit: 'eggs', quantity: 50 }]);
  assert.deepEqual(series.salesQuantities, [{ unit: 'kg', quantity: 2 }, { unit: 'eggs', quantity: 50 }]);
  const reconciliation = buildReconciliation([], [], production, sales, 'year', now);
  assert.deepEqual(reconciliation.unplannedActivity.map(row => row.label), ['Tomatoes']);
});

test('a shared cohort retains count-sale cash without turning eggs into picked or sold kilograms', () => {
  const series = buildCohortSeries([{ production: [harvest('kg', 'Tomatoes'), harvest('eggs', 'Eggs', recordQuantityPayload(50, 'eggs'))], sales: [sale('kg', 'Tomatoes', 20), sale('eggs', 'Eggs', 150, recordQuantityPayload(50, 'eggs'))], expenses: [] }], { now, months: 12 });
  assert.equal(series.months.at(-1)!.producedKg, 2);
  assert.equal(series.months.at(-1)!.soldKg, 2);
  assert.equal(series.months.at(-1)!.incomeZar, 170);
});

test('lender record preserves counted produce beside weighed crops and keeps their money separate', () => {
  const track = creditPackTrackRecord([harvest('kg', 'Tomatoes'), harvest('eggs', 'Eggs', recordQuantityPayload(50, 'eggs'))], [sale('kg', 'Tomatoes', 20), sale('eggs', 'Eggs', 150, recordQuantityPayload(50, 'eggs'))]);
  assert.equal(track.totalHarvestedKg, 2);
  assert.equal(track.totalSoldKg, 2);
  assert.equal(track.totalRevenueZar, 170);
  assert.deepEqual(track.harvestQuantities, [{ unit: 'kg', quantity: 2 }, { unit: 'eggs', quantity: 50 }]);
  assert.deepEqual(track.countedProduce, [{ crop: 'Eggs', harvested: [{ unit: 'eggs', quantity: 50 }], sold: [{ unit: 'eggs', quantity: 50 }], revenueZar: 150 }]);
  assert.equal(track.topCrops[0].revenueZar, 20);
});

test('a count-only network record reports unknown mass while preserving real cash income', () => {
  const metrics = buildFarmerMetrics({ joinedAt: date }, { production: [harvest('eggs', 'Eggs', recordQuantityPayload(50, 'eggs'))], sales: [sale('eggs', 'Eggs', 150, recordQuantityPayload(50, 'eggs'))], expenses: [], courses: [], now });
  assert.equal(metrics.producedKg, null);
  assert.equal(metrics.soldKg, null);
  assert.equal(metrics.keptKg, null);
  assert.equal(metrics.incomeZar, 150);
});

test('count-only production has a visible unit summary before the kilogram chart can show zero production', () => {
  const source = readFileSync(new URL('../components/FinanceGraphs.tsx', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(source, /if \(series\.hasRecords && !hasWeighedProduce\)/);
  assert.match(source, /quantityText\(series\.productionQuantities\)/);
  assert.match(source, /quantityText\(series\.salesQuantities\)/);
  assert.match(source, /No produce weights recorded in these months/);
  assert.match(source, /Weighed produce picked/);
  assert.match(source, /This chart shows recorded kilograms only/);
});
