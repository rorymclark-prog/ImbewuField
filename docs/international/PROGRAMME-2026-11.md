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

## Current execution and ownership — 2 November checkpoint

Codex owns implementation, independent review, checks and release coordination.
Disjoint workers may run concurrently; shared saved-data contracts require root
review. Preserve the original worktree and old lanes' unrelated/private work.

- Draft [PR #1167](https://github.com/rorymclark-prog/ImbewuField/pull/1167),
  head `12b0acba`, contains site-country context, account-safe metadata sync and
  guarded catalogue consumers. Typecheck and 137 affected checks pass. Its local
  full run was stopped during disk pressure; current-head full CI remains a gate.
- Draft [PR #1168](https://github.com/rorymclark-prog/ImbewuField/pull/1168),
  head `7cd65415`, stacks grower estimates and safe plan-book writes on #1167.
  Typecheck, 110 affected checks and seven independent page/storage probes pass.
  Full current-head CI remains pending. Merge order is #1167 before #1168.
- This next branch adds pure automatic own-input proposals, immutable canonical
  cycle attachments, context-aware projections and a saved buyer-demand adapter.
  Malformed markers survive storage and cannot become catalogue rows. Legacy
  tasks and report calculations withhold tagged rows; explicit current projections
  retain own dates, cycle kg, target plants and nursery intervals. Unknown seeds,
  trays, space and delivery distributions remain unknown. Typecheck and 100
  focused integration checks pass; the full suite is running. **Live acceptance
  is not enabled:** remaining UI/task/export/nursery/finance consumers need review
  before these rows can enter a user's plan. This prerequisite is not a completed
  international auto-planner release.

The built-in browser is now available. The #1168 hosted preview was inspected at
normal desktop and 390-pixel phone width. A partial profile saved on this device,
survived reload in its original workspace and was removed after the test. The
phone document measured 390 pixels with no horizontal overflow. No mapped-site,
cloud or second-device persistence is certified: the preview currently opens a
sign-in page for account access. Source probes and local storage checks do not
replace those release checks. Neither draft milestone is merged or released.

## AGY delivery and new parallel language jobs

The earlier seven-family source shortlist shipped with the foundation. Kenya's
bounded follow-up is reviewed in #1167; the UK's four-response compact review is
in #1168. The US research CLI has now handed off and exited successfully with
its workers stopped. This branch includes a corrected US compact bundle checked
against four actual public responses across three official source families.
Documentation fetched is distinct from a tested product-data endpoint or an
implemented adapter. No pilot product-data integration or local region approval
has been established by these research deliveries.

Two completed translation batches contain 624 source-bound draft entries:
97 and 59 entries per locale for French, Latin American Spanish, Brazilian
Portuguese and Kenyan Swahili. Independent structure/hash/protected-token checks
pass; named fluent human review and runtime language enablement remain absent.
The second batch's main AGY CLI exited successfully after its workers stopped.

The additional bounded Hindi (India), Bengali (Bangladesh) and Indonesian
assignment has now delivered 59 full UI messages per locale: 177 more entries,
801 across the three batches and seven languages. Two AI workers and the main
AI completed the files; worker stop was observed, then the CLI exited successfully.
Independent source/key/hash/numeric/protected-token checks pass after preserving
one required Indonesian literal unit; 17 corruption controls are rejected.
Unsupported regional terminology assertions and private worker IDs were removed
from handoff notes before publication. No native-speaker/human review is implied
by an AI worker's role. Different languages have different bounded coverage;
none of these deliveries is a complete app or lesson translation. All remain
unreviewed and disabled in runtime. Optional interaction-data sharing stays off.

## Invariants throughout

Leave PLAN_VERSION, calibrated lesson/quiz bodies, species names and measured
saved geometry unchanged. Preserve old plans, account isolation and existing
permissions. Never silently convert currencies or units, choose default
agronomic values, or turn unknown evidence into zero or approval. Quarantined
broad research stays outside release bundles. Every release needs exact
branch/SHA/PR, current-head full checks, visible and persistence verification,
and verified production identity recorded on issue #35. Completing one milestone
does not complete this sustained programme or its human review gates.
