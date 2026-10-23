# Fact-check log: 02-planning-your-farm

Source: `research/manual/rvcc-handbook-source.txt`, lines 885–1147 (printed pages 13–16).
Output: `public/manual/en/02-planning-your-farm.md`.

Note on method: web search was used for the key legal and technical claims. Page fetches were blocked by the network proxy in this session, so claims are backed by search-result summaries of the pages listed, by repo research that parsed the NEMBA gazette (`research/sa-species-research-2026-07-31.json`), or by simple arithmetic (shown). Items marked "not re-verified online" rest on standard references and should be spot-checked by a reviewer.

## Substantive changes

| # | Original claim (short quote) | What changed | Why | Source |
|---|---|---|---|---|
| 1 | "Everything over an 18% slope is not considered ideal for agriculture; the exception is forestry" | Replaced with Mollison's guideline of about **18 degrees** (about 32%) for permanent tree cover, and added South African legal thresholds | "18%" appears to be a mix-up of Mollison's "18 degrees"; 18% is only about 10°. SA law (CARA) is the binding local reference | https://small-farm-permaculture-and-sustainable-living.com/permaculture_slope_and_aspect/ ; https://library.uniteddiversity.coop/Permaculture/Bill_Mollison-Permaculture_Design_Course%20.pdf |
| 2 | "The ideal slope for vegetable gardening is 15% or less" | Replaced with a slope table: 12% = point to protect soil with contour beds/terraces; 20% = legal permission needed | 15% figure could not be traced to a source. CARA regulations prohibit cultivating land steeper than 20% (or 12% in listed areas) without written permission from the executive officer | https://laws.ewt.org/legislation/land-legislation/cara/ ; https://cer.org.za/wp-content/uploads/2014/02/CARA-Regs.pdf |
| 3 | (none) | Added slope table converting % to "1 m in X m" and degrees | Readers confuse % and degrees; conversions computed: atan(0.05)=2.9°, atan(0.12)=6.8°, atan(0.20)=11.3°, tan(18°)=0.32 | Arithmetic |
| 4 | Zone list started at "ZONE 1 Home, intensive vegetable/kitched garden" | Added **Zone 0** (the house) as in standard permaculture; Zone 1 now starts next to the house | Mollison's zone system numbers the house as Zone 0; the source merged house and Zone 1 | Mollison, *Permaculture: A Designers' Manual* (1988) — not re-verified online |
| 5 | Zone 2: "We would typically visit this zone two or three times a day" | Changed to "most days" | Inconsistent with Zone 1 being the most-visited zone; standard zone descriptions give Zone 2 as visited daily or every few days | Mollison (1988) — not re-verified online |
| 6 | Zone 5: "occasional foraging or hunting" | Dropped "hunting"; kept careful gathering of wild foods | Hunting in SA needs provincial permits and is outside this manual's scope | Editorial |
| 7 | Zone 2: "coppiced trees for firewood" (no species given) | Added a NEMBA warning: do not plant black wattle, Port Jackson, leucaena or many *Eucalyptus* for firewood; suggested *Vachellia karroo*, *Searsia lancea*, *Olea europaea* subsp. *africana* | Classic firewood/coppice trees are listed invaders in SA (STYLE.md rule 3) | https://www.dffe.gov.za/sites/default/files/legislations/nemba_invasivespecieslist_g43726gon1003.pdf ; repo `research/sa-species-research-2026-07-31.json` |
| 8 | "small city plots of a quarter acre" | Changed to "about 1,000 square metres (a quarter of an acre)" | SA uses metric; 0.25 acre = 1,012 m² | Arithmetic |
| 9 | (none) | Added "On communal land, Zones 4 and 5 may be shared grazing land or veld" | SA context: many smallholders farm on communal land | Editorial |
| 10 | "You can get a map from your local municipality, print a Google map image" | Kept, and added government 1:50 000 topographic maps as a source of contours | SA national topographic series covers the whole country at 1:50 000 (National Geo-spatial Information) | Not re-verified online |
| 11 | "a northern or eastern aspect is better... Western aspects receive harsher sun... southerly aspects... long winter shadows" | Kept (correct for the Southern Hemisphere); added that south slopes stay moist longer in dry areas; linked to sun-angle table in chapter 3 | Correct Southern-Hemisphere framing, per STYLE.md | Editorial |
| 12 | Access: "place them on contours... paths or roads can be berms for swales" | Kept; added "give each path a very gentle fall so rain drains off into a swale" | A road exactly on contour ponds water; standard keyline practice | Editorial |
| 13 | "use gravity, and not electricity, to pump your water" | Reworded (gravity moves water, no pump); added "every 10 m of height gives about 1 bar" | Physics: 10 m water head = 98 kPa ≈ 1 bar | Arithmetic |
| 14 | (none) | Added: keep manure, compost and animal pens away from and downhill of boreholes, wells and springs | Manure pathogen safety (STYLE.md rule 4) | Editorial |
| 15 | "Use gravity feed to channel grey water... into swales or tree basins" | Kept; added Safety callout on greywater (no kitchen/nappy water on raw-eaten leafy greens) | STYLE.md rule 4 | STYLE.md |
| 16 | Zone 1: "tanks for the house and small ponds in the garden" | Added Safety callout: cover tanks and wells, fence or cover ponds | Child drowning risk (STYLE.md rule 4) | STYLE.md |
| 17 | "Figure 4 shows an adaption of Bill Mollison's example of slope planning for temperate climates" | Figure reference removed; kept attribution "follows Bill Mollison's slope-planning model" | No images in reader | STYLE.md rule 5 |
| 18 | "your intuition and feelings that arise from the place" | Rephrased as noticing which places feel warm, cold, wet or dry | Plainer, observable wording for second-language readers | Editorial |

