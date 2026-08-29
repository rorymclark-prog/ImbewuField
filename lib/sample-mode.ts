// Session-scoped "sample mode" — lets anyone see a fully-populated demo farm
// (Ubhejane Creche, lib/demo-farm.ts) without ever touching a real farmer's
// data. The ON/OFF flag lives in sessionStorage (survives a reload or a shared
// deep-link in THIS tab, but is invisible to other tabs and clears the instant
// the tab closes); the demo DATA lives only in memory and is never written to
// real localStorage or Firestore.
//
// TWO safety layers, both required (this is the v2 rearchitecture of the parked
// v1, which a data-safety review killed — see commit 0d1326a):
//
// 1. THE ROOT STORAGE SHIM (this file, installStorageShim below): while sample
//    mode is on, EVERY window.localStorage read/write — no matter which of the
//    app's local-storage writers — Map.tsx farm shapes, water points, site
//    elements, design canvas, surveys, caches and more — is redirected to an in-memory
//    store seeded from the demo farm. Real localStorage is structurally
//    unreachable because the PRIMITIVE is patched, not because each caller
//    remembered to check.
// 2. FIRESTORE GATES at the sync choke points (lib/user-sync.ts,
//    lib/design-canvas-sync.ts, lib/db/queries.ts, lib/render-jobs.ts,
//    lib/site-share.ts): every remote reconcile/push no-ops in sample mode, so
//    mounting the map/design pages can never sync sandbox data into a signed-in
//    user's cloud copy — or pull their real cloud data into the sample. The
//    SAME gate (SAMPLE_MODE_RENDER_REFUSAL below) also sits in the two DIRECT
//    render callers that bypass lib/render-jobs.ts's queue entirely —
//    lib/ai-render-client.ts's requestRender and DesignGlossy's requestProducer
//    — because a billed /api/ai-render or /api/image-producer call is exactly
//    as real a leak as an unguarded Firestore write.
//
// On top of that, Firestore-backed VIEW data (crop plan, finances, invoices,
// profile) reads/writes the typed sandbox below via the narrow getters/setters —
// one auditable choke point instead of scattered conditionals.

import type { CropPlanState, CashflowSettings } from './crop-plan';
import type { FacilitatorDesignState } from './facilitator-design';
import type { SalesLog, ExpenseLog, ProductionLog, Profile } from './db/types';
import type { SavedInvoice, Product, Customer } from './invoices';
import type { SellerLetterhead } from './invoice-seller';
import type { SavedPlace } from './saved-places';
import { buildDemoCropPlan, buildDemoFacilitatorState, buildDemoFinance, buildDemoLetterhead, buildDemoProfile, buildDemoSavedPlace, buildDemoStorageSeeds } from './demo-farm';

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
  customers: Customer[];
  letterhead: SellerLetterhead;
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
    // Keep in lockstep with DEFAULT_CASHFLOW_SETTINGS in crop-plan.ts (a value
    // import here would be circular — crop-plan imports this module). The
    // cashflow-loss-default test asserts the two stay equal.
    cashflowSettings: { sellPercent: 100, lossPercent: 25, confirmed: false },
    facilitatorDesign: buildDemoFacilitatorState(),
    sales: finance.sales,
    expenses: finance.expenses,
    production: finance.production,
    invoices: finance.invoices,
    customers: finance.customers,
    letterhead: buildDemoLetterhead(),
    products: finance.products,
    profile: buildDemoProfile(),
    // The crèche arrives pre-saved so the saved-places list, the farmer map and the Design
    // entry point all light up immediately (loadPlaces() serves THIS list in sample mode —
    // the localStorage seed alone never reaches it).
    places: [buildDemoSavedPlace()],
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

/**
 * Sample farm is look-don't-spend: every route that bills a real vendor account must refuse while
 * sampling, and say so in the farmer's own words rather than failing silently. lib/render-jobs.ts's
 * queue uses this for its own refusal, and so do the two DIRECT /api/ai-render and
 * /api/image-producer callers that bypass the queue — lib/ai-render-client.ts's requestRender and
 * DesignGlossy's requestProducer (analysis styles and "style all sheets") — so a farmer sees
 * identical text no matter which render path they hit.
 */
export const SAMPLE_MODE_RENDER_REFUSAL =
  'AI sheets are switched off in the sample farm. Exit the sample and open your own farm to render AI sheets.';

