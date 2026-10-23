import type { PreservedFoodRecord } from './production-records';

export const PRESERVED_FOOD_ART: Readonly<Record<string, string>> = {
  'dried-mango': '/preserved-food-art/dried-mango.png',
  'dried-banana': '/preserved-food-art/dried-banana.png',
  'stored-macadamia': '/preserved-food-art/stored-macadamia.png',
  'frozen-beans': '/preserved-food-art/frozen-beans.png',
  'fermented-cabbage': '/preserved-food-art/fermented-cabbage.png',
  'processed-tomatoes': '/preserved-food-art/processed-tomatoes.png',
};
const sourceProducts: Readonly<Record<string, string>> = {
  'dried:tree:mangifera-indica': 'dried-mango',
  'dried:tree:musa-acuminata-aaa-group': 'dried-banana',
  'stored:tree:macadamia-integrifolia': 'stored-macadamia',
  'frozen:crop:green-beans': 'frozen-beans',
  'fermented:crop:cabbage': 'fermented-cabbage',
  'processed:crop:tomatoes': 'processed-tomatoes',
};

// Food identity stays the ingredient for deduplication. The picture may show its
// recorded form, without making a fresh fruit imply that a jar or bag exists.
export function preservedFoodIconKey(record: Pick<PreservedFoodRecord, 'method' | 'sourceIconKey'>): string {
  const product = sourceProducts[`${record.method}:${record.sourceIconKey}`];
  return product ? `preserved:${product}` : record.sourceIconKey;
}
export function preservedFoodArtUrl(record: Pick<PreservedFoodRecord, 'method' | 'sourceIconKey'>): string | null {
  const key = preservedFoodIconKey(record);
  return key.startsWith('preserved:') ? PRESERVED_FOOD_ART[key.slice('preserved:'.length)] ?? null : null;
}
