// Session-scoped "sample mode" — lets an NGO evaluator see a fully-populated
// demo farm (Ubhejane Creche, lib/demo-farm.ts) without ever touching a real
// farmer's data. The ON/OFF flag lives in sessionStorage (survives a reload
// or a shared deep-link in THIS tab, but is invisible to other tabs and
// clears the instant the tab closes); the demo DATA itself lives only in
// this module's in-memory sandbox and is never written to localStorage or
// Firestore. Every real loader/saver in lib/crop-plan.ts,
// lib/facilitator-design.ts and lib/invoices.ts checks isSampleMode() first
// and, if true, reads/writes the sandbox instead — real storage keys are
// structurally unreachable while sampling, not merely "usually skipped".
// These narrow getters/setters are the ONLY way any other module touches
// sandbox data — one auditable choke point instead of scattered conditionals.

import type { CropPlanState, CashflowSettings } from './crop-plan';
import type { FacilitatorDesignState } from './facilitator-design';
import type { SalesLog, ExpenseLog, ProductionLog, Profile } from './db/types';
import type { SavedInvoice, Product } from './invoices';
import type { SavedPlace } from './saved-places';
import { buildDemoCropPlan, buildDemoFacilitatorState, buildDemoFinance, buildDemoProfile } from './demo-farm';

const FLAG_KEY = 'imbewu_sample_mode';
export const SAMPLE_MODE_EVENT = 'imbewu-sample-mode-changed';

interface SampleSandbox {
  cropPlan: CropPlanState;
  favouriteCropKeys: Set<string>;
  allowBedSharing: boolean;
  cashflowSettings: CashflowSettings;
  facilitatorDesign: FacilitatorDesignState | null;
  sales: SalesLog[];
  expenses: ExpenseLog[];
  production: ProductionLog[];
  invoices: SavedInvoice[];
  customers: string[];
  products: Product[];
  profile: Profile;
  places: SavedPlace[];
}

let sandbox: SampleSandbox | null = null;

// allowBedSharing defaults ON here (unlike the real app's off-by-default) so
// the demo's kale/beetroot intercrop on demo-bed-6 renders as intended
// without the evaluator having to find and flip a settings toggle first.
function freshSandbox(): SampleSandbox {
  const finance = buildDemoFinance();
  return {
    cropPlan: buildDemoCropPlan(),
    favouriteCropKeys: new Set(),
    allowBedSharing: true,
    cashflowSettings: { sellPercent: 100, lossPercent: 0 },
    facilitatorDesign: buildDemoFacilitatorState(),
    sales: finance.sales,
    expenses: finance.expenses,
    production: finance.production,
    invoices: finance.invoices,
    customers: finance.customers,
    products: finance.products,
    profile: buildDemoProfile(),
    places: [], // demo starts with none saved — "Save this place" adds one for the session only
  };
}

function ensure(): SampleSandbox {
  if (!sandbox) sandbox = freshSandbox();
  return sandbox;
}

export function isSampleMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

export function enterSampleMode(): void {
  if (typeof window === 'undefined') return;
  sandbox = freshSandbox(); // always a clean slate — never a previous demo session's edits
  try { window.sessionStorage.setItem(FLAG_KEY, '1'); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(SAMPLE_MODE_EVENT));
}

