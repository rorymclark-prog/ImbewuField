// Local persistence for the invoice tool: remembered customers, item presets,
// and past invoices the farmer can call up and reprint. localStorage-backed
// (offline-first, same as the rest of the app).

import {
  isSampleMode,
  getSandboxCustomers, setSandboxCustomers,
  getSandboxProducts, setSandboxProducts,
  getSandboxInvoices, setSandboxInvoices,
  getSandboxPendingInvoiceLinks, setSandboxPendingInvoiceLinks,
} from './sample-mode';
import { activeAccountLocalStorageKey } from './account-local-storage';
import { normaliseRecordUnit, validRecordQuantity } from './farm-records';
import { inspectInvoiceCurrencyBasis, invoiceRandConsumerEligibility } from './invoice-currency';
import { detachJsonData, rawJsonIsLossless } from './lossless-json';
import { readInvoiceStorage, writeInvoiceStorageRaw, makeBrowserInvoiceStorageContext,
  captureInvoiceStorageLease, invoiceStorageLeaseMatches, parseInvoiceStoragePayload, INVOICE_STORAGE_EVENT,
  captureInvoiceReadReceipt, invoiceReadReceiptMatches, releaseInvoiceReadReceipt,
  type InvoiceStoragePayload, type InvoiceStorageContext } from './invoice-storage';
import { captureInvoiceDocumentContext, invoiceDocumentContextIsCurrent, revokeInvoiceDocumentContext,
  subscribeInvoiceDocumentContext, type InvoiceDocumentContext } from './length-unit-preference';

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
  /** Present unreadable evidence is retained in views. Only a validated native
   * basis can authorize a write; absence alone denotes an old Rand invoice. */
  currencyCode?: unknown;
  /** The invoice is saved locally; its shared sales rows still need confirmation. */
  salesSyncPending?: boolean;
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
  /** A retrospective document keeps its source separate from the buyer's order reference. */
  entryKind?: import('./invoice-entry').InvoiceEntryKind;
  paperReference?: string;
  /** Explicitly selected existing sale; its stable ID and financial fields stay intact. */
  sourceSaleId?: string;
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
    return localStorage.getItem(activeAccountLocalStorageKey(baseKey)) === JSON.stringify(v);
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
    || (normaliseRecordUnit(unit) !== null && !validRecordQuantity(item.qty, unit))
    || !Number.isFinite(item.price)
    || item.price! < 0
    || !Number.isFinite(item.qty! * item.price!)
  ) return null;
  return { desc, qty: item.qty!, unit, price: item.price! };
}

