# Element Art Brief — Batch 2 (Design Studio & Map site-element icons)

**Status:** ready for generation
**Branch:** worktree currently on `codex/crop-art` — run `git branch --show-current`
before starting; if Claude has since moved this brief to its own branch, commit
there instead. Either way: **one commit on one branch, art files only.**
**Requested by:** Rory, 2026-08-15 — sweep of every catalog in the app that still
shows a raw emoji instead of real art. Group A of that sweep (the highest-value
group) is this brief. `PATTERN_META`/`FOOD_GROUND_META` are out of scope —
deferred separately, do not touch them.

## What this is

Six catalogs across five files render a raw emoji today instead of art:

| # | File | Catalog | Rows | Where it renders |
|---|---|---|---|---|
| 1 | `lib/design-elements.ts` | `CATEGORY_META` | 6 | category tabs/badges (Design Palette, print worksheet) |
| 2 | `lib/design-elements.ts` | `GROUND_FEATURES` | 10 | ground-feature picker (currently text+color only — see note below) |
| 3 | `lib/design-elements.ts` | `ELEMENT_CATALOG` gap | 1 of 79 (`playground`) | Design Palette element cards |
| 4 | `lib/site-elements.ts` | `ELEMENT_META` | 9 | the interactive site Map — marker pins, palette chips, edit-sheet headers |
| 5 | `lib/water-points.ts` | `WATER_POINT_CATEGORIES` | 7 | water-point picker buttons on the Map |
| 6 | `lib/field-journal.ts` | `JOURNAL_CATEGORIES` | 7 | Field Journal entry list + entry sheet |
| 7 | `lib/weather.ts` | `describeWeatherCode()` | 11 label branches (9 unique glyphs) | Weather widget — current conditions + 7-day strip |

That's 51 catalog rows. **This is not 51 pieces of art.** Several of these
systems describe the exact same real-world object under a different key —
a JoJo tank shows up in three different catalogs — and `ELEMENT_CATALOG`
already has 77 of its 79 elements illustrated in `public/element-art/`. This
brief's whole first job is the dedup: work out which rows are genuinely new
subjects, and which rows should point at art that already exists or that
another row in this same brief is already commissioning.

**Net result specified below: 29 new PNGs, plus 14 existing `public/element-art/`
files reused via new lookup-table entries, covering all 51 rows.**

