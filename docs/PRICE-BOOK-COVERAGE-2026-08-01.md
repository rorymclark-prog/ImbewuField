# Price-book coverage audit — 2026-08-01

Compared every non-deprecated and deprecated entry in `ELEMENT_CATALOG` with the direct
`costForItem(def.id, def.wM, def.hM)` lookup. The price book uses facilitator-type aliases (for
example `tank`, `tree`, and `bed`), so this is a catalog-id coverage audit, not a proposal to add
prices. No prices were invented or added.

The following 69 catalog ids have no direct price-book entry:

- Water: `jojo_1000`, `jojo_2500`, `jojo_5000`, `jojo_10000`, `rain_barrel`, `pond_small`, `dam`, `tap_point`, `water_trough`, `first_flush`, `pump_filter`, `greywater_outlet`, `greywater_diverter`, `other_water`
- Earthworks: `raised_bed`, `keyhole_bed`, `tree_basin`, `greywater_basin`, `infiltration_basin`, `half_moon`, `berm`, `terrace`
- Growing: `mulch_bank`, `tree_citrus`, `tree_mango`, `tree_avocado`, `tree_macadamia`, `tree_guava`, `tree_litchi`, `tree_pawpaw`, `tree_moringa`, `tree_natal_plum`, `tree_wild_plum`, `tree_waterberry`, `tree_other`, `banana_clump`, `tree_indigenous`, `tree_apple`, `tree_pear`, `tree_plum`, `tree_peach`, `tree_fig`, `tree_pomegranate`, `tree_olive`, `other_planting`, `pollinator_strip`, `spekboom_hedge`, `vetiver_row`
- Structures/access: `greenhouse_tunnel`, `shade_house`, `chicken_tractor`, `kraal`, `worm_farm`, `nursery_table`, `playground`, `market_stall`, `gate`, `bench`, `sign`, `solar_panel_ground`, `washline`
- Animals: `goat_pen`, `pig_pen`, `duck_pond`, `rabbit_hutch`, `water_trough2`
- Other: `biodigester`, `shade_sail`

Existing alias coverage remains available for facilitator entries such as `tank`, `tree`, `bed`,
`pond`, `borehole`, and `compost`; those aliases do not make the direct Design Studio ids above
priced.

Silent-zero check: `costForItem`, `costForLine`, and `costForAreaLine` return `null` for unknown
keys, and the rendered BOQ displays an em dash for an unpriced row rather than `R0`. The
FacilitatorCanvas accumulator uses null-coalescing only when summing a displayed estimate, so an
unpriced line is omitted from the total rather than printed as a free item. No failing-test-first
fix was warranted and no price-book code was changed.
