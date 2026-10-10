// One authority for catalogue-species artwork. A picked catalogue plant is saved as a generic
// planting element plus `speciesId`, so element-art mappings cannot answer which plant it is.
// Keeping both views here prevents the picker and the exact plan from silently choosing different
// species when only one side of a pair has been painted so far.

export const SPECIES_PICKER_ART_ROOT = '/element-art';

type SpeciesArtwork = {
  picker: string | null;
  plan: string | null;
};

export const SPECIES_ART = {
  'prunus-dulcis': { picker: 'tree_almond.png', plan: 'almond-tree-v1.png' },
  'prunus-armeniaca': { picker: 'tree_apricot.png', plan: 'apricot-tree-v1.png' },
  'coffea-arabica': { picker: 'tree_arabica_coffee.png', plan: 'arabica-coffee-tree-v1.png' },
  'musa-acuminata-aaa-group': { picker: 'tree_banana_dwarf_cavendish_williams.png', plan: 'banana-dwarf-cavendish-williams-v1.png' },
  'morus-nigra': { picker: 'tree_black_mulberry.png', plan: 'black-mulberry-tree-v1.png' },
  'moringa-oleifera': { picker: 'tree_moringa.png', plan: 'moringa-tree-v1.png' },
  'ceratonia-siliqua': { picker: 'tree_carob.png', plan: 'carob-tree-v1.png' },
  'phoenix-dactylifera': { picker: 'tree_date_palm.png', plan: 'date-palm-v1.png' },
  'carya-illinoinensis': { picker: 'tree_pecan.png', plan: 'pecan-tree-v1.png' },
  'pistacia-vera': { picker: 'tree_pistachio.png', plan: 'pistachio-tree-v1.png' },
  'cydonia-oblonga': { picker: 'tree_quince.png', plan: 'quince-tree-v1.png' },
  'prunus-avium': { picker: 'tree_sweet_cherry.png', plan: 'sweet-cherry-tree-v1.png' },
  'diospyros-lycioides': { picker: 'tree_bluebush.png', plan: 'bluebush-v1.png' },
  'berchemia-discolor': { picker: 'tree_brown_ivory_motsintsila.png', plan: 'brown-ivory-tree-v1.png' },
  'mimusops-afra': { picker: 'tree_coastal_red_milkwood.png', plan: 'coastal-red-milkwood-tree-v1.png' },
  'grewia-occidentalis': { picker: 'tree_cross_berry.png', plan: 'cross-berry-v1.png' },
  'euclea-pseudebenus': { picker: 'tree_gariep_ebony.png', plan: 'gariep-ebony-tree-v1.png' },
  'searsia-lucida': { picker: 'tree_glossy_currant.png', plan: 'glossy-currant-v1.png' },
  'grewia-robusta': { picker: 'tree_karoo_crossberry.png', plan: 'karoo-crossberry-v1.png' },
  'searsia-undulata': { picker: 'tree_kuni_bush.png', plan: 'kuni-bush-v1.png' },
  'ehretia-rigida': { picker: 'tree_puzzle_bush.png', plan: 'puzzle-bush-v1.png' },
  'mimusops-zeyheri': { picker: 'tree_red_milkwood_moepel.png', plan: 'red-milkwood-tree-v1.png' },
  'boscia-albitrunca': { picker: 'tree_shepherd_s_tree.png', plan: 'shepherds-tree-v1.png' },
  'euclea-undulata': { picker: 'tree_small_leaved_guarri.png', plan: 'small-leaved-guarri-v1.png' },
  'aponogeton-distachyos': { picker: 'tree_waterblommetjie.png', plan: 'waterblommetjie-v1.png' },
  'phoenix-reclinata': { picker: 'tree_wild_date_palm.png', plan: 'wild-date-palm-v1.png' },
  'vangueria-infausta': { picker: 'tree_wild_medlar_mmilo.png', plan: 'wild-medlar-v1.png' },
  'osteospermum-moniliferum': { picker: 'tree_bietou.png', plan: 'bietou-v1.png' },
  'grewia-flava': { picker: 'tree_brandybush.png', plan: 'brandybush-v1.png' },
  'cyclopia-genistoides': { picker: 'tree_honeybush.png', plan: 'honeybush-v1.png' },
  'aspalathus-linearis': { picker: 'tree_rooibos.png', plan: 'rooibos-v1.png' },
  'salvia-rosmarinus-rosmarinus-officinalis': { picker: 'tree_rosemary.png', plan: 'rosemary-v1.png' },
  'salvia-rosmarinus': { picker: 'tree_rosemary.png', plan: 'rosemary-v1.png' },
  'rhamnus-prinoides': { picker: 'tree_dogwood.png', plan: 'dogwood-v1.png' },
  'searsia-natalensis': { picker: 'tree_natal_currant.png', plan: 'natal-currant-v1.png' },
  'cajanus-cajan': { picker: 'tree_pigeon_pea.png', plan: 'pigeon-pea-v1.png' },
  'aloidendron-dichotomum': { picker: 'tree_quiver_tree.png', plan: 'quiver-tree-v1.png' },
  'lycium-cinereum': { picker: 'tree_honey_thorn.png', plan: 'honey-thorn-v1.png' },
  'lycium-ferocissimum': { picker: 'tree_cape_boxthorn.png', plan: 'cape-boxthorn-v1.png' },
  'portulacaria-afra': { picker: 'tree_spekboom.png', plan: 'spekboom-v1.png' },
  'morella-cordifolia': { picker: 'tree_waxberry.png', plan: 'waxberry-v1.png' },
  'rhoicissus-digitata': { picker: 'tree_baboon_grape.png', plan: 'baboon-grape-v1.png' },
  'rhoicissus-tridentata': { picker: 'tree_bushman_s_grape.png', plan: 'bushmans-grape-v1.png' },
  'rhoicissus-tomentosa': { picker: 'tree_common_wild_grape.png', plan: 'common-wild-grape-v1.png' },
  'vitis-vinifera': { picker: 'tree_grape_vine.png', plan: 'grape-vine-v1.png' },
  'lablab-purpureus': { picker: 'tree_lablab.png', plan: 'lablab-v1.png' },
  'basella-alba': { picker: 'tree_malabar_spinach.png', plan: 'malabar-spinach-v1.png' },
  'passiflora-edulis': { picker: 'tree_purple_granadilla.png', plan: 'purple-granadilla-v1.png' },
  'ziziphus-mucronata': { picker: 'tree_buffalo_thorn.png', plan: 'buffalo-thorn-v1.png' },
  'schotia-afra-var-afra': { picker: 'tree_karoo_boer_bean.png', plan: 'karoo-boer-bean-v1.png' },
  'trema-orientalis': { picker: 'tree_pigeonwood.png', plan: 'pigeonwood-v1.png' },
  'barringtonia-racemosa': { picker: 'tree_powder_puff_tree.png', plan: 'powder-puff-tree-v1.png' },
  'searsia-lancea': { picker: 'tree_karee.png', plan: 'karee-v1.png' },
  'searsia-lancea-rhus-lancea': { picker: 'tree_karee.png', plan: 'karee-v1.png' },
  'sideroxylon-inerme': { picker: 'tree_white_milkwood.png', plan: 'white-milkwood-v1.png' },
  'olea-europaea-subsp-europaea': { picker: 'tree_olive.png', plan: 'olive-v1.png' },
  // Fruit trees with harvest data (lib/perennial-harvest-data.ts) that already had artwork under
  // their design element but no species entry, so the picker showed them with no picture.
  'carica-papaya': { picker: 'tree_pawpaw.png', plan: 'pawpaw-tree-v2.png' },
  'carissa-macrocarpa': { picker: 'tree_natal_plum-v3.png', plan: 'natal-plum-v2.png' },
  'citrus-limon': { picker: 'tree_lemon.png', plan: 'citrus-tree-v3.png' },
  'citrus-reticulata': { picker: 'tree_citrus.png', plan: 'citrus-tree-v3.png' },
  'dovyalis-afra': { picker: 'tree_kei_apple.png', plan: 'kei-apple-tree-v2.png' },
  'ficus-carica': { picker: 'tree_fig.png', plan: 'fig-tree-v1.png' },
  'harpephyllum-caffrum': { picker: 'tree_wild_plum.png', plan: 'wild-plum-v2.png' },
  'litchi-chinensis': { picker: 'tree_litchi.png', plan: 'litchi-tree-v5.png' },
  'macadamia-integrifolia': { picker: 'tree_macadamia.png', plan: 'macadamia-tree-v2.png' },
  'mangifera-indica': { picker: 'tree_mango.png', plan: 'mango-tree-v2.png' },
  'persea-americana': { picker: 'tree_avocado.png', plan: 'avocado-tree-v5.png' },
  'prunus-persica': { picker: 'tree_peach.png', plan: 'peach-tree-v1.png' },
  'prunus-salicina': { picker: 'tree_plum.png', plan: 'plum-tree-v1.png' },
  'psidium-guajava': { picker: 'tree_guava.png', plan: 'guava-v2.png' },
  'punica-granatum': { picker: 'tree_pomegranate.png', plan: 'pomegranate-tree-v1.png' },
  'sclerocarya-birrea-subsp-caffra': { picker: 'tree_marula.png', plan: 'marula-tree-v2.png' },
  'syzygium-cordatum': { picker: 'tree_waterberry.png', plan: 'waterberry-v2.png' },
  'carpobrotus-edulis': { picker: 'tree_sour_fig.png', plan: 'sour-fig-v1.png' },
  'englerophytum-magalismontanum': { picker: 'tree_transvaal_milkplum.png', plan: 'transvaal-milkplum-v1.png' },
  'garcinia-livingstonei': { picker: 'tree_african_mangosteen.png', plan: 'african-mangosteen-v1.png' },
  'pappea-capensis': { picker: 'tree_jacket_plum.png', plan: 'jacket-plum-v1.png' },
  'strychnos-spinosa': { picker: 'tree_spiny_monkey_orange.png', plan: 'spiny-monkey-orange-v1.png' },
} as const satisfies Readonly<Record<string, SpeciesArtwork>>;

