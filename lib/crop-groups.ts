// Food-group lookup for the Auto-suggest questionnaire — additive only, never
// touches CropDef itself. A farmer picks groups ("leafy greens", "roots &
// tubers"...) rather than 24 individual crop names; the auto-suggest engine
// (lib/crop-autosuggest.ts) expands a group into its member crops.

import type { CropDef } from './crop-catalog';

export type FoodGroup = 'staple_grain' | 'legume' | 'leafy_green' | 'root_tuber' | 'allium_aromatic' | 'fruiting_veg';

export const FOOD_GROUP_META: Record<FoodGroup, { label: string; icon: string }> = {
  staple_grain: { label: 'Staple grain', icon: '🌽' },
  legume: { label: 'Legumes & beans', icon: '🫘' },
  leafy_green: { label: 'Leafy greens', icon: '🍃' },
  root_tuber: { label: 'Roots & tubers', icon: '🥕' },
  allium_aromatic: { label: 'Alliums & herbs', icon: '🧅' },
  fruiting_veg: { label: 'Fruiting veg', icon: '🍅' },
};

// Priority order for the family/hybrid breadth-first selection loop: fast
// leafy crops + nitrogen-fixing legumes + storable roots claim scarce beds
// first; grain last (most bed-space per calorie, least dietary urgency).
export const GROUP_PRIORITY: FoodGroup[] = ['leafy_green', 'legume', 'root_tuber', 'allium_aromatic', 'fruiting_veg', 'staple_grain'];

// The actual crop-ROTATION sequence — a fixed cycle each bed is meant to
// move through over successive plantings, general permaculture practice:
// legumes fix nitrogen for the heavy-feeding leafy greens that follow them;
// fruiting veg draws on what's left without repeating a heavy feeder twice;
// roots want soil that ISN'T freshly rich, so they suit a bed a heavy feeder
// just drew down; alliums are light feeders that rest the bed gently; grain
// is the bulk "reset" year before the cycle returns to legumes. Used by
// BedRotation (lib/crop-autosuggest.ts) to actively TARGET each bed's next
// group (a preference, not a hard rule — falls back to any bed rather than
// leaving a bed unplanted), and by the crop-plan page's explanation card.
export const ROTATION_SEQUENCE: FoodGroup[] = ['legume', 'leafy_green', 'fruiting_veg', 'root_tuber', 'allium_aromatic', 'staple_grain'];

export const ROTATION_BLURB: Record<FoodGroup, string> = {
  legume: 'Pulls nitrogen from the air into the soil as it grows — the best group to plant right before a hungry leafy green or fruiting crop.',
  leafy_green: 'Fast turnover, heavy nitrogen feeders — do best following legumes, and quick enough to only hold a bed for part of a season.',
  fruiting_veg: 'Heavy feeders with their own soil-borne pests and diseases — the group most worth never repeating in the same bed two seasons running.',
  root_tuber: "Dig deep and don't want freshly-manured soil — a good match for a bed that carried heavy feeders the season before.",
  allium_aromatic: 'Light feeders with natural pest-deterrent oils — a gentle "rest" crop between hungrier groups.',
  staple_grain: 'Bulk biomass with moderate needs — often the long "reset" year in a multi-bed rotation.',
};

/** The food group that should ideally follow `group` in the rotation cycle. */
export function nextInRotation(group: FoodGroup): FoodGroup {
  const idx = ROTATION_SEQUENCE.indexOf(group);
  return ROTATION_SEQUENCE[(idx + 1) % ROTATION_SEQUENCE.length];
}

export const FOOD_GROUP: Record<string, FoodGroup> = {
  maize: 'staple_grain',
  // A cereal, and grouped as one on purpose: that is exactly what makes it a
  // legal winter cover after a LEGUME staple course, where broad beans is a
  // rotation repeat. The mirror case holds too — after a maize course oats is
  // the repeat and broad beans is legal — so the two covers together answer all
  // four staple courses. See PLOT_WINTER_COVER_KEYS in lib/staple-crops.ts.
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
  coriander: 'leafy_green',
  carrots: 'root_tuber',
  beetroot: 'root_tuber',
  'sweet-potato': 'root_tuber',
  potato: 'root_tuber',
  amadumbe: 'root_tuber',
  onions: 'allium_aromatic',
  garlic: 'allium_aromatic',
  butternut: 'fruiting_veg',
  pumpkin: 'fruiting_veg',
  tomatoes: 'fruiting_veg',
  peppers: 'fruiting_veg',
  cucumber: 'fruiting_veg',
  watermelon: 'fruiting_veg',
};

export function foodGroupOf(crop: CropDef): FoodGroup {
  return FOOD_GROUP[crop.key] ?? 'fruiting_veg';
}
