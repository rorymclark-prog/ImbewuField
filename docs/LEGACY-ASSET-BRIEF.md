# Legacy asset sweep — the last nineteen old-generation drawings

Every canopy, staple tile, veg sprite and tank on the plan is now v2 or newer. These nineteen
are the last drawings from the FIRST generation, and they show it: 160–582 px (the new work is
512–1024), painted ground baked into the image, and a lighting treatment that no longer matches
anything beside them on a sheet.

Read `docs/CANOPY-ART-BRIEF-V2.md` for the standard. The rules are unchanged and non-negotiable:
**RGBA, all four corners alpha 0, nothing but the subject above alpha 0 — no painted soil,
shadow, backing disc or ground of any kind** (the renderer supplies ground), one shared light
direction across the whole batch, and it must read at 24 px.

Deliver at **512×512** unless the table says otherwise. Same filenames — the union type in
`lib/reference-feature-art.ts` is keyed to them and renaming means code churn for nothing.

## The batch

### Structures — oblique ¾ view
| file | current | subject |
|---|---|---|
| `compost-bay-v1.png` | 473×306 | Three-bay timber compost run, one bay full, one turning, one empty |
| `beehive-v1.png` | 160×284 | Langstroth hive on a stand, lid slightly proud |
| `chicken-tractor-v1.png` | 520×333 | A-frame mobile coop with mesh run and wheels |
| `nursery-table-v1.png` | 471×301 | Waist-high bench of seedling trays under shadecloth |
| `shade-house-v1.png` | 416×344 | Shadecloth structure over a timber frame, sides visible |
| `driveway-gate-v1.png` | 454×239 | Farm gate between two posts, one leaf ajar |

### Water hardware — oblique ¾ view (600×600 where round)
| file | current | subject |
|---|---|---|
| `pond-small-v1.png` | 415×415 | Small lined pond, water surface, planted margin — **no surrounding soil ring** |
| `greywater-basin-v1.png` | 410×411 | Mulch-filled soakaway basin with an inlet — the mulch IS the subject, the ground is not |
| `tree-basin-v1.png` | 407×410 | Ring berm around a young tree, mulch inside |
| `tap-point-v1.png` | 208×229 | Standpipe tap on a riser, small hardstand |
| `pump-filter-v1.png` | 332×275 | Pump on a base plus a filter housing, hoses either side |
| `greywater-diverter-v1.png` | 368×266 | Y-junction valve with a lever, mesh basket visible |

### Planting details — TOP-DOWN (these composite onto the plan like the canopies)
| file | current | subject |
|---|---|---|
| `banana-clump-v1.png` | 432×441 | 3–5 banana plants from above, paddle-leaf rosettes, no basin |
| `keyhole-bed-v1.png` | 431×428 | Circular keyhole bed from above: planted ring, central basket, access notch |
| `herb-spiral-v1.png` | 402×407 | Spiral of stone from above with herbs planted along it |
| `production-bed-v1.png` | 427×394 | A planted vegetable bed from above, rows visible |
| `pollinator-strip-v1.png` | 170×425 | A long strip of mixed flowering plants from above |
| `vetiver-bank-v1.png` | 582×236 | A dense grass bank from above, running left to right |
| `spekboom-hedge-v1.png` | 489×161 | Dense small-leaved succulent hedge from above, running left to right |

The last four are **strips**: keep them wider than tall (their footprints are long and narrow),
and make the plant texture continuous along the length so a long strip drawn from one image
does not read as a repeated stamp.

## Self-check, per file

Size, mode, all four corner alphas, and the **non-subject fraction in the outer 25 % band** —
which must be near zero. That number is what catches painted ground, and it is the check the
first generation of these assets would have failed.

Then downscale to 24 px and look. If a compost bay and a nursery table are the same grey box,
redraw the silhouette.

Do not edit any code. Commit on this branch when the self-check passes.
