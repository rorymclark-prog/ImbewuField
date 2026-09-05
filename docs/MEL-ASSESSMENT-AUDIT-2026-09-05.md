# ImbewuField assessment and access audit

Requested by Rory, 5 September 2026. This is an implementation record and an assessment protocol, not evidence that programme outcomes have already occurred.

## Findings and implemented response

The existing `/surveys` builder had three question types and a response count. It had no project stage, frozen assignment cohort, structured comparison, publication review, or NGO analysis page. Responses used random document IDs, permitting repeat submissions to inflate counts. Funder grants could authorise raw survey-answer reads. Staff creation did not pin a survey to the author's organisation. The new assessment system uses server-only collections, deterministic respondent IDs, frozen assignments and explicit publication. The legacy raw-answer funder read and cross-organisation survey creation are closed in the rules.

The account role already included `admin`, and NGO/funder page gates admitted it. A dashboard tab never assigned that role. Signed-in sample tours had a separate bug: real-role gates could reject the sample screen, and the portfolio hook could fetch live data while in sample mode. Account access now explains the role and provides sample role previews; sample portfolio reads are isolated. Ordinary funder menus omit farmer and mentor workflows. NGO staff can use role previews and inspect their own published assessment summaries.

## Assessment cycle

| Instrument | Timing | Purpose |
|---|---|---|
| Project baseline | Before support | Existing production, water access, food use, skills, barriers and goals |
| Course before | Before teaching | Self-reported ability in site observation, soil care, propagation, planning and records |
| Course after | Final course day | Repeat abilities, clarity, practical usefulness, language and first action |
| Project midpoint | Halfway, while changes are possible | Repeat baseline measures, support received, ACT/project staff support and priorities |
| Project closeout | Project completion | Repeat core measures, continued growing and remaining support |
| App midpoint | Alongside midpoint, separate optional form | Usability, language, device/data barriers and failed tasks |
| App closeout | At completion | Whether app improvements helped |

The supplied 2024 course document is an attendance certificate listing course topics, not an observed-skills rubric. The new forms do not pretend attendance or confidence demonstrates competence. The existing course lessons and quizzes are untouched. An observed practical assessment and a later sustainability follow-up remain useful next instruments, to be agreed with the trainer rather than inventing a pass standard.

Core questions use stable IDs, units and recall periods: 30 days for harvest/sales/support and 7 days for household garden-food use. These are project monitoring questions, not validated food-insecurity or nutrition scales. Each question and answer choice has English and isiZulu wording. A fluent local facilitator should pilot comprehension before rollout; do not describe these drafts as independently validated translations. Keep self-reported and measured data distinct.

## Analysis and learning

NGOs see assignments, completed responses, overdue assignments and published summaries. These count forms, not unique people. “Assigned” means made available inside the app. There is no external messaging or delivery receipt; the system must not report that an SMS, WhatsApp or email was sent.

Each question shows its response denominator and missing count. Zero is a real answer; blank is missing. Numeric summaries use valid responses only. Comparisons match the same participants, organisation, project and instrument version. Course/app ordered choices compare self-reported scores, not observed competence. Before/after change does not establish causal impact; weather, market changes, seasonality, participant attrition and other support may explain it.

Each assessment includes a learning action, named owner, due date and completion status. Use this during regular team review and report back to participants what changed. Free-text comments stay with authorised analysts and are never passed through an AI summariser or published automatically.

## Access and publication

- An NGO can change another existing member's farmer/student/mentor/NGO role within its own organisation and delegate assessment management, analysis and access administration. These are server-checked permissions; profile editing cannot self-grant them.
- NGO staff cannot promote themselves, create platform administrators or funder identities, transfer members to another organisation, or change platform administrators. Bootstrap owner administration still needs a verified account and trusted platform provisioning.
- Assessments begin as private drafts. A selected roster is frozen on opening. Only those members can answer; closing stops answer edits. A participant can withdraw their own response.
- Publishing requires a closed assessment and review of its funder preview. Funders need an existing organisation/grant relationship. They receive aggregate projections, never respondent IDs, raw comments or staff feedback ratings. Withdrawal from publication takes effect on later reads; downloaded files cannot be recalled.
- A minimum of five answers is this product's disclosure floor. Entire choice distributions are withheld if any non-zero category has fewer than five answers, preventing simple complementary disclosure. This does not guarantee anonymity, especially across successive exports. There are no funder participant filters or raw-answer exports.
- The NGO can pause linked funder dashboard access. Farmer consent remains an additional requirement for existing portfolio metrics. Funders no longer read private learner evidence directly from Storage. Existing download-token URLs and previously exported material cannot be recalled by a dashboard toggle.
- New assessments, responses, permission documents and access audit records are server-only. All reads and writes use a verified Firebase identity and server-loaded role/organisation. There is no special login URL, hardcoded owner email or browser role override.

Production requires the accompanying Firestore/Storage rules and indexes, not just the web deployment. `deploy-data-rules.yml` deploys those using the repository's existing Firebase service-account secret and fails explicitly if it is unavailable. Do not call access controls live until that deployment has succeeded.

## Deliberate first-release bounds

The assignment editor supports up to 250 selected participants per assessment, 200 assessments per organisation and a participant selector up to 1,000 organisation members. Bounds return an explicit error; they never silently truncate denominators. Larger projects need pagination and programme roster integration. Project/cohort names are entered consistently; stable programme IDs would be a useful next migration. No assessments or external invitations are created automatically by this code change.

No claim is made that the NGO can configure every individual operation in every legacy screen. Existing app roles still own farming, mentoring and account workflows; the new granular permissions cover assessments and organisation access. Funder publication is per assessment, plus a portfolio master control. A future permission matrix should name each additional operation before exposing another toggle.

## Funder deliverables to add alongside survey results

Track verified active gardens; unique physical growing area in m² and hectares; recorded harvest kg; food kept/donated kg; sales and recorded margin per m²; training completion and observed skills; paid workdays; trees planted and later survival; support visits delivered; recent record coverage; assessments completed and learning actions closed. Each needs a period, target, denominator, data source and verification status.

Physical hectares count a plot once even if it carries successive crops. Do not sum each member's self-reported garden size, which can duplicate a shared garden. Separate mapped area from confirmed area in production. R/m² requires actual attributable sales/costs and an explicit treatment of shared costs. Current logs do not consistently attribute every crop/cost to an individual bed or staple plot; an invented split would mislead funders.

## Research informing the design

- [IFRC Framework for Evaluations, 2024](https://www.ifrc.org/sites/default/files/2024-06/IFRC%20Framework%20for%20Evaluations%202024.pdf): supports baseline/endline measurement, participation, informed consent, confidentiality, evidence quality and using findings to improve delivery. The seven-instrument cycle above is our proposed application, not an IFRC-required schedule.
- [FAO: Monitoring, evaluation and learning in farmer field school programmes](https://openknowledge.fao.org/handle/20.500.14283/cc5160en): identifies MEL as part of FFS implementation. Full repository content was access-restricted during this audit; detailed questionnaire wording here is original and based on this project's needs.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): permissions must be enforced on requests, not only by hiding UI; deny ungranted operations and verify resource scope.
- [FAO CropGrids](https://www.fao.org/agroinformatics/training-and-resources/data-sets/data-set-detail/cropgrids-data-on-harvested-and-crop-areas/en): distinguishes physical crop area from harvested area across cropping cycles.
- [NMSU enterprise budgets](https://pubs.nmsu.edu/_z/Z121/index.html): cost coverage determines whether a result is gross margin, net income or profit. ImbewuField should name the recorded-cost boundary explicitly.
