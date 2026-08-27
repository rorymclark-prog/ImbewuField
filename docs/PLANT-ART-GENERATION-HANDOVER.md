# Plant-art generation handover

**Last updated:** 2026-08-27

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

The approved apricot files are the durable visual anchors. They remain in staging until Claude
wires the corresponding catalogue species; placing them in runtime directories before that makes
the repository's unreachable-art tests fail:

- Top-down: `design/plant-art-staging/top-down/apricot-tree-v1.png`
- Picker: `design/plant-art-staging/picker/tree_apricot.png`

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

### Staging before wiring

New species art must first go under:

- `design/plant-art-staging/picker/`
- `design/plant-art-staging/top-down/`

The repository rejects files placed directly in `public/element-art/` or
`public/render-assets/reference-blueprint/` when no live catalogue mapping points at them. The
source brief assigns TypeScript wiring to Claude, so Codex must not weaken those tests or edit the
wiring just to make an art-only branch pass. Claude moves each approved pair to its final runtime
paths in the same change that adds its catalogue mappings.

## Current status

As of 2026-08-27, 20 of the 22 exotic-fruit-and-nut deliverables are approved and staged.

| Species | Top-down | Picker |
|---|---|---|
| Almond | `top-down/almond-tree-v1.png` | `picker/tree_almond.png` |
| Apricot | `top-down/apricot-tree-v1.png` | `picker/tree_apricot.png` |
| Arabica coffee | `top-down/arabica-coffee-tree-v1.png` | `picker/tree_arabica_coffee.png` |
| Dwarf Cavendish/Williams banana | **pending** | `picker/tree_banana_dwarf_cavendish_williams.png` |
| Black mulberry | `top-down/black-mulberry-tree-v1.png` | `picker/tree_black_mulberry.png` |
| Carob | `top-down/carob-tree-v1.png` | **pending** |
| Date palm | `top-down/date-palm-v1.png` | `picker/tree_date_palm.png` |
| Pecan | `top-down/pecan-tree-v1.png` | `picker/tree_pecan.png` |
| Pistachio | `top-down/pistachio-tree-v1.png` | `picker/tree_pistachio.png` |
| Quince | `top-down/quince-tree-v1.png` | `picker/tree_quince.png` |
| Sweet cherry | `top-down/sweet-cherry-tree-v1.png` | `picker/tree_sweet_cherry.png` |

All paths in this table are relative to `design/plant-art-staging/`.

### Pending transparency failures

- Banana top-down: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-1febd2a4-fb1f-405d-b0d1-217098c62229.png`
  is RGB with a baked checkerboard. Two background-extraction calls and one fresh regeneration
  also returned RGB checkerboards. Do not stage any of them.
- Carob picker: the visually approved source
  `/Users/roryclark/.codex/generated_images/01a043ff-7491-7fc3-94c6-b3f83e525e0b/exec-7f08a6f4-9c7b-4fe5-ac20-945c6cfc9395.png`
  is RGB with a baked checkerboard. One extraction invented an opaque green/tan vignette despite
  adding an alpha channel, and the follow-up returned another RGB checkerboard. Do not stage them.

The next untouched species in the brief is **Bluebush**. Continue in the exact source-table order,
while keeping the two pending exotic assets visible in status reports. Do not silently switch to
the CLI/API fallback to resolve them; that requires explicit user approval.

Do not modify `PLAN_VERSION`. Do not touch the original checkout at
`/Users/roryclark/ImbewuField`; it contains another session's uncommitted files.
