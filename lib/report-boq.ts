/**
 * report-boq.ts — the BILL OF QUANTITIES and COST SUMMARY for the site report.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────────────────────
 * A consulting site report ends in a priced bill of quantities. Until now this report ended in
 * "Get local material, labour and equipment quotes for Phase 1", which is not a cost section —
 * it is an apology for not having one.
 *
 * ── THE RULE THIS MODULE EXISTS TO ENFORCE ──────────────────────────────────────────────────
 * EVERY QUANTITY IS MEASURED OFF THE FARMER'S OWN PLAN. NO QUANTITY IS EVER INFERRED.
 *
 * The failure mode this guards against is the one that has bitten this report before: a
 * plausible number substituted for a missing one, carried forward, and indistinguishable in the
 * output from a real measurement. So:
 *
 *   • An item whose rate is not in the price book is listed WITH ITS QUANTITY and an explicit
 *     "no rate" marker. It is never dropped (which would understate the build) and never
 *     costed at zero (which would understate the total while looking complete).
 *   • An item priced by AREA whose footprint was never traced is unpriced, not assumed. A
 *     greenhouse costs per m² and a count of "1 greenhouse" does not carry an m².
 *   • A tank smaller than the price book's smallest entry is unpriced rather than rounded up to
 *     the nearest one. `nearestTankKey` would happily price a 1 000 L barrel at the 2 500 L
 *     rate; that is a 2.5x overstatement wearing the costume of a lookup.
 *   • Anything the farmer marked as ALREADY EXISTING is excluded from the build cost and
 *     reported separately. You do not bill someone for their own tank.
 *
 * ── WHY defId AND kind, NOT name AND label ──────────────────────────────────────────────────
 * `FactElementGroup.name` is the DISPLAY name and the farmer may rename any item. Pricing off it
 * means a rename silently changes a cost, and two farmers' "Big tank" collide. `defId` is the
 * catalog id from lib/design-elements.ts and cannot drift. Same reasoning for `FactRoute.kind`
 * versus its prose label. Facts collected before those fields shipped carry neither, and the
 * correct outcome there is an unpriced line — not a guess parsed out of the label.
 */

import {
  PRICE_BOOK,
  DISCLAIMER,
  formatZar,
  type PriceEntry,
} from '@/lib/price-book';
import { groupDigits, type ReportSiteFacts, type FactStatus } from '@/lib/report-site-facts';
import { BED_DEF_IDS } from '@/lib/design-beds-bridge';

/**
 * Beds are billed ONCE, from their traced area, and must never also appear as counted items.
 *
 * lib/report-site-facts-collect.ts already strips these ids out of `elements`, so in the shipped
 * pipeline this set is redundant. It is here because the failure it prevents is silent and
 * expensive: a caller who assembles facts without that filter gets every bed billed twice — once
 * at R120/m² from FactBed and again as an unpriced "Bed 1 … Bed 7". The probe that renders this
 * report for the demo farm did exactly that, and the doubled beds were invisible to a green
 * suite. A bill of quantities is the one table where double-counting must be impossible by
 * construction rather than by an upstream caller remembering.
 */
const BED_DEF_ID_SET = new Set<string>(BED_DEF_IDS);

/** Why a measured line carries no money. Printed verbatim, so the reader knows it is not zero. */
export type UnpricedReason =
  /** The catalog id has no entry in the price book. */
  | 'no-rate'
  /** Priced per m² and no footprint was traced for it. */
  | 'no-area'
  /** Outside the range the price book covers (e.g. a tank below its smallest size). */
  | 'out-of-range'
  /** Already on the farm — a cost to no one. */
  | 'existing';

export interface BoqLine {
  /** Section of the bill: what kind of work this is. */
  group: 'Water' | 'Earthworks & routes' | 'Growing area' | 'Structures & planting';
  description: string;
  /** The measured quantity, already formatted with its unit ("42.5 m", "3 no.", "18 m²"). */
  quantity: string;
  /** Rate as printed ("R250/m"), or null when unpriced. */
  rate: string | null;
  /** Line total in ZAR, or null when unpriced. Never 0 as a stand-in for unknown. */
  zar: number | null;
  /** Present only when `zar` is null. */
  unpriced?: UnpricedReason;
  /** Where the quantity was measured. Printed in the bill's source column. */
  source: string;
}

export interface BillOfQuantities {
  lines: BoqLine[];
  /** Sum of the priced lines only. */
  subtotalZar: number;
  /** How many lines carry a measured quantity but no rate. */
  unpricedCount: number;
  /** Items excluded because the farmer marked them as already on the farm. */
  existingCount: number;
}

