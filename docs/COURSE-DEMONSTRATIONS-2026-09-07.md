# Course demonstrations — 7 September 2026

The remaining 22 Watch slots now have wordless process diagrams, posters and plain
English explanations. Together with the six Water diagrams and the existing Seeds
assets, every current Watch heading has a connected demonstration. These new diagrams
explain processes and relationships. They are not a claim that every slide has reached
the illustrated Seeds production standard or that the nine bilingual modules are finished.

## Produced media

All new movies are 12 seconds, 1280 × 720 H.264, 15 fps, yuv420p, without an audio
stream. The 22 movies total 2,113,755 bytes. Posters are 960 × 540 and each is smaller
than its movie. Videos remain opt-in; the existing offline pack includes them.

| Module | Slide | Sequence | Movie bytes |
| --- | ---: | --- | ---: |
| soil-health | 5 | soil-observation | 44,815 |
| soil-health | 10 | compost-building | 51,727 |
| soil-health | 14 | mulch-and-rain | 243,862 |
| plant-guilds | 5 | root-nodules | 35,003 |
| plant-guilds | 10 | chop-and-drop | 46,261 |
| plant-guilds | 15 | tree-guild-roles | 61,517 |
| food-forest | 5 | seven-growing-layers | 53,944 |
| food-forest | 10 | climate-and-selection | 43,927 |
| food-forest | 15 | food-forest-establishment | 100,448 |
| reading-landscape | 5 | follow-rainwater | 211,214 |
| reading-landscape | 9 | sun-and-shadow | 48,252 |
| reading-landscape | 13 | wind-and-cold-air | 254,677 |
| reading-landscape | 17 | map-existing-features | 72,211 |
| intro-permaculture | 7 | sharing-and-monitoring | 48,204 |
| intro-permaculture | 13 | diversity-and-disturbance | 148,971 |
| intro-permaculture | 19 | windward-shelter | 190,417 |
| small-livestock | 4 | moving-chicken-tractor | 99,035 |
| small-livestock | 9 | bees-and-flowers | 61,125 |
| small-livestock | 14 | livestock-nutrient-cycle | 61,127 |
| market-community | 4 | harvest-record | 32,633 |
| market-community | 9 | surplus-routes | 88,496 |
| market-community | 14 | neighbour-sharing | 115,889 |

## Teaching source and visual review

Each sequence is mapped to its existing numbered block in
`docs/narration/<module>.en.md`. Narration block numbers and lesson IDs are unchanged.
No new species, farm yields, construction measurements or growth dates were added.
Plain captions explain the action; technical diagrams share the Water palette and
keep text outside the video so the artwork can later serve both languages.

Six storyboard frames across each initial sequence were inspected. Corrections were
then checked again at the start, middle and end at 360-pixel width: shrub and creeping
cover are distinct in the forest section, the rainwater path no longer suggests early
uphill overflow, water-sharing figures stand on the ground, and manure and compost
are separate stages. Wind and cold-air paths differ in width as well as colour.
Source-relative corrections included visible material thickness differences in the
compost diagram and distinguishing the mixed crop forms by shape.

Final decoding verified all 22 files: 180 frames each, 12 seconds, H.264 720p,
no audio stream, actual image change, and cheaper posters. Some diagrams use a moving
highlight or progressive reveal because the relationship itself is static.

## Playback and export

The player waits for both narration and a selected demonstration to end. Two ended
events in the same tick advance one page. Stop pauses both media. Silent slides get
a fresh reading timer on every page, extended for continuation frames, and a chosen
video finishes before the page turns. The real React component is exercised with
media-event mocks; this is not a claim of phone or browser playback verification.

The facilitator exporter accepts SVG and ordered continuation cards under the original
narration number. Missing parts, extra slide numbers and competing still/video files
stop the export. Frame rounding uses cumulative recorded time so it cannot drift by
one frame per slide. A two-recording/four-colour-frame fixture was actually encoded;
sampling the final MP4 verified all four cards in the correct order.

`--course-deck` uses app covers, demonstrations and readings. It refuses an animation
that cannot fit alongside the cards in its existing recording: shortening the final
teaching action would defeat this repair. Custom-directory exports retain the existing
explicitly reported trim/freeze behaviour. Card time is shared equally inside a block;
word-level timing and full facilitator videos still need production review.

Reproduce with:

```sh
node scripts/render-course-demonstrations.cjs
node scripts/gen-asset-sizes.mjs
node --import ./tests/register-alias.mjs scripts/build-lesson-video.mjs <module> en <slides-dir> <output.mp4>
```

Requires sharp and ffmpeg. New media metadata in `lib/course-deck.ts` must be updated
if a different encoder changes file sizes. QA files are temporary; the generator and
final movies/posters are versioned.

## Narration and remaining release work

Leah remains the English target, Thando the isiZulu target. The actual on-disk voice
is now recorded in the narration manifest, separately from its replacement target.
Readiness requires those target voices as well as the existing bilingual assets.
The production board now recognises Water's SOURCE CHANGED marker, its held English
take, the voice replacement work and missing isiZulu slides.

One 9.72-second Leah reference and eight numbered Food Forest clips were generated
at -12% using edge-tts 7.2.8. The eight numbered clips total 164.856 seconds. Receipts
contain source and audio hashes, settings and generation time; boundary metadata is
retained. No listening or pronunciation review is claimed, and live audio is unchanged.

The nine English recording sheets cover 185 clips. Automatic approval review stopped
the bulk speech transfer. GitHub metadata confirmed the repository is public and all
nine scripts hash-identical to the published branch; a retry with that evidence still
required explicit user permission for transfer to Microsoft's speech service. Do not
retry until that permission is given. No permissions or TLS checks were bypassed.

After permission, finish the complete English takes, listen and import only reviewed
modules. Reconcile and review the nine isiZulu scripts with a first-language speaker,
then record Thando and build the translated slides. Complete remaining illustrated
teaching compositions and the expanded field programme's bilingual teaching assets.
The public app's old audio is not relabelled as Leah and Water's hold remains.

The local browser still returned ERR_BLOCKED_BY_CLIENT. An actual phone/offline
walkthrough remains outstanding. This work belongs to draft PR #426, not a production
release.

Final required checks passed: TypeScript, the complete test suite (3,445 passed,
zero failed, one pre-existing shape-sync TODO), then `git diff --check`. The media
checks and four-card export fixture are separate evidence from those code tests.
