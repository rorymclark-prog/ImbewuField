# Plan-set spec — the target deliverable

**Reference:** `~/Downloads/Ubhejane_Creche_Permaculture_Map_Set.zip` (7 PNG sheets, ChatGPT-produced,
2026-07-17). Rory's verdict: *"almost perfect — the technology is DEFINITELY here."* Keep that zip;
it is the canonical reference for what ImbewuField's Print/Export plan set should produce.

## The 7 sheets
| # | Sheet | Our layer today |
|---|---|---|
| 01 | Site Base Map & **Terrace Levels** | Base map (levels = **gap**, see below) |
| 02 | Permaculture Zone Map | ✅ Zones Blueprint (`buildBlueprintZoneMap`) |
| 03 | Water, Greywater & Irrigation Plan | ✅ Water Blueprint (`buildBlueprintWaterMap`) |
| 04 | Planting & Agroforestry Plan | Planting (Blueprint **not built yet**) |
| 05 | Small Livestock & Infrastructure Plan | Structures/Animals (Blueprint **not built**) |
| 06 | Final Integrated Permaculture Masterplan | "Whole design" |
| 07 | **Implementation Map & Phasing** | The differentiator — **not built** |

This maps almost 1:1 onto the Print composer's layer list + the report's north-star 6 maps.
Sheets 04/05 are the obvious next Blueprints; 07 is the prize.

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
2. **Planting + Livestock Blueprints** (sheets 04/05) — not built.
3. **Implementation/phasing engine** (sheet 07) — not built; biggest product win.
4. **Legend pattern swatches** + **grouped label headers** — our versions are flatter.
5. **Site rules / hold points** — no concept in the app yet.

## Honest read
The reference proves the *deliverable* is achievable and valuable. It does **not** change the
accuracy argument: ChatGPT drew this beautifully from a design we handed it, but it cannot
*guarantee* geometry across 7 sheets — we can, because we hold the true polygons. The split stays:
**we own exact geometry + the rules engine (zones, phasing, hold points); the image model is optional
styling.** Chase sheets 04/05/07 deterministically before chasing prettier pixels.