// ── The mapping (task #25's decision) ────────────────────────────────────────────────────────
//
// Catalog id → price-book key. Deliberately PARTIAL. An id absent from this table produces an
// unpriced line, which is the honest result: this app has a researched rate for a chain-link
// fence and does not have one for a playground, and pretending otherwise is how a farmer ends up
// budgeting against a number nobody stands behind.

/** Elements priced as a unit, regardless of how big they are drawn. */
const ITEM_RATE_BY_DEF_ID: Record<string, string> = {
  // Water
  borehole: 'well',
  // Growing
  // NOTE: `herb_spiral` is deliberately absent. It is one of BED_DEF_IDS, so its traced AREA is
  // already billed with the beds at the per-m² rate. Adding it here would bill it twice, at two
  // different rates, and the second line would look like a separate structure.
  banana_circle: 'banana_circle',
  tree_citrus: 'citrus_tree',
  tree_orange: 'citrus_tree',
  tree_lemon: 'citrus_tree',
  tree_grapefruit: 'citrus_tree',
  tree_avocado: 'avo_tree',
  tree_mango: 'generic_fruit_tree',
  tree_macadamia: 'generic_fruit_tree',
  tree_guava: 'generic_fruit_tree',
  tree_litchi: 'generic_fruit_tree',
  tree_pawpaw: 'generic_fruit_tree',
  tree_apple: 'generic_fruit_tree',
  tree_pear: 'generic_fruit_tree',
  tree_plum: 'generic_fruit_tree',
  tree_peach: 'generic_fruit_tree',
  tree_fig: 'generic_fruit_tree',
  tree_pomegranate: 'generic_fruit_tree',
  tree_olive: 'generic_fruit_tree',
  tree_other: 'generic_fruit_tree',
  tree_moringa: 'shrub',
  tree_natal_plum: 'shrub',
  tree_wild_plum: 'generic_fruit_tree',
  tree_waterberry: 'generic_fruit_tree',
  tree_marula: 'generic_fruit_tree',
  // Priced as a shrub alongside natal plum, not as a fruit tree: kei apple is bought as a
  // small hedging plant and is most often planted in a run, which is the shrub rate's shape.
  tree_kei_apple: 'shrub',
  tree_indigenous: 'generic_fruit_tree',
  // Structures & animals
  compost_bay: 'compost_bay',
  chicken_coop: 'chicken_coop',
  beehive: 'beehive',
  biodigester: 'biogas',
};

/**
 * Elements the price book rates PER SQUARE METRE. They are listed here so the bill can say
 * "measured quantity missing" rather than silently omitting a greenhouse — the plan records
 * that one was placed, just not how big it is.
 */
const AREA_RATED_DEF_IDS: Record<string, string> = {
  greenhouse_tunnel: 'greenhouse_per_m2',
  shade_house: 'tunnel_per_m2',
  shed: 'shed_per_m2',
  nursery_table: 'nursery_per_m2',
  pond_small: 'pond_per_m2',
  dam: 'waterbody_per_m2',
};

/** Tank catalog id → its price-book key. Sizes below the book's range are absent on purpose. */
const TANK_RATE_BY_DEF_ID: Record<string, string> = {
  jojo_2500: 'tank_2500',
  jojo_5000: 'tank_5000',
  jojo_10000: 'tank_10000',
};

/** Route kind → per-metre price-book key. `bedpath` and `greywater` have no researched rate. */
const ROUTE_RATE_BY_KIND: Record<string, string> = {
  fence: 'fence_per_m',
  path: 'path_per_m',
  swale: 'swale_per_m',
  pipe: 'pipe_per_m',
  drip: 'drip_per_m',
  windbreak: 'windbreak_per_m',
};

// Digit grouping is imported, not redefined. This file used to carry its own copy whose comment
// asserted that lib/report-site-facts.ts "carries the same rule and the same reason" — it did not,
// it grouped with a comma, and the same document printed both conventions.

const UNPRICED_TEXT: Record<UnpricedReason, string> = {
  'no-rate': 'no researched rate — get a local quote',
  'no-area': 'quantity not measured — trace its footprint to price it',
  'out-of-range': 'outside the price book\'s size range — get a local quote',
  existing: 'already on the farm — not a build cost',
};

function rateText(entry: PriceEntry): string {
  if (entry.unit === 'each') return `${formatZar(entry.zar)} each`;
  if (entry.unit === 'per_m') return `${formatZar(entry.zar)}/m`;
  return `${formatZar(entry.zar)}/m²`;
}

/** "3 no." — a count, in the bill-of-quantities convention. */
function countQty(n: number): string {
  return `${n} no.`;
}

