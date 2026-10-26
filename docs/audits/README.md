# ImbewuField audit archive

This is the shared starting point for Rory, Claude and Codex. Read the latest
record for the area being worked on before opening another audit. Build on its
findings and subsequent changes; do not restart from an older snapshot.

## Site survey: start here

Latest implementation: [Survey draft recovery and signed-in Ubhejane check — 22 October 2026](2026-10-22/survey-draft-recovery-codex.md).

1. [Previous continuation record — 2 October 2026](2026-10-02/site-survey-continuation.md).
2. [Original illustrated survey and report audit — 20 September](../SITE-SURVEY-AUDIT-2026-09-20.md).
3. [isiZulu survey review packet — 25 September](../studies-review-2026-09-20/SITE-SURVEY-ISIZULU-AGY-REVIEW-PACKET-2026-09-25.md).

The continuation record distinguishes work already merged from open improvements
and checks that have not been performed. The older audit's pending-release text
is historical; it does not describe the current release status.

## Crop and production planning: start here

Latest: [Production plan re-audit — 10 October 2026](2026-10-10/production-reaudit-codex.md).

Previous: [Production by plant age and clearer graphics — 4 October 2026](2026-10-04/production-age-visuals-codex.md).

Previous: [Regional production picture calendars and eight climate examples — 4 October 2026](2026-10-04/regional-production-calendar-codex.md).

Previous: [Individual products, purchasing choices and variety assumptions — 4 October 2026](2026-10-04/production-products-codex.md).

Previous: [Food forest and animal visibility in printed calendars — 3 October 2026](2026-10-03/production-empty-sections-codex.md).

