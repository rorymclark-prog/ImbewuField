# Plant-art generation handover

**Last updated:** 2026-08-28

**Working branch:** `codex/climate-zone-plant-art`

**Clean worktree:** `/Users/roryclark/ImbewuField-climate-art`

This file exists because the original artwork chats crashed and were deleted. Future chats must
use the evidence recorded here and the committed output files. Do not reconstruct missing history
or infer a different style from branch names.

## Source of truth and scope

The exact source brief is committed beside this handover as
`docs/PLANT-ART-BRIEF-CLIMATE-ZONES.md`. It is a byte-for-byte copy of the previously untracked
brief from the original checkout (SHA-1 `475bf794d2a62bd91ff3d92ac74c6075d15dd2f7`) and lists 52
catalogue species that need two different views each:

1. Picker: `public/element-art/tree_<id>.png` — front/side elevation, delivered at 192×192.
2. Map: `public/render-assets/reference-blueprint/<slug>-v1.png` — strict top-down canopy,
   delivered at 1024×1024.

The order is:

- Exotic fruit and nuts: almond, apricot, Arabica coffee, dwarf Cavendish/Williams banana,
  black mulberry, carob, date palm, pecan, pistachio, quince, sweet cherry.
- Indigenous fruit: bluebush, brown ivory, coastal red milkwood, cross-berry, Gariep ebony,
  glossy currant, Karoo crossberry, kuni bush, puzzle bush, red milkwood, shepherd's tree,
  small-leaved guarri, waterblommetjie, wild date palm, wild medlar.
- Shrubs: bietou, brandybush, honeybush, rooibos, rosemary.
- Small trees and large shrubs: dogwood, Cape boxthorn, honey-thorn, Natal currant, pigeon pea,
  quiver tree, spekboom, waxberry.
- Climbers: baboon grape, Bushman's grape, common wild grape, grape vine, lablab, Malabar
  spinach, purple granadilla.
- Medium trees: buffalo thorn, Karoo boer-bean, pigeonwood, powder-puff tree.
- Large trees: karee, white milkwood.

Do not add or rename species. The ids, botanical identities, dimensions, forms and biome lists
come from the existing catalogue and source brief. Do not edit TypeScript while producing art;
wiring is a separate task.

## Tool that actually generates the pixels

### Codex model and reasoning level

Start future continuation chats with **`gpt-5.6-sol` at `xhigh` reasoning**. `high` is the
acceptable fallback when `xhigh` is unavailable. Do not use Luna for the quality-critical
generation and visual-QA pass. Sol is the coordinator: it reads the brief, shapes prompts,
compares references, rejects bad output, runs pixel checks and manages Git. It does not itself
replace the pixel generator.

`max` is not the default recommendation for this batch. Use it only for a genuinely difficult
diagnostic or integration impasse where the additional latency and usage are justified.

Use Codex's **built-in `image_gen` tool** through the installed `imagegen` skill. This is not
Recraft and not the fallback OpenAI Image API/CLI. The built-in path does not require
`OPENAI_API_KEY`.

The built-in tool does **not** expose a per-image price or credit charge in its result. Record the
tool as built-in `image_gen`, and record cost as **unknown/not exposed**. Never invent a price.

The fallback CLI is not approved for this batch. Do not silently switch tools or models.

## Approved style anchor

The approved apricot files are the durable visual anchors. On 2026-08-28 Rory explicitly asked
Codex to deploy the verified art before the chat could crash, so the approved assets were moved
from staging into their mapped runtime directories:

- Top-down: `public/render-assets/reference-blueprint/apricot-tree-v1.png`
- Picker: `public/element-art/tree_apricot.png`

The top-down style was approved after several deliberate corrections:

- strict 90-degree overhead canopy;
- compact, coherent, naturally rounded foliage mass;
- clean, smooth leaf surfaces with restrained vein texture;
- polished botanical digital illustration, not a photograph and not flat vector art;
- fruit and nuts are intentionally **larger than botanical scale** so they remain recognisable
  on a plan;
- apricots use golden orange with a soft red blush and a clearly visible natural crease/suture;
- produce is a strong secondary focal element and may overlap leaves naturally;
- no exposed radial branch skeleton in a dense crown;
- real alpha transparency, no ground or cast shadow.

Apply the same recognition rule to every species: enlarge its fruit, nut, pod, berry or flower
enough to survive downscaling. This is functional map-symbol exaggeration, not botanical-scale
simulation. Species still differ through real leaf shape, crown form, density and colour.

Picker views use the same paint treatment but are true front/side elevations on one shared ground
line. The whole plant is visible, with trunk and crown proportions driven by the catalogue's mature
height and width. Ground-skirted shrubs remain ground-skirted.

## Top-down prompt template

Use one built-in generation call per distinct asset. Reference the approved apricot canopy as the
style anchor, then replace the bracketed facts with catalogue/brief facts only.

