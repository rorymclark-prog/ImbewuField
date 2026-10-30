# Duplicate driveway guide and remaining canopy clipping — 30 October 2026

- Auditor: Codex, following Rory's latest Whole-map screenshot and explicit choice to hide the closed guide in glossy maps while keeping it editable.
- Reviewed revision: production `21c177d30c7d8dbdac51e55fe14e927b1273b372`; focused branch `codex/glossy-driveway-guide`.
- Deployment inspected: roof release #1155 is live at 21c177d. This guide correction awaits its own release gates; terminal evidence belongs to its PR / issue #35.
- Previous audit: [Existing roof detail](aerial-roof-detail-codex.md); carries forward AI-MAP-018 / 019, 007 and the separately gated Oblique findings 011 / 012.
- Scope: duplicate closed-path presentation in AI inputs, design briefs and inventory; existing paid-job metadata recovery. Original saved geometry and worker/permissions/spend/schema are untouched.
- Evidence: actual latest owned Whole job's durable scene, raw/input/mask/source; actual input painter and finisher; native pixel counts. No new provider generation.

## What was already done

Phone composition/full-screen and plain-input factual roof recovery are live in #1154 / #1155. They remain intact. The new screenshot uses satellite input and a different, completed Whole job. Its original AI input already contains yellow dashes; the source photograph does not.

The dashes are a saved closed `path` line covering most of the same area as the driveway, not a new kerb added by the finisher. Rory explicitly chose “Hide the guide in glossy maps; keep it editable.” All plant/tree canopies should remain complete at the boundary; he did not limit that request to one planted tree.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and limits |
| --- | --- | --- | --- |
| AI-MAP-018 | A closed duplicate driveway tracing guide is interpreted as a bright kerb in AI artwork. | New-input correction implemented and visually verified. | One classification authority finds a closed path whose area and a recorded driveway overlap by a majority in both directions. A presentation copy omits it from marks and descriptions, while open paths, separate walking loops and a large house circuit remain. Source state is unchanged. The actual new input has zero guide-colour pixels, versus 1,491 in the paid input. The prompt explicitly requests unbordered tar. Future model output is unverified; no paid retry was purchased. |
| AI-MAP-018-R | The old paid image already contains baked-in dashes. | Retained honestly; not erased by this release. | The durable new prompt records guide omission. Recovery uses that marker to select its presentation inventory; older jobs retain their old inventory and original pixels. A colour/nearby-material cleanup trial did not safely remove the border and was discarded. This release must not claim that free reassembly erases old baked-in guide marks. |
| AI-MAP-019 | Existing canopy is cut at the property boundary. | Reproduced; foreground correction remains open. | Raw Whole art includes continuous surrounding trees. Exterior source restoration removes unmarked existing canopy at the survey line; the saved planted Moringa beside the banana circles is not itself visibly truncated in the inspected close-up. A trial retaining all AI surroundings exposed a second, displaced AI boundary and was rejected. No exterior protection, billing difference gate or measured boundary is bypassed. Continue with source-backed foreground selection rather than retaining shifted neighbourhood artwork wholesale. |
| AI-MAP-007 | Registered source-photo seams. | Open. | Retain earlier evidence; no source-registration changes. |
| AI-MAP-011 / 012 | Oblique experimentation/release. | Deployed preview available; production merge separate. | Preview a1414fd has successful build, focused-render and rules; full suite still running at review. Rory asked to experiment immediately and was given the existing deployed preview. No CI workflow or security check was disabled. Production merge readiness must use the actual current integrated head, not this guide release's focused checks. |

## Verification

- Typecheck, shared render suite, affected UI/copy/access tests, whitespace and notes: final results recorded on the PR / issue #35 before merge.
- Executable tests exercise real classification, input painting, brief and recovery metadata. They prove source geometry stays byte-identical, the guide remains editable, real open/closed walking routes remain, and old paid artwork is not claimed to have been cleaned.
- Actual new Whole input inspected at original scale 2. Measured original guide-colour pixels 1,491 → 0; one editable guide remains in the frozen scene. `glossy-driveway-guide-proof.json` records the non-sensitive measurements; private inputs and scene remain outside Git.
- The first pixel counter assumed a different path colour and failed its nonempty baseline assertion. It now reads the production LINE_COLORS value. No production guard was weakened.
- Raw paid Whole, current assembled page and northern raw/assembled close-up inspected. The full illustrated-context and nearby-pixel guide-erasure trials were discarded after visual review. They are not part of this branch.
- Limits: no new provider output or physical iPhone Safari check; all-canopy clipping is still open. Four notice translations are paired unreviewed drafts.
- **This changes the picture** for a new glossy AI input. PLAN_VERSION v93 and recipe r8 are unchanged. Saved paths, measured outlines, original paid bitmaps, access controls and paid gates remain intact.

## Next continuation

Complete focused-render + rules + preview and release the guide-input correction. Continue AI-MAP-019 against the retained paid image without inventing canopy geometry or introducing a shifted second boundary. Integrate released main changes into Oblique before final production merge checks; its deployed test preview remains available for Rory's experiments.
