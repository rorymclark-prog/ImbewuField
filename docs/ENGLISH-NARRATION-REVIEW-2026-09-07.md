# English narration recording review — 7 September 2026

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
