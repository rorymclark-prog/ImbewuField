# Plan-set spec — the target deliverable

**Reference:** `~/Downloads/Ubhejane_Creche_Permaculture_Map_Set.zip` (7 PNG sheets, ChatGPT-produced,
2026-07-17). Rory's verdict: *"almost perfect — the technology is DEFINITELY here."* Keep that zip;
it is the canonical reference for what ImbewuField's Print/Export plan set should produce.

## The canonical 8 sheets (Rory's spec, 2026-07-18)
**Ordering rule Rory locked in: ANALYSIS BEFORE DESIGN** — the Sector Analysis moved to **02, before
Zones**, because the site's energies (sun path, wind, water, fire/frost) are what *dictate* where the
zones go. The package tells the story in the order the design was actually reasoned.

| # | Sheet | Our layer today |
|---|---|---|
| 01 | Existing Site, Boundary & **Terrace** Base | Base map (levels = **gap**, see below) |
| **02** | **Sector Analysis** (sun · wind · water · fire) | **"Sun & Wind (sector)" — Gemini analysis ONLY today; needs a DETERMINISTIC sheet to join the print set** |
| 03 | Permaculture Zone Map | ✅ Zones Blueprint (`buildBlueprintZoneMap`) |
| 04 | Water, Greywater & Irrigation Plan | ✅ Water Blueprint (`buildBlueprintWaterMap`) |
| 05 | Planting & Agroforestry Plan | ✅ Planting Blueprint (`buildBlueprintPlantingMap`) |
| 06 | Small Livestock & Infrastructure Plan | ✅ Structures Blueprint (`buildBlueprintStructuresMap`) |
| 07 | Final Integrated Permaculture Masterplan | "Whole design" (still the plain composite) |
| 08 | Implementation Map & Phasing | ✅ `buildImplementationMap` (was numbered 07 in the UI — renumber to 08) |

For a *formal construction* package you'd add a measured land survey, exact dimensions, engineering
sign-off on the 3 m bank, and detailed plumbing/irrigation specs. For presenting/funding/guiding, the
eight above are sufficient (Rory's call).

TO IMPLEMENT this ordering: (a) build a **deterministic Sector sheet** (the exact radial sun/wind/
water/fire renderer — currently sector is Gemini-only) so it can sit in the print set; (b) reorder +
renumber the Print composer (DesignPrint) and the Glossy design-map tabs to 01–08 above; (c) split
"Whole design" (07 Masterplan) from Implementation (08). Sheets 03/04/05/06/08 already exist as
Blueprints; 01 needs terrace levels + existing features; 02 is the new build.

All four Blueprints share ONE chrome implementation (the `drawBlueprint*` helpers in
`DesignGlossy.tsx`) rather than a copy each — see "The load-bearing principle" below: four
hand-maintained copies of the chrome is exactly how the cross-sheet guarantee quietly rots.

## Sheet anatomy (copy this)
Every sheet shares one chrome:
- **Numbered title block**: `01 — SITE BASE MAP & TERRACE LEVELS` + subtitle (`Extension Blueprint`).
- **Grouped legend**, sectioned by meaning — e.g. `EXISTING BUILT` / `GROUND & LEVELS`, or
  `EXISTING` / `PROPOSED WATER`. **Swatches use the same hatch/pattern as the map fill** (house =
  crosshatch, patio = grid, driveway = solid dark, fence = the fence-tick symbol). Ours currently
  uses flat colour dots — upgrade to pattern swatches.
- **On-map labels**: CAPS, short, leader line to the feature. Grouped where sensible
  (`SOUTHERN ORCHARD GUILDS` as a header over Macadamia/Citrus/Avocado/Mango).
- **Scale bar** (20 m) + **north arrow** — we have both.
- **Notes box**, bottom of the legend: caveats + "confirm on site".

## The load-bearing principle
Sheet 01 states: **"Authoritative geometry for all following sheets."** One exact base; every other
sheet is that base + one layer. This is exactly our deterministic `buildComposite` architecture —
and it is *why* our exact maps beat generative ones: the geometry is true by construction, so every
sheet in the set agrees with every other. A generative set cannot guarantee that.

## Sheet 07 — Implementation & Phasing (the differentiator)
Structure worth cloning verbatim:
- **Phases** with a colour, a number, a title and a **week range**:
  1. Verify, Set Out & Make Safe — Week 0–1
  2. Safe Access & Water Spine — Weeks 1–4
  3. Vetiver Bank & Soil Building — Weeks 3–6 *(begin with dependable rain)*
  4. Beds, Drip & Working Infrastructure — Weeks 4–8
  5. Perennials & Guilds — Weeks 6–12 *(onset of reliable rains)*
  6. Small Livestock & Commissioning — Month 3+
- Each phase: 3–5 imperative bullets + a **Hold Point** (A–F) — a gate that must pass before the
  next phase ("Hold Point B: Pressure and leak test before backfilling").
- **Numbered phase pins on the map** at the location of that phase's work.
- **CRITICAL ORDER** list (survey → safe access → main water → vetiver bank → beds/drip → trees →
  livestock) — the Scale-of-Permanence sequence, made concrete.
- **SITE RULES** box — site-specific constraints (keep driveway open, don't excavate the bank face,
  test water before planting, child-safety).

Phases are **deterministically derivable** from the design: what's placed + the permanence order
gives the sequence; week ranges and hold points come from element type + rainfall season. This is a
rules engine, not an image model — we can own it outright.

## Gaps this reference exposes
1. **Terrace levels** (`+0.0 m`, `−3.0 m`) — we have SRTM slope/aspect (too coarse, see
   `lib/elevation.ts`), not terrace levels. Needs a user input: mark a level change + its drop.
   The reference also shows a **vetiver bank / level change** as a first-class feature.
2. ~~**Planting + Livestock Blueprints** (sheets 04/05)~~ — **built.** Elements draw at TRUE
   footprint (wM/hM are real metres), colour-coded per SPECIES with a present-only legend.
3. **Implementation/phasing engine** (sheet 07) — not built; biggest product win.
4. **Legend pattern swatches** + **grouped label headers** — our versions are flatter.
5. **Site rules / hold points** — no concept in the app yet.
6. **North arrow** — the anatomy above lists one, but no Blueprint sheet has ever drawn it (only
   `composeStyleSheet` does). Known gap; adding it is a one-helper change across all four sheets.

## Honest read
The reference proves the *deliverable* is achievable and valuable. It does **not** change the
accuracy argument: ChatGPT drew this beautifully from a design we handed it, but it cannot
*guarantee* geometry across 7 sheets — we can, because we hold the true polygons. The split stays:
**we own exact geometry + the rules engine (zones, phasing, hold points); the image model is optional
styling.** Chase sheets 04/05/07 deterministically before chasing prettier pixels.
