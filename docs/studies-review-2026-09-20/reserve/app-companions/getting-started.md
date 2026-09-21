# C01 — Start, find your way and keep work safe

Implemented at `/student/guides/getting-started` as six English steps, a three-choice save decision, independent sample-record exercise and the shared printable layout. No animation added or changed. Narration, isiZulu review and recorded walkthrough remain open.

## Source and walkthrough evidence

Baseline main `d983bfe7d5297b5f66b85f2393e85685e6e53423`, 21 September 2026.

- `lib/sample-mode.ts`: session flag, memory-only practice data, reset on full reload, storage isolation and gated remote operations. The guide does not claim practice edits are a backup.
- `lib/sample-tour.ts`, `app/tour/page.tsx`, `components/ProductTourProvider.tsx`: actual stops, labels and checklist semantics. **End tour only disables the guided checklist; it does not call exitSampleMode.**
- `components/NavDrawer.tsx`: **Exit tour** calls exitSampleMode and returns to Home.
- `components/FieldSyncBadge.tsx`, `app/offline/page.tsx`: Offline/waiting link, fieldwork queue, money-book separation, connection-dependent tools and download limits. No claim that an empty queue proves all data is synced.
- Existing invoice/receipt guides and app source: account/device-scoped full invoices; receipt originals on the original device; linked crop-sale sync does not copy the full document.

Production UI walkthrough in a new sample-only tab: opened `/tour`, chose Record the work and the sale, read the Four pages in your farm book tip, chose Try it now, observed Tour and all four Records tabs. Opened Invoice and existing example #0043: buyer Ubhejane parents fund, R50.00, 2.5 kg mixed vegetable box at R20.00, unpaid. These are existing synthetic example records, not price recommendations. Opened the menu and observed Tour workspace and Exit tour. Exit tour returned to Home and removed the Tour badge. No real or sample financial record was edited, saved, deleted or sent in this orientation walkthrough.

## Acceptance and limitations

The reused sketch-the-site illustration was inspected: two growers comparing a sketch and notebook with a warm rural homestead. It is context art, not evidence or a UI screenshot. Guide uses the established AppGuidePage styles, existing navigation and print affordance. No live lesson bodies, course-progress rules, PLAN_VERSION, saved geometry, species or financial calculations changed.

Local typecheck passed. Full-suite, rendered guide, links, phone layout and production checks recorded below when complete. No authenticated multi-device sync or real unsent-write recovery performed; those are not claimed as tested. Independent learner and isiZulu review remain open.

Local checks: typecheck, 3641 passed / 0 failed / 1 existing TODO, diff whitespace and release-note gate passed. Full guide DOM contains all six steps and three choices. First-run consent overlay obscures local visual inspection; no consent was accepted for the user. Preview visual/interaction verification remains required before merge.
