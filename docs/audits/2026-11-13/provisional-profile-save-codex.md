# Provisional profile save and historical review — 13 November 2026

- Auditor: Codex implementation owner; separate Codex review requested after freeze.
- Starting revision: `7af7973791a1a819c2503e90ba01484a834ffc2d`, draft PR1350.
- Branch: `codex/provisional-profile-save-20261113`, stacked on PR1350.
- Previous audit: [Great Lakes spacing reference](great-lakes-spacing-codex.md).
- Scope: explicit own-profile append, historical evidence reopen, shared raw-book writer,
  full/provisional assessor boundary, legacy editor and printable action wording.
- Evidence: actual functions, mounted components, isolated browser fixture and original HTML/PDF.
- Hosted deployment: not yet inspected for this successor. No production release.

## What was already done

The previous scoped Kenya and Great Lakes adapters, exact spacing arithmetic and
source/override resolver remain the owners of their calculations. This slice adds
no farming numbers, source scope, species or calendar defaults. Soil, quick-save
and report findings retain their earlier bounded dispositions. Source alignment,
software verification and regional agricultural validation stay separate.

The G04 save/reopen contract was prepared by the existing independent Codex review
chat against the frozen parent. That preparation is not implementation approval.
The restricted AGY route remains disabled; there is no fresh Claude/AGY review.

## Implementation and findings

The grower explicitly chooses to save a new profile for review. A versioned
`provisionalOrigin` retains the original request, original-day evidence fingerprint,
saved timestamp, bed and checked-source identity. The original resolver reproduces
source defaults, grower overrides, rejected evidence, source limits and unknowns.
It first checks the original identity and evidence, then separately rebinds the
new profile ID, including spacing origins. This is an integrity record, not a
source signature or a durable current-source capability.

The existing parent writer performs the append with fresh lossless admission,
global ID collision checks and a final actor/context/source guard. Actual write
receipt and admitted readback distinguish no-write from written-but-superseded.
Successful readback installs the actual saved book. Existing plantings, other
profiles, measurements and unrelated book data remain unchanged. A completed
attempt cannot automatically retry merely because confirmation was interrupted.

The saved section displays historical context, measured area, chosen spacing,
whole stations, supported counts/dates and the same evidence-field presentation.
Unknown final stand does not become a plant count. Reopening does not refresh
source age or grant new save authority. Unsupported future/incompatible receipts
hold lossless writes rather than silently becoming legacy profiles or disappearing.
Receipt-aware edit/migration and explicit sowing adoption remain subsequent work.
The old profile editor and full assessor hold receipt-backed profiles, including
otherwise numerically complete ones, because they cannot validate the saved
country/source context. Provisional replay still computes supported results.

| ID | User-visible issue or coverage gap | Status | Evidence / next action |
| --- | --- | --- | --- |
| G04-SAVE-REOPEN | Preview could not be explicitly saved and inspected later with its source limits | Implemented; successor review/hosted/CI pending | Versioned receipt, shared append and historical evidence section |
| G04-READBACK-01 | Authority could change during the last storage read yet confirmation still report success | Corrected; regression passes | Initial actual-parent race probe failed at read199; final post-read guard now rejects confirmation |
| G04-ADOPTION-CONTEXT | Legacy sowing acceptance does not validate the provisional source/country context | Open; guarded | Full assessor and ordinary editor hold saved receipt profiles; explicit context-aware adoption still needed |
| G04-RESOLVER-COMPATIBILITY | Future resolver/source changes may no longer reproduce historical evidence | Open compatibility policy | Exact replay mismatch fails closed and raw-book admission preserves original records; no automatic migration |
| GL5290-COPY-01 | Source assumptions confused adapter defaults with grower choices | Carried verified from parent | Wording unchanged except action-bound download text |
| GLOBAL-AGRONOMY-VALIDATION | Regional source and arithmetic do not establish real-site agricultural accuracy | Open | Human/local validation and unsupported-region behavior remain separate |
| GLOBAL-EXTERNAL-REVIEW | Restricted AGY service route cannot provide requested independent provider review | Open | No retries, provider/account/auth bypass or fabricated approval |
| GLOBAL-CURRENT-HEAD-CI | Persistence/farming changes require full current-head CI | Open | Rules, focused-render, full tests and preview must be recorded for this successor |

