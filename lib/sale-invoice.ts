import type { SalesLog } from './db/types';
import { recordQuantity, recordUnit } from './farm-records';
import {
  invoiceId, saveInvoice, invoiceBookIsCurrent, releaseInvoiceBook,
  type InvoiceBookRead, type SavedInvoice,
} from './invoices';
import { invoiceRandConsumerEligibility } from './invoice-currency';
import { UserFacingError } from './user-facing-error';

/** The existing quick-sale forms explicitly collect rand amounts. Their loaded
 * invoice source must survive until the write; a fresh read here would adopt
 * another account for an old form handler. */
export async function saveSaleInvoice(
  row: Partial<SalesLog>,
  sync: (invoice: SavedInvoice, book: InvoiceBookRead) => Promise<void>,
  source?: InvoiceBookRead,
): Promise<SavedInvoice> {
  if (!source || !invoiceBookIsCurrent(source)) throw new UserFacingError('Reopen the current sale form before saving. Its invoice records or workspace changed.');
  if (invoiceRandConsumerEligibility(row).status === 'held') throw new UserFacingError('Keep this recorded currency separate from the rand sale book.');
  const crop = row.crop?.trim(), quantity = recordQuantity(row), unit = recordUnit(row);
  const amount = row.amount ?? NaN, dateISO = row.sold_at ?? new Date().toISOString();
  if (!crop || quantity === null || !unit || !Number.isFinite(amount) || amount < 0
    || !Number.isFinite(Date.parse(dateISO))) throw new UserFacingError('Check the produce, quantity, unit, amount and date.');
  const invoice: SavedInvoice = {
    id: invoiceId(), no: source.nextNumber, billTo: row.buyer?.trim() || 'Walk-in customer',
    currencyCode: 'ZAR', items: [{ desc: crop, qty: quantity, unit, price: amount / quantity }],
    total: amount, dateISO, status: 'paid', paidAt: dateISO,
    enterprise: row.enterprise, salesSyncPending: true,
  };
  const result = saveInvoice(invoice, source);
  if (result.status !== 'written') throw new UserFacingError(result.status === 'unconfirmed'
    ? 'A sale invoice may already be saved. Check the invoice book before recording it again.'
    : 'The sale invoice could not be confirmed. Check the retained invoice records before retrying.');
  let book = result.book;
  try {
    const stored = book.invoices.find(item => item.id === invoice.id);
    if (!stored || !invoiceBookIsCurrent(book)) throw new UserFacingError('Check the saved invoice before recording this sale again.');
    try { await sync(stored, book); }
    catch {
      if (!invoiceBookIsCurrent(book)) throw new UserFacingError('The invoice records or workspace changed. Check the saved invoice before recording this sale again.');
      // Local payment evidence stays pending. A timeout cannot cancel a queued
      // cloud write, so neither a rollback nor a second invoice is justified.
      return stored;
    }
    if (!invoiceBookIsCurrent(book)) throw new UserFacingError('The invoice records or workspace changed. Check the saved invoice before recording this sale again.');
    const confirmed = saveInvoice({ ...stored, salesSyncPending: false }, book);
    if (confirmed.status === 'unchanged') return stored;
    if (confirmed.status !== 'written') throw new UserFacingError(confirmed.status === 'unconfirmed'
      ? 'A sale confirmation may be saved. Check the existing invoice before trying again.'
      : 'The invoice is kept, but sale-book confirmation needs review. Check before trying again.');
    book = confirmed.book;
    const final = book.invoices.find(item => item.id === invoice.id);
    if (!final || !invoiceBookIsCurrent(book)) throw new UserFacingError('Reopen the saved invoice to check its sale-book confirmation.');
    return final;
  } finally { releaseInvoiceBook(book); }
}
