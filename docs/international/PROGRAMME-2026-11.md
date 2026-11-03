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

## Current execution and ownership — 3 November checkpoint

Codex owns implementation, independent review, checks and release coordination.
The released baseline remains `8a12b3e`; these new milestones are under review.

- Draft [PR #1167](https://github.com/rorymclark-prog/ImbewuField/pull/1167),
  head `66e2dffc6`, holds site-country context and guarded consumers. The old full
  run failed ten related checks. Coordinator baseline comparison and repairs
  preserved the behavior assertions, added actual rejection controls and supplied
  the missing disclosed release-copy candidates. The new full run remains pending;
  repaired focused checks are not a substitute for that result.
- Draft [PR #1171](https://github.com/rorymclark-prog/ImbewuField/pull/1171),
  head `fbe546d6c`, consolidates the preserved implementation ancestors from #1168
  and #1169 into the complete grower-input/proposal/nursery review flow above
  #1167. This avoids separate releases of disconnected prerequisites. The original
  commits remain recoverable in its history; no production merge has occurred.
  Typecheck and 676 workflow/storage/source/calculation checks passed. Postmerge
  release/UI/format checks passed 154 tests with zero failures and one existing
  shape-sync TODO. Canonical crop-cycle acceptance remains disabled: proposed
  capacity is neither planted crops, observed stock nor fulfilled buyer demand.
- The actual practice UI drew an extra measured bed, saved a synthetic buyer
  target and growing estimate, then produced two ready cycles while holding
  unresolved existing sowings. Native date controls work through their accessible
  date interface. Desktop/390px empty controls fit without horizontal overflow.
  Finished proposal/nursery visual capture, current hosted preview, real-account
  persistence, older-client metadata preservation and current-head full/security
  checks remain release gates. Temporary practice changes reset on reload.
- A separate US NWS observation implementation is in isolated branch
  `codex/international-weather-reference`. Actual official documentation, schema,
  station metadata and observation responses were fetched. The bounded adapter,
  existing-guard/data-budget route and opt-in US country-review screen preserve
  units, missingness, QC flags, separate points and observation/retrieval times.
  Focused provider/route/UI/auth/readiness and phone-type checks pass. It is not
  merged or browser-certified; it does not supply farm weather or crop advice.

## AGY deliveries and current work

The earlier source shortlist and Kenya/UK/US bounded follow-ups remain separate
from product integrations. The compact Brazil introductory bundle now contains
five independently receipted public bodies, with actual UTC fetch dates distinct
from local dispatch/review dates. Unsupported station/location assertions and
inferred product terms were removed. The follow-up verified Redape documentation
and recorded a failed INMET catalogue attempt; no soil CSV/API payload was fetched.
The observed noncommercial licence label does not establish commercial or AI-use
clearance. Connection reset on one request is not a provider-outage finding.

The earlier three international translation batches contain 801 source-bound AI
draft entries. An additional 128-entry automatic-plan/nursery packet covers French,
Spanish, Brazilian Portuguese and Swahili. Frozen source/keys/hashes/tokens and
12 corruption controls were independently checked. Regional tags and terminology
are not interchangeable; no named fluent review or new runtime language approval
is present. These remain review packets, not a translated app or lessons.

Two existing-language release-copy batches supply 32 and 36 exact candidates for
isiZulu, Sesotho, Xitsonga and Tshivenda. They are wired only through the existing
explicitly unreviewed source-paired mechanism, preserving old chunk bytes, English
fallback and review notices. Structural/runtime checks and recent-history coverage
pass; no fluent approval is implied by AI worker names or roles.

AGY's completed CLI jobs exited successfully after worker handoff. Its next
bounded job compares three freshly fetched official Tend pages with the actual
current implementation, ranking three useful market-gardener workflows. Vendor
public-page claims are distinct from logged-in product testing or validated
customer research. Root reviews compact outputs and actual receipts before any
publication. Optional interaction sharing remains off; supervision checks actual
process/artifacts and normal scoped approvals, never a Working label alone.

## Invariants throughout

Leave PLAN_VERSION, calibrated lesson/quiz bodies, species names and measured
saved geometry unchanged. Preserve old plans, account isolation and existing
permissions. Never silently convert currencies or units, choose default
agronomic values, or turn unknown evidence into zero or approval. Quarantined
broad research stays outside release bundles. Every release needs exact
branch/SHA/PR, current-head full checks, visible and persistence verification,
and verified production identity recorded on issue #35. Completing one milestone
does not complete this sustained programme or its human review gates.
