# Offline fieldwork — 9 September 2026

Status: release authorised by Rory; final integration checks and deployment in progress.
Rory explicitly approved pushing to ImbewuField and deploying after GitHub checks pass. The concurrent mentor and Plant Guilds releases have been preserved.

## Why this change is needed

Rory closed the app after disconnecting Wi-Fi and could not reopen it. Production's service worker cached page HTML without explicitly caching the scripts, styles and fonts required to start it. Updates also removed the previous build's caches. Code-level offline features were therefore not a reliable user-facing promise.

## Implemented

- Startup preparation stores the page's build dependencies before making the page available. A missing startup dependency prevents activation of the update. One previous build remains available for already-open tabs. Cache writes and refreshes are tied to worker event lifetime.
- Menu → Offline & sync lists prepared startup pages, offers deliberate fieldwork preparation, and shows the account's pending entries and review errors. Course media remain separate, explicit lesson downloads.
- Authorised fieldwork reads are saved by account, organisation membership and role. An explicit server access refusal is never hidden by an old cached response.
- Completed mentor visits, training registers, attendance signatures, training feedback, visit/training photos, programme indicators, garden-area observations and assigned assessment responses can be saved durably in IndexedDB and sent later.
- Unfinished visit, training and garden-area forms have explicit Save unfinished draft and Restore saved draft controls. Drafts do not submit automatically. Visit drafts wait for existing photos to load; incomplete restored drafts cannot overwrite server evidence.
- Reconnection sync runs while the app is open; it also retries on focus and every 30 seconds. Server acknowledgement is required before a queue item is removed. Sending leases protect against concurrent tabs, and operation receipts commit in the same Firestore transaction as the record.
- Version conflicts, validation refusals and permission changes preserve the original queue entry for review. The user can download a copy and deliberately remove a queued change before reconciling against the latest server record.
- Portfolio and programme-record reads can use their authorised saved copies. Field reports include a data-availability note when they use cached or unconfirmed records.
- Map controls offer an Offline canvas with no remote basemap. Saved coordinates, drawings and pins are unchanged. Remote satellite, terrain and hillshade layers are omitted in that mode.

## Conditions and limits

- First use, first sign-in and initial data/media preparation require a connection. Device storage can be refused or evicted by the browser; the app reports failed saves rather than claiming success.
- Page readiness confirms startup dependencies, not every lazy-loaded tool or remote image. Open the particular design, crop-plan, report and lesson screens while connected before fieldwork.
- The new fieldwork queue does not replace the existing money-book/Firestore queue. Receipt originals remain device-only. Course evidence file uploads and new remote media outside visit/training records have not been converted to this queue.
- AI services, AI transcription, OCR, fresh maps and remote searches still require a connection. Phone keyboard dictation availability depends on the device.
- Role/access administration, funder-access changes, team assignment and assessment lifecycle actions stay online. They are not silently queued.
- A revoked remote permission cannot be discovered without connectivity. On reconnect, the server rechecks access; known access refusals invalidate cached reads. All local work is separated by account and membership/role scope.
- The existing concurrent map-shape overwrite regression remains marked TODO in the repository. This work does not change the separately owned map-sync protocol.

## Verification

- Executable service-worker tests: first installation and network-free startup dependencies; incomplete update retains old shell; previous build and downloaded lessons survive.
- Queue tests: restart, photo/signature/feedback preservation, repeated local edits, acknowledgement loss, quota failure, account changes, explicit access refusals, conflicts, online-only actions and simultaneous clients.
- IndexedDB adapter tests use fake-indexeddb transactions, including real transaction abort semantics and simultaneous lease claims. These are automated storage tests, not Safari/iPhone validation.
- Receipt tests check actor/org/lane isolation and refusal to reuse an operation ID for different content.
- Final verification: TypeScript passed; 3,535 tests passed, zero blocking failures, and one pre-existing map-sync TODO. Whitespace checks passed. The map-sync TODO is not reported as fixed.
- The cloud preview browser returned ERR_BLOCKED_BY_CLIENT for the local app URL. Visual layout, live Firebase reconnection, and real iPhone/Android cold-start validation remain unverified. No claim of deployed or device-tested completion is made.

## Release acceptance test

1. In a designated real test account, load the new release and keep it online until preparation finishes. Use Offline & sync to prepare the role's pages, records and visit/training photos. Download an English or isiZulu lesson separately.
2. Open the exact garden/design, crop plan, records, report and lesson tools you intend to use. Review any preparation gaps.
3. Disable Wi-Fi and cellular data. Close the app completely, then reopen it from its installed icon. Repeat from the browser entry point.
4. In the correct test roles, save a visit with a photo and GPS coordinates, a training register with a signature and feedback, a garden-area observation and an assigned assessment response. Save an unfinished draft as well.
5. Close and reopen without signal. Verify all saved values and evidence remain. Confirm the UI describes them as device-saved/unconfirmed.
6. Restore connectivity with the app open. Check that the queue clears only after confirmation and that a second signed-in device sees exactly one copy of each record, with matching evidence.
7. Change one record on another device before syncing its offline edit. Verify the conflict is retained for review and neither version is silently overwritten.
8. Switch accounts, restart, and confirm no former-account records, photos or pending entries are shown or sent under the new account.
9. Repeat on iPhone Safari/home-screen installation and Android Chrome. Include storage refusal and a dropped connection during an upload. Do not clear real unsent work to test eviction.
