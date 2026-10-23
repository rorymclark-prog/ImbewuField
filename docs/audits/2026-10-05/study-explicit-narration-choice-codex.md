# Study explicit narration choice audit — 2026-10-05

- Auditor: Codex scoped implementation helper; root source/diff review in progress.
- Reviewed revision: `8eb4071524194fbf092f9a406a0570a59bb38b7c`, branch `codex/study-explicit-narration-choice-20261005`, plus local changes; stacked after PR955.
- Deployment inspected: prior PR955 native preview at `https://imbewufield-git-codex-regional-56be72-rorymclark-9763s-projects.vercel.app`, `/api/build-info` emitted `8eb4071`. No preview of this fix inspected.
- Previous audit: [Soil learner fuller regional drafts](study-soil-learner-fuller-codex.md) and [Soil/Water integration](study-soil-water-material-integration-codex.md).
- Scope: shared regional narration default policy, CourseAudioPlayer selection/playback lifecycle, and DeckPlayer use of that predicate.
- Evidence type: prior native 390 × 844 browser UI, source inspection, policy table and React component behavior tests.

## What was already done

PR955's nine regional Soil lessons showed exact source pairing and unreviewed notices. The prior phone check established zero automatic MP3 requests and zero playback, but also observed the learner playlist's English fallback already selected. DeckPlayer had an explicit No narration default for regional readers without their own recording. These were different answers to the same selection question.

[Prior Tshivenda Soil L1 phone capture](evidence-study-explicit-narration-choice/prior-955-ve-soil-english-selected-390.png) shows English selected and a misleading paused “playing English” notice. This is evidence of the old state, not verification of this fix. The [baseline matrix and 22 Sesotho Intro clip hashes](evidence-study-explicit-narration-choice/policy-baseline.json) preserve the prior selection decisions and media bytes.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-AUDIO-CHOICE-001 | A regional learner without own-language narration sees English selected and Play enabled without choosing the source voice. | Implemented; phone verification pending | Shared `requiresExplicitNarrationChoice` predicate; playlist remains visible with No narration selected, optional English source label and disabled track rows until a voice is chosen. |
| STUDY-AUDIO-CHOICE-002 | App-language changes leave an old loaded recording and delayed callbacks able to affect playback state. | Implemented; component behavior verified | Reset pauses, removes src and clears state. Generation/selection/slide guards reject old Play, ended, play, error, time and metadata events and deferred play resolution/rejection. |
| STUDY-AUDIO-CHOICE-003 | A paused playlist describes the source language as playing. | Implemented; phone verification pending | Selected-language wording while paused; existing playing-language notice only while actively playing. |
| STUDY-AUDIO-CHOICE-004 | Shared default repair could suppress narrated languages or bypass review holds. | Automated verification; native checks pending | Fifty policy rows preserve English/isiZulu and own Sesotho Intro defaults; own Intro still exposes all22 clips and advances normally. Existing isiZulu hold/source guards and explicit English escape remain. |

## Implementation boundaries

`resolveNarrationLang` retains its existing fallback-availability contract. The shared predicate decides when a selection is required; it is consumed by both players. All29 regional module/language combinations without their own recording begin without narration. English, isiZulu and Sesotho Intro's own recordings keep their defaults. Explicit voice choices remain available; selecting a voice does not fetch audio until Play.

The localized existing `courseDeckNoNarration` label is reused. Returning to No narration during playback removes the old source and disables Play again. Both resolved and rejected stale play promises and captured ended/error/time/metadata callbacks are covered. The ordinary playlist still advances after an explicitly started Sesotho Intro clip and stops at the final track.

Canonical lessons/narration/transcripts, draft notices and review records, audio/video/slide bytes, offline logic and `PLAN_VERSION` remain unchanged. No new media is introduced. Existing tests and source-review guards are retained; their component loader is extracted for reuse without removing assertions.

## Verification

- Typecheck: passed `npx tsc --noEmit` on the final code.
- Full test suite: passed `npm test` on the final code:4,686 tests /4,685 passes /0failures /1existing shape-sync TODO,73.2seconds,exit0.
- Scoped tests: final audio/deck behavior run passed66/66, including table/defaults, active No narration, stale callbacks/promises, held isiZulu rows and normal own-language progression.
- Whitespace: passed `git diff --check` after the full suite.
- Output inspected: prior PR955 390 × 844 default-selection pixels only; this fix has not been rendered in a browser or published. This changes the visible audio controls.
- Other limits: native UI, actual audio playback/listening and app-language changes on a phone remain preview gates. No fluent language/local farming approval claimed.

## Next continuation

Root reviews actual code and ordered gates before commit/push. On the exact preview build, inspect lesson/module playlists and DeckPlayer for ST/VE/TS Soil and Market: No narration selected, English source unselected, rows disabled, zero MP3 requests. Choose English explicitly, confirm no request until Play, then return to silence and change app language while playing to prove src/playback stops. Compare English, isiZulu and all22 Sesotho Intro defaults, clip bindings and review holds. Root must inspect actual 390 × 844 pixels; do not infer UI appearance from passing tests. No commit or push made by this helper.