```text
Use case: style-transfer
Asset type: ImbewuField top-down reference-blueprint canopy
Input images: Image 1 is the approved apricot canopy style anchor only.
Primary request: create one mature [COMMON NAME] ([BOTANICAL NAME]) canopy seen in strict
orthographic overhead view.
Subject: [CROWN FORM, TRUE LEAF SHAPE, FOLIAGE COLOUR AND DENSITY]. Include deliberately enlarged,
recognisable [FRUIT/NUT/POD/BERRY/FLOWER] in [TRUE COLOUR AND FORM], clearly readable at map scale.
Style/medium: same polished hand-painted botanical plan-illustration family as Image 1; clean
smooth leaf forms, crisp irregular leafy silhouette, controlled depth and diffuse light.
Composition/framing: centered square crown, irregular lobes reaching the frame at cardinal
directions, transparent notches between lobes, full canopy footprint.
Constraints: genuine alpha-transparent background, one canopy only, no ground, soil, mulch,
basin, cast shadow, trunk elevation, checkerboard, text, label, border, watermark or extra object.
```

## Picker prompt template

Reference the approved apricot picker plus one or two existing picker assets with a comparable
plant habit.

```text
Use case: style-transfer
Asset type: ImbewuField planting-picker element art
Input images: Image 1 is the approved new picker style anchor; Images 2–3 are comparable existing
front-elevation plant references.
Primary request: create one mature [COMMON NAME] ([BOTANICAL NAME]) in true front/side elevation.
Subject: [MATURE HEIGHT/WIDTH RELATION, TRUNK/STEM HABIT, CROWN FORM, LEAF SHAPE AND COLOUR]. Include
deliberately enlarged recognisable [PRODUCE] in [TRUE COLOUR/FORM].
Style/medium: same polished hand-painted botanical illustration family, clean smooth leaves,
layered depth, crisp silhouette, produce readable at 24 px.
Composition/framing: whole plant centered on the shared ground line, full crown and trunk/stems in
frame, square canvas.
Constraints: genuine alpha transparency, one plant only, no top-down view, ground patch, soil,
grass, pot, cast shadow, checkerboard, label, text, border, watermark or extra object.
```

## The checkerboard failure and required recovery

The built-in generator repeatedly returned a visually convincing grey-and-white transparency
checkerboard **baked into an RGB image**. Never trust the preview. Check every generated file:

```bash
file /absolute/path/to/generated.png
sips -g hasAlpha /absolute/path/to/generated.png
```

If `file` says `RGB` or `sips` says `hasAlpha: no`, run a second built-in `image_gen` call with
the failed image as the edit target:

```text
Use case: background-extraction
Input images: Image 1 is the exact approved artwork to preserve.
Primary request: remove the entire grey-and-white checkerboard and replace it with genuine alpha
transparency.
Constraints: change only the background. Preserve every leaf, fruit, nut, position, colour,
shading, silhouette, crop and scale exactly. Produce a real alpha channel. Do not bake any
checkerboard, white or grey field, ground, shadow, halo, text or extra object.
```

Re-run both checks. Do not deliver until the file is RGBA/hasAlpha.

## Delivery preparation and checks

The built-in generator currently emits 1254×1254 files. Preserve the generated original under
Codex's generated-images directory, then prepare project files non-destructively:

- top-down crown: 1024×1024;
- picker view: 192×192;
- all four corners alpha 0;
- transparent fraction 10–85%;
- top-down: painted alpha reaches at least 97% of the radius in at least 8 of 16 sampled
  directions;
- top-down: outer 75–100% annulus contains less than 10% brown pixels;
- picker: widest painted row is in the upper 65% for trees with trunks;
- visually inspect the 1024/192 files after compression and inspect the picker at 24 px;
- reject compression that causes posterisation or destroys the approved smooth shading.

The top-down file-size target is approximate. The first 48-colour apricot conversion reached
157 KB but visibly posterised the painting and was rejected. The accepted higher-colour version
is about 314 KB because visual quality is more important than meeting an approximate target by
damaging the asset. Picker files must stay below the repository's enforced 250 KB limit.

Never claim a visual result is fixed without viewing the actual prepared file. Never rely only on
the PNG header; decode alpha pixels.

### Staging and runtime wiring

New generations still start under `design/plant-art-staging/picker/` and
`design/plant-art-staging/top-down/` until their visual and alpha checks pass. Once approved, move
them to `public/element-art/` and `public/render-assets/reference-blueprint/` only in the same
change that adds the `lib/species-art.ts` mapping. The reachability tests must continue to reject
every public PNG that no live catalogue species or element can use.

## Current status

As of 2026-08-28, 87 deliverables are approved and deployed. The deployed set contains 21 of 22
exotic-fruit-and-nut deliverables, 29 of 30 indigenous-fruit deliverables, 7 shrub deliverables,
8 small-tree / large-shrub deliverables, 13 climber deliverables and all 8 medium-tree
deliverables, plus the first large-tree picker. Baboon grape remains the only climber without an
approved top-down counterpart.

