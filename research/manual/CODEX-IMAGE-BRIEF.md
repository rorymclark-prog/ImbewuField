# Image brief — Permaculture Manual covers, chapter pages and replacement pictures

**For:** Codex (or a person using ChatGPT image generation).
**Project:** ImbewuField (`rorymclark-prog/ImbewuField`), a Next.js app for South African smallholder farmers.
**Owner:** Rory Clark. **Last updated:** 26 Sep 2026.

This file is self-contained: it holds every rule, size, file name and prompt needed to make and
install **36 images** for the in-app *Permaculture Manual* and its printable A4 books:

| Set | How many | Shape | Goes in |
|---|---|---|---|
| A. Book cover | 1 | portrait 2:3 | `public/manual/covers/cover.jpg` |
| B. Chapter title pages | 13 (chapters 0–12) | portrait 2:3 | `public/manual/covers/chapter-00.jpg` … `chapter-12.jpg` |
| C. Pictures inside the chapters | 22 | landscape 4:3 | `public/manual/figures/<slot-id>.jpg` |

---

## 0. Instructions for Codex

1. **Branch.** If PR #695 (`claude/wonderful-faraday-l0jkgx`) is still open, branch from it;
   if it is merged, branch from `main`. Never push to `main` directly (a push to `main` deploys
   to production).
2. **Generate** each image from its prompt (section 4). Every prompt = the **STYLE BLOCK**
   (section 2) + the set's **FORMAT LINE** (section 3) + the image's own description. Paste them
   together in that order, verbatim.
3. **Check** every image against the checklist in section 5. Regenerate anything that fails;
   do not "fix" text or logos by painting over them.
4. **Process and save** with the script in section 6 (crop to the exact shape, resize, JPEG,
   strip metadata). File names must match exactly: the app finds pictures by name.
5. **Do not change** chapter text, captions or layout code. The only data file you may edit is
   `content/manual/figures.json`, and only the `width`, `height` or `credit` of a slot whose
   image you added (section 6.3).
6. **Verify:** `npx tsc --noEmit` and
   `node --import ./tests/register-alias.mjs --test tests/manual.test.ts` must pass. Then
   rebuild the PDFs (section 7) and look at a few pages.
7. **Commit** the images (and any `figures.json` size edits) with a message listing which files
   were added. Do not commit `.env*`, `output/`, or `research/manual/figures-source/`.

If you cannot generate images yourself, output the finished prompts (style block + format line +
description, one per image) so a person can paste them into ChatGPT, then do steps 3–7 with the
files they give you.

---

## 1. What the pictures are for

A practical, fact-checked permaculture handbook for smallholder farmers in South Africa, in
English, isiZulu, Sesotho and Tshivenḓa (Xitsonga drafted, publication paused). Readers are
mostly rural farmers, many reading on cheap phones; the same pictures are printed in A4 books for
training days. The pictures must be **warm, clear, respectful and practical**: a farmer should
recognise their own world in them and be able to copy what they see.

---

## 2. STYLE BLOCK (paste at the start of every prompt, word for word)

> Illustration style: warm, hand-painted gouache with a slight risograph grain; flat but rich
> colours; soft natural daylight; calm, hopeful, practical mood; clear shapes that still read
> when the picture is small on a phone. Colour palette only: forest green #1F4D2B, mid green
> #2E6B3A, leaf green #A8D88A, ochre #C07A1E, deep water blue #235E86, warm paper cream #E4DCC6,
> dark earth brown #20190F, plus natural skin tones and small touches of flower colour. Setting:
> rural South Africa — summer-rainfall grassland and bushveld, red-brown soil, rondavels and
> small block houses with corrugated-iron roofs. This is the southern hemisphere: the sun is in
> the NORTH part of the sky. People: Black South African smallholder farmers of different ages,
> mostly women, in practical work clothes, shown with dignity, skill and confidence, never as
> poor, helpless or posed for a camera; no recognisable real person. Plants: only plants that
> really grow there and are NOT invasive — never wattle, eucalyptus/gum, jacaranda, pine,
> prickly pear, lantana, sesbania or bugweed. Good choices: marula, sweet thorn (Vachellia
> karroo), wild olive, aloes, indigenous grasses, maize, sorghum, beans, cowpeas, pumpkins,
> morogo, sweet potato, amadumbe, bananas, citrus, peach, pigeon pea. Absolutely no text,
> letters, numbers, labels, signs, logos, brand names or watermarks anywhere in the image.

---

## 3. Sizes and FORMAT LINES

