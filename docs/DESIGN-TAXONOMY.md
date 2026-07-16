# Design Studio taxonomy — layers, categories & where earthworks go

**Status:** proposal for review (Rory asked to "research" this). The safe part — 3 new
water elements (Tree Basin, First-Flush Filter, Pump & Filter) — is already shipped
(`52e48f2`). The **structural re-categorisation below is NOT built yet** — it re-tags
existing elements and adds layers/steps, which changes what shows where, and I won't land
that blind (can't click-test behind the Firebase login). Greenlight it and we build it
together with you testing live.

## The question
1. Should "Structures" be split into **structures / access / pathways** (and animals)?
2. Where do **earthworks** live — raised beds, tree basins, banana-circle pits, mulch banks, swales?

## What the discipline says (the research)
Permaculture design has a canonical **order of layers**, most-permanent first — Yeomans'
*Scale of Permanence* (keyline design), echoed in every PDC:

> **Climate → Landform → Water → Access/Roads → (Earthworks) → Structures → Fences/Subdivision → Soil → Trees/Planting**

The practical working layers most tools expose:

| Layer | What it holds | In our app today |
|---|---|---|
| **Water** | tanks, pipes, taps, greywater, ponds/dams | ✅ `water` category |
| **Earthworks** | swales, berms, terraces, tree basins/half-moons, banana circles, raised beds, infiltration basins | ✳️ scattered across `growing` + `water` + line kinds |
| **Access** | paths, roads, driveway, gates | ✳️ `access` is a grab-bag (gate + bench/sign/solar/washline) |
| **Structures** | sheds, compost, nursery, shade house, greenhouse | ✅ `structure` |
| **Animals** | pens, coops, hutches, hives, troughs | ✅ `animal` (no own layer toggle) |
| **Zones / Sectors** | analysis overlays | ✅ zones |
| **Planting** | trees, beds, guilds, hedges, strips | ✅ `growing` |

**Key finding:** earthworks is a *first-class* design layer that sits between Water and
Structures — it's the land-shaping that makes water and soil behave. Raised beds, tree
basins and banana-circle pits are all **minor earthworks**. Right now they're filed under
"planting" (banana circle, keyhole bed, herb spiral, mulch bank) and "water" (tree basin,
greywater basin), which is why it feels muddled.

## Recommended taxonomy

**Categories** (drive the catalog + layer toggles): `water · earthworks · growing · access · structure · animal`

**New `earthworks` category** — re-tag + add:
- move here from `growing`: `banana_circle`, `keyhole_bed`, `herb_spiral`, `mulch_bank`
- move here from `water`: `tree_basin`, `greywater_basin`
- add: **Raised Bed**, **Swale** (also a line), **Berm / contour bank**, **Terrace / retaining bank**, **Half-moon (demi-lune)**, **Infiltration basin**
- keep the water-*infrastructure* (tanks/taps/pipes/pump/first-flush) in `water`

**Clean up `access`** — it should be paths + driveway + gates only:
- keep: `gate` (+ path/fence line kinds, + the traced driveway)
- move `bench`, `sign`, `solar_panel_ground`, `washline` → `structure` (they're misc structures, not access)

**Animals** — give `animal` its own layer toggle (already its own category); keep it in the
Structures *step* but as a separately-toggleable layer.

**Layer toggles** (add): Earthworks, Access, Animals — alongside the existing Water / Zones /
Planting / Structures / Base / Ground / Lines / Labels / Contours.

**Steps** — keep the count phone-friendly; don't add three new steps. Suggested:
`Base · Water · Earthworks · Zones · Planting · Structures & Access · Review · Glossy`
(Earthworks folds naturally right after Water; Access rides along in the Structures step.)

## Implementation plan (when greenlit — tsc will force most of it)
Adding to the `ElementCategory` union makes TypeScript flag **every** `switch (category)` and
`CATEGORY_META` gap, so the compiler walks us to every site that needs handling. Touch points:
1. `lib/design-elements.ts` — extend `ElementCategory`; add `CATEGORY_META` rows; re-tag elements; add the new earthworks elements.
2. `components/design/DesignPalette.tsx` — `ActiveLayers` (+earthworks/access/animals); `LAYER_TOGGLES`; `layerForCategory()` (the Pro catalog filter, `dc0c88d`); `categoriesForStep()`.
3. `components/design/DesignCanvas.tsx` — `ActiveLayers`; item render gating by the new layers.
4. `app/design/page.tsx` — `activeLayers` default state (new keys default **true** or elements vanish).
5. `components/design/DesignGlossy.tsx` — `itemInFilter`/`GlossyLayerFilter` if earthworks should be its own glossy/print layer + Blueprint.
6. `components/design/DesignWizard.tsx` + `lib/design-canvas.ts` — `WizardStep`/`STEP_ORDER`/`STEP_LABELS` if we add the Earthworks step.

**Migration risk:** re-tagging an element changes which step/toggle surfaces it; existing saved
designs keep their `defId`s (unaffected — placement is by id, not category). The only visible
change is *where in the palette* an element appears. Low data risk, medium UX-churn — worth one
live test pass together.

## Why not build it tonight
It re-tags live catalog elements and adds layer/step plumbing across 6 files. tsc catches the
type holes, but "does the earthworks toggle actually show/hide the right chips, and does nothing
vanish" is only answerable by clicking — which I can't do behind your login. Shipping it blind
risks you waking to an empty or mis-sorted catalog. So: elements added now (safe); structure on
your say-so, with you testing.
