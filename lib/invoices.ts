// Local persistence for the invoice tool: remembered customers, item presets,
// and past invoices the farmer can call up and reprint. localStorage-backed
// (offline-first, same as the rest of the app).

import {
  isSampleMode,
  getSandboxCustomers, setSandboxCustomers,
  getSandboxProducts, setSandboxProducts,
  getSandboxInvoices, setSandboxInvoices,
} from './sample-mode';
import { activeAccountLocalStorageKey } from './account-local-storage';

export interface InvoiceItem { desc: string; qty: number; unit: string; price: number }
export interface Product { desc: string; unit: string; price: number }
export type InvoiceStatus = 'unpaid' | 'paid';
export type PaymentMethod = 'cash' | 'eft' | 'card' | 'mobile' | 'other';
/**
 * A remembered buyer.
 *
 * Was a bare `string[]` of names, which is why "Bill to" printed a name and nothing else — the
 * app had nowhere to put an address even if the farmer typed one. Legacy string rows are
 * upconverted on read (see cleanCustomers), so an existing customer list survives the change.
 */
export interface Customer {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export type CustomerDetails = Pick<Customer, 'address' | 'phone' | 'email'>;

export interface SavedInvoice {
  enterprise?: import('./area-returns').GrowingEnterprise | null;
  id: string;
  no: number;
  billTo: string;
  /**
   * The buyer's contact details AS THEY WERE WHEN THIS INVOICE WAS ISSUED.
   *
   * Snapshotted, not looked up. A customer who moves must not silently rewrite the address on an
   * invoice they were sent last year — the buyer is holding a paper copy, and the two have to
   * agree.
   */
  billToDetails?: CustomerDetails;
  items: InvoiceItem[];
  total: number;
  /** The date the invoice was ISSUED. Set once; never moved by a later edit or a reprint. */
  dateISO: string;
  dueDateISO?: string;
  /** The buyer's own order number, so they can match this against their books. */
  reference?: string;
  /** Note printed under the total on this invoice. */
  notes?: string;
  status: InvoiceStatus;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', eft: 'EFT', card: 'Card', mobile: 'Mobile', other: 'Other',
};
export function paymentMethodLabel(m: PaymentMethod): string {
  const method = cleanPaymentMethod(m);
  return method ? PAYMENT_METHOD_LABELS[method] : PAYMENT_METHOD_LABELS.other;
}

const C_KEY = 'imbewu_invoice_customers';
const P_KEY = 'imbewu_invoice_products';
const I_KEY = 'imbewu_invoices';
const SEQ_KEY = 'imbewu_invoice_seq';

function read<T>(baseKey: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(
      localStorage.getItem(activeAccountLocalStorageKey(baseKey)) ?? '[]',
    );
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function write<T>(baseKey: string, v: T[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(
      activeAccountLocalStorageKey(baseKey),
      JSON.stringify(v),
    );
    return true;
  } catch {
    return false;
  }
}
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-invoices-changed'));
}

// Sample-mode-aware read/write per key — the only thing that changes vs the
// real read<T>/write<T> above is where the data actually lives.
function optionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text : undefined;
}

/** Drops the key entirely when every field is blank, so an empty object never reaches storage. */
export function cleanCustomerDetails(row: unknown): CustomerDetails | undefined {
  if (!row || typeof row !== 'object') return undefined;
  const raw = row as Partial<Customer>;
  const details: CustomerDetails = {};
  const address = optionalText(raw.address);
  const phone = optionalText(raw.phone);
  const email = optionalText(raw.email);
  if (address) details.address = address;
  if (phone) details.phone = phone;
  if (email) details.email = email;
  return address || phone || email ? details : undefined;
}

/**
 * Accepts both shapes. Rows written before buyers had contact details are bare strings; reading
 * them as `{ name }` upgrades a farmer's existing customer list in place, rather than silently
 * discarding every customer they have ever invoiced the first time they open the new build.
 */
