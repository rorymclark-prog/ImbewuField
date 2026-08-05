// South African home-garden crop catalog.
// Sow windows are keyed by rainfall pattern:
//   summer  = summer-rainfall interior (Gauteng / Limpopo / Mpumalanga / Free State / North West,
//             KZN Midlands) — real hard frost risk May-Aug, warm-season crops wait for it to pass.
//   winter  = winter-rainfall Western Cape (Mediterranean climate)
//             — mild wet winters, hot dry summers; warm crops grown spring-summer under irrigation.
//   all-year = frost-free subtropical/coastal Eastern Cape style climate
//             — broader, more forgiving windows.
//   mild-frost = summer-rainfall coastal hinterland (e.g. Durban's Upper Highway belt —
//             Hillcrest/Kloof/Gillitts-type elevated ground 20-40km inland of the coast):
//             real but light frost in low pockets on clear winter nights, not Highveld-severe.
//             Frost-tender warm-season crops still wait for it to pass (same windows as
//             'summer'); frost-hardy cool-season crops (brassicas, alliums, root veg, legumes,
//             leafy greens) shrug it off and get the same forgiving windows as 'all-year'.
// Months are 1-12 (Jan-Dec). Windows are conservative (home-gardener friendly, not
// commercial-agronomy edge cases).

export type RainPattern = 'summer' | 'winter' | 'all-year' | 'mild-frost';

/**
 * Purely advisory — surfaced to the farmer as "which variety to look for",
 * never consulted by the sow-window/auto-suggest logic. Deliberately only
 * populated for crops where South African seed suppliers/extension guidance
 * shows variety choice is a REAL season/region-driven decision (researched
 * 2026-07-14) — not added uniformly to every crop, since for most of this
 * catalog (peppers, pumpkin/butternut, chard, sweet potato...) the published
 * SA guidance is purely about sow-timing, and inventing a variety
 * distinction there would be fake precision, not a real recommendation.
 */
export interface CropVariety {
  name: string;
  /** Which part of the crop's own sow window this variety suits — free-text
   *  guidance (e.g. "Apr-Aug sowings", "Highveld/interior"), not a filter. */
  bestFor: string;
  note: string;
}

export interface CropDef {
  key: string;
  name: string;
  icon: string;
  sowMonths: Record<RainPattern, number[]>;
  daysToHarvest: number;
  transplant?: boolean;
  spacingCm: number;
  /** Sourced row/in-row/depth split (2026-07-15 agronomy pass) — additive,
   *  only populated where a directly-quoted SA source gives the split (see
   *  per-crop citations below). Undefined for every other crop; UI falls
   *  back to the single spacingCm figure ("plant spacing ~Xcm"). spacingCm
   *  itself is left untouched everywhere — it's the deprecated fallback,
   *  not superseded in-place, so nothing else reading it regresses. */
  rowSpacingCm?: number;
  inRowSpacingCm?: number;
  sowDepthCm?: number;
  yieldKgPerM2: number;
  note: string;
  varieties?: CropVariety[];
  /** Harvest is NOT always a single-instant event — cut-and-come-again leafy
   *  greens and "keeps producing" fruiting veg go on yielding for months
   *  after the first picking. Extra whole months of ongoing FRESH harvest
   *  after daysToHarvest, on top of the harvest month itself. Undefined/0 =
   *  a one-shot harvest (pull the whole root/head/fruit at once). General
   *  home-gardener estimates, not lab-precise. */
  harvestWindowMonths?: number;
  /** How many months a harvested crop keeps in storage (root cellar, dry
   *  storage, cured) before it's no longer good — undefined/0 = eat fresh,
   *  doesn't meaningfully store. This is what makes "food security" more
   *  than just "what's being harvested this exact month": a cured pumpkin
   *  or a bag of onions is still food on hand well after harvest day. */
  storageMonths?: number;
}

