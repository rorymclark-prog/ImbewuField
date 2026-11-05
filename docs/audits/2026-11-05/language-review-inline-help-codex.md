# Language review help placement audit

- Auditor: Codex international coordinator, with independent read-only source review.
- Reviewed revision: base `f81aa90d3df05625e11abf10e51064187f5feaa5`, branch `codex/nursery-review-help-continuation`, plus this scoped continuation.
- Deployment inspected: the original nursery worksheet at `https://imbewufield-international-nursery-main-reconcile.vercel.app`, build `f81aa90`, by a separately permitted browser owner. The changed interface has not been visually inspected.
- Previous audit: [International nursery reconciliation](international-nursery-main-reconcile-codex.md); carries forward the reading-overlap class `ux-01` in the [16 October visual audit](../2026-10-16/visual-ux-audit-claude.md).
- Scope: language-review help placement, scroll/print containment, existing help dialog loading/language, and one existing-language update description. Worksheet data, account/storage guards and measurements are retained.
- Evidence type: original public Chrome/CSV evidence; current source/AST preservation, actual React handler regressions, negative controls and ordered local checks.

## What was already done

The worksheet compares 26 frozen English messages with seven inactive language drafts. On the original preview, desktop 1280×900 and phone 390×844 checks matched all three source fingerprints. The filtered Bengali view downloaded all 26 unique rows with matching current/frozen English, unreviewed states and blank notes. Matching source fingerprints establishes source identity, not fluent approval.

At 390×844 the floating Lima launcher covered the Bengali draft heading and first line at bottom scroll, and the row status at another position. The document had no horizontal overflow. These are original-preview findings, not acceptance of the changed interface.

The interrupted owner's eight-file patch was captured with byte hashes and copied into a separate checkout; its original branch/checkout remains untouched. This preserves its paired route exclusions, opt-in in-place help dialog, deferred ChatPanel, picker gesture/file handling and additive assertions. Root continues that release fix with a bounded scroll region, scoped print escape, help language attribute and independently adopted source-paired description.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| REVIEW-UI-001 | Floating Lima covers phone draft text and review status | Implemented in source; visual acceptance open | Both actual launcher/clearance route guards exclude only the locale-review subtree. Other international routes and saved launcher positions are retained. Inspect the changed phone preview. |
| REVIEW-UI-002 | Removing the launcher could remove help or navigate away from the worksheet | Handler regressions pass; visual acceptance open | One in-flow LimaBar uses its opt-in existing dialog. Default callers retain their link. Photo picker remains synchronous with the tap; selected File and dialog language survive deferred loading. Reading does not import ChatPanel. |
| REVIEW-UI-003 | Appending help below min-h-screen content under a clipped root can make help unreachable | Source regression addressed; browser acceptance open | A focusable, labelled viewport-height region owns vertical scrolling and safe-area clearance. The preserved owner fragment fails the new real-layout check; the candidate passes. |
| REVIEW-UI-004 | Releasing only the child print constraints leaves the root body's viewport clip | Source review addressed; printed output unverified | A print-only body rule is conditional on the mounted review marker; the region releases its own print constraints and help stays hidden. Independent follow-up found no remaining concrete source concern. Actual browser print and selector support need inspection. |
| REVIEW-UI-005 | Localized help could inherit the English worksheet language | React regression passes | LimaBar declares its existing app language. The new isiZulu case fails before this attribute and passes after it; composer language is retained. |

## Verification

- Ordered pinned Node24: `tsc --noEmit --incremental false` with a 2048 MB heap exited0, then 268/268 affected checks across 27 files (zero failures/cancellations/skips/TODO), then whitespace exited0. This is the final source tree, after the language and print corrections.
- Actual negative controls: old fragment layout fails the reachable-region regression; missing help language fails `undefined !== zu`. All 60 assertions from the interrupted owner's test remain present, with 14 additional assertions. No original assertion was weakened or deleted.
- Source/AST preservation: all 427 previous pairs in each st/ts/ve/zu dictionary are retained, each with one new description (428 total). All 708 prior release-history literal entries remain intact under one new entry (709 total). Root layout, both worksheet page/data bodies, update-copy guards, package and lockfile are byte-equal to the base. Removing only the added LimaBar language attribute reconstructs the preserved owner's component bytes.
- Description provenance: compact [source/packet review](../../international/agy-nursery-inline-help-release-copy-2026-11-05/coordinator-review.json) and separate [coordinator adoption](../../international/nursery-inline-help-coordinator-adoption-2026-11-05.json). Four AI candidates remain unreviewed beside English; no new app language or fluent approval. Source was explicitly proposed before Git adoption.
- Full current-tree suite and current-head CI: not yet completed. Parent PR #1282's full CI remains separate. Affected checks do not satisfy that full release gate.
- Output inspected: only the original preview. The supported browser surface is disabled in this chat; changed desktop/phone, actual print and protected account/storage flows remain unverified.
- This changes the worksheet interface. Map rendering, measured geometry, species, calibrated lessons and `PLAN_VERSION` are unchanged.

## Next continuation

Publish this finished child branch once against PR #1282, preserve the core CI jobs, and record exact branch/SHA/PR evidence on issue #35. Run full current-head checks without moving their frozen tree. Inspect both worksheets at desktop and 390px phone widths, every draft/status/export position, reachable in-place help, keyboard focus and actual printed output. Recheck source fingerprints and normal 26-row CSV download. Keep the parent international release's account/storage and country/human/source gates open until their own evidence exists.
