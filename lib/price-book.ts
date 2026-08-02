/**
 * price-book.ts
 *
 * ZAR planning-price book for South African permaculture builds.
 *
 * All figures are PLANNING ESTIMATES only — rough retail/installed costs,
 * incl. VAT, as of late 2025 / early 2026, gathered from general SA retail
 * and trade sources (Builders Warehouse, Cashbuild, Agrico/Netafim dealer
 * pricing, local fencing/nursery/borehole contractor quotes). They are NOT
 * quotes and WILL vary by region, supplier, and site conditions — use for
 * ballpark budgeting in a facilitator design session only.
 *
 * Sources consulted (general ranges, not itemised — SA retail is volatile):
 *  - JoJo Tanks / Ecotank retail price lists (2500L/5000L/10000L vertical tanks)
 *  - Builders/Cashbuild gutter, PVC pipe, and fencing price lists
 *  - Agrico/Netafim drip-line per-metre dealer pricing (incl. fittings share)
 *  - SA nursery trade pricing for citrus/avo/fruit tree stock (bagged, 2-3 yr)
 *  - Borehole drilling contractor nominal quotes (shallow, easy geology)
 *  - General earthworks/hand-labour day-rate estimates for swales/paths
 */

export interface PriceEntry {
  label: string;
  unit: 'each' | 'per_m' | 'per_m2';
  zar: number;
  note?: string;
}

export type CostUnit = 'each' | 'm' | 'm²';

export interface CostLine {
  zar: number;
  basis: string;
  unit: CostUnit;
}

/**
 * Keyed price book. Keys are intentionally stable strings used by
 * costForItem/costForLine to look up rates — do not rename without
 * checking callers.
 */
