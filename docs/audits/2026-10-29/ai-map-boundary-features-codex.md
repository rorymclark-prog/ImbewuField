# Paid AI map boundary foreground follow-up — 29 October 2026

- Auditor: Codex, following Rory’s screenshot of clipped tanks and planting.
- Reviewed base: `cc2809c55ec03a37364895ffa43de1750a6cdcb4`; branch `codex/ai-map-boundary-features`.
- Deployment inspected: pending current-head preview and production checks; final revisions go on issue #35.
- Previous audit: [Paid composition corrections](ai-map-composition-fixes-codex.md), released in PR #1143. Finding IDs retained.
- Scope: painted map restoration and foreground occlusion only. No provider, billing, permissions, job execution or persistence changes.
- Evidence: original paid Whole artwork and its frozen scene, actual compositor, full-resolution close-ups, vector and pixel regressions. No new paid generation.

## What was already done

PR #1143 removed zone photo strips and duplicate roof slabs, restored the independent boundary, and retained white paper, catalogue legends and free paid-artwork reassembly. Those corrections are retained. Rory’s new screenshot demonstrates a narrower remaining issue: the foliage-only foreground could never preserve blue/teal tanks, and a footprint-sized plant window still cut some illustrated leaves.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-002 | Tanks and some foliage are cut at the survey line. | Implemented; local image inspected. | Plant windows include rectangular planting and a small 15% paint halo. The actual current gallery identifies Rory’s screenshot as Planting; its already-painted tanks are physical context, so their silhouettes are retained there too without adding labels/inventory. Zones remains outline-only. Saved tank ground positions bound a two-diameter upright presentation envelope, shifted upwards for cylindrical tops. Colour selection admits teal/green tank material only inside tank windows. Connected foliage must touch the original plant footprint, limiting disconnected neighbouring vegetation. The original paid Whole close-up now has complete tank lids and more crown overhang. These are presentation windows, never dimensions to use for construction or planting. |
| AI-MAP-008 | Earlier coverage did not catch non-green tanks or rectangular planting being excluded. | Added regressions; relevant checks pass. | Actual helper probes check tank-top projection, rectangular foliage, sheet membership, unchanged geometry, teal and sunlit lids, rejected distant objects/soil/pale fence strokes, and disconnected neighbour rejection. All pre-existing composition assertions retained. A new provisional water-only tank-window assertion was corrected before release: the actual Planting artwork visibly already contains the tanks as context, so sheet membership is not the right rule for clipping an existing silhouette. |
| AI-MAP-001 / 003–006 | Photo strips, roof duplication, boundary, provenance and Whole label controls. | Earlier correction retained. | Shared render suite rerun; no related contract intentionally changed. |
| AI-MAP-007 | Source-photo inset seams. | Open. | Existing source transitions are untouched. |

## Verification

- Typecheck: `npx tsc --noEmit` passed.
- Relevant suite: `npm run test:render` — 574 pass, zero failed/skipped/TODO.
- Full suite: runs separately in CI under AGENTS.md §1; no current full-suite pass claimed.
- Whitespace: `git diff --check` clean.
- Release notes: `npm run notes:pending` passed before commit. Four notice translations are explicitly unreviewed machine drafts, paired with the English source in `ai-map-boundary-release-drafts.json`.
- Output inspected: actual current compositor reassembled the original paid Whole image at High/SCALE 3. Full sheet and 1500px-wide top-boundary comparison inspected. Frozen scene serialized identically before and after.
- Wider mask trials were rejected after image inspection exposed neighbouring foliage and model fence strokes. The final smaller halo uses connected original foliage without closing over ground or pale rails.
- Limits: colour-based extraction remains a heuristic, including a one-pixel fringe. It does not certify model feature counts, species, position or completeness of every branch. Source-photo seams remain open. No fresh provider image or physical-device check. Local canvas uses fallback fonts; browser check is still needed for release.
- **This changes the picture.** `PLAN_VERSION`, recipe tokens, source/raw image, measured geometry and old gallery entries are unchanged. Existing paid artwork can use the same free reassembly action after deployment.

## Next continuation

Confirm current-head focused-render/security CI and preview, record visual evidence in PR/issue #35, then merge and verify production. Reassemble existing paid artwork without a provider request and inspect the live result. Keep old gallery entries. Complete release evidence belongs in the issue #35 completion ledger.
