# Catalog element matrix audit — 2026-07-27

Backlog item: docs/ACTIVE-MAP-QUALITY-TASKS.md (~line 222) — "Deep-audit every catalog element
across editor step, layer toggle, foreground/context sheet, prompt vocabulary, label and legend.
Enforce the matrix in tests."

This repo's own documented recurring bug (5+ historical instances — see the adversarial-review
comments in `lib/glossy-filters.ts` and `lib/design-elements.ts`) is that a catalog element must be
coherently answered by **six independent systems**, and they drift apart. This audit builds the
full matrix for every entry in `ELEMENT_CATALOG` (`lib/design-elements.ts`, 76 elements including
one deprecated) and enforces it going forward in `tests/catalog-matrix.test.ts` (11 tests, all
passing against the real exported functions — no duplicated private logic).

## The six systems, and how each was checked

| # | System | Source of truth | How this audit checked it |
|---|---|---|---|
| 1 | **WIZARD STEP** — which step places/edits it | `CATEGORY_STEP` + `alsoSteps` (`lib/design-elements.ts`), enforced by `ownedByCurrentStep` (`lib/glossy-filters.ts`) | Called `ownedByCurrentStep` directly for every element × every step, including the non-item steps. Exported, plain `.ts` — no ownership restriction. |
| 2 | **LAYER TOGGLE** — which `activeLayers` switch shows it | `categoryLayerKey` (`components/design/DesignCanvas.tsx`, **read-only** — Codex-adjacent file, and a `.tsx` client component the test runner cannot import; see below) | Read the function by hand (currently lines 170-185: a plain `switch` over `ElementCategory` with **no default case**, so an unhandled category is a compile error, not a silent fallthrough). Hand-mirrored into a small `CATEGORY_LAYER_KEY` constant in the test file, with a comment tying it back to the exact function and warning future editors to keep both in sync. |
| 3 | **OUTPUT SHEET** — which printed sheet it counts as content on | `sheetForElement` / `SHEET_OVERRIDE` / `itemInFilter` (`lib/glossy-filters.ts`) | Called directly. Already covered in depth by `tests/glossy-filters.test.ts`; this audit adds the matrix-level completeness assertion and the step↔layer↔sheet divergence test. |
| 4 | **AI PROMPT VOCABULARY** — do the two illustrated AI render paths know how to draw it | `OVERLAY_ICONS`/`ICON_KEYS_BY_SHEET`/`ICON_MATCH` and `M`/`SHOWCASE_MARKERS_BY_SHEET`/`SHOWCASE_MARKER_MATCH` (`lib/producer-prompt.ts`, **Codex-owned, read-only**) | These tables are private (`const`, not exported) and the file must not be edited. Tested **behaviourally** instead: called the file's own exported `buildShowcasePrompt` / `buildSatelliteOverlayPrompt` with each element's bare catalog name in isolation and inspected the rendered prompt text for the "no vocabulary" fallback phrasing. Never imports or duplicates the private regex tables. |
| 5 | **LABEL** — does it get an on-map burned label | `producerLabels` (`lib/producer-labels.ts`) | Called directly with a single-item synthetic `DesignCanvasState` per element and checked the output contains a pill spelling the element's own catalog name. |
| 6 | **LEGEND** — does it appear in its sheet's legend, and is it grouped under a named heading | `sheetLegendRows` (`components/design/DesignGlossy.tsx`, **Codex-adjacent, read-only, un-importable — see below**) for presence; `waterLegendSectionForFeature` / `plantingLegendSectionForFeature` / `structuresLegendSectionForFeature` (`lib/*-cartography.ts`) for section grouping | **Presence** on a layer sheet (water/planting/structures) is gated by the exact same `itemInFilter` call System 3 already exercises (confirmed by reading `sheetLegendRows`'s per-sheet branch), so it is asserted directly. **Section grouping** is asserted against the three small, plain, exported `*-cartography.ts` helpers. The **whole-design masterplan** sheet's separate grouped-summary legend (a different code path, `sheetLegendRows`'s `filter === 'all'` branch) was read by hand only — see the import-safety note below. |