function metresQty(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)} m`;
}

function areaQty(n: number): string {
  return `${groupDigits(n)} m²`;
}

/**
 * Existing items are recorded, not billed. 'mixed' is billed — part of it is still to build.
 *
 * Right in principle, and it used to be wrong in amount: a mixed group arrived carrying only a
 * COMBINED count, so billing it charged for the existing units too — one tank already standing
 * and one to buy quoted R14,000 against a R7,000 build. Fresh reports no longer produce 'mixed'
 * at all, because summariseDesignStudio now groups by status, so counts arrive already separated.
 * This branch stays for saved reports written before that split, where the information needed to
 * bill only the proposed share was never recorded and cannot be recovered here.
 */
function isExisting(status: FactStatus): boolean {
  return status === 'existing';
}

/**
 * Build the bill from the site facts.
 *
 * Every line here traces to something the farmer drew. Nothing is added because a permaculture
 * design "usually has one".
 */
export function buildBillOfQuantities(facts: ReportSiteFacts | null | undefined): BillOfQuantities {
  const lines: BoqLine[] = [];
  let existingCount = 0;

  const priced = (
    group: BoqLine['group'],
    description: string,
    quantity: string,
    entry: PriceEntry,
    zar: number,
    source: string,
  ): void => {
    lines.push({ group, description, quantity, rate: rateText(entry), zar, source });
  };

  const unpriced = (
    group: BoqLine['group'],
    description: string,
    quantity: string,
    reason: UnpricedReason,
    source: string,
  ): void => {
    lines.push({ group, description, quantity, rate: null, zar: null, unpriced: reason, source });
  };

  // ── Water: tanks ──
  for (const tank of facts?.water?.tanks ?? []) {
    if (isExisting(tank.status)) { existingCount += tank.count; continue; }
    const source = 'Placed in the Design Studio';
    // A tank's price follows its STATED capacity, and an unstated capacity stays unpriced —
    // FactTank.statedLitres is null precisely so a size is never guessed from a name.
    if (tank.statedLitres === null) {
      unpriced('Water', tank.name, countQty(tank.count), 'no-rate', source);
      continue;
    }
    const key = TANK_RATE_BY_DEF_ID[tankKeyFor(tank.statedLitres)];
    if (!key) {
      unpriced('Water', `${tank.name} (${groupDigits(tank.statedLitres)} L)`, countQty(tank.count), 'out-of-range', source);
      continue;
    }
    const entry = PRICE_BOOK[key];
    priced('Water', `${tank.name} (${groupDigits(tank.statedLitres)} L)`, countQty(tank.count), entry, entry.zar * tank.count, source);
  }

  // ── Earthworks and routes ──
  for (const route of facts?.design?.routes ?? []) {
    const source = 'Measured off the traced line';
    const key = route.kind ? ROUTE_RATE_BY_KIND[route.kind] : undefined;
    if (!key) {
      unpriced('Earthworks & routes', route.label, metresQty(route.totalLengthM), 'no-rate', source);
      continue;
    }
    const entry = PRICE_BOOK[key];
    priced(
      'Earthworks & routes',
      route.label,
      metresQty(route.totalLengthM),
      entry,
      Math.round(route.totalLengthM * entry.zar),
      source,
    );
  }

  // ── Growing area: beds and staple plots, priced off their traced area ──
  const design = facts?.design;
  if (design && design.bedAreaM2 > 0) {
    const entry = PRICE_BOOK.veg_bed_per_m2;
    priced(
      'Growing area',
      `Vegetable beds established (${design.bedCount} bed${design.bedCount === 1 ? '' : 's'})`,
      areaQty(design.bedAreaM2),
      entry,
      Math.round(design.bedAreaM2 * entry.zar),
      'Measured off the farmer\'s plan',
    );
  }
  if (design && design.plotAreaM2 > 0) {
    // Staple plots are field-scale — design-canvas.ts's own reason for the tool is "a farmer
    // whose main food production is a quarter-hectare of mielies". veg_bed_per_m2 is the ONLY
    // per-m² growing-area rate in the price book, but it prices an intensive hand-tended bed
    // ("soil amendment/compost and seed/seedlings" — see price-book.ts). Applying it to a
    // 2 500 m² maize/beans/pumpkin field used to print R300 000 for ground that needs tillage
    // and seed, not per-square-metre compost — an invented number wearing the costume of a
    // measurement. There is no researched field-crop rate in the price book, so this stays
    // unpriced rather than borrowing the wrong one, exactly as this file's own header requires:
    // a measured quantity with no rate that actually fits it is listed, never costed at one that
    // doesn't.
    unpriced(
      'Growing area',
      `Staple plots established (${design.plotCount} plot${design.plotCount === 1 ? '' : 's'})`,
      areaQty(design.plotAreaM2),
      'no-rate',
      'Measured off the farmer\'s plan',
    );
  }

  // ── Everything else placed on the plan ──
  for (const group of design?.elements ?? []) {
    if (isExisting(group.status)) { existingCount += group.count; continue; }
    const source = 'Placed in the Design Studio';
    const defId = group.defId;
    // Tanks are billed above from FactWater, which is the only place their capacity is known.
    if (defId && (defId in TANK_RATE_BY_DEF_ID || defId.startsWith('jojo_') || defId === 'rain_barrel')) continue;
    // Beds are billed above from their traced area — see BED_DEF_ID_SET.
    if (defId && BED_DEF_ID_SET.has(defId)) continue;

    if (!defId) {
      unpriced('Structures & planting', group.name, countQty(group.count), 'no-rate', source);
      continue;
    }
    if (defId in AREA_RATED_DEF_IDS) {
      unpriced('Structures & planting', group.name, countQty(group.count), 'no-area', source);
      continue;
    }
    const key = ITEM_RATE_BY_DEF_ID[defId];
    if (!key) {
      unpriced('Structures & planting', group.name, countQty(group.count), 'no-rate', source);
      continue;
    }
    const entry = PRICE_BOOK[key];
    priced('Structures & planting', group.name, countQty(group.count), entry, entry.zar * group.count, source);
  }

  const subtotalZar = lines.reduce((sum, line) => sum + (line.zar ?? 0), 0);
  const unpricedCount = lines.filter((line) => line.zar === null).length;
  return { lines, subtotalZar, unpricedCount, existingCount };
}

/**
 * Which price-book tank key a stated capacity maps to — EXACTLY, never "nearest".
 *
 * price-book's own `nearestTankKey` snaps any volume to the closest of 2 500 / 5 000 / 10 000,
 * which is right for a facilitator sketching in a workshop and wrong for a bill of quantities:
 * it would price a 1 000 L barrel at the 2 500 L rate and print the result as a costed line.
 */
function tankKeyFor(litres: number): string {
  if (litres === 2500) return 'jojo_2500';
  if (litres === 5000) return 'jojo_5000';
  if (litres === 10000) return 'jojo_10000';
  return '';
}

// ── Markdown ─────────────────────────────────────────────────────────────────────────────────

const GROUP_ORDER: BoqLine['group'][] = ['Water', 'Earthworks & routes', 'Growing area', 'Structures & planting'];

/**
 * The Cost & Bill of Quantities section, written in CODE.
 *
 * Deliberately not generated: a model asked to price a build will produce a total, and a total
 * a model produced is indistinguishable on the page from one measured off the plan.
 */
export function billOfQuantitiesMarkdown(boq: BillOfQuantities): string {
  const out: string[] = [];
  out.push('## Cost & Bill of Quantities');
  out.push('');

  if (!boq.lines.length) {
    out.push('No priced work can be listed yet: nothing has been drawn on the plan to measure. Draw the beds, tanks, fences and paths in the Design Studio and this bill fills itself from those measurements.');
    out.push('');
    return out.join('\n');
  }

  out.push('Every quantity below is measured off this farm\'s own plan. Nothing here was estimated from a typical farm, and no line was added because a design "usually has one".');
  out.push('');
  out.push('| Item | Quantity | Rate | Amount | Measured from |');
  out.push('|------|----------|------|--------|---------------|');

  for (const group of GROUP_ORDER) {
    const groupLines = boq.lines.filter((line) => line.group === group);
    if (!groupLines.length) continue;
    out.push(`| **${group}** | | | | |`);
    for (const line of groupLines) {
      const amount = line.zar === null
        ? `_${UNPRICED_TEXT[line.unpriced ?? 'no-rate']}_`
        : formatZar(line.zar);
      out.push(`| ${line.description} | ${line.quantity} | ${line.rate ?? '—'} | ${amount} | ${line.source} |`);
    }
  }

  out.push('');
  out.push(`**Subtotal of the priced lines: ${formatZar(boq.subtotalZar)}**`);
  out.push('');

  if (boq.unpricedCount > 0) {
    out.push(`This subtotal is NOT the cost of the build. ${boq.unpricedCount} line${boq.unpricedCount === 1 ? ' carries' : 's carry'} a measured quantity but no rate, so the real figure is higher by whatever those cost. They are listed above with the reason, rather than left out or costed at zero — a bill that hides what it could not price reads as complete when it is not.`);
    out.push('');
  }
  if (boq.existingCount > 0) {
    out.push(`${boq.existingCount} item${boq.existingCount === 1 ? '' : 's'} marked as already on the farm ${boq.existingCount === 1 ? 'is' : 'are'} excluded from this bill. They are part of the design and not part of the spend.`);
    out.push('');
  }

  out.push(`_${DISCLAIMER}_`);
  out.push('');
  return out.join('\n');
}
