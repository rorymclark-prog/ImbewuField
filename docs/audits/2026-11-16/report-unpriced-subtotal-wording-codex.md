# Entirely unpriced report wording — 16 November 2026

- Auditor / implementation owner: Command Centre Codex.
- Starting commit: `1db007a7397b0d36952847b20ee6089a35e3e327`, tree
  `5f7f109330f6939abf7cddfcec3e5eb9d93b2dc3`.
- Branch: `codex/report-unpriced-subtotal-wording-20261116`, stacked on PR1388.
- Reviewed revision: parent plus the change committed with this record;
  final Git/source/output bindings retained privately.
- Previous audit: [Mixed purchase quantities](report-mixed-purchase-quantity-codex.md).
- Actual external trigger: Claude Code `claude-opus-5-5` High, source-only
  review of the parent from GitHub; its packet did not arrive and it inspected
  no PDF, page image or chart. This is not successor/output approval.
- Deployment inspected: none for this successor at preparation time.
- Scope: bill-of-quantities footer when no line has a known price.

## What was already done

The parent retains mixed inventory as unpriced, separates unknown cost from a
stated zero, omits empty cost charts and consumes exact existing catalogue tank
mirrors once. Existing counts, geometry, source records, price-book rates, source
qualifications, species, lessons and `PLAN_VERSION` remain unchanged here.
The original global G01–G05/P01–P24 goal and applicable release gates are retained.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CLAUDE-1DB-C-1 | A bill with no priced lines says build cost is not established, then refers to “This subtotal” and describes every gap as a measured quantity needing only a rate. | Implemented; baseline regression and actual output checked | Entirely unpriced bills now explain unknown build cost and ask for the missing purchase quantities, measurements or rates. No subtotal or greater cost is inferred. Four real builder reasons exercise the condition in English and isiZulu surfaces. Exact successor CI and actual external output review remain open. |

The same absent-subtotal footer is corrected for mixed-only bills. Priced-zero
and partially priced bills retain their existing branches. This bounded change
makes no new price or farming calculation and adds no translation to the frozen
corpus. New non-English copy is visibly English/translation-pending. Broader
historical phrasing in partially priced bills is not rewritten by this change.

## Verification

- Node24.22.3 typecheck: clean before the baseline test and after the fix.
- Added regression fails on the parent for the actual dangling-subtotal sentence;
  no environment/loader failure is counted as the baseline.
- Four affected suites: **50/50** checks pass, zero failures/cancelled/skipped/TODO.
  They retain partial-price and stated-zero controls, frozen translation corpus
  and existing summary/monitoring handling. No fixture bytes or assertion
  strength were changed to hide a failure.
- **Four actual report POST captures and four application-written PDFs**
  (17 pages) generated with isolated auth/country/provider/narrative seams.
  Root viewed a17-page montage and all four changed cost pages individually.
  The new English/pending-language notes are legible with no observed clipping
  in the changed section. No empty cost chart or zero build cost appears.
- Contemporaneous pre/post capture hashes verify820 tracked app/lib/package and
  country-fixture files did not change during capture. No claim of dependency
  bytes, real account, device, live narrative, current-price or agronomy validation.
- Separate Codex read-only review found no actionable defect in the three-file
  source/test/note delta; it read the logs and captures but did not inspect images
  or rerun checks. It is not Claude/AGY output acceptance.
- Release-note and whitespace checks pass before commit. No full local suite or
  completed parent suite is repeated; exact successor CI remains separate.

This changes the picture: the entirely unpriced footer changes. No numeric bill,
price, stock, crop or saved-plan record changes. Detailed logs, original Claude
report admission, input/output/source bindings and visual receipts remain private
under `report-unpriced-subtotal-wording-20261116` in the programme evidence root.

## Next continuation

Push the finished branch once, inspect its exact CI and prepare one bounded
successor review with the actual PDFs. Parent source acceptance is retained only
within its scope; the missing parent packet is not claimed delivered. Keep the
manual AGY task pinned to05d unchanged. Preserve P03/P09 evidence limits, the
prospective P22 protocol and FIELD-PERIOD-06/PROVISIONAL-PRINT-04/NURSERY-SK-06 as
applicable; passing software checks are not proof of agricultural accuracy.
