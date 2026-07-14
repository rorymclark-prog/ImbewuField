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
    yieldKgPerM2: 1,
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
    daysToHarvest: 100,
    spacingCm: 10,
    yieldKgPerM2: 0.4,
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
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 3,
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
      'mild-frost': [10, 11, 12],
    },
    daysToHarvest: 110,
    spacingCm: 120,
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 3,
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
    daysToHarvest: 80,
    spacingCm: 8,
    yieldKgPerM2: 3,
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
    icon: '🟣',
    sowMonths: {
      summer: [2, 3, 8, 9, 10],
      winter: [2, 3, 4, 8, 9, 10],
      'all-year': [1, 2, 3, 4, 8, 9, 10, 11],
      // Same logic as carrots — root crop, foliage tolerates light frost.
      'mild-frost': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    },
    daysToHarvest: 60,
    spacingCm: 10,
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 4,
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
      'mild-frost': [8, 9, 10],
    },
    daysToHarvest: 90,
    transplant: true,
    spacingCm: 40,
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 3,
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
      'mild-frost': [2, 3, 7, 8, 9],
    },
    daysToHarvest: 100,
    spacingCm: 30,
    yieldKgPerM2: 3,
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
    yieldKgPerM2: 2,
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
    daysToHarvest: 200,
    spacingCm: 45,
    yieldKgPerM2: 2,
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
    yieldKgPerM2: 1.5,
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
    yieldKgPerM2: 1.5,
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
    yieldKgPerM2: 2,
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
      'mild-frost': [2, 3, 4, 5, 6, 7, 8],
    },
    daysToHarvest: 100,
    spacingCm: 20,
    yieldKgPerM2: 1.5,
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
    yieldKgPerM2: 2,
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
    daysToHarvest: 55,
    spacingCm: 40,
    yieldKgPerM2: 4,
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
      'mild-frost': [10, 11, 12],
    },
    daysToHarvest: 90,
    spacingCm: 150,
    yieldKgPerM2: 4,
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
    yieldKgPerM2: 1.5,
    note: 'Bolts fast in heat and long days — sow in cooler months for leafy growth.',
  },
];

export function cropByKey(k: string): CropDef | undefined {
  return CROPS.find((c) => c.key === k);
}

export const MONTHS_SHORT: string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
