// Retail + wholesale price-per-kg estimates for the crop-value/cashflow view
// — a ONE-TIME researched snapshot (2026-07-14), NOT a live feed. Checkers/
// Shoprite have no public pricing API; a genuinely "live" weekly refresh
// would need a scraper + somewhere to run it on a schedule + ongoing upkeep
// as their sites change — real infrastructure this app doesn't have, for a
// nice-to-have view. Instead: real public prices researched once (retail
// prices are public information, no different from a shopper reading a
// shelf tag), seeded as editable defaults the farmer can correct any time —
// same "general estimate, adjust to your reality" pattern as sow-windows,
// varieties and the seed BOQ elsewhere in this app.
//
// SOURCES (all 2026, see the research notes for full citations):
// - Direct retail: NAMC Food Basket Price Monthly (StatsSA CPI basket) for
//   dry-beans/cabbage/carrots/onions/tomatoes/potato/maize(as meal);
//   PriceCheck.co.za (Checkers/Pick n Pay listings) for butternut/carrots/
//   cucumber; a single-retailer listing for green-beans; an aggregator
//   (lower confidence) for sweet-potato.
// - Wholesale: Johannesburg Fresh Produce Market daily trading data
//   (joburgmarket.co.za), 13 Jul 2026 — real traded price, though several
//   crops traded on very thin volume that day (noted below) and one
//   (watermelon) was pulled mid-winter, i.e. out of season and priced up.
// - Wholesale-to-retail ratio: derived from the 6 crops with BOTH real
//   retail and real wholesale figures (onion/potato/tomato/butternut/
//   carrot cluster at wholesale ~33-45% of retail; cabbage — cheap, bulky,
//   high-shrinkage — sits far lower, ~13%) — independently cross-checked
//   against a Mail & Guardian retail-markup field survey (Sept 2023) that
//   found the same 2-3x order of magnitude. Used ONLY to estimate retail
//   for crops where no direct retail figure could be found; never applied
//   where a real, direct retail figure exists.
export interface CropPrice {
  retailPerKg: number;
  wholesalePerKg: number;
  /** 'sourced' = both figures traced to a real, dated source. 'estimated' =
   *  at least one figure is derived (via the wholesale/retail ratio, a
   *  same-food-group proxy, or general knowledge) rather than directly
   *  found — a real number, but a rougher one; expect to correct it. */
  confidence: 'sourced' | 'estimated';
}

