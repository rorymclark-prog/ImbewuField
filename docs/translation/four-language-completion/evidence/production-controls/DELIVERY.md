# Production controls — reviewable draft delivery

The ordered Node 24 run at source checkpoint `7f24f34959b20a0647cebf2732247f5ca240eec5` passed `npx tsc --noEmit`, the entire `npm test`, then `git diff --check`. Of 5,907 tests, 5,906 pass, zero fail and one inherited shape-sync TODO remains. All 1,831 frozen input hashes and 115 runtime artifact hashes still match after verification. The separate pending-release-note gate exits zero, with the supported single unnoted user-facing commit tolerance. Raw logs are excluded.

[Attempt 2 metadata and frozen inputs](verification/attempt-2/run.json) supersede the pending full-run status in the immutable [runtime snapshot](runtime/README.md). The [first failed attempt](verification/attempt-1/README.md) is retained. Its heading test now checks the actual rendered English heading and rejects a deliberately renamed heading; the original visible-destination assertion remains. All 69 related checks pass. No production model or browser output changed for that test repair.

The five production controls contain 186 source phrases and 744 unreviewed native drafts, with all 1,761 inherited registry rows preserved. Runtime evidence covers 228 complete browser states and 49 interaction captures; 40 priority native panels were actually inspected. The component source change is `409d500ee09fd31422a9a8c2c2833d2cbf28ea58`; this delivery adds the regression repair and verification evidence. This changes the picture through translated text and wrapping. PLAN_VERSION stays unchanged.

Branch: `codex/four-language-production-controls`, stacked on `codex/four-language-source-references` (draft PR #1124). The parent at `784c2ef796a470445ddd82112314d616d7e4f94e` has both exact-head CI jobs green in run 40321979087. The new branch must have both its own CI jobs read before claiming green CI. No merge or deployment is authorized by this delivery.

Whole-app translation remains incomplete: current-main/account/role integration, main crop-page furniture, further guidance controls, feedback/signatures, learning/media, errors/accessibility/exports and fluent/agricultural review remain open. These are drafts, not reviewed farming instructions.