export const PRICE_BOOK: Record<string, PriceEntry> = {
  tank_2500: {
    label: '2500L water tank',
    unit: 'each',
    zar: 5500,
    note: 'Vertical poly tank, installed on level base, incl. VAT (JoJo/Ecotank-class pricing).',
  },
  tank_5000: {
    label: '5000L water tank',
    unit: 'each',
    zar: 7000,
    note: 'Vertical poly tank, installed on level base, incl. VAT.',
  },
  tank_10000: {
    label: '10000L water tank',
    unit: 'each',
    zar: 13000,
    note: 'Vertical poly tank, installed on level base, incl. VAT.',
  },
  gutter_per_m: {
    label: 'Gutter (installed)',
    unit: 'per_m',
    zar: 300,
    note: 'PVC/seamless-style gutter incl. brackets and labour, per running metre.',
  },
  pipe_per_m: {
    label: '40mm PVC pipe (laid)',
    unit: 'per_m',
    zar: 45,
    note: '40mm class PVC pressure/drain pipe, trenched and laid, per metre.',
  },
  drip_per_m: {
    label: 'Drip irrigation line',
    unit: 'per_m',
    zar: 4,
    note: '16mm drip line incl. a share of connectors/fittings/end-caps, per metre.',
  },
  fence_per_m: {
    label: 'Chain-link fence (installed)',
    unit: 'per_m',
    zar: 250,
    note: '1.8m chain-link on standard posts, installed, per metre.',
  },
  windbreak_per_m: {
    label: 'Windbreak hedge/row (planted)',
    unit: 'per_m',
    zar: 90,
    note: 'Planted windbreak row incl. stock and establishment, per metre run.',
  },
  path_per_m: {
    label: 'Gravel path',
    unit: 'per_m',
    zar: 80,
    note: 'Compacted gravel path, per running metre, standard width.',
  },
  driveway_per_m2: {
    label: 'Driveway (compacted gravel)',
    unit: 'per_m2',
    zar: 250,
    note: 'Compacted gravel driveway surface, per square metre; concrete/paved will cost more.',
  },
  patio_per_m2: {
    label: 'Patio (paved)',
    unit: 'per_m2',
    zar: 450,
    note: 'Paved outdoor patio/work area, per square metre, incl. base prep.',
  },
  waterbody_per_m2: {
    label: 'Dam / pond (excavated)',
    unit: 'per_m2',
    zar: 180,
    note: 'Basic machine-dug, unlined dam/pond excavation, per square metre of surface area; lining or a bigger dam adds cost. Only applies when planning a NEW dam — an existing one traced from the map is not costed.',
  },
  swale_per_m: {
    label: 'Hand-dug swale',
    unit: 'per_m',
    zar: 60,
    note: 'Hand excavation and shaping, per running metre; cheaper if machine-dug at scale.',
  },
  swalew: {
    label: 'Swale berm (earthworks)',
    unit: 'per_m2',
    zar: 60,
    note: 'hand-dug, planted',
  },
  citrus_tree: {
    label: 'Citrus tree',
    unit: 'each',
    zar: 300,
    note: 'Bagged nursery stock, 2-3 year old grafted tree.',
  },
  avo_tree: {
    label: 'Avocado tree',
    unit: 'each',
    zar: 450,
    note: 'Grafted avocado, bagged nursery stock.',
  },
  generic_fruit_tree: {
    label: 'Fruit tree (generic)',
    unit: 'each',
    zar: 300,
    note: 'General bagged fruit tree stock, unspecified species.',
  },
  shrub: {
    label: 'Shrub',
    unit: 'each',
    zar: 80,
    note: 'Nursery shrub, bagged, established.',
  },
  veg_bed_per_m2: {
    label: 'Vegetable bed (established)',
    unit: 'per_m2',
    zar: 120,
    note: 'Incl. soil amendment/compost and seed/seedlings, per square metre.',
  },
  hugel_per_m2: {
    label: 'Hugelkultur mound',
    unit: 'per_m2',
    zar: 60,
    note: 'Woody debris + soil cap construction, per square metre footprint.',
  },
  banana_circle: {
    label: 'Banana circle',
    unit: 'each',
    zar: 400,
    note: 'Pit, mulch/greywater feed, and initial banana pups.',
  },
  herb_spiral: {
    label: 'Herb spiral',
    unit: 'each',
    zar: 350,
    note: 'Small rubble/brick spiral with starter herb planting.',
  },
  food_forest_per_m2: {
    label: 'Food forest planting',
    unit: 'per_m2',
    zar: 70,
    note: 'Multi-layer guild planting density, per square metre.',
  },
  nursery_per_m2: {
    label: 'Nursery/propagation area',
    unit: 'per_m2',
    zar: 200,
    note: 'Shade cloth, benching, and propagation infrastructure, per square metre.',
  },
  compost_bay: {
    label: 'Compost bay (3-bay system)',
    unit: 'each',
    zar: 600,
    note: 'Timber/pallet 3-bay compost system, materials and labour.',
  },
  chicken_coop: {
    label: 'Chicken coop',
    unit: 'each',
    zar: 2500,
    note: 'Small-flock timber/wire coop with run, materials and labour.',
  },
  beehive: {
    label: 'Beehive (Langstroth/top-bar)',
    unit: 'each',
    zar: 1500,
    note: 'Hive box(es) incl. frames, unpopulated.',
  },
  greenhouse_per_m2: {
    label: 'Greenhouse',
    unit: 'per_m2',
    zar: 450,
    note: 'Frame + poly/glass cladding, per square metre footprint.',
  },
  tunnel_per_m2: {
    label: 'Shade/grow tunnel',
    unit: 'per_m2',
    zar: 200,
    note: 'Hoop-frame shade netting or plastic tunnel, per square metre footprint.',
  },
  shed_per_m2: {
    label: 'Shed/storage structure',
    unit: 'per_m2',
    zar: 1800,
    note: 'Basic timber/steel-frame shed, per square metre footprint.',
  },
  reedbed_per_m2: {
    label: 'Reedbed (greywater filtration)',
    unit: 'per_m2',
    zar: 350,
    note: 'Lined gravel/reed filtration bed, per square metre.',
  },
  pond_per_m2: {
    label: 'Pond (lined)',
    unit: 'per_m2',
    zar: 180,
    note: 'Liner + excavation, per square metre surface area.',
  },
  well: {
    label: 'Borehole/well',
    unit: 'each',
    zar: 15000,
    note: 'Nominal shallow borehole drilling and casing, easy geology; highly site-dependent.',
  },
  biogas: {
    label: 'Household biogas digester',
    unit: 'each',
    zar: 9000,
    note: 'Small household-scale digester unit, materials and installation.',
  },
  firebreak_per_m2: {
    label: 'Firebreak (cleared/maintained)',
    unit: 'per_m2',
    zar: 8,
    note: 'Cleared and maintained firebreak strip, per square metre.',
  },
};

