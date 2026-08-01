# Earthworks audit — what a permaculture map for a South African smallholding actually needs

Written when Earthworks became its own design step (2026-08-01). Rory: "we should build terraces
for garden beds, pathways, if want to build a levelled area cut and fill and so forth — audit the
most essential set of earthworks for a permamap like this."

## What we have today

**Items** (`category: 'earthworks'` in `lib/design-elements.ts`)

| id | name | shape | what it models |
|---|---|---|---|
| `raised_bed` | Raised Bed | rect | built-soil growing bed |
| `keyhole_bed` | Keyhole Bed | circle | keyhole bed with compost basket |
| `herb_spiral` | Herb Spiral | circle | rubble-cored spiral |
| `banana_circle` | Banana Circle | circle | compost pit + banana ring |
| `tree_basin` | Tree Basin | circle | mound + infiltration ring |
| `greywater_basin` | Greywater Basin | circle | mulch basin, greywater destination |
| `infiltration_basin` | Infiltration Basin | circle | flat-bottomed ponding dish |
| `half_moon` | Half-moon | circle | demi-lune bund, one tree |
| `berm` | Berm / Contour Bank | rect | the mound below a swale |
| `terrace` | Terrace / Retaining Bank | rect | cut-and-fill shelf |

**Lines** — only `swale`. (`LineShape['kind']` is `swale | fence | path | bedpath | pipe | drip |
windbreak | greywater`.)

**Traced areas** — `terrace_bank` (the riser face between two levels), carrying an optional
farmer-measured `levelM` and `measuredSlopePct`.

**Living** — `mulch_bank` (Vetiver Bank) sits in `growing`, correctly: it is a cut-and-come-again
grass bank, not a static earthwork.

## The gaps that matter, in priority order

### Tier 1 — the plan is wrong without these

**1. Diversion / cut-off drain.** *(missing entirely)*
A graded channel that intercepts runoff coming down onto cropped land and leads it away to a safe
discharge. This is the most-used soil-conservation earthwork in South African extension practice,
and there is no way to draw one. A farmer who means a diversion drain has only the swale tool —
and **a swale is the wrong answer**: a swale is level and holds water to infiltrate; a diversion
drain runs at a slight grade and gets water *off* the land. Drawing one as the other produces a
plan that does the opposite of what was intended. The single most important item on this list.

**2. Level platform (cut and fill).** *(half-present)*
`terrace_bank` models the RISER between two levels, and `ZoneShape.levelM` already exists to carry
its height. What is missing is **the flat part** — the levelled pad itself, as a traced area with
its own level: a garden terrace, a shed pad, a tank stand, a nursery floor. The concept is
half-built, and the missing half is the one a farmer actually stands on. Rory named this one.

**3. Spillway / level sill.** *(missing)*
Every swale, dam and basin needs a designed overflow, and the water notes already discuss where
overflow goes. Without a way to mark one, the plan silently implies water simply stays where it
lands — which is how a swale becomes a breach.

**4. Check dam / gully plug.** *(missing)*
Gully erosion is the dominant land degradation on sloping smallholdings here. A permaculture plan
that cannot mark a gully repair is missing the most urgent earthwork on many real farms.

### Tier 2 — high value, clearly worth building

**5. Stone line / contour bund.** The low-cost sibling of the berm, for thin soils where stone is
what you have. Standard practice across dryland Africa.

**6. Existing gully / erosion scar.** A traced area on the **Base** step, alongside lawn/cleared.
You cannot plan a repair to damage you have no way to record, and the Base step's whole job is
"what is really here".

**7. Fanya juu.** Soil thrown *uphill* of the trench so a bench forms over successive seasons.
Probably a variant of `terrace` rather than a new element — worth deciding, not worth duplicating.

**8. Ripping / subsoil line.** Where a plough pan gets broken on contour. A line.

### Tier 3 — real, but not before the above

Tied ridges and furrows (dryland maize); zai / planting pits; silt trap or sediment basin;
french drain for a waterlogged spot; stepped path on a steep slope (the existing `path` line is
probably adequate).

## Implementation notes for whoever builds these

**Linear earthworks are already modelled as long thin rect ITEMS**, not lines — `berm` is
`1.2 m × 10 m`, `terrace` is `2.5 m × 10 m`. That precedent makes a stone line or a ripping line
cheap to add (one catalog entry plus a symbol). A **new `LineShape` kind is the expensive path**:
it touches cartography, the filter tables, every legend, all four AI prompt glossaries and their
tests. Weigh that before reaching for it — but note the diversion drain genuinely wants to be a
polyline that follows the ground, and modelling it as a rectangle would be a compromise the
drawing itself would show.

**A traced AREA is the cheapest new thing of all** when the shape is the point. `GroundFeatureKind`
rides the whole existing zone draw/edit/persist/adopt engine. The full checklist, from doing
`staple_garden` this week: `lib/design-canvas.ts` (the union) → `lib/design-elements.ts`
(`GROUND_FEATURES`) → `lib/snap-edges.ts` → `lib/structure-register.ts` → `lib/producer-prompt.ts`
(**all four** marker tables — `M`, `OVERLAY_ICONS`, `ICON_MATCH`, and the per-sheet lists) →
`lib/glossy-filters.ts` (`ownedByCurrentStep`, `groundRegister`) → `DesignGlossy.tsx` (`MAP_NAME`,
`groundName`) → `app/api/ai-render/route.ts` → the palette chip → tests. **Missing one of the four
prompt tables is a documented recurring bug in this repo** — fixes have landed in some and not
others more than once.

**Two systems ask "whose shape is this"** and they must agree: `ownedByCurrentStep` (which wizard
step may edit it) and `groundFeatureLayer` (which Layers switch shows it). Answering one and not
the other is exactly how the staple garden ended up interactive on Planting while still riding the
Existing switch. There is a test pinning the agreement — keep it passing.

## Rules

- **Invent no numbers.** Swale spacing, bank batter, drain grade and terrace width all depend on
  slope, soil and rainfall. Where a default footprint is needed it is a drawing default, not an
  agronomic claim, and the tip text must not imply otherwise. Anything that reads as a
  recommendation needs a source or an agronomist — see `project_imbewufield_agronomy`.
- **Free exact renders only** for verification. Do not spend a paid AI render on catalog work.
- **Never touch `PLAN_VERSION`.**
- `npm test` and `npx tsc --noEmit` must both pass.
