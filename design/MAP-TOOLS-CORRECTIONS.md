# Map Tools — Corrections for Claude Code

These fix the farmer map screen. See `33-map-tools-v2.png` for the visual target.

## Buttons
- **"Draw water storage"** = **blue** (`#235E86`), white text, **centred**. It sits directly
  under the ochre "Draw land boundary" button as a matching pair.
- **"Draw land boundary"** = ochre (`#C07A1E`), dark text, centred. This is the primary.

## Save place must DROP A PIN
- Tapping **"Save place"** drops a **pin marker** at the current map centre / located spot,
  then lets the user name it. It is NOT just a list entry — the pin appears on the map
  immediately and persists. (Use the same ochre teardrop pin already on the map.)

## Map style switch
- Show base style as **3 visual thumbnails** (Satellite / Terrain / Streets), not a text
  dropdown. The selected one has a green check + leaf-green border.

## Overlay toggles
- "Hills & relief", "Rivers & water", "Contour lines" are real on/off **toggle switches**
  in a clean list (green when on).

## Saved parcels & water stores list (was confusing)
- Two clearly **labelled sections**: "Your land · N parcels" and "Water storage · N stores".
- Every item has a **real name** ("Parcel 1 — home plot", "Store 1 — main dam") + its size.
- Edits are **labelled buttons** ("Edit shape", "Edit") + a red trash icon — never bare icons.
- Adding is an explicit full-width button **with words**: "+ Add another parcel" (dashed),
  "+ Add another water store" (solid blue). A first-time farmer must not have to hunt for it.

## Drawing-mode control bar (the faint Undo/Finish problem)
- All four controls in **one solid bar** with text labels:
  - **Cancel** — quiet outline
  - **Undo** — quiet outline
  - **Add corner** — big ochre primary, fills the space
  - **Finish** — solid green, only enabled once 3+ corners exist
- A top pill counts progress in plain words: "3 corners marked — add 1 more, then tap Finish."

## Fonts (desktop) — hold these DOWN
Panel title 17px · row titles 14px · body 14px · button text 15px · section labels 11px.
Do NOT use the phone mockup's 24px+ sizes on this desktop panel.

## Map layers (use the REAL ones only)
- The supported layers are: **Satellite, Topo, HD, Contours, Relief, 3D** — shown as a
  chip grid, green when active (Satellite + Contours on by default). Do not invent others.
- **Map layers collapses** to a single summary row ("Satellite · Contours") with a chevron;
  tap to expand the grid. The whole tools panel also collapses via "Hide".

## Save place must DROP A PIN — and be nameable
- Tapping "Save place" drops a pin, then opens a sheet to **edit the name** (free text) and
  **pick a label** (Home / Field / Water / Other). The label sets the **pin colour** on the map.
- Saved places persist and appear in "My saved places".

## Lima coach-marks (first-time guidance)
- Tapping a tool the first time pops a **Lima hint bubble** pointing at that button, with a
  short plain-language explanation, a "Got it" button, "Don't show tips", and a tip counter.
- Lima can be **minimised** to a small floating sprout button (bottom-right) with a "?" badge
  when a tip is available; tapping reopens the guide. Lima also guides inline in sheets
  (e.g. the Save-place naming sheet).

