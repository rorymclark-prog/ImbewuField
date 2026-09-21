# Design learning folder — development preview

The eighteen lessons now connect to `/student/design/folder`. The six-stage folder asks learners to retain the reason for each design decision alongside the actual drawing. It contains eighteen free-text records, an explicitly incomplete busy-yard example for each stage, and facilitator discussion criteria. It does not infer competence from filled boxes.

## Evidence and teaching purpose

The task sequence follows the existing D1–D6 manuscripts and their source mapping in SOURCES.md. Rory’s original course outlines establish the brief → observation → analysis → alternatives → developed design → implementation → presentation sequence. The site/community survey templates reinforce household aims, available people and resources, access, source records and missing measurements. No private completed survey, historical crop prescription or unsound profit forecast is imported.

Each stage links back to its lessons. D4 connects to the Design Studio guide, D5 to Farm Finance. Every lesson’s practical task links to the corresponding folder stage. The folder records drawing names/revisions, not uploaded attachments. A facilitator needs the actual source evidence and plan set to assess the explanation. The measured busy-yard example remains outstanding.

## Saving and portability

Explicit save keeps a versioned draft in this browser and device, separated by signed-in user, guest and sample mode. Sample mode uses the existing app storage shim and is temporary. No cloud write, assessed-progress update, geometry edit or certificate is involved. Guest notes are shared on the same browser; the page says so. There is one folder per identity in this preview.

A failed/unknown-version draft read leaves the stored copy intact and disables replacement. A save checks whether another tab changed the stored copy since this page opened. In that case the current work can be downloaded without overwriting the other tab. Failed saves are reported. A plain UTF-8 text download includes prompts, answers, missing-work labels and the course status; drawing references do not turn into attachments. A browser unload warning protects unsaved notes where supported; in-app lesson links explicitly remind the learner to save first.

## Review boundary

This implements the design evidence record and discussion criteria, not a fully validated assessment, translated course, complete visual case study or production release. No animation work.

## Verification

Typecheck, full suite (3,664 tests: 3,663 pass, zero fail, one existing TODO), whitespace/release-note checks and production build pass. Local browser inspection covered desktop and 390px layouts, source-example disclosure, saved multi-line notes after reload, and a two-tab save conflict. The conflicting unsaved version was downloaded as a UTF-8 text file and opened from Downloads; the saved version survived reopening the other tab. Document width matched the 390px viewport. Storage identity/parser/export behavior has unit coverage; live sign-in transitions, blocked browser storage and actual paper printing were not simulated. Temporary viewport override reset. Hosted checks are pending.
