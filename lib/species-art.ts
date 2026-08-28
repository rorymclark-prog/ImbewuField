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
  'musa-acuminata-aaa-group': { picker: 'tree_banana_dwarf_cavendish_williams.png', plan: null },
  'morus-nigra': { picker: 'tree_black_mulberry.png', plan: 'black-mulberry-tree-v1.png' },
  'ceratonia-siliqua': { picker: 'tree_carob.png', plan: 'carob-tree-v1.png' },
  'phoenix-dactylifera': { picker: 'tree_date_palm.png', plan: 'date-palm-v1.png' },
  'carya-illinoinensis': { picker: 'tree_pecan.png', plan: 'pecan-tree-v1.png' },
  'pistacia-vera': { picker: 'tree_pistachio.png', plan: 'pistachio-tree-v1.png' },
  'cydonia-oblonga': { picker: 'tree_quince.png', plan: 'quince-tree-v1.png' },
  'prunus-avium': { picker: 'tree_sweet_cherry.png', plan: 'sweet-cherry-tree-v1.png' },
  'diospyros-lycioides': { picker: null, plan: 'bluebush-v1.png' },
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
  'cyclopia-genistoides': { picker: 'tree_honeybush.png', plan: null },
  'aspalathus-linearis': { picker: 'tree_rooibos.png', plan: null },
  'salvia-rosmarinus-rosmarinus-officinalis': { picker: 'tree_rosemary.png', plan: null },
  'salvia-rosmarinus': { picker: 'tree_rosemary.png', plan: null },
  'rhamnus-prinoides': { picker: null, plan: 'dogwood-v1.png' },
  'searsia-natalensis': { picker: 'tree_natal_currant.png', plan: 'natal-currant-v1.png' },
  'cajanus-cajan': { picker: null, plan: 'pigeon-pea-v1.png' },
  'aloidendron-dichotomum': { picker: 'tree_quiver_tree.png', plan: null },
  'portulacaria-afra': { picker: null, plan: 'spekboom-v1.png' },
  'morella-cordifolia': { picker: null, plan: 'waxberry-v1.png' },
  'rhoicissus-digitata': { picker: 'tree_baboon_grape.png', plan: null },
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
  'searsia-lancea': { picker: 'tree_karee.png', plan: null },
  'searsia-lancea-rhus-lancea': { picker: 'tree_karee.png', plan: null },
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
