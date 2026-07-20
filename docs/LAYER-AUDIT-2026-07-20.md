# Plan-sheet layer audit — 2026-07-20

62-agent audit of all five glossy layers; every finding adversarially verified by an independent
agent instructed to refute it. 52 confirmed, 4 refuted. Fixed in 2ea84ec: the zones vocabulary +
element list, the empty-brief refusal, per-element sheet membership, and the sheet-number table.
Everything below that is not marked DONE is still open.

## zones — 9 confirmed

### [broken] (B-ai) The overlay prompt has no concept of a zone band — even a perfect element list cannot produce zones
`lib/producer-prompt.ts:508`

**Farmer sees:** The farmer opens "02 — ZONES PLAN" and there are no zones on it. The land inside the boundary has been repainted clean and the zone washes and number badges are gone. This is the reported bug, and it survives any fix to the element list on its own.

**Fix:** Give buildSatelliteOverlayPrompt a zones clause, gated on sheetKind === 'zones' (mirror the existing waterSystems block at line 460): (a) add "the permaculture zone bands" as item (8) in §2's whitelist; (b) add a sentence stating that the large translucent coloured areas already on the photograph are the zone bands, that each must be redrawn as a soft translucent tint over the clean-redrawn land keeping its exact edge, and that it is NOT a placement marker for an icon; (c) exempt zone-band interiors from §5's "ground with no marker gets nothing"; (d) allow the zone number badge as lettering in §14, or state that the model re-letters "ZONE n" inside each band. Add a zones entry to OVERLAY_ICONS + ICON_MATCH (or bypass the icon machinery for band rows) and replace the dead ICON_KEYS_BY_SHEET.zones list.

### [broken] (B-ai) §5 actively converts each zone wash into an invented pictorial icon
`lib/producer-prompt.ts:514`

**Farmer sees:** The zones sheet doesn't merely lose its zones; it fabricates plausible-looking infrastructure standing exactly where each zone band was, and letters a confident legend for it. A farmer building from that sheet digs a swale where his Zone 3 label was.

**Fix:** Scope §5's marker→icon rule to item and line markers explicitly, and state on the zones sheet that the large translucent bands are areas, not markers, and get no icon. Best done together with the zones clause above so §5 and the new clause cannot contradict each other.

### [broken] (B-ai) overlayElementsText returns the empty string for 'zones' — the sheet's only source of truth is blank
`components/design/DesignGlossy.tsx:1281`

**Farmer sees:** Nothing in the entire text payload tells the model that this sheet is about zones, or that any zone exists. The title says ZONES and the content list says nothing, so the model authors both map and legend from imagination.

**Fix:** In overlayElementsText, when `zonesInFilter(filter)`, emit one row per distinct zone number under a 'ZONES' section heading — e.g. `ZONES » Zone 0 — House, Zone 1 — Daily use, Zone 3 — Orchard / food forest` — deduped by number (sheetLegendRows at line 3820 already does this dedup correctly; copy it). Keep the existing suppression for non-zones sheets so the Rory 'no zones in the legend' rule still holds. Beware ICON_MATCH.tree (/tree|orchard|fruit/i, lib/producer-prompt.ts:411) firing on "Zone 3 — Orchard / food forest" — the match text needs to exclude zone rows, or zone rows need to bypass the icon matcher.

### [broken] (A-deterministic) A farmer-drawn Zone 0 polygon is counted as content but never drawn or legended
`components/design/DesignGlossy.tsx:2540`

**Farmer sees:** A farmer whose only zone ring is a Zone 0 yard gets a sheet that passes the not-empty check and renders a satellite photo with a legend, a title and zero zones — and the same page lands in the exported plan set. If he also drew Zones 1-3, his Zone 0 ring vanishes from the Blueprint but appears on the AI-Style version of the same layer.

**Fix:** Drop `&& z.zone !== 0` and let zoneFillPolys' existing nesting handle it (it already treats lower zones as cutters, and its `z.zone !== 0` house-cutter guard already exempts zone 0). Draw the house-derived Zone 0 and any drawn zone-0 ring as one merged Zone 0, deduped in `zoneNums`. Alternatively, if zone-0 rings are intentionally not drawable, exclude them from layerContentCount too so the sheet refuses instead of rendering empty.

### [broken] (A-deterministic) Zone 0 is read only from the traced roof, so a Studio-drawn house gives no Zone 0 and lets Zone 1 paint over the roof
`components/design/DesignGlossy.tsx:2580`

**Farmer sees:** On the common case the Zones sheet has no Zone 0 at all — no house fill, no 0 badge, no ZONE 0 row — on a sheet whose entire logic is distance from the house. Worse, zoneFillPolys' donut cut silently fails, so the Zone 1 wash and its hatch are painted straight over the roof, which is the exact bug that function's docblock (lines 269-275) claims to have fixed.

**Fix:** Derive an effective house ring once — `refLayers.house.length >= 3 ? refLayers.house : (largest state.zones ring with feature === 'house')` — and use it for the Zone 0 fill, the 0 badge, the legend row and the zoneFillPolys cutter. Best as a shared helper since buildZoneOverlay, buildProtectMask and the other Blueprints have the same blind spot.

### [wrong] (A-deterministic) Zones legend prints Fence and Driveway rows that may have nothing on the map
`components/design/DesignGlossy.tsx:2645`

**Farmer sees:** The farmer reads a legend key for a fence and a driveway that are not on the page, and hunts for a violet fence line that this sheet never draws. On the deterministic sheet — the one sold as 'accurate by construction' — a legend row that promises an absent mark is the worst possible defect.

**Fix:** Emit the boundary row only when `refLayers.boundary.length >= 3` and the driveway row only when `refLayers.driveway.length >= 2`, and size lgH (line 2619) from the actual row count rather than the hard-coded `+3`. Rename the boundary row to 'Property boundary' to stop it reading as the fence tool.

### [wrong] (B-ai) The AI zones sheet letters itself "02", which is the Sector sheet's number in the canonical plan set
`lib/producer-prompt.ts:365`

**Farmer sees:** A farmer who prints the set and also renders the AI version ends up with two different sheets both claiming to be number 02 — one Sector Analysis, one Zones — and a Zones sheet numbered 02 in one place and 03 in another. On a document a farmer hands to a funder, that reads as a mis-collated plan set.

**Fix:** Rebuild SHEET_NO from the canonical table (all:'07', zones:'03', water:'04', planting:'05', structures:'06'), or better, pass the sheet number in from the single PRINT_LAYERS/DESIGN_SHEETS source so it can't drift again. Add the number to the Blueprint title at DesignGlossy.tsx:2612 so both paths agree.

### [wrong] (B-ai) The empty-layer gate counts zones but the payload handed to the model contains none, so the guarantee is fake on path B
`components/design/DesignGlossy.tsx:4950`

**Farmer sees:** The app promises never to guess a zones map, then hands the model a blank content list on exactly the designs that pass the never-guess check — which is how an invented sheet reached a farmer while every guard reported green.

**Fix:** Assert the payload, not the state: after building elementsText for a model sheet, refuse (or fall back to buildBlueprintZoneMap) when the string is empty. A one-line invariant — `if (!elementsText.trim()) throw/skip` — would have caught this class of bug on every layer, not just zones.

