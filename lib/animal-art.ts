import { ANIMAL_ENTERPRISES, type AnimalProduct, type HousingKind } from '@/lib/animal-enterprises';

/**
 * Optional artwork per animal enterprise, keyed by enterpriseId (lib/animal-enterprises-data.ts).
 * A sibling lookup like lib/crop-art.ts: the dossier pipeline regenerates the enterprise table, so
 * the picture lives here, not in it.
 *
 * An enterprise with no entry keeps its Lucide product icon, so an empty map changes nothing a
 * farmer sees. Codex adds an entry in the same commit as its PNG; docs/ANIMAL-TREE-ART-BRIEF.md has
 * the list, the rules and the self-check. tests/animal-enterprises.test.ts keeps keys, files and
 * the 256×256 transparent-corner format in agreement.
 */
export const ANIMAL_ART_ROOT = '/animal-art';

export const ANIMAL_ART: Readonly<Record<string, string>> = {
  'chicken-layer': '/animal-art/chicken-layer.png',
  'chicken-broiler': '/animal-art/chicken-broiler.png',
  'chicken-indigenous': '/animal-art/chicken-indigenous.png',
  duck: '/animal-art/duck.png',
  rabbit: '/animal-art/rabbit.png',
  bees: '/animal-art/bees.png',
  'goat-meat': '/animal-art/goat-meat.png',
  'goat-dairy': '/animal-art/goat-dairy.png',
  'goat-indigenous': '/animal-art/goat-indigenous.png',
  'cattle-beef': '/animal-art/cattle-beef.png',
  'cattle-dairy': '/animal-art/cattle-dairy.png',
  'sheep-mutton': '/animal-art/sheep-mutton.png',
  'sheep-wool': '/animal-art/sheep-wool.png',
  'pig-pork': '/animal-art/pig-pork.png',
  'fish-tilapia': '/animal-art/fish-tilapia.png',
};

export function animalArtUrl(enterpriseId: string): string | null {
  return ANIMAL_ART[enterpriseId] ?? null;
}

// Food calendars picture what is produced. Housing without a chosen enterprise
// keeps an animal portrait so a bare coop never looks like a promise of eggs.
export const ANIMAL_PRODUCT_ART: Readonly<Record<AnimalProduct, string>> = {
  eggs: '/animal-product-art/eggs.png', meat: '/animal-product-art/meat.png',
  milk: '/animal-product-art/milk.png', honey: '/animal-product-art/honey.png',
  fish: '/animal-product-art/fish.png', wool: '/animal-product-art/wool.png',
};
const HOUSING_PORTRAIT: Readonly<Record<HousingKind, string>> = {
  chicken: 'chicken-indigenous', bee: 'bees', goat: 'goat-meat', rabbit: 'rabbit',
  duck: 'duck', pig: 'pig-pork', kraal: 'cattle-beef', pond: 'fish-tilapia',
};
export function animalProductArtUrl(product: AnimalProduct): string {
  return ANIMAL_PRODUCT_ART[product];
}
export function enterpriseProductArtUrl(enterpriseId: string): string | null {
  const enterprise = ANIMAL_ENTERPRISES[enterpriseId];
  return enterprise ? animalProductArtUrl(enterprise.product) : null;
}
export function housingArtUrl(housing: string): string | null {
  const enterprise = HOUSING_PORTRAIT[housing as HousingKind];
  return enterprise ? animalArtUrl(enterprise) : null;
}
