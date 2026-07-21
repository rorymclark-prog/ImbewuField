# Reference Blueprint quality audit

## Target

The eight Carl and Sandy benchmark maps in `design/benchmark/` define the visual and factual target:

- north-up plan view, never oblique;
- one clear subject per sheet;
- the saved boundary, house, driveway, lines, zones and placed items remain authoritative;
- leaders, labels, legend, title, scale and north arrow are readable and deterministic;
- the image model may improve texture, but may not invent, move, rename or count features.

## Architecture decision

`Reference Blueprint` is now the recommended app-owned mode. Its render order is:

1. illustrated or satellite ground;
2. exact ground polygons from the saved design;
3. source-derived house and driveway clipped to their traced polygons;
4. exact per-sheet features, routes and boundary;
5. deterministic leaders, labels, legend, title, scale and north arrow.

This order prevents AI house deformation without hiding real water or infrastructure marks that cross a roof or driveway.

`Satellite Overlay` remains available as the explicit model-owned comparison and rollback mode. The queue rejects any job that tries to enable model-owned chrome and app-owned Geometry Lock at the same time. Legacy Gemini and earlier exact builders remain in the codebase, dormant and recoverable.

## What this slice fixes

- One shared render policy now controls the UI, queued job flags and finishing path.
- Reference Blueprint is exact by default; editor glyphs and emoji are excluded from model inputs and exports.
- All five design sheets use one shared exact composer instead of independent drifting implementations.
- House and driveway use the traced source geometry on every exact sheet.
- Zones, water, greywater, planting, structures and whole-design content are filtered per sheet.
- Water route styles are shared by map and legend, including greywater.
- Legends use canonical saved element definitions and counts, wrap instead of truncate, and do not copy free-form editor labels into the export.
- The sample farm includes a deliberately difficult concave house and closed driveway as a geometry regression fixture.

## Verification completed

- TypeScript check passes.
- Full automated suite passes: 132 tests.
- Production build passes.
- Browser verification passes for Structures, Water and Whole sheets using the sample geometry fixture.
- Browser console is clean after a production-build restart.
- Production and `main` have not been changed by this branch.

## Remaining acceptance test

No paid OpenAI render was run locally. Before promotion, deploy this branch to a preview and generate at least Water and Planting for Carl and Sandy with Reference Blueprint selected. Accept only if:

- house and driveway match the traced polygons;
- every displayed feature exists in the saved sheet layer;
- counts and names match the deterministic legend;
- no editor emoji or duplicated labels appear;
- the full legend and all leaders are readable on desktop and phone;
- comparison against the benchmark maps is materially better than the current production result.

If the preview fails, production remains unchanged and users can switch back to Satellite Overlay while the exact pipeline is refined.