This is a sibling to `docs/ELEMENT-ART-BRIEF.md` (the original element brief —
read it first, this brief only overrides where it says so explicitly) and to
`docs/CROP-ART-BRIEF.md` (same self-check rigor, same "don't touch the catalog
files" boundary). Where a concept in this batch is genuinely a harvested
product rather than a garden object, this brief explicitly borrows the crop
brief's product-photo convention instead of inventing a third thing — see the
Views section.

**Known dead data, called out so nobody "fixes" it by accident:** `GROUND_FEATURES.icon`
and `WATER_POINT_CATEGORIES.icon` are not rendered anywhere in the live app today
(`DesignPalette.tsx`'s `renderAreaChips()` draws a color-swatch dot + label text for
ground features, never `gf.icon`; `Map.tsx`'s water-point picker buttons draw `{c.v}`
+ `c.color`, never `c.icon`). Commissioning art for these two catalogs has **no visible
payoff today** — it only pays off once a follow-up UI change actually renders an icon
there. That UI change is out of scope for this brief. We're still commissioning the
art now (cheaper to do it once, in the same sweep, than to re-open this brief later),
but don't expect anything to visibly change on those two screens the moment these
files land.

## Views: four registers, picked per concept

The original element brief established three: **FRONT** elevation for living
things (recognizable by side silhouette), **OBLIQUE 3/4** for built objects
with real volume (30° above horizon, rotated 35° off front face, orthographic,
no vanishing point — see that brief for the exact geometry), and **TOP** view
for ground/footprint concepts (the plan shape *is* the picture, no second
asset needed).

This batch needs a fourth, because several of these catalogs are abstract or
atmospheric concepts that were never physical objects with a "front" —
weather conditions, a crossed-tools maintenance badge, a notepad. Call it
**ICONIC**: a simple, iconic small-object arrangement (sun, cloud, crossed
tools) drawn with the same soft dimensional shading as the other three
registers — not flat vector, not a literal photographic elevation of a thing
that doesn't have one. Same discipline, different subject class. This mirrors
how the crop brief already added its own fourth register (three-quarter
product shot) on top of the original three; this brief's addition is ICONIC
where the crop brief's was product-photo — one concept below (`journal_harvest`)
explicitly borrows the crop brief's product-photo view instead of either of
these two, because it *is* a harvested-product concept, not a garden object.

Per-concept view assignments are in the tables below (`view` column).

## Naming, dedup keys, and where files go

**Destination:** `public/element-art-2/<key>.png` for every newly commissioned
asset in this brief — a new folder, so nothing here can collide with or
overwrite the existing `public/element-art/` library. **One exception:**
`playground.png` goes into the *existing* `public/element-art/` folder,
because it fills a gap in the existing `ELEMENT_CATALOG` system (77 of 79
elements already have art there) rather than starting a new one.

**Key naming:** bare catalog key where it's unambiguous, prefixed where the
multi-file scope of this brief creates a real collision. Two concrete
collisions this avoids:
- `WATER_POINT_CATEGORIES` has a value `'Other'` (→ dedupes to the existing
  `other_water.png`) and `JOURNAL_CATEGORIES` has a key `'other'` (needs new
  art). A bare `other.png` would silently serve whichever one Codex generates
  last. Journal's is prefixed: `journal_other.png`.
- All 6 new `JOURNAL_CATEGORIES` assets are prefixed `journal_*` (`journal_planting`,
  `journal_harvest`, `journal_pest`, `journal_maintenance`, `journal_training`,
  `journal_other`) because their bare words (`planting`, `harvest`, `pest`...)
  are exactly the kind of generic word likely to get reused by a future catalog.
- The 3 new `CATEGORY_META` assets are prefixed `category_*` (`category_earthworks`,
  `category_growing`, `category_animal`) for the same reason — `growing` and
  `animal` are too generic to leave bare in a folder that also has specific
  plant and creature art in it.
- The 9 new weather assets are prefixed `weather_*` (`weather_clear`,
  `weather_partly_cloudy`, `weather_overcast`, `weather_fog`, `weather_drizzle`,
  `weather_rain`, `weather_snow`, `weather_thunderstorm`, `weather_unsettled`) —
  groups the set together in the folder listing and keeps `clear`/`fog`/`rain`
  from colliding with anything else.
- `GROUND_FEATURES` keys (`boundary`, `house`, `patio`, `driveway`, `lawn`,
  `orchard`, `cleared`, `staple_garden`) and `water-points.ts` keys (`spring`,
  `well`, lowercased from the type's `'Spring'`/`'Well'`) have no collisions
  in this batch — left bare, matching their exact catalog key.

**Lookup file (not Codex's job — a note for the record):** the wiring pattern
should mirror `lib/crop-art.ts`/`getCropArt()`, as a new `lib/element-art-2.ts`
exporting `ELEMENT_ART_2: Record<string, string>` + `getElementArt2(key): string | undefined`.
**Not `getElementArt`** — that name is already taken by `lib/design-studio-shell-icons.ts`'s
unrelated `getElementArt(def: DesignElementDef): ElementArt` (a different
signature, for the unlinked Design Studio Shell v2). Reusing the name would
either collide or get silently shadowed depending on import order. Claude
wires this in a separate follow-up commit — Codex does not create this file,
does not touch `lib/design-studio-shell-icons.ts`, and does not touch any of
the five catalog `.ts` files.

## Hard technical rules (same as `ELEMENT-ART-BRIEF.md` and `CROP-ART-BRIEF.md`)

- **1024×1024 PNG, RGBA.** All four corners fully transparent (alpha = 0).
- **No baked ground, shadow, or background.** Every one of these renders on
  its own UI chrome (chips, pins, list rows, badges) — a baked shadow/ground
  plane will look wrong on all of them. This applies to the TOP-view ground
  swatches too: fade the swatch edges to transparent, don't box them in a
  baked square.
- **Nothing else in frame.** No text, no labels, no borders, no watermark.
- **Subject fills the frame**, ≤3% transparent margin — these render as small
  as 16-24px (site-element pins render at fontSize 16-18; the print worksheet
  renders `CATEGORY_META` icons at fontSize 6-9, smaller than anything in the
  crop or original element brief — leave *no* wasted margin on the category
  and journal assets especially).
- **One consistent treatment across the whole set** — soft diffuse daylight
  from upper-left, soft-shaded illustration (not photo, not flat vector).
  Match the existing `public/element-art/` set's style (see `jojo_2500.png`,
  `gate.png`, `shed.png` for reference) so the app doesn't end up with two
  visibly different art styles in the same picker.
- **Must read correctly at 24×24px**, and for the `CATEGORY_META` assets,
  at ~16×16px (the print-worksheet size) — design the silhouette first, test
  the downscale.
- **Documented failure mode, check for it explicitly:** a PNG can declare an
  alpha channel, have every pixel's alpha filled to 255, and paint a solid
  checkerboard-colored square over anything it's placed on — a file-header
  check can't catch this, only decoding the actual pixels can. See the
  self-check script below.

## Colour discipline

Where a catalog entry already has a fixed hex in its source `.ts` file (every
`GROUND_FEATURES`, `WATER_POINT_CATEGORIES`, and `JOURNAL_CATEGORIES` row
does), **the art's dominant visible mass should read as an elaboration of
that exact hex**, not a divergent hue — the icon and the swatch/pin dot next
to it need to look like the same object, not two unrelated color choices.
Where there's no existing hex to anchor to (all `weather_*`, `category_*`,
`spring`, `well`, `boundary`, `playground`), use the anchor hex given in the
tables below, drawn from the same materials table the original element brief
established:

- **Water:** JoJo green `#2E6B4F` / black poly `#2A2A28` / galvanised `#9BA3A6`
- **Timber:** warm pine `#B08A56` / weathered grey `#8E8778`
- **Iron / roofing:** cool zinc `#A7AEB2` / rusted red-oxide `#8C4A32`
- **Earth / masonry:** `#9A7A57` / breeze-block grey `#B4B0A6`

## Concept tables

Each table is one source catalog. `art` = final decision: either a new key to
commission (destination noted) or `→ reuse <file>` pointing at an existing
`public/element-art/` file. Skip rows need no action.

### 1. `CATEGORY_META` (`lib/design-elements.ts`, 6 rows)

| key | icon (retiring) | label | art | view | anchor hex | notes |
|---|---|---|---|---|---|---|
| water | 💧 | Water | → reuse `jojo_2500.png` | — | — | a tank is the single most recognizable "water" object on this app's own farms; reused a 3rd time (already the dedupe target for `jojo_tank` and `Tank` below) — free reuse, no extra cost |
| earthworks | ⛏️ | Earthworks | **NEW** `category_earthworks` | OBLIQUE | `#9A7A57` earth, `#B08A56` handle, `#9BA3A6` blade | a mattock mid-swing into a cut earth bank — small tool+earth vignette, not a full terrace scene |
| structure | 🏚️ | Structures | → reuse `shed.png` | — | — | generic structure category, existing shed art is the obvious generic |
| growing | 🌱 | Growing | **NEW** `category_growing` | FRONT | `#4E8B3B` leaf, `#6B5230` soil | a single upright seedling, two true leaves, small soil mound — deliberately generic, not any one species |
| animal | 🐔 | Animals | **NEW** `category_animal` | FRONT | `#6B4A2E` plumage, `#2A2A28` barring, `#C23B2E` comb | **judgment call:** NOT a reuse of `chicken_coop.png` — a coop structure reads as "Structures", not "Animals". Single standing hen, side profile |
| access | 🚪 | Access | → reuse `gate.png` | — | — | identical concept to `site-elements.ts`'s `gate` below |

### 2. `GROUND_FEATURES` (`lib/design-elements.ts`, 10 rows)

Register: **TOP** (a small overhead ground-texture patch, edges fading to
transparent) for the true area/ground-cover concepts, matching the "the plan
shape is the picture" logic from the original brief — except `house` (a real
building volume) and `boundary` (a point marker, not a texture), which get
their own registers below.

