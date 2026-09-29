# Image brief — Permaculture Manual covers, chapter pages and replacement pictures

**For:** Codex (or a person using ChatGPT image generation).
**Project:** ImbewuField (`rorymclark-prog/ImbewuField`), a Next.js app for South African smallholder farmers.
**Owner:** Rory Clark. **Last updated:** 27 Sep 2026.

This file is self-contained: it holds every rule, size, file name and prompt needed to make and
install **110 images** for the in-app *Permaculture Manual* and its printable A4 books:

| Set | How many | Shape | Goes in |
|---|---|---|---|
| A. Book cover | 1 | portrait 2:3 | `public/manual/covers/cover.jpg` |
| B. Chapter title pages | 14 (chapters 0–13) | portrait 2:3 | `public/manual/covers/chapter-00.jpg` … `chapter-13.jpg` |
| C. New pictures inside the chapters | 22 | landscape 4:3 | `public/manual/figures/<slot-id>.jpg` |
| D. Replacements for the handbook photographs | 73 | landscape 4:3 | `public/manual/figures/<id>.jpg` (the same names the photos have now) |
| **Total** | **110** | | |

**One uniform set.** Rory has decided that *every* picture in the manual will be an AI
illustration in the same style, so the whole book looks like one family. That includes the 73
photographs and diagrams taken from the original RVCC handbook: set D (section 4.D) replaces all
of them.

- Each new set-D picture is saved **under the same file name** as the photo it replaces, so it
  simply overwrites the old file. Nothing in the app or the chapter text needs to change. (The old
  photos stay in the git history.)
- For every picture you replace, edit its entry in `content/manual/figures.json`: set `credit` to
  `"Illustration: made with AI for this manual"`, `width` to `1400` and `height` to `1050`
  (section 6.3). The old entries say "Photo: …" or "Diagram: …" and carry the old photo's size;
  the size test fails until `width` and `height` match the new file.

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
   image you added or replaced (section 6.3).
6. **Verify:** `npx tsc --noEmit` and
   `node --import ./tests/register-alias.mjs --test tests/manual.test.ts` must pass. Then
   rebuild the PDFs (section 7) and look at a few pages.
7. **Commit** the images (and the `figures.json` edits) with a message listing which files
   were added and which were replaced. Do not commit `.env*`, `output/`, or `research/manual/figures-source/`.

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
| C and D. Pictures in chapters | 1536 × 1024, then crop to 4:3 | **1400 × 1050** | 78 | ≤ 250 KB (hard limit 400 KB, tested) |

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
- **Set C (pictures in chapters; also used for every set-D picture):** "Landscape picture, 4:3 format, like a clear textbook
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

The title and "Chapter N" are added by the app. Same style and palette across all 14, so the
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
| `chapter-13.jpg` | 13 · Notes and references | A calm, quiet still life on a plain wooden table in soft morning light: a farmer's well-used notebook lying closed (or open to blank, stained pages with no writing visible), a few small paper seed packets with no printing, a pencil, a handful of dried beans and a sprig of fresh herbs. Nothing written or printed anywhere. The table fills the lower two-thirds; above it a plain, softly lit wall. |

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

### 4.D Replacing the handbook photographs (one uniform AI set)

These 73 pictures replace every photograph and diagram that came from the original RVCC
handbook, so the whole manual is in one style. Each one keeps its slot, its captions and its file
name: save the new picture as `public/manual/figures/<id>.jpg`, **over the old file**, then update
that entry's `credit`, `width` and `height` in `figures.json` (section 6.3).

How to use this table:

- **Prompt** = STYLE BLOCK (section 2) + **Set C** format line (section 3.3) + the description
  below, pasted in that order. Every picture is **4:3 landscape, saved at 1400 × 1050**, even
  where the old photo was square, tall or a thin strip.
- **The job of each picture** is to teach the same thing as the old photo and to match its English
  caption (in `figures.json`). It is a new scene, not a copy of the photo: no real people, no
  real brand names, nothing the original got wrong (for example a person standing in a hole next
  to a working machine).
- **Diagrams** (marked *Diagram* in the table) become painted diagram-style pictures: shapes,
  colours and arrows only, **no words, letters or numbers at all**, not even on a legend or a
  north arrow. The caption does the explaining.
- **Pictures that must match each other.** Make these in order and give the first as a
  reference image when making the others, so they read as the same place:
  - `02-base-map` → `02-zone-map` → `03-sector-map` (the captions say "the same property");
  - `07-pond-digging` → `07-pond-filled` (the caption says "the same pond");
  - `08-manure-on-cut-grass` → `08-sheet-mulch-cardboard` → `08-planting-into-mulch`
    (three steps of one bed);
  - `05-pig-tractor` → `05-pig-cleared-ground`, and `08-compost-stick-base` →
    `08-compost-watering-layers`.
- **Check every picture against section 5**, and especially: no text, no invasive plants (the
  old photos showed sesbania, poplar/willow and plantation gums in places; none of these may
  appear), the sun and sunny sides in the north, water only ever flowing downhill, swales and
  bed edges level along the contour with the soil heaped on the downhill side.
