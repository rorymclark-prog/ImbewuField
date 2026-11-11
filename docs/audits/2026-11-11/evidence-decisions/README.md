**Final re-runs were made at commit dd9c8769 (app tree clean). They replace: outputs/B.txt, B2-shots.txt, A1-note-shots.txt (superseded by outputs/B-final.txt and outputs/A-notes-final.txt); outputs/E-local.txt and E-sample.txt (superseded by E-local-final.txt, E-sample-final.txt); artifacts/* (regenerated); screenshots B2-options-phone-light, B2-picked-phone-light/phone-dark/desktop, B3-options-phone-light, A1-autosuggest-note-phone-light/dark, A2-autosuggest-note-phone-light. Not re-taken and therefore STALE (taken at ad9c2402, old bracketed option text): B2-picked-*-full.png and B2-picked-at-month-heading-*.png. Outputs A.txt, A3-A4.txt, C.txt, D-*.txt and the A3/A4/B1/B4/C/D screenshots are from ad9c2402 and not re-run. New scripts: scripts/bf.cjs, scripts/a2s.cjs.**

# Evidence: decisions browser check (commit ad9c2402, 11 Nov 2026)

Dev server on :4242, Playwright chromium, seeded signed-out local farm (Ubhejane Creche, -27.72623, 31.96304). App level seeded as "full" (the header sowing-calendar chip is not drawn in "simple" level). Phone 390x844 @2x, desktop 1280x800.

## Scripts (scripts/, shared helper lib.cjs; they read seeds from the review scratchpad seeds.json)
- scripts/lib.cjs - seeding, console/pageerror capture, crops-page entry, overflow check
- scripts/a.cjs - A1, A2 (A3/A4 parts of this run are superseded, see A3-A4.txt); scripts/a34.cjs - A3, A4; scripts/a1s.cjs - A1 note screenshots
- scripts/b.cjs - B1-B5; scripts/b2s.cjs - B2 screenshots at the month heading
- scripts/c.cjs - C (Atlas)
- scripts/d1.cjs (helpers), d.cjs (targets Carrots + Cabbage), d3.cjs (extra Carrots Jun-Aug 2027) - D
- scripts/e.cjs - export artifacts (SAMPLE=1 for sample mode)

## outputs/ (raw console output)
- outputs/A.txt - A1, A2 passes; its A4 block was read before the climate arrived (chip says "still loading") and its A3 block crashed on page load - both redone in A3-A4.txt
- outputs/A3-A4.txt - A3 (20 s delay) and A4 (no interception, waited for climate)
- outputs/A1-note-shots.txt - A1 note text in light and dark
- outputs/B.txt - B1, B2 (phone light/dark/desktop), B3, B4, B5 (old-name grep in every state)
- outputs/B2-shots.txt - label text for the B2 month-heading screenshots
- outputs/C.txt - C, both points (includes Mapbox token errors, see report)
- outputs/D-phone-light.txt, D-phone-dark.txt, D-desktop.txt - D targets: Carrots 3 kg/wk May-Aug 2027, then Cabbage 2 kg/wk Aug 2027
- outputs/D-extra-carrots-jun-aug*.txt - D extra target Carrots 3 kg/wk Jun-Aug 2027 (phone light, dark, desktop)
- outputs/E-local.txt, E-sample.txt - export runs (local farm, sample mode)

## Screenshots
- A1-autosuggest-note-phone-light/dark.png - A1 sign-in note in Auto-suggest
- A1-header-desktop.png - A1 header chip desktop; A1-header-after-choice-phone-light.png - chip "chosen by you"
- A2-autosuggest-note-phone-light.png, A3-autosuggest-note-loading-phone-light.png, A4-autosuggest-note-phone-light.png - top of the Auto-suggest dialog in A2, A3, A4 (the note itself is below the fold; the text is in the outputs)
- B1-not-known-phone-light.png - B1 "not known on this device yet" line
- B2-options-phone-light.png - B2 closed select after site chosen (native option list cannot be photographed; option texts are in outputs/B.txt); B3-options-phone-light.png - same for B3
- B2-picked-phone-light/phone-dark/desktop(.png, -full.png) - B2 picked state at top of page; B2-picked-at-month-heading-phone-light/phone-dark/desktop.png - at "Hot area, no frost - this farm's crop plan"
- B4-winter-phone-light.png - B4 reference guide, Winter frost picked
- C-atlas-durban-phone-light.png, C-atlas-johannesburg-phone-light.png - C chip on the result panel
- D-target-card-phone-light/phone-dark/desktop.png - D Carrots May-Aug card after accepted sowings ("Not covered yet")
- D-target2-card-*.png - D Cabbage Aug card ("Not covered yet")
- D-target-card-carrots-jun-aug-*.png - D extra Carrots Jun-Aug card ("Covered on paper, may be early")

## artifacts/ (local farm, desktop viewport, after Auto-suggest default answers + "Add 27 plantings to my plan")
- crop-plan-local-farm.pdf (+ .pdf.txt) - "Download the plan (PDF)"
- ImbewuField-Crop-Plan-Ubhejane-Creche-garden-future-harvest-2026-11-11.pdf - "Future harvest PDF"
- ImbewuField-Crop-Plan-Ubhejane-Creche-garden-reference-2026-11-11.pdf - "Detailed reference PDF"
- crop-plan-local-farm.json - localStorage keys matching /crop_plan/
- crop-plan-sample-farm.pdf (+ .pdf.txt) - sample mode, fresh context, after "Add 15 plantings to my plan"
