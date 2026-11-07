'use client';

import { useMemo, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { inlineText } from '@/lib/xh-inline';
import { CROPS } from '@/lib/crop-catalog';
import { PERENNIAL_HARVEST_DATA } from '@/lib/perennial-harvest-data';
import { isHouseholdFoodHarvest } from '@/lib/perennial-harvest';
import { ANIMAL_ENTERPRISES, PRODUCT_LABEL } from '@/lib/animal-enterprises';
import { pdfIconUrl } from '@/lib/pdf-icons';
import { PRESERVED_FOOD_ART } from '@/lib/preserved-food-art';
import { MAPPED_FOOD_PRODUCT_ART, speciesFruitArtworkUrl } from '@/lib/species-art';
import { SPECIES } from '@/lib/species-catalog';
import styles from './ProductArtworkGallery.module.css';

type ProductGroup = 'crops' | 'forest' | 'animals' | 'kept';
const groups: Record<ProductGroup, string> = { crops: 'Vegetables & staples', forest: 'Fruit, nuts & berries', animals: 'Animal products', kept: 'Stored & preserved' };
const animalFoodNames: Record<string, string> = { bees: 'Honey', 'cattle-beef': 'Beef', 'cattle-dairy': 'Cow milk', 'chicken-broiler': 'Chicken meat', 'chicken-indigenous': 'Chicken eggs', 'chicken-layer': 'Chicken eggs', duck: 'Duck meat', rabbit: 'Rabbit meat', 'goat-meat': 'Goat meat', 'goat-indigenous': 'Goat meat', 'goat-dairy': 'Goat milk', 'sheep-mutton': 'Mutton', 'sheep-wool': 'Wool', 'pig-pork': 'Pork', 'fish-tilapia': 'Tilapia' };
const preservedNames: Record<string, string> = { 'dried-mango': 'Dried mango', 'dried-banana': 'Dried banana', 'stored-macadamia': 'Stored macadamia', 'frozen-beans': 'Frozen beans', 'fermented-cabbage': 'Fermented cabbage', 'processed-tomatoes': 'Processed tomatoes' };
const animalSourceNames: Record<string, string> = { 'chicken-layer': 'Laying hens', 'chicken-indigenous': 'Village chickens', 'goat-meat': 'Meat goats', 'goat-indigenous': 'Indigenous goats' };
// The picture names stay as the catalogue spells them (crop, plant and breed names); the group
// names, the food words and the one-line notes are translated where they are drawn.
function productsFor(lang: string) {
  const ui = (english: string) => inlineText(lang, english);
  return {
    crops: CROPS.filter(crop => crop.yieldKgPerM2 !== 0).map(crop => ({ key: `crop:${crop.key}`, label: crop.name, detail: crop.yieldKgPerM2 === null ? ui('Yield needs local information') : ui('Crop product') })),
    forest: [...Object.values(PERENNIAL_HARVEST_DATA).filter(plant => isHouseholdFoodHarvest(plant) && speciesFruitArtworkUrl(plant.speciesId)).map(plant => ({ key: `tree:${plant.speciesId}`, label: plant.name, detail: ui(plant.product) })), ...SPECIES.filter(plant => MAPPED_FOOD_PRODUCT_ART[plant.id] && !PERENNIAL_HARVEST_DATA[plant.id]).map(plant => ({ key: `tree:${plant.id}`, label: plant.commonName, detail: ui('Local picking dates need confirmation') }))],
    animals: Object.values(ANIMAL_ENTERPRISES).map(animal => ({ key: `animal:${animal.enterpriseId}`, label: animalFoodNames[animal.enterpriseId] ? ui(animalFoodNames[animal.enterpriseId]) : animal.name, detail: animalSourceNames[animal.enterpriseId] ? ui(animalSourceNames[animal.enterpriseId]) : `${ui(PRODUCT_LABEL[animal.product])}${animal.product === 'wool' ? ` · ${ui('not food')}` : ''}` })),
    kept: Object.keys(PRESERVED_FOOD_ART).map(key => ({ key: `preserved:${key}`, label: ui(preservedNames[key] ?? key.replaceAll('-', ' ').replace(/^./, value => value.toUpperCase())), detail: ui('Dated stock record needed') })),
  };
}

export default function ProductArtworkGallery() {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const [group, setGroup] = useState<ProductGroup>('crops');
  const products = useMemo(() => productsFor(lang), [lang]);
  return <section className={styles.gallery} id="product-pictures" aria-labelledby="product-pictures-title">
    <h2 id="product-pictures-title">{ui('Product picture catalogue')}</h2>
    <p>{ui('Available product illustrations, in one style. The plan also includes researched plants without a product illustration. Suitability and production depend on your farm’s climate, plants and animals.')}</p>
    <div className={styles.filters} aria-label={ui('Product picture groups')}>{(Object.keys(groups) as ProductGroup[]).map(key => <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(key)}>{ui(groups[key])} <span>{products[key].length}</span></button>)}</div>
    <div className={styles.grid}>{products[group].map(product => {
      const url = pdfIconUrl(product.key);
      return <article className={styles.product} key={product.key}>{url && <img src={url} width={84} height={84} alt={product.label} loading="lazy" />}<strong>{product.label}</strong><small>{product.detail}</small></article>;
    })}</div>
  </section>;
}
