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

export const FOOD_GROUP: Record<string, FoodGroup> = {
  maize: 'staple_grain',
  'dry-beans': 'legume',
  'green-beans': 'legume',
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
