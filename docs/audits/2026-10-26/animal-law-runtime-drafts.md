# Animal law runtime draft continuation — 2026-10-26

- Auditor: Codex; no additional agents or fluent reviewer.
- Reviewed revision: `a35c0d408455d01a38df885bd109c391e46290ac`, branch `codex/four-language-animal-legal`, with the local implementation and evidence described below.
- Deployment inspected: none; no merge or deployment.
- Previous audit: [Legal source continuation](animal-legal-translation-source-review.md). Carry forward TLAG-001–004 and the earlier CP-035–037 dispositions; preserve the draft-only checkpoint as history.
- Scope: all 55 current animal-law notes / 73 catalogue bindings, their four native presentations, individual English originals and shared guide exports. Source corrections remain distinct from translations.
- Evidence type: primary table inspected, immutable source history, current preservation/negative checks, actual isolated component browser states, actual PDF text/bounds/page/pixel checks and visual inspection. No real records or backend save.

## What was already done

The previous record completed faithful drafts of the original 55 notes and kept them out of the runtime registry while three source-presentation issues were unresolved. All original wording, citations and original drafts remain available. The current packet preserves that checkpoint and adds only the bounded corrections below. The existing animal-data generator is unchanged; dossier edits produced the corresponding generated data.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| TLAG-001 | The old Nile tilapia statement did not match the actual 2020 listing and omitted its permitted-aquaculture distinction. | Bounded source correction implemented; source/runtime/PDF checked | Six fish legal notes now distinguish the inspected 2020 Category 3 / Category 2 permitted-aquaculture listing and accredited-hatchery sale/transport condition from dated 2015 assertions. Original records are captured. No latest-2026 or individual-farm permit certification. |
| TLAG-002 | A present-tense wool-export assertion rested on a 2020/2021 review. | Historical/current distinction implemented and checked | The note now reports that dated review in the past tense and explicitly does not establish current export permission. Both languages and actual PDFs retain the complete condition and original source. |
| TLAG-003 | Fish notes and one numeric reference could imply blanket farm permission. | Bounded correction implemented; current authorisation unverified | Dated 2015 permit/protected-area/water statements are explicitly historical; current site/water permission is unconfirmed. The unsupported legally-unrestricted phrase is removed from one numeric note in English and all four drafts. Every farming figure, unit, numeric citation and calendar remains unchanged. |
| TLAG-004 | Legal paragraphs needed four-language runtime presentation and complete English originals. | Implemented; focused/browser/PDF verified; full ordered suite pending | All 55 notes have complete drafts and per-note English disclosures. Exact catalogue-field guards preserve private edits. New UI/tour copy marks drafts and source age. The registry retains every parent row, growing from 1386 to 1444 entries. |
| TLAG-005 | A short Xitsonga permit condition put its final words after the next page's repeated header. | Reproduced, repaired and visually verified | [Before page 16](../../translation/four-language-completion/evidence/animal-legal/runtime/ts-paragraph-before-page-16.png), [before page 17](../../translation/four-language-completion/evidence/animal-legal/runtime/ts-paragraph-before-page-17.png), [after page 17](../../translation/four-language-completion/evidence/animal-legal/runtime/ts-fish-complete-permit-page-17.png). Native paragraph preflight now reserves the same guard space as its line check. Actual old/new code regression reproduces failure, passes after correction and fails on reversion; English trace and oversized-note content remain exact. |

## Verification

- Typecheck and affected suite: 189 tests across 14 files passed, plus whitespace clean; final focused confirmation records the exact final allowed-path/release-syntax changes separately.
- Full test suite: required ordered final branch run pending; no complete/green-CI claim yet.
- Preservation: only eight named source fields may change. Whole original source/model/card/guide/inventory/figure/citation/callback assertions remain, with an independent source-correction expectation and negative cases. Source species identities, measured geometry, lesson bodies and farming quantities remain unchanged.
- Browser: 60 actual before and 60 after native phone cases, 292 complete legal native/English pairs and exact parent values; 16 representative desktop cases with 100 complete pairs; six language switches preserve selections/months and emit no save callback; two English phone cases have no duplicate originals. Zero horizontal overflow. The actual four-language phone viewport contact and four desktop law viewports were inspected.
- PDFs: 14 documents / 200 pages / 97,331 checked word bounds; all 1176 native whole-guide clauses complete. Every 292 legal, 224 care and 140 reference binding occurrence stays whole on a page, including repeated fields across enterprises. Eight native contact sheets, nine enlarged current pages and both actual failed-before pages inspected. Two independently adjusted expected/current English control sets retain identical pixels/text; original English before documents retain the intentional source differences.
- Other limits: actual component fixtures use synthetic parent data; full production route, account persistence, integration, physical devices, fluent review and current site/export authorisation are unverified. Initial missing rectangle metadata and original failure artifacts remain preserved. The bounded 801-field guidance inventory still has 248 prose candidates and three classification candidates; this is not whole-app coverage.

[Current runtime evidence and limits](../../translation/four-language-completion/evidence/animal-legal/runtime/README.md) supersede the older draft-only folder status. This changes the picture. `PLAN_VERSION` is unchanged. No new species, farming quantity, paid call, merge or deployment.

## Next continuation

Freeze the final source/evidence checkpoint and run Node24 typecheck, the full registered suite and whitespace checks in that order. Read the actual terminal result; never restart a live run because of elapsed time. Then add new delivery proof, push the finished branch once, open/attach the stacked draft PR and read both exact-head CI jobs. Keep the whole-app goal active for remaining translation, integration, media and review work.

## Verified local delivery continuation

The ordered full run at6247d4a1e completed with typecheck0,5,864pass0fail1existingTODO/5,865total572files,diff0. All1,756 frozen inputs remain exact. [Delivery proof](../../translation/four-language-completion/evidence/animal-legal/DELIVERY.md) supersedes full-suite-pending language above. Final-head CI, integration and fluent/current-permission approval remain pending.
