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
  /** A sourced field-seeding rate can establish a non-food cover without
   * pretending that broadcast seed has a row/in-row plant count. This is
   * deliberately separate from plant spacing: the buying-list model does not
   * yet convert kg/ha, so farmer-facing copy must keep the rate visible. */
  seedRateKgPerHaRange?: readonly [number, number];
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
      winter: [],
      'all-year': [10, 11, 12],
      'mild-frost': [10, 11, 12],
    },
    // DALRRD's grain-maize guide requires a 120-140 day frost-free warm period.
    // Use its upper endpoint for bed occupancy; this is a conservative planning
    // hold, not a cultivar-specific promise that dry grain is ready on day 140.
    daysToHarvest: 140,
    daysToHarvestRange: [120, 140],
    spacingCm: 25,
    // The same official guide's irrigated/medium-potential table pairs a
    // 0.91m row with 25cm in-row spacing (about 45,000 plants/ha). Maize stays
    // plot-only in crop-autosuggest because mapped bed width does not prove a
    // wind-pollinating block.
    rowSpacingCm: 91,
    inRowSpacingCm: 25,
    sowDepthCm: 7.5,
    rowSpacingRangeCm: [91, 91],
    inRowSpacingRangeCm: [25, 25],
    sowDepthRangeCm: [5, 10],
    fieldSpacingVerified: true,
    yieldKgPerM2: 0.3, // NDF South Africa Maize Factsheet + Scielo Eastern Cape smallholder study (2-4 t/ha smallholder dryland, grain maize)
    note: 'Grain maize for mielie meal. Direct-sow in a mapped staple plot once frost risk has passed; use several adjacent rows for wind pollination. The 140-day calendar hold is conservative — confirm cultivar maturity before harvest.',
    // FAO: "short-term storage (4-5 months), season-long storage (6-9
    // months), long term storage (>9 months)" — 6 is the floor of the
    // season-long practice category, at the required ≤14% moisture. Without
    // drying and active weevil/larger-grain-borer control the source shows
    // heavy infestation within 2-3 months.
    storageMonths: 6,
    storageSourceUrl: 'https://www.fao.org/fileadmin/user_upload/inpho/docs/Post_Harvest_Compendium_-_MAIZE.pdf',
    storageConditions: 'Shelled grain dried to ≤14% moisture, kept in a clean sealed container or silo with active weevil/larger-grain-borer control.',
  },
  {
    key: 'dry-beans',
    name: 'Dry beans (sugar beans)',
    icon: '🫘',
    sowMonths: {
      summer: [11, 12, 1],
      winter: [],
      'all-year': [3, 4],
      'mild-frost': [11, 12, 1],
    },
    // DALRRD gives 85-94, 95-104 and 105-115 day maturity classes. Reserve
    // the upper endpoint so a normal long-season type is not double-booked.
    daysToHarvest: 115,
    daysToHarvestRange: [85, 115],
    spacingCm: 25,
    // DFFE's national agroforestry guideline gives this complete dry-bean
    // field pair; DALRRD supplies the matching 2.5-7cm depth range.
    rowSpacingCm: 45,
    inRowSpacingCm: 25,
    sowDepthCm: 4.75,
    rowSpacingRangeCm: [45, 45],
    inRowSpacingRangeCm: [25, 25],
    sowDepthRangeCm: [2.5, 7],
    fieldSpacingVerified: true,
    yieldKgPerM2: 0.2, // ~0.2 (1.8-2.2 t/ha) — Grain SA 'Know the value of DRY BEANS'
    note: 'Plant after frost danger: November to mid-January in frost areas, or March-April in frost-free areas. Leave pods to yellow and dry before shelling and storing.',
    // FAO/CIAT: coating with edible vegetable oils "permits storage for at
    // least 6 months without fear of insect [bruchid] damage"; a separate
    // FAO table corroborates with "bean (dry) | 4-10°C | 40-50% RH | 180-300
    // days" (180-day floor = 6 months). Untreated warm storage fails sooner.
    storageMonths: 6,
    storageSourceUrl: 'https://openknowledge.fao.org/server/api/core/bitstreams/f298d18a-182b-4ded-9863-6d0b60bf3024/content',
    storageConditions: 'Fully dried grain (12-15% moisture), clean sealed containers, cool and dry, with bruchid/weevil control (e.g. edible-oil admix at 5ml/kg, or storage in-pod).',
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
    // No butternut-specific SA storage figure exists (DAFF's Cucurbita
    // moschata brochure says only "can be stored for use during the winter",
    // no number). FAO Bulletin 151 Table 5's Pumpkins row (10-15°C/50-70%
    // RH, 60-160 days) is applied as a genus-level proxy — butternut is
    // Cucurbita moschata, sold and stored as a pumpkin type in SA. 2 months
    // is the conservative 60-day floor.
    storageMonths: 2,
    storageSourceUrl: 'https://www.fao.org/4/y4893e/y4893e06.htm',
    storageConditions: 'Mature hard-rind fruit, cured, clean, dry, undamaged, kept ventilated at 10-15°C/50-70% RH.',
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
    // FAO Bulletin 151 Table 5: "Pumpkins | 10-15°C | 50-70% RH | 60-160
    // days". 2 months is the conservative 60-day floor of that range — a
    // warmer, less-ventilated store shortens life well below the 160-day top.
    storageMonths: 2,
    storageSourceUrl: 'https://www.fao.org/4/y4893e/y4893e06.htm',
    storageConditions: 'Mature, cured (hardened-skin) fruit, undamaged, kept ventilated at 10-15°C/50-70% RH.',
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
    // FAO: "Field-dried onions can be stored up to two months under ambient
    // conditions in well-ventilated trays." Phrased as a ceiling ("up to"),
    // so the app does not extend past month 2.
    storageMonths: 2,
    storageSourceUrl: 'https://www.fao.org/4/t0073e/t0073e05.htm',
    storageConditions: 'Field-dried (cured, necks fully dry) bulbs held at ambient temperature in well-ventilated trays/racks.',
  },
  {
    key: 'tomatoes',
    name: 'Tomatoes',
    icon: '🍅',
    sowMonths: {
      summer: [8, 9, 10],
      winter: [8, 9, 10],
      // Was [2,3,7,8,9] — byte-identical to peppers, uncited, and narrower
      // than mild-frost even though this pattern is meant to be the broadest
      // (frost-free coastal, e.g. East London). KZN DARD Plant Establishment
      // Table 6, Tomato row, 'Hot areas Frost-free' column: 'Dec - Mar, Jul -
      // Sept' — the same table already cited below for mild-frost's 'Warm
      // areas Light frosts' column. Widened to the verbatim column instead of
      // guessing a wider window.
      'all-year': [1, 2, 3, 7, 8, 9, 12],
      'mild-frost': [8, 9, 10, 11, 12], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 90, // upper end of 75–90 days from transplant — KZN DARD Length of Growing Period
    daysToHarvestRange: [75, 90],
    transplant: true,
    spacingCm: 45,
    // Gauteng Department of Agriculture and Rural Development, Vegetable
    // Production Guidelines for a Household Food Garden, tomato row.
    rowSpacingCm: 105,
    inRowSpacingCm: 45,
    sowDepthCm: 1,
    rowSpacingRangeCm: [90, 120],
    inRowSpacingRangeCm: [30, 60],
    sowDepthRangeCm: [1, 1],
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
      // Was [2,3,7,8,9] — byte-identical to tomatoes, uncited, and narrower
      // than mild-frost even though this pattern is meant to be the broadest
      // (frost-free coastal, e.g. East London). KZN DARD Plant Establishment
      // Table 6, Capsicum (chilli, green pepper) row, 'Hot areas Frost-free'
      // column: 'Jan - Mar, Jul - Dec' — the same table already cited below
      // for mild-frost's 'Warm areas Light frosts' column. Widened to the
      // verbatim column instead of guessing a wider window.
      'all-year': [1, 2, 3, 7, 8, 9, 10, 11, 12],
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
    key: 'chilli',
    name: 'Chilli',
    icon: '🌶️',
    // Same rows as Peppers (crop-catalog.ts above): KZN DARD Table 6 groups
    // chilli and green pepper under one "Capsicum" line, so sow window,
    // spacing, duration and rotation family carry over unchanged. Only
    // yield is chilli-specific — see below.
    sowMonths: {
      summer: [8, 9, 10],
      winter: [8, 9, 10],
      'all-year': [1, 2, 3, 7, 8, 9, 10, 11, 12],
      'mild-frost': [8, 9, 10, 11], // KZN DARD Table 6, warm/light-frost area
    },
    daysToHarvest: 80, // upper end of 65–80 days from transplant — same Capsicum row as Peppers
    daysToHarvestRange: [65, 80],
    transplant: true,
    spacingCm: 40,
    rowSpacingCm: 70,
    inRowSpacingCm: 45,
    sowDepthCm: 1.75,
    rowSpacingRangeCm: [60, 80],
    inRowSpacingRangeCm: [40, 50],
    sowDepthRangeCm: [1.5, 2],
    // KZN DARD's Table 8 Expected Yields figure (20-30 t/ha, reused above for
    // Peppers) is a sweet-pepper number. Its own fact sheet for capsicum/chilli
    // gives a materially lower fresh yield for chilli specifically — about half
    // the sweet-pepper figure — so this is its own value, not Peppers' number
    // relabelled. Modelled as a single-cycle annual like every other catalog
    // crop; this codebase has no perennial "bush" mode to model real chilli
    // longevity, so no multi-season yield is claimed here.
    yieldKgPerM2: 1,
    yieldRangeKgPerM2: [1, 1.5],
    note: 'A smaller, hotter relative of sweet pepper — yield here is roughly half the Peppers figure, not the same number relabelled. Start seed in trays in a warm spot.',
    harvestWindowMonths: 2, // reserve 3 months total — same picking-period basis as Peppers
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
    // FAO: "Sweet potato can be stored safely for 3 to 4 months in the
    // tropics provided that the storage practices previously outlined for
    // potatoes ... are followed." 3 is the conservative floor of that range.
    storageMonths: 3,
    storageSourceUrl: 'https://www.fao.org/4/x5415e/x5415e04.htm',
    storageConditions: 'Only mature, undamaged roots; cured 30-32°C/85-90% RH for 4-7 days, then stored with minimal handling as cool as achievable (source optimum 13°C) at ~85-90% RH. The sweet potato weevil (Cylas spp.) is the main storage threat.',
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
    // FAO Table 4.2 (Wustman et al 1985): ware potatoes with no sprout
    // inhibitor keep 2-3 months at ~15°C average ambient, 3-4 months at
    // ~10°C, and the table has no usable entry above 20°C — 2 is the
    // conservative floor at the achievable-temperature end, not the optimistic
    // one. The FAO "up to six months in tropical highlands" line needs a
    // long-dormancy cultivar or a sprout inhibitor and is deliberately unused.
    storageMonths: 2,
    storageSourceUrl: 'https://www.fao.org/4/x5415e/x5415e04.htm',
    storageConditions: 'Cured 15-20°C/85-90% RH for 5-10 days, then kept dark and naturally ventilated averaging ~15°C or cooler, no sprout inhibitor.',
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
    // FAO: "At higher ambient temperatures (25° to 30°C), cocoyams will
    // store only for periods of 4 to 6 weeks without serious losses." 1
    // month is the rounded-down floor of that range; the "up to four months"
    // figure in the same source needs 7°C refrigeration, not smallholder-achievable.
    storageMonths: 1,
    storageSourceUrl: 'https://www.fao.org/4/x5415e/x5415e04.htm',
    storageConditions: 'Cool, dry, well-ventilated storage at ambient 25-30°C — traditionally heaped corms under shade or covered with straw/plantain leaves.',
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
    // FAO: "smallholder farmers ... store it in mud bins, basket, and earthen
    // pots or in gunny bags for 6 to 8 months" (in-shell); 6 is the floor,
    // corroborated by the same source's 6-month (Oct-Mar) naturally-ventilated
    // warehouse trial at safe moisture. Applies to IN-SHELL pods dried to
    // ~10% moisture or less (the document's shelled-kernel spec is a lower
    // 6-8%, a different product — not used here). Hot/humid-season storage
    // is limited to 1-2 months in the same source.
    storageMonths: 6,
    storageSourceUrl: 'https://www.fao.org/fileadmin/user_upload/inpho/docs/Post_Harvest_Compendium_-_Groundnut.pdf',
    storageConditions: 'Unshelled (in-shell) pods dried to in-shell moisture ~10% or less, stored in gunny bags, mud bins, baskets or a ventilated dry room, protected from pests and damp.',
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
    // FAO: common storage "can be held for 3 to 4 months"; independently,
    // "storage life is 3 to 5 months under cool (60°F) dry, dark conditions"
    // in mesh bags. 3 is the rounded-down floor shared by both lines. The
    // same document gives only 1-2 months at hot ambient (20-30°C, RH<75%),
    // so a hot lowveld/coastal store will fall short of this figure.
    storageMonths: 3,
    storageSourceUrl: 'https://www.fao.org/fileadmin/user_upload/inpho/docs/Post_Harvest_Compendium_-_Garlic.pdf',
    storageConditions: 'Well-cured bulbs (dried several weeks, dark/dry/ventilated), then kept unrefrigerated in a cool, dry, dark, well-ventilated place (e.g. mesh bags).',
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
    // KZN DARD names oats as a winter cover commonly used in maize lands. Its
    // forage-cereal bulletin gives mid-February to early May as the species/
    // cultivar-dependent establishment range; whole-month planning uses the
    // conservative March-May interior. A Cedara trial measured short-duration
    // Overberg at soft dough after 166 days. Establish by field seed rate,
    // never by the legacy 6cm square-grid fiction.
    key: 'oats',
    name: 'Oats (winter cover crop)',
    icon: '🌾',
    sowMonths: {
      // The autumn cover window: into the ground as the summer staple comes
      // off, grown through the cold, terminated before the spring course.
      summer: [3, 4, 5],
      winter: [],
      'all-year': [3, 4, 5],
      'mild-frost': [3, 4, 5],
    },
    daysToHarvest: 166,
    daysToHarvestRange: [166, 166],
    // Legacy density placeholder retained only so old saved geometry can be
    // read. It is not a sourced sowing rate and is blocked from instructions,
    // purchase quantities, occupancy and new scheduling by the flags below.
    spacingCm: 6,
    fieldSpacingVerified: false,
    // KZN DARD pasture establishment: 70kg/ha drilled; broadcast uses 1.5-2x.
    // The screen keeps this as a rate, not a fabricated number of oat plants.
    seedRateKgPerHaRange: [70, 140],
    fieldSpacingInstruction: 'drill at 70kg seed/ha, or broadcast at 105–140kg/ha; terminate before the next summer staple crop',
    yieldKgPerM2: 0,
    note: 'A KZN winter cover for maize land, not a food harvest in this plan. Sow March-May while late-summer soil moisture remains, then cut or roll it before the next summer staple crop. Nothing is added to kitchen harvest totals.',
  },
  {
    key: 'true-spinach',
    name: 'True spinach (English spinach)',
    // Was '🌱' (seedling), which Coriander also uses — two unrelated crops rendered
    // an identical chip on every icon-rendering surface (prices, exchange, crops
    // page, home, listing cards). '🍃' (leaf) and '🥬' (leafy green) were the two
    // obvious leafy-green picks but both are already taken (Swiss chard, Cabbage
    // respectively) — checked against every icon in this file, not assumed free.
    // '🍀' (four-leaf clover) is unused elsewhere in the catalog and not visually
    // confusable with any existing icon. See tests/catalog-matrix.test.ts's
    // "no two crops share an icon" gate.
    icon: '🍀',
    sowMonths: {
      // KZN DARD Table 6, 'Cold areas Moderate frosts' column: Aug-Mar.
      // Nov-Jan (peak heat) stay closed — this pattern also spans hot
      // interior (e.g. Limpopo), not just the KZN Midlands the column is
      // anchored to, and DAFF separately warns seed germinates poorly in
      // warm weather — mirrors the existing chard summer trim.
      summer: [2, 3, 8, 9, 10],
      // UNSOURCEABLE as a dedicated Western Cape calendar. Opened only the
      // intersection of DAFF's national window ('planted from August until
      // April') and KZN DARD Table 6's 'Warm areas Light frosts' column
      // (Feb-May, Jul-Sept) — WC lowlands being a light-frost, cool-winter
      // climate: {2,3,4} ∪ {8,9} (May and Jul are KZN-only, excluded).
      winter: [2, 3, 4, 8, 9],
      // KZN DARD Table 6, 'Hot areas Frost-free' column: Mar-Aug.
      'all-year': [3, 4, 5, 6, 7, 8],
      // KZN DARD Table 6, 'Warm areas Light frosts' column: Feb-May, Jul-Sept.
      'mild-frost': [2, 3, 4, 5, 7, 8, 9],
    },
    // KZN DARD Length of Growing Period, 'Spinach, true' row: 40-55 days, no
    // transplant asterisk (direct-sown crop; Plant Establishment Table 5 has
    // only a direct seeding rate for spinach, no seedtray/seedbed rate).
    daysToHarvest: 55,
    daysToHarvestRange: [40, 55],
    // Legacy single-figure fallback set to the Table 5 in-row midpoint (70-80mm).
    spacingCm: 8,
    rowSpacingCm: 20, // 200mm — KZN DARD 'Plant Establishment' Table 5, Spinach row
    inRowSpacingCm: 7.5, // 70-80mm — same table, same row
    sowDepthCm: 1.75, // 15-20mm — same table
    rowSpacingRangeCm: [20, 20],
    inRowSpacingRangeCm: [7, 8],
    sowDepthRangeCm: [1.5, 2],
    fieldSpacingVerified: true,
    yieldKgPerM2: 0.7,
    yieldRangeKgPerM2: [0.7, 1.2], // conservative through likely (7-8; 10-12 t/ha) — KZN DARD Expected Yields Table 8, 'Spinach, true' row
    note: 'Real spinach (Spinacia oleracea) — not the Swiss chard South Africans usually call spinach. Cool-season and fast: it bolts in heat, so keep to the cool sowing windows and pick promptly. Same botanical family (Amaranthaceae) as Swiss chard and beetroot, so the rotation rule treats all three as one family — do not follow one with another in the same bed.',
    // KZN DARD gives a 1-2 week usual harvesting period: fits inside the
    // first harvest month in this monthly model, same treatment as lettuce
    // and green beans — no extra whole calendar month.
    harvestPeriodRangeWeeks: [1, 2],
  },
  {
    key: 'turnip',
    name: 'Turnips',
    icon: '🟣',
    sowMonths: {
      // GDARD (Gauteng — summer-rainfall interior, region-matched provincial
      // authority): 'Planting time/date: Jan-Apr, Aug-Sept'. KZN DARD Table 6
      // cold/moderate-frost column corroborates Aug-Mar; Oct-Dec appear only
      // in that KZN column and are excluded conservatively here.
      summer: [1, 2, 3, 4, 8, 9],
      // UNSOURCEABLE — no KZN DARD/GDARD/DALRRD/Elsenburg primary source
      // names winter-rainfall Western Cape turnip sowing months, and Starke
      // Ayres' national home-garden chart (Summer/Autumn only, no regional
      // axis) cannot support month-level WC windows either. Empty array has
      // catalog precedent (maize, dry-beans, oats) — an honest gap beats an
      // invented month.
      winter: [],
      // KZN DARD Table 6, 'Hot areas Frost-free' column: 'Feb - Sept/Oct' —
      // the ambiguous Oct endpoint is excluded conservatively.
      'all-year': [2, 3, 4, 5, 6, 7, 8, 9],
      // KZN DARD Table 6, 'Warm areas Light frosts' column: 'All year'.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    // GDARD: 'Transplanting or planting to harvesting (days): 60-90' (direct
    // sowing). KZN DARD Table 4 corroborates with 45-75 days and a 2-4 week
    // picking period — both round up to the same 3-month coarse bed hold.
    daysToHarvest: 90,
    daysToHarvestRange: [60, 90],
    spacingCm: 8,
    rowSpacingCm: 50, // 400-600mm — KZN DARD 'Plant Establishment' Table 5, Turnip row
    inRowSpacingCm: 8, // 80mm — same table, same row (single published value)
    sowDepthCm: 1.75, // 15-20mm — same table
    rowSpacingRangeCm: [40, 60],
    inRowSpacingRangeCm: [8, 8],
    sowDepthRangeCm: [1.5, 2],
    // 8x50cm = 25 plants/m² = 250,000/ha — inside GDARD's own published
    // population of 200,000-400,000/ha, so the GDARD yield applies to a
    // consistent stand rather than a mismatched density (the amadumbe
    // failure mode this catalog now checks for).
    fieldSpacingVerified: true,
    // Bottom of GDARD 'Estimated yield ton/ha: 10 - 30' — one undifferentiated
    // estimate with no conservative/likely/target split (KZN DARD Expected
    // Yields Table 8 has no turnip row at all), so only the bottom end is a
    // defensible planning point. yieldRangeKgPerM2 is deliberately left unset:
    // that field means a published conservative-to-likely split, which this
    // source does not provide.
    yieldKgPerM2: 1,
    note: "Cool-weather Brassica root — direct-sow only and thin early so the roots can swell. Same botanical family as cabbage, kale and broccoli, so don't plan turnips straight after (or before) another brassica in the same bed. Young leaves are a traditional edible green — pick sparingly; the yield figure covers roots only.",
    // KZN DARD Table 4, Turnips row: 2-4 week usual picking period — no
    // extra whole calendar month beyond the first harvest month.
    harvestPeriodRangeWeeks: [2, 4],
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

/** A crop can occupy the calendar when its duration is verified and either
 * its plant geometry is verified or it is a non-food cover with a sourced
 * field seeding rate. The latter must never create a fake plant count. */
export function hasVerifiedSchedule(crop: CropDef): boolean {
  return crop.timingVerified !== false
    && (crop.fieldSpacingVerified !== false
      || (crop.yieldKgPerM2 === 0 && crop.seedRateKgPerHaRange !== undefined));
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
 * beans, kale and oats) suppress exact counts through the verification
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