function cleanCustomers(rows: unknown[]): Customer[] {
  const seen = new Set<string>();
  const clean: Customer[] = [];
  for (const row of rows) {
    const source = typeof row === 'string' ? { name: row } : row;
    if (!source || typeof source !== 'object') continue;
    const name = optionalText((source as Partial<Customer>).name);
    if (!name) continue;
    const key = name.toLocaleLowerCase('en-ZA');
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ name, ...cleanCustomerDetails(source) });
  }
  return clean;
}

function cleanProduct(row: unknown): Product | null {
  if (!row || typeof row !== 'object') return null;
  const product = row as Partial<Product>;
  if (typeof product.desc !== 'string' || typeof product.unit !== 'string') return null;
  const desc = product.desc.trim();
  const unit = product.unit.trim();
  if (!desc || !unit || !Number.isFinite(product.price) || product.price! < 0) return null;
  return { desc, unit, price: product.price! };
}

function cleanPaymentMethod(value: unknown): PaymentMethod | undefined {
  return typeof value === 'string' && Object.hasOwn(PAYMENT_METHOD_LABELS, value)
    ? value as PaymentMethod
    : undefined;
}

function cleanProducts(rows: unknown[]): Product[] {
  const seen = new Set<string>();
  const clean: Product[] = [];
  for (const row of rows) {
    const product = cleanProduct(row);
    if (!product) continue;
    const key = product.desc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(product);
  }
  return clean;
}

function cleanItem(row: unknown): InvoiceItem | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Partial<InvoiceItem>;
  if (typeof item.desc !== 'string' || typeof item.unit !== 'string') return null;
  const desc = item.desc.trim();
  const unit = item.unit.trim();
  if (
    !desc
    || !unit
    || !Number.isFinite(item.qty)
    || item.qty! <= 0
    || !Number.isFinite(item.price)
    || item.price! < 0
    || !Number.isFinite(item.qty! * item.price!)
  ) return null;
  return { desc, qty: item.qty!, unit, price: item.price! };
}

function cleanInvoice(row: unknown): SavedInvoice | null {
  if (!row || typeof row !== 'object') return null;
  const invoice = row as Partial<SavedInvoice>;
  if (
    typeof invoice.id !== 'string'
    || !invoice.id.trim()
    || !Number.isSafeInteger(invoice.no)
    || invoice.no! <= 0
    || typeof invoice.billTo !== 'string'
    || !invoice.billTo.trim()
    || typeof invoice.dateISO !== 'string'
    || !Number.isFinite(Date.parse(invoice.dateISO))
    || !Array.isArray(invoice.items)
    || invoice.items.length === 0
  ) return null;
  const items = invoice.items.map(cleanItem);
  // Dropping one bad line would silently reduce what a customer owes. Reject
  // the whole record instead; callers keep the last valid saved copy.
  if (items.some((item) => item === null)) return null;
  const validItems = items as InvoiceItem[];
  const total = validItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  if (!Number.isFinite(total)) return null;
  const paidAt = typeof invoice.paidAt === 'string' && Number.isFinite(Date.parse(invoice.paidAt))
    ? invoice.paidAt
    : undefined;
  // A paid flag without a usable payment time produces contradictory ledgers: the summary omits
  // it while period rows fall back to invoice date. Treat unverifiable payment as unpaid.
  const status: InvoiceStatus = invoice.status === 'paid' && paidAt ? 'paid' : 'unpaid';
  const paymentMethod = cleanPaymentMethod(invoice.paymentMethod);
  // A due date that lands before the issue date is not a term any buyer agreed to; it is a bad
  // record. Drop it rather than print "due 3 days ago" on a freshly issued invoice.
  const dueDateISO = typeof invoice.dueDateISO === 'string'
    && Number.isFinite(Date.parse(invoice.dueDateISO))
    && Date.parse(invoice.dueDateISO) >= Date.parse(invoice.dateISO)
    ? invoice.dueDateISO
    : undefined;
  return {
    enterprise: ['vegetables', 'staples', 'other'].includes(String(invoice.enterprise)) ? invoice.enterprise : undefined,
    id: invoice.id.trim(),
    no: invoice.no!,
    billTo: invoice.billTo.trim(),
    billToDetails: cleanCustomerDetails(invoice.billToDetails),
    items: validItems,
    total,
    dateISO: invoice.dateISO,
    dueDateISO,
    reference: optionalText(invoice.reference),
    notes: optionalText(invoice.notes),
    status,
    paidAt: status === 'paid' ? paidAt : undefined,
    paymentMethod: status === 'paid' ? paymentMethod : undefined,
  };
}

