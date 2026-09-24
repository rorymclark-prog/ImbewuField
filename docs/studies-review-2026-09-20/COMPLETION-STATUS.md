# Studies completion checkpoint

Snapshot from 21 September 2026. The current continuation record is
[ACTIVE-CONTINUATION.md](ACTIVE-CONTINUATION.md), including the 22 September soil
release and remaining review gates. The dated evidence below is retained as history.

## Active direction

Rory requested sustained completion, with the primary agent supervising lower-model
agents. Finish existing non-animation teaching work and verify actual outputs before
publishing. Animations remain held for joint quality review. Save milestones locally
about every ten minutes; push completed release batches to conserve deployments.
Do not stop merely because one small patch or release has finished.

## Published baseline

- Core: 10 modules / 33 lessons. Existing assessed course is separate from previews.
- Farm Finance: 8 units / 24 English preview lessons, seven workbooks and three cases.
- Design: 6 stages / 18 English preview lessons, learning folder and worked example.
- App companions: 14 guides; 167 English clips and per-guide offline saving published.
- Reserve: 15 modules / 51 drafts, separate from Finance and Design.
- PR492 released the previews; PR493/494 added the worked example. Production at
  `64edbc9` passed both CI jobs and deployment. This does not prove all teaching or
  export acceptance criteria were met.

## Current release batch

Branch: `codex/studies-completion-review`, based on `64edbc9`.

- [x] Repair standalone diagram styling, legends and readable phone enlargement.
- [x] Make the concept comparison fair; require evidence-based reasoning.
- [x] Tie feature references to work, cost and care revision records.
- [x] Add edge-distance practice, a fresh evidence variation and a handover record.
- [x] Inspect actual standalone exports and desktop/390px views.
- [x] Complete targeted Studies journey audit and act on its verified priority gaps.
- [ ] Run final checks once on the complete batch, publish, verify production.
- [ ] Update this file with evidence, limitations and the next unfinished item.

The primary agent owns integration and release. Terra agent `worked_diagram` owns
only the new diagram component/styles. Terra agent `studies_completion_audit`
completed a focused audit and implemented Finance/Design offline packs and navigation.
No agent changes existing lesson bodies, quizzes, translations or audio.

Checkpoint `a22869d` saves the connected teaching revision. The actual browser SVG
download opens independently with its colors and source labels. Visual inspection
found and corrected water-label, scale-bar and alternative-dimension collisions;
final production-build browser and offline checks are still pending.

## Verified release candidate

Code checkpoint `e073ade`:

- Typecheck clean; 3,678 tests: 3,677 pass, zero failures, one pre-existing
  shape-sync-loss TODO. Whitespace check and production build passed.
- Finance and Design controls each confirmed all pages and startup dependencies
  saved. Shared pictures were reused; neither control deletes shared files.
- Browser offline mode: Design D1.1 → D1.2, Finance F2.1, the independent project
  and its fresh-case navigation reopened successfully. Worked Design also opened
  with the local server stopped and remained interactive.
- Wrong gap 4 received corrective feedback; decimal-comma 0,5 matched the supplied
  0.5 m edge gap. Choosing B showed conditional investigation feedback, not failure.
- Effective 390 CSS-pixel viewport inspected: fitted diagram, explicit enlargement,
  wrapped buttons and source disclosures. Tables and enlarged diagrams scroll inside
  their own regions. Desktop source/A/B/R2 diagrams were inspected independently.
- Actual browser SVG downloads were opened without app CSS; final A/B/R2 label
  collisions were corrected. Actual downloaded text contains sources and connected
  R1/R2 work, unknown costs, deferred purchasing/care, and observation plans.
- Finance F2 PDF returned HTTP 200 from `imbewu-course-v1` / service-worker cache
  storage with the server stopped. The in-app PDF viewer stayed blank, so its PDF
  visual display is not claimed verified here. The unchanged workbook file itself
  remains covered by the existing source/PDF checks.
- A debugger-attached test tab canceled local downloads; a fresh normal tab saved
  the SVG and text files successfully. Temporary network/viewport overrides restored.

The next bounded editorial item is [CORE-FACT-CHECK-FOLLOWUP.md](CORE-FACT-CHECK-FOLLOWUP.md):
correct the twelve-principle attribution and A-frame observation/construction claims
across the lesson, quiz, transcript and audio together. Do not make a text-only fix
that leaves narration contradicting it. The original animation hold remains in force.

## Remaining gates

English narration for Finance/Design needs accepted scripts and voice samples before
any paid batch. Fluent isiZulu, practitioner and learner reviews are outstanding;
do not label them completed by automated review. Reserve publication follows the
existing source/claim review and practical-teaching requirements. No new module
expansion during this completion batch.

The app goal tool still holds the older animation objective as blocked. It rejected
creating a second goal while that objective is unfinished and provides no agent
operation to replace or resume it. This file tracks authorized non-animation work;
do not claim the app goal was reset or the animation goal completed.
