# Market-gardener sales units

Rory asked to focus on agroecological commercial market gardeners and the organisations supporting them. This extends harvest targets in PR #1163; merge that parent first. The branch retains the parent's ancestry so its finished checks can run while the parent completes its full suite. No catalogue figures, species, lessons, saved geometry, permissions or PLAN_VERSION change. This changes the crop-planner screen, not rendered design sheets.

## Delivered behaviour

- Targets accept kg, bunches, bags, crates, trays of harvested produce and individual items/heads. The units and whole-item validation come from the existing farm-records authority. Old kg-only targets retain their saved shape.
- A produce-pack target owns its grower-entered harvest kg per pack. No weight is supplied by default or borrowed from another crop, outlet or farm. Unknown pack weights remain saved and visible; demand mass, area and shortage remain unknown and no automatic sowing is allocated.
- An optional grower-entered saleable share scales credited target capacity and required crop-cycle area. Blank means no allowance; 0% cannot supply saleable demand. It does not rewrite catalogue yields, production graphs, recorded harvests or measured beds. Farmer-facing copy calls this the benchmark before the allowance: the catalogue does not establish that its yield figures represent gross field biomass.
- Cards and reviews show pack equivalents alongside kg, explicitly as estimates rather than packed inventory. Growers may label the intended market, restaurant or box scheme in their existing account/site-scoped plan. This is not an order, reservation, invoice or shared customer record.
- Existing dated placement, source-calendar, climate, irrigation, whole-field, standard-share and rotation rules remain authoritative. Accepting adds dated rows and the existing calendar tasks; editing an allowance preserves accepted rows and adds only further feasible capacity.

The South African monthly catalogue remains the agronomic basis. Pack conversion is not a weekly harvest curve, international suitability check or fulfilment guarantee. Produce trays are distinct from nursery propagation; tray starts, germination, survival and nursery bench occupancy require their own evidence and workflow.

## Research and product direction

Public [Tend crop-planning](https://www.tend.com/feature/visual-crop-planner), [templates](https://www.tend.com/feature/crop-library), [tasks](https://www.tend.com/feature/task-management), [inventory](https://www.tend.com/feature/farm-inventory-management) and [traceability](https://www.tend.com/feature/produce-traceability-software) pages were read on 1 November 2026. Tend already automates planning and connects it to work and commerce. Automatic planning alone is not a sufficient differentiation claim. Full authenticated Tend help and its polygon-edge behaviour were not tested.

The adjacent opportunities are grower-owned local templates, explicit-date succession/weekly harvest profiles, nursery demand, and a harvest-pack-deliver-review loop. Extend the existing record, invoice and journal systems rather than adding another sales book. Supporting organisations should receive agreed published evidence with coverage and missingness visible. Private outlets are not automatically donor data, and projected bed capacity is not actual production or causal impact. Existing programme-report and MEL consent/evidence boundaries remain intact. A separate illustrated research brief records the detailed comparison, pilot journeys and roadmap.

## Verification

- Typecheck passed; 315 affected tests passed, including 20 harvest-target cases. New cases cover conversions, unknown weights, invalid/ambiguous units, whole items, saleable allowances, unchanged catalogue/geometry/history and account-scoped persistence. Existing behavioural assertions remain; one assessment variable has an explicit type for the widened nullable-mass API.
- Local browser: saved a 10-bunch/week carrot target without a pack weight and saw unknown demand/area; edited it with disposable example assumptions of 0.25 kg/bunch and 80% saleable; reviewed and accepted one dated sowing. A 20 kg unadjusted benchmark displayed as 16 kg / 64 bunch-equivalents after the allowance, with the remaining shortage visible. Three existing calendar tasks appeared. Reload retained the target, conversion, allowance, outlet and accepted row.
- Desktop and 390px phone cards were visually inspected. Screenshots are in `output/market-garden-sales/` (untracked). The temporary viewport was reset.
- Update notices in isiZulu, Sesotho, Xitsonga and Tshivenda are source-paired unreviewed machine drafts. No fluent review is claimed.

Full current-head CI, security checks and immutable hosted-preview evidence will be recorded in the PR and issue #35 before merge.
