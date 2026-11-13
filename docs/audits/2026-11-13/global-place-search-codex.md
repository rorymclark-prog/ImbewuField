# Worldwide place-search entry — 13 November 2026

- Writer: Codex; branch `codex/global-place-search-20261113`.
- Base: `20785936060f6157a57ca2a6da7a493780ef4405`, stacked on PR1360.
- Previous: [Nursery reference](usda-cabbage-nursery-reference-codex.md), [global app integration](provisional-cycle-app-exports-codex.md) and [actor-bound saves](saved-place-actor-guard-codex.md).
- Scope: G01/G04 entry to the existing global planner through the actual farm map. Existing soil, report, quick-save and sourced planner closures remain separate and retained.

## Reproduced gap and implementation

`GLOBAL-PLACE-SEARCH-01`: coordinates and map panning already worked globally, but every place-name path imposed ZA or neighbouring-country bounds. The map now offers an explicit South Africa/Worldwide selector, defaulting to the existing SA mode. Worldwide uses the configured Mapbox v5 provider, without country/proximity filters. Results offer a temporary area preview; the grower taps an exact farm point and separately confirms the country. Search language is not site country, catalogue permission or local farming evidence.

The helper validates provider positions without converting missing or malformed coordinates to zero. Genuine zero is retained. Submitted lookups explicitly disable prefix autocomplete; suggestions retain their existing debounced autocomplete behavior. Both use supported v5 place/address types, without the removed POI type. Abort controllers and query/scope epochs retire old replies and retained choices, including scope round trips. Missing token, empty responses and failures retain a coordinate-entry path and never request South Africa as a global workaround.

`PLACE-TEMP-CENTER-WRITES-01` and `PLACE-PREVIEW-CAPTURE-CONTEXT-01`: independent Codex preflight found that preview-only selection did not cover existing water/infrastructure reticle writes or capturing a new area against an old selected farm. Those paths now require an independent farm selection. Reticle draw start/corner follows the same guard. Selection stops the lookup flight and jumps to the independently chosen point before releasing the guard, so a subsequent reticle write cannot reuse the old provider centre. Sharing is held during a preview and uses the own selected/saved point afterward. No saved geometry is rewritten.

Fresh Mapbox results in both scopes remain component-memory previews: no new recents, saved site, confirmed country or shared camera coordinates are taken directly from a lookup result. Existing SA submitted Nominatim behavior and historical recents remain available. Existing historical records are not silently removed or reclassified.

## Source and provider boundary

Official Mapbox v5 documentation and linked October2026 Product Terms section2.7 were read, alongside the public Nominatim policy. Temporary geocodes position the current-session map; they are not newly exported/stored as site data. No permanent endpoint, new credentials, paid mode, provider migration or account-specific licence approval is implied. Public Nominatim is not extended to worldwide search or autocomplete. Its existing SA request/rate/switchability limitations and untagged historical recents are retained limitations, not claims of new compliance.

- https://docs.mapbox.com/api/search/geocoding-v5/
- https://www.mapbox.com/legal/product-terms
- https://operations.osmfoundation.org/policies/nominatim/

## Verification

- Typecheck exited0 before the final affected suite. An initial test-harness narrowing error was corrected before that pass; it was not a product defect.
-934/934 affected tests across41files passed, zero failures/cancellations/skips/todo. Includes the complete existing18-file render suite, actual extracted search/share/drop/capture callbacks, saved places, map sync, country boundaries and provisional planning. The nine new cases are imported by the existing full-CI map test entry point; no workflow/package script was changed.
- Parent negative control fails because the actual old handler performs four SA fallback requests instead of one worldwide lookup. Two source mutants independently fail for unguarded preview writes and retaining the provider camera after own selection. These use read-only alternate source files, with no live provider calls or account writes.
- Phone390×844 and desktop1280×900 browser checks use the actual search JSX and callbacks with synthetic provider/camera/account seams and surrounding CSS. This verifies the affected controls and wrapping, not a full WebGL/account integration or real provider response. Original screenshots and synthetic request assertions are retained in the owner packet.
- Whitespace and release-note drift checks pass. Exact candidate review, current-head full CI/security/render checks and hosted preview remain successor gates, not inherited passes.

This changes the displayed picture. No farming values, species names, lesson bodies, saved schemas, existing sowings, account/paid gates or PLAN_VERSION are changed. English controls are explicitly language-labelled; no independent translation or agricultural suitability claim is made. Claude/AGY routes remain held under the existing service-policy boundary, with no retry or alternative credential route. Codex preflight is identified as Codex, not either held reviewer.

## Next continuation

Complete the exact candidate/output review, push the finished branch once, inspect its preview and read its own CI. Preserve G01–G05 and all original P01–P24 requirements; worldwide map entry does not complete the global-planning objective or replace local source evidence. Do not release until applicable gates pass.
