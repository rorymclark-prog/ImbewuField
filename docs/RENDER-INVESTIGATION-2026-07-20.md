# Follow-up investigation — 2026-07-20

58 agents, every finding adversarially verified by an independent agent instructed to refute it.
39 confirmed of 53 raised. Landed in 49d80a8: the vetiver/pollinator icon specs, the boundary
colour + positive identification, the roof colour, and the tar-fill instruction. Everything else
below is OPEN. Companion to docs/LAYER-AUDIT-2026-07-20.md.

## ghost-vetiver — 7 confirmed

### [high] OVERLAY_ICONS.mulch orders a linear band for an element whose marker is a 2 m square
`lib/producer-prompt.ts:384`

**Evidence:** 'a vetiver-bank marker → ONE dense continuous band of upright blue-green grass tussocks along exactly that line, cut low at one end to show it is harvested'. ICON_MATCH.mulch = /mulch bank|vetiver bank/i (:417) fires this on the element named 'Vetiver Bank' (lib/design-elements.ts:415), whose def is shape 'rect', wM 2, hM 2 (:416-418) — a 2 m square. 'mulch' is in ICON_KEYS_BY_SHEET.planting (:409) and .all (:406). Rule 5 (:546) simultaneously says 'Keep each icon to the size of the marker it replaces', so the prompt asks for a continuous band along a line AND for it to fit a 4 m² square. The model resolves the contradiction the only way it can: it finds a line.

**Fix:** Rewrite the mulch entry to describe the actual marker: 'a small square grass marker → a compact block of upright blue-green vetiver tussocks filling exactly that square, no larger'. Delete 'along exactly that line' — that wording belongs only to markers that ARE lines. If a linear vetiver bank is a real product need, make it a DesignLine kind (or reuse the windbreak line) so a line marker actually exists in the composite before the prompt describes one.

### [high] The composite's boundary is the only long green line, and the prompt has it drawn as a repeating-tick planted-row convention
`components/design/DesignGlossy.tsx:451`

