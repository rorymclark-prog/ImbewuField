# ImbewuField element art — Batch 2 brief

**Goal:** one coherent illustrated library covering the 50 elements a South African
smallholder actually places, so the app stops leaning on emoji and line icons.

Companion brief: `canopy-art-prompt.md` specifies the **top-view tree canopies** (16 species)
in detail. This brief covers **everything else** — the picker views for those same trees, the
whole non-tree library, and the **AI map-generation vocabulary for all of it**.

---

## Three renders per element

Every element needs up to **three** renders, because the app draws it in three places that
ask different questions. Two are pictures. **The third is words.**

| Render | Where it appears | Question it answers | Size on screen |
|---|---|---|---|
| **MAP** | composited onto the Exact plan, clipped to the element's footprint | *how much ground does this take, and where* | 70–460 px |
| **PICKER** | the palette card the farmer taps to place it | *what is this thing* | **24–64 px** |
| **GLOSSY** | the AI map-generation layer — a **prompt sentence**, not an image | *how should the model paint this* | n/a |

The third one is the one that keeps getting forgotten, and it is specified in full below
under **The third render**. An element with no glossy vocabulary is invisible to the AI
renderer: the model is handed a bare name and invents whatever it likes on the farmer's plan.

**MAP is always top-down orthographic.** No exceptions — it sits on a scaled plan and any
perspective is a lie about the footprint.

**PICKER view is chosen per element.** This is the rule, and it is the point of the brief:

- **FRONT elevation** — living things. You recognise a banana by its side silhouette, never
  from above. All trees, shrubs, hedges, grasses.
- **OBLIQUE 3/4** — built objects with volume. A JoJo tank from above is a circle; a shed
  from above is a rectangle; so are a coop, a greenhouse and a biodigester. Top view cannot
  tell them apart, oblique can instantly.
- **TOP** — ground works. A keyhole bed, a swale, a herb spiral, a basin *is* its plan shape;
  there is nothing to see from the side. These reuse the map render, no second asset needed.

**The picker constraint that decides everything: it must read at 24 px.** At that size
interior detail is mush and only the silhouette survives. Design the outline first — a
distinctive profile against nothing — then fill it. If two elements have the same silhouette
at 24 px, one of them is drawn wrong.

---

## Hard rules — every image file, both views

- **1024×1024 PNG, RGBA, genuine alpha.** All four corners alpha 0.
- **Never export a "transparent preview" with the checkerboard baked into the pixels.** This
  has shipped: the file declared an alpha channel, was filled 255 everywhere, and painted an
  opaque square across the farm. A PNG header check cannot catch it — decode the pixels.
- **No ground, no shadow, no baked background.** No soil, no mulch ring, no drop shadow, no
  grass, no cast shadow plane. The app paints its own ground. Anything you add is drawn twice.
- **Nothing else in frame** — no text, labels, dimensions, scale bars, borders, frames.
- **The subject fills the frame.** Margin ≤ 3% on the tightest axis. The app clips and scales;
  a generous margin becomes a gap it has to fill with paper.
- **One treatment across the whole set.** Same brush character, same line weight, same light,
  same level of finish. A farmer must never be able to tell which batch a thing came from.

**Light:** soft even diffuse daylight, key from the upper left, no hard cast shadows, gentle
self-shading for form only.

**Style:** hand-painted illustration for a printed permaculture design document. Not
photographic, not flat vector, not 3D-rendered. Visible painted edges; honest materials —
plastic tanks read as plastic, corrugated iron as corrugated iron, timber as timber.

**Oblique geometry (all oblique renders identical):** viewed from **30° above the horizon,
rotated 35° off the front face**, orthographic — no vanishing point, no lens distortion. Every
oblique object in the library must look like it was photographed on the same turntable.

---

## Colour — the measured failure, and the corrected spec

This is the single biggest problem with the current library, and it is measured, not a
matter of taste.

Across the seven existing canopy assets, foliage colour spans:

