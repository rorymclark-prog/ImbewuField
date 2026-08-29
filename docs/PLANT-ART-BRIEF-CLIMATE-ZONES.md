# Plant art — the rest of South Africa's climate zones

**Two views per species: a front view for the picker, a top-down crown for the map.**

Rory: *"create a whole lot of new plants/trees/shrubs etc for the map — we have done everything
or a lot for KZN subtropical, now we need to do the rest of the climate zones, apricots cherries
etc etc, and the indigenous fruit and berries for those areas. Top down for the map area and
front view for the picker."*

---

## Why this batch exists

`lib/species-catalog.ts` already carries **197 species across all nine SA biomes**, each with its
botanical name, stratum, crown form, mature height and width, and a ranked biome list. The data is
not the gap. The **art** is.

Of those 197, **119 are food-bearing**, and only **26** have a picker illustration
(`lib/design-elements.ts` → `art:`). Everything with art today is subtropical/KZN — mango,
litchi, avocado, macadamia, pawpaw, banana, marula, waterberry — plus a thin temperate handful
(apple, pear, plum, peach, fig, pomegranate, olive).

So a farmer in the **Succulent Karoo** opening the planting picker sees mango and litchi. A farmer
on the **Highveld grassland** sees no cherry, no pecan, no mulberry. A farmer in the **Nama Karoo**
sees no quince, no pistachio, and none of the six indigenous fruits the catalogue already knows
grow there. The app has the knowledge and cannot draw it.

**52 species need art.** They are listed in full below, straight from the catalogue, so nothing is
invented: every id, botanical name, crown form, size and biome list here is copied from
`lib/species-catalog.ts`.

---

## Two deliverables per species — they are NOT the same picture

### A. Front view → `public/element-art/tree_<id>.png`

What a farmer taps in the planting picker. Drawn at **24–92 px** in the app.

- **1024×1024 PNG, RGBA, genuine alpha.** All four corners alpha 0.
- **Never export a "transparent preview" with the grey-and-white checkerboard baked into the
  pixels.** This has shipped before: the file declared an alpha channel and was filled 255
  everywhere, and it painted an opaque square across the card. A PNG header check cannot catch
  it — decode the pixels and confirm. `tests/element-art.test.ts` checks the four corners and
  that >5% of pixels are clear.
- **Side elevation on a shared ground line**, whole plant in frame, trunk visible below the crown
  (except for the ground-skirted shrubs — cross-berry, num-num relatives, kuni bush — where
  foliage genuinely reaches the soil).
- **Size the plant against its own mature height**, using the `H×W m` column. A 18 m pecan must
  draw taller than a 4 m quince. The family being monotonic in drawn height is guarded by a test.
- Fruit clearly visible and in its true colour — at 24 px the fruit is the only identity left.

### B. Top-down crown → `public/render-assets/reference-blueprint/<slug>-v1.png`

Composited onto the plan with `ctx.drawImage` and **clipped to the tree's circular footprint —
the PNG's own alpha IS the silhouette.** Nothing else masks it.

- **1024×1024 PNG, RGBA, genuine alpha.** Corners alpha 0.
- **NO GROUND, AT ALL.** No mulch ring, no soil, no basin, no bare earth, no drop shadow, no
  ground plane. The app paints its own ground underneath; any soil in the art is drawn twice.
  This is the exact defect that sank the first canopy set — its outer band measured **56–70%
  brown pixels**, and every tree on the plan read as a dug basin wider than the tree.
- **Foliage must reach at least 97% of the crown radius.** The crown is a circle inscribed in the
  square, touching the frame at the four midpoints. No clear margin, no vignette — the app clips
  to a circle and anything short of the edge leaves paper showing. The edge should be irregular
  and leafy, not a clean vector circle, but its extremes must touch the frame.
- **Strict orthographic overhead.** No perspective, no three-quarter tilt, no horizon. Soft even
  diffuse daylight, gentle self-shading within the crown only, no cast shadows.
- Nothing else in frame: no text, labels, scale bars, borders, circles, watermarks, background.

---

## Colour is the identity — spread it deliberately

The first canopy set failed on this too: measured across seven canopies, foliage hue spanned
**17.5°** (74–91° HSV) and value spanned 16%. Every tree was a variant of the same yellow-green.