| Species | Top-down | Picker |
|---|---|---|
| Almond | `/render-assets/reference-blueprint/almond-tree-v1.png` | `/element-art/tree_almond.png` |
| Apricot | `/render-assets/reference-blueprint/apricot-tree-v1.png` | `/element-art/tree_apricot.png` |
| Arabica coffee | `/render-assets/reference-blueprint/arabica-coffee-tree-v1.png` | `/element-art/tree_arabica_coffee.png` |
| Dwarf Cavendish/Williams banana | **pending** | `/element-art/tree_banana_dwarf_cavendish_williams.png` |
| Black mulberry | `/render-assets/reference-blueprint/black-mulberry-tree-v1.png` | `/element-art/tree_black_mulberry.png` |
| Carob | `/render-assets/reference-blueprint/carob-tree-v1.png` | `/element-art/tree_carob.png` |
| Date palm | `/render-assets/reference-blueprint/date-palm-v1.png` | `/element-art/tree_date_palm.png` |
| Pecan | `/render-assets/reference-blueprint/pecan-tree-v1.png` | `/element-art/tree_pecan.png` |
| Pistachio | `/render-assets/reference-blueprint/pistachio-tree-v1.png` | `/element-art/tree_pistachio.png` |
| Quince | `/render-assets/reference-blueprint/quince-tree-v1.png` | `/element-art/tree_quince.png` |
| Sweet cherry | `/render-assets/reference-blueprint/sweet-cherry-tree-v1.png` | `/element-art/tree_sweet_cherry.png` |

Top-down paths use the public reference-blueprint root; picker paths use the public element-art root.

### Indigenous fruit

| Species | Top-down | Picker |
|---|---|---|
| Bluebush | `/render-assets/reference-blueprint/bluebush-v1.png` | **pending** |
| Brown ivory / motsintsila | `/render-assets/reference-blueprint/brown-ivory-tree-v1.png` | `/element-art/tree_brown_ivory_motsintsila.png` |
| Coastal red milkwood | `/render-assets/reference-blueprint/coastal-red-milkwood-tree-v1.png` | `/element-art/tree_coastal_red_milkwood.png` |
| Cross-berry | `/render-assets/reference-blueprint/cross-berry-v1.png` | `/element-art/tree_cross_berry.png` |
| Gariep ebony | `/render-assets/reference-blueprint/gariep-ebony-tree-v1.png` | `/element-art/tree_gariep_ebony.png` |
| Glossy currant | `/render-assets/reference-blueprint/glossy-currant-v1.png` | `/element-art/tree_glossy_currant.png` |
| Karoo crossberry | `/render-assets/reference-blueprint/karoo-crossberry-v1.png` | `/element-art/tree_karoo_crossberry.png` |
| Kuni bush | `/render-assets/reference-blueprint/kuni-bush-v1.png` | `/element-art/tree_kuni_bush.png` |
| Puzzle bush | `/render-assets/reference-blueprint/puzzle-bush-v1.png` | `/element-art/tree_puzzle_bush.png` |
| Red milkwood / moepel | `/render-assets/reference-blueprint/red-milkwood-tree-v1.png` | `/element-art/tree_red_milkwood_moepel.png` |
| Shepherd's tree | `/render-assets/reference-blueprint/shepherds-tree-v1.png` | `/element-art/tree_shepherd_s_tree.png` |
| Small-leaved guarri | `/render-assets/reference-blueprint/small-leaved-guarri-v1.png` | `/element-art/tree_small_leaved_guarri.png` |
| Waterblommetjie | `/render-assets/reference-blueprint/waterblommetjie-v1.png` | `/element-art/tree_waterblommetjie.png` |
| Wild date palm | `/render-assets/reference-blueprint/wild-date-palm-v1.png` | `/element-art/tree_wild_date_palm.png` |
| Wild medlar / mmilo | `/render-assets/reference-blueprint/wild-medlar-v1.png` | `/element-art/tree_wild_medlar_mmilo.png` |

Every deployed indigenous file was visually inspected after preparation and passed the appropriate
canopy or picker pixel checks. Species traits came only from the source brief, existing catalogue
and the botanical sources linked there; no species names or catalogue facts were changed.

### Shrubs

| Species | Top-down | Picker |
|---|---|---|
| Bietou / bush-tick berry | `/render-assets/reference-blueprint/bietou-v1.png` | `/element-art/tree_bietou.png` |
| Brandybush / velvet raisin | `/render-assets/reference-blueprint/brandybush-v1.png` | `/element-art/tree_brandybush.png` |
| Honeybush / heuningbos | **pending** | `/element-art/tree_honeybush.png` |
| Rooibos | **pending** | `/element-art/tree_rooibos.png` |
| Rosemary | **pending** | `/element-art/tree_rosemary.png` |

The brief heading says "Shrubs (6)" but supplies five rows. Do not invent a sixth species; preserve
the five named rows unless the source brief is explicitly corrected.

### Small trees and large shrubs

| Species | Top-down | Picker |
|---|---|---|
| Dogwood / umglindi | `/render-assets/reference-blueprint/dogwood-v1.png` | `/element-art/tree_dogwood.png` |
| Cape boxthorn / kriedoring | **pending** | **pending** |
| Honey-thorn / kriedoring | **pending** | **pending** |
| Natal currant | `/render-assets/reference-blueprint/natal-currant-v1.png` | `/element-art/tree_natal_currant.png` |
| Pigeon pea | `/render-assets/reference-blueprint/pigeon-pea-v1.png` | **pending** |
| Quiver tree / kokerboom | **pending** | `/element-art/tree_quiver_tree.png` |
| Spekboom | `/render-assets/reference-blueprint/spekboom-v1.png` | **pending** |
| Waxberry / wasbessie | `/render-assets/reference-blueprint/waxberry-v1.png` | **pending** |

The seven approved files in this section were visually inspected at their prepared delivery size
and passed the applicable alpha/canopy or picker pixel checks. Species traits were checked against
primary SANBI PlantZAfrica pages where available; pigeon pea used FAO and USDA descriptions.

