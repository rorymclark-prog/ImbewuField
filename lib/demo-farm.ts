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
     'imbewu_map_tips_seen'       — components/Map.tsx (so the tips guide doesn't auto-open) */
export function buildDemoStorageSeeds(): Record<string, string> {
  const siteId = demoSiteId();
  return {
    imbewu_farm_shapes: JSON.stringify(buildDemoBoundaryFC()),
    permamap_saved_places: JSON.stringify([buildDemoSavedPlace()]),
    imbewu_water_points: JSON.stringify(buildDemoWaterPoints()),
    [`imbewu_design_canvas_${siteId}`]: JSON.stringify(buildDemoDesignCanvasState()),
    imbewu_map_tips_seen: '1',
    // Treat the demo as already-onboarded so a reload while sampling doesn't drop the blocking
    // language/onboarding modal over the crèche (the flag isn't in the seed set otherwise → the
    // shim serves null → the modal reappears for a returning user). See safety-proof finding.
    permamap_onboarded: '1',
  };
}
