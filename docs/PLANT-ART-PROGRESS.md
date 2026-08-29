# Climate-zone plant-art progress

Authoritative recovery ledger for `codex/climate-zone-plant-art`.

- Last full checker inventory: 2026-08-29
- Checker: `/Users/roryclark/ImbewuField/scripts/check-plant-art.py`
- Required scope: 53 species, 106 views
- Current result: 103 PASS, 3 FAIL, 0 MISSING, 0 IN PROGRESS
- Dimension audit is stricter than the checker's `square` rule: every top-down file must be exactly 1024×1024.
- A top-down `FAIL` below passes the repository checker but fails the brief's authoritative
  16-direction reach gate (`alpha > 32`, at least 8 of 16 exact rays reaching 97% radius).
- A row is complete only when both views are `PASS` and their SHAs name pushed commits.

| Species | Front | Front path | Front SHA | Top-down | Top-down path | Top SHA |
|---|---:|---|---|---:|---|---|
| Almond | PASS | `public/element-art/tree_almond.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/almond-tree-v1.png` | `64d7a8a` |
| Apricot | PASS | `public/element-art/tree_apricot.png` | `64d7a8a` | PASS | `public/render-assets/reference-blueprint/apricot-tree-v1.png` | `64d7a8a` |
| Arabica coffee | PASS | `public/element-art/tree_arabica_coffee.png` | `64d7a8a` | PASS | `public/render-assets/reference-blueprint/arabica-coffee-tree-v1.png` | `64d7a8a` |
| Dwarf Cavendish/Williams banana | PASS | `public/element-art/tree_banana_dwarf_cavendish_williams.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/banana-dwarf-cavendish-williams-v1.png` | `6402fc6` |
| Black mulberry | PASS | `public/element-art/tree_black_mulberry.png` | `64d7a8a` | PASS | `public/render-assets/reference-blueprint/black-mulberry-tree-v1.png` | `64d7a8a` |
| Carob | PASS | `public/element-art/tree_carob.png` | `64d7a8a` | PASS | `public/render-assets/reference-blueprint/carob-tree-v1.png` | `64d7a8a` |
| Date palm | PASS | `public/element-art/tree_date_palm.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/date-palm-v1.png` | `dc420c0` |
| Pecan | PASS | `public/element-art/tree_pecan.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/pecan-tree-v1.png` | `64d7a8a` |
| Pistachio | PASS | `public/element-art/tree_pistachio.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/pistachio-tree-v1.png` | `64d7a8a` |
| Quince | PASS | `public/element-art/tree_quince.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/quince-tree-v1.png` | `84253b2` |
| Sweet cherry | PASS | `public/element-art/tree_sweet_cherry.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/sweet-cherry-tree-v1.png` | `64d7a8a` |
| Bluebush | PASS | `public/element-art/tree_bluebush.png` | `72e0bbb` | PASS | `public/render-assets/reference-blueprint/bluebush-v1.png` | `8489f3e` |
| Brown ivory / motsintsila | PASS | `public/element-art/tree_brown_ivory_motsintsila.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/brown-ivory-tree-v1.png` | `b366a42` |
| Coastal red milkwood | PASS | `public/element-art/tree_coastal_red_milkwood.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/coastal-red-milkwood-tree-v1.png` | `f30def8` |
| Cross-berry | PASS | `public/element-art/tree_cross_berry.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/cross-berry-v1.png` | `5f1eeb0` |
| Gariep ebony | PASS | `public/element-art/tree_gariep_ebony.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/gariep-ebony-tree-v1.png` | `449f597` |
| Glossy currant | PASS | `public/element-art/tree_glossy_currant.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/glossy-currant-v1.png` | `1e01f01` |
| Karoo crossberry | PASS | `public/element-art/tree_karoo_crossberry.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/karoo-crossberry-v1.png` | `2491a1e` |
| Kuni bush | PASS | `public/element-art/tree_kuni_bush.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/kuni-bush-v1.png` | `52c733b` |
| Puzzle bush | PASS | `public/element-art/tree_puzzle_bush.png` | `9596647` | PASS | `public/render-assets/reference-blueprint/puzzle-bush-v1.png` | `6c6a692` |
| Red milkwood / moepel | PASS | `public/element-art/tree_red_milkwood_moepel.png` | `c1f4f37` | PASS | `public/render-assets/reference-blueprint/red-milkwood-tree-v1.png` | `353a7d0` |
| Shepherd's tree | PASS | `public/element-art/tree_shepherd_s_tree.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/shepherds-tree-v1.png` | `75b461b` |
| Small-leaved guarri | PASS | `public/element-art/tree_small_leaved_guarri.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/small-leaved-guarri-v1.png` | `98808c9` |
| Waterblommetjie | PASS | `public/element-art/tree_waterblommetjie.png` | `c1f4f37` | PASS | `public/render-assets/reference-blueprint/waterblommetjie-v1.png` | `9bc6a2b` |
| Wild date palm | PASS | `public/element-art/tree_wild_date_palm.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/wild-date-palm-v1.png` | `64aa601` |
| Wild medlar / mmilo | PASS | `public/element-art/tree_wild_medlar_mmilo.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/wild-medlar-v1.png` | `bbba3bc` |
| Bietou / bush-tick berry | PASS | `public/element-art/tree_bietou.png` | `017067c` | PASS | `public/render-assets/reference-blueprint/bietou-v1.png` | `b67a5dd` |
| Brandybush / velvet raisin | PASS | `public/element-art/tree_brandybush.png` | `202ccec` | PASS | `public/render-assets/reference-blueprint/brandybush-v1.png` | `303c6f9` |
| Honeybush / heuningbos | PASS | `public/element-art/tree_honeybush.png` | `d21827f` | PASS | `public/render-assets/reference-blueprint/honeybush-v1.png` | `33d19ba` |
| Rooibos | PASS | `public/element-art/tree_rooibos.png` | `1ecd8f2` | PASS | `public/render-assets/reference-blueprint/rooibos-v1.png` | `9297a1d` |
| Rosemary | PASS | `public/element-art/tree_rosemary.png` | `1ecd8f2` | PASS | `public/render-assets/reference-blueprint/rosemary-v1.png` | `59e6948` |
| Dogwood / umglindi | PASS | `public/element-art/tree_dogwood.png` | `9596647` | PASS | `public/render-assets/reference-blueprint/dogwood-v1.png` | `a30f1c5` |
| Cape boxthorn / kriedoring | PASS | `public/element-art/tree_cape_boxthorn.png` | `df1b4ac` | PASS | `public/render-assets/reference-blueprint/cape-boxthorn-v1.png` | `002979c` |
| Honey-thorn / kriedoring | PASS | `public/element-art/tree_honey_thorn.png` | `5337360` | PASS | `public/render-assets/reference-blueprint/honey-thorn-v1.png` | `5c630cd` |
| Natal currant | PASS | `public/element-art/tree_natal_currant.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/natal-currant-v1.png` | `4d55148` |
| Pigeon pea | PASS | `public/element-art/tree_pigeon_pea.png` | `cd97a95` | PASS | `public/render-assets/reference-blueprint/pigeon-pea-v1.png` | `304e10d` |
| Quiver tree / kokerboom | PASS | `public/element-art/tree_quiver_tree.png` | `b93e78d` | PASS | `public/render-assets/reference-blueprint/quiver-tree-v1.png` | `566b691` |
| Spekboom | PASS | `public/element-art/tree_spekboom.png` | `355d170` | PASS | `public/render-assets/reference-blueprint/spekboom-v1.png` | `c207b8b` |
| Waxberry / wasbessie | PASS | `public/element-art/tree_waxberry.png` | `c1f4f37` | PASS | `public/render-assets/reference-blueprint/waxberry-v1.png` | `f65b3f8` |
| Baboon grape | PASS | `public/element-art/tree_baboon_grape.png` | `8db4efe` | FAIL | `public/render-assets/reference-blueprint/baboon-grape-v1.png` | `e84f7a2` |
| Bushman's grape | PASS | `public/element-art/tree_bushman_s_grape.png` | `8db4efe` | PASS | `public/render-assets/reference-blueprint/bushmans-grape-v1.png` | `e4b759b` |
| Common wild grape / bosdruif | PASS | `public/element-art/tree_common_wild_grape.png` | `9596647` | PASS | `public/render-assets/reference-blueprint/common-wild-grape-v1.png` | `b983f99` |
| Grape vine / wingerd | PASS | `public/element-art/tree_grape_vine.png` | `8db4efe` | PASS | `public/render-assets/reference-blueprint/grape-vine-v1.png` | `0c85a6a` |
| Lablab / dolichos bean | PASS | `public/element-art/tree_lablab.png` | `8db4efe` | PASS | `public/render-assets/reference-blueprint/lablab-v1.png` | `3713b04` |
| Malabar spinach | PASS | `public/element-art/tree_malabar_spinach.png` | `8db4efe` | PASS | `public/render-assets/reference-blueprint/malabar-spinach-v1.png` | `4a8739b` |
| Purple granadilla / passion fruit | PASS | `public/element-art/tree_purple_granadilla.png` | `8db4efe` | PASS | `public/render-assets/reference-blueprint/purple-granadilla-v1.png` | `fba826b` |
| Buffalo thorn | PASS | `public/element-art/tree_buffalo_thorn.png` | `d21827f` | PASS | `public/render-assets/reference-blueprint/buffalo-thorn-v1.png` | `9573aca` |
| Karoo boer-bean | PASS | `public/element-art/tree_karoo_boer_bean.png` | `018d9e2` | PASS | `public/render-assets/reference-blueprint/karoo-boer-bean-v1.png` | `6b2c24f` |
| Pigeonwood / umbengele | PASS | `public/element-art/tree_pigeonwood.png` | `018d9e2` | PASS | `public/render-assets/reference-blueprint/pigeonwood-v1.png` | `473be5f` |
| Powder-puff tree / iBoqo | PASS | `public/element-art/tree_powder_puff_tree.png` | `1ecd8f2` | PASS | `public/render-assets/reference-blueprint/powder-puff-tree-v1.png` | `42810ac` |
| Karee | PASS | `public/element-art/tree_karee.png` | `d21827f` | FAIL | `public/render-assets/reference-blueprint/karee-v1.png` | `b740cab` |
| White milkwood | PASS | `public/element-art/tree_white_milkwood.png` | `1ecd8f2` | PASS | `public/render-assets/reference-blueprint/white-milkwood-v1.png` | `ae48dbd` |
| Olive | PASS | `public/element-art/tree_olive.png` | `018d9e2` | FAIL | `public/render-assets/reference-blueprint/olive-v1.png` | `e4e6f2e` |

## Resume protocol

1. Read this file and `docs/PLANT-ART-BRIEF-CLIMATE-ZONES.md`.
2. Re-run the checker for the current `FAIL` or create the current `MISSING` file.
3. Work on one asset only; never advance while it fails.
4. Visually inspect every pass, then update this row and the summary counts.
5. Commit the image and this ledger immediately; push every two or three passes.
6. Do not commit `.DS_Store`, rejected generations, `.ts`, `.tsx`, or `PLAN_VERSION` changes.
