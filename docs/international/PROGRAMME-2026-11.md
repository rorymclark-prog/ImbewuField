# International adaptation programme — November 2026

Coordinator: Codex root chat. Product owner: Rory Clark.
Coordination ledger: [issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35).
This is a sustained implementation programme. Completing an engineering stage
does not complete international adaptation or approve a country launch.

## Starting point

The international foundation shipped in PR #1166 at `8a12b3e`, alongside the
already released field-block, harvest-target and nursery planning work. It
contains reference dossiers, four bounded UI draft dictionaries and five
fictional project workflow demonstrations. It does not yet provide international
crop recommendations, translated lessons or live project-record reporting.

The primary users remain growers: smallholders, food-security and livelihood
projects, agroforestry and agroecology initiatives, community gardens and
commercial market gardeners. Organisational and funder views support their work.
The automatic crop planner is the product core; country research must become
usable, reviewed planning capability rather than an indefinitely growing essay.

## Successive release milestones

| Stage | Concrete product change | Evidence required before release |
| --- | --- | --- |
| 1. Saved site context | Explicit country, jurisdiction and agricultural-region references on existing saved sites. Legacy unknown stays unknown. Unsupported contexts cannot silently receive South African planner instructions. Saved rows, measurements, actual records and grower-owned equipment survive. | Account/site isolation, metadata-only saves, coordinate-move invalidation, deletion-safe cross-device reconciliation, stale-proposal rejection, desktop/phone and persistence checks. |
| 2. Grower-owned global planning inputs | Separate user-entered planning assumptions and dates from country-reviewed recommendations. Keep market-garden demand, measured beds, tray equipment, recipes and actual records useful without claiming an unreviewed local crop calendar. | Explicit provenance and missingness for each input, unchanged measured geometry, no invented agronomic values, proposal-to-plan/nursery consistency, save/reload and export truthfulness. |
| 3. Bounded pilot source adapters | For one defined region per pilot, connect a specific official source to a specific visible use case. Start with Kenya, UK, US and Brazil; each jurisdiction remains separate. | Primary-source receipts, coverage/resolution/units/dates, licence and attribution, authentication/cadence/access limits, missing-data and timeout behaviour, independent source-fit review. |
| 4. Local crop-plan pilots | Apply reviewed regional crop-planning assumptions to the automatic planner, harvest targets and nursery consequences. | Named dated local agronomy/jurisdiction review, source-bound region scope, meaningful rejection tests for unsupported/expired evidence, complete planning and task/export verification. No source discovery alone enables this stage. |
| 5. Language pilots | Reviewable French, Spanish, Portuguese and Swahili grower flows, with regional variants and source invalidation. Language remains separate from country, currency and units. | Exact text/source/reviewer/date evidence, fluent review of the released scope, plural/format/date/RTL and English fallback checks. Lessons, quizzes, narration, reports and offline packs remain separate reviewed scopes. |
| 6. Real project evidence | Permission-filtered use of existing crop, harvest, sales, journal and programme/MEL books for the five grower-led workflows. | No duplicate ledger, no sharing grants, actual versus planned distinction, consent and publication checks, reconciled source references, units/currency/date boundaries, no invented impact or funding eligibility. |
| 7. Expansion and operations | Repeat the reviewed region/provider/language release process for the next priority countries and project audiences. | Real pilot feedback and supported-capability register; offline/failure/account checks and honest unsupported states; deployment verification and issue #35 evidence for each release. |

The [next-country backlog](NEXT-COUNTRY-ROLLOUT.md) defines the initial pilot
sequence and specific human/source/integration gates. These stages can overlap
where ownership and dependencies permit; they are not promised calendar weeks.
Human review cannot be replaced by an AI-authored approval record.

## Current execution and ownership

Codex owns implementation, integration, checks and release decisions. Disjoint
subtasks may run concurrently; shared source and saved-data contracts require
coordinator review before integration. Root's original worktree and the old lane
worktrees retain their unrelated/private work and must not be reset or staged.

AGY's 1 November research run finished and its compact reviewed subset shipped.
On 2 November Codex resumed the existing CLI conversation on a new bounded
Kenya/Kiambu source-fit assignment limited to KALRO, KMD and KEPHIS. Kiambu is an
engineering investigation scope, not an approved agricultural region. AGY owns
only its newly assigned research-document directory; it implements no product
adapter and approves no launch. Its exact live/stopped state is reported from
the process and actual artifacts, not this historical paragraph.

Public scoped read-only fetches use normal approvals. Optional interaction-data
sharing remains OFF under Rory's existing onboarding choice. No permission
bypass, global allow rules, private conversation IDs, transcripts, credentials
or farmer coordinates belong in source handoffs or GitHub.

## Open stage-one gates

- Claude-owned sync changes are now drafted through AGY and independently
  checked against seven actual-helper race/data-preservation probes (all pass).
  The AGY Claude CLI stopped after a usage limit; it is not still implementing.
  Codex integration review and full validation remain required. No release yet.
- Actual browser inspection is required before release. On 2 November the
  computer-use tool again reported local browser use disabled in Work settings.
  No browser workaround is authorised. Source tests do not prove the layout.
- Full current-head checks are required for the saved-data/persistence change.
  Do not call this stage released merely because focused tests pass.

## Invariants throughout

Leave PLAN_VERSION, calibrated lesson/quiz bodies, species names and measured
saved geometry unchanged. Preserve old plans, account isolation and existing
permissions. Never silently convert currencies or units, choose default
germination/yield/spacing values, or turn unknown evidence into zero or approval.
Quarantined broad research drafts remain outside release bundles. Every shipped
milestone needs branch/SHA/PR, actual validation, visible-output evidence and
verified production build identity in issue #35.

## Additional parallel language assignment — 2 November

Rory requested further AGY translation jobs. A separate Gemini 3.8 Flash High
CLI lane was launched against the fixed 97-segment UI inventory in
[the translation work order](AGY-TRANSLATION-WORKORDER-2026-11-02.md). Three
disjoint native worker assignments cover French, Latin American Spanish and
Brazilian Portuguese; the main translation agent covers Kenyan Swahili. The CLI subsequently confirmed **Spawned 3 subagents** for the disjoint
French/Spanish/Brazilian-Portuguese jobs. The main agent handles Kenyan Swahili.
Delivered files and validation must still be verified separately from startup.
All outputs remain AI drafts requiring fluent human review. This extends the
existing 32-message-per-language foundation without replacing it or rewriting
calibrated lessons. UK source research continues in its separate existing CLI
conversation. No language/country launch follows from draft completion.

## Stage-one review checkpoint

Draft PR #1167 contains the saved-context milestone at dfa7ac49e. A partial
local full-suite run exposed five stale source-contract assertions: they pinned
the former automatic summer default, Simple-only syntax or handler fixtures
without a country-scope predicate. The unchanged behavioral requirements now
exercise actual supported/unsupported/loading conditions and missing-bed guards.
The combined affected recheck passes 137/137, with clean typecheck. The local
full run was explicitly stopped during critical disk pressure and is not a pass.
Current-head full CI, preview and browser/persistence checks remain release gates.

AGY has returned 388 source-bound language draft entries. Independent structural
checks pass all four 97-segment files after three literal DEMO/cm repairs; fluent
review is still absent. Original regional terminology assertions were quarantined,
and compact candidate glossaries identify the required human checks. The main
translation CLI exited with code 2 after partial handoff. The UK research process
and old tool handle were no longer present after the interrupted turn; its final
compact files were not delivered to the authorised path. Do not describe either
lane as still running. A concrete follow-up assignment must verify existing files
and resume the proper existing conversation before further work.
