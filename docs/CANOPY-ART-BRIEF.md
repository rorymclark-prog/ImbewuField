# Top-view canopy artwork — generation brief

Produce a replacement set of **overhead (plan-view) tree canopy illustrations** for
ImbewuField's Exact planting sheets. These are composited straight onto the plan with
`ctx.drawImage` and clipped to the tree's circular footprint — **the PNG's own alpha is the
silhouette.** Nothing else masks them.

This set replaces the existing one. Two things are wrong with the current assets and both
are measured, not guessed:

1. **Every dense-crowned asset has a brown mulch ring painted around the foliage.** In
   `orchard-canopy-v1`, `avocado-tree-v1` and `marula-tree-v1`, the outer band of the image
   (75–100% of the radius) is **56–70% brown pixels**. Foliage only reaches 81–87% of the
   radius. On the plan this reads as a dug basin around every tree, wider than the tree.
2. **The whole family is one colour.** Measured across the seven canopies, foliage hue spans
   **17.5°** (74°–91° HSV) — a 5% slice of the wheel. Every tree is a variant of the same
   yellow-green. Value spans only 16%.

---

## Hard rules — a delivery that breaks any of these is rejected

**Transparency**
- 1024×1024 PNG, RGBA, **genuine alpha**.
- All four corners must be **alpha 0**.
- Never export a "transparent preview" with the grey-and-white checkerboard baked into the
  pixels. This has shipped before: the file declared an alpha channel and was filled 255
  everywhere, and it painted an opaque square across the farm. A PNG header check cannot
  catch it — decode the pixels and confirm.

**No ground, at all**
- **No mulch ring, no soil, no basin, no bare earth, no drop shadow, no ground plane.**
- The app paints its own ground under the canopy. Any soil in the artwork is drawn twice.
- Foliage and fruit only. Trunk and main branch structure may show through gaps in an open
  crown — that is the tree, not the ground.

**Foliage must reach the frame**
- The crown is a circle **inscribed in the square**, touching the frame at the four
  midpoints. Corners transparent.
- Painted foliage must extend to **at least 97% of the crown radius**. No clear margin, no
  breathing room, no vignette. The app clips to a circle; anything short of the edge leaves
  a gap the plan fills with paper.
- The crown edge should be **irregular and leafy**, not a clean vector circle — but its
  extremes must touch the frame.

**View**
- Strict **orthographic overhead**. Straight down, no perspective, no three-quarter tilt, no
  horizon.
- Soft even diffuse daylight. No cast shadows on the ground, no strong directional key.
  Gentle self-shading within the crown only.

**Nothing else in the frame**
- No text, labels, scale bars, borders, circles, frames, watermarks or background colour.

---

## Style

Hand-painted botanical plate — the look of a printed permaculture design document, not a
photograph and not a flat vector icon. Visible individual leaves with painted edges, layered
depth in the crown, a radiating branch structure at the centre where the crown is open enough
to show it.

**Every asset in the set must share one treatment**: same brush character, same leaf-edge
weight, same light, same level of detail. Species read apart by **colour, leaf shape and
crown density** — never by one being glossier or more finished than its neighbour.

**It has to survive downscaling.** These are drawn at ~460 px on a printed sheet and as small
as 70 px on screen. At 70 px the leaf detail disappears and only three things survive:
overall colour, crown density, and **fruit colour**. Paint the fruit clearly and in its true
colour — it is the strongest identity signal at plan scale.

---

## The set — 16 species

Colour is the **average foliage colour** the finished crown should read as. Hit it as the
midtone; light and shade vary around it. These are deliberately spread: **70° of hue and 47%
of value**, against 17.5° and 16% today.

