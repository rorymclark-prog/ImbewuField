# Watch Slides Inventory & Animation Audit (2026-08-10)

**Branch**: `agy/watch-slide-inventory`  
**Scope**: Complete inventory of all slide headings beginning with `Watch:` across all 10 course modules (`docs/narration/*.md`).  
**Audit Rule**: Audit only. Zero modifications to narration scripts, lesson text, images, or application code. Zero composed isiZulu.

---

## 1. Executive Summary & Verification of Slide Counts

### The Raw Count vs. "28 Broken Promises"
- **Total `Watch:` slides across all 10 modules**: **34 slides**
- **Existing clips on disk (`public/course-animations/seeds-sovereignty/`)**: **6 clips** (all matching `Watch:` slides in `seeds-sovereignty`)
- **Missing clips on disk**: **28 slides**

### Working & Explanation of the Difference
Prior discussions referred to "28 slides needing clips". This audit verifies that **28 is the count of MISSING clips**, while the true total number of `Watch:` slides in the narration scripts is **34**.
- **34 total `Watch:` slides** - **6 existing `seeds-sovereignty` clips** = **28 missing clips**.

### Module Breakdown Table

| Module ID | English Script | isiZulu Script | Total Slides | `Watch:` Slides | Existing Clips | Missing Clips |
|---|---|---|---|---|---|---|
| `food-forest` | `food-forest.en.md` | `food-forest.zu.md` | 20 | 3 | 0 | 3 |
| `intro-permaculture` | `intro-permaculture.en.md` | `intro-permaculture.zu.md` | 21 | 3 | 0 | 3 |
| `market-community` | `market-community.en.md` | `market-community.zu.md` | 18 | 3 | 0 | 3 |
| `plant-guilds` | `plant-guilds.en.md` | `plant-guilds.zu.md` | 20 | 3 | 0 | 3 |
| `reading-landscape` | `reading-landscape.en.md` | `reading-landscape.zu.md` | 21 | 4 | 0 | 4 |
| `seeds-sovereignty` | `seeds-sovereignty.en.md` | `seeds-sovereignty.zu.md` | 24 | 6 | 6 | 0 |
| `small-livestock` | `small-livestock.en.md` | `small-livestock.zu.md` | 20 | 3 | 0 | 3 |
| `soil-health` | `soil-health.en.md` | `soil-health.zu.md` | 20 | 3 | 0 | 3 |
| `vegetables-staples` | `vegetables-staples.en.md` | `vegetables-staples.zu.md` | 18 | 0 | 0 | 0 |
| `water-harvesting` | `water-harvesting.en.md` | `water-harvesting.zu.md` | 24 | 6 | 0 | 6 |
| **TOTALS** | **10 files** | **10 files** | **206** | **34** | **6** | **28** |

---

## 2. Complete `Watch:` Slide Inventory

Ordered strictly by module, then slide number.

### 1. Module: `food-forest` — Slide 5

- **Exact Heading (EN)**: `**Slide 5 — Watch: The Seven Layers Working Together**`
- **Exact Heading (ZU)**: `**Ikhasi 5 — Buka: Ama-Layer Ayisikhombisa Esebenza Ndawonye (Slide 5 — Watch: The Seven Layers Working Together)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Read the planting downwards, from the tall canopy to the roots.

Climbers use the open vertical space between the layers.

One piece of ground, working at every level.
```

#### What the Clip Must Depict
The clip must show a vertical cross-section of a food forest displaying all seven layers (tall canopy, sub-canopy tree, shrub layer, herbaceous layer, ground cover, root zone, and climbing vines). The animation sweeps from top canopy to underground roots to highlight how multiple layers function together on a single plot.

#### Grouping & Reuse Potential
Shares vertical canopy-to-root layout with plant-guilds Slide 15 (A Mango Guild), but focuses on all 7 general forest garden layers.

---

### 2. Module: `food-forest` — Slide 10

- **Exact Heading (EN)**: `**Slide 10 — Watch: Match the Species to the Climate**`
- **Exact Heading (ZU)**: `**Ikhasi 10 — Buka: Qondanisa Izinhlobo Nesimo Sezulu (Slide 10 — Watch: Match the Species to the Climate)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Climate decides which species belong.

On the Highveld, choose cold-tolerant trees and shrubs; on the KZN coast and Lowveld, choose warm-climate species.

Match every plant to your site.
```

#### What the Clip Must Depict
The clip must depict a regional climate map of South Africa contrasting Highveld cold frost zones with KZN coast/Lowveld warm subtropical zones, showing species selection suited to each climate.

#### Grouping & Reuse Potential
Shares regional geography visual assets with reading-landscape Slide 9 (sun angle) and Slide 13 (wind/cold air).

---

### 3. Module: `food-forest` — Slide 15

- **Exact Heading (EN)**: `**Slide 15 — Watch: From Bare Ground to Food Forest**`
- **Exact Heading (ZU)**: `**Ikhasi 15 — Buka: Kusuka Emhlabathini Ovulekile Kuya Ku-Food Forest (Slide 15 — Watch: From Bare Ground to Food Forest)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Sheet-mulch first.

Pioneers build soil while fruit trees establish.

As shelter grows, plant the lower layers, ground covers, and climbers.
```

#### What the Clip Must Depict
The clip must illustrate a multi-year ecological succession sequence on a plot: starting with sheet mulching on bare ground, pioneer plants building soil while fruit trees establish, followed by understory layers, ground covers, and climbers filling in.

