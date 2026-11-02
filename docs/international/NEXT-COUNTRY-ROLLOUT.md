# Next country rollout — engineering backlog

Prepared 2 November 2026 for the international foundation milestone. Priorities
follow Rory's intended growers and organisations and the four existing dossiers.
No market-size study, funding-eligibility assessment or country launch approval
has been completed. A country remains an engineering pilot until its own gates
below are met.

## What this delivery establishes

- Separate country, agricultural-region and interface-language inputs in the
  reference workspace. Every current pilot has zero reviewed agricultural regions.
- Source discovery for Kenya, the United Kingdom, the United States and Brazil;
  five evidence purposes remain separate: biodiversity, extension, weather/frost,
  soils and plant legality.
- A bounded NASA POWER demonstration at fixed public coarse points. This does not
  supply frost dates, local crop suitability or production-plan approval.
- Source-paired French, Spanish, Portuguese and Swahili drafts for 32 generic UI
  messages per language. There are zero fluent-human-reviewed messages in this
  new packet. Language does not select country, currency or units.
- Five grower-led workflow references and ten evidence indicators. Their review
  screen uses fictional fixtures and has no live farm-record or publication path.

The existing South African production plan and nursery planner remain their own
authorities. This milestone does not redirect international sites into that advice.

## Proposed pilot sequence

These are bounded next work packages, with parallel discovery possible. Each
package ends in a reviewed region dossier before a production adapter is proposed.

| Order | Pilot and intended use | Next concrete delivery | Release dependency |
| --- | --- | --- | --- |
| 1 | Kenya: food-security, livelihoods and agroecology projects | Select one agricultural-region scope; verify the existing KALRO, KEFRI, KMD and KEPHIS references plus an appropriate soil authority. Record exact datasets, dates, units, reuse terms and missing-data behaviour. | Dated local agronomy and legal-scope review for that region; Swahili and English UI scope reviewed separately. |
| 2 | United Kingdom: commercial market gardens and community growing | Define one pilot jurisdiction and growing-region scope. Resolve the appropriate extension/advice route, devolved responsibilities, weather/frost evidence and soil/biodiversity access. | Country-wide labels must not imply one UK-wide local authority, planting calendar or permission. |
| 3 | United States: commercial market gardens and livelihood projects | Define one state/region pilot. Assess NWS and NRCS against that specific area and keep state/local extension and legal evidence separate from federal reference pages. | A federal contact page or functioning API cannot approve every state, tribal or local requirement. |
| 4 | Brazil: agroforestry, agroecology and livelihood projects | Define one region and verify suitable Embrapa, SiBBr, weather, soil and legal source scopes. Review Brazilian Portuguese wording independently of the current European-Portuguese-preference draft. | Local agronomic and jurisdiction review plus an explicit reviewed language variant. |

Canada, other European jurisdictions, Australia/New Zealand and additional African,
Asian and Latin American countries remain a discovery queue. No country inherits
another country's region, sowing calendar, legal status or source approval.

## Cross-country work packages

| ID | Owner role | Concrete output and acceptance evidence |
| --- | --- | --- |
| INT-01 | Coordinator + existing site-storage/sync owners | Explicit site country/region context and a reviewed policy for legacy sites. Keep unknown values unknown; demonstrate old-plan recovery, account/site isolation and cross-device behaviour before any schema release. |
| INT-02 | Bounded source researcher; coordinator reviews | One region dossier with actual primary-page/dataset receipts, dated provenance, coverage, resolution, units, licence, attribution, authentication, cadence and failure/missingness. Unsupported fields stay UNKNOWN. |
| INT-03 | Local agronomy and jurisdiction reviewers | Named, dated, source-bound review with region, scope and expiry/review date. Biodiversity occurrence, conservation status and legal permission remain separate conclusions. No species additions in the foundation work order. |
| INT-04 | Provider implementation owner | Opt-in typed adapter for a reviewed use case; test units, geography, time ranges, missing values, rate limits, timeouts, stale data and attribution. Preserve the existing climate/ecology authorities and expose unavailable data without borrowing SA defaults. |
| INT-05 | Fluent language reviewers + localization owner | Exact reviewer/date/source/text evidence for a bounded UI pilot; demonstrate English fallback and invalidation when the English source changes. Extend app language selection only after that pilot scope is reviewed. Lessons, quizzes, reports, narration and offline packs need their own reviewed scope. |
| INT-06 | Existing farm/programme evidence owners | Permission-filtered adapters to existing production, sales, task, journal and MEL records. Preserve actual/estimate distinctions, source reconciliation, consent, publication, date cutoffs, units and recorded currency. Do not add a second ledger or grant sharing through this review screen. |
| INT-07 | Coordinator | Current-head checks, hosted desktop/phone review, save/reload and failure-state evidence, approved release scope, production build-SHA verification and issue #35 handoff. Mark every pilot's supported capability explicitly. |

## Regional research constraints carried forward

The [compact shortlist](agy-regional-research/VERIFIED-SHORTLIST.md) and
[receipts](agy-regional-research/verified-receipts.json) describe fetches on
1 November 2026. Recheck the relevant status and terms before implementation.
Those receipts recorded SoilGrids REST as paused, BOM automated feeds with a
noncommercial restriction and DWD CDC terms as CC BY 4.0. NRCS's documented
100,000-row bound concerned the Post.Rest Query Service output; nightly cadence
was UNKNOWN. Dataset-level licences and suitability remain unresolved where the
fetched primary page did not establish them.

Documentation fetched, endpoint response fetched and product integration implemented
are separate evidence levels. The regional research implemented no product adapter.
Its large regional drafts remain quarantined and excluded from publication.

## Next AGY assignment, when dispatched

AGY's earlier research run is finished. A new run requires a bounded work order;
an old Working label or status-file timestamp is not execution evidence. A suitable
next assignment is INT-02 for one selected pilot region: at most three disjoint
official sources per researcher, exact primary-page fetch receipts, compact claims
and explicit UNKNOWN fields. The coordinator verifies receipts and source fit.

AGY owns only its assigned research-document paths. It does not write production
code, approve agronomy, change species/lessons, alter permissions or publish a
country launch. Private conversation IDs, raw transcripts, credentials and farmer
coordinates stay out of research and GitHub. Optional interaction-data sharing
remains off under Rory's existing onboarding choice.

## Definition of a country-production pilot

A pilot needs a reviewed region and dated evidence in all required purposes, a
separately reviewed crop-planning implementation, demonstrated persistence and
failure behaviour, reviewed UI scope, and a verified release. Reference coverage
alone leaves `productionPlanSupported` false. The gate must be able to reject an
unsupported region, expired source or unreviewed translation in an actual test.
