# Core Study isiZulu deck source pairing — 2026-10-05

- Auditor: Codex, with separate source, semantic and implementation checks.
- Reviewed revision: `d9ec7c77b8591ba675f7672ef4af69fb3790a749` plus this branch.
- Deployment inspected: not deployed; exact preview and phone review pending.
- Previous audit: [learner source follow-up](study-isizulu-learner-source-followup-codex.md).
- Scope: 240 isiZulu slides in ten core modules, recordings, reading/source panels and offline selection.
- Evidence type: source comparisons, independent machine semantic checks, asset hashes and component interaction tests.

## What was already done

PR #940 published 33 source-bound learner drafts. This batch preserves their
canonical sources, all existing recordings/images and the Sesotho Introduction
hash bindings. The separate Claude lane covers regional Soil/Water slide prose.

An exact snapshot records each registered English/isiZulu transcript, source
heading, registered titles and 480 media hashes. This establishes source identity,
not language or farming approval. Independent machine checks identified concrete
instruction changes, including boiling versus fermentation, missing conditions
and unclear land/basin scope. Intro slide 10's proposed earthworks flag was
rejected on second check; its full isiZulu clause retains major digging work.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-ZU-001 | Learner drafts lacked source binding. | Previously production verified | Retain #940's source protections. |
| STUDY-ZU-003 | Decks lack simultaneous exact English comparison. | Implemented; needs verification | 240 immutable pairs with live source/target/title checks; player keeps comparison independent of chosen voice. Test actual phone and offline panels. |
| STUDY-ZU-004 | Existing artwork inconsistently labels draft status. | Implemented; needs verification | Persistent player notice and source panel mark unreviewed status. Artwork is unchanged; expanded layout needs actual phone inspection. |
| STUDY-ZU-006 | Registered recordings/artwork contain independently identified wording errors. | Playback withheld; corrections remain open | 24 scoped review holds use English still/source and omit the affected isiZulu voice. Whole continuous narration is withheld where it contains a held clip. English voice requires explicit selection. Files remain intact. Source drift also withdraws the paired ZU presentation. |
| STUDY-ZU-007 | Offline downloads could include the faulty voice or a different still from the displayed fallback. | Implemented; needs verification | Packs follow resolved images and central voice URLs. No automatic English audio, asset eviction or fetching. Verify changed pack selection and cached bytes on phone. |

## Verification

- Typecheck: passed after all implementation edits.
- Full suite: 4624 tests, 4623 pass, zero failures, one unchanged shape-sync TODO. Historical URL expectations now require exactly the playable clips and displayed stills; raw-media coverage is retained.
- Whitespace: passed.
- Output inspected: component interactions tested; actual 390px layout pending.
- Limits: machine checks do not establish fluent pronunciation, local farming approval or Shangani comprehension. No media regeneration or cold-start offline claim.

This changes the picture for held slides by displaying the English source still.
`PLAN_VERSION`, saved geometry, canonical English, species, numbers and indices
are unchanged. Draft correction remains required before restoring held voices.

## Next continuation

Finish local gates and durable evidence, push one coherent preview batch, verify
exact-head CI/build-info and actual phone/source/audio/offline behavior before
publication. Independently repair the flagged ordinary isiZulu clauses while
retaining difficult English terms; do not bind new text to an old recording.
