# Water Harvesting regional paired slide application review

**Date:** 3 October 2026
**Review type:** source binding and semantic regression coverage; not fluent or local water-safety approval.

## Source and stacked state

- Canonical English lesson source and resolver were captured from `3ffef7a897c6a0aaf97043f15852d5c87222959e`.
- Current stacked branch: `codex/regional-water-source-paired-slides-20261003`, at `d5dc9cf9` before the pending source-paired target files and regression-test changes.
- Applied targets: `docs/narration/water-harvesting.st.paired-draft.json`, `docs/narration/water-harvesting.ve.paired-draft.json`, and `docs/narration/water-harvesting.ts.paired-draft.json`.
- The 24 English headings and all source paragraphs were checked against `docs/narration/water-harvesting.en.md`; the applied target changes leave those source strings unchanged.
- Candidate-level source, resolver, and stacked-target provenance for all 258 fields is in [the final candidate packet](WATER-HARVESTING-REGIONAL-PAIRED-CANDIDATES-2026-10-03.json).

## Field accounting

| Field status | Count across ST, VE, TS | Treatment |
| --- | ---: | --- |
| Exact-source learner paragraph reuse | 78 | Full paragraph matches the English learner paragraph and the current language resolver output byte for byte. |
| New machine draft | 49 | Deck-only wording or framing; remains visibly unreviewed. |
| Existing unreviewed heading draft | 6 | The two existing generic headings per language remain intact. |
| Exact English hold | 125 | Target text is empty; the complete English source stays visible. |

The resolver comparison covers 28 unique English paragraph positions across the three languages (84 source-match rows). Six resolve to English and remain holds; 78 have a target-language resolver paragraph and are reused whole. The six preserved headings are “Learning Outcomes” and “Field Assignment” in each language.

## Safety and meaning guards

The regression test now checks exact paragraph pairing and current resolver output for every reuse, rather than asserting that all lesson passages remain on English holds. It keeps exact-English holds for the identified technical geometry, soil/overflow, dam design, first-flush, water-safety, used-water, sanitation, and contact/reuse clauses. Where a complete existing resolver paragraph is reused, its full text and exact source match are tested instead of blanket-holding it.

The field assignment checks retain the three poles, weighted string, same-reading test (with the English criterion preserved in Sesotho and Tshivenda), at least three points at the same height, across-slope rather than down-slope direction, and the five-day minimum. Dam and spillway regressions also protect the suitably qualified designer, catchment/downstream/safe-spillway factors, limits of annual rainfall as a flood/storage predictor, and erosion/breach-prevention advice.

## Verification and rendering

Focused check:

```sh
node --experimental-strip-types --import ./tests/register-alias.mjs --test --test-name-pattern='Water Harvesting source-paired decks' tests/paired-draft-slides.test.ts
```

Root rendered each language sequentially with the shared paired-slide renderer:

```sh
node scripts/make-lesson-slides.mjs water-harvesting <lang> /tmp/imbewu-water-final-<lang>-20261003 --paired-draft docs/narration/water-harvesting.<lang>.paired-draft.json
```

Root copied only the 45 changed frames, preserving the other 27 regional files byte for byte. Root inspected contact sheets for all 45 changed frames and compressed 390-pixel examples for Sesotho slide 6, Tshivenda slide 23 and Xitsonga slide 24. The separate render-verification packet records paths, hashes, dimensions and source preservation. Actual deployed phone and offline verification remains pending.

No fluent review, local farming review, sanitation approval, rendering, commit, or push is claimed here.
