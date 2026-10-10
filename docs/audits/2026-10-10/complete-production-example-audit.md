# Complete production example and quantity audit

Release review: 11 October 2026. Branch: `codex/complete-production-example-20261010`.

This work extends the real Production plan and provides `/samples/production` as a
fictional example. It is not a review of Ubhejane's current saved map or a claim that
every edible species has a verified production model in every South African climate.
No real farmer records were entered or changed during the browser tests.

## What the farmer sees

- Vegetables and staples, forest foods and animal products share illustrated monthly
  rows. A banana circle remains Banana, with three plants per circle rather than a
  separate food source.
- The example includes six vegetable beds, seven staple plots, eleven forest sources
  and six animal products. Groundnuts (peanuts), moringa and pigeon pea are visible.
  Moringa's sourced reference concerns pods; it does not invent leaf-picking dates.
- Fresh food, fresh plus kept food, production weights and occupied/free crop space
  have separate graphs. Stored, frozen, dried, fermented and processed foods can be
  switched on and off. Dried mango and stored macadamias have their own pictures.
- Expected and actual monthly quantities can be entered for a selected site. An
  actual record replaces the expectation for that source and exact month. Zero is
  an observation; blank remains unknown. Eggs, litres and items keep their units.
- A farmer's own price can show quantity times price before costs. Existing crop
  R/m² tools retain their area, loss, price and sold-quantity assumptions; these
  records do not supply a market price or claim profit.
- Tree cohorts retain planting dates and age-specific yield assumptions in the
  future yearly projection. Missing yields remain unknown. Annual tree kg are not
  distributed into monthly bars without monthly production records.
- The short printable booklet includes the shared food and space graphs. A separate
  detailed reference and one-page A2 picture calendar remain available.

## Shared calculation boundaries

Food bars count distinct food sources, not portions, calories, meals or kilograms.
Research-only harvest references and undated food sources remain visible in the
calendar but do not become confirmed availability. Housing does not establish
animals, production months or quantities. Non-food wool and cover crops are excluded.

The kg graph has three views. Crop-cycle estimates are the full benchmark allocated
to the first-picking month for comparison, explicitly not that month's harvested
weight. Monthly production uses exact dated expected/actual records. Food in store
uses exact dated stock weights, independently of production. A stock observation
does not infer a subsequent month's amount, shelf life or preservation recipe.
Partial subtotals identify missing weights. Small positive quantities remain visible;
overflow becomes a quantity-check notice rather than Infinity or a false zero.

The sample has 820 m² of fictional vegetable/staple ground. The known crop-cycle
subtotal is 692 kg; Amadumbe's missing benchmark, missing forest yields and animal
quantities are excluded. Forest, housing and pond area are outside the crop-space
graph. Occupancy is capped per bed for the graph; existing overlap checks still
determine whether simultaneous plantings fit.

A recorded zero stock amount suppresses the same food's planned pantry contribution
only when all matching stored batches for that date have a known zero. Another
unknown or positive batch remains possible food. A zero frozen batch does not delete
ordinary stored food, and a stock observation does not delete fresh production.

## Farm ownership and persistence

Production and stock records use the existing account-scoped crop-plan store and
save/undo flow, with an explicit site owner. The selected map's site (or stable
design owner when no site is linked) controls the graph, editor and both PDF inputs.
Switching farms resets the editor. Returning to the local design restores its map.
Records for other farms are preserved rather than replaced by the current editor.

Older records without a site are retained and counted in an explanatory notice but
excluded from farm totals. The app does not guess their owner. Two farms can retain
the same source, date and imported record ID without overwriting one another.

Sign-in migration also recognizes production-only and stock-only work as a real
plan. An account's observations are protected even with no crop plantings, and a
guest's records can transfer into a genuinely empty account without being lost.
The existing real AuthProvider/sign-in harness verifies both paths, including zero
observations and retaining a guest draft when an account already has work.

## Research and artwork coverage