function cleanInvoice(row: unknown): SavedInvoice | null {
  if (!row || typeof row !== 'object') return null;
  const invoice = row as Partial<SavedInvoice>;
  const basis = inspectInvoiceCurrencyBasis(row), currency = Object.getOwnPropertyDescriptor(row, 'currencyCode');
  const denomination = basis.status === 'legacy-rand' ? {} : basis.status === 'recorded' ? { currencyCode: basis.currency }
    : { currencyCode: currency && 'value' in currency && currency.value !== undefined ? currency.value : { held: true } };
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
  const sourceSaleId = optionalText(invoice.sourceSaleId);
  if (sourceSaleId && (sourceSaleId.includes('/') || status !== 'paid')) return null;
  // A due date that lands before the issue date is not a term any buyer agreed to; it is a bad
  // record. Drop it rather than print "due 3 days ago" on a freshly issued invoice.
  const dueDateISO = typeof invoice.dueDateISO === 'string'
    && Number.isFinite(Date.parse(invoice.dueDateISO))
    && Date.parse(invoice.dueDateISO) >= Date.parse(invoice.dateISO)
    ? invoice.dueDateISO
    : undefined;
  return {
    ...denomination,
    ...(invoice.salesSyncPending === true ? { salesSyncPending: true } : {}),
    enterprise: typeof invoice.enterprise === 'string' && ['vegetables', 'staples', 'other'].includes(invoice.enterprise) ? invoice.enterprise : undefined,
    id: invoice.id.trim(),
    no: invoice.no!,
    billTo: invoice.billTo.trim(),
    billToDetails: cleanCustomerDetails(invoice.billToDetails),
    items: validItems,
    total,
    dateISO: invoice.dateISO,
    dueDateISO,
    reference: optionalText(invoice.reference),
    entryKind: invoice.entryKind === 'past-sale' || invoice.entryKind === 'paper-copy' ? invoice.entryKind : 'new',
    paperReference: optionalText(invoice.paperReference),
    sourceSaleId,
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

/* ── Protected invoice book ─────────────────── */

export interface InvoiceBookRead {
  readonly status: 'ready' | 'held' | 'sample';
  readonly reason?: string;
  readonly writable: boolean;
  readonly invoices: SavedInvoice[];
  readonly pendingLinks: SavedInvoice[];
  readonly nextNumber: number;
  /** Hidden damaged rows remain in the raw book, outside accounting totals. */
  readonly retainedUnreadableRows: number;
  readonly currencyHeldRows: number;
}
export type InvoiceReadCoverage = { readonly status: 'complete' }
  | { readonly status: 'held'; readonly hiddenRows: number; readonly reason: string };
const collectionCoverage = new WeakMap<readonly unknown[], { coverage: InvoiceReadCoverage; snapshot: string }>();
/** Inspect the original loaded collection before deriving a period subset. An
 * unreadable book must never become an apparently complete zero-income list. */
export function invoiceReadCoverage(invoices: readonly unknown[]): InvoiceReadCoverage {
  const proof = collectionCoverage.get(invoices);
  if (!proof) return { status: 'complete' };
  try {
    if (json(invoices) === proof.snapshot) return proof.coverage;
  } catch { /* Altered or executable values cannot inherit the loaded coverage. */ }
  return { status: 'held', hiddenRows: proof.coverage.status === 'held' ? proof.coverage.hiddenRows : 0, reason: 'invoice-view-changed' };
}
function cover(invoices: SavedInvoice[], coverage: InvoiceReadCoverage): void {
  collectionCoverage.set(invoices, { coverage: Object.freeze(coverage), snapshot: json(invoices) });
}
export type InvoiceMutationResult = { status: 'written'; book: InvoiceBookRead; token: string }
  | { status: 'unchanged'; book: InvoiceBookRead }
  | { status: 'held'; reason: string; book: InvoiceBookRead }
  | { status: 'unconfirmed'; reason: string };
interface InvoiceReadProof {
  context: InvoiceDocumentContext;
  storageContext: InvoiceStorageContext | null;
  lease: object | null;
  sample: boolean;
  payload: InvoiceStoragePayload;
  payloadRaw: string;
  token: string;
  display: string;
  win: Window;
}
const admissions = new WeakMap<InvoiceBookRead, InvoiceReadProof>();
interface SampleSequence { raw: string | null; context: InvoiceDocumentContext; stop: () => void }
const sampleSequences = new WeakMap<Window, SampleSequence>();
const json = (value: unknown) => JSON.stringify(detachJsonData(value, { allowUndefinedObjectFields: true }));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const itemFields = new Set(['desc', 'qty', 'unit', 'price']);
function rawId(row: unknown): string | null { return record(row) && typeof row.id === 'string' && row.id.trim() ? row.id.trim() : null; }
function rawRows(raw: string): unknown[] { const rows: unknown = JSON.parse(raw); if (!Array.isArray(rows)) throw Error('invoice-book-unreadable'); return rows; }
function currentSampleSequence(win: Window): string | null {
  const saved = sampleSequences.get(win);
  if (!saved) return null;
  if (invoiceDocumentContextIsCurrent(saved.context)) return saved.raw;
  saved.stop(); revokeInvoiceDocumentContext(saved.context); sampleSequences.delete(win); return null;
}
function setSampleSequence(win: Window, raw: string | null): void {
  const old = sampleSequences.get(win); old?.stop(); if (old) revokeInvoiceDocumentContext(old.context);
  const context = captureInvoiceDocumentContext(); if (!context || !invoiceDocumentContextIsCurrent(context)) throw Error('invoice-context-changed');
  const saved: SampleSequence = { raw, context, stop: () => {} };
  saved.stop = subscribeInvoiceDocumentContext(context, () => {
    saved.stop(); revokeInvoiceDocumentContext(context);
    if (sampleSequences.get(win) === saved) sampleSequences.delete(win);
  });
  sampleSequences.set(win, saved);
}
function sampleRows(value: unknown): unknown {
  if (!Array.isArray(value)) throw Error('sample-invoices-unreadable');
  // Audit array descriptors before obtaining rows: iteration would execute an
  // index getter before the ordinary descriptor-safe clone could reject it.
  const detached = detachJsonData(value, { allowUndefinedObjectFields: true });
  for (let index = 0; index < value.length; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (!field || !Object.hasOwn(field, 'value')) throw Error('sample-invoices-unreadable');
    const row: unknown = field.value;
    if (!record(row)) continue;
    const currency = Object.getOwnPropertyDescriptor(row, 'currencyCode');
    // JSON omission is harmless for optional form fields, but it would turn
    // an unreadable denomination into a historical Rand claim here.
    if (currency && (!('value' in currency) || currency.value === undefined)) throw Error('currency-needs-review');
  }
  return detached;
}
function samplePayload(win: Window): InvoiceStoragePayload {
  return { version: 1, invoicesRaw: JSON.stringify(sampleRows(getSandboxInvoices())),
    pendingLinksRaw: JSON.stringify(sampleRows(getSandboxPendingInvoiceLinks())), sequenceRaw: currentSampleSequence(win) };
}
function nextNumber(payload: InvoiceStoragePayload, fallback = 44): number {
  const requested = Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 44;
  let reserved = 1;
  for (const row of [...rawRows(payload.invoicesRaw), ...rawRows(payload.pendingLinksRaw)]) {
    if (record(row) && typeof row.no === 'number' && Number.isSafeInteger(row.no) && row.no > 0) {
      if (row.no === Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER;
      reserved = Math.max(reserved, row.no + 1);
    }
  }
  const saved = payload.sequenceRaw !== null && /^\d+$/.test(payload.sequenceRaw.trim()) ? Number(payload.sequenceRaw) : NaN;
  return Math.max(reserved, Number.isSafeInteger(saved) && saved > 0 ? saved : requested);
}
function view(payload: InvoiceStoragePayload, status: InvoiceBookRead['status'], reason?: string, writable = false): InvoiceBookRead {
  const invoices = rawRows(payload.invoicesRaw), pending = rawRows(payload.pendingLinksRaw);
  const ambiguous = !rawJsonIsLossless(payload.invoicesRaw) || !rawJsonIsLossless(payload.pendingLinksRaw);
  const project = (rows: unknown[]) => cleanInvoices(rows).map(row => ambiguous ? { ...row, currencyCode: { held: true } } : row);
  const saved = project(invoices), staged = project(pending).filter(row => Boolean(row.sourceSaleId));
  const hiddenRows = invoices.length - saved.length;
  const unreadableSource = reason && !['writer-not-acquired', 'upgrade-required'].includes(reason);
  cover(saved, hiddenRows || ambiguous || unreadableSource ? { status: 'held', hiddenRows,
    reason: ambiguous ? 'invoice-json-needs-review' : hiddenRows ? 'invoice-rows-needing-review' : reason! } : { status: 'complete' });
  return Object.freeze({ status: ambiguous ? 'held' : status, ...(ambiguous ? { reason: 'invoice-json-needs-review' } : reason ? { reason } : {}),
    writable: !ambiguous && writable, invoices: saved, pendingLinks: staged, nextNumber: nextNumber(payload),
    retainedUnreadableRows: invoices.length + pending.length - saved.length - staged.length,
    currencyHeldRows: [...saved, ...staged].filter(row => inspectInvoiceCurrencyBasis(row).status === 'held').length });
}
function emptyRead(reason: string): InvoiceBookRead {
  const invoices: SavedInvoice[] = []; cover(invoices, { status: 'held', hiddenRows: 0, reason });
  return Object.freeze({ status: 'held', reason, writable: false, invoices, pendingLinks: [], nextNumber: 44, retainedUnreadableRows: 0, currencyHeldRows: 0 });
}
function inspectBook(admit: boolean): InvoiceBookRead {
  if (typeof window === 'undefined') return emptyRead('storage-unavailable');
  let context: InvoiceDocumentContext | null = null;
  try {
    if (admit) {
      context = captureInvoiceDocumentContext();
      if (!context || !invoiceDocumentContextIsCurrent(context)) { revokeInvoiceDocumentContext(context); return emptyRead('invoice-context-changed'); }
    }
    const win = window, storageContext = makeBrowserInvoiceStorageContext(), state = readInvoiceStorage(storageContext);
    const sample = state.status === 'sample';
    const payload = sample ? samplePayload(win) : state.bookRaw === null ? null : parseInvoiceStoragePayload(state.bookRaw);
    if (!payload) { revokeInvoiceDocumentContext(context); return emptyRead(state.reason ?? 'invoice-book-unreadable'); }
    const payloadRaw = sample ? JSON.stringify(payload) : state.bookRaw!;
    const lease = sample ? null : captureInvoiceStorageLease(storageContext);
    const writable = admit && !!context && invoiceDocumentContextIsCurrent(context)
      && (sample || state.status === 'ready' && state.writable && !!state.token && !!lease);
    const book = view(payload, sample ? 'sample' : state.status, state.reason, writable);
    if (book.writable && context) admissions.set(book, { context, storageContext, lease, sample, payload, payloadRaw,
      token: sample ? payloadRaw : state.token!, display: json(book), win });
    else revokeInvoiceDocumentContext(context);
    return book;
  } catch { revokeInvoiceDocumentContext(context); return emptyRead('invoice-book-unreadable'); }
}
export function readInvoiceBook(): InvoiceBookRead { return inspectBook(true); }
export function releaseInvoiceBook(book: InvoiceBookRead): void {
  const proof = admissions.get(book); if (!proof) return;
  admissions.delete(book); revokeInvoiceDocumentContext(proof.context);
}
export function invoiceBookIsCurrent(book: InvoiceBookRead): boolean {
  const proof = admissions.get(book);
  if (!proof || typeof window === 'undefined' || window !== proof.win || !invoiceDocumentContextIsCurrent(proof.context)) return false;
  try {
    if (json(book) !== proof.display) return false;
    if (proof.sample) return isSampleMode() && JSON.stringify(samplePayload(proof.win)) === proof.payloadRaw && invoiceDocumentContextIsCurrent(proof.context);
    const fresh = readInvoiceStorage(proof.storageContext);
    return !isSampleMode() && fresh.writable && fresh.token === proof.token && fresh.bookRaw === proof.payloadRaw
      && invoiceStorageLeaseMatches(proof.lease, proof.storageContext) && invoiceDocumentContextIsCurrent(proof.context);
  } catch { return false; }
}

export type InvoiceReadView =
  | { readonly status: 'ready' | 'sample'; readonly invoices: readonly SavedInvoice[];
      readonly coverage: { readonly status: 'complete' } }
  | { readonly status: 'held'; readonly reason: string; readonly retainedUnreadableRows: number };
interface InvoiceViewProof {
  context: InvoiceDocumentContext;
  storageContext: InvoiceStorageContext;
  win: Window;
  sample: boolean;
  rawReceipt: object | null;
  payloadRaw: string;
  display: string;
  checking: boolean;
  eventChecking: boolean;
  listeners: Set<() => void>;
  stopActor: () => void;
  stopEvents: () => void;
}
// Read receipts never enter admissions: a readable book is not permission to edit it.
const readViews = new WeakMap<InvoiceReadView, InvoiceViewProof>();
const heldReadView = (reason: string, retainedUnreadableRows = 0): InvoiceReadView =>
  Object.freeze({ status: 'held', reason, retainedUnreadableRows });

function readViewSource(win: Window, context: InvoiceStorageContext) {
  const state = readInvoiceStorage(context), sample = state.status === 'sample';
  const payload = sample ? samplePayload(win) : state.bookRaw === null ? null : parseInvoiceStoragePayload(state.bookRaw);
  if (!payload) return null;
  const book = view(payload, sample ? 'sample' : state.status, state.reason);
  return { sample, book, payloadRaw: sample ? JSON.stringify(payload) : state.bookRaw! };
}
function readViewFingerprintMatches(proof: InvoiceViewProof): boolean {
  if (typeof window === 'undefined' || window !== proof.win || !invoiceDocumentContextIsCurrent(proof.context)) return false;
  const same = proof.sample ? JSON.stringify(samplePayload(proof.win)) === proof.payloadRaw
    : invoiceReadReceiptMatches(proof.rawReceipt, proof.storageContext);
  return same && invoiceDocumentContextIsCurrent(proof.context);
}
function withdrawReadView(delivery: InvoiceReadView, notify: boolean): void {
  const proof = readViews.get(delivery); if (!proof) return;
  readViews.delete(delivery);
  releaseInvoiceReadReceipt(proof.rawReceipt);
  proof.stopEvents(); proof.stopActor(); revokeInvoiceDocumentContext(proof.context);
  const listeners = [...proof.listeners]; proof.listeners.clear();
  if (notify) for (const listener of listeners) { try { listener(); } catch { /* One observer cannot retain another's stale delivery. */ } }
}

/** Capture a coherent private view without acquiring a lock, initializing a store
 * or manufacturing an empty book when no payload is readable. */
export function readInvoiceView(): InvoiceReadView {
  let context: InvoiceDocumentContext | null = null, delivery: InvoiceReadView | null = null, rawReceipt: object | null = null;
  try {
    context = captureInvoiceDocumentContext();
    if (!context || !invoiceDocumentContextIsCurrent(context) || typeof window === 'undefined') {
      revokeInvoiceDocumentContext(context); return heldReadView('invoice-context-changed');
    }
    const win = window, storageContext = makeBrowserInvoiceStorageContext();
    if (!storageContext) { revokeInvoiceDocumentContext(context); return heldReadView('storage-unavailable'); }
    rawReceipt = storageContext.sample ? null : captureInvoiceReadReceipt(storageContext);
    if (!storageContext.sample && !rawReceipt) { revokeInvoiceDocumentContext(context); return heldReadView('invoice-source-changed'); }
    const source = readViewSource(win, storageContext);
    if (!source) { releaseInvoiceReadReceipt(rawReceipt); revokeInvoiceDocumentContext(context); return heldReadView('invoice-book-unreadable'); }
    const coverage = invoiceReadCoverage(source.book.invoices);
    if (coverage.status === 'held' || source.book.retainedUnreadableRows) {
      revokeInvoiceDocumentContext(context);
      releaseInvoiceReadReceipt(rawReceipt);
      return heldReadView(coverage.status === 'held' ? coverage.reason : 'invoice-rows-needing-review', source.book.retainedUnreadableRows);
    }
    if (!invoiceDocumentContextIsCurrent(context) || source.sample !== !!storageContext.sample
      || !source.sample && !invoiceReadReceiptMatches(rawReceipt, storageContext)) {
      releaseInvoiceReadReceipt(rawReceipt); revokeInvoiceDocumentContext(context); return heldReadView('invoice-source-changed');
    }
    delivery = Object.freeze({ status: source.sample ? 'sample' : 'ready', invoices: source.book.invoices,
      coverage: Object.freeze({ status: 'complete' as const }) });
    const proof: InvoiceViewProof = { context, storageContext, win, sample: source.sample, rawReceipt,
      payloadRaw: source.payloadRaw, display: json(delivery), checking: false, eventChecking: false,
      listeners: new Set(), stopActor: () => {}, stopEvents: () => {} };
    readViews.set(delivery, proof);
    proof.stopActor = subscribeInvoiceDocumentContext(context, () => withdrawReadView(delivery!, true));
    const inspect = () => {
      if (readViews.get(delivery!) !== proof) return;
      if (!proof.checking) { invoiceReadViewIsCurrent(delivery!); return; }
      // A synchronous event can expose changed bytes that its caller restores
      // before the outer read returns. Witness those bytes with the same receipt,
      // but withdraw if witnessing itself reenters rather than recursively reading.
      if (proof.eventChecking) { withdrawReadView(delivery!, true); return; }
      proof.eventChecking = true;
      try { if (!readViewFingerprintMatches(proof)) withdrawReadView(delivery!, true); }
      catch { withdrawReadView(delivery!, true); }
      finally { proof.eventChecking = false; }
    };
    const storageChanged = (event: StorageEvent) => {
      if (event.key && ![storageContext.canonicalKey, storageContext.receiptKey, ...storageContext.legacyKeys].includes(event.key)) return;
      inspect();
    };
    const hidden = () => withdrawReadView(delivery!, true);
    proof.stopEvents = () => {
      win.removeEventListener('imbewu-invoices-changed', inspect); win.removeEventListener(INVOICE_STORAGE_EVENT, inspect);
      win.removeEventListener('storage', storageChanged); win.removeEventListener('focus', inspect); win.removeEventListener('pageshow', inspect);
      win.removeEventListener('pagehide', hidden);
    };
    win.addEventListener('imbewu-invoices-changed', inspect); win.addEventListener(INVOICE_STORAGE_EVENT, inspect);
    win.addEventListener('storage', storageChanged); win.addEventListener('focus', inspect); win.addEventListener('pageshow', inspect);
    win.addEventListener('pagehide', hidden);
    if (!invoiceReadViewIsCurrent(delivery)) return heldReadView('invoice-source-changed');
    return delivery;
  } catch {
    if (delivery) withdrawReadView(delivery, false);
    else { releaseInvoiceReadReceipt(rawReceipt); revokeInvoiceDocumentContext(context); }
    return heldReadView('invoice-book-unreadable');
  }
}

export function invoiceReadViewIsCurrent(delivery: InvoiceReadView): boolean {
  const proof = readViews.get(delivery);
  if (!proof || proof.checking) return false;
  proof.checking = true;
  let current = false;
  try {
    if (json(delivery) === proof.display && readViewFingerprintMatches(proof) && readViews.get(delivery) === proof) {
      const source = readViewSource(proof.win, proof.storageContext);
      current = !!source && source.sample === proof.sample && source.payloadRaw === proof.payloadRaw
        && source.book.retainedUnreadableRows === 0 && invoiceReadCoverage(source.book.invoices).status === 'complete'
        && readViewFingerprintMatches(proof) && json(delivery) === proof.display
        && invoiceDocumentContextIsCurrent(proof.context) && readViews.get(delivery) === proof;
    }
  } catch { /* Unreadable or executable source evidence cannot retain a receipt. */ }
  finally { proof.checking = false; }
  if (!current) withdrawReadView(delivery, true);
  return current;
}
export function subscribeInvoiceReadView(delivery: InvoiceReadView, onWithdrawn: () => void): () => void {
  const proof = readViews.get(delivery); if (!proof) return () => {};
  proof.listeners.add(onWithdrawn);
  invoiceReadViewIsCurrent(delivery);
  return () => proof.listeners.delete(onWithdrawn);
}
export function releaseInvoiceReadView(delivery: InvoiceReadView): void { withdrawReadView(delivery, false); }

function held(reason: string, source?: InvoiceBookRead): InvoiceMutationResult {
  return { status: 'held', reason, book: source ?? inspectBook(false) };
}
function commit(payload: InvoiceStoragePayload, source: InvoiceBookRead): InvoiceMutationResult {
  const proof = admissions.get(source);
  if (!proof || !invoiceBookIsCurrent(source)) return held('invoice-source-changed', source);
  const raw = JSON.stringify(payload);
  if (raw === proof.payloadRaw) return { status: 'unchanged', book: source };
  let token: string;
  try {
    if (!parseInvoiceStoragePayload(raw) || !rawJsonIsLossless(payload.invoicesRaw) || !rawJsonIsLossless(payload.pendingLinksRaw)) return held('invoice-json-needs-review', source);
    if (proof.sample) {
      if (!invoiceBookIsCurrent(source)) return held('invoice-source-changed', source);
      setSandboxInvoices(rawRows(payload.invoicesRaw) as SavedInvoice[]);
      setSandboxPendingInvoiceLinks(rawRows(payload.pendingLinksRaw) as SavedInvoice[]);
      if (payload.sequenceRaw !== proof.payload.sequenceRaw) setSampleSequence(proof.win, payload.sequenceRaw);
      token = raw;
      if (!invoiceDocumentContextIsCurrent(proof.context) || JSON.stringify(samplePayload(proof.win)) !== raw) return { status: 'unconfirmed', reason: 'invoice-write-unconfirmed' };
    } else {
      const result = writeInvoiceStorageRaw(raw, proof.token, proof.storageContext, () => invoiceDocumentContextIsCurrent(proof.context));
      if (result.status === 'held') return held(result.reason, source);
      if (result.status === 'unconfirmed') return { status: 'unconfirmed', reason: result.reason };
      token = result.token;
    }
    if (!invoiceDocumentContextIsCurrent(proof.context)) return { status: 'unconfirmed', reason: 'invoice-write-unconfirmed' };
    const own = () => proof.sample ? JSON.stringify(samplePayload(proof.win)) === raw
      : readInvoiceStorage(proof.storageContext).token === token && readInvoiceStorage(proof.storageContext).bookRaw === raw;
    if (!own()) return { status: 'unconfirmed', reason: 'invoice-write-unconfirmed' };
    const book = readInvoiceBook();
    if (!invoiceBookIsCurrent(book) || !invoiceDocumentContextIsCurrent(proof.context) || !own()) {
      releaseInvoiceBook(book); return { status: 'unconfirmed', reason: 'invoice-write-unconfirmed' };
    }
    releaseInvoiceBook(source); notify();
    if (!invoiceBookIsCurrent(book)) { releaseInvoiceBook(book); return { status: 'unconfirmed', reason: 'invoice-write-unconfirmed' }; }
    return { status: 'written', book, token };
  } catch { return { status: 'unconfirmed', reason: 'invoice-write-unconfirmed' }; }
}
function sourceRows(source?: InvoiceBookRead): { payload: InvoiceStoragePayload; saved: unknown[]; pending: unknown[] } | null {
  if (!source || !invoiceBookIsCurrent(source)) return null;
  const proof = admissions.get(source)!;
  if (!rawJsonIsLossless(proof.payload.invoicesRaw) || !rawJsonIsLossless(proof.payload.pendingLinksRaw)) return null;
  return { payload: proof.payload, saved: rawRows(proof.payload.invoicesRaw), pending: rawRows(proof.payload.pendingLinksRaw) };
}
function target(rows: unknown[], id: string): { row: Record<string, unknown>; clean: SavedInvoice; index: number } | null {
  const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => rawId(row) === id);
  if (matches.length > 1) throw Error('ambiguous-invoice-id');
  if (!matches.length) return null;
  const found = matches[0]; if (!record(found.row)) throw Error('invoice-row-needs-review');
  const clean = cleanInvoice(found.row); if (!clean) throw Error('invoice-row-needs-review');
  return { row: found.row, clean, index: found.index };
}
function sameBasis(a: unknown, b: unknown): boolean {
  const first = inspectInvoiceCurrencyBasis(a), second = inspectInvoiceCurrencyBasis(b);
  return first.status !== 'held' && second.status !== 'held' && json(first) === json(second);
}
function extras(row: Record<string, unknown>, known: ReadonlySet<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !known.has(key)));
}
function mergedRow(original: Record<string, unknown> | undefined, incoming: Record<string, unknown>, clean: SavedInvoice): Record<string, unknown> {
  const row = { ...original, ...incoming, ...clean } as Record<string, unknown>;
  if (!Object.hasOwn(clean, 'currencyCode')) delete row.currencyCode;
  row.items = clean.items.map((item, index) => {
    const old = original && Array.isArray(original.items) && record(original.items[index]) ? original.items[index] : undefined;
    const candidate = Array.isArray(incoming.items) && record(incoming.items[index]) ? incoming.items[index] : {};
    if (old && Object.keys(extras(old, itemFields)).length && json(cleanItem(old)) !== json(item)) throw Error('invoice-line-metadata-needs-review');
    return { ...old, ...candidate, ...item };
  });
  if (original && Array.isArray(original.items) && original.items.length > clean.items.length
    && original.items.slice(clean.items.length).some(item => record(item) && Object.keys(extras(item, itemFields)).length)) throw Error('invoice-line-metadata-needs-review');
  const contactKeys = new Set(['address', 'phone', 'email']);
  const oldContact = record(original?.billToDetails) ? extras(original.billToDetails, contactKeys) : {};
  const newContact = record(incoming.billToDetails) ? extras(incoming.billToDetails, contactKeys) : {};
  if (Object.keys(oldContact).length || Object.keys(newContact).length) row.billToDetails = { ...oldContact, ...newContact, ...clean.billToDetails };
  return detachJsonData(row, { allowUndefinedObjectFields: true }) as Record<string, unknown>;
}
function candidateRow(value: SavedInvoice): Record<string, unknown> {
  if (inspectInvoiceCurrencyBasis(value).status === 'held') throw Error('invoice-currency-needs-review');
  const row = detachJsonData(value, { allowUndefinedObjectFields: true });
  if (!record(row)) throw Error('invalid-invoice');
  return row;
}
function candidateInvoice(row: Record<string, unknown>, previous?: SavedInvoice): SavedInvoice {
  // Existing payment evidence must survive an ordinary form that omits those
  // optional fields. This happens before normalization can turn it into unpaid.
  const paid = row.status === 'paid' && previous?.status === 'paid' ? { ...row,
    paidAt: row.paidAt ?? previous.paidAt,
    paymentMethod: cleanPaymentMethod(row.paymentMethod) ?? previous.paymentMethod } : row;
  const clean = cleanInvoice(previous ? { ...paid, dateISO: previous.dateISO } : paid);
  if (!clean) throw Error('invalid-invoice');
  return clean;
}
function sameLinkedFacts(a: SavedInvoice, b: SavedInvoice): boolean {
  return sameBasis(a, b) && a.sourceSaleId === b.sourceSaleId && a.status === b.status && a.paidAt === b.paidAt
    && a.total === b.total && a.enterprise === b.enterprise && json(a.items) === json(b.items);
}
function noOtherSourceSale(rows: unknown[], invoice: SavedInvoice): boolean {
  return !invoice.sourceSaleId || !rows.some(row => record(row) && row.sourceSaleId === invoice.sourceSaleId && rawId(row) !== invoice.id);
}
function numberAvailable(rows: unknown[], invoice: SavedInvoice, previous?: SavedInvoice): boolean {
  // Historical duplicate numbers are retained evidence, not a reason to renumber
  // an existing document. A new or changed number cannot create another collision.
  return previous?.no === invoice.no || !rows.some(row => record(row) && row.no === invoice.no && rawId(row) !== invoice.id);
}

