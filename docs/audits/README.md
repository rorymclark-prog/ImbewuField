# ImbewuField audit archive

This is the shared starting point for Rory, Claude and Codex. Read the latest
record for the area being worked on before opening another audit. Build on its
findings and subsequent changes; do not restart from an older snapshot.

## Site survey: start here

1. [Current continuation record — 2 October 2026](2026-10-02/site-survey-continuation.md).
2. [Original illustrated survey and report audit — 20 September](../SITE-SURVEY-AUDIT-2026-09-20.md).
3. [isiZulu survey review packet — 25 September](../studies-review-2026-09-20/SITE-SURVEY-ISIZULU-AGY-REVIEW-PACKET-2026-09-25.md).

The continuation record distinguishes work already merged from open improvements
and checks that have not been performed. The older audit's pending-release text
is historical; it does not describe the current release status.

## Crop and production planning: start here

Latest: [Production by plant age and clearer graphics — 4 October 2026](2026-10-04/production-age-visuals-codex.md).

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

This seeds the archive with the 30 documents Claude collected on 20 September,
plus the later survey review records and today's continuation. Dates come from
the document title/body or dated filename. `*` means the document has no explicit
audit date: its first Git commit date is used for discovery, not claimed as the
date the audit was performed. Inclusion here does not certify current findings.

| Date | Area and record |
| --- | --- |
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