#### Grouping & Reuse Potential
Overlaps with soil-health Slide 10 (Compost/Mulch) and plant-guilds Slide 10 (Chop and Drop), but unique in showing long-term forest garden succession.

---

### 4. Module: `intro-permaculture` — Slide 7

- **Exact Heading (EN)**: `**Slide 7 — Watch: One Decision, Three Ethics**`
- **Exact Heading (ZU)**: `**Ikhasi 7 — Bheka: Isinqumo Esisodwa, Ama-Ethics Amathathu (Slide 7 — Watch: One Decision, Three Ethics)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
A borehole is producing more water than your household needs.

You could keep it closed. You could open it to everyone and watch the level drop.

Sharing access with your neighbours while you monitor the water table serves all three at once. People Care and Fair Share in the sharing. Earth Care in the monitoring.

[pause]

The other choices each serve one ethic and ignore the rest.
```

#### What the Clip Must Depict
The clip must show a homestead borehole with three scenario paths: locked water access, unmonitored open usage depleting the water table, and a shared neighbour tap paired with a water table level monitor.

#### Grouping & Reuse Potential
Overlaps with water table dynamics in water-harvesting and community sharing in market-community Slide 14.

---

### 5. Module: `intro-permaculture` — Slide 13

- **Exact Heading (EN)**: `**Slide 13 — Watch: Diversity Against One Bad Day**`
- **Exact Heading (ZU)**: `**Ikhasi 13 — Bheka: I-Diversity Ivikela Osukwini Olubi (Slide 13 — Watch: Diversity Against One Bad Day)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
A monoculture maize field can be wiped out by one hailstorm. A mixed planting rarely is.

That is the principle "use and value diversity", and it is insurance you plant rather than buy.

Two others worth knowing: produce no waste, so scraps become compost and compost becomes soil. And use small and slow solutions — a bucket can irrigate a bed with no electricity at all.

[pause]

What would one bad day cost you right now?
```

#### What the Clip Must Depict
The clip must show a split screen where a hailstorm destroys a uniform maize monoculture while a diverse polyculture garden survives. Inset vignettes show kitchen scraps turning into compost and bucket irrigation on a crop bed.

#### Grouping & Reuse Potential
Monoculture vs polyculture storm scene is distinct. Scraps-to-compost vignette shares assets with soil-health Slide 10 and small-livestock Slide 14.

---

### 6. Module: `intro-permaculture` — Slide 19

- **Exact Heading (EN)**: `**Slide 19 — Watch: A Windbreak Belongs On The Wind Side**`
- **Exact Heading (ZU)**: `**Ikhasi 19 — Bheka: I-Windbreak Iba Ohlangothini Lomoya (Slide 19 — Watch: A Windbreak Belongs On The Wind Side)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
A Highveld farm gets hot, dry north-westerly winds in August.

The windbreak goes on the north-west boundary, standing between the wind and the crops.

That is all a windbreak does — it stands between the energy and the thing the energy would damage. Put it anywhere else and it is just a row of trees.

[pause]

The same logic places a firebreak, and it places your tender crops out of a frost pocket.
```

#### What the Clip Must Depict
The clip must show hot dry north-westerly wind arrows approaching a farm boundary, illustrating how a tree windbreak placed on the NW boundary deflects wind up and over crops, contrasted with ineffective windbreak placements.

#### Grouping & Reuse Potential
DIRECT TWIN with reading-landscape Slide 13 (See Wind and Cold Air on the Map). Both depict wind flow across homestead boundaries and protective barriers; 1 shared animation asset can fulfill both.

---

### 7. Module: `market-community` — Slide 4

- **Exact Heading (EN)**: `**Slide 4 — Watch: What the Farm Record Shows**`
- **Exact Heading (ZU)**: `**Ikhasi 4 — Buka: Okuboniswa Irekhodi Lepulazi (Slide 4 — Watch: What the Farm Record Shows)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
The record follows each harvest to family food, sales, gifts, or compost.

Read across the season to see the farm as an economy before making a business decision.
```

#### What the Clip Must Depict
The clip must depict an animated farm record ledger tracking harvest outputs along four branching flow lines: household food, market sales, community gifts, and compost.

#### Grouping & Reuse Potential
Shares flow-diagram arrow graphics with market-community Slide 9 and small-livestock Slide 14.

---

### 8. Module: `market-community` — Slide 9

- **Exact Heading (EN)**: `**Slide 9 — Watch: Where Surplus Can Go**`
- **Exact Heading (ZU)**: `**Ikhasi 9 — Buka: Lapho Okusele Kungaya Khona (Slide 9 — Watch: Where Surplus Can Go)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Surplus can leave the farm through a roadside stall, a group delivery to a shop, or a box delivered to a household.

The arrows show each route.
```

#### What the Clip Must Depict
The clip must show three distinct farm surplus delivery routes branching from a farm gate: a roadside produce stall, collective vehicle transport to a local shop, and direct box delivery to a household.

#### Grouping & Reuse Potential
Shares distribution network graphics with market-community Slide 4 and Slide 14.

---

### 9. Module: `market-community` — Slide 14

- **Exact Heading (EN)**: `**Slide 14 — Watch: How Neighbours Strengthen a Harvest**`
- **Exact Heading (ZU)**: `**Ikhasi 14 — Buka: Omakhelwane Basqinisa Kanjani Isivuno (Slide 14 — Watch: How Neighbours Strengthen a Harvest)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
One farm can produce food.

A group can share seed, tools, skills, and transport.

Separate growers become a stronger local food network, with each household contributing what it can.
```

