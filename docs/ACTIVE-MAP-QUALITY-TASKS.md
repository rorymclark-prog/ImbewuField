# Active Map Quality Task List

Last updated: 2026-07-23

Branch: `codex/reference-blueprint-quality`

Preview: `https://imbewufield-preview.vercel.app/design?lat=-29.78401&lon=30.74451`

Benchmark: `design/benchmark/`

## Refined goal

Deliver a reversible, production-ready eight-sheet plan set whose exported maps reach the factual
and visual standard of the committed ChatGPT benchmark set.

The farmer's saved boundary, house, driveway, ground, zones, routes, elements, names and counts are
authoritative. AI may improve aerial atmosphere, material texture and feature artwork, but it may
not invent, move, resize, rename, duplicate or reinterpret saved design content. The app owns
geometry, layer order, labels, leaders, legends, title blocks, scale bars and north arrows.

The goal is complete only when every sheet is generated from the deployed preview, compared with
its benchmark at full size and phone size, and passes the acceptance checks below. Passing tests
or looking correct in source code is not enough.

## Completion definition

- Geometry and content are exact: no deformed house, cropped roof, moved driveway, false route,
  phantom feature, missing saved feature or incorrect count.
- Each sheet is layer-specific: active systems are prominent, context recedes, and irrelevant
  features and legend rows are absent.
- The whole set has one visual language: illustrated aerial, readable feature artwork, restrained
  linework, cream editorial panel, clear labels, north arrow and scale.
- Small features remain identifiable after phone-size reduction without relying only on a label.
- Legends are deterministic, complete, sectioned where appropriate, and use the same symbols and
  route grammar as the map.
- The quality path remains switchable and the legacy/model-owned, Gemini and exact fallback paths
  remain recoverable.
- The editor can reliably place, select, duplicate, resize, rotate, relabel and remove the geometry
  needed to produce the sheets on both desktop and phone.
- `npm test`, `npx tsc --noEmit`, `npm run build` and `git diff --check` pass on the final commit.
- Only the preview alias is promoted during review. `main` and production stay untouched until
  Rory signs off.

## Already implemented - do not rebuild

- Reference Blueprint / Geometry Lock hybrid architecture with app-owned exact finishing.
- Exact protected house, driveway, boundary, route and feature geometry.
- Deterministic labels, leaders, legends, title blocks, north arrows and scale bars.
- Shared per-sheet filtering and semantic layer ordering.
- Reusable painted feature artwork for the main Water, Planting and Structures benchmark features.
- Solid blue clean-water routes, blue drip with restrained emitters, and solid purple greywater in
  the Reference Blueprint render.
- Nine-energy Sector model, real solar/wind inputs, driveway-access energy and terrace-fall arrows.
- Tree basins and ground systems render below tree canopies and placed features.
- Reference Blueprint feature emphasis that preserves saved centres, rotations and aspect ratios.
- Guided/Pro step ownership locking, working labels toggle, redo and selection duplication.
- Smaller editor handles, optional editor Icons layer, item angle field and line/item/zone desktop
  clipboard support.
- Climate-aware planting palette work: invasive/deprecated guava hidden, indigenous fruit options,
  and a renameable Other Tree.
- Manual Refresh update notifier, build badge and release-note mechanism.

## P0 - Required before any quality claim

- [x] Deploy the current branch checkpoint to the preview alias and confirm the build badge/hash.
- [ ] Use the in-app Refresh update control on desktop and mobile and verify the new build actually
  takes control. Add a regression test or stronger instrumentation if the prompt still fails to
  appear when a newer build exists.
- [ ] Generate fresh Reference Blueprint outputs from the deployed app. Do not judge cached gallery
  images made by older plan versions.
- [ ] Review each output at exported size and phone/gallery size beside the committed benchmark.
- [ ] Record a pass/fail screenshot and the exact build SHA for every sheet.

## P1 - Finish the eight sheets

### 01 Existing site / base

- [ ] Rebuild the panel into `EXISTING BUILT` and `GROUND & LEVELS` sections.
- [ ] Show saved patio/paving only when it exists; never infer it from the photo.
- [ ] Use saved terrace names and levels where available and add the short authority note.
- [ ] Verify house, driveway, ground hierarchy and terrace labels against benchmark sheet 01.

