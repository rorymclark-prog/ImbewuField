/**
 * The invoice document, as ONE object.
 *
 * There are two renderers — the HTML card in `components/invoice/InvoiceDocument.tsx`
 * (which is also what `window.print()` puts on paper) and the jsPDF writer in
 * `lib/invoice-pdf.ts` (which is what gets WhatsApped). Before this file existed they
 * each built the document from scratch: two copies of the seller block, two copies of
 * the money formatting, two copies of the totals. That is exactly the shape of the
 * hardcoded-farm-name bug — see `tests/invoice-seller-identity.test.ts` — where one
 * path was fixed and the other kept shipping the wrong thing to real buyers.
 *
 * So neither renderer computes anything. `buildInvoiceDocument()` produces every string
 * that appears on the page, and the renderers only place them. A field that is missing
 * from this object cannot appear on either document; a field that is here and unread by
 * one renderer is caught by `tests/invoice-document.test.ts`.
 */

import type { InvoiceItem, InvoiceStatus, PaymentMethod } from './invoices';
import { paymentMethodLabel } from './invoices';

/** Where the app actually lives. `fieldproof.vercel.app` is retired and resolves nowhere. */
export const INVOICE_FOOTER = 'Generated with ImbewuField · imbewufield.vercel.app';

/**
 * Money on a document a buyer pays from.
 *
 * Always two decimals, always a plain ASCII space between thousands.
 *
 * `n.toLocaleString('en-ZA')` — which both renderers used — printed R37,5 for a
 * R37.50 line and R1 234,567 for R1 234.567. It also groups with U+00A0, which this
 * repo has already been bitten by once in report exports. `formatZar` in price-book.ts
 * is a different job: whole rand for cost ESTIMATES, where cents are noise. Here cents
 * are the amount owed.
 */
