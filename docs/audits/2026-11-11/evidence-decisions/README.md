# Evidence: decisions browser check and exported plans, 11 November 2026

## Final exports: made at commit `062b630408279519cc3b381248d288f226ee8928` (tree `7907684eb5dbcb0754d4562ed6d168180a326ffc`)

A fresh development server on that commit, with no uncommitted change under `app`, `components`, `lib`, `public` or `package.json` (the output files print both lines). `scripts/e-final.cjs` opened the crop plan, ran Auto-suggest with its default answers, accepted the suggested plan (27 plantings on the local farm, 15 on the sample farm) and pressed each export button. Outputs: `outputs/E-local-final.txt`, `outputs/E-sample-final.txt`, `outputs/E-artifacts-final.txt`.

| File | Bytes | sha256 | What it is |
| --- | --- | --- | --- |
| `artifacts/crop-plan-local-farm-future-harvest.pdf` | 16658 | `4f7b02e4e4b593761a90d1ac5917cc6706f3d32c384cb552291e56cfeddecc75` | Local farm: "Future harvest PDF" |
| `artifacts/crop-plan-local-farm-future-harvest.pdf.txt` | 3765 | `fee0dd3559824fc80772717dd093b5cb74d60bb43e539ca466f030e282b77611` | Text extracted from the PDF of the same name with pdftotext |
| `artifacts/crop-plan-local-farm-reference.pdf` | 750662 | `4c9b4d6ed9acd3dfb2befd4ffb1ae552e4d5ec82271f58fc55249ef87b40a862` | Local farm: "Detailed reference PDF" |
| `artifacts/crop-plan-local-farm-reference.pdf.txt` | 79837 | `b531db962e48912d221ee1703fac95d835338ffbe4baea51dda3946fee9bf45e` | Text extracted from the PDF of the same name with pdftotext |
| `artifacts/crop-plan-local-farm.ics` | 70586 | `c40a33ab49ce5e198810e04a161556a0c32cb3289e5ae05eabfa3513a7a8873d` | Local farm: "Add 99 tasks to calendar", 99 events, December 2026 to April 2028 |
| `artifacts/crop-plan-local-farm.json` | 10741 | `c66ebcf1bbb2595cee4ee4bd4294685c02dd0d6423112d72576bc62478c0e2e5` | Local farm: the saved plan as the browser stored it (every storage key matching crop_plan) |
| `artifacts/crop-plan-local-farm.pdf` | 691516 | `6be0f75e11435d66cae6ff9a4dcc9a87e472d5e44df7bb0c446271c4442faa2a` | Local farm: "Download the plan (PDF)", 28 pages |
| `artifacts/crop-plan-local-farm.pdf.txt` | 63632 | `e6ba90c89d3cc6458ddd5c3c5eab7577f9437c8f6fd40ebd6ff9e97a163a9081` | Text extracted from the PDF of the same name with pdftotext |
| `artifacts/crop-plan-sample-farm.ics` | 63877 | `b789d389d966efbee0b9b406b13d8240cc7fb75c4382870ca9162166ac17f82a` | Sample farm: "Add 93 tasks to calendar", 93 events |
| `artifacts/crop-plan-sample-farm.pdf` | 891023 | `23d0a7eaabd99affaa0f4754caaf61d1d2e5641450564c4b38fbe8bea1965f71` | Sample farm: "Download the plan (PDF)" |
| `artifacts/crop-plan-sample-farm.pdf.txt` | 84124 | `ded4b3b097e3954a07264993a7e3142dac04495bee6db19b5e341602a090f17b` | Text extracted from the PDF of the same name with pdftotext |

- The local plan PDF's extracted text is byte for byte the text of the run made at `dd9c8769` (same sha256), so the later code changes did not alter this plan.
- PDFs embed a creation time, so a PDF's own checksum differs from run to run; compare the `.pdf.txt` files.
- The calendar file has no line over 75 bytes and ends correctly. Its event titles begin with a coloured-square emoji; that is older behaviour, not changed here.
- The line "saved plan keys and planting counts … 0" in `E-local-final.txt` is my script counting a top-level `plantings` list that the stored format does not have. The saved plan itself is `artifacts/crop-plan-local-farm.json`.
- The two PDFs named `ImbewuField-Crop-Plan-…` from the earlier run are replaced by `crop-plan-local-farm-future-harvest.pdf` and `crop-plan-local-farm-reference.pdf`.
- I looked at pages 1 and 2 of the local plan PDF: the bed calendar draws correctly, with crop pictures, bars and the "not checked by an agronomist" footer.

## Screen checks: which code they ran on

The calendar-page checks (B1 to B5) and the missing-climate screenshots were run again at `dd9c8769`. Four application commits came after that: the one-time share check, the close-call search, the NUL byte, and the Atlas guard. None changes what those screens show for this farm: its calendar and close call are the same before and after (it is in the 100-place comparison), the share check concerns a row no screen creates, and the Atlas guard acts only on a year the server marks incomplete. The Atlas and weekly-target screens were checked at `ad9c2402` and not re-run; the weekly-target code changed afterwards only by moving three constants to their own file. `B2-picked-*-full.png` and `B2-picked-at-month-heading-*.png` are from the first pass and show the longer option text that was later shortened.

## The earlier notes, as the helper wrote them

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