### Climbers

| Species | Top-down | Picker |
|---|---|---|
| Baboon grape | **pending** | `/element-art/tree_baboon_grape.png` |
| Bushman's grape | `/render-assets/reference-blueprint/bushmans-grape-v1.png` | `/element-art/tree_bushman_s_grape.png` |
| Common wild grape / bosdruif | `/render-assets/reference-blueprint/common-wild-grape-v1.png` | `/element-art/tree_common_wild_grape.png` |
| Grape vine / wingerd | `/render-assets/reference-blueprint/grape-vine-v1.png` | `/element-art/tree_grape_vine.png` |
| Lablab / dolichos bean | `/render-assets/reference-blueprint/lablab-v1.png` | `/element-art/tree_lablab.png` |
| Malabar spinach | `/render-assets/reference-blueprint/malabar-spinach-v1.png` | `/element-art/tree_malabar_spinach.png` |
| Purple granadilla / passion fruit | `/render-assets/reference-blueprint/purple-granadilla-v1.png` | `/element-art/tree_purple_granadilla.png` |

The Baboon grape picker was visually inspected at 192 px and at its 24 px recognition size. It is
a 45.8 KB RGBA cut-out with all four corner alphas zero and 69.4% fully transparent pixels. Its
digitately compound leaves, rust-red new growth, tendrils and enlarged red-brown/purple berry
clusters remain legible after downscaling. The morphology came from the existing catalogue and
the linked SANBI PlantZAfrica source; no catalogue facts changed.

Both Bushman's grape views were visually inspected at delivery size; the picker was also inspected
at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 11.29% fully transparent pixels,
painted alpha reaching at least 97% radius in 11 of 16 sampled directions, and 1.89% brown pixels in
the outer annulus under the brief's exact HSV definition. The 192 px picker is a 54.5 KB RGBA
cut-out with all corner alphas zero, 60.88% fully transparent pixels and its widest painted row at
44.3% of the frame height. Both retain trifoliate toothed leaves, tendrils and deliberately enlarged
red-to-purplish-black berries. Morphology was checked against the catalogue's linked SANBI
PlantZAfrica page for *Rhoicissus tridentata*; no catalogue facts changed.

Both Common wild grape views were visually inspected at delivery size; the picker was also
inspected at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 12.69% fully
transparent pixels, painted alpha reaching at least 97% radius in 10 of 16 sampled directions,
and 8.70% brown pixels in the outer annulus. The 192 px picker is a 45.4 KB RGBA cut-out with all
corner alphas zero, 66.57% fully transparent pixels and its widest painted row at 34.4% of frame
height. Its large simple three-veined leaves, copper/rust new growth and deliberately enlarged
green-to-red-to-purple-black bunches distinguish it from the compound-leaved grapes at 24 px.
Morphology was checked against the catalogue's linked SANBI PlantZAfrica page for *Rhoicissus
tomentosa*; no catalogue facts changed.

Both cultivated grape vine views were visually inspected at delivery size; the picker was also
inspected at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 12.24% fully
transparent pixels, painted alpha reaching at least 97% radius in 11 of 16 sampled directions,
and 1.87% brown pixels in the outer annulus. The 192 px picker is a 62.2 KB RGBA cut-out with all
corner alphas zero, 52.38% fully transparent pixels and its widest painted row at 54.7% of frame
height. It preserves the catalogue's wider-than-tall 2 m × 3 m proportion, deeply 3-to-5-lobed
coarsely toothed leaves and deliberately enlarged golden-green and red-purple/blue-black bunches.
Morphology was checked against Kew and Royal Botanic Gardens Victoria descriptions of *Vitis
vinifera*; no catalogue facts changed.

Both Lablab views were visually inspected at delivery size; the picker was also inspected at
24 px. The 1024 px overhead is RGBA with all corner alphas zero, 14.23% fully transparent pixels,
painted alpha reaching at least 97% radius in 8 of 16 sampled directions, and 1.61% brown pixels in
the outer annulus. The 192 px picker is a 58.4 KB RGBA cut-out with all corner alphas zero, 57.13%
fully transparent pixels and its widest painted row at 34.4% of frame height. Both retain broad
trifoliate leaves, purple flower racemes and deliberately oversized violet-purple and green pods
that remain the strongest cue at 24 px. Morphology was checked against Royal Botanic Garden Sydney
and Kew descriptions of *Lablab purpureus*; no catalogue facts changed.

Both Malabar spinach views were visually inspected at delivery size; the picker was also inspected
at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 14.95% fully transparent pixels,
painted alpha reaching at least 97% radius in 9 of 16 sampled directions, and 2.19% brown pixels in
the outer annulus. The 192 px picker is a 47.2 KB RGBA cut-out with all corner alphas zero, 65.68%
fully transparent pixels and its widest painted row at 50.5% of frame height. Both retain unusually
smooth thick heart-shaped leaves, reddish succulent stems, pink flower spikes and deliberately
enlarged red-purple-to-black berry clusters legible at 24 px. Morphology was checked against Kew and
NParks descriptions of *Basella alba*; no catalogue facts changed.