### 02 Sector analysis

- [ ] Generate and inspect the current hybrid Sector sheet in the deployed signed-in app.
- [ ] Match the benchmark's visual emphasis: large readable direct labels, broad translucent wind,
  rain and fire sectors, strong but uncluttered arrows, and visible slope/terrace-fall direction.
- [ ] Keep the nine rows data-gated and preserve measured/computed bearings and provenance.
- [ ] Add a local-observation workflow so a farmer can confirm or override the regional wind and
  fire approach for each property. Until then, named winds must remain visibly marked as regional
  assumptions and coordinate climate-grid means must remain diagnostic context only.
- [ ] Keep base fabric quiet; do not restore unrelated Base-map labels.
- [ ] Verify the numbered icon legend, footer note, title, north arrow and scale at phone size.

### 03 Zones

- [ ] Add one deterministic local callout per saved zone using a contained label point.
- [ ] Separate zone rows from quiet context rows such as driveway, saved ground and boundary.
- [ ] Ensure adjacent saved zones do not show distracting hairline seams in the export.
- [ ] Verify zone meaning remains access/management frequency, not elevation.

### 04 Water, greywater and irrigation

- [x] Re-generate after the latest route and feature-art changes and compare with benchmark sheet 03.
- [x] Confirm clean-water pipe is solid blue, greywater is solid purple, and drip is blue with fewer,
  restrained emitter dots on both map and legend.
- [x] Confirm tanks, basins, taps, pump/filter, diverter, pond and routes remain visible at phone size
  without white editor-style halos.
- [ ] Confirm tiny same-type route gaps are cleaned without joining pipe, drip and greywater to one
  another or inventing plumbing.
- [ ] Add or approve exact artwork for the important missing Water hardware listed below.

### 05 Planting and agroforestry

- [ ] Generate a fresh deployed Planting sheet and complete the paid/live acceptance test.
- [ ] Verify tree basin, tree canopy, groundcover, bed and strip stacking at every overlap.
- [ ] Check every label leader terminates on the feature it names and remains readable on phone.
- [ ] Verify planted artwork is prominent but does not change saved count, centre, rotation or class.
- [ ] Check the legend includes only saved, climate-suited features and no filler plants.

### 06 Structures and site infrastructure

- [ ] Generate a fresh deployed Structures sheet and compare with the benchmark.
- [ ] Verify gate, compost, nursery table, chicken tractor, hives and shade house are distinct,
  readable and correctly layered.
- [ ] Add a deterministic House / Existing Built row where the sheet contract requires it.
- [ ] Add or approve exact artwork for important missing structure and animal-facility IDs.

### 07 Whole design / integrated masterplan

- [ ] Re-check one-owner-per-mark stacking so ground stays below routes and features, basins stay
  below canopies, and no element is duplicated or hidden by a later layer.
- [ ] Ensure greywater, clean-water and drip all appear in the legend when present.
- [ ] Use stable sections: `SITE EDGE`, `WATER`, `PLANTING`, `INFRASTRUCTURE`; omit empty sections.
- [ ] Keep local callouts curated and leaders attached to the correct feature.
- [ ] Compare density and visual hierarchy with the benchmark integrated masterplan.

### 08 Implementation and phasing

- [ ] Verify the exact full design remains visible beneath phase pins.
- [ ] Check every emitted phase has a week range, tasks and hold point.
- [ ] Check Critical Order and Site Rules remain readable without shrinking type below the print
  threshold.
- [ ] Confirm no benchmark-specific phase is invented when the saved design does not emit it.

The app's canonical numbering remains `01` through `08`: Site, Sector, Zones, Water, Planting,
Structures, Whole and Phasing. Benchmark filenames are comparison references, not a reason to
create duplicate sheet numbers.

## P1 - Missing feature artwork

Create or approve factual, footprint-preserving artwork for the most visible missing IDs. Until an
asset exists, keep the deterministic fallback; never substitute a physically different object.

- Water/sanitation: rain barrel, dam, borehole, trough, first-flush filter, greywater outlet,
  biodigester, isolation/flush valve, pressure regulator and inspection point.