This batch spans **arid Karoo greys, fynbos blue-greens, deciduous orchard mid-greens and
autumn-turning mulberry** — that range is real, so use it. Target **≥70° of hue spread and ≥45%
of value spread** across the set, and report the measured hue/saturation/value table for the
delivered set the way `docs/PICKER-ART-BRIEF-TANKS.md` does.

Use the catalogue's own botany to drive it. A few that must NOT come out generic green:

| species | crown should read as |
|---|---|
| Shepherd's tree (*Boscia albitrunca*) | grey-green crown over a **stark white trunk** — the trunk is the name |
| Gariep ebony (*Euclea pseudebenus*) | dark, weeping, near blue-black foliage |
| Bluebush (*Diospyros lycioides*) | glaucous blue-grey |
| Almond / apricot / cherry | pale silvery-green, open deciduous crowns |
| Black mulberry | deep saturated green, **autumn yellow acceptable as a second read** |
| Sour fig (*Carpobrotus edulis*) | fleshy grey-green **mat**, not a tree — top-down is a spreading mat |
| Date palm | radial frond star, unmistakable from above |
| Pecan | very large, dense, deep green — it is the biggest thing in this set at 18 m |
| Carob | dark glossy green, dense dome |
| Quince | grey-felted leaves, loose multi-stem |

---

## Style — one treatment across the whole set

Hand-painted botanical plate, the look of a printed permaculture design document. Not a
photograph, not a flat vector icon. Visible individual leaves with painted edges, layered depth,
radiating branch structure showing where the crown is open.

**Every asset in the set shares one treatment**: same brush character, same leaf-edge weight, same
light, same level of detail. Species read apart by **colour, leaf shape and crown density** —
never by one being glossier or more finished than its neighbour. The new files sit beside the
existing 26 on the same screen, so match those too.

**It has to survive downscaling.** ~460 px on a printed sheet, as small as 24 px in the picker. At
that size only three things survive: overall colour, crown density, and fruit colour.

---

## File size

As delivered, the first batch was 1024×1024 at ~1.3 MB each — 78 MB for a library the app draws at
24–92 px. **Downsize the picker set to 192 px** on delivery; the top-down set stays larger (it is
drawn at ~460 px on print sheets) but should not exceed ~250 KB per file. A per-file budget test
guards this.

---

## Self-check before delivery — do not skip

For every file, decode the pixels and confirm:

1. 1024×1024 (or 192×192 for the downsized picker set), RGBA.
2. All four corners alpha 0.
3. Transparent fraction between 10% and 85% — outside that band it is either a flattened
   background or an empty frame.
4. **Top-down only:** painted alpha reaches ≥97% of the radius in at least 8 of 16 sampled
   directions, and the outer 75–100% annulus is **<10% brown** (hue 20–45°, sat >0.25).
5. **Front view only:** the widest painted row is in the upper 65% of the frame (a crown over a
   trunk), except for the ground-skirted shrubs noted above.

Report the results as a table. A delivery that breaks any hard rule is rejected — that is cheaper
for everyone than finding it on a farmer's plan.

---

## Scope split

**Codex generates and self-checks the art.** Wiring is Claude's job and is deliberately NOT in
this brief: the new `DesignElementDef` entries in `lib/design-elements.ts`, the
`ReferenceFeatureArtwork` union and `referenceFeatureArtworkFor()` mapping in
`lib/reference-feature-art.ts`, `lib/plant-codes.ts` two-letter codes, and the
`lib/planting-cartography.ts` legend sections all follow once the files exist. Same split as
`docs/ELEMENT-ART-BRIEF-2.md`.

Deliver into the two directories above using the ids in the table. Do not edit any `.ts` file.

---

> **Two things the catalogue does NOT resolve for you, resolved here.**
> `Salvia rosmarinus` appears as two catalogue rows (Succulent Karoo and Fynbos). It is one plant
> in two biomes and gets **one** asset. `Lycium ferocissimum` and `Lycium cinereum` share the
> Afrikaans common name *kriedoring* but are two different species, so they get **two** ids —
> `tree_cape_boxthorn` and `tree_honey_thorn`. A naive slug off the common name collides on both,
> which is how the count was briefly wrong at 53.

## The set — 52 species


