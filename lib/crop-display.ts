// Display-name aliases are kept here because several pages speak in their own
// labels while the crop catalog must remain keyed by stable catalog ids.
// Keeping one map prevents a renamed crop from silently drifting between pages.
export const CATALOG_KEY_FOR_CROP: Record<string, string> = {
  Spinach: 'swiss-chard',
  Kale: 'kale',
  Lettuce: 'lettuce',
  Carrots: 'carrots',
  Beetroot: 'beetroot',
  Peas: 'peas',
  Garlic: 'garlic',
  Broccoli: 'broccoli',
  'Sweet potato': 'sweet-potato',
  Tomatoes: 'tomatoes',
  Maize: 'maize',
  Beans: 'green-beans',
  Butternut: 'butternut',
  Peppers: 'peppers',
  Cucumber: 'cucumber',
  Pumpkin: 'pumpkin',
  'Swiss chard': 'swiss-chard',
};
