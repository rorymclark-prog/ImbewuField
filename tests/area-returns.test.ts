import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAreaReturns } from '../lib/area-returns';
import { productionAreaAccess, productionAreaSummary, validProductionSite, type ProductionSite } from '../lib/production-sites';
import { decideNetworkAccess } from '../lib/network-access';
import type { SalesLog, ExpenseLog } from '../lib/db/types';
import type { SavedInvoice } from '../lib/invoices';
const now = new Date('2026-09-05T12:00:00');
const beds = [{ id: 'v', label: 'Veg', areaM2: 10 }, { id: 's', label: 'Staples', areaM2: 90, kind: 'plot' as const }];
const sale = (amount: number, enterprise: SalesLog['enterprise'], extra = {}): SalesLog => ({ id: 'sale', profile_id: 'me', garden_id: null, crop: 'Beans', kg: 1, amount, enterprise, buyer: null, sold_at: '2026-09-01', created_at: '2026-09-01', ...extra });
const cost = (amount: number, enterprise: ExpenseLog['enterprise']): ExpenseLog => ({ id: 'cost', profile_id: 'me', garden_id: null, item: 'Input', amount, enterprise, supplier: null, spent_at: '2026-09-01', created_at: '2026-09-01' });
test('combined R/m² is an area-weighted contribution, with shared costs deducted once', () => {
  const r = buildAreaReturns([...beds, beds[0]], [sale(200, 'vegetables'), sale(300, 'staples')], [cost(100, 'vegetables'), cost(30, 'shared'), cost(50, null)], [], 'month', now);
  assert.deepEqual(r.cards.map(c => c.areaM2), [10, 90, 100]);
  assert.deepEqual(r.cards.map(c => c.contributionPerM2), [10, 300 / 90, 3.7]);
  assert.equal(r.unassignedCosts, 50); assert.equal(r.sharedCosts, 30);
});
test('missing assignments and area stay unknown; crop names cannot assign an enterprise', () => {
  const r = buildAreaReturns([], [sale(200, null), sale(50, 'other')], [], [], 'year', now);
  assert.ok(r.cards.every(c => c.contributionPerM2 === null)); assert.equal(r.unassignedSales, 200); assert.equal(r.otherSales, 50);
  assert.ok(buildAreaReturns(beds, [], [], [], 'year', now).cards.every(c => c.contributionPerM2 === null));
  assert.equal(buildAreaReturns(beds, [], [cost(50, 'vegetables')], [], 'month', now).cards[0].contributionPerM2, -5);
});
test('a paid invoice and its generated rows count once, including non-kg lines', () => {
  const invoice = { id: 'i', status: 'paid', paidAt: '2026-09-02', total: 150, enterprise: 'vegetables', items: [{ desc: 'Veg', qty: 5, unit: 'bag', price: 30 }], billTo: 'Buyer' } as SavedInvoice;
  const r = buildAreaReturns(beds, [sale(150, 'vegetables', { invoice_id: 'i', invoice_line: 0 })], [], [invoice], 'month', now);
  assert.equal(r.cards[0].sales, 150); assert.equal(r.cards[2].sales, 150);
  const unknown = buildAreaReturns(beds, [], [], [{ ...invoice, enterprise: undefined }], 'month', now);
  assert.equal(unknown.unassignedSales, 150); assert.equal(unknown.cards[2].sales, 0);
});
test('mixed invoice lines retain explicit assignments and invoice discounts cannot overstate sales', () => {
  const invoice = { id: 'i', status: 'paid', paidAt: '2026-09-02', total: 100, items: [{ desc: 'Beans', qty: 5, unit: 'kg', price: 20 }], billTo: '' } as SavedInvoice;
  const rows = [sale(100, 'staples', { invoice_id: 'i', invoice_line: 0 })];
  assert.equal(buildAreaReturns(beds, rows, [], [invoice], 'month', now).cards[1].sales, 100);
  const r = buildAreaReturns(beds, rows, [], [{ ...invoice, total: 80 }], 'month', now);
  assert.equal(r.unassignedSales, 80); assert.equal(r.cards[2].sales, 0);
});
test('summer season includes December of the preceding year, not unrelated years', () => {
  const r = buildAreaReturns(beds, [sale(20, 'vegetables', { sold_at: '2025-12-03' }), sale(50, 'vegetables', { sold_at: '2024-12-03' })], [], [], 'season', new Date('2026-01-05T12:00:00'));
  assert.equal(r.cards[0].sales, 20);
});
const site = (extra = {}): ProductionSite => ({ code: 'garden-01', name: 'Garden', observedOn: '2026-09-01', vegetableM2: 100, stapleM2: 900, boundaryM2: 1200, evidence: 'Measured beds and plots during the visit.', published: false, updatedAt: '2026-09-01', updatedBy: 'ngo-staff', ...extra });
test('production areas reject impossible dates, missing values, overlapping totals and invalid codes', () => {
  assert.equal(validProductionSite(site(), '2026-09-05'), true);
  for (const extra of [{ observedOn: '2026-02-30' }, { observedOn: '2027-01-01' }, { vegetableM2: -1 }, { vegetableM2: null }, { vegetableM2: Infinity }, { stapleM2: 1300 }, { code: '../elsewhere' }, { evidence: '' }]) assert.equal(validProductionSite(site(extra), '2026-09-05'), false);
});
test('published hectares use the latest record for each physical garden and omit private evidence', () => {
  const r = productionAreaSummary([site({ published: true }), site({ vegetableM2: 200, published: true, updatedAt: '2026-09-02' }), site({ code: 'private-02', vegetableM2: 8000 })], true);
  assert.equal(r.sites, 1); assert.equal(r.hectares, 0.11); assert.equal(r.combinedM2, 1100);
  assert.ok(!JSON.stringify(r).includes('ngo-staff')); assert.ok(!JSON.stringify(r).includes('Measured'));
  assert.equal(productionAreaSummary([site({ published: true }), site({ published: false, updatedAt: '2026-09-03' })], true).sites, 0);
});
test('production-area permissions enforce tenant grants, NGO pause and management capabilities', () => {
  const funder = decideNetworkAccess({ id: 'f', role: 'funder', org_id: 'fund', fundedOrgIds: ['ngo'] }); assert.ok(funder.ok);
  assert.deepEqual(productionAreaAccess(funder, 'ngo', null, true, false), { publishedOnly: true, manage: false });
  assert.equal(productionAreaAccess(funder, 'other', null, true, false), null);
  assert.equal(productionAreaAccess(funder, 'ngo', null, false, false), null);
  const ngo = decideNetworkAccess({ id: 'n', role: 'ngo', org_id: 'ngo' }); assert.ok(ngo.ok);
  assert.deepEqual(productionAreaAccess(ngo, 'ngo', null, true, false), { publishedOnly: false, manage: true });
  assert.equal(productionAreaAccess(ngo, 'ngo', { manage: false, analyse: false }, true, false), null);
  assert.equal(productionAreaAccess(ngo, 'other', null, true, false), null);
  assert.deepEqual(productionAreaAccess(ngo, 'ngo', null, true, true), { publishedOnly: true, manage: false });
});