#### What the Clip Must Depict
The clip must show an animated network map of rural homesteads with moving icons representing shared seeds, tools, skills, and transport connecting separate growers into a resilient local food network.

#### Grouping & Reuse Potential
DIRECT TWIN with seeds-sovereignty Slide 7 (Household Seed Network). Both feature animated homestead cluster maps with resource exchange arrows; can reuse the node-network graphic template from seeds-sovereignty.

---

### 10. Module: `plant-guilds` — Slide 5

- **Exact Heading (EN)**: `**Slide 5 — Watch: Roots That Feed the Soil**`
- **Exact Heading (ZU)**: `**Ikhasi 5 — Buka: Izimpande Ezondla Umhlabathi (Slide 5 — Watch: Roots That Feed the Soil)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Look at the roots below the soil. Small nodules show where rhizobia fix nitrogen, helping a living legume feed the soil around it.
```

#### What the Clip Must Depict
The clip must show an underground root cross-section zooming into legume root nodules where rhizobia fix nitrogen gas, showing nutrient movement feeding adjacent companion plant roots.

#### Grouping & Reuse Potential
DIRECT TWIN with soil-health Slide 5 (Look at the Soil). Both require underground soil cross-sections showing root systems, worm channels, and soil biota.

---

### 11. Module: `plant-guilds` — Slide 10

- **Exact Heading (EN)**: `**Slide 10 — Watch: Chop and Drop**`
- **Exact Heading (ZU)**: `**Ikhasi 10 — Buka: I-Chop and Drop (Slide 10 — Watch: Chop and Drop)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Watch the cut leaves lying around living plants. They protect the soil surface, hold moisture, and slowly become organic matter as soil life breaks them down.
```

#### What the Clip Must Depict
The clip must show green leaves pruned from a legume shrub dropped onto soil around crops, followed by an animation showing the mulch layer retaining soil moisture, suppressing weed growth, and breaking down into organic matter.

#### Grouping & Reuse Potential
DIRECT TWIN with soil-health Slide 14 (Bare Soil and Mulch). Both demonstrate mulch layers protecting soil surface, retaining moisture, and building organic matter.

---

### 12. Module: `plant-guilds` — Slide 15

- **Exact Heading (EN)**: `**Slide 15 — Watch: A Mango Guild**`
- **Exact Heading (ZU)**: `**Ikhasi 15 — Buka: I-Mango Guild (Slide 15 — Watch: A Mango Guild)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Look at the central mango and the plants around it. Notice how the guild works as one team, with each plant supporting the tree in a different way.
```

#### What the Clip Must Depict
The clip must show a central mango tree surrounded by multi-functional guild plants (nitrogen fixer, dynamic accumulator, pollinator attractor, pest repellent, ground cover), highlighting subterranean and surface interactions supporting the central tree.

#### Grouping & Reuse Potential
Shares multi-layer plant interaction visual model with food-forest Slide 5 (Seven Layers).

---

### 13. Module: `reading-landscape` — Slide 5

- **Exact Heading (EN)**: `**Slide 5 — Watch: Water Slows, Sinks, and Leaves**`
- **Exact Heading (ZU)**: `**Ikhasi 5 — Buka: Amanzi Ayancipha, Angene, Aphume (Slide 5 — Watch: Water Slows, Sinks, and Leaves)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
The picture shows rain moving downhill. Follow where it speeds up, spreads, sinks, gathers, and leaves the land.
```

#### What the Clip Must Depict
The clip must show rain falling on a sloped landscape, depicting runoff water accelerating down steep slopes, spreading across contours, sinking into soil, gathering in gullies, and leaving the land.

#### Grouping & Reuse Potential
FOUNDATIONAL PARENT CLIP for water-harvesting Slide 4 (Swale Sinks Water) and Slide 7 (Overflow Point). Shows unmanaged slope runoff before contour swales are installed.

---

### 14. Module: `reading-landscape` — Slide 9

- **Exact Heading (EN)**: `**Slide 9 — Watch: Follow the Sun Across the Site**`
- **Exact Heading (ZU)**: `**Ikhasi 9 — Buka: Landela Ilanga Endaweni (Slide 9 — Watch: Follow the Sun Across the Site)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Follow the sun, building, tree, and their shadows across the slope. Compare summer’s high sun with winter’s lower sun.
```

#### What the Clip Must Depict
The clip must show a time-lapse animation of the sun sweeping east-to-west over a homestead on a slope, comparing high summer sun path/short shadows with low winter sun path/long shadows.

#### Grouping & Reuse Potential
Part of 4-part site design mapping suite in reading-landscape. Shares landscape map base model with Slide 13 and Slide 17.

---

### 15. Module: `reading-landscape` — Slide 13

- **Exact Heading (EN)**: `**Slide 13 — Watch: See Wind and Cold Air on the Map**`
- **Exact Heading (ZU)**: `**Ikhasi 13 — Buka: Bona Umoya Nomoya Obandayo Kumephu (Slide 13 — Watch: See Wind and Cold Air on the Map)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Follow wind across the ridges and gaps. Trace cold air downhill into low ground, and notice where the land creates shelter or exposure.
```

#### What the Clip Must Depict
The clip must show a topographical site map with wind arrows flowing across ridges and gaps alongside cold air pooling in low valley frost pockets, highlighting sheltered versus exposed areas.

