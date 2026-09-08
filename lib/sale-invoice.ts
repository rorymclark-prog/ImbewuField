import { activeAccountLocalStorageKey } from './account-local-storage';
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
  const scope = activeAccountLocalStorageKey('imbewu_invoices');
  const sample = typeof window !== 'undefined' && window.sessionStorage.getItem('imbewu_sample_mode') === '1';
  const sameAccount = () => activeAccountLocalStorageKey('imbewu_invoices') === scope
    && (typeof window !== 'undefined' && window.sessionStorage.getItem('imbewu_sample_mode') === '1') === sample;
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
  } catch {
    if (!sameAccount()) throw Error('Your account changed. Reopen the sale in its original workspace.');
    // A retry must use THIS invoice's deterministic sale IDs, never create a second cash sale.
    // The saved invoice remains visible in the money book while its cloud rows need attention.
    return stored;
  }
  // Completion belongs to the workspace that began the sale, including sample sessions.
  if (!sameAccount()) throw Error('Your account changed. Reopen the sale in its original workspace.');
  return saveInvoice({ ...stored, salesSyncPending: false }).find(item => item.id === stored.id) ?? stored;
}
