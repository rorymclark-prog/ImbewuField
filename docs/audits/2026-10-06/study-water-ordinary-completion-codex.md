# Water ordinary prose completion audit — 2026-10-06

- Auditor: Codex root, separate scoped drafting and semantic reviewers.
- Reviewed revision: main base `66b274842927ba93e47586c322325742716d2a39`, unpublished local branch `codex/regional-water-ordinary-completion-20261006`.
- Deployment inspected: none for this batch; prior production #958 verified.
- Previous audit: [Water precision](study-water-reviewed-precision-codex.md); carries STUDY-RES-002 forward.
- Scope: four Water lessons in ST/VE/TS, source-exact paired paragraph reuse,27 silent stills and their selective offline refresh.
- Evidence: guarded before/current/source application, independent semantic checks, root rendered-image review and automated checks.

## What was already done

Claude #951 slide work and subsequent precision repairs are retained. Canonical English, species, numbers, answer indices, geometry, PLAN_VERSION and Sesotho Introduction narration bindings remain unchanged. This batch does not generate narration.

## Findings and disposition

| ID | User-visible gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Ordinary English remains inside regional Water prose and assessments. | Implemented; publication pending |187 accepted or repaired units: ST35,VE78,TS74. Technical precision terms remain English beside visibly unreviewed drafts. |
| STUDY-WATER-ORD-001 | Decks repeat older learner wording. | Rendered; phone pending |54 complete paragraphs reused only where English source is byte-identical;27 WebPs regenerated. |
| STUDY-WATER-ORD-002 | Changed TS targets could remain hidden behind English-hold status. | Implemented |28 affected accepted fields changed to machine-draft; source-drift fallback retained. |
| STUDY-WATER-ORD-003 | Unverified physical-bank loan could imply a financial bank. | Repaired |TS L2 paragraph8 and slide13 retain English banks; animals/can/manure/no safety inference preserved. |

## Verification

- Original typecheck passed; original full npm suite:4,701 tests,4,700 pass,0 fail,1 existing TODO. Focused native and historical source/media checks pass.
- Whitespace check passed before final audit text.
- Root inspected all27 compressed frames via contacts at readable scale; no clipping observed. This changes the slide picture; PLAN_VERSION unchanged.
-27 actual asset hashes, prior baseline hashes and byte counts match the manifest; other Water WebPs remain exact.
- Once-only migration deletes only27 exact still paths/query variants, preserves audio/shared films/other frames and later downloads, and does not fetch.
- Exact preview SHA, actual390px learner/source/answers/media, offline pack, both PR/push jobs, both main jobs and production build-info remain required.
- No fluent/local farming, pronunciation, physical-device, Shangani-comprehension or whole-course offline cold-start approval is claimed.

## Evidence and continuation

Accepted learner packets and before/application proofs are under `docs/study-translation-reviews/water-ordinary-{ve,ts}-2026-10-06/` and the dated ST accepted/proof files. Source-exact deck plans and before snapshots are under `water-ordinary-deck-2026-10-06/`; actual frame proofs under `docs/media/water-ordinary-completion-2026-10-06/frames.json`.

Finish ordered local gates, review actual diff, save content and concise source-bound release notes, push one finished branch, verify exact-head CI/native phone/offline before merge. Then verify both main jobs/deployment/build-info and log issue35. Next substantial lane is remaining Soil ordinary prose; ten-module/app completion remains open.
