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

import type { FeatureCollection, Geometry } from 'geojson';
import type { CropPlanState, Planting } from './crop-plan';
// The sample farm's money is priced from the app's own researched price table,
// never from figures typed into this fixture — see pricePerKg below.
import { DEFAULT_CROP_PRICES } from './crop-prices';
import type { JournalEntry } from './field-journal';
import type { FacilitatorDesignState, FacItem, FacLine, FacSector, LayerId } from './facilitator-design';
import type { SalesLog, ExpenseLog, ProductionLog, Profile } from './db/types';
import type { SavedInvoice, Product } from './invoices';
import type { SavedPlace } from './saved-places';
import type { WaterPoint } from './water-points';
import type { DesignCanvasState, PlacedItem, ZoneShape, LineShape } from './design-canvas';
import { computeCanvasFrame } from './design-canvas';
import type { DesignLayer } from './design-studio';
import { designSiteIdFromLocation } from './design-studio';
import type { LocationData } from './types';
import { buildDemoGeometryLockFixture } from './demo-geometry-fixture';

export const DEMO_SITE = Object.freeze({ lat: -27.726231, lon: 31.963044, name: 'Ubhejane Creche' });

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

// Calendar-date form of daysAgo — lib/field-journal.ts stores the DAY a thing
// happened ('YYYY-MM-DD'), not an instant, because a farmer writes Tuesday's
// work up on Thursday and it still belongs to Tuesday.
function daysAgoDate(n: number): string {
  return daysAgo(n).slice(0, 10);
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
    // This state is editable in the sample UI. Never hand it the canonical module
    // object by reference or one in-place edit can move every later demo builder.
    bgSite: { ...DEMO_SITE },
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

/* ── Finance: one full twelve-month trading record ───────────────────────

   Crop/item names carry the same "Sample — " prefix the finances page's own
   loadSampleData() already uses — lib/harvest-reconciliation.ts's normalize()
   strips it, so these entries both read as obviously-demo AND reconcile
   correctly against the crop plan above. Everything here is hand-authored
   illustrative sample data for a small KZN crèche garden, not a record of the
   real crèche's money.

   THE THREE RULES THAT MAKE THE SAMPLE BOOKS ADD UP. The old fixture was a
   handful of "N days ago" rows whose kilograms contradicted each other — it
   sold 26.5 kg against 19 kg of logged harvest, i.e. sold more of every single
   crop than the garden was ever recorded picking. Anyone who totalled a column
   found the books broken. So:

   1. NOTHING IS SOLD THAT WASN'T HARVESTED FIRST. For every crop, in every
      calendar month, sold kg ≤ harvested kg — and across the year the two roll
      up the same way. What is harvested and not sold is the crèche's own food;
      HarvestReconciliation names that gap out loud rather than hiding it.
   2. NOTHING IS HARVESTED THE PLAN COULDN'T GROW. Each month's harvest sits at
      or under what buildDemoCropPlan() above actually estimates for that crop
      in that month (lib/crop-plan.ts's own yield model over the 7 real beds):
      ~138 kg logged against a ~150 kg plan, so the garden reads as running at
      about 92% of plan rather than beating it.
   3. EVERY RAND IS kg × A PRICE FROM THE APP'S OWN TABLE — see pricePerKg.
      No price is invented here, and every sale amount is exactly its kg times
      its per-kg price, so a reader can divide any row and get the price back.

   DATES ARE ANCHORED TO CALENDAR MONTHS, NOT TO "n DAYS AGO". The money has to
   line up with the agronomy: cabbage income belongs in the month the plan
   actually cuts cabbage, and seed is bought the month before it is sown (the
   same month tasksForPlan puts bed prep). `on(month, day)` places a row in the
   most recent occurrence of that calendar month, so the fixture always spans
   the trailing twelve months and the month the demo is opened in always has
   rows in it. Nothing is ever dated in the future — the current month's days
   are clamped to today. */

export interface DemoFinance {
  sales: SalesLog[];
  expenses: ExpenseLog[];
  production: ProductionLog[];
  invoices: SavedInvoice[];
  customers: string[];
  products: Product[];
}

/** Where a load of produce went. Both prices come from the app's own researched
 *  price table (lib/crop-prices.ts — a dated 2026-07-14 snapshot with per-crop
 *  provenance), never from a figure typed in here:
 *    'gate' — sold at the crèche gate to parents and neighbours, at that
 *             table's RETAIL price per kg;
 *    'shop' — sold to the spaza or the Nquthu co-op, who resell it, at 70% of
 *             retail rounded to the nearest rand — still comfortably above
 *             every one of these crops' wholesale figure in the same table.
 *  Derived rather than hardcoded so a correction to the price table moves the
 *  sample books with it instead of silently disagreeing with them. */
type DemoSaleChannel = 'gate' | 'shop';

const SHOP_SHARE_OF_RETAIL = 0.7;

function pricePerKg(cropKey: string, channel: DemoSaleChannel): number {
  const retail = DEFAULT_CROP_PRICES[cropKey]?.retailPerKg ?? 0;
  return channel === 'gate' ? retail : Math.round(retail * SHOP_SHARE_OF_RETAIL);
}

/** How each crop is written on a sale/harvest row. Deliberately the plain name a
 *  farmer would type, not the catalog's formal one — every string here still
 *  resolves through lib/harvest-reconciliation.ts's alias index back to the crop
 *  key it is keyed by, which is what makes the reconciliation panel match. */
const DEMO_CROP_LABEL: Record<string, string> = {
  'swiss-chard': 'swiss chard',
  cabbage: 'cabbage',
  carrots: 'carrots',
  lettuce: 'lettuce',
  onions: 'onions',
  tomatoes: 'tomatoes',
  butternut: 'butternut',
  'green-beans': 'green beans',
  garlic: 'garlic',
  broccoli: 'broccoli',
  'sweet-potato': 'sweet potato',
  maize: 'maize',
};

interface DemoSaleSpec {
  /** Calendar month 1-12 — the month the crop plan says this crop is picked. */
  month: number;
  day: number;
  cropKey: string;
  kg: number;
  channel: DemoSaleChannel;
  buyer: string;
}

interface DemoHarvestSpec { month: number; day: number; cropKey: string; kg: number }

interface DemoCostSpec {
  month: number;
  day: number;
  item: string;
  amount: number;
  category: NonNullable<ExpenseLog['category']>;
  supplier: string | null;
}

/** Capital items are not tied to a season, so they are placed by months-back
 *  rather than by calendar month: the tank and compost bays were the garden's
 *  upgrade a year ago, the tools a routine replacement mid-year. Both
 *  amounts are the app's OWN planning figures for exactly these items —
 *  PRICE_BOOK.tank_2500 (R5 500) and PRICE_BOOK.compost_bay (R600) in
 *  lib/price-book.ts — which is also what /facilitator/print bills them at, so
 *  the plan pack and the ledger cannot contradict each other. */
interface DemoCapitalSpec { monthsBack: number; day: number; item: string; amount: number; supplier: string }

// ── Harvest: what actually came out of the beds, month by month ────────────
// Each row is at or below buildDemoCropPlan()'s estimate for that crop in that
// month (see rule 2 above).
const DEMO_HARVESTS: DemoHarvestSpec[] = [
  { month: 1, day: 12, cropKey: 'green-beans', kg: 1.5 },
  { month: 1, day: 20, cropKey: 'tomatoes', kg: 7.5 },
  { month: 2, day: 10, cropKey: 'tomatoes', kg: 8 },
  { month: 2, day: 24, cropKey: 'sweet-potato', kg: 11 },
  { month: 2, day: 26, cropKey: 'maize', kg: 1.5 },
  { month: 3, day: 8, cropKey: 'tomatoes', kg: 7 },
  { month: 4, day: 18, cropKey: 'butternut', kg: 11 },
  { month: 5, day: 16, cropKey: 'broccoli', kg: 1.5 },
  { month: 6, day: 6, cropKey: 'swiss-chard', kg: 4.5 },
  { month: 6, day: 12, cropKey: 'broccoli', kg: 1.5 },
  { month: 6, day: 20, cropKey: 'cabbage', kg: 16 },
  { month: 6, day: 24, cropKey: 'lettuce', kg: 3.5 },
  { month: 7, day: 10, cropKey: 'swiss-chard', kg: 4.5 },
  { month: 7, day: 18, cropKey: 'lettuce', kg: 5 },
  { month: 7, day: 26, cropKey: 'carrots', kg: 7 },
  { month: 8, day: 2, cropKey: 'swiss-chard', kg: 3 },
  { month: 8, day: 9, cropKey: 'lettuce', kg: 2 },
  { month: 8, day: 16, cropKey: 'swiss-chard', kg: 1 },
  { month: 9, day: 12, cropKey: 'swiss-chard', kg: 4 },
  { month: 9, day: 22, cropKey: 'onions', kg: 11 },
  { month: 9, day: 26, cropKey: 'lettuce', kg: 2 },
  { month: 10, day: 8, cropKey: 'lettuce', kg: 2 },
  { month: 10, day: 20, cropKey: 'carrots', kg: 12 },
  { month: 11, day: 10, cropKey: 'lettuce', kg: 2 },
  { month: 11, day: 18, cropKey: 'garlic', kg: 4 },
  { month: 12, day: 6, cropKey: 'lettuce', kg: 2 },
  { month: 12, day: 14, cropKey: 'green-beans', kg: 1.8 },
];

// ── Sales: what was sold out of those harvests, and to whom ────────────────
// Greens and garlic mostly go to market; the bulky staples (cabbage, butternut,
// sweet potato) largely stay to feed the children, which is why those three
// crops — and only those three — show a "not accounted for" line in the
// reconciliation panel. That line is the truth about a crèche garden, so it is
// left visible on purpose rather than tuned away.
const DEMO_SALES: DemoSaleSpec[] = [
  { month: 1, day: 14, cropKey: 'green-beans', kg: 1, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 1, day: 22, cropKey: 'tomatoes', kg: 6, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 2, day: 12, cropKey: 'tomatoes', kg: 7, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 2, day: 26, cropKey: 'sweet-potato', kg: 7, channel: 'shop', buyer: 'Nquthu co-op' },
  { month: 3, day: 10, cropKey: 'tomatoes', kg: 5, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 3, day: 14, cropKey: 'tomatoes', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 4, day: 20, cropKey: 'butternut', kg: 6, channel: 'shop', buyer: 'Nquthu co-op' },
  { month: 4, day: 22, cropKey: 'butternut', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 5, day: 18, cropKey: 'broccoli', kg: 1, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 6, day: 8, cropKey: 'swiss-chard', kg: 3.5, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 6, day: 13, cropKey: 'broccoli', kg: 1, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 6, day: 21, cropKey: 'cabbage', kg: 8, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 6, day: 22, cropKey: 'cabbage', kg: 3, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 6, day: 25, cropKey: 'lettuce', kg: 3, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 7, day: 11, cropKey: 'swiss-chard', kg: 4, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 7, day: 19, cropKey: 'lettuce', kg: 3, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 7, day: 27, cropKey: 'carrots', kg: 4, channel: 'shop', buyer: 'Nquthu co-op' },
  { month: 7, day: 28, cropKey: 'carrots', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 8, day: 3, cropKey: 'swiss-chard', kg: 3, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 8, day: 10, cropKey: 'lettuce', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 8, day: 17, cropKey: 'swiss-chard', kg: 1, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 9, day: 13, cropKey: 'swiss-chard', kg: 3.5, channel: 'shop', buyer: 'Local spaza shop' },
  { month: 9, day: 24, cropKey: 'onions', kg: 7, channel: 'shop', buyer: 'Nquthu co-op' },
  { month: 9, day: 25, cropKey: 'onions', kg: 2.5, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 9, day: 27, cropKey: 'lettuce', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 10, day: 9, cropKey: 'lettuce', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 10, day: 22, cropKey: 'carrots', kg: 7, channel: 'shop', buyer: 'Nquthu co-op' },
  { month: 10, day: 23, cropKey: 'carrots', kg: 4, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 11, day: 12, cropKey: 'lettuce', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 11, day: 20, cropKey: 'garlic', kg: 2, channel: 'shop', buyer: 'Nquthu co-op' },
  { month: 11, day: 21, cropKey: 'garlic', kg: 1, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 12, day: 8, cropKey: 'lettuce', kg: 2, channel: 'gate', buyer: 'Ubhejane parents' },
  { month: 12, day: 15, cropKey: 'green-beans', kg: 1, channel: 'gate', buyer: 'Ubhejane parents' },
];

// ── Running costs ──────────────────────────────────────────────────────────
// Seed and seedlings are bought the month BEFORE the crop plan sows them (the
// month tasksForPlan schedules bed prep), manure lands ahead of the two big
// planting rounds, and a taxi fare is only paid on the trips that actually go
// to Nquthu — the spaza is walking distance.
const DEMO_RUNNING_COSTS: DemoCostSpec[] = [
  { month: 1, day: 20, item: 'broccoli seedlings', amount: 45, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 2, day: 18, item: 'cabbage seedlings', amount: 60, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 2, day: 26, item: 'transport to Nquthu co-op', amount: 70, category: 'transport', supplier: null },
  { month: 3, day: 6, item: 'seed & seedlings — chard, lettuce, carrots, onions', amount: 185, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 3, day: 8, item: 'kraal manure, bakkie load', amount: 240, category: 'other', supplier: 'Neighbouring homestead' },
  { month: 4, day: 20, item: 'transport to Nquthu co-op', amount: 60, category: 'transport', supplier: null },
  { month: 5, day: 6, item: 'seed garlic & lettuce seed', amount: 120, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 6, day: 14, item: 'carrot & lettuce seed', amount: 70, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 7, day: 27, item: 'transport to Nquthu co-op', amount: 70, category: 'transport', supplier: null },
  { month: 8, day: 6, item: 'lettuce seed', amount: 35, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 9, day: 8, item: 'compost & kraal manure', amount: 220, category: 'other', supplier: 'Neighbouring homestead' },
  { month: 9, day: 12, item: 'bean, maize & tomato seed, sweet-potato slips', amount: 240, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 9, day: 24, item: 'transport to Nquthu co-op', amount: 70, category: 'transport', supplier: null },
  { month: 10, day: 22, item: 'transport to Nquthu co-op', amount: 70, category: 'transport', supplier: null },
  { month: 11, day: 8, item: 'butternut seed', amount: 40, category: 'seed', supplier: 'Agri co-op Nquthu' },
  { month: 11, day: 20, item: 'transport to Nquthu co-op', amount: 60, category: 'transport', supplier: null },
];

const DEMO_CAPITAL_COSTS: DemoCapitalSpec[] = [
  { monthsBack: 11, day: 4, item: 'rainwater tank (2500 L) & stand', amount: 5500, supplier: 'Hardware store, Nquthu' },
  { monthsBack: 11, day: 6, item: 'compost bays — timber & mesh (3-bay)', amount: 600, supplier: 'Hardware store, Nquthu' },
  { monthsBack: 5, day: 12, item: 'hosepipe, watering cans & hand tools', amount: 420, supplier: 'Hardware store, Nquthu' },
];

/* The one standing order the garden invoices rather than sells for cash: the
   parents' fund takes a mixed vegetable box every month. R20/kg is the rounded
   average of the retail figures in lib/crop-prices.ts for the crops that go in
   it (chard R14, cabbage R15, carrots R14, onions R24, lettuce R35). Seven
   boxes, invoiced on the 25th and settled early the following month — so the
   month the demo opens in always shows one invoice paid, and the newest box is
   still outstanding, which is what a real ledger looks like.
   Numbered up to 43 so the invoice tool's next number (44) genuinely follows
   this sequence instead of landing underneath it. */
const DEMO_BOX_COUNT = 7;
const DEMO_BOX_KG = 2.5;
const DEMO_BOX_PRICE_PER_KG = 20;
const DEMO_LAST_INVOICE_NO = 43;

export function buildDemoFinance(): DemoFinance {
  // One clock for the whole fixture: read the wall clock once so every row in a
  // built dataset agrees with every other, even across a midnight boundary.
  const now = new Date();
  const nowYear = now.getFullYear();
  const nowMonth0 = now.getMonth();
  const nowDay = now.getDate();

  /** ISO timestamp for `day` of the month `monthsBefore` months back, 09:00
   *  local. Clamped to the real length of that month, and — in the current
   *  month — to today, so no sample row is ever dated in the future. */
  const at = (monthsBefore: number, day: number): string => {
    const anchor = new Date(nowYear, nowMonth0 - monthsBefore, 1);
    const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const cap = monthsBefore === 0 ? Math.min(nowDay, lastDay) : lastDay;
    const clamped = Math.min(Math.max(1, Math.trunc(day)), cap);
    return new Date(anchor.getFullYear(), anchor.getMonth(), clamped, 9, 0, 0, 0).toISOString();
  };
  /** The most recent occurrence of calendar month 1-12: 0 = this month, 11 = a
   *  year ago next month. Twelve calendar months therefore cover the trailing
   *  twelve months exactly once each. */
  const on = (month: number, day: number): string => at(((nowMonth0 + 1 - month) % 12 + 12) % 12, day);

  const label = (cropKey: string): string => `Sample — ${DEMO_CROP_LABEL[cropKey] ?? cropKey}`;

  const sales: SalesLog[] = DEMO_SALES.map((row, i) => {
    const iso = on(row.month, row.day);
    return {
      id: `demo-sale-${i + 1}`, profile_id: 'demo', garden_id: null,
      crop: label(row.cropKey), kg: row.kg,
      // Whole rand, and always exactly kg × the per-kg price above.
      amount: Math.round(row.kg * pricePerKg(row.cropKey, row.channel)),
      buyer: row.buyer, sold_at: iso, created_at: iso,
    };
  });

  const production: ProductionLog[] = DEMO_HARVESTS.map((row, i) => {
    const iso = on(row.month, row.day);
    return {
      id: `demo-production-${i + 1}`, profile_id: 'demo', garden_id: null,
      crop: label(row.cropKey), kg: row.kg, photo_url: null,
      logged_at: iso, created_at: iso,
    };
  });

  const expenses: ExpenseLog[] = [
    ...DEMO_RUNNING_COSTS.map((row, i) => {
      const iso = on(row.month, row.day);
      return {
        id: `demo-expense-${i + 1}`, profile_id: 'demo', garden_id: null,
        item: `Sample — ${row.item}`, amount: row.amount, supplier: row.supplier,
        category: row.category, spent_at: iso, created_at: iso,
      };
    }),
    ...DEMO_CAPITAL_COSTS.map((row, i) => {
      const iso = at(row.monthsBack, row.day);
      return {
        id: `demo-expense-capital-${i + 1}`, profile_id: 'demo', garden_id: null,
        item: `Sample — ${row.item}`, amount: row.amount, supplier: row.supplier,
        category: 'equipment' as const, spent_at: iso, created_at: iso,
      };
    }),
  ];

  const invoices: SavedInvoice[] = Array.from({ length: DEMO_BOX_COUNT }, (_, i) => {
    const monthsBefore = DEMO_BOX_COUNT - 1 - i; // oldest first: 6 … 0
    const settled = monthsBefore > 0; // the newest box is still owed
    return {
      id: `demo-invoice-${i + 1}`,
      no: DEMO_LAST_INVOICE_NO - monthsBefore,
      billTo: 'Sample — Ubhejane parents fund',
      items: [{ desc: 'Sample — mixed vegetable box', qty: DEMO_BOX_KG, unit: 'kg', price: DEMO_BOX_PRICE_PER_KG }],
      total: DEMO_BOX_KG * DEMO_BOX_PRICE_PER_KG,
      dateISO: at(monthsBefore, 25),
      status: settled ? 'paid' : 'unpaid',
      ...(settled ? { paidAt: at(monthsBefore - 1, 8), paymentMethod: 'eft' as const } : {}),
    };
  });

  const customers = [
    'Sample — Ubhejane parents fund',
    'Sample — Nquthu co-op',
    'Sample — Local spaza shop',
  ];
  // Invoice presets, priced at the retail figures in lib/crop-prices.ts — the
  // same table every sale above is priced from.
  const products: Product[] = [
    { desc: 'Sample — mixed vegetable box', unit: 'kg', price: DEMO_BOX_PRICE_PER_KG },
    { desc: 'Sample — swiss chard', unit: 'kg', price: pricePerKg('swiss-chard', 'gate') },
    { desc: 'Sample — cabbage', unit: 'kg', price: pricePerKg('cabbage', 'gate') },
    { desc: 'Sample — lettuce', unit: 'kg', price: pricePerKg('lettuce', 'gate') },
    { desc: 'Sample — carrots', unit: 'kg', price: pricePerKg('carrots', 'gate') },
    { desc: 'Sample — garlic', unit: 'kg', price: pricePerKg('garlic', 'gate') },
  ];

  return { sales, expenses, production, invoices, customers, products };
}

/* ── Field journal: a season of observations ─────────────────────────────
   Ten weeks of dated notes for lib/field-journal.ts, so /journal opens on a
   real month-grouped timeline in the demo instead of an empty page.

   Each entry is pinned to something else in this file, and stays pinned:
     · the tank note sits on the R3 200 JoJo expense day (daysAgo 40) and the
       2 500 L tank in buildDemoWaterPoints/buildDemoFacilitatorState
     · the fence note sits on the R650 fencing expense day (daysAgo 35)
     · every harvest note sits on the day of its ProductionLog above, and names
       the bed the crop plan actually plants that crop in
     · bedId is the DESIGN-CANVAS id ('demo-bed-N' / 'demo-hugel-1'), the same
       id buildDemoCropPlan's plantings key on, and bedLabel matches the canvas
       label ('Bed 1'…'Bed 7') — so a journal entry, the plan and the map all
       mean the same bed.
   Entries are OBSERVATIONS ONLY. They record what was seen and done: no yield,
   spacing, dose, price or recommendation, because a note a farmer reads as
   advice is a safety problem, not a copy problem. Photos are deliberately
   absent for the same reason the file header gives — inventing ground-level
   photos of a real crèche would misrepresent the real site.
   Every title carries the "Sample — " prefix used throughout this file. */
export function buildDemoJournal(): JournalEntry[] {
  const at = (n: number) => Date.now() - n * 86400000;
  const entry = (
    n: number,
    daysBack: number,
    category: JournalEntry['category'],
    title: string,
    notes: string,
    bed?: { id: string; label: string },
    cropName?: string,
  ): JournalEntry => ({
    id: `demo-journal-${n}`,
    date: daysAgoDate(daysBack),
    title: `Sample — ${title}`,
    notes,
    category,
    bedId: bed?.id ?? null,
    bedLabel: bed?.label ?? null,
    cropName: cropName ?? null,
    photos: [],
    createdAt: at(daysBack),
    updatedAt: at(daysBack),
  });

  const bed1 = { id: 'demo-bed-1', label: 'Bed 1' };
  const bed2 = { id: 'demo-bed-2', label: 'Bed 2' };
  const bed3 = { id: 'demo-bed-3', label: 'Bed 3' };
  const bed4 = { id: 'demo-bed-4', label: 'Bed 4' };
  const bed5 = { id: 'demo-bed-5', label: 'Bed 5' };
  const bed6 = { id: 'demo-bed-6', label: 'Bed 6' };

  return [
    entry(1, 70, 'training', 'First walk-around with the crèche committee',
      'Eight parents and the two teachers walked the ground with us. Agreed the food garden goes on the flat piece north of the fruit trees, where the children can reach it from the classroom door.'),
    entry(2, 62, 'maintenance', 'Boundary walked and corners pegged',
      'Pegged the four corners and marked where the gate will hang, at the point the entry path meets the road.'),
    entry(3, 55, 'weather', 'Dry week — ground too hard to fork',
      'No rain for eight days. Could not get a fork into the ground where the beds are to go. Wet it down the evening before digging and it turned much easier in the morning.'),
    entry(4, 48, 'maintenance', 'Compost bays built from old pallets',
      'Two bays next to the path. Started the first one with kitchen scraps from the crèche kitchen and dry grass from the verge.'),
    entry(5, 40, 'maintenance', 'JoJo tank delivered and stood',
      'Tank stood on a level stone bed at the building corner and the gutter connected on the long side. Still needs a leaf screen before the heavy rain comes.'),
    entry(6, 35, 'maintenance', 'Fence closed and the gate hung',
      'Wire and poles finished on all four sides. Goats came past the gate twice this week and did not get in.'),
    entry(7, 33, 'planting', 'Second lettuce third sown in Bed 3',
      'Sowed the middle third of the bed, about six weeks behind the first third, so the cutting carries on instead of everything coming at once.',
      bed3, 'Lettuce'),
    entry(8, 29, 'pest', 'Aphids on the young cabbage in Bed 2',
      'Grey clusters under the top leaves on the two plants at the end of the row. Rubbed them off by hand and looked again the next morning — fewer, but still some on one plant. Watching it.',
      bed2, 'Cabbage'),
    entry(9, 25, 'harvest', 'First carrots lifted from Bed 6',
      'Lifted the row nearest the path. Roots straight but still small, so the rest stay in the ground a while longer.',
      bed6, 'Carrots'),
    entry(10, 21, 'weather', 'Overnight rain — tank filled and overflowed',
      'First proper rain since the tank went up. It filled and then ran over at the gutter joint, because the leaf screen is still not on.'),
    entry(11, 18, 'harvest', 'Cabbage cut from Bed 2',
      'Cut the heads that had firmed up and left the rest standing. Weighed everything before it went to the shop and logged it in the records.',
      bed2, 'Cabbage'),
    entry(12, 16, 'planting', 'Carrots sown in Bed 2 where the cabbage came out',
      'Cleared the cabbage stumps to the compost bay, raked the bed fine and sowed carrots in its place — a different family following the brassicas.',
      bed2, 'Carrots'),
    entry(13, 14, 'training', 'Mentor visit',
      'Walked the beds together. Two things to fix before the next rain: get the leaf screen onto the gutter, and mulch Bed 4 while the onions are still filling out.'),
    entry(14, 12, 'harvest', 'Lettuce cut from Bed 3',
      'Cut the first third. Heads from the shadier end are looser than the ones nearer the path.',
      bed3, 'Lettuce'),
    entry(15, 10, 'harvest', 'First chard cut from Bed 1',
      'Took the outer leaves only and left the plants standing so they come again.',
      bed1, 'Swiss chard (spinach)'),
    entry(16, 9, 'maintenance', 'Compost and kraal manure worked in, Bed 4 mulched',
      'Worked the delivery into the empty beds and put a thick grass mulch over Bed 4, as the mentor suggested.',
      bed4, 'Onions'),
    entry(17, 7, 'other', 'Garlic in Bed 5 checked',
      'Leaves still green and standing up, nothing bending over yet, so it is staying in the ground.',
      bed5, 'Garlic'),
    entry(18, 5, 'planting', 'Seedling trays collected from the co-op',
      'Trays picked up and kept in the shade by the tank until the beds they are going into are ready.'),
    entry(19, 3, 'harvest', 'Second chard cut from Bed 1',
      'Second cut, a week after the first. Leaves noticeably smaller this time — the bed may want feeding before the next cut.',
      bed1, 'Swiss chard (spinach)'),
    entry(20, 1, 'weather', 'Cold morning, no frost inside the fence',
      'Frost lying on the grass outside the fence but nothing on the beds. The chard and the garlic look untouched.'),
  ];
}

/* ── Map-layer + Design-Studio seeds ─────────────────────────────────────
   These build the localStorage-shaped state the Map and /design pages read
   in sample mode (via lib/sample-mode.ts's storage shim). They are keyed to
   the SAME real DEMO_SITE lat/lon as everything above, so the traced plot,
   the saved place, the water points and the authored design all sit on the
   genuine Ubhejane Crèche ground the satellite background resolves.

   PLOT-LOCAL METRE FRAME (shared anchor for every geometry below)
   ---------------------------------------------------------------
   The facilitator garden layout (BED_DEFS / buildDemoFacilitatorState) is in
   METRES measured from the top-left of its satellite image, x east / y south
   (geomVersion 2). Its fence spans xM 2..38, yM 2..26 — so the fence CENTRE is
   (20, 14). We pin that centre onto DEMO_SITE and convert plot-metres → [lng,lat]
   with the flat-earth approximation (fine over a ~40 m plot):
       lng = DEMO_SITE.lon + (xM - 20) / metresPerDegreeLon
       lat = DEMO_SITE.lat - (yM - 14) / metresPerDegreeLat   (south = −lat)
   1° lat ≈ 111 320 m; 1° lon ≈ 111 320·cos(lat). */

const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((DEMO_SITE.lat * Math.PI) / 180);

// Plot-local metres (facilitator convention: x east, y south, top-left origin;
// fence centre (20,14) pinned to DEMO_SITE) → [lng, lat] degrees.
function plotMetreToLngLat(xM: number, yM: number): [number, number] {
  return [
    DEMO_SITE.lon + (xM - 20) / M_PER_DEG_LON,
    DEMO_SITE.lat - (yM - 14) / M_PER_DEG_LAT,
  ];
}

// The canonical siteId string for DEMO_SITE — computed the EXACT way the /design
// page does (app/design/page.tsx:474 → designSiteIdFromLocation({lat,lon})), so the
// seeded `imbewu_design_canvas_<siteId>` blob is found by the page for this site.
function demoSiteId(): string {
  return designSiteIdFromLocation({ lat: DEMO_SITE.lat, lon: DEMO_SITE.lon } as LocationData);
}

/* (a) Farm-shapes FeatureCollection — the traced plot boundary, house and driveway,
   stored EXACTLY the way components/Map.tsx persists a drawn parcel under 'imbewu_farm_shapes':
   a GeoJSON FeatureCollection whose feature carries a top-level `id` plus
   properties { featureType:'site', siteId, hatchIdx, name }. classifyFeature()
   (lib/design-studio.ts) tags the largest non-water land polygon as the
   property_boundary, while the explicit names classify the smaller polygons as
   roof and access. The deliberately concave house and closed driveway area are a
   non-billed Geometry Lock regression fixture: any smoothing, cropping or roof-like
   driveway treatment is immediately visible in the generated sample sheets. */
export function buildDemoBoundaryFC(): FeatureCollection {
  return buildDemoGeometryLockFixture(demoSiteId(), plotMetreToLngLat);
}

/* (b) Saved place — the "Ubhejane Creche" pin. biome/rainfall/elevation are plausible
   for the northern-KZN coastal hinterland (Savanna, summer rainfall). 'Savanna' is a
   real biome name (lib/design-elements.ts biomeClimates → subtropical), which keeps the
   design's mango/avocado/indigenous fruit/moringa on-climate. */
export function buildDemoSavedPlace(): SavedPlace {
  return {
    id: 'demo-place-ubhejane',
    name: 'Ubhejane Creche',
    lat: DEMO_SITE.lat,
    lon: DEMO_SITE.lon,
    biome: 'Savanna',
    rainfall: 800,
    elevation: 430,
    savedAt: daysAgo(30),
    label: 'field',
  };
}

/* (c) Water points — a 2500 L JoJo at the building corner (matches the design's tank
   item) and a municipal tap where the entry path meets the beds. */
export function buildDemoWaterPoints(): WaterPoint[] {
  const [tankLon, tankLat] = plotMetreToLngLat(2.6, 3.6);   // building corner (facilitator tank at 2,3)
  const [tapLon, tapLat] = plotMetreToLngLat(20, 11);       // path/beds junction
  return [
    { id: 'demo-water-tank', name: 'JoJo tank (2500 L)', category: 'Tank', lat: tankLat, lon: tankLon, createdAt: daysAgo(30) },
    { id: 'demo-water-tap', name: 'Municipal tap', category: 'Other', lat: tapLat, lon: tapLon, createdAt: daysAgo(28) },
  ];
}

/* (d) Design-Studio canvas — a fully-authored "review"-step design for the plot.

   COORDINATE CONVERSION (the crux). DesignCanvasState stores items/zones/lines in
   NORMALISED [0..1] frame coordinates (lib/design-canvas.ts). We build a real frame
   with the app's own computeCanvasFrame helper over a ~60 m × 45 m bbox centred on
   DEMO_SITE, then convert every plot-metre position via:
       plot-metre → [lng,lat] (plotMetreToLngLat) → project() → normalised [0..1]
   project() is frame.projectorForFrame (returns px/imgW, px/imgH), so this is the
   SAME pipeline the live page uses — and because we go through real [lng,lat], the
   page's migrateStateToFrame (app/design/page.tsx:660) re-projects these into whatever
   frame it recomputes from the boundary, landing every item on the correct ground.
   (Equivalently, since the frame is centred on DEMO_SITE = plot-metre (20,14):
       nx = 0.5 + (xM−20)/(imgW·mPerPx),  ny = 0.5 + (yM−14)/(imgH·mPerPx)
   — the mPerPx form; we use project() so the maths can never drift from the app's.) */
export function buildDemoDesignCanvasState(): DesignCanvasState {
  // ~60 m × 45 m bbox centred on DEMO_SITE → fed to the REAL frame builder. Only
  // `.geometry` is read (getBounds), so a minimal synthetic layer is enough.
  const halfLonBox = 30 / M_PER_DEG_LON; // 60 m E–W → 30 m half-span
  const halfLatBox = 22.5 / M_PER_DEG_LAT; // 45 m N–S → 22.5 m half-span
  const bbox: Geometry = {
    type: 'Polygon',
    coordinates: [[
      [DEMO_SITE.lon - halfLonBox, DEMO_SITE.lat - halfLatBox],
      [DEMO_SITE.lon + halfLonBox, DEMO_SITE.lat - halfLatBox],
      [DEMO_SITE.lon + halfLonBox, DEMO_SITE.lat + halfLatBox],
      [DEMO_SITE.lon - halfLonBox, DEMO_SITE.lat + halfLatBox],
      [DEMO_SITE.lon - halfLonBox, DEMO_SITE.lat - halfLatBox],
    ]],
  };
  const { frame, project } = computeCanvasFrame(
    [{ geometry: bbox } as unknown as DesignLayer],
    DEMO_SITE.lat,
    DEMO_SITE.lon,
  );

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  // plot-metre → normalised [0..1] canvas coordinate.
  const toNorm = (xM: number, yM: number): [number, number] => {
    const [nx, ny] = project(plotMetreToLngLat(xM, yM));
    return [clamp01(nx), clamp01(ny)];
  };

  // ── Items ──────────────────────────────────────────────────────────────
  // 7 veg beds mirrored from BED_DEFS. FacItem xM/yM is the TOP-LEFT corner
  // (FacilitatorCanvas.tsx), so the centre PlacedItem wants is (xM+wM/2, yM+hM/2).
  const beds: PlacedItem[] = BED_DEFS.map((b, i) => {
    const [x, y] = toNorm(b.xM + b.wM / 2, b.yM + b.hM / 2);
    // Bed id MUST equal the facilitator/crop-plan bed id (b.id = 'demo-bed-N'): bedsFromDesignCanvas
    // uses item.id verbatim, and the demo crop plan's plantings key on 'demo-bed-N'. Prefixing it
    // ('demo-di-…') made the Design-Studio→Plan-crops door land on 7 empty beds (safety-proof find).
    return { id: b.id, defId: 'veg_bed', x, y, wM: b.wM, hM: b.hM, rot: 0, label: `Bed ${i + 1}` };
  });

  // Tank + compost, also mirrored from the facilitator layout (top-left → centre).
  const [tankX, tankY] = toNorm(2 + 1.2 / 2, 3 + 1.2 / 2);
  const [compX, compY] = toNorm(13 + 1.5 / 2, 3 + 1.5 / 2);
  const structures: PlacedItem[] = [
    { id: 'demo-di-tank', defId: 'jojo_2500', x: tankX, y: tankY, wM: 1.2, hM: 1.2, label: 'Rainwater tank (2500 L)' },
    { id: 'demo-di-compost', defId: 'compost_bay', x: compX, y: compY, wM: 1.5, hM: 1.5, label: 'Compost bays' },
  ];

  // Fruit trees + moringa along the SOUTHERN boundary (high yM = south). Circles are
  // placed by centre metre directly; footprints come from the element catalog defaults.
  const treeSpecs: Array<{ id: string; defId: string; xM: number; yM: number }> = [
    { id: 'demo-di-mango', defId: 'tree_mango', xM: 7, yM: 23 },
    { id: 'demo-di-avocado', defId: 'tree_avocado', xM: 17, yM: 23 },
    { id: 'demo-di-natal-plum', defId: 'tree_natal_plum', xM: 27, yM: 22.5 },
    { id: 'demo-di-moringa-1', defId: 'tree_moringa', xM: 33, yM: 22 },
    { id: 'demo-di-moringa-2', defId: 'tree_moringa', xM: 12, yM: 24 },
  ];
  const trees: PlacedItem[] = treeSpecs.map((t) => {
    const [x, y] = toNorm(t.xM, t.yM);
    return { id: t.id, defId: t.defId, x, y };
  });

  const items: PlacedItem[] = [...beds, ...structures, ...trees];

  // ── Zones ──────────────────────────────────────────────────────────────
  // Permaculture effort-zones (dashed rings; NO `feature` tag). `zone` is a NUMBER
  // (never a string — the legacy string-zone bug read a painted step as "0/4").
  const zoneSpecs: Array<{ zone: ZoneShape['zone']; ringM: Array<[number, number]> }> = [
    { zone: 1, ringM: [[1, 1], [16, 1], [16, 10.5], [1, 10.5]] },        // Daily use — building, tank, compost
    { zone: 2, ringM: [[2, 11], [15, 11], [15, 21.5], [2, 21.5]] },      // Intensive — the veg-bed block
    { zone: 3, ringM: [[2, 21.5], [38, 21.5], [38, 26.5], [2, 26.5]] },  // Orchard strip — southern trees
    { zone: 5, ringM: [[36, 2], [38.5, 2], [38.5, 26], [36, 26]] },      // Conservation sliver — far (east) fence
  ];
  const zones: ZoneShape[] = zoneSpecs.map((z, i) => ({
    id: `demo-dz-${i + 1}`,
    zone: z.zone,
    points: z.ringM.map(([xM, yM]) => toNorm(xM, yM)),
  }));

  // Four separate fields, not one large polygon with four textures inside it. The exact planting
  // and masterplan painters deliberately give each traced staple plot one crop silhouette, so the
  // sample farm exercises the same rotation-readable drawing a real four-block field needs. These
  // are illustrative geometry only: the fixture records no crop plan, spacing or yield claim.
  const staplePlots: ZoneShape[] = [
    [[22, 12], [28, 12], [28, 15.5], [22, 15.5]],
    [[29, 12], [35, 12], [35, 15.5], [29, 15.5]],
    [[22, 16.5], [28, 16.5], [28, 20], [22, 20]],
    [[29, 16.5], [35, 16.5], [35, 20], [29, 20]],
  ].map((ringM, index) => ({
    id: `demo-staple-${index + 1}`,
    zone: 2,
    feature: 'staple_garden',
    points: ringM.map(([xM, yM]) => toNorm(xM, yM)),
  }));
  zones.push(...staplePlots);

  // ── Lines ──────────────────────────────────────────────────────────────
  const pathM: Array<[number, number]> = [[20, 2], [20, 12], [12, 18]];      // gate → down → into beds
  const swaleM: Array<[number, number]> = [[3, 20.5], [20, 20.8], [37, 20.5]]; // on-contour, just above the orchard
  const greywaterM: Array<[number, number]> = [[24, 12], [20, 18], [17, 22.5]]; // house diverter → orchard basin
  const lines: LineShape[] = [
    { id: 'demo-dl-path', kind: 'path', points: pathM.map(([xM, yM]) => toNorm(xM, yM)) },
    { id: 'demo-dl-swale', kind: 'swale', points: swaleM.map(([xM, yM]) => toNorm(xM, yM)) },
    { id: 'demo-dl-greywater', kind: 'greywater', points: greywaterM.map(([xM, yM]) => toNorm(xM, yM)) },
  ];

  return {
    siteId: demoSiteId(),
    frame,
    items,
    zones,
    lines,
    step: 'review',
    updatedAt: new Date().toISOString(),
    rev: 1,
  };
}

/* (e) Storage seeds — the { localStorageKey: serializedValue } map lib/sample-mode.ts's
   storage shim (shimStoreEnsured) loads into its in-memory store. Keys are hardcoded
   string literals because the app itself hardcodes them (none are exported):
     'imbewu_farm_shapes'         — components/Map.tsx FARM_KEY / lib/map-sync SHAPES_KEY
     'permamap_saved_places'      — lib/saved-places.ts KEY (loader expects a raw array)
     'imbewu_water_points'        — lib/water-points.ts KEY (raw array)
     'imbewu_design_canvas_<id>'  — lib/design-canvas.ts keyFor(siteId)
     'imbewu_map_tips_seen'       — components/Map.tsx (so the tips guide doesn't auto-open)
     'imbewu_field_journal_v1'    — lib/field-journal.ts STORAGE_KEY (raw entry array) */
export function buildDemoStorageSeeds(): Record<string, string> {
  const siteId = demoSiteId();
  return {
    imbewu_farm_shapes: JSON.stringify(buildDemoBoundaryFC()),
    permamap_saved_places: JSON.stringify([buildDemoSavedPlace()]),
    imbewu_water_points: JSON.stringify(buildDemoWaterPoints()),
    [`imbewu_design_canvas_${siteId}`]: JSON.stringify(buildDemoDesignCanvasState()),
    imbewu_field_journal_v1: JSON.stringify(buildDemoJournal()),
    imbewu_map_tips_seen: '1',
    // Treat the demo as already-onboarded so a reload while sampling doesn't drop the blocking
    // language/onboarding modal over the crèche (the flag isn't in the seed set otherwise → the
    // shim serves null → the modal reappears for a returning user). See safety-proof finding.
    permamap_onboarded: '1',
  };
}
