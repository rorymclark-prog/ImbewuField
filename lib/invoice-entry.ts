import type { SalesLog } from './db/types';
import type { SavedInvoice } from './invoices';

export type InvoiceEntryKind = 'new' | 'past-sale' | 'paper-copy';

export function invoiceDateInput(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Keep an existing timestamp when only its calendar date is being displayed or confirmed. */
export function invoiceDateFromInput(value: string, previousISO?: string): string | null {
  if (previousISO && invoiceDateInput(previousISO) === value) return previousISO;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (!Number.isFinite(date.getTime())) return null;
  return invoiceDateInput(date.toISOString()) === value ? date.toISOString() : null;
}

export function invoiceEntryError(invoice: Pick<SavedInvoice, 'entryKind' | 'paperReference' | 'dateISO' | 'status' | 'paidAt'>, now = new Date()): string | null {
  const today = invoiceDateInput(now.toISOString());
  const issued = invoiceDateInput(invoice.dateISO);
  if (!issued || issued > today) return 'Choose the actual invoice issue date, up to today.';
  if (invoice.entryKind === 'paper-copy' && !invoice.paperReference?.trim()) return 'Enter the original paper invoice number or reference.';
  if (invoice.status === 'paid') {
    const paid = invoice.paidAt ? invoiceDateInput(invoice.paidAt) : '';
    if (!paid || paid > today) return 'Choose the date the payment was received, up to today.';
  }
  return null;
}

/** A stable ID chooses the sale; exact recorded fields then guard against changing that sale.
 * No search by similar crop, date or amount can authorise a link. */
export function recordedSaleInvoiceError(invoice: SavedInvoice, sale: SalesLog, ownerId: string): string | null {
  if (!ownerId || sale.profile_id !== ownerId || invoice.sourceSaleId !== sale.id || !sale.id || sale.id.includes('/')) return 'This sale is not available in your records.';
  if (sale.invoice_id && sale.invoice_id !== invoice.id) return 'This sale already belongs to another invoice.';
  if ((invoice.enterprise || undefined) !== (sale.enterprise || undefined)) return 'Keep the recorded growing area for this sale.';
  if (invoice.status !== 'paid' || !invoice.paidAt || Date.parse(invoice.paidAt) !== Date.parse(sale.sold_at)) return 'Keep the recorded payment date and paid status for this sale.';
  const item = invoice.items[0];
  if (invoice.items.length !== 1 || !item || item.unit.trim().toLowerCase() !== 'kg'
    || item.desc.trim() !== sale.crop.trim() || !Number.isFinite(sale.kg) || !(sale.kg! > 0)
    || item.qty !== sale.kg || !Number.isFinite(sale.amount) || sale.amount < 0
    || Math.round(item.qty * item.price * 100) !== Math.round(sale.amount * 100)
    || Math.round(invoice.total * 100) !== Math.round(sale.amount * 100)) return 'Keep the recorded crop, kilograms and total when documenting this sale.';
  return null;
}
