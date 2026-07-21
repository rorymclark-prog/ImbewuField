# Sector (02): AI-renderable + reference-legend-matching — implementation plan

Rory: "the sector map must also use ai and ai legend etc must mactch the one o gave you." Produced
by a research+design workflow against the shipped code, `docs/SECTOR-MODEL-SPEC-2026-07-21.md` and
`design/benchmark/08_Carl_and_Sandys_Place_Sector_Analysis_Map.png`. Part A implemented in this
session (commit follows this doc). Part B (the 9-energy model + numbered legend) is staged behind
`docs/SECTOR-MODEL-SPEC-2026-07-21.md` and the terracing spec — see status note at the bottom.

## Architecture, in one sentence

The AI renders only the decorative ground/paper texture of the base; 100% of the sector sheet —
house, driveway, boundary, ground labels, compass ring, sun/wind/fire/water/frost geometry, legend
panel, title block, scale bar and north arrow — is drawn afterward by our own deterministic
`drawSectorAnalysis`/Blueprint code on top, so the legend matches the reference *because we draw
it* and misregistration is impossible for everything except a texture that carries no geometry.

This is the same "AI paints the background, the browser composites exact vector chrome on top"
model the mature Geometry Lock already uses (`buildLockedIllustrationPrompt` +
`compositeAccurateMap`). The machinery existed but was pointed at the wrong target for Sector:
`finishSectorSheet` used to composite *only* the chrome-only overlay (`buildSectorOverlayImage`,
arrows+ring) and trust the model to depict the house/boundary/driveway — the trust commit
`967c345` found broken (the model reframes those features; the arrows stayed at true frame
coordinates; the boundary ended up through the house).

## The registration guarantee

All chrome draws onto a canvas of `W = frame.imgW*SCALE, H = frame.imgH*SCALE`, one coordinate
system derived entirely from `frame` + `refLayers` + `site` — the identical inputs and draw calls
the exact sheet already used. The AI image draws once as `ctx.drawImage(model, 0, 0, W, H)`
*underneath* that chrome; nothing is ever read back from it. So:

- Our vector house, driveway and boundary are mutually consistent (same `px/py` mapping) — the
  boundary can never cut through *our* house.
- The arrows/ring/arcs sit at the boundary centroid in the same frame as the boundary we draw, so
  they line up with the ground features *we* draw, not with whatever the model painted.
- The AI base carries no feature anything must align to. Worst case if the model shifts/rescales
  its depicted house is faint double-imaging of a roof under our authoritative overlay — never a
  geometric contradiction, never a wrong bearing.

Enforced by construction: `finishSectorSheet` and `buildBlueprintSectorMap` both funnel through one
`composeSectorSheet(baseImage, state, frame, refLayers, site, placeName)`, differing only in
whether `baseImage` is the AI image or `null` (satellite+paper base). Same draw list either way —
exact and AI sheets are pixel-identical except base texture, and the legend is identical by
construction.

## What the AI is told not to draw

`buildSectorRestylePrompt` in `lib/producer-prompt.ts`. `noAnalysis` already forbids arrows, arcs,
wedges, compass letters, bearing text, legend, title block, north arrow, scale bar, lettering —
kept as-is. Removed the geometry-preservation promises (`keepExact` used to say "preserve the
boundary/every roof/driveway in exactly their photographed shape, position and scale" — a promise
the model can't keep and correctness no longer depends on). Buildings are now asked for as low-key
ground texture only, since the app stamps the true house/driveway/boundary on top.

## Two deliberate deviations from the reference — DECIDED (Rory, 2026-07-21), not open any more

Flagged in `design/benchmark/README.md`, repeated here so they don't get silently overridden:
- Boundary stays the app's bone post-and-wire fence, not the reference's green tick-line (copying
  it regresses the "phantom hedge" fix).
- Sector stays numbered **02** in this app's plan set, not the reference's **08** (nobody asked to
  renumber the whole set).

## Status

**Part A — AI-renderable Sector, safe compositing: CODE DONE, image NOT yet visually verified.**
`composeSectorSheet` extracted, `finishSectorSheet` rewritten to composite the full deterministic
sheet over the model image, prompt reworked (no more promising the model geometry it can't hold),
the three UI gates un-gated, `PLAN_VERSION` bumped to v11, tests updated (2 new, 88/88 passing).
`tsc --noEmit`, `npm test` and `npm run build` all clean. The **exact** path was re-rendered in the
browser against the seeded Outer West Durban test site and is pixel-identical to before the
refactor — the compositor split didn't regress it.

**What is NOT yet verified: the actual AI-composited image.** `enqueueRenderJob` requires a signed-
in Firebase user (`lib/render-jobs.ts:120`), and the automated browser session used to build this
had none — clicking "Generate this sheet" on Sector → AI → Precision Atlas reached the real enqueue
call and was correctly refused with "You need to be signed in to generate AI sheets," proving the
whole client-side path is wired up to the real call, but no gpt-image-2 image has actually come
back through `finishSectorSheet` yet. The specific things the risk section above flags — a bold
model-drawn house ghosting under the vector overlay, the base looking too painterly for a "facts"
sheet — can only be judged by looking at a real render. **First live test is still needed**: open
Sector → AI → pick a style (Precision Atlas recommended) → Generate, on a real signed-in account.

**Part B — legend rebuilt to the reference's 9 named energies: NOT started.** Requires expanding
`SectorModel` per `docs/SECTOR-MODEL-SPEC-2026-07-21.md` (solar module, regional wind table, 4 named
wind sectors, grassfire re-derived from berg not winter wind) **plus** two energies not in that spec
yet — driveway-access and terrace-fall — which are being scoped together with the terracing/
earthworks work (separate workflow, in flight as of this doc). Sequencing Part B after that lands
avoids building the sector model twice. The legend *panel styling* (numbered rows, per-row icon,
"SECTOR LEGEND" heading, reference footer sentence) can land against today's 6-energy model as an
interim step without waiting — tracked as a follow-up, not done here.