## Verification

- Typecheck: clean before affected tests; exact exits retained in the private packet.
- Affected tests: 480 pass, zero failures/cancellations/skips/todos across23 existing
  registered files. Includes actual parent writer extraction with the real storage
  implementation, every calibrated read position, own events, actor loss, quota
  failure, lossless whole-book preservation, explicit removal, malformed/future
  receipts, UTC expiry, duplicate clicks, context round trips and full assessor hold.
- Negative control: the new mounted save test fails against the actual7af parent
  component because the explicit save declaration is absent, not due to an import
  failure. The initial final-read race failure is retained as before/fix evidence.
- Whitespace: clean before commit.
- Full suite: not rerun locally; required current-head CI remains pending after push.
- Actual output: synthetic10.125m² Great Lakes cabbage,76.2×45.72cm, unknown stand:
  29whole stations and unknown plants. Save/new ID, page reload, reopened historical
  undated source evidence,1280px desktop and390px phone inspected; no page errors
  or horizontal overflow. Original downloaded HTML printed to five PDF pages;
  all five viewed. The isolated callback stores only fixture localStorage; this is
  not proof of actual parent browser wiring, a real account, sync or device behavior.
- This changes the crop form and saved-review appearance. PLAN_VERSION unchanged.
- External/local agronomy, authenticated device/sync and language/dark-mode checks
  are not established by these tests or the isolated visual fixture.

## Next continuation

Freeze and push this finished save/reopen slice, obtain independent source/output
review and inspect actual hosted sample save/reopen through the parent writer.
Resolve findings, wait for exact-head required CI and retain any failures. Then
continue the original planner integration toward explicit context-aware adoption;
do not describe the whole G04/global milestone as finished because this slice saves.
No production merge while its applicable gates remain open.

## Independent review follow-up

The separate Codex reviewer inspected exact49684a/treee2ec4ac against7af, all16
Git files, actual screens and all five original print pages. It requested changes;
no approval is inferred from its positive replay/source observations.

| ID | Independent reproduction | Successor correction / acceptance |
| --- | --- | --- |
| G04-49684A-01 (P1) | An own-change event or post-write read revoked actor/sample/source; the generic writer installed old candidate state/base before the wrapper returned superseded | Guarded provisional saves now return the actual write token without installing candidate state/base. The wrapper retains its original base, admits exact current readback and installs only after the final authority checks. Actual-parent regressions assert no stale state/base installation across synchronous actor/sample/source changes and every calibrated storage-read revocation; completed-write/state-installation failure still reports superseded. |
| G04-49684A-02 (P2) | Clearing the enabled confirmation during an awaited source check still invoked the writer | A synchronous declaration identity retires the pending attempt on checkbox withdrawal, including an uncheck/recheck round trip. A new deliberate click can acquire a new attempt; no old callback inherits the new declaration. |

Both corrected regressions fail against the exact49684a parent implementation
with their intended assertions, not import errors. The two affected existing test
files pass60 checks after correction. Ordered typecheck is clean and483 affected
tests across23 existing files pass with zero failures, skips, cancellations or
todos; whitespace is clean. Exact-successor independent delta review and hosted
parent results are recorded separately on the PR/ledger.
The original480-pass record remains historical; it did not cover these two
interactions. Full current-head CI and actual hosted parent remain required.
Unchanged numerical/source/print evidence is reused explicitly, not called fresh
agronomic validation. This follow-up changes save interaction semantics, not the
farming arithmetic or original source statements.