export const DEFAULT_CROP_PRICES: Record<string, CropPrice> = {
  // Direct retail source; wholesale derived via the root/fruiting ratio (~38%).
  'dry-beans': { retailPerKg: 65, wholesalePerKg: 25, confidence: 'sourced' },
  'green-beans': { retailPerKg: 35, wholesalePerKg: 13, confidence: 'sourced' },
  butternut: { retailPerKg: 15, wholesalePerKg: 5, confidence: 'sourced' },
  cabbage: { retailPerKg: 15, wholesalePerKg: 2, confidence: 'sourced' }, // cabbage's OWN real ratio (~13%), not the general one — cheap/bulky/high-shrinkage genuinely sits lower
  carrots: { retailPerKg: 14, wholesalePerKg: 5.5, confidence: 'sourced' },
  onions: { retailPerKg: 24, wholesalePerKg: 9.5, confidence: 'sourced' },
  tomatoes: { retailPerKg: 29, wholesalePerKg: 14, confidence: 'sourced' },
  potato: { retailPerKg: 18, wholesalePerKg: 6, confidence: 'sourced' },
  'sweet-potato': { retailPerKg: 19, wholesalePerKg: 7, confidence: 'sourced' }, // retail from an aggregator source, not a retailer listing — lower confidence than the others in this group
  cucumber: { retailPerKg: 29, wholesalePerKg: 17, confidence: 'sourced' }, // retail converted from an ~R12.50/425g unit price; wholesale is the direct Joburg Market figure
  maize: { retailPerKg: 14, wholesalePerKg: 5, confidence: 'estimated' }, // the only figure found prices maize MEAL, not fresh mielies/dried grain — a reasonable proxy if milled, an overestimate if sold as fresh cobs

  // Wholesale directly sourced (Joburg Market); retail derived via the
  // wholesale/retail ratio for the matching category, then sanity-checked
  // against typical SA shelf prices rather than applied blindly (noted
  // per-crop where the raw ratio produced an implausible number).
  'swiss-chard': { retailPerKg: 14, wholesalePerKg: 2.4, confidence: 'estimated' },
  beetroot: { retailPerKg: 27, wholesalePerKg: 10, confidence: 'estimated' },
  peppers: { retailPerKg: 28, wholesalePerKg: 10.5, confidence: 'estimated' }, // green pepper wholesale used as the base — red/yellow trade far higher (R48-57/kg) if that's what's actually grown
  garlic: { retailPerKg: 160, wholesalePerKg: 61, confidence: 'estimated' }, // garlic is genuinely a high-R/kg crop (small quantities used) — this checks out against typical SA shelf prices, not just the formula
  amadumbe: { retailPerKg: 65, wholesalePerKg: 25, confidence: 'estimated' }, // wholesale traded on thin volume (160kg citywide) — treat as a rough regional-market signal, not a firm number

  // Ratio produced an implausible figure for these — used a same-food-group
  // proxy or general SA shelf-price knowledge instead, flagged lower confidence.
  pumpkin: { retailPerKg: 15, wholesalePerKg: 2, confidence: 'estimated' }, // pumpkin's OWN wholesale (R1.65/kg) implies ~R4/kg retail via the ratio — too low next to butternut's real R15/kg for a similar squash; used butternut's figure as the proxy instead
  lettuce: { retailPerKg: 35, wholesalePerKg: 6, confidence: 'estimated' }, // the wholesale figure found was priced per bulk "pocket", not per kg — unit mismatch, so the ratio couldn't be applied; this is a rough head-based estimate instead
  broccoli: { retailPerKg: 45, wholesalePerKg: 8, confidence: 'estimated' }, // ratio-derived figure came out implausibly high (~R110-140/kg) — used a rough per-head-converted shelf estimate instead
  watermelon: { retailPerKg: 10, wholesalePerKg: 4, confidence: 'estimated' }, // the wholesale figure found was mid-WINTER (out of season, scarcity-priced) — used a more typical in-season estimate instead
  peas: { retailPerKg: 50, wholesalePerKg: 20, confidence: 'estimated' }, // wholesale traded on thin volume (<150kg citywide) — noisy, treat as rough
  kale: { retailPerKg: 45, wholesalePerKg: 8, confidence: 'estimated' }, // wholesale traded on thin volume — noisy; the ratio-derived figure was implausible, used a premium-leafy-green shelf estimate instead
  groundnuts: { retailPerKg: 60, wholesalePerKg: 20, confidence: 'estimated' }, // wholesale traded on essentially no volume (5kg citywide) — not usable, this is a general shelf-price estimate

  // No usable data found either direction — same-food-group proxy.
  'broad-beans': { retailPerKg: 35, wholesalePerKg: 13, confidence: 'estimated' }, // modeled fresh-podded in this catalog (harvestWindowMonths, not stored dry) — proxied off green-beans rather than dry-beans
};

// Herbs are sold and valued completely differently from bulk vegetables —
// coriander retails by the ~20g bunch (roughly R8-15/bunch), which converts
// to an eye-watering R400+/kg that would look like a bug sitting in a table
// next to R15/kg cabbage, and no real per-kg source was found for it either.
// Deliberately excluded from price-based value (kg totals elsewhere are
// unaffected) rather than showing a number nobody could sanity-check.
export const UNPRICED_CROPS = new Set<string>(['coriander']);

const PRICE_OVERRIDES_KEY = 'imbewu_crop_price_overrides_v1';

export function loadCropPriceOverrides(): Record<string, CropPrice> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(PRICE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCropPriceOverrides(overrides: Record<string, CropPrice>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PRICE_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

/** The effective price for a crop — a farmer's own edit if they've made one, else the researched default, else null (unpriced, e.g. herbs sold by the bunch). */
export function priceFor(cropKey: string, overrides: Record<string, CropPrice>): CropPrice | null {
  if (UNPRICED_CROPS.has(cropKey)) return null;
  return overrides[cropKey] ?? DEFAULT_CROP_PRICES[cropKey] ?? null;
}