/** Compatibility views never capture a write admission or retain auth observers. */
export function loadInvoices(): SavedInvoice[] { return inspectBook(false).invoices; }
export function loadPendingInvoiceLinks(): SavedInvoice[] { return inspectBook(false).pendingLinks; }
export function loadNextInvoiceNumber(fallback = 44): number {
  try {
    const state = readInvoiceStorage(), payload = state.status === 'sample' ? samplePayload(window)
      : state.bookRaw === null ? null : parseInvoiceStoragePayload(state.bookRaw);
    return payload ? nextNumber(payload, fallback) : Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 44;
  } catch { return Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 44; }
}

export function saveInvoice(invoice: SavedInvoice, source?: InvoiceBookRead): InvoiceMutationResult {
  const data = sourceRows(source); if (!data || !source) return held('invoice-source-required', source);
  try {
    const incoming = candidateRow(invoice), id = rawId(incoming); if (!id) return held('invalid-invoice', source);
    const previous = target(data.saved, id), pending = target(data.pending, id), original = previous ?? pending;
    // Absence is historical evidence, never an implicit currency choice for a
    // newly authored document. Pending legacy recovery supplies that evidence.
    if (!original && inspectInvoiceCurrencyBasis(incoming).status !== 'recorded') return held('new-invoice-currency-required', source);
    if (original && !sameBasis(original.row, incoming)) return held('invoice-currency-is-immutable', source);
    const clean = candidateInvoice(incoming, original?.clean);
    if (previous?.clean.sourceSaleId && !sameLinkedFacts(previous.clean, clean)) return held('linked-sale-facts-are-immutable', source);
    if (pending?.clean.sourceSaleId && !sameLinkedFacts(pending.clean, clean)) return held('pending-link-facts-are-immutable', source);
    if (!noOtherSourceSale([...data.saved, ...data.pending], clean)) return held('sale-already-has-invoice', source);
    if (!numberAvailable([...data.saved, ...data.pending], clean, original?.clean)) return held('invoice-number-already-used', source);
    const row = mergedRow(original?.row, incoming, clean), saved = [...data.saved];
    if (previous) saved[previous.index] = row; else saved.unshift(row);
    return commit({ ...data.payload, invoicesRaw: JSON.stringify(saved) }, source);
  } catch (error) { return held(error instanceof Error ? error.message : 'invalid-invoice', source); }
}

