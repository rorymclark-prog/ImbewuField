# Training PDF covers and audit continuation — 2026-10-29

- Auditor: Codex.
- Reviewed revision: main `b8a4d11d06e5f79f2e35774ad9d2f989062d6237`, with this focused follow-up on `codex/training-export-layout-20261029`.
- Deployment inspected: no new live browser inspection. Browser-control tools remain unavailable in this session.
- Previous audits: [report evidence and 30-page export pass](https://github.com/rorymclark-prog/ImbewuField/blob/12313d1933c8fda874ae98e81b85f154471a088a/docs/audits/2026-10-29/report-evidence-followup-codex.md), [PDF chapter pagination](../2026-10-27/report-pdf-pagination-codex.md), [coverage record](coverage-and-release-codex.md).
- Scope: shared programme/session PDF covers, long saved titles, full/summary and colour/ink exports in English and isiZulu; existing audio and offline contracts.
- Evidence: emitted PDFs, rendered pages and bounds, automated regression checks. No paid generation or real farmer data.

## What was already done

The queue and current AGENTS were read through the connected GitHub service, retaining Rory's earlier permission to use it while terminal Git cannot resolve GitHub. PR #1145 remains independent: its typecheck, rules and focused-render checks passed and Vercel reported Ready; its full test job was still running when checked. It has not been deployed by this continuation. The current-main map and report-guide releases are retained. This narrow presentation fix branches from main and can be reviewed independently of #1145's saved-evidence and water-advice changes.

The local audit copy has the current main application/test text, fetched by immutable revision. Newly added historical map screenshot binaries were not copied into it. Publication uses the complete current-main Git tree and adds only the listed PDF/test/notice/audit files, retaining all those historical images.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| training-pdf-title | A valid 160-character session title was silently cut after two lines on every exported cover. | Implemented and visually verified | [Before](evidence-training-layout/cover-before.png), [after](evidence-training-layout/cover-after.png). The emitted-PDF regression failed on the original missing third line. The shared cover now measures all title lines before positioning the date, language notice and content. |
| training-pdf-title-whitespace | Pasted line breaks in a valid title can make a cover taller than its paper. | Implemented and regression verified | Paint-time whitespace normalization retains all title words without changing the saved session. A separate test checks all 25 supplied words and the unchanged saved title. |
| report-pdf-coverage | Earlier 30-page inspection did not exercise maximum-length session titles and eight selected photographs. | Expanded; still bounded | Eight further exports, 32 rendered pages: summary/full × colour/ink × English/isiZulu. Existing demonstration imagery is deliberately repeated to exercise the eight-photo limit; it is not new field evidence. The fixture passes the real saved-record validator. No off-page words were found. |
| report-language-coverage | Authored training headings/narrative remain English in isiZulu exports. | Open, retained | Existing draft notice remains. This fix does not translate training content or claim fluent review. The new update-notice drafts alone are recorded [here](training-pdf-notice-drafts.json). |
| audit-browser-coverage | Fresh phone/desktop interactions and browser PDF download cannot be checked here. | Blocked, retained | Direct builder inspection does not certify the browser download journey, live role permissions or every screen. |
| audit-device-and-paid-coverage | Physical offline/reconnect, assistive technology and paid-render fidelity remain unexercised. | Open, retained | Existing offline/audio contracts pass; they do not replace a device check or listening to every recording. |
| audit-media-integrity | The earlier pass had not decoded all repository media files. | File integrity verified; playback coverage still open | All 731 public MP3/M4A/MP4/WebM files have a positive duration and audio/video stream and complete a full FFmpeg decode without errors. No asset was modified. This does not certify wording, language selection, a live player or a device's offline cache. |

## Verification

- Typecheck passes. All 187 affected report/evidence/update-notice/release checks pass; an additional 111 existing audio/offline checks pass. No test was removed or weakened.
- [Media integrity results](evidence-training-layout/media-integrity.json) record each file's measured duration, stream types and bytes. Reproduce with `python3 docs/audits/2026-10-29/evidence-training-layout/check-media.py /tmp/imbewu-media-integrity.json` (FFprobe/FFmpeg required).
- `npm test` is running locally; current-head full CI has not yet completed. Pending is not passed.
- `git diff --check` and the local release-note gate pass. Exact-head preview/rules/CI outcomes must be recorded on the PR before release.
- [English contact sheet](evidence-training-layout/contact-en.jpg), [isiZulu contact sheet](evidence-training-layout/contact-zu.jpg), and [all page-bound results](evidence-training-layout/layout-checks.json). All 32 pages were inspected in contact sheets; covers, register and photograph pages were also inspected at readable resolution. This is layout verification, not linguistic approval or every historical record.
- Reproduce exports with `node --import ./tests/register-alias.mjs docs/audits/2026-10-29/evidence-training-layout/render-layout.mjs /tmp/imbewu-training-layout`, then render with Poppler. The four single-cover before/after examples retain the earlier two-photo metric; the final eight-export fixture and contact sheets correctly record eight photos.
- This changes the picture for long PDF cover titles. No saved record, geometry, species, farming number, lesson wording, rule, workflow or `PLAN_VERSION` changed. No production deployment in this pass.

## Next continuation

Read exact-head CI for this branch and #1145. Finish live report generation/save/reopen/download journeys when browser control is available. Continue authored training-copy localization under the existing draft-review discipline. Keep physical-device offline, cross-account and paid-render verification open until actually exercised.