export const CROPS: CropDef[] = [
  {
    key: 'maize',
    name: 'Maize (mielies)',
    icon: '🌽',
    sowMonths: {
      summer: [10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [2, 3, 8, 9, 10, 11],
      'mild-frost': [10, 11, 12],
    },
    daysToHarvest: 120,
    spacingCm: 30,
    // GRAIN/dried maize (mielie-meal staple), not sweetcorn — owner decision
    // 2026-07-15. Source dataset gave 81x22cm for SWEETCORN (Starke Ayres
    // Sweetcorn Production Guideline 2019 sec 3.3); using the grain-maize
    // figure instead since that's the actual product. A 'sweetcorn' variant
    // (81cm row x 22cm inRow, ~87-95 days) could be added as a separate
    // catalog entry later if fresh-corn eating becomes a distinct use case.
    rowSpacingCm: 90,
    inRowSpacingCm: 20,
    sowDepthCm: 4, // 3-5cm — Starke Ayres Sweetcorn Guideline sec 3.3 / planting-depth article (depth is not cultivar-specific)
    yieldKgPerM2: 0.3, // NDF South Africa Maize Factsheet + Scielo Eastern Cape smallholder study (2-4 t/ha smallholder dryland, grain maize)
    note: 'Direct-sow once frost risk has passed; block-plant several rows together for good pollination.',
    storageMonths: 10,
  },
  {
    key: 'dry-beans',
    name: 'Dry beans (sugar beans)',
    icon: '🫘',
    sowMonths: {
      summer: [11, 12],
      winter: [9, 10],
      'all-year': [2, 3, 8, 9, 10],
      'mild-frost': [11, 12],
    },
    daysToHarvest: 115, // ~115 (range 109-121) — N2Africa 'Better sugar beans' Southern Africa production booklet
    spacingCm: 10,
    // Row spacing now sourced: sugar beans are bush-type, and KZN DARD's own
    // spacing table prints the bush-bean row directly. Until 2026-08-05 only
    // the SADC in-row figure existed, so rowCm fell back to it — 15x15 =
    // 44 plants/m² (444,000/ha), ~3x any real sugar-bean population and one of
    // the worst seed over-orders in the catalog. 15x52.5 = 12.7/m² = 127,000/ha,
    // inside the dryland 100-180k/ha range.
    rowSpacingCm: 52.5, // 450-600mm — KZN DARD 'Plant Establishment', spacing table (Bean, bush)
    inRowSpacingCm: 15, // 10-20cm — SADC Sugar Bean guideline (kept over DARD's 50-80mm bush-bean figure: sugar-bean-specific source)
    sowDepthCm: 3, // 20-40mm — KZN DARD 'Plant Establishment', spacing table (Bean, bush)
    yieldKgPerM2: 0.2, // ~0.2 (1.8-2.2 t/ha) — Grain SA 'Know the value of DRY BEANS'
    note: 'Leave pods to dry and rattle on the plant before shelling and storing.',
    storageMonths: 12,
  },
  {
    key: 'green-beans',
    name: 'Green beans',
    icon: '🫛',
    sowMonths: {
      summer: [9, 10, 11, 12, 1],
      winter: [8, 9, 10, 11],
      'all-year': [2, 3, 4, 8, 9, 10, 11],
      'mild-frost': [9, 10, 11, 12, 1],
    },
    daysToHarvest: 60,
    spacingCm: 10,
    rowSpacingCm: 45, // double-row, +75-90cm walkway between double-rows — Starke Ayres Bean (Green Bean) Production Guideline 2019 sec 3.3.4
    inRowSpacingCm: 8, // 7-10cm, same guideline
    sowDepthCm: 1.3, // 10-15mm, same guideline
    yieldKgPerM2: 0.6, // ~0.6 (5-8 t/ha) — KZN DARD Expected Yields Table 8 (old value was the doc's own 'exceptional trial-only' outlier)
    note: 'Sow every 2-3 weeks for a continuous harvest through the season.',
    harvestWindowMonths: 1,
  },
  {
    key: 'butternut',
    name: 'Butternut',
    icon: '🧡',
    sowMonths: {
      summer: [10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [8, 9, 10, 11],
      'mild-frost': [10, 11, 12],
    },
    daysToHarvest: 110,
    spacingCm: 100,
    rowSpacingCm: 150, // Starke Ayres Butternut Production Guideline 2019 sec 3.4
    inRowSpacingCm: 40, // same guideline
    yieldKgPerM2: 1.5, // ~1.5 (12-18 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Vigorous vine — give it room to sprawl or train it up a trellis.',
    storageMonths: 4,
  },
  {
    key: 'pumpkin',
    name: 'Pumpkin',
    icon: '🎃',
    sowMonths: {
      summer: [10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [8, 9, 10, 11],
      'mild-frost': [9, 10, 11], // shifted earlier, dropped Dec — Starke Ayres national Sowing Guide + Seeds for Africa KZN chart (both agree Sep-Nov, not Oct-Dec)
    },
    daysToHarvest: 87, // ~85-90 (range 80-95 for summer-sown varieties; 110 was a winter-planting figure) — Starke Ayres Pumpkin days-to-maturity pages
    spacingCm: 120,
    // Cross-check: 65x250cm = 0.62 plants/m² = 6,150/ha — agrees with the
    // density source's own semi-bush 6,500-7,000/ha figure below.
    rowSpacingCm: 250, // 2500mm — KZN DARD 'Plant Establishment', spacing table (Pumpkin)
    inRowSpacingCm: 65, // 600-700mm — same table, same row
    sowDepthCm: 2.5, // 20-30mm — same table
    // Prior density-only source (semi-bush 6,500-7,000/ha, vining 5,000/ha,
    // dryland 3,500/ha) kept as the sanity bound on the cm split above.
    yieldKgPerM2: 1.5, // ~1.5 (12-20 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Needs bees for pollination; hand-pollinate with a small brush if fruit set is poor.',
    storageMonths: 4,
  },
  {
    key: 'swiss-chard',
    name: 'Swiss chard (spinach)',
    icon: '🍃',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
      // Genuinely frost-hardy — light frost doesn't touch it, so a
      // mild-frost hinterland site can sow it right through June/July too.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    daysToHarvest: 60,
    spacingCm: 30,
    rowSpacingCm: 47, // 45-50cm — Starke Ayres Swiss Chard Production Guideline 2019
    inRowSpacingCm: 12, // 10-15cm direct-sown, same guideline
    yieldKgPerM2: 3, // = 30 t/ha, the "likely" commercial yield — KZN DARD Expected Yields Table 8 (Swiss chard 20/30/40 conservative/likely/target)
    note: 'Cut-and-come-again — harvest outer leaves and it keeps producing for months.',
    harvestWindowMonths: 3,
  },
  {
    key: 'kale',
    name: 'Kale',
    icon: '🌿',
    sowMonths: {
      summer: [1, 2, 3, 8, 9],
      winter: [1, 2, 3, 8, 9],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11, 12],
      // Kale shrugs off far worse than light frost — its own note below says
      // frost sweetens it — so it's a genuine May-Jul winter crop here.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    daysToHarvest: 70,
    transplant: true,
    spacingCm: 45,
    // NOT source-backed — kale doesn't appear as its own line in the KZN DARD
    // Expected Yields table (checked 2026-07-15; the table only has "Spinach,
    // true" and "Swiss chard" among leafy greens) and no other SA
    // production-guide figure was found. Left as the pre-existing estimate;
    // still needs an agronomist/grower-survey figure to verify.
    yieldKgPerM2: 2.5,
    note: 'Transplant seedlings once they have 4-5 true leaves; a light frost sweetens the flavour.',
    harvestWindowMonths: 2,
  },
  {
    key: 'cabbage',
    name: 'Cabbage',
    icon: '🥬',
    sowMonths: {
      summer: [1, 2, 3, 8, 9],
      winter: [1, 2, 3, 8, 9],
      'all-year': [1, 2, 3, 4, 8, 9, 10],
      // Classic winter crop — heads firm up better with a cool spell.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
    daysToHarvest: 90,
    transplant: true,
    spacingCm: 45,
    // Switched to KZN DARD's table (350-450 x 500-600mm) on 2026-08-05. The
    // previous pair mixed a Starke Ayres commercial loose-head row (60-70cm)
    // with an inRow of 60 whose own comment cited "25cm for baby cabbage" — a
    // transcription casualty. At 60x65 the plan UNDER-planted cabbage
    // (2.6 plants/m² vs DARD's 4.5), the one spacing error that cost yield
    // rather than seed money.
    rowSpacingCm: 55, // 500-600mm — KZN DARD 'Plant Establishment', spacing table (Cabbage)
    inRowSpacingCm: 40, // 350-450mm — same table, same row
    yieldKgPerM2: 3, // = 30 t/ha, the "conservative" commercial yield — KZN DARD Expected Yields Table 8 (Cabbage 30/50/80-90 conservative/likely/target); kept deliberately conservative since a home garden without commercial inputs won't reach the 50-90 t/ha likely/target range
    note: 'Firm the soil well at transplanting to help heads form tightly.',
    varieties: [
      { name: 'Accord F1 (or similar cold-tolerant hybrid)', bestFor: 'Apr-Aug (winter) sowings', note: 'Bred for the winter slot — avoid growing a summer-type variety over winter, heads form poorly and bolt risk rises.' },
      { name: 'Optima F1 (or similar summer-bred hybrid)', bestFor: 'Sep-Mar (summer) sowings', note: "Selected for summer production; the reverse mistake — a winter-bred variety sown in summer — tends to bolt before heading." },
      { name: 'Conquistador (or similar dual-season type)', bestFor: 'Either season', note: 'Marketed as tolerating both extremes — the safer pick if you only want to keep one cabbage seed packet.' },
    ],
    storageMonths: 1,
  },
  {
    key: 'carrots',
    name: 'Carrots',
    icon: '🥕',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11],
      // Foliage handles light frost fine and the root's underground anyway.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
    daysToHarvest: 100, // ~100 (true range 90-105 summer / 110-120 winter — single-number compromise, season-split not modeled) — Starke Ayres Allyance/Kuroda/Chantenay Karoo variety pages
    spacingCm: 8,
    // 3.5x30cm = 95 plants/m² = 950,000/ha — inside the previously-found
    // aggregate population range (600,000-3,500,000/ha). The old 8x8 square
    // fallback gave 156/m², over-ordering seed ~1.6x.
    rowSpacingCm: 30, // 200-400mm — KZN DARD 'Plant Establishment', spacing table (Carrot)
    inRowSpacingCm: 3.5, // 20-50mm — same table, same row
    sowDepthCm: 1.0, // 0.5-1.5cm — Starke Ayres Carrot Production Guideline 2019 sec 3.3.2
    yieldKgPerM2: 2.2, // ~2.2 (20-25 t/ha) — KZN DARD Expected Yields Table 8
    note: "Direct-sow only — carrots don't transplant well. Keep the bed loose and stone-free.",
    varieties: [
      { name: 'Nantes type', bestFor: 'Either season', note: 'The reliable general-purpose choice — good bolt tolerance, forgiving of an off-season sowing.' },
      { name: 'Allyance F1 (or similar season-tuned hybrid)', bestFor: 'Timing awareness', note: 'Maturity runs faster in summer (~90-105 days) than winter (~110-120 days) — expect a longer wait for a winter sowing, not a failed one.' },
    ],
    storageMonths: 3,
  },
  {
    key: 'beetroot',
    name: 'Beetroot',
    icon: '🫜',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11],
      // Same logic as carrots — root crop, foliage tolerates light frost.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
    daysToHarvest: 75, // ~75 (true range 55-85 summer / 85-115 winter — single-number compromise, season-split not modeled) — Starke Ayres Red Atlas and STAR 1105 beetroot variety pages
    spacingCm: 10,
    rowSpacingCm: 32, // 20-45cm — Starke Ayres Beetroot Production Guideline 2019 sec 3.3.2
    inRowSpacingCm: 7, // 5-10cm, same guideline
    sowDepthCm: 1.75, // 1.0-2.5cm, same guideline sec 3.3.3
    yieldKgPerM2: 1.6, // ~1.6 (14-18 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Thin seedlings early — each "seed" is actually a cluster of several.',
    storageMonths: 2,
  },
  {
    key: 'onions',
    name: 'Onions',
    icon: '🧅',
    sowMonths: {
      summer: [3, 4, 5],
      winter: [2, 3, 4],
      'all-year': [2, 3, 4, 5],
      'mild-frost': [2, 3, 4, 5],
    },
    daysToHarvest: 150,
    transplant: true,
    spacingCm: 10,
    sowDepthCm: 1.5, // 1-2cm — Starke Ayres Onion Production Guideline 2019 sec 3.3
    // Midpoints give 7x25cm = 57 plants/m² = 570,000/ha; the previously-found
    // aggregate population (700,000-800,000/ha) sits at the dense end of the
    // DARD ranges (60x200mm = 830,000/ha), so both sources are consistent.
    rowSpacingCm: 25, // 200-300mm — KZN DARD 'Plant Establishment', spacing table (Onion)
    inRowSpacingCm: 7, // 60-80mm — same table, same row
    yieldKgPerM2: 2.0, // ~2.0 (15-25 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Long-season crop — sow into trays in autumn, transplant seedlings about six weeks later.',
    varieties: [
      { name: 'Short-day type', bestFor: 'Highveld / northern & central interior', note: "Onions bulb by day-length, not just temperature — this is the one crop where variety is nearly mandatory, not a refinement: the wrong day-length type for your area simply won't bulb properly no matter when you sow it." },
      { name: 'Intermediate-day type', bestFor: 'Central & southern regions, coastal areas', note: "Suits areas with a bigger swing in day length through the growing season. Check the day-length rating on the seed packet — it matters more here than the sowing month." },
    ],
    storageMonths: 5,
  },
  {
    key: 'tomatoes',
    name: 'Tomatoes',
    icon: '🍅',
    sowMonths: {
      summer: [8, 9, 10],
      winter: [8, 9, 10],
      'all-year': [2, 3, 7, 8, 9],
      'mild-frost': [8, 9, 10],
    },
    daysToHarvest: 80,
    transplant: true,
    spacingCm: 50,
    // NOT source-backed: the only cited figure (Starke Ayres Tomato Guideline
    // 2019 sec 3.4) is a COMMERCIAL 180-250cm row spec — field-tractor spacing,
    // wrong for a hand-worked home bed. 90cm is a general home-garden estimate
    // for staked tomatoes (typical bed practice ~60-90cm rows), deliberately
    // used instead — an estimate to adjust, not a verified number.
    rowSpacingCm: 90,
    inRowSpacingCm: 40, // not closer than 35-40cm — same guideline (high confidence)
    yieldKgPerM2: 4, // = 40 t/ha, between the "conservative" (30) and "likely" (45-50) commercial tiers — KZN DARD Expected Yields Table 8 (Tomato 30/45-50/60-80)
    note: 'Stake or cage plants early; feed consistently once fruit starts to set.',
    varieties: [
      { name: 'Floradade (or similar heat-tolerant variety)', bestFor: 'Hot summer / subtropical coastal growing', note: 'Bred specifically for heat tolerance — worth seeking out if your area gets properly hot in summer, since an ordinary variety can drop flowers/stop setting fruit in extreme heat.' },
    ],
    harvestWindowMonths: 2,
  },
  {
    key: 'peppers',
    name: 'Peppers',
    icon: '🫑',
    sowMonths: {
      summer: [8, 9, 10],
      winter: [8, 9, 10],
      'all-year': [2, 3, 7, 8, 9],
      'mild-frost': [9, 10], // dropped Aug — Seeds for Africa KZN chart (peppers are slow-germinating and cold-sensitive, consistent with dropping the earliest month)
    },
    daysToHarvest: 90,
    transplant: true,
    spacingCm: 40,
    rowSpacingCm: 125, // 100-150cm — Starke Ayres Sweet & Hot Pepper Production Guideline 2019
    inRowSpacingCm: 40, // range 20-50cm by target population, same guideline
    yieldKgPerM2: 2.2, // ~2.2 (20-25 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Slow to germinate — start indoors or in a warm spot for a head start.',
    harvestWindowMonths: 2,
  },
  {
    key: 'sweet-potato',
    name: 'Sweet potato',
    icon: '🍠',
    sowMonths: {
      summer: [10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [8, 9, 10, 11],
      'mild-frost': [10, 11, 12],
    },
    daysToHarvest: 120,
    // Bumped from 30cm: the tubers themselves don't need much room, but the
    // VINES sprawl well beyond a bush potato's footprint — not enough to
    // need a fully dedicated bed like a true isSpaceHungry vine (pumpkin/
    // butternut/watermelon can spread 2-4m+), but more than a plain root
    // crop, so it gets a middle-ground spacing instead of either extreme.
    spacingCm: 60,
    // Cross-check: 32.5x95cm = 3.24 plants/m² = 32,400/ha — matches the same
    // table's own stated planting rate of 30,000-35,000 cuttings/ha exactly.
    // Supersedes the earlier "no primary source reachable" gap.
    rowSpacingCm: 95, // 900-1000mm ridges — KZN DARD 'Plant Establishment', spacing table (Sweet potato)
    inRowSpacingCm: 32.5, // 250-400mm on the ridge — same table, same row
    yieldKgPerM2: 2.0, // ~2.0 (15-25 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Grown from rooted slips, not seed — plant into ridged soil for easy digging later.',
    storageMonths: 3,
  },
  {
    key: 'potato',
    name: 'Potato',
    icon: '🥔',
    sowMonths: {
      summer: [2, 3, 8, 9],
      winter: [7, 8, 9],
      'all-year': [2, 3, 7, 8, 9],
      'mild-frost': [1, 4, 5, 8, 9, 10], // KZN Department of Agriculture 'Potato Production for KwaZulu-Natal' bulletin (Naidoo, van Rij & Arathoon) — strongest regionally-specific source in this pass
    },
    daysToHarvest: 100,
    spacingCm: 30,
    // The ARC figure this once waited on is superseded: KZN DARD's own spacing
    // table gives both numbers directly. Until now only the 30cm plant spacing
    // existed, so it was squared to 30x30 = 11.1 plants/m² — roughly 3.7x the
    // real density, and potato is bought as certified seed tubers, so the
    // Ubhejane plan asked for 1,141 where ~309 is right. The most expensive
    // single error in the buying list.
    rowSpacingCm: 95, // 900-1000mm — KZN DARD 'Plant Establishment', spacing table (Potato)
    inRowSpacingCm: 35, // 300-400mm — same table, same row
    sowDepthCm: 8.5, // 70-100mm — same table
    yieldKgPerM2: 1.4, // ~1.4 (10-17 t/ha dryland) — KZN DARD Expected Yields Table 8
    note: 'Plant certified seed potatoes and earth up the stems as they grow to prevent greening.',
    storageMonths: 3,
  },
  {
    key: 'lettuce',
    name: 'Lettuce',
    icon: '🥗',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11, 12],
      // Lettuce bolts in heat, not cold — winter is actually its easy season.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    daysToHarvest: 45,
    spacingCm: 25,
    rowSpacingCm: 45, // 400-500mm — KZN DARD 'Plant Establishment', spacing table (Lettuce)
    inRowSpacingCm: 30, // 250-350mm — same table, same row
    sowDepthCm: 1.75, // 15-20mm — same table
    yieldKgPerM2: 2, // = 20 t/ha, the "likely" commercial yield's lower end — KZN DARD Expected Yields Table 8 (Lettuce 12-15/20-25/30-40 conservative/likely/target)
    note: 'Bolts quickly in heat — sow little and often rather than one big batch.',
    varieties: [
      { name: 'Heat-tolerant / bolt-resistant type', bestFor: 'Summer sowings', note: "Look for a variety specifically marketed as bolt-resistant for summer — 'triple red' and similar red-leaf types are noticeably more heat-susceptible, so save those for cooler-season sowings instead." },
    ],
    harvestWindowMonths: 1,
  },
  {
    key: 'amadumbe',
    name: 'Amadumbe (taro)',
    icon: '🌰',
    sowMonths: {
      summer: [9, 10, 11],
      winter: [9, 10],
      'all-year': [8, 9, 10, 11],
      'mild-frost': [9, 10, 11],
    },
    daysToHarvest: 270, // 8-10 months = 240-300 days — Health For Mzansi / Food For Mzansi amadumbe growing guide
    spacingCm: 45,
    // row/inRow not populated — primary NDA/DAFF brochure (Brochure Amadumbe
    // 2010.pdf) could not be fetched (TLS errors), secondary-source only.
    yieldKgPerM2: 0.45, // ~0.45 (4-5 t/ha, best SA dryland trial result) — peer-reviewed SA taro accession trial (Umbumbulu, KZN, 2015)
    note: 'Needs consistently moist soil; thrives in warm, wet subtropical conditions.',
    storageMonths: 2,
  },
  {
    key: 'groundnuts',
    name: 'Groundnuts (peanuts)',
    icon: '🥜',
    sowMonths: {
      summer: [10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [9, 10, 11],
      'mild-frost': [10, 11, 12],
    },
    daysToHarvest: 130,
    spacingCm: 20,
    rowSpacingCm: 90, // rainfed (30-45cm under irrigation) — ARC Grain Crops Institute Groundnut Production guide (Cilliers)
    inRowSpacingCm: 6, // 5-7.5cm — same guide; current spacingCm was ~3x too wide, confirmed by the guide's own population math and planter spec
    sowDepthCm: 6, // 5-7.5cm, same guide
    yieldKgPerM2: 0.12, // ~0.12 (1.0-1.5 t/ha) — Grain SA / ARC Grain Crops Institute (old value looked like a unit/decimal error, ~10x national average)
    note: 'Needs sandy, well-drained soil and a long frost-free growing season.',
    storageMonths: 6,
  },
  {
    key: 'garlic',
    name: 'Garlic',
    icon: '🧄',
    sowMonths: {
      summer: [4, 5],
      winter: [3, 4, 5],
      'all-year': [4, 5, 6],
      'mild-frost': [4, 5, 6],
    },
    daysToHarvest: 180,
    spacingCm: 10,
    rowSpacingCm: 25, // 20-30cm — NDA/DAFF Garlic brochure
    // inRow not populated — handoff separately flags the garlic inRow rate
    // context as medium-confidence/re-verify (search-engine extract of an
    // nda.gov.za brochure, direct PDF fetch blocked), so left as the
    // spacingCm fallback for now rather than auto-changed.
    yieldKgPerM2: 0.8, // ~0.8 (6-10 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Plant individual cloves pointy-side up; a cool spell early on helps bulbs form properly.',
    storageMonths: 6,
  },
  {
    key: 'peas',
    name: 'Peas',
    icon: '🟢',
    sowMonths: {
      summer: [2, 3, 8],
      winter: [2, 3, 4],
      'all-year': [1, 2, 3, 4, 8, 9],
      // Peas are famously frost-hardy — a cold snap sweetens the pods, same
      // idea as kale — so this is one of the best true winter crops here.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    daysToHarvest: 65,
    spacingCm: 8,
    // Sources disagree on in-row: KZN DARD's spacing table says 50-80mm, the
    // SeedCo (Botswana) guide says 15-20cm. DARD wins here — it is the KZN
    // authority the catalog's yields already anchor to, its 50-80mm agrees
    // with the original 8cm figure, and taking both numbers from ONE table row
    // beats mixing sources. (The SeedCo 17cm reading also had no row figure,
    // so rowCm fell back to it: 17x17 = 34.6 plants/m², ~1.4x over.)
    rowSpacingCm: 60, // 600mm — KZN DARD 'Plant Establishment', spacing table (Pea)
    inRowSpacingCm: 6.5, // 50-80mm — same table, same row
    sowDepthCm: 3.25, // 2.5-4cm — SeedCo guide, inside DARD's 30-60mm
    yieldKgPerM2: 0.5, // ~0.5 (4-6 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Give climbing types a trellis; pick pods while still glossy for the sweetest peas.',
    harvestWindowMonths: 1,
  },
  {
    key: 'broad-beans',
    name: 'Broad beans (fava beans)',
    icon: '🫘',
    sowMonths: {
      // Unlike dry-beans/green-beans, broad beans are bred to overwinter —
      // real frost doesn't kill them, so unlike every other 'summer'-pattern
      // crop they get genuine May-Jul coverage even under hard-frost
      // interior conditions, not just the mild-frost hinterland pattern.
      summer: [3, 4, 5, 6, 7],
      winter: [3, 4, 5],
      'all-year': [2, 3, 4, 5, 6, 7, 8],
      'mild-frost': [2, 3, 4, 5], // dropped Jun-Aug — Mayford 'What to sow during autumn' + gardenate.com (both say autumn/Feb-May only)
    },
    daysToHarvest: 126, // ~18 weeks — gardeninginsouthafrica.co.za Broad Beans (Vicia faba) guide
    spacingCm: 20,
    // WAS THE WORST OVER-ORDER IN THE CATALOG. With no row figure, plantSpacingCm
    // squared the 20cm plant spacing to 20x20 = 25 plants/m², four times the real
    // density — the Ubhejane plan's buying list asked for 9,444 seeds where ~2,360
    // is right. KZN DARD prints the two spacings separately: Plant 200mm, Rows 800mm.
    rowSpacingCm: 80, // 800mm — KZN DARD 'Plant Establishment', spacing table (Bean, broad)
    inRowSpacingCm: 20, // 200mm — same table, same row
    sowDepthCm: 4.5, // 40-50mm — same table
    yieldKgPerM2: 0.4, // ~0.4 (3-5 t/ha) — KZN DARD Expected Yields Table 8
    note: "The classic 'grows through winter' legume — sow in autumn, it stands through frost and pods in spring.",
    harvestWindowMonths: 1,
  },
  {
    key: 'broccoli',
    name: 'Broccoli',
    icon: '🥦',
    sowMonths: {
      summer: [1, 2, 3, 8],
      winter: [1, 2, 3, 8],
      'all-year': [1, 2, 3, 4, 8, 9],
      // Another crop that heads up better after a cool spell.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9],
    },
    daysToHarvest: 80,
    transplant: true,
    spacingCm: 45,
    rowSpacingCm: 65, // 600-700mm — KZN DARD 'Plant Establishment', spacing table (Broccoli)
    inRowSpacingCm: 37.5, // 300-450mm — same table, same row
    yieldKgPerM2: 0.65, // ~0.65 (5-8 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Harvest the central head before the flowers open, then side shoots keep coming.',
    harvestWindowMonths: 1,
  },
  {
    key: 'cucumber',
    name: 'Cucumber',
    icon: '🥒',
    sowMonths: {
      summer: [9, 10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [8, 9, 10, 11],
      'mild-frost': [9, 10, 11, 12],
    },
    daysToHarvest: 65, // 60-70 — Starke Ayres Cucumber Ashley product page
    spacingCm: 40,
    // Field spacing (ground vines). The old 40x40 square fallback gave
    // 6.25 plants/m² — 3.5x this figure, over-ordering seed accordingly.
    // A trellised garden bed can go denser; the catalog carries one figure.
    rowSpacingCm: 130, // 1200-1400mm — KZN DARD 'Plant Establishment', spacing table (Cucumber)
    inRowSpacingCm: 42.5, // 350-500mm — same table, same row
    sowDepthCm: 2.5, // 20-30mm — same table
    yieldKgPerM2: 2.0, // ~2.0 (15-25 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Keep watering even — irregular water is the main cause of bitter fruit.',
    harvestWindowMonths: 2,
  },
  {
    key: 'watermelon',
    name: 'Watermelon',
    icon: '🍉',
    sowMonths: {
      summer: [10, 11, 12],
      winter: [9, 10, 11],
      'all-year': [8, 9, 10],
      'mild-frost': [8, 9, 10], // shifted earlier — Seeds for Africa KZN Vegetable Planting Chart (Aug-Oct only)
    },
    daysToHarvest: 90,
    spacingCm: 150,
    rowSpacingCm: 185, // 1700-2000mm — KZN DARD 'Plant Establishment', spacing table (Watermelon)
    inRowSpacingCm: 55, // 500-600mm — same table, same row
    sowDepthCm: 5, // 40-60mm — same table
    yieldKgPerM2: 2.0, // ~2.0 (15-25 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Needs a long hot season and plenty of room to vine out.',
    storageMonths: 1,
  },
  {
    key: 'coriander',
    name: 'Coriander',
    icon: '🌱',
    sowMonths: {
      summer: [2, 3, 8, 9],
      winter: [2, 3, 4, 8, 9],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11],
      // Bolts in heat, not cold — same logic as lettuce.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
    daysToHarvest: 45,
    spacingCm: 10,
    rowSpacingCm: 35, // Starke Ayres Garden Centre coriander grow guide
    inRowSpacingCm: 20, // thin to 20cm, same guide
    sowDepthCm: 1, // ~1cm, same guide
    // NOT source-backed — coriander/dhania isn't a line item in the KZN DARD
    // Expected Yields table, and the only SA-adjacent figures found (Kenyan
    // commercial dhania seed yields, ~0.4-0.5 t/ha) are for a different
    // product (dried SEED, not fresh leaf) and region, so not usable here.
    // Left as the pre-existing estimate; still needs an agronomist figure.
    yieldKgPerM2: 1.5,
    note: 'Bolts fast in heat and long days — sow in cooler months for leafy growth.',
  },
  {
    // THE ONLY NON-FOOD CROP IN THIS CATALOG, and it is here for one reason:
    // without it, a staple plot whose course is a legume can never be planted
    // again that season. Broad beans is the plot winter cover and broad beans
    // is a legume, so BedRotation.repeats (a HARD filter) disqualified the
    // entire cover list on any plot that grew dry beans or groundnuts. Measured
    // on Ubhejane's own plan: Plot 1, 98.8 m², bare 7 of 12 months — 56% of
    // every idle square metre on that farm. See lib/staple-crops.ts.
    //
    // It stays SECOND choice behind broad beans, deliberately: the cover-crop
    // docblock in staple-crops.ts argues a smallholder "cannot afford to grow
    // something purely to dig it back in", and that principle is right. This is
    // only reached when the rotation has disqualified the legume — the real
    // comparison is not oats vs. broad beans, it is oats vs. seven months of
    // bare ground.
    //
    // EVERY FIGURE BELOW IS MANAGEMENT GUIDANCE, NOT A SOURCED YIELD TABLE, and
    // wants an agronomist's confirmation for the local district — same standing
    // caveat as coriander above. yieldKgPerM2 is 0 because that is the truth:
    // this is cut or rolled down as green manure, not carried to the kitchen,
    // and a smallholder catalog must not book soil-building as food.
    key: 'oats',
    name: 'Oats (winter cover crop)',
    icon: '🌾',
    sowMonths: {
      // The autumn cover window: into the ground as the summer staple comes
      // off, grown through the cold, terminated before the spring course.
      summer: [2, 3, 4, 5],
      winter: [3, 4, 5],
      'all-year': [2, 3, 4, 5],
      'mild-frost': [2, 3, 4, 5],
    },
    daysToHarvest: 100, // to flowering, when a cover is cut or rolled — NOT to grain
    // Not a hand-spaced crop: a cereal cover is broadcast or drilled to a dense
    // stand. 6cm square encodes ~275 plants/m², which is roughly what the usual
    // smallholder seeding rate produces — recorded this way because
    // plantsPerM2() derives seed quantity from spacing alone, so leaving a
    // vegetable-style 15cm here would under-order the seed several-fold.
    spacingCm: 6,
    yieldKgPerM2: 0,
    note: 'A cover crop, not a food crop — it holds the soil over winter and is cut or rolled down before the next staple goes in. Nothing to harvest for the kitchen.',
  },
];

export function cropByKey(k: string): CropDef | undefined {
  return CROPS.find((c) => c.key === k);
}

/**
 * The two spacings a farmer actually plants to, resolved from whatever the
 * catalog knows. THE SINGLE SOURCE OF TRUTH — every seed quantity and every
 * printed sowing instruction must come through here, or the plan tells the
 * farmer one thing and charges him for another.
 *
 * It did exactly that until 2026-08-04. seedBoqForPlan used
 * `(rowSpacingCm && inRowSpacingCm) ? row*inRow : spacingCm**2`, so a crop
 * that had only ONE of the sourced figures had it silently thrown away and
 * the legacy single figure squared instead. The printed line then
 * contradicted itself: "Dry beans ~11362 seeds · 15cm apart in the row" —
 * 11362 is the 10cm-square number, and nobody following the printed
 * instruction would ever need it. Peas were worse: the catalog's own comment
 * records that the 8cm spacingCm "conflated inter-row-on-bed spacing with
 * along-row spacing", and that discredited 8 was exactly what got squared.
 *
 * The fallbacks, and why:
 *  - in-row ← spacingCm. spacingCm is a plant-to-plant figure, which is what
 *    in-row means. Garlic's own comment says its in-row was left "as the
 *    spacingCm fallback for now", so this is the documented intent.
 *  - row    ← the in-row figure BEFORE spacingCm. A sourced split value is
 *    higher-confidence than the legacy single one (the 2026-07-15 agronomy
 *    pass exists because the legacy figures were wrong), and square planting
 *    is how an intensive raised bed is actually laid out.
 *
 * 2026-08-05: the fallbacks are now the EXCEPTION, not the rule. The KZN DARD
 * 'Plant Establishment' spacing table supplied sourced row+in-row pairs for
 * the crops that were still square-fallback (dry beans included — its old
 * paragraph here defending 15x15 is superseded by DARD's printed bush-bean
 * row). Remaining fallback crops are the ones DARD's table doesn't carry:
 * kale, amadumbe, garlic (in-row only), butternut/swiss-chard/beetroot/
 * peppers/green-beans (Starke Ayres splits kept), tomatoes (deliberate
 * hand-bed estimate, see its comment), oats (broadcast).
 */
export function plantSpacingCm(crop: CropDef): { rowCm: number; inRowCm: number } {
  const inRowCm = crop.inRowSpacingCm ?? crop.spacingCm;
  const rowCm = crop.rowSpacingCm ?? crop.inRowSpacingCm ?? crop.spacingCm;
  return { rowCm, inRowCm };
}

/** Plants per square metre, derived from plantSpacingCm and nothing else. */
export function plantsPerM2(crop: CropDef): number {
  const { rowCm, inRowCm } = plantSpacingCm(crop);
  const perPlantM2 = (rowCm / 100) * (inRowCm / 100);
  return perPlantM2 > 0 ? 1 / perPlantM2 : 0;
}

export const MONTHS_SHORT: string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