| axis | today | required |
|---|---|---|
| **hue** | **17.5°** (74°–91° HSV) — a 5% slice of the wheel | **≥ 55°** |
| **value** | 16.0% | **≥ 35%** |
| saturation | 27.8% | ≥ 35% |

Every tree in the app is a variant of the same yellow-green. Worse, most of the variation
they *do* have is on the **saturation** axis, which reads as "one of these printed badly"
rather than "these are different species". Hue and value are what say *different plant*.

### Foliage colour per species — use these

This is the **average colour the finished crown must read as**, as the midtone; light and
shade vary around it. The set is deliberately spread across **70° of hue and 47% of value**.

**The same hex governs both renders of a species** — the top-view canopy on the map and the
front elevation in the picker. A citrus that is one green on the plan and a different green
on the card is the same failure in a new place.

| Species | Foliage hex | Reads as |
|---|---|---|
| Moringa | `#A2BC8B` | pale silvery grey-green |
| Marula | `#85A86F` | matte grey-green |
| Indigenous shade tree | `#77996B` | muted grey-green |
| Kei apple | `#8DB255` | bright pale yellow-green |
| Pawpaw | `#85A83F` | vivid yellow-green |
| Banana clump | `#709E35` | strong yellow-green |
| Olive | `#7F9373` | grey-sage |
| Fig | `#6A9952` | mid yellow-green |
| Citrus | `#4B843C` | glossy mid-green |
| Macadamia | `#417543` | mid-dark green |
| Wild plum | `#3A7041` | deep green |
| Mango | `#30663B` | dark green, bronze-red new growth at the tips |
| Waterberry | `#346040` | dark green, reddish new growth |
| Avocado | `#2B5639` | deep blue-green |
| Natal plum | `#275139` | very dark glossy green |
| Litchi | `#264435` | darkest — near black-green |

**The calibration pair: Moringa `#A2BC8B` and Litchi `#264435`.** If those two do not look
like obviously different plants at 24 px *with the colour desaturated*, the set has not
spread far enough and needs redrawing.

### Fruit is the identity cue that survives

At 70 px the leaf detail is gone and only overall colour, crown density and **fruit colour**
survive. Paint fruit clearly, in its true colour, on every species that has it — citrus
orange, litchi red, marula yellow, kei apple apricot-orange, natal plum red, waterberry
purple. It does more identity work than any amount of leaf rendering.

### Built objects separate by material, not by shade of brown

- **Water** — JoJo green `#2E6B4F`, black poly `#2A2A28`, galvanised `#9BA3A6`
- **Timber** — warm pine `#B08A56`, weathered grey `#8E8778`
- **Iron / roofing** — cool zinc `#A7AEB2`, rusted red-oxide `#8C4A32`
- **Shade cloth** — dark forest `#3B4F3F`, or black `#2B2B2B`
- **Earth / masonry** — `#9A7A57`, breeze-block grey `#B4B0A6`

---

## The third render — the AI map-generation (Glossy) layer

The Exact sheets composite the PNGs above. The **Glossy / AI styles** do not: they hand a
prompt to an image model, and every element the farmer placed is described to it in words.
That description lives in `lib/producer-prompt.ts` — **Codex's own file** — in two parallel
vocabularies:

| Path | Glossary | Matcher |
|---|---|---|
| Showcase family (`buildShowcasePrompt`) | `M` | `SHOWCASE_MARKER_MATCH` — RegExp against the element's **display name** |
| Satellite Overlay (`buildSatelliteOverlayPrompt`) | `OVERLAY_ICONS` | `ICON_MATCH` — same |

`buildProducerPrompt` now reuses `showcaseMarkerGlossary` rather than keeping a third copy.
**Do not add a fourth table.** That file records four separate incidents of a fix landing in
one table and not the others; the shared helper exists to stop the fifth.

### The 16 elements with no vocabulary in *either* path

A farmer can place any of these, see it printed, labelled and legended correctly, and still
have an AI-styled render invent something arbitrary in its place:

`bench` · `gate` · `herb_spiral` · `other_planting` · `other_structure` · `other_water` ·
`shade_sail` · `sign` · `solar_panel_ground` · `washline` · `tree_marula` · `tree_kei_apple` ·
`tree_natal_plum` · `tree_waterberry` · `tree_wild_plum` · `tree_pomegranate`

**Every indigenous fruit species in the catalogue is on that list.** The app can plan a
marula, price it, put it in the Bill of Quantities and label it on the plan — and the AI
renderer has never once been told what a marula looks like.

A further six have vocabulary on one path only: `water_trough`, `first_flush`, `pump_filter`,
`banana_clump`, `pollinator_strip`, `vetiver_row` (Showcase gap) and `rain_barrel` (Overlay
gap).

### How to write an entry

One sentence, present tense, describing **what the model should paint at that marker seen
from directly overhead**. Lead with the thing itself, not its container.

**Describe by form, habit and material — never by species name.** This is not a style
preference: naming a species in a generated plan is a propagation recommendation, and what
may be propagated in South Africa is regulated under NEMBA. The rule is already stated in
`M.bed`'s comment; it applies to every entry you add.

Good shape, from the existing `M.bed`:

> *each green rectangle is a PLANTED vegetable bed in full growth, never bare or freshly
> tilled ground: dense regular rows of leafy vegetables filling that rectangle, individual
> plants clearly visible from above as distinct rosettes and clumps in several greens…*

Note what it does: says what it **is**, says what it is **not** ("never bare"), and says how
it must **not merge** with its neighbours. Do all three for anything that repeats on a plan.

For the canopies, the sentence must carry the **same colour and crown description as the
artwork brief above** — a marula painted grey-green in the Exact sheet and generic mid-green
in the Glossy sheet is the same species reading as two different plants across two sheets of
one plan set.

### The gate that enforces it

`tests/catalog-matrix.test.ts` holds both gap lists as explicit arrays and asserts
`deepEqual` — **exactly** the documented ids have no vocabulary. Adding an entry means
deleting that id from the array in the same commit. The test fails in both directions, so it
catches a table that drifts *and* a list that lies.

Deliverable for this layer: a patch to `lib/producer-prompt.ts` adding both vocabularies for
all 22 gap ids, plus the matching shrink of both arrays in `tests/catalog-matrix.test.ts`,
with `npm test` green.

---

## The 50

`M` = map render needed · `P` = picker render needed · `have` = asset already exists

### Trees & plants — PICKER = front elevation (16)

Map views are specified in `canopy-art-prompt.md`. Front views here.

| id | Name | Foliage | Picker: front elevation |
|---|---|---|---|
| `tree_citrus` | Citrus Tree | `#4B843C` | dense low rounded crown on a short trunk, orange fruit visible |
| `tree_mango` | Mango Tree | `#30663B` | big heavy dome, thick trunk, dark |
| `tree_avocado` | Avocado Tree | `#2B5639` | tall broad dome, dark blue-green |
| `tree_macadamia` | Macadamia Tree | `#417543` | upright, dense, slightly conical |
| `tree_litchi` | Litchi Tree | `#264435` | wide low dome, darkest of the set, red fruit |
| `tree_pawpaw` | Pawpaw Tree | `#85A83F` | **unmistakable**: single bare slender stem, crown of lobed leaves at the top, fruit at the collar |
| `tree_moringa` | Moringa Tree | `#A2BC8B` | thin pale trunk, sparse airy feathery crown, seed pods hanging |
| `tree_banana` (`banana_clump`) | Banana Clump | `#709E35` | clump of pseudostems, huge paddle leaves, one hanging bunch |
| `tree_marula` | Marula | `#85A86F` | broad open spreading crown, clear trunk, savanna silhouette |
| `tree_kei_apple` | Kei Apple | `#8DB255` | dense thorny shrub to the ground, small orange fruit |
| `tree_natal_plum` | Natal Plum | `#275139` | low dense shrub, white flowers + red fruit |
| `tree_wild_plum` | Wild Plum | `#3A7041` | tall rounded, glossy drooping foliage |
| `tree_waterberry` | Waterberry | `#346040` | dense rounded, reddish new growth |
| `tree_indigenous` | Indigenous Shade Tree | `#77996B` | **flat-topped** wide crown, clear trunk — acacia profile, *not* a conifer |
| `tree_other` | Other Tree | `#5C8A45` | deliberately generic rounded tree, no fruit, no species cue |
| `tree_olive` | Olive Tree | `#7F9373` | gnarled short trunk, silvery narrow foliage |