1. [Timing narrative: dated food calendar and scoped crop comparisons — 2 October 2026](2026-10-02/production-timing-narrative-codex.md).
2. [Live edge cases: food-only plans and decimal totals — 2 October 2026](2026-10-02/production-live-edge-cases-codex.md).
3. [Production-plan follow-up — 2 October 2026](2026-10-02/crop-production-codex-followup.md).
4. [Original crop/production finding register — 2 October 2026](2026-10-02/crop-production-audit.md).
5. [Today's nine-page Ubhejane crop plan audit](2026-10-02/Ubhejane-Crop-Plan-Audit-2026-10-02.pdf).
6. [Earlier crop-plan truth audit — 6 August](../CROP-PLAN-TRUTH-AUDIT-2026-08-06.md).

Today's PDF is preserved as the original audit snapshot. Its follow-up chat is
still implementing changes; consult the register before treating an original
finding as either unresolved or fixed in a later build.

## Save a new audit

- Save under `docs/audits/YYYY-MM-DD/<area>-<auditor>.md`, using the date the audit
  was performed. Use `Europe/Vienna` for dates. Add a suffix for a second audit on
  the same day rather than overwriting the first.
- Copy [the audit template](TEMPLATE.md). Record the auditor, reviewed commit,
  previous audit, evidence, findings, verification limits and next work.
- Carry forward finding IDs and update their disposition with evidence. A merge,
  a passing test and a visual check are different kinds of evidence.
- Put durable screenshots or other suitable evidence beside the audit and link
  them. Exclude credentials, personal farmer records, logs and temporary QA routes.
- Add the record to the date index below, newest first. Keep historical audits
  where they are and link to them; do not move or silently rewrite their findings.
- Commit explicit paths, push the finished branch, and record the branch, SHA and
  audit link on issue #35, following `AGENTS.md`. A chat summary or temporary file
  is not the shared archive.

This convention applies to both Claude and Codex. The source lives in Git, so it
is available across their separate worktrees and chats after fetching the branch
or main. Local Downloads packs remain dated reading snapshots.

## Date index

- [Wave 27 farmer-facing error messages: w27-01 to w27-04, no raw browser, Firebase or storage wording on 15 screens; fieldwork API copy kept — 26 October 2026](2026-10-26/wave-27-raw-errors-claude.md).
- [Wave 26 Codex hand-offs closed after #1121 merged, and #1121's report screens checked: w26-01 to w26-04 — 26 October 2026](2026-10-26/wave-26-handoffs-claude.md).
- [Wave 25 forms, offline and keyboard capture: w25-01 to w25-07, practice-mode contact copy, hidden-input focus, offline ChunkLoadError on unvisited routes — 26 October 2026](2026-10-26/wave-25-forms-offline-keyboard-claude.md).
- [Wave 24 interaction capture behind clicks (drawer, forms, tabs, chat): w24-01 to w24-11, mostly dark-mode colours never seen on the dark page — 26 October 2026](2026-10-26/wave-24-interaction-claude.md).
- [Wave 23 rendered re-capture of the live build 98c8a22 and the new report workspaces: w23-01 to w23-07, the isiZulu Home date regression fixed first — 26 October 2026](2026-10-26/wave-23-recapture-claude.md).
- [Wave 22 rendered re-capture of the live build 8d2e1a9: w22-01 to w22-10, hydration errors on /home and /invoice, Lima clearance, weather card — 25 October 2026](2026-10-25/wave-22-recapture-claude.md).
- [Wave 21 rendered re-capture of the wave 20 build in isiZulu: w21-01 to w21-11, ten fixed, one handed to Codex — 24 October 2026](2026-10-24/wave-21-recapture-claude.md).
- [Wave 20 integration close-out: five tracks folded onto the wave 19 branch with main, w20-01 to w20-46 implemented, w19 partials closed with them — 24 October 2026](2026-10-24/wave-20-integration-claude.md).

- [Wave 20 rendered re-capture and visual review of the wave 19 build: new IDs w20-01 to w20-46 across five tracks, w19 partials carried — 23 October 2026](2026-10-23/wave-20-recapture-claude.md).

- [Wave 19 integration close-out: five tracks folded, w19-01 to w19-42 implemented, w18 partials closed with them — 23 October 2026](2026-10-23/wave-19-integration-claude.md).

- [Wave 19 rendered re-capture and visual review of the wave 18 build: new IDs w19-01 to w19-42 across five tracks, w18 partials carried — 23 October 2026](2026-10-23/wave-19-recapture-claude.md).

- [Wave 18 integration close-out: eight tracks folded, w18-01 to w18-59 implemented, w17-08 closed — 23 October 2026](2026-10-23/wave-18-integration-claude.md).

- [Wave 18 rendered re-capture and visual review of the wave 17 build: new IDs w18-01 to w18-59 across eight tracks, w17-08 partial — 23 October 2026](2026-10-23/wave-18-recapture-claude.md).

- [Wave 17 integration close-out: three tracks folded, w17-01 to w17-08 dispositioned, focus and on-forest guards tightened — 23 October 2026](2026-10-23/wave-17-integration-claude.md).

- [Wave 17 rendered re-capture of the wave 16 build: new IDs w17-01 to w17-08, /farmer w17-04 fixed — 23 October 2026](2026-10-23/wave-17-recapture-claude.md).

- [Wave 16 integration close-out: five tracks folded, 16 IDs dispositioned, /farmer w16-07 finished — 23 October 2026](2026-10-23/wave-16-integration-claude.md).

- [Wave 16 rendered re-capture of the wave 15 build: new IDs w16-01 to w16-11 — 22 October 2026](2026-10-22/wave-16-recapture-claude.md).

- [Wave 15 integration close-out: five tracks folded, 21 assigned IDs dispositioned, w15-04 opened — 22 October 2026](2026-10-22/wave-15-integration-claude.md).

- [Wave 15 rendered re-capture of the wave 14 build: 50 of 54 rows verified, 3 regressions fixed — 22 October 2026](2026-10-22/wave-15-recapture-claude.md).

- [Survey draft recovery and signed-in Ubhejane check — 22 October 2026](2026-10-22/survey-draft-recovery-codex.md).

- [Wave 14 integration close-out: 166 findings dispositioned, five tracks folded — 17 October 2026](2026-10-17/wave-14-integration-claude.md).

- [Wave 14 rendered re-capture of the wave 13 build: 120 rows verified, 3 regressions fixed — 17 October 2026](2026-10-17/wave-14-recapture-claude.md).

- [Wave 13 visual and UX close-out: all 160 findings dispositioned — 17 October 2026](2026-10-16/wave-13-integration-claude.md).

- [Rendered visual and UX audit: 160 findings across every route, theme and viewport — 16 October 2026](2026-10-16/visual-ux-audit-claude.md).

- [Study offline five-wording close-out — 13 October 2026](2026-10-13/study-offline-five-holds-codex.md).

- [App-wide audit, second round: 63 open findings — 10 October 2026](2026-10-10/app-wide-audit-claude.md).

- [Production plan re-audit — 10 October 2026](2026-10-10/production-reaudit-codex.md).

- [App-wide audit close-out: all 92 findings dispositioned — 10 October 2026](2026-10-10/app-wide-closeout-claude.md).

- [Blind-reviewed Study corrections and genuine audit coverage — 12 October 2026](2026-10-12/study-blind-reviewed-corrections-codex.md).
- [Reading titles and least-intensive action — 8 October 2026](2026-10-08/study-reading-title-lightest-codex.md).

- [Market residual ordinary prose and precise cost terms — 6 October 2026](2026-10-06/study-market-ordinary-residual-codex.md).

This seeds the archive with the 30 documents Claude collected on 20 September,
plus the later survey review records and today's continuation. Dates come from
the document title/body or dated filename. `*` means the document has no explicit
audit date: its first Git commit date is used for discovery, not claimed as the
date the audit was performed. Inclusion here does not certify current findings.

| Date | Area and record |
| --- | --- |
| 2026-10-10 | [Production plan re-audit — Codex](2026-10-10/production-reaudit-codex.md) |
| 2026-10-07 | [Reading and Vegetables ordinary-clause follow-up — Codex](2026-10-07/study-core-followup-codex.md) |
| 2026-10-07 | [Tshivenda Reading frost placement — Codex](2026-10-07/study-reading-frost-placement-codex.md) |
| 2026-10-07 | [Reading comparisons and remaining prose — Codex](2026-10-07/study-reading-comparisons-codex.md) |
| 2026-10-07 | [Study wording precision — Codex](2026-10-07/study-precision-codex.md) |
| 2026-10-07 | [Study Introduction fair sharing — Codex](2026-10-07/study-intro-fair-sharing-codex.md) |
| 2026-10-07 | [Study ordinary framing follow-up — Codex](2026-10-07/study-ordinary-framing-codex.md) |
| 2026-10-06 | [Soil and Water residual translations — Codex](2026-10-06/study-soil-water-residual-codex.md) |
| 2026-10-06 | [Sesotho Introduction silent release — Codex](2026-10-06/study-st-intro-silent-release-codex.md) |
| 2026-10-06 | [Introduction full ordinary prose — Codex](2026-10-06/study-intro-full-ordinary-completion-codex.md) |
| 2026-10-06 | [Vegetables L1 ordinary residual — Codex](2026-10-06/study-vegetables-l1-ordinary-residual-codex.md) |
| 2026-10-06 | [Vegetables L3 ordinary residual — Codex](2026-10-06/study-vegetables-l3-ordinary-residual-codex.md) |
| 2026-10-06 | [Vegetables pest and assessment precision — Codex](2026-10-06/study-vegetables-pest-precision-codex.md) |
| 2026-10-06 | [Introduction and Reading ordinary prose — Codex](2026-10-06/study-intro-reading-ordinary-codex.md) |
| 2026-10-06 | [Soil ordinary prose follow-up — Codex](2026-10-06/study-soil-ordinary-completion-codex.md) |
| 2026-10-06 | [Water ordinary prose and paired slides — Codex](2026-10-06/study-water-ordinary-completion-codex.md) |
| 2026-10-06 | [Vegetables L3 ordinary assessment completion — Codex](2026-10-06/study-vegetables-l3-completion-codex.md) |
| 2026-10-06 | [Water regional learner and slide precision — Codex](2026-10-06/study-water-reviewed-precision-codex.md) |
| 2026-10-05 | [Study explicit narration choice — Codex](2026-10-05/study-explicit-narration-choice-codex.md) |
| 2026-10-05 | [Soil learner fuller regional drafts — Codex](2026-10-05/study-soil-learner-fuller-codex.md) |
| 2026-10-05 | [Market L2/L3 ordinary learner completion — Codex](2026-10-05/study-market-l2-l3-ordinary-codex.md) |
| 2026-10-05 | [Soil and Water regional draft integration — Codex](2026-10-05/study-soil-water-material-integration-codex.md) |
| 2026-10-05 | [isiZulu source text in image zoom — Codex](2026-10-05/study-isizulu-source-zoom-codex.md) |
| 2026-10-05 | [Core Study isiZulu image descriptions — Codex](2026-10-05/study-isizulu-image-descriptions-codex.md) · [Vegetables L2 fuller regional drafts — Codex](2026-10-05/study-vegetables-l2-fuller-codex.md) · [Vegetables L4 ordinary regional drafts — Codex](2026-10-05/study-vegetables-l4-ordinary-codex.md) |
| 2026-10-05 | [Vegetables L1 fuller regional drafts — Codex](2026-10-05/study-vegetables-l1-fuller-codex.md) · [Core Study isiZulu deck source pairing — Codex](2026-10-05/study-isizulu-deck-source-pairing-codex.md) |
| 2026-10-05 | [Core Study isiZulu learner source follow-up — Codex](2026-10-05/study-isizulu-learner-source-followup-codex.md) · [Core Study residual translation follow-up — Codex](2026-10-05/study-outcomes-residual-codex.md) · [Core Study isiZulu source-pairing audit — Codex](2026-10-05/study-isizulu-source-pairing-codex.md) |
| 2026-10-04 | [Core Study Reading body and paired-deck follow-up — Codex](2026-10-04/study-reading-body-fuller-codex.md) |
| 2026-10-04 | [Core Study learner translation residuals — Xitsonga Intro implementation follow-up](2026-10-04/study-learner-ts-intro-codex.md) |
| 2026-10-04 | [Core Study learner translation residuals — Codex](2026-10-04/study-learner-residual-codex.md) |
| 2026-10-04 | [Production by plant age and clearer graphics — Codex](2026-10-04/production-age-visuals-codex.md) |
| 2026-10-04 | [Regional production picture calendars — Codex](2026-10-04/regional-production-calendar-codex.md) |
| 2026-10-04 | [Individual production products and variety assumptions — Codex](2026-10-04/production-products-codex.md) |
| 2026-10-03 | [Production-plan section visibility — Codex](2026-10-03/production-empty-sections-codex.md) |
| 2026-10-02 | [Production timing narrative: dated food and scoped crop comparisons](2026-10-02/production-timing-narrative-codex.md) |
| 2026-10-02 | [Live production edge cases: food-only maps and decimal quantities](2026-10-02/production-live-edge-cases-codex.md) |
| 2026-10-02 | [Production-plan follow-up: implementation, sources and verified outputs](2026-10-02/crop-production-codex-followup.md) |
| 2026-10-02 | [Crop/production planning: original register](2026-10-02/crop-production-audit.md) · [Original nine-page audit PDF](2026-10-02/Ubhejane-Crop-Plan-Audit-2026-10-02.pdf) |
| 2026-10-02 | [Site survey: prior work, merged follow-ups and next improvements](2026-10-02/site-survey-continuation.md) |
| 2026-09-26 | [Garden Survey isiZulu dynamic status](../study-translation-reviews/GARDEN-SURVEY-ISIZULU-DYNAMIC-STATUS.md) · [Sesotho shell draft](../study-translation-reviews/GARDEN-SURVEY-SESOTHO-UI-DRAFT.md) |
| 2026-09-25 | [Site Survey isiZulu review packet](../studies-review-2026-09-20/SITE-SURVEY-ISIZULU-AGY-REVIEW-PACKET-2026-09-25.md) |
| 2026-09-20 | [Site survey and visual report — Codex](../SITE-SURVEY-AUDIT-2026-09-20.md) |
| 2026-09-20* | [Report pictures: isiZulu language review](../translations/report-pictures-isizulu-review.md) |
| 2026-09-09 | [Mentor visual quality and ACT reporting readiness](../VISUAL-QUALITY-AND-ACT-READINESS-2026-09-09.md) |
| 2026-09-08 | [ACT/SEF mentor readiness](../ACT-SEF-MENTOR-READINESS-2026-09-08.md) · [Training quality](../TRAINING-QUALITY-AUDIT-2026-09-08.md) |
| 2026-09-07 | [Site report identity, saved settings and cover](../SITE-REPORT-REVIEW-2026-09-07.md) · [Records, studies and tour](../RECORDS-TOUR-REVIEW-2026-09-07.md) |
| 2026-09-06 | [Visual site report](../VISUAL-SITE-REPORT-AUDIT.md) · [MEL feature audit](../MEL-FEATURE-AUDIT.md) |
| 2026-09-05 | [Site report](../SITE-REPORT-AUDIT-2026-09-05.md) · [Production metrics](../PRODUCTION-METRICS-AUDIT-2026-09-05.md) · [Assessment and access](../MEL-ASSESSMENT-AUDIT-2026-09-05.md) · [Dashboard visual review](../DASHBOARD-VISUAL-REVIEW.md) |
| 2026-09-04 | [Render audit implementation](../RENDER-AUDIT-IMPLEMENTATION-2026-09-04.md) |
| 2026-08-29* | [Plant-art final audit](../PLANT-ART-FINAL-AUDIT.md) · [Climate-zone crown HSV audit](../PLANT-ART-HSV-AUDIT.md) |
| 2026-08-15 | [Audit findings requiring Rory's decisions](../AUDIT-NEEDS-RORY-2026-08-15.md) |
| 2026-08-10 | [Course gaps](../COURSE-GAP-AUDIT-2026-08-10.md) · [Course art](../COURSE-ART-AUDIT-2026-08-10.md) · [Sample-mode course gap](../SAMPLE-MODE-COURSE-GAP-2026-08-10.md) |
| 2026-08-06 | [Crop-plan truth](../CROP-PLAN-TRUTH-AUDIT-2026-08-06.md) · [Vision 2 design foundation](../VISION2-DESIGN-FOUNDATION-AUDIT.md) |
| 2026-08-02 | [Farmer money](../AUDIT-FARMER-MONEY-2026-08-02.md) |
| 2026-08-01 | [Earthworks](../EARTHWORKS-AUDIT-2026-08-01.md) · [Design Studio polish](../POLISH-AUDIT-PROGRESS-2026-08-01.md) · [Rules](../RULES-AUDIT-PROGRESS-2026-08-01.md) |
| 2026-07-23* | [Reference blueprint remaining layers](../REFERENCE-BLUEPRINT-REMAINING-LAYERS-AUDIT.md) |
| 2026-07-20 | [Plan-sheet layers](../LAYER-AUDIT-2026-07-20.md) |
| 2026-07-18 | [Newcomer flow](../FLOW-AUDIT-2026-07-18.md) |
| 2026-07-16 | [Glossy render prompts — Claude](../GLOSSY-PROMPT-AUDIT.md) |

## Earlier local collection

Claude's existing reading pack is
`/Users/roryclark/Downloads/ImbewuField-audits-2026-09-20/INDEX.md`.
It contains the 30 documents above and a separate 17 September browser audit
with screenshots. That pack was exported at `a9b3f5a`; it does not include the
25–26 September survey follow-ups. Keep it as a historical snapshot.

The browser audit could not exercise the signed-in roles. Its coverage limit is
not evidence that the current signed-in survey works or fails.
- [Vegetables L2 fuller regional drafts — 2026-10-05](2026-10-05/study-vegetables-l2-fuller-codex.md)
