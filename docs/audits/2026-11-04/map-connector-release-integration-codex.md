# Map release after connector integration — 4 November 2026

- Auditor is Codex.
- Released base is main f6a170245, the connector merge. Production served 2c4100b when integration began.
- Previous records are [Existing Site symbols](../2026-11-03/existing-site-symbol-key-codex.md), [Zone coverage](../2026-11-03/zone-photo-coverage-codex.md) and the separate Water budget review.
- Scope covers resolving the three map branches against the released connector and verifying their release candidates.

## Findings and disposition

| ID | Status | Evidence |
| --- | --- | --- |
| AI-MAP-046/050 | Existing Site integrated | The release-note conflict retained the connector notices and tour and the map notice. The reviewed Site compositor is byte-identical to c230e26. Its label symbols, named default and optional numbered key remain. |
| AI-MAP-056/057/058 | Zone integrated over Site | Keep the registered photo matte, saved polygons and both Zone 2 badges, matching quiet boundary key and evidence-scoped Zone 0 name. |
| AI-MAP-059/060 | Water integrated over Zones | Preserve the common primary-roof budget and prominent facts. The painted duplicate pipe stays under review. |

## Verification

- Integrated Site candidate passed typecheck, 635 focused checks, 55 typography, Sector and release checks, and whitespace. Its renderer is identical to the visually reviewed source.
- Integrated Zones passed typecheck, 638 focused checks and 55 typography, Sector and release checks. The exact and saved-art outputs were rendered again with identical source scenes. The boundary-order test now executes the painter across all six layers. The old test treated the first Zones conditional as feature painting and incorrectly rejected the new boundary treatment.
- Integrated Water passed typecheck, 638 focused checks and 122 affected Water, typography, Sector and release checks. Site, Zone and Water exports were recomposed from the saved owner scenes. No provider request was made.
- Each candidate requires current-head rules and focused-render, preview and actual export inspection. Water additionally requires the full suite because it changes published water calculations.
- Candidate and terminal deployment evidence belongs to the PR and issue #35. PLAN_VERSION stays unchanged.

## Next continuation

Integrate and release Site, Zones and Water in order. Retain the connector implementation and its release notices. Inspect the actual live exports and preserve the Water review marker.
