# Dead-code sweep — 2026-08-01

Report only. No export was deleted.

## Unimported `buildBlueprint*` exports

The following exports in `components/design/DesignGlossy.tsx` have no remaining importer or call
outside their own definition:

- `buildBlueprintZoneMapLegacy`
- `buildBlueprintWaterMapLegacy`
- `buildBlueprintWaterMapLegacyExact`
- `buildBlueprintPlantingMapLegacy`
- `buildBlueprintStructuresMapLegacy`
- `buildBlueprintWholeMap`

The five `*Legacy` functions are explicitly retained rollback/visual-comparison paths in nearby
comments and need owner confirmation before removal. `buildBlueprintWholeMap` is a thin whole-filter
wrapper with no live caller; current exact rendering passes the filter into
`buildReferenceBlueprintMap` directly. It is included in the owner-review list rather than
deleted because this queue is report-first.

The queue's shorthand list is otherwise stale: `buildBlueprintZoneMap`, `buildBlueprintWaterMap`,
`buildBlueprintPlantingMap`, and `buildBlueprintStructuresMap` are still imported and called by
`components/design/DesignPrint.tsx`; `buildBlueprintEarthworksMap` is also live there. They are
not dead exports in this checkout.
