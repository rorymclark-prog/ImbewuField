# Coherence audit — 28 October 2026

Reviewed against main `9e11f2396dadc84c2a8fb07bb89162007ba9e245`. The original open checkout was August-era; the isolated audit checkout was reconstructed to the exact current main tree before changes.

## Findings repaired

| Finding | Before | Change and regression evidence |
| --- | --- | --- |
| Reports could import another site's water pins | The report collector read every account water point | Filter against the report's recorded boundary; without a boundary reuse the existing site proximity authority. Tests include local, distant, boundary-adjacent and missing/invalid site context. Stored pins and geometry are unchanged. |
| Historical report photos changed with live evidence | Reopening and exporting old advice could substitute newer site photographs | Capture submitted photograph bytes, labels and notes in the report. Save/reload, screen, cover and PDF use that capture. Existing reports with unknown photo history include no replacement photos and disclose that history is not recorded. |
| Old reports silently acquired today's maps | A missing historical map selection defaulted to the current newest sheets | Missing historical selection starts empty. The farmer can deliberately attach a map; missing original maps are never silently substituted. New drafts retain useful defaults. |
| Fieldwork saves disagreed with the phone after midnight | UTC server date rejected today's SAST training, visit and production records until 02:00 | Three write routes share an explicit Africa/Johannesburg date helper. Audit timestamps remain UTC. Tests cover midnight/year rollover, host timezone independence, today accepted and tomorrow rejected. |
| Design/crop exports exposed technical failures | Some catches displayed raw browser, Firebase or worker messages | Reuse the shared friendly-error helper. App-authored safety/sign-in/retry guidance remains available; provider diagnostics stay out of farmer-facing text. Upload rollback is exercised. |
| Map gallery keyboard handling diverged | Gallery lacked shared focus containment; zoom Escape had separate handling | Named dialog, shared focus handling, focus return and nested Escape priority. Regression tests exercise the callback wiring; final browser capture is a separate verification step. |
| Production charts remained unreadable in dark mode | Four headings were RGB(238,228,208) on RGB(255,254,250); kept-food controls had dark text on the dark page | Shared chart surfaces, headings, legends, SVG labels and controls use the current theme tokens. Calculations and chart data are unchanged. |

New regression files: `fieldwork-server-date`, `report-water-scope`, `report-evidence-snapshot`, `design-export-coherence` and the production chart theme regression, all registered in the normal test command.

## Earlier audits reconciled

Read September's records/tour review and request register, October 25–27 report integration/handoff notes, waves 22 and 25–28, and relevant historical flow, foundation and source-of-truth audits.

- Immutable render scene, attempt/revision identity and explicit validation metadata now exist. Those September missing-field findings are not re-raised.
- Training currently links attendance, signatures, certificate references, venue, photographs, feedback and report output. These are not treated as unimplemented because an older audit requested them.
- The October 27 report origin, purpose, market-source and lab/SoilGrids checks remain intact.
- The dark production chart finding from waves 21/22 and the Codex error/focus handoff from waves 27/28 were still present and are addressed here.
- Course wording, translation source bindings and species identities were not rewritten.

## Observed browser work

On the live app, inspected the desktop home, tour entry, narrow mentor fieldwork view, training register, attendance/signatures/venue/feedback and training report screen. In isolated Tour mode, changed a session title, saved, reopened it and observed the saved value alongside its existing attendance, signatures and photos. Live farmer records were not edited.

Visually reproduced the dark production chart defect and measured its computed heading/surface colours. This is direct output evidence, not a source-only inference.

The training PDF download observation timed out, so no claim is made that its print pagination was visually verified in this pass. Starting a local development server was blocked by the sandbox's listen permission. Branch preview/CI verification is recorded on the PR and issue #35.

## Remaining limits

- A water pin has coordinates, not explicit site membership or access rights. The existing proximity fallback cannot establish ownership or permission to use water; boundary-backed reports are more precise.
- `analysedMapIds` is still reconstructed from labels, which are not unique. Carry a source sheet ID through image preparation before relying on this field for stronger evidence claims.
- Saved-report spatial schematics deliberately read today's design; `siteReportFigures` already labels the changed-design comparison. This pass freezes attached photos/maps, not the full schematic input model.
- Physical-device offline reconnection, authenticated cross-account field saves, live rule deployment and paid render fidelity were not exercised. No paid generation was requested.
- New regional release-note copy is an unreviewed draft, as marked by the existing locale files. Fluent review remains necessary.

## Release and rollback

Changes are confined to one reviewable branch. Revert its change commit to roll back. No rules, workflow, saved geometry, species name, agricultural calculation, approved lesson body or `PLAN_VERSION` changed.

This changes the picture for report attachments and production-chart UI. It does not redraw map sheets or re-key farmers' paid map galleries.

Required checks: `npx tsc --noEmit`, then `npm test`, then `git diff --check`. Read the PR check results for the final combined status; targeted checks alone are not the release gate.
