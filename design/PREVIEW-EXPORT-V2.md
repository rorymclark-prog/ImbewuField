# Preview & Export v2 — spec from Rory's mockups (2026-08-10)

Rory sent three mockups late on 10 August: "also i want the preview maps to be like this".
This file records what is IN them, what is genuinely new, and where they contradict decisions he
made earlier the same day — so the build brief is a plan rather than a screenshot to trace.

The mockups are aspiration, not a contract. Where one contradicts a decision he has already
taken, his decision wins until he says otherwise, and this file says which is which.

---

## 1. What the mockups show

**Mockup A — desktop "Preview & Export" (step 4 of 4)**
- Left rail: sheet list (All sheets + Sheet 1–5, each named), rendering-style picker, underlay
  swatches, and three option toggles (sheet labels, legend on maps, scale & north arrow).
- Centre: **all sheets previewed at once** as a grid of cards, each with its number, name, north
  arrow and scale bar. A "Compare styles" button and desktop/tablet/phone preview toggles.
- Right rail: saved maps with search and a time filter; a selected-map detail panel (saved on,
  sector, sheet count, rendering, underlay, created by, description); a version list (v1/v2/v3).
- Footer: design status, "Next up: Export your maps", Continue, Notes, Activity log.

**Mockup B — tablet "Preview & Export"**, a numbered 1–6 rail: plan set → underlay (+ a
*Sharpness* slider) → plant labels (Codes / Beside / On plant / None, + show counts) → style →
render engine & quality → finish & export. Centre is one large preview with wind/sun chips and
map controls. Right rail: saved maps with per-row type chips, and an **export summary** (format,
resolution, what's included, estimated file size).

**Mockup C — "Saved Maps & Versions"** as its own page: filter bar (plan type, versions, authors),
grid of maps with type badges, a detail panel (plan type, AI engine, render quality, base imagery,
sheet size, version, layer and element counts), **compare two versions side by side**, and a
version history list.

---

## 2. Genuinely new capability (the actual work)

1. **Preview every sheet at once.** Today the studio previews one sheet at a time. This is the
   headline of the ask and the biggest single change.
2. **Versioning.** v1/v2/v3 per saved map, with history and a side-by-side compare. Nothing in the
   app versions a saved sheet today; they are independent rows.
3. **A Saved Maps page** with search, filters and badges, separate from the studio.
4. **Export summary** before export: format, DPI, inclusions, estimated file size.
5. **Compare styles** — the same sheet rendered two ways, side by side.
6. **More base layers** (topographic / light / dark) beyond photo, satellite and plain paper.

---

## 3. Where the mockups contradict decisions already made

| Mockup shows | The standing decision | What to build |
| --- | --- | --- |
| Three finishes: Exact Canvas, AI Hybrid, **Full Treatment** | 10 Aug, Rory: "I just want an exact version for now and a ai render polished version also those 2". Full Treatment is shelved behind `SECOND_POLISH_PASS_SHELVED` | Two finishes. Do not re-expose Full Treatment from a mockup. |
| The label "**AI Hybrid**" | Renamed farmer-facing to **AI Polished** (the internal stage name `hybrid` stays — queue keys, `resultKind`, gallery records) | "AI Polished" in every farmer-visible string. |
| Desktop-first three-column layouts | The app is phone-first; DESIGN.md §0 forbids reusing phone px on desktop and vice versa | Design the phone layout FIRST, then let the rails become columns at `md:`/`lg:`. |
| "Saved maps (132)", "132 / 500 maps", a grid of ~12 thumbnails | Saved sheets are 1–3 MB each; a grid that holds full images is exactly what crashed the app (see lib/sheet-store.ts's memory contract, and the 10 Aug crash-loop work) | Metas + small thumbnails only, windowed/paged. Never hold full images for a grid. |
| Mock identities ("Johan van der Merwe", "GreenEarth Farm", "ImbewuField 2.0") | — | Illustrative only. |

---

## 4. Build order (smallest useful piece first)

1. **All-sheets preview grid** — the actual ask, and it needs no new data model. Watch memory:
   render thumbnails at preview size, not nine full-resolution sheets.
2. **Export summary** — pure presentation over facts the export path already knows.
3. **Options toggles** (labels / legend / scale & north) — these already exist as render inputs.
4. **Saved Maps page** — reuse `loadSheetMetas` + `loadSheetImage`; never `loadSheets`.
5. **Versioning + compare** — the largest piece, and the only one that changes what is stored.
   Needs its own design pass: what counts as a new version vs a new map.

---

## 5. Open question for Rory

The mockups keep a paid finish in the picker. As of 10 Aug the paid render's own honesty is still
unresolved: the billing gate scores only the pixels the model is allowed to touch, so a sheet that
comes back looking identical to the free one can still be charged and labelled "AI Polished". A
prettier preview screen around that would be polish on top of a broken promise. Fix the gate
before, or with, this work.