Both Purple granadilla views were visually inspected at delivery size; the picker was also
inspected at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 13.52% fully
transparent pixels, painted alpha reaching at least 97% radius in 11 of 16 sampled directions,
and 1.44% brown pixels in the outer annulus. The 192 px picker is a 60.8 KB RGBA cut-out with all
corner alphas zero, 54.00% fully transparent pixels and its widest painted row at 40.6% of frame
height. Both retain repeated three-lobed serrated leaves, curling tendrils, complete white/purple
passion flowers and deliberately oversized green and ripe purple fruits legible at 24 px.
Morphology was checked against Kew and NParks descriptions of *Passiflora edulis*; no catalogue
facts changed.

### Medium trees

| Species | Top-down | Picker |
|---|---|---|
| Buffalo thorn | `/render-assets/reference-blueprint/buffalo-thorn-v1.png` | `/element-art/tree_buffalo_thorn.png` |
| Karoo boer-bean | `/render-assets/reference-blueprint/karoo-boer-bean-v1.png` | `/element-art/tree_karoo_boer_bean.png` |
| Pigeonwood / umbengele | `/render-assets/reference-blueprint/pigeonwood-v1.png` | `/element-art/tree_pigeonwood.png` |
| Powder-puff tree / iBoqo | `/render-assets/reference-blueprint/powder-puff-tree-v1.png` | `/element-art/tree_powder_puff_tree.png` |

Both Buffalo thorn views were visually inspected at delivery size; the picker was also inspected
at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 14.21% fully transparent
pixels, painted alpha reaching at least 97% radius in 14 of 16 sampled directions, and 6.69% brown
pixels in the outer annulus. The 192 px picker is a 66.3 KB RGBA cut-out with all corner alphas
zero, 50.00% fully transparent pixels and its widest painted row at 36.5% of frame height. Both
retain glossy broad-ovate leaves, zigzag reddish young twigs, thorn cues and deliberately enlarged
green-to-red-brown drupes. Morphology was checked against SANBI PlantZAfrica for *Ziziphus
mucronata*; no catalogue facts changed. The accepted generated sources are:

- overhead: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-3d9ccfc4-8ed0-421f-b665-7d1fa3f499b5.png`;
- picker: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e9caf61b-685f-4189-801d-fe5ef7f45303.png`.

Both Karoo boer-bean views were visually inspected at delivery size; the picker was also inspected
at 24 px. The accepted 1024 px overhead is a centred 1100 px crop of its generated source. It is
RGBA with all corner alphas zero, 12.38% fully transparent pixels, painted alpha reaching at least
97% radius in 16 of 16 sampled directions, and 9.93% brown pixels in the outer annulus. The 192 px
picker is a 75.5 KB RGBA cut-out with all corner alphas zero, 39.45% fully transparent pixels and
its widest painted row at 55.7% of frame height. Both retain olive-green pinnate leaves, vivid red
flowers and deliberately enlarged lime-green, pink and brown pods. Morphology was checked against
SANBI PlantZAfrica for *Schotia afra var. afra*; no catalogue facts changed. The accepted generated
sources are:

- overhead: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-51ca892e-7402-4239-996c-2143c53dca7b.png`;
- picker: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-52e65e1b-0d90-449d-ba6d-6e3a8c41b5f0.png`.

Both Pigeonwood views were visually inspected at delivery size; the picker was also inspected at
24 px. The 1024 px overhead is RGBA with all corner alphas zero, 10.32% fully transparent pixels,
painted alpha reaching at least 97% radius in 15 of 16 sampled directions, and 0.65% brown pixels
in the outer annulus. The 192 px picker is a 72.4 KB RGBA cut-out with all corner alphas zero,
46.87% fully transparent pixels and its widest painted row at 34.4% of frame height. Both retain
the open, soft-drooping foliage, elongated serrated leaves and deliberately enlarged green and
black fruit. Morphology was checked against SANBI PlantZAfrica for *Trema orientalis*; no catalogue
facts changed. The accepted generated sources are:

- overhead: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-3808e6b8-ba3e-41f2-a1a8-7e9b05f133de.png`;
- picker: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-22a1bcb0-87b6-40be-b642-e514dc4534b8.png`.

Both Powder-puff tree views were visually inspected at delivery size; the picker was also inspected
at 24 px. The 1024 px overhead is RGBA with all corner alphas zero, 10.61% fully transparent
pixels, painted alpha reaching at least 97% radius in 15 of 16 sampled directions, and 6.51% brown
pixels in the outer annulus. The 192 px picker is a 69.0 KB RGBA cut-out with all corner alphas
zero, 47.82% fully transparent pixels and its widest painted row at 31.3% of frame height. Both
retain large spear-shaped leaf rosettes, long hanging pink-white flower tassels and deliberately
enlarged angular green and pink-brown fruit. Morphology was checked against SANBI PlantZAfrica for
*Barringtonia racemosa*; no catalogue facts changed. The accepted generated sources are:

- overhead: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5911aea2-98ae-4f6a-b94f-bed7ddea2d86.png`;
- picker: `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-c37f74a8-e4d6-44a3-a231-d21ac7dfc372.png`.

### Pending transparency failures and rejected sources

- Pigeonwood picker: the first genuine-alpha source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-fdc7d462-b566-48df-8f52-aa31db484596.png`
  passed mechanical alpha checks but its fruit disappeared at 24 px, so it was rejected. The two
  attempted fruit-enlargement/background-extraction outputs
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-edb166e8-d593-4af5-9968-e65a64a11069.png`
  and
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-4d54149b-8854-48b1-abeb-a36246a583a1.png`
  are RGB checkerboards. Only the fresh accepted RGBA source recorded above was deployed.