**Evidence:** drawMarks strokes the boundary ring as rgba(140,235,106,0.9) (= #8CEB6A) at lineWidth 3 with no ticks (:451-461) — a saturated green in the same family as the planting element fills (mulch_bank #7D9A4A, spekboom/vetiver_row #4E8B3B) and NOT the chartreuse #B4E000 the prompt names. Rule 9 (lib/producer-prompt.ts:554) then instructs 'Property boundary: a bright chartreuse #B4E000 line with short perpendicular tick marks at regular intervals along its full length, both sides, like a surveyed fence line', and STYLE_LINES.satellite_overlay (:284) repeats 'a bright yellow-green surveyed boundary line with regular perpendicular tick marks'. A green line carrying regularly repeated perpendicular elements along its whole length is exactly how a planted row/hedge is drawn. Note the ticks exist ONLY in the prompt — drawBlueprintBoundary (DesignGlossy.tsx:2186-2202) draws real ticks, but that is the deterministic path, not the AI composite.

**Fix:** Make image and prompt agree: stroke the composite boundary in the chartreuse #B4E000 the prompt names, so it is visibly NOT planting green. Add one positive sentence to rule 9: 'the green ring around the plot is the PROPERTY BOUNDARY — it is a survey line, never a hedge, windbreak, row or planted band, and nothing is planted along it that has no marker of its own.' (Positive identification, not a 'never do X' about planting.)

### [high] The element list gives the model no position at all, and the Vetiver Bank marker is ~3-7 px at model resolution
`components/design/DesignGlossy.tsx:1235`

**Evidence:** overlayElementsText (:1235-1318) emits only names, optional place suffixes and ×N counts; prompt rule 7 (producer-prompt.ts:550) tells the model that list is 'the COMPLETE contents of this sheet'. The sole positional channel is the composite image. pxPerM = imgW/(frame.imgW * frame.mPerPx) = SCALE/mPerPx (drawMarks:449, SCALE = 2 at :332); at a typical smallholding mPerPx of 0.3-0.6 that is 3-7 canvas px per metre, so the 2 m Vetiver Bank footprint is a 6-14 px square on a ~2000 px composite — 3-7 px once the model sees it at ~1024 px. Its 🌾 glyph is min 14*SCALE = 28 px (:653), i.e. 2-4x the footprint, is flagged small (:654) and is LIFTED off centre (:668), and the de-collision loop (:671-679) can push it further still. So the one mark that says where the vetiver bank is, is smaller than the emoji sitting next to it.

**Fix:** Give sub-3 m elements a legibility floor in the composite: draw a hairline call-out ring at a minimum radius (e.g. max(footprint, 10*SCALE px)) around small footprints so the model can see the anchor, and keep the leader line from the lifted glyph back to the true centre (it already draws one only when displaced — make it unconditional for small items). Longer term this is audit RC2: one selector feeding both the canvas and the text, with positions (compass bucket / place) carried into the element list for every element, not just as an optional place suffix.

### [high] ICON_MATCH.windbreak fires on any element merely NAMED '…Hedge', injecting a second green-line hedge spec with no line in the image
`lib/producer-prompt.ts:421`

**Evidence:** windbreak: /windbreak|hedge/i matches the item name 'Spekboom Hedge' (lib/design-elements.ts:798), which is a 0.5 m × 5 m rect ITEM, not a line. 'windbreak' is in ICON_KEYS_BY_SHEET.planting (:409) and .all (:406), so a design containing any 'Hedge'-named item adds OVERLAY_ICONS.windbreak (:402) — 'a deep-green line → a windbreak: a dense row of small green canopy discs' — to rule 6. If the farmer drew no windbreak LineShape, no deep-green line exists in the composite (LINE_COLORS.windbreak #2F7A4A, DesignGlossy.tsx:164), and the nearest thing in the image is the green boundary ring. This is the audit's 'icon matching is a loose name regex' finding (docs/LAYER-AUDIT-2026-07-20.md, planting section) landing on exactly this bug.

**Fix:** Match icons on the defId set actually present on the sheet — the caller already has it — instead of regexing rendered label text (audit RC1/RC2). As an immediate patch, anchor the regex to the line feature only (/windbreak/i) and give spekboom_hedge its own OVERLAY_ICONS entry describing a short compact shrub block at marker size.

### [medium] Rule 4 negation-primes the exact pairing 'planting + along the boundary'
`lib/producer-prompt.ts:544`

**Evidence:** Rule 4: 'Draw one canopy per tree marker and not one more — no filler trees along the boundary, no shrubs to balance a corner, no planting in the open grass.' The only place the words 'along the boundary' appear next to planting in the whole prompt is this prohibition. The same file's comment at :297-300 states the design principle that was adopted after the earlier audit: legends are 'POSITIVE ONLY … by construction, not by telling the model "never do X" (the thing the audit found backfires)'. Rule 4 violates that principle on the exact axis that is failing.

**Fix:** Restate positively and drop the boundary noun: 'Every plant, bed and structure on this sheet stands on its own marker; the open grass, the corners and the strip inside the boundary line stay as the photograph shows them.' Keep the count discipline, remove the phrase that names boundary planting.

### [medium] Two grass-hedge icon specs can be live in the same prompt, and neither is anchored to a marker
`lib/producer-prompt.ts:385`

**Evidence:** vetiver_row: 'a vetiver-row marker → single-file separate grass clumps with visible gaps between them, not a continuous band' (:385) sits alongside the mulch band spec (:384); both keys are in ICON_KEYS_BY_SHEET.planting and .all (:406, :409). A design with both a Vetiver Bank and a Vetiver Row hands the model two competing descriptions of linear grass planting — and vetiver_row is itself a 0.3 m × 5 m rect (design-elements.ts:808-815), i.e. a sliver 1-3 px wide in the composite. The 'not a continuous band' clause is a second negation that names the very thing being wrongly drawn.

**Fix:** Anchor both specs to marker geometry ('the narrow rectangular marker', 'the small square marker') and to marker size, and drop the contrastive '…not a continuous band' phrasing in favour of a positive description of each.

### [low] The farmer's own place suffix can put a boundary-flavoured word into the model's label text
`components/design/DesignGlossy.tsx:1275`

**Evidence:** overlayElementsText appends a place suffix from placeLabelFor (:1204-1225, :1263, :1275), e.g. 'Vetiver Bank (Veg garden)'. buildSatelliteOverlayPrompt strips parentheses only from matchText used for icon selection (producer-prompt.ts:462); mapNames (:528) and legendRows (:514-525) KEEP them, and rule 10 (:556) tells the model to 'Spell every label exactly as the element list gives it'. If the ring the vetiver bank sits in is named something edge-flavoured by the farmer (e.g. 'Boundary strip', 'West fence line'), that word reaches the model as part of the element's name and is a direct positional suggestion. This is a contributing channel only — it is farmer-data dependent, and I could not confirm it applies to this design.

**Fix:** Nothing to change if the suffix is benign; if this design's ring is named after an edge, that is the immediate trigger and the name should be checked first. Structurally, keep the place suffix in the legend but strip it from the map-label text, or carry place as structured data rather than concatenated into the name.

<details><summary>Refuted — do not re-chase</summary>

- **Nothing in the code puts anything on the WEST edge — the west bias is sheet-layout asymmetry, not data** — The line citations mostly check out (drawMarks 429-694; buildComposite 696-~730 adds only the satellite bitmap; OVERLAY_PANEL_RATIO=0.28 at :915; panel on the right at :944; no ground-feature branch, :521; rule 12 at producer-prompt.ts:560), but both the headline and the causal story fail.

(a) Something IS drawn on the west edge in this very path. DesignGlossy.tsx:449-460 strokes the full boundary ring in rgba(140,235,106,0.9) at 3 px — a closed bright-green line running the entire perimeter, w

</details>

## driveway-house — 5 confirmed

### [high] Overlay composite draws no driveway at all — the model must locate a near-black fill by eye, and the nearest dark thing is our house slab
`components/design/DesignGlossy.tsx:365`

**Evidence:** OVERLAY_COMPOSITE_MARKS sets showDrivewayMark:false (line 373) and showDrivewayEdge:false (line 374). drawMarks guards the entire driveway block on `if (showDrivewayMark && refLayers.driveway.length >= 2)` (line 483), so neither the #3B3A3E carriageway (499/517) nor the cream kerb casing (502/512, rgba(233,229,221,0.92)) is drawn. Yet producer-prompt.ts:540 rule 2 lists '(3) the tar driveway fill' as one of the seven things the model draws, and FINAL CHECK (4) at :566 demands 'driveway near-black'. The model has no marker for the driveway's extent and infers it from photographic darkness.

**Fix:** Either (i) drop 'the tar driveway fill' from rule 2's whitelist so the model never paints a near-black region it cannot locate, or (ii) re-enable showDrivewayEdge (and showDrivewayMark) for this style but draw kerb-only: the cream 5px casing at 502-505/510-515 with the #3B3A3E fill/stroke skipped, so the model gets exact extents without a black slab in the input.

### [high] The house is drawn into the overlay composite as a dark, dark-outlined slab that is the same colour family as tar
`components/design/DesignGlossy.tsx:472`

**Evidence:** drawMarks 465-477 fills the house ring rgba(58,53,44,0.55) and strokes it rgba(58,53,44,0.95). showHouseMark defaults true and OVERLAY_COMPOSITE_MARKS does not disable it. Composited at 55% over a typical roof pixel this resolves to ~#514D45 (light roof) or ~#413E37 (dark roof); ΔE76 to photo tar (~#2E2E30) is 15.4 and 9.5 respectively, and to our own driveway #3B3A3E is 11.3 and 7.4. The outline is the same dark colour as the fill, so it adds no separating edge. This is the single dark blob rule 8 is asking the model to keep apart from tar it cannot see.

**Fix:** Use the canonical house grey with a bright outline: fillStyle `${GROUND_FEATURES.house.color}8C` (#8A8D91, ΔE76 33.9 from #3B3A3E) and strokeStyle '#FFFFFF' at 3px — matching what the blueprints already do (they stroke the house white at 2620/3085/3150). One-line change; it removes the merge from the input rather than asking the model to undo it.

### [high] On every non-overlay path the driveway is painted over the house with no clip, no gap and round caps — the two shapes are merged in the input by construction
`components/design/DesignGlossy.tsx:483`

**Evidence:** drawMarks draws the house at 465-477 and then the driveway at 483-522 with an opaque fill/stroke and ctx.lineCap='round' (485). Same order in the blueprints: house then driveway at 2734/2735, 2941/2942, 3085/3086, 3150/3151, 3290/3291, 3575/3576 (only the zones sheet at 2616/2620 reverses it). Nothing clips the house out. A driveway traced to a garage door therefore overpaints the roof polygon, and the round cap projects ~half a carriageway (roadW/2, up to 23px at line 509) past the last traced point into it. Colour difference where they meet: composite #3A352C vs #3B3A3E = ΔE76 9.1; blueprint rgba(58,63,74,.9) vs #2A2A2E = ΔE76 10.5.

**Fix:** Before the driveway draw, clip the house out: build a path of the full canvas rect plus the house ring and ctx.clip('evenodd'), so the carriageway can never enter the roof. Cheaper alternative: after the driveway draw, re-stroke the house ring in cream at 3-4px, giving a hard light kerb between the two dark shapes. Do it inside drawMarks and drawBlueprintDriveway so all seven call sites inherit it.

### [high] Three different driveway colours ship simultaneously; the drawn colour, the legend swatch and the prompt palette all disagree
`components/design/DesignGlossy.tsx:2063`

**Evidence:** drawBlueprintDriveway fills/strokes #2A2A2E (2063, 2074) and three legend builders use #2A2A2E (2883, 3105, 3202), while drawMarks uses #3B3A3E (499, 517), sheetLegendRows uses #3B3A3E (3895), GROUND_FEATURES.driveway is #3B3A3E (lib/design-elements.ts:88, commented 'canonical in DesignGlossy'), and the prompt palette declares 'near-black tar #12140F' (lib/producer-prompt.ts:284). ΔE76 #3B3A3E↔#2A2A2E = 7.5, #3B3A3E↔#12140F = 19.5. Roof slate #3C4247 (producer-prompt.ts:534) sits at ΔE76 4.2 from #3B3A3E and 10.7 from #2A2A2E — i.e. the driveway colour we draw is closer to the roof colour we specify than to the tar colour we specify.

**Fix:** Export one TAR constant sourced from GROUND_FEATURES.driveway, use it at 499/517/2063/2074 and in every legend swatch, and interpolate it into the prompt palette string at producer-prompt.ts:284 and into FINAL CHECK (4) so the instructed tar is literally the drawn tar. Pick the dark end (#12140F-ish) if the goal is maximum separation from slate #3C4247 — at #3B3A3E the two are 4.2 apart, which is indistinguishable.

### [high] Rule 2 orders a tar fill that drivewayRule forbids, so the model resolves the contradiction by painting dark
`lib/producer-prompt.ts:540`

**Evidence:** Rule 2 (line 540) whitelists '(3) the tar driveway fill' as something the model draws on every sheet; drivewayRule (488-490) says on non-'all' sheets 'no bold outline, no dark fill and no label of its own — it is background here', and even on 'all' says 'no dark fill laid over it'. FINAL CHECK (4) at :566 then re-orders 'driveway near-black'. Three instructions, two of them demanding the dark fill the third forbids. The audit already recorded this (docs/LAYER-AUDIT-2026-07-20.md, 'all' section, finding 2) and it is unchanged.

**Fix:** Delete item (3) from rule 2's whitelist and the 'driveway near-black' clause from FINAL CHECK (4), leaving drivewayRule as the single statement. Gate the whole driveway vocabulary on a hasDriveway boolean derived from refLayers.driveway.length >= 2, as the audit specified. This is prompt work, so treat it as cleanup after the input-side fixes, not as the fix.

<details><summary>Refuted — do not re-chase</summary>

- **No separating mark is ever specified or drawn between roof and tar — only a colour difference, and the sheet is judged at postcard size** — Read lib/producer-prompt.ts:530-566 and components/design/DesignGlossy.tsx:334-522, 700-720, 4995-5005, app/design/page.tsx:641-657. The claim fails on both halves.

1) FALSE that "no separating mark is ever specified". Rule 8 itself (producer-prompt.ts:552) names two non-colour devices: the roof "has ridges, hips and pitched planes" and "it casts a shadow", set against the driveway as "a smooth tar surface at ground level". A cast roof shadow is precisely the "drop shadow gap" the evidence says

</details>

## studio-only — 7 confirmed

### [high] No boundary chip exists — the Studio cannot originate the one layer every sheet measures against
`components/design/DesignPalette.tsx:72`

**Evidence:** `const GROUND_FEATURE_KINDS: GroundFeatureKind[] = ['house','patio','driveway','lawn','veg_garden','orchard','cleared']` — seven kinds, no boundary. The type itself (lib/design-canvas.ts:41) has the same seven. The Base step's boundary sub-step is `{ id: 'base-boundary', arm: null, done: (_s, ctx) => ctx.hasBoundary }` (lib/design-substeps.ts:76-81) whose instruction reads 'go back to the main map and trace it first'. Contrast base-house at :84-91, which already accepts either source: `done: (s, ctx) => ctx.hasHouse || hasFeature(s, ['house'])`. DesignWizard.stepHasContent('base') is `refLayersPresent.boundary && refLayersPresent.house` (DesignWizard.tsx:64), fed from refLayers only (app/design/page.tsx:1283-1284), so a Studio-only farmer can never tick the Base step. runZoneAdvice hard-refuses with 'Trace your boundary on the main map first.' (app/design/page.tsx:1050-1052).

**Fix:** Add 'boundary' to GroundFeatureKind (design-canvas.ts:41), GROUND_FEATURE_KINDS (DesignPalette.tsx:72) and GROUND_FEATURES (design-elements.ts:85) with the existing fence green #8CEB6A; arm it from base-boundary (`arm: { kind: 'area', feature: 'boundary' }`, done: `ctx.hasBoundary || hasFeature(s, ['boundary'])`); exclude it from drawBlueprintGround's wash list since it feeds drawBlueprintBoundary's ticked-line style instead. Do NOT repurpose LineShape kind 'fence' for this — it is a polyline with no closure flag and is already drawn as violet internal fencing, so promoting it would silently reclassify internal fences on live designs.

### [high] computeCanvasFrame does not read refLayers.boundary — the satellite fit is upstream and cannot take a Studio boundary without a re-normalise round trip
`app/design/page.tsx:650`

**Evidence:** `const { frame: frameNoImg, url, project } = computeCanvasFrame(merged.layers, lat, lon)` — the argument is main-map DesignLayer[] in lng/lat space (lib/design-canvas.ts:328 → getBounds → fitZoom). refLayers is built on the NEXT lines (652-659) by pushing those same layers' rings through the returned `project()`. So the fit → refLayers dependency is one-directional. A Studio ZoneShape's points are already normalised against `state.frame`, i.e. they only exist because a frame was already chosen; feeding them back into the fit is circular.

**Fix:** Do not attempt this in v1. If a 'Fit photo to my boundary' feature is wanted later, the machinery exists: makeMercatorUnprojector(state.frame…) (design-canvas.ts:225) to lift the Studio ring back to lng/lat, synthesize a DesignLayer, recompute the frame, then migrateStateToFrame (design-canvas.ts:271) to re-normalise the whole design. Gate it behind an explicit one-shot button, never the automatic refresh() path — otherwise the refit changes the frame, which re-normalises the boundary, which refits, and the effect at app/design/page.tsx:606-660 also refetches the satellite each time (its lastFetchedFrame guard only suppresses the fetch, not the recompute).

### [high] zoneFillPolys uses only refLayers.house as the Zone-0 cutter, so a Studio house ring never protects the roof from the Zone 1 wash
`components/design/DesignGlossy.tsx:287`

**Evidence:** `if (z.zone !== 0 && refLayers.house.length >= 3) cutters.push([refLayers.house]);` — and the loop above it skips every ring with a `feature` tag (`if (other.id === z.id || other.feature || other.points.length < 3) continue;`, line 283). A Studio-traced or adopted house is a ZoneShape with `feature: 'house'`, so it is excluded from both branches. zoneFillPolys is called from buildZoneOverlay (1414), the Zones blueprint (2566) and drawMarks (532).

**Fix:** Take the resolved house ring (below) instead of refLayers.house here. Note this is a visible rendering change for existing users whose designs already contain an adopted house ring: the Zone 1 wash will stop painting over their roof. That is the audit's zones/A/broken fix and is desirable, but it should be called out in the release note rather than shipped silently.

### [high] Recommended resolution rule: per-slot Studio-wins with sourceFeatureId dedupe, in one pure resolver
`app/design/page.tsx:659`

**Evidence:** `setRefLayers({ boundary: boundaryRing, house: houseRing, driveway: driveLine, drivewayClosed: driveIsArea })` is the single producer of the value. Every downstream type is structurally identical and independently declared — RefLayers (app/design/page.tsx:239), DesignPrint's local RefLayers (DesignPrint.tsx:38-43), LabelRefLayers (producer-labels.ts:16), PhasingRefLayers (phasing.ts:35), and water-system's inline literal (water-system.ts:448). None of them names a source. adoptTracedLayer already stamps `sourceFeatureId: src` onto adopted shapes (DesignCanvas.tsx:345), and adoptedFeatureIds (DesignCanvas.tsx:301) already reads it back, so exact identity between a Studio ring and its map original is recoverable.

**Fix:** Add `lib/base-layers.ts` exporting `resolveBaseLayers(state, refLayers) -> { boundary, house, driveway, drivewayClosed, source: Record<'boundary'|'house'|'driveway', 'studio'|'map'|'none'> }`. Per slot: (1) largest state.zones ring with the matching `feature` wins; (2) else refLayers; (3) else empty. Dedupe first: if the winning Studio ring's sourceFeatureId equals the featureId the map layer came from, they are the same object — keep the Studio copy (the farmer may have reshaped it) and drop the map one, so nothing is drawn twice. Do not union: a union of two rings describing one building is lumpy and double-darkens the fill, and buildDesignBrief (DesignGlossy.tsx:1042) already asserts there is exactly one house. To carry the dedupe you must also stash the source featureIds on RefLayers at app/design/page.tsx:659 (boundaryLayer?.featureId, houseLayer?.featureId, driveLayer?.featureId). Then swap the value in at the ~6 entry points — DesignGlossy's props (4137), DesignPrint's renderPage (142), buildPhasePlan, deriveWaterSystem, producerLabels, layerContentCount — not at 116 individual read sites.

### [high] The NEITHER case is currently a lie, not a graceful degrade — several legend rows and the plotBox fallback assert geometry that isn't drawn
`components/design/DesignGlossy.tsx:2603`

**Evidence:** drawBlueprintBoundary returns early on `boundary.length < 3` (line 2172) so nothing is drawn — but the Zones legend at 2645-2659 sizes itself `zoneNums.length + 3 + 2.2` and unconditionally emits Fence and Driveway rows, and DesignPrint.legendRows (DesignPrint.tsx:110-117) returns a fixed three-row key ('Property boundary', 'House / roof', 'Driveway (tar)') for the base sheet regardless of what exists. layerContentCount grants the masterplan a free +1 on boundary alone (DesignGlossy.tsx:265), so an otherwise-empty design still renders sheet 07. plotBox(refLayers.boundary) (producer-labels.ts:171, DesignGlossy.tsx:1706) with an empty ring yields whatever the helper's degenerate branch gives, and every compass word on the sheet is computed from it.

**Fix:** Define the no-base contract explicitly in the resolver's `source` field and honour it: source==='none' ⇒ no boundary line, no boundary legend row, boundaryPx undefined (no AI clip — DesignGlossy.tsx:4483, 4784, 4917), and plotBox falls back to the bounding box of the drawn content (items+zones+lines) rather than the full frame, so 'NORTH-WEST orchard' still means something. Also drop the free +1 at :265 so a design with nothing but a boundary refuses sheet 07 rather than printing a confident empty page.

### [high] Backwards compatibility is good at the storage layer, but adoptTracedLayer already created duplicate house rings on live designs
`components/design/DesignCanvas.tsx:377`

**Evidence:** `case 'roof': case 'structure': return addZone(0, 'house');` — every farmer who ever tapped 'Use in design' on a traced roof already has a ZoneShape with feature 'house' AND a populated refLayers.house describing the same building. Under a naive 'Studio wins, draw both' rule they get a double-darkened roof; under 'Studio wins, drop map' they keep correct geometry but must still be fed into the same slot so drawBlueprintHouse's above-planting stacking order survives. The resolver is pure derivation — nothing persisted changes shape, no schema bump, no migration, and design-canvas-sync's rev-first ranking is untouched — so storage compatibility is total.

**Fix:** The sourceFeatureId dedupe handles this exact case correctly and it is the reason to build it rather than a naive length check. Feed the resolved ring into the SAME slot the map ring used, so drawBlueprintHouse (not drawBlueprintGround) draws it and the stacking order is unchanged. Then delete the house/driveway special-case from drawBlueprintGround entirely — once the resolver has decided, the draw helper should not be re-deciding.

### [high] An adopted driveway becomes a walking path, so the Studio can never produce a driveway by adoption
`components/design/DesignCanvas.tsx:380`

**Evidence:** `case 'access': { … const line: WithSource<LineShape> = { id: newId(), kind: 'path', points: layer.points, sourceFeatureId: src }; }` — a traced access layer adopted into the Studio becomes LineShape kind 'path', which is drawn gold and legended 'Walking path' (DesignGlossy.tsx:1309). Meanwhile the same map layer independently feeds refLayers.driveway (app/design/page.tsx:646-658), which is drawn dark tar and legended 'Tarred driveway'. So adopting your driveway gives you a footpath on top of your driveway.

**Fix:** Change the 'access' branch to produce a ZoneShape with feature 'driveway' when the source geometry is a polygon (mirroring driveIsArea at app/design/page.tsx:655), and keep the path line only for genuine polylines. Existing designs keep their 'path' lines — this only affects future adoptions — so it is additive.

<details><summary>Refuted — do not re-chase</summary>

- **The in-progress drawBlueprintGround fix is dead code — one caller, and it doesn't pass refLayers** — The claim's core factual assertion is contradicted by the source. `grep -n drawBlueprintGround components/design/DesignGlossy.tsx` returns the definition at 2113 plus FOUR call sites — 2576, 2940, 3076, 3146 — and every one of them passes `refLayers` as the sixth argument (`drawBlueprintGround(ctx, state, px, py, W, refLayers);`). Those four sit inside buildBlueprintZoneMap (2548), buildBlueprintWaterMap (2920), buildBlueprintPlantingMap (3054) and buildBlueprintStructuresMap (3123) respectively
- **Consumer inventory: 116 read sites, ~19 distinct consumers, all normalised-space and all source-agnostic** — The 116 count is independently confirmed (grep -Eo over app/components/lib/types gives exactly 44 refLayers.boundary + 40 refLayers.driveway + 28 refLayers.house plain, plus 4 optional-chained at DesignGlossy.tsx:2123,:2124 and water-system.ts:467,:468), and "all normalised-space" holds (project() returns normalised [0..1], lib/design-canvas.ts:322/393; ZoneShape.points is commented "normalised ring", design-canvas.ts:46). But the two load-bearing assertions are false.

(1) "All source-agnostic 
- **Staged plan — first step is one file and ships visible value** — Four independent failures. (a) STALE PREMISE: there is no working-tree change to finish — `git status` is clean and HEAD ac566ff ("fix(sheets): the ground you trace in the Studio now appears on every sheet") already landed the two headline stage-0 items. drawBlueprintGround takes refLayers and gates house/driveway conditionally (DesignGlossy.tsx:2113-2130), and is already called from Zones (:2576), Water (:2940), Planting (:3076) and Structures (:3146). The cited call site :3060 is stale; it is 

</details>

## ground-everywhere — 13 confirmed

### [high] Membership matrix: which ground kinds are CONTENT vs CONTEXT on which sheet
`lib/design-canvas.ts:41`

**Evidence:** GroundFeatureKind = house | patio | driveway | lawn | veg_garden | orchard | cleared (design-canvas.ts:41). None of itemInFilter / lineInFilter / zonesInFilter (lib/glossy-filters.ts:63,71,86) has any concept of them, so there is no membership answer in code today — the audit calls this 'a missing dimension in the membership model' (docs/LAYER-AUDIT-2026-07-20.md §1c). Rory's requirement is presence on every layer; what must vary per sheet is REGISTER, not presence.

**Fix:** Add to lib/glossy-filters.ts, beside sheetForElement:

  export type GroundRegister = 'content' | 'context' | 'hidden';
  const SOFT: GroundFeatureKind[] = ['lawn','veg_garden','orchard'];
  const HARD: GroundFeatureKind[] = ['patio','cleared','driveway','house'];
  export function groundRegister(kind: GroundFeatureKind, filter: GlossyLayerFilter): GroundRegister

returning this matrix (no 'hidden' anywhere — every kind is drawn on every sheet):

  zones(03):      house→content (it IS Zone 0, see :2620/:2641 badge+row); all six others→context.
    Why: the sheet asserts distance-from-house. The reader's falsification test is 'is my veg garden really in Zone 1' — he must SEE the veg garden, but the sheet is not claiming anything about it.
  water(04):      all seven→context.
    Why the orchard belongs here even though it is not water: a drip run that stops in bare satellite is unreadable; the orchard/veg garden are the drip line's DESTINATION and the patio is what the pipe runs under. Context is exactly the right register — shown, not legended as water infrastructure.
  planting(05):   lawn, veg_garden, orchard→content; house, driveway, patio, cleared→context.
    Why: the vegetated rings ARE recorded planting (the audit's own planting/polish finding argues a ground-only planting sheet should render rather than be refused).
  structures(06): house, driveway, patio, cleared→content; lawn, veg_garden, orchard→context.
    Why: this is the built-surfaces sheet (audit structures/both/wrong at :3034 says paving and cleared are missing from the one sheet about built ground).
  all(07):        all seven→content. It is the integrated sheet; nothing on it is 'someone else's subject'.
  base(01)/sector(02)/implementation(08): all seven→content on 01 (existing fabric IS sheet 01), context on 02 and 08.

NOTE this supersedes the audit's fix note at docs/LAYER-AUDIT-2026-07-20.md line 294 ('restrict the planting sheet's ground pass to the vegetated kinds'). That was written before Rory's 'contained in all layers including patio lawn all these things'. Restrict the REGISTER, not the pass.

### [high] Render the two registers differently, or 'context on every sheet' just becomes noise on every sheet
`components/design/DesignGlossy.tsx:2143`

**Evidence:** drawBlueprintGround currently draws one way for everyone: soft kinds get `${meta.color}99` fill (:2144), hard kinds `${meta.color}55` plus a colour hatch (:2144-2160), and every ring gets a `${meta.color}F2` 2.5px outline (:2163-2165). At 99/F2 an orchard wash on the WATER sheet competes with the tanks and routes, which is the reason the original author excluded ground from every sheet but planting in the first place.

**Fix:** Give drawBlueprintGround a register argument and two visual specs:

  content: fill `${meta.color}99` (soft) / `${meta.color}55`+hatch (hard); outline `${meta.color}F2` @2.5px — i.e. exactly today's treatment.
  context: fill `${meta.color}4D` (soft) / `${meta.color}26`+hatch at half opacity (hard); outline `${meta.color}80` @1.5px, and NO hatch on rings smaller than ~2% of frame area (hatch at low alpha is mud).

Signature:
  function drawBlueprintGround(ctx, state, px, py, W, refLayers, filter: GlossyLayerFilter): void
and inside, per ring: `const reg = groundRegister(z.feature!, filter)`. Passing `filter` rather than a register keeps the per-kind split (structures wants patio bold AND orchard quiet on the same sheet) — a single per-call register cannot express that.

### [high] Draw order: one canonical stack, and a promotion rule so a Studio-traced house is never buried
`components/design/DesignGlossy.tsx:3076`

**Evidence:** The working-tree diff draws ground at step 1b/2 on all four builders — zones :2576 (before the zone washes), water :2940 (before house/driveway/water infra), planting :3076 (before footprints), structures :3146 (before house/driveway/lines/footprints). That is correct for the six non-house kinds. It is WRONG for the house: when refLayers.house is empty (the common Studio case, per the audit's §1c table), houseCovered is false at :2124 so the house ring is now painted at step 2 — underneath the planting footprints at :3079. The original docblock's whole point (HEAD version, 'the house must sit ABOVE planting so canopies can't crop the roof') is silently defeated on exactly the designs the fix was written for. Same for a Studio driveway under the structures line pass at :3163-3181.

**Fix:** Split the pass in two and keep ONE stack for all four builders:

  1. await drawBlueprintBase(ctx, frame, W, H)
  2. drawBlueprintGround(ctx, state, px, py, W, refLayers, filter)   ← soft pass then hard pass, EXCLUDING house+driveway; two sorted sub-passes (soft biggest-first, then hard biggest-first) so a patio inside a lawn is never buried by it. Replace the single `sorted` loop at :2132-2166.
  3. zone washes (buildBlueprintZoneMap :2578-2613 only; masterplan via drawMarks)
  4. layer content — drawWaterInfrastructure :2943 / bySizeDesc footprints :3079, :3184 / the structures LINE_STYLE pass :3163
  5. drawBlueprintBuiltFabric(ctx, state, refLayers, px, py, pxPerM, filter)  ← NEW. Draws house then driveway from refLayers when present, else from the ZoneShape rings tagged 'house'/'driveway'. Internally it calls the existing drawBlueprintHouse (:2029) / drawBlueprintDriveway (:2050) with the ring it resolved, so per-sheet fill/stroke/dashedEdge stay the caller's choice exactly as their docblocks promise. This REPLACES the four pairs of direct calls at :2616+:2620, :2941+:2942, :3085+:3086, :3150+:3151.
  6. drawBlueprintLabelPills(... producerLabels(...)) — :2805, :3091, and (audit structures/A/confusing) a new one on structures after :3186
  7. drawBlueprintBoundary — :2623, :2944, :3094, :3189
  8. title / legend / scale / north

The invariant to state in drawBlueprintBuiltFabric's docblock: ground never draws above this sheet's own content — that is the definition of context — and house/driveway are the two kinds exempt from it, which is why they leave the ground pass entirely rather than being conditionally skipped. That also deletes the houseCovered/drivewayCovered branch at :2122-2130, whose only job was to paper over the missing promotion.

### [high] Ground is now drawn on water/zones/structures with no legend row at all — groundRows is still planting-only and still excludes house+driveway
`components/design/DesignGlossy.tsx:2491`

**Evidence:** groundRows(state) at :2491-2502 filters `z.feature !== 'house' && z.feature !== 'driveway'` and its docblock says 'same exclusions, same order' as drawBlueprintGround — a promise the working-tree diff has already broken. It is called from exactly one site, :3103 (planting `fixed`). So after the diff: the zones sheet paints lawn/patio/orchard washes and its hand-drawn legend (:2655-2698) never mentions them; the water sheet paints them and its legend comes from sheetLegendRows (:3851) via composeStyleSheet (:3898), which has no ground branch either; the structures sheet paints them and `fixed` at :3197 has no ground rows.

**Fix:** Rewrite as `groundRows(state, refLayers, filter): BlueprintLegendRow[]` — derived from the same predicate the draw uses, so the two cannot drift (audit RC5). It must (a) include house and driveway rows when drawBlueprintBuiltFabric resolved them from ZoneShape rings, (b) dedupe by label as it already does at :2501, (c) tag each row with its register so the caller knows what is compressible. Then call it from all four builders and from sheetLegendRows (:3851) and DesignPrint.legendRows (DesignPrint.tsx:111).

### [high] Legend rule per sheet: fixed vs compressible, and never a hard-coded ground block again
`components/design/DesignGlossy.tsx:3103`

**Evidence:** Planting currently does `const fixed = [...groundRows(state)]` at :3103 with the comment 'Ground rows are fixed rather than compressible'. The audit's planting/polish finding (docs/LAYER-AUDIT-2026-07-20.md:244) shows that exempting them from the capacity budget lets many named rings push every species row out and overrun the panel — fitLegendRows (:2532) computes `budget = capacity - fixed.length` and never clamps `fixed` itself.

**Fix:** Rule: a ground row is FIXED iff groundRegister(kind, filter) === 'content'; CONTEXT ground rows are compressible and collapse to ONE row before any content row is dropped.

  planting :3103 — fixed: lawn/veg_garden/orchard rows (each, named). compressible: house/driveway/patio/cleared → one row 'Existing built areas'.
  structures :3197 — fixed: house / driveway / patio / cleared rows. compressible: the vegetated rings → one row 'Existing planted areas'.
  water — via sheetLegendRows :3851 + composeStyleSheet :3898: ALL ground compressible; emit individual rows only when ≤2 distinct kinds are present, otherwise one 'Existing site fabric (traced)' row.
  zones :2655-2698 — the house ring folds into the existing 'ZONE 0' row (it is the same object); everything else → one 'Existing site fabric (traced)' row. While in this block, apply the audit's zones/A/wrong fix: the 'Fence / site boundary' row at :2686 and 'Tarred driveway' at :2692 are unconditional today and must be guarded on refLayers.boundary.length>=3 / a resolved driveway ring, with lgH at :2653 sized from the actual row count instead of the hard-coded `+3`.
  all(07) — DesignPrint.tsx:111: an 'EXISTING' section, all rows, per audit all/both/wrong.

Mechanically: extend fitLegendRows (:2532) to take three lists — `content`, `fixedContext`, `compressibleContext` — and compress the third to a single '+N existing areas' row before it starts dropping content rows. That is one edit that also closes the audit's planting/A/polish overrun.

### [high] Path B, the direct answer: BOTH drawn and named — but named in a third register, because rule 7 makes drawn-but-unnamed strictly worse than absent
`lib/producer-prompt.ts:550`

**Evidence:** Rule 7 (:550): 'That list is the COMPLETE contents of this <LAYER> sheet … Anything not named there belongs on a different sheet and is simply absent here.' Rule 5 (:546): 'Each small, hard-edged coloured shape already on the photograph marks where one designed element goes … Ground with no marker keeps its untouched photograph and gets nothing.' So the three options resolve as: DRAWN-ONLY → the model is told the wash is not part of the sheet while plainly seeing it, and rule 5 tells it to convert the wash into an invented pictorial element — this is the exact mechanism the audit documented for the zone bands (zones/B-ai/broken, producer-prompt.ts:514). NAMED-ONLY → nothing anchors it, so the model invents the orchard somewhere plausible and wrong. BOTH is the only safe option, and the codebase already proves it: the zoneBands clause at :500-502 is precisely this pattern — drawn in the composite (DesignGlossy.tsx:526-565), named in overlayElementsText (:1290-1301), and given an explicit rule that exempts it from rule 5 and grants it its own lettering.

**Fix:** Copy the zoneBands pattern verbatim for ground, in four coordinated edits (all four ship together or none do):

(1) COMPOSITE — new ground branch in drawMarks (DesignGlossy.tsx:429), inserted between the driveway block ending :522 and the zone block at :526, so ground sits under zones, lines and items. Critically it must run when drawDesign is FALSE as well (traced ground is not design), because DesignPrint.tsx:72 renders printed sheet 01 'Existing Site & Base' through buildComposite(...,'all',false) — sheet 01 is the one page whose entire subject is existing fabric and it currently shows only refLayers boundary/house/driveway. Visual signature must be UNMISTAKABLY not-a-marker: large, soft-edged, low alpha (`${meta.color}33`), NO tool glyph, no crisp outline — the same discriminator the prompt already relies on to tell zone bands from element markers.
(2) ELEMENT LIST — overlayElementsText (:1235) gains a fabric section (see next finding).
(3) PROMPT — buildSatelliteOverlayPrompt (:433) gains a siteFabric clause (see next finding).
(4) RULE 7 — narrow the completeness claim at :550 from 'the COMPLETE contents of this sheet' to 'the complete DESIGNED contents of this sheet — everything this sheet ADDS to the site', and add '…the site's existing traced areas are listed separately below and are not designed elements.' Without (4), (2) and (3) contradict each other and the model resolves the contradiction by inventing, exactly as it did on zones.

### [high] overlayElementsText must return fabric as a SEPARATE channel, not another '»' section — the empty-brief refusal depends on it
`components/design/DesignGlossy.tsx:1235`

**Evidence:** overlayElementsText returns a single delimited string (:1335-1336) that buildSatelliteOverlayPrompt then (a) tests for emptiness to refuse an invented sheet (producer-prompt.ts:451-455), (b) regexes for icon matching (:462-463), (c) expands into literal legend rows (:514-525), and (d) flattens into on-map label spellings (:528). Fabric must feed only (c)-partially and none of (a),(b),(d): a sheet whose ONLY content is traced ground is still an empty LAYER and must still refuse; 'Veg garden' fires ICON_MATCH.bed (/bed|garden|veg/i, producer-prompt.ts:418) and 'Orchard / food forest' fires ICON_MATCH.tree (/tree|orchard|fruit/i) — the identical trap the audit flagged for zone rows at LAYER-AUDIT line 29.

**Fix:** Change the return type to `{ elements: string; fabric: string }` and update both call sites (DesignGlossy.tsx:4996 in generateAllViaQueue and :5085 in generateOneViaQueue) plus the buildSatelliteOverlayPrompt args object.

`fabric` is built from the same rings the composite drew, biggest-first, deduped by label, using `z.name ?? GROUND_FEATURES[z.feature!].label` — reuse groundRows so the AI legend and the exact legend cannot drift (audit planting/B-ai/wrong fix note). Format: 'Orchard / food forest, Lawn, Patio / paving, Tarred driveway'.

Guarantees the split buys, stated as invariants worth a unit test:
  • producer-prompt.ts:451 keeps testing `elements` only → a fabric-only design still refuses.
  • matchText at :462 is built from `elements` only → no ground name can ever fire an ICON_MATCH regex.
  • mapNames at :528 is built from `elements` only → context ground never gets an on-map label on a layer sheet.
  • legendRows at :514 appends an 'EXISTING' section from `fabric` ONLY when groundRegister says content for that sheetKind (i.e. sheetKind 'all', plus the vegetated rings on 'planting' and the built rings on 'structures'); on 'water' and 'zones' the fabric is drawn and declared but gets no legend row, matching the deterministic sheets.
Also apply the audit's all/polish sanitisation here: strip ',', '|' and '»' from farmer-typed z.name before it enters either string (producer-prompt.ts:482 finding).

### [high] The prompt clause: a siteFabric block modelled line-for-line on zoneBands, plus a rule-2 whitelist item and a rule-5 exemption
`lib/producer-prompt.ts:500`

**Evidence:** zoneBands (:500-502) already does exactly this job for the other class of translucent area, and it is wired into three places: rule 2's whitelist gets item (8) at :540, rule 5 gets an inline exemption at :546, and rule 14's lettering whitelist gets the badges at :564. Ground has no equivalent anywhere; drawing it into the composite without one reproduces the zones failure on every sheet.

**Fix:** In buildSatelliteOverlayPrompt (:433), after the zoneBands const at :500, add:

  const siteFabric = fabric.trim() ? `\n\nEXISTING SITE FABRIC — WHAT IS ALREADY THERE, NOT PART OF THIS DESIGN. The large, soft-edged, low-opacity tinted areas on the photograph are ground the farmer has already traced and named: ${fabric}. They are AREAS OF EXISTING GROUND, never placement markers: redraw each one as the real surface it is, in place, keeping its exact outline — lawn as even mown grass, orchard and veg garden as the planting already visible in the photograph there, patio and paving as clean flat slab, cleared ground as bare earth, driveway as quiet grey tar. Nothing is invented inside one and no pictorial icon is placed on one${fabricIsContent ? '. Give each one a small white caption with its name, and one legend row each under an EXISTING heading' : ' — on this sheet they carry no label and no legend row of their own; they are context that lets the reader place this layer on the real site'}.` : '';

where `fabricIsContent = sheetKind === 'all' || sheetKind === 'planting' || sheetKind === 'structures'` (mirroring groundRegister — better still, import it).

Then wire it exactly as zoneBands is wired:
  • :540 rule 2 whitelist — append `${siteFabric ? ', (9) the existing traced ground areas (see the EXISTING SITE FABRIC rule below)' : ''}` after the zone-bands item.
  • :546 rule 5 — extend the existing parenthetical so it excludes BOTH classes: '…and never the large soft translucent zone bands or the existing-ground areas, which are areas of land'. Today it names only the zone bands, so a ground wash still falls under 'each coloured shape marks where one designed element goes'.
  • :554 rule 9 — append `${siteFabric}` alongside `${waterSystems}${zoneBands}`.
  • :564 rule 14 — add the fabric captions to the permitted-lettering list, but only when fabricIsContent.
  • :566 FINAL CHECK (3) — it currently reads 'there is not a single tree, shrub or bed on the sheet that has no marker under it', which on a planting sheet orders the model to delete a traced orchard it was just told to keep. Scope it: '…no NEW tree, shrub or bed has been added that has no marker under it; trees already visible in the photograph, and the existing traced areas listed above, stay exactly as they are.' (This is also the audit's all/B-ai/wrong fix at LAYER-AUDIT line 354, which the fabric change makes mandatory rather than optional.)

### [high] sheetLegendRows has no ground branch, so the water Blueprint and every AI-style sheet legend omit ground that is now painted on them
`components/design/DesignGlossy.tsx:3851`

**Evidence:** sheetLegendRows (:3851-3891) emits zones, grouped items, line kinds and the driveway — no ground. It is the legend for buildBlueprintWaterMap (via composeStyleSheet at :2946-2957) and for every composeStyleSheet call on the AI paths (:4516, :4953). buildBlueprintWaterMap now draws ground at :2940, so the exact water sheet paints washes its own legend cannot explain.

**Fix:** Insert a ground block into sheetLegendRows immediately after the zones block (:3856-3866) and before the item groups, calling the rewritten `groundRows(state, refLayers, filter)`, compressed per the per-sheet rule. Placing it before items keeps the panel reading base-fabric → design, which matches the draw order. While there, apply the audit's water/A/confusing note: these rows use style 'fill' and must carry the same colour the wash was painted in (GROUND_FEATURES[kind].color), not a substitute.

### [high] layerContentCount still ignores ground, so the guard and the payload disagree in both directions
`components/design/DesignGlossy.tsx:252`

**Evidence:** layerContentCount (:252-267) counts effort-zones, filtered items, filtered lines, and boundary-on-'all'. Ground rings are counted nowhere. Two consequences once ground draws everywhere: a farmer who has traced an orchard and a veg garden but placed no trees is still refused the planting sheet with emptyLayerMessage (audit planting/A/polish); and on path B a sheet can now pass the guard, be drawn with fabric in the composite, and still hand buildSatelliteOverlayPrompt an empty `elements` string, hitting the refusal at producer-prompt.ts:451 after the composite has been built.

**Fix:** Add `n += state.zones.filter(z => z.feature && z.points.length >= 3 && groundRegister(z.feature, filter) === 'content').length` — CONTENT rings only. Context ground must never make a layer non-empty: an orchard does not give you a water plan. That single line makes the guard agree with both the draw and the element list, which is the property the audit's RC2 is after.

### [high] DesignPrint sheet 01 'Existing Site & Base' is the sheet ground matters most on, and it renders through the one path that has no ground
`components/design/DesignPrint.tsx:72`

**Evidence:** PRINT_LAYERS[0] renders via `buildComposite(s, f, r, 'all', false)` — drawDesign=false, so drawMarks (DesignGlossy.tsx:429) draws only boundary (:452), house (:465) and driveway (:483) from refLayers, all three of which are empty for a Studio-traced site. Sheet 07 at DesignPrint.tsx:78 goes through the same function with drawDesign=true. Neither has ever shown a traced ground ring.

**Fix:** The drawMarks ground branch must be gated on the ring existing, NOT on drawDesign — put it above the `drawDesign &&` zone loop at :526 with its own guard. Then sheet 01 shows the farmer's own record of what is there, sheet 07 shows it under the design, and both come from the same code as the AI composite. Also replace DesignPrint.legendRows (:111) with sheetLegendRows per audit RC5/all-A-wrong; once ground rows live in sheetLegendRows that is the only way sheets 01 and 07 get a key for the washes.

### [medium] Two-pass sort inside drawBlueprintGround: today's single area sort lets a small lawn cover a large patio
`components/design/DesignGlossy.tsx:2133`

**Evidence:** `const sorted = [...rings].sort((a,b) => ringArea(b.points) - ringArea(a.points))` at :2133 mixes vegetated and hard rings in one biggest-first order. A 400 m2 patio drawn before a 500 m2 lawn is then washed over by the lawn at alpha 99 (:2144) — the built surface, which is the harder fact about the site, loses to the softer one.

**Fix:** Two sub-passes: soft kinds (lawn, veg_garden, orchard) biggest-first, then hard kinds (patio, cleared) biggest-first. Vegetation is the matrix; built surfaces sit in it and always read above it. This also makes the hatch land on top of any wash that overlaps it rather than under, which is what makes the hatch legible at context alpha at all.

### [high] Ordering of the work, and the cache that will hide whether it worked
`components/design/DesignGlossy.tsx:4960`

**Evidence:** saveGlossy keys on `producer:${styleKey}:${filter}` (:4960 and the sibling at the single-sheet path) with no content hash — the audit flags this at LAYER-AUDIT line 510. Pre-change sheets survive the change and get compared against post-change ones.

**Fix:** Land in this order, because each step makes the next one safe rather than merely convenient:
  1. groundRegister + the drawBlueprintGround register split + drawBlueprintBuiltFabric promotion (findings 1-3). Deterministic only, no prompt risk, immediately visible on all four exact sheets.
  2. groundRows rewrite + the four legend call sites + sheetLegendRows (findings 4, 5, 9). Now nothing is drawn without a key, and nothing is keyed without being drawn.
  3. layerContentCount (finding 10) — do it here, not earlier: before step 2 it would admit sheets that render without a legend.
  4. Path B as ONE commit: drawMarks branch + overlayElementsText split + the prompt clause + rule 7/rule 5/FINAL-CHECK edits (findings 6-8). Splitting this commit ships the zones failure again on a new class of shape.
  5. DesignPrint 01/07 (finding 11) and the test (finding 13).
Invalidate the glossy cache in the same commit as step 4 (bump the key prefix, e.g. `producer:v2:${styleKey}:${filter}`), or the QA pass compares old sheets against new ones and reports success either way.

<details><summary>Refuted — do not re-chase</summary>

- **Add the table-driven membership test the module header has been promising since extraction** — The test already exists and ships. `/Users/roryclark/ImbewuField/tests/glossy-filters.test.ts` is a 76-line, table-driven membership test — 7 tests iterating `ELEMENT_CATALOG` × `LAYER_SHEETS = ['water','planting','structures']` and `LINE_KINDS` × filters, asserting exactly-one-sheet for every element (`:15-25`) and every line kind (`:27-32`), everything on `all` (`:34-40`), the banana_circle/tree_basin/raised_bed/keyhole_bed/herb_spiral vs greywater/infiltration/half_moon/berm/terrace split (`:

</details>

## sector-ai — 7 confirmed

### [high] LEGEND_BY_SHEET (the painted-style path) has no sector entry, and M has no arrow/arc vocabulary
`lib/producer-prompt.ts:319`

**Evidence:** `LEGEND_BY_SHEET: Record<ShowcaseSheetKind, string>` (:319-325) is a total Record, so adding 'sector' to the union is a compile error until an entry exists. It is consumed at :356 by buildShowcasePrompt for the six non-satellite painted styles. Every M.* entry (:301-317) describes an OBJECT or a traced LINE ('a dusty-violet line is a farm fence'); none describes a directional arrow, an arc, or a translucent wedge. M.zones (:316) is the closest precedent and it describes an AREA.

**Fix:** Add M.sun / M.wind / M.fire / M.downhill / M.contour / M.frost written as 'the gold arc across the north edge is the midday sun path — redraw it exactly where it is, same radius, same end points' etc., and `sector: [M.sun, M.wind, M.fire, M.downhill, M.contour, M.frost].join('; ')`. Every one must say 'exactly where it already is' — these are the only marks in the app whose MEANING is their angle.

### [high] Prompt rule 1 forbids drawing outside the boundary — which is precisely where every sector arrow, the fire wedge and the compass ring live
`lib/producer-prompt.ts:534`

**Evidence:** Rule 1 (:532-538): 'OUTSIDE the boundary the supplied photograph stays exactly as it is — real, soft, slightly darker, untouched to the very edges of the sheet.' Rule 2's whitelist (:540) enumerates seven permitted marks, none of them an arrow or an arc. The sector sheet's geometry is deliberately outside: arrow tails start at `R + arrowLen*0.75` (DesignGlossy.tsx:3316), labels sit at `R + arrowLen` (:3404, :3409), the sun arc at `R + arrowLen*0.45` (:3382) and the fire wedge extends to `R*1.16` (:3357) — and R itself is sized from the boundary extent (:3283, :3293). This is the structural difference from the zone-band precedent (2ea84ec, :500-502): a zone band is an area inside the plot, so rule 1 accommodated it with one exemption clause; a sector arrow must cross the one seam the prompt calls 'THE RULE ABOVE ALL OTHERS'.

**Fix:** An AI sector sheet needs rule 1 relaxed for a whole class of overlay geometry ('the energy arrows, arcs and wedges are sheet annotation and cross the boundary freely; the photograph beneath them is still untouched'), plus rule 2 item (8), plus a rule-5 exemption in the same shape as the zone-band clause at :546, plus rule 14 permitting the compass letters N/E/S/W and the bearing labels. That is four contradicting rules to unpick in the app's most safety-critical prompt — versus zero if the arrows are composited deterministically.

### [high] The Cloud Functions worker rejects any key that is not one of the five layers — this is a deploy, not a code edit
`functions/src/index.ts:42`

**Evidence:** `const ALLOWED_KEYS = new Set(['all','water','zones','planting','structures'])` (:42), enforced at :342 `if (!ALLOWED_KEYS.has(s.key)) await safePatch(ref, s.key, { status: 'error', error: 'unknown sheet' })` and :344 which filters the sheet out of the work list. The comment at :340 names this as deliberate path scoping — the worker is the security boundary. A queued sector sheet would therefore land in the gallery as a permanent 'unknown sheet' error with no client-side hint.

**Fix:** Add 'sector' to ALLOWED_KEYS and redeploy the functions BEFORE the client ships (per project_imbewufield_render_queue.md the worker is the kill-switch/quota/path-scoping boundary). Client-side, DesignGlossy.tsx:5238 casts `sheet.key as GlossyLayerFilter` when finishing a job — that cast becomes a lie for 'sector' and needs the same decoupling as finding 1.

### [high] RECOMMENDATION — an AI sector sheet is safe only as a decorative restyle with deterministic bearings composited on top
`lib/sector.ts:23`

**Evidence:** SectorModel (:23-38) is a bearing-typed contract — windSummer.bearingDeg, fire.bearingDeg, water.downhillBearingDeg — consumed through bearingToUnitVector (:49-52) whose docblock spells out the one thing a farmer must not get wrong: 'wind blows FROM its label, so a wind arrow travels the OPPOSITE way'. A model redrawing that arrow has a coin-flip on the sense and free choice of the angle; the farmer's action from this sheet is where to plant the windbreak and where to cut the firebreak (fire.seasonNote at :90-91 literally says 'keep a firebreak on the fire side'). The model also degrades honestly — every energy is independently nullable and dataNotes (:37, rendered at DesignGlossy.tsx:3514) carries the caveat. An image model cannot represent 'this arrow is absent because the wind data did not load'; it will draw a plausible one. Precedent is already established in this repo: bare Design maps were made deterministic and AI Styles demoted to decorative because the model relocates content and the labels stop matching.

**Fix:** Ship it as: (1) prompt = restyle the ground and the existing site fabric, explicitly forbidding arrows, arcs, wedges, compass letters, labels and legend; (2) overlay = drawSectorEnergies + the deterministic legend, composited via compositeAccurateMap's overlayImage; (3) UI copy on this sheet says 'the artwork is AI, the bearings are measured' rather than the current 'Deterministic and exact — no AI'. Do NOT let the model letter this sheet, and do NOT route it through buildSatelliteOverlayPrompt's icon/legend machinery. If that composited-overlay work is not in scope now, leaving sector exact-only is strictly better than a lettered AI version.

### [high] Sheet 08 Phasing must never be model-drawn — its content is lettered schedule text, not geometry
`components/design/DesignGlossy.tsx:3517`

**Evidence:** The 08 builder is documented at :3517 as 'a RULES-ENGINE render — lib/phasing.buildPhasePlan derives the …', called at :3530, and the UI copy at :5478 promises 'the build order, week ranges, hold points, critical order and site rules … Deterministic and exact: no AI, no guessing. This is the reliable version of the illustrated Implementation analysis map.' The sheet's information content is words and numbers. gpt-image-2 lettering a week range or a hold point produces a fabricated schedule that reads exactly as authoritative as the real one, and the satellite-overlay prompt's rule 14 (producer-prompt.ts:564) already restricts lettering to a fixed set — phase text is not in it. The empty-brief guard (producer-prompt.ts:451) would fire anyway, since overlayElementsText emits nothing for a phasing sheet.

**Fix:** Keep 08 exact-only and keep the copy at :5478 and :5403 as-is. If a prettier 08 is wanted, apply the same split as sector: AI repaints the base, the phase overlay and all text are composited deterministically. Never let the model own the numerals.

### [medium] Sheet 01 Site is the weakest case for AI, because its product value IS being un-restyled
`components/design/DesignGlossy.tsx:4645`

**Evidence:** renderBaseMap is `buildComposite(state, frame, refLayers, 'all', false)` (:4651) — satellite + boundary, drawDesign=false — described at :4645-4646 as 'the honest "before" the whole plan builds on; exact, never invented.' The audit already records that the satellite prompt contradicts itself about existing vegetation: FINAL CHECK (3) at producer-prompt.ts:566 demands 'not a single tree, shrub or bed on the sheet that has no marker under it' while rule 1 (:534) demands every photographed tree be kept — and sheet 01 has NO markers at all, so that check reduces to 'delete every tree'. An AI 01 would render a smallholding emptier than the real one, on the page a funder reads first.

**Fix:** Leave 01 exact-only in the plan set. If an illustrated 'existing site' is wanted, offer it as a separate gallery item labelled an artist's impression, not as sheet 01 — and fix the FINAL CHECK (3) scoping defect (audit: all §5) first regardless, since it already damages sheets 05 and 07.

### [high] UI, dispatch and print all hard-route sector to the exact renderer — five call sites, plus copy that currently promises no AI
`components/design/DesignGlossy.tsx:4215`

**Evidence:** applySheet: `if ('exact' in sheet) { setExactSheet(sheet.exact); setAnalysisStyle(null); setProducerStyle(null); }` (:4217-4223) — the mode argument is ignored for 01/02/08, with a comment stating they are 'now EXACT-ONLY'. aiLayerMode (:4236) is therefore false on sector, so the Style picker (:5420) never renders. runCurrentSheet dispatches `if (exactSheet === 'sector') return renderSectorMap()` (:5135) before any producer branch. mapKey pins 'sector-exact' (:4265-4266). DESIGN_SHEETS still carries a now-dead `aiAnalysis: 'sector'` field (:201, type at :196). Copy to change: :5476 'Deterministic and exact — no AI' and :5403 "Site, Sector & Phasing stay exact (they're facts, not art)". Print is separate again: DesignPrint.tsx:73 always calls buildBlueprintSectorMap and :90 marks sector always-available.

**Fix:** Make DesignSheet's analytical variant carry an optional `aiStyle: true` and let applySheet honour mode for sector only; add a producer branch to runCurrentSheet ahead of the exactSheet check; give the AI variant its own mapKey (`producer:${style}:sector`) so it cannot overwrite the exact 'sector-exact' cache — the audit's cache note (order-of-work §3) applies here too, since saveGlossy keys carry no content hash. If the restyle recommendation is taken, the copy should become 'artwork by AI, bearings measured' rather than being deleted.

<details><summary>Refuted — do not re-chase</summary>

- **ShowcaseSheetKind must gain 'sector' — and the two call sites pass a GlossyLayerFilter, so the unions are coupled** — The load-bearing assertion — "the two call sites pass a GlossyLayerFilter, so the unions are coupled" / "adding 'sector' to ShowcaseSheetKind alone will not type-check at the call sites unless GlossyLayerFilter also gains it" — is false, and I disproved it with the compiler. Baseline `npx tsc --noEmit` in /Users/roryclark/ImbewuField is clean (exit 0). Adding `| 'sector'` to ShowcaseSheetKind at lib/producer-prompt.ts:258 and changing NOTHING else produces exactly three errors, all inside produc
- **SHEET_NO already reserves 02 for Sector in its own comment — this is the one entry that is a genuine one-liner** — The quotations check out, but the load-bearing part of the claim — "this is the one entry that is a genuine one-liner" — is false, and the proposed fix does not compile.

WHAT IS CORRECT:
- lib/producer-prompt.ts:371-373 is verbatim as quoted: `export const SHEET_NO: Record<ShowcaseSheetKind, string> = { zones: '03', water: '04', planting: '05', structures: '06', all: '07' };`
- The comment at :364-370 does name the collision ("AI \"02 — ZONES PLAN\" against printed 02 Sector Analysis") and :370
- **ICON_KEYS_BY_SHEET has no sensible sector entry — an empty key list makes prompt rule 6 a dangling fragment** — The claim is built on a sheet kind that does not exist in the code, and its proposed fix would not compile.

1. There is no `sector` member of the union. `lib/producer-prompt.ts:258`: `export type ShowcaseSheetKind = 'all' | 'zones' | 'water' | 'planting' | 'structures';`. `ICON_KEYS_BY_SHEET` is declared `Record<ShowcaseSheetKind, string[]>` (`:405`), so it is already *total* over that union — it has no sector entry for the same reason it has no `orchard` entry. Adding `sector: []` (proposed fi
- **modelFilters would carry six sheets, and the comment claiming five equals the job cap is already wrong** — The claim's central evidence is factually wrong: MAX_SHEETS_PER_JOB does exist, at lib/render-jobs.ts:22 (`export const MAX_SHEETS_PER_JOB = 5;`), enforced as a hard client throw at lib/render-jobs.ts:123-124 AND mirrored server-side in firestore.rules:239 (`request.resource.data.sheets.size() <= 5`). The comment at components/design/DesignGlossy.tsx:4989 ("5 sheets, exactly MAX_SHEETS_PER_JOB") is therefore accurate, not "already wrong" — with showcase on, modelFilters (:4990-4992) is exactly 5
- **layerContentCount returns 0 for sector by construction, so both the batch and the single-sheet gate silently skip it** — The claim is unreachable by construction — no code path ever passes 'sector' to layerContentCount, and it could not compile if it did.

1. 'sector' is not a GlossyLayerFilter. lib/glossy-filters.ts:8 declares `export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures'`. layerContentCount's third parameter is typed `filter: GlossyLayerFilter` (DesignGlossy.tsx:255), so `layerContentCount(state, refLayers, 'sector')` is a TypeScript error, not a silent 0. EMPTY_LAYER_STE
- **There is nothing to put in the composite: drawMarks has no sector branch, so the model would receive a bare satellite** — The claim's mechanism, call sites and fix are all wrong, even though its conclusion coincidentally holds on a different path. (1) There is no 'sector' GlossyLayerFilter: lib/glossy-filters.ts:8 defines 'all'|'water'|'zones'|'planting'|'structures'. Nothing anywhere passes 'sector' to buildComposite or drawMarks, so the "itemInFilter/lineInFilter/zonesInFilter return false for 'sector'" premise describes an unreachable state. (2) The cited call sites are the gpt-image-2 queue paths at DesignGloss
- **overlayElementsText emits nothing for sector, so buildSatelliteOverlayPrompt throws — and the obvious fix collides with the row/legend contract** — The defect does not exist: 'sector' cannot reach overlayElementsText or buildSatelliteOverlayPrompt, neither by type nor by routing.

TYPE. lib/glossy-filters.ts:8 — `export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures'`. lib/producer-prompt.ts:258 — `export type ShowcaseSheetKind = 'all' | 'zones' | 'water' | 'planting' | 'structures'`. Neither has a 'sector' member. overlayElementsText's third parameter is `filter: GlossyLayerFilter = 'all'` (DesignGlossy.tsx:1
- **finishStyledSheet ships model-chrome output verbatim, so nothing today could verify or correct a wrong bearing** — The quoted code at DesignGlossy.tsx:4885-4896 says what the claim says it says, and the image-producer citations (:50-51, :453-455) are accurate, as is "no post-render bearing check anywhere". But the claim's subject — the sector sheet — never passes through finishStyledSheet. GlossyLayerFilter (lib/glossy-filters.ts:8) has no 'sector' member; sector is an `aiAnalysis` sheet (DesignGlossy.tsx:201) rendered by generate() via Gemini (:4316-4317, :4371-4388) and shipped verbatim at :4390-4400 with 

</details>
