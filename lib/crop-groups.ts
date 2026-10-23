// Food-group lookup for the Auto-suggest questionnaire — additive only, never
// touches CropDef itself. A farmer picks groups ("leafy greens", "roots &
// tubers"...) rather than 24 individual crop names; the auto-suggest engine
// (lib/crop-autosuggest.ts) expands a group into its member crops.

import type { LucideIcon } from 'lucide-react';
import { Wheat, Bean, Leaf, Carrot, Sprout, Apple, Citrus, Clover, Shrub, Compass } from 'lucide-react';
import type { CropDef } from './crop-catalog';

export type FoodGroup =
  | 'staple_grain'
  | 'legume'
  | 'leafy_green'
  | 'root_tuber'
  | 'allium'
  | 'herb'
  | 'fruiting_veg'
  | 'squash_melon'
  | 'less_common'
  | 'cover_crop';

/**
 * `Icon` is a Lucide component, not an emoji.
 *
 * These render on the crop plan's bed labels — up to three per bed, all year. As emoji they
 * were the app's largest surviving cluster of colour glyphs in a farmer's view, against
 * CLAUDE.md's Lucide-only rule, and they sat beside the plan's own hand-drawn produce art, so
 * one bed row could carry two different kinds of picture.
 *
 * `label` still carries the meaning: the single-group case prints icon AND words, and the
 * multi-group case puts the words in a title attribute.
 */
export const FOOD_GROUP_META: Record<FoodGroup, { label: string; Icon: LucideIcon }> = {
  staple_grain: { label: 'Staple grain', Icon: Wheat },
  legume: { label: 'Legumes & beans', Icon: Bean },
  leafy_green: { label: 'Leafy greens', Icon: Leaf },
  root_tuber: { label: 'Roots & tubers', Icon: Carrot },
  allium: { label: 'Onions & garlic', Icon: Sprout },
  herb: { label: 'Herbs', Icon: Clover },
  fruiting_veg: { label: 'Fruiting veg', Icon: Apple },
  squash_melon: { label: 'Squashes & melons', Icon: Citrus },
  less_common: { label: 'Less common crops', Icon: Compass },
  cover_crop: { label: 'Cover crops', Icon: Shrub },
};

/**
 * Rory, 2026-09-30: "separate alliums and herbs because I'd like to turn off herbs sometimes …
 * many people are not going to want to grow coriander or parsley", "differentiate cover crops",
 * and "some things like mung beans … many people are just not gonna go for that … include a
 * category for these fringe crops". So herbs, cover crops and less common crops are their own
 * tiles in the crop-mix filter, each one a farmer can switch off.
 *
 * 'less_common' is a household-familiarity bucket, not a nutrition one: mung bean is still a
 * pulse and spider-plant still a leafy green. It holds crops a smallholder is unlikely to ask for
 * by default. Traditional crops that are widely grown (amaranth/morogo, cowpea, amadumbe) stay in
 * their nutrition group.
 *
 * 'cover_crop' holds the green manures. None of them is a food harvest, so the automatic pool
 * never places them in a veg bed anyway. Switching the tile off also stops the plot winter cover
 * pass (broad beans or oats after a summer staple) — see poolForBed in lib/crop-autosuggest.ts.
 */
export const COVER_CROP_GROUP: FoodGroup = 'cover_crop';

/*
 * Rory, 2026-09-30: "should we have squashes and melons as categories too?" 'squash_melon' holds
 * the rambling cucurbits (pumpkin, butternut, gem squash, baby marrow, watermelon, spanspek), so a
 * farmer short of room can switch the sprawling vines off without losing tomatoes and peppers.
 * Cucumber stays in 'fruiting_veg': it is trellised and picked like a bed vegetable. As food the
 * group still counts as fruiting veg, so it shares that turn in the breadth-first loop.
 */

// Priority order for the family/hybrid breadth-first selection loop: fast
// leafy crops + nitrogen-fixing legumes + storable roots claim scarce beds
// first; grain last (most bed-space per calorie, least dietary urgency).
// Every group the crop-mix filter offers. The breadth-first loop takes its turns
// from BREADTH_SLOTS below, which folds herbs and less common crops back into the
// nutrition group they feed.
export const GROUP_PRIORITY: FoodGroup[] = ['leafy_green', 'legume', 'root_tuber', 'allium', 'herb', 'fruiting_veg', 'squash_melon', 'staple_grain', 'less_common', 'cover_crop'];