- Powder-puff tree picker: the first source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-1cb231d5-9441-4a00-83f3-3cfc6eb30154.png`
  has an opaque coloured gradient/vignette rather than a transparent background and was rejected.
  Only the fresh accepted RGBA source recorded above was deployed.

- Banana top-down: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-1febd2a4-fb1f-405d-b0d1-217098c62229.png`
  is RGB with a baked checkerboard. Two background-extraction calls and one fresh regeneration
  also returned RGB checkerboards. Two fresh genuine-RGBA regenerations ended with obvious
  neon/chroma edge spill and only 5/16 and 3/16 radial-reach directions. A uniform-black recovery
  of the approved composition still extracted to another RGB checkerboard. Do not stage any of
  them.
- Carob picker: the earlier visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-7f08a6f4-9c7b-4fe5-ac20-945c6cfc9395.png`
  is RGB with a baked checkerboard. One extraction invented an opaque green/tan vignette despite
  adding an alpha channel, and the follow-up returned another RGB checkerboard. The fresh accepted
  RGBA source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a9f77a43-e311-4832-99db-5aa73f0634bc.png`
  restored the paired compound leaflets and enlarged pods and was prepared and deployed.
- Bluebush picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e40717f1-0b17-478d-b0d7-354c32811069.png`
  is RGB with a baked checkerboard. The background-extraction retry
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-586af579-8e07-4db5-9be3-1f02a439de64.png`
  also has no alpha. A fresh RGBA source had correct glaucous foliage and readable red fruit but a
  cyan/green fringe remained visible at 192 px; its black-field extraction returned another RGB
  checkerboard. Bluebush picker remains pending.
- Bietou picker: the earlier preferred spreading-shrub source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-aae1ac31-371c-40da-9d91-baefeb9cdc9c.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5a082ae4-4842-4a05-be8a-68c52f4b6a6f.png`
  are RGB checkerboards. The fresh accepted RGBA source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-efb06ed0-a7f0-4595-b865-23cda34b2ea5.png`
  produced a broad low shrub with readable yellow flowers and black fruit and was prepared and
  deployed.
- Brandybush picker: the earlier preferred multi-stem source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-4b7efb73-0636-4741-b6a6-118e4d703455.png`
  and extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-9d724c4c-f1ea-445e-bd26-add82176e2c3.png`
  are RGB checkerboards. The fresh accepted RGBA source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-3137c5ee-7192-4055-bc7d-40cc67261f3a.png`
  uses SANBI's grey-green serrated leaves, yellow star flowers and enlarged two-lobed reddish-brown
  fruit and was prepared and deployed.
- Honeybush: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-2eb25c1c-004f-48ff-bfc1-b2d399850629.png`,
  its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-175da6d0-1c03-44b0-9419-0808a71e3a52.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6c017d74-a62f-4800-91a9-013d79a579c0.png`
  are RGB checkerboards. The fresh overhead
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-c4d6e884-2a85-4216-bc6d-f4d70a49d817.png`
  was rejected at 4/16 reach directions and 37.20% outer-annulus brown/yellow. The accepted fresh
  RGBA picker
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-49921cea-802b-4400-8c7d-4a8532b9e0f3.png`
  was prepared and deployed; Honeybush overhead remains pending.
- Rooibos: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-91573396-131f-4d1e-9ed7-6a78524ba8c4.png`
  has an opaque black background; its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6ac44639-bb1e-4f57-9a27-d8c2833a55b3.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-0e1b936d-de62-4056-87cc-1a6a9aea2973.png`
  are RGB checkerboards. The fresh genuine-RGBA overhead
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-b4653da3-9807-4c6a-b82a-dae684cd8830.png`
  was rejected at 2/16 reach directions. The accepted fresh RGBA picker
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-9878f707-58a0-4a47-8099-b2986c139f0f.png`
  was prepared and deployed; Rooibos overhead remains pending.
- Rosemary: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6afb407f-490b-4eb1-bdb8-8d391a7f85ab.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-27c33807-3b0d-4683-b90d-38b0a1d27e64.png`
  are RGB checkerboards. The fresh genuine-RGBA overhead
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-7426791c-1d2b-4463-9a66-6ec6eca737fe.png`
  was rejected at 4/16 reach directions. The accepted fresh RGBA picker
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6016e54b-05c6-4490-8a77-6162229cb1f8.png`
  was prepared and deployed and is mapped to both live Rosemary catalogue IDs; Rosemary overhead
  remains pending.
- Dogwood picker: the corrected front-elevation source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-47f7ff3f-cb02-4b4b-8c74-8642ae52be77.png`
  is visually approved, but it and its extraction are RGB checkerboards. A fresh source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-ff1ee194-c50e-4fcc-ad15-ad567f60ecd5.png`
  restored genuine RGBA and preserved the rounded multi-stem habit, clean glossy leaves and
  deliberately enlarged green, red and purple-black fruit. Its raw output touched the lower edge
  and contained an isolated saturated-red rendering artefact behind the trunk base. The accepted
  delivery preparation removed only that bottom-central red spill, uniformly scaled the plant to
  add transparent breathing room, and was inspected at 192 px and 24 px. The deployed picker is
  192×192 RGBA, 54,495 bytes, has transparent corners, 56.64% fully transparent pixels and its
  widest canopy row is at 52.36% height.
