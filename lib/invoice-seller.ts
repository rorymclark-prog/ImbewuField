/**
 * The parts of an invoice letterhead that the profile does not hold.
 *
 * ONE HOME PER FIELD, deliberately. The seller's name, phone and farm name already live on
 * the signed-in Profile and are edited in /account; this store does NOT duplicate them, because
 * two places holding the same answer is how this repo produced `--border`, the baseMap/references
 * split, and four competing `:root` blocks. What lives here is only what the Profile has no field
 * for: a postal address, an email, a tax reference, banking details and default payment terms.
 *
 * Local, like the invoices themselves. Invoices are already localStorage-only and offline-first,
 * so putting the letterhead in Firestore would make half the document sync and half not — and
 * would put bank account numbers into a synced collection, which is a security decision this
 * change is not the right place to make.
 */

import { activeAccountLocalStorageKey } from './account-local-storage';
import { isSampleMode, getSandboxLetterhead, setSandboxLetterhead } from './sample-mode';

export interface SellerLetterhead {
  address: string;
  email: string;
  /** VAT or income-tax reference, printed as typed. No VAT is ever calculated from it — see below. */
  taxNumber: string;
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranchCode: string;
  /**
   * Days until payment is due, or null for no due date.
   *
   * Null by default and null when unset. A default of "30 days" would be a payment term the
   * farmer never agreed with their buyer, printed on a document the buyer relies on.
   */
  paymentTermsDays: number | null;
  /** Standing note printed under the total — delivery terms, thanks, collection instructions. */
  notes: string;
}

export const EMPTY_LETTERHEAD: SellerLetterhead = {
  address: '', email: '', taxNumber: '',
  bankName: '', bankAccountName: '', bankAccountNumber: '', bankBranchCode: '',
  paymentTermsDays: null, notes: '',
};

const KEY = 'imbewu_invoice_letterhead';

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function cleanLetterhead(row: unknown): SellerLetterhead {
  if (!row || typeof row !== 'object') return { ...EMPTY_LETTERHEAD };
  const raw = row as Partial<Record<keyof SellerLetterhead, unknown>>;
  const days = Number(raw.paymentTermsDays);
  return {
    address: text(raw.address),
    email: text(raw.email),
    taxNumber: text(raw.taxNumber),
    bankName: text(raw.bankName),
    bankAccountName: text(raw.bankAccountName),
    bankAccountNumber: text(raw.bankAccountNumber),
    bankBranchCode: text(raw.bankBranchCode),
    // A negative or fractional term would produce a due date before the issue date.
    paymentTermsDays: Number.isSafeInteger(days) && days >= 0 && days <= 365 ? days : null,
    notes: text(raw.notes),
  };
}

export function loadLetterhead(): SellerLetterhead {
  if (typeof window === 'undefined') return { ...EMPTY_LETTERHEAD };
  if (isSampleMode()) return cleanLetterhead(getSandboxLetterhead());
  try {
    return cleanLetterhead(JSON.parse(localStorage.getItem(activeAccountLocalStorageKey(KEY)) ?? 'null'));
  } catch {
    return { ...EMPTY_LETTERHEAD };
  }
}

export function saveLetterhead(value: SellerLetterhead): boolean {
  if (typeof window === 'undefined') return false;
  const clean = cleanLetterhead(value);
  // The sample sandbox is in-memory and never reaches disk, so an evaluator can type into the
  // demo letterhead without leaving their own bank details on a shared device.
  if (isSampleMode()) {
    setSandboxLetterhead(clean);
    return true;
  }
  try {
    localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(clean));
    return true;
  } catch {
    return false;
  }
}

/** True once there is anything worth printing, so an untouched letterhead adds no empty blocks. */
export function hasLetterhead(value: SellerLetterhead): boolean {
  return Boolean(
    value.address || value.email || value.taxNumber
    || value.bankName || value.bankAccountName || value.bankAccountNumber || value.bankBranchCode
    || value.notes,
  );
}

/** The due date implied by the terms, or null when no term is set. */
export function dueDateISO(issuedISO: string, paymentTermsDays: number | null): string | null {
  if (paymentTermsDays === null) return null;
  const issued = Date.parse(issuedISO);
  if (!Number.isFinite(issued)) return null;
  return new Date(issued + paymentTermsDays * 86_400_000).toISOString();
}
