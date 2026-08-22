// Retail + wholesale price-per-kg estimates for the crop-value/cashflow view
// — a researched snapshot, NOT a live feed. Nearly all of it comes from one
// research pass (2026-07-14); a crop researched in a later pass carries its
// own `pricedAt` (see CropPrice below) so the farm-gate card prints that
// crop's real research date instead of the shared one. Checkers/
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
//   Turnip is the single entry from a later trading day (19 Aug 2026) and
//   carries `pricedAt` for exactly that reason.
// - Wholesale-to-retail ratio: derived from the 6 crops with BOTH real
//   retail and real wholesale figures (onion/potato/tomato/butternut/
//   carrot cluster at wholesale ~33-45% of retail; cabbage — cheap, bulky,
//   high-shrinkage — sits far lower, ~13%) — independently cross-checked
//   against a Mail & Guardian retail-markup field survey (Sept 2023) that
//   found the same 2-3x order of magnitude. Used ONLY to estimate retail
//   for crops where no direct retail figure could be found; never applied
//   where a real, direct retail figure exists.
import { activeAccountLocalStorageKey } from './account-local-storage';

export interface CropPrice {
  retailPerKg: number;
  wholesalePerKg: number;
  /** 'sourced' = both figures traced to a real, dated source. 'estimated' =
   *  at least one figure is derived (via the wholesale/retail ratio, a
   *  same-food-group proxy, or general knowledge) rather than directly
   *  found — a real number, but a rougher one; expect to correct it. */
  confidence: 'sourced' | 'estimated';
  /** The date THIS price is from — its market trading day where one applies, else the
   *  day it was researched — when that is not the shared snapshot date
   *  (PRICE_SNAPSHOT_DATE in components/prices/CropPriceGuide.format.ts). Set it on any
   *  entry added or refreshed in a later pass. The farm-gate card prints "Priced <date>"
   *  directly under the number, so that date has to belong to the number beside it, not
   *  to the book as a whole. Absent = researched in the shared pass. Never set on a
   *  farmer's own override — see asFarmerOwnPrice. */
  pricedAt?: string;
}

export const DEFAULT_CROP_PRICES: Record<string, CropPrice> = {
  // Direct retail source; wholesale derived via the root/fruiting ratio (~38%).
  // Retail is the dated observed figure; wholesale was derived from a broad
  // market ratio rather than observed for this crop, so the pair cannot be
  // labelled as a fully sourced snapshot.
  'dry-beans': { retailPerKg: 65, wholesalePerKg: 25, confidence: 'estimated' },
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
  chilli: { retailPerKg: 70, wholesalePerKg: 25, confidence: 'estimated' }, // no Joburg Market figure found (traded on essentially no reported volume) — a general shelf-price estimate reflecting chilli's known small-quantity, higher-R/kg character versus green pepper, not a sourced trade figure
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

  // turnip (priced 2026-08-20, when the crop itself was added — see
  // crop-catalog.ts): real Joburg Market wholesale trade for 19 August 2026 —
  // R650.00 total value over 127 kg sold citywide = R5.12/kg
  // (joburgmarket.co.za/jhb-market/dailyprices.php, fetched 2026-08-20).
  // Thin volume, same caveat as amadumbe above — a rough regional signal, not
  // a firm number. That trading day is five weeks after the rest of this
  // book, so this entry carries its own `pricedAt` rather than inheriting the
  // shared snapshot date. No direct SA retail listing found (turnip barely
  // appears in mainstream SA retail), so retail is derived via the root-crop
  // wholesale/retail ratio (~38%, the same carrot/potato/onion cluster ratio
  // used for dry-beans above): 5.12/0.38 ≈ R13/kg, in the same band as
  // carrots' real R14/kg — sanity-checked, not just formula output.
  turnip: { retailPerKg: 13, wholesalePerKg: 5.12, confidence: 'estimated', pricedAt: '19 August 2026' },
};

