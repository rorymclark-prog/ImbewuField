# Sector release contract follow-up — 2026-11-05

- Auditor: Codex.
- Reviewed revision: branch `codex/sector-release-contracts`, based on `72d6e68e25968e5bfcdf0d6a503f05fa1f4915e2` (#1284).
- Deployment inspected: both `https://imbewufield.vercel.app/api/build-info` and `https://permamap-sa.vercel.app/api/build-info` return `72d6e68`, `main`. Production run 42074678521 succeeded. This follow-up's checked head and deployment identity belong on its PR and issue #35.
- Previous audit: [Broad arrows and collision correction](sector-bold-arrows-codex.md). Original-device AI reassembly/export and physical-device acceptance remain open.
- Scope: typography verification and four native update-description chunks. No map painter, source geometry, provider, spending, schema, worker, workflow or other-layer change.
- Evidence: actual painter execution, real update UI tests, source/diff review, existing native image and published build metadata. No paid generation.

## What was already done

#1284 released the stronger arrows after required current-head rules/focused-render checks and a successful preview. Its full suite remained in progress, as recorded. Reviewing the earlier baseline full run 42025972819 (`1ae9ac2919bee8496ef820495e3bd5467e9d054a`) exposed related failures outside the focused-render group. They are addressed here rather than dismissed solely because they already existed on main.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-058 | Old typography assertion prohibits the approved illustrated cards | Corrected contract; affected tests pass | The old test searched to a removed palette comment, so it inspected an empty block. More fundamentally, its universal no-plate claim contradicted Rory's approved readable illustrated cards. The replacement executes the real label painter at two scales in exact and illustrated modes. It checks original wording/anchors, exact coloured text over a rounded halo without plates, illustrated opaque background before text, title/detail contrast of at least 7:1, text anchors inside the card, and absence of heavy card text strokes. Legacy halo coverage remains. No painter changed to satisfy the test. |
| AI-MAP-058 | Three recent Sector update descriptions fall back to English | Implemented; UI tests pass | Add exact English/native pairs for isiZulu, Sesotho, Xitsonga and Tshivenḓa. Drafts are recorded in `sector-graphics-release-drafts.json`, explicitly unreviewed machine translations. Existing controls, locale history, quantities and draft disclosure remain unchanged. A first-language review is still outstanding. |
| AI-MAP-058 | Related failures were absent from the focused-render command | Recorded and directly verified | Current baseline on `72d6e68`: these two suites reproduce 26 passes and 5 failures. After correction, typography/localization plus Sector cartography give 53 passes, 0 failures. No workflow or test group is weakened or edited. |
| AI-MAP-042/026/019/033/051/063/064 | Other-layer and original-device acceptance gaps | Carried forward | No saved paid sheet was present in the available owner Chrome gallery. Native composition, an exact-map readback and a whole-sheet phone thumbnail do not prove original-device AI reassembly, physical-phone/iPad acceptance or fresh-provider fidelity. No paid retry, storage injection or credential workaround. |

The baseline run also reports the existing `shape-sync-loss.test.ts` TODO. It is not a newly introduced failure and is outside this presentation follow-up; saved sync is not modified. The full suite continues to report its own result separately.

## Verification

- Typecheck: clean before the affected tests.
- Affected tests: 53 passed, 0 failed across `sheet-typography`, `update-notices-localization` and `sector-cartography`.
- Focused render: unchanged painter already verified with 639 passes; current-head CI is required before this branch merges. No local full-suite pass claimed.
- Whitespace: clean. Release-note stamp/check and current-head CI evidence follow on the PR/ledger.
- Output inspected: the unchanged actual native final `sector-bold-arrows-draft4-1123.png`. Full-resolution final hash remains `1de2e8e65ac648ec2eeffb2703fa1f82bac64ba6465f30b0003a25b3540cc8f2`. No rerender or extra provider call is needed for native update descriptions and a test correction.
- This follow-up does not change the map picture. PLAN_VERSION remains `v93`; recipe counters remain untouched.

## Next continuation

Push the completed branch once, record exact current-head rules/focused-render and preview results, then guarded merge and verify both normal production aliases. Keep original-device free AI reassembly explicitly open. Use the stable draft 4 image as the actual broad-arrow preview; never substitute the exact technical map when describing the illustrated finish.
