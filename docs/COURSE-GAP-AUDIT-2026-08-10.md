# Course gap audit — what a South African smallholder is not being taught

**Date:** 2026-08-10
**Scope:** the 10 authored modules in `lib/course-modules.ts` (33 lessons, 240 minutes) plus the
narration scripts in `docs/narration/`, read as a permaculture/agroecology curriculum for
small-scale South African farmers.
**Companion:** `npm run course:calendar` — the course fills 25 of the 36 weeks it promises.
Several gaps below are candidates for the 11 empty ones.

## How to read this

Every **PRESENCE** claim is a fact you can check with `grep`; the counts were taken this way.
Every **WHY IT MATTERS** claim is a curriculum judgement and is Rory's to accept or reject. Where
this document is uncertain it says so rather than rounding up to confidence.

Nothing here proposes generated content. `lib/course-assignment-content.ts` states that the course
figures and pacing are Rory's and must not be regenerated, and this repo has already been burned
once by generated agronomy softening authored facts (see `feedback_generated_content_hedging`).
These are gaps named, not gaps filled.

---

## Tier 1 — a farmer can lose the flock, the dam, or the land

### 1. Newcastle disease is never taught

**Presence:** the string "Newcastle" occurs **once in the entire course** — as a distractor in a
`small-livestock` quiz (`options[2]`, with `correct: 1`). It appears only as a statement that is
false.

**Why it matters:** the course teaches a farmer to build a flock — chicken tractors, "4-6 chickens
rotated through a 500m² plot can maintain fertility with no bought fertiliser" — and never names
the disease most likely to end that flock. A farmer who follows this module and loses every bird
was not warned by it.

**Shape of the fix:** a lesson or key point in `small-livestock-l1`. This is animal-health content
and needs Rory's sourcing, not mine.

### 2. The course teaches dam building with no mention of water law

**Presence:** "water use", "licence"/"license", and any reference to the National Water Act:
**zero** across all modules and narration.

**Why it matters:** `water-harvesting-l2` teaches sizing a farm dam, designing a spillway and
building a wall. It does not say that storing or impounding water can require registration or
authorisation. The course already knows how to raise this kind of point and does so twice —
*"All beekeepers must register with DALRRD under the Agricultural Pests Act — even one hive"* and
*"Check your municipality's greywater rules before installing a permanent system"*. So the
omission is an inconsistency inside the course's own standard, not a difference of philosophy.

**Uncertainty flagged:** which storage volumes and which watercourse situations require what, and
under which Schedule, is a legal question. This audit asserts only that the course says nothing at
all — not what the threshold is.

### 3. Land tenure and permission are absent

**Presence:** "tenure", "Ingonyama", "Permission to Occupy": **zero**.

**Why it matters:** swales, dams, terraces and a food forest are permanent works with a 5-year
payback. A large share of the intended audience farms on communal land under traditional authority
or as a labour tenant, where the right to make permanent alterations is not the farmer's alone.
The course asks for the earthworks in module 3 and the food forest in module 8 without ever asking
whether the farmer may make them, or will still be there in year five.

### 4. Fire

**Presence:** fire appears in `intro-permaculture` as a *sector* (an incoming energy to map).
"Firebreak" appears **once**, in narration only (`intro-permaculture.en.md:269`), inside a sentence
about zone logic. It is in no lesson, no key point and no assignment.

**Why it matters:** in Highveld and grassland regions veld fire is an annual event, and a young
food forest is exactly the asset it destroys. There is also a statutory dimension (National Veld
and Forest Fire Act) the course does not raise.

---

## Tier 2 — structural gaps for an *agroecology* course in this country

### 5. The staples are maize-centric; the drought-adapted grains are absent

**Presence:** "sorghum" **0**, "millet" **0**, "bambara" **0**. Cowpea appears once, as a cover
crop only — never as a grain or pulse to eat. `vegetables-staples-l3` is titled "Staple Crops:
Maize, Beans, and Root Vegetables".

**Why it matters:** sorghum, millet, bambara groundnut and cowpea are the traditional southern
African staples, and they are the ones adapted to the rainfall variability the course elsewhere
tells farmers to design for. A course that teaches climate resilience and then teaches maize as
*the* grain is arguing against itself. This is also the substitution agroecology as a discipline
most often critiques, so its absence is conspicuous in a course that leads with the ethics.

### 6. Imifino / morogo — the indigenous leafy vegetables — are not taught

**Presence:** "imifino" **0**. "amaranth" **0**. "morogo" appears **once**, as an example item in a
record-keeping sentence ("every bundle of morogo"). Blackjack appears **only as a weed indicating
compacted soil** — never as food.

**Why it matters:** these are the drought-hardy, nutrient-dense greens already growing on most of
these farms, already known to the households, requiring no seed purchase. The course teaches
Swiss chard, kale and cabbage — all introduced, all thirstier. Naming blackjack as a compaction
indicator and never as a vegetable is the single clearest example of the gap.