function cleanInvoices(rows: unknown[]): SavedInvoice[] {
  const seen = new Set<string>();
  const clean: SavedInvoice[] = [];
  for (const row of rows) {
    const invoice = cleanInvoice(row);
    if (!invoice || seen.has(invoice.id)) continue;
    seen.add(invoice.id);
    clean.push(invoice);
  }
  return clean;
}

function readCustomers(): Customer[] {
  return cleanCustomers(isSampleMode() ? getSandboxCustomers() : read<unknown>(C_KEY));
}
function writeCustomers(v: Customer[]): boolean {
  if (isSampleMode()) {
    setSandboxCustomers(v);
    return true;
  }
  return write(C_KEY, v);
}
function readProducts(): Product[] {
  return cleanProducts(isSampleMode() ? getSandboxProducts() : read<unknown>(P_KEY));
}
function writeProducts(v: Product[]): boolean {
  if (isSampleMode()) {
    setSandboxProducts(v);
    return true;
  }
  return write(P_KEY, v);
}
function readInvoicesRaw(): SavedInvoice[] {
  return cleanInvoices(isSampleMode() ? getSandboxInvoices() : read<unknown>(I_KEY));
}
function writeInvoices(v: SavedInvoice[]): boolean {
  if (isSampleMode()) {
    setSandboxInvoices(v);
    return true;
  }
  return write(I_KEY, v);
}

/* ── Customers ──────────────────────────────── */
export function loadCustomers(): Customer[] { return readCustomers(); }

/**
 * Remember a buyer, merging rather than replacing.
 *
 * `details` is what the farmer typed on THIS invoice. Fields they left blank keep whatever the
 * customer record already had — issuing a quick invoice with only a name must not wipe the
 * address captured last month.
 */
export function addCustomer(name: string, details?: CustomerDetails) {
  const n = name.trim();
  if (!n) return;
  const key = n.toLocaleLowerCase('en-ZA');
  const list = loadCustomers();
  const existing = list.find((c) => c.name.toLocaleLowerCase('en-ZA') === key);
  const merged: Customer = {
    name: n,
    ...cleanCustomerDetails({ ...existing, ...cleanCustomerDetails(details) }),
  };
  const rest = list.filter((c) => c.name.toLocaleLowerCase('en-ZA') !== key);
  if (writeCustomers([merged, ...rest].slice(0, 100))) notify();
}

export function findCustomer(list: readonly Customer[], name: string): Customer | undefined {
  const key = name.trim().toLocaleLowerCase('en-ZA');
  return key ? list.find((c) => c.name.toLocaleLowerCase('en-ZA') === key) : undefined;
}

/* ── Item / product presets ─────────────────── */
export function loadProducts(): Product[] { return readProducts(); }
export function addProduct(p: Product) {
  const product = cleanProduct(p);
  if (!product) return;
  const list = loadProducts().filter((x) => x.desc.toLowerCase() !== product.desc.toLowerCase());
  if (writeProducts([product, ...list].slice(0, 200))) notify();
}