- Cape boxthorn: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-94935d18-8eed-446d-887c-f3a588eafd6a.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-d793332a-ac3c-43a3-b381-ada340a76281.png`
  are visually approved RGB checkerboards. Fresh overhead
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-41920b05-c78c-46b2-a163-ca12d8e91fbe.png`
  and picker
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-d54d5b2e-242a-47b7-8e38-08e7d3e4dcd5.png`
  regenerations also baked checkerboards into RGB files. A picker retry using only an approved
  transparent house-style reference
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-be10bf30-b845-4312-81f3-641439632897.png`
  did the same. Do not stage any of them.
- Honey-thorn: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5fae27c0-ce04-46e1-93ed-4ed3e1b80d07.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-278e383d-4513-46fa-adf5-e3beaeedf7e0.png`
  are visually approved RGB checkerboards. Fresh picker
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-f66f2084-1de5-436f-bdf6-4e58aa76c8f2.png`
  and overhead
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-58bef397-a2e8-404c-b6aa-f901deefcb32.png`
  regenerations have strong morphology but opaque white RGB fields. White-key extraction would
  damage the cream flowers and leaf highlights, so neither was staged.
- Pigeon pea picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-ac6ade8d-8e5d-4787-a742-c99f23f4c373.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-29d3a649-15b8-4f97-9207-a10e1249a4a9.png`
  are RGB checkerboards. A fresh morphology-correct picker with deliberately enlarged pods
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-aa03c0d8-144d-420f-9372-f8bf12cb0ae0.png`
  also baked its checkerboard into RGB. Do not stage it.
- Quiver tree top-down: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5602f4d5-1332-430b-bfd7-e35a455aeaa2.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-350df27c-c06b-465c-b40c-52280083f9fc.png`
  are RGB checkerboards. A fresh overhead regeneration
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-4a2a0938-82ce-4b67-b3e5-1cf3b9131604.png`
  retained correct radial aloe rosettes and yellow flowers but was another RGB checkerboard. Do not
  stage it.
- Spekboom picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-baf42529-b0d9-47ee-8667-4ddeb772e49f.png`
  is an RGB checkerboard. Its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6d787f66-630f-4106-bd4d-b12d5e244512.png`
  replaced the background with an opaque coloured vignette and must also be rejected.
  A fresh picker
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-4919f0dd-d9e4-4089-be13-02259e1ac5c0.png`
  restored clean paired succulent leaves, red-brown stems and readable pink flowers but again baked
  a checkerboard into RGB, so it also remains unshipped.
- Waxberry picker: the preferred broad, low, fruiting-shrub source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-222f60c0-1672-43c2-966b-10cc86732ce9.png`
  is an RGB checkerboard. Its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-73fa6241-051e-4360-adc5-dff62aa95826.png`
  added alpha but changed the square composition into a 3:2 crop with a green vignette, so it
  must also be rejected.
- Baboon grape top-down: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-d7c95c15-1f7c-4456-8f4c-c94535d3f5b3.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a0a42df8-c34f-4d1d-bc33-1714585da196.png`
  are RGB checkerboards. Do not stage either one.
- Bushman's grape picker: the first front-elevation source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-74ed8990-55a1-4025-8222-fafb69bd6563.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-2d5461bb-9a7d-4ce3-a853-8206bf268cd8.png`
  are RGB checkerboards. The second direct generation
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-d7ba6242-89bc-4e8f-a8b4-eb95de38edf1.png`
  has an opaque black RGB background; only its successful RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-eddcfe54-4c30-4dd3-8bbf-d56aaa5fb564.png`
  was prepared and deployed.
- Common wild grape: the accepted overhead and picker compositions first arrived as RGB
  checkerboards at
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-24fe863c-518b-4cd9-abb7-c75c867df781.png`
  and
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-b33630e2-2ab8-472e-8275-2ca275595090.png`.
  Only their successful RGBA extractions
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-8dd3c696-2656-4dd8-a7d3-c370e5685edb.png`
  and
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-805274d9-98fa-4ecf-ac00-33c4c09de159.png`
  were prepared and deployed.
- Grape vine: the overhead source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-564e3910-1209-4de3-8fd8-5ef54ed99451.png`
  and its direct extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5cd3210a-f2f0-49b6-965a-d23a90766141.png`
  are RGB checkerboards. A uniform-black intermediate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a3818002-f128-4fee-8afc-ece8dd0bcede.png`
  enabled the accepted RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a0b00ada-e2c3-4002-a87f-252189ba6336.png`.
  The picker source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e5c1c612-934a-4dd3-9c58-686cb2ae41ae.png`
  is an RGB checkerboard; only its accepted RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a343a084-866b-4891-acaa-5d13237a6d2f.png`
  was prepared and deployed.
