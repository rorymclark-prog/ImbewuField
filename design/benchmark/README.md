# Benchmark plan set — Carl & Sandy's Place

Rory's words: "here its is the is the benchmark i am not gonna settle for less."

This is the reference plan set he supplied, saved permanently so it can't drop out of context
again (it did once already — see the sector fix in commit 8b16a09, done from a spec doc
transcribed from this same set instead of the images themselves). Source: his
`~/Downloads/Carl_and_Sandys_Place_Permaculture_Design_Map_Set.zip`, 8 sheets, README.txt kept
alongside. This was produced externally (ChatGPT/DALL-E look, not this app's pipeline) as the
target quality and content bar.

**This is the bar for content and legend completeness — not necessarily for sheet numbering.**
The reference numbers Sector Analysis as sheet **08** (last); this app's canonical order numbers
it sheet **02** (`lib/producer-prompt.ts` SHEET_NO). Nobody has asked to renumber the app's plan
set to match — flagging so it isn't done by accident while chasing "match the reference."

## 08 — Sector Analysis Map — legend, transcribed exactly

Title block: "CARL & SANDY'S PLACE / SECTOR ANALYSIS MAP" · "Outer West Durban · Existing
Conditions Base". North arrow (circle badge, top right). Scale bar "20 m" (bottom left). Legend
panel: cream/paper card, right edge, heading "SECTOR LEGEND", numbered 1–9 with an icon per row:

| # | Icon | Row text |
|---|------|----------|
| 1 | sun (gold) | Summer sun — SE → N → SW |
| 2 | sun (pale yellow) | Winter sun — NE → N → NW |
| 3 | wavy wind lines (teal) | Summer cooling wind — NE / E |
| 4 | wavy wind lines (blue) | Cold-front wind — SW |
| 5 | cloud + rain | Summer storm & rain — E / NE |
| 6 | wavy wind lines (orange) | Hot dry berg wind — W / NW |
| 7 | dashed radiating arrow (red/orange) | Winter grassfire / ember risk — W / NW |
| 8 | solid grey arrow | Driveway access, dust & noise — NW |
| 9 | curved down arrow (blue) | Terrace fall — upper to lower platform |

Footer note, boxed: *"Regional sector assumptions. Confirm local wind, fire and runoff directions
through on-site observation."*

On the map itself: labelled arrows/wedges for each of the 9 rows in matching colour, drawn over a
dark satellite/illustration base, house drawn in oblique 3D with visible roof planes, ground
labels (TARRED DRIVEWAY, UPPER LAWN TERRACE, EXISTING VEGETABLE GARDEN, LOWER CLEARED GROUND, 3 m
GRASSED BANK / LEVEL CHANGE), boundary as a green tick-line (not the bone post-and-wire fence this
app switched to after the "phantom hedge" fix — another point where matching this reference
literally would regress a fix already made for a real reason; flagging, not silently overriding).

## Gap vs. what `drawSectorAnalysis` ships today (pre-this-conversation)

Today's legend has 6 rows (Midday sun, Summer wind, Winter wind, Water flows downhill, Frost
pocket, Site boundary) and explicitly omits fire ("Fire sector not shown" note) because the
naive derivation pointed it at the wrong wind. The reference has 9 rows and splits "wind" into
FOUR named, seasonal, purpose-specific sectors (summer cooling / cold-front / berg / storm) plus a
grassfire row derived from the berg wind, not from winter wind — which is likely the fix for the
fire-sector defect, not a reason to leave fire off. It also has a driveway-access sector and a
terrace-fall sector that don't exist in the model at all yet.

This is the same shape of enrichment `docs/SECTOR-MODEL-SPEC-2026-07-21.md` scoped from a
transcription of this same reference — that doc's `NamedWindSector` union
(`summer_cooling | cold_front | berg | storm_onshore`) maps directly to legend rows 3–6 above.
Terrace fall (row 9) and driveway access (row 8) are not yet in that spec and need adding.
