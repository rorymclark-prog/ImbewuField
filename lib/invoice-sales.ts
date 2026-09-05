import type { SavedInvoice } from './invoices';
import type { SalesLog } from './db/types';

export type InvoiceSaleDraft = Pick<
  SalesLog,
  'crop' | 'kg' | 'amount' | 'buyer' | 'sold_at' | 'invoice_id' | 'invoice_line' | 'enterprise'
>;

/**
 * A paid invoice becomes crop-sale evidence, one row per honest kg line.
 * Bags, crates and bunches are deliberately skipped: the app does not know
 * their weight, and inventing a kg conversion would corrupt reconciliation.
 */
export function invoiceSalesForPaidInvoice(invoice: SavedInvoice): InvoiceSaleDraft[] {
  if (invoice.status !== 'paid' || !invoice.paidAt || !Number.isFinite(Date.parse(invoice.paidAt))) {
    return [];
  }
  return invoice.items.flatMap((item, invoiceLine) => {
    if (item.unit.trim().toLocaleLowerCase('en-ZA') !== 'kg') return [];
    const crop = item.desc.trim();
    const amount = item.qty * item.price;
    if (!crop || !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(amount) || amount < 0) {
      return [];
    }
    return [{
      crop,
      kg: item.qty,
      amount,
      buyer: invoice.billTo.trim() || null,
      sold_at: invoice.paidAt!,
      invoice_id: invoice.id,
      invoice_line: invoiceLine,
      ...(invoice.enterprise ? { enterprise: invoice.enterprise } : {}),
    }];
  });
}

export function invoiceSaleDocumentId(profileId: string, invoiceId: string, invoiceLine: number): string {
  const safe = (value: string) => value.trim().replaceAll('/', '%2F').slice(0, 500);
  return `${safe(profileId)}_invoice_${safe(invoiceId)}_${Math.max(0, Math.trunc(invoiceLine))}`;
}

export function isInvoiceGeneratedSale(sale: Pick<SalesLog, 'invoice_id'>): boolean {
  return typeof sale.invoice_id === 'string' && sale.invoice_id.trim().length > 0;
}

/**
 * Cash totals count the local paid invoice when this device has it. On another
 * device, invoices are not yet cloud-synced, so retaining its linked sale rows
 * is safer than making real income disappear entirely.
 */
export function cashLedgerSales<T extends Pick<SalesLog, 'invoice_id'>>(
  sales: readonly T[],
  invoiceIdsOnThisDevice: readonly string[],
): T[] {
  const represented = new Set(invoiceIdsOnThisDevice);
  return sales.filter((sale) => !sale.invoice_id || !represented.has(sale.invoice_id));
}

/**
 * Total cash income from a set of sale rows plus a set of invoices — the one sum every screen
 * that reports "money in" should call, instead of re-deriving it.
 *
 * Summing `sales` alone both over- and under-counts once a paid invoice is in the mix: its kg
 * lines are ALSO written to sales rows by syncInvoiceSales (tagged with invoice_id), so adding
 * a paid invoice's own total on top double-counts them — while bags/crates/other non-kg lines
 * never produce a sales row at all (their weight is unknown), so an invoice paid entirely in
 * bags contributed nothing to a total built from sales rows alone. This drops the invoice-linked
 * rows (cashLedgerSales) and adds each paid invoice's full total — kg lines and non-kg lines
 * alike — back in their place, exactly once.
 *
 * Callers pre-filter both lists to the period they want (e.g. this month); this does no date
 * filtering of its own.
 */
export function cashIncomeTotal<T extends Pick<SalesLog, 'amount' | 'invoice_id'>>(
  sales: readonly T[],
  invoices: readonly Pick<SavedInvoice, 'id' | 'status' | 'total'>[],
): number {
  const cashSales = cashLedgerSales(sales, invoices.map((invoice) => invoice.id));
  const salesTotal = cashSales.reduce((sum, sale) => sum + (sale.amount ?? 0), 0);
  const paidInvoicesTotal = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);
  return salesTotal + paidInvoicesTotal;
}