- Lablab: the overhead source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-967f05d1-60ad-4740-8c5b-c8d74744de3e.png`
  and its direct extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-865f856f-dff1-47f8-8dbb-72fb389e1f8c.png`
  are RGB checkerboards. A uniform-black intermediate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e6f12c18-2784-49ce-b3d1-f5798e1f452a.png`
  enabled the accepted RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-fbaecd60-887b-4431-bdef-88f4c861eed1.png`.
  The picker source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-363e0690-ef10-4fa0-bd69-f32130bc64c3.png`
  is an RGB checkerboard; only its accepted RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a9cd74e6-9425-4148-ae7b-9158f17186d3.png`
  was prepared and deployed.
- Malabar spinach: the overhead and picker sources
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-c24d1dc0-57f1-4460-bb99-7b0e5cd58ebd.png`
  and
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-c720611f-626e-4dff-8797-24bf4f6bcecb.png`
  are RGB checkerboards. Only their accepted RGBA extractions
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e74a5629-c0a2-49e3-adc1-13568c53a1a4.png`
  and
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-242d655f-d75e-44c8-a0ae-b8b8828b02fd.png`
  were prepared and deployed.
- Purple granadilla: the first overhead source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-bfb9696f-c38c-4a05-be89-2d19cc961ae9.png`
  was rejected because it produced five-lobed leaves. The corrected overhead source and its first
  extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-88eaf3b5-2b20-4ce5-9e63-56180154d755.png`
  and
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-ed014ea0-b29c-4784-952d-ddbc4d20ca51.png`
  had correct three-lobed foliage and RGBA after extraction, but failed the canopy reach gate.
  The denser corrected source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a3771229-e0c9-440d-8b1f-e9146b8e9ffc.png`
  is an RGB checkerboard; only its accepted RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-678dab28-5c6a-42fb-8986-b0efb343fbd9.png`
  was prepared and deployed. The picker source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-d753bc8d-9780-4a24-8ce1-d8a801ee3d49.png`
  is an RGB checkerboard; only its accepted RGBA extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-4ad10842-5390-41fb-bdd5-b72299df0a4d.png`
  was prepared and deployed.

### Karee large-tree work in progress

The approved Karee picker is deployed at `public/element-art/tree_karee.png` and mapped to both live
catalogue IDs, `searsia-lancea` and `searsia-lancea-rhus-lancea`, because both entries name the same
species and use the same SANBI source. It is a 192×192 RGBA front elevation with a
rounded, softly drooping crown, visible coarse trunk and deliberately readable but restrained
yellow-to-brown fruit. It passed delivery-size inspection at both 192 px and 24 px, has fully
transparent corners, 42.40% transparent pixels, and its widest row is at 49.5% height. Its accepted
RGBA source is
`/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e3981994-49ec-49c1-a43a-dc090501371d.png`.

Karee overhead remains pending. The attempts through
`/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-a227351d-ea1c-4241-a75d-db6ccc785530.png`
were rejected rather than deployed. Across those attempts, either the generator produced
five-to-seven-part radial leaf rosettes instead of diagnostic three-leaflet leaves, returned an
opaque checkerboard, or introduced a neon green edge fringe during alpha extraction. The final
fresh source is genuine RGBA and has cleaner edges, but still reads as many-part starbursts at full
size, so it is not botanically acceptable. Do not promote `/tmp/karee-v1.png`; it is an earlier
fringe-contaminated preparation.

### White milkwood large-tree work in progress

White milkwood was attempted but neither view is approved. The best overhead morphology source is
the genuine-RGBA
`/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-0a4c8916-5936-4e16-86bf-d1f136cc274e.png`.
It has the correct dense rounded habit, simple leathery leaves, greenish-white flowers and enlarged
purple-black berry clusters, with 26.54% fully transparent pixels, transparent corners and only
2.46% brown pixels in the outer annulus. It failed the hard radial-reach gate in its unmodified
1024 px preparation: 4 of 16 directions reached 97% radius, below the required 8. A 4% enlargement
raised reach to 12 of 16 but visibly clipped leaves at the top and left, so that preparation was
rejected. Other overhead attempts either baked checkerboards into RGB files, retained lime edge
spill, or measured even lower reach. Do not promote `/tmp/white-milkwood-v3-fill.png`.

The strongest genuine-RGBA picker source is
`/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-ab07c554-c360-44b0-a6ae-1bd9a356d71b.png`.
Its 192 px preparation passed alpha, corner, transparency and front-elevation geometry checks, but
the purple fruit became too quiet at 24 px. A larger-fruit attempt returned an opaque vignette, and
black-field extraction of the stronger checkerboard composition still returned an RGB
checkerboard. No White milkwood asset was staged or deployed.

All source-table species have now been attempted. The unresolved deliverables are Banana overhead,
Bluebush picker, Honeybush overhead, Rooibos overhead, Rosemary overhead, both Cape boxthorn views,
both Honey-thorn views, Pigeon pea picker, Quiver tree overhead, Spekboom picker,
Waxberry picker, Baboon grape overhead, Karee overhead and both White milkwood views. The next
untouched recovery target after this batch is the Cape boxthorn pair; the earlier failed assets remain
pending and must not be skipped in status reports. Keep every transparency, morphology or scale
failure visible. Do not silently switch to the CLI/API fallback to resolve them; that requires
explicit user approval.

Do not modify `PLAN_VERSION`. Do not touch the original checkout at
`/Users/roryclark/ImbewuField`; it contains another session's uncommitted files.
