# Harvest-target planning

Requested by Rory after the field-block release. This adds demand-led commercial planning to the existing crop planner; no catalogue figures, species, lessons or saved design geometry change. PLAN_VERSION is unchanged. This changes the crop-planner screen, not the rendered design sheets.

## Delivered milestones

- Add, edit and remove site-scoped weekly kg targets with an inclusive window of 1–12 calendar months. Targets round-trip in the account-scoped crop-plan store. Old plans remain readable. The UI states that this is device storage; no new cloud-sync claim.
- Convert weekly demand to total requested kg using actual UTC calendar days / 7, including leap years. Divide by the existing conservative crop-cycle yield to report summed crop-cycle area, explicitly distinct from simultaneous land requirements.
- Allocate only requested crops, using the existing climate, source calendar, space/occupancy, standard-share and chronological rotation authorities. Open fields remain whole and only receive the field crops the ordinary planner allows. Rotation is never silently waived for a buyer's single-family order. Earlier-ending targets get priority.
- Review dated sowings, linked total cycle capacity, unallocated demand, surplus from whole areas/shares, missing evidence and months without a linked picking window. Accept adds one-time rows to the existing crop timeline and task/calendar/export system. Existing crops are not rewritten. Re-running counts accepted linked capacity; no double-selling the same row to another target. Removing a target keeps its plantings.

## Evidence boundary

`yieldKgPerM2` in `lib/crop-catalog.ts` is a crop-cycle benchmark, not a weekly harvest curve. A cycle is credited only when its complete catalogue picking window fits the requested window. Its kg is not divided across picking months or weeks. A picking-window month is not proof that the buyer gets the requested kg that week. Storage, loss and saleable-packout allowances are not inferred. Only dated rows linked to the target count; unrelated existing produce is not assumed available for a buyer.

The existing South African source calendars remain in force. This release does not claim local agronomic verification for the US, UK or Europe. International calendars and grower-recorded weekly production profiles remain separate future work.

KZN DARD's [Successional cropping](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/successional_cropping.pdf), read during this work, identifies crop duration, harvest period, climate, demand and farm resources as inputs to succession planning. It does not establish a weekly kg curve for the catalogue. Crop figures remain sourced from the existing catalogue and its evidence records; none were added here.

## Verification

- New behavioural tests cover actual dates, invalid targets, target/site ownership, add-only proposals, demand caps, dated tasks, missing yields, overlapping picking windows, area conflicts, pending/finished rows, whole fields, rotation and water/climate gate restoration, plus persistence/backward compatibility.
- Typecheck and 234 affected tests passed before the final full-suite run.
- Local browser verification: saved a target, reloaded it, edited its harvest dates with native month controls, generated/reviewed/accepted a proposal and observed the linked capacity update and three calendar tasks. Mobile and desktop screenshots are in the worktree's `output/harvest-targets/` (not committed).
- A duplicate React sibling key found during the first browser pass was corrected with a panel-specific key. A green arithmetic suite alone did not catch it.
- Update-note translations in isiZulu, Sesotho, Xitsonga and Tshivenda are source-paired, unreviewed machine drafts. No fluent review is claimed.

Full current-head CI, rules and hosted preview evidence will be recorded in the PR and coordination ledger before merge.
