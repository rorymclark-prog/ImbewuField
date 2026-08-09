# Canopy art v2 — jagged crowns, no basins, real colour spread

This replaces `docs/CANOPY-ART-BRIEF.md`. Read that first for context, then follow this — the
requirements below are measured against what is currently on a rendered Planting sheet, and two
of them contradict the old brief.

Rory, on the current sheet 06: *"up the quality drastically and make sure the edge of the canopy
is varied — the canopy must not be a circle edge but a jagged leaf canopy."*

---

## The single biggest problem is not colour. It is that thirteen species share one drawing.

`lib/reference-feature-art.ts` maps **13 catalogue ids** to the same file,
`orchard-canopy-v1.png`, via the `ORCHARD_TREES` set:

    tree_guava, tree_natal_plum, tree_wild_plum, tree_waterberry, tree_other,
    tree_indigenous, tree_apple, tree_pear, tree_plum, tree_peach, tree_fig,
    tree_pomegranate, tree_olive

On Rory's sheet, "Wild plum", "Indigenous Shade Tree" and "Indigenous Shade Tree" are not similar
trees. They are **the same image drawn three times.** No amount of hue variation fixes that, and
it is the actual reason the sheet reads as "variants of themselves".

**So the first deliverable is not a redraw of 11 files. It is breaking the generic canopy into
distinct crowns.** See the file list at the bottom.

---

## Hard requirements

### 1. The crown edge must be jagged, and it must be jagged INSIDE the frame

This is the requirement most likely to be got wrong, and getting it wrong wastes the whole batch.

The renderer clips every canopy to a circle at its saved footprint. **Do not fight that by
drawing foliage that runs off the edge of the canvas** — it will be sliced back into a perfect
circle and the batch will look exactly like the current one.

Draw the crown so that:

- The **lobes** — the outermost leaf clusters — touch or nearly touch the frame edge (95–100% of
  the radius). This is what makes the tree fill its allocated ground.
- The **notches** between lobes pull back to roughly **72–85%** of the radius, and are **fully
  transparent**, not filled with soil, shadow or paper.
- The boundary between them is leaf-shaped: individual leaves and leaf clusters breaking the
  outline, not a smooth wobble. A hand-drawn scalloped circle is not what is being asked for.
- Lobe count and depth **vary per species** — a fig has few heavy sculptural gaps, a citrus is
  dense and only slightly broken, a moringa is airy and deeply cut.

The old brief said "subject fills the frame, ≤3% margin". **That is now wrong for canopies.**
Filling the frame edge-to-edge is what produced a circle. The margin is no longer uniform — it
is the notch depth, and it varies around the crown.

### 2. No basin. No soil. No mulch. No shadow. No ring of any kind.

Measured on the current files: the outer band (75–100% of radius) of `orchard-canopy-v1`,
`avocado-tree-v1` and `marula-tree-v1` is **56–70% brown pixels**, and foliage only reaches
81–87% of the radius. That brown band **is** the ring Rory has been asking about for weeks. It is
painted into the artwork.

Everything outside the leaves and the visible trunk must be **alpha 0**. If a pixel is not leaf,
fruit, branch or trunk, it is transparent. The renderer supplies whatever ground treatment is
needed; artwork that brings its own is what created this problem.

### 3. Colour must spread, and the spread must be in the distribution — not the range

The last batch was delivered reporting a 38.8° hue spread. Measured, **15 of 16 assets sat in a
17.0° band** and one outlier carried the whole number. That is the same clustering as the set it
replaced.

The target is a **genuine ≥45° spread in foliage hue across the set, with no more than three
assets within any 8° band.** Report the actual per-file foliage hue and the histogram, not the
min/max range.

Directions to spread into, all real and all South African:
- blue-green / grey-green: olive, waterberry
- deep saturated dark green: avocado, macadamia, litchi
- mid true green: citrus, mango, guava
- yellow-green: moringa, fig, pawpaw
- grey-silver green: wild olive, indigenous shade species

Within a single crown, value must also vary — sunlit upper leaves against shaded lower ones.
A flat-toned disc reads as plastic at any hue.

