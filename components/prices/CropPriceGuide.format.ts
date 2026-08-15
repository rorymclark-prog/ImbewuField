/**
 * Pure crop/price lookup for CropPriceGuide.tsx.
 *
 * WHY THIS IS A SEPARATE .ts FILE, NOT PART OF THE .tsx COMPONENT
 * ───────────────────────────────────────────────────────────────
 * Node's built-in type stripping cannot load `.tsx` (it does not parse JSX), so anything that
 * needs a `node --test` unit test has to live in a plain `.ts` module — same split as
 * components/network/FarmerPanel.format.ts. Everything here is pure — no React, no I/O — which
 * keeps tests/farm-gate-prices.test.ts a millisecond-scale test with no DOM.
 */
import { CROPS, type CropDef } from '@/lib/crop-catalog';
import { priceFor, type CropPrice } from '@/lib/crop-prices';

/**
 * The price book (lib/crop-prices.ts) is a ONE-TIME researched snapshot, not a live feed — see
 * that file's header comment for the full sourcing note. There is no per-crop date field; every
 * price, sourced or estimated, shares this one snapshot date. Repeated here as the exact wording
 * already shown to farmers on the crop-plan value tab (app/facilitator/crops/page.tsx: "Default
 * prices are an editable South African snapshot from 14 July 2026"), not a new date invented for
 * this screen.
 */
export const PRICE_SNAPSHOT_DATE = '14 July 2026';

export interface PricedCrop {
  key: string;
  name: string;
  icon: string;
  price: CropPrice;
}

/**
 * Every catalog crop that actually has a usable price right now — a farmer's own edit
 * (priceFor checks overrides first, same source of truth as the rest of the app) or the
 * researched default. Herbs like coriander are deliberately unpriced (see UNPRICED_CROPS in
 * lib/crop-prices.ts) and a few catalog crops (e.g. oats) simply have no researched default
 * either; both are left out here rather than shown as a crop a farmer can tap into a dead end.
 * Sorted by name so a farmer can find a crop by scanning, not by remembering catalog planting
 * order — same reasoning as components/exchange/NewListingForm.tsx's cropOptions.
 */
export function pricedCropList(overrides: Record<string, CropPrice>): PricedCrop[] {
  return CROPS.map((crop) => ({ crop, price: priceFor(crop.key, overrides) }))
    .filter((entry): entry is { crop: CropDef; price: CropPrice } => entry.price !== null)
    .map(({ crop, price }) => ({ key: crop.key, name: crop.name, icon: crop.icon, price }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** "5.5" not "5.50", "61" not "61.00" — the price book's own values (see lib/crop-prices.ts)
 *  are already clean to at most one decimal; this just avoids a trailing ".00" on the common case
 *  without reaching for a locale formatter this screen doesn't otherwise need. */
export function formatPrice(n: number): string {
  return String(Math.round(n * 100) / 100);
}
