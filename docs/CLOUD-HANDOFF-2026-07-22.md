# Cloud handoff: Reference Blueprint quality

## Objective

Continue the reversible Geometry Lock quality pass until every plan sheet approaches the committed
ChatGPT benchmark set in `design/benchmark/`. Geometry, feature identity, counts, labels and legend
content remain app-owned. AI may paint atmosphere and texture but must not invent, move, resize or
reinterpret saved design content.

## Branch and preview

- Branch: `codex/reference-blueprint-quality`
- Stable preview alias: `https://imbewufield-preview.vercel.app/design?lat=-29.78401&lon=30.74451`
- Last browser-verified deployed build before this checkpoint: `1e5c2d0`
- The current checkpoint contains an un-deployed Sector presentation pass (`v42`). Test and visually
  inspect it before promoting the preview alias.

## Completed and browser-verified

- Water, Planting and Structures use the hybrid path: AI-painted aerial atmosphere beneath exact
  deterministic geometry, routes, labels, boundary, scale, north arrow and editorial legend.
- Reusable painted assets exist for the main Water, Planting and Structures feature IDs.
- Structures proof included exact gate, compost bay, nursery table, chicken tractor and two hives.
- Geometry Lock remains reversible and Geometry Lock Off retains the legacy/model-authored path.

## Immediate work in progress

1. Finish and visually verify Sector `v42` against
   `design/benchmark/08_Carl_and_Sandys_Place_Sector_Analysis_Map.png`.
2. The prior Sector output was factually correct but visually weak: pale aerial, skinny marks,
   stacked numbered circles and generic line swatches. The checkpoint changes add a darker aerial,
   broader translucent sectors, short direct labels, sun symbols and vector legend icons while
   preserving exact bearings and provenance.
3. Run a real preview render, extract the generated image and inspect it at full sheet and phone
   size. Do not call it complete from tests alone.

## New explicit requirement

The user finds nearly every feature too small even when technically to scale. Add bounded
cartographic print emphasis across Water, Planting and Structures:

- Preserve saved centre, rotation, count and aspect ratio.
- Never enlarge house, property/zone polygons or route geometry.
- Enlarge small tanks, basins, fittings, trees, beds and structures only for the final illustration.
- Tree basins need particular attention.
- Use one deterministic threshold system and the same artwork in the legend.
- Verify at full sheet and phone reduction; a label must not be the only evidence a feature exists.

## Remaining sheets

Use `docs/REFERENCE-BLUEPRINT-REMAINING-LAYERS-AUDIT.md` and
`docs/HYBRID-ASSET-VISUAL-QA.md`. Work in this order after Sector:

1. Zones
2. Base
3. Whole / integrated masterplan
4. Phasing

The user particularly values the benchmark Sector, Water and Planting sheets. Keep all layers
visually consistent: dark illustrated aerial, restrained context, strong active systems, cream
editorial panel, deterministic labels and data-gated legend rows.

## Verification and safety

- Run `npm test`, `npx tsc --noEmit`, `npm run build` and `git diff --check`.
- Deploy the branch to Vercel, promote only the preview alias, then use the app's Refresh update
  control and confirm its build badge.
- Generate each target sheet in the actual deployed browser and inspect the saved output.
- Keep `main` and production untouched.
- Do not delete Gemini or legacy paths; all quality changes must remain switchable.


## 2026-07-23 Codex checkpoint

- Implemented bounded Planting print emphasis in the same deterministic pattern as Water and
  Structures: saved centres, rotations and aspect ratios are unchanged, while small planting
  symbols get a minimum printable short side and long mapped beds are capped to avoid changing
  their apparent footprint class.
- Wired the emphasis into both reusable artwork and fallback deterministic planting marks used by
  the Reference Blueprint renderer. Legacy/Gemini paths remain present and no production/main
  deployment was attempted.
- Sector v42 was inspected in code and remains the active plan cache version. The Codex cloud
  container could not complete preview deploy/browser verification because its agent internet
  access is disabled and it has no Vercel deployment access.
- Remaining gaps: deploy/promote the preview alias from an environment with Vercel access, use the
  app Refresh control, then generate and visually compare Sector, Water, Planting, Structures,
  Zones, Base, Whole and Phasing sheets at desktop and phone sizes against `design/benchmark/`.