export type SpeciesReferenceArtwork = Exclude<
  (typeof SPECIES_ART)[keyof typeof SPECIES_ART]['plan'],
  null
>;

export type SpeciesPickerArtwork = Exclude<
  (typeof SPECIES_ART)[keyof typeof SPECIES_ART]['picker'],
  null
>;

export const SPECIES_PICKER_ART = Object.values(SPECIES_ART)
  .map((art) => art.picker)
  .filter((file): file is SpeciesPickerArtwork => file !== null);

export const SPECIES_REFERENCE_ART = Object.values(SPECIES_ART)
  .map((art) => art.plan)
  .filter((file): file is SpeciesReferenceArtwork => file !== null);

export function speciesPickerArtworkFor(speciesId?: string | null): string | null {
  if (!speciesId) return null;
  return (SPECIES_ART as Readonly<Record<string, SpeciesArtwork>>)[speciesId]?.picker ?? null;
}

export function speciesPickerArtworkUrl(speciesId?: string | null): string | null {
  const file = speciesPickerArtworkFor(speciesId);
  return file ? `${SPECIES_PICKER_ART_ROOT}/${file}` : null;
}

export function speciesReferenceArtworkFor(speciesId?: string | null): SpeciesReferenceArtwork | null {
  if (!speciesId) return null;
  return (SPECIES_ART as Readonly<Record<string, SpeciesArtwork>>)[speciesId]?.plan as SpeciesReferenceArtwork ?? null;
}

