# Rewrite brief — English Permaculture Manual, second edition (27 Sep 2026)

Rory's decisions:
- "Tighten up the content, make it more accurate", in **his voice** (`research/manual/VOICE.md`).
- Aim for about **38,000 words** in total (the fact-checked edition is 55,000; the original
  handbook was 36,000).
- "I don't want the many *don't try this at home*, legal remarks … it's not the right place to
  constantly read *consult your local agronomist* or *check legal this and that*. Just put it at
  the end, in one paragraph."
- "Do all the proper references, and make sure there is no plagiarism."

You rewrite one or more chapters of `content/manual/en/<slug>.md` **in place**. Read first:
`research/manual/VOICE.md` (the voice), the "Markdown format" section of `research/manual/STYLE.md`
(the only Markdown the app can render), the chapter's fact-check log
`research/manual/factcheck/<slug>.md`, the current chapter, the Word column of
`content/manual/en/12-glossary.md`, and the chapter's part of the original handbook
(`research/manual/rvcc-handbook-source.txt`, line ranges in STYLE.md) — the original is where
Rory's own voice and field detail live.

## Word targets (hard ceilings — count with `wc -w`)

| Chapter | Now | Target |
|---|---|---|
| 00-introduction | 640 | 500 |
| 01-what-is-permaculture | 4,000 | 2,800 |
| 02-planning-your-farm | 2,200 | 1,700 |
| 03-sector-planning | 4,640 | 3,000 |
| 04-vegetable-and-staple-crops | 2,300 | 1,800 |
| 05-animal-systems | 4,790 | 3,300 |
| 06-tree-systems | 6,970 | 4,600 |
| 07-earthworks-and-water | 9,200 | 5,800 |
| 08-soil | 6,430 | 4,400 |
| 09-balanced-ecology | 2,760 | 2,000 |
| 10-natural-pest-control | 6,210 | 4,000 |
| 11-home-and-appropriate-technology | 3,340 | 2,400 |

Cut repetition, over-explanation, hedging, long reference tables nobody uses in the field, and
anything the fact-check could not support. **Keep** every practical method a farmer needs, all
12 principles (chapter 1), the numbers that were checked, and the worked examples that teach a
calculation (roof harvest, tank size, swale spacing) — shortened.

## Shape of every chapter

```
# Title
WHY opening — 1 to 3 short paragraphs. Human or ecological reason first. At most one attributed quote.

**By the end of this chapter you will be able to:**

- 3 to 5 concrete things ("Measure your roof and work out how much rain it can catch")

## Section …            ← each section: WHY → WHAT → HOW (numbered steps) → WHAT HAPPENS
## Try it               ← exactly one hands-on activity, numbered steps, doable on the reader's own land this week
## Key points           ← 3 to 5 bullets, short

One or two closing sentences after the Key points list — they open forward, never summarise
("Observe. Adjust. Write it down. …").
```

- Keep existing `## ` section headings where the topic stays (pictures are placed by section —
  see "Figures" below). Merging, renaming or dropping sections is fine when it makes the chapter
  better; just record it in the figure map.
- Callouts (`> **Tip:**`, `> **Note:**`) sparingly — at most 3 per chapter, and only for field
  wisdom, never for warnings.

## Warnings, law and "consult an expert" — out of the chapters

- **Remove** every `> **Safety:**` box, every legal section or remark (National Water Act,
  NEMBA, permits, registration, dam safety, bylaws), and every "check with / consult / ask your
  extension officer / agronomist / clinic / vet / authority / municipality" line.
- A small number of facts are part of **doing the job right** and stay, stated once, plainly,
  inside the steps — no warning box, no "!" and no scare words. Only where getting it wrong can
  kill or seriously harm someone or poison food. For example: "Compost manure before it goes
  near crops you eat raw." · "Nicotine poisons people and animals as well as insects, so we do
  not make tobacco spray." · "Keep flames away from the biogas dome and pipes." · "Cover tanks
  and ponds." · "Greywater goes under mulch to trees, never onto morogo you eat raw." Keep this
  list short — list every one you kept in your report.
