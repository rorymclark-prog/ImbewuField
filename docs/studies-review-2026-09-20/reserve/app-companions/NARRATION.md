# English app-guide narration

Production branch: `codex/studies-guide-narration`, based on public guide release `f7530bf`. The assessed course narration and app-help narration are separate collections in the existing `lib/course-audio.ts` authority. Listening to help does not change assessed course progress.

## Source and recording workflow

`appGuideNarrationSections` derives each recording from the guide visible to the learner: introduction/preparation, each step and its check, the decision question and options, conditional feedback, and independent practice/next action. The only control-path adaptation is speaking arrows as “then”. Feedback is not included in the question recording.

Export with `node scripts/app-guide-narration.mjs export <recording-directory>`. Record with `uv run --with edge-tts python scripts/record-app-guide-narration.py <recording-directory>`. The existing English fallback voice is en-ZA-LukeNeural at -12%; this is not represented as an AGY recording. Each clip keeps its script and audio hashes, returned word boundaries, duration and full MP3 decode result. Existing verified clips are reused only when both hashes match.

Import with `node scripts/app-guide-narration.mjs import <recording-directory>`. Before copying anything, this checks the complete current guide collection against the recording scripts, actual audio hashes/bytes, word sequence, measured duration and another full decode. The audio and its manifest entries must be committed together. Retain full recording evidence externally; do not commit operational logs.

The tests reject missing or orphan audio, changed bytes, stale narration after a text edit, wrong section order, missing guides and feedback leaking into the question script. These checks establish script/file integrity; they do not establish pronunciation quality or a fluent human listening review.

## Playback

One native audio player is placed beside each written section. Files do not preload and nothing autoplays. The learner sees language, duration and approximate kilobytes before pressing Play. Starting another clip pauses the current one. Choosing a practice answer stops earlier speech, then makes only that answer's feedback recording available. Leaving the page stops speech. An audio-load failure shows a readable message, Retry and the existing written instructions.

Guide downloads are separate from assessed-module packs. Follow-up implementation on `codex/studies-guide-offline` adds an explicit per-guide download for its image and every English recording, including answer feedback, plus preparation of the guide and My Studies pages with their startup files. Readiness checks both media and page dependencies. Recording URLs carry audio revisions; older cached audio cannot satisfy a newer download. Removal frees this guide’s recordings and retains the shared image and written page. Local production-build verification passed; publication of this follow-up is pending. Clicking Play alone remains different from downloading the guide.

## Verification status

All 14 guides now have 167 verified English clips: 6,211.368 seconds (about 104 minutes), 37,268,208 bytes. The complete import checked script/word agreement, duration, hashes and full decode. Local typecheck passed; the full suite reported 3,646 tests, 3,645 passing, no failures and the existing shape-sync-loss TODO. Whitespace and release-note checks passed.

Local runtime verification covered advancing playback, keyboard and pointer controls, one clip pausing another, answer selection pausing speech, replacement feedback for a different answer, and navigation to another guide with no playing clip or retained feedback. At 390 × 844, controls and text were visually inspected and document width remained 390 pixels. An uncached clip was attempted with network emulation offline; the readable error and Retry appeared. After restoring connectivity, Retry loaded the clip and playback advanced. Viewport and network overrides were restored.

A previous test tab crashed during an accessibility-button interaction. A fresh tab passed both keyboard and visible pointer playback; the crash did not recur. This does not establish the cause of the earlier crash. Published in PR #484, main b761380. Main CI test/rules and production deployment passed. All 167 production audio URLs returned the expected status, audio type and byte count; live playback advanced successfully. No animation files or render flows changed. Fluent listening, isiZulu adaptation and learner trials remain open; English technical checks are not a substitute for them.

## Offline guide verification — 21 September 2026

Typecheck and the full suite passed: 3,651 tests, 3,650 passing, zero failures and the existing TODO. The production build completed locally. New tests execute the shipped worker to verify guide HTML, scripts, CSS/font readiness and exact-version audio playback without network; missing CSS dependencies remove readiness. Pack tests compare all 14 guides with their source sections and actual file sizes. Cache tests exercise changed revisions, resumed downloads and scoped removal; the cache fake now honours query keys rather than stripping them unconditionally. Existing cancellation/failure tests remain passing.

In the browser, the getting-started guide was downloaded through its control. The production server was then stopped, network emulation was offline and the ordinary HTTP cache disabled. A full reload retained the heading, all written steps and the image; a never-streamed step advanced 13.647 seconds of 48.336 and conditional feedback completed 9.912 seconds. My Studies and the saved guide could be reopened through their links while the server remained stopped. Removing the recordings left the written page and picture usable on another reload; attempting to finish while offline reported all 12 missing recordings rather than success. Restoring connectivity and the server completed the download again.

At 390 × 844 the download panel was visually inspected, with scrollWidth 390. All network, cache and viewport testing overrides were restored. An attempted manual Stop test completed its local media phase too quickly to reach Stop; cancellation is covered by the existing cache tests, not claimed as a browser observation. The development server's malformed CSS URLs prevented its first worker activation; the production build passed the actual offline test. No farmer records, module completion or animations were changed.
