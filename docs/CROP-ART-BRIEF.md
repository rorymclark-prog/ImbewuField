# Crop Art Brief

**Status:** ready for generation
**Branch:** `codex/crop-art`
**Requested by:** Rory, 2026-08-15 — flagged the Farm-gate Prices screen showing a
raw 🧡 orange-heart emoji for Butternut ("that's just an orange heart... we can do
better than that").

## What this is

26 crops in `lib/crop-catalog.ts` (`CROPS`) currently render as raw emoji
everywhere a price, listing, or harvest record needs an icon — Farm-gate Prices,
the Exchange board and listing cards, Harvest Reconciliation, the Atlas panel,
the facilitator crop screen, and the NGO dashboard. Some of those emoji are
actively wrong for South African context (🧡 for butternut, 🎃 "jack-o'-lantern
pumpkin" for a savoury African pumpkin, 🥗 "salad bowl" for lettuce-the-plant).
This brief specifies one real PNG per crop to replace them, with the emoji kept
as the permanent fallback.

**This batch is produce icons, not garden-element art.** It is a sibling effort
to `docs/ELEMENT-ART-BRIEF.md` (which covers plants/objects placed on the design
canvas) — different subject matter, different picker convention (see below),
same technical discipline and self-check rigor. Read `ELEMENT-ART-BRIEF.md` first
if anything here is ambiguous; this brief only overrides where it explicitly says so.

## View convention: PRODUCE, not plant

Every render site for this catalog is about the **sellable product** — a price
per kg, a listing on the exchange, a harvested quantity, a stall on the map. None
of them show a growing plant. So unlike the element brief's picker (FRONT
elevation for living things), **every crop in this batch gets one view: the
harvested product itself**, shot like a market-stall photo reference —

- The **edible/sellable part only**: a butternut squash, a bunch of carrots with
  tops trimmed short, a head of cabbage, a double handful of dry beans, a
  cluster of tomatoes on the vine is fine if that's how the product is actually
  sold, but the vine/plant is not the subject.
- Angle: three-quarter view, the angle a good product photo uses to show both
  the top and one side — not flat top-down, not flat front-on. Consistent across
  all 26.
- Quantity: draw a **representative single unit or small natural cluster** — one
  butternut, one cabbage head, a small bunch of 3-4 carrots, a small pile of
  ~6-8 beans, a few oat stalks tied at the base. Not a bulk crate, not a single
  grain. Match what a farmer would picture when they hear the crop name.
- Where a plant is genuinely leaf-only produce (kale, chard, spinach), draw the
  harvested leaves/bunch as sold, not the rooted plant.

## Why produce icons need shape more than color

The canopy-art batches learned the hard way that color spread alone doesn't
save a set of same-shaped blobs (17.5° hue spread, "every tree a variant of
the same yellow-green" — see `docs/CANOPY-ART-BRIEF.md`). Produce has an
advantage trees don't: **distinct real-world silhouettes**. Use it deliberately —
a ribbed chard leaf, a tight broccoli floret cluster, a smooth round cabbage, a
long thin green bean pod, a lumpy potato, a spiky watermelon rind pattern are
all readable apart in silhouette alone, before color even enters. Draw the
correct real silhouette for each crop; don't default to "round blob, tinted
differently" for the 11 crops below that are predominantly green.

**11 of 26 crops are naturally green-dominant** (swiss-chard, kale, cabbage,
lettuce, coriander, peas, broccoli, cucumber, green-beans, broad-beans,
watermelon-rind). This is exactly the failure mode the hue-spread rule exists
to catch. Differentiate them on three axes at once, not color alone:
1. **Silhouette** (see above — this does most of the work here)
2. **Value** — dark kale vs. pale-green cabbage vs. mid-green lettuce vs. bright
   pea-green vs. matte sage chard-leaf
3. **Undertone** — blue-green cucumber/broccoli vs. yellow-green lettuce/peas vs.
   the red/white ribs breaking up swiss-chard's green

## Fixed reference color per crop

One anchor hex per crop, used for the dominant visible mass of the product (skin,
outer leaf, husk — whichever reads at a glance). Pods/interiors can vary within
reason but the anchor is what a 24px thumbnail should read as.

| key | name | icon (retiring) | anchor hex | notes |
|---|---|---|---|---|
| maize | Maize (mielies) | 🌽 | `#E8C547` | dry kernel yellow, husk pulled back |
| dry-beans | Dry beans (sugar beans) | 🫘 | `#C9A876` | cream-and-maroon speckle, small pile |
| green-beans | Green beans | 🫛 | `#5FA83D` | pod green, distinct from peas' hex below |
| butternut | Butternut | 🧡 | `#D9A441` | tan/beige skin — **this is the crop that started the request** |
| pumpkin | Pumpkin | 🎃 | `#C77A2E` | deep orange-brown, ribbed, NOT jack-o'-lantern orange |
| swiss-chard | Swiss chard (spinach) | 🍃 | `#3E6B35` | dark leaf green + visible white/red ribs |
| kale | Kale | 🌿 | `#2F5D34` | darkest, most blue-green, crinkled leaf texture |
| cabbage | Cabbage | 🥬 | `#8FB86C` | pale, tight, smooth round head |
| carrots | Carrots | 🥕 | `#E07A2C` | small bunch, trimmed tops, orange root |
| beetroot | Beetroot | 🫜 | `#6B1E3C` | deep magenta-maroon root |
| onions | Onions | 🧅 | `#C9A15A` | papery gold-brown skin |
| tomatoes | Tomatoes | 🍅 | `#D14B2E` | small vine cluster, bright red |
| peppers | Peppers | 🫑 | `#3E9142` | green bell, glossy |
| sweet-potato | Sweet potato | 🍠 | `#A8542E` | reddish-brown skin, distinct from potato below |
| potato | Potato | 🥔 | `#B89968` | tan/buff skin, matte, lumpy |
| lettuce | Lettuce | 🥗 | `#7BAE4E` | loose leafy head, mid-green |
| amadumbe | Amadumbe (taro) | 🌰 | `#8A6642` | rough brown corm, fibrous |
| groundnuts | Groundnuts (peanuts) | 🥜 | `#C9A66B` | tan shells, small cluster |
| garlic | Garlic | 🧄 | `#E8E0CC` | pale cream-white bulb, papery |
| peas | Peas | 🟢 | `#6FBE44` | brighter/more saturated green than green-beans |
| broad-beans | Broad beans (fava beans) | 🫘 | `#4F8F4A` | larger flatter pod, must read distinct from dry-beans (which shares its icon) |
| broccoli | Broccoli | 🥦 | `#3B6B3E` | tight floret cluster, blue-green undertone |
| cucumber | Cucumber | 🥒 | `#4A8F3E` | smooth elongated, slightly waxy |
| watermelon | Watermelon | 🍉 | `#2E7D32` | rind green outside; a cut wedge showing red flesh is a good differentiator if it still reads at 24px |
| coriander | Coriander | 🌱 | `#5C9C4A` | loose leafy bunch, lighter/yellower green than kale |
| oats | Oats (winter cover crop) | 🌾 | `#D6C280` | golden dry stalks tied at base, only non-vegetable in the set |

Spread check: hue runs full circle (red 10°, orange 30°, gold 45°, yellow-green
90°, green 100-140°, blue-green 150°, magenta 330°) — well over the 55° floor.
Value runs from garlic's near-white to beetroot's near-black-maroon — well over
the 35% floor. This table is the anchor; keep greens differentiated per the
three-axis rule above rather than drifting them all toward the table's average.

## Hard technical rules (same as `ELEMENT-ART-BRIEF.md` — repeated here for a
## self-contained brief)

- **1024×1024 PNG, RGBA.** All four corners fully transparent (alpha = 0).
- **No baked ground, shadow, or surface.** The app places these icons on its
  own backgrounds (white cards, colored chips, map pins) — a baked shadow or
  ground plane under the product will look wrong in every one of them.
- **Nothing else in frame.** No text, no labels, no price tags, no borders, no
  watermark.
- **Subject fills the frame**, ≤3% transparent margin on all sides — these
  render as small as 20-24px in list rows, so a small subject with lots of
  empty padding will look like a speck.
- **One consistent treatment across all 26** — same lighting model, same
  rendering style (soft-shaded illustration, not photo, not flat vector —
  match the existing `element-art` set's style so the app doesn't end up with
  two visibly different art styles side by side). Soft diffuse daylight from
  upper-left, consistent across the set.
- **Must read correctly at 24×24px.** This is the actual deployed size in most
  list rows. Design the silhouette first, test the downscale, don't rely on
  detail that only survives at full resolution.

## Naming and location

`public/crop-art/<key>.png` — using the catalog `key` field exactly as it
appears in `lib/crop-catalog.ts` (e.g. `public/crop-art/butternut.png`,
`public/crop-art/dry-beans.png`, hyphens kept as-is). 26 files total.

## Mandatory self-check

Before considering any file done, run a pixel-level check — visual inspection
alone has passed baked-in-transparency bugs before (see
`docs/ELEMENT-ART-BRIEF.md`'s documented checkerboard-transparency failure).
Use a Python/PIL script equivalent to the one referenced in the element brief:

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

Then do the manual test: downscale each PNG to 24×24 (any image tool — even a
quick resize preview) and actually look at it. If you can't tell what crop it
is at that size without reading the filename, redraw it — silhouette or value
contrast needs more separation, not a color tweak.

## What Codex should do

1. Generate all 26 PNGs into `public/crop-art/` per this brief.
2. Run the self-check script above against all 26 files; fix any failures.
3. Do the manual 24×24 downscale-and-look pass on the full set, paying
   particular attention to the 11 green-dominant crops listed above — commit
   again if any need rework.
4. Commit everything to the **`codex/crop-art`** branch (already checked out
   in this worktree). Do not push, do not open a PR — Claude handles push,
   PR, CI monitoring, and merge.
5. Do not touch `lib/crop-catalog.ts` — it belongs to another in-flight branch.
   The art files are self-contained; wiring them into the app is a separate
   commit Claude will make once the art lands (see `lib/crop-art.ts`, already
   wired to fall back to the current emoji for any crop that doesn't have art
   yet, so partial delivery is safe to commit incrementally).
