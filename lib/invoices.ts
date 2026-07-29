// Local persistence for the invoice tool: remembered customers, item presets,
// and past invoices the farmer can call up and reprint. localStorage-backed
// (offline-first, same as the rest of the app).

import {
  isSampleMode,
  getSandboxCustomers, setSandboxCustomers,
  getSandboxProducts, setSandboxProducts,
  getSandboxInvoices, setSandboxInvoices,
} from './sample-mode';

export interface InvoiceItem { desc: string; qty: number; unit: string; price: number }
export interface Product { desc: string; unit: string; price: number }
export type InvoiceStatus = 'unpaid' | 'paid';
export type PaymentMethod = 'cash' | 'eft' | 'card' | 'mobile' | 'other';
export interface SavedInvoice {
  id: string;
  no: number;
  billTo: string;
  items: InvoiceItem[];
  total: number;
  dateISO: string;
  status: InvoiceStatus;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', eft: 'EFT', card: 'Card', mobile: 'Mobile', other: 'Other',
};
export function paymentMethodLabel(m: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[m] ?? PAYMENT_METHOD_LABELS.other;
}

const C_KEY = 'imbewu_invoice_customers';
const P_KEY = 'imbewu_invoice_products';
const I_KEY = 'imbewu_invoices';

function read<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write<T>(key: string, v: T[]) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}
function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-invoices-changed'));
}

// Sample-mode-aware read/write per key — the only thing that changes vs the
// real read<T>/write<T> above is where the data actually lives.
function cleanCustomers(rows: unknown[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const row of rows) {
    if (typeof row !== 'string') continue;
    const name = row.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    clean.push(name);
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
  const status: InvoiceStatus = invoice.status === 'paid' ? 'paid' : 'unpaid';
  const paymentMethod = invoice.paymentMethod && invoice.paymentMethod in PAYMENT_METHOD_LABELS
    ? invoice.paymentMethod
    : undefined;
  return {
    id: invoice.id.trim(),
    no: invoice.no!,
    billTo: invoice.billTo.trim(),
    items: validItems,
    total,
    dateISO: invoice.dateISO,
    status,
    paidAt: typeof invoice.paidAt === 'string' && Number.isFinite(Date.parse(invoice.paidAt))
      ? invoice.paidAt
      : undefined,
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

function readCustomers(): string[] {
  return cleanCustomers(isSampleMode() ? getSandboxCustomers() : read<unknown>(C_KEY));
}
function writeCustomers(v: string[]): void { if (isSampleMode()) setSandboxCustomers(v); else write(C_KEY, v); }
function readProducts(): Product[] {
  return cleanProducts(isSampleMode() ? getSandboxProducts() : read<unknown>(P_KEY));
}
function writeProducts(v: Product[]): void { if (isSampleMode()) setSandboxProducts(v); else write(P_KEY, v); }
function readInvoicesRaw(): SavedInvoice[] {
  return cleanInvoices(isSampleMode() ? getSandboxInvoices() : read<unknown>(I_KEY));
}
function writeInvoices(v: SavedInvoice[]): void { if (isSampleMode()) setSandboxInvoices(v); else write(I_KEY, v); }

/* ── Customers ──────────────────────────────── */
export function loadCustomers(): string[] { return readCustomers(); }
export function addCustomer(name: string) {
  const n = name.trim();
  if (!n) return;
  const list = loadCustomers().filter((c) => c.toLowerCase() !== n.toLowerCase());
  writeCustomers([n, ...list].slice(0, 100));
  notify();
}

/* ── Item / product presets ─────────────────── */
export function loadProducts(): Product[] { return readProducts(); }
export function addProduct(p: Product) {
  const product = cleanProduct(p);
  if (!product) return;
  const list = loadProducts().filter((x) => x.desc.toLowerCase() !== product.desc.toLowerCase());
  writeProducts([product, ...list].slice(0, 200));
  notify();
}

/* ── Saved invoices ─────────────────────────── */
// Old records predate `status`; cleanInvoice defaults them to unpaid while
// validating the accounting fields at the persistence boundary.
export function loadInvoices(): SavedInvoice[] { return readInvoicesRaw(); }
export function saveInvoice(inv: SavedInvoice): SavedInvoice[] {
  const list = loadInvoices().filter((x) => x.id !== inv.id);
  const clean = cleanInvoice(inv);
  if (!clean) return loadInvoices();
  const updated = [clean, ...list].slice(0, 100);
  writeInvoices(updated);
  notify();
  return updated;
}
export function deleteInvoice(id: string): SavedInvoice[] {
  const updated = loadInvoices().filter((x) => x.id !== id);
  writeInvoices(updated);
  notify();
  return updated;
}
export function setInvoiceStatus(id: string, status: InvoiceStatus, paymentMethod?: PaymentMethod): SavedInvoice[] {
  const list = loadInvoices();
  const updated = list.map((x) => (x.id === id
    ? {
      ...x,
      status,
      paidAt: status === 'paid' ? new Date().toISOString() : undefined,
      paymentMethod: status === 'paid' ? (paymentMethod ?? x.paymentMethod) : undefined,
    }
    : x));
  writeInvoices(updated);
  notify();
  return updated;
}
export function invoiceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