### Beds, strips & ground works — PICKER = top (reuse map) (9)

| id | Name | Size | Notes |
|---|---|---|---|
| `veg_bed` | Vegetable Bed | 1.2×3 m | *have* — planted rows, mixed greens |
| `raised_bed` | Raised Bed | 1.2×2.4 m | timber-edged, soil + seedlings, edge visible from above |
| `keyhole_bed` | Keyhole Bed | 2×2 m | *have* — the notch must read at 24 px |
| `herb_spiral` | Herb Spiral | 2×2 m | *have* — stone spiral, planted |
| `pollinator_strip` | Pollinator Strip | 1×5 m | *have* — mixed flowering, colour variety |
| `spekboom_hedge` | Spekboom Hedge | 0.5×5 m | *have* — small round succulent leaves, dense run |
| `vetiver_row` | Vetiver Row | 0.3×5 m | *have* — fine upright grass tufts in a line |
| `mulch_bank` | Mulch Bank | — | loose straw/organic bank, no plants |
| `other_planting` | Other planting | 2×2 m | neutral green planted patch, no species cue |

### Earthworks — PICKER = top (reuse map) (6)

| id | Name | Size | Notes |
|---|---|---|---|
| `tree_basin` | Tree Basin | 2×2 m | *have* — a ring of raised earth with a dished centre. **No tree in it** |
| `banana_circle` | Banana Circle | 3.5×3.5 m | *have* — pit with compost core, ring of banana |
| `greywater_basin` | Greywater Basin | 1.5×1.5 m | *have* — gravel-filled dished basin |
| `infiltration_basin` | Infiltration Basin | 3×3 m | larger, plain dished earth, gravel apron |
| `half_moon` | Half-moon | 4×4 m | crescent earth bund, open uphill |
| `berm` | Berm / Contour Bank | 1.2×10 m | long raised earth bank, planted crest |

### Water — PICKER = oblique 3/4 (10)

| id | Name | Size | Notes |
|---|---|---|---|
| `jojo_1000` | JoJo Tank 1000L | Ø1 m | *have (map)* — green vertical poly tank, ribbed, short |
| `jojo_2500` | JoJo Tank 2500L | Ø1.4 m | same family, visibly taller — **the four tanks must differ in proportion, not just label** |
| `jojo_5000` | JoJo Tank 5000L | Ø1.85 m | tall, wide |
| `jojo_10000` | JoJo Tank 10000L | Ø2.2 m | tallest and widest |
| `rain_barrel` | Rain Barrel | Ø0.6 m | short blue/black drum, lid, tap |
| `pond_small` | Small Pond | Ø4 m | *have* — water surface, planted edge |
| `dam` | Farm Dam | Ø12 m | earth-walled, larger water body, brown-green water |
| `borehole` | Borehole | Ø0.6 m | capped steel head + small pump housing |
| `tap_point` | Tap Point | Ø0.4 m | *have* — standpipe on a short riser, brass tap |
| `water_trough` | Water Trough | 0.6×2 m | long concrete trough, water surface |

### Structures — PICKER = oblique 3/4 (12)

