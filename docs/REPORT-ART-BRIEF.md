# Report art — the 16 "how it works" pictures every site report reuses

Rory: *"we can get codex to generate visuals that are used all the time."*

The site report now draws everything that is specific to one farm from that farm's saved data
(site plan, rainfall, roof-catch water budget, sun and wind, soil, build timeline) — code draws
those, never an image model, because a generated picture of a real site is invented evidence.

What an image model IS right for: the **generic concept pictures that are the same in every
report** — how a swale works, how a roof fills a tank, what a trench bed looks like inside. They
are generated once, reviewed, committed as static files, and captioned "Concept illustration —
not a picture of this site". No per-report cost, works offline.

This brief is for that fixed library. **Deliver image files only. Do not edit any `.ts`, `.tsx`,
`.css` or test file, and do not run any git command — wiring and committing is Claude's job.**

## Hard rules (every picture)

1. **1600 × 800 px PNG, sRGB, fully opaque.** Exactly 2:1. File name `<id>.png`, written to
   `public/report-art/`. Nothing else in that folder.
2. **Pure white background (`#ffffff`), edge to edge.** No paper texture, no vignette, no frame,
   no drop shadow under the whole scene. The report prints on A4 and must not burn ink.
3. **No text of any kind.** No letters, numbers, labels, captions, signs, brand marks, watermarks
   or signatures. Labels are added by code in English and isiZulu. A picture with a single
   garbled letter in it is rejected.
4. **One shared treatment across all 16** — they must read as one set drawn in one sitting: flat
   colour fills, a confident dark olive-brown outline of even weight, very light grain inside
   fills only, soft rounded forms. This is the same family as the lesson art in
   `public/course-images/water-harvesting/water-harvesting-l2.jpg` — open that file first and
   match it (but on white, not cream).
5. **Fixed palette.** Leaf green `#4f7a3a` / `#7c9a4c`, soil brown `#b07a45` / `#8a5a33`, water
   blue `#3f8fc4` with darker `#1f6fa8` flow arrows, straw/mulch `#d9b56a`, roof and metal warm
   grey `#9aa3a0`, a little terracotta `#c4673f` for accents. No neon, no gradients-as-style.
6. **Water always moves as a blue arrow.** Wind as pale grey-blue streamlines. Sun as a plain
   yellow disc. Same convention in every picture.
7. **South African smallholding, not a European farm.** Corrugated-iron roofs, green JoJo-style
   plastic tanks on a stand, rondavel or simple block house, thorn trees and aloes at the edges,
   maize, spinach (Swiss chard), cabbage, pumpkin, beans, sweet potato, pawpaw, mango, banana.
8. **No identifiable people.** Hands, or a small figure from behind or far away at most. No faces.
9. **Leave breathing room.** Subject occupies the middle ~84 % of the width; keep ~8 % clear
   white at left and right so numbered callouts can sit beside it. Nothing important within
   40 px of any edge.
10. **Must still read when printed in greyscale at 9 cm wide.** Separate things by shape and
    outline, not by hue alone.

## The 16 pictures

Side cutaways are drawn as a clean slice through the ground with the soil visible, exactly like
the reference lesson art.

