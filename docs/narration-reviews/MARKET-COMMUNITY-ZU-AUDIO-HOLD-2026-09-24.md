# Market Gardening isiZulu narration hold — 24 September 2026

Rory asked for the Seeds module's female voice. Twenty Market Gardening & Community
clips were recorded with `zu-ZA-ThandoNeural` at `-12%` and staged outside the app at
`~/Downloads/imbewu-record/market-community-zu-20260924/`. `RUN.json` and the per-slide
verification files record the script hash, voice, transcript match, decode result and
audio hash. These files are a recoverable recording checkpoint, **not learner media**.

The current `docs/narration/market-community.zu.md` begins with a source warning:
English factual corrections changed slides 2, 7, 8, 10–13, 15, 17, 18 and 20.
The new clips reproduce that stale isiZulu script exactly, so technical audio checks
cannot clear them for learner use. In particular, the old script states unsupported
prices, planting dates, distances, trading rules and outcomes as general guidance.
Do not register these clips in `lib/course-audio.ts` or copy them under `public/`
until the affected passages are reconciled against current English teaching and
re-recorded. Retain the unreviewed label after any draft release; no fluent or local
farming review, or human listening check, is recorded.

Re-run `scripts/record-course-zu-draft.py` only after that source reconciliation.
Its source hashes will invalidate the stale recordings and regenerate changed slides.
