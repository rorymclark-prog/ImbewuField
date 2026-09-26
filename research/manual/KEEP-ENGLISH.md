# Keep-English pass + Glossary chapter (brief for language agents)

Rory's decision (26 Sep 2026): difficult technical words stay in **English** in every language, and
the manual ends with a **Glossary** chapter. The fixed word list is the "Word" column of
`content/manual/en/12-glossary.md` (66 words: animal tractor, biomass, compost, mulch, swale,
berm, contour, guild, food forest, greywater, worm farm, rocket stove, wonder bag …).

You are given a LANGUAGE (zu, st, ve or ts). Read first: `research/manual/STYLE.md`,
`research/manual/glossary-<LANGUAGE>.md` and `content/manual/en/12-glossary.md`.

## Part A — translate the Glossary chapter

Write `content/manual/<LANGUAGE>/12-glossary.md` from `content/manual/en/12-glossary.md`:
- Translate the title, the intro paragraph, the table header, every "What it means" cell and the
  Key points.
- The **Word column stays exactly in English** (same spelling, same order, one row per word; the
  italic *chicken tractor* stays English too). Do not add a noun-class prefix in this column.
- Keep the structure identical (one table, same number of rows, same Key points count).

## Part B — use the English words in chapters 00–11

In `content/manual/<LANGUAGE>/00-…md` to `11-…md`, wherever the text uses a coined local phrase
for one of the 66 glossary words, replace it with the English word:
- **First time the word appears in a chapter:** write the English word in bold, followed by a
  very short local explanation in brackets, for example isiZulu `**i-biomass** (izinto
  zezitshalo nezilwane ezikhula emhlabeni wakho)`. If the chapter already writes
  "local phrase (English)", flip it to "English (short local explanation)".
- **Later uses in the same chapter:** just the English word, no brackets.
- **Grammar:** attach the prefix or plural marker the language needs, joined with a hyphen, in the
  way the app already does: isiZulu `i-compost`, `ama-swale`; Sesotho `di-swale`; Tshivenḓa
  `dzi-swale`; Xitsonga `ti-swale`. Keep the English root unchanged.
- **Do not change** anything else. Leave words that are NOT in the 66-word list as they are,
  keep the meaning, and leave safety wording, numbers and Latin names untouched. Where an
  everyday local word is clearly better and already universal (for example the word for "tree",
  "soil", "water", "rain", "seed"), leave it — the list only covers the technical terms.
- Structure must stay identical to the English chapter (the test in `tests/manual.test.ts` checks
  headings, list items, callouts and table rows). Change words only; do not add or remove lines,
  list items or callouts.

Work efficiently: for each glossary word, look up its local phrase(s) in
`research/manual/glossary-<LANGUAGE>.md`, `grep` the chapter files for those phrases, and edit
only those places.

## Part C — record it

Append to `research/manual/glossary-<LANGUAGE>.md` a section "## Kept in English (26 Sep 2026)"
listing the 66 words and the local phrase(s) you replaced for each.

## Verify

`cd /home/user/ImbewuField && node --import ./tests/register-alias.mjs --test tests/manual.test.ts`
must pass. Also spot-check with `grep -c` that each chapter now contains English glossary words.
Do not commit. Report: words replaced per chapter (roughly), anything you left local and why.