// ── fruit art ────────────────────────────────────────────────────────────────
// The crop calendar shows what a tree GIVES in a month — the fruit, nut, berry or pod — not the
// tree. One icon per species in lib/perennial-harvest-data.ts, all present in public/fruit-art/.
// The SVGs are flat placeholders from scripts/build-fruit-placeholder-art.mjs; when Codex paints a
// PNG per docs/FRUIT-ART-BRIEF.md, list its speciesId in FRUIT_ART_PNG and the PNG is used instead.

export const FRUIT_ART_ROOT = '/fruit-art';

export const FRUIT_ART_SPECIES = [
  'carica-papaya', 'carissa-macrocarpa', 'carpobrotus-edulis', 'carya-illinoinensis', 'citrus-limon',
  'citrus-reticulata', 'dovyalis-afra', 'englerophytum-magalismontanum', 'ficus-carica',
  'fragaria-x-ananassa', 'garcinia-livingstonei', 'grewia-occidentalis', 'harpephyllum-caffrum',
  'litchi-chinensis', 'macadamia-integrifolia', 'mangifera-indica', 'mimusops-zeyheri',
  'moringa-oleifera', 'musa-acuminata-aaa-group', 'pappea-capensis', 'passiflora-edulis',
  'persea-americana', 'phoenix-reclinata', 'physalis-peruviana', 'prunus-persica', 'prunus-salicina',
  'psidium-guajava', 'punica-granatum', 'rhoicissus-tomentosa', 'rubus-idaeus',
  'sclerocarya-birrea-subsp-caffra', 'strychnos-spinosa', 'syzygium-cordatum', 'vaccinium-corymbosum',
  'vangueria-infausta', 'vitis-vinifera',
] as const;

/** Species whose painted PNG has landed in public/fruit-art/ (replaces the placeholder SVG). */
export const FRUIT_ART_PNG: ReadonlySet<string> = new Set<string>([
  'carica-papaya',
  'carissa-macrocarpa',
  'carpobrotus-edulis',
  'carya-illinoinensis',
  'citrus-limon',
  'citrus-reticulata',
  'dovyalis-afra',
  'englerophytum-magalismontanum',
  'ficus-carica',
  'fragaria-x-ananassa',
  'garcinia-livingstonei',
  'grewia-occidentalis',
  'harpephyllum-caffrum',
  'litchi-chinensis',
  'macadamia-integrifolia',
  'mangifera-indica',
  'mimusops-zeyheri',
  'moringa-oleifera',
  'musa-acuminata-aaa-group',
  'pappea-capensis',
  'passiflora-edulis',
  'persea-americana',
  'phoenix-reclinata',
  'physalis-peruviana',
  'prunus-persica',
  'prunus-salicina',
  'psidium-guajava',
  'punica-granatum',
  'rhoicissus-tomentosa',
  'rubus-idaeus',
  'sclerocarya-birrea-subsp-caffra',
  'strychnos-spinosa',
  'syzygium-cordatum',
  'vaccinium-corymbosum',
  'vangueria-infausta',
  'vitis-vinifera',
]);

export function speciesFruitArtworkUrl(speciesId?: string | null): string | null {
  if (!speciesId || !(FRUIT_ART_SPECIES as readonly string[]).includes(speciesId)) return null;
  return `${FRUIT_ART_ROOT}/${speciesId}.${FRUIT_ART_PNG.has(speciesId) ? 'png' : 'svg'}`;
}
