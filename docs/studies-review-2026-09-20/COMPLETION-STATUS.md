# Studies completion checkpoint

Updated 21 September 2026. This is the current continuation record; older handovers
and release reports describe their own snapshots, not today's completion status.

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
- [ ] Inspect actual standalone exports and desktop/390px views.
- [ ] Complete targeted Studies journey audit and act on its verified priority gaps.
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