/* ── Saved invoices ─────────────────────────── */
// Old records predate `status`; cleanInvoice defaults them to unpaid while
// validating the accounting fields at the persistence boundary.
export function loadInvoices(): SavedInvoice[] { return readInvoicesRaw(); }
export function saveInvoice(inv: SavedInvoice): SavedInvoice[] {
  const before = loadInvoices();
  const candidateId = typeof inv.id === 'string' ? inv.id.trim() : '';
  const previous = before.find((row) => row.id === candidateId);
  // Editing invoice lines is not a payment action. Forms that do not expose payment fields may
  // omit them, but must not erase evidence already attached to a paid invoice.
  const withPayment = previous?.status === 'paid' && inv.status === 'paid'
    ? {
      ...inv,
      paidAt: inv.paidAt ?? previous.paidAt,
      paymentMethod: cleanPaymentMethod(inv.paymentMethod) ?? previous.paymentMethod,
    }
    : inv;
  // An invoice is dated the day it was ISSUED. Every save used to stamp `new Date()`, so simply
  // opening #0044 to fix a typo — or marking it paid — moved its date to today, and the buyer's
  // printed copy and the farmer's ledger stopped agreeing about when the debt arose. The issue
  // date is written once, by the save that created the record.
  const candidate = previous
    ? { ...withPayment, dateISO: previous.dateISO }
    : withPayment;
  const clean = cleanInvoice(candidate);
  if (!clean) return before;
  const list = before.filter((x) => x.id !== clean.id);
  // Invoices are accounting history, not a recent-items convenience list. Never evict an older
  // invoice merely because another was saved; if device quota is exhausted, preserve the entire
  // prior ledger and report that durable state to the caller.
  const updated = [clean, ...list];
  if (!writeInvoices(updated)) return before;
  notify();
  return updated;
}
export function deleteInvoice(id: string): SavedInvoice[] {
  const before = loadInvoices();
  const cleanId = typeof id === 'string' ? id.trim() : '';
  if (!cleanId) return before;
  const updated = before.filter((x) => x.id !== cleanId);
  if (updated.length === before.length || !writeInvoices(updated)) return before;
  notify();
  return updated;
}
export function setInvoiceStatus(id: string, status: InvoiceStatus, paymentMethod?: PaymentMethod): SavedInvoice[] {
  const list = loadInvoices();
  if (status !== 'paid' && status !== 'unpaid') return list;
  const cleanId = typeof id === 'string' ? id.trim() : '';
  const target = list.find((row) => row.id === cleanId);
  if (!target) return list;
  const method = cleanPaymentMethod(paymentMethod);
  const replacement: SavedInvoice = status === 'paid'
    ? {
      ...target,
      status,
      // Changing how a payment was received must not change when it was received.
      paidAt: target.status === 'paid' && target.paidAt ? target.paidAt : new Date().toISOString(),
      paymentMethod: method ?? (target.status === 'paid' ? target.paymentMethod : undefined),
    }
    : {
      ...target,
      status,
      paidAt: undefined,
      paymentMethod: undefined,
    };
  if (
    replacement.status === target.status
    && replacement.paidAt === target.paidAt
    && replacement.paymentMethod === target.paymentMethod
  ) return list;
  const updated = list.map((row) => (row.id === cleanId ? replacement : row));
  if (!writeInvoices(updated)) return list;
  notify();
  return updated;
}
export function invoiceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// The next invoice number is part of the same accounting ledger as the invoices
// themselves. Keeping it behind the same account-key boundary prevents farmer B
// inheriting farmer A's numbering sequence on a shared device.
export function loadNextInvoiceNumber(fallback = 44): number {
  const safeFallback = Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 44;
  if (typeof window === 'undefined') return safeFallback;
  try {
    const raw = localStorage.getItem(activeAccountLocalStorageKey(SEQ_KEY));
    if (!raw) return safeFallback;
    const value = Number.parseInt(raw, 10);
    return Number.isSafeInteger(value) && value > 0 ? value : safeFallback;
  } catch {
    return safeFallback;
  }
}

export function saveNextInvoiceNumber(value: number): boolean {
  if (typeof window === 'undefined' || !Number.isSafeInteger(value) || value <= 0) {
    return false;
  }
  try {
    localStorage.setItem(
      activeAccountLocalStorageKey(SEQ_KEY),
      String(value),
    );
    return true;
  } catch {
    return false;
  }
}
