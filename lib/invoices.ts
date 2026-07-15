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
  return PAYMENT_METHOD_LABELS[m];
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
function readCustomers(): string[] { return isSampleMode() ? getSandboxCustomers() : read<string>(C_KEY); }
function writeCustomers(v: string[]): void { if (isSampleMode()) setSandboxCustomers(v); else write(C_KEY, v); }
function readProducts(): Product[] { return isSampleMode() ? getSandboxProducts() : read<Product>(P_KEY); }
function writeProducts(v: Product[]): void { if (isSampleMode()) setSandboxProducts(v); else write(P_KEY, v); }
function readInvoicesRaw(): SavedInvoice[] { return isSampleMode() ? getSandboxInvoices() : read<SavedInvoice>(I_KEY); }
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
  const desc = p.desc.trim();
  if (!desc) return;
  const list = loadProducts().filter((x) => x.desc.toLowerCase() !== desc.toLowerCase());
  writeProducts([{ desc, unit: p.unit, price: p.price }, ...list].slice(0, 200));
  notify();
}

/* ── Saved invoices ─────────────────────────── */
// Old records predate `status` — default them to 'unpaid' on load so callers
// never see an undefined status.
function migrate(inv: SavedInvoice): SavedInvoice {
  return inv.status ? inv : { ...inv, status: 'unpaid' };
}
export function loadInvoices(): SavedInvoice[] { return readInvoicesRaw().map(migrate); }
export function saveInvoice(inv: SavedInvoice): SavedInvoice[] {
  const list = loadInvoices().filter((x) => x.id !== inv.id);
  const updated = [migrate(inv), ...list].slice(0, 100);
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