// Callers should follow this with a hard window.location.href navigation
// (not client-side routing) so every mounted component remounts and re-reads
// through the now-genuinely-real loaders — nothing demo-shaped can linger in
// React state after exit.
export function exitSampleMode(): void {
  if (typeof window === 'undefined') return;
  sandbox = null;
  try { window.sessionStorage.removeItem(FLAG_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(SAMPLE_MODE_EVENT));
}

function genId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Crop plan ────────────────────────────────────────────────────────── */
export function getSandboxCropPlan(): CropPlanState { return ensure().cropPlan; }
export function setSandboxCropPlan(s: CropPlanState): void { ensure().cropPlan = s; }
export function getSandboxFavouriteCropKeys(): Set<string> { return ensure().favouriteCropKeys; }
export function setSandboxFavouriteCropKeys(keys: Set<string>): void { ensure().favouriteCropKeys = keys; }
export function getSandboxAllowBedSharing(): boolean { return ensure().allowBedSharing; }
export function setSandboxAllowBedSharing(allow: boolean): void { ensure().allowBedSharing = allow; }
export function getSandboxCashflowSettings(): CashflowSettings { return ensure().cashflowSettings; }
export function setSandboxCashflowSettings(s: CashflowSettings): void { ensure().cashflowSettings = s; }

/* ── Facilitator design ───────────────────────────────────────────────── */
export function getSandboxFacilitatorState(): FacilitatorDesignState | null { return ensure().facilitatorDesign; }
export function setSandboxFacilitatorState(s: FacilitatorDesignState): void { ensure().facilitatorDesign = s; }
export function clearSandboxFacilitatorState(): void { ensure().facilitatorDesign = null; }

/* ── Sales / expenses / production ───────────────────────────────────── */
export function getSandboxSales(): SalesLog[] { return ensure().sales; }
export function addSandboxSale(row: Partial<SalesLog>): void {
  const s = ensure();
  const full: SalesLog = {
    id: genId(), profile_id: 'demo', garden_id: null, crop: '', kg: 0, amount: 0,
    buyer: null, sold_at: new Date().toISOString(), created_at: new Date().toISOString(),
    ...row,
  };
  s.sales = [full, ...s.sales];
}
export function updateSandboxSale(id: string, patch: Partial<SalesLog>): void {
  const s = ensure();
  s.sales = s.sales.map((row) => (row.id === id ? { ...row, ...patch } : row));
}
export function deleteSandboxSale(id: string): void {
  const s = ensure();
  s.sales = s.sales.filter((row) => row.id !== id);
}

export function getSandboxExpenses(): ExpenseLog[] { return ensure().expenses; }
export function addSandboxExpense(row: Partial<ExpenseLog>): void {
  const s = ensure();
  const full: ExpenseLog = {
    id: genId(), profile_id: 'demo', garden_id: null, item: '', amount: 0,
    supplier: null, spent_at: new Date().toISOString(), created_at: new Date().toISOString(),
    ...row,
  };
  s.expenses = [full, ...s.expenses];
}
export function updateSandboxExpense(id: string, patch: Partial<ExpenseLog>): void {
  const s = ensure();
  s.expenses = s.expenses.map((row) => (row.id === id ? { ...row, ...patch } : row));
}
export function deleteSandboxExpense(id: string): void {
  const s = ensure();
  s.expenses = s.expenses.filter((row) => row.id !== id);
}

export function getSandboxProduction(): ProductionLog[] { return ensure().production; }
export function addSandboxProduction(row: Partial<ProductionLog>): void {
  const s = ensure();
  const full: ProductionLog = {
    id: genId(), profile_id: 'demo', garden_id: null, crop: '', kg: 0,
    photo_url: null, logged_at: new Date().toISOString(), created_at: new Date().toISOString(),
    ...row,
  };
  s.production = [full, ...s.production];
}
export function deleteSandboxProduction(id: string): void {
  const s = ensure();
  s.production = s.production.filter((row) => row.id !== id);
}

/* ── Invoices ─────────────────────────────────────────────────────────── */
export function getSandboxInvoices(): SavedInvoice[] { return ensure().invoices; }
export function setSandboxInvoices(list: SavedInvoice[]): void { ensure().invoices = list; }
export function getSandboxCustomers(): string[] { return ensure().customers; }
export function setSandboxCustomers(list: string[]): void { ensure().customers = list; }
export function getSandboxProducts(): Product[] { return ensure().products; }
export function setSandboxProducts(list: Product[]): void { ensure().products = list; }

/* ── Profile ──────────────────────────────────────────────────────────── */
export function getSandboxProfile(): Profile { return ensure().profile; }
export function setSandboxProfile(patch: Partial<Profile>): void {
  const s = ensure();
  s.profile = { ...s.profile, ...patch };
}

/* ── Saved places ─────────────────────────────────────────────────────── */
export function getSandboxPlaces(): SavedPlace[] { return ensure().places; }
export function upsertSandboxPlace(place: SavedPlace): SavedPlace[] {
  const s = ensure();
  s.places = [place, ...s.places.filter((p) => p.id !== place.id)];
  return s.places;
}
export function deleteSandboxPlace(id: string): SavedPlace[] {
  const s = ensure();
  s.places = s.places.filter((p) => p.id !== id);
  return s.places;
}
