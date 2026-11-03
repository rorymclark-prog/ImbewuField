# Protected crop storage, account transfer and retained-copy review — 2026-11-03

- Auditor: Codex coordinator with disjoint storage, auth/fixture and lifecycle/UI owners.
- Revision: `codex/grower-storage-cutover`, following acceptance PR #1174 and operations PR #1173. Publication SHA and current-head CI belong to [issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35).
- Previous audit: [Reviewed proposal saves, Finance evidence and sign-in preservation](grower-acceptance-codex.md). GOPS-007 is the compatibility problem addressed here.
- Scope: account-scoped canonical storage generation, original-byte migration evidence, cooperative editor locking, guest transfer and actual consumer readiness. No production or browser visual approval is claimed.

## Result

Released JavaScript writes directly to the old storage address. A new cache or update banner cannot stop an already-loaded session. Current clients therefore use one new canonical book. The old copy is retained as import evidence; it is not continuously merged or written back. Exact authored bytes and immutable cutover evidence distinguish a genuinely absent plan from missing or corrupt storage after migration. Partial setup holds for explicit recovery instead of silently importing again.

A real document-lifetime Web Lock permits one current editing tab. Other tabs retain readable saved data with editing withheld. A volatile lease identity revokes old write tokens and admissions after release, including when saved bytes remain identical. This serializes cooperating current clients; it does not stop an old session writing its old address or establish a remote compare-and-swap lock.

Changed older-session copies require an original bound review. Downloads contain the exact local copies, not an upload. Equal row counts do not establish equal dates, quantities or settings. Explicitly keeping the current plan retains the reviewed older bytes without applying them, and later old-session changes revoke that decision. An unconfirmed performed choice cannot invite a duplicate retry.

Guest transfer copies the canonical book and its provenance as a bound pair. All three source snapshots survive transfer, including previously reviewed older copies. Existing account destinations are preserved. Failed transfer into an absent destination establishes an account-bound hold so another initializer cannot create an empty plan and hide retained guest work. Auth success remains separate from crop-transfer success. Interrupted cleanup may retain guest evidence; no general conflict-merging or cloud-sync protocol is claimed.

## Findings and disposition

| ID | Finding | Evidence and disposition |
| --- | --- | --- |
| GCUT-001 | Old released code can erase additive planning metadata on an unrelated save. | Executable released-loader/saver negative control now writes only the retained old address; protected canonical bytes remain unchanged and divergence is surfaced. No farmer storage was used. |
| GCUT-002 | A global current-client saver could persist a filtered display and discard authored evidence. | The existing admission and lossless-projection authorities now guard the shared saver. Unsafe descriptors are held with zero getter calls; valid legacy settlement and sample isolation remain covered. |
| GCUT-003 | Reacquiring a lease with identical saved bytes revived old tokens/admissions. | Independent actual probe reproduced it. New opaque lease proof and volatile token identity revoke prior provenance while preserving legitimate same-lease rebases. |
| GCUT-004 | First-open async setup left the production planner permanently conflicted. | Actual core plus extracted parent mount/autosave reproduced zero writes after successful setup. Storage events now trigger a committed clean-view rebind; dirty inputs stay held and preserved. Actual parent/core readiness and stale-callback integration checks passed in the final union. |
| GCUT-005 | Failed guest transfer could be followed by automatic empty initialization. | Actual quota-before-marker and unavailable-lock controls now hold both Auth and the shared initializer, retaining guest evidence until explicit retry. |
| GCUT-006 | Guest transfer initially omitted prior reviewed-copy evidence during cleanup. | Frozen destination provenance now retains exact canonical, receipt and legacy source snapshots before cleanup. |
| GCUT-007 | BFCache reacquisition could leave tasks held because the private previous status still looked ready. | A real mounted provider-to-task test detected the suppressed readiness event. Pagehide withdraws the private delivery so a fresh lease notifies consumers. The actual provider-to-task regression passed in the final union. |
| GCUT-008 | Existing persistence tests encoded retired addresses and destructive normalization as successful saves. | The initial affected baseline recorded 93 failures. Fixtures now acquire real initialized leases; display-normalizer assertions remain, while destructive-save expectations require holds and unchanged raw evidence. No production test-mode bypass or assertion deletion was added. |
| GCUT-009 | Real browser/account/two-tab/offline and suspended-page behavior is unverified. | Browser tool reports disabled. Mounted component and independent-document memory tests are engineering evidence, not desktop/phone or production proof. This remains a release gate. |

## Verification record

After all concrete corrections and fixture repairs were frozen, the coordinator ran Node 24 typecheck successfully, then **762/762 tests across 50 distinct files**, then a clean whitespace check. All owner manifests were independently checked against actual bytes before integration. Full suite and current-head CI remain pending. Owner runs overlap and are not added to this unique total. The four new suites are registered exactly once, and the new notice joins the existing farmer text-floor register without a debt exemption.

The first combined run had 741 pass and two fixture failures: an extracted callback lacked the new original-base context, and a route mock omitted the named notice export. Repairs retain the actual admission/actor/token authority, prove the inner stale-row guard is reached, preserve the positive proposal control and every original route field assertion, and add retired-copy and account-isolation checks. The initial failure and subsequent 762-test result remain separate evidence.

The operations full run separately terminated with 6,754 tests: 6,752 pass, one emoji-icon failure and one existing TODO. Its concrete unused-icon correction passed typecheck and 52 affected checks; a new full run is required. That result is not attributed to the cutover tree.

Contracts: [Canonical cutover](../../international/GROWER-STORAGE-CUTOVER.md), [Auth transfer](../../international/GROWER-CUTOVER-AUTH.md), [Lifecycle and review](../../international/GROWER-CUTOVER-UI.md).

The 42 global acceptance-release drafts, 48 storage-review drafts and 48 cutover-release drafts are structurally source-bound and unreviewed, with no runtime activation. Each packet family rejected 12 deliberately damaged controls; structural checks do not certify fluent meaning. The separate UK historical-station contract is a reviewed source/format handoff; automated product-fetch permission remains unresolved and no adapter is implemented by that research.

This changes the planner picture. `PLAN_VERSION`, measured saved geometry, species and calibrated lessons/quizzes remain unchanged. No engineering fixture or translation packet supplies local agronomic, legal, language-launch or funding approval.

## Release gates

Finish exact-tree checks and current-head CI, inspect populated desktop/phone outputs, real two-tab and offline/BFCache behavior, and account save/reload. Publish only the supported scope after those gates pass, verify the production build and record its evidence on issue #35. Country-specific source and named human-review work remains distinct from storage safety.
