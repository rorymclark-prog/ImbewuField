# Course Art Audit Report (2026-08-10)

## Executive Summary

- **Total Course Lessons**: 33
- **Total Images Inspected**: 33 / 33 (100% opened and visually audited)
- **Defects Identified**: 6 images contain physical, pedagogical, regional (SA context), or alt-text defects.
- **Passed Images**: 27 images accurately depict the lesson key points, alt text claims, and South African context.

---

## Audit Coverage Verification

All **33 course image files** under `public/course-images/` were individually opened and visually inspected against their respective `title`, `body`, `keyPoints`, and `infographicAlt` in [`lib/course-modules.ts`](file:///Users/roryclark/ImbewuField-agy3/lib/course-modules.ts).

No image or lesson text was modified during this audit.

---

## Detailed Findings (Ordered Worst First)

### 1. `water-harvesting-l3` — Broken First-Flush Diverter Plumbing Diagram
- **Module**: `water-harvesting` (Water Harvesting)
- **Lesson**: `water-harvesting-l3` ("Rainwater Tanks and Roof Catchment: Harvesting Clean Water")
- **Image Path**: [`public/course-images/water-harvesting/water-harvesting-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/water-harvesting/water-harvesting-l3.jpg)
- **Alt Text Claim**: *"Rain running off a roof into a gutter and down a pipe into a tank, with a small first-flush diverter branching off before the tank to throw away the dirty first water."*
- **Specific Defect**:
  1. **Physically Impossible Plumbing Topology**: In a real first-flush diverter, the first dirty water flows straight down into a vertical diversion pipe. As it fills, a floating ball rises to the top seat of that vertical pipe, sealing it off so subsequent clean water diverts into the side pipe leading to the storage tank. In this image, the main downpipe goes straight down to an open outlet (marked with a down arrow). Off to the left, a T-junction connects to a separate, isolated glass cylinder containing a floating blue ball, capped top and bottom. A floating ball in a dead-end side chamber cannot seal either the main downpipe or the tank line. Water coming down the gutter would either spill out the bottom of the main pipe or flow directly into the tank without any first-flush diversion occurring.
  2. **Non-Local Building Detail**: The building roof features terracotta/clay European-style S-tiles, whereas the lesson text specifically states: *"A 100 square metre corrugated iron roof in Pietermaritzburg..."*.
- **Recommended Redo**: Redraw the plumbing schematic with correct physical topology (vertical first-flush chamber directly below downpipe with ball floating up to seal the chamber seat, diverting clean water to tank) and corrugated iron roofing.

---

### 2. `reading-landscape-l2` — Misleading Sun & Aspect Arrow Diagram
- **Module**: `reading-landscape` (Reading the Landscape)
- **Lesson**: `reading-landscape-l2` ("Sun Angles, Shade, and Aspect: Getting the Most from Sunlight")
- **Image Path**: [`public/course-images/reading-landscape/reading-landscape-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/reading-landscape/reading-landscape-l2.jpg)
- **Alt Text Claim**: *"A slope with the sun in the north. Shadows from the building and the tree fall south, down the slope."*
- **Specific Defect**:
  1. **Confusing Directional Arrow**: A dark, solid arrow directly underneath the sun icon points **UP** towards the sun. In a diagram teaching sun tracking and shadow casting, an arrow pointing UP into the sun confuses learners: sun rays radiate downward, and North on a side elevation cannot be indicated by an arrow pointing into the sky.
  2. **Inconsistent Shadow Geometry**: The sun icon sits directly above the center of the diagram, yet the building and tree cast long diagonal shadows stretching to the bottom-right (downhill/south). Without angled sun rays or clear horizon labeling, the shadow direction contradicts the overhead sun position.
- **Recommended Redo**: Remove the confusing upward arrow under the sun. Clearly mark North/South orientation on the slope and draw explicit light rays connecting the northern sun position to the southern shadow fall.

---

### 3. `reading-landscape-l3` — Snowflake Symbols Used for South African Frost
- **Module**: `reading-landscape` (Reading the Landscape)
- **Lesson**: `reading-landscape-l3` ("Wind, Frost, and Topography: Reading the Invisible Forces")
- **Image Path**: [`public/course-images/reading-landscape/reading-landscape-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/reading-landscape/reading-landscape-l3.jpg)
- **Alt Text Claim**: *"A farm from above with three sets of arrows: the direction the wind usually comes from, cold air draining downhill into a frost hollow, and the direction the land slopes."*
- **Specific Defect**:
  - **Wrong for South Africa (Snowflakes for Frost)**: Explicit 6-pointed **snowflake** symbols are drawn along the cold air drainage channels and inside the valley frost pool. In South African smallholder farming (Highveld, KZN Midlands), winter frost is radiation frost (sub-zero night ground temps producing frozen dew/white frost at dawn), **not falling snow**. Snow almost never falls on SA smallholdings. Using snowflake icons is factually inaccurate for SA climate and creates confusion between frost pockets and snowfall.
- **Recommended Redo**: Replace snowflake icons with temperature/dew/frost symbols (e.g., thermometer icons, ground frost crystals, or shaded cold-air flow contours).

---

### 4. `vegetables-staples-l3` — Abstract Floating Geometry for Maize Crop
- **Module**: `vegetables-staples` (Vegetables and Staple Crops)
- **Lesson**: `vegetables-staples-l3` ("Staple Crops: Maize, Beans, and Root Vegetables")
- **Image Path**: [`public/course-images/vegetables-staples/vegetables-staples-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/vegetables-staples/vegetables-staples-l3.jpg)
- **Alt Text Claim**: *"Three staple crops together: a tall grain stalk, a climbing vine on a pole, and a root crop shown half below the ground."*
- **Specific Defect**:
  - **Pedagogical Failure**: The left crop (intended as maize/grain) depicts grass-like leaves topped by a cluster of **floating abstract geometric shapes** (brown circles and green triangles). It does not depict a maize stalk, maize cobs, husks, or tassels. Smallholders relying on visual diagrams cannot recognize maize from floating geometric symbols. The middle crop (climbing bean) and right crop (sweet potato/amadumbe root) are drawn realistically, making the floating geometry on the left crop even more out of place.
- **Recommended Redo**: Redraw the left staple crop as recognizable South African open-pollinated maize with clear cobs, husks, and top tassel.

---

### 5. `soil-health-l1` — Inaccurate Jar Test (River Rocks / Gravel at Bottom)
- **Module**: `soil-health` (Soil Health & Composting)
- **Lesson**: `soil-health-l1` ("Understanding Your Soil: The Foundation of Everything")
- **Image Path**: [`public/course-images/soil-health/soil-health-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/soil-health/soil-health-l1.jpg)
- **Alt Text Claim**: *"A spade cut through the ground showing dark crumbly topsoil above pale subsoil, with worm channels. Beside it, a jar of soil settled into three layers — sand, silt and clay."*
- **Specific Defect**:
  - **Inaccurate Scientific Diagram**: The right side of the image shows the jar test. The bottom half of the sediment in the jar consists of large rounded river rocks, stones, and coarse gravel. The soil texture jar test described in the lesson ("Sand settles first, then silt, with clay staying suspended longest") is specifically designed to measure sand, silt, and clay fractions; gravel/stones are sieved out or excluded. Showing river rocks at the bottom fails to illustrate the 3 distinct soil particle layers (sand -> silt -> clay) claimed in the alt text.
- **Recommended Redo**: Redraw the jar test to clearly show the three settled soil layers (coarse sand at bottom, smooth silt in middle, fine clay band at top) without river rocks.

---

### 6. `market-community-l1` — Alt Text Mismatch (Missing Harvested Produce)
- **Module**: `market-community` (Market Gardening & Community)
- **Lesson**: `market-community-l1` ("Record-Keeping: Knowing What Your Farm Is Actually Producing")
- **Image Path**: [`public/course-images/market-community/market-community-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/market-community/market-community-l1.jpg)
- **Alt Text Claim**: *"A simple ruled record sheet with columns for what was harvested and where it went, beside a pile of harvested produce."*
- **Specific Defect**:
  - **Alt Text Mismatch**: Alt text explicitly states that the record sheet is *"beside a pile of harvested produce"*. In the image, the record grid fills 100% of the frame; there is no pile of harvested produce drawn anywhere in the image. (The record table headers themselves are clear and well-designed).
- **Recommended Redo**: Either update the alt text in `lib/course-modules.ts` to omit "beside a pile of harvested produce", or redraw the image to include produce alongside the record sheet.

---

## Passed Images (27 / 33)

Where images are fine, single-line verification is recorded below:

1. **`intro-permaculture-l1`** ([`public/course-images/intro-permaculture/intro-permaculture-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/intro-permaculture/intro-permaculture-l1.jpg)): **PASS** — Accurately shows 3 linked circles (soil seedling, two people, sharing basket) matching alt text and 3 ethics.
2. **`intro-permaculture-l2`** ([`public/course-images/intro-permaculture/intro-permaculture-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/intro-permaculture/intro-permaculture-l2.jpg)): **PASS** — Accurately displays 12 design principle icon segments around a central seedling.
3. **`reading-landscape-l1`** ([`public/course-images/reading-landscape/reading-landscape-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/reading-landscape/reading-landscape-l1.jpg)): **PASS** — Accurately shows hillside cross-section with rainfall runoff, flat infiltration, and water collection.
4. **`reading-landscape-l4`** ([`public/course-images/reading-landscape/reading-landscape-l4.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/reading-landscape/reading-landscape-l4.jpg)): **PASS** — Accurately shows a hand-drawn paper site map with north arrow, building, stream, dam, and trees.
5. **`water-harvesting-l1`** ([`public/course-images/water-harvesting/water-harvesting-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/water-harvesting/water-harvesting-l1.jpg)): **PASS** — Accurately depicts swale trench on contour, downhill berm, and deep soil infiltration arrows.
6. **`water-harvesting-l2`** ([`public/course-images/water-harvesting/water-harvesting-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/water-harvesting/water-harvesting-l2.jpg)): **PASS** — Accurately depicts dam cross-section with inlet slope, shade tree, stored water, and top spillway overflow.
7. **`water-harvesting-l4`** ([`public/course-images/water-harvesting/water-harvesting-l4.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/water-harvesting/water-harvesting-l4.jpg)): **PASS** — Accurately depicts indoor washbasin greywater draining through underground pipe to tree mulch basin.
8. **`soil-health-l2`** ([`public/course-images/soil-health/soil-health-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/soil-health/soil-health-l2.jpg)): **PASS** — Accurately depicts layered compost heap (brown/green), rising heat, turning arrow, and pitchfork.
9. **`soil-health-l3`** ([`public/course-images/soil-health/soil-health-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/soil-health/soil-health-l3.jpg)): **PASS** — Accurately compares bare cracked soil vs. mulched dark moist soil under the sun.
10. **`vegetables-staples-l1`** ([`public/course-images/vegetables-staples/vegetables-staples-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/vegetables-staples/vegetables-staples-l1.jpg)): **PASS** — Accurately depicts 1.2m raised bed with side paths and farmer reaching middle without stepping on soil.
11. **`vegetables-staples-l2`** ([`public/course-images/vegetables-staples/vegetables-staples-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/vegetables-staples/vegetables-staples-l2.jpg)): **PASS** — Accurately depicts succession planting stages across raised beds.
12. **`vegetables-staples-l4`** ([`public/course-images/vegetables-staples/vegetables-staples-l4.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/vegetables-staples/vegetables-staples-l4.jpg)): **PASS** — Accurately depicts leaf pest with 3 non-chemical controls (beneficial insect, net barrier, hand picking).
13. **`seeds-sovereignty-l1`** ([`public/course-images/seeds-sovereignty/seeds-sovereignty-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/seeds-sovereignty/seeds-sovereignty-l1.jpg)): **PASS** — High quality artwork comparing open-pollinated uniform offspring vs F1 hybrid variable offspring.
14. **`seeds-sovereignty-l2`** ([`public/course-images/seeds-sovereignty/seeds-sovereignty-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/seeds-sovereignty/seeds-sovereignty-l2.jpg)): **PASS** — High quality artwork depicting dry pod seed collection vs wet tomato seed fermentation jar & drying paper.
15. **`seeds-sovereignty-l3`** ([`public/course-images/seeds-sovereignty/seeds-sovereignty-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/seeds-sovereignty/seeds-sovereignty-l3.jpg)): **PASS** — High quality artwork showing seed envelopes in sealed container, cool/dark/dry icons, and damp towel germination test.
16. **`plant-guilds-l1`** ([`public/course-images/plant-guilds/plant-guilds-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/plant-guilds/plant-guilds-l1.jpg)): **PASS** — High quality cutaway showing legume root nodules and nutrient flow downhill to fruit tree.
17. **`plant-guilds-l2`** ([`public/course-images/plant-guilds/plant-guilds-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/plant-guilds/plant-guilds-l2.jpg)): **PASS** — High quality artwork showing comfrey chop-and-drop mulching beside flowering beneficial insect plants.
18. **`plant-guilds-l3`** ([`public/course-images/plant-guilds/plant-guilds-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/plant-guilds/plant-guilds-l3.jpg)): **PASS** — High quality top-down diagram showing central tree surrounded by 5 distinct companion plant layers.
19. **`food-forest-l1`** ([`public/course-images/food-forest/food-forest-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/food-forest/food-forest-l1.jpg)): **PASS** — High quality cross-section showing 7 layers from canopy down to root crops and trunk climber.
20. **`food-forest-l2`** ([`public/course-images/food-forest/food-forest-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/food-forest/food-forest-l2.jpg)): **PASS** — High quality SA map showing 3 distinct climate zones (coast, highveld, lowveld) and corresponding tree types.
21. **`food-forest-l3`** ([`public/course-images/food-forest/food-forest-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/food-forest/food-forest-l3.jpg)): **PASS** — High quality 4-stage progression showing sheet-mulch -> pioneers -> young canopy -> mature food forest.
22. **`small-livestock-l1`** ([`public/course-images/small-livestock/small-livestock-l1.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/small-livestock/small-livestock-l1.jpg)): **PASS** — Accurately depicts mobile chicken tractor progression leaving scratched and enriched soil.
23. **`small-livestock-l2`** ([`public/course-images/small-livestock/small-livestock-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/small-livestock/small-livestock-l2.jpg)): **PASS** — Accurately depicts beehive frame cutaway and aerial site map showing bee foraging radius.
24. **`small-livestock-l3`** ([`public/course-images/small-livestock/small-livestock-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/small-livestock/small-livestock-l3.jpg)): **PASS** — Accurately depicts 4-step nutrient loop (animal -> manure -> compost -> garden bed -> animal).
25. **`market-community-l2`** ([`public/course-images/market-community/market-community-l2.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/market-community/market-community-l2.jpg)): **PASS** — Accurately depicts farm connected to 3 market channels (roadside stall, shop delivery, household box).
26. **`market-community-l3`** ([`public/course-images/market-community/market-community-l3.jpg`](file:///Users/roryclark/ImbewuField-agy3/public/course-images/market-community/market-community-l3.jpg)): **PASS** — Accurately depicts 5 small farm beds aggregating harvest into one shared central crate.
