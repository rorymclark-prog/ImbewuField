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

## Corrected source batch — 24 September 2026

The stale batch above remains held and was not copied to learner assets. After the
English corrections merged, v2 was recorded from the updated isiZulu draft at
SHA-256 `491aedec998c8ca7dc3a1a338fc9355b16bd462603362a89915ec7c224e9f314`.
The script still contained its review disclosure and reviewer appendix then. That
batch remains in `~/Downloads/imbewu-record/market-community-zu-20260924-v2/`
as historical evidence, but was not imported.

The disclosure and reviewer appendix have now been preserved in this review record
and moved out of the spoken source, leaving only the 20 numbered slide blocks in
`docs/narration/market-community.zu.md`. v4 was generated from an earlier slide-only
snapshot at SHA-256 `8dad6354d693c5012696f103fdfd8130572ff5c805158eb9ba7f21d1a67d52b2`;
its staged files remain outside the repo as superseded history. Its temporary working-tree
import is being replaced before any commit.

The reviewed corrections to headings 8, 11, 12, 17 and 18, plus slide 14's transport wording,
are in the current script. v5 was generated from SHA-256
`da430cefdedadb574602aa1d3a1fa9373f90d20daffddab4d32a4d0f533ed92b` and staged at
`~/Downloads/imbewu-record/market-community-zu-20260924-v5/`. The 20 clips have replaced the
working-tree assets; a concatenated full narration also decodes successfully (607.152 seconds).
The pending review exception initially bound this exact recording-source SHA. At that point,
no commit or publication deployment had been made from the recording branch.

On 24 September, after that audio batch was published, slide 14's display heading was shortened
to `Buka: Ukubambisana Komakhelwane` to remove a visible malformed word. The spoken slide 14
paragraphs and all 20 audio clips are unchanged. The current script SHA is
`31c0990885544d52893fc113cff84f9a11c8d37d79153ab1b83b1e50a67c60ca`; the hash-bound
pending review exception follows that title-only edit. This is not a fluent-language sign-off.

The batch uses Microsoft `zu-ZA-ThandoNeural` at `-12%`, matching Rory's voice
direction. Per-slide proofs report text match, audio hash, word boundaries and
full decode; they do not establish pronunciation or translation quality.
This is published as a generated, unreviewed draft at Rory's direction. Human
listening, fluent review pending, and local farming review remain outstanding. This record
does not certify translation or pronunciation. Keep the player warning and
pending release exception until documented review is complete.

## TERMS NEEDING REVIEW

The entire isiZulu narration remains a draft until a fluent isiZulu speaker and
local farming reviewer check it. Seed and market terminology may need specialist
input. This generated audio has not received human listening review.


## Preserved narration-file disclosure and reviewer appendix

Moved out of the slide-only recording source on 24 September so it cannot be read aloud. Preserved verbatim:

### Original source disclosure

ISIZULU DRAFT UPDATE — 24 September 2026: slides 2, 7, 8, 10–13, 15, 17, 18 and 20 now use proposals paired with the current English narration. The earlier recordings no longer match this text and must be regenerated. This remains an unreviewed isiZulu draft; it has not received fluent-speaker, farmer or practitioner approval.

### Original reviewer appendix

## Notes for the Human Reviewer

**This is a draft translation only. It must be read by a first-language isiZulu speaker who
farms before this script goes anywhere near a learner.** Nothing here has been reviewed by a
person.

It was written to match `docs/narration/market-community.en.md` slide for slide — 20 isiZulu blocks
against 20 English ones — so the deck and the narration cannot drift apart.

**The instruction was to BORROW, never to coin.** An earlier isiZulu draft in this course invented
22 agronomic terms and is still blocked from recording because of it, so where no everyday isiZulu
word exists the English word was kept and carried on an isiZulu noun-class prefix instead. Those
borrowings are listed below — they are the first thing to check, because a borrowing that a farmer
would not actually say out loud is the same failure as a coined term:

- `ama-dozen`
- `i-compost`
- `i-grafting`
- `i-grain`
- `i-oda`
- `i-WhatsApp`
- `ku-compost`
- `ku-Ephreli`

Please also confirm:

- The register is ordinary spoken farming isiZulu — the words a KwaZulu-Natal farmer uses aloud,
  not written or academic isiZulu.
- Every number and every plant or animal name matches the English script. Nothing was to be added,
  and no species may be named that the English does not name.
- Nothing addresses a room. The learner is alone on a phone; there is no group and no facilitator.

When the review is done, correct the script and delete this appendix. Deleting the appendix without
doing the review defeats the guard in `tests/narration-scripts.test.ts` that is holding this back.
