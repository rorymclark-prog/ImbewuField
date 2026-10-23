# Fact-check log — 00-introduction

Source: `research/manual/rvcc-handbook-source.txt`, lines 175–215 (printed page 5; file marker `===== page 6 =====`).
Output: `public/manual/en/00-introduction.md`.

## Substantive changes

| Original claim | What changed | Why | Source |
|---|---|---|---|
| "a companion to the 5 day Permaculture course" | Kept, but explained that it was first written for a five-day course and can be used alone. Added a "Where this manual comes from" section naming the UNDP / Government of Lesotho RVCC project (2020–21). | Readers in SA were not on the Lesotho course; the origin needed context. Project name confirmed. | https://www.undp.org/lesotho/news/reducing-vulnerability-climate-change ; https://www.adaptation-undp.org/projects/reducing-vulnerability-climate-change-lesothos-foothills-lowlands-and-lower-senqu-river |
| "The handbook contains tutorials on seed saving and plant propagation" | Removed. Replaced with a general statement that the methods reduce input costs. | The handbook has no seed-saving or propagation tutorial (checked the contents list and body; seed saving is mentioned only briefly in Section 3, line ~1657, and propagation only in passing in Section 6). | Internal check of source contents (lines 1–174) |
| Scope: "pest control, soil building and other helpful techniques" | Expanded to list soil, water harvesting, animals, trees and natural pest control. | Matches the actual chapter list (STYLE.md). | STYLE.md chapter table |
| Mollison quote: "The greatest change we need to make is from consumption to production" | Kept, with the fuller wording "…even if on a small scale, in our own gardens", attributed to Bill Mollison and moved into a Note box. | Verified attribution; the fuller wording is the documented form (Mollison, *Introduction to Permaculture*, 1991). | https://www.goodreads.com/quotes/647350-the-greatest-change-we-need-to-make-is-from-consumption ; https://ethics.org.au/big-thinker-bill-mollison/ |
| ACT acknowledgement with "www.projectafrica.com" | Kept the acknowledgement (ACT, *Introduction to Permaculture and Homestead Gardening*, 2014, used and adapted with permission). Web address removed. | STYLE.md forbids links in the reader. Confirmed ACT's site is projectafrica.com (ACT is a South African NGO founded in 2000) — kept here for the record. | https://projectafrica.com/ |
| "Compiled by Rory Clark." | Kept. | Required by brief. | — |
| (none) | Added "How to use this manual": one chapter at a time, start small, Safety/Tip/Note boxes, Key points, SA rainfall seasons, sun in the north, other languages. | Requested by brief; adapts the Lesotho handbook to SA (summer-rainfall interior with frosty Highveld winters; winter-rainfall Western Cape; Southern Hemisphere sun). | STYLE.md §2 |
| (none) | Note that isiZulu, Sesotho, Tshivenḓa and Xitsonga versions are drafts still being checked by fluent speakers. | STYLE.md translation rules say the translations are machine drafts needing review; the reader must not be told otherwise. | STYLE.md |
| (none) | Added "## Key points". | Required by brief. | — |

## Figures removed

| Caption / description | Source page (printed) |
|---|---|
| Photograph of Bill Mollison beside his quote, credited "Image Credit: WikiMedia Commons" | p. 5 (file marker page 6) |

## Could not verify / softened / left out

- The exact title of the ACT manual could not be confirmed online (ACT's site is reachable in search results, but no page naming the 2014 manual was found). The title is kept as given in the source, since the compiler had permission from ACT.
- The web address was left out of the reader only because links are not allowed; it is not in doubt.

## Second pass (27 Sep 2026)

Rewrite to REWRITE.md (639 → about 500 words): new WHY opening, "Who this manual is for", credits, a numbered "How to use this manual" (chapters, Glossary at the end, law and safety notes gathered at the end, translations), Key points.

- **Mollison quote:** re-checked by WebSearch; the fuller wording is consistently attributed to Mollison (Goodreads quote page, The Ethics Centre, Permaculture Research Institute), but no search result tied it to a page of *Introduction to Permaculture* (1991). The text now attributes it to Mollison without naming the book, and the book is no longer cited as its source.
- **ACT title:** still could not be confirmed online; kept as given in the source handbook (the compiler had ACT's permission).
- **RVCC project:** UNDP / Government of Lesotho, 2020–21 — kept, sources as in the first pass.
- **Cut:** "ask local farmers and extension officers" (see `research/manual/rewrite/00-introduction-endnote.md`); the sun-in-the-north and rainfall-season notes (covered in Chapters 2 and 3); the instruction to read Safety boxes (these boxes are being removed from all chapters).
- **Changed:** "seed, fertiliser and chemicals" costs are now stated without a trend ("are dear"). Translations named as isiZulu, Sesotho and Tshivenḓa only, because Xitsonga is paused in the app (`lib/manual.ts` MANUAL_LANGS).
