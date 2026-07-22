# Render Geometry Cleanup: Future Session

These are deliberate follow-ups, not hidden changes to saved farmer drawings. Geometry Lock remains
authoritative and every cleanup needs an explicit tolerance, a before/after preview, and an undoable
design-time option before it may rewrite source geometry.

## Render-only polish

- Keep the existing tiny-gap bridge for nearly aligned routes of the same type. Never connect pipe,
  drip and greywater to one another, and never bridge a large or ambiguous gap.
- Smooth visibly shaky polygon and line segments only in the exported illustration. Preserve every
  stored vertex and keep corners that communicate a real boundary, building or terrace break.
- Add restrained corner joining and antialiasing so exact polygons read as one clean plan shape.

## Optional design cleanup

- Offer `Tidy outline` as an explicit previewed action, with undo, rather than silently changing a
  farmer's polygon.
- Snap neighbouring Zone edges to one shared edge within a small screen/ground tolerance; fill only
  proven micro-gaps and never overlap, reorder or invent a zone.
- Let a placed driveway gate create a measured break in the rendered fence/boundary line. The gate
  must be close to that line and the break must use the gate's actual width and orientation.
- Make design-time route colours match the plan grammar: water/irrigation pipe blue, drip blue with
  emitter marks, and filtered greywater purple dashed.

## Product and layer audit

- Deep-audit which editor step owns each catalog element, which sheets foreground it, which sheets
  show it as quiet context, and which legends include it. Keep one shared source of truth.
- Give Lima the current map state, visible layer, saved elements, routes, site coordinates and local
  evidence so questions such as rabbit suitability can consider the actual design and location.
- Keep advice evidence-based: Lima may recommend options and placement constraints, but must not add
  an element to the drawing without the farmer choosing and placing it.
