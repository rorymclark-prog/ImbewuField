// What a plan's kilograms are worth — ONE formula, two screens.
//
// WHY THIS EXISTS. The crop-plan page has shown a "Plan-cycle value" figure for
// a long time, computed inline. The Finance page now shows a forward version of
// the same thing, and a second inline copy of this arithmetic would be a second
// answer to "what is my plan worth" — the two would drift the first time either
// the loss slider, the sale channel or the home-consumption rule changed, and
// nothing would fail. So the formula moved here and both screens call it.
//
// THREE RULES ARE LOAD-BEARING, and none of them is arithmetic:
//
// 1. NO RAND FIGURE UNTIL THE FARMER HAS CONFIRMED THE SLIDERS. The stored loss
//    and sell percentages open at placeholder defaults (see
//    DEFAULT_CASHFLOW_SETTINGS) and a placeholder must not produce a number a
//    farmer could quote to a lender. `confirmed` rides in the result so a caller
//    cannot forget to check it.
//
// 2. PRODUCE KEPT AT HOME IS VALUED AT RETAIL, ALWAYS. It replaces a shop
//    purchase whichever channel the farmer sells the rest through. Reusing the
//    wholesale toggle for the home side understated it and made one label
//    describe two different calculations.
//
// 3. A CROP WITH NO PRICE IS EXCLUDED AND NAMED. It is not worth zero. The
//    caller gets the names so the screen can say which crops the figure leaves
//    out — an unexplained total is the thing that makes a farmer stop trusting
//    the app.

import type { CashflowSettings } from '@/lib/crop-plan';
import type { CropPrice } from '@/lib/crop-prices';
import { priceFor } from '@/lib/crop-prices';

/** Which price a SALE is valued at. Home-kept produce ignores this — see rule 2. */
export type ValueChannel = 'retail' | 'wholesale';

/** The only shape this module needs off a yield breakdown. */
export interface PlanValueRow {
  cropKey: string;
  name: string;
  kg: number;
}

export interface PlanValue {
  /** Rand from produce sold, at the chosen channel's price. */
  cash: number;
  /** Rand of retail groceries not bought, for produce kept at home. */
  home: number;
  /** Kilograms that actually carried a price — the ones `cash` and `home` are built from. */
  pricedKg: number;
  /** Crops counted in kg elsewhere but carrying no price. Excluded here, never zeroed. */
  unpricedCropNames: string[];
  /**
   * False until the farmer has reviewed both sliders. While false, `cash` and
   * `home` are still computed (a preview beside the sliders is the whole point
   * of moving them) but NO headline, PDF or dashboard may print them.
   */
  confirmed: boolean;
}

/**
 * Value a set of crop-kg rows.
 *
 * The chain is: kg → minus the loss allowance → split by the sell share →
 * priced at the channel (sold) and at retail (kept). Applied in exactly this
 * order and exactly once; every caller passes RAW benchmark kilograms, never
 * kilograms it has already discounted itself.
 */
export function planValue(
  rows: readonly PlanValueRow[],
  overrides: Record<string, CropPrice>,
  channel: ValueChannel,
  settings: CashflowSettings,
): PlanValue {
  const harvestableFraction = 1 - clampPercent(settings.lossPercent) / 100;
  const soldFraction = clampPercent(settings.sellPercent) / 100;

  let cashAtChannel = 0;
  let homeAtRetail = 0;
  let pricedKg = 0;
  const unpriced = new Set<string>();

  for (const row of rows) {
    const price = priceFor(row.cropKey, overrides);
    if (!price) {
      unpriced.add(row.name);
      continue;
    }
    pricedKg += row.kg;
    cashAtChannel += row.kg * (channel === 'retail' ? price.retailPerKg : price.wholesalePerKg);
    homeAtRetail += row.kg * price.retailPerKg;
  }

  return {
    cash: cashAtChannel * harvestableFraction * soldFraction,
    home: homeAtRetail * harvestableFraction * (1 - soldFraction),
    pricedKg: pricedKg * harvestableFraction,
    unpricedCropNames: [...unpriced].sort((a, b) => a.localeCompare(b)),
    confirmed: settings.confirmed === true,
  };
}

/** A hand-edited store can hold anything; a percentage outside 0-100 is not one. */
function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