export function stageInvoiceSaleLink(invoice: SavedInvoice, source?: InvoiceBookRead): InvoiceMutationResult {
  const data = sourceRows(source); if (!data || !source) return held('invoice-source-required', source);
  try {
    const incoming = candidateRow(invoice), id = rawId(incoming); if (!id) return held('invalid-invoice', source);
    const saved = target(data.saved, id), previous = target(data.pending, id);
    if (!saved && !previous && inspectInvoiceCurrencyBasis(incoming).status !== 'recorded') return held('new-invoice-currency-required', source);
    const clean = candidateInvoice(incoming, previous?.clean ?? saved?.clean);
    if (!clean.sourceSaleId) return held('source-sale-required', source);
    for (const original of [saved, previous]) if (original && (!sameBasis(original.row, incoming) || !sameLinkedFacts(original.clean, clean))) return held('pending-link-facts-are-immutable', source);
    if (!noOtherSourceSale([...data.saved, ...data.pending], clean)) return held('sale-already-has-invoice', source);
    if (!numberAvailable([...data.saved, ...data.pending], clean, previous?.clean ?? saved?.clean)) return held('invoice-number-already-used', source);
    const row = mergedRow(previous?.row ?? saved?.row, incoming, clean), pending = [...data.pending];
    if (previous) pending[previous.index] = row; else pending.unshift(row);
    return commit({ ...data.payload, pendingLinksRaw: JSON.stringify(pending) }, source);
  } catch (error) { return held(error instanceof Error ? error.message : 'invalid-invoice', source); }
}