### [polish] (A-deterministic) The Zones sheet shows no elements and no traced ground, so a farmer cannot check the one thing a zone map is for
`components/design/DesignGlossy.tsx:2536`

**Farmer sees:** A zone map's job is to let a farmer see that his kitchen garden sits in Zone 1 and his woodlot in Zone 4. Today he sees coloured bands over bare satellite with nothing inside them, so the sheet is unfalsifiable — he cannot spot a chicken run stranded in Zone 4 until he walks it.

**Fix:** Draw this layer's context as quiet ghosts under the zone washes: drawBlueprintGround for the traced rings, plus small neutral (single-colour, unlabelled) footprints for all placed items so their position reads without competing with the bands. Keep them out of the legend so the sheet still promises only zones — or add one 'Design elements (see sheets 04-06)' row.

<details><summary>Refuted (do not re-chase)</summary>

- **The showcase (painted-style) zones prompt also gets an empty element list, and the unit test hides it** — The central assertion is false and the claim contradicts itself. buildShowcasePrompt is only reachable when isModelChromeStyle(styleKey) is false (lib/producer-prompt.ts:22-24 returns true only for satellite_overlay; DesignGlossy.tsx:4973-4980 and 5063-5070 route satellite_overlay to buildSatelliteOverlayPrompt instead), so the showcase path at DesignGlossy.tsx:4959-4961/5045-5047 always receives 

</details>

## water — 14 confirmed

### [wrong] (both) Raised Bed, Keyhole Bed and Herb Spiral are tagged 'earthworks', so they appear on the WATER sheet and are missing from the PLANTING sheet
`lib/glossy-filters.ts:25`

**Farmer sees:** A farmer who placed three raised beds and a herb spiral sees them on the Water Plan (drawn as brown earth basins) and does NOT see them on the Planting Plan. The Planting sheet under-reports the design; the Water sheet claims vegetable beds are water infrastructure.