- Structures: shed, greenhouse tunnel, chicken coop, kraal, worm farm and market stall.
- Animal facilities: goat pen, pig pen, duck pond and rabbit hutch.
- Supporting infrastructure: feed/tool cabinet, bee-flight screen and hand-wash point.

## P2 - Editor workflow still incomplete

- [ ] Add CAD/Canva-style drag-marquee selection on desktop.
- [ ] Move a multi-selection as one group while preserving every member's relative geometry.
- [ ] Verify line duplication on phone: selecting a drip/pipe/greywater line and tapping Duplicate
  must create an editable offset copy.
- [ ] Add a clear mobile Copy/Paste affordance only if Duplicate does not cover the real workflow.
- [ ] Verify the smaller resize/rotate/edit/delete handles on phone and tablet.
- [ ] Confirm tapping an item's delete `X` while a placement tool is armed deletes the item and does
  not place another one.
- [ ] Verify the Icons toggle hides only editor glyphs, not real feature artwork or labels.
- [x] Make design-time route colours use the same grammar as exports. (a7ff660 — found and fixed a real live mismatch, not just a theoretical risk: editor swale was #4EA6D8, export was #258DBA.)
- [ ] Prevent the palette and bottom safe area from clipping the last elements on phone/tablet.
- [ ] Cap, paginate or thumbnail the saved-map gallery so many full-size images do not freeze
  semantic browser interaction or exhaust memory. `Clear all` must remove the intended gallery
  records and cached blobs.

## P2 - Deterministic geometry finishing

- [ ] Keep tiny same-type route-gap bridging render-only and tolerance-bounded.
- [ ] Add render-only antialiasing and restrained smoothing for shaky soft landscape lines.
- [ ] Add an explicit previewed and undoable `Tidy outline` design action; never silently rewrite
  saved geometry.
- [ ] Snap neighbouring zone edges only within a strict tolerance and never merge different zones.
- [x] Cut a measured boundary/fence break when a correctly placed Gate intersects it. (lib/boundary-geometry.ts, commit c8ec653 — needs a live render with a placed Gate to visually confirm, same as every other item on this list.)
- [ ] Cover false joins, excessive movement, overlapping zones and gate-away-from-boundary cases
  with tests.

## P3 - Product logic after the sheet set is accepted

- [ ] Deep-audit every catalog element across editor step, layer toggle, foreground/context sheet,
  prompt vocabulary, label and legend. Enforce the matrix in tests.
- [ ] Add a pre-render Water completeness review covering source, storage, treatment, main route,
  delivery and destination without inventing missing parts.
- [ ] Give Ask Lima structured design and location context so advice can consider current geometry,
  layers, climate, access, water and existing elements. Lima may propose, but never place, content.
- [ ] Fix cross-device design-state pull/sync so changes made in one browser appear in another
  without duplication.

## Evidence log

For every visual acceptance pass, record:

| Sheet | Build SHA | Desktop | Phone | Geometry/content | Visual benchmark | Notes |
|---|---|---|---|---|---|---|
| 01 Base | | Not checked | Not checked | Not checked | Not checked | |
| 02 Sector | 3205225 | Checked | Not checked | Pass | Partial | Exact sheet generated in deployed app. Property sun/slope/drainage/access are distinct; regional wind/fire are now labelled assumptions. Visual benchmark and local-observation workflow remain open. |
| 03 Zones | | Not checked | Not checked | Not checked | Not checked | |
| 04 Water | 43d8147 | Checked | Not checked | Pass | Partial | Fresh exact and hybrid sheets confirm solid blue pipe, restrained blue drip, solid purple greywater, correct feature counts, protected house geometry and no editor halos. Tanks and pond now read clearly, and paired saved tree canopies render above their basins. The hybrid atmosphere and deterministic legend are close to the benchmark; phone-size review and specialist hardware artwork remain open. |
| 05 Planting | | Not checked | Not checked | Not checked | Not checked | |
| 06 Structures | | Not checked | Not checked | Not checked | Not checked | |
| 07 Whole | | Not checked | Not checked | Not checked | Not checked | |
| 08 Phasing | | Not checked | Not checked | Not checked | Not checked | |
