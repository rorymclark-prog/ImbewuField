/**
 * water-calc.ts
 *
 * Rainwater harvesting maths for South African sites: roof-runoff yield
 * estimation and dry-season storage sizing.
 *
 * Source notes:
 *  - Runoff coefficients: standard rainwater-harvesting design values —
 *    metal/IBR roofing ~0.9, tiled roofing ~0.85 (more absorption/loss at
 *    ridges and joints), thatch ~0.6 (high absorption, slower shedding).
 *  - Regional annual rainfall figures are long-term-average approximations
 *    (SAWS / WorldClim-class climatology) for representative reference
 *    points per region — NOT site-specific readings. Real values vary
 *    significantly with local topography (e.g. Drakensberg vs. lowveld).
 *  - Rainfall pattern classification (summer/winter/all-year) follows the
 *    standard SA climatology split: winter-rainfall Western Cape, summer-
 *    rainfall interior/east coast/Limpopo, all-year/bimodal Eastern Cape
 *    coast and semi-arid Karoo.
 */

export const RUNOFF: Record<'metal' | 'tile' | 'thatch', number> = {
  metal: 0.9,
  tile: 0.85,
  thatch: 0.6,
};

export interface RegionalRainfall {
  name: string;
  lat: number;
  lon: number;
  annualMm: number;
  pattern: 'summer' | 'winter' | 'all-year';
}

/**
 * Reference points for broad South African rainfall regions.
 * Annual mm figures are long-term-average approximations for a
 * representative location in each region, not precise site data.
 */
export const REGIONAL_RAINFALL: RegionalRainfall[] = [
  { name: 'Durban / KZN coast', lat: -29.86, lon: 31.02, annualMm: 915, pattern: 'summer' },
  { name: 'KZN midlands', lat: -29.6, lon: 30.4, annualMm: 1000, pattern: 'summer' },
  { name: 'Johannesburg / Gauteng', lat: -26.2, lon: 28.05, annualMm: 779, pattern: 'summer' },
  { name: 'Cape Town / W Cape', lat: -33.93, lon: 18.42, annualMm: 686, pattern: 'winter' },
  { name: 'Eastern Cape coast', lat: -33.0, lon: 27.9, annualMm: 850, pattern: 'all-year' },
  { name: 'Limpopo', lat: -23.9, lon: 29.45, annualMm: 500, pattern: 'summer' },
  { name: 'Karoo', lat: -32.3, lon: 22.5, annualMm: 260, pattern: 'all-year' },
];

/**
 * Find the closest regional rainfall reference entry to a given lat/lon,
 * using simple squared-degree distance (adequate at country scale; no
 * need for haversine precision here).
 */
export function nearestRainfall(lat: number, lon: number): RegionalRainfall {
  let best = REGIONAL_RAINFALL[0];
  let bestDist = (lat - best.lat) ** 2 + (lon - best.lon) ** 2;
  for (const region of REGIONAL_RAINFALL) {
    const dist = (lat - region.lat) ** 2 + (lon - region.lon) ** 2;
    if (dist < bestDist) {
      best = region;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * Annual harvestable rainwater volume in litres.
 * 1mm of rain over 1m² of roof yields 1 litre before runoff losses,
 * so litres = roofM2 x annualMm x runoff coefficient.
 */
export function annualHarvestLitres(
  roofM2: number,
  annualMm: number,
  runoff: number = 0.9
): number {
  return roofM2 * annualMm * runoff;
}

const TANK_STEP_SIZES = [2500, 5000, 10000, 15000, 20000];

/**
 * Heuristic recommended storage size to bridge the dry season, based on
 * rainfall pattern (winter-rainfall regions need to store a larger share
 * of annual harvest to bridge the long dry summer, and vice versa):
 *  - winter pattern -> store ~35% of annual harvest
 *  - summer pattern -> store ~20% of annual harvest
 *  - all-year pattern -> store ~15% of annual harvest (rain arrives more evenly)
 *
 * Result is rounded UP to the nearest standard tank size in
 * [2500, 5000, 10000, 15000, 20000] litres; above 20000 it rounds up to
 * the nearest multiple of 10000 (i.e. stacking multiple 10k tanks).
 */
export function recommendedTankLitres(
  annualLitres: number,
  pattern: 'summer' | 'winter' | 'all-year'
): number {
  const shareByPattern: Record<'summer' | 'winter' | 'all-year', number> = {
    winter: 0.35,
    summer: 0.2,
    'all-year': 0.15,
  };

  const target = annualLitres * shareByPattern[pattern];

  for (const size of TANK_STEP_SIZES) {
    if (target <= size) return size;
  }

  return Math.ceil(target / 10000) * 10000;
}

export interface HarvestDescription {
  /** Roof area used for display, rounded to a whole m² — see describeHarvest. */
  roofM2: number;
  annualLitres: number;
  annualMm: number;
  pattern: 'summer' | 'winter' | 'all-year';
  regionName: string;
  recommendedTank: number;
  sentence: string;
}

/** Format a litre volume with space-separated thousands, e.g. 98000 -> '98 000'. */
function formatLitres(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Describe a site's rainwater harvest potential and recommended storage,
 * using the nearest regional rainfall reference point.
 */
export function describeHarvest(
  roofM2: number,
  lat: number,
  lon: number
): HarvestDescription {
  const region = nearestRainfall(lat, lon);
  // Maths uses the raw (unrounded) roofM2 — only display is rounded, below.
  const annualLitres = annualHarvestLitres(roofM2, region.annualMm);
  const recommendedTank = recommendedTankLitres(annualLitres, region.pattern);
  const roundedRoofM2 = Math.round(roofM2);

  const sentence =
    `Your ${roundedRoofM2} m² of roof can harvest ≈ ${formatLitres(annualLitres)} L/yr ` +
    `(${region.annualMm} mm, ${region.pattern} rainfall) — ` +
    `recommended storage ≈ ${formatLitres(recommendedTank)} L.`;

  return {
    roofM2: roundedRoofM2,
    annualLitres,
    annualMm: region.annualMm,
    pattern: region.pattern,
    regionName: region.name,
    recommendedTank,
    sentence,
  };
}