**Fix:** Split the category: keep basins/berms/terraces/half-moons/banana circles/tree basins in 'earthworks' (genuinely water land-shaping) and move raised_bed, keyhole_bed, herb_spiral to 'growing'. The palette can keep them on the Water step via alsoSteps (already supported — see banana_circle's alsoSteps at design-elements.ts:297) without changing sheet membership. If category order in the palette matters, fix the palette ordering, not the taxonomy.

### [broken] (B-ai) Path B water prompt orders the model to invent an entire plumbing schematic that is not in the design
`lib/producer-prompt.ts:460`

**Farmer sees:** The farmer placed two JoJo tanks and one banana circle. The rendered '03 — WATER PLAN' comes back with gutters, a pressure regulator, isolation valves, a pump house and a violet greywater main snaking from the house across the plot — none of it designed, all of it drawn with the same authority as the real tanks. This is the Zones failure inverted: not a missing element list, but a licence to invent one.

**Fix:** Delete the enumerations from the waterSystems block. Keep at most the grouping instruction, and make every noun conditional on the element list: e.g. only mention FILTERED GREYWATER when elementsText contains a greywater outlet/diverter/basin, and never instruct a line to be drawn that has no traced geometry. If greywater runs are a real product requirement, add a 'greywater' DesignLine kind and let the farmer draw it.

### [wrong] (B-ai) Path B water sheet is given two mutually exclusive legend structures
`lib/producer-prompt.ts:526`

**Farmer sees:** The legend on the Water Plan is unpredictable: sometimes WATER/PLANTING, sometimes RAINWATER/IRRIGATION/FILTERED GREYWATER, sometimes a hybrid with rows the element list never supplied. The one guarantee rule 11 exists to give — 'if it is in this list, it is on the sheet' — is voided.

**Fix:** Pick one. Either compute the RAINWATER/IRRIGATION/FILTERED GREYWATER sections deterministically in overlayElementsText for filter==='water' (the deterministic sheet already does exactly this split — see buildBlueprintWaterMapLegacy DesignGlossy.tsx:2799-2841) and feed them through legendRows, or drop the three-heading instruction from the prompt.

### [confusing] (B-ai) A sheet titled WATER PLAN gets a legend section headed PLANTING
`components/design/DesignGlossy.tsx:1252`

**Farmer sees:** The Water Plan's legend has a PLANTING block listing banana circles, tree basins and raised beds — items the actual Planting Plan does not show. Two sheets in the same plan set disagree about which layer those elements belong to.

**Fix:** Make the section map agree with the filter. On the water sheet, banana circles / tree basins / basins are water land-shaping and belong under WATER (or a HARVESTING/EARTHWORKS heading); the growing beds should not be on this sheet at all once finding 1 is fixed.

### [wrong] (B-ai) Greywater Outlet and Greywater Diverter are described to the model as gravel sumps
`lib/producer-prompt.ts:410`

**Farmer sees:** The bath/laundry drain the farmer marked on the house wall is drawn as a reed-fringed gravel sump in the ground next to the house — a different piece of infrastructure in a different place.

**Fix:** Add dedicated icon entries and matchers for greywater_outlet and greywater_diverter, and tighten ICON_MATCH.basin to /greywater basin|infiltration basin/i so it only fires on the two basin elements.

### [wrong] (B-ai) Eleven water-layer element types have no icon description on the satellite path
`lib/producer-prompt.ts:401`

**Farmer sees:** A First-Flush Filter, a Pump & Filter or a Contour Berm gets a legend row and a leader label on the sheet with a model-invented picture at the other end of the leader — frequently a second tank, a shed, or a mound in the wrong shape.

**Fix:** Add OVERLAY_ICONS + ICON_MATCH entries for trough, first_flush, pump_filter, half_moon, berm, terrace, and assert in a unit test that every element admitted by itemInFilter(cat,'water') resolves to exactly one icon key.

### [wrong] (B-ai) The showcase (non-satellite) water prompt describes only 5 of the layer's marker types
`lib/producer-prompt.ts:322`

**Farmer sees:** On Precision Atlas / Field Ledger / etc., every water element that is not a tank, pond, swale, pipe or drip is a green blob with an emoji that the model must guess at. Taps and basins routinely come back as extra tanks or ponds.

**Fix:** Generate LEGEND_BY_SHEET from the same catalog-driven map as the icon keys so the two can never drift, and add the missing M.* entries.

### [confusing] (B-ai) Prompts tell the model to look for a 'blue area marker' for ponds and dams; every water marker in the composite is green
`lib/producer-prompt.ts:374`

**Farmer sees:** The model hunts for a blue area, finds none, and either omits the pond or paints an unrelated green patch blue. The one colour cue in the icon vocabulary points at nothing.

**Fix:** Describe markers by their glyph, not by a colour that does not exist ('a marker carrying the frog/wave glyph'), or give open-water elements a genuinely blue def.color so the text and the image agree.

### [wrong] (both) Layer-empty guard passes on earthworks alone, so a farm with no water infrastructure still renders a Water Plan
`components/design/DesignGlossy.tsx:252`

**Farmer sees:** A farmer who has drawn zero tanks, taps, pipes or swales gets a confident 'WATER PLAN' sheet — deterministic version showing three brown circles, AI version showing a full rainwater/irrigation/greywater scheme that does not exist. The guard's stated purpose ('A layer map with zero content is always wrong … never render it silently and let the AI invent the layer', :248-251) is defeated.

**Fix:** Count water-layer content as (items of category 'water') + (earthworks items that are genuinely water works) + (swale/pipe/drip lines), and require at least one real water element or line before the sheet renders. Alternatively split a separate earthworks count and refuse when the water count is zero.

### [wrong] (B-ai) buildProducerPrompt demands a legend on the water sheet that the same prompt forbids and the app then draws itself
`lib/producer-prompt.ts:142`

**Farmer sees:** The Water sheet on the non-showcase producer path comes back reframed with a model-drawn legend baked into the artwork, and the app bolts its own legend panel on beside it — two legends, a shrunken map, and a scale bar that no longer matches the image.

**Fix:** Strip the legend/callout sentence from waterRule for the buildProducerPrompt path; keep only 'make the water network the hero' and the do-not-invent clause.

### [confusing] (A-deterministic) Path A: the exact Water sheet's legend swatches do not match the symbols drawn on the map, and carry no icon
`components/design/DesignGlossy.tsx:3832`

**Farmer sees:** 'Small Pond' is a green dot in the legend and a blue ellipse on the map; 'Tap Point' is a green dot and a cream circle. Nothing visually connects a legend row to the thing it names — only the leader labels save the sheet, which makes the legend decorative at best and misleading at worst.

**Fix:** Give sheetLegendRows a per-element symbol renderer for the water sheet (reuse drawWaterFeature at legend scale, as the satellite prompt's rule 11 already demands of the model), or at minimum key the swatch off the same colour drawWaterFeature uses.

### [confusing] (B-ai) AI sheet number '03 — WATER PLAN' contradicts the plan set's own numbering (04)
`lib/producer-prompt.ts:365`

**Farmer sees:** A farmer who prints the 8-page set and also renders the AI sheets ends up with two different pages both labelled 03, and the Water page is 03 in one place and 04 in the other. Referencing sheets by number in a report or a funding application breaks.

**Fix:** Derive SHEET_NO from the single PRINT_LAYERS/DESIGN_SHEETS numbering rather than a second hard-coded map.

### [polish] (A-deterministic) Three separate definitions of 'which lines are water lines'
`components/design/DesignGlossy.tsx:1446`

**Farmer sees:** None visible today. The moment a new water line kind is added to lineInFilter (a greywater run, say), it is legended but not drawn on the exact sheet.

**Fix:** Have drawWaterRoutes filter with lineInFilter(line.kind,'water') and look the style up afterwards; delete the legacy LINE_STYLE map with the legacy builder.

### [polish] (A-deterministic) Path A legend names and line styling for swale/pipe/drip diverge from the rest of the app
`components/design/DesignGlossy.tsx:3847`

**Farmer sees:** A legend row reading 'Drip' next to a green dot, while the map shows a dashed green run and a solid navy one, leaves the farmer guessing which line is the buried pipe. On an element-rich design the key can end in '…' with real drawn features unnamed.

**Fix:** Share the LINE_NAME map, draw line rows as short line specimens with their true dash pattern and colour, and either wrap the legend into two columns or shrink the row height instead of truncating.

## planting — 10 confirmed

### [broken] (both) Windbreaks belong to planting everywhere except the sheet that draws planting
`components/design/DesignGlossy.tsx:3008`

**Farmer sees:** A farmer who has drawn two windbreak hedgerows and no trees yet taps "Planting map": layerContentCount returns 2 so the empty-layer refusal does not fire, and sheet 05 renders titled PLANTING & AGROFORESTRY PLAN with zero planting on it and a legend footnote reading "Canopies drawn at mature spread." His windbreaks instead appear on sheet 06 (Livestock & Infrastructure). If he then renders the same sheet with AI, the windbreaks ARE there — the two versions of sheet 05 contradict each other. DesignPrint includes the blank page in the printed set (DesignPrint.tsx:87-89 uses the same count).

**Fix:** Draw the planting-filter lines on sheet 05: lift the LINE_STYLE/stroke block out of buildBlueprintStructuresMap into a shared helper that takes a filter, call it from buildBlueprintPlantingMap with `lineInFilter(l.kind,'planting')`, and add the Windbreak legend row there. Gate the structures sheet's loop on `lineInFilter(l.kind,'structures')` so the windbreak stops appearing on 06, and drop its Windbreak legend row. Delete the stale comment at 3008-3011.

### [wrong] (both) Beds, banana circles and tree basins are 'earthworks', so they never reach the Planting sheet
`lib/glossy-filters.ts:27`

**Farmer sees:** The farmer places a Banana Circle from the Planting step, then finds it on sheet 04 Water & Irrigation, not on 05 Planting & Agroforestry. On the AI water sheet it even prints under a legend heading that says PLANTING. A design of raised beds + keyhole beds + a herb spiral and no trees renders sheet 05 as an empty field of grass, and layerContentCount says the planting layer is empty so the sheet is refused outright.

**Fix:** Either give itemInFilter a per-element override so the five planting-reading earthworks ids report true for 'planting' (and false for 'water'), or move them to a category the taxonomy treats as planting. Whichever is chosen, make SECTION_BY_ID in overlayElementsText derive from the same source instead of restating it — today it is a second, disagreeing copy of the answer.

### [wrong] (B-ai) AI sheet 05 never shows the traced ground the exact sheet now paints
`components/design/DesignGlossy.tsx:1281`

**Farmer sees:** The commit that added the ground layer says a site whose south end is orchard "rendered as bare satellite there". That is still exactly what the Satellite Overlay planting sheet does. Print the plan set and page 05-exact shows a green orchard block with a legend row for it; regenerate the same page with AI and the orchard is gone. The two sheets describe different farms.

**Fix:** Add a GROUND section to overlayElementsText (feature rings excluding house/driveway, biggest first, using `z.name ?? GROUND_FEATURES[z.feature].label`) and draw the same washes into the composite in drawMarks so the model has a marker to replace, or add a prompt clause naming the traced areas. Reuse groundRows so the AI legend and the exact legend cannot drift.

### [wrong] (A-deterministic) The new margin label pills are painted under the legend panel and the title block
`components/design/DesignGlossy.tsx:3049`

**Farmer sees:** On a design whose trees sit mostly in the eastern half, the top four or five species labels — the whole reason the pills were added — are 82% blacked out by the legend panel, with their leader lines emerging from underneath it. The water sheet shares the pattern but escapes it because composeStyleSheet appends its panel BESIDE the map (3857-3883); sheet 05 draws its panel ON the map.

**Fix:** Reserve the chrome: pass the panel and title rectangles into producerLabels (or clamp the column start y below `pad + rowH*(rows+2.4)` and the left column below the title block) before laying pills out. Alternatively draw the pills last, after the panel, and let de-collision run against the panel rect.

### [confusing] (A-deterministic) Litchi's species swatch is the same colour as the Orchard ground swatch, in the same legend
`components/design/DesignGlossy.tsx:2427`

**Farmer sees:** On a KZN plan with litchis inside a traced orchard, two legend rows — "Litchi Tree ×6" and "Orchard / food forest" — carry an identical green chip, and the litchi canopies are near-invisible against the orchard wash. This is the one sheet whose stated purpose is telling one species from another by colour.

**Fix:** Exclude the GROUND_FEATURES colours from SPECIES_PALETTE (or assign species colours by skipping any hex already used by a ground row present on the sheet). Also drop the ground wash alpha under the canopies, or draw ground with a hatch/texture rather than a flat fill so a same-hue canopy still separates.

### [wrong] (B-ai) AI sheet titles itself "04 — PLANTING PLAN"; the canonical sheet is 05
`lib/producer-prompt.ts:365`

**Farmer sees:** A printed plan set contains both an exact page 05 and an AI page that calls itself 04, which is the Water page's number. A farmer handing the set to a funder has two sheets numbered 04 and no sheet 05, and the AI page is titled "Planting Plan" where the set's contents page says "Planting & Agroforestry".

**Fix:** Derive SHEET_NO (and the title words) from the single DESIGN_SHEETS/PRINT_LAYERS table rather than a private map in producer-prompt.ts, so a sheet cannot be numbered twice.

### [wrong] (B-ai) Icon matching is a loose name regex: banana clumps become banana-circle pits, spekboom hedges become lines
`lib/producer-prompt.ts:410`

**Farmer sees:** The farmer's banana clumps are drawn as excavated mulch pits with earth bunds — a different, expensive earthwork he did not design. Where he placed a spekboom hedge and no windbreak line, the model is told to look for a deep-green line that isn't in the image, and the hedge rectangle gets no icon guidance at all.

**Fix:** Match icons on the element defId set actually present on the sheet (which the caller already has) instead of regexing the rendered label text; give banana_clump and spekboom_hedge their own OVERLAY_ICONS entries; and drop 'banana'/'tree_basin' from ICON_KEYS_BY_SHEET.planting until those elements can actually appear there.

### [confusing] (B-ai) Prompt rule 9 describes drip, pipe and swale lines on the Planting sheet, and never describes the windbreak
`lib/producer-prompt.ts:522`

**Farmer sees:** The planting sheet's prompt spends its most concrete drawing instructions on irrigation the sheet cannot contain — the documented mechanism for a model inventing features — while the windbreak that IS drawn in the input is the least-described mark on the page.

**Fix:** Build rule 9's line clause from ICON_KEYS_BY_SHEET/lineInFilter for the sheet, exactly as §6 already does, and always include the windbreak clause on the planting sheet.

### [polish] (A-deterministic) Empty-layer gate ignores traced ground, so a ground-only planting sheet is refused as "no planting"
`components/design/DesignGlossy.tsx:252`

**Farmer sees:** A farmer who has traced an orchard and a veg garden but not yet placed individual trees is told he has no planting, when the exact sheet could draw a truthful map of exactly what he traced.

**Fix:** Count feature rings that read as planting (orchard, veg_garden) toward the planting layer in layerContentCount, or keep the refusal and reword it to distinguish "no plants placed" from "nothing traced".

### [polish] (A-deterministic) Ground legend rows are exempt from the panel capacity, so they can push every species row out and overrun the sheet
`components/design/DesignGlossy.tsx:2498`

**Farmer sees:** A farmer who traces many named ground areas (per-bed veg-garden rings, several lawns) loses the entire species list to a single "+N more" row while the ground rows survive, and the legend panel runs off the bottom edge of the sheet.

**Fix:** Include the ground rows in the capacity budget (compress them with their own "+N more" once the panel is full) and clamp lgH to `H - 2*pad`.

<details><summary>Refuted (do not re-chase)</summary>

- **Unguarded GROUND_FEATURES lookup can throw and take the whole sheet down** — The code citations are accurate, but the precondition is not reachable in the shipping app, so no farmer can hit it.

WHAT IS TRUE. components/design/DesignGlossy.tsx:2106 does `const meta = GROUND_FEATURES[z.feature!]` and reads `meta.color` at 2110/2124/2131 with no guard; :2462-2463 in `groundRows` do `GROUND_FEATURES[z.feature!].color` / `.label` unguarded; both run on the planting sheet (`bui

</details>

## structures — 9 confirmed

### [wrong] (both) Windbreak lines are drawn and legended on the Structures sheet, but the filter assigns them to Planting
`components/design/DesignGlossy.tsx:3111`

**Farmer sees:** On the exact plan set the farmer's windbreak hedge is printed on sheet 06 Livestock & Infrastructure and appears nowhere on sheet 05 Planting (buildBlueprintPlantingMap draws no lines at all). On the AI plan set the same windbreak appears on the Planting sheet and not on Structures. Two sheets of the same set contradict each other about where the hedge is, and the exact Structures legend advertises a 'Windbreak' row on a sheet whose own definition excludes it.

**Fix:** Delete `windbreak` from LINE_STYLE (DesignGlossy.tsx:3111) and the windbreak legend row (:3153), and drive the loop off `lineInFilter(l.kind, 'structures')` instead of the presence of a style key, so the drawing can never diverge from the filter again. Then add the same white-cased line pass (windbreak only) to buildBlueprintPlantingMap around :3037-3039 so the hedge lands on the sheet the filter actually assigns it to. Fix the two stale comments at :3078 and :3008-3011.

### [wrong] (B-ai) AI Structures sheet is titled '05' — the canonical plan-set number for Planting
`lib/producer-prompt.ts:365`

**Farmer sees:** A farmer who renders the AI set gets a sheet whose header says '05 — STRUCTURES PLAN' while the printed/exact set calls that same layer 06 and calls 05 Planting. A funder or mentor reading the plan set sees two different sheets numbered 05 and no sheet 06.

**Fix:** Make SHEET_NO agree with DESIGN_SHEETS/PRINT_LAYERS: { all:'07', zones:'03', water:'04', planting:'05', structures:'06' } — better, derive it from a single exported map so the three lists cannot drift. While there, consider passing the fuller layer label ('Structures & Livestock') so the AI title matches the exact sheet's 'SMALL LIVESTOCK & INFRASTRUCTURE'.

### [wrong] (B-ai) Path B has no icon vocabulary for livestock — the sheet's headline subject
`lib/producer-prompt.ts:403`

**Farmer sees:** On a sheet titled for livestock, the model is handed the names ('Goat Pen ×2', 'Kraal') with zero guidance on what to draw, and the legend must show an icon nobody specified. It will invent something — the exact failure mode this sheet's prompt architecture exists to prevent — and the invented pen will not match the same element drawn on the whole-design sheet.

**Fix:** Add OVERLAY_ICONS entries + ICON_MATCH regexes for the livestock and small-infrastructure elements (goat/pig pen as a fenced enclosure with a shelter in one corner, kraal as a circular stock enclosure, rabbit hutch, duck pond, trough, gate as a break in the fence line with a swing arc, market stall, biodigester, shade sail, bench, sign, ground solar array, washing line), and add them to ICON_KEYS_BY_SHEET.structures and LEGEND_BY_SHEET.structures. As a backstop, if `present` is empty for a non-empty element list, emit a generic 'draw each named element as a simple top-down pictorial icon at the marker's size' clause instead of a dangling ': .'

### [wrong] (B-ai) Two structures elements are described to the model as a different object
`lib/producer-prompt.ts:380`

**Farmer sees:** A farmer who placed a fixed chicken coop gets a wheeled A-frame ark drawn on his plan; a worm farm is drawn as a three-bay compost run four times its footprint. The sheet then disagrees with the deterministic sheet, which draws each at its true footprint.

**Fix:** Split the keys: `coop` (fixed hen house) and `tractor` (A-frame on skids) with anchored regexes /chicken coop/i and /chicken tractor/i; `compost` (/compost bay|compost/i) and `worm` (/worm farm/i, a stacked worm bin). Add both new keys to ICON_KEYS_BY_SHEET.structures and ICON_KEYS_BY_SHEET.all.

### [wrong] (both) Traced paving and cleared ground are missing from the infrastructure sheet in both paths, but drawn on the Planting sheet
`components/design/DesignGlossy.tsx:3034`

**Farmer sees:** A farmer who traced his paving/yard sees it hatched on 05 Planting (a sheet about crops) and absent from 06 Livestock & Infrastructure (the sheet about built surfaces). On the AI version the prompt describes a patio that has no marker, which is exactly how a model is talked into painting one that does not exist.

**Fix:** Draw the built ground features on the structures sheet — call drawBlueprintGround with the HARD subset (patio, cleared) before the item pass at :3137 and add their groundRows to `fixed` at :3151 — and restrict the planting sheet's ground pass to the vegetated kinds (lawn/veg_garden/orchard). Then either surface patio polygons in the structures composite/element list or drop M.patio and 'patio' from LEGEND_BY_SHEET.structures / ICON_KEYS_BY_SHEET.structures so nothing primes it.

### [confusing] (A-deterministic) Exact sheet draws the house as content but never names it, and is the only design sheet with no on-map labels
`components/design/DesignGlossy.tsx:3104`

**Farmer sees:** The largest shape on the Structures sheet (the house) has no legend entry, and a goat pen, pig pen and rabbit hutch are distinguishable only by emoji and swatch colour — while the sibling Planting and Water sheets both carry named label pills. Small items appear as anonymous dots.

**Fix:** Add `drawBlueprintLabelPills(ctx, producerLabels(state, refLayers, W, H, 'structures'))` after the item pass at :3140 (producer-labels already has STRUCTURES / LIVESTOCK / ACCESS families, lib/producer-labels.ts:35-43), and push a House row into `fixed` at :3151 when refLayers.house.length >= 3.

### [confusing] (both) The two paths tell opposite stories about the driveway on the access/infrastructure sheet
`components/design/DesignGlossy.tsx:3156`

**Farmer sees:** The farm's main access surface is a labelled legend item on the exact 06 sheet and deliberately unlabelled background on the AI 06 sheet. A user comparing the two sheets of one plan set cannot tell which is authoritative.

**Fix:** Decide once: on the structures/access layer the driveway is content. Relax the guard at :1303 to `filter === 'all' || filter === 'structures'`, and make drivewayRule (producer-prompt.ts:468-470) grant the caption on sheetKind 'structures' as well as 'all'. Optionally count a traced driveway toward layerContentCount for 'structures' the way boundary counts for 'all' (:265).

### [polish] (A-deterministic) 'Fence / site boundary' legend row is unconditional; the boundary may not be drawn
`components/design/DesignGlossy.tsx:3155`

**Farmer sees:** An untraced-boundary design prints a legend row for a green ticked line that is not on the sheet — the phantom-row failure this audit is checking for.

**Fix:** Guard the row: `if (refLayers.boundary.length >= 3) fixed.push(...)` at :3155 (and mirror the guard on the sibling builders). Rename to 'Site boundary' so it does not read as a third fence type.

### [polish] (both) Fence/path line styling is inverted between the exact sheet and the AI composite+prompt
`components/design/DesignGlossy.tsx:3109`

**Farmer sees:** The same fence is a dashed grey line on the exact 06 sheet and a solid violet posted line on the AI 06 sheet; the same path is solid on one and dashed on the other. Within a single plan set the line key changes meaning between pages, and the blueprint's dashed fence carries the 'proposed/underground' reading the composite comment explicitly warns against.

**Fix:** Make the blueprint follow the product-wide convention at :3109-3110: fence solid in LINE_COLORS.fence (#8E7CC3, optionally with post dots as in :582-599), path dashed gold. Better still, source both from the shared LINE_COLORS/dash table rather than a second private LINE_STYLE literal.

## all — 10 confirmed

### [broken] (B-ai) Zones are drawn into the composite but declared absent by the prompt — the Full Design Plan has no zones
`components/design/DesignGlossy.tsx:1281`

**Farmer sees:** The farmer's masterplan — the one sheet whose whole job is to show the design integrated — comes back with zero permaculture zones, and no legend section for them. Worse, the coloured washes are still in the input image with no explanation, so rule 5 ('each coloured shape marks where one designed element goes') invites the model to reinterpret a whole zone polygon as one element — a blue-ish wash can become the 'blue area marker → a pond' icon (producer-prompt.ts OVERLAY_ICONS.dam) since 'dam' is in ICON_KEYS_BY_SHEET.all.

**Fix:** In overlayElementsText, emit zones when zonesInFilter(filter) is true, as their own 'ZONES »' legend section ('Zone 3 — Orchard / food forest'), for both the 'zones' and 'all' sheets. Add a zone-wash clause to buildSatelliteOverlayPrompt's rule 2 and rule 6 (reuse M.zones wording from producer-prompt.ts:315) whenever sheetKind is 'all' or 'zones'. Belt-and-braces: extend the overlayImage branch so f==='all' also burns buildZoneOverlay back, or at minimum assert post-render that a zones section exists.

### [wrong] (B-ai) Prompt orders a tar driveway and a "TARRED DRIVEWAY" caption on this sheet even when no driveway exists, and contradicts itself three times about how to draw it
`lib/producer-prompt.ts:468`

**Farmer sees:** A smallholding with no traced driveway gets a black access track painted across its masterplan and captioned TARRED DRIVEWAY — a road that does not exist, on the sheet the farmer shows a funder. Where a driveway does exist, its rendering is a coin flip between 'quiet grey' and 'near-black slab', so the sheet does not match the other sheets in the set.

**Fix:** Pass a `hasDriveway` boolean into buildSatelliteOverlayPrompt (derived from refLayers.driveway.length >= 2, the same test overlayElementsText uses) and omit the caption clause, the rule-2 item (3) and the FINAL CHECK (4) driveway phrase entirely when it is false. Then pick one treatment and state it once — the rule-9 'quiet grey, no dark fill' version, since that is the documented intent — and delete the contradicting phrases from rule 2 and the FINAL CHECK.

### [wrong] (both) The empty-state guard passes on boundary/zones alone, so 'all' renders with an EMPTY element list
`components/design/DesignGlossy.tsx:265`

**Farmer sees:** The farmer taps Generate, waits several minutes and a paid render, and gets a beautifully lettered '01 — FULL DESIGN PLAN' that is entirely invented — the exact 'amazing picture but completely wrong' failure emptyLayerMessage exists to prevent, and the sheet gives no hint that nothing of theirs is on it.

**Fix:** Guard on what actually reaches the sheet, not on a proxy: for the model-chrome path require the built elementsText to be non-empty (or count only items/lines/zones-that-will-be-listed), and refuse with emptyLayerMessage('all') otherwise. Once zones are listed (finding 1), a zones-only design legitimately passes; a boundary-only design must not.

### [wrong] (A-deterministic) Print masterplan legend omits every line feature and the driveway, duplicates zone rows, and truncates
`components/design/DesignPrint.tsx:111`

**Farmer sees:** On the printed Integrated Masterplan the farmer sees dashed blue swales, gold paths, violet fence lines, drip runs and a black driveway with no key entry for any of them, 'Zone 3 — Orchard / food forest' listed three times, and on a real 40-plus-element design the legend simply stops at '…' with drawn elements unexplained.

**Fix:** Delete DesignPrint.legendRows and call the already-correct sheetLegendRows(state, refLayers, filter) exported from DesignGlossy (DesignGlossy.tsx:3810-3851) — it dedupes zones, includes line kinds and the driveway. For overflow, wrap into a second legend column (or shrink rowH) rather than dropping rows; a plan-set legend that hides content is worse than a dense one.

### [wrong] (B-ai) Prompt tells the model both to preserve and to delete every unmarked tree — worst on the whole-site sheet
`lib/producer-prompt.ts:534`

**Farmer sees:** An established smallholding's mature trees, hedges and existing orchard get scrubbed off the masterplan to satisfy the final check, so the 'Full Design Plan' shows an emptier farm than the one the farmer walks on — or the model splits the difference unpredictably between sheets in the same set.

**Fix:** Scope FINAL CHECK (3) to added design elements: 'no NEW tree, shrub or bed has been added that has no marker under it; trees already visible in the photograph stay exactly as photographed.' Same wording change in rule 4 ('no filler trees…').

### [wrong] (both) Traced ground features (veg garden, orchard, patio, lawn, driveway-as-feature) are on no version of the sheet, yet the legend cites them as places
`components/design/DesignGlossy.tsx:527`

**Farmer sees:** The whole-design sheet is missing the farmer's own record of what is already there — the veg garden, the orchard, the paving — and its legend points at place names ('Veg garden') that appear nowhere on the map, so the reader cannot locate the element the row describes.

**Fix:** On the 'all' sheet, draw ground features into the composite as soft labelled washes (buildBlueprintStructuresMap already does this — see the feature loop at DesignGlossy.tsx:2459-2463) and emit an 'EXISTING' legend section for them in overlayElementsText, with the driveway falling into it when it is a ground feature. At minimum, suppress the place suffix when the place polygon is not rendered on the sheet.

### [confusing] (A-deterministic) 'all' is the only layer with no Blueprint — the Exact whole-design sheet has no legend, scale, north arrow or zone numbers
`components/design/DesignGlossy.tsx:4539`

**Farmer sees:** The farmer's instant, free, always-correct whole-design sheet is unreadable as a plan: coloured blobs and emoji with no key, no idea of scale, no north, and pastel zone washes with no numbers. Only the Print composer wraps furniture around it, and that legend is itself broken (see the DesignPrint finding).

**Fix:** Build buildBlueprintMasterplanMap on the shared drawBlueprint* chrome helpers (the same ones the four layer Blueprints use), feeding it sheetLegendRows(state, refLayers, 'all'); route line 4539 to it. Cheap interim: draw the zone number badge for zonesInFilter(filter), not just filter==='zones' (line 549).

### [confusing] (both) One sheet, three names and two different numbers — '01 FULL DESIGN PLAN' collides with print sheet 01 'Existing Site & Base'
`lib/producer-prompt.ts:364`

**Farmer sees:** A farmer who generates AI sheets and then exports the print set ends up with two different sheets both titled '01' — one showing the design, one showing the bare site — plus three names for the same map across the UI, the gallery and the printed page. In a funder packet that reads as a mistake.

**Fix:** Make SHEET_NO agree with PLAN-SET-SPEC (all→'07', zones→'03', water→'04', planting→'05', structures→'06') and use one label everywhere: 'Integrated Masterplan'. Derive both from a single exported table shared by DesignGlossy, DesignPrint and producer-prompt so they cannot drift again.

### [confusing] (B-ai) Icon vocabulary covers ~24 of 69 element types, so most elements on the widest sheet get no icon spec
`lib/producer-prompt.ts:419`

**Farmer sees:** On the sheet with the widest element mix, roughly two thirds of element types are drawn from the model's imagination and its legend icon is a second, different improvisation — so the legend swatch and the map icon for the same row do not match, which is the one thing the sheet's own FINAL CHECK (2) says must hold.

**Fix:** Add OVERLAY_ICONS entries + ICON_MATCH regexes for the remaining catalog types (they are enumerable — derive the list from ELEMENT_CATALOG and add a unit test asserting every def.id resolves to an icon key). Until then, add a neutral fallback clause for unmatched names: 'draw a simple, plain top-down icon of the named object and use the identical icon in its legend row.'

### [polish] (B-ai) Farmer-typed element labels are injected into the prompt and split on ',', '|' and '»'
`lib/producer-prompt.ts:482`

**Farmer sees:** A farmer who names an element descriptively gets phantom legend rows on their masterplan — 'Tank' and 'north side' as two separate entries with icons invented for each.

**Fix:** Sanitise labels before they enter the element list: strip or escape ',', '|' and '»' (and collapse whitespace) in overlayElementsText, and build the legend from a structured array of {section, name, count} handed to the prompt builder instead of round-tripping through a delimited string.

<details><summary>Refuted (do not re-chase)</summary>

- **Legend rows carry place suffixes and split per-place, contradicting the prompt's own 'one row per element TYPE'** — Code mechanics are quoted accurately (DesignGlossy.tsx:1272-1275 splits per place; producer-prompt.ts:478-493 turns each token into a literal row; the phrase at producer-prompt.ts:526 exists; path is live via DesignGlossy.tsx:4959-4974), but the claim does not describe a defect.

(1) No operative contradiction. Rule 11's "one row per element TYPE" is descriptive preamble for the column's shape; th
- **SECTION / SECTION_BY_ID grouping is broadly right; three small filing quibbles and a silent default** — Every code fact in the claim is literally accurate (SECTION/SECTION_BY_ID at DesignGlossy.tsx:1245-1256, item default INFRASTRUCTURE at :1260, group fallback PLANTING at :1313; mulch_bank='growing' at design-elements.ts:413, greywater_basin/infiltration_basin='earthworks' at :321/:361, half_moon/berm/terrace='earthworks' at :373/:385/:397, six category:'animal' defs at :820-881, DesignPrint.tsx:77

</details>

## Cross-cutting root causes and order of work

# Cross-cutting audit — coverage, consistency, root causes, order of work

## 1. COVERAGE

### 1a. Element categories (`ElementCategory`, `lib/design-elements.ts:14`) vs the five filters

`itemInFilter` (`lib/glossy-filters.ts:20-33`) partitions by category only:

| category | all | water | zones | planting | structures | sheets |
|---|---|---|---|---|---|---|
| `water` | ✓ | ✓ | — | — | — | 1 |
| `earthworks` | ✓ | ✓ | — | — | — | 1 |
| `growing` | ✓ | — | — | ✓ | — | 1 |
| `structure` | ✓ | — | — | — | ✓ | 1 |
| `animal` | ✓ | — | — | — | ✓ | 1 |
| `access` | ✓ | — | — | — | ✓ | 1 |

**Proof of exactly-once at the category level.** No category is orphaned and none is double-filed. `SPECIES_INDEX` (`DesignGlossy.tsx:2434-2447`) even depends on planting/structures being disjoint — it is, so the "collision-free" claim at 2419-2422 holds.

The category grain is however **the wrong grain**, and that is where the layer agents' findings come from: `earthworks` (13 elements, `design-elements.ts:253-407`) contains five that are unambiguously planting (`raised_bed`, `keyhole_bed`, `herb_spiral`, `banana_circle`, `tree_basin`) and eight that are water/land-shaping. The category-level partition is therefore correct-by-construction and wrong-by-content simultaneously. `overlayElementsText` already knows this and patches it downstream with a hand-written override table, `SECTION_BY_ID` (`DesignGlossy.tsx:1252-1256`) — which changes the *legend heading* but not the *sheet*, producing the "WATER PLAN with a PLANTING heading" defect.

`zones` returns `false` for every category (`glossy-filters.ts:31`), which is deliberate — but it makes `zones` the only filter whose entire content comes from a code path (`zonesInFilter`) that `overlayElementsText` does not serialise.

### 1b. Line kinds (`LineShape.kind`, `lib/design-canvas.ts:62`) vs the five filters

`lineInFilter` (`glossy-filters.ts:35-48`): `swale|pipe|drip → water`; `fence|path → structures`; `windbreak → planting`; `zones → none`. **Every kind on exactly one sheet — on paper.**

In practice `windbreak` is on **two sheets and neither is the one the filter names**:
- `buildBlueprintPlantingMap` draws **no lines at all** (`DesignGlossy.tsx:3037-3039`), justified by a comment at `3008-3011` that states `lineInFilter` puts windbreak on structures. **That comment is factually false** — `glossy-filters.ts:42` says planting, with its own comment saying the opposite of 3008.
- `buildBlueprintStructuresMap` draws it (`3111`) and legends it (`3153`).
- Path B files it under `PLANTING` (`DesignGlossy.tsx:1295`) and `LEGEND_BY_SHEET.planting` includes `M.windbreak` (`producer-prompt.ts:323`), while `ICON_KEYS_BY_SHEET.planting` includes `windbreak` (`:402`) — so the AI planting sheet expects it and the exact planting sheet refuses to draw it.

Net: on the exact sheets the windbreak is on Structures; on the AI sheets it is on Planting; the empty-layer gate counts it as Planting (`layerContentCount:263`).

### 1c. Ground/built shapes (`GroundFeatureKind`, `design-canvas.ts:41`) — **the real coverage hole**

Seven kinds — `house, patio, driveway, lawn, veg_garden, orchard, cleared` — and **none of the three filter functions has any concept of them**. Where they actually land:

| kind | path A (exact) | path B (AI composite) | AI element list |
|---|---|---|---|
| `lawn`, `veg_garden`, `orchard` | Planting sheet only (`drawBlueprintGround` called from exactly one site, `DesignGlossy.tsx:3034`) | never — `drawMarks` has no ground branch (`429-694`) | never |
| `patio`, `cleared` | Planting sheet only (same call) | never | never |
| `house` (Studio-drawn) | **nowhere** — excluded at `2096`, and `refLayers.house` is derived from main-map traced layers, not from `ZoneShape.feature` (`app/design/page.tsx:643-659`) | never | never |
| `driveway` (Studio-drawn) | **nowhere** — same exclusion at `2096`, same `refLayers` gap (`app/design/page.tsx:646-659`) | never | never |

So: **a farmer who traces their house or driveway inside the Design Studio gets them on zero sheets in both render paths**, while `buildDesignBrief` still injects a `GROUND:` sentence naming them into every strict-producer prompt (`DesignGlossy.tsx:1060-1068`). And a farmer whose whole south end is orchard sees it on the Planting sheet and nowhere else — including the "Integrated Masterplan" (07) whose whole job is showing the site as one thing.

This is the single largest uncited gap in the whole audit: it is **not** a per-layer defect, it is a missing dimension in the membership model.

### 1d. Effort-zones (`ZoneShape` without `feature`)

`zonesInFilter` (`glossy-filters.ts:50`) → `all` + `zones`. Path A: drawn on the Zones blueprint (`2540`) and, for `'all'`, via `drawMarks` (`526-565`) since `'all'` has no blueprint (`4539`). Path B: **drawn into the composite** for both filters (`544`) but **named in neither element list** (`1281`). Prompt §7 declares the list "the COMPLETE contents of this sheet" (`producer-prompt.ts:518`) — so on both the Zones sheet and the whole-design sheet the prompt actively asserts that what the model can see is not there.

### 1e. Icon-vocabulary coverage (path B only)

`OVERLAY_ICONS` has 24 entries (`producer-prompt.ts:371-396`) against 69 catalog elements + 7 ground kinds + 6 zone bands. `ICON_MATCH` (`:408-415`) is a name regex, so coverage is not even 24 — e.g. `building: /\bshed\b|\bhut\b|\bbarn\b|shade house|greenhouse/i` covers 3 of the 20 `structure` elements and none of the 6 `animal` ones. **No key anywhere describes a zone band**, on any sheet — `ICON_KEYS_BY_SHEET.zones = ['building','path','fence']` (`:400`). The vocabulary exists 80 lines away in the showcase legend (`M.zones`, `:316`) and was never ported.

## 2. CONSISTENCY — same thing, different filing

| thing | path A | path B | print |
|---|---|---|---|
| **windbreak** | Structures sheet (`3111`, `3153`) | PLANTING section (`1295`), planting icon keys (`producer-prompt.ts:402`) | via `buildBlueprintStructuresMap` → Structures (06) |
| **raised/keyhole/herb-spiral beds, banana circle, tree basin** | Water sheet (`itemInFilter`, `glossy-filters.ts:25`) | drawn on the Water sheet under a **PLANTING** heading (`1252-1256`) | Water (04) |
| **fence** | `#8C8577` dashed, "Internal fence" (`3110`, `3154`); *also* a green `#8CEB6A` "Fence / site boundary" row on the Zones sheet (`2645-2653`) | `#8E7CC3` violet, **solid**, with posts (`577-598`); prompt says "dusty-violet line" (`producer-prompt.ts:390`) | inherits A |
| **path** | solid gold (`3109`) | gold **dashed** (`577`), prompt says "gold dashed" (`:391`) | inherits A |
| **driveway** | "Tarred driveway", swatch `#2A2A2E` (`2659`, `3063`, `3156`) but drawn `#3B3A3E` (`517`); `sheetLegendRows` uses `#3B3A3E` (`3849`) | listed only on `'all'` (`1303`); prompt orders a caption on `'all'` and forbids one elsewhere (`producer-prompt.ts:468-470`) | "Driveway (tar)" (`DesignPrint.tsx:113`); `GROUND_FEATURES.driveway.label` is "Driveway" (`design-elements.ts:88`) — **three names, two colours, two sources** |
| **sheet numbers** | n/a | `SHEET_NO` all=01 zones=02 water=03 planting=04 structures=05 (`producer-prompt.ts:364-366`) | `PRINT_LAYERS` zones=03 water=04 planting=05 structures=06 masterplan=07 (`DesignPrint.tsx:71-80`) — **every AI number collides with a different print sheet** |
| **legend sections** | none — flat rows (`2248`, `3810`) | WATER/PLANTING/INFRASTRUCTURE (`1245-1256`) | none (`DesignPrint.tsx:111`) |
| **species colour** | `speciesColor` per-species (`2449`) on planting/structures sheets; `def.color` per-category in `sheetLegendRows` (`3832`) and `DesignPrint.legendRows` (`:126`) | n/a | per-category — so the print masterplan legend swatch does not match the sheet it legends |

Two further internal inconsistencies worth naming: `producerElementsText` **does** list zones (`1339-1341`) while `overlayElementsText` does not (`1281`) — the same design, two element lists, opposite answers depending on which style the farmer picked; and `layerContentCount` (`252`) is the gate for both paths but only ever agrees with path A.

## 3. ROOT CAUSES — the fixes with the largest blast radius

**RC1 · Membership is filed by category, not by element.** `glossy-filters.ts:20-33`.
Give `DesignElementDef` a `sheets: GlossyLayerFilter[]` (precedent already exists: `alsoSteps`, `design-elements.ts:34`, is the same idea on the wizard axis) and make `itemInFilter` a lookup.
Kills: `water/both/wrong` (beds on Water), `planting/both/wrong` (beds/banana/basins missing from Planting), `water/both/wrong` (empty-guard passes on earthworks alone), and retires the `SECTION_BY_ID` override (`1252`) and the stale 10-line rationale at `glossy-filters.ts:10-19`. **~4 confirmed defects, one data edit.**

**RC2 · The composite and the element list are built by two separate traversals.** `drawMarks:429-694` vs `overlayElementsText:1235-1318`. Because prompt §7 declares the list complete (`producer-prompt.ts:518`), anything drawn-but-unnamed is asserted absent, and anything named-but-undrawn is invented. Make one selector return `{items, lines, zones, ground, context}` for a sheet and have both the canvas and the text render from it.
Kills: `zones/B-ai/broken` (`1281`), `all/B-ai/broken` (zones on the masterplan), `zones/B-ai/wrong` (fake empty-gate guarantee), `planting/B-ai/wrong` (traced ground), `all/both/wrong` (ground features). **5 defects, and it makes the class of defect unrepresentable.**

**RC3 · Path B has no zone vocabulary anywhere.** `producer-prompt.ts:398-404` (no zone key), `:371-396` (no zone icon), `:514` (§5 converts every marker into a pictorial icon — the exact wrong instruction for a translucent band). The wording already exists at `:316` for the showcase path. Port it and exempt zone washes from §5.
Kills: both `zones/B-ai/broken` prompt defects. **2 defects, one prompt block.**

**RC4 · Two sheet-numbering tables.** `producer-prompt.ts:364-366` and `DesignPrint.tsx:71-80`. Export one constant from the print spec and have the prompt read it.
Kills: all four `*/B-ai/wrong` numbering defects plus `all/both/confusing`. **5 defects, one constant.**

**RC5 · Legends are written by hand next to the draw, not derived from it.** `2645-2659` (Zones prints Fence+Driveway unconditionally), `3155` (Structures the same), `3832` (Water swatches ≠ symbols), `DesignPrint.tsx:111-135` (masterplan omits every line + driveway, duplicates zone rows per polygon). Have each draw helper return the rows it emitted; assemble the panel from that.
Kills: `zones/A/wrong`, `structures/A/polish`, `water/A/confusing`, `all/A/wrong`, `planting/A/polish` (capacity overrun becomes a single fit pass). **~5 defects.**

**RC6 · Nothing reconciles Studio-drawn ground with map-traced `refLayers`.** `app/design/page.tsx:643-659` populates `refLayers` purely from main-map layers; `ZoneShape.feature` is Studio-only; `drawBlueprintGround` excludes `house`/`driveway` (`2096`) on the assumption a dedicated draw exists — true only for the `refLayers` copy. Resolve once (Studio feature wins, `refLayers` falls back) and feed every sheet.
Kills: `zones/A/broken` ×2 (Zone 0 counted-not-drawn `2540`; roof-only Zone 0 `2580`), `structures/both/wrong` (paving/cleared), `all/both/wrong` (ground features), `planting/A/polish` (ground-only sheet refused). **5 defects.**

**RC7 · Three prompt builders each carry their own per-sheet `if (sheetKind === …)` fiction**, all reachable from one call site (`DesignGlossy.tsx:4973-4983`): the invented plumbing schematic (`producer-prompt.ts:460`), the tar-driveway caption (`:468`), preserve-vs-delete trees (`:534`), legend-required-vs-forbidden (`:142` vs `:526`), two mutually exclusive water legend structures (`:526`). Replace with one per-sheet content-contract object.
Kills: most of the remaining `B-ai/wrong` water and `all` prompt defects.

**Also missing, and cheap:** `glossy-filters.ts:1-3` says the file was extracted "so the pure layer-membership logic is unit-testable" — there is **no test for it** (`tests/` holds only `canvas-labels`, `image-producer`, `producer-labels`). A single table-driven test asserting the §1 coverage matrix — every category, every line kind, every ground kind on exactly the sheets intended — is the cheapest possible guard for RC1/RC2 and would have caught `itemInFilter(_, 'zones') === false` reaching production.

## 4. ORDER OF WORK

**P0 — do first, in this order (each unblocks the next).**
1. **RC2**, the one-selector rewrite. Every other path-B fix is built on it; doing RC3/RC4 first means re-editing them.
2. **RC3**, zone vocabulary. Cheapest fix on the list and it clears the defect that triggered the audit.
3. **RC1**, per-element membership. **Changes what sheets contain**, so it must land before anyone judges output. Note the cache: `saveGlossy` keys on `producer:${style}:${filter}` (`DesignGlossy.tsx:4940`, `5041`-ish) with **no content hash**, so pre-fix sheets survive the fix and will be compared against post-fix ones — invalidate the glossy cache in the same commit or the QA pass is worthless.
4. **RC6**, ground/house resolution. Independent of 1-3; can run in parallel.
5. **RC4**, shared sheet numbers — 20 minutes, removes five defects, do it while the prompt file is open.

**P1 — after P0 is verified against a real render.**
6. **RC5**, legend-from-draw across the four blueprint builders + `DesignPrint.tsx:111`.
7. **Windbreak**: draw filtered lines in `buildBlueprintPlantingMap` (`3037`), drop `windbreak` from the structures `LINE_STYLE` (`3111`) and legend (`3153`), and **delete the comment at `3008-3011`** — it asserts the opposite of the code it cites.
8. **RC7**, per-sheet content contract.
9. Reconcile line styling (fence solid/violet vs dashed/grey; path dashed vs solid) so `LINE_COLORS` (`158-165`) is the only definition; fold in the three competing "which lines are water lines" definitions (`1446`).

**Safe to leave.**
- The dead rollback paths — `buildProducerPromptLegacy` (`producer-prompt.ts:184`), `buildShowcasePromptLegacy` (`:542`), `buildLockedBackgroundPrompt` (`:77`), `buildBlueprintWaterMapLegacy` (`DesignGlossy.tsx:2673`). Their defects do not ship. But they are the largest single source of the stale/contradictory comments that made this audit expensive, so **delete them once P0 is verified**, not before.
- Litchi/Orchard swatch collision (`2427`) — real but cosmetic, and it moves anyway when ground rows and species rows share one allocator under RC5.
- Prompt-wording polish: label splitting on `,`/`|`/`»` (`:482`), driveway caption phrasing, the "blue area marker" for ponds when every marker is green (`:374`). Cosmetic next to the structural defects, and several disappear with RC7.
- The `'all'` sheet having no Blueprint (`4539`) is a genuine gap but it is *new work*, not a fix — do not let it into the P0 batch.