#### Grouping & Reuse Potential
DIRECT TWIN with intro-permaculture Slide 19 (A Windbreak Belongs On The Wind Side). Both illustrate wind flow across land topography and boundary structures.

---

### 16. Module: `reading-landscape` — Slide 17

- **Exact Heading (EN)**: `**Slide 17 — Watch: Draw the Land You Already Have**`
- **Exact Heading (ZU)**: `**Ikhasi 17 — Buka: Dweba Umhlaba Osuvele Unawo (Slide 17 — Watch: Draw the Land You Already Have)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Use the picture as a guide: boundary, buildings, roads, water, slopes, and direction arrows. Draw what already exists before planning changes.
```

#### What the Clip Must Depict
The clip must show an animated drafting sequence overlaying existing baseline site features onto a map: boundary lines, buildings, roads, water flow lines, slope directions, and orientation arrows.

#### Grouping & Reuse Potential
Synthesizes site analysis layers from reading-landscape Slides 5, 9, and 13 into a base map drawing sequence.

---

### 17. Module: `seeds-sovereignty` — Slide 5

- **Exact Heading (EN)**: `**Slide 5 — Watch: Open-Pollinated Seed and F1 Seed**`
- **Exact Heading (ZU)**: `**Ikhasi 5 — Buka: Imbewu Evulekele Impova Ne-F1 (Slide 5 — Watch: Open-Pollinated Seed and F1 Seed)**`
- **Status & Location**: Existing (public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_01.mp4, 10s, 420 KB)

#### Verbatim Narration Body (Specification)
```text
Watch both sides.

Both kinds of seed germinate.

Open-pollinated seed produces similar plants when the variety is stable and pollination is properly managed.

Seed saved from an F1 plant also germinates. But its next generation varies. Some plants may be tall. Others may be short. Their vigour and yield may differ.

[pause]

Ask yourself what this means when choosing seed to save.

If you understand the difference, you can explain it in one sentence: both germinate, but the next F1 generation is unpredictable.
```

#### What the Clip Must Depict
The clip depicts a side-by-side comparison of open-pollinated seeds producing uniform offspring versus F1 saved seeds producing variable, erratic offspring height, vigour, and yield.

#### Grouping & Reuse Potential
Already built and verified on disk. Matches narration accurately.

---

### 18. Module: `seeds-sovereignty` — Slide 7

- **Exact Heading (EN)**: `**Slide 7 — Watch: Household Seed Network**`
- **Exact Heading (ZU)**: `**Ikhasi 7 — Buka: Inethiwekhi Yembewu Yasemakhaya (Slide 7 — Watch: Household Seed Network)**`
- **Status & Location**: Existing (public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_02.mp4, 10s, 738 KB)

#### Verbatim Narration Body (Specification)
```text
Well-saved seed becomes more powerful when it is known and shared.

Watch one household begin by saving seed well from one crop. Dry seed goes into clean packets. Some packets move to neighbouring homes. The neighbours share different seed in return.

By the end, each household holds more varieties than it had before.

[pause]

Think about which seed you could share and which seed you might receive from a neighbour. Seed moves. Knowledge and trust must move with it.
```

#### What the Clip Must Depict
The clip depicts one household saving dry seeds into packets and exchanging packets across a network of neighbouring homes to accumulate diverse crop varieties.

#### Grouping & Reuse Potential
Already built and verified on disk. Shares visual node-network structure with market-community Slide 14.

---

### 19. Module: `seeds-sovereignty` — Slide 10

- **Exact Heading (EN)**: `**Slide 10 — Watch: Self-Pollination and Crossing**`
- **Exact Heading (ZU)**: `**Ikhasi 10 — Buka: Ukuzithuthela Impova Nokuxubana (Slide 10 — Watch: Self-Pollination and Crossing)**`
- **Status & Location**: Existing (public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_03.mp4, 10s, 399 KB)

#### Verbatim Narration Body (Specification)
```text
Follow the path of the pollen.

In self-pollination, pollen moves within one flower from the part that produces it to the part that receives it. This often helps the variety remain similar.

In a maize field, wind carries pollen from the tassels to the silks. If two varieties are close together and flower at the same time, they can cross.

[pause]

Think about how distance or different flowering times could prevent that on your own plot.
```

#### What the Clip Must Depict
The clip depicts pollen movement inside a self-pollinating flower alongside wind blowing maize pollen from tassels to silks between adjacent crop varieties.

#### Grouping & Reuse Potential
Already built and verified on disk. Matches narration accurately.

---

### 20. Module: `seeds-sovereignty` — Slide 13

- **Exact Heading (EN)**: `**Slide 13 — Watch: Dry Processing**`
- **Exact Heading (ZU)**: `**Ikhasi 13 — Buka: Indlela Eyomile (Slide 13 — Watch: Dry Processing)**`
- **Status & Location**: Existing (public/course-animations/seeds-sovereignty/seed-dry-processing.mp4, 5s, 311 KB)

#### Verbatim Narration Body (Specification)
```text
Allow the seed to mature on the plant before collecting it.

Watch how it is collected once mature. Chaff and debris are removed. Damaged seed is taken out.

The clean seed is then spread in a single layer in moving air and shade.

[pause]

Follow the steps in order: mature, collect, clean, dry.

Think about where you could carry out each part of this process.
```

