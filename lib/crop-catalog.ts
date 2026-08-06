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
//             These are crop-specific KZN DARD "warm areas / light frosts" windows where
//             that table covers the crop, not a blanket copy of either another pattern.
// Months are 1-12 (Jan-Dec). These are coarse planning windows; the per-crop comments name
// the source or caveat, and the farmer still needs to confirm local frost, water and cultivar.

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
  /** Published spacing/depth ranges. Point values above remain a representative
   * planning density for internal area arithmetic, but farmer-facing instructions
   * must show these ranges instead of laundering a midpoint into an exact rule. */
  rowSpacingRangeCm?: readonly [number, number];
  inRowSpacingRangeCm?: readonly [number, number];
  sowDepthRangeCm?: readonly [number, number];
  /**
   * Farmer-facing field instruction when the generic row/in-row formatter
   * would turn an internal planning estimate into false precision. The
   * override must state the verified part and the local confirmation still
   * needed; it is not permission to invent a replacement number.
   */
  fieldSpacingInstruction?: string;
  /** False when the catalog lacks both verified axes needed to turn mapped
   * area into a defensible planting-material count. */
  fieldSpacingVerified?: boolean;
  /** False when no primary authority supports the catalog's exact duration.
   * Such a crop may remain recorded for legacy plans, but must not be offered
   * by automatic or manual schedule generation. */
  timingVerified?: boolean;
  /** Published or cultivar-context duration range. `daysToHarvest` is the
   * upper published planning value used for bed occupancy; the range is what
   * farmers should see. KZN DARD's table is explicitly approximate and under
   * optimum conditions, so even the upper endpoint is not a deadline or
   * guarantee in slower weather, soil or management conditions. */
  daysToHarvestRange?: readonly [number, number];
  /**
   * Conservative planning yield for one crop cycle. `null` means no
   * defensible food-yield figure was found: the crop stays available for a
   * farmer to add manually, but must not drive auto-suggest ranking or an
   * estimated-harvest total.
   */
  yieldKgPerM2: number | null;
  /** Published conservative-to-likely commercial range, when the source gives
   * both. This is context for the planning figure, not a promise that a home
   * garden will reach either end. */
  yieldRangeKgPerM2?: readonly [number, number];
  note: string;
  varieties?: CropVariety[];
  /** Extra whole calendar months of fresh picking after the first harvest
   * month. Bed occupancy uses the UPPER end of a published usual picking
   * period so a successor is not double-booked while the crop may still be
   * productive. A farmer can release the bed earlier after observing the crop. */
  harvestWindowMonths?: number;
  /** Published usual picking-period range in whole calendar months. This is
   * duration context only; it does not imply an even monthly kg profile. */
  harvestPeriodRangeMonths?: readonly [number, number];
  /** Published usual picking-period range in weeks when the source is more
   * precise than this planner's month-sized occupancy grid. */
  harvestPeriodRangeWeeks?: readonly [number, number];
  /** Source-faithful wording for a harvest pattern that is not one simple
   * range (for example a main head followed by side sprouts). */
  harvestPeriodNote?: string;
  /** Whole months a harvested crop remains usable under named storage
   * conditions. Leave undefined unless a relevant source and conditions are
   * recorded; shelf life cannot be inferred from the crop name alone. */
  storageMonths?: number;
  storageSourceUrl?: string;
  storageConditions?: string;
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
    // The catalog has no primary source tying this grain-maize duration and
    // field geometry to the household-staple crop represented here. Keep the
    // legacy values readable, but do not turn them into a new schedule/order.
    timingVerified: false,
    spacingCm: 30,
    // This entry means dried grain maize for mielie meal, not sweetcorn; the
    // available sweetcorn guide cannot verify its inherited field numbers.
    rowSpacingCm: 90,
    inRowSpacingCm: 20,
    sowDepthCm: 4, // 3-5cm — Starke Ayres Sweetcorn Guideline sec 3.3 / planting-depth article (depth is not cultivar-specific)
    fieldSpacingVerified: false,
    fieldSpacingInstruction: 'confirm a locally appropriate grain-maize row, plant and depth specification before ordering or planting; this catalog only has legacy estimates',
    yieldKgPerM2: 0.3, // NDF South Africa Maize Factsheet + Scielo Eastern Cape smallholder study (2-4 t/ha smallholder dryland, grain maize)
    note: 'Direct-sow once frost risk has passed; block-plant several rows together for good pollination.',
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
    daysToHarvest: 121, // upper end of 109–121 days — N2Africa 'Better sugar beans' Southern Africa production booklet
    daysToHarvestRange: [109, 121],
    spacingCm: 10,
    // KZN bush-bean rows/depth and SADC sugar-bean in-row spacing agree on a
    // plausible stand, but mixing authorities is not enough for an exact order.
    rowSpacingCm: 52.5,
    inRowSpacingCm: 15,
    sowDepthCm: 3,
    rowSpacingRangeCm: [45, 60],
    inRowSpacingRangeCm: [10, 20],
    sowDepthRangeCm: [2, 4],
    fieldSpacingVerified: false,
    fieldSpacingInstruction: 'rows 45–60cm apart · plants 10–20cm apart in the row · sow 2–4cm deep; confirm the complete sugar-bean geometry locally before ordering',
    yieldKgPerM2: 0.2, // ~0.2 (1.8-2.2 t/ha) — Grain SA 'Know the value of DRY BEANS'
    note: 'Leave pods to dry and rattle on the plant before shelling and storing.',
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
    daysToHarvestRange: [48, 60],
    spacingCm: 10,
    // Keep timing, harvest span and geometry on the same KZN bush-bean type;
    // climbing beans need a different stand and are not represented here.
    rowSpacingCm: 52.5,
    inRowSpacingCm: 5.5,
    sowDepthCm: 3.5,
    rowSpacingRangeCm: [45, 60],
    inRowSpacingRangeCm: [4, 7],
    sowDepthRangeCm: [2, 5],
    yieldKgPerM2: 0.5,
    yieldRangeKgPerM2: [0.5, 0.8], // conservative through likely (5; 7-8 t/ha) — KZN DARD Expected Yields Table 8
    note: 'These figures are for bush green beans. Sow small batches 2–3 weeks apart to spread the picking windows; weather and crop growth still decide whether harvests join up without a gap.',
    harvestPeriodRangeWeeks: [2, 3],
    // KZN DARD gives bush green beans a 2-3 week picking period: no extra
    // whole calendar month beyond the first harvest month.
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
    daysToHarvestRange: [85, 110],
    spacingCm: 100,
    rowSpacingCm: 150, // Starke Ayres Butternut Production Guideline 2019 sec 3.4
    inRowSpacingCm: 40, // same guideline
    yieldKgPerM2: 1.2,
    yieldRangeKgPerM2: [1.2, 1.8], // conservative through likely (12; 15-18 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Vigorous trailing squash — give it room to sprawl or train it up a trellis.',
    // KZN DARD's trailing-squash row is the defensible regional proxy for
    // butternut duration and picking span; it is stated here, not hidden.
    harvestWindowMonths: 1,
    harvestPeriodRangeMonths: [1, 2],
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
    daysToHarvest: 130, // conservative upper end of 110–130 days — KZN DARD Length of Growing Period
    daysToHarvestRange: [110, 130],
    spacingCm: 120,
    // Cross-check: 65x250cm = 0.62 plants/m² = 6,150/ha — agrees with the
    // density source's own semi-bush 6,500-7,000/ha figure below.
    rowSpacingCm: 250, // 2500mm — KZN DARD 'Plant Establishment', spacing table (Pumpkin)
    inRowSpacingCm: 65, // 600-700mm — same table, same row
    sowDepthCm: 2.5, // 20-30mm — same table
    rowSpacingRangeCm: [250, 250],
    inRowSpacingRangeCm: [60, 70],
    sowDepthRangeCm: [2, 3],
    // Prior density-only source (semi-bush 6,500-7,000/ha, vining 5,000/ha,
    // dryland 3,500/ha) kept as the sanity bound on the cm split above.
    yieldKgPerM2: 1.2,
    yieldRangeKgPerM2: [1.2, 2], // conservative through likely (12-15; 18-20 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Needs bees for pollination; hand-pollinate with a small brush if fruit set is poor.',
    harvestWindowMonths: 1, // reserve 2 months total — upper end of KZN DARD's usual 1–2 month picking period
    harvestPeriodRangeMonths: [1, 2],
  },
  {
    key: 'swiss-chard',
    name: 'Swiss chard (spinach)',
    icon: '🍃',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 5, 8, 9, 10, 11, 12],
      // KZN DARD Plant Establishment Table 6 gives Jan-Apr and Jul-Sep for
      // Swiss chard in a warm/light-frost area; June is not in that window.
      'mild-frost': [1, 2, 3, 4, 7, 8, 9], // KZN DARD Plant Establishment Table 6, warm/light-frost area
    },
    daysToHarvest: 60,
    daysToHarvestRange: [50, 60],
    spacingCm: 30,
    rowSpacingCm: 50,
    inRowSpacingCm: 30,
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [40, 60],
    inRowSpacingRangeCm: [20, 40],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 2,
    yieldRangeKgPerM2: [2, 3], // conservative through likely (20; 30 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Cut-and-come-again — harvest outer leaves and it keeps producing for months.',
    harvestWindowMonths: 3, // reserve 4 months total — upper end of KZN DARD's usual 2–4 month picking period
    harvestPeriodRangeMonths: [2, 4],
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
    timingVerified: false,
    transplant: true,
    spacingCm: 45,
    fieldSpacingVerified: false,
    fieldSpacingInstruction: 'confirm a locally appropriate kale transplant spacing before ordering; no verified field geometry is held in this catalog',
    // NOT source-backed — kale doesn't appear as its own line in the KZN DARD
    // Expected Yields table (checked 2026-07-15; the table only has "Spinach,
    // true" and "Swiss chard" among leafy greens) and no other SA
    // production-guide figure was found. A made-up point estimate must not
    // become a harvest promise or an optimiser input; keep the crop manual-only
    // until an agronomist/grower-survey figure can verify it.
    yieldKgPerM2: null,
    note: 'Legacy crop record only: confirm the exact kale type, local sowing window, nursery period and field spacing before planning it again.',
    // KZN DARD's duration table has no separate kale row; no extra whole-month
    // picking span is claimed until a relevant source is verified.
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
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // KZN DARD Table 6: cabbage is plantable all year with suitable cultivars
    },
    // KZN DARD gives 65–120 days from transplant; the recommended Accord
    // cultivar reaches 100–125, so occupancy must cover the combined upper end.
    daysToHarvest: 125,
    daysToHarvestRange: [65, 125],
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
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [50, 60],
    inRowSpacingRangeCm: [35, 45],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 3,
    yieldRangeKgPerM2: [3, 5], // conservative through likely (30; 50 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Firm the soil well at transplanting to help heads form tightly.',
    harvestPeriodRangeWeeks: [1, 4],
    varieties: [
      { name: 'Accord F1 (or similar cold-tolerant hybrid)', bestFor: 'Apr-Aug (winter) sowings', note: 'Bred for the winter slot — avoid growing a summer-type variety over winter, heads form poorly and bolt risk rises.' },
      { name: 'Optima F1 (or similar summer-bred hybrid)', bestFor: 'Sep-Mar (summer) sowings', note: "Selected for summer production; the reverse mistake — a winter-bred variety sown in summer — tends to bolt before heading." },
      { name: 'Conquistador (or similar dual-season type)', bestFor: 'Either season', note: 'Marketed as tolerating both extremes — the safer pick if you only want to keep one cabbage seed packet.' },
    ],
  },
  {
    key: 'carrots',
    name: 'Carrots',
    icon: '🥕',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11],
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], // KZN DARD Table 6: Jan-Nov in warm/light-frost areas
    },
    daysToHarvest: 120, // upper end across 90–105 summer / 110–120 winter — Starke Ayres Allyance/Kuroda/Chantenay Karoo variety pages
    daysToHarvestRange: [80, 120],
    spacingCm: 8,
    // 3.5x30cm = 95 plants/m² = 950,000/ha — inside the previously-found
    // aggregate population range (600,000-3,500,000/ha). The old 8x8 square
    // fallback gave 156/m², over-ordering seed ~1.6x.
    rowSpacingCm: 30, // 200-400mm — KZN DARD 'Plant Establishment', spacing table (Carrot)
    inRowSpacingCm: 3.5, // 20-50mm — same table, same row
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [20, 40],
    inRowSpacingRangeCm: [2, 5],
    sowDepthRangeCm: [1, 2.5],
    yieldKgPerM2: 2,
    yieldRangeKgPerM2: [2, 3], // conservative through likely (20; 30 t/ha) — KZN DARD Expected Yields Table 8
    note: "Direct-sow only — carrots don't transplant well. Keep the bed loose and stone-free.",
    harvestPeriodRangeWeeks: [1, 4],
    varieties: [
      { name: 'Nantes type', bestFor: 'Either season', note: 'The reliable general-purpose choice — good bolt tolerance, forgiving of an off-season sowing.' },
      { name: 'Allyance F1 (or similar season-tuned hybrid)', bestFor: 'Timing awareness', note: 'Maturity runs faster in summer (~90-105 days) than winter (~110-120 days) — expect a longer wait for a winter sowing, not a failed one.' },
    ],
  },
  {
    key: 'beetroot',
    name: 'Beetroot',
    icon: '🫜',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11],
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // KZN DARD Table 6: all year in warm/light-frost areas
    },
    daysToHarvest: 70, // conservative upper end of 56–70 days — KZN DARD Length of Growing Period
    daysToHarvestRange: [56, 70],
    spacingCm: 10,
    // Use one complete KZN DARD row rather than combining geometries from
    // different guides and presenting the result as a single exact stand.
    rowSpacingCm: 25,
    inRowSpacingCm: 6,
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [20, 30],
    inRowSpacingRangeCm: [5, 7],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 1.4,
    yieldRangeKgPerM2: [1.4, 1.8], // conservative through likely (14; 18 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Thin seedlings early — each "seed" is actually a cluster of several.',
    // The published upper picking period is five weeks, so a month-sized plan
    // reserves a second calendar month rather than freeing the bed at day 30.
    harvestWindowMonths: 1,
    harvestPeriodRangeWeeks: [3, 5],
  },
  {
    key: 'onions',
    name: 'Onions',
    icon: '🧅',
    sowMonths: {
      summer: [3, 4, 5],
      winter: [2, 3, 4],
      'all-year': [2, 3, 4, 5],
      'mild-frost': [2, 3], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 180, // upper end of 140–180 days from transplant — KZN DARD Length of Growing Period
    daysToHarvestRange: [140, 180],
    transplant: true,
    spacingCm: 10,
    sowDepthCm: 1.75,
    // Midpoints give 7x25cm = 57 plants/m² = 570,000/ha; the previously-found
    // aggregate population (700,000-800,000/ha) sits at the dense end of the
    // DARD ranges (60x200mm = 830,000/ha), so both sources are consistent.
    rowSpacingCm: 25, // 200-300mm — KZN DARD 'Plant Establishment', spacing table (Onion)
    inRowSpacingCm: 7, // 60-80mm — same table, same row
    rowSpacingRangeCm: [20, 30],
    inRowSpacingRangeCm: [6, 8],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 1.5,
    yieldRangeKgPerM2: [1.5, 3], // conservative through likely (15-20; 25-30 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Long-season crop — sow into trays in autumn and transplant when the seedlings are ready; this is usually 4–6 weeks in warm conditions and can take twice as long in cold conditions.',
    harvestPeriodRangeWeeks: [1, 4],
    varieties: [
      { name: 'Short-day type', bestFor: 'Highveld / northern & central interior', note: "Onions bulb by day-length, not just temperature — this is the one crop where variety is nearly mandatory, not a refinement: the wrong day-length type for your area simply won't bulb properly no matter when you sow it." },
      { name: 'Intermediate-day type', bestFor: 'Central & southern regions, coastal areas', note: "Suits areas with a bigger swing in day length through the growing season. Check the day-length rating on the seed packet — it matters more here than the sowing month." },
    ],
  },
  {
    key: 'tomatoes',
    name: 'Tomatoes',
    icon: '🍅',
    sowMonths: {
      summer: [8, 9, 10],
      winter: [8, 9, 10],
      'all-year': [2, 3, 7, 8, 9],
      'mild-frost': [8, 9, 10, 11, 12], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 90, // upper end of 75–90 days from transplant — KZN DARD Length of Growing Period
    daysToHarvestRange: [75, 90],
    transplant: true,
    spacingCm: 50,
    // NOT source-backed: the only cited figure (Starke Ayres Tomato Guideline
    // 2019 sec 3.4) is a COMMERCIAL 180-250cm row spec — field-tractor spacing,
    // wrong for a hand-worked home bed. 90cm is a general home-garden estimate
    // for staked tomatoes (typical bed practice ~60-90cm rows), deliberately
    // used instead — an estimate to adjust, not a verified number.
    rowSpacingCm: 90,
    inRowSpacingCm: 40, // not closer than 35-40cm — same guideline (high confidence)
    // Only the in-row minimum is verified for a staked home bed. The 90cm row
    // value remains an internal geometry estimate until a relevant primary
    // source is found; never print it as an instruction or use it to sell an
    // exact number of seedlings.
    fieldSpacingVerified: false,
    fieldSpacingInstruction: 'at least 40cm apart in the row · choose row width for the support system and bed; a verified home-bed row spacing is not available',
    yieldKgPerM2: 3,
    yieldRangeKgPerM2: [3, 5], // conservative through likely (30; 45-50 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Stake or cage plants early; feed consistently once fruit starts to set.',
    varieties: [
      { name: 'Floradade (or similar heat-tolerant variety)', bestFor: 'Hot summer / subtropical coastal growing', note: 'Bred specifically for heat tolerance — worth seeking out if your area gets properly hot in summer, since an ordinary variety can drop flowers/stop setting fruit in extreme heat.' },
    ],
    harvestWindowMonths: 2, // reserve 3 months total — upper end of KZN DARD's usual 2–3 month picking period
    harvestPeriodRangeMonths: [2, 3],
  },
  {
    key: 'peppers',
    name: 'Peppers',
    icon: '🫑',
    sowMonths: {
      summer: [8, 9, 10],
      winter: [8, 9, 10],
      'all-year': [2, 3, 7, 8, 9],
      'mild-frost': [8, 9, 10, 11], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 80, // upper end of 65–80 days from transplant — KZN DARD Length of Growing Period; Starke Ayres also gives 75–80 days
    daysToHarvestRange: [65, 80],
    transplant: true,
    spacingCm: 40,
    // The KZN DARD line is specifically sweet pepper; hot-pepper cultivars can
    // require a different stand, so the catalog names the basis explicitly.
    rowSpacingCm: 70,
    inRowSpacingCm: 45,
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [60, 80],
    inRowSpacingRangeCm: [40, 50],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 2,
    yieldRangeKgPerM2: [2, 3], // conservative through likely (20; 30 t/ha) — KZN DARD Expected Yields Table 8
    note: 'The timing, yield and spacing basis is sweet pepper. Start seed in trays in a warm spot; other pepper types may need different spacing.',
    harvestWindowMonths: 2, // reserve 3 months total — upper end of KZN DARD's usual 2–3 month picking period
    harvestPeriodRangeMonths: [2, 3],
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
    daysToHarvest: 150, // upper end of 90–150 days — KZN DARD Length of Growing Period
    daysToHarvestRange: [90, 150],
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
    rowSpacingRangeCm: [90, 100],
    inRowSpacingRangeCm: [25, 40],
    yieldKgPerM2: 1.5,
    yieldRangeKgPerM2: [1.5, 3], // conservative through likely (15-20; 25-30 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Grown from rooted slips, not seed — plant into ridged soil for easy digging later.',
    harvestWindowMonths: 1,
    harvestPeriodRangeMonths: [1, 2],
  },
  {
    key: 'potato',
    name: 'Potato',
    icon: '🥔',
    sowMonths: {
      summer: [2, 3, 8, 9],
      winter: [7, 8, 9],
      'all-year': [2, 3, 7, 8, 9],
      // KZN's potato-specific bulletin limits cooler-area planting to Aug-Oct
      // plus January; its Apr-May slot is explicitly frost-free and irrigated.
      'mild-frost': [1, 8, 9, 10],
    },
    daysToHarvest: 120, // upper end of 90–120 days — KZN DARD Length of Growing Period
    daysToHarvestRange: [90, 120],
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
    rowSpacingRangeCm: [90, 100],
    inRowSpacingRangeCm: [30, 40],
    sowDepthRangeCm: [7, 10],
    yieldKgPerM2: 1,
    yieldRangeKgPerM2: [1, 1.7], // dryland/hot-area conservative through likely (10; 17 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Plant certified seed potatoes and earth up the stems as they grow to prevent greening.',
    harvestPeriodRangeWeeks: [2, 4],
  },
  {
    key: 'lettuce',
    name: 'Lettuce',
    icon: '🥗',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11, 12],
      // KZN DARD Plant Establishment Table 6 lists lettuce all year in a
      // warm/light-frost area; summer still needs a heat/bolt-tolerant variety.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    // KZN sources span butter and head types rather than one generic lettuce;
    // reserve the wider 45–80-day transplant range instead of implying sameness.
    daysToHarvest: 80,
    daysToHarvestRange: [45, 80],
    transplant: true,
    spacingCm: 25,
    rowSpacingCm: 45, // 400-500mm — KZN DARD 'Plant Establishment', spacing table (Lettuce)
    inRowSpacingCm: 30, // 250-350mm — same table, same row
    sowDepthCm: 1.75, // 15-20mm — same table
    rowSpacingRangeCm: [40, 50],
    inRowSpacingRangeCm: [25, 35],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 1.2,
    yieldRangeKgPerM2: [1.2, 2.5], // conservative through likely (12-15; 20-25 t/ha) — KZN DARD Expected Yields Table 8
    note: 'The duration covers butter/head-type uncertainty. Lettuce bolts quickly in heat — sow little and often rather than one big batch.',
    harvestPeriodRangeWeeks: [1, 2],
    varieties: [
      { name: 'Heat-tolerant / bolt-resistant type', bestFor: 'Summer sowings', note: "Look for a variety specifically marketed as bolt-resistant for summer — 'triple red' and similar red-leaf types are noticeably more heat-susceptible, so save those for cooler-season sowings instead." },
    ],
    // KZN DARD gives a 1-2 week harvest period: within this monthly model the
    // crop is harvested in its first harvest month, with no extra whole month.
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
    daysToHarvest: 300, // conservative upper end of 8–10 months — DAFF Brochure Amadumbe 2010
    daysToHarvestRange: [240, 300],
    spacingCm: 45,
    // DAFF Brochure Amadumbe 2010 gives 1.3m rows and 40–50cm between
    // plants, plus 15–20cm depth. Midpoints are used for the plan while the
    // farmer-facing comment retains the published range.
    rowSpacingCm: 130,
    inRowSpacingCm: 45,
    sowDepthCm: 17.5,
    rowSpacingRangeCm: [130, 130],
    inRowSpacingRangeCm: [40, 50],
    sowDepthRangeCm: [15, 20],
    // The earlier field-trial yield came from a different plant density than
    // this DAFF household geometry, so it cannot honestly score this plan.
    yieldKgPerM2: null,
    note: 'Propagate from whole tubers or corm cuttings. Needs consistently moist soil and warm, frost-free conditions.',
  },
  {
    key: 'groundnuts',
    name: 'Groundnuts (peanuts)',
    icon: '🥜',
    sowMonths: {
      summer: [10, 11],
      winter: [9, 10, 11],
      'all-year': [9, 10, 11],
      'mild-frost': [10, 11],
    },
    // The audited irrigated production guide gives a 150–160-day crop; its
    // closer rows must not be combined with the old rainfed 90cm geometry.
    daysToHarvest: 160,
    daysToHarvestRange: [150, 160],
    spacingCm: 20,
    rowSpacingCm: 37.5,
    inRowSpacingCm: 6.25,
    sowDepthCm: 6.25,
    rowSpacingRangeCm: [30, 45],
    inRowSpacingRangeCm: [5, 7.5],
    sowDepthRangeCm: [5, 7.5],
    yieldKgPerM2: 0.12, // ~0.12 (1.0-1.5 t/ha) — Grain SA / ARC Grain Crops Institute (old value looked like a unit/decimal error, ~10x national average)
    note: 'This stand is the audited irrigated geometry. Groundnuts need sandy, well-drained soil and a long frost-free growing season.',
  },
  {
    key: 'garlic',
    name: 'Garlic',
    icon: '🧄',
    sowMonths: {
      summer: [4, 5],
      winter: [3, 4, 5],
      'all-year': [4, 5, 6],
      'mild-frost': [4, 5], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 210,
    daysToHarvestRange: [180, 210],
    spacingCm: 10,
    // The current official guide supplies both axes, so clove counts no longer
    // depend on an inherited square-spacing fallback.
    rowSpacingCm: 37.5,
    inRowSpacingCm: 8.5,
    rowSpacingRangeCm: [30, 45],
    inRowSpacingRangeCm: [7, 10],
    fieldSpacingVerified: true,
    yieldKgPerM2: 0.6,
    yieldRangeKgPerM2: [0.6, 1], // conservative through likely (6; 10 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Plant individual cloves pointy-side up; a cool spell early on helps bulbs form properly.',
  },
  {
    key: 'peas',
    name: 'Peas',
    icon: '🟢',
    sowMonths: {
      summer: [2, 3, 8],
      winter: [2, 3, 4],
      'all-year': [1, 2, 3, 4, 8, 9],
      'mild-frost': [3, 4, 5, 6, 7, 8], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 80, // upper end of 60–80 days — KZN DARD Length of Growing Period
    daysToHarvestRange: [60, 80],
    spacingCm: 8,
    // Sources disagree on in-row: KZN DARD's spacing table says 50-80mm, the
    // SeedCo (Botswana) guide says 15-20cm. DARD wins here — it is the KZN
    // authority the catalog's yields already anchor to, its 50-80mm agrees
    // with the original 8cm figure, and taking both numbers from ONE table row
    // beats mixing sources. (The SeedCo 17cm reading also had no row figure,
    // so rowCm fell back to it: 17x17 = 34.6 plants/m², ~1.4x over.)
    rowSpacingCm: 60, // 600mm — KZN DARD 'Plant Establishment', spacing table (Pea)
    inRowSpacingCm: 6.5, // 50-80mm — same table, same row
    sowDepthCm: 4.5,
    rowSpacingRangeCm: [60, 60],
    inRowSpacingRangeCm: [5, 8],
    sowDepthRangeCm: [3, 6],
    yieldKgPerM2: 0.4,
    yieldRangeKgPerM2: [0.4, 0.6], // conservative through likely (4; 6 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Give climbing types a trellis; pick pods while still glossy for the sweetest peas.',
    harvestPeriodRangeWeeks: [2, 3],
    // KZN DARD gives a 2-3 week picking period: no extra whole month here.
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
      'mild-frost': [4, 5], // KZN DARD Table 6: Apr-May in warm/light-frost areas
    },
    daysToHarvest: 120, // conservative official duration — KZN DARD Length of Growing Period
    spacingCm: 20,
    // WAS THE WORST OVER-ORDER IN THE CATALOG. With no row figure, plantSpacingCm
    // squared the 20cm plant spacing to 20x20 = 25 plants/m², four times the real
    // density — the Ubhejane plan's buying list asked for 9,444 seeds where ~2,360
    // is right. KZN DARD prints the two spacings separately: Plant 200mm, Rows 800mm.
    rowSpacingCm: 80, // 800mm — KZN DARD 'Plant Establishment', spacing table (Bean, broad)
    inRowSpacingCm: 20, // 200mm — same table, same row
    sowDepthCm: 4.5, // 40-50mm — same table
    rowSpacingRangeCm: [80, 80],
    inRowSpacingRangeCm: [20, 20],
    sowDepthRangeCm: [4, 5],
    yieldKgPerM2: 0.3,
    yieldRangeKgPerM2: [0.3, 0.6], // conservative through likely (3-4; 5-6 t/ha) — KZN DARD Expected Yields Table 8
    note: "The classic 'grows through winter' legume — sow in autumn, it stands through frost and pods in spring.",
    harvestWindowMonths: 1,
    harvestPeriodRangeMonths: [2, 2],
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
    daysToHarvestRange: [50, 80],
    transplant: true,
    spacingCm: 45,
    rowSpacingCm: 65, // 600-700mm — KZN DARD 'Plant Establishment', spacing table (Broccoli)
    inRowSpacingCm: 37.5, // 300-450mm — same table, same row
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [60, 70],
    inRowSpacingRangeCm: [30, 45],
    sowDepthRangeCm: [1.5, 2],
    yieldKgPerM2: 0.5,
    yieldRangeKgPerM2: [0.5, 0.8], // conservative through likely (5; 8 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Harvest the central head before the flowers open, then side shoots keep coming.',
    harvestWindowMonths: 1,
    harvestPeriodNote: 'main heads 1–2 weeks; side sprouts 3–4 weeks longer',
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
    daysToHarvest: 70, // upper end of 60–70 days — Starke Ayres Cucumber Ashley product page
    daysToHarvestRange: [60, 70],
    spacingCm: 40,
    // Field spacing (ground vines). The old 40x40 square fallback gave
    // 6.25 plants/m² — 3.5x this figure, over-ordering seed accordingly.
    // A trellised garden bed can go denser; the catalog carries one figure.
    rowSpacingCm: 130, // 1200-1400mm — KZN DARD 'Plant Establishment', spacing table (Cucumber)
    inRowSpacingCm: 42.5, // 350-500mm — same table, same row
    sowDepthCm: 2.5, // 20-30mm — same table
    rowSpacingRangeCm: [120, 140],
    inRowSpacingRangeCm: [35, 50],
    sowDepthRangeCm: [2, 3],
    yieldKgPerM2: 1.2,
    yieldRangeKgPerM2: [1.2, 1.8], // conservative through likely (12; 15-18 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Keep watering even — irregular water is the main cause of bitter fruit.',
    harvestPeriodRangeMonths: [1, 1],
    // KZN DARD gives a one-month picking period: the first harvest month is
    // already counted, so there is no additional whole-month tail.
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
    daysToHarvest: 95, // upper end of 75–95 days — KZN DARD Length of Growing Period
    daysToHarvestRange: [75, 95],
    spacingCm: 150,
    rowSpacingCm: 185, // 1700-2000mm — KZN DARD 'Plant Establishment', spacing table (Watermelon)
    inRowSpacingCm: 55, // 500-600mm — same table, same row
    sowDepthCm: 5, // 40-60mm — same table
    rowSpacingRangeCm: [170, 200],
    inRowSpacingRangeCm: [50, 60],
    sowDepthRangeCm: [4, 6],
    yieldKgPerM2: 1.2,
    yieldRangeKgPerM2: [1.2, 2], // conservative through likely (12-15; 20 t/ha) — KZN DARD Expected Yields Table 8
    note: 'Needs a long hot season and plenty of room to vine out.',
    harvestWindowMonths: 1,
    harvestPeriodRangeMonths: [1, 2],
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
    daysToHarvest: 55,
    daysToHarvestRange: [40, 55],
    spacingCm: 10,
    // The Starke Ayres guide describes mild/subtropical leaf production; keep
    // that context visible and never infer household taste from availability.
    rowSpacingCm: 32.5,
    inRowSpacingCm: 9,
    sowDepthCm: 1.25,
    rowSpacingRangeCm: [30, 35],
    inRowSpacingRangeCm: [8, 10],
    sowDepthRangeCm: [1, 1.5],
    // NOT source-backed — coriander/dhania isn't a line item in the KZN DARD
    // Expected Yields table, and the only SA-adjacent figures found (Kenyan
    // commercial dhania seed yields, ~0.4-0.5 t/ha) are for a different
    // product (dried SEED, not fresh leaf) and region, so not usable here.
    // No fresh-leaf figure is claimed: coriander remains manually selectable,
    // but cannot be auto-ranked as though the old estimate were evidence.
    yieldKgPerM2: null,
    note: 'Mild/subtropical leaf-crop guidance only. Coriander stays manual because suitability depends on household preference; it bolts fast in heat and long days.',
  },
  {
    // Oats remains in the catalog so old farm records keep their crop name, but
    // no KZN/ARC primary source found in the 2026-08-06 audit supported the old
    // exact 6cm / 100-day smallholder cover schedule. It must not be generated
    // or offered as a new scheduled crop until that evidence exists.
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
    daysToHarvest: 100, // legacy occupancy estimate only; never farmer-facing
    timingVerified: false,
    // Legacy density placeholder retained only so old saved geometry can be
    // read. It is not a sourced sowing rate and is blocked from instructions,
    // purchase quantities, occupancy and new scheduling by the flags below.
    spacingCm: 6,
    fieldSpacingVerified: false,
    fieldSpacingInstruction: 'broadcast or drill using a locally verified cover-crop seeding rate; exact spacing is not verified',
    yieldKgPerM2: 0,
    note: 'A cover crop, not a food crop — it holds the soil over winter and is cut or rolled down before the next staple goes in. Nothing to harvest for the kitchen.',
  },
];

export function cropByKey(k: string): CropDef | undefined {
  return CROPS.find((c) => c.key === k);
}

/** True only when a crop has a defensible food-yield figure for planning. */
export function hasPlanningYield(crop: CropDef): crop is CropDef & { yieldKgPerM2: number } {
  return crop.yieldKgPerM2 !== null && Number.isFinite(crop.yieldKgPerM2) && crop.yieldKgPerM2 > 0;
}

/** One authority for whether this catalog can generate a new timed field plan. */
export function hasVerifiedFieldPlan(crop: CropDef): boolean {
  return crop.timingVerified !== false && crop.fieldSpacingVerified !== false;
}

/** True only when timing, field geometry and a planning yield are all sourced. */
export function hasAutomaticPlanningBasis(
  crop: CropDef,
): crop is CropDef & { yieldKgPerM2: number } {
  return hasVerifiedFieldPlan(crop) && hasPlanningYield(crop);
}

/**
 * The two spacings a farmer actually plants to, resolved from whatever the
 * catalog knows. THE SINGLE SOURCE OF TRUTH — every final-stand estimate and
 * printed sowing instruction must come through here, or the plan tells the
 * farmer two different spacings.
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
 * the crops that were still square-fallback. Every crop used for an automatic
 * count now has both axes; mixed-source or legacy cases (grain maize, dry
 * beans, kale, tomatoes and oats) suppress exact counts through the verification
 * gate instead of letting this fallback manufacture authority.
 */
export function plantSpacingCm(crop: CropDef): { rowCm: number; inRowCm: number } {
  const inRowCm = crop.inRowSpacingCm ?? crop.spacingCm;
  const rowCm = crop.rowSpacingCm ?? crop.inRowSpacingCm ?? crop.spacingCm;
  return { rowCm, inRowCm };
}

/** Published field-spacing bounds, falling back to a single sourced point only
 * where no range is recorded. Density is lowest at the widest pair and highest
 * at the narrowest pair. */
export function plantSpacingRangeCm(crop: CropDef): {
  rowCm: readonly [number, number];
  inRowCm: readonly [number, number];
} {
  const point = plantSpacingCm(crop);
  return {
    rowCm: crop.rowSpacingRangeCm ?? [point.rowCm, point.rowCm],
    inRowCm: crop.inRowSpacingRangeCm ?? [point.inRowCm, point.inRowCm],
  };
}

/** Plants per square metre, derived from plantSpacingCm and nothing else. */
export function plantsPerM2(crop: CropDef): number {
  const { rowCm, inRowCm } = plantSpacingCm(crop);
  const perPlantM2 = (rowCm / 100) * (inRowCm / 100);
  return perPlantM2 > 0 ? 1 / perPlantM2 : 0;
}

/** Final-position density range implied by the published spacing bounds. This
 * is still area arithmetic, not a row map for an irregular bed. */
export function plantsPerM2Range(crop: CropDef): readonly [number, number] {
  const { rowCm, inRowCm } = plantSpacingRangeCm(crop);
  const minimum = 1 / ((rowCm[1] / 100) * (inRowCm[1] / 100));
  const maximum = 1 / ((rowCm[0] / 100) * (inRowCm[0] / 100));
  return [minimum, maximum];
}

export const MONTHS_SHORT: string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
