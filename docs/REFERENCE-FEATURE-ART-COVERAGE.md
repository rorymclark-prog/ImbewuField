# Reference Feature Art Coverage

Coverage of every `ELEMENT_CATALOG` ID in `lib/design-elements.ts` against the
painted archetypes in `lib/reference-feature-art.ts`. A fallback means the exact
catalog footprint, deterministic shape, icon, and label remain authoritative; it
does not borrow a painted object from another family.

| Disposition | Catalog element IDs | Reference art / decision |
|---|---|---|
| Existing painted archetype | `jojo_1000`, `jojo_2500`, `jojo_5000`, `jojo_10000` | `jojo-tank-v1.png` |
| Existing painted archetype | `banana_circle` | `banana-basin-v1.png` |
| Existing painted archetype | `tree_citrus`, `tree_mango`, `tree_avocado`, `tree_macadamia`, `tree_guava`, `tree_litchi`, `tree_indigenous`, `tree_apple`, `tree_pear`, `tree_plum`, `tree_peach`, `tree_fig`, `tree_pomegranate`, `tree_olive` | `orchard-canopy-v1.png` |
| Existing painted archetype | `veg_bed`, `raised_bed` | `production-bed-v1.png` |
| Existing painted archetype | `pollinator_strip` | `pollinator-strip-v1.png` |
| Existing painted archetype | `vetiver_row`, `mulch_bank` | `vetiver-bank-v1.png` |
| Existing painted archetype | `compost_bay` | `compost-bay-v1.png` |
| Existing painted archetype | `beehive` | `beehive-v1.png` |
| Existing painted archetype | `chicken_tractor` | `chicken-tractor-v1.png` |
| Existing painted archetype | `nursery_table` | `nursery-table-v1.png` |
| Existing painted archetype | `shade_house` | `shade-house-v1.png` |
| Existing painted archetype | `gate` | `driveway-gate-v1.png` |
| Existing painted archetype | `pond_small` | `pond-small-v1.png` |
| Existing painted archetype | `greywater_basin` | `greywater-basin-v1.png` |
| Existing painted archetype | `tree_basin` | `tree-basin-v1.png` (empty basin; no invented tree) |
| Existing painted archetype | `tap_point` | `tap-point-v1.png` |
| Existing painted archetype | `pump_filter` | `pump-filter-v1.png` |
| Existing painted archetype | `greywater_diverter` | `greywater-diverter-v1.png` |
| Existing painted archetype | `banana_clump` | `banana-clump-v1.png` (no invented basin) |
| Existing painted archetype | `tree_pawpaw` | `pawpaw-tree-v1.png` |
| Existing painted archetype | `tree_moringa` | `moringa-tree-v1.png` |
| Existing painted archetype | `keyhole_bed` | `keyhole-bed-v1.png` |
| Existing painted archetype | `herb_spiral` | `herb-spiral-v1.png` |
| Existing painted archetype | `spekboom_hedge` | `spekboom-hedge-v1.png` |
| Safe deterministic fallback | `infiltration_basin`, `half_moon`, `berm`, `terrace`, `other_water`, `other_planting`, `other_structure` | Keep the measured footprint and catalog-specific geometry/label. No tree, pond, basin, or unrelated bank artwork is substituted. |
| Safe deterministic fallback | `bench`, `sign`, `washline`, `shade_sail`, `solar_panel_ground` | Use the existing exact symbol/footprint treatment; a generic structure image would misstate the object. |
| Genuinely new asset needed | `rain_barrel`, `dam`, `borehole`, `water_trough`, `first_flush`, `greywater_outlet`, `water_trough2`, `biodigester` | Distinct water or sanitation hardware; no current painted archetype is physically equivalent. |
| Genuinely new asset needed | `shed`, `greenhouse_tunnel`, `chicken_coop`, `kraal`, `worm_farm`, `market_stall` | Distinct built or working structures; do not map them to another structure merely because its footprint is similar. |
| Genuinely new asset needed | `goat_pen`, `pig_pen`, `duck_pond`, `rabbit_hutch` | Distinct animal facilities; `duck_pond` is not interchangeable with `pond_small` because the animal-use identity is part of the feature. |

The unmapped IDs must continue to return `null` from
`referenceFeatureArtworkFor`. Adding a new asset is warranted only when it can
show the named physical object without changing its footprint or implying a
different object.