### Why two systems are "read, not imported"

`components/design/DesignCanvas.tsx` and `components/design/DesignGlossy.tsx` are `'use client'`
React components with JSX, several thousand lines each. This test suite runs via
`node --import ./tests/register-alias.mjs --test`, which strips TypeScript **types** but cannot
transform **JSX** — importing either file would fail immediately with a syntax error, and chasing
that down is exactly the kind of detour a previous session already lost hours to (per this task's
own instructions: never start a dev server or browser; static analysis and node tests only).
`components/design/DesignGlossy.tsx` is also explicitly owned by Codex (`lib/producer-prompt.ts`,
`lib/render-policy.ts`, `functions/**`, `firestore.rules`, `.github/workflows/**`, and
`components/design/DesignGlossy.tsx` itself) — editing or duplicating its private logic outside
itself is the drift this whole audit exists to prevent, so nothing that lives only inside it is
re-implemented here. Both are handled the same way: read by hand, findings recorded below, and any
part that legitimately routes through a small plain exported helper module is tested dynamically
through that module instead.

## The full matrix

`dep?` = deprecated (hidden from new-placement palettes, still renders on old saved maps).
`legend row` = does the element get a row at all on its primary sheet's legend (System 6, presence).
`legend section` = the named heading it groups under there, or `—` if it gets a row with no heading.
`showcase vocab` / `overlay vocab` = System 4, per illustrated AI path, tested on the element alone.

