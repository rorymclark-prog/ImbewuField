// The "See a sample farm" demo dataset — Ubhejane Creche, a real food garden
// at a creche/pre-school on the KZN coastal hinterland (Durban area, mild
// winter frost, summer rainfall). DEMO_SITE's lat/lon are genuine: the app's
// own /api/location-data fetch and the satellite background both resolve
// real climate/soil/rainfall/elevation data for this spot. Everything below
// this point — the beds, the crop plan, the sales/expenses/invoices — is
// hand-authored illustrative sample data, not a record of the real creche's
// actual finances or layout.
//
// creche photos: owner to supply. This dataset deliberately has no photo
// gallery entries — DataPanel's Photos tab shows only the real satellite
// imagery for the demo; inventing ground-level photos would misrepresent
// the real site.
//
// Pure data + pure builder functions only — no I/O, no localStorage,
// no Firestore. lib/sample-mode.ts is the only caller.

import type { CropPlanState, Planting } from './crop-plan';
import type { FacilitatorDesignState, FacItem, FacLine, FacSector, LayerId } from './facilitator-design';
import type { SalesLog, ExpenseLog, ProductionLog, Profile } from './db/types';
import type { SavedInvoice, Product } from './invoices';

export const DEMO_SITE = { lat: -27.726231, lon: 31.963044, name: 'Ubhejane Creche' };