export function enterSampleMode(): boolean {
  if (typeof window === 'undefined') return false;
  sandbox = freshSandbox(); // always a clean slate — never a previous demo session's edits
  resetShimStore(); // reseed the localStorage shim too
  try {
    window.sessionStorage.setItem(FLAG_KEY, '1');
    // A storage implementation can silently refuse a write (privacy/quota modes), so
    // verify the flag before callers navigate into a view that promises demo isolation.
    if (window.sessionStorage.getItem(FLAG_KEY) !== '1') throw new Error('sample flag refused');
  } catch {
    sandbox = null;
    resetShimStore();
    try { window.sessionStorage.removeItem(FLAG_KEY); } catch { /* best-effort cleanup */ }
    return false;
  }
  window.dispatchEvent(new CustomEvent(SAMPLE_MODE_EVENT));
  return true;
}

// Callers should follow this with a hard window.location.href navigation
// (not client-side routing) so every mounted component remounts and re-reads
// through the now-genuinely-real loaders — nothing demo-shaped can linger in
// React state after exit.
export function exitSampleMode(): void {
  if (typeof window === 'undefined') return;
  sandbox = null;
  resetShimStore();
  try { window.sessionStorage.removeItem(FLAG_KEY); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(SAMPLE_MODE_EVENT));
}

/* ── Safety layer 1: the root localStorage shim ───────────────────────────
   Patches Storage.prototype ONCE at module evaluation (this module is imported
   by SampleModeBanner, which the root layout mounts on every page, so the patch
   is in place before any user interaction). The patched methods delegate to the
   originals unless BOTH hold: the receiver is window.localStorage (sessionStorage
   — which carries the sample flag itself — is deliberately untouched), AND sample
   mode is on. While sampling, reads see ONLY the seeded in-memory store (a real
   user's local data can never leak into the sample UI) and writes land ONLY there
   (the sample can never clobber real data).

   Enumeration caveat, deliberate: Object.keys(localStorage)/.length/.key() still
   list REAL key names (own props aren't shadowed by a prototype patch). That is
   read-only NAME leakage: any getItem on those names answers from the sandbox and
   any removeItem lands in the sandbox, so the app's cache-cleanup scans
   (lib/design-canvas.ts, DesignGlossy) can neither read nor delete real values
   while sampling.

   The memory store LAZILY seeds from lib/demo-farm's buildDemoStorageSeeds() —
   lazy, not eager at enterSampleMode only, because the flag survives a reload
   (sessionStorage) while module state does not: the first localStorage touch of
   the reloaded sample tab must find the crèche already there. */

let shimStore: Map<string, string> | null = null;

function resetShimStore(): void {
  shimStore = null;
}

function shimStoreEnsured(): Map<string, string> {
  if (!shimStore) {
    // Lazy import cycle-breaker not needed: demo-farm is pure data/builders and
    // never reads storage, so seeding from inside a patched method cannot recurse.
    shimStore = new Map(Object.entries(buildDemoStorageSeeds()));
  }
  return shimStore;
}

function installStorageShim(): void {
  if (typeof window === 'undefined' || typeof Storage === 'undefined') return;
  const g = window as unknown as Record<string, unknown>;
  if (g.__imbewuSampleStorageShim) return; // idempotent across HMR / duplicate loads
  g.__imbewuSampleStorageShim = true;

  const proto = Storage.prototype;
  const orig = {
    getItem: proto.getItem,
    setItem: proto.setItem,
    removeItem: proto.removeItem,
    clear: proto.clear,
  };

  const shimmed = (self: Storage): boolean => {
    try {
      return self === window.localStorage && isSampleMode();
    } catch {
      return false; // privacy modes where touching localStorage throws → leave originals in charge
    }
  };

  proto.getItem = function (key: string): string | null {
    if (shimmed(this)) { const v = shimStoreEnsured().get(String(key)); return v === undefined ? null : v; }
    return orig.getItem.call(this, key);
  };
  proto.setItem = function (key: string, value: string): void {
    if (shimmed(this)) { shimStoreEnsured().set(String(key), String(value)); return; }
    orig.setItem.call(this, key, value);
  };
  proto.removeItem = function (key: string): void {
    if (shimmed(this)) { shimStoreEnsured().delete(String(key)); return; }
    orig.removeItem.call(this, key);
  };
  proto.clear = function (): void {
    if (shimmed(this)) { shimStoreEnsured().clear(); return; }
    orig.clear.call(this);
  };
}

installStorageShim();

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
export function getSandboxLetterhead(): SellerLetterhead { return ensure().letterhead; }
export function setSandboxLetterhead(value: SellerLetterhead): void { ensure().letterhead = value; }
export function getSandboxCustomers(): Customer[] { return ensure().customers; }
export function setSandboxCustomers(list: Customer[]): void { ensure().customers = list; }
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
