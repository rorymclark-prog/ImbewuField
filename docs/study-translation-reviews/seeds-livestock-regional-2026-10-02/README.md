# Seeds and Small Livestock regional drafts: review record (2 October 2026)

Six module editions: **Seeds and Seed Sovereignty** and **Small Livestock Integration** in Sesotho (South African
orthography, Free State/QwaQwa), Tshivenda, and standard written Xitsonga (provisional for the Shangani-speaking
group). Everything here is an **unreviewed machine draft**. The exact English source is shown beside every draft in
the app. No fluent-speaker, local-farming or Shangani-comprehension approval is claimed. Facilitators review the
published drafts and send feedback afterwards.

## What is drafted

| | Seeds | Small Livestock |
| --- | ---: | ---: |
| Lesson fields per language (card, titles, image descriptions, paragraphs, key points, questions, options, explanations) | 66 | 66 |
| Slide passages per language (headings and paragraphs) | 178 | 90 |
| Existing slide frames per language (reused illustrations, re-rendered text) | 24 | 20 |
| English holds | 0 | 0 |

Totals across the three languages: 396 lesson fields and 804 slide passages, counted separately from the 132
slide image files. The image files existed before; a module is not complete because its frames exist.

## Method

1. Parallel drafting agents (Claude Sonnet) per language and module, with fixed rules: translate ordinary prose
   fully; keep difficult technical terms in English inside translated sentences; keep every number, species name,
   quiz order and correct answer; keep qualifications such as "may", "can", "before" and "do not".
2. A blind English back-translation of every passage by a separate agent that never saw the English source.
3. An independent semantic check of draft against exact English. Passages that changed afterwards were
   back-translated again; a back-translation only counts if it was made from the exact current text.
4. A separate animal-name check (an earlier draft confused ducks with frogs) and a list of words that must never
   appear, enforced by tests in `tests/regional-full-draft-checks.ts`.

The `*.back-translations.json` files in this folder list each passage key, exact English source, draft and blind
back-translation.

## Technical terms kept in English

open-pollinated, F1 hybrid, stable variety, pollination, self-pollination, cross-pollinated, desiccant,
fermentation, wet-method, debris, chaff, sieve, germination test (in some languages), chicken tractor, floorless,
bedding, compost, manure (Tshivenda), seedlings (Tshivenda), fencing (Tshivenda), hive, colony, swarm, queen,
Cape honeybee, African honeybee, subspecies, Department, demarcation line, control measures, extension adviser,
animal-health plan, parasite plan, grazing camp, nutrients, pollinators, ticks, guinea fowl, beekeeper
(Tshivenda). Many are glossed or paired with a local word, for example "dikwahelo (covers)" or "mofuta (variety)".

## Look at these first

- **Xitsonga Seeds, lesson 1 quiz 2 option 3 and lesson 2 image description:** "vuthaka" was replaced with
  "vupfeke" (ripe), the form used everywhere else in the module. The back-translator marked "ximilana" (plant) as
  uncertain.
- **Xitsonga Seeds slide 20, paragraph 5:** "6 eka 10 i ku fana ni 60 wa tiphesente" came back as "is equal to 60
  percent"; the English says "about sixty percent".
- **Tshivenda Seeds slide 14, paragraph 1:** "Scoop" is drafted as "bvisani" (take out). "With a spoon" was
  removed to fit the slide; it is not in the English.
- **Tshivenda Small Livestock, lesson 2 and slide 11:** the subspecies sentence now names bees as "ṋotshi
  (honeybee)"; it previously left "honeybee" in English without a Tshivenda word.
- **Xitsonga** is the standard written form. It has not been tested with Shangani speakers.

No regional narration was generated or published. Optional narration stays in English.