| id | Name | Size | Notes |
|---|---|---|---|
| `shed` | Shed | 3×3 m | corrugated iron walls + mono-pitch roof, one door |
| `greenhouse_tunnel` | Greenhouse Tunnel | 3×6 m | hoop tunnel, translucent plastic over ribs |
| `shade_house` | Shade House | 3×3 m | *have (map)* — timber frame, dark shade cloth |
| `chicken_coop` | Chicken Coop | 2×2 m | raised timber box, pitched roof, pop-hole + ramp |
| `chicken_tractor` | Chicken Tractor | 1.2×2.4 m | *have (map)* — A-frame mesh, wheels, clearly mobile |
| `compost_bay` | Compost Bay (3-bin) | 1×3 m | *have (map)* — three timber-slatted bays, different fill levels |
| `worm_farm` | Worm Farm | 0.6×1.2 m | stacked plastic trays with a tap |
| `nursery_table` | Nursery Table | 1×2 m | *have (map)* — waist-high bench, seedling trays |
| `market_stall` | Market Stall | 3×3 m | open-sided canopy, table, produce crates |
| `biodigester` | Biodigester | 2×2 m | dome or bag digester, inlet + gas pipe |
| `solar_panel_ground` | Ground Solar Panel | 2×1 m | tilted panel on a frame, blue cells |
| `shade_sail` | Shade Sail | 4×4 m | tensioned triangular fabric on posts |

### Animals — PICKER = oblique 3/4 (5)

| id | Name | Size | Notes |
|---|---|---|---|
| `beehive` | Beehive | Ø0.5 m | *have (map)* — Langstroth box stack, landing board |
| `goat_pen` | Goat Pen | 4×4 m | post-and-rail enclosure + small shelter |
| `pig_pen` | Pig Pen | 4×4 m | solid low walls + shelter, muddy wallow |
| `rabbit_hutch` | Rabbit Hutch | 1×2 m | raised mesh-fronted hutch on legs |
| `duck_pond` | Duck Pond | 2×2 m | small lined pond, gently sloped edge |

### Access & extras — PICKER = oblique 3/4 (2)

| id | Name | Size | Notes |
|---|---|---|---|
| `gate` | Gate | 1.5×0.3 m | *have (map)* — farm gate in a fence line, latch side clear |
| `bench` | Bench | 1.5×0.5 m | simple timber bench |

**Total: 60 renders across 50 elements** — 16 tree front views, 15 ground/earthworks tops
(9 already exist), 10 water obliques, 12 structure obliques, 5 animal obliques, 2 access.
Where "have" is marked the **map** render exists; the picker render is still needed unless
the row is in a top-view section.

---

## Naming

- Map: `<element>-v1.png` in `public/render-assets/reference-blueprint/`
- Picker: `<element_id>.png` in `public/element-art/` — **exact catalogue id**, underscores
  kept: `tree_kei_apple.png`, `jojo_5000.png`, `banana_clump.png`
- Glossy: no file — entries in `lib/producer-prompt.ts`, keyed as that file already keys them

---

## Priority

If the batch has to be split, this is the order — most-placed first:

1. The four **JoJo tanks** + `tap_point` + `rain_barrel` (every plan has water)
2. `raised_bed`, `veg_bed`, `keyhole_bed` picker views
3. The **16 tree front views**
4. `chicken_coop`, `shed`, `compost_bay`, `greenhouse_tunnel`
5. Everything else

The **glossy vocabulary is independent of the art** — it is text, it needs no renders, and it
can land first. The 16 elements with no vocabulary in either path are the cheapest real
improvement in this whole brief.

---

## Self-check before delivering

Run on every file and paste the output. **Do not report a delivery complete on visual
inspection alone** — the checkerboard bug passed visual inspection.

```python
from PIL import Image
import numpy as np, sys
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA'); a = np.asarray(im)
    A = a[..., 3]
    ys, xs = np.nonzero(A > 8)
    h, w = A.shape
    margin = min(ys.min(), xs.min(), h - 1 - ys.max(), w - 1 - xs.max()) / min(h, w)
    print(f'{f}\n'
          f'  corners alpha    {[int(A[0,0]), int(A[0,-1]), int(A[-1,0]), int(A[-1,-1])]}   -> all 0\n'
          f'  transparent frac {(A == 0).mean():.2f}                -> > 0.05\n'
          f'  margin           {margin:.3f}             -> <= 0.03\n')
```

Then, for each file, **downscale to 24×24 and look at it**. If you cannot tell a chicken coop
from a shed, or a 2500 L tank from a 5000 L one, redraw the silhouette. That test is the whole
brief in one line.