## Exotic fruit & nuts  (11)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_almond` | Almond | *Prunus dulcis* | sub-canopy | spreading | 5×5 | SUCCULENT_KAROO, FYNBOS |
| `tree_apricot` | Apricot | *Prunus armeniaca* | sub-canopy | rounded | 4.5×4.5 | SUCCULENT_KAROO |
| `tree_arabica_coffee` | Arabica coffee | *Coffea arabica* | shrub | rounded | 3×2.5 | IOCB, FOREST |
| `tree_banana_dwarf_cavendish_williams` | Banana ('Dwarf Cavendish', 'Williams') | *Musa acuminata (AAA Group)* | sub-canopy | upright | 4×3 | IOCB, FOREST |
| `tree_black_mulberry` | Black mulberry | *Morus nigra* | sub-canopy | rounded | 8×8 | ALBANY_THICKET, GRASSLAND |
| `tree_carob` | Carob | *Ceratonia siliqua* | canopy | rounded | 8×8 | SUCCULENT_KAROO, FYNBOS |
| `tree_date_palm` | Date palm | *Phoenix dactylifera* | canopy | palm | 15×8 | DESERT |
| `tree_pecan` | Pecan / pekanneut | *Carya illinoinensis* | canopy | spreading | 18×15 | NAMA_KAROO, GRASSLAND |
| `tree_pistachio` | Pistachio / pistakieneut | *Pistacia vera* | sub-canopy | rounded | 7×6 | NAMA_KAROO |
| `tree_quince` | Quince / kweper | *Cydonia oblonga* | shrub | multi-stem | 4×4 | NAMA_KAROO, SUCCULENT_KAROO |
| `tree_sweet_cherry` | Sweet cherry | *Prunus avium* | sub-canopy | upright | 5×4 | GRASSLAND |

## Indigenous fruit  (15)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_bluebush` | Bluebush / bloubos | *Diospyros lycioides* | shrub | rounded | 4×3 | NAMA_KAROO, SUCCULENT_KAROO, GRASSLAND |
| `tree_brown_ivory_motsintsila` | Brown ivory (motsintsila) | *Berchemia discolor* | canopy | rounded | 12×10 | SAVANNA |
| `tree_coastal_red_milkwood` | Coastal red milkwood | *Mimusops afra* | sub-canopy | rounded | 10×8 | IOCB |
| `tree_cross_berry` | Cross-berry | *Grewia occidentalis* | shrub | sprawling | 3×3 | ALBANY_THICKET, SAVANNA, IOCB, GRASSLAND, FOREST |
| `tree_gariep_ebony` | Gariep ebony / ebbehout | *Euclea pseudebenus* | sub-canopy | weeping | 7×6 | DESERT |
| `tree_glossy_currant` | Glossy currant / blinktaaibos | *Searsia lucida* | shrub | rounded | 3×4 | FYNBOS |
| `tree_karoo_crossberry` | Karoo crossberry / kruisbessie | *Grewia robusta* | shrub | multi-stem | 3×2.5 | NAMA_KAROO, SUCCULENT_KAROO |
| `tree_kuni_bush` | Kuni bush / koeniebos | *Searsia undulata* | shrub | multi-stem | 3×3 | SUCCULENT_KAROO |
| `tree_puzzle_bush` | Puzzle bush / deurmekaarbos | *Ehretia rigida* | shrub | multi-stem | 4×3.5 | NAMA_KAROO, SAVANNA, GRASSLAND |
| `tree_red_milkwood_moepel` | Red milkwood (moepel) | *Mimusops zeyheri* | canopy | rounded | 10×10 | SAVANNA, FOREST |
| `tree_shepherd_s_tree` | Shepherd's tree / witgat | *Boscia albitrunca* | sub-canopy | rounded | 7×6 | NAMA_KAROO, DESERT |
| `tree_small_leaved_guarri` | Small-leaved guarri | *Euclea undulata* | sub-canopy | rounded | 5×5 | ALBANY_THICKET, NAMA_KAROO, SUCCULENT_KAROO |
| `tree_waterblommetjie` | Waterblommetjie / Cape pondweed | *Aponogeton distachyos* | herb | sprawling | 0.3×0.6 | FYNBOS |
| `tree_wild_date_palm` | Wild date palm / isuNdu | *Phoenix reclinata* | sub-canopy | palm | 6×5 | IOCB |
| `tree_wild_medlar_mmilo` | Wild medlar (mmilo) | *Vangueria infausta* | sub-canopy | multi-stem | 6×4 | SAVANNA |