export function clearPendingInvoiceLink(id: string, source?: InvoiceBookRead): InvoiceMutationResult {
  const data = sourceRows(source); if (!data || !source) return held('invoice-source-required', source);
  try {
    const pending = target(data.pending, id), saved = target(data.saved, id);
    if (!pending) return { status: 'unchanged', book: source };
    if (!saved || !sameLinkedFacts(pending.clean, saved.clean) || json(pending.clean) !== json(saved.clean)) return held('final-invoice-not-confirmed', source);
    return commit({ ...data.payload, pendingLinksRaw: JSON.stringify(data.pending.filter((_, index) => index !== pending.index)) }, source);
  } catch { return held('pending-link-needs-review', source); }
}

export function deleteInvoice(id: string, source?: InvoiceBookRead): InvoiceMutationResult {
  const data = sourceRows(source); if (!data || !source) return held('invoice-source-required', source);
  try {
    const row = target(data.saved, typeof id === 'string' ? id.trim() : '');
    if (!row) return { status: 'unchanged', book: source };
    if (row.clean.sourceSaleId || inspectInvoiceCurrencyBasis(row.row).status === 'held') return held('invoice-delete-needs-review', source);
    return commit({ ...data.payload, invoicesRaw: JSON.stringify(data.saved.filter((_, index) => index !== row.index)) }, source);
  } catch { return held('invoice-delete-needs-review', source); }
}

