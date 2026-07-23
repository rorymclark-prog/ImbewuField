# Hybrid Asset Visual QA

Bounded review of the committed reusable artwork registry and deterministic cartography against benchmark sheets 03, 04, and 05 in `Carl_and_Sandys_Place_Permaculture_Design_Map_Set` (all three: 1595 x 986 px). This sidecar does not change saved geometry or feature identity.

## Exact Reusable Artwork Mapping

Source of truth: `lib/reference-feature-art.ts`. The same artwork may appear on more than one sheet when the feature is factually integrated.

### Water / Sheet 03

- `jojo_1000`, `jojo_2500`, `jojo_5000`, `jojo_10000` -> `jojo-tank-v1.png`
- `pond_small` -> `pond-small-v1.png`
- `greywater_basin` -> `greywater-basin-v1.png`
- `tree_basin` -> `tree-basin-v1.png`
- `banana_circle` -> `banana-basin-v1.png`
- `tap_point` -> `tap-point-v1.png`
- `pump_filter` -> `pump-filter-v1.png`
- `greywater_diverter` -> `greywater-diverter-v1.png`

### Planting / Sheet 04

- `veg_bed`, `raised_bed` -> `production-bed-v1.png`
- `banana_circle` -> `banana-basin-v1.png`
- `tree_citrus`, `tree_mango`, `tree_avocado`, `tree_macadamia`, `tree_guava`, `tree_litchi`, `tree_indigenous`, `tree_apple`, `tree_pear`, `tree_plum`, `tree_peach`, `tree_fig`, `tree_pomegranate`, `tree_olive` -> `orchard-canopy-v1.png`
- `banana_clump` -> `banana-clump-v1.png`
- `tree_pawpaw` -> `pawpaw-tree-v1.png`
- `tree_moringa` -> `moringa-tree-v1.png`
- `pollinator_strip` -> `pollinator-strip-v1.png`
- `vetiver_row`, `mulch_bank` -> `vetiver-bank-v1.png`
- `keyhole_bed` -> `keyhole-bed-v1.png`; `herb_spiral` -> `herb-spiral-v1.png`; `spekboom_hedge` -> `spekboom-hedge-v1.png`

### Structures / Sheet 05

- `compost_bay` -> `compost-bay-v1.png`
- `beehive` -> `beehive-v1.png`
- `chicken_tractor` -> `chicken-tractor-v1.png`
- `nursery_table` -> `nursery-table-v1.png`
- `shade_house` -> `shade-house-v1.png`
- `gate` -> `driveway-gate-v1.png`

## Missing Important Assets

These IDs have deterministic symbols or route treatment, but no reusable artwork in the registry. Keep the fallback explicit; do not borrow a visually similar asset without a factual decision.

- **Water:** `rain_barrel`, `first_flush`, `greywater_outlet`, `infiltration_basin`, `half_moon`, `berm`, `terrace`, `borehole`, `water_trough`, `water_trough2`. Benchmark 03 also names isolation/flush valves, a pressure regulator, rotation-valve manifold, and inspection/flush points; these are not reusable artwork IDs.
- **Planting:** no exact reusable asset exists for sweet-potato groundcover or an independently named support-species/groundcover feature in the benchmark. Crop-plan entries such as `sweet-potato` are not design-element IDs and must not be rendered as feature art.
- **Structures:** `chicken_coop`, `greenhouse_tunnel`, `shed`, `kraal`, `worm_farm`, `market_stall`, `goat_pen`, `pig_pen`, `biodigester`, `shade_sail`, `bench`, `sign`, `solar_panel_ground`, and `washline` have no reusable artwork. Sheet 05 additionally depicts a feed/tool cabinet, bee-flight safety screen, and hand-wash point; `hand_wash_point` is explicitly absent from the structures visual registry.

## Scale / Readability Thresholds

- **Water:** `waterFeaturePresentationScale`: tanks/barrels `1.65x`; emphasized fittings `1.45x`; basins `1.20x`; ponds/dams `1.15x`. Point symbols get a minimum 10 px dimension, or `0.65%` of canvas width, before class scaling. Current route widths are `5.6` px swale, `6.2` px pipe, `4.2` px drip, `5.3` px greywater before renderer floors; renderer floors are approximately `0.23%` of canvas width for colored routes and `0.25%` for pipes.
- **Planting:** current multipliers are `1.28x` production beds, `1.18x` keyhole/herb, `1.16x` strips/hedges/banks, `1.20x` basins, `1.24x` banana clumps, and `1.30x` trees. No minimum pixel size is enforced here; QA must fail any placed artwork that becomes unreadable after sheet reduction.
- **Structures:** `structuresFeaturePresentationDimensions` enforces a short side of at least `max(22 px, 1.35% of canvas width)` and caps the long side at `5%` of canvas width. Preserve centre, aspect ratio, footprint, and rotation; scale is presentation-only.
- **Acceptance check:** review the final 1595 px sheet and a phone-sized reduction. A named feature must remain distinguishable from its nearest competing class, and labels/routes must not be the only evidence of a fitting whose symbol has disappeared.

## Factual Substitution Risks

- Do not use `tree-basin-v1.png`, `greywater-basin-v1.png`, or `banana-basin-v1.png` interchangeably: tree basin, planted greywater basin, and banana circle have different system meanings.
- `orchard-canopy-v1.png` is a mature, generic canopy. It is acceptable for the listed orchard IDs, but it is not species-specific and must not stand for `tree_pawpaw`, `tree_moringa`, or `banana_clump` when those exact IDs are available.
- `chicken_tractor` artwork must not be presented as a stationary `chicken_coop`; Sheet 05 explicitly distinguishes a mobile tractor from a night coop.
- A `shade-house-v1.png` or deterministic shade symbol must not imply `greenhouse_tunnel`; covered growing structures have different construction and climate implications.
- A tank, pump/filter, diverter, tap, valve, or regulator mark must not be inferred from a nearby blue route. Routes show connection, not a missing fitting.
- Generic or unknown IDs must remain fallback-only. The existing tests correctly require `null` for `infiltration_basin`, `chicken_coop`, `greenhouse_tunnel`, `other_planting`, and made-up IDs; preserve that non-invention rule.

## Verification

Focused mapping/cartography run: `161` tests passed, `0` failed. Relevant files: `lib/reference-feature-art.ts`, `lib/water-cartography.ts`, `lib/planting-cartography.ts`, `lib/structures-cartography.ts`, `tests/reference-feature-art.test.ts`, `tests/cartographic-symbols.test.ts`, `tests/planting-cartography.test.ts`, and `tests/structures-cartography.test.ts`.