// A fictional caretaker profile so ProfileSheet has something plausible to
// display/edit during the demo — never a real signed-in user's profile, and
// edits to it only ever touch the in-memory sandbox (lib/sample-mode.ts).
export function buildDemoProfile(): Profile {
  return {
    id: 'demo', full_name: 'Sample Farmer', role: 'farmer', org_id: 'demo-org-ubhejane',
    language: 'en', id_number: null, phone: null, photo_url: null,
    created_at: new Date().toISOString(),
    bio: 'Caretaker of the Ubhejane Creche food garden.',
    skills: ['soil health', 'water harvesting'],
    showOnMap: false, mapLat: null, mapLon: null,
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/* ── Facilitator design: a plausible small creche food-garden layout ─────
   Positions are METRES relative to the background satellite image's
   top-left corner (geomVersion 2 — see lib/facilitator-design.ts), so they
   render correctly whatever container size actually loads the real
   satellite for DEMO_SITE. x/y (stage px) are left at 0 — FacilitatorCanvas
   recomputes them from xM/yM against the freshly-fetched satellite rect,
   the same as any other geomVersion-2 design on load. */

interface BedDef { id: string; xM: number; yM: number; wM: number; hM: number; type: 'bed' | 'hugel' }

const BED_DEFS: BedDef[] = [
  { id: 'demo-bed-1', xM: 4, yM: 12, wM: 1.5, hM: 4, type: 'bed' },
  { id: 'demo-bed-2', xM: 6.5, yM: 12, wM: 1.5, hM: 4, type: 'bed' },
  { id: 'demo-bed-3', xM: 9, yM: 12, wM: 1.5, hM: 4, type: 'bed' },
  { id: 'demo-bed-4', xM: 4, yM: 17, wM: 1.5, hM: 4, type: 'bed' },
  { id: 'demo-bed-5', xM: 6.5, yM: 17, wM: 1.5, hM: 4, type: 'bed' },
  { id: 'demo-bed-6', xM: 9, yM: 17, wM: 2, hM: 4, type: 'bed' },
  { id: 'demo-hugel-1', xM: 12, yM: 13, wM: 2, hM: 3, type: 'hugel' },
];

export function buildDemoFacilitatorState(): FacilitatorDesignState {
  const items: FacItem[] = [
    ...BED_DEFS.map((b) => ({
      id: b.id, type: b.type, x: 0, y: 0, xM: b.xM, yM: b.yM, wM: b.wM, hM: b.hM, rotation: 0,
      layer: 'planting' as LayerId,
    })),
    { id: 'demo-tank-1', type: 'tank', x: 0, y: 0, xM: 2, yM: 3, wM: 1.2, hM: 1.2, rotation: 0, litres: 2500, layer: 'water' as LayerId },
    { id: 'demo-compost-1', type: 'compost', x: 0, y: 0, xM: 13, yM: 3, wM: 1.5, hM: 1.5, rotation: 0, layer: 'structures' as LayerId },
  ];

  const lines: FacLine[] = [
    { id: 'demo-fence-1', kind: 'fence', points: [], closed: true, layer: 'existing' as LayerId, pointsM: [2, 2, 38, 2, 38, 26, 2, 26] },
    { id: 'demo-path-1', kind: 'path', points: [], layer: 'access' as LayerId, pointsM: [20, 2, 20, 11] },
  ];

  const sectors: FacSector[] = [
    { id: 'demo-sector-sun', kind: 'sun_winter', x: 0, y: 0, xM: 20, yM: 0, rotation: 90, radiusM: 30, spanDeg: 60 },
    { id: 'demo-sector-wind', kind: 'wind', x: 0, y: 0, xM: 38, yM: 14, rotation: 200, radiusM: 40, spanDeg: 45 },
  ];

  return {
    version: 1,
    geomVersion: 2,
    items,
    lines,
    sectors,
    pxPerM: 5,
    activeLayer: 'planting',
    hiddenLayers: [],
    bgSite: DEMO_SITE,
    title: 'Ubhejane Creche — sample garden',
    savedAt: Date.now(),
  };
}

/* ── Crop plan: a full year across the 7 beds above ───────────────────────
   'mild-frost' rain pattern (summer rainfall, mild winter frost — matches
   DEMO_SITE). Mixes already-growing (existing:true) plantings with future
   ones, reuses each bed across the year (rotation), stacks a staggered
   3-way lettuce succession on demo-bed-3, and genuinely intercrops lettuce +
   carrots on demo-bed-6 (sown the same month, so their sow→harvest windows
   actually overlap — the intercrop detector keys off that window, not the
   longer post-harvest fresh/storage life) — the same rotation/succession/
   intercrop features the crop planner already supports, all visible in one
   seeded plan. */

export function buildDemoCropPlan(): CropPlanState {
  const plantings: Planting[] = [
    { id: 'demo-planting-1', bedId: 'demo-bed-1', cropKey: 'swiss-chard', sowMonth: 4, existing: true },
    { id: 'demo-planting-2', bedId: 'demo-bed-1', cropKey: 'green-beans', sowMonth: 10 },
    { id: 'demo-planting-3', bedId: 'demo-bed-1', cropKey: 'broccoli', sowMonth: 2 },

    { id: 'demo-planting-4', bedId: 'demo-bed-2', cropKey: 'cabbage', sowMonth: 3, existing: true },
    { id: 'demo-planting-5', bedId: 'demo-bed-2', cropKey: 'carrots', sowMonth: 7 },
    { id: 'demo-planting-6', bedId: 'demo-bed-2', cropKey: 'tomatoes', sowMonth: 10 },

    { id: 'demo-planting-7', bedId: 'demo-bed-3', cropKey: 'lettuce', sowMonth: 5, areaFraction: 1 / 3, existing: true },
    { id: 'demo-planting-8', bedId: 'demo-bed-3', cropKey: 'lettuce', sowMonth: 7, areaFraction: 1 / 3 },
    { id: 'demo-planting-9', bedId: 'demo-bed-3', cropKey: 'lettuce', sowMonth: 9, areaFraction: 1 / 3 },

    { id: 'demo-planting-10', bedId: 'demo-bed-4', cropKey: 'onions', sowMonth: 4, existing: true },
    { id: 'demo-planting-11', bedId: 'demo-bed-4', cropKey: 'maize', sowMonth: 10 },

    { id: 'demo-planting-12', bedId: 'demo-bed-5', cropKey: 'garlic', sowMonth: 5, existing: true },

    { id: 'demo-planting-13', bedId: 'demo-bed-6', cropKey: 'lettuce', sowMonth: 4, areaFraction: 0.5, existing: true },
    { id: 'demo-planting-14', bedId: 'demo-bed-6', cropKey: 'carrots', sowMonth: 4, areaFraction: 0.5, existing: true },
    { id: 'demo-planting-15', bedId: 'demo-bed-6', cropKey: 'butternut', sowMonth: 12 },

    { id: 'demo-planting-16', bedId: 'demo-hugel-1', cropKey: 'sweet-potato', sowMonth: 10 },
  ];

  return { version: 1, plantings, updatedAt: Date.now() };
}

/* ── Finance: illustrative sales/expenses/production/invoices ────────────
   Crop/item names carry the same "Sample — " prefix the finances page's own
   loadSampleData() already uses — lib/harvest-reconciliation.ts's normalize()
   strips it, so these entries both read as obviously-demo AND reconcile
   correctly against the crop plan above. All amounts are illustrative ZAR
   placeholders for a small KZN creche garden, not real financial figures. */

export interface DemoFinance {
  sales: SalesLog[];
  expenses: ExpenseLog[];
  production: ProductionLog[];
  invoices: SavedInvoice[];
  customers: string[];
  products: Product[];
}

export function buildDemoFinance(): DemoFinance {
  const sale = (n: number, over: Partial<SalesLog>): SalesLog => ({
    id: `demo-sale-${n}`, profile_id: 'demo', garden_id: null,
    crop: '', kg: 0, amount: 0, buyer: null, sold_at: daysAgo(0), created_at: daysAgo(0),
    ...over,
  });
  const expense = (n: number, over: Partial<ExpenseLog>): ExpenseLog => ({
    id: `demo-expense-${n}`, profile_id: 'demo', garden_id: null,
    item: '', amount: 0, supplier: null, spent_at: daysAgo(0), created_at: daysAgo(0),
    ...over,
  });
  const production = (n: number, over: Partial<ProductionLog>): ProductionLog => ({
    id: `demo-production-${n}`, profile_id: 'demo', garden_id: null,
    crop: '', kg: 0, photo_url: null, logged_at: daysAgo(0), created_at: daysAgo(0),
    ...over,
  });

  const sales: SalesLog[] = [
    sale(1, { crop: 'Sample — spinach', kg: 4, amount: 120, buyer: 'Local spaza shop', sold_at: daysAgo(3) }),
    sale(2, { crop: 'Sample — cabbage', kg: 6, amount: 90, buyer: 'Ubhejane parents', sold_at: daysAgo(6) }),
    sale(3, { crop: 'Sample — eggs', kg: 2, amount: 90, buyer: 'Local spaza shop', sold_at: daysAgo(8) }),
    sale(4, { crop: 'Sample — spinach', kg: 5, amount: 150, buyer: 'Nquthu co-op', sold_at: daysAgo(14) }),
    sale(5, { crop: 'Sample — lettuce', kg: 3, amount: 90, buyer: 'Ubhejane parents', sold_at: daysAgo(11) }),
    sale(6, { crop: 'Sample — carrots', kg: 2.5, amount: 35, buyer: 'Local spaza shop', sold_at: daysAgo(20) }),
    sale(7, { crop: 'Sample — cabbage', kg: 4, amount: 60, buyer: 'Nquthu co-op', sold_at: daysAgo(25) }),
  ];

  const expenses: ExpenseLog[] = [
    expense(1, { item: 'Sample — seedlings & seed', amount: 180, supplier: 'Agri Co-op', category: 'seed', spent_at: daysAgo(5) }),
    expense(2, { item: 'Sample — compost & kraal manure', amount: 240, supplier: 'Local supplier', category: 'other', spent_at: daysAgo(9) }),
    expense(3, { item: 'Sample — JoJo tank (2500L)', amount: 3200, supplier: 'Hardware store', category: 'equipment', spent_at: daysAgo(40) }),
    expense(4, { item: 'Sample — fencing wire & poles', amount: 650, supplier: 'Hardware store', category: 'equipment', spent_at: daysAgo(35) }),
    expense(5, { item: 'Sample — transport to market', amount: 80, supplier: null, category: 'transport', spent_at: daysAgo(12) }),
    expense(6, { item: 'Sample — chicken feed', amount: 150, supplier: 'Agri Co-op', category: 'feed', spent_at: daysAgo(15) }),
  ];

  const production_: ProductionLog[] = [
    production(1, { crop: 'Sample — swiss chard', kg: 4, logged_at: daysAgo(10) }),
    production(2, { crop: 'Sample — cabbage', kg: 6, logged_at: daysAgo(18) }),
    production(3, { crop: 'Sample — carrots', kg: 3, logged_at: daysAgo(25) }),
    production(4, { crop: 'Sample — lettuce', kg: 2.5, logged_at: daysAgo(12) }),
    production(5, { crop: 'Sample — swiss chard', kg: 3.5, logged_at: daysAgo(3) }),
  ];

  const invoices: SavedInvoice[] = [
    {
      id: 'demo-invoice-1', no: 9101, billTo: 'Sample — Ubhejane parents fund',
      items: [{ desc: 'Sample — spinach', qty: 5, unit: 'kg', price: 30 }],
      total: 150, dateISO: daysAgo(20), status: 'paid', paidAt: daysAgo(17),
    },
    {
      id: 'demo-invoice-2', no: 9102, billTo: 'Sample — Nquthu Spaza Shop',
      items: [{ desc: 'Sample — cabbage', qty: 8, unit: 'kg', price: 15 }],
      total: 120, dateISO: daysAgo(4), status: 'unpaid',
    },
  ];

  const customers = ['Sample — Ubhejane parents fund', 'Sample — Nquthu Spaza Shop'];
  const products: Product[] = [
    { desc: 'Sample — spinach', unit: 'kg', price: 30 },
    { desc: 'Sample — cabbage', unit: 'kg', price: 15 },
  ];

  return { sales, expenses, production: production_, invoices, customers, products };
}
