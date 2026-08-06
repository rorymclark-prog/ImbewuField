import type { SavedInvoice } from './invoices';
import type { SalesLog } from './db/types';

export type InvoiceSaleDraft = Pick<
  SalesLog,
  'crop' | 'kg' | 'amount' | 'buyer' | 'sold_at' | 'invoice_id' | 'invoice_line'
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
