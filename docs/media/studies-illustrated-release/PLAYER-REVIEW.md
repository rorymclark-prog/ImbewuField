# Player review — 20 September 2026

Local branch reviewed at 390 × 844 in the real Studies interface, using the sample-farm fixture (no real learner progress changed).

- All eight Flow Watch buttons start the intended clip. Each returned readyState 4, no media error and advancing currentTime. Durations: six seconds for the trimmed A-frame, eight for the other seven.
- Market slide 15 plays video and narration together. The narration runs beyond the short scene; the player advances to slide 16 when the narration finishes, with the next recording playing. Stop works. Livestock narration/video and intro narration also played.
- Expanded livestock transcript and controls were visually inspected. The old floating Lima button covered reading content on a narrow phone. It is now removed from Studies, with Ask Lima/Photo in the inline Lima bar above the course.
- Market download progressed through 51 assets and showed “On this phone · 13.4 MB”. Local development has no active service-worker controller, so this alone is not cold-offline verification; the deployed build still needs that check.
- Eight module slide contact sheets were inspected, along with individual corrected diagrams and captions. Flow clips were inspected through contact sheets covering their duration and fully decoded, not described as a full real-time human viewing/listening review.

English corrected recordings: word-boundary text matches the authored script, the last word fits inside the clip, full FFmpeg decoding succeeds and importer pacing checks pass. These are mechanical checks, not fluent-language or specialist approval. isiZulu corrections remain unapproved drafts; outdated draft recordings are excluded from the refreshed review pack.

Local checks at c5688fe: TypeScript clean; 3,635 tests, 3,634 pass, zero failures, one existing shape-sync TODO; whitespace check clean. The curated review pack has 165 English slides, 33 animations, source-linked review notes and 15 reserve modules/51 lessons. It excludes raw private source documents and recovery archives.

## Deployed preview — 3510d4c

Preview build-info confirmed the exact branch/SHA and current release notes. Public Home → Take a tour → stop 3 opened Studies without sign-in or changing real learner data. Practice quiz feedback showed the incorrect choice, correct choice and rationale; reopening the local practice lesson reset its attempt.

The deployed service worker controlled the page. Market download stored 51 files. Applying the corrected-media update left 30 unchanged assets and displayed “Finish download · 2.8 MB left”; completing that resumed from 30/51 rather than downloading the whole module again. The migration marker was present.

With CDP network emulation set offline, a full page reload successfully loaded Studies, the downloaded image and course controls. Market slide 1 narration played (15.696 s, readyState 4). Slide 15 then played its downloaded Flow video (8 s) and narration (23.664 s), both advancing without media errors. The visible Offline indicator and rendered scene were inspected. Networking was restored afterwards. This verifies a new page load in the existing browser session; it does not claim every phone/browser has been physically restarted offline.

Final code checks including cache migration: TypeScript clean; 3,636 tests, 3,635 pass, zero failures, one existing TODO. GitHub push and PR test/rules jobs all succeeded for 3510d4c. Preview deploy succeeded. Production publication and post-deploy checks are the remaining release step.


## Failure/recovery check

A blocked narration request exposed silent failure in the old player. The revised player shows a readable alert with retry and transcript guidance. Blocking the intro slide-1 MP3 locally reproduced the alert; removing the block and pressing Play lesson started audio (readyState 4) and cleared it. Blocking the Earth Care Flow MP4 returned the poster and an animation retry message. Narration continued; seeking near its end in this developer test confirmed that the failed video no longer traps the deck on that slide. After restoring requests, video and narration both played, and Stop paused both. All request-blocking and offline emulation were restored afterwards.

The final Seeds written-text check also aligned two inherited lesson bodies and quiz explanations with the already-corrected narration; see FACT-CHECK.md. These changes do not alter asset URLs or require a further media-cache migration.