export const FOOD_GROUP: Record<string, FoodGroup> = {
  maize: 'staple_grain',
  // A cereal, and grouped as one on purpose: that is exactly what makes it a
  // legal winter cover after a LEGUME staple course, where broad beans is a
  // rotation repeat. The mirror case is where the two covers together answer
  // all four staple courses — after a maize course broad beans is the
  // rotation-clean cover and oats is the repeat.
  //
  // That mirror is a PREFERENCE, not an absolute (2026-08-19 audit). Oats after
  // maize is also a KZN DARD-documented practice in maize lands, so the planner
  // keeps it as a named exception — but strictly as a last resort: a cover that
  // passes rotation outright always outranks one that only passes via the
  // exception (rotationLegalTiered in lib/crop-autosuggest.ts), and when the
  // exception is actually used the plan says so in a farmer-facing note that
  // cites the source and offers broad beans as the manual swap.
  // See PLOT_WINTER_COVER_KEYS in lib/staple-crops.ts.
  oats: 'staple_grain',
  'dry-beans': 'legume',
  'green-beans': 'legume',
  'broad-beans': 'legume',
  groundnuts: 'legume',
  peas: 'legume',
  'swiss-chard': 'leafy_green',
  kale: 'leafy_green',
  cabbage: 'leafy_green',
  lettuce: 'leafy_green',
  broccoli: 'leafy_green',
  'true-spinach': 'leafy_green',
  coriander: 'herb',
  carrots: 'root_tuber',
  beetroot: 'root_tuber',
  turnip: 'root_tuber',
  'sweet-potato': 'root_tuber',
  potato: 'root_tuber',
  amadumbe: 'root_tuber',
  onions: 'allium',
  garlic: 'allium',
  butternut: 'squash_melon',
  pumpkin: 'squash_melon',
  tomatoes: 'fruiting_veg',
  peppers: 'fruiting_veg',
  chilli: 'fruiting_veg',
  cucumber: 'fruiting_veg',
  watermelon: 'squash_melon',

  // 2026-09-28 batch — see research/crop-sources/<key>.json for citations.
  amaranth: 'leafy_green',
  cauliflower: 'leafy_green',
  parsley: 'herb',
  sorghum: 'staple_grain',
  soybean: 'less_common', // a pulse, but a field/commercial crop rarely grown in a home garden
  brinjal: 'fruiting_veg',
  'gem-squash': 'squash_melon',
  'baby-marrow': 'squash_melon',
  spanspek: 'squash_melon',
  // Dossier's own foodGroup is "fruiting_veg" (grown/picked like a vegetable
  // fruit, not milled like maize) — kept as sourced rather than forced into
  // maize's staple_grain bucket despite the shared species.
  sweetcorn: 'fruiting_veg',
  cowpea: 'legume',
  'bambara-groundnut': 'less_common', // a pulse (jugo bean); traditional but now seldom grown
  radish: 'root_tuber',
  'mung-bean': 'less_common', // a pulse; Rory's own example of a crop most farmers won't want
  // Dossier's own foodGroup is null (an oilseed fits none of the six
  // buckets cleanly); mapped to staple_grain as the closest fit for a
  // dryland grain-like crop rather than defaulting to fruiting_veg.
  sunflower: 'staple_grain',
  'spider-plant': 'less_common', // a leafy green (imifino), gathered more often than sown
  'african-nightshade': 'less_common', // a leafy green (imifino), gathered more often than sown

  // Cover crops, not a food harvest. Rotation uses ROTATION_FAMILY below, not
  // this bucket. Oats stays 'staple_grain' for the reason given above.
  'sunn-hemp': 'cover_crop',
  medic: 'cover_crop',
  'fodder-radish': 'cover_crop',
};

export function foodGroupOf(crop: CropDef): FoodGroup {
  return FOOD_GROUP[crop.key] ?? 'fruiting_veg';
}

/** What a 'less_common' crop is as food — the group it sat in before it got its own tile. */
const LESS_COMMON_NUTRITION: Record<string, FoodGroup> = {
  soybean: 'legume',
  'bambara-groundnut': 'legume',
  'mung-bean': 'legume',
  'spider-plant': 'leafy_green',
  'african-nightshade': 'leafy_green',
};

/**
 * The nutrition group, for decisions about what a crop feeds a household rather than
 * whether a farmer wants it: a mung bean swaps with other pulses, and in the auto-suggest
 * breadth-first loop it queues behind the familiar beans, not in a turn of its own.
 */
export function nutritionGroupOf(crop: CropDef): FoodGroup {
  const group = foodGroupOf(crop);
  if (group === 'less_common') return LESS_COMMON_NUTRITION[crop.key] ?? 'fruiting_veg';
  return group === 'squash_melon' ? 'fruiting_veg' : group;
}

/**
 * The breadth-first loop's turns: one per nutrition group, as before the crop-mix split.
 * Herbs share the onion turn, as they did under 'Alliums & herbs', so splitting the tile
 * lets a farmer switch herbs off without handing them an extra bed in every plan.
 */
