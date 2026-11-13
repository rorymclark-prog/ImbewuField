# Great Lakes tomato seed-starting reference — 13 November 2026

- Auditor: Codex / Command Centre; branch `codex/usda-tomato-nursery-20261113`.
- Base: `41c3ea11342e8310190b144b65d4ed31ebb5df53`, tree `c82ac40f8cf8a756921c3b4b96f94bbf1f2898ef`, draft PR1366.
- Previous: [Provisional entry messages](provisional-entry-copy-codex.md), [Cabbage nursery reference](usda-cabbage-nursery-reference-codex.md) and [Regional spacing](great-lakes-spacing-codex.md).
- Scope: existing `tomatoes` crop only; one optional undated regional seed-starting reference. No catalogue, species name, existing planting, measured geometry, schema, source file, workflow or PLAN_VERSION change.

## Source and interpretation

The original [USDA NRCS Community Garden Guide — Season Extension — Seed Starting](https://www.nrcs.usda.gov/plantmaterials/mipmcar9781.pdf) was retrieved again on13 November. Its SHA256 remains `ff7a1dfea4582f69d8349e150e7e875b02df32c01bc1eef957aded6fa2a9483e`. Original physical pages1,5,9 were rendered and visually read. Page1 limits the guide to Great Lakes States vegetable bedding plants; page5's **Tomato** row gives **8** under **WEEKS BEFORE TRANSPLANTING**. The exact conversion is8 ×7 =56days. Publication and agronomic revision dates remain unknown; retrieval/PDF metadata are not substituted for them.

This is seed-starting lead time before garden transplanting, not time after emergence or a germination duration. No extra hardening-off period is added. The row's planting-cell key(3) is cell size, not a surviving stand. Spacing, plant count, yield, local calendar, harvest duration, occupancy, frost safety and seedling readiness receive no new defaults.

The [USDA reuse policy](https://www.usda.gov/about-usda/policies-and-links), re-read on13 November, describes most USDA site information as public domain with attribution requested and protected-material exceptions. The adapter restates the numerical table fact with credit; no logos, photos or CAD artwork are incorporated. Original PDF, page renders, policy-read receipt and exact transcription remain in the private `usda-tomato-nursery` source packet.

## Findings and disposition

| ID | Change or carried finding | Status and limits |
| --- | --- | --- |
| GLOBAL-USDA-TOMATO-LEADTIME-01 | CountryUS, existing crop`tomatoes`, declared region“Great Lakes States”, bedding transplants and explicit source choice permit the undated reference. Conditional nursery start uses the grower's separate field-entry date. | Implemented; source is a historical transfer, never current local evidence or a US-wide recommendation. Successor hosted and independent exact-source review remain separate. |
| GLOBAL-PROVISIONAL-ENTRY-COPY-01 | Parent exact source and hosted notices distinguish provisional support from held SA catalogue advice. | Retained bounded closure; no permission expansion here. |

The grower can override, explicitly withhold or reset nursery duration. Changes to crop, variety, water or method retire this source choice; country/site/source round trips remain governed by the existing context generation. Direct sowing cannot select the reference. Printable and historical profiles retain the original source, unknown publication date, assumptions and override basis.

## Verification and limits

- Actual base panel negative control: the new mounted React test fails because the tomato source choice is absent. The actual base panel was temporarily loaded under this chat's sole ownership, then the changed panel was restored byte-for-byte; the control and hashes are retained. No assertion or existing guard was removed.
- Ordered typecheck passes, then149 affected checks pass with2workers and no failures/cancellations/skips/todos, then whitespace passes. Release-note addition is included in the final affected/notes verification. Local Node26.5.0 and current-head Node24 CI are separate evidence.
- The real export builder produced five original DEMO HTML files: source point, grower override, withheld value, missing field-entry date and unselected source. Actual source/override results were visually read in the browser; all five full AX records and inputs/results were checked. Date subtraction was independently recomputed with Python datetime. No print pagination, new browser download, hosted app interaction or real-account persistence is inferred from these local outputs.
- Synthetic entry10January2027 gives15November2026 from56days and6December2026 from a separately entered35-day override. Withheld/unselected/missing-date cases produce no nursery start. Plant count, yield and harvest date remain unknown; missing-date remains distinct from an unknown entry window. These are software controls, not farming recommendations.
- The temporary artifact server and its test tab were closed. No paid generation, provider request or real-account write was used.

## Remaining gates

Inspect the finished candidate's actual hosted app, full required CI/security and affected tests. Same-candidate Claude and authorised independent AGY outcomes remain held; a prepared manual packet or Codex agreement is not their review or proof of agronomic accuracy. Original P01–P24 programme requirements remain open. No production merge or release approval.
