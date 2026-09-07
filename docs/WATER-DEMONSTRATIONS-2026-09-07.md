# Water Harvesting — teaching and production update

Six wordless animated diagrams now accompany Water's six Watch slides. The four
English readings, affected quizzes, key points and narration source were reconciled
with the corrections below. All four lesson IDs and all 24 narration block numbers
remain unchanged. This is an English teaching update, not a completed bilingual module.

## Produced assets

| Slide | Sequence | Bytes | Duration |
| --- | --- | ---: | ---: |
| 4 | Level swale filling and infiltration | 111,102 | 12 s |
| 7 | Protected overflow into a receiving basin | 235,338 | 12 s |
| 9 | Established living contour barriers | 205,708 | 12 s |
| 12 | Dam overflow around the earthen wall | 113,831 | 12 s |
| 16 | First-flush chamber, float closure, then tank inflow | 161,692 | 12 s |
| 21 | Greywater delivered beneath mulch, away from the trunk | 65,622 | 12 s |

All files are 1280 × 720 H.264, 15 fps, 180 frames, with no audio stream. They total
893,293 bytes before posters. Each has an inspected poster and an English explanation
displayed beneath it. The explanation is labelled English when the app is in another
language. The complete reading remains available under “Read this slide”.

Video download is opt-in and its exact size is displayed. Offline packs include the
six clips, posters, all current slide frames and the lesson pictures. Reused posters
are deduplicated. The stills for lessons 2–4 now use these diagrams: the previous dam
image suggested flow through the wall, the diverter image had ambiguous plumbing,
and the greywater outlet sat directly beneath the trunk.

These are process diagrams. Their coordinates, slope appearance and timing are not
construction dimensions, slope thresholds or measurements of infiltration speed.
No new plant species or engineering sizes were introduced.

## Corrections and their sources

**Swales and slopes.** Removed the universal “1–15% is suitable; above 15–20% use
vetiver or terraces” rule and the one-hour pit shortcut. Site assessment now considers
soil, drainage, stability and what lies downhill. Living barriers are illustrated as
an option to assess. The stormwater guide warns that infiltration can create problems
on unstable slopes and calls for professional assessment in difficult settings.
[Slow it. Spread it. Sink it! — hosted by USDA NRCS](https://www.nrcs.usda.gov/sites/default/files/2024-07/Home_Drainage_Guide.v25.pdf).

**Dams.** Removed the promise to maximise catchment without a corresponding flood
assessment, the unsupported ducks/aeration claim, and advice that could encourage
trees on embankments. The lesson now addresses designed spillways, downstream risks,
protective grass, inspection and specialist repairs. FAO explicitly keeps trees and
deep-rooted plants away from the embankment, spillway and outfall.
[FAO, Manual on Small Earth Dams, especially design and §9.6](https://www.fao.org/4/i1531e/i1531e.pdf).

**Roof water.** Removed “20–30 litres off any roof”, “filter before drinking” and
blanket assurances about untreated irrigation water. Diverter sizing is contextual;
drinking use needs suitable treatment and verification. The original roof calculation
is retained as an exercise with explicit assumed inputs. Fixed regional tank-duration
promises were replaced by demand and local rainfall assessment.
[Water Research Commission, Resource Guidelines for Rainwater Harvesting, §§2.4.2 and 6](https://www.wrc.org.za/wp-content/uploads/mdocs/TT%20758%20web.pdf).

**Greywater.** Removed the implication that plain soap or mulch makes washwater safe.
The reading now addresses prompt use within 24 hours, unsuitable sources, avoiding
contact and spray, and stopping when water ponds or runs off. It keeps greywater off
leafy/root vegetables and requires local advice for permanent systems. Cape Town's
guidance informs the precautions; its local approval provisions are not presented as
the rules of every municipality.
[City of Cape Town, Guidelines for Alternative Water Systems, greywater sections and Annexure 2](https://www.capetown.gov.za/_documents/resource.capetown.gov.za/documentcentre/Documents/Procedures,%20guidelines%20and%20regulations/Guidelines%20for%20Alternative%20Water%20Installations.pdf).

Primary references are also linked beneath each lesson in the app.

## Narration and translation

Water's existing English take uses Luke and contains the superseded instructions.
`recordingHold.en` retains the files and their provenance while withdrawing every
playback URL, full narration, language fallback and offline-audio entry. Readiness
also excludes the held take. The video assembler refuses it. No audio was replaced.

Replacement target: **Microsoft en-ZA-LeahNeural**, matching Seeds. The recording
export produces 24 numbered clips containing 1,138 spoken words. Compare a reference
take with Seeds before the batch; the historical speed is documented as 0.88 of normal,
but the recording tool's equivalent setting must be established, not guessed.

The old isiZulu script is explicitly marked **DRAFT — SOURCE CHANGED**. It must be
reconciled by a first-language reviewer before recording or rendering; the recording
export refuses this stale translation. The generated comparison packet flags 16
mechanical differences; that count is not a translation review. Its future narration
target remains **Microsoft zu-ZA-ThandoNeural**.

The later continuation installed `edge-tts` and generated a Leah reference, but
automatic approval review requires permission for the full Microsoft speech transfer.
No Water replacement take, voice audition or first-language approval is claimed.
Keep the hold until a complete, reviewed replacement take has been imported, checked
and documented. Duration checks alone cannot identify the voice or confirm the words.

## Reproduction and verification

```sh
node scripts/render-water-demonstrations.cjs
node scripts/render-course-deck.mjs water-harvesting en
node scripts/gen-asset-sizes.mjs
npm run course:record-sheet -- water-harvesting en /tmp/imbewu-water-recording-reference
npm run course:review-packet -- water-harvesting
```

The renderer requires `sharp` and `ffmpeg`; it writes storyboard contact sheets to
the temporary QA directory and the six final movies/posters to `public/`. Override
`WATER_QA_DIR` to keep inspection files elsewhere. It generates new diagrams from SVG
geometry; no raster source image is edited. Re-encoding on a different tool version may
change byte sizes: update the animation manifest and asset inventory together.

Six frames spanning the start, middle and end of every sequence were visually
inspected. The swale's contour inset was corrected to rise evenly, and the roof-water
feed was corrected to avoid an uphill section. Final MP4 decoding verified all six
movies: 180 distinct frames each, 12 seconds, 1280 × 720, no audio. The changed text
frames preserve every paragraph without dropped supporting lines.

Validation passed in the required order: TypeScript, the full test suite (3,435
passes, zero failures, one existing unrelated TODO; 3,436 total), then whitespace
checks. Regression coverage verifies the six demonstrations, exact media byte sizes,
held-audio playback/fallback exclusion, offline exclusion and truthful readiness.

Phone interaction and a live offline walkthrough remain unverified: the authenticated
browser could not open the local preview in this workspace. This update remains on
draft PR #426 and is not a deployment or a claim that the other modules are complete.
