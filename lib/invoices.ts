// Local persistence for the invoice tool: remembered customers, item presets,
// and past invoices the farmer can call up and reprint. localStorage-backed
// (offline-first, same as the rest of the app).

export interface InvoiceItem { desc: string; qty: number; unit: string; price: number }
export interface Product { desc: string; unit: string; price: number }
export interface SavedInvoice {
  id: string;
  no: number;
  billTo: string;
  items: InvoiceItem[];
  total: number;
  dateISO: string;
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

/* ── Customers ──────────────────────────────── */
export function loadCustomers(): string[] { return read<string>(C_KEY); }
export function addCustomer(name: string) {
  const n = name.trim();
  if (!n) return;
  const list = loadCustomers().filter((c) => c.toLowerCase() !== n.toLowerCase());
  write(C_KEY, [n, ...list].slice(0, 100));
  notify();
}

/* ── Item / product presets ─────────────────── */
export function loadProducts(): Product[] { return read<Product>(P_KEY); }
export function addProduct(p: Product) {
  const desc = p.desc.trim();
  if (!desc) return;
  const list = loadProducts().filter((x) => x.desc.toLowerCase() !== desc.toLowerCase());
  write(P_KEY, [{ desc, unit: p.unit, price: p.price }, ...list].slice(0, 200));
  notify();
}

/* ── Saved invoices ─────────────────────────── */
export function loadInvoices(): SavedInvoice[] { return read<SavedInvoice>(I_KEY); }
export function saveInvoice(inv: SavedInvoice): SavedInvoice[] {
  const list = loadInvoices().filter((x) => x.id !== inv.id);
  const updated = [inv, ...list].slice(0, 100);
  write(I_KEY, updated);
  notify();
  return updated;
}
export function deleteInvoice(id: string): SavedInvoice[] {
  const updated = loadInvoices().filter((x) => x.id !== id);
  write(I_KEY, updated);
  notify();
  return updated;
}
export function invoiceId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