## Figures removed

| Caption | Printed page |
|---|---|
| Fig 2: Sample of a Base map | 13 |
| Fig 2: Start with planning (second caption with the same number) | 13 |
| Unnumbered zone diagram with labels "ZONE 1" to "ZONE 5" (content kept as the zone table) | 14 |
| Fig 3: Sample of a compass (relates to chapter 3, "Finding north") | 14 |
| Fig 3: Sample of a Zone map (duplicate figure number in source) | 15 |
| Fig 4: Sample of a slope analysis (adapted from Bill Mollison, temperate climates) | 16 |

## Not verified, left out or softened

- "The ideal slope for vegetable gardening is 15% or less" — no source found; replaced by the CARA-based 12% / 20% thresholds.
- Exact CARA regulation number and the list of "Table 1" areas where the 12% limit applies were not confirmed (page fetch blocked); the text tells readers to ask their extension officer.
- Zone 0 and visiting frequencies rely on Mollison (1988), not re-verified online this session.
- Contour interval of the 1:50 000 topographic maps was not stated because it was not verified.
- Firewood tree suggestions (*Vachellia karroo*, *Searsia lancea*, *Olea europaea* subsp. *africana*) are indigenous and not NEMBA-listed per the repo's gazette parse (Searsia and Vachellia absent from the list); their firewood/coppice performance was not separately verified.

## Second pass (27 Sep 2026)

Rewrite to REWRITE.md (2,196 → 1,692 words). Sections kept: Step 1: Site assessment, What to look at on your site, Step 2: Zone planning, Step 3: Slope planning, Key points; added Try it. Zone 1–5 sub-headings merged into paragraphs under Step 2; "Zones on real land" merged into one paragraph. WebFetch blocked; checks rest on WebSearch result summaries.

### "Not verified" items

| Item | Result | Source |
|---|---|---|
| "Ideal slope 15% or less" | Already removed in the first pass; nothing to do. | — |
| CARA regulation number and the "Table 1" 12% areas | **Cut** from the chapter with all legal wording (slope row "20% needs written permission", the CARA Note, the Key point). Moved to `research/manual/rewrite/02-planning-your-farm-endnote.md`. The 12% row now only says to protect the soil with contour beds, grass strips or terraces. | — |
| Zone 0 and visiting frequencies (Mollison 1988) | **Verified.** Zone 0 (the house) was added to the zone system in Mollison's *Permaculture: A Designers' Manual*; Zone 1 is for elements visited often/daily, Zone 5 is unmanaged wild land visited to learn. | https://www.appropedia.org/Zones ; https://www.underthechokotree.com/permaculture-stuff/343-farming-zone-zero/913-growing-food-in-zone-zero-an-introduction |
| 1:50 000 topographic maps; contour interval | **Verified and added.** NGI: the 1:50 000 series (1 913 sheets) is the largest scale giving full coverage of South Africa, with 20 m contours. The chapter now says the contours are 20 m apart and show only the big shape of the land. | https://ngi.dalrrd.gov.za/index.php/what-we-do/maps-and-geospatial-information/35-map-products/51-1-50-000-topographical-maps |
| Firewood trees (*Vachellia karroo*, *Searsia lancea*, *Olea europaea* subsp. *africana*) | **Sweet thorn verified** (SANBI PlantZAfrica: excellent firewood and charcoal, wood used for fence posts; indigenous from the Western Cape northwards). **Karee and wild olive cut**: their firewood/pole use was not checked. | https://pza.sanbi.org/vachellia-karroo |

Totals: verified 3, cut 2, generalised 0.

### Other changes in this pass

- Safety boxes removed. Kept as plain lines: "Cover every tank and well, and fence or cover ponds, so that no child can fall in"; keep manure, compost and animal pens downhill of and well away from boreholes, wells and springs; greywater to mulched tree basins or swales, never onto morogo or other vegetables eaten raw.
- The NEMBA note on wattle, Port Jackson, leucaena and gum became one line recommending sweet thorn "rather than wattle or gum, which spread into veld and streams"; the legal status is in the endnote.
- "Your local municipality may have a map" removed (endnote).
- "Leafy greens" → morogo. Rory's line "The richest smallholders are rarely those with the most land" used in the opening.
- Physics check kept: 10 m of head ≈ 98 kPa ≈ 1 bar.