### 7. Post-harvest handling and storage

**Presence:** "post-harvest" **0**, "weevil" **0**, "solar dry" **0**, "curing" **0**.

**Why it matters:** `market-community-l3` states the problem in the course's own words — *"About a
third of smallholder fruit and vegetables is lost between harvest and sale"* — and then teaches
local selling as the answer. Nothing teaches harvest timing, shade, curing onions/pumpkin/sweet
potato, drying, or protecting stored maize and beans from weevils. For a food-security course this
is the largest single gap by household impact, and it needs no land and no money.

### 8. Nutrition and the household food basket

**Presence:** "nutrition" 2 passing mentions. Nothing designs the garden around what a family
needs to eat across a year.

**Why it matters:** People Care is stated as an ethic in module 1 (*"your family's needs come
before market production"*) and is never operationalised. `market-community-l1` gets closest —
*"Records reveal which months you're food-insecure"* — but the course never teaches what to plant
to close that gap, and the hungry-gap point in `vegetables-staples-l2` is about supply continuity,
not nutrition.

### 9. Grazing and rangeland

**Presence:** "graz" 9 hits, all incidental — a neighbour asking to graze cattle after a drought,
and overgrazing named as a cause of dead soil. "Rotational grazing" **0**.

**Why it matters:** `small-livestock` covers chickens, bees, ducks and goats-in-passing. Most
smallholders here who keep animals keep cattle and goats, often on shared commons, and that is
where both the fertility and the degradation are. The module teaches the animals that fit a
garden, not the animals most of the audience actually has.

---

## Tier 3 — capability gaps that cost money or block scale

### 10. Propagation and the nursery

`food-forest-l3` instructs *"start a nursery"* as a year-one step. No lesson teaches how.
"Graft" appears twice, once as an example of a skill a *neighbour* might have. Raising your own
seedlings and grafted trees is the biggest input saving available to a smallholder and a
straightforward income stream, and the course points at it twice without opening it.

The `seeds-sovereignty` module is excellent and covers **vegetable seed only** — dry method, wet
method, drying, storage. Vegetative propagation is a different skill and is not there.

### 11. Winter-rainfall regions, and the planting calendar itself

**Presence:** "winter rainfall" **0**, "planting calendar" **0**, "frost date" **0**.

The course is written for summer-rainfall South Africa throughout — Highveld, KZN, Lowveld are
named repeatedly; the Western Cape's winter-rainfall regime is never mentioned. That may be a
deliberate scoping decision, in which case the course should say so rather than read as national.

Separately, no lesson teaches reading a planting calendar or working from first/last frost. The
app computes this; the course never teaches the farmer to think in it. This is the same gap the
calendar audit found from the other side.

### 12. Erosion repair — dongas

Erosion appears 6 times, always as something to *prevent* (mulch, cover crops, contour). Nothing
addresses repairing an existing gully, which is the state a great deal of communal land is already
in. Vetiver is named once, for slopes above 15-20%.

### 13. The design process, phasing and budget

The capstone asks for a complete site plan — boundary, water, zones, planting, structures, plan
set exported. `intro-permaculture` teaches ethics, principles, zones and sectors. No module
teaches the *process* between them: survey → analysis → concept → phasing → what it costs → what
order to build it in. The Design Studio implements this; the course does not teach it.

### 14. Groups, co-ops and public support

"Co-op"/"cooperative" 2 passing mentions, "grant" **0**. `market-community-l3` teaches informal
community networks — seed swaps, tool sharing, skills swaps — and stops short of formal group
formation or any route to state support (DALRRD programmes, CASP, Ilima/Letsema). Whether that is
in scope is a judgement call; it is recorded here because the module is the natural home for it.

---

## One internal inconsistency, cheap to fix

The course names a cover-crop and companion-planting backbone the **crop planner cannot plan**:

| Named in the course | In `lib/crop-catalog.ts` (26 crops) |
|---|---|
| Sunn hemp (5 mentions) | no |
| Lupins (2) | no |
| Cowpea (1) | no |
| Sunflower (2) | no |
| Marigold (4) | no |
| Comfrey (10) | no |
| Oats | **yes** |

A farmer is taught in `soil-health-l3` that legume cover crops fix nitrogen for free, then opens
the planner and finds oats is the only cover crop in it. Comfrey is named ten times across the
guild module and does not exist in the app.

This one is a data gap rather than a curriculum gap, and unlike everything above it does not
require new teaching — the crops are already described in the lessons.

---

## What this audit does not claim

- It does not rank these against each other for **launch** priority. Severity is not urgency —
  that call is Rory's (`feedback_prelaunch_priority`).
- It does not assert any legal threshold, dose, spacing or figure. Where a gap is legal or
  agronomic it names the gap and stops.
- It has not checked the isiZulu narration for gaps of its own. The English is the source; a
  missing topic is missing in both.
