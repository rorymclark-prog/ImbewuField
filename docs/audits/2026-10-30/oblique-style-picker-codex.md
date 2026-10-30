# Complete Oblique style picker across sheets — 30 October 2026

- Auditor: Codex, following Rory's request to merge Oblique and ensure its style options.
- Reviewed base: deployed `9df3ff3af48074f2458826aedab4670be56348c5`; focused branch `codex/oblique-style-picker`.
- Deployment inspected: Oblique #1153 is live at 9df3ff3. This style follow-up awaits its own current-head gates; exact terminal results belong to its PR / issue #35.
- Previous audit: [Experimental release integration](oblique-experiment-release-codex.md). Carries forward AI-MAP-011/012/013 and unresolved AI-MAP-019.
- Scope: visibility, available choices, default pressed state and accurate Oblique style descriptions. The generation prompt's style text is unchanged; the getter shares that existing text with the UI.
- Evidence: real component initializer and click-handler execution; all preset prompt/style round trips; actual JSX rendered in an isolated browser fixture. No farmer data, auth or paid generation in the fixture.

## What was already done

The experimental Oblique feature is merged and deployed. It retains one capped paid request, approved AI access, original engine/quality controls and the separate illustrative finisher. Its full suite was still running at release under Rory's explicit one-off wait exception; rendering/security checks and preview passed. This smaller UI correction qualifies independently for the focused verification policy; it does not extend that wait exception to unrelated work.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and limits |
| --- | --- | --- | --- |
| AI-MAP-020 | Choosing Oblique from an exact sheet leaves styles hidden; Sector can remove Satellite Overlay from the list. | Implemented and fixture-verified. | The existing AI style visibility now includes Oblique on any selected sheet. Its choices use the complete preset set, while top-down Sector keeps its existing restriction. AI-off, no-sheet and Simple gates remain. Returning to top-down Sector replaces only a newly incompatible style with the existing default; compatible selections stay selected. Real initializer tests cover exact/AI entry from Base, Sector, Phasing and a design sheet. |
| AI-MAP-021 | No card is highlighted when Oblique uses its default; every card shows the same generic warning. | Implemented and fixture-verified. | The same fallback preset the generator uses is visibly active. Card descriptions/tooltips use the existing Oblique appearance direction, avoiding top-down promises of exact geometry or untouched photo pixels. Shared getter preserves the exact existing prompt style text. The header identifies the whole oblique view. |
| AI-MAP-011 / 012 | Oblique generation and recovery retain view/style provenance. | Existing release retained; wiring verified for every preset. | All preset keys survive versioned job identity and resume. Real card callbacks select each style over applySheet's default without queuing a paid request. Prompt first line equals that style's shared description; distinct choices request distinct appearance directions. No paid provider image for every preset was purchased, so rendered style fidelity is not claimed certified. |
| AI-MAP-019 | All-canopy clipping at the top-down boundary. | Still open. | No foreground, exterior, registration or geometry changes are part of this picker correction. |

## Verification

- Typecheck passed; 594 shared render tests and 50 affected UI/access/copy/kill-switch checks pass, with no failures, skips or TODOs. Whitespace and notes pass. Current-head release results are recorded on the PR / issue #35 before merge.
- Existing Simple/kill-switch assertions remain intact. New behavior tests execute the actual initializer, choice list and card callback; they fail if Oblique loses exact-mode visibility, a preset disappears, applySheet overrides the user's choice, or selection starts a paid request.
- Browser fixture renders the actual style JSX from an exact Sector entry, not a screenshot mockup or injected app auth. Nine style cards are in the DOM, Reference Blueprint is pressed by default, and all nine tooltips contain the distinct directions used by the renderer. The last cards are reachable by horizontal scroll. The fixture is static; callback behavior is exercised separately by the executable tests.
- Visual evidence: [first cards and default](oblique-style-picker-fixture.png), [last three cards](oblique-style-picker-last-cards.png), [non-sensitive DOM proof](oblique-style-picker-dom-proof.json). No labels clip at the inspected 360px content width. Local fixture uses Arial; this is not physical iPhone Safari or full authenticated-app certification.
- No provider call, worker/dispatch/spend/access change, schema change or saved-geometry mutation. Existing queued jobs and bitmaps remain intact. Prompt appearance text for a given preset is byte-identical; PLAN_VERSION v93 / recipe r8 unchanged. This changes the picker and available UI choices.
- Four notice translations are paired unreviewed drafts. Whitespace/notes and current-head focused-render, rules and preview are required before merge under AGENTS.md §1; the full suite runs separately and is not claimed passed.

## Next continuation

Complete the focused release gates, merge and verify the production SHA. Rory can choose Oblique on the normal site, scroll through all style cards and then press Generate oblique view. Inspect his first actual paid result before claiming provider-level appearance fidelity. Continue AI-MAP-019 separately.
