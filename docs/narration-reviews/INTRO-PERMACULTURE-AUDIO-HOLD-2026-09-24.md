# Introduction to Permaculture isiZulu audio — unreviewed staged draft (24 September 2026)

> **UNREVIEWED AI DRAFT — pending fluent isiZulu and local farming review.** Rory authorized publication of clearly labelled drafts before that review; this status does not imply linguistic or farming approval.

## Decision and review status

The complete 22-slide isiZulu Introduction draft is copied to `public/course-audio/intro-permaculture/zu/` and registered in `lib/course-audio.ts`. It is explicitly review-pending under Rory’s authorization; the existing DeckPlayer and CourseAudioPlayer warnings must remain visible. Transcript text is generated in `lib/course-transcripts.ts`; offline packs derive the ZU clips from the manifest. The full-track source and detailed proofs remain staged at `/Users/roryclark/Downloads/imbewu-record/intro-permaculture-l1-zu-20260924` and are summarized here. There has been no human listening, fluent isiZulu review, or local farming review. The app exposes the existing review-pending warning in both the slide deck and audio player.

The current canonical isiZulu narration was reconciled slide-by-slide with the current English narration and source lesson. L1 slides 7–8 no longer assert removed borehole-sharing or permission claims; L3 replaces unsupported regional wind claims with local observation. Existing safeguards about borehole capacity/monitoring, overflow, conditional hail response, and fresh manure remain represented. The independent AI audit found one terminology issue on slide 11: `izinto eziphilayo` meant “living things,” which could mislead about biomass. It is corrected to `i-biomass (njengamaqabunga nezinsalela zezitshalo)` and slide 11 alone was rerecorded. The slide 13 title was also aligned to the source-faithful deck heading; it is outside the spoken block, so its exact spoken-text proof remains unchanged. All 22 unchanged exact spoken text blocks remain verified. All takes were reused only where exact text/source/audio proofs matched.

## Source and script proofs

| Input | SHA-256 | Purpose |
|---|---|---|
| `docs/narration/intro-permaculture.zu.md` | `faf469fe46668140369f1054f9ef52558b1af94e4d09d7f10641735948ed4667` | Exact 22-slide isiZulu narration; the unspoken review preamble was removed after export so the player script contains only slides |
| `docs/narration/intro-permaculture.en.md` | `312fce3eb18c46b04d9353eac636c3b66013b7e17d1cf2ce18a1446d2900914d` | Current English narration source |
| `lib/course-modules.ts` | `c8e5de91706d41d91523e9889b858d7166037008aa8e3ffbbd5a2da41f622eda` | Current source lesson bodies and quiz data |
| L1 review draft `docs/narration-reviews/intro-l1.zu.full-draft.md` | `1aebe585a2b6f03affedb22521dbce43c06052038d09de2974ba4419295424aa` | Paired source reconciliation, slides 1–8 |
| L2 review draft `docs/narration-reviews/intro-l2.zu.full-draft.md` | `07546be50fceae9e7fa82aa82f680ca4ea5efab9582c6559ef0aaf866e17538b` | Paired source reconciliation, slides 9–14 |
| L3 review draft `docs/narration-reviews/intro-l3.zu.full-draft.md` | `a1139388f5b5266652869fa3836d51747af762f997c16a71160f8b0aac23931c` | Paired source reconciliation, slides 15–22 |

## Staged asset sizes and proofs

Voice: `zu-ZA-ThandoNeural`; rate: `-12%`. All 22 clips and the full track passed word-boundary text matching and full MP3 decoding. Proof JSON and returned-word-boundary transcripts are in `/Users/roryclark/Downloads/imbewu-record/intro-permaculture-l1-zu-20260924/proof/`; exported spoken text is in `/Users/roryclark/Downloads/imbewu-record/intro-permaculture-l1-zu-20260924/source-text/`. The published full track is 877.152 seconds and 5,263,148 bytes. It is available through `fullNarrationUrl("intro-permaculture", "zu")`; the offline lesson pack downloads slide clips and does not include full narration. Slide assets total 5,262,912 bytes.