| key | icon (retiring) | label | code color | art | view | anchor hex | notes |
|---|---|---|---|---|---|---|---|
| boundary | 🚩 | Property boundary | `#8CEB6A` | **NEW** `boundary` | OBLIQUE | peg `#B08A56`, ribbon `#8CEB6A` | a wooden survey peg driven into the ground, small ribbon flag tied at the top — a point marker, not a ground texture, so it breaks from this table's TOP default |
| house | 🏠 | House / Building | `#8A8D91` | **NEW** `house` | OBLIQUE | wall `#8A8D91`, roof `#6E7175` | deliberately institutional-neutral — no doors/windows styled specifically "home", since the label covers a crèche classroom or storeroom too (see the code comment on this key) |
| patio | ▦ | Patio / Paving | `#C7C3BB` | **NEW** `patio` | TOP | `#C7C3BB`, joints `#A8A39A` | small paved/tiled patch from directly above |
| driveway | 🛣️ | Driveway | `#12140F` | **NEW** `driveway` | TOP | `#12140F`, wear-lines `#3A3A38` | compacted tar/gravel strip from above, faint tyre-wear lines |
| lawn | 🟩 | Lawn | `#8FBF6B` | **NEW** `lawn` | TOP | `#8FBF6B` | mown grass patch, fine blade texture |
| veg_garden | 🥬 | Veg garden | `#4E8B3B` | → reuse `veg_bed.png` | — | — | **judgment call, flagged for a visual check before wiring:** `veg_bed.png` is a top-down rowed-bed image, same visual register as this table, but it's framed with a wooden bed border (it's `ELEMENT_CATALOG`'s single-bed picker art, not a footprint-scale ground texture). Reused here as a legend-chip icon, not as a stretched polygon fill — fine for that use, wrong if anyone ever tiles it across an arbitrary-shaped ground polygon. Reconsider before that use appears. |
| orchard | 🌳 | Orchard / food forest | `#2F7A4A` | **NEW** `orchard` | TOP | `#2F7A4A` | 4-6 small round canopy dots from directly above, faint trunk shadows between them |
| cleared | ⬚ | Cleared / other | `#B8AF9E` | **NEW** `cleared` | TOP | `#B8AF9E` | bare disturbed earth, minimal texture, a few scattered stones |
| staple_garden | 🌽 | Staple garden | `#96A32C` | **NEW** `staple_garden` | TOP | `#96A32C` | standing staple-crop rows (maize-forward, matching the code's own stated default) from directly above — the code comment is explicit that this must read olive-gold from the air, distinct from `lawn`'s soft green and `veg_garden`'s kitchen green |
| terrace_bank | 🪜 | Terrace bank / level change | `#8A6D3B` | → reuse `terrace.png` | — | — | confirmed by inspection: `terrace.png` is already a top-down strip render of a retaining bank — exactly this table's register, safe reuse |

### 3. `ELEMENT_CATALOG` gap (`lib/design-elements.ts`, 1 of 79 rows)

| key | icon (retiring) | art | destination | view | anchor hex | notes |
|---|---|---|---|---|---|---|
| playground | 🛝 | **NEW** `playground` | **`public/element-art/playground.png`** (existing folder — not `element-art-2`) | OBLIQUE | timber `#B08A56`, galvanised `#9BA3A6`, slide `#D9552C` | the only genuinely new `ELEMENT_CATALOG` asset — small slide + swing-frame combo, same structure-category material discipline as `shed.png`/`gate.png` |

`tree_guava` (icon 🍈, `deprecated: true`) is excluded — hidden from new
designs, legacy-render-only, emoji fallback is fine for a deprecated entry.

### 4. `ELEMENT_META` (`lib/site-elements.ts`, 9 rows — the interactive Map)

All 9 dedupe cleanly to existing `public/element-art/` files. **Zero new art
needed for this catalog** — this table is entirely lookup-table wiring.

| key | icon (retiring) | label | art |
|---|---|---|---|
| jojo_tank | 🛢 | JoJo / Water Tank | → reuse `jojo_2500.png` |
| tap | 🚰 | Tap Point | → reuse `tap_point.png` |
| borehole | 💧 | Borehole | → reuse `borehole.png` |
| pond_dam | 🌊 | Pond / Dam | → reuse `dam.png` |
| compost | ♻️ | Compost / Mulch Basin | → reuse `greywater_basin.png` |
| gate | 🚪 | Gate | → reuse `gate.png` |
| beehive | 🐝 | Beehive | → reuse `beehive.png` |
| nursery | 🌱 | Nursery | → reuse `nursery_table.png` |
| tree | 🌳 | Tree | → reuse `tree_other.png` |

Confirmed by visual inspection: `greywater_basin.png` is a top-down circular
mulch/compost basin with plantings — a reasonable match for "Compost / Mulch
Basin", though it's a softer semantic match than the other eight (which are
near-exact). `tree_other.png` is a plain FRONT-elevation single tree, a clean
match for the generic "Tree" pin.

