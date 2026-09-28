# Crop Art Brief

**Status:** deployed and guarded by `tests/element-art.test.ts`
**Requested by:** Rory, 2026-08-15 — flagged the Farm-gate Prices screen showing a
raw 🧡 orange-heart emoji for Butternut ("that's just an orange heart... we can do
better than that").

## What this is

29 crops in `lib/crop-catalog.ts` (`CROPS`) use purpose-made produce pictures
everywhere a price, listing, or harvest record needs an icon — Farm-gate Prices,
the Exchange board and listing cards, Harvest Reconciliation, the Atlas panel,
the facilitator crop screen, and the NGO dashboard. The original emoji remain
the permanent fallback, but the deployed mapping is complete. This brief records
the rules that replacements and newly added crops must continue to satisfy.

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

**12 of 29 crops are naturally green-dominant** (swiss-chard, kale, cabbage,
lettuce, coriander, peas, broccoli, cucumber, green-beans, broad-beans,
watermelon-rind, true-spinach). This is exactly the failure mode the hue-spread rule exists
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
| chilli | Chilli | 🌶️ | `#D62929` | long tapered hot chillies, mostly red; never another bell pepper |
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
| true-spinach | True spinach | 🥬 | `#356B3B` | smooth tender leaves; no crinkled kale or thick chard stalks |
| turnip | Turnip | 🫜 | `#7A3F83` | white roots with unmistakable purple shoulders |

Spread check: hue runs full circle (red 10°, orange 30°, gold 45°, yellow-green
90°, green 100-140°, blue-green 150°, magenta 330°) — well over the 55° floor.
Value runs from garlic's near-white to beetroot's near-black-maroon — well over
the 35% floor. This table is the anchor; keep greens differentiated per the
three-axis rule above rather than drifting them all toward the table's average.

## Hard technical rules (same as `ELEMENT-ART-BRIEF.md` — repeated here for a
## self-contained brief)

- **256×256 deployed PNG, RGBA.** Generate larger when useful, then downsample once with
  high-quality filtering before committing. All four corners fully transparent (alpha = 0).
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
`public/crop-art/dry-beans.png`, hyphens kept as-is). 29 files total.

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
    assert (w, h) == (256, 256), f"{path}: wrong size {w}x{h}"
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

1. Generate or replace one PNG at a time in `public/crop-art/` per this brief.
2. Run the pixel-level check immediately; do not move to another crop while it fails.
3. Do the manual 24×24 downscale-and-look pass, paying particular attention to
   the 12 green-dominant crops listed above.
4. Add the matching `lib/crop-art.ts` entry in the same commit. The automated
   guard requires every catalog key, mapping and on-disk filename to agree.
5. Do not change a crop name while doing artwork; the checked catalog is the authority.

## Batch 2 — new catalog crops (2026-09-28)