- **Note for Rory (captions, not Codex's job):** a few English captions speak as if the picture
  were a photo of a real place: `00-handbook-collage` ("scenes from the handbook's project
  gardens"), `06-food-forest-durban` ("in Durban"), `07-sand-dam-lesotho`,
  `11-stone-house-bethel` and `11-biogas-digester-build` ("in Lesotho", "at a community centre"),
  `07-pond-filled` ("three weeks later after 45 mm of rain"). They still make sense with an
  illustration, but you may want them softened ("a food forest like one in Durban…") so no reader
  thinks the picture is a photo of that exact place.

| Slot file | Chapter | What the original shows | Description (after style block + Set C format line) |
|---|---|---|---|
| `public/manual/figures/00-handbook-collage.jpg` | 0 · Introduction | Cover collage of nine project photos: woman in maize, quinces, stone house with solar panels, sunflowers, seedling in mulch, crate of tomatoes and peppers, stone-edged bed | A wide, sunny view across a thriving project garden that gathers several scenes into one picture. In the front, a wooden crate full of red tomatoes and green peppers sits beside a stone-edged, mulched vegetable bed. In the middle, a woman farmer walks between rows of tall maize, a row of sunflowers blooms, and a small fruit tree hangs with golden quinces. Behind, a stone-and-cob house with solar panels on its north-facing roof, and soft green hills. |
| `public/manual/figures/02-base-map.jpg` | 2 · Planning your farm | *Diagram.* Aerial photo of a property with contour lines, a compass rose and a "BASE MAP" title | *Diagram.* A painted bird's-eye map of one rural property on a gentle slope, seen from straight above: a block house and a rondavel with corrugated-iron roofs, a dirt driveway from the road, a round water tank, a small existing vegetable patch, a few big indigenous trees, a fence around the boundary and a small stream in the lowest corner. Thin, evenly spaced, curving dark-brown contour lines run across the whole slope. A plain arrow shape in one corner points to the top of the picture (north), with no letter on it. Only what is already there, nothing new planned. Clean, calm and map-like; no words, letters or numbers. (Make this first and use it as the reference for `02-zone-map` and `03-sector-map`.) |
| `public/manual/figures/02-zone-map.jpg` | 2 · Planning your farm | *Diagram.* The same aerial with coloured zones 0–5 and a legend | *Diagram.* The same bird's-eye map of the same property (same house, rondavel, driveway, tank, trees, stream, contour lines and plain north arrow), now washed with six soft, see-through colour areas spreading outward from the house: the house itself; a kitchen garden hugging the house; mulched beds, fruit trees and a chicken run a little further out; fields of maize and a grazing paddock further still; a woodlot of indigenous trees; and wild grassland and bush along the outer edge. Each area is a clearly different colour from the palette, warm near the house and cooler towards the edges. No legend, no words, letters or numbers. |
| `public/manual/figures/03-sector-map.jpg` | 3 · Sector planning | *Diagram.* The same aerial with sector wedges: hot wind, cold wind, view, fire risk, cold and hot air flows; small sun-path inset | *Diagram.* The same bird's-eye map of the same property (same house, rondavel, driveway, tank, trees, stream and plain north arrow), with soft painted wedges and arrows coming in from the edges towards the house: a warm orange wedge of hot, dry wind from the north-west; a cool blue wedge of cold wind from the south-west; a red-orange glow of fire risk coming from a dry grass slope; a clear, open wedge looking out towards distant blue hills (the best view); and pale blue ribbons of cold night air flowing downhill along the valley to the low corner. In one corner, a small round inset shows the sun's arc across the northern part of the sky, a high arc for summer and a low arc for winter. Shapes and arrows only; no words, letters or numbers. |
| `public/manual/figures/04-kitchen-garden.jpg` | 4 · Vegetable and staple crops | Kitchen garden under a pole-and-shade-net frame right beside a house | A small, lush kitchen garden right against the side of a block house with a corrugated-iron roof, a few steps from the open kitchen door: raised beds of spinach, spring onions, tomatoes, lettuce and herbs under a simple frame of wooden poles covered with green shade net. A woman steps out of the kitchen door with a bowl to pick leaves for supper. Close, homely and practical. |
| `public/manual/figures/04-mandala-garden.jpg` | 4 · Vegetable and staple crops | Wide view of a mandala garden: timber-edged beds curving round a central sitting place, maize and vegetables | A mandala garden seen from a little above: curved beds edged with rough timber offcuts form a round pattern, like the petals of a flower, around a small central sitting place with a simple wooden bench; narrow paths run between the curves; the beds are full of spinach, cabbages, onions, herbs and orange marigolds; tall maize grows around the outside. Beautiful and useful. |
| `public/manual/figures/04-keyhole-beds.jpg` | 4 · Vegetable and staple crops | Keyhole beds edged with recycled plastic strip, river-stone paths, drip lines | Several keyhole-shaped vegetable beds seen from a little above: each is a horseshoe-shaped bed with a narrow path cut into its middle, so every plant can be reached from a path. The beds are edged with a brown recycled-plastic strip, the paths are small river stones, and thin black drip lines run along the beds. Lettuce, spinach, spring onions and herbs grow in them. A woman farmer kneels in the notch of one keyhole, easily reaching the plants in the middle. |
| `public/manual/figures/04-vegetable-garden-beds.jpg` | 4 · Vegetable and staple crops | Two women bent over stone-edged beds of spinach and beetroot inside a fence | Neat rectangular vegetable beds edged with local stones, full of dark-green spinach and red-veined beetroot, with bare-earth paths between them, inside a wire fence. Two women farmers work from the paths, bending to harvest, never stepping on the beds; their faces are turned down to their work and they are seen from a little distance. |
| `public/manual/figures/04-home-vegetable-garden.jpg` | 4 · Vegetable and staple crops | Man standing in a mulched home vegetable garden with cabbages, homestead behind | A home vegetable garden a short walk from a rural homestead: mulched rows of round green cabbages and some onions, with a narrow footpath leading back to a block house and a rondavel about thirty paces away. A man farmer stands in the garden at mid-distance holding a hoe, looking over the rows. |
| `public/manual/figures/04-market-garden-rows.jpg` | 4 · Vegetable and staple crops | Long rows of green and red cabbage in bare red soil | A market garden: long, straight rows of green cabbage and purple-red cabbage stretching into the distance in red-brown soil, each row one crop, with narrow paths between. In the middle distance a farmer pushes a wheelbarrow of harvested heads along a path. Indigenous grassland and a few indigenous trees behind. |
| `public/manual/figures/04-market-garden-aerial.jpg` | 4 · Vegetable and staple crops | Drone view of two market-garden blocks of long beds in grassland | A high bird's-eye view of two rectangular market-garden blocks set in indigenous grassland. Each block is made of many long beds all the same size, with paths between them: some beds green with crops, some with rows of young seedlings, some freshly prepared bare soil. A water tank and a small shed stand beside the blocks, a dirt track leads to them, and bushveld covers the hillside around (no plantation trees). |
| `public/manual/figures/04-maize-staple-garden.jpg` | 4 · Vegetable and staple crops | Woman standing in a tall, dense stand of maize with tassels | A tall, healthy stand of maize with golden tassels and green cobs, taller than a person, in a field some way from the homestead. A woman farmer stands among the rows at mid-distance, checking a cob. Climbing beans wind up some of the stalks and broad pumpkin leaves cover the ground between. A rondavel is small in the far distance. |
| `public/manual/figures/05-chicken-needs-yields.jpg` | 5 · Animal systems | *Diagram.* Chicken cut-out with arrows to its needs, products and behaviours | *Diagram.* A painted teaching diagram on a plain warm-cream background with one healthy brown hen in the centre. On the left, small painted pictures with arrows pointing IN to the hen: a bowl of grain, a dish of clean water, a small wooden coop (shelter), a little heap of grit and a patch of dry dust for bathing. On the right, arrows pointing OUT from the hen to: a bowl of eggs, a covered cooking pot (meat), a small heap of manure going onto a garden bed, and a few feathers. Below the hen, two small scenes of what a hen does by nature: one scratching up soil, one pecking at insects. Shapes and arrows only; no words, letters or numbers. |
| `public/manual/figures/05-poultry-tractors.jpg` | 5 · Animal systems | Round wire-mesh poultry pens with cloth covers on grass; turkeys in a netting run behind | Three round, movable poultry pens made of wire mesh, each half-covered with canvas for shade, standing on green grass with chickens inside. Behind each pen, a round patch of shorter, scratched and manured grass shows where it stood a few days ago, and older patches are already growing back green. A woman farmer pulls one pen forward by its handle onto fresh grass. In the background, turkeys forage inside a run of movable electric netting. |
| `public/manual/figures/05-chicken-tractor.jpg` | 5 · Animal systems | Wooden A-frame chicken tractor with wire mesh, a tin roof and a drinker | A light wooden A-frame chicken tractor on grass beside a vegetable garden: a triangular timber frame with wire-mesh sides, one end covered with a sheet of corrugated iron for shade and rain, a small nest box, a hanging drinker inside, two small wheels at one end and handles at the other so one person can move it. Four hens peck at the grass inside. |
| `public/manual/figures/05-poultry-netting-energiser.jpg` | 5 · Animal systems | Electric-fence energiser box on a post beside orange poultry netting | A movable poultry run on grass: orange-and-white electric poultry netting held up by thin posts in a wide loop; a small plain grey energiser box on a post with its own small solar panel tilted towards the sun in the northern sky, a thin wire leading to the netting. Hens forage inside, and a simple coop on skids stands in the middle. No brand names or writing. |
| `public/manual/figures/05-pigs-windfall-fruit.jpg` | 5 · Animal systems | Four young pigs eating a pile of windfall apricots on straw | Four young pigs happily eating a pile of fallen, over-ripe apricots tipped onto straw under the fruit trees of a small orchard; a few apricots still hang on the branches above, and a bucket of more spoiled fruit stands beside the pile. Warm and lively. |
| `public/manual/figures/05-pig-tractor.jpg` | 5 · Animal systems | Solar panel powering an electric fence; pigs grazing a grass paddock; small shelter | A pig tractor on a gentle slope: a small paddock of long grass closed in by two strands of electric wire on thin posts, powered by an energiser with a small solar panel facing the northern sun. Four pigs graze and root in the grass; a simple low shelter of poles with a shade-cloth roof and a water trough stand in one corner. Outside the fence the grass is untouched. (Make before `05-pig-cleared-ground`.) |
| `public/manual/figures/05-pig-cleared-ground.jpg` | 5 · Animal systems | Rooted-over bare ground inside electric-fence strands, green shade-cloth shelter | The same kind of paddock after the pigs have moved on: inside the strands of an electric fence the grass is gone and the soil is rooted up, loose and dark, with the empty shade-cloth shelter standing in one corner. Just beyond the fence, in the next paddock, the pigs are grazing long green grass. A farmer with a rake starts to level the turned soil, ready for planting. |
| `public/manual/figures/05-muscovy-ducks.jpg` | 5 · Animal systems | Group of black-and-white Muscovy ducks resting under a large tree | A group of black-and-white Muscovy ducks, with patches of bare red skin around their eyes, resting and grazing in the dappled shade of a large marula tree at the edge of a garden; one duck snaps at an insect in the grass; a shallow water dish stands nearby. Calm and peaceful. |
| `public/manual/figures/05-hive-on-tyres.jpg` | 5 · Animal systems | Wooden box hive standing on a stack of old tyres, bees at the entrance | A wooden box beehive standing level on a stack of three old tyres, off the damp ground, at the edge of a field in the light shade of a sweet thorn tree. Bees fly in and out of the entrance; a strip of flowering indigenous plants grows nearby. The house is small and far away in the background: the hive is well away from where people live and walk. |
| `public/manual/figures/06-food-forest-durban.jpg` | 6 · Tree systems | Overhead view of a subtropical food forest: bananas, a young fruit tree, shrubs, groundcover | A subtropical food forest on the warm, humid KwaZulu-Natal coast, seen from above at an angle: broad banana leaves, a young mango tree, papaya, pigeon pea shrubs, clumps of lemongrass and amadumbe, and a groundcover of sweet potato vines. Every bit of soil is covered by plants or mulch; no bare ground anywhere. Lush, layered and green. |
| `public/manual/figures/06-quince.jpg` | 6 · Tree systems | Branch loaded with ripe yellow quinces | A branch of a quince tree bending under large, ripe, golden-yellow quinces with a soft fuzz, in cool autumn light. Behind, softly out of focus, high mountains and pale winter grassland of a cold Highveld or Lesotho farm. |
| `public/manual/figures/06-peach.jpg` | 6 · Tree systems | Hand holding a young fuzzy peach on the branch | A close view of a farmer's hand gently cupping a young, fuzzy, green-and-pink peach still on its branch, among long, narrow peach leaves; more small peaches along the branch; a soft orchard background. |
| `public/manual/figures/06-apple.jpg` | 6 · Tree systems | Hand holding a young green apple on the branch | A close view of a farmer's hand cupping a young green apple still on its branch, among oval apple leaves; a few more small apples on the branch; a soft background of a small orchard in a cool, hilly area. |
| `public/manual/figures/06-legume-seed-mix.jpg` | 6 · Tree systems | Hand scooping a glass bowl of mixed cowpea and bean seed | A farmer's hand scooping mixed legume seed from a wide enamel bowl: cream cowpeas with black eyes, speckled beans, red beans and white beans. Beside the bowl, on the ground, a row of young fruit trees in mulched basins with bare soil between them, where the seed will be sown as a groundcover. |
| `public/manual/figures/06-planting-basins.jpg` | 6 · Tree systems | Volunteers digging rows of planting basins; young trees in bags waiting; plantation on the hill | A gentle slope with rows of freshly dug, round planting basins, all ready; beside each basin a young fruit tree in a black nursery bag waits to be planted. In the distance a group of volunteers with spades and picks finish the last basins. Indigenous grassland hills behind (no plantation trees). |
| `public/manual/figures/06-food-forest-layers.jpg` | 6 · Tree systems | *Diagram.* Line drawing of seven numbered food-forest layers on a swale-and-berm cross-section | *Diagram.* A painted side view (cross-section) of a food forest planted along a swale on a gentle slope that falls from left to right: the swale ditch on the uphill side (left) holds a strip of blue water, and the mounded berm is on its downhill side (right). On and below the berm grow seven clear layers of plants at different heights: a tall marula tree; smaller citrus and peach trees; pigeon pea shrubs; herbs such as lemongrass and comfrey; sweet potatoes and amadumbe shown as roots in a cut-away of the soil; pumpkin vines spreading across the ground; and climbing beans winding up a tree. Soft bands of colour behind each height help tell the layers apart. Shapes only; no words, letters or numbers. |
| `public/manual/figures/06-turmeric-harvest.jpg` | 6 · Tree systems | Freshly dug turmeric rhizomes laid out on turmeric leaves | Freshly dug turmeric: knobbly clumps of rhizomes with soil still on them, one broken open to show the bright orange inside, laid out on large, long turmeric leaves on the ground in a shady corner of a warm food forest, with a garden fork beside them. |
| `public/manual/figures/06-wild-dagga.jpg` | 6 · Tree systems | Wild dagga (*Leonotis leonurus*) in orange flower against a blue sky | A tall wild dagga shrub (*Leonotis leonurus*) with round whorls of bright orange, tube-shaped flowers stacked up its upright stems and narrow grey-green leaves, growing in a row with other shrubs as a windbreak at the edge of a vegetable garden. A small sunbird with a long curved beak feeds at one of the flowers. Clear sky behind. |
| `public/manual/figures/06-staking-a-tree.jpg` | 6 · Tree systems | Man holding a young tree against a stake while tying it; a second man with a spade | A farmer ties a newly planted young fruit tree to a wooden stake with a soft strip of cloth in a loose figure of eight; the stake is on the windward side of the tree; the tree stands in a fresh mulched basin. A second farmer with a spade stands just behind. Seen from mid-distance, with the tie and the hands clear. |
| `public/manual/figures/07-swale-full-of-runoff.jpg` | 7 · Earthworks and water | Water-filled swale between mulched Swiss chard beds along a fence | After rain: a gravel driveway slopes down to a level swale dug along the contour just below it; a low earth mound across the driveway turns the runoff into the swale. The swale is full of still, brown water lying level along its whole length and slowly soaking in; mulched beds of Swiss chard grow on the berm below it, and a fence runs along one side. |
| `public/manual/figures/07-swale-dug-by-machine.jpg` | 7 · Earthworks and water | Man holding a survey staff beside a TLB digging a swale in red soil | A plain yellow backhoe loader (TLB) digging a long, gently curving swale along the contour of a slope in red soil, heaping the soil on the downhill side. A man stands a safe distance away holding a tall surveyor's staff with plain coloured bands (no numbers) to check the level; a line of pegs marks the contour ahead. Generic machine, no badges or writing. |
| `public/manual/figures/07-rain-barrel.jpg` | 7 · Earthworks and water | Blue drum under a roof downpipe with a tap; person washing hands into a bucket | A blue plastic drum on a low stand of bricks under the downpipe from the gutter of a corrugated-iron roof. The drum has a close-fitting lid, the pipe enters it through a mesh screen, and there is a tap near the bottom. A woman washes her hands under the tap into a bucket. Plain drum, no writing. |
| `public/manual/figures/07-linked-tanks.jpg` | 7 · Earthworks and water | Three green water tanks on a block plinth, joined by a pipe at the base | Three round green plastic water tanks side by side on a raised plinth of cement blocks beside a house, joined to each other by one pipe near their bases; a roof gutter and downpipe feed the first tank, and a tap sits on the joining pipe. Plain tanks, no brand names or writing. |
| `public/manual/figures/07-infiltration-basins.jpg` | 7 · Earthworks and water | Stone-edged channels and basins leading runoff to young trees beside a house | Just after rain beside a rural house: shallow channels lined with stones carry runoff from the roof and yard gently downhill into round, stone-edged, mulched basins around young fruit trees. Water pools in each basin, and an overflow from the first basin leads on to the next tree further down the slope. |
| `public/manual/figures/07-runoff-dam.jpg` | 7 · Earthworks and water | Muddy runoff dam in a valley among bush, two people standing above | A small earth runoff dam at the top of a property, where a shallow valley narrows among bushveld: a curved earth wall with a stone-lined spillway at one end, brown runoff water held behind it. Water clearly comes down the valley into the dam. Two small figures stand on the wall; mountains in the distance. |
| `public/manual/figures/07-pond-digging.jpg` | 7 · Earthworks and water | TLB digging a pond in rocky red soil, a worker with a pick in the hole, school buildings and tanks behind | A plain yellow backhoe loader (TLB) digging a runoff pond with gently sloping sides in rocky red soil. The workers stand well back behind a rope on pegs, far from the working machine; nobody is in the hole. Low school buildings and water tanks behind. Generic machine, no badges or writing. (Make before `07-pond-filled`.) |
| `public/manual/figures/07-pond-filled.jpg` | 7 · Earthworks and water | The same pond, plastic-lined and holding muddy water, behind a fence | The same pond some weeks later, full of brown rainwater: its sloping sides lined with black plastic whose edges are buried in the soil, and a sturdy wire fence with a closed gate all around it. The same school buildings and water tanks behind; green grass growing back on the bare ground. |
| `public/manual/figures/07-sand-dam-diagram.jpg` | 7 · Earthworks and water | *Diagram.* Hand-lettered cross-section: concrete wall on bedrock, sand and water held behind it, silt flowing over | *Diagram.* A painted cut-away side view of a sand dam in a dry river bed: a strong concrete wall built across the river, standing on grey bedrock. Upstream of the wall (on the left) a thick wedge of sand fills the river bed up to the top of the wall, with blue water held in the spaces between the sand grains. The hot sun above shines on the dry sand surface but cannot reach the water below. A small arrow shows a stream flowing from left to right over the top of the wall, carrying fine silt away downstream. On the bank, a hand pump draws clean water from the wet sand. Shapes and arrows only; no words, letters or numbers. |
| `public/manual/figures/07-sand-dam-lesotho.jpg` | 7 · Earthworks and water | Concrete sand-dam wall across a river bed with people standing on it, mountains behind | A concrete sand dam across a wide, sandy river bed in the mountains of Lesotho: the wall stands just above the flat bed of sand built up behind it, and a thin stream trickles over its top. A small group of people stand on the wall, seen from a distance. High green-and-brown mountains behind; only low indigenous shrubs on the banks (no poplar or willow trees). |
| `public/manual/figures/07-a-frame-contour.jpg` | 7 · Earthworks and water | Group of trainees using a wooden A-frame and pegs to mark a contour line on grass | A group of farmers on a grassy slope pegging out a contour line with a home-made wooden A-frame level: one steadies the A-frame, another knocks in a wooden peg at its foot. Behind them a line of pegs curves gently across the slope, following the shape of the land and staying at the same height all along. Seen from mid-distance. |
| `public/manual/figures/07-swale-digging.jpg` | 7 · Earthworks and water | Young man digging a swale trench, soil heaped as a berm; tunnel and chicken coop behind | A young man digs a swale by hand with a spade along a line of pegs on a gentle slope, throwing the soil onto the downhill side where it builds a long, rounded berm. The trench is level and follows the contour across the slope. A garden tunnel and a chicken coop behind. Seen from mid-distance. |
| `public/manual/figures/07-volunteers-dug-beds.jpg` | 7 · Earthworks and water | About fifteen cheering volunteers holding spades and forks on freshly dug beds | A team of about a dozen volunteers of all ages stand cheerfully around a small vegetable garden they have just dug by hand, raising their spades and garden forks. The freshly dug beds are dark and neat. Seen from mid-distance, with no close-up faces. |
| `public/manual/figures/07-tarping.jpg` | 7 · Earthworks and water | Black plastic weighted with straw bales and sandbags inside a wire fence | A large sheet of black plastic spread over a grassy area inside a wire fence, held down along its edges and across the middle by straw bales and filled sandbags. At one corner the plastic is folded back to show pale, yellow, dead grass underneath, ready to be made into beds without digging. |
| `public/manual/figures/07-beds-on-contour.jpg` | 7 · Earthworks and water | Beds pegged out in bare red soil along the contour, soil pulled downslope | Vegetable beds being made on a gentle slope of red soil: long beds marked with pegs and string follow the contour across the slope, and the soil has been pulled downhill within each bed so that every bed top is level, with a small step down to the next bed. A farmer with a rake levels one bed. |
| `public/manual/figures/07-stone-edged-beds.jpg` | 7 · Earthworks and water | Stone-edged beds filled with dark topsoil, workers behind (and a wheelbarrow at the edging stage) | Narrow double-reach vegetable beds, each about as wide as a person can reach to the middle from both sides, edged with rows of local stones and filled with dark, rich topsoil, with paths between them. A wheelbarrow of topsoil stands in front, and workers behind are still laying edging stones. |
| `public/manual/figures/07-banana-circle.jpg` | 7 · Earthworks and water | Man hosing a round pit lined with cardboard and compost | A round pit bed (banana circle), about two metres across, dug into the ground and filled with cardboard, cut grass and kitchen waste. A farmer waters it with a hose. The dug-out soil forms a low ring around the rim, where young banana plants, amadumbe and sweet potato have been planted. |
| `public/manual/figures/07-hand-watering.jpg` | 7 · Earthworks and water | Woman watering Swiss chard with a watering can under shade net | A woman waters a mulched bed of Swiss chard with a metal watering can under a shade-net structure, pouring gently onto the soil at the base of the plants, not over the leaves. Three-quarter view, her face looking down at the plants. |
| `public/manual/figures/07-bottle-irrigation.jpg` | 7 · Earthworks and water | Watering can filling an upturned bottle buried among carrots and marigolds | In a bed of carrots and orange marigolds, a plastic bottle with its bottom cut off is buried neck-down beside the plants, and a watering can fills it through the open top. A cut-away strip of soil at the front shows water seeping slowly out of the bottle's neck into the roots. Plain bottle, no label. |
| `public/manual/figures/07-drip-irrigation.jpg` | 7 · Earthworks and water | Drip line running past the base of a pepper plant | A close view of a thin black drip line running along a mulched row past the base of green pepper plants with glossy peppers. A single drop falls from the emitter beside each stem, and a dark circle of wet soil spreads around the roots only; the soil between the plants stays dry. |
| `public/manual/figures/07-greywater-drum.jpg` | 7 · Earthworks and water | Blue drum with a tap on blocks, greywater pipe to a filter box; a text label in the photo | Outside a rural kitchen: a pipe from the kitchen sink drains into a blue drum raised on cement blocks, with a tap at the bottom; from the drum a pipe runs to a small filter box (grease trap) filled with gravel and straw, and from there another pipe leads downhill to a mulched swale planted with bananas and young fruit trees. The water flows only downhill, from kitchen to garden. No labels or writing. |
| `public/manual/figures/08-soil-profile.jpg` | 8 · Soil | *Diagram.* Coloured drawing of a block of soil: grass, dark topsoil with roots, subsoil, stones | *Diagram.* A painted cut-away block of soil, like a slice of cake, on a plain warm-cream background: grass and a small plant on top; a deep band of dark-brown topsoil full of fine roots, earthworms and bits of leaf; below it a paler, reddish-brown subsoil with fewer, longer roots; at the bottom a layer of stones and cracked grey rock. Clear bands, shapes only; no words, letters or numbers. |
| `public/manual/figures/08-straw-mulch.jpg` | 8 · Soil | Pumpkin-family seedling growing through straw mulch | A close view of a young pumpkin seedling with its first broad leaves growing up through a thick blanket of golden straw mulch; a small patch of straw pulled back beside it shows dark, moist soil underneath. |
| `public/manual/figures/08-manure-on-cut-grass.jpg` | 8 · Soil | Wheelbarrow of manure being spread on cut grass | A farmer tips a wheelbarrow of dark, crumbly cattle manure onto a patch of freshly cut, moist green grass and spreads it with a garden fork: the first layer of a new sheet-mulched bed. The bed is marked out with pegs and string. (Make first of the three sheet-mulch pictures.) |
| `public/manual/figures/08-sheet-mulch-cardboard.jpg` | 8 · Soil | Cardboard sheets laid on grass with compost shovelled on top | The same bed, next step: flattened plain brown cardboard sheets laid over the grass with generous overlaps and wetted; a farmer shovels dark compost from a wheelbarrow over the cardboard, and half of it is already covered. The cardboard has no printing, tape or logos. |
| `public/manual/figures/08-planting-into-mulch.jpg` | 8 · Soil | Man planting seedlings into a thick straw-mulched bed | The same bed, finished: a farmer kneels beside it, parting a thick layer of straw with his hands to plant a cabbage seedling into the compost below; a tray of seedlings beside him, and a row already planted along the bed. |
| `public/manual/figures/08-compost-stick-base.jpg` | 8 · Soil | Group of women building a compost heap on a base of sticks, spreading hay | A group of women build a compost heap outdoors: the bottom layer is a criss-cross base of dry sticks and small branches that lets air in from below, and on top of it they spread dry hay and green garden cuttings. A pile of materials and a garden fork lie beside them. Seen from mid-distance. |
| `public/manual/figures/08-compost-watering-layers.jpg` | 8 · Soil | Woman watering a layered compost heap while three trainees watch | A woman waters a half-built compost heap with a watering can while three trainees watch. The side of the heap shows clear alternating layers of brown dry material and green fresh material, and it sits on a base of sticks. A fork and more materials beside them. |
| `public/manual/figures/08-red-wigglers.jpg` | 8 · Soil | Handful of worm-farm compost with red wiggler worms | A close view of two cupped hands holding dark, moist worm-farm compost with several small, thin, dark-red compost worms (red wigglers) moving in it; a worm bin with more bedding softly behind. |
| `public/manual/figures/08-bathtub-worm-farm.jpg` | 8 · Soil | Old bathtub on bricks filled with worm bedding under a hessian cover | An old white bathtub raised on brick piles in the shade of a wall, used as a worm farm: filled with dark bedding and vegetable scraps, partly covered by a folded-back hessian sack. At one end the plughole drips dark worm tea into a bucket underneath. |
| `public/manual/figures/09-cowpea-ground-cover.jpg` | 9 · A balanced, productive ecology | Woman crouching in a dense cowpea groundcover | A dense, knee-high cowpea groundcover completely covering the soil between young fruit trees, with three-part leaves, pale purple flowers and long green pods. A woman crouches among the plants picking pods into a basket, her face turned down to her work. |
| `public/manual/figures/09-wildlife-pond.jpg` | 9 · A balanced, productive ecology | Man pouring water into a small plastic-lined, stone-edged pond in a vegetable bed | A small wildlife pond sunk into the ground at the corner of a vegetable garden, made from an old tyre lined with plastic, its edge hidden under a ring of flat stones. A farmer pours a tub of water into it. A frog sits on one stone, a dragonfly hovers over the water, and a stick slopes into the pond so small animals can climb out. |
| `public/manual/figures/10-companion-flowers.jpg` | 10 · Natural pest control | Cabbages with marigolds, nasturtiums and borage flowering between them | A vegetable bed where healthy cabbages grow mixed with orange marigolds, orange and yellow nasturtiums and blue, star-shaped borage flowers between them. Bees and a small hoverfly visit the flowers. |
| `public/manual/figures/10-onions-beside-carrots.jpg` | 10 · Natural pest control | Row of onions along the edge of a carrot bed | A thick bed of feathery carrot tops, edged along both long sides by neat rows of onions with upright, hollow green leaves; a mulched path beside the bed. |
| `public/manual/figures/11-stone-house-bethel.jpg` | 11 · The sustainable home | Stone-and-cob building with solar panels, a roof ventilator and a solar collector in front (Lesotho) | A sturdy building of local stone and cob with thick walls, deep-set windows and a roof overhang on the sunny north side, in a mountain valley in Lesotho. Solar panels sit on the north-facing roof, a round ventilator turns on the ridge, and a solar water heater stands in front. Mountains behind. |
| `public/manual/figures/11-small-solar-panels.jpg` | 11 · The sustainable home | Two small solar panels on a corrugated-iron roof, seen from above | Seen from a little above: two small solar panels fixed side by side on the corrugated-iron roof of a small block house, tilted towards the sun in the northern sky, with a thin cable running from them down under the edge of the roof. Plain panels, no writing. |
| `public/manual/figures/11-solar-geyser.jpg` | 11 · The sustainable home | Evacuated-tube solar geyser on a tiled roof | An evacuated-tube solar water heater on the roof of a small house: a row of dark glass tubes set at an angle below a long white tank, facing the sun in the northern sky; pipes run from it down into the house. No brand names or writing. |
| `public/manual/figures/11-solar-oven.jpg` | 11 · The sustainable home | Gloved hand lifting the lid of a pot of stew in a reflective box solar oven | A box solar cooker standing in full sun in a yard: an insulated box with a glass lid and a shiny reflector panel angled to catch the sun in the northern sky. Hands in thick oven gloves lift the lid of a dark pot of bean-and-vegetable stew inside. |
| `public/manual/figures/11-sun-drying-fruit.jpg` | 11 · The sustainable home | Rows of fruit halves drying on corrugated iron | Rows of halved peaches and apricots, cut side up, drying in full sun on a sheet of corrugated iron raised on a wooden stand well off the ground; fine white netting is pulled over part of it to keep off flies, and a woman lays out more halves from a basin. |
| `public/manual/figures/11-solar-dryer.jpg` | 11 · The sustainable home | Glass-lidded solar dryer on legs with sliced produce on the tray | A home-made solar dryer: a wooden box on legs with a sloping glass lid facing the sun in the northern sky, and small vents at the low and high ends. The lid is lifted to show a mesh tray of sliced mango, tomato and pumpkin drying cleanly inside. |
| `public/manual/figures/11-wonder-bag.jpg` | 11 · The sustainable home | Closed fabric heat-retention cooker on a table (brand label visible) | In a rural kitchen, a woman lowers a pot that has just boiled on a small gas stove into a round, thick, padded cloth bag (a heat-retention cooker) on the table; the bag's padded top lies beside it, ready to close over the pot with a drawstring. Plain patterned fabric, no labels. |
| `public/manual/figures/11-biogas-digester-build.jpg` | 11 · The sustainable home | Trainees in hi-vis around a block-lined pit with a green plastic digester tank, one person in the pit | Building a household biogas digester: a large green plastic digester tank being lowered into a deep pit lined with cement blocks. One worker in a hi-vis vest and hard hat stands in the pit guiding the tank while several others in hi-vis stand at the edge holding ropes and watching, so nobody is ever in the pit alone. A mountain village behind. No writing on the tank or vests. |

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
- [ ] **Teaches the caption (set D):** a farmer who reads the English caption in `figures.json`
      can point to each thing it mentions in the picture; diagrams have no words or numbers.
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
- Pictures: `public/manual/figures/<slot-id>.jpg`, exact names from tables 4.C and 4.D. A set-D
  picture overwrites the old photo of the same name; do not keep the old photo beside it under
  another name in that folder.

### 6.3 `content/manual/figures.json`

- Every slot in 4.C is already listed at **1400 × 1050** with the credit
  `"Illustration: made with AI for this manual"`. If a saved picture is 1400 × 1050, change
  nothing.
- Every slot in 4.D is listed with the old photo's size and a credit that starts with
  "Photo: RVCC…" or "Diagram: RVCC…". For each one you replace, change only three fields:
  `"credit": "Illustration: made with AI for this manual"`, `"width": 1400`, `"height": 1050`.
  Leave `id`, `src`, `chapter`, `section` and the captions exactly as they are.
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
- the new pictures appear with their captions;
- no old photograph is left anywhere in the book (every picture is in the one painted style).

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