### 3.1 Why these shapes

The printable book is A4 with a 14 mm margin, so the printed area is **182 mm wide**.

| Page | Printed box | Box shape | Image shape to make |
|---|---|---|---|
| Cover | 182 × 268 mm | 0.68 (≈ 2:3) | **2:3 portrait** |
| Chapter title page | 182 × 240 mm | 0.76 (≈ 3:4) | **2:3 portrait**; about 6 % is trimmed off the top and bottom |
| Picture in a chapter | full column width | — | **4:3 landscape** |

The app lays the language's **title over the top of the cover and chapter images** (with a soft
cream fade), in each of the five languages. So the art must have **no text**, and the **top
third must be calm and simple** (open sky, soft hills, plain wall): no faces, key objects or
busy detail there. On chapter pages, keep everything important inside the middle 85 % of the
height, because a strip at the top and bottom is trimmed.

### 3.2 Pixel sizes

| Set | Generate at | Save as (final file) | JPEG quality | Aim for |
|---|---|---|---|---|
| A. Cover | 1024 × 1536 (or the tool's largest 2:3 portrait) | **1600 × 2400** | 82 | ≤ 900 KB |
| B. Chapter pages | 1024 × 1536 | **1600 × 2400** | 80 | ≤ 700 KB |
| C. Pictures in chapters | 1536 × 1024, then crop to 4:3 | **1400 × 1050** | 78 | ≤ 250 KB (hard limit 400 KB, tested) |

1600 × 2400 prints at about 220 dpi across 182 mm, which is fine for training handouts. For a
professional print shop, also keep an upscaled master at **2150 × 3225** (300 dpi) outside the
repo; do not commit it.

### 3.3 FORMAT LINES (paste after the style block)

- **Set A (cover):** "Portrait book-cover illustration, 2:3 format. Keep the TOP THIRD of the
  picture as calm, open, softly lit sky in warm cream and pale ochre with no detail, and keep a
  quiet strip along the bottom edge. The main scene fills the lower two-thirds."
- **Set B (chapter pages):** "Portrait chapter-opening illustration, 2:3 format. Keep the TOP
  THIRD calm and simple (open sky or a plain soft background) with no faces or important
  objects, and keep everything important away from the very top and bottom edges."
- **Set C (pictures in chapters):** "Landscape picture, 4:3 format, like a clear textbook
  illustration. The subject fills the frame and is easy to understand at a glance, even small
  on a phone. Diagrams are painted scenes with simple arrows and shapes only, never labels."

---

## 4. The images

### 4.A Book cover — `public/manual/covers/cover.jpg`

**Main option:**
> A thriving permaculture homestead seen from a gentle hillside at golden hour. In the
> foreground a woman farmer kneels by a curved, mulched vegetable bed of maize, climbing beans
> and pumpkins (the "three sisters") and leafy morogo, holding a handful of dark, crumbly soil
> and smiling at it. Behind her: a keyhole garden, a young food forest of fruit trees with a
> large marula, a round rainwater tank beside a rondavel with a corrugated-iron roof, a few
> free-range chickens, and a curved swale following the contour of the slope, holding a thin
> silver line of water. Soft hills and indigenous grassland on the horizon.

**Second option (more symbolic, if the first looks too busy):**
> Two hands, one older and one younger, cup a bean seedling growing from dark, rich soil.
> Around the hands, in a loose circle on a plain warm-cream background, small painted
> vignettes of a permaculture farm: a rain tank, a mulched bed, a fruit tree, a chicken, a
> beehive, a worm farm, a pumpkin vine and a sun low in the north.

Make both; Rory picks. Save the one he picks as `cover.jpg` and the other as
`research/manual/cover-alternative.jpg` only if he asks to keep it.

### 4.B Chapter title pages — `public/manual/covers/chapter-NN.jpg`

The title and "Chapter N" are added by the app. Same style and palette across all 13, so the
book feels like one set.

| File | Chapter | Description (after style block + Set B format line) |
|---|---|---|
| `chapter-00.jpg` | 0 · Introduction | A woman farmer sits at a wooden table on a stoep, opening a well-used notebook; seedlings grow in recycled tins on the table; behind her a vegetable garden and soft hills in morning light. |
| `chapter-01.jpg` | 1 · What is permaculture? | Three softly overlapping circles made of natural things, seen from above on a cream background: one of soil, plants and a seedling (earth care); one of people of different ages working together with hoes and baskets (people care); one of baskets of shared harvest — maize, pumpkins, beans, fruit (fair share). |
| `chapter-02.jpg` | 2 · Planning your farm or homestead | A hand-drawn farm plan on paper held down by four stones on the ground, showing only shapes (a house with rings of garden, trees and fields around it); behind it, slightly out of focus, the real homestead matches the plan. |
| `chapter-03.jpg` | 3 · Sector planning | A homestead seen from above at an angle, with soft painted arrows sweeping across it: a warm curved arc for the sun's path across the NORTHERN sky, a cool arrow for the winter wind from the south-west, a grey storm cloud, and a warm orange glow of fire risk from a dry grass slope. |
| `chapter-04.jpg` | 4 · Vegetable and staple crops | Rich raised beds of spinach, cabbage, tomatoes and onions beside rows of maize, sorghum and beans; a woman harvesting spinach into a woven basket, a child carrying pumpkins. |
| `chapter-05.jpg` | 5 · Animal systems | Chickens in a movable wire-and-wood chicken tractor sitting on a garden bed, a few ducks at a small pond, and a wooden beehive on a stand under a tree well away from the house. |
| `chapter-06.jpg` | 6 · Tree systems | A layered food forest: a tall marula, citrus and peach trees, bushes, herbs, pumpkins across the ground and climbing beans, with a windbreak of indigenous trees behind; a farmer picking lemons. |
| `chapter-07.jpg` | 7 · Earthworks and water | A curved swale on contour holding water after rain, a rainwater tank fed by a roof gutter, a small pond, and two people digging with spades and a wheelbarrow. |
| `chapter-08.jpg` | 8 · Soil | A cut-away view of healthy soil: dark topsoil full of roots, earthworms and white fungal threads above lighter subsoil; on the surface a compost heap, mulch and a worm-farm crate. |
| `chapter-09.jpg` | 9 · A balanced, productive ecology | A lively garden edge: bees on flowers, a ladybird, a butterfly, a small bird, a lizard on a rock and a frog near water, among herbs, flowers and vegetables. |
| `chapter-10.jpg` | 10 · Natural pest control | A close view of a vegetable bed edged with marigolds and nasturtiums; a ladybird eating aphids, a praying mantis on a stem, and a farmer's hand turning over a cabbage leaf to check underneath. |
| `chapter-11.jpg` | 11 · The sustainable home | Outside a rondavel kitchen: a brick rocket stove with a pot, a wonder bag keeping a pot warm, a solar dryer with slices of mango and tomato, a small solar panel on the roof and a low biogas dome in the yard. |
| `chapter-12.jpg` | 12 · Glossary | A farmer and a young student sit side by side under a marula tree, looking at an open notebook that shows only simple drawings; around them small painted objects standing for the manual's key words: a swale holding water, a mulched bed, a worm farm, a compost heap, a rain tank, a seedling in a pot and a movable chicken pen. |

### 4.C Pictures inside the chapters — `public/manual/figures/<slot-id>.jpg`

Each slot is already listed in `content/manual/figures.json` (chapter, section and captions in
all five languages; size 1400 × 1050). The app hides a slot until its file exists, so saving
the file under the exact name makes the picture appear everywhere.

| Slot file (`public/manual/figures/…`) | Chapter → section | Why it is needed | Description (after style block + Set C format line) |
|---|---|---|---|
| `02-planning-together.jpg` | 2 → Step 1: Site assessment | replaces a photo with close-up faces | A farming family (a grandmother, a mother and a teenage son) sit around a wooden table outside their home, drawing a simple farm plan on a large sheet of paper with pencils and a ruler; the paper shows only shapes (a house, curved beds, trees, a water tank). Seen from a little distance, faces calm and focused on the paper. Behind them a rondavel, a vegetable garden and sloping grassland. |
| `02-zone-rings.jpg` | 2 → Step 2: Zone planning | never had a picture | A bird's-eye view of a rural homestead: a small house in the centre and five soft, clearly different coloured rings spreading outward — a kitchen garden beside the house; mulched beds, a small food forest and chickens; fields of maize and a grazing area; indigenous trees for wood; wild grassland and bush on the outer edge. Simple and map-like. |
| `02-slope-analysis.jpg` | 2 → Step 3: Slope planning | handbook figure never extracted | A side view (cross-section) of a hillside homestead: indigenous trees on the steep hilltop, a small earth dam and a round water tank high on the slope, the house and vegetable garden in the middle, a pipe running downhill by gravity, and fruit trees in mulched basins at the bottom. Gentle arrows show water flowing downhill. |
| `03-compass.jpg` | 3 → Finding north | handbook figure never extracted | A woman farmer's hand holds a simple baseplate compass flat over a hand-drawn farm map on a clipboard; the red needle points slightly to the left of a painted arrow on the map, showing the compass does not point exactly to true north. Garden and midday sun behind, out of focus. No markings on the compass or map. |
| `03-sun-angles.jpg` | 3 → Sunlight | handbook drawing never extracted | Side view of a small house with a roof overhang on its north side (right of the picture). Two suns on the right: a high summer sun whose rays are stopped by the overhang, and a low winter sun whose rays shine deep into the window. Short summer shadow and long winter shadow on the ground. A deciduous peach tree beside the house, leafy on the summer side and bare on the winter side. |
| `03-frost-pocket.jpg` | 3 → Frost | handbook drawing never extracted | A clear, still winter night with stars over a Highveld valley. Pale blue, see-through ribbons of cold air flow down the slope like water and pool on the valley floor, where the grass is white with frost. Higher up, a vegetable garden sits in warmer air, with a curved hedge above it and a gap in the hedge on the downhill side letting cold air drain away. |
| `06-nitrogen-fixers-citrus.jpg` | 6 → Planting a food forest | replaces a sesbania photo | A young lemon tree with a few lemons in a mulched basin, ringed by bushy pigeon pea shrubs with small yellow-and-red flowers and green pods. A woman farmer cuts branches from one pigeon pea with a panga and lays them as mulch around the lemon tree. Young fruit trees and sweet thorn behind. |
| `06-windbreak.jpg` | 6 → Windbreaks | handbook figure never extracted | A vegetable garden and young orchard sheltered by a windbreak of three staggered rows of indigenous plants: tall wild olive and white stinkwood behind, medium wild dagga (orange flowers) and sand olive in the middle, low indigenous grasses in front. Soft wind lines rise up and over the windbreak; calm air over the garden. The windbreak is on the south-west side. |
| `06-planting-hole.jpg` | 6 → Planting a tree | replaces a photo with a close-up face | A clear cut-away view of a tree planting hole two to three times as wide as the root ball: a wooden stake knocked in on the windward side, a young fruit tree with its root ball level with the soil surface, dark topsoil heaped on one side and lighter subsoil on the other. A farmer's hands and a spade at the edge; no face. |
| `07-earthworks-plan.jpg` | 7 → What earthworks can do | handbook figure could not be downloaded | A bird's-eye view of a small farm on a gentle slope after rain: curved swales on contour hold thin lines of water, overflow channels lead from one swale to the next, fruit trees stand in round infiltration basins, a small fenced pond at the bottom and a rain tank beside the house. Water "walks" slowly down the land. |
| `07-a-frame-level.jpg` | 7 → Swales | replaces a photo with close-up faces | A close, clear view of a home-made wooden A-frame level on grass: two long legs joined at the top, a cross-bar in the middle, a string with a small stone hanging from the top, the string lying exactly across a painted mark at the centre of the cross-bar; a wooden peg beside each foot; a farmer's hands steady one leg; no faces. |
| `07-planted-berm.jpg` | 7 → Swales | replaces a sesbania photo | A lush planted swale and berm on contour: large-leaved amadumbe in the moist ditch; on the berm below, clumps of lemongrass, sweet potato vines spreading over mulched soil and bushy pigeon pea shrubs; a young fruit tree further along. |
| `07-two-wheel-tractor.jpg` | 7 → Preparing the ground | replaces a supplier photo with a watermark | A woman farmer walks behind a small, plain two-wheel walking tractor with a rotavator, preparing a strip of dark soil for vegetable beds; mulched beds and a rondavel behind, hills in the distance. The machine is generic, with no badges or writing. |
| `08-soil-jar-test.jpg` | 8 → Testing your soil | handbook drawing never extracted | A clear glass jar on a wooden table after the soil jar test has settled: coarse sand at the bottom, fine grey silt above, a thin clay layer, then cloudy water with a few floating bits of organic matter. Beside it a second jar being shaken by a farmer's hands, a small heap of soil and a trowel. No scale marks. |
| `08-stacking-worm-farm.jpg` | 8 → Way 5: Earthworms and worm farming | handbook figure never extracted | A cut-away view of a stacking worm farm of three plastic crates on a stand in the shade of a wall: the bottom crate collects dark worm tea that drips from a small tap into a jar; the middle crate holds finished dark castings; the top crate holds fresh vegetable scraps with small red compost worms moving up into it; a damp sack on top. |
| `09-trophic-pyramid.jpg` | 9 → Food chains and the ecological pyramid | handbook figure never extracted | A painted pyramid made of living things: a wide base of soil, grasses, crops and flowers; above it many plant-eaters (caterpillars, aphids, grasshoppers, mice); above them fewer predators (ladybirds, spiders, a lizard, a small bird); one barn owl at the very top. Clear layers getting narrower upward. |
| `09-legume-trees.jpg` | 9 → Succession | replaces a sesbania photo | A young food forest on land that was bare: small fruit trees in mulched basins with pigeon pea shrubs and young sweet thorn trees (feathery leaves, white thorns, yellow ball flowers) between them and a green cowpea groundcover; a woman farmer walks between the rows with a basket. |
| `09-owl-box.jpg` | 9 → Habitat | replaces an image with an unknown licence | A simple wooden barn owl nesting box on top of a tall wooden pole at the edge of a maize field at dusk, well above head height; a barn owl looks out of the round entrance hole and a second owl flies towards it; farm buildings far behind. |
| `10-nasturtium-aphids.jpg` | 10 → Companion planting | replaces a photo with a close-up face | The edge of a vegetable bed: orange and yellow nasturtiums along the border, some round leaves covered in clusters of small black aphids, healthy clean cabbages just behind; a farmer's hand (no face) picks an infested nasturtium leaf into a small bucket; a ladybird on a nearby leaf. |
| `11-rocket-stove.jpg` | 11 → Rocket stoves | replaces a manufacturer's product photo | A cut-away view of a home-made rocket stove of bricks and clay: dry sticks feed in sideways at the bottom, bright flames rise up a short insulated inner chimney, a cooking pot sits on top; soft arrows show air in at the bottom and heat rising; outdoors beside a rondavel kitchen. |
| `11-biogas-diagram.jpg` | 11 → Biogas digesters | replaces a third-party diagram | A simple cut-away view of a household biogas digester: cow manure and kitchen scraps poured into an inlet pipe, a sealed underground tank with a bubbling mixture, a thin gas pipe from the top of the tank to a two-plate gas stove in the kitchen with a blue flame, and an outlet carrying liquid slurry into a bucket that a woman carries to her vegetable garden. |
| `11-biogas-digester-finished.jpg` | 11 → Biogas digesters | handbook figure never extracted | A finished household biogas digester in a rural yard: a low, round green dome set into the ground beside a cattle kraal, a small inlet bowl on one side and an outlet on the other, a thin gas pipe along a fence to the kitchen of a block house; tidy, safe, well ventilated; a woman farmer checking the pipe. |

---

## 5. Checklist — every image must pass all of these

- [ ] **No text of any kind:** no letters, numbers, labels, signs, logos, brand names, watermarks
      or fake writing (look closely at notebooks, maps, tanks, machines and clothing).
- [ ] **Right shape and size:** covers and chapter pages 2:3 portrait saved at 1600 × 2400;
      pictures 4:3 landscape saved at 1400 × 1050. Top third of covers and chapter pages calm.
- [ ] **Palette and style match** the style block, and the set looks like one family.
- [ ] **People:** Black South African farmers, shown with dignity and competence; no
      recognisable real person; hands and faces look natural (count the fingers).
- [ ] **Plants:** none of the banned invasive plants (wattle, gum, jacaranda, pine, prickly pear,
      lantana, sesbania, bugweed). When unsure what a tree is, regenerate.
- [ ] **Southern hemisphere:** the sun is in the north; sunny sides and roof overhangs face north.
- [ ] **Practically correct:** swales on contour (level, across the slope), stakes on the windward
      side, water flowing downhill, beehive away from the house, nothing unsafe (no open flames
      near thatch, no children near machines).
- [ ] **File:** JPEG, sRGB, no metadata; picture files ≤ 400 KB (tested), covers ≤ 900 KB.

---

## 6. Processing and installing

### 6.1 Script (Python 3 + Pillow)

Save as a scratch script outside the repo, or run inline. It crops to the exact shape around the
centre (or around `--focus-y` from 0 = top to 1 = bottom), resizes and writes an optimised JPEG.

```python
# usage: python3 fit.py <input> <output.jpg> <width> <height> [quality] [focus_y]
import sys
from PIL import Image

src, dst, W, H = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
quality = int(sys.argv[5]) if len(sys.argv) > 5 else 80
focus_y = float(sys.argv[6]) if len(sys.argv) > 6 else 0.5

im = Image.open(src)
if im.mode in ("RGBA", "LA", "P"):
    im = im.convert("RGBA")
    bg = Image.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[-1])
    im = bg
else:
    im = im.convert("RGB")

target = W / H
w, h = im.size
if w / h > target:                      # too wide: trim the sides equally
    nw = round(h * target)
    left = (w - nw) // 2
    im = im.crop((left, 0, left + nw, h))
else:                                   # too tall: trim top/bottom around focus_y
    nh = round(w / target)
    top = max(0, min(h - nh, round((h - nh) * focus_y)))
    im = im.crop((0, top, w, top + nh))

im = im.resize((W, H), Image.LANCZOS)
im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)
print(dst, im.size)
```

Examples:

```bash
python3 fit.py cover-raw.png        public/manual/covers/cover.jpg              1600 2400 82
python3 fit.py ch07-raw.png         public/manual/covers/chapter-07.jpg         1600 2400 80
python3 fit.py a-frame-raw.png      public/manual/figures/07-a-frame-level.jpg  1400 1050 78
```

A 1024 × 1536 image is exactly 2:3, so covers are only resized. A 1536 × 1024 image is 3:2, so
pictures lose a little off each side to become 4:3 — keep the subject centred when generating.

### 6.2 Where files go

- Covers and chapter pages: `public/manual/covers/` (create the folder). Accepted extensions are
  `.jpg`, `.jpeg`, `.png`, `.webp`, but use `.jpg`. The book page picks them up automatically;
  a missing one shows a plain forest-green page.
- Pictures: `public/manual/figures/<slot-id>.jpg`, exact names from table 4.C.

### 6.3 `content/manual/figures.json`

- Every slot in 4.C is already listed at **1400 × 1050** with the credit
  `"Illustration: made with AI for this manual"`. If a saved picture is 1400 × 1050, change
  nothing.
- If a picture has a different size, set that entry's `width` and `height` to the real pixel
  size, or the test fails.
- The tests also check that every file in `public/manual/figures/` is listed in `figures.json`,
  so do not add extra files there (put drafts and alternatives outside `public/`).
- Do not edit captions or section numbers.

---

## 7. Verify and rebuild the printable books

```bash
npx tsc --noEmit
node --import ./tests/register-alias.mjs --test tests/manual.test.ts
```

Then build the PDFs from a running app (dev server or production build):

```bash
npx next dev -p 3100            # in one terminal
node scripts/build-manual-pdfs.mjs http://localhost:3100      # en, zu, st, ve
```

PDFs land in `output/manual/permaculture-manual-<lang>.pdf` (git-ignored). Open page 1 (cover),
a chapter title page and a page with one of the new pictures, and check:
- the title is readable over the top of each cover and chapter image;
- nothing important is hidden under the title fade or trimmed at the edges;
- the new pictures appear with their captions.

Playwright and Chromium are needed for the PDF script (`npm i -g playwright`; set
`CHROMIUM_PATH` if Chromium is not where Playwright expects it).

---

## 8. Optional: covers for a print shop (outside the app)

If Rory wants stand-alone printed covers (for example a Canva cover for a bound book), use the
same `cover.jpg` artwork and add the text in Canva, not in the image generator. Title and
subtitle per language:

| Language | Title | Subtitle |
|---|---|---|
| English | Permaculture Manual | A practical guide to permaculture design, food growing and sustainable living for Southern African farmers and homesteads. |
| isiZulu | Incwadi ye-Permaculture | Isiqondiso esisebenzayo sokuklama nge-permaculture, ukutshala ukudla nokuphila ngendlela ehlala isikhathi eside, sabalimi nemizi yaseNingizimu ne-Afrika. |
| Sesotho | Bukana ya Permaculture | Tataiso e sebetsang ya moralo wa permaculture, ho lema dijo le ho phela ka tsela e ka tswelang pele nako e telele, bakeng sa balemi le malapa a Borwa ba Afrika. |
| Tshivenḓa | Bugu ya Permaculture | Nyendedzi ya u shuma nga zwanḓa ya u pulana nga permaculture, u lima zwiḽiwa na u tshila nga nḓila i sa fheli, ya vhalimi na midi ya Tshipembe tsha Afrika. |

Small line at the bottom of every cover: **Compiled by Rory Clark · Imbewu Yoshintso NPC**.
Fonts: Newsreader (titles) and Public Sans (text), both free on Google Fonts and both show the
Tshivenḓa letters ḓ ḽ ṅ ṋ ṱ. The translated titles are machine drafts: have a fluent speaker
check them before printing.