| id | Goes with report section | What to draw |
|---|---|---|
| `roof-to-tank` | Water harvesting | Side view. Corrugated roof → gutter → downpipe with a first-flush pipe → green plastic tank on a low stand with a tap → overflow pipe running to a mulched basin with a young fruit tree. Rain falling on the roof. Blue arrows follow the water the whole way. |
| `swale-section` | Water harvesting / earthworks | Side cutaway of a gentle slope. A level trench dug on contour, the dug soil piled as a berm on the downhill side, a fruit tree and groundcover planted on the berm, mulch in the trench. Runoff arrow arrives from uphill, stops in the trench, and soaks down and under the berm as a widening blue plume. |
| `drip-bed` | Irrigation plan | Oblique view. A raised vegetable bed with two drip lines running its length, fed by a thin pipe from a tank on a stand uphill (gravity fed). Thick straw mulch. Small blue drops at the emitters and damp circles in the soil. |
| `soil-layers` | Soil strategy | Side cutaway of living soil: mulch on top, dark crumbly topsoil full of roots, earthworms and fungal threads, paler subsoil, a few stones at the base. A spinach plant and a bean plant growing out of it. A hand adding compost from a bucket at one side. |
| `trench-bed` | Soil strategy / Year 1 priorities | Side cutaway of a deep trench bed, knee-deep, filled in clear separate layers from the bottom: rough sticks and bones, dry grass, green weeds, manure, then topsoil mounded slightly above ground, mulched, with cabbages growing. A spade standing beside it. |
| `compost-bays` | Soil strategy | Oblique view of a three-bay pallet compost system: bay 1 fresh material, bay 2 half-rotted and steaming slightly, bay 3 dark finished compost with a wheelbarrow in front. A garden fork. |
| `crop-rotation` | Crop rotation | Top-down. Four equal beds arranged as a square around a small central path crossing. One bed leafy (cabbage, spinach), one fruiting (tomato, pumpkin), one roots (carrot, beetroot, sweet potato), one legumes (beans on sticks). Four curved arrows between the beds show the clockwise move. |
| `guild-layers` | Plant guilds / natural vegetation | Side view of one fruit-tree guild: tall canopy tree, a smaller fruit tree, a shrub layer, herbs (comfrey-like broad leaves), groundcover (sweet potato vine), a climber on the trunk, and roots/tubers shown in a shallow cutaway. |
| `windbreak-section` | Wind and windbreaks | Side view. Wind streamlines arrive from the left, lift over a staggered windbreak (tall trees, then medium, then shrubs), and come down far beyond it. A calm vegetable garden sits in the sheltered zone directly behind. Bent grass on the windward side, upright plants on the lee side. |
| `sun-house` | Sun and solar | Side view of a simple house with a verandah overhang. A high yellow sun with a steep ray that the overhang blocks, and a low yellow sun with a shallow ray that reaches in under the overhang. A deciduous tree beside the house. Both suns on the same side of the house. |
| `zones` | Zone design | Oblique bird's-eye of a smallholding. House in the middle-front; kitchen beds and herbs right at the door; chicken run and orchard further out; maize and pumpkin field beyond; grazing and a woodlot at the far edge; wild bush at the boundary. Soft rings or bands of slightly different ground tone hint at the zones. |
| `chicken-tractor` | Animals and livestock | Oblique view. A small movable A-frame chicken tractor with wheels standing on a finished vegetable bed, hens scratching inside, the next bed over already cleared and manured. Behind, a simple coop. |
| `firebreak` | Fire and hazards | Oblique view. A homestead ringed by a wide strip of short green growth and bare raked ground, a gravel road acting as a break, succulent aloes planted on the fire side, a tank and a bucket ready. Tall dry golden grass beyond the break. No flames on the house; at most a thin smoke line far off. |
| `food-all-year` | Year-round food production | One long garden bed seen obliquely and divided into four equal stretches, each showing a different season's crops: summer (maize, pumpkin, beans), autumn (sweet potato, spinach), winter (cabbage, carrots, onions, peas), spring (seedlings, lettuce, tomato starts). A sun that is higher over the summer end and lower over the winter end. |
| `market-table` | Economic opportunities | Oblique view of a roadside produce table under a shade cloth: crates of spinach, cabbage, tomatoes, pumpkins, a tray of seedlings, a tray of eggs, bunches of herbs. A scale. No people, or hands only. No signs with writing. |
| `five-year-change` | 5-year vision | Three equal panels side by side of the SAME plot from the same oblique angle: bare compacted ground with one tank; then young beds, small trees on a swale, mulch; then a full food forest edge, mature fruit trees, productive beds, the same tank now partly hidden by growth. The house does not change. Thin white gutters between panels, no numerals. |

## Self-check before you hand over (run it, do not eyeball it)

```bash
cd public/report-art && python3 - <<'PY'
from PIL import Image
import glob, sys
ids = "roof-to-tank swale-section drip-bed soil-layers trench-bed compost-bays crop-rotation guild-layers windbreak-section sun-house zones chicken-tractor firebreak food-all-year market-table five-year-change".split()
bad = 0
for i in ids:
    p = f"{i}.png"
    try: im = Image.open(p)
    except Exception as e: print("MISSING", p); bad += 1; continue
    if im.size != (1600, 800): print("SIZE", p, im.size); bad += 1
    rgb = im.convert("RGB")
    for xy in [(2,2),(1597,2),(2,797),(1597,797),(800,2),(800,797)]:
        r,g,b = rgb.getpixel(xy)
        if min(r,g,b) < 246: print("NOT WHITE AT EDGE", p, xy, (r,g,b)); bad += 1; break
extra = sorted(set(glob.glob("*")) - {f"{i}.png" for i in ids})
if extra: print("EXTRA FILES", extra); bad += 1
print("PASS" if not bad else f"{bad} problem(s)")
PY
```

Then look at every picture at 25 % size and answer honestly: is there any lettering anywhere? Do
all 16 look like one set? Re-draw the ones that fail rather than describing the failure.

If you cannot generate images in this environment, say so plainly in one line and stop — do not
substitute hand-written SVG, stock art, or placeholder rectangles.