The crop-catalog expansion (PR #754) adds these crops. Each is currently shipped with a
**temporary generated placeholder** so the guard test passes — replace every one with real art
under the rules above (produce view, three-quarter angle, soft-shaded illustration matching the
existing set, 256×256 RGBA, transparent corners, readable at 24px). The filename is already
correct; overwrite the PNG in place. `lib/crop-art.ts` already maps the key.

Chinese cabbage, leeks and cassava were researched but NOT added to `CROPS` (no primary SA source
for their missing values), so they need no art. If they are added later, their rows go back here.

| key | name | anchor hex | what to draw (and how it must differ from its look-alike) |
|---|---|---|---|
| amaranth | Amaranth (imifino / thepe) | `#6E8B3D` | loose bunch of pointed-oval leaves, some red-flushed stems; not spinach-smooth, not kale-crinkled |
| african-nightshade | African nightshade (umsobo) | `#2F4F2A` | bunch of small dark oval leaves with a few purple-black berries; darkest leafy green of the batch |
| spider-plant | Spider plant (Cleome, lerotho) | `#4E7F3A` | bunch of stems with 5-fingered (palmate) leaves — the hand shape is the silhouette |
| cowpea | Cowpea | `#E6D8B8` | small pile of cream kidney-shaped seeds each with a black "eye"; must not read as dry-beans' speckled pile |
| bambara-groundnut | Bambara groundnut (izindlubu) | `#B5654A` | pile of round, mottled red-brown and cream seeds; rounder than beans, no shell (unlike groundnuts) |
| mung-bean | Mung bean | `#6B8E23` | small pile of tiny olive-green round beans; smaller and greener than every other legume |
| soybean | Soybean | `#E3C77A` | small pile of round pale-yellow beans, 2–3 fuzzy tan pods beside them |
| sorghum | Sorghum (amabele) | `#A0522D` | one dense upright grain head of rounded red-brown seeds on a short stalk; not oats' loose golden stalks |
| sunflower | Sunflower | `#E8B923` | flower head, yellow petals round a dark seed disc; the disc is the product so keep it large |
| sweetcorn | Sweetcorn | `#F2DC6B` | fresh cob, bright green husk peeled back, pale glossy kernels; maize is dry gold with papery husk |
| gem-squash | Gem squash | `#2F4A2A` | small round dark-green ball, one half cut showing yellow flesh; smaller and darker than pumpkin |
| baby-marrow | Baby marrow (courgette) | `#4F7F3A` | 2 small straight speckled courgettes with stem ends; matte speckle vs cucumber's smooth waxy skin |
| spanspek | Spanspek (cantaloupe) | `#D8B86A` | round melon with beige netted rind, one wedge cut to show orange flesh; not watermelon's green/red |
| brinjal | Brinjal (eggplant) | `#3D1E4A` | one glossy deep-purple brinjal with green calyx cap; the only purple fruit in the set |
| cauliflower | Cauliflower | `#F2EEDC` | white knobbly curd head framed by a few green leaves; white is the read, not the leaves |
| parsley | Parsley | `#3F8F3A` | tight bunch of CURLY leaves; coriander is flat and lighter, so the curl is the differentiator |
| radish | Radish | `#C8283C` | 3–4 small round red radishes, white tips, tops trimmed short |
| fodder-radish | Fodder radish (cover crop) | `#EDE6D6` | one long white tapering taproot with a leafy top; long and white vs radish's small round red |
| sunn-hemp | Sunn hemp (cover crop) | `#E3B81F` | a few upright stems with yellow pea-flower spikes and narrow leaves |
| medic | Medic (cover crop) | `#5E8C3A` | small clump of three-part (trefoil) leaves with coiled spiral seed pods — the spiral is the read |

Hue check for the batch: purple (brinjal), red (radish), red-brown (sorghum, bambara), gold/yellow
(sunflower, sunn hemp, sweetcorn, soybean), cream/white (cowpea, cauliflower, fodder radish),
six greens differentiated by silhouette first (palmate, curly, trefoil, berries, speckled
courgette, round gem) — follow the three-axis rule above for the greens.

### Ready-to-paste Codex prompt (batch 2)

> Replace the 20 placeholder PNGs in `public/crop-art/` listed in the Batch 2 table of
> `docs/CROP-ART-BRIEF.md` with real produce art. Read the whole brief first and match the style of
> the existing 29 crop PNGs (open 4–5 of them, e.g. `butternut.png`, `kale.png`, `dry-beans.png`).
> For each key: draw only the harvested product, three-quarter view, soft-shaded illustration,
> soft light from upper left, anchor hex as the dominant colour. The PNG must be 256×256 RGBA with
> all four corners fully transparent, no shadow or ground, and the subject filling the frame
> (≤3% margin). Overwrite the file in place and keep the filename. After each file, run the
> brief's self-check script and do the 24×24 downscale look test. Do not edit `lib/crop-art.ts`
> or `lib/crop-catalog.ts`; the mapping already exists. When all 20 are done, run
> `node --import ./tests/register-alias.mjs --test tests/element-art.test.ts` and commit only the
> PNGs.

