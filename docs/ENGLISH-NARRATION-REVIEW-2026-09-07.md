# English narration recording review — 7 September 2026

## Current review status — 7 September 2026

The current source supersedes **74 numbered Leah takes and all nine full listening tracks** from the historical 185-clip review pack. No corrected recording has been generated or activated in this continuation. All nine non-Seeds English modules are held from playback; their current reading decks remain available. Seeds is unchanged.

English target: Microsoft `en-ZA-LeahNeural`, review rate `-12%`; isiZulu target: `zu-ZA-ThandoNeural` after first-language farmer review. Audible matching against Seeds remains necessary.

Automatic approval review rejected the later corrected-script transfer to `speech.platform.bing.com`. Do not retry or route around that rejection. The exact 185 current English scripts, including the 74 replacement takes, are supplied in the current narration review pack; explicit approval of that destination and final script transfer is needed before recording resumes.

| Module | Replacement takes |
| --- | --- |
| food-forest | 6, 7, 8, 9, 11, 12, 13, 16, 17, 18 |
| intro-permaculture | 9, 13, 14, 15, 16, 18, 19, 20 |
| market-community | 2, 7, 8, 10, 11, 12, 13, 15, 17, 20 |
| plant-guilds | 2, 4, 5, 7, 8, 12, 13, 14, 16, 17, 18 |
| reading-landscape | 4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 20, 21 |
| small-livestock | 2, 4, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 18, 20 |
| soil-health | 3, 17 |
| vegetables-staples | 6, 8, 9, 10 |
| water-harvesting | 23, 24 |

See `course-production/current-recording-review.json` for script hashes and `FINAL-ILLUSTRATED-DECKS-2026-09-07.md` for the complete production status. The older sections below are historical checkpoints.

## Historical checkpoints

## Later source correction

Soil Health slides 3 and 17 were corrected after the initial 185-clip review pack.
The old root-feed advice omitted the warning against applying worm-bin leachate to food crops.
Those two takes and the Soil Health full listening track require replacement; the live module is held.
All replacement takes must retain Microsoft en-ZA-LeahNeural at -12%.
See docs/SOIL-ILLUSTRATED-DECK-2026-09-07.md.

Introduction to Permaculture blocks **9, 13, 14, 15, 16, 18, 19 and 20** were
also corrected during illustration review. Their existing Leah review takes
and the full Introduction listening track are superseded. The live Introduction
module is held pending a complete reviewed replacement. The other fourteen
Introduction scripts retain their recording identities. See
`INTRO-ILLUSTRATED-DECK-2026-09-07.md` for source changes and references.

Reading the Landscape blocks **4, 6, 7, 8, 10, 11, 12, 14, 15, 16, 18, 20, 21**
and its full track are also superseded after calibration, frost and site-safety
corrections. See `READING-ILLUSTRATED-DECK-2026-09-07.md`. Water blocks **23 and 24** and its full track are also superseded by the
expanded A-frame calibration. Across the four modules, **25 numbered takes and four full tracks** in the historical pack now
need replacement. No new take was generated during these illustration batches.

## Approval and completed recording

Rory explicitly approved sending the nine English module narration scripts to
Microsoft's speech service on 7 September 2026. The earlier
transfer-permission blocker is resolved for these nine English scripts. It is not
approval of pronunciation, a translation review or a production deployment.

All **185 numbered English clips across nine modules** are now recorded, with a
continuous listening track for each module. They replace the earlier eight-clip
review pack. Live course audio remains unchanged pending listening review.

Voice: Microsoft `en-ZA-LeahNeural`, `edge-tts` 7.2.8, rate `-12%`, default pitch
and volume, TLS verification enabled. The named voice matches Seeds; the old
Seeds speed setting was 0.88 and audible pacing equivalence is not yet confirmed.
Recordings resumed from checked source/audio receipts. Bulk recording used four
concurrent requests; the isolated final repair used the recorder's default two.
Seven audio checksum mismatches were caught during
validation and those takes were regenerated before the complete pack was rechecked.

| Module | Clips | Minutes |
| --- | ---: | ---: |
| food-forest | 20 | 7.3 |
| intro-permaculture | 22 | 10.6 |
| market-community | 20 | 7.9 |
| plant-guilds | 20 | 8.1 |
| reading-landscape | 21 | 8.6 |
| small-livestock | 20 | 7.0 |
| soil-health | 20 | 7.3 |
| vegetables-staples | 18 | 12.8 |
| water-harvesting | 24 | 9.3 |

Total numbered-recording duration: **78.8 minutes**.

## Verification and saved review pack

All 185 source and audio SHA-256 receipts match. Normalized speech word-boundary
text matches the complete numbered scripts. Timing is monotonic and stays inside
the audio duration. All slide numbers are contiguous, all files carry the same
voice/rate, and every numbered clip and full-module track decodes successfully.
Full-track durations match their component recordings. These checks verify the
service output structure; word boundaries are not an independent transcription.
No listening or pronunciation review is claimed.

The updated `Imbewu-English-Narration-Review.zip` contains the 185 clips, nine full
tracks, numbered sources, settings, word boundaries, hash receipts, a verification
report and the short Leah reference. `Imbewu-Food-Forest-Leah-Review.mp3` is a
separate continuous listening copy. Review media is saved separately from the
repository and has not been imported into `public/course-audio`.

## Next production step

Listen to the reference against Seeds and review each complete module for pacing,
South African/isiZulu terms, beginnings/endings and alignment with its teaching
visuals. Then import complete accepted modules, update actual recorded voice
provenance and asset sizes, and remove Water's hold only with its reviewed take.
Do not combine partial Leah replacements with unreplaced Luke clips.

The nine isiZulu scripts still require reconciliation and first-language review,
then Thando recordings and translated slides. Further illustrated compositions,
field-programme bilingual media and phone/offline review remain outstanding.
The course remains a draft while this production work is completed.