#### What the Clip Must Depict
The clip depicts harvesting mature seed heads, winnowing/threshing to remove chaff and damaged seeds, and spreading clean seeds in a single layer on a mat in ventilated shade.

#### Grouping & Reuse Potential
Already built and verified on disk. Re-edited 5s clip removing wet-processing intro.

---

### 21. Module: `seeds-sovereignty` — Slide 15

- **Exact Heading (EN)**: `**Slide 15 — Watch: Wet Processing for Tomato Seed**`
- **Exact Heading (ZU)**: `**Ikhasi 15 — Buka: Indlela Emanzi Katamatisi (Slide 15 — Watch: Wet Processing for Tomato Seed)**`
- **Status & Location**: Existing (public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_05.mp4, 20s, 1.38 MB)

#### Verbatim Narration Body (Specification)
```text
Watch the whole process in order.

A ripe tomato is opened. The seed and gel are scooped into a clean jar. Only a little water is added.

The jar is left open or loosely covered for two to three days.

When a light film and sour smell appear, the contents are poured through a sieve. The seed is rinsed until it is clean.

Finally, the seed is spread in a single layer in the shade until completely dry.

[pause]

Repeat the steps to yourself: scoop, ferment briefly, rinse, dry completely.
```

#### What the Clip Must Depict
The clip depicts wet tomato seed extraction: scooping seed and gel into a jar with water, fermenting 2-3 days until mold film forms, rinsing through a sieve, and drying on cloth in shade.

#### Grouping & Reuse Potential
Already built and verified on disk. Matches narration accurately.

---

### 22. Module: `seeds-sovereignty` — Slide 21

- **Exact Heading (EN)**: `**Slide 21 — Watch: Ten-Seed Germination Test**`
- **Exact Heading (ZU)**: `**Ikhasi 21 — Buka: Ukuhlolwa Kwembewu Eyishumi (Slide 21 — Watch: Ten-Seed Germination Test)**`
- **Status & Location**: Existing (public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_06.mp4, 10s, 440 KB)

#### Verbatim Narration Body (Specification)
```text
Count exactly ten seeds.

Place them in two rows of five.

Keep them on moist paper or cloth. Do not submerge them in water.

After some time, count again.

Here, six have germinated. Four have not. The total is still ten.

The germination rate is therefore sixty percent.

[pause]

Check yourself. Did you count ten at the start, six germinated seeds and four ungerminated seeds at the end?
```

#### What the Clip Must Depict
The clip depicts ten seeds arranged in two rows of five on damp cloth; after time, 6 seeds sprout while 4 do not, calculating a 60% germination rate.

#### Grouping & Reuse Potential
Already built and verified on disk. Matches narration accurately.

---

### 23. Module: `small-livestock` — Slide 4

- **Exact Heading (EN)**: `**Slide 4 — Watch: A Chicken Tractor Moving Across a Bed**`
- **Exact Heading (ZU)**: `**Ikhasi 4 — Buka: I-Chicken Tractor Ihamba Embhedeni (Slide 4 — Watch: A Chicken Tractor Moving Across a Bed)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Watch the chicken tractor move across an empty bed.

Scratching clears old material and pests; manure stays behind as the pen prepares the soil for planting.
```

#### What the Clip Must Depict
The clip must show a movable chicken tractor coop positioned over an unplanted crop bed, showing chickens scratching weeds/pests and manuring soil before shifting to the adjacent bed.

#### Grouping & Reuse Potential
Unique chicken tractor mobile coop graphic. Shares soil preparation theme with soil-health.

---

### 24. Module: `small-livestock` — Slide 9

- **Exact Heading (EN)**: `**Slide 9 — Watch: Bees Moving Between Hive and Crops**`
- **Exact Heading (ZU)**: `**Ikhasi 9 — Buka: Izinyosi Zihamba Phakathi Kwe-Hive Nezitshalo (Slide 9 — Watch: Bees Moving Between Hive and Crops)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Watch the bees leave the hive and move among flowering crops.

Their movement carries pollen between flowers across the site.
```

#### What the Clip Must Depict
The clip must show honeybees flying from a beehive to flowering garden crops, moving between flowers to transfer pollen grains across the site.

#### Grouping & Reuse Potential
Shares pollination concepts with seeds-sovereignty Slide 10, but specific to honeybee activity in crops.

---

### 25. Module: `small-livestock` — Slide 14

- **Exact Heading (EN)**: `**Slide 14 — Watch: Nutrients Moving in a Closed Livestock Loop**`
- **Exact Heading (ZU)**: `**Ikhasi 14 — Buka: Izakhamzimba Zihamba Kumjikelezo Ovalekile Wemfuyo (Slide 14 — Watch: Nutrients Moving in a Closed Livestock Loop)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Watch nutrients move from plants to animals, then through manure and compost back to the growing bed.
```

#### What the Clip Must Depict
The clip must show a continuous closed-loop animation: plant forage fed to livestock -> manure collected into compost -> finished compost applied back to crop growing beds.

#### Grouping & Reuse Potential
DIRECT TWIN with market-community Slide 4 (Farm Record loop) and soil-health Slide 10 (Compost). Reuses compost and crop bed visual assets.

---

### 26. Module: `soil-health` — Slide 5

- **Exact Heading (EN)**: `**Slide 5 — Watch: Look at the Soil**`
- **Exact Heading (ZU)**: `**Ikhasi 5 — Buka: Bheka Umhlabathi (Slide 5 — Watch: Look at the Soil)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Compare the dark, living topsoil with the pale, compacted soil.

Look for worm channels, and notice how smell changes from rain or mushrooms to sour or nothing.
```