### 4. Top-down, and actually top-down

These composite onto an aerial photograph. Draw the crown as seen from directly above: leaves
radiating outward, the trunk visible only where the crown is open enough to show it, branch
structure foreshortened. No horizon, no side of the tree, no cast shadow.

---

## What "drastically higher quality" means here, concretely

The current set reads as a flat green disc with a texture on it. What is missing:

- **Layer depth.** Two or three tiers of foliage, with the lower tier visible through gaps in the
  upper. This is what makes an aerial crown read as a volume rather than a stamp.
- **Individual leaves at the edge.** The silhouette is where the eye judges quality. Leaf shape
  should be legible on the outer 20% of the crown even though the interior can be massed.
- **Branch structure showing through the gaps**, radiating from the trunk, foreshortened.
- **Fruit where the species has it**, scattered irregularly and partly occluded by leaves — not
  evenly dotted over the surface like a pattern fill.

Deliver at **2048×2048 RGBA** for canopies (up from 1024 — these composite large on a printed A2
sheet and the edge detail is the point). Keep detail meaningful at that size; do not add micro-
noise that vanishes.

---

## Files

**Priority 1 — break up the generic canopy.** These 13 ids currently share `orchard-canopy-v1`.
Draw six new distinct crowns; the remaining ids keep the generic as a fallback.

| new file | for | crown character |
|---|---|---|
| `indigenous-shade-v1.png` | `tree_indigenous` | Wide, deeply lobed, irregular — the biggest and most broken crown in the set |
| `wild-plum-v1.png` | `tree_wild_plum` | Rounded but open, fine leaves, deep notches |
| `guava-v1.png` | `tree_guava` | Low dense mound, small leaves, shallow notches |
| `olive-v1.png` | `tree_olive` | **Grey-silver green**, fine narrow leaves, airy and see-through |
| `waterberry-v1.png` | `tree_waterberry` | Dense glossy dark blue-green, tight lobes |
| `natal-plum-v1.png` | `tree_natal_plum` | Low shrubby, very dense, small round leaves |

`orchard-canopy-v1.png` itself is **redrawn** to serve the remaining deciduous ids
(`tree_apple`, `tree_pear`, `tree_plum`, `tree_peach`, `tree_fig`, `tree_pomegranate`,
`tree_other`) — an open pruned goblet with visible framework through the gaps.

**Priority 2 — redraw the nine existing dedicated canopies** to the same standard:

`pawpaw-tree-v1` · `moringa-tree-v1` · `avocado-tree-v1` · `mango-tree-v1` ·
`litchi-tree-v1` · `macadamia-tree-v1` · `citrus-tree-v1` · `marula-tree-v1` ·
`kei-apple-tree-v1`

Path: `public/render-assets/reference-blueprint/<file>`. Keep the `-v1` names — the union type in
`lib/reference-feature-art.ts` is keyed to them, and renaming means a code change on our side for
no benefit.

---

## Self-check to run and paste

For every delivered file, report:

1. Dimensions, mode, and that all four corners are alpha 0.
2. **Radial alpha profile** — mean alpha in each 5% radius band from 70% to 100%. This is the
   jaggedness measurement. A circular crown shows a cliff; a jagged one shows a gradual falloff
   with the outer bands well below 100%.
3. **Non-green fraction in the 75–100% band.** Must be near zero. This is the basin check.
4. **Foliage hue** (mean hue of pixels with alpha > 0.5 and green dominant), per file, plus the
   histogram across the set.
5. Downscale to 96px and look at it. If it is a green circle, the edge work failed.

Do not report a range where a distribution is asked for.

---

## What is happening on our side, so you know why this matters

The renderer currently draws a circle **five times** around every canopy: a cream casing ring, a
radial soil gradient, a mulch stipple, a clip at the footprint, and a dark outline stroke. All
five are being changed to follow the artwork's own alpha instead of the footprint circle.

That work and this artwork have to land together. New art under the current renderer would still
come out as a disc; the new renderer under the current art would expose the painted brown band
with nothing to hide it. Neither half is worth shipping alone.
