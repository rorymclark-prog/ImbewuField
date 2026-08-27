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

As of 2026-08-28, 59 deliverables are approved: 58 are deployed and one is held in staging for
the next mapped batch. The deployed set contains 20 of 22 exotic-fruit-and-nut deliverables,
29 of 30 indigenous-fruit deliverables, 2 shrub deliverables and 7 small-tree / large-shrub
deliverables. The staged file is the Baboon grape picker.

| Species | Top-down | Picker |
|---|---|---|
| Almond | `/render-assets/reference-blueprint/almond-tree-v1.png` | `/element-art/tree_almond.png` |
| Apricot | `/render-assets/reference-blueprint/apricot-tree-v1.png` | `/element-art/tree_apricot.png` |
| Arabica coffee | `/render-assets/reference-blueprint/arabica-coffee-tree-v1.png` | `/element-art/tree_arabica_coffee.png` |
| Dwarf Cavendish/Williams banana | **pending** | `/element-art/tree_banana_dwarf_cavendish_williams.png` |
| Black mulberry | `/render-assets/reference-blueprint/black-mulberry-tree-v1.png` | `/element-art/tree_black_mulberry.png` |
| Carob | `/render-assets/reference-blueprint/carob-tree-v1.png` | **pending** |
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
| Bietou / bush-tick berry | `/render-assets/reference-blueprint/bietou-v1.png` | **pending** |
| Brandybush / velvet raisin | `/render-assets/reference-blueprint/brandybush-v1.png` | **pending** |
| Honeybush / heuningbos | **pending** | **pending** |
| Rooibos | **pending** | **pending** |
| Rosemary | **pending** | **pending** |

The brief heading says "Shrubs (6)" but supplies five rows. Do not invent a sixth species; preserve
the five named rows unless the source brief is explicitly corrected.

### Small trees and large shrubs

| Species | Top-down | Picker |
|---|---|---|
| Dogwood / umglindi | `/render-assets/reference-blueprint/dogwood-v1.png` | **pending** |
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
| Baboon grape | **pending** | `design/plant-art-staging/picker/tree_baboon_grape.png` |

The Baboon grape picker was visually inspected at 192 px and at its 24 px recognition size. It is
a 45.8 KB RGBA cut-out with all four corner alphas zero and 69.4% fully transparent pixels. Its
digitately compound leaves, rust-red new growth, tendrils and enlarged red-brown/purple berry
clusters remain legible after downscaling. The morphology came from the existing catalogue and
the linked SANBI PlantZAfrica source; no catalogue facts changed.

### Pending transparency failures

- Banana top-down: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-1febd2a4-fb1f-405d-b0d1-217098c62229.png`
  is RGB with a baked checkerboard. Two background-extraction calls and one fresh regeneration
  also returned RGB checkerboards. Do not stage any of them.
- Carob picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-7f08a6f4-9c7b-4fe5-ac20-945c6cfc9395.png`
  is RGB with a baked checkerboard. One extraction invented an opaque green/tan vignette despite
  adding an alpha channel, and the follow-up returned another RGB checkerboard. Do not stage them.
- Bluebush picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-e40717f1-0b17-478d-b0d7-354c32811069.png`
  is RGB with a baked checkerboard. The background-extraction retry
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-586af579-8e07-4db5-9be3-1f02a439de64.png`
  also has no alpha. Do not stage either one.
- Bietou picker: the preferred spreading-shrub source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-aae1ac31-371c-40da-9d91-baefeb9cdc9c.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5a082ae4-4842-4a05-be8a-68c52f4b6a6f.png`
  are RGB checkerboards. A fresh generation did the same. Do not stage them.
- Brandybush picker: the preferred multi-stem source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-4b7efb73-0636-4741-b6a6-118e4d703455.png`
  and extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-9d724c4c-f1ea-445e-bd26-add82176e2c3.png`
  are RGB checkerboards. Do not stage them.
- Honeybush: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-2eb25c1c-004f-48ff-bfc1-b2d399850629.png`,
  its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-175da6d0-1c03-44b0-9419-0808a71e3a52.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6c017d74-a62f-4800-91a9-013d79a579c0.png`
  are RGB checkerboards. Do not stage them.
- Rooibos: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-91573396-131f-4d1e-9ed7-6a78524ba8c4.png`
  has an opaque black background; its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6ac44639-bb1e-4f57-9a27-d8c2833a55b3.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-0e1b936d-de62-4056-87cc-1a6a9aea2973.png`
  are RGB checkerboards. Do not stage them.
- Rosemary: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6afb407f-490b-4eb1-bdb8-8d391a7f85ab.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-27c33807-3b0d-4683-b90d-38b0a1d27e64.png`
  are RGB checkerboards. Do not stage them.
- Dogwood picker: the corrected front-elevation source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-47f7ff3f-cb02-4b4b-8c74-8642ae52be77.png`
  is visually approved, but it and its extraction are RGB checkerboards. Do not stage them.
- Cape boxthorn: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-94935d18-8eed-446d-887c-f3a588eafd6a.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-d793332a-ac3c-43a3-b381-ada340a76281.png`
  are visually approved RGB checkerboards. Do not stage them.
- Honey-thorn: overhead candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5fae27c0-ce04-46e1-93ed-4ed3e1b80d07.png`
  and picker candidate
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-278e383d-4513-46fa-adf5-e3beaeedf7e0.png`
  are visually approved RGB checkerboards. Do not stage them.
- Pigeon pea picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-ac6ade8d-8e5d-4787-a742-c99f23f4c373.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-29d3a649-15b8-4f97-9207-a10e1249a4a9.png`
  are RGB checkerboards. Do not stage them.
- Quiver tree top-down: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-5602f4d5-1332-430b-bfd7-e35a455aeaa2.png`
  and its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-350df27c-c06b-465c-b40c-52280083f9fc.png`
  are RGB checkerboards. Do not stage them.
- Spekboom picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-baf42529-b0d9-47ee-8667-4ddeb772e49f.png`
  is an RGB checkerboard. Its extraction
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-6d787f66-630f-4106-bd4d-b12d5e244512.png`
  replaced the background with an opaque coloured vignette and must also be rejected.
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

The next untouched species in the brief is **Bushman's grape**, the second climber. Waxberry picker
and Baboon grape top-down were attempted and remain pending as documented above. Continue in exact
source-table order, while keeping every pending transparency failure visible in status reports. Do
not silently switch to the CLI/API fallback to resolve them; that requires explicit user approval.

Do not modify `PLAN_VERSION`. Do not touch the original checkout at
`/Users/roryclark/ImbewuField`; it contains another session's uncommitted files.