export const BREADTH_SLOTS: FoodGroup[] = ['leafy_green', 'legume', 'root_tuber', 'allium', 'fruiting_veg', 'staple_grain'];

export function breadthSlotOf(crop: CropDef): FoodGroup {
  const group = nutritionGroupOf(crop);
  return group === 'herb' ? 'allium' : group === 'cover_crop' ? 'legume' : group;
}

/**
 * Botanical families used for crop-rotation checks. These deliberately stay
 * separate from `FoodGroup`: potato and tomato feed different household needs
 * but share Solanaceae pests and diseases, while beetroot and Swiss chard are
 * the same Amaranthaceae family despite appearing in different food groups.
 *
 * ARC's Conservation Agriculture crop-rotation manual treats rotation as a
 * multi-season decision built from crop relationships and local constraints.
 * This authority records family relationships only. It does not invent a
 * universal sequence or claim that one year of generated history proves a
 * multi-year rotation.
 * https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Climate%20Smart%20Production%20Types/Manual/Microsoft%20Word%20-%20CA%20Crop%20rotation%20Manual.pdf
 */
export type RotationFamily =
  | 'amaranthaceae'
  | 'amaryllidaceae'
  | 'apiaceae'
  | 'araceae'
  | 'asteraceae'
  | 'brassicaceae'
  | 'cleomaceae'
  | 'convolvulaceae'
  | 'cucurbitaceae'
  | 'fabaceae'
  | 'poaceae'
  | 'solanaceae';

export const ROTATION_FAMILY_META: Record<RotationFamily, { label: string }> = {
  amaranthaceae: { label: 'Beet & chard family' },
  amaryllidaceae: { label: 'Onion family' },
  apiaceae: { label: 'Carrot family' },
  araceae: { label: 'Amadumbe family' },
  asteraceae: { label: 'Lettuce family' },
  brassicaceae: { label: 'Cabbage family' },
  // Spider-plant (Cleome gynandra) — its own family, not Brassicaceae despite
  // the superficial resemblance; added 2026-09-28.
  cleomaceae: { label: 'Spider-plant family' },
  convolvulaceae: { label: 'Sweet-potato family' },
  cucurbitaceae: { label: 'Pumpkin family' },
  fabaceae: { label: 'Bean & pea family' },
  poaceae: { label: 'Grass family' },
  solanaceae: { label: 'Tomato & potato family' },
};

export const ROTATION_FAMILY: Record<string, RotationFamily> = {
  maize: 'poaceae',
  oats: 'poaceae',
  'dry-beans': 'fabaceae',
  'green-beans': 'fabaceae',
  'broad-beans': 'fabaceae',
  groundnuts: 'fabaceae',
  peas: 'fabaceae',
  'swiss-chard': 'amaranthaceae',
  beetroot: 'amaranthaceae',
  'true-spinach': 'amaranthaceae',
  kale: 'brassicaceae',
  cabbage: 'brassicaceae',
  broccoli: 'brassicaceae',
  turnip: 'brassicaceae',
  lettuce: 'asteraceae',
  carrots: 'apiaceae',
  coriander: 'apiaceae',
  onions: 'amaryllidaceae',
  garlic: 'amaryllidaceae',
  tomatoes: 'solanaceae',
  peppers: 'solanaceae',
  chilli: 'solanaceae',
  potato: 'solanaceae',
  'sweet-potato': 'convolvulaceae',
  amadumbe: 'araceae',
  butternut: 'cucurbitaceae',
  pumpkin: 'cucurbitaceae',
  cucumber: 'cucurbitaceae',
  watermelon: 'cucurbitaceae',

  // 2026-09-28 batch — see research/crop-sources/<key>.json for citations.
  amaranth: 'amaranthaceae',
  cauliflower: 'brassicaceae',
  parsley: 'apiaceae',
  sorghum: 'poaceae',
  soybean: 'fabaceae',
  brinjal: 'solanaceae',
  'gem-squash': 'cucurbitaceae',
  'baby-marrow': 'cucurbitaceae',
  spanspek: 'cucurbitaceae',
  sweetcorn: 'poaceae',
  cowpea: 'fabaceae',
  'bambara-groundnut': 'fabaceae',
  radish: 'brassicaceae',
  'mung-bean': 'fabaceae',
  sunflower: 'asteraceae',
  'spider-plant': 'cleomaceae',
  'african-nightshade': 'solanaceae',
  'sunn-hemp': 'fabaceae',
  medic: 'fabaceae',
  'fodder-radish': 'brassicaceae',
};

export function rotationFamilyOf(crop: CropDef): RotationFamily {
  const family = ROTATION_FAMILY[crop.key];
  if (!family) {
    throw new Error(`Crop "${crop.key}" has no botanical rotation family`);
  }
  return family;
}
