# Studies media continuation — 20 September 2026

This records the combined review branches, not production publication. The dated baseline audit remains historical. Authored narration and lessons were preserved.

| Module | English slides | New Watch slots |
|---|---:|---:|
| Water Harvesting | 24 | 6 |
| Introduction | 22 | 3 |
| Reading the Landscape | 21 | 4 |
| Soil Health | 20 | 3 |
| Vegetables and Staple Crops | 18 | 0 |
| Food Forest | 20 | 3 |
| Small Livestock | 20 | 3 |
| Market Gardening | 20 | 3 |
| Total added | 165 | 25 |

With existing Seeds (24 slides/eight slots) and Plant Guilds (51 slides/eight slots), the combined branch now has all ten English decks: 240 slides and 41 animation slots. Vegetables contains no authored Watch passage, so none was invented. Original English audio is unchanged.

Water uses two recent Mzomoyethu excerpts and four concept animations. Antigravity supplied concept renderers for the other authored scenes, reviewed and corrected before integration. The player retains each clip's full frame, waits for both narration and video, labels English fallback honestly and saves the matching fallback audio offline. Verification records and reproduction scripts are linked from each module under docs/media/.

## Review branches

Merge in stack order: Water #446, Introduction #447, Landscape #448, Soil #449, Vegetables #450, Forest #451, Livestock #452, then Market #453. All are review work; no production merge occurred in this continuation. Required local checks and CI test/rules/preview passed through Market.

Deployed disconnected checks passed for every Watch pair in Water, Introduction, Landscape, Soil, Forest and Livestock. Water saved all 64 files (9.2 MB), including both Mzomoyethu excerpts. Vegetables saved all 40 files and played representative slides 1, 9 and 18 disconnected. Market saved all 49 files (5.3 MB) and all three Watch pairs played disconnected. These are browser checks, not physical learner-device sign-off. Visual evidence consists of inspected teaching-phase contacts, corrected posters and slide contact sheets; it does not constitute fluent narration review.

## isiZulu and the film

All 165 previously absent isiZulu positions now have local review recordings: Water's 24 plus 141 across the seven other new modules. They use the existing zu-ZA-ThandoNeural voice at -12% rate. The source scripts were not rewritten. None of these recordings is registered or published to learners.

Mechanical checks compare complete normalized service word-boundary text with each spoken block, hash sources and outputs, check the last word fits within the saved duration and fully decode the files. The 141 additional takes also have omitted-word metadata controls and real truncated-audio controls, which are correctly rejected. These checks cannot establish pronunciation, translation accuracy or human approval.

The local review package is Downloads/imbewu-studies-2026-09-20. It includes the corrected September 19 English v3 Mzomoyethu film (approximately 10m46s), retaining captions and chapters, as an optional facilitator review copy outside automatic course downloads. The older film with superseded figures was not reused.

## Remaining release work

- Fluent review of the eight new isiZulu sets and source scripts; Plant Guilds also retains its existing pending review despite its separately authorized release exception.
- Correct any reviewer findings at the authored source, then re-record affected clips and verify again. Do not remove draft markers or extend the Guilds exception implicitly.
- All 165 draft isiZulu slides are prepared locally with a visible review banner. English diagram labels remain explicitly marked for localization. These decks and text-labelled variants need review before registering isiZulu availability.
- Human end-to-end listening and actual learner-device checks remain outstanding.
- Media completeness does not resolve the historical curriculum gap: the current calendar covers 25 of the promised 36 weeks. No missing teaching weeks or farming advice were invented. Historical art/curriculum audits still require explicit triage.

No PLAN_VERSION, saved geometry, species names, lesson bodies, quizzes or farming figures changed. New public audio must still be committed with its manifest entry when approved.

## Review handoff follow-up

`REVIEW.html` in the local pack pairs all 165 draft recordings and marked slides with the unchanged full English and isiZulu text. It offers separate playback, optional English-labelled animations and a notes download. Notes are not sent or saved to an account. All eight draft deck contact sheets were inspected. Introduction's three translated Watch headings now use the English gloss as a structural cue and receive the large animation layout; the authored heading text is unchanged.

After the existing narration exporter/recording workflow has populated the review pack:

```sh
python3 scripts/prepare-studies-review-decks.py --output REVIEW_PACK
python3 scripts/build-studies-review-page.py --output REVIEW_PACK
```

The review builders write only to the supplied pack. They do not register or publish learner media. Output decks retain review banners and English diagram labels pending localization. The review page uses local relative assets, with no external service or account dependency. Browser checks confirmed module/slide switching, English and isiZulu playback, full slide images and optional animation playback. A native audio-control interaction crashed the in-app browser; ordinary Play/Stop buttons were added and verified at readyState 4 with advancing time. No fluent approval is implied.

The final handoff checks passed in order: typecheck, full suite (3,632 pass, zero failures, one existing TODO), then diff check. All 520 local media references for 165 review slides resolve; copied English audio hashes match the originals. The portable archive contains 1,528 payload files plus its checksum list and passed ZIP CRC verification (235,176,819 bytes at this checkpoint).
