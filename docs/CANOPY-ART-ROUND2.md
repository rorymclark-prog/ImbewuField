# Canopy art round 2 — Rory's review of the live batch

The v2 batch is live and the silhouettes work. Rory has looked at real sheets and wants four
specific changes. Same rules as `docs/CANOPY-ART-BRIEF-V2.md` — jagged lobed edges INSIDE the
frame (lobes 95–100% of radius, notches 72–85% and fully transparent), no basin/soil/shadow/ring,
1024×1024 RGBA (deliver at this size directly — 2048 was cut in half last time), top-down.

All files to `public/render-assets/reference-blueprint/`, keeping the exact names below.

## 1. `moringa-tree-v1.png` — redraw. Rory: "I don't like the moringa at all from top view"

The current one reads as a bare skeleton — radiating branches with sparse pinnate tufts, more
dead coral than tree. Keep it AIRY (that is what a moringa is) but it must read as a LIVING,
leafy crown: feathery pinnate foliage clusters along the branches, bright yellow-green (~77°),
branch structure visible THROUGH the leaves rather than instead of them. Think "delicate lace",
not "twigs".

## 2. `indigenous-shade-v1.png` — redraw as a FLAT UMBRELLA CROWN. Rory: "make the shade tree
like the natal flat crown"

The current drawing is a generic rounded mound. The classic South African shade tree — what a
farmer pictures at "indigenous shade tree" — is the flat-topped, umbrella-form crown (umbrella
thorn / paperbark form): a WIDE, SHALLOW disc of fine-textured foliage in distinct horizontal
tiers or plates, with visible gaps between the plates showing branch structure, and the whole
crown noticeably wider than it is dense. From above: several overlapping foliage plates, fine
leaf texture, deep sculptural notches between plates. Grey-green to mid-green (the regrade set
it at ~106°; stay in that region). This is the most-placed generic tree in the catalogue — it
carries the sheet.

## 3. `banana-basin-v1.png` — redraw to the tree standard. Rory: "redo banana circle to be
rendered like the trees"

This is the ONE canopy asset still from the old generation: painted soil ring, radial banana
leaves on a brown basin disc — exactly the look the whole v2 batch removed. Redraw: a RING of
5–7 banana plants seen from above (each a rosette of long paddle leaves, the v2
`banana-clump-v1` leaf language), arranged around an open centre. The centre pit shows as a
DARK VOID between the plants — shadow-dark green/black, NOT brown soil — because the renderer
supplies any ground treatment. Everything outside the leaves is alpha 0. The ring reads as
plants around a hole, never as a filled brown disc.

## 4. NEW: four staple-plot field textures. Rory: "the staple plots now to be rendered like
the trees"

The staple plots currently render as code-drawn crop-row glyphs. Give them the same illustrated
treatment as everything else — four SEAMLESS-TILEABLE square textures of crops in rows, drawn
top-down at the same painterly standard as the canopies:

| file | crop | reads as |
|---|---|---|
| `staple-maize-v1.png` | maize | parallel rows of tasselled maize plants, row gaps visible |
| `staple-beans-v1.png` | beans | lower, bushier rows, smaller leaf clusters |
| `staple-pumpkin-v1.png` | pumpkin | sprawling vines with big lobed leaves, sparser rows |
| `staple-mixed-v1.png` | mixed | maize rows with beans between — identity-neutral intercrop |

These four are DIFFERENT from the canopies in two ways: they are OPAQUE tiles (no transparency —
they get clipped to the plot polygon by the renderer), and they must TILE seamlessly left-right
and top-bottom (the renderer repeats them across plots bigger than one tile). Row direction
horizontal in the tile. 1024×1024 RGB or RGBA-opaque. Distinct at 96px: maize reads taller/
striped, pumpkin reads blobby, beans read fine-textured.

## Self-check

Per redraw (1–3): the radial alpha profile + non-green fraction from the v2 brief.
Per tile (4): confirm seamless tiling by showing a 2×2 repeat, and paste mean hue/sat/val — the
four must be tellable apart in greyscale (value differences), not just by hue.

Do not edit any code. Commit on the current branch when the self-check passes.