#### What the Clip Must Depict
The clip must show a split underground soil cross-section comparing dark, porous living topsoil with worm channels against pale, dense, hardpan compacted soil.

#### Grouping & Reuse Potential
DIRECT TWIN with plant-guilds Slide 5 (Roots That Feed the Soil). Both require underground soil profile cross-sections.

---

### 27. Module: `soil-health` — Slide 10

- **Exact Heading (EN)**: `**Slide 10 — Watch: Build the Compost Heap**`
- **Exact Heading (ZU)**: `**Ikhasi 10 — Buka: Yakha Inqwaba Ye-Compost (Slide 10 — Watch: Build the Compost Heap)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Build the heap with dry browns and fresh greens.

Keep the layers moist, not wet, so air and decomposers can work.
```

#### What the Clip Must Depict
The clip must show step-by-step building of a compost heap: alternating dry brown carbon layers with fresh green nitrogen layers, lightly moistening, showing air flow and decomposers.

#### Grouping & Reuse Potential
Core soil-building asset. Referenced by intro-permaculture Slide 13, food-forest Slide 15 (sheet mulch), and small-livestock Slide 14.

---

### 28. Module: `soil-health` — Slide 14

- **Exact Heading (EN)**: `**Slide 14 — Watch: Bare Soil and Mulch**`
- **Exact Heading (ZU)**: `**Ikhasi 14 — Buka: Umhlabathi Ongenalutho Ne-Mulch (Slide 14 — Watch: Bare Soil and Mulch)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Compare bare soil with mulched soil.

Watch how the mulch protects topsoil when a South African summer storm brings intense rain.
```

#### What the Clip Must Depict
The clip must show heavy rain from an intense storm striking two plots: bare soil washing away via splash erosion versus mulched soil absorbing rain impact and protecting topsoil.

#### Grouping & Reuse Potential
DIRECT TWIN with plant-guilds Slide 10 (Chop and Drop). Both demonstrate mulch layers protecting soil surface during intense rain.

---

### 29. Module: `water-harvesting` — Slide 4

- **Exact Heading (EN)**: `**Slide 4 — Watch: A Swale Sinks Water**`
- **Exact Heading (ZU)**: `**Ikhasi 4 — Buka: I-Swale Ishonisa Amanzi (Slide 4 — Watch: A Swale Sinks Water)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
A swale is a level trench on contour — it sinks water, it doesn't direct it.

[pause]

Water fills it evenly and soaks in rather than running off.
```

#### What the Clip Must Depict
The clip must show an isometric cross-section of a level contour swale trench and uncompacted mound, showing rainwater filling the trench evenly and soaking down into soil beneath the mound.

#### Grouping & Reuse Potential
BASE SWALE ANIMATION CLIP. Pairs directly with reading-landscape Slide 5 (runoff) and forms a 2-part swale series with water-harvesting Slide 7.

---

### 30. Module: `water-harvesting` — Slide 7

- **Exact Heading (EN)**: `**Slide 7 — Watch: The Overflow Point**`
- **Exact Heading (ZU)**: `**Ikhasi 7 — Buka: Indawo Yokuchichima (Slide 7 — Watch: The Overflow Point)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Include a safe overflow point so storms don't breach the berm.

[pause]

The overflow leads to the next swale or a dam.
```

#### What the Clip Must Depict
The clip must show a contour swale during a heavy storm filling to capacity, excess water reaching a level sill spillway at the berm end and safely flowing to a lower swale or dam without breaching the berm.

#### Grouping & Reuse Potential
DIRECT EXTENSION of water-harvesting Slide 4 (A Swale Sinks Water). A single swale 3D/2D scene model animates both normal infiltration (Slide 4) and storm overflow execution (Slide 7).

---

### 31. Module: `water-harvesting` — Slide 9

- **Exact Heading (EN)**: `**Slide 9 — Watch: Vetiver Takes Over**`
- **Exact Heading (ZU)**: `**Ikhasi 9 — Buka: I-Vetiver Iyangena Esikhundleni (Slide 9 — Watch: Vetiver Takes Over)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Above 15-20% slope, use vetiver grass lines or terraces instead.

[pause]

Swales work well on 1 to 15% slopes.
```

#### What the Clip Must Depict
The clip must show a slope profile comparison: excavated swales on mild 1–15% slopes contrasted with steep >15–20% slopes where deep-root vetiver grass hedgerows and terraces filter runoff and anchor soil.

#### Grouping & Reuse Potential
Shares slope terrain models with reading-landscape Slide 5 and water-harvesting Slide 4.

---

### 32. Module: `water-harvesting` — Slide 12

- **Exact Heading (EN)**: `**Slide 12 — Watch: Dam and Spillway**`
- **Exact Heading (ZU)**: `**Ikhasi 12 — Buka: Idamu Ne-Spillway (Slide 12 — Watch: Dam and Spillway)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Design the spillway before the wall — an overtopped wall can breach catastrophically.

[pause]

Size the dam to the catchment area draining toward it.
```

#### What the Clip Must Depict
The clip must show a farm earth dam receiving runoff from its catchment area, showing rising floodwaters exiting safely through a side spillway to prevent dam wall overtopping and breach.

#### Grouping & Reuse Potential
Shares spillway overflow design concepts with water-harvesting Slide 7.

---

