# Crop-plan truth audit — 6 August 2026

## Decision

The planner must not infer household taste from a location, a rural/urban label,
or a generic cultural profile. Auto-suggest now requires the farmer to choose the
exact crops the household or buyers want. That list is a strict whitelist: closing
gap-fill and plot-cover passes cannot silently add an unchosen crop.

The planner also does **not** claim a mathematically global maximum. Space use,
harvest weight, harvest rhythm, rotation, household variety, labour and market
demand are competing objectives. The current engine is a deterministic packing
heuristic within the farmer's exact crop list, sow windows, mapped bed area,
the botanical-family rule when enabled, and irrigation confirmation. The screen
says this plainly.

## Primary numeric authorities

- [KZN DARD expected yields](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/expected_yields.pdf): the planning point is the conservative commercial kg/m² entry, with the conservative-to-likely range retained as context. It is a comparison benchmark, not a lower bound or a household-yield promise.
- [KZN DARD plant establishment](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/plant_establishment.pdf): warm/light-frost sowing windows, row and in-row spacing ranges where listed, and sow depth where listed. Its 10–15% allowance belongs to the guide's open-seedbed method; it is not a universal direct-field seed allowance. The buying list therefore does not turn final plant spacing into an exact botanical-seed order.
- [KZN DARD length of growing period](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/length_of_growing_period.pdf): days to first harvest and usual picking periods where the crop is listed. The table says these are approximate values under optimum conditions, cultivar-dependent, and that crops are often later in practice. A published range is represented with its upper endpoint in the coarse monthly calendar, but a following crop is still conditional on observing that the bed is actually clear.
- [KZN DARD successional cropping](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/successional_cropping.pdf): crop choice, planting size and succession depend on the grower's household/market needs, climate, land, water and labour; they are not universal defaults.
- [KZN DARD plant populations and spacings](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/plant_populations_plant_spacings.pdf): increasing density does not have one universal response. Yield can peak and then fall through competition, while produce size and fruiting behaviour change the trade-off. A published spacing range therefore cannot prove one maximum-yield midpoint.
- [ARC crop rotation and intercropping manual](https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Climate%20Smart%20Production%20Types/Manual/Microsoft%20Word%20-%20CA%20Crop%20rotation%20Manual.pdf): rotation is a multi-season, locally constrained decision. The app checks immediate botanical-family repeats only; it does not invent missing multi-year history.
- [DAFF maize production guide](https://www.nda.gov.za/phocadownloadpap/Brochures_and_Production_Guidelines/Maize%20brochure%20updated%20Nov%202022.pdf) and [Grain SA harvest guidance](https://www.grainsa.co.za/the-how-s-and-why-s-of-yield-estimation): dry-grain maize depth, population and planting-to-harvest cannot be replaced by a sweet-corn figure or one generic 120-day release date.
- [ARC groundnut production guide](https://www.arc.agric.za/arc-gci/Fact%20Sheets%20Library/Groundnut%20Production.pdf): planting season, frost-free period, and separate irrigated/rainfed population guidance.
- [Current GDARD vegetable production guide](https://www.nda.gov.za/images/how-to-start/home-gardening/vegetable-production-guidelines-gdard.pdf): the audited 180–210-day garlic period and planting geometry.
- [DAFF amadumbe guide](https://www.nda.gov.za/phocadownloadpap/Brochures_and_Production_Guidelines/Brochure%20Amadumbe%202010.pdf) and the [UKZN Umbumbulu spacing trial](https://researchspace.ukzn.ac.za/server/api/core/bitstreams/95e74060-48b9-42a6-b20b-f56c18dade90/content): the previous yield and printed spacing came from materially different trial densities, so the yield point was removed.
- [Starke Ayres coriander guidance](https://www.starkeayres.com/products/commercial-farming-seed/herbs-1/coriander-american-long-1): 40–55-day seasonal range and 30–35 cm by 8–10 cm geometry for the named commercial type. Coriander remains farmer-chosen rather than culturally inferred.

## Corrections made

- Replaced mid-range or approximate yield points with the published conservative
  commercial point for each covered crop.
- Changed kale and coriander yield to `null`: neither has a verified fresh-food
  kg/m² line in the chosen authority, so neither can drive auto ranking or totals.
  Both remain available for a farmer to add manually.
- Kept a soil cover crop separate from unknown food yield: zero means zero **food**
  kg by design; `null` means the food benchmark is not verified.
- Corrected warm/light-frost windows to the crop-specific KZN table where covered.
- Corrected transplant timing: the nursery month is no longer counted as a month
  occupying the bed, and the published post-transplant growing period starts when
  the seedling enters the bed.
- Uses the upper supported maturity and picking-period endpoint for bed occupancy,
  then rounds maturity **up** in the coarse monthly calendar. This avoids freeing a
  bed before the published crop period is over. It does not turn that endpoint
  into a promise: every successor remains conditional on observing that the crop
  is finished and the bed is clear. A two-week or one-month picking period still
  occupies only its first harvest month.
- Replaced farmer-facing spacing midpoints with the published row, in-row and
  sow-depth **ranges**. The internal midpoint is used only to order and reconcile
  approximate area arithmetic; it is no longer printed as though one density
  universally maximised yield.
- Removed uncited fixed storage-month constants. Storage availability now needs
  both a source and named conditions before the app extends a harvest into later
  months.
- Removed the fixed intercropping yield penalty. Without a named pair, row layout
  and management evidence, a universal bonus or penalty is invented precision.
- Separated household food groups from botanical rotation families.
- Made reliable irrigation an explicit requirement for automatic intensive
  succession; a checkbox is still not a water-volume calculation.
- Removed generic dated mulch and weeding jobs: soil cover, weed pressure, crop
  stage and local practice decide whether and when they are appropriate.
- Replaced universal manure, compost and ploughing instructions with a soil and
  drainage assessment. Amendments and cultivation require a soil test or local
  advice.
- Aggregated crop area by planting cohort before calculating final plant
  positions. Exact botanical-seed buying counts are withheld until a
  crop-specific sowing-rate model exists. Piece counts are shown only for
  seedlings, cloves, corms, slips and seed potatoes where both spacing axes are
  verified, and a published spacing range produces a field-position range rather
  than one fake-exact purchase count.
- Removed the invented even monthly kg and Rand allocation. The app now keeps the
  source-backed crop-cycle total separate from fresh-picking timing.
- Requires the farmer to confirm both sell/loss assumptions before showing a Rand
  what-if subtotal. It is labelled as a crop-cycle scenario, not annual profit,
  monthly cashflow, a live quote or buyer demand.
- Keeps oats readable in old plans, but excludes it from new scheduling, exact
  occupancy, tasks and buying quantities because the audited source set did not
  support the old exact 6 cm / 100-day instruction.
- Keeps grain maize and kale readable in old records but excludes them from
  automatic scheduling because the audited sources do not support the catalog's
  old exact duration-and-layout combination. Maize population depends on the
  actual grain use, cultivar, rainfall/yield target and row system; sweet-corn
  depth or timing cannot be borrowed for dry grain.
- Excludes amadumbe from yield ranking and kilogram totals. Its former 0.45
  kg/m² point came from a denser trial layout than the planting layout the app
  printed, so applying that yield to the wider layout was not defensible.
- Uses an irrigated groundnut row range for an engine that requires managed
  water, rather than pairing a rainfed row width with an irrigation-gated plan.
- Automatic planning now requires all three authorities for a crop: a supported
  crop-cycle yield benchmark, duration, and field-spacing basis. A crop missing
  any one remains available for factual records or manual review but cannot win
  an automatic ranking.
- Replaced generic product-rate and "organic means safe" advice with the South
  African rule: a remedy must be currently registered for the exact crop and
  problem, and its current label controls dose, protection, re-entry,
  pre-harvest interval, storage and disposal.

## Remaining limits shown to the farmer

- A commercial benchmark is not a forecast for a home garden. Cultivar, soil,
  irrigation, pest pressure, management and weather can move the actual harvest.
- Some catalog fields and non-KZN regional windows still come from cited crop
  guides or legacy general windows. They require local confirmation and cannot
  be described as a site-specific optimum.
- Kale and coriander have no verified fresh-food kg/m² benchmark in this source
  set. They remain manually selectable because the farmer may genuinely want
  them, but they cannot drive auto-ranking or kilogram/value totals.
- Where a crop lacks both verified spacing axes, the app withholds the planting-
  material count and tells the farmer to confirm a local row layout. Where a
  source gives ranges, it prints those ranges. It does not label an internal
  density midpoint as a buying quantity or a yield-maximising density.
- Bed fractions and planting counts are area arithmetic, not a generated row map.
  Auto-suggest does not mix different crops in one bed; a farmer can split a bed
  manually after choosing a real pair and layout.
- Household headcount is ignored. Without consumption, preservation, labour and
  nutrition inputs, turning a headcount into crop repetitions would be invented
  precision.
- "Grow extra to sell" ranks supported choices by conservative fresh-weight
  kg/m² per crop cycle. That is not profit, nutrition, buyer demand or proof of a
  global optimum. Prices are editable scenario inputs, not crop-selection evidence.
- Published spacing ranges do not identify one universal maximum-yield density.
  Crop, cultivar, site, management and desired produce size change the response
  to plant population. The planner can minimise unused mapped bed-months within
  the farmer's crop whitelist; it cannot prove agronomic maximum production.
- The year-two view repeats the one saved annual cycle as a faded scenario. It is
  not a separately decided second-year rotation.
- Rotation checks only the immediate chronological botanical-family neighbour
  represented in this one-year plan (plus supplied prior crop records). It does
  not claim to construct a complete multi-year rotation history.

## Verification standard

The fast suite checks the source-state distinctions, exact crop whitelist,
irrigation gate, timing, occupancy, rotation-family behavior, seed arithmetic and
report/export reconciliation. The stress harness builds thousands of different
farms and independently checks over-commitment, remainder area, plot rules,
calendar jobs, yield reconciliation and printed quantities. Visual verification
must still be done in the crop-plan screen: green tests cannot prove that the
choices and caveats are understandable.

The standard post-audit stress run generated **2,592 farms**, **40,856
plantings** and **269,568 vegetable bed-months**. All 20 independent checks were
clean. Mean mapped vegetable-bed utilisation was **56.7%**. That percentage is
descriptive evidence about this test population, not proof of a global optimum;
crop whitelists, rotation, real sow windows, picking periods and honest rest
periods intentionally leave some ground-months unused.

---

## Addendum — 2026-08-23: kale

The line above ("Changed kale and coriander yield to `null`") no longer describes
kale. Both halves of its basis were sourced on 2026-08-23:

- **Schedule** — Kirchhoffs (40×40 cm, 100–120 days to harvest) and Starke Ayres
  (55–60 days to maturity, 1 cm sowing depth) put kale on the calendar.
- **Kilograms** — `yieldKgPerM2: 1.5`, range 0.8–3.0, from **international**
  extension sources: KALRO Kenya, MOALF Kenya / JICA SHEP PLUS, Oregon State and
  Oklahoma State. **No South African kale food-yield figure exists** — re-checked
  across all five KZN DARD vegetable-production tables, the DALRRD leafy-vegetables
  brochure and the GDARD vegetable guideline; Agricol's kale figure is fodder dry
  matter, and FAOSTAT folds kale into "cabbages and other brassicas". The farmer-
  facing note says so in those words.

The published international figures are irrigated, fertilised, full-picking-life
numbers (37–43 t/ha). The catalog point is deliberately **below** them: at this
entry's own 40×40 cm = 6.25 plants/m², 1.5 kg/m² is 0.24 kg/plant over the 120-day
occupancy, sized against two independent per-plant checks (Utah State Extension
home-garden 0.14–0.23 kg/plant; a published spacing trial at 166 g/plant) rather
than against the commercial totals. An initial 2.0 kg/m² proposal was rejected in
review: its per-plant sanity check used the Kenyan 60×40 cm density (4.2 plants/m²)
instead of this catalog's own 6.25, which inflated the result by ~25%.

**Coriander is unchanged** — still `null`, still the catalog's unverified-yield case
alongside amadumbe (verified schedule, no published kilograms).