/**
 * One sentence disclaimer to surface alongside any cost total in the UI/report.
 */
export const DISCLAIMER: string =
  'All prices are rough planning estimates based on late-2025/early-2026 South African retail pricing incl. VAT and will vary by region, supplier, and site access — get local quotes before committing budget.';

const TANK_SIZES: Array<{ litres: number; key: string }> = [
  { litres: 2500, key: 'tank_2500' },
  { litres: 5000, key: 'tank_5000' },
  { litres: 10000, key: 'tank_10000' },
];

/** Measured dimensions may be zero, but cannot be negative or non-finite. */
function isValidMeasure(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/** Pick the tank price-book key nearest to the requested litre volume. */
function nearestTankKey(litres: number): string {
  let best = TANK_SIZES[0];
  let bestDiff = Math.abs(litres - best.litres);
  for (const size of TANK_SIZES) {
    const diff = Math.abs(litres - size.litres);
    if (diff < bestDiff) {
      best = size;
      bestDiff = diff;
    }
  }
  return best.key;
}

/**
 * Facilitator element-type -> price-book key mapping for point/area elements.
 * Types not listed here return null from costForItem.
 */
const ITEM_TYPE_MAP: Record<string, string> = {
  tank: '__tank__', // resolved specially via litres
  citrus_tree: 'citrus_tree',
  avo_tree: 'avo_tree',
  fruit_tree: 'generic_fruit_tree',
  tree: 'generic_fruit_tree',
  shrub: 'shrub',
  veg_bed: 'veg_bed_per_m2',
  bed: 'veg_bed_per_m2',
  hugel: 'hugel_per_m2',
  hugelkultur: 'hugel_per_m2',
  banana_circle: 'banana_circle',
  banana: 'banana_circle',
  herb_spiral: 'herb_spiral',
  herb: 'herb_spiral',
  food_forest: 'food_forest_per_m2',
  foodforest: 'food_forest_per_m2',
  nursery: 'nursery_per_m2',
  compost_bay: 'compost_bay',
  compost: 'compost_bay',
  chicken_coop: 'chicken_coop',
  coop: 'chicken_coop',
  beehive: 'beehive',
  hive: 'beehive',
  greenhouse: 'greenhouse_per_m2',
  tunnel: 'tunnel_per_m2',
  shed: 'shed_per_m2',
  reedbed: 'reedbed_per_m2',
  pond: 'pond_per_m2',
  well: 'well',
  borehole: 'well',
  biogas: 'biogas',
  swalew: 'swalew',
  firebreak: 'firebreak_per_m2',
};

/**
 * Estimate cost for a point/area facilitator element.
 *
 * @param type      facilitator ElType (e.g. 'tank', 'citrus_tree', 'pond', ...)
 * @param wM        width in metres (used for area/diameter basis)
 * @param hM        height/depth in metres (used for area basis)
 * @param litres    tank volume in litres, when type === 'tank'
 */
/**
 * Is this facilitator element priced by AREA rather than per unit?
 *
 * Exported because the print pack was carrying its own hardcoded list of area-priced types, and a
 * hand-kept copy of a fact this file already owns can only drift — it had already lost `swalew`,
 * the one per-m2 entry missing from it, so every swale on a printed bill of quantities was costed
 * on the wrong basis. Ask the price book instead of remembering what it says.
 */
export function isAreaPricedItem(type: string): boolean {
  const mapped = ITEM_TYPE_MAP[type];
  if (!mapped || mapped === '__tank__') return false;
  return PRICE_BOOK[mapped]?.unit === 'per_m2';
}

export function costForItem(
  type: string,
  wM: number,
  hM: number,
  litres?: number
): CostLine | null {
  const mapped = ITEM_TYPE_MAP[type];
  if (!mapped) return null;

  if (mapped === '__tank__') {
    if (litres !== undefined && (!Number.isFinite(litres) || litres <= 0)) return null;
    const vol = litres ?? 5000;
    const key = nearestTankKey(vol);
    const entry = PRICE_BOOK[key];
    return { zar: entry.zar, basis: `${entry.label} (nearest match to ${vol}L)`, unit: 'each' };
  }

  const entry = PRICE_BOOK[mapped];
  if (!entry) return null;

  if (entry.unit === 'each') {
    return { zar: entry.zar, basis: `${entry.label} x1`, unit: 'each' };
  }

  if (entry.unit === 'per_m2') {
    if (!isValidMeasure(wM) || !isValidMeasure(hM)) return null;
    // Circular footprint types (e.g. pond, banana circle-like) use pi*(w/2)^2
    // when only a diameter (wM) is meaningful and hM is unset/equal to wM;
    // otherwise treat as a rectangle wM x hM.
    const isCircular = type === 'pond' && (!hM || hM === wM);
    const area = isCircular ? Math.PI * (wM / 2) ** 2 : wM * hM;
    const zar = Math.round(area * entry.zar);
    return {
      zar,
      basis: `${entry.label}: ${area.toFixed(1)} m² × ${formatZar(entry.zar)}/m²`,
      unit: 'm²',
    };
  }

  // per_m fallback (shouldn't normally hit for item types, but handle gracefully)
  if (!isValidMeasure(wM)) return null;
  const zar = Math.round(wM * entry.zar);
  return { zar, basis: `${entry.label}: ${wM.toFixed(1)} m × ${formatZar(entry.zar)}/m`, unit: 'm' };
}

/**
 * Line kinds that map to a per-metre price-book rate.
 * 'building' and 'contour' are existing/reference features and cost nothing.
 */
const LINE_KIND_MAP: Record<string, string> = {
  fence: 'fence_per_m',
  path: 'path_per_m',
  swale: 'swale_per_m',
  pipe: 'pipe_per_m',
  drip: 'drip_per_m',
  windbreak: 'windbreak_per_m',
  gutter: 'gutter_per_m',
};

const FREE_LINE_KINDS = new Set(['building', 'contour']);

/**
 * Estimate cost for a line-type facilitator element (fence, path, pipe, etc).
 * Returns null for existing/reference lines (building, contour) or unknown kinds.
 */
export function costForLine(
  kind: string,
  lengthM: number
): CostLine | null {
  if (FREE_LINE_KINDS.has(kind)) return null;

  const key = LINE_KIND_MAP[kind];
  if (!key || !isValidMeasure(lengthM)) return null;

  const entry = PRICE_BOOK[key];
  if (!entry) return null;

  const zar = Math.round(lengthM * entry.zar);
  return { zar, basis: `${entry.label}: ${lengthM.toFixed(1)} m × ${formatZar(entry.zar)}/m`, unit: 'm' };
}

/**
 * Area (polygon) line kinds priced per m² of paved/covered ground, not by
 * outline length — a driveway or patio costs by the surface it covers.
 */
const AREA_LINE_KIND_MAP: Record<string, string> = {
  driveway: 'driveway_per_m2',
  patio: 'patio_per_m2',
  waterbody: 'waterbody_per_m2',
};

/**
 * Estimate cost for an area-type facilitator line (driveway, patio) from its
 * traced polygon area. A measured zero is a real R0 line; negative or unknown
 * inputs remain unpriced.
 */
export function costForAreaLine(
  kind: string,
  areaM2: number
): CostLine | null {
  const key = AREA_LINE_KIND_MAP[kind];
  if (!key || !isValidMeasure(areaM2)) return null;

  const entry = PRICE_BOOK[key];
  if (!entry) return null;

  const zar = Math.round(areaM2 * entry.zar);
  return { zar, basis: `${entry.label}: ${areaM2.toFixed(1)} m² × ${formatZar(entry.zar)}/m²`, unit: 'm²' };
}

/**
 * Price an area only when the caller actually measured one. Missing geometry
 * is not a zero-sized surface and must never enter a BOQ as "free".
 */
export function costForMeasuredAreaLine(
  kind: string,
  areaM2: number | undefined,
): CostLine | null {
  return areaM2 === undefined ? null : costForAreaLine(kind, areaM2);
}

/** Sum already-rounded BOQ lines exactly; unpriced/null lines never masquerade as free input. */
export function totalZar(lines: readonly CostLine[]): number {
  return lines.reduce((sum, line) => sum + line.zar, 0);
}

/**
 * Format a number as a ZAR amount with space-separated thousands, no decimals.
 * e.g. formatZar(12500) -> 'R12 500'
 * Non-finite inputs are shown as unavailable, never as a currency amount.
 */
export function formatZar(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded).toString();
  const withSpaces = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}R${withSpaces}`;
}
