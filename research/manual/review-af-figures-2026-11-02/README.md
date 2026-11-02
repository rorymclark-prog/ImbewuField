# Blind back-translation review, 2 Nov 2026: Afrikaans Manual figure captions

Scope (commit `f5c4de3`):

| Unit | Strings |
|---|---|
| `content/manual/figures.json`, `caption.af` (all 95 figures) | 95 |
| `lib/locales/af-inline/g51-ui-gaps-2.ts` (site-survey picker, funders checkbox, two "draft" lead-ins, Design pathway notice) | 8 |
| `lib/manual.ts` `FIGURE_CREDIT_AF` (the AI illustration credit) | 1 |

**The reviewer is a model, not a fluent Afrikaans speaker.** "ok" means no meaning error was found, not that the wording is
natural. This review does not replace the fluent-speaker pass.

## Method
A script extracted only the Afrikaans captions (row number and text, no id, no English) to a scratch file. An English
back-translation was written for every row, then the English was joined and each row got ok / minor / repair. A script checked
that every number matches the English before and after (no mismatch). Latin names (only `Leonotis leonurus`, caption 37)
are unchanged. Caveat on blindness: the English of caption 1 and, for the eight UI drafts and the credit line, the English
keys were visible in git output before the back-translations were written, so those 10 rows are not fully blind.

## Result
| Verdict | Count |
|---|---|
| ok | 99 |
| minor (left as drafted) | 3 |
| repair (applied) | 2 |

`review.csv` has one row per string: figure_id, english, before, back_translation, verdict, after, note.

## Repairs
- **05-chicken-needs-yields**: "(kos, water, skuiling, *korrels*, stof)" for "grit". *Korrels* means grains or pellets, so a
  farmer reads grain feed. Now *gruis*, the chapter's word for the small hard stones a hen swallows.
- **10-onions-beside-carrots**: *worteelbedding* is not a word and reads as a root bed. Now *geelwortelbedding*
  (*geelwortel* = carrot, as in the glossary and chapters).

Checked and kept: *konsep* is correctly "draft" in "isiXhosa-konsep.", "Afrikaanse konsep." and the Design pathway notice;
the TLB caption keeps both safety clauses; biogas keeps "kan ontplof" and "hou vlamme weg van lekke en laat vars lug in";
greywater drum keeps "gestoorde gryswater word sleg" and "dieselfde dag"; the solar cooker keeps the hot-pot glove warning;
the owl box keeps "minstens 3 m" and 1 000; the planting hole keeps "twee tot drie keer"; compass keeps 20 tot 28 grade wes.
*Leonotis leonurus* untouched.

## Minor, left as drafted
Hedge as *heining* (fence). *Kappertjie* for nasturtium (captions 82 and 83): it can also mean caper, but it is the word the
Afrikaans chapters use ("kappertjie (nasturtium)"), so it is kept.

## Tests
`node --import ./tests/register-alias.mjs --test tests/manual.test.ts tests/af-inline.test.ts`: 32 pass, 0 fail.
`figures.json` parses. `git diff --check` is clean. Not committed or pushed; PROGRESS.md untouched.
