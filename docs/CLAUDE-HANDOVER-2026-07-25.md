# ImbewuField map-quality handover

## Start here

- Repository: `/Users/roryclark/ImbewuField`
- Working branch: `codex/reference-blueprint-quality`
- Production: `https://imbewufield.vercel.app`
- Benchmark set: `/Users/roryclark/Downloads/deliverables/Carl_and_Sandys_Place_Permaculture_Design_Map_Set/`
- Confirm the deployed commit at `https://imbewufield.vercel.app/api/build-info` before judging a result.
- Read `docs/PLAN-SET-SPEC.md`, `docs/RENDER-INVESTIGATION.md`, and `docs/GLOSSY-PROMPT-AUDIT.md`.

Do not start by redesigning the renderer. The current Reference Blueprint pipeline has strong
geometry accuracy and is the foundation to preserve.

## Product contract: three outputs on every sheet

Every one of the eight sheet selectors (Site, Sector, Zones, Water, Planting, Structures, Whole,
and Phasing) must expose these three deliberately different results. They must be presented as
three clear choices, not hidden behind style cards or ambiguous one/two-step buttons:

1. **Exact Canvas**: satellite plus exact app-owned geometry and symbols. Deterministic and free.
2. **Geometry-Locked Hybrid**: a model-painted/illustrated underlayer, with the app's polished
   exact elements, routes, labels, leaders, legend, north arrow, and scale composited above it.
   Saved source geometry is never changed.
3. **Full Treatment**: first build the Geometry-Locked Hybrid, then submit that complete hybrid
   sheet for one paid, sheet-specific AI polish pass. The final pass may improve materials,
   realism, typography, and editorial finish, but must not invent, move, remove, resize, recount,
   or relabel factual content.

The acceptance matrix is **8 sheets x 3 outputs = 24 working paths**. Do not call this complete
until every path is tested. Style choice is independent of output choice: changing style must not
silently downgrade Full Treatment to Hybrid or Exact Canvas.

Never call a deterministic or hybrid sheet “AI polished”. New Saved Maps rows persist
`resultKind`, `provider`, `geometryLock`, and `showcase`; labels are not provenance.

### Current truth about the three paths

- Exact Canvas is mature and reliable.
- Geometry-Locked Hybrid exists in older producer/composited paths, but is not yet exposed as a
  clear, consistent choice for all eight sheets.
- The current paid one-button path generally supplies an exact finished sheet to GPT Image. It
  does **not yet prove the required Hybrid -> paid AI second-pass chain on all eight sheets**.
- Recent Water results labelled `Master Atlas` looked very similar to the deterministic hybrid.
  Treat that as an unresolved provenance/output-validation bug until raw provider output and
  durable metadata prove otherwise.
- Sector paid polish has also been inconsistent or unavailable depending on selected style/path.
- Therefore the 24-path matrix is the first implementation and verification priority.

## Non-negotiable safety rules

- Do not mutate saved item, line, zone, house, driveway, or boundary geometry during rendering.
- Presentation zoom must remap coordinates and `mPerPx` together in temporary render state only.
- Houses, driveways, boundaries, tanks, beds, routes, and counts come from saved design data.
- Do not invent features, climate facts, slope direction, wind evidence, species, or labels.
- Sector slope is shown only when local DEM evidence passes its confidence gate.
- Keep Gemini and legacy code dormant and recoverable; do not delete rollback paths.
- Preserve the exact no-AI master separately from every paid result.
- Test and build before deployment. Explicitly assign the production alias only after verification.

## What is working

- Reference Blueprint exact geometry, source-pixel protection, deterministic labels and legends.
- Water route semantics: buried pipe blue, drip blue with sparse emitters, greywater purple.
- Water route tiny-gap bridging is render-only, same-type only, and does not change the canvas.
- Tree basins paint below tree canopies.
- Climate palette excludes guava and unsuitable temperate fruit; generic renameable tree exists.
- Sector evidence separates regional assumptions from property-specific data.
- Paid Sector and design polish send the complete exact sheet to GPT Image.
- One-button flow saves an exact master first, then queues the paid polish.
- Saved Maps are durable in IndexedDB.
- Compact property framing now uses a presentation-only crop instead of the old 24% minimum.
- Saved Map thumbnails open the full-screen viewer directly.
- Contextual Learn links are mounted in the main app shell and Design Studio header.

## Highest-priority remaining work

### 1. Implement and verify the 8 x 3 output matrix

- Add a simple **Choose output** control for every selected sheet:
  `Exact Canvas`, `Geometry-Locked Hybrid`, `Full Treatment`.
- Keep style selection separate and available for Hybrid and Full Treatment.
- Route all eight sheet types through one shared output-mode contract rather than sheet-specific
  ad-hoc conditions.
- Full Treatment must consume the newly built hybrid sheet, not quietly reuse the exact canvas.
- Preserve the exact and hybrid intermediates separately; save the paid result as a third item.
- Persist honest provenance for every result (`resultKind`, provider, Geometry Lock, input/result
  relationship, sheet, style, and timestamp).
- Add automated routing tests for all 24 combinations and browser-test at least Water, Planting,
  Sector, and Whole in production.

### 2. Verify paid polish visually and honestly

- Generate one Water and one Sector paid result in production.
- Confirm the gallery badge says `Paid AI-polished result` and provider `gpt-image-2`.
- Confirm it is visibly model-authored, not the deterministic hybrid renamed.
- Confirm the exact master remains a separate Saved Map.
- If output remains too similar, adjust the full-sheet polish prompt, not geometry restoration.

### 3. Finish non-AI and hybrid symbol quality

