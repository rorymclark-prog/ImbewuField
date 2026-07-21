# Benchmark plan set — "Extension Blueprint" style, 7 sheets

Rory, 2026-07-21, pasting these 7 images directly into chat: "there are for the most really good
examples for you to store in the repo as benchmarks." Extracted from the conversation transcript
(they arrive as inline attachments, not files — see the session's own history if this ever needs
redoing) and converted from the pasted webp to PNG. No README.txt or zip this time; site identity
and location aren't given, only the sheets themselves — treat every reading below as read off the
image, not sourced from an accompanying brief the way `../README.md`'s set had one.

This set uses a different look from Carl & Sandy's Place (`../*.png`) — same house, roughly the
same footprint and layout, but redrawn in a different style preset ("Extension Blueprint" per every
sheet's own subtitle): oblique 3D house with visible roof planes, a plain green tick-line boundary,
warm cream legend panels, and — new relative to the first set — **terrace levels named with actual
metre figures**, and a considerably richer **Implementation & Phasing** sheet. Both are the reason
this set earns its own README rather than just adding rows to the first one.

## What's specifically useful here (not already covered by Carl & Sandy's Place)

### Sheet 01 — terrace-level labelling (directly relevant to `TERRACES-EARTHWORKS-SPEC-2026-07-21.md`)

Ground labels read: **"UPPER TERRACE +0.0 m"**, **"SOUTHERN LOWER TERRACE −3.0 m"**, and a distinct
riser band **"EXISTING 3 m VETIVER BANK / LEVEL CHANGE"** between them (a narrow hatched/planted
strip, not a platform). A third platform, **"EXISTING VEGETABLE GARDEN — LOWER TERRACE"**, sits at
an implied intermediate level with its own similar riser callout. This is close to a direct
transcription target for the terracing spec's `levelM` field and its worked label format
(`{name} {levelM:+.1f}M`) — the reference literally writes the sign and one decimal place the same
way. The vetiver bank being drawn and named as its OWN ground kind (not folded into either
platform) is exactly the `terrace_bank` `GroundFeatureKind` the spec proposes, transcribed rather
than invented.

Sheet 01's title is itself two-part — **"01 — SITE BASE MAP & TERRACE LEVELS"** — i.e. the
reference treats terrace levels as core Site-sheet content, not a Sector-only concern, matching
the terracing spec's §4a decision to wire ground-name labels into sheet 01 (today's app has zero
ground labels there at all — a real, confirmed gap, not a stylistic difference from this reference).

### Sheet 02 — zones explicitly say they are NOT elevation

Legend footer states plainly: *"Zones show frequency of access and management, not elevation. The
vegetable garden is Zone 2; the orchard and small-livestock area are Zone 3."* Worth keeping in
mind if zone bands and terrace levels are ever visually close on a real sheet — this reference
disambiguates the two systems in words specifically because they could be confused.

### Sheet 07 — Implementation & Phasing, considerably richer than today's `buildImplementationMap`

Six numbered stages (not this app's finer-grained phase list), each with: a coloured pill, a title,
a week range (**"Week 0–1"**, **"Weeks 1–4"**, … **"Month 3+"**), a short bulleted task list, and a
**named Hold Point** ("Hold Point A: Levels, services and bank condition confirmed.") that reads as
a go/no-go gate before the next stage starts. A **Critical Order** list (1. Survey/verify → 2. Safe
bank access → 3. Main water lines → 4. Vetiver bank → 5. Beds/drip → 6. Trees/guilds → 7.
Livestock) and a separate **Site Rules** box (do-not-move / do-not-traverse / test-before-planting
rules) sit at the bottom of the legend panel, distinct from the phase list itself.

This is a stronger reference for `lib/phasing.ts`/`buildImplementationMap` than anything in the
Carl & Sandy's set, and is a plausible source for closing the audit-scorecard finding that the
app's own **masterplan** sheet (07 in the app's numbering — a different sheet from this reference's
07) "has no legend, no scale bar, no north arrow" — not because that finding is about this sheet,
but because this reference shows what a fully-dressed hold-point-driven implementation sheet looks
like when done well, in case that pattern gets reused for the masterplan's own gap.

## Sheet index

| File | Reference title |
|---|---|
| `01_Site_Base_Map_and_Terrace_Levels.png` | 01 — Site Base Map & Terrace Levels |
| `02_Permaculture_Zone_Map.png` | 02 — Permaculture Zone Map |
| `03_Water_Greywater_and_Irrigation_Plan.png` | 03 — Water, Greywater & Irrigation Plan |
| `04_Planting_and_Agroforestry_Plan.png` | 04 — Planting & Agroforestry Plan |
| `05_Small_Livestock_and_Site_Infrastructure_Plan.png` | 05 — Small Livestock & Site Infrastructure Plan |
| `06_Final_Integrated_Permaculture_Masterplan.png` | 06 — Final Integrated Permaculture Masterplan |
| `07_Implementation_Map_and_Phasing.png` | 07 — Implementation Map & Phasing |

No sheet 08 (Sector Analysis) in this set — it stops at 07. Not a gap to fill; simply what was
supplied.