### 33. Module: `water-harvesting` — Slide 16

- **Exact Heading (EN)**: `**Slide 16 — Watch: First Flush to Tank**`
- **Exact Heading (ZU)**: `**Ikhasi 16 — Buka: Amanzi Okuqala Aya Ethangini (Slide 16 — Watch: First Flush to Tank)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
A first-flush diverter removes the dirty first flush from every rain event.

[pause]

The first 20 to 30 litres should be diverted before clean water reaches the tank.
```

#### What the Clip Must Depict
The clip must show roof rainwater flowing into a vertical pipe first-flush diverter: dirty initial runoff filling the diverter pipe (first 20-30L) and floating a seal ball, directing clean rainwater into the storage tank.

#### Grouping & Reuse Potential
Distinct roof-water harvesting system animation asset.

---

### 34. Module: `water-harvesting` — Slide 21

- **Exact Heading (EN)**: `**Slide 21 — Watch: Greywater Under Mulch**`
- **Exact Heading (ZU)**: `**Ikhasi 21 — Buka: I-Greywater Ngaphansi Kwe-Mulch (Slide 21 — Watch: Greywater Under Mulch)**`
- **Status & Location**: Missing (No clip in public/course-animations/)

#### Verbatim Narration Body (Specification)
```text
Direct greywater into a mulch-filled basin around fruit trees rather than onto bare ground.

[pause]

It filters through organic matter before reaching roots.
```

#### What the Clip Must Depict
The clip must show household greywater draining into a mulch-filled basin around a fruit tree, depicting greywater filtering down through organic matter before reaching plant roots.

#### Grouping & Reuse Potential
Combines mulch filtration graphics (soil-health Slide 14, plant-guilds Slide 10) with fruit tree root irrigation.

---

## 3. Audit of Existing Animations (`seeds-sovereignty`)

All 6 `Watch:` slides in `seeds-sovereignty` have verified MP4 animation files present in `public/course-animations/seeds-sovereignty/` and registered in `lib/course-deck.ts` (`SEEDS_ANIMATIONS`):

1. **Slide 5 (`Watch: Open-Pollinated Seed and F1 Seed`)**:  
   - Clip: `public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_01.mp4` (10s, 420 KB)  
   - **Verification**: Corresponds accurately to narration (split screen uniform OP seedlings vs erratic F1 saved seed offspring).
2. **Slide 7 (`Watch: Household Seed Network`)**:  
   - Clip: `public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_02.mp4` (10s, 738 KB)  
   - **Verification**: Corresponds accurately to narration (household packaging seed into clean packets and exchanging across neighbourhood nodes).
3. **Slide 10 (`Watch: Self-Pollination and Crossing`)**:  
   - Clip: `public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_03.mp4` (10s, 399 KB)  
   - **Verification**: Corresponds accurately to narration (pollen path inside selfing flower alongside wind blowing maize pollen from tassels to silks).
4. **Slide 13 (`Watch: Dry Processing`)**:  
   - Clip: `public/course-animations/seeds-sovereignty/seed-dry-processing.mp4` (5s, 311 KB)  
   - **Verification**: Corresponds accurately to narration (5s trimmed clip showing threshing, winnowing, and single-layer drying on shade mat; fixed previous flaw where wet processing was shown in first half).
5. **Slide 15 (`Watch: Wet Processing for Tomato Seed`)**:  
   - Clip: `public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_05.mp4` (20s, 1.38 MB)  
   - **Verification**: Corresponds accurately to narration (slicing tomato, scooping seed gel into jar, 2-3 day fermentation, sifting/rinsing, shade drying).
6. **Slide 21 (`Watch: Ten-Seed Germination Test`)**:  
   - Clip: `public/course-animations/seeds-sovereignty/imbewu_isiZulu_video_06.mp4` (10s, 440 KB)  
   - **Verification**: Corresponds accurately to narration (10 seeds in 2 rows of 5 on damp cloth; 6 germinating, 4 ungerminated = 60%).

*Note: `seeds-sovereignty` also has clips for Slide 8 (`seed-selecting-parents.mp4`, 5s) and Slide 18 (`new_seed-storage-jar-vs-bag.mp4`, 10s), but their slide headers do not begin with `Watch:`.*

---

## 4. Grouping & Production Optimization (Shared Clip Clusters)

> **CORRECTED BY CLAUDE BEFORE MERGE — the clip count is 28, not 18.**
>
> The clusters below are real and useful, but they identify shared **production assets** (a soil
> cutaway, a terrain model, a node-network template), not shared **clips**. Those are not the same
> thing here, for a structural reason: every `Watch:` slide is its own narration block with its own
> recorded audio, and `build-lesson-video.mjs` pairs each block with exactly one slide asset. Two
> slides play at different moments under different narration, so neither can be served by one clip.
>
> Checked against the narration: `intro-permaculture` 19 places a windbreak on a north-west farm
> boundary; `reading-landscape` 13 traces wind over ridges and cold air draining into low ground.
> Same arrows, different lesson. `soil-health` 10 builds a compost heap; `small-livestock` 14 moves
> nutrients from plants through animals back to a bed. Different clips.
>
> **So: 28 clips to commission, of which roughly 14 can be built from about 8 shared scene models.**
> That is a real saving in production effort and none at all in deliverable count — and those are
> very different things to take to a budget.

The 28 missing clips cluster into shared production assets as follows. Read each "1 shared clip
 asset" below as "1 shared model, still 2 clips":

