# Vegetables and Staple Crops isiZulu preview — 24 September 2026

**Status: unreviewed draft preview.** The owner authorized a clearly labelled learner preview while first-language isiZulu, local farming and human listening review remain pending. This record does not certify translation or pronunciation.

## Current sources

- English narration: `docs/narration/vegetables-staples.en.md` — SHA-256 `9cfb6fc5784818d529fdfeecb28f367183fce8a28b6dee28c8f88142640d5bd3`
- IsiZulu narration: `docs/narration/vegetables-staples.zu.md` — SHA-256 `9a617e6eb54544534c216268cd8db402cd3112e8436f97a3d4a4ed5ad5566d`
- Course source file: `lib/course-modules.ts` — SHA-256 `a822b4267e91933a6b2eccace7df5d4c2df99f0aaafc97e77278836b4b46b786`
- Source-specific reconciliation: [L3 isiZulu review draft](vegetables-staples-l3.zu.full-draft.md)
- Preview image and audio verification: `docs/media/vegetables-staples/zu-preview/verification.json`

The preceding audio commit's source proof names the current English narration hash, and its checked-in isiZulu script already contains the qualified L3 sweet-potato guidance. The whole-file hash for `lib/course-modules.ts` changed because Seeds lesson text elsewhere in that file changed; the Vegetables L3 body and key points are unchanged. Compared with that audio commit, this script adds three `[pause]` stage directions at paragraph boundaries. The narration exporter removes them before recording, so the spoken text is identical. All 18 clips were regenerated to bind the run proof to the current raw script and module-file hashes.

## Recording proof

The recording uses Microsoft `zu-ZA-ThandoNeural` at `-12%`. Each of the 18 clips and the concatenated full track fully decode. Each per-slide record confirms normalized word-boundary text matches the exported narration and that audio continues through the final word boundary. Human listening review remains pending.

- [Audio asset sizes and hashes](vegetables-staples-zu-audio-assets.md)
- [Recording run and source hashes](vegetables-staples-zu-audio-proof/RUN.json)
- Per-slide word-boundary and decode proofs: `vegetables-staples-zu-audio-proof/`

## Source holds retained

- Sweet potato has only **some** drought tolerance after storage roots form. The narration keeps the need for water in the first weeks and during root formation, the possibility that water stress then reduces harvest, and the edibility of young leaves.
- Amadumbe remains a conditional wet-ground option; the isiZulu narration does not tell learners to plant in waterlogged land. The English body and quiz rationale differ in strength (“handles” versus “prefers” wetter ground), which remains for course-owner and local practitioner review.
- English key points and quiz material include detail absent from the English narration (hybrid seed variation and wetter KZN/coastal conditions). No English lesson or quiz was edited here. The isiZulu narration follows the current English narration and does not invent those missing narration claims.
- No crop species, farming figures, planting recommendations, or isolation distances were added.