export function formatInvoiceZar(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  const cents = Math.round(Math.abs(n) * 100);
  const whole = Math.floor(cents / 100).toString();
  const frac = (cents % 100).toString().padStart(2, '0');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}R${grouped},${frac}`;
}

/**
 * Quantities are not money: 12 kg is "12", 12.5 kg is "12,5". Padding a whole
 * number to "12,00 kg" reads as a precision the farmer's scale does not have.
 */
export function formatQuantity(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 1000) / 1000;
  return Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toString().replace('.', ',');
}

function longDate(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Trim, drop blanks, and split a freeform address on newlines or commas. */
function lines(...values: (string | null | undefined)[]): string[] {
  return values
    .flatMap((value) => (value ?? '').split('\n'))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * "1 bunches × R5,00" is what shipped. The unit list is plural because that is how
 * a farmer picks it from a dropdown, but a quantity of exactly one reads as broken
 * English on the buyer's copy. Only the units the picker actually offers are
 * handled; anything else is returned untouched rather than guessed at.
 */
const SINGULAR_UNIT: Record<string, string> = {
  bags: 'bag', crates: 'crate', bunches: 'bunch', trays: 'tray',
};
export function unitLabel(qty: number, unit: string): string {
  return qty === 1 ? (SINGULAR_UNIT[unit] ?? unit) : unit;
}

export interface InvoiceParty {
  name?: string | null;
  /** Freeform, multi-line. Never geocoded, never validated — it is what the farmer typed. */
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** VAT or income-tax reference. Printed as typed; no VAT arithmetic is derived from it. */
  taxNumber?: string | null;
}

export interface InvoiceBanking {
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branchCode?: string | null;
}

export interface InvoiceDocumentInput {
  no: number;
  /** The date the invoice was ISSUED. Not "today" — a reprint must not re-date the document. */
  issuedISO: string;
  dueISO?: string | null;
  /** `farm` is the ENTERPRISE name — the trading name the buyer knows. When it is
   * set it becomes the document's heading and the person's name drops to a contact
   * line; see buildInvoiceDocument. `logo` is a data URL, already downscaled. */
  seller: InvoiceParty & { farm?: string | null; logo?: string | null };
  buyer: InvoiceParty;
  items: readonly InvoiceItem[];
  /** The buyer's own order number / reference, so they can match it in their books. */
  reference?: string | null;
  notes?: string | null;
  banking?: InvoiceBanking | null;
  status: InvoiceStatus;
  paidAt?: string | null;
  paymentMethod?: PaymentMethod | null;
}

export interface InvoiceDocumentRow {
  desc: string;
  /** e.g. "12,5 kg × R35,00" — empty when no price has been entered yet. */
  detail: string;
  amount: string;
}

export interface InvoiceDocument {
  number: string;
  issuedLabel: string;
  dueLabel: string | null;
  /** The ENTERPRISE name when the farmer has set one, otherwise their own name.
   * A business invoices as the business; "Ubhejane Creche" is what the buyer files
   * the document under, not the name of whoever happens to hold the account. */
  sellerName: string;
  /** The person's name (only when an enterprise name took the heading), then
   * address / phone / email / tax number — trimmed and blank-filtered. */
  sellerLines: string[];
  /** Data URL for the enterprise logo, or null. Null draws the app's own mark
   * instead — never a placeholder that could be mistaken for someone's brand. */
  sellerLogo: string | null;
  buyerName: string;
  buyerLines: string[];
  referenceLabel: string | null;
  rows: InvoiceDocumentRow[];
  totalLabel: string;
  /** "How to pay" block. Empty when the farmer has not entered banking details. */
  bankingLines: string[];
  notes: string | null;
  /** Set only on a paid invoice, so an unpaid document can never look settled. */
  paidStamp: string | null;
  footer: string;
}

export function buildInvoiceDocument(input: InvoiceDocumentInput): InvoiceDocument {
  const items = input.items.filter((item) => item.desc.trim().length > 0);
  const total = items.reduce((sum, item) => sum + item.qty * item.price, 0);

  const rows: InvoiceDocumentRow[] = items.map((item) => ({
    desc: item.desc.trim(),
    detail: item.price > 0
      ? `${formatQuantity(item.qty)} ${unitLabel(item.qty, item.unit)} × ${formatInvoiceZar(item.price)}`
      : `${formatQuantity(item.qty)} ${unitLabel(item.qty, item.unit)}`,
    amount: formatInvoiceZar(item.qty * item.price),
  }));

  const banking = input.banking ?? {};
  const bankingLines = lines(
    banking.accountName,
    banking.bankName,
    banking.accountNumber ? `Account ${banking.accountNumber.trim()}` : null,
    banking.branchCode ? `Branch code ${banking.branchCode.trim()}` : null,
  );

  // Who the document is FROM. A farmer trading as "Ubhejane Creche" is owed an
  // invoice that says so: the enterprise name leads, and their own name moves to a
  // contact line underneath. With no enterprise set, nothing is invented — the
  // person's name leads exactly as it always has.
  const sellerPerson = (input.seller.name ?? '').trim();
  const sellerEnterprise = (input.seller.farm ?? '').trim();
  const sellerHeading = sellerEnterprise || sellerPerson;

  const logo = (input.seller.logo ?? '').trim();

  const paidOn = input.status === 'paid' && input.paidAt ? shortDate(input.paidAt) : null;
  const paidStamp = input.status === 'paid'
    ? ['Paid', paidOn, input.paymentMethod ? paymentMethodLabel(input.paymentMethod) : null]
      .filter((part): part is string => Boolean(part))
      .join(' · ')
    : null;

  return {
    number: `#${String(Math.max(1, Math.trunc(input.no))).padStart(4, '0')}`,
    // An unparseable issue date is a bug upstream, not something to paper over with today's
    // date — a wrong date on an invoice is worse than a visibly missing one.
    issuedLabel: longDate(input.issuedISO) ?? '—',
    dueLabel: input.dueISO ? longDate(input.dueISO) : null,
    sellerName: sellerHeading,
    sellerLines: lines(
      // When the enterprise took the heading, the person becomes a contact line.
      // When it did not, the person IS the heading and must not be repeated here.
      sellerEnterprise ? sellerPerson : null,
      input.seller.address,
      input.seller.phone,
      input.seller.email,
      input.seller.taxNumber ? `VAT/Tax no. ${input.seller.taxNumber.trim()}` : null,
    ),
    buyerName: (input.buyer.name ?? '').trim(),
    buyerLines: lines(
      input.buyer.address,
      input.buyer.phone,
      input.buyer.email,
      input.buyer.taxNumber ? `VAT/Tax no. ${input.buyer.taxNumber.trim()}` : null,
    ),
    referenceLabel: input.reference?.trim() ? input.reference.trim() : null,
    rows,
    totalLabel: formatInvoiceZar(total),
    bankingLines,
    notes: input.notes?.trim() ? input.notes.trim() : null,
    paidStamp,
    // Only a real image payload counts. A stray non-image string would otherwise
    // render as a broken-image icon on a document a buyer keeps.
    sellerLogo: logo.startsWith('data:image/') ? logo : null,
    footer: INVOICE_FOOTER,
  };
}
