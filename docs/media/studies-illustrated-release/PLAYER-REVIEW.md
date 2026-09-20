# Player review — 20 September 2026

Local branch reviewed at 390 × 844 in the real Studies interface, using the sample-farm fixture (no real learner progress changed).

- All eight Flow Watch buttons start the intended clip. Each returned readyState 4, no media error and advancing currentTime. Durations: six seconds for the trimmed A-frame, eight for the other seven.
- Market slide 15 plays video and narration together. The narration runs beyond the short scene; the player advances to slide 16 when the narration finishes, with the next recording playing. Stop works. Livestock narration/video and intro narration also played.
- Expanded livestock transcript and controls were visually inspected. The old floating Lima button covered reading content on a narrow phone. It is now removed from Studies, with Ask Lima/Photo in the inline Lima bar above the course.
- Market download progressed through 51 assets and showed “On this phone · 13.4 MB”. Local development has no active service-worker controller, so this alone is not cold-offline verification; the deployed build still needs that check.
- Eight module slide contact sheets were inspected, along with individual corrected diagrams and captions. Flow clips were inspected through contact sheets covering their duration and fully decoded, not described as a full real-time human viewing/listening review.

English corrected recordings: word-boundary text matches the authored script, the last word fits inside the clip, full FFmpeg decoding succeeds and importer pacing checks pass. These are mechanical checks, not fluent-language or specialist approval. isiZulu corrections remain unapproved drafts; outdated draft recordings are excluded from the refreshed review pack.

Local checks at c5688fe: TypeScript clean; 3,635 tests, 3,634 pass, zero failures, one existing shape-sync TODO; whitespace check clean. The curated review pack has 165 English slides, 33 animations, source-linked review notes and 15 reserve modules/51 lessons. It excludes raw private source documents and recovery archives.
