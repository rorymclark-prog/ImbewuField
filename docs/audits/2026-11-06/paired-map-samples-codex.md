# Paired exact SVG and AI samples — 2026-11-06

- Auditor: Codex, following Rory's request for an exact/AI sample of every map.
- Reviewed code: production base `06315a74ae03d6cb771c659776e09ce47f1d4a2b`; documentation branch `codex/all-map-illustration-guides` over `08ac49acf7178fc1fada79cbd50f79af06fe265b`. No runtime edits.
- Previous review: [All-map illustration guides](all-map-illustration-guides-codex.md), carrying the existing fidelity findings forward.
- Deployment inspected: none; samples only. This is not live phone/iPad/laptop QA.
- Scope/evidence: ten actual native drawing exports, genuine SVG drawing captures, nine newly selected built-in AI illustrations plus the previous approved Sector appearance sample. Exact rendering uses one original frozen saved scene, not a newly fetched live account revision.

## What was produced

All nine plan sheets and Terrain & Sections have exact PNG/SVG and selected AI PNG files, paired in a local comparison gallery with per-image review notes. Native drawing callbacks are copied/transpiled locally from the current component without its UI; no renderer or application source was changed. A local canvas adapter records the actual drawing operations and inlines intermediate vector layers. Photographs and botanical/material textures remain embedded bitmaps; text is outlined. These are not PNG-only files wrapped in an SVG extension. Each final SVG contains vector paths and valid internal references.

The preserved frozen scene serializes identically before and after every map callback. All geometric and numerical calculations still come from the application. Initial use of an older cached renderer showed obsolete Water budget notes and was discarded before generation; selected inputs use the current shared budget. Native PNGs are the appearance reference, since SVG opacity/pattern handling differs by viewer.

Rory rejected the new Sector attempt during generation: **use the previous approved sample**. The selected Sector file is an unchanged copy of that approved reference, and the new attempt is retained separately as rejected. Do not infer that a new Sector guide was approved or replace the earlier decision.

## Findings and disposition

| ID | Observed issue | Disposition |
| --- | --- | --- |
| AI-MAP-068 | Ten guide recommendations needed actual paired examples | Samples produced and inspected; not ten approvals or deployed defaults. |
| AI-MAP-069 | Model-authored geometry, text and source detail can drift | Still open. The Zones draft retains proposed planting context despite the quieter existing-site intent. AI Site ground/alignment is not verified historical evidence. |
| AI-MAP-019/026/042 | Boundary clipping, bed and excavation fidelity | Retained. New Planting permits visible canopy overhang. Lighter Earthworks is an appearance trial; bed corner and pit/swale interpretation are not certified. Water also adds constructed-looking swale edges. |
| AI-MAP-060 | AI route can disagree with the exact polyline | Still open. Whole and Phasing simplify/change part of the network. Accurate source labels do not validate the painted route. |
| AI-MAP-036/055 | Missing shade cover / broad restoration risk | Whole sample omitted mesh and clearly visible southern hives. A targeted correction restored mesh but put hives in the wrong location and was rejected. Phasing shows southern hives but still lacks a convincing cover. Retain these as explicit draft failures. |
| AI-MAP-069 | AI Terrain adds unsupported detail | First attempt invented extra contour curves and was rejected. Corrective attempt removes those curves but still changes small site-feature interpretation. Native profiles/contours remain authoritative; no new elevation or accuracy claim. |
| AI-MAP-035 | Generated artwork copies an Exact-plan footer | Some new AI drafts retain this false source footer despite the requested AI notice. Gallery/README explicitly identify the entire AI column as draft illustration and flag the copied assertion as incorrect. These files are not suitable as approved production exports. |
| AI-MAP-033 | Unfaithful oblique | Not regenerated or approved. All paired samples are top-down. |

## Verification

- All ten exact native PNGs, all selected AI results and the rejected corrections were visually inspected. All ten SVGs were rendered using Cairo and visually inspected; earlier native/MuPDF proofs exposed unsupported bitmap/pattern/font behavior and are not the final evidence. No browser policy workaround was used.
- Final SVGs contain 84–1300 paths, inlined vector drawing layers and valid internal references. Embedded imagery is expected, not a claim that every plant texture is vector. SVG opacity/material rendition may differ from native PNG.
- Static pack checks: ten pairs, all linked files present, SHA-256 and byte counts recorded, selected Sector copied from the previous guide, ZIP integrity checked. Private images, prompts, complete source revision and per-file provenance stay in the local sample folder rather than Git.
- Private deliverables: `Documents/ImbewuField App/Map style samples/2026-11-06/Paired exact and AI/Samples.html` and sibling `Exact and AI map samples.zip`. The folder contains `samples.json`, `source-provenance.json`, `generation-manifest.json` (prompts and image roles), original native previews and outlined SVGs. Rejected alternatives/intermediate working evidence are excluded from the ZIP.
- Typecheck/tests not rerun: no runtime code changes. Whitespace checked for these audit documents. No new application test-suite pass claimed.
- Generation used the built-in image tool, not the application worker or a CLI/API credential path. Twelve new standalone calls include rejected iterations; the selected set keeps the older Sector reference and nine new drafts. No saved map, geometry, provider settings, permissions, cache counters or production deployment changed. No temporary server/test browser remains running.

## Next continuation

Keep Rory's previous Sector reference fixed. Review the remaining samples by sheet before adopting style guides. Retain explicit known failures, restore exact geometry and text after artwork in the actual application path, and verify new output before rollout. A genuine wider satellite/drone context source is still needed; no invented wider habitat overview or Zone 5 classification was supplied.
