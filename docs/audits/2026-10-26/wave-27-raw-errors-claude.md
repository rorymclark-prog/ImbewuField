# Wave 27 farmer-facing error messages — 26 October 2026

- Auditor: Claude (integrator), reviewing a Sonnet track.
- Reviewed revision: the waves 24–26 integration head (`claude/zen-rubin-00ndhb` at `9b031e54`, rorymclark-prog/imbewufield#1125, which carries `main` at `55526909`) with the offline track and this wave on top, built with `next build` and served with `next start` in sample mode.
- Previous audit: [Wave 25 forms, offline and keyboard capture — 26 October 2026](wave-25-forms-offline-keyboard-claude.md), whose `w25-09` this wave closes. This record adds `w27-01` to `w27-05`.
- Scope: every screen that put a caught error's `.message` into a message setter, except `components/design/DesignGlossy.tsx` (13 sites, in Codex's open rorymclark-prog/imbewufield#1131 and #1099) and Codex's crop areas. Source review of each call site and of the code that throws into it; one screen rendered with its downloads blocked.

## Findings and disposition

| ID | Where | What the code showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w27-01 | Records delete, invoice save, evidence sheet, receipts, studies downloads, site design, base-photo import, design advisor, MEL, production areas, funder assessments (14 files) | `err instanceof Error ? err.message : <fallback>`. For a network or Firebase failure, that is developer English in any language: "Failed to fetch", "Missing or insufficient permissions." | `lib/user-facing-error.ts`: messages the app throws on purpose use `UserFacingError` and are shown as written. A fetch that never reached the network (the browsers' "Failed to fetch" / "Load failed" / "NetworkError" wordings, or Firebase `unavailable`) maps to the translated `networkFailureMessage`. Anything else gets the screen's own fallback (Sonnet track, rorymclark-prog/imbewufield#1133) | Fixed |
| w27-02 | The same track, in review | Any `TypeError` counted as a network failure, so a bug in the app would have been reported to the farmer as a connection problem | Only the browsers' fetch-failure wordings count | Fixed |
| w27-03 | The same track, in review: fieldwork API errors (production areas, MEL, funder assessments, offline queue) | The fieldwork routes write their error bodies for staff ("This organisation is outside your access.", "Check the site code, date, areas and measurement note…"). The client threw them as plain Errors, so the track would have replaced them with "Something went wrong. Please check your connection" | `lib/field-api.ts` throws a route's error body, its own timeout and its review notice as `UserFacingError`. A device-storage failure keeps "Could not save on this device. Keep the form open." and drops the storage engine's own wording | Fixed |
| w27-04 | /offline | The track also changed /offline to replace an unmapped server line with the generic message, and flipped Codex's test that pins the opposite | Left as it was: `tests/offline-ui-localization.test.ts` (#1122) pins that an unmapped server line there is shown exactly, and `w27-03` shows the same text elsewhere | Not changed (by design) |
| w27-05 | Account (found by CI on the integration head) | The track also changed the three Account messages (profile save, photo, logo); `tests/account-localization.test.ts` (#1122) pins that an unrecognised error there is shown as-is inside `<bdi lang="">`, marked as not in the farmer's language, while known account errors are translated by `AccountErrorText` | Left as it was, like /offline; the scan excludes it | Not changed (by design) |

### Still open

- `components/design/DesignGlossy.tsx` (13 sites) and `components/crops/CropPlanExportCard.tsx` (2) still print `.message`. Both files are Codex's or in Codex's open PRs.

## Verification

- **Rendered:** /student/finance with the pathway's media requests blocked, in light and dark. The download fails with the app's own "10 files could not be saved. Reconnect and choose Finish download; saved files will be reused.", and no browser wording. This shows app-written messages survive the change.
- **Tests:** `tests/w27-raw-errors.test.ts` covers the helper (network, Firebase, a bug's TypeError, app-written messages), a source scan of the listed screens, and the `w27-03` review fix. `field-api-core`, `field-device-store`, `offline-ui-localization`, `paid-api-auth-wiring` and `type-floor` pass. `npx tsc --noEmit` is clean.
- Signed-in failures (records delete, account save) cannot be produced in the capture sandbox, which has no Firebase sign-in, so those sites are verified by source review and the test scan only.

## Next continuation

Hand the `DesignGlossy` sites to Codex with the helper. Re-capture the live build once waves 24–27 are on `main`.
