# Wisconsin tomato first-harvest reference — 19 November 2026

- Auditor: Codex implementation and verification. The separate Antigravity prototype was reviewed as research evidence.
- Base: `088afa397864824a6755249b3751ef62f966aed9`, tree `5b2455b9d6849562c821fade2982a7c16f962191`.
- Branch: `codex/wisconsin-first-harvest-20261119`.
- Previous audit: [Wisconsin nursery source disclosures](../2026-11-18/wisconsin-reference-disclosure-codex.md).
- Scope: Provisional crop preview, historical saved profiles and printable exports. Production and physical devices have not been exercised for this candidate.

## Source and applicability

K.A. Delahaut and A.C. Newenhouse, [*Growing tomatoes, peppers, and eggplants in Wisconsin: A guide for fresh-market growers*](https://barron.extension.wisc.edu/files/2023/02/Growing-Tomatoes-Peppers-and-Egg-Plants-in-Wisconsin.pdf#page=10), Table 3, printed page 7 / PDF page 10. The original was accessed 18 November 2026. SHA-256 `a3191d09e3c0a38a8796666cedf7d80d332dc92581a29b2b5da6eee56aff3eda`. The cover says A3687 and the back imprint A3685. The back carries copyright 1997. The month and day and any agronomic revision date are unknown.

The tomato row gives 65–80 days to first harvest alongside outdoor planting of plants. The app interprets the outdoor transplant date as the start of the interval. The guide notes cultivar variability. The appraisal is limited to this numerical fact and attribution. Document reproduction permission remains unknown.

Only the existing tomato crop, a declared US/Wisconsin region, transplant establishment, an entered field date and an explicit grower declaration for outdoor fresh-market production enable the reference. The grower chooses 65 or 80 days. The separate nursery interval stays separate. A date derived from the source keeps its historical qualification. Planting suitability, picking duration, occupancy, turnaround, harvest weight, density and water demand require independent evidence.

## Findings and disposition

| ID | Trigger and outcome | Verification |
| --- | --- | --- |
| WI-HARVEST-01 | A grower can use one historical interval to derive a conditional first-harvest date. Blank choice and unsupported scope keep the result unknown. | Original table viewed and interval checked independently. Node 24 cases cover the two date offsets, mismatched country, region, method and purpose, and tampered source metadata. |
| WI-HARVEST-02 | Returning to the original region after changing it requires fresh consent. A saved profile carries the chosen purpose and endpoint for review. | Mounted editor test exercises selection, consent, saving and a region round trip. The released reader cannot replay the new receipt and its writer projection rejects a lossy rewrite of the sample crop book. |
| WI-HARVEST-03 | The date in the first printable sample could be separated from the historical caveat. | The date and a concise qualification now share the same result row in print and the same list item in the live and saved views. All four pages of the generated sample A4 PDF were inspected. The dated result, year, cultivar caveat and unsupported fields were retained. |

The new source choice is versioned and serialized only when present. Older requests follow the original fingerprint path. Existing saved plans, crop identities and measured geometry retain their existing rules. This changes the picture in provisional result rows. `PLAN_VERSION` remains untouched.

## Verification and release

The local Node 24 typecheck, 168 affected cases, whitespace and release-note checks passed. The print check used actual exporter HTML from a synthetic request. The 65-day example adds 65 days to 1 June 2027 and yields 5 August 2027. The sample is an arithmetic check. Production rollout requires the candidate CI, preview and independent reviews. The previous release’s post-merge CI is tracked separately.