The perennial authority has 37 researched profiles, 32 with dates and 50 distinct
regional/cultivar windows. Grapes, peaches, apples, figs and pecans are covered.
Coverage is not complete across all 122 existing catalogue entries tagged as food;
many entries are annuals or aliases, and several perennial products still lack local
dates or yield-by-age evidence. A mapped edible plant remains listed when a dossier
is missing, without inventing a season or yield.

The new Apple profile keeps two narrow references separate: Afri-Star's
December/January dates come from the Bien Donne/Simondium Western Cape trial;
Granny Smith's fourth-week-of-March first pick comes from Elgin. They are not a
national season or a warm KZN harvest assumption. Generic bearing ages, annual kg,
pollination and chill requirements remain unknown where the source is missing.
The existing default Apple Tree element now resolves to the existing Apple species;
an explicit species choice still takes precedence. No catalogue species was added
or renamed.

The picture gallery covers 45 food crops, 38 forest-food pictures (37 dossiers plus
the existing pigeon pea), 15 animal enterprises and six kept-food examples. Meat
from cattle, chickens, ducks, rabbits, goats, pigs and sheep uses different images.
Milk from goats and cattle is distinct. Different breeds producing the same food
may share its picture. Illustrations identify products, not climate suitability or
production evidence. See `additional-production-art-prompts.md` for asset provenance.

Eight synthetic South African zone fixtures exercise existing climate parsing,
sowing gates and heat/frost behaviour. They use four coarse catalogue sowing columns;
this is software coverage, not independent agronomic validation of every locality.
The fictional sample fixes November 2026–October 2027 for stable comparison; a real
plan follows its current planning month. No live climate data is fetched by the sample.

## Verification evidence

- Focused final checks: 43 PDF tests, 51 perennial/sample tests and 30 availability
  graph tests pass, as do six sign-in migration tests. The site-record integration
  test also fails when each of five
  simulated wiring mistakes is introduced. Assertions were not removed to pass.
- Browser checks covered desktop and a 390px phone, graph month selection, all kept
  food filters, quantities, native units, own prices and the artwork gallery.
  Expected Banana 8 kg with actual 0.4 kg shows 0.4 kg, not 8.4 kg. A price of R20
  shows R8 before costs. Egg/litre observations retain their units. Stock is excluded
  from new production. These are fictional test amounts, not yield recommendations.
- Entering an empty maize store with May 2027 stock of 0 kg reduced the fresh-plus-
  kept count from 10 to 9 while fresh remained 7. Removing that temporary example
  restored 10. The sample was then reset to its baseline six stock records and no
  monthly quantity records.
- The phone graph's scroll container keeps the wider month axis contained. The page
  and main container have no uncontained overflow. Stock fields stack on the phone.
- Final source PDFs: 19-page booklet, 61-page detailed reference and one-page A2
  calendar. All 81 pages were checked for bounds and fictional notices, with no
  off-page text characters. Calendar, food/space graphs, kg explanations, future
  projection, pigeon pea age row and detailed planting layout were visually inspected.
- The current app's Download plan action succeeded. Its actual 19-page PDF was
  rendered and its food/space and kg pages were inspected separately from the source
  renderer's outputs.

Local evidence is under
`/Users/roryclark/ImbewuField/output/pdf/complete-production-example-2026-10-10/`:
`app-downloaded-booklet-final.pdf`, `app-download-final-08.png`,
`app-download-final-09.png`, `app-fruit-product-pictures-final.png`,
`app-food-graphs-phone-final.png`, `calendar-a2-final.png`, `bounds-check.json`.
Generated evidence stays outside the source commit.

The final full-suite, exact-head CI and deployed-build results will be recorded in
the pull request and issue #35 release ledger. Earlier-head CI does not cover this
expanded change.

This changes the picture. `PLAN_VERSION` is untouched. Rendering does not mutate
saved map geometry. No lesson content, secrets, rule deployment or paid sheet
render is part of this release.
