# Canopy art round 3 — wild plum, and the staple tiles gone strictly top-down

Two items, same rules as `docs/CANOPY-ART-BRIEF-V2.md` (jagged lobed edges inside the frame,
alpha-0 outside the subject, 1024×1024, deliver to `public/render-assets/reference-blueprint/`).

## 1. `wild-plum-v1.png` — redraw. The starfish problem.

Rory cropped into it on a live sheet. The current drawing is eight discrete leaf-blobs on the
ends of eight radiating bare branches — it reads as a starfish or a wheel, not a tree. Same
failure class as the old moringa skeleton, opposite cause: the crown is TOO clustered instead of
too sparse.

Redraw as a CONTINUOUS rounded crown: fine leaves massed over the whole canopy, branch structure
only GLIMPSED through small gaps (not the organising skeleton of the picture), deep irregular
notches at the rim per the v2 edge rules. Mid green, fine texture. It must not decompose into
countable blobs at 200px.

## 2. The four staple tiles — STRICT top-down. Rory: "staple crops must be top view"

The delivered tiles read partly side-on (maize with visible vertical stalks/tassels drawn in
elevation). Redraw all four as TRUE PLAN VIEW — what a drone sees at noon:

- `staple-maize-v1.png` — maize from directly above: rosettes of long strap leaves radiating
  from a centre point, in rows; tassel a small pale dot at the centre of some plants. NO vertical
  stalks, NO horizon logic.
- `staple-beans-v1.png` — rows of small rounded trifoliate mounds.
- `staple-pumpkin-v1.png` — sprawling vines: big round lobed leaves scattered along runners that
  wander between rows.
- `staple-mixed-v1.png` — maize rows with bean mounds between, both as above.

KEEP: opaque, seamless-tileable both axes (edge delta was 0.0 — hold that), rows horizontal in
tile space, distinct at 96px. The renderer now ROTATES the tile to each plot's contour axis, so
row direction consistency matters more than before.

Self-check: 2×2 repeat, per-tile mean hue/sat/val, and confirm by looking at 96px that maize
reads as radiating rosettes, not stalks.

Do not edit any code. Commit on this branch when done.
