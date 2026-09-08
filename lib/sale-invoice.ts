import type { SalesLog } from './db/types';
import { invoiceId, loadNextInvoiceNumber, saveInvoice, saveNextInvoiceNumber, type SavedInvoice } from './invoices';

/** A quick cash sale uses the same invoice ledger as the full invoice editor. */
export async function saveSaleInvoice(
  row: Partial<SalesLog>,
  sync: (invoice: SavedInvoice) => Promise<void>,
): Promise<SavedInvoice> {
  const crop = row.crop?.trim();
  const kg = row.kg ?? NaN;
  const amount = row.amount ?? NaN;
  const dateISO = row.sold_at ?? new Date().toISOString();
  if (!crop || !Number.isFinite(kg) || kg <= 0 || !Number.isFinite(amount) || amount < 0
    || !Number.isFinite(Date.parse(dateISO))) throw Error('Check the crop, kilograms, amount and date.');
  const invoice: SavedInvoice = {
    id: invoiceId(), no: loadNextInvoiceNumber(), billTo: row.buyer?.trim() || 'Walk-in customer',
    items: [{ desc: crop, qty: kg, unit: 'kg', price: amount / kg }],
    total: amount, dateISO, status: 'paid', paidAt: dateISO,
    enterprise: row.enterprise, salesSyncPending: true,
  };
  const stored = saveInvoice(invoice).find(item => item.id === invoice.id);
  if (!stored) throw Error('The invoice could not be saved. Check device storage and try again.');
  // The next-number reader also checks saved invoices, so a failed counter write cannot reuse it.
  saveNextInvoiceNumber(stored.no + 1);
  try {
    await sync(stored);
    return saveInvoice({ ...stored, salesSyncPending: false }).find(item => item.id === stored.id) ?? stored;
  } catch {
    // A retry must use THIS invoice's deterministic sale IDs, never create a second cash sale.
    // The saved invoice remains visible in the money book while its cloud rows need attention.
    return stored;
  }
}