| Species | Botanical | Crown & leaf | Foliage colour | Fruit |
|---|---|---|---|---|
| **Moringa** | *Moringa oleifera* | Very open, airy, fine bipinnate leaflets; branch structure clearly visible | `#A2BC8B` pale silvery grey-green | none visible |
| **Marula** | *Sclerocarya birrea* | Broad open spreading crown, compound leaves, sparse | `#85A86F` matte grey-green | small round yellow drupes, scattered |
| **Indigenous shade tree** | generic | Wide **flat-topped** crown, fine leaflets, layered horizontal | `#77996B` muted grey-green | none |
| **Kei apple** | *Dovyalis caffra* | Dense low shrubby mound, small oval leaves, visible thorns | `#8DB255` bright pale yellow-green | small round apricot-orange fruit |
| **Pawpaw** | *Carica papaya* | Single crown of huge deeply-lobed palmate leaves radiating from one point | `#85A83F` vivid yellow-green | cluster of green-yellow fruit at the centre |
| **Banana clump** | *Musa* | Several rosettes of long paddle leaves, torn edges, strong midribs | `#709E35` strong yellow-green | one hanging green bunch |
| **Olive** | *Olea europaea* | Dense fine narrow leaves, silvery underside flashing | `#7F9373` grey-sage | tiny dark fruit, sparse |
| **Fig** | *Ficus carica* | Open, large deeply-lobed leaves, sculptural gaps | `#6A9952` mid yellow-green | few purple-brown figs |
| **Citrus** | *Citrus* spp. | Very dense rounded crown, small glossy oval leaves | `#4B843C` glossy mid-green | **bright orange fruit, plentiful** — the identity cue |
| **Macadamia** | *Macadamia integrifolia* | Dense, stiff leaves in whorls of three, slightly spiky outline | `#417543` mid-dark green | clusters of round green husks |
| **Wild plum** | *Harpephyllum caffrum* | Dense rounded, glossy drooping compound leaves | `#3A7041` deep green | small red oval fruit |
| **Mango** | *Mangifera indica* | Very dense heavy dome, long lance leaves, **bronze-red new growth at the tips** | `#30663B` dark green | few yellow-red fruit |
| **Waterberry** | *Syzygium cordatum* | Dense rounded, thick oval leaves, **reddish new growth** | `#346040` dark green | small purple berries in clusters |
| **Avocado** | *Persea americana* | Dense broad dome, large glossy leaves | `#2B5639` deep blue-green | dark green pear-shaped fruit |
| **Natal plum** | *Carissa macrocarpa* | Dense low shrub, small round glossy leaves, forked thorns | `#275139` very dark glossy green | white star flowers + red oval fruit |
| **Litchi** | *Litchi chinensis* | Very dense heavy dome, fine pinnate leaflets | `#264435` darkest — near black-green | **bright red fruit clusters** — the identity cue |

The two extremes are the calibration: **Moringa `#A2BC8B` is the palest and greyest, Litchi
`#264435` is the darkest.** If those two do not look like clearly different plants at 70 px
with the colour desaturated, the set has not spread far enough.

---

## Naming

`<species>-tree-v1.png`, lowercase, hyphenated —
`citrus-tree-v1.png`, `kei-apple-tree-v1.png`, `banana-clump-v1.png`,
`indigenous-shade-tree-v1.png`.

---

## Self-check before delivering

Run this on every file and paste the output. Do not report a delivery as complete on visual
inspection alone — the checkerboard bug passed visual inspection.

```python
from PIL import Image
import numpy as np, sys
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA'); a = np.asarray(im).astype(float)
    R, G, B, A = a[...,0], a[...,1], a[...,2], a[...,3]
    h, w = A.shape; yy, xx = np.mgrid[0:h, 0:w]
    r = np.sqrt((yy-h/2)**2 + (xx-w/2)**2) / (min(h, w)/2)
    op = A > 128
    corners = [A[0,0], A[0,-1], A[-1,0], A[-1,-1]]
    green = op & (G > R + 6)
    brown = op & (R > G) & (R > B)
    outer = op & (r >= 0.75) & (r < 1.0)
    print(f'{f}\n'
          f'  corners alpha      {corners}            -> must all be 0\n'
          f'  transparent frac   {(A==0).mean():.2f}                 -> ~0.2 for a circle in a square\n'
          f'  foliage reach r95  {np.percentile(r[green], 95):.3f}   -> must be >= 0.97\n'
          f'  brown in outer band{brown[outer].sum()/max(1,outer.sum()):.3f}   -> must be <= 0.10\n')
```

Pass condition, all four, every file:
`corners == 0` · `transparent ≈ 0.2` · `foliage reach ≥ 0.97` · `outer brown ≤ 0.10`

Then print the mean foliage hue of the whole set and confirm the **hue spread is at least
55°** and the **value spread at least 35%**. If it is not, the trees will still look like
variants of each other, which is the thing this brief exists to fix.
