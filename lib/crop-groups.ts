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
  coriander: 'allium_aromatic',
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
  kale: 'brassicaceae',
  cabbage: 'brassicaceae',
  broccoli: 'brassicaceae',
  lettuce: 'asteraceae',
  carrots: 'apiaceae',
  coriander: 'apiaceae',
  onions: 'amaryllidaceae',
  garlic: 'amaryllidaceae',
  tomatoes: 'solanaceae',
  peppers: 'solanaceae',
  potato: 'solanaceae',
  'sweet-potato': 'convolvulaceae',
  amadumbe: 'araceae',
  butternut: 'cucurbitaceae',
  pumpkin: 'cucurbitaceae',
  cucumber: 'cucurbitaceae',
  watermelon: 'cucurbitaceae',
};

export function rotationFamilyOf(crop: CropDef): RotationFamily {
  const family = ROTATION_FAMILY[crop.key];
  if (!family) {
    throw new Error(`Crop "${crop.key}" has no botanical rotation family`);
  }
  return family;
}