// Herbs are sold and valued completely differently from bulk vegetables —
// coriander retails by the ~20g bunch (roughly R8-15/bunch), which converts
// to an eye-watering R400+/kg that would look like a bug sitting in a table
// next to R15/kg cabbage, and no real per-kg source was found for it either.
// Deliberately excluded from price-based value (kg totals elsewhere are
// unaffected) rather than showing a number nobody could sanity-check.
//
// true-spinach (added 2026-08-20): en-ZA market "spinach" is not this crop.
// SA growing guides say so plainly — "Most of the “spinach” sold in South
// African supermarkets is actually Swiss chard" (plantinfo.co.za, "How to
// Grow Spinach (Swiss Chard) in South Africa", fetched 2026-08-20).
// Checked against this file's own numbers rather than taken on trust: the
// Joburg Market wholesale "spinach" commodity traded R79,551.72 over
// 33,083 kg on 19 August 2026 = R2.40/kg (joburgmarket.co.za/jhb-market/
// dailyprices.php, fetched 2026-08-20) — the same figure, to the cent, as
// this file's own swiss-chard wholesale (2.4) above. That exact match is
// the check: the commodity the market calls "spinach" is the crop already
// priced here under 'swiss-chard', so pricing true-spinach off it would
// re-price chard under a second catalog key rather than put a real
// Spinacia oleracea number in front of a farmer.
// The retail side has coriander's problem. What is sold in SA as true
// spinach is the washed baby/English spinach salad bag — a 100-200g
// packaged salad line, priced as one. A per-kg figure derived from a salad
// bag looks like a bug next to R14/kg carrots AND describes a different
// product from the bunched, mature-leaf crop this catalog models, so it
// would misrepresent a field planting rather than estimate it. No
// bunch-form or field-crop per-kg price for true spinach specifically could
// be found. Honest exclusion, same pattern as coriander.
export const UNPRICED_CROPS = new Set<string>(['coriander', 'true-spinach']);

const PRICE_OVERRIDES_KEY = 'imbewu_crop_price_overrides_v1';

export function loadCropPriceOverrides(): Record<string, CropPrice> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(
      activeAccountLocalStorageKey(PRICE_OVERRIDES_KEY),
    );
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    // A ZERO OR NEGATIVE OVERRIDE IS NOT AN OPINION ABOUT PRICE, IT IS A BROKEN FIELD.
    //
    // Both editor inputs coerced with `Number(value) || 0` and wrote through on every keystroke, so
    // clearing a field to retype it persisted `0`. priceFor() falls back with `??`, which only
    // treats null/undefined as missing, so a stored 0 permanently shadowed the researched default —
    // and there is no reset control on the page, so it could not be undone. Every month of that crop
    // then contributed R0 to the income chart and to the year estimate, with no per-crop tooltip to
    // show which crop had gone silent.
    //
    // Dropped on READ as well as on write, because the bad values already in farmers' browsers have
    // to heal themselves; a write-side guard alone would only protect people who had not hit it yet.
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, v]) => isUsablePrice(v)),
    ) as Record<string, CropPrice>;
  } catch {
    return {};
  }
}

/** A price a farmer could actually sell at: both figures present, finite and above zero. */
export function isUsablePrice(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as { retailPerKg?: unknown; wholesalePerKg?: unknown };
  const ok = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
  return ok(p.retailPerKg) && ok(p.wholesalePerKg);
}

/**
 * A farmer's own edited price, stripped of the price book's research provenance.
 *
 * THE EDITOR BUILDS AN OVERRIDE BY SPREADING THE RESEARCHED DEFAULT — `{ ...price,
 * retailPerKg: Number(...) }` in app/facilitator/crops/page.tsx. Without this, a farmer who
 * corrects turnip today keeps the book's `pricedAt`, and the farm-gate card then prints
 * "Priced 19 August 2026" directly under a number the farmer typed this morning: a freshness
 * claim about a figure that has nothing to do with that date. The editor already downgrades
 * `confidence` to 'estimated' at the input for the same reason; this is the other half of the
 * same provenance reset, kept here so it holds for every caller and not just that one handler.
 */
export function asFarmerOwnPrice(price: CropPrice): CropPrice {
  const { pricedAt: _researchDate, ...own } = price;
  return own;
}

export function saveCropPriceOverrides(overrides: Record<string, CropPrice>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  // Never persist an unusable override — see isUsablePrice. Dropping the key restores the
  // researched default, which is the only "reset" the editor has. Stored overrides are the
  // farmer's own numbers by definition, so none of them keeps the book's research date.
  overrides = Object.fromEntries(
    Object.entries(overrides ?? {})
      .filter(([, v]) => isUsablePrice(v))
      .map(([k, v]) => [k, asFarmerOwnPrice(v as CropPrice)]),
  ) as Record<string, CropPrice>;
  try {
    window.localStorage.setItem(
      activeAccountLocalStorageKey(PRICE_OVERRIDES_KEY),
      JSON.stringify(overrides),
    );
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveCropPlan.
  }
}

/** The effective price for a crop — a farmer's own edit if they've made one, else the researched default, else null (unpriced, e.g. herbs sold by the bunch). */
export function priceFor(cropKey: string, overrides: Record<string, CropPrice>): CropPrice | null {
  if (UNPRICED_CROPS.has(cropKey)) return null;
  return overrides[cropKey] ?? DEFAULT_CROP_PRICES[cropKey] ?? null;
}