| Slide | Published file | Bytes | Audio SHA-256 | Source-text SHA-256 |
|---:|---|---:|---|---|
| 1 | `slide-01.mp3` | 216,576 | `bf5122c67ee1cdebdff8705e9e64932e0df63a04ede983b334f0e5f4654c2c47` | `35ba532bcae6250b20d041e558f6bb18532be16b43ac2f26f87066d01a5d375b` |
| 2 | `slide-02.mp3` | 232,416 | `049c37059fc1df745a992b325dd7ed0da254537e8be2b51bdf689291fe74fbbf` | `483275679e892427ce65cd42d459d055457fbe1c8f3ee743be64584864c112b7` |
| 3 | `slide-03.mp3` | 187,200 | `9878d825a92f1f49f6f9ac68ee982e3c870a9dbe4369eb91eec412320e1b10db` | `c3d96105a12404240314345f25e8c944ee0df75285b79fbce294c29bab83e70b` |
| 4 | `slide-04.mp3` | 213,264 | `e94c1ab45c08747139c095dfabdb54dc230442f1105dd6f1a575a02bc1d0c08c` | `d3d013b44e6ba65dd29e8000db02d79c9401fa436df86e26a4487b2f1ea845e1` |
| 5 | `slide-05.mp3` | 173,232 | `28e58d3f12829514e70bd03fcd40683a559bf7f16e4f2cf53f1f37d408de1151` | `848bea03c6c0aef5da4ac98891d9937f0f14edaca6a48018780d5b334eb2acdb` |
| 6 | `slide-06.mp3` | 232,848 | `30562db482235d6b465a0fa9ce5b6a7763d36428042d75fc23890f5a9a5315c7` | `0e0d8136184352eba1d7904c3012892f531aaa5951959ec979437c22842f6010` |
| 7 | `slide-07.mp3` | 348,336 | `e25aa23792efd4d2543148078533557373178d26689fab9d6fd8a51c58e7234b` | `52d352a092c1fa0ab1e34c8d5ad0b68a0a146e5e5ea41a9c40c201075629198b` |
| 8 | `slide-08.mp3` | 211,104 | `bd7aaac8b222c770068b22157d97eea0dce8572d0c9b0025bedf42b020b68e03` | `f4fb8a380c79c7892ddd8830f10ac8516df9ed7b91de18488802e14ae074db5c` |
| 9 | `slide-09.mp3` | 242,640 | `3f77854754c52debde9727bfe232a5d5b3c488bb42878ce947d5c066f78f958d` | `3c534a98bad93362e8b619bdc405eef90e4bd689590643fb360706acefc82f12` |
| 10 | `slide-10.mp3` | 384,624 | `adc264918c47df9823f6d74a4a40a80bb1ed57fa28045e176457f663a4fe2e72` | `36dc5bb65ee9da87ad40166d04c7a27279f198d0b433589b81cb60dc8e1d3da5` |
| 11 | `slide-11.mp3` | 233,136 | `e964f54bf933039b7aa0e55a6d402beea1d54f024f8a2ff6162ff675c8024ffb` | `42c3de12c6fa7838fc667e7a86bc1a8bc4827c62858a539799e08de6e36f8961` |
| 12 | `slide-12.mp3` | 170,784 | `7ac44511453763100d6804a7ac4b66e0ba335884acb1fd02888c84575aeb0a68` | `fa30dd3cdb1a48ecc72fdc83fa68ef02951616317da5520c307dc55453d23f0b` |
| 13 | `slide-13.mp3` | 269,424 | `3836132d3226ebaa9ee8c3c4b5079ffc41974c968b644f828d8fbe309528828d` | `a99075bebecdda1afdc3d9563c778d225862fbc9e5a079586dea491b6086c538` |
| 14 | `slide-14.mp3` | 388,224 | `3d6abe7faa9fded9a1cfc5c7f747fcaf049abdfcd654c8c177219db1d3006d36` | `4abda297f66531a16af7bd1002d530fcafb04ff80455837367da7959e89357a2` |
| 15 | `slide-15.mp3` | 293,040 | `2dea661cd8ead0252295e1ec6280a51c234c0ac352a0686742e1f5665728eb6c` | `9326cf47a75b247811b0579f2e1011fb97487d0c4f14bb14802d91352a8c6f73` |
| 16 | `slide-16.mp3` | 145,152 | `4c776e7a0f20cb1ea1a2f00a68ecccda0a8d2d6887271ec80a70212971cf1030` | `035574adcf901f4e5fcb8268240574c9d3e40e3d55648f2fca140d36cc196ed9` |
| 17 | `slide-17.mp3` | 179,136 | `b3d75461dbf9de6172e123c4d2b7399c61a0b74953a159099372f5bd133b6f06` | `de54c7b35640c98d79305e6985074c3952ae55720ee3125795d31fa3aef4d0c9` |
| 18 | `slide-18.mp3` | 275,040 | `e55390b99852d9daa67c01353ed19033b9ff281adef74f40752212770c085ae6` | `98c09c951704c5b6717265c23e53ea02a9076c2a7d02ec170e8958cc6f3bf517` |
| 19 | `slide-19.mp3` | 279,936 | `c1da3a5024c945953f22d08182829fa993b4830606d57827026f7bdc270d8d85` | `52a924bd4ac1ac7414246cc3414269af5ef99658df3d1c5f0cb7abedda5c40a0` |
| 20 | `slide-20.mp3` | 227,520 | `8e9f15e760677a6e812e365283df94d32db2b08f3b4a3d0253ed1c3ddc2aff33` | `c9d65fb98745c34868e60f1474b168401a084af747c2e32a205d2f32499c18c2` |
| 21 | `slide-21.mp3` | 152,928 | `6a0f9a393afa3a53d1fb83be0db511879099abc7bdc7b6257e30dd8b76295847` | `33d6b5f778768b449e4dbcfa684f988b143049017ca08235b67686e9e4f0ae3f` |
| 22 | `slide-22.mp3` | 206,352 | `c98bf7448bfa9984eb421b09b3a49e2a3e98135517ae53034278d70680136ada` | `b27fab692bd4e7aa84fbafa76b7118a93cc382bd431a6258fd43849de235c0eb` |
| Full | `full.mp3` | 5,263,148 | `9eeb51799b0010278b2f29a2995666b8d7eb3262ec218ac9e0a37ab36dc93573` | See 22 slide sources |

## TERMS NEEDING REVIEW

The AI-only source-alignment audit at `/tmp/imbewufield-intro-zu-agy-source-qa-20260924.md` found the slide 11 terminology issue; it was not a fluent or farming signoff. The corrected narration says `i-biomass (njengamaqabunga nezinsalela zezitshalo)`. This wording still needs a fluent isiZulu speaker to confirm natural usage and pronunciation. Other translated terms and locally used farming vocabulary also need review; this report does not claim those terms are approved.

## Release warning

**fluent review pending.** This report does not certify translation or pronunciation. It also does not certify local farming suitability or human listening quality. Keep the published batch marked unreviewed until a fluent isiZulu speaker and local farming reviewer provide a named, dated accept/revise/hold decision and the exact script hash they reviewed. Any spoken script edit requires new hashes and rerecording of affected clips before an updated batch is published.