export function setInvoiceStatus(id: string, status: InvoiceStatus, paymentMethod?: PaymentMethod, receivedAt?: string, source?: InvoiceBookRead): InvoiceMutationResult {
  const data = sourceRows(source); if (!data || !source) return held('invoice-source-required', source);
  try {
    if (status !== 'paid' && status !== 'unpaid') return held('invalid-payment-status', source);
    const row = target(data.saved, typeof id === 'string' ? id.trim() : '');
    if (!row) return { status: 'unchanged', book: source };
    if (row.clean.sourceSaleId && status !== 'paid' || receivedAt && !Number.isFinite(Date.parse(receivedAt))) return held('invalid-payment-status', source);
    const method = cleanPaymentMethod(paymentMethod);
    const candidate = status === 'paid' ? { ...row.clean, status,
      paidAt: row.clean.sourceSaleId ? row.clean.paidAt : receivedAt ?? (row.clean.status === 'paid' ? row.clean.paidAt : undefined) ?? new Date().toISOString(),
      paymentMethod: method ?? (row.clean.status === 'paid' ? row.clean.paymentMethod : undefined) }
      : { ...row.clean, status, paidAt: undefined, paymentMethod: undefined };
    if (candidate.status === row.clean.status && candidate.paidAt === row.clean.paidAt && candidate.paymentMethod === row.clean.paymentMethod) return { status: 'unchanged', book: source };
    if (invoiceRandConsumerEligibility(row.row).status === 'eligible') candidate.salesSyncPending = true;
    return saveInvoice(candidate, source);
  } catch { return held('invalid-payment-status', source); }
}

export function saveNextInvoiceNumber(value: number, source?: InvoiceBookRead): InvoiceMutationResult {
  const data = sourceRows(source); if (!data || !source) return held('invoice-source-required', source);
  if (!Number.isSafeInteger(value) || value <= 0) return held('invalid-invoice-number', source);
  return commit({ ...data.payload, sequenceRaw: String(Math.max(value, nextNumber(data.payload, 1))) }, source);
}

export function invoiceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
