import { invoiceReadCoverage, type SavedInvoice } from './invoices';
import type { SalesLog } from './db/types';
import { normaliseRecordUnit, recordQuantityPayload, validRecordQuantity } from './farm-records';
import { invoiceRandConsumerEligibility } from './invoice-currency';

export interface InvoiceRandReview {
  status: 'ready' | 'held';
  foreignRecordedCount: number;
  unreadableCurrencyCount: number;
  undatedHeldCount: number;
  hiddenRowCount: number;
  wholeBookUnavailable: boolean;
  dateCoverageUnknown: boolean;
}
// Counts merge across overlapping windows without publishing invoice identities.
type CollectionGap = { hiddenRows: number; wholeBookUnavailable: boolean };
const reviewSources = new WeakMap<InvoiceRandReview, { held: Map<unknown, boolean>; undated: unknown[];
  collections: Map<readonly unknown[], CollectionGap>; untracked?: InvoiceRandReview }>();
function emptyReview(): InvoiceRandReview {
  return { status: 'ready', foreignRecordedCount: 0, unreadableCurrencyCount: 0, undatedHeldCount: 0,
    hiddenRowCount: 0, wholeBookUnavailable: false, dateCoverageUnknown: false };
}

/** Collection evidence precedes payment/date filters: a hidden row cannot prove
 * that it is unpaid or outside the selected period. No placeholder invoice is made. */
export function reviewInvoiceReadCoverage(invoices: readonly unknown[]): InvoiceRandReview {
  const review = emptyReview(), collections = new Map<readonly unknown[], CollectionGap>();
  const coverage = invoiceReadCoverage(invoices);
  if (coverage.status === 'held') {
    review.status = 'held'; review.hiddenRowCount = coverage.hiddenRows;
    review.wholeBookUnavailable = coverage.hiddenRows === 0; review.dateCoverageUnknown = true;
    collections.set(invoices, { hiddenRows: coverage.hiddenRows, wholeBookUnavailable: review.wholeBookUnavailable });
  }
  reviewSources.set(review, { held: new Map(), undated: [], collections });
  return review;
}

export function reviewInvoiceRandBasis(invoices: readonly unknown[], originalCollection: readonly unknown[] = invoices): InvoiceRandReview {
  const review = mergeInvoiceRandReviews(reviewInvoiceReadCoverage(invoices), reviewInvoiceReadCoverage(originalCollection));
  let foreignRecordedCount = 0, unreadableCurrencyCount = 0;
  const held = new Map<unknown, boolean>();
  for (const invoice of invoices) {
    const result = invoiceRandConsumerEligibility(invoice);
    if (result.status !== 'held') continue;
    held.set(invoice, result.reason === 'foreign-recorded-currency');
    if (result.reason === 'foreign-recorded-currency') foreignRecordedCount++;
    else unreadableCurrencyCount++;
  }
  review.foreignRecordedCount = foreignRecordedCount; review.unreadableCurrencyCount = unreadableCurrencyCount;
  if (foreignRecordedCount || unreadableCurrencyCount) review.status = 'held';
  reviewSources.get(review)!.held = held;
  return review;
}

export function mergeInvoiceRandReviews(...reviews: readonly InvoiceRandReview[]): InvoiceRandReview {
  const sources = reviews.map(review => reviewSources.get(review));
  const held = new Map<unknown, boolean>();
  for (const source of sources) for (const [invoice, foreign] of source?.held ?? []) {
    held.set(invoice, held.has(invoice) ? held.get(invoice)! && foreign : foreign);
  }
  const undated = [...new Set(sources.flatMap(source => source?.undated ?? []))];
  const collections = new Map<readonly unknown[], CollectionGap>();
  for (const source of sources) for (const [collection, gap] of source?.collections ?? []) {
    const previous = collections.get(collection);
    collections.set(collection, { hiddenRows: Math.max(previous?.hiddenRows ?? 0, gap.hiddenRows),
      wholeBookUnavailable: Boolean(previous?.wholeBookUnavailable || gap.wholeBookUnavailable) });
  }
  const result = emptyReview();
  result.foreignRecordedCount = [...held.values()].filter(Boolean).length;
  result.unreadableCurrencyCount = held.size - result.foreignRecordedCount;
  result.status = held.size || collections.size ? 'held' : 'ready';
  result.undatedHeldCount = undated.length;
  result.hiddenRowCount = [...collections.values()].reduce((sum, gap) => sum + gap.hiddenRows, 0);
  result.wholeBookUnavailable = [...collections.values()].some(gap => gap.wholeBookUnavailable);
  result.dateCoverageUnknown = collections.size > 0;
  const untracked = emptyReview();
  reviews.forEach((review, index) => {
    const external = sources[index]?.untracked ?? (sources[index] ? null : review);
    if (!external) return;
    if (external.status === 'held') { result.status = 'held'; untracked.status = 'held'; }
    for (const key of ['foreignRecordedCount', 'unreadableCurrencyCount', 'undatedHeldCount', 'hiddenRowCount'] as const) {
      result[key] += external[key]; untracked[key] += external[key];
    }
    for (const key of ['wholeBookUnavailable', 'dateCoverageUnknown'] as const) {
      result[key] ||= external[key]; untracked[key] ||= external[key];
    }
  });
  reviewSources.set(result, { held, undated, collections, untracked });
  return result;
}

