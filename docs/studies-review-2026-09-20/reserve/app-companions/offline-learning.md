# C14 — Study offline, practise and get guidance

English readable companion at `/student/guides/offline-learning`. Implemented against main `13725c811bbda62f369ab8b0e6813fd54af737e4`. No new animation work, assessed lesson rewrites, progress mutations or submission uploads.

## Source checks

- `components/course/OfflineDownload.tsx`, `lib/offline-pack.ts`, `lib/offline-cache.ts`: per-module versus available-course packs; language fallback; Standard/optional higher quality; actual cached file counts; partial downloads, Stop, Finish download, On this phone and browser storage limits. No fixed download sizes are taught: they change with released assets and language.
- `components/course/DeckPlayer.tsx`: Read this slide, Play and Stop; Back/Next deliberately start the selected slide narration. A Stop action is not a permanent silent-browsing setting.
- `app/student/page.tsx`: named lesson panels/questions, Mark done separate from download and submission, required photo/optional voice, staging before Submit, error handling and replacement on Resubmit.
- `app/offline/page.tsx`: separate fieldwork preparation; stay signed in; open designs/plans/reports online; AI/new sign-in/fresh maps require connectivity; fieldwork and money-book queues are separate. Course download is not a full device backup or a promise that every companion page is cached.

## Actual released workflow — 21 September 2026

In the production sample workspace, opened Introduction to Permaculture. Its current Standard pack displayed 22.6 MB; downloaded it once and observed On this phone with 55 files present. The whole-course control correctly remained partial (55 of 608 files), because other modules were not downloaded. These numbers describe the test only.

Applied an offline network condition to the test tab only, reloaded My Studies, reopened the module and read the visible Offline header and preserved On this phone status. Opened Read this slide in English. The introduction image loaded at its natural width of 1920 pixels. Play started the existing narration: media readyState 4, duration 23.808 seconds, no media error, and playback time advanced beyond eight seconds. Stop paused it. Back also restarted the selected slide, agreeing with the source behavior. Restored the tab's network and stopped playback afterwards.

Opened Submit this module without uploading anything: the prepared zones assignment and self-checks appeared, Add a photo (required), Add a voice note (optional), and disabled Submit before a photo was chosen. No learner progress or real evidence was changed.

## Verification boundaries

This proves the tested browser could reopen the introduction page, image, English transcript and narration without a connection after preparation. It does not prove every module/language, a fresh browser without preparation, a physical phone, long-term cache retention or real-account submission/sync. Submission and replacement semantics were source-checked; no real photo or voice file was uploaded. Existing media was downloaded to test access; animation quality was not reviewed.

Guide QA, exact-head CI and production release evidence will be recorded in issue35. Narration, fluent isiZulu review and learner trials remain open. C03 and C04 are the remaining readable companions.

The source review found a storage warning claiming home-screen installation makes downloads stick. Replaced that guarantee with a reminder to check saved lessons before leaving signal. No caching mechanism changed.