| id | name | category | dep? | wizard step | layer toggle | output sheet | label | legend row | legend section | showcase vocab | overlay vocab |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `jojo_1000` | JoJo Tank 1000L | water |  | water | water | water | Y | Y | RAINWATER | Y | Y |
| `jojo_2500` | JoJo Tank 2500L | water |  | water | water | water | Y | Y | RAINWATER | Y | Y |
| `jojo_5000` | JoJo Tank 5000L | water |  | water | water | water | Y | Y | RAINWATER | Y | Y |
| `jojo_10000` | JoJo Tank 10000L | water |  | water | water | water | Y | Y | RAINWATER | Y | Y |
| `rain_barrel` | Rain Barrel | water |  | water | water | water | Y | Y | RAINWATER | Y | N |
| `pond_small` | Small Pond | water |  | water | water | water | Y | Y | WATER EARTHWORKS | Y | Y |
| `dam` | Farm Dam | water |  | water | water | water | Y | Y | WATER EARTHWORKS | Y | Y |
| `borehole` | Borehole | water |  | water | water | water | Y | Y | IRRIGATION | Y | Y |
| `tap_point` | Tap Point | water |  | water | water | water | Y | Y | IRRIGATION | Y | Y |
| `water_trough` | Water Trough | water |  | water | water | water | Y | Y | IRRIGATION | N | Y |
| `first_flush` | First-Flush Filter | water |  | water | water | water | Y | Y | RAINWATER | N | Y |
| `pump_filter` | Pump & Filter | water |  | water | water | water | Y | Y | RAINWATER | N | Y |
| `raised_bed` | Raised Bed | earthworks |  | water | earthworks | **planting** | Y | Y | PRODUCTION PLANTING | Y | Y |
| `keyhole_bed` | Keyhole Bed | earthworks |  | water | earthworks | **planting** | Y | Y | PRODUCTION PLANTING | Y | Y |
| `herb_spiral` | Herb Spiral | earthworks |  | water | earthworks | **planting** | Y | Y | PRODUCTION PLANTING | N | N |
| `banana_circle` | Banana Circle | earthworks |  | water+planting | earthworks | **planting** | Y | Y | GREYWATER-READY BASINS | Y | Y |
| `tree_basin` | Tree Basin | earthworks |  | water | earthworks | **planting** | Y | Y | GREYWATER-READY BASINS | Y | Y |
| `greywater_basin` | Greywater Basin | earthworks |  | water | earthworks | water | Y | Y | FILTERED GREYWATER | Y | Y |
| `greywater_outlet` | Greywater Outlet | water |  | water | water | water | Y | Y | FILTERED GREYWATER | Y | Y |
| `greywater_diverter` | Greywater Diverter & Filter | water |  | water | water | water | Y | Y | FILTERED GREYWATER | Y | Y |
| `infiltration_basin` | Infiltration Basin | earthworks |  | water | earthworks | water | Y | Y | WATER EARTHWORKS | Y | Y |
| `half_moon` | Half-moon | earthworks |  | water | earthworks | water | Y | Y | WATER EARTHWORKS | Y | Y |
| `berm` | Berm / Contour Bank | earthworks |  | water | earthworks | water | Y | Y | WATER EARTHWORKS | Y | Y |
| `terrace` | Terrace / Retaining Bank | earthworks |  | water | earthworks | water | Y | Y | WATER EARTHWORKS | Y | Y |
| `mulch_bank` | Vetiver Bank | growing |  | planting | planting | planting | Y | Y | PRODUCTION PLANTING | Y | Y |
| `shed` | Shed | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `greenhouse_tunnel` | Greenhouse Tunnel | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `shade_house` | Shade House | structure |  | structures | structures | structures | Y | Y | PROTECTED GROWING | Y | Y |
| `chicken_coop` | Chicken Coop | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `chicken_tractor` | Chicken Tractor | structure |  | structures | structures | structures | Y | Y | LIVESTOCK & APIARY | Y | Y |
| `kraal` | Kraal | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `compost_bay` | Compost Bay (3-bin) | structure |  | structures | structures | structures | Y | Y | COMPOST & NURSERY | Y | Y |
| `worm_farm` | Worm Farm | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `nursery_table` | Nursery Table | structure |  | structures | structures | structures | Y | Y | COMPOST & NURSERY | Y | Y |
| `market_stall` | Market Stall | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `veg_bed` | Vegetable Bed | growing |  | planting | planting | planting | Y | Y | PRODUCTION PLANTING | Y | Y |
| `tree_citrus` | Citrus Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_mango` | Mango Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_avocado` | Avocado Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_macadamia` | Macadamia Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_guava` | Guava Tree | growing | yes | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_litchi` | Litchi Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_pawpaw` | Pawpaw Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_moringa` | Moringa Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_natal_plum` | Natal Plum | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | **N** | **N** |
| `tree_wild_plum` | Wild Plum | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | **N** | **N** |
| `tree_waterberry` | Waterberry | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | **N** | **N** |
| `tree_other` | Other Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `banana_clump` | Banana Clump | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | N | Y* |
| `tree_indigenous` | Indigenous Shade Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_apple` | Apple Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_pear` | Pear Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_plum` | Plum Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_peach` | Peach Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_fig` | Fig Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `tree_pomegranate` | Pomegranate | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | **N** | **N** |
| `tree_olive` | Olive Tree | growing |  | planting | planting | planting | Y | Y | PERENNIAL GUILDS | Y | Y |
| `other_water` | Other water thing | water |  | water | water | water | Y | Y | IRRIGATION | **N** | **N** |
| `other_planting` | Other planting | growing |  | planting | planting | planting | Y | Y | OTHER PLANTING | **N** | **N** |
| `other_structure` | Other structure | structure |  | structures | structures | structures | Y | Y | — | **N** | **N** |
| `pollinator_strip` | Pollinator Strip | growing |  | planting | planting | planting | Y | Y | PRODUCTION PLANTING | N | Y |
| `spekboom_hedge` | Spekboom Hedge | growing |  | planting | planting | planting | Y | Y | PRODUCTION PLANTING | Y | Y |
| `vetiver_row` | Vetiver Row | growing |  | planting | planting | planting | Y | Y | PRODUCTION PLANTING | N | Y |
| `beehive` | Beehive | animal |  | structures | animals | structures | Y | Y | LIVESTOCK & APIARY | Y | Y |
| `goat_pen` | Goat Pen | animal |  | structures | animals | structures | Y | Y | — | Y | Y |
| `pig_pen` | Pig Pen | animal |  | structures | animals | structures | Y | Y | — | Y | Y |
| `duck_pond` | Duck Pond | animal |  | structures | animals | structures | Y | Y | — | Y | Y |
| `rabbit_hutch` | Rabbit Hutch | animal |  | structures | animals | structures | Y | Y | — | Y | Y |
| `water_trough2` (Livestock Trough) | Livestock Trough | animal |  | structures | animals | structures | Y | Y | — | Y | Y |
| `biodigester` | Biodigester | structure |  | structures | structures | structures | Y | Y | — | Y | Y |
| `shade_sail` | Shade Sail | structure |  | structures | structures | structures | Y | Y | — | **N** | **N** |
| `gate` | Gate | access |  | structures | access | structures | Y | Y | SITE ACCESS & SERVICE | **N** | **N** |
| `bench` | Bench | structure |  | structures | structures | structures | Y | Y | — | **N** | **N** |
| `sign` | Sign | structure |  | structures | structures | structures | Y | Y | — | **N** | **N** |
| `solar_panel_ground` | Ground Solar Panel | structure |  | structures | structures | structures | Y | Y | — | **N** | **N** |
| `washline` | Washing Line | structure |  | structures | structures | structures | Y | Y | SITE ACCESS & SERVICE | **N** | **N** |

`*` = "covered" but with the WRONG vocabulary — see Gap 3 below; presence-only automated checks
read this as `Y`.

Bold `**N**` cells and bold **output sheet** cells mark the two automated-gap categories below.
Every `label` and `legend row` column is `Y` for all 76 entries — Systems 5 and 6a have zero gaps.

## Gaps found

Ranked by farmer impact, per the task's own rubric: an element with no output sheet is severe; a
missing prompt word is moderate; a missing legend row is minor.

### Severe: none

`sheetForElement` is total over the whole catalog (already enforced by
`tests/glossy-filters.test.ts` and re-asserted in `tests/catalog-matrix.test.ts`) — every element a
farmer can place ends up on exactly one primary output sheet, gets labelled, and gets a legend row.
There is no "place it and it vanishes" case anywhere in the catalog today.

### Moderate — Gap 1: 21 catalog elements have no tailored AI drawing instruction on at least one illustrated AI path

`tests/catalog-matrix.test.ts` locks in the exact sets (`SHOWCASE_VOCAB_GAP_IDS`,
`OVERLAY_VOCAB_GAP_IDS`). **14 elements have zero vocabulary in *both* paths** — placed alone on a
sheet, neither `buildShowcasePrompt` (lib/producer-prompt.ts, `M`/`SHOWCASE_MARKER_MATCH`) nor
`buildSatelliteOverlayPrompt` (`OVERLAY_ICONS`/`ICON_MATCH`) gives the model any description of what
to draw for it — it is left to freelance:

`bench`, `gate`, `herb_spiral`, `other_planting`, `other_structure`, `other_water`, `shade_sail`,
`sign`, `solar_panel_ground`, `tree_natal_plum`, `tree_pomegranate`, `tree_waterberry`,
`tree_wild_plum`, `washline`

A further **6 elements are missing only from the Showcase-family vocabulary** (`M` /
`SHOWCASE_MARKER_MATCH`, `lib/producer-prompt.ts` ~lines 353-413/425-465), while
`buildSatelliteOverlayPrompt`'s separate `OVERLAY_ICONS`/`ICON_MATCH` table (~lines 540-643) does
cover them: `water_trough`, `first_flush`, `pump_filter`, `banana_clump`, `pollinator_strip`,
`vetiver_row`. And **1 element** (`rain_barrel`) is the reverse: covered by the Showcase family's
generic `tank` marker (`SHOWCASE_MARKER_MATCH.tank` = `/tank|jojo|rain barrel/i`) but missing from
`OVERLAY_ICONS`/`ICON_MATCH.tank` (`/tank|jojo/i`, which does not match "Rain Barrel").

That the two lists barely overlap (only `herb_spiral`/`other_water`/`other_planting`/
`other_structure`/`shade_sail`/`gate`/`bench`/`sign`/`solar_panel_ground`/the four fruit trees are
shared) is itself evidence the two vocabularies are two independently hand-maintained copies that
have already drifted from each other, on top of both drifting from the catalog.

**Farmer impact:** a farmer who places any of the 21 (most commonly a Gate, Bench, Washing Line,
Ground Solar Panel, Shade Sail, or one of the three "Other …" escape-hatch elements — all ordinary,
expected placements) and orders an AI-styled render gets *something* drawn (the sheet still
compiles, the marker is still labelled and legended), but the model has no instruction for what that
something should look like and will improvise. Six of the 21 (`tree_natal_plum`, `tree_wild_plum`,
`tree_waterberry`, `tree_pomegranate`, and the four generic "Other …" fixtures) are actual named
farmer-facing catalog species/fixtures, not just editor plumbing, which is why this is ranked
moderate rather than minor.

### Moderate — Gap 2: two catalog elements get the WRONG AI vocabulary, not just none (not test-enforced — see below)

Two elements are marked `Y` above because *a* vocabulary entry fires for them, but it is the wrong
one:

- **`banana_clump`** ("Banana Clump", a standing clump of banana plants) matches
  `ICON_MATCH.banana` = `/banana/i` (`lib/producer-prompt.ts:626`) unanchored, so it receives
  `OVERLAY_ICONS.banana` (`lib/producer-prompt.ts:556`) — the description of a **Banana *Circle***:
  "a sunken pit … ringed by a raised earth bund … banana leaves fanning out over the rim." A simple
  clump is not a sunken earthwork pit.
- **`keyhole_bed`** and (on the Showcase path only) any bed-named element matches
  `SHOWCASE_MARKER_MATCH.bed` = `/bed|vegetable garden|veg garden/i` (`lib/producer-prompt.ts:426`)
  and receives `M.bed` (`lib/producer-prompt.ts:354`) — "green rectangles are vegetable beds full of
  cabbages and leafy greens." Keyhole Bed is catalogued as a **circle** (`lib/design-elements.ts`,
  `keyhole_bed.shape === 'circle'`) with a distinctive central compost basket, not a rectangle of
  cabbages.

This is a content-correctness issue, not a presence/absence one, so it is not encoded as an
automated assertion in `tests/catalog-matrix.test.ts` (doing so would mean hand-copying the private
regex/description text out of `lib/producer-prompt.ts`, which is the exact "second copy that
drifts" failure mode this audit exists to prevent). Recorded here for whoever next touches either
vocabulary table.

### Minor — Gap 3: three elements are absent from the whole-design masterplan sheet's own grouped legend summary

`sheetLegendRows`'s `filter === 'all'` branch (`components/design/DesignGlossy.tsx`, ~lines
6697-6727) builds the masterplan's legend from six hand-written `summaries` buckets (regex-on-name
or category+shape matches), not from `itemInFilter`. Reading it by hand found three earthworks
elements whose **circular** footprint and non-matching **name** fall through every bucket:
`keyhole_bed`, `herb_spiral`, `half_moon`. (`tree_basin`, `greywater_basin`, `infiltration_basin`,
`banana_circle`, `berm` and `terrace` all match on a name substring — "Basin", "Banana Circle",
"Berm", "Terrace" — so they are fine; `raised_bed` matches the rect-shape bucket.)

These three are still drawn on the map, still get their own on-map label (System 5), and still get
a correctly-sectioned row on their **own primary layer sheet**'s legend (System 6a/6b, both
dynamically tested and passing) — the gap is specific to the **summarised** legend on the single
whole-design sheet. Not encoded as an automated test: `sheetLegendRows` lives inside the
JSX/`'use client'` component this test suite cannot import (see the import-safety note above).

### Minor — Gap 4: 17 Structures-sheet elements have no named legend section

`structuresLegendSectionForFeature` (`lib/structures-cartography.ts:82-84`) only names a section for
8 curated "special visual treatment" ids (`compost_bay`, `nursery_table`, `beehive`,
`chicken_tractor`, `shade_house`, `gate`, `tap_point`, `washline`). Every other structures/animal/
access element still earns a legend row (System 6a passes for all of them — `sheetLegendRows` pushes
a row unconditionally once `itemInFilter` is true, section or not) but with no heading, so it lists
above the four named sections (SITE ACCESS & SERVICE / COMPOST & NURSERY / LIVESTOCK & APIARY /
PROTECTED GROWING) instead of under one: `shed`, `greenhouse_tunnel`, `chicken_coop`, `kraal`,
`worm_farm`, `market_stall`, `other_structure`, `goat_pen`, `pig_pen`, `duck_pond`, `rabbit_hutch`,
`water_trough2`, `biodigester`, `shade_sail`, `bench`, `sign`, `solar_panel_ground`.

`waterLegendSectionForFeature` and `plantingLegendSectionForFeature` are both total over the
catalog — every Water and every Planting element gets a named section. Structures is the one sheet
where this was never finished. Locked in as `STRUCTURES_UNGROUPED_IDS` in
`tests/catalog-matrix.test.ts` so the set can only change on purpose.

### Informational, no farmer impact

- **`greywater_basin`'s `alsoSteps: ['water']` is a no-op.** Its category is `'earthworks'`, whose
  `CATEGORY_STEP` primary is already `'water'` — `ownedByCurrentStep` returns `true` on the primary
  check before `alsoSteps` is ever consulted. Harmless (asserts nothing that wasn't already true),
  but worth a comment so a future `CATEGORY_STEP` change that would actually need this entry to do
  work doesn't silently keep "passing" on dead data. Locked in as its own test.
- **The five `SHEET_OVERRIDE` elements' three-way divergence (`raised_bed`, `keyhole_bed`,
  `herb_spiral`, `banana_circle`, `tree_basin`) is *designed*, not a gap.** WIZARD STEP and LAYER
  TOGGLE both read `'earthworks'`/`'water'` (placed from the Water step's palette); OUTPUT SHEET
  reads `'planting'` (SHEET_OVERRIDE). This is deliberate, twice adversarially reviewed
  (2026-07-21, per `lib/design-elements.ts`'s own comment) — a farmer places these from Water and
  expects to find them printed where he plants, not where he dug. Locked in as its own test
  precisely so that if this divergence ever collapses back to one answer, that change gets reviewed
  consciously rather than shipping as a silent regression of the exact bug it was fixed to prevent.
- **`water_trough` (category `water`, an overflow/livestock trough near a dam) and `water_trough2`
  (category `animal`, display name "Livestock Trough") are two different catalog ids with
  confusingly similar English names.** This is very likely *why* the Showcase vocabulary's
  `livestock_trough` key (`/livestock trough/i`) never fires for `water_trough` — the names don't
  literally match each other. Not a functional bug (both elements individually resolve correctly
  through every one of the six systems, and `water_trough` is covered on the Overlay path via its
  own dedicated `water_trough` key) but a naming-hygiene observation worth flagging if the catalog
  is ever consolidated.

## Test summary

`tests/catalog-matrix.test.ts` — 11 tests, all passing, added to `package.json`'s `test` script.
Full suite: 378 tests passing (baseline 339 + this file's 11 + other in-flight work already present
in the shared working tree). `npx tsc --noEmit` clean. `npm run build` passes.
