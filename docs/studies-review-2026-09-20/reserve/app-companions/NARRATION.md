# English app-guide narration

Production branch: `codex/studies-guide-narration`, based on public guide release `f7530bf`. The assessed course narration and app-help narration are separate collections in the existing `lib/course-audio.ts` authority. Listening to help does not change assessed course progress.

## Source and recording workflow

`appGuideNarrationSections` derives each recording from the guide visible to the learner: introduction/preparation, each step and its check, the decision question and options, conditional feedback, and independent practice/next action. The only control-path adaptation is speaking arrows as “then”. Feedback is not included in the question recording.

Export with `node scripts/app-guide-narration.mjs export <recording-directory>`. Record with `uv run --with edge-tts python scripts/record-app-guide-narration.py <recording-directory>`. The existing English fallback voice is en-ZA-LukeNeural at -12%; this is not represented as an AGY recording. Each clip keeps its script and audio hashes, returned word boundaries, duration and full MP3 decode result. Existing verified clips are reused only when both hashes match.

Import with `node scripts/app-guide-narration.mjs import <recording-directory>`. Before copying anything, this checks the complete current guide collection against the recording scripts, actual audio hashes/bytes, word sequence, measured duration and another full decode. The audio and its manifest entries must be committed together. Retain full recording evidence externally; do not commit operational logs.

The tests reject missing or orphan audio, changed bytes, stale narration after a text edit, wrong section order, missing guides and feedback leaking into the question script. These checks establish script/file integrity; they do not establish pronunciation quality or a fluent human listening review.

## Playback

One native audio player is placed beside each written section. Files do not preload and nothing autoplays. The learner sees language, duration and approximate kilobytes before pressing Play. Starting another clip pauses the current one. Choosing a practice answer stops earlier speech, then makes only that answer's feedback recording available. Leaving the page stops speech. An audio-load failure shows a readable message, Retry and the existing written instructions.

These guides are not included in the assessed-module offline download packs in this change. Do not describe clicking Play as a complete offline download. Offline packaging for the guide text, images and narration remains follow-up work and needs a real no-network reload/playback check before any promise.

## Verification status

All 14 guides now have 167 verified English clips: 6,211.368 seconds (about 104 minutes), 37,268,208 bytes. The complete import checked script/word agreement, duration, hashes and full decode. Local typecheck passed; the full suite reported 3,646 tests, 3,645 passing, no failures and the existing shape-sync-loss TODO. Whitespace and release-note checks passed.

Local runtime verification covered advancing playback, keyboard and pointer controls, one clip pausing another, answer selection pausing speech, replacement feedback for a different answer, and navigation to another guide with no playing clip or retained feedback. At 390 × 844, controls and text were visually inspected and document width remained 390 pixels. An uncached clip was attempted with network emulation offline; the readable error and Retry appeared. After restoring connectivity, Retry loaded the clip and playback advanced. Viewport and network overrides were restored.

A previous test tab crashed during an accessibility-button interaction. A fresh tab passed both keyboard and visible pointer playback; the crash did not recur. This does not establish the cause of the earlier crash. Publication and deployed verification remain pending. No animation files or render flows changed. Fluent listening, isiZulu adaptation and learner trials remain open; English technical checks are not a substitute for them.
