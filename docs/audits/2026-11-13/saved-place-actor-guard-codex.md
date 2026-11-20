# Saved-place confirmations and actor changes — 13 November 2026

- Owner: Codex; branch `codex/saved-place-actor-guard-20261113`.
- Base: `f26680a316623a0b87733411c710287ea079bb4c`, draft PR1355.
- Previous: [Report irrigation evidence](report-irrigation-evidence-codex.md) and [saved profile context](provisional-profile-save-codex.md).
- Scope: three nearby-site save entry points, a guarded local saved-place writer, the existing observed actor/window/sample authority, and one inherited integration-test fixture. No country permission, provider, farming figure, saved schema, geometry, auth rule or workflow change.

## Findings and correction

| ID | Evidence | Disposition |
| --- | --- | --- |
| QUICK-SAVE-ACTOR-01 | The actual quick-save callback awaited a nearby-site question under account A, resumed after account B became current, copied A's row into B's real account-scoped in-memory storage key and displayed success. | Mount-scoped receipts use the existing observed actor/sample epoch. All three save callers pass a current-context predicate to the shared writer; retired callbacks do not install success or saved-row state. Bounded review and exact-head release gates remain required. |
| QUICK-SAVE-IMPORT-01 | The first implementation imported the client observer module through the general place store, preloading it before existing consumer boundaries. Broader checks reproduced six failures, including actor-observer loss and a field-unit test process failure. | Remove that eager store dependency. A typed ephemeral predicate comes from each UI caller; the general writer remains independent of client observer initialization. All existing affected assertions are retained; the final group passes. |
| QUICK-SAVE-RECEIPT-RENEWAL-01 | Independent source review found that a same-role sample event retires a mount-only receipt without a remount. A real-hook negative control passes 33 cases and fails the fresh-receipt assertion. | The hook immediately withdraws the retired reference and renews after the current render. The actual pending callback remains rejected; a fresh action in the same mounted sample view succeeds. Final affected-delta review required. |
| GLOBAL-CI-2E-01 | Exact 2e full CI run 43351885686 / job 131644662336: 11,022 tests, 11,015 pass, 7 fail. The actual buyer-editor JSX fixture throws ReferenceError for `growerConditions`, then lacks `exportSavedGrowerRecord`. | Add both explicit fixture boundaries and new identity assertions for current conditions, complete row list and export callback. Actual page declarations already exist. All nine fixture tests pass; no old country, scope or callback assertion removed. New current-head full CI remains required. |

The observed actor/window/sample authority gains a closed saved-place purpose;
it does not read or write a unit preference. The React hook creates its receipt
in an effect and revokes it on unmount, including a subsequent fresh view.
Changing sample mode away and back cannot revive the old receipt. A same-route
tour-role notification also retires it; the hook subscribes for a new render and
fresh action receipt, without lending that authority to the old pending callback.

The guarded writer checks the supplied predicate before mutation and after
re-entrant reads/notifications, and pins the cloud destination to the original
owner. The old single-argument API is retained for untouched synchronous callers;
this is not a claim that every delayed write in the app has been migrated. No
client predicate replaces backend authorization. A completed original-owner local
write followed by a context change is preserved and returns no current-view
confirmation; it is not silently rolled back into another account.

## Reproduction, verification and actual output

- The initial private probe AST-extracted the unchanged actual DataPanel callback and ran the real nearby lookup, place writer and account namespace helpers. Only Firebase/browser IO was synthetic; no real account or cloud data was touched. It recorded the unwanted B row and success acknowledgement.
- The initial committed-test negative control runs all three actual callback bodies, with both Update and Save-as-new answers. All six fail on the intended cross-account row assertion against the exact parent source; seven existing tests still pass. These are actual handler executions, not copies or assertions about source spelling.
- Expanded checks execute current callback bodies with stable actor, account change, sample round trip and revoked view. Stable saves still succeed, preserve recorded rainfall on update and keep new outage rainfall unknown. An actual React hook mount/unmount/remount check verifies lifecycle retirement; another writer check covers a context change during its own notification. The initial 33 cases pass. A 34th real-hook case then reproduces the same-route
renewal finding and verifies the correction, including unchanged original sample
rows after the retired confirmation and success from the later fresh click.
- Final typecheck passes. The 62-file affected group passes 1,074 / 1,074 with no failures, cancellations, skips or todos, including saved-site contexts, account isolation, shared context purposes, field import/export, nursery, invoice, report and DataPanel consumers. The separate inherited buyer fixture passes 9 / 9. After the renewal correction, the combined 65-file group passes 1,112 / 1,112,
with zero failures, cancellations, skips or todos. This includes the buyer fixture
and notes/type-floor cases. Final typecheck and whitespace pass; committed
binding and release checks are recorded on the PR / issue #35.
- The corrected private probe uses the same actual quick-save handler and real storage/account functions, with complete synthetic EventTarget/Firebase observation boundaries. Account A's original row remains, account B has no row, and success feedback is empty. Its source hashes are retained; a separate final probe output binds the renewed helper version. An initial probe lacked the browser EventTarget methods required to create a receipt; that setup was corrected before claiming a result.
- No CSS or visible layout change is made. The behavioural and state-output checks do not claim a hosted signed-in session, real account transition, cloud acknowledgement, second device or physical phone inspection.

The first broad run and its failures are preserved separately, alongside the
corrected run. Their assertions were not weakened. The buyer fixture failure is
also retained locally and in its full CI log. Neither a parent CI pass nor these
focused checks constitute final current-head full-suite or agricultural approval.

## Release status

The parent f266 preview, rules and focused-render checks pass; its full tests are
still separate. The adoption parent's seven failed fixture cases are not silently
ignored because later heads are pending. Finish bounded independent delta review,
push the finished successor once and inspect its own required full/rules/render/
preview checks. Nothing is merged or released by this audit. The full global
objective remains active. AGY/Claude-through-AGY policy/service hold and independent
local agricultural-validation limits remain; no automatic external review or
provider/auth workaround was attempted.