- Plant choices stay correct without legal talk: recommend only non-invasive plants (STYLE.md
  §3 list); where the source named an invader, give the alternative without lecturing.
- Put every legal, permit and "check with the authorities" point you removed as a one-line
  bullet in `research/manual/rewrite/<slug>-endnote.md`. The coordinator turns all of them into
  **one paragraph** at the end of the book.

## References and plagiarism

- Write every sentence in your own words. No run of **12 or more consecutive words** copied
  from any other source (web pages, the ACT 2014 manual, Lancaster, Excellent Development, the
  source handbook's borrowed passages). Standard names (the 12 principles, the 3 ethics) are
  fine. Quotes: at most one short quote (≤ 2 sentences) per section, attributed in the text.
- Write `research/manual/rewrite/<slug>-refs.md`: the sources that support the chapter's facts,
  one per line, in this form:
  `- Author or organisation (year). *Title*. Publisher or site. URL (if online).`
  Use the sources already in the fact-check log plus any you check now. **Only sources you
  have actually seen** — never invent a citation, author, year or URL. The base sources for
  every chapter: Clark, R. (comp.) (2021) *The Permaculture Gardening Handbook*, RVCC project,
  UNDP / Government of Lesotho; and African Conservation Trust (2014) *Introduction to
  Permaculture and Homestead Gardening* where the chapter draws on it. Mollison (1988)
  *Permaculture: A Designers' Manual* and Holmgren (2002) *Permaculture: Principles and
  Pathways Beyond Sustainability* where their ideas are used.

## Accuracy — second fact-check pass

- The fact-check log ends with "Could not verify…" items. For each one still in your chapter:
  check it (WebSearch; WebFetch is usually blocked here), or cut it, or say it generally
  without the unsupported number. Never add a number, species fact or claim you cannot support.
- Append `## Second pass (27 Sep 2026)` to the fact-check log: what you verified (with source),
  what you cut, and any facts you changed.

## Field stories — never invent

Rory's voice lives on field stories from Lesotho and KZN. **Do not invent** stories, results,
places, people or numbers. Where a real story would make a section come alive, leave nothing in
the chapter and add a line to `research/manual/rewrite/<slug>-stories.md`:
`- Section "…": ask Rory for … (e.g. a time a swale held water through a dry spell)`.
You may use the general teaching "we" and "you" freely.

## Words

- South African words throughout: morogo, mielies, veld, pikmatok, amadumbe.
- Technical words from the Glossary's Word column stay exactly as spelt there; explain each in
  a few plain words the first time it appears in the chapter (bold on first use).
- Latin names in italics. Units as now (mm, m, L, kg, °C). Rand for money if you give prices
  (only prices you can support).

## Figures

`research/manual/rewrite/figures-before.json` lists every picture in your chapter with the
`## ` heading it currently sits under. After rewriting, write
`research/manual/rewrite/<slug>-figures.json`: `{ "<figure id>": <new section index> | null }`,
where the index counts `## ` headings from 0 in your new chapter (-1 = before the first `##`).
Use `null` only if the picture's topic is gone. Do not edit `content/manual/figures.json`.

## Rules for working

- Edit only your chapter file(s), their fact-check logs, and your files in
  `research/manual/rewrite/`. Do not touch translations, code, the glossary, or other chapters.
- Scratch files go in `/tmp/claude-0/-home-user-ImbewuField/980f162d-6f98-5a75-af44-533d03612c33/scratchpad/<slug>/` —
  other agents share the scratchpad.
- Check: `node --import ./tests/register-alias.mjs --test tests/manual.test.ts`. The tests
  "each translated chapter keeps the English structure" and the figure tests are EXPECTED to
  fail during the rewrite (translations and figures are redone afterwards); every other test
  must pass. Also `wc -w` against your target, and grep your chapter for "Safety", "consult",
  "check with", "Act", "permit", "legal", "utilis", "optimal", "leafy greens", "hoe".
- Do not commit.

## Report back

Per chapter: word count before → after; sections merged/renamed/dropped; the hard-safety lines
you kept (quote them); how many "could not verify" items you verified / cut / generalised; the
number of references; story slots listed; anything you were unsure about.