### 5. `WATER_POINT_CATEGORIES` (`lib/water-points.ts`, 7 rows)

| key | icon (retiring) | code color | art | view | anchor hex | notes |
|---|---|---|---|---|---|---|
| Dam | 🌊 | `#1A5F8C` | → reuse `dam.png` | — | — | |
| Pond | 💧 | `#2D7BAA` | → reuse `pond_small.png` | — | — | |
| Borehole | ⚙ | `#5C5040` | → reuse `borehole.png` | — | — | |
| Spring | ♒ | `#3A9E7C` | **NEW** `spring` | OBLIQUE | rock `#9BA3A6`, water `#3A9E7C`, fern `#4E8B3B` | natural rock-lined pool, water bubbling up, ferns at the rim — no dam wall/berm, the thing that visually separates it from Dam/Pond (which are engineered) |
| Well | ⭕ | `#7A5230` | **NEW** `well` | OBLIQUE | masonry `#9A7A57`, timber crossbeam `#B08A56`, opening `#7A5230` | traditional dug well — circular stone/brick ring wall, simple timber crossbeam over the opening |
| Tank | 🔵 | `#235E86` | → reuse `jojo_2500.png` | — | — | |
| Other | 📍 | `#8C7A62` | → reuse `other_water.png` | — | — | |

