# SEF area language priorities — working handoff, 24 September 2026

This is a **planning inference**, not a claim about the language of any
individual ACT participant. Select a learner's language from that learner's
preference. The municipality figures below are older Census 2011 first-language
figures; ACT should confirm the current villages and participant language mix
before choosing the order of a field rollout.

## Verified project footprint and first translation lanes

| ACT SEF area | Evidence | Language lane |
| --- | --- | --- |
| KwaZulu-Natal | ACT lists it in the SEF footprint. | Continue the current isiZulu release; do not duplicate it. |
| Phuthaditjhaba / QwaQwa, Free State | ACT's [2023 annual report](https://projectafrica.com/wp-content/uploads/2025/01/Annual-Report-2023.pdf) locates 500 SEF participants in the Phuthaditjhaba node. [Statistics South Africa's Maluti-a-Phofung profile](https://www.statssa.gov.za/?id=maluti-a-phofung-municipality&page_id=993) lists Sesotho at 81.7% and isiZulu at 10.7% in Census 2011. | **Sesotho first** for this area. |
| Bushbuckridge / Ehlanzeni, Mpumalanga | ACT's [2023 annual report](https://projectafrica.com/wp-content/uploads/2025/01/Annual-Report-2023.pdf) places another 500 participants in Ehlanzeni; ACT's [media page](https://projectafrica.com/media/) identifies SEF participants in Bushbuckridge. [Statistics South Africa's Bushbuckridge profile](https://www.statssa.gov.za/?id=bushbuckridge-municipality&page_id=993) lists Xitsonga at 56.8%, Sepedi at 24.5%, siSwati at 7.8%, and isiZulu at 3.3% in Census 2011. | **XiTsonga/Xitsonga next**, then **Sepedi**, subject to the actual team locations. Keep siSwati on the local-needs list. |
| Limpopo | ACT's [SEF programme page](https://projectafrica.com/social-employment-fund/) lists Limpopo among four provinces but does not specify its SEF villages. | **Do not infer a Limpopo language from the province alone.** Obtain ACT's participant-site list, then compare each site with local language data. |

Rory excluded Afrikaans from this expansion. The proposed next three lanes are
therefore **Sesotho, Xitsonga and Sepedi**. This is a prioritisation of draft
work, not permission to label automated translation as fluent-reviewed.

## AGY first bounded batch

After Rory signed AGY in, Gemini 3.8 Flash produced source-paired drafts for
Introduction L1, including the lesson, both quizzes and narration slides 1–8:
[Sesotho](../narration-reviews/sef-language-drafts/intro-permaculture-l1.st.ai-draft.md),
[itsonga / Xitsonga](../narration-reviews/sef-language-drafts/intro-permaculture-l1.ts.ai-draft.md),
and [Sepedi](../narration-reviews/sef-language-drafts/intro-permaculture-l1.nso.ai-draft.md).
The prompts contained the current English source and instructed AGY to keep
the borehole permission, source-capacity and monitoring qualifications. The
returned quiz answer indexes and those English/translated safety pairs were
spot-checked. **This is not a complete linguistic or agricultural review.**
One Sepedi phrase for “before you dig” may be inaccurate; the packet must be
checked by a first-language speaker before learner registration. No new
language is registered in the app by this batch.

## Bounded external-agent assignment when AGY is signed in

Give each agent **one language and one complete English core lesson** from the
current `origin/main` snapshot. Start with Sesotho, Xitsonga and Sepedi in
separate worktrees. Use the same stable lesson IDs, quiz option keys, slide IDs
and asset paths. Produce a source-paired translation packet covering the lesson
body, key points, every quiz option and rationale, slide narration, and the
visible app labels that route to that lesson. Preserve every water, chemical,
animal-health, legal and source-uncertainty safeguard; add no species, rates,
distances or time limits. Flag ambiguous English claims rather than guessing.

The first AGY output is a **diff and claim ledger**, not a direct push to main.
The Codex integrator checks English source alignment, all quiz keys and media
paths, reads the actual rendered page, runs `npx tsc --noEmit`, full `npm test`
and `git diff --check`, and inspects both CI jobs. Rory has authorised clearly
labelled draft publication ahead of fluent review. Mark each released lesson as
unreviewed and log the exact first-language/local-farming review dependency.

Do not send AGY the whole repository as one translation prompt. This keeps
parallel output reviewable, avoids repeating already published isiZulu, and
lets each finished lesson be saved and deployed as a coherent batch.
