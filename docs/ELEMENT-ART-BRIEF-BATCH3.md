# Element art — Batch 3 (the last 16)

Batch 2 landed: 60 assets wired, live in both pickers. **This finishes the library.**

Read `element-art-brief-batch2.md` for the hard rules — they are unchanged and non-negotiable:
1024×1024 RGBA, all four corners alpha 0, no ground/soil/shadow/background, subject fills the
frame (≤3% margin), one shared treatment, and **it must read at 24 px**.

Two corrections from what came back last time, both measured. Fix these at source rather than
letting them be fixed in post again:

**1. Deliver at 1024, but know the app downsizes to 192.** Batch 2 arrived at ~1.3 MB per file —
78 MB for a set the app draws at 24–56 px. That is now 3.4 MB. Nothing to change in how you
draw; just don't add detail that only survives above 200 px, because nobody will ever see it.

**2. Within a size family, size is the whole message.** The four JoJo tanks came back at drawn
width/height ratios of 0.78 / 0.69 / 0.77 / 0.90 for 1000 / 2500 / 5000 / 10000 L — non-monotonic,
with the 2500 L drawn *slimmer* than the 1000 L, and four identical cylinders at 24 px. **When a
family differs only in capacity, draw the subject at a size proportional to its real dimension
within the frame, sharing a common ground line.** A test now enforces it for the tanks.

---

## Priority 1 — the six trees (front elevation)

Rory: *"all trees must have front view now in the pickers."* These six are the only gap. Every
other tree in the catalogue is done.

All temperate / Mediterranean fruit, all deciduous, all pruned to an open goblet or a low
central leader in a South African orchard — **not** the tall dense domes of the subtropical set
already delivered. That difference in habit is the point: they should look like a different
kind of orchard.

| id | Name | Ø | Front elevation | Foliage |
|---|---|---|---|---|
| `tree_apple` | Apple Tree | 4 m | Low open goblet on a short trunk, pruned framework visible through the crown, oval leaves | `#6E9A4E` mid green |
| `tree_pear` | Pear Tree | 5 m | Distinctly **upright and narrow**, more vertical than the apple, glossy leaves | `#5E9048` mid green, slight blue cast |
| `tree_plum` | Plum Tree | 4 m | Rounded open head, finer twiggy structure, **reddish-purple fruit** | `#5A8C56` mid green |
| `tree_peach` | Peach Tree | 4 m | Low vase shape, **long narrow willow-like leaves** — the silhouette cue | `#7FA845` yellow-green |
| `tree_fig` | Fig Tree | 5 m | Wide low spreading, few heavy limbs, **large deeply-lobed leaves**, sculptural gaps | `#6A9952` mid yellow-green |
| `tree_pomegranate` | Pomegranate | 3 m | Multi-stemmed shrubby, fine glossy leaves, **bright red-orange fruit** | `#7E9E4A` bright yellow-green |

At 24 px, four of these are green blobs unless the silhouette and the fruit carry them. **Pear
upright, peach vase-with-narrow-leaves, fig wide-and-lobed, pomegranate shrubby-with-red-fruit.**
If apple and plum end up identical, put the plum's fruit colour to work.

## Priority 2 — four water fittings (oblique ¾)

Small, technical, and currently the only things in the water palette still drawn as line glyphs.

| id | Name | Size | Notes |
|---|---|---|---|
| `first_flush` | First-Flush Filter | Ø0.4 m | Vertical pipe tee with a clear chamber and a drain cock at the bottom |
| `pump_filter` | Pump & Filter | Ø0.6 m | Small pump on a base + cylindrical filter housing, hoses either side |
| `greywater_diverter` | Greywater Diverter & Filter | Ø0.6 m | Y-junction valve with a lever, mesh basket visible |
| `other_water` | Other water thing | Ø1.5 m | **Deliberately generic** — a plain valve/fitting with no species or brand cue |

These three fittings look alike at 24 px. Separate them by **overall form**: first-flush is
tall and thin, pump-filter is a wide low pair, diverter is a Y.

## Priority 3 — four structures + one animal (oblique ¾)

| id | Name | Size | Notes |
|---|---|---|---|
| `kraal` | Kraal | 6×6 m | Circular stock enclosure — stacked thorn branches or timber poles, one gap for a gate. Not a rectangular pen |
| `washline` | Washing Line | 3×0.3 m | Two posts, sagging lines, a couple of pegs. Nothing hanging |
| `sign` | Sign | 0.5×0.1 m | A single board on a post, blank face — **no lettering** |
| `other_structure` | Other structure | 2×2 m | Deliberately generic small shed-like box, no material cue |
| `water_trough2` | Livestock Trough | 0.6×2 m | Long concrete trough. Must read differently from `water_trough` — heavier, ground-level, hoofworn |

## Priority 4 — one earthwork (top view)

| id | Name | Size | Notes |
|---|---|---|---|
| `terrace` | Terrace / Retaining Bank | 2.5×10 m | From above: a long level bench with a stone or earth retaining face along the downhill edge, the level tread planted or bare. Must read apart from `berm`, which is a raised bank with no bench |

---

## Naming and delivery

`public/element-art/<exact catalogue id>.png` — underscores kept: `tree_pomegranate.png`,
`water_trough2.png`, `greywater_diverter.png`.

Run the self-check from batch 2 on every file and paste the output. Then **downscale to 24×24
and look at it.** If you cannot tell the pear from the apple, or the first-flush from the pump,
redraw the silhouette. That test is the brief.

When these sixteen land the catalogue is complete: every non-deprecated element a farmer can
place will have its own drawing in the picker.

---

## Correction batch — pickers that break the FRONT-elevation rule

Rory, looking at the two side by side in the palette: *"natal plum and wilplum are the same
thing? also if not both need to be front view"*.

They are not the same plant, and the catalogue already says so — **Natal Plum** is
`Carissa macrocarpa`, a 3 m thorny coastal shrub with white flowers and red fruit; **Wild Plum**
is `Harpephyllum caffrum` (umgwenya), a 7 m+ evergreen tree. Two entries, two sizes, correct.

The picker ART is what is wrong, and he named the rule this brief already sets: *"PICKER view is
chosen per element… **FRONT elevation** — living things. You recognise a banana by its side
silhouette, never from above. All trees, shrubs, hedges, grasses."*

| id | What ships today | What batch 2 specified | Fix |
|---|---|---|---|
| `tree_natal_plum` | a **sphere of foliage** — a clipped topiary ball, no trunk, no ground line, reads as a top view sitting beside its own neighbours' elevations | "low dense shrub, white flowers + red fruit" (`#275139`) | Re-render as a FRONT elevation: a low, dense, rounded shrub **standing on the ground** — foliage to the base, no visible clear trunk (it is a shrub, not a tree), glossy very dark green leaves, scattered white five-petalled flowers and red plum-shaped fruit, and thorns readable at the silhouette edge. It must be distinguishable at 24 px from `tree_kei_apple`, the other dense thorny fruiting shrub: Kei apple is looser and apricot-orange fruited, Natal plum is darker, glossier and red-fruited. |

Nothing else changes: `tree_wild_plum.png` is already a correct front elevation and stays.

**Why this matters beyond neatness.** The palette is a row of silhouettes the farmer scans, and a
sphere among elevations reads as a different KIND of thing — as if the app were showing that one
from above on purpose. The rule exists so a farmer can tell plants apart by shape alone at
thumbnail size, which is exactly the comparison Rory was making when he spotted it.
