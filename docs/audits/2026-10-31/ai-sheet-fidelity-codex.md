# Nine-sheet AI fidelity review — 31 October 2026

- Auditor: Codex, following Rory's exact/AI Earthworks comparison and request to check phone, iPad and laptop.
- Reviewed base: production `e6f540ced0fef1b9bd220425a1fcbd6bd8c8201c`; branch `codex/ai-sheet-fidelity`, plus local changes described below.
- Deployment inspected: production base; release SHA/checks belong to PR and issue #35.
- Previous audit: [White Water finishing](paper-map-finish-codex.md), carrying AI-MAP-019/024 forward; [nine exact sheets](../2026-10-27/map-visual-audit-codex.md).
- Scope: all nine exact sheet compositions, existing owned AI artwork for four sheets, per-layer AI input/brief, viewer sizing. No worker/provider dispatch, access, spending, schema or measured saved geometry changes.
- Evidence: source review, executable production helpers, actual frozen scenes/input/output/mask and local native compositor, browser viewport fixtures of the actual full-screen JSX. No new provider generation.

## What was already done

The white paper, narrower legend frame, missing Style entry, legacy-only roof recovery, separate Oblique view and independent paid-difference/access controls remain. This audit does not repeat the claim that a saved legend certifies what an image model actually painted. The owner's Earthworks output contains an invented tunnel beside its changed beds, mature planting instead of the digging stage, blue swales and no visible matching tree-pit register. These defects are in the provider artwork; resizing it for a different screen cannot correct them.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-025 | Earthworks AI shows the finished garden, blue swales and missing tree pits. | Input correction implemented; provider verification pending | Actual supplied input used generic green rectangles and blue dashed lines and omitted the derived pits. `drawMarks` now calls the exact Earthworks soil and cut/berm painters; the feature list includes the same derived pit count as the exact key. Actual revised input inspected: nine bare beds, 32 pits and two brown swales. Initial/polish prompt stages explicitly forbid proposed planting. Old paid art is not repaired by changing a prompt. |
| AI-MAP-026 | AI changes the vegetable-bed layout and adds a tunnel beside it. | Input correction implemented; provider verification pending | The nine outer rectangles, rotations and gaps are authoritative. A bounded per-bed register now supplies image-space positions, sizes and rotations to both design queue paths and the polish prompt. Tests check invariant geometry at several resolutions and no mutation. The image model still needs actual output inspection; text is not a shape verifier. |
| AI-MAP-027 | Structures and Zones AI inputs omit planting context that their exact sheets show. | Implemented; input verification | Generic input now uses `exactSheetElementRegister` and shared context alpha, rather than the Water-only context predicate. Executable input tests verify the same saved bed footprint in all three context sheets. Prompts distinguish the selected layer from the whole-site brief. |
| AI-MAP-028 | Phasing tells the AI to leave a cream schedule panel inside an upload containing only the map. | Implemented; provider verification pending | Actual queue source crops the panel out in both stages. Prompt now describes that map-only input, prohibits an invented panel and keeps schedule facts app-owned. Photo Plan retains photographic treatment rather than being ordered to repaint the ground. Satellite Overlay's model-owned legend is asked to remain white, matching Rory's earlier page preference. |
| AI-MAP-029 | Complete paid AI evidence is missing for five sheets. | Open | Latest owned frozen-scene jobs supply Earthworks, Whole, Water and Planting only. Base, Sector, Zones, Structures and Phasing have no comparable current owned AI output. Requested permission for at most nine fresh test renders, one per sheet, without automatic rerenders. No approval inferred and no charge made. |
| AI-MAP-024 | Existing plain-paper Water artwork roofs the courtyard. | Open | Reproduced from the paid raw output. Earlier paving-input correction retained; background recovery does not make this an accurate plan. |
| AI-MAP-019 | Some canopy edges are clipped at the property line. | Open | Existing paid Planting art remains a review candidate. This input review does not claim full foreground segmentation. |

## Sheet-by-sheet evidence

All nine exact sheets were composed from the same latest owned frozen scene and inspected as an overview; the four actual AI sheets were independently assembled from their own frozen scenes, original masks and output. The older Planting/Water snapshots differ from the latest Earthworks design, so pixel equality across those jobs is not claimed.

| Sheet | Exact baseline | Existing AI evidence | Disposition |
| --- | --- | --- | --- |
| 01 Base | Rendered; existing fabric and roofs | No current matching saved AI output | Needs a provider test; Base uses its existing dedicated background/fact overlay. |
| 02 Sector | Rendered; deterministic energy annotations and evidence notes | None | Needs a provider test. Existing ground-only contract and deterministic analysis retained; no new exact registration promise made. |
| 03 Zones | Rendered; numbered saved regions and key | None | Context input aligned; exact post-model zone overlay retained. Needs provider test. |
| 04 Water | Rendered; routes, fittings and budget notes | Existing paper render inspected | White exterior retained; courtyard error remains. Context bed geometry now explicit. |
| 05 Earthworks | Rendered; digging register and bare beds | User-reported Master Atlas output reproduced | New input inspected against exact; new output required. |
| 06 Planting | Rendered; plants, codes and matching key | Existing Reference Blueprint output inspected | Outer bed geometry supplied; canopy and provider count review remain. |
| 07 Structures | Rendered; own infrastructure and subordinate planting | None | Missing input context corrected; provider test required. |
| 08 Whole | Rendered; grouped system key | Latest ChatGPT Atlas output inspected | Bed layout register supplied; tree/bed counts in artwork are not certified by the exact inventory. |
| 09 Phasing | Rendered; schedule and phase pins | None | Nonexistent panel instruction removed; schedule and saved geometry remain deterministic. Needs provider test. |

## Verification

- `npx tsc --noEmit` clean; `npm run test:render` 600 passed; affected notice/UI/access/kill-switch tests 50 passed; whitespace clean. Current-head release checks belong to PR / issue #35; no full-suite pass claimed.
- Browser geometry matrix: nine exact + four existing AI sheets at 390×844 (phone), 820×1180 (iPad portrait), 1440×900 (laptop): 39 loaded images, `object-fit: contain`, no document overflow, image element within viewport. The same 39 cases passed at 1.4× app text zoom (78 total). [Observed summary](ai-sheet-viewer-checks.json). This establishes fixture bounds, not image semantics or physical-device certification.
- Full-resolution image screenshots captured immediately during navigation sometimes showed a partly painted PNG despite loaded DOM dimensions. Those captures are not accepted as visual evidence. Settled screenshots were inspected separately; DOM pass counts alone are not a visual pass.
- Native compositor/overview: all nine exact outputs and the four actual paid outputs inspected. Source scene bytes unchanged before/after. Actual new Earthworks diagram inspected. No new AI output inspected or claimed fixed.
- Private farmer imagery, job records, prompts and raw logs remain in ignored local cache, outside Git. No actual sign-in, app-gallery save, source deletion or paid request was performed in the browser. Four release translations are unreviewed drafts.
- **This changes the picture/input.** PLAN_VERSION v93 and recipe r8 are unchanged. Source geometry and old paid outputs remain intact. New prompts do not change an existing paid bitmap.

## Next continuation

1. Complete relevant local checks and focused CI/security/preview gates; record exact head and visual limits before merging input corrections.
2. On explicit permission, run no more than one fresh AI test per sheet through the existing capped owner workflow; inspect each against its exact baseline, including bed corners/counts, stage semantics, roof/courtyard, canopy edges, key and labels. Reject bad results; do not automatically pay to retry.
3. Finish the missing AI rows before claiming all nine maps look correct. Physical phone/iPad Safari remains a separate check from browser viewport sizing.
