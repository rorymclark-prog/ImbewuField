import type { PlanBed } from './crop-plan';
import type { ExpenseLog, SalesLog } from './db/types';
import type { SavedInvoice } from './invoices';
import { cashLedgerSales, invoiceSalesForPaidInvoice, reviewInvoiceRandPeriod, type InvoiceRandReview } from './invoice-sales';
import { invoiceRandConsumerEligibility } from './invoice-currency';
import { isInFinancePeriod, type FinancePeriod } from './farm-metrics';

export type GrowingEnterprise = 'vegetables' | 'staples' | 'shared' | 'other';
export interface AreaReturn { key: 'vegetables' | 'staples' | 'combined'; areaM2: number; sales: number | null; costs: number; entries: number; contributionPerM2: number | null; moneyReview: InvoiceRandReview }
const validMoney = (n: number) => Number.isFinite(n) && n >= 0;
/** Explicit record tags only. No crop-name guesses or allocation by area. */
export function buildAreaReturns(beds: PlanBed[], sales: SalesLog[], expenses: ExpenseLog[], invoices: SavedInvoice[], period: FinancePeriod, now: Date) {
  const review = (rows: SavedInvoice[]) => reviewInvoiceRandPeriod(rows, { status: 'paid', dateField: 'paidAt', inPeriod: iso => isInFinancePeriod(iso, period, now) }, invoices);
  const moneyReview = review(invoices);
  const cards: Array<Omit<AreaReturn, 'sales'> & { sales: number }> = ['vegetables', 'staples', 'combined'].map(key => ({ key: key as AreaReturn['key'], areaM2: 0, sales: 0, costs: 0, entries: 0, contributionPerM2: null, moneyReview: review([]) }));
  const seen = new Set<string>();
  for (const bed of beds) {
    if (seen.has(bed.id) || bed.id.startsWith('virtual-bed') || !Number.isFinite(bed.areaM2) || bed.areaM2 <= 0) continue;
    seen.add(bed.id); cards[bed.kind === 'plot' ? 1 : 0].areaM2 += bed.areaM2; cards[2].areaM2 += bed.areaM2;
  }
  let unassignedSales = 0, unassignedCosts = 0, unassignedEntries = 0, otherSales = 0, otherCosts = 0, sharedCosts = 0;
  function add(enterprise: GrowingEnterprise | null | undefined, value: number, isCost: boolean) {
    if (!validMoney(value)) return;
    if (enterprise === 'other') { if (isCost) otherCosts += value; else otherSales += value; return; }
    const index = enterprise === 'vegetables' ? 0 : enterprise === 'staples' ? 1 : -1;
    if (index < 0 && !(enterprise === 'shared' && isCost)) { if (isCost) unassignedCosts += value; else unassignedSales += value; unassignedEntries++; return; }
    if (index >= 0) { cards[index][isCost ? 'costs' : 'sales'] += value; cards[index].entries++; }
    else sharedCosts += value;
    cards[2][isCost ? 'costs' : 'sales'] += value; cards[2].entries++;
  }
  for (const sale of cashLedgerSales(sales, invoices.map(i => i.id))) if (isInFinancePeriod(sale.sold_at, period, now)) add(sale.enterprise, sale.amount, false);
  for (const invoice of invoices) {
    if (invoiceRandConsumerEligibility(invoice).status === 'held') continue;
    if (invoice.status !== 'paid' || !isInFinancePeriod(invoice.paidAt, period, now) || !validMoney(invoice.total)) continue;
    if (invoice.enterprise && invoice.enterprise !== 'shared') { add(invoice.enterprise, invoice.total, false); continue; }
    const lines = invoiceSalesForPaidInvoice(invoice);
    const lineTotal = lines.reduce((sum, l) => sum + l.amount, 0);
    // Discounted/otherwise inconsistent invoices cannot be allocated from larger line values.
    if (lineTotal > invoice.total + 0.01) { add(null, invoice.total, false); continue; }
    for (const line of lines) {
      const saved = sales.find(s => s.invoice_id === invoice.id && s.invoice_line === line.invoice_line);
      add(saved?.enterprise, line.amount, false);
    }
    if (invoice.total > lineTotal) add(null, invoice.total - lineTotal, false);
  }
  for (const cost of expenses) if (isInFinancePeriod(cost.spent_at, period, now)) add(cost.enterprise, cost.amount, true);
  const reviewedCards: AreaReturn[] = cards.map(card => {
    // Untagged invoice lines may belong to either mapped enterprise; do not guess their allocation.
    const cardReview = review(invoices.filter(invoice => !invoice.enterprise || invoice.enterprise === 'shared'
      || invoice.enterprise === card.key || (card.key === 'combined' && invoice.enterprise !== 'other')));
    return { ...card, moneyReview: cardReview, sales: cardReview.status === 'held' ? null : card.sales,
      contributionPerM2: cardReview.status === 'held' ? null : card.areaM2 > 0 && card.entries > 0 ? (card.sales - card.costs) / card.areaM2 : null };
  });
  return { moneyReview, cards: reviewedCards,
    unassignedSales: review(invoices.filter(invoice => !invoice.enterprise || invoice.enterprise === 'shared')).status === 'held' ? null : unassignedSales,
    unassignedCosts, unassignedEntries,
    otherSales: review(invoices.filter(invoice => invoice.enterprise === 'other')).status === 'held' ? null : otherSales,
    otherCosts, sharedCosts };
}