export function reviewInvoiceRandPeriod(invoices: readonly { status: SavedInvoice['status']; paidAt?: string; dateISO?: string }[], options: {
  status: 'paid' | 'unpaid'; dateField: 'paidAt' | 'dateISO'; inPeriod: (iso: string) => boolean;
}, originalCollection: readonly unknown[] = invoices): InvoiceRandReview {
  const collectionReview = mergeInvoiceRandReviews(reviewInvoiceReadCoverage(invoices), reviewInvoiceReadCoverage(originalCollection));
  const undated: unknown[] = [];
  const relevant = invoices.filter(invoice => {
    if (invoice.status !== options.status) return false;
    const date = invoice[options.dateField];
    if (typeof date === 'string' && Number.isFinite(Date.parse(date))) return options.inPeriod(date);
    // An unreadable payment date cannot prove this held invoice is outside the window.
    if (invoiceRandConsumerEligibility(invoice).status === 'held') { undated.push(invoice); return true; }
    return false;
  });
  const review = mergeInvoiceRandReviews(reviewInvoiceRandBasis(relevant), collectionReview);
  review.undatedHeldCount = undated.length;
  reviewSources.get(review)!.undated = undated;
  return review;
}

export function invoiceRandReviewMessage(review: InvoiceRandReview): string | null {
  if (review.status === 'ready') return null;
  const sourceGap = `${review.hiddenRowCount ? ` ${review.hiddenRowCount} unreadable invoice row(s) remain outside the displayed list.` : ''}${review.wholeBookUnavailable ? ' The invoice book could not be fully read or confirmed.' : ''}${review.dateCoverageUnknown ? ' The payment status and period of unreadable source evidence are unknown.' : ''}`;
  const currencies = review.foreignRecordedCount || review.unreadableCurrencyCount
    ? ` ${review.foreignRecordedCount} invoice(s) record another currency and ${review.unreadableCurrencyCount} have an unreadable currency.` : '';
  return `Rand income and related results are unavailable.${sourceGap}${currencies}${review.undatedHeldCount ? ` ${review.undatedHeldCount} also lack a usable date, so their period cannot be established.` : ''} No exchange conversion is assumed. Recorded produce quantities remain separate.`;
}

export type InvoiceSaleDraft = Pick<
  SalesLog,
  'crop' | 'kg' | 'quantity' | 'unit' | 'amount' | 'buyer' | 'sold_at' | 'invoice_id' | 'invoice_line' | 'enterprise'
>;

/**
 * A paid invoice becomes sale evidence in the unit actually sold. Unknown
 * custom service units remain cash evidence without invented produce quantities.
 */
export function invoiceSalesForPaidInvoice(invoice: SavedInvoice): InvoiceSaleDraft[] {
  // Cloud callers must preflight before querying/deleting: an empty draft list is not a write receipt.
  if (invoiceRandConsumerEligibility(invoice).status === 'held') return [];
  return paidInvoiceLines(invoice);
}

export type InvoiceQuantityObservation = Omit<InvoiceSaleDraft, 'amount'>;
export function invoiceQuantitiesForPaidInvoice(invoice: SavedInvoice): InvoiceQuantityObservation[] {
  return paidInvoiceLines(invoice).map(({ amount: _amount, ...quantity }) => quantity);
}

function paidInvoiceLines(invoice: SavedInvoice): InvoiceSaleDraft[] {
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
  originalCollection: readonly unknown[] = invoices,
): number | null {
  if (mergeInvoiceRandReviews(reviewInvoiceReadCoverage(invoices), reviewInvoiceReadCoverage(originalCollection)).status === 'held') return null;
  if (reviewInvoiceRandBasis(invoices.filter(invoice => invoice.status === 'paid'), originalCollection).status === 'held') return null;
  const cashSales = cashLedgerSales(sales, invoices.map((invoice) => invoice.id));
  const salesTotal = cashSales.reduce((sum, sale) => sum + (sale.amount ?? 0), 0);
  const paidInvoicesTotal = invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);
  return salesTotal + paidInvoicesTotal;
}