## Shrubs  (6)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_bietou` | Bietou / bush-tick berry | *Osteospermum moniliferum* | shrub | sprawling | 2×2 | ALBANY_THICKET |
| `tree_brandybush` | Brandybush / velvet raisin | *Grewia flava* | shrub | multi-stem | 3×2.5 | SAVANNA |
| `tree_honeybush` | Honeybush / heuningbos | *Cyclopia genistoides* | shrub | rounded | 1×1 | FYNBOS |
| `tree_rooibos` | Rooibos | *Aspalathus linearis* | shrub | upright | 1.5×1.5 | FYNBOS |
| `tree_rosemary` | Rosemary | *Salvia rosmarinus (= Rosmarinus officinalis)* | shrub | rounded | 1.2×1.2 | SUCCULENT_KAROO, FYNBOS |

## Small trees & large shrubs  (8)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_dogwood` | Dogwood / umglindi | *Rhamnus prinoides* | shrub | rounded | 4×3 | FOREST |
| `tree_cape_boxthorn` | Kriedoring / Cape boxthorn | *Lycium ferocissimum* | shrub | multi-stem | 3×3 | SUCCULENT_KAROO |
| `tree_honey_thorn` | Kriedoring / honey-thorn | *Lycium cinereum* | shrub | rounded | 2.5×2.5 | DESERT |
| `tree_natal_currant` | Natal currant | *Searsia natalensis* | shrub | sprawling | 5×4 | IOCB |
| `tree_pigeon_pea` | Pigeon pea | *Cajanus cajan* | shrub | upright | 2.5×2 | ALBANY_THICKET, SAVANNA, IOCB, FOREST |
| `tree_quiver_tree` | Quiver tree / kokerboom | *Aloidendron dichotomum* | sub-canopy | rounded | 6×4 | DESERT |
| `tree_spekboom` | Spekboom | *Portulacaria afra* | shrub | sprawling | 3×3 | ALBANY_THICKET, NAMA_KAROO, SAVANNA, SUCCULENT_KAROO |
| `tree_waxberry` | Waxberry / wasbessie | *Morella cordifolia* | shrub | spreading | 2.5×3 | FYNBOS |

## Climbers  (7)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_baboon_grape` | Baboon grape | *Rhoicissus digitata* | climber | sprawling | 8×3 | ALBANY_THICKET |
| `tree_bushman_s_grape` | Bushman's grape | *Rhoicissus tridentata* | climber | sprawling | 3×1.5 | SAVANNA, GRASSLAND |
| `tree_common_wild_grape` | Common wild grape / bosdruif | *Rhoicissus tomentosa* | climber | sprawling | 10×3 | ALBANY_THICKET, FYNBOS, FOREST |
| `tree_grape_vine` | Grape vine / wingerd | *Vitis vinifera* | climber | sprawling | 2×3 | NAMA_KAROO, SUCCULENT_KAROO, GRASSLAND, DESERT, FYNBOS |
| `tree_lablab` | Lablab / dolichos bean | *Lablab purpureus* | climber | sprawling | 3×2 | SAVANNA, IOCB |
| `tree_malabar_spinach` | Malabar spinach | *Basella alba* | climber | sprawling | 3×2 | IOCB |
| `tree_purple_granadilla` | Purple granadilla / passion fruit | *Passiflora edulis* | climber | sprawling | 4×3 | FOREST |

## Medium trees  (4)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_buffalo_thorn` | Buffalo thorn | *Ziziphus mucronata* | sub-canopy | spreading | 8×7 | ALBANY_THICKET, NAMA_KAROO, SAVANNA, GRASSLAND, DESERT |
| `tree_karoo_boer_bean` | Karoo boer-bean | *Schotia afra var. afra* | sub-canopy | rounded | 5×5 | ALBANY_THICKET, NAMA_KAROO, SUCCULENT_KAROO |
| `tree_pigeonwood` | Pigeonwood / umbengele | *Trema orientalis* | sub-canopy | spreading | 10×8 | FOREST |
| `tree_powder_puff_tree` | Powder-puff tree / iBoqo | *Barringtonia racemosa* | sub-canopy | rounded | 8×6 | IOCB |

## Large trees  (2)

| suggested id | common name | botanical | stratum | crown | H×W m | biomes |
|---|---|---|---|---|---|---|
| `tree_karee` | Karee | *Searsia lancea (= Rhus lancea)* | canopy | rounded | 8×7 | NAMA_KAROO |
| `tree_white_milkwood` | White milkwood | *Sideroxylon inerme* | canopy | rounded | 12×10 | ALBANY_THICKET, FYNBOS |