Key lowercased from the type's capitalized values (`'Spring'` → `spring.png`,
`'Well'` → `well.png`), matching the lowercase convention of the existing
`public/element-art/` library.

### 6. `JOURNAL_CATEGORIES` (`lib/field-journal.ts`, 7 rows)

| key | icon (retiring) | ink hex | art | view | anchor hex | notes |
|---|---|---|---|---|---|---|
| planting | 🌱 | `#1F4D2B` | **NEW** `journal_planting` | OBLIQUE | soil `#6B5230`, trowel `#9BA3A6`/`#B08A56`, leaf `#2C5C3A` | the ACT of planting — a hand trowel setting a seedling into a dug hole. Deliberately distinct from `category_growing` (a static single seedling, the *state* of growing, not the act) |
| harvest | 🧺 | `#8A5B0F` | **NEW** `journal_harvest` | **product-photo** (crop-brief convention, not this brief's own registers) | basket `#8A5B0F`, produce `#E07A2C`/`#5FA83D` | **judgment call, rejected dedupe:** NOT `market_stall.png` — confirmed by inspection that's a stall *structure*, wrong concept for "a harvest happened today". A woven basket brimming with generic mixed produce, borrowing `CROP-ART-BRIEF.md`'s three-quarter product-shot view since this genuinely is a harvested-product concept |
| weather | 🌦️ | `#1F5C82` | → reuse **this batch's own** `weather_partly_cloudy` (see table 7) | — | — | internal cross-reference, not a pre-existing-library reuse — the journal's generic "weather happened" bucket doesn't need its own 8th weather asset |
| pest | 🐛 | `#9B3630` | **NEW** `journal_pest` | FRONT | leaf `#6B8F4A` (duller than a healthy leaf, deliberate), pest `#9B3630` | a leaf with visible chew-holes and a small caterpillar/beetle |
| maintenance | 🛠️ | `#5C5040` | **NEW** `journal_maintenance` | OBLIQUE | steel `#9BA3A6`, timber `#B08A56`, `#5C5040` | crossed hoe + secateurs (farm-relevant tools, not a generic mechanical wrench) |
| training | 👥 | `#5C3F86` | **NEW** `journal_training` | FRONT | `#5C3F86` flat silhouette | two simplified, faceless silhouette figures, one gesturing toward a plant/board — flat silhouette treatment deliberately, sidesteps drawing any specific likeness |
| other | 📝 | `#5C5040` | **NEW** `journal_other` | OBLIQUE | notepad `#E8E0CC`, pencil `#B08A56`/`#2A2A28`, cover `#5C5040` | small spiral notepad, pencil laid diagonally across it |

### 7. `describeWeatherCode()` (`lib/weather.ts`, 11 label branches → 9 unique assets)

Note the function is `describeWeatherCode(code: number)`, not `weatherDescription()`.
Two glyphs are already shared by two label branches each in the source code
(Rain/Showers both render 🌧️; Snow/Snow showers both render 🌨️) — this brief
keeps that collapse rather than forcing 11 distinct assets.

Register: **ICONIC** for all 9 (see Views section above) — these five (`overcast`
through `thunderstorm`) are all cloud-family glyphs at a similar hue, so lean on
**shape**, not just color, to keep them apart at 24px: no-sun vs. sun-peeking,
dot-rain vs. streak-rain, distinct snowflake silhouette, lightning bolt as an
unambiguous shape flag for the storm.

| labels covered | icon (retiring) | art | anchor hex | notes |
|---|---|---|---|---|
| Clear | ☀️ | **NEW** `weather_clear` | `#F2B93B` | bright sun, radiating rays, no cloud |
| Partly cloudy | 🌤️ | **NEW** `weather_partly_cloudy` | sun `#F2B93B`, cloud `#E8E8E4` | sun partially behind one puffy cloud — also the journal's `weather` category reuse target |
| Overcast | ☁️ | **NEW** `weather_overcast` | `#9A9A96` | solid grey cloud bank, no sun |
| Fog | 🌫️ | **NEW** `weather_fog` | `#B8C0C4` | horizontal layered wisps/bands — distinct SHAPE from the cloud glyphs, not just paler |
| Drizzle | 🌦️ | **NEW** `weather_drizzle` | cloud `#ABABA7`, rain `#6FA8D6` | pale cloud, fine light dotted rain, no sun (kept sun-free on purpose so it can't be confused with partly-cloudy at 24px, even though the retiring emoji itself shows a sun) |
| Rain, Showers | 🌧️ | **NEW** `weather_rain` | cloud `#6E6E6A`, rain `#3A7BC8` | darker cloud, heavier rain streaks — visibly heavier than drizzle |
| Snow, Snow showers | 🌨️ | **NEW** `weather_snow` | cloud `#9A9A96`, flakes `#F4F6F8`/`#C7D6DE` | a few distinct six-pointed snowflakes |
| Thunderstorm | ⛈️ | **NEW** `weather_thunderstorm` | cloud `#4A4A48`, bolt `#F2C230`, rain `#3A7BC8` | darkest cloud in the set, jagged lightning bolt as the unambiguous shape flag |
| Unsettled (fallback) | 🌥️ | **NEW** `weather_unsettled` | cloud `#ABA9A2`, sun `#E8B23B` | mixed sun/cloud, more cloud coverage than partly-cloudy — the hazy in-between catch-all |

## Totals

- **51 catalog rows** across 7 sub-catalogs in 5 files.
- **29 new PNGs** to commission: 3 into `category_*`, 8 into `GROUND_FEATURES`
  keys, 1 `playground` (→ existing `public/element-art/`), 2 into water-points
  (`spring`, `well`), 6 into `journal_*`, 9 into `weather_*`. 28 go into the new
  `public/element-art-2/`; 1 (`playground`) goes into the existing folder.
- **14 distinct existing `public/element-art/` files reused** via 19 row-level
  dedupe references (`jojo_2500.png` alone is reused 3×: `CATEGORY_META.water`,
  `ELEMENT_META.jojo_tank`, `WATER_POINT_CATEGORIES.Tank`).
- **1 internal reuse within this batch** (`JOURNAL_CATEGORIES.weather` → this
  brief's own `weather_partly_cloudy.png`, not a pre-existing file).

## Mandatory self-check

Same discipline as both sibling briefs — visual inspection alone has passed a
baked-in-transparency bug before. Run this against every new file before
considering any of them done:

```python
from PIL import Image
import sys

for path in sys.argv[1:]:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    assert (w, h) == (1024, 1024), f"{path}: wrong size {w}x{h}"
    corners = [im.getpixel((0, 0)), im.getpixel((w-1, 0)),
               im.getpixel((0, h-1)), im.getpixel((w-1, h-1))]
    for i, (r, g, b, a) in enumerate(corners):
        assert a == 0, f"{path}: corner {i} alpha={a}, expected 0"
    alpha = im.split()[-1]
    transparent = sum(1 for p in alpha.getdata() if p == 0)
    frac = transparent / (w * h)
    assert 0.10 < frac < 0.85, f"{path}: transparent fraction {frac:.2f} looks wrong (subject too small or too large)"
    print(f"{path}: OK ({frac:.0%} transparent)")
```

Then the manual test: downscale each new PNG to 24×24 (and, for the 3
`category_*` assets, also to 16×16 — that's their actual print-worksheet
size) and look at it without reading the filename. Pay particular attention
to these confusable groups:

1. **The 9 weather glyphs** — 5 of them (overcast/fog/drizzle/rain/thunderstorm)
   are grey-cloud-family at similar hue. Lean on shape (fog's horizontal bands,
   the lightning bolt, snow's flake silhouette) — if two of them read as "some
   kind of cloud" and nothing more specific at 24px, redraw.
2. **The 4 built-structure OBLIQUE assets** (`house`, `well`, `playground`,
   `category_earthworks`) — all timber/masonry-toned small buildings/objects.
   Check `house` doesn't collide with the existing `shed.png` silhouette, and
   `well` doesn't read as a generic tank.
3. **`category_growing` vs. `journal_planting`** — a static seedling vs. a
   hand-plus-trowel planting scene. These need to read as different concepts
   (state vs. action) at 24px, not just "two green things".
4. **`spring` vs. the existing `dam.png`/`pond_small.png`** — spring must read
   as natural/unbuilt (no dam wall, no straight edges) even at 24px, or the
   whole reason it isn't deduped against Dam/Pond falls apart.

If you can't tell what it is without the filename, redraw it — shape/value
contrast needs more separation, not a color nudge.

## What Codex should do

1. Generate all 29 new PNGs per the tables above: 28 into `public/element-art-2/`
   (new folder), 1 (`playground.png`) into the existing `public/element-art/`.
2. Run the self-check script against all 29 new files; fix any failures.
3. Do the manual 24×24 (and 16×16 for `category_*`) downscale-and-look pass,
   paying particular attention to the four confusable groups listed above;
   redraw and recommit as needed.
4. Commit everything to whichever branch this worktree is on (`codex/crop-art`
   at the time this brief was written — confirm with `git branch --show-current`
   before starting, Claude may have moved this to its own branch by the time
   you run). Do not push, do not open a PR — Claude handles push, PR, CI
   monitoring, and merge.
5. **Do not touch any of:** `lib/design-elements.ts`, `lib/site-elements.ts`,
   `lib/water-points.ts`, `lib/field-journal.ts`, `lib/weather.ts`,
   `lib/design-studio-shell-icons.ts`. Do not create `lib/element-art-2.ts`.
   The art files are self-contained; wiring the 29 new files + the 14 existing-file
   dedupe references into the app (a new `lib/element-art-2.ts` + `getElementArt2()`,
   plus the one-line `art:` addition to `ELEMENT_CATALOG`'s `playground` entry)
   is a separate commit Claude makes once the art lands.
