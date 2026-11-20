# Readable place identity in provisional previews — 13 November 2026

- Auditor: Codex / Command Centre; branch `codex/provisional-export-place-label-20261113`.
- Base: `6b9de2c4b190dce1b9bce2a6f49d556374c0a868`, tree `b28e98a2968f378c7bf798130517bbde6a9e4502`, draft PR1368.
- Previous: [Tomato source](usda-tomato-nursery-codex.md), [Provisional report history](provisional-report-history-codex.md) and [Short-report rainfall](summary-rainfall-evidence-codex.md).
- Scope: current provisional preview's display metadata, parent handoff and printable HTML. No saved schema, original profile, geometry, crop arithmetic, source number, species or PLAN_VERSION change.

## Finding and correction

| ID | Reproduction | Disposition |
| --- | --- | --- |
| GLOBAL-PROVISIONAL-EXPORT-PLACE-LABEL-01 | Independent product-scope review found no readable site/workspace name in actual original previews. Two same-named beds cannot be distinguished by a person from a portable file using only an internal scope binding. | Carry a display-only name into the screen and captured preview, escape it in the printable header and explicitly label unnamed places. Include the supplied name in the existing context-generation binding so changes/round trips retire results and callbacks. |

Mapped names come from the existing current country-place resolution's matching place IDs, not the separate cover-name effect that can retain an older place name. Unmapped workspaces use the selected design's existing title/name. Matching aliases retain their readable names; no raw account/site/source identity or serialized fingerprint is used as a name. The existing actor/source freshness admission remains mandatory for calculation and delivery. A display label is not proof of geography or source applicability.

The preview captures its label with the calculated result and uses that captured value for export. Older callers with no label receive “Unnamed site or workspace”. Accepted historical-cycle exports are unchanged: this does not retrofit a current place name into a historical record or mutate stored profiles. It changes the picture of the current preview/HTML only.

## Verification

- Actual base mounted/exporter negative control has39tests:37pass and2intended failures at missing place header in direct builder and actual download. No import/setup failure is counted as a regression control.
- Existing consumer fixture gains the actual `SiteContextResolution.placeIds` field instead of its obsolete fictional unconfirmed shape; old scope/country/callback assertions remain. New parent checks execute the actual JSX expression, excluding another place and stale cover label while retaining the selected unmapped design title.
- New exporter checks keep two same-bed-name places distinct, HTML-escape a label and omit raw scope/account handles. Missing/blank names use an explicit fallback. The mounted UI executes actual downloads and verifies that a label change and round trip cannot revive a captured export; generic retained-callback coverage includes a renamed place.
- Ordered typecheck and306 affected checks across13 existing files pass, then whitespace passes. After blank-alias normalization, final ordered typecheck and49 parent/UI checks pass, followed by whitespace. Current-head full CI and independent source/output disposition remain separately required.
- Three real-builder original HTML files use identical source/date/arithmetic with North garden, River garden <east> & family and unnamed labels. Python HTML parsing confirms decoded names, escaped label content, unchanged conditional date and no raw scope handles. All three actual browser header screenshots were opened and full AX records checked. This is original-file rendering, not hosted app/native-download or print-pagination proof. The static server and test tab were closed; no heavy preview remains.

## Remaining work

Inspect and review the original generated HTML and actual screen metadata, bind final source and affected checks, push once and observe own required CI/security/preview. Retain all original global P01–P24 requirements, broader G03 evidence coverage and external Claude/AGY service-policy hold. No provider bypass, production merge or release is approved by this audit.