### Cluster 1: Wind & Boundary Protection (2 slides -> 1 shared clip asset)
- `intro-permaculture` Slide 19: "A Windbreak Belongs On The Wind Side"
- `reading-landscape` Slide 13: "See Wind and Cold Air on the Map"
- **Shared Concept**: Wind vectors flowing across homestead boundaries, deflected by tree shelter belts. 1 base animation asset can serve both.

### Cluster 2: Community Network & Resource Flow (2 slides -> 1 shared graphic template)
- `market-community` Slide 14: "How Neighbours Strengthen a Harvest"
- `seeds-sovereignty` Slide 7: "Household Seed Network" (Existing clip)
- **Shared Concept**: Rural homestead node network exchanging resources (seed packets vs tools/skills/transport). The node network template from `seeds-sovereignty` Slide 7 can be repurposed for `market-community` Slide 14.

### Cluster 3: Mulch & Surface Protection (2 slides -> 1 shared clip asset)
- `plant-guilds` Slide 10: "Chop and Drop"
- `soil-health` Slide 14: "Bare Soil and Mulch"
- **Shared Concept**: Organic mulch layer covering soil to absorb intense rain impact, retain moisture, and break down into organic matter. 1 shared animation asset can serve both.

### Cluster 4: Underground Soil Profile & Biota (2 slides -> 1 shared underground asset)
- `plant-guilds` Slide 5: "Roots That Feed the Soil"
- `soil-health` Slide 5: "Look at the Soil"
- **Shared Concept**: Subterranean soil cross-section showing root systems, worm channels, and soil biota/nodules.

### Cluster 5: Contour Swale Water Harvesting (2 slides -> 1 continuous scene asset)
- `water-harvesting` Slide 4: "A Swale Sinks Water"
- `water-harvesting` Slide 7: "The Overflow Point"
- **Shared Concept**: Level contour swale trench. Slide 4 shows normal infiltration; Slide 7 extends the exact same scene model to show storm overflow sill execution.

### Cluster 6: Macro Slope Runoff (1 parent asset)
- `reading-landscape` Slide 5: "Water Slows, Sinks, and Leaves"
- **Shared Concept**: Unmanaged rainwater runoff accelerating down steep slopes and gathering in low points. Serves as the macro landscape parent to contour swale design.

### Cluster 7: Multi-Layer Agroforestry & Plant Guilds (3 slides -> 2 clip assets)
- `food-forest` Slide 5: "The Seven Layers Working Together"
- `food-forest` Slide 15: "From Bare Ground to Food Forest"
- `plant-guilds` Slide 15: "A Mango Guild"
- **Shared Concept**: Vertical plant layer architecture. `food-forest` Slide 5 and `plant-guilds` Slide 15 share 2D vertical plant models; `food-forest` Slide 15 adds multi-year time-lapse succession.

### Cluster 8: Soil Building & Compost Loop (2 slides -> 1 shared clip asset)
- `soil-health` Slide 10: "Build the Compost Heap"
- `small-livestock` Slide 14: "Nutrients Moving in a Closed Livestock Loop"
- **Shared Concept**: Physical compost heap layering (greens + browns) and nutrient cycle (crops -> animals -> manure -> compost -> crops).

### Cluster 9: Standalone Single-Topic Animations (10 slides -> 10 distinct clips)
1. `food-forest` Slide 10: "Match the Species to the Climate" (Highveld vs Coastal climate zones map)
2. `intro-permaculture` Slide 7: "One Decision, Three Ethics" (Borehole tap sharing & water table monitor)
3. `intro-permaculture` Slide 13: "Diversity Against One Bad Day" (Hailstorm striking monoculture vs polyculture)
4. `market-community` Slide 4: "What the Farm Record Shows" (Ledger tracking home food, sales, gifts, compost)
5. `market-community` Slide 9: "Where Surplus Can Go" (Roadside stall, shop vehicle transport, household box routes)
6. `reading-landscape` Slide 9: "Follow the Sun Across the Site" (Sun path arc and shadows across seasons)
7. `reading-landscape` Slide 17: "Draw the Land You Already Have" (Site drafting overlay sequence)
8. `small-livestock` Slide 4: "A Chicken Tractor Moving Across a Bed" (Movable chicken coop on crop bed)
9. `small-livestock` Slide 9: "Bees Moving Between Hive and Crops" (Honeybees flying and transferring pollen)
10. `water-harvesting` Slide 9: "Vetiver Takes Over" (Slope angle comparison: swales vs vetiver grass terraces)
11. `water-harvesting` Slide 12: "Dam and Spillway" (Earth dam flood spillway protection)
12. `water-harvesting` Slide 16: "First Flush to Tank" (Roof rainwater diverter mechanism)
13. `water-harvesting` Slide 21: "Greywater Under Mulch" (Greywater basin around fruit tree)

---

## 5. Summary of Deliverables & Costing Baseline

- **Raw `Watch:` Slide Count**: **34 slides**
- **Existing Working Clips**: **6 clips** (`seeds-sovereignty`)
- **Missing Clips Needed**: **28 slides**
- **Clips to commission**: **28** — one per Watch slide, because each has its own narration block and its own audio.
- **Shared scene models available**: about **8**, covering roughly 14 of those clips. A saving in production effort, not in clip count.

This inventory establishes the specification for each missing slide. Fulfilling all 28 missing `Watch:` slides requires **28 clips**; about 8 shared scene models cut the work of building them, but not their number.
