# Browser-only first-run storage wording — 19 November 2026

- Auditor — Codex, following Claude’s D-1 in the signed-out planner journey.
- Starting revision — released main `088afa397864824a6755249b3751ef62f966aed9`, tree `5b2455b9d6849562c821fade2982a7c16f962191`.
- Previous audit — [Wisconsin reference disclosure](../2026-11-18/wisconsin-reference-disclosure-codex.md) records the preceding release.

Claude reproduced the cloud assurance in a local build with no Firebase configuration. The actual root gate skips this dialog in the sample and when a configured backend is waiting for sign-in. A build without a backend can use the browser-only first-run dialog.

| Case | Expected behavior | Verification |
| --- | --- | --- |
| D-1.1 | The storage switch describes storage in the browser and the absence of cloud backup. | Actual consent component with backend configuration disabled. |
| D-1.2 | Switching required storage off explains the browser-storage requirement. Continue is disabled and nothing is written. | Actual dialog action and storage-write ledger. |
| D-1.3 | Preserve existing account onboarding, sample exclusions, optional sharing and account-scoped records. | Account isolation, configured consent, sample consent and language contracts. |

The two new browser-only sentences use tagged English. The signed-in translation packet, storage behavior, opt-in mechanics and consent record retain their existing contracts.

Local verification passed Node 24 typecheck, all 87 affected tests and the release-note and whitespace checks. The full suite, rules and hosted preview have their own release checks.