- Tanks must be solid, separated, saturated blue, with no white/grey sticker halo.
- Replace any tap symbol resembling a computer monitor with a literal outdoor tap.
- Keep technical routes clean and bold; no green drip.
- Enlarge tiny map symbols only as bounded print emphasis, never by changing saved dimensions.
- Use larger pictorial legend swatches, condensed cartographic headings, and useful factual notes.

### 4. Layer-by-layer benchmark pass

- **Water**: compare directly with `03_Carl_and_Sandys_Place_Water_Greywater_and_Irrigation_Plan.png`.
- **Planting**: verify exact counts, bed dimensions, tree canopy/basin stacking, leaders, and legend.
- **Structures**: literal compost bay, beehives, chicken tractor, shade house, nursery table, gate.
- **Sector**: quiet the base, avoid label collisions, use broad benchmark arrows and rain texture,
  and show local slope only from trustworthy DEM evidence.
- **Zones/Base/Whole/Phasing**: apply the same hierarchy, typography, and provenance rules.

### 5. Editor follow-up, not part of render geometry

- Smaller mobile control handles and optional element-icon visibility.
- Duplicate/copy for lines such as drip runs.
- Drag-rectangle multi-select and group move.
- Angle field for linear/rectangular elements.
- Render-only polygon smoothing, shared-edge snapping, tiny route-gap cleanup, and gate breaks in
  boundary/fence lines. Never silently rewrite the saved drawing.
- Audit which elements belong to each wizard step and plan-sheet layer.
- Give Lima current drawing, layer, location, climate, and placed-element context before advice.

## Important files

- `components/design/DesignGlossy.tsx`: sheet builders, queue orchestration, gallery UI.
- `lib/reference-presentation.ts`: presentation-only compact-site crop.
- `lib/sheet-store.ts`: durable Saved Map data and provenance.
- `lib/render-policy.ts`: exact/model ownership and Geometry Lock policy.
- `lib/image-producer.ts`: masks and protected-pixel restoration.
- `lib/producer-prompt.ts`: hybrid and full-sheet polish prompts.
- `lib/water-cartography.ts`: route grammar, visual bridges, Water legend.
- `lib/planting-cartography.ts`: Planting legend and bounded print emphasis.
- `lib/sector-cartography.ts`, `lib/sector.ts`, `lib/elevation.ts`: evidence-backed Sector output.
- `lib/glossy-filters.ts`: sheet ownership and paint stacking.
- `lib/cartographic-water-symbols.ts`, `lib/reference-feature-art.ts`: deterministic symbols/art.

## Verification

Run:

```bash
npm test
npm run build
```

Then deploy the pushed branch through the existing Vercel project, assign
`imbewufield.vercel.app` to that exact deployment, and verify:

```text
https://imbewufield.vercel.app/api/build-info
```

Do not assume a Vercel deployment reached the main domain. The visible Build badge and the
`/api/build-info` SHA must match the pushed branch tip.

For the output contract, keep a visible checklist:

| Sheet | Exact Canvas | Hybrid | Full Treatment |
|---|---:|---:|---:|
| Site | test | test | test |
| Sector | test | test | test |
| Zones | test | test | test |
| Water | test | test | test |
| Planting | test | test | test |
| Structures | test | test | test |
| Whole | test | test | test |
| Phasing | test | test | test |

Passing means the selected mode actually ran, provenance is correct, geometry/counts remain exact,
and the style did not silently change the output mode.

## Uncommitted checkpoint at handoff time

Branch tip before the latest local edits was `b330da3` (`Polish map output and add contextual
learning`). The following local work was intentionally left in the worktree and must not be
discarded:

- presentation-only compact-property framing in `lib/reference-presentation.ts`
- tests in `tests/reference-presentation.test.ts` and the `package.json` test list
- durable Saved Map provenance and direct fullscreen opening changes in
  `components/design/DesignGlossy.tsx`
- provenance fields in `lib/sheet-store.ts`
- this handover document

At this checkpoint the complete test suite passed **187 tests**, the production build passed, and
`git diff --check` passed. Review and commit these files before starting the three-output refactor.

## Visual evidence and benchmark files

- Primary benchmark folder:
  `/Users/roryclark/Downloads/deliverables/Carl_and_Sandys_Place_Permaculture_Design_Map_Set/`
- Water benchmark:
  `03_Carl_and_Sandys_Place_Water_Greywater_and_Irrigation_Plan.png`
- Sector benchmark:
  `08_Carl_and_Sandys_Place_Sector_Analysis_Map.png`
- Recent compact-site framing problem:
  `/var/folders/32/mhw6rws97s1dd9p4ysmkjd040000gn/T/codex-clipboard-090a4ddd-7370-4488-8088-6694da15378d.png`
- Recent Water result that may be hybrid rather than true paid polish:
  `/var/folders/32/mhw6rws97s1dd9p4ysmkjd040000gn/T/codex-clipboard-9ccc76e9-dd1d-4da8-8cc1-0cc7d2c5321d.png`
- Latest user-approved direction, with remaining halo/legend/type issues:
  `/var/folders/32/mhw6rws97s1dd9p4ysmkjd040000gn/T/codex-clipboard-81c85d96-4564-4e6c-811e-47b9db26f5e4.png`

## Current user expectation

The visual benchmark is a polished professional cartographic plan set, not merely accurate
technical overlays. Accuracy is now promising; the remaining work is stronger material realism,
symbol quality, visual hierarchy, typography, and layer-specific editorial judgment without losing
the exact geometry. The user is willing to accept occasional AI typography variation, but not
invented features, moved geometry, wrong counts, or misleading provenance.
