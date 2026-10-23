import type { SavedInvoice } from './invoices';
import type { SalesLog } from './db/types';
import { normaliseRecordUnit, recordQuantityPayload, validRecordQuantity } from './farm-records';

export type InvoiceSaleDraft = Pick<
  SalesLog,
  'crop' | 'kg' | 'quantity' | 'unit' | 'amount' | 'buyer' | 'sold_at' | 'invoice_id' | 'invoice_line' | 'enterprise'
>;

/**
 * A paid invoice becomes sale evidence in the unit actually sold. Unknown
 * custom service units remain cash evidence without invented produce quantities.
 */
export function invoiceSalesForPaidInvoice(invoice: SavedInvoice): InvoiceSaleDraft[] {
  if (invoice.status !== 'paid' || !invoice.paidAt || !Number.isFinite(Date.parse(invoice.paidAt))) {
    return [];
  }
  return invoice.items.flatMap((item, invoiceLine) => {
    const unit = normaliseRecordUnit(item.unit);
    if (!unit || !validRecordQuantity(item.qty, unit)) return [];
    const crop = item.desc.trim();
    const amount = item.qty * item.price;
    if (!crop || !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(amount) || amount < 0) {
      return [];
    }
    return [{
      crop,
      ...(unit === 'kg' ? { kg: item.qty } : recordQuantityPayload(item.qty, unit)),
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
 * A paid invoice's produce lines also appear as linked sales rows. Keeping
 * both would duplicate income. Unknown custom units may have no sales row at
 * all, so the invoice's complete paid total remains the cash authority. Linked
 * rows are replaced by that total exactly once, regardless of produce unit.
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